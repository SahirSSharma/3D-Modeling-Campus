#!/usr/bin/env node
// Build docs/data/region-heights.json — measured roof heights for the region.
//
// WHY THIS EXISTS. build-region-osm.mjs ships 5,551 footprints and it knows the
// height of almost none of them: 256 of the buildings inside the outline carry
// an OSM `height` or `building:levels` tag and the other 5,295 fall to an area
// ladder. That ladder is calibrated (see its comment) and it is still a ladder —
// it says "a 600 m² footprint in this region is usually about six metres" and
// it says the same thing about a bungalow and about the two-storey-plus-attic
// house next door. The campus solved this exact problem by measuring, and the
// machinery it used is already extracted: scripts/lib/ept.mjs walks the octree,
// scripts/lib/roof-measure.mjs decides what a roof is. This applies both to the
// other 30 km².
//
// WHAT MEASUREMENT MEANS HERE, precisely. USGS 3DEP CA_SanDiegoQL2_2014, the
// same public-domain flight the campus and the regional terrain are built from.
// It classifies GROUND (class 2) and dumps everything else into "unassigned",
// so nothing here can ask "is this a building?". It asks the campus builder's
// question instead: how high do the above-ground returns standing inside a
// footprint OSM already drew rise above the ground around that footprint?
//
// THE GROUND IS THE HARD HALF, not the roof. The laser cannot see under a roof,
// so the terrain cell beneath a building is not a measurement — it is
// build-region-terrain.mjs's hole fill, an average of whatever surrounds the
// footprint. On campus that mistake put Geisel at "40.3 m": its real roof minus
// a grade borrowed from the ravine 14 m below its forecourt. So grade is read
// around the PERIMETER here too — and one step further out than the campus
// reads it, because the regional grid is 6 m and a 12 m-wide house's own
// vertices all land in cells the house itself sits on. Each rim vertex is
// pushed one cell outward from the footprint's centroid before it is sampled,
// which puts the sample just outside the wall, on ground the flight could see.
//
// THE EPOCH RULE, which this region needs more than the campus does. The flight
// is from 2014. University City has been rebuilt since, and a footprint OSM
// maps today whose building went up in 2019 does not measure as a building — it
// measures as the parking lot that was there, which is to say as nothing. The
// campus builder enumerates those by NAME because there are forty of them and a
// person checked each one. Five thousand unnamed regional houses cannot be
// checked by hand, so the rule here is statistical and it is deliberately
// one-directional: a measurement that comes back absurdly LOW is refused and
// the inferred height stands. A 2014 measurement can be too short because the
// building was not built yet; it cannot be too tall for that reason.
//
// Usage:
//   node scripts/build-region-heights.mjs --probe   # what each octree depth buys
//   node scripts/build-region-heights.mjs           # measure + write
//   node scripts/build-region-heights.mjs --check   # verify the shipped file
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { eptSource, merc, GROUND } from "./lib/ept.mjs";
import { roofOf, percentile } from "./lib/roof-measure.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REGION = path.join(REPO_ROOT, "docs/data/region.json");
const OSM = path.join(REPO_ROOT, "docs/data/region-osm.json");
const TERRAIN_JSON = path.join(REPO_ROOT, "docs/data/region-terrain.json");
const TERRAIN_BIN = path.join(REPO_ROOT, "docs/data/region-terrain.bin");
const OUT = path.join(REPO_ROOT, "docs/data/region-heights.json");

const PROBE = process.argv.includes("--probe");
const CHECK = process.argv.includes("--check");
const require = createRequire(path.join(REPO_ROOT, "package.json"));

const EPT = "https://s3-us-west-2.amazonaws.com/usgs-lidar-public/CA_SanDiegoQL2_2014";

