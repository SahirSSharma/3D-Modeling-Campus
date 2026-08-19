// The download-size manifest: docs/data/manifest.json, filename → bytes for
// every top-level file in docs/data/.
//
// It exists because the loading bar's denominator cannot come from the wire:
// GitHub Pages serves the JSON gzipped, so Content-Length is the COMPRESSED
// size while the stream the browser reads (and the bar counts) is not —
// campus-lidar.json advertises ~1.0 MB and delivers 4.05 MB. The true sizes
// are knowable at build time, so they ship as data instead of being guessed.
//
//   node scripts/build-manifest.mjs           rebuild docs/data/manifest.json
//   node scripts/build-manifest.mjs --check   fail if it is stale
import { readdirSync, statSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIR = path.join(ROOT, "docs/data");
const OUT = path.join(DIR, "manifest.json");

const sizes = {};
for (const name of readdirSync(DIR).sort()) {
  if (name === "manifest.json") continue; // cannot honestly contain itself
  const st = statSync(path.join(DIR, name));
  if (st.isFile()) sizes[name] = st.size;
}
const text = JSON.stringify(sizes, null, 2) + "\n";

if (process.argv.includes("--check")) {
  let current = null;
  try { current = readFileSync(OUT, "utf8"); } catch {}
  if (current !== text) {
    console.error("manifest.json is stale — a data file changed size. Run: node scripts/build-manifest.mjs");
    process.exit(1);
  }
  console.log(`manifest ok — ${Object.keys(sizes).length} files`);
} else {
  writeFileSync(OUT, text);
  console.log(`wrote docs/data/manifest.json — ${Object.keys(sizes).length} files`);
}
