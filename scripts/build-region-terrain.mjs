#!/usr/bin/env node
// Build docs/data/region-terrain.{json,bin} — the land around the campus.
//
// WHY THIS EXISTS. campus-lidar.json measures an 8.4 km² box because that is
// what a student walks. Standing on Ridge Walk and looking west, though, you
// are looking at the Torrey Pines bluff, and past it the ocean; looking east,
// at Rose Canyon and University City. None of that existed. The world simply
// stopped at a rectangle and the renderer put a wall there.
//
// This builds the land inside the region outline (docs/data/region.json) at a
// 6 m sampling. The campus keeps its own 3 m grid, unchanged and untouched —
// this grid is phase-aligned to it, so every second regional sample falls
// exactly on a campus sample and the two cannot disagree at the seam.
//
// THE SOURCE is the same one the campus uses: USGS 3DEP, CA_SanDiegoQL2_2014,
// public domain, read from the public Entwine octree. Same decoder, same
// class-2 ground filter, same mean-of-returns per cell, same datum. Sharing
// all four is the point: a seam is where two methods meet, and the only way
// for it to be invisible is for there to be one method.
//
// WHAT IT DELIBERATELY DOES NOT DO. It does not fill the ocean. The campus
// builder hole-fills every gap, which is right for a box that is entirely
// land — a gap there is a building the laser could not see under. Out here
// the biggest gap is the Pacific, and averaging the neighbours across it would
// grow a shelf of land out to the horizon.
//
// So every void is judged, and it is judged by ELEVATION, not by size. A void
// whose surrounding land stands at sea level is water and stays open; anything
// higher is ground the laser could not see and gets filled from its own rim.
// Size was the first rule tried and it was wrong: a big-box roof in University
// City returns no ground over more than 9,000 m², so a size cap put the
// Pacific up through a warehouse roof four kilometres inland.
//
// Usage:
//   node scripts/build-region-terrain.mjs --probe   # what each octree depth costs
//   node scripts/build-region-terrain.mjs           # fetch + write
//   node scripts/build-region-terrain.mjs --check   # verify the shipped files
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { eptSource, merc, GROUND } from "./lib/ept.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REGION = path.join(REPO_ROOT, "docs/data/region.json");
const CAMPUS_LIDAR = path.join(REPO_ROOT, "docs/data/campus-lidar.json");
const OUT_JSON = path.join(REPO_ROOT, "docs/data/region-terrain.json");
const OUT_BIN = path.join(REPO_ROOT, "docs/data/region-terrain.bin");

const PROBE = process.argv.includes("--probe");
const CHECK = process.argv.includes("--check");
const require = createRequire(path.join(REPO_ROOT, "package.json"));

const EPT = "https://s3-us-west-2.amazonaws.com/usgs-lidar-public/CA_SanDiegoQL2_2014";

/* Mean sea level, metres absolute. Shared with the renderer, which draws the
   sea plane at exactly this height — if the two ever disagreed, the water
   would sit above or below the beach it meets. */
const SEA_LEVEL_M = 0;

/* Octree depth cap, chosen from --probe rather than guessed. Over this box the
   octree carries:
//
       depth 8      633 tiles     18,261,991 points
       depth 9    2,072 tiles     89,279,194
       depth 10   5,142 tiles    202,025,562   (and it bottoms out here)
//
   Every level is a uniform refinement of the one above, and this grid does
   nothing with a return but average it into a 36 m² cell. Depth 8 already puts
   ~12 ground samples in every cell; depth 9 costs five times the download to
   compute the same mean more precisely than the 6 m sampling can express. */
const MAX_DEPTH = 8;

