// What STANDS in the 30 km² region: its buildings, its roads and its water.
//
// campus-region.js draws the regional LAND — the bluff, Rose Canyon, the
// freeway embankments — and the sea it falls into. That is bare earth. From
// the top of the Torrey Pines bluff you are looking at La Jolla, University
// City and the I-5 corridor, and today all of it is unbuilt tan. This module
// is the other half: the regional building footprints extruded on that
// terrain, the road ways draped on it, and the inland water bodies.
//
// WHAT IT COSTS, measured rather than estimated — tests/region-massing.test.mjs
// prints these off the file that actually ships, so the number cannot quietly
// rot the way a docstring's can (campus-massing.js records exactly that
// happening to its own). 5,551 buildings, 5,055 road runs and 22 water bodies
// build in ~110 ms into 373,404 triangles and 324 draw calls: 102 building
// chunk meshes at two material groups each, 110 road chunks, 10 water chunks.
// Buildings are 187,516 of those triangles, ~34 per footprint. The ribbons are
// the other half, and that is the price of draping — a road is re-segmented
// every 6 m so it bends with the ground instead of bridging it.
//
// IT IS NOT THE CAMPUS, AND MUST NOT PRETEND TO BE. Everything inside the
// campus box is already drawn from the university's own massing, its surveyed
// ground polygons and its measured facades (campus-massing.js,
// campus-world.js). This module refuses to draw anything there — buildings,
// road ribbons and water alike — for the same reason campus-region.js's mesh
// stops at the campus edge: two sources describing one building is not twice
// the detail, it is a z-fight, and the source that measured it wins.
//
// THE COLOUR PROBLEM, STATED UP FRONT. There is no registered aerial imagery
// for this region (campus-region.js's REGION_GROUND_COLOR records the same
// gap). So NOTHING in this module's palette is a measurement OF THE REGION.
// Every colour here is inherited from a constant that was measured somewhere
// else in this repo, each one named with the constant it came from and what
// makes the transfer defensible or not — see REGION_MASSING_PROVENANCE, which
// is the honest ledger of that, not a decoration. The moment a registered
// regional frame exists, these are the four values to replace.
//
// WHY NO FACADE TEXTURE. campus-massing.js gives every campus building a
// facade tile chosen from campus-facades.json's researched `styles`. Nothing
// researched the facades of University City. A tile is a claim about a
// building's window rhythm; picking one for 5,551 buildings nobody looked at
// would put an invented claim on more of the world's footprints than the whole
// campus has. They render as flat lit masses, which claims only their measured
// footprint and their height.
//
// placeRegionMassing() is pure — data in, data out, no THREE construction — so
// a test runs the exact placement the renderer uses. See tests/region-massing.
import * as THREE from "../vendor/three/three.module.min.js";
import { OVERLAY, overlayLift, applyOverlayDepth } from "./campus-overlay.js";
import { ribbon, fillPoly } from "./campus-drape.js";
import { roofElevation } from "./campus-massing.js";

/* Chunk edge, metres. Same 500 m campus-massing.js merges at, and for the same
   reason: the camera's far plane is 900 m walking and grows with altitude, so
   a region-wide merge would transform 30 km² of geometry to look at one
   street. Measured on the shipped file, 500 m gives 102 occupied building
   chunks — a hundred frustum tests to skip most of the town. */
const CHUNK_M = 500;

/* A footprint smaller than this is a shed, a carport or a tracing artefact,
   and at regional viewing distance it is one or two pixels for 20 triangles.
   Stated as a budget decision, not a claim that the building is not there. */
const MIN_AREA_M2 = 12;

/* Ground clearance, metres: a flat extrusion on a graded site has to start
   below the lowest ground under its own footprint or it hangs in the air on
   the downhill side. campus-massing.js sinks its masses by exactly this, and
   the region is steeper than the campus, not flatter. */
const BASE_SINK_M = 1.5;

/* ------------------------------------------------------------------ colour */

