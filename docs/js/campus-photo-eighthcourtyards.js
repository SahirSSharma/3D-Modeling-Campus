// Eighth College's courtyards and hardscape, from photographs — INVENTED class.
//
// HKS (design architect) + EYRC with SWA Group (landscape), 2021-2023. This is
// the HARDSCAPE of the Theatre District Living & Learning Neighborhood: the
// paving, the flush steel edging and garden bands, the level change (stairs,
// terraces, retaining and seat walls, guards and rails), the Bamboo Garden
// floor, the Sun Lawn, and the ONE anchored structure still this section's —
// the north parking-elevator block. It exists to close three withholdings
// campus-eighth.js declared.
//
// WHAT THIS FILE USED TO CONTAIN AND NO LONGER DOES (arbitrated 2026-08-19,
// extended by the repair of 2026-08-19). The first draft also built the Meditation Pavilion, the Tea House, the two
// basketball standards, three luminaire families, the bike racks, the bins,
// towers, standpipes and cabinets, the loose furniture, the fire features and
// the whole Ramble — every one of them ALSO built by a sibling section off the
// same photographs, and it lost each collision on evidence. They went to
// eighthgathering (both pavilions, the furniture, the fire features),
// eighthsiteworks (the court hardware, all lighting, all bike parking, the
// waste and blue-light fixtures, and the canonical guard and handrail SPEC
// this file's level change now applies) and eighthramble (the swale corridor).
// THREE MORE LEFT IN THE REPAIR, because the arbitration never reached them.
// The safety-orange calisthenics rig: this file and eighthsiteworks each built
// one, at different sizes 4.9 m apart, and campus-photo-pulsefitness.js now owns
// it outright. The grill station: built here from an [estimated] position and by
// eighthgathering ANCHORED on surveyed ring #2375, 30 m apart. The public-art
// wall at The Social: a carrier for a commission eighthgathering builds 40 m
// away, so a wall carrying nothing. Stair S6's record went with the Tea House
// that anchored it. Each departure is named in the section's `absent`. The rule that produced
// them all: an anchored object beats a scattered one, and a section may build
// only what it owns the carrier for.
//
// THREE THINGS DECIDED THE SHAPE OF THIS FILE.
//
//   1. THE PAVING WAS NEVER MISSING — IT WAS NEVER READ. campus-eighth.js
//      withheld "the angular concrete plate mosaic" for want of per-plate
//      geometry AND a registered extent, and shipped a 30-degree scoring as
//      its honest weak form. Both halves of that are now answered. There are
//      no plates: SWA -12, a near-overhead drone frame, resolves the units as
//      a narrow-modular 2:1 paver in a three-to-four-grey random BLEND — the
//      "mosaic" is the colour blend and the angular FIELD boundaries, not
//      irregular plate outlines. And the extent has been in the repo the whole
//      time: `arcgis.ground[3632]` is one k:"walk" multipolygon, one outer ring
//      and 213 holes that punch out every bed, lawn, garden island and the
//      court. Cut to these bounds, with every campus-arcgis massing ring
//      subtracted as well (the holes do NOT punch out the buildings — 1,645 m2
//      of that layer runs under the TDLLN masses), it yields 9,785 m2 in 1,342
//      exact scanline spans, each strip cut wherever ANY part of it overlaps
//      rather than only where its centre line does. Nothing here is traced.
//      TWO FURTHER SUBTRACTIONS, BOTH ADDED 2026-08-19 AND BOTH CORRECTIONS.
//      ground[3632] is the CAMPUS-WIDE walk layer, so the bounds alone left
//      1,929 m2 of Keeling, Galbraith and Revelle approach taking Eighth's
//      photographed paver blend — appearance applied to ground no frame here
//      covers. `measured.paving.collegeClip` cuts it at two survey vertices:
//      z >= 499.6, the north face of the northernmost TDLLN mass, and
//      x <= -24.3, the east face of the easternmost. And the holes do not punch
//      out the ten campus-eighth.json bed rings this section carries and edges
//      — eighthramble plants them, but this section's own gravel, turf and
//      flush steel edge all meet them — so paving was drawn inside surveyed
//      beds, coplanar with the decals on the same rung; every carried ring is
//      now subtracted too. What
//      ships is 7,856 m2 in 1,225 spans, and the test re-derives every one of
//      them from campus-arcgis.json and campus-eighth.json.
//
//   2. THE "SMOOTH LIDAR, THEREFORE NO STEPS" ARGUMENT IS VOID OVER EIGHTH,
//      and it was load-bearing. campus-eighth.js omits every stair, terrace,
//      retaining and seat wall partly because "the 2014 LiDAR under the
//      courtyard is smooth to 1.5% over 150 m with no step anywhere, so there
//      is no built grade for a flight to descend or a wall to retain". The
//      2014 LiDAR is describing a parking lot that was demolished in 2021: it
//      is blind to this college (campus-lidar.json massHeights has no entry for
//      any Eighth mass; campus-massing.js:16 records that it measures Sankofa
//      at parking-lot height). Existence is settled by eleven dated 2024-25
//      photographs. POSITION is the real problem, and it is settled only where
//      the survey or the georegistered 2025 site plan reaches — so the court's
//      26.8 m retaining wall (anchored on surveyed hedge strip #1761), the
//      Bamboo Garden's LED seat terrace (inside surveyed island ring 193 and
//      clear of eighthgathering's pavilion) and the academic stair are BUILT,
//      and the ramp, the bridge, three of the six flights and 233 m of wall are
//      in `absent` with the reason. The Tea House plinth steps went to
//      eighthgathering with the plinth that anchored them. Better absent than a flight descending into nothing.
//
//   3. AN [estimated] POSITION IS STILL A RULE, NEVER A GUESS — AND THE RULE'S
//      DOMAIN IS SURVEYED TOO. Where a photograph gives a count but no station,
//      the object is rejection-sampled from the section's pinned seed and
//      REJECTED unless its WHOLE footprint lands on measured paved spans, so
//      nothing can stand in a surveyed bed, on a lawn, or inside a building.
//      The domain it samples from used to be seven typed rectangles — no
//      source, no derivation, no tier — and they placed some 250 objects.
//      Every one of those objects went to a sibling in the 2026-08-19
//      arbitration; the six orphaned rectangles are DELETED and the one that
//      survives, The Social, is now derived edge by edge from two massing
//      rings: z from Podemos' south face to Sankofa Base's north face, x from
//      the overlap of their extents. The Social's synthetic turf panel is the
//      case where the rule said no — no paved run accepts its photographed
//      10 x 6 m — and it is `absent` rather than shrunk to fit.
//
// Colours are DATA: every hex comes from the section's `colors` block, and
// every role has a `colorSources` entry saying whether it is measured on a
// dated frame, carried verbatim from the shipped `eighth` section (same
// college, same photograph set), or [estimated] naming what it extends.
// Surfaces come from campus-materials.js; the library only supplies
// microstructure, at true unit scale — the paver joints are the library's,
// which is why no joint colour is invented here.
//
// Ground decals ride campus-overlay.js's ladder on the `carpet` rung, one rung
// ABOVE campus-eighth.js's `pad` repaint, so the two never z-fight and the
// older repaint stays as the fallback if this module fails to load. No lift
// constant is defined here.
//
// Deterministic: nothing here calls the platform's random or clock APIs. One
// `hash` off the section's pinned seed, the same idiom keeling and york use.
import * as THREE from "../vendor/three/three.module.min.js";
import { applyOverlayDepth, OVERLAY, overlayLift } from "./campus-overlay.js";
import { createMaterialLibrary } from "./campus-materials.js";

