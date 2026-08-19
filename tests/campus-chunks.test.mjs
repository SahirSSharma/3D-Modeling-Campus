// The chunked-world layer (campus-chunks.js): distance tiers and draw batching.
//
// This module is declared render direction, not a source — a tier only decides
// WHETHER something already measured is drawn this frame, and a batch only
// changes how many GL calls carry it. So the claims worth pinning are the ones
// that would let it quietly become something else: a threshold that strobes
// (the hysteresis), a category that retires the world's silhouette instead of
// its trim, a fold that draws an object twice, a crop that loses a material
// group, and the audit's escape hatch back to the builders' scene.
//
// Everything here runs against the real vendored THREE with real geometry and a
// real PerspectiveCamera, because that is the only code path the browser has.
// Nothing is mocked.
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../docs/vendor/three/three.module.min.js";
import { createChunkWorld, CHUNK_CONFIG } from "../docs/js/campus-chunks.js";

/* A fresh config per world. CHUNK_CONFIG is the shipped, runtime-mutable
   singleton — a test that tuned it in place would tune it for every later
   test in this file too. `stride: 1` because update() only sweeps tiers every
   config.stride frames; the stride itself gets its own test below. */
const cfg = (over = {}) => ({ ...CHUNK_CONFIG, stride: 1, ...over });

const standard = () => new THREE.MeshStandardMaterial({ color: 0x8a8378 });

/* A box's bounding-sphere radius is size * sqrt(3)/2, so `size` alone decides
   which side of config.smallUnit (0.8 m) the entry falls on: 0.5 m -> 0.43 m
   radius is a bolt, 4 m -> 3.46 m is a building part. */
function boxMesh(material, { size = 1, at = [0, 0, 0] } = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), material);
  m.position.set(...at);
  return m;
}

/* The massing shape: BufferGeometry, NO index, two material groups whose
   start/count are VERTEX counts (campus-massing runs toNonIndexed), and a
   material array of two. Four triangles, two per group. */
function twoGroupMesh(matA, matB, at = [0, 0, 0]) {
  const pos = new Float32Array(4 * 3 * 3);
  for (let t = 0; t < 4; t++) {
    const x = t * 2;
    pos.set([x, 0, 0, x + 1, 0, 0, x, 2, 0], t * 9);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.addGroup(0, 6, 0);
  g.addGroup(6, 6, 1);
  const m = new THREE.Mesh(g, [matA, matB]);
  m.position.set(...at);
  return m;
}

/* A real camera, matrices resolved — update() reads it through
   getWorldPosition, which is matrixWorld, not .position. */
function cameraAt(x, y = 0, z = 0) {
  const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 40000);
  cam.position.set(x, y, z);
  cam.updateMatrixWorld(true);
  return cam;
}

function moveTo(cam, x, y = 0, z = 0) {
  cam.position.set(x, y, z);
  cam.updateMatrixWorld(true);
  return cam;
}

const shownOf = (world) => world.entries.map((e) => e.shown);

/* ------------------------------------------------------------- registration */

test("addStatic takes charge of every mesh under a root and returns the count", () => {
  const world = createChunkWorld({ config: cfg() });
  const root = new THREE.Group();
  const nested = new THREE.Group();
  nested.add(boxMesh(standard()), boxMesh(standard()));
  root.add(boxMesh(standard()), nested, new THREE.Object3D()); // the Object3D is not drawable
  assert.equal(world.addStatic(root), 3, "a nested mesh is still a mesh");
  assert.equal(world.entries.length, 3);
  assert.equal(world.stats().entries, 3);

  /* Zone builders in this codebase return `{ group }`, not the group. Both
     forms have to work or half the campus never registers. */
  const zone = { group: new THREE.Group() };
  zone.group.add(boxMesh(standard()));
  assert.equal(world.addStatic(zone, { category: "photo" }), 1);
  assert.equal(world.entries.length, 4);
  assert.equal(world.entries[3].category, "photo");
  assert.equal(world.entries[0].category, "base", "base is the default tier class");

  /* Nothing registrable is a quiet zero, not a throw — a zone that failed to
     build must not take the frame loop down with it. */
  assert.equal(world.addStatic(null), 0);
  assert.equal(world.addStatic({}), 0);
  assert.equal(world.entries.length, 4);
});

