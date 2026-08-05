#!/usr/bin/env node
// Build docs/data/campus-lidar.json — measured campus geometry from aerial LiDAR.
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
import { treeExclusionZones, pruneTrees } from "./lib/tree-rules.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IN = path.join(REPO_ROOT, "docs/data/campus-3d.json");
const OUT = path.join(REPO_ROOT, "docs/data/campus-lidar.json");
const CHECK = process.argv.includes("--check");

const require = createRequire(path.join(REPO_ROOT, "package.json"));

const EPT = "https://s3-us-west-2.amazonaws.com/usgs-lidar-public/CA_SanDiegoQL2_2014";

/* The whole main campus, bounded by the roads that bound it: North Torrey
   Pines Road west, La Jolla Village Drive south, Genesee Avenue north-east,
   I-5 east. Same box as build-campus-3d.mjs — the terrain must exist under
   every footprint OSM delivers. ~50 million returns; the build streams them
   (see the fold() note) precisely because this box is 9x the old corridor. */
const AREA = { south: 32.8655, north: 32.8905, west: -117.2540, east: -117.2215 };

/* Terrain sample spacing, metres. The ground here moves by about 7 m over the
   whole walk, so this is not about hills — it is about the plaza sitting a step
   below the path beside it, which 3 m resolves and 10 m erases. */
const TERRAIN_CELL = 3;

/* A return this far above local ground, standing outside every footprint, is
   vegetation rather than a kerb or a parked car. */
const TREE_MIN_HEIGHT = 3.5;

/* THE EPOCH RULE, ENFORCED. The flight is from 2014; a footprint whose
   building went up after it still collects returns — from the trees, lots and
   older structures that stood there — and those "measurements" shipped whole
   neighbourhoods at bungalow height (NTPLLN, 2020, "measured" 6-10 m) or
   inflated a low pavilion to the height of the trees it replaced (The
   Jeannie, "18.2 m"). LiDAR must never claim to have measured a building
   that did not exist, so these names emit NO height and NO part heights;
   the renderer falls through to the OSM/GIS value. */
const POST_2014_SITES = new Set([
  // NTPLLN (2020) + neighbours
  "Mosaic", "Tapestry", "Catalyst", "The Jeannie", "Kaleidoscope",
  "Social Sciences Public Engagement Building", "Arts and Humanities",
  "Design & Innovation Building", "Franklin Antonio Hall",
  // Theatre District LLN (2023)
  "Pulse", "Sankofa", "Podemos", "Azad",
  // Pepper Canyon West (2023)
  "Rya", "Vela",
  // Ridge Walk North LLN / Eighth College (2023)
  "Alianza", "Umoja", "Coalition", "Malk Hall",
  // East Campus (2024)
  "Viterbi Family Vision Research Center",
  // Triton Center (still under construction 2026): the 2014 returns here are
  // off the DEMOLISHED predecessor block, which is the same lie twice over.
  "The Strauss", "Student Success Building",
  "Student Health and Well-Being Building", "Triton Alumni and Welcome Center",
  // Found by the 2026-08-04 gauntlet sweep: every name below shipped a 2014
  // "measurement" of the lot, predecessor or canopy that stood on its site.
  // Mesa Nueva graduate housing (opened 2017) — the flight saw the old Mesa
  // Residential Apartments block it replaced.
  "Ola", "Arena", "Artesa", "Cala", "Cresta", "Marea",
  // Nuevo West graduate housing (opened 2020) — Viento "measured" 22.9 m of
  // predecessor/canopy against the university's 36.6 m, 12-storey record.
  "Viento", "Brisa",
  // Athena Parking Structure (East Campus, opened 2019) — LiDAR 2.3 m is the
  // surface lot it replaced; the GIS carries the 7-level structure at 29.9 m.
  "Athena Parking Structure",
  // TDLLN's fifth building (2023) — its four siblings were already listed.
  "Survivance",
  // Tata Hall for the Sciences (opened 2018) — 19.5 m of pre-construction
  // returns are not a measurement of it.
  "Tata Hall for the Sciences",
  // Epstein Family Amphitheater (opened 2022) — the 17 m the laser saw is the
  // eucalyptus canopy cleared for it. (OSM tags the bowl building=no, so the
  // footprint itself no longer imports as a building either.)
  "Epstein Family Amphitheater",
  // The East Campus health buildout the flight caught mid-construction:
  // ACTRI (opened March 2016; the 28.6 m of 2014 returns are its topped-out
  // frame, not the building) and the Campus Point garage that went up with
  // the Jacobs Medical Center project.
  "Altman Clinical and Translational Research Institute",
  "Campus Point Parking Structure",
  // Found by the r0c1 sweep (2026-08-04): the 2014 annex west of RIMAC has
  // been demolished for a rebuild Apple shows as a tower crane over open
  // concrete decks. The 10.6 m the laser measured is a building that no
  // longer stands, and no source resolves the rising frame's height — the
  // site renders unbuilt (massing excluded in build-campus-arcgis.mjs, the
  // OSM ring skipped in campus-massing.js) until one can.
  "RIMAC Annex",
]);

