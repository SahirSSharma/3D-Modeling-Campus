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
// THE PAVING FIELD IS THIS SECTION'S NOW. It used to live in the legacy
// `revelle` section, which drew it at a pitch of 6.4 m on a phase that was
// about 1 m out and drifting, and this module reached across into that
// section to place its corner arcs. R1 moved it: `plaza.paving` carries the
// field, re-derived off the repo's own orthophoto by locating the dark joint
// lines themselves, and the fanned-brick corner arcs — the plaza's signature —
// derive from this section's own cells. The old field is retired in
// `revelle.superseded`, not deleted. Every random-looking choice here comes
// from the repo's seeded PRNG (mulberry32) keyed off the section's pinned
// seed, so a reload rebuilds the same plaza.
import * as THREE from "../vendor/three/three.module.min.js";
import { applyOverlayDepth, OVERLAY, overlayLift } from "./campus-overlay.js";
import { sharedMaterialLibrary, mulberry32 } from "./campus-materials.js";

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
  const tint = new THREE.Color();
  items.forEach((it, i) => {
    const p = place(it, i);
    e.set(p.rotX || 0, p.rot || 0, p.rotZ || 0, "YXZ");
    q.setFromEuler(e);
    s.set(p.scale?.[0] ?? 1, p.scale?.[1] ?? 1, p.scale?.[2] ?? 1);
    pos.set(p.x, p.y, p.z);
    m.compose(pos, q, s);
    mesh.setMatrixAt(i, m);
    /* Per-instance tone: a VALUE multiplier only, so a lobe can be a lighter
       or darker version of the section's sourced hex but never another hue. */
    if (p.tone !== undefined) mesh.setColorAt(i, tint.setScalar(p.tone));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
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
   handful of instanced draws: one trunk mesh, one limb mesh, and one lobe
   mesh per foliage tone.

   CANOPIES ARE VOLUMES, NOT CARDS. An earlier pass hung crossed alpha-cutout
   planes off the limb tips. It passed every count gate and looked like a bare
   pole holding a few moth-eaten sheets: edge-on the canopy vanished, and from
   above there was nothing there. A canopy here is a cluster of overlapping
   squashed ellipsoids ("lobes") that occupies the measured crown volume, so
   the tree has a silhouette from any angle and self-shadows into a mass. The
   structural limbs still exist, but every one of them ENDS INSIDE a lobe —
   `limbTo` aims each limb at a lobe centre — so no limb is ever a stick in
   open air. */

/** A limb instance running from `a` to `b` (unit cylinder, +Y, centred). */
function limbTo(a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz) || 0.01;
  /* A YXZ euler of (tilt, yaw) sends +Y to (sin·sin, cos, sin·cos), so the
     yaw is atan2(dx, dz) — not the negated pair the older collectors used,
     which only went unnoticed because their yaw was random anyway. */
  return {
    x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, z: (a[2] + b[2]) / 2,
    rot: Math.atan2(dx, dz),
    rotX: Math.acos(Math.max(-1, Math.min(1, dy / len))),
    scale: [1, len, 1],
  };
}

/**
 * The shared lobe body: a low sphere pushed around by a closed-form ripple so
 * it is a lumpy blob rather than a billiard ball. One geometry for every lobe
 * on the zone — the variety comes from the per-instance yaw and non-uniform
 * scale — and the displacement is a pure function of the vertex, so duplicated
 * seam and pole vertices move together and the surface stays closed.
 */
function lobeGeometry() {
  const geo = new THREE.SphereGeometry(1, 10, 7);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n =
      Math.sin(v.x * 3.1 + 1.7) * Math.sin(v.y * 2.6 + 0.4) * Math.sin(v.z * 3.7 + 2.2) +
      0.5 * Math.sin(v.x * 6.3 + 0.9) * Math.sin(v.z * 5.5 + 1.3);
    v.multiplyScalar(1 + n * 0.15);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

/** A lobe placement: squashed ellipsoid of horizontal radius `rad`. */
function lobe(x, y, z, rad, squash, rng) {
  return {
    x, y, z,
    rot: rng() * Math.PI * 2,
    scale: [rad, rad * squash, rad * (0.85 + rng() * 0.3)],
    tone: 0.82 + rng() * 0.36,
  };
}

/**
 * A ROOT FLARE: the short swelling where a trunk meets grade. A bare cylinder
 * cut off flat at the ground reads as a pole pushed into sand — real trunks
 * widen into a buttress over the last metre. Seated `sink` BELOW the drawn
 * surface as well, so a trunk on a slope never shows daylight under one side.
 */
function flare(x, g, z, height, sink) {
  return { x, y: g - sink + (height + sink) / 2, z, scale: [1, height + sink, 1] };
}

/**
 * Torrey pine: a broad FLATTENED UMBRELLA on a long clear bole. The crown is
 * a ring of big overlapping lobes at the measured radius with a shallower
 * inner cap, all squashed hard in Y — the species' signature is that it is
 * much wider than it is deep. Heavy ascending limbs reach from the bole top
 * out into the ring lobes.
 */
function collectPine(item, seed, ground, bins, boleFrac) {
  const { x, z, h, r } = item;
  const rng = treeRng(seed, x, z);
  const g = ground(x, z);
  const boleH = h * boleFrac; // clear bole 55-65% of height [measured]
  bins.pineTrunks.push({ x, y: g + boleH / 2, z, scale: [1, boleH, 1] });
  bins.pineFlares.push(flare(x, g, z, 1.1, 0.35));

  const crownH = h - boleH;
  const deck = g + boleH + crownH * 0.45; // the umbrella's underside plane
  const ring = [];

  /* The umbrella rim: 7-9 lobes round the measured crown radius. Their
     heights are scattered across a third of the crown depth rather than sitting
     on one plane — a rim at a single height renders as a clean disc, and a
     row of discs on poles is the silhouette this rework exists to kill. */
  const rimCount = 7 + Math.floor(rng() * 3);
  const phase = rng() * Math.PI * 2;
  for (let i = 0; i < rimCount; i++) {
    const a = phase + (i / rimCount) * Math.PI * 2 + (rng() - 0.5) * 0.3;
    const d = r * (0.48 + rng() * 0.2);
    const rad = r * (0.36 + rng() * 0.14);
    const p = [x + Math.sin(a) * d, deck + crownH * (0.02 + rng() * 0.3), z + Math.cos(a) * d];
    ring.push(p);
    bins[rng() < 0.55 ? "pineSun" : "pineShade"].push(lobe(p[0], p[1], p[2], rad, 0.62, rng));
  }
  /* The inner cap, sitting proud of the rim so the crown domes. */
  const capCount = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < capCount; i++) {
    const a = rng() * Math.PI * 2;
    const d = r * rng() * 0.3;
    const rad = r * (0.34 + rng() * 0.14);
    bins[i === 0 ? "pineSun" : "pineShade"].push(lobe(
      x + Math.sin(a) * d, deck + crownH * (0.32 + rng() * 0.18), z + Math.cos(a) * d, rad, 0.6, rng
    ));
  }
  /* A broken skirt hanging under the rim, so the underside is lumpy rather
     than a flat plate you can read as a cardboard cutout from below. */
  const skirt = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < skirt; i++) {
    const a = phase + rng() * Math.PI * 2;
    const d = r * (0.4 + rng() * 0.25);
    const rad = r * (0.26 + rng() * 0.1);
    bins[rng() < 0.5 ? "pineSun" : "pineShade"].push(lobe(
      x + Math.sin(a) * d, deck - crownH * (0.02 + rng() * 0.2), z + Math.cos(a) * d, rad, 0.6, rng
    ));
  }
  /* Heavy ascending limbs. Each one runs from the bole top to the CENTRE of
     a rim lobe, so it is buried in the canopy mass for its last few metres
     instead of ending as a stick in open air. */
  const from = [x, g + boleH * 0.9, z];
  for (let i = 0; i < ring.length; i += ring.length > 6 ? 2 : 1) {
    bins.pineLimbs.push(limbTo(from, ring[i]));
  }
}

