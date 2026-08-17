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
 *   - nothing it places sits inside a measured building footprint, and
 *     nothing it places is more than 30 m outside Galbraith's own;
 *   - nothing solid sits within 3 m of the corridor-staging centreline,
 *     because the scooter run crosses Revelle Plaza just north of here;
 *   - the absent list does not shrink, and it still names the two things this
 *     building genuinely has no source for.
 *
 * The section lives under the `galbraith` key of docs/data/campus-photo-detail.json.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));

const PHOTO_DOC = "docs/data/campus-photo-detail.json";
const merged = existsSync(join(root, PHOTO_DOC));
const section = merged ? read(PHOTO_DOC).galbraith : null;

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

/* The two things this building has no source for at all. They are named
   explicitly because they are the entries most likely to be quietly dropped
   by a later pass that wants the model to look more finished. */
const MUST_STAY_ABSENT = [/roof monitor/i, /east ground plane/i];
const ABSENT_FLOOR = 10;

test("the merged photo document carries a galbraith section", () => {
  assert.ok(merged, `${PHOTO_DOC} is missing — the galbraith section has nowhere to live`);
  assert.ok(section, `${PHOTO_DOC} has no "galbraith" key`);
});

test("the other photo sections survived it", () => {
  const doc = read(PHOTO_DOC);
  for (const key of ["eighth", "revelle", "rady", "erc", "keeling"]) {
    assert.ok(doc[key], `the ${key} section went missing`);
  }
  assert.ok(!doc.revelle.systems.galbraith,
    "the first-pass Galbraith is retired — revelle.systems.galbraith must be gone");
  for (const dead of ["galbraithColumn", "galbraithSoffit", "galbraithGlass"]) {
    assert.ok(!(dead in doc.revelle.colors), `revelle.colors.${dead} is now unused`);
  }
});

test("it says what it is, where it came from, and what it left out", () => {
  assert.match(section.label, /Galbraith/i);
  assert.ok(section.epoch, "no epoch stamp");
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
    "the ArcGIS/LiDAR disagreement is unresolved and must say so");
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
        .flatMap((r) => [[r.x0, r.z0], [r.x1, r.z1], [r.x0, r.z1], [r.x1, r.z0]])),
  ];
  for (const [x, z] of pts) {
    assert.ok(toRing(x, z) <= 30,
      `(${x.toFixed(1)}, ${z.toFixed(1)}) is ${toRing(x, z).toFixed(1)} m outside the ring`);
  }
});

test("nothing invented sits inside a measured building footprint", () => {
  const others = campus.buildings.filter((b) => b.p && b.p.length >= 3 && b.n !== "Galbraith Hall");
  for (const [x, z] of [...groundSolids(), ...roofPoints()]) {
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
     hit is not. */
  let worst = Infinity;
  let at = null;
  for (const [x, z] of [...groundSolids(), ...facadePoints()]) {
    const d = toRoute(x, z);
    if (d < worst) { worst = d; at = [x, z]; }
  }
  assert.ok(worst >= 3,
    `closest solid is ${worst.toFixed(2)} m from the centreline at ${at.map((v) => v.toFixed(1))}`);
});

test("the east elevation claims nothing about its ground", () => {
  const east = section.faces.find((f) => f.id === "east");
  assert.equal(east.sourced, false, "there is no photograph of the east elevation");
  assert.equal(east.entry, false);
  assert.equal(east.terrace, false);
  assert.equal(east.lowerColonnade, false);
  assert.equal(east.flutedWall, false);
  assert.equal(east.redBand, false);
  /* The red band is read off ucsdmap.jpg, which sees only the west. */
  assert.deepEqual(section.faces.filter((f) => f.redBand).map((f) => f.id), ["west"]);
  /* It still gets the colonnade and the roof, because those wrap the building
     and leaving one side of a continuous roof off would be the bigger lie. */
  assert.equal(east.colonnade, true);
  for (const key of ["north", "west", "south"]) assert.ok(section[key], `${key} ground is missing`);
  assert.ok(!section.east, "there must be no east ground block at all");
});

test("every ground group names a dated source", () => {
  for (const k of ["north", "west", "south"]) {
    assert.match(section[k].source, /\d{4}/, `${k} ground has no dated source`);
  }
  assert.match(section.grid.source, /\d{2}\.\d{2}\.\d{2}/, "the grid must name the plan sheet");
});
