/* Galbraith Hall's photo-sourced detail section.
 *
 * This is the INVENTED class, so the gates are about quarantine, about the
 * grid being derived rather than typed, and about not contradicting the
 * measured world:
 *
 *   - it is labelled, epoch-stamped and sourced, and it says what it left out;
 *   - colours are data, and they are hex;
 *   - the ring it hangs on is the MEASURED ring, byte for byte;
 *   - the strut grid lands where the derivation says it lands, and the coffer
 *     module stays a module — one number for the whole building;
 *   - every facade layer hangs within a metre of a measured ring face, and
 *     the roof reaches no further out than the oversail it declares;
 *   - the roofscape (9x9 skylight grid, block, penthouses, mech) sits inside
 *     the ring, solves on the coffer module, and NEVER stacks its [estimated]
 *     block height on top of the LiDAR maximum — curb-scale relief only;
 *   - the east ground stops at the construction line the orthophoto shows;
 *   - nothing it places sits inside a measured building footprint, and
 *     nothing it places is more than 30 m outside Galbraith's own (35 on the
 *     east, where the sourced DG band genuinely runs that far);
 *   - nothing solid sits within 3 m of the corridor-staging centreline,
 *     because the scooter run crosses Revelle Plaza just north of here;
 *   - the absent list does not shrink, and it still names what this building
 *     genuinely has no source for.
 *
 * The section lives under the `galbraith` key of docs/data/campus-photo-detail.json.
 * GALBRAITH_PHOTO_DOC may point at a pending merged document so a build agent
 * can gate a section BEFORE the main session merges it; it defaults to the
 * shipped document and grants nothing else.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as THREE from "../docs/vendor/three/three.module.min.js";
import { createPhotoGalbraith } from "../docs/js/campus-photo-galbraith.js";
import { SPECIES, treeSpecies } from "../docs/js/campus-species.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));

const PHOTO_DOC = "docs/data/campus-photo-detail.json";
const DOC_PATH = process.env.GALBRAITH_PHOTO_DOC || join(root, PHOTO_DOC);
const merged = existsSync(join(root, PHOTO_DOC));
const doc = JSON.parse(readFileSync(DOC_PATH, "utf8"));
const section = doc.galbraith;

const campus = read("docs/data/campus-3d.json");
const arcgis = read("docs/data/campus-arcgis.json");
const staging = read("docs/data/corridor-staging.json");
const RING = campus.buildings.find((b) => b.n === "Galbraith Hall").p;

const inRing = (x, z, r) => {
  let ins = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, zi] = r[i];
    const [xj, zj] = r[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
};

function toRoute(x, z) {
  const line = staging.route.points;
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, az] = line[i];
    const [bx, bz] = line[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz;
    let t = len2 ? ((x - ax) * dx + (z - az) * dz) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
    if (d < best) best = d;
  }
  return best;
}

/** Distance from a point to the measured ring, negative inside. */
function toRing(x, z) {
  let best = Infinity;
  for (let i = 0; i < RING.length; i++) {
    const [ax, az] = RING[i];
    const [bx, bz] = RING[(i + 1) % RING.length];
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz;
    let t = len2 ? ((x - ax) * dx + (z - az) * dz) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return inRing(x, z, RING) ? -best : best;
}

/** The same face frame campus-photo-galbraith.js builds, so these gates see
 *  the geometry the renderer actually draws and not a restatement of it. */
function frameOf(f) {
  let [sx, sz] = f.a;
  let [ex, ez] = f.b;
  const length = Math.hypot(ex - sx, ez - sz);
  let tx = (ex - sx) / length;
  let tz = (ez - sz) / length;
  let nx = tz;
  let nz = -tx;
  if (nx * f.out[0] + nz * f.out[1] < 0) {
    nx = -nx; nz = -nz;
    [sx, sz, ex, ez] = [ex, ez, sx, sz];
    tx = -tx; tz = -tz;
  }
  return { length, at: (u, w) => [sx + tx * u + nx * w, sz + tz * u + nz * w] };
}

/** Every strut foot, as (x, z). */
function strutFeet() {
  const out = [];
  for (const f of section.faces) {
    const frame = frameOf(f);
    for (const k of section.grid.pairIndices) {
      const c = frame.length / 2 + k * f.pairSpacing;
      for (const s of [-1, 1]) {
        out.push(frame.at(c + (s * section.grid.pairGap) / 2,
          section.facade.wallStandoff + section.column.standoff));
      }
    }
  }
  return out;
}

/** Every facade layer, sampled along each face at its own standoff. */
function facadePoints() {
  const out = [];
  const F = section.facade;
  const standoffs = [
    F.wallStandoff,
    F.wallStandoff + F.balcony.project,
    F.wallStandoff + F.terrace.project,
    F.wallStandoff + section.column.standoff,
  ];
  for (const f of section.faces) {
    const frame = frameOf(f);
    for (const w of standoffs) {
      for (let u = 0; u <= frame.length; u += 4) out.push(frame.at(u, w));
    }
  }
  return out;
}

/** The outer corners of the roof, which reach further than anything else. */
function roofPoints() {
  const out = [];
  for (const f of section.faces) {
    const frame = frameOf(f);
    for (let u = -f.ext; u <= frame.length + f.ext; u += 4) {
      out.push(frame.at(u, section.facade.wallStandoff + section.grid.roofOut));
    }
  }
  return out;
}

/** Every solid object this section stands on the ground. */
function groundSolids() {
  const out = [...strutFeet()];
  const W = section.west;
  const L = W.lavaWall;
  const n = Math.ceil(Math.hypot(L.b[0] - L.a[0], L.b[1] - L.a[1]) / 2);
  for (let i = 0; i <= n; i++) {
    out.push([L.a[0] + ((L.b[0] - L.a[0]) * i) / n, L.a[1] + ((L.b[1] - L.a[1]) * i) / n]);
  }
  for (const r of W.railings) {
    const m = Math.ceil(Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]) / 2);
    for (let i = 0; i <= m; i++) {
      out.push([r.a[0] + ((r.b[0] - r.a[0]) * i) / m, r.a[1] + ((r.b[1] - r.a[1]) * i) / m]);
    }
  }
  const S = W.stair;
  for (const z of [S.z0, S.z1]) out.push([S.x, z], [S.x + S.landing, z]);
  for (const b of section.north.bins) out.push([b.x, b.z]);
  return out;
}

