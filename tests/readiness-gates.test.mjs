/* The handover gate's thresholds, pinned.
 *
 * `npm run readiness` decides whether the campus is worth an hour of a person's
 * attention. It is the one check whose failure costs nothing to make go away —
 * every number in it is a constant in one file, and moving one is a two-second
 * edit that produces a green "READY" over an unchanged campus.
 *
 * So the thresholds live here as well, where changing one is a visible,
 * deliberate act with a diff. These tests do not run the browser; they assert
 * that the gate still says what it said when its numbers were justified.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SRC = readFileSync(new URL("../scripts/readiness.mjs", import.meta.url), "utf8");
const num = (name) => {
  const m = SRC.match(new RegExp(`${name}:\\s*([\\d.]+)`));
  assert.ok(m, `${name} vanished from the readiness gate`);
  return +m[1];
};

describe("readiness gate", () => {
  test("a named building may never render at an invented height", () => {
    /* Zero, and it stays zero. A label is a claim: a person reading "Eckart
       Building, 11.7 m" has been told a number, and the number has to be one we
       measured. Declared post-2014 estimates are excluded from this count by
       construction — they are stated estimates, not fallbacks. */
    assert.equal(num("namedGuessesMax"), 0);
  });

  test("the unnamed target counts ON-CAMPUS rings only, and may never rise", () => {
    /* Redefined 2026-08-05 with evidence, at Sahir's direction. The old gate
       counted all 358 unnamed guesses against a target of 200 — a number picked
       before anyone measured what the backlog contained. 329 of those 358 are
       outside the campus boundary (Nobel Drive and Genesee Avenue office
       blocks), and of the 29 that are campus, only 9 can be answered at all.

       20 is therefore "every ring a photograph could settle, settled". It is
       allowed to FALL as the nine unclassified rings get diagnosed. It is never
       allowed to rise: raising it is how a gate stops meaning anything, and the
       whole point of redefining it was that the previous number meant nothing. */
    const target = num("onCampusGuessesMax");
    assert.ok(target <= 20, `on-campus target loosened to ${target}`);
    assert.doesNotMatch(SRC, /unnamedGuessesMax/,
      "the old campus-wide count is back — it counts the city, not the campus");
    assert.match(SRC, /campus-boundary\.json/,
      "the boundary test was dropped, so every off-campus ring counts again");
  });

  test("no mass may be buried in its own hill", () => {
    assert.equal(num("buriedMax"), 0);
    /* Half a metre of slack is the rasterised roof map against continuously
       sampled terrain. More than that is a building inside a slope. */
    assert.equal(num("buriedSlack_m"), 0.5);
  });

  test("the frame-rate floor is a real floor", () => {
    /* 30 fps on the GPU. The first version of this check ran on chromium's
       default headless GL — SwiftShader, a CPU rasteriser — and reported 3.4 fps
       for a campus the M4 renders at 120. A performance gate pointed at the
       wrong renderer measures the renderer. */
    assert.ok(num("fpsMin") >= 30);
    assert.match(SRC, /--use-angle=metal/, "the GPU launch flags were dropped");
    assert.match(SRC, /SwiftShader\|Software/, "the software-renderer guard was dropped");
  });

  test("the gate cannot pass with console errors", () => {
    assert.equal(num("consoleErrorsMax"), 0);
  });

  test("declared estimates are read from the builder, never restated", () => {
    /* If this list were copied into the gate it would drift, and a stale copy
       would start counting correctly-declared post-2014 buildings as invented
       guesses — punishing the epoch rule for working. */
    assert.match(SRC, /BUILDER\.indexOf\("const POST_2014_SITES ="/);
    assert.doesNotMatch(SRC, /const DECLARED_ESTIMATES = new Set\(\[\s*"/,
      "POST_2014_SITES was inlined into the readiness gate — read it from the builder");
  });

  test("unnamed rings get the same epoch courtesy as named buildings", () => {
    /* POST_2014_OSM_RINGS is the per-ring epoch list: rings whose site the 2014
       flight saw as foundations or bare ground. Such a ring renders at its OSM
       tag BY DESIGN, which makes it a stated estimate — the same thing
       POST_2014_SITES means for a named building.

       The gate honoured that for named buildings and not for unnamed ones, so a
       correctly-declared ring was reported as an invented guess. That is the
       epoch rule being punished for working. It was one ring the day this was
       fixed; it would be all of them the day a pass declares twenty. */
    assert.match(SRC, /BUILDER\.indexOf\("const POST_2014_OSM_RINGS = new Set\(\["/,
      "the per-ring epoch list is no longer read from the builder");
    assert.match(SRC, /!b\.n && declaredRings\.includes\(i\)/,
      "declared post-2014 rings are being counted as invented guesses again");
    assert.match(SRC, /declaredRings: DECLARED_RINGS/,
      "the declared-ring list is not passed into the browser context");
  });

  test("when measured tables agree, GPU drift alone cannot invent a guess", () => {
    /* Hubbs Hall (r2c0 2026-08-05_165434): massHeights 12.3 and heights 12.2
       already agree; GPU rendered ≈11.8 on a 9.5 m grade drifted past the
       0.35 m slack and the census matched the OSM tag instead. The
       table-agree branch is the ICW massHeights lesson applied once more —
       the auditor must not invent a guess for a building the builders
       already measured. Slack stays 0.35; this path does not widen it. */
    assert.match(SRC, /nearbyMass != null && near\(measured, nearbyMass\)/,
      "table-agree measured path was dropped");
    assert.match(SRC, /Math\.abs\(a - c\) < 0\.35/,
      "0.35 m rendered slack was widened or removed");
  });

  test("...but the screen still has to show roughly that height", () => {
    /* The branch above was first written to ignore `rendered` entirely, which
       left a hole big enough to drive the whole census through: a building
       whose two tables agree at 12 m while a 4.5 m fallback box stands on
       screen would have been scored "measured" and never reported. Auditing
       what is ON SCREEN is this gate's only job — a 7.5 m divergence is a
       rendering bug, and absorbing it silently is precisely the failure the
       gate exists to prevent.

       1.5 m is generous against the 0.4 m of grade-sampling drift that
       motivated the branch, and nowhere near the gap a fallback would show. */
    assert.match(SRC, /Math\.abs\(rendered - measured\) <= TABLE_AGREE_DRIFT/,
      "the table-agree branch stopped checking the rendered height at all");
    const drift = num("tableAgreeDrift_m");
    assert.ok(drift <= 1.5, `table-agree drift widened to ${drift} m`);
    /* It runs inside page.evaluate, so it has to be passed across — a bare
       GATES reference there is a ReferenceError in the browser context, not a
       value. */
    assert.match(SRC, /TABLE_AGREE_DRIFT: GATES\.tableAgreeDrift_m/,
      "the drift bound is not passed into the browser context");
  });
});
