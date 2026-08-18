// Revelle College, from photographs — the second declared INVENTED class.
//
// Everything this file draws is modelled off dated web photographs of Revelle
// (2006-2026), not off LiDAR or OSM. Photos decide WHAT EXISTS and HOW IT
// LOOKS; the measured data keeps deciding WHERE and HOW BIG. So every one of
// these things is anchored to something surveyed — the stair towers to
// Urey's measured plaza face,
// the breezeway to the real gap between the Bonner and Mayer rings, the
// paving to the measured Revelle Plaza polygon — and nothing here is ever
// read back by a measured consumer.
//
// Two rules from AGENTS.md shape the whole file:
//
//   1. The measured ground is never replaced. The plaza's buff panels and
//      mauve brick bands are LIFTED DECALS on the overlay ladder
//      (campus-overlay.js), painted over the measured plaza surface, and the
//      bands are real geometry strips rather than a texture. The corridor
//      runs straight across them, which is fine — the track markings sit
//      higher up the same ladder.
//   2. `heightAt` is not the surface you can see. Everything PLACED sits on
//      `surfaceAt`, which is why the caller should hand one in; `heightAt` is
//      only the fallback so an older call site still works.
//
// Colours are DATA. Every hex comes from the `colors` block of the photo
// document's `revelle` section — the same rule campus-landmarks.js learned
// the hard way. Repeats are InstancedMesh: the plaza is ~130 discrete
// objects. (York Hall moved to its own module, campus-photo-york.js.)
//
// What is deliberately NOT here is listed in the section's `absent` array,
// and it is a long list: no Peace Memorial (no photograph exists), no El Mac
// mural, no change to the fountain basin, no fleet-hall facades, no Revelle
// Commons frontage. Better absent than wrong.
import * as THREE from "../vendor/three/three.module.min.js";
import { applyOverlayDepth, OVERLAY, overlayLift } from "./campus-overlay.js";

/* The plaza decals ride two rungs so they paint over campus-world's own
   measured plaza fill (rung `ground`) in a fixed order, and everything solid
   stands on top of the upper one. */
const BASE_RUNG = "pad";
const PANEL_RUNG = "carpet";
const RUNNER_RUNG = "paint";

const concrete = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0.0 });
const painted = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.35 });
const glass = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.18, metalness: 0.55 });
const rock = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 1.0, metalness: 0.0 });

/** Flat decal material on a given rung of the overlay ladder. */
function decal(color, rung) {
  return applyOverlayDepth(
    new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0.0 }),
    rung
  );
}

/**
 * One InstancedMesh from a list of placements. `place` returns
 * `{ x, y, z, rot?, rotX?, scale? }`; `rot` is about Y.
 */
