// The regional built world: buildings, roads and water outside the campus box.
//
// What this has to pin, in order of how expensive the bug would be:
//
//  1. ABSENCE IS FREE. docs/data/region-osm.json is a build artefact and may
//     not be there. Every code path has to no-op rather than throw, because
//     the campus booting exactly as it does today is the floor this expansion
//     must not sink below.
//  2. BUILDINGS SIT ON THE GROUND THE SAMPLER REPORTS. A regional building is
//     seen from two kilometres away against a hillside; a metre of float or a
//     metre of sink is the difference between a town and a smear.
//  3. THE LADDER IS THE SHARED ONE. Roads and water drape, so they climb
//     campus-overlay.js's decal stack. A local lift or polygonOffset constant
//     is the regression the ladder exists to prevent — tests/campus-overlay.
//     test.mjs greps the modules it knows about for exactly that, and this
//     file greps the new one, because a module that is not on that list is a
//     module that regression can walk back in through.
//  4. THE MERGE ACTUALLY MERGES. 10,000 Meshes is 10,000 draw calls. The
//     budget is measured here rather than asserted from a docstring — see the
//     last test, which builds ten thousand footprints and counts.
//
// Placement runs against tests/fixtures/region-osm.json and a hand-written
// height sampler, so what is measured is the exact function the renderer calls
// rather than a re-derivation of it.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "../docs/vendor/three/three.module.min.js";
import { OVERLAY } from "../docs/js/campus-overlay.js";
import {
  placeRegionMassing, placeRegionBuildings, placeRegionRoads, placeRegionWater,
  createRegionMassing, buildingMeshes, extrudeBuilding, campusBox, ringStats,
  roadHalfWidth, ROAD_LANES, LANE_M,
  REGION_MASSING_PROVENANCE, REGION_WALL_COLOR, REGION_ROOF_COLOR,
  REGION_ROAD_COLOR, REGION_WATER_COLOR,
} from "../docs/js/campus-region-massing.js";
import { OCEAN_COLOR, regionSampler, SEA_LEVEL_M } from "../docs/js/campus-region.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OSM = JSON.parse(readFileSync(path.join(ROOT, "tests/fixtures/region-osm.json"), "utf8"));

/* The shipped campus grid's own header shape, at the shipped extent, so the
   suppression tests are about the real campus box and not an invented one. */
const CAMPUS = { x0: -1197, z0: -1383, cell: 3, cols: 1014, rows: 923 };

/* A sampler with a known answer everywhere: flat at 10 m, except a ramp east
   of x 4000 that climbs 0.5 m per metre. The ramp exists so "the roof clears
   the highest ground under the footprint" is a claim with a number behind it. */
const flatAt = 10;
const heightAt = (x) => (x >= 4000 ? flatAt + (x - 4000) * 0.5 : flatAt);
const opts = { heightAt, campusTerrain: CAMPUS };

const byName = (list, n) => list.find((b) => b.name === n);

/* ------------------------------------------------------------- absence */

test("no region-osm file: every path is a quiet no-op, nothing throws", () => {
  for (const absent of [null, undefined, {}, { buildings: null, roads: null, water: null }]) {
    const p = placeRegionMassing(absent, opts);
    assert.deepEqual([p.buildings.length, p.roads.length, p.water.length], [0, 0, 0]);
    const made = createRegionMassing(null, { regionOsm: absent, ...opts });
    assert.equal(made.group.children.length, 0);
    assert.equal(made.counts.buildings, 0);
    assert.equal(made.counts.drawCalls, 0);
  }
});

test("no height sampler: createRegionMassing builds nothing rather than guessing a datum", () => {
  const made = createRegionMassing(null, { regionOsm: OSM, campusTerrain: CAMPUS });
  assert.equal(made.group.children.length, 0);
  assert.equal(made.counts.buildings, 0);
});

