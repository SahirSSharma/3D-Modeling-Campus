// Survivance Hall and the Market Hall wing, Eighth College (TDLLN) — the
// INVENTED class.
//
// HKS with EYRC, SWA landscape, Walter P Moore structure, Kitchell GC;
// occupied 2023, complete 2024, photographed 2024-25. Two survey masses carry
// the SAME facilities name and must never be merged: campus-arcgis.json
// massing[464] is the 11-storey tower, massing[462] is the Dining Hall /
// Market Hall wing. Both rings are copied verbatim (decimetres / 10) into the
// section's `measured` block and every datum in this file solves off them.
//
// Six findings decided the shape of this file.
//
//   1. THE 2014 LiDAR IS BLIND HERE. campus-lidar.json carries no massHeight
//      for either ring — the survey flight measured a parking lot. Nothing in
//      this module reads a LiDAR height, and nothing may. The prism is the
//      facilities GIS ring and its GIS `h`, which is what campus-massing.js
//      extrudes on screen.
//
//   2. THE DRAWN PRISM WINS, AND IT IS 3.1 m SHORT. UC San Diego's own CEQA
//      Addendum No. 5 (2020-09-01, Table 2.5-1) publishes 120 ft = 36.58 m to
//      roof top for Building 3, and phf26 corroborates it. massing[464].h is
//      33.5 m — exactly 11 x 3.048, the levels x 10 ft formula. But York's
//      2026-08-17 audit failure was a skin solved on a taller claim than the
//      drawn box: the membrane floated 6 m over the drawn parapet and the
//      arcade was buried. So every datum here solves on 33.5 / 11 = 3.045 m,
//      the published 36.58 m is recorded as a declared SOURCE CONFLICT, and
//      every figure that was MEASURED against the published 3.325 m storey
//      ships as the PROPORTION or the ANGLE it really is, re-solved on the
//      storey that is actually drawn.
//
//   3. THE PRISM IS SOLID, SO EVERY LAYER IS MEASURED OUTWARD FROM IT. This is
//      the rule round one broke in eleven places at once — glass at -0.06 m,
//      L11 terraces at -6.15 m, storefront at -0.10 m, brick at -0.35 m — all
//      of it drawn inside a mass campus-massing.js fills. `wall.standoff` is
//      the innermost plane anything may occupy; the panel face is standoff +
//      panelDepth proud; a punched opening is recessed BEHIND the panel face
//      and is still proud of the prism. Nothing in this file is ever placed at
//      a negative offset from a ring, and the test re-derives that from the
//      built instances rather than from the data.
//
//   4. THE TOWER RING LIES ENTIRELY INSIDE THE WING RING. Every one of the
//      tower's six segments has its midpoint inside massing[462], so the
//      tower's own two lowest storeys are inside the wing prism and NO tower
//      facade is emitted below the wing lid — nor are the L2 and L3 balconies.
//      It is also why the podium band, the storefront and the broad flat canopy
//      are built on the WING perimeter, and why the wing roof plate is a filled
//      polygon with the TOWER RING PUNCHED OUT as a hole.
//
//   5. THE SIGNATURE MOVE IS ONE MECHANISM, NOT TWO. gbd magazine publishes
//      it: the windows are "popped out and rotated six degrees" for airflow.
//      The rotation exposes a return jamb, the jamb is marigold, and the
//      photographed 6.8 deg lean ships as a shear of the WHOLE STOREY GRID —
//      openings, panel field and boxes together. Round one leaned the boxes and
//      left their openings behind, which cost 278 unglazed holes. At both ends
//      of a face the sheared grid is CLIPPED to the surveyed face and the strip
//      it leaves is closed with blank panel.
//
//   6. NO ROOFTOP PV. The 2021 renderings drew large PV fields on the Eighth
//      roofs; three independent built frames (phf15 near-nadir, SWA Learning-1,
//      phf17) agree this deck carries white membrane, a parapet, two
//      penthouses, ducts and RTUs and nothing else — with Keeling's own
//      rooftop PV plainly visible in the very same phf15 frame as the control.
//      It ships as a declared `absent` entry, not as silence.
//
// Colours are DATA — every hex comes from the `colors` block of the photo
// document's `survivance` section, with per-role provenance in `colorSources`.
// So is every DIMENSION: each load-bearing figure carries an entry in
// `dimensionSources` with its tier and its arithmetic, and this file contains
// no numeric literal that decides how anything looks. What is deliberately NOT
// here is the section's `absent` list.
//
// Surfaces come from the procedural material library (campus-materials.js).
// Deterministic: no Math.random, no Date and no pseudo-random source anywhere —
// every placement is a closed-form function of the surveyed rings and the
// section's own figures.
import * as THREE from "../vendor/three/three.module.min.js";
import { createMaterialLibrary } from "./campus-materials.js";

/* One material library for the whole module, created on first build. */
let LIB = null;
const lib = () => (LIB ??= createMaterialLibrary(THREE));

/* Flat metal / composite rainscreen: the tower's whole field. */
const panelMat = (color) =>
  lib().get("metalPanel", { color, metalness: 0.22, roughness: 0.62 });
/* Charcoal architectural metal: brow fascia, copings, mullions. */
const darkMetal = (color) =>
  lib().get("metalPanel", { color, metalness: 0.45, roughness: 0.48 });
/* Bare pale metal: pickets, guard caps, applied letters. */
const bareMetal = (color) =>
  lib().get("metalPanel", { color, metalness: 0.7, roughness: 0.35 });
const glassMat = (color) => lib().get("glass", { color });
const brickMat = (color, w, h) =>
  lib().get("brick", { color, normalScale: 0.7, repeat: [w / 1.624, h / 1.624] });
const concrete = (color) => lib().get("smoothConcrete", { color });
const membraneMat = (color, w, d) =>
  lib().get("roofMembrane", { color, repeat: [w / 6, d / 6] });
/* The concealed LED cove, the balcony soffit downlights and the festoon: no
   night source exists in this scene, so they are emissive geometry only. */
const lampMat = (color) =>
  new THREE.MeshStandardMaterial({
    color, emissive: new THREE.Color(color), emissiveIntensity: 0.85,
    roughness: 0.4, metalness: 0,
  });

/**
 * One InstancedMesh from a list of placements. `place` returns
 * `{ x, y, z, rot?, rotX?, rotZ?, scale? }`; `rot` is about Y and is applied
 * first, then `rotX`, then `rotZ` — so a box laid along a face can also be
 * tilted within that face's own vertical plane, which is what a festoon cord
 * hanging between two lamps needs.
 */
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

