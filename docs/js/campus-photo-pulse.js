// Pulse Hall (BLDG 1), Theatre District Living & Learning Neighborhood /
// Eighth College — from photographs, the INVENTED class.
//
// HKS (design architect and design-build lead) with EYRC Architects; Kitchell
// GC; SWA Group landscape; Walter P Moore structure. Occupied Fall 2023 — the
// only one of the five TDLLN buildings finished for that autumn.
//
// Six things decided the shape of this file, and four of them are epoch
// arguments rather than modelling ones:
//
//   1. THERE IS NO LiDAR HERE AND NONE MAY BE INVENTED. The project's survey
//      is 2014; the building is 2023. campus-lidar.json massHeights has no
//      entry for either Pulse key and campus-massing.js:16 records LiDAR
//      measuring this site at parking-lot height. campus-3d's OSM h does not
//      cover it either. So the ONLY prism this project has for Pulse is the
//      facilities massing ring and its GIS h, and every datum below solves on
//      it by campus-massing.js's own rule — rim-median ground under the DRAWN
//      ring plus the DRAWN h, lifted past a high corner. York's header is why:
//      solved on the wrong datum, its whole membrane floated 6 m over the
//      drawn parapet.
//
//   2. PULSE IS ONE BUILDING DRAWN AS TWO MASSES. massing[463] "Pulse Tower"
//      and massing[487] "Pulse Mid" share the 45.7 m edge
//      (-197.7, 562.5)->(-152.0, 562.1) exactly, and the vertices either end
//      of the Mid's 6.4 m east return. North of that line the bar is 10
//      storeys and 11.6 m deep; south of it 9 storeys and 6.9 m deep; 11.6 +
//      6.9 = 18.5 m, which is the free-standing east wing's own perpendicular
//      depth of 18.17 m. It is one 18.5 m double-loaded corridor bar whose
//      roof steps one storey along its south third — not two towers with a
//      slot between them, so those edges carry NO facade, only the step wall.
//      A third shared edge fell out of the point-in-ring probe and is not in
//      the research inventory: the Mid's 3.0 m west tab stands against 4.20 m
//      of the Tower's west wall (both at x = -197.7, z 558.0-562.5). That is
//      why the externally visible perimeter here is 216.6 m and not 225.3.
//
//   3. NO ROOFTOP PV. The 2021 design renderings draw large dark-blue arrays
//      on these lids; the 2024-25 drone frame shows white membrane, two
//      mechanical screen wells, ducts and condensers and nothing else — in
//      the same frame in which KEELING's rooftop PV is plainly visible. That
//      in-frame control is what makes the negative credible, and it is
//      recorded in `roof.pv` and in `absent` in the exact form of Keeling's
//      deleted-canopy note. Nothing here draws a panel.
//
//   4. THE SIX DEGREES ARE PUBLISHED, THE SENSE IS NOT. HKS: windows are
//      "popped out and rotated SIX DEGREES on the lower towers" for a 30%
//      airflow gain, with fins instead on the taller sections — so this is
//      Pulse's move (10 storeys) and not Sankofa's (21) or Podemos's (16).
//      The magnitude drives the geometry exactly (the derived 2.4596 m
//      opening x sin 6 deg = 0.2571 m at the leading jamb, flush at the
//      trailing one); the SENSE is one consistent choice, labelled
//      [estimated] in the data.
//
//   5. NO DIMENSION LIVES IN THIS FILE. Every metre this module draws with
//      comes out of the section: `derivations.figures` (with the arithmetic
//      that produces it), `estimates` (labelled, naming the sourced pattern
//      it extends), `reads` (a citation and its tolerance) or `draw` (render
//      offsets, which are declared as offsets and are not claims about the
//      building). Keeling puts `ballastTray [0.5, 0.06, 0.38]` in the
//      document; so does this. The test fails on a bare number here.
//
//   6. THE GROUND STOREY HAS ONE DATUM AND IT IS NOT THE TERRAIN. The drawn
//      terrain under Pulse is a 2014 read of the parking lot the building
//      replaced, so it cannot carry the 0.91 m level change SWA-16
//      photographs between the court and the colonnade. Everything at L1 —
//      recess, storefront, piers, soffit, the north entry terrace, its guard
//      and the top of the flight — is measured from the DRAWN PRISM BASE;
//      everything that must MEET the ground (the terrace's fascia, the
//      flight, the porch deck, every skirt) is carried down to the drawn
//      surface from there. The flight builds only the risers that surface
//      supports, at the station where it falls furthest, and the rest of the
//      level change is declared in `absent`. The previous revision put six
//      risers 0.15-0.75 m under flat ground and hung two handrails over them.
//
// Colours are DATA — every hex comes from the `colors` block of the photo
// document's `pulse` section, and every role carries its own provenance in
// `colorSources`. Surfaces come from the procedural material library
// (campus-materials.js): the library supplies microstructure at true panel,
// block and paver scale, the section supplies the colour. Deterministic
// throughout — the only irregularity source is `hash`, seeded from the
// section's pinned `seed`.
//
// What is deliberately NOT here is the section's `absent` list, which is 24
// entries long and includes the street address (two defensible derivations
// disagree), the PULSE wordmark (no frame resolves one), every door but the
// colonnade pair, the breezeway's planting and internal steps, the Front
// Porch's step up from grade, the west end's slot windows and Apple-mesh
// loggias, and the rooftop terrace's long element.
import * as THREE from "../vendor/three/three.module.min.js";
import { applyOverlayDepth, overlayLift } from "./campus-overlay.js";
import { sharedMaterialLibrary } from "./campus-materials.js";

/* Ground decals ride the overlay ladder so they paint over the measured
   terrain in a fixed order instead of z-fighting it. The Front Porch is the
   only thing in this module that is genuinely a decal: the north entry
   terrace is a raised deck and is built as solid. */
const CARPET = "carpet";

let LIB = null;
const lib = () => (LIB ??= sharedMaterialLibrary(THREE));

/* Large-format flat rainscreen: barely metallic, matte, panel-scale joints.
   The repeat is driven off the section's own derived panel size. */
const rainscreen = (color, w, h, pw, ph) =>
  lib().get("metalPanel", {
    color, metalness: 0.06, roughness: 0.78, normalScale: 0.45,
    repeat: [Math.max(1, w / pw), Math.max(1, h / ph)],
  });
const panelMetal = (color) =>
  lib().get("metalPanel", { color, metalness: 0.35, roughness: 0.55 });
const trim = (color) =>
  lib().get("metalPanel", { color, metalness: 0.5, roughness: 0.42 });
const concrete = (color) => lib().get("smoothConcrete", { color });
const glassMat = (color) => lib().get("glass", { color });
const masonry = (color, w, h, tile) =>
  lib().get("brick", { color, normalScale: 0.7, repeat: [w / tile, h / tile] });
const membraneMat = (color, w, d, tile) =>
  lib().get("roofMembrane", { color, repeat: [w / tile, d / tile] });
const paver = (color) => lib().get("pavingConcreteUnit", { color, repeat: [1, 1] });
/* Plant clumps stay a plain standard material — the library's foliage class is
   an alpha-cut CARD map and cutting holes in clump geometry shreds it. */
const foliage = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0.0 });
/* The colonnade recess and the breezeway are photographed VOIDS: matte and
   opaque, so lighting cannot lift them into a pale glazed screen (the Argo
   lesson). */
const voidPlane = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.98, metalness: 0.0 });

function decalMat(color, cls, repeat) {
  return applyOverlayDepth(lib().get(cls, { color, repeat }), CARPET);
}

