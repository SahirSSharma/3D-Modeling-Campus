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
import {
  OVERLAY_RUNGS, OVERLAY, overlayLift, applyOverlayDepth,
} from "../docs/js/campus-overlay.js";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const src = (rel) => readFileSync(join(ROOT, rel), "utf8");

const DRAPING_MODULES = [
  "docs/js/campus-world.js",
  "docs/js/campus-muir-field.js",
  "docs/js/campus-recreation.js",
  "docs/js/campus-markings.js",
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
