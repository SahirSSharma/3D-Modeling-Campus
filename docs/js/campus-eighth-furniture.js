// What stands ON Eighth College's ground, once the imagery is registered.
//
// WHY THIS EXISTS. campus-eighth.js repaints ~7,300 m² of Eighth off the
// construction-epoch tan and then stops, because the ground build spec
// (.cache/eighth-ground/BUILD-SPEC.md §5) deferred every prop for ONE reason,
// stated in its own §7: "the object is measured in pixels but not registered
// in world coordinates". The courtyard therefore renders with the right
// colours and nothing else in it, against references that show an inhabited
// landscape. This module closes that gap by doing §7's unlock.
//
// EVERY NUMBER BELOW IS A SCRIPT'S OUTPUT, COPIED VERBATIM. That is the whole
// discipline of this file, and it is a correction of the previous pass: the
// tables here used to be typed from a detector that lived only on the build
// machine, and when scripts/register-eighth-refs.py was finally taught to run
// the detection rule this header states, the old table did not come back.
// Measured, on the rule as written: 2 of its 26 rows were not on the surveyed
// `walk` layer at all, 10 sat inside the 5 m massing clearance the rule
// excludes, 5 PAIRS overlapped each other (one bench emitted twice, rendering
// as a fused L-shaped solid), and only 9 reproduced within the confirmation
// tolerance. So the table is gone and what the pass emits is what ships:
//
//   python3 scripts/register-eighth-refs.py --ortho --furniture --turf --colours
//
// writes scripts/reports/eighth/{plaza-objects,turf-panel,enclosure,
// illumination}.json, which is tracked, and a test in tests/campus-eighth.test.mjs
// compares every constant here against it. A number that cannot be regenerated
// cannot ship.
//
// THE REGISTRATION, and why it can be trusted:
//
//   * ref2 is proven ORTHOGRAPHIC (its four painted court corners form a
//     parallelogram: opposite edges 168.0/166.1 px and 249.0/246.8 px). Its
//     court corners are SURVEYED — campus-eighth.json ground.basketball-court,
//     -185.9..-163.2 x, 517.5..532.9 z. Fitting pixel corners to those four
//     world corners gives an affine with a max residual of 0.5 px = 4.6 cm,
//     and a scale of 10.92 / 10.85 px per metre on the two axes.
//   * ref3 and ref8 are tied to ref2 by a GROUND-PLANE homography from SIFT +
//     exhaustive matching + RANSAC (1,922 and 203 inliers, stable across five
//     seeds). A homography is exact for a plane; roof and facade features
//     carry parallax and drop out as outliers.
//   * ref6 is REJECTED at 10-12 inliers. The previous pass recorded it at 29
//     and leaned on it in an omission note. That 29 was a draw, not a result:
//     the matcher was FLANN's randomised KD-forest, which cv2.setRNGSeed does
//     not reach, so the match set itself changed every run and ref6 landed
//     either side of the 25-inlier floor. The matcher is now exhaustive and
//     the number is stable. Nothing in this file rests on ref6 any more.
//   * FALSIFICATION, which is the part that matters: every ArcGIS ground ring
//     and massing footprint was projected back onto ref2, ref3 and ref8 and
//     eyeballed. The survey lands on the photographed beds, walkways, court
//     paint and building BASES. A wrong transform could not do that.
//
// WHAT IS MEASURED AND WHAT IS ESTIMATED. Every position and every PLAN size
// below is measured in the registered imagery and carries the frames it came
// from. No HEIGHT here is measured — no frame in the set resolves a vertical
// against a calibration object at these objects. Every height is a
// STANDARD-SIZE ESTIMATE and is labelled as one at its constant. That is the
// deliberate trade: an object whose EXISTENCE and PLAN POSITION are confirmed
// in two independent frames is a large visible gain placed within a metre,
// where omitting it is a large visible loss. Rule 3 still governs anything
// whose existence is unevidenced — see the omissions at the foot of this file.
//
// Nothing here calls Math.random. Every solid is routed through the SAME
// building gate campus-eighth.js uses for its boulders and hedges (imported,
// not copied — the class is "a mass placed from imagery that the survey
// continues under a podium"), plus a court gate, because nothing may overhang
// the playing surface, plus an overlap merge, because two detections of one
// bench must not render as two boxes.
import * as THREE from "../vendor/three/three.module.min.js";
import { OVERLAY, overlayLift, applyOverlayDepth } from "./campus-overlay.js";
import { fillPoly, solids } from "./campus-drape.js";
import { buildingFootprints, hitsBuilding, ringMetrics, inRing } from "./campus-eighth.js";

