// The HDH Administration Building (Studio E Architects, 2009) and its
// three-ridge louvred mechanical penthouse — the INVENTED class, R5 batch.
//
// Six facts shaped this file, and each is a place a plausible build goes wrong:
//
//   1. THIS MODULE CARRIES THE WHOLE ENVELOPE, NOT A TREATMENT ON A PRISM.
//      campus-massing.js extrudes massing[144] to repo 42.474: 4.27 m above the
//      measured roof plate and 0.22 m BELOW the tallest penthouse ridge. One
//      flat lid cannot be right about this building at any height. So the GIS
//      prism is retired (skipGis "m:-175,382", REPLACES_MEASURED
//      "photo-hdhadmin") and the wall skin, the plate cap, the west volume, the
//      north-west low element and the penthouse are all built HERE. Every band
//      hangs off the measured plate at 38.20 and none off the prism.
//
//   2. THE PENTHOUSE IS THE SILHOUETTE. A pleated three-ridge two-valley
//      louvred screen over the southern half of the roof, ridges running N-S,
//      each bay falling west to east. Its profile is six MEASURED control
//      points from the 2014 laser, which a 2009 architect's section reproduces
//      to 0.6 m in plan and 0.3 m in height. The pleat is walked as a polyline;
//      no bay is regularised and bay 3 STOPS at the survey ring, still climbing,
//      because that is where the evidence stops (gap g8).
//
//   3. THE SCREEN IS OPEN AND THE LASER IS WHY. Inside the penthouse footprint
//      the plate at 38.20 still returns strongly while the p98 sits 2.6-4.5 m
//      higher, so the enclosure cannot be solid. Its walls and its pleated top
//      are drawn as horizontal blades between vertical mullions — the blade
//      DIRECTION off archdaily_hdh-10's own gable, the PITCH banded and
//      declared. A blade course is emitted per x-interval where the pleat is
//      above it, so a level costs two boxes rather than a strip per metre.
//
//   4. THE VEIL'S EXTENT IS THE SURVEY'S OWN JOG. The suspended glass veil is
//      not laid on by eye: it is exactly the ring's projecting x -196.0 run and
//      the z 391.4 return it turns, which is the corner-wrapping glass box both
//      2010 frames show, set FORWARD of the silver metal flank on the set-back
//      x -193.8 run. The step in the plan and the step in the photograph are
//      the same step.
//
//   5. TWO OF FOUR FACES ARE ESTIMATED AND THE SCENE SAYS SO. The west, its
//      flank and the 33.7 m south gallery face are sourced; the north and east
//      have no photograph on any rung. Under the ultra standard the building
//      ships COMPLETE, with those two faces extending the south system without
//      galleries and at a lower opening fraction, and every mesh they produce
//      is named -estimated so a render alone shows the tier.
//
//   6. NO DIMENSION AND NO COLOUR LIVES IN THIS FILE. Every metre comes from
//      the section — `system`, banded `estimates`, `reads`, or `draw` render
//      offsets — and every hex through a guard that throws on an undeclared
//      role, because campus-materials.js silently ships opaque white for a
//      missing colour. Everything that meets the ground seats on `surfaceAt`;
//      the heights above it are absolute repo metres, because that is the frame
//      the laser measured them in.
//
// Surfaces come from the procedural material library (campus-materials.js):
// the library supplies microstructure at true material scale, the section
// supplies the colour. Deterministic throughout — no clock, no randomness, and
// the only irregularity (the veil's ripple) comes from `hash`.
import * as THREE from "../vendor/three/three.module.min.js";
import { overlayLift } from "./campus-overlay.js";
import { sharedMaterialLibrary } from "./campus-materials.js";

let LIB = null;
const lib = () => (LIB ??= sharedMaterialLibrary(THREE));

/* ------------------------------------------------------------- materials */

/** Throws rather than let campus-materials.js ship opaque white for a typo. */
function hex(colors, role) {
  const v = colors[role];
  if (typeof v !== "string") {
    throw new Error(`campus-photo-hdhadmin: no colour declared for role "${role}"`);
  }
  return v;
}

const board = (c, repeat, normalScale) =>
  lib().get("boardFormedConcrete", { color: c, repeat, normalScale });
const smooth = (c) => lib().get("smoothConcrete", { color: c });
const seamed = (c, repeat, normalScale) =>
  lib().get("metalPanelSeam", { color: c, repeat, normalScale });
const panelMat = (c) => lib().get("metalPanel", { color: c, metalness: 0.8, roughness: 0.4 });
const glassMat = (c) => lib().get("glass", { color: c });
const membraneMat = (c, repeat) => lib().get("roofMembrane", { color: c, repeat });
const paveMat = (c, repeat) => lib().get("pavingConcreteUnit", { color: c, repeat });
const meshMat = (c, repeat) => lib().get("brick", { color: c, repeat, normalScale: 0.4 });
const leafMat = (c, repeat) => lib().get("foliage", { color: c, repeat });

/** Deterministic 0..1 from any integer mix — a reload rebuilds the same veil. */
function hash(...ns) {
  let s = 0;
  for (let i = 0; i < ns.length; i++) s = s * 131.71 + ns[i] * 57.13 + 7.9;
  const v = Math.sin(s) * 43758.5453;
  return v - Math.floor(v);
}

/* ------------------------------------------------------------- geometry */

/**
 * A merged triangle soup, one BufferGeometry per material. Wall skins are
 * long thin quads and there are hundreds of them; folding them into one
 * geometry per material is what keeps this building inside campus-mid's
 * frame budget.
 */
function soup() {
  return { pos: [], uv: [], nrm: [], runs: 0 };
}

function tri(out, a, b, c, uva, uvb, uvc) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  let nx = uy * vz - uz * vy;
  let ny = uz * vx - ux * vz;
  let nz = ux * vy - uy * vx;
  const l = Math.hypot(nx, ny, nz) || 1;
  nx /= l; ny /= l; nz /= l;
  for (const [p, uv] of [[a, uva], [b, uvb], [c, uvc]]) {
    out.pos.push(p[0], p[1], p[2]);
    out.uv.push(uv[0], uv[1]);
    out.nrm.push(nx, ny, nz);
  }
}