const rectCorners = (r) => [[r.x0, r.z0], [r.x1, r.z1], [r.x0, r.z1], [r.x1, r.z0]];

/* What genuinely still has no source. The roof monitors and the east ground
   plane CLOSED on 2026-08-17 — the repo's own Google orthophoto saw both —
   but what replaced them may not quietly vanish either: every height on that
   roof is unmeasurable from a nadir image, and the ground beyond x ~90 is an
   active construction site in the current epoch. */
const MUST_STAY_ABSENT = [/true height/i, /construction/i];
const ABSENT_FLOOR = 10;

test("the merged photo document carries a galbraith section", () => {
  assert.ok(merged, `${PHOTO_DOC} is missing — the galbraith section has nowhere to live`);
  assert.ok(section, `the photo document has no "galbraith" key`);
});

test("the other photo sections survived it", () => {
  const shipped = read(PHOTO_DOC);
  for (const key of ["eighth", "revelle", "rady", "erc", "keeling"]) {
    assert.ok(shipped[key], `the ${key} section went missing`);
  }
  assert.ok(!shipped.revelle.systems.galbraith,
    "the first-pass Galbraith is retired — revelle.systems.galbraith must be gone");
  for (const dead of ["galbraithColumn", "galbraithSoffit", "galbraithGlass"]) {
    assert.ok(!(dead in shipped.revelle.colors), `revelle.colors.${dead} is now unused`);
  }
});

