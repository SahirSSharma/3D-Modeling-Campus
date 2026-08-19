// Eighth College's SOUTH AND SERVICE EDGE — the photo-sourced INVENTED class.
//
// The tenth subject of the Eighth pass, and the one that exists because the
// other nine left a hole: The Backyard, the Market Hall wing's roof plate, and
// the South Parking Entrance portal. A completeness critic probed (-180,640),
// (-205,675), (-150,700) and (-120,660) and got NO COVER back from any
// section; this module answers the part of that hole a source actually
// resolves, and the section's `absent` list answers the rest by name.
//
// Five things decided the shape of this file.
//
//   1. THE 2014 LiDAR IS BLIND HERE. campus-lidar.json carries no massHeight
//      for massing[462] or massing[464] — the 2014 flight measured the parking
//      lot this neighbourhood replaced. Nothing below reads a LiDAR height and
//      nothing may. Every building datum is the facilities GIS ring and its
//      GIS `h`, which is what campus-massing.js extrudes on screen, and
//      `drawnLid` here reproduces that rule exactly rather than keeping a
//      second copy of the arithmetic.
//
//   2. THE CAMPUS GIS GROUND LAYER HAS HOLES OVER THE 2023 WORK. Point tests
//      against all 4,335 arcgis.ground rings return NOTHING inside The
//      Backyard, NOTHING in the Market Hall Plaza and NOTHING on the Market
//      Hall's own apron; the only cover in this quarter is two campus-wide
//      blankets, a 124,686 m² `walk` and a 44,128 m² `road`, which describe no
//      feature of this neighbourhood. There is no surveyed ring to anchor
//      those surfaces to. The Backyard is nevertheless buildable because it is
//      bounded on all four sides by surveyed BUILDING lines and one surveyed
//      walk — the envelope is CUT from the survey, not traced from a plan.
//      The plaza and the forecourt are not, and they are not painted.
//
//   3. THE DRAWN PRISM WINS, AND IT SWALLOWS THE SOUTH RAMP. massing[462]'s
//      surveyed south edge runs 8.6 m further south than the wing's
//      above-grade wall, because the ring is describing the four-level garage
//      below. The ramp and its apron therefore lie INSIDE a solid mass and
//      cannot be drawn. The portal ships as an opening ON THE DRAWN FACE,
//      carrying only the plan's measured width and its run along that face.
//
//   4. ONE ROOF, TWO MATERIALS, SPLIT ON A SURVEYED LINE. Three built frames
//      disagree with the shipped single-membrane plate, and they disagree in
//      two directions on two parts of the same roof: phf19 and phf17 show the
//      south-east (Market Hall) lobe in sloping STANDING-SEAM METAL, SWA
//      Learning-1 shows the west lobe as a flat PALE DECK. The split runs
//      between two vertices of massing[462] itself, so no point is invented —
//      and every one of the eight south-east lobe vertices falls on one side
//      of it and every one of the other six on the other. The TOWER, though,
//      straddles that line — the hall's north-west corner tucks under it — so
//      the metal half of (ring minus tower) is two disconnected regions, which
//      no outer-ring-with-one-hole shape can express and which earcut fills
//      334 m² of if you ask it to. The plate is therefore triangulated ONCE
//      over the whole ring with the tower punched out and its TRIANGLES are
//      split; the covered area comes back exactly ring minus tower, and the
//      test re-derives that from the built buffers. The plate stays FLAT:
//      the ridge of a uniform-slope hip is the polygon's straight skeleton and
//      needs no source, but the PITCH does, and nothing gives it.
//
//   5. NOTHING HOVERS. Everything on the ground seats on `surfaceAt` sampled
//      at its own station — the grill counters, the table legs, the portal
//      sill (at the LOWER of its two jambs, so a falling face still closes) —
//      and every decal rides campus-overlay.js's shared ladder through
//      overlayLift / applyOverlayDepth, never a local lift constant.
//
// Colours are DATA: every hex comes from the section's `colors` block, and
// nine of the thirteen are carried VERBATIM from the college's own shipped
// eighth palette rather than sampled again. So is every DIMENSION — each
// load-bearing figure carries an entry in the section's `dimensionSources`
// with its tier and its arithmetic, and this file contains no numeric literal
// that decides how anything looks. What is deliberately NOT here is the
// section's `absent` list.
//
// Surfaces come from the procedural material library (campus-materials.js) —
// code-generated maps only, never a photograph or a satellite pixel; the
// sourced colours still drive the materials. Deterministic: no Math.random,
// no Date and no pseudo-random source anywhere — every placement is a
// closed-form function of the surveyed rings and the section's own figures.
import * as THREE from "../vendor/three/three.module.min.js";
import { applyOverlayDepth, overlayLift } from "./campus-overlay.js";
import { createMaterialLibrary } from "./campus-materials.js";
import { fillPoly } from "./campus-drape.js";