/** A quad from four world points, wound a-b-c-d, with per-corner UVs. */
function quad(out, a, b, c, d, tileU, tileV) {
  const u = Math.hypot(b[0] - a[0], b[2] - a[2]) / tileU || 1;
  const v = Math.hypot(d[0] - a[0], d[1] - a[1], d[2] - a[2]) / tileV || 1;
  tri(out, a, b, c, [0, 0], [u, 0], [u, v]);
  tri(out, a, c, d, [0, 0], [u, v], [0, v]);
  out.runs++;
}

/** A vertical band on a face frame, both heights absolute. */
function band(out, fr, off, u0, u1, yLo, yHi, tileU, tileV) {
  const a = fr.at(u0, off);
  const b = fr.at(u1, off);
  quad(out, [a.x, yLo, a.z], [b.x, yLo, b.z], [b.x, yHi, b.z], [a.x, yHi, a.z], tileU, tileV);
}

/** A horizontal plane over an axis rectangle, facing up. */
function slab(out, x0, x1, z0, z1, y, tileU, tileV) {
  quad(out, [x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], tileU, tileV);
}

/** A closed axis box, six faces, into one soup. */
function boxSoup(out, x0, x1, z0, z1, y0, y1, tileU, tileV) {
  slab(out, x0, x1, z0, z1, y1, tileU, tileV);
  slab(out, x1, x0, z0, z1, y0, tileU, tileV);
  quad(out, [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], tileU, tileV);
  quad(out, [x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1], tileU, tileV);
  quad(out, [x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], tileU, tileV);
  quad(out, [x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], tileU, tileV);
}

/** A box whose top is a ramp in x — the west volume's 1.6 % fall. */
function slopedBox(out, x0, x1, z0, z1, y0, yTop0, yTop1, tileU, tileV) {
  quad(out, [x0, yTop0, z1], [x1, yTop1, z1], [x1, yTop1, z0], [x0, yTop0, z0], tileU, tileV);
  slab(out, x1, x0, z0, z1, y0, tileU, tileV);
  quad(out, [x0, y0, z0], [x1, y0, z0], [x1, yTop1, z0], [x0, yTop0, z0], tileU, tileV);
  quad(out, [x1, y0, z1], [x0, y0, z1], [x0, yTop0, z1], [x1, yTop1, z1], tileU, tileV);
  quad(out, [x0, y0, z1], [x0, y0, z0], [x0, yTop0, z0], [x0, yTop0, z1], tileU, tileV);
  quad(out, [x1, y0, z0], [x1, y0, z1], [x1, yTop1, z1], [x1, yTop1, z0], tileU, tileV);
}

function meshOf(out, mat, name) {
  if (!out.runs) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(out.pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(out.uv, 2));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(out.nrm, 3));
  const m = new THREE.Mesh(g, mat);
  m.name = name;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** One InstancedMesh from a list of placements. */