test("it says what it is, where it came from, and what it left out", () => {
  assert.match(section.label, /Galbraith/i);
  assert.ok(section.epoch, "no epoch stamp");
  assert.match(section.epoch, /orthophoto/i, "the roof/east orthophoto epoch must be stamped");
  assert.match(section.note, /INVENTED/, "the note must declare the class");
  assert.ok(Array.isArray(section.sources) && section.sources.length >= 6);
  for (const url of section.sources) assert.match(url, /^https:\/\//);
  assert.ok(Array.isArray(section.absent) && section.absent.length >= ABSENT_FLOOR,
    `better absent than wrong — the absent list may not shrink below ${ABSENT_FLOOR}`);
  for (const gap of section.absent) assert.equal(typeof gap, "string");
  for (const must of MUST_STAY_ABSENT) {
    assert.ok(section.absent.some((a) => must.test(a)),
      `${must} must stay in the absent list — there is no source for it`);
  }
});

test("colours are data, and they are hex", () => {
  const keys = Object.keys(section.colors);
  assert.ok(keys.length >= 25, `only ${keys.length} colours`);
  for (const [k, v] of Object.entries(section.colors)) {
    assert.match(v, /^#[0-9a-f]{6}$/, `${k} is not a lowercase 6-digit hex`);
  }
  assert.ok(section.colorNote, "the adjusted samples have to say they were adjusted");
  for (const k of ["skylightCap", "blockReveal", "penthouseTop", "penthouseMetal",
    "mechWall", "eastRecess", "eastWalk", "eastDg", "eastLawn", "footPad"]) {
    assert.ok(section.colors[k], `roof/east colour ${k} is missing`);
  }
});

test("the ring it hangs on is the measured ring, unchanged", () => {
  assert.deepEqual(section.ring, RING,
    "the section's ring must be campus-3d's Galbraith ring, copied verbatim");
  assert.equal(section.measured.lidarHeight, 16.6, "the LiDAR height is not this section's to pick");
  assert.equal(section.faces.length, 4);
  const ids = section.faces.map((f) => f.id).sort();
  assert.deepEqual(ids, ["east", "north", "south", "west"]);
  for (let i = 0; i < section.faces.length; i++) {
    const f = section.faces[i];
    assert.deepEqual(f.a, RING[i], `${f.id} face does not start on a measured vertex`);
    assert.deepEqual(f.b, RING[(i + 1) % RING.length], `${f.id} face does not end on one`);
  }
});

test("the strut grid is the derivation, not a number somebody liked", () => {
  const G = section.grid;
  assert.equal(G.pairsPerFace, 5, "five pairs per face — counted on the plan and in the photos");
  assert.equal(G.pairIndices.length, 5);
  assert.ok(G.calibration, "dropping the drawing's spacing has to be written down");

  for (const f of section.faces) {
    const frame = frameOf(f);
    /* Pair spacing follows the measured face: the outer struts land exactly
       endInset from its ends, which is the whole rule. */
    const want = (frame.length - 2 * G.endInset - G.pairGap) / (G.pairsPerFace - 1);
    assert.ok(Math.abs(f.pairSpacing - want) < 0.01,
      `${f.id} pairSpacing ${f.pairSpacing} != derived ${want.toFixed(3)}`);

    const us = [];
    for (const k of G.pairIndices) {
      const c = frame.length / 2 + k * f.pairSpacing;
      for (const s of [-1, 1]) us.push(c + (s * G.pairGap) / 2);
    }
    us.sort((a, b) => a - b);
    assert.equal(us.length, 10, `${f.id} does not have ten struts`);
    assert.ok(Math.abs(us[0] - G.endInset) < 0.01,
      `${f.id} outer strut is ${us[0].toFixed(2)} from the end, not ${G.endInset}`);
    assert.ok(Math.abs(frame.length - us[9] - G.endInset) < 0.01,
      `${f.id} is not symmetric about its own centre`);
    for (let i = 0; i < 10; i += 2) {
      assert.ok(Math.abs(us[i + 1] - us[i] - G.pairGap) < 1e-6,
        `${f.id} pair ${i / 2} is not ${G.pairGap} m across`);
    }
  }
});

test("the coffer module stays one module for the whole building", () => {
  const G = section.grid;
  assert.ok(Math.abs(G.module - 1.354) < 0.001, "the module is the drawing's 10.83 / 8");
  assert.ok(Math.abs(G.oversail - G.module * G.oversailModules) < 1e-6,
    "the oversail must be a whole number of coffers");
  assert.equal(G.oversailModules, 6, "six coffers of oversail, counted in two photographs");
  assert.ok(Math.abs(G.roofOut - (G.oversail + section.column.standoff)) < 1e-6,
    "the roof reaches the strut line plus the oversail, and no further");
  assert.ok(G.datumNote, "which plane these offsets are measured from has to be written down");
  const F = section.facade;
  assert.ok(F.terrace.project < section.column.standoff,
    "the terrace has to stop short of the columns that carry it");
  assert.ok(F.balcony.project < F.terrace.project, "the balcony is the narrower of the two decks");

  for (const f of section.faces) {
    const frame = frameOf(f);
    assert.ok(Math.abs(f.roofLength - (frame.length + 2 * f.ext)) < 0.01,
      `${f.id} roofLength is not its measured length plus its extensions`);
    assert.ok(Math.abs(f.cofferPitch - f.roofLength / f.coffers) < 0.01,
      `${f.id} coffer pitch does not divide its roof strip`);
    assert.ok(Math.abs(f.cofferPitch - G.module) < 0.02,
      `${f.id} coffer pitch ${f.cofferPitch} drifts off the ${G.module} module`);
  }
  /* North and south carry the corners; east and west butt into them. Without
     that the four strips overlap and the roof z-fights itself. */
  const ext = Object.fromEntries(section.faces.map((f) => [f.id, f.ext]));
  assert.ok(ext.north > 0 && ext.south > 0, "north and south must carry the roof round");
  assert.equal(ext.east, 0);
  assert.equal(ext.west, 0);
});

test("the level lines add back up to the measured height", () => {
  const L = section.levels;
  const M = section.measured;
  assert.equal(L.l1BelowRoof, M.lidarHeight, "level 1 is grade, and grade is the measured base");
  assert.ok(Math.abs(L.l2BelowRoof - (L.eavesBelowRoof + L.roofSlab + L.storey)) < 0.01,
    "the balcony line is one storey below the soffit");
  assert.ok(Math.abs(L.l1BelowRoof - (L.l2BelowRoof + L.storey)) < 0.01,
    "the two levels have to be the same storey, with no residual");
  assert.ok(L.storey > 5 && L.storey < 9, `a ${L.storey} m storey is not a storey`);
  assert.ok(M.heightNote && M.conflict,
    "the ArcGIS/LiDAR height story has to be written down, resolved or not");
});

test("the drawn ring is the university's own, copied verbatim", () => {
  const m = arcgis.massing.find((r) => r.n === "Galbraith Hall");
  const want = m.r[0].map(([x, z]) => [x / 10, z / 10]);
  assert.deepEqual(section.drawnRing, want,
    "drawnRing must be campus-arcgis's Galbraith massing ring, decimetres converted to metres");
});

test("every facade layer clears the ring the renderer actually extrudes", () => {
  /* The two surveys disagree: the university's massing stands up to 0.8 m
     outside the OSM trace. Cladding anchored to the OSM ring alone lands
     INSIDE the drawn box and vanishes, which is exactly what happened on the
     east elevation. So the gate is against both rings, and the standoff is
     pinned to the disagreement rather than to a number somebody liked. */
  let worst = 0;
  for (const f of section.faces) {
    const frame = frameOf(f);
    for (const p of section.drawnRing) {
      const [ax, az] = frame.at(0, 0);
      const [bx, bz] = frame.at(frame.length, 0);
      const tx = (bx - ax) / frame.length;
      const tz = (bz - az) / frame.length;
      const du = (p[0] - ax) * tx + (p[1] - az) * tz;
      if (du < -1 || du > frame.length + 1) continue;
      const [ox, oz] = frame.at(0, 1);
      worst = Math.max(worst, (p[0] - ax) * (ox - ax) + (p[1] - az) * (oz - az));
    }
  }
  assert.ok(Math.abs(section.drawnClearance - worst) < 0.02,
    `drawnClearance says ${section.drawnClearance}, the rings say ${worst.toFixed(3)}`);
  assert.ok(section.facade.wallStandoff > worst,
    `the glazing at ${section.facade.wallStandoff} m is inside the drawn mass, which reaches ${worst.toFixed(2)} m`);
  assert.ok(section.facade.wallStandoff <= worst + 0.3,
    "the glazing hangs as close to the wall as the two surveys allow, and no further");
  assert.ok(section.facade.wallStandoffNote, "a standoff this large has to explain itself");

  for (const [x, z] of facadePoints()) {
    const d = toRing(x, z);
    assert.ok(d >= -0.01, `a facade layer at (${x.toFixed(1)}, ${z.toFixed(1)}) is inside the mass`);
    assert.ok(d <= section.facade.wallStandoff + section.column.standoff + 0.05,
      `a facade layer stands ${d.toFixed(2)} m proud of the ring`);
  }
});

test("nothing reaches further out than the roof says it does", () => {
  /* Straight out from a face the reach is the oversail; off a corner, where
     the north and south strips run past the end of their own wall to close
     the roof, it is that same oversail on both axes at once. */
  const reach = (section.facade.wallStandoff + section.grid.roofOut) * Math.SQRT2;
  for (const [x, z] of roofPoints()) {
    const d = toRing(x, z);
    assert.ok(d <= reach + 0.2, `the roof reaches ${d.toFixed(2)} m, past its own ${reach.toFixed(2)} m corner`);
  }
});

test("everything sits inside Galbraith's ring plus thirty metres", () => {
  const pts = [
    ...facadePoints(), ...roofPoints(), ...groundSolids(),
    ...["north", "west", "south"].flatMap((k) =>
      [...(section[k].apron || []), ...(section[k].paving || []), ...(section[k].pavers || []),
       ...(section[k].beds || []), ...(section[k].lawn || []), ...(section[k].groundcover || [])]
        .flatMap(rectCorners)),
  ];
  for (const [x, z] of pts) {
    assert.ok(toRing(x, z) <= 30,
      `(${x.toFixed(1)}, ${z.toFixed(1)}) is ${toRing(x, z).toFixed(1)} m outside the ring`);
  }
  /* The east ground is the one declared exception: the orthophoto genuinely
     shows the DG band running to x ~89, which is 34.4 m off the east face,
     and it is bounded there by the construction line the section declares.
     35 m for those rects, and ONLY those. */
  const E = section.east;
  for (const [x, z] of [...E.recess, ...E.walk, ...E.dg, ...E.lawn].flatMap(rectCorners)) {
    assert.ok(toRing(x, z) <= 35,
      `east ground at (${x.toFixed(1)}, ${z.toFixed(1)}) is ${toRing(x, z).toFixed(1)} m outside the ring`);
  }
});

test("nothing invented sits inside a measured building footprint", () => {
  const others = campus.buildings.filter((b) => b.p && b.p.length >= 3 && b.n !== "Galbraith Hall");
  const eastCorners = [...section.east.recess, ...section.east.walk,
    ...section.east.dg, ...section.east.lawn].flatMap(rectCorners);
  for (const [x, z] of [...groundSolids(), ...roofPoints(), ...eastCorners]) {
    for (const b of others) {
      assert.ok(!inRing(x, z, b.p), `(${x.toFixed(1)}, ${z.toFixed(1)}) is inside ${b.n || "an unnamed mass"}`);
    }
  }
  /* The struts stand OUTSIDE Galbraith's own ring too: the measured mass is a
     solid extrusion of it, and anything inside would simply be buried. */
  for (const [x, z] of strutFeet()) {
    assert.ok(!inRing(x, z, RING), `a strut at (${x.toFixed(1)}, ${z.toFixed(1)}) is inside the measured mass`);
  }
});

test("no solid object crowds the scooter corridor", () => {
  /* The run crosses Revelle Plaza on its way to Peterson, and it passes north
     of this building. Flat decals under the track are fine; anything you can
     hit is not. The roofscape stands 16 m up on the measured box and cannot
     be hit from the ride plane, so it is exempt by construction, not by
     leniency. */
  let worst = Infinity;
  let at = null;
  for (const [x, z] of [...groundSolids(), ...facadePoints()]) {
    const d = toRoute(x, z);
    if (d < worst) { worst = d; at = [x, z]; }
  }
  assert.ok(worst >= 3,
    `closest solid is ${worst.toFixed(2)} m from the centreline at ${at.map((v) => v.toFixed(1))}`);
});

/* ------------------------------------------------------------ the roof */

test("the skylight grid solves on the coffer module, inside its block, inside the ring", () => {
  const R = section.roof;
  assert.ok(R, "the roof block is missing — the orthophoto sourced it on 2026-08-17");
  assert.match(R.source, /orthophoto|chunk_4_7/i, "the roof must name the orthophoto it was read off");

  const K = R.skylights;
  assert.equal(K.grid, 9, "9 x 9, counted on the orthophoto");
  assert.ok(Math.abs(K.pitch - 2 * section.grid.module) < 1e-9,
    "the skylight pitch is DERIVED as two coffer modules, not typed");
  assert.ok(K.pitchNote, "the raw 2.75 m measurement has to be recorded next to the derivation");
  assert.ok(K.size >= 1.15 && K.size <= 1.25, `a ${K.size} m skylight is outside the measured 1.15-1.25`);

  const B = R.block;
  assert.ok(Math.abs(K.centre[0] - (B.x0 + B.x1) / 2) < 0.01, "field centred on the block in x");
  assert.ok(Math.abs(K.centre[1] - (B.z0 + B.z1) / 2) < 0.01, "field centred on the block in z");
  const half = ((K.grid - 1) / 2) * K.pitch + K.size / 2;
  assert.ok(K.centre[0] - half > B.x0 && K.centre[0] + half < B.x1,
    "the skylight field runs off its own block in x");
  assert.ok(K.centre[1] - half > B.z0 && K.centre[1] + half < B.z1,
    "the skylight field runs off its own block in z");
  for (const [x, z] of rectCorners(B)) {
    assert.ok(inRing(x, z, RING), `block corner (${x}, ${z}) is outside the measured ring`);
  }
});

test("the roofscape never stacks its estimated heights on the LiDAR maximum", () => {
  const R = section.roof;
  assert.ok(R.block.height >= 1.5 && R.block.height <= 2.5,
    "the block height stays inside the declared [estimated] 1.5-2.5 m band");
  assert.match(R.block.heightNote, /\[estimated\]/, "the block height must say it is estimated");
  assert.match(R.datumNote, /MAXIMUM|maximum/,
    "the datum note must say LiDAR 16.6 is a maximum return");
  assert.match(R.datumNote, /double-count/i,
    "the datum note must name the double-counting this rule prevents");
  /* The executable form of the rule: nothing expressed on the roof may rise
     more than half a metre above the drawn box top, because the box top IS
     the LiDAR maximum. */
  for (const [k, v] of [["skylight curb", R.skylights.curb],
    ["block rim", R.block.rim.curb],
    ["penthouse expression", R.penthouseExpression],
    ["mech expression", R.mechExpression]]) {
    assert.ok(v > 0 && v <= 0.5, `${k} at ${v} m is not curb-scale relief`);
  }
});

test("penthouses and mech units sit at their orthophoto positions, inside the ring", () => {
  const R = section.roof;
  assert.equal(R.penthouses.length, 3, "three penthouses, counted on the orthophoto");
  assert.equal(R.mech.length, 6, "six mech enclosures, counted on the orthophoto");
  for (const r of [...R.penthouses, ...R.mech]) {
    assert.ok(r.x1 > r.x0 && r.z1 > r.z0, "degenerate roof rect");
    for (const [x, z] of rectCorners(r)) {
      assert.ok(toRing(x, z) <= 0.9,
        `roof unit corner (${x}, ${z}) stands ${toRing(x, z).toFixed(1)} m off the roof it sits on`);
    }
    /* Nothing may overlap the raised block: the orthophoto shows all nine
       units clear of it. */
    const B = R.block;
    const overlap = r.x0 < B.x1 && r.x1 > B.x0 && r.z0 < B.z1 && r.z1 > B.z0;
    assert.ok(!overlap, `a roof unit overlaps the skylight block`);
  }
  const south = R.penthouses.find((p) => p.top === "penthouseMetal");
  assert.ok(south && south.z0 > (R.block.z0 + R.block.z1) / 2,
    "the metal-roofed penthouse is the south one");
});

/* ------------------------------------------------------- the east ground */

test("the east ground is built to the construction line and not a metre past it", () => {
  const E = section.east;
  assert.ok(E, "the east ground block is missing — the orthophoto sourced it on 2026-08-17");
  assert.match(E.source, /orthophoto|chunk_4_7/i, "the east ground must name the orthophoto");
  assert.match(E.source, /\d{4}/, "east ground has no dated source");
  assert.ok(E.constructionNote && /x ?~ ?90|x ?≈ ?90/.test(E.constructionNote),
    "the construction epoch limit at x ~90 has to be declared");

  const recess = E.recess[0];
  const walk = E.walk[0];
  const dg = E.dg[0];
  for (const r of E.dg) {
    assert.ok(r.x1 <= 89.5, `a DG rect reaches x ${r.x1}, past the construction line`);
  }
  assert.ok(Math.abs((recess.x1 - recess.x0) - 2.2) < 0.25, "the shaded recess is ~2.2 m");
  assert.ok(Math.abs((walk.x1 - walk.x0) - 3.1) < 0.25, "the walk is ~3.1 m");
  assert.ok(Math.abs(recess.x0 - 54.7) < 0.15, "the recess starts at the measured east edge");
  assert.equal(walk.x0, recess.x1, "the walk butts the recess");
  assert.equal(dg.x0, walk.x1, "the DG band butts the walk");
  assert.ok(dg.x1 <= 89.5, `the DG band reaches x ${dg.x1}, past the construction line`);
  for (const r of [...E.recess, ...E.walk]) {
    assert.ok(r.z0 <= 429.4 && r.z1 >= 491.1, "recess and walk must run the full length");
  }
  for (const r of E.lawn) {
    assert.ok(r.x1 <= 89.5 && r.z1 <= 505.1, "the lawn stays inside its measured patch");
  }
  assert.ok(E.footPads && E.footPads.size >= 1.0 && E.footPads.size <= 1.4,
    "foot pads at the measured 1.0-1.4 m");
  assert.ok(E.footPadNote && /10\.83|11-12/.test(E.footPadNote),
    "the pad-spacing tension with the orthophoto has to be recorded");

  /* The east ELEVATION is still unphotographed: the face keeps claiming
     nothing beyond the systems that wrap the building. */
  const east = section.faces.find((f) => f.id === "east");
  assert.equal(east.sourced, false, "there is still no photograph of the east elevation");
  assert.equal(east.entry, false);
  assert.equal(east.terrace, false);
  assert.equal(east.lowerColonnade, false);
  assert.equal(east.flutedWall, false);
  assert.equal(east.redBand, false);
  assert.deepEqual(section.faces.filter((f) => f.redBand).map((f) => f.id), ["west"]);
  assert.equal(east.colonnade, true);
});

test("every ground group names a dated source", () => {
  for (const k of ["north", "west", "south"]) {
    assert.match(section[k].source, /\d{4}/, `${k} ground has no dated source`);
  }
  assert.match(section.grid.source, /\d{2}\.\d{2}\.\d{2}/, "the grid must name the plan sheet");
});

/* ------------------------------------------- the module, actually running */

const flatGround = () => 10;
const build = () => createPhotoGalbraith(null, {
  photo: doc, heightAt: flatGround, surfaceAt: flatGround,
});

test("the module builds the roofscape and the east ground it declares", () => {
  const { group, counts } = build();
  assert.equal(counts.skylights, section.roof.skylights.grid ** 2);
  assert.equal(counts.penthouses, 3);
  assert.equal(counts.mechUnits, 6);
  assert.equal(counts.eastPads, section.grid.pairIndices.length);
  assert.ok(counts.eastRects >= 4, "recess, walk, DG and lawn at minimum");
  assert.ok(group.children.find((c) => c.name === "galbraith-roof"), "no roof group");
  assert.ok(group.children.find((c) => c.name === "galbraith-east-ground"), "no east ground group");
});

test("the roofscape seats on the drawn box top and stays curb-scale above it", () => {
  const { group } = build();
  const roofY = flatGround() + section.measured.lidarHeight;
  const roof = group.children.find((c) => c.name === "galbraith-roof");
  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const checkY = (y, h, what) => {
    assert.ok(y - h / 2 >= roofY - 0.01, `${what} dips ${ (roofY - y + h / 2).toFixed(2)} m into the box`);
    assert.ok(y + h / 2 <= roofY + 0.5, `${what} stands ${(y + h / 2 - roofY).toFixed(2)} m over the LiDAR maximum`);
  };
  let seen = 0;
  roof.traverse((o) => {
    if (o.isInstancedMesh) {
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m);
        m.decompose(pos, q, sc);
        const h = o.geometry.type === "PlaneGeometry"
          ? 0
          : (o.geometry.parameters?.height ?? 1) * sc.y;
        checkY(pos.y, h, `roof instance of ${o.geometry.type}`);
        seen++;
      }
    } else if (o.isMesh) {
      const h = o.geometry.parameters?.height ?? 0;
      checkY(o.position.y, h, "a roof mesh");
      seen++;
    }
  });
  assert.ok(seen > 81, `only ${seen} roof objects sampled`);
});

