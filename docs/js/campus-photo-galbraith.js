// Galbraith Hall, Revelle College, from photographs — the INVENTED class.
//
// Deems Lewis Martin, 1965; Kevin deFreitas Architects renovation, 2013. A
// 62 m square block under one enormous coffered concrete roof that oversails
// it by eight metres on every side, carried on five pairs of leaning,
// flare-headed, splay-footed struts per face. This file draws the roof, the
// struts, the two glazed levels between them and the ground immediately
// around three of the four sides. It never touches the measured mass.
//
// Four things decided the shape of this file:
//
//   1. The grid is not eyeballed, it is DERIVED. The architect's Second Floor
//      Plan (KdA, 02.17.12) gives two numbers and only two: 10.83 m between
//      pair centres and 2.45 m inside a pair. Centre five pairs at 10.83 m on
//      the MEASURED ring and what is left over at each end is the oversail —
//      it lands at 8.07-8.22 m against the 8.29 m counted off the photographs,
//      and it was never typed in. The coffer module is that same number over
//      eight, 1.354 m, and 46 of them fit each measured face. Everything on
//      this building solves on one grid or it is wrong.
//
//   2. The heights had to be re-reconciled, and the ground survey won. The
//      earlier reading said LiDAR 16.6 was the roof above a south lawn and
//      ArcGIS 12.8 the same roof above a north plaza one storey higher. The
//      2014 terrain, sampled on a 2 m grid, is FLAT at 23.6 m under the whole
//      footprint and for forty metres on every side: there is no step. On
//      flat ground the two numbers reconcile the other way — 12.8 is the
//      EAVES and 16.6 is the highest return, which over this roof is the
//      monitor field. So the coffered roof plane sits 3.8 m BELOW the top of
//      the measured mass, and that 3.8 m of measured box standing above it is
//      the monitors, which are otherwise absent. 12.8 - 1.4 of roof slab is
//      two 5.7 m levels, and two glazed bands split by the mid-level balcony
//      is exactly what the north, south and west photographs show.
//
//   3. The struts are the building. A straight box reads as a car park; the
//      real thing is thin at the waist, sweeps out below into a wide flat foot
//      and flares above into a broad bracket that meets the beam hard, and
//      each pair splays APART going up. That profile is a lathe, the lean is a
//      rotation about the face normal, and both come from the data.
//
//   4. What stands on the ground stands on `surfaceAt`, not on a level line.
//      The struts' feet, the lower colonnade and the fluted wall are each
//      seated per-item on the drawn terrain and run up to a floating datum, so
//      nothing floats and nothing sinks when the grade moves under it.
//
// Colours are DATA — every hex comes from the `colors` block of the photo
// document's `galbraith` section, with the lighting condition of the sample
// named there. Repeats are InstancedMesh: the coffers alone are ~5,000 pans
// and rib bosses in a handful of draws.
//
// What is NOT here is in the section's `absent` array, and two entries there
// are deliberate refusals rather than oversights: the roof monitors, because
// no photograph has ever seen this roof from outside, and the ENTIRE east
// ground plane, because no photograph has ever seen that elevation at all.
// The east face gets the colonnade and roof it must share with the other
// three and not one thing more.
import * as THREE from "../vendor/three/three.module.min.js";
import { applyOverlayDepth, OVERLAY, overlayLift } from "./campus-overlay.js";

/* Ground decals ride the overlay ladder so they paint over the measured
   terrain in a fixed order instead of z-fighting it. */
const PAD = "pad";
const CARPET = "carpet";
const PAINT = "paint";

const concrete = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0.0 });
/* The colonnade soffit is the one surface in every reference frame that is
   BRIGHTER than the sky-lit walls around it, because eleven metres of pale
   concrete bounces the plaza back up into it. Direct light never reaches it,
   so that bounce has to be carried by the material or the whole underside of
   the building goes grey. */
const soffit = (color) =>
  new THREE.MeshStandardMaterial({
    color, roughness: 0.92, metalness: 0.0, emissive: color, emissiveIntensity: 0.3,
  });
const painted = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.3 });
const metal = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.8 });
/* Dark bronze curtain wall standing under an eleven-metre oversail is in
   permanent shade, and a pure diffuse dark grey there renders as a HOLE in
   the elevation rather than as glass. It carries a little of its own light so
   it reads the way every reference frame reads: dark, but a surface. */
const glassMat = (color) =>
  new THREE.MeshStandardMaterial({
    color, roughness: 0.12, metalness: 0.45, side: THREE.DoubleSide,
    emissive: color, emissiveIntensity: 0.22,
  });
const rock = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 1.0, metalness: 0.0 });
const foliage = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0.0 });

function decal(color, rung) {
  return applyOverlayDepth(
    new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0.0 }),
    rung
  );
}