/* INHERITED, NOT MEASURED — the same flag campus-region.js's
   REGION_GROUND_COLOR carries, for the same reason, and it means the same
   thing: this is a defensible stand-in, and it is not a measurement of this
   region.
   Source: campus-massing.js's WALL_PALETTE, whose own note reads "the campus's
   anonymous mid-rises are grey-white concrete and stucco". Copied rather than
   imported because campus-massing.js does not export it and this module may
   not edit that file; if the palette there changes, this drifts, which is why
   the value and its origin are both written down here.
   THE LIMITATION, and it is not small: that palette describes anonymous campus
   mid-rises. Most of what this module extrudes is single-family stucco tract
   housing in La Jolla and University City, which is a warmer and lighter
   family than campus concrete. One value is used rather than the palette's six
   because picking six at random would be inventing variety on top of inventing
   the tone. */
export const REGION_WALL_COLOR = 0xd0cec6;

/* INHERITED, NOT MEASURED. Source: campus-massing.js's ROOF_FALLBACK
   (#d9dbd5), whose note reads "nearly every flat roof the drone saw is white
   TPO membrane".
   THE LIMITATION: that is a claim about FLAT commercial roofs. The region is
   mostly pitched shingle and Spanish tile, which is darker and much warmer. So
   this is the weakest transfer in the module and is flagged as such. It is
   still preferred over a guess at "tile red", which would be an unsourced
   number presented as a fact about five thousand roofs. */
export const REGION_ROOF_COLOR = 0xd9dbd5;

/* INHERITED, and the strongest transfer here. Source: campus-world.js's
   surface DEFAULTS.road = #5e6163, whose note records the footage measurement
   behind it — "streets measured #5a5a5c–#6b6f70". That is asphalt, in San
   Diego, in this light, photographed for this project. A residential street in
   University City is the same material under the same sun as a campus street;
   what this cannot claim is per-street variation, wear, or the concrete
   sections of I-5. */
export const REGION_ROAD_COLOR = 0x5e6163;

/* INHERITED from a measurement taken IN THIS REGION. Source: campus-region.js
   OCEAN_COLOR, the mean of three open-water patches sampled from the reference
   capture Sahir supplied (2026-08-06).
   THE LIMITATION: those patches are the open Pacific. This paints inland
   water — lagoons, reservoirs, the canyon ponds — which is shallower, siltier
   and greener than deep ocean, and which the same capture does not resolve.
   Imported rather than copied, because campus-region.js does export it. */
import { OCEAN_COLOR } from "./campus-region.js";
export const REGION_WATER_COLOR = OCEAN_COLOR;

/* Road half-width per OSM class, metres.
 *
 * THIS IS A STATED ASSUMPTION, not a measurement, and the derivation is one
 * line: a US travel lane is 12 ft = 3.658 m (AASHTO's standard, and the width
 * Caltrans builds to), so each class is that lane times an assumed lane count
 * for what that class means in this city. Nothing here was traced off imagery.
 *
 * THE NEGATIVE RESULT, which is why it is an assumption. The obvious in-repo
 * calibration is campus-arcgis.json's surveyed `road` ground polygons — real
 * measured geometry, in the same city, in the renderer's own frame. Measured:
 * 274 road polygons ABOVE A 50 m² MINIMUM (the file carries 406 in total; the
 * rest are clipping slivers whose 4·area/perimeter is meaningless), of which
 * 93 are elongated runs rather than junction blobs, and their effective width
 * (4·area/perimeter) runs 8.1 m at the 10th percentile to 30.4 m at the 90th,
 * median 16.6 m. The 50 m² floor is stated because without it the numbers do
 * not reproduce — a reader who filters differently gets a different table and
 * cannot tell which of you is wrong. That is the whole PAVED
 * ENVELOPE — carriageway plus parking bays plus medians plus turnouts — not a
 * carriageway, and no field in that survey separates the two. So the survey
 * cannot calibrate a lane count, and saying it did would be the kind of
 * unsourced number this repo does not ship. The lane counts below are what
 * they look like: an assumption, written down as one.
 *
 * OSM draws a divided motorway as one way PER CARRIAGEWAY, so the motorway
 * figure is one direction of I-5, not both. */
