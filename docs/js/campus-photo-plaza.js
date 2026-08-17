// Revelle Plaza's LANDSCAPE, from photographs — the ground between Keeling,
// York, Argo, Blake and Galbraith. Part of the declared INVENTED photo-detail
// class (README): photographs decide what exists and how it looks, the
// measured files keep deciding where and how big, and nothing measured may
// ever read from this module or its `plaza` section.
//
// Three rules shaped this file:
//
//   1. TREES RE-SKIN, NEVER MOVE. The ultra tree models here stand on the
//      exact trunks of the 2014 LiDAR table — each item in the section's
//      `treeOverrides` carries a position key and copies its (x, z, h, r)
//      verbatim, and the tests diff every one against campus-lidar.json. The
//      photographs only changed the SPECIES: the York belt is Torrey pine
//      (the height heuristic mislabels it eucalyptus), the plaza broadleafs
//      are ficus with pale sinuous multi-stem trunks, and eucalyptus lives
//      only east of York and on the Keeling west road. The one tree with no
//      measured trunk is the Peace Memorial coral tree, planted for the
//      February 2014 unveiling at or after the LiDAR epoch. NO PALMS — zero
//      appear in any Zone 1 photograph.
//
//   2. EVERYTHING SEATS ON surfaceAt. This is a ground module: every trunk,
//      bench, pole, table and umbrella stands on the drawn terrain triangle,
//      and every flat surface is a lifted decal on the overlay ladder.
//
//   3. MICROSTRUCTURE COMES FROM campus-materials.js. Bark, brick, paving,
//      lava rock and foliage all use the procedural library — computed
//      variation maps that multiply the section's sourced hexes, so no class
//      can move a colour off its hue. Per-surface `repeat` is tuned to the
//      real-world unit (brick tile ~0.8 m, paving unit ~0.5 m).
//
// The fanned-brick corner arcs — the plaza's signature — are derived from the
// revelle section's OWN paving cells (invented reading invented, which is
// allowed; the crossing positions were never measured twice). Every random-
// looking choice comes from the repo's seeded PRNG (mulberry32) keyed off the
// section's pinned seed, so a reload rebuilds the same plaza.
import * as THREE from "../vendor/three/three.module.min.js";
import { applyOverlayDepth, OVERLAY, overlayLift } from "./campus-overlay.js";
import { createMaterialLibrary, mulberry32 } from "./campus-materials.js";

const PAD = "pad";
const CARPET = "carpet";
const PAINT = "paint";
const LOGO = "logo";

const painted = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.25 });
const cloth = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.0, side: THREE.DoubleSide });
const flat = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0.0 });

/** Flat decal material on a rung of the overlay ladder. */
function decal(material, rung) {
  return applyOverlayDepth(material, rung);
}

/** One InstancedMesh from a list of placements (keeling convention). */
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

/** A flat XZ decal quad lying in the ground plane. */
function quad(w, d) {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  return g;
}

/**
 * A ground-CONFORMING decal sheet for the large rects (lawns, cross-walk,
 * DG belt): a subdivided quad whose every vertex is sampled from surfaceAt,
 * stored relative to the centre sample so the mesh still rides its
 * position.y. A single flat quad at one centre sample buries ~1.5 m under
 * the drawn terrain at one end of the 137 m DG belt and floats ~2.5 m over
 * it at the other — the LiDAR ground spans 4.07 m of relief under it.
 */
function conformingSheet(r, ground, rung, material, step = 2) {
  const w = r.x1 - r.x0;
  const d = r.z1 - r.z0;
  const cx = (r.x0 + r.x1) / 2;
  const cz = (r.z0 + r.z1) / 2;
  const geo = new THREE.PlaneGeometry(
    w, d, Math.max(1, Math.round(w / step)), Math.max(1, Math.round(d / step))
  );
  geo.rotateX(-Math.PI / 2);
  const g0 = ground(cx, cz);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, ground(cx + pos.getX(i), cz + pos.getZ(i)) - g0);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, decal(material, rung));
  mesh.position.set(cx, g0 + overlayLift(rung), cz);
  mesh.renderOrder = OVERLAY[rung].renderOrder;
  return mesh;
}

/** Deterministic per-tree PRNG from the pinned seed and the trunk's key. */
function treeRng(seed, x, z) {
  return mulberry32(
    (seed ^ Math.imul(Math.round(x * 10), 0x27d4eb2d) ^ Math.imul(Math.round(z * 10), 0x165667b1)) | 0
  );
}

/* ------------------------------------------------------------------ trees */