/** Deterministic 0..1 from any integer mix — a reload rebuilds the same wall. */
function hash(...ns) {
  let s = 0;
  for (let i = 0; i < ns.length; i++) s = s * 131.71 + ns[i] * 57.13 + 7.9;
  const v = Math.sin(s) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * One InstancedMesh from a list of placements. `place` returns
 * `{ x, y, z, rot?, rotX?, rotZ?, scale? }`. The Euler order is YXZ, so `rot`
 * (about Y, the face's own orientation) is applied LAST and `rotZ` therefore
 * leans the item within the face plane — which is the whole point: the struts
 * lean along the elevation, not out of it.
 */
function instanced(geo, mat, items, place, shadow = true) {
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
  /* Sub-decimetre repeats — bird-spike wire, balustrade pickets, coffer
     fillets, paving joints, planting — are opted OUT of the shadow pass.
     Their shadows are smaller than a shadow-map texel at every distance you
     can stand from this building, and there are eight thousand of them: they
     cost real frame time and buy nothing you can see. The struts, decks and
     roof still cast, which is what actually shapes this facade. */
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  return mesh;
}

/** A flat XZ decal quad lying in the ground plane. */
function quad(w, d) {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  return g;
}

/* ------------------------------------------------------------ face frames */

/**
 * A facade's own coordinate frame, built from the two MEASURED ring vertices
 * the data names. `at(u, w, y)` is u metres along the face from its start, w
 * metres PROUD of it (so the building's interior is negative w), y in world
 * height. `rot` orients a box so its local +Z points out of the face and its
 * local +X runs along it.
 */
function frameOf(f) {
  /* The tangent is the MEASURED edge itself, not the cardinal direction the
     face is named after. Galbraith's ring is half a degree off square, and a
     frame built on (0, +/-1) walks half a metre off its own wall by the far
     corner — enough to stand the glazing outside the roof it hangs under. */
  let [sx, sz] = f.a;
  let [ex, ez] = f.b;
  const length = Math.hypot(ex - sx, ez - sz);
  let tx = (ex - sx) / length;
  let tz = (ez - sz) / length;
  /* Outward normal is the tangent turned a quarter, with `out` deciding which
     of the two quarters is outward. */
  let nx = tz;
  let nz = -tx;
  if (nx * f.out[0] + nz * f.out[1] < 0) {
    nx = -nx; nz = -nz;
    [sx, sz, ex, ez] = [ex, ez, sx, sz];
    tx = -tx; tz = -tz;
  }
  return {
    id: f.id,
    length,
    rot: Math.atan2(nx, nz),
    at: (u, w, y) => ({ x: sx + tx * u + nx * w, y, z: sz + tz * u + nz * w }),
  };
}

/** The five strut pairs on a face: ten `u` positions with their lean sign. */
function columnLines(section, f, frame) {
  const { pairIndices, pairGap } = section.grid;
  const out = [];
  for (const k of pairIndices) {
    const centre = frame.length / 2 + k * f.pairSpacing;
    for (const s of [-1, 1]) {
      out.push({ u: centre + (s * pairGap) / 2, lean: s, pair: k });
    }
  }
  return out;
}

/* ------------------------------------------------------------ the struts */

/**
 * The strut profile as a lathe: half-width against height, four radial
 * segments turned 45 degrees so the section is a square standing on its
 * diagonal — which is what puts a flat face toward the plaza and an arris
 * toward the wall, the way ad01-entry-before.jpg and ucsdmap.jpg both show it.
 */
function strutGeometry(profile, height) {
  const pts = profile.map(([t, r]) => new THREE.Vector2(r, t * height));
  const g = new THREE.LatheGeometry(pts, 4);
  g.rotateY(Math.PI / 4);
  return g;
}

function collectStruts(section, f, frame, ctx, bins) {
  const C = section.column;
  /* 3.4 m is glass-to-strut, not ring-to-strut. The glazing plane is itself
     held off the ring far enough to clear the drawn mass, and the colonnade
     rides out with it or the terrace ends up outboard of its own columns. */
  const wCol = section.facade.wallStandoff + C.standoff;
  const { soffitY } = ctx;

  for (const line of columnLines(section, f, frame)) {
    /* The foot stands on the DRAWN terrain, not on a level line, so a strut
       never floats over the grade or sinks under it. */
    const p = frame.at(line.u, wCol, 0);
    const footY = ctx.ground(p.x, p.z);
    const height = soffitY - footY;
    if (!(height > 1)) continue;
    /* The lean is the pair splaying apart going up: the head ends up
       `splayHead` further from the pair centre than the foot. */
    const tilt = Math.atan2(C.splayHead, height);
    bins.struts.push({
      x: p.x, y: footY, z: p.z, rot: frame.rot, rotZ: -line.lean * tilt,
      height,
    });
    /* The bracket: a broad flat-topped head that meets the beam hard, riding
       the leaning axis so it stays square to its own strut. */
    const cap = C.headCap;
    const along = height - cap.height / 2;
    const q = frame.at(line.u + line.lean * along * Math.sin(tilt), wCol, 0);
    bins.brackets.push({
      x: q.x, y: footY + along * Math.cos(tilt), z: q.z,
      rot: frame.rot, rotZ: -line.lean * tilt,
      scale: [cap.halfWidth * 2, cap.height, cap.halfWidth * 2],
    });
  }
}

/* -------------------------------------------------------- the roof edge */

function collectRoofEdge(section, f, frame, ctx, bins) {
  const R = section.roofEdge;
  const { eavesY, soffitY } = ctx;
  const wEdge = section.facade.wallStandoff + section.grid.roofOut;
  const L = f.roofLength;
  const u0 = -f.ext;
  const mid = u0 + L / 2;

  /* 1. the bright metal drip cap, 2. the smooth fascia band with no coffer
     expression, 3. the bird-spike comb on the outer soffit arris. All three
     are in crop-roofedge.jpg (2011) and still in wm-from-below.jpg (2026). */
  bins.dripCap.push({
    ...frame.at(mid, wEdge - R.dripCap.depth / 2 + 0.02, eavesY - R.dripCap.height / 2),
    rot: frame.rot,
    scale: [L, R.dripCap.height, R.dripCap.depth],
  });
  bins.fascia.push({
    ...frame.at(mid, wEdge - R.fascia.depth / 2, eavesY - R.dripCap.height - R.fascia.height / 2),
    rot: frame.rot,
    scale: [L, R.fascia.height, R.fascia.depth],
  });
  /* The slab itself: what closes the gap between the fascia band and the
     coffered soffit, and what the whole roof plane reads as edge-on. It stops
     at the BACK of the coffer recesses, not at the rib faces — a slab taken
     all the way down to the soffit plane encloses the entire coffer field and
     leaves a blank ceiling z-fighting against 2,000 buried rib bosses. */
  const back = soffitY + section.soffit.recess;
  bins.fascia.push({
    ...frame.at(mid, wEdge / 2, (back + eavesY) / 2),
    rot: frame.rot,
    scale: [L, eavesY - back, wEdge],
  });
  const spikeY = soffitY + R.birdSpike.height / 2;
  bins.birdSpike.push({
    ...frame.at(mid, wEdge - R.birdSpike.depth / 2 - 0.02, spikeY),
    rot: frame.rot,
    scale: [L, R.birdSpike.height, R.birdSpike.depth],
  });
  /* The fine wire needles that make the comb read as a dentil course rather
     than as a painted stripe. */
  for (let u = R.birdSpike.pitch / 2; u < L; u += R.birdSpike.pitch) {
    bins.needles.push({
      ...frame.at(u0 + u, wEdge - R.birdSpike.depth / 2,
        spikeY + R.birdSpike.height / 2 + R.birdSpike.needle / 2),
      rot: frame.rot,
      scale: [1, R.birdSpike.needle, 1],
    });
  }
}

/* ----------------------------------------------------- the coffered soffit */

function collectSoffit(section, f, frame, ctx, bins) {
  const S = section.soffit;
  const { soffitY } = ctx;
  const L = f.roofLength;
  const u0 = -f.ext;
  const cell = f.cofferPitch;
  const wEdge = section.facade.wallStandoff + section.grid.roofOut;
  /* The coffer field stops one module short of the OUTER edge — that last
     strip is the solid fascia band, and building it any other way puts a
     recess where every photograph shows smooth concrete. */
  const solid = section.roofEdge.solidStripModules * cell;
  const depth = wEdge - solid;
  const rows = Math.max(1, Math.round(depth / cell));
  const panY = soffitY + S.recess / 2;

  /* The recess back: one plate for the whole strip, sitting `recess` above
     the rib faces, so the ribs read as a pale grid standing off a darker
     field rather than as lines drawn on a flat ceiling. */
  bins.cofferPan.push({
    ...frame.at(u0 + L / 2, depth / 2, soffitY + S.recess + 0.01),
    rot: frame.rot,
    scale: [L, 0.02, depth],
  });

  /* Ribs across the face and ribs running out of it, both on the module. */
  const cols = Math.max(1, Math.round(L / cell));
  for (let i = 0; i <= cols; i++) {
    bins.ribAcross.push({
      ...frame.at(u0 + (i * L) / cols, depth / 2, panY),
      rot: frame.rot,
      scale: [S.ribWidth, S.recess, depth],
    });
  }
  for (let r = 0; r <= rows; r++) {
    bins.ribAlong.push({
      ...frame.at(u0 + L / 2, (r * depth) / rows, panY),
      rot: frame.rot,
      scale: [L, S.recess, S.ribWidth],
    });
  }
  /* A round boss at every rib crossing is what gives each pan its rounded
     corner — the single most recognisable thing about this soffit in
     wm-from-below.jpg, and a plain square lattice loses it entirely. */
  for (let i = 0; i <= cols; i++) {
    for (let r = 0; r <= rows; r++) {
      bins.ribBoss.push({
        ...frame.at(u0 + (i * L) / cols, (r * depth) / rows, panY),
        rot: frame.rot,
        scale: [1, S.recess, 1],
      });
    }
  }
  /* The solid strip: one module at the edge with no pans behind it. */
  bins.solidStrip.push({
    ...frame.at(u0 + L / 2, wEdge - solid / 2, panY),
    rot: frame.rot,
    scale: [L, S.recess + 0.02, solid],
  });

  /* Cylindrical surface downlights on the colonnade line, every second
     coffer, exactly as ad01, flickr and wm-from-below all show them. */
  for (let i = 1; i < cols; i += S.lightPitchModules) {
    bins.downlight.push({
      ...frame.at(u0 + ((i + 0.5) * L) / cols,
        section.facade.wallStandoff + section.column.standoff, soffitY - S.lightHeight / 2),
      rot: frame.rot,
    });
  }
}

/* ------------------------------------- the glazed wall, level 1 and level 2 */

function collectGlazing(section, f, frame, ctx, bins) {
  const F = section.facade;
  const { l1Y, l2Y, soffitY } = ctx;
  const L = frame.length;
  const wWall = section.facade.wallStandoff;
  const mid = L / 2;

  /* Level 1 is glazed on the north, south and east; on the west it is the
     fluted aggregate wall instead, which collectFlutedWall builds. */
  const bands = [];
  if (!f.flutedWall) {
    bands.push([l1Y + F.glassSillGap, l2Y - F.spandrel, "glass"]);
  }
  bands.push([l2Y + F.glassSillGap, soffitY - F.glassTopGap, "glass"]);

  for (const [y0, y1, kind] of bands) {
    if (y1 <= y0) continue;
    bins.glass.push({
      ...frame.at(mid, wWall + 0.04, (y0 + y1) / 2),
      rot: frame.rot,
      scale: [L - 0.2, y1 - y0, 1],
      kind,
    });
    /* Mullions on their own pitch — deliberately finer than the coffer
       module, and never equal to it, or the facade turns into a grid. */
    for (let u = F.mullionPitch / 2; u < L; u += F.mullionPitch) {
      bins.mullion.push({
        ...frame.at(u, wWall + 0.05, (y0 + y1) / 2),
        rot: frame.rot,
        scale: [F.mullionWidth, y1 - y0, 0.12],
      });
    }
    for (const y of [y0, y1]) {
      bins.mullion.push({
        ...frame.at(mid, wWall + 0.05, y),
        rot: frame.rot,
        scale: [L - 0.2, F.mullionWidth, 0.12],
      });
    }
  }

  /* The pale spandrel under the balcony floor line. */
  bins.spandrel.push({
    ...frame.at(mid, wWall - 0.02, l2Y - F.spandrel / 2),
    rot: frame.rot,
    scale: [L, F.spandrel, 0.16],
  });
}

/* ---------------------------------- the balcony, the terrace and the rails */

/** Deck + picket rail along a face at height `y`, projecting `project` from
 *  the glass line. Both the mid-level balcony and the plaza-level terrace are
 *  this same assembly at two different heights. */
function collectDeck(section, f, frame, ctx, bins, spec, y, redBand) {
  const F = section.facade;
  const L = frame.length;
  const wWall = section.facade.wallStandoff;
  const wEdge = wWall + spec.project;
  const mid = L / 2;

  bins.deck.push({
    ...frame.at(mid, wWall + spec.project / 2, y - spec.deck / 2),
    rot: frame.rot,
    scale: [L, spec.deck, spec.project],
  });
  if (redBand) {
    bins.redBand.push({
      ...frame.at(mid, wEdge + 0.03, y - spec.deck / 2),
      rot: frame.rot,
      scale: [L, redBand, 0.06],
    });
  }

  const B = F.balcony;
  const h = spec.railHeight ?? B.railHeight;
  for (let u = B.picketPitch / 2; u < L; u += B.picketPitch) {
    bins.picket.push({
      ...frame.at(u, wEdge - 0.05, y + h / 2),
      rot: frame.rot,
      scale: [B.picketSize, h, B.picketSize],
    });
  }
  bins.railCap.push({
    ...frame.at(mid, wEdge - 0.05, y + h),
    rot: frame.rot,
    scale: [L, B.railCap, B.railCap * 1.6],
  });
  bins.railCap.push({
    ...frame.at(mid, wEdge - 0.05, y + h * 0.42),
    rot: frame.rot,
    scale: [L, B.midRail, B.midRail * 1.4],
  });
}

/* --------------------------------------- the lower colonnade, south and west */

function collectLowerColonnade(section, f, frame, ctx, bins) {
  const C = section.facade.lowerColonnade;
  const T = section.facade.terrace;
  const { l2Y } = ctx;
  const L = frame.length;
  const wWall = section.facade.wallStandoff;
  const wCol = wWall + T.project - C.columnSize;
  const topY = l2Y - T.deck;

  /* Slender plain square columns — a DISTINCT system, never a continuation of
     the flared struts above, which is the thing oceanlight-21220.jpg is
     clearest about. Each one is seated on the drawn terrain. */
  const n = Math.max(2, Math.round(L / C.pitch));
  for (let i = 0; i <= n; i++) {
    const u = (L * i) / n;
    const p = frame.at(u, wCol, 0);
    const g = ctx.ground(p.x, p.z);
    if (topY - g < 1) continue;
    bins.lowerColumn.push({
      x: p.x, y: (g + topY) / 2, z: p.z, rot: frame.rot,
      scale: [C.columnSize, topY - g, C.columnSize],
    });
  }

  /* The set-back dark glazing behind them. */
  if (f.flutedWall) return;
  const p = frame.at(L / 2, wWall, 0);
  const g = ctx.ground(p.x, p.z);
  bins.lowerGlass.push({
    ...frame.at(L / 2, wWall + 0.04, (g + 0.1 + topY - 0.3) / 2),
    rot: frame.rot,
    scale: [L - 0.4, Math.max(0.5, topY - 0.4 - g), 1],
  });
}

/* ------------------------------------- the fluted aggregate wall, west only */

function collectFlutedWall(section, f, frame, ctx, bins) {
  const W = section.facade.flutedWall;
  const T = section.facade.terrace;
  const { l2Y } = ctx;
  const L = frame.length;
  const wWall = section.facade.wallStandoff;
  const topY = l2Y - T.deck;
  const doorU0 = L / 2 - W.doorWidth / 2;
  const doorU1 = L / 2 + W.doorWidth / 2;

  for (const [u0, u1] of [[0.1, doorU0], [doorU1, L - 0.1]]) {
    const p = frame.at((u0 + u1) / 2, wWall, 0);
    const g = ctx.ground(p.x, p.z);
    bins.flutedWall.push({
      ...frame.at((u0 + u1) / 2, wWall + W.thickness / 2, (g + topY) / 2),
      rot: frame.rot,
      scale: [u1 - u0, topY - g, W.thickness],
    });
    /* The vertical flutes: strips on 0.4 m centres standing proud of the
       panel, which is what makes a board-formed aggregate wall read as one. */
    for (let u = u0 + W.flutePitch / 2; u < u1; u += W.flutePitch) {
      bins.flute.push({
        ...frame.at(u, wWall + W.thickness + W.fluteDepth / 2, (g + topY) / 2),
        rot: frame.rot,
        scale: [W.fluteWidth, topY - g, W.fluteDepth],
      });
    }
  }
  /* The dark timber-toned double doors in the middle of it. */
  const p = frame.at(L / 2, wWall, 0);
  const g = ctx.ground(p.x, p.z);
  bins.doorBronze.push({
    ...frame.at(L / 2, wWall + W.thickness, g + W.doorHeight / 2),
    rot: frame.rot,
    scale: [W.doorWidth, W.doorHeight, 0.08],
  });
}

/* ------------------------------------------------- the entry, north face */

function buildEntry(section, group, frame, f, ctx) {
  const E = section.entry;
  const { colors } = section;
  const { l1Y, soffitY, eavesY } = ctx;
  const L = frame.length;
  const wWall = section.facade.wallStandoff;
  const C = section.column;

  /* The two projecting beams. They ride the MIDDLE pair's column lines, taken
     at the head where the pair has already splayed, and they run right out
     past the fascia — the deepest, whitest thing on this elevation and the
     blades the building's name is painted on. */
  const beamH = eavesY - (soffitY - E.beam.dropBelowSoffit);
  const shape = new THREE.Shape();
  const inner = 0;
  const outer = wWall + section.grid.roofOut + E.beam.project;
  const ch = E.beam.chamfer;
  shape.moveTo(inner, 0);
  shape.lineTo(outer, 0);
  shape.lineTo(outer, -(beamH - ch));
  shape.lineTo(outer - ch, -beamH);   // the chamfered tip
  shape.lineTo(inner, -beamH);
  shape.closePath();
  const beamGeo = new THREE.ExtrudeGeometry(shape, {
    depth: E.beam.width, bevelEnabled: false,
  });
  /* The shape is drawn in (w, y); rotate it so +x becomes the outward normal
     and the extrusion runs along the face. */
  /* The shape is drawn in (w, y) and extruded along +z; rotate it so shape-x
     becomes the face's outward normal. The extrusion then runs along -u, so
     each beam is placed half a width further along to sit on its strut. */
  beamGeo.rotateY(-Math.PI / 2);

  const headSplay = C.splayHead;
  for (const s of [-1, 1]) {
    const u = L / 2 + (s * section.grid.pairGap) / 2 + s * headSplay + E.beam.width / 2;
    const p = frame.at(u, 0, 0);
    const mesh = new THREE.Mesh(beamGeo, concrete(colors.entryBeam));
    mesh.position.set(p.x, eavesY, p.z);
    mesh.rotation.y = frame.rot;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  /* The 2013 canopy: a flat red-orange blade over the doors with two exposed
     linear luminaires under it. It sits beside the entry pair, not on it. */
  const K = E.canopy;
  const uCan = L / 2 - K.width / 2 - section.grid.pairGap / 2 - 0.4;
  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(K.width, K.depth, K.project), painted(colors.canopyRed)
  );
  const cp = frame.at(uCan, wWall + K.project / 2, 0);
  canopy.position.set(cp.x, l1Y + K.height, cp.z);
  canopy.rotation.y = frame.rot;
  canopy.castShadow = true;
  group.add(canopy);

  const lum = E.luminaire;
  for (let i = 0; i < lum.count; i++) {
    const w = wWall + lum.inset + (i * (K.project - 2 * lum.inset)) / Math.max(1, lum.count - 1);
    const lp = frame.at(uCan, w, 0);
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(lum.length, lum.size, lum.size),
      new THREE.MeshStandardMaterial({ color: colors.luminaire, roughness: 0.4, emissive: colors.luminaire, emissiveIntensity: 0.35 })
    );
    bar.position.set(lp.x, l1Y + K.height - K.depth / 2 - lum.size, lp.z);
    bar.rotation.y = frame.rot;
    group.add(bar);
  }

  /* Light-anodised glazed door leaves under it — the 2013 contrast against
     the bronze the rest of the building wears. */
  const D = E.doors;
  const leaves = [];
  for (let i = 0; i < D.leaves; i++) {
    leaves.push(uCan + (i - (D.leaves - 1) / 2) * (D.width + 0.06));
  }
  group.add(instanced(
    new THREE.BoxGeometry(D.width, D.height, 0.08), painted(section.colors.doorAnodised),
    leaves, (u) => ({ ...frame.at(u, wWall + 0.06, l1Y + D.height / 2), rot: frame.rot })
  ));

  /* The 'Theatre & Dance Department' hanging blade on its two rods. The
     lettering is absent; the blade is not. */
  const S = E.sign;
  const uSign = L / 2 + 8;
  const sp = frame.at(uSign, wWall + 1.6, 0);
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(S.width, S.height, 0.05), painted(colors.signBlade)
  );
  blade.position.set(sp.x, l1Y + S.height_above, sp.z);
  blade.rotation.y = frame.rot;
  group.add(blade);
  group.add(instanced(
    new THREE.CylinderGeometry(0.012, 0.012, S.rodLength, 5), metal(colors.stairSteel),
    [-1, 1], (s) => ({
      ...frame.at(uSign + s * S.width * 0.4, wWall + 1.6, l1Y + S.height_above + S.height / 2 + S.rodLength / 2),
      rot: frame.rot,
    })
  ));
}