test("the east ground lies on the drawn terrain, and the corridor gains nothing solid", () => {
  const { group } = build();
  const east = group.children.find((c) => c.name === "galbraith-east-ground");
  east.traverse((o) => {
    if (o.isMesh && !o.isInstancedMesh) {
      assert.ok(Math.abs(o.position.y - flatGround()) < 0.5,
        `an east decal floats ${(o.position.y - flatGround()).toFixed(2)} m over the ground`);
      assert.equal(o.geometry.type, "PlaneGeometry", "east ground is decals only — nothing to hit");
    }
  });
});

test("ground decals are draped over the terrain, not seated at one centre height", () => {
  /* The flat sampler above is blind to the one failure that actually shipped:
     against the real LiDAR surface the west court spans 23.5-26.9 m and the
     south lawn 24.3-27.1, and a single flat quad seated at its rect centre
     reads as a hole where the ground rises through it and a sheet in mid-air
     where it falls away. So this build runs on a rolling sampler and asserts
     every ground-decal and ground-joint vertex hugs it. */
  const sloped = (x, z) => 10 + 2 * Math.sin(x / 18) + 1.5 * Math.cos(z / 23);
  const { group } = createPhotoGalbraith(null, {
    photo: doc, heightAt: sloped, surfaceAt: sloped,
  });
  group.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  let decals = 0;
  let verts = 0;
  group.traverse((o) => {
    if (!o.isMesh || (o.name !== "ground-decal" && o.name !== "ground-joints")) return;
    decals++;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      const dy = v.y - sloped(v.x, v.z);
      assert.ok(dy > -0.02 && dy < 0.3,
        `${o.name} vertex at (${v.x.toFixed(1)}, ${v.z.toFixed(1)}) sits ${dy.toFixed(2)} m off the terrain`);
      verts++;
    }
  });
  assert.ok(decals >= 15, `only ${decals} draped ground meshes found`);
  assert.ok(verts > 2000, `only ${verts} draped vertices checked`);
});

