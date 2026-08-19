// The Ramble — Eighth College's landscape spine, from photographs.
// PHOTO-SOURCED INVENTED CLASS, and it is quarantined.
//
// SWA Group's restored drainage corridor through the Theatre District Living &
// Learning Neighborhood (HKS + EYRC + Kitchell design-build, built 2021-23,
// photographed 2024-25). SWA's own text calls it "a series of stepped basins
// and bioswales", and the UC Regents Sept-2020 site plan prints its key letter
// F in THREE separate places — a north reach, the central reach between
// Sankofa and Azad, and a south reach by the mid-site parking elevator. All
// three are built here; only the central one has a close-range photograph, so
// only its planting is sourced and the other two say so.
//
// Four things decided the shape of this file:
//
//   1. THE BEDS ARE HOLES, SO THE GAPS ARE THE WALKS. Every Ramble planting
//      bed is a literal hole punched in one campus-wide walk multipolygon
//      (arcgis.ground[3632], 214 rings). That means a bed-to-bed minimum
//      distance IS the paved width between them, with zero inference — and
//      recomputed over the 29 rings this section uses, those distances cluster
//      hard on 1.80 / 2.10 / 2.40 m (6, 7 and 8 ft). So the walks are not
//      drawn: they are DERIVED, by walking one bed's boundary, finding the
//      nearest point on its partner, and filling the gap. Every planter cube,
//      check weir, area drain and minor fixture then rides one of those
//      derived centrelines, which is what guarantees it stands on paving and
//      not in a rush matrix. The four shipped planter cubes stood at
//      x = -135.5, inside planting bed 2703; they are re-seated here.
//      (The luminaires and the bike racks used to ride them too. Both went to
//      eighthsiteworks in the 2026-08-19 arbitration — see the note where they
//      were placed — so this section now lights nothing and parks no bikes.)
//
//   2. THE 2014 LiDAR UNDER THIS SITE IS A PARKING LOT. It is blind to
//      Eighth. Nothing here sculpts ground; everything seats on `surfaceAt`,
//      because inventing measured terrain is a worse class of invention than
//      photo-sourced detail and the two-source rule does not permit it.
//      WHAT THAT ARGUMENT DOES NOT LICENCE, corrected 2026-08-19: the first
//      draft went on to withhold the stairs, both wall families and the ramped
//      walk on the grounds that the drawn surface "falls a smooth 3.2 m over
//      150 m with no step anywhere, so there is nothing for a riser to hang
//      on". That is the dead-epoch argument the project law declares VOID over
//      Eighth — the smooth surface is 2014 LiDAR of a demolished parking lot,
//      and EYRC phf03 photographs a full exterior flight with both rails. The
//      real reason none of them is built HERE is simply that none of the four
//      photographed flights and none of the surveyed wall runs is in the
//      Ramble: eighthcourtyards.levelChange owns them, on the canonical guard
//      and handrail spec eighthsiteworks declares. The schedules stay in this
//      section's `withheld` block as its contribution to those sections.
//
//   3. THE GRASSES ARE PLANTS, NOT CONES. The shipped model's own source line
//      says its Ramble grasses are "generic bunch-grass cones, deliberately
//      not an identified species". Three taxa carry the corridor and each has
//      one diagnostic feature that a cone throws away: Juncus patens bears its
//      inflorescence LATERALLY about three quarters up a leafless cylindrical
//      culm (no grass does this, which is what makes the identification safe
//      without a planting schedule); Muhlenbergia rigens holds stiff straw
//      spikes at a measured 1.5:1 above a fine basal blade clump; Verbena
//      lilacina holds flat-topped lilac umbels 0.15-0.25 m clear of a ferny
//      mound. All three are modelled as those parts. A fourth — an upright
//      golden-flowered subshrub, one of the three most conspicuous plants in
//      the corridor — was absent from the shipped model entirely; its FORM is
//      fully resolved and its species is not, so it ships as the form with the
//      taxon marked unresolved.
//
//   4. BOULDERS ARE DRIFTS, AND THEY ARE BURIED. The shipped model has ~20 in
//      four radial clusters; SWA -8 at 2x resolves 14+ in one bed alone and
//      SWA -2 reads 60-90 down the central reach, all laid as LINEAR drifts
//      along the arroyo margins. And in no frame does a boulder show a ground
//      gap or an under-shadow, so the primitive is a partly-buried ellipsoid
//      whose flat cut is the mulch line — about a third of the vertical axis
//      below grade — not a sphere resting on the surface. Their size is drawn
//      TRIANGULAR about the section's declared modes (1.00 m long axis, 0.50 m
//      exposed), because a mode is a claim about where the population sits and
//      the first draft's two-hash average put the built medians on the band
//      midpoint instead — 1.100 m and 0.575 m, 10% and 15% off what it said.
//
// THE GUARD SPEC IS BORROWED, SO IT IS BUILT THE WAY ITS OWNER BUILDS IT.
// eighthsiteworks owns the canonical Eighth guardrail and states 1.067 m from
// the walking surface to the TOP of the top rail. That makes the rail's centre
// half a tube lower and stops a picket a whole tube lower, at the rail's
// underside. Round two placed the centre AT 1.067 — a guard 24 mm too tall —
// and ran the pickets to the same figure, 48 mm into the rail's lower half.
// Both are corrected and both are now gated against the built scene. The base
// shoes went at the same time: `shoeSpacing: 1.5` and `shoe: [0.11, 0.012,
// 0.11]` were four figures with no source and no derivation, aligned with
// nothing in a guard whose declared members are pickets at 0.1016 m and two
// rails, and absent from the canonical spec — which carries a kerb, not a
// shoe. Better absent than wrong; the reason is in the section's `absent`.
//
// Colours are DATA: every hex comes from the section's `colors` block and no
// literal appears below. Surfaces come from the procedural material library
// (campus-materials.js) — code-generated maps only, never a photograph or a
// satellite pixel; the sourced colours still drive the materials, and every
// decal's world TEXTURE TILE is derived from a sourced feature size (shred
// length, stone mode, DG grit, concrete aggregate) times that map's own
// per-tile frequency, so nothing on screen is at a chosen scale. Ground
// decals ride campus-overlay.js's shared ladder via overlayLift /
// applyOverlayDepth, and there is now NO local lift constant anywhere: the
// check weir and the area drains used to add 0.02 and 0.005 to a rung, and
// both are rebuilt so that a declared thickness and a declared proud height
// place them against the rung itself. Deterministic: no Math.random and no
// Date anywhere — the scatter comes from `hash` off the section's pinned
// seed, so two loads produce byte-identical matrices.
import * as THREE from "../vendor/three/three.module.min.js";
import { applyOverlayDepth, OVERLAY, overlayLift } from "./campus-overlay.js";
import { sharedMaterialLibrary } from "./campus-materials.js";
import { fillPoly } from "./campus-drape.js";

/* The process-wide shared material library, resolved on first build. */
let LIB = null;
const lib = () => (LIB ??= sharedMaterialLibrary(THREE));

