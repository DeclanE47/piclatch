import { readdir, readFile, writeFile } from "node:fs/promises";
let text =
  "# Third-party notices\n\nManrope font: SIL OFL-1.1; full licence in fonts/OFL.txt.\nBuild/test tools below are not shipped as executable runtime dependencies.\n\n";
async function visit(root) {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const path = root + "/" + entry.name;
    if (entry.name.startsWith("@")) {
      await visit(path);
      continue;
    }
    try {
      const pkg = JSON.parse(await readFile(path + "/package.json", "utf8"));
      text += `## ${pkg.name} ${pkg.version}\n\nLicence: ${typeof pkg.license === "string" ? pkg.license : JSON.stringify(pkg.license) || "See upstream licence"}\n\n`;
      for (const f of await readdir(path)) {
        if (/^(licen[cs]e|copying|notice)(\.|$)/i.test(f)) {
          try {
            text +=
              "```text\n" +
              (await readFile(path + "/" + f, "utf8")) +
              "\n```\n\n";
          } catch {}
        }
      }
    } catch {}
  }
}
await visit("node_modules");
await writeFile("THIRD-PARTY-NOTICES.md", text);