test("two builds are byte-identical — no hidden randomness", () => {
  const a = build();
  const b = build();
  assert.deepEqual(a.counts, b.counts);
  const sig = (r) => {
    const out = [];
    r.group.traverse((o) => {
      if (o.isInstancedMesh) out.push(Array.from(o.instanceMatrix.array));
      else if (o.isMesh) out.push([o.position.x, o.position.y, o.position.z]);
    });
    return out;
  };
  assert.deepEqual(sig(a), sig(b));
});

test("the curtain wall is a near-opaque dark surface, not a tint over the massing", () => {
  /* The visual audit caught the massing box's punched-window texture reading
     straight through the declared bronze on all four faces: the library's
     default 0.35-opacity glass tints what is behind it instead of covering
     it. The facade bands and the lower glazing must be near-opaque and must
     write depth; the skylight panes may stay at the library default. */
  const { group } = build();
  let curtain = 0;
  group.traverse((o) => {
    if (o.isInstancedMesh && o.geometry.type === "PlaneGeometry" &&
        o.material.transparent && o.material.opacity >= 0.9) {
      assert.ok(o.material.depthWrite, "a near-opaque pane must write depth to occlude the massing");
      curtain += o.count;
    }
  });
  assert.ok(curtain >= 5, `only ${curtain} near-opaque curtain-wall panes — the massing shows through`);
});