const concrete = (color) => lib().get("smoothConcrete", { color });
const metal = (color) => lib().get("metalPanel", { color, metalness: 0.55, roughness: 0.45 });
const painted = (color) => lib().get("metalPanel", { color, metalness: 0.3, roughness: 0.6 });
const stone = (color) => lib().get("decomposedGranite", { color, roughness: 0.98 });
/* Plant parts stay a plain standard material: the library's `foliage` class is
   an alpha-cut CARD map, and cutting holes in culm/blade/mound geometry would
   shred the silhouette it exists to draw. */
const plant = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0.0 });

/** A draped surface in a named material class, on a rung of the shared ladder. */
function decalMat(color, rung, cls, repeat) {
  return applyOverlayDepth(lib().get(cls, { color, repeat }), rung);
}

/* WORLD TEXTURE TILE, DERIVED — NOT CHOSEN.
   Every generated map in campus-materials.js lays its features at a known
   frequency PER TILE, and those frequencies are the map functions' own
   arguments, quoted here so the derivation is checkable against that file:

     barkEucalyptus    strip  = fbm(u, v, 10,  3,  3)  ->   3 ribbon lengths/tile
     lavaRock          lump   = fbm(u, v, 12, 12,  4)  ->  12 stones/tile
     decomposedGranite stones =   n(u, v, 40, 40)      ->  40 stones/tile
     smoothConcrete    agg    = fbm(u, v, 128, 128, 2) -> 128 specks/tile

   So the tile that puts a feature on screen at the size the SECTION measured
   it is `featureSize x featuresPerTile` — and the section's shredLength,
   stoneMode, gritSize and aggregateSize are what drive every decal below.
   Round one hard-coded 1.2 / 0.8 / 1.5 / 2.0 and left all four sourced
   figures unread. */
/* The Agave rosette's leaves spread +/- this much about the angle its sourced
   `leafRise` gives. It is a SPREAD, not a form: the rise fixes where the
   rosette stands, this only says the leaves are not all at one angle, and at
   0.40 rad the built rosette still reads open at every draw. */
const AGAVE_SPREAD = 0.4;

const RIBBONS_PER_TILE = 3;
const LUMPS_PER_TILE = 12;
const DG_STONES_PER_TILE = 40;
const CONCRETE_SPECKS_PER_TILE = 128;

/** Deterministic 0..1 from any integer mix — a reload rebuilds the same landscape. */
function hash(...ns) {
  let s = 0;
  for (let i = 0; i < ns.length; i++) s = s * 131.71 + ns[i] * 57.13 + 7.9;
  const v = Math.sin(s) * 43758.5453;
  return v - Math.floor(v);
}
/** hash mapped onto [lo, hi]. */
const span = (lo, hi, ...ns) => lo + (hi - lo) * hash(...ns);
/**
 * A TRIANGULAR draw on [lo, hi] peaking at `mode`, from one uniform variate.
 * The section states a mode for the boulder long axis and the boulder exposed
 * height and a mode is a statement about where the mass of the distribution
 * sits, so the draw has to honour it: this is the standard inverse-CDF of the
 * triangular distribution, whose median lands on the mode. Round one averaged
 * two hashes instead, which is symmetric about the BAND MIDPOINT and put the
 * built medians 10% and 15% off the modes the section declared.
 */
function triangular(lo, hi, mode, u) {
  const w = hi - lo;
  const c = (mode - lo) / w;
  return u < c ? lo + Math.sqrt(u * w * (mode - lo)) : hi - Math.sqrt((1 - u) * w * (hi - mode));
}

/**
 * One InstancedMesh from a list of placements. Each placement is
 * `{ x, y, z, rot?, rotX?, rotZ?, scale? }`; rotation composes in "YXZ" order,
 * so a rotZ of pi/2 lays a cylinder on its side and `rot` then yaws it along
 * the run it belongs to.
 */
function instanced(geo, mat, items) {
  const mesh = new THREE.InstancedMesh(geo, mat, items.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  items.forEach((it, i) => {
    e.set(it.rotX || 0, it.rot || 0, it.rotZ || 0, "YXZ");
    q.setFromEuler(e);
    s.set(it.scale?.[0] ?? 1, it.scale?.[1] ?? 1, it.scale?.[2] ?? 1);
    p.set(it.x, it.y, it.z);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/* ------------------------------------------------------------- polygons */

function inRing(x, z, r) {
  let ins = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, zi] = r[i];
    const [xj, zj] = r[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
}

function bbox(r) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, z] of r) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (z < z0) z0 = z;
    if (z > z1) z1 = z;
  }
  return { x0, x1, z0, z1 };
}

/** Nearest point on a segment, and its distance. */
function nearestOnSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const x = ax + dx * t;
  const z = az + dz * t;
  return { x, z, d: Math.hypot(px - x, pz - z) };
}

/** Nearest point on a closed ring. */
function nearestOnRing(px, pz, r) {
  let best = { x: 0, z: 0, d: Infinity };
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const n = nearestOnSeg(px, pz, r[j][0], r[j][1], r[i][0], r[i][1]);
    if (n.d < best.d) best = n;
  }
  return best;
}

/** A closed ring resampled at roughly `step` metres, in ring order. */
function walkRing(r, step) {
  const out = [];
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [ax, az] = r[j];
    const [bx, bz] = r[i];
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(len / step));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      out.push([ax + (bx - ax) * t, az + (bz - az) * t]);
    }
  }
  return out;
}

/* ---------------------------------------------------------------- braid */

/**
 * The arroyo braid as a swept ribbon. `hit(x, z)` answers whether a point is
 * in the channel and how wide the channel is there; the module uses that both
 * to keep mulch planting OUT of the wash and to keep the wash-only species
 * (Baccharis, Agave) IN it.
 */