/* --------------------------------------------------------- the west stair */

function buildStair(section, group, ctx) {
  const S = section.west.stair;
  const { colors } = section;
  const topY = ctx.l2Y;
  const baseY = ctx.ground(S.x, S.z1);
  const rise = topY - baseY;
  if (!(rise > 1)) return;
  const run = S.z1 - S.z0;
  const treads = S.treads;

  /* A straight flight of real treads and risers with white stringers either
     side and a picket rail — prominent in ucsdmap.jpg and, until now,
     unmodelled. */
  const steps = [];
  for (let i = 0; i < treads; i++) {
    steps.push({
      z: S.z1 - (run * (i + 0.5)) / treads,
      y: baseY + (rise * (i + 1)) / treads,
    });
  }
  group.add(instanced(
    new THREE.BoxGeometry(S.width, 0.06, run / treads + 0.04), concrete(colors.deck),
    steps, (s) => ({ x: S.x, y: s.y, z: s.z })
  ));
  group.add(instanced(
    new THREE.BoxGeometry(S.width, rise / treads, 0.05), concrete(colors.deck),
    steps, (s) => ({ x: S.x, y: s.y - rise / treads / 2, z: s.z + run / treads / 2 })
  ));

  const ang = Math.atan2(rise, run);
  const len = Math.hypot(rise, run);
  for (const side of [-1, 1]) {
    const str = new THREE.Mesh(
      new THREE.BoxGeometry(S.stringer, 0.34, len), painted(colors.stairSteel)
    );
    str.position.set(S.x + side * (S.width / 2 + S.stringer / 2), baseY + rise / 2 - 0.25, (S.z0 + S.z1) / 2);
    str.rotation.x = -ang;
    str.castShadow = true;
    group.add(str);

    const pickets = [];
    for (let t = 0.1; t < 1; t += 0.1) pickets.push(t);
    group.add(instanced(
      new THREE.BoxGeometry(0.028, S.railHeight, 0.028), painted(colors.picket),
      pickets, (t) => ({
        x: S.x + side * (S.width / 2 + S.stringer),
        y: baseY + rise * t + S.railHeight / 2,
        z: S.z1 - run * t,
      })
    ));
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.05, len), painted(colors.picket)
    );
    cap.position.set(S.x + side * (S.width / 2 + S.stringer), baseY + rise / 2 + S.railHeight, (S.z0 + S.z1) / 2);
    cap.rotation.x = -ang;
    group.add(cap);
  }

  /* The landing that carries the top of the flight across to the terrace
     edge, so the stair arrives somewhere instead of stopping in mid-air. */
  const land = new THREE.Mesh(
    new THREE.BoxGeometry(S.landing, 0.22, S.width), concrete(colors.deck)
  );
  land.position.set(S.x + S.landing / 2, topY - 0.11, S.z0);
  land.castShadow = true;
  group.add(land);
}