/* Each species collects into shared bins so the whole zone's canopy is a
   handful of instanced draws: one trunk mesh, one limb mesh, two card
   materials (sun/shade), one lobe material per species. Cards are cutout
   foliage planes (alpha from the procedural map); lobes are the same class
   with alphaTest 0 — solid, for the dense ficus/coral domes. */

function collectPine(item, seed, ground, bins) {
  const { x, z, h, r } = item;
  const rng = treeRng(seed, x, z);
  const g = ground(x, z);
  const boleH = h * 0.6; // clear bole 55-65% of height [measured]
  bins.pineTrunks.push({ x, y: g + boleH / 2, z, scale: [1, boleH, 1] });

  const limbs = 2 + Math.floor(rng() * 3); // 2-4 heavy ascending limbs
  for (let l = 0; l < limbs; l++) {
    const yaw = rng() * Math.PI * 2;
    const tilt = 0.5 + rng() * 0.4;
    const len = h * (0.22 + rng() * 0.08);
    const s = Math.sin(tilt);
    const dir = [-s * Math.sin(yaw), Math.cos(tilt), -s * Math.cos(yaw)];
    const bx = x + dir[0] * (len / 2);
    const by = g + boleH * 0.92 + dir[1] * (len / 2);
    const bz = z + dir[2] * (len / 2);
    bins.pineLimbs.push({ x: bx, y: by, z: bz, rot: yaw, rotX: tilt, scale: [1, len, 1] });

    /* Needle tufts at the limb end: two crossed cards, kept inside the
       measured crown radius. ~40-50% of the crown must stay sky. */
    const tipX = x + dir[0] * len * 0.95;
    const tipY = g + boleH * 0.92 + dir[1] * len * 0.95;
    const tipZ = z + dir[2] * len * 0.95;
    const w = Math.min(r * (0.8 + rng() * 0.3), r * 1.1);
    for (let c = 0; c < 2; c++) {
      const bin = rng() < 0.55 ? bins.cardsSun : bins.cardsShade;
      bin.push({
        x: tipX, y: Math.min(tipY, g + h - w * 0.2), z: tipZ,
        rot: rng() * Math.PI, scale: [w, w * 0.5, 1],
      });
    }
  }
  /* Crown-top tufts so the tree does not read decapitated. */
  for (let c = 0; c < 2; c++) {
    const w = r * (0.6 + rng() * 0.25);
    const bin = c === 0 ? bins.cardsSun : bins.cardsShade;
    bin.push({
      x: x + (rng() - 0.5) * r * 0.5,
      y: g + h * (0.86 + rng() * 0.08),
      z: z + (rng() - 0.5) * r * 0.5,
      rot: rng() * Math.PI, scale: [w, w * 0.5, 1],
    });
  }
}

function collectEucalyptus(item, seed, ground, bins) {
  const { x, z, h, r } = item;
  const rng = treeRng(seed, x, z);
  const g = ground(x, z);
  const trunkH = h * 0.62;
  bins.eucTrunks.push({ x, y: g + trunkH / 2, z, rot: rng() * Math.PI, scale: [1, trunkH, 1] });
  /* A sparse, airy crown: small grey-green cards high on the pole. */
  const cards = 4 + Math.floor(rng() * 3);
  for (let c = 0; c < cards; c++) {
    const w = 2.2 + rng() * Math.min(r * 0.45, 1.6);
    bins.eucCards.push({
      x: x + (rng() - 0.5) * r,
      y: g + h * (0.68 + rng() * 0.28),
      z: z + (rng() - 0.5) * r,
      rot: rng() * Math.PI, scale: [w, w * 0.6, 1],
    });
  }
}

