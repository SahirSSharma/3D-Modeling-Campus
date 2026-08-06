// The shared drape primitives: which way does a fill actually face?
//
// WHY THIS FILE EXISTS. `fillPoly` emitted DOWN-facing triangles for its whole
// life, under a comment saying the opposite. Every consumer drew UNLIT
// (MeshBasicMaterial + DoubleSide), where no normal is ever read, so the defect
// was invisible — and each time a module DID trip over it, the repo wrote a
// local workaround instead of fixing the primitive: campus-markings.js,
// campus-muir-field.js and campus-rimac.js each carry a comment about a lit
// DoubleSide fill rendering near-black off the hemisphere's GROUND term, and
// campus-eighth.js re-ordered fillPoly's output triangle by triangle. Four
// workarounds, one root cause.
//
// So this asserts the primitive's contract directly, once, for every module
// that drapes through it — including the ones whose unlit materials could never
// have shown the failure, so the next LIT consumer inherits a correct fill
// rather than a fifth workaround.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { fillPoly, ribbon, bandBetween } from "../docs/js/campus-drape.js";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const src = (rel) => readFileSync(join(ROOT, rel), "utf8");

/* The +y component of (b-a) x (c-a) for the triangle at vertex offset i, in
   the winding Three.js calls front-facing. */