test("tree re-skins carry measured rows verbatim and keep the canopy clear of the slab", (t) => {
  const T = section.treeOverrides;
  if (!T) {
    t.skip("no treeOverrides in this document yet (pre-merge shipped doc)");
    return;
  }
  /* The trunks are MEASURED: every item must be a campus-lidar row, verbatim,
     and every skip key must have a re-skin item so no stem simply vanishes. */
  const lidar = read("docs/data/campus-lidar.json");
  for (const it of T.items) {
    const row = lidar.trees.find((r) => `${r[0]},${r[1]}` === it.key);
    assert.ok(row, `treeOverrides item ${it.key} names no measured trunk`);
    assert.deepEqual([it.x, it.z, it.h, it.r], row,
      `treeOverrides item ${it.key} does not copy its measured row verbatim`);
  }
  assert.deepEqual(
    [...T.skipMeasuredKeys].sort(), T.items.map((i) => i.key).sort(),
    "every skipped measured trunk must be re-skinned, and nothing else may be skipped");
  assert.match(T.note, /INVENTED/, "the canopy re-shape must declare its class");
  assert.ok(T.wiringNote, "the walk/scooter skip-set wiring dependency has to be written down");

  /* The whole point: the rendered canopy stays below the soffit plane. And,
     since round 3, that it looks like a pruned tree while doing it — the
     first pass cleared the slab with ONE smooth flat-shaded dome on an
     untextured pole, which passed the physics and read as a placeholder. */
  const { group, counts } = build();
  assert.equal(counts.reskinnedTrees, T.items.length);
  const soffitY = flatGround() + section.measured.lidarHeight - section.levels.soffitBelowRoof;
  const cap = soffitY - (T.clearBelowSoffit ?? 0.5);
  const sub = group.children.find((c) => c.name === "galbraith-tree-reskins");
  assert.ok(sub, "no re-skin group built");

  const byName = (n) => {
    const m = sub.children.find((o) => o.name === n);
    assert.ok(m, `no ${n} mesh`);
    return m;
  };
  const lobes = byName("galbraith-canopy-lobes");
  const boles = byName("galbraith-tree-boles");

  /* Lobes, not a single sphere. A canopy carried by one body is the defect
     round 3 named, so the floor is per tree and the geometry may not be the
     old faceted icosahedron. */
  sub.traverse((o) => {
    assert.notEqual(o.geometry?.type, "IcosahedronGeometry",
      "a single flat-shaded dome is the placeholder this replaced");
  });
  assert.equal(counts.canopyLobes, lobes.count);
  assert.ok(lobes.count >= 6 * T.items.length,
    `${lobes.count} lobes for ${T.items.length} trees — that is a dome, not a canopy`);
  assert.ok(lobes.instanceColor, "lobes must carry per-instance tone or the mass reads flat");

  const rows = (mesh) => {
    const out = [];
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const m = new THREE.Matrix4();
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, m);
      m.decompose(p, q, s);
      out.push({ x: p.x, y: p.y, z: p.z, sx: s.x, sy: s.y, sz: s.z });
    }
    return out;
  };

  /* EVERY lobe below the slab, not just the crown's nominal top. */
  for (const l of rows(lobes)) {
    assert.ok(l.y + l.sy <= cap + 0.01,
      `a canopy lobe tops out at ${(l.y + l.sy).toFixed(2)}, into the soffit at ${soffitY.toFixed(2)}`);
  }

  /* Bark the whole way down, standing ON the ground: the untextured lower
     trunk was the other half of the round-3 defect. */
  assert.ok(boles.material.map && boles.material.normalMap,
    "the bole carries no bark texture");
  for (const b of rows(boles)) {
    assert.ok(Math.abs((b.y - b.sy / 2) - flatGround()) < 0.05,
      `a bole starts ${(b.y - b.sy / 2 - flatGround()).toFixed(2)} m off the ground`);
    assert.ok(b.sy > 3, "a bole that short is a stump, not a trunk");
  }

  /* Pruned AWAY from the building: the canopy's centre of mass has to sit
     outboard of the trunk, on the bearing from the nearest ring corner. */
  for (const it of T.items) {
    let bx = 1;
    let bz = 0;
    let best = Infinity;
    for (const [cx, cz] of section.ring) {
      const d = Math.hypot(it.x - cx, it.z - cz);
      if (d < best && d > 1e-6) { best = d; bx = (it.x - cx) / d; bz = (it.z - cz) / d; }
    }
    const mine = rows(lobes).filter((l) => Math.hypot(l.x - it.x, l.z - it.z) < it.r * 3);
    const cx = mine.reduce((s, l) => s + l.x, 0) / mine.length;
    const cz = mine.reduce((s, l) => s + l.z, 0) / mine.length;
    assert.ok((cx - it.x) * bx + (cz - it.z) * bz > 0.2,
      "the canopy is centred on its trunk — the prune away from the slab is not expressed");
  }

  /* THE PRUNE IS A CLEARANCE, NOT A LEAN. Round 4 caught the crown pressed
     into the facade: leaning the inboard clumps shortened their reach but a
     lobe is a BODY, and its SURFACE was still standing 1.5 m inside the
     measured ring and through the curtain wall. Every lobe's horizontal
     radius must clear the outermost thing on that wall — the corner pier
     face at wallStandoff + 0.14. */
  const faceOut = section.facade.wallStandoff + 0.14;
  for (const l of rows(lobes)) {
    const reach = Math.max(l.sx, l.sz);
    const d = toRing(l.x, l.z);
    assert.ok(d - reach >= faceOut,
      `a canopy lobe's surface reaches to ${(d - reach).toFixed(2)} m off the ring, inside the facade at ${faceOut.toFixed(2)}`);
  }

  const one = T.items[0];
  const pick = [one.x, one.z, one.h, one.r];

  /* Colour space. campus-species hands back hexToRgb of a hex string — plain
     sRGB byte fractions — and putting those into THREE's LINEAR working space
     renders the bark 60% too bright and the leaf nearly 3x, which is what made
     this tree read as pale sage next to plaza trees reaching the SAME hexes
     through THREE's hex parser. The gate is against the species hex itself, so
     it fails the moment the conversion is dropped again. */
  for (const [mesh, hex, what] of [
    [boles, SPECIES[treeSpecies(...pick)].trunk, "bark"],
    [lobes, SPECIES[treeSpecies(...pick)].leaf, "leaf"],
  ]) {
    const want = new THREE.Color(hex);
    const got = mesh.material.color;
    for (const ch of ["r", "g", "b"]) {
      assert.ok(Math.abs(got[ch] - want[ch]) <= want[ch] * 0.25 + 0.02,
        `the ${what} is ${got[ch].toFixed(3)} against the species hex ${hex} at ${want[ch].toFixed(3)} — sRGB fractions stored as linear`);
    }
  }
});

