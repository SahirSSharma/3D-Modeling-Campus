// campus-perf.js rewrites every static material and matrix in the scene, so
// its three passes get pinned here: dedupe must merge only true duplicates,
// the shadow filter must judge world size, and the freeze must bake matrices.
import { test } from "node:test";
import assert from "node:assert";
import * as THREE from "../docs/vendor/three/three.module.min.js";
import { dedupeMaterials, filterShadowCasters, freezeStatic, disposeDeep } from "../docs/js/campus-perf.js";

const box = () => new THREE.BoxGeometry(1, 1, 1);

test("dedupe folds byte-identical materials and leaves the rest alone", () => {
  const g = new THREE.Group();
  const a = new THREE.Mesh(box(), new THREE.MeshStandardMaterial({ color: 0x804020, roughness: 0.7 }));
  const b = new THREE.Mesh(box(), new THREE.MeshStandardMaterial({ color: 0x804020, roughness: 0.7 }));
  const c = new THREE.Mesh(box(), new THREE.MeshStandardMaterial({ color: 0x804021, roughness: 0.7 }));
  g.add(a, b, c);
  const r = dedupeMaterials([g]);
  assert.equal(b.material, a.material, "identical materials become one");
  assert.notEqual(c.material, a.material, "a one-bit colour difference survives");
  assert.equal(r.replaced, 1);
});

test("dedupe respects render state the eye cannot see in the params list", () => {
  // The bug class from review: a key that omits a render-relevant field
  // silently merges materials that MUST differ. Pin the once-omitted ones.
  const g = new THREE.Group();
  const base = () => new THREE.MeshStandardMaterial({ color: 0xffffff });
  const normal = new THREE.Mesh(box(), base());
  const additive = new THREE.Mesh(box(), Object.assign(base(), { blending: THREE.AdditiveBlending }));
  const noWrite = new THREE.Mesh(box(), Object.assign(base(), { colorWrite: false }));
  const always = new THREE.Mesh(box(), Object.assign(base(), { depthFunc: THREE.AlwaysDepth }));
  g.add(normal, additive, noWrite, always);
  dedupeMaterials([g]);
  const mats = new Set([normal.material, additive.material, noWrite.material, always.material]);
  assert.equal(mats.size, 4, "blending / colorWrite / depthFunc keep materials distinct");
});

test("dedupe never touches non-mesh materials or custom shaders", () => {
  const g = new THREE.Group();
  const shader = new THREE.Mesh(box(), new THREE.ShaderMaterial());
  const hooked = new THREE.Mesh(box(), new THREE.MeshStandardMaterial());
  hooked.material.onBeforeCompile = () => {};
  const twin = new THREE.Mesh(box(), new THREE.MeshStandardMaterial());
  g.add(shader, hooked, twin);
  const before = [shader.material, hooked.material, twin.material];
  dedupeMaterials([g]);
  assert.deepEqual([shader.material, hooked.material, twin.material], before);
});

test("the shadow filter drops sub-texel casters and only casters", () => {
  const g = new THREE.Group();
  const bolt = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), new THREE.MeshStandardMaterial());
  const wall = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 0.3), new THREE.MeshStandardMaterial());
  bolt.castShadow = wall.castShadow = true;
  bolt.receiveShadow = wall.receiveShadow = true;
  g.add(bolt, wall);
  g.updateMatrixWorld(true);
  const off = filterShadowCasters([g], { minRadius: 0.3 });
  assert.equal(off, 1);
  assert.equal(bolt.castShadow, false);
  assert.equal(bolt.receiveShadow, true, "receiving is untouched");
  assert.equal(wall.castShadow, true);
});

test("freeze bakes the current transform and stops auto-updates", () => {
  const g = new THREE.Group();
  const m = new THREE.Mesh(box(), new THREE.MeshStandardMaterial());
  m.position.set(5, 0, 0);
  g.add(m);
  freezeStatic([g]);
  assert.equal(m.matrixAutoUpdate, false);
  assert.equal(m.matrixWorld.elements[12], 5, "the transform was baked before freezing");
});

test("disposeDeep detaches and frees geometry, and only geometry", () => {
  const g = new THREE.Group();
  const parent = new THREE.Group();
  const m = new THREE.Mesh(box(), new THREE.MeshStandardMaterial());
  g.add(m);
  parent.add(g);
  let disposed = 0;
  m.geometry.addEventListener("dispose", () => disposed++);
  const freed = disposeDeep(g);
  assert.equal(freed, 1);
  assert.equal(disposed, 1);
  assert.equal(g.parent, null, "the subtree left the graph");
});
