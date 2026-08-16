// John Muir Field, 1:1 with the aerial closeups.
//
// campus-markings.js already draws what the fitter found here: the soccer
// touchlines, the halfway line, the centre circle and the navy trident. Two
// nadir closeups of the same field show a good deal more, and none of it was
// in the model:
//
//   · the turf is NOT lawn. UCSD's GIS files this polygon as `green`, so the
//     walk renders it in the dry-lawn family (#75833f blended half-and-half
//     with the aerial sample — about #4e6140 on screen). Both closeups median
//     the real surface at #283e40: a very dark blue-green synthetic carpet,
//     a third darker than the grass beside it and nowhere near as yellow.
//   · a softball fan at EACH end, opening toward mid-field — a 14.2 m arc
//     closed by its own diameter, a flattened infield rhombus inside it, a
//     crisp pitcher's circle at the far vertex and a fainter home circle of
//     nearly the same size at the apex. Not a regulation diamond: the base
//     paths measure ~9.6 m, so this is an intramural layout, drawn as found.
//   · two "UC SAN DIEGO" wordmark strips, diagonally opposite (north-east
//     and south-west), each a long navy block with a shorter orange one on
//     its mid-field end. At 0.098 m per pixel the letterforms are mush, so
//     each is modelled as a two-tone strip of the right length and place.
//   · goals on the short ends, two painted triangles down the eastern half,
//     and a boundary rail behind each end. The goals are frame AND net:
//     campus-goal.js builds both from Law 1, and this file only says where
//     they stand and what colour the twine reads.
//
// EVERY position here lives in the FIELD'S OWN FRAME — fractional (u, v)
// along the fitted bounds quad's edges, u across the short axis and v along
// the long one. Refit the bounds in campus-markings.json and all of this
// moves with them; nothing is pinned to a world coordinate.
//
// muirFieldSpec() is pure, so the tests run the exact placement the renderer
// uses. Missing or malformed data is a quiet no-op, as everywhere else here.
import * as THREE from "../vendor/three/three.module.min.js";
import { OVERLAY, overlayLift, applyOverlayDepth, sceneTone } from "./campus-overlay.js";
import { GOAL_REGULATION, goalSpec, goalWorld, createGoalNet } from "./campus-goal.js";

/* Measured off "CleanShot 2026-08-03 at 12.54.53" (full-field, 0.0977 m/px)
   and confirmed against the wider "12.53.45" frame, whose tennis-court
   whites come back at #f5f8f7 — i.e. that frame needs no white balance, and
   it agrees with the closeup on the turf to within a single level.

   THIN LINES ARE DE-MIXED, not sampled. A 0.12 m line under a 0.098 m pixel
   covers about a third of it, so paint reads as one part paint to two parts
   turf. The soccer touchlines calibrate the coverage: known white (#f4f4f0)
   samples at #667e7f over #283e40 turf, which solves to a ~0.34 fill. The
   diamond's arc and rhombus lift the turf only a third as hard as those
   touchlines do, so they are genuinely faded paint — #607970 — while the two
   circles lift it as hard as the touchlines and are still white. */
export const MUIR_COLORS = {
  turf: "#283e40",       // median of four clean interior patches, both frames
  paintFaded: "#607970", // outfield arc, its chord, the infield rhombus
  paintWhite: "#dfe6e2", // pitcher's and home circles — as bright as the touchlines
  wordmarkNavy: "#1d2d54",
  wordmarkOrange: "#d4823f", // de-mixed from the warm peak; the block is lettering, not a solid
  triangle: "#d5d9db",   // solid enough to sample almost directly (p96 #caced0)
  goal: "#f0f2f0",
  /* DERIVED, not sampled: a 3 mm cord on a 0.12 m mesh covers a twentieth of
     a 0.098 m pixel, so the aerial can only say the net is not dark. Same
     de-mixing as the paint above — the frame white carried one part in ten
     toward the turf it hangs against (0.9 x #f0f2f0 + 0.1 x #283e40). */
  goalNet: "#dce0de",
  fence: "#5a625d",
};

