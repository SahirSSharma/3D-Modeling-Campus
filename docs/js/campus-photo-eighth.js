// Eighth College's photo-sourced detail: the landscape you can see in the
// published photographs and cannot see in the survey.
//
// THIS IS INVENTED CONTENT AND IT IS QUARANTINED. Everything this module draws
// comes from docs/data/campus-photo-detail.json, which is architectural
// photography (EYRC / SDA / SWA, 2024-2025) and a 2021 design site plan — not
// OSM, not the 2014 LiDAR, not the ArcGIS survey. It obeys the same class rule
// the scooter run's props obey: seeded from a pinned constant, never read by a
// measured consumer, labelled as invented in the data file, the README and the
// HUD. Nothing here may become a source for anything else. In particular, no
// height, colour or position below is a measurement of this campus, and the
// module is deliberately one-way: it READS the photo document and the terrain
// height function, and it writes nothing back.
//
// WHAT IS MEASURED HERE IS THE ANCHOR, NOT THE OBJECT. Each item names the
// surveyed polygon it was placed on (`area.anchor` in the data), and that
// polygon is the only measured fact behind its position. The BBQ terrace sits
// on courtyard-2375 and aligns to that courtyard's own north-east edge; the
// tea house sits inside planting-bed-331; the meditation pavilion sits on the
// open spine between courtyard-328 and courtyard-329 and is SCALED DOWN to fit
// that opening rather than overrunning two measured planting rings. Where a
// photo estimate and the survey disagreed, the survey won and the data file
// says so at the item.
//
// GROUND CONTACT. Every placement samples the height function the caller
// passes. Callers must pass `surfaceAt` (campus-terrain.js), not `heightAt` —
// `heightAt` interpolates every LiDAR sample and the drawn terrain is built
// from every second one, so anything placed on `heightAt` sits under the
// visible ground. Anything flat on the ground is a lifted decal on the shared
// overlay ladder (campus-overlay.js), never a local lift constant.
//
// NO RANDOMNESS. The Ramble's boulder clusters and grass tufts scatter from a
// pinned seed in the data file, so two runs are identical.
import * as THREE from "../vendor/three/three.module.min.js";
import { OVERLAY, overlayLift, applyOverlayDepth } from "./campus-overlay.js";
import { fillPoly } from "./campus-drape.js";

/** The item types this module knows how to draw. Anything else is a data bug. */
export const PHOTO_ITEM_TYPES = [
  "grill-counter", "grill-bay", "extinguisher-bollard", "shade-canopy",
  "service-enclosure", "picnic-table", "cafe-chair", "amphitheatre-tier",
  "pavilion-plinth", "pavilion-roof", "pavilion-screen", "standing-boulder",
  "gravel-field", "slab-stone", "ramp-light-edge", "tea-house",
  "boulder-cluster", "grass-field", "mulch-patch", "gravel-patch",
  "picket-bridge", "planter-cube", "light-pole", "bollard-light",
  "adirondack-chair", "fire-feature", "seat-wall", "bike-rack",
];

/* Surface finish per colour role. This is the one thing in the module that is
   NOT in the data file, on purpose: roughness and metalness are how a material
   responds to this scene's lighting, not a property of the campus. */
const FINISH = {
  metal: { roughness: 0.35, metalness: 0.8 },
  railing: { roughness: 0.35, metalness: 0.8 },
  tableLeg: { roughness: 0.4, metalness: 0.7 },
  canopyPost: { roughness: 0.4, metalness: 0.7 },
  poleDark: { roughness: 0.45, metalness: 0.6 },
  grillLid: { roughness: 0.3, metalness: 0.6 },
  grillFascia: { roughness: 0.35, metalness: 0.5 },
  fireGlass: { roughness: 0.12, metalness: 0.2 },
  extinguisher: { roughness: 0.4, metalness: 0.3 },
  boulder: { roughness: 1.0, metalness: 0 },
  slabStone: { roughness: 1.0, metalness: 0 },
  grassBlue: { roughness: 0.95, metalness: 0 },
  grassStraw: { roughness: 0.95, metalness: 0 },
};
const DEFAULT_FINISH = { roughness: 0.85, metalness: 0 };

