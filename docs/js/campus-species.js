// Which tree is that? Species, from the measurements we already have.
//
// The LiDAR gives every canopy a position, a height and a spread — but not a
// name. One green fitted nobody: the real campus is eucalyptus groves with
// pale bare trunks and small olive crowns, dark torrey-pine umbrellas along
// Ridge Walk, and yellow-olive sycamores on the lawns. Every colour here was
// median-sampled from 4K footage of the real campus (Nov 2022 drone + Nov 2023
// walk; see the README's footage section), daylight tones, so the palette is
// measured, not invented.
//
// Pure data + pure functions, no THREE: campus-world.js turns this into
// instanced meshes, and the tests run the same rules in Node.
//
// The exclusion-zone and crown-cap logic lives here (not scripts/lib) because
// docs/ is the web root — the renderer must be able to reach it directly.
// scripts/lib/tree-rules.mjs re-exports treeExclusionZones/treeViolation from
// here so there is exactly one implementation, importable from both the
// browser and the offline build/prune scripts.
import { ringBBox, distToRing, pointInRings, nearestZoneClearance } from "./campus-terrain.js";

/* Foliage/trunk in daylight; form drives the silhouette:
     tall     — bare pole, small high crown (eucalyptus: crown starts 8–15 m up)
     umbrella — short trunk, broad flattened crown (torrey/stone pine)
     round    — conventional round crown (sycamore, jacaranda, fig, magnolia) */
export const SPECIES = {
  eucalyptus: { leaf: "#68714e", trunk: "#b0a48e", form: "tall" },
  pine:       { leaf: "#4a5432", trunk: "#4f4238", form: "umbrella" },
  sycamore:   { leaf: "#9a9450", trunk: "#8f8874", form: "round" },
  jacaranda:  { leaf: "#719664", trunk: "#84887e", form: "round" },
  broadleaf:  { leaf: "#2e3a20", trunk: "#6b5f4e", form: "round" }, // fig / magnolia family
};

/* Same deterministic hash the buildings use: a tree keeps its species on
   every visit. */
const hash = (x, z) => Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;

/**
 * Species from the LiDAR's own numbers. The footage rule of thumb:
 * tall-and-narrow is eucalyptus (the groves, the Ridge Walk rows), short-and-
 * broad is a pine umbrella, and the middling round crowns split between the
 * lawn species by position hash — stable, and in roughly the proportions the
 * footage shows.
 */
export function treeSpecies(x, z, h, r) {
  if (h >= 16 && r <= h * 0.42) return "eucalyptus";
  if (h <= 13 && r >= 5) return "pine";
  const t = hash(x, z);
  if (h >= 14) return t < 0.7 ? "eucalyptus" : "pine";
  return t < 0.45 ? "sycamore" : t < 0.75 ? "jacaranda" : t < 0.9 ? "broadleaf" : "pine";
}

/**
 * Per-instance colour jitter, deterministic. Eucalyptus crowns lean toward
 * the stressed near-brown the Nov footage shows in the canyons (D:f0017);
 * everything else just avoids the plastic look of one exact green.
 * Returns { leaf, trunk } as [r,g,b] in 0..1.
 */
export function treeTint(species, x, z) {
  const s = SPECIES[species];
  const t = hash(x + 31.7, z - 17.3);
  const leaf = hexToRgb(s.leaf);
  const trunk = hexToRgb(s.trunk);
  if (species === "eucalyptus") {
    // up to 35% of the way toward stressed brown on a third of instances
    const stress = t < 0.33 ? (0.35 * (0.33 - t)) / 0.33 : 0;
    lerp3(leaf, hexToRgb("#4a4434"), stress);
  }
  const jitter = (hash(x - 3.1, z + 9.4) - 0.5) * 0.12;
  scale3(leaf, 1 + jitter);
  scale3(trunk, 1 + jitter * 0.5);
  return { leaf, trunk };
}

const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255];
};
const lerp3 = (a, b, t) => { for (let i = 0; i < 3; i++) a[i] += (b[i] - a[i]) * t; };
const scale3 = (a, k) => { for (let i = 0; i < 3; i++) a[i] = Math.max(0, Math.min(1, a[i] * k)); };

/* ---------------------------------------------------------- exclusion zones */

/* A trunk this close to a wall is IN the wall once the model is drawn. A crown
   OVERHANGING a facade is real life and stays (crown clearance is a separate,
   looser rule below). */