/* ---------------------------------------------------------------- rings */

/** Drop a ring's repeated closing vertex, if it carries one. */
function openRing(ring) {
  const r = ring.map((p) => [p[0], p[1]]);
  const [f, l] = [r[0], r[r.length - 1]];
  if (r.length > 2 && f[0] === l[0] && f[1] === l[1]) r.pop();
  return r;
}

const centroidOf = (ring) => [
  ring.reduce((s, p) => s + p[0], 0) / ring.length,
  ring.reduce((s, p) => s + p[1], 0) / ring.length,
];

/**
 * Outward unit normal of segment i of an open ring, decided by stepping off
 * the segment's midpoint and asking the ring itself which side is out.
 * A centroid test — which is what this was — is only correct on a CONVEX ring,
 * and the wing's 16-vertex ring is not convex: it has a deep notch on its
 * east side, and for the two segments that form it the centroid lies on the
 * OUTSIDE. That put the podium band, the piers and the storefront of those two
 * segments facing into the building.
 */
function normalOf(ring, i) {
  const [ax, az] = ring[i];
  const [bx, bz] = ring[(i + 1) % ring.length];
  const len = Math.hypot(bx - ax, bz - az) || 1;
  let nx = (bz - az) / len;
  let nz = -(bx - ax) / len;
  const mx = (ax + bx) / 2;
  const mz = (az + bz) / 2;
  if (inRing(mx + nx * 0.01, mz + nz * 0.01, ring)) { nx = -nx; nz = -nz; }
  return [nx, nz];
}

/**
 * A face's own coordinate frame from two ring vertices. `at(u, w, y)` is u
 * metres along the face from its start, w metres PROUD of it, y in world
 * height. w is never negative anywhere in this file: the drawn prism is solid.
 */
function frameOf(a, b, out) {
  const nx = out[0];
  const nz = out[1];
  const tx = nz;
  const tz = -nx;
  let sx = a[0], sz = a[1], ex = b[0], ez = b[1];
  if ((ex - sx) * tx + (ez - sz) * tz < 0) {
    sx = b[0]; sz = b[1]; ex = a[0]; ez = a[1];
  }
  return {
    length: Math.hypot(ex - sx, ez - sz),
    rot: Math.atan2(nx, nz),
    at: (u, w, y) => ({ x: sx + tx * u + nx * w, y, z: sz + tz * u + nz * w }),
  };
}

/**
 * MITRE-offset a closed ring outward by d. Each vertex moves along the
 * bisector of its two edge normals by d / (1 + n1·n2) x |n1+n2| — the exact
 * mitre — so the offset ring FOLDS where the survey ring folds and no corner
 * opens a gap. This is what makes the brow one continuous plane over the
 * dog-leg instead of six plates with holes at the kinks.
 */
function miterOffset(ring, d) {
  const n = ring.length;
  const norms = ring.map((_, i) => normalOf(ring, i));
  const out = [];
  for (let i = 0; i < n; i++) {
    const [ax, az] = norms[(i - 1 + n) % n];
    const [bx, bz] = norms[i];
    const mx = ax + bx;
    const mz = az + bz;
    const dot = 1 + (ax * bx + az * bz);
    const k = dot > 1e-6 ? d / dot : d;
    out.push([ring[i][0] + mx * k, ring[i][1] + mz * k]);
  }
  return out;
}

/**
 * A filled horizontal polygon (optionally with holes), lying in the XZ plane.
 * ShapeGeometry builds in XY; rotating +90 deg about X maps the shape's own Y
 * straight onto world Z, so ring coordinates feed in unchanged. The rotation
 * flips the winding, so every plate is DOUBLE-SIDED — which is what a thin
 * roof plane wants anyway: the same geometry serves as deck from above and as
 * soffit from below.
 */
function plateGeometry(outer, holes = []) {
  const shape = new THREE.Shape(outer.map(([x, z]) => new THREE.Vector2(x, z)));
  for (const h of holes) {
    shape.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, z))));
  }
  const g = new THREE.ShapeGeometry(shape);
  g.rotateX(Math.PI / 2);
  return g;
}

/** A shared library material, cloned double-sided for a thin plate. */
function plateMat(mat) {
  const m = mat.clone();
  m.side = THREE.DoubleSide;
  return m;
}

/** Ray-cast point-in-ring, on an OPEN ring. */
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
 * campus-massing.js roofElevation, reproduced EXACTLY: the rim-median ground
 * under the measured ring plus the height it draws, lifted if that would bury
 * a high corner. This is the one datum the whole building seats on, and it
 * must not diverge from what the massing extrudes by so much as a centimetre.
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

const bboxOf = (ring) => ({
  x0: Math.min(...ring.map((p) => p[0])),
  x1: Math.max(...ring.map((p) => p[0])),
  z0: Math.min(...ring.map((p) => p[1])),
  z1: Math.max(...ring.map((p) => p[1])),
});

/* ------------------------------------------------------- the tower faces */

/**
 * One face's whole elevation. The bay grid of a LEANING face is sheared
 * sideways by `step` metres per storey — openings, panel field, jambs and
 * marigold boxes together — and clipped to the surveyed face at both ends, the
 * clipped strip closed with blank panel so no hole is ever left unglazed.
 * Nothing is emitted below `occl.lid`, because the tower's lowest storeys are
 * inside the wing prism.
 */