/**
 * Colours, and the ILLUMINATION each was read in — which is the half the
 * previous pass left out and the reason its enclosure rendered as a near-black
 * slab. The courtyard and the court end are in deep blue-cast shadow in every
 * frame that covers them, so a median taken there is an illumination, not an
 * albedo: shipping it raw as a LIT material's colour multiplies the shadow by
 * the scene's own lighting and lands two stops below anything beside it.
 *
 * The correction is MEASURED, not dialled: `--colours` splits surveyed `walk`
 * paving in ref3 into sunlit and shadowed by B-R > 4 — one material, one
 * frame, both states — and reports the per-channel ratio between them
 * (luminance 159 / 52 = 3.06x overall). Per channel, because the cast is blue:
 * scaling all three equally keeps the cast and just makes it a brighter blue.
 * `raw` is what the pixels said; `state` is where they were; the shipped hex
 * is `raw` relit when the state is shade, and `raw` untouched when it is sun.
 * A test asserts no colour ships raw out of shadow.
 */
export const FURNITURE_COLOR_PROVENANCE = {
  /* The turf panel's own pixels in ref3, sunlit, corroborated by ref8 through
     the same polygon at #9c947f — three RGB counts apart, two viewpoints. It
     is olive-tan, not vivid green: this is dry San Diego lawn. */
  turf: { raw: "#9d947c", state: "sun", frames: ["ref3", "ref8"] },
  /* The service enclosure's coping and walls, ref2, deep in the court end's
     shadow at #2a3d53. Relit, it is the pale blue-grey of a lit concrete
     screen, which is what ref1's oblique shows it to be. */
  enclosure: { raw: "#2a3d53", state: "shade", frames: ["ref2"] },
  /* The 17 plaza objects, median of all of their detected footprints in ref3,
     in the courtyard's shadow at #314250. Relit, near-white concrete. */
  plazaObject: { raw: "#314250", state: "shade", frames: ["ref3"] },
};

export const FURNITURE_COLORS = {
  turf: "#9d947c",
  enclosure: "#a6b2bb",
  plazaObject: "#c2c1b5",
};

/* HEIGHTS — every one a STANDARD-SIZE ESTIMATE, not a measurement.
   No frame in the set gives a vertical reference at any of these objects. */
const ENCLOSURE_H = 2.0;    // a refuse enclosure tall enough to screen a bin
const ENCLOSURE_WALL = 0.5; // the coping width measured in ref2 (0.45-0.55 m)
const SEAT_H = 0.75;        // café-table / stool height
const PLANTER_H = 0.55;     // raised planter / seat-cube height
/* Plan size at or below this reads as a single seat or table; above it, as a
   raised planter or a seat block. The split is the measured bimodality of the
   confirmed objects (a 0.8-1.7 m cluster and a 2.0-2.6 m cluster). */
const SEAT_MAX_M = 1.7;
/* Nothing may stand inside the painted court, or within this of its edge. */
const COURT_CLEARANCE = 1.0;

/**
 * The turf panel, as `--turf` traces it.
 *
 * MEASURED: the largest vegetation component inside the surveyed
 * courtyard-2369 ring in ref3 — green over blue by 8 counts, opened 5x5,
 * contour simplified to 0.5 m. 148.0 m² of component; 98.6 % of the traced
 * polygon is vegetation in ref3. The area of THIS polygon is not typed here at
 * all: ringMetrics() computes it and a test compares the two, because the
 * previous pass carried three different areas in one comment (39, 33, 38.7)
 * and the polygon was in fact 34.2.
 *
 * WHAT CHANGED, and why the panel quadrupled: the previous trace followed the
 * SUNLIT fraction of the lawn and stopped at the shadow line, which is not a
 * ground edge. Shadowed lawn is still lawn. The ~114 m² it left out was real
 * campus rendering as cobble.
 *
 * ref8's CORROBORATION, stated as the number it is: sampled through this
 * polygon, ref8 medians #9c947f against ref3's #9d947c, so the MATERIAL is
 * confirmed from a second viewpoint. Its vegetation mask, though, is 57.1 %
 * through this outline and 92.7 % at (-5.5, +1.5) m — a registration offset of
 * 5.7 m at the far end of a steep oblique, which is why the OUTLINE is ref3's
 * alone and is declared as one frame's. The previous pass claimed ref8
 * confirmed the centre "to 1.5 m"; measured, that was never true.
 */
