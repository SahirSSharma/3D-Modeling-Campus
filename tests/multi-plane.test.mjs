/* The stepped-roof reader, pinned.
 *
 * This rule is built to retire a class the loop cannot retire by hand — 280
 * rings at one per three shards. A rule that retires a class at scale is
 * exactly the kind that must not be allowed to drift: every one of these tests
 * describes a shape the point cloud actually produces on this campus, and what
 * the rule is required to say about it.
 *
 * The most important tests here are the ones that demand a REFUSAL. A stepped
 * roof read wrongly ships an invented building; "better absent than wrong"
 * means `confident: false` is a correct answer and must stay reachable.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readLevels, dominantLevel, planeSpread, MIN_STEP_M } from "../scripts/lib/multi-plane.mjs";

/* n returns at height h above a base of 0, with optional gaussian-ish jitter so
   a "flat" deck is flat the way a laser sees one, not the way a spec does. */
const plane = (h, n, jitter = 0.12) =>
  Array.from({ length: n }, (_, i) => h + (((i * 2654435761) % 1000) / 1000 - 0.5) * 2 * jitter);

describe("readLevels — stepped roofs", () => {
  test("a two-storey wing joined to a four-storey block reads as two levels", () => {
    /* The shape that makes up most of the 280: one ring, two decks, ~7 m apart.
       The single-plane gate rejects this on spread and is right to; the whole
       point of this module is that the rejection is not the end of the story. */
    const roofs = [...plane(7.2, 520), ...plane(14.4, 480)];
    const r = readLevels(roofs, 0);
    assert.equal(r.confident, true, r.why);
    assert.equal(r.levels.length, 2);
    assert.ok(Math.abs(r.levels[0].h - 14.4) < 0.6, `top level read ${r.levels[0].h}`);
    assert.ok(Math.abs(r.levels[1].h - 7.2) < 0.6, `lower level read ${r.levels[1].h}`);
  });

  test("the extruded height is the TALLEST level, not the most populated", () => {
    /* A podium carries more returns than the tower standing on it. A person
       walking past reads the building by its tallest part, so a rule that
       returned the majority plane would shrink every tower on campus to its
       base. */
    const roofs = [...plane(5, 800), ...plane(21, 300)];
    assert.ok(Math.abs(dominantLevel(roofs, 0) - 21) < 0.6);
  });

  test("a flat roof is NOT a stepped roof, and says so", () => {
    /* Handing a single plane to this rule must not manufacture a second level.
       roofOf owns this case and the refusal points at it by name. */
    const r = readLevels(plane(11, 1000), 0);
    assert.equal(r.confident, false);
    assert.match(r.why, /not a stepped roof|roofOf/);
  });

  test("a parapet is not a storey — that case belongs to the thin-shelf rule", () => {
    /* 1.2 m of upstand over a deck. Below MIN_STEP_M, so this rule declines and
       roof-measure.mjs's thin-shelf branch handles it. Two rules that both
       claimed this shape would disagree on some ring and nobody would know. */
    const roofs = [...plane(9, 850), ...plane(10.2, 200)];
    const r = readLevels(roofs, 0);
    assert.ok(r.levels.length < 2 || Math.abs(r.levels[0].h - r.levels[1].h) >= MIN_STEP_M);
    assert.equal(r.confident, false);
  });

  test("tree canopy over a roof is refused, not read as an upper storey", () => {
    /* Crowns are the failure mode that already cost this project a 23.5 m
       one-storey Student Center. They are spread, not flat, so the tightness
       and explained-share tests must both catch them. A confident TRUE here
       would ship a building made of eucalyptus. */
    const canopy = Array.from({ length: 400 }, (_, i) => 14 + ((i * 7919) % 1000) / 1000 * 9);
    const r = readLevels([...plane(4, 600), ...canopy], 0);
    assert.equal(r.confident, false, `read canopy as levels: ${r.why}`);
  });

  test("a sloped or domed surface is refused", () => {
    /* A ramp reads as a smear of bins, each thin. Extruding its peak would
       stand a flat slab where a slope is. */
    const ramp = Array.from({ length: 900 }, (_, i) => 3 + (i / 900) * 9);
    const r = readLevels(ramp, 0);
    assert.equal(r.confident, false, r.why);
  });

  test("scattered returns explain nothing and are refused", () => {
    const scatter = Array.from({ length: 300 }, (_, i) => ((i * 104729) % 2000) / 100);
    assert.equal(readLevels(scatter, 0).confident, false);
  });

  test("no base means no reading — the same failure roof-measure guards", () => {
    /* Without a base, "height above ground" is undefined and every level would
       be an elevation wearing a height's name. roofOf silently degrades in this
       case; this rule refuses outright, because it is newer and can. */
    const r = readLevels([...plane(7, 500), ...plane(14, 500)], null);
    assert.equal(r.confident, false);
    assert.match(r.why, /NO BASE GIVEN/);
    assert.equal(dominantLevel([...plane(7, 500), ...plane(14, 500)], null), null);
  });

  test("an unconfident reading yields no height at all", () => {
    /* Better absent than wrong, enforced in code rather than in a comment. */
    assert.equal(dominantLevel(plane(11, 1000), 0), null);
  });

  test("three genuine levels are read as three", () => {
    const roofs = [...plane(4, 400), ...plane(11, 380), ...plane(18, 360)];
    const r = readLevels(roofs, 0);
    assert.equal(r.confident, true, r.why);
    assert.equal(r.levels.length, 3);
  });
});