/**
 * Eucalyptus: a pale pole carrying SMALL HIGH CLUMPS. Airy by species — the
 * clumps are small relative to the crown radius and sit in the top third —
 * but each clump is a solid little mass, not a sheet.
 */
function collectEucalyptus(item, seed, ground, bins) {
  const { x, z, h, r } = item;
  const rng = treeRng(seed, x, z);
  const g = ground(x, z);
  const trunkH = h * 0.62;
  bins.eucTrunks.push({ x, y: g + trunkH / 2, z, rot: rng() * Math.PI, scale: [1, trunkH, 1] });
  bins.eucFlares.push(flare(x, g, z, 0.8, 0.3));

  const from = [x, g + trunkH * 0.95, z];
  const clumps = 5 + Math.floor(rng() * 3);
  const phase = rng() * Math.PI * 2;
  for (let c = 0; c < clumps; c++) {
    /* Spaced round the pole, not scattered: purely random bearings leave a
       tree with three clumps on one side and a hole you can see through. */
    const a = phase + (c / clumps) * Math.PI * 2 + (rng() - 0.5) * 0.5;
    const d = r * (0.3 + rng() * 0.45);
    const p = [x + Math.sin(a) * d, g + h * (0.7 + rng() * 0.26), z + Math.cos(a) * d];
    const rad = Math.min(r * 0.42, 1.3 + rng() * 1.5);
    bins.eucLobes.push(lobe(p[0], p[1], p[2], rad, 0.8, rng));
    /* Two of the clumps are carried on a visible branch, run into the clump. */
    if (c < 2) bins.eucLimbs.push(limbTo(from, p));
  }
}