function collectFace(S, face, frame, geo, bins, occl) {
  const { base, F, storeys } = geo;
  const W = S.wall;
  const WIN = S.window;
  const MG = S.marigold;
  const { length, rot } = frame;
  const bays = face.bays;
  const bw = length / bays;
  const panelMid = W.standoff + W.panelDepth / 2;
  const panelFace = W.standoff + W.panelDepth;

  const winH = F * WIN.heightFraction;
  const sill = F * WIN.sillFraction;
  const head = F - sill - winH;
  const leans = face.marigold !== "none";
  /* The ribbon's lean is an ANGLE, so it re-solves on the drawn storey. */
  const step = leans ? F * Math.tan((MG.leanDeg * Math.PI) / 180) : 0;
  const slots = new Set(face.slotBays || []);
  const boxW = WIN.width + 2 * MG.jambWidth;
  const isMarigold = (b) =>
    b >= 0 && !slots.has(b) &&
    (face.marigold === "every" || (face.marigold === "alternate" && b % 2 === 0));

  /* A course whose FOOT is below the wing lid is inside the wing prism, so it
     is not emitted at all. The rule is exact, not tolerant: the "nothing is
     drawn inside a solid prism" gate is exact too, and a tolerance here would
     leave that many centimetres of buried geometry for it to catch. */
  const hidden = (yFoot) => occl.inside && yFoot < occl.lid;

  /* Floor-line reveals: a continuous shadow gap at every slab line, recessed
     into the panel face rather than cut back to the prism. */
  for (let lv = 0; lv <= storeys; lv++) {
    const y = base + lv * F;
    if (hidden(y)) continue;
    bins.reveals.push({
      ...frame.at(length / 2, panelFace - W.reveal.depth / 2, y),
      rot,
      scale: [length, W.reveal.height, W.reveal.depth],
    });
  }

  /* The window rows. Storey 11 is the conference ribbon; grid.windowRows
     counts the rest, and phf19 counts ten of them on the east end. */
  const rows = Math.min(S.grid.windowRows, storeys - 1);
  for (let lv = 0; lv < rows; lv++) {
    const y0 = base + lv * F;
    if (hidden(y0)) continue;
    const shear = lv * step;
    /* b = -1 catches the strip the shear opens at the start of the face. */
    for (let b = -1; b < bays; b++) {
      const uc = (b + 0.5) * bw + shear;
      const c0 = Math.max(0, uc - bw / 2);
      const c1 = Math.min(length, uc + bw / 2);
      const cLen = c1 - c0;
      if (cLen < 0.05) continue;
      const cMid = (c0 + c1) / 2;
      const mg = isMarigold(b);
      const holeW = slots.has(b) ? WIN.slotWidth : mg ? boxW : WIN.width;
      const fits = b >= 0 && uc - holeW / 2 >= c0 + 0.15 && uc + holeW / 2 <= c1 - 0.15;

      if (!fits) {
        /* CLIPPED: the sheared grid has walked past a surveyed corner. The bay
           closes as blank panel — never as a hole, and never wrapped. */
        bins.panels.push({
          ...frame.at(cMid, panelMid, y0 + F / 2),
          rot, scale: [cLen, F, W.panelDepth],
        });
        if (mg) bins.clipped++;
        continue;
      }

      /* Panel field around the opening: sill band, head band and the two
         jambs that remain either side of it inside this bay. */
      bins.panels.push({
        ...frame.at(cMid, panelMid, y0 + sill / 2),
        rot, scale: [cLen, sill, W.panelDepth],
      });
      bins.panels.push({
        ...frame.at(cMid, panelMid, y0 + sill + winH + head / 2),
        rot, scale: [cLen, head, W.panelDepth],
      });
      for (const [ja, jb] of [[c0, uc - holeW / 2], [uc + holeW / 2, c1]]) {
        const jw = jb - ja;
        if (jw < 0.02) continue;
        bins.panels.push({
          ...frame.at((ja + jb) / 2, panelMid, y0 + sill + winH / 2),
          rot, scale: [jw, winH, W.panelDepth],
        });
      }

      const cy = y0 + sill + winH / 2;
      if (!mg) {
        /* A flush punched opening: glass recessed behind the panel face in a
           shallow reveal, with a thin dark surround. */
        bins.glass.push({
          ...frame.at(uc, panelFace - WIN.reveal, cy),
          rot, scale: [holeW - 2 * WIN.frame, winH - 2 * WIN.frame, 1],
        });
        for (const [fw, fh, du, dy] of [
          [holeW, WIN.frame, 0, (winH - WIN.frame) / 2],
          [holeW, WIN.frame, 0, -(winH - WIN.frame) / 2],
          [WIN.frame, winH, (holeW - WIN.frame) / 2, 0],
          [WIN.frame, winH, -(holeW - WIN.frame) / 2, 0],
        ]) {
          bins.mullions.push({
            ...frame.at(uc + du, panelFace - WIN.reveal + WIN.frame, cy + dy),
            rot, scale: [fw, fh, WIN.frame],
          });
        }
        continue;
      }

      /* THE ROTATED MARIGOLD BAY, popped out of the PANEL FACE and turned six
         degrees. The return jamb it exposes is the box's own side, which is
         why jambWidth and popOut are one figure. */
      const turn = rot + MG.rotation;
      bins.marigoldBoxes.push({
        ...frame.at(uc, panelFace + MG.popOut / 2, cy),
        rot: turn, scale: [boxW, winH, MG.popOut],
      });
      bins.marigoldJambs.push({
        ...frame.at(uc + boxW / 2 - MG.jambWidth / 2, panelFace + MG.popOut / 2 + 0.01,
          y0 + F / 2),
        rot: turn, scale: [MG.jambWidth, F, MG.popOut + 0.02],
      });
      bins.glass.push({
        ...frame.at(uc, panelFace + MG.popOut - 0.03, cy),
        rot: turn, scale: [boxW - 2 * MG.jambWidth, winH - 0.12, 1],
      });
    }
  }

  /* Level 11: the continuous teal conference band, on every face. The three
     sourced terraces are NOT built — a terrace is a void and the drawn prism
     is solid. See the section's l11.builtNote and `absent`. */
  collectRibbon(S, frame, base + (storeys - 1) * F, F, bins);
}

/** The continuous teal Level 11 conference band, mullions and spandrel. */
function collectRibbon(S, frame, y, F, bins) {
  const R = S.ribbon;
  const W = S.wall;
  const { length, rot } = frame;
  const panelFace = W.standoff + W.panelDepth;
  const bandH = F - R.spandrel;
  bins.ribbonGlass.push({
    ...frame.at(length / 2, panelFace - R.recess, y + R.spandrel + bandH / 2),
    rot, scale: [length - 0.1, bandH, 1],
  });
  bins.panels.push({
    ...frame.at(length / 2, W.standoff + W.panelDepth / 2, y + R.spandrel / 2),
    rot, scale: [length, R.spandrel, W.panelDepth],
  });
  const n = Math.max(1, Math.round(length / R.mullionPitch));
  for (let i = 0; i <= n; i++) {
    bins.mullions.push({
      ...frame.at((i / n) * length, panelFace - R.recess + R.mullionWidth / 2,
        y + R.spandrel + bandH / 2),
      rot, scale: [R.mullionWidth, bandH, R.mullionWidth],
    });
  }
  bins.ribbonFaces++;
}

/* ------------------------------------------------------------- the brow */

/**
 * THE BROW: one thin planar roof oversailing the whole building at Level 11
 * head height, folding at both plan kinks. Built as a MITRED ANNULUS off the
 * surveyed ring — the folds are the ring's own folds. Charcoal fascia, ribbed
 * soffit, a continuous concealed cove. The west cantilever and its columns are
 * NOT here: they land on an L11 terrace slab that cannot be built inside a
 * solid prism, and a column standing on nothing is worse than an absent one.
 */