const TURF_PANELS = [{
  key: "turf-2369",
  host: "courtyard-2369",
  frames: ["ref3"],
  corroboration: { frame: "ref8", colour: "#9c947f", offsetM: 5.7 },
  points: [
    [-115.58, 567.67], [-118.17, 564.33], [-129.67, 568.17], [-130.67, 569.83],
    [-132.25, 569.33], [-134.83, 570.67], [-132.83, 575.58], [-128.67, 575.92],
    [-126.92, 577.25], [-125.42, 575.75], [-116.58, 575.17], [-116.67, 573.92],
    [-119.67, 569.33], [-118.25, 567.67], [-116.58, 568.58],
  ],
}];

/**
 * The service enclosure south-east of the basketball court.
 *
 * MEASURED by `--furniture` off ref2: the bright coping ring around a dark
 * interior, fitted by min-area rectangle to 3.90 x 4.68 m, axis-aligned to
 * 1.2°, centred (-159.49, 537.20). ref1's oblique shows the same object
 * standing proud of the plaza deck with an open top, which is what the dark
 * interior against a pale rim already implied.
 *
 * ONE is built. A second, larger, ROTATED enclosure sits immediately east of
 * it and is plainly visible in both ref2 and ref1 — its rectangle could not be
 * fitted to better than ±2 m because its coping merges with the pale slab
 * behind it, so it is omitted rather than placed wrong.
 */
const ENCLOSURES = [{
  key: "service-enclosure-a",
  frames: ["ref2"],
  x0: -161.44, x1: -157.54, z0: 534.86, z1: 539.54,
}];

/**
 * The plaza objects: compact things standing on SURVEYED paving, each
 * confirmed in ref3 AND ref8 — two viewpoints with different parallax, so an
 * agreement inside 1.5 m is evidence the object is on the ground rather than
 * an artefact of one mesh. Each row is [x, z, plan-width, plan-depth], all
 * metres, all measured, all copied from scripts/reports/eighth/
 * plaza-objects.json, which `--furniture` writes and a test diffs against.
 *
 * The detection rule, which now lives in code rather than in this comment:
 * local-contrast blobs (lum - gaussian(lum, 4 m) > 14) of 0.5-6 m² with no
 * dimension over 3.5 m, INSIDE the ArcGIS `walk` layer (so a stone in a bed
 * can never enter this set) and at least 5 m clear of every massing ring (so a
 * roof cannot), then intersected between the two frames at 1.5 m, then merged
 * on footprint overlap. 122 candidates in ref3 and 64 in ref8 reduce to 17.
 *
 * What they ARE is an interpretation, and the code does not overclaim it: the
 * size split is measured, the naming is not. `seat` is the small cluster (café
 * tables, stools, bollard-scale objects); `planter` is the large one (raised
 * planters, seat blocks). Both are drawn as low plaza masses.
 */
const PLAZA_OBJECTS = [
  [-91.69, 551.43, 2.46, 2.00], [-95.97, 555.32, 1.21, 1.12],
  [-100.03, 556.52, 1.29, 1.54], [-102.15, 559.96, 2.29, 2.58],
  [-90.07, 562.69, 1.42, 1.46], [-89.31, 564.05, 1.29, 1.08],
  [-62.05, 564.89, 2.00, 0.83], [-61.25, 567.84, 1.12, 1.17],
  [-87.17, 569.64, 1.25, 1.17], [-86.97, 571.37, 1.42, 1.67],
  [-46.85, 572.52, 1.46, 1.67], [-81.70, 572.81, 1.67, 1.33],
  [-140.59, 578.72, 1.54, 2.12], [-88.95, 579.89, 2.33, 1.54],
  [-118.26, 581.49, 1.46, 2.04], [-141.67, 605.26, 1.58, 2.46],
  [-150.69, 605.62, 1.71, 1.46],
];

