// The chunked-world layer: every static drawable registers with a world-space
// AABB, gets a detail tier from its distance to the camera each sweep, and
// everything opaque that shares a material draws as one BatchedMesh instead
// of hundreds of Meshes. (Tiers are per-drawable, not per grid cell — the
// terrain's own 255 m chunks and the massing's 500 m merge buckets already
// partition the heavy geometry spatially, so a second grid on top of their
// AABBs would add bookkeeping and no precision.)
//
// Like campus-perf.js and campus-postfx.js this is declared render direction,
// not a source: nothing here invents, moves or recolours an entity. A tier
// only decides WHETHER something already measured is drawn this frame, and a
// batch only changes how many GL calls carry it. The measured builders stay
// byte-identical; the audit can always set `config.lodEnabled = false` and
// see the world exactly as the builders made it.
//
// TIERS — distance is 3D camera-to-AABB, so altitude retires detail exactly
// like horizontal distance does:
//   near             everything draws
//   d > props        unit-size < smallUnit stops drawing (bolts, cutlery,
//                    pebbles — sub-pixel at this range)
//   d > photo        photo-sourced detail stops; the measured massing
//                    underneath (which those facades float off) carries
//                    the building silhouette
//   beyond fog.far   nothing draws (view-depth cull; fog is opaque there)
// Every threshold lives in CHUNK_CONFIG and is runtime-mutable — the dev
// panel and the URL both get to override it.
import * as THREE from "../vendor/three/three.module.min.js";

export const CHUNK_CONFIG = {
  props: 800,         // m — hide units smaller than smallUnit beyond this
  photo: 1500,        // m — hide the photo-detail category beyond this
  smallUnit: 0.8,     // m — bounding radius of one drawn unit that counts as "small"
  hysteresis: 60,     // m — a boundary must be crossed by this much to re-tier
  stride: 6,          // frames between tier sweeps
  lodEnabled: true,   // tier system on/off (off = builders' scene, verbatim)
  lodScale: 1,        // multiplies detail/props/photo — the adaptive controller's dial
};

/* One registered drawable: either a live Object3D we toggle `.visible` on, or
   an instance inside a BatchedMesh we toggle with setVisibleAt. */
function makeEntry(object, aabb, unit, category, zone) {
  /* `parts` fills in if the object joins a batch: [{mesh, id}] — one per
     material group for split multi-material meshes. */
  return { object, aabb, unit, category, zone, parts: null, shown: true };
}

const box = new THREE.Box3();

function worldAABB(o) {
  if (o.isInstancedMesh) {
    /* InstancedMesh: three's own computeBoundingBox covers every instance. */
    if (!o.boundingBox) o.computeBoundingBox();
    box.copy(o.boundingBox).applyMatrix4(o.matrixWorld);
  } else {
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    box.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
  }
  return { x0: box.min.x, y0: box.min.y, z0: box.min.z, x1: box.max.x, y1: box.max.y, z1: box.max.z };
}

/* Distance from a point to an AABB, zero inside. */
function distToAABB(p, b) {
  const dx = Math.max(b.x0 - p.x, 0, p.x - b.x1);
  const dy = Math.max(b.y0 - p.y, 0, p.y - b.y1);
  const dz = Math.max(b.z0 - p.z, 0, p.z - b.z1);
  return Math.hypot(dx, dy, dz);
}

/* The smallest VIEW depth any point of the AABB can have: fog runs on view
   depth (-mvPosition.z), and depth is linear, so the minimum over the eight
   corners is exact. Never negative — a box straddling the camera plane is at
   depth zero, i.e. never fog-culled. */
function depthToAABB(p, fwd, b) {
  let min = Infinity;
  for (let i = 0; i < 8; i++) {
    const cx = (i & 1 ? b.x1 : b.x0) - p.x;
    const cy = (i & 2 ? b.y1 : b.y0) - p.y;
    const cz = (i & 4 ? b.z1 : b.z0) - p.z;
    const d = cx * fwd.x + cy * fwd.y + cz * fwd.z;
    if (d < min) min = d;
  }
  return Math.max(0, min);
}

