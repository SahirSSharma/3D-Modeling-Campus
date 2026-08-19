// The render-performance layer: three post-build passes over the static world.
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

/* Drop shadow casting from objects too small to survive the shadow map's
   texel size. The sun box half-extent is 60 m + altitude — at eye level a
   texel is ~6 cm, so anything under `minRadius` world-metres contributes at
   most a few flickering texels for a full extra draw in the shadow pass.
   Receiving is untouched: small things still sit in the shadows of big ones. */
export function filterShadowCasters(roots, { minRadius = 0.3 } = {}) {
  let off = 0;
  const scale = new THREE.Vector3();
  for (const root of roots) {
    const r = root?.group ?? (root?.isObject3D ? root : null);
    if (!r) continue;
    r.traverse((o) => {
      if (!o.isMesh || !o.castShadow || !o.geometry) return;
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      const s = o.getWorldScale(scale);
      const radius = o.geometry.boundingSphere.radius * Math.max(Math.abs(s.x), Math.abs(s.y), Math.abs(s.z));
      /* An InstancedMesh's bounding sphere is the base geometry's — one small
         instance — but its footprint is the whole set, so its shadows stay
         unless even the base unit is sub-texel tiny. That is the intent:
         10,000 pebbles cast nothing, 300 window frames still do. */
      if (radius < minRadius) { o.castShadow = false; off++; }
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

/* Canonicalise identical materials. The photo modules ask their material
   library for a fresh MeshStandardMaterial per surface (~1,190 of them), and
   after the library became shared their texture sets are literally the same
   objects — so materials whose entire render-relevant state matches can be one
   material. Fewer unique materials means fewer uniform re-uploads and better
   draw sorting, and it is what later lets BatchedMesh fold draws together.
   Runs after build, so build-time tweaks are already in the state it compares;
   nothing mutates materials after build (no onBeforeCompile in the codebase —
   checked, and anything non-Standard/Basic/Lambert is left alone). */
export function dedupeMaterials(roots) {
  const texKey = (t) => (t
    ? `${t.source?.uuid ?? t.uuid}:${t.repeat.x},${t.repeat.y}:${t.offset.x},${t.offset.y}:${t.wrapS},${t.wrapT}:${t.rotation}:${t.colorSpace}`
    : "0");
  const keyOf = (m) => [
    m.type, m.color?.getHexString(), m.roughness, m.metalness, m.side,
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
  const DEDUPABLE = new Set(["MeshStandardMaterial", "MeshBasicMaterial", "MeshLambertMaterial"]);

  const canon = new Map();
  let unique = 0, replaced = 0;
  const resolve = (m) => {
    if (!m || !DEDUPABLE.has(m.type) || m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) return m;
    const key = keyOf(m);
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
