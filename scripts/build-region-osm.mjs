#!/usr/bin/env node
// Build docs/data/region-osm.json — the built world outside the campus box.
//
// WHY THIS EXISTS. build-region-terrain.mjs gave the expansion its LAND: the
// Torrey Pines bluff, Rose Canyon, the freeway embankments, the beach. Land is
// only half of what you see from Ridge Walk. Look west and there are houses on
// the bluff; look east and there is University City, which is a skyline. A
// measured 30 km² of bare ground with nothing standing on it does not read as
// "the land around the campus" — it reads as a golf course.
//
// So this is the same pull build-campus-3d.mjs does, over the region instead of
// the core: OpenStreetMap via Overpass, ODbL, footprints and the road network
// and the water. Same source as the campus for the same reason it was chosen
// there — a house on the regional side of the seam and a lecture hall on the
// campus side are drawn from one map, so the two halves of the world can never
// quietly disagree about where a kerb is.
//
// WHAT THIS FILE DELIBERATELY DOES NOT OWN. Everything whose centroid sits in
// the campus core box belongs to campus-3d.json, which has had two years of
// hand-audits, LiDAR measurement and epoch corrections poured into it. Shipping
// a second, unaudited copy of those footprints would not add a building; it
// would add a z-fighting duplicate of every building that matters most.
//
// THE HEIGHT PROBLEM, WHICH IS THE WHOLE INTERESTING PART OF THIS SCRIPT.
// build-campus-3d.mjs ends with an area→height ladder whose comment reasons
// that "above roughly 400 m² this campus has essentially no single-storey
// buildings". That is a fact about a university, and out here it fails — but
// NOT in the direction anyone expected. The campus ladder's real error in this
// region is at the BOTTOM: it calls anything under 400 m² a 4.5 m shed, and
// under 400 m² in La Jolla is a two-storey townhouse that measures 7.2 m. Three
// thousand buildings, a storey each. The prediction was the opposite, which is
// the entire argument for calibrating instead of reasoning: the ladder below is
// derived from this region's own 2014 LiDAR roof measurements by `--calibrate`,
// and the table it printed is reproduced in the comment above it.
//
// WHERE THE HEIGHTS ACTUALLY LIVE. This file carries only what OSM says or what
// the ladder guessed — `src` is always one of levels / height / area. The 4,666
// measured roofs live in docs/data/region-heights.json, a sidecar keyed by index
// into this file's `buildings`, and they are deliberately not merged in: this
// file is regenerated from Overpass and a merge would erase an hour of LiDAR
// streaming on the next pull. A renderer that wants measurements joins the
// sidecar; one that does not gets honest, clearly-marked guesses.
//
// Usage:
//   node scripts/build-region-osm.mjs              # fetch + write
//   node scripts/build-region-osm.mjs --calibrate  # show the height calibration
//   node scripts/build-region-osm.mjs --check      # verify the shipped file
//
// --calibrate and a plain build both reuse .cache/region-overpass.json when it
// exists, because the calibration and the ladder it feeds have to be derived
// from, and then applied to, the SAME pull. Two pulls a day apart would let the
// shipped constants describe a dataset that is not the shipped dataset.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REGION = path.join(REPO_ROOT, "docs/data/region.json");
const CAMPUS = path.join(REPO_ROOT, "docs/data/campus-3d.json");
const OUT = path.join(REPO_ROOT, "docs/data/region-osm.json");
/* Read, never written, by this script — see THE BOOTSTRAP note above
   AREA_LADDER. The ladder is calibrated against these measurements; the
   measurements themselves stay in their own file so a rebuild here cannot
   destroy an hour of LiDAR streaming. */
const HEIGHTS = path.join(REPO_ROOT, "docs/data/region-heights.json");
const CACHE = path.join(REPO_ROOT, ".cache/region-overpass.json");

const CALIBRATE = process.argv.includes("--calibrate");
const CHECK = process.argv.includes("--check");
const REFETCH = process.argv.includes("--refetch");

/* Same three mirrors, same two-pass retry, and for the same reason: Overpass is
   free and shared and answers 504 on a bad afternoon. This query is ~6x the
   area of the campus one, so it fails more often, not less. */
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

/* Buildings this small are sheds, carports and pool equipment enclosures.
   Same 60 m² floor as the campus — the number is not re-derived because the
   question it answers ("is this a structure or is it furniture?") does not
   change when you cross La Jolla Village Drive. */
export const MIN_FOOTPRINT_M2 = 60;

/* The eight road classes the renderer knows how to draw, and the OSM highway
   values that fold into each. Anything not listed is not a road anyone sees
   from a walk — driveways tagged `track`, abandoned rail beds, ferry routes.
   The `_link` ramps fold into their parent class: a motorway ramp is drawn as
   motorway, which is what it looks like from the bluff. `footway`, `steps` and
   `cycleway` fold into `path` because at regional scale the distinction between
   a sidewalk and a trail is below the width of the line drawn for either. */
export const ROAD_KINDS = new Map([
  ["motorway", "motorway"], ["motorway_link", "motorway"],
  ["trunk", "trunk"], ["trunk_link", "trunk"],
  ["primary", "primary"], ["primary_link", "primary"],
  ["secondary", "secondary"], ["secondary_link", "secondary"],
  ["tertiary", "tertiary"], ["tertiary_link", "tertiary"],
  ["residential", "residential"], ["unclassified", "residential"],
  ["living_street", "residential"],
  ["service", "service"],
  ["path", "path"], ["footway", "path"], ["cycleway", "path"], ["steps", "path"],
  ["pedestrian", "path"], ["track", "path"],
]);