/* ------------------------------------------------------------- the ground */

function buildGround(section, group, ctx) {
  const { colors } = section;
  const ground = ctx.ground;

  const flat = (rects, color, rung) => {
    for (const r of rects) {
      const cx = (r.x0 + r.x1) / 2;
      const cz = (r.z0 + r.z1) / 2;
      const mesh = new THREE.Mesh(quad(r.x1 - r.x0, r.z1 - r.z0), decal(color, rung));
      mesh.position.set(cx, ground(cx, cz) + overlayLift(rung), cz);
      mesh.renderOrder = OVERLAY[rung].renderOrder;
      group.add(mesh);
    }
  };

  /* Sawn-jointed cast-in-place paving on three sides, at two different
     scales: the big 2.4 m slabs of the entry plaza in ad01, and the finer
     1.35 m court grid in ucsdmap. */
  const scored = (rects, pitch, width) => {
    const joints = [];
    for (const r of rects) {
      for (let x = Math.ceil(r.x0 / pitch) * pitch; x < r.x1; x += pitch) {
        joints.push({ x, z: (r.z0 + r.z1) / 2, w: width, d: r.z1 - r.z0 });
      }
      for (let z = Math.ceil(r.z0 / pitch) * pitch; z < r.z1; z += pitch) {
        joints.push({ x: (r.x0 + r.x1) / 2, z, w: r.x1 - r.x0, d: width });
      }
    }
    const m = instanced(quad(1, 1), decal(colors.pavingJoint, CARPET), joints,
      (j) => ({ x: j.x, y: ground(j.x, j.z) + overlayLift(CARPET), z: j.z, scale: [j.w, 1, j.d] }), false);
    m.renderOrder = OVERLAY[CARPET].renderOrder;
    group.add(m);
  };

  const N = section.north;
  const W = section.west;
  const S = section.south;

  flat(N.apron, colors.pavingBuff, PAD);
  scored(N.apron, N.jointPitch, N.jointWidth);
  flat(W.paving, colors.pavingBuff, PAD);
  scored(W.paving, W.jointPitch, W.jointWidth);
  flat(S.apron, colors.pavingBuff, PAD);
  scored(S.apron, N.jointPitch, N.jointWidth);

  /* The fine tan unit pavers on the north-west approach, laid in running
     bond — a different material from the court, not a different colour of
     the same one. */
  /* Running bond as JOINTS, not as one quad per paver. A quad per paver was
     1,600 instances in the same colour as the field beneath them — invisible,
     and the single most expensive thing this file drew. */
  flat(W.pavers, colors.unitPaver, PAD);
  scored(W.pavers, W.paverPitch * 2, 0.03);

  /* The lava-rock retaining wall along the measured grade break, and the
     groundcover spilling over it off the bank above. */
  buildLavaWall(section, group, ctx);
  flat(W.groundcover, colors.groundcover, CARPET);

  /* Dark picket railings along the court and ramp edges. */
  const posts = [];
  const caps = [];
  for (const r of W.railings) {
    const len = Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]);
    const ux = (r.b[0] - r.a[0]) / len;
    const uz = (r.b[1] - r.a[1]) / len;
    const rot = Math.atan2(-uz, ux);
    for (let t = W.railPicketPitch / 2; t < len; t += W.railPicketPitch) {
      posts.push({ x: r.a[0] + ux * t, z: r.a[1] + uz * t, rot });
    }
    caps.push({ x: (r.a[0] + r.b[0]) / 2, z: (r.a[1] + r.b[1]) / 2, rot, len });
  }
  group.add(instanced(new THREE.BoxGeometry(0.028, 1.05, 0.028), painted(colors.picket),
    posts, (p) => ({ x: p.x, y: ground(p.x, p.z) + 0.525, z: p.z, rot: p.rot }), false));
  group.add(instanced(new THREE.BoxGeometry(1, 0.05, 0.06), painted(colors.picket),
    caps, (c) => ({ x: c.x, y: ground(c.x, c.z) + 1.05, z: c.z, rot: c.rot, scale: [c.len, 1, 1] })));

  /* South: the 1.8 m walk running perpendicular out of the lower colonnade
     into the lawn, with a continuous planting bed on either side of it. */
  flat(S.lawn, colors.lawn, CARPET);
  flat(S.beds, colors.dg, CARPET);
  flat([{ x0: S.walk.x - S.walk.width / 2, x1: S.walk.x + S.walk.width / 2, z0: S.walk.z0, z1: S.walk.z1 }],
    colors.pavingBuff, PAINT);

  const cl = S.clumps;
  const tufts = [];
  for (let k = 0; k < cl.count; k++) {
    const bed = S.beds[k % S.beds.length];
    tufts.push({
      x: bed.x0 + hash(cl.seed, k, 1) * (bed.x1 - bed.x0),
      z: bed.z0 + hash(cl.seed, k, 2) * (bed.z1 - bed.z0),
      k,
    });
  }
  group.add(instanced(new THREE.ConeGeometry(cl.radius, cl.height, 5), foliage(colors.grassClump),
    tufts.filter((t) => hash(t.k, 7) >= S.shrubFraction),
    (t) => ({ x: t.x, y: ground(t.x, t.z) + cl.height / 2, z: t.z, rot: hash(t.k, 8) * Math.PI }), false));
  group.add(instanced(new THREE.SphereGeometry(cl.radius * 1.15, 6, 4), foliage(colors.shrubPink),
    tufts.filter((t) => hash(t.k, 7) < S.shrubFraction),
    (t) => ({ x: t.x, y: ground(t.x, t.z) + cl.radius, z: t.z }), false));

  /* The precast cylinder bins that stand either side of the entry doors. */
  const B = section.entry.bins;
  group.add(instanced(new THREE.CylinderGeometry(B.radius, B.radius * 0.94, B.height, 14),
    concrete(colors.bin), N.bins,
    (b) => ({ x: b.x, y: ground(b.x, b.z) + B.height / 2, z: b.z })));
  group.add(instanced(new THREE.CylinderGeometry(B.radius + 0.01, B.radius + 0.01, B.bandHeight, 14),
    painted(colors.binBand), N.bins.filter((b) => b.recycling),
    (b) => ({ x: b.x, y: ground(b.x, b.z) + B.height - B.bandHeight, z: b.z })));
}