export const LANE_M = 3.658;
export const ROAD_LANES = {
  motorway: 4.5,   // I-5 / SR-52: four lanes plus shoulders, per carriageway
  trunk: 4,        // in this region trunk is expressway — SR-52, SR-163 — not an arterial
  primary: 3.5,    // e.g. La Jolla Village Drive: two each way plus a turn lane
  secondary: 2.5,
  tertiary: 2,
  residential: 2,
  service: 1.2,    // an alley or a parking aisle
  path: 0.5,       // a sidewalk or a trail
};
/* An unlisted class gets the residential figure rather than nothing: the way
   is real, its width is the thing in doubt. */
const DEFAULT_LANES = ROAD_LANES.residential;

/** Half the drawn width of a road of class `k`, metres. */
export function roadHalfWidth(k) {
  return ((ROAD_LANES[k] ?? DEFAULT_LANES) * LANE_M) / 2;
}

/**
 * The ledger. Every colour and every width this module ships, with where it
 * came from and whether it is a measurement of this region (it never is).
 */
export const REGION_MASSING_PROVENANCE = {
  measuredForRegion: false,
  reason: "no registered aerial imagery exists for this region — see campus-region.js REGION_GROUND_COLOR",
  wall: {
    value: "#d0cec6",
    inherited: "campus-massing.js WALL_PALETTE[4]",
    source: "footage-corrected campus mid-rise concrete/stucco family",
    limitation: "the region is mostly single-family stucco, a warmer and lighter family than campus concrete",
    copied: "campus-massing.js does not export WALL_PALETTE and may not be edited here",
  },
  roof: {
    value: "#d9dbd5",
    inherited: "campus-massing.js ROOF_FALLBACK",
    source: "white TPO membrane, the roof the drone footage saw on nearly every campus building",
    limitation: "the weakest transfer here — regional roofs are mostly pitched shingle and tile, darker and warmer than flat TPO",
    copied: "campus-massing.js does not export ROOF_FALLBACK and may not be edited here",
  },
  road: {
    value: "#5e6163",
    inherited: "campus-world.js createSurfaces DEFAULTS.road",
    source: "footage-measured San Diego street asphalt, #5a5a5c–#6b6f70",
    limitation: "no per-street variation, no wear, no concrete freeway sections",
    copied: "the DEFAULTS table is local to createSurfaces and may not be edited here",
  },
  water: {
    inherited: "campus-region.js OCEAN_COLOR (imported, not copied)",
    source: "three open-water Pacific patches, reference capture 2026-08-06",
    limitation: "measured on deep ocean; inland lagoons and reservoirs are shallower, siltier and greener",
  },
  roadWidth: {
    rule: "lanes x 3.658 m (12 ft AASHTO travel lane)",
    measured: false,
    negativeResult:
      "campus-arcgis.json surveyed road polygons give effective widths of 8.1-30.4 m " +
      "(median 16.6 m over 93 elongated runs of the 274 polygons above 50 m²; the file " +
      "holds 406 in total) — that is the paved envelope including parking bays and " +
      "medians, not a carriageway, so it cannot calibrate a lane count",
  },
};

/* --------------------------------------------------------------- geometry */

/** The campus box, from the campus LiDAR grid — the region draws nothing in it. */
export function campusBox(campusTerrain) {
  if (!campusTerrain) return null;
  const { x0, z0, cell, cols, rows } = campusTerrain;
  return { x0, z0, x1: x0 + (cols - 1) * cell, z1: z0 + (rows - 1) * cell };
}

const inBox = (box, x, z) => !!box && x >= box.x0 && x <= box.x1 && z >= box.z0 && z <= box.z1;