/* A void is WATER if its rim stands at sea level, and land otherwise.
//
   The first cut of this used a size cap — fill anything under 9,000 m², leave
   anything bigger. That is not a discriminator, it is a correlation, and it
   failed exactly where the correlation breaks: a big-box roof in University
   City is larger than 9,000 m² and returns no ground, so the Pacific rendered
   up through the roof of a warehouse four kilometres inland.
   Elevation does not have that problem. The sea is at sea level everywhere and
   nothing else in this region is. So a void is filled unless the land around
   its edge sits within this many metres of the water, which keeps the ocean
   and the Los Peñasquitos lagoon open while filling every roof, parking
   structure and canopy shadow whatever its size. */
const WATER_RIM_MAX_M = 5;

/* Int16 decimetres relative to the shared datum. Sea level sits ~1,024 dm
   below it and the Carmel mesas ~500 above, so the whole region lives inside
   a fifteenth of the type's range; the sentinel can never collide with a real
   height. */
const NODATA = -32768;

function loadFrames() {
  const region = JSON.parse(readFileSync(REGION, "utf8"));
  const campus = JSON.parse(readFileSync(CAMPUS_LIDAR, "utf8"));
  const O = region.origin;

  const localToMerc = (x, z) => [merc.x(O.lng + x / O.mPerDegLng), merc.y(O.lat - z / O.mPerDegLat)];
  const mercToLocal = (mx, my) => [
    (merc.lng(mx) - O.lng) * O.mPerDegLng,
    -(merc.lat(my) - O.lat) * O.mPerDegLat,
  ];

  /* Phase-align to the campus grid: the campus samples at x0 + 3k, so a 6 m
     grid starting on x0 + 6k shares every one of its lines with the finer one.
     Snapping here is what makes the seam exact rather than nearly exact. */
  const ct = campus.terrain;
  const cell = region.region.cell;
  const snap = (v, anchor) => anchor + Math.floor((v - anchor) / cell) * cell;

  const xs = region.polygon.local.map(([x]) => x);
  const zs = region.polygon.local.map(([, z]) => z);
  const x0 = snap(Math.min(...xs), ct.x0);
  const z0 = snap(Math.min(...zs), ct.z0);
  const cols = Math.ceil((Math.max(...xs) - x0) / cell) + 1;
  const rows = Math.ceil((Math.max(...zs) - z0) / cell) + 1;

  return {
    region, campus, O, cell, x0, z0, cols, rows,
    datum: campus.datum,
    localToMerc, mercToLocal,
  };
}

/** Even-odd point-in-polygon, on the region outline in local metres. */
function makeInPolygon(ring) {
  const xs = ring.map(([x]) => x);
  const zs = ring.map(([, z]) => z);
  const bb = {
    x0: Math.min(...xs), x1: Math.max(...xs),
    z0: Math.min(...zs), z1: Math.max(...zs),
  };
  return (px, pz) => {
    if (px < bb.x0 || px > bb.x1 || pz < bb.z0 || pz > bb.z1) return false;
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, zi] = ring[i];
      const [xj, zj] = ring[j];
      if (zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
  };
}

/**
 * Fill the voids that are land, leave the ones that are water.
 *
 * Connected components of nodata are found first, then each is judged by the
 * height of the land around its edge: a rim at sea level is the sea, anything
 * higher is ground the laser could not see and gets filled from its own rim.
 * The campus builder's unconditional relaxation cannot be used here — run over
 * a coastline it walks land out across the water a cell per pass.
 */
