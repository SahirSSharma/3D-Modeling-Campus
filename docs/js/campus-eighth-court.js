// The Eighth College basketball court, line for line.
//
// WHAT IS MEASURED, AND FROM WHAT
// -------------------------------
// The painted rectangle is SURVEY, not pixels: it is the union of the two
// arcgis court polygons #3898 (east half) + #3923 (west half), stored as
// ground["basketball-court"].points in docs/data/campus-eighth.json — already
// in local metres. 22.7 m long x 15.4 m wide, centre (-174.55, 525.20), long
// axis east-west. The 15.4 m width is regulation (15.24 m); the 22.7 m length
// is 79 % of a 28.65 m full court, so this is a SHORTENED recreational court
// and is built as one. Nothing below is hardcoded in world coordinates: the
// whole marking set is laid out in the court's own (u along length, v across
// width) frame and mapped onto whatever rectangle the survey gives, so a
// survey rebuild carries straight through.
//
// The marking DIMENSIONS are NFHS spec values that surveyed polygons
// independently confirm to a few centimetres:
//   lane 3.66 x 5.79 m   <- #3924 measures 5.9 x 3.7 m, #3903 5.8 x 3.7 m
//   free-throw R 1.83 m  <- #3921 and #3785, each 1.8-1.9 x 3.6-3.7 m
//   centre  R 1.83 m     <- #3806 + #3918, two digitised half-circles meeting
//                           at x -174.5, the court's own centre to 0.05 m
//   3-pt    R 6.02 m about a basket centre 1.575 m inboard of each baseline
//                        <- least-squares circle fits, rms 0.017-0.022 m
// The corner straights are DERIVED — (15.4/2) - 6.02 = 1.68 m off each
// sideline — not taken as the observer's 1.60 m, which assumed a regulation
// 15.24 m width and would leave the arc not meeting the straight.
//
// COLOURS come from Apple Maps 3D frames ref9 and ref2 (epoch-valid; the
// Google chunks over Eighth are mid-construction and are never used here).
// They arrive from campus-eighth.js's EIGHTH_COLORS table rather than being
// redeclared, so there is one measured table for the zone.
//
// WHAT IS DELIBERATELY NOT DRAWN
//  * No apron ring. Only the NORTH side has pale concrete (2.2 m, terminating
//    at arcgis #1761); south/east/west abut the dark plaza deck with no
//    transitional band. campus-eighth.js builds that one north walk.
//  * No fence, kerb, netting posts or bollards — the paint runs flush into
//    the paving on all four edges and no frame shows a post shadow.
//  * No sideline wordmarks. Their bar geometry is measured but the letterforms
//    are illegible at every available resolution; a measured bar renders as a
//    paint blob and invented text would fabricate a sponsor.
//  * No second trident in the key. Re-examined at 200 px/m on the rectified
//    plan (.cache/eighth-ground/trident/key-near-south.png,
//    key-far-north.png): the pale shape inside ref9's NEAR key is a
//    photogrammetric mesh flap, not paint. It has hard straight quad edges and
//    a sawtooth upper margin, it OCCLUDES the painted lane line and crosses the
//    baseline (paint cannot cover paint), it sits exactly under the hoop, and
//    the FAR key — same court, same frame — is plain olive. ref2's near-nadir
//    plan shows one mark on the court, the centre trident. Still out.
//  * The near (inside-lane) half of each free-throw circle: absent in the
//    references at 120 px/m, neither solid nor dashed.
//
// NOTE ON commit 9a324c4. That commit withheld an Eighth court from
// docs/data/campus-markings.json, and the reason does not apply here: the
// markings file is FITTED to the georeferenced Google satellite chunks, which
// over Eighth are a pre-completion construction site, and its whiteness scorer
// matched a court-shaped false positive in the dirt. This module takes its
// rectangle from the ArcGIS survey and its marking dimensions from NFHS values
// that four more surveyed polygons confirm — no imagery fit anywhere in the
// chain — and the court is photo-confirmed present in the Apple frames. The
// standing instruction from that commit also holds: these markings must NOT be
// written back into the generated markings file.
import * as THREE from "../vendor/three/three.module.min.js";
import { OVERLAY, overlayLift, applyOverlayDepth } from "./campus-overlay.js";
import { fillPoly, ribbon } from "./campus-drape.js";