/* OCTREE DEPTH, CHOSEN FROM MEASUREMENT.
 *
 * `--probe` reports two things, and only the second one decides anything.
 *
 * What the octree costs over this box (identical to the terrain builder's
 * table, because it is the same box):
 *
 *     depth 8      633 tiles     18,261,991 points     0.35 pts/m2
 *     depth 9    2,072 tiles     89,279,194            1.69
 *     depth 10   5,142 tiles    202,025,562            3.83   (bottoms out)
 *
 * The terrain grid stopped at 8 and was right to: it averages returns into 36 m²
 * cells, so density beyond a dozen samples per cell buys nothing. This does the
 * opposite thing — it takes a 98th percentile of the returns inside ONE
 * FOOTPRINT — and the smallest footprints out here are ~150 m² houses. At depth
 * 8's 0.35 pts/m² such a house collects roughly fifty returns of which maybe
 * thirty are roof, and a p98 of thirty samples is the second-highest one: not a
 * percentile, a maximum with extra steps.
 *
 * So the probe measures the thing that actually matters, on real footprints
 * rather than on an average: how many ABOVE-GROUND returns land inside the
 * SMALL ones, per depth. Measured over PROBE_BOX below — 220 footprints,
 * median area 167 m² against the region's own median of 288 m², so this is the
 * hard end of the population, not a representative sample of it:
 *
 *     depth   footprints   median above-ground returns   under 100 returns
 *       8        220                 42                       94%
 *       9        220                165                        6%
 *      10        220                608                        0%
 *
 * DEPTH 8 IS UNUSABLE and the average would never have said so. Forty-two
 * returns over a whole townhouse roof is not a population you can take a 98th
 * percentile of — the p98 is the top point — and 94% of these buildings fall
 * below any honest floor. The terrain builder's depth 8 is right for the
 * terrain builder and would have been a disaster here, which is the entire
 * reason this script probes again instead of inheriting a constant.
 *
 * DEPTH 9 IS THE CHOICE. The median small footprint jumps to 165 returns and
 * the too-sparse fraction collapses from 94% to 6% — the discontinuity is the
 * argument. Depth 10 buys the remaining 6% at 2.5x the tiles (5,142 vs 2,072)
 * and 2.3x the points, for a vertical precision the 6 m ground grid underneath
 * cannot express anyway. Buildings still too sparse at depth 9 are NOT
 * measured: they keep their inferred height and are counted in the output,
 * rather than being handed a number derived from forty returns.
 */
export const MAX_DEPTH = 9;

/* Below this many above-ground returns the percentiles are noise rather than a
   roof. The campus builder's floor is 25 over a population of large university
   buildings measured at FULL octree depth; this is a coarser sampling over
   much smaller buildings, and the probe above shows why the floor has to be
   higher: at 60 returns a p98 is the top point. */
export const MIN_RETURNS = 60;

/* The rim must actually resolve. A footprint on the coastal bluff can have half
   its perimeter samples fall in the open water the grid leaves as NODATA, and
   the surviving half then produces a confident-looking median off one side of
   the building. The campus builder shipped six wrong heights exactly this way
   before it started counting rim coverage. */
const MIN_RIM_COVERAGE = 0.7;

/* Plausible building heights. The floor is the epoch guard and it is the whole
   reason this constant is not simply 0: 2.5 m is below any occupiable
   structure, so a "measurement" under it is the flight looking at the ground
   where a building now stands. The ceiling matches build-region-osm.mjs. */
export const MIN_HEIGHT_M = 2.5;
export const MAX_HEIGHT_M = 90;

/* THE SECOND EPOCH GUARD, for buildings the map describes.
 *
 * A bare floor catches a footprint that measures as literal ground. It does not
 * catch the more common case: a 2019 four-storey apartment block standing where
 * a 2014 single-storey strip of shops stood. That measures ~4 m — over the
 * floor, plainly a building, and plainly not THAT building.
 *
 * OSM's `height` and `building:levels` tags are the only independent statement
 * about these buildings that exists, and they are contemporary. So where a tag
 * exists and the 2014 laser reports less than this fraction of it, the laser is
 * refused. The threshold is one-sided ON PURPOSE — a measurement well ABOVE the
 * tag is not suspicious, it is the normal case of an under-tagged building, and
 * measuring is what this script is for. Only "shorter than the map says" is
 * evidence of the epoch trap.
 *
 * 0.6 rather than something tighter because tags are themselves rough: a
 * `building:levels` of 2 converted at the calibrated 3.3 m/storey is 7.7 m and
 * the real gabled house may well measure 6.5 m at its ridge-adjacent p98. That
 * is a disagreement about storey height, not about which decade it is.
 */
