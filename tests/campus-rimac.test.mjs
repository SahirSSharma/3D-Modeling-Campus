// The RIMAC Field invariants: the ones that would actually go wrong.
//
// The load-bearing claim in campus-rimac.js is that this is a REGULATION
// softball field — measured, not assumed — and everything downstream (where
// the foul lines run, where the skin stops, where the fence stands) is stated
// in terms of that. So the first tests here are the cross-checks that earned
// the claim, run against the module's own published constants:
//
//   · the diamond is stated as a forced 90 deg corner on the bisector of two
//     independently fitted painted lines. If that idealisation is right, it
//     must reproduce BOTH fitted lines. It does, to under 0.2 m over 58 m.
//   · the pitching circle was found twice (a circle fit to the skin's arc, and
//     a dark object parked on the plate). It has to land at the rulebook's
//     43 ft from home, on the diamond's axis.
//   · the skinned infield's arc has to be the rulebook's 60 ft from that
//     circle — a radius nothing was fitted to.
//
// Those three are what separate "measured" from "plausible". If a future edit
// nudges home plate or the heading to make something look better, they fail.
//
// rimacSpec() is pure, so the rest runs the exact geometry the renderer draws.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  rimacSpec, RIMAC_COLORS, SOFTBALL, EAST_FENCE, BLEACHER, TURF_PATCHES,
} from "../docs/js/campus-rimac.js";

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs", "data");
const markings = JSON.parse(readFileSync(path.join(DATA, "campus-markings.json")));
const spec = rimacSpec(markings);
const el = (id) => spec.elements.find((e) => e.id === id);
const FT = 0.3048;

/* The two painted foul lines exactly as they were fitted off the chunks, kept
   here rather than imported: the test proves the model reproduces the
   MEASUREMENT, not whatever the module happens to compute today. */
const FIT_THIRD = (z) => 126.8103 + 0.04265 * z; // x of the third-base line
const FIT_FIRST = (x) => -871.3168 - 0.0481 * x; // z of the first-base line

const D2R = Math.PI / 180;
const along = (p, q) => {
  const t = SOFTBALL.heading_deg * D2R;
  return [
    SOFTBALL.home[0] + p * Math.cos(t) - q * Math.sin(t),
    SOFTBALL.home[1] - p * Math.sin(t) - q * Math.cos(t),
  ];
};

test("the forced-90-degree diamond still lands on both fitted foul lines", () => {
  /* Walk each line out to the fence and compare with its own fit. 58 m is
     long enough that a tenth of a degree of heading error would show. */
  let worst = 0;
  for (let d = 0; d <= 58; d += 1) {
    const [fx, fz] = along(d, 0);
    worst = Math.max(worst, Math.abs(fz - FIT_FIRST(fx)));
    const [tx, tz] = along(0, d);
    worst = Math.max(worst, Math.abs(tx - FIT_THIRD(tz)));
  }
  assert.ok(worst < 0.25, `diamond drifts ${worst.toFixed(3)} m off the fitted paint`);
});

test("the pitching circle sits at the rulebook's 43 ft, on the diamond's axis", () => {
  const [cx, cz] = SOFTBALL.circle;
  const [hx, hz] = SOFTBALL.home;
  const d = Math.hypot(cx - hx, cz - hz);
  assert.ok(Math.abs(d - 43 * FT) < 0.4,
    `home to the circle measures ${(d / FT).toFixed(1)} ft, not 43`);
  /* On the bisector: the two foul-line components must be equal. */
  const t = SOFTBALL.heading_deg * D2R;
  const p = (cx - hx) * Math.cos(t) - (cz - hz) * Math.sin(t);
  const q = -(cx - hx) * Math.sin(t) - (cz - hz) * Math.cos(t);
  assert.ok(Math.abs(p - q) < 0.5, `circle off the axis: p ${p.toFixed(2)} vs q ${q.toFixed(2)}`);
});