/* Painted-line half-width. 0.06 m stroke is a DECLARED ASSUMPTION: the
   measured 0.18-0.20 m FWHM is instrument-limited (ref9 samples at 0.049 m/px
   and the mesh adds 2-3 px of blur, so any true stroke from 0.05 to 0.12 m
   measures the same), and 0.06 m matches the 0.08 m family the campus
   markings already use. Building the measured 0.20 m would be 3x too fat. */
export const STROKE_M = 0.06;

/* NFHS geometry, all confirmed by a surveyed polygon (see the header). */
const LANE_W = 3.66, LANE_D = 5.79, FT_R = 1.83, CENTRE_R = 1.83;
const THREE_R = 6.02, BASKET_IN = 1.575;
/* Lane-space marks: [distance from baseline, length along u, depth out in v]. */
const LANE_MARKS = [[2.30, 0.40, 0.28], [3.40, 0.08, 0.20], [4.35, 0.08, 0.20]];

/* ------------------------------------------------- the centre trident
 *
 * HOW IT WAS MEASURED. ref9 is oblique, so no dimension was read off raw
 * pixels. The court's painted rectangle IS the calibration object: a plane
 * homography was fitted from ref9 to the surveyed 22.7 m x 15.4 m rectangle by
 * maximising the response of the full marking model (boundary, halfcourt line,
 * centre circle, both lanes, both free-throw arcs, both 3-point lines) against
 * a ridge-filtered ref9. The fit is checked, not asserted: through it the
 * centre circle comes back round with radius 1.82 m against its NFHS 1.83, and
 * both 3-point arcs and the halfcourt line land on their paint
 * (.cache/eighth-ground/trident/overlay-check.png). Calibration in the
 * trident's own neighbourhood is therefore ~0.01 m/m.
 *
 * ref9 was then RESAMPLED THROUGH THAT HOMOGRAPHY to a true plan view at
 * 100 px/m, i.e. 0.01 m/px, and the mark segmented by threshold + morphological
 * reconstruction (.cache/eighth-ground/trident/rect-centre.png). Every figure
 * below is a span read off that rectified raster, re-sampled at 200 px/m in the
 * mark's own frame; the raster's own blur is ~0.02 m, which is the honest
 * precision of every number here.
 *
 * WHAT CAME BACK. The mark's own axis and centre were solved, not assumed, by
 * minimising the left-right asymmetry of the segmented mask over (bearing,
 * centre): the minimum is sharp at 45.00 deg to the court's long axis (+-0.3
 * deg at 2x the residual) and at the court's exact centre (< 0.01 m). Rotated
 * into that frame the blob is unmistakably a trident
 * (.cache/eighth-ground/trident/axis-mask-grid.png): a spearhead centre tine, a
 * waisted shaft, two outer tines with an inward barb, a crossbar with pointed
 * ends, and a parallel stem below it. Overall 4.06 m along its own axis by
 * 2.69 m across — LONGER THAN THE CENTRE CIRCLE IS WIDE (3.66 m), so it
 * overflows the circle along its axis, which is what the reference shows.
 *
 * WHY PARAMETRIC. The rings below are emitted from the named dimensions by
 * tridentRings(), so every vertex traces back to a measured span rather than
 * being a hand-typed outline nobody can audit. The previous build reused Muir
 * Field's 32-vertex outline scaled to 4.05 m; at Eighth's scale that renders as
 * a blob, and it was never Eighth's mark. Muir's outline and
 * docs/data/campus-markings.json are untouched.
 *
 * The mark frame is (a, b): `a` runs along the mark's own axis toward the
 * tines, `b` across it, origin at the mark's centre. All metres.
 */
const TRIDENT_DEG = 45.0;     // bearing off the court's long axis; symmetry fit
const TRIDENT_LEN = 4.06;     // a from -1.94 (stem end) to +2.12 (spear tip)
const TRIDENT_WIDTH = 2.686;  // raw b -1.325..+1.360, symmetrised to +-1.343