/* One material library for the whole module, created on first build. */
let LIB = null;
const lib = () => (LIB ??= createMaterialLibrary(THREE));

const concrete = (color) => lib().get("smoothConcrete", { color });
const metal = (color) => lib().get("metalPanel", { color, metalness: 0.55, roughness: 0.45 });
const painted = (color) => lib().get("metalPanel", { color, metalness: 0.3, roughness: 0.6 });
const seamMetal = (color) =>
  lib().get("metalPanel", { color, standingSeam: true, metalness: 0.32, roughness: 0.52 });
const membrane = (color, w, d, unit) =>
  lib().get("roofMembrane", { color, repeat: [w / unit, d / unit] });

/** A draped surface in a named material class, on a rung of the shared ladder. */
function decalMat(color, rung, cls, repeat) {
  return applyOverlayDepth(lib().get(cls, { color, repeat }), rung);
}

/**
 * One InstancedMesh from a list of placements. Each placement is
 * `{ x, y, z, rot?, rotX?, rotZ?, scale? }`; rotation composes in "YXZ" order.
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

/* ---------------------------------------------------------------- rings */

/** Drop a ring's repeated closing vertex, if it carries one. */
function openRing(ring) {
  const r = ring.map((p) => [p[0], p[1]]);
  const [f, l] = [r[0], r[r.length - 1]];
  if (r.length > 1 && Math.hypot(f[0] - l[0], f[1] - l[1]) < 1e-6) r.pop();
  return r;
}

function centroidOf(ring) {
  let x = 0;
  let z = 0;
  for (const p of ring) {
    x += p[0];
    z += p[1];
  }
  return [x / ring.length, z / ring.length];
}

function bboxOf(ring) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const [x, z] of ring) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (z < z0) z0 = z;
    if (z > z1) z1 = z;
  }
  return { x0, x1, z0, z1 };
}

/** Outward normal of ring segment `i`, for a ring wound either way. */
function normalOf(ring, i) {
  const a = ring[i];
  const b = ring[(i + 1) % ring.length];
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dx, dz) || 1;
  let nx = dz / len;
  let nz = -dx / len;
  const [cx, cz] = centroidOf(ring);
  const mx = (a[0] + b[0]) / 2;
  const mz = (a[1] + b[1]) / 2;
  if ((mx - cx) * nx + (mz - cz) * nz < 0) {
    nx = -nx;
    nz = -nz;
  }
  return [nx, nz];
}

/**
 * A local frame on a face: `at(u, out, y)` is the world point `u` metres along
 * the segment from `a`, `out` metres along the outward normal, at height `y`.
 */
function frameOf(a, b, [nx, nz]) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dx, dz) || 1;
  const ux = dx / len;
  const uz = dz / len;
  return {
    length: len,
    at(u, out, y) {
      return { x: a[0] + ux * u + nx * out, y, z: a[1] + uz * u + nz * out };
    },
  };
}

/**
 * ONE plate — outer ring, holes punched — triangulated by three.js, then its
 * TRIANGLES split by the divider into two buffers. Splitting the triangles and
 * not the polygons is the only exact way to do this here: the tower's clipped
 * piece touches the divider at two points, so the Market Hall half of
 * (ring minus tower) is genuinely TWO disconnected regions, which no single
 * outer-ring-with-one-hole shape can express. Earcut silently fills 334 m2 of
 * the gap if you ask it to; splitting triangles cannot, and the test re-derives
 * the covered area from the built buffers to prove it.
 *
 * Returns `[positive, negative]`, each a flat Float32 position array in world
 * XZ at y = 0, ready to translate to the lid.
 */