test("the skinned infield's arc is the rulebook's 60 ft grass line", () => {
  assert.ok(Math.abs(SOFTBALL.skinArc_m - 60 * FT) < 0.3,
    `skin arc ${(SOFTBALL.skinArc_m / FT).toFixed(1)} ft, not 60`);
});

test("the outfield is a real softball outfield: ~190 ft down the lines", () => {
  const g = SOFTBALL.grass;
  const first = (g.east - SOFTBALL.home[0]) / Math.cos(SOFTBALL.heading_deg * D2R);
  const third = (SOFTBALL.home[1] - g.north) / Math.cos(SOFTBALL.heading_deg * D2R);
  for (const [name, d] of [["first", first], ["third", third]]) {
    assert.ok(Math.abs(d / FT - 190) < 3,
      `${name}-base line reaches ${(d / FT).toFixed(0)} ft, not ~190`);
  }
  /* And dead centre is further, as an outfield must be. */
  const [cx, cz] = SOFTBALL.arc.c;
  const hc = [SOFTBALL.home[0] - cx, SOFTBALL.home[1] - cz];
  const u = [Math.SQRT1_2, -Math.SQRT1_2];
  const b = 2 * (u[0] * hc[0] + u[1] * hc[1]);
  const c = hc[0] ** 2 + hc[1] ** 2 - SOFTBALL.arc.grass_r ** 2;
  const centre = (-b + Math.sqrt(b * b - 4 * c)) / 2;
  assert.ok(centre > first + 4 && centre / FT < 215,
    `dead centre ${(centre / FT).toFixed(0)} ft is not between the lines and 215`);
});

test("the warning track keeps its four measured widths, the east one narrowest", () => {
  const g = SOFTBALL.grass, f = SOFTBALL.fence;
  const w = {
    west: g.west - f.west, north: g.north - f.north,
    south: f.south - g.south, east: f.east - g.east,
  };
  for (const [side, m] of Object.entries(w)) {
    assert.ok(m > 2.2 && m < 3.4, `${side} band ${m.toFixed(2)} m is off its measurement`);
  }
  assert.ok(w.east < w.west && w.east < w.north && w.east < w.south,
    "the east band is the measured narrow one and must stay so");
});

test("the enclosure closes: the arc meets both straights it joins", () => {
  const grass = el("softball-turf").poly;
  const fence = el("softball-fence").pts;
  for (const [name, loop, side] of [["grass", grass, SOFTBALL.grass], ["fence", fence, SOFTBALL.fence]]) {
    const xs = loop.map((p) => p[0]), zs = loop.map((p) => p[1]);
    assert.ok(Math.abs(Math.min(...xs) - side.west) < 0.01, `${name} west edge`);
    assert.ok(Math.abs(Math.min(...zs) - side.north) < 0.01, `${name} north edge`);
    assert.ok(Math.abs(Math.max(...zs) - side.south) < 0.01, `${name} south edge`);
    assert.ok(Math.max(...xs) <= side.east + 0.01, `${name} runs past its east straight`);
    /* No step anywhere: consecutive points never jump. */
    for (let i = 1; i < loop.length; i++) {
      const d = Math.hypot(loop[i][0] - loop[i - 1][0], loop[i][1] - loop[i - 1][1]);
      assert.ok(d < 68, `${name} loop jumps ${d.toFixed(1)} m at ${i}`);
    }
  }
});

test("the painted foul lines start at the skin and end at the fence, not before", () => {
  for (const [id, far] of [
    ["softball-foul-first", SOFTBALL.grass.east],
    ["softball-foul-third", SOFTBALL.grass.north],
  ]) {
    const e = el(id);
    assert.equal(e.pts.length, 2);
    const start = Math.hypot(e.pts[0][0] - SOFTBALL.home[0], e.pts[0][1] - SOFTBALL.home[1]);
    const end = Math.hypot(e.pts[1][0] - SOFTBALL.home[0], e.pts[1][1] - SOFTBALL.home[1]);
    assert.ok(start > 23 && start < 27, `${id} starts ${start.toFixed(1)} m out, not at the skin`);
    assert.ok(end > 56 && end < 59, `${id} ends ${end.toFixed(1)} m out, not at the fence`);
    const reach = id.endsWith("first") ? e.pts[1][0] : e.pts[1][1];
    assert.ok(Math.abs(reach - far) < 0.2, `${id} misses its own straight by ${Math.abs(reach - far).toFixed(2)} m`);
  }
});