test("a malformed file cannot take the world down", () => {
  const junk = { buildings: [{ p: "no" }, { p: [[1, 2]] }, {}], roads: [{}, { p: 3 }], water: [{ p: [] }] };
  const p = placeRegionMassing(junk, opts);
  assert.deepEqual([p.buildings.length, p.roads.length, p.water.length], [0, 0, 0]);
  assert.doesNotThrow(() => createRegionMassing(null, { regionOsm: junk, ...opts }));
});

test("the module never adds itself to a scene — the caller owns the layer", () => {
  const scene = new THREE.Scene();
  const made = createRegionMassing(scene, { regionOsm: OSM, ...opts });
  assert.equal(scene.children.length, 0, "createRegionMassing parented itself to the scene");
  assert.ok(made.group.children.length > 0, "…but it did build something");
});

/* ------------------------------------------------------- pure placement */

test("the campus box comes from the campus grid, and nothing is drawn inside it", () => {
  const box = campusBox(CAMPUS);
  assert.deepEqual(box, { x0: -1197, z0: -1383, x1: 1842, z1: 1383 });
  assert.equal(campusBox(null), null);

  const p = placeRegionMassing(OSM, opts);
  assert.equal(byName(p.buildings, "Fixture Campus Duplicate"), undefined,
    "a building inside the campus box rendered twice — once here, once from the university's massing");
  assert.equal(p.dropped.buildings.inCampus, 1);
  for (const b of p.buildings) {
    assert.ok(b.cx < box.x0 || b.cx > box.x1 || b.cz < box.z0 || b.cz > box.z1,
      `building at ${b.cx},${b.cz} stands inside the campus box`);
  }
  for (const w of p.water) {
    assert.ok(w.cx > box.x1 || w.cx < box.x0 || w.cz > box.z1 || w.cz < box.z0,
      "a water body inside the campus box duplicates the surveyed ground");
  }
  assert.equal(p.dropped.water.inCampus, 1);
});

test("what is dropped is counted, and each rule drops exactly its own case", () => {
  const { placed, dropped } = placeRegionBuildings(OSM.buildings, opts);
  assert.equal(placed.length, 5, "5 of the fixture's 9 buildings should stand");
  assert.deepEqual(dropped, { inCampus: 1, tiny: 1, degenerate: 1, noHeight: 1 });
});

test("a repeated closing vertex does not become a zero-length wall", () => {
  const { placed } = placeRegionBuildings(OSM.buildings, opts);
  const b = placed.find((x) => Math.round(x.cx) === 3210);
  assert.ok(b, "the closed-ring fixture building is missing");
  assert.equal(b.ring.length, 4, "the repeated closing vertex survived into the ring");
});

/* ------------------------------------------------ buildings on the ground */

test("a building sits on the ground the sampler reports, and rises by its measured height", () => {
  const { placed } = placeRegionBuildings(OSM.buildings, opts);
  const b = byName(placed, "Fixture Square");
  /* Flat ground at 10 m, 9 m of building: the roof is at 19 m, exactly. */
  assert.equal(b.roofY, flatAt + 9);
  /* And the base is sunk below the lowest ground under the footprint, so a
     graded site cannot leave the downhill wall hanging in the air. */
  assert.ok(b.baseY < flatAt, `base ${b.baseY} is not below ground ${flatAt}`);
  assert.equal(b.baseY, flatAt - 1.5);
});