/**
 * Ficus: a DENSE BROAD DOME on the pale sinuous multi-stem trunk. The dome is
 * a solid core ellipsoid wrapped in two shells of overlapping lobes, so the
 * canopy is opaque from below and rounded from every side.
 */
function collectFicus(item, seed, ground, bins) {
  const { x, z, h, r } = item;
  const rng = treeRng(seed, x, z);
  const g = ground(x, z);
  /* Pale sinuous multi-stem trunk: 3-5 stems fusing low, leaning outward. */
  const stems = 3 + Math.floor(rng() * 3);
  const stemH = h * 0.5;
  /* Girth scales with the crown. A fixed 0.3 m stem under a 15 m dome reads
     as a canopy balanced on wires. */
  const girth = Math.max(1, r / 4.5);

  /* THE DOME IS BUILT FIRST, BECAUSE THE STEMS ARE AIMED INTO IT. The stems
     used to be raised blind to a fixed h * 0.5 and the dome hung at h * 0.7,
     and on a SLENDER tree those two do not meet: the dome's depth is capped by
     the crown radius (domeH below) while its height is set by h, so at (4,
     418.9) — h 13.6 against r 4.9 — the lowest lobe's underside sat 0.63 m
     above the highest stem tip and the canopy floated free of the trunk. Four
     of the six ficus happened to be squat enough to hide it. Aiming each stem
     at a lobe CENTRE makes the join structural rather than lucky, at any
     proportion, which is the contract this file states at the top of the tree
     section and which the pines already honour through limbTo. */
  const cy = g + h * 0.7;
  const domeH = Math.min(h - stemH, r * 1.1);
  const core = [x, cy, z];
  const shoulder = [];
  bins.ficusLobes.push(lobe(x, cy, z, r * 0.62, 0.72, rng));
  for (const [n, dFrac, yFrac, sFrac] of [[7, 0.62, -0.1, 0.42], [5, 0.34, 0.28, 0.4]]) {
    const phase = rng() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = phase + (i / n) * Math.PI * 2 + (rng() - 0.5) * 0.4;
      const d = r * dFrac * (0.85 + rng() * 0.3);
      const p = [
        x + Math.sin(a) * d, cy + domeH * (yFrac + (rng() - 0.5) * 0.12), z + Math.cos(a) * d,
      ];
      bins.ficusLobes.push(lobe(p[0], p[1], p[2], r * sFrac * (0.85 + rng() * 0.3), 0.7, rng));
      /* The shoulder ring is the low, outward shell — the natural landing for
         a stem that splays as it rises. The crown ring above it is not. */
      if (yFrac < 0) shoulder.push(p);
    }
  }

  /* Every stem rises from the ONE measured trunk and ends inside a lobe. The
     foot stays exactly on (x, z) so the stems still fuse under the single root
     flare below; limbTo carries the same yaw/tilt convention the limbs use, so
     a stem leans the way it moves. */
  const foot = [x, g, z];
  for (let s = 0; s < stems; s++) {
    const target = shoulder.length
      ? shoulder[Math.floor((s / stems) * shoulder.length)]
      : core;
    const stem = limbTo(foot, target);
    stem.scale = [girth, stem.scale[1], girth];
    bins.ficusStems.push(stem);
  }
  /* The stems fuse at the measured trunk, so the flare is one per TREE. */
  const ff = flare(x, g, z, 0.8 * girth, 0.25);
  ff.scale = [girth * 1.15, ff.scale[1], girth * 1.15];
  bins.ficusFlares.push(ff);
}

