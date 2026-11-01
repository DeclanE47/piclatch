# Release checklist and store copy

Development is local. The publication steps below are a future checklist only. Do not recreate a GitHub repository, push code or publish packages until the owner requests it.

## Candidate brand and discoverability

Candidate title: **PicLatch - Image Downloader**. Short description: **Save images with Alt-click. Collect and bulk download original images. Free, open source, no accounts or tracking.**

Exact PicLatch searches across the web and indexed Chrome, Edge and Firefox listings returned no matches on 2026-11-01. Pluck was rejected because several extension listings already use it. Before committing a launch brand, search each store directly, GitHub, relevant trademark registers and desired domains/handles; record outcomes. Availability can change. Change brand strings, icons if needed, Firefox add-on ID and package metadata together before first signed release. The temporary Firefox ID is not a registered publisher identity.

Use plain language in title/description: image downloader, save images, Alt-click, original images and bulk download. Do not repeat keyword lists or claim guaranteed ranking. Show the actual gesture and collection grid in screenshots. No unsupported “works on every site” or “highest quality” claims.

## Mandatory external validation

- Five prospective users: at least four save a first image within 30 seconds of completing setup, then select and download several images without coaching. Record task completion, time, confusion and fixes. These trials have not been performed.
- Current Chrome, Edge, Firefox and Firefox ESR on Windows/macOS; check Linux modifier conflicts. Validate native permission accept/deny/revoke, optional-only install, persistent registration after restart/update, restricted pages, authenticated image hosts, context-menu saving and blob expiration.
- Keyboard-only use, screen readers, 200% zoom, contrast, reduced motion. Review collection layouts with hundreds of images and long filenames.
- Cancellation, failed retry, duplicate clicks, source/collection tab closure, interrupted background startup, browser Save As preference and interrupted downloads. Confirm original byte hashes for animated GIF/WebP/SVG as well as PNG.
- Review dependencies, message validation, all requests and manifests. Repeatability check from clean `npm ci` build. No external tracking/code requests permitted.

## Publication

1. Create the public GPL repository and configure its real URLs in About/README. Enable private security reporting, choose a publisher identity and optional donation recipient. Host privacy policy at a stable public URL.
2. Freeze tested source, commit and tag the release version; attach unsigned packages, source and SHA256SUMS. Do not tag a release as validated until outstanding checks pass.
3. Prepare Chrome Web Store, Edge Add-ons and Firefox AMO accounts. Verify each store's current metadata, fees, identity and image-size requirements at submission time.
4. Capture genuine store screenshots and a short demo from the release build. Supply source and exact build instructions to Mozilla. Explain every permission and declare no collection consistently across stores.
5. Submit packages, address reviewer findings, and publish only accepted versions linked to matching source tags. Store acceptance is external and is not completed by this local build.
6. Add real store/share links to About without interrupting downloads. Monitor public issues and opt-in feedback; no analytics are necessary. Publish changes and compatibility checks in release notes.

## Listing body draft

Hold Alt (Option on Mac) and click an image to download it. PicLatch saves the original file directly to your browser downloads.

Collect images from the current page. Download one image directly or multiple selected images in a ZIP archive. Filter by width, refresh after scrolling, pause saving or disable it on individual websites.

Every feature is free. No account, ads or tracking. Full source is available under GPL-3.0-only. Website access is optional and under your control. Some protected pages and image sources cannot be accessed; PicLatch does not bypass site restrictions.