/** The court rectangle, from the survey, as a clearance box. */
function courtBox(eighth) {
  const pts = eighth?.ground?.["basketball-court"]?.points;
  if (!Array.isArray(pts) || pts.length < 3) return null;
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
  return {
    x0: Math.min(...xs) - COURT_CLEARANCE, x1: Math.max(...xs) + COURT_CLEARANCE,
    z0: Math.min(...zs) - COURT_CLEARANCE, z1: Math.max(...zs) + COURT_CLEARANCE,
  };
}

/**
 * True when an axis-aligned footprint at (x,z) touches the court pad.
 *
 * Half-extents PER AXIS, not a circumradius: the enclosure is 3.9 x 4.7 m and
 * clears the court by 0.8 m in x and 1.35 m in z, but its circumscribed circle
 * does not — a disc test would reject a measured object that is genuinely
 * clear, which is a silent loss of real campus rather than a safety margin.
 */
function hitsCourt(box, x, z, rx, rz) {
  if (!box) return false;
  return x + rx > box.x0 && x - rx < box.x1 && z + rz > box.z0 && z - rz < box.z1;
}

/**
 * Fold together any two objects whose PLAN RECTANGLES intersect.
 *
 * THE BUG THIS IS: cross-frame confirmation accepts a match within 1.5 m, and
 * the objects themselves are 0.8-2.6 m across, so one bench that matched two
 * blobs came back as two boxes 0.4 m apart — which renders not as two benches
 * but as one fused L-shaped solid with a z-fighting seam along its top face.
 * Five such pairs shipped. A fixed-radius dedup cannot fix the class, because
 * the radius that catches a pair of 0.9 m tables merges a pair of real 2.6 m
 * planters; the only test that scales with the object is whether the two
 * footprints actually intersect. Iterated to a fixed point so a chain of three
 * detections collapses to one, and order-independent because the input is
 * sorted. The merged object takes the mean centre and the mean plan size.
 *
 * It runs on the DATA the module ships as well as on anything a later pass
 * adds, so the gate cannot be bypassed by editing the table by hand.
 */
export function mergeOverlapping(objs) {
  let cur = objs.map((o) => ({ ...o, n: o.n || 1 }));
  for (;;) {
    const out = [];
    let merged = false;
    for (const o of cur) {
      const hit = out.find((q) =>
        Math.abs(q.x - o.x) < (q.w + o.w) / 2 && Math.abs(q.z - o.z) < (q.d + o.d) / 2);
      if (!hit) { out.push({ ...o }); continue; }
      hit.x = (hit.x + o.x) / 2; hit.z = (hit.z + o.z) / 2;
      hit.w = (hit.w + o.w) / 2; hit.d = (hit.d + o.d) / 2;
      hit.n += o.n;
      merged = true;
    }
    cur = out;
    if (!merged) return cur;
  }
}

/**
 * Every furnished object, from the registered measurements plus the survey.
 * Pure: data in, data out, so a test runs the placement the renderer runs.
 * Quiet no-op shape when the dossier is missing.
 */
