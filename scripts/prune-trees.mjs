#!/usr/bin/env node
// Prune the 2014 tree list against TODAY's campus, in place.
//
// Two passes, both idempotent:
//   1. ZONES  (scripts/lib/tree-rules.mjs): no trunk inside a current building
//      footprint, on a sports pad, or in a fountain — and heights/crowns
//      clamped to believable maxima.
//   2. IMAGERY: a tree the 2026 satellite chunks show no vegetation under is a
//      2014 ghost — felled for a quad, a court resurfacing, a parking change —
//      wherever it stands. Sampled as a small disc around the trunk; the drop
//      threshold is deliberately conservative (a shadowed crown must survive).
//
// Run after any lidar rebuild: node scripts/prune-trees.mjs
// (build-campus-lidar.mjs applies pass 1 itself; this applies both.)
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";
import { treeExclusionZones, pruneTrees } from "./lib/tree-rules.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "docs", "data");
const load = (f) => {
  try { return JSON.parse(readFileSync(path.join(DATA, f))); } catch { return null; }
};

const lidar = load("campus-lidar.json");
if (!lidar?.trees) { console.error("no campus-lidar.json trees"); process.exit(1); }
const before = lidar.trees.length;

/* ---- pass 1: zones + realism caps ---- */
const zones = treeExclusionZones({
  campus3d: load("campus-3d.json"),
  arcgis: load("campus-arcgis.json"),
  markings: load("campus-markings.json"),
});
const { kept, dropped } = pruneTrees(lidar.trees, zones);
const byKind = {};
for (const d of dropped) byKind[d.kind] = (byKind[d.kind] || 0) + 1;

/* ---- pass 2: vegetation check against the georeferenced 2026 chunks ---- */
const manifest = load("textures/manifest.json");
const ghosts = [];
let survivors = kept;
if (manifest?.chunks?.length) {
  const chunkOf = (x, z) =>
    manifest.chunks.find((c) => x >= c.x0 && x < c.x1 && z >= c.z0 && z < c.z1);
  const raws = new Map(); // file -> {data, info}
  const rawOf = async (c) => {
    if (!raws.has(c.file)) {
      const img = sharp(path.join(DATA, "textures", c.file));
      raws.set(c.file, {
        ...(await img.raw().toBuffer({ resolveWithObject: true })),
      });
    }
    return raws.get(c.file);
  };
  /* Vegetation: clearly green (excess-green index), or dark with a green
     lean (canopy in shadow). Grey pavement, tan dirt, white paint and blue
     pads all fail both clauses. */
  const isVeg = (r, g, b) =>
    2 * g - r - b > 24 || (Math.max(r, g, b) < 90 && g > r + 3 && g >= b);

  const out = [];
  for (const t of survivors) {
    const [x, z, , crownR] = t;
    const c = chunkOf(x, z);
    if (!c) { out.push(t); continue; } // outside imagery: no verdict, keep
    const { data, info } = await rawOf(c);
    const sx = info.width / (c.x1 - c.x0);
    const sz = info.height / (c.z1 - c.z0);
    const R = Math.max(1.5, crownR * 0.6);
    let veg = 0, n = 0;
    for (let dz = -R; dz <= R; dz += R / 2) {
      for (let dx = -R; dx <= R; dx += R / 2) {
        if (dx * dx + dz * dz > R * R) continue;
        const px = Math.floor((x + dx - c.x0) * sx);
        const pz = Math.floor((z + dz - c.z0) * sz);
        if (px < 0 || pz < 0 || px >= info.width || pz >= info.height) continue;
        const i = (pz * info.width + px) * info.channels;
        n++;
        if (isVeg(data[i], data[i + 1], data[i + 2])) veg++;
      }
    }
    if (n >= 5 && veg / n < 0.15) ghosts.push(t);
    else out.push(t);
  }
  survivors = out;
}

lidar.trees = survivors;
writeFileSync(path.join(DATA, "campus-lidar.json"), JSON.stringify(lidar));
console.log(
  `trees ${before} -> ${survivors.length}` +
  ` | zones dropped ${dropped.length} (${Object.entries(byKind).map(([k, v]) => `${k} ${v}`).join(", ") || "none"})` +
  ` | imagery ghosts ${ghosts.length}`
);
const tallGhosts = ghosts.filter((t) => t[2] > 15).length;
if (ghosts.length) console.log(`  (${tallGhosts} felled ghosts were over 15 m — old grove under new construction)`);