function collectFicus(item, seed, ground, bins) {
  const { x, z, h, r } = item;
  const rng = treeRng(seed, x, z);
  const g = ground(x, z);
  /* Pale sinuous multi-stem trunk: 3-5 stems fusing low, leaning outward. */
  const stems = 3 + Math.floor(rng() * 3);
  const stemH = h * 0.5;
  for (let s = 0; s < stems; s++) {
    const yaw = (s / stems) * Math.PI * 2 + rng() * 0.8;
    const lean = 0.12 + rng() * 0.16;
    const si = Math.sin(lean);
    const dir = [-si * Math.sin(yaw), Math.cos(lean), -si * Math.cos(yaw)];
    bins.ficusStems.push({
      x: x + dir[0] * (stemH / 2), y: g + dir[1] * (stemH / 2), z: z + dir[2] * (stemH / 2),
      rot: yaw, rotX: lean, scale: [1, stemH, 1],
    });
  }
  /* Tight dark dome: one carrying lobe plus satellites, all solid. */
  const cy = g + h * 0.72;
  bins.ficusLobes.push({ x, y: cy, z, rot: rng() * Math.PI, scale: [r * 0.85, r * 0.42, r * 0.85] });
  const lobes = 5 + Math.floor(rng() * 3);
  for (let l = 0; l < lobes; l++) {
    const a = rng() * Math.PI * 2;
    const d = r * (0.25 + rng() * 0.3);
    const s = r * (0.4 + rng() * 0.22);
    bins.ficusLobes.push({
      x: x + Math.sin(a) * d,
      y: cy + (rng() - 0.35) * h * 0.1,
      z: z + Math.cos(a) * d,
      rot: rng() * Math.PI, scale: [s, s * 0.6, s],
    });
  }
}

function collectCoral(coral, seed, ground, bins) {
  const { x, z, h, spread } = coral;
  const rng = treeRng(seed, x, z);
  const g = ground(x, z);
  const stems = coral.stems || 3;
  const stemH = h * 0.55;
  for (let s = 0; s < stems; s++) {
    const yaw = (s / stems) * Math.PI * 2 + rng() * 0.6;
    const lean = 0.18 + rng() * 0.14;
    const si = Math.sin(lean);
    const dir = [-si * Math.sin(yaw), Math.cos(lean), -si * Math.cos(yaw)];
    bins.coralStems.push({
      x: x + dir[0] * (stemH / 2), y: g + dir[1] * (stemH / 2), z: z + dir[2] * (stemH / 2),
      rot: yaw, rotX: lean, scale: [1, stemH, 1],
    });
  }
  /* Sparse open canopy of large light-green lobes. */
  const R = spread / 2;
  for (let l = 0; l < 5; l++) {
    const a = rng() * Math.PI * 2;
    const d = R * (0.15 + rng() * 0.5);
    const s = R * (0.34 + rng() * 0.18);
    bins.coralLobes.push({
      x: x + Math.sin(a) * d,
      y: g + h * (0.6 + rng() * 0.3),
      z: z + Math.cos(a) * d,
      rot: rng() * Math.PI, scale: [s, s * 0.55, s],
    });
  }
}

function buildTrees(section, group, ground, mats, counts) {
  const T = section.treeOverrides;
  const C = section.colors;
  const seed = section.seed;
  const bins = {
    pineTrunks: [], pineLimbs: [], cardsSun: [], cardsShade: [],
    eucTrunks: [], eucCards: [], ficusStems: [], ficusLobes: [],
    coralStems: [], coralLobes: [],
  };
  for (const it of T.pines.items) collectPine(it, seed, ground, bins);
  for (const it of T.eucalyptus.items) collectEucalyptus(it, seed, ground, bins);
  for (const it of T.ficus.items) collectFicus(it, seed, ground, bins);
  collectCoral(T.coral, seed, ground, bins);

  const card = new THREE.PlaneGeometry(1, 1);
  const lobe = new THREE.SphereGeometry(1, 7, 5);
  const add = (geo, mat, items) => { if (items.length) group.add(instanced(geo, mat, items, (it) => it)); };

  add(new THREE.CylinderGeometry(0.3, 0.5, 1, 7),
    mats.get("barkPine", { color: C.pineBark, repeat: [2, 6] }), bins.pineTrunks);
  add(new THREE.CylinderGeometry(0.09, 0.16, 1, 5),
    mats.get("barkPine", { color: C.pineBark, repeat: [1, 3] }), bins.pineLimbs);
  add(card, mats.get("foliage", { color: C.pineFoliageSun }), bins.cardsSun);
  add(card, mats.get("foliage", { color: C.pineFoliageShade }), bins.cardsShade);
  add(new THREE.CylinderGeometry(0.18, 0.3, 1, 7),
    mats.get("barkEucalyptus", { color: C.eucTrunk, repeat: [2, 8] }), bins.eucTrunks);
  add(card, mats.get("foliage", { color: C.eucLeaf }), bins.eucCards);
  add(new THREE.CylinderGeometry(0.12, 0.17, 1, 6),
    mats.get("smoothConcrete", { color: C.ficusTrunk, roughness: 0.8 }), bins.ficusStems);
  add(lobe, mats.get("foliage", { color: C.ficusLeaf, alphaTest: 0 }), bins.ficusLobes);
  add(new THREE.CylinderGeometry(0.13, 0.19, 1, 6),
    mats.get("smoothConcrete", { color: C.coralBark, roughness: 0.75 }), bins.coralStems);
  add(lobe, mats.get("foliage", { color: C.coralLeaf, alphaTest: 0 }), bins.coralLobes);

  /* The coral tree's circular bare-earth ring, set in the lawn. */
  const ring = new THREE.Mesh(
    new THREE.CircleGeometry(T.coral.earthRing, 20).rotateX(-Math.PI / 2),
    decal(flat(C.coralEarth), PAINT)
  );
  ring.position.set(T.coral.x, ground(T.coral.x, T.coral.z) + overlayLift(PAINT), T.coral.z);
  ring.renderOrder = OVERLAY[PAINT].renderOrder;
  group.add(ring);

  counts.pines = T.pines.items.length;
  counts.ficus = T.ficus.items.length;
  counts.eucalyptus = T.eucalyptus.items.length;
  counts.coral = 1;
  counts.foliageCards = bins.cardsSun.length + bins.cardsShade.length + bins.eucCards.length;
  counts.foliageLobes = bins.ficusLobes.length + bins.coralLobes.length;
}

