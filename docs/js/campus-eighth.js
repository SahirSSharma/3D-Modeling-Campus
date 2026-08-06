// Eighth College's ground plane, off the construction-epoch tan.
//
// WHAT THIS FIXES. campus-world.js tints every surveyed ground polygon from
// the Google satellite chunks, and those chunks over Eighth are a PRE-
// COMPLETION CONSTRUCTION SITE (repo rule 1). 67 of the 71 green polygons
// inside the Eighth footprint therefore sample as bare dirt and land on the
// bark-duff base, and the basketball court samples tan — so today the college
// renders as roughly 11,000 m² of construction dirt. This module OVERPAINTS
// that on the `pad` rung of campus-overlay.js's decal ladder, which is what
// the ladder is for: campus-world.js is untouched, and if this module fails to
// load the campus degrades to today's render rather than to a hole.
//
// WHAT IS MEASURED, AND FROM WHAT. Every polygon is SURVEY — the 74 features
// in docs/data/campus-eighth.json ground{}, each registered to a
// docs/data/campus-arcgis.json ground[] ring and already converted to local
// metres — plus TWO ArcGIS rings the dossier missed (#1160 the big dry lawn,
// #1761 the north hedge strip). A third, #1127, was identified and WITHHELD
// for lack of a colour; see the omissions below. Nothing is traced off pixels. Every COLOUR is
// sampled from Apple Maps 3D frames, which are epoch-valid; the Google chunks
// are never a colour source here. Classification is by the dossier's own
// `kind` plus one geometric rule (effective width 4·area/perimeter ≥ 6 m
// splits walkway junction nodes from branch runs); both are the same pale
// concrete, so the split changes nothing visually and is kept only because it
// is the honest description of the two rôles.
//
// WHAT IS DELIBERATELY OMITTED, and why (rule 3 — better absent than wrong):
//  * The angular concrete plate mosaic that is the courtyard's visual
//    signature. It is real, but it has neither per-plate geometry (Apple's
//    mesh softens the joints below traceability) nor a registered extent — the
//    `courtyard-*` polygons are the survey's GREEN layer, not hardscape, so
//    they do not bound it. §4.4's honest weak form is built instead: the same
//    world-aligned scoring campus-world.js gives its paving, rotated 30° about
//    each polygon's centroid, which is the observed joint angle range. No
//    invented plate outlines, no claim about plate count.
//  * Stair flights, terraces, retaining and seat walls. Two independent
//    reasons: the references do not resolve treads (the mesh smears the
//    nosings into a ramp), and the 2014 LiDAR under the courtyard is smooth to
//    1.5 % over 150 m with no step anywhere, so there is no built grade for a
//    flight to descend or a wall to retain.
//  * The pale decomposed-granite beds as a class. The material is proven; the
//    mapping to polygon IDs was attempted this pass and came back NEGATIVE —
//    see MEASURED_COBBLE below, which also converts 13 beds from inherited to
//    measured and shrinks the periphery's known error accordingly.
//  * What STANDS on this ground now lives in campus-eighth-furniture.js: the
//    ref2 rectification that module's header documents is the pass this
//    omission list used to be waiting on, and it builds the turf panel, the
//    service enclosure and 17 plaza objects it registers. What is still absent
//    after it, and why, is listed at that module's createEighthFurniture.
//  * New trees. The footprint already carries 45 LiDAR canopies; the
//    references show a different, later generation. Adding unregistered ones
//    would double-plant. The correct tree work here is subtractive.
//  * ArcGIS #1127, the south-western slope (1,985 m², centroid -191, 689 —
//    mostly SOUTH of the surveyed envelope, which ends at z 681). It is on
//    construction-epoch tan and should be corrected, but no frame gives it a
//    colour — assigning one would be a silent guess.
//  * Nine more ArcGIS ground rings — 1,149 m² — whose centroids DO fall inside
//    the surveyed envelope and which no dossier feature registers, so they
//    stay on whatever campus-world.js sampled: 6 `green` (779 m²), 2 `walk`
//    (248 m²), 1 `road` (123 m²). The largest two are what a viewer actually
//    sees: #2374 (252 m², x -202.7..-191.2, z 514.6..537.4) is the pale
//    salmon slab immediately WEST of the basketball court, in frame for the
//    court's own close-up, and #1161 (334 m²) sits east of it. Their colours
//    were never measured — the nine Apple frames are all framed on the
//    courtyard and the court, and none of them resolves this ground — so they
//    are counted and named rather than painted. `placeEighth` returns the list
//    as `uncorrected` and `createEighth` reports it as counts.uncorrected /
//    counts.uncorrectedM2, so the residual error is a number this module
//    states rather than one a reviewer has to rediscover from a screenshot.
//    (A previous review attributed the salmon slab to #1127; measured, it is
//    #2374 — #1127 is 24 m further south and out of that frame entirely.)
//
// The periphery carries a KNOWN, BOUNDED error: two bed materials exist (dark
// cobble in the core, pale decomposed granite on the periphery) and the
// material-to-polygon mapping was never performed. Everything outside the core
// envelope that takes the cobble hex is marked `inherited` — 26 surfaces,
// 1,782 m², across all THREE classes that take it (20 cobble beds, 3
// courtyard-landscape, 3 hedge strips), not just the beds. That is a choice,
// not an oversight — leaving them alone leaves them on construction tan, which
// is certainly wrong, where cobble is wrong only for some unknown subset. The
// total is reported as counts.inherited / counts.inheritedM2 so the bounded
// error is a number, not a field nothing reads.
//
// placeEighth() is pure data in, data out, so a test runs the exact placement
// the renderer uses. Nothing here calls Math.random: the boulders use the same
// deterministic position hash campus-species.js and campus-massing.js use, so
// a stone keeps its size and its place on every visit.
import * as THREE from "../vendor/three/three.module.min.js";
import { OVERLAY, overlayLift, applyOverlayDepth } from "./campus-overlay.js";
import { fillPoly, solids } from "./campus-drape.js";
import { createEighthCourt, orientedFrame } from "./campus-eighth-court.js";