test("everything softball stays inside the softball field's own enclosure", () => {
  const f = SOFTBALL.fence;
  const pad = 0.2;
  for (const e of spec.elements) {
    if (!e.id.startsWith("softball")) continue;
    const pts = e.poly || e.pts || [];
    for (const [x, z] of pts) {
      assert.ok(x >= f.west - pad && x <= f.east + pad && z >= f.north - pad && z <= f.south + pad,
        `${e.id} strays to ${x.toFixed(1)}, ${z.toFixed(1)}`);
    }
  }
});

test("the turf patch maps are the shape the sampler emitted", () => {
  for (const [id, map] of Object.entries(TURF_PATCHES)) {
    const f = markings.facilities.find((x) => x.id === id);
    assert.ok(f, `${id} is gone from campus-markings.json — the maps hang off it`);
    const [b0, b1, , b3] = f.bounds;
    const W = Math.hypot(b1[0] - b0[0], b1[1] - b0[1]);
    const L = Math.hypot(b3[0] - b0[0], b3[1] - b0[1]);
    const fullRows = Math.round(L / (W / 20));
    for (const row of map) {
      assert.equal(row.length, 20, `${id}: a row is not 20 cells`);
      assert.match(row, /^[.\-#]{20}$/, `${id}: a row has a cell the renderer cannot colour`);
    }
    assert.ok(map.length <= fullRows,
      `${id}: ${map.length} rows sampled but the quad only holds ${fullRows}`);
    /* Each family is a real share of the pitch, not a rounding artefact. */
    const all = map.join("");
    for (const ch of ".-#") {
      const share = [...all].filter((c) => c === ch).length / all.length;
      assert.ok(share > 0.1, `${id}: '${ch}' covers only ${(share * 100).toFixed(0)}% — the split collapsed`);
    }
  }
});

test("no turf patch lands on the softball field", () => {
  const f = SOFTBALL.fence;
  for (const e of spec.elements) {
    if (e.type !== "patch") continue;
    for (const [x, z] of e.poly) {
      const inside = x > f.west && x < f.east && z > f.north && z < f.south;
      assert.ok(!inside, `${e.id} paints turf over the softball field at ${x.toFixed(1)}, ${z.toFixed(1)}`);
    }
  }
  /* And the north pitch's dropped rows really are dropped: nothing from it
     may reach into the south pitch's own quad. */
  const south = markings.facilities.find((x) => x.id === "rimac-south");
  const southNorthEdge = Math.min(...south.bounds.map((p) => p[1]));
  for (const e of spec.elements) {
    if (e.type !== "patch" || e.facility !== "rimac-north") continue;
    for (const [, z] of e.poly) {
      assert.ok(z <= southNorthEdge + 0.01,
        `${e.id} overlaps the south pitch at z ${z.toFixed(1)}`);
    }
  }
});

test("the east perimeter fence runs the length it was tracked over", () => {
  const e = el("east-perimeter-fence");
  const zs = e.pts.map((p) => p[1]);
  assert.ok(Math.min(...zs) <= EAST_FENCE.z0 + 0.01);
  assert.ok(Math.max(...zs) >= EAST_FENCE.z1 - 0.01);
  assert.ok(Math.max(...zs) - Math.min(...zs) > 340, "the fence lost most of its length");
  /* It leans east going south — the measured 3.49 deg off the campus grid. */
  const dx = EAST_FENCE.x_at_z(EAST_FENCE.z1) - EAST_FENCE.x_at_z(EAST_FENCE.z0);
  const deg = (Math.atan2(dx, EAST_FENCE.z1 - EAST_FENCE.z0) * 180) / Math.PI;
  assert.ok(Math.abs(deg - 3.49) < 0.1, `east fence at ${deg.toFixed(2)} deg, not 3.49`);
  /* And it stays east of every field it is meant to bound. */
  const eastmost = Math.max(...markings.facilities
    .filter((f) => f.id.startsWith("rimac-")).flatMap((f) => f.bounds.map((p) => p[0])));
  assert.ok(Math.min(...e.pts.map((p) => p[0])) > eastmost,
    "the perimeter fence cuts across a pitch");
});

test("the bleacher is one 9.5 m deck in three blocks that do not overlap", () => {
  const decks = spec.elements.filter((e) => e.id.startsWith("bleacher-deck"));
  assert.equal(decks.length, 3);
  assert.ok(Math.abs(BLEACHER.x1 - BLEACHER.x0 - 9.5) < 0.01);
  const sorted = [...BLEACHER.blocks].sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < sorted.length; i++) {
    assert.ok(sorted[i][0] > sorted[i - 1][1],
      `bleacher blocks ${i - 1} and ${i} overlap — the aisles measured between them are gone`);
  }
  /* The risers climb AWAY from the field: the deepest row is the tallest. */
  const risers = spec.elements.filter((e) => e.id.startsWith("bleacher-row-0-"));
  assert.ok(risers.length > 8, "the deck lost its rows");
  const byX = [...risers].sort((a, b) => a.x - b.x);
  for (let i = 1; i < byX.length; i++) {
    assert.ok(byX[i].height_m > byX[i - 1].height_m, "a riser steps the wrong way");
  }
  /* It sits west of every pitch, on the walk, not on the turf. */
  const westmost = Math.min(...markings.facilities
    .filter((f) => f.id.startsWith("rimac-")).flatMap((f) => f.bounds.map((p) => p[0])));
  assert.ok(BLEACHER.x1 < westmost, "the bleacher stands on the pitch");
});

test("every colour is a hex triplet, and the families keep their measured order", () => {
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const luma = (h) => { const [r, g, b] = rgb(h); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  for (const [k, hex] of Object.entries(RIMAC_COLORS)) {
    assert.match(hex, /^#[0-9a-f]{6}$/, `${k} -> ${hex}`);
  }
  /* The three turf terciles are terciles: strictly ordered by luminance. */
  assert.ok(luma(RIMAC_COLORS.turfWet) < luma(RIMAC_COLORS.turfMid));
  assert.ok(luma(RIMAC_COLORS.turfMid) < luma(RIMAC_COLORS.turfDry));
  /* Ground truths from the captures. If any of these flip, the sampler read
     the wrong surface. */
  assert.ok(luma(RIMAC_COLORS.dirt) > luma(RIMAC_COLORS.track),
    "the skinned infield must read lighter than the warning track");
  assert.ok(luma(RIMAC_COLORS.turf) < luma(RIMAC_COLORS.turfDry),
    "the watered softball outfield must read darker than the pitches' dry turf");
  const [tr, tg, tb] = rgb(RIMAC_COLORS.turf);
  assert.ok(tg > tr && tg > tb, "the softball outfield must be green");
  const [dr, dg, db] = rgb(RIMAC_COLORS.dirt);
  assert.ok(dr > dg && dg > db, "the skinned infield must be tan");
  assert.ok(luma(RIMAC_COLORS.windscreen) < 60, "the windscreen must stay dark");
});

test("nothing here models a person", () => {
  const src = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs", "js", "campus-rimac.js"),
    "utf8"
  );
  /* The captures are full of players. They are not campus features, and the
     brief for this module was explicit. A word-level grep is crude but it is
     the check that would catch someone adding them back. */
  for (const word of ["player", "person", "people", "figure", "crowd", "spectator"]) {
    assert.ok(!new RegExp(`\\b${word}s?\\b`, "i").test(src.replace(/NO PEOPLE[\s\S]*?features of the campus and nothing here models them\./, "")),
      `campus-rimac.js mentions "${word}" — has someone started modelling people?`);
  }
});
