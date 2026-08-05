/* College affiliation — the layer that exists because this project once guessed.
 *
 * A gauntlet pass read an OSM neighbourhood name as a college affiliation and
 * moved Eighth College's label 1.1 km onto Thurgood Marshall's halls. Sahir, who
 * attends this university, corrected it and supplied the boundary map these
 * polygons come from. These tests exist so that specific mistake cannot come
 * back quietly, and so the difference between a surveyed boundary and a derived
 * one stays visible.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COLLEGES = JSON.parse(readFileSync(path.join(ROOT, "docs/data/campus-colleges.json"), "utf8"));
const CAMPUS = JSON.parse(readFileSync(path.join(ROOT, "docs/data/campus-3d.json"), "utf8"));

const centroid = (ring) => [
  ring.reduce((a, q) => a + q[0], 0) / ring.length,
  ring.reduce((a, q) => a + q[1], 0) / ring.length,
];
const buildingCentroid = (name) => {
  const b = CAMPUS.buildings.find((x) => x.n === name);
  assert.ok(b, `${name} is not in campus-3d.json`);
  return centroid(b.p);
};

describe("college affiliation comes from a source, not a guess", () => {
  test("all eight colleges are present", () => {
    const names = Object.keys(COLLEGES.colleges).sort();
    assert.equal(names.length, 8, `got ${names.length}: ${names.join(", ")}`);
    for (const n of ["Revelle College", "John Muir College", "Thurgood Marshall College",
      "Earl Warren College", "Eleanor Roosevelt College", "Sixth College",
      "Seventh College", "Eighth College"]) {
      assert.ok(COLLEGES.colleges[n], `${n} missing`);
    }
  });

  test("seven boundaries are surveyed OSM polygons; only Eighth is derived", () => {
    const derived = Object.entries(COLLEGES.colleges).filter(([, c]) => c.kind === "derived");
    assert.equal(derived.length, 1, `expected exactly one derived boundary, got ${derived.map(([n]) => n).join(", ")}`);
    assert.equal(derived[0][0], "Eighth College");
    /* Eighth has no OSM polygon at all — that absence is the whole reason the
       original error was possible, so it is asserted rather than assumed. */
    assert.match(COLLEGES.colleges["Eighth College"].source, /Sahir/);
    for (const [n, c] of Object.entries(COLLEGES.colleges)) {
      if (n === "Eighth College") continue;
      assert.match(c.source, /^OSM way\/\d+$/, `${n} should cite an OSM way, got "${c.source}"`);
    }
  });
});

describe("the affiliations Sahir stated, pinned", () => {
  const EIGHTH = ["Sankofa", "Pulse", "Podemos", "Azad", "Survivance"];
  const MARSHALL = ["Alianza", "Umoja", "Coalition", "Malk Hall"];

  for (const n of EIGHTH) {
    test(`${n} is Eighth College`, () => {
      assert.equal(COLLEGES.affiliation[n], "Eighth College");
    });
  }
  for (const n of MARSHALL) {
    test(`${n} is Thurgood Marshall, not Eighth`, () => {
      assert.equal(COLLEGES.affiliation[n], "Thurgood Marshall College");
    });
  }
  test("Mosaic is Sixth College", () => {
    assert.equal(COLLEGES.affiliation.Mosaic, "Sixth College");
  });

  test("REGRESSION: the Eighth anchor sits on Eighth's buildings, far from Marshall's", () => {
    const a = COLLEGES.anchors["Eighth College"];
    assert.ok(a, "Eighth College anchor missing");
    const dist = (n) => { const [x, z] = buildingCentroid(n); return Math.hypot(x - a.x, z - a.z); };
    for (const n of EIGHTH) assert.ok(dist(n) < 250, `${n} is ${dist(n).toFixed(0)} m from the Eighth anchor`);
    for (const n of MARSHALL) assert.ok(dist(n) > 800, `${n} is Marshall's but only ${dist(n).toFixed(0)} m from the Eighth anchor`);
  });
});

describe("the layer stays honest about what it does not know", () => {
  test("no building is claimed by two colleges", () => {
    /* Affiliation is a map, so duplication would show as a building whose
       centroid falls inside more than one ring — worth checking, because
       overlapping OSM neighbourhoods would silently pick whichever came first. */
    const pointInRing = ([px, pz], ring) => {
      let inside = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, zi] = ring[i], [xj, zj] = ring[j];
        if ((zi > pz) !== (zj > pz) && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) inside = !inside;
      }
      return inside;
    };
    const overlaps = [];
    for (const b of CAMPUS.buildings) {
      if (!b.n) continue;
      const c = centroid(b.p);
      const hits = Object.entries(COLLEGES.colleges).filter(([, col]) => pointInRing(c, col.ring)).map(([n]) => n);
      if (hits.length > 1) overlaps.push(`${b.n}: ${hits.join(" + ")}`);
    }
    assert.equal(overlaps.length, 0, `buildings in overlapping colleges:\n  ${overlaps.slice(0, 8).join("\n  ")}`);
  });

  test("most of campus has no college, and that is recorded rather than filled", () => {
    /* The medical centre, Scripps and the research campus belong to no college.
       If this number ever collapses toward zero, something started guessing
       again. */
    const named = CAMPUS.buildings.filter((b) => b.n).length;
    const affiliated = Object.keys(COLLEGES.affiliation).length;
    assert.ok(affiliated > 100, `only ${affiliated} buildings affiliated — the layer looks broken`);
    assert.ok(affiliated < named * 0.75,
      `${affiliated}/${named} buildings affiliated — too many, something is guessing`);
  });
});