/* One hex per class, each naming the frame it was sampled from. Apple Maps 3D
   only. Refs 1/2/8/9 are deep blue-cast shadow, so sunlit reads win. */
export const EIGHTH_COLORS = {
  plazaConcrete: "#ded7cb", // ref7, sunlit — walkways, nodes, the north court walk
  cobbleBed: "#8e8b82",     // ref3 — the dark bed matrix; ratio-test confirmed at 0.60x paving
  boulder: "#c9c4b8",       // ref3 — the highlight stones proud of the bed
  dryLawn: "#ab9d83",       // ref3, the only clean unshaded read — tan in FULL SUN, never green
  hedge: "#4c6236",         // ref9, shadow-cast — lit Lambert, never pre-brightened by hand
  courtSurface: "#141727",  // ref9 + ref2, agreeing to 2 RGB counts — the navy inside the lines
  courtKey: "#2f372f",      // ref9 + ref2 — the lanes are OLIVE/khaki, not UCSD gold
  courtLine: "#e8eef2",     // ref9 — all white linework
  /* courtLogo is a MEASUREMENT, not a guess: the median of the 24,470
     rectified pixels inside an eroded mask of the centre trident in ref9
     (.cache/eighth-ground/trident/rect-centre.png) is #576564 — a pale sage
     bone, warmer and markedly less blue than the white linework beside it.
     The frame is trusted at face value here because the same frame's court
     navy medians #15192b against this table's #141727, two RGB counts apart,
     so raw ref9 IS this table's colour space for a broad fill. Being a broad
     unlit fill it goes through the module's tonedToLift like the navy and the
     keys, which preserves the 3.7x contrast measured between mark and navy;
     the thin white linework is NOT the calibration reference for it, being
     sub-pixel wide in ref9 and half navy by area. */
  courtLogo: "#576564",     // ref9, rectified, median of the mark's own pixels
  /* Hoop hardware: no frame resolves a backboard, rim or pole, so these are
     campus-recreation.js's Muir values, carried so the two courts are the same
     object. Labelled spec, not measurement. */
  steel: "#2e2e2c",
  backboard: "#dfe0da",
  ring: "#d4622a",
  net: "#23252a",
};

/* The stored ground["basketball-court"].surface is #2c4460. Its own note says
   it is the median of the "court apron band" — which the close frames show is
   the surrounding plaza deck, not the playing surface. The surface inside the
   lines medians #141727 / #151729 in two independent frames, which is what
   courtSurface carries. The data file is left as it stands; this is the
   correction of record. */

/* Core envelope inside which the bed material is evidenced. Outside it the
   cobble colour is INHERITED and flagged low confidence — UNLESS the polygon
   appears in MEASURED_COBBLE below, which is the point of that table. */
const CORE = { x0: -160, x1: -75, z0: 545, z1: 650 };