/**
 * A deterministic scatter source. Pinned seed in, the same landscape out —
 * the Ramble must not shuffle between two loads of the same page.
 */
function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Collects every solid as a transform against one of three unit primitives,
 * then emits ONE InstancedMesh per (primitive, colour) pair. The tea house
 * alone is ~160 battens; drawn as individual meshes that is 160 draw calls for
 * one 4 m object. Batching is keyed on colour rather than on size because the
 * scale lives in the matrix, so every batten in the campus — whatever its
 * height under the asymmetric gable — lands in a single instanced draw.
 */
function batcher() {
  const bins = new Map();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const euler = new THREE.Euler();

  function push(prim, colour, x, y, z, sx, sy, sz, rotY = 0, rotX = 0, rotZ = 0) {
    const key = `${prim}|${colour}`;
    let bin = bins.get(key);
    if (!bin) bins.set(key, (bin = { prim, colour, mats: [] }));
    pos.set(x, y, z);
    euler.set(rotX, rotY, rotZ, "YXZ");
    quat.setFromEuler(euler);
    scale.set(sx, sy, sz);
    bin.mats.push(new THREE.Matrix4().compose(pos, quat, scale));
  }

  return {
    /** A box of world size (w,h,d) centred at (x,y,z), yawed by rotY. */
    box: (colour, x, y, z, w, h, d, rotY = 0, rotX = 0, rotZ = 0) =>
      push("box", colour, x, y, z, w, h, d, rotY, rotX, rotZ),
    /** A vertical cylinder of radius r and height h, centred at (x,y,z). */
    cyl: (colour, x, y, z, r, h, rotY = 0, rotX = 0, rotZ = 0) =>
      push("cyl", colour, x, y, z, r * 2, h, r * 2, rotY, rotX, rotZ),
    /** A cone of base radius r and height h, centred at (x,y,z). */
    cone: (colour, x, y, z, r, h) => push("cone", colour, x, y, z, r * 2, h, r * 2),

    build(group, colors) {
      const unit = {
        box: new THREE.BoxGeometry(1, 1, 1),
        cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
        cone: new THREE.ConeGeometry(0.5, 1, 7),
      };
      const used = new Set();
      let count = 0;
      for (const bin of bins.values()) {
        const hex = colors[bin.colour];
        if (!hex) continue;
        const finish = FINISH[bin.colour] || DEFAULT_FINISH;
        const mat = new THREE.MeshStandardMaterial({ color: hex, ...finish });
        const geo = unit[bin.prim];
        used.add(bin.prim);
        if (bin.mats.length === 1) {
          const mesh = new THREE.Mesh(geo, mat);
          mesh.applyMatrix4(bin.mats[0]);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          group.add(mesh);
        } else {
          const inst = new THREE.InstancedMesh(geo, mat, bin.mats.length);
          bin.mats.forEach((m, i) => inst.setMatrixAt(i, m));
          inst.instanceMatrix.needsUpdate = true;
          inst.castShadow = true;
          inst.receiveShadow = true;
          group.add(inst);
        }
        count += bin.mats.length;
      }
      /* Anything the batch never reached is geometry nobody owns. */
      for (const [prim, geo] of Object.entries(unit)) if (!used.has(prim)) geo.dispose();
      return count;
    },
  };
}

/** World offset of a local (lx, lz) under a yaw of rotY. */
function yaw(lx, lz, rotY) {
  const c = Math.cos(rotY), s = Math.sin(rotY);
  return [lx * c + lz * s, -lx * s + lz * c];
}

/* -------------------------------------------------------------- decals */

