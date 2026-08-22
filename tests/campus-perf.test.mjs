// campus-perf.js rewrites every static material and matrix in the scene, so
// its three passes get pinned here: dedupe must merge only true duplicates,
// the shadow filter must judge world size, and the freeze must bake matrices.
import { test } from "node:test";
import assert from "node:assert";
import * as THREE from "../docs/vendor/three/three.module.min.js";
import { dedupeMaterials, filterShadowCasters, freezeStatic, disposeDeep, mergeInstancedMeshes } from "../docs/js/campus-perf.js";

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

test("dedupe can keep a canon across calls so a late mesh folds into an earlier one", () => {
  const canon = new Map();
  const a = new THREE.Mesh(box(), new THREE.MeshStandardMaterial({ color: 0x804020, roughness: 0.7 }));
  const b = new THREE.Mesh(box(), new THREE.MeshStandardMaterial({ color: 0x804020, roughness: 0.7 }));
  const g1 = new THREE.Group(); g1.add(a);
  const g2 = new THREE.Group(); g2.add(b);
  dedupeMaterials([g1], { canon });
  dedupeMaterials([g2], { canon });
  assert.equal(b.material, a.material, "the second pass reused the first pass's material");
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

test("the shadow filter drops glass, overlay decals, tiny instanced units and slivers", () => {
  const g = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.BoxGeometry(8, 6, 0.1), new THREE.MeshStandardMaterial({
    color: 0x88aacc, transparent: true, opacity: 0.35, depthWrite: false,
  }));
  const decal = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({
    color: 0x445544, polygonOffset: true, depthWrite: false,
  }));
  decal.renderOrder = 2;
  const bolts = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial(), 4);
  const frames = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial(), 2);
  const fins = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial(), 8);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  for (let i = 0; i < 4; i++) {
    m.compose(p.set(i, 0, 0), q, s.set(0.1, 0.1, 0.1));
    bolts.setMatrixAt(i, m);
  }
  for (let i = 0; i < 2; i++) {
    m.compose(p.set(i * 3, 0, 0), q, s.set(2, 1.5, 0.12));
    frames.setMatrixAt(i, m);
  }
  for (let i = 0; i < 8; i++) {
    m.compose(p.set(i, 0, 0), q, s.set(0.005, 0.05, 4));
    fins.setMatrixAt(i, m);
  }
  glass.castShadow = decal.castShadow = bolts.castShadow = frames.castShadow = fins.castShadow = true;
  glass.receiveShadow = decal.receiveShadow = true;
  g.add(glass, decal, bolts, frames, fins);
  g.updateMatrixWorld(true);
  const off = filterShadowCasters([g], { minRadius: 0.3 });
  assert.equal(glass.castShadow, false, "transparent glass does not cast a solid slab");
  assert.equal(decal.castShadow, false, "an overlay decal does not cast a floating stripe");
  assert.equal(bolts.castShadow, false, "instanced units are judged by instance scale, not the 1 m template");
  assert.equal(fins.castShadow, false, "a 4 m × 5 cm sliver is a flicker, not a shadow");
  assert.equal(frames.castShadow, true, "a metre-scale window frame still casts");
  assert.equal(glass.receiveShadow, true, "receiving is untouched");
  assert.ok(off >= 4);
});

test("mergeInstancedMeshes folds matching instance sets and leaves the rest alone", () => {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xcfc5b3 });
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const a = new THREE.InstancedMesh(geo, mat, 2);
  const b = new THREE.InstancedMesh(geo, mat, 3);
  const other = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0x112233 }), 2);
  const m = new THREE.Matrix4();
  for (let i = 0; i < 2; i++) { m.makeTranslation(i, 0, 0); a.setMatrixAt(i, m); }
  for (let i = 0; i < 3; i++) { m.makeTranslation(i, 1, 0); b.setMatrixAt(i, m); }
  for (let i = 0; i < 2; i++) { m.makeTranslation(i, 2, 0); other.setMatrixAt(i, m); }
  g.add(a, b, other);
  const r = mergeInstancedMeshes([g]);
  assert.equal(r.folded, 2);
  assert.equal(r.merged, 1);
  assert.equal(a.visible, false);
  assert.equal(b.visible, false);
  assert.equal(a.userData.perfMerged, true);
  assert.equal(other.visible, true, "a different material does not join");
  const made = g.children.find((c) => c.name.startsWith("perf-merged:"));
  assert.ok(made?.isInstancedMesh);
  assert.equal(made.count, 5);
  assert.equal(made.material, mat);
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