/* The fitted bounds quad is 60.28 m across by 105.72 m along; these are the
   metres the fractions were measured in. The renderer re-derives them from
   whatever quad the data actually carries, so a refit rescales everything. */
export const MUIR_NOMINAL = { width_m: 60.28, length_m: 105.72 };

/* Fan geometry, in metres. Each end's arc was circle-fitted to its own ridge
   pixels (north: centre 7.3 m off the end, r 14.50; south: 8.3 m, r 14.05)
   and the two were averaged into ONE symmetric model — the ends differ by
   less than the fitter's own error, and no walker sees both at once. The
   remaining figures were then swept against the aerial for the least mean
   distance from spec point to painted pixel; the residuals that search
   settles at are quoted beside each. */
const FAN = {
  anchor_m: 7.8,     // home plate / arc centre, off the near end of the bounds
  arc_r: 14.2,       // a true half-circle, closed by its own diameter (0.15 m)
  infieldHalf: 8.6,  // rhombus half-width. A broad minimum: the real rhombus
  infieldFar: 8.6,   // is SKEWED (its east vertex sits ~1.4 m nearer mid-field
                     // than its west one), so a symmetric model floors at
                     // 0.47 m however it is fitted. The far vertex is pinned
                     // to the pitcher's circle, where the paint puts it.
  pitcher_r: 2.6,    // (0.06 m)
  home_r: 2.5,       // (0.16 m) — nearly the pitcher's size, just fainter
  home_off: 0.4,     // and sitting that far OUTWARD of the arc's centre
};

const GOAL_LINE_M = 2.71;  // the pitch's own end line, inside the bounds end
/* Mouth and crossbar come from Law 1 via campus-goal.js, which cites it. The
   depth and back-rail height are NOT regulation and are not claimed to be:
   they are the shallow portable rake this model has carried since the goals
   were first drawn, and the nadir aerial resolves neither any further. */
const GOAL = { ...GOAL_REGULATION, depth_m: 1.6, backHeight_m: 0.9 };

const PAINT_WIDTH = 0.12;  // same paint gauge campus-markings.js uses

/* Wordmark strips: 17.0 m long, 2.3 m wide, their outer end 0.4 m short of
   the bounds end, orange block on the mid-field side. */
const WORDMARK = { length_m: 17.0, width_m: 2.3, inset_m: 0.4, orange_m: 4.5 };

/* Boundary rail behind each short end. The aerial's field edge reads as a
   thin pale line in plan; in elevation a low chain-link boundary reads as
   dark structure, so the posts take a muted dark grey rather than the
   line's mixed sample. */
const FENCE = { inset_m: 0.35, posts: 11, height_m: 1.2, endInset_m: 0.5 };