/* ----------------------------------------------------------------- ground */

function buildLawns(section, group, ground, mats, counts) {
  const { lawns, colors } = section;
  lawns.panels.forEach((p, i) => {
    const mesh = conformingSheet(p, ground, CARPET, flat(colors.lawn));
    mesh.name = `lawn-panel-${i}`;
    group.add(mesh);
  });
  const w = lawns.crossWalk;
  const walk = conformingSheet(w, ground, PAD, mats.get("pavingConcreteUnit", {
    color: colors.paving, repeat: [(w.x1 - w.x0) / 3, (w.z1 - w.z0) / 3],
  }));
  walk.name = "cross-walk";
  group.add(walk);
  counts.lawnPanels = lawns.panels.length;
}

/* The decomposed-granite belt under the York-belt pines. [estimated] extent. */
function buildDgBelt(section, group, ground, mats) {
  const d = section.dgBelt;
  const mesh = conformingSheet(d, ground, PAD, mats.get("decomposedGranite", {
    color: section.colors.dg, repeat: [(d.x1 - d.x0) / 1.4, (d.z1 - d.z0) / 1.4],
  }));
  mesh.name = "dg-belt";
  group.add(mesh);
}

/**
 * The fanned-brick corner arcs at every band crossing — the plaza's
 * signature. Crossings are derived from the revelle section's own paving
 * cells: where four cells meet, each panel corner is struck with the 1.8 m
 * radius, and a fan of small brick wedges follows each arc so the coursing
 * turns with it instead of butting into the curve.
 */
function buildBrickArcs(section, revellePaving, group, ground, mats, counts) {
  const A = section.arcs;
  if (!revellePaving?.cells?.length) { counts.brickArcCrossings = 0; return; }
  const P = A.pitch;
  const key = ([x, z]) => `${Math.round(x * 10)},${Math.round(z * 10)}`;
  const have = new Set(revellePaving.cells.map(key));
  const crossings = [];
  for (const [x, z] of revellePaving.cells) {
    if (have.has(key([x + P, z])) && have.has(key([x, z + P])) && have.has(key([x + P, z + P]))) {
      crossings.push([x + P / 2, z + P / 2]);
    }
  }
  /* Each crossing has four panel-corner arcs; their centres sit diagonal of
     the crossing at (halfPanel - radius) inboard of each panel centre. */
  const off = P / 2 - ((P - A.band) / 2 - A.radius); // crossing -> arc centre, per axis
  const wedges = [];
  const [ws, wd] = A.wedgeSize;
  for (const [cx, cz] of crossings) {
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const ax = cx + sx * off;
      const az = cz + sz * off;
      /* The quarter of the arc that faces back toward the crossing. */
      const toward = Math.atan2(cx - ax, cz - az);
      for (let i = 0; i < A.wedgesPerCorner; i++) {
        const a = toward - Math.PI / 4 + ((i + 0.5) / A.wedgesPerCorner) * (Math.PI / 2);
        const R = A.radius + wd / 2 + 0.03;
        wedges.push({
          x: ax + Math.sin(a) * R,
          z: az + Math.cos(a) * R,
          rot: a, // tangent-aligned: the coursing follows the arc
        });
      }
    }
  }
  const mesh = instanced(
    quad(ws, wd),
    decal(mats.get("brick", { color: section.colors.brick, repeat: [ws / 0.8, wd / 0.8] }), PAINT),
    wedges,
    (w) => ({ x: w.x, y: ground(w.x, w.z) + overlayLift(PAINT), z: w.z, rot: w.rot })
  );
  mesh.renderOrder = OVERLAY[PAINT].renderOrder;
  mesh.castShadow = false;
  group.add(mesh);
  counts.brickArcCrossings = crossings.length;
  counts.brickArcWedges = wedges.length;
}