test("the material library is actually on the surfaces", () => {
  const { group } = build();
  let textured = 0;
  let glass = 0;
  group.traverse((o) => {
    if (o.isMesh && o.material) {
      if (o.material.map && o.material.normalMap && o.material.roughnessMap) textured++;
      if (o.material.transparent && o.material.opacity < 1 && o.material.envMapIntensity > 1) glass++;
    }
  });
  assert.ok(textured >= 20, `only ${textured} textured meshes — the library is not applied`);
  assert.ok(glass >= 2, "the glazing does not carry the library's reflective glass");
});

test("the corners are solid end panels, not the massing box's window grid", () => {
  /* The round-2 visual audit caught the measured massing showing at every
     corner: the glazing planes hang proud of their own faces and stop at
     their own ends, so the drawn box's corner stood bare between them and
     wore campus-massing's punched-window texture — a dozen mini-storeys of
     office windows on a two-storey building. The inventory has solid end
     panels there and nothing fenestrated, so the gates are: one pier per
     corner, each one covering the DRAWN corner in plan, standing at least as
     proud as the glass on both of the faces that can see it, spanning the
     whole glazed height, and opaque in the curtain wall's own sampled tone. */
  const { group, counts } = build();
  const piers = group.children.find((c) => c.name === "galbraith-corner-piers");
  assert.ok(piers, "no corner piers built");
  assert.equal(counts.cornerPiers, section.faces.length, "one pier per ring corner");
  assert.equal(piers.count, section.faces.length);

  assert.ok(!piers.material.transparent, "an end PANEL is solid, not glazed");
  assert.equal(new THREE.Color(section.colors.glass).getHexString(),
    piers.material.color.getHexString(),
    "the pier must wear the curtain wall's own sampled bronze, not a new hex");

  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  const m = new THREE.Matrix4();
  const boxes = [];
  for (let i = 0; i < piers.count; i++) {
    piers.getMatrixAt(i, m);
    m.decompose(pos, quat, scl);
    const r = new THREE.Euler().setFromQuaternion(quat, "YXZ").y;
    const ex = [Math.cos(r), -Math.sin(r)];
    const ez = [Math.sin(r), Math.cos(r)];
    const c = [];
    for (const a of [-0.5, 0.5]) {
      for (const b of [-0.5, 0.5]) {
        c.push([pos.x + ex[0] * scl.x * a + ez[0] * scl.z * b,
                pos.z + ex[1] * scl.x * a + ez[1] * scl.z * b]);
      }
    }
    boxes.push({ corners: c, y0: pos.y - scl.y / 2, y1: pos.y + scl.y / 2 });
  }

  /* A convex-quad point test, since the piers are square but not axis-aligned. */
  const covers = (b, x, z) => {
    const q = [b.corners[0], b.corners[1], b.corners[3], b.corners[2]];
    let sign = 0;
    for (let i = 0; i < 4; i++) {
      const [ax, az] = q[i];
      const [bx, bz] = q[(i + 1) % 4];
      const s = Math.sign((bx - ax) * (z - az) - (bz - az) * (x - ax));
      if (s === 0) continue;
      if (sign === 0) sign = s;
      else if (s !== sign) return false;
    }
    return true;
  };

  /* Along a face the drawn ring is already behind a glazing plane (the
     standoff gate above pins that); what stood bare is the drawn ring where
     it turns the corner, so every drawn vertex within 1.5 m of a measured
     corner has to be inside a pier, and every corner has to have one. */
  for (const [cx, cz] of RING) {
    const near = section.drawnRing.filter(([x, z]) => Math.hypot(x - cx, z - cz) <= 1.5);
    assert.ok(near.length, `no drawn vertex turns the corner at (${cx}, ${cz})`);
    for (const [x, z] of near) {
      assert.ok(boxes.some((b) => covers(b, x, z)),
        `the drawn massing corner (${x}, ${z}) is not covered by any pier`);
    }
  }

  /* Proud of the glazing on both faces, so no corner of the box peeks out
     alongside a pane that already stands 0.99 m off the ring. */
  const glassOut = section.facade.wallStandoff + 0.04;
  for (const f of section.faces) {
    const frame = frameOf(f);
    const [ox, oz] = frame.at(0, 0);
    const [nx, nz] = [frame.at(0, 1)[0] - ox, frame.at(0, 1)[1] - oz];
    for (const end of [0, frame.length]) {
      const [ex, ez] = frame.at(end, 0);
      const near = boxes
        .map((b) => ({ b, d: Math.min(...b.corners.map(([x, z]) => Math.hypot(x - ex, z - ez))) }))
        .sort((a, c) => a.d - c.d)[0].b;
      const reach = Math.max(...near.corners.map(([x, z]) => (x - ox) * nx + (z - oz) * nz));
      assert.ok(reach >= glassOut,
        `the ${f.id} face's pier reaches ${reach.toFixed(2)} m, inside its own glass at ${glassOut}`);
    }
  }

  /* Full height: below the grade the module was handed, up to the soffit. */
  const roofY = flatGround() + section.measured.lidarHeight;
  for (const b of boxes) {
    assert.ok(b.y0 <= flatGround(), `a pier starts ${b.y0.toFixed(2)} m above the ground`);
    assert.ok(b.y1 >= roofY - section.levels.soffitBelowRoof,
      `a pier tops out at ${b.y1.toFixed(2)}, short of the soffit`);
  }
});

