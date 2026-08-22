// The render-performance layer: four post-build passes over the static world.
//
// Everything here runs AFTER the builders and touches only how the scene is
// drawn, never what it contains — no geometry, position, colour or material
// value changes, only sharing and bookkeeping. That is the line that keeps
// this file out of the two-source rule's way: like campus-postfx.js it is
// declared art/perf direction, not a source.
//
// Nothing in the built campus moves at runtime. The only per-frame movers are
// the camera, the sun rig and the sky dome (which re-centres itself in its own
// onBeforeRender and depends on matrixAutoUpdate staying true) — so none of
// them are handed to these passes. Callers pass the static roots explicitly;
// there is deliberately no scene-wide traversal that could catch a mover by
// accident.
import * as THREE from "../vendor/three/three.module.min.js";

/* Bake every static transform once and stop re-composing it per frame.
   ~4,300 objects were having position/quaternion/scale recomposed every frame
   for matrices that never change. */
export function freezeStatic(roots) {
  let frozen = 0;
  for (const root of roots) {
    const r = root?.group ?? (root?.isObject3D ? root : null);
    if (!r) continue;
    r.updateMatrixWorld(true);
    r.traverse((o) => { o.matrixAutoUpdate = false; frozen++; });
  }
  return frozen;
}

/* World size that decides whether a mesh can put a useful mark on the
   shadow map. Plain meshes use the drawn radius. InstancedMesh uses the
   LARGEST instance (same judgement as campus-chunks.js unitRadius) AND
   that instance's median axis: a 4 m × 5 cm fin is a 4 m radius but a
   5 cm mark — sub-texel on the 512 map, 5,568 of them for a flicker.
   A 2 m × 1.5 m window frame has median 1.5 m and still casts. */
const _scale = new THREE.Vector3();
function casterSize(o) {
  if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
  const base = o.geometry.boundingSphere.radius;
  const s = o.getWorldScale(_scale);
  const parent = Math.max(Math.abs(s.x), Math.abs(s.y), Math.abs(s.z));
  if (!o.isInstancedMesh) return base * parent;
  const a = o.instanceMatrix.array;
  let maxSq = 0, med = 0;
  for (let i = 0, n = o.count; i < n; i++) {
    const k = i * 16;
    const sx = Math.hypot(a[k], a[k + 1], a[k + 2]);
    const sy = Math.hypot(a[k + 4], a[k + 5], a[k + 6]);
    const sz = Math.hypot(a[k + 8], a[k + 9], a[k + 10]);
    const mx = Math.max(sx, sy, sz);
    if (mx * mx >= maxSq) {
      maxSq = mx * mx;
      med = sx + sy + sz - mx - Math.min(sx, sy, sz);
    }
  }
  const radius = base * Math.sqrt(maxSq || 1) * parent;
  const mid = med * parent;
  return Math.min(radius, mid || radius);
}

/* Overlay decals (polygonOffset / depthWrite:false / renderOrder>0) and
   transparent glass cannot cast an honest shadow: a lifted pad that casts
   is a stripe floating over its own paint, and a 0.35-opacity pane casts
   a solid rectangle. They stay receivers. */
function shadowless(o) {
  if ((o.renderOrder | 0) !== 0) return true;
  const mats = Array.isArray(o.material) ? o.material : [o.material];
  return mats.some((m) => m && (m.transparent || m.depthWrite === false || m.polygonOffset));
}

/* Drop shadow casting from objects too small to survive the shadow map's
   texel size, and from surfaces whose shadow would be a lie. The sun box
   half-extent is 60 m + altitude — at eye level a texel is ~6 cm, so
   anything under `minRadius` world-metres contributes at most a few
   flickering texels for a full extra draw in the shadow pass.
   Receiving is untouched: small things still sit in the shadows of big ones. */
export function filterShadowCasters(roots, { minRadius = 0.3 } = {}) {
  let off = 0;
  for (const root of roots) {
    const r = root?.group ?? (root?.isObject3D ? root : null);
    if (!r) continue;
    r.traverse((o) => {
      if (!o.isMesh || !o.castShadow || !o.geometry) return;
      if (shadowless(o) || casterSize(o) < minRadius) { o.castShadow = false; off++; }
    });
  }
  return off;
}

/* The teardown primitive this codebase never had: detach a subtree and free
   its GPU geometry. Nothing calls it in the shipped walk — every built zone
   stays resident by design — but the streaming layer is the first code here
   that COULD evict, and eviction must be a config flip, not a rewrite.
   Materials are deliberately left alone: after dedupeMaterials they are
   shared across zones, and freeing one under a still-visible mesh is exactly
   the class of bug a "dispose everything" helper causes. Texture memory
   belongs to the shared library; the library owns its own dispose(). */
export function disposeDeep(root) {
  const r = root?.group ?? (root?.isObject3D ? root : null);
  if (!r) return 0;
  let freed = 0;
  r.removeFromParent();
  r.traverse((o) => { if (o.isMesh && o.geometry) { o.geometry.dispose(); freed++; } });
  return freed;
}

/* Render-state fingerprint. `color: false` is what lets BatchedMesh fold
   two stucco walls that differ only in sourced hue: the batch carries the
   hue per instance (setColorAt) and one material. Every other field still
   splits the bucket — a roughness or map miss would be a look change. */
const texKey = (t) => (t
  ? `${t.source?.uuid ?? t.uuid}:${t.repeat.x},${t.repeat.y}:${t.offset.x},${t.offset.y}:${t.wrapS},${t.wrapT}:${t.rotation}:${t.colorSpace}`
  : "0");