/** Coral tree: SPARSE OPEN lobes, widely spaced on a low multi-stem frame. */
function collectCoral(coral, seed, ground, bins) {
  const { x, z, h, spread } = coral;
  const rng = treeRng(seed, x, z);
  const g = ground(x, z);
  const stems = coral.stems || 3;
  const stemH = h * 0.55;
  /* The stem TIPS, kept so the limbs spring from them. Running every limb
     from the trunk axis instead — as this did — leaves each leaning stem
     ending 0.8-1.4 m out to the side with nothing at its tip, which is the
     same defect the ficus dome had: a frame that reads continuous in plan and
     is broken in elevation. */
  const tips = [];
  for (let s = 0; s < stems; s++) {
    const yaw = (s / stems) * Math.PI * 2 + rng() * 0.6;
    const lean = 0.18 + rng() * 0.14;
    const si = Math.sin(lean);
    const dir = [si * Math.sin(yaw), Math.cos(lean), si * Math.cos(yaw)];
    bins.coralStems.push({
      x: x + dir[0] * (stemH / 2), y: g + dir[1] * (stemH / 2), z: z + dir[2] * (stemH / 2),
      rot: yaw, rotX: lean, scale: [1, stemH, 1],
    });
    tips.push([x + dir[0] * stemH, g + dir[1] * stemH, z + dir[2] * stemH]);
  }
  bins.coralFlares.push(flare(x, g, z, 0.5, 0.2));
  const R = spread / 2;
  const n = 6;
  const phase = rng() * Math.PI * 2;
  for (let l = 0; l < n; l++) {
    const a = phase + (l / n) * Math.PI * 2 + (rng() - 0.5) * 0.5;
    const d = R * (0.3 + rng() * 0.45);
    const rad = R * (0.3 + rng() * 0.14);
    const p = [x + Math.sin(a) * d, g + h * (0.66 + rng() * 0.28), z + Math.cos(a) * d];
    bins.coralLobes.push(lobe(p[0], p[1], p[2], rad, 0.62, rng));
    /* Each stem carries two of the six limbs, so trunk -> stem -> limb -> lobe
       is one unbroken run. */
    bins.coralStems.push(limbTo(tips[l % stems], p));
  }
}