/** How far the DRAWN mass stands outside this one face of the OSM ring. */
function drawnClearanceOf(f) {
  const frame = frameOf(f);
  const [ax, az] = frame.at(0, 0);
  const [bx, bz] = frame.at(frame.length, 0);
  const tx = (bx - ax) / frame.length;
  const tz = (bz - az) / frame.length;
  const [ox, oz] = frame.at(0, 1);
  let worst = 0;
  for (const [px, pz] of section.drawnRing) {
    const du = (px - ax) * tx + (pz - az) * tz;
    if (du < -1 || du > frame.length + 1) continue;
    worst = Math.max(worst, (px - ax) * (ox - ax) + (pz - az) * (oz - az));
  }
  return worst;
}

test("every glazing band has an opaque backing between it and the massing", () => {
  /* The curtain wall keeps the library's reflective glass, so it is
     transparent by construction and the measured massing's punched-window
     texture read through it as pale grey squares on all four elevations. The
     fix is something opaque for the pane to be transparent AGAINST. The gates:
     a backing for every pane, opaque, in a colour the section already carries,
     and — the part that is easy to get wrong — INBOARD of its own glass but
     still OUTBOARD of the drawn mass on ITS OWN FACE. wallStandoff is pinned
     to the east elevation's 0.80 m disagreement; the south and west are at
     0.13. One depth for all four buries the east backing inside the box. */
  const { group, counts } = build();
  const back = group.children.find((c) => c.name === "galbraith-glass-backing");
  assert.ok(back, "no glazing backing built");

  const panes = [];
  group.traverse((o) => {
    if (o.isInstancedMesh && o.geometry.type === "PlaneGeometry" &&
        o.material.transparent && o.material.opacity >= 0.9) panes.push(o);
  });
  const paneCount = panes.reduce((n, o) => n + o.count, 0);
  assert.equal(counts.glassBackings, paneCount,
    `${paneCount} near-opaque panes but ${counts.glassBackings} backings`);
  assert.equal(back.count, paneCount);

  assert.ok(!back.material.transparent, "the backing is what the glass is seen against — it must be opaque");
  assert.equal(new THREE.Color(section.colors.glassLower).getHexString(),
    back.material.color.getHexString(),
    "the backing must use a tone the section already samples, not a new hex");

  /* Pull every backing and every pane out as (x, y, z, halfWidth). */
  const rows = (mesh) => {
    const out = [];
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const m = new THREE.Matrix4();
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, m);
      m.decompose(p, q, s);
      out.push({ x: p.x, y: p.y, z: p.z, w: s.x, h: s.y });
    }
    return out;
  };
  const backs = rows(back);
  const glass = panes.flatMap(rows);

  for (const f of section.faces) {
    const frame = frameOf(f);
    const [ox, oz] = frame.at(0, 0);
    const [nx, nz] = [frame.at(0, 1)[0] - ox, frame.at(0, 1)[1] - oz];
    const off = (r) => (r.x - ox) * nx + (r.z - oz) * nz;
    const along = (r) => {
      const [bx, bz] = frame.at(frame.length, 0);
      const u = ((r.x - ox) * (bx - ox) + (r.z - oz) * (bz - oz)) / frame.length;
      return u >= -1 && u <= frame.length + 1;
    };
    const clear = drawnClearanceOf(f);
    const mine = backs.filter((r) => along(r) && Math.abs(off(r) - (section.facade.wallStandoff + 0.04)) < 1);
    for (const b of mine) {
      const d = off(b);
      assert.ok(d > clear,
        `the ${f.id} backing sits at ${d.toFixed(2)} m, inside its own drawn mass at ${clear.toFixed(2)}`);
      assert.ok(d < section.facade.wallStandoff + 0.04,
        `the ${f.id} backing at ${d.toFixed(2)} m is not behind its glass`);
      /* Every pane on this face at this height must be in front of it, and
         the backing must be no smaller than the pane it hides. */
      const pane = glass.find((g) => along(g) && Math.abs(g.y - b.y) < 0.35 &&
        Math.abs(off(g) - (section.facade.wallStandoff + 0.04)) < 0.2);
      assert.ok(pane, `a ${f.id} backing at y ${b.y.toFixed(1)} covers no pane`);
      assert.ok(off(pane) > d, "the glass must stand outboard of its own backing");
      assert.ok(b.w >= pane.w - 0.01 && b.h >= pane.h - 0.01,
        `the ${f.id} backing is smaller than the pane it hides`);
    }
  }

  /* The east elevation is the reason the depth is per-face: it has under a
     quarter of a metre to work in, the south and west most of a metre. */
  const east = section.faces.find((f) => f.id === "east");
  const west = section.faces.find((f) => f.id === "west");
  assert.ok(drawnClearanceOf(east) > drawnClearanceOf(west) + 0.4,
    "if the faces ever agree, the per-face depth stops being load-bearing — re-read this test");
});