/* ------------------------------------------------------------ calibration */

/* STOREY HEIGHT, MEASURED — not the campus's 3.6 m, and not derived from tags.
 *
 * The obvious population for this question is the buildings carrying BOTH
 * `height` and `building:levels`, since those two tags answer it directly.
 * THAT POPULATION IS THIRTEEN BUILDINGS in this region. Thirteen is not a
 * calibration, and a constant fitted to thirteen points and then applied to
 * five thousand buildings would be a guess wearing a table.
 *
 * So the storey height is measured against LiDAR instead. Of the 230 buildings
 * whose height came from a `building:levels` tag, 215 also carry a 2014 roof
 * measurement from build-region-heights.mjs — which turns "how tall is a storey
 * here" into a regression with a real sample behind it:
 *
 *     levels    n     median measured h    implied m/storey
 *        1      3         9.3                  9.30   (too few, and see below)
 *        2    143         8.2                  4.10
 *        3     48        11.0                  3.67
 *        4      6        15.3                  3.83
 *        5      4        16.6                  3.32
 *       7-20   11        22.5 - 69.0           3.2 - 4.6
 *
 * Sweeping (m, c) for the lowest MEDIAN ABSOLUTE error over all 215 — median
 * rather than mean because a handful of buildings are mis-tagged and a squared
 * loss would chase them — lands on h = 3.4 * levels + 1.05, at 0.65 m median
 * error. The campus's 3.6 * levels + 1.2 gives 1.00 m over the same buildings;
 * a flat 3.0 m/storey with no ground-floor term gives 2.20 m.
 *
 * The 1-storey row is left out of the fit ON PURPOSE and it is worth saying why
 * rather than quietly dropping it: three buildings tagged one storey measure a
 * median 9.3 m, which is not a one-storey building. Either the tag is wrong or
 * the laser found a tree over the roof. Three points cannot tell us which, and
 * a row we cannot explain does not get a vote.
 */
export const STOREY_M = 3.4;
export const GROUND_FLOOR_EXTRA_M = 1.05;

/* THE AREA LADDER, CALIBRATED ON THIS REGION'S OWN MEASURED ROOFS.
 *
 * `--calibrate` buckets the 4,666 buildings that carry a 2014 LiDAR roof
 * measurement by footprint area and takes each band's median. Beside it, the
 * same bands computed from the 256 buildings that carry an OSM `height` or
 * `building:levels` tag — a completely independent source — and what the campus
 * ladder in build-campus-3d.mjs would have said:
 *
 *     area (m²)      lidar n   median   p25    p75  |  tag n  median | campus
 *     < 400            3,044     7.2    5.4    8.4  |   123    7.9   |   4.5
 *     400 – 1200       1,286     8.1    6.5    9.9  |    71    9.0   |   9.0
 *     1200 – 3000        228    10.2    7.8   14.5  |    45   18.1   |  12.0
 *     >= 3000            108    11.7    9.2   15.6  |    17   11.3   |  20.0
 *
 * FIVE THINGS TO READ OUT OF THAT TABLE.
 *
 * FIRST, the two lower bands are CORROBORATED. Two sources sharing no mechanism
 * — a laser in 2014 and a volunteer typing a storey count — agree to within 0.7
 * and 0.9 m over 4,330 buildings. That agreement is the reason to trust the
 * bottom of this ladder, which is where almost every building out here lives.
 *
 * SECOND, the campus's < 400 m² rung of 4.5 m is far too SHORT here, and its
 * 400 m² rung of 9 m is nearly right — the opposite of what was expected. The
 * campus comment reasons that "above roughly 400 m² this campus has essentially
 * no single-storey buildings", which frames small as short. In La Jolla and
 * University City small means a two-storey townhouse on a tight plan, and the
 * median under 400 m² measures 7.2 m. Reusing the campus ladder would have
 * flattened three thousand of them to 4.5 m — a whole storey lost across the
 * most numerous building in the region. This is the error the calibration
 * exists to prevent; it is simply not the one that was predicted, which is the
 * argument for calibrating rather than reasoning about it.
 *
 * THIRD, area is a WEAK predictor here and the ladder should say so. Across a
 * sixty-fold range of footprint area the median height moves 7.2 m to 11.7 m.
 * A 12,000 m² footprint in University City is usually a big-box store — one
 * storey over an enormous plan — and only sometimes an office block, and no
 * area rule can tell those apart. That is why build-region-heights.mjs exists,
 * why 84% of these buildings end up measured instead, and why every height from
 * this ladder is marked `src: "area"` so nobody mistakes it for one.
 *
 * FOURTH, the bands are WIDER than the ones first tried, because the finer ones
 * had nothing to say. Split at 200 m² the data reads 7.3 and 7.2 over 3,044
 * buildings: not a signal, two names for one number. Above 3,000 m² the measured
 * medians ran 11.9 / 9.6 / 13.4 over n = 76 / 27 / 5 — NON-MONOTONIC, which is
 * real (the dip is retail) but is being asserted by twenty-seven buildings. A
 * rung that thin is noise with a decimal point on it, so those bands are
 * collapsed. Where the data cannot distinguish two bands, this ships one.
 *
 * FIFTH, medians, never means: a handful of University City towers drag every
 * mean upward, and the job of this ladder is the typical building.
 *
 * THE BOOTSTRAP, stated because it looks circular and is not. This ladder is
 * calibrated on measurements that come from a file built FROM this one. The
 * loop runs once and terminates: pass 1 ships footprints under a provisional
 * ladder, build-region-heights.mjs measures those footprints, the ladder is
 * recalibrated here, and pass 2 rewrites the file. Pass 2 changes only `h` and
 * `src` — never a coordinate — so the sidecar's footprint fingerprint is
 * unchanged and every measurement stays joined to the building it measured.
 * That invariance is what makes the loop safe, and the tests pin it.
 *
 * ONE LIMITATION, stated rather than hidden: the ladder is calibrated on the
 * buildings that COULD be measured (median area 314 m²) and applied to the 885
 * that could not (median area 232 m²). The unmeasured skew small, so they fall
 * mostly into the < 400 m² rung where the calibration is strongest — but they
 * are not a random sample of the region, and this rung is a weaker claim about
 * them than about the buildings it was fitted to.
 */