const CARPET = "carpet";

let LIB = null;
const lib = () => (LIB ??= createMaterialLibrary(THREE));

const concrete = (color) => lib().get("smoothConcrete", { color });
/**
 * Masonry at TRUE COURSING.
 *
 * campus-materials.js FIELDS.brick lays COURSES = 8 by PER = 4 units in one
 * texture tile, so a tile is 8 courses tall and 4 units wide. Handed no repeat
 * it stretches those eight courses over whatever the mesh is — 0.6 m "bricks"
 * on a 4.8 m box. `repeat` is therefore computed from the section's MEASURED
 * CMU module (0.203 m course, 0.406 m unit) and the face it covers, so the
 * coursing that SWA -18 was measured on is the coursing that renders.
 */
const masonry = (color, repeat) => lib().get("brick", { color, repeat });

/**
 * Texture repeat for one masonry face, from the measured CMU module.
 *
 * The 4 and the 8 are FIELDS.brick's own PER and COURSES. They are literals
 * here because the library exports the field, not its grid — but the test
 * parses both constants out of campus-materials.js and re-derives every repeat
 * from them, so the day the library regrids, this fails rather than silently
 * rendering the wrong course.
 */
function cmuRepeat(section, w, h) {
  const M = section.levelChange.seatWalls;
  return [w / (4 * M.unitLength), h / (8 * M.courseHeight)];
}
const metal = (color) => lib().get("metalPanel", { color, metalness: 0.55, roughness: 0.5 });
const painted = (color) => lib().get("metalPanel", { color, metalness: 0.3, roughness: 0.6 });
/* Plant clumps stay a plain standard material: the library's foliage class is
   an alpha-cut CARD map and cutting holes in clump geometry shreds it. */
const foliage = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0.0 });

/** A ground decal in a named material class, at a real-world tile size. */
function decal(color, rung, cls, repeat) {
  return applyOverlayDepth(lib().get(cls, { color, repeat }), rung);
}

/** Deterministic 0..1 from any integer mix — a reload rebuilds the same ground. */
function hash(...ns) {
  let s = 0;
  for (let i = 0; i < ns.length; i++) s = s * 131.71 + ns[i] * 57.13 + 7.9;
  const v = Math.sin(s) * 43758.5453;
  return v - Math.floor(v);
}

/** One InstancedMesh from a list of placements. */
function instanced(name, geo, mat, items, place = (it) => it) {
  const mesh = new THREE.InstancedMesh(geo, mat, items.length);
  mesh.name = name;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const pos = new THREE.Vector3();
  items.forEach((it, i) => {
    const p = place(it, i);
    e.set(p.rotX || 0, p.rot || 0, p.rotZ || 0, "YXZ");
    q.setFromEuler(e);
    s.set(p.scale?.[0] ?? 1, p.scale?.[1] ?? 1, p.scale?.[2] ?? 1);
    pos.set(p.x, p.y, p.z);
    m.compose(pos, q, s);
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

const UNIT = () => new THREE.BoxGeometry(1, 1, 1);

/* ------------------------------------------------------------ span index */

/**
 * The measured paved extent, indexed by row for O(1) lookup. `spans` is
 * `[[z, x0, x1], ...]` straight out of the section — the exact scanline of
 * arcgis.ground[3632] minus its 213 holes minus every massing ring.
 */
function pavingIndex(section) {
  const pitch = section.measured.paving.rowPitch;
  const rows = new Map();
  for (const [z, x0, x1] of section.measured.paving.spans) {
    const key = Math.round(z / pitch);
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key).push([x0, x1]);
  }
  const at = (x, z) => {
    const r = rows.get(Math.round((z - pitch / 2) / pitch));
    return !!r && r.some(([a, b]) => x >= a && x <= b);
  };
  /* A whole footprint on paving, sampled on a 0.5 m grid — the same predicate
     the section's [estimated] positions were solved with. */
  const rect = (cx, cz, w, d) => {
    const nx = Math.max(1, Math.round(w / 0.5));
    const nz = Math.max(1, Math.round(d / 0.5));
    for (let i = 0; i <= nx; i++) {
      for (let j = 0; j <= nz; j++) {
        if (!at(cx - w / 2 + (w * i) / nx, cz - d / 2 + (d * j) / nz)) return false;
      }
    }
    return true;
  };
  return { rows, at, rect, pitch };
}

/** Point-in-ring, for the surveyed bed / lawn / island polygons. */
function inRing(x, z, r) {
  let ins = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, zi] = r[i];
    const [xj, zj] = r[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
}

/**
 * The buildings, as a keep-out.
 *
 * The green survey layer does NOT agree with the massing layer: arcgis.ground
 * #2703, a courtyard ring, runs about 20 m under the drawn Sankofa Base. The
 * survey is the authority on a bed's extent and the massing is the authority on
 * where a building stands, so where the two overlap the building wins and the
 * bed is cut. Without this the mulch, the cobble, the boulders and the flush
 * steel edging all ran under a 4.3 m plinth.
 */
function keepOut(section) {
  const rings = (section.measured.keepOut?.rings || []).map((r) => ({
    ring: r.points,
    bb: r.points.reduce(
      (b, [x, z]) => ({
        x0: Math.min(b.x0, x), x1: Math.max(b.x1, x),
        z0: Math.min(b.z0, z), z1: Math.max(b.z1, z),
      }),
      { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity }
    ),
  }));
  const has = (x, z) => rings.some((r) =>
    x >= r.bb.x0 && x <= r.bb.x1 && z >= r.bb.z0 && z <= r.bb.z1 && inRing(x, z, r.ring));
  /* Cut a span row, probing both row edges as well as its centre so a strip is
     removed wherever ANY part of it overlaps a building — the same
     conservative quantisation the paving scanline uses. */
  const cut = (spans, pitch) => {
    const out = [];
    for (const [z, x0, x1] of spans) {
      let cur = [[x0, x1]];
      for (const r of rings) {
        if (z + pitch < r.bb.z0 || z - pitch > r.bb.z1) continue;
        for (const pz of [z - pitch / 2 + 1e-6, z, z + pitch / 2 - 1e-6]) {
          for (const [c0, c1] of ringCross(r.ring, pz)) {
            const nx = [];
            for (const [s0, s1] of cur) {
              if (c1 <= s0 || c0 >= s1) { nx.push([s0, s1]); continue; }
              if (c0 > s0) nx.push([s0, Math.min(c0, s1)]);
              if (c1 < s1) nx.push([Math.max(c1, s0), s1]);
            }
            cur = nx;
          }
        }
      }
      for (const [a, b] of cur) if (b - a >= 0.3) out.push([z, a, b]);
    }
    return out;
  };
  return { has, cut };
}

/** Paired x-crossings of a ring at a row. */
function ringCross(ring, z) {
  const xs = [];
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i];
    const [bx, bz] = ring[(i + 1) % ring.length];
    if ((az <= z) === (bz <= z)) continue;
    xs.push(ax + ((bx - ax) * (z - az)) / (bz - az));
  }
  xs.sort((p, q) => p - q);
  const out = [];
  for (let i = 0; i + 1 < xs.length; i += 2) out.push([xs[i], xs[i + 1]]);
  return out;
}

