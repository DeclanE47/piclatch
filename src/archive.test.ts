import { beforeAll, it, expect } from "vitest";
import { unzipSync } from "fflate";
let archive: typeof import("./archive");
beforeAll(async () => {
  (globalThis as any).chrome = {};
  archive = await import("./archive");
});
const image = (url: string) => ({
  url,
  name: "Image",
  width: 10,
  height: 10,
  format: "PNG",
});
it("creates a ZIP preserving bytes and resolving duplicate filenames", async () => {
  const data = new Uint8Array([0, 1, 2, 255]);
  const result = await archive.buildArchive(
    [image("https://a/a.png"), image("https://b/a.png")],
    async () => ({ bytes: data, mime: "image/png" }),
    new AbortController().signal,
    () => {},
  );
  const entries = unzipSync(result.bytes);
  expect(Object.keys(entries)).toEqual(["a.png", "a (2).png"]);
  expect(entries["a.png"]).toEqual(data);
});
it("reports failed images without silently putting errors inside the ZIP", async () => {
  const result = await archive.buildArchive(
    [image("https://a/a.png"), image("https://a/b.png")],
    async (i) => {
      if (i.url.endsWith("b.png")) throw Error("Blocked");
      return { bytes: new Uint8Array([1]), mime: "image/png" };
    },
    new AbortController().signal,
    () => {},
  );
  expect(result.count).toBe(1);
  expect(result.failed[0].error).toBe("Blocked");
});
it("cancels an archive before writing a download", async () => {
  const c = new AbortController();
  c.abort();
  await expect(
    archive.buildArchive(
      [image("https://a/a.png")],
      async () => ({ bytes: new Uint8Array(), mime: "image/png" }),
      c.signal,
      () => {},
    ),
  ).rejects.toThrow();
});
it("rejects HTML responses masquerading as images", async () => {
  await expect(
    archive.imageBytes(
      new Response("<html>", { headers: { "content-type": "text/html" } }),
      new AbortController().signal,
    ),
  ).rejects.toThrow("did not return an image");
});
