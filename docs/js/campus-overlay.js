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
//
// TONE. campus-world.js blends every LIT ground surface toward a "daylight"
// base colour and runs it through a taste-guard clamp, which together lift
// a measured colour roughly a stop and a half (a lawn measured #75833f,
// luma 73.9, renders #5e792e, luma 104.3 — a 1.41x lift). UNLIT
// MeshBasicMaterial fills (paint, courts, logos — deliberately unlit, see
// each module's own comment on why) draw their raw measured colour and get
// none of that lift, so a dark measured fill sinks relative to the ground
// around it. The Muir trident did this first (a navy logo read as a black
// splat on the brightened turf); the same class later showed up as the
// Muir turf carpet reading as a near-black slab beside its own lawn.
// `sceneTone` is the one fix for the whole class — every unlit fill that
// needs to track the ground's lift routes through it, not a local formula.
import * as THREE from "../vendor/three/three.module.min.js";

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

/**
 * Lift a raw measured colour toward the same tonal register the LIT ground
 * gets, on a `strength` dial from 0 (unchanged) to 1 (the full lift, first
 * tuned so the navy trident stopped rendering as a black splat on the
 * brightened turf). Lightness moves along a compressing curve —
 * `min(0.85, l*0.6 + 0.26)` — that pulls dark colours up hard and barely
 * touches colours already near daylight, plus a small saturation boost so
 * the lift reads as brighter, not washed out. Hue is untouched.
 *
 * `strength` is a per-fill judgement call, not a universal constant: a fill
 * that visually sinks next to the lifted ground around it (Muir's turf
 * carpet, its wordmarks) needs the lift; a fill that was never sinking
 * (the track's terracotta ring, already brighter than the lawn beside it;
 * paint whites, concrete, sand — all already near daylight) does not, and
 * calling this at strength 0 (or not calling it at all) is the correct,
 * deliberate choice for those. Every call site says which and why.
 *
 * Not idempotent at strength 1 in general — the lightness curve is a
 * contraction toward its fixed point (l = 0.65), so re-applying it keeps
 * moving colours toward that fixed point rather than leaving them fixed.
 * That is fine here: nothing in this codebase applies it twice to the same
 * colour (tests/campus-overlay.test.mjs pins that repeated application
 * stays bounded and keeps moving toward, never away from, daylight).
 */
export function sceneTone(hex, strength = 1) {
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl);
  const liftedL = Math.min(0.85, hsl.l * 0.6 + 0.26);
  const liftedS = Math.min(1, hsl.s * 1.15);
  const l = hsl.l + (liftedL - hsl.l) * strength;
  const s = hsl.s + (liftedS - hsl.s) * strength;
  c.setHSL(hsl.h, s, l);
  return c;
}