/**
 * Subtract a rectangle from a span list, IN X, keeping what is outside it.
 *
 * The Bamboo Garden's own gravel used to test only the MIDPOINT of a span
 * against this rect. Across the pavilion spine the island resolves as one
 * continuous 30 m span whose midpoint falls inside the rect, so the whole span
 * went — 8 spans and 215 m2 dropped where only 119 m2 was ever inside, and
 * 96 m2 of island fell back to campus-eighth.js's `pad` repaint. A span that
 * crosses a keep-out is CUT by it, exactly as `keepOut.cut` cuts by a building:
 * both row edges are tested as well as the centre, so a strip goes wherever ANY
 * part of it overlaps.
 */
function cutRect(spans, pitch, rect, clear) {
  const x0 = rect.x0 - clear;
  const x1 = rect.x1 + clear;
  const z0 = rect.z0 - clear;
  const z1 = rect.z1 + clear;
  const out = [];
  for (const [z, a, b] of spans) {
    if (z + pitch / 2 <= z0 || z - pitch / 2 >= z1 || x1 <= a || x0 >= b) {
      out.push([z, a, b]);
      continue;
    }
    if (x0 > a && x0 - a >= 0.3) out.push([z, a, Math.min(x0, b)]);
    if (x1 < b && b - x1 >= 0.3) out.push([z, Math.max(x1, a), b]);
  }
  return out;
}

/** Does an axis-aligned footprint touch a keep-out rectangle, plus clearance? */
function hitsRect(cx, cz, w, d, rect, clear) {
  return !(cx + w / 2 <= rect.x0 - clear || cx - w / 2 >= rect.x1 + clear
    || cz + d / 2 <= rect.z0 - clear || cz - d / 2 >= rect.z1 + clear);
}

/** Scanline spans of a surveyed ring at `pitch`, so a bed fills like the paving. */
function ringSpans(ring, pitch) {
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const [, z] of ring) {
    if (z < z0) z0 = z;
    if (z > z1) z1 = z;
  }
  const out = [];
  const start = Math.floor(z0 / pitch) * pitch + pitch / 2;
  for (let z = start; z < z1; z += pitch) {
    const xs = [];
    for (let i = 0; i < ring.length; i++) {
      const [ax, az] = ring[i];
      const [bx, bz] = ring[(i + 1) % ring.length];
      if ((az <= z) === (bz <= z)) continue;
      xs.push(ax + ((bx - ax) * (z - az)) / (bz - az));
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      if (xs[i + 1] - xs[i] < 0.25) continue;
      out.push([z, xs[i], xs[i + 1]]);
    }
  }
  return out;
}

/**
 * Strip quads for a span list, MERGED into one geometry with WORLD-PLANAR UVs.
 *
 * Instancing is the wrong tool here and the reason is the texture: every span
 * is a different length, an InstancedMesh shares one material, and a material
 * carries one uv repeat — so an instanced field either stretches the paver
 * grain along a 75 m span or squashes it on a 1 m one. Merged, each vertex
 * carries uv = (x / tile[0], z / tile[1]), so the unit size is TRUE everywhere
 * and the whole family is still a single draw. The joints in the paving are the
 * library's, at the real measured unit size; no joint colour is invented.
 *
 * `tile` IS THE MEASURED UNIT TIMES SIX, AND ANISOTROPIC, AND BOTH HALVES OF
 * THAT MATTER. FIELDS.pavingConcreteUnit lays a 6 x 6 grid of units inside one
 * texture tile (campus-materials.js:175), so handing it the unit size itself
 * renders every paver at a sixth of what was measured — the 0.315 m P2 unit
 * drew at 52 mm, which is what round one shipped. And the units are 2:1, so one
 * scalar tile would render a 0.315 x 0.157 m paver square. The section carries
 * tile as a two-element array and the test re-derives it from `unit`.
 */