/* Centre tine and shaft. */
const SPEAR_TIP_A = 2.12;         // a of the point
const SPEAR_HALF_W = 0.575;       // widest half-span of the head
const SPEAR_SHOULDER_A = 0.875;   // a where that widest span sits
const SPEAR_TAPER_EXP = 0.88;     // side profile half-w ~ t^0.88 (1.0 = straight)
const SPEAR_BARB_A = 0.785;       // the head's barbs point slightly DOWN-out
const SPEAR_BARB_HALF_W = 0.545;
const SPEAR_NECK_A = 0.815;       // undercut returns to the shaft here
const SPEAR_NECK_HALF_W = 0.315;
const SHAFT_TOP_HALF_W = 0.300;   // at a = +0.80
const SHAFT_TOP_A = 0.80;
const SHAFT_WAIST_HALF_W = 0.240; // the shaft is measurably waisted at a = 0
const SHAFT_BASE_HALF_W = 0.295;  // at a = -0.55, entering the crossbar
const SHAFT_BASE_A = -0.55;
const STEM_HALF_W = 0.235;        // below the bar the shaft runs PARALLEL, not tapered
const STEM_TOP_A = -1.14;
const STEM_TAPER_A = -1.84;       // and only rounds off over the last 0.10 m
const STEM_END_A = -1.94;

/* Crossbar: a shallow trapezoid with a downward point at each end. */
const BAR_TOP_A = -0.56, BAR_HALF_LEN_TOP = 1.015;
const BAR_BOT_A = -1.00, BAR_END_A = -0.985, BAR_HALF_LEN_BOT = 0.930;
const BAR_TAB_TIP_A = -1.115, BAR_TAB_TIP_B = 0.820, BAR_TAB_INNER_B = 0.630;

/* Outer tines. The outer edge is straight to 0.012 m of its chord over its
   whole 1.25 m run — below the raster's own blur — so it is built straight. */
const TINE_TIP_A = 0.785, TINE_TIP_B = 1.270;
const TINE_OUTER_MAX_A = 0.685, TINE_OUTER_MAX_B = 1.343;
const TINE_OUTER_ROOT_B = 1.015;  // where the outer edge meets BAR_TOP_A
const TINE_KNEE_A = 0.05, TINE_KNEE_B = 0.465;   // inner edge is straight above here
const TINE_BARB_A = -0.02, TINE_BARB_B = 0.430;  // the inward hook
const TINE_HAUNCH_A = -0.205, TINE_HAUNCH_B = 0.650;
const TINE_INNER_ROOT_B = 0.540;  // at BAR_TOP_A

/* Falsification window on the ASSEMBLED outline, derived from the two overall
   measurements above rather than typed a second time: +-0.03 m is the rectified
   raster's own blur, so a drifted dimension fails here and measurement noise
   does not. `placeTrident` re-measures what tridentRings() actually emitted and
   skips the mark rather than drawing a degenerate one. */
const TRIDENT_TOL = 0.03;
const TRIDENT_LEN_OK = [TRIDENT_LEN - TRIDENT_TOL, TRIDENT_LEN + TRIDENT_TOL];
const TRIDENT_WIDTH_OK = [TRIDENT_WIDTH - TRIDENT_TOL, TRIDENT_WIDTH + TRIDENT_TOL];

/**
 * The oriented frame of a surveyed ring: centre, unit long axis, unit short
 * axis, and the two extents. PCA rather than a bounding box, so a rotated
 * survey polygon still yields the court's own axes.
 */