/** Drop a repeated closing vertex; OSM rings carry one and it makes a zero-length edge. */
function openRing(p) {
  if (p.length > 2 && p[0][0] === p.at(-1)[0] && p[0][1] === p.at(-1)[1]) return p.slice(0, -1);
  return p;
}

/** Twice the signed area of a ring in the (x, z) plane, and the centroid. */
export function ringStats(p) {
  let a2 = 0, cx = 0, cz = 0;
  for (let i = 0; i < p.length; i++) {
    const [x0, z0] = p[i];
    const [x1, z1] = p[(i + 1) % p.length];
    a2 += x0 * z1 - x1 * z0;
    cx += x0;
    cz += z0;
  }
  return { signed2: a2, area: Math.abs(a2) / 2, cx: cx / p.length, cz: cz / p.length };
}

/* WALL WINDING, and it is measured rather than assumed — the same discipline
   campus-drape.js's fillPoly records for its own +y question.
   A wall quad is emitted as (a.base, b.base, a.top) / (a.top, b.base, b.top).
   With Three.js's counter-clockwise front face, that triangle's normal is
   (b-a) x (up), which points to the RIGHT of the a->b direction looking down
   from +y with x right and z INTO the screen. Walking a ring whose signed area
   (as computed above, x*z' - x'*z) is NEGATIVE keeps the interior on the left,
   so the right-hand side is outward. Rings are normalised to that sign before
   the walls are built, and tests/region-massing.test.mjs pins it by measuring
   the dot product of every wall normal against the outward direction from the
   footprint centroid. */
const OUTWARD_SIGN = -1;

/**
 * Place every regional building on the terrain the sampler describes.
 *
 * Pure: `heightAt` is the only thing it knows about the world, so a test runs
 * the exact placement the renderer does against a sampler it wrote itself.
 *
 * Grounding is campus-massing.js's roofElevation — imported, not re-derived,
 * because "where does a flat extrusion sit on a graded site" is one question
 * with one answer (rim-median ground + h, never below the highest ground under
 * the footprint) and two implementations of it would drift.
 *
 * Returns placed buildings plus a census of what was dropped and why, because
 * "5,551 of 5,551 rendered" is a fact a reviewer should not have to
 * rediscover from a screenshot.
 */
export function placeRegionBuildings(
  buildings,
  { heightAt, campusTerrain, chunkM = CHUNK_M, measured = null } = {}
) {
  const placed = [];
  const dropped = { inCampus: 0, tiny: 0, degenerate: 0, noHeight: 0 };
  if (!Array.isArray(buildings) || typeof heightAt !== "function") {
    return { placed, dropped };
  }
  const box = campusBox(campusTerrain);
  buildings.forEach((b, i) => {
    const ring = openRing(Array.isArray(b?.p) ? b.p : []);
    if (ring.length < 3) { dropped.degenerate++; return; }

    /* A MEASURED roof beats an inferred one, always.
       This is the same division of labour the campus has run on since the
       start: OSM says where the walls are, LiDAR says how high they reach.
       The regional heights live in their own file rather than being folded
       back into the OSM pull for the same reason campus-lidar.json is separate
       from campus-3d.json — re-pulling OSM must not silently discard
       measurements, and it would if the two shared a file.
       Keyed by index into this very array, so the join is only valid against
       the pull it was measured from; build-region-heights.mjs records the
       footprint count it measured against and the loader checks it. */
    const m = measured ? Number(measured[i]) : NaN;
    const h = Number.isFinite(m) && m > 0 ? m : Number(b.h);
    const src = Number.isFinite(m) && m > 0 ? "lidar" : (b.src || null);
    /* No height is not "height zero": a footprint with no measurement is a
       building this module cannot describe, and a 0 m extrusion is a flake of
       z-fighting roof lying on the terrain. */
    if (!Number.isFinite(h) || h <= 0) { dropped.noHeight++; return; }
    const stats = ringStats(ring);
    if (stats.area < MIN_AREA_M2) { dropped.tiny++; return; }
    /* The campus draws its own buildings from the university's massing. */
    if (inBox(box, stats.cx, stats.cz)) { dropped.inCampus++; return; }

    let lowest = Infinity;
    for (const [x, z] of ring) {
      const g = heightAt(x, z);
      if (Number.isFinite(g) && g < lowest) lowest = g;
    }
    if (!Number.isFinite(lowest)) { dropped.degenerate++; return; }
    const roofY = roofElevation(ring, h, heightAt);
    if (!Number.isFinite(roofY)) { dropped.degenerate++; return; }
    const baseY = lowest - BASE_SINK_M;

    /* Normalised so every wall quad below faces outward. See OUTWARD_SIGN. */
    const wound = Math.sign(stats.signed2) === OUTWARD_SIGN ? ring : [...ring].reverse();
    placed.push({
      ring: wound,
      name: b.n || null,
      src,
      h,
      baseY,
      roofY,
      cx: stats.cx,
      cz: stats.cz,
      area: stats.area,
      chunk: `${Math.floor(stats.cx / chunkM)}:${Math.floor(stats.cz / chunkM)}`,
    });
  });
  return { placed, dropped };
}

