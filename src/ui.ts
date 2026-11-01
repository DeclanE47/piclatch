import { buildArchive, imageBytes } from "./archive";
import {
  api,
  send,
  prefs,
  type Preferences,
  type ImageItem,
  type Job,
} from "./core";
import "./style.css";
const root = document.querySelector<HTMLElement>("#app")!;
const page = location.pathname.split("/").pop()?.split(".")[0] || "popup";
const brand = "PicLatch";
root.innerHTML = `<header><a class="brand" href="onboarding.html" target="_blank"><img src="icons/icon48.png" alt="">PicLatch</a><a class="support-link" href="https://ko-fi.com/declane47" target="_blank" rel="noopener noreferrer">Support on Ko-fi</a></header><main></main><footer><span>Free and open source</span><a href="about.html" target="_blank">About & privacy ↗</a></footer>`;
const main = root.querySelector("main")!;
function status(text: string, error = false) {
  let box = document.querySelector<HTMLElement>("#status");
  if (!box) {
    box = document.createElement("p");
    box.id = "status";
    box.setAttribute("role", "status");
    main.prepend(box);
  }
  box.className = error ? "notice error" : "notice";
  box.textContent = text;
}
function click(id: string, fn: () => any) {
  document.getElementById(id)!.addEventListener("click", () => {
    try {
      Promise.resolve(fn()).catch((e) => status(e.message, true));
    } catch (e) {
      status((e as Error).message, true);
    }
  });
}
async function active() {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw Error("Open a website first.");
  return tab;
}
async function grant(origins: string[]) {
  const accepted = await api.permissions.request({ origins });
  if (!accepted)
    throw Error(
      "Access was not granted. You can try again or use Enable on this page.",
    );
  status("Access enabled. Open or reload your website to start saving.");
}
if (page === "onboarding") {
  main.innerHTML = `<section class="hero"><h1>Set up<br><mark>PicLatch</mark></h1><p>Hold <kbd>Alt</kbd> (Option on Mac) and click an image.<br>The original file lands in your downloads.</p><div class="demo"><div class="demo-picture"><span>SAVE<br>IMAGES</span><b>↖</b></div><div><strong>Save original image files.</strong><p>No account. No ads. No tracking.</p></div></div><h2>Where should saving work?</h2><p>Website access lets PicLatch detect the image you click. Images go directly from their host to your browser, never through us.</p><div class="actions"><button id="everywhere" class="primary">Enable everywhere ↗</button><button id="selected">Choose sites as I go</button></div><p class="muted">You stay in control. Pause anytime, or disable individual sites.</p><p id="choice" role="status"></p></section>`;
  click("everywhere", () => grant(["http://*/*", "https://*/*"]));
  click("selected", () => {
    document.getElementById("choice")!.textContent =
      "Ready. Pin PicLatch to your toolbar, open a website, then choose Enable on this page or Always on this site.";
  });
} else if (page === "popup") {
  document.body.classList.add("popup");
  const p = await prefs();
  const tab = await active();
  let hostname = "";
  try {
    hostname = new URL(tab.url || "").hostname;
  } catch {}
  main.innerHTML = `<h1>Save images</h1><div class="mode"><div><strong>Save mode</strong><small id="mode-label"></small></div><button id="pause" aria-pressed="false">Pause</button></div><button id="collect" class="primary wide">Collect images <span>↗</span></button><div class="actions" id="access-actions" hidden><button id="activate">Enable on this page</button><button id="site">Always on this site</button></div><label class="check"><input type="checkbox" id="excluded">Disable saving on this site</label><details><summary>Settings</summary><label>Save gesture<select id="modifier"><option value="alt">Alt / Option + click</option><option value="shift">Shift + click</option><option value="ctrl">Ctrl + click</option></select></label><label>Download subfolder<input id="folder" maxlength="150" placeholder="Browser default folder"></label><button id="settings">Save preferences</button><button id="all">Enable on all websites</button><button id="revoke">Remove persistent website access</button></details>`;
  async function refreshAccess() {
    const website = /^https?:/.test(tab.url || "");
    const siteAllowed =
      website &&
      (await api.permissions.contains({
        origins: [new URL(tab.url!).origin + "/*"],
      }));
    const allAllowed = await api.permissions.contains({
      origins: ["http://*/*", "https://*/*"],
    });
    const granted = await api.permissions.getAll();
    document.getElementById("access-actions")!.hidden = !website || siteAllowed;
    document.getElementById("all")!.hidden = allAllowed;
    document.getElementById("revoke")!.hidden = !(granted.origins || []).length;
    document.querySelector<HTMLInputElement>("#excluded")!.disabled = !website;
  }
  await refreshAccess();
  api.permissions.onAdded.addListener(() => {
    void refreshAccess().catch((e) => status(e.message, true));
  });
  api.permissions.onRemoved.addListener(() => {
    void refreshAccess().catch((e) => status(e.message, true));
  });
  const modifier = document.querySelector<HTMLSelectElement>("#modifier")!;
  modifier.value = p.modifier;
  const folder = document.querySelector<HTMLInputElement>("#folder")!;
  folder.value = p.folder;
  const excluded = document.querySelector<HTMLInputElement>("#excluded")!;
  excluded.checked = p.excluded.includes(hostname);
  const paint = (v: Preferences) => {
    document.getElementById("mode-label")!.textContent = v.paused
      ? "Paused everywhere"
      : `${v.modifier === "alt" ? "Alt / Option" : v.modifier === "ctrl" ? "Ctrl" : "Shift"} + click to save`;
    const b = document.getElementById("pause")!;
    b.textContent = v.paused ? "Resume" : "Pause";
    b.setAttribute("aria-pressed", String(v.paused));
  };
  paint(p);
  click("pause", async () =>
    paint(
      await send({
        type: "setPreferences",
        patch: { paused: !(await prefs()).paused },
      }),
    ),
  );
  click("activate", async () => {
    await send({ type: "activate", tabId: tab.id! });
    status("Enabled for this page. Hold your save key and click an image.");
  });
  click("site", () => {
    if (!/^https?:/.test(tab.url || ""))
      throw Error("Open a normal website first.");
    return grant([new URL(tab.url!).origin + "/*"]);
  });
  click("all", () => grant(["http://*/*", "https://*/*"]));
  click("revoke", async () => {
    const permissions = await api.permissions.getAll();
    await api.permissions.remove({ origins: permissions.origins || [] });
    status(
      "Persistent access removed. Reload open pages to remove existing page listeners.",
    );
  });
  excluded.onchange = () => {
    void (async () => {
      const current = await prefs();
      await send({
        type: "setPreferences",
        patch: {
          excluded: excluded.checked
            ? [...new Set([...current.excluded, hostname])]
            : current.excluded.filter((x) => x !== hostname),
        },
      });
    })().catch((e) => status(e.message, true));
  };
  click("settings", async () => {
    paint(
      await send({
        type: "setPreferences",
        patch: {
          modifier: modifier.value as Preferences["modifier"],
          folder: folder.value,
        },
      }),
    );
    status("Preferences saved.");
  });
  click("collect", async () => {
    await send({ type: "activate", tabId: tab.id! });
    await api.tabs.create({
      url: api.runtime.getURL("collection.html") + "?tab=" + tab.id,
    });
  });
} else if (page === "collection") {
  const source = Number(new URLSearchParams(location.search).get("tab"));
  const self = await api.tabs.getCurrent();
  const collection = self!.id!;
  let images: ImageItem[] = [];
  const selection = new Set<string>();
  let jobs: Job[] = [];
  let loading = false;
  let archiveController: AbortController | undefined;
  let archiveDownload: number | undefined;
  let archiveURL: string | undefined;
  let archiveStatus = "";
  let archiveFailed: ImageItem[] = [];
  main.innerHTML = `<div class="collection-heading"><div><h1>Page images</h1><p>Select one image to save it, or select multiple images to download a ZIP.</p></div><button id="refresh">Refresh after scrolling ↻</button></div><div class="tools"><label>Minimum width <input id="minimum" type="number" min="0" value="0" step="50"> px</label><button id="select">Select visible</button><button id="clear">Clear selection</button><span id="count" aria-live="polite"></span></div><p class="muted">Only images currently exposed by the page are included. Scroll the source page, then refresh. Restricted frames may be unavailable. Unknown dimensions remain visible at 0 px.</p><div id="grid" class="grid"></div><div class="download-bar"><div><strong id="selection">0 selected</strong><small id="progress" role="status">Temporary collection. Closing this tab discards its selection.</small></div><div class="actions"><button id="cancel">Cancel queue</button><button id="retry">Retry failed</button><button id="download" class="primary">Download selected ↓</button></div></div>`;
  const grid = document.getElementById("grid")!;
  const minimum = document.querySelector<HTMLInputElement>("#minimum")!;
  const visible = () => images.filter((i) => i.width >= Number(minimum.value));
  function counts() {
    document.getElementById("selection")!.textContent =
      `${selection.size} selected`;
    document.getElementById("count")!.textContent =
      `${visible().length} of ${images.length} images`;
    document.querySelector<HTMLButtonElement>("#download")!.disabled =
      selection.size === 0 ||
      !!archiveController ||
      archiveDownload !== undefined;
    document.getElementById("download")!.textContent =
      selection.size > 1
        ? `Download ${selection.size} images as ZIP ↓`
        : "Download selected ↓";
  }
  function render() {
    grid.replaceChildren();
    for (const i of visible()) {
      const card = document.createElement("label");
      card.className = "image-card";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = selection.has(i.url);
      input.setAttribute("aria-label", "Select " + i.name);
      input.onchange = () => {
        input.checked ? selection.add(i.url) : selection.delete(i.url);
        counts();
      };
      const img = document.createElement("img");
      img.src = i.url;
      img.alt = i.name;
      img.loading = "lazy";
      img.referrerPolicy = "no-referrer";
      img.onerror = () => {
        card.classList.add("unavailable");
      };
      const info = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = i.name;
      const meta = document.createElement("small");
      meta.textContent = `${i.width || "?"} × ${i.height || "?"} · ${i.format}`;
      info.append(title, meta);
      card.append(input, img, info);
      grid.append(card);
    }
    counts();
    if (!images.length)
      status("No images found. Scroll the source page and refresh.");
  }
  async function refresh() {
    if (loading) return;
    loading = true;
    try {
      images = await send({ type: "collect", tabId: source });
      for (const u of selection)
        if (!images.some((i) => i.url === u)) selection.delete(u);
      render();
    } finally {
      loading = false;
    }
  }
  minimum.oninput = render;
  click("refresh", refresh);
  click("select", () => {
    visible().forEach((i) => selection.add(i.url));
    render();
  });
  click("clear", () => {
    selection.clear();
    render();
  });
  async function downloadSelected() {
    const chosen = images.filter((i) => selection.has(i.url));
    if (!chosen.length || archiveController || archiveDownload !== undefined)
      return;
    if (chosen.length === 1) {
      archiveStatus = "";
      archiveFailed = [];
      await send({ type: "save", images: chosen, tabId: source, collection });
      selection.clear();
      render();
      return;
    }
    // Request only the image hosts needed for this ZIP, from the button's user gesture.
    const origins = [
      ...new Set(
        chosen
          .filter((i) => /^https?:/.test(i.url))
          .map((i) => new URL(i.url).origin + "/*"),
      ),
    ];
    if (origins.length && !(await api.permissions.request({ origins })))
      throw Error(
        "Image-host access is needed to create this ZIP. Allow access and try again.",
      );
    const p = await prefs();
    if (p.paused)
      throw Error("Save mode is paused. Resume it from the toolbar.");
    archiveController = new AbortController();
    archiveFailed = [...chosen];
    counts();
    try {
      const result = await buildArchive(
        chosen,
        async (image, signal) => {
          let url = image.url;
          if (url.startsWith("blob:")) {
            const r = await api.tabs.sendMessage(
              source,
              { type: "prepare", url },
              { frameId: image.frameId || 0 },
            );
            if (r.error) throw Error(r.error);
            url = r.url;
          }
          try {
            return await imageBytes(
              await fetch(url, {
                signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]),
                credentials: "include",
              }),
              signal,
            );
          } catch (e) {
            signal.throwIfAborted();
            throw Error(
              (e as Error).message +
                " Open the source page and check that the image is accessible.",
            );
          }
        },
        archiveController.signal,
        (done, total) => {
          archiveStatus = "Preparing ZIP: " + done + " of " + total + " images";
          document.getElementById("progress")!.textContent = archiveStatus;
        },
      );
      archiveController.signal.throwIfAborted();
      archiveFailed = result.failed.map((f) => f.image);
      archiveURL = URL.createObjectURL(
        new Blob([result.bytes as BlobPart], { type: "application/zip" }),
      );
      const { filename } = await import("./core");
      archiveDownload = await api.downloads.download({
        url: archiveURL,
        filename: filename(
          "https://local/piclatch-images-" +
            new Date().toISOString().slice(0, 10) +
            ".zip",
          p.folder,
        ),
        conflictAction: "uniquify",
      });
      if (archiveController.signal.aborted) {
        await api.downloads.cancel(archiveDownload).catch(() => {});
        throw new DOMException("Cancelled", "AbortError");
      }
      archiveStatus =
        "ZIP download started: " +
        result.count +
        " images" +
        (result.failed.length
          ? " - " +
            result.failed.length +
            " failed. Use Retry failed to try again."
          : "");
      const [download] = await api.downloads.search({ id: archiveDownload });
      if (download?.state === "complete")
        archiveStatus =
          "ZIP saved." +
          (archiveFailed.length
            ? " " + archiveFailed.length + " images failed. Use Retry failed."
            : "");
      if (download?.state === "interrupted")
        throw Error(download.error || "ZIP download interrupted.");
      if (download?.state === "complete") {
        URL.revokeObjectURL(archiveURL);
        archiveURL = undefined;
        archiveDownload = undefined;
      }
      selection.clear();
      for (const failed of archiveFailed) selection.add(failed.url);
      render();
    } catch (e) {
      archiveStatus = archiveController.signal.aborted
        ? "ZIP cancelled."
        : (e as Error).message;
      status(archiveStatus, !archiveController.signal.aborted);
    } finally {
      archiveController = undefined;
      if (archiveDownload === undefined && archiveURL) {
        URL.revokeObjectURL(archiveURL);
        archiveURL = undefined;
      }
      counts();
      document.getElementById("progress")!.textContent = archiveStatus;
    }
  }
  api.downloads.onChanged.addListener((delta) => {
    if (delta.id !== archiveDownload || !delta.state) return;
    if (delta.state.current === "complete")
      archiveStatus =
        "ZIP saved." +
        (archiveFailed.length
          ? " " + archiveFailed.length + " images failed. Use Retry failed."
          : "");
    if (delta.state.current === "interrupted")
      archiveStatus =
        "ZIP download failed. " + (delta.error?.current || "Try again.");
    if (delta.state.current !== "in_progress") {
      if (archiveURL) URL.revokeObjectURL(archiveURL);
      archiveURL = undefined;
      archiveDownload = undefined;
      counts();
      document.getElementById("progress")!.textContent = archiveStatus;
    }
  });
  window.addEventListener("pagehide", () => {
    archiveController?.abort();
    if (archiveURL) URL.revokeObjectURL(archiveURL);
  });
  click("download", downloadSelected);
  click("cancel", async () => {
    archiveController?.abort();
    if (archiveDownload !== undefined)
      await api.downloads.cancel(archiveDownload).catch(() => {});
    await send({ type: "cancel", collection });
  });
  click("retry", () => {
    if (archiveFailed.length) {
      selection.clear();
      archiveFailed.forEach((i) => selection.add(i.url));
      render();
      return downloadSelected();
    }
    return send({ type: "retry", collection });
  });
  async function poll() {
    jobs = await send({ type: "jobs", collection });
    if (archiveStatus || archiveController) return;
    if (jobs.length) {
      const failed = jobs.filter((j) => j.state === "failed");
      document.getElementById("progress")!.textContent =
        `${jobs.filter((j) => j.state === "complete").length} saved · ${failed.length} failed · ${jobs.filter((j) => ["queued", "active", "starting"].includes(j.state)).length} remaining${failed[0]?.error ? " - " + failed[0].error : ""}`;
    }
  }
  await refresh().catch((e) => status(e.message, true));
  setInterval(() => {
    void poll().catch((e) => status(e.message, true));
  }, 1000);
} else {
  main.innerHTML = `<section class="hero"><h1>About &amp; privacy</h1><p>PicLatch - Image Downloader. Free forever, with all features included.</p><h2>Privacy</h2><p>We collect no browsing history, analytics, images or personal information. No accounts, advertising, proxy services or remote code. Your browser requests image files directly from their existing hosts. Those hosts can see ordinary image requests.</p><p>Preferences stay on this device. Download queue metadata lives only in browser session storage and is cleared when the browser session ends. Your browser keeps its own download history. Collections are temporary.</p><h2>Why these permissions?</h2><dl><dt>Downloads</dt><dd>Save original files and report completion or failure.</dd><dt>Storage</dt><dd>Keep your preferences and current session’s download queue.</dd><dt>Active tab & scripting</dt><dd>Find images and enable the save gesture on pages you choose.</dd><dt>Context menus</dt><dd>Add “Save image with PicLatch” to image right-click menus.</dd><dt>Optional website access</dt><dd>Enable saving automatically on selected websites or everywhere, only after you agree.</dd></dl><h2>Copyright &amp; responsible use</h2><p>You are responsible for ensuring that downloading, copying, storing, sharing or otherwise using an image is lawful. Only save and use content you own, have permission to use, or are otherwise legally entitled to use. Follow applicable copyright and intellectual property laws, licence conditions, attribution requirements, privacy rights and website terms.</p><p>Images remain the property of their respective rights holders. Availability online does not make an image free to reuse. PicLatch provides a downloading tool; it does not grant rights to images, verify permissions or authorise bypassing access restrictions. The extension’s GPL licence covers its software, not downloaded content.</p><p>To the extent permitted by applicable law, PicLatch is provided without warranty, and its contributors are not liable for unlawful use or infringement by users. Nothing in this notice excludes liability or statutory rights that cannot lawfully be excluded.</p><h2>Open source · GPL-3.0-only</h2><p>The complete source code, editable graphics and build instructions are included with PicLatch under GPL-3.0-only. Every feature is free.</p><p><a href="https://ko-fi.com/declane47" target="_blank" rel="noreferrer">Support development on Ko-fi</a></p></section>`;
}