function instanced(geo, mat, items, place) {
  const mesh = new THREE.InstancedMesh(geo, mat, items.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const pos = new THREE.Vector3();
  items.forEach((it, i) => {
    const p = place(it, i);
    e.set(p.rotX || 0, p.rot || 0, 0);
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

/** A flat XZ decal quad, lying in the ground plane. */
function quad(w, d) {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  return g;
}

/** A rounded-rectangle decal panel — the plaza's signature struck corner. */
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
 * A lathed concrete column that narrows to a waist then flares open into a
 * capital — the shared geometry of York's arcade and the Mayer/Bonner
 * breezeway, and the reason both read as pointed arches between them.
 */
function flareColumn(baseR, waistR, capR, height, segments = 10) {
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    // waist at 55% height, then an accelerating flare to the capital
    const r = t < 0.55
      ? baseR + (waistR - baseR) * (t / 0.55)
      : waistR + (capR - waistR) * Math.pow((t - 0.55) / 0.45, 2.2);
    pts.push(new THREE.Vector2(r, t * height));
  }
  return new THREE.LatheGeometry(pts, 10);
}

/* ------------------------------------------------------------ the plaza */

function buildPaving(section, group, ground) {
  const { colors, paving } = section;
  const { pitch, band, radius, runnerX, runnerWidth, runnerLength } = paving;

  /* Brick first, at cell pitch: the buff panel on top is inset by the band
     width, so what shows around it IS the band — real geometry, and it fans
     correctly around the struck corners because the panel above is round. */
  group.add(instanced(
    quad(pitch, pitch), decal(colors.brick, BASE_RUNG), paving.cells,
    ([x, z]) => ({ x, y: ground(x, z) + overlayLift(BASE_RUNG), z })
  ));
  group.children.at(-1).renderOrder = OVERLAY[BASE_RUNG].renderOrder;

  group.add(instanced(
    roundedPanel(pitch - band, radius), decal(colors.panel, PANEL_RUNG), paving.cells,
    ([x, z]) => ({ x, y: ground(x, z) + overlayLift(PANEL_RUNG), z })
  ));
  group.children.at(-1).renderOrder = OVERLAY[PANEL_RUNG].renderOrder;

  /* The wide central runner along the plaza's main north-south axis, laid
     over the panel field as its own strip. */
  group.add(instanced(
    quad(runnerWidth, runnerLength), decal(colors.brickLight, RUNNER_RUNG), paving.runner,
    (z) => ({ x: runnerX, y: ground(runnerX, z) + overlayLift(RUNNER_RUNG), z })
  ));
  group.children.at(-1).renderOrder = OVERLAY[RUNNER_RUNG].renderOrder;
}

/* --------------------------------------------------------- the furniture */

function buildFurniture(section, group, ground) {
  const { colors } = section;
  const lift = overlayLift(PANEL_RUNG);
  const on = (x, z) => ground(x, z) + lift;

  /* Bench type A: one slab on two pedestal legs that flare toward the floor.
     The dominant object in every plaza frame. */
  const a = section.benchesA;
  group.add(instanced(
    new THREE.BoxGeometry(a.length, a.slab, a.depth), concrete(colors.benchConcrete), a.items,
    (b) => ({ x: b.x, y: on(b.x, b.z) + a.seatHeight - a.slab / 2, z: b.z, rot: b.rot })
  ));
  for (const side of [-0.38, 0.38]) {
    group.add(instanced(
      new THREE.CylinderGeometry(0.16, 0.3, a.seatHeight - a.slab, 4),
      concrete(colors.benchConcrete), a.items,
      (b) => ({
        x: b.x + Math.cos(b.rot) * a.length * side,
        y: on(b.x, b.z) + (a.seatHeight - a.slab) / 2,
        z: b.z - Math.sin(b.rot) * a.length * side,
        rot: b.rot,
      })
    ));
  }

  /* Bench type B: the same legs, three weathered redwood planks over them. */
  const b = section.benchesB;
  for (let k = 0; k < b.planks; k++) {
    const off = (k - (b.planks - 1) / 2) * (b.depth / b.planks);
    group.add(instanced(
      new THREE.BoxGeometry(b.length, 0.06, b.depth / b.planks - 0.03),
      concrete(colors.benchWood), b.items,
      (it) => ({
        x: it.x - Math.sin(it.rot) * off,
        y: on(it.x, it.z) + b.seatHeight,
        z: it.z - Math.cos(it.rot) * off,
        rot: it.rot,
      })
    ));
  }
  for (const side of [-0.4, 0, 0.4]) {
    group.add(instanced(
      new THREE.CylinderGeometry(0.16, 0.3, b.seatHeight - 0.06, 4),
      concrete(colors.benchConcrete), b.items,
      (it) => ({
        x: it.x + Math.cos(it.rot) * b.length * side,
        y: on(it.x, it.z) + (b.seatHeight - 0.06) / 2,
        z: it.z - Math.sin(it.rot) * b.length * side,
        rot: it.rot,
      })
    ));
  }

  /* Bulletin kiosks. What reads at any distance is not the grey metal box,
     it is the overlapping flyers papering it, so those are the geometry:
     small coloured quads on both faces, plus the black title band. */
  const k = section.kiosks;
  group.add(instanced(
    new THREE.BoxGeometry(k.width + 0.3, k.plinth, k.depth + 0.3), concrete(colors.bin), k.items,
    (it) => ({ x: it.x, y: on(it.x, it.z) + k.plinth / 2, z: it.z, rot: it.rot })
  ));
  group.add(instanced(
    new THREE.BoxGeometry(k.width, k.height - k.plinth, k.depth), painted(colors.kioskBody), k.items,
    (it) => ({ x: it.x, y: on(it.x, it.z) + k.plinth + (k.height - k.plinth) / 2, z: it.z, rot: it.rot })
  ));
  const flyerColors = [colors.flyerWhite, colors.flyerPink, colors.flyerYellow, colors.flyerCyan];
  flyerColors.forEach((color, ci) => {
    const spots = [];
    for (const it of k.items) {
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 3; col++) {
          if ((row * 3 + col + ci) % flyerColors.length !== ci) continue;
          spots.push({ it, row, col });
        }
      }
    }
    for (const face of [-1, 1]) {
      group.add(instanced(
        new THREE.PlaneGeometry(0.26, 0.3), new THREE.MeshStandardMaterial({ color, roughness: 0.9 }),
        spots,
        ({ it, row, col }) => {
          const across = (col - 1) * (k.width / 3);
          const depth = (k.depth / 2 + 0.02) * face;
          return {
            x: it.x + Math.cos(it.rot) * across + Math.sin(it.rot) * depth,
            y: on(it.x, it.z) + k.plinth + 0.35 + row * 0.34,
            z: it.z - Math.sin(it.rot) * across + Math.cos(it.rot) * depth,
            rot: it.rot + (face < 0 ? Math.PI : 0),
          };
        }
      ));
    }
  });
  group.add(instanced(
    new THREE.BoxGeometry(k.width + 0.04, 0.22, k.depth + 0.04), painted(colors.kioskBand), k.items,
    (it) => ({ x: it.x, y: on(it.x, it.z) + k.height - 0.11, z: it.z, rot: it.rot })
  ));

  /* Lampposts: square section, a flat luminaire box on a short arm, and on
     the plaza poles a navy/gold banner pair. */
  const l = section.lamps;
  group.add(instanced(
    new THREE.BoxGeometry(l.pole, l.height, l.pole), painted(colors.lampPole), l.items,
    (it) => ({ x: it.x, y: on(it.x, it.z) + l.height / 2, z: it.z, rot: it.rot })
  ));
  group.add(instanced(
    new THREE.BoxGeometry(l.head[0], l.head[1], l.head[2]), painted(colors.luminaire), l.items,
    (it) => ({
      x: it.x + Math.cos(it.rot) * 0.28,
      y: on(it.x, it.z) + l.height - 0.1,
      z: it.z - Math.sin(it.rot) * 0.28,
      rot: it.rot,
    })
  ));
  const bannered = l.items.filter((it) => it.banner);
  [[-1, colors.bannerNavy], [1, colors.bannerGold]].forEach(([side, color]) => {
    group.add(instanced(
      new THREE.BoxGeometry(l.bannerSize[0], l.bannerSize[1], 0.03),
      new THREE.MeshStandardMaterial({ color, roughness: 0.85 }), bannered,
      (it) => {
        const off = side * (l.pole / 2 + l.bannerSize[0] / 2 + 0.06);
        return {
          x: it.x + Math.cos(it.rot) * off,
          y: on(it.x, it.z) + l.bannerY + l.bannerSize[1] / 2,
          z: it.z - Math.sin(it.rot) * off,
          rot: it.rot,
        };
      }
    ));
  });

  /* Globe lamps — the secondary type by Mayer. */
  const g = section.globes;
  group.add(instanced(
    new THREE.CylinderGeometry(0.05, 0.07, g.post, 6), painted(colors.lampPole), g.items,
    (it) => ({ x: it.x, y: on(it.x, it.z) + g.post / 2, z: it.z })
  ));
  group.add(instanced(
    new THREE.SphereGeometry(g.radius, 10, 8),
    new THREE.MeshStandardMaterial({ color: colors.globe, roughness: 0.4, metalness: 0.05 }),
    g.items,
    (it) => ({ x: it.x, y: on(it.x, it.z) + g.post + g.radius, z: it.z })
  ));

  /* Precast bins. */
  const bn = section.bins;
  group.add(instanced(
    new THREE.CylinderGeometry(bn.radius, bn.radius * 0.92, bn.height, 12), concrete(colors.bin), bn.items,
    (it) => ({ x: it.x, y: on(it.x, it.z) + bn.height / 2, z: it.z })
  ));

  /* Bike-rack runs: inverted-U loop hoops, as a swept tube.
     These were five rows of thin dark BOXES, which is the abbreviation
     campus-details.js uses for a rack station scattered along a walk. It does
     not survive being run 24 m end to end: the Blake visual audit read the
     Argo row as one untextured black stepped block, because at a grazing
     angle 55 near-black slats at 0.42 m centres close up into a solid
     silhouette. A hoop is mostly air from every angle, so it cannot. One
     tube geometry, one instance per hoop, one draw for every rack on the
     plaza — cheaper than what it replaces. */
  const rk = section.racks;
  /* Straight legs, then a flat rounded crown — an inverted U. Running the
     curve straight from leg to apex instead gives a pointed gothic arch,
     which is York's arcade, not a bike rack. */
  const hw = rk.hoopWidth / 2;
  const hoopPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, -hw),
    new THREE.Vector3(0, rk.hoopHeight * 0.62, -hw),
    new THREE.Vector3(0, rk.hoopHeight, -hw * 0.34),
    new THREE.Vector3(0, rk.hoopHeight, hw * 0.34),
    new THREE.Vector3(0, rk.hoopHeight * 0.62, hw),
    new THREE.Vector3(0, 0, hw),
  ]);
  const hoops = [];
  for (const it of rk.items) {
    for (let h = 0; h < rk.hoops; h++) {
      const at = (h - (rk.hoops - 1) / 2) * rk.spacing;
      hoops.push({
        x: it.x + Math.sin(it.rot) * at,
        y: on(it.x, it.z),
        z: it.z + Math.cos(it.rot) * at,
        rot: it.rot,
      });
    }
  }
  group.add(instanced(
    /* Not `painted()`: at metalness 0.35 against this scene's 0.22 IBL
       intensity a 25 mm tube renders near-black whatever its albedo, which is
       half of why the audit called this a black block. Galvanised steel in
       daylight is a light mid grey, so the diffuse term carries it. */
    new THREE.TubeGeometry(hoopPath, 14, rk.tube, 5, false),
    new THREE.MeshStandardMaterial({ color: colors.rack, roughness: 0.5, metalness: 0.2 }),
    hoops, (h) => h
  ));

  /* Lava-rock retaining walls: angular volcanic rubble, no cap course. Each
     segment is a cluster of displaced blocks, deterministically jittered off
     its own index so a reload rebuilds the same wall. */
  const w = section.lavaWalls;
  const jitter = (n) => {
    const s = Math.sin(n * 12.9898) * 43758.5453;
    return s - Math.floor(s) - 0.5;
  };
  for (let r = 0; r < w.rocks; r++) {
    const along = ((r % 3) - 1) * (w.segment / 3);
    const tier = Math.floor(r / 3);
    const mat = rock(r % 4 === 3 ? colors.lavaRockPale : colors.lavaRock);
    group.add(instanced(new THREE.BoxGeometry(0.62, 0.26, w.thickness), mat, w.items, (it, i) => {
      const off = along + jitter(i * 7 + r) * 0.24;
      return {
        x: it.x + Math.sin(it.rot) * off + Math.cos(it.rot) * jitter(i + r) * 0.12,
        y: ground(it.x, it.z) + 0.13 + tier * (w.height / (w.rocks / 3)),
        z: it.z + Math.cos(it.rot) * off - Math.sin(it.rot) * jitter(i + r) * 0.12,
        rot: it.rot + jitter(i * 3 + r) * 0.5,
        rotX: jitter(i * 11 + r) * 0.22,
      };
    }));
  }
}