export function orientedFrame(points) {
  const pts = points.length > 2 &&
    points[0][0] === points[points.length - 1][0] &&
    points[0][1] === points[points.length - 1][1]
    ? points.slice(0, -1) : points;
  const n = pts.length;
  if (n < 3) return null;
  const cx = pts.reduce((s, p) => s + p[0], 0) / n;
  const cz = pts.reduce((s, p) => s + p[1], 0) / n;
  let sxx = 0, szz = 0, sxz = 0;
  for (const [x, z] of pts) { const dx = x - cx, dz = z - cz; sxx += dx * dx; szz += dz * dz; sxz += dx * dz; }
  const th = 0.5 * Math.atan2(2 * sxz, sxx - szz);
  let ea = [Math.cos(th), Math.sin(th)];
  let eb = [-ea[1], ea[0]];
  const span = (e) => {
    const t = pts.map(([x, z]) => (x - cx) * e[0] + (z - cz) * e[1]);
    return [Math.min(...t), Math.max(...t)];
  };
  let [a0, a1] = span(ea), [b0, b1] = span(eb);
  if (a1 - a0 < b1 - b0) { [ea, eb] = [eb, ea]; [a0, a1, b0, b1] = [b0, b1, a0, a1]; }
  /* Centre on the extents, not on the vertex average — a ring with uneven
     vertex density would otherwise pull the centre off the true middle. */
  return {
    cx: cx + ea[0] * (a0 + a1) / 2 + eb[0] * (b0 + b1) / 2,
    cz: cz + ea[1] * (a0 + a1) / 2 + eb[1] * (b0 + b1) / 2,
    ex: ea, ez: eb, length: a1 - a0, width: b1 - b0,
  };
}

/** Sample an arc in the local frame: centre (cu,cv), radius r, angles in rad. */
function arcPts(cu, cv, r, a0, a1, segs) {
  const out = [];
  for (let i = 0; i <= segs; i++) {
    const a = a0 + (a1 - a0) * (i / segs);
    out.push([cu + r * Math.cos(a), cv + r * Math.sin(a)]);
  }
  return out;
}

/**
 * The whole court, PURE: a surveyed ring in, world-space geometry out. The
 * renderer draws exactly this, so a test can check the paint without a canvas.
 * Returns null when the ring is missing or is not court-shaped.
 */
export function placeEighthCourt(points) {
  const f = orientedFrame(points || []);
  if (!f) return null;
  const L = f.length, W = f.width;
  /* A shortened rec court, but still a court: refuse anything that is not one
     rather than laying a full marking set onto the wrong polygon. */
  if (L < 15 || L > 40 || W < 10 || W > 25 || L < W) return null;

  const P = (u, v) => [f.cx + u * f.ex[0] + v * f.ez[0], f.cz + u * f.ex[1] + v * f.ez[1]];
  const poly = (pts) => pts.map(([u, v]) => P(u, v));
  const hl = L / 2, hw = W / 2, lane = LANE_W / 2;

  const surface = poly([[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]]);
  const lines = [];
  const blocks = [];
  const keys = [];

  /* Boundary. */
  lines.push({ name: "boundary", pts: poly([[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw], [-hl, -hw]]) });

  /* Halfcourt line, interrupted inside the centre circle. */
  lines.push({ name: "halfcourt-a", pts: poly([[0, -hw], [0, -CENTRE_R]]) });
  lines.push({ name: "halfcourt-b", pts: poly([[0, CENTRE_R], [0, hw]]) });
  lines.push({ name: "centre-circle", pts: poly(arcPts(0, 0, CENTRE_R, 0, Math.PI * 2, 64)) });

  for (const s of [1, -1]) {           // s = +1 east end, -1 west end
    const base = s * hl;               // baseline
    const ftU = s * (hl - LANE_D);     // free-throw line
    const bU = s * (hl - BASKET_IN);   // basket centre

    /* The lane, filled, plus its three painted sides (the fourth is the
       baseline, already drawn by the boundary). */
    keys.push(poly([[base, -lane], [ftU, -lane], [ftU, lane], [base, lane]]));
    lines.push({ name: `lane-${s}`, pts: poly([[base, -lane], [ftU, -lane], [ftU, lane], [base, lane]]) });

    /* Free-throw circle: the FAR half only — the half on the navy, away from
       the baseline. The near half over the olive lane is genuinely absent. */
    const far = s > 0 ? [Math.PI / 2, Math.PI * 1.5] : [-Math.PI / 2, Math.PI / 2];
    lines.push({ name: `ft-circle-${s}`, pts: poly(arcPts(ftU, 0, FT_R, far[0], far[1], 48)) });

    /* Three-point line: corner straight, arc, corner straight, as one run.
       The corner offset is DERIVED — hw - THREE_R = 1.68 m off each sideline
       at our surveyed 15.4 m width — which puts the straights at exactly the
       arc's own |v| at its tangent point, so the two always meet. Sweeping
       the half that bends INTO the court (through u = bU -/+ THREE_R). */
    const cornerV = THREE_R; // i.e. hw - THREE_R = 1.68 m inboard of the sideline
    const sweep = s > 0 ? [-Math.PI / 2, -Math.PI * 1.5] : [-Math.PI / 2, Math.PI / 2];
    lines.push({
      name: `three-point-${s}`,
      pts: poly([
        [base, -cornerV],
        ...arcPts(bU, 0, THREE_R, sweep[0], sweep[1], 96),
        [base, cornerV],
      ]),
    });

    /* Lane-space marks: solid blocks outside the lane, on the navy. */
    for (const side of [1, -1]) {
      for (const [d, len, out] of LANE_MARKS) {
        const u0 = base - s * (d - len / 2), u1 = base - s * (d + len / 2);
        const v0 = side * lane, v1 = side * (lane + out);
        blocks.push(poly([[u0, v0], [u1, v0], [u1, v1], [u0, v1]]));
      }
    }
  }

  /* Both hoops, at the fitted 3-point arc centres. `rot` faces court centre,
     matching campus-recreation.js's convention: (sin rot, cos rot) points the
     way the backboard looks. */
  const hoops = [1, -1].map((s) => {
    const p = P(s * (hl - BASKET_IN), 0);
    return { x: p[0], z: p[1], rot: Math.atan2(-s * f.ex[0], -s * f.ex[1]) };
  });

  return { frame: f, surface, keys, lines, blocks, hoops, logo: placeTrident(P) };
}

