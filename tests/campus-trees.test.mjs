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