test("the registered AABB and unit size are world-space, not local", () => {
  const world = createChunkWorld({ config: cfg() });
  const root = new THREE.Group();
  root.position.set(100, 0, 0);
  const m = boxMesh(standard(), { size: 2, at: [10, 0, 0] });
  m.scale.set(3, 3, 3);
  root.add(m);
  world.addStatic(root);
  const e = world.entries[0];
  /* A 2 m box scaled 3x is 6 m across, at local x=10 under a root at x=100:
     107 .. 113. Registered from matrixWorld, so both the parent's transform
     and the mesh's own scale are already in it. */
  assert.ok(Math.abs(e.aabb.x0 - 107) < 1e-6, `x0 ${e.aabb.x0}`);
  assert.ok(Math.abs(e.aabb.x1 - 113) < 1e-6, `x1 ${e.aabb.x1}`);
  /* The unit radius must carry the scale too, or a scaled-up prop gets
     retired as if it were the size it was authored at. */
  assert.ok(Math.abs(e.unit - 3 * Math.sqrt(3)) < 1e-6, `unit ${e.unit}`);
});

/* -------------------------------------------------------------------- tiers */

test("CHUNK_CONFIG's radii are ordered, and the tiers ship on", () => {
  assert.ok(CHUNK_CONFIG.props < CHUNK_CONFIG.photo, "small props must retire before whole photo modules do");
  assert.ok(CHUNK_CONFIG.hysteresis > 0, "a zero hysteresis is a strobing world");
  assert.equal(CHUNK_CONFIG.lodEnabled, true);
  assert.equal(CHUNK_CONFIG.lodScale, 1, "the adaptive dial must ship at its neutral value");
});

test("a small unit retires past the props radius and comes back inside it", () => {
  const config = cfg();
  const world = createChunkWorld({ config });
  const root = new THREE.Group();
  const bolt = boxMesh(standard(), { size: 0.5 });   // 0.43 m radius — under smallUnit
  const wall = boxMesh(standard(), { size: 4 });     // 3.46 m — not a small unit
  root.add(bolt, wall);
  world.addStatic(root);

  const cam = cameraAt(config.props + config.hysteresis + 100);
  world.update(cam);
  assert.equal(bolt.visible, false, "a sub-pixel unit is still drawing at 960 m");
  assert.equal(wall.visible, true, "the props radius must not retire anything but small units");
  assert.equal(world.stats().hidden, 1);

  /* Back inside the radius, far enough in to clear the hysteresis band. */
  world.update(moveTo(cam, config.props - config.hysteresis - 100));
  assert.equal(bolt.visible, true, "the bolt never came back");
  assert.equal(world.stats().hidden, 0);
});

test("altitude retires detail exactly like horizontal distance does", () => {
  /* The distance is 3D camera-to-AABB by design: an overview shot from 900 m
     up is 900 m away from the bolt, and looking straight down at a field of
     them is the single most expensive thing this camera can do. */
  const config = cfg();
  const world = createChunkWorld({ config });
  const root = new THREE.Group();
  const bolt = boxMesh(standard(), { size: 0.5 });
  root.add(bolt);
  world.addStatic(root);
  world.update(cameraAt(0, config.props + config.hysteresis + 100, 0));
  assert.equal(bolt.visible, false, "distance is being measured on the ground plane only");
});

test("photo detail retires at the photo radius; the measured silhouette under it does not", () => {
  const config = cfg();
  const world = createChunkWorld({ config });
  /* Both entries are the same size and in the same place, so the ONLY thing
     that can separate them is the category. */
  const photoRoot = new THREE.Group();
  const facade = boxMesh(standard(), { size: 4 });
  photoRoot.add(facade);
  const baseRoot = new THREE.Group();
  const massing = boxMesh(standard(), { size: 4 });
  baseRoot.add(massing);
  world.addStatic(photoRoot, { category: "photo" });
  world.addStatic(baseRoot);

  world.update(cameraAt(config.photo + config.hysteresis + 100));
  assert.equal(facade.visible, false, "photo-sourced detail is still drawing at 1.6 km");
  assert.equal(massing.visible, true,
    "the measured massing carries the building's silhouette at every distance — it may never retire wholesale");
});