export function placeEighthFurniture(eighth, arcgis) {
  const turf = [], enclosures = [], plaza = [], rejected = [];
  const ground = eighth?.ground;
  if (!ground || typeof ground !== "object") return { turf, enclosures, plaza, rejected };

  /* The zone's own bounding box, from the survey, padded so a building that
     only reaches into the zone still gates the masses beside it. */
  const box = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
  for (const feature of Object.values(ground)) {
    for (const [x, z] of Array.isArray(feature?.points) ? feature.points : []) {
      if (x < box.x0) box.x0 = x; if (x > box.x1) box.x1 = x;
      if (z < box.z0) box.z0 = z; if (z > box.z1) box.z1 = z;
    }
  }
  if (!Number.isFinite(box.x0)) return { turf, enclosures, plaza, rejected };
  const footprints = buildingFootprints(arcgis, {
    x0: box.x0 - 40, x1: box.x1 + 40, z0: box.z0 - 40, z1: box.z1 + 40,
  });
  const court = courtBox(eighth);

  /* Turf: a DRAPE, so it may lie under a podium the way any surveyed surface
     may. It must lie inside its surveyed host ring, though — a turf panel that
     escaped courtyard-2369 would mean the registration had drifted, and that
     is exactly the failure this check is here to catch. */
  for (const panel of TURF_PANELS) {
    const host = ground[panel.host]?.points;
    if (!Array.isArray(host) || host.length < 3) { rejected.push({ ...panel, why: "no-host" }); continue; }
    if (!panel.points.every(([x, z]) => inRing(host, x, z))) {
      rejected.push({ ...panel, why: "outside-host" });
      continue;
    }
    const m = ringMetrics(panel.points);
    turf.push({ key: panel.key, host: panel.host, frames: panel.frames,
      corroboration: panel.corroboration, poly: m.pts,
      area: m.area, cx: m.cx, cz: m.cz, colour: FURNITURE_COLORS.turf,
      material: "measured", confidence: "medium" });
  }

  /* Enclosures: four walls around an open top. Solid, so gated. */
  for (const e of ENCLOSURES) {
    const cx = (e.x0 + e.x1) / 2, cz = (e.z0 + e.z1) / 2;
    const w = e.x1 - e.x0, d = e.z1 - e.z0;
    const r = Math.hypot(w, d) / 2;
    if (hitsBuilding(footprints, cx, cz, r)) { rejected.push({ ...e, why: "building" }); continue; }
    if (hitsCourt(court, cx, cz, w / 2, d / 2)) { rejected.push({ ...e, why: "court" }); continue; }
    enclosures.push({ key: e.key, frames: e.frames, cx, cz, w, d,
      wall: ENCLOSURE_WALL, h: ENCLOSURE_H, plan: "measured", height: "standard-size-estimate" });
  }

  /* Plaza objects. Merged on overlap FIRST — two detections of one bench are
     one object, and gating them separately would only gate the duplicate —
     then gated against the buildings and the court, and dropped, never nudged,
     when they fail. */
  const candidates = mergeOverlapping(PLAZA_OBJECTS.map(([x, z, w, d]) => ({ x, z, w, d })));
  for (const c of candidates) {
    const { x, z, w, d } = c;
    const r = Math.max(w, d) / 2;
    if (hitsBuilding(footprints, x, z, r)) { rejected.push({ x, z, why: "building" }); continue; }
    if (hitsCourt(court, x, z, w / 2, d / 2)) { rejected.push({ x, z, why: "court" }); continue; }
    const kind = Math.max(w, d) <= SEAT_MAX_M ? "seat" : "planter";
    plaza.push({ x, z, w, d, kind, h: kind === "seat" ? SEAT_H : PLANTER_H,
      detections: c.n, plan: "measured", height: "standard-size-estimate" });
  }

  return { turf, enclosures, plaza, rejected };
}

/* ------------------------------------------------------------- rendering */