export const EPOCH_TAG_RATIO = 0.6;

/* Where the probe measures the returns-per-footprint question.
 *
 * A 400 m box south-east of the campus, on the Villa La Jolla / Nobel townhouse
 * grid. It was CHOSEN BY SEARCH rather than by eye: a sweep of every 400 m box
 * in the region ranked by how many footprints under 250 m² it contains, taking
 * the winner. It holds 218 footprints with a median area of 172 m² against the
 * region's own median of 288 m², so it is genuinely the hard end of the
 * population — which is the only end worth probing. A box of shopping centres
 * would resolve at any depth and would have told us nothing.
 *
 * The first box tried was La Jolla Shores, picked by eye for "small detached
 * houses". Its footprints turned out to have a median area of 516 m² — nearly
 * twice the regional median — so it was measuring the easy case while claiming
 * to measure the hard one. Hence the search. */
const PROBE_BOX = { south: 32.8563, north: 32.8599, west: -117.2284, east: -117.2241 };

/* --------------------------------------------------------------- frames */

function loadFrames() {
  const region = JSON.parse(readFileSync(REGION, "utf8"));
  const osm = JSON.parse(readFileSync(OSM, "utf8"));
  const th = JSON.parse(readFileSync(TERRAIN_JSON, "utf8"));
  const tbin = readFileSync(TERRAIN_BIN);
  const tz = new Int16Array(tbin.buffer, tbin.byteOffset, tbin.byteLength / 2);
  const O = osm.origin;

  const localToMerc = (x, z) => [merc.x(O.lng + x / O.mPerDegLng), merc.y(O.lat - z / O.mPerDegLat)];

  /** Ground elevation, metres ABSOLUTE, or null where the grid has none. */
  const groundAt = (x, z) => {
    const c = Math.round((x - th.x0) / th.cell);
    const r = Math.round((z - th.z0) / th.cell);
    if (c < 0 || c >= th.cols || r < 0 || r >= th.rows) return null;
    const v = tz[r * th.cols + c];
    return v === th.nodata ? null : v / 10 + th.datum;
  };

  return { region, osm, th, O, localToMerc, groundAt };
}

/**
 * The fingerprint that binds a measurement to the footprints it measured.
 *
 * Heights ship as a SIDECAR keyed by index into region-osm.json's buildings
 * array, not written back into that file. Writing them back would be more
 * convenient and it would be wrong twice over: region-osm.json is generated, so
 * the next Overpass pull silently erases every measurement — and worse, a pull
 * that ADDED a building would shift every index after it and the measurements
 * would survive attached to the wrong buildings, which is a lie that no test
 * looking at either file alone could see.
 *
 * So the join is explicit and it is checked. This hashes the footprint centroids
 * in order; if a rebuild changes any footprint, the hash changes and every
 * consumer refuses the stale sidecar loudly instead of drawing it.
 */
export function footprintFingerprint(buildings) {
  const h = createHash("sha1");
  for (const b of buildings) {
    let x = 0;
    let z = 0;
    for (const p of b.p) { x += p[0]; z += p[1]; }
    h.update(`${(x / b.p.length).toFixed(1)},${(z / b.p.length).toFixed(1)};`);
  }
  return h.digest("hex").slice(0, 16);
}

/* ------------------------------------------------------------- targeting */