function fillLandVoids(grid, cols, rows, waterRimMaxDm, inScope) {
  /* Out-of-scope cells are pre-marked as visited. They are empty for the same
     reason the ocean is — no value was written — but they are not a void in
     the survey, and letting the flood run through them merges the Pacific with
     everything outside the outline into one meaningless component. */
  const seen = inScope ? Uint8Array.from(inScope, (v) => (v ? 0 : 1)) : new Uint8Array(cols * rows);
  let filledComponents = 0;
  let filledCells = 0;
  let leftOpen = 0;
  let largest = 0;

  for (let start = 0; start < grid.length; start++) {
    if (seen[start] || grid[start] !== NODATA) continue;

    /* Flood the whole component, and collect the heights of the land it
       touches as we go. No size cap: size was never the question. */
    const stack = [start];
    const cells = [];
    const rim = [];
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop();
      cells.push(i);
      const r = (i / cols) | 0;
      const c = i % cols;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) continue;
        const j = rr * cols + cc;
        const v = grid[j];
        if (v !== NODATA) { rim.push(v); continue; }
        if (seen[j]) continue;
        seen[j] = 1;
        stack.push(j);
      }
    }

    /* The verdict: is the land around this hole at sea level?
       Median, not mean — a lagoon rimmed by one bluff should still read as
       water, and a roof beside a canyon should still read as roof. A void with
       no rim at all touches nothing measured and cannot be judged, so it is
       left open rather than invented. */
    let isWater = true;
    if (rim.length) {
      rim.sort((a, b) => a - b);
      isWater = rim[rim.length >> 1] <= waterRimMaxDm;
    }
    if (isWater) {
      leftOpen++;
      largest = Math.max(largest, cells.length);
      continue;
    }

    /* Fill from the component's own rim, inward, so a long thin void does not
       take the value of one end. */
    const set = new Set(cells);
    let remaining = cells.slice();
    while (remaining.length) {
      const next = [];
      const writes = [];
      for (const i of remaining) {
        const r = (i / cols) | 0;
        const c = i % cols;
        let total = 0;
        let n = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const rr = r + dr;
            const cc = c + dc;
            if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) continue;
            const v = grid[rr * cols + cc];
            if (v !== NODATA) { total += v; n++; }
          }
        }
        if (n) writes.push([i, Math.round(total / n)]);
        else next.push(i);
      }
      if (!writes.length) break; // fully enclosed by nothing — give up cleanly
      for (const [i, v] of writes) { grid[i] = v; set.delete(i); filledCells++; }
      remaining = next.filter((i) => set.has(i));
    }
    filledComponents++;
  }

  return { filledComponents, filledCells, leftOpen, largestOpen: largest };
}

async function probe() {
  const f = loadFrames();
  const src = eptSource(EPT, f.region.region.bbox);
  const ept = await (await fetch(`${EPT}/ept.json`)).json();
  console.log(`region ${f.cols}x${f.rows} cells @ ${f.cell} m`);
  console.log("depth  tiles   points");
  let prevPts = 0;
  for (const d of [8, 9, 10, 11, 12, 13]) {
    const tiles = await src.findTiles(ept.bounds, d);
    /* Counts come out of the hierarchy the walk already cached, so measuring
       the cost of a depth costs no point downloads at all. */
    const pts = await countPoints(src, ept.bounds, d);
    console.log(
      `${String(d).padStart(5)}  ${String(tiles.length).padStart(5)}  ` +
        `${pts.toLocaleString().padStart(12)}  (+${(pts - prevPts).toLocaleString()})`
    );
    prevPts = pts;
  }
}

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

