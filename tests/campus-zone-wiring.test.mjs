// The zone actually hangs off its layer.
//
// Every athletics builder was unit-tested and every unit test passed while
// Muir Field's overlays were parented to the scene instead of the zone
// group: they drew, so screenshots looked right, but the dev panel's
// `athletics` toggle did not control them. The gap was that no test ran the
// BUILDERS the way boot() runs them.
//
// So this test does what campus-walk.js does — call each builder with a stub
// scene, collect what it hands back the way boot() collects it, and insist
// the zone ends up holding every builder's geometry.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { THREE } from "../docs/js/campus-world.js";
import { createAthletics } from "../docs/js/campus-athletics.js";
import { createRecreation } from "../docs/js/campus-recreation.js";
import { createMuirField } from "../docs/js/campus-muir-field.js";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const load = (f) => JSON.parse(readFileSync(join(ROOT, "docs/data", f), "utf8"));
const campus = load("campus-3d.json");
const arcgis = load("campus-arcgis.json");
const markings = load("campus-markings.json");
const heightAt = () => 20;

/** Exactly the shape-tolerant unwrap boot() uses. */
const unwrap = (made) => made?.group ?? (made?.isObject3D ? made : null);

const buildZone = () => {
  const scene = new THREE.Group(); // stands in for the scene
  const zone = new THREE.Group();
  const built = [
    ["athletics", createAthletics(scene, { campus, heightAt, massInfo: new Map() })],
    ["recreation", createRecreation(scene, { campus, arcgis, markings, heightAt })],
    ["muir-field", createMuirField(scene, { markings, heightAt })],
  ];
  for (const [, made] of built) {
    const obj = unwrap(made);
    if (obj) zone.add(obj);
  }
  return { zone, built };
};

test("every athletics builder hands back something the zone can hold", () => {
  const { built } = buildZone();
  for (const [name, made] of built) {
    assert.ok(unwrap(made), `${name} returned nothing the zone could adopt`);
  }
});

test("the athletics layer holds every builder's geometry", () => {
  const { zone } = buildZone();
  let meshes = 0;
  zone.traverse((o) => { if (o.isMesh) meshes++; });
  assert.ok(meshes > 20, `only ${meshes} meshes under the zone`);
  assert.equal(zone.children.length, 3, "one group per builder");
});

test("nothing the builders make is left parented outside the zone", () => {
  /* The real failure: a builder adds itself to the scene AND hands back its
     group; boot() reparents it, so the scene must end up empty of leftovers.
     Anything still under the stub scene never reaches the layer toggle. */
  const scene = new THREE.Group();
  const zone = new THREE.Group();
  for (const made of [
    createAthletics(scene, { campus, heightAt, massInfo: new Map() }),
    createRecreation(scene, { campus, arcgis, markings, heightAt }),
    createMuirField(scene, { markings, heightAt }),
  ]) {
    const obj = made?.group ?? (made?.isObject3D ? made : null);
    if (obj) zone.add(obj);
  }
  let orphans = 0;
  scene.traverse((o) => { if (o.isMesh) orphans++; });
  assert.equal(orphans, 0, `${orphans} meshes stayed under the scene, outside the layer`);
});

test("switching the layer off hides the whole zone, Muir Field included", () => {
  const { zone } = buildZone();
  const FIELD = { x: [-181, -120], z: [64, 170] };
  let overField = 0;
  zone.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    o.geometry.computeBoundingBox();
    const b = o.geometry.boundingBox;
    if (b.max.x > FIELD.x[0] && b.min.x < FIELD.x[1] &&
        b.max.z > FIELD.z[0] && b.min.z < FIELD.z[1]) overField++;
  });
  assert.ok(overField > 0, "no zone geometry over Muir Field — the overlays are missing again");
  zone.visible = false;
  assert.equal(zone.visible, false);
});
