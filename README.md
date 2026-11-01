# PicLatch — Image Downloader

**See it. Save it.** An original, GPL-3.0-only image saver for Chrome, Edge and Firefox. All features are free. No accounts, advertising, analytics or remote code.

## Try the beta

Build with `npm ci` then `npm run build` using Node 22.12+ (Node 26.4 used for this beta). Chrome/Edge: open `chrome://extensions` / `edge://extensions`, enable Developer mode, choose **Load unpacked**, select `dist/chromium`. Firefox: open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, select `dist/firefox/manifest.json`. Firefox installation lasts until restart; permanent installation requires Mozilla signing.

Pin the toolbar icon. On first use, enable everywhere or choose sites as you go. For temporary access, open a website and choose **Enable on this page**. For persistent access, choose **Always on this site** and reload the page after approval. Alt-click an image (Option-click on Mac); use the right-click image menu as an alternative. Pause or exclude a site through the popup. Browser download prompts and destination settings are respected.

**Collect images** opens a temporary tab. Select images, filter by minimum width, and download originals through a three-file queue. Scroll the source page and refresh for newly loaded images. Cancel stops queued/current jobs; completed files remain. Retry applies to failed jobs. Closing the collection abandons queued items but lets active browser downloads finish.

## Build and inspect

`npm test` runs URL, filename and deduplication checks. `npx playwright install chromium` then `npm run test:browser` exercises the built extension against local fixtures in an isolated browser profile. This test grants localhost host access in a temporary copy; production packages retain optional-only access. Native permission approval must also be tested manually. `npm run package` creates Chromium, Firefox and source ZIPs plus SHA-256 checksums in `artifacts/`.

Vite bundles readable (unminified) executable code with no runtime CDN dependencies. `package-lock.json` pins the dependency graph. ZIP entry dates and ordering are fixed for reproducible packaging; compare unsigned packages on the same supported Node/platform toolchain. Browser signing changes the final store package.

## Image handling

Blob sources must still exist in the source page and are limited to 20 MB. No server bypass, speculative full-resolution URL rewriting, file conversion, persistent library, ZIP export or automatic scrolling. Collection thumbnails may require host cookies/referrers and can fail independently of downloads. Image files and SVGs are never executed by the extension.

Download state lives in session storage to survive background suspension, not browser shutdown. Interrupted startup is shown as failed rather than automatically duplicating a possibly started download. Source-page closure can invalidate blob URLs. Exact source URLs are deduplicated; visually identical files at different URLs remain separate.

## Development

See `docs/RELEASE.md` for naming, human testing, cross-browser validation and store submission gates. PicLatch is a candidate name: exact web/store-index searches returned no matching results on 2026-11-01; this is not trademark clearance or a reservation. Do not publish under the previously proposed Pluck name, which has existing extension conflicts.

The complete source code, editable graphics, fonts and build instructions are included in this folder. Review or modify the code locally under GPL-3.0-only.

## Licence

Original code and graphics: GPL-3.0-only, see LICENSE. Manrope: SIL Open Font License, bundled in `public/fonts/OFL.txt`. Dependency licences are in their installed packages and the generated third-party notice. The original downloaded extension was not copied into this project.