/** A rectangle drawn flat on the ground, on the shared overlay ladder. */
function decal(rect, hex, heightAt) {
  const rung = "pad";
  const poly = [
    [rect.x0, rect.z0], [rect.x1, rect.z0], [rect.x1, rect.z1], [rect.x0, rect.z1],
  ];
  const pos = [];
  fillPoly(pos, poly, heightAt, overlayLift(rung));
  if (!pos.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  /* fillPoly emits up-facing triangles, so a flat +y normal is the truth
     about this geometry rather than a lie the shader has to correct. */
  const normals = new Float32Array(pos.length);
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
  geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  const mat = applyOverlayDepth(new THREE.MeshStandardMaterial({
    color: hex, side: THREE.DoubleSide, roughness: 0.98,
  }), rung);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = OVERLAY[rung].renderOrder;
  mesh.receiveShadow = true;
  return mesh;
}

/* --------------------------------------------------------- item builders */

function grillCounter(it, b, ground) {
  b.box(it.color, it.x, ground + it.h / 2, it.z, it.w, it.h, it.d, it.rotY);
}

function grillBay(it, b, ground) {
  /* The lid sits proud of the counter top; the fascia is the blue panel
     under it, inset so the counter's own edge still reads. */
  b.box(it.color, it.x, ground + it.sill + it.h / 2, it.z, it.w, it.h, it.d, it.rotY);
  b.box(it.fascia, it.x, ground + it.sill - 0.2, it.z, it.w, 0.28, it.d * 0.6, it.rotY);
}

function extinguisherBollard(it, b, ground) {
  b.cyl(it.color, it.x, ground + it.h / 2, it.z, it.r, it.h);
}

function shadeCanopy(it, b, ground) {
  const y = ground + it.clear + it.deck / 2;
  b.box(it.color, it.x, y, it.z, it.w, it.deck, it.d, it.rotY);
  for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const [dx, dz] = yaw(lx * (it.w / 2 - 0.25), lz * (it.d / 2 - 0.25), it.rotY);
    b.box(it.postColor, it.x + dx, ground + it.clear / 2, it.z + dz,
      it.post, it.clear, it.post, it.rotY);
  }
}

function simpleBox(it, b, ground) {
  b.box(it.color, it.x, ground + it.h / 2, it.z, it.w, it.h, it.d, it.rotY || 0);
}

function picnicTable(it, b, ground) {
  b.box(it.color, it.x, ground + it.h - 0.04, it.z, it.w, 0.08, it.d, it.rotY);
  for (const lx of [-1, 1]) {
    const [dx, dz] = yaw(lx * (it.w / 2 - 0.2), 0, it.rotY);
    b.box(it.legColor, it.x + dx, ground + (it.h - 0.08) / 2, it.z + dz,
      0.06, it.h - 0.08, it.d - 0.1, it.rotY);
  }
}

/** A seat and a back — enough to read as a chair at walking distance. */
function chair(it, b, ground, seatH, backT) {
  b.box(it.color, it.x, ground + seatH, it.z, it.w, 0.06, it.d, it.rotY);
  const [dx, dz] = yaw(0, -(it.d / 2 - backT), it.rotY);
  b.box(it.color, it.x + dx, ground + (seatH + it.h) / 2, it.z + dz,
    it.w, it.h - seatH, backT, it.rotY);
  for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const [ox, oz] = yaw(lx * (it.w / 2 - 0.05), lz * (it.d / 2 - 0.05), it.rotY);
    b.box(it.color, it.x + ox, ground + seatH / 2, it.z + oz, 0.05, seatH, 0.05, it.rotY);
  }
}

function pavilionRoof(it, b, ground, plinthH) {
  const deck = ground + plinthH;
  b.box(it.color, it.x, deck + it.soffit + it.slab / 2, it.z, it.w, it.slab, it.d, it.rotY);
  for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const [dx, dz] = yaw(lx * (it.w / 2 - it.inset), lz * (it.d / 2 - it.inset), it.rotY);
    b.box(it.postColor, it.x + dx, deck + it.soffit / 2, it.z + dz,
      it.post, it.soffit, it.post, it.rotY);
  }
}

/** A convex arc of vertical timber slats — the pavilion's curved screen. */
function pavilionScreen(it, b, ground, plinthH) {
  const deck = ground + plinthH;
  const step = (it.to - it.from) / Math.max(1, it.slats - 1);
  /* Slightly narrower than the slat pitch, so the screen reads as a run of
     timber with light between it rather than as one solid curved panel. */
  const chord = it.r * Math.abs(step) * 0.8;
  for (let i = 0; i < it.slats; i++) {
    const a = it.from + step * i;
    const x = it.cx + Math.cos(a) * it.r;
    const z = it.cz + Math.sin(a) * it.r;
    /* Each slat faces the arc centre: its thin axis is the radial one. */
    b.box(it.color, x, deck + it.h / 2, z, it.t, it.h, Math.max(0.08, chord), -a);
  }
}