/**
 * Beds whose material is now MEASURED rather than inherited, with the ratio
 * that measured it.
 *
 * HOW, and it is now a COMMAND rather than a description. The previous version
 * of this note described a ratio test that existed only on the build machine,
 * and quoted numbers nothing in the repo could regenerate. The test is now
 * `scripts/register-eighth-refs.py --cobble`, it writes
 * scripts/reports/eighth/bed-ratios.json, and THIS TABLE IS ITS OUTPUT — every
 * ratio below was re-derived by that pass, and the five beds the old table
 * carried that it does not confirm are gone rather than left in place with an
 * unverifiable number beside them.
 *
 * ref2 (orthographic, tied to the SURVEYED court corners to 4.6 cm) and ref3
 * (tied to ref2 by a ground-plane homography, 1,922 inliers) are rectified into
 * the local frame and each surveyed ring is sampled there — see
 * campus-eighth-furniture.js's header for the registration and its
 * falsification check. The cast-immune test then runs per polygon: bed
 * luminance over the luminance of PAVING WITHIN 4 m OF THE SAME POLYGON IN THE
 * SAME ILLUMINATION STATE (sunlit vs blue-cast shadow, split on B-R > 4).
 * Controlling for the illumination state is what makes the test possible at
 * all — the cast is a 3.06x luminance factor, four times any material
 * difference being looked for. The CONTROL class, walkway sampled against
 * neighbouring walkway, scores a median of 1.132 over 11 runs with a range of
 * 0.56-1.97. That spread is the honest resolution of this test: it can
 * separate a bed at 0.55 from paving, and it cannot resolve 0.85 from 1.0.
 *
 * WHICH READS ARE TRUSTED, and why the rule is asymmetric. A building roof
 * leaning over a bed in a perspective frame can only make it BRIGHTER. So a
 * ratio at or below 0.80 with a large sample is evidence of a dark material
 * even beside a podium, while a bright reading beside one is not evidence of a
 * pale material. Accepted here: ratio <= 0.80 over at least 1,500 sampled
 * pixels.
 *
 * THE NEGATIVE RESULT, which is the more useful half. The spec's §1.1 carries
 * a known error: two bed materials exist (dark cobble in the core, pale
 * decomposed granite on the periphery) and the mapping was never done. 16 beds
 * carry enough pixels in ref3 to be scored at all; 8 come back dark and are
 * listed here, and not ONE of the other 8 reads pale from a place a roof
 * cannot reach (they run 0.82-1.97 and every one of them is within 5.3 m of a
 * massing ring, which is exactly where roof contamination lives). So this pass
 * does not confirm a decomposed-granite class anywhere in Eighth, and every
 * bed outside both the core envelope and this table stays flagged `inherited`.
 * That is a smaller uncertainty than the spec had, honestly bounded, not a
 * resolved one.
 */
const MEASURED_COBBLE = new Map([
  ["planting-bed-368", 0.550], ["planting-bed-366", 0.554], ["planting-bed-332", 0.616],
  ["planting-bed-364", 0.647], ["planting-bed-410", 0.667], ["planting-bed-331", 0.681],
  ["planting-bed-374", 0.717], ["planting-bed-335", 0.750],
]);
/* Effective width 4·area/perimeter at or above this splits a junction node
   from a branch run. */
const NODE_EFF_W = 6;
/* Boulders: host beds at or above this area, one per this many m², capped. */
const BOULDER_MIN_AREA = 25, BOULDER_PER_M2 = 30, BOULDER_MAX = 6;
/* Hedges: 0.15 m inset off each surveyed edge, and a height that is a DECLARED
   ASSUMPTION — no frame gives a vertical reference at any hedge; 1.0 m is the
   low end of what performs the barrier rôle the references show it performing. */
const HEDGE_INSET = 0.15, HEDGE_H = 1.0;
/* #1761's canopy is detectable over 13.3 m of its surveyed 26.8 m. Model the
   bed full length and carry the mass over this interval of it — a rule, not a
   pixel trace. */
const HEDGE_1761_SPAN = [0.15, 0.65];
/* The two hedge strips the references name individually, and the two ArcGIS
   rings the dossier never registered that a frame DOES give a colour for. A
   third unregistered ring (#1127) and nine more inside the envelope are
   identified, counted and withheld — see the header's omission list. */
const HEDGE_KEYS = new Set(["planting-bed-2144", "planting-bed-335"]);
const EXTRA = [
  { key: "hedge-1761", index: 1761, cls: "hedge-strip", span: HEDGE_1761_SPAN },
  { key: "dry-lawn-1160", index: 1160, cls: "dry-lawn" },
];
const COURT_KEY = "basketball-court";

/* The repo's deterministic position hash (campus-species.js, campus-massing.js). */
const hash = (x, z) => Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;

