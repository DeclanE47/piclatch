import { chromium } from "playwright";
import { createServer } from "node:http";
import { mkdtemp, readFile, writeFile, mkdir, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import assert from "node:assert/strict";
import sharp from "sharp";
import { createHash } from "node:crypto";
await mkdir("test-results", { recursive: true });
const pixel = await sharp(
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="560"><rect width="800" height="560" fill="#FFE500"/><circle cx="665" cy="120" r="170" fill="#171717"/><path d="M70 400L260 185l190 215z" fill="#171717"/><text x="65" y="490" fill="#171717" font-family="sans-serif" font-size="68" font-weight="bold">A GOOD FIND.</text></svg>',
  ),
)
  .png()
  .toBuffer();
let block = true;
const server = createServer((req, res) => {
  if (req.url.startsWith("/slow")) {
    setTimeout(() => {
      res.setHeader("Content-Type", "image/png");
      res.end(pixel);
    }, 2000);
  } else if (req.url.startsWith("/image")) {
    res.setHeader("Content-Type", "image/png");
    res.end(pixel);
  } else if (req.url === "/broken.png") {
    if (block) {
      res.statusCode = 403;
      res.end("Blocked");
    } else {
      res.setHeader("Content-Type", "image/png");
      res.end(pixel);
    }
  } else {
    res.setHeader("Content-Type", "text/html");
    res.end(
      `<h1>Image fixtures</h1><img id="one" width="120" height="120" src="/image.png"><img src="/image.png"><picture><source srcset="/image-large.png 2000w"><img src="/image-small.png" width="80" height="80"></picture><div style="width:100px;height:100px;background:url('/image-bg.png')"></div><a id="normal" href="#unchanged">Normal link</a><script>const blob=new Blob([Uint8Array.from(atob('${pixel.toString("base64")}'),c=>c.charCodeAt(0))],{type:'image/png'});const img=new Image();img.id='blob';img.src=URL.createObjectURL(blob);document.body.append(img);</script>`,
    );
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const origin = `http://127.0.0.1:${port}`;
const temp = await mkdtemp(join(tmpdir(), "piclatch-test-"));
const extension = join(temp, "extension");
await cp("dist/chromium", extension, { recursive: true });
// Test-only host grant avoids automating browser-native permission approval. Production manifest stays optional-only.
const manifest = JSON.parse(await readFile(join(extension, "manifest.json")));
manifest.host_permissions = [origin + "/*"];
await writeFile(join(extension, "manifest.json"), JSON.stringify(manifest));
const context = await chromium.launchPersistentContext(join(temp, "profile"), {
  channel: "chromium",
  headless: true,
  args: [
    `--disable-extensions-except=${extension}`,
    `--load-extension=${extension}`,
  ],
  acceptDownloads: true,
  viewport: { width: 1280, height: 900 },
});
const errors = [];
context.on("page", (p) => p.on("pageerror", (e) => errors.push(e.message)));
try {
  let worker =
    context.serviceWorkers()[0] ||
    (await context.waitForEvent("serviceworker"));
  const id = new URL(worker.url()).host;
  const ext = `chrome-extension://${id}/`;
  const page = await context.newPage();
  await page.goto(origin);
  await page.waitForLoadState("networkidle");
  const tabId = await worker.evaluate(
    async (origin) =>
      (await chrome.tabs.query({})).find((t) => t.url?.startsWith(origin)).id,
    origin,
  );
  const ui = await context.newPage();
  await ui.goto(ext + "collection.html?tab=" + tabId);
  await ui.locator(".image-card").first().waitFor();
  assert.equal(await ui.locator(".image-card").count(), 4);
  await ui.screenshot({ path: "test-results/collection.png", fullPage: true });
  await ui.getByRole("button", { name: "Select visible" }).click();
  await ui.getByRole("button", { name: "Download selected" }).click();
  await ui.waitForFunction(() =>
    document.querySelector("#progress").textContent.includes("4 saved"),
  );
  assert.equal(
    (await worker.evaluate(() => chrome.downloads.search({}))).length,
    4,
  );
  const prior = (await worker.evaluate(() => chrome.downloads.search({})))
    .length;
  await page.locator("#one").click({ modifiers: ["Alt"] });
  for (let i = 0; i < 60; i++) {
    const ds = await worker.evaluate(() => chrome.downloads.search({}));
    if (
      ds.length > prior &&
      ds.sort((a, b) => b.id - a.id)[0].state === "complete"
    )
      break;
    await page.waitForTimeout(100);
  }
  const ds = await worker.evaluate(() => chrome.downloads.search({}));
  assert.equal(ds.length, prior + 1);
  const saved = ds.sort((a, b) => b.id - a.id)[0];
  assert.equal(saved.state, "complete");
  assert.equal(
    createHash("sha256")
      .update(await readFile(saved.filename))
      .digest("hex"),
    createHash("sha256").update(pixel).digest("hex"),
  );
  await page.locator("#pluck-feedback").waitFor();
  await page.screenshot({ path: "test-results/success.png" });
  await worker.evaluate(async () => {
    const p = (await chrome.storage.local.get("preferences")).preferences;
    await chrome.storage.local.set({ preferences: { ...p, paused: true } });
  });
  await page.waitForTimeout(100);
  const count = (await worker.evaluate(() => chrome.downloads.search({})))
    .length;
  await page.locator("#one").click({ modifiers: ["Alt"] });
  await page.waitForTimeout(200);
  assert.equal(
    (await worker.evaluate(() => chrome.downloads.search({}))).length,
    count,
  );
  await page.locator("#normal").click();
  assert.ok(page.url().endsWith("#unchanged"));
  await worker.evaluate(async () => {
    const p = (await chrome.storage.local.get("preferences")).preferences;
    await chrome.storage.local.set({ preferences: { ...p, paused: false } });
  });
  const collectionId = await ui.evaluate(() =>
    chrome.tabs.getCurrent().then((t) => t.id),
  );
  await ui.evaluate(
    async ({ origin, tabId, collection }) =>
      chrome.runtime.sendMessage({
        type: "save",
        tabId,
        collection,
        images: [
          {
            url: origin + "/broken.png",
            name: "broken",
            width: 1,
            height: 1,
            format: "PNG",
          },
        ],
      }),
    { origin, tabId, collection: collectionId },
  );
  async function waitJobs(predicate) {
    for (let n = 0; n < 100; n++) {
      const jobs = await ui.evaluate(
        (collection) =>
          chrome.runtime.sendMessage({ type: "jobs", collection }),
        collectionId,
      );
      if (predicate(jobs)) return jobs;
      await ui.waitForTimeout(100);
    }
    throw Error("Queue did not reach expected state");
  }
  await waitJobs((j) => j.some((x) => x.state === "failed"));
  await ui.screenshot({ path: "test-results/failure.png", fullPage: true });
  block = false;
  await ui.getByRole("button", { name: "Retry failed" }).click();
  await waitJobs((j) => j.every((x) => x.state === "complete"));
  await ui.evaluate(
    async ({ origin, tabId, collection }) =>
      chrome.runtime.sendMessage({
        type: "save",
        tabId,
        collection,
        images: Array.from({ length: 8 }, (_, n) => ({
          url: origin + "/slow" + n + ".png",
          name: "slow",
          width: 1,
          height: 1,
          format: "PNG",
        })),
      }),
    { origin, tabId, collection: collectionId },
  );
  await ui.getByRole("button", { name: "Cancel queue" }).click();
  const cancelled = await waitJobs(
    (j) =>
      j.filter((x) => x.image.url.includes("/slow") && x.state === "cancelled")
        .length === 8,
  );
  assert.equal(
    cancelled.filter(
      (j) =>
        j.image.url.includes("/slow") &&
        ["active", "queued", "starting"].includes(j.state),
    ).length,
    0,
  );
  await ui.goto(ext + "onboarding.html");
  await ui.screenshot({ path: "test-results/onboarding.png", fullPage: true });
  await ui.goto(ext + "about.html");
  await ui.screenshot({ path: "test-results/about.png", fullPage: true });
  await ui.goto(ext + "popup.html");
  await ui.locator("#pause").waitFor();
  await ui.screenshot({ path: "test-results/popup.png" });
  assert.deepEqual(errors, []);
  await writeFile(
    "test-results/browser.json",
    JSON.stringify(
      {
        passed: true,
        scenarios: [
          "discovery: responsive/background/blob/deduplication",
          "bulk queue: 4 original files",
          "Alt-click and completion feedback",
          "download byte integrity",
          "pause",
          "normal links",
          "403 failure and successful retry",
          "cancel queued and active downloads",
          "onboarding/popup/about rendering",
        ],
        pageErrors: errors,
      },
      null,
      2,
    ),
  );
  console.log("Browser integration passed. Screenshots: test-results/");
} finally {
  await context.close();
  server.close();
  await rm(temp, { recursive: true, force: true });
}