/**
 * Cut every road way into the runs that lie OUTSIDE the campus box, and give
 * each run its class's half-width.
 *
 * Cutting rather than dropping: La Jolla Village Drive and Genesee Avenue both
 * run clean through the campus box, and dropping the whole way would leave the
 * region's two main arterials as stumps at the edge of the world. Dropping
 * only the vertices inside the box leaves the run's end a half-chunk short of
 * the campus's own surveyed roads, which is a gap rather than an overlap —
 * the honest failure, since nothing measured the metres in between.
 */
export function placeRegionRoads(roads, { campusTerrain, chunkM = CHUNK_M } = {}) {
  const placed = [];
  const dropped = { degenerate: 0, allInCampus: 0 };
  if (!Array.isArray(roads)) return { placed, dropped };
  const box = campusBox(campusTerrain);
  for (const r of roads) {
    const pts = Array.isArray(r?.p) ? r.p : [];
    if (pts.length < 2) { dropped.degenerate++; continue; }
    const half = roadHalfWidth(r.k);
    let run = [];
    let kept = 0;
    const flush = () => {
      if (run.length >= 2) {
        const mid = run[Math.floor(run.length / 2)];
        placed.push({
          k: r.k || null, pts: run, half,
          chunk: `${Math.floor(mid[0] / chunkM)}:${Math.floor(mid[1] / chunkM)}`,
        });
        kept++;
      }
      run = [];
    };
    for (const p of pts) {
      if (!Array.isArray(p) || p.length < 2) continue;
      if (inBox(box, p[0], p[1])) flush();
      else run.push(p);
    }
    flush();
    if (!kept) dropped.allInCampus++;
  }
  return { placed, dropped };
}

/** Water bodies, minus anything the campus's own surveyed ground already draws. */
export function placeRegionWater(water, { campusTerrain, chunkM = CHUNK_M } = {}) {
  const placed = [];
  const dropped = { degenerate: 0, inCampus: 0 };
  if (!Array.isArray(water)) return { placed, dropped };
  const box = campusBox(campusTerrain);
  for (const w of water) {
    const ring = openRing(Array.isArray(w?.p) ? w.p : []);
    if (ring.length < 3) { dropped.degenerate++; continue; }
    const stats = ringStats(ring);
    if (inBox(box, stats.cx, stats.cz)) { dropped.inCampus++; continue; }
    placed.push({
      ring, name: w.n || null, area: stats.area, cx: stats.cx, cz: stats.cz,
      chunk: `${Math.floor(stats.cx / chunkM)}:${Math.floor(stats.cz / chunkM)}`,
    });
  }
  return { placed, dropped };
}

