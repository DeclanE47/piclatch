import { api, prefs, safeURL, dedupe, type ImageItem } from "./core";
void (async () => {
  if (!(globalThis as any).__pluck) {
    (globalThis as any).__pluck = true;
    let preferences = await prefs();
    api.storage.onChanged.addListener((c) => {
      if (c.preferences)
        preferences = c.preferences.newValue as typeof preferences;
    });
    function item(url: string, width = 0, height = 0): ImageItem {
      let name = "Image",
        format = "IMAGE";
      try {
        const u = new URL(url);
        name = decodeURIComponent(u.pathname.split("/").pop() || "Image");
        format =
          u.protocol === "data:"
            ? u.pathname.split(";")[0].split("/")[1]
            : name.split(".").pop() || "IMAGE";
      } catch {}
      return {
        url,
        name: name.slice(0, 150),
        width,
        height,
        format: format.slice(0, 8).toUpperCase(),
      };
    }
    function image(el: Element): ImageItem[] {
      if (el instanceof HTMLImageElement) {
        const candidates = [
          { url: el.currentSrc || el.src, size: el.naturalWidth },
          ...Array.from(
            el.parentElement?.tagName === "PICTURE"
              ? el.parentElement.querySelectorAll("source")
              : [],
          )
            .filter((s) => !s.media || matchMedia(s.media).matches)
            .flatMap((s) => parse(s.srcset)),
          ...parse(el.srcset),
        ];
        const best = candidates.sort((a, b) => b.size - a.size)[0];
        return best?.url
          ? [item(best.url, el.naturalWidth, el.naturalHeight)]
          : [];
      }
      const bg = getComputedStyle(el).backgroundImage;
      return [...bg.matchAll(/url\(["']?(.*?)["']?\)/g)].map((m) =>
        item(
          new URL(m[1], location.href).href,
          el.clientWidth,
          el.clientHeight,
        ),
      );
    }
    function parse(srcset: string) {
      if (srcset.startsWith("data:")) return [];
      return srcset.split(",").flatMap((s) => {
        const [url, size] = s.trim().split(/\s+/);
        try {
          return [
            {
              url: new URL(url, location.href).href,
              size: parseFloat(size) || 0,
            },
          ];
        } catch {
          return [];
        }
      });
    }
    function at(target: EventTarget | null) {
      let el = target instanceof Element ? target : null;
      while (el && el !== document.documentElement) {
        const list = image(el);
        if (list.length) return list[0];
        el = el.parentElement;
      }
      return undefined;
    }
    function notify(url: string, ok: boolean, error?: string) {
      document.getElementById("pluck-feedback")?.remove();
      const host = document.createElement("div");
      host.id = "pluck-feedback";
      const shadow = host.attachShadow({ mode: "closed" });
      const box = document.createElement("div");
      box.setAttribute("role", ok ? "status" : "alert");
      box.style.cssText =
        "font:14px system-ui;color:#171717;background:#F7F4EB;border:2px solid #171717;box-shadow:4px 4px 0 #FFE500;padding:12px;display:flex;align-items:center;gap:12px;max-width:340px";
      const img = document.createElement("img");
      img.src = url;
      img.alt = "";
      img.style.cssText = "width:44px;height:44px;object-fit:cover";
      const text = document.createElement("span");
      text.textContent = ok
        ? "Saved. Nice find."
        : error || "Could not save this image.";
      box.append(img, text);
      if (!ok) {
        const retry = document.createElement("button");
        retry.textContent = "Retry";
        retry.onclick = () => {
          void api.runtime.sendMessage({ type: "save", images: [item(url)] });
          host.remove();
        };
        box.append(retry);
      }
      shadow.append(box);
      host.style.cssText =
        "position:fixed;bottom:24px;right:24px;z-index:2147483647";
      document.documentElement.append(host);
      setTimeout(() => host.remove(), ok ? 3500 : 12000);
    }
    document.addEventListener(
      "click",
      (e) => {
        if (
          preferences.paused ||
          preferences.excluded.includes(location.hostname) ||
          !e.isTrusted
        )
          return;
        const enabled =
          preferences.modifier === "alt"
            ? e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey
            : preferences.modifier === "shift"
              ? e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey
              : e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey;
        if (!enabled || e.button !== 0) return;
        const found = at(e.composedPath()[0]);
        if (!found || !safeURL(found.url)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        void api.runtime
          .sendMessage({ type: "save", images: [found] })
          .then((r) => {
            if (r?.error) notify(found.url, false, r.error);
          })
          .catch((err) => notify(found.url, false, String(err)));
      },
      true,
    );
    api.runtime.onMessage.addListener((m, _sender, reply) => {
      if (m.type === "scan") {
        const items: ImageItem[] = [];
        for (const el of document.querySelectorAll("img,body *")) {
          items.push(...image(el));
        }
        reply(dedupe(items));
        return;
      }
      if (m.type === "feedback") {
        notify(m.url, m.ok, m.error);
        return;
      }
      if (m.type === "prepare") {
        (async () => {
          if (!safeURL(m.url)) throw Error("Unsupported image source.");
          if (!m.url.startsWith("blob:")) return { url: m.url };
          const response = await fetch(m.url);
          const blob = await response.blob();
          if (!blob.type.startsWith("image/") || blob.size > 20 * 1024 * 1024)
            throw Error(
              "This page-bound image is unavailable or exceeds 20 MB.",
            );
          return {
            url: await new Promise<string>((resolve, reject) => {
              const r = new FileReader();
              r.onload = () => resolve(String(r.result));
              r.onerror = reject;
              r.readAsDataURL(blob);
            }),
          };
        })().then(reply, (e) =>
          reply({
            error:
              "The page-bound image expired or could not be read. " + e.message,
          }),
        );
        return true;
      }
    });
  }
})();