/* This is the plaza fountain's ONE rendering. The landmark builder's older
   ring-fountain ("Revelle Plaza Fountain" in campus-landmarks) draws a basin
   and jet at the same surveyed point — the section's `fountain.replacesLandmark`
   tells main to suppress that basin/jet (KEEPING the landmark's flagpole)
   exactly as `skipMeasuredKeys` suppresses the blob trees, or two fountains
   interpenetrate. The centre is the landmark's surveyed OSM point — position
   from OSM wins over the photo/satellite read. */
function buildFountain(section, group, ground, mats, counts) {
  const F = section.fountain;
  const C = section.colors;
  const g = ground(F.cx, F.cz);
  const sub = new THREE.Group();
  sub.position.set(F.cx, g, F.cz);
  sub.rotation.y = F.rot;

  /* The square plinth: charcoal sides, light concrete deck, sit-on edge. */
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(F.plinth, F.plinthHeight, F.plinth),
    mats.get("smoothConcrete", { color: C.plinthCharcoal })
  );
  plinth.position.y = F.plinthHeight / 2;
  sub.add(plinth);
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(F.plinth - 0.06, 0.05, F.plinth - 0.06),
    mats.get("smoothConcrete", { color: C.fountainDeck })
  );
  deck.position.y = F.plinthHeight + 0.025;
  sub.add(deck);

  /* The circular basin recessed into the deck. */
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(F.basinRadius, F.basinRadius, F.basinDepth + 0.08, 28, 1, true),
    mats.get("smoothConcrete", { color: C.plinthCharcoal, side: THREE.DoubleSide })
  );
  wall.position.y = F.plinthHeight - F.basinDepth / 2 + 0.04;
  sub.add(wall);
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(F.basinRadius - 0.05, 28).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: C.water, roughness: 0.15, metalness: 0.4 })
  );
  water.position.y = F.plinthHeight - F.basinDepth;
  sub.add(water);

  /* The jet: central foam column plus the skirt of arcing streams. */
  const J = F.jet;
  const foamMat = new THREE.MeshStandardMaterial({
    color: C.foam, roughness: 0.9, metalness: 0, transparent: true, opacity: 0.8, depthWrite: false,
  });
  const core = new THREE.Mesh(new THREE.CylinderGeometry(J.coreRadius, J.coreRadius * 0.5, J.coreHeight, 10), foamMat);
  core.position.y = F.plinthHeight - F.basinDepth + J.coreHeight / 2;
  sub.add(core);
  const skirt = new THREE.Mesh(
    new THREE.CylinderGeometry(J.skirtRadius, J.coreRadius * 0.9, J.skirtHeight, 20, 1, true),
    new THREE.MeshStandardMaterial({
      color: C.foam, roughness: 0.9, metalness: 0, transparent: true, opacity: 0.35,
      side: THREE.DoubleSide, depthWrite: false,
    })
  );
  skirt.position.y = F.plinthHeight - F.basinDepth + J.skirtHeight / 2;
  sub.add(skirt);

  group.add(sub);
  counts.fountain = 1;
}

