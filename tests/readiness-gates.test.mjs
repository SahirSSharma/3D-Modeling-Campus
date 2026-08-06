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
});
