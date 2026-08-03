// The athletics roofs: on the right buildings, at the right grain.
//
// athleticsSpec() is pure, so these run the exact placement the renderer uses.
// A vault field that slid off Main Gym, or a skylight built on the tennis
// courts because the footprint split went wrong, fails here — not on the site.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { athleticsSpec, splitBlocks, ATHLETICS_COLORS } from "../docs/js/campus-athletics.js";

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs", "data");
const campus = JSON.parse(readFileSync(path.join(DATA, "campus-3d.json")));
const arcgis = JSON.parse(readFileSync(path.join(DATA, "campus-arcgis.json")));
const spec = athleticsSpec(campus);

const inRing = (x, z, ring) => {
  let ins = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
};

test("the joined footprint splits at its link corridor, into gym and pool hall", () => {
  const ring = campus.buildings.find((b) => b.n === "Main Gym").p;
  const { blocks, splitX } = splitBlocks(ring);
  assert.equal(blocks.length, 2, "Main Gym and the Natatorium did not separate");
  assert.ok(splitX < -25 && splitX > -45, `neck found at x=${splitX}, nowhere near the link`);
  /* Each recovered block should land on the university's own massing for that
     building — the check that the split is the real one, not a lucky cut. */
  const gis = (n) => {
    const r = arcgis.massing.find((m) => m.n === n).r[0].map(([x, z]) => [x / 10, z / 10]);
    const xs = r.map((p) => p[0]);
    const zs = r.map((p) => p[1]);
    return { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2 };
  };
  for (const [name, block] of [["Main Gymnasium", spec.gym], ["Natatorium", spec.natatorium]]) {
    const c = gis(name);
    const r = block.rect;
    assert.ok(
      c.x > r.x0 && c.x < r.x1 && c.z > r.z0 && c.z < r.z1,
      `${name}'s massing centre (${c.x.toFixed(1)}, ${c.z.toFixed(1)}) is outside the block we built on`
    );
  }
});

test("the vault field is the roof — eleven-ish vaults covering Main Gym", () => {
  const g = spec.gym;
  assert.ok(g.count >= 9 && g.count <= 13, `${g.count} vaults; the aerial shows eleven`);
  /* Under 0.7 the field has slid off the building; over 1.6 it has run past
     it. (Just over 1.0 is right: the footprint is notched, the field is not.) */
  assert.ok(g.coverage > 0.7, `vault field covers only ${(g.coverage * 100).toFixed(0)}% of the footprint`);
  assert.ok(g.coverage < 1.6, `vault field overruns the footprint at ${(g.coverage * 100).toFixed(0)}%`);
  /* Vaults run the LONG way, at the pitch measured off the roof closeup. */
  const r = g.rect;
  const long = r.x1 - r.x0 >= r.z1 - r.z0 ? "x" : "z";
  assert.equal(g.axis, long, "vaults are running across the building, not along it");
  assert.ok(g.pitch > 3.6 && g.pitch < 6, `${g.pitch.toFixed(2)} m vaults are not what the aerial measures`);
  assert.ok(g.rise > 0.8 && g.rise < g.pitch / 2, `vault rise ${g.rise.toFixed(2)} m is not a shallow segment`);
  assert.equal(g.vaults.length, g.count);
  for (const v of g.vaults) {
    const across = g.axis === "x" ? [r.z0, r.z1] : [r.x0, r.x1];
    assert.ok(v.at - v.halfW >= across[0] - 0.01 && v.at + v.halfW <= across[1] + 0.01, "a vault hangs off the roof");
    assert.ok(v.to > v.from, "a vault has no length");
  }
  assert.equal(g.walkways.length, 2, "the two transverse walkway seams are missing");
});

test("the Natatorium anchor stands inside a real building footprint", () => {
  const { x, z } = spec.natatorium.anchor;
  const host = campus.buildings.find((b) => b.p?.length >= 3 && inRing(x, z, b.p));
  assert.ok(host, `the pool hall anchor (${x.toFixed(1)}, ${z.toFixed(1)}) is on open ground`);
  assert.equal(host.n, "Main Gym", "the pool hall landed on the wrong building");
});

test("skylight sits on the roof; deck and spa sit south of it", () => {
  const n = spec.natatorium;
  const { rect: r, skylight: s } = n;
  assert.ok(s.x0 > r.x0 && s.x1 < r.x1 && s.z0 > r.z0 && s.z1 < r.z1, "the skylight overhangs the roof");
  const cover = ((s.x1 - s.x0) * (s.z1 - s.z0)) / ((r.x1 - r.x0) * (r.z1 - r.z0));
  assert.ok(cover > 0.25 && cover < 0.6, `skylight covers ${(cover * 100).toFixed(0)}% of the deck`);
  assert.equal(n.bays.length, n.bayCount);
  assert.ok(n.bayPitch > 1.2 && n.bayPitch < 3, `${n.bayPitch.toFixed(2)} m bays are not lap-lane grain`);
  assert.ok(n.bays.some((b) => b.light) && n.bays.some((b) => !b.light), "the water lost its banding");

  /* +z is south. The deck runs off the south wall; the spa sits on the deck. */
  assert.ok(n.deck.z0 >= r.z1 - 0.01, "the pool deck is under the building");
  assert.ok(n.deck.z1 > n.deck.z0 && n.deck.x1 > n.deck.x0, "the pool deck has no extent");
  const spa = n.spa;
  assert.ok(
    spa.x - spa.rx > n.deck.x0 && spa.x + spa.rx < n.deck.x1 &&
    spa.z - spa.rz > n.deck.z0 && spa.z + spa.rz < n.deck.z1,
    "the spa is off the paving"
  );
});

test("every colour is a measured hex", () => {
  const keys = Object.keys(ATHLETICS_COLORS);
  assert.ok(keys.length >= 10, "colour set shrank");
  for (const [name, hex] of Object.entries(ATHLETICS_COLORS)) {
    assert.match(hex, /^#[0-9a-f]{6}$/, `${name} is not a #rrggbb`);
  }
  assert.equal(spec.colors, ATHLETICS_COLORS);
});

test("the massing ring is used for the block it actually covers", () => {
  /* Both blocks render under the one name "Main Gym", so createBuildings may
     hand us either mass's ring. Whichever it is, it must refine that block and
     leave the other one alone. */
  const ringOf = (n) => arcgis.massing.find((m) => m.n === n).r[0].map(([x, z]) => [x / 10, z / 10]);
  for (const [name, key, other] of [["Main Gymnasium", "gym", "natatorium"], ["Natatorium", "natatorium", "gym"]]) {
    const s = athleticsSpec(campus, new Map([["Main Gym", { h: 14.9, ring: ringOf(name) }]]));
    assert.equal(s.height, 14.9, "the mass height was ignored");
    const xs = ringOf(name).map((p) => p[0]);
    assert.ok(Math.abs(s[key].rect.x0 - Math.min(...xs)) < 0.01, `${name} did not refine the ${key} block`);
    assert.deepEqual(s[other].rect, spec[other].rect, `${name} disturbed the ${other} block`);
    assert.ok(s.gym.count >= 9 && s.gym.count <= 13, `${s.gym.count} vaults with the ${name} ring`);
  }
});

test("the spec is deterministic", () => {
  assert.deepEqual(athleticsSpec(campus), spec);
});