function buildMemorial(section, group, ground, mats, counts) {
  const M = section.memorial;
  const C = section.colors;
  const g = ground(M.cx, M.cz);

  /* The half-disc slab, FLUSH in the lawn: a decal, curved edge north. */
  const slab = new THREE.Mesh(
    new THREE.CircleGeometry(M.slabRadius, 28, 0, Math.PI).rotateX(-Math.PI / 2),
    decal(mats.get("smoothConcrete", { color: C.memorialSlab, repeat: [3, 3] }), PAINT)
  );
  slab.position.set(M.cx, g + overlayLift(PAINT), M.cz);
  slab.rotation.y = M.rot;
  slab.renderOrder = OVERLAY[PAINT].renderOrder;
  group.add(slab);

  /* Brick soldier course along the straight edge. */
  const trim = new THREE.Mesh(
    quad(M.slabRadius * 2, M.trimWidth),
    decal(mats.get("brick", { color: C.brick, repeat: [M.slabRadius * 2 / 0.8, M.trimWidth / 0.8] }), PAINT)
  );
  trim.position.set(M.cx, g + overlayLift(PAINT), M.cz + M.trimWidth / 2);
  trim.renderOrder = OVERLAY[PAINT].renderOrder;
  group.add(trim);

  /* The star chart: engraved lines radiating from the node, then the flush
     light lenses on top of them. Local +v maps to north (-z). */
  const [nx, nv] = M.node;
  const lines = M.lenses.map(([lx, lv]) => {
    const dx = lx - nx;
    const dz = -(lv - nv);
    const len = Math.hypot(dx, dz);
    return {
      x: M.cx + (nx + lx) / 2, z: M.cz + (-(nv + lv)) / 2,
      rot: Math.atan2(dz, dx), scale: [Math.max(len, 0.01), 1, 0.035],
    };
  });
  const lineMesh = instanced(quad(1, 1), decal(flat(C.engrave), LOGO), lines,
    (l) => ({ x: l.x, y: ground(l.x, l.z) + overlayLift(LOGO), z: l.z, rot: l.rot, scale: l.scale }));
  lineMesh.renderOrder = OVERLAY[LOGO].renderOrder;
  lineMesh.castShadow = false;
  group.add(lineMesh);
  const lensMesh = instanced(
    new THREE.CircleGeometry(M.lensRadius, 10).rotateX(-Math.PI / 2),
    decal(new THREE.MeshStandardMaterial({ color: C.lensWhite, roughness: 0.3, metalness: 0.1 }), LOGO),
    M.lenses,
    ([lx, lv]) => ({ x: M.cx + lx, y: ground(M.cx + lx, M.cz - lv) + overlayLift(LOGO) + 0.005, z: M.cz - lv })
  );
  lensMesh.renderOrder = OVERLAY[LOGO].renderOrder;
  lensMesh.castShadow = false;
  group.add(lensMesh);

  /* The curved bench on its lava-rock rubble base, south of the slab. */
  const B = M.bench;
  const segAngle = B.arcLength / B.radius / B.segments;
  const segLen = B.arcLength / B.segments;
  const seats = [];
  const bases = [];
  for (let i = 0; i < B.segments; i++) {
    const a = (i - (B.segments - 1) / 2) * segAngle;
    const x = M.cx + Math.sin(a) * B.radius;
    const z = M.cz + Math.cos(a) * B.radius;
    const gy = ground(x, z);
    seats.push({ x, y: gy + B.seatHeight - B.slab / 2, z, rot: -a, scale: [segLen * 1.04, B.slab, B.depth] });
    bases.push({ x, y: gy + B.baseHeight / 2, z, rot: -a, scale: [segLen * 0.96, B.baseHeight, B.baseDepth] });
  }
  const box = new THREE.BoxGeometry(1, 1, 1);
  group.add(instanced(box, mats.get("lavaRock", { color: C.lavaRock }), bases, (it) => it));
  group.add(instanced(box, mats.get("smoothConcrete", { color: C.benchConcrete }), seats, (it) => it));

  counts.memorialLenses = M.lenses.length;
  counts.memorialBenchSegments = B.segments;
}

/* -------------------------------------------------------------- furniture */

function buildLamps(section, group, ground, counts) {
  const L = section.furniture.lamp;
  const C = section.colors;
  const on = (it) => ground(it.x, it.z);
  const poleMat = painted(C.poleBlack);
  group.add(instanced(new THREE.BoxGeometry(L.pole, 1, L.pole), poleMat, L.items,
    (it) => ({ x: it.x, y: on(it) + L.height / 2, z: it.z, rot: it.rot, scale: [1, L.height, 1] })));
  /* The flat luminaire box cantilevered off the pole top on a short arm. */
  group.add(instanced(new THREE.BoxGeometry(L.head[0], L.head[1], L.head[2]), poleMat, L.items,
    (it) => ({
      x: it.x + Math.sin(it.rot) * 0.28, y: on(it) + L.height + L.head[1] / 2,
      z: it.z + Math.cos(it.rot) * 0.28, rot: it.rot,
    })));
  /* Crossarm with a banner hanging each side — the photographed pair. */
  group.add(instanced(new THREE.BoxGeometry(1.6, 0.05, 0.05), poleMat, L.items,
    (it) => ({ x: it.x, y: on(it) + L.crossarmY, z: it.z, rot: it.rot })));
  const [bw, bh] = L.bannerSize;
  const bannerBits = [
    /* top ~25% navy, middle gold (the dominant colour), bottom navy strip */
    { frac: 0.25, off: 1 - 0.125, color: C.bannerNavy },
    { frac: 0.6, off: 0.15 + 0.3, color: C.bannerGold },
    { frac: 0.15, off: 0.075, color: C.bannerNavy },
  ];
  for (const bit of bannerBits) {
    const geo = new THREE.PlaneGeometry(bw, bh * bit.frac);
    const items = [];
    for (const it of L.items) for (const side of [-0.55, 0.55]) items.push({ it, side });
    group.add(instanced(geo, cloth(bit.color), items, ({ it, side }) => ({
      x: it.x + Math.cos(it.rot) * side,
      y: on(it) + L.bannerBottomY + bh * bit.off,
      z: it.z - Math.sin(it.rot) * side,
      rot: it.rot,
    })));
  }
  counts.lamps = L.items.length;
  counts.banners = L.items.length * 2;
}