const open = (ring) => {
  if (ring.length > 2 && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1]) {
    return ring.slice(0, -1);
  }
  return ring;
};

export function ringMetrics(ring) {
  const p = open(ring);
  let a2 = 0, per = 0, cx = 0, cz = 0;
  for (let i = 0; i < p.length; i++) {
    const [x0, z0] = p[i], [x1, z1] = p[(i + 1) % p.length];
    a2 += x0 * z1 - x1 * z0;
    per += Math.hypot(x1 - x0, z1 - z0);
    cx += x0; cz += z0;
  }
  const area = Math.abs(a2) / 2;
  return { area, per, effW: per > 0 ? (4 * area) / per : 0, cx: cx / p.length, cz: cz / p.length, pts: p };
}

/** Distance from a point to the nearest edge of a ring. */
function distToRing(pts, x, z) {
  let best = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length];
    const dx = bx - ax, dz = bz - az;
    const L2 = dx * dx + dz * dz;
    const t = L2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)) : 0;
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
}

/** Winding-number point-in-ring test. */
export function inRing(pts, x, z) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Building footprints (metres) whose bounding box touches the Eighth zone.
 *
 * WHY THIS EXISTS. The survey's ground polygons run STRAIGHT UNDER the
 * podiums and overhangs — 12 of the features this module paints have their
 * centroid inside a massing footprint, which is correct for a draped surface
 * (the building simply occludes it) and WRONG for anything with a third
 * dimension. Boulders and hedge masses are solid geometry, so a stone placed
 * from a bed that continues under Sankofa stands inside the building: it pokes
 * through the floor slab and is visible from indoors. Five did exactly that
 * before this gate. Every 3D object this module places is tested against these
 * rings, not just the boulders, because the class is "a mass placed from a
 * surveyed ground ring that the survey continues under a building".
 */
export function buildingFootprints(arcgis, box) {
  const out = [];
  for (const m of arcgis?.massing || []) {
    const r = m?.r?.[0];
    if (!Array.isArray(r) || r.length < 3) continue;
    const ring = r.map(([x, z]) => [x / 10, z / 10]);
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [x, z] of ring) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (z < z0) z0 = z; if (z > z1) z1 = z;
    }
    if (x1 < box.x0 || x0 > box.x1 || z1 < box.z0 || z0 > box.z1) continue;
    out.push(ring);
  }
  return out;
}

/** True when a disc of radius `r` at (x,z) touches or enters any footprint. */
export function hitsBuilding(footprints, x, z, r) {
  for (const f of footprints) {
    if (inRing(f, x, z)) return true;
    if (distToRing(f, x, z) < r) return true;
  }
  return false;
}

/** The ArcGIS ring at `index`, in metres (the survey stores decimetres). */
function arcgisRing(arcgis, index) {
  const r = arcgis?.ground?.[index]?.r?.[0];
  if (!Array.isArray(r) || r.length < 3) return null;
  return r.map(([x, z]) => [x / 10, z / 10]);
}

/** Class for one registered feature, per the dossier kind plus the width rule. */
function classify(key, kind, effW) {
  if (key === COURT_KEY) return "court";
  if (HEDGE_KEYS.has(key)) return "hedge-strip";
  if (kind === "walkway") return effW >= NODE_EFF_W ? "walkway-node" : "walkway";
  if (kind === "courtyard") return "courtyard-landscape";
  if (kind === "planting-bed") return "cobble-bed";
  return null;
}

const SURFACE_COLOUR = {
  walkway: EIGHTH_COLORS.plazaConcrete,
  "walkway-node": EIGHTH_COLORS.plazaConcrete,
  "cobble-bed": EIGHTH_COLORS.cobbleBed,
  "courtyard-landscape": EIGHTH_COLORS.cobbleBed,
  "hedge-strip": EIGHTH_COLORS.cobbleBed,
  "dry-lawn": EIGHTH_COLORS.dryLawn,
};
/* Only the concrete is scored: bark, cobble and dry lawn read as surfaces. */
const SCORED = new Set(["walkway", "walkway-node"]);
/* Every class that takes the cobble hex. The core-envelope evidence backs that
   hex only INSIDE the envelope, so all three classes — not just the beds — are
   flagged `inherited` outside it. Flagging only `cobble-bed` under-counted the
   known error by the courtyards and hedge strips that take the same colour. */
const INHERITED_CLASSES = new Set(Object.keys(SURFACE_COLOUR)
  .filter((cls) => SURFACE_COLOUR[cls] === EIGHTH_COLORS.cobbleBed));

