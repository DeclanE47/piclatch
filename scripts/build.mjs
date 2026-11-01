import "./notices.mjs";
import { resolve, sep } from "node:path";
import { build } from "vite";
import { mkdir, writeFile, cp, readFile, rm } from "node:fs/promises";
import sharp from "sharp";
const manifest = {
  manifest_version: 3,
  name: "PicLatch - Image Downloader",
  version: "0.2.0",
  description:
    "Save images with Alt-click. Collect and bulk download original images. Free, open source, no accounts or tracking.",
  permissions: [
    "activeTab",
    "downloads",
    "storage",
    "scripting",
    "contextMenus",
  ],
  optional_host_permissions: ["http://*/*", "https://*/*"],
  action: {
    default_popup: "popup.html",
    default_title: "PicLatch - Image Downloader",
  },
  icons: Object.fromEntries(
    [16, 32, 48, 128].map((s) => [s, `icons/icon${s}.png`]),
  ),
};
await mkdir("public/icons", { recursive: true });
const svg = await readFile("assets/icon.svg");
for (const size of [16, 32, 48, 128])
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(`public/icons/icon${size}.png`);
for (const page of ["popup", "onboarding", "collection", "about"])
  await writeFile(
    `${page}.html`,
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>PicLatch - ${page}</title></head><body><div id="app"></div><script type="module" src="/src/ui.ts"></script></body></html>`,
  );
await build({
  build: {
    outDir: "dist/ui",
    minify: false,
    rollupOptions: {
      input: ["popup.html", "onboarding.html", "collection.html", "about.html"],
    },
  },
});
for (const browser of ["chromium", "firefox"]) {
  const dest = `dist/${browser}`;
  const absolute = resolve(dest);
  if (!absolute.startsWith(resolve("dist") + sep))
    throw Error("Unsafe build output");
  await rm(absolute, { recursive: true, force: true });
  await mkdir(dest, { recursive: true });
  await cp("dist/ui", dest, { recursive: true });
  for (const file of ["LICENSE", "PRIVACY.md", "THIRD-PARTY-NOTICES.md"])
    await cp(file, dest + "/" + file);
  for (const entry of ["content", "background"])
    await build({
      publicDir: false,
      build: {
        outDir: dest,
        emptyOutDir: false,
        minify: false,
        target: "es2022",
        lib: {
          entry: `src/${entry}.ts`,
          name: "PicLatch",
          formats: ["iife"],
          fileName: () => `${entry}.js`,
        },
      },
    });
  const m = {
    ...manifest,
    background:
      browser === "firefox"
        ? { scripts: ["background.js"] }
        : { service_worker: "background.js" },
  };
  if (browser === "firefox")
    m.browser_specific_settings = {
      gecko_android: { strict_min_version: "142.0" },
      gecko: {
        id: "piclatch@declane47.github.io",
        strict_min_version: "140.0",
        data_collection_permissions: { required: ["none"] },
      },
    };
  else m.minimum_chrome_version = "120";
  await writeFile(`${dest}/manifest.json`, JSON.stringify(m, null, 2));
}
