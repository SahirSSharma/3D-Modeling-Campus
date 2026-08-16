/* Revelle's photo-sourced detail section.
 *
 * This is the INVENTED class, so the gates are about quarantine and about
 * not contradicting the measured world:
 *
 *   - it is labelled, epoch-stamped and sourced, and it says what it left out;
 *   - colours are data, and they are hex;
 *   - nothing it places sits inside a measured building footprint (the same
 *     rule corridor.test.mjs enforces for the route);
 *   - nothing solid it places sits within 3 m of the corridor-staging
 *     centreline, because the scooter run crosses Revelle Plaza;
 *   - the paving decals stay inside the MEASURED Revelle Plaza polygon;
 *   - every architectural system is anchored to a measured ring, not to a
 *     number somebody liked.
 *
 * The section lives under the `revelle` key of docs/data/campus-photo-detail.json.
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
const section = merged ? read(PHOTO_DOC).revelle : null;

const campus = read("docs/data/campus-3d.json");
const staging = read("docs/data/corridor-staging.json");

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

/* Every discrete object the section places. */
const ITEM_GROUPS = [
  "benchesA", "benchesB", "kiosks", "lamps", "globes", "bins", "racks", "lavaWalls",
];
const solids = () => ITEM_GROUPS.flatMap((k) => section[k].items);

/* The built extent of each anchored system, sampled the way the renderer
   draws it, so these gates see the whole thing and not just its endpoints. */
function systemPoints() {
  const s = section.systems;
  const out = [];
  const a = s.yorkArcade;
  for (let i = 0; i < a.columns; i++) {
    out.push([a.faceX - a.standoff, a.z0 + ((a.z1 - a.z0) * i) / (a.columns - 1)]);
  }
  const f = s.yorkFins;
  for (let z = f.z0; z <= f.z1; z += f.spacing) out.push([f.faceX - f.depth / 2 + 0.05, z]);
  const g = s.galbraith;
  for (let x = g.x0; x <= g.x1; x += 2) {
    out.push([x, g.faceZ - g.columnStandoff]);
    out.push([x, g.faceZ - g.overhang]);
  }
  const u = s.ureyCorner;
  for (let x = u.slabA[0]; x <= u.slabB[1]; x += 1) out.push([x, u.faceZ + u.standoff]);
  const b = s.breezeway;
  for (const x of [b.centreX - b.deckWidth / 2, b.centreX, b.centreX + b.deckWidth / 2]) {
    for (let z = b.z0; z <= b.z1; z += 2) out.push([x, z]);
  }
  return out;
}

/* Revelle's envelope, taken from the measured rings rather than typed in. */
function revelleBounds() {
  const names = [
    "York Hall", "Urey Hall", "Galbraith Hall", "Mayer Hall",
    "Argo Hall", "Blake Hall", "Bonner Hall", "Revelle Commons",
  ];
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  const eat = (p) => {
    for (const [x, z] of p) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      z0 = Math.min(z0, z); z1 = Math.max(z1, z);
    }
  };
  for (const b of campus.buildings) if (names.includes(b.n)) eat(b.p);
  eat(campus.surfaces.find((s) => s.n === "Revelle Plaza").p);
  return { x0: x0 - 15, z0: z0 - 15, x1: x1 + 15, z1: z1 + 15 };
}

test("the merged photo document carries a revelle section", () => {
  assert.ok(merged, `${PHOTO_DOC} is missing — the revelle section has nowhere to live`);
  assert.ok(section, `${PHOTO_DOC} has no "revelle" key`);
});

