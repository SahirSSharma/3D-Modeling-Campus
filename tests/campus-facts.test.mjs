// The loading screen's numbers, checked against the data they claim to describe.
//
// The screen these feed replaced a hand-written sentence in index.html, and that
// sentence had gone stale in every direction: 12,659 trees when the prune had
// left 7,331, "1,800+ building masses" for 1,396 footprints, 41 million LiDAR
// returns quoted from a build that reports a different figure. Deriving the
// numbers from the data fixed the drift; it did not make them right. The first
// derived draft reported 341 km² of surveyed paving inside an 8.4 km² survey,
// because the GIS rings are decimetres and area scales by a hundred.
//
// So the guard that matters here is not "does the arithmetic run" — it is "is
// the answer physically possible". Nothing may claim more ground than the
// survey covers, and no value may reach the screen as NaN.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  ringArea, polygonArea, lineLength, surveyFacts, sourceLines,
} from "../docs/js/campus-facts.js";

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs", "data");
const load = (f) => JSON.parse(readFileSync(path.join(DATA, f)));

const campus = load("campus-3d.json");
const lidar = load("campus-lidar.json");
const arcgis = load("campus-arcgis.json");
const colors = load("campus-colors.json");
const facades = load("campus-facades.json");
const landmarks = load("campus-landmarks.json");
const boundary = load("campus-boundary.json");
const markings = load("campus-markings.json");

const FACTS = surveyFacts({
  campus, lidar, arcgis, colors, facades, landmarks, boundary, markings,
});
const by = (key) => FACTS.find((f) => f.key === key);

/* The box the LiDAR actually measured. Nothing derived from inside it may
   describe more ground than it holds. */
const t = lidar.terrain;
const SURVEY_KM2 = (((t.cols - 1) * t.cell) * ((t.rows - 1) * t.cell)) / 1e6;

describe("the geometry helpers", () => {
  test("ringArea is unsigned and scales as the square of the coordinates", () => {
    const unit = [[0, 0], [1, 0], [1, 1], [0, 1]];
    assert.equal(ringArea(unit), 1);
    /* Wound the other way it is the same patch of ground. */
    assert.equal(ringArea([...unit].reverse()), 1);
    /* THE decimetre trap, pinned: ten times the coordinates is a hundred times
       the area, which is why the GIS rings need /100 and not /10. */
    assert.equal(ringArea(unit.map(([x, z]) => [x * 10, z * 10])), 100);
    assert.equal(ringArea([[0, 0], [1, 1]]), 0, "a two-point ring has no area");
    assert.equal(ringArea(null), 0);
  });

  test("polygonArea takes the holes out of the outer ring", () => {
    const outer = [[0, 0], [10, 0], [10, 10], [0, 10]];
    const hole = [[2, 2], [4, 2], [4, 4], [2, 4]];
    assert.equal(polygonArea([outer]), 100);
    assert.equal(polygonArea([outer, hole]), 96);
    /* Holes can never make a polygon negative, however the data is wound. */
    assert.equal(polygonArea([hole, outer]), 0);
    assert.equal(polygonArea([]), 0);
    assert.equal(polygonArea(undefined), 0);
  });

  test("lineLength sums the segments and survives ragged input", () => {
    assert.equal(lineLength([[0, 0], [3, 4]]), 5);
    assert.equal(lineLength([[0, 0], [3, 4], [3, 0]]), 9);
    assert.equal(lineLength([[0, 0]]), 0);
    assert.equal(lineLength(null), 0);
  });
});

