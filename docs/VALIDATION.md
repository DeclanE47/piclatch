# Beta validation — 1 November 2026

- TypeScript check and production builds: passed.
- Five unit tests: passed (URL schemes, filenames, traversal/device names, source deduplication).
- Chromium integration in a temporary profile: passed. Responsive/background/blob discovery, exact source deduplication, bulk queue, Alt-click and completion feedback, original file SHA-256, pause, normal links, failed download/retry, cancellation of eight slow jobs, onboarding/popup/About rendering; no page JavaScript errors.
- Firefox web-ext validation: zero errors and zero warnings. This is static validation, not a Firefox runtime test.
- npm audit: zero known vulnerabilities in the installed dependency graph.
- Website permissions are optional in production. Integration tests use a localhost-only test grant; native permission acceptance/denial/revocation remain manual release checks.
- Five-person usability trial, Windows/macOS browser matrix, Linux modifier conflicts, full assistive-technology checks, store submissions, formal naming clearance and Mozilla signing remain open.

The repository is public at https://github.com/DeclanE47/piclatch. The prerelease is for evaluation; it is not a claim of store approval or completed user research.