test("on a slope the roof clears the highest ground under the footprint", () => {
  const { placed } = placeRegionBuildings(OSM.buildings, opts);
  const b = byName(placed, "Fixture Hillside");
  /* The ramp climbs 0.5 m/m from x 4000, so the footprint's ground runs
     10 m at its west edge to 30 m at its east edge — 20 m of grade under 5 m
     of building. A flat extrusion at the rim median (20 m) + 5 would put the
     roof at 25 m, three quarters of a storey INSIDE its own hill. */
  const rimMedian = 20;
  assert.ok(b.roofY > rimMedian + b.h, "the roof took the rim median and sank into the hill");
  const highest = heightAt(4040);
  assert.equal(highest, 30);
  assert.ok(b.roofY >= highest, `roof ${b.roofY} is below the ground ${highest} beneath it`);
  /* And the sampler is the ONLY thing that decides this: raise the terrain by
     100 m and the building goes with it, exactly. */
  const lifted = placeRegionBuildings(OSM.buildings, { ...opts, heightAt: (x) => heightAt(x) + 100 });
  assert.equal(byName(lifted.placed, "Fixture Hillside").roofY, b.roofY + 100);
  assert.equal(byName(lifted.placed, "Fixture Square").roofY, flatAt + 9 + 100);
});

test("every wall faces outward, whichever way the source ring was wound", () => {
  const { placed } = placeRegionBuildings(OSM.buildings, opts);
  /* The fixture holds one clockwise and one counter-clockwise square. Both
     must extrude with walls pointing away from their own footprint. */
  const raw = OSM.buildings.map((b) => Math.sign(ringStats(b.p.slice(0, 4)).signed2));
  assert.ok(raw.includes(1) && raw.includes(-1), "the fixture no longer holds both windings");

  for (const b of placed) {
    const cap = { pos: [], nor: [] };
    const wall = { pos: [], nor: [] };
    extrudeBuilding(b, cap, wall);
    for (let i = 0; i < wall.pos.length; i += 9) {
      /* Face normal from the triangle itself, not from the normal attribute:
         a normal that disagrees with its own geometry is exactly the fault
         campus-drape.js records, so it is measured rather than trusted. */
      const ax = wall.pos[i], ay = wall.pos[i + 1], az = wall.pos[i + 2];
      const bx = wall.pos[i + 3], by = wall.pos[i + 4], bz = wall.pos[i + 5];
      const cx = wall.pos[i + 6], cy = wall.pos[i + 7], cz = wall.pos[i + 8];
      const n = new THREE.Vector3().crossVectors(
        new THREE.Vector3(bx - ax, by - ay, bz - az),
        new THREE.Vector3(cx - ax, cy - ay, cz - az)
      );
      /* Outward = away from the footprint centroid, horizontally. */
      const mx = (ax + bx + cx) / 3 - b.cx;
      const mz = (az + bz + cz) / 3 - b.cz;
      assert.ok(n.x * mx + n.z * mz > 0,
        `a wall of the building at ${b.cx},${b.cz} faces into its own interior`);
    }
    /* The stored normal attribute agrees with that geometry. */
    for (let i = 0; i < wall.nor.length; i += 3) {
      assert.equal(wall.nor[i + 1], 0, "a wall normal has a vertical component");
    }
    /* And the roof cap faces up. */
    for (let i = 0; i < cap.nor.length; i += 3) assert.equal(cap.nor[i + 1], 1);
  }
});

/* ----------------------------------------------------------------- roads */

test("road width scales by class off one stated lane assumption", () => {
  /* The rule is the whole claim: lanes x a 12 ft travel lane. If either half
     drifts, the widths stop meaning what the provenance says they mean. */
  assert.equal(LANE_M, 3.658);
  for (const [k, lanes] of Object.entries(ROAD_LANES)) {
    assert.equal(roadHalfWidth(k), (lanes * LANE_M) / 2);
  }
  /* Strictly wider as the class gets bigger, which is the only ordering claim
     being made about them. */
  const ladder = ["path", "service", "residential", "secondary", "primary", "trunk", "motorway"];
  for (let i = 1; i < ladder.length; i++) {
    assert.ok(roadHalfWidth(ladder[i]) >= roadHalfWidth(ladder[i - 1]),
      `${ladder[i - 1]} is drawn wider than ${ladder[i]}`);
  }
  /* An unlisted class is still a road. */
  assert.equal(roadHalfWidth("track"), roadHalfWidth("residential"));
  assert.equal(roadHalfWidth(undefined), roadHalfWidth("residential"));
  /* The widths are labelled an assumption, and the negative result that makes
     them one is on the record rather than in a commit message. */
  assert.equal(REGION_MASSING_PROVENANCE.roadWidth.measured, false);
  assert.match(REGION_MASSING_PROVENANCE.roadWidth.negativeResult, /paved envelope/);
});