function buildTrees(section, group, ground, mats, counts) {
  const T = section.treeOverrides;
  const C = section.colors;
  const seed = section.seed;
  const bins = {
    pineTrunks: [], pineLimbs: [], pineSun: [], pineShade: [],
    eucTrunks: [], eucLimbs: [], eucLobes: [], ficusStems: [], ficusLobes: [],
    coralStems: [], coralLobes: [],
    pineFlares: [], eucFlares: [], ficusFlares: [], coralFlares: [],
  };
  for (const it of T.pines.items) collectPine(it, seed, ground, bins, T.pines.boleFrac);
  for (const it of T.eucalyptus.items) collectEucalyptus(it, seed, ground, bins);
  for (const it of T.ficus.items) collectFicus(it, seed, ground, bins);
  collectCoral(T.coral, seed, ground, bins);

  const lobeGeo = lobeGeometry();
  /* Named, because the tests address the canopy meshes directly — a gate that
     has to guess which child is foliage is a gate that stops working. */
  const add = (name, geo, mat, items) => {
    if (!items.length) return;
    const mesh = instanced(geo, mat, items, (it) => it);
    mesh.name = name;
    group.add(mesh);
  };
  /* Solid foliage: the procedural foliage class WITHOUT its alpha cut. The
     class's alpha channel is a leaf-clump silhouette meant for a card, and on
     a closed lobe it only punches holes; its albedo mottle and normal relief
     are exactly what a leaf mass wants, so they stay. FrontSide because these
     are closed surfaces. */
  const foliage = (color) => mats.get("foliage", {
    color, alphaTest: 0, side: THREE.FrontSide, repeat: [3, 2],
  });

  add("pine-trunks", new THREE.CylinderGeometry(0.3, 0.5, 1, 7),
    mats.get("barkPine", { color: C.pineBark, repeat: [2, 6] }), bins.pineTrunks);
  add("pine-flares", new THREE.CylinderGeometry(0.5, 0.95, 1, 7),
    mats.get("barkPine", { color: C.pineBark, repeat: [2, 1] }), bins.pineFlares);
  add("pine-limbs", new THREE.CylinderGeometry(0.09, 0.16, 1, 5),
    mats.get("barkPine", { color: C.pineBark, repeat: [1, 3] }), bins.pineLimbs);
  add("canopy-pine-sun", lobeGeo, foliage(C.pineFoliageSun), bins.pineSun);
  add("canopy-pine-shade", lobeGeo, foliage(C.pineFoliageShade), bins.pineShade);
  add("euc-trunks", new THREE.CylinderGeometry(0.18, 0.3, 1, 7),
    mats.get("barkEucalyptus", { color: C.eucTrunk, repeat: [2, 8] }), bins.eucTrunks);
  add("euc-flares", new THREE.CylinderGeometry(0.3, 0.55, 1, 7),
    mats.get("barkEucalyptus", { color: C.eucTrunk, repeat: [2, 1] }), bins.eucFlares);
  add("euc-limbs", new THREE.CylinderGeometry(0.07, 0.13, 1, 5),
    mats.get("barkEucalyptus", { color: C.eucTrunk, repeat: [1, 3] }), bins.eucLimbs);
  add("canopy-eucalyptus", lobeGeo, foliage(C.eucLeaf), bins.eucLobes);
  add("ficus-stems", new THREE.CylinderGeometry(0.12, 0.17, 1, 6),
    mats.get("smoothConcrete", { color: C.ficusTrunk, roughness: 0.8 }), bins.ficusStems);
  add("ficus-flares", new THREE.CylinderGeometry(0.17, 0.34, 1, 6),
    mats.get("smoothConcrete", { color: C.ficusTrunk, roughness: 0.8 }), bins.ficusFlares);
  add("canopy-ficus", lobeGeo, foliage(C.ficusLeaf), bins.ficusLobes);
  add("coral-stems", new THREE.CylinderGeometry(0.13, 0.19, 1, 6),
    mats.get("smoothConcrete", { color: C.coralBark, roughness: 0.75 }), bins.coralStems);
  add("coral-flares", new THREE.CylinderGeometry(0.19, 0.36, 1, 6),
    mats.get("smoothConcrete", { color: C.coralBark, roughness: 0.75 }), bins.coralFlares);
  add("canopy-coral", lobeGeo, foliage(C.coralLeaf), bins.coralLobes);

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
  counts.rootFlares =
    bins.pineFlares.length + bins.eucFlares.length +
    bins.ficusFlares.length + bins.coralFlares.length;
  counts.foliageCards = 0; // no canopy anywhere is a card any more
  counts.foliageLobes =
    bins.pineSun.length + bins.pineShade.length + bins.eucLobes.length +
    bins.ficusLobes.length + bins.coralLobes.length;
}

/* ----------------------------------------------------------------- ground */

/**
 * A rounded-rectangle decal panel — the plaza's signature struck corner.
 * Carried over verbatim from the module that used to own the paving.
 */
function roundedPanel(size, radius) {
  const h = size / 2;
  const r = Math.min(radius, h);
  const shape = new THREE.Shape();
  shape.moveTo(-h + r, -h);
  shape.lineTo(h - r, -h);
  shape.quadraticCurveTo(h, -h, h, -h + r);
  shape.lineTo(h, h - r);
  shape.quadraticCurveTo(h, h, h - r, h);
  shape.lineTo(-h + r, h);
  shape.quadraticCurveTo(-h, h, -h, h - r);
  shape.lineTo(-h, -h + r);
  shape.quadraticCurveTo(-h, -h, -h + r, -h);
  const g = new THREE.ShapeGeometry(shape, 6);
  g.rotateX(-Math.PI / 2);
  return g;
}

/**
 * The plaza deck: 51 panels on the measured joint grid.
 *
 * Brick first at cell pitch, then the buff panel inset by the band width, so
 * what shows around each panel IS the band — real geometry rather than a
 * texture, and it fans correctly around the struck corners because the panel
 * above it is round. Three rungs of the overlay ladder in painting order, so
 * this paints over campus-world's own measured plaza fill in a fixed order.
 */
