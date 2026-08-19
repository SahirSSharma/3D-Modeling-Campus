// Podemos Hall (TDLLN Building 5, Eighth College), from photographs — the
// INVENTED class.
//
// HKS (design architect) + EYRC + Kitchell + SWA (landscape) + Walter P Moore.
// Construction Jan 2021 - Nov 2023; Podemos was the FIRST building of the
// neighbourhood occupied, in autumn 2023. Two drawn masses: a 16-storey
// residential tower of 490 beds in 110 units (arcgis.massing[253], h 48.8) and
// a two-storey academic wing on Ridge Walk (arcgis.massing[252], h 6.1) whose
// SEVENTY-EIGHT-vertex ring is the most complicated plan in the college.
//
// THE EPOCH FACT THAT DECIDES EVERYTHING HERE. Eighth College was built
// ~2023 and the project's 2014 survey is BLIND to it — campus-lidar.json
// massHeights has no entry for any Eighth mass. So the drawn prism is the
// university facilities massing ring and its GIS h, copied verbatim into
// `measured.masses.*.ring` (campus-arcgis.json massing, /10 to metres, closing
// vertex included so the rim-median datum samples exactly as campus-massing.js
// roofElevation does). No survey height is read anywhere in this file, and
// every argument of the form "the 2014 survey is smooth here so there is no
// step" is void over this site: it describes a demolished parking lot. That
// argument is the reason the shipped campus-eighth.js withheld the 9185 entry
// stair, and this file builds it.
//
// Six things decided the shape of this file:
//
//   1. THE DRAWN PRISM WINS AND THE 3.4 m IS DECLARED, NOT SPLIT. The academic
//      wing measures ~9.5 m to its parapet valley and ~10.4 m to the sawtooth
//      peak on SWA Learning-7, and an 8,106 GSF raked lecture hall
//      independently needs the height. The drawn h is 6.1 — the LRDP
//      levels x 3.048 formula. Per project law the drawn box is dressed, filled
//      with 2 bands of 6.1/2 = 3.05 m, and the sourced figure lives in the
//      section's `conflicts`. Dressing to 9.5 m would float the whole wing 3.4 m
//      over its own drawn parapet, which is exactly how York's membrane came to
//      hover 6 m over its.
//
//   2. THE SAWTOOTH IS A PARAPET SCREEN, NOT A ROOF. The shared recon calls it
//      a folded north-light ROOFLINE. Learning-7 at 7x shows blue sky directly
//      above AND BEHIND the teeth and phf15 shows the roof behind them flat.
//      It is built as a pleated screen standing in front of a flat roof, and
//      its every figure is a preserved RATIO: pitch = 0.249 of the height from
//      the L1 canopy top to the peak, amplitude = 0.70 of pitch, two panels per
//      tooth. On the drawn prism that puts the peak 1.8496 m above the lid and
//      the valley 0.9956 m above it — derived, not chosen.
//
//   3. TWENTY-SIX OF THE ACADEMIC WING'S SIXTY REAL RING SEGMENTS ARE INTERIOR.
//      The tower's east common-space bay reaches x -24.3, a metre EAST of the
//      wing's own east wall, and 81.6% of the tower's plate stands on the wing.
//      Every wing face is therefore emitted as EXPOSED RUNS clipped against the
//      drawn tower — wall, storefront, colonnade, canopy, sawtooth and roof
//      alike — and the segments that are wholly buried are declared `interior`
//      and skinned by neither mass.
//
//   4. WHICH OF THE THREE EAST DOORS THE 9185 STAIR SERVES IS DECIDED BY THE
//      SURVEY. The ring draws three identical 1.1 m recesses on Ridge Walk and
//      no frame says which one phf03 photographs. A 9.0 m terrace and its 8.0 m
//      flight fit clear of the drawn tower at exactly one of them. That is the
//      only measured discriminator available and it gives one answer.
//
//   5. THE FACADE IS ONE PUBLISHED IDEA. HKS: "by popping out and rotating
//      windows six degrees on the lower towers, they could enhance airflow by
//      30%". 6 degrees = 0.10472 rad is a published figure, not a guess, and it
//      governs the tower's window boxes AND the academic wing's panel folds.
//
//   6. THERE IS NO PHOTOVOLTAIC ARRAY, AND THE ABSENCE IS THE FINDING. The 2021
//      Revelle deck draws one on this roof; the 2024-25 built aerials show
//      membrane, parapet, penthouses, ducts and RTUs and nothing else — with
//      Keeling's own roof PV visible in the same frame as the positive control.
//
// Colours are DATA — every hex comes from the `colors` block of the photo
// document's `podemos` section, with per-role provenance in `colorSources`.
// Surfaces come from the procedural material library (campus-materials.js):
// code-generated maps only, never a photograph or a satellite pixel.
// Deterministic — the only irregularity source is `hash`, seeded from the
// section's pinned `seed`.
import * as THREE from "../vendor/three/three.module.min.js";
import { applyOverlayDepth, OVERLAY, overlayLift } from "./campus-overlay.js";
import { createMaterialLibrary } from "./campus-materials.js";

const PAD = "pad";
const CARPET = "carpet";
const PAINT = "paint";

/* Tessellation of the raked tooth face and of the round roof duct. These are
   mesh resolutions, not measurements, and nothing is claimed by them. */
const RAKE_SLICES = 6;
const TUBE_SIDES = 12;

let LIB = null;
const lib = () => (LIB ??= createMaterialLibrary(THREE));

/* The tower's wide vertically-ribbed rainscreen — the seamed class carries the
   corrugation phf03 counts 10-11 ribs of. */
const ribbedMat = (c) => lib().get("metalPanelSeam", { color: c, metalness: 0.2, roughness: 0.58 });
/* Flat rainscreen: the canted returns, the piers, the pop-out cheeks. */
const panelMat = (c) => lib().get("metalPanel", { color: c, metalness: 0.16, roughness: 0.62 });
const painted = (c) => lib().get("metalPanel", { color: c, metalness: 0.35, roughness: 0.55 });
const louvreMat = (c) => lib().get("metalPanelSeam", { color: c, metalness: 0.5, roughness: 0.5 });
const concrete = (c) => lib().get("smoothConcrete", { color: c });
/* Architectural precast: board-formed carries the form-tie/panel character the
   phf03 crop resolves as a regular grid of tie dots. */
const precastMat = (c) => lib().get("boardFormedConcrete", { color: c, normalScale: 0.5 });
const glassMat = (c) => lib().get("glass", { color: c });
/* Grey modular brick in running bond. The library's `brick` class tiles 8
   courses x 4 units per repeat, so the real tile is 4*unitLength wide and
   8*courseHeight tall. Every brick wall in this file is emitted as a ONE-METRE
   strip so a single instanced mesh can carry the coursing at one true scale —
   an instanced mesh cannot vary its UVs per instance, and a stretched course is
   a lie about a measured 0.092 m. */
const brickMat = (c, w, h, B) =>
  lib().get("brick", {
    color: c, normalScale: 0.8,
    repeat: [Math.max(0.2, w / (4 * B.unitLength)), Math.max(0.2, h / (8 * B.courseHeight))],
  });
/* Recessed downlights in the L2 soffit over the colonnade. Geometry with a LOW
   emissive so it reads as a luminaire, never as an invented night source. */
const lens = (c, intensity) =>
  new THREE.MeshStandardMaterial({
    color: c, emissive: new THREE.Color(c), emissiveIntensity: intensity,
    roughness: 0.35, metalness: 0.0,
  });

function decal(color, rung, cls = "smoothConcrete", repeat) {
  return applyOverlayDepth(lib().get(cls, { color, repeat }), rung);
}

/** Deterministic 0..1 from any integer mix — a reload rebuilds the same tower. */
function hash(...ns) {
  let s = 0;
  for (let i = 0; i < ns.length; i++) s = s * 131.71 + ns[i] * 57.13 + 7.9;
  const v = Math.sin(s) * 43758.5453;
  return v - Math.floor(v);
}

/** One InstancedMesh from a list of placements (the keeling/york convention).
    `rotZ` is a ROLL in the item's own frame — the raked sawtooth face and the
    stair's sloped cheeks and handrails need it, and Euler order YXZ applies it
    first, i.e. inside the face's own plane. */