export const AREA_LADDER = [
  [3000, 11.7],
  [1200, 10.2],
  [400, 8.1],
  [0, 7.2],
];

/**
 * The rung a footprint of this area lands on.
 *
 * The ladder is written largest-first for readability, and three separate
 * places used to depend on that ordering by walking it with `.find()`. That is
 * an invisible coupling: reordering the array for tidiness would silently
 * assign every building the wrong rung, and nothing about the array says so.
 * Sorting here removes the dependency instead of documenting it.
 */
const LADDER_DESC = [...AREA_LADDER].sort((a, b) => b[0] - a[0]);
export function rungFor(area) {
  for (const [minArea, h] of LADDER_DESC) if (area >= minArea) return h;
  return LADDER_DESC[LADDER_DESC.length - 1][1];
}

/* The calibration constants above are DERIVED, so they must be re-derivable.
   `--calibrate` recomputes them from the cached pull and this tolerance is what
   "still true" means; tests/region-osm.test.mjs runs the same comparison
   against the shipped file. 0.35 m is roughly a third of the SMALLEST step on
   the ladder (7.2 -> 8.1) — tight enough that a real shift in the population
   trips it, loose enough that the median moving one building does not. */
export const CALIBRATION_TOL_M = 0.35;

/* Above this, a `height` tag is a mapping error rather than a building.
   Measured: the tallest 2014 roof in this region is 73.0 m and the tallest
   OSM-tagged building is Palisade UTC at 75.9 m, both University City towers.
   So 90 m sits comfortably above everything real and is a guard against a
   stray 999, not a second opinion about architecture. Same number as the
   campus builder uses, where it exists for Sankofa. */
export const MAX_HEIGHT_M = 90;

/* ------------------------------------------------------------- geometry */

const round1 = (n) => Math.round(n * 10) / 10;

/** Even-odd point-in-ring, on already-projected local metres. */
function pointInRing(px, pz, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if (zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** Shoelace area, m², on a projected ring. */
function areaOf(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return Math.abs(a / 2);
}

function centroidOf(ring) {
  let x = 0;
  let z = 0;
  for (const p of ring) { x += p[0]; z += p[1]; }
  return [round1(x / ring.length), round1(z / ring.length)];
}

/* Stitch a multipolygon relation's outer members into closed rings.
   Lifted in shape from build-campus-3d.mjs, and it is here for exactly the
   reason its comment records: OSM maps a building as a RELATION whenever it has
   a courtyard or was drawn from several ways, and a ways-only pull ships those
   as empty lawns. The campus box held 27 of them. This box holds far more —
   every apartment courtyard in University City and every shopping centre. */
function stitchOuters(members, project) {
  const key = (pt) => `${pt[0]},${pt[1]}`;
  const segs = members
    .filter((m) => m.role === "outer" && m.geometry?.length >= 2)
    .map((m) => m.geometry.map((g) => project(g.lat, g.lon)));
  const rings = [];
  while (segs.length) {
    let ring = segs.shift();
    let guard = 0;
    while (key(ring[0]) !== key(ring[ring.length - 1]) && guard++ < 400) {
      const end = key(ring[ring.length - 1]);
      const idx = segs.findIndex((s) => key(s[0]) === end || key(s[s.length - 1]) === end);
      if (idx === -1) break;
      const s = segs.splice(idx, 1)[0];
      ring = ring.concat((key(s[0]) === end ? s : s.slice().reverse()).slice(1));
    }
    if (key(ring[0]) === key(ring[ring.length - 1]) && ring.length >= 4) rings.push(ring.slice(0, -1));
  }
  return rings;
}

/**
 * Split a polyline into the runs that are IN SCOPE.
 *
 * In scope means inside the region outline and outside the campus core box. A
 * freeway enters the outline, crosses the campus box and leaves again, and it
 * has to arrive as two separate polylines or the renderer draws a straight line
 * through the middle of the campus.
 *
 * THE APPROXIMATION, STATED. This clips at VERTICES, not at true intersections
 * — a run ends at the last node inside and resumes at the first node inside,
 * so the road stops up to one node-spacing short of the boundary. That is
 * honest here and would not be elsewhere: OSM road geometry in this region has
 * a node every few tens of metres, and the outline it is being clipped against
 * is a freehand trace with a stated ±247 m georeference error. Computing exact
 * intersections against a boundary that is itself approximate to 247 m would be
 * precision theatre. The CORE box is exact, but the campus network stops at the
 * same box, so a few metres of gap at that seam is a gap between two things
 * that were never joined anyway.
 */
function clipRuns(pts, inScope) {
  const runs = [];
  let cur = [];
  for (const p of pts) {
    if (inScope(p[0], p[1])) cur.push(p);
    else if (cur.length) { if (cur.length >= 2) runs.push(cur); cur = []; }
  }
  if (cur.length >= 2) runs.push(cur);
  return runs;
}

/* ------------------------------------------------------------- fetching */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function queryFor(bbox) {
  const b = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  /* Tag filter before the bounding box, per the campus builder's hard-won
     note: Overpass answers 406 rather than a syntax error the other way round.
     Timeout 600 rather than 180 — this is six times the area and the buildings
     alone are two orders of magnitude more elements. */
  return `[out:json][timeout:600];
(
  way["building"](${b});
  relation["building"](${b});
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street|service|path|footway|cycleway|steps|pedestrian|track)(_link)?$"](${b});
  way["natural"="water"](${b});
  relation["natural"="water"](${b});
  way["natural"="coastline"](${b});
);
out geom;`;
}

async function fetchOnce(bbox) {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const endpoint of ENDPOINTS) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "User-Agent": "3d-modeling-campus region-osm build (github.com/SahirSSharma)" },
          body: new URLSearchParams({ data: queryFor(bbox) }),
        });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const json = await res.json();
        if (!json.elements?.length) throw new Error("no elements");
        console.log(`  via ${new URL(endpoint).host}: ${json.elements.length} elements`);
        return json.elements;
      } catch (err) {
        lastErr = err;
        console.log(`  ${new URL(endpoint).host}: ${err.message}`);
        await sleep(3000 + attempt * 12000);
      }
    }
  }
  throw lastErr;
}