/**
 * Boulders in one bed. Deterministic: candidate positions are the hash of the
 * bed's own centroid stepped per index, pulled 55 % of the way from the
 * centroid to a vertex — never the ring itself, because a stone half outside
 * its bed is the failure mode. A candidate too close to another stone or to
 * the ring is dropped, not nudged.
 */
function bouldersIn(m, footprints) {
  const n = Math.max(1, Math.min(BOULDER_MAX, Math.round(m.area / BOULDER_PER_M2)));
  const out = [];
  for (let i = 0; i < n; i++) {
    const k = Math.floor(hash(m.cx + 7.3 * i, m.cz - 3.1 * i) * m.pts.length) % m.pts.length;
    const v = m.pts[k];
    const x = m.cx + 0.55 * (v[0] - m.cx);
    const z = m.cz + 0.55 * (v[1] - m.cz);
    if (out.some((b) => Math.hypot(b.x - x, b.z - z) < 0.8)) continue;
    /* INSIDE the bed, and 0.6 m clear of its edge. The distance test alone is
       not enough: these beds are L- and C-shaped, so the 0.55-of-the-way-to-a-
       vertex candidate can land in the notch — OUTSIDE the ring but still a
       comfortable 0.6 m from it. Eight stones sat on the bare plaza that way. */
    if (!inRing(m.pts, x, z)) continue;
    if (distToRing(m.pts, x, z) < 0.6) continue;
    /* Diameter 0.6-1.0 m is a DECLARED ASSUMPTION and the OVERLAP of two
       calibrated observers who disagree by 2x (0.41-0.82 m vs 0.8-1.6 m). */
    const d = 0.6 + hash(x * 1.7, z * 2.3) * 0.4;
    /* Never inside (or through the wall of) a building — the beds continue
       under the podiums, the stones must not. Dropped, never nudged. */
    if (hitsBuilding(footprints, x, z, d / 2)) continue;
    out.push({ x, z, d, h: 0.6 * d });
  }
  return out;
}

/** A hedge, if it carries a mass and that mass clears every building. */
function addHedge(hedges, key, poly, span, footprints) {
  const mass = hedgeMass(poly, span);
  if (!mass || hedgeHitsBuilding(mass, footprints)) return;
  hedges.push({ key, poly, span, mass });
}

/**
 * The box one hedge strip becomes. Pure, so a test sees the exact mass the
 * renderer builds rather than re-deriving it. The surveyed rings are long
 * clipped strips, so the mass is the strip's own oriented frame inset 0.15 m
 * off each long edge — a mitre-offset of the raw ring would collapse on the
 * 1.0 m-wide one — and 0.15 m in from the ends too, so the bed fill beneath it
 * always shows. Null when the strip is too small to carry a mass.
 */
function hedgeMass(poly, span) {
  const f = orientedFrame(poly);
  if (!f) return null;
  const w = f.width - 2 * HEDGE_INSET;
  if (w <= 0.15) return null;
  const [t0, t1] = span || [0, 1];
  const len = f.length * (t1 - t0) - 2 * HEDGE_INSET;
  if (len <= 0.3) return null;
  const mid = f.length * ((t0 + t1) / 2 - 0.5);
  return {
    x: f.cx + f.ex[0] * mid, z: f.cz + f.ex[1] * mid,
    len, w, h: HEDGE_H, ex: f.ex, rot: Math.atan2(-f.ex[1], f.ex[0]),
  };
}

/** True when any point along a hedge mass's own axis enters a building. */
function hedgeHitsBuilding(mass, footprints) {
  for (let i = 0; i <= 8; i++) {
    const t = (i / 8 - 0.5) * mass.len;
    if (hitsBuilding(footprints, mass.x + mass.ex[0] * t, mass.z + mass.ex[1] * t, mass.w / 2)) {
      return true;
    }
  }
  return false;
}

/**
 * The ArcGIS ground rings this module leaves on whatever campus-world.js
 * sampled — i.e. the residual construction-epoch error inside Eighth, as a
 * LIST rather than as an absence.
 *
 * WHY IT IS COMPUTED RATHER THAN LISTED. A hand-written note goes stale the
 * moment the dossier is refit; this walks the same survey the renderer walks,
 * so the count follows the data. A ring counts as corrected when a dossier
 * feature registers it, when EXTRA adds it, or when its centroid lies inside
 * the painted court rectangle (the court's own sub-polygons — lanes, arcs,
 * the two halves — are covered by the one merged rectangle).
 */