/**
 * Everything this module will draw, from data alone. One pure entry point, so
 * a test measures the same placement the renderer builds from.
 *
 * A missing or malformed file is a quiet no-op with zero counts — the world
 * must boot exactly as it does today when region-osm is absent.
 */
/**
 * The measured-height table, but only if it was measured against THIS pull.
 *
 * region-heights.json keys its roofs by index into region-osm.json's building
 * array, which makes the join O(1) and makes it fragile in exactly one way: a
 * fresh Overpass pull reorders the array, and a stale table would then apply
 * La Jolla's roof to a house in Sorrento Valley. Nothing about that failure
 * looks wrong in code or throws — you would just get a skyline that is subtly,
 * confidently incorrect.
 *
 * So the builder records what it measured against, and this refuses the whole
 * table unless it still matches. Refusing is the right failure: the inferred
 * heights are still there and still honest, and a region of ladder-estimated
 * houses is a known approximation rather than a silent mismatch.
 *
 * TWO CHECKS, DELIBERATELY SPLIT. The sidecar carries both a footprint COUNT
 * and a FINGERPRINT hashed over every footprint centroid. The fingerprint is
 * the real guarantee — it catches a pull that moved a building without
 * changing how many there are — but computing it needs a sha1 over 5,551
 * centroids, which is build-time work, not first-frame work. So the strong
 * check runs in Node, where the hash function already lives and a test asserts
 * it on every run (tests/region-osm.test.mjs); the runtime keeps the cheap
 * structural check that catches the common case of a re-pull adding or
 * dropping buildings. Shipping a stale sidecar therefore fails a test long
 * before it can reach a browser.
 */
export function measuredHeightsFor(osm, heights) {
  if (!heights || !heights.h) return null;
  const n = Array.isArray(osm?.buildings) ? osm.buildings.length : 0;
  if (!n || heights.footprints?.count !== n) return null;
  return heights.h;
}

export function placeRegionMassing(osm, opts = {}) {
  const buildings = placeRegionBuildings(osm?.buildings, {
    ...opts,
    measured: measuredHeightsFor(osm, opts.measuredHeights),
  });
  const roads = placeRegionRoads(osm?.roads, opts);
  const water = placeRegionWater(osm?.water, opts);
  const chunks = new Set();
  for (const b of buildings.placed) chunks.add(b.chunk);
  return {
    buildings: buildings.placed,
    roads: roads.placed,
    water: water.placed,
    dropped: { buildings: buildings.dropped, roads: roads.dropped, water: water.dropped },
    buildingChunks: chunks.size,
  };
}

/* --------------------------------------------------------------- rendering */

/**
 * One building's triangles, appended to a chunk's position/normal arrays.
 *
 * Built by hand rather than through THREE.ExtrudeGeometry, which
 * campus-massing.js uses. Two reasons, and the second is the load-bearing one:
 * ExtrudeGeometry generates UVs and material groups this module has no use for
 * (there is no facade tile here — see the header), and at this many footprints
 * the shape-parsing it does per building is the single largest cost in the
 * build. The roof cap goes through the same THREE.ShapeUtils.triangulateShape
 * campus-drape.js's fillPoly uses, with the same (x, -z) contour flip that
 * makes vertex order [0,1,2] emit a +y face.
 */
export function extrudeBuilding(b, cap, wall) {
  const ring = b.ring;
  const contour = ring.map(([x, z]) => new THREE.Vector2(x, -z));
  let tris;
  try {
    tris = THREE.ShapeUtils.triangulateShape(contour, []);
  } catch {
    return 0;
  }
  let count = 0;
  /* Roof cap, flat at the reconciled roof elevation. */
  for (const tri of tris) {
    for (const vi of [tri[0], tri[1], tri[2]]) {
      cap.pos.push(contour[vi].x, b.roofY, -contour[vi].y);
      cap.nor.push(0, 1, 0);
    }
    count++;
  }
  /* Walls. The ring was wound outward by placeRegionBuildings. */
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i];
    const [bx, bz] = ring[(i + 1) % ring.length];
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) continue;
    /* Flat face normal: the horizontal right of a->b, which is outward. */
    const nx = -dz / len;
    const nz = dx / len;
    wall.pos.push(ax, b.baseY, az, bx, b.baseY, bz, ax, b.roofY, az);
    wall.pos.push(ax, b.roofY, az, bx, b.baseY, bz, bx, b.roofY, bz);
    for (let k = 0; k < 6; k++) wall.nor.push(nx, 0, nz);
    count += 2;
  }
  return count;
}

