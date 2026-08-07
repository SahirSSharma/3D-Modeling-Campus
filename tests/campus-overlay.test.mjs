// The shared draped-overlay ladder (campus-overlay.js) and the four modules
// that must climb it: campus-world.js, campus-muir-field.js,
// campus-recreation.js, campus-markings.js.
//
// This pins the depth-independence mechanism the SPEC calls for — a decal
// stack ordered by renderOrder, not by how close the lifts happen to sit —
// by importing the REAL constants, and it pins that no draping module has
// quietly regressed back to a local lift/polygonOffset constant of its own.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as THREE from "../docs/vendor/three/three.module.min.js";
import {
  OVERLAY_RUNGS, OVERLAY, overlayLift, applyOverlayDepth, sceneTone,
} from "../docs/js/campus-overlay.js";

/* Rec.601 luma, matching the sampler the SPEC's colour audit used
   (python3 sample.py prints the same weights). */
const luma = (c) => 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
const rawColor = (hex) => new THREE.Color(hex);
const hslOf = (c) => { const hsl = {}; c.getHSL(hsl); return hsl; };

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const src = (rel) => readFileSync(join(ROOT, rel), "utf8");

const DRAPING_MODULES = [
  "docs/js/campus-world.js",
  "docs/js/campus-muir-field.js",
  "docs/js/campus-recreation.js",
  "docs/js/campus-rimac.js",
  "docs/js/campus-markings.js",
  "docs/js/campus-eighth.js",
  "docs/js/campus-eighth-court.js",
  /* The regional roads and water bodies drape too. A draping module that is
     not on this list is a module the local-lift-constant guard below cannot
     see, which is the whole failure mode this list exists to prevent. */
  "docs/js/campus-region-massing.js",
];

test("OVERLAY_RUNGS is the exact ground-upward order", () => {
  assert.deepEqual(OVERLAY_RUNGS, ["ground", "pad", "carpet", "paint", "logo"]);
  /* Every rung named in the array has a table entry, and vice versa. */
  for (const rung of OVERLAY_RUNGS) assert.ok(OVERLAY[rung], `OVERLAY.${rung} missing`);
  assert.deepEqual(Object.keys(OVERLAY).sort(), [...OVERLAY_RUNGS].sort());
});

test("lift is strictly increasing, every step at least 0.03 m", () => {
  const lifts = OVERLAY_RUNGS.map((r) => OVERLAY[r].lift);
  for (let i = 1; i < lifts.length; i++) {
    const step = lifts[i] - lifts[i - 1];
    assert.ok(step >= 0.03, `${OVERLAY_RUNGS[i - 1]}->${OVERLAY_RUNGS[i]} step ${step} < 0.03 m`);
  }
});

test("renderOrder is strictly increasing and >= 1 for every rung", () => {
  const orders = OVERLAY_RUNGS.map((r) => OVERLAY[r].renderOrder);
  for (const o of orders) assert.ok(o >= 1, `renderOrder ${o} < 1`);
  for (let i = 1; i < orders.length; i++) {
    assert.ok(orders[i] > orders[i - 1],
      `${OVERLAY_RUNGS[i - 1]}(${orders[i - 1]})->${OVERLAY_RUNGS[i]}(${orders[i]}) not strictly increasing`);
  }
});

test("polygonOffset factor and units are strictly decreasing, aligned in direction", () => {
  const factors = OVERLAY_RUNGS.map((r) => OVERLAY[r].polygonOffsetFactor);
  const units = OVERLAY_RUNGS.map((r) => OVERLAY[r].polygonOffsetUnits);
  for (let i = 1; i < factors.length; i++) {
    assert.ok(factors[i] < factors[i - 1],
      `factor ${OVERLAY_RUNGS[i - 1]}(${factors[i - 1]})->${OVERLAY_RUNGS[i]}(${factors[i]}) not strictly decreasing`);
    assert.ok(units[i] < units[i - 1],
      `units ${OVERLAY_RUNGS[i - 1]}(${units[i - 1]})->${OVERLAY_RUNGS[i]}(${units[i]}) not strictly decreasing`);
    /* Aligned direction: both moved more negative by the same sign of step. */
    const factorStep = factors[i] - factors[i - 1];
    const unitsStep = units[i] - units[i - 1];
    assert.ok(Math.sign(factorStep) === Math.sign(unitsStep),
      `factor/units steps disagree in direction at ${OVERLAY_RUNGS[i]}`);
  }
});