export const WALL_MARGIN = 0.75;
/* No trunk on a playing surface; sideline rows survive. */
export const PAD_MARGIN = 1.5;

/**
 * Every zone a believable trunk cannot occupy, from the shipped data files:
 * today's building footprints (OSM + the university's own massing), every
 * fitted sports pad, every fountain. Pass whichever files exist; absent ones
 * contribute nothing.
 */
export function treeExclusionZones({ campus3d, arcgis, markings } = {}) {
  const zones = [];
  const add = (ring, kind, margin, name) => {
    if (!ring || ring.length < 3) return;
    zones.push({ ring, kind, margin, name: name || kind, bbox: ringBBox(ring, margin) });
  };
  for (const b of campus3d?.buildings || []) add(b.p, "building", WALL_MARGIN, b.n);
  for (const m of arcgis?.massing || []) add(m.r, "building", WALL_MARGIN, m.n);
  for (const f of markings?.facilities || []) add(f.bounds, "sports", PAD_MARGIN, f.name);
  for (const s of campus3d?.surfaces || []) {
    if ((s.kind ?? s.k) === "water") add(s.p, "water", 0, s.n);
  }
  return zones;
}

/** The zone a tree at (x, z) violates, or null if it stands clear. */
export function treeViolation(x, z, zones) {
  for (const zn of zones) {
    const { bbox } = zn;
    if (x < bbox.x0 || x > bbox.x1 || z < bbox.z0 || z > bbox.z1) continue;
    if (pointInRings(x, z, [zn.ring])) return zn;
    if (zn.margin > 0 && distToRing(x, z, zn.ring) < zn.margin) return zn;
  }
  return null;
}

/** Building + sports-pad zones only — a crown may overhang water (it is not
 *  a solid obstacle the way a wall or a court is). */
export function solidZones(zones) {
  return zones.filter((zn) => zn.kind !== "water");
}

/* The widest a crown could ever legitimately be asked for (see CROWN_FORMS
   below and TREE_MAX_CROWN_R in scripts/lib/tree-rules.mjs). Bounds the bbox
   early-rejection window in clearanceFor so 7,331 trees x ~1,400 zones never
   runs a full per-vertex distToRing scan against a zone nowhere near. */
const MAX_REACH = 8;

/**
 * Metres of clearance from a trunk at (x, z) to the nearest SOLID exclusion
 * zone (pass the result of solidZones), Infinity when nothing is within
 * reach. Computed once per tree at build time by the caller — never per
 * frame — and fed to crownFor as `clearNeed`.
 */
export function clearanceFor(x, z, solid) {
  return nearestZoneClearance(x, z, solid, MAX_REACH);
}

/* -------------------------------------------------------------- crown caps */

/* You walk UNDER a tree, not through one — the crown underside always clears
   head height. */
const CLEARANCE = 2.4;

/* The proportion + placement rule per silhouette. `diamRatio` bounds crown
   DIAMETER against height (2*crownR <= diamRatio*h): a torrey pine's table of
   shade is real and stays meaningfully broader, relative to height, than a
   round lawn crown or a eucalyptus tuft — but no form may read as a blob
   wider than it is tall. `centreOfH` keeps each form's silhouette: a
   eucalyptus tuft rides near the top of its pole, a pine's table sits low. */
export const CROWN_FORMS = {
  tall:     { crownAspect: 1.2,  crownOfH: 0.30, diamRatio: 0.9, centreOfH: 0.85 },
  umbrella: { crownAspect: 0.55, crownOfH: 0.75, diamRatio: 1.1, centreOfH: 0.62 },
  round:    { crownAspect: 1.05, crownOfH: 0.5,  diamRatio: 0.9, centreOfH: 0.85 },
};

/**
 * The rendered crown for one tree, with both realism caps applied.
 * @param {object|Array} t  { x, z, h, r } or the LiDAR row [x, z, h, r] —
 *   only h and r are used; x/z are accepted so callers can pass either the
 *   raw row or an already-destructured object without reshaping it.
 * @param {string} form  "tall" | "umbrella" | "round"
 * @param {number} clearNeed  metres of clearance to the nearest solid
 *   exclusion zone (Infinity when the tree stands clear of everything —
 *   see clearanceFor)
 * @returns {{ crownR:number, crownV:number, centre:number }}  crownR always
 *   satisfies `crownR <= clearNeed` AND `crownR <= ceiling` (proportion,
 *   head-clearance and grade caps), for every clearNeed including 0 — the
 *   intrusion cap always wins over the non-degenerate floor, and the floor
 *   never pushes crownR back above the caps this function just enforced.
 *   Above the floor (shipped data guarantees clearNeed >= 0.75 via trunk
 *   pruning) crownR stays strictly > 0.3 and finite. Only a
 *   physically-impossible clearNeed below the floor (a trunk essentially
 *   inside a zone — upstream pruning forbids this) makes the tree
 *   degenerate rather than intrude. centre - crownV (the crown underside)
 *   is always >= 0 and reaches >= CLEARANCE whenever h allows it.
 */