/**
 * The trident's outline in its own (a, b) frame: THREE rings, emitted from the
 * named measured dimensions above. Separate rings rather than one contour
 * because the mark genuinely is three overlapping fills — the outer tines
 * stand clear of the shaft, and fillPoly wants one simple ring at a time.
 *
 * PURE and data-free, so a test can hold the outline to the measurements
 * without a court, a scene or a canvas.
 */
const extent = (vals) => Math.max(...vals) - Math.min(...vals);

export function tridentRings() {
  const mirror = (ring) => ring.map(([b, a]) => [-b, a]);
  const rev = (ring) => ring.slice().reverse();

  /* Centre tine + shaft + stem, one mirror-symmetric ring. The head's side is
     sampled from the taper law rather than listed, so SPEAR_TAPER_EXP is the
     thing under test and not a frozen vertex list. */
  const headSide = [];
  for (let i = 1; i < 12; i++) {
    const t = i / 12;                                   // 0 at the tip, 1 at the shoulder
    const a = SPEAR_TIP_A - t * (SPEAR_TIP_A - SPEAR_SHOULDER_A);
    headSide.push([SPEAR_HALF_W * Math.pow(t, SPEAR_TAPER_EXP), a]);
  }
  /* Stem cap: a quarter ellipse over the last (STEM_TAPER_A - STEM_END_A). */
  const cap = [];
  for (let i = 1; i < 6; i++) {
    const t = i / 6;
    cap.push([
      STEM_HALF_W * Math.sqrt(Math.max(0, 1 - t * t)),
      STEM_TAPER_A - t * (STEM_TAPER_A - STEM_END_A),
    ]);
  }
  const spineRight = [
    ...rev(cap),                                        // stem end -> full width
    [STEM_HALF_W, STEM_TOP_A],
    [SHAFT_BASE_HALF_W, SHAFT_BASE_A],
    [SHAFT_WAIST_HALF_W, 0],
    [SHAFT_TOP_HALF_W, SHAFT_TOP_A],
    [SPEAR_NECK_HALF_W, SPEAR_NECK_A],
    [SPEAR_BARB_HALF_W, SPEAR_BARB_A],
    [SPEAR_HALF_W, SPEAR_SHOULDER_A],
    ...rev(headSide),
  ];
  const spine = [
    [0, STEM_END_A],
    ...spineRight,
    [0, SPEAR_TIP_A],
    ...rev(mirror(spineRight)),
  ];

  const barRight = [
    [BAR_HALF_LEN_TOP, BAR_TOP_A],
    [BAR_HALF_LEN_BOT, BAR_END_A],
    [BAR_TAB_TIP_B, BAR_TAB_TIP_A],
    [BAR_TAB_INNER_B, BAR_BOT_A],
  ];
  const bar = [...mirror(rev(barRight)), ...barRight];

  const tineRight = [
    [TINE_TIP_B, TINE_TIP_A],
    [TINE_OUTER_MAX_B, TINE_OUTER_MAX_A],
    [TINE_OUTER_ROOT_B, BAR_TOP_A],
    [TINE_INNER_ROOT_B, BAR_TOP_A],
    [TINE_HAUNCH_B, TINE_HAUNCH_A],
    [TINE_BARB_B, TINE_BARB_A],
    [TINE_KNEE_B, TINE_KNEE_A],
  ];
  return [spine, bar, tineRight, rev(mirror(tineRight))];
}