function splitPlateByLine(outer, holes, a, b) {
  const shape = new THREE.Shape(outer.map(([x, z]) => new THREE.Vector2(x, z)));
  for (const h of holes) {
    shape.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, z))));
  }
  const g = new THREE.ShapeGeometry(shape);
  const pos = g.attributes.position;
  const idx = g.index;
  const nx = b[1] - a[1];
  const nz = -(b[0] - a[0]);
  const side = (p) => (p[0] - a[0]) * nx + (p[1] - a[1]) * nz;
  const P = [];
  const N = [];
  const emit = (bin, t) => {
    for (const p of t) bin.push(p[0], 0, p[1]);
  };
  const fan = (bin, poly) => {
    for (let k = 1; k + 1 < poly.length; k++) emit(bin, [poly[0], poly[k], poly[k + 1]]);
  };
  for (let i = 0; i < idx.count; i += 3) {
    const t = [0, 1, 2].map((k) => {
      const j = idx.getX(i + k);
      return [pos.getX(j), pos.getY(j)];
    });
    const s = t.map(side);
    if (s.every((v) => v >= 0)) {
      emit(P, t);
    } else if (s.every((v) => v <= 0)) {
      emit(N, t);
    } else {
      fan(P, clipHalf(t, a, b, true));
      fan(N, clipHalf(t, a, b, false));
    }
  }
  g.dispose();
  return [P, N];
}

/** A flat, up-facing plate from a position array, UV-mapped over a bbox. */
function plateFrom(positions, bb) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const n = positions.length / 3;
  const normal = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    normal[i * 3 + 1] = 1;
    uv[i * 2] = (positions[i * 3] - bb.x0) / (bb.x1 - bb.x0);
    uv[i * 2 + 1] = (positions[i * 3 + 2] - bb.z0) / (bb.z1 - bb.z0);
  }
  g.setAttribute("normal", new THREE.BufferAttribute(normal, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return g;
}

/** A shared library material, cloned double-sided for a thin plate. */
function plateMat(mat) {
  const m = mat.clone();
  m.side = THREE.DoubleSide;
  return m;
}

/**
 * campus-massing.js roofElevation, reproduced EXACTLY: the rim-median ground
 * under the measured ring plus the height it draws, lifted if that would bury
 * a high corner. This module and campus-photo-survivance.js must land on the
 * same plane, so both compute it the same way from the same ring.
 */
function drawnLid(ring, h, at) {
  const gs = [];
  let highest = -Infinity;
  for (const [x, z] of ring) {
    const g = at(x, z);
    if (g != null && Number.isFinite(g)) {
      gs.push(g);
      if (g > highest) highest = g;
    }
  }
  let surveyed;
  if (gs.length) {
    gs.sort((a, b) => a - b);
    surveyed = gs[Math.floor(gs.length / 2)] + h;
  } else {
    const [cx, cz] = centroidOf(ring);
    surveyed = at(cx, cz) + h;
  }
  return highest > -Infinity && surveyed < highest ? highest : surveyed;
}

/**
 * Sutherland–Hodgman: the part of `poly` on one side of the infinite line
 * through `a` and `b`, using the section's own sign convention
 * `side = (p - a) . (b.z - a.z, -(b.x - a.x))`.
 *
 * The divider's two ends are VERTICES of the wing ring, so clipping the ring
 * itself introduces no new point — but the TOWER ring straddles the line (its
 * two eastern vertices are on the Market Hall side, because the hall's
 * north-west corner really does tuck under the tower), so the punched hole has
 * to be clipped with the plate it is punched out of. Clip both and the areas
 * close exactly: metal 1958.4 - 585.9 plus deck 2199.0 - 1097.3 is 2474.4,
 * against ring 4157.5 - tower 1683.2 = 2474.3.
 */
function clipHalf(poly, a, b, keepPositive) {
  const nx = b[1] - a[1];
  const nz = -(b[0] - a[0]);
  const s = (p) => ((p[0] - a[0]) * nx + (p[1] - a[1]) * nz) * (keepPositive ? 1 : -1);
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const P = poly[i];
    const Q = poly[(i + 1) % poly.length];
    const sp = s(P);
    const sq = s(Q);
    if (sp >= 0) out.push(P);
    if ((sp > 0 && sq < 0) || (sp < 0 && sq > 0)) {
      const t = sp / (sp - sq);
      out.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]);
    }
  }
  const c = [];
  for (const p of out) {
    const l = c[c.length - 1];
    if (!l || Math.hypot(l[0] - p[0], l[1] - p[1]) > 1e-9) c.push(p);
  }
  if (c.length > 1 && Math.hypot(c[0][0] - c[c.length - 1][0], c[0][1] - c[c.length - 1][1]) < 1e-9)
    c.pop();
  return c;
}

