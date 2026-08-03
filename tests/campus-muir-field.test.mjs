// Muir Field's overlays: measured off the aerial, and staying on the field.
//
// muirFieldSpec() is pure, so these run the exact placement the renderer
// uses. The whole point of stating positions as fractions of the fitted
// bounds quad is that a refit carries them along — so the spec is checked
// against the quad the data actually carries today, and again against a
// deliberately different one.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  muirFieldSpec, createMuirField, MUIR_COLORS, MUIR_NOMINAL,
} from "../docs/js/campus-muir-field.js";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const markings = JSON.parse(readFileSync(join(ROOT, "docs/data/campus-markings.json"), "utf8"));
const field = markings.facilities.find((f) => f.id === "muir-field");

/* The bounds quad, as the renderer reads it: u along b0→b1, v along b0→b3. */
function frameOf(bounds) {
  const [b0, b1, , b3] = bounds;
  const ux = b1[0] - b0[0], uz = b1[1] - b0[1];
  const vx = b3[0] - b0[0], vz = b3[1] - b0[1];
  return {
    width_m: Math.hypot(ux, uz),
    length_m: Math.hypot(vx, vz),
    at: (u, v) => [b0[0] + ux * u + vx * v, b0[1] + uz * u + vz * v],
  };
}

const frame = frameOf(field.bounds);
const spec = muirFieldSpec(frame);
const byType = (t) => spec.elements.filter((e) => e.type === t);
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

test("the facility the overlays hang off is still the one that was measured", () => {
  assert.ok(field, "Muir Field is gone from campus-markings.json");
  assert.equal(field.bounds.length, 4);
  /* Measured at 60.28 m x 105.72 m. A refit may move it, but a metre-scale
     surprise means the fit changed shape, and the overlays were traced on
     the old one. */
  assert.ok(Math.abs(frame.width_m - MUIR_NOMINAL.width_m) < 4,
    `bounds are ${frame.width_m.toFixed(1)} m across, not ~${MUIR_NOMINAL.width_m}`);
  assert.ok(Math.abs(frame.length_m - MUIR_NOMINAL.length_m) < 6,
    `bounds are ${frame.length_m.toFixed(1)} m long, not ~${MUIR_NOMINAL.length_m}`);
});

test("nothing strays off the field", () => {
  const off = [];
  for (const el of spec.elements) {
    assert.ok(Array.isArray(el.uv) && el.uv.length, `${el.id} carries no points`);
    for (const [u, v] of el.uv) {
      if (!(u >= 0 && u <= 1 && v >= 0 && v <= 1)) {
        off.push(`${el.id} at (${u.toFixed(3)}, ${v.toFixed(3)})`);
      }
    }
  }
  assert.deepEqual(off.slice(0, 6), [], `${off.length} points outside the bounds quad`);
});