function standingBoulder(it, b, ground) {
  b.box(it.color, it.x, ground + it.h / 2, it.z, it.w, it.h, it.d, 0.4);
}

function slabStone(it, b, ground) {
  b.box(it.color, it.x, ground + it.h / 2, it.z, it.w, it.h, it.d, it.rotY);
}

/** The ramp's lit edge: a rail on posts along a straight run. */
function rampLightEdge(it, b, heightAt) {
  const len = Math.hypot(it.x1 - it.x0, it.z1 - it.z0);
  const rotY = Math.atan2(-(it.z1 - it.z0), it.x1 - it.x0);
  const posts = Math.max(2, Math.round(len / 1.6) + 1);
  for (let i = 0; i < posts; i++) {
    const t = i / (posts - 1);
    const x = it.x0 + (it.x1 - it.x0) * t, z = it.z0 + (it.z1 - it.z0) * t;
    b.box(it.color, x, heightAt(x, z) + it.h / 2, z, it.t, it.h, it.t, rotY);
  }
  const mx = (it.x0 + it.x1) / 2, mz = (it.z0 + it.z1) / 2;
  b.box(it.color, mx, heightAt(mx, mz) + it.h, mz, len, it.t, it.t * 1.4, rotY);
}

/**
 * The tea house: a vertical-batten box under an asymmetric gable, cut open by
 * a portal in a heavy frame, on a concrete plinth, with an L bench inside.
 *
 * The batten module is the whole point of the object — ~50 mm faces at ~100 mm
 * centres — so the battens are real geometry, not a texture, and every one of
 * them lands in a single instanced draw. The gable's ridge is deliberately
 * OFF-CENTRE (0.62 across the width), which is what the photograph shows and
 * what a symmetric roof would lose.
 */
function teaHouse(it, b, ground) {
  const base = ground + it.plinth;
  const half = it.w / 2;
  const ridgeAt = -half + it.w * 0.62;
  const profile = (lx) => (lx <= ridgeAt
    ? it.eave + (it.ridge - it.eave) * (lx + half) / (ridgeAt + half)
    : it.ridge - (it.ridge - it.eave) * (lx - ridgeAt) / (half - ridgeAt));

  b.box(it.plinthColor, it.x, ground + it.plinth / 2, it.z,
    it.w + 0.5, it.plinth, it.d + 0.5, it.rotY);

  const n = Math.max(2, Math.round(it.w / it.pitch));
  const portalHalf = it.portalW / 2;
  for (let i = 0; i < n; i++) {
    const lx = -half + it.pitch * (i + 0.5);
    const h = profile(lx) - it.plinth;
    /* The two gable faces carry the profile; the two side faces run at the
       height of the corner they meet, which is what mitring at the corners
       gives you. */
    for (const side of [-1, 1]) {
      /* Face parallel to local x, at local z = side*half: portal on +z only. */
      const inPortal = side > 0 && Math.abs(lx) < portalHalf;
      const bh = inPortal ? h - it.portalH : h;
      if (bh > 0.05) {
        const y = base + (inPortal ? it.portalH : 0) + bh / 2;
        const [dx, dz] = yaw(lx, side * half, it.rotY);
        b.box(it.color, it.x + dx, y, it.z + dz, it.batten, bh, it.batten, it.rotY);
      }
      /* Face parallel to local z, at local x = side*half: constant height,
         portal on +x only. Reuse the loop index as the position along z. */
      const lz = -half + it.pitch * (i + 0.5);
      const hz = profile(side * half) - it.plinth;
      const inPortalZ = side > 0 && Math.abs(lz) < portalHalf;
      const bhz = inPortalZ ? hz - it.portalH : hz;
      if (bhz > 0.05) {
        const y = base + (inPortalZ ? it.portalH : 0) + bhz / 2;
        const [dx, dz] = yaw(side * half, lz, it.rotY);
        b.box(it.color, it.x + dx, y, it.z + dz, it.batten, bhz, it.batten, it.rotY);
      }
    }
  }

  /* The heavy solid frame around each portal, and the dark shoe strip the
     battens stand on. */
  for (const [lx, lz, faceRot] of [[0, half, 0], [half, 0, Math.PI / 2]]) {
    const [dx, dz] = yaw(lx, lz, it.rotY);
    const r = it.rotY + faceRot;
    b.box(it.color, it.x + dx, base + it.portalH + it.frame / 2, it.z + dz,
      it.portalW + it.frame * 2, it.frame, it.frame, r);
    for (const s of [-1, 1]) {
      const [ox, oz] = yaw(lx + (faceRot ? 0 : s * (portalHalf + it.frame / 2)),
        lz + (faceRot ? s * (portalHalf + it.frame / 2) : 0), it.rotY);
      b.box(it.color, it.x + ox, base + (it.portalH + it.frame) / 2, it.z + oz,
        it.frame, it.portalH + it.frame, it.frame, r);
    }
  }
  for (const [lx, lz, w, d] of [
    [0, -half, it.w, 0.12], [0, half, it.w, 0.12],
    [-half, 0, 0.12, it.w], [half, 0, 0.12, it.w],
  ]) {
    const [dx, dz] = yaw(lx, lz, it.rotY);
    b.box(it.shoeColor, it.x + dx, base + 0.04, it.z + dz, w, 0.08, d, it.rotY);
  }

  /* The L-shaped bench, against the two closed faces. */
  const inner = half - it.benchD / 2 - 0.1;
  for (const [lx, lz, w, d] of [
    [0, -inner, it.w - it.benchD - 0.2, it.benchD],
    [-inner, 0, it.benchD, it.w - it.benchD - 0.2],
  ]) {
    const [dx, dz] = yaw(lx, lz, it.rotY);
    b.box(it.benchColor, it.x + dx, base + it.benchH / 2, it.z + dz,
      w, it.benchH, d, it.rotY);
  }
}

