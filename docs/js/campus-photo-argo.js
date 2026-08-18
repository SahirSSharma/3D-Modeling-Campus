// Argo Hall, from photographs — the INVENTED class.
//
// Tucker, Sadler & Bennett, 1967, for Revelle College; renovated and repainted
// WHITE in 2015 (Vasquez Marshall / Webcor). NOT a Fleet hall — the Fleet is a
// different, earlier brick group. The only things this file takes from the
// survey are where Argo stands and how tall it is: the measured 'Argo Hall'
// ring and its 22.8 m LiDAR height. Every facade layer hangs off two MEASURED
// ring vertices named in the photo document's `facades` list and floats at
// most half a metre proud of that face. The measured massing is never moved.
//
// Three things decided the shape of this file:
//
//   1. The building solves on the LiDAR height OF THE DRAWN MASS. 18.7 m
//      (campus-lidar massHeights, the height campus-massing.js extrudes) is
//      six levels of ~2.92 m plus a 1.2 m parapet with zero residual — so the
//      storey grid is the measured height read back, closing exactly against
//      the drawn roof deck, and the inventory's assumed 3.05 m anchor is
//      declared [estimated] in the data rather than built. (campus-3d's 22.8
//      for this ring is the OSM levels guess, not LiDAR — solved on it, the
//      shell stood a full storey proud of the deck as a see-through screen.)
//
//   2. Bays are COUNTS, not metres. ~30 bays per elevation is the
//      foreshortening-immune photogrammetric fact; the module is the measured
//      face length divided by that count. Per-bay geometry is carried as
//      fractions of the bay and the storey, which survive any anchor change.
//
//   3. The fins are CANTED precast window surrounds, not flat blades. Each
//      opening sits between two splayed reveals — one lit face, one shadowed
//      face per bay — which is what produces the sawtooth that changes with
//      sun angle. They are built as two opposed angled planes per bay; a flat
//      mullion or a symmetric fin will not reproduce it.
//
// The staging scooter route passes 1.6-2.3 m off the east face, so the sourced
// east-frontage planter/hedge/racks are NOT built (declared in `absent`), and
// every ground-floor element stays within 0.5 m of the measured wall.
//
// Colours are DATA — every hex comes from the section's `colors` block,
// sampled from the Nov 2024 daylight photosphere; the pre-2014 tan is a dead
// epoch and appears nowhere. Surfaces come from the procedural material
// library (campus-materials.js); deterministic — the library is seeded and
// this file's own irregularity comes from `hash`.
import * as THREE from "../vendor/three/three.module.min.js";
import { applyOverlayDepth, OVERLAY, overlayLift } from "./campus-overlay.js";
import { createMaterialLibrary } from "./campus-materials.js";

const PAD = "pad";

let LIB = null;
const lib = () => (LIB ??= createMaterialLibrary(THREE));

const concrete = (color) => lib().get("smoothConcrete", { color });
const painted = (color) => lib().get("metalPanel", { color, metalness: 0.35, roughness: 0.55 });
const wood = (color, repeat) => lib().get("woodSlat", { color, repeat });
const glassMat = (color) => lib().get("glass", { color });
const foliage = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0.0 });
/* The colonnade recess is the photographed near-black VOID, not glazing: a
   fully matte plane, so the IBL/env reflections cannot lift it into the pale
   striped screen the audit failed it for. */
const matte = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 1.0, metalness: 0.0, envMapIntensity: 0.15 });

function decal(color, rung, cls = "smoothConcrete", repeat) {
  return applyOverlayDepth(lib().get(cls, { color, repeat }), rung);
}

/** Deterministic 0..1 from any integer mix — a reload rebuilds the same facade. */
function hash(...ns) {
  let s = 0;
  for (let i = 0; i < ns.length; i++) s = s * 131.71 + ns[i] * 57.13 + 7.9;
  const v = Math.sin(s) * 43758.5453;
  return v - Math.floor(v);
}