/* GIS masses verified PRE-2014 by hand (r0c1 sweep, 2026-08-04) whose ring
   has neither a named-OSM host nor an exact OSM name twin — the two paths
   the epoch guard normally answers through. For each name below the build
   date is documented in the university's own record and Apple confirms the
   standing building matches the 2014 footprint, so the 2014 returns are a
   measurement of THIS building and its GIS record can be challenged like
   any other. Without this the records stood unchallenged and two were far
   off their measured planes (SDSC East Expansion: GIS 17.1 m, 2014 roof
   plane 23.2 m; Social Sciences Building: GIS 17.1 m, plane 21.0 m).
   Names must stay EXACT — a rename on the service side must fall back to
   unchallenged rather than smuggle the wrong site in. */
const PRE_2014_GIS_VERIFIED = new Set([
  "Social Sciences Building",              // 1995
  "San Diego Supercomputer East Expansion", // 2009
  "Seventh College East #5",               // The Village East, 2008-11
  "Seventh College East #6",               // The Village East, 2008-11
  "ERC Administration North",              // 2004
  "Robinson Building 1 - Administration",  // 1990 (GPS school complex)
  "Robinson Building 3 - Library",         // 1990 (GPS school complex)
  "Outback Adventures",                    // 1990s surf shack, standing today
]);

/* A facilities record that models a building as a whole-footprint ring PLUS
   a contained tower ring measures wrong either way: the whole ring's returns
   mix the tower plane into the low wings (Atkinson Hall: p50 13.9 under a
   p75 of 28.2), so the stepped-slab guard rightly withholds it — and the
   host fallback then pastes the 27.2 m OSM-ring measurement over the 14 m
   west pavilion. Measuring the ring MINUS its contained mass gives the low
   portion its own clean plane (p98 14.5, 16,642 returns) while the tower
   ring keeps measuring itself. Keyed by exact GIS mass names. */
const MEASURE_MINUS_CONTAINED = {
  "Atkinson Hall": ["Atkinson Hall Tower"],
};

/* UNNAMED OSM rings that render (no facilities mass covers them, no name to
   key lidar.heights) and are hand-verified UNCHANGED since the 2014 flight
   (Apple satellite, 2026-08-04) — so their 2014 roof plane may replace the
   OSM height guess. Keyed by index into campus-3d.json's buildings array,
   the same coupling partHeights already rides. Index-keyed rather than
   emitted wholesale because an unnamed ring has no name to look up in
   POST_2014_SITES: without a per-ring verification the laser could hand a
   post-2014 rebuild its predecessor's roof. Each entry cites what it is.
   786: The Village East community building (2008-11 buildout; OSM guessed
        9 m, the plane is 12.3). 893: the kiosk east of RIMAC's service
        court, standing on current Apple (OSM 4.5, plane 4.3). */
const OSM_UNNAMED_VERIFIED = new Set([786, 893]);

/* Hand-audited stats where the automatic roofOf() percentile choice is
   demonstrably wrong for a PRE-2014 building (verified against a targeted
   re-sample of the same EPT, 2026-08-03):
   - Tenaya Hall: tower roof plane p98 27.6 (max 28.0); roofOf's tree-guard
     took p75 = the low wing and shipped 22.4.
   - Mandeville Center: auditorium fly volume p98 20.9; p75 = the gallery
     roofs shipped 10.7.
   - Faculty Club: gable ridge ~6.5 at p90; p98 12.4 is overhanging
     eucalyptus, and the tree-guard's p75 4.6 misses the ridge.
   - Stewart Commons Annex: null — the 16 m stat was LiDAR bleed from the
     Tenaya tower over a 1-storey service sliver.
   - Stage Room at the Pub: the wooden Student Center pub sits UNDER the
     eucalyptus grove; more than a quarter of its returns are crown, so the
     tree-guard's p75 (12.8) is still in the tree. The roof is the dense p50
     band at 4.6 m, and the university GIS agrees (4.3 m, one level).
   A null here means "measured, but not trustworthy: emit nothing". */