function instanced(geo, mat, items, name) {
  if (!items.length) return null;
  const mesh = new THREE.InstancedMesh(geo, mat, items.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  items.forEach((it, i) => {
    e.set(it.rotX || 0, it.rot || 0, it.rotZ || 0, "YXZ");
    q.setFromEuler(e);
    s.set(it.scale[0], it.scale[1], it.scale[2]);
    p.set(it.x, it.y, it.z);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = name;
  return mesh;
}

/** One surveyed edge's own frame; the outward normal is the section's. */
function edgeFrame(f) {
  const [ax, az] = f.a;
  const [bx, bz] = f.b;
  const length = Math.hypot(bx - ax, bz - az);
  const tx = (bx - ax) / length;
  const tz = (bz - az) / length;
  const [nx, nz] = f.out;
  return {
    id: f.i,
    length,
    nx,
    nz,
    rot: Math.atan2(nx, nz),
    at: (u, w) => ({ x: ax + tx * u + nx * w, z: az + tz * u + nz * w }),
  };
}

/** The lowest drawn surface under a run, sampled along it. */
function lowestUnder(fr, ground, samples) {
  let lo = Infinity;
  for (let i = 0; i <= samples; i++) {
    const p = fr.at((i * fr.length) / samples, 0);
    const g = ground(p.x, p.z);
    if (Number.isFinite(g) && g < lo) lo = g;
  }
  return lo;
}

/** Even-odd point-in-ring. */
function inRing(x, z, r) {
  let ins = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, zi] = r[i];
    const [xj, zj] = r[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
}

/* ------------------------------------------------------------- the pleat */

/**
 * The penthouse pleat as a function of x, walked over the section's own six
 * MEASURED control points. Linear between them and clamped outside — the pleat
 * is not extrapolated past the survey ring that cuts bay 3.
 */
function pleatAt(profile, x) {
  if (x <= profile[0].x) return profile[0].y;
  const last = profile[profile.length - 1];
  if (x >= last.x) return last.y;
  for (let i = 0; i < profile.length - 1; i++) {
    const a = profile[i];
    const b = profile[i + 1];
    if (x >= a.x && x <= b.x) return a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
  }
  return last.y;
}

/**
 * The x-intervals over which the pleat stands at or above `y`. A blade course
 * is one box per interval, so a 33 m screen costs a couple of boxes per level
 * instead of a strip per metre.
 */
function pleatAbove(profile, y) {
  const out = [];
  let open = null;
  for (let i = 0; i < profile.length - 1; i++) {
    const a = profile[i];
    const b = profile[i + 1];
    const aOver = a.y >= y;
    const bOver = b.y >= y;
    const cross = () => a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y);
    if (aOver && open === null) open = a.x;
    if (aOver !== bOver) {
      if (aOver) {
        out.push([open, cross()]);
        open = null;
      } else {
        open = cross();
      }
    }
    if (i === profile.length - 2 && bOver && open !== null) out.push([open, b.x]);
  }
  return out.filter(([u0, u1]) => u1 - u0 > 0);
}

/* ------------------------------------------------------------- envelope */

/* The wall skin, per surveyed run, per system. Every run carries the same
   concrete carcass from below the drawn surface to the level-2 floor and from
   the roof slab to the plate; between those it wears its own system. */
function buildEnvelope(ctx, group) {
  const { S, sys, draw, colors, ground } = ctx;
  const st = sys.storeys;
  const plateY = sys.plate.y;
  const T = draw.tiles;

  const bins = {
    concrete: soup(),
    concreteEst: soup(),
    concreteDeep: soup(),
    metal: soup(),
    glass: soup(),
    glassEst: soup(),
    curtain: soup(),
  };
  const levels = [st.l2FinishedFloor, st.l3FinishedFloor, st.l4FinishedFloor];
  const tops = [st.l3FinishedFloor, st.l4FinishedFloor, st.roofSlab];

  for (const f of S.facades) {
    const fr = edgeFrame(f);
    const est = f.system === "service";
    const solid = est ? bins.concreteEst : bins.concrete;
    /* The gallery face's level-1 concrete stands in three tiers of its own
       shadow all day, and archdaily_hdh-10 reads it two stops below the
       sunlit base elsewhere on the building. Its own read, not a shade of
       the sunlit one. */
    const baseBin = f.system === "gallery" ? bins.concreteDeep : solid;
    const glazed = est ? bins.glassEst : bins.glass;
    const bottom = Math.min(lowestUnder(fr, ground, draw.groundSamples), st.l1FinishedFloor) - draw.skirtDrop;

    /* The base: level 1, board-formed concrete on every run — the kitchen
       storey, and the "tall concrete base" of every photograph. The laser
       says this site is FLAT, so the base is not a retaining podium; it is
       skirted below the drawn surface only so no terrain triangle shows. */
    band(baseBin, fr, draw.wallOffset, 0, fr.length, bottom, st.l2FinishedFloor, T.boardMetres, T.boardMetres);

    /* The upstand: roof slab to the measured plate, concrete on every run. */
    band(solid, fr, draw.wallOffset, 0, fr.length, st.roofSlab, plateY, T.boardMetres, T.boardMetres);

    for (let s = 0; s < levels.length; s++) {
      const y0 = levels[s];
      const y1 = tops[s];
      if (f.system === "veil") {
        /* Clear-glazed curtain wall, recessed behind the veil that hangs off
           it. The veil panels themselves are built with the facades. */
        band(bins.curtain, fr, -sys.veil.curtainInset, 0, fr.length, y0, y1, T.seamMetres, T.seamMetres);
      } else if (f.system === "metal") {
        band(bins.metal, fr, draw.wallOffset, 0, fr.length, y0, y1, T.seamMetres, T.seamMetres);
      } else {
        /* gallery and service share ONE system: a board-formed spandrel band,
           dark-framed glazing, and a head band. They differ only in how much
           of the run is open, which is the whole of what §5.3 licenses. */
        const frac = f.system === "gallery" ? sys.gallery.openingFraction : sys.service.openingFraction;
        const sill = y0 + sys.facade.spandrelHeight;
        const head = y1 - sys.facade.headDepth;
        band(solid, fr, draw.wallOffset, 0, fr.length, y0, sill, T.boardMetres, T.boardMetres);
        band(solid, fr, draw.wallOffset, 0, fr.length, head, y1, T.boardMetres, T.boardMetres);
        const openW = fr.length * frac;
        const bays = Math.max(1, Math.round(fr.length / sys.facade.bayModule));
        const pitch = fr.length / bays;
        for (let k = 0; k < bays; k++) {
          const uc = (k + 0.5) * pitch;
          const w = openW / bays;
          if (w < draw.glassInset * 2) {
            band(solid, fr, draw.wallOffset, uc - pitch / 2, uc + pitch / 2, sill, head, T.boardMetres, T.boardMetres);
            continue;
          }
          band(solid, fr, draw.wallOffset, uc - pitch / 2, uc - w / 2, sill, head, T.boardMetres, T.boardMetres);
          band(solid, fr, draw.wallOffset, uc + w / 2, uc + pitch / 2, sill, head, T.boardMetres, T.boardMetres);
          band(glazed, fr, draw.wallOffset + draw.glassOffset,
            uc - w / 2 + draw.glassInset, uc + w / 2 - draw.glassInset, sill, head, T.seamMetres, T.seamMetres);
        }
      }
    }
  }

  const add = (m) => { if (m) group.add(m); };
  add(meshOf(bins.concrete, board(hex(colors, "concreteSun"), null, draw.boardNormalScale), "hdhadmin-wall-concrete-sourced"));
  add(meshOf(bins.concreteEst, board(hex(colors, "concreteShade"), null, draw.boardNormalScale), "hdhadmin-wall-concrete-estimated"));
  add(meshOf(bins.concreteDeep, board(hex(colors, "concreteDeep"), null, draw.boardNormalScale), "hdhadmin-wall-gallery-base-sourced"));
  add(meshOf(bins.metal, seamed(hex(colors, "metalPanelSilver"), null, draw.seamNormalScale), "hdhadmin-wall-metal-sourced"));
  add(meshOf(bins.glass, glassMat(hex(colors, "glazingDark")), "hdhadmin-wall-glazing-sourced"));
  add(meshOf(bins.glassEst, glassMat(hex(colors, "glazingDark")), "hdhadmin-wall-glazing-estimated"));
  add(meshOf(bins.curtain, glassMat(hex(colors, "glazingDark")), "hdhadmin-wall-curtain-sourced"));
  return bins;
}

/* ------------------------------------------------------------- the roof */

function buildRoof(ctx, group) {
  const { S, sys, roof, draw, colors, ring } = ctx;
  const plateY = sys.plate.y;
  const T = draw.tiles;
  const P = roof.penthouse;

  /* The plate cap, over the survey ring inset so it never shows past the
     wall skin. This is a ROOF, 15.8 m up — not a draped overlay — so it is a
     plain lit mesh and takes no rung from campus-overlay.js. */
  const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const cz = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  const shape = new THREE.Shape();
  ring.forEach(([x, z], i) => {
    const d = Math.hypot(x - cx, z - cz);
    const k = d > 0 ? (d - draw.plateInset) / d : 1;
    const px = cx + (x - cx) * k;
    const pz = cz + (z - cz) * k;
    if (i) shape.lineTo(px, -pz); else shape.moveTo(px, -pz);
  });
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  const plate = new THREE.Mesh(geo, membraneMat(hex(colors, "roofPlate"), [1 / T.paveMetres, 1 / T.paveMetres]));
  plate.position.set(0, plateY + draw.membraneLift, 0);
  plate.name = "roof-plate-measured";
  plate.receiveShadow = true;
  group.add(plate);

  /* The two measured, UNIDENTIFIED solids. Built because the laser resolves
     them; named nothing because nothing identifies them (gaps g5, g6). */
  const low = soup();
  boxSoup(low, roof.nwLow.x0, roof.nwLow.x1, roof.nwLow.z0, roof.nwLow.z1,
    plateY, roof.nwLow.top, T.boardMetres, T.boardMetres);
  group.add(meshOf(low, smooth(hex(colors, "roofPlate")), "roof-nw-low-element-measured"));

  const wv = soup();
  slopedBox(wv, roof.westVolume.x0, roof.westVolume.x1, roof.westVolume.z0, roof.westVolume.z1,
    plateY, roof.westVolume.topWest, roof.westVolume.topEast, T.seamMetres, T.seamMetres);
  group.add(meshOf(wv, seamed(hex(colors, "westVolumeMetal"), null, draw.seamNormalScale), "roof-west-volume-measured"));

  /* ------------------------------------------------- the penthouse screen */

  const profile = P.profile;
  const x0 = profile[0].x;
  const x1 = profile[profile.length - 1].x;
  const z0 = P.z0;
  const z1 = P.z1;
  const unit = new THREE.BoxGeometry(1, 1, 1);

  /* THE PLEATED TOP. Horizontal blades running N-S, parallel to the ridge,
     one per pitch along each measured profile segment — the segments are NOT
     regularised and the last one stops at the survey ring (g8). */
  const topBlades = [];
  for (let i = 0; i < profile.length - 1; i++) {
    const a = profile[i];
    const b = profile[i + 1];
    const run = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.round(run / P.bladePitch));
    const tilt = Math.atan2(b.y - a.y, b.x - a.x);
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      topBlades.push({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        z: (z0 + z1) / 2,
        rotZ: tilt,
        scale: [P.bladePitch, P.bladeDepth, z1 - z0],
      });
    }
  }
  group.add(instanced(unit, panelMat(hex(colors, "screenLouvre")), topBlades,
    "roof-penthouse-pleat-blades-measured"));

  /* THE GABLE WALLS at z0 and z1, as blade COURSES: one box per x-interval
     where the pleat stands above that course, which is two boxes at most on
     this profile instead of a strip per metre. The blade direction is
     sourced (archdaily_hdh-10's own gable); the pitch is the banded estimate. */
  const wallBlades = [];
  const maxTop = Math.max(...profile.map((p) => p.y));
  for (let y = plateY + P.bladePitch; y < maxTop; y += P.bladePitch) {
    for (const [u0, u1] of pleatAbove(profile, y)) {
      for (const z of [z0, z1]) {
        wallBlades.push({
          x: (u0 + u1) / 2,
          y,
          z,
          scale: [u1 - u0, P.bladeDepth, P.bladeDepth],
        });
      }
    }
  }
  /* The WEST end wall closes the same way; the EAST end does NOT, because the
     survey ring cuts bay 3 mid-climb and nothing says where the screen ends. */
  for (let y = plateY + P.bladePitch; y < profile[0].y; y += P.bladePitch) {
    wallBlades.push({ x: x0, y, z: (z0 + z1) / 2, scale: [P.bladeDepth, P.bladeDepth, z1 - z0] });
  }
  group.add(instanced(unit, panelMat(hex(colors, "screenLouvreSecond")), wallBlades,
    "roof-penthouse-screen-blades-measured"));

  /* THE FRAME: the rake following the measured pleat on both gable walls, the
     sill at the plate, and the vertical mullions the 2026 ortho counts. */
  const frame = soup();
  const fd = P.frameDepth;
  for (const z of [z0, z1]) {
    for (let i = 0; i < profile.length - 1; i++) {
      const a = profile[i];
      const b = profile[i + 1];
      const run = Math.hypot(b.x - a.x, b.y - a.y);
      const tilt = Math.atan2(b.y - a.y, b.x - a.x);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const hx = (Math.cos(tilt) * run) / 2;
      const hy = (Math.sin(tilt) * run) / 2;
      quad(frame,
        [mx - hx, my - hy, z], [mx + hx, my + hy, z],
        [mx + hx, my + hy - fd, z], [mx - hx, my - hy - fd, z], T.seamMetres, T.seamMetres);
    }
    quad(frame, [x0, plateY, z], [x1, plateY, z], [x1, plateY + fd, z], [x0, plateY + fd, z],
      T.seamMetres, T.seamMetres);
  }
  const mullions = [];
  for (const bay of P.bays) {
    for (let k = 1; k <= bay.mullions; k++) {
      const bx = bay.x0 + ((bay.x1 - bay.x0) * k) / (bay.mullions + 1);
      const top = pleatAt(profile, bx);
      if (top <= plateY) continue;
      for (const z of [z0, z1]) {
        mullions.push({
          x: bx, y: (plateY + top) / 2, z,
          scale: [draw.mullionSection, top - plateY, draw.mullionSection],
        });
      }
    }
  }
  group.add(meshOf(frame, panelMat(hex(colors, "eaveFascia")), "roof-penthouse-frame-measured"));
  group.add(instanced(unit, panelMat(hex(colors, "eaveFascia")), mullions,
    "roof-penthouse-mullions-estimated"));

  return {
    topBlades: topBlades.length,
    wallBlades: wallBlades.length,
    mullions: mullions.length,
    penthouseLength: x1 - x0,
  };
}