test("hysteresis: a camera dithering on a boundary cannot strobe the world", () => {
  const config = cfg();
  const world = createChunkWorld({ config });
  const root = new THREE.Group();
  const bolt = boxMesh(standard(), { size: 0.5 });
  root.add(bolt);
  world.addStatic(root);

  /* Sitting exactly on the radius, shown: the radius that must be crossed to
     HIDE has moved out to props + hysteresis. */
  const cam = cameraAt(config.props);
  world.update(cam);
  assert.equal(bolt.visible, true);
  for (const d of [config.props + 30, config.props - 40, config.props + 55, config.props - 10]) {
    world.update(moveTo(cam, d));
    assert.equal(bolt.visible, true, `dithering to ${d} m flipped an entry inside the hysteresis band`);
  }

  /* Cross it properly and it hides — and now the band works the other way:
     coming back to just inside the raw radius must NOT show it again. */
  world.update(moveTo(cam, config.props + config.hysteresis + 10));
  assert.equal(bolt.visible, false);
  for (const d of [config.props + 10, config.props - 30, config.props - config.hysteresis + 10]) {
    world.update(moveTo(cam, d));
    assert.equal(bolt.visible, false, `dithering to ${d} m flipped a hidden entry back inside the band`);
  }
  world.update(moveTo(cam, config.props - config.hysteresis - 10));
  assert.equal(bolt.visible, true, "past the inner edge of the band it has to come back");
});

test("the fog cull retires even base entries wholly beyond it, and nothing that straddles it", () => {
  const config = cfg();
  const world = createChunkWorld({ config });
  const root = new THREE.Group();
  /* Big, base-category, well inside every tier radius: the fog distance is
     the only thing that can retire either of these. */
  const far = boxMesh(standard(), { size: 4, at: [600, 0, 0] });
  /* 600 m wide, centred at 400: it spans 100 m .. 700 m from the camera, so
     its NEAR face is inside the fog and it must keep drawing. */
  const straddling = new THREE.Mesh(new THREE.BoxGeometry(600, 10, 10), standard());
  straddling.position.set(400, 0, 0);
  root.add(far, straddling);
  world.addStatic(root);

  /* The fog cull runs on VIEW depth (three's fog does), so the camera must
     actually face the objects — a radial-distance cull would pass this test
     with the camera pointing anywhere. */
  const cam = cameraAt(0);
  cam.lookAt(600, 0, 0);
  cam.updateMatrixWorld(true);
  world.update(cam, 200);
  assert.equal(far.visible, false, "an object wholly behind opaque fog is pure cost");
  assert.equal(straddling.visible, true, "an object reaching into the fog is still half in view");

  /* Overview shots scale the fog out to tens of km — everything comes back. */
  world.update(cam, Infinity);
  assert.equal(far.visible, true, "an unbounded fog distance must retire nothing");
  assert.equal(world.stats().hidden, 0);
});

test("update sweeps tiers only every config.stride frames", () => {
  const config = cfg({ stride: 6 });
  const world = createChunkWorld({ config });
  const root = new THREE.Group();
  const bolt = boxMesh(standard(), { size: 0.5 });
  root.add(bolt);
  world.addStatic(root);
  const cam = cameraAt(config.props + config.hysteresis + 100);
  for (let i = 0; i < 5; i++) world.update(cam);
  assert.equal(bolt.visible, true, "the sweep ran before its stride was up");
  world.update(cam);
  assert.equal(bolt.visible, false, "the sweep never ran on the stride frame");
});