export function materialStateKey(m, { color = true } = {}) {
  return [
    m.type, color ? m.color?.getHexString() : "", m.roughness, m.metalness, m.side,
    m.transparent, m.opacity, m.depthWrite, m.depthTest, m.alphaTest,
    m.vertexColors, m.flatShading, m.fog, m.envMapIntensity,
    m.emissive?.getHexString(), m.emissiveIntensity,
    m.normalScale ? `${m.normalScale.x},${m.normalScale.y}` : "",
    m.polygonOffset, m.polygonOffsetFactor, m.polygonOffsetUnits,
    m.aoMapIntensity, m.bumpScale, m.wireframe, m.toneMapped,
    m.blending, m.depthFunc, m.colorWrite, m.dithering,
    m.premultipliedAlpha, m.alphaToCoverage, m.alphaHash,
    m.displacementScale, m.displacementBias, m.lightMapIntensity,
    texKey(m.map), texKey(m.normalMap), texKey(m.roughnessMap),
    texKey(m.metalnessMap), texKey(m.aoMap), texKey(m.bumpMap),
    texKey(m.alphaMap), texKey(m.emissiveMap), texKey(m.envMap),
    texKey(m.lightMap), texKey(m.displacementMap),
  ].join("|");
}

export function materialFoldKey(m) {
  return materialStateKey(m, { color: false });
}

/* Canonicalise identical materials. The photo modules ask their material
   library for a fresh MeshStandardMaterial per surface (~1,190 of them), and
   after the library became shared their texture sets are literally the same
   objects — so materials whose entire render-relevant state matches can be one
   material. Fewer unique materials means fewer uniform re-uploads and better
   draw sorting, and it is what later lets BatchedMesh fold draws together.
   Runs after build, so build-time tweaks are already in the state it compares;
   nothing mutates materials after build (no onBeforeCompile in the codebase —
   checked, and anything non-Standard/Basic/Lambert is left alone). */
export function dedupeMaterials(roots, { canon = new Map() } = {}) {
  const DEDUPABLE = new Set(["MeshStandardMaterial", "MeshBasicMaterial", "MeshLambertMaterial"]);

  let unique = 0, replaced = 0;
  const resolve = (m) => {
    if (!m || !DEDUPABLE.has(m.type) || m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) return m;
    const key = materialStateKey(m);
    const hit = canon.get(key);
    if (!hit) { canon.set(key, m); unique++; return m; }
    if (hit !== m) replaced++;
    return hit;
  };
  for (const root of roots) {
    const r = root?.group ?? (root?.isObject3D ? root : null);
    if (!r) continue;
    r.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      o.material = Array.isArray(o.material) ? o.material.map(resolve) : resolve(o.material);
    });
  }
  return { unique, replaced };
}

/* Fold InstancedMeshes that already share a material, a geometry layout and
   the same shadow / renderOrder flags into one draw. The photo modules emit
   one InstancedMesh per role even when several roles resolved to the same
   library material (Tata's five #dad6cf box populations, its three glass
   sets); after dedupe those are byte-identical draws and the batcher cannot
   take them because it refuses instancing. Originals stay in the graph,
   hidden, marked `userData.perfMerged` so campus-chunks.addStatic skips
   them — same contract as a BatchedMesh fold. Same parent only: a merge
   that hopped module groups would break a per-child layer toggle. */
function geoSig(g) {
  const names = Object.keys(g.attributes).sort();
  const p = g.attributes.position;
  const n = p.count;
  const a = p.array;
  const i1 = Math.floor(n / 2) * 3, i2 = (n - 1) * 3;
  return `${names.join(",")}|${n}|${g.index ? g.index.count : 0}|${a[0]},${a[1]},${a[2]}|${a[i1]},${a[i1 + 1]},${a[i1 + 2]}|${a[i2]},${a[i2 + 1]},${a[i2 + 2]}`;
}

export function mergeInstancedMeshes(roots) {
  let merged = 0, folded = 0;
  const tmp = new THREE.Matrix4();
  const col = new THREE.Color();
  for (const root of roots) {
    const r = root?.group ?? (root?.isObject3D ? root : null);
    if (!r) continue;
    const byParent = new Map();
    r.traverse((o) => {
      if (!o.isInstancedMesh || !o.geometry || !o.material || o.userData.perfMerged) return;
      if (Array.isArray(o.material) || !o.parent) return;
      let list = byParent.get(o.parent);
      if (!list) byParent.set(o.parent, (list = []));
      list.push(o);
    });
    for (const [parent, meshes] of byParent) {
      const buckets = new Map();
      for (const o of meshes) {
        const key = `${o.material.uuid}|${geoSig(o.geometry)}|${o.castShadow}|${o.receiveShadow}|${o.renderOrder | 0}|${o.instanceColor ? 1 : 0}`;
        let b = buckets.get(key);
        if (!b) buckets.set(key, (b = []));
        b.push(o);
      }
      for (const group of buckets.values()) {
        if (group.length < 2) continue;
        const proto = group[0];
        const total = group.reduce((n, o) => n + o.count, 0);
        const mesh = new THREE.InstancedMesh(proto.geometry, proto.material, total);
        mesh.castShadow = proto.castShadow;
        mesh.receiveShadow = proto.receiveShadow;
        mesh.renderOrder = proto.renderOrder;
        mesh.frustumCulled = proto.frustumCulled;
        mesh.name = `perf-merged:${proto.name}+${group.length - 1}`;
        let at = 0;
        for (const o of group) {
          for (let i = 0; i < o.count; i++, at++) {
            o.getMatrixAt(i, tmp);
            mesh.setMatrixAt(at, tmp);
            if (o.instanceColor) { o.getColorAt(i, col); mesh.setColorAt(at, col); }
          }
          o.visible = false;
          o.userData.perfMerged = true;
          o.castShadow = false;
          folded++;
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        parent.add(mesh);
        merged++;
      }
    }
  }
  return { merged, folded };
}
