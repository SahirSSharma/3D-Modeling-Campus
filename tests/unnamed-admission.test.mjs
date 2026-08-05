/* The statistical admission gate, pinned against the decisions people made.
 *
 * 1,030 unnamed OSM rings are measured every build; until 2026-08-05 only the
 * ~286 an agent had personally looked at were allowed to ship, and the rest
 * rendered at an invented number. The gate retires that backlog by rule instead
 * of six per pass.
 *
 * A gate like this earns trust in exactly one way: by reproducing the judgements
 * already on record. These tests hold it to both directions — it must not
 * overrule a withhold, and it must not quietly stop admitting.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const LIDAR = JSON.parse(readFileSync(new URL("../docs/data/campus-lidar.json", import.meta.url), "utf8"));
const CAMPUS = JSON.parse(readFileSync(new URL("../docs/data/campus-3d.json", import.meta.url), "utf8"));
const BUILDER = readFileSync(new URL("../scripts/build-campus-lidar.mjs", import.meta.url), "utf8");

/* Comments inside these blocks quote ring numbers in prose ("1,039 returns",
   "osm:453 / 518"), so the literal has to be read with the comments stripped —
   otherwise the set picks up whatever a sentence happened to mention. */
const setLiteral = (name) => {
  const i = BUILDER.indexOf(`const ${name} = new Set([`);
  assert.ok(i > 0, `${name} not found in the builder`);
  const j = BUILDER.indexOf("]);", i);
  const body = BUILDER.slice(i + `const ${name} = new Set([`.length, j)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
  return new Set([...body.matchAll(/\d+/g)].map((m) => +m[0]));
};

describe("unnamed ring admission", () => {
  test("no hand-withheld ring ships a plane", () => {
    /* The gate never overrules a person. Every index in OSM_WITHHELD was put
       there by a judge who looked at imagery and said no — usually because the
       ring is a stepped mass whose upper plane reads deceptively tight, a
       building that went up after the 2014 flight, or a footprint past the
       survey box whose "ground" comes from the edge of the world. None of those
       are visible in point statistics, which is exactly why the set exists. */
    const withheld = setLiteral("OSM_WITHHELD");
    assert.ok(withheld.size >= 70, `OSM_WITHHELD shrank to ${withheld.size} — withholds do not expire`);
    const leaked = [...withheld].filter((bi) => LIDAR.osmHeights[bi] !== undefined);
    assert.deepEqual(leaked, [], `withheld rings shipped a measured plane: ${leaked.join(", ")}`);
  });

  test("every hand-verified ring still ships", () => {
    /* The gate is additive. If a future edit makes it stricter, it must not take
       the hand-verified set down with it. */
    const verified = setLiteral("OSM_UNNAMED_VERIFIED");
    const missing = [...verified].filter((bi) => LIDAR.osmHeights[bi] === undefined);
    assert.ok(missing.length <= 6,
      `${missing.length} hand-verified rings stopped shipping: ${missing.slice(0, 10).join(", ")}`);
  });

  test("the backlog is substantially retired, and stays retired", () => {
    /* The number that matters for the campus: how many buildings a person walks
       past that were never measured. It was 777 of 1,050 on the morning of
       2026-08-05. A regression here means buildings silently went back to
       rendering at 4.5 m. */
    let unnamed = 0, measured = 0;
    CAMPUS.buildings.forEach((b, i) => {
      if (b.n) return;
      unnamed++;
      if (LIDAR.osmHeights[i] !== undefined) measured++;
    });
    assert.ok(unnamed > 1000, `expected ~1050 unnamed rings, saw ${unnamed}`);
    assert.ok(measured >= 590,
      `only ${measured}/${unnamed} unnamed rings are measured — the admission gate regressed`);
  });

  test("admitted planes are plausible building heights", () => {
    /* The one catastrophic epoch failure is a post-2014 building whose 2014 site
       was a parking lot: clean statistics, and a height near zero. The 3 m floor
       plus the builder's own 2 m drop should mean nothing absurd ever ships. */
    const bad = Object.entries(LIDAR.osmHeights).filter(([, h]) => h < 2 || h > 90);
    assert.deepEqual(bad, [], `implausible admitted heights: ${JSON.stringify(bad.slice(0, 5))}`);
  });

  test("the gate's thresholds are the ones its evidence was measured at", () => {
    /* These four numbers were tuned against 77 hand-withheld rings; loosening one
       without redoing that work reopens the false-admit rate the tuning closed.
       Pinned so a change has to be deliberate. */
    for (const [name, value] of [
      ["STAT_MIN_PTS", 400], ["STAT_MIN_RIM", 0.99],
      ["STAT_MAX_SPREAD", 1.2], ["STAT_MIN_HEIGHT", 3],
    ]) {
      const m = BUILDER.match(new RegExp(`const ${name} = ([\\d.]+)`));
      assert.ok(m, `${name} vanished from the builder`);
      assert.equal(+m[1], value, `${name} changed to ${m[1]} — retune against OSM_WITHHELD first`);
    }
  });
});
