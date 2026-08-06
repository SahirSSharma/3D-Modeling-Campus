// The tree invariants: 2014's laser, disciplined by 2026's campus.
//
// Every shipped tree must stand clear of today's buildings, sports pads and
// fountains, at a believable size. These import the same rules the build and
// prune scripts use, so a regression in either shows up here, not on the site.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  treeExclusionZones, treeViolation, TREE_MAX_HEIGHT, TREE_MAX_CROWN_R,
} from "../scripts/lib/tree-rules.mjs";

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs", "data");
const load = (f) => JSON.parse(readFileSync(path.join(DATA, f)));

const lidar = load("campus-lidar.json");
const campus3d = load("campus-3d.json");
const markings = load("campus-markings.json");
const zones = treeExclusionZones({ campus3d, arcgis: load("campus-arcgis.json"), markings });

test("no shipped tree stands in a building, on a sports pad, or in water", () => {
  const violators = [];
  for (const [x, z] of lidar.trees) {
    const zn = treeViolation(x, z, zones);
    if (zn) violators.push(`(${x}, ${z}) in ${zn.kind} ${zn.name}`);
  }
  assert.deepEqual(violators.slice(0, 8), [], `${violators.length} trees violate zones`);
});

test("every shipped tree is a believable size", () => {
  for (const [x, z, h, r] of lidar.trees) {
    assert.ok(h <= TREE_MAX_HEIGHT, `tree at (${x}, ${z}) is ${h} m tall (cap ${TREE_MAX_HEIGHT})`);
    assert.ok(h >= 3, `tree at (${x}, ${z}) is only ${h} m`);
    assert.ok(r <= TREE_MAX_CROWN_R, `tree at (${x}, ${z}) has crown ${r} m (cap ${TREE_MAX_CROWN_R})`);
  }
});

test("the survey's own courts exclude trunks, not just the ones the imagery fit found", () => {
  /* THE BUG THIS PINS. treeExclusionZones used to learn sports pads ONLY from
     campus-markings.json, which is fitted to the satellite chunks and names 11
     facilities. The university's ArcGIS survey carries 143 court rings, and
     none of them reached the function — so two 2014 canopies stood on the
     Eighth College court, one 3.5 m from the centre trident, invisible while
     the court was still a tan rectangle and unmissable once it was painted.
     Asserting the zones EXIST as well as that no tree violates them: a
     regression that drops the arcgis branch would otherwise pass vacuously. */
  const arcgis = load("campus-arcgis.json");
  const courtRings = arcgis.ground.filter((s) => s.k === "court");
  assert.ok(courtRings.length > 100, `only ${courtRings.length} surveyed court rings`);
  const surveyed = courtRings.map((s) => ({
    ring: s.r[0].map(([x, z]) => [x / 10, z / 10]), // the survey stores decimetres
    kind: "sports", margin: 0, name: "surveyed court",
    bbox: { x0: -Infinity, z0: -Infinity, x1: Infinity, z1: Infinity },
  })).filter((z) => z.ring.length >= 3);
  const on = lidar.trees.filter(([x, z]) => treeViolation(x, z, surveyed));
  assert.deepEqual(on.map(([x, z]) => [x, z]), [], `${on.length} trunks stand on a surveyed court`);
  /* And the Eighth court specifically — the frame this was found in. */
  const eighth = lidar.trees.filter(([x, z]) =>
    x > -186 && x < -163 && z > 517 && z < 533);
  assert.deepEqual(eighth, [], "a trunk is back on the Eighth College court");
});

test("the known 2014 ghosts stay gone: Coalition footprint and Muir Field pad", () => {
  const coalition = campus3d.buildings.find((b) => b.n === "Coalition");
  assert.ok(coalition, "Coalition footprint exists");
  const muir = markings.facilities.find((f) => f.name === "Muir Field");
  assert.ok(muir, "Muir Field facility exists");
  const inRing = (ring) =>
    lidar.trees.filter(([x, z]) => treeViolation(x, z, [{
      ring, kind: "spot", margin: 0,
      bbox: { x0: -Infinity, z0: -Infinity, x1: Infinity, z1: Infinity },
    }]));
  assert.equal(inRing(coalition.p).length, 0, "trees inside Coalition");
  assert.equal(inRing(muir.bounds).length, 0, "trees on Muir Field");
});

test("the prune did not clear-cut the campus", () => {
  /* 12,659 raw 2014 canopies -> 7,331 after pruning against today's campus
     (verified visually 2026-08-03: the Ridge Walk rows, Revelle Plaza shade
     and the eucalyptus grove all survive; the drops were rooftop returns and
     felled groves under post-2014 construction). A result far below that
     means a rule went feral, not that the campus changed. */
  assert.ok(lidar.trees.length > 6500, `only ${lidar.trees.length} trees left`);
});