/** Tessellate a circle (or a half of one) into points, ~0.6 m apart. */
function ring(cx, cy, r, a0, a1, toUV) {
  const n = Math.max(12, Math.ceil((Math.abs(a1 - a0) * r) / 0.6));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push(toUV(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
  }
  return pts;
}

/**
 * Every overlay this module adds, as flat elements in the bounds frame.
 *
 * Pure: same input, same output, no clock and no randomness. Each element
 * carries `uv` — every point that lands on the ground — so a test can walk
 * the whole spec and check nothing strays off the field.
 */
export function muirFieldSpec({ width_m, length_m } = MUIR_NOMINAL) {
  const W = width_m || MUIR_NOMINAL.width_m;
  const L = length_m || MUIR_NOMINAL.length_m;
  const elements = [];
  const add = (e) => { elements.push(e); return e; };

  /* ---------------------------------------------------- the turf itself */
  add({
    id: "turf-drape", type: "turf-drape", colour: MUIR_COLORS.turf,
    uv: [[0, 0], [1, 0], [1, 1], [0, 1]],
  });

  /* ------------------------------------------------ a softball fan each end */
  for (const end of ["north", "south"]) {
    /* `s` walks toward mid-field: +v from the north end, -v from the south.
       Everything below is stated in (lateral, toward-mid-field) metres and
       converted once, here. */
    const s = end === "north" ? 1 : -1;
    const v0 = end === "north" ? FAN.anchor_m / L : 1 - FAN.anchor_m / L;
    const toUV = (lat, ax) => [0.5 + lat / W, v0 + (s * ax) / L];

    add({
      id: `fan-${end}-arc`, type: "diamond-arc", end, colour: MUIR_COLORS.paintFaded,
      width_m: PAINT_WIDTH, radius_m: FAN.arc_r, anchor: toUV(0, 0),
      uv: ring(0, 0, FAN.arc_r, 0, Math.PI, toUV),
    });
    add({
      id: `fan-${end}-chord`, type: "diamond-chord", end, colour: MUIR_COLORS.paintFaded,
      width_m: PAINT_WIDTH,
      uv: [toUV(-FAN.arc_r, 0), toUV(FAN.arc_r, 0)],
    });
    add({
      id: `fan-${end}-infield`, type: "infield-outline", end, colour: MUIR_COLORS.paintFaded,
      width_m: PAINT_WIDTH,
      uv: [
        toUV(0, 0),
        toUV(FAN.infieldHalf, FAN.infieldFar / 2),
        toUV(0, FAN.infieldFar),
        toUV(-FAN.infieldHalf, FAN.infieldFar / 2),
        toUV(0, 0),
      ],
    });
    add({
      id: `fan-${end}-pitcher`, type: "circle", role: "pitcher", end,
      colour: MUIR_COLORS.paintWhite, width_m: PAINT_WIDTH, radius_m: FAN.pitcher_r,
      anchor: toUV(0, FAN.infieldFar),
      uv: ring(0, FAN.infieldFar, FAN.pitcher_r, 0, Math.PI * 2, toUV),
    });
    add({
      id: `fan-${end}-home`, type: "circle", role: "home", end,
      colour: MUIR_COLORS.paintWhite, width_m: PAINT_WIDTH, radius_m: FAN.home_r,
      anchor: toUV(0, -FAN.home_off),
      uv: ring(0, -FAN.home_off, FAN.home_r, 0, Math.PI * 2, toUV),
    });
  }

  /* --------------------------------------------------------- the wordmarks */
  /* Diagonally opposite and 180°-symmetric about the centre spot: north-east
     and south-west. Measured at u 0.968–1.012 and 0.000–0.041 — both hang a
     hair off the fitted quad, so the pair is mirrored onto one inset. */
  for (const corner of ["north-east", "south-west"]) {
    const east = corner === "north-east";
    const uc = east ? 1 - WORDMARK.width_m / 2 / W - 0.002 : WORDMARK.width_m / 2 / W + 0.002;
    const u0 = uc - WORDMARK.width_m / 2 / W;
    const u1 = uc + WORDMARK.width_m / 2 / W;
    /* v walks from the strip's outer (end-line) tip toward mid-field. */
    const sign = east ? 1 : -1;
    const tip = east ? WORDMARK.inset_m / L : 1 - WORDMARK.inset_m / L;
    const atV = (m) => tip + (sign * m) / L;
    const navyEnd = WORDMARK.length_m - WORDMARK.orange_m;
    const strip = (id, colour, m0, m1) => add({
      id, type: "wordmark-strip", corner, colour,
      uv: [[u0, atV(m0)], [u1, atV(m0)], [u1, atV(m1)], [u0, atV(m1)]],
    });
    strip(`wordmark-${corner}-navy`, MUIR_COLORS.wordmarkNavy, 0, navyEnd);
    strip(`wordmark-${corner}-orange`, MUIR_COLORS.wordmarkOrange, navyEnd, WORDMARK.length_m);
  }

  /* -------------------------------------------------------------- the goals */
  /* On the pitch's own end lines, centred. The closeups show both goals
     parked a few metres OUTSIDE the field — off-season, not a layout. */
  for (const end of ["north", "south"]) {
    const s = end === "north" ? 1 : -1;
    const v = end === "north" ? GOAL_LINE_M / L : 1 - GOAL_LINE_M / L;
    const back = v - (s * GOAL.depth_m) / L;
    const half = GOAL.span_m / 2 / W;
    add({
      id: `goal-${end}`, type: "goal", end, colour: MUIR_COLORS.goal, ...GOAL,
      uv: [[0.5 - half, v], [0.5 + half, v], [0.5 + half, back], [0.5 - half, back]],
    });
  }

  /* ---------------------------------------------------------- the triangles */
  /* Two painted arrowheads in the southern half, pointing outward along u.
     A third sits ~8 m west of the fitted quad and is left out — it is off
     this facility's own frame, and would have to be pinned to the world. */
  const arrow = (id, u, v, len, wide, dir) => add({
    id, type: "triangle", colour: MUIR_COLORS.triangle,
    uv: [
      [u + (dir * len) / 2 / W, v],
      [u - (dir * len) / 2 / W, v - wide / 2 / L],
      [u - (dir * len) / 2 / W, v + wide / 2 / L],
    ],
  });
  arrow("triangle-west", 0.1825, 0.7896, 1.6, 1.3, -1);
  arrow("triangle-mid", 0.5584, 0.7832, 2.1, 2.4, 1);

  /* ----------------------------------------------------- the boundary rail */
  for (const end of ["north", "south"]) {
    const v = end === "north" ? FENCE.inset_m / L : 1 - FENCE.inset_m / L;
    const uA = FENCE.endInset_m / W;
    const uB = 1 - FENCE.endInset_m / W;
    add({
      id: `fence-rail-${end}`, type: "fence-rail", end, colour: MUIR_COLORS.fence,
      height_m: FENCE.height_m, uv: [[uA, v], [uB, v]],
    });
    for (let i = 0; i < FENCE.posts; i++) {
      const u = uA + ((uB - uA) * i) / (FENCE.posts - 1);
      add({
        id: `fence-post-${end}-${i}`, type: "fence-post", end, colour: MUIR_COLORS.fence,
        height_m: FENCE.height_m, uv: [[u, v]],
      });
    }
  }

  return { width_m: W, length_m: L, elements };
}

/* ------------------------------------------------------------- rendering */

/* Rungs of the shared decal-stack ladder (campus-overlay.js): the turf
   carpet paints after the ground, the field's painted lines paint after
   every carpet/pad, and the wordmarks/trident-adjacent fills paint last of
   all, ordered by renderOrder rather than by lift — exact at any altitude. */
const DRAPE_LIFT = overlayLift("carpet");
const PAINT_LIFT = overlayLift("paint");
const LOGO_LIFT = overlayLift("logo");
const MAX_SEG = 6; // long runs are subdivided so the paint follows the ground

/** The bounds quad as a frame: metres, a point map, and the heading of +u. */
function boundsFrame(bounds) {
  const [b0, b1, , b3] = bounds;
  const ux = b1[0] - b0[0], uz = b1[1] - b0[1];
  const vx = b3[0] - b0[0], vz = b3[1] - b0[1];
  const width_m = Math.hypot(ux, uz);
  const length_m = Math.hypot(vx, vz);
  if (!(width_m > 1) || !(length_m > 1)) return null;
  return {
    width_m, length_m,
    at: (u, v) => [b0[0] + ux * u + vx * v, b0[1] + uz * u + vz * v],
    /* A box's local +X lands on world (cos rot, -sin rot) — see the banner
       arms in campus-details.js — so this is the rotation that points a
       crossbar along the field's short axis. */
    uRot: Math.atan2(-uz, ux),
  };
}

/** Push a ribbon of quads along a world-space polyline. */
function ribbon(out, pts, half, heightAt, lift) {
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1];
    const [bx, bz] = pts[i];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 1e-4) continue;
    const n = Math.max(1, Math.ceil(len / MAX_SEG));
    const ux = (bx - ax) / len, uz = (bz - az) / len;
    const px = -uz * half, pz = ux * half;
    for (let k = 0; k < n; k++) {
      const sx = ax + (ux * len * k) / n, sz = az + (uz * len * k) / n;
      const ex = ax + (ux * len * (k + 1)) / n, ez = az + (uz * len * (k + 1)) / n;
      const q = [
        [sx + px, sz + pz], [sx - px, sz - pz],
        [ex + px, ez + pz], [ex - px, ez - pz],
      ].map(([x, z]) => [x, heightAt(x, z) + lift, z]);
      out.push(...q[0], ...q[2], ...q[1], ...q[1], ...q[2], ...q[3]);
    }
  }
}