function stripMesh(name, spans, pitch, color, cls, tile, rung, ground) {
  const [tu, tv] = tile;
  const pos = [];
  const uv = [];
  const nrm = [];
  const lift = overlayLift(rung);
  const half = pitch / 2;
  for (const [z, x0, x1] of spans) {
    const za = z - half;
    const zb = z + half;
    const corners = [[x0, za], [x1, za], [x1, zb], [x0, zb]];
    const y = corners.map(([x, cz]) => ground(x, cz) + lift);
    for (const [a, b, c] of [[0, 2, 1], [0, 3, 2]]) {
      for (const i of [a, b, c]) {
        pos.push(corners[i][0], y[i], corners[i][1]);
        uv.push(corners[i][0] / tu, corners[i][1] / tv);
        nrm.push(0, 1, 0);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  const mesh = new THREE.Mesh(geo, decal(color, rung, cls));
  mesh.name = name;
  mesh.renderOrder = OVERLAY[rung].renderOrder;
  mesh.receiveShadow = true;
  return mesh;
}

/* ---------------------------------------------------------- the paving */

/**
 * The court apron rectangle, DERIVED rather than typed.
 *
 * Round one carried `{x -190..-158, z 512..537}` with no derivation. It is the
 * surveyed court (measured.court.rect, arcgis.ground#3898) grown by
 * `court.apron.reach` — the widest paved run adjacent to the court in the
 * shipped span table, 5.48 m on the west against 2.44-2.48 m on all 25 east
 * rows. Every number in the result is a survey consequence.
 */
function apronRect(section) {
  const c = section.measured.court.rect;
  const r = section.court.apron.reach;
  const t3 = (v) => Math.round(v * 1000) / 1000;
  return { x0: t3(c.x0 - r), x1: t3(c.x1 + r), z0: t3(c.z0 - r), z1: t3(c.z1 + r) };
}

function buildPaving(section, group, ground, counts) {
  const P = section.paving;
  const pitch = section.measured.paving.rowPitch;
  const inZone = (x, z, r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
  /* A zone that declares `derive` is not read from the file — it is rebuilt
     here, so the file's copy is a checkable record and not the source. */
  const rectOf = (zone) => (zone.derive === "courtApron" ? apronRect(section) : zone.rect);
  const bins = {};
  for (const key of Object.keys(P.families)) bins[key] = [];
  for (const s of section.measured.paving.spans) {
    const [z, x0, x1] = s;
    const cx = (x0 + x1) / 2;
    let fam = P.default;
    for (const zone of P.zones) {
      if (inZone(cx, z, rectOf(zone))) { fam = zone.family; break; }
    }
    bins[fam].push(s);
  }
  const g = new THREE.Group();
  g.name = "eighth-courtyards-paving";
  for (const [key, spans] of Object.entries(bins)) {
    if (!spans.length) continue;
    const f = P.families[key];
    g.add(stripMesh(`paving-${key}`, spans, pitch, section.colors[f.color], f.material, f.tile, P.rung, ground));
    counts[`paving${key}`] = spans.length;
  }
  group.add(g);
  counts.pavingStrips = section.measured.paving.spans.length;
  return bins;
}

/* --------------------------------------------- bed edging + garden bands */

/**
 * The rings this section runs a flush steel bed edge along.
 *
 * DECLARED IN THE SECTION, NOT HERE (repair 2026-08-19). The list used to be six
 * hard-coded lookups in `createPhotoEighthCourtyards`, which meant 226 m of the
 * reported 1,152 m ran round arcgis.ground#1160 — a ring whose SURFACE this
 * section withholds in `absent` — with the justification written nowhere.
 * `edging.rings` now carries one entry per ring saying why that boundary takes
 * an edge, and the two rings carried for CLIPPING only (the Tea House island and
 * the paved pavilion slab) are absent from it by name.
 */
function edgedRings(section) {
  const R = section.measured.rings;
  const out = [];
  for (const e of section.edging.rings) {
    if (e.set) out.push(...R[e.set].map((b) => b.points));
    else out.push(R[e.key].points);
  }
  return out;
}

function buildEdging(section, group, ground, blocked, counts) {
  const E = section.edging;
  const ringsUsed = edgedRings(section);
  const parts = [];
  let run = 0;
  for (const ring of ringsUsed) {
    for (let i = 0; i < ring.length; i++) {
      const [ax, az] = ring[i];
      const [bx, bz] = ring[(i + 1) % ring.length];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 0.25) continue;
      /* A bed edge that runs under a building is a survey/massing conflict,
         not an edge — the building wins. */
      if (blocked.has((ax + bx) / 2, (az + bz) / 2)) continue;
      run += len;
      /* Cut long segments so the strip follows the drawn terrain instead of
         bridging a dip in it. */
      const n = Math.max(1, Math.ceil(len / 4));
      for (let k = 0; k < n; k++) {
        const t0 = k / n;
        const t1 = (k + 1) / n;
        const mx = ax + (bx - ax) * (t0 + t1) / 2;
        const mz = az + (bz - az) * (t0 + t1) / 2;
        parts.push({
          x: mx,
          y: ground(mx, mz) + E.proud - E.face / 2,
          z: mz,
          rot: Math.atan2(-(bz - az), bx - ax),
          scale: [(len * (t1 - t0)) + 0.02, E.face, E.thickness],
        });
      }
    }
  }
  group.add(instanced("edge-steel", UNIT(), metal(section.colors[E.color]), parts));
  counts.edgingSegments = parts.length;
  counts.edgingMetres = Math.round(run);
}

function buildGardenBands(section, group, ground, blocked, counts) {
  const B = section.edging.gardenBands;
  const PC = section.bambooGarden.pavilionClip;
  const ring = section.measured.rings.bambooGarden.points;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, z] of ring) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x);
    z0 = Math.min(z0, z); z1 = Math.max(z1, z);
  }
  const parts = [];
  /* Every band is clipped to the surveyed island span by span, so no band runs
     out over the paving, AND cut by eighthgathering's pavilion. Two of the eight
     used to run straight across the pavilion deck and bark field: they were the
     only two the courtyard-328/329 rings did not already split, and they were
     continuous precisely BECAUSE they crossed the pavilion spine. */
  const island = cutRect(blocked.cut(ringSpans(ring, 0.5), 0.5), 0.5, PC.rect, PC.clearance);
  let drew = 0;
  for (let i = 0; i < B.count; i++) {
    const z = z0 + ((i + 1) * (z1 - z0)) / (B.count + 1);
    let n = 0;
    for (const [, a, b] of island.filter(([sz]) => Math.abs(sz - z) <= 0.25)) {
      const cx = (a + b) / 2;
      parts.push({
        x: cx, y: ground(cx, z) + 0.005 - B.width / 4, z,
        scale: [b - a, B.width / 2, B.width],
      });
      n++;
    }
    if (n) drew++;
  }
  group.add(instanced("garden-band", UNIT(), metal(section.colors[section.edging.color]), parts));
  /* The COUNT OF BANDS THAT DREW, not `B.count` restated. The old line was set
     to B.count unconditionally, so the gate that compares them stayed green even
     if every band clipped away to nothing. */
  counts.gardenBands = drew;
  counts.gardenBandSegments = parts.length;
}

/* ----------------------------------------------------------- level change */