/** Even-odd point-in-ring, in whatever frame both arguments share. */
function pointInRing(px, py, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Build the measurement targets and the spatial hash that finds them.
 *
 * Rings are converted to Web Mercator ONCE and every return is tested in that
 * frame. The other direction — projecting each return into local metres — costs
 * a log and an atan per point, and at depth 9 there are 89 million of them.
 * This is the campus builder's arrangement, unchanged, for the same reason.
 */
function makeTargets(buildings, localToMerc) {
  const HCELL = 60; // mercator metres per hash bucket
  const targets = buildings.map((b, i) => {
    const ring = b.p.map(([x, z]) => localToMerc(x, z));
    const xs = ring.map((p) => p[0]);
    const ys = ring.map((p) => p[1]);
    return {
      i, ring, roofs: [],
      bb: { minx: Math.min(...xs), maxx: Math.max(...xs), miny: Math.min(...ys), maxy: Math.max(...ys) },
    };
  });
  const cells = new Map();
  for (const t of targets) {
    for (let hx = Math.floor(t.bb.minx / HCELL); hx <= Math.floor(t.bb.maxx / HCELL); hx++) {
      for (let hy = Math.floor(t.bb.miny / HCELL); hy <= Math.floor(t.bb.maxy / HCELL); hy++) {
        const k = `${hx}:${hy}`;
        if (!cells.has(k)) cells.set(k, []);
        cells.get(k).push(t);
      }
    }
  }
  const fold = (mx, my, mz, cls) => {
    if (cls === GROUND) return;
    const bucket = cells.get(`${Math.floor(mx / HCELL)}:${Math.floor(my / HCELL)}`);
    if (!bucket) return;
    for (const t of bucket) {
      if (mx < t.bb.minx || mx > t.bb.maxx || my < t.bb.miny || my > t.bb.maxy) continue;
      if (pointInRing(mx, my, t.ring)) t.roofs.push(mz);
    }
  };
  return { targets, fold };
}

/**
 * Grade around a footprint, read one cell OUTSIDE it.
 *
 * See the header: the cell under a roof is hole fill, not a measurement. The
 * campus reads its 3 m grid at the ring vertices themselves, which is already
 * outside the wall at that resolution. At 6 m it is not — a 12 m house's
 * vertices sample the same four cells the house stands on — so every vertex is
 * pushed one cell outward along the ray from the centroid before sampling.
 *
 * Median of the samples that resolved, and the coverage is returned with it so
 * the caller can refuse a footprint whose ground only resolved on one side.
 */
function rimBase(ring, groundAt, cell) {
  let cx = 0;
  let cz = 0;
  for (const [x, z] of ring) { cx += x; cz += z; }
  cx /= ring.length;
  cz /= ring.length;

  const samples = [];
  for (const [x, z] of ring) {
    const dx = x - cx;
    const dz = z - cz;
    const d = Math.hypot(dx, dz) || 1;
    const g = groundAt(x + (dx / d) * cell, z + (dz / d) * cell);
    if (g !== null) samples.push(g);
  }
  return {
    base: samples.length ? percentile(samples, 0.5) : null,
    coverage: ring.length ? samples.length / ring.length : 0,
  };
}

/* ------------------------------------------------------------- streaming */

async function streamTiles(src, laz, maxDepth, fold, label) {
  const ept = await (await fetch(`${EPT}/ept.json`)).json();
  const tiles = await src.findTiles(ept.bounds, maxDepth);
  console.log(`  ${tiles.length} tiles to depth ${maxDepth}${label ? ` (${label})` : ""}`);

  let done = 0;
  let points = 0;
  const CONCURRENCY = 8;
  const queue = tiles.slice();
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) {
        const key = queue.pop();
        /* Returns stream into the footprints and are forgotten. Holding 89
           million points to filter them afterwards is an out-of-memory at the
           end of an hour-long download — the terrain builder's lesson. */
        await src.readTile(laz, key, (mx, my, mz, cls) => { points++; fold(mx, my, mz, cls); });
        if (++done % 25 === 0) process.stdout.write(`  ${done}/${tiles.length} tiles\r`);
      }
    })
  );
  console.log(`  ${done}/${tiles.length} tiles, ${points.toLocaleString()} returns read        `);
  return points;
}

/* ------------------------------------------------------------------ probe */

