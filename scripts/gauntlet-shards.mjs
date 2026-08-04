/* Split the surveyed campus into geographic shards for the Cursor gauntlet driver.
 *
 * The gauntlet loop's Definition of Done is written per REGION ("a region only
 * counts as done when..."), and cursor-agent is a single agent with no fan-out.
 * So the parallelism has to live outside the agent: this file cuts the surveyed
 * extent into a grid and labels each cell with the named places actually inside
 * it, so a shard prompt can name real landmarks instead of bare coordinates.
 *
 * Shards are derived from the data, never hand-listed — add a building to
 * campus-3d.json and it lands in a shard automatically.
 *
 *   node scripts/gauntlet-shards.mjs            # human-readable table
 *   node scripts/gauntlet-shards.mjs --json     # machine-readable, for the driver
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COLS = Number(process.env.GAUNTLET_COLS || 3);
const ROWS = Number(process.env.GAUNTLET_ROWS || 3);

const d = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/data/campus-3d.json"), "utf8"));
const o = d.origin;
const toLat = (z) => o.lat - z / o.mPerDegLat;
const toLng = (x) => o.lng + x / o.mPerDegLng;

/* Extent of everything actually surveyed, in the local metre grid. */
let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
for (const b of d.buildings) {
  for (const [x, z] of b.p) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
}

const shards = [];
const stepX = (maxX - minX) / COLS;
const stepZ = (maxZ - minZ) / ROWS;

for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    const x0 = minX + c * stepX, x1 = x0 + stepX;
    const z0 = minZ + r * stepZ, z1 = z0 + stepZ;
    const inCell = ([x, z]) => x >= x0 && x < x1 && z >= z0 && z < z1;

    /* Named anchors inside the cell give the shard a human identity. */
    const places = Object.entries(d.places || {})
      .filter(([, p]) => inCell([p.x, p.z]))
      .map(([n]) => n);

    /* Buildings whose centroid falls in the cell — the shard's actual workload. */
    const buildings = d.buildings.filter((b) => {
      const cx = b.p.reduce((a, q) => a + q[0], 0) / b.p.length;
      const cz = b.p.reduce((a, q) => a + q[1], 0) / b.p.length;
      return inCell([cx, cz]);
    });
    const named = buildings.filter((b) => b.n).map((b) => b.n);

    if (!buildings.length) continue;   // empty ocean/canyon cell — nothing to sweep

    shards.push({
      id: `r${r}c${c}`,
      bbox: {
        north: toLat(z0), south: toLat(z1),
        west: toLng(x0), east: toLng(x1),
      },
      localBox: { x0: +x0.toFixed(1), x1: +x1.toFixed(1), z0: +z0.toFixed(1), z1: +z1.toFixed(1) },
      buildings: buildings.length,
      namedBuildings: named.length,
      /* Cap the label list — a shard prompt wants orientation, not an inventory. */
      landmarks: [...new Set([...places, ...named])].slice(0, 14),
    });
  }
}

if (process.argv.includes("--json")) {
  process.stdout.write(JSON.stringify(shards, null, 2) + "\n");
} else {
  console.log(`surveyed extent: x ${minX.toFixed(0)}..${maxX.toFixed(0)} m, z ${minZ.toFixed(0)}..${maxZ.toFixed(0)} m`);
  console.log(`${ROWS}x${COLS} grid -> ${shards.length} non-empty shards\n`);
  for (const s of shards) {
    console.log(`${s.id}  ${String(s.buildings).padStart(4)} buildings (${s.namedBuildings} named)`);
    console.log(`      lat ${s.bbox.south.toFixed(5)}..${s.bbox.north.toFixed(5)}  lng ${s.bbox.west.toFixed(5)}..${s.bbox.east.toFixed(5)}`);
    console.log(`      ${s.landmarks.slice(0, 6).join(", ") || "(no named landmarks)"}\n`);
  }
}