function buildBrow(S, group, ring, geo, bins) {
  const B = S.brow;
  const C = S.colors;
  const lid = geo.lid;
  const outer = miterOffset(ring, B.projection);
  const soffitY = lid - B.fasciaHeight;
  /* The plate meets the RAINSCREEN FACE, not the structural prism: its hole is
     the ring offset by the skin, so no vertex lands on or inside the mass. */
  const skin = S.wall.standoff + S.wall.panelDepth;
  const inner = miterOffset(ring, skin);

  group.add(new THREE.Mesh(plateGeometry(outer, [inner]),
    plateMat(darkMetal(C.browFascia))).translateY(lid));
  const soffit = new THREE.Mesh(plateGeometry(outer, [inner]), plateMat(panelMat(C.browSoffit)));
  soffit.position.y = soffitY + B.ribDepth;
  group.add(soffit);

  const fascias = [];
  const ribs = [];
  const coves = [];
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i];
    const b = outer[(i + 1) % outer.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.2) continue;
    const [nx, nz] = normalOf(outer, i);
    const rot = Math.atan2(nx, nz);
    const f = frameOf(a, b, [nx, nz]);
    fascias.push({
      ...f.at(len / 2, -B.fasciaThickness / 2, lid - B.fasciaHeight / 2),
      rot, scale: [len, B.fasciaHeight, B.fasciaThickness],
    });
    /* Ribs run out under the soffit, perpendicular to the fascia, from the
       rainscreen face to the fascia — never back into the mass. */
    const ribRun = B.projection - skin;
    for (let u = B.ribPitch / 2; u < len; u += B.ribPitch) {
      ribs.push({
        ...f.at(u, -ribRun / 2, soffitY + B.ribDepth / 2),
        rot, scale: [B.ribDepth, B.ribDepth, ribRun],
      });
    }
    /* The concealed cove, tight behind the fascia, that outlines the whole
       building in one warm line at night. */
    coves.push({
      ...f.at(len / 2, -B.fasciaThickness - B.coveSection / 2, soffitY + B.coveDrop),
      rot, scale: [len - 0.2, B.coveSection, B.coveSection],
    });
  }
  const unit = new THREE.BoxGeometry(1, 1, 1);
  group.add(instanced(unit, darkMetal(C.browFascia), fascias));
  group.add(instanced(unit, panelMat(C.browSoffit), ribs));
  group.add(instanced(unit, lampMat(C.coveLight), coves));
  bins.counts.browFascias = fascias.length;
  bins.counts.browRibs = ribs.length;
  bins.counts.browColumns = 0;
}

/* ------------------------------------------------------------- the roof */

function buildRoof(S, group, ring, geo, bins) {
  const R = S.roof;
  const C = S.colors;
  const lid = geo.lid;
  const unit = new THREE.BoxGeometry(1, 1, 1);

  /* Membrane, clipped to the surveyed ring as a filled polygon — a bounding
     box would oversail the kink into open air. It stops at the parapet's
     inner face, which is what `membrane.inset` is. */
  const inner = miterOffset(ring, -R.membrane.inset);
  const bb = bboxOf(inner);
  group.add(new THREE.Mesh(
    plateGeometry(inner),
    plateMat(membraneMat(C.roofMembrane, bb.x1 - bb.x0, bb.z1 - bb.z0))
  ).translateY(lid + 0.02));

  /* Parapet standing ON the drawn lid, outer face on the ring line, with its
     thin dark coping — the continuous charcoal line phf15 reads. */
  const P = R.parapet;
  const bands = [];
  const copes = [];
  const anchors = [];
  const A = R.anchors;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.2) continue;
    const [nx, nz] = normalOf(ring, i);
    const rot = Math.atan2(nx, nz);
    const f = frameOf(a, b, [nx, nz]);
    bands.push({
      ...f.at(len / 2, -P.thickness / 2, lid + P.height / 2),
      rot, scale: [len, P.height, P.thickness],
    });
    copes.push({
      ...f.at(len / 2, -P.thickness / 2, lid + P.height + P.copingHeight / 2),
      rot, scale: [len, P.copingHeight, P.thickness + 2 * P.copingOverhang],
    });
    /* Fall-arrest / tie-off studs at the OSHA unprotected-edge distance. */
    for (let u = A.pitch / 2; u < len; u += A.pitch) {
      anchors.push({
        ...f.at(u, -A.inset, lid + A.height / 2),
        rot, scale: [A.width, A.height, A.width],
      });
    }
  }
  group.add(instanced(unit, panelMat(C.wallPanel), bands));
  group.add(instanced(unit, darkMetal(C.coping), copes));
  group.add(instanced(unit, bareMetal(C.railMetal), anchors));
  bins.counts.parapetSegments = bands.length;
  bins.counts.roofAnchors = anchors.length;

  /* Two penthouses, both at the plan kink where phf15 shows them: the taller
     lift overrun in the same pale panel as the walls, and the lower, longer
     louvred plant enclosure beside it. */
  const houses = [];
  const louvres = [];
  for (const p of R.penthouses) {
    houses.push({ x: p.x, y: lid + p.size[1] / 2, z: p.z, scale: p.size });
    if (!p.louvred) continue;
    for (let y = p.louvrePitch; y < p.size[1] - 0.15; y += p.louvrePitch) {
      for (const s of [1, -1]) {
        louvres.push({
          x: p.x, y: lid + y, z: p.z + s * (p.size[2] / 2 + 0.03),
          scale: [p.size[0] - 0.3, p.louvrePitch * 0.55, 0.08],
        });
      }
    }
  }
  group.add(instanced(unit, panelMat(C.penthousePanel), houses));
  group.add(instanced(unit, darkMetal(C.roofEquipment), louvres));
  bins.counts.penthouses = houses.length;

  /* The mechanical field: boxy RTUs, small cylindrical exhaust fans and two
     duct/tray runs. The COUNT is what phf15 resolves; each footprint is
     [estimated] and every one is placed clear of the parapet. */
  const boxes = R.mech.filter((m) => m.kind !== "fan");
  const fans = R.mech.filter((m) => m.kind === "fan");
  group.add(instanced(unit, darkMetal(C.roofEquipment),
    boxes.map((m) => ({ x: m.x, y: lid + m.size[1] / 2, z: m.z, scale: m.size }))));
  group.add(instanced(new THREE.CylinderGeometry(1, 1, 1, 12), darkMetal(C.roofEquipment),
    fans.map((m) => ({
      x: m.x, y: lid + m.height / 2, z: m.z,
      scale: [m.radius, m.height, m.radius],
    }))));
  bins.counts.mech = R.mech.length;
  /* PV: ZERO. See the section's roof.pv and `absent` — three built frames
     refute the 2021 rendering, with Keeling's own array as the control. */
  bins.counts.pv = 0;
}