test("overlayLift returns the table's lift and throws on an unknown rung", () => {
  for (const rung of OVERLAY_RUNGS) assert.equal(overlayLift(rung), OVERLAY[rung].lift);
  assert.throws(() => overlayLift("asphalt"), /unknown rung/);
  assert.throws(() => overlayLift(), /unknown rung/);
});

test("applyOverlayDepth sets the decal-stack contract and returns the same material", () => {
  for (const rung of OVERLAY_RUNGS) {
    const material = {}; // a plain object stands in for a THREE.Material here
    const returned = applyOverlayDepth(material, rung);
    assert.equal(returned, material, "must return the same instance");
    assert.equal(material.polygonOffset, true);
    assert.equal(material.polygonOffsetFactor, OVERLAY[rung].polygonOffsetFactor);
    assert.equal(material.polygonOffsetUnits, OVERLAY[rung].polygonOffsetUnits);
    assert.equal(material.depthWrite, false, "decal stack must not write depth");
    assert.equal(material.depthTest, true, "must still test against terrain/buildings/trees");
  }
  assert.throws(() => applyOverlayDepth({}, "asphalt"), /unknown rung/);
});

test("every draping module imports from the shared ladder module", () => {
  const IMPORT_RE = /import\s*\{[^}]*\}\s*from\s*["']\.\/campus-overlay\.js["']/;
  for (const rel of DRAPING_MODULES) {
    assert.match(src(rel), IMPORT_RE, `${rel}: no import from campus-overlay.js`);
  }
});