/** A run of wall, segmented so it follows the drawn terrain and never floats. */
function wallRun(a, b, height, thickness, segment, skirt, ground, out, capOut, cap) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(1, Math.ceil(len / segment));
  const rot = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n;
    const x = a[0] + (b[0] - a[0]) * t;
    const z = a[1] + (b[1] - a[1]) * t;
    const g = ground(x, z);
    out.push({
      x, y: g + (height - skirt) / 2, z, rot,
      scale: [len / n + 0.02, height + skirt, thickness],
    });
    if (cap) {
      capOut.push({
        x, y: g + height + cap.height / 2, z, rot,
        scale: [len / n + 0.02, cap.height, thickness + 2 * cap.proud],
      });
    }
  }
  return { len, rot };
}

/** Picket guard along a run, seated on whatever carries it. */
function guardRun(G, a, b, topY, out) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ux = (b[0] - a[0]) / len;
  const uz = (b[1] - a[1]) / len;
  const rot = Math.atan2(-uz, ux);
  const cx = (a[0] + b[0]) / 2;
  const cz = (a[1] + b[1]) / 2;
  out.rails.push({ x: cx, y: topY + G.height - G.topRail / 2, z: cz, rot, scale: [len, G.topRail, G.topRail] });
  out.rails.push({ x: cx, y: topY + G.lowerRailHeight, z: cz, rot, scale: [len, G.lowerRail, G.lowerRail] });
  const posts = Math.max(1, Math.round(len / G.postSpacing));
  for (let i = 0; i <= posts; i++) {
    const u = (i / posts) * len;
    out.posts.push({
      x: a[0] + ux * u, y: topY + G.height / 2, z: a[1] + uz * u, rot,
      scale: [G.post, G.height, G.post],
    });
  }
  const pickets = Math.max(1, Math.round(len / G.picketPitch));
  for (let i = 0; i < pickets; i++) {
    const u = ((i + 0.5) / pickets) * len;
    out.pickets.push({
      x: a[0] + ux * u, y: topY + (G.height - G.topRail) / 2, z: a[1] + uz * u, rot,
      scale: [G.picketDia, G.height - G.topRail, G.picketDia],
    });
  }
}