async function probe() {
  const f = loadFrames();
  const bboxKm2 = f.region.region.bboxAreaKm2;
  const src = eptSource(EPT, f.region.region.bbox);
  const ept = await (await fetch(`${EPT}/ept.json`)).json();

  console.log(`region bbox ${bboxKm2} km2\n`);
  console.log("depth  tiles        points     pts/m2");
  for (const d of [8, 9, 10]) {
    const tiles = await src.findTiles(ept.bounds, d);
    const pts = await countPoints(src, ept.bounds, d);
    console.log(
      `${String(d).padStart(5)}  ${String(tiles.length).padStart(5)}  ` +
      `${pts.toLocaleString().padStart(12)}  ${(pts / (bboxKm2 * 1e6)).toFixed(2).padStart(9)}`
    );
  }

  /* The measurement that actually chooses the depth: real return counts inside
     real small footprints, not an area-average. */
  const inBox = (b) => {
    const [x, z] = [
      b.p.reduce((s, p) => s + p[0], 0) / b.p.length,
      b.p.reduce((s, p) => s + p[1], 0) / b.p.length,
    ];
    const O = f.O;
    const lat = O.lat - z / O.mPerDegLat;
    const lng = O.lng + x / O.mPerDegLng;
    return lat >= PROBE_BOX.south && lat <= PROBE_BOX.north &&
           lng >= PROBE_BOX.west && lng <= PROBE_BOX.east;
  };
  const sample = f.osm.buildings.filter(inBox);
  const areaOf = (r) => {
    let a = 0;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1];
    return Math.abs(a / 2);
  };
  const areas = sample.map((b) => areaOf(b.p)).sort((a, b) => a - b);
  const allAreas = f.osm.buildings.map((b) => areaOf(b.p)).sort((a, b) => a - b);
  console.log(
    `\nprobe box ${PROBE_BOX.south},${PROBE_BOX.west} → ${PROBE_BOX.north},${PROBE_BOX.east}` +
    ` — ${sample.length} footprints, median area ${areas.length ? areas[areas.length >> 1].toFixed(0) : 0} m2` +
    ` (whole region: ${allAreas[allAreas.length >> 1].toFixed(0)} m2)`
  );
  if (!sample.length) { console.log("  no footprints in the probe box; nothing to measure"); return; }

  const { createLazPerf } = require("laz-perf");
  const laz = await createLazPerf();
  const boxSrc = eptSource(EPT, PROBE_BOX);

  console.log("\ndepth   footprints   median above-ground returns   under 100 returns");
  for (const d of [8, 9, 10]) {
    const { targets, fold } = makeTargets(sample, f.localToMerc);
    await streamTiles(boxSrc, laz, d, fold, `probe depth ${d}`);
    const counts = targets.map((t) => t.roofs.length).sort((a, b) => a - b);
    const med = counts[counts.length >> 1];
    const sparse = counts.filter((n) => n < 100).length;
    console.log(
      `${String(d).padStart(5)}   ${String(sample.length).padStart(10)}   ` +
      `${String(med).padStart(27)}   ${`${Math.round((sparse / counts.length) * 100)}%`.padStart(17)}`
    );
  }
}

/** Point count for a depth, straight out of the cached hierarchy — no downloads. */
async function countPoints(src, bounds, maxDepth) {
  const size = bounds[3] - bounds[0];
  const box = src.box;
  const nodeBox = (d, x, y) => {
    const s = size / 2 ** d;
    return {
      minx: bounds[0] + x * s, maxx: bounds[0] + (x + 1) * s,
      miny: bounds[1] + y * s, maxy: bounds[1] + (y + 1) * s,
    };
  };
  const overlaps = (a) =>
    !(a.maxx < box.minx || a.minx > box.maxx || a.maxy < box.miny || a.miny > box.maxy);
  let total = 0;
  const walk = async (rootKey) => {
    const node = await src.hierarchy(rootKey);
    for (const [key, count] of Object.entries(node)) {
      const [d, x, y] = key.split("-").map(Number);
      if (!overlaps(nodeBox(d, x, y))) continue;
      if (d > maxDepth) continue;
      if (count === -1) { if (d < maxDepth) await walk(key); }
      else total += count;
    }
  };
  await walk("0-0-0-0");
  return total;
}