/* The unit size that tiering judges: for a plain mesh its whole world radius,
   for an InstancedMesh the BASE geometry's radius times the LARGEST instance
   scale — the size of the biggest drawn thing, not of the field it is
   scattered over and not of the unit template. The photo modules build
   metre-scale facade panels from unit planes with the size in the instance
   matrix; judging the template would retire whole facade sets as "trim". */
function unitRadius(o) {
  const g = o.geometry;
  if (!g.boundingSphere) g.computeBoundingSphere();
  if (o.isInstancedMesh) {
    const a = o.instanceMatrix.array;
    let maxSq = 0;
    for (let i = 0; i < o.count; i++) {
      const k = i * 16;
      /* Squared column norms of the 3x3 = squared per-axis scales. */
      const sx = a[k] * a[k] + a[k + 1] * a[k + 1] + a[k + 2] * a[k + 2];
      const sy = a[k + 4] * a[k + 4] + a[k + 5] * a[k + 5] + a[k + 6] * a[k + 6];
      const sz = a[k + 8] * a[k + 8] + a[k + 9] * a[k + 9] + a[k + 10] * a[k + 10];
      const m = Math.max(sx, sy, sz);
      if (m > maxSq) maxSq = m;
    }
    return g.boundingSphere.radius * Math.sqrt(maxSq || 1);
  }
  const s = o.getWorldScale(new THREE.Vector3());
  return g.boundingSphere.radius * Math.max(Math.abs(s.x), Math.abs(s.y), Math.abs(s.z));
}