function boulderCluster(it, b, heightAt, rand) {
  for (let i = 0; i < it.count; i++) {
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * it.r;
    const x = it.x + Math.cos(a) * d, z = it.z + Math.sin(a) * d;
    const r = it.minR + rand() * (it.maxR - it.minR);
    /* Rounded granite, sunk a little so it sits IN the ground, not on it. */
    b.box(it.color, x, heightAt(x, z) + r * 0.7, z,
      r * 2, r * 1.7, r * 1.8, rand() * Math.PI, 0.12, 0.1);
  }
}

function grassField(it, b, heightAt, rand) {
  const { x0, x1, z0, z1 } = it.rect;
  for (let i = 0; i < it.count; i++) {
    const x = x0 + rand() * (x1 - x0), z = z0 + rand() * (z1 - z0);
    const h = it.h * (0.7 + rand() * 0.6);
    const g = heightAt(x, z);
    b.cone(it.color, x, g + h / 2, z, it.r, h);
    /* Roughly a third carry the straw-yellow flowering spike. */
    if (rand() < 0.33) b.cone(it.spikeColor, x, g + h * 0.95, z, it.r * 0.28, h * 0.5);
  }
}

function picketBridge(it, b, ground) {
  b.box(it.color, it.x, ground + it.deck / 2, it.z, it.span, it.deck, it.width, it.rotY);
  const n = Math.max(2, Math.round(it.span / it.pitch));
  for (const side of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const lx = -it.span / 2 + it.pitch * (i + 0.5);
      const [dx, dz] = yaw(lx, side * it.width / 2, it.rotY);
      b.box(it.railColor, it.x + dx, ground + it.deck + it.rail / 2, it.z + dz,
        it.picket, it.rail, it.picket, it.rotY);
    }
    const [dx, dz] = yaw(0, side * it.width / 2, it.rotY);
    b.box(it.railColor, it.x + dx, ground + it.deck + it.rail, it.z + dz,
      it.span, 0.05, 0.05, it.rotY);
  }
}

function lightPole(it, b, ground) {
  b.cyl(it.color, it.x, ground + it.h / 2, it.z, it.r, it.h);
  /* The trumpet head: an inverted cone, wide side up. */
  b.cone(it.color, it.x, ground + it.h + it.headH / 2, it.z, it.headR, -it.headH);
}

function bollardLight(it, b, ground) {
  b.cyl(it.color, it.x, ground + it.h / 2, it.z, it.r, it.h);
}

function fireFeature(it, b, ground) {
  b.box(it.color, it.x, ground + it.sill + it.h / 2, it.z, it.w, it.h, it.d, it.rotY);
}