/** Angular scoria rubble in courses under no coping, with lichen on some of
 *  it — the wall in ucsdmap.jpg is dark, dry-laid and capless. */
function buildLavaWall(section, group, ctx) {
  const L = section.west.lavaWall;
  const { colors } = section;
  const ground = ctx.ground;
  const len = Math.hypot(L.b[0] - L.a[0], L.b[1] - L.a[1]);
  const ux = (L.b[0] - L.a[0]) / len;
  const uz = (L.b[1] - L.a[1]) / len;
  const rot = Math.atan2(-uz, ux);
  const rocks = [];
  for (let r = 0; r < L.rows; r++) {
    const rowY = ((r + 0.5) * L.height) / L.rows;
    for (let t = L.rockStep / 2; t < len; t += L.rockStep) {
      const j = hash(L.seed, r, Math.round(t * 10));
      const x = L.a[0] + ux * t - uz * (j - 0.5) * 0.1;
      const z = L.a[1] + uz * t + ux * (j - 0.5) * 0.1;
      rocks.push({
        x, y: ground(x, z) + rowY, z,
        rot: rot + (j - 0.5) * 0.7,
        rotX: (hash(L.seed + 1, r, Math.round(t * 10)) - 0.5) * 0.3,
        scale: [L.rockStep * 1.12, (L.height / L.rows) * 1.15, L.thickness],
        tone: j < 0.4 ? "lavaRockRed" : "lavaRock",
        lichen: hash(L.seed + 2, r, Math.round(t * 10)) < L.lichenFraction,
      });
    }
  }
  const box = new THREE.BoxGeometry(1, 1, 1);
  for (const tone of ["lavaRock", "lavaRockRed"]) {
    group.add(instanced(box, rock(colors[tone]), rocks.filter((r) => r.tone === tone), (it) => it));
  }
  /* Yellow lichen as its own scatter of small patches, because a lichen-toned
     rock reads as a different rock and a patched one reads as lichen. */
  group.add(instanced(new THREE.BoxGeometry(0.22, 0.14, 0.04), rock(colors.lichen),
    rocks.filter((r) => r.lichen),
    (it) => ({ x: it.x, y: it.y, z: it.z, rot: it.rot, rotX: it.rotX }), false));
}