function braidOf(b, widthRange, seedTag) {
  const pts = b.points;
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  const total = cum[cum.length - 1];
  const [wLo, wHi] = widthRange;
  /* Width meanders deterministically inside the sourced band; two sine terms
     at incommensurate wavelengths so the channel never repeats over its run. */
  const halfAt = (s) => {
    const u = s / total;
    const a = Math.sin(u * 9.1 + seedTag * 0.37);
    const c = Math.sin(u * 21.7 + seedTag * 1.13);
    return (wLo + (wHi - wLo) * (0.5 + 0.32 * a + 0.18 * c)) / 2;
  };
  const at = (s) => {
    let i = 1;
    while (i < cum.length - 1 && cum[i] < s) i++;
    const t = (s - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
    const x = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t;
    const z = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t;
    const dl = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) || 1;
    const tx = (pts[i][0] - pts[i - 1][0]) / dl;
    const tz = (pts[i][1] - pts[i - 1][1]) / dl;
    return { x, z, tx, tz, nx: -tz, nz: tx, half: halfAt(s) };
  };
  const hit = (px, pz) => {
    let best = null;
    for (let i = 1; i < pts.length; i++) {
      const n = nearestOnSeg(px, pz, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
      if (!best || n.d < best.d) best = { d: n.d, s: cum[i - 1] + Math.hypot(n.x - pts[i - 1][0], n.z - pts[i - 1][1]) };
    }
    return { in: best.d <= halfAt(best.s), d: best.d, s: best.s, half: halfAt(best.s) };
  };
  return { key: b.key, reach: b.reach, total, at, hit };
}

/* ------------------------------------------------------------- plants */

/**
 * A jittered triangular lattice over a bed, at one species' own on-centre
 * spacing. `phase` shifts each species off the others so two taxa never solve
 * to the same points; the jitter is a fifth of the spacing, which is what
 * keeps a planted drift from reading as a grid without letting two neighbours
 * collide.
 */
function lattice(ring, spacing, phase, tag) {
  const b = bbox(ring);
  const rowH = spacing * 0.866;
  const out = [];
  let row = 0;
  for (let z = b.z0 + phase * rowH; z <= b.z1; z += rowH, row++) {
    const off = row % 2 ? spacing / 2 : 0;
    for (let x = b.x0 + off + phase * spacing; x <= b.x1; x += spacing) {
      const jx = x + (hash(tag, row, Math.round(x * 7), 11) - 0.5) * spacing * 0.4;
      const jz = z + (hash(tag, row, Math.round(x * 7), 23) - 0.5) * spacing * 0.4;
      if (inRing(jx, jz, ring)) out.push([jx, jz, row, Math.round(x * 7)]);
    }
  }
  return out;
}

/* ------------------------------------------------------------- module */

/**
 * Build the Ramble. Returns `{ group, counts }` and adds the group to `scene`
 * when one is given. READS `photo.eighthramble` and writes nothing back —
 * one-way, always. Callers must pass `surfaceAt` (campus-terrain.js): it is
 * the height of the DRAWN triangle, and `heightAt` interpolates every LiDAR
 * sample where the mesh uses every second one, so anything seated on
 * `heightAt` sits under the visible ground.
 */
export function createPhotoEighthRamble(scene, { photo, heightAt, surfaceAt } = {}) {
  const group = new THREE.Group();
  group.name = "photo-eighth-ramble";
  const counts = {};
  const S = photo?.eighthramble;
  const ground = surfaceAt || heightAt;
  if (!S || typeof ground !== "function") return { group, counts };

  const C = S.colors;
  const SEED = S.seed;
  const M = S.measured;
  const SY = S.systems;

  const beds = M.beds;
  const clips = M.clips.map((c) => c.ring);
  const inClip = (x, z) => clips.some((r) => inRing(x, z, r));
  /* A clip has to hold against the whole OBJECT, not just its origin: a rush
     clump set 0.2 m off a bridge deck still throws culms across it. So a
     placement is rejected when it is inside a clip OR within its own radius of
     one — which is what keeps the surveyed decks and the surveyed walkway
     genuinely empty rather than merely nominally clipped. */
  const nearClip = (x, z, r) =>
    clips.some((ring) => inRing(x, z, ring) || nearestOnRing(x, z, ring).d < r);
  /* The same rule against the surveyed WALLS the beds run up to. Planting bed
     1159 touches the Sankofa Base ring at 0.01 m and bed 353 sits 0.19 m off
     Sankofa Mid, so a clump planted on that edge throws culms through the wall
     unless it is held its own radius clear. */
  /* Only the massing rings that do not contradict the ground layer — see the
     section's SURVEY vs SURVEY entry in `absent`. */
  const masses = (M.masses || []).filter((m) => m.clearance).map((m) => m.ring);
  const nearMass = (x, z, r) =>
    masses.some((ring) => inRing(x, z, ring) || nearestOnRing(x, z, ring).d < r);
  const bedOf = (x, z) => beds.find((b) => inRing(x, z, b.ring)) || null;

  /* Every world texture tile below, derived from a sourced feature size and
     the generating map's own per-tile frequency. See the block above. */
  const TILE = {
    mulch: ((SY.mulch.shredLength[0] + SY.mulch.shredLength[1]) / 2) * RIBBONS_PER_TILE,
    wash: SY.arroyo.stoneMode * LUMPS_PER_TILE,
    dg: SY.dgWalks.gritSize * DG_STONES_PER_TILE,
    concrete: SY.concreteWalks.aggregateSize * CONCRETE_SPECKS_PER_TILE,
  };

  const braids = SY.arroyo.braids.map((b, i) => braidOf(b, SY.arroyo.widthRange, i + 1));
  /* A point is IN the wash only where the braid overlaps a surveyed bed —
     the channel is clipped to the survey, never the other way round. */
  const inWash = (x, z) => {
    for (const br of braids) if (br.hit(x, z).in) return br;
    return null;
  };

  /* ------------------------------------------------- ground: the decals */

  const decalBins = new Map();
  const pushDecal = (key, rung, cls, color, tile, poly) => {
    let bin = decalBins.get(key);
    if (!bin) decalBins.set(key, (bin = { rung, cls, color, tile, pos: [] }));
    fillPoly(bin.pos, poly, ground, overlayLift(rung));
  };
  /* COUNT THE GEOMETRY, NOT THE INTENTION. `washQuads` and `walkQuads` used to
     be hand-kept counters incremented beside the pushDecal call, so they
     reported quads whether or not anything was drawn — disabling the wash
     decal outright left the count at 249 and the suite green. They are now
     read back off the emitted vertex buffer: fillPoly triangulates a 4-gon
     into two triangles, six vertices, eighteen floats. */
  const binQuads = (key) => (decalBins.get(key)?.pos.length ?? 0) / 18;

  /* fillPoly emits POSITIONS only, so a draped surface has no UVs and would
     sample the generated map at a single texel — a flat colour with all the
     microstructure thrown away. These decals get PLANAR world UVs instead, at
     the class's real-world tile size, so bark shreds, crushed rock and
     decomposed granite land at true scale wherever the polygon happens to be. */
  function drapedGeometry(pos, tile) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    const nrm = new Float32Array(pos.length);
    const uv = new Float32Array((pos.length / 3) * 2);
    for (let i = 0, j = 0; i < pos.length; i += 3, j += 2) {
      nrm[i + 1] = 1;
      uv[j] = pos[i] / tile;
      uv[j + 1] = pos[i + 2] / tile;
    }
    geo.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    return geo;
  }

  /* Mulch: every surveyed bed, minus the wash. A bed is emitted as its own
     ring, then the wash is painted over it on the rung above — cutting the
     braid out of 29 concave rings would need a boolean the survey does not
     justify, and the ladder is exactly the mechanism for "this surface paints
     over that one". */
  /* A bed whose SURFACE is withheld is skipped here and by the planting and
     boulder loops below, but it stays in `beds` because the walk-pair geometry
     is derived from its ring. Two rings are withheld (arbitrated 2026-08-19):
     #2369 is the Sun Lawn, and #1160 carries a lawn and a bunchgrass bed with
     an unresolved edge between them. Mulching either would turf them over. */
  for (const b of beds) {
    if (b.surfaceWithheld) continue;
    pushDecal("mulch", SY.mulch.rung, "barkEucalyptus", C[SY.mulch.color], TILE.mulch, b.ring);
  }
  counts.mulchBeds = beds.filter((b) => !b.surfaceWithheld).length;

  /* The wash: swept quads along each braid, every one CLIPPED to a bed. */
  const washCentres = [];
  for (const br of braids) {
    const step = 0.6;
    let prev = null;
    for (let s = 0; s <= br.total + 1e-6; s += step) {
      const a = br.at(Math.min(s, br.total));
      const cur = {
        l: [a.x + a.nx * a.half, a.z + a.nz * a.half],
        r: [a.x - a.nx * a.half, a.z - a.nz * a.half],
        c: [a.x, a.z],
      };
      if (prev) {
        const quad = [prev.l, prev.r, cur.r, cur.l];
        const ok = quad.every((p) => bedOf(p[0], p[1]) && !inClip(p[0], p[1]) && !nearMass(p[0], p[1], 0));
        if (ok) {
          pushDecal("wash", SY.arroyo.rung, "lavaRock", C[SY.arroyo.color], TILE.wash, quad);
          washCentres.push({ x: (prev.c[0] + cur.c[0]) / 2, z: (prev.c[1] + cur.c[1]) / 2, s, br });
        }
      }
      prev = cur;
    }
  }
  counts.washQuads = binQuads("wash");

  /* --------------------------------------------- ground: derived walks */

  /* A walk is the SURVEYED gap between two beds. Sample bed A's boundary,
     find the nearest point on bed B, and where the two are the modular width
     apart, that quad is paving. Nothing is drawn; it is measured. */
  const walks = [];
  for (const pair of M.walkPairs) {
    const A = beds.find((b) => b.id === pair.a);
    const B = beds.find((b) => b.id === pair.b);
    if (!A || !B) continue;
    const samples = walkRing(A.ring, 0.5);
    const tol = pair.band <= 2.52 ? 0.35 : 1.2;
    let run = [];
    const runs = [];
    for (const [px, pz] of samples) {
      const q = nearestOnRing(px, pz, B.ring);
      /* The gap is paving only if the WHOLE crossing is open. Sampling just
         the midpoint is not enough — beds 357 and 358 sit 0.27 m apart, and a
         wide-band pair drawn across them clears the middle while paving over
         a third bed at both quarter points. */
      let keep = q.d <= pair.gap + tol;
      const steps = Math.max(4, Math.ceil(q.d / 0.35));
      for (let k = 1; k < steps && keep; k++) {
        const t = k / steps;
        const mx = px + (q.x - px) * t;
        const mz = pz + (q.z - pz) * t;
        if (bedOf(mx, mz) || inClip(mx, mz) || nearMass(mx, mz, 0)) keep = false;
      }
      if (keep) run.push({ p: [px, pz], q: [q.x, q.z] });
      else if (run.length) { runs.push(run); run = []; }
    }
    if (run.length) runs.push(run);
    const centre = [];
    let quads = 0;
    for (const r of runs) {
      for (let i = 1; i < r.length; i++) {
        const a = r[i - 1];
        const b = r[i];
        if (Math.hypot(b.q[0] - a.q[0], b.q[1] - a.q[1]) > 1.5) continue;
        pushDecal(
          pair.material === "dg" ? "dgWalk" : "concreteWalk",
          pair.material === "dg" ? SY.dgWalks.rung : SY.concreteWalks.rung,
          pair.material === "dg" ? "decomposedGranite" : "smoothConcrete",
          pair.material === "dg" ? C[SY.dgWalks.color] : C[SY.concreteWalks.color],
          pair.material === "dg" ? TILE.dg : TILE.concrete,
          [a.p, a.q, b.q, b.p]
        );
        quads++;
        centre.push([(a.p[0] + a.q[0] + b.p[0] + b.q[0]) / 4, (a.p[1] + a.q[1] + b.p[1] + b.q[1]) / 4]);
      }
    }
    if (quads) walks.push({ pair, centre, quads, length: centre.length * 0.5 });
  }
  counts.walks = walks.length;
  counts.walkQuads = binQuads("dgWalk") + binQuads("concreteWalk");

  for (const bin of decalBins.values()) {
    if (!bin.pos.length) continue;
    const geo = drapedGeometry(bin.pos, bin.tile);
    const mesh = new THREE.Mesh(geo, decalMat(bin.color, bin.rung, bin.cls, 1));
    mesh.name = `ramble-${bin.cls}`;
    mesh.renderOrder = OVERLAY[bin.rung].renderOrder;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  /* ------------------------------------------------------- the planting */

  const P = SY.planting;
  const mix = P.mix;
  const mixTotal = mix.reduce((s, m) => s + m.weight, 0);
  /* Drifts, not a shuffled mix: a coarse lattice assigns each 4 m cell one
     taxon, and a species' own on-centre lattice is kept only inside its own
     cells. That is what a planting plan does, and what the aerial banding in
     SWA -2 shows. */
  const driftAt = (x, z) => {
    const cx = Math.floor(x / P.driftCell);
    const cz = Math.floor(z / P.driftCell);
    let r = hash(cx, cz, SEED) * mixTotal;
    for (const m of mix) {
      r -= m.weight;
      if (r <= 0) return m.species;
    }
    return mix[mix.length - 1].species;
  };

  const SP = P.species;
  const elkBeds = new Set(P.elkBlueBeds);
  const bins = {
    juncusCulm: [], juncusCulmBlue: [], juncusSeed: [],
    muhBlade: [], muhSpike: [],
    verbenaMound: [], verbenaUmbel: [],
    goldenBranch: [], goldenRaceme: [],
    dianellaLeaf: [],
    baccharisMound: [],
    agaveLeaf: [], agaveSpine: [],
  };
  const plantCounts = { juncus: 0, juncusElkBlue: 0, muhlenbergia: 0, verbena: 0, golden: 0, dianella: 0, baccharis: 0, agave: 0 };

  const PHASE = { juncus: 0.0, muhlenbergia: 0.31, verbena: 0.57, golden: 0.13, dianella: 0.79 };
  /* The widest clump this section plants is Muhlenbergia at 1.20 m across, so
     0.6 m is the reach any one plant has off its own centre. */
  const CLUMP_CLEARANCE = M.massClearance;
  const TAG = { juncus: 1, muhlenbergia: 2, verbena: 3, golden: 4, dianella: 5, baccharis: 6, agave: 7 };

  for (let bi = 0; bi < beds.length; bi++) {
    const bed = beds[bi];
    if (bed.surfaceWithheld) continue;
    const blue = elkBeds.has(bed.id);
    for (const key of ["juncus", "muhlenbergia", "verbena", "golden", "dianella"]) {
      const sp = SP[key];
      for (const [x, z, row, col] of lattice(bed.ring, sp.spacing, PHASE[key], TAG[key] * 1000 + bi)) {
        if (driftAt(x, z) !== key) continue;
        if (nearClip(x, z, CLUMP_CLEARANCE) || nearMass(x, z, CLUMP_CLEARANCE)) continue;
        if (inWash(x, z)) continue;
        const g = ground(x, z);
        const n = TAG[key] * 100000 + bi * 977 + row * 31 + col;

        if (key === "juncus") {
          const h = span(sp.height[0], sp.height[1], n, 1);
          const rad = span(sp.width[0], sp.width[1], n, 2) / 2;
          const bin = blue ? bins.juncusCulmBlue : bins.juncusCulm;
          for (let k = 0; k < sp.culms; k++) {
            const a = (k / sp.culms) * Math.PI * 2 + hash(n, k, 3) * 0.9;
            /* Euler "YXZ" tilts a +Y axis into (sin a, cos tilt, cos a) — so
               the radial direction that carries the base offset has to be the
               SAME (sin a, cos a), or the clump splays one way and sits the
               other. */
            const dx = Math.sin(a);
            const dz = Math.cos(a);
            const r = rad * 0.45 * Math.sqrt(hash(n, k, 4));
            const ch = h * span(0.72, 1.0, n, k, 5);
            const tilt = sp.splay * hash(n, k, 6);
            const lean = Math.sin(tilt) * ch / 2;
            bin.push({
              x: x + dx * (r + lean), y: g + (ch / 2) * Math.cos(tilt), z: z + dz * (r + lean),
              rot: a, rotX: tilt, scale: [1, ch, 1],
            });
          }
          if (hash(n, 7) < 0.5) {
            for (let k = 0; k < sp.seedClusters; k++) {
              const a = hash(n, k, 8) * Math.PI * 2;
              const r = rad * 0.4;
              /* The diagnostic: the inflorescence is LATERAL, three quarters
                 of the way up a leafless culm. No grass does this. */
              bins.juncusSeed.push({
                x: x + Math.sin(a) * r, y: g + h * sp.inflorescenceAt, z: z + Math.cos(a) * r,
                rot: a, scale: [0.03, sp.seedLength, 0.03],
              });
            }
          }
          plantCounts[blue ? "juncusElkBlue" : "juncus"]++;
        } else if (key === "muhlenbergia") {
          const fh = sp.foliageHeight * span(0.85, 1.1, n, 1);
          const rad = sp.foliageWidth / 2;
          for (let k = 0; k < sp.blades; k++) {
            const a = (k / sp.blades) * Math.PI * 2 + hash(n, k, 2) * 0.7;
            const dx = Math.sin(a);
            const dz = Math.cos(a);
            const tilt = sp.bladeArch * span(0.35, 1.0, n, k, 3);
            const bh = fh * span(0.6, 1.0, n, k, 4);
            const lean = Math.sin(tilt) * bh / 2;
            bins.muhBlade.push({
              x: x + dx * (rad * 0.12 + lean), y: g + (bh / 2) * Math.cos(tilt), z: z + dz * (rad * 0.12 + lean),
              rot: a, rotX: tilt, scale: [1, bh, 1],
            });
          }
          /* Held WELL above the foliage: the spike-to-foliage ratio measures
             1.5:1 in SWA -6, which is the whole read of this plant. */
          for (let k = 0; k < sp.spikes; k++) {
            const a = (k / sp.spikes) * Math.PI * 2 + hash(n, k, 5) * 1.1;
            const sh = sp.spikeHeight * span(0.85, 1.05, n, k, 6);
            const tilt = 0.1 * hash(n, k, 7);
            bins.muhSpike.push({
              x: x + Math.sin(a) * (rad * 0.2 + Math.sin(tilt) * sh / 2), y: g + (sh / 2) * Math.cos(tilt),
              z: z + Math.cos(a) * (rad * 0.2 + Math.sin(tilt) * sh / 2),
              rot: a, rotX: tilt, scale: [1, sh, 1],
            });
          }
          plantCounts.muhlenbergia++;
        } else if (key === "verbena") {
          const h = span(sp.height[0], sp.height[1], n, 1);
          const w = span(sp.width[0], sp.width[1], n, 2);
          const lift = span(sp.umbelLift[0], sp.umbelLift[1], n, 3);
          const mh = h - lift;
          const rh = mh / 1.7;
          bins.verbenaMound.push({ x, y: g + rh * 0.7, z, rot: hash(n, 4) * 3.14, scale: [w, rh * 2, w * 0.95] });
          for (let k = 0; k < sp.umbels; k++) {
            const a = (k / sp.umbels) * Math.PI * 2 + hash(n, k, 5) * 0.8;
            const r = (w / 2) * span(0.15, 0.8, n, k, 6);
            bins.verbenaUmbel.push({
              x: x + Math.sin(a) * r, y: g + mh + lift * span(0.6, 1.0, n, k, 7), z: z + Math.cos(a) * r,
              scale: [sp.umbelDiameter, 0.022, sp.umbelDiameter],
            });
          }
          plantCounts.verbena++;
        } else if (key === "golden") {
          const h = span(sp.height[0], sp.height[1], n, 1);
          const w = span(sp.width[0], sp.width[1], n, 2);
          for (let k = 0; k < sp.branches; k++) {
            const a = (k / sp.branches) * Math.PI * 2 + hash(n, k, 3) * 0.8;
            const dx = Math.sin(a);
            const dz = Math.cos(a);
            const tilt = span(0.08, 0.42, n, k, 4);
            const bh = h * span(0.7, 1.0, n, k, 5);
            const bx = x + dx * w * 0.06;
            const bz = z + dz * w * 0.06;
            const half = Math.sin(tilt) * bh / 2;
            bins.goldenBranch.push({
              x: bx + dx * half, y: g + (bh / 2) * Math.cos(tilt), z: bz + dz * half,
              rot: a, rotX: tilt, scale: [1, bh, 1],
            });
            /* One dense golden raceme per branch TIP, held clear of the
               foliage — the feature that makes this plant read at 40 m. */
            const rl = span(sp.racemeLength[0], sp.racemeLength[1], n, k, 6);
            const tip = Math.sin(tilt) * bh;
            bins.goldenRaceme.push({
              x: bx + dx * (tip + Math.sin(tilt) * rl / 2), y: g + bh * Math.cos(tilt) + (rl / 2) * Math.cos(tilt),
              z: bz + dz * (tip + Math.sin(tilt) * rl / 2),
              rot: a, rotX: tilt, scale: [0.05, rl, 0.05],
            });
          }
          plantCounts.golden++;
        } else {
          const h = span(sp.height[0], sp.height[1], n, 1);
          for (let k = 0; k < sp.leaves; k++) {
            const a = (k / sp.leaves) * Math.PI * 2 + hash(n, k, 2) * 0.5;
            const tilt = span(0.18, 0.72, n, k, 3);
            const lh = h * span(0.7, 1.0, n, k, 4);
            const half = Math.sin(tilt) * lh / 2;
            /* Flat STRAP leaves 8-12 mm wide radiating from one point — the
               feature that separates this from the round-culmed Juncus beside
               it in the same frame. */
            bins.dianellaLeaf.push({
              x: x + Math.sin(a) * half, y: g + (lh / 2) * Math.cos(tilt), z: z + Math.cos(a) * half,
              rot: a, rotX: tilt, scale: [sp.bladeWidth, lh, 0.002],
            });
          }
          plantCounts.dianella++;
        }
      }
    }
  }

  /* The two wash-only taxa. Baccharis and Agave are photographed as single
     specimens standing IN the crushed rock and never in the mulch, so they are
     latticed over the braid and kept only where the braid is genuinely
     drawn — inside a bed, outside every clip. */
  /* `agave.countCentral` is a sourced COUNT BAND — about 12 rosettes legible
     in the central reach across phf44 and SWA -5/-6 — and the section's own
     note says the test checks the built figure against it rather than trusting
     it. That check needs the count broken out by reach, so it is counted here,
     at the rosette's own lattice point: a spine or a leaf is thrown up to half
     a rosette off centre and can land in a neighbouring reach's bed. */
  const centralReach = new Set(M.reaches.central);
  let agaveCentral = 0;
  for (let bi = 0; bi < beds.length; bi++) {
    const bed = beds[bi];
    if (bed.surfaceWithheld) continue;
    for (const key of ["baccharis", "agave"]) {
      const sp = SP[key];
      for (const [x, z, row, col] of lattice(bed.ring, sp.spacing, key === "agave" ? 0.44 : 0.66, TAG[key] * 1000 + bi)) {
        if (nearClip(x, z, CLUMP_CLEARANCE) || nearMass(x, z, CLUMP_CLEARANCE)) continue;
        if (!inWash(x, z)) continue;
        const g = ground(x, z);
        const n = TAG[key] * 100000 + bi * 977 + row * 31 + col;
        if (key === "baccharis") {
          if (hash(n, 0) > sp.washShare) continue;
          const w = span(sp.builtWidth[0], sp.builtWidth[1], n, 1);
          const h = span(sp.height[0], sp.height[1], n, 2) * 0.7;
          const rh = h / 1.7;
          bins.baccharisMound.push({ x, y: g + rh * 0.7, z, rot: hash(n, 3) * 3.14, scale: [w, rh * 2, w * 0.92] });
          plantCounts.baccharis++;
        } else {
          const tiltMid = Math.atan(1 / (2 * sp.leafRise));
          const w = span(sp.builtWidth[0], sp.builtWidth[1], n, 1);
          for (let k = 0; k < sp.leaves; k++) {
            const a = (k / sp.leaves) * Math.PI * 2 + hash(n, k, 2) * 0.35;
            const dx = Math.sin(a);
            const dz = Math.cos(a);
            /* An OPEN rosette: a leaf reaching w/2 sideways and leafRise x w
               upward stands atan(1 / (2 x leafRise)) from vertical, and the
               rosette spreads about that. The sourced 0.55 rise is what sets
               the angle; round one hard-coded the band. */
            const tilt = span(tiltMid - AGAVE_SPREAD, tiltMid + AGAVE_SPREAD, n, k, 3);
            const ll = ((w / 2) * span(0.75, 1.0, n, k, 4)) / Math.max(0.5, Math.sin(tilt));
            const half = Math.sin(tilt) * ll / 2;
            bins.agaveLeaf.push({
              x: x + dx * half, y: g + (ll / 2) * Math.cos(tilt) + 0.03, z: z + dz * half,
              rot: a, rotX: tilt, scale: [0.035, ll, 0.012],
            });
            /* The terminal spine and the pale/red margin are the one feature
               that makes the genus legible at this distance. */
            bins.agaveSpine.push({
              x: x + dx * Math.sin(tilt) * ll, y: g + ll * Math.cos(tilt) + 0.03, z: z + dz * Math.sin(tilt) * ll,
              rot: a, rotX: tilt, scale: [0.014, 0.05, 0.014],
            });
          }
          plantCounts.agave++;
          if (centralReach.has(bed.id)) agaveCentral++;
        }
      }
    }
  }
  counts.agaveCentral = agaveCentral;

  /* The culm is ROUND and near-parallel-sided at 6x — half of why the Juncus
     identification is safe — so it is built at exactly the sourced diameter,
     not at a pair of hard-coded radii. */
  const culmDia = SP.juncus.culmDiameter;
  const culmGeo = new THREE.CylinderGeometry(culmDia / 2, culmDia / 2, 1, 4);
  const bladeGeo = new THREE.BoxGeometry(0.006, 1, 0.02);
  const spikeGeo = new THREE.CylinderGeometry(0.002, 0.004, 1, 4);
  const moundGeo = new THREE.IcosahedronGeometry(0.5, 1);
  const discGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 7);
  const stemGeo = new THREE.CylinderGeometry(0.004, 0.008, 1, 4);
  const racemeGeo = new THREE.ConeGeometry(0.5, 1, 6);
  const strapGeo = new THREE.BoxGeometry(1, 1, 1);
  const spineGeo = new THREE.ConeGeometry(0.5, 1, 4);

  const addInst = (name, geo, mat, items) => {
    if (!items.length) return;
    const m = instanced(geo, mat, items);
    m.name = name;
    group.add(m);
  };
  addInst("juncus-culm", culmGeo, plant(C.juncusFoliage), bins.juncusCulm);
  addInst("juncus-culm-elkblue", culmGeo, plant(C.juncusElkBlue), bins.juncusCulmBlue);
  addInst("juncus-seed", moundGeo, plant(C.juncusSeed), bins.juncusSeed);
  addInst("deergrass-blade", bladeGeo, plant(C.muhlenbergiaFoliage), bins.muhBlade);
  addInst("deergrass-spike", spikeGeo, plant(C.muhlenbergiaSpike), bins.muhSpike);
  addInst("verbena-mound", moundGeo, plant(C.verbenaFoliage), bins.verbenaMound);
  addInst("verbena-umbel", discGeo, plant(C.verbenaFlower), bins.verbenaUmbel);
  addInst("golden-branch", stemGeo, plant(C.goldenFoliage), bins.goldenBranch);
  addInst("golden-raceme", racemeGeo, plant(C.goldenRaceme), bins.goldenRaceme);
  addInst("dianella-leaf", strapGeo, plant(C.dianellaLeaf), bins.dianellaLeaf);
  addInst("baccharis-mound", moundGeo, plant(C.baccharisFoliage), bins.baccharisMound);
  addInst("agave-leaf", strapGeo, plant(C.agaveLeaf), bins.agaveLeaf);
  addInst("agave-spine", spineGeo, plant(C.agaveMargin), bins.agaveSpine);
  counts.plants = plantCounts;
  counts.plantTotal = Object.values(plantCounts).reduce((s, v) => s + v, 0);

  /* ------------------------------------------------------------ boulders */

  const B = SY.boulders;
  const boulders = [];
  for (let bi = 0; bi < braids.length; bi++) {
    const br = braids[bi];
    let s = 0;
    let k = 0;
    while (s < br.total) {
      const a = br.at(s);
      /* A drift runs down EACH margin of the channel — that is what "linear
         drifts along the arroyo margins" means, and it is the difference
         between 40 stones and the 60-90 SWA -2 reads down this reach. */
      for (const side of [-1, 1]) {
        const off = a.half + span(B.marginOffset[0], B.marginOffset[1], bi, k, side, 1);
        const x = a.x + a.nx * off * side;
        const z = a.z + a.nz * off * side;
        const host = bedOf(x, z);
        if (!host || host.surfaceWithheld) continue;
        if (nearClip(x, z, B.longAxis[1] / 2) || nearMass(x, z, B.longAxis[1] / 2)) continue;
        /* ONE uniform variate drives both axes, so the long stones are also
           the tall ones — but each is drawn TRIANGULAR about its OWN declared
           mode, because the two modes are not in the single-stone L : exposed-H
           ratio (1.00 x 0.55 = 0.55, against a declared mode of 0.50) and a
           mode is a statement about the population, not about one stone. */
        const u = hash(bi, k, side, 3);
        const L = triangular(B.longAxis[0], B.longAxis[1], B.longAxisMode, u);
        const exposed = triangular(B.exposedHeight[0], B.exposedHeight[1], B.exposedHeightMode, u);
        const W = L * (B.proportions[1] / B.proportions[0]);
        /* A third of the vertical axis below grade: with a semi-axis `sa` the
           centre sits at ground + sa/3 and the exposed cap is 4/3 sa, so the
           flat cut IS the mulch line and no boulder shows an under-shadow. */
        const sa = (3 * exposed) / 4;
        boulders.push({
          x, y: ground(x, z) + sa / 3, z,
          rot: Math.atan2(a.tx, a.tz) + span(-0.35, 0.35, bi, k, side, 5),
          rotZ: span(-0.12, 0.12, bi, k, side, 6),
          scale: [L, sa * 2, W],
        });
      }
      s += span(B.driftSpacing[0], B.driftSpacing[1], bi, k, 2);
      k++;
    }
  }
  addInst("ramble-boulder", new THREE.IcosahedronGeometry(0.5, 1), stone(C.boulderGranite), boulders);
  counts.boulders = boulders.length;

  /* ------------------------------------------------------------- bridges */

  const BR = SY.bridges;
  const G = SY.guardrail;
  const deckT = BR.deckEdgeBeam;
  const fascia = [];
  const pickets = [];
  const topRails = [];
  const bottomRails = [];
  let guardRuns = 0;
  /* THE CANONICAL DATUM IS DECK-TO-TOP-OF-RAIL, NOT DECK-TO-RAIL-CENTRE.
     eighthsiteworks owns this spec (`specOwner`) and states 1.067 m from the
     WALKING SURFACE to the TOP of the top rail; it implements that as a rail
     CENTRE at `height - topRail.thickness / 2`. Round two placed the centre at
     `height` here, which stood the built guard 1.091 m — 24 mm over the
     canonical figure — and ran the pickets up to the rail's centreline, i.e.
     48 mm into its lower half. Both are corrected: the rail centre drops half a
     tube, and a picket stops at the rail's UNDERSIDE, which is exactly one tube
     diameter below the top. Two implementations of one canonical spec may not
     disagree. */
  const railCentre = G.height - G.topRailDiameter / 2;
  const picketHeight = G.height - G.topRailDiameter;

  for (const br of M.bridges) {
    const r = br.ring;
    /* Deck top: a real slab standing on grade, not a decal — it crosses the
       swale and the guard stands on it. */
    const pos = [];
    fillPoly(pos, r, ground, deckT);
    if (pos.length) {
      const geo = drapedGeometry(pos, TILE.concrete);
      const mesh = new THREE.Mesh(geo, concrete(C[BR.color]));
      mesh.name = `${br.key}-deck`;
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      group.add(mesh);
    }
    const openings = new Set(br.openings);

    for (let i = 0; i < r.length - 1; i++) {
      const [ax, az] = r[i];
      const [bx, bz] = r[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 0.05) continue;
      const dir = Math.atan2(bx - ax, bz - az);
      const mx = (ax + bx) / 2, mz = (az + bz) / 2;
      const gy = ground(mx, mz);
      fascia.push({ x: mx, y: gy + deckT / 2, z: mz, rot: dir, scale: [BR.fasciaThickness, deckT, len] });

      if (openings.has(i)) {
        if (br.openingWidth <= 0 || br.openingWidth >= len) continue;
      }
      const runs = openings.has(i)
        ? [[0, (len - br.openingWidth) / 2], [(len + br.openingWidth) / 2, len]]
        : [[0, len]];
      for (const [s0, s1] of runs) {
        const runLen = s1 - s0;
        if (runLen < G.picketPitch * 2) continue;
        guardRuns++;
        const ux = (bx - ax) / len, uz = (bz - az) / len;
        const n = Math.floor(runLen / G.picketPitch);
        const pad = (runLen - (n - 1) * G.picketPitch) / 2;
        for (let k = 0; k < n; k++) {
          const t = s0 + pad + k * G.picketPitch;
          const px = ax + ux * t, pz = az + uz * t;
          pickets.push({ x: px, y: ground(px, pz) + deckT + picketHeight / 2, z: pz, scale: [1, picketHeight, 1] });
        }
        const rmx = ax + ux * (s0 + runLen / 2), rmz = az + uz * (s0 + runLen / 2);
        const ry = ground(rmx, rmz) + deckT;
        /* rotZ lays the unit cylinder on its side; the extra quarter turn on
           the yaw is what puts the resulting axis ALONG the run rather than
           across it (Euler "YXZ": the axis lands at (-cos rot, 0, sin rot)). */
        topRails.push({ x: rmx, y: ry + railCentre, z: rmz, rot: dir + Math.PI / 2, rotZ: Math.PI / 2, scale: [G.topRailDiameter / 0.05, runLen, G.topRailDiameter / 0.05] });
        bottomRails.push({ x: rmx, y: ry + G.bottomRailHeight, z: rmz, rot: dir + Math.PI / 2, rotZ: Math.PI / 2, scale: [G.bottomRailDiameter / 0.05, runLen, G.bottomRailDiameter / 0.05] });
      }
    }
  }
  addInst("bridge-fascia", new THREE.BoxGeometry(1, 1, 1), concrete(C[BR.color]), fascia);
  addInst("guard-picket", new THREE.CylinderGeometry(G.picketDiameter / 2, G.picketDiameter / 2, 1, 6), metal(C[G.color]), pickets);
  /* The two rails are separate families so each is gated against its own
     declared datum: the top rail's TOP against `height`, the bottom rail's
     centre against `bottomRailHeight`. One shared family let round two's
     24 mm error hide inside an average. */
  const railGeo = new THREE.CylinderGeometry(0.025, 0.025, 1, 8);
  addInst("guard-rail-top", railGeo, metal(C[G.color]), topRails);
  addInst("guard-rail-bottom", railGeo, metal(C[G.color]), bottomRails);
  /* NO BASE SHOES. Round two built 37 of them off `shoeSpacing: 1.5` and
     `shoe: [0.11, 0.012, 0.11]` — four figures with no source, no derivation
     and no mention in the canonical spec this section borrows, and shoes at
     1.5 m centres do not even correspond to anything in a guard whose only
     declared members are pickets at 0.1016 m and two rails. eighthsiteworks'
     canonical guard carries a KERB, not shoes, and this section has no kerb
     because the deck is the carrier. They are deleted, not re-derived, and
     the reason is on the record in `absent`. The pickets land on the deck. */
  counts.bridges = M.bridges.length;
  counts.guardRuns = guardRuns;
  counts.pickets = pickets.length;
  counts.guardRails = topRails.length + bottomRails.length;

  /* ------------------------------------------------- fixtures on paving */

  /** Points every `every` metres along a walk's derived centreline. */
  const alongWalk = (w, every, from = null) => {
    const out = [];
    let acc = from === null ? every * 0.5 : from;
    for (let i = 1; i < w.centre.length; i++) {
      const d = Math.hypot(w.centre[i][0] - w.centre[i - 1][0], w.centre[i][1] - w.centre[i - 1][1]);
      acc += d;
      if (acc >= every) { acc = 0; out.push(w.centre[i]); }
    }
    return out;
  };
  const byBand = (b) => walks.filter((w) => w.pair.band === b).sort((x, y) => y.quads - x.quads);

  /* LIGHTING AND BIKE PARKING LEFT THIS SECTION (arbitrated 2026-08-19).
     Three luminaire families (A, B, C) and a single-post P-loop bike rack used
     to be placed here along the derived walk centrelines. Both went to
     eighthsiteworks: it is the only section with fitted single-view metrology
     for the poles — two independently solved horizons 1.7% apart — and at 10x
     the rack resolves as two separate legs with a flange at each foot, which
     is an inverted-U staple hoop and not a P-loop. This section's own 6:1 head
     aspect survives inside eighthsiteworks' canonical L1 shade. `alongWalk`
     and `byBand` stay: the fixture placer below still uses them. */

  /* Planter cubes: re-seated onto the surveyed wide paved band. */
  const PC = SY.planterCubes;
  const cubes = [], cubeSoil = [];
  /* Widest paved band first, and on down the list until all four are seated:
     the surveyed gaps are short, and a cube left unplaced would silently drop
     a corroborated object rather than move it. */
  for (const w of byBand(6)) {
    for (const p of alongWalk(w, PC.spacing)) {
      if (cubes.length >= PC.count) break;
      const g = ground(p[0], p[1]);
      cubes.push({ x: p[0], y: g + PC.size[2] / 2, z: p[1], scale: [PC.size[0], PC.size[2], PC.size[1]] });
      /* The planted mass: inset by the cube's own wall on each plan axis, its
         face `soilRecess` below the rim, `soilDepth` of visible mulch. Three
         declared figures where round one had three bare numbers. */
      const inset = PC.wallThickness * 2;
      cubeSoil.push({
        x: p[0], y: g + PC.size[2] - PC.soilRecess - PC.soilDepth / 2, z: p[1],
        scale: [PC.size[0] - inset, PC.soilDepth, PC.size[1] - inset],
      });
    }
    if (cubes.length >= PC.count) break;
  }
  addInst("planter-cube", new THREE.BoxGeometry(1, 1, 1), concrete(C[PC.color]), cubes);
  addInst("planter-soil", new THREE.BoxGeometry(1, 1, 1), plant(C.mulchBark), cubeSoil);
  counts.planterCubes = cubes.length;

  /* ------------------------------------------------ weirs, drains, minor */

  /* The band is a box of 2 x bandProud CENTRED on the wash's own rung of the
     shared ladder, so exactly `bandProud` stands above the crushed rock and
     the rest is under it. That is one declared figure doing all the work: no
     local lift constant, no undeclared height. It spans the channel bank to
     bank — the braid's own local half-width, doubled, with no multiplier. */
  const W = SY.checkWeirs;
  const weirs = [];
  for (let bi = 0; bi < braids.length; bi++) {
    const br = braids[bi];
    for (let s = W.interval; s < br.total; s += W.interval) {
      const a = br.at(s);
      if (!bedOf(a.x, a.z) || inClip(a.x, a.z) || nearMass(a.x, a.z, a.half)) continue;
      weirs.push({
        x: a.x, y: ground(a.x, a.z) + overlayLift(SY.arroyo.rung), z: a.z,
        rot: Math.atan2(a.tx, a.tz),
        scale: [a.half * 2, W.bandProud * 2, W.bandWidth],
      });
    }
  }
  addInst("check-weir", new THREE.BoxGeometry(1, 1, 1), concrete(C[W.color]), weirs);
  counts.checkWeirs = weirs.length;

  /* "No raised frame — so no hovering geometry": the grate is a slab of its
     own declared thickness whose TOP is exactly the rung of the surface it is
     set into. The two swale drains sit in the wash, so they take the arroyo's
     rung; the paved one sits in the concrete walk, so it takes the walk's.
     Round one put all three on the arroyo rung plus a local 0.005 lift. */
  const D = SY.areaDrains;
  const drains = [];
  const grateTop = (rung) => overlayLift(rung) - D.grateThickness / 2;
  const central = braids.filter((b) => b.reach === "central");
  for (let k = 0; k < D.swaleCount; k++) {
    const br = central[k % Math.max(1, central.length)];
    if (!br) break;
    const frac = 0.35 + k * 0.37;
    for (let s = br.total * frac; s < br.total; s += 0.5) {
      const a = br.at(s);
      if (!bedOf(a.x, a.z) || inClip(a.x, a.z) || nearMass(a.x, a.z, 0.5)) continue;
      drains.push({ x: a.x, y: ground(a.x, a.z) + grateTop(SY.arroyo.rung), z: a.z, rot: Math.atan2(a.tx, a.tz), scale: [D.swaleSize[0], D.grateThickness, D.swaleSize[1]] });
      break;
    }
  }
  const primary = byBand(2.4)[0];
  if (primary && primary.centre.length > 4) {
    for (let k = 0; k < D.paveCount; k++) {
      const p = primary.centre[Math.floor(primary.centre.length * 0.5)];
      drains.push({ x: p[0], y: ground(p[0], p[1]) + grateTop(SY.concreteWalks.rung), z: p[1], scale: [D.paveSize[0], D.grateThickness, D.paveSize[1]] });
    }
  }
  addInst("area-drain", new THREE.BoxGeometry(1, 1, 1), metal(C[D.color]), drains);
  counts.areaDrains = drains.length;

  const MF = SY.minorFixtures;
  const cabinets = [], fdc = [], columns = [];
  const pick = (w, frac) => (w && w.centre.length ? w.centre[Math.floor(w.centre.length * frac)] : null);
  const w24 = byBand(2.4);
  const w21 = byBand(2.1);
  const c1 = pick(w24[1] || w24[0], 0.3);
  if (c1) cabinets.push({ x: c1[0], y: ground(c1[0], c1[1]) + MF.utilityCabinet.size[1] / 2, z: c1[1], scale: [MF.utilityCabinet.size[0], MF.utilityCabinet.size[1], MF.utilityCabinet.size[2]] });
  for (let k = 0; k < MF.fdcBollard.count; k++) {
    const p = pick(w24[k % Math.max(1, w24.length)], 0.6 + k * 0.12);
    if (!p) break;
    /* CylinderGeometry(0.5, ...) is a UNIT-DIAMETER cylinder, so the scale is
       the diameter itself. Round one divided by 0.5 as well and built every
       FDC bollard at 0.40 m across against a declared 0.20 m — a sourced
       figure contradicted by the geometry that claimed to use it. */
    fdc.push({ x: p[0], y: ground(p[0], p[1]) + MF.fdcBollard.height / 2, z: p[1], scale: [MF.fdcBollard.diameter, MF.fdcBollard.height, MF.fdcBollard.diameter] });
  }
  const c3 = pick(w21[0], 0.42);
  if (c3) columns.push({ x: c3[0], y: ground(c3[0], c3[1]) + MF.wayfindingColumn.size[1] / 2, z: c3[1], rot: 0.4, scale: MF.wayfindingColumn.size });
  addInst("utility-cabinet", new THREE.BoxGeometry(1, 1, 1), painted(C[MF.utilityCabinet.color]), cabinets);
  addInst("fdc-bollard", new THREE.CylinderGeometry(0.5, 0.5, 1, 10), painted(C[MF.fdcBollard.color]), fdc);
  addInst("wayfinding-column", new THREE.BoxGeometry(1, 1, 1), painted(C[MF.wayfindingColumn.color]), columns);
  counts.utilityCabinets = cabinets.length;
  counts.fdcBollards = fdc.length;
  counts.wayfindingColumns = columns.length;

  counts.draws = group.children.length;
  counts.instances = group.children.reduce((s, c) => s + (c.isInstancedMesh ? c.count : 0), 0);

  scene?.add(group);
  return { group, counts };
}