async function build() {
  const f = loadFrames();
  const inPoly = makeInPolygon(f.region.polygon.local);
  const src = eptSource(EPT, f.region.region.bbox);

  console.log(`region grid ${f.cols}x${f.rows} @ ${f.cell} m, datum ${f.datum} m`);
  console.log("locating LiDAR tiles…");
  const ept = await (await fetch(`${EPT}/ept.json`)).json();
  const tiles = await src.findTiles(ept.bounds, MAX_DEPTH);
  console.log(`  ${tiles.length} tiles to depth ${MAX_DEPTH}`);

  const { createLazPerf } = require("laz-perf");
  const laz = await createLazPerf();

  const sum = new Float64Array(f.cols * f.rows);
  const hits = new Uint32Array(f.cols * f.rows);
  let groundN = 0;
  let done = 0;

  /* Returns stream straight into the grid and are forgotten. At this area the
     alternative — an array of points — is tens of millions of JS arrays and an
     out-of-memory at the end of a long download. */
  const CONCURRENCY = 8;
  const queue = tiles.slice();
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) {
        const key = queue.pop();
        await src.readTile(laz, key, (mx, my, mz, cls) => {
          if (cls !== GROUND) return;
          const [lx, lz] = f.mercToLocal(mx, my);
          const c = Math.round((lx - f.x0) / f.cell);
          const r = Math.round((lz - f.z0) / f.cell);
          if (c < 0 || c >= f.cols || r < 0 || r >= f.rows) return;
          groundN++;
          sum[r * f.cols + c] += mz;
          hits[r * f.cols + c]++;
        });
        if (++done % 50 === 0) process.stdout.write(`  ${done}/${tiles.length} tiles\r`);
      }
    })
  );
  console.log(`  ${groundN.toLocaleString()} ground returns                    `);

  /* Mean of the ground returns in the cell — the campus builder's rule,
     unchanged, because the seam has to agree. */
  const grid = new Int16Array(f.cols * f.rows).fill(NODATA);
  const inScope = new Uint8Array(f.cols * f.rows);
  let measured = 0;
  let outOfScope = 0;
  for (let i = 0; i < grid.length; i++) {
    const r = (i / f.cols) | 0;
    const c = i % f.cols;
    /* Outside the outline is OUT OF SCOPE, which is not the same thing as
       missing data and must not be totalled with it. Roughly 43% of this
       bounding box lies outside the outline; folding that into an
       "unmeasured" count would read as a survey with a 43% failure rate. */
    if (!inPoly(f.x0 + c * f.cell, f.z0 + r * f.cell)) { outOfScope++; continue; }
    inScope[i] = 1;
    if (!hits[i]) continue;
    grid[i] = Math.round((sum[i] / hits[i] - f.datum) * 10);
    measured++;
  }

  /* Sea level expressed in the grid's own units, so the water test compares
     like with like. */
  const waterRimMaxDm = Math.round((SEA_LEVEL_M + WATER_RIM_MAX_M - f.datum) * 10);
  const holes = fillLandVoids(grid, f.cols, f.rows, waterRimMaxDm, inScope);

  /* ---- inside the campus box, the campus grid WINS ----
     Both grids describe the same ground there, and one of them is better: the
     campus is measured at full octree depth with ~15x the ground returns per
     square metre, which is why it can see the gap between two buildings that
     this sampling has to fill by averaging its neighbours.
     Making them merely AGREE is not good enough. Two independently-built
     surfaces that agree to a tolerance still meet in a step of that tolerance,
     and 0.12% of the overlap disagreed by up to 3.3 m — most of it ground
     under a roof that neither survey could see, which is precisely where an
     average is a guess. So the region grid does not get a vote here: it takes
     the campus value outright. The seam then agrees exactly, by construction,
     and there is no tolerance left to tune. */
  const ct = f.campus.terrain;
  let deferred = 0;
  for (let r = 0; r < f.rows; r++) {
    for (let c = 0; c < f.cols; c++) {
      const x = f.x0 + c * f.cell;
      const z = f.z0 + r * f.cell;
      const cc = Math.round((x - ct.x0) / ct.cell);
      const rr = Math.round((z - ct.z0) / ct.cell);
      if (cc < 0 || cc >= ct.cols || rr < 0 || rr >= ct.rows) continue;
      /* Phase alignment guarantees this sample exists in the finer grid rather
         than needing interpolation — that is what the alignment is FOR. */
      const i = r * f.cols + c;
      grid[i] = ct.z[rr * ct.cols + cc];
      /* The campus is in scope by definition, whatever the freehand outline
         does at its corners. */
      if (!inScope[i]) { inScope[i] = 1; outOfScope--; }
      deferred++;
    }
  }
  console.log(`  ${deferred.toLocaleString()} cells deferred to the campus grid`);

  /* Recount from the finished grid rather than trusting the running totals:
     deferral rewrote cells that the regional pass had already classified, and
     a header describing the pass instead of the file is a header that lies. */
  let lo = Infinity;
  let hi = -Infinity;
  let filled = 0;
  for (const v of grid) {
    if (v === NODATA) continue;
    filled++;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const inScopeCells = grid.length - outOfScope;

  const header = {
    _: "Generated by scripts/build-region-terrain.mjs from USGS 3DEP LiDAR " +
       "(CA_SanDiegoQL2_2014, public domain). Do not hand-edit. Heights live in region-terrain.bin.",
    bin: "region-terrain.bin",
    format: "Int16LE decimetres relative to datum, row-major, NODATA = -32768",
    datum: f.datum,
    cell: f.cell,
    x0: f.x0, z0: f.z0, cols: f.cols, rows: f.rows,
    nodata: NODATA,
    source: { ept: EPT, maxDepth: MAX_DEPTH, groundReturns: groundN },
    stats: {
      cells: grid.length,
      outOfScope,
      inScope: inScopeCells,
      /* Cells carrying a height, however it was arrived at. */
      withHeight: filled,
      /* In scope, inside the outline, and still no ground return: water,
         essentially all of it. The renderer draws sea here. */
      openWater: inScopeCells - filled,
      /* How the regional pass itself did, before deferring to the campus. */
      regionalPass: { measured, holeFilled: holes.filledCells },
      deferredToCampus: deferred,
      holes,
      minM: Math.round((lo / 10 + f.datum) * 10) / 10,
      maxM: Math.round((hi / 10 + f.datum) * 10) / 10,
    },
  };

  writeFileSync(OUT_BIN, Buffer.from(grid.buffer, grid.byteOffset, grid.byteLength));
  writeFileSync(OUT_JSON, `${JSON.stringify(header, null, 1)}\n`);
  console.log(
    `wrote region-terrain.bin ${(grid.byteLength / 1048576).toFixed(2)} MB — ` +
      `${header.stats.inScope.toLocaleString()} cells in scope: ` +
      `${filled.toLocaleString()} with a height ` +
      `(${measured.toLocaleString()} measured, ${holes.filledCells.toLocaleString()} hole-filled, ` +
      `${deferred.toLocaleString()} from the campus grid), ` +
      `${header.stats.openWater.toLocaleString()} open water ` +
      `(${holes.leftOpen} voids, largest ${holes.largestOpen.toLocaleString()} cells)`
  );
  console.log(
    `  ${outOfScope.toLocaleString()} cells outside the outline — not built, not a gap`
  );
  console.log(`  elevation ${header.stats.minM} m to ${header.stats.maxM} m absolute`);
}