export function createChunkWorld({ config = CHUNK_CONFIG } = {}) {
  const entries = [];
  const batches = [];        // [{ mesh, material, count }]
  let frame = 0;
  let lastSweep = 0;

  /* ------------------------------------------------------------ register */
  /* Walk a static root and take charge of every mesh in it. `category` is
     the tier class: "photo" retires at the photo radius, "base" never
     retires wholesale (massing, terrain, ground — the world's silhouette),
     small units inside EITHER retire at the props radius. */
  /* `zone` is the LAYER group whose visibility batches must mirror; it
     defaults to the registered root, but a caller registering per-child (to
     vary category inside one layer) passes the layer explicitly so the dev
     panel toggle still reaches the batches. */
  function addStatic(root, { category = "base", zone = null } = {}) {
    const r = root?.group ?? (root?.isObject3D ? root : null);
    if (!r) return 0;
    const z = zone ?? r;
    let n = 0;
    r.updateMatrixWorld(true);
    r.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      entries.push(makeEntry(o, worldAABB(o), unitRadius(o), category, z));
      n++;
    });
    return n;
  }

  /* --------------------------------------------------------------- batch */
  /* Fold compatible plain meshes into one BatchedMesh per bucket. Only
     opaque, renderOrder-0, non-instanced meshes join: the draped decal
     ladder (campus-overlay.js) depends on draw order between SEPARATE
     objects, and transparency depends on sorting, so both stay as they are.
     Multi-material meshes (massing's wall/roof groups) are split by their
     geometry groups so each part joins its material's bucket.
     Originals go `visible = false` but stay in the graph — massInfo, layer
     toggles and the audit's probes keep working; the batch mirrors each
     zone's visibility every sweep. */
  function buildBatches() {
    const buckets = new Map();
    const batchable = (o, m) =>
      !o.isInstancedMesh && !m.transparent && m.depthWrite !== false &&
      (o.renderOrder | 0) === 0 && !m.polygonOffset &&
      (m.isMeshStandardMaterial || m.isMeshBasicMaterial || m.isMeshLambertMaterial);

    const fresh = [];
    for (const e of entries) {
      /* Re-entrant: the streaming layer registers late-built zones and calls
         this again. An entry weighed once is never re-bucketed — a leftover
         single from an earlier call joining a later batch would draw twice,
         once as itself and once as an instance. */
      if (e.considered) continue;
      e.considered = true;
      const o = e.object;
      if (Array.isArray(o.material)) {
        /* Multi-material (massing's wall/roof groups): split each geometry
           group into its material's bucket. Indexed geometry slices the
           index; non-indexed (massing is toNonIndexed) slices each
           attribute's vertex range — group start/count are vertex counts
           there. */
        if (!o.geometry.groups?.length) continue;
        if (!o.material.every((m) => batchable(o, m))) continue;
        e.pendingParts = o.geometry.groups.map((g) => partFor(buckets, o.material[g.materialIndex ?? 0], o, e, subGeometry(o.geometry, g.start, g.count)));
        fresh.push(e);
      } else if (o.material && batchable(o, o.material)) {
        e.pendingParts = [partFor(buckets, o.material, o, e, o.geometry)];
        fresh.push(e);
      }
    }

    /* ALL-OR-NOTHING per entry, to a fixpoint. A batch of one is just
       overhead, so buckets with a single member don't build — but an entry
       whose groups land partly in a building bucket and partly in a skipped
       one must NOT be half-drawn: hiding the original while one of its
       groups was dropped is a hole in a wall (found the hard way on the
       Sankofa tower). Withdrawing an entry can shrink another bucket below
       two, so iterate until stable. */
    for (let changed = true; changed; ) {
      changed = false;
      for (const e of fresh) {
        if (e.batchDropped) continue;
        const starves = e.pendingParts.some((p) => p.bucket.parts.filter((q) => !q.entry.batchDropped).length < 2);
        if (starves) { e.batchDropped = true; changed = true; }
      }
    }

    const made = [];
    for (const b of buckets.values()) {
      const parts = b.parts.filter((p) => !p.entry.batchDropped);
      if (parts.length < 2) continue;
      let verts = 0, indices = 0;
      for (const p of parts) {
        verts += p.geometry.attributes.position.count;
        indices += p.geometry.index ? p.geometry.index.count : p.geometry.attributes.position.count;
      }
      const mesh = new THREE.BatchedMesh(parts.length, verts, indices, b.material);
      mesh.perObjectFrustumCulled = true;
      mesh.castShadow = b.castShadow;
      mesh.receiveShadow = b.receiveShadow;
      mesh.matrixAutoUpdate = false;
      for (const p of parts) {
        const iid = mesh.addInstance(mesh.addGeometry(p.geometry));
        mesh.setMatrixAt(iid, p.entry.object.matrixWorld);
        /* Seed from the entry's CURRENT tier state — a sweep may have run
           between registration and batching (the streaming layer yields to
           the frame loop), and show() is edge-triggered, so an instance
           born visible for a hidden entry would stay visible forever. */
        mesh.setVisibleAt(iid, p.entry.shown);
        (p.entry.parts ??= []).push({ mesh, id: iid });
      }
      batches.push({ mesh, zone: b.zone, count: parts.length });
      made.push(mesh);
    }
    /* Originals out of the draw; the batch carries them now. The object
       stays in the graph so probes, layer maths and the audit still see it. */
    for (const e of fresh) {
      delete e.pendingParts;
      delete e.batchDropped;
      if (e.parts) e.object.visible = false;
    }
    return made;
  }

  function partFor(buckets, m, o, e, geometry) {
    /* One batch per material × shadow flags × attribute layout × indexedness
       × ZONE — the zone keeps layer toggles honest (a batch shows only while
       its zone does), the layout keeps addGeometry from mixing incompatible
       vertex formats, and indexedness because a BatchedMesh cannot mix
       indexed and non-indexed geometry. */
    const attrs = Object.keys(geometry.attributes).sort().join(",");
    const key = `${m.uuid}|${o.castShadow}|${o.receiveShadow}|${attrs}|${geometry.index ? "i" : "n"}|${e.zone?.uuid ?? "-"}`;
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = { material: m, castShadow: o.castShadow, receiveShadow: o.receiveShadow, zone: e.zone, parts: [] }));
    const part = { entry: e, geometry, bucket: b };
    b.parts.push(part);
    return part;
  }

  /* One geometry-group range as its own geometry. Indexed: share the
     attribute arrays, slice the index — NOTE addGeometry then copies the
     FULL vertex buffer once per group, which is fine for today's producers
     (massing, the only multi-material one, is non-indexed) but is the thing
     to fix before batching an indexed multi-material mesh with many groups.
     Non-indexed: slice every attribute's vertex range (start/count are
     vertex counts there), so the batch copies only this group's vertices. */
  function subGeometry(geo, start, count) {
    const sub = new THREE.BufferGeometry();
    if (geo.index) {
      for (const [name, attr] of Object.entries(geo.attributes)) sub.setAttribute(name, attr);
      sub.setIndex(new THREE.BufferAttribute(geo.index.array.slice(start, start + count), 1));
    } else {
      for (const [name, attr] of Object.entries(geo.attributes)) {
        const n = attr.itemSize;
        sub.setAttribute(name, new THREE.BufferAttribute(attr.array.slice(start * n, (start + count) * n), n, attr.normalized));
      }
    }
    return sub;
  }

  /* --------------------------------------------------------------- tiers */
  const camPos = new THREE.Vector3();
  /* `cullBeyond` is the fog's far distance, handed in per frame: past it the
     fog is fully opaque, so an object wholly beyond it is invisible by
     definition and drawing it is pure cost. Altitude scales the fog out to
     tens of km (campus-explore.js scaleAtmosphere), so overview shots keep
     everything — this only bites at street level, where it retires most of
     the region's triangles. */
  const camFwd = new THREE.Vector3();
  function update(camera, cullBeyond = Infinity, dtFrames = 1) {
    frame += dtFrames;
    /* A batch draws only while its zone's layer does — the dev panel's
       toggles keep meaning what they say. Every frame: a toggle must land
       immediately, not on the next sweep. */
    for (const b of batches) b.mesh.visible = b.zone ? b.zone.visible : true;
    if (!config.lodEnabled) {
      /* The escape hatch must mean what it says: flipping lodEnabled off
         RESTORES the builders' scene verbatim, not "stops changing it". */
      showAll();
      return;
    }
    /* Accumulator, not modulo: `frame % stride === 0` is exact float
       equality, and any caller passing a fractional dtFrames would silently
       never sweep again. */
    if (frame - lastSweep < config.stride) return;
    lastSweep = frame;
    camera.getWorldPosition(camPos);
    camera.getWorldDirection(camFwd);
    const s = config.lodScale;
    for (const e of entries) {
      const d = distToAABB(camPos, e.aabb);
      /* Hysteresis: the radius that must be crossed to CHANGE state moves by
         ±h depending on which side we are on, so a camera dithering on a
         boundary cannot strobe the world. */
      const h = e.shown ? config.hysteresis : -config.hysteresis;
      let want = true;
      /* The fog cull compares VIEW depth, not radial distance — three's
         linear fog runs on -mvPosition.z, so an object at the frustum's
         edge sits in thinner fog than its radial distance suggests and a
         radial cull would pop it. depthToAABB is the nearest point's
         projection on the view axis; it is <= the radial distance, so this
         only errs on the visible side. */
      if (depthToAABB(camPos, camFwd, e.aabb) > cullBeyond + h) want = false;
      else if (e.category === "photo" && d > config.photo * s + h) want = false;
      else if (e.unit < config.smallUnit && d > config.props * s + h) want = false;
      if (want !== e.shown) show(e, want);
    }
  }

  function show(e, want) {
    e.shown = want;
    if (e.parts) for (const p of e.parts) p.mesh.setVisibleAt(p.id, want);
    else e.object.visible = want;
  }

  /* Everything back on, exactly as built — the audit's escape hatch. */
  function showAll() {
    for (const e of entries) if (!e.shown) show(e, true);
  }

  function stats() {
    let hidden = 0;
    for (const e of entries) if (!e.shown) hidden++;
    return {
      entries: entries.length, hidden,
      batches: batches.length,
      batchedDraws: batches.reduce((a, b) => a + b.count, 0),
    };
  }

  return { config, addStatic, buildBatches, update, showAll, stats, entries, batches };
}