/**
 * Fetch the region, splitting the box when a mirror cannot answer it whole.
 *
 * The campus query is one 8 km² box and every mirror answers it. This one is
 * 52.7 km² of dense suburb and the mirrors time out on it often enough that a
 * retry loop alone is not a strategy — a query that is too big is too big on
 * every mirror and on every attempt. Quartering it turns one impossible request
 * into four merely large ones.
 *
 * Elements are deduplicated by id. Overpass returns a way in full whenever ANY
 * of its nodes falls in the box, so a road crossing a quarter boundary comes
 * back complete from both quarters rather than cut in half by the split — which
 * is the property that makes splitting safe at all.
 */
async function fetchOverpass(bbox, depth = 0) {
  const label = `[${bbox.south.toFixed(4)},${bbox.west.toFixed(4)} → ${bbox.north.toFixed(4)},${bbox.east.toFixed(4)}]`;
  try {
    console.log(`fetching ${label}${depth ? ` (split level ${depth})` : ""}…`);
    return await fetchOnce(bbox);
  } catch (err) {
    if (depth >= 2) throw new Error(`every mirror failed on ${label} — last: ${err.message}`);
    console.log(`  ${label} too large or unavailable; splitting`);
    const mLat = (bbox.south + bbox.north) / 2;
    const mLng = (bbox.west + bbox.east) / 2;
    const quarters = [
      { south: bbox.south, north: mLat, west: bbox.west, east: mLng },
      { south: bbox.south, north: mLat, west: mLng, east: bbox.east },
      { south: mLat, north: bbox.north, west: bbox.west, east: mLng },
      { south: mLat, north: bbox.north, west: mLng, east: bbox.east },
    ];
    const seen = new Map();
    for (const q of quarters) {
      for (const el of await fetchOverpass(q, depth + 1)) seen.set(`${el.type}/${el.id}`, el);
    }
    return [...seen.values()];
  }
}

async function loadElements() {
  if (!REFETCH && existsSync(CACHE)) {
    const els = JSON.parse(readFileSync(CACHE, "utf8"));
    console.log(`using cached Overpass pull — ${els.length.toLocaleString()} elements (--refetch to replace)`);
    return els;
  }
  const region = JSON.parse(readFileSync(REGION, "utf8"));
  const elements = await fetchOverpass(region.region.bbox);
  mkdirSync(path.dirname(CACHE), { recursive: true });
  writeFileSync(CACHE, JSON.stringify(elements));
  console.log(`cached ${elements.length.toLocaleString()} elements to .cache/region-overpass.json`);
  return elements;
}

/* --------------------------------------------------------------- frames */

function loadFrames() {
  const region = JSON.parse(readFileSync(REGION, "utf8"));
  const campus = JSON.parse(readFileSync(CAMPUS, "utf8"));
  const O = region.origin;

  /* The origin is not merely "the same numbers" — it must be THE campus origin,
     because every coordinate in this file is going to be drawn in the same
     scene as campus-3d.json. If these ever drift, the whole regional world
     translates relative to the campus and the seam tears. Cheap to check, and
     a silent tear is expensive to find. */
  for (const k of ["lat", "lng", "mPerDegLat", "mPerDegLng"]) {
    if (O[k] !== campus.origin[k]) {
      throw new Error(`origin.${k} disagrees with campus-3d.json (${O[k]} vs ${campus.origin[k]})`);
    }
  }

  /* Three.js convention, identical to build-campus-3d.mjs: +x east, -z north. */
  const project = (lat, lng) => [
    round1((lng - O.lng) * O.mPerDegLng),
    round1(-(lat - O.lat) * O.mPerDegLat),
  ];

  const poly = region.polygon.local;
  const xs = poly.map(([x]) => x);
  const zs = poly.map(([, z]) => z);
  const polyBB = {
    x0: Math.min(...xs), x1: Math.max(...xs),
    z0: Math.min(...zs), z1: Math.max(...zs),
  };
  const inPolygon = (x, z) =>
    x >= polyBB.x0 && x <= polyBB.x1 && z >= polyBB.z0 && z <= polyBB.z1 && pointInRing(x, z, poly);

  /* The core box arrives in degrees; every test against it happens in metres. */
  const c = region.core;
  const [coreW, coreN] = project(c.north, c.west);
  const [coreE, coreS] = project(c.south, c.east);
  const core = { x0: coreW, x1: coreE, z0: coreN, z1: coreS };
  const inCore = (x, z) => x >= core.x0 && x <= core.x1 && z >= core.z0 && z <= core.z1;

  return { region, campus, O, project, inPolygon, inCore, core };
}

