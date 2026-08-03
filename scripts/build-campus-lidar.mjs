#!/usr/bin/env node
// Build app/data/campus-lidar.json — measured campus geometry from aerial LiDAR.
//
// WHY THIS EXISTS. campus-3d.json gets footprint OUTLINES from OpenStreetMap,
// and OSM is genuinely good at those. It is not good at anything in the third
// dimension. Of the ~320 buildings in that file, 38 carried a height tag; the
// rest fell to a guess based on footprint area, and the tagged ones were not
// reliably right either. Checked against LiDAR afterwards, the guesses were off
// by more than half in both directions:
//
//   Mandeville Center   guessed 15 m    measured 25.2 m
//   McGill Hall         guessed 12 m    measured 25.5 m
//   Student Center      guessed 12 m    measured 23.3 m
//   Argo Hall           OSM says 22.8 m measured 18.3 m
//   Revelle Commons     guessed 10 m    measured  7.5 m
//
// Argo and Blake are the two buildings you stand between at the start of the
// walk this whole thing exists to show, and both were wrong. A campus you have
// to hand-correct one building at a time is not accurate, it is decorated. So
// the heights are measured instead.
//
// THE SOURCE. USGS 3DEP, dataset CA_SanDiegoQL2_2014, served as a public
// Entwine Point Tile octree from s3://usgs-lidar-public. No key, no account,
// ~2.6 million points over this corridor. Points arrive in EPSG:3857 with a
// classification byte per return.
//
// A CAVEAT WORTH KNOWING. This is a coastal survey. It classifies GROUND
// (class 2) properly and then puts everything else — buildings, trees, lamp
// posts — in "unassigned" (class 1). There is no class 6. So nothing here can
// ask the data "is this a building?"; it asks "is this point above ground, and
// does it stand inside a footprint OSM already drew?" instead. That division of
// labour is the whole design: OSM says where the walls are, LiDAR says how high
// everything is and where the ground sits.
//
// Usage:
//   node scripts/build-campus-lidar.mjs            # fetch + write
//   node scripts/build-campus-lidar.mjs --check    # verify the shipped file
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IN = path.join(REPO_ROOT, "docs/data/campus-3d.json");
const OUT = path.join(REPO_ROOT, "docs/data/campus-lidar.json");
const CHECK = process.argv.includes("--check");

const require = createRequire(path.join(REPO_ROOT, "package.json"));

const EPT = "https://s3-us-west-2.amazonaws.com/usgs-lidar-public/CA_SanDiegoQL2_2014";

/* The walk this is for — Argo Hall, across Revelle Plaza, up onto Ridge Walk —
   plus enough margin that the buildings framing it are complete and the skyline
   behind it is real. Widening this costs download time and file size in
   proportion; it is not free. */
const AREA = { south: 32.8725, north: 32.8815, west: -117.2432, east: -117.2378 };

/* Terrain sample spacing, metres. The ground here moves by about 7 m over the
   whole walk, so this is not about hills — it is about the plaza sitting a step
   below the path beside it, which 3 m resolves and 10 m erases. */
const TERRAIN_CELL = 3;

/* A return this far above local ground, standing outside every footprint, is
   vegetation rather than a kerb or a parked car. */
const TREE_MIN_HEIGHT = 3.5;