function check() {
  for (const p of [OUT_JSON, OUT_BIN]) {
    if (!existsSync(p)) { console.error(`FAIL: missing ${path.relative(REPO_ROOT, p)}`); process.exit(1); }
  }
  const h = JSON.parse(readFileSync(OUT_JSON, "utf8"));
  const bytes = readFileSync(OUT_BIN);
  if (bytes.byteLength !== h.cols * h.rows * 2) {
    console.error(`FAIL: bin is ${bytes.byteLength} bytes, header says ${h.cols * h.rows * 2}`);
    process.exit(1);
  }
  const f = loadFrames();
  if (h.datum !== f.datum) {
    console.error(`FAIL: region datum ${h.datum} != campus datum ${f.datum} — the seam would step`);
    process.exit(1);
  }
  if ((h.x0 - f.campus.terrain.x0) % h.cell !== 0 || (h.z0 - f.campus.terrain.z0) % h.cell !== 0) {
    console.error("FAIL: region grid is not phase-aligned to the campus grid");
    process.exit(1);
  }
  console.log(
    `region-terrain OK — ${h.cols}x${h.rows} @ ${h.cell} m, ` +
      `${h.stats.regionalPass.measured.toLocaleString()} measured cells, ` +
      `${h.stats.minM}–${h.stats.maxM} m`
  );
}

if (PROBE) await probe();
else if (CHECK) check();
else await build();