test("lodEnabled = false is the builders' scene, verbatim", () => {
  const config = cfg({ lodEnabled: false });
  const world = createChunkWorld({ config });
  const root = new THREE.Group();
  const bolt = boxMesh(standard(), { size: 0.5 });
  const facade = boxMesh(standard(), { size: 0.5 });
  root.add(bolt);
  const photoRoot = new THREE.Group();
  photoRoot.add(facade);
  world.addStatic(root);
  world.addStatic(photoRoot, { category: "photo" });

  /* Far enough out that every tier and the fog cull would fire. */
  const cam = cameraAt(100000);
  for (let i = 0; i < 12; i++) world.update(cam, 500);
  assert.deepEqual(shownOf(world), [true, true], "a tier fired with the LOD system switched off");
  assert.equal(bolt.visible, true);
  assert.equal(facade.visible, true);
  assert.equal(world.stats().hidden, 0);
});

test("lodScale moves every radius together — it is the adaptive controller's only dial", () => {
  const config = cfg({ lodScale: 0.5 });
  const world = createChunkWorld({ config });
  const root = new THREE.Group();
  const bolt = boxMesh(standard(), { size: 0.5 });
  root.add(bolt);
  world.addStatic(root);
  /* Comfortably inside props (800 m) but outside half of it. */
  world.update(cameraAt(600));
  assert.equal(bolt.visible, false, "lodScale did not pull the props radius in");
});

/* ------------------------------------------------------------------ batches */

test("buildBatches folds meshes sharing one material into a BatchedMesh and hides the originals", () => {
  const world = createChunkWorld({ config: cfg() });
  const shared = standard();
  const root = new THREE.Group();
  const meshes = [
    boxMesh(shared, { size: 4, at: [0, 0, 0] }),
    boxMesh(shared, { size: 4, at: [20, 0, 0] }),
    boxMesh(shared, { size: 4, at: [40, 0, 0] }),
  ];
  const lonely = boxMesh(standard(), { size: 4, at: [60, 0, 0] }); // its own material
  root.add(...meshes, lonely);
  world.addStatic(root);

  const made = world.buildBatches();
  assert.equal(made.length, 1, "three meshes on one material should be one batch");
  assert.ok(made[0].isBatchedMesh, "the fold produced something that is not a BatchedMesh");
  assert.equal(made[0].material, shared, "the batch must carry the originals' own material");
  assert.equal(world.batches.length, 1);
  assert.equal(world.batches[0].count, 3);
  assert.equal(world.batches[0].zone, root, "a batch belongs to its zone so layer toggles keep working");
  assert.equal(world.stats().batchedDraws, 3);

  for (const m of meshes) {
    assert.equal(m.visible, false, "an original still draws alongside its batch — that is a double draw");
    assert.equal(m.parent, root, "the original must stay in the graph for probes and the audit");
    assert.equal(world.entries.find((e) => e.object === m).parts.length, 1);
  }
  /* A batch of one is just overhead: the lonely mesh keeps drawing itself. */
  assert.equal(lonely.visible, true);
  assert.equal(world.entries.find((e) => e.object === lonely).parts, null);
});

test("a second buildBatches never re-buckets an entry — no object draws twice", () => {
  const world = createChunkWorld({ config: cfg() });
  const shared = standard();
  const first = new THREE.Group();
  first.add(
    boxMesh(shared, { size: 4, at: [0, 0, 0] }),
    boxMesh(shared, { size: 4, at: [20, 0, 0] }),
    boxMesh(shared, { size: 4, at: [40, 0, 0] }),
  );
  world.addStatic(first);
  world.buildBatches();

  /* The streaming layer registers a late-built zone on the same material and
     calls again. The three already folded must not join the new batch. */
  const late = new THREE.Group();
  late.add(
    boxMesh(shared, { size: 4, at: [80, 0, 0] }),
    boxMesh(shared, { size: 4, at: [100, 0, 0] }),
  );
  world.addStatic(late);
  const made = world.buildBatches();

  assert.equal(made.length, 1, "the second call should build exactly the late zone's batch");
  assert.equal(world.batches.length, 2);
  assert.equal(world.stats().batchedDraws, 5,
    "the batches carry more instances than there are entries — something got bucketed twice");
  for (const e of world.entries) {
    assert.equal(e.parts.length, 1, "an entry ended up inside two batches, so it draws twice");
  }
  assert.equal(world.entries.length, 5);
});