function instanced(geo, mat, items, place) {
  const mesh = new THREE.InstancedMesh(geo, mat, items.length);
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

/** A flat XZ quad lying in the ground plane. */
function quad(w, d) {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  return g;
}

/* --------------------------------------------------------------- geometry */

/** The ring without its repeated closing vertex — the vertex list facades index. */
function vertsOf(ring) {
  const v = ring.slice();
  const f = v[0];
  const l = v[v.length - 1];
  if (v.length > 1 && f[0] === l[0] && f[1] === l[1]) v.pop();
  return v;
}

function signedArea(verts) {
  let s = 0;
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

/**
 * Outward normal of the edge a->b, decided by the ring's WINDING and not by
 * the centroid. Both Podemos rings are clockwise (negative signed area), so an
 * edge with tangent t has outward = (-t.z, t.x). The centroid test is wrong at
 * a re-entrant vertex, and the academic wing's ring is re-entrant in several
 * places — the west slot alone folds back on itself twice.
 */
function outwardOf(verts, i, j) {
  const [ax, az] = verts[i];
  const [bx, bz] = verts[j];
  const len = Math.hypot(bx - ax, bz - az) || 1;
  const tx = (bx - ax) / len;
  const tz = (bz - az) / len;
  return signedArea(verts) < 0 ? [-tz, tx] : [tz, -tx];
}

/**
 * A face's own frame. The tangent is the DRAWN edge itself; `at(u, w, y)` is u
 * metres along the face from vertex `a`, w metres proud of it, y in world
 * height. A box rotated by `rot` has its local +Z pointing out of the face.
 */
function frameOf(a, b, out) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const tx = (b[0] - a[0]) / length;
  const tz = (b[1] - a[1]) / length;
  const [nx, nz] = out;
  return {
    length,
    rot: Math.atan2(nx, nz),
    nx, nz, tx, tz,
    at: (u, w, y) => ({ x: a[0] + tx * u + nx * w, y, z: a[1] + tz * u + nz * w }),
  };
}

const inRing = (x, z, r) => {
  let ins = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, zi] = r[i];
    const [xj, zj] = r[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
};

/**
 * The runs of a face that are NOT buried inside any blocker ring, sampled
 * every `step` metres a little proud of the wall. 26 of the academic wing's 60
 * real ring segments are wholly inside the drawn tower; without this the wall,
 * the storefront, the colonnade and the sawtooth would all be built inside
 * another building.
 */
function exposedRuns(frame, blockers, step = 0.5, off = 0.6) {
  const n = Math.max(1, Math.ceil(frame.length / step));
  const cells = [];
  for (let i = 0; i < n; i++) {
    const u = ((i + 0.5) * frame.length) / n;
    const p = frame.at(u, off, 0);
    cells.push(!blockers.some((r) => inRing(p.x, p.z, r)));
  }
  const runs = [];
  let start = null;
  for (let i = 0; i <= n; i++) {
    const open = i < n && cells[i];
    if (open && start === null) start = i;
    if (!open && start !== null) {
      runs.push([(start * frame.length) / n, (i * frame.length) / n]);
      start = null;
    }
  }
  return runs.filter(([a, b]) => b - a > 0.35);
}

/** Split one exposed run into sub-runs by WHICH of `polys` covers the wall at
 *  that station. Two things stand against this building's own wall and each
 *  suppresses a different layer: the 9185 terrace is a 3.05 m solid, so the run
 *  behind it loses its whole L1 storey (a storefront inside a terrace); and the
 *  Front Porch is a covered room, so the run behind it loses the canopy eyebrow
 *  and the planting bed (a second eyebrow under the porch roof, and a bed under
 *  a floor). Returns [u0, u1, coveredFlags] per sub-run, flags in `polys` order. */
function splitByPolys(frame, a, b, polys, step = 0.5) {
  const none = polys.map(() => false);
  if (!polys.some(Boolean)) return [[a, b, none]];
  const n = Math.max(1, Math.ceil((b - a) / step));
  const at = (i) => a + (i * (b - a)) / n;
  const out = [];
  let start = a;
  let state = null;
  for (let i = 0; i < n; i++) {
    const p = frame.at(a + ((i + 0.5) * (b - a)) / n, 0.2, 0);
    const m = polys.map((r) => (r ? inRing(p.x, p.z, r) : false));
    if (state === null) state = m;
    else if (m.join() !== state.join()) {
      out.push([start, at(i), state]);
      start = at(i);
      state = m;
    }
  }
  out.push([start, b, state || none]);
  return out.filter(([c, d]) => d - c > 0.3);
}

/** campus-massing.js roofElevation, verbatim in rule: rim-median ground under
 *  the DRAWN ring plus the drawn height, never below the highest footprint
 *  ground. The ring is passed WITH its closing vertex so the median samples
 *  exactly the same list the extruder does. */
function roofElevationOf(ring, h, base) {
  let highest = -Infinity;
  const gs = [];
  for (const [x, z] of ring) {
    const g = base(x, z);
    if (g != null && Number.isFinite(g)) {
      gs.push(g);
      if (g > highest) highest = g;
    }
  }
  let surveyed = h;
  if (gs.length) {
    gs.sort((a, b) => a - b);
    surveyed = gs[Math.floor(gs.length / 2)] + h;
  }
  return highest > -Infinity && surveyed < highest ? highest : surveyed;
}

/** Lowest drawn-terrain height along a run — skirts run down to this so no
    ground ever passes under the building. */
function groundMinAlong(frame, u0, u1, ground) {
  let gmin = Infinity;
  const n = Math.max(2, Math.ceil((u1 - u0) / 2));
  for (let i = 0; i <= n; i++) {
    const p = frame.at(u0 + ((u1 - u0) * i) / n, 0.1, 0);
    const g = ground(p.x, p.z);
    if (Number.isFinite(g) && g < gmin) gmin = g;
  }
  return Number.isFinite(gmin) ? gmin : 0;
}

/* ------------------------------------------------- the tower's repeating field */

/**
 * The one facade system on every long face of the tower, L3-L16: per storey a
 * dark slab-edge reveal with its drip, and per 1.675 m cycle a wide ribbed
 * panel, a narrow flat return, and a window POPPED OUT and rotated six degrees
 * out of the wall plane. The wall additionally steps in and out every TWO
 * storeys — the shingle band phf01 measures at 290 px against a 145 px floor
 * pitch.
 */
function collectField(section, f, frame, ctx, bins, u0, u1) {
  const G = section.grid;
  const FS = section.facadeSystem;
  const W = FS.window;
  const { storeyH } = ctx.mass.tower;
  const span = u1 - u0;
  if (span < 0.3) return;
  const cycles = Math.max(1, Math.round((f.cycles * span) / frame.length));
  const M = span / cycles;
  const seed = section.seed;

  /* The glazed corner bay eats the first or last `cornerBay.cycles` cycles of
     the face — sourced as "about 2 cycles", built as exactly 2 of this
     building's own counted cycles. */
  const cb = f.cornerBay && Math.abs(u0) < 0.01 && Math.abs(u1 - frame.length) < 0.01
    ? FS.cornerBay.cycles : 0;
  const cbStart = f.cornerBay === "start" ? cb : 0;
  const cbEnd = f.cornerBay === "end" ? cb : 0;

  for (let k = ctx.academicLevels; k < ctx.mass.tower.levels; k++) {
    const y0 = ctx.mass.tower.baseY + k * storeyH;
    const shingle = Math.floor(k / G.shingleStoreys) % 2 ? G.shingleStep : 0;

    /* The slab-edge reveal at the floor line, and its projecting drip. */
    bins.reveals.push({
      ...frame.at(u0 + span / 2, FS.standoff + shingle, y0 + G.revealBand / 2),
      rot: frame.rot, scale: [span, G.revealBand, FS.slabReveal.recess],
    });
    bins.drips.push({
      ...frame.at(u0 + span / 2, FS.standoff + shingle + FS.slabReveal.drip / 2, y0 + G.revealBand),
      rot: frame.rot, scale: [span, FS.slabReveal.recess, FS.slabReveal.drip],
    });
    /* phf01 at the near silhouette: the reveal does not just die at the plan
       corner, it TERMINATES in a small white wedge plate. One leg per face, so
       a corner gets the two legs that wrap it, and a run that is only part of a
       face gets none — the plate belongs to the corner, not to the run. */
    for (const [end, s] of [[u0, 1], [u1, -1]]) {
      if (Math.abs(end - (s > 0 ? 0 : frame.length)) > 0.01) continue;
      bins.wedges.push({
        ...frame.at(end + (s * FS.slabReveal.wedge) / 2,
          FS.standoff + shingle + FS.slabReveal.drip / 2, y0 + G.revealBand / 2),
        rot: frame.rot,
        scale: [FS.slabReveal.wedge, G.revealBand, FS.slabReveal.drip],
      });
    }

    const bandY0 = y0 + G.revealBand;
    const bandH = storeyH - G.revealBand;
    for (let c = 0; c < cycles; c++) {
      const cu = u0 + c * M;
      if (c < cbStart || c >= cycles - cbEnd) {
        /* The full-height glazed corner bay: vision and spandrel glass, one
           small square punched window per floor, a thin plate at each floor. */
        bins.cornerGlass.push({
          ...frame.at(cu + M / 2, FS.standoff + shingle + 0.04, bandY0 + bandH / 2),
          rot: frame.rot, scale: [M - 0.06, bandH, 1],
        });
        bins.cornerPlates.push({
          ...frame.at(cu + M / 2, FS.standoff + shingle + FS.cornerBay.plate, y0 + G.revealBand),
          rot: frame.rot, scale: [M, FS.cornerBay.plate, FS.cornerBay.plate * 2],
        });
        continue;
      }
      const proud = FS.standoff + shingle;
      /* 1. the wide ribbed panel */
      bins.ribbed.push({
        ...frame.at(cu + FS.ribbed.width / 2, proud + FS.ribbed.thickness / 2, bandY0 + bandH / 2),
        rot: frame.rot, scale: [FS.ribbed.width - 0.02, bandH, FS.ribbed.thickness],
      });
      /* 2. the narrow flat panel — the canted return of the pop-out box */
      const fu = cu + FS.ribbed.width + FS.flat.width / 2;
      bins.flats.push({
        ...frame.at(fu, proud + FS.popOut.depth / 2, bandY0 + bandH / 2),
        rot: frame.rot, scale: [FS.flat.width, bandH, FS.popOut.depth],
      });
      /* 3. the window, popped out and rotated six degrees, sense alternating */
      const sense = (c + k) % 2 ? 1 : -1;
      const wu = cu + FS.ribbed.width + FS.flat.width + W.width / 2;
      const wy = y0 + W.sill + W.height / 2;
      const wp = proud + FS.popOut.depth;
      bins.frames.push({
        ...frame.at(wu, wp - FS.popOut.depth / 2, wy),
        rot: frame.rot + sense * FS.rotation,
        scale: [W.width + 2 * W.frame, W.height + 2 * W.frame, FS.popOut.depth],
      });
      bins.glass.push({
        tint: hash(seed, k, c, Math.round(frame.length * 10)) < 0.28 ? "glassSky" : "windowGlass",
        ...frame.at(wu, wp + 0.01, wy),
        rot: frame.rot + sense * FS.rotation,
        scale: [W.width * (1 - W.leafFraction) - 0.02, W.height, 1],
      });
      bins.leaves.push({
        ...frame.at(wu + (W.width * (1 - W.leafFraction)) / 2, wp + 0.015, wy),
        rot: frame.rot + sense * FS.rotation,
        scale: [W.width * W.leafFraction, W.height - 0.04, 0.03],
      });
    }
  }
}

/** A pier: one of the four flat-panel returns and cheeks that frame the east
 *  loggia stack, full residential height, no openings. */
function collectPier(section, f, frame, ctx, bins, u0, u1) {
  const FS = section.facadeSystem;
  const G = section.grid;
  const { storeyH } = ctx.mass.tower;
  const span = u1 - u0;
  if (span < 0.3) return;
  for (let k = ctx.academicLevels; k < ctx.mass.tower.levels; k++) {
    const y0 = ctx.mass.tower.baseY + k * storeyH;
    const shingle = Math.floor(k / G.shingleStoreys) % 2 ? G.shingleStep : 0;
    bins.piers.push({
      ...frame.at(u0 + span / 2, FS.standoff + shingle + FS.pier.thickness / 2,
        y0 + G.revealBand + (storeyH - G.revealBand) / 2),
      rot: frame.rot, scale: [span, storeyH - G.revealBand, FS.pier.thickness],
    });
    bins.reveals.push({
      ...frame.at(u0 + span / 2, FS.standoff + shingle, y0 + G.revealBand / 2),
      rot: frame.rot, scale: [span, G.revealBand, FS.slabReveal.recess],
    });
  }
}

/**
 * The east common-space bay: an OPEN recessed loggia at every one of the 14
 * residential floors, with the gridded deep-teal curtain wall as its back, a
 * white slab edge across the full bay width and a glass balustrade set back
 * behind it. In SWA Learning-1 the slab edges read as a continuous 14-rung
 * ladder, and it is what identifies this end of the building.
 */
function collectLoggia(section, f, frame, ctx, bins, u0, u1) {
  const L = section.loggia;
  const FS = section.facadeSystem;
  const { storeyH } = ctx.mass.tower;
  const span = u1 - u0;
  const openW = Math.min(L.openWidth, span);
  const uc = u0 + span / 2;
  const pierW = (span - openW) / 2;

  for (let k = ctx.academicLevels; k < ctx.mass.tower.levels; k++) {
    const yFloor = ctx.mass.tower.baseY + k * storeyH;
    /* The dark recess, and the curtain wall that is its back (conflicts[10]). */
    bins.loggiaBacks.push({
      ...frame.at(uc, FS.standoff, yFloor + storeyH / 2),
      rot: frame.rot, scale: [openW, storeyH - L.slabEdge, 1],
    });
    bins.curtainGlass.push({
      ...frame.at(uc, FS.standoff + 0.05, yFloor + storeyH / 2),
      rot: frame.rot, scale: [openW - 0.2, storeyH - L.slabEdge - 0.1, 1],
    });
    const rows = Math.max(1, Math.round((storeyH - L.slabEdge) / L.curtain.transom));
    for (let t = 1; t < rows; t++) {
      bins.curtainMullions.push({
        ...frame.at(uc, FS.standoff + 0.1, yFloor + (t * (storeyH - L.slabEdge)) / rows),
        rot: frame.rot, scale: [openW - 0.2, 0.06, 0.06],
      });
    }
    const cols = Math.max(1, Math.round(openW / L.curtain.mullion));
    for (let t = 0; t <= cols; t++) {
      bins.curtainMullions.push({
        ...frame.at(uc - openW / 2 + (t * openW) / cols, FS.standoff + 0.1,
          yFloor + (storeyH - L.slabEdge) / 2),
        rot: frame.rot, scale: [0.06, storeyH - L.slabEdge - 0.1, 0.06],
      });
    }
    /* The projecting white slab edge — the ladder rung. */
    bins.loggiaSlabs.push({
      ...frame.at(uc, L.depth / 2, yFloor - L.slabEdge / 2),
      rot: frame.rot, scale: [openW, L.slabEdge, L.depth],
    });
    /* The glass balustrade, set back behind the slab edge. */
    bins.balustradeGlass.push({
      ...frame.at(uc, L.depth - L.balustrade.glassInset, yFloor + L.balustrade.height / 2),
      rot: frame.rot, scale: [openW - 0.2, L.balustrade.height, 1],
    });
    bins.rails.push({
      ...frame.at(uc, L.depth - L.balustrade.glassInset, yFloor + L.balustrade.height),
      rot: frame.rot, scale: [openW, L.balustrade.railBar, L.balustrade.railBar],
    });
    /* The two cheek walls that close the recess at its sides. */
    for (const s of [-1, 1]) {
      if (pierW <= 0.05) break;
      bins.piers.push({
        ...frame.at(uc + s * (openW / 2 + pierW / 2), FS.standoff + FS.pier.thickness / 2,
          yFloor + storeyH / 2),
        rot: frame.rot, scale: [pierW, storeyH, FS.pier.thickness],
      });
    }
  }
  /* The soffit that closes the topmost loggia. */
  bins.loggiaSlabs.push({
    ...frame.at(uc, L.depth / 2, ctx.mass.tower.roofY - L.slabEdge / 2),
    rot: frame.rot, scale: [openW, L.slabEdge, L.depth],
  });
}

/** The surveyed 4.14 m re-entrant notch at the west prow: a blank shadow slot,
 *  never a window bay. A blank wall claims less than glass. */
function collectShadowSlot(section, f, frame, ctx, bins, u0, u1) {
  const FS = section.facadeSystem;
  const span = u1 - u0;
  if (span < 0.3) return;
  bins.piers.push({
    ...frame.at(u0 + span / 2, FS.standoff + FS.pier.thickness / 2,
      (ctx.academicTop + ctx.mass.tower.roofY) / 2),
    rot: frame.rot,
    scale: [span, ctx.mass.tower.roofY - ctx.academicTop, FS.pier.thickness],
  });
}

/* -------------------------------------------- the academic wing's two storeys */

/**
 * L1 and L2 of the academic system, on ONE exposed run of ONE face. It is used
 * on the wing's own faces and, unchanged, on the runs of the TOWER that stand
 * off the wing — the west prow and the east bay — because the university's own
 * pages put academic offices and classrooms on the first two floors of the
 * tower too, and those runs are where they show.
 *
 * L1: ONE sourced datum sets this storey — the 2.7 m head line, which SWA
 *     Learning-7 reads BOTH as the height of the grey modular brick wall band
 *     "before the glazing head" AND as the storefront's own head. So the
 *     full-height bronze storefront runs to it and the brick that remains above
 *     it is the spandrel, 3.05 - 2.70 = 0.35 m deep on the drawn storey. The
 *     sourced 0.35 m canopy fascia hangs in exactly that band, which is two
 *     independent sourced figures closing on the drawn prism. Then either the
 *     free-standing square concrete colonnade (east and north) or the flat
 *     metal canopy eyebrow (everywhere else), and on the canopy runs the 0.8 m
 *     planting bed Learning-7 photographs at the foot of the glazing.
 * L2: pale architectural precast, alternately advanced and set back through the
 *     published six degrees, with narrow dark metal returns between, form-tie
 *     dots, and punched slot windows on the two runs phf01 resolves them on.
 */
function collectAcademic(section, f, frame, ctx, bins, u0, u1, baseY, opts = {}) {
  const A = section.academic;
  const L1 = A.l1;
  const L2 = A.l2;
  const FS = section.facadeSystem;
  const span = u1 - u0;
  if (span < 0.4) return;
  const colonnade = f.system === "academicColonnade";
  const storeyH = ctx.mass.base.storeyH;
  const gmin = groundMinAlong(frame, u0, u1, ctx.ground) - 0.5;
  /* Every L1 layer's offset from the DRAWN face, recorded as it is placed. The
     drawn prism is solid: a NEGATIVE offset is a layer pushed into the massing,
     where it renders as nothing at all. That is how the whole Ridge Walk
     colonnade — glazing, soffit, downlights, bed, kerb and columns — once came
     to be built inside arcgis.massing[252] with only the brick band showing.
     `counts.l1ReachMin` is gated at > 0 and `l1ReachMax` at the section's own
     2.2 m, so neither sign can come back silently. */
  const R = ctx.l1Reach;
  const at = (u, w, y) => {
    if (w < R.min) R.min = w;
    if (w > R.max) R.max = w;
    return frame.at(u, w, y);
  };
  /* Where the 9185 terrace stands against this wall, the L1 storey is BEHIND a
     3.05 m raised platform and there is no elevation to draw — drawing one puts
     a storefront inside a solid terrace. Only L2 is emitted there, which is
     exactly what phf03 photographs at the stair head: pale precast down to the
     terrace, with the door in it. */
  if (opts.skipL1) { collectAcademicL2(section, f, frame, bins, u0, u1, baseY, storeyH); return; }

  /* ---- L1: the storefront, FULL HEIGHT to the one sourced head line, and
     carried down past the datum to the low-water mark so no gap ever opens
     between the wall and a dipping ground. */
  const head = L1.head;
  const sfY0 = gmin;
  const sfH = baseY + head - gmin;
  const glassW = FS.standoff + L1.storefront.glassInset;
  const bays = Math.max(1, Math.round(span / L1.storefront.mullion));
  const bw = span / bays;
  for (let i = 0; i < bays; i++) {
    const u = u0 + (i + 0.5) * bw;
    const frosted = i % L1.storefront.frostedEvery === 0;
    (frosted ? bins.frosted : bins.storefrontGlass).push({
      ...at(u, glassW, sfY0 + sfH / 2),
      rot: frame.rot, scale: [bw - 0.06, sfH - 0.06, 1],
    });
    bins.mullions.push({
      ...at(u - bw / 2, glassW + 0.03, sfY0 + sfH / 2),
      rot: frame.rot, scale: [0.07, sfH, 0.07],
    });
  }
  bins.mullions.push({
    ...at(u1, glassW + 0.03, sfY0 + sfH / 2),
    rot: frame.rot, scale: [0.07, sfH, 0.07],
  });
  /* The head transom, on the sourced 2.7 m line. */
  bins.mullions.push({
    ...at(u0 + span / 2, glassW + 0.03, baseY + head),
    rot: frame.rot, scale: [span, 0.09, 0.09],
  });

  /* ---- L1: the brick spandrel, the band the head line leaves between the
     storefront and the L2 box. Emitted as one-metre strips at ONE true height
     so a single instanced mesh carries the measured 0.092 m course unstretched. */
  const spandrel = storeyH - head;
  const strips = Math.max(1, Math.round(span / 1));
  const sw = span / strips;
  for (let i = 0; i < strips; i++) {
    bins.brick.push({
      ...at(u0 + (i + 0.5) * sw, FS.standoff + 0.03, baseY + head + spandrel / 2),
      rot: frame.rot, scale: [sw, spandrel, 1],
    });
  }

  const recess = L1.colonnade.recess;
  if (colonnade) {
    /* The colonnade stands PROUD of the drawn face, exactly as keeling's
       undercroft columns do — the drawn prism is solid and the wall cannot be
       notched back, so the covered walk is made by standing the columns out,
       not by pushing the glass in. The column occupies the band between the
       sourced 1.2 m canopy projection and the derived 1.8 m setback, which is
       what makes the walk under it the SAME 1.2 m covered walk the canopy gives
       elsewhere — the recessNote's own derivation, built. */
    const n = Math.max(1, Math.round(span / L1.colonnade.spacing));
    for (let i = 0; i <= n; i++) {
      const u = u0 + (i * span) / n;
      bins.columns.push({
        ...at(u, recess - L1.colonnade.columnSize / 2, (gmin + baseY + storeyH) / 2),
        rot: frame.rot,
        scale: [L1.colonnade.columnSize, baseY + storeyH - gmin, L1.colonnade.columnSize],
      });
      if (i < n) {
        bins.downlights.push({
          ...at(u + span / (2 * n), recess / 2, baseY + storeyH - 0.06),
          rot: frame.rot,
        });
      }
    }
    bins.soffits.push({
      ...at(u0 + span / 2, recess / 2, baseY + storeyH - 0.06),
      rot: frame.rot, scale: [span, 0.12, recess],
    });
  } else if (!opts.underPorch) {
    /* The canopy eyebrow: a thin flat metal blade with a warm-tan soffit,
       hanging in the spandrel band the head line leaves. It starts clear of the
       glass line so the storefront is never inside it. Suppressed under the
       Front Porch, whose own roof already covers that run — two eyebrows over
       one door is the same class of error as two stairs at one address. */
    const cy = baseY + storeyH - L1.canopy.fascia;
    const proj = L1.canopy.projection - 0.1;
    bins.canopyTops.push({
      ...at(u0 + span / 2, 0.1 + proj / 2, cy + L1.canopy.fascia),
      rot: frame.rot, scale: [span, L1.canopy.edge, proj],
    });
    bins.canopySoffits.push({
      ...at(u0 + span / 2, 0.1 + proj / 2, cy),
      rot: frame.rot, scale: [span, L1.canopy.edge, proj],
    });
    bins.canopyFascias.push({
      ...at(u0 + span / 2, L1.canopy.projection, cy + L1.canopy.fascia / 2),
      rot: frame.rot, scale: [span, L1.canopy.fascia, L1.canopy.edge],
    });
  }

  /* ---- L1: the planting bed at the foot of the glazing, with its flush kerb.
     Learning-7 photographs it on a CANOPY run; phf01's colonnade runs are a
     paved covered walk and no frame resolves a bed under one, so it is withheld
     there rather than carried in (see absent). It is withheld under the Front
     Porch for the same reason the canopy is: that run is a covered floor.
     It rides the overlay ladder on the DRAWN surface under it, not on the
     skirt's low-water mark, or it would be buried. */
  if (!colonnade && !opts.underPorch) {
    const bedP = at(u0 + span / 2, L1.plantingBed.width / 2, 0);
    const bedG = ctx.ground(bedP.x, bedP.z);
    bins.beds.push({
      x: bedP.x, y: Number.isFinite(bedG) ? bedG : baseY, z: bedP.z,
      rot: frame.rot, scale: [span, 1, L1.plantingBed.width],
    });
    bins.kerbs.push({
      ...at(u0 + span / 2, L1.plantingBed.width + L1.plantingBed.kerb / 2,
        baseY + L1.plantingBed.kerbProud / 2 - 0.12),
      rot: frame.rot, scale: [span, 0.26, L1.plantingBed.kerb],
    });
  }

  collectAcademicL2(section, f, frame, bins, u0, u1, baseY, storeyH);
}

/** L2 of the academic system: pale architectural precast, alternately advanced
 *  and set back through the published six degrees, narrow dark metal returns
 *  between, the form-tie grid that identifies it as precast, and punched slot
 *  windows on the two runs phf01 resolves them on. */
function collectAcademicL2(section, f, frame, bins, u0, u1, baseY, storeyH) {
  const L2 = section.academic.l2;
  const FS = section.facadeSystem;
  const span = u1 - u0;
  const l2Y0 = baseY + storeyH;
  const mods = Math.max(1, Math.round(span / L2.panelModule));
  const mw = span / mods;
  const paleW = mw * (L2.paleWidth / L2.panelModule);
  const darkW = mw - paleW;
  const slots = L2.runsWithSlots.includes(f.run);
  for (let i = 0; i < mods; i++) {
    const u = u0 + i * mw;
    const fold = i % 2 ? L2.fold : 0;
    /* The punched slot window: one per two teeth (the sourced `everyTeeth`),
       and the tooth is two panel modules (the sourced two-panels-per-tooth), so
       the period is that product and not a typed-in 4. */
    const isSlot = slots && i % (L2.slotWindow.everyTeeth * 2) === 1;
    if (isSlot) {
      bins.slotFrames.push({
        ...frame.at(u + paleW / 2, FS.standoff + fold + 0.02, l2Y0 + storeyH / 2),
        rot: frame.rot,
        scale: [L2.slotWindow.width + 2 * L2.slotWindow.frame,
          L2.slotWindow.height + 2 * L2.slotWindow.frame, 0.08],
      });
      bins.slotGlass.push({
        ...frame.at(u + paleW / 2, FS.standoff + fold + 0.03, l2Y0 + storeyH / 2),
        rot: frame.rot, scale: [L2.slotWindow.width, L2.slotWindow.height, 1],
      });
      /* Precast above and below the opening, so the wall is never a hole. */
      const over = (storeyH - L2.slotWindow.height) / 2;
      for (const s of [-1, 1]) {
        bins.precast.push({
          ...frame.at(u + paleW / 2, FS.standoff + fold + 0.04,
            l2Y0 + storeyH / 2 + s * (L2.slotWindow.height + over) / 2),
          rot: frame.rot, scale: [paleW, over, 0.08],
        });
      }
    } else {
      bins.precast.push({
        ...frame.at(u + paleW / 2, FS.standoff + fold + 0.04, l2Y0 + storeyH / 2),
        rot: frame.rot, scale: [paleW, storeyH, 0.08],
      });
      /* The form-tie grid — 4 across a panel, 5 up a storey. It is what
         identifies the pale panels as architectural PRECAST in phf03. */
      for (let a = 0; a < L2.formTies.across; a++) {
        for (let b = 0; b < L2.formTies.up; b++) {
          bins.ties.push({
            ...frame.at(u + ((a + 0.5) * paleW) / L2.formTies.across,
              FS.standoff + fold + 0.085,
              l2Y0 + ((b + 0.5) * storeyH) / L2.formTies.up),
            rot: frame.rot,
            scale: [L2.formTies.diameter, L2.formTies.diameter, 0.012],
          });
        }
      }
    }
    if (darkW > 0.02) {
      bins.returns.push({
        ...frame.at(u + paleW + darkW / 2, FS.standoff + fold / 2 + 0.02, l2Y0 + storeyH / 2),
        rot: frame.rot, scale: [darkW, storeyH, 0.06],
      });
    }
  }
}

/**
 * The sawtooth parapet screen, on one exposed run. Each tooth is a vertical
 * rise on its left edge falling on a straight rake to the right into the next
 * tooth's rise; the screen stands in front of a FLAT roof and the sky reads
 * through every notch, which is the whole finding. The rake is tessellated in
 * RAKE_SLICES vertical slices — a mesh resolution, not a measurement.
 */
function collectSawtooth(section, frame, u0, u1, lidY, bins) {
  const S = section.academic.sawtooth;
  const span = u1 - u0;
  if (span < 0.4) return 0;
  /* The tooth count is the run's own, but the pitch it produces must stay
     inside the sourced 1.22 +/- 0.20 m band — that band is a declared tolerance
     and it is not decorative. `round(span / pitch)` alone ignores it: on the
     wing's short exposed runs it was laying teeth at 0.82 m and at 1.80 m,
     both outside the source. A run too short to hold even one in-band tooth
     ships as the plain upstand alone rather than as a tooth at a pitch no frame
     supports. */
  const [pLo, pHi] = S.pitchBand;
  const nMax = Math.floor(span / pLo);
  const nMin = Math.ceil(span / pHi);
  const valleyY = lidY + S.valleyAboveLid;

  /* The screen body: a plain upstand from the drawn lid to the valley line. */
  bins.screen.push({
    ...frame.at(u0 + span / 2, S.thickness / 2 - 0.02, (lidY + valleyY) / 2),
    rot: frame.rot, scale: [span, valleyY - lidY, S.thickness],
  });
  /* The coping-fascia band behind the teeth, at CONSTANT height, read through
     every notch in SWA Learning-7. */
  bins.copingBand.push({
    ...frame.at(u0 + span / 2, -S.copingBand.setback, valleyY + S.copingBand.depth / 2),
    rot: frame.rot, scale: [span, S.copingBand.depth, S.copingBand.depth],
  });
  if (nMax < 1 || nMin > nMax) return 0;
  const teeth = Math.min(nMax, Math.max(nMin, Math.round(span / S.pitch)));
  const pitch = span / teeth;
  for (let t = 0; t < teeth; t++) {
    const tu = u0 + t * pitch;
    for (let s = 0; s < RAKE_SLICES; s++) {
      const frac = (s + 0.5) / RAKE_SLICES;
      const h = S.amplitude * (1 - frac);
      if (h < 0.01) continue;
      bins.teeth.push({
        ...frame.at(tu + ((s + 0.5) * pitch) / RAKE_SLICES, S.thickness / 2 - 0.02, valleyY + h / 2),
        rot: frame.rot, scale: [pitch / RAKE_SLICES, h, S.thickness],
      });
    }
  }
  return teeth;
}

/* --------------------------------------------------------- the roofscapes */

/** A roof's own (u, v) frame: u along a named ring edge's tangent, v inward. */
function roofFrameOf(verts, edge) {
  const a = verts[edge];
  const b = verts[(edge + 1) % verts.length];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const tx = (b[0] - a[0]) / len;
  const tz = (b[1] - a[1]) / len;
  const [ox, oz] = outwardOf(verts, edge, (edge + 1) % verts.length);
  const ix = -ox;
  const iz = -oz;
  return {
    at: (u, v) => ({ x: a[0] + tx * u + ix * v, z: a[1] + tz * u + iz * v }),
    rot: Math.atan2(ix, iz),
    extent: () => {
      let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
      for (const p of verts) {
        const dx = p[0] - a[0];
        const dz = p[1] - a[1];
        const u = dx * tx + dz * tz;
        const v = dx * ix + dz * iz;
        u0 = Math.min(u0, u); u1 = Math.max(u1, u);
        v0 = Math.min(v0, v); v1 = Math.max(v1, v);
      }
      return { u0, u1, v0, v1 };
    },
  };
}

/**
 * Does a footprint of `su` x `sv` centred at (u, v) sit wholly on the drawn
 * roof? All four corners inside the ring, outside every declared clip, and
 * outside every blocker. Keeling's `pv.clips` exist for exactly this reason —
 * "because nothing may hover" — and the corner test is its general form.
 */
function roofFits(rf, verts, clips, blockers, u, v, su, sv) {
  for (const c of clips) {
    if (u + su / 2 > c.u0 && u - su / 2 < c.u1 && v + sv / 2 > c.v0 && v - sv / 2 < c.v1) return false;
  }
  for (const du of [-su / 2, su / 2]) {
    for (const dv of [-sv / 2, sv / 2]) {
      const p = rf.at(u + du, v + dv);
      if (!inRing(p.x, p.z, verts)) return false;
      if (blockers.some((r) => inRing(p.x, p.z, r))) return false;
    }
  }
  return true;
}

function buildTowerRoof(section, parent, verts, roofY, counts) {
  const R = section.roof;
  const { colors } = section;
  const group = new THREE.Group();
  group.name = "podemos-tower-roof";
  parent.add(group);
  const rf = roofFrameOf(verts, R.frame.originFace);
  const clips = R.clips || [];
  const e = rf.extent();
  const unit = new THREE.BoxGeometry(1, 1, 1);

  /* The membrane field, laid as strips clipped to the drawn ring so it never
     paints over the two surveyed steps at the east bay. */
  const strip = 1.5;
  const field = [];
  for (let u = e.u0; u < e.u1; u += strip) {
    const su = Math.min(strip, e.u1 - u);
    for (let v = e.v0; v < e.v1; v += strip) {
      const sv = Math.min(strip, e.v1 - v);
      if (!roofFits(rf, verts, clips, [], u + su / 2, v + sv / 2, su * 0.98, sv * 0.98)) continue;
      field.push({ ...rf.at(u + su / 2, v + sv / 2), y: roofY + overlayLift(PAD), rot: rf.rot, scale: [su, 1, sv] });
    }
  }
  const fieldMesh = instanced(quad(1, 1),
    decal(colors.roofMembrane, PAD, "roofMembrane", [strip / 2, strip / 2]), field, (it) => it);
  fieldMesh.renderOrder = OVERLAY[PAD].renderOrder;
  group.add(fieldMesh);
  counts.roofFieldStrips = field.length;

  /* The blue-grey secondary field down the middle — the walk pads and ballast
     runs that are the roof's dominant pattern at long range. */
  const W = R.walkway;
  const pads = [];
  let padsClipped = 0;
  const vLine = (e.v0 + e.v1) / 2;
  for (let u = e.u0; u < e.u1; u += W.strip) {
    const su = Math.min(W.strip, e.u1 - u);
    if (!roofFits(rf, verts, clips, [], u + su / 2, vLine, su, W.width)) { padsClipped++; continue; }
    pads.push({ ...rf.at(u + su / 2, vLine), y: roofY + overlayLift(CARPET), rot: rf.rot, scale: [su, 1, W.width] });
  }
  for (const u of W.crossLegs) {
    for (let v = W.inset; v < vLine; v += W.strip) {
      const sv = Math.min(W.strip, vLine - v);
      if (!roofFits(rf, verts, clips, [], u, v + sv / 2, W.width, sv)) { padsClipped++; continue; }
      pads.push({ ...rf.at(u, v + sv / 2), y: roofY + overlayLift(CARPET), rot: rf.rot, scale: [W.width, 1, sv] });
    }
  }
  const padMesh = instanced(quad(1, 1),
    decal(colors.roofFieldBlue, CARPET, "roofMembrane", [1, 1]), pads, (it) => it);
  padMesh.renderOrder = OVERLAY[CARPET].renderOrder;
  group.add(padMesh);
  counts.roofPads = pads.length;
  counts.roofPadsClipped = padsClipped;

  /* The four penthouse volumes, all in the same light metal panel. */
  const houses = [];
  const louvres = [];
  const extras = [];
  let penthousesClipped = 0;
  for (const p of R.penthouses) {
    if (!roofFits(rf, verts, clips, [], p.u, p.v, p.size[0], p.size[2])) { penthousesClipped++; continue; }
    const c = rf.at(p.u, p.v);
    houses.push({ x: c.x, y: roofY + p.size[1] / 2, z: c.z, rot: rf.rot, scale: p.size });
    /* Its coping, so no roof edge anywhere on this building is left raw. */
    extras.push({
      x: c.x, y: roofY + p.size[1] + 0.05, z: c.z, rot: rf.rot,
      scale: [p.size[0] + 0.12, 0.1, p.size[2] + 0.12],
    });
    if (p.louvre) {
      const lc = rf.at(p.u, p.v - p.size[2] / 2 - 0.06);
      louvres.push({
        x: lc.x, y: roofY + p.size[1] * 0.6, z: lc.z, rot: rf.rot,
        scale: [p.louvre.size[0], p.louvre.size[1], 0.1],
      });
    }
    if (p.door) {
      const dc = rf.at(p.u + p.size[0] * 0.3, p.v - p.size[2] / 2 - 0.06);
      louvres.push({
        x: dc.x, y: roofY + p.door[1] / 2, z: dc.z, rot: rf.rot,
        scale: [p.door[0], p.door[1], 0.1],
      });
    }
    if (p.hatch) {
      extras.push({
        x: c.x, y: roofY + p.size[1] + p.hatch[1] / 2 + 0.1, z: c.z, rot: rf.rot, scale: p.hatch,
      });
    }
  }
  group.add(instanced(unit, panelMat(colors.panelBody), houses, (it) => it));
  group.add(instanced(unit, louvreMat(colors.louvreDark), louvres, (it) => it));
  group.add(instanced(unit, painted(colors.mechanicalGrey), extras, (it) => it));
  counts.roofPenthouses = houses.length;
  counts.roofPenthousesClipped = penthousesClipped;

  /* Mechanical: the duct spine with its radiused elbow, the plenum, the row of
     six packaged RTUs on the east half, and the slim mast near the centre. */
  const boxes = [];
  const tubes = [];
  const elbows = [];
  let equipmentClipped = 0;
  for (const q of R.equipment) {
    const su = q.kind === "duct" ? q.length : q.kind === "elbow" ? 2 * q.radius
      : q.kind === "mast" ? q.diameter : q.size[0];
    const sv = q.kind === "duct" ? q.diameter : q.kind === "elbow" ? 2 * q.radius
      : q.kind === "mast" ? q.diameter : q.size[2];
    if (!roofFits(rf, verts, clips, [], q.u, q.v, su, sv)) { equipmentClipped++; continue; }
    const c = rf.at(q.u, q.v);
    if (q.kind === "duct") {
      tubes.push({
        x: c.x, y: roofY + q.diameter / 2 + 0.35, z: c.z, rot: rf.rot, rotZ: Math.PI / 2,
        scale: [q.diameter, q.length, q.diameter],
      });
    } else if (q.kind === "elbow") {
      elbows.push({
        x: c.x, y: roofY + q.diameter / 2 + 0.35, z: c.z, rot: rf.rot, rotX: Math.PI / 2,
        scale: [q.radius, q.radius, q.radius],
      });
    } else if (q.kind === "mast") {
      tubes.push({
        x: c.x, y: roofY + q.height / 2, z: c.z, rot: rf.rot,
        scale: [q.diameter, q.height, q.diameter],
      });
    } else {
      boxes.push({ x: c.x, y: roofY + q.size[1] / 2 + (q.kind === "rtu" ? 0.14 : 0), z: c.z, rot: rf.rot, scale: q.size });
      if (q.kind === "rtu") {
        /* The rails the row stands on — the frames show them clearly. */
        for (const s of [-1, 1]) {
          const rc = rf.at(q.u, q.v + s * q.size[2] * 0.35);
          boxes.push({
            x: rc.x, y: roofY + 0.07, z: rc.z, rot: rf.rot,
            scale: [q.size[0], 0.14, 0.12],
          });
        }
      }
    }
  }
  group.add(instanced(unit, painted(colors.mechanicalGrey), boxes, (it) => it));
  group.add(instanced(new THREE.CylinderGeometry(0.5, 0.5, 1, TUBE_SIDES),
    painted(colors.ductGalv), tubes, (it) => it));
  group.add(instanced(new THREE.TorusGeometry(1, 0.3, 6, TUBE_SIDES, Math.PI / 2),
    painted(colors.ductGalv), elbows, (it) => it));
  counts.roofEquipment = R.equipment.length;
  counts.roofEquipmentClipped = equipmentClipped;

  /* Small curbs, vents and drain pairs: counted only approximately in phf15, so
     they ship as a SEEDED SCATTER and every candidate that does not fit the
     drawn ring is dropped. */
  const C = R.curbs;
  const curbs = [];
  let curbsClipped = 0;
  for (let i = 0; i < C.candidates; i++) {
    const u = e.u0 + hash(section.seed, i, 11) * (e.u1 - e.u0);
    const v = e.v0 + hash(section.seed, i, 29) * (e.v1 - e.v0);
    if (!roofFits(rf, verts, clips, [], u, v, C.size[0], C.size[2])) { curbsClipped++; continue; }
    const c = rf.at(u, v);
    curbs.push({ x: c.x, y: roofY + C.size[1] / 2, z: c.z, rot: rf.rot, scale: C.size });
  }
  group.add(instanced(unit, painted(colors.mechanicalGrey), curbs, (it) => it));
  counts.roofCurbs = curbs.length;
  counts.roofCurbsClipped = curbsClipped;

  counts.pv = R.pv.panels;
  counts.pvRacks = R.pv.racks;
  counts.pvBallastTrays = R.pv.ballastTrays;
}

/** The academic wing's roof: one flat plane behind the sawtooth screen, with a
 *  painted yellow warning line and NOTHING else — no plant and no array. It is
 *  clipped against the drawn tower, which stands on 1038 m2 of it. */
function buildBaseRoof(section, parent, verts, towerVerts, roofY, counts) {
  const A = section.academic.roof;
  const { colors } = section;
  const group = new THREE.Group();
  group.name = "podemos-base-roof";
  parent.add(group);
  const rf = roofFrameOf(verts, A.frame.originFace);
  const e = rf.extent();

  const strip = 2.0;
  const field = [];
  let clipped = 0;
  for (let u = e.u0; u < e.u1; u += strip) {
    const su = Math.min(strip, e.u1 - u);
    for (let v = e.v0; v < e.v1; v += strip) {
      const sv = Math.min(strip, e.v1 - v);
      if (!roofFits(rf, verts, [], [towerVerts], u + su / 2, v + sv / 2, su * 0.98, sv * 0.98)) {
        clipped++;
        continue;
      }
      field.push({ ...rf.at(u + su / 2, v + sv / 2), y: roofY + overlayLift(PAD), rot: rf.rot, scale: [su, 1, sv] });
    }
  }
  const mesh = instanced(quad(1, 1),
    decal(colors.roofMembrane, PAD, "roofMembrane", [strip / 2, strip / 2]), field, (it) => it);
  mesh.renderOrder = OVERLAY[PAD].renderOrder;
  group.add(mesh);
  counts.baseRoofStrips = field.length;
  counts.baseRoofClipped = clipped;

  /* The painted yellow warning line, set in from the roof edge and clipped by
     the same rule as everything else. */
  const line = [];
  const w = A.warningLine.inset;
  for (let i = 0; i < verts.length; i++) {
    const j = (i + 1) % verts.length;
    const len = Math.hypot(verts[j][0] - verts[i][0], verts[j][1] - verts[i][1]);
    if (len < 1.0) continue;
    const fr = frameOf(verts[i], verts[j], outwardOf(verts, i, j));
    const n = Math.max(1, Math.round(len / 1.5));
    for (let k = 0; k < n; k++) {
      const p = fr.at(((k + 0.5) * len) / n, -w, 0);
      if (!inRing(p.x, p.z, verts) || inRing(p.x, p.z, towerVerts)) continue;
      line.push({
        x: p.x, y: roofY + overlayLift(PAINT), z: p.z, rot: fr.rot,
        scale: [len / n, 1, A.warningLine.width],
      });
    }
  }
  const lineMesh = instanced(quad(1, 1), decal(colors.warningYellow, PAINT), line, (it) => it);
  lineMesh.renderOrder = OVERLAY[PAINT].renderOrder;
  group.add(lineMesh);
  counts.warningLineStrips = line.length;
  counts.baseRoofPv = A.pv.panels;
}

/* ------------------------------------------------------- the 9185 entry stair */

/**
 * The monumental entry stair on Ridge Walk, the item the shipped
 * campus-eighth.js withheld on the dead-epoch argument.
 *
 * WHICH of the three surveyed east door recesses it serves is decided by the
 * SURVEY, not by taste: the drawn tower's east common-space bay reaches a metre
 * east of the wing's own east wall, so a 9.0 m terrace and its 8.0 m flight fit
 * clear of the drawn tower at exactly one of the three. The rule is evaluated
 * here, against the rings, so it cannot rot.
 */
function pickRecess(section, baseVerts, towerVerts) {
  const S = section.entryStair;
  const reach = S.terrace.depth + S.run + S.door.recessDepth;
  for (const r of section.recesses) {
    const a = baseVerts[r.back];
    const b = baseVerts[(r.back + 1) % baseVerts.length];
    const fr = frameOf(a, b, outwardOf(baseVerts, r.back, (r.back + 1) % baseVerts.length));
    let clear = true;
    for (let i = 0; i <= 12 && clear; i++) {
      for (let j = 0; j <= 12 && clear; j++) {
        const p = fr.at(fr.length / 2 + (i / 12 - 0.5) * S.width, (j / 12) * reach, 0);
        if (inRing(p.x, p.z, towerVerts)) clear = false;
      }
    }
    if (clear) return { r, fr };
  }
  return null;
}

/** The terrace's footprint as a world polygon, so the wall behind it can have
 *  its L1 storey taken out and nothing is ever drawn inside a solid. */
function terracePolyOf(section, fr) {
  const S = section.entryStair;
  const uc = fr.length / 2;
  const d = S.terrace.depth + S.door.recessDepth;
  const c = [
    fr.at(uc - S.width / 2, -0.4, 0), fr.at(uc + S.width / 2, -0.4, 0),
    fr.at(uc + S.width / 2, d, 0), fr.at(uc - S.width / 2, d, 0),
  ];
  return c.map((p) => [p.x, p.z]);
}

function buildEntryStair(section, parent, hit, baseY, ground, counts) {
  const S = section.entryStair;
  const { colors } = section;
  const group = new THREE.Group();
  group.name = "podemos-entry-stair";
  parent.add(group);

  counts.stairRecess = hit ? hit.r.id : null;
  counts.stairRisers = 0;
  counts.stairTreadInserts = 0;
  counts.stairHandrailRuns = 0;
  counts.stairFreeStandingRuns = 0;
  counts.stairRailBrackets = 0;
  if (!hit) return;
  const { fr } = hit;
  const uc = fr.length / 2;
  const unit = new THREE.BoxGeometry(1, 1, 1);

  /* Ground under the whole composition, so nothing hovers over a dip. */
  let gmin = Infinity;
  const reach = S.terrace.depth + S.run + S.door.recessDepth;
  for (let i = 0; i <= 8; i++) {
    for (let j = 0; j <= 8; j++) {
      const p = fr.at(uc + (i / 8 - 0.5) * S.width, (j / 8) * reach, 0);
      const g = ground(p.x, p.z);
      if (Number.isFinite(g) && g < gmin) gmin = g;
    }
  }
  if (!Number.isFinite(gmin)) gmin = baseY;
  gmin -= 0.3;

  /* The terrace: one drawn storey above the wing's own datum, which is both the
     L1/L2 line the door sits at and — to 1.6% — the sourced 3.1 m rise. */
  const terraceY = baseY + S.totalRise;
  const tDepth = S.terrace.depth + S.door.recessDepth;
  const deck = new THREE.Mesh(quad(S.width, tDepth),
    decal(colors.terraceConcrete, CARPET, "smoothConcrete", [S.width / 2, tDepth / 2]));
  const dc = fr.at(uc, tDepth / 2, 0);
  deck.position.set(dc.x, terraceY + overlayLift(CARPET), dc.z);
  deck.rotation.y = fr.rot;
  deck.renderOrder = OVERLAY[CARPET].renderOrder;
  group.add(deck);

  const solids = [];
  solids.push({
    ...fr.at(uc, tDepth / 2, (terraceY + gmin) / 2), rot: fr.rot,
    scale: [S.width, terraceY - gmin, tDepth],
  });

  /* Twenty treads, each carried down to the lowest ground under the flight so
     no riser ever floats over a dip. */
  const treads = [];
  const inserts = [];
  for (let i = 0; i < S.risers; i++) {
    const top = terraceY - (i + 1) * S.rise;
    const u = tDepth + (i + 0.5) * S.tread;
    treads.push({
      ...fr.at(uc, u, (top + gmin) / 2), rot: fr.rot,
      scale: [S.width, top - gmin, S.tread],
    });
    /* The continuous 15 mm recessed shadow line at the head of every riser. */
    treads.push({
      ...fr.at(uc, u - S.tread / 2 + S.riserReveal / 2, top - S.rise + S.riserReveal),
      rot: fr.rot, scale: [S.width - 0.1, S.riserReveal * 2, S.riserReveal],
    });
    /* Two dark plates per tread, staggered left and right. */
    for (let k = 0; k < S.treadInsert.perTread; k++) {
      const side = (i + k) % 2 ? 1 : -1;
      inserts.push({
        ...fr.at(uc + side * (S.width * 0.22 + k * 0.35), u - S.tread * 0.3, top + 0.005),
        rot: fr.rot, scale: [S.treadInsert.size[0], 0.01, S.treadInsert.size[1]],
      });
    }
  }
  counts.stairRisers = S.risers;
  counts.stairTreadInserts = inserts.length;

  /* The two solid triangular cheeks in folded dark-grey metal panel, each with
     a flat capped top face. The rake is one sloped plate; the fill below it is
     the tread boxes, which already reach the ground. */
  const rake = Math.hypot(S.run, S.totalRise);
  const tilt = Math.atan2(S.totalRise, S.run);
  const cheeks = [];
  for (const side of [-1, 1]) {
    cheeks.push({
      ...fr.at(uc + side * (S.width / 2 + S.cheek.thickness / 2), tDepth + S.run / 2,
        terraceY - S.totalRise / 2 + S.cheek.capWidth / 2),
      rot: fr.rot, rotZ: 0, rotX: -tilt,
      scale: [S.cheek.thickness, S.cheek.capWidth, rake],
    });
    cheeks.push({
      ...fr.at(uc + side * (S.width / 2 + S.cheek.thickness / 2), tDepth + S.run / 2,
        (terraceY - S.totalRise / 2 + gmin) / 2),
      rot: fr.rot,
      scale: [S.cheek.thickness, terraceY - S.totalRise / 2 - gmin, S.run],
    });
  }

  /* Four handrail runs at the 36 in the frame measures, with 180-degree returns
     top and bottom. phf03 resolves them as THREE free-standing runs on round
     stanchions plus one run carried on the wall side — so `freeStanding` is
     read, not decorative: the outermost lane, the one that lands against the
     stair cheek and the seat wall, is bracketed off that cheek instead of
     standing on stanchions through the tread. */
  const H = S.handrail;
  const rails = [];
  const posts = [];
  const brackets = [];
  const lanes = [];
  for (let i = 0; i < H.runs; i++) lanes.push(-S.width / 2 + (i * S.width) / (H.runs - 1));
  lanes.forEach((lane, i) => {
    const free = i >= H.runs - H.freeStanding;
    rails.push({
      ...fr.at(uc + lane, tDepth + S.run / 2, terraceY - S.totalRise / 2 + H.height),
      rot: fr.rot, rotX: -tilt, scale: [H.tube, H.tube, rake + 2 * H.returnLength],
    });
    const n = Math.max(2, Math.round(rake / H.postSpacing));
    for (let p = 0; p <= n; p++) {
      const t = p / n;
      const u = tDepth + t * S.run;
      const nose = terraceY - t * S.totalRise;
      if (free) {
        posts.push({
          ...fr.at(uc + lane, u, nose + H.height / 2), rot: fr.rot,
          scale: [H.post, H.height, H.post],
        });
      } else {
        brackets.push({
          ...fr.at(uc + lane - S.cheek.thickness / 2, u, nose + H.height), rot: fr.rot,
          scale: [S.cheek.thickness, H.post, H.post],
        });
      }
    }
    counts.stairHandrailRuns++;
    if (free) counts.stairFreeStandingRuns++;
  });
  counts.stairRailBrackets = brackets.length;

  /* The grey brick seat wall at the foot of the flight, L-shaped in plan, with
     its flush dark metal cap. Students sit on it in phf03. */
  const SW = S.seatWall;
  const seatBrick = [];
  const seatCap = [];
  const legs = [
    { u: tDepth + S.run + SW.depth / 2, lane: -S.width / 2 - SW.length / 2, w: SW.length, d: SW.depth },
    { u: tDepth + S.run + SW.length / 2, lane: -S.width / 2 - SW.depth / 2, w: SW.depth, d: SW.length },
  ];
  for (const leg of legs) {
    const strips = Math.max(1, Math.round(leg.w / 1));
    for (let i = 0; i < strips; i++) {
      seatBrick.push({
        ...fr.at(uc + leg.lane - leg.w / 2 + (i + 0.5) * (leg.w / strips), leg.u,
          (gmin + gmin + SW.height) / 2 + (baseY - gmin) / 2),
        rot: fr.rot, scale: [leg.w / strips, SW.height + baseY - gmin, leg.d],
      });
    }
    seatCap.push({
      ...fr.at(uc + leg.lane, leg.u, baseY + SW.height + SW.cap / 2),
      rot: fr.rot, scale: [leg.w, SW.cap, leg.d],
    });
  }

  /* The recessed glazed door the terrace serves, in the surveyed recess. */
  const doorGlass = [{
    ...fr.at(uc, 0.06, terraceY + S.door.height / 2), rot: fr.rot,
    scale: [S.door.width, S.door.height, 1],
  }];

  group.add(instanced(unit, concrete(colors.terraceConcrete), solids.concat(treads), (it) => it));
  group.add(instanced(unit, painted(colors.treadInsertDark), inserts, (it) => it));
  group.add(instanced(unit, panelMat(colors.metalReturnDark), cheeks, (it) => it));
  group.add(instanced(new THREE.CylinderGeometry(0.5, 0.5, 1, TUBE_SIDES),
    painted(colors.railStainless), rails.map((r) => ({ ...r, rotZ: Math.PI / 2 })), (it) => it));
  group.add(instanced(new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
    painted(colors.railStainless), posts, (it) => it));
  group.add(instanced(unit, painted(colors.railStainless), brackets, (it) => it));
  const B = section.academic.l1.brick;
  group.add(instanced(new THREE.BoxGeometry(1, 1, 1),
    brickMat(colors.brickSunlit, 1, SW.height, B), seatBrick, (it) => it));
  group.add(instanced(unit, painted(colors.metalReturnDeep), seatCap, (it) => it));
  group.add(instanced(new THREE.PlaneGeometry(1, 1), glassMat(colors.glassSky), doorGlass, (it) => it));
  counts.addressBuilt = S.address.built ? 1 : 0;
}

/* --------------------------------------------------------- the Front Porch */

/**
 * The Front Porch: a covered entry room built OUTWARD off the academic wing's
 * south-west flank, where the UCSD Aug-2020 ground plan puts Podemos's
 * residential lobby and core. The drawn prism is solid and cannot be notched,
 * so the porch projects rather than cuts. One sourced colonnade bay deep, the
 * surveyed 7.60 m flank wide, on two columns at this building's own sourced
 * 0.60 m square and 6.0 m spacing. [estimated] throughout — no photograph in
 * the set resolves this face.
 */
function porchSiteOf(section, baseVerts) {
  const P = section.frontPorch;
  const i = P.faceIndex;
  const j = (i + 1) % baseVerts.length;
  const fr = frameOf(baseVerts[i], baseVerts[j], outwardOf(baseVerts, i, j));
  const width = Math.min(P.width, fr.length);
  const uc = fr.length / 2;
  const c = [
    fr.at(uc - width / 2, -0.4, 0), fr.at(uc + width / 2, -0.4, 0),
    fr.at(uc + width / 2, P.depth, 0), fr.at(uc - width / 2, P.depth, 0),
  ];
  return { fr, width, uc, poly: c.map((p) => [p.x, p.z]) };
}

function buildFrontPorch(section, parent, site, baseY, ground, counts) {
  const P = section.frontPorch;
  const { colors } = section;
  const group = new THREE.Group();
  group.name = "podemos-front-porch";
  parent.add(group);
  const { fr, width, uc } = site;

  let gmin = Infinity;
  const gs = [];
  for (let a = 0; a <= 6; a++) {
    for (let b = 0; b <= 6; b++) {
      const p = fr.at(uc + (a / 6 - 0.5) * width, (b / 6) * P.depth, 0);
      const g = ground(p.x, p.z);
      if (!Number.isFinite(g)) continue;
      gs.push(g);
      gmin = Math.min(gmin, g);
    }
  }
  gs.sort((a, b) => a - b);
  const gm = gs.length ? gs[Math.floor(gs.length / 2)] : baseY;
  if (!Number.isFinite(gmin)) gmin = gm;

  const floor = new THREE.Mesh(quad(width, P.depth),
    decal(colors.plazaPaver, CARPET, "pavingConcreteUnit", [width / 1.2, P.depth / 1.2]));
  const fc = fr.at(uc, P.depth / 2, 0);
  floor.position.set(fc.x, gm + overlayLift(CARPET), fc.z);
  floor.rotation.y = fr.rot;
  floor.renderOrder = OVERLAY[CARPET].renderOrder;
  group.add(floor);

  const columns = [];
  for (let c = 0; c < P.columns; c++) {
    const lane = -((P.columns - 1) * P.columnSpacing) / 2 + c * P.columnSpacing;
    if (Math.abs(lane) > width / 2) continue;
    columns.push({
      ...fr.at(uc + lane, P.depth - P.columnSize, (gmin + baseY + P.clearHeight) / 2),
      rot: fr.rot,
      scale: [P.columnSize, baseY + P.clearHeight - gmin, P.columnSize],
    });
  }
  group.add(instanced(new THREE.BoxGeometry(1, 1, 1), concrete(colors.concreteColumn), columns, (it) => it));

  /* The porch roof hangs in the SAME spandrel band the canopy fascia and the
     brick spandrel occupy — clear height to the sourced 2.7 m head line and
     0.35 m of blade above it, which puts its top exactly on the L2 line. It
     used to sit a whole band higher and swallow the bottom course of L2's
     form-tie grid. */
  const soffit = new THREE.Mesh(new THREE.BoxGeometry(width, P.soffit, P.depth),
    painted(colors.canopySoffit));
  const sc = fr.at(uc, P.depth / 2, 0);
  soffit.position.set(sc.x, baseY + P.clearHeight + P.soffit / 2, sc.z);
  soffit.rotation.y = fr.rot;
  soffit.castShadow = soffit.receiveShadow = true;
  group.add(soffit);

  counts.porchColumns = columns.length;
  counts.porchDeckY = Math.round((gm + overlayLift(CARPET)) * 1000) / 1000;
}

/* ------------------------------------------------------------------- api */

/**
 * Build Podemos Hall's photo-sourced detail.
 *
 * `photo` is the loaded photo-detail document; this reads only its `podemos`
 * section, writes nothing back, and returns `{ group, counts }` (empty and
 * harmless if the section is missing, so a half-wired boot still runs).
 * `surfaceAt` — the height of the DRAWN terrain triangle — seats everything
 * that stands on the ground. `heightAt` solves the drawn lid of each mass
 * exactly as campus-massing.js roofElevation does, because that is what put
 * the measured masses there and the two must not diverge.
 */
export function createPhotoPodemos(scene, { photo, heightAt, surfaceAt } = {}) {
  const group = new THREE.Group();
  group.name = "photo-podemos";
  const section = photo?.podemos;
  if (!section) {
    scene?.add(group);
    return { group, counts: {} };
  }
  const ground = surfaceAt || heightAt;
  const base = heightAt || surfaceAt;
  if (typeof ground !== "function" || typeof base !== "function") {
    throw new Error("campus-photo-podemos: needs surfaceAt (or heightAt) to place on the ground");
  }

  /* The drawn lid of each mass, by the massing's own rule over the DRAWN ring.
     The storey grid is that prism read back — h / levels — so the counted bands
     fill the drawn box with zero residual. Here, uniquely for Eighth, the drawn
     3.05 m and the sourced 3.048 m agree to 2 mm on both masses. */
  const mass = {};
  const verts = {};
  for (const [key, m] of Object.entries(section.measured.masses)) {
    verts[key] = vertsOf(m.ring);
    const roofY = roofElevationOf(m.ring, m.h, base);
    mass[key] = { h: m.h, levels: m.levels, roofY, baseY: roofY - m.h, storeyH: m.h / m.levels };
  }
  const academicLevels = section.grid.academicLevels;
  const ctx = {
    mass, ground, base, academicLevels,
    academicTop: mass.tower.baseY + academicLevels * mass.tower.storeyH,
    l1Reach: { min: Infinity, max: -Infinity },
  };

  const bins = {
    ribbed: [], flats: [], frames: [], glass: [], leaves: [], reveals: [], drips: [],
    cornerGlass: [], cornerPlates: [], piers: [], wedges: [],
    loggiaBacks: [], loggiaSlabs: [], curtainGlass: [], curtainMullions: [],
    balustradeGlass: [], rails: [],
    brick: [], storefrontGlass: [], frosted: [], mullions: [], columns: [], soffits: [],
    downlights: [], canopyTops: [], canopySoffits: [], canopyFascias: [], beds: [], kerbs: [],
    precast: [], returns: [], ties: [], slotFrames: [], slotGlass: [],
    screen: [], copingBand: [], teeth: [], parapets: [], copings: [],
  };
  const counts = {
    interiorFacades: 0, exposedRuns: 0, academicRuns: 0, sawteeth: 0,
    colonnadeColumns: 0, canopyRuns: 0, brickStrips: 0,
    porchCoveredRuns: 0, sawtoothPitchMin: Infinity, sawtoothPitchMax: 0,
  };

  /* ------------------------------------------------------------- the tower */
  for (const f of section.facades.filter((x) => x.mass === "tower")) {
    const v = verts.tower;
    const frame = frameOf(v[f.i], v[f.j], outwardOf(v, f.i, f.j));
    /* Above the academic band the whole face is exposed. */
    if (f.system === "field") collectField(section, f, frame, ctx, bins, 0, frame.length);
    else if (f.system === "pier") collectPier(section, f, frame, ctx, bins, 0, frame.length);
    else if (f.system === "loggia") collectLoggia(section, f, frame, ctx, bins, 0, frame.length);
    else if (f.system === "shadowSlot") collectShadowSlot(section, f, frame, ctx, bins, 0, frame.length);

    /* Below it, the tower's own L1-L2 is academic — and it only EXISTS on the
       runs where the tower stands off the wing (the west prow and the east
       common-space bay). Everywhere else those two storeys are inside the wing
       and there is no wall to draw. */
    for (const [a, b] of exposedRuns(frame, [verts.base])) {
      collectAcademic(section, { ...f, system: "academicCanopy", run: "tower-base" },
        frame, ctx, bins, a, b, mass.tower.baseY);
      counts.academicRuns++;
    }
  }

  /* The 9185 terrace's footprint, solved against the two rings before any wall
     is emitted, so the run it stands against loses its L1 storey. */
  const stair = pickRecess(section, verts.base, verts.tower);
  const terracePoly = stair ? terracePolyOf(section, stair.fr) : null;
  /* And the Front Porch's, for the same reason: the run it covers must not also
     grow the L1 canopy eyebrow or the planting bed underneath it. */
  const porch = porchSiteOf(section, verts.base);

  /* ------------------------------------------- the academic wing, run by run */
  for (const f of section.facades.filter((x) => x.mass === "base")) {
    if (f.system === "interior") { counts.interiorFacades++; continue; }
    const v = verts.base;
    const frame = frameOf(v[f.i], v[f.j], outwardOf(v, f.i, f.j));
    for (const [a, b] of exposedRuns(frame, [verts.tower])) {
      counts.exposedRuns++;
      for (const [c, d, [onTerrace, underPorch]] of
        splitByPolys(frame, a, b, [terracePoly, porch.poly])) {
        collectAcademic(section, f, frame, ctx, bins, c, d, mass.base.baseY,
          { skipL1: onTerrace, underPorch });
        counts.academicRuns++;
        if (onTerrace) counts.terraceCoveredRuns = (counts.terraceCoveredRuns || 0) + 1;
        if (underPorch) counts.porchCoveredRuns++;
      }
      const teeth = collectSawtooth(section, frame, a, b, mass.base.roofY, bins);
      if (teeth) {
        const pitch = (b - a) / teeth;
        counts.sawtoothPitchMin = Math.min(counts.sawtoothPitchMin, pitch);
        counts.sawtoothPitchMax = Math.max(counts.sawtoothPitchMax, pitch);
      }
      counts.sawteeth += teeth;
      if (f.system === "academicColonnade") counts.colonnadeColumns++;
      else counts.canopyRuns++;
    }
  }

  /* ----------------------------------------------- the tower's own parapet */
  const PB = section.parapet;
  for (let i = 0; i < verts.tower.length; i++) {
    const j = (i + 1) % verts.tower.length;
    const frame = frameOf(verts.tower[i], verts.tower[j], outwardOf(verts.tower, i, j));
    if (frame.length < 0.3) continue;
    bins.parapets.push({
      ...frame.at(frame.length / 2, section.facadeSystem.standoff + PB.thickness / 2 - 0.02,
        mass.tower.roofY + PB.height / 2),
      rot: frame.rot, scale: [frame.length, PB.height, PB.thickness],
    });
    bins.copings.push({
      ...frame.at(frame.length / 2, section.facadeSystem.standoff + PB.thickness / 2 - 0.02,
        mass.tower.roofY + PB.height + PB.copingHeight / 2),
      rot: frame.rot,
      scale: [frame.length, PB.copingHeight, PB.thickness + 2 * PB.copingProud],
    });
  }

  /* ------------------------------------------------------------- emit */
  const { colors } = section;
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const plane = new THREE.PlaneGeometry(1, 1);
  const add = (geo, mat, items) => {
    if (!items.length) return;
    group.add(instanced(geo, mat, items, (it) => it));
  };

  add(unit, ribbedMat(colors.panelRibbed), bins.ribbed);
  add(unit, panelMat(colors.panelFlat), bins.flats.concat(bins.cornerPlates));
  add(unit, panelMat(colors.panelBody), bins.frames.concat(bins.piers));
  for (const tint of ["windowGlass", "glassSky"]) {
    add(plane, glassMat(colors[tint]), bins.glass.filter((g) => g.tint === tint));
  }
  add(unit, painted(colors.metalReturnDark), bins.leaves.concat(bins.returns));
  add(unit, painted(colors.metalReturnDeep), bins.reveals.concat(bins.slotFrames));
  add(unit, panelMat(colors.panelFlat), bins.drips);
  add(plane, glassMat(colors.cornerGlassTeal), bins.cornerGlass);
  add(plane, panelMat(colors.loggiaSoffit), bins.loggiaBacks);
  /* The loggia slab edges and the small white wedge plates that terminate the
     slab reveal at every plan corner are the same white element. */
  add(unit, concrete(colors.loggiaSlabWhite), bins.loggiaSlabs.concat(bins.wedges));
  add(plane, glassMat(colors.curtainTeal), bins.curtainGlass);
  add(unit, painted(colors.storefrontMullion), bins.curtainMullions.concat(bins.mullions));
  add(plane, glassMat(colors.glassSky), bins.balustradeGlass.concat(bins.storefrontGlass));
  add(unit, painted(colors.railStainless), bins.rails);
  add(plane, glassMat(colors.canopyFascia), bins.frosted);
  add(unit, concrete(colors.concreteColumn), bins.columns);
  add(unit, painted(colors.canopySoffit),
    bins.soffits.concat(bins.canopySoffits).concat(bins.copingBand));
  add(unit, painted(colors.canopyFascia), bins.canopyTops.concat(bins.canopyFascias));
  add(new THREE.CylinderGeometry(section.academic.l1.colonnade.downlight / 2,
    section.academic.l1.colonnade.downlight / 2, 0.06, 10),
    lens(colors.canopyFascia, 0.22), bins.downlights);
  add(unit, concrete(colors.terraceConcrete), bins.kerbs);
  add(unit, precastMat(colors.precastPale), bins.precast.concat(bins.screen).concat(bins.teeth));
  add(unit, painted(colors.metalReturnDeep), bins.ties);
  add(plane, glassMat(colors.windowGlass), bins.slotGlass);
  add(unit, panelMat(colors.panelBody), bins.parapets);
  add(unit, painted(colors.canopyFascia), bins.copings);
  counts.brickStrips = bins.brick.length;

  /* Brick: every spandrel strip is one metre wide and one band deep, so one
     instanced mesh carries the measured 0.092 m course at one true scale
     everywhere and no course is stretched. */
  const B = section.academic.l1.brick;
  add(unit, brickMat(colors.brickBody, 1, B.spandrelHeight, B), bins.brick);

  /* The planting beds ride the overlay ladder — they are flat on the ground. */
  if (bins.beds.length) {
    const bedMesh = instanced(quad(1, 1),
      decal(colors.mulchBark, PAD, "decomposedGranite", [2, 2]), bins.beds,
      (it) => ({ ...it, y: it.y + overlayLift(PAD) }));
    bedMesh.renderOrder = OVERLAY[PAD].renderOrder;
    group.add(bedMesh);
  }

  buildTowerRoof(section, group, verts.tower, mass.tower.roofY, counts);
  buildBaseRoof(section, group, verts.base, verts.tower, mass.base.roofY, counts);

  const gr = new THREE.Group();
  gr.name = "podemos-ground";
  buildEntryStair(section, gr, stair, mass.base.baseY, ground, counts);
  buildFrontPorch(section, gr, porch, mass.base.baseY, ground, counts);
  group.add(gr);

  scene?.add(group);
  return {
    group,
    counts: {
      ...counts,
      facades: section.facades.length,
      ribbedPanels: bins.ribbed.length,
      flatReturns: bins.flats.length,
      windows: bins.glass.length,
      ventLeaves: bins.leaves.length,
      slabReveals: bins.reveals.length,
      revealCornerWedges: bins.wedges.length,
      cornerBayPanes: bins.cornerGlass.length,
      piers: bins.piers.length,
      loggias: section.loggia.count,
      loggiaSlabs: bins.loggiaSlabs.length,
      precastPanels: bins.precast.length,
      formTies: bins.ties.length,
      slotWindows: bins.slotGlass.length,
      sawtoothSlices: bins.teeth.length,
      screenRuns: bins.screen.length,
      copingBands: bins.copingBand.length,
      storefrontBays: bins.storefrontGlass.length + bins.frosted.length,
      colonnadeColumnMeshes: bins.columns.length,
      plantingBeds: bins.beds.length,
      parapetSegments: bins.parapets.length,
      copings: bins.copings.length,
      wordmarkBuilt: 0,
      l1ReachMin: ctx.l1Reach.min,
      l1ReachMax: ctx.l1Reach.max,
      draws: group.children.length,
    },
  };
}