describe("every number the loading screen shows is fit to show", () => {
  test("nothing is NaN, undefined, or infinite", () => {
    for (const f of FACTS) {
      assert.ok(f.key, "every fact needs a key to update in place");
      assert.ok(f.label, `${f.key} has no label`);
      if (typeof f.value === "number") {
        assert.ok(Number.isFinite(f.value), `${f.key} is ${f.value}`);
        assert.ok(f.value > 0, `${f.key} is ${f.value} — a zero reads as a fault`);
      } else {
        assert.equal(typeof f.value, "string", `${f.key} is neither number nor string`);
        assert.doesNotMatch(f.value, /NaN|undefined|Infinity/, `${f.key} = "${f.value}"`);
      }
    }
  });

  test("keys are unique, so no fact overwrites another's cell", () => {
    const seen = new Set();
    for (const f of FACTS) {
      assert.ok(!seen.has(f.key), `duplicate fact key ${f.key}`);
      seen.add(f.key);
    }
  });

  test("labels stay short enough that the grid does not reflow", () => {
    for (const f of FACTS) {
      assert.ok(f.label.length <= 22, `"${f.label}" is ${f.label.length} chars`);
    }
  });

  /* The one that would have caught 341 km². The ceiling carries a 1% tolerance
     because one of these facts IS the survey extent, reported to two decimals:
     8.405874 km² shows as 8.41, which a strict <= would call a violation. A
     percent of slack still catches a factor of a hundred. */
  test("no area claims more ground than the survey covers", () => {
    const areas = FACTS.filter((f) => f.unit === "km²");
    assert.ok(areas.length >= 2, "the areas are the headline facts — they must be there");
    for (const f of areas) {
      assert.ok(f.value <= SURVEY_KM2 * 1.01,
        `${f.label} claims ${f.value} km² inside a ${SURVEY_KM2.toFixed(2)} km² survey`);
      assert.ok(f.value >= 0.1, `${f.label} is ${f.value} km² — too small to be real`);
    }
  });

  test("lengths are plausible for a campus, not for a country", () => {
    for (const f of FACTS.filter((x) => x.unit === "km")) {
      assert.ok(f.value < 1000, `${f.label} is ${f.value} km`);
    }
    /* A metre reading taller than the tallest thing on campus means a unit slip
       somewhere upstream. Jacobs Medical Center is the tallest at ~64 m. */
    for (const f of FACTS.filter((x) => x.unit === "m")) {
      assert.ok(f.value < 200, `${f.label} is ${f.value} m`);
    }
  });
});

describe("the counts match the data that ships", () => {
  test("trees, footprints and polygons are counted, not remembered", () => {
    /* These are the three the old hand-written sentence got wrong. */
    assert.equal(by("trees").value, lidar.trees.length);
    assert.equal(by("footprints").value, campus.buildings.length);
    assert.equal(by("ground-polys").value, arcgis.ground.length);
    assert.equal(by("terrain-samples").value, t.cols * t.rows);
    assert.equal(by("measured-heights").value, Object.keys(lidar.heights).length);
    assert.equal(by("boundary-verts").value, boundary.rings[0].length);
  });

  test("the tallest building is the tallest measured building", () => {
    const tallest = Math.max(...Object.values(lidar.heights).filter(Number.isFinite));
    assert.ok(Math.abs(by("tallest").value - tallest) < 0.1,
      `screen says ${by("tallest").value} m, data says ${tallest} m`);
  });

  test("an absent optional file contributes no fact rather than a zero", () => {
    const bare = surveyFacts({ campus, lidar });
    assert.equal(bare.find((f) => f.key === "ground-polys"), undefined);
    assert.equal(bare.find((f) => f.key === "landmarks"), undefined);
    assert.ok(bare.find((f) => f.key === "trees"), "the LiDAR facts must survive alone");
  });

  test("surveyFacts never throws on junk", () => {
    for (const junk of [{}, { campus: null, lidar: null }, { lidar: { terrain: null } },
                        { campus: { paths: [null] }, lidar: { trees: [null, [1]] } }]) {
      assert.doesNotThrow(() => surveyFacts(junk), `threw on ${JSON.stringify(junk)}`);
    }
  });
});

describe("the sources are credited", () => {
  test("every loaded dataset names who measured it", () => {
    const lines = sourceLines({ campus, lidar, arcgis, colors });
    assert.equal(lines.length, 4);
    assert.ok(lines.some((l) => /OpenStreetMap/.test(l)));
    assert.ok(lines.some((l) => /LiDAR/.test(l)));
    assert.ok(lines.some((l) => /NAIP/i.test(l)));
    /* The provenance strings in the data files also name the generator script
       and warn against hand-editing. That is a note to whoever maintains the
       data, and it must not reach the screen. */
    for (const l of lines) {
      assert.doesNotMatch(l, /hand-edit|scripts\//, `"${l}" leaks a maintenance note`);
    }
  });
});