/* ------------------------------------------------------------------ build */

async function build() {
  const f = loadFrames();
  const buildings = f.osm.buildings;
  console.log(`${buildings.length.toLocaleString()} footprints from region-osm.json`);
  console.log(`terrain grid ${f.th.cols}x${f.th.rows} @ ${f.th.cell} m, datum ${f.th.datum} m`);

  const { targets, fold } = makeTargets(buildings, f.localToMerc);
  const { createLazPerf } = require("laz-perf");
  const laz = await createLazPerf();
  const src = eptSource(EPT, f.region.region.bbox);

  console.log("locating LiDAR tiles…");
  await streamTiles(src, laz, MAX_DEPTH, fold);

  /* ---- verdict, per footprint ---- */
  const h = {};
  const reasons = {
    measured: 0, sparse: 0, noGround: 0, thinRim: 0,
    tooLow: 0, tooTall: 0, epochTag: 0,
  };
  const epochSuspect = [];
  const deltas = [];

  for (const t of targets) {
    const b = buildings[t.i];
    if (t.roofs.length < MIN_RETURNS) { reasons.sparse++; continue; }
    const { base, coverage } = rimBase(b.p, f.groundAt, f.th.cell);
    if (base === null) { reasons.noGround++; continue; }
    if (coverage < MIN_RIM_COVERAGE) { reasons.thinRim++; continue; }

    const measured = Math.round((roofOf(t.roofs, base) - base) * 10) / 10;
    if (measured < MIN_HEIGHT_M) { reasons.tooLow++; continue; }
    if (measured > MAX_HEIGHT_M) { reasons.tooTall++; continue; }
    /* The map's own contemporary statement, where it has one. Only a
       measurement SHORTER than the map is refused — see EPOCH_TAG_RATIO. */
    if ((b.src === "height" || b.src === "levels") && measured < b.h * EPOCH_TAG_RATIO) {
      reasons.epochTag++;
      epochSuspect.push({ i: t.i, n: b.n ?? null, tag: b.h, lidar: measured, src: b.src });
      continue;
    }

    h[t.i] = measured;
    reasons.measured++;
    deltas.push(measured - b.h);
  }

  deltas.sort((a, b) => a - b);
  const data = {
    _: "Generated by scripts/build-region-heights.mjs from USGS 3DEP LiDAR " +
       "(CA_SanDiegoQL2_2014, public domain). Do not hand-edit. " +
       "A SIDECAR, not a patch: `h` is keyed by index into docs/data/region-osm.json's " +
       "buildings array and is only valid while `footprints.fingerprint` matches that file. " +
       "Buildings absent from `h` were not measurable and keep their region-osm.json height.",
    source: { ept: EPT, dataset: "CA_SanDiegoQL2_2014", flown: 2014, maxDepth: MAX_DEPTH },
    method: {
      roof: "scripts/lib/roof-measure.mjs roofOf(returns, rimBase) — p98 with the canopy and thin-shelf guards",
      ground: `median of region-terrain samples one ${f.th.cell} m cell OUTSIDE each rim vertex, never under the roof`,
      minReturns: MIN_RETURNS,
      minRimCoverage: MIN_RIM_COVERAGE,
      epoch: `refused below ${MIN_HEIGHT_M} m, or below ${EPOCH_TAG_RATIO}x an OSM height/levels tag — ` +
             "the 2014 flight predates recent construction and measures its site, not its building",
    },
    footprints: { count: buildings.length, fingerprint: footprintFingerprint(buildings) },
    stats: {
      ...reasons,
      unmeasured: buildings.length - reasons.measured,
      deltaVsInferred: deltas.length
        ? {
            p10: Math.round(percentile(deltas, 0.1) * 10) / 10,
            median: Math.round(percentile(deltas, 0.5) * 10) / 10,
            p90: Math.round(percentile(deltas, 0.9) * 10) / 10,
          }
        : null,
    },
    /* Kept, not discarded: every one of these is a building the map says is
       taller than the 2014 flight saw, which is the signature of construction
       between then and now. They are the shortlist for anyone who later wants
       a newer survey over this region. */
    epochSuspect: epochSuspect
      .sort((a, b) => (b.tag - b.lidar) - (a.tag - a.lidar)) // worst disagreement first
      .slice(0, 200),
    h,
  };

  writeFileSync(OUT, `${JSON.stringify(data, null, 1)}\n`);
  const kb = Math.round(readFileSync(OUT).length / 1024);
  console.log(
    `wrote ${path.relative(REPO_ROOT, OUT)} — ` +
    `${reasons.measured.toLocaleString()}/${buildings.length.toLocaleString()} measured ` +
    `(${Math.round((reasons.measured / buildings.length) * 100)}%), ${kb} KB`
  );
  console.log(
    `  not measured: ${reasons.sparse.toLocaleString()} too few returns, ` +
    `${reasons.noGround} no ground under the rim, ${reasons.thinRim} rim resolved under ` +
    `${Math.round(MIN_RIM_COVERAGE * 100)}%, ${reasons.tooLow.toLocaleString()} under ` +
    `${MIN_HEIGHT_M} m (bare 2014 ground), ${reasons.tooTall} over ${MAX_HEIGHT_M} m, ` +
    `${reasons.epochTag} shorter than their own OSM tag`
  );
  if (data.stats.deltaVsInferred) {
    const d = data.stats.deltaVsInferred;
    console.log(`  measured minus inferred: p10 ${d.p10} m, median ${d.median} m, p90 ${d.p90} m`);
  }
}