export function crownFor(t, form, clearNeed = Infinity) {
  const h = Array.isArray(t) ? t[2] : t.h;
  const r = Array.isArray(t) ? t[3] : t.r;
  const f = CROWN_FORMS[form] || CROWN_FORMS.round;

  /* Rule 1 — proportion cap: crown diameter may never exceed diamRatio * h. */
  const proportionCap = (f.diamRatio * h) / 2;
  /* Rule 3 — head clearance: crown underside stays >= CLEARANCE above grade,
     whenever the tree is tall enough to allow it (a very short tree simply
     hits the floor below instead). */
  const maxVert = (h - CLEARANCE) / 2;
  const headCap = maxVert > 0 ? maxVert / f.crownAspect : Infinity;
  /* Rule 4 — grade cap: below CLEARANCE, headCap goes slack (Infinity) since
     no tree that short can give head clearance at all — but crownV must
     still fit inside the tree's own height, or the crown reads as sunk into
     the ground. Bounds crownV <= h/2 so the underside never goes below
     grade. Always looser than headCap once h > CLEARANCE (same denominator,
     smaller numerator: h/2 > (h - CLEARANCE)/2), so it only ever binds for
     the sub-clearance trees headCap leaves unbounded — never for shipped
     data (min h 3.5, well above CLEARANCE). */
  const gradeCap = h / 2 / f.crownAspect;
  /* What the LiDAR spread and the form would otherwise want. */
  const wantCrown = form === "tall" ? Math.min(r, h * f.crownOfH) : r;

  /* Every "may not exceed" cap, combined — proportion, head-clearance and
     grade are unconditional, so the floor below is bounded by them, never
     the other way round. */
  const ceiling = Math.min(headCap, proportionCap, gradeCap);
  const minCrown = Math.max(1.2, Math.min(2.8, h * 0.13));
  const floor = Math.min(minCrown, ceiling);
  let crownR = Math.max(floor, Math.min(wantCrown, ceiling));

  /* Rule 2 — crown-intrusion cap BEATS the non-degenerate floor for every
     input, including clearNeed below the floor: `crownR <= clearNeed` must
     hold always, so the floor is clamped down to whatever clearNeed permits
     before it's applied. A tree boxed in by a wall shrinks (crownV and
     centre shrink with it below, so it reads as a whole small tree, never a
     bare pole with a golf-ball crown) wherever clearNeed allows the floor to
     be met — shipped data guarantees clearNeed >= 0.75 via trunk pruning, so
     the floor is always satisfiable there. Only a physically-impossible
     clearNeed (a trunk essentially inside a zone — upstream pruning forbids
     this) sacrifices non-degeneracy in favour of no-intrusion. The floor is
     ALSO bounded by `ceiling` here, not just `clearNeed` — otherwise a tree
     short/thin enough to make ceiling < NON_DEGENERATE_FLOOR would have the
     floor push crownR back above the proportion/head/grade caps this
     function just enforced. */
  const NON_DEGENERATE_FLOOR = 0.35;
  crownR = Math.min(crownR, clearNeed);
  crownR = Math.max(crownR, Math.min(NON_DEGENERATE_FLOOR, clearNeed, ceiling));
  /* Defense-in-depth: cheap, pure, and makes the invariant unbreakable by a
     future edit above rather than merely true by construction today. */
  crownR = Math.min(crownR, ceiling, clearNeed);

  const crownV = crownR * f.crownAspect;
  /* Crown centre: at least CLEARANCE + crownV up (head clearance), at most
     h - crownV down from the top, otherwise the form's usual band. gradeCap
     above guarantees crownV <= h/2, so h - crownV >= crownV — the centre
     computed here can never fall below crownV, i.e. the underside can never
     go below grade. */
  const centre = Math.min(h - crownV, Math.max(CLEARANCE + crownV, h * f.centreOfH));

  return { crownR, crownV, centre };
}