const HAND_AUDITED = {
  "Tenaya Hall": 27.6,
  "Mandeville Center": 20.9,
  "Ida and Cecil Green Faculty Club": 6.5,
  "Stewart Commons Annex": null,
  "Stage Room at the Pub": 4.6,
};

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

  /* ---- terrain frame first: every point STREAMS into it ----
     The full campus is ~50 million returns. The corridor-era version held
     every point in one array and filtered it twice; at this scale that is
     gigabytes of JS arrays and an OOM at the end of a half-hour download.
     Nothing here actually needs the points twice — ground returns fold into
     the grid, above-ground returns fold into per-footprint roof lists and a
     per-cell canopy maximum, and the point is forgotten. */
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

  /* Measurement targets — every footprint AND every part of a multi-mass
     building — spatially hashed so each return tests only nearby rings. */
  const targets = [];
  const hostByIndex = new Map();
  const addTarget = (ringLocal, key, name) => {
    const ring = ringLocal.map(([x, z]) => localToMerc(x, z));
    const xs = ring.map((p) => p[0]);
    const ys = ring.map((p) => p[1]);
    const bb = {
      minx: Math.min(...xs), maxx: Math.max(...xs),
      miny: Math.min(...ys), maxy: Math.max(...ys),
    };
    if (bb.maxx < BOX.minx || bb.minx > BOX.maxx || bb.maxy < BOX.miny || bb.maxy > BOX.maxy) return null;
    const t = { key, name, ring, bb, roofs: [] };
    targets.push(t);
    return t;
  };
  campus.buildings.forEach((b, bi) => {
    const host = addTarget(b.p, `b${bi}`, b.n || null);
    if (host) { host.isHost = true; host.bi = bi; hostByIndex.set(bi, host); }
    (b.parts || []).forEach((part, pi) => {
      const t = addTarget(part.p, `${bi}/${pi}`, null);
      if (t) t.bi = bi;
    });
  });

  /* The university's massing parts are targets too, measured the way OSM
     parts are, so a mass inside a multi-height building ships ITS roof and
     not its host's. The Urey Hall Office Addition stood at the tower's
     30.5 m, the Natatorium at the Main Gym's 14.9, W. M. Keck at Biomedical
     Sciences' 24.1 — the same per-sample-quantity-resolved-once bug the
     RIMAC coverage metric had, this time over height. Keys are the geometry
     hashes campus-massing.js / build-campus-truecolor.mjs already use
     (`m:` + outer-ring vertex-average centroid, local metres, rounded), so
     the lookup survives an arcgis rebuild by falling back rather than
     mismatching. Epoch rule applies through the HOST: a mass standing in a
     POST_2014_SITES footprint gets nothing, ever; a hand-audited host keeps
     its audited value rather than a per-mass number the same misread would
     poison. */
  const arcgisData = (() => {
    try { return JSON.parse(readFileSync(path.join(REPO_ROOT, "docs/data/campus-arcgis.json"), "utf8")); } catch { return null; }
  })();
  const namedLocalRings = campus.buildings.filter((b) => b.n).map((b) => ({ n: b.n, p: b.p, bi: campus.buildings.indexOf(b) }));
  const inLocalRing = (x, z, ring) => {
    let ins = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, zi] = ring[i];
      const [xj, zj] = ring[j];
      if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
    }
    return ins;
  };
  /* A mass whose centroid falls OUTSIDE every named OSM ring still needs the
     epoch check answered before it can be measured — and for nine masses the
     GIS's own name answers it: it matches a shipped OSM building name
     exactly, so the same POST_2014/HAND_AUDITED guards key on it. Without
     this, the Sanford Consortium's low east pavilion wore the facility
     record's 17.1 m (its own 2014 roof plane: 6.2 m) purely because the GIS
     ring's centroid misses the OSM outline. The name must match EXACTLY and
     the OSM twin must stand within 150 m — a reused name across campus must
     never smuggle the wrong epoch verdict in. Masses with neither a host nor
     a matching name stay unchallenged, as before: with no name there is no
     way to know the site's build date, and a 2014 return off a newer
     building's predecessor is the exact lie the epoch rule exists to stop. */
  const namedByName = new Map(namedLocalRings.map((b) => {
    let x = 0, z = 0;
    for (const p of b.p) { x += p[0]; z += p[1]; }
    return [b.n, { ...b, c: [x / b.p.length, z / b.p.length] }];
  }));
  const massTargets = [];
  for (const m of arcgisData?.massing || []) {
    const ring = m.r[0].map(([x, z]) => [x / 10, z / 10]);
    let cx = 0, cz = 0;
    for (const p of ring) { cx += p[0]; cz += p[1]; }
    cx /= ring.length; cz /= ring.length;
    const host = namedLocalRings.find((b) => inLocalRing(cx, cz, b.p));
    let hostName = host?.n ?? null;
    if (!hostName) {
      const twin = namedByName.get(m.n);
      if (twin && Math.hypot(twin.c[0] - cx, twin.c[1] - cz) < 150) hostName = m.n;
    }
    /* epoch answered by the hand-verified build date instead of a host */
    if (!hostName && PRE_2014_GIS_VERIFIED.has(m.n)) hostName = m.n;
    if (!hostName) continue; // no named host: today's GIS value stands unchallenged
    if (POST_2014_SITES.has(hostName)) continue; // the flight predates the building
    if (hostName in HAND_AUDITED) continue; // the audited value already answers
    const t = addTarget(ring, `m:${Math.round(cx)},${Math.round(cz)}`, null);
    if (t) {
      t.isMass = true;
      t.bi = (host ?? namedByName.get(hostName))?.bi ?? -1;
      const minus = MEASURE_MINUS_CONTAINED[m.n];
      if (minus) {
        t.exclude = (arcgisData.massing || [])
          .filter((o) => o !== m && minus.includes(o.n))
          .map((o) => o.r[0].map(([x, z]) => localToMerc(x / 10, z / 10)));
      }
      massTargets.push(t);
    }
  }
  const HCELL = 60; // mercator metres per hash cell
  const hcell = new Map();
  for (const t of targets) {
    for (let hx = Math.floor(t.bb.minx / HCELL); hx <= Math.floor(t.bb.maxx / HCELL); hx++) {
      for (let hy = Math.floor(t.bb.miny / HCELL); hy <= Math.floor(t.bb.maxy / HCELL); hy++) {
        const k = `${hx}:${hy}`;
        if (!hcell.has(k)) hcell.set(k, []);
        hcell.get(k).push(t);
      }
    }
  }

  /* Canopy: the highest above-ground return per 3 m cell, as ABSOLUTE
     elevation — ground is only knowable after the whole grid exists. */
  const canopyMax = new Map();

  let groundN = 0;
  let aboveN = 0;
  const fold = (pts) => {
    for (const p of pts) {
      if (p[3] === GROUND) {
        groundN++;
        const [lx, lz] = mercToLocal(p[0], p[1]);
        const c = Math.round((lx - x0) / TERRAIN_CELL);
        const r = Math.round((lz - z0) / TERRAIN_CELL);
        if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
        sum[r * cols + c] += p[2];
        hits[r * cols + c]++;
      } else {
        aboveN++;
        const bucket = hcell.get(`${Math.floor(p[0] / HCELL)}:${Math.floor(p[1] / HCELL)}`);
        if (bucket) {
          for (const t of bucket) {
            if (p[0] < t.bb.minx || p[0] > t.bb.maxx || p[1] < t.bb.miny || p[1] > t.bb.maxy) continue;
            if (!pointInRing(p[0], p[1], t.ring)) continue;
            if (t.exclude && t.exclude.some((r) => pointInRing(p[0], p[1], r))) continue;
            t.roofs.push(p[2]);
          }
        }
        const [lx, lz] = mercToLocal(p[0], p[1]);
        const k = `${Math.round(lx / TERRAIN_CELL)}:${Math.round(lz / TERRAIN_CELL)}`;
        const prev = canopyMax.get(k);
        if (!prev || p[2] > prev.zmax) canopyMax.set(k, { x: lx, z: lz, zmax: p[2] });
      }
    }
  };

  /* Six tiles in flight: the fetch dominates and parallelises; the decode is
     synchronous WASM with no await inside it, so decodes cannot interleave. */
  let cursor = 0;
  let done = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (cursor < tiles.length) {
      const key = tiles[cursor++];
      fold(await readTile(laz, key));
      if (++done % 25 === 0) process.stdout.write(`  ${done}/${tiles.length} tiles\r`);
    }
  }));
  console.log(`  ${groundN.toLocaleString()} ground, ${aboveN.toLocaleString()} above-ground          `);

  const grid = new Float64Array(cols * rows).fill(NaN);
  for (let i = 0; i < grid.length; i++) if (hits[i]) grid[i] = sum[i] / hits[i];
  fillHoles(grid, cols, rows);

  /* Datum: the median ground height, so the renderer works near y=0 rather
     than 130 m up, where float precision starts to matter. */
  const datum = Math.round(percentile([...grid].filter(Number.isFinite), 0.5) * 10) / 10;

  /* ---- heights: measured, per footprint and per part ---- */
  const groundAt = (lx, lz) => {
    const c = Math.round((lx - x0) / TERRAIN_CELL);
    const r = Math.round((lz - z0) / TERRAIN_CELL);
    if (c < 0 || c >= cols || r < 0 || r >= rows) return null;
    const v = grid[r * cols + c];
    return Number.isFinite(v) ? v : null;
  };

  /* Grade is read around the PERIMETER, never under the roof. The laser
     cannot see ground beneath a building, so the cell under the centroid is
     hole-fill — an average of whatever surrounds the footprint, which beside
     a canyon is the canyon. Geisel measured "40.3 m" exactly this way: its
     real roof minus a grade 14 m below its real forecourt, borrowed from the
     ravine to its north. */
  const rimBase = (ring) => {
    const rim = [];
    for (const [mx, my] of ring) {
      const [lx, lz] = mercToLocal(mx, my);
      const g = groundAt(lx, lz);
      if (g !== null) rim.push(g);
    }
    return rim.length ? percentile(rim, 0.5) : null;
  };

  /* 98th percentile, not max: a single bird should not add three metres.
     BUT a roof is a PLANE and a tree is a TAIL — when a eucalyptus overhangs
     a low building the returns split into a dense band at the real roof and
     a sparse tail up the crown, and the 98th lands in the tree (the
     one-storey wooden Student Center "measured" 23.5 m this way). When the
     75th and 98th disagree by more than a storey and a half, the roof plane
     is the honest answer. */
  const roofOf = (roofs) => {
    const p98 = percentile(roofs, 0.98);
    const p75 = percentile(roofs, 0.75);
    return p98 - p75 > 5 ? p75 : p98;
  };

  const heights = {};
  const partHeights = {};
  const osmHeights = {};
  const measured = [];
  const baseByBuilding = new Map();
  for (const t of targets) {
    if (!t.isHost) continue;
    /* Too few returns to trust — a narrow building under tree cover,
       usually. Left out entirely so the renderer keeps its OSM value rather
       than adopting a number derived from nine points. */
    if (t.roofs.length < 25) continue;
    const base = rimBase(t.ring);
    if (base === null) continue;
    baseByBuilding.set(t.bi, base);
    const h = Math.round((roofOf(t.roofs) - base) * 10) / 10;
    /* Cap raised from 70: Sankofa, the Eighth College tower, really is ~80 m
       and the old cap silently dropped the tallest building on campus. */
    if (h < 2 || h > 90) continue;
    measured.push({ n: t.name, h, pts: t.roofs.length });
    if (!t.name) {
      const bi = Number(t.key.slice(1));
      if (OSM_UNNAMED_VERIFIED.has(bi)) osmHeights[bi] = h;
      continue;
    }
    if (POST_2014_SITES.has(t.name)) continue; // building postdates the flight
    if (t.name in HAND_AUDITED) {
      if (HAND_AUDITED[t.name] !== null) heights[t.name] = HAND_AUDITED[t.name];
      continue;
    }
    heights[t.name] = h;
  }
  /* Parts share their host's grade — a tower wing and its podium stand on
     the same ground even when the wing's own perimeter is all rooftop. */
  for (const t of targets) {
    if (t.isHost || t.isMass || t.roofs.length < 12) continue;
    const hostName = campus.buildings[t.bi]?.n;
    if (hostName && POST_2014_SITES.has(hostName)) continue; // same epoch rule
    const base = baseByBuilding.get(t.bi) ?? rimBase(t.ring);
    if (base === null) continue;
    const h = Math.round((roofOf(t.roofs) - base) * 10) / 10;
    if (h < 2 || h > 90) continue;
    partHeights[t.key] = h;
  }
  /* University massing parts, same treatment (epoch and hand-audit hosts were
     already excluded when the target was made). 25-return floor as for hosts:
     a mass sliver measured off nine points is a guess wearing a number.
     Base is the mass's OWN rim, not its host's: the terrain grid is ground
     returns only (hole-filled under roofs, never rooftop), so a mass rim is
     always a sane local grade — while a host-wide median smears a complex's
     slope onto every mass in it. Eckart Building drops 15.6 m across its SIO
     bluff site and its host median sits 7.6 m above the mass's own grade;
     Tuolumne's T House East gained 2.6 m the same way.

     Unlike hosts, a mass only gets a height when its roof reads as ONE plane.
     roofOf's canopy guard (p98−p75 > 5) fires on two very different shapes:
     a tight low roof under a tall neighbour's edge returns (Medical Teaching
     Facility's 8.3 m wing beside its 19.7 m block — p75 is the roof, keep it)
     and a genuinely stepped slab with no plane anywhere near p75 (Urey Hall's
     main mass: half its returns on ~16 m steps, crown at 30.4 — p75 lands at
     25.4 m, a roof that does not exist). The discriminator is the body: if
     p75−p50 ≤ 2 m the fallback sits on a real plane; if the body is smeared
     wider, emit nothing and let the host-level reconcile answer instead. */
  const massHeights = {};
  for (const t of massTargets) {
    if (t.roofs.length < 25) continue;
    const base = rimBase(t.ring);
    if (base === null) continue;
    const p50 = percentile(t.roofs, 0.5);
    const p75 = percentile(t.roofs, 0.75);
    const p98 = percentile(t.roofs, 0.98);
    let roof;
    if (p98 - p75 > 5) {
      if (p75 - p50 > 2) continue; // stepped slab: no single plane to report
      roof = p75;
    } else {
      roof = p98;
    }
    const h = Math.round((roof - base) * 10) / 10;
    if (h < 2 || h > 90) continue;
    massHeights[t.key] = h;
  }

  /* ---- trees: canopy maxima that stand outside every footprint ---- */
  const canopy = [];
  for (const { x: lx, z: lz, zmax } of canopyMax.values()) {
    const g = groundAt(lx, lz);
    if (g === null) continue;
    const h = zmax - g;
    if (h < TREE_MIN_HEIGHT || h > 40) continue;
    const [mx, my] = localToMerc(lx, lz);
    const bucket = hcell.get(`${Math.floor(mx / HCELL)}:${Math.floor(my / HCELL)}`);
    if (bucket && bucket.some((t) => t.isHost && pointInRing(mx, my, t.ring))) continue;
    canopy.push({ x: lx, z: lz, h });
  }
  /* 2014 canopies pruned against TODAY's campus (shared rules with
     scripts/prune-trees.mjs and the tests): no trunk in a current footprint,
     on a sports pad or in a fountain, heights clamped to believable maxima.
     The imagery ghost-check (pass 2) needs sharp — run scripts/prune-trees.mjs
     after this build to apply it. */
  const loadData = (f) => {
    try { return JSON.parse(readFileSync(path.join(REPO_ROOT, "docs/data", f))); } catch { return null; }
  };
  const zones = treeExclusionZones({
    campus3d: loadData("campus-3d.json"),
    arcgis: loadData("campus-arcgis.json"),
    markings: loadData("campus-markings.json"),
  });
  const pruned = pruneTrees(clusterCanopy(canopy).map((t) => [t.x, t.z, t.h, t.r]), zones);
  console.log(`  tree prune: ${pruned.dropped.length} dropped against today's zones`);
  const trees = pruned.kept.map(([x, z, h, r]) => ({ x, z, h, r }));

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
    partHeights,
    massHeights,
    osmHeights,
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
  console.log(`  ${Object.keys(heights).length} named buildings measured, ${Object.keys(massHeights).length} massing parts, ${trees.length} trees`);
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