function uncorrectedRings(arcgis, box, painted, courtRing) {
  const out = [];
  const rings = arcgis?.ground || [];
  for (let i = 0; i < rings.length; i++) {
    if (painted.has(`arcgis.ground#${i}`)) continue;
    const r = rings[i]?.r?.[0];
    if (!Array.isArray(r) || r.length < 3) continue;
    const m = ringMetrics(r.map(([x, z]) => [x / 10, z / 10]));
    if (m.cx < box.x0 || m.cx > box.x1 || m.cz < box.z0 || m.cz > box.z1) continue;
    if (courtRing && inRing(courtRing, m.cx, m.cz)) continue;
    out.push({ index: i, kind: rings[i].k, area: m.area, cx: m.cx, cz: m.cz });
  }
  out.sort((a, b) => b.area - a.area);
  return out;
}

/**
 * Every Eighth ground object, from the survey alone. Pure: data in, data out.
 * Quiet no-op shape (all arrays empty) when the dossier is missing.
 */
export function placeEighth(eighth, arcgis) {
  const surfaces = [], hedges = [], boulders = [];
  let court = null;
  const ground = eighth?.ground;
  if (!ground || typeof ground !== "object") {
    return { surfaces, hedges, boulders, court, northWalk: null, uncorrected: [] };
  }

  /* The zone's own bounding box, from the survey rather than a hardcoded
     rectangle, plus 40 m so a building whose footprint only reaches into the
     zone still gates the masses beside it. */
  const box = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
  for (const feature of Object.values(ground)) {
    for (const [x, z] of Array.isArray(feature?.points) ? feature.points : []) {
      if (x < box.x0) box.x0 = x; if (x > box.x1) box.x1 = x;
      if (z < box.z0) box.z0 = z; if (z > box.z1) box.z1 = z;
    }
  }
  const footprints = Number.isFinite(box.x0)
    ? buildingFootprints(arcgis, { x0: box.x0 - 40, x1: box.x1 + 40, z0: box.z0 - 40, z1: box.z1 + 40 })
    : [];

  for (const [key, feature] of Object.entries(ground)) {
    const ring = feature?.points;
    if (!Array.isArray(ring) || ring.length < 3) continue;
    const m = ringMetrics(ring);
    const cls = classify(key, feature.kind, m.effW);
    if (!cls) continue;
    if (cls === "court") { court = { key, points: m.pts, ...m }; continue; }
    const core = m.cx >= CORE.x0 && m.cx <= CORE.x1 && m.cz >= CORE.z0 && m.cz <= CORE.z1;
    const ratio = MEASURED_COBBLE.get(key);
    const inherited = INHERITED_CLASSES.has(cls) && !core && ratio === undefined;
    surfaces.push({
      key, cls, poly: m.pts, area: m.area, cx: m.cx, cz: m.cz,
      colour: SURFACE_COLOUR[cls], scored: SCORED.has(cls),
      material: inherited ? "inherited-from-core" : ratio !== undefined ? "measured-ratio" : "measured",
      confidence: inherited ? "low" : "medium",
      ...(ratio !== undefined ? { ratio } : {}),
    });
    if (cls === "hedge-strip") addHedge(hedges, key, m.pts, null, footprints);
    if ((cls === "cobble-bed" || cls === "courtyard-landscape") && m.area >= BOULDER_MIN_AREA) {
      boulders.push(...bouldersIn(m, footprints));
    }
  }

  /* The three rings the dossier missed. They are survey polygons like any
     other; only their registration was absent. */
  for (const add of EXTRA) {
    const ring = arcgisRing(arcgis, add.index);
    if (!ring) continue;
    const m = ringMetrics(ring);
    /* The SAME evidence rule the dossier features get. #1160's dry-lawn hex is
       a direct ref3 read and stands; #1761's bed fill takes the cobble hex like
       any other strip, so outside the core envelope it is inherited too —
       exempting it just because the module added the ring by hand would be the
       under-count this flag exists to prevent. */
    const core = m.cx >= CORE.x0 && m.cx <= CORE.x1 && m.cz >= CORE.z0 && m.cz <= CORE.z1;
    const inherited = INHERITED_CLASSES.has(add.cls) && !core;
    surfaces.push({
      key: add.key, cls: add.cls, poly: m.pts, area: m.area, cx: m.cx, cz: m.cz,
      colour: SURFACE_COLOUR[add.cls], scored: SCORED.has(add.cls),
      material: inherited ? "inherited-from-core" : "measured",
      confidence: inherited ? "low" : "high",
    });
    if (add.cls === "hedge-strip") addHedge(hedges, add.key, m.pts, add.span, footprints);
  }

  /* The 2.2 m north court walk. Not a polygon in its own right, but pinned
     between two surveyed edges — the court's north sideline and #1761's south
     edge — so it is derived, never hand-placed. This is the one place on this
     court where "apron" is the right word; there is no ring. */
  let northWalk = null;
  const strip = arcgisRing(arcgis, 1761);
  if (court && strip) {
    const zs = court.pts.map((p) => p[1]);
    const xs = court.pts.map((p) => p[0]);
    const zHedge = Math.max(...strip.map((p) => p[1]));
    const zCourt = Math.min(...zs);
    if (zCourt - zHedge > 0.5 && zCourt - zHedge < 6) {
      const x0 = Math.min(...xs), x1 = Math.max(...xs);
      northWalk = {
        key: "north-court-walk", cls: "walkway", scored: true,
        colour: EIGHTH_COLORS.plazaConcrete, width: zCourt - zHedge,
        poly: [[x0, zHedge], [x1, zHedge], [x1, zCourt], [x0, zCourt]],
      };
      surfaces.push({ ...northWalk, area: (x1 - x0) * (zCourt - zHedge), cx: (x0 + x1) / 2, cz: (zHedge + zCourt) / 2, material: "derived", confidence: "high" });
    }
  }

  /* What is STILL wrong, stated. Every ArcGIS ground ring inside the surveyed
     envelope that nothing above paints is left on the construction-epoch
     sample; the biggest of them (#2374, 252 m²) is the pale slab immediately
     west of the court and is in frame for the court's own close-up. No colour
     exists for any of them in the nine Apple frames, so they are named and
     measured rather than guessed (rule 3). */
  const painted = new Set([
    ...Object.values(ground).map((f) => f?.registration).filter(Boolean),
    ...EXTRA.map((add) => `arcgis.ground#${add.index}`),
  ]);
  const uncorrected = Number.isFinite(box.x0)
    ? uncorrectedRings(arcgis, box, painted, court?.pts)
    : [];

  return { surfaces, hedges, boulders, court, northWalk, uncorrected };
}