/* ------------------------------------------------------------------ check */

function check() {
  if (!existsSync(OUT)) { console.error(`FAIL: missing ${path.relative(REPO_ROOT, OUT)}`); process.exit(1); }
  const d = JSON.parse(readFileSync(OUT, "utf8"));
  const osm = JSON.parse(readFileSync(OSM, "utf8"));

  if (d.footprints.count !== osm.buildings.length) {
    console.error(`FAIL: sidecar measures ${d.footprints.count} footprints, region-osm.json ships ${osm.buildings.length}`);
    process.exit(1);
  }
  const fp = footprintFingerprint(osm.buildings);
  if (fp !== d.footprints.fingerprint) {
    console.error(
      `FAIL: footprint fingerprint ${fp} != sidecar's ${d.footprints.fingerprint} — ` +
      "region-osm.json was rebuilt and the measured heights no longer line up with it. " +
      "Re-run scripts/build-region-heights.mjs."
    );
    process.exit(1);
  }
  if (d.source.maxDepth !== MAX_DEPTH) {
    console.error(`FAIL: sidecar built at octree depth ${d.source.maxDepth}, this script uses ${MAX_DEPTH}`);
    process.exit(1);
  }
  let bad = 0;
  for (const [i, v] of Object.entries(d.h)) {
    if (!(v >= MIN_HEIGHT_M && v <= MAX_HEIGHT_M)) bad++;
    if (!osm.buildings[Number(i)]) bad++;
  }
  if (bad) { console.error(`FAIL: ${bad} sidecar heights are out of range or index nothing`); process.exit(1); }
  console.log(
    `region-heights.json OK — ${Object.keys(d.h).length.toLocaleString()}/${d.footprints.count.toLocaleString()} ` +
    `footprints measured at depth ${d.source.maxDepth}, fingerprint ${fp}`
  );
}

/* Invoked only, never on import — tests/region-osm.test.mjs imports the
   fingerprint function and the constants to verify the shipped sidecar against
   the source that produced it. See the same note in build-region-osm.mjs. */
const INVOKED = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (INVOKED) {
  if (PROBE) await probe();
  else if (CHECK) check();
  else await build();
}