function buildLevelChange(section, group, ground, paving, counts) {
  const L = section.levelChange;
  const C = section.colors;
  const g = new THREE.Group();
  g.name = "eighth-courtyards-levelchange";

  const walls = [];
  const caps = [];
  const guard = { posts: [], rails: [], pickets: [] };
  const treads = [];
  const risers = [];
  const stepLights = [];
  const rails = [];

  /* W1 — tan cast-in-place retaining, with the guard where the drop needs it. */
  for (const r of L.retaining.runs) {
    wallRun(r.a, r.b, r.height, L.retaining.thickness, L.retaining.segment, L.retaining.skirt, ground, walls, caps, null);
    if (r.height >= L.retaining.guardAbove) {
      const mid = ground((r.a[0] + r.b[0]) / 2, (r.a[1] + r.b[1]) / 2);
      guardRun(L.guard, r.a, r.b, mid + r.height, guard);
      counts.guardRuns = (counts.guardRuns || 0) + 1;
    }
  }
  counts.retainingMetres = Math.round(
    L.retaining.runs.reduce((s, r) => s + Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]), 0)
  );
  g.add(instanced("retain-wall", UNIT(), concrete(C[L.retaining.color]), walls));

  /* W2 — buff burnished CMU seat walls under a cast-stone cap. */
  const seat = [];
  const seatCaps = [];
  for (const r of L.seatWalls.runs) {
    wallRun(r.a, r.b, L.seatWalls.height, L.seatWalls.thickness, L.retaining.segment, L.retaining.skirt,
      ground, seat, seatCaps, { height: L.seatWalls.cap, proud: L.seatWalls.capProud });
  }
  /* The coursing is the measurement. Every wallRun segment of one run is the
     same size by construction, so one repeat carries the whole family at the
     measured 0.203 m course and 0.406 m unit — the figures SWA -18 was read
     for, and which round one recorded and never drew. */
  const seatFace = seat.length ? seat[0].scale : [1, 1, 1];
  g.add(instanced("seatwall", UNIT(),
    masonry(C[L.seatWalls.color], cmuRepeat(section, seatFace[0], seatFace[1])), seat));
  g.add(instanced("seatwall-cap", UNIT(), concrete(C.castConcrete), seatCaps));
  counts.seatWalls = L.seatWalls.runs.length;

  /* The raised academic terrace and the flight that serves it. Built as one
     assembly so the flight lands on the ground it actually descends to: the
     terrace is a solid from the drawn surface up to `rise`, and the treads
     step from its top edge down to grade. Nothing floats either way. */
  const terraces = [];
  for (const t of L.terraces) {
    const cx = (t.rect.x0 + t.rect.x1) / 2;
    const cz = (t.rect.z0 + t.rect.z1) / 2;
    const base = ground(cx, cz);
    terraces.push({
      x: cx, y: base + (t.rise - 1.2) / 2, z: cz,
      scale: [t.rect.x1 - t.rect.x0, t.rise + 1.2, t.rect.z1 - t.rect.z0],
      top: base + t.rise,
    });
    /* Guard along every open edge the flight does not take — a 2.55 m drop
       takes the guard on all three, not only the two you can see from the
       walk. The west edge is the flight and carries the handrails instead. */
    guardRun(L.guard, [t.rect.x0, t.rect.z0], [t.rect.x1, t.rect.z0], base + t.rise, guard);
    guardRun(L.guard, [t.rect.x0, t.rect.z1], [t.rect.x1, t.rect.z1], base + t.rise, guard);
    guardRun(L.guard, [t.rect.x1, t.rect.z0], [t.rect.x1, t.rect.z1], base + t.rise, guard);
    counts.guardRuns = (counts.guardRuns || 0) + 3;
  }
  g.add(instanced("terrace", UNIT(), concrete(C.deckConcrete), terraces.map((t) => ({ ...t }))));
  counts.terraces = L.terraces.length;

  const terraceOf = (id) => L.terraces.find((t) => t.id === id);

  for (const s of L.stairs) {
    if (s.id === "S1") {
      const t = terraceOf(s.terrace);
      const cx = (t.rect.x0 + t.rect.x1) / 2;
      const cz = (t.rect.z0 + t.rect.z1) / 2;
      const topY = ground(cx, cz) + t.rise;
      /* Descending WEST off the terrace's west edge, treads running north-south. */
      const edgeX = t.rect.x0;
      for (let i = 0; i < s.risers; i++) {
        const x = edgeX - (i + 0.5) * s.tread;
        const y = topY - (i + 1) * s.riser;
        treads.push({ x, y: y + 0.03, z: cz, scale: [s.tread, 0.06, s.width] });
        risers.push({
          x: x + s.tread / 2, y: y + s.riser / 2, z: cz,
          scale: [0.08, s.riser, s.width],
        });
        /* Recessed riser step-lights: `perRiser` per lit riser, on every
           `everyNthRiser`. Both figures were counted in phf03 and round one
           read only one of them — the pair was hard-coded as [-1, 1], so
           perRiser drove nothing. Spread symmetrically about the flight's
           centreline at the counted `spacing`. */
        if (i % s.stepLight.everyNthRiser === 0) {
          const n = s.stepLight.perRiser;
          for (let k = 0; k < n; k++) {
            const off = n === 1 ? 0 : (k / (n - 1) - 0.5) * s.stepLight.spacing * (n - 1);
            stepLights.push({
              x: x + s.tread / 2 - 0.02, y: y + s.riser / 2,
              z: cz + off,
              scale: [0.05, s.stepLight.size[1], s.stepLight.size[0]],
            });
          }
        }
      }
      /* Handrails: one at each cheek plus the declared intermediates, each a
         raked tube over the nosing line with a 0.30 m HORIZONTAL return at the
         top and the bottom, and posts standing on the treads they rise from. */
      const H = L.handrail;
      const runLen = s.risers * s.tread;
      const bottomY = topY - s.risers * s.riser;
      const slope = Math.atan2(topY - bottomY, runLen);
      const nRails = s.intermediateRails + 2;
      for (let r = 0; r < nRails; r++) {
        const z = cz - s.width / 2 + (s.width * r) / (nRails - 1);
        rails.push({
          x: edgeX - runLen / 2, y: (topY + bottomY) / 2 + H.height, z, rotZ: -slope,
          scale: [Math.hypot(runLen, topY - bottomY), H.tube, H.tube],
        });
        /* Returns: level, one at each end, reaching back over the landing. */
        rails.push({
          x: edgeX + H.returnLength / 2, y: topY + H.height, z,
          scale: [H.returnLength, H.tube, H.tube],
        });
        rails.push({
          x: edgeX - runLen - H.returnLength / 2, y: bottomY + H.height, z,
          scale: [H.returnLength, H.tube, H.tube],
        });
        const posts = Math.max(1, Math.round(runLen / H.postSpacing));
        for (let p = 0; p <= posts; p++) {
          const u = (p / posts) * runLen;
          const y = topY - (u / runLen) * (topY - bottomY);
          rails.push({
            x: edgeX - u, y: y + H.height / 2, z,
            scale: [H.post, H.height, H.post],
          });
        }
      }
      counts.stairS1Risers = s.risers;
      counts.stepLights = stepLights.length;
    }
  }
  g.add(instanced("stair-tread", UNIT(), concrete(C.deckConcrete), treads));
  g.add(instanced("stair-riser", UNIT(), concrete(C.castConcrete), risers));
  g.add(instanced("stair-steplight", UNIT(), painted(C.precastPale), stepLights));
  g.add(instanced("handrail", UNIT(), metal(C[L.handrail.color]), rails));
  counts.handrailParts = rails.length;

  /* The DG check-step: one riser laid across the widest measured DG span
     nearest the Ramble zone's centre, so it spans a real surveyed path. */
  const S5 = L.stairs.find((s) => s.id === "S5");
  if (S5) {
    const zone = section.paving.zones.find((z) => z.family === "DG");
    const cx = (zone.rect.x0 + zone.rect.x1) / 2;
    const cz = (zone.rect.z0 + zone.rect.z1) / 2;
    let best = null;
    for (const [z, x0, x1] of section.measured.paving.spans) {
      if (z < zone.rect.z0 || z > zone.rect.z1) continue;
      const mx = (x0 + x1) / 2;
      if (mx < zone.rect.x0 || mx > zone.rect.x1) continue;
      const w = Math.min(x1 - x0, S5.width);
      const score = (x1 - x0) - Math.hypot(mx - cx, z - cz) / 10;
      if (w < 1.2) continue;
      if (!best || score > best.score) best = { x: mx, z, w, score };
    }
    if (best) {
      const step = [{
        x: best.x, y: ground(best.x, best.z) + S5.riser / 2 - 0.05, z: best.z,
        scale: [0.12, S5.riser + 0.1, best.w],
      }];
      g.add(instanced("check-step", UNIT(), concrete(C.castConcrete), step));
      counts.checkStep = 1;
    }
  }

  /* The stepped seat terraces. Each tier is a solid seated on the drawn
     surface, and each tier sits ON the one below it, so the run is a stair of
     solids rather than a stack of floating slabs. */
  const tiers = [];
  const leds = [];
  for (const t of L.seatTerraces) {
    for (let i = 0; i < t.tiers; i++) {
      const depth = t.tread * (t.tiers - i);
      const zc = t.centre[1] - (t.tread * t.tiers) / 2 + depth / 2;
      const g0 = ground(t.centre[0], zc);
      const h = t.riser * (i + 1);
      tiers.push({
        x: t.centre[0], y: g0 + (h - 0.8) / 2, z: zc,
        scale: [t.length, h + 0.8, depth],
      });
      if (t.ledRecess) {
        const zf = zc + depth / 2;
        leds.push({
          x: t.centre[0], y: g0 + h - t.ledRecess - t.ledHeight / 2, z: zf - 0.03,
          scale: [t.length - 0.2, t.ledHeight, 0.06],
        });
      }
    }
    counts.seatTerraceTiers = (counts.seatTerraceTiers || 0) + t.tiers;
  }
  g.add(instanced("seat-tier", UNIT(), concrete(C.castConcrete), tiers));
  g.add(instanced("led-channel", UNIT(), painted(C.poleDark), leds));
  counts.ledChannels = leds.length;

  /* W3 — bone-white precast raised planters, on measured paving. */
  const W3 = L.planterWalls;
  const place = section.places[W3.place];
  const pots = [];
  const shrubs = [];
  for (let i = 0, tries = 0; i < W3.count && tries < 4000; tries++) {
    const x = place.rect.x0 + hash(section.seed, 31, tries) * (place.rect.x1 - place.rect.x0);
    const z = place.rect.z0 + hash(section.seed, 32, tries) * (place.rect.z1 - place.rect.z0);
    if (!paving.rect(x, z, W3.size[0], W3.size[1])) continue;
    const gy = ground(x, z);
    pots.push({ x, y: gy + W3.height / 2, z, scale: [W3.size[0], W3.height, W3.size[1]] });
    pots.push({ x, y: gy + W3.height + W3.cap / 2, z, scale: [W3.size[0] + 0.08, W3.cap, W3.size[1] + 0.08] });
    shrubs.push({ x, y: gy + W3.height + 1.2, z, scale: [1.5, 2.4, 1.5] });
    i++;
  }
  g.add(instanced("w3-planter", UNIT(), concrete(C[W3.color]), pots));
  g.add(instanced("w3-shrub", new THREE.SphereGeometry(0.5, 8, 6), foliage(C.shrubGreen), shrubs));
  counts.planterWalls = shrubs.length;

  g.add(instanced("guard-post", UNIT(), metal(C[L.guard.color]), guard.posts));
  g.add(instanced("guard-rail", UNIT(), metal(C[L.guard.color]), guard.rails));
  g.add(instanced("guard-picket", UNIT(), metal(C[L.guard.color]), guard.pickets));
  counts.guardPickets = guard.pickets.length;

  group.add(g);
}

