// The crown caps: no shipped tree may read as a blob, and no crown may
// overhang a building or a sports pad.
//
// Replays exactly what the renderer does — species -> form -> clearance ->
// crownFor — over every shipped tree, using the real exclusion-zone data
// (the same data tree-rules.mjs prunes trunks with). A regression in the
// caps, the clearance pass, or the zone data itself fails here, not on the
// site. See ~/.claude/swarm-memory/specs/SPEC-muir-zone-render-fix.md RC2.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { treeExclusionZones, TREE_MAX_HEIGHT } from "../scripts/lib/tree-rules.mjs";
import {
  SPECIES, treeSpecies, solidZones, clearanceFor, crownFor, CROWN_FORMS,
} from "../docs/js/campus-species.js";

const CLEARANCE = 2.4;

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs", "data");
const load = (f) => JSON.parse(readFileSync(path.join(DATA, f)));

const lidar = load("campus-lidar.json");
const campus3d = load("campus-3d.json");
const arcgis = load("campus-arcgis.json");
const markings = load("campus-markings.json");
const zones = treeExclusionZones({ campus3d, arcgis, markings });
const solid = solidZones(zones);

/* Computed once, shared by every test below — this is also the performance
   assertion: the clearance pass over all 7,331 trees x ~1,400 solid zones
   must run comfortably at boot, not per frame. */
const t0 = Date.now();
const rows = lidar.trees.map((t) => {
  const [x, z, h, r] = t;
  const species = treeSpecies(x, z, h, r);
  const form = SPECIES[species].form;
  const clearNeed = clearanceFor(x, z, solid);
  return { t, x, z, h, r, form, clearNeed, crown: crownFor(t, form, clearNeed) };
});
const elapsedMs = Date.now() - t0;

test("the clearance pass over every shipped tree runs at boot speed, not per frame", () => {
  assert.ok(elapsedMs < 2000, `clearance + crownFor over ${lidar.trees.length} trees took ${elapsedMs}ms`);
});

test("no shipped crown reads wider than it is tall by more than 10% (proportion cap)", () => {
  const violators = [];
  for (const { x, z, h, crown, form } of rows) {
    if (2 * crown.crownR > 1.1 * h + 1e-9) {
      violators.push(`(${x}, ${z}) ${form} h=${h} crownR=${crown.crownR.toFixed(2)}`);
    }
  }
  assert.deepEqual(violators.slice(0, 8), [], `${violators.length} crowns exceed the 1.1x proportion cap`);
});

test("round and tall crowns hold the tighter 0.9x cap; only umbrella pines get the full 1.1x", () => {
  const violators = [];
  for (const { x, z, h, crown, form } of rows) {
    if (form === "umbrella") continue;
    if (2 * crown.crownR > 0.9 * h + 1e-9) {
      violators.push(`(${x}, ${z}) ${form} h=${h} crownR=${crown.crownR.toFixed(2)}`);
    }
  }
  assert.deepEqual(violators.slice(0, 8), [], `${violators.length} round/tall crowns exceed the 0.9x cap`);
});

test("no shipped crown overlaps a building footprint or a sports pad (intrusion cap)", () => {
  const violators = [];
  for (const { x, z, h, crown, form, clearNeed } of rows) {
    if (crown.crownR > clearNeed + 1e-9) {
      violators.push(`(${x}, ${z}) ${form} crownR=${crown.crownR.toFixed(2)} clearNeed=${clearNeed.toFixed(2)}`);
    }
  }
  assert.deepEqual(violators.slice(0, 8), [], `${violators.length} crowns intrude on a solid zone`);
});

test("every crown is a real, non-degenerate shape — never a bare pole, never NaN", () => {
  for (const { x, z, crown } of rows) {
    assert.ok(Number.isFinite(crown.crownR), `crownR not finite at (${x}, ${z})`);
    assert.ok(Number.isFinite(crown.crownV), `crownV not finite at (${x}, ${z})`);
    assert.ok(Number.isFinite(crown.centre), `centre not finite at (${x}, ${z})`);
    assert.ok(crown.crownR > 0.3, `crownR ${crown.crownR} too small at (${x}, ${z})`);
    assert.ok(crown.crownV > 0, `crownV ${crown.crownV} not positive at (${x}, ${z})`);
  }
});

test("crownFor is pure: the same tree, form and clearNeed always give the same crown", () => {
  for (const { t, form, clearNeed } of rows.slice(0, 500)) {
    const a = crownFor(t, form, clearNeed);
    const b = crownFor(t, form, clearNeed);
    assert.deepEqual(a, b);
  }
});

test("crownFor accepts the raw LiDAR row or an equivalent object identically", () => {
  for (const { t, h, r, form, clearNeed } of rows.slice(0, 50)) {
    const fromRow = crownFor(t, form, clearNeed);
    const fromObj = crownFor({ h, r }, form, clearNeed);
    assert.deepEqual(fromRow, fromObj);
  }
});

test("a tree with no clearance data (no zones) never intrudes on nothing and never degenerates", () => {
  for (const { t, form } of rows.slice(0, 50)) {
    const crown = crownFor(t, form, Infinity);
    assert.ok(crown.crownR > 0.3 && Number.isFinite(crown.crownR));
  }
});

/* Direct boundary-value tests for the intrusion cap: crownR <= clearNeed
   must hold for every clearNeed, including below the non-degenerate floor
   (a physically-impossible input upstream pruning forbids in shipped
   data), and crownR must stay strictly > 0.3 once clearNeed reaches the
   floor. See docs/js/campus-species.js crownFor Rule 2. */