/** One InstancedMesh from a list of placements. */
function instanced(geo, mat, items, place) {
  const mesh = new THREE.InstancedMesh(geo, mat, items.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const pos = new THREE.Vector3();
  items.forEach((it, i) => {
    const p = place ? place(it, i) : it;
    e.set(p.rotX || 0, p.rot || 0, 0, "YXZ");
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
 * A facade's own coordinate frame from the two MEASURED ring vertices the data
 * names. `at(u, w, y)` is u metres along the face from its start, w metres
 * proud of it, y in world height.
 */
function frameOf(f) {
  const [ax, az] = f.a;
  const [bx, bz] = f.b;
  const nl = Math.hypot(f.out[0], f.out[1]);
  const nx = f.out[0] / nl;
  const nz = f.out[1] / nl;
  const tx = nz;
  const tz = -nx;
  let sx = ax, sz = az, ex = bx, ez = bz;
  if ((ex - sx) * tx + (ez - sz) * tz < 0) {
    sx = bx; sz = bz; ex = ax; ez = az;
  }
  const length = Math.hypot(ex - sx, ez - sz);
  return {
    id: f.id,
    length,
    rot: Math.atan2(nx, nz),
    at: (u, w, y) => ({ x: sx + tx * u + nx * w, y, z: sz + tz * u + nz * w }),
  };
}

/* ---------------------------------------------------------------- facades */

/* The standard Argo bay, applied to every face — the three sourced faces and
   the [estimated] west, which extends the identical module with NO door. */
function collectFace(section, f, frame, base, ground, bins) {
  const G = section.grid;
  const S = section.system;
  const F = G.floorToFloor;
  const module = frame.length / G.longFaceBays;
  const { rot, length } = frame;
  const winW = module * S.window.widthFrac;
  const spandrelH = F * S.bands.spandrelFrac;
  const awningH = F * S.bands.awningFrac;
  const winH = F - spandrelH - awningH;

  for (let s = 1; s <= G.finStoreys; s++) {
    const y0 = base + s * F;

    /* Continuous spandrel band under the window band of this storey. */
    bins.spandrels.push({
      ...frame.at(length / 2, 0.03, y0 + spandrelH / 2),
      rot,
      scale: [length, spandrelH, 0.06],
    });

    for (let i = 0; i < G.longFaceBays; i++) {
      const u = (i + 0.5) * module;

      /* Frosted / sky-reflecting window glass, recessed behind the reveals.
         The dominant read is blind-down frosted [measured]; a deterministic
         quarter reflect sky. */
      const sky = hash(3, s, i, Math.round(length)) < 0.25;
      (sky ? bins.glassSky : bins.glassFrosted).push({
        ...frame.at(u, 0.02, y0 + spandrelH + awningH + winH / 2),
        rot,
        scale: [winW - 0.06, winH - 0.12, 1],
      });

      /* The bottom-hinged awning sash below the window, projecting outward —
         the small dark angled wedges all over the elevation. */
      bins.awnings.push({
        ...frame.at(u, S.awning.proud, y0 + spandrelH + awningH / 2),
        rot,
        rotX: S.awning.tilt,
        scale: [winW - 0.08, 0.05, S.awning.depth],
      });

      /* The canted precast surrounds: two opposed splayed reveals per bay —
         one lit face, one shadowed face. This is the sawtooth. */
      for (const side of [-1, 1]) {
        const bin = side < 0 ? bins.revealL : bins.revealR;
        bin.push({
          ...frame.at(u + (side * winW) / 2, S.cant.depth / 2, y0 + F / 2),
          rot: rot + side * S.cant.angle,
          scale: [S.cant.thickness, F - 0.1, S.cant.depth],
        });
      }
    }

    /* Pier faces on the bay boundaries. */
    for (let i = 0; i <= G.longFaceBays; i++) {
      bins.piers.push({
        ...frame.at(i * module, S.pier.proud, y0 + F / 2),
        rot,
        scale: [module - winW - 0.04, F, S.pier.thickness],
      });
    }

    /* The corner bracket/nub at every floor level — the stack of five small
       cantilevered blocks in webcor-argo-N17.jpg. */
    for (const u of [0.35, length - 0.35]) {
      bins.nubs.push({
        ...frame.at(u, S.corner.nubProud, y0 + S.corner.nub[1] / 2),
        rot,
        scale: S.corner.nub,
      });
    }
  }

  /* Parapet band with drip cap and panel joints at every 2 bays. */
  const P = S.parapet;
  const pY = base + (G.finStoreys + 1) * F;
  bins.parapets.push({
    ...frame.at(length / 2, P.proud, pY + P.height / 2),
    rot,
    scale: [length, P.height, P.thickness],
  });
  bins.drips.push({
    ...frame.at(length / 2, P.proud + 0.03, pY + P.height - P.dripCap / 2),
    rot,
    scale: [length, P.dripCap, P.thickness + 0.06],
  });
  for (let i = P.jointEveryBays; i < G.longFaceBays; i += P.jointEveryBays) {
    bins.joints.push({
      ...frame.at(i * module, P.proud + P.thickness / 2 + 0.005, pY + P.height / 2),
      rot,
      scale: [0.03, P.height - 0.15, 0.02],
    });
  }

  /* Wider blank pilaster returns at the corners. */
  for (const u of [S.corner.pilasterWidth / 2, length - S.corner.pilasterWidth / 2]) {
    bins.pilasters.push({
      ...frame.at(u, S.corner.proud, base + F + (G.finStoreys * F + P.height) / 2),
      rot,
      scale: [S.corner.pilasterWidth, G.finStoreys * F + P.height, S.corner.thickness],
    });
  }

  /* Ground floor: near-black recess glazing tight to the wall, square columns
     just proud of it, a deep soffit fascia where the mass oversails. All of it
     stays within 0.5 m of the measured face — the staging route passes 1.6 m
     off the east face and must keep clearance. */
  const GR = S.ground;
  /* The recess glazing and the columns stand ON the rolling terrain. The flat
     base is the rim-median seat, so on Argo's sloped site they extend DOWN to
     the drawn surface — mirroring the measured massing's wall skirt — instead
     of hanging 0.6 m off it beside the correctly-seated boardwalk. */
  let gmin = base;
  const samples = Math.max(2, Math.ceil(length / 2));
  for (let i = 0; i <= samples; i++) {
    const p = frame.at((i * length) / samples, 0.03, 0);
    const g = ground(p.x, p.z);
    if (Number.isFinite(g) && g < gmin) gmin = g;
  }
  const recessBottom = gmin - 0.3;
  const recessTop = base + GR.glazingHeight;
  bins.recess.push({
    ...frame.at(length / 2, 0.03, (recessBottom + recessTop) / 2),
    rot,
    scale: [length - 0.4, recessTop - recessBottom, 1],
  });
  for (let i = 0; i < G.longFaceBays; i += GR.columnSpacingBays) {
    const p = frame.at((i + 0.5) * module, GR.columnProud + GR.columnSize / 2, 0);
    const g = ground(p.x, p.z);
    const bottom = Math.min(base, Number.isFinite(g) ? g : base) - 0.15;
    const top = base + F;
    bins.columns.push({
      x: p.x, y: (bottom + top) / 2, z: p.z,
      rot,
      scale: [GR.columnSize, top - bottom, GR.columnSize],
    });
  }
  bins.soffits.push({
    ...frame.at(length / 2, 0.12, base + F - GR.soffitFascia / 2),
    rot,
    scale: [length, GR.soffitFascia, 0.24],
  });
}

/* ------------------------------------------------------------------- roof */

/* The measured extrusion is SOLID, so the light-well is a roof-plane read:
   dark L-shaped void decal, thick raised kerb ring, the white core block hard
   against the WEST side, the north-edge trellis strip and the emergent tree
   crown the ortho shows. Plan is measured off the ortho (registered to the
   drawn mass — see roof.source); every height is [estimated], and the data
   says so. */
function buildRoof(section, group, roofY, bins) {
  const R = section.roof;
  const { colors } = section;
  const unit = new THREE.BoxGeometry(1, 1, 1);

  /* The weathered membrane over the whole drawn plate: procedural class,
     ortho-sampled colour, plus hash-scattered grey and pink-brown stain
     decals — the map stays grey, so the stain HUES ride as sourced colours. */
  const verts = section.measured.mass?.ring ?? section.measured.ring;
  const xs = verts.map((p) => p[0]);
  const zs = verts.map((p) => p[1]);
  const px0 = Math.min(...xs) + 0.15, px1 = Math.max(...xs) - 0.15;
  const pz0 = Math.min(...zs) + 0.15, pz1 = Math.max(...zs) - 0.15;
  const M = R.membrane;
  const memb = new THREE.Mesh(
    quad(px1 - px0, pz1 - pz0),
    decal(colors.membraneWhite, PAD, "roofMembrane",
      [(px1 - px0) / (4 * M.jointSpacing), (pz1 - pz0) / (4 * M.jointSpacing)])
  );
  memb.position.set((px0 + px1) / 2, roofY + 0.02, (pz0 + pz1) / 2);
  memb.renderOrder = OVERLAY[PAD].renderOrder;
  memb.name = "roof-membrane";
  group.add(memb);
  const ST = M.stains;
  const stains = [];
  for (let i = 0; i < ST.count; i++) {
    const r = ST.minR + (ST.maxR - ST.minR) * hash(11, i);
    stains.push({
      x: px0 + r + (px1 - px0 - 2 * r) * hash(12, i),
      z: pz0 + r + (pz1 - pz0 - 2 * r) * hash(13, i),
      r,
      pink: hash(14, i) < 0.45,
    });
  }
  const stainGeo = new THREE.CircleGeometry(1, 10);
  stainGeo.rotateX(-Math.PI / 2);
  for (const pink of [false, true]) {
    const set = stains.filter((s) => s.pink === pink);
    if (!set.length) continue;
    const mat = applyOverlayDepth(
      new THREE.MeshStandardMaterial({
        color: pink ? colors.stainPink : colors.stainGrey,
        roughness: 0.95, metalness: 0, transparent: true, opacity: 0.75,
      }), "paint");
    const mesh = instanced(stainGeo, mat, set,
      (s) => ({ x: s.x, y: roofY + 0.03, z: s.z, scale: [s.r, 1, s.r * (0.6 + 0.6 * hash(15, s.r))] }));
    mesh.renderOrder = OVERLAY.paint.renderOrder;
    mesh.castShadow = false;
    mesh.name = pink ? "roof-stains-pink" : "roof-stains-grey";
    group.add(mesh);
  }

  /* Raised parapet coping along every face — a white band standing proud of
     the membrane with a slight outward overhang, so it carries its own
     shadow line the way the ortho's does. */
  const copes = [];
  for (const f of section.facades) {
    const frame = frameOf(f);
    copes.push({
      ...frame.at(frame.length / 2, -R.coping.width / 2 + R.coping.overhang, roofY + R.coping.height / 2),
      rot: frame.rot,
      scale: [frame.length, R.coping.height, R.coping.width],
    });
  }
  group.add(instanced(unit, concrete(colors.kerbWhite), copes));

  /* The light-well: the dark void is L-SHAPED — the white core block owns the
     west side, so the void decal is drawn as two rectangles (the east limb
     and the south limb) instead of one square over everything. */
  const W = R.lightWell;
  const C = R.core;
  const voidMat = decal(colors.wellShade, "carpet");
  const limbs = [
    /* east limb: everything right of the core, full depth of the well */
    { x0: C.x1, z0: W.z0, x1: W.x1, z1: W.z1 },
    /* west strip under the north trellis */
    { x0: W.x0, z0: W.z0, x1: C.x1, z1: R.trellis.z1 },
    /* west strip above the core (between trellis strip and core top) */
    { x0: W.x0, z0: R.trellis.z1, x1: C.x1, z1: C.z0 },
    /* west slot below the core, down to the wing / south edge */
    { x0: W.x0, z0: C.z1, x1: C.x1, z1: W.z1 },
    /* sliver west of the core, if the core clears the well edge */
    { x0: W.x0, z0: C.z0, x1: C.x0, z1: C.z1 },
  ];
  for (const L of limbs) {
    if (L.x1 - L.x0 < 0.05 || L.z1 - L.z0 < 0.05) continue;
    const m = new THREE.Mesh(quad(L.x1 - L.x0, L.z1 - L.z0), voidMat);
    m.position.set((L.x0 + L.x1) / 2, roofY + 0.04, (L.z0 + L.z1) / 2);
    m.renderOrder = OVERLAY.carpet.renderOrder;
    m.name = "roof-well";
    group.add(m);
  }

  /* The thick raised kerb ring around the well. */
  const K = R.kerb;
  const wellW = W.x1 - W.x0;
  const wellD = W.z1 - W.z0;
  const kerbs = [
    { x: (W.x0 + W.x1) / 2, z: W.z0 - K.width / 2, scale: [wellW + 2 * K.width, K.height, K.width] },
    { x: (W.x0 + W.x1) / 2, z: W.z1 + K.width / 2, scale: [wellW + 2 * K.width, K.height, K.width] },
    { x: W.x0 - K.width / 2, z: (W.z0 + W.z1) / 2, scale: [K.width, K.height, wellD] },
    { x: W.x1 + K.width / 2, z: (W.z0 + W.z1) / 2, scale: [K.width, K.height, wellD] },
  ];
  group.add(instanced(unit, concrete(colors.kerbWhite), kerbs,
    (k) => ({ ...k, y: roofY + K.height / 2 })));

  /* The white core block hard against the WEST side of the well, and its
     lower south wing — raised blocks, rises [estimated]. */
  const coreBlocks = [
    { x0: C.x0, z0: C.z0, x1: C.x1, z1: C.z1, rise: C.rise },
    C.wing && { x0: C.wing.x0, z0: C.wing.z0, x1: C.wing.x1, z1: C.wing.z1, rise: C.wing.rise },
  ].filter(Boolean);
  const coreMesh = instanced(unit, concrete(colors.coreTop), coreBlocks, (b) => ({
    x: (b.x0 + b.x1) / 2, y: roofY + b.rise / 2, z: (b.z0 + b.z1) / 2,
    scale: [b.x1 - b.x0, b.rise, b.z1 - b.z0],
  }));
  coreMesh.name = "roof-core";
  group.add(coreMesh);

  /* The slatted trellis: a strip along the NORTH edge of the well ONLY,
     slats running north-south. */
  const T = R.trellis;
  const slats = [];
  for (let i = 0; i < T.slats; i++) {
    const x = T.x0 + ((i + 0.5) * (T.x1 - T.x0)) / T.slats;
    slats.push({
      x, y: roofY + T.rise, z: (T.z0 + T.z1) / 2,
      scale: [T.slat[0], T.slat[1], T.z1 - T.z0 - 0.1],
    });
  }
  group.add(instanced(unit, painted(colors.trellisWhite), slats));

  /* The dark recess west of the well ring, with its pale kerb on the west
     and south edges. */
  const V = R.westRecess;
  if (V) {
    const rm = new THREE.Mesh(quad(V.x1 - V.x0, V.z1 - V.z0), decal(colors.recessShade, "carpet"));
    rm.position.set((V.x0 + V.x1) / 2, roofY + 0.04, (V.z0 + V.z1) / 2);
    rm.renderOrder = OVERLAY.carpet.renderOrder;
    rm.name = "roof-west-recess";
    group.add(rm);
    group.add(instanced(unit, concrete(colors.kerbWhite), [
      { x: V.x0 - V.kerbWidth / 2, z: (V.z0 + V.z1) / 2, scale: [V.kerbWidth, V.kerbHeight, V.z1 - V.z0 + 2 * V.kerbWidth] },
      { x: (V.x0 + V.x1) / 2, z: V.z1 + V.kerbWidth / 2, scale: [V.x1 - V.x0, V.kerbHeight, V.kerbWidth] },
    ], (k) => ({ ...k, y: roofY + V.kerbHeight / 2 })));
  }

  /* The tree in the well — emergent crown only, [estimated]. */
  const tree = instanced(
    new THREE.ConeGeometry(1, 1, 7),
    foliage(colors.treeGreen),
    [{ x: R.tree.x, y: roofY + R.tree.height / 2, z: R.tree.z, scale: [R.tree.radius, R.tree.height, R.tree.radius] }]
  );
  group.add(tree);

  /* SQUARE mechanical curbs with dark centres — plan measured off the ortho,
     heights [estimated]. A white curb box carries a smaller dark core; where
     the core covers the unit (or `core` is 0 on a grey unit) one box does. */
  const Q = R.curbs;
  const curbW = [];
  const curbD = [];
  for (const c of Q.items) {
    const [sw, sd] = Array.isArray(c.s) ? c.s : [c.s, c.s];
    if (!c.core || c.core >= Math.min(sw, sd)) {
      curbD.push({ x: c.x, z: c.z, scale: [sw, Q.coreHeight, sd] });
      continue;
    }
    curbW.push({ x: c.x, z: c.z, scale: [sw, Q.height, sd] });
    if (c.core > 0) curbD.push({ x: c.x, z: c.z, scale: [c.core, Q.coreHeight, c.core] });
  }
  group.add(instanced(unit, concrete(colors.curbWhite), curbW,
    (c) => ({ ...c, y: roofY + Q.height / 2 })));
  group.add(instanced(unit, painted(colors.curbDark), curbD,
    (c) => ({ ...c, y: roofY + Q.coreHeight / 2 })));
  bins.counts.curbs = Q.items.length;
}

/* ----------------------------------------------------------------- ground */

/* Argo's own north-entry apron: the post-2015 boardwalk, the corten-edged
   planter (its tree is LiDAR/plaza-owned and stays absent) and the wood-slat
   bench. The east frontage builds NOTHING — see the section's absent list. */
function buildGround(section, group, ground) {
  const N = section.ground.north;
  const { colors } = section;
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const padLift = overlayLift(PAD);

  const B = N.boardwalk;
  const bw = new THREE.Mesh(
    quad(B.x1 - B.x0, B.z1 - B.z0),
    decal(colors.boardwalkWood, PAD, "woodSlat", [(B.x1 - B.x0) / 1.4, (B.z1 - B.z0) / 1.4])
  );
  const bcx = (B.x0 + B.x1) / 2;
  const bcz = (B.z0 + B.z1) / 2;
  bw.position.set(bcx, ground(bcx, bcz) + padLift, bcz);
  bw.renderOrder = OVERLAY[PAD].renderOrder;
  bw.name = "ground-decal";
  group.add(bw);

  /* Corten planter: four walls and a soil decal, seated on the surface. */
  const P = N.planter;
  const g = ground(P.x, P.z);
  const walls = [
    { x: P.x, z: P.z - P.d / 2 + P.wall / 2, scale: [P.w, P.height, P.wall] },
    { x: P.x, z: P.z + P.d / 2 - P.wall / 2, scale: [P.w, P.height, P.wall] },
    { x: P.x - P.w / 2 + P.wall / 2, z: P.z, scale: [P.wall, P.height, P.d] },
    { x: P.x + P.w / 2 - P.wall / 2, z: P.z, scale: [P.wall, P.height, P.d] },
  ];
  group.add(instanced(unit, painted(colors.corten), walls,
    (w) => ({ ...w, y: g + P.height / 2 })));
  const soil = new THREE.Mesh(quad(P.w - 2 * P.wall, P.d - 2 * P.wall), decal(colors.planterSoil, PAD));
  soil.position.set(P.x, g + P.height - 0.08, P.z);
  soil.name = "planter-soil";
  group.add(soil);

  /* The long wood-slat bench on steel legs. */
  const S = N.bench;
  const bg = ground(S.x, S.z);
  const bench = [
    { mat: "wood", x: S.x, y: bg + S.seatHeight, z: S.z, scale: [S.length, 0.06, S.width] },
    { mat: "steel", x: S.x - S.length * 0.4, y: bg + S.seatHeight / 2, z: S.z, scale: [0.06, S.seatHeight, S.width - 0.1] },
    { mat: "steel", x: S.x + S.length * 0.4, y: bg + S.seatHeight / 2, z: S.z, scale: [0.06, S.seatHeight, S.width - 0.1] },
  ];
  group.add(instanced(unit, wood(colors.benchWood), bench.filter((b) => b.mat === "wood")));
  group.add(instanced(unit, painted(colors.benchSteel), bench.filter((b) => b.mat === "steel")));
}

/* -------------------------------------------------------------------- api */

/**
 * Build Argo Hall's photo-sourced detail.
 *
 * `photo` is the loaded photo-detail document; this reads only its `argo`
 * section and returns `{ group, counts }` (empty and harmless if the section
 * is missing). `surfaceAt` — the height of the DRAWN terrain triangle — places
 * everything that stands on the ground; `heightAt` sets the building base,
 * because that is what campus-massing.js used to seat the measured mass and
 * the two must not diverge.
 */
export function createPhotoArgo(scene, { photo, heightAt, surfaceAt } = {}) {
  const group = new THREE.Group();
  group.name = "photo-argo";
  const section = photo?.argo;
  if (!section) {
    scene?.add(group);
    return { group, counts: {} };
  }
  const ground = surfaceAt || heightAt;
  const base = heightAt || surfaceAt;
  if (typeof ground !== "function" || typeof base !== "function") {
    throw new Error("campus-photo-argo: needs surfaceAt (or heightAt) to place on the ground");
  }

  /* Match campus-massing.js roofElevation over the DRAWN mass: rim-median
     ground under measured.mass.ring (the arcgis part campus-massing extrudes,
     copied verbatim) plus measured.mass.h (its LiDAR massHeights read),
     lifted if that would bury a high corner. Solving on any other ring/height
     pair leaves the shell and the roof furniture floating off the visible
     deck — the audit caught exactly that on campus-3d's 22.8, which is an OSM
     levels guess, not a measurement. Pre-merge sections without the mass
     block fall back to the survey ring + lidarHeight, then facade endpoints. */
  const mass = section.measured.mass;
  let verts = mass?.ring ?? section.measured.ring;
  if (!Array.isArray(verts) || !verts.length) {
    verts = [];
    const seen = new Set();
    for (const f of section.facades) {
      for (const p of [f.a, f.b]) {
        const k = `${p[0]},${p[1]}`;
        if (!seen.has(k)) { seen.add(k); verts.push(p); }
      }
    }
  }
  const lidarH = mass?.h ?? section.measured.lidarHeight;
  const gs = verts.map(([x, z]) => base(x, z)).filter((v) => Number.isFinite(v)).sort((p, q) => p - q);
  const median = gs.length ? gs[Math.floor(gs.length / 2)] : 0;
  const highest = gs.length ? gs[gs.length - 1] : 0;
  const roofY = Math.max(median + lidarH, highest);
  const baseY = roofY - lidarH;

  const bins = {
    spandrels: [], glassFrosted: [], glassSky: [], awnings: [], revealL: [], revealR: [],
    piers: [], nubs: [], parapets: [], drips: [], joints: [], pilasters: [],
    recess: [], columns: [], soffits: [],
    counts: {},
  };
  const facades = new THREE.Group();
  facades.name = "argo-facades";
  for (const f of section.facades) {
    collectFace(section, f, frameOf(f), baseY, ground, bins);
  }

  const { colors } = section;
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const plane = new THREE.PlaneGeometry(1, 1);
  const add = (geo, mat, items, name) => {
    if (!items.length) return;
    const mesh = instanced(geo, mat, items);
    if (name) mesh.name = name;
    facades.add(mesh);
  };
  add(unit, concrete(colors.spandrel), bins.spandrels);
  add(plane, glassMat(colors.windowFrosted), bins.glassFrosted);
  add(plane, glassMat(colors.windowSky), bins.glassSky);
  add(unit, painted(colors.awningFrame), bins.awnings);
  add(unit, concrete(colors.revealWhite), bins.revealL);
  add(unit, concrete(colors.revealWhite), bins.revealR);
  add(unit, concrete(colors.precast), bins.piers);
  add(unit, concrete(colors.precast), bins.nubs);
  add(unit, concrete(colors.parapet), bins.parapets);
  add(unit, concrete(colors.copingWhite), bins.drips);
  add(unit, painted(colors.panelJoint), bins.joints);
  add(unit, concrete(colors.precast), bins.pilasters);
  add(plane, matte(colors.groundRecess), bins.recess, "ground-recess");
  add(unit, concrete(colors.column), bins.columns, "ground-columns");
  add(unit, concrete(colors.soffit), bins.soffits);
  group.add(facades);

  const roof = new THREE.Group();
  roof.name = "argo-roof";
  buildRoof(section, roof, roofY, bins);
  group.add(roof);

  const groundGroup = new THREE.Group();
  groundGroup.name = "argo-ground";
  buildGround(section, groundGroup, ground);
  group.add(groundGroup);

  scene?.add(group);
  return {
    group,
    counts: {
      facades: section.facades.length,
      bays: section.grid.longFaceBays,
      windows: bins.glassFrosted.length + bins.glassSky.length,
      reveals: bins.revealL.length + bins.revealR.length,
      awnings: bins.awnings.length,
      piers: bins.piers.length,
      nubs: bins.nubs.length,
      columns: bins.columns.length,
      curbs: bins.counts.curbs || 0,
      draws: group.children.reduce((s, g) => s + g.children.length, 0),
    },
  };
}
