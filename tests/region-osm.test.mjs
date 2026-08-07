// The built region: footprints, roads, water, and the heights on top of them.
//
// tests/region.test.mjs pins the SEAM between the campus terrain and the
// regional terrain. This file pins the two things that can go wrong once
// buildings stand on that terrain, and they are different in kind.
//
// The first is OWNERSHIP. campus-3d.json and region-osm.json both come from
// OpenStreetMap and their boxes overlap, so the same building can arrive twice.
// Two coincident extrusions z-fight, and they do it along the campus edge —
// which is exactly where anyone standing on Ridge Walk is looking. Every clip
// test below exists for that.
//
// The second is PROVENANCE, which is this repo's actual subject. Every regional
// height is one of three things — a 2014 LiDAR measurement, an OSM tag, or a
// rung on an area ladder — and the ladder is only defensible while it still
// describes the roofs it was calibrated on. A ladder whose constants have
// drifted from the data is worse than no ladder, because it looks like a
// measurement. So the tests below RE-DERIVE the calibration from the shipped
// files and compare it to the constants the builders hold; a shipped number is
// never checked against itself.
//
// The third thing these tests defend is the JOIN. Measured heights ship in a
// sidecar keyed by index into region-osm.json, which breaks silently: one
// building added upstream shifts every index after it and each measurement
// lands on its neighbour, with both files individually well-formed. The
// fingerprint check is the only thing standing between that and a world of
// plausible-looking wrong heights.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  AREA_LADDER, STOREY_M, GROUND_FLOOR_EXTRA_M, CALIBRATION_TOL_M,
  CALIBRATION_MIN_BAND_N, MIN_FOOTPRINT_M2, MAX_HEIGHT_M, ROAD_KINDS,
  calibrationOf, ladderError,
} from "../scripts/build-region-osm.mjs";
import {
  footprintFingerprint, MAX_DEPTH, MIN_HEIGHT_M, MIN_RETURNS, EPOCH_TAG_RATIO,
} from "../scripts/build-region-heights.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(path.join(ROOT, p), "utf8"));

const region = read("docs/data/region.json");
const osm = read("docs/data/region-osm.json");
const campus = read("docs/data/campus-3d.json");

const HEIGHTS_PATH = "docs/data/region-heights.json";
const heights = existsSync(path.join(ROOT, HEIGHTS_PATH)) ? read(HEIGHTS_PATH) : null;

/* ------------------------------------------------------------- geometry */

const O = osm.origin;
const project = (lat, lng) => [
  (lng - O.lng) * O.mPerDegLng,
  -(lat - O.lat) * O.mPerDegLat,
];