/* ------------------------------------------------------------- facades */

function buildFacades(ctx, group) {
  const { S, sys, draw, colors } = ctx;
  const st = sys.storeys;
  const T = draw.tiles;
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const counts = { veilPanels: 0, spiders: 0, galleryDecks: 0, downlights: 0, guardPosts: 0 };

  /* ------------------------------------------------------------ the veil */

  const V = sys.veil;
  const byColour = new Map(V.palette.map((role) => [role, []]));
  const spiders = [];
  for (const f of S.facades) {
    if (f.system !== "veil") continue;
    const fr = edgeFrame(f);
    const cols = Math.max(1, Math.round(fr.length / (V.panelWidth + draw.panelGap)));
    const rows = Math.max(1, Math.round(V.height / (V.panelHeight + draw.panelGap)));
    const pw = fr.length / cols - draw.panelGap;
    const ph = V.height / rows - draw.panelGap;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const u = ((i + 0.5) * fr.length) / cols;
        const y = st.l2FinishedFloor + ((j + 0.5) * V.height) / rows;
        /* The ripple: the panel plane steps in and out and rotates, which is
           what makes the assembly read as folded rather than flat. Seeded
           from the section, never from a clock. */
        const h1 = hash(S.seed, f.i, i, j);
        const h2 = hash(S.seed, f.i, j, i);
        const proud = V.proud + V.rippleAmplitude * (h1 - 0.5) * 2;
        const role = V.palette[Math.floor(h2 * V.palette.length) % V.palette.length];
        const p = fr.at(u, proud);
        byColour.get(role).push({
          x: p.x, y, z: p.z,
          rot: fr.rot + V.rippleTilt * (h2 - 0.5) * 2,
          scale: [pw, ph, draw.glassOffset],
        });
        counts.veilPanels++;
        /* Four stainless spiders per panel, at its corners, reaching back to
           the curtain wall behind. */
        for (const su of [-1, 1]) {
          for (const sv of [-1, 1]) {
            const q = fr.at(u + (su * pw) / 2, proud - V.spiderSize / 2);
            spiders.push({
              x: q.x, y: y + (sv * ph) / 2, z: q.z, rot: fr.rot,
              scale: [V.spiderSize, V.spiderSize, V.spiderSize],
            });
            counts.spiders++;
          }
        }
      }
    }
  }
  for (const [role, items] of byColour) {
    const m = instanced(new THREE.PlaneGeometry(1, 1), glassMat(hex(colors, role)), items,
      `facade-veil-panels-${role}-sourced`);
    if (m) group.add(m);
  }
  group.add(instanced(unit, panelMat(hex(colors, "spiderStainless")), spiders,
    "facade-veil-spiders-estimated"));

  /* --------------------------------------------------------- the canopy */

  /* The great cantilevered canopy, projecting west over the top terrace with
     a grey metal soffit and recessed downlights. It runs the WEST wall only —
     both 2010 frames show it there and neither shows it turning a corner. */
  const C = sys.canopy;
  const canopy = soup();
  const lights = [];
  const disc = new THREE.CylinderGeometry(1, 1, 1, 10);
  for (const f of S.facades) {
    if (f.wall !== "west") continue;
    const fr = edgeFrame(f);
    const a = fr.at(0, 0);
    const b = fr.at(fr.length, 0);
    const ao = fr.at(0, C.projection);
    const bo = fr.at(fr.length, C.projection);
    quad(canopy, [a.x, C.soffit, a.z], [b.x, C.soffit, b.z], [bo.x, C.soffit, bo.z], [ao.x, C.soffit, ao.z],
      T.seamMetres, T.seamMetres);
    quad(canopy, [ao.x, st.roofSlab, ao.z], [bo.x, st.roofSlab, bo.z], [b.x, st.roofSlab, b.z], [a.x, st.roofSlab, a.z],
      T.seamMetres, T.seamMetres);
    quad(canopy, [ao.x, C.soffit, ao.z], [bo.x, C.soffit, bo.z], [bo.x, st.roofSlab, bo.z], [ao.x, st.roofSlab, ao.z],
      T.seamMetres, T.seamMetres);
    const n = Math.max(1, Math.round(fr.length / sys.gallery.downlightPitch));
    for (let k = 0; k < n; k++) {
      const p = fr.at(((k + 0.5) * fr.length) / n, C.projection / 2);
      lights.push({
        x: p.x, y: C.soffit + draw.glassOffset, z: p.z,
        scale: [sys.gallery.downlightRadius, draw.jointDepth, sys.gallery.downlightRadius],
      });
      counts.downlights++;
    }
  }
  group.add(meshOf(canopy, panelMat(hex(colors, "canopySoffit")), "facade-canopy-sourced"));

  /* -------------------------------------------------------- the galleries */

  const G = sys.gallery;
  const decks = soup();
  const guards = soup();
  const rails = [];
  const posts = [];
  for (const f of S.facades) {
    if (f.system !== "gallery") continue;
    const fr = edgeFrame(f);
    for (const y of G.levels) {
      /* The cantilevered deck slab and its projecting downstand edge beam —
         the band that gives this elevation its horizontal stripe. */
      const a = fr.at(0, 0);
      const b = fr.at(fr.length, 0);
      const ao = fr.at(0, G.projection);
      const bo = fr.at(fr.length, G.projection);
      quad(decks, [a.x, y, a.z], [b.x, y, b.z], [bo.x, y, bo.z], [ao.x, y, ao.z], T.paveMetres, T.paveMetres);
      const soffitY = y - G.slabThickness;
      quad(decks, [ao.x, soffitY, ao.z], [bo.x, soffitY, bo.z], [b.x, soffitY, b.z], [a.x, soffitY, a.z],
        T.paveMetres, T.paveMetres);
      quad(decks, [ao.x, y - G.beamDepth, ao.z], [bo.x, y - G.beamDepth, bo.z], [bo.x, y, bo.z], [ao.x, y, ao.z],
        T.paveMetres, T.paveMetres);
      counts.galleryDecks++;

      /* Downlights, recessed in every soffit at the declared pitch. */
      const n = Math.max(1, Math.round(fr.length / G.downlightPitch));
      for (let k = 0; k < n; k++) {
        const p = fr.at(((k + 0.5) * fr.length) / n, G.projection / 2);
        lights.push({
          x: p.x, y: soffitY - draw.glassOffset, z: p.z,
          scale: [G.downlightRadius, draw.jointDepth, G.downlightRadius],
        });
        counts.downlights++;
      }

      /* The guard: dark steel frames infilled with welded-wire mesh, flat top
         rail, at the code height on the deck's open edge. */
      const gw = G.projection - draw.railSection;
      const np = Math.max(2, Math.round(fr.length / sys.guard.postPitch));
      for (let k = 0; k <= np; k++) {
        const p = fr.at((k * fr.length) / np, gw);
        posts.push({
          x: p.x, y: y + sys.guard.height / 2, z: p.z, rot: fr.rot,
          scale: [draw.postSection, sys.guard.height, draw.postSection],
        });
        counts.guardPosts++;
      }
      const rp = fr.at(fr.length / 2, gw);
      rails.push({
        x: rp.x, y: y + sys.guard.height - draw.railSection / 2, z: rp.z, rot: fr.rot,
        scale: [fr.length, draw.railSection, draw.railSection],
      });
      band(guards, fr, gw, draw.meshPanelInset, fr.length - draw.meshPanelInset,
        y + draw.meshPanelInset, y + sys.guard.height - draw.meshPanelInset, T.meshMetres, T.meshMetres);
    }
  }
  group.add(meshOf(decks, smooth(hex(colors, "gallerySoffit")), "facade-gallery-decks-sourced"));
  group.add(meshOf(guards, meshMat(hex(colors, "meshRail"), null), "facade-gallery-mesh-sourced"));
  group.add(instanced(unit, panelMat(hex(colors, "meshRail")), posts, "facade-gallery-posts-sourced"));
  group.add(instanced(unit, panelMat(hex(colors, "meshRail")), rails, "facade-gallery-rails-sourced"));
  group.add(instanced(disc, panelMat(hex(colors, "downlightWarm")), lights, "facade-downlights-estimated"));

  /* --------------------------------------------------------- the overlook */

  /* The board-formed concrete pier cantilevered clear of the slope at the
     south face's west end, with a solid parapet and a door beneath it. */
  const O = sys.overlook;
  const gallery = S.facades.filter((f) => f.system === "gallery");
  const west = gallery.reduce((best, f) =>
    (Math.min(f.a[0], f.b[0]) < Math.min(best.a[0], best.b[0]) ? f : best), gallery[0]);
  const ofr = edgeFrame(west);
  const overlook = soup();
  const oy = st.l2FinishedFloor;
  const c0 = ofr.at(0, 0);
  const c1 = ofr.at(O.length, 0);
  const d0 = ofr.at(0, O.projection);
  const d1 = ofr.at(O.length, O.projection);
  quad(overlook, [c0.x, oy, c0.z], [c1.x, oy, c1.z], [d1.x, oy, d1.z], [d0.x, oy, d0.z], T.boardMetres, T.boardMetres);
  const obot = oy - G.slabThickness;
  quad(overlook, [d0.x, obot, d0.z], [d1.x, obot, d1.z], [c1.x, obot, c1.z], [c0.x, obot, c0.z], T.boardMetres, T.boardMetres);
  const otop = oy + O.parapet;
  quad(overlook, [d0.x, obot, d0.z], [d1.x, obot, d1.z], [d1.x, otop, d1.z], [d0.x, otop, d0.z], T.boardMetres, T.boardMetres);
  quad(overlook, [c0.x, obot, c0.z], [d0.x, obot, d0.z], [d0.x, otop, d0.z], [c0.x, otop, c0.z], T.boardMetres, T.boardMetres);
  quad(overlook, [d1.x, obot, d1.z], [c1.x, obot, c1.z], [c1.x, otop, c1.z], [d1.x, otop, d1.z], T.boardMetres, T.boardMetres);
  group.add(meshOf(overlook, board(hex(colors, "concreteSun"), null, draw.boardNormalScale),
    "facade-overlook-estimated"));

  /* The vertical-slat metal gate set into the board-formed base of the west
     face, and the dark door beneath the overlook. */
  const slats = [];
  const B = sys.base;
  const veilFace = S.facades.find((f) => f.system === "veil" && f.length > B.slatCount * B.slatPitch);
  if (veilFace) {
    const vf = edgeFrame(veilFace);
    const gateW = B.slatCount * B.slatPitch;
    for (let k = 0; k < B.slatCount; k++) {
      const u = vf.length / 2 - gateW / 2 + (k + 0.5) * (gateW / B.slatCount);
      const p = vf.at(u, draw.wallOffset + draw.bandThickness);
      slats.push({
        x: p.x, y: st.l1FinishedFloor + sys.door.height / 2, z: p.z, rot: vf.rot,
        scale: [draw.slatSection, sys.door.height, draw.slatSection],
      });
    }
  }
  group.add(instanced(unit, panelMat(hex(colors, "slatScreen")), slats, "facade-base-gate-sourced"));

  const doorP = ofr.at(O.length / 2, draw.wallOffset + draw.bandThickness);
  group.add(instanced(unit, panelMat(hex(colors, "doorDark")), [{
    x: doorP.x, y: st.l1FinishedFloor + sys.door.height / 2, z: doorP.z, rot: ofr.rot,
    scale: [sys.door.width, sys.door.height, draw.bandThickness],
  }], "facade-overlook-door-sourced"));

  counts.slats = slats.length;
  counts.guardRails = rails.length;
  return counts;
}