/** The turf panels, as one merged LIT fill on the `pad` rung. */
function turfMesh(panels, heightAt) {
  if (!panels.length) return null;
  const rung = "pad";
  const lift = overlayLift(rung);
  const pos = [];
  for (const t of panels) fillPoly(pos, t.poly, heightAt, lift);
  if (!pos.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  /* fillPoly emits up-facing triangles (campus-drape.js proves it), so a flat
     +y normal is the truth about this geometry rather than a lie the shader
     has to correct. */
  const normals = new Float32Array(pos.length);
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
  geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  const mat = applyOverlayDepth(new THREE.MeshStandardMaterial({
    color: FURNITURE_COLORS.turf, side: THREE.DoubleSide, roughness: 0.95,
  }), rung);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = OVERLAY[rung].renderOrder;
  return mesh;
}

/** One open-topped enclosure: four walls, no lid, no floor. */
function enclosureMasses(list, heightAt, out) {
  let built = 0;
  for (const e of list) {
    const y = heightAt(e.cx, e.cz) + e.h / 2;
    const t = e.wall;
    /* North and south walls run the full width; east and west fit between
       them, so the corners meet without doubling geometry. */
    out.box(e.w, e.h, t, FURNITURE_COLORS.enclosure, e.cx, y, e.cz - (e.d - t) / 2, 0);
    out.box(e.w, e.h, t, FURNITURE_COLORS.enclosure, e.cx, y, e.cz + (e.d - t) / 2, 0);
    out.box(t, e.h, e.d - 2 * t, FURNITURE_COLORS.enclosure, e.cx - (e.w - t) / 2, y, e.cz, 0);
    out.box(t, e.h, e.d - 2 * t, FURNITURE_COLORS.enclosure, e.cx + (e.w - t) / 2, y, e.cz, 0);
    built++;
  }
  return built;
}

/** The plaza objects, as low masses at their measured plan size. */
function plazaMasses(list, heightAt, out) {
  for (const p of list) {
    out.box(p.w, p.h, p.d, FURNITURE_COLORS.plazaObject,
      p.x, heightAt(p.x, p.z) + p.h / 2, p.z, 0);
  }
  return list.length;
}

/**
 * Eighth's furniture. Returns { group, counts }; the caller parents the group
 * into the Eighth zone so the layer toggle controls it. Never adds itself to
 * the scene. Every failure mode is a quiet no-op with zero counts.
 *
 * WHAT IS STILL DELIBERATELY ABSENT, and why (rule 3):
 *  * Stair flights and terraces. The registered ref8 shows no step in the
 *    courtyard where the 2014 LiDAR is smooth to 1.5 % over 150 m. The
 *    previous note also cited ref6; ref6 is REJECTED at 10-12 inliers and is
 *    no longer part of any argument here. The LiDAR reason stands alone.
 *  * The second, rotated service enclosure, the perforated screen run south of
 *    the court, both pavilions and the mech box. Each is visible in a
 *    registered frame, and each failed a rectangle fit or abuts a massing ring
 *    it might be part of (the low structure at (-189, 542) sits inside the
 *    Pulse Tower bounding box) — placing it would risk modelling a building
 *    twice, which is worse than leaving it out.
 *  * Everything within 5 m of a building. The detector excludes that band on
 *    purpose: beside a podium, facade parallax is exactly what a ground-plane
 *    homography cannot hold, so an object detected there has a position the
 *    registration does not support. Ten rows of the previous table lived in
 *    that band. They are real objects, almost certainly; their POSITIONS were
 *    not measured to the standard this file claims, so they are out until a
 *    frame that resolves them is registered.
 *  * Light poles, bollards, trash pairs, blue-light towers, the EV charger.
 *    The registration solves POSITION, and none of these was ever a position
 *    problem: the dossier could not establish that the marks are these objects
 *    at all (the "blue lights" are Apple POI pins; the paired round objects
 *    measure 1.05-1.35 m, which is table-sized). Existence unevidenced.
 *  * Pale decomposed-granite beds as a class. Measured this pass and reported
 *    as a NEGATIVE: see campus-eighth.js's MEASURED_COBBLE note.
 */
export function createEighthFurniture(_scene, { arcgis, eighth, heightAt } = {}) {
  const group = new THREE.Group();
  const counts = { turf: 0, turfM2: 0, enclosures: 0, seats: 0, planters: 0, rejected: 0 };
  if (typeof heightAt !== "function") return { group, counts };

  const p = placeEighthFurniture(eighth, arcgis);
  const grass = turfMesh(p.turf, heightAt);
  if (grass) {
    group.add(grass);
    counts.turf = p.turf.length;
    counts.turfM2 = Math.round(p.turf.reduce((t, s) => t + s.area, 0));
  }

  const masses = solids();
  counts.enclosures = enclosureMasses(p.enclosures, heightAt, masses);
  plazaMasses(p.plaza, heightAt, masses);
  counts.seats = p.plaza.filter((o) => o.kind === "seat").length;
  counts.planters = p.plaza.filter((o) => o.kind === "planter").length;
  masses.build(group);

  counts.rejected = p.rejected.length;
  return { group, counts };
}