test("no draping module reintroduces a local lift or polygonOffset constant", () => {
  /* A bare number assigned straight to a *LIFT/*DRAPE-named constant is the
     exact regression the ladder replaces — `const DRAPE_LIFT = 0.055;`,
     `const LIFT = 0.1;`. `const DRAPE_LIFT = overlayLift("carpet");` does not
     match: the right-hand side starts with a letter, not a digit. */
  const LOCAL_LIFT_RE = /const\s+[A-Za-z_]*(?:LIFT|DRAPE)[A-Za-z_]*\s*=\s*-?\d/;
  /* A bare number assigned to a *_OFFSET-named object/constant, e.g. the old
     `const PAD_OFFSET = { factor: -5, units: -10 };`. */
  const LOCAL_OFFSET_RE = /const\s+[A-Za-z_]*OFFSET[A-Za-z_]*\s*=\s*\{/;
  for (const rel of DRAPING_MODULES) {
    const text = src(rel);
    assert.doesNotMatch(text, LOCAL_LIFT_RE, `${rel}: reintroduced a local lift constant`);
    assert.doesNotMatch(text, LOCAL_OFFSET_RE, `${rel}: reintroduced a local polygonOffset constant`);
  }
});

test("campus-world.js: the ground drape has no per-kind special case any more", () => {
  const text = src("docs/js/campus-world.js");
  assert.doesNotMatch(text, /DRAPE\s*-\s*0\.02/,
    "the green-lawn sub-precision special case must be gone");
  assert.match(text, /overlayLift\(\s*["']ground["']\s*\)/,
    "DRAPE must derive from the ladder's ground rung");
});

test("campus-markings.js: the raw mk.lift override is gone from the renderer", () => {
  const text = src("docs/js/campus-markings.js");
  assert.doesNotMatch(text, /mk\.lift\s*\?\?/,
    "a per-marking lift override must no longer reach the renderer as a world lift");
});

test("campus-muir-field.js and campus-recreation.js source their lifts via overlayLift", () => {
  for (const rel of ["docs/js/campus-muir-field.js", "docs/js/campus-recreation.js"]) {
    assert.match(src(rel), /overlayLift\(/, `${rel}: expected an overlayLift(...) call`);
  }
});

test("the renderer modules import clean with the ladder wired in", async () => {
  const world = await import("../docs/js/campus-world.js");
  assert.equal(typeof world.createSurfaces, "function");
  assert.equal(typeof world.createPaths, "function");
  const muir = await import("../docs/js/campus-muir-field.js");
  assert.equal(typeof muir.createMuirField, "function");
  const rec = await import("../docs/js/campus-recreation.js");
  assert.equal(typeof rec.placeRecreation, "function");
  const markings = await import("../docs/js/campus-markings.js");
  assert.equal(typeof markings.createMarkings, "function");
});

test("a long path segment follows the ground through a swale, not across it", async () => {
  /* The drape samples the ground only where a quad has a vertex, and OSM
     maps Salk Institute Road's western run as ONE 159 m segment — the
     ground dips 6 m mid-segment and the road hung across the swale as a
     straight plank (r0c0 sweep, 2026-08-04). buildPaths now subdivides
     every segment to ~6 m, skip or no skip, so the drape samples at least
     as often as the 3 m terrain grid can answer. */
  const { createPaths } = await import("../docs/js/campus-world.js");
  const heightAt = (x) => Math.abs(x) * 0.2; // a V-shaped swale, 16 m deep at the rim
  const campus = { paths: [{ p: [[-80, 0], [80, 0]] }] };
  const scene = { add() {} };
  const group = createPaths(scene, campus, heightAt);
  let minY = Infinity;
  let verts = 0;
  for (const child of group.children) {
    const pos = child.geometry.getAttribute("position");
    verts += pos.count;
    for (let i = 0; i < pos.count; i++) minY = Math.min(minY, pos.getY(i));
  }
  assert.ok(verts >= 27 * 6, `one 160 m segment emitted only ${verts} vertices — not subdivided`);
  assert.ok(minY < 2, `path bottoms out at y=${minY.toFixed(1)} — it bridges the swale instead of following it`);
});

/* sceneTone: the one tone-mapping fix for the unlit-fill-sinks-next-to-
   lifted-ground class (the Muir turf carpet, before this; the trident,
   before that). Every module that needs it imports THIS function — no
   second ad-hoc HSL formula anywhere else in the codebase. */

test("sceneTone(hex, 0) is a no-op: the raw measured colour, unchanged", () => {
  const raw = rawColor("#283e40");
  const toned = sceneTone("#283e40", 0);
  assert.ok(Math.abs(toned.r - raw.r) < 1e-6);
  assert.ok(Math.abs(toned.g - raw.g) < 1e-6);
  assert.ok(Math.abs(toned.b - raw.b) < 1e-6);
});

test("sceneTone lifts a dark measured colour: luma increases with strength", () => {
  const raw = luma(sceneTone("#283e40", 0));
  const half = luma(sceneTone("#283e40", 0.5));
  const full = luma(sceneTone("#283e40", 1));
  assert.ok(half > raw, `strength 0.5 luma ${half} did not exceed raw ${raw}`);
  assert.ok(full > half, `strength 1 luma ${full} did not exceed strength 0.5 luma ${half}`);
});

test("sceneTone monotonically lifts genuinely dark measured colours as strength rises", () => {
  /* Below the lightness curve's fixed point (l=0.65, see campus-overlay.js's
     idempotence note) the lift is a strict increase at every step — this is
     the regime every colour actually routed through sceneTone in this
     codebase lives in (turf, wordmark navy, bar-park rubber, ...). */
  const hexes = ["#283e40", "#1d2d54", "#42546a"];
  for (const hex of hexes) {
    let prev = luma(sceneTone(hex, 0));
    for (let s = 0.1; s <= 1.0001; s += 0.1) {
      const l = luma(sceneTone(hex, s));
      assert.ok(l >= prev - 1e-6, `${hex}: luma dropped going from strength ${s - 0.1} to ${s}`);
      prev = l;
    }
  }
});

test("sceneTone is monotonic: a darker input never comes out lighter than a lighter input", () => {
  /* Same hue and saturation (the turf's own), three strictly increasing
     lightness levels — isolates the lightness-ordering guarantee from any
     hue-crossing luma quirk (Rec.601 weights green far above blue, so two
     DIFFERENT hues at the same HSL lightness can rank differently in luma;
     that is a property of luma, not of sceneTone, so this test holds hue
     fixed to test sceneTone honestly). */
  const { h, s } = hslOf(rawColor("#283e40"));
  const darker = new THREE.Color().setHSL(h, s, 0.12);
  const mid = new THREE.Color().setHSL(h, s, 0.32);
  const lighter = new THREE.Color().setHSL(h, s, 0.55);
  for (const strength of [0, 0.3, 0.5, 0.7, 1]) {
    const ld = luma(sceneTone(`#${darker.getHexString()}`, strength));
    const lm = luma(sceneTone(`#${mid.getHexString()}`, strength));
    const ll = luma(sceneTone(`#${lighter.getHexString()}`, strength));
    assert.ok(ld <= lm, `strength ${strength}: darker (${ld}) came out lighter than mid (${lm})`);
    assert.ok(lm <= ll, `strength ${strength}: mid (${lm}) came out lighter than lighter (${ll})`);
  }
});

test("sceneTone preserves hue", () => {
  for (const hex of ["#283e40", "#1d2d54", "#d4823f", "#c8675a"]) {
    const before = hslOf(rawColor(hex));
    const after = hslOf(sceneTone(hex, 0.6));
    assert.ok(Math.abs(before.h - after.h) < 1e-6, `${hex}: hue drifted ${before.h} -> ${after.h}`);
  }
});

test("sceneTone under repeated application stays bounded and keeps moving toward daylight, never away from it", () => {
  /* Not idempotent (documented in campus-overlay.js): each application is a
     contraction toward lightness 0.65. Re-applying must never diverge, blow
     past valid colour range, or move a colour AWAY from that fixed point. */
  let c = sceneTone("#283e40", 1);
  let prevDist = Math.abs(0.65 - hslOf(c).l);
  for (let i = 0; i < 8; i++) {
    c = sceneTone(`#${c.getHexString()}`, 1);
    const hsl = hslOf(c);
    assert.ok(hsl.l >= 0 && hsl.l <= 1, `lightness left [0,1]: ${hsl.l}`);
    assert.ok(c.r >= 0 && c.r <= 1 && c.g >= 0 && c.g <= 1 && c.b >= 0 && c.b <= 1,
      "repeated application produced an out-of-gamut colour");
    const dist = Math.abs(0.65 - hsl.l);
    assert.ok(dist <= prevDist + 1e-6, `iteration ${i}: moved away from the fixed point (${dist} > ${prevDist})`);
    prevDist = dist;
  }
});

test("sceneToneLogo derives from sceneTone at full strength and is preserved: the trident stays lifted, not a black splat", async () => {
  const { sceneToneLogo } = await import("../docs/js/campus-markings.js");
  const tridentNavy = "#1d2d54";
  const full = sceneTone(tridentNavy, 1);
  const viaLogo = sceneToneLogo(tridentNavy);
  assert.equal(viaLogo.getHexString(), full.getHexString(),
    "sceneToneLogo must be sceneTone at strength 1, not a second formula");
  const rawLuma = luma(rawColor(tridentNavy));
  const toned = luma(viaLogo);
  assert.ok(toned > rawLuma * 1.2,
    `trident navy barely lifted (raw ${rawLuma}, toned ${toned}) — regression toward the black-splat bug`);
});

test("no module outside campus-overlay.js defines a second ad-hoc HSL tone formula", () => {
  /* The regression this class of bug came from: two independent
     `c.setHSL(hsl.h, ..., ...)` lift formulas (campus-markings.js's old
     sceneToneLogo predates campus-overlay.js's sceneTone). Every module
     must call the shared function, never roll its own. */
  const SET_HSL_RE = /\.setHSL\s*\(/;
  const OTHER_MODULES = [
    "docs/js/campus-world.js",
    "docs/js/campus-muir-field.js",
    "docs/js/campus-recreation.js",
    "docs/js/campus-markings.js",
    "docs/js/campus-eighth.js",
    "docs/js/campus-eighth-court.js",
  ];
  for (const rel of OTHER_MODULES) {
    assert.doesNotMatch(src(rel), SET_HSL_RE,
      `${rel}: defines its own .setHSL(...) lift instead of calling campus-overlay.js's sceneTone`);
  }
});