const pointInRing = (px, pz, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if (zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
};

const areaOf = (ring) => {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return Math.abs(a / 2);
};

const centroidOf = (ring) => {
  let x = 0;
  let z = 0;
  for (const p of ring) { x += p[0]; z += p[1]; }
  return [x / ring.length, z / ring.length];
};

const polygon = region.polygon.local;
const inPolygon = (x, z) => pointInRing(x, z, polygon);

/* The core box in the same metres everything else is measured in. */
const [coreW, coreN] = project(region.core.north, region.core.west);
const [coreE, coreS] = project(region.core.south, region.core.east);
const inCore = (x, z) => x >= coreW && x <= coreE && z >= coreN && z <= coreS;

/* ---------------------------------------------------------------- schema */

test("region-osm.json has the shape the renderer is promised", () => {
  assert.ok(Array.isArray(osm.buildings) && osm.buildings.length > 1000,
    `expected thousands of regional buildings, got ${osm.buildings?.length}`);
  assert.ok(Array.isArray(osm.roads) && osm.roads.length > 100);
  assert.ok(Array.isArray(osm.water));
  assert.ok(Array.isArray(osm.coast));

  /* The origin is load-bearing: every coordinate here is drawn in the same
     scene as campus-3d.json, so a divergence translates the whole regional
     world relative to the campus. */
  for (const k of ["lat", "lng", "mPerDegLat", "mPerDegLng"]) {
    assert.equal(osm.origin[k], campus.origin[k], `origin.${k} must match campus-3d.json`);
  }

  /* "lidar" is deliberately NOT admissible here. Measurements live in the
     region-heights.json sidecar; if one ever appears in this file it means the
     two have been merged, and the next Overpass pull will silently erase an
     hour of LiDAR streaming. */
  const SRC = new Set(["levels", "height", "area"]);
  for (const b of osm.buildings) {
    assert.ok(Array.isArray(b.p) && b.p.length >= 3, "footprint needs at least 3 vertices");
    for (const v of b.p) {
      assert.ok(Array.isArray(v) && v.length === 2 &&
        Number.isFinite(v[0]) && Number.isFinite(v[1]), "vertex must be [x, z]");
    }
    assert.ok(SRC.has(b.src), `unknown height provenance "${b.src}"`);
    assert.ok(Number.isFinite(b.h) && b.h > 0, "every building needs a height");
    if ("n" in b) assert.equal(typeof b.n, "string");
  }

  const KINDS = new Set(ROAD_KINDS.values());
  for (const r of osm.roads) {
    assert.ok(KINDS.has(r.k), `unknown road class "${r.k}"`);
    assert.ok(Array.isArray(r.p) && r.p.length >= 2, "a road run needs at least 2 points");
  }
  for (const w of osm.water) assert.ok(Array.isArray(w.p) && w.p.length >= 3);
  for (const c of osm.coast) assert.ok(Array.isArray(c) && c.length >= 2);
});

test("every footprint clears the minimum the builder claims to enforce", () => {
  /* 60 m² is the line between a building and a bike shed. The builder drops
     707 rings on it; if that filter ever silently stopped running, the region
     would gain thousands of two-metre boxes that read as noise from any
     distance. Tolerance is one part in a thousand for the 0.1 m coordinate
     rounding, which can shave a hair off a ring right on the boundary. */
  for (const b of osm.buildings) {
    const a = areaOf(b.p);
    assert.ok(a >= MIN_FOOTPRINT_M2 * 0.999,
      `footprint of ${a.toFixed(1)} m2 is under the ${MIN_FOOTPRINT_M2} m2 floor`);
  }
});

/* -------------------------------------------------------------- clipping */

test("nothing is drawn inside the campus core — campus-3d.json owns it", () => {
  const offenders = osm.buildings.filter((b) => inCore(...centroidOf(b.p)));
  assert.equal(offenders.length, 0,
    `${offenders.length} regional buildings sit inside the campus core box and would z-fight`);

  /* Roads and the coastline are clipped as RUNS, so the guarantee is stronger:
     not one vertex may be inside. A freeway that crosses the campus has to
     arrive as two polylines, not one line through the middle of Library Walk. */
  for (const r of osm.roads) {
    for (const [x, z] of r.p) {
      assert.ok(!inCore(x, z), `a ${r.k} road vertex at (${x}, ${z}) is inside the campus core`);
    }
  }
  for (const c of osm.coast) {
    for (const [x, z] of c) assert.ok(!inCore(x, z), "a coastline vertex is inside the campus core");
  }
});

test("nothing is drawn outside the region outline — there is no terrain there", () => {
  const outside = osm.buildings.filter((b) => !inPolygon(...centroidOf(b.p)));
  assert.equal(outside.length, 0,
    `${outside.length} buildings stand outside the outline, on land that was never built`);

  for (const r of osm.roads) {
    for (const [x, z] of r.p) {
      assert.ok(inPolygon(x, z), `a ${r.k} road vertex at (${x}, ${z}) is outside the outline`);
    }
  }
  for (const w of osm.water) assert.ok(inPolygon(...centroidOf(w.p)));
  for (const c of osm.coast) {
    for (const [x, z] of c) assert.ok(inPolygon(x, z), "a coastline vertex is outside the outline");
  }
});

test("no regional footprint duplicates one campus-3d.json already ships", () => {
  /* The core BOX is the documented rule and it is not sufficient on its own.
     campus-3d.json was pulled with `way["building"](core-bbox)`, and Overpass
     returns a way whenever ANY of its nodes falls in the box — so a building
     straddling the core edge is in the campus file with its centroid outside
     the box, and a centroid-only rule ships it a second time. The builder drops
     21 of those. This pins that it keeps doing so. */
  const CELL = 100;
  const cells = new Map();
  for (const b of campus.buildings) {
    const xs = b.p.map(([x]) => x);
    const zs = b.p.map(([, z]) => z);
    for (let cx = Math.floor(Math.min(...xs) / CELL); cx <= Math.floor(Math.max(...xs) / CELL); cx++) {
      for (let cz = Math.floor(Math.min(...zs) / CELL); cz <= Math.floor(Math.max(...zs) / CELL); cz++) {
        const k = `${cx}:${cz}`;
        if (!cells.has(k)) cells.set(k, []);
        cells.get(k).push(b);
      }
    }
  }
  const dupes = [];
  for (const b of osm.buildings) {
    const [x, z] = centroidOf(b.p);
    const bucket = cells.get(`${Math.floor(x / CELL)}:${Math.floor(z / CELL)}`);
    if (bucket?.some((c) => pointInRing(x, z, c.p))) dupes.push(b.n ?? "unnamed");
  }
  assert.deepEqual(dupes, [], "regional footprints centred inside a campus footprint would z-fight");
});

/* --------------------------------------------------------------- heights */

test("every height is a building height, not a tag typo", () => {
  for (const b of osm.buildings) {
    assert.ok(b.h >= 2 && b.h <= MAX_HEIGHT_M,
      `${b.n ?? "unnamed"} at ${b.h} m is not a plausible building`);
  }
  /* The region is a coastal suburb: if the MEDIAN building were tall, something
     upstream is wrong — most likely the campus ladder having crept back in. */
  const hs = osm.buildings.map((b) => b.h).sort((a, b) => a - b);
  const median = hs[hs.length >> 1];
  assert.ok(median >= 3 && median <= 12,
    `median regional building height ${median} m — this is a suburb, not a downtown`);
});

test("the shipped area heights are exactly what the shipped ladder produces", () => {
  /* An inferred height is a pure function of footprint area. Recomputing it
     here is the one check that catches a ladder edited without a rebuild —
     the failure mode where the comment, the constant and the data all describe
     three different things. */
  const ladderFor = (a) => AREA_LADDER.find(([lo]) => a >= lo)[1];
  let checked = 0;
  for (const b of osm.buildings) {
    if (b.src !== "area") continue;
    checked++;
    assert.equal(b.h, ladderFor(areaOf(b.p)),
      `a ${areaOf(b.p).toFixed(0)} m2 footprint shipped ${b.h} m; the ladder says ${ladderFor(areaOf(b.p))} m`);
  }
  assert.ok(checked > 1000, `expected most buildings to be ladder-inferred, only ${checked} were`);
});

test("the shipped calibration is the calibration the builder holds", () => {
  assert.deepEqual(osm.heights.areaLadder, AREA_LADDER,
    "region-osm.json was built with a different ladder than build-region-osm.mjs now has");
  assert.equal(osm.heights.storeyM, STOREY_M);
  assert.equal(osm.heights.groundFloorExtraM, GROUND_FLOOR_EXTRA_M);
});

test("the ladder still describes the roofs it was calibrated on", { skip: !heights && "region-heights.json not built" }, () => {
  /* Re-derived from the shipped files, never read out of one and compared to
     itself: bucket the MEASURED heights by footprint area and check each
     ladder rung still lands on its band's median. This is the test that goes
     red when the region is re-pulled and the population underneath has moved. */
  const measured = {};
  for (const [i, v] of Object.entries(heights.h)) measured[Number(i)] = v;
  const cal = calibrationOf(osm.buildings, measured);
  assert.ok(cal.lidarN > 1000, `only ${cal.lidarN} measured roofs — too thin to calibrate a ladder`);

  const worst = ladderError(cal);
  assert.ok(worst.gap <= CALIBRATION_TOL_M,
    `ladder is off by ${worst.gap.toFixed(2)} m at ${worst.band} — recalibrate with --calibrate`);

  /* Every rung that the gate above can actually judge must be backed by a real
     sample. A ladder made mostly of rungs too thin to check would pass the gate
     by being unfalsifiable, which is the failure this repo cares about most. */
  const judged = cal.bands.filter((b) => b.lidar.n >= CALIBRATION_MIN_BAND_N);
  assert.ok(judged.length >= AREA_LADDER.length - 1,
    `only ${judged.length} of ${AREA_LADDER.length} rungs carry ${CALIBRATION_MIN_BAND_N}+ measured buildings`);
});

test("the two height sources corroborate each other where both are dense", { skip: !heights && "region-heights.json not built" }, () => {
  /* A laser in 2014 and a volunteer typing a storey count share no mechanism.
     Where both have a real sample they agree, and that agreement is the actual
     evidence that the bottom of the ladder is right — far stronger than either
     source alone. Loose tolerance on purpose: these measure different things
     (a roof ridge vs a floor count), so this catches a source going WRONG, not
     the ordinary metre of disagreement between them. */
  const measured = {};
  for (const [i, v] of Object.entries(heights.h)) measured[Number(i)] = v;
  for (const b of calibrationOf(osm.buildings, measured).bands) {
    if (b.lidar.n < 200 || b.tag.n < 50) continue;
    assert.ok(Math.abs(b.lidar.median - b.tag.median) <= 3,
      `${b.lo}-${b.hi} m2: ${b.lidar.n} measured roofs say ${b.lidar.median} m but ` +
      `${b.tag.n} OSM tags say ${b.tag.median} m — one of the two sources has broken`);
  }
});

test("the regional ladder is NOT the campus ladder — the small band is the lesson", () => {
  /* build-campus-3d.mjs calls anything under 400 m² a 4.5 m shed. Out here that
     is a two-storey townhouse and it MEASURES 7.2 m, over three thousand
     buildings — the most numerous building in the region, a storey short. If
     someone ever copies the campus ladder across, this is the rung that costs
     the most, and it is the one the campus comment's own reasoning would not
     have predicted. */
  const campusLadder = (a) => (a > 6000 ? 20 : a > 3000 ? 16 : a > 1200 ? 12 : a > 400 ? 9 : 4.5);
  const small = AREA_LADDER.find(([lo]) => 300 >= lo)[1];
  assert.ok(small > campusLadder(300) + 1,
    `a 300 m2 regional footprint should stand well above the campus's ${campusLadder(300)} m shed, got ${small} m`);
  /* And the ladder must still RISE with area, or it is not a ladder. */
  const rungs = [...AREA_LADDER].sort((a, b) => a[0] - b[0]).map(([, h]) => h);
  for (let i = 1; i < rungs.length; i++) {
    assert.ok(rungs[i] > rungs[i - 1], `ladder is not monotonic: ${rungs.join(" -> ")}`);
  }
});

test("a levels tag converts through the measured storey height", () => {
  /* The conversion is a documented constant, so it can be checked exactly on
     the buildings that used it: every src="levels" height must be an integer
     number of storeys under this formula (or the 90 m clamp). */
  const shipped = osm.buildings.filter((b) => b.src === "levels");
  assert.ok(shipped.length > 50, `only ${shipped.length} buildings came from a levels tag`);
  assert.ok(STOREY_M < 3.6, "the storey height is the campus's — the regional fit has been lost");
  for (const b of shipped) {
    const levels = (b.h - GROUND_FLOOR_EXTRA_M) / STOREY_M;
    assert.ok(b.h === MAX_HEIGHT_M || Math.abs(levels - Math.round(levels * 2) / 2) < 0.02,
      `${b.h} m is not a whole (or half) number of ${STOREY_M} m storeys plus ${GROUND_FLOOR_EXTRA_M} m`);
  }
});

/* --------------------------------------------------------------- LiDAR */

test("the measured-height sidecar joins to the footprints it measured", { skip: !heights && "region-heights.json not built" }, () => {
  /* The sidecar is keyed by INDEX into region-osm.json's buildings array, which
     is a join that breaks silently: a rebuild that adds one building shifts
     every index after it and the measurements survive attached to the wrong
     buildings. The fingerprint is the whole defence, so it is what this test
     actually exercises. */
  assert.equal(heights.footprints.count, osm.buildings.length);
  assert.equal(heights.footprints.fingerprint, footprintFingerprint(osm.buildings),
    "region-osm.json has been rebuilt since the heights were measured — re-run build-region-heights.mjs");
  assert.equal(heights.source.maxDepth, MAX_DEPTH);
  assert.equal(heights.method.minReturns, MIN_RETURNS);

  for (const [i, h] of Object.entries(heights.h)) {
    const b = osm.buildings[Number(i)];
    assert.ok(b, `sidecar height at index ${i} indexes nothing`);
    assert.ok(h >= MIN_HEIGHT_M && h <= MAX_HEIGHT_M,
      `measured ${h} m at index ${i} is outside the plausible range`);
  }
});

test("the epoch rule held: no measurement shipped as bare 2014 ground", { skip: !heights && "region-heights.json not built" }, () => {
  /* The 2014 flight predates a decade of building out here. A footprint whose
     building did not exist then measures as the lot that did — near zero, or a
     fraction of what the contemporary map says. Both refusals are counted by
     the builder; this pins that neither was skipped. */
  const measured = Object.values(heights.h);
  assert.ok(measured.every((h) => h >= MIN_HEIGHT_M),
    "a sub-2.5 m 'roof' is the 2014 ground, not a building");

  for (const [i, h] of Object.entries(heights.h)) {
    const b = osm.buildings[Number(i)];
    if (b.src !== "levels" && b.src !== "height") continue;
    /* b.h here is the TAG's height, because the sidecar does not overwrite it.
       A measurement far below a contemporary tag is the epoch trap and the
       builder is supposed to have refused it. */
    assert.ok(h >= b.h * EPOCH_TAG_RATIO,
      `index ${i} (${b.n ?? "unnamed"}) measures ${h} m against a ${b.src} tag of ${b.h} m — ` +
      "the epoch guard should have refused this");
  }
});

test("measurement actually moved the region off its guesses", { skip: !heights && "region-heights.json not built" }, () => {
  /* A sidecar that agreed with the ladder everywhere would mean the LiDAR pass
     did nothing — which is what a silently broken measurement looks like from
     the outside. The point of measuring is that individual buildings move even
     where the population median does not. */
  const n = Object.keys(heights.h).length;
  assert.ok(n > osm.buildings.length * 0.4,
    `only ${n} of ${osm.buildings.length} footprints were measured — the LiDAR pass is not working`);

  let moved = 0;
  for (const [i, h] of Object.entries(heights.h)) {
    if (Math.abs(h - osm.buildings[Number(i)].h) > 1) moved++;
  }
  assert.ok(moved > n * 0.3,
    `only ${moved} of ${n} measured heights differ from the inferred one by over a metre`);
});