const normalY = (v, i) => {
  const ax = v[i], az = v[i + 2];
  const bx = v[i + 3], bz = v[i + 5];
  const cx = v[i + 6], cz = v[i + 8];
  return (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
};

/* Rings covering the shapes real callers hand in: convex, concave, a ring
   wound the other way, and the L/C shapes the Eighth beds actually are. */
const RINGS = {
  "square (ccw in x/z)": [[0, 0], [10, 0], [10, 10], [0, 10]],
  "square (cw in x/z)": [[0, 0], [0, 10], [10, 10], [10, 0]],
  "L-shaped bed": [[0, 0], [12, 0], [12, 4], [5, 4], [5, 14], [0, 14]],
  "C-shaped bed": [[0, 0], [14, 0], [14, 3], [4, 3], [4, 9], [14, 9], [14, 12], [0, 12]],
  "thin strip": [[-186, 514.3], [-161.2, 514.4], [-161.2, 515.3], [-186, 515.2]],
  "concave sliver": [[0, 0], [20, 0.2], [20, 0.6], [10, 0.5], [0, 0.4]],
};

test("every fillPoly triangle faces UP, whichever way the caller wound the ring", () => {
  for (const [name, ring] of Object.entries(RINGS)) {
    const out = [];
    fillPoly(out, ring, () => 0, 0);
    assert.ok(out.length >= 9, `${name}: nothing triangulated`);
    assert.equal(out.length % 9, 0, `${name}: partial triangle emitted`);
    let checked = 0;
    for (let i = 0; i < out.length; i += 9) {
      const ny = normalY(out, i);
      /* A degenerate sliver has no meaningful facing; only triangles with real
         area can be face-DOWN, and those are the failure. */
      if (Math.abs(ny) < 1e-9) continue;
      assert.ok(ny > 0, `${name}: triangle ${i / 9} winds face-down (ny ${ny})`);
      checked++;
    }
    assert.ok(checked > 0, `${name}: every triangle was degenerate — the test is blind`);
  }
});

test("fillPoly's ring order changes the geometry, never the facing", () => {
  /* THREE.ShapeUtils.triangulateShape normalises the contour, which is exactly
     why "reverse the ring to flip the face" does not work and why the old
     comment was wrong. Pinned, so a future edit that makes facing depend on
     input order fails here rather than in a screenshot. */
  const ring = RINGS["L-shaped bed"];
  const fwd = [], rev = [];
  fillPoly(fwd, ring, () => 0, 0);
  fillPoly(rev, [...ring].reverse(), () => 0, 0);
  for (const out of [fwd, rev]) {
    for (let i = 0; i < out.length; i += 9) {
      const ny = normalY(out, i);
      if (Math.abs(ny) < 1e-9) continue;
      assert.ok(ny > 0, "a reversed ring produced a face-down triangle");
    }
  }
});

test("fillPoly honours the caller's lift and terrain, and no-ops on junk", () => {
  const out = [];
  fillPoly(out, RINGS["square (ccw in x/z)"], (x, z) => x * 0.1 + z * 0.2, 0.35);
  for (let i = 0; i < out.length; i += 3) {
    const want = out[i] * 0.1 + out[i + 2] * 0.2 + 0.35;
    assert.ok(Math.abs(out[i + 1] - want) < 1e-6, "a vertex ignored heightAt or the lift");
  }
  for (const bad of [[], [[0, 0]], [[0, 0], [1, 1]]]) {
    const q = [];
    fillPoly(q, bad, () => 0, 0);
    assert.deepEqual(q, [], "a degenerate ring must be a quiet no-op, not geometry");
  }
});

test("ribbon faces up whichever way the polyline is walked", () => {
  /* A ribbon's own perpendicular flips with its direction of travel, so the
     quad's orientation survives — the caller cannot get this wrong. Pinned
     both ways so a future edit that breaks the symmetry is caught. */
  const line = [[0, 0], [20, 0], [20, 20], [5, 30]];
  for (const pts of [line, [...line].reverse()]) {
    const rib = [];
    ribbon(rib, pts, 0.5, () => 0, 0);
    assert.ok(rib.length >= 18, "ribbon produced no quads");
    for (let i = 0; i < rib.length; i += 9) {
      assert.ok(normalY(rib, i) > 0, `ribbon triangle ${i / 9} winds face-down`);
    }
  }
});

test("bandBetween is uniformly wound, and its facing is the CALLER's to choose", () => {
  /* Unlike fillPoly, bandBetween cannot normalise anything: it is handed two
     loops and the face follows their order. So the contract it CAN hold is
     that one call never mixes facings — a band half up and half down is the
     shearing bug, not a lighting one — and that swapping the loops flips the
     whole band predictably. A lit consumer picks the order it needs; today's
     only consumer (campus-rimac.js) draws unlit. */
  const outer = [[0, 0], [10, 0], [10, 10], [0, 10]];
  const inner = [[1, 1], [9, 1], [9, 9], [1, 9]];
  const facing = (a, b) => {
    const band = [];
    bandBetween(band, a, b, () => 0, 0);
    assert.ok(band.length >= 18, "bandBetween produced no quads");
    const signs = new Set();
    for (let i = 0; i < band.length; i += 9) {
      const ny = normalY(band, i);
      if (Math.abs(ny) > 1e-9) signs.add(Math.sign(ny));
    }
    assert.equal(signs.size, 1, `a single band mixed facings: ${[...signs]}`);
    return [...signs][0];
  };
  assert.equal(facing(outer, inner), -facing(inner, outer),
    "swapping the two loops must flip the band, not leave it ambiguous");
});

test("no module carries a private re-winding workaround around campus-drape", () => {
  /* The regression this file was written for is not "a fill is dark" — it is
     "someone fixed the case again". A consumer that reorders fillPoly's output
     is re-introducing the fourth workaround. */
  const CONSUMERS = [
    "docs/js/campus-eighth.js",
    "docs/js/campus-eighth-court.js",
    "docs/js/campus-rimac.js",
  ];
  const RE_WIND = /\[\s*tri\s*\[\s*0\s*\]\s*,\s*tri\s*\[\s*2\s*\]/;
  for (const rel of CONSUMERS) {
    assert.doesNotMatch(src(rel), RE_WIND,
      `${rel}: re-winding fillPoly's output locally — fix campus-drape.js instead`);
  }
  assert.doesNotMatch(src("docs/js/campus-drape.js"), /\[tri\[0\], tri\[2\], tri\[1\]\]/,
    "campus-drape.js is emitting down-facing triangles again");
});