/* York Hall is NOT built here any more: campus-photo-york.js supersedes the
   old west-face arcade/fin sketch with the full four-structure build. The
   revelle section may still carry its legacy yorkArcade/yorkFins keys until
   the merge deletes them; nothing below reads them either way. */

/* ------------------------------------------------ Urey Hall, plaza corner */

function buildUrey(section, group, ground) {
  const { colors } = section;
  const u = section.systems.ureyCorner;
  const base = ground((u.slabA[0] + u.slabB[1]) / 2, u.faceZ);
  /* The plaza is on the +z side of this face, so the standoff is outward. */
  const z = u.faceZ + u.standoff;

  /* Two blank board-formed stair-tower slabs with a recessed dark glazed
     slot between them. Thin planes just off the measured wall — the massing
     itself is not touched. The `balcony` style Urey wears is defensible on
     the long side wing and wrong here, which is exactly why this corner is
     built rather than left to the tile. */
  for (const [a, b] of [u.slabA, u.slabB]) {
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(b - a, u.height, u.thickness), concrete(colors.ureySlab)
    );
    slab.position.set((a + b) / 2, base + u.height / 2, z);
    slab.castShadow = true;
    slab.receiveShadow = true;
    group.add(slab);
  }
  const slot = new THREE.Mesh(
    new THREE.BoxGeometry(u.slot[1] - u.slot[0], u.height, u.thickness * 0.4), glass(colors.ureySlot)
  );
  slot.position.set((u.slot[0] + u.slot[1]) / 2, base + u.height / 2, z - u.thickness * 0.3);
  group.add(slot);
}