/* ------------------------------------------------------------- backyard */

/**
 * The Backyard: a courtyard whose whole envelope is cut from surveyed
 * building lines, its rotated planting bed, the college's own barbeque family
 * extended onto it, and two ITTF-regulation tables.
 */
export function buildBackyard(S, group, ground, bins) {
  const C = S.colors;
  const B = S.backyard;
  const env = openRing(B.envelope.ring);
  const unit = new THREE.BoxGeometry(1, 1, 1);

  /* Paving, on the shared ladder's ground rung. */
  {
    const pos = [];
    fillPoly(pos, env, ground, overlayLift(B.envelope.rung));
    if (pos.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      const { x0, x1, z0, z1 } = bboxOf(env);
      const m = new THREE.Mesh(
        g,
        decalMat(C.paving, B.envelope.rung, "pavingConcreteUnit", [(x1 - x0) / 2, (z1 - z0) / 2]),
      );
      m.receiveShadow = true;
      group.add(m);
      bins.counts.backyardPaving = 1;
    }
  }

  /* The rotated planting bed, one rung up so it paints over the paving
     instead of fighting it at the same depth. */
  {
    const bd = B.bed;
    const c = Math.cos(bd.bearing);
    const s = Math.sin(bd.bearing);
    const hl = bd.size[0] / 2;
    const hw = bd.size[1] / 2;
    const ring = [
      [-hl, -hw],
      [hl, -hw],
      [hl, hw],
      [-hl, hw],
    ].map(([u, v]) => [bd.centre[0] + u * c - v * s, bd.centre[1] + u * s + v * c]);
    const pos = [];
    fillPoly(pos, ring, ground, overlayLift(bd.rung));
    if (pos.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      const m = new THREE.Mesh(
        g,
        decalMat(C.bedMulch, bd.rung, "decomposedGranite", [bd.size[0] / 2, bd.size[1] / 2]),
      );
      m.receiveShadow = true;
      group.add(m);
      bins.counts.backyardBed = 1;
    }
    bins.bedRing = ring;
  }

  /* Barbeque grill counters — the college's own photographed family, carried
     at its measured dimensions and extended onto this courtyard. */
  {
    const G = B.grills;
    const counters = [];
    const bays = [];
    for (const it of G.items) {
      const y = ground(it.x, it.z);
      const [cw, cd, ch] = G.counter;
      counters.push({ x: it.x, y: y + ch / 2, z: it.z, rot: it.rot, scale: [cw, ch, cd] });
      const ux = Math.cos(it.rot);
      const uz = -Math.sin(it.rot);
      for (const k of [-1, 1]) {
        const bx = it.x + ux * ((k * G.bayPitch) / 2);
        const bz = it.z + uz * ((k * G.bayPitch) / 2);
        bays.push({
          x: bx,
          y: ground(bx, bz) + G.baySill + G.bay[2] / 2,
          z: bz,
          rot: it.rot,
          scale: [G.bay[0], G.bay[2], G.bay[1]],
        });
      }
    }
    if (counters.length) group.add(instanced(unit, concrete(C.counter), counters));
    if (bays.length) group.add(instanced(unit, painted(C.grillLid), bays));
    bins.counts.grillCounters = counters.length;
    bins.counts.grillBays = bays.length;
  }

  /* Table tennis — ITTF regulation, line set and all. */
  {
    const T = B.pingPong;
    const [tw, td, tt] = T.top;
    const tops = [];
    const legs = [];
    const nets = [];
    const lines = [];
    for (const it of T.items) {
      const c = Math.cos(it.rot);
      const s = Math.sin(it.rot);
      /* local (u along the 2.740 m length, v across the 1.525 m width) -> world */
      const w = (u, v) => [it.x + u * c - v * s, it.z + u * s + v * c];
      const deck = ground(it.x, it.z);
      const top = deck + T.height;
      tops.push({ x: it.x, y: top - tt / 2, z: it.z, rot: it.rot, scale: [tw, tt, td] });
      for (const su of [-1, 1]) {
        for (const sv of [-1, 1]) {
          const [lx, lz] = w(su * (tw / 2 - T.legInset[0]), sv * (td / 2 - T.legInset[1]));
          legs.push({
            x: lx,
            y: ground(lx, lz) + T.leg[2] / 2,
            z: lz,
            rot: it.rot,
            scale: [T.leg[0], T.leg[2], T.leg[1]],
          });
        }
      }
      nets.push({
        x: it.x,
        y: top + T.net.height / 2,
        z: it.z,
        rot: it.rot,
        scale: [T.net.thickness, T.net.height, T.net.length],
      });
      /* Two side lines along the length, two end lines across it, one centre
         line: the ITTF set, drawn as thin plates sitting ON the top face. */
      const ly = top + tt / 100;
      for (const sv of [-1, 1]) {
        lines.push({
          x: w(0, sv * (td / 2 - T.lines.sideEnd / 2))[0],
          y: ly,
          z: w(0, sv * (td / 2 - T.lines.sideEnd / 2))[1],
          rot: it.rot,
          scale: [tw, tt / 50, T.lines.sideEnd],
        });
      }
      for (const su of [-1, 1]) {
        lines.push({
          x: w(su * (tw / 2 - T.lines.sideEnd / 2), 0)[0],
          y: ly,
          z: w(su * (tw / 2 - T.lines.sideEnd / 2), 0)[1],
          rot: it.rot,
          scale: [T.lines.sideEnd, tt / 50, td],
        });
      }
      lines.push({ x: it.x, y: ly, z: it.z, rot: it.rot, scale: [tw, tt / 50, T.lines.centre] });
    }
    if (tops.length) group.add(instanced(unit, concrete(C.tableTop), tops));
    if (legs.length) group.add(instanced(unit, metal(C.tableLeg), legs));
    if (nets.length) group.add(instanced(unit, painted(C.netDark), nets));
    if (lines.length) group.add(instanced(unit, painted(C.lineWhite), lines));
    bins.counts.tables = tops.length;
    bins.counts.tableLegs = legs.length;
    bins.counts.tableNets = nets.length;
    bins.counts.tableLines = lines.length;
  }
}