const R = 6378137;
const toX = (lng) => (lng * Math.PI * R) / 180;
const toY = (lat) => R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const toLat = (y) => (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * (180 / Math.PI);
const toLng = (x) => (x / R) * (180 / Math.PI);

const BOX = {
  minx: toX(AREA.west), maxx: toX(AREA.east),
  miny: toY(AREA.south), maxy: toY(AREA.north),
};

/* ------------------------------------------------------------------ octree */

const hierCache = new Map();
async function hierarchy(key) {
  if (hierCache.has(key)) return hierCache.get(key);
  const res = await fetch(`${EPT}/ept-hierarchy/${key}.json`);
  if (!res.ok) throw new Error(`hierarchy ${key}: ${res.status}`);
  const json = await res.json();
  hierCache.set(key, json);
  return json;
}

/** Every populated octree node whose cube overlaps the area, at every depth. */
async function findTiles(bounds) {
  const size = bounds[3] - bounds[0];
  const nodeBox = (d, x, y) => {
    const s = size / 2 ** d;
    return {
      minx: bounds[0] + x * s, maxx: bounds[0] + (x + 1) * s,
      miny: bounds[1] + y * s, maxy: bounds[1] + (y + 1) * s,
    };
  };
  const overlaps = (a) =>
    !(a.maxx < BOX.minx || a.minx > BOX.maxx || a.maxy < BOX.miny || a.miny > BOX.maxy);

  const found = [];
  const walk = async (rootKey) => {
    const node = await hierarchy(rootKey);
    for (const [key, count] of Object.entries(node)) {
      const [d, x, y] = key.split("-").map(Number);
      if (!overlaps(nodeBox(d, x, y))) continue;
      // -1 means "this subtree continues in its own hierarchy file".
      if (count === -1) await walk(key);
      else if (count > 0) found.push(key);
    }
  };
  await walk("0-0-0-0");
  return found;
}

/* ------------------------------------------------------------------- LAZ */

/* The LAS public header block. laz-perf decodes point RECORDS but hands back
   raw scaled integers, so the scale and offset that turn them into real
   coordinates have to be read out of the header here. Offsets per the LAS 1.2+
   spec; classification moved from byte 15 to byte 16 in point formats 6+. */
function lasHeader(view) {
  return {
    format: view.getUint8(104),
    scale: [view.getFloat64(131, true), view.getFloat64(139, true), view.getFloat64(147, true)],
    offset: [view.getFloat64(155, true), view.getFloat64(163, true), view.getFloat64(171, true)],
  };
}

async function readTile(laz, key) {
  const res = await fetch(`${EPT}/ept-data/${key}.laz`);
  if (!res.ok) throw new Error(`tile ${key}: ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const head = lasHeader(new DataView(bytes.buffer));

  const filePtr = laz._malloc(bytes.byteLength);
  laz.HEAPU8.set(bytes, filePtr);
  const reader = new laz.LASZip();
  reader.open(filePtr, bytes.byteLength);

  const count = reader.getCount();
  const pointLength = reader.getPointLength();
  const classOffset = reader.getPointFormat() >= 6 ? 16 : 15;
  const pointPtr = laz._malloc(pointLength);

  const out = [];
  for (let i = 0; i < count; i++) {
    reader.getPoint(pointPtr);
    const p = new DataView(laz.HEAPU8.buffer, pointPtr, pointLength);
    const x = p.getInt32(0, true) * head.scale[0] + head.offset[0];
    const y = p.getInt32(4, true) * head.scale[1] + head.offset[1];
    if (x < BOX.minx || x > BOX.maxx || y < BOX.miny || y > BOX.maxy) continue;
    const z = p.getInt32(8, true) * head.scale[2] + head.offset[2];
    let cls = p.getUint8(classOffset);
    if (head.format < 6) cls &= 0x1f; // pre-1.4 packs flags into the top bits
    out.push([x, y, z, cls]);
  }

  reader.delete();
  laz._free(filePtr);
  laz._free(pointPtr);
  return out;
}

/* --------------------------------------------------------------- geometry */

const GROUND = 2;

function percentile(values, q) {
  if (!values.length) return null;
  const sorted = Float64Array.from(values).sort();
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
}

function pointInRing(px, py, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/* ------------------------------------------------------------------ build */

async function build() {
  const campus = JSON.parse(readFileSync(IN, "utf8"));
  const O = campus.origin;
  // local metres (the renderer's frame) <-> web mercator (the LiDAR's frame)
  const localToMerc = (x, z) => [toX(O.lng + x / O.mPerDegLng), toY(O.lat - z / O.mPerDegLat)];
  const mercToLocal = (mx, my) => [
    (toLng(mx) - O.lng) * O.mPerDegLng,
    -(toLat(my) - O.lat) * O.mPerDegLat,
  ];

  console.log("locating LiDAR tiles…");
  const ept = await (await fetch(`${EPT}/ept.json`)).json();
  const tiles = await findTiles(ept.bounds);
  console.log(`  ${tiles.length} tiles overlap the area`);

  const { createLazPerf } = require("laz-perf");
  const laz = await createLazPerf();

  let points = [];
  let done = 0;
  for (const key of tiles) {
    points = points.concat(await readTile(laz, key));
    if (++done % 10 === 0) process.stdout.write(`  ${done}/${tiles.length} tiles\r`);
  }
  console.log(`  ${points.length.toLocaleString()} points inside the area          `);

  const ground = points.filter((p) => p[3] === GROUND);
  const above = points.filter((p) => p[3] !== GROUND);
  console.log(`  ${ground.length.toLocaleString()} ground, ${above.length.toLocaleString()} above-ground`);

  /* ---- terrain: bare earth, as a grid in local metres ---- */
  const corners = [
    mercToLocal(BOX.minx, BOX.miny), mercToLocal(BOX.maxx, BOX.miny),
    mercToLocal(BOX.minx, BOX.maxy), mercToLocal(BOX.maxx, BOX.maxy),
  ];
  const x0 = Math.floor(Math.min(...corners.map((c) => c[0])));
  const x1 = Math.ceil(Math.max(...corners.map((c) => c[0])));
  const z0 = Math.floor(Math.min(...corners.map((c) => c[1])));
  const z1 = Math.ceil(Math.max(...corners.map((c) => c[1])));
  const cols = Math.ceil((x1 - x0) / TERRAIN_CELL) + 1;
  const rows = Math.ceil((z1 - z0) / TERRAIN_CELL) + 1;

  const sum = new Float64Array(cols * rows);
  const hits = new Uint32Array(cols * rows);
  for (const p of ground) {
    const [lx, lz] = mercToLocal(p[0], p[1]);
    const c = Math.round((lx - x0) / TERRAIN_CELL);
    const r = Math.round((lz - z0) / TERRAIN_CELL);
    if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
    sum[r * cols + c] += p[2];
    hits[r * cols + c]++;
  }
  const grid = new Float64Array(cols * rows).fill(NaN);
  for (let i = 0; i < grid.length; i++) if (hits[i]) grid[i] = sum[i] / hits[i];
  fillHoles(grid, cols, rows);

  /* Datum: the median ground height, so the renderer works near y=0 rather
     than 130 m up, where float precision starts to matter. */
  const datum = Math.round(percentile([...grid].filter(Number.isFinite), 0.5) * 10) / 10;

  /* ---- building heights: measured, per OSM footprint ---- */
  const groundAt = (lx, lz) => {
    const c = Math.round((lx - x0) / TERRAIN_CELL);
    const r = Math.round((lz - z0) / TERRAIN_CELL);
    if (c < 0 || c >= cols || r < 0 || r >= rows) return null;
    const v = grid[r * cols + c];
    return Number.isFinite(v) ? v : null;
  };

  const heights = {};
  const measured = [];
  for (const b of campus.buildings) {
    const ring = b.p.map(([x, z]) => localToMerc(x, z));
    const xs = ring.map((p) => p[0]);
    const ys = ring.map((p) => p[1]);
    const bb = { minx: Math.min(...xs), maxx: Math.max(...xs), miny: Math.min(...ys), maxy: Math.max(...ys) };
    if (bb.maxx < BOX.minx || bb.minx > BOX.maxx || bb.maxy < BOX.miny || bb.miny > BOX.maxy) continue;

    const roofs = [];
    for (const p of above) {
      if (p[0] < bb.minx || p[0] > bb.maxx || p[1] < bb.miny || p[1] > bb.maxy) continue;
      if (pointInRing(p[0], p[1], ring)) roofs.push(p[2]);
    }
    /* Too few returns to trust — a narrow building under tree cover, usually.
       Left out entirely so the renderer keeps its OSM value rather than
       adopting a number derived from nine points. */
    if (roofs.length < 25) continue;

    const [cx, cz] = mercToLocal((bb.minx + bb.maxx) / 2, (bb.miny + bb.maxy) / 2);
    const base = groundAt(cx, cz);
    if (base === null) continue;
    /* 98th percentile, not max: a single bird or a survey artefact should not
       add three metres to a building. */
    const roof = percentile(roofs, 0.98);
    const h = Math.round((roof - base) * 10) / 10;
    if (h < 2 || h > 70) continue;
    measured.push({ n: b.n, h, pts: roofs.length });
    if (b.n) heights[b.n] = h;
  }

  /* ---- trees: above-ground returns that stand outside every footprint ---- */
  const footprints = campus.buildings.map((b) => b.p.map(([x, z]) => localToMerc(x, z)));
  const canopy = new Map(); // grid cell -> max height above ground
  for (const p of above) {
    const [lx, lz] = mercToLocal(p[0], p[1]);
    const base = groundAt(lx, lz);
    if (base === null) continue;
    const h = p[2] - base;
    if (h < TREE_MIN_HEIGHT || h > 40) continue;
    if (footprints.some((ring) => pointInRing(p[0], p[1], ring))) continue;
    const key = `${Math.round(lx / TERRAIN_CELL)}:${Math.round(lz / TERRAIN_CELL)}`;
    const prev = canopy.get(key);
    if (!prev || h > prev.h) canopy.set(key, { x: lx, z: lz, h, base });
    else prev.n = (prev.n || 1) + 1;
  }
  const trees = clusterCanopy([...canopy.values()]);

  const out = {
    _: "Generated by scripts/build-campus-lidar.mjs from USGS 3DEP LiDAR (CA_SanDiegoQL2_2014, public domain). Do not hand-edit.",
    area: AREA,
    datum,
    terrain: {
      x0, z0, cell: TERRAIN_CELL, cols, rows,
      // decimetres relative to the datum, as integers — a third the size of
      // the same numbers written as floats, and precise to 10 cm.
      z: Array.from(grid, (v) => (Number.isFinite(v) ? Math.round((v - datum) * 10) : 0)),
    },
    heights,
    trees: trees.map((t) => [
      Math.round(t.x * 10) / 10,
      Math.round(t.z * 10) / 10,
      Math.round(t.h * 10) / 10,
      Math.round(t.r * 10) / 10,
    ]),
  };

  writeFileSync(OUT, JSON.stringify(out));
  const kb = Math.round(readFileSync(OUT).length / 1024);
  measured.sort((a, b) => b.h - a.h);
  console.log(`\nwrote ${OUT} — ${kb} KB`);
  console.log(`  datum ${datum} m · terrain ${cols}×${rows} @ ${TERRAIN_CELL} m`);
  console.log(`  ${Object.keys(heights).length} named buildings measured, ${trees.length} trees`);
  console.log(`  tallest: ${measured.slice(0, 5).map((m) => `${m.n} ${m.h}m`).join(", ")}`);
}

/* Nearest-neighbour hole fill. Ground returns are missing under buildings and
   dense canopy, and a NaN in the terrain grid becomes a hole you fall through.
   Iterative dilation rather than a proper interpolation because the gaps are
   small and the surface is nearly flat across them. */
function fillHoles(grid, cols, rows) {
  for (let pass = 0; pass < 64; pass++) {
    let filled = 0;
    const copy = Float64Array.from(grid);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (Number.isFinite(copy[i])) continue;
        let total = 0;
        let n = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const rr = r + dr;
            const cc = c + dc;
            if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) continue;
            const v = copy[rr * cols + cc];
            if (Number.isFinite(v)) { total += v; n++; }
          }
        }
        if (n) { grid[i] = total / n; filled++; }
      }
    }
    if (!filled) break;
  }
  // Anything still empty sits outside every ground return; flatten it.
  const fallback = percentile([...grid].filter(Number.isFinite), 0.5) ?? 0;
  for (let i = 0; i < grid.length; i++) if (!Number.isFinite(grid[i])) grid[i] = fallback;
}

/* Individual trees, by local maxima of the canopy height.
 *
 * The obvious approach — flood-fill the connected canopy and call each blob a
 * tree — is wrong here, and wrong in a way that looks absurd rather than
 * subtle. Campus vegetation is mostly continuous: the eucalyptus along Ridge
 * Walk touch crowns the whole way, so flood fill returned ONE tree with a
 * 47 metre crown, a green sphere the size of a stadium sitting over the path.
 * A row of trees that touch is still a row of trees.
 *
 * So a treetop is a cell that is the highest thing within TREE_SEPARATION of
 * itself, which is how individual tree detection is normally done on a canopy
 * height model. The crown is then sized from the distance to its neighbours,
 * so trees in a dense row get tight crowns and a lone tree on the plaza gets a
 * broad one. */
const TREE_SEPARATION = 6;   // metres; closer than this and it is one canopy
const MAX_CROWN = 8;         // no crown on this campus is wider than ~16 m

function clusterCanopy(cells) {
  const byKey = new Map();
  const key = (x, z) => `${Math.round(x / TERRAIN_CELL)}:${Math.round(z / TERRAIN_CELL)}`;
  for (const c of cells) byKey.set(key(c.x, c.z), c);

  const reach = Math.ceil(TREE_SEPARATION / TERRAIN_CELL);
  const tops = [];
  for (const [k, cell] of byKey) {
    const [gx, gz] = k.split(":").map(Number);
    let isTop = true;
    let supporters = 0;
    for (let dx = -reach; dx <= reach && isTop; dx++) {
      for (let dz = -reach; dz <= reach; dz++) {
        if (!dx && !dz) continue;
        const other = byKey.get(`${gx + dx}:${gz + dz}`);
        if (!other) continue;
        supporters++;
        /* Ties broken by key order so two equal cells cannot both win and
           produce a double trunk. */
        if (other.h > cell.h || (other.h === cell.h && `${gx + dx}:${gz + dz}` < k)) {
          isTop = false;
          break;
        }
      }
    }
    // A lone cell with nothing around it is more often a lamp post or a sign.
    if (isTop && supporters >= 1) tops.push(cell);
  }

  /* Crown radius from the gap to the nearest other treetop — half of it, so
     neighbouring crowns meet rather than interpenetrate. */
  return tops.map((t) => {
    let nearest = Infinity;
    for (const o of tops) {
      if (o === t) continue;
      const d = Math.hypot(o.x - t.x, o.z - t.z);
      if (d < nearest) nearest = d;
    }
    const r = Number.isFinite(nearest)
      ? Math.max(1.5, Math.min(MAX_CROWN, nearest / 2))
      : Math.min(MAX_CROWN, Math.max(2, t.h * 0.35));
    return { x: t.x, z: t.z, h: t.h, r };
  });
}

/* ------------------------------------------------------------------ check */

function check() {
  if (!existsSync(OUT)) { console.error("missing", OUT); process.exit(1); }
  const d = JSON.parse(readFileSync(OUT, "utf8"));
  const need = ["Argo Hall", "Blake Hall"];
  const missing = need.filter((n) => !d.heights[n]);
  if (missing.length) { console.error("no measured height for:", missing.join(", ")); process.exit(1); }
  if (d.terrain.z.length !== d.terrain.cols * d.terrain.rows) {
    console.error("terrain grid length does not match its dimensions"); process.exit(1);
  }
  console.log(
    `campus-lidar.json OK — ${Object.keys(d.heights).length} measured heights, ` +
    `${d.trees.length} trees, terrain ${d.terrain.cols}×${d.terrain.rows}`
  );
}

if (CHECK) check();
else build().catch((err) => { console.error(err.message); process.exit(1); });