/* --------------------------------------------------------- the balconies */

/**
 * The stacked balcony column at the WEST end of the south face: projecting
 * trapezoidal slabs, picket guard on the outer edge only, a lit soffit under
 * each, and a full-height glazed sliding door behind. Nine are sourced; only
 * those CLEAR OF THE WING PRISM are built — L2 and L3 land at or under the
 * wing's drawn lid and would be buried. See `absent`.
 */
function buildBalconies(S, group, ring, geo, bins, occl) {
  const B = S.balconies;
  const C = S.colors;
  const face = S.faces.find((f) => f.id === B.face);
  if (!face) return;
  const [nx, nz] = normalOf(ring, face.seg);
  const f = frameOf(ring[face.seg], ring[(face.seg + 1) % ring.length], [nx, nz]);
  const rot = Math.atan2(nx, nz);
  /* `fromEnd: "a"` is the frame's u=0 end — the west end wall. */
  const uc = B.fromEnd === "a" ? 0.6 + B.width / 2 : f.length - 0.6 - B.width / 2;
  const panelFace = S.wall.standoff + S.wall.panelDepth;

  const slabs = [];
  const rails = [];
  const pickets = [];
  const doors = [];
  const lights = [];
  let buried = 0;
  for (const lv of B.levels) {
    const y = geo.base + (lv - 1) * geo.F;
    if (occl.inside && y < occl.lid) { buried++; continue; }
    /* The slab starts at the RAINSCREEN FACE and projects its measured depth
       from there, so no corner of it is ever inside the drawn prism. */
    slabs.push({
      ...f.at(uc, panelFace + B.projection / 2, y + B.slabThickness / 2),
      rot, scale: [B.width, B.slabThickness, B.projection],
    });
    /* Guard on the OUTER edge only, exactly as photographed. */
    const edge = panelFace + B.projection - B.cap.depth / 2;
    rails.push({
      ...f.at(uc, edge, y + B.slabThickness + B.guardHeight - B.cap.height / 2),
      rot, scale: [B.width, B.cap.height, B.cap.depth],
    });
    const n = Math.max(2, Math.round(B.width / B.picketPitch));
    for (let i = 0; i <= n; i++) {
      pickets.push({
        ...f.at(uc - B.width / 2 + (i / n) * B.width, edge,
          y + B.slabThickness + B.guardHeight / 2),
        rot, scale: [B.picketWidth, B.guardHeight, B.picketWidth],
      });
    }
    doors.push({
      ...f.at(uc, panelFace - S.window.reveal,
        y + B.slabThickness + (geo.F - B.slabThickness) / 2),
      rot, scale: [B.doorWidth, geo.F - B.slabThickness - 0.2, 1],
    });
    lights.push({
      ...f.at(uc, panelFace + B.projection * 0.6, y - B.soffitLight.depth / 2),
      scale: [B.soffitLight.diameter, B.soffitLight.depth, B.soffitLight.diameter],
    });
  }
  const unit = new THREE.BoxGeometry(1, 1, 1);
  group.add(instanced(unit, concrete(C.wallPanel), slabs));
  group.add(instanced(unit, bareMetal(C.railMetal), rails));
  group.add(instanced(unit, bareMetal(C.railMetal), pickets));
  group.add(instanced(new THREE.PlaneGeometry(1, 1), glassMat(C.windowGlass), doors));
  group.add(instanced(unit, lampMat(C.coveLight), lights));
  bins.counts.balconies = slabs.length;
  bins.counts.balconiesBuried = buried;
  bins.counts.balconyPickets = pickets.length;
}

/* ------------------------------------------- the wing: podium and roof */

/**
 * The Dining Hall / Market Hall wing. It carries the podium for the WHOLE
 * building — brick plinth and piers, tall storefront, the broad flat canopy
 * following the zigzag — because the tower ring lies entirely inside it. Every
 * layer is measured OUTWARD from the drawn prism, and the whole base is set out
 * on one product module: 45 modular brick courses to the storey, 6 + 36 + 3.
 */