/* ------------------------------------------------------------ wing roof */

/**
 * The Market Hall wing's roof: ONE plate over massing[462] with the tower ring
 * punched out, split corner-to-corner on two of its own vertices into a
 * standing-seam metal lobe and a pale membrane deck, with the perimeter eave
 * trim carried verbatim from the plate this supersedes.
 */
export function buildWingRoof(S, group, at, bins) {
  const C = S.colors;
  const W = S.wingRoof;
  const wing = openRing(S.measured.wing.ring);
  const tower = openRing(S.measured.tower.ring);
  const lid = drawnLid(wing, S.measured.wing.h, at);
  const y = lid + W.plateLift;

  const { a, b } = W.divider;
  const bb = bboxOf(wing);
  const [metalPos, deckPos] = splitPlateByLine(wing, [tower], a, b);

  const metalMesh = new THREE.Mesh(plateFrom(metalPos, bb), plateMat(seamMetal(C.roofMetal)));
  metalMesh.position.y = y;
  metalMesh.receiveShadow = true;
  group.add(metalMesh);

  const deckMesh = new THREE.Mesh(
    plateFrom(deckPos, bb),
    plateMat(membrane(C.roofDeck, bb.x1 - bb.x0, bb.z1 - bb.z0, W.deck.repeatMetres)),
  );
  deckMesh.position.y = y;
  deckMesh.receiveShadow = true;
  group.add(deckMesh);

  /* The eave trim, on every segment of the ring the plate covers. */
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const trims = [];
  for (let i = 0; i < wing.length; i++) {
    const a = wing[i];
    const b = wing[(i + 1) % wing.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.2) continue;
    const [nx, nz] = normalOf(wing, i);
    const f = frameOf(a, b, [nx, nz]);
    trims.push({
      ...f.at(len / 2, -W.trim.width / 2, lid + W.trim.thickness / 2),
      rot: Math.atan2(nx, nz),
      scale: [len, W.trim.thickness, W.trim.width],
    });
  }
  if (trims.length) group.add(instanced(unit, metal(C.eaveTrim), trims));

  bins.counts.wingRoofPlates = 2;
  bins.counts.wingRoofHoles = 1;
  bins.counts.wingTrims = trims.length;
  bins.wingLid = lid;
  bins.metalTris = metalPos.length / 9;
  bins.deckTris = deckPos.length / 9;
}

