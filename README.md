# PicLatch - Image Downloader

Save an image with Alt-click, or select several images from a page and download them in a ZIP. PicLatch keeps the original files. It is free, open source and built for Chrome, Edge and Firefox.

Version 0.1.0 was submitted to all three stores on 1 November 2026 and is awaiting review. [Download the release packages and source](https://github.com/DeclanE47/piclatch/releases/tag/v0.1.0), or see the [submission details](docs/SUBMISSIONS.md).

## Using PicLatch

- Hold Alt (Option on Mac) and click an image to save it. You can change the shortcut in Settings.
- Open the toolbar popup and choose **Collect images** to select images from the current page. One selected image downloads directly; multiple images download as one ZIP.
- Filter by width, or scroll the source page and refresh to find newly loaded images.
- Pause saving or disable it on a particular website from the popup.
- Choose whether to enable website access everywhere or on selected sites.

ZIPs are created on your device. If some images fail, PicLatch reports the failed count and lets you retry. Limits per ZIP: 2,000 images, 50 MB per image and 250 MB of source files. Keep the collection tab open until the ZIP finishes downloading.

## Website not working?

[Open an issue](https://github.com/DeclanE47/piclatch/issues/new). Include the website, browser, PicLatch version and what went wrong. The version is shown on **About & privacy**. Leave out private links, passwords and personal information.

If you can fix it, pull requests are welcome. Otherwise, I'll look into it when I can.

## Build from source

Use Node 22.12 or later. The release was built with Node 26.4.

```sh
npm ci
npm run build
npm test
npx playwright install chromium
npm run test:browser
npm run package
```

Chrome and Edge: enable Developer mode in the extensions page, choose **Load unpacked** and select **dist/chromium**. Firefox: open **about:debugging**, choose **Load Temporary Add-on** and select **dist/firefox/manifest.json**. A permanent Firefox installation requires Mozilla signing.

Packages, source archives and SHA-256 checksums are written to **artifacts/**. Builds use the locked dependencies and bundle all executable code locally. The browser test runs the built extension in a temporary Chromium profile with a localhost-only host grant. It checks downloads, ZIP contents, permissions UI, retries and cancellation.

## Privacy

No accounts, advertising or analytics. Image requests go directly to their existing hosts. Preferences stay on your device. See [PRIVACY.md](PRIVACY.md) for details and permission explanations.

## Licence and support

Code and original graphics: GPL-3.0-only. Manrope uses the SIL Open Font License. Third-party licences are included in **THIRD-PARTY-NOTICES.md**.

[Support development on Ko-fi](https://ko-fi.com/declane47). All features remain free.