function buildPaving(section, group, ground, mats, counts) {
  const { colors, paving } = section;
  const { pitch, band, radius, runnerX, runnerWidth, runnerLength } = paving;

  const brickField = instanced(
    quad(pitch, pitch),
    decal(mats.get("brick", { color: colors.brick, repeat: [pitch / 0.8, pitch / 0.8] }), PAD),
    paving.cells,
    ([x, z]) => ({ x, y: ground(x, z) + overlayLift(PAD), z })
  );
  brickField.name = "paving-brick";
  brickField.renderOrder = OVERLAY[PAD].renderOrder;
  brickField.castShadow = false;
  group.add(brickField);

  const panels = instanced(
    roundedPanel(pitch - band, radius),
    decal(mats.get("pavingConcreteUnit", {
      color: colors.paving, repeat: [(pitch - band) / 0.5, (pitch - band) / 0.5],
    }), CARPET),
    paving.cells,
    ([x, z]) => ({ x, y: ground(x, z) + overlayLift(CARPET), z })
  );
  panels.name = "paving-panels";
  panels.renderOrder = OVERLAY[CARPET].renderOrder;
  panels.castShadow = false;
  group.add(panels);

  const runner = instanced(
    quad(runnerWidth, runnerLength),
    decal(mats.get("brick", {
      color: colors.brickRunner, repeat: [runnerWidth / 0.8, runnerLength / 0.8],
    }), PAINT),
    paving.runner,
    (z) => ({ x: runnerX, y: ground(runnerX, z) + overlayLift(PAINT), z })
  );
  runner.name = "paving-runner";
  runner.renderOrder = OVERLAY[PAINT].renderOrder;
  runner.castShadow = false;
  group.add(runner);

  counts.pavingCells = paving.cells.length;
}

function buildLawns(section, group, ground, mats, counts) {
  const { lawns, colors } = section;
  lawns.panels.forEach((p, i) => {
    const mesh = conformingSheet(p, ground, CARPET, flat(colors.lawn));
    mesh.name = `lawn-panel-${i}`;
    group.add(mesh);
  });
  /* The 1.30 m mow strip that actually crosses the lawn, where the retired
     cross-walk claimed a 6 m paved walk. It is a band, so it is laid at the
     brick rung and reads as an edging course rather than as a path. */
  const e = lawns.edging;
  if (e) {
    const band = conformingSheet(e, ground, PAD, mats.get("brick", {
      color: colors.brick, repeat: [(e.x1 - e.x0) / 0.8, (e.z1 - e.z0) / 0.8],
    }));
    band.name = "lawn-edging";
    group.add(band);
  }
  counts.lawnPanels = lawns.panels.length;
  counts.lawnEdging = e ? 1 : 0;
}

/**
 * The plaza's north third: 38.8 x 13.6 m of dormant, unirrigated turf.
 *
 * Surveyed three times over and built by nobody until R1. It is NOT painted
 * the south lawns' green: OSM and the facilities GIS both call it `green` and
 * the newest imagery shows it dormant, which is two sources describing two
 * different years, and repainting it would be inventing irrigation. The
 * conflict is declared in the section; the outline is the mean of the two
 * surveys.
 */
function buildNorthBed(section, group, ground, mats, counts) {
  const b = section.northBed;
  const mesh = conformingSheet(b, ground, CARPET, mats.get("decomposedGranite", {
    color: section.colors.northBedTurf,
    repeat: [(b.x1 - b.x0) / 1.4, (b.z1 - b.z0) / 1.4],
  }));
  mesh.name = "north-bed";
  group.add(mesh);
  counts.northBed = 1;
}

/** The five surveyed planting beds inside the plaza window. */
function buildBeds(section, group, ground, mats, counts) {
  section.beds.items.forEach((b, i) => {
    const mesh = conformingSheet(b, ground, PAD, mats.get("decomposedGranite", {
      color: section.colors.bedMulch,
      repeat: [(b.x1 - b.x0) / 1.0, (b.z1 - b.z0) / 1.0],
    }));
    mesh.name = `bed-${i}`;
    group.add(mesh);
  });
  counts.beds = section.beds.items.length;
}

/* The decomposed-granite belt under the York-belt pines. [estimated] extent,
   except its south edge, which is Galbraith's measured ring. */
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
 * signature. Crossings are derived from this section's OWN paving cells:
 * where four cells meet, each panel corner is struck with the 1.8 m radius,
 * and a fan of small brick wedges follows each arc so the coursing turns with
 * it instead of butting into the curve.
 */