/* ---------------------------------------------------------------- court */

function buildCourt(section, group, ground, blocked, counts) {
  const K = section.court;
  const C = section.colors;
  const g = new THREE.Group();
  g.name = "eighth-courtyards-court";
  /* THE COURT HARDWARE LEFT THIS SECTION (arbitrated 2026-08-19). Two
     gooseneck standards used to be built here as well as in
     eighthsiteworks.systems.courtHardware. Siteworks owns them: it carries the
     diagonal brace strut and the net cone this version never had, and the
     arbitrated board is 54 x 42 in with the pole standing 0.20 m OUTSIDE the
     baseline on a 1.42 m arm — which is neither section's round-one model.
     What stays here is the clipped hedge row on its surveyed strip, which is
     court-side hardscape and is this section's. */

  /* The clipped hedge rows, filled inside their surveyed strips. */
  const balls = [];
  for (const key of K.hedge.rings) {
    const ring = section.measured.rings[key].points;
    const spans = blocked.cut(ringSpans(ring, K.hedge.spacing), K.hedge.spacing);
    for (const [z, x0, x1] of spans) {
      for (let x = x0 + K.hedge.spacing / 2; x < x1; x += K.hedge.spacing) {
        balls.push({
          x, y: ground(x, z) + K.hedge.height / 2, z,
          scale: [K.hedge.spacing * 1.25, K.hedge.height, K.hedge.spacing * 1.25],
        });
      }
    }
  }
  g.add(instanced("court-hedge", new THREE.SphereGeometry(0.5, 7, 5), foliage(C.shrubGreen), balls));
  counts.hedgeClumps = balls.length;
  group.add(g);
}

/* ------------------------------------------------ garden and the Sun Lawn */

/**
 * THE RAMBLE LEFT THIS SECTION (arbitrated 2026-08-19). Its swale beds, cobble
 * invert, boulder drifts and bunch grasses were built here AND in
 * eighthramble, which surveys 29 bed rings, a braided arroyo and a 60,000-plant
 * matrix off the same photographs. eighthramble owns it.
 *
 * The WELLNESS LAWN left too. arcgis.ground#1160 is 1,521.9 m2 and carries two
 * surfaces — a mown lawn over its west and centre and decomposed granite with
 * bunchgrass over its east arm — with no surveyed edge and no classifier able
 * to divide them, so no decal may cover it. See `absent`.
 *
 * What remains is the Bamboo Garden floor, its twelve charcoal planter cubes,
 * and the ONE resolved turf panel: the Sun Lawn on the full surveyed
 * arcgis.ground#2369 ring.
 */
function buildGardenAndLawn(section, group, ground, blocked, counts) {
  const C = section.colors;
  const g = new THREE.Group();
  g.name = "eighth-courtyards-planting";
  const pitch = section.measured.paving.rowPitch;

  /* The Bamboo Garden floor: raked gravel over the whole surveyed island,
     minus the rectangle eighthgathering's Meditation Pavilion bark field
     occupies. That clip is not a taste call — the bark decal sits on the PAD
     rung and this gravel on CARPET, so gravel over the whole island would
     paint the pavilion's own ground out. */
  const BG = section.bambooGarden;
  const island = section.measured.rings[BG.ring].points;
  const spans = blocked.cut(ringSpans(island, pitch), pitch);
  const clip = BG.pavilionClip.rect;
  const clear = BG.pavilionClip.clearance;
  const gravelSpans = cutRect(spans, pitch, clip, clear);
  g.add(stripMesh("garden-gravel", gravelSpans, pitch, C[BG.gravel.color], BG.gravel.material, BG.gravel.tile, CARPET, ground));
  counts.gardenStrips = gravelSpans.length;

  /* The charcoal planter cubes with their clipped shrub balls, inside the
     surveyed island and clear of the pavilion. */
  const PC = BG.planterCubes;
  const cubes = [];
  const caps = [];
  const balls = [];
  for (let i = 0, tries = 0; i < PC.count && tries < 5000; tries++) {
    const [z, x0, x1] = spans[Math.floor(hash(section.seed, 91, tries) * spans.length) % spans.length];
    const x = x0 + hash(section.seed, 92, tries) * (x1 - x0);
    if (x1 - x0 < PC.size[0] + 0.5) continue;
    /* Rejected on the cube's OWN 1.6 x 1.6 m footprint against the pavilion
       rect plus the declared clearance, rather than on its centre against a
       typed 1 m halo. The halo was an undeclared number deciding geometry. */
    if (hitsRect(x, z, PC.size[0], PC.size[2], clip, clear)) continue;
    if (!inRing(x, z, island)) continue;
    const gy = ground(x, z);
    cubes.push({ x, y: gy + (PC.size[1] - 0.5) / 2, z, scale: [PC.size[0], PC.size[1] + 0.5, PC.size[2]] });
    caps.push({ x, y: gy + PC.size[1] + PC.cap / 2, z, scale: [PC.size[0] + 0.06, PC.cap, PC.size[2] + 0.06] });
    balls.push({ x, y: gy + PC.size[1] + PC.shrub.dia / 2, z, scale: [PC.shrub.dia, PC.shrub.dia, PC.shrub.dia] });
    i++;
  }
  g.add(instanced("cube-planter", UNIT(), concrete(C[PC.color]), cubes));
  g.add(instanced("cube-cap", UNIT(), concrete(C.castConcrete), caps));
  g.add(instanced("cube-shrub", new THREE.SphereGeometry(0.5, 8, 6), foliage(C[PC.shrub.color]), balls));
  counts.planterCubes = balls.length;

  /* The one resolved turf panel, filled inside its surveyed outline. */
  const L = section.lawns;
  let lawnStrips = 0;
  for (const p of L.panels) {
    const ring = section.measured.rings[p.ring].points;
    const s = blocked.cut(ringSpans(ring, pitch), pitch);
    lawnStrips += s.length;
    g.add(stripMesh(`lawn-${p.id}`, s, pitch, C[L.color], L.material, L.tile, CARPET, ground));
  }
  counts.lawnStrips = lawnStrips;
  counts.lawnPanels = L.panels.length;
  group.add(g);
}

