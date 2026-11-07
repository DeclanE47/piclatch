# Testing

From the repository root:

```sh
npm ci
npm run build
npm test
npx playwright install chromium
npm run test:browser
```

The unit tests cover URL validation, filename handling and ZIP creation. The browser tests load the extension in a temporary Chromium profile and check image downloads, original file bytes, ZIP contents, retries, cancellation, pause and permission-dependent controls. Fixtures are served from localhost.

The automated browser tests use a temporary website permission grant. They do not cover the browser's native permission prompts or Firefox runtime behaviour.

For changes to permissions or browser integration, also check the affected behaviour manually in Chrome, Edge and Firefox. For interface changes, check keyboard navigation, visible focus, 200% zoom and reduced motion.