/**
 * Footprints campus-3d.json already ships, as a coarse spatial hash.
 *
 * The core BOX is the documented ownership rule and it is not quite sufficient
 * on its own. campus-3d.json was pulled with `way["building"](core-bbox)`, and
 * Overpass returns a way whenever ANY of its nodes falls in the box — so a
 * building straddling the core edge is in the campus file even though its
 * centroid is outside the box, and the centroid rule alone would ship it twice.
 * Two coincident extrusions z-fight, and they do it along the campus edge,
 * which is a line the walk is looked at from constantly.
 *
 * Fixing only the box would fix the case. This fixes the class: any regional
 * footprint whose centroid lands inside a shipped campus footprint is a
 * duplicate however it got there, and is dropped.
 */
function campusFootprintIndex(campus) {
  const CELL = 100;
  const cells = new Map();
  for (const b of campus.buildings) {
    const xs = b.p.map(([x]) => x);
    const zs = b.p.map(([, z]) => z);
    for (let cx = Math.floor(Math.min(...xs) / CELL); cx <= Math.floor(Math.max(...xs) / CELL); cx++) {
      for (let cz = Math.floor(Math.min(...zs) / CELL); cz <= Math.floor(Math.max(...zs) / CELL); cz++) {
        const k = `${cx}:${cz}`;
        if (!cells.has(k)) cells.set(k, []);
        cells.get(k).push(b.p);
      }
    }
  }
  return (x, z) => {
    const bucket = cells.get(`${Math.floor(x / CELL)}:${Math.floor(z / CELL)}`);
    return bucket ? bucket.some((ring) => pointInRing(x, z, ring)) : false;
  };
}

/* ---------------------------------------------------------------- heights */

/** A height the MAP asserts, or null. `src` records which tag said so. */
function taggedHeight(tags) {
  const explicit = parseFloat(tags.height);
  if (Number.isFinite(explicit) && explicit > 0 && explicit <= MAX_HEIGHT_M) {
    return { h: round1(explicit), src: "height" };
  }
  const levels = parseFloat(tags["building:levels"]);
  if (Number.isFinite(levels) && levels > 0 && levels <= 40) {
    return { h: round1(Math.min(levels * STOREY_M + GROUND_FLOOR_EXTRA_M, MAX_HEIGHT_M)), src: "levels" };
  }
  return null;
}

/** Everything else: the calibrated area ladder, always marked as inferred. */
function inferredHeight(area) {
  return { h: rungFor(area), src: "area" };
}

/* ------------------------------------------------------------------ build */

function collect(elements, f) {
  const buildings = [];
  const roads = [];
  const water = [];
  const coast = [];
  const relations = [];
  const stats = { clippedOutside: 0, clippedCore: 0, tooSmall: 0, campusDuplicate: 0, underground: 0 };

  const inCampusFootprint = campusFootprintIndex(f.campus);
  const inScope = (x, z) => f.inPolygon(x, z) && !f.inCore(x, z);

  /* Below-grade structures must not extrude, the same rule and for the same
     reason as the campus: the Scholars garage shipped as a slab across the
     Sixth College lawn before that builder learned it. Out here the cases are
     the underground parking under the University Towne Center malls. */
  const isUnderground = (tags) =>
    tags.location === "underground" ||
    tags.parking === "underground" ||
    (tags.building === "parking" && parseFloat(tags.layer) < 0);

  /** Shared by ways and relation rings: judge one ring, keep it or count why not. */
  const admitRing = (ring, tags) => {
    if (ring.length < 3) return null;
    const area = areaOf(ring);
    if (area < MIN_FOOTPRINT_M2) { stats.tooSmall++; return null; }
    const [cx, cz] = centroidOf(ring);
    if (!f.inPolygon(cx, cz)) { stats.clippedOutside++; return null; }
    if (f.inCore(cx, cz)) { stats.clippedCore++; return null; }
    if (inCampusFootprint(cx, cz)) { stats.campusDuplicate++; return null; }
    const tagged = taggedHeight(tags);
    const { h, src } = tagged ?? inferredHeight(area);
    const b = { p: ring, src, h };
    if (tags.name) b.n = tags.name;
    return b;
  };

  for (const el of elements) {
    const tags = el.tags || {};
    if (el.type === "relation") {
      if (tags.building && el.members?.length) relations.push(el);
      else if (tags.natural === "water" && el.members?.length) {
        for (const ring of stitchOuters(el.members, f.project)) {
          const [cx, cz] = centroidOf(ring);
          if (!inScope(cx, cz)) continue;
          water.push({ p: ring, ...(tags.name ? { n: tags.name } : {}) });
        }
      }
      continue;
    }
    if (el.type !== "way" || !el.geometry?.length) continue;
    const pts = el.geometry.map((g) => f.project(g.lat, g.lon));

    if (tags.building && tags.building !== "no") {
      if (isUnderground(tags)) { stats.underground++; continue; }
      const b = admitRing(pts.slice(0, -1), tags);
      if (b) buildings.push(b);
      continue;
    }
    if (tags.natural === "coastline") {
      /* Coastline is a DIRECTED open way in OSM (land on the left), not a ring.
         It ships as polylines and the renderer is free to use it as the line it
         is. The terrain grid already decides where water is — this is the
         surveyed shoreline for anything that wants to draw against it rather
         than infer it from missing cells. */
      for (const run of clipRuns(pts, inScope)) coast.push(run);
      continue;
    }
    if (tags.natural === "water") {
      const ring = pts.slice(0, -1);
      if (ring.length < 3) continue;
      const [cx, cz] = centroidOf(ring);
      if (!inScope(cx, cz)) continue;
      water.push({ p: ring, ...(tags.name ? { n: tags.name } : {}) });
      continue;
    }
    const kind = ROAD_KINDS.get(tags.highway);
    if (kind) {
      /* `area=yes` on a highway is a PLAZA — a surface, not a route. Drawn as a
         polyline it traces its own perimeter, which is the bug that turned
         Revelle Plaza into a kerb around nothing in the campus builder. The
         region has no renderer for plazas, so these are simply dropped rather
         than shipped as a wrong-shaped road. */
      if (tags.area === "yes") continue;
      for (const run of clipRuns(pts, inScope)) roads.push({ k: kind, p: run });
    }
  }

  /* Relations after every way, so a relation ring that duplicates a way already
     shipped can be caught. Largest outer ring carries the name; smaller outers
     ship unnamed — one name anchor per building, exactly as the campus does. */
  let relRings = 0;
  for (const el of relations) {
    const tags = el.tags || {};
    if (isUnderground(tags)) { stats.underground++; continue; }
    const rings = stitchOuters(el.members, f.project).sort((a, b) => areaOf(b) - areaOf(a));
    rings.forEach((ring, i) => {
      const b = admitRing(ring, i === 0 ? tags : { ...tags, name: undefined });
      if (!b) return;
      /* A relation ring whose centroid sits inside a footprint we already
         shipped is nested mapping — roof furniture drawn over a garage, or the
         same building mapped twice. */
      const [cx, cz] = centroidOf(ring);
      if (buildings.some((o) => pointInRing(cx, cz, o.p))) return;
      buildings.push(b);
      relRings++;
    });
  }

  return { buildings, roads, water, coast, stats, relRings, relCount: relations.length };
}