function buildBenches(section, group, ground, mats, counts) {
  const B = section.furniture.benches;
  const C = section.colors;
  const mat = mats.get("smoothConcrete", { color: C.benchConcrete });
  group.add(instanced(new THREE.BoxGeometry(B.length, B.slab, B.depth), mat, B.items,
    (it) => ({ x: it.x, y: ground(it.x, it.z) + B.seatHeight - B.slab / 2, z: it.z, rot: it.rot })));
  /* Flared pedestal legs: 4-sided cylinders wider at the ground. */
  const legGeo = new THREE.CylinderGeometry(0.17, 0.26, B.seatHeight - B.slab, 4);
  const legs = [];
  for (const it of B.items) for (const side of [-1, 1]) legs.push({ it, side });
  group.add(instanced(legGeo, mat, legs, ({ it, side }) => ({
    x: it.x + Math.cos(it.rot) * side * (B.length / 2 - B.legInset),
    y: ground(it.x, it.z) + (B.seatHeight - B.slab) / 2,
    z: it.z - Math.sin(it.rot) * side * (B.length / 2 - B.legInset),
    rot: it.rot + Math.PI / 4,
  })));
  counts.benches = B.items.length;
}

function buildBinPairs(section, group, ground, mats, counts) {
  const P = section.furniture.binPairs;
  const C = section.colors;
  const conc = mats.get("smoothConcrete", { color: C.binGrey });
  const dark = painted(C.binDarkTop);
  group.add(instanced(new THREE.BoxGeometry(P.square[0], P.square[1], P.square[2]), conc, P.items,
    (it) => ({ x: it.x, y: ground(it.x, it.z) + P.square[1] / 2, z: it.z, rot: it.rot })));
  group.add(instanced(new THREE.BoxGeometry(P.square[0] * 0.6, 0.06, P.square[2] * 0.6), dark, P.items,
    (it) => ({ x: it.x, y: ground(it.x, it.z) + P.square[1] + 0.03, z: it.z, rot: it.rot })));
  const cylX = (it) => it.x + Math.cos(it.rot) * P.gap;
  const cylZ = (it) => it.z - Math.sin(it.rot) * P.gap;
  group.add(instanced(new THREE.CylinderGeometry(P.cylinderRadius, P.cylinderRadius * 0.92, P.cylinderHeight, 12),
    conc, P.items,
    (it) => ({ x: cylX(it), y: ground(cylX(it), cylZ(it)) + P.cylinderHeight / 2, z: cylZ(it) })));
  group.add(instanced(new THREE.CylinderGeometry(P.cylinderRadius * 0.7, P.cylinderRadius * 0.7, 0.05, 12),
    dark, P.items,
    (it) => ({ x: cylX(it), y: ground(cylX(it), cylZ(it)) + P.cylinderHeight + 0.025, z: cylZ(it) })));
  counts.binPairs = P.items.length;
}

