// The species rules: every LiDAR canopy gets a name, deterministically.
//
// The renderer builds its instanced forests from exactly these rules, so a
// change that stops assigning eucalyptus to the groves — or starts repainting
// the campus on every visit — fails here, not on the site.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { SPECIES, treeSpecies, treeTint } from "../docs/js/campus-species.js";

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs", "data");
const lidar = JSON.parse(readFileSync(path.join(DATA, "campus-lidar.json")));

test("every species carries footage-measured colours and a known form", () => {
  for (const [name, s] of Object.entries(SPECIES)) {
    assert.match(s.leaf, /^#[0-9a-f]{6}$/, `${name} leaf`);
    assert.match(s.trunk, /^#[0-9a-f]{6}$/, `${name} trunk`);
    assert.ok(["tall", "umbrella", "round"].includes(s.form), `${name} form`);
  }
});

test("every shipped tree resolves to a species, the same one every time", () => {
  for (const [x, z, h, r] of lidar.trees) {
    const a = treeSpecies(x, z, h, r);
    assert.ok(SPECIES[a], `unknown species ${a} at (${x}, ${z})`);
    assert.equal(a, treeSpecies(x, z, h, r), "assignment must be deterministic");
  }
});

test("the campus reads as what it is: a eucalyptus campus with dark pines", () => {
  /* The footage shows eucalyptus dominating the groves and rows, pines as a
     strong minority, lawn species filling in. Wildly different shares mean a
     rule went feral. */
  const count = {};
  for (const [x, z, h, r] of lidar.trees) {
    const s = treeSpecies(x, z, h, r);
    count[s] = (count[s] || 0) + 1;
  }
  const n = lidar.trees.length;
  for (const name of Object.keys(SPECIES)) {
    assert.ok(count[name] > 0, `no ${name} anywhere on campus`);
  }
  assert.ok(count.eucalyptus / n > 0.25, `eucalyptus only ${count.eucalyptus}/${n}`);
  assert.ok(count.eucalyptus / n < 0.85, "eucalyptus monoculture");
  assert.ok(count.pine / n > 0.05, `pines only ${count.pine}/${n}`);
});

test("tints stay plausible colours and never repaint between visits", () => {
  const probe = lidar.trees.slice(0, 200);
  for (const [x, z, h, r] of probe) {
    const s = treeSpecies(x, z, h, r);
    const t1 = treeTint(s, x, z);
    const t2 = treeTint(s, x, z);
    assert.deepEqual(t1, t2, "tint must be deterministic");
    for (const c of [...t1.leaf, ...t1.trunk]) {
      assert.ok(c >= 0 && c <= 1, `channel ${c} out of range`);
    }
  }
});