function buildBrickArcs(section, group, ground, mats, counts) {
  const A = section.arcs;
  const paving = section.paving;
  if (!paving?.cells?.length) { counts.brickArcCrossings = 0; return; }
  const P = A.pitch;
  const key = ([x, z]) => `${Math.round(x * 10)},${Math.round(z * 10)}`;
  const have = new Set(paving.cells.map(key));
  const crossings = [];
  for (const [x, z] of paving.cells) {
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

  /* The square plinth: charcoal sides, light concrete deck, sit-on edge.
     ITS SIDES ARE BATTERED — they lean inward toward grade, which UCSD DC
     bb5393567s resolves unmistakably at the near corner and which the shipped
     prism did not have. A four-sided cone rotated 45 degrees is a truncated
     pyramid on the world axes: radius r puts a corner at r, so a square of
     side s needs r = s / sqrt(2). */
  const half = Math.SQRT1_2;
  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(F.plinth * half, F.plinthBase * half, F.plinthHeight, 4),
    mats.get("smoothConcrete", { color: C.plinthCharcoal })
  );
  plinth.rotation.y = Math.PI / 4;
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

  /* The jet: a central foam plume, plus a RING OF DISCRETE ARCING STREAMS.
     The shipped model was a smooth cone skirt, which is an approximation of
     something the archive frame shows is countable: bb5393567s resolves
     individual arcs springing from the basin rim and falling inward toward
     the plume. Each stream is a quadratic Bezier tube from its nozzle up to
     an apex and down toward the centre, so the ring reads as water thrown
     rather than as a translucent cone. */
  const J = F.jet;
  const foamMat = new THREE.MeshStandardMaterial({
    color: C.foam, roughness: 0.9, metalness: 0, transparent: true, opacity: 0.8, depthWrite: false,
  });
  const core = new THREE.Mesh(new THREE.CylinderGeometry(J.coreRadius, J.coreRadius * 0.5, J.coreHeight, 10), foamMat);
  core.position.y = F.plinthHeight - F.basinDepth + J.coreHeight / 2;
  sub.add(core);

  const rim = F.plinthHeight - F.basinDepth;
  const streamMat = new THREE.MeshStandardMaterial({
    color: C.foam, roughness: 0.9, metalness: 0, transparent: true, opacity: 0.55, depthWrite: false,
  });
  /* One geometry in the ring's local frame, instanced round the yaw — every
     arc is the same throw, so the variety is entirely the bearing. */
  const arc = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(J.nozzleRadius, 0, 0),
    new THREE.Vector3(J.nozzleRadius - J.nozzleReach / 2, J.nozzleRise * 1.6, 0),
    new THREE.Vector3(Math.max(J.nozzleRadius - J.nozzleReach, J.coreRadius), J.nozzleRise * 0.15, 0)
  );
  const streamGeo = new THREE.TubeGeometry(arc, 10, J.streamRadius, 4, false);
  const streams = [];
  for (let i = 0; i < J.nozzles; i++) {
    streams.push({ x: 0, y: rim, z: 0, rot: (i / J.nozzles) * Math.PI * 2 });
  }
  const ring = instanced(streamGeo, streamMat, streams, (it) => it);
  ring.name = "fountain-nozzles";
  ring.castShadow = false;
  sub.add(ring);

  group.add(sub);
  counts.fountain = 1;
  counts.fountainNozzles = J.nozzles;
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
  /* Crossarm with a banner hanging each side — the photographed pair. Only
     on the poles the section FLAGS as bannered: the two posts standing in the
     north bed are a plan read off measured pads, and nothing resolves a
     banner on them, so they do not get one. A banner pair is a separate,
     separately-sourced claim from a pole's position. */
  const bannered = L.items.filter((it) => it.banner);
  group.add(instanced(new THREE.BoxGeometry(1.6, 0.05, 0.05), poleMat, bannered,
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
    for (const it of bannered) for (const side of [-0.55, 0.55]) items.push({ it, side });
    group.add(instanced(geo, cloth(bit.color), items, ({ it, side }) => ({
      x: it.x + Math.cos(it.rot) * side,
      y: on(it) + L.bannerBottomY + bh * bit.off,
      z: it.z - Math.sin(it.rot) * side,
      rot: it.rot,
    })));
  }
  counts.lamps = L.items.length;
  counts.banners = bannered.length * 2;
}