/** Triangulate a world-space polygon onto the ground. */
function fill(out, poly, heightAt, lift) {
  const contour = poly.map(([x, z]) => new THREE.Vector2(x, -z));
  let tris;
  try {
    tris = THREE.ShapeUtils.triangulateShape(contour, []);
  } catch {
    return; // one degenerate overlay must not cost the walk
  }
  for (const tri of tris) {
    /* Reversed after the -z flip so the face points up. */
    for (const vi of [tri[0], tri[2], tri[1]]) {
      const x = contour[vi].x, z = -contour[vi].y;
      out.push(x, heightAt(x, z) + lift, z);
    }
  }
}

/** A drape quad, subdivided so a big one still follows the terrain.
    `c` walks the quad's own PERIMETER in order (c0->c1->c2->c3), unlike
    ribbon()'s start/end-pair vertex order below — so it needs the OTHER
    diagonal (c0-c2) to keep both triangles wound the same way. Splitting it
    along c1-c2 instead (as a copy of ribbon()'s index pattern once did)
    winds the two triangles of every OTHER cell backwards, and every one of
    those triangles reads as a hole once anything depth-tests against it:
    exactly the chevron field this ladder was built to end. */
function grid(out, frame, heightAt, lift, cells = 12) {
  for (let i = 0; i < cells; i++) {
    for (let j = 0; j < cells; j++) {
      const c = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]]
        .map(([a, b]) => frame.at(a / cells, b / cells))
        .map(([x, z]) => [x, heightAt(x, z) + lift, z]);
      out.push(...c[0], ...c[1], ...c[2], ...c[0], ...c[2], ...c[3]);
    }
  }
}