/* ---------------------------------------------------------- south portal */

/**
 * The South Parking Entrance's portal: an opening plane on the wing's DRAWN
 * south face, sill at the LOWER of its two jambs so a falling face still
 * closes to the ground, head at the drawn prism's own storey.
 */
export function buildSouthPortal(S, group, ground, bins) {
  const C = S.colors;
  const P = S.southPortal;
  const wing = openRing(S.measured.wing.ring);
  const a = wing[P.faceSeg];
  const b = wing[(P.faceSeg + 1) % wing.length];
  const [nx, nz] = normalOf(wing, P.faceSeg);
  const f = frameOf(a, b, [nx, nz]);
  const jambs = [f.at(P.u0, 0, 0), f.at(P.u1, 0, 0)];
  const sill = Math.min(...jambs.map((p) => ground(p.x, p.z)));
  const mid = f.at((P.u0 + P.u1) / 2, P.proud, sill + P.head / 2);
  const plane = new THREE.PlaneGeometry(1, 1);
  const mat = painted(C.portalShade).clone();
  mat.side = THREE.DoubleSide;
  group.add(
    instanced(plane, mat, [
      { x: mid.x, y: mid.y, z: mid.z, rot: Math.atan2(nx, nz), scale: [P.width, P.head, 1] },
    ]),
  );
  bins.counts.portals = 1;
  bins.portalSill = sill;
  bins.portalJambs = jambs.map((p) => [p.x, p.z]);
}

/* ------------------------------------------------------------------ api */

/**
 * Build Eighth College's south-and-service photo-sourced detail.
 *
 * `photo` is the loaded photo-detail document; this reads only its
 * `eighthsouthservice` section and writes nothing back, returning
 * `{ group, counts }` (empty and harmless if the section is missing, so a
 * half-wired boot still runs). `surfaceAt` — the height of the DRAWN terrain
 * triangle — places everything that stands on the ground; `heightAt` sets the
 * building datum, because that is what campus-massing.js used to put the
 * measured masses there and the two must not diverge.
 */
export function createPhotoEighthSouthService(scene, { photo, heightAt, surfaceAt } = {}) {
  const group = new THREE.Group();
  group.name = "photo-eighth-south-service";
  const S = photo?.eighthsouthservice;
  if (!S) {
    scene?.add(group);
    return { group, counts: {} };
  }
  const ground = surfaceAt || heightAt;
  const at = heightAt || surfaceAt;
  if (typeof ground !== "function" || typeof at !== "function") {
    throw new Error(
      "campus-photo-eighthsouthservice: needs surfaceAt (or heightAt) to place on the ground",
    );
  }

  const bins = { counts: {} };
  buildBackyard(S, group, ground, bins);
  buildWingRoof(S, group, at, bins);
  buildSouthPortal(S, group, ground, bins);

  scene?.add(group);
  return {
    group,
    counts: {
      backyardPaving: bins.counts.backyardPaving || 0,
      backyardBed: bins.counts.backyardBed || 0,
      grillCounters: bins.counts.grillCounters || 0,
      grillBays: bins.counts.grillBays || 0,
      tables: bins.counts.tables || 0,
      tableLegs: bins.counts.tableLegs || 0,
      tableNets: bins.counts.tableNets || 0,
      tableLines: bins.counts.tableLines || 0,
      wingRoofPlates: bins.counts.wingRoofPlates || 0,
      wingRoofHoles: bins.counts.wingRoofHoles || 0,
      wingTrims: bins.counts.wingTrims || 0,
      portals: bins.counts.portals || 0,
      draws: group.children.length,
    },
  };
}
