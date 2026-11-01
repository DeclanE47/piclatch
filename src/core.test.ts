import { beforeAll, describe, it, expect } from "vitest";
let core: typeof import("./core");
beforeAll(async () => {
  (globalThis as any).chrome = {};
  core = await import("./core");
});
describe("image safety and filenames", () => {
  it("rejects executable and local sources", () => {
    for (const u of [
      "javascript:alert(1)",
      "file:///private",
      "data:text/html;base64,abc",
      "chrome://settings",
    ])
      expect(core.safeURL(u)).toBe(false);
  });
  it("accepts supported original image sources", () => {
    for (const u of [
      "https://example.org/a.gif",
      "blob:https://example.org/id",
      "data:image/png;base64,YQ==",
    ])
      expect(core.safeURL(u)).toBe(true);
  });
  it("sanitises path traversal, control characters and Windows device names", () => {
    expect(core.filename("https://a.org/CON.png", "../refs/../../2026")).toBe(
      "refs/2026/_CON.png",
    );
    expect(core.filename("https://a.org/a%2Fb%00.png")).toBe("a_b_.png");
  });
  it("preserves original extension and strips query strings", () => {
    expect(core.filename("https://a.org/original.gif?token=secret")).toBe(
      "original.gif",
    );
  });
  it("deduplicates exact sources without merging distinct signed URLs", () => {
    const make = (url: string) => ({
      url,
      name: "test",
      width: 1,
      height: 1,
      format: "GIF",
    });
    expect(
      core.dedupe([
        make("https://a.org/x?t=1"),
        make("https://a.org/x?t=1"),
        make("https://a.org/x?t=2"),
      ]),
    ).toHaveLength(2);
  });
});