/* ------------------------------------------------------------- ground */

function buildGround(ctx, group) {
  const { S, sys, draw, colors, ground } = ctx;
  const st = sys.storeys;
  const T = draw.tiles;
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const padLift = overlayLift("pad");
  const counts = {};

  /* THE RAMP'S CORRIDOR, settled first because the measured tree row is
     carved against it below. The ramp climbs from the campus side (east) to
     the level-2 walkway at the west — Studio E's own "southern
     campus-connecting ramp" — and arrives BESIDE the overlook rather than
     through it: the same copy has it "culminating in a sheltering pier-like
     overlook", and the pier stands on the west end of this face, so the
     ramp's high end starts one overlook clear of it. */
  const RA = sys.ramp;
  const galleryFaces = S.facades.filter((f) => f.system === "gallery");
  const gz = Math.max(...galleryFaces.flatMap((f) => [f.a[1], f.b[1]]));
  const gxWest = Math.min(...galleryFaces.flatMap((f) => [f.a[0], f.b[0]]));
  /* One post section clear of the pier, so the two abut without touching:
     the ultra standard's "nothing intersects" is a geometric claim, and two
     declared-approximate objects on one face must still resolve against each
     other rather than be left to overlap. */
  const rampX0 = gxWest + sys.overlook.length + draw.postSection;
  const rampX1 = rampX0 + RA.run;
  const rampZ = gz + RA.offset;
  const h0 = RA.width / 2;
  const rampBox = { x0: rampX0, x1: rampX1, z0: rampZ - h0, z1: rampZ + h0 };

  /* THE MEASURED-BUT-UNLISTED SOUTH TREE ROW. 254 laser returns at repo
     25.2-26.6 that the extractor's canopy-maximum threshold kept out of
     lidar.trees. It ships as ONE CONTINUOUS BAND over the measured extent —
     never as N individual trees at an invented pitch, because the row is what
     is measured and the individual trees are not. Cells seat one by one on
     the drawn surface so the band follows rolling ground. */
  const TR = S.ground.treeRow;
  const cells = [];
  /* The measured return band and the sourced ramp occupy the same strip of
     the south terrace, and both cannot fully be there — conflicts
     ['hdhadmin-terrace-band-attribution']. The MEASURED row keeps the band and
     the ESTIMATED ramp keeps its corridor: cells inside the ramp's footprint
     are dropped rather than drawn through it. The dropped count ships, so the
     carve is visible in the counts and not silent. */
  let carved = 0;
  const step = draw.cellMetres;
  const nx = Math.max(1, Math.round((TR.x1 - TR.x0) / step));
  const nz = Math.max(1, Math.round((TR.z1 - TR.z0) / step));
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const x = TR.x0 + ((i + 0.5) * (TR.x1 - TR.x0)) / nx;
      const z = TR.z0 + ((j + 0.5) * (TR.z1 - TR.z0)) / nz;
      if (x >= rampBox.x0 && x <= rampBox.x1 && z >= rampBox.z0 && z <= rampBox.z1) { carved++; continue; }
      const g = ground(x, z);
      const top = g + (TR.top - S.measured.grades.south);
      cells.push({
        x, y: top - TR.crownDepth / 2, z,
        scale: [(TR.x1 - TR.x0) / nx, TR.crownDepth, (TR.z1 - TR.z0) / nz],
      });
    }
  }
  group.add(instanced(unit, leafMat(hex(colors, "canopyGreen"), [1 / T.foliageMetres, 1 / T.foliageMetres]),
    cells, "ground-south-tree-row-measured"));
  counts.treeRowCells = cells.length;
  counts.treeRowCellsCarvedForRamp = carved;

  /* THE ZIGZAG STAIR on the west berm — Studio E's "zigzagging stair echoing
     local beach paths". Sourced as existing; its plan is not sourced, so the
     run is laid inside the MEASURED berm ring and every tread seats on
     surfaceAt rather than on a datum. */
  const ST = sys.stair;
  const berm = ctx.groundRings[ST.ringIndex];
  const treads = [];
  if (berm) {
    const legs = ST.legs;
    const perLeg = Math.max(1, Math.round(ST.treads / legs));
    /* The berm ring overlaps the building's own west wall, so the stair's
       EAST limit is the survey ring itself — taken from the ring, not from a
       literal — and a tread's outer edge stops exactly on it. Nothing
       invented may stand inside a measured footprint. */
    const ringWest = Math.min(...ctx.ring.map((p) => p[0]));
    const bx0 = berm.x0 + ST.width / 2;
    const bx1 = Math.min(berm.x1, ringWest) - ST.width / 2;
    const bz0 = berm.z0 + ST.width / 2;
    const bz1 = berm.z1 - ST.width / 2;
    for (let leg = 0; leg < legs; leg++) {
      for (let k = 0; k < perLeg; k++) {
        const t = (k + 0.5) / perLeg;
        const x = leg % 2 === 0 ? bx0 + (bx1 - bx0) * t : bx1 - (bx1 - bx0) * t;
        const z = bz0 + ((leg + t) * (bz1 - bz0)) / legs;
        const g = ground(x, z);
        treads.push({
          x, y: g + padLift - draw.stairSlab / 2, z,
          scale: [ST.width, draw.stairSlab + draw.footingDrop, ST.width],
        });
      }
    }
  }
  group.add(instanced(unit, paveMat(hex(colors, "concreteSun"), [1 / T.paveMetres, 1 / T.paveMetres]),
    treads, "ground-zigzag-stair-estimated"));
  counts.stairTreads = treads.length;

  /* THE RAMP ITSELF. Its line is declared-approximate and lies inside the
     measured south terrace ring arcgis.ground#1132; it is KNOWN TO BE SHORT
     (absent g16 — a 4.28 m rise needs 51 m at 1:12), and it is drawn as one
     straight leg rather than an invented switchback. */
  const ramp = soup();
  const y0 = ground(rampX1, rampZ) + padLift;
  const y1 = st.l2FinishedFloor;
  quad(ramp,
    [rampX0, y1, rampZ + h0], [rampX1, y0, rampZ + h0],
    [rampX1, y0, rampZ - h0], [rampX0, y1, rampZ - h0], T.paveMetres, T.paveMetres);
  quad(ramp,
    [rampX0, y1 - draw.stairSlab, rampZ + h0], [rampX0, y1, rampZ + h0],
    [rampX1, y0, rampZ + h0], [rampX1, y0 - draw.stairSlab, rampZ + h0], T.paveMetres, T.paveMetres);
  quad(ramp,
    [rampX1, y0 - draw.stairSlab, rampZ - h0], [rampX1, y0, rampZ - h0],
    [rampX0, y1, rampZ - h0], [rampX0, y1 - draw.stairSlab, rampZ - h0], T.paveMetres, T.paveMetres);
  group.add(meshOf(ramp, paveMat(hex(colors, "concreteSun"), [1 / T.paveMetres, 1 / T.paveMetres]),
    "ground-ramp-estimated"));

  const rampPosts = [];
  const rn = Math.max(2, Math.round(RA.run / sys.guard.postPitch));
  for (let k = 0; k <= rn; k++) {
    const t = k / rn;
    const x = rampX0 + (rampX1 - rampX0) * t;
    const y = y1 + (y0 - y1) * t;
    for (const s of [-1, 1]) {
      rampPosts.push({
        x, y: y + sys.guard.height / 2, z: rampZ + s * h0,
        scale: [draw.postSection, sys.guard.height, draw.postSection],
      });
    }
  }
  group.add(instanced(unit, panelMat(hex(colors, "rampGuard")), rampPosts, "ground-ramp-guard-estimated"));
  counts.rampPosts = rampPosts.length;

  return counts;
}