/* ---------------------------------------------- anchored built structures */

function buildStructures(section, group, ground, counts) {
  const C = section.colors;
  const g = new THREE.Group();
  g.name = "eighth-courtyards-structures";

  /* The north parking-elevator pavilion on the surveyed slab #2374. */
  const PE = section.parkingElevator;
  const [px, pz] = PE.centre;
  const pgy = ground(px, pz);
  /* The pavilion's own coursing is unresolvable — SWA -16 reads it at 70 px/m,
     where an 8 in course is 14 px. It takes the same college's MEASURED CMU
     module, which is the ultra standard's third tier applied honestly: the
     section records it as [estimated] extending seatWalls.courseHeight. Without
     it the library stretches its eight courses over a 4.8 m box. */
  g.add(instanced("pe-body", UNIT(),
    masonry(C[PE.color], cmuRepeat(section, PE.size[0], PE.size[1] + 0.8)), [
      { x: px, y: pgy + (PE.size[1] - 0.8) / 2, z: pz, scale: [PE.size[0], PE.size[1] + 0.8, PE.size[2]] },
    ]));
  g.add(instanced("pe-opening", UNIT(), painted(C.poleDark), [
    { x: px + PE.size[0] / 2 + 0.02, y: pgy + PE.size[1] * 0.6, z: pz - 1.2, scale: [0.06, PE.louvre[1], PE.louvre[0]] },
    { x: px + PE.size[0] / 2 + 0.02, y: pgy + PE.door[1] / 2, z: pz + 1.4, scale: [0.06, PE.door[1], PE.door[0]] },
  ]));
  g.add(instanced("pe-cap", UNIT(), concrete(C.castConcrete), [
    { x: px, y: pgy + PE.size[1] + 0.06, z: pz, scale: [PE.size[0] + 0.3, 0.12, PE.size[2] + 0.3] },
  ]));
  counts.parkingElevator = 1;

  /* THREE STRUCTURES LEFT THIS SECTION IN THE 2026-08-19 REPAIR, and all three
     for the same reason the arbitration gave for the twenty-one before them: an
     anchored object beats a scattered one, and a section may build only what it
     owns the carrier for.

       - THE SAFETY-ORANGE CALISTHENICS RIG. Real (SWA -16), and built here at
         [-169.5, 534.5] AND by eighthsiteworks at a different size 4.9 m away,
         with no arbitration between them. campus-photo-pulsefitness.js owns it
         now, at one size and one station.
       - THE GRILL STATION. Built here from an [estimated] position 30 m from
         eighthgathering's, which is anchored on the surveyed arcgis.ground#2375
         and carries the measured 4.6 m counter run, the bays, the splashback,
         the end piers and the enclosure this version never had. Its `fdcRed`
         bollard colour went with it, and so did this section's claim against the
         shipped `eighth.areas.bbq` anchor.
       - THE PUBLIC-ART WALL AT THE SOCIAL. eighthgathering builds the eucalyptus
         commission itself, in colour, on a surveyed ring 40 m from here. A
         board-formed wall built to carry an artwork that is painted somewhere
         else is a wall carrying nothing.

     None of the three is left behind a flag: the geometry, the figures and the
     colour roles are all gone, and each is named in the section's `absent`. */

  /* THE FIRE FEATURES LEFT THIS SECTION (arbitrated 2026-08-19). They lived
     under `furniture.fireFeatures`, which went to eighthgathering along with
     the rest of the loose furniture; gathering already supersedes the shipped
     `fire-feature` and `fire-seat-wall` items and builds the object as a
     masonry wall with a real opening rather than a floating pane. */

  group.add(g);
}

/* ------------------------------------------------------------------- api */

/**
 * Build Eighth College's courtyards and hardscape.
 *
 * `photo` is the loaded photo-detail document; this reads only its
 * `eighthcourtyards` section and never writes back. `surfaceAt` — the height of
 * the DRAWN terrain triangle — places everything, because everything here
 * stands on the ground you can see; `heightAt` is only the fallback when a
 * caller has no surface sampler. Returns `{ group, counts }`, empty and
 * harmless if the section is missing, so a half-wired boot still runs.
 */
export function createPhotoEighthCourtyards(scene, { photo, heightAt, surfaceAt } = {}) {
  const group = new THREE.Group();
  group.name = "photo-eighth-courtyards";
  const section = photo?.eighthcourtyards;
  if (!section) {
    scene?.add(group);
    return { group, counts: {} };
  }
  const ground = surfaceAt || heightAt;
  if (typeof ground !== "function") {
    throw new Error("campus-photo-eighthcourtyards: needs surfaceAt (or heightAt) to place on the ground");
  }

  const counts = {};
  const paving = pavingIndex(section);
  const blocked = keepOut(section);

  buildPaving(section, group, ground, counts);

  /* The rings that take a flush steel edge are DECLARED in `edging.rings`, one
     entry per ring with the reason that boundary is a bed edge, so the edging
     length stays a measured figure AND the claim behind it is readable. Two
     rings this section carries take no edge and are named as such: the Tea House
     island is eighthgathering's ground, and the pavilion slab is paved. */
  buildEdging(section, group, ground, blocked, counts);
  buildGardenBands(section, group, ground, blocked, counts);
  buildLevelChange(section, group, ground, paving, counts);
  buildCourt(section, group, ground, blocked, counts);
  buildGardenAndLawn(section, group, ground, blocked, counts);
  buildStructures(section, group, ground, counts);

  /* EVERY mesh, at any depth. This used to sum grandchildren only, so
     `edge-steel` and `garden-band` — added straight to `group` — counted zero
     and the reported figure was two low. A count that is wrong about what it
     counts is worse than no count. */
  let draws = 0;
  group.traverse((o) => { if (o.isMesh) draws++; });
  counts.draws = draws;
  counts.absent = section.absent.length;
  counts.supersedes = section.supersedes.length;

  scene?.add(group);
  return { group, counts };
}
