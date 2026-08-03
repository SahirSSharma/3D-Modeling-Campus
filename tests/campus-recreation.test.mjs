// The Muir athletics invariants: one net per painted court, never beside it.
//
// placeRecreation() is pure, so these run the exact placement the renderer
// uses. The counts here are what the aerial references actually carry —
// SIX tennis courts (two green, four blue, pixel-scanned rather than
// eyeballed) and TWO sand nets on one centred row — so a future refit of
// campus-markings.json that loses or duplicates a court fails here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { placeRecreation, REC_COLORS } from "../docs/js/campus-recreation.js";

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs", "data");
const markings = JSON.parse(readFileSync(path.join(DATA, "campus-markings.json")));
const r = placeRecreation(markings);

const facility = (id) => markings.facilities.find((f) => f.id === id);
const CENTROID = (() => {
  const b = facility("muir-basketball").bounds;
  return [
    b.reduce((s, p) => s + p[0], 0) / b.length,
    b.reduce((s, p) => s + p[1], 0) / b.length,
  ];
})();

/** Point-in-quad, for "does this net stand on its own court". */
const inQuad = (x, z, q) => {
  let ins = false;
  for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
    const [xi, zi] = q[i];
    const [xj, zj] = q[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
};

test("the families are the counts the aerials carry", () => {
  assert.equal(r.tennisNets.length, 6, "six Muir tennis courts, six nets");
  assert.equal(r.hoops.length, 8, "two full courts: four end hoops, four cross-court");
  assert.equal(r.courtLights.length, 6, "three columns of light poles, two rows deep");
  assert.equal(r.volleyNets.length, 2, "the sand carries one centred row of two nets");
  assert.equal(r.tents.length, 2);
  assert.equal(r.terraceMats.length, 6);
  const rigs = r.rigs.length + r.terraceRigs.length;
  assert.ok(rigs >= 10 && rigs <= 20, `${rigs} calisthenics rigs is outside the aerial's 10-20`);
  assert.ok(r.cars.length >= 4 && r.cars.length <= 8, `${r.cars.length} cars in the Gymnasium Lot`);
});

test("every tennis net stands across the court it belongs to", () => {
  const courts = r.tennisCourts.map((c) => c.poly);
  assert.equal(courts.length, r.tennisNets.length);
  for (const n of r.tennisNets) {
    const len = Math.hypot(n.bx - n.ax, n.bz - n.az);
    /* Doubles net: 10.97 m of court plus 0.914 m of post either side. */
    assert.ok(len > 12.6 && len < 13.3, `net is ${len.toFixed(2)} m between posts`);
    const mx = (n.ax + n.bx) / 2;
    const mz = (n.az + n.bz) / 2;
    assert.ok(courts.some((q) => inQuad(mx, mz, q)),
      `net centre (${mx.toFixed(1)}, ${mz.toFixed(1)}) is on no painted court`);
  }
});

test("the end hoops land on the fitted three-point arc centres", () => {
  /* campus-markings.json fits each three-point arc about the basket. If the
     derivation from the court rectangle is right, the ring centres fall on
     those arc centres to within the fit's own error. */
  const arcs = facility("muir-basketball").markings
    .filter((mk) => mk.kind === "arc" && mk.r > 6)
    .map((mk) => mk.c);
  assert.equal(arcs.length, 4);
  for (const c of arcs) {
    const near = r.hoops.some((h) => Math.hypot(h.x - c[0], h.z - c[1]) < 0.35);
    assert.ok(near, `no hoop at the arc centre (${c[0]}, ${c[1]})`);
  }
  /* And the other four sit at mid-length on the sidelines, not the ends. */
  const cross = r.hoops.filter((h) => Math.abs(h.z - 44.0) < 0.5);
  assert.equal(cross.length, 4, "four cross-court hoops on the centre line");
});

test("nothing strays out of the Muir athletics zone", () => {
  const pts = [
    ...r.tennisNets.map((n) => ({ x: n.ax, z: n.az })),
    ...r.hoops, ...r.courtLights, ...r.rigs, ...r.terraceRigs,
    ...r.volleyNets.map((n) => ({ x: n.ax, z: n.az })),
    ...r.picnicTables, ...r.cars, ...r.tents,
    ...r.terraceMats.map((m) => ({ x: m.x0, z: m.z0 })),
  ];
  const far = pts.filter((p) => Math.hypot(p.x - CENTROID[0], p.z - CENTROID[1]) > 400);
  assert.deepEqual(far, [], `${far.length} placements more than 400 m from the basketball pad`);
});

test("rigs and mats stay on their own pads", () => {
  const on = (p, pad, slack = 0.5) =>
    p.x >= pad.x0 - slack && p.x <= pad.x1 + slack && p.z >= pad.z0 - slack && p.z <= pad.z1 + slack;
  for (const g of r.rigs) assert.ok(on(g, r.barPad), `rig at (${g.x.toFixed(1)}, ${g.z.toFixed(1)}) is off the rubber`);
  for (const m of r.terraceMats) {
    assert.ok(on({ x: m.x0, z: m.z0 }, r.terracePad) && on({ x: m.x1, z: m.z1 }, r.terracePad),
      "a tan mat hangs off the rec terrace");
  }
  for (const n of r.volleyNets) {
    assert.ok(on({ x: n.ax, z: n.az }, r.sandPad) && on({ x: n.bx, z: n.bz }, r.sandPad), "a net post is off the sand");
  }
});

test("the pads do not overlap each other", () => {
  const pads = [r.sandPad, r.barPad, r.terracePad, ...r.tennisPads, ...r.basketballPads];
  const hits = [];
  for (let i = 0; i < pads.length; i++) {
    for (let j = i + 1; j < pads.length; j++) {
      const a = pads[i], b = pads[j];
      if (a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1) hits.push([i, j]);
    }
  }
  assert.deepEqual(hits, [], `${hits.length} pad pairs overlap and will z-fight`);
});

test("every colour is a measured hex", () => {
  for (const hex of Object.values(REC_COLORS)) assert.match(hex, /^#[0-9a-f]{6}$/);
  for (const c of [...r.tennisCourts, ...r.basketballCourts, ...r.tennisPads, ...r.cars]) {
    assert.match(c.colour, /^#[0-9a-f]{6}$/);
  }
});

test("placement is deterministic, and survives markings never loading", () => {
  assert.deepEqual(placeRecreation(markings), r);
  const empty = placeRecreation(null);
  assert.equal(empty.tennisNets.length, 0, "no net without the paint it belongs to");
  assert.equal(empty.hoops.length, 0);
  assert.equal(empty.rigs.length, r.rigs.length, "the rec pads do not depend on the markings");
});