/* ---------------------------------------------------------- calibration run */

/**
 * Re-derive the constants at the top of this file from a set of buildings.
 *
 * TWO COHORTS, kept separate on purpose. `lidar` is the 2014 roof measurement
 * from the sidecar, which is a measurement of the building; `tag` is what a
 * mapper typed, which is a contemporary statement about it. They have no
 * mechanism in common, so where they agree that is corroboration and where they
 * disagree it is information — the 1200-3000 m² band disagrees by 8 m because
 * that band is full of post-2014 apartment blocks the flight never saw. Merging
 * them into one median would have hidden exactly that.
 *
 * The ladder is fitted to `lidar`. It is 18x the sample and it is the only one
 * of the two that measured anything.
 */
export function calibrationOf(buildings, measured = null) {
  /* Bands ARE the ladder's own steps. Calibrating on bands the ladder does not
     use would report a disagreement no edit to the ladder could fix. */
  const edges = AREA_LADDER.map(([lo]) => lo).sort((a, b) => a - b);
  const rows = edges.map((lo, i) => ({
    lo, hi: i + 1 < edges.length ? edges[i + 1] : Infinity, lidar: [], tag: [],
  }));

  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    const a = areaOf(b.p);
    const row = rows.find((r) => a >= r.lo && a < r.hi);
    if (!row) continue;
    const m = measured?.[i];
    if (m !== undefined) row.lidar.push(m);
    if (b.src === "levels" || b.src === "height") row.tag.push(b.h);
  }

  const pct = (v, q) => {
    if (!v.length) return null;
    const s = [...v].sort((x, y) => x - y);
    return s[Math.min(s.length - 1, Math.floor(s.length * q))];
  };
  const stat = (v) => ({ n: v.length, median: pct(v, 0.5), p25: pct(v, 0.25), p75: pct(v, 0.75) });

  return {
    lidarN: rows.reduce((n, r) => n + r.lidar.length, 0),
    tagN: rows.reduce((n, r) => n + r.tag.length, 0),
    bands: rows
      .map((r) => ({ lo: r.lo, hi: r.hi, rung: rungFor(r.lo),
                     lidar: stat(r.lidar), tag: stat(r.tag) }))
      .sort((a, b) => a.lo - b.lo),
  };
}

/** The measured sidecar, but ONLY if it still describes these footprints. */
function loadMeasured(buildings) {
  if (!existsSync(HEIGHTS)) return null;
  const s = JSON.parse(readFileSync(HEIGHTS, "utf8"));
  /* An index-keyed sidecar against a rebuilt footprint list is not merely
     stale, it is WRONG — one inserted building shifts every index after it and
     each measurement silently lands on its neighbour. Refuse rather than
     calibrate on a shuffled deck. */
  if (s.footprints.count !== buildings.length) return null;
  const h = {};
  for (const [i, v] of Object.entries(s.h)) h[Number(i)] = v;
  return h;
}