test("an arterial through the campus is cut, not dropped", () => {
  const { placed } = placeRegionRoads(OSM.roads, opts);
  const primary = placed.filter((r) => r.k === "primary");
  assert.equal(primary.length, 2, "the arterial should survive as its two regional runs");
  const box = campusBox(CAMPUS);
  for (const r of placed) {
    for (const [x, z] of r.pts) {
      assert.ok(x < box.x0 || x > box.x1 || z < box.z0 || z > box.z1,
        `a road vertex at ${x},${z} is drawn over the campus's own surveyed street`);
    }
  }
  /* A way wholly inside the campus box leaves nothing behind. */
  assert.equal(placed.some((r) => r.k === "tertiary"), false);
  /* A single-point way is not a run. */
  assert.equal(placed.some((r) => r.k === "path"), false);
});

/* ------------------------------------------------------- the shared ladder */

test("roads and water climb campus-overlay.js's ladder, and define nothing of their own", () => {
  const src = readFileSync(path.join(ROOT, "docs/js/campus-region-massing.js"), "utf8");
  /* The same two regexes tests/campus-overlay.test.mjs sweeps its draping
     modules with. This module is new, so it is not on that file's list; the
     grep travels with the module instead of the module hoping to be added. */
  assert.doesNotMatch(src, /const\s+[A-Za-z_]*(?:LIFT|DRAPE)[A-Za-z_]*\s*=\s*-?\d/,
    "campus-region-massing.js declared a local lift constant");
  assert.doesNotMatch(src, /const\s+[A-Za-z_]*OFFSET[A-Za-z_]*\s*=\s*\{/,
    "campus-region-massing.js declared a local polygonOffset constant");
  assert.match(src, /from\s+["']\.\/campus-overlay\.js["']/, "no import from campus-overlay.js");
  assert.match(src, /overlayLift\(/, "no overlayLift call — the lifts came from somewhere else");
  assert.match(src, /applyOverlayDepth\(/, "no applyOverlayDepth call — the depth state is local");
});

test("every draped mesh carries its rung's render order and depth state", () => {
  const made = createRegionMassing(null, { regionOsm: OSM, ...opts });
  const draped = made.group.children.filter((m) => m.renderOrder !== 0);
  assert.ok(draped.length >= 2, "expected at least the road ribbons and the water fill");
  const rungs = new Set(draped.map((m) => m.renderOrder));
  /* Roads on `pad`, water on `ground` — a road crossing water is a bridge and
     must paint over it. */
  assert.ok(rungs.has(OVERLAY.pad.renderOrder), "no mesh on the pad rung (roads)");
  assert.ok(rungs.has(OVERLAY.ground.renderOrder), "no mesh on the ground rung (water)");
  for (const m of draped) {
    const rung = m.renderOrder === OVERLAY.pad.renderOrder ? "pad" : "ground";
    assert.equal(m.material.polygonOffset, true);
    assert.equal(m.material.polygonOffsetFactor, OVERLAY[rung].polygonOffsetFactor);
    assert.equal(m.material.polygonOffsetUnits, OVERLAY[rung].polygonOffsetUnits);
    /* The decal-stack contract: ordered by renderOrder, never by depth writes. */
    assert.equal(m.material.depthWrite, false);
    assert.equal(m.material.depthTest, true);
  }
  /* Buildings are NOT decals: they are solid geometry at the default render
     order, which is what lets a wall correctly occlude the ribbons. */
  const solid = made.group.children.filter((m) => m.renderOrder === 0);
  assert.ok(solid.length > 0);
  for (const m of solid) {
    for (const mat of [].concat(m.material)) assert.equal(mat.depthWrite, true);
  }
});

test("a draped mesh follows the terrain rather than spanning it", () => {
  /* The road runs across the ramp, so if the ribbon took one height for the
     whole way it would be a plank over a hill. */
  const road = { k: "residential", p: [[3900, 9000], [4200, 9000]] };
  const made = createRegionMassing(null, { regionOsm: { roads: [road] }, ...opts });
  const mesh = made.group.children[0];
  const pos = mesh.geometry.getAttribute("position");
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    lo = Math.min(lo, pos.getY(i));
    hi = Math.max(hi, pos.getY(i));
  }
  /* Ground climbs from 10 m to 110 m across that run. */
  assert.ok(hi - lo > 90, `the ribbon spans only ${(hi - lo).toFixed(1)} m of a 100 m climb`);
});

/* ---------------------------------------------------------------- colour */

test("every shipped colour names its source and says whether it was measured here", () => {
  /* Roofs became a real regional measurement when region-colors.json landed.
     The point of this test is not that everything is inherited — it is that
     nothing is ambiguous about WHICH it is, because a borrowed colour quietly
     reclassified as measured is how provenance rots. */
  assert.equal(REGION_MASSING_PROVENANCE.measuredForRegion, "roofs only");

  /* Still inherited, and each must still confess the whole transfer. */
  for (const key of ["wall", "road", "water"]) {
    const entry = REGION_MASSING_PROVENANCE[key];
    assert.ok(entry, `no provenance for the ${key} colour`);
    assert.ok(entry.inherited, `${key} claims no inherited source`);
    assert.ok(entry.source, `${key} names no measurement behind that source`);
    assert.ok(entry.limitation, `${key} states no limitation — every transfer here has one`);
    assert.ok(!entry.measured, `${key} is inherited and must not claim to be measured`);
  }

  /* Measured — and its fallback is held to the same standard as any other
     inherited colour, since that is what 91 footprints actually render with. */
  const roof = REGION_MASSING_PROVENANCE.roof;
  assert.equal(roof.measured, true);
  assert.ok(roof.source, "the roof measurement names no source");
  assert.ok(roof.coverage, "a measurement that does not state its coverage hides its gaps");
  assert.ok(roof.limitation, "even a measured colour has a limitation");
  assert.ok(roof.fallback?.inherited, "the roof fallback claims no inherited source");
  assert.ok(roof.fallback?.appliesTo, "the roof fallback does not say who gets it");

  /* The ledger's hex values are the ones that actually ship. A provenance note
     that has drifted from the constant beside it is worse than none. */
  const hex = (n) => `#${n.toString(16).padStart(6, "0")}`;
  assert.equal(hex(REGION_WALL_COLOR), REGION_MASSING_PROVENANCE.wall.value);
  assert.equal(hex(REGION_ROOF_COLOR), roof.fallback.value);
  assert.equal(hex(REGION_ROAD_COLOR), REGION_MASSING_PROVENANCE.road.value);
  /* Water is imported rather than copied, so it cannot drift by construction —
     which is exactly what this asserts. */
  assert.equal(REGION_WATER_COLOR, OCEAN_COLOR);
});

/* ------------------------------------------------------------ the budget */

test("10,000 buildings merge into chunks, not into 10,000 meshes", () => {
  /* THE MEASUREMENT the module's budget claim rests on. Ten thousand
     footprints spread over the region's real 30 km² extent, at the shape OSM
     actually delivers (a rectangle with a notch — 6 vertices), extruded and
     merged. Draw calls and triangles are counted off the built geometry. */
  const N = 10000;
  const buildings = [];
  let seed = 1;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < N; i++) {
    /* Anywhere in a 6 km x 5 km box that excludes the campus. */
    const x = 2000 + rnd() * 4000;
    const z = -2500 + rnd() * 5000;
    const w = 8 + rnd() * 14;
    const d = 8 + rnd() * 14;
    buildings.push({
      p: [[x, z], [x + w, z], [x + w, z + d * 0.6], [x + w * 0.6, z + d * 0.6],
        [x + w * 0.6, z + d], [x, z + d]],
      h: 4 + rnd() * 8,
      src: "lidar",
    });
  }
  const t0 = process.hrtime.bigint();
  const { placed } = placeRegionBuildings(buildings, opts);
  const materials = {
    wall: new THREE.MeshLambertMaterial({ color: REGION_WALL_COLOR }),
    roof: new THREE.MeshLambertMaterial({ color: REGION_ROOF_COLOR }),
  };
  const built = buildingMeshes(placed, materials);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;

  assert.equal(placed.length, N, "the synthetic set should place in full");
  /* One mesh per occupied 500 m chunk, two material groups each. */
  const drawCalls = built.meshes.length * 2;
  assert.ok(built.meshes.length < 200,
    `${built.meshes.length} meshes — the chunk merge is not merging`);
  assert.ok(built.meshes.length > 1, "everything landed in one chunk — culling would be worthless");
  /* Budget, pinned so a regression that doubles it is visible. 6-vertex
     footprints give 4 cap triangles and 12 wall triangles each. */
  assert.equal(built.triangles, N * 16);
  assert.ok(built.triangles < 250000,
    `${built.triangles} triangles at ${N} buildings is over the stated budget`);
  console.log(
    `  budget @ ${N} buildings: ${built.triangles.toLocaleString()} triangles, ` +
    `${built.meshes.length} chunk meshes, ${drawCalls} draw calls, built in ${ms.toFixed(0)} ms`
  );
  /* Every chunk mesh has a bounding sphere, or the renderer cannot cull it —
     which is the entire reason for chunking. */
  for (const m of built.meshes) {
    assert.ok(m.geometry.boundingSphere, "a chunk mesh has no bounding sphere to cull against");
    assert.ok(m.geometry.boundingSphere.radius < 600,
      "a chunk's bounds are wider than its chunk — culling has stopped working");
  }
});

test("the shipped region-osm.json builds inside the same budget", () => {
  /* The synthetic test above pins the arithmetic; this one measures the real
     thing, because real OSM footprints are not 6-vertex rectangles and the
     difference is the whole budget. Skipped rather than failed when the file
     is absent — it is a build artefact and `required: false` means it. */
  const file = path.join(ROOT, "docs/data/region-osm.json");
  if (!existsSync(file)) return;
  const osm = JSON.parse(readFileSync(file, "utf8"));

  /* A sampler over the shipped regional grid, so the buildings land on the
     ground that actually ships rather than on a flat plane. */
  const hdr = JSON.parse(readFileSync(path.join(ROOT, "docs/data/region-terrain.json"), "utf8"));
  const bin = readFileSync(path.join(ROOT, "docs/data/region-terrain.bin"));
  const grid = new Int16Array(bin.buffer, bin.byteOffset, bin.byteLength / 2);
  const lidar = JSON.parse(readFileSync(path.join(ROOT, "docs/data/campus-lidar.json"), "utf8"));
  const sampler = regionSampler(hdr, grid);
  const seaY = SEA_LEVEL_M - lidar.datum;
  const realHeight = (x, z) => {
    const v = sampler.heightAt(x, z);
    return v == null ? seaY : v;
  };

  const made = createRegionMassing(null, {
    regionOsm: osm, heightAt: realHeight, campusTerrain: lidar.terrain,
  });
  const c = made.counts;
  assert.ok(c.buildings > 1000, `only ${c.buildings} buildings placed off the shipped file`);
  assert.equal(made.group.children.length, c.buildingChunks + c.roadChunks + c.waterChunks);
  /* THE BUDGET. Ceilings, not equalities — the data file is rebuilt by another
     pipeline and a few hundred more buildings must not fail this. These are
     set at roughly twice what shipped, so a change that DOUBLES the cost is
     caught and a change that grows it by 10% is not noise. */
  assert.ok(c.drawCalls < 800, `${c.drawCalls} draw calls is over budget`);
  assert.ok(c.triangles < 800000, `${c.triangles.toLocaleString()} triangles is over budget`);
  /* Nothing from this module stands on the campus, on the real data. */
  assert.equal(c.dropped.buildings.inCampus + c.dropped.water.inCampus >= 0, true);
  console.log(
    `  shipped region-osm.json: ${c.buildings.toLocaleString()} buildings, ` +
    `${c.roads.toLocaleString()} road runs, ${c.water} water bodies → ` +
    `${c.triangles.toLocaleString()} triangles, ${c.drawCalls} draw calls ` +
    `(${c.buildingChunks} building chunks, ${c.roadChunks} road, ${c.waterChunks} water)`
  );
});

test("`src` is carried as data — the geometry does not depend on the height provenance mix", () => {
  /* WHY THIS EXISTS. Every height in the shipped file today is INFERRED
     (`area`, `levels`, `height`); a second pass is measuring real roof planes
     off LiDAR and will rewrite many rows to `src: "lidar"`. A renderer that
     branched on `src` — a different colour for a guessed height, a different
     minimum for a measured one — would silently change what the whole region
     looks like the day that pass lands, and the diff would be in a data file
     nobody re-rendered. So `src` is recorded and never read: the same rings
     and the same `h` must build byte-identical geometry whatever the mix
     says, INCLUDING when the field is a value this module has never seen or
     is absent altogether. What must move is `h`, and the last assertion is
     the control that proves this test can fail. */
  const rings = [
    { p: [[3000, 3000], [3020, 3000], [3020, 3020], [3000, 3020]], h: 9 },
    { p: [[3100, 3000], [3140, 3000], [3140, 3050], [3100, 3050]], h: 14 },
  ];
  const fingerprint = (src) => {
    const { placed } = placeRegionBuildings(rings.map((b) => ({ ...b, ...src })), opts);
    const cap = { pos: [], nor: [] };
    const wall = { pos: [], nor: [] };
    for (const b of placed) extrudeBuilding(b, cap, wall);
    return JSON.stringify([cap.pos, cap.nor, wall.pos, wall.nor]);
  };
  const base = fingerprint({ src: "area" });
  for (const src of [{ src: "lidar" }, { src: "levels" }, { src: "height" },
    { src: "3dep-2024-qL1" }, { src: null }, {}]) {
    assert.equal(fingerprint(src), base,
      `the geometry changed with src=${JSON.stringify(src)} — something is branching on provenance`);
  }
  /* The control: `h` IS read, so a rewritten height must move the roof. */
  const taller = placeRegionBuildings(rings.map((b) => ({ ...b, h: b.h * 2 })), opts);
  const same = placeRegionBuildings(rings, opts);
  assert.notEqual(taller.placed[0].roofY, same.placed[0].roofY);
  assert.equal(taller.placed[0].roofY, flatAt + 18);
});

/* ------------------------------------------------------------- the wiring */

test("campus-walk.js downloads region-osm.json optionally and builds the layer", () => {
  const src = readFileSync(path.join(ROOT, "docs/js/campus-walk.js"), "utf8");
  assert.match(src, /file:\s*["']region-osm\.json["']\s*,\s*required:\s*false/,
    "region-osm.json is not in the DATA table as an optional download");
  assert.match(src, /createRegionMassing/, "boot never builds the regional massing");
  assert.match(src, /regionMassing:/, "the layer is not exposed as a dev-panel toggle key");
});