test("a two-group non-indexed mesh is split so each group joins its material's bucket", () => {
  const world = createChunkWorld({ config: cfg() });
  const wall = standard();
  const roof = standard();
  const root = new THREE.Group();
  const a = twoGroupMesh(wall, roof, [0, 0, 0]);
  const b = twoGroupMesh(wall, roof, [40, 0, 0]);
  root.add(a, b);
  world.addStatic(root);

  const made = world.buildBatches();
  assert.equal(made.length, 2, "the wall and roof groups belong in different material buckets");
  assert.deepEqual(
    world.batches.map((x) => x.count), [2, 2],
    "each bucket should hold one group from each of the two meshes"
  );
  assert.deepEqual(
    new Set(world.batches.map((x) => x.mesh.material)), new Set([wall, roof]),
    "a batch is carrying a material that is not one of the mesh's own"
  );
  /* Each half joined a different batch, and the halves are 6 vertices each —
     if the split had handed the WHOLE geometry to both buckets, each batch
     would have reserved 24 vertices instead of 12. */
  for (const e of world.entries) {
    assert.equal(e.parts.length, 2, "a multi-material mesh must land one part per group");
    assert.notEqual(e.parts[0].mesh, e.parts[1].mesh, "both groups went into the same batch");
  }
  for (const batch of world.batches) {
    assert.equal(batch.mesh.geometry.attributes.position.count, 12,
      "the batch copied more than its own group's vertices");
  }
  assert.equal(a.visible, false);
  assert.equal(b.visible, false);
  assert.equal(world.stats().batchedDraws, 4);
});

test("the decal ladder and the sorted passes are never folded away", () => {
  /* Batching changes draw order, and campus-overlay.js's whole mechanism IS
     draw order between separate objects. Anything whose correctness depends
     on when it draws has to stay its own draw call. */
  const world = createChunkWorld({ config: cfg() });
  const root = new THREE.Group();
  const excluded = {
    transparent: boxMesh(new THREE.MeshStandardMaterial({ transparent: true }), { size: 4, at: [0, 0, 0] }),
    noDepthWrite: boxMesh(new THREE.MeshStandardMaterial({ depthWrite: false }), { size: 4, at: [20, 0, 0] }),
    polygonOffset: boxMesh(new THREE.MeshStandardMaterial({ polygonOffset: true }), { size: 4, at: [40, 0, 0] }),
    renderOrdered: boxMesh(standard(), { size: 4, at: [60, 0, 0] }),
  };
  excluded.renderOrdered.renderOrder = 3;
  /* Two of each kind on ONE shared material, so a bucket would form if the
     exclusion were not doing the work. */
  for (const [kind, m] of Object.entries(excluded)) {
    const twin = m.clone();
    twin.position.x += 5;
    twin.name = `${kind}-twin`;
    root.add(m, twin);
  }
  const instanced = new THREE.InstancedMesh(new THREE.BoxGeometry(4, 4, 4), standard(), 4);
  for (let i = 0; i < 4; i++) instanced.setMatrixAt(i, new THREE.Matrix4().makeTranslation(i * 10, 0, 100));
  const instancedTwin = new THREE.InstancedMesh(instanced.geometry, instanced.material, 4);
  for (let i = 0; i < 4; i++) instancedTwin.setMatrixAt(i, new THREE.Matrix4().makeTranslation(i * 10, 0, 140));
  root.add(instanced, instancedTwin);
  world.addStatic(root);

  assert.deepEqual(world.buildBatches(), [], "something that depends on draw order was folded into a batch");
  assert.equal(world.stats().batchedDraws, 0);
  for (const [kind, m] of Object.entries(excluded)) {
    assert.equal(m.visible, true, `${kind} was hidden without a batch to carry it`);
  }
  assert.equal(instanced.visible, true);
});