/* ------------------------------------------------------------------- api */

/**
 * Build Galbraith Hall's photo-sourced detail.
 *
 * `photo` is the loaded photo-detail document; this reads only its `galbraith`
 * section and returns `{ group, counts }` (empty and harmless if the section
 * is missing, so a half-wired boot still runs). `surfaceAt` — the height of
 * the DRAWN terrain triangle — seats everything that stands on the ground;
 * `heightAt` sets the roof datum, because that is what campus-massing.js used
 * to put the measured mass there and the two must not diverge by so much as a
 * coffer.
 */
export function createPhotoGalbraith(scene, { photo, heightAt, surfaceAt } = {}) {
  const group = new THREE.Group();
  group.name = "photo-galbraith";
  const section = photo?.galbraith;
  if (!section) {
    scene?.add(group);
    return { group, counts: {} };
  }
  const ground = surfaceAt || heightAt;
  const base = heightAt || surfaceAt;
  if (typeof ground !== "function" || typeof base !== "function") {
    throw new Error("campus-photo-galbraith: needs surfaceAt (or heightAt) to place on the ground");
  }

  /* Match campus-massing.js exactly: the mass sits on the MEDIAN ground under
     its ring, lifted if that would bury a high corner. Any other datum and
     every facade layer slides off the wall it hangs on. */
  const gs = section.ring.map(([x, z]) => base(x, z)).filter(Number.isFinite).sort((a, b) => a - b);
  const median = gs.length ? gs[Math.floor(gs.length / 2)] : 0;
  const highest = gs.length ? gs[gs.length - 1] : 0;
  const roofY = Math.max(median + section.measured.lidarHeight, highest);

  const LV = section.levels;
  const ctx = {
    ground,
    roofY,
    eavesY: roofY - LV.eavesBelowRoof,
    soffitY: roofY - LV.soffitBelowRoof,
    l2Y: roofY - LV.l2BelowRoof,
    l1Y: roofY - LV.l1BelowRoof,
  };
  const bins = {
    struts: [], brackets: [],
    dripCap: [], fascia: [], birdSpike: [], needles: [],
    cofferPan: [], ribAcross: [], ribAlong: [], ribBoss: [], solidStrip: [], downlight: [],
    glass: [], mullion: [], spandrel: [],
    deck: [], redBand: [], picket: [], railCap: [],
    lowerColumn: [], lowerGlass: [], flutedWall: [], flute: [], doorBronze: [],
  };

  const frames = new Map();
  for (const f of section.faces) {
    const frame = frameOf(f);
    frames.set(f.id, frame);
    collectRoofEdge(section, f, frame, ctx, bins);
    collectSoffit(section, f, frame, ctx, bins);
    if (f.colonnade) collectStruts(section, f, frame, ctx, bins);
    if (f.glazing) collectGlazing(section, f, frame, ctx, bins);
    if (f.balcony && !f.terrace) collectDeck(section, f, frame, ctx, bins, section.facade.balcony, ctx.l2Y, null);
    if (f.terrace) {
      collectDeck(section, f, frame, ctx, bins, section.facade.terrace, ctx.l2Y,
        f.redBand ? section.facade.terrace.redBand : null);
    }
    if (f.lowerColonnade) collectLowerColonnade(section, f, frame, ctx, bins);
    if (f.flutedWall) collectFlutedWall(section, f, frame, ctx, bins);
  }

  const { colors } = section;
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const plane = new THREE.PlaneGeometry(1, 1);
  const add = (geo, mat, items, shadow = true) => {
    if (items.length) group.add(instanced(geo, mat, items, (it) => it, shadow));
  };

  /* The soffit, from the recess back downward, so the pale rib grid always
     wins the depth test against the darker pan field behind it. */
  add(unit, soffit(colors.cofferPan), bins.cofferPan);
  add(unit, soffit(colors.soffitRib), bins.ribAcross);
  add(unit, soffit(colors.soffitRib), bins.ribAlong);
  add(new THREE.CylinderGeometry(section.soffit.ribWidth / 2 + section.soffit.fillet,
    section.soffit.ribWidth / 2 + section.soffit.fillet, 1, section.soffit.filletSegments),
    soffit(colors.soffitRib), bins.ribBoss, false);
  add(unit, soffit(colors.soffitRib), bins.solidStrip);
  add(unit, concrete(colors.fascia), bins.fascia);
  add(unit, metal(colors.dripCap), bins.dripCap);
  add(unit, concrete(colors.birdSpike), bins.birdSpike);
  add(new THREE.BoxGeometry(0.012, 1, 0.012), metal(colors.birdSpike), bins.needles, false);
  add(new THREE.CylinderGeometry(section.soffit.lightRadius, section.soffit.lightRadius,
    section.soffit.lightHeight, 10), painted(colors.downlight), bins.downlight, false);

  /* The struts. One lathe per distinct height would be one geometry per
     column, so they share a unit-height lathe and take their height from the
     instance scale — the profile is preserved because the scale is uniform in
     the two horizontal axes and only stretches the vertical. */
  const strutGeo = strutGeometry(section.column.profile, 1);
  if (bins.struts.length) {
    group.add(instanced(strutGeo, concrete(colors.column), bins.struts,
      (it) => ({ ...it, scale: [1, it.height, 1] })));
  }
  add(unit, concrete(colors.columnHead), bins.brackets);

  add(unit, concrete(colors.spandrel), bins.spandrel);
  add(plane, glassMat(colors.glass), bins.glass);
  add(unit, painted(colors.mullion), bins.mullion);
  add(unit, concrete(colors.deck), bins.deck);
  add(unit, painted(colors.terraceRed), bins.redBand);
  add(unit, painted(colors.picket), bins.picket, false);
  add(unit, painted(colors.picket), bins.railCap, false);
  add(unit, concrete(colors.lowerColumn), bins.lowerColumn);
  add(plane, glassMat(colors.glassLower), bins.lowerGlass);
  add(unit, concrete(colors.flutedPanel), bins.flutedWall);
  add(unit, concrete(colors.flutedPanel), bins.flute, false);
  add(unit, painted(colors.doorBronze), bins.doorBronze);

  const north = section.faces.find((f) => f.entry);
  if (north) buildEntry(section, group, frames.get(north.id), north, ctx);
  buildStair(section, group, ctx);
  buildGround(section, group, ctx);

  scene?.add(group);
  return {
    group,
    counts: {
      faces: section.faces.length,
      struts: bins.struts.length,
      coffers: bins.ribBoss.length,
      downlights: bins.downlight.length,
      pickets: bins.picket.length,
      lowerColumns: bins.lowerColumn.length,
      absent: section.absent.length,
      draws: group.children.length,
    },
  };
}