/* ------------------------------------------------------------------- api */

/**
 * Build the HDH Administration Building's photo-sourced detail AND its
 * envelope.
 *
 * `photo` is the loaded photo-detail document; this reads only its `hdhadmin`
 * section and returns `{ group, counts }` (empty and harmless if the section
 * is missing). `surfaceAt` — the height of the DRAWN terrain triangle — is
 * what every ground-meeting thing seats on; `heightAt` is accepted for the
 * shared signature and is only ever a fallback for it. Heights above the
 * ground are ABSOLUTE repo metres, because that is the frame the 2014 laser
 * measured this building's plate and penthouse in.
 */
export function createPhotoHdhAdmin(scene, { photo, heightAt, surfaceAt } = {}) {
  const group = new THREE.Group();
  group.name = "photo-hdhadmin";
  const S = photo?.hdhadmin;
  if (!S) {
    scene?.add(group);
    return { group, counts: {} };
  }
  const ground = surfaceAt || heightAt;
  if (typeof ground !== "function") {
    throw new Error("campus-photo-hdhadmin: needs surfaceAt (or heightAt) to place on the ground");
  }

  /* PRE-MERGE GUARD. This module draws the whole envelope off a section that
     carries a measured plate, a six-point penthouse profile and a per-edge
     facade table. A document without them would draw half a building off half
     a section, which is the silent failure this repo keeps failing on: build
     NOTHING and name the keys, so a merge cannot half-land unnoticed. */
  const missing = ["measured", "system", "facades", "roof", "ground", "draw",
    "estimates", "reads", "derivations", "colors", "colorSources"].filter((k) => !S[k]);
  if (S.system && !S.system.storeys) missing.push("system.storeys");
  if (S.system?.storeys && S.system.storeys.l1FinishedFloor === undefined) missing.push("system.storeys.l1FinishedFloor");
  if (S.system && !S.system.veil) missing.push("system.veil");
  if (S.roof && !S.roof.penthouse) missing.push("roof.penthouse");
  if (S.roof?.penthouse && !Array.isArray(S.roof.penthouse.profile)) missing.push("roof.penthouse.profile");
  if (S.measured && !S.measured.massing) missing.push("measured.massing");
  if (S.ground && !S.ground.treeRow) missing.push("ground.treeRow");
  if (missing.length) {
    scene?.add(group);
    return { group, counts: { pendingMerge: missing.join(",") } };
  }

  /* The survey ring, closed exactly once, for the plate cap and the gates. */
  const ring = S.measured.mass.ring.slice();
  while (ring.length > 2 &&
    ring[ring.length - 1][0] === ring[ring.length - 2][0] &&
    ring[ring.length - 1][1] === ring[ring.length - 2][1]) ring.pop();

  /* Every registered ground ring by its LITERAL arcgis.ground index, with the
     bbox the section copied off the survey. The builder never renumbers one
     and never invents a landscape position: the stair is laid inside the
     berm's own measured box. */
  const groundRings = {};
  for (const r of S.ground.rings) groundRings[r.index] = { ...r, ...r.bbox };

  const ctx = {
    S,
    sys: S.system,
    roof: S.roof,
    draw: S.draw,
    colors: S.colors,
    ground,
    ring,
    groundRings,
  };

  const envelope = new THREE.Group();
  envelope.name = "hdhadmin-envelope";
  buildEnvelope(ctx, envelope);
  group.add(envelope);

  const roof = new THREE.Group();
  roof.name = "hdhadmin-roof";
  const roofCounts = buildRoof(ctx, roof);
  group.add(roof);

  const facades = new THREE.Group();
  facades.name = "hdhadmin-facades";
  const facadeCounts = buildFacades(ctx, facades);
  group.add(facades);

  const groundGroup = new THREE.Group();
  groundGroup.name = "hdhadmin-ground";
  const groundCounts = buildGround(ctx, groundGroup);
  group.add(groundGroup);

  scene?.add(group);
  const bySystem = (sysName) => S.facades.filter((f) => f.system === sysName).length;
  return {
    group,
    counts: {
      facadeRuns: S.facades.length,
      veilRuns: bySystem("veil"),
      metalRuns: bySystem("metal"),
      galleryRuns: bySystem("gallery"),
      serviceRuns: bySystem("service"),
      storeys: S.system.storeys.count,
      plateY: S.system.plate.y,
      penthouseBays: S.roof.penthouse.bays.length,
      penthouseProfile: S.roof.penthouse.profile.length,
      ...roofCounts,
      ...facadeCounts,
      ...groundCounts,
      draws: group.children.reduce((s, g) => s + g.children.length, 0),
    },
  };
}
