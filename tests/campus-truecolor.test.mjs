// campus-truecolor.json — the measured colour layer.
//
// What is being protected:
//   1. The file parses and is non-trivial: the campus's surfaces and roofs
//      really did get measured, not three of them.
//   2. Every key RESOLVES against the shipped geometry. Keys are geometry
//      hashes (see scripts/build-campus-truecolor.mjs header); a small orphan
//      budget absorbs the polygons that legitimately move when another data
//      file rebuilds first — beyond it, the builder must be re-run.
//   3. Every colour is inside the taste-guard gamut — the clamp that makes a
//      neon roof impossible is asserted here, not just promised.
//   4. A ground truth: Muir field's turf measures GREENER than Library Walk's
//      pavement. If those two ever agree, the sampler is reading the wrong
//      pixels.
//
// keyOf is duplicated from the build script ON PURPOSE: the test proves the
// documented keying rule, not whatever the script happens to compute today.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const load = (p) => JSON.parse(readFileSync(path.join(ROOT, p), "utf8"));

const tc = load("docs/data/campus-truecolor.json");
const arcgis = load("docs/data/campus-arcgis.json");
const campus = load("docs/data/campus-3d.json");

const keyOf = (ring) => {
  let sx = 0, sz = 0;
  for (const p of ring) { sx += p[0]; sz += p[1]; }
  return `${Math.round(sx / ring.length)},${Math.round(sz / ring.length)}`;
};

const inRing = (x, z, ring) => {
  let ins = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
};

const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

test("truecolor file parses and is substantial", () => {
  assert.ok(tc.surfaces && typeof tc.surfaces === "object");
  assert.ok(tc.roofs && typeof tc.roofs === "object");
  assert.ok(Object.keys(tc.surfaces).length > 1000, "surfaces should number in the thousands");
  assert.ok(Object.keys(tc.roofs).length > 500, "roofs should number in the hundreds");
});

test("every colour is a hex triplet inside the taste-guard gamut", () => {
  const entries = [...Object.entries(tc.surfaces), ...Object.entries(tc.roofs)];
  for (const [k, hex] of entries) {
    assert.match(hex, /^#[0-9a-f]{6}$/, `${k} -> ${hex}`);
    const [r, g, b] = rgb(hex).map((v) => v / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const s = max === min ? 0 : l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
    /* GAMUT from the build script (s<=0.55, 0.20<=l<=0.85) plus 8-bit
       re-encoding slack. */
    assert.ok(s <= 0.57, `${k} ${hex} saturation ${s.toFixed(3)} out of gamut`);
    assert.ok(l >= 0.19 && l <= 0.86, `${k} ${hex} lightness ${l.toFixed(3)} out of gamut`);
  }
});

test("keys resolve against the shipped geometry (small budget for rebuilt data)", () => {
  const validS = new Set();
  for (const g of arcgis.ground || []) {
    validS.add(`g:${g.k}:${keyOf(g.r[0].map(([x, z]) => [x / 10, z / 10]))}`);
  }
  for (const s of campus.surfaces || []) {
    if (s.p && s.p.length >= 3) validS.add(`s:${s.kind}:${keyOf(s.p)}`);
  }
  const validR = new Set();
  for (const m of arcgis.massing || []) {
    validR.add(`m:${keyOf(m.r[0].map(([x, z]) => [x / 10, z / 10]))}`);
  }
  for (const b of campus.buildings || []) {
    validR.add(`b:${keyOf(b.p)}`);
    for (const part of b.parts || []) validR.add(`b:${keyOf(part.p)}`);
  }

  const sKeys = Object.keys(tc.surfaces);
  const rKeys = Object.keys(tc.roofs);
  const sOrphans = sKeys.filter((k) => !validS.has(k));
  const rOrphans = rKeys.filter((k) => !validR.has(k));
  /* An orphan is a polygon that moved in a later data rebuild: it falls back
     to palette colour and costs nothing. Many orphans mean the truecolor
     build is stale — re-run scripts/build-campus-truecolor.mjs. */
  const budget = (n) => Math.max(3, Math.ceil(n * 0.02));
  assert.ok(
    sOrphans.length <= budget(sKeys.length),
    `${sOrphans.length} surface keys resolve to nothing (e.g. ${sOrphans.slice(0, 3).join(", ")}) — re-run build-campus-truecolor.mjs`
  );
  assert.ok(
    rOrphans.length <= budget(rKeys.length),
    `${rOrphans.length} roof keys resolve to nothing (e.g. ${rOrphans.slice(0, 3).join(", ")}) — re-run build-campus-truecolor.mjs`
  );

  /* And the inverse: the measured layer must actually COVER the campus. */
  const sHit = sKeys.length - sOrphans.length;
  const rHit = rKeys.length - rOrphans.length;
  assert.ok(sHit / validS.size > 0.5, `only ${sHit}/${validS.size} surfaces measured`);
  assert.ok(rHit > 800, `only ${rHit} roofs measured`);
});

test("ground truth: Muir field turf is greener than Library Walk pavement", () => {
  /* Resolve both polygons BY POINT, so the test survives geometry rebuilds:
     (-180,-260) is on Muir field's turf, (340,150) is Library Walk pavement. */
  const colourAt = (x, z, kind) => {
    for (const g of arcgis.ground || []) {
      if (g.k !== kind) continue;
      const ring = g.r[0].map(([px, pz]) => [px / 10, pz / 10]);
      if (!inRing(x, z, ring)) continue;
      const hex = tc.surfaces[`g:${kind}:${keyOf(ring)}`];
      if (hex) return hex;
    }
    return null;
  };
  const turf = colourAt(-180, -260, "green");
  const pave = colourAt(340, 150, "walk");
  assert.ok(turf, "no measured colour for Muir field turf");
  assert.ok(pave, "no measured colour for Library Walk pavement");
  const greenness = (hex) => {
    const [r, g, b] = rgb(hex);
    return g - (r + b) / 2;
  };
  assert.ok(
    greenness(turf) > greenness(pave) + 10,
    `turf ${turf} (greenness ${greenness(turf)}) should be clearly greener than pavement ${pave} (${greenness(pave)})`
  );
  /* And the pavement reads as pale neutral concrete, not grass. */
  const [pr, pg, pb] = rgb(pave);
  assert.ok(Math.max(pr, pg, pb) - Math.min(pr, pg, pb) < 30, `pavement ${pave} should be near-neutral`);
});