function reportCalibration(elements, f) {
  /* Calibrate on the SHIPPED population — clipped, core-excluded, above the
     footprint floor. Calibrating on the raw pull would fold the campus and
     everything outside the outline into a ladder that is never applied to
     them. */
  const { buildings } = collect(elements, f);
  const measured = loadMeasured(buildings);
  if (!measured) {
    console.log(
      "no usable docs/data/region-heights.json — the ladder can only be calibrated\n" +
      "against OSM tags, which is 256 buildings against 4,666. Run\n" +
      "  node scripts/build-region-heights.mjs\n" +
      "and calibrate again. See THE BOOTSTRAP note above AREA_LADDER.\n"
    );
  }
  const cal = calibrationOf(buildings, measured);

  /* STOREY_M, against the buildings whose levels tag AND roof are both known.
     The levels count is recovered by inverting the shipped conversion — the
     tag itself is not carried into region-osm.json, and adding it just to
     re-derive a constant would be shipping a field for a script's convenience. */
  if (measured) {
    const pairs = new Map();
    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      if (b.src !== "levels" || measured[i] === undefined) continue;
      const lv = Math.round((b.h - GROUND_FLOOR_EXTRA_M) / STOREY_M);
      if (!pairs.has(lv)) pairs.set(lv, []);
      pairs.get(lv).push(measured[i]);
    }
    const med = (v) => [...v].sort((a, b) => a - b)[v.length >> 1];
    const total = [...pairs.values()].reduce((n, v) => n + v.length, 0);
    console.log(`\nstorey height — ${total} buildings with a levels tag AND a 2014 roof measurement`);
    console.log("levels     n   median measured h   fitted   implied m/storey");
    for (const lv of [...pairs.keys()].sort((a, b) => a - b)) {
      const v = pairs.get(lv);
      const m = med(v);
      console.log(
        `${String(lv).padStart(5)}  ${String(v.length).padStart(4)}   ${m.toFixed(1).padStart(16)}` +
        `   ${(lv * STOREY_M + GROUND_FLOOR_EXTRA_M).toFixed(1).padStart(6)}   ${(m / lv).toFixed(2).padStart(8)}`
      );
    }
    /* Median absolute error, not mean squared: a handful of these tags are
       simply wrong and a squared loss would chase them up the page. */
    const errs = [];
    for (const [lv, v] of pairs) for (const h of v) errs.push(Math.abs(lv * STOREY_M + GROUND_FLOOR_EXTRA_M - h));
    errs.sort((a, b) => a - b);
    console.log(
      `  shipped fit h = ${STOREY_M} * levels + ${GROUND_FLOOR_EXTRA_M} ` +
      `— median absolute error ${errs[errs.length >> 1].toFixed(2)} m over ${errs.length} buildings`
    );
    const campusErrs = errs.map(() => 0);
    let k = 0;
    for (const [lv, v] of pairs) for (const h of v) campusErrs[k++] = Math.abs(lv * 3.6 + 1.2 - h);
    campusErrs.sort((a, b) => a - b);
    console.log(`  the campus fit (3.6 * levels + 1.2) would give ${campusErrs[campusErrs.length >> 1].toFixed(2)} m`);
  }

  console.log(
    `\narea ladder — ${cal.lidarN.toLocaleString()} measured buildings, ` +
    `${cal.tagN.toLocaleString()} tagged (independent)`
  );
  console.log("area (m2)      lidar n   median    p25    p75  |  tag n  median | shipped  campus");
  const campusLadder = (a) => (a > 6000 ? 20 : a > 3000 ? 16 : a > 1200 ? 12 : a > 400 ? 9 : 4.5);
  const f1 = (v) => (v === null ? "   -" : v.toFixed(1));
  for (const b of cal.bands) {
    const label = b.hi === Infinity ? `>= ${b.lo}` : `${b.lo} - ${b.hi}`;
    console.log(
      `${label.padStart(14)}  ${String(b.lidar.n).padStart(7)}  ${f1(b.lidar.median).padStart(7)} ` +
      `${f1(b.lidar.p25).padStart(6)} ${f1(b.lidar.p75).padStart(6)}  |  ${String(b.tag.n).padStart(4)}  ` +
      `${f1(b.tag.median).padStart(6)} | ${b.rung.toFixed(1).padStart(7)} ${campusLadder(b.lo + 1).toFixed(1).padStart(7)}`
    );
  }

  const worst = ladderError(cal);
  console.log(
    `\nlargest gap between a shipped rung and its band's measured median: ` +
    `${worst.gap.toFixed(2)} m${worst.band ? ` (${worst.band})` : ""} — tolerance ${CALIBRATION_TOL_M}`
  );
  if (worst.gap > CALIBRATION_TOL_M) {
    console.error("FAIL: the shipped AREA_LADDER no longer describes the data — update it and its comment");
    process.exit(1);
  }
}

/**
 * How far the shipped ladder has drifted from the data underneath it.
 *
 * Only bands with a real sample get a vote. A rung backed by five buildings is
 * not evidence that the rung is wrong, and letting it fail the build would mean
 * the gate fires loudest exactly where it knows least.
 */
export const CALIBRATION_MIN_BAND_N = 20;
export function ladderError(cal) {
  let gap = 0;
  let band = null;
  for (const b of cal.bands) {
    if (b.lidar.median === null || b.lidar.n < CALIBRATION_MIN_BAND_N) continue;
    const d = Math.abs(b.rung - b.lidar.median);
    if (d > gap) { gap = d; band = b.hi === Infinity ? `>= ${b.lo} m2` : `${b.lo}-${b.hi} m2`; }
  }
  return { gap, band };
}

/* ----------------------------------------------------------------- output */