function bikeRack(it, b, heightAt) {
  for (let i = 0; i < it.count; i++) {
    const [dx, dz] = yaw(i * it.spacing, 0, it.rotY);
    const x = it.x + dx, z = it.z + dz;
    const g = heightAt(x, z);
    for (const s of [-1, 1]) {
      const [ox, oz] = yaw(0, s * it.hoopW / 2, it.rotY);
      b.cyl(it.color, x + ox, g + it.hoopH / 2, z + oz, it.tube, it.hoopH);
    }
    b.cyl(it.color, x, g + it.hoopH, z, it.tube, it.hoopW, it.rotY, 0, Math.PI / 2);
  }
}

/**
 * Eighth's photo-sourced detail. Returns `{ group, counts }`; the caller
 * parents the group into the Eighth zone so the layer toggle controls it, and
 * this module never touches the scene itself. Every failure mode — no
 * document, no height function, an unknown item type — is a quiet no-op, so a
 * missing invented overlay can never take the measured campus down with it.
 *
 * @param {THREE.Scene} _scene unused; present to match the sibling builders
 * @param {{photo: object, heightAt: (x: number, z: number) => number}} opts
 */
export function createPhotoEighth(_scene, { photo, heightAt } = {}) {
  const group = new THREE.Group();
  group.name = "photo-eighth";
  const counts = { items: 0, solids: 0, decals: 0, skipped: 0 };
  const doc = photo?.eighth;
  if (!doc || typeof heightAt !== "function" || !Array.isArray(doc.items)) {
    return { group, counts };
  }

  const colors = doc.colors || {};
  const b = batcher();
  const rand = rng(doc.seed || 1);
  const known = new Set(PHOTO_ITEM_TYPES);
  /* The pavilion's roof and screens stand on its plinth, so the plinth's
     height has to be known before either is placed. */
  const plinth = doc.items.find((i) => i.type === "pavilion-plinth");
  const plinthH = plinth ? plinth.h : 0;

  for (const it of doc.items) {
    if (!known.has(it.type)) { counts.skipped++; continue; }
    counts.items++;
    const g = it.x !== undefined && it.z !== undefined ? heightAt(it.x, it.z) : 0;
    switch (it.type) {
      case "grill-counter": grillCounter(it, b, g); break;
      case "grill-bay": grillBay(it, b, g); break;
      case "extinguisher-bollard": extinguisherBollard(it, b, g); break;
      case "shade-canopy": shadeCanopy(it, b, g); break;
      case "service-enclosure":
      case "amphitheatre-tier":
      case "planter-cube":
      case "seat-wall": simpleBox(it, b, g); break;
      case "picnic-table": picnicTable(it, b, g); break;
      case "cafe-chair": chair(it, b, g, 0.45, 0.05); break;
      case "adirondack-chair": chair(it, b, g, 0.38, 0.09); break;
      case "pavilion-plinth": simpleBox(it, b, g); break;
      case "pavilion-roof": pavilionRoof(it, b, g, plinthH); break;
      case "pavilion-screen":
        pavilionScreen(it, b, heightAt(it.cx, it.cz), plinthH); break;
      case "standing-boulder": standingBoulder(it, b, g + plinthH); break;
      case "slab-stone": slabStone(it, b, g); break;
      case "ramp-light-edge": rampLightEdge(it, b, heightAt); break;
      case "tea-house": teaHouse(it, b, g); break;
      case "boulder-cluster": boulderCluster(it, b, heightAt, rand); break;
      case "grass-field": grassField(it, b, heightAt, rand); break;
      case "picket-bridge": picketBridge(it, b, g); break;
      case "light-pole": lightPole(it, b, g); break;
      case "bollard-light": bollardLight(it, b, g); break;
      case "fire-feature": fireFeature(it, b, g); break;
      case "bike-rack": bikeRack(it, b, heightAt); break;
      case "gravel-field":
      case "gravel-patch":
      case "mulch-patch": {
        const mesh = decal(it.rect, colors[it.color], heightAt);
        if (mesh) { group.add(mesh); counts.decals++; }
        break;
      }
      default: counts.skipped++; counts.items--; break;
    }
  }

  counts.solids = b.build(group, colors);
  return { group, counts };
}
