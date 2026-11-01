import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { zipSync, strToU8 } from "fflate";
import { createHash } from "node:crypto";
await mkdir("artifacts", { recursive: true });
async function tree(dir, skip = []) {
  const result = {};
  for (const d of (await readdir(dir, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    if (skip.includes(d.name)) continue;
    const p = dir + "/" + d.name;
    if (d.isDirectory()) {
      const sub = await tree(p, skip);
      for (const [k, v] of Object.entries(sub)) result[d.name + "/" + k] = v;
    } else
      result[d.name] = [
        new Uint8Array(await readFile(p)),
        { mtime: new Date("2026-01-01T00:00:00Z") },
      ];
  }
  return result;
}
const { version } = JSON.parse(await readFile("package.json", "utf8"));
const checks = [];
for (const target of ["chromium", "firefox", "source"]) {
  const files = await tree(target === "source" ? "." : `dist/${target}`, [
    "node_modules",
    "dist",
    "artifacts",
    ".git",
    "test-results",
  ]);
  const zip = zipSync(files, { level: 9 });
  const name = `piclatch-${version}-${target}.zip`;
  await writeFile("artifacts/" + name, zip);
  checks.push(createHash("sha256").update(zip).digest("hex") + "  " + name);
}
await writeFile("artifacts/SHA256SUMS.txt", checks.join("\n") + "\n");