function buildWing(S, group, wingRing, towerRing, wg, ground, bins) {
  const P = S.podium;
  const C = S.colors;
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const plane = new THREE.PlaneGeometry(1, 1);
  const bricks = [];
  const piers = [];
  const sfGlass = [];
  const sfMullions = [];
  const headers = [];
  const canopyPlates = [];
  const canopyFascias = [];
  const canopySoffits = [];
  const l2Panels = [];
  const clerestory = [];
  const canopyOn = new Set(P.canopy.segments);
  const bandFace = S.wall.standoff + P.bandDepth;
  const canopyY = new Map();

  for (const wf of S.wing.faces) {
    const i = wf.seg;
    const a = wingRing[i];
    const b = wingRing[(i + 1) % wingRing.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.25) continue;
    const [nx, nz] = normalOf(wingRing, i);
    const rot = Math.atan2(nx, nz);
    const f = frameOf(a, b, [nx, nz]);

    /* The brick band skirts to the LOWEST drawn ground along this segment, so
       the exposed height varies with the falling site and no ground ever
       passes under the building. */
    let gLo = Infinity;
    for (let k = 0; k <= 4; k++) {
      const p = f.at((k / 4) * len, 0, 0);
      const g = ground(p.x, p.z);
      if (Number.isFinite(g)) gLo = Math.min(gLo, g);
    }
    if (!Number.isFinite(gLo)) gLo = wg.base;
    const foot = Math.min(gLo, wg.base) - P.bury;
    const plinthTop = wg.base + P.plinthHeight;
    bricks.push({
      ...f.at(len / 2, S.wall.standoff + P.bandDepth / 2, (foot + plinthTop) / 2),
      rot, scale: [len, plinthTop - foot, P.bandDepth],
    });

    /* Piers land on the bay module, but a pier centred on a ring VERTEX would
       hang half its width past the corner — and this ring turns inward at two
       of them, which would push the overhang inside the wing prism. Every pier
       is kept whole within its own segment. */
    const nP = Math.max(1, Math.round(len / P.pierPitch));
    if (len > P.pierWidth) {
      for (let k = 0; k <= nP; k++) {
        const u = Math.min(Math.max((k / nP) * len, P.pierWidth / 2), len - P.pierWidth / 2);
        piers.push({
          ...f.at(u, S.wall.standoff + (P.bandDepth + P.pierProud) / 2,
            wg.base + P.brickHeight / 2),
          rot, scale: [P.pierWidth, P.brickHeight, P.bandDepth + P.pierProud],
        });
      }
    }

    /* Storefront: 36 courses of 8 ft glass sitting straight on the 6-course
       plinth, recessed one brick wythe behind the band face and still proud of
       the drawn prism. */
    const SF = P.storefront;
    const sfY = plinthTop + SF.sill + SF.height / 2;
    sfGlass.push({
      ...f.at(len / 2, bandFace - SF.reveal, sfY),
      rot, scale: [Math.max(0.4, len - 0.4), SF.height, 1],
    });
    const nM = Math.max(1, Math.round(len / SF.mullionPitch));
    for (let k = 0; k <= nM; k++) {
      const u = Math.min(Math.max((k / nM) * len, SF.mullionWidth / 2),
        len - SF.mullionWidth / 2);
      sfMullions.push({
        ...f.at(u, bandFace - SF.reveal + SF.mullionWidth, sfY),
        rot, scale: [SF.mullionWidth, SF.height, SF.mullionWidth],
      });
    }
    /* The 3-course brick header over the storefront head. */
    const headBot = plinthTop + SF.sill + SF.height;
    headers.push({
      ...f.at(len / 2, S.wall.standoff + P.bandDepth / 2, headBot + P.headerHeight / 2),
      rot, scale: [len, P.headerHeight, P.bandDepth],
    });

    /* The canopy, on the segments phf19 photographs it following. Per-segment
       plates OVERLAP by their own projection at each end, so the zigzag's
       folds close without a mitre that would self-intersect on this ring's
       3.1 m edges. */
    const CN = P.canopy;
    const cy = wg.base + P.brickHeight;
    canopyY.set(i, cy - CN.thickness - CN.soffitDepth);
    if (canopyOn.has(i)) {
      /* The overhang closes the fold at a convex corner — but this ring also
         turns through 45 deg at one vertex, where the same overhang would run
         back INSIDE the wing prism. An end only overhangs if the ground it
         would cover is outside the surveyed ring. */
      const clear = (u0, u1) => {
        for (let a = 0; a <= 4; a++) {
          for (let b = 0; b <= 3; b++) {
            const p = f.at(u0 + ((u1 - u0) * a) / 4,
              S.wall.standoff + (CN.projection * b) / 3, 0);
            if (inRing(p.x, p.z, wingRing)) return false;
          }
        }
        return true;
      };
      const extA = clear(-CN.projection, 0) ? CN.projection : 0;
      const extB = clear(len, len + CN.projection) ? CN.projection : 0;
      const plateLen = len + extA + extB;
      const uMid = (len + extB - extA) / 2;
      canopyPlates.push({
        ...f.at(uMid, S.wall.standoff + CN.projection / 2, cy - CN.thickness / 2),
        rot, scale: [plateLen, CN.thickness, CN.projection],
      });
      canopySoffits.push({
        ...f.at(uMid, S.wall.standoff + CN.projection / 2, cy - CN.thickness - CN.soffitDepth / 2),
        rot, scale: [plateLen, CN.soffitDepth, CN.projection],
      });
      canopyFascias.push({
        ...f.at(uMid, S.wall.standoff + CN.projection - CN.fasciaThickness / 2,
          cy - (CN.thickness + CN.fascia) / 2),
        rot, scale: [plateLen, CN.fascia + CN.thickness, CN.fasciaThickness],
      });
    }

    /* Level 2: pale panel with a clerestory strip — [estimated], extending
       the tower's sourced panel field and this ring's sourced storefront. */
    const l2 = wg.base + P.brickHeight;
    const l2H = wg.lid - l2;
    if (l2H > 0.2) {
      l2Panels.push({
        ...f.at(len / 2, S.wall.standoff + S.wall.panelDepth / 2, l2 + l2H / 2),
        rot, scale: [len, l2H, S.wall.panelDepth],
      });
      const CL = P.clerestory;
      clerestory.push({
        ...f.at(len / 2, S.wall.standoff + S.wall.panelDepth - S.window.reveal,
          l2 + CL.sill + Math.min(CL.height, l2H - CL.sill) / 2),
        rot, scale: [Math.max(0.4, len - 0.6), Math.min(CL.height, Math.max(0.2, l2H - CL.sill)), 1],
      });
    }
  }

  const brickH = Math.max(1, P.brickHeight);
  group.add(instanced(unit, brickMat(C.podiumBrick, 8, brickH), bricks));
  group.add(instanced(unit, brickMat(C.podiumBrick, P.pierWidth, brickH), piers));
  group.add(instanced(plane, glassMat(C.storefrontGlass), sfGlass));
  group.add(instanced(unit, darkMetal(C.mullion), sfMullions));
  group.add(instanced(unit, brickMat(C.podiumBrick, 8, P.headerHeight), headers));
  group.add(instanced(unit, panelMat(C.wallPanel), canopyPlates));
  group.add(instanced(unit, panelMat(C.canopySoffit), canopySoffits));
  group.add(instanced(unit, darkMetal(C.browFascia), canopyFascias));
  group.add(instanced(unit, panelMat(C.wallPanel), l2Panels));
  group.add(instanced(plane, glassMat(C.storefrontGlass), clerestory));
  bins.counts.podiumSegments = bricks.length;
  bins.counts.podiumPiers = piers.length;
  bins.counts.podiumHeaders = headers.length;
  bins.counts.canopySegments = canopyPlates.length;

  /* The wing roof: one plane over the whole ring with the TOWER PUNCHED OUT.
     Flat at the drawn lid — the fold both aerials show has no measurable
     ridge line, so it is in `absent` rather than invented. */
  const WR = S.wing.roof;
  const wbb = bboxOf(wingRing);
  group.add(new THREE.Mesh(
    plateGeometry(wingRing, [miterOffset(towerRing, S.wall.standoff + S.wall.panelDepth)]),
    plateMat(membraneMat(C.wingRoof, wbb.x1 - wbb.x0, wbb.z1 - wbb.z0))
  ).translateY(wg.lid + 0.02));
  const trims = [];
  for (let i = 0; i < wingRing.length; i++) {
    const a = wingRing[i];
    const b = wingRing[(i + 1) % wingRing.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.2) continue;
    const [nx, nz] = normalOf(wingRing, i);
    const f = frameOf(a, b, [nx, nz]);
    trims.push({
      ...f.at(len / 2, -WR.trimWidth / 2, wg.lid + WR.trimThickness / 2),
      rot: Math.atan2(nx, nz), scale: [len, WR.trimThickness, WR.trimWidth],
    });
  }
  group.add(instanced(unit, panelMat(C.wingTrim), trims));
  bins.counts.wingRoofHoles = 1;
  bins.counts.wingTrims = trims.length;

  /* Festoon lighting HUNG FROM THE CANOPY SOFFIT at the plaza edge, broken
     into 20 ft spans, each sagging its own fraction — and the cord is a
     polyline through the lamps rather than one straight bar per segment. */
  const FE = S.wing.festoon;
  const lamps = [];
  const cords = [];
  for (const i of FE.segments) {
    const soffit = canopyY.get(i);
    if (soffit == null || !canopyOn.has(i)) continue;
    const a = wingRing[i];
    const b = wingRing[(i + 1) % wingRing.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const [nx, nz] = normalOf(wingRing, i);
    const rot = Math.atan2(nx, nz);
    const f = frameOf(a, b, [nx, nz]);
    const y0 = soffit - FE.drop;
    const spans = Math.max(1, Math.round(len / FE.span));
    const spanLen = len / spans;
    const sag = FE.sagFraction * spanLen;
    const per = Math.max(2, Math.round(spanLen / FE.lampPitch));
    const w = S.wall.standoff + S.podium.canopy.projection / 2;
    let prev = null;
    for (let sp = 0; sp < spans; sp++) {
      for (let k = 0; k <= per; k++) {
        if (sp > 0 && k === 0) continue;
        const t = k / per;
        const u = sp * spanLen + t * spanLen;
        const p = f.at(u, w, y0 - sag * Math.sin(Math.PI * t));
        lamps.push(p);
        if (prev) {
          const du = Math.hypot(p.x - prev.x, p.z - prev.z);
          const dy = p.y - prev.y;
          cords.push({
            x: (p.x + prev.x) / 2, y: (p.y + prev.y) / 2, z: (p.z + prev.z) / 2,
            rot, rotZ: Math.atan2(dy, du),
            scale: [Math.hypot(du, dy), FE.cordThickness, FE.cordThickness],
          });
        }
        prev = p;
      }
    }
  }
  group.add(instanced(new THREE.SphereGeometry(FE.lampRadius, 6, 4), lampMat(C.coveLight), lamps));
  group.add(instanced(unit, darkMetal(C.mullion), cords));
  bins.counts.festoonLamps = lamps.length;
  bins.counts.festoonCords = cords.length;
}

/* ---------------------------------------------------- entries and signage */

function buildEntries(S, group, wingRing, wg, ground, bins) {
  const C = S.colors;
  const P = S.podium;
  const SG = S.signage;
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const plane = new THREE.PlaneGeometry(1, 1);
  const bandFace = S.wall.standoff + P.bandDepth;
  const doors = [];
  const jambs = [];
  const letters = [];
  const wallLights = [];
  const planters = [];
  const seatSteps = [];

  for (const e of S.entries) {
    const i = e.seg;
    const a = wingRing[i];
    const b = wingRing[(i + 1) % wingRing.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const [nx, nz] = normalOf(wingRing, i);
    const rot = Math.atan2(nx, nz);
    const f = frameOf(a, b, [nx, nz]);
    const uc = e.u * len;
    doors.push({
      ...f.at(uc, bandFace - P.storefront.reveal, wg.base + e.height / 2),
      rot, scale: [e.width, e.height, 1],
    });
    for (const side of [-1, 1]) {
      jambs.push({
        ...f.at(uc + side * (e.width / 2 + P.storefront.mullionWidth),
          S.wall.standoff + P.bandDepth / 2, wg.base + e.height / 2),
        rot, scale: [2 * P.storefront.mullionWidth, e.height, P.bandDepth],
      });
    }

    if (e.wordmark) {
      const W = e.wordmark;
      const chars = W.text.length;
      const u0 = uc + W.offset - ((chars - 1) * W.letterPitch) / 2;
      for (let k = 0; k < chars; k++) {
        letters.push({
          ...f.at(u0 + k * W.letterPitch, bandFace + SG.relief / 2,
            wg.base + e.height * 0.62),
          rot, scale: [W.capHeight * SG.letterWidthRatio, W.capHeight, SG.relief],
        });
      }
      for (let k = 0; k < (e.wallLights || 0); k++) {
        wallLights.push({
          ...f.at(u0 + (k === 0 ? 0 : (chars - 1) * W.letterPitch),
            bandFace + SG.wallLightDepth / 2,
            wg.base + e.height * 0.62 + W.capHeight + 0.55),
          rotX: Math.PI / 2,
          scale: [SG.wallLightDiameter, SG.wallLightDepth, SG.wallLightDiameter],
        });
      }
      /* The stepped seat-wall terrace, and the raised planters CLEAR of it —
         they stand on the DRAWN terrain, not on the podium. The ramped walk
         and its guardrails are in `absent`. */
      const FC = e.forecourt;
      if (FC) {
        const ST = FC.seatTerrace;
        const halfRun = e.width / 2 + ST.overrun;
        for (let s = 0; s < ST.tiers; s++) {
          const h = ST.rise * (s + 1);
          const p = f.at(uc, ST.setback + s * ST.tread + ST.tread / 2, 0);
          const g = ground(p.x, p.z);
          seatSteps.push({
            x: p.x, y: g + h / 2, z: p.z, rot,
            scale: [2 * halfRun, h, ST.tread],
          });
        }
        const PL = FC.planter;
        for (const side of [-1, 1]) {
          const p = f.at(uc + side * (halfRun + PL.gap + PL.length / 2),
            PL.setback + PL.depth / 2, 0);
          const g = ground(p.x, p.z);
          planters.push({
            x: p.x, y: g + PL.height / 2, z: p.z, rot,
            scale: [PL.length, PL.height, PL.depth],
          });
        }
      }
    }

    if (e.number) {
      const chars = e.number.length;
      const u0 = uc + e.width / 2 + 1.2;
      for (let k = 0; k < chars; k++) {
        bins.numerals.push({
          ...f.at(u0 + k * e.numberHeight * SG.letterWidthRatio * 1.4,
            bandFace + SG.relief / 2, wg.base + e.height * 0.85),
          rot,
          scale: [e.numberHeight * SG.letterWidthRatio, e.numberHeight, SG.relief],
        });
      }
    }
  }

  group.add(instanced(plane, glassMat(C.storefrontGlass), doors));
  group.add(instanced(unit, darkMetal(C.mullion), jambs));
  group.add(instanced(unit, bareMetal(C.wordmarkMetal), letters));
  group.add(instanced(new THREE.CylinderGeometry(0.5, 0.5, 1, 10), lampMat(C.coveLight), wallLights));
  group.add(instanced(unit, concrete(C.siteConcrete), planters));
  group.add(instanced(unit, concrete(C.siteConcrete), seatSteps));
  group.add(instanced(unit, bareMetal(C.addressBlue), bins.numerals));
  bins.counts.entries = doors.length;
  bins.counts.wordmarkLetters = letters.length;
  bins.counts.addressNumerals = bins.numerals.length;
  bins.counts.seatSteps = seatSteps.length;
  bins.counts.entryPlanters = planters.length;
}

/* ------------------------------------------------------------------- api */

/**
 * Build Survivance Hall's photo-sourced detail.
 *
 * `photo` is the loaded photo-detail document; this reads only its
 * `survivance` section and writes nothing back, returning `{ group, counts }`
 * (empty and harmless if the section is missing, so a half-wired boot still
 * runs). `surfaceAt` — the height of the DRAWN terrain triangle — places
 * everything that stands on the ground; `heightAt` sets the building datum,
 * because that is what campus-massing.js used to put the measured masses
 * there and the two must not diverge.
 */
export function createPhotoSurvivance(scene, { photo, heightAt, surfaceAt } = {}) {
  const group = new THREE.Group();
  group.name = "photo-survivance";
  const S = photo?.survivance;
  if (!S) {
    scene?.add(group);
    return { group, counts: {} };
  }
  const ground = surfaceAt || heightAt;
  const at = heightAt || surfaceAt;
  if (typeof ground !== "function" || typeof at !== "function") {
    throw new Error("campus-photo-survivance: needs surfaceAt (or heightAt) to place on the ground");
  }

  const towerRing = openRing(S.measured.mass.ring);
  const wingRing = openRing(S.measured.wing.ring);

  /* The DRAWN datum, on campus-massing.js's own rule. No LiDAR is read: there
     is none for either ring. */
  const lid = drawnLid(towerRing, S.measured.mass.h, at);
  const geo = {
    lid,
    base: lid - S.measured.mass.h,
    F: S.measured.mass.h / S.grid.storeys,
    storeys: S.grid.storeys,
  };
  const wingLid = drawnLid(wingRing, S.measured.wing.h, at);
  const wg = { lid: wingLid, base: wingLid - S.measured.wing.h };

  const bins = {
    panels: [], reveals: [], glass: [], mullions: [],
    marigoldBoxes: [], marigoldJambs: [], ribbonGlass: [], numerals: [],
    ribbonFaces: 0, clipped: 0,
    counts: {},
  };

  for (const face of S.faces) {
    const [nx, nz] = normalOf(towerRing, face.seg);
    const frame = frameOf(towerRing[face.seg], towerRing[(face.seg + 1) % towerRing.length], [nx, nz]);
    /* Is this face inside the WING prism? If it is, nothing below the wing
       lid may be drawn on it — it would be inside another solid mass. */
    const mid = frame.at(frame.length / 2, 0, 0);
    const occl = { lid: wingLid, inside: inRing(mid.x, mid.z, wingRing) };
    collectFace(S, face, frame, geo, bins, occl);
  }

  const C = S.colors;
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const plane = new THREE.PlaneGeometry(1, 1);
  const add = (g, m, items) => { if (items.length) group.add(instanced(g, m, items)); };

  add(unit, panelMat(C.wallPanel), bins.panels);
  add(unit, panelMat(C.browSoffit), bins.reveals);
  add(plane, glassMat(C.windowGlass), bins.glass);
  add(unit, darkMetal(C.mullion), bins.mullions);
  add(unit, panelMat(C.wallPanel), bins.marigoldBoxes);
  add(unit, panelMat(C.marigold), bins.marigoldJambs);
  add(plane, glassMat(C.ribbonGlass), bins.ribbonGlass);

  const towerMid = centroidOf(towerRing);
  const occlTower = { lid: wingLid, inside: inRing(towerMid[0], towerMid[1], wingRing) };
  buildBrow(S, group, towerRing, geo, bins);
  buildRoof(S, group, towerRing, geo, bins);
  buildBalconies(S, group, towerRing, geo, bins, occlTower);
  buildWing(S, group, wingRing, towerRing, wg, ground, bins);
  buildEntries(S, group, wingRing, wg, ground, bins);

  scene?.add(group);
  return {
    group,
    counts: {
      faces: S.faces.length,
      bays: S.faces.reduce((s, f) => s + f.bays, 0),
      windows: bins.glass.length,
      panelPieces: bins.panels.length,
      floorReveals: bins.reveals.length,
      marigoldBays: bins.marigoldBoxes.length,
      marigoldClipped: bins.clipped,
      ribbonFaces: bins.ribbonFaces,
      terraces: 0,
      balconies: bins.counts.balconies || 0,
      balconiesBuried: bins.counts.balconiesBuried || 0,
      balconyPickets: bins.counts.balconyPickets || 0,
      browFascias: bins.counts.browFascias || 0,
      browRibs: bins.counts.browRibs || 0,
      browColumns: bins.counts.browColumns || 0,
      parapetSegments: bins.counts.parapetSegments || 0,
      roofAnchors: bins.counts.roofAnchors || 0,
      penthouses: bins.counts.penthouses || 0,
      mech: bins.counts.mech || 0,
      pv: bins.counts.pv || 0,
      podiumSegments: bins.counts.podiumSegments || 0,
      podiumPiers: bins.counts.podiumPiers || 0,
      podiumHeaders: bins.counts.podiumHeaders || 0,
      canopySegments: bins.counts.canopySegments || 0,
      wingTrims: bins.counts.wingTrims || 0,
      wingRoofHoles: bins.counts.wingRoofHoles || 0,
      festoonLamps: bins.counts.festoonLamps || 0,
      festoonCords: bins.counts.festoonCords || 0,
      entries: bins.counts.entries || 0,
      wordmarkLetters: bins.counts.wordmarkLetters || 0,
      addressNumerals: bins.counts.addressNumerals || 0,
      seatSteps: bins.counts.seatSteps || 0,
      entryPlanters: bins.counts.entryPlanters || 0,
      draws: group.children.length,
    },
  };
}