function buildBikes(section, group, ground, counts) {
  const K = section.furniture.bikes;
  const C = section.colors;
  const seed = section.seed;
  const rng = mulberry32((seed ^ 0xb1ce5) | 0);
  const frames = { bikeDark: [], bikeRed: [], bikeBlue: [], bikeSilver: [] };
  const wheels = [];
  const names = Object.keys(frames);
  for (let i = 0; i < K.count; i++) {
    const x = K.x0 + ((K.x1 - K.x0) * i) / Math.max(1, K.count - 1);
    const z = K.z + (rng() - 0.5) * 0.6;
    const rot = K.rot + (rng() - 0.5) * 0.3;
    const it = { x, z, rot };
    frames[names[Math.floor(rng() * names.length) % names.length]].push(it);
    for (const side of [-1, 1]) wheels.push({ ...it, side });
  }
  const wheelGeo = new THREE.TorusGeometry(K.wheel, 0.025, 5, 12);
  group.add(instanced(wheelGeo, painted(C.bikeDark), wheels, (w) => ({
    x: w.x + Math.sin(w.rot) * w.side * (K.frameLength / 2 - K.wheel * 0.45),
    y: ground(w.x, w.z) + K.wheel,
    z: w.z + Math.cos(w.rot) * w.side * (K.frameLength / 2 - K.wheel * 0.45),
    rot: w.rot + Math.PI / 2,
  })));
  const frameGeo = new THREE.BoxGeometry(0.06, 0.3, 0.65);
  for (const [name, items] of Object.entries(frames)) {
    if (!items.length) continue;
    group.add(instanced(frameGeo, painted(C[name]), items, (it) => ({
      x: it.x, y: ground(it.x, it.z) + K.wheel + K.frameHeight / 2 - 0.12, z: it.z, rot: it.rot,
    })));
  }
  counts.bikes = K.count;
}

function buildTerraces(section, group, ground, mats, counts) {
  const T = section.furniture.terraces;
  const C = section.colors;
  const tb = T.table;
  const um = T.umbrella;
  const conc = mats.get("smoothConcrete", { color: C.tableTop });
  const base = painted(C.tableBase);
  const on = (it) => ground(it.x, it.z);
  /* The table: base + column + round top, all seated on the ground. */
  group.add(instanced(new THREE.CylinderGeometry(tb.baseRadius, tb.baseRadius, 0.05, 12), base, T.items,
    (it) => ({ x: it.x, y: on(it) + 0.025, z: it.z })));
  group.add(instanced(new THREE.CylinderGeometry(0.045, 0.045, tb.topHeight, 8), base, T.items,
    (it) => ({ x: it.x, y: on(it) + tb.topHeight / 2, z: it.z })));
  group.add(instanced(new THREE.CylinderGeometry(tb.topRadius, tb.topRadius, 0.04, 14), conc, T.items,
    (it) => ({ x: it.x, y: on(it) + tb.topHeight + 0.02, z: it.z })));
  /* The umbrella: pole THROUGH the table to the ground, canopy on the pole. */
  group.add(instanced(new THREE.CylinderGeometry(0.03, 0.03, um.poleHeight, 6), base, T.items,
    (it) => ({ x: it.x, y: on(it) + um.poleHeight / 2, z: it.z })));
  for (const color of ["umbrellaBlue", "umbrellaOrange"]) {
    const items = T.items.filter((it) => it.color === color);
    if (!items.length) continue;
    group.add(instanced(new THREE.ConeGeometry(um.radius, um.canopyDrop, 8), cloth(C[color]), items,
      (it) => ({ x: it.x, y: on(it) + um.poleHeight - um.canopyDrop / 2, z: it.z })));
  }
  counts.umbrellas = T.items.length;
}

/* -------------------------------------------------------------------- api */

/**
 * Build the Revelle Plaza landscape detail.
 *
 * `photo` is the loaded photo-detail document; this reads its `plaza` section
 * (and, read-only, `revelle.paving.cells` to place the corner arcs) and
 * returns `{ group, counts }` — empty and harmless when the section is
 * missing. Everything stands on `surfaceAt`, the height of the DRAWN terrain
 * triangle; `heightAt` is only the fallback for an older call site.
 */
export function createPhotoPlaza(scene, { photo, heightAt, surfaceAt } = {}) {
  const group = new THREE.Group();
  group.name = "photo-plaza";
  const section = photo?.plaza;
  if (!section) {
    scene?.add(group);
    return { group, counts: {} };
  }
  const ground = surfaceAt || heightAt;
  if (typeof ground !== "function") {
    throw new Error("campus-photo-plaza: needs surfaceAt (or heightAt) to place on the ground");
  }

  const mats = createMaterialLibrary(THREE);
  const counts = {};
  buildTrees(section, group, ground, mats, counts);
  buildLawns(section, group, ground, mats, counts);
  buildDgBelt(section, group, ground, mats);
  buildBrickArcs(section, photo?.revelle?.paving, group, ground, mats, counts);
  buildFountain(section, group, ground, mats, counts);
  buildMemorial(section, group, ground, mats, counts);
  buildLamps(section, group, ground, counts);
  buildBenches(section, group, ground, mats, counts);
  buildBinPairs(section, group, ground, mats, counts);
  buildBikes(section, group, ground, counts);
  buildTerraces(section, group, ground, mats, counts);
  counts.draws = group.children.length;

  scene?.add(group);
  return { group, counts };
}