/* Only the standing work uses this — goal frames and fence posts, all of it
   painted metal. */
const lambert = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.65 });

/**
 * The standing work — goal frames and fence posts — collected by box size
 * and colour so it renders as a handful of instanced draws rather than the
 * three dozen little meshes a post-at-a-time build produces.
 */
function standing() {
  const kinds = new Map(); // `wxhxd|colour` -> { w,h,d,colour, at: [] }
  return {
    box(w, h, d, colour, x, y, z, rot) {
      const key = `${w}x${h}x${d}|${colour}`;
      if (!kinds.has(key)) kinds.set(key, { w, h, d, colour, at: [] });
      kinds.get(key).at.push([x, y, z, rot]);
    },
    build(group) {
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const scale = new THREE.Vector3(1, 1, 1);
      const pos = new THREE.Vector3();
      const axis = new THREE.Vector3(0, 1, 0);
      for (const k of kinds.values()) {
        const mesh = new THREE.InstancedMesh(
          new THREE.BoxGeometry(k.w, k.h, k.d), lambert(k.colour), k.at.length
        );
        k.at.forEach(([x, y, z, rot], i) => {
          q.setFromAxisAngle(axis, rot);
          pos.set(x, y, z);
          mesh.setMatrixAt(i, m.compose(pos, q, scale));
        });
        mesh.instanceMatrix.needsUpdate = true;
        group.add(mesh);
      }
    },
  };
}

/**
 * Draw the Muir Field overlays. Returns a group; an absent facility, a
 * malformed quad or a bad spec all resolve to an empty one.
 *
 * `markings` is the parsed docs/data/campus-markings.json — the same object
 * campus-markings.js fetches, passed in rather than fetched twice.
 */
