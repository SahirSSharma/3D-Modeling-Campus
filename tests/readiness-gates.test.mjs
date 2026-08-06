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

  test("the unnamed backlog target is the loop's real scoreboard", () => {
    /* 777 on the morning of 2026-08-05, 446 after the statistical gate, 357 as
       the stepped-roof work landed. The gate sits at 200 — below where the loop
       stood when it was written, so it cannot be satisfied by standing still. */
    const target = num("unnamedGuessesMax");
    assert.ok(target <= 200, `unnamed target loosened to ${target}`);
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
});