test("a batched entry is tiered through its instance, not through the dead original", () => {
  const config = cfg();
  const world = createChunkWorld({ config });
  const shared = standard();
  const root = new THREE.Group();
  const bolts = [
    boxMesh(shared, { size: 0.5, at: [0, 0, 0] }),
    boxMesh(shared, { size: 0.5, at: [4, 0, 0] }),
  ];
  root.add(...bolts);
  world.addStatic(root);
  const batch = world.buildBatches()[0];
  assert.ok(batch, "the two bolts should have batched");

  const cam = cameraAt(config.props + config.hysteresis + 100);
  world.update(cam);
  for (const e of world.entries) {
    assert.equal(batch.getVisibleAt(e.parts[0].id), false, "a retired entry is still drawing inside its batch");
  }
  world.update(moveTo(cam, 0));
  for (const e of world.entries) {
    assert.equal(batch.getVisibleAt(e.parts[0].id), true, "the entry never came back inside its batch");
  }
});

test("a batch is visible only while its zone's layer is", () => {
  const world = createChunkWorld({ config: cfg() });
  const shared = standard();
  const root = new THREE.Group();
  root.add(boxMesh(shared, { size: 4, at: [0, 0, 0] }), boxMesh(shared, { size: 4, at: [20, 0, 0] }));
  world.addStatic(root);
  const batch = world.buildBatches()[0];
  const cam = cameraAt(0);

  root.visible = false;
  world.update(cam);
  assert.equal(batch.visible, false, "a dev-panel layer toggle stopped meaning what it says");
  root.visible = true;
  world.update(cam);
  assert.equal(batch.visible, true);

  /* The mirror runs before the stride gate and before the lodEnabled gate —
     a toggle has to land on the next frame, not on the next sweep. */
  const strided = createChunkWorld({ config: cfg({ stride: 60, lodEnabled: false }) });
  const root2 = new THREE.Group();
  const mat2 = standard();
  root2.add(boxMesh(mat2, { size: 4, at: [0, 0, 0] }), boxMesh(mat2, { size: 4, at: [20, 0, 0] }));
  strided.addStatic(root2);
  const batch2 = strided.buildBatches()[0];
  root2.visible = false;
  strided.update(cam);
  assert.equal(batch2.visible, false, "the toggle waited for a sweep that is 60 frames away");
});

/* -------------------------------------------------------- the escape hatch */

test("showAll puts the world back the way the builders made it", () => {
  const config = cfg();
  const world = createChunkWorld({ config });
  const shared = standard();
  const root = new THREE.Group();
  const batched = [
    boxMesh(shared, { size: 0.5, at: [0, 0, 0] }),
    boxMesh(shared, { size: 0.5, at: [4, 0, 0] }),
  ];
  const single = boxMesh(standard(), { size: 0.5, at: [8, 0, 0] });
  root.add(...batched, single);
  world.addStatic(root);
  const batch = world.buildBatches()[0];

  world.update(cameraAt(config.props + config.hysteresis + 100));
  assert.equal(world.stats().hidden, 3, "the far sweep did not retire everything it should have");

  world.showAll();
  assert.equal(world.stats().hidden, 0);
  assert.deepEqual(shownOf(world), [true, true, true]);
  assert.equal(single.visible, true, "a plain mesh must be drawing again");
  for (const m of batched) {
    assert.equal(m.visible, false, "showAll must not double-draw a batched original alongside its batch");
  }
  for (const e of world.entries) {
    if (e.parts) assert.equal(batch.getVisibleAt(e.parts[0].id), true, "a batched instance stayed retired");
  }
});

test("stats reports what is registered, retired and folded", () => {
  const config = cfg();
  const world = createChunkWorld({ config });
  const shared = standard();
  const root = new THREE.Group();
  root.add(
    boxMesh(shared, { size: 0.5, at: [0, 0, 0] }),
    boxMesh(shared, { size: 0.5, at: [4, 0, 0] }),
    boxMesh(standard(), { size: 4, at: [8, 0, 0] }),
  );
  world.addStatic(root);
  assert.deepEqual(world.stats(), { entries: 3, hidden: 0, batches: 0, batchedDraws: 0 });
  world.buildBatches();
  assert.deepEqual(world.stats(), { entries: 3, hidden: 0, batches: 1, batchedDraws: 2 });
  world.update(cameraAt(config.props + config.hysteresis + 100));
  assert.deepEqual(world.stats(), { entries: 3, hidden: 2, batches: 1, batchedDraws: 2 });
});
