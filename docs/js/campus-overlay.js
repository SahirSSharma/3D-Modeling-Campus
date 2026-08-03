// The single draped-overlay ladder every drawn-on-the-ground surface climbs.
//
// The camera is `PerspectiveCamera(68, 1, 0.4, 900)` (campus-walk.js) and
// free-roam pushes far to `1100 + lift*14` (campus-explore.js). With a 24-bit
// depth buffer that near plane resolves depth to roughly d²/(near·2^24):
// ~24 mm at 400 m, ~73 mm at 700 m. The old ladder separated its rungs by a
// few CENTIMETRES total (0.04 m -> 0.11 m across five modules) — at review
// altitude every rung collapsed into the same one or two depth values and
// which surface won became per-triangle noise. That is the chevron field,
// the white blotches on the courts, the red bleeding into the tennis green,
// the half-eaten trident.
//
// The fix makes ordering independent of depth precision: draped overlays are
// a DECAL STACK, ordered by `renderOrder` with `depthWrite: false`. They
// still `depthTest: true` against terrain, buildings and trees (which stay at
// the default renderOrder 0), so a wall or a tree still correctly occludes
// them — but among themselves they simply paint in ladder order, which is
// exact at 2 m and at 900 m alike. `lift` and `polygonOffset` remain, small
// and strictly ordered, purely as belt-and-braces for eye-level parallax and
// grazing-angle z-fighting; they are no longer what keeps the ladder sorted.
//
// Every module that drapes anything on the terrain imports its lift and
// depth state from HERE. None of them may define a local lift or
// polygonOffset constant of its own — tests/campus-overlay.test.mjs greps
// for that regression.
//
// Water is NOT a rung here: it is a raised basin (+0.35 m rim), genuinely
// 3D, and keeps `depthWrite: true` — see campus-world.js.

/** Ordered rungs, ground upward. Position in the array is the ladder order. */
export const OVERLAY_RUNGS = ["ground", "pad", "carpet", "paint", "logo"];

/**
 * rung name -> depth-ladder entry.
 *
 *   lift                  metres above the terrain (eye-level parallax only)
 *   renderOrder           draw order of the decal stack; terrain/buildings/
 *                         trees stay at the Three.js default of 0
 *   polygonOffsetFactor   WebGL polygon-offset factor, more negative = nearer
 *   polygonOffsetUnits    WebGL polygon-offset units, more negative = nearer
 *
 * ground  — campus-world.js surfaces (plaza/walk/road/green) + paths
 * pad     — recreation aprons, markings `surface` fills
 * carpet  — muir turf carpet, recreation court surfaces, terrace mats, turf lane
 * paint   — markings lines, muir-field painted lines/ribbons
 * logo    — markings logo fills, muir wordmarks/trident
 */
export const OVERLAY = {
  ground: { lift: 0.05, renderOrder: 1, polygonOffsetFactor: -4, polygonOffsetUnits: -8 },
  pad: { lift: 0.09, renderOrder: 2, polygonOffsetFactor: -5, polygonOffsetUnits: -10 },
  carpet: { lift: 0.13, renderOrder: 3, polygonOffsetFactor: -6, polygonOffsetUnits: -12 },
  paint: { lift: 0.17, renderOrder: 4, polygonOffsetFactor: -7, polygonOffsetUnits: -14 },
  logo: { lift: 0.21, renderOrder: 5, polygonOffsetFactor: -8, polygonOffsetUnits: -16 },
};

/** Lift in metres for a rung. Throws on an unknown rung. */
export function overlayLift(rung) {
  const entry = OVERLAY[rung];
  if (!entry) throw new Error(`campus-overlay: unknown rung "${rung}"`);
  return entry.lift;
}

/**
 * Apply the ladder's depth state to a material: polygon offset, the rung's
 * factor/units, and the decal-stack contract (`depthWrite: false`,
 * `depthTest: true`). Returns the same material so this composes with a
 * constructor call. The caller is still responsible for setting the rung's
 * `renderOrder` on the MESH — Three.js has no per-material render order.
 */
export function applyOverlayDepth(material, rung) {
  const entry = OVERLAY[rung];
  if (!entry) throw new Error(`campus-overlay: unknown rung "${rung}"`);
  material.polygonOffset = true;
  material.polygonOffsetFactor = entry.polygonOffsetFactor;
  material.polygonOffsetUnits = entry.polygonOffsetUnits;
  material.depthWrite = false;
  material.depthTest = true;
  return material;
}