/* ------------------------------------------------------------- rendering */

/* Faint expansion joints, the same 3 m world pitch campus-world.js scores its
   paving at. No DOM (a test importing this module has no canvas) means no
   texture and a plain fill — quiet, and the colour correction still lands. */
function scoringTexture() {
  if (typeof document === "undefined") return null;
  const S = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = "rgba(0,0,0,0.16)";
  ctx.fillRect(0, 0, S, 2);
  ctx.fillRect(0, 0, 2, S);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/* The joints run 20-45° off the building lines; 30° is the middle of the
   observed range and is applied about each polygon's own centroid. */
const SCORE_ROT = (30 * Math.PI) / 180;
const SCORE_PITCH = 3;

/**
 * One merged LIT mesh per (colour, scored) bucket, on the `pad` rung.
 *
 * WINDING. These are the repo's first LIT fillPoly consumers, so the winding
 * matters here where it never did for the unlit markings/court/recreation
 * fills. It is campus-drape.js's job and is fixed there: fillPoly emits
 * up-facing triangles, so the +y normals written below are the truth about the
 * geometry rather than a lie the shader corrects. This module used to re-order
 * every triangle on the way out — the fourth local workaround for one root
 * cause — and no longer does.
 */
function surfaceMeshes(surfaces, heightAt, scoring) {
  const rung = "pad";
  const lift = overlayLift(rung);
  const buckets = new Map();
  for (const s of surfaces) {
    const id = `${s.colour}|${s.scored}`;
    if (!buckets.has(id)) buckets.set(id, { colour: s.colour, scored: s.scored, pos: [], uv: [] });
    const b = buckets.get(id);
    const start = b.pos.length;
    fillPoly(b.pos, s.poly, heightAt, lift);
    const cos = Math.cos(SCORE_ROT), sin = Math.sin(SCORE_ROT);
    for (let i = start; i < b.pos.length; i += 3) {
      const dx = b.pos[i] - s.cx, dz = b.pos[i + 2] - s.cz;
      b.uv.push((dx * cos - dz * sin) / SCORE_PITCH, (dx * sin + dz * cos) / SCORE_PITCH);
    }
  }
  const out = [];
  for (const b of buckets.values()) {
    if (!b.pos.length) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(b.pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(b.uv, 2));
    const normals = new Float32Array(b.pos.length);
    for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
    geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    const mat = applyOverlayDepth(new THREE.MeshLambertMaterial({
      color: b.colour, side: THREE.DoubleSide,
      ...(b.scored && scoring ? { map: scoring } : {}),
    }), rung);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = OVERLAY[rung].renderOrder;
    out.push(mesh);
  }
  return out;
}

/**
 * The hedges, as lit Lambert masses. Every dimension comes from the pure
 * hedgeMass() the placement already solved and gated against the buildings, so
 * the renderer cannot drift from what a test measures.
 */
function hedgeMasses(hedges, heightAt, out) {
  let built = 0;
  for (const { mass } of hedges) {
    if (!mass) continue;
    /* solids().box takes the box's local +X heading; the frame's long axis. */
    out.box(mass.len, mass.h, mass.w, EIGHTH_COLORS.hedge,
      mass.x, heightAt(mass.x, mass.z) + mass.h / 2, mass.z, mass.rot);
    built++;
  }
  return built;
}

/* A 12-face icosahedron, merged rather than instanced: each stone carries its
   own diameter, so instancing would degenerate to one draw call per boulder. */
function boulderMesh(boulders, heightAt) {
  if (!boulders.length) return null;
  const base = new THREE.IcosahedronGeometry(0.5, 0).getAttribute("position").array;
  const pos = [];
  for (const b of boulders) {
    const y = heightAt(b.x, b.z);
    /* Unit icosahedron spans ±0.5: ×d across gives the diameter, ×h upright
       gives the height, and the 0.30·h lift beds it 20 % into the cobble the
       way a set stone sits rather than balancing on the surface. */
    for (let i = 0; i < base.length; i += 3) {
      pos.push(b.x + base[i] * b.d, y + base[i + 1] * b.h + b.h * 0.3, b.z + base[i + 2] * b.d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: EIGHTH_COLORS.boulder }));
}

/**
 * The Eighth College zone. Returns { group, counts }; the caller parents the
 * group to its own layer — this module never adds itself to the scene, which
 * is the bug that once left Muir Field's overlays outside the layer toggle.
 * Every failure mode here is a quiet no-op with zero counts.
 */
export function createEighth(_scene, { arcgis, eighth, heightAt } = {}) {
  const group = new THREE.Group();
  /* `inherited` and `uncorrected` are the module's own error budget, reported
     rather than buried in a field nothing reads: `inherited` counts surfaces
     painted the cobble hex on the strength of the core envelope alone, and
     `uncorrected` counts surveyed rings still on the construction-epoch
     sample because no epoch-valid frame gives them a colour. */
  const counts = {
    surfaces: 0, walkways: 0, beds: 0, lawns: 0, hedges: 0, boulders: 0,
    court: 0, courtLines: 0, courtLaneMarks: 0, trident: 0, hoops: 0,
    inherited: 0, inheritedM2: 0, uncorrected: 0, uncorrectedM2: 0,
  };
  if (typeof heightAt !== "function") return { group, counts };

  const p = placeEighth(eighth, arcgis);
  if (p.surfaces.length) {
    for (const m of surfaceMeshes(p.surfaces, heightAt, scoringTexture())) group.add(m);
    counts.surfaces = p.surfaces.length;
    counts.walkways = p.surfaces.filter((s) => s.cls === "walkway" || s.cls === "walkway-node").length;
    counts.beds = p.surfaces.filter((s) => s.cls === "cobble-bed" || s.cls === "courtyard-landscape").length;
    counts.lawns = p.surfaces.filter((s) => s.cls === "dry-lawn").length;
    const inh = p.surfaces.filter((s) => s.material === "inherited-from-core");
    counts.inherited = inh.length;
    counts.inheritedM2 = Math.round(inh.reduce((t, s) => t + s.area, 0));
  }
  counts.uncorrected = p.uncorrected.length;
  counts.uncorrectedM2 = Math.round(p.uncorrected.reduce((t, r) => t + r.area, 0));

  const masses = solids();
  counts.hedges = hedgeMasses(p.hedges, heightAt, masses);
  masses.build(group);

  const stones = boulderMesh(p.boulders, heightAt);
  if (stones) { group.add(stones); counts.boulders = p.boulders.length; }

  /* The court, in its own module: it is the most-looked-at object in the zone
     and the only one that has to survive a close-up. Its centre trident is
     Eighth's OWN mark, measured off ref9 and built parametrically in there —
     it no longer borrows Muir Field's outline, so no markings lookup here. */
  if (p.court) {
    const made = createEighthCourt(group, {
      points: p.court.points, colors: EIGHTH_COLORS, heightAt,
    });
    counts.court = made.counts.courtSurface;
    counts.courtLines = made.counts.lines;
    counts.courtLaneMarks = made.counts.laneMarks;
    counts.trident = made.counts.trident;
    counts.hoops = made.counts.hoops;
  }

  return { group, counts };
}