/**
 * The centre trident, placed. `P(u, v)` is the court's own frame-to-world map,
 * so the mark rides whatever rectangle the survey gives: rings are emitted in
 * the mark frame, rotated by the measured TRIDENT_DEG, and dropped on the court
 * centre, which is where the symmetry fit put it.
 *
 * FALSIFICATION GATE: the assembled rings are re-measured here, and if their
 * own-axis or cross-axis extent leaves the measured window — the way a
 * degenerate or drifted dimension set would — the mark is skipped rather than
 * drawn wrong.
 */
export function placeTrident(P) {
  const rings = tridentRings();
  const flat = rings.flat();
  const rad = (TRIDENT_DEG * Math.PI) / 180;
  /* WHICH DIAGONAL. At 45 deg there are four candidate directions and ref9's
     own image axes do not name any of them, so the sign is REGISTERED, not
     guessed. ref9 is a rotated view: the court's long axis is world east-west
     but stands vertical in the frame, and the 2.2 m concrete walk plus hedge
     #1761 — which campus-eighth.js derives on the court's MINIMUM-z side, i.e.
     north — lie to the frame's RIGHT. So in ref9 north is right and east is
     down, which a 90 deg clockwise rotation of a top-down render reproduces
     feature for feature (.cache/eighth-ground/trident/render-rot90cw.png
     against ref9). ref9's tines point up-left in frame = west + south. That is
     -ex, +ez here, and the first build of this mark had the ez sign inverted
     and rendered the trident mirrored about the court's long axis. */
  const T = [-Math.cos(rad), Math.sin(rad)];
  /* The mark is symmetric about its own axis, so C's sign is free. */
  const C = [-T[1], T[0]];

  const len = extent(flat.map(([, a]) => a));
  const wid = extent(flat.map(([b]) => b));
  if (len < TRIDENT_LEN_OK[0] || len > TRIDENT_LEN_OK[1]) return null;
  if (wid < TRIDENT_WIDTH_OK[0] || wid > TRIDENT_WIDTH_OK[1]) return null;

  const polys = rings.map((ring) =>
    ring.map(([b, a]) => P(a * T[0] + b * C[0], a * T[1] + b * C[1])));
  return { polys, ownAxisM: len, crossM: wid, bearingDeg: TRIDENT_DEG };
}

/* ------------------------------------------------------------- rendering */

/** One merged, decal-stacked, unlit fill on a rung. */
function fillMesh(polys, colour, heightAt, rung) {
  const pos = [];
  for (const p of polys) fillPoly(pos, p, heightAt, overlayLift(rung));
  if (!pos.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  const mat = applyOverlayDepth(
    new THREE.MeshBasicMaterial({ color: colour, side: THREE.DoubleSide }), rung
  );
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = OVERLAY[rung].renderOrder;
  return mesh;
}

/** All the linework, as ribbons of the measured stroke width, on `paint`. */
function paintMesh(lines, colour, heightAt) {
  const rung = "paint";
  const pos = [];
  for (const l of lines) ribbon(pos, l.pts, STROKE_M / 2, heightAt, overlayLift(rung));
  if (!pos.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  const mat = applyOverlayDepth(
    new THREE.MeshBasicMaterial({ color: colour, side: THREE.DoubleSide }), rung
  );
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = OVERLAY[rung].renderOrder;
  return mesh;
}

/* Every caller is hoop hardware — pole, arm, backboard, ring — so one painted
   metal response covers them all. */
const lambert = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.65 });