/**
 * The regional buildings, merged per 500 m chunk.
 *
 * Merged for the reason campus-massing.js merges: 5,551 Meshes is 5,551
 * draw calls and a per-frame cost that swamps everything the campus itself
 * spends. Merged per CHUNK rather than campus-wide so the far side of the
 * region still frustum-culls; one flat colour pair means the chunk is the only
 * bucket key there is, and each chunk is one mesh with two material groups.
 */
export function buildingMeshes(placed, materials) {
  /* Cap and wall triangles are accumulated APART and concatenated once per
     chunk. Interleaving them per building would need one material group per
     building — the same two-group contract campus-massing.js's mergeBucket
     emits, and the reason it splits by ExtrudeGeometry's groups rather than
     appending in draw order. */
  const chunks = new Map();
  let triangles = 0;
  for (const b of placed) {
    if (!chunks.has(b.chunk)) {
      chunks.set(b.chunk, { cap: { pos: [], nor: [] }, wall: { pos: [], nor: [] } });
    }
    const c = chunks.get(b.chunk);
    triangles += extrudeBuilding(b, c.cap, c.wall);
  }
  const out = [];
  for (const c of chunks.values()) {
    const n = c.cap.pos.length + c.wall.pos.length;
    if (!n) continue;
    /* Typed arrays filled by index: a `push(...bigArray)` spread here would
       hand the engine a hundred thousand arguments and overflow the stack. */
    const pos = new Float32Array(n);
    const nor = new Float32Array(n);
    pos.set(c.cap.pos, 0);
    nor.set(c.cap.nor, 0);
    pos.set(c.wall.pos, c.cap.pos.length);
    nor.set(c.wall.nor, c.cap.nor.length);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    geo.addGroup(0, c.cap.pos.length / 3, 0);
    geo.addGroup(c.cap.pos.length / 3, c.wall.pos.length / 3, 1);
    geo.computeBoundingSphere();
    out.push(new THREE.Mesh(geo, [materials.roof, materials.wall]));
  }
  return { meshes: out, triangles };
}

/**
 * Roads, as ribbons draped on the terrain.
 *
 * RUNG: `pad`, one above the `ground` rung that carries campus-world.js's own
 * road and plaza surfaces and this module's water. That is a deliberate
 * ordering choice, not a spare slot: where a regional road crosses regional
 * water it is a bridge — I-5 over Los Peñasquitos Lagoon, Genesee over Rose
 * Canyon — and the road has to paint over the water rather than tie with it.
 * Lift, render order and polygon offset all come from campus-overlay.js; this
 * module defines none of its own.
 */
function roadMeshes(placed, heightAt, material) {
  const rung = "pad";
  const lift = overlayLift(rung);
  const chunks = new Map();
  for (const r of placed) {
    if (!chunks.has(r.chunk)) chunks.set(r.chunk, []);
    ribbon(chunks.get(r.chunk), r.pts, r.half, heightAt, lift);
  }
  return flatMeshes(chunks, material, rung);
}

/**
 * Water bodies, filled on the `ground` rung — they ARE the ground surface
 * there, the same rung campus-world.js's own surveyed water polygons take.
 * Flat fills, not campus-world.js's raised basin: a basin is a measurement of
 * a rim height, and nothing measured a rim for a lagoon two kilometres away.
 */