export function createMuirField(scene, { markings, heightAt } = {}) {
  const group = new THREE.Group();
  if (scene) scene.add(group);
  if (!markings?.facilities?.length || typeof heightAt !== "function") return group;

  const facility = markings.facilities.find(
    (f) => f.id === "muir-field" || f.name === "Muir Field"
  );
  if (!facility || !Array.isArray(facility.bounds) || facility.bounds.length < 4) return group;
  const frame = boundsFrame(facility.bounds);
  if (!frame) return group;

  const spec = muirFieldSpec(frame);
  const world = ([u, v]) => frame.at(u, v);

  /* Flat work merges per colour into two depth families; the standing work
     (goals, posts) is a handful of small boxes. */
  const flats = new Map(); // `${family}|${colour}` -> positions[]
  const bucket = (family, colour) => {
    const key = `${family}|${colour}`;
    if (!flats.has(key)) flats.set(key, []);
    return flats.get(key);
  };
  const stand = standing();
  const netCords = []; // every cord of both goals, merged into one draw

  for (const el of spec.elements) {
    const pts = el.uv.map(world);
    switch (el.type) {
      case "turf-drape":
        grid(bucket("carpet", el.colour), frame, heightAt, DRAPE_LIFT);
        break;
      case "diamond-arc":
      case "diamond-chord":
      case "infield-outline":
      case "circle":
        ribbon(bucket("paint", el.colour), pts,
          Math.max(0.025, (el.width_m || PAINT_WIDTH) / 2), heightAt, PAINT_LIFT);
        break;
      case "wordmark-strip":
      case "triangle":
        /* Filled shapes, not lines — the wordmarks and arrowheads join the
           logo rung, same family as campus-markings.js's own logo fills. */
        fill(bucket("logo", el.colour), pts, heightAt, LOGO_LIFT);
        break;
      case "goal": {
        /* Frame and net both come from campus-goal.js, which owns the Law 1
           dimensions and the mesh gauge. One terrain datum for the whole
           goal, taken at the mouth centre: a goal is welded, not draped. */
        const [[lx, lz], [rx, rz]] = pts;
        const placed = goalWorld(goalSpec(el), pts, heightAt((lx + rx) / 2, (lz + rz) / 2));
        if (!placed) break;
        for (const b of placed.boxes) stand.box(b.w, b.h, b.d, el.colour, b.x, b.y, b.z, b.rot);
        netCords.push(...placed.cords);
        break;
      }
      case "fence-post": {
        const [x, z] = pts[0];
        stand.box(0.08, el.height_m, 0.08, el.colour,
          x, heightAt(x, z) + el.height_m / 2, z, frame.uRot);
        break;
      }
      case "fence-rail": {
        const [[ax, az], [bx, bz]] = pts;
        const cx = (ax + bx) / 2, cz = (az + bz) / 2;
        stand.box(Math.hypot(bx - ax, bz - az), 0.06, 0.06, el.colour,
          cx, heightAt(cx, cz) + el.height_m, cz, frame.uRot);
        break;
      }
      default:
        break;
    }
  }
  stand.build(group);
  if (netCords.length) group.add(createGoalNet(netCords, MUIR_COLORS.goalNet));

  /* Tone routing (campus-overlay.js's sceneTone doc). Strengths come from
     sceneTone's REAL output — it lifts in THREE's linear colour space, a
     steeper curve than the hex numbers suggest — not a hand estimate:
     carpet (turf, #283e40/luma 55.7) was NOT lifted like the lawn beside it
     is (luma 73.9->104.3) and read as a near-black slab; strength 0.15
     renders it at luma 79.4, a ~0.76 turf/lawn ratio, inside the aerial's
     measured 0.68-0.82 band. paint (the fan arcs/circles) is calibrated
     against the RAW turf (see the de-mixing note above MUIR_COLORS) and
     shares carpet's strength so it keeps moving with the carpet instead of
     losing contrast while the carpet alone brightens under it. logo (the
     wordmark strips, the fan triangles) gets FULL strength: the wordmark
     navy sits on turf exactly like the trident in campus-markings.js, and
     needs the same fix or it is the same black splat. */
  const FAMILY_TONE = { carpet: 0.15, paint: 0.15, logo: 1 };
  for (const [key, positions] of flats) {
    if (!positions.length) continue;
    const [family, colour] = key.split("|");
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    /* UNLIT, for the reason campus-markings.js records: a lit DoubleSide
       fill whose triangulation winds back-facing gets lit by the hemisphere's
       GROUND term and renders near-black. */
    const mat = applyOverlayDepth(
      new THREE.MeshBasicMaterial({
        color: sceneTone(colour, FAMILY_TONE[family] ?? 0),
        side: THREE.DoubleSide,
      }),
      family
    );
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = OVERLAY[family].renderOrder;
    group.add(mesh);
  }

  return group;
}