/* --------------------------------------------- Mayer/Bonner breezeway */

function buildBreezeway(section, group, ground) {
  const { colors } = section;
  const b = section.systems.breezeway;
  const span = b.z1 - b.z0;
  const midZ = (b.z0 + b.z1) / 2;
  const base = ground(b.centreX, midZ);

  /* Anchored to the real gap between the Bonner and Mayer rings. The photo
     reads five levels of these; the lower of the two measured roofs (Bonner,
     12 m) only carries three at 3.6 m, and LiDAR decides height, so three is
     what gets built. */
  const bays = [];
  for (const x of b.columnRows) {
    for (let i = 0; i < b.columns; i++) {
      for (let lv = 0; lv < b.levels; lv++) {
        bays.push({ x, z: b.z0 + (span * i) / (b.columns - 1), y: lv * b.levelHeight });
      }
    }
  }
  group.add(instanced(
    flareColumn(b.shaft * 1.3, b.shaft, b.capital, b.levelHeight),
    concrete(colors.breezewayColumn), bays,
    (it) => ({ x: it.x, y: base + it.y, z: it.z })
  ));

  const decks = [];
  for (let lv = 1; lv <= b.levels; lv++) decks.push(base + lv * b.levelHeight);
  group.add(instanced(
    new THREE.BoxGeometry(b.deckWidth, b.deckThickness, span), concrete(colors.breezewayDeck), decks,
    (y) => ({ x: b.centreX, y: y - b.deckThickness / 2, z: midZ })
  ));

  /* Scalloped deck edges: the slab steps in and out in plan following the
     column bays, which is what gives the breezeway its faceted silhouette. */
  const scallops = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < b.columns; i++) {
      for (let lv = 1; lv <= b.levels; lv++) {
        scallops.push({
          x: b.centreX + side * (b.deckWidth / 2 + b.scallop / 2),
          z: b.z0 + (span * i) / (b.columns - 1),
          y: base + lv * b.levelHeight,
        });
      }
    }
  }
  group.add(instanced(
    new THREE.CylinderGeometry(b.columnSpacing / 2, b.columnSpacing / 2, b.deckThickness, 8),
    concrete(colors.breezewayDeck), scallops,
    (it) => ({ x: it.x, y: it.y - b.deckThickness / 2, z: it.z })
  ));

  /* Steel picket rail on both edges of every deck. */
  const pickets = [];
  for (const side of [-1, 1]) {
    for (let d = 0; d <= span + 0.01; d += b.picket) {
      for (let lv = 1; lv <= b.levels; lv++) {
        pickets.push({
          x: b.centreX + side * (b.deckWidth / 2 + b.scallop),
          z: b.z0 + d,
          y: base + lv * b.levelHeight,
        });
      }
    }
  }
  group.add(instanced(
    new THREE.BoxGeometry(0.02, b.railHeight, 0.02), painted(colors.rail), pickets,
    (it) => ({ x: it.x, y: it.y + b.railHeight / 2, z: it.z })
  ));
  const rails = [];
  for (const side of [-1, 1]) {
    for (let lv = 1; lv <= b.levels; lv++) {
      rails.push({ x: b.centreX + side * (b.deckWidth / 2 + b.scallop), y: base + lv * b.levelHeight });
    }
  }
  group.add(instanced(
    new THREE.BoxGeometry(0.05, 0.05, span), painted(colors.rail), rails,
    (it) => ({ x: it.x, y: it.y + b.railHeight, z: midZ })
  ));
}