function waterMeshes(placed, heightAt, material) {
  const rung = "ground";
  const lift = overlayLift(rung);
  const chunks = new Map();
  for (const w of placed) {
    if (!chunks.has(w.chunk)) chunks.set(w.chunk, []);
    fillPoly(chunks.get(w.chunk), w.ring, heightAt, lift);
  }
  return flatMeshes(chunks, material, rung);
}

/** One merged mesh per chunk from a map of chunk -> flat position array. */
function flatMeshes(chunks, material, rung) {
  const out = [];
  let triangles = 0;
  for (const pos of chunks.values()) {
    if (!pos.length) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    /* Up-facing: fillPoly and ribbon both emit +y triangles (campus-drape.js
       measures and pins that), so this is the truth about the geometry rather
       than a lie the shader corrects. */
    const nor = new Float32Array(pos.length);
    for (let i = 1; i < nor.length; i += 3) nor[i] = 1;
    geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, material);
    mesh.renderOrder = OVERLAY[rung].renderOrder;
    out.push(mesh);
    triangles += pos.length / 9;
  }
  return { meshes: out, triangles };
}

/**
 * The regional built world. Returns { group, counts }; the caller parents the
 * group to its own layer — this module never adds itself to the scene, which
 * is the bug that once left Muir Field's overlays outside the layer toggle.
 *
 * Every failure mode is a quiet no-op with zero counts: no file, no sampler,
 * a malformed file, an empty file. The world must boot exactly as it does
 * today when region-osm is absent, and "exactly" includes not throwing.
 */
export function createRegionMassing(
  _scene, { regionOsm, regionHeights, heightAt, campusTerrain } = {}
) {
  const group = new THREE.Group();
  group.name = "region-massing";
  const counts = {
    buildings: 0, roads: 0, water: 0,
    buildingChunks: 0, roadChunks: 0, waterChunks: 0,
    triangles: 0, drawCalls: 0,
    dropped: null,
  };
  if (!regionOsm || typeof heightAt !== "function") return { group, counts };

  const p = placeRegionMassing(regionOsm, {
    heightAt, campusTerrain, measuredHeights: regionHeights,
  });
  counts.buildings = p.buildings.length;
  /* How much of this skyline is measured rather than inferred — the single
     most useful number about it, and invisible from the screen. */
  counts.lidarRoofs = p.buildings.filter((b) => b.src === "lidar").length;
  counts.roads = p.roads.length;
  counts.water = p.water.length;
  counts.dropped = p.dropped;

  const materials = {
    wall: new THREE.MeshLambertMaterial({ color: REGION_WALL_COLOR }),
    roof: new THREE.MeshLambertMaterial({ color: REGION_ROOF_COLOR }),
  };
  const built = buildingMeshes(p.buildings, materials);
  for (const m of built.meshes) group.add(m);
  counts.buildingChunks = built.meshes.length;
  counts.triangles += built.triangles;
  /* Two material groups per chunk mesh is two draw calls. */
  counts.drawCalls += built.meshes.length * 2;

  const roadMat = applyOverlayDepth(
    new THREE.MeshLambertMaterial({ color: REGION_ROAD_COLOR, side: THREE.DoubleSide }), "pad");
  const roads = roadMeshes(p.roads, heightAt, roadMat);
  for (const m of roads.meshes) group.add(m);
  counts.roadChunks = roads.meshes.length;
  counts.triangles += roads.triangles;
  counts.drawCalls += roads.meshes.length;

  const waterMat = applyOverlayDepth(
    new THREE.MeshLambertMaterial({ color: REGION_WATER_COLOR, side: THREE.DoubleSide }), "ground");
  const water = waterMeshes(p.water, heightAt, waterMat);
  for (const m of water.meshes) group.add(m);
  counts.waterChunks = water.meshes.length;
  counts.triangles += water.triangles;
  counts.drawCalls += water.meshes.length;

  return { group, counts };
}
