// A goal is a frame AND a net, and both of them are regulation.
//
// The model carried a bare frame for as long as it carried goals at all —
// two posts, a crossbar and a shallow back rake, with a comment claiming the
// rake ran "to the net" and no net anywhere in the repository. These pin the
// half that was missing: that the net exists, that it is netting rather than
// a panel, that it hangs off the frame it belongs to and nowhere else, and
// that the frame it hangs off measures what Law 1 says it measures.
//
// goalSpec() is pure, so every dimension below is measured on the exact
// geometry the renderer draws.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as THREE from "../docs/vendor/three/three.module.min.js";
import {
  GOAL_REGULATION, NET_MESH_M, NET_OPACITY, goalSpec, goalWorld, createGoalNet,
} from "../docs/js/campus-goal.js";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const src = (rel) => readFileSync(join(ROOT, rel), "utf8");

/* Muir's own goal: Law 1 mouth, the shallow portable rake the field's
   closeups show. Any facility's numbers would do — these are a real set. */
const MUIR_GOAL = { depth_m: 1.6, backHeight_m: 0.9 };
const spec = goalSpec(MUIR_GOAL);
const member = (id) => spec.frame.find((f) => f.id === id);
const panel = (id) => spec.panels.find((p) => p.id === id);
const cordLen = ([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
const allCords = (s) => s.panels.flatMap((p) => p.cords);

test("the Law's own three numbers, and nothing invented beside them", () => {
  /* IFAB Law 1: 8 yd between the posts, 8 ft to the lower edge of the
     crossbar, neither member more than 12 cm wide or deep. */
  assert.equal(GOAL_REGULATION.span_m, 7.32);
  assert.equal(GOAL_REGULATION.height_m, 2.44);
  assert.equal(GOAL_REGULATION.post_m, 0.12);
  assert.ok(GOAL_REGULATION.post_m <= 0.12, "Law 1 caps the post gauge at 12 cm");
  assert.deepEqual(Object.keys(GOAL_REGULATION).sort(), ["height_m", "post_m", "span_m"],
    "the regulation table must hold only what the Law actually fixes");
  /* The Law is silent on the mesh, so the gauge is a product standard —
     full-size nets are made in 100-120 mm square mesh. Outside that band it
     is an invention, whichever way it drifted. */
  assert.ok(NET_MESH_M >= 0.10 && NET_MESH_M <= 0.12,
    `mesh gauge ${NET_MESH_M} m is outside the 100-120 mm nets are made in`);
});

test("the mouth is 7.32 m of AIR: the Law measures between the inner edges", () => {
  /* The regression this replaces: posts centred ON the mouth line, which
     leaves a 7.20 m opening and calls it regulation. */
  const left = member("post-left"), right = member("post-right");
  const inner = (right.at[0] - right.w / 2) - (left.at[0] + left.w / 2);
  assert.ok(Math.abs(inner - 7.32) < 1e-9,
    `${inner.toFixed(3)} m between the inner faces, not 7.32 m`);
  assert.ok(Math.abs(spec.postCentre_m - (7.32 + 0.12) / 2) < 1e-9);
  /* Both posts reach the Law's height, and the crossbar sits on top of them
     rather than through them: its lower edge is the 2.44 m. */
  for (const p of [left, right]) {
    assert.equal(p.h, GOAL_REGULATION.height_m);
    assert.ok(Math.abs(p.at[1] - GOAL_REGULATION.height_m / 2) < 1e-9, "a post is not on the ground");
  }
  /* ASSERT THE EDGE, NOT THE CENTRE. The first version of this test read
     `bar.at[1]` — the box's middle — under a failure message naming its
     lower edge, so it passed while the bar hung from 2.38 m and reported
     that as regulation. A test that checks a different quantity from the one
     it claims to check is worse than no test: it is false assurance, and it
     survives exactly the change it exists to catch. */
  const bar = member("crossbar");
  const barUnder = bar.at[1] - bar.h / 2;
  assert.ok(Math.abs(barUnder - GOAL_REGULATION.height_m) < 1e-9,
    `the crossbar's lower edge is at ${barUnder.toFixed(3)} m, not 2.44 m`);
  /* Outer face to outer face, so no square notch is left at either corner. */
  const outer = (right.at[0] + right.w / 2) - (left.at[0] - left.w / 2);
  assert.ok(Math.abs(bar.w - outer) < 1e-9, `crossbar is ${bar.w} m, the posts span ${outer} m`);
  /* Six members: two posts, a crossbar, two back posts and a back rail. */
  assert.deepEqual(spec.frame.map((f) => f.id).sort(), [
    "back-post-left", "back-post-right", "back-rail", "crossbar", "post-left", "post-right",
  ]);
});

test("every horizontal member RESTS on its uprights — none passes through one", () => {
  /* The class the crossbar's 6 cm belonged to, pinned for the whole frame:
     `at` is a centre, so a member written at the height it should REACH ends
     up straddling that height instead of sitting on it. The crossbar had it
     at 2.44 m and the back rail had it at 0.9 m; the second was invisible
     because no number in the Law goes anywhere near it. Both are checked
     here on the derived edges, so neither can quietly come back. */
  const pairs = [
    ["crossbar", ["post-left", "post-right"]],
    ["back-rail", ["back-post-left", "back-post-right"]],
  ];
  for (const [railId, postIds] of pairs) {
    const rail = member(railId);
    const under = rail.at[1] - rail.h / 2;
    for (const postId of postIds) {
      const post = member(postId);
      const top = post.at[1] + post.h / 2;
      assert.ok(Math.abs(under - top) < 1e-9,
        `${railId}'s underside is ${under.toFixed(3)} m and ${postId}'s top is ${top.toFixed(3)} m` +
        " — the two must meet, not overlap");
    }
    /* And every upright starts on the ground, so its top IS its own height. */
    for (const postId of postIds) {
      const post = member(postId);
      assert.ok(Math.abs(post.at[1] - post.h / 2) < 1e-9, `${postId} is not on the ground`);
    }
  }
  /* The net is hung off those same undersides, front and back: the rake's
     top edge meets the crossbar and its bottom edge meets the back rail, so
     no cord floats inside a member or hangs in the air below one. */
  const rake = panel("net-rake");
  const ys = rake.cords.flatMap(([a, b]) => [a[1], b[1]]);
  assert.ok(Math.abs(Math.max(...ys) - (member("crossbar").at[1] - member("crossbar").h / 2)) < 1e-9,
    "the net's top edge is not on the crossbar's underside");
  assert.ok(Math.abs(Math.min(...ys) - (member("back-rail").at[1] - member("back-rail").h / 2)) < 1e-9,
    "the net's back edge is not on the back rail's underside");
});

test("four panels: the back, the rake and both sides — and the mouth left open", () => {
  assert.deepEqual(spec.panels.map((p) => p.id),
    ["net-back", "net-rake", "net-side-left", "net-side-right"]);
  /* Nothing is strung across the open mouth. Cords DO live in the mouth
     plane (z = 0) — the net is tied along the crossbar and down each post —
     but a cord may only run across it AT the crossbar. Anything crossing
     lower is a wall where the ball goes in. */
  for (const p of spec.panels) {
    for (const [a, b] of p.cords) {
      if (Math.abs(a[2]) > 1e-9 || Math.abs(b[2]) > 1e-9) continue;
      const downThePost = Math.abs(a[0] - b[0]) < 1e-9;
      const alongTheBar = Math.abs(a[1] - GOAL_REGULATION.height_m) < 1e-9 &&
                          Math.abs(b[1] - GOAL_REGULATION.height_m) < 1e-9;
      assert.ok(downThePost || alongTheBar,
        `${p.id} strings a cord across the open mouth at ${a[1].toFixed(2)} m`);
    }
  }
  /* The back is vertical, at the full rake depth. */
  for (const [a, b] of panel("net-back").cords) {
    assert.ok(Math.abs(a[2] - MUIR_GOAL.depth_m) < 1e-9 && Math.abs(b[2] - MUIR_GOAL.depth_m) < 1e-9,
      "the back panel has come off the back frame");
  }
  /* The rake runs from the crossbar down to the back rail, losing height all
     the way — a goal's top is a slope, not a lid. */
  const rake = panel("net-rake");
  const ys = rake.cords.flatMap(([a, b]) => [a[1], b[1]]);
  assert.ok(Math.abs(Math.max(...ys) - GOAL_REGULATION.height_m) < 1e-9, "the rake misses the crossbar");
  assert.ok(Math.abs(Math.min(...ys) - MUIR_GOAL.backHeight_m) < 1e-9, "the rake misses the back rail");
  for (const [a, b] of rake.cords) {
    if (Math.abs(a[2] - b[2]) < 1e-9) continue; // a cord running across the slope
    const downhill = (b[1] - a[1]) / (b[2] - a[2]);
    assert.ok(downhill < 0, "the rake climbs away from the crossbar");
  }
  /* Each side closes the triangle-ish gap between a post and its back post,
     and lives entirely in its own vertical plane. */
  for (const side of ["left", "right"]) {
    const p = panel(`net-side-${side}`);
    const want = (side === "left" ? -1 : 1) * spec.postCentre_m;
    for (const [a, b] of p.cords) {
      assert.ok(Math.abs(a[0] - want) < 1e-9 && Math.abs(b[0] - want) < 1e-9,
        `net-side-${side} is not in the plane of its own post`);
    }
  }
});

test("it reads as netting, not as a panel: real cords at the stated gauge", () => {
  /* Every cord is a segment of real length, and the spacing between the
     parallel ones is the mesh gauge to within a rounding of the panel's own
     size. A panel that quietly collapsed to a single quad — the "solid pale
     rectangle" failure — fails on the count long before the spacing. */
  const cords = allCords(spec);
  assert.ok(cords.length > 200, `${cords.length} cords is not a net, it is a frame`);
  for (const c of cords) {
    assert.ok(cordLen(c) > 0.05, "a zero-length cord got into the net");
    for (const p of c) for (const v of p) assert.ok(Number.isFinite(v), "NaN in a cord");
  }
  for (const p of spec.panels) {
    /* Counts come from the panel's own edges, so measure them back off the
       edges: mean spacing must land within a fifth of the stated gauge. */
    const [a, b, c, d] = p.quad;
    const sEdge = (Math.hypot(...a.map((v, i) => b[i] - v)) +
                   Math.hypot(...d.map((v, i) => c[i] - v))) / 2;
    const tEdge = (Math.hypot(...a.map((v, i) => d[i] - v)) +
                   Math.hypot(...b.map((v, i) => c[i] - v))) / 2;
    assert.ok(Math.abs(sEdge / p.across - NET_MESH_M) < NET_MESH_M / 5,
      `${p.id}: ${(sEdge / p.across).toFixed(3)} m across, not a ${NET_MESH_M} m mesh`);
    assert.ok(Math.abs(tEdge / p.along - NET_MESH_M) < NET_MESH_M / 5,
      `${p.id}: ${(tEdge / p.along).toFixed(3)} m along, not a ${NET_MESH_M} m mesh`);
    /* Both directions present: a grid of cords, not a comb of them. */
    assert.ok(p.across >= 2 && p.along >= 2, `${p.id} is strung in one direction only`);
    assert.equal(p.cords.length, p.across + p.along + 2);
  }
});

test("every cord belongs to its own goal: inside the frame, never outside it", () => {
  const px = spec.postCentre_m;
  for (const p of spec.panels) {
    for (const c of p.cords) {
      for (const [x, y, z] of c) {
        assert.ok(Math.abs(x) <= px + 1e-9, `${p.id} hangs ${x.toFixed(2)} m off the posts`);
        assert.ok(z >= -1e-9 && z <= MUIR_GOAL.depth_m + 1e-9,
          `${p.id} reaches ${z.toFixed(2)} m, outside the 0-${MUIR_GOAL.depth_m} m rake`);
        assert.ok(y >= -1e-9 && y <= GOAL_REGULATION.height_m + 1e-9,
          `${p.id} reaches ${y.toFixed(2)} m, over the 2.44 m crossbar`);
      }
    }
  }
});

test("a goal stands on the footprint it is given, at regulation size", () => {
  /* A deliberately rotated, deliberately WRONG-sized footprint: 20 degrees
     off the grid and 0.4 m too wide. The goal must take the quad's place and
     heading and its own size, so a sloppy fit can never make the mouth
     unregulation. */
  const a = (20 * Math.PI) / 180;
  const [ux, uz] = [Math.cos(a), Math.sin(a)];
  const [vx, vz] = [-Math.sin(a), Math.cos(a)];
  const at = (s, t) => [100 + ux * s + vx * t, -40 + uz * s + vz * t];
  const quad = [at(-3.86, 0), at(3.86, 0), at(3.86, 1.6), at(-3.86, 1.6)];
  const placed = goalWorld(spec, quad, 12.5);
  assert.ok(placed, "the goal refused a perfectly good footprint");

  const box = (id) => placed.boxes.find((b) => b.id === id);
  const l = box("post-left"), r = box("post-right");
  const centres = Math.hypot(r.x - l.x, r.z - l.z);
  assert.ok(Math.abs(centres - (7.32 + 0.12)) < 1e-6,
    `posts are ${centres.toFixed(3)} m apart on a 7.72 m footprint — the quad won`);
  /* The mouth faces the way the quad does. */
  assert.ok(Math.abs(placed.rot - Math.atan2(-uz, ux)) < 1e-9, "the goal ignored the quad's heading");
  /* One ground datum for the whole goal: every member and every cord is
     referred to the same 12.5 m, so nothing shears over a bump. Measured on
     each box's EDGES — bottom on or above the datum, top no higher than the
     crossbar's own top — because `b.y` is a centre, and bounding a centre by
     the crossbar's underside is the mistake that let a 2.38 m mouth ship. */
  const top = 12.5 + GOAL_REGULATION.height_m + GOAL_REGULATION.post_m;
  for (const b of placed.boxes) {
    assert.ok(b.y - b.h / 2 >= 12.5 - 1e-9,
      `${b.id} sinks to ${(b.y - b.h / 2).toFixed(3)}, below the goal's own datum`);
    assert.ok(b.y + b.h / 2 <= top + 1e-9,
      `${b.id} reaches ${(b.y + b.h / 2).toFixed(3)}, above the crossbar's top`);
  }
  const ys = [];
  for (let i = 1; i < placed.cords.length; i += 3) ys.push(placed.cords[i]);
  assert.ok(Math.abs(Math.min(...ys) - 12.5) < 1e-9, "the net does not reach the ground");
  assert.ok(Math.abs(Math.max(...ys) - (12.5 + GOAL_REGULATION.height_m)) < 1e-9,
    "the net does not reach the crossbar");
  assert.equal(placed.cords.length, allCords(spec).length * 6, "a cord was lost in placement");
  for (const v of placed.cords) assert.ok(Number.isFinite(v), "NaN in the placed net");
});

test("the net is one draw, unlit, and genuinely see-through", () => {
  const placed = goalWorld(spec, [[0, 0], [7.32, 0], [7.32, 1.6], [0, 1.6]], 0);
  const net = createGoalNet(placed.cords, "#dce0de");
  assert.ok(net.isLineSegments, "the net must be LineSegments — a mesh cord is sub-pixel");
  assert.equal(net.geometry.getAttribute("position").count, placed.cords.length / 3);
  assert.ok(net.material.transparent, "an opaque net is a panel");
  assert.equal(net.material.opacity, NET_OPACITY);
  assert.ok(NET_OPACITY > 0.2 && NET_OPACITY < 0.8,
    `opacity ${NET_OPACITY}: below 0.2 the net vanishes, above 0.8 it is a solid sheet`);
  assert.equal(net.material.depthWrite, false, "near cords must not punch holes in far ones");
  assert.equal(net.material.depthTest, true, "terrain and buildings must still occlude the net");
  assert.ok(net.material.isLineBasicMaterial, "a net wants no lighting model");
  /* One object, so both goals of a facility cost one draw between them. */
  let objects = 0;
  net.traverse(() => { objects++; });
  assert.equal(objects, 1);
});

test("a refit or a different goal carries the whole net with it", () => {
  /* A deeper, taller-backed goal: every dimension moves, the mesh gauge does
     not, and the cord count grows with the surface rather than staying put. */
  const deeper = goalSpec({ depth_m: 2.4, backHeight_m: 1.1 });
  assert.equal(deeper.mesh_m, NET_MESH_M);
  assert.ok(allCords(deeper).length > allCords(spec).length,
    "a bigger goal did not get a bigger net");
  for (const p of deeper.panels) {
    for (const c of p.cords) for (const [, , z] of c) assert.ok(z <= 2.4 + 1e-9);
  }
  /* And it is deterministic — no clock, no randomness. */
  assert.deepEqual(goalSpec(MUIR_GOAL), spec);
});

test("bad dimensions and a bad footprint are quiet nulls, never a thrown walk", () => {
  assert.equal(goalSpec(), null, "no depth or back height at all");
  assert.equal(goalSpec({ depth_m: 1.6 }), null);
  assert.equal(goalSpec({ depth_m: 0, backHeight_m: 0.9 }), null);
  assert.equal(goalSpec({ depth_m: 1.6, backHeight_m: 0 }), null);
  assert.equal(goalSpec({ depth_m: NaN, backHeight_m: 0.9 }), null);
  assert.equal(goalSpec({ depth_m: 1.6, backHeight_m: 3 }), null, "the rake would run uphill");
  assert.equal(goalWorld(null, [[0, 0], [7.32, 0], [7.32, 1.6], [0, 1.6]], 0), null);
  assert.equal(goalWorld(spec, [[0, 0], [0, 0], [0, 0], [0, 0]], 0), null, "a collapsed quad");
  assert.equal(goalWorld(spec, [[0, 0], [7.32, 0]], 0), null, "a two-corner quad");
  assert.equal(goalWorld(spec, [[0, 0], [7.32, 0], [7.32, 0], [0, 0]], 0), null, "no depth to rake");
  assert.equal(goalWorld(spec, [[0, 0], [7.32, 0], [7.32, 1.6], [0, 1.6]], NaN), null);
});

test("the module keeps its own numbers and does not borrow a facility's", () => {
  /* campus-goal.js is the goal, not Muir's goal. It may NAME its callers in
     prose, but no colour, no facility constant and no facility import may
     reach its code, or the next pitch to want a goal finds Muir baked in. */
  const text = src("docs/js/campus-goal.js");
  const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(code, /#[0-9a-fA-F]{6}/, "a colour leaked into the shared goal module");
  assert.doesNotMatch(code, /MUIR|muir|rimac/i, "a facility leaked into the shared goal module");
  assert.doesNotMatch(text, /from\s+["']\.\/campus-(?!goal)/,
    "the shared goal module imports a facility module");
  /* And the first caller uses it rather than rebuilding a goal inline. */
  const muir = src("docs/js/campus-muir-field.js");
  assert.match(muir, /from\s+["']\.\/campus-goal\.js["']/, "Muir Field stopped importing the goal");
  assert.doesNotMatch(muir, /stand\.box\([^)]*GOAL_HEIGHT/,
    "Muir Field is building goal members inline again");
});

test("three.js still gives us the line primitives the net is made of", () => {
  for (const k of ["LineSegments", "LineBasicMaterial", "Float32BufferAttribute"]) {
    assert.equal(typeof THREE[k], "function", `three.js no longer exports ${k}`);
  }
});