test("crownFor's intrusion cap always beats the non-degenerate floor, for every clearNeed", () => {
  const clearNeeds = [0, 0.1, 0.29, 0.35, 0.5, 1.0, Infinity];
  const trees = [
    { t: [0, 0, 10, 5], form: "round" },
    { t: [0, 0, 10, 5], form: "tall" },
    { t: [0, 0, 20, 8], form: "umbrella" },
  ];
  for (const { t, form } of trees) {
    for (const clearNeed of clearNeeds) {
      const crown = crownFor(t, form, clearNeed);
      assert.ok(
        crown.crownR <= clearNeed + 1e-9,
        `crownR ${crown.crownR} exceeds clearNeed ${clearNeed} for ${form}`,
      );
      assert.ok(Number.isFinite(crown.crownR), `crownR not finite for ${form}, clearNeed=${clearNeed}`);
      assert.ok(Number.isFinite(crown.crownV), `crownV not finite for ${form}, clearNeed=${clearNeed}`);
      assert.ok(Number.isFinite(crown.centre), `centre not finite for ${form}, clearNeed=${clearNeed}`);
      if (clearNeed >= 0.5) {
        assert.ok(crown.crownR > 0.3, `crownR ${crown.crownR} should be > 0.3 at clearNeed=${clearNeed}`);
      }
    }
  }
});

/* Boundary-value tests for the non-degenerate floor vs. the caps: the floor
   at NON_DEGENERATE_FLOOR (0.35) must never push crownR back above the
   ceiling (proportion / head-clearance / grade caps) it was already clamped
   to above — a regression here re-breaks every cap the function just
   enforced. See docs/js/campus-species.js crownFor Rule 4 (grade cap). */
test("the non-degenerate floor never re-breaks the proportion, head-clearance or grade caps for very short trees", () => {
  const clearNeeds = [0, 0.1, 0.29, 0.35, 0.5, 1.0, Infinity];
  const shortHeights = [0.5, 3.0];
  const forms = ["tall", "umbrella", "round"];
  for (const form of forms) {
    const diamRatio = CROWN_FORMS[form].diamRatio;
    for (const h of shortHeights) {
      for (const clearNeed of clearNeeds) {
        const crown = crownFor([0, 0, h, 5], form, clearNeed);
        assert.ok(Number.isFinite(crown.crownR), `crownR not finite: ${form} h=${h} clearNeed=${clearNeed}`);
        assert.ok(Number.isFinite(crown.crownV), `crownV not finite: ${form} h=${h} clearNeed=${clearNeed}`);
        assert.ok(Number.isFinite(crown.centre), `centre not finite: ${form} h=${h} clearNeed=${clearNeed}`);
        assert.ok(
          crown.crownR <= clearNeed + 1e-9,
          `crownR ${crown.crownR} exceeds clearNeed ${clearNeed}: ${form} h=${h}`,
        );
        assert.ok(
          2 * crown.crownR <= diamRatio * h + 1e-9,
          `crownR ${crown.crownR} breaks the ${diamRatio}x proportion cap: ${form} h=${h} clearNeed=${clearNeed}`,
        );
        const underside = crown.centre - crown.crownV;
        assert.ok(
          underside >= -1e-9,
          `underside ${underside} is below grade: ${form} h=${h} clearNeed=${clearNeed}`,
        );
        // Head clearance is only achievable when the tree is tall enough for
        // it in the first place (h - CLEARANCE > 0) *and* clearNeed doesn't
        // itself force a smaller crown than headCap would allow.
        const maxVert = (h - CLEARANCE) / 2;
        const headCap = maxVert > 0 ? maxVert / CROWN_FORMS[form].crownAspect : Infinity;
        if (h > CLEARANCE && clearNeed >= headCap) {
          assert.ok(
            underside >= CLEARANCE - 1e-9,
            `underside ${underside} < CLEARANCE though h=${h} should allow it: ${form} clearNeed=${clearNeed}`,
          );
        }
      }
    }
  }
});

test("crownFor handles h and r edge cases (h=0.5, h=TREE_MAX_HEIGHT, r=0) without intruding or breaking", () => {
  const clearNeeds = [0, 0.1, 0.29, 0.35, 0.5, 1.0, Infinity];
  const trees = [
    { t: [0, 0, 0.5, 3], form: "round" },
    { t: [0, 0, TREE_MAX_HEIGHT, 12], form: "tall" },
    { t: [0, 0, 10, 0], form: "round" },
    { t: [0, 0, 10, 0], form: "tall" },
  ];
  for (const { t, form } of trees) {
    for (const clearNeed of clearNeeds) {
      const crown = crownFor(t, form, clearNeed);
      assert.ok(Number.isFinite(crown.crownR), `crownR not finite h=${t[2]} r=${t[3]} clearNeed=${clearNeed}`);
      assert.ok(Number.isFinite(crown.crownV), `crownV not finite h=${t[2]} r=${t[3]} clearNeed=${clearNeed}`);
      assert.ok(Number.isFinite(crown.centre), `centre not finite h=${t[2]} r=${t[3]} clearNeed=${clearNeed}`);
      assert.ok(
        crown.crownR <= clearNeed + 1e-9,
        `crownR ${crown.crownR} intrudes on clearNeed ${clearNeed}, h=${t[2]} r=${t[3]}`,
      );
    }
  }
});