/* ------------------------------------------------------------------ api */

/**
 * Build Revelle's photo-sourced detail.
 *
 * `photo` is the loaded photo-detail document; this reads only its `revelle`
 * section and returns `{ group }` (empty and harmless if the section is
 * missing, so a half-wired boot still runs). Pass `surfaceAt` — the height of
 * the DRAWN terrain triangle — for everything placed on the ground;
 * `heightAt` is only the fallback.
 */
export function createPhotoRevelle(scene, { photo, heightAt, surfaceAt } = {}) {
  const group = new THREE.Group();
  group.name = "photo-revelle";
  const section = photo?.revelle;
  if (!section) {
    scene?.add(group);
    return { group, counts: {} };
  }
  const ground = surfaceAt || heightAt;
  if (typeof ground !== "function") {
    throw new Error("campus-photo-revelle: needs surfaceAt (or heightAt) to place on the ground");
  }

  buildPaving(section, group, ground);
  buildFurniture(section, group, ground);
  buildUrey(section, group, ground);
  buildBreezeway(section, group, ground);

  scene?.add(group);
  return {
    group,
    counts: {
      pavingCells: section.paving.cells.length,
      benches: section.benchesA.items.length + section.benchesB.items.length,
      lamps: section.lamps.items.length,
      kiosks: section.kiosks.items.length,
      lavaWallSegments: section.lavaWalls.items.length,
      breezewayLevels: section.systems.breezeway.levels,
      draws: group.children.length,
    },
  };
}