describe("planeSpread — what the single-plane gate actually rejects", () => {
  /* MEASURED 2026-08-05, and it overturned this module's original premise.
     A clean two-level roof does NOT produce a large spread at ANY split:

       upper plane   5%   10%   15%   20%   25%   40%   50%
       gate spread  0.06  0.07  0.07  0.08  0.22  0.14  0.11

     Every one of those is admitted. Two different mechanisms hide the step:
     above a 5 m gap the CANOPY GUARD fires, discards the upper plane as crown
     and measures the body; below it, p75 and p98 both land in the upper plane
     and the difference collapses. So "the 280 rings fail only on spread" cannot
     mean they are clean two-step roofs — they must be continuously terraced or
     otherwise smeared. */
  test("a clean two-level step does not trip the spread criterion", () => {
    assert.ok(planeSpread([...plane(7, 500), ...plane(14, 500)], 0) <= 1.2);
    assert.ok(planeSpread([...plane(7, 950), ...plane(14, 50)], 0) <= 1.2);
  });

  test("even four-deck terracing is admitted — DISCRETE steps never trip it", () => {
    /* A hillside estate at 4/6/8/10 m scores 0.22 and ships at its top deck.
       Measured, and it is the finding that matters: the criterion is blind to
       steps of every shape and split tested. */
    const terraced = [...plane(4, 250), ...plane(6, 250), ...plane(8, 250), ...plane(10, 250)];
    assert.ok(planeSpread(terraced, 0) <= 1.2, `terraced spread ${planeSpread(terraced, 0)}`);
  });

  test("what DOES trip it is a CONTINUOUS distribution", () => {
    /* A ramp from 3 to 12 m scores 2.07; a body with a smeared tail scores
       3.07. Nothing discrete reaches 1.2. So the ~280 rings rejected on spread
       are not stepped roofs waiting for a photograph to count their levels —
       they are rings whose returns form a continuum: sloped surfaces, or a
       mixture of roof with canopy and ground. That is a different problem with
       a different answer, and a multi-plane rule is the wrong tool for it. */
    const ramp = Array.from({ length: 1000 }, (_, i) => 3 + (i / 1000) * 9);
    assert.ok(planeSpread(ramp, 0) > 1.2, `ramp spread ${planeSpread(ramp, 0)}`);
    const smeared = [...plane(6, 700), ...Array.from({ length: 300 }, (_, i) => 7 + (i / 300) * 4)];
    assert.ok(planeSpread(smeared, 0) > 1.2, `smeared spread ${planeSpread(smeared, 0)}`);
  });

  test("a flat roof does not", () => {
    assert.ok(planeSpread(plane(9, 1000), 0) <= 1.2);
  });

  test("the canopy guard will discard a minority upper storey", () => {
    /* Not a bug to fix here, but the reason these rings need imagery: with 5%
       of returns 7 m above the body, the guard cannot tell a stair penthouse
       from a real tower, and it takes the body. A rule that guessed instead
       would be inventing buildings. */
    const towerOnPodium = [...plane(7, 950), ...plane(14, 50)];
    const r = readLevels(towerOnPodium, 0);
    assert.equal(r.confident, false,
      "a 5% upper plane must not be confidently read as a storey");
  });
});
