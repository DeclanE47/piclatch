# Beta validation - 1 November 2026

- TypeScript check and production builds: passed.
- Five unit tests: passed (URL schemes, filenames, traversal/device names, source deduplication).
- Chromium integration in a temporary profile: passed. Responsive/background/blob discovery, exact source deduplication, bulk queue, Alt-click and completion feedback, original file SHA-256, pause, normal links, failed download/retry, cancellation of eight slow jobs, onboarding/popup/About rendering; no page JavaScript errors.
- Firefox web-ext validation: zero errors and zero warnings. This is static validation, not a Firefox runtime test.
- npm audit: zero known vulnerabilities in the installed dependency graph.
- Website permissions are optional in production. Integration tests use a localhost-only test grant; native permission acceptance/denial/revocation remain manual release checks.
- Five-person usability trial, Windows/macOS browser matrix, Linux modifier conflicts, full assistive-technology checks, store submissions, formal naming clearance and Mozilla signing remain open.

Development is local. Validation results above describe completed automated checks; outstanding human and browser checks remain listed separately.

## 0.1.1 update

Removed popup tagline. Permission controls now hide when a site/all-sites grant covers the current page and refresh on permission changes. About & privacy includes copyright/responsible-use terms. Chromium regression checks cover site, all-site and missing-access UI states (all/no-access states simulated in the test harness); Firefox validation remains zero errors/warnings.

## 0.2.0 update

Practical UI labels throughout; removed marketing slogans and beta badge. Product copy uses hyphens instead of em dashes. Multi-selection now creates one ZIP locally, preserving original bytes. ZIP fetches are limited to three concurrent requests with per-image and total memory limits, cancellation, failure counts and retry. Nine unit tests pass. Chromium integration verifies all four ZIP entries against original bytes, partial ZIP failure reporting and cancellation without an archive download. Native image-host permission prompts and full Firefox/Edge runtime validation remain release checks. Ko-fi support link is https://ko-fi.com/declane47. Development remains local.