/**
 * The court: surface, lanes, every marking, the trident, both hoops.
 *
 * TONE: NONE, and that is the point. Until 2026-08-19 the navy, the lanes and
 * the trident were shadowed Apple photogrammetry reads drawn UNLIT, so they
 * were routed through sceneTone at a solved strength to land on a calibrated
 * 1.7x lift — otherwise the court read as a black splat beside the lit ground
 * campus-world.js brightens. Arbitration replaced all three with SUNLIT
 * ALBEDOS measured off SWA image 16 by ratio to the court's own white
 * linework. A sunlit albedo must not be lifted a second time: at the old 1.7x
 * ratio the new navy renders at luma 124 and the new gold clips to white. All
 * four court colours are therefore drawn as they are stored, and tonedToLift,
 * TONE_RATIO and luma601 have gone with the tone.
 */
export function createEighthCourt(parent, { points, colors, heightAt } = {}) {
  const counts = { courtSurface: 0, keys: 0, lines: 0, laneMarks: 0, trident: 0, hoops: 0 };
  const c = placeEighthCourt(points);
  if (!c || typeof heightAt !== "function") return { placement: null, counts };

  const add = (m) => { if (m) parent.add(m); };
  add(fillMesh([c.surface], colors.courtSurface, heightAt, "pad"));
  counts.courtSurface = 1;
  add(fillMesh(c.keys, colors.courtKey, heightAt, "carpet"));
  counts.keys = c.keys.length;
  /* Lane-space marks are solid paint, not strokes, so they fill on `paint`
     alongside the linework rather than being stroked as outlines. */
  add(fillMesh(c.blocks, colors.courtLine, heightAt, "paint"));
  counts.laneMarks = c.blocks.length;
  add(paintMesh(c.lines, colors.courtLine, heightAt));
  counts.lines = c.lines.length;
  if (c.logo) {
    add(fillMesh(c.logo.polys, colors.courtLogo, heightAt, "logo"));
    counts.trident = 1;
  }

  /* Hoop assemblies. Only the plan anchor is measured; every dimension below
     is SPEC, and is deliberately campus-recreation.js's Muir assembly verbatim
     (3.95 m pole set back 1.9 m, 1.5 m arm, 1.83 x 1.07 m backboard whose
     front face is 0.375 m out, 0.225 m ring at 3.05 m) so Eighth's hoops are
     the same object rather than a second invented geometry — including its
     spacing, which is what keeps the arm from coming out the front of the
     board and the ring's rear arc off it. Nothing in the nine frames resolves
     a backboard, a rim or a pole. The net is likewise spec, not measurement. */
  const back = (h, d) => ({ x: h.x - Math.sin(h.rot) * d, z: h.z - Math.cos(h.rot) * d });
  for (const h of c.hoops) {
    const y = heightAt(h.x, h.z);
    const pole = back(h, 1.9);
    const mk = (geo, mat, x, yy, z, rot) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, yy, z);
      if (rot) m.rotation.y = rot;
      parent.add(m);
    };
    mk(new THREE.CylinderGeometry(0.085, 0.11, 3.95, 8), lambert(colors.steel),
      pole.x, y + 1.97, pole.z, h.rot);
    const arm = back(h, 1.15);
    mk(new THREE.BoxGeometry(0.12, 0.12, 1.5), lambert(colors.steel), arm.x, y + 3.5, arm.z, h.rot);
    const bb = back(h, 0.405);
    mk(new THREE.BoxGeometry(1.83, 1.07, 0.06), lambert(colors.backboard), bb.x, y + 3.4, bb.z, h.rot);
    const ring = new THREE.TorusGeometry(0.225, 0.022, 6, 16);
    ring.rotateX(-Math.PI / 2);
    mk(ring, lambert(colors.ring), h.x, y + 3.05, h.z, 0);
    const net = new THREE.CylinderGeometry(0.225, 0.13, 0.4, 12, 1, true);
    mk(net, new THREE.MeshStandardMaterial({
      color: colors.net, side: THREE.DoubleSide, transparent: true, opacity: 0.55,
      roughness: 0.85,
    }), h.x, y + 2.85, h.z, 0);
    counts.hoops++;
  }

  return { placement: c, counts };
}