/** Deterministic 0..1 from any integer mix — a reload rebuilds the same wall. */
function hash(...ns) {
  let s = 0;
  for (let i = 0; i < ns.length; i++) s = s * 131.71 + ns[i] * 57.13 + 7.9;
  const v = Math.sin(s) * 43758.5453;
  return v - Math.floor(v);
}

/** One InstancedMesh from a list of placements (the keeling/york convention). */
function instanced(geo, mat, items, place = (it) => it) {
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

/**
 * A facade's own frame. The tangent is the DRAWN edge itself; `out` only
 * decides which perpendicular is outward. `at(u, w, y)`: u metres along the
 * face from `a`, w metres proud, y in world height. A box rotated by `rot`
 * has its local +Z along the outward normal, so a positive extra rotation
 * about Y swings the box's local -X jamb PROUD by (w/2) sin(delta) and its
 * +X jamb flush — which is exactly the 6-degree window move.
 */
function frameOf(f) {
  const [sx, sz] = f.a;
  const [ex, ez] = f.b;
  const length = Math.hypot(ex - sx, ez - sz);
  const tx = (ex - sx) / length;
  const tz = (ez - sz) / length;
  let nx = tz;
  let nz = -tx;
  if (nx * f.out[0] + nz * f.out[1] < 0) { nx = -nx; nz = -nz; }
  return {
    id: f.id,
    length, rot: Math.atan2(nx, nz),
    nx, nz, tx, tz,
    /* u measured from whichever end of THIS edge is further west, so a
       station read off a photograph "from the west end" lands correctly
       whatever order the survey ring happens to list the vertices in. */
    fromWest: (u) => (sx <= ex ? u * length : (1 - u) * length),
    at: (u, w, y) => ({ x: sx + tx * u + nx * w, y, z: sz + tz * u + nz * w }),
  };
}

/** Bay centres along a face, the leftover split evenly at both ends. */
function bayCentres(length, count) {
  const out = [];
  const module = length / count;
  for (let i = 0; i < count; i++) out.push({ i, u: (i + 0.5) * module, module });
  return out;
}

/** Lowest drawn-terrain height along a face, sampled every 2 m at the wall. */
function groundMinAlong(frame, ground, off) {
  let gmin = Infinity;
  const n = Math.max(2, Math.ceil(frame.length / DRAPE_SEG));
  for (let i = 0; i <= n; i++) {
    const p = frame.at((i * frame.length) / n, off, 0);
    const g = ground(p.x, p.z);
    if (Number.isFinite(g) && g < gmin) gmin = g;
  }
  return Number.isFinite(gmin) ? gmin : 0;
}

/* ------------------------------------------------------------ ring maths */

const inRing = (x, z, r) => {
  let ins = false;
  for (let i = 0, j = r.length - 2; i < r.length - 1; j = i++) {
    const [xi, zi] = r[i];
    const [xj, zj] = r[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
};

/** Distance from (x, z) to the ring boundary, sign-free. */
function edgeDistance(x, z, r) {
  let best = Infinity;
  for (let i = 0; i < r.length - 1; i++) {
    const [ax, az] = r[i];
    const [bx, bz] = r[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz;
    let t = len2 ? ((x - ax) * dx + (z - az) * dz) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
    if (d < best) best = d;
  }
  return best;
}

/**
 * THE CLIP. A roof or terrace item exists only where its own (x, z) is inside
 * the DRAWN ring and clear of every edge by `clear`. Both lids are stepped Ls
 * and a bounding-box grid overruns them on four sides — nothing may hover.
 */
const clipped = (x, z, ring, clear) => inRing(x, z, ring) && edgeDistance(x, z, ring) >= clear;

/**
 * Two oriented rectangles in plan, by separating axis. Returns the smallest
 * penetration depth, or a value <= 0 when they are apart. This is what keeps
 * the roof honest: the walk pad is dropped where it would run through the
 * bulkhead or over its own other run, and the vent grid is dropped where the
 * pad or the plant already stands. An earlier revision pushed two long pad
 * boxes with no such test and drove one of them 0.82 m through a bulkhead.
 */
function rect(x, z, rot, along, across) {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return {
    x, z,
    ux: c * (along / 2), uz: -s * (along / 2),
    vx: s * (across / 2), vz: c * (across / 2),
  };
}
function overlap(a, b) {
  const axes = [];
  for (const r of [a, b]) {
    const ul = Math.hypot(r.ux, r.uz) || 1;
    const vl = Math.hypot(r.vx, r.vz) || 1;
    axes.push([r.ux / ul, r.uz / ul], [r.vx / vl, r.vz / vl]);
  }
  let min = Infinity;
  for (const [nx, nz] of axes) {
    const ra = Math.abs(a.ux * nx + a.uz * nz) + Math.abs(a.vx * nx + a.vz * nz);
    const rb = Math.abs(b.ux * nx + b.uz * nz) + Math.abs(b.vx * nx + b.vz * nz);
    const d = Math.abs((b.x - a.x) * nx + (b.z - a.z) * nz);
    const pen = ra + rb - d;
    if (pen <= 0) return pen;
    if (pen < min) min = pen;
  }
  return min;
}

/** The massing's own roof rule, on the DRAWN ring and the DRAWN h. */
function roofOf(ring, h, baseFn) {
  const gs = [];
  let highest = -Infinity;
  for (const [x, z] of ring) {
    const g = baseFn(x, z);
    if (Number.isFinite(g)) {
      gs.push(g);
      if (g > highest) highest = g;
    }
  }
  gs.sort((a, b) => a - b);
  const surveyed = (gs.length ? gs[Math.floor(gs.length / 2)] : 0) + h;
  return highest > -Infinity && surveyed < highest ? highest : surveyed;
}

/* ------------------------------------------------------------- geometry */

/** The projecting picture frame: one extruded ring, instanced everywhere. */
function pictureFrame(w, h, face, depth, back) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, -h / 2);
  s.lineTo(w / 2, -h / 2);
  s.lineTo(w / 2, h / 2);
  s.lineTo(-w / 2, h / 2);
  s.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-w / 2 + face, -h / 2 + face);
  hole.lineTo(w / 2 - face, -h / 2 + face);
  hole.lineTo(w / 2 - face, h / 2 - face);
  hole.lineTo(-w / 2 + face, h / 2 - face);
  hole.closePath();
  s.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  geo.translate(0, 0, -back);
  return geo;
}

/** A lid polygon cut from the DRAWN ring itself, so it cannot overrun. */
function lidGeometry(ring) {
  const pts = ring.slice(0, ring.length - 1).map(([x, z]) => new THREE.Vector2(x, z));
  const shape = new THREE.Shape(pts);
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(Math.PI / 2);
  return geo;
}

/**
 * A ground strip in a face's frame, DRAPED on the drawn terrain — one vertex
 * every ~2 m, so the deck follows the surface instead of seating flat at its
 * centre (the Galbraith lesson). Built vertex by vertex in the face's own
 * frame because the porch runs diagonally along the east wing.
 */
const DRAPE_SEG = 2;
function drapedStrip(frame, u0, u1, w0, w1, ground, lift) {
  const nu = Math.max(2, Math.ceil((u1 - u0) / DRAPE_SEG));
  const nw = Math.max(1, Math.ceil((w1 - w0) / DRAPE_SEG));
  const c = frame.at((u0 + u1) / 2, (w0 + w1) / 2, 0);
  const base = ground(c.x, c.z);
  const pos = [];
  const uv = [];
  const idx = [];
  for (let j = 0; j <= nw; j++) {
    for (let i = 0; i <= nu; i++) {
      const p = frame.at(u0 + ((u1 - u0) * i) / nu, w0 + ((w1 - w0) * j) / nw, 0);
      const g = ground(p.x, p.z);
      pos.push(p.x - c.x, (Number.isFinite(g) ? g : base) - base, p.z - c.z);
      uv.push(i / nu, j / nw);
    }
  }
  for (let j = 0; j < nw; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i;
      idx.push(a, a + nu + 1, a + 1, a + 1, a + nu + 1, a + nu + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, null);
  mesh.position.set(c.x, base + lift, c.z);
  mesh.name = "ground-decal";
  return mesh;
}

/* ------------------------------------------------------ facade systems */

/**
 * Where the field face's blue-grey chimneys stand at each level. A chimney is
 * 4-6 panels of slate blue-grey used as a vertical stack that JOGS floor to
 * floor and carries a window stack with it, so the elevation reads as a
 * staggered two-tone field rather than a grid (SWA-16). The jog is
 * deterministic from the section seed and never moves more than one bay per
 * storey — the photographed stagger without a claim about its pattern.
 */
function chimneyBays(section, faceIdx, f, level, bayCount, firstBay) {
  const C = section.system.chimney;
  const n = Math.max(0, Math.round(bayCount / C.chimneysPerBaysDivisor));
  const out = [];
  for (let c = 0; c < n; c++) {
    const home = firstBay + Math.round(((c + 0.5) * bayCount) / n - 0.5);
    const r = hash(section.seed, faceIdx, c * 7 + 3, level * 13 + 5);
    const jog = r < 0.34 ? -C.jogBays : r < 0.67 ? 0 : C.jogBays;
    let b = home + jog;
    if (b < firstBay) b = firstBay;
    if (b > firstBay + bayCount - 1) b = firstBay + bayCount - 1;
    out.push(b);
  }
  return out;
}

/** One 6-degree-rotated window box: glass, picture frame, transom. */
function collectWindow(section, frame, u, y, gold, bins, width) {
  const W = section.system.window;
  const D = section.draw;
  const w = width ?? W.width;
  const theta = (W.rotationDeg * Math.PI) / 180;
  const standoff = D.windowStandoff + (w / 2) * Math.sin(theta);
  const rot = frame.rot + theta;
  const p = frame.at(u, standoff, y);
  bins.windowGlass.push({ ...p, rot, scale: [w, W.height, 1] });
  /* The common room's wider glazing gets its own frame instance set: an
     InstancedMesh cannot rescale an extruded ring without thickening it. */
  (width ? bins.frameCommon : gold ? bins.frameGold : bins.frameCharcoal).push({ ...p, rot });
  /* The transom bar is the same trim profile as the picture frame around it —
     one trim section for the whole facade, so its size is the frame's face. */
  const F = section.system.frame;
  bins.transoms.push({
    ...frame.at(u, standoff + D.transomOffset, y + W.height * (W.transomFrac - 0.5)),
    rot,
    scale: [w - 2 * F.face, F.face, F.face],
  });
}

/** The two-tone rainscreen elevation: the sourced north face and its kin. */
function collectFieldFace(section, faceIdx, f, frame, m, bins) {
  const C = section.system.chimney;
  const W = section.system.window;
  const D = section.draw;
  const rows = m.residentialRows;
  const bays = bayCentres(frame.length, f.bays);
  const first = f.blankBays ? f.blankBays[1] : 0;
  const live = bays.slice(first);

  /* The residential field, one plane per face at true panel scale. */
  const fieldH = rows * m.storeyH;
  bins.walls.push({
    tone: "fieldPanel", w: frame.length, h: fieldH,
    ...frame.at(frame.length / 2, D.wallOffset, m.baseY + m.storeyH + fieldH / 2),
    rot: frame.rot,
  });

  for (let lv = 0; lv < rows; lv++) {
    const y0 = m.baseY + (lv + 1) * m.storeyH;
    const chimneys = new Set(chimneyBays(section, faceIdx, f, lv, live.length, first));
    for (const c of chimneys) {
      const bay = bays[c];
      bins.chimneys.push({
        ...frame.at(bay.u, D.wallOffset + D.chimneyOffset / 2, y0 + m.storeyH / 2),
        rot: frame.rot,
        scale: [C.width, m.storeyH, D.chimneyOffset],
      });
    }
    for (const bay of live) {
      collectWindow(section, frame, bay.u, y0 + W.sill + W.height / 2,
        !chimneys.has(bay.i), bins);
    }
  }
  collectGroundStorey(section, f, frame, m, bins);
  collectSkirt(section, f, frame, m, bins);
}

/** The inner bend: a wider glazed Residential Common Space per floor. */
function collectCommonRoomFace(section, faceIdx, f, frame, m, bins) {
  const R = section.system.commonRoom;
  const D = section.draw;
  const rows = m.residentialRows;
  const fieldH = rows * m.storeyH;
  bins.walls.push({
    tone: "fieldPanel", w: frame.length, h: fieldH,
    ...frame.at(frame.length / 2, D.wallOffset, m.baseY + m.storeyH + fieldH / 2),
    rot: frame.rot,
  });
  for (let lv = 0; lv < rows; lv++) {
    const y0 = m.baseY + (lv + 1) * m.storeyH;
    collectWindow(section, frame, frame.length / 2,
      y0 + R.sill + R.height / 2, true, bins, R.glazingWidth);
  }
  collectGroundStorey(section, f, frame, m, bins);
  collectSkirt(section, f, frame, m, bins);
}

/** Solid pale end wall. No opening is invented — see `absent`. */
function collectEndWall(section, f, frame, m, bins) {
  const h = m.roofY - m.baseY;
  bins.walls.push({
    tone: "fieldPanel", w: frame.length, h,
    ...frame.at(frame.length / 2, section.draw.wallOffset, m.baseY + h / 2),
    rot: frame.rot,
  });
  collectSkirt(section, f, frame, m, bins);
}

/**
 * The stacked common-room lantern that terminates BOTH ends of the bar: pale
 * cladding, a grid of small square openings in a raised white frame, two
 * columns per facet and one row per floor. The east tip's 12.24 m facet is
 * longer than two columns fill; the drone frame resolves two, so two ship.
 */
function collectLanternFace(section, f, frame, m, bins) {
  const L = section.lantern;
  const D = section.draw;
  const rows = m.lanternRows;
  const h = m.roofY - m.baseY;
  bins.walls.push({
    tone: "lanternCladding", w: frame.length, h,
    ...frame.at(frame.length / 2, D.cladOffset, m.baseY + h / 2),
    rot: frame.rot,
  });
  const [ow, oh] = L.opening;
  for (let lv = 0; lv < rows; lv++) {
    const y = m.baseY + lv * m.storeyH + L.sill + oh / 2;
    for (let c = 0; c < L.columnsPerFacet; c++) {
      const u = (frame.length * (c + 1)) / (L.columnsPerFacet + 1);
      const p = frame.at(u, D.cladOffset + D.glassOffset, y);
      bins.lanternGlass.push({ ...p, rot: frame.rot, scale: [ow, oh, 1] });
      bins.lanternFrames.push({ ...p, rot: frame.rot });
    }
  }
  collectSkirt(section, f, frame, m, bins);
}

/** The exposed west return of the one-storey roof step. */
function collectStepFace(section, f, frame, m, bins, lowerRoofY) {
  const h = m.roofY - lowerRoofY;
  if (h <= section.draw.seatEmbed) return;
  bins.walls.push({
    tone: "fieldPanel", w: frame.length, h,
    ...frame.at(frame.length / 2, section.draw.wallOffset, lowerRoofY + h / 2),
    rot: frame.rot,
  });
}

/** The ground storey: a near-black base band, or the colonnade's own void. */
function collectGroundStorey(section, f, frame, m, bins) {
  const GS = section.groundStorey;
  if (GS.colonnade.face === f.id) return;
  if (!GS.baseBandFaces.includes(f.id)) return;
  bins.walls.push({
    tone: "baseBand", w: frame.length, h: m.storeyH,
    ...frame.at(frame.length / 2, section.draw.bandOffset, m.baseY + m.storeyH / 2),
    rot: frame.rot,
  });
}

/** Carry every face down PAST the drawn terrain so no ground runs under it. */
function collectSkirt(section, f, frame, m, bins) {
  const D = section.draw;
  const bottom = groundMinAlong(frame, m.ground, D.wallOffset) - D.buryDepth;
  if (m.baseY - bottom <= D.seatEmbed) return;
  bins.walls.push({
    tone: "baseBand", w: frame.length, h: m.baseY - bottom,
    ...frame.at(frame.length / 2, D.skirtOffset, (m.baseY + bottom) / 2),
    rot: frame.rot,
  });
}

/* ------------------------------------------------------------ the roof */

/**
 * The two mechanical screen wells, SOLVED off the ring: each read u fraction
 * along the west bar (measured from its west end) and centred across the
 * Tower strip's own surveyed depth. Their coordinates used to be four typed
 * numbers apiece.
 */
function screenWellBoxes(section) {
  const SW = section.roof.screenWells;
  const f = section.facades.find((x) => x.id === SW.alongFace);
  const fr = frameOf(f);
  const inset = section.measured.depth.towerStrip / 2;
  const [w, d] = SW.size;
  return SW.uFromWest
    .map((u) => {
      const c = fr.at(fr.fromWest(u), -inset, 0);
      return { x0: c.x - w / 2, x1: c.x + w / 2, z0: c.z - d / 2, z1: c.z + d / 2 };
    })
    .sort((a, b) => a.x0 - b.x0);
}

function buildRoof(section, mass, m, bins, plant) {
  const R = section.roof;
  const ring = mass.ring;

  /* Parapet + coping. The Tower carries one on every ring segment: on the two
     shared edges it caps the step wall and guards the higher lid. The Mid
     carries one only on its three EXTERNAL segments — its other three abut a
     taller mass, where a parapet would guard nothing. */
  for (let i = 0; i < ring.length - 1; i++) {
    if (m.parapetSegments && !m.parapetSegments.includes(i)) continue;
    const [ax, az] = ring[i];
    const [bx, bz] = ring[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < section.draw.seatEmbed) continue;
    const tx = (bx - ax) / len;
    const tz = (bz - az) / len;
    let nx = tz;
    let nz = -tx;
    if (inRing((ax + bx) / 2 + nx * 0.5, (az + bz) / 2 + nz * 0.5, ring)) { nx = -nx; nz = -nz; }
    const rot = Math.atan2(nx, nz);
    const cx = (ax + bx) / 2 - nx * (R.parapet.thickness / 2);
    const cz = (az + bz) / 2 - nz * (R.parapet.thickness / 2);
    bins.parapets.push({
      x: cx, y: m.roofY + R.parapet.height / 2, z: cz, rot,
      scale: [len, R.parapet.height, R.parapet.thickness],
    });
    bins.copings.push({
      x: cx, y: m.roofY + R.parapet.height + R.parapet.copingHeight / 2, z: cz, rot,
      scale: [len, R.parapet.copingHeight, R.parapet.thickness + R.parapet.copingOversail * 2],
    });
  }

  /* Plant lives on the Tower lid only — phf15 shows nothing above the Mid's
     parapet but the terrace. Vents run on both lids, and are kept off the
     plant AND off the walk pad. */
  const pads = [];
  if (m.hasPlant) {
    buildRoofPlant(section, m, bins, plant);
    buildWalkPad(section, m, ring, bins, plant, pads);
  }

  /* The grid is centred on the lid, not started from a bbox corner: the Mid
     strip is only 6.46 m deep between the drawn edges, and a corner-started
     grid put its only row 1.15 m off the parapet and clipped every vent away. */
  const V = R.vents;
  const xs = ring.map((p) => p[0]);
  const zs = ring.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const nx = Math.ceil((Math.max(...xs) - Math.min(...xs)) / (2 * V.pitch));
  const nz = Math.ceil((Math.max(...zs) - Math.min(...zs)) / (2 * V.pitch));
  for (let i = -nx; i <= nx; i++) {
    for (let j = -nz; j <= nz; j++) {
      const x = cx + i * V.pitch;
      const z = cz + j * V.pitch;
      if (!clipped(x, z, ring, V.edgeClear)) continue;
      /* The Mid's western two-fifths is the rooftop terrace: no vent there. */
      if (!m.hasPlant && x <= section.terrace.xEast) continue;
      const box = rect(x, z, 0, 2 * V.radius, 2 * V.radius);
      if (plant.hits(box, V.edgeClear)) continue;
      if (pads.some((p) => overlap(p.box, box) > 0)) continue;
      bins.vents.push({ x, y: m.roofY + V.height / 2, z, rot: 0 });
    }
  }
}

/** The Tower lid's plant: two screen wells, the condenser row, the bulkhead. */
function buildRoofPlant(section, m, bins, plant) {
  const R = section.roof;

  /* Two open-topped mechanical screen wells, in the facade's own panel. */
  for (const w of plant.wells) {
    const t = R.screenWells.wallThickness;
    const H = R.screenWells.height;
    const y = m.roofY + H / 2;
    const wx = w.x1 - w.x0;
    const wz = w.z1 - w.z0;
    bins.screenWalls.push(
      { x: (w.x0 + w.x1) / 2, y, z: w.z0 + t / 2, rot: 0, scale: [wx, H, t] },
      { x: (w.x0 + w.x1) / 2, y, z: w.z1 - t / 2, rot: 0, scale: [wx, H, t] },
      { x: w.x0 + t / 2, y, z: (w.z0 + w.z1) / 2, rot: 0, scale: [t, H, wz - 2 * t] },
      { x: w.x1 - t / 2, y, z: (w.z0 + w.z1) / 2, rot: 0, scale: [t, H, wz - 2 * t] },
    );
  }

  /* The condenser row: centred on the gap between the wells and set one
     listed side-clearance south of them. Both stations fall out of the wells,
     which fall out of the ring. */
  const C = R.condensers;
  for (let i = 0; i < C.count; i++) {
    bins.condensers.push({
      x: plant.condenserX0 + i * C.pitch, y: m.roofY + C.size[1] / 2, z: plant.condenserZ,
      rot: 0, scale: C.size,
    });
  }

  /* The stair/lift bulkhead, one drawn storey tall. */
  const B = R.bulkhead;
  bins.bulkheads.push({
    x: B.x, y: m.roofY + B.height / 2, z: B.z, rot: 0,
    scale: [B.size[0], B.height, B.size[1]],
  });
}

/**
 * The walk pad, laid as SQUARE SEGMENTS: one run inside the north parapet on
 * each of the two north faces, then a cross run down the gap between the
 * wells to the condensers. Every segment is clipped to the drawn ring, then
 * dropped if it would stand on the plant or on ground an earlier segment
 * already covers — which is how the two face runs meet at the dog-leg corner
 * without a coplanar overlap, and how neither runs through the bulkhead.
 */
function buildWalkPad(section, m, ring, bins, plant, pads) {
  const R = section.roof;
  const W = R.walkPad;
  /* The pad's own clearance is the parapet plus half its width — which is
     EXACTLY where its centre line runs, so the ring test is compared with the
     draw tolerance rather than exactly, or float noise alone would drop two
     thirds of a run that genuinely abuts the parapet's inner face. */
  const clear = R.parapet.thickness + W.width / 2 - section.draw.skirtOffset;
  const y = m.roofY + section.draw.membraneLift + W.thickness / 2;

  const push = (x, z, rot) => {
    if (!clipped(x, z, ring, clear)) return null;
    const box = rect(x, z, rot, W.segment, W.width);
    if (plant.hits(box, R.vents.edgeClear)) return null;
    for (const p of pads) if (overlap(p.box, box) > 0) return null;
    pads.push({ x, z, rot, box });
    bins.walkPad.push({ x, y, z, rot, scale: [W.segment, W.thickness, W.width] });
    return { x, z };
  };

  let padEdge = null;
  for (const id of W.faces) {
    const f = section.facades.find((x) => x.id === id);
    if (!f) continue;
    const fr = frameOf(f);
    const n = Math.floor(fr.length / W.segment);
    for (let i = 0; i < n; i++) {
      const p = fr.at((i + 0.5) * W.segment, -(R.parapet.thickness + W.inset), 0);
      const placed = push(p.x, p.z, fr.rot);
      if (placed && (!padEdge || placed.z > padEdge.z)) padEdge = placed;
    }
  }

  /* The cross run: from the north pad's inner edge south down the middle of
     the gap between the wells to the condenser row's north face. */
  if (padEdge && plant.wells.length === 2) {
    const x = (plant.wells[0].x1 + plant.wells[1].x0) / 2;
    const z0 = padEdge.z + W.width / 2;
    const z1 = plant.condenserZ - R.condensers.size[2] / 2;
    const n = Math.floor((z1 - z0) / W.segment);
    for (let i = 0; i < n; i++) push(x, z0 + (i + 0.5) * W.segment, Math.PI / 2);
  }
}

/* --------------------------------------------------------- the terrace */

function buildTerrace(section, mid, m, bins) {
  const T = section.terrace;
  const P = T.paver;
  const D = section.draw;
  const rot = (T.paverRotationDeg * Math.PI) / 180;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const ring = mid.ring;
  const xs = ring.map((p) => p[0]);
  const zs = ring.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const half = P / 2;
  /* A grid in the rotated frame, laid over the whole lid and then CLIPPED —
     the sourced 6.1 m clear depth does not fit the drawn 5.85 m, so the deck
     is cut to the ring rather than built at its sourced size. */
  const reach = Math.ceil(Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) / P) + 2;
  for (let i = -reach; i <= reach; i++) {
    for (let j = -reach; j <= reach; j++) {
      const lx = (i + 0.5) * P;
      const lz = (j + 0.5) * P;
      const x = cx + lx * cos - lz * sin;
      const z = cz + lx * sin + lz * cos;
      if (x > T.xEast) continue;
      let ok = clipped(x, z, ring, T.edgeClear);
      if (ok) {
        for (const [dx, dz] of [[half, half], [half, -half], [-half, half], [-half, -half]]) {
          const px = x + dx * cos - dz * sin;
          const pz = z + dx * sin + dz * cos;
          if (!clipped(px, pz, ring, T.edgeClear)) { ok = false; break; }
        }
      }
      if (!ok) continue;
      bins.pavers.push({
        x, y: m.roofY + T.paverThickness / 2 + D.membraneLift, z, rot,
        scale: [P, T.paverThickness, P],
      });
    }
  }

  /* One small multi-stem tree per planter. Its three stems' crowns span
     exactly the declared spread: each crown is a third of the spread across
     and each stem stands a sixth of it off centre, so offset + radius = the
     spread's own half on either side. Nothing here is a chosen ratio. */
  const S = T.planterSize;
  const deck = m.roofY + T.paverThickness + D.membraneLift;
  const stems = T.treeCrownStems;
  const crownR = T.treeSpread / stems;
  const trunkH = T.treeHeight * T.treeTrunkFrac;
  const crownH = T.treeHeight - trunkH;
  T.planters.forEach((p, idx) => {
    bins.planters.push({ x: p.x, y: deck + S[1] / 2, z: p.z, rot: 0, scale: S });
    const top = deck + S[1];
    bins.treeTrunks.push({
      x: p.x, y: top + trunkH / 2, z: p.z, rot: 0, scale: [1, trunkH, 1],
    });
    for (let k = 0; k < stems; k++) {
      const a = hash(section.seed, idx, k, 11) * Math.PI * 2;
      const r = (T.treeSpread / (2 * stems)) * hash(section.seed, idx, k, 23);
      bins.treeCrowns.push({
        x: p.x + Math.cos(a) * r,
        y: top + trunkH + crownH / 2,
        z: p.z + Math.sin(a) * r,
        rot: a,
        scale: [crownR, crownH / 2, crownR],
      });
    }
  });
}

/* ---------------------------------------------------------- the ground */

/**
 * Where the exterior flight goes, and how much of it there is. Neither is in
 * any source: SWA-16 counts about six risers climbing from the court to the
 * colonnade and no frame or plan stations the flight. So it is placed at the
 * station where the DRAWN SURFACE falls furthest below the L1 floor, and it
 * builds only the risers that surface will carry — every riser's top at or
 * above the ground under it, the top of the flight exactly at the floor. The
 * rest of the sourced 0.91 m level change is declared in `absent`: the drawn
 * terrain is the 2014 parking lot, not the regraded court.
 */
function solveFlight(section, frame, ffl, ground) {
  const GS = section.groundStorey;
  const ST = GS.stair;
  const deck = GS.northTerrace.deckDepth;
  const bay = frame.length / section.facades.find((f) => f.id === ST.face).bays;
  const breezeU = (Math.floor(GS.breezeway.uFrac * (frame.length / bay)) + 0.5) * bay;
  const tol = section.draw.skirtOffset;
  let best = { u: null, risers: 0 };
  const step = ST.going;
  for (let u = ST.width / 2; u <= frame.length - ST.width / 2 + 1e-9; u += step) {
    if (Math.abs(u - breezeU) < (ST.width + GS.breezeway.width) / 2) continue;
    let n = 0;
    for (let i = 1; i <= ST.risersSourced; i++) {
      const top = ffl - i * ST.rise;
      let clearAll = true;
      for (const side of [-0.5, 0, 0.5]) {
        const p = frame.at(u + side * ST.width, deck + (i - 0.5) * ST.going, 0);
        const g = ground(p.x, p.z);
        if (Number.isFinite(g) && top < g - tol) { clearAll = false; break; }
      }
      if (!clearAll) break;
      n = i;
    }
    if (n > best.risers) best = { u, risers: n };
  }
  return best;
}

function buildGround(section, group, masses, bins) {
  const GS = section.groundStorey;
  const D = section.draw;
  const tower = masses.tower;
  const mid = masses.mid;
  const ground = tower.ground;
  const ffl = tower.baseY;

  const cf = section.facades.find((f) => f.id === GS.colonnade.face);
  const frame = frameOf(cf);
  const clear = GS.clearHeight;
  const C = GS.colonnade;
  const F = section.system.frame;
  const bays = bayCentres(frame.length, cf.bays);
  const breezeBay = Math.floor(GS.breezeway.uFrac * cf.bays);
  /* The soffit's exposed edge is the storey MINUS the measured clear, solved
     on this mass's own drawn storey so the band closes onto the field wall.
     A declared-but-unused 0.15 m slab zone used to leave a 0.15 m strip of
     raw massing prism showing here. */
  const fascia = tower.storeyH - clear;

  bins.recess.push({
    ...frame.at(frame.length / 2, D.skirtOffset, ffl + clear / 2),
    rot: frame.rot, scale: [frame.length, clear, 1],
  });
  for (const bay of bays) {
    if (bay.i === breezeBay) continue;
    bins.storefront.push({
      ...frame.at(bay.u, D.bandOffset, ffl + clear / 2),
      rot: frame.rot,
      scale: [bay.module - C.pierSize - 2 * F.face, clear - 2 * F.face, 1],
    });
  }
  bins.soffits.push({
    ...frame.at(frame.length / 2, (C.oversail + D.wallOffset) / 2, ffl + clear + fascia / 2),
    rot: frame.rot,
    scale: [frame.length, fascia, C.oversail + D.wallOffset],
  });

  /* THE NORTH ENTRY TERRACE. The raised walking level under the oversail —
     top at the L1 floor, carried down past the drawn surface as a solid so it
     neither hovers nor floats. It is what SWA-16's "raised terrace edges
     north of the building" are the edges OF, and it is what the piers, the
     guard and the flight all stand on. */
  const NT = GS.northTerrace;
  const nSeg = Math.max(2, Math.ceil(frame.length / DRAPE_SEG));
  const segLen = frame.length / nSeg;
  for (let i = 0; i < nSeg; i++) {
    const c = frame.at((i + 0.5) * segLen, NT.deckDepth / 2, 0);
    let g = Infinity;
    for (const s of [0, 0.5, 1]) {
      for (const w of [D.skirtOffset, NT.deckDepth]) {
        const p = frame.at((i + s) * segLen, w, 0);
        const h = ground(p.x, p.z);
        if (Number.isFinite(h) && h < g) g = h;
      }
    }
    const bottom = Math.min(Number.isFinite(g) ? g : ffl, ffl) - D.buryDepth;
    bins.terraceDeck.push({
      x: c.x, y: (ffl + bottom) / 2, z: c.z, rot: frame.rot,
      scale: [segLen, ffl - bottom, NT.deckDepth],
    });
  }

  /* The piers stand ON the terrace, not on the terrain — the seating rule is
     "surfaceAt or the structure that carries it". */
  for (let i = 0; i <= cf.bays; i++) {
    const u = (i * frame.length) / cf.bays;
    if (i === breezeBay || i === breezeBay + 1) continue;
    const p = frame.at(u, C.pierProud, 0);
    bins.piers.push({
      x: p.x, y: ffl + (clear - D.seatEmbed) / 2, z: p.z, rot: frame.rot,
      scale: [C.pierSize, clear + D.seatEmbed, C.pierSize],
    });
  }

  /* The flight, solved against the drawn surface. */
  const ST = GS.stair;
  const flight = solveFlight(section, frame, ffl, ground);
  for (let i = 1; i <= flight.risers; i++) {
    const p = frame.at(flight.u, NT.deckDepth + (i - 0.5) * ST.going, 0);
    const top = ffl - i * ST.rise;
    const g = ground(p.x, p.z);
    const bottom = Math.min(Number.isFinite(g) ? g : top, top) - D.buryDepth;
    bins.stairs.push({
      x: p.x, y: (top + bottom) / 2, z: p.z, rot: frame.rot,
      scale: [ST.width, top - bottom, ST.going],
    });
  }
  if (flight.risers > 0) {
    const run = flight.risers * ST.going;
    const drop = flight.risers * ST.rise;
    const slope = -Math.atan2(ST.rise, ST.going);
    /* One rail per side, spread across the flight's derived width — the count
       is the code's (both sides of a stairway) and lives in the data. */
    const sides = Array.from({ length: ST.handrails },
      (_, i) => -1 + (2 * i) / (ST.handrails - 1));
    for (const side of sides) {
      const p = frame.at(flight.u + (side * ST.width) / 2, NT.deckDepth + run / 2,
        ffl - drop / 2 + ST.handrailHeight);
      bins.handrails.push({
        ...p, rot: frame.rot, rotX: slope,
        scale: [ST.handrailOD, ST.handrailOD, Math.hypot(run, drop)],
      });
    }
  }

  /* The guard along the terrace's outer edge — the picket rail SWA-16
     photographs, standing on the deck, broken over the flight's own width
     where the two pipe handrails take over. */
  const pitch = NT.picketPitch;
  const nPickets = Math.max(2, Math.round(frame.length / pitch));
  const skip = (u) => flight.u !== null && Math.abs(u - flight.u) < ST.width / 2;
  for (let i = 0; i <= nPickets; i++) {
    const u = (i * frame.length) / nPickets;
    if (skip(u)) continue;
    const p = frame.at(u, NT.deckDepth - NT.picket / 2, 0);
    bins.pickets.push({
      x: p.x, y: ffl + NT.guardHeight / 2, z: p.z, rot: frame.rot,
      scale: [NT.picket, NT.guardHeight, NT.picket],
    });
  }
  const nRails = Math.max(1, Math.round(frame.length / DRAPE_SEG));
  for (let i = 0; i < nRails; i++) {
    const u0 = (i * frame.length) / nRails;
    const u1 = ((i + 1) * frame.length) / nRails;
    if (skip(u0) || skip(u1)) continue;
    const p = frame.at((u0 + u1) / 2, NT.deckDepth - NT.picket / 2, ffl + NT.guardHeight);
    bins.railSegments.push({
      ...p, rot: frame.rot, scale: [u1 - u0, NT.railOD, NT.railOD],
    });
  }

  /* THE ONE DOOR THIS BUILDING GETS. A broad photographed flight that climbs
     to a blank wall is not a reading any source supports, so a pair of leaves
     is cut out of the sourced storefront's own module and mullion, in the bay
     the flight lands in. Every other opening is in `absent`. */
  const E = GS.entrance;
  const entryBay = flight.u === null
    ? bays[0]
    : bays.reduce((a, b) => (Math.abs(b.u - flight.u) < Math.abs(a.u - flight.u) ? b : a));
  for (let i = 0; i < E.leaves; i++) {
    const u = entryBay.u + (i - (E.leaves - 1) / 2) * E.leafWidth;
    const p = frame.at(u, D.wallOffset, ffl + E.height / 2);
    bins.entranceGlass.push({ ...p, rot: frame.rot, scale: [E.leafWidth, E.height, 1] });
    bins.entranceLeaves.push({ ...p, rot: frame.rot });
  }

  /* The through-breezeway: an open route from the Wellness Corridor and the
     court to the Bamboo Garden, cut through the ground floor of the west bar.
     Drawn as the void it is — the measured massing is never carved — on the
     north face and on the matching station of the Mid's south face. */
  const bw = GS.breezeway;
  const bu = (breezeBay + 0.5) * (frame.length / cf.bays);
  bins.breezeway.push({
    ...frame.at(bu, D.glassOffset, ffl + clear / 2),
    rot: frame.rot, scale: [bw.width, clear, 1],
  });
  const sf = section.facades.find((f) => f.id === "M-south");
  const sfr = frameOf(sf);
  const bp = frame.at(bu, 0, 0);
  const su = (bp.x - sf.a[0]) * sfr.tx + (bp.z - sf.a[1]) * sfr.tz;
  if (su > bw.width / 2 && su < sfr.length - bw.width / 2) {
    bins.breezeway.push({
      ...sfr.at(su, D.glassOffset, mid.baseY + clear / 2),
      rot: sfr.rot, scale: [bw.width, clear, 1],
    });
  }

  /* The Front Porch: a wood deck along the south of the west bar and wrapping
     the east wing, DRAPED on the drawn terrain. No frame or plan gives it a
     step, an edge or a fascia, so it ships on grade and the "raised" claim is
     in `absent`; the picket guard belongs to the north terrace, not here. */
  const P = GS.porch;
  const lift = overlayLift(CARPET);
  for (const id of P.faces) {
    const f = section.facades.find((x) => x.id === id);
    const fr = frameOf(f);
    const deckMesh = drapedStrip(fr, 0, fr.length, D.skirtOffset, P.depth, ground, lift);
    const tile = D.tiles.slat;
    deckMesh.material = decalMat(section.colors.porchDeck, "woodSlat",
      [Math.max(1, fr.length / tile), Math.max(1, P.depth / tile)]);
    deckMesh.receiveShadow = true;
    group.add(deckMesh);
  }
  return flight;
}

/* ------------------------------------------------------------------ api */

/**
 * Build Pulse Hall's photo-sourced detail.
 *
 * `photo` is the loaded photo-detail document; this reads only its `pulse`
 * section and writes nothing back. `surfaceAt` — the drawn terrain triangle —
 * seats everything on the ground; `heightAt` solves each drawn parapet exactly
 * as campus-massing.js roofElevation does, over the arcgis ring and h carried
 * verbatim in `measured.masses.*`. There is no LiDAR height for this building
 * and none is invented.
 */
export function createPhotoPulse(scene, { photo, heightAt, surfaceAt } = {}) {
  const group = new THREE.Group();
  group.name = "photo-pulse";
  const section = photo?.pulse;
  if (!section) {
    scene?.add(group);
    return { group, counts: {} };
  }
  const ground = surfaceAt || heightAt;
  const baseFn = heightAt || surfaceAt;
  if (typeof ground !== "function" || typeof baseFn !== "function") {
    throw new Error("campus-photo-pulse: needs surfaceAt (or heightAt) to place on the ground");
  }

  const { colors, draw: D } = section;
  const T = section.measured.masses.tower;
  const M = section.measured.masses.mid;

  const towerRoofY = roofOf(T.ring, T.h, baseFn);
  const midRoofY = roofOf(M.ring, M.h, baseFn);

  const masses = {
    tower: {
      ring: T.ring, roofY: towerRoofY, baseY: towerRoofY - T.h,
      storeyH: T.h / T.levels, levels: T.levels,
      residentialRows: section.grid.residentialRowsTower,
      lanternRows: section.lantern.rowsTower,
      hasPlant: true, ground,
    },
    mid: {
      ring: M.ring, roofY: midRoofY, baseY: midRoofY - M.h,
      storeyH: M.h / M.levels, levels: M.levels,
      residentialRows: section.grid.residentialRowsMid,
      lanternRows: section.lantern.rowsMid,
      hasPlant: false, ground,
      /* Only M0, M1 and M5 are external; the other three abut a taller mass. */
      parapetSegments: [0, 1, 5],
    },
  };

  const bins = {
    walls: [], chimneys: [], windowGlass: [], frameGold: [], frameCharcoal: [],
    frameCommon: [], transoms: [], lanternGlass: [], lanternFrames: [], stepWalls: [],
    parapets: [], copings: [], walkPad: [], screenWalls: [], condensers: [],
    bulkheads: [], vents: [], pavers: [], planters: [], treeTrunks: [],
    treeCrowns: [], recess: [], storefront: [], piers: [], soffits: [],
    breezeway: [], stairs: [], handrails: [], pickets: [], railSegments: [],
    terraceDeck: [], entranceGlass: [], entranceLeaves: [],
  };

  /* ---------------------------------------------------------- facades */
  section.facades.forEach((f, i) => {
    const m = masses[f.mass];
    const frame = frameOf(f);
    switch (f.system) {
      case "field": collectFieldFace(section, i, f, frame, m, bins); break;
      case "commonRoom": collectCommonRoomFace(section, i, f, frame, m, bins); break;
      case "lantern": collectLanternFace(section, f, frame, m, bins); break;
      case "endWall": collectEndWall(section, f, frame, m, bins); break;
      case "stepFace": collectStepFace(section, f, frame, m, bins, midRoofY); break;
      default: throw new Error(`campus-photo-pulse: unknown facade system ${f.system}`);
    }
  });

  /* The step wall on the two long shared edges: one storey of blank pale
     rainscreen from the Mid deck to the Tower deck, solved from the two DRAWN
     prisms and never assumed to be 3.1 m on a grade. It is also the rooftop
     terrace's north enclosure. */
  const stepH = towerRoofY - midRoofY;
  for (const e of section.measured.sharedEdges) {
    if (e.pair[0] === "T1") continue;
    const [ax, az] = e.a;
    const [bx, bz] = e.b;
    const len = Math.hypot(bx - ax, bz - az);
    const tx = (bx - ax) / len;
    const tz = (bz - az) / len;
    let nx = tz;
    let nz = -tx;
    if (inRing((ax + bx) / 2 + nx * 0.5, (az + bz) / 2 + nz * 0.5, T.ring)) { nx = -nx; nz = -nz; }
    bins.stepWalls.push({
      x: (ax + bx) / 2 + nx * (section.system.stepWall.thickness / 2),
      y: midRoofY + stepH / 2,
      z: (az + bz) / 2 + nz * (section.system.stepWall.thickness / 2),
      rot: Math.atan2(nx, nz),
      scale: [len, stepH, section.system.stepWall.thickness],
    });
  }

  /* ------------------------------------------------------------- roof */
  const wells = screenWellBoxes(section);
  const CD = section.roof.condensers;
  const plant = {
    wells,
    condenserX0: (wells[0].x1 + wells[1].x0) / 2 - ((CD.count - 1) / 2) * CD.pitch,
    condenserZ: Math.max(...wells.map((w) => w.z1)) + CD.clearance + CD.size[2] / 2,
    /* Every roof object the pad and the vent grid must keep off, as plan
       rectangles with the clearance the caller needs. */
    hits(box, margin) {
      const B = section.roof.bulkhead;
      const boxes = [
        ...this.wells.map((w) => rect((w.x0 + w.x1) / 2, (w.z0 + w.z1) / 2, 0,
          w.x1 - w.x0 + 2 * margin, w.z1 - w.z0 + 2 * margin)),
        rect(B.x, B.z, 0, B.size[0] + 2 * margin, B.size[1] + 2 * margin),
      ];
      for (let i = 0; i < CD.count; i++) {
        boxes.push(rect(this.condenserX0 + i * CD.pitch, this.condenserZ, 0,
          CD.size[0] + 2 * margin, CD.size[2] + 2 * margin));
      }
      return boxes.some((b) => overlap(b, box) > 0);
    },
  };
  buildRoof(section, T, masses.tower, bins, plant);
  buildRoof(section, M, masses.mid, bins, plant);
  buildTerrace(section, M, masses.mid, bins);

  /* ------------------------------------------------------- assembly */
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const plane = new THREE.PlaneGeometry(1, 1);
  const W = section.system.window;
  const FR = section.system.frame;
  const LN = section.lantern;
  const PANEL_W = section.system.panel.width;
  const PANEL_H = section.measured.heightStack.floorToFloorSourced;
  /* The brick class tiles 8 courses x 4 units; at the nominal unit the
     section already declares, that is one square of real wall per repeat. */
  const CMU_TILE = D.tiles.cmuCourses * section.derivations.readings.product.cmuNominalIn
    * section.derivations.units.inch;

  const facades = new THREE.Group();
  facades.name = "pulse-facades";
  const add = (parent, geo, mat, items, name) => {
    if (!items.length) return;
    const mesh = instanced(geo, mat, items);
    if (name) mesh.name = name;
    parent.add(mesh);
  };
  /* Wall fields are individual meshes so each carries the rainscreen joint at
     true panel scale — the per-surface repeat lever. */
  for (const w of bins.walls) {
    const mat = w.tone === "lanternCladding"
      ? rainscreen(colors.lanternCladding, w.w, w.h, PANEL_W, PANEL_H)
      : w.tone === "baseBand"
        ? rainscreen(colors.baseBand, w.w, w.h, PANEL_W, PANEL_H)
        : rainscreen(colors.fieldPanel, w.w, w.h, PANEL_W, PANEL_H);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w.w, w.h), mat);
    mesh.position.set(w.x, w.y, w.z);
    mesh.rotation.y = w.rot;
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.name = "pulse-wall";
    facades.add(mesh);
  }
  add(facades, unit, panelMetal(colors.accentPanel), bins.chimneys, "pulse-chimney");
  add(facades, plane, glassMat(colors.windowGlass), bins.windowGlass, "pulse-window");
  add(facades, pictureFrame(W.width, W.height, FR.face, FR.proud, D.bandOffset),
    trim(colors.frameGold), bins.frameGold, "pulse-frame-gold");
  add(facades, pictureFrame(W.width, W.height, FR.face, FR.proud, D.bandOffset),
    trim(colors.frameCharcoal), bins.frameCharcoal, "pulse-frame-charcoal");
  const CR = section.system.commonRoom;
  add(facades, pictureFrame(CR.glazingWidth, CR.height, FR.face, FR.proud, D.bandOffset),
    trim(colors.frameGold), bins.frameCommon, "pulse-frame-common");
  add(facades, unit, trim(colors.frameCharcoal), bins.transoms, "pulse-transom");
  add(facades, plane, glassMat(colors.windowGlass), bins.lanternGlass, "pulse-lantern-glass");
  add(facades, pictureFrame(LN.opening[0], LN.opening[1], LN.frameFace, LN.frameProud, D.bandOffset),
    trim(colors.lanternFrame), bins.lanternFrames, "pulse-lantern-frame");
  add(facades, unit,
    rainscreen(colors.fieldPanel, section.measured.sharedEdges[0].length, stepH, PANEL_W, PANEL_H),
    bins.stepWalls, "pulse-step-wall");
  group.add(facades);

  const roof = new THREE.Group();
  roof.name = "pulse-roof";
  for (const [mass, m] of [[T, masses.tower], [M, masses.mid]]) {
    const xs = mass.ring.map((p) => p[0]);
    const zs = mass.ring.map((p) => p[1]);
    const lid = new THREE.Mesh(lidGeometry(mass.ring),
      membraneMat(colors.roofMembrane, Math.max(...xs) - Math.min(...xs),
        Math.max(...zs) - Math.min(...zs), D.tiles.membrane));
    lid.position.y = m.roofY + D.membraneLift;
    lid.receiveShadow = true;
    lid.name = "pulse-membrane";
    roof.add(lid);
  }
  add(roof, unit, concrete(colors.fieldPanel), bins.parapets, "pulse-parapet");
  add(roof, unit, trim(colors.parapetCoping), bins.copings, "pulse-coping");
  add(roof, unit, concrete(colors.walkPad), bins.walkPad, "pulse-walk-pad");
  const SW = section.roof.screenWells;
  add(roof, unit,
    rainscreen(colors.screenWell, SW.size[0], SW.height, PANEL_W, PANEL_H),
    bins.screenWalls, "pulse-screen-well");
  add(roof, unit, panelMetal(colors.condenser), bins.condensers, "pulse-condenser");
  add(roof, unit,
    rainscreen(colors.bulkhead, section.roof.bulkhead.size[0], section.roof.bulkhead.height,
      PANEL_W, PANEL_H),
    bins.bulkheads, "pulse-bulkhead");
  add(roof, new THREE.CylinderGeometry(section.roof.vents.radius, section.roof.vents.radius,
    section.roof.vents.height, 8), panelMetal(colors.condenser), bins.vents, "pulse-vent");
  group.add(roof);

  const terrace = new THREE.Group();
  terrace.name = "pulse-terrace";
  add(terrace, unit, paver(colors.terracePaver), bins.pavers, "pulse-paver");
  add(terrace, unit, concrete(colors.planter), bins.planters, "pulse-planter");
  add(terrace, new THREE.CylinderGeometry(section.terrace.treeTrunkTopRadius,
    section.terrace.treeTrunkBaseRadius, 1, 6),
    concrete(colors.terraceTreeTrunk), bins.treeTrunks, "pulse-tree-trunk");
  add(terrace, new THREE.SphereGeometry(1, 8, 6),
    foliage(colors.terraceTreeFoliage), bins.treeCrowns, "pulse-tree-crown");
  group.add(terrace);

  const gr = new THREE.Group();
  gr.name = "pulse-ground";
  const flight = buildGround(section, gr, masses, bins);
  add(gr, unit, concrete(colors.stairConcrete), bins.terraceDeck, "pulse-entry-terrace");
  add(gr, plane, voidPlane(colors.breezewayShade), bins.recess, "pulse-recess");
  add(gr, plane, glassMat(colors.storefrontGlass), bins.storefront, "pulse-storefront");
  add(gr, unit,
    masonry(colors.colonnadePier, section.groundStorey.colonnade.pierSize,
      masses.tower.storeyH, CMU_TILE),
    bins.piers, "pulse-pier");
  add(gr, unit, concrete(colors.fieldPanel), bins.soffits, "pulse-soffit");
  add(gr, plane, glassMat(colors.storefrontGlass), bins.entranceGlass, "pulse-entrance-glass");
  add(gr, pictureFrame(section.groundStorey.entrance.leafWidth,
    section.groundStorey.entrance.height, FR.face, FR.proud, D.bandOffset),
    trim(colors.frameCharcoal), bins.entranceLeaves, "pulse-entrance-leaf");
  add(gr, plane, voidPlane(colors.breezewayShade), bins.breezeway, "pulse-breezeway");
  add(gr, unit, concrete(colors.stairConcrete), bins.stairs, "pulse-stair-solid");
  add(gr, unit, trim(colors.handrailPipe), bins.handrails, "pulse-handrail");
  add(gr, unit, panelMetal(colors.guardrailPicket), bins.pickets, "pulse-guard-post");
  add(gr, unit, panelMetal(colors.guardrailPicket), bins.railSegments, "pulse-guard-rail");
  group.add(gr);

  scene?.add(group);
  return {
    group,
    counts: {
      facades: section.facades.length,
      sharedEdges: section.measured.sharedEdges.length,
      wallFields: bins.walls.length,
      chimneyPanels: bins.chimneys.length,
      windows: bins.windowGlass.length,
      goldFrames: bins.frameGold.length,
      charcoalFrames: bins.frameCharcoal.length,
      commonRoomGlazing: bins.frameCommon.length,
      lanternOpenings: bins.lanternGlass.length,
      stepWalls: bins.stepWalls.length,
      parapetRuns: bins.parapets.length,
      copingRuns: bins.copings.length,
      walkPadSegments: bins.walkPad.length,
      screenWellWalls: bins.screenWalls.length,
      screenWells: wells.length,
      condensers: bins.condensers.length,
      bulkheads: bins.bulkheads.length,
      vents: bins.vents.length,
      pv: 0,
      terracePavers: bins.pavers.length,
      terracePlanters: bins.planters.length,
      terraceTrees: bins.treeTrunks.length,
      entryTerraceSegments: bins.terraceDeck.length,
      colonnadePiers: bins.piers.length,
      storefrontBays: bins.storefront.length,
      entranceLeaves: bins.entranceLeaves.length,
      breezewayVoids: bins.breezeway.length,
      stairRisersSourced: section.groundStorey.stair.risersSourced,
      stairRisersBuilt: bins.stairs.length,
      stairStation: flight.u,
      handrails: bins.handrails.length,
      guardPickets: bins.pickets.length,
      draws: group.children.reduce((n, c) => n + c.children.length, 0),
    },
  };
}
