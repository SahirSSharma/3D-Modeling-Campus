/* The measurement rule itself, pinned.
 *
 * Every other test in this suite checks a BUILDING's height. None of them would
 * catch a branch being dropped from the rule that produces those heights — which
 * is how 25 hand-copied probes ran for a week missing the thin-shelf rule and
 * reported mechanical plant as roof. These tests fail if a branch disappears.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { roofOf, explainRoof, denseBandFraction, percentile } from "../scripts/lib/roof-measure.mjs";

/* n returns at height h, i.e. a flat plane. */
const plane = (h, n) => Array.from({ length: n }, () => h);

describe("roofOf — all three rules", () => {
  test("rule 3: a clean flat roof measures at p98", () => {
    const roofs = [...plane(10, 980), ...plane(10.2, 20)];
    assert.equal(roofOf(roofs, 0), 10.2);
    assert.equal(explainRoof(roofs, 0).rule, "p98");
  });

  test("rule 1: tree crowns far above the roof take the roof plane, not the crown", () => {
    /* The one-storey Student Center measured 23.5 m before this guard: a wooden
       building under eucalyptus. Body at 4 m, crowns at 24 — gap 20 > 5. */
    const roofs = [...plane(4, 900), ...plane(24, 100)];
    assert.equal(roofOf(roofs, 0), 4);
    assert.equal(explainRoof(roofs, 0).rule, "canopy-guard");
  });

  test("rule 2: a thin spike over a dense body is plant, not building", () => {
    /* THE RULE 25 HAND-COPIED PROBES OMITTED. Gap 3.7 m is under the canopy
       threshold of 5, so rule 1 stays quiet; without rule 2 this returns the top
       of the HVAC. These are osm:453's real proportions. */
    const roofs = [...plane(16.1, 900), ...plane(19.9, 100)];
    const base = 0;
    assert.equal(roofOf(roofs, base), 16.1, "thin shelf was counted as building");
    assert.equal(explainRoof(roofs, base).rule, "thin-shelf");
  });

  test("rule 2 needs a base — without one it silently cannot fire", () => {
    /* This is the failure mode itself, pinned so it stays visible: the same
       returns, no base, and the shelf comes back as roof. A probe that forgets
       to pass base gets the old two-rule behaviour and no warning. */
    const roofs = [...plane(16.1, 900), ...plane(19.9, 100)];
    assert.equal(roofOf(roofs, null), 19.9);
    assert.match(explainRoof(roofs, null).why, /NO BASE GIVEN/);
  });

  test("a genuine second storey is NOT discounted as a shelf", () => {
    /* The rule must not eat real building. A stepped mass with a substantial
       upper level fails the density test — no single 2 m band holds 85%. */
    const roofs = [...plane(8, 500), ...plane(14, 500)];
    assert.ok(denseBandFraction(roofs, 0) < 0.85);
    assert.equal(roofOf(roofs, 0), 14, "a real upper storey was discounted");
  });

  test("the guards are ordered: canopy wins over thin-shelf", () => {
    /* Dense body, huge gap. Both rules would return p75; rule 1 must be the one
       that fires, because its reason is different and audits read the reason. */
    const roofs = [...plane(5, 950), ...plane(30, 50)];
    assert.equal(explainRoof(roofs, 0).rule, "canopy-guard");
  });
});

describe("primitives", () => {
  test("percentile is order-independent and clamps", () => {
    const v = [5, 1, 4, 2, 3];
    assert.equal(percentile(v, 0.5), 3);
    assert.equal(percentile(v, 1), 5);
    assert.equal(percentile([], 0.5), null);
  });

  test("denseBandFraction finds the densest 2 m band wherever it sits", () => {
    assert.equal(denseBandFraction(plane(7, 100), 0), 1);
    const split = [...plane(3, 50), ...plane(30, 50)];
    assert.equal(denseBandFraction(split, 0), 0.5);
  });
});