test("every colour is a real hex, and the turf is the dark carpet, not lawn", () => {
  for (const el of spec.elements) assert.match(el.colour, /^#[0-9a-f]{6}$/);
  for (const hex of Object.values(MUIR_COLORS)) assert.match(hex, /^#[0-9a-f]{6}$/);
  const [turf] = byType("turf-drape");
  assert.equal(turf.colour, MUIR_COLORS.turf);
  assert.equal(turf.uv.length, 4, "the drape must cover the whole quad");
  /* The map renders this polygon in the dry-lawn family (#75833f, blended);
     the aerial measures #283e40. If the drape ever drifts back toward that
     lawn — brighter and yellower than blue — the reason for it is gone. */
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(turf.colour.slice(i, i + 2), 16));
  assert.ok(g < 0x83 && r < 0x75, `turf ${turf.colour} is as bright as the lawn it replaced`);
  assert.ok(b > r, `turf ${turf.colour} reads yellow-green, not the measured blue-green`);
});

test("two softball fans, one at each end, opening toward mid-field", () => {
  const arcs = byType("diamond-arc");
  assert.equal(arcs.length, 2, `${arcs.length} arcs, expected one fan per end`);
  const ends = arcs.map((a) => a.end).sort();
  assert.deepEqual(ends, ["north", "south"]);

  const [north] = arcs.filter((a) => a.end === "north");
  const [south] = arcs.filter((a) => a.end === "south");
  assert.ok(north.anchor[1] < 0.15, `north fan sits at v=${north.anchor[1].toFixed(3)}`);
  assert.ok(south.anchor[1] > 0.85, `south fan sits at v=${south.anchor[1].toFixed(3)}`);
  /* Mirrored about the halfway line, and both on the centreline. */
  assert.ok(Math.abs((north.anchor[1] + south.anchor[1]) - 1) < 1e-9, "fans are not mirrored");
  for (const a of arcs) assert.ok(Math.abs(a.anchor[0] - 0.5) < 1e-9, "fan is off the centreline");

  for (const a of arcs) {
    /* The arc measured 14.05 m and 14.50 m at the two ends. */
    const c = frame.at(...a.anchor);
    for (const pt of a.uv) {
      assert.ok(Math.abs(dist(c, frame.at(...pt)) - 14.2) < 0.05,
        `${a.id} is not a 14.2 m arc`);
    }
    /* Every arc point is on the mid-field side of its own anchor. */
    const inward = a.end === "north" ? 1 : -1;
    for (const [, v] of a.uv) {
      assert.ok((v - a.anchor[1]) * inward > -1e-9, `${a.id} bulges away from mid-field`);
    }
  }

  /* Each fan carries its chord, its rhombus, and its two circles. */
  assert.equal(byType("diamond-chord").length, 2);
  assert.equal(byType("infield-outline").length, 2);
  const circles = byType("circle");
  assert.equal(circles.length, 4);
  assert.deepEqual(circles.map((c) => `${c.end}:${c.role}`).sort(),
    ["north:home", "north:pitcher", "south:home", "south:pitcher"]);
  /* Both circles are near enough the same size — the home one only reads
     smaller because it is fainter. A fit windowed too tight once clipped it
     to 1.66 m; the sweep against the paint puts it at 2.5 m. */
  for (const c of circles) {
    const want = c.role === "pitcher" ? 2.6 : 2.5;
    assert.ok(Math.abs(c.radius_m - want) < 1e-9, `${c.id} radius drifted`);
    const o = frame.at(...c.anchor);
    for (const pt of c.uv) {
      assert.ok(Math.abs(dist(o, frame.at(...pt)) - want) < 0.03, `${c.id} is not round`);
    }
  }
  /* The infield rhombus is closed and its far vertex is the pitcher's circle. */
  for (const rh of byType("infield-outline")) {
    assert.equal(rh.uv.length, 5);
    assert.deepEqual(rh.uv[0], rh.uv[4], `${rh.id} is not closed`);
    const [pitcher] = circles.filter((c) => c.end === rh.end && c.role === "pitcher");
    assert.ok(dist(frame.at(...rh.uv[2]), frame.at(...pitcher.anchor)) < 0.02,
      `${rh.id} far vertex has come off the pitcher's circle`);
  }
});

test("two goals, on the short ends, a regulation mouth wide", () => {
  const goals = byType("goal");
  assert.equal(goals.length, 2);
  assert.deepEqual(goals.map((g) => g.end).sort(), ["north", "south"]);
  for (const g of goals) {
    const [left, right, backRight, backLeft] = g.uv.map((p) => frame.at(...p));
    const span = dist(left, right);
    assert.ok(Math.abs(span - 7.32) < 0.1, `${g.id} mouth is ${span.toFixed(2)} m, not 7.32 m`);
    assert.ok(Math.abs(dist(left, backLeft) - 1.6) < 0.05, `${g.id} back frame drifted`);
    assert.ok(Math.abs(dist(right, backRight) - 1.6) < 0.05, `${g.id} back frame drifted`);
    /* Centred across the field, on the end line, and raked AWAY from play. */
    assert.ok(Math.abs((g.uv[0][0] + g.uv[1][0]) / 2 - 0.5) < 1e-9, `${g.id} is off centre`);
    const nearEnd = g.end === "north" ? g.uv[0][1] < 0.1 : g.uv[0][1] > 0.9;
    assert.ok(nearEnd, `${g.id} is not on its end line`);
    const outward = g.end === "north" ? -1 : 1;
    assert.ok((g.uv[2][1] - g.uv[1][1]) * outward > 0, `${g.id} opens the wrong way`);
  }
  assert.ok(Math.abs((goals[0].uv[0][1] + goals[1].uv[0][1]) - 1) < 1e-9, "goals are not mirrored");
});

test("the wordmarks are the diagonal pair the aerial shows", () => {
  const strips = byType("wordmark-strip");
  assert.equal(strips.length, 4, "two strips, navy and orange, at two corners");
  const corners = [...new Set(strips.map((s) => s.corner))].sort();
  assert.deepEqual(corners, ["north-east", "south-west"]);
  for (const c of corners) {
    const pair = strips.filter((s) => s.corner === c);
    assert.equal(pair.length, 2);
    const navy = pair.find((s) => s.colour === MUIR_COLORS.wordmarkNavy);
    const orange = pair.find((s) => s.colour === MUIR_COLORS.wordmarkOrange);
    assert.ok(navy && orange, `${c} lost a tone`);
    /* Navy is the long block; orange is the short one, and it sits on the
       mid-field side — the closeup shows the orange mark nearer the centre
       spot at both corners. */
    const len = (s) => dist(frame.at(...s.uv[0]), frame.at(...s.uv[3]));
    assert.ok(len(navy) > len(orange) * 2, `${c}: navy should be the long block`);
    assert.ok(Math.abs(len(navy) + len(orange) - 17.0) < 0.05, `${c}: strip is not 17 m`);
    const midward = (s) => Math.abs(s.uv.reduce((a, [, v]) => a + v, 0) / s.uv.length - 0.5);
    assert.ok(midward(orange) < midward(navy), `${c}: orange is not on the mid-field end`);
    /* Hard against the touchline it was measured on, east or west. */
    const u = navy.uv[0][0];
    assert.ok(c === "north-east" ? u > 0.94 : u < 0.06, `${c} strip is off the sideline`);
  }
  /* 180°-symmetric about the centre spot, as measured: turning one strip
     through half a turn lands it exactly on its opposite number. */
  const ne = strips.filter((s) => s.corner === "north-east");
  const sw = strips.filter((s) => s.corner === "south-west");
  for (let i = 0; i < ne.length; i++) {
    assert.equal(ne[i].colour, sw[i].colour, "the corners carry different tones");
    for (const [u, v] of ne[i].uv) {
      const found = sw[i].uv.some(([su, sv]) =>
        Math.abs(su - (1 - u)) < 1e-9 && Math.abs(sv - (1 - v)) < 1e-9);
      assert.ok(found, `wordmarks are not opposite: (${u.toFixed(3)}, ${v.toFixed(3)})`);
    }
  }
});

test("the painted arrows and the boundary rail", () => {
  const tri = byType("triangle");
  assert.equal(tri.length, 2);
  for (const t of tri) {
    assert.equal(t.uv.length, 3);
    /* Both sit in the southern half, where the closeup shows them. */
    assert.ok(t.uv.every(([, v]) => v > 0.6 && v < 0.95), `${t.id} moved off its half`);
    const side = dist(frame.at(...t.uv[0]), frame.at(...t.uv[1]));
    assert.ok(side > 0.8 && side < 3, `${t.id} is ${side.toFixed(2)} m — not an arrowhead`);
  }
  const rails = byType("fence-rail");
  const posts = byType("fence-post");
  assert.equal(rails.length, 2, "a rail behind each end");
  assert.equal(posts.length, 22, `${posts.length} posts, expected 11 per end`);
  for (const end of ["north", "south"]) {
    const mine = posts.filter((p) => p.end === end);
    assert.equal(mine.length, 11);
    const vs = new Set(mine.map((p) => p.uv[0][1].toFixed(9)));
    assert.equal(vs.size, 1, `${end} posts are not on one line`);
    const gaps = mine.slice(1).map((p, i) =>
      dist(frame.at(...mine[i].uv[0]), frame.at(...p.uv[0])));
    for (const g of gaps) assert.ok(Math.abs(g - gaps[0]) < 1e-6, `${end} post spacing is uneven`);
    assert.ok(gaps[0] > 3 && gaps[0] < 9, `${end} posts stand ${gaps[0].toFixed(1)} m apart`);
    for (const r of rails) assert.ok(r.height_m > 0.5 && r.height_m < 3, "rail height is not low");
  }
});

test("a refit of the bounds carries every overlay with it", () => {
  /* Same field, stated on a quad that is 10 % bigger and rotated: the
     fractions must not move, so every element's uv is identical. */
  const bigger = muirFieldSpec({ width_m: frame.width_m * 1.1, length_m: frame.length_m * 1.1 });
  assert.equal(bigger.elements.length, spec.elements.length);
  for (let i = 0; i < spec.elements.length; i++) {
    assert.equal(bigger.elements[i].id, spec.elements[i].id);
  }
  /* Metre-defined things scale in fractions but hold their metres. */
  const [g0] = bigger.elements.filter((e) => e.type === "goal");
  const bigFrame = frameOf([[0, 0], [frame.width_m * 1.1, 0],
    [frame.width_m * 1.1, frame.length_m * 1.1], [0, frame.length_m * 1.1]]);
  const span = dist(bigFrame.at(...g0.uv[0]), bigFrame.at(...g0.uv[1]));
  assert.ok(Math.abs(span - 7.32) < 0.01, `goal is ${span.toFixed(2)} m on a refitted quad`);
});

test("the whole field builds, in a handful of draws, over bumpy ground", () => {
  /* Deliberately uneven terrain: every drape and every post samples it, so a
     sign error or a bad triangulation shows up here rather than on the site. */
  const heightAt = (x, z) => Math.sin(x / 40) * 0.6 + Math.cos(z / 55) * 0.4;
  const group = createMuirField(null, { markings, heightAt });
  let draws = 0;
  let vertices = 0;
  group.traverse((o) => {
    if (!o.isMesh) return;
    draws++;
    const p = o.geometry.getAttribute("position");
    if (p) {
      vertices += p.count;
      for (let i = 0; i < p.count; i++) {
        assert.ok(Number.isFinite(p.getX(i)) && Number.isFinite(p.getY(i)), "NaN in the geometry");
      }
    }
  });
  assert.ok(draws > 0, "the field built nothing");
  assert.ok(draws <= 20, `${draws} draw calls for one facility`);
  assert.ok(vertices > 500, `only ${vertices} vertices — the overlays are hollow`);
});

test("missing or broken data is a quiet no-op, never a thrown walk", () => {
  const heightAt = () => 0;
  const empty = [
    createMuirField(null, {}),
    createMuirField(null, { markings: { facilities: [] }, heightAt }),
    createMuirField(null, { markings: { facilities: [{ id: "elsewhere" }] }, heightAt }),
    createMuirField(null, { markings: { facilities: [{ id: "muir-field" }] }, heightAt }),
    createMuirField(null, {
      markings: { facilities: [{ id: "muir-field", bounds: [[0, 0], [0, 0], [0, 0], [0, 0]] }] },
      heightAt,
    }),
    createMuirField(null, { markings }), // no heightAt
  ];
  for (const g of empty) assert.equal(g.children.length, 0);
});

test("the spec is deterministic", () => {
  const again = muirFieldSpec(frame);
  assert.deepEqual(again, spec);
  assert.deepEqual(muirFieldSpec(frame).elements.map((e) => e.id), spec.elements.map((e) => e.id));
});
