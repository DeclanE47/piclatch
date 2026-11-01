import {
  api,
  prefs,
  defaults,
  safeURL,
  dedupe,
  filename,
  type Job,
  type ImageItem,
} from "./core";
let chain = Promise.resolve();
function serial<T>(f: () => Promise<T>): Promise<T> {
  const next = chain.then(f);
  chain = next.then(
    () => {},
    () => {},
  );
  return next;
}
const getJobs = async (): Promise<Job[]> =>
  ((await api.storage.session.get("jobs")).jobs as Job[]) || [];
const putJobs = (jobs: Job[]) => api.storage.session.set({ jobs });
async function feedback(j: Job) {
  if (j.tabId < 0) return;
  try {
    await api.tabs.sendMessage(
      j.tabId,
      {
        type: "feedback",
        url: j.image.url,
        ok: j.state === "complete",
        error: j.error,
      },
      { frameId: j.frameId },
    );
  } catch {}
}
// Storage transitions are serial; network startup must not block cancellation or UI requests.
async function startDownload(job: Job, folder: string) {
  let downloadId: number | undefined;
  let error: string | undefined;
  try {
    let url = job.image.url;
    if (url.startsWith("blob:")) {
      const r = await api.tabs.sendMessage(
        job.tabId,
        { type: "prepare", url },
        { frameId: job.frameId },
      );
      if (r?.error) throw Error(r.error);
      url = r.url;
    }
    if (!safeURL(url)) throw Error("Unsupported image source.");
    downloadId = await api.downloads.download({
      url,
      filename: filename(url, folder),
      conflictAction: "uniquify",
    });
  } catch (e) {
    error = (e as Error).message;
  }
  await serial(async () => {
    const jobs = await getJobs();
    const j = jobs.find((j) => j.id === job.id);
    if (!j || j.state === "cancelled") {
      if (downloadId !== undefined)
        await api.downloads.cancel(downloadId).catch(() => {});
      return;
    }
    j.downloadId = downloadId;
    if (error) {
      j.state = "failed";
      j.error = error;
      void feedback(j);
    } else {
      j.state = "active";
      const [d] = await api.downloads.search({ id: downloadId! });
      if (d?.state === "complete") {
        j.state = "complete";
        void feedback(j);
      } else if (d?.state === "interrupted") {
        j.state = "failed";
        j.error = d.error || "Download interrupted.";
        void feedback(j);
      }
    }
    await putJobs(jobs);
    await pump();
  });
}
async function pump() {
  const jobs = await getJobs();
  let slots =
    3 - jobs.filter((j) => ["starting", "active"].includes(j.state)).length;
  const p = await prefs();
  const selected: Job[] = [];
  for (const j of jobs) {
    if (slots <= 0) break;
    if (j.state !== "queued") continue;
    slots--;
    j.state = "starting";
    selected.push(j);
  }
  await putJobs(jobs);
  for (const j of selected) void startDownload(j, p.folder);
}
async function reconcile() {
  const jobs = await getJobs();
  for (const j of jobs) {
    if (j.state === "starting") {
      j.state = "failed";
      j.error =
        "Download startup was interrupted. Check browser downloads before retrying.";
    }
    if (j.state === "active" && j.downloadId !== undefined) {
      const [d] = await api.downloads.search({ id: j.downloadId });
      if (!d || d.state === "interrupted") {
        j.state = "failed";
        j.error = d?.error || "Download is no longer available.";
      } else if (d.state === "complete") {
        j.state = "complete";
        void feedback(j);
      }
    }
  }
  await putJobs(jobs);
  await pump();
}
async function register() {
  const granted = await api.permissions.getAll();
  await api.scripting.unregisterContentScripts();
  const matches = (granted.origins || []).filter(
    (x) => /^https?:\/\//.test(x) || x === "<all_urls>",
  );
  if (matches.length)
    await api.scripting.registerContentScripts([
      {
        id: "pluck-save",
        matches,
        js: ["content.js"],
        allFrames: true,
        runAt: "document_idle",
      },
    ]);
}
async function activate(tabId: number) {
  try {
    await api.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ["content.js"],
    });
  } catch {
    await api.scripting
      .executeScript({ target: { tabId }, files: ["content.js"] })
      .catch(() => {
        throw Error(
          "This page cannot be accessed. Open a normal website and enable site access.",
        );
      });
  }
}
async function scan(tabId: number) {
  await activate(tabId);
  let frames: { frameId: number }[];
  try {
    frames = await api.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => true,
    });
  } catch {
    frames = [{ frameId: 0 }];
  }
  const results = await Promise.allSettled(
    frames.map(async (f) => {
      const found: ImageItem[] = await api.tabs.sendMessage(
        tabId,
        { type: "scan" },
        { frameId: f.frameId },
      );
      return found.map((i) => ({ ...i, frameId: f.frameId }));
    }),
  );
  return dedupe(
    results.flatMap((r) => (r.status === "fulfilled" ? r.value : [])),
  );
}
api.runtime.onMessage.addListener((m, sender, reply) => {
  if (sender.id !== api.runtime.id) return;
  const internal = !!sender.url?.startsWith(api.runtime.getURL(""));
  const fromPage = !!sender.tab && /^https?:/.test(sender.url || "");
  if (!internal && !fromPage) return;
  const task = async () => {
    if (!m || typeof m.type !== "string") throw Error("Invalid request.");
    if (m.type === "preferences") return prefs();
    if (!internal && m.type !== "save")
      throw Error("Request is restricted to extension pages.");
    switch (m.type) {
      case "setPreferences": {
        const p = await prefs();
        const q = m.patch || {};
        if (typeof q.paused === "boolean") p.paused = q.paused;
        if (["alt", "ctrl", "shift"].includes(q.modifier))
          p.modifier = q.modifier;
        if (typeof q.folder === "string" && q.folder.length <= 150)
          p.folder = q.folder;
        if (
          Array.isArray(q.excluded) &&
          q.excluded.every(
            (x: unknown) => typeof x === "string" && x.length < 254,
          )
        )
          p.excluded = q.excluded.slice(0, 1000);
        await api.storage.local.set({ preferences: p });
        return p;
      }
      case "activate":
        await activate(m.tabId);
        return { ok: true };
      case "collect":
        return scan(m.tabId);
      case "jobs":
        return (await getJobs()).filter(
          (j) => m.collection === undefined || j.collection === m.collection,
        );
      case "save": {
        if (!Array.isArray(m.images) || m.images.length > 2000)
          throw Error("Choose up to 2,000 images at a time.");
        const p = await prefs();
        if (p.paused)
          throw Error("Save mode is paused. Resume it from the toolbar.");
        if (fromPage && p.excluded.includes(new URL(sender.url!).hostname))
          throw Error("Saving is disabled on this site.");
        const tabId = fromPage ? sender.tab!.id! : (m.tabId ?? -1);
        const frameId = fromPage ? sender.frameId || 0 : 0;
        const jobs = await getJobs();
        const images = dedupe(
          m.images.filter(
            (i: ImageItem) =>
              i &&
              typeof i.url === "string" &&
              safeURL(i.url) &&
              typeof i.name === "string",
          ),
        );
        for (const image of images) {
          if (
            jobs.some(
              (j) =>
                j.image.url === image.url &&
                j.tabId === tabId &&
                ["queued", "starting", "active"].includes(j.state),
            )
          )
            continue;
          jobs.push({
            id: crypto.randomUUID(),
            image,
            tabId,
            frameId: internal
              ? Number.isInteger(image.frameId)
                ? image.frameId!
                : 0
              : frameId,
            collection: internal ? m.collection : undefined,
            state: "queued",
          });
        }
        await putJobs(jobs);
        await pump();
        return { ok: true };
      }
      case "cancel": {
        const jobs = await getJobs();
        for (const j of jobs.filter(
          (j) =>
            j.collection === m.collection &&
            ["queued", "starting", "active"].includes(j.state),
        )) {
          j.state = "cancelled";
        }
        await putJobs(jobs);
        for (const j of jobs)
          if (
            j.collection === m.collection &&
            j.state === "cancelled" &&
            j.downloadId !== undefined
          )
            void api.downloads.cancel(j.downloadId).catch(() => {});
        await pump();
        return { ok: true };
      }
      case "retry": {
        const jobs = await getJobs();
        for (const j of jobs)
          if (j.collection === m.collection && j.state === "failed") {
            j.state = "queued";
            delete j.downloadId;
            delete j.error;
          }
        await putJobs(jobs);
        await pump();
        return { ok: true };
      }
      default:
        throw Error("Unknown request.");
    }
  };
  void serial(task).then(reply, (e) => reply({ error: e.message }));
  return true;
});
api.downloads.onChanged.addListener((delta) => {
  void serial(async () => {
    if (!delta.state) return;
    const jobs = await getJobs();
    const j = jobs.find(
      (j) => j.downloadId === delta.id && j.state === "active",
    );
    if (!j) return;
    if (delta.state.current === "complete") j.state = "complete";
    else if (delta.state.current === "interrupted") {
      j.state = "failed";
      j.error = delta.error?.current || "Browser interrupted the download.";
    }
    await putJobs(jobs);
    if (j.state !== "active") void feedback(j);
    await pump();
  });
});
api.permissions.onAdded.addListener(() => {
  void serial(register);
});
api.permissions.onRemoved.addListener(() => {
  void serial(register);
});
api.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "pluck-save" || !info.srcUrl || !tab?.id) return;
  void serial(async () => {
    const p = await prefs();
    if (
      p.paused ||
      p.excluded.includes(new URL(tab.url || "https://invalid").hostname)
    )
      return;
    const image = {
      url: info.srcUrl!,
      name: "Image",
      width: 0,
      height: 0,
      format: "IMAGE",
    };
    if (!safeURL(image.url)) return;
    const jobs = await getJobs();
    if (
      jobs.some(
        (j) =>
          j.tabId === tab.id &&
          j.image.url === image.url &&
          ["queued", "active", "starting"].includes(j.state),
      )
    )
      return;
    jobs.push({
      id: crypto.randomUUID(),
      image,
      tabId: tab.id!,
      frameId: info.frameId || 0,
      state: "queued",
    });
    await putJobs(jobs);
    await pump();
  });
});
api.tabs.onRemoved.addListener((id) => {
  void serial(async () => {
    const jobs = await getJobs();
    for (const j of jobs)
      if (j.collection === id && j.state === "queued") j.state = "cancelled";
    await putJobs(
      jobs.filter(
        (j) => (j.collection !== id && j.tabId !== id) || j.state === "active",
      ),
    );
  });
});
api.runtime.onInstalled.addListener((details) => {
  void serial(async () => {
    await api.contextMenus.removeAll();
    api.contextMenus.create({
      id: "pluck-save",
      title: "Save image with PicLatch",
      contexts: ["image"],
    });
    if (details.reason === "install") {
      await api.storage.local.set({ preferences: defaults });
      await api.tabs.create({ url: api.runtime.getURL("onboarding.html") });
    }
    await register();
  });
});
void serial(async () => {
  await register();
  await reconcile();
});