function summarize(d) {
  const bySrc = {};
  for (const b of d.buildings) bySrc[b.src] = (bySrc[b.src] || 0) + 1;
  const srcs = Object.entries(bySrc).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v} ${k}`).join(", ");
  const named = d.buildings.filter((b) => b.n).length;
  return (
    `${d.buildings.length.toLocaleString()} buildings (${named} named; ${srcs}), ` +
    `${d.roads.length.toLocaleString()} road runs, ${d.water.length} water, ${d.coast.length} coast runs`
  );
}

async function build(f) {
  const elements = await loadElements();
  const c = collect(elements, f);
  console.log(`  ${c.relRings} rings from ${c.relCount} building relations`);
  console.log(
    `  dropped: ${c.stats.clippedOutside.toLocaleString()} outside the outline, ` +
    `${c.stats.clippedCore.toLocaleString()} inside the campus core, ` +
    `${c.stats.campusDuplicate} already in campus-3d.json, ` +
    `${c.stats.tooSmall.toLocaleString()} under ${MIN_FOOTPRINT_M2} m2, ` +
    `${c.stats.underground} underground`
  );

  const measured = loadMeasured(c.buildings);
  const cal = calibrationOf(c.buildings, measured);
  const data = {
    _: "Generated by scripts/build-region-osm.mjs from OpenStreetMap (ODbL). Do not hand-edit. " +
       "Heights marked src=height/levels come from OSM tags; src=area is this script's " +
       "regionally-calibrated area ladder and is a GUESS. Measured 2014 roof heights " +
       "live in docs/data/region-heights.json, keyed by index into `buildings` — they are " +
       "NOT merged in here, so a renderer that wants measurements must join that sidecar.",
    origin: f.O,
    scope: {
      polygon: "docs/data/region.json → polygon.local (centroid test for areas, vertex clip for lines)",
      excluded: "centroid inside region.json → core, or inside any campus-3d.json footprint",
      minFootprintM2: MIN_FOOTPRINT_M2,
    },
    heights: {
      storeyM: STOREY_M,
      groundFloorExtraM: GROUND_FLOOR_EXTRA_M,
      areaLadder: AREA_LADDER,
      calibratedOn: { lidar: cal.lidarN, tag: cal.tagN },
      note: "Ladder calibrated on this region's own 2014 LiDAR roof measurements, NOT on the " +
            "campus ladder — under 400 m2 is a two-storey townhouse here (measured 7.2 m) and " +
            "a shed on campus (4.5 m). See the AREA_LADDER comment in the builder.",
    },
    stats: {
      buildings: c.buildings.length,
      bySrc: c.buildings.reduce((m, b) => ({ ...m, [b.src]: (m[b.src] || 0) + 1 }), {}),
      dropped: c.stats,
      roads: c.roads.length,
      water: c.water.length,
      coast: c.coast.length,
    },
    buildings: c.buildings.map((b) => ({ p: b.p, ...(b.n ? { n: b.n } : {}), src: b.src, h: b.h })),
    roads: c.roads,
    water: c.water,
    coast: c.coast,
  };

  writeFileSync(OUT, JSON.stringify(data));
  const mb = (readFileSync(OUT).length / 1048576).toFixed(2);
  console.log(`wrote ${path.relative(REPO_ROOT, OUT)} — ${summarize(data)}, ${mb} MB`);
}

function check(f) {
  if (!existsSync(OUT)) { console.error(`FAIL: missing ${path.relative(REPO_ROOT, OUT)}`); process.exit(1); }
  const d = JSON.parse(readFileSync(OUT, "utf8"));

  for (const k of ["lat", "lng", "mPerDegLat", "mPerDegLng"]) {
    if (d.origin[k] !== f.O[k]) {
      console.error(`FAIL: origin.${k} = ${d.origin[k]}, region.json says ${f.O[k]}`);
      process.exit(1);
    }
  }
  /* Clipping is the one property a renderer cannot recover from: a footprint
     inside the core is a z-fighting duplicate of a hand-audited building, and
     one outside the outline stands on terrain that was never built. */
  let outside = 0;
  let inCore = 0;
  for (const b of d.buildings) {
    const [x, z] = centroidOf(b.p);
    if (f.inCore(x, z)) inCore++;
    else if (!f.inPolygon(x, z)) outside++;
  }
  if (inCore || outside) {
    console.error(`FAIL: ${inCore} buildings inside the campus core, ${outside} outside the outline`);
    process.exit(1);
  }
  /* The shipped constants must be the ones the shipped data was built with —
     otherwise the comment above AREA_LADDER documents a different file. */
  if (JSON.stringify(d.heights.areaLadder) !== JSON.stringify(AREA_LADDER) ||
      d.heights.storeyM !== STOREY_M || d.heights.groundFloorExtraM !== GROUND_FLOOR_EXTRA_M) {
    console.error("FAIL: shipped calibration constants differ from this script's — rebuild");
    process.exit(1);
  }
  /* The ladder is re-derived from the shipped data, never compared to itself.
     Without the measured sidecar there is nothing to derive it from, and saying
     so is better than printing a green line that checked nothing. */
  const measured = loadMeasured(d.buildings);
  if (!measured) {
    console.log(`region-osm.json OK — ${summarize(d)}; ladder NOT verified (no usable region-heights.json)`);
    return;
  }
  const worst = ladderError(calibrationOf(d.buildings, measured));
  if (worst.gap > CALIBRATION_TOL_M) {
    console.error(
      `FAIL: AREA_LADDER is off by ${worst.gap.toFixed(2)} m at ${worst.band} against the ` +
      "measured roofs — recalibrate with --calibrate and update the comment"
    );
    process.exit(1);
  }
  console.log(
    `region-osm.json OK — ${summarize(d)}; every ladder rung within ` +
    `${worst.gap.toFixed(2)} m of its band's measured median`
  );
}

/* Run only when INVOKED, never when imported. tests/region-osm.test.mjs imports
   this file to compare the shipped calibration against the constants it was
   built from — which is the only way that check can be honest, because reading
   the numbers out of the data file and comparing them to themselves would pass
   no matter what. A module that builds on import would make that test fetch
   Overpass and overwrite the file it is trying to verify. */
const INVOKED = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (INVOKED) {
  const frames = loadFrames();
  if (CALIBRATE) reportCalibration(await loadElements(), frames);
  else if (CHECK) check(frames);
  else await build(frames);
}