test("it says what it is, where it came from, and what it left out", () => {
  assert.match(section.label, /Revelle/i);
  assert.ok(section.epoch, "no epoch stamp");
  assert.match(section.note, /INVENTED/, "the note must declare the class");
  assert.ok(Array.isArray(section.sources) && section.sources.length >= 8);
  for (const url of section.sources) assert.match(url, /^https:\/\//);
  assert.ok(Array.isArray(section.absent) && section.absent.length >= 5,
    "better absent than wrong — the gaps have to be written down");
  for (const gap of section.absent) assert.equal(typeof gap, "string");
});

test("colours are data, and they are hex", () => {
  const keys = Object.keys(section.colors);
  assert.ok(keys.length >= 20, `only ${keys.length} colours`);
  for (const [k, v] of Object.entries(section.colors)) {
    assert.match(v, /^#[0-9a-f]{6}$/, `${k} is not a lowercase 6-digit hex`);
  }
});

test("every group carries a source tag and some items", () => {
  for (const k of [...ITEM_GROUPS, "paving"]) {
    assert.ok(section[k], `missing group ${k}`);
    assert.match(section[k].source, /\d{4}/, `${k} has no dated source`);
  }
  for (const k of ITEM_GROUPS) {
    assert.ok(section[k].items.length > 0, `${k} is empty`);
    for (const it of section[k].items) {
      assert.equal(typeof it.x, "number");
      assert.equal(typeof it.z, "number");
      assert.ok(Number.isFinite(it.x) && Number.isFinite(it.z));
    }
  }
});

test("everything sits inside Revelle", () => {
  const b = revelleBounds();
  const pts = [
    ...solids().map((it) => [it.x, it.z]),
    ...section.paving.cells,
    ...section.paving.runner.map((z) => [section.paving.runnerX, z]),
    ...systemPoints(),
  ];
  for (const [x, z] of pts) {
    assert.ok(x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1,
      `(${x}, ${z}) is outside Revelle ${JSON.stringify(b)}`);
  }
});

test("nothing invented sits inside a measured building footprint", () => {
  const rings = campus.buildings.filter((b) => b.p && b.p.length >= 3);
  const pts = [
    ...solids().map((it) => [it.x, it.z]),
    ...section.paving.cells,
    ...section.paving.runner.map((z) => [section.paving.runnerX, z]),
    ...systemPoints(),
  ];
  for (const [x, z] of pts) {
    for (const b of rings) {
      assert.ok(!inRing(x, z, b.p), `(${x}, ${z}) is inside ${b.n || "an unnamed mass"}`);
    }
  }
});

test("no solid object crowds the scooter corridor", () => {
  /* The run crosses Revelle Plaza on its way to Peterson. Flat decals under
     the track are fine; anything you can hit is not. */
  let worst = Infinity;
  let at = null;
  for (const [x, z] of [...solids().map((it) => [it.x, it.z]), ...systemPoints()]) {
    const d = toRoute(x, z);
    if (d < worst) { worst = d; at = [x, z]; }
  }
  assert.ok(worst >= 3, `closest solid is ${worst.toFixed(2)} m from the centreline at ${at}`);
});

test("the paving decals stay inside the measured plaza polygon", () => {
  const plaza = campus.surfaces.find((s) => s.n === "Revelle Plaza" && s.kind === "plaza");
  for (const [x, z] of section.paving.cells) {
    assert.ok(inRing(x, z, plaza.p), `paving cell (${x}, ${z}) is off the measured plaza`);
  }
  for (const z of section.paving.runner) {
    assert.ok(inRing(section.paving.runnerX, z, plaza.p), `runner segment at z ${z} is off the plaza`);
  }
  assert.ok(section.paving.band > 0.3 && section.paving.band < 0.5, "narrow band is 0.35-0.45 m");
  assert.ok(section.paving.runnerWidth > section.paving.band * 2, "the central runner is the wide one");
});

test("every architectural system is anchored to a measured ring", () => {
  const ringOf = (name) => campus.buildings.find((b) => b.n === name).p;
  const minX = (p) => Math.min(...p.map(([x]) => x));
  const minZ = (p) => Math.min(...p.map(([, z]) => z));
  const maxZ = (p) => Math.max(...p.map(([, z]) => z));
  const s = section.systems;

  assert.equal(s.yorkArcade.faceX, minX(ringOf("York Hall")), "the arcade must sit on York's measured west face");
  assert.equal(s.yorkFins.faceX, s.yorkArcade.faceX, "the fins ride the same face as the arcade");
  assert.equal(s.galbraith.faceZ, minZ(ringOf("Galbraith Hall")), "the soffit must sit on Galbraith's measured north face");
  assert.equal(s.ureyCorner.faceZ, maxZ(ringOf("Urey Hall")), "the stair towers must sit on Urey's measured plaza face");
  assert.equal(s.breezeway.z0, maxZ(ringOf("Bonner Hall")), "the breezeway must start at Bonner's measured face");

  /* The breezeway spans the gap; it may not land on either building. */
  assert.ok(s.breezeway.z1 > s.breezeway.z0, "the breezeway has to span forwards");
  assert.ok(s.breezeway.z1 <= minZ(ringOf("Mayer Hall")) + 35, "the breezeway overshoots Mayer");

  /* 35 sourced columns over the sourced 300-foot (92.6 m measured) arcade. */
  assert.equal(s.yorkArcade.columns, 35);
  const span = s.yorkArcade.z1 - s.yorkArcade.z0;
  assert.ok(Math.abs(span - 91.44) < 2, `arcade reads ${span.toFixed(1)} m, not the sourced 300 ft`);

  /* Photos read five breezeway levels; the lower measured roof only carries
     three at 3.6 m, and LiDAR decides height. Do not raise this to match a
     photograph. */
  const bonner = campus.buildings.find((b) => b.n === "Bonner Hall");
  assert.ok(s.breezeway.levels * s.breezeway.levelHeight <= bonner.h,
    "the breezeway is taller than the measured roof it is tucked under");
});