function buildBenches(section, group, ground, mats, counts) {
  const B = section.furniture.benches;
  const C = section.colors;
  /* HELD OUT OF THE DRAW, KEPT IN THE RECORD. The three south-row objects are
     measured where the shipped scooter centreline runs — 0.48 m from it at
     the closest — and the campus-wide rule is 3 m. The objects are not wrong
     and the route is not this module's to move, so they are skipped here and
     the conflict is declared in the section for arbitration. Deleting the
     measurement, or relaxing the clearance gate, would both be worse. */
  const items = B.items.filter((it) => !it.held);
  const mat = mats.get("smoothConcrete", { color: C.benchConcrete });
  group.add(instanced(new THREE.BoxGeometry(B.length, B.slab, B.depth), mat, items,
    (it) => ({ x: it.x, y: ground(it.x, it.z) + B.seatHeight - B.slab / 2, z: it.z, rot: it.rot })));
  /* Flared pedestal legs: 4-sided cylinders wider at the ground. */
  const legGeo = new THREE.CylinderGeometry(0.17, 0.26, B.seatHeight - B.slab, 4);
  const legs = [];
  for (const it of items) for (const side of [-1, 1]) legs.push({ it, side });
  group.add(instanced(legGeo, mat, legs, ({ it, side }) => ({
    x: it.x + Math.cos(it.rot) * side * (B.length / 2 - B.legInset),
    y: ground(it.x, it.z) + (B.seatHeight - B.slab) / 2,
    z: it.z - Math.sin(it.rot) * side * (B.length / 2 - B.legInset),
    rot: it.rot + Math.PI / 4,
  })));
  counts.benches = items.length;
  counts.benchesHeld = B.items.length - items.length;
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
  /* RETIRED 2026-08-21 (R2 arbitration item R2): the November 2024 photosphere
     that retired revelle's rack hoops over this same ground shows no bicycles
     on it either, so count is 0 and nothing is drawn. The block stays in the
     section with its 2012 read — see superseded['furniture.bikes'] — and the
     draw returns the moment a count comes back, so this is a retirement and
     not a deletion. Returning early rather than emitting empty instanced
     meshes keeps counts.draws honest about what is on screen. */
  if (!K || !K.count) { counts.bikes = 0; return; }
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
 * `photo` is the loaded photo-detail document; this reads ONLY its `plaza`
 * section — R1 moved the paving field in here, so the module no longer
 * reaches across into `revelle` for it — and returns `{ group, counts }`,
 * empty and harmless when the section is missing. Everything stands on
 * `surfaceAt`, the height of the DRAWN terrain triangle; `heightAt` is only
 * the fallback for an older call site.
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

  const mats = sharedMaterialLibrary(THREE);
  const counts = {};
  buildTrees(section, group, ground, mats, counts);
  /* The four ground systems R1 added or moved in are guarded, for the same
     reason a missing section is a quiet no-op: a document that predates the
     merge is a half-wired boot, and a half-wired boot should render what it
     has rather than throw. Each guard is a presence check on the section's
     own data, never a default value — a missing block means the feature is
     ABSENT, and the counts say so. */
  if (section.paving) buildPaving(section, group, ground, mats, counts);
  buildLawns(section, group, ground, mats, counts);
  if (section.northBed) buildNorthBed(section, group, ground, mats, counts);
  if (section.beds) buildBeds(section, group, ground, mats, counts);
  buildDgBelt(section, group, ground, mats);
  buildBrickArcs(section, group, ground, mats, counts);
  buildFountain(section, group, ground, mats, counts);
  buildMemorial(section, group, ground, mats, counts);
  buildLamps(section, group, ground, counts);
  buildBenches(section, group, ground, mats, counts);
  buildBinPairs(section, group, ground, mats, counts);
  buildBikes(section, group, ground, counts);
  buildTerraces(section, group, ground, mats, counts);
  /* Retired from the draw, kept in the record: the invented 6 m cross-walk and
     the fountain-geometry absent entry are still fully described in the
     section and are read by nothing here. Reported so the count gate can see
     that a supersession has not quietly widened. */
  counts.superseded = Object.keys(section.superseded || {}).length;
  counts.draws = group.children.length;

  scene?.add(group);
  return { group, counts };
}
