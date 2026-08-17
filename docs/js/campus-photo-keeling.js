// The Charles David Keeling Apartments, from photographs — the INVENTED class.
//
// KieranTimberlake, 2011. Three cast-in-place concrete masses in a C that opens
// east toward Revelle, and the only thing this file takes from the survey is
// where they stand and how tall they are: the rings and the LiDAR heights of
// "Keeling Apartments North Tower", "South Tower" and "West Bar". Every facade
// layer here hangs off two MEASURED ring vertices copied into the photo
// document's `facades` list and floats at most a metre proud of that face. The
// measured massing is never moved and never replaced.
//
// Three things decided the shape of this file:
//
//   1. The building solves on one grid. 37.2 / 30.0 / 22.8 m are 10, 8 and 6
//      storeys of 3.60 m plus a 1.20 m parapet, with zero residual — so the
//      floor lines are not a guess, they are the measured heights read back.
//      The 1.20 m HORIZONTAL bay is photogrammetric and contested; see
//      `grid.moduleNote` in the data.
//
//   2. Single-loaded corridors mean each mass wears two different elevations,
//      and which side gets which was the open question. It is settled from the
//      photographs against our own measured heights: the courtyard's gallery
//      tower counts TEN slab bands (kt_keeling2) and ten storeys is the 37.2 m
//      North Tower; the courtyard's precast face with the red stair slot counts
//      EIGHT (ls_016) and eight is the 30.0 m South Tower. So System A faces
//      SOUTH on both towers and WEST on the bar.
//
//   3. The grating must read TAN. It is warm fibreglass at about 55% open, and
//      an aggregate crop of it reads near-black — paint the bars that colour and
//      the building turns into a dark brown box. So the balustrade is a hybrid:
//      real posts and real bars for the near view, plus one semi-transparent tan
//      plane per level that carries the tone at 300 m.
//
// Colours are DATA — every hex comes from the `colors` block of the photo
// document's `keeling` section. Repeats are InstancedMesh: the facades alone are
// ~14,000 instances in about a dozen draws.
//
// What is NOT here is in the section's `absent` array, and one entry there is
// the whole south side: the two basketball courts and the parking lot that the
// 2013 landscape aerials show below the South Tower have been DEMOLISHED. The
// satellite chunks fetched 2026-08-04 show an active construction site on that
// ground. Newest source wins on what exists, so they are not built.
import * as THREE from "../vendor/three/three.module.min.js";
import { applyOverlayDepth, OVERLAY, overlayLift } from "./campus-overlay.js";

/* Ground decals ride the overlay ladder so they paint over the measured
   terrain in a fixed order instead of z-fighting it. */
const PAD = "pad";
const CARPET = "carpet";
const PAINT = "paint";

const concrete = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.0 });
const grating = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05 });
const painted = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.25 });
const metal = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.8 });
const glassMat = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.12, metalness: 0.3, side: THREE.DoubleSide });
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

/** The aggregate screen: tan bars over open air, so it is tinted AND see-through. */
function screen(color, openness) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.8,
    metalness: 0.05,
    transparent: true,
    /* A 55%-open grating is 55% open in PLAN only. The bars are deep, so at
       any oblique angle — which is every angle you actually see this facade
       from — they overlap and the screen occludes far more than that. One
       flat plane cannot do the parallax, so it carries the angle-averaged
       value instead, or the building reads as an open car park. */
    opacity: 1 - openness * 0.55,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

/** Deterministic 0..1 from any integer mix — a reload rebuilds the same facade. */
function hash(...ns) {
  let s = 0;
  for (let i = 0; i < ns.length; i++) s = s * 131.71 + ns[i] * 57.13 + 7.9;
  const v = Math.sin(s) * 43758.5453;
  return v - Math.floor(v);
}
const pick = (list, ...ns) => list[Math.floor(hash(...ns) * list.length) % list.length];

/**
 * One InstancedMesh from a list of placements. `place` returns
 * `{ x, y, z, rot?, rotX?, scale? }`; `rot` is about Y and applied first.
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

/* ------------------------------------------------------------ face frames */

/**
 * A facade's own coordinate frame, built from the two MEASURED ring vertices
 * the data names. `at(u, w, y)` is u metres along the face from its start, w
 * metres proud of it, y in world height. The frame is oriented from the
 * outward normal so a box rotated by `rot` has its local +Z pointing out.
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

/** Bay centres along a face, the leftover split evenly at both ends. */
function bayCentres(length, module) {
  const n = Math.max(1, Math.floor(length / module));
  const pad = (length - n * module) / 2;
  const out = [];
  for (let i = 0; i < n; i++) out.push({ i, u: pad + (i + 0.5) * module });
  return out;
}

/* ------------------------------------------------------ System A, gallery */

/* Everything System A contributes, accumulated across every face so each
   layer ends up as ONE instanced draw for the whole complex. */
function collectSystemA(section, f, frame, base, bins) {
  const A = section.systemA;
  const M = section.grid.module;
  const F = section.grid.floorToFloor;
  const bays = bayCentres(frame.length, M);
  const { rot, length } = frame;

  /* Exposed slab edges, one continuous band per floor line including the
     ground — the horizontal grain that carries this facade at any distance. */
  for (let lv = 0; lv <= f.storeys; lv++) {
    bins.slabBands.push({
      ...frame.at(length / 2, A.standoff + A.slabBand.depth / 2, base + lv * F),
      rot,
      scale: [length, A.slabBand.height, A.slabBand.depth],
    });
  }

  for (let lv = 1; lv < f.storeys; lv++) {
    const y = base + lv * F;
    const railTop = y + A.balustrade.sill + A.balustrade.height;

    /* The open-air walkway behind the screen, as the dark ground every
       photograph shows. Without it the measured wall reads pale through the
       grating and the whole facade inverts. */
    bins.galleryBack.push({
      ...frame.at(length / 2, A.galleryBack.standoff, y + (F + A.slabBand.height) / 2),
      rot,
      scale: [length, F - A.slabBand.height, 1],
    });

    /* The screen that makes it read tan rather than dark, and the solid
       flat-topped cap that draws the continuous line in every photograph. */
    bins.screens.push({
      ...frame.at(length / 2, A.balustrade.standoff, y + A.balustrade.sill + A.balustrade.height / 2),
      rot,
      scale: [length, A.balustrade.height, 1],
    });
    bins.railCaps.push({
      ...frame.at(length / 2, A.balustrade.standoff, railTop + A.balustrade.railCap / 2),
      rot,
      scale: [length, A.balustrade.railCap, A.posts.depth + 0.02],
    });

    /* Real posts on the bay grid and real bars between them, so the screen
       still holds up when you ride past it at three metres. */
    for (const bay of bays) {
      bins.posts.push({
        ...frame.at(bay.u - M / 2, A.balustrade.standoff, y + A.balustrade.sill + A.balustrade.height / 2),
        rot,
        scale: [A.posts.width, A.balustrade.height, A.posts.depth],
      });
    }
    for (let u = A.bars.pitch / 2; u < length; u += A.bars.pitch) {
      bins.bars.push({
        ...frame.at(u, A.balustrade.standoff, y + A.balustrade.sill + A.balustrade.height / 2 - 0.02),
        rot,
        scale: [A.bars.width, A.balustrade.height - 0.1, A.bars.depth],
      });
    }

    /* Projecting grating fins. Not every bay, and NOT the same bays on the
       storey above — that irregularity is the whole character of kt_keeling5,
       and a regular comb reads as a car park. */
    for (const bay of bays) {
      if (bay.i % A.fins.spacingBays !== 0) continue;
      if (hash(A.fins.seed, lv, bay.i, frame.length) > A.fins.density) continue;
      const w = A.balustrade.standoff + A.fins.depth / 2;
      const fy = y + A.balustrade.sill + A.fins.height / 2;
      bins.fins.push({
        ...frame.at(bay.u, w, fy),
        rot,
        scale: [A.fins.thickness, A.fins.height, A.fins.depth],
      });
      for (const t of [-1, 1]) {
        bins.tabs.push({
          ...frame.at(bay.u, A.balustrade.standoff + A.tabPlate.width / 2,
            fy + (t * A.fins.height) / 2 - t * 0.1),
          rot,
          scale: [A.tabPlate.thickness, A.tabPlate.height, A.tabPlate.width],
        });
      }
    }

    /* The orange-red unit doors glimpsed down the walkway behind the screen. */
    for (const bay of bays) {
      if (bay.i % A.doors.spacingBays !== 0) continue;
      bins.doors.push({
        ...frame.at(bay.u, A.doors.standoff, y + A.doors.height / 2),
        rot,
        scale: [A.doors.width, A.doors.height, 0.06],
      });
    }
  }
}

/* ------------------------------------------ System B, precast + punched */

function collectSystemB(section, f, frame, base, bins) {
  const B = section.systemB;
  const M = section.grid.module;
  const F = section.grid.floorToFloor;
  const { rot, length } = frame;
  const bayCount = Math.max(1, Math.floor(length / M));
  const pad = (length - bayCount * M) / 2;
  const uOf = (bay) => pad + bay * M;

  /* Which bays the open-air stair takes out of the panel field. */
  const slots = (section.stairSlots.items || []).filter((s) => s.face === f.id);
  const slotBays = new Set();
  for (const s of slots) {
    const w = Math.ceil((section.stairSlots.width + section.stairSlots.openWidth) / M);
    for (let k = 0; k < w; k++) slotBays.add(s.atBay + k);
  }

  /* The light structural band at every floor line — in ls_016 the frame reads
     paler than the panels it holds, and that contrast is most of the facade. */
  for (let lv = 1; lv <= f.storeys; lv++) {
    bins.frameBands.push({
      ...frame.at(length / 2, B.standoff + B.frameBand.depth / 2, base + lv * F),
      rot,
      scale: [length, B.frameBand.height, B.frameBand.depth],
    });
  }

  const tones = ["precastPanel", "precastPanelWarm", "precastPanelPale"];
  for (let lv = 1; lv < f.storeys; lv++) {
    const y0 = base + lv * F + B.frameBand.height / 2;
    const bandH = F - B.frameBand.height;
    /* Stagger: each storey starts its run at a different offset, so the
       vertical joints never line up into a column. */
    const start = Math.floor(hash(B.panel.seed, lv, frame.length) * 2);
    let bay = -start;
    while (bay < bayCount) {
      const widthBays = pick(B.panel.widthsBays, B.panel.seed, lv, bay, frame.length);
      const b0 = Math.max(0, bay);
      const b1 = Math.min(bayCount, bay + widthBays);
      bay += widthBays;
      if (b1 <= b0) continue;
      let blocked = false;
      for (let k = Math.floor(b0); k < Math.ceil(b1); k++) if (slotBays.has(k)) blocked = true;
      if (blocked) continue;

      const w = (b1 - b0) * M - B.panel.gap;
      const uc = (uOf(b0) + uOf(b1)) / 2;
      const isWindow = hash(B.panel.seed + 1, lv, b0, frame.length) < 0.45;
      if (!isWindow) {
        bins.panels.push({
          tone: pick(tones, B.panel.seed + 2, lv, b0, frame.length),
          ...frame.at(uc, B.standoff + B.panel.thickness / 2, y0 + bandH / 2),
          rot,
          scale: [w, bandH, B.panel.thickness],
        });
        continue;
      }

      /* A punched opening: glass set back behind the panel plane in a shallow
         reveal, a dark frame around it, and spandrel panel above and below. */
      const winH = Math.min(B.window.height, bandH - 0.5);
      const sill = B.window.sill;
      bins.glass.push({
        tint: pick(B.glassTints, B.panel.seed + 3, lv, b0, frame.length),
        ...frame.at(uc, B.standoff + 0.02, y0 + sill + winH / 2),
        rot,
        scale: [w - 2 * B.window.frame, winH - 2 * B.window.frame, 1],
      });
      /* The frame is a SURROUND, not a lid: four thin bars around the reveal.
         Emitting it as one box was hiding every pane behind a dark slab. */
      const fr = B.window.frame;
      for (const [fw, fh, du, dy] of [
        [w, fr, 0, (winH - fr) / 2], [w, fr, 0, -(winH - fr) / 2],
        [fr, winH, (w - fr) / 2, 0], [fr, winH, -(w - fr) / 2, 0],
      ]) {
        bins.frames.push({
          ...frame.at(uc + du, B.standoff + fr / 2, y0 + sill + winH / 2 + dy),
          rot,
          scale: [fw, fh, fr],
        });
      }
      bins.panels.push({
        tone: pick(tones, B.panel.seed + 2, lv, b0, frame.length),
        ...frame.at(uc, B.standoff + B.panel.thickness / 2, y0 + sill / 2),
        rot,
        scale: [w, sill, B.panel.thickness],
      });
      const head = bandH - sill - winH;
      if (head > 0.1) {
        bins.panels.push({
          tone: pick(tones, B.panel.seed + 4, lv, b0, frame.length),
          ...frame.at(uc, B.standoff + B.panel.thickness / 2, y0 + sill + winH + head / 2),
          rot,
          scale: [w, head, B.panel.thickness],
        });
      }
    }
  }

  /* The full-height orange-red circulation slots, with their open stair
     landings and grating rails beside them. */
  const S = section.stairSlots;
  for (const s of slots) {
    const h = f.storeys * F;
    const uRed = uOf(s.atBay) + S.width / 2;
    bins.stairRed.push({
      ...frame.at(uRed, B.standoff + S.standoff, base + h / 2),
      rot,
      scale: [S.width, h, 0.1],
    });
    const uOpen = uOf(s.atBay) + S.width + S.openWidth / 2;
    /* The stair is an OPEN slot: without a dark ground behind it the landings
       read as pale shelves stuck on a pale wall, which is the opposite of
       ls_016, where the slot is the darkest thing on the elevation. */
    bins.galleryBack.push({
      ...frame.at(uOpen, B.standoff + 0.02, base + h / 2),
      rot,
      scale: [S.openWidth, h, 1],
    });
    for (let lv = 1; lv < f.storeys; lv++) {
      const y = base + lv * F;
      bins.landings.push({
        ...frame.at(uOpen, B.standoff + S.landing.depth / 2, y - S.landing.thickness / 2),
        rot,
        scale: [S.openWidth, S.landing.thickness, S.landing.depth],
      });
      bins.screens.push({
        ...frame.at(uOpen, B.standoff + S.landing.depth, y + S.railHeight / 2),
        rot,
        scale: [S.openWidth, S.railHeight, 1],
      });
      bins.railCaps.push({
        ...frame.at(uOpen, B.standoff + S.landing.depth, y + S.railHeight),
        rot,
        scale: [S.openWidth, 0.07, 0.1],
      });
    }
  }

  collectGroundFloor(section, f, frame, base, bins);
}

/* End walls: blank pale precast with the narrow slot windows of c6_towerB. */
function collectEnd(section, f, frame, base, bins) {
  const B = section.systemB;
  const M = section.grid.module;
  const F = section.grid.floorToFloor;
  const { rot, length } = frame;
  for (let lv = 1; lv < f.storeys; lv++) {
    const y0 = base + lv * F + B.frameBand.height / 2;
    const bandH = F - B.frameBand.height;
    bins.panels.push({
      tone: "precastPanelPale",
      ...frame.at(length / 2, B.standoff + B.panel.thickness / 2, y0 + bandH / 2),
      rot,
      scale: [length - 0.2, bandH, B.panel.thickness],
    });
    for (const bay of bayCentres(length, M)) {
      if (bay.i % 3 !== 1) continue;
      bins.glass.push({
        tint: "glassBlue",
        ...frame.at(bay.u, B.standoff + B.panel.thickness + 0.01, y0 + bandH / 2),
        rot,
        scale: [0.5, bandH - 1.1, 1],
      });
    }
  }
  for (let lv = 1; lv <= f.storeys; lv++) {
    bins.frameBands.push({
      ...frame.at(length / 2, B.standoff + B.frameBand.depth / 2, base + lv * F),
      rot,
      scale: [length, B.frameBand.height, B.frameBand.depth],
    });
  }
  collectGroundFloor(section, f, frame, base, bins);
}

/* The ground floor everywhere: dark glazing tight to the wall, square columns
   standing proud of it. The columns are what make it read as recessed without
   cutting a hole in measured massing. */
function collectGroundFloor(section, f, frame, base, bins) {
  const G = section.systemB.ground;
  const M = section.grid.module;
  const { rot, length } = frame;
  bins.groundGlass.push({
    ...frame.at(length / 2, 0.03, base + G.glazingHeight / 2),
    rot,
    scale: [length - 0.4, G.glazingHeight, 1],
  });
  for (const bay of bayCentres(length, M)) {
    if (bay.i % G.columnSpacingBays !== 0) continue;
    bins.columns.push({
      ...frame.at(bay.u, G.recess + G.columnSize / 2, base + section.grid.floorToFloor / 2),
      rot,
      scale: [G.columnSize, section.grid.floorToFloor, G.columnSize],
    });
  }
}

/* ------------------------------------------------------------- the roofs */

/** The measured ring, reassembled from the ring vertices the facades name. */
function ringOf(section, key) {
  const order = {
    north: ["north-south", "north-west", "north-north", "north-east"],
    south: ["south-north", "south-west", "south-south", "south-east"],
    bar: ["bar-east-1", "bar-east-2", "bar-west-2", "bar-west-1"],
  }[key];
  const pts = [];
  const seen = new Set();
  for (const id of order) {
    const f = section.facades.find((x) => x.id === id);
    if (!f) continue;
    for (const p of [f.a, f.b]) {
      const k = `${p[0]},${p[1]}`;
      if (seen.has(k)) continue;
      seen.add(k);
      pts.push(p);
    }
  }
  /* Convex-hull order, which is exact for these four-sided masses and close
     enough for the bar's shallow wedge. */
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cz = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return pts.slice().sort((p, q) => Math.atan2(p[1] - cz, p[0] - cx) - Math.atan2(q[1] - cz, q[0] - cx));
}

const bboxOf = (ring) => ({
  x0: Math.min(...ring.map((p) => p[0])),
  x1: Math.max(...ring.map((p) => p[0])),
  z0: Math.min(...ring.map((p) => p[1])),
  z1: Math.max(...ring.map((p) => p[1])),
});

function buildRoofs(section, group, ground, roofY, bins) {
  const { colors, roofs } = section;
  const C = roofs.coping;

  /* Parapet coping: a thin square-edged cap following every ring segment. */
  const copes = [];
  for (const key of ["north", "south", "bar"]) {
    const ring = ringOf(section, key);
    const y = roofY[key];
    for (let i = 0; i < ring.length; i++) {
      const [ax, az] = ring[i];
      const [bx, bz] = ring[(i + 1) % ring.length];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 0.2) continue;
      const ux = (bx - ax) / len;
      const uz = (bz - az) / len;
      copes.push({
        x: (ax + bx) / 2 + uz * (C.width / 2 - 0.05),
        y: y + C.height / 2,
        z: (az + bz) / 2 - ux * (C.width / 2 - 0.05),
        rot: Math.atan2(-uz, ux),
        scale: [len, C.height, C.width],
      });
    }
  }
  group.add(instanced(new THREE.BoxGeometry(1, 1, 1), concrete(colors.parapetCoping), copes,
    (it) => it));

  /* PV: low-tilt rows in two banks with a yellow service walkway between,
     inset from the measured roof. Row count follows the roof, not a count in
     the photograph. */
  const P = roofs.pv;
  const panels = [];
  const walks = [];
  for (const bank of P.banks) {
    const bb = bboxOf(ringOf(section, bank.roof));
    const y = roofY[bank.roof];
    const x0 = bb.x0 + bank.inset;
    const x1 = bb.x1 - bank.inset;
    const z0 = bb.z0 + bank.inset;
    const z1 = bb.z1 - bank.inset;
    const gapZ = (z1 - z0) / (bank.rows * 2 + 1);
    for (let side = 0; side < 2; side++) {
      for (let r = 0; r < bank.rows; r++) {
        const z = z0 + gapZ * (side * (bank.rows + 1) + r + 0.5);
        for (let x = x0 + P.panel[0] / 2; x <= x1 - P.panel[0] / 2; x += P.panel[0] + 0.06) {
          panels.push({ x, y: y + P.postHeight + 0.05, z, rotX: -P.tilt });
        }
      }
    }
    walks.push({ x: (x0 + x1) / 2, y, z: z0 + gapZ * (bank.rows + 0.5), w: x1 - x0, d: P.walkway });
    walks.push({ x: (x0 + x1) / 2, y, z: z0 - 0.6, w: x1 - x0, d: P.walkway });
    walks.push({ x: (x0 + x1) / 2, y, z: z1 + 0.6, w: x1 - x0, d: P.walkway });
  }
  group.add(instanced(new THREE.BoxGeometry(P.panel[0], 0.06, P.panel[1]), painted(colors.pvPanel),
    panels, (it) => it));
  group.add(instanced(new THREE.BoxGeometry(P.panel[0] - 0.2, P.postHeight, 0.06),
    metal(colors.pvFrame), panels,
    (it) => ({ x: it.x, y: it.y - P.postHeight / 2 - 0.05, z: it.z })));
  for (const w of walks) {
    const mesh = new THREE.Mesh(quad(w.w, w.d), decal(colors.walkYellow, PAINT));
    mesh.position.set(w.x, w.y + 0.03, w.z);
    mesh.renderOrder = OVERLAY[PAINT].renderOrder;
    group.add(mesh);
  }

  /* Mechanical penthouses and the stair overrun. */
  const houses = roofs.penthouses.map((p) => {
    const bb = bboxOf(ringOf(section, p.roof));
    return {
      x: bb.x0 + (bb.x1 - bb.x0) * p.u,
      y: roofY[p.roof] + p.size[1] / 2,
      z: bb.z0 + (bb.z1 - bb.z0) * p.v,
      scale: p.size,
    };
  });
  group.add(instanced(new THREE.BoxGeometry(1, 1, 1), concrete(colors.penthouse), houses, (it) => it));

  /* The West Bar's vegetated roof: the photographed rectangular bands, each
     clipped to the bar's own width at that z, plus low clumps on top of them. */
  const G = roofs.greenRoof;
  const ring = ringOf(section, G.roof);
  const y = roofY[G.roof];
  const edgeX = (z, side) => {
    let best = null;
    for (let i = 0; i < ring.length; i++) {
      const [ax, az] = ring[i];
      const [bx, bz] = ring[(i + 1) % ring.length];
      if (z < Math.min(az, bz) || z > Math.max(az, bz) || az === bz) continue;
      const x = ax + ((bx - ax) * (z - az)) / (bz - az);
      if (best === null) best = [x, x];
      else best = [Math.min(best[0], x), Math.max(best[1], x)];
    }
    return best ? best[side] : null;
  };
  const clumps = { agave: [], grass: [], shrub: [] };
  for (const band of G.bands) {
    const zc = (band.z0 + band.z1) / 2;
    const xa = edgeX(zc, 0);
    const xb = edgeX(zc, 1);
    if (xa == null || xb == null) continue;
    const x0 = xa + 0.8;
    const x1 = xb - 0.8 - G.walkWidth;
    if (x1 <= x0) continue;
    const mesh = new THREE.Mesh(quad(x1 - x0, band.z1 - band.z0), decal(colors[band.color], CARPET));
    mesh.position.set((x0 + x1) / 2, y + 0.14, zc);
    mesh.renderOrder = OVERLAY[CARPET].renderOrder;
    group.add(mesh);
    if (!band.clump) continue;
    const n = Math.round((x1 - x0) * (band.z1 - band.z0) * band.density * 1.1);
    for (let k = 0; k < n; k++) {
      clumps[band.clump].push({
        x: x0 + hash(k, band.z0, 1) * (x1 - x0),
        y: y + 0.16,
        z: band.z0 + hash(k, band.z0, 2) * (band.z1 - band.z0),
        rot: hash(k, band.z0, 3) * Math.PI,
        scale: [0.8 + hash(k, band.z0, 4) * 0.5, 0.8 + hash(k, band.z0, 5) * 0.6, 0.8 + hash(k, band.z0, 4) * 0.5],
      });
    }
  }
  /* The maintenance walk down the middle of the green roof. */
  const bb = bboxOf(ring);
  const walkMesh = new THREE.Mesh(quad(G.walkWidth, bb.z1 - bb.z0 - 4), decal(colors.parapetCoping, PAINT));
  walkMesh.position.set(bb.x1 - 2.2, y + 0.17, (bb.z0 + bb.z1) / 2);
  walkMesh.renderOrder = OVERLAY[PAINT].renderOrder;
  group.add(walkMesh);

  /* Two tones per planting type, because a band of one colour reads as paint
     rather than as the succulent/grass mats in ls_024 and kt_keeling4. */
  const half = (list, odd) => list.filter((_, i) => (i % 2 === 1) === odd);
  for (const odd of [false, true]) {
    group.add(instanced(new THREE.ConeGeometry(0.42, 0.7, 5),
      foliage(odd ? colors.shrub : colors.succulentBlue), half(clumps.agave, odd),
      (it) => ({ ...it, y: it.y + 0.35 })));
    group.add(instanced(new THREE.ConeGeometry(0.3, 0.85, 4),
      foliage(odd ? colors.bunchGrass : colors.grassTawny), half(clumps.grass, odd),
      (it) => ({ ...it, y: it.y + 0.42 })));
    group.add(instanced(new THREE.SphereGeometry(0.38, 6, 4),
      foliage(odd ? colors.groundcover : colors.shrub), half(clumps.shrub, odd),
      (it) => ({ ...it, y: it.y + 0.22 })));
  }

  bins.counts.pv = panels.length;
  bins.counts.greenRoofBands = G.bands.length;
}

/* ------------------------------------------------------------ the ground */

function buildGround(section, group, ground) {
  const { colors, courtyard: C, west: W } = section;
  const padLift = overlayLift(PAD);
  const carpetLift = overlayLift(CARPET);
  const on = (x, z) => ground(x, z) + carpetLift;

  const flat = (rects, color, rung, lift) => {
    for (const r of rects) {
      const mesh = new THREE.Mesh(quad(r.x1 - r.x0, r.z1 - r.z0), decal(color, rung));
      mesh.position.set((r.x0 + r.x1) / 2, ground((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2) + lift, (r.z0 + r.z1) / 2);
      mesh.renderOrder = OVERLAY[rung].renderOrder;
      group.add(mesh);
    }
  };

  /* Sawn-jointed cast-in-place paving, then the planted troughs on top. The
     joints are what stop a 40 m courtyard reading as one poured white sheet. */
  flat(C.paving, colors.paving, PAD, padLift);
  const joints = [];
  for (const r of C.paving) {
    for (let x = Math.ceil(r.x0 / C.jointPitch) * C.jointPitch; x < r.x1; x += C.jointPitch) {
      joints.push({ x, z: (r.z0 + r.z1) / 2, w: C.jointWidth, d: r.z1 - r.z0 });
    }
    for (let z = Math.ceil(r.z0 / C.jointPitch) * C.jointPitch; z < r.z1; z += C.jointPitch) {
      joints.push({ x: (r.x0 + r.x1) / 2, z, w: r.x1 - r.x0, d: C.jointWidth });
    }
  }
  const jointMesh = instanced(quad(1, 1), decal(colors.pavingJoint, CARPET), joints,
    (j) => ({ x: j.x, y: ground(j.x, j.z) + carpetLift, z: j.z, scale: [j.w, 1, j.d] }));
  jointMesh.renderOrder = OVERLAY[CARPET].renderOrder;
  group.add(jointMesh);
  flat(section.southSide.apron, colors.paving, PAD, padLift);
  flat(W.slope.filter((s) => s.kind === "dg"), colors.dg, PAD, padLift);
  flat(W.slope.filter((s) => s.kind === "cobble"), colors.cobble, PAD, padLift);
  flat(C.swales.filter((s) => s.kind === "grass"), colors.shrub, CARPET, carpetLift);
  flat(C.swales.filter((s) => s.kind === "dg"), colors.dg, CARPET, carpetLift);

  /* Raised lawn panels in low board-formed frames, crisp square corners. */
  const frames = [];
  const turf = [];
  for (const l of C.lawns) {
    const cx = (l.x0 + l.x1) / 2;
    const cz = (l.z0 + l.z1) / 2;
    const g = ground(cx, cz);
    frames.push({ x: cx, y: g + l.lift / 2, z: cz, scale: [l.x1 - l.x0, l.lift, l.z1 - l.z0] });
    turf.push({ x: cx, y: g + l.lift + 0.02, z: cz, scale: [l.x1 - l.x0 - 2 * C.frameWidth, 1, l.z1 - l.z0 - 2 * C.frameWidth] });
  }
  group.add(instanced(new THREE.BoxGeometry(1, 1, 1), concrete(colors.seatWall), frames, (it) => it));
  group.add(instanced(quad(1, 1), foliage(colors.lawn), turf, (it) => it));

  /* Corten seams flush in the paving — long straight rust-coloured lines that
     carry much of the courtyard's graphic character. */
  const seams = C.corten.map((s) => {
    const len = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
    const cx = (s.a[0] + s.b[0]) / 2;
    const cz = (s.a[1] + s.b[1]) / 2;
    return {
      x: cx, y: ground(cx, cz) + overlayLift(PAINT), z: cz,
      rot: Math.atan2(-(s.b[1] - s.a[1]), s.b[0] - s.a[0]),
      scale: [len, 1, s.width],
    };
  });
  const seamMesh = instanced(quad(1, 1), decal(colors.cortenSteel, PAINT), seams, (it) => it);
  seamMesh.renderOrder = OVERLAY[PAINT].renderOrder;
  group.add(seamMesh);

  /* The arroyo: a cobble-filled runnel cutting the courtyard diagonally with
     a grass edge on one side. */
  const A = C.arroyo;
  const alen = Math.hypot(A.b[0] - A.a[0], A.b[1] - A.a[1]);
  const arot = Math.atan2(-(A.b[1] - A.a[1]), A.b[0] - A.a[0]);
  const acx = (A.a[0] + A.b[0]) / 2;
  const acz = (A.a[1] + A.b[1]) / 2;
  for (const [w, color, rung, off] of [
    [A.width + 2 * A.edge, colors.bunchGrass, CARPET, 0],
    [A.width, colors.cobble, PAINT, 0],
  ]) {
    const mesh = new THREE.Mesh(quad(alen, w), decal(color, rung));
    mesh.position.set(acx, ground(acx, acz) + overlayLift(rung) + off, acz);
    mesh.rotation.y = arot;
    mesh.renderOrder = OVERLAY[rung].renderOrder;
    group.add(mesh);
  }

  /* Circular board-formed seat walls around the planted islands. */
  const seats = C.seatWalls.map((s) => ({ x: s.x, y: ground(s.x, s.z) + s.height / 2, z: s.z, scale: [s.radius, s.height, s.radius] }));
  group.add(instanced(new THREE.CylinderGeometry(1, 1, 1, 22, 1, true), concrete(colors.seatWall), seats, (it) => it));
  group.add(instanced(new THREE.CylinderGeometry(1, 1, 1, 22), concrete(colors.seatWall),
    C.seatWalls.map((s) => ({ x: s.x, y: ground(s.x, s.z) + s.height, z: s.z, scale: [s.radius, 0.09, s.radius] })), (it) => it));

  /* Yellow moulded chaise lounges — the one strong colour on the ground. */
  const ch = C.chaise;
  group.add(instanced(new THREE.BoxGeometry(ch.length, 0.09, ch.width), painted(colors.chaiseYellow),
    C.chaises, (it) => ({ x: it.x, y: on(it.x, it.z) + ch.seat, z: it.z, rot: it.rot })));
  group.add(instanced(new THREE.BoxGeometry(0.09, ch.back, ch.width), painted(colors.chaiseYellow),
    C.chaises, (it) => ({
      x: it.x + Math.cos(it.rot) * ch.length * 0.45,
      y: on(it.x, it.z) + ch.seat + ch.back / 2,
      z: it.z - Math.sin(it.rot) * ch.length * 0.45,
      rot: it.rot,
    })));
  for (const side of [-0.4, 0.4]) {
    group.add(instanced(new THREE.BoxGeometry(0.08, ch.seat, ch.width * 0.8), painted(colors.chaiseYellow),
      C.chaises, (it) => ({
        x: it.x + Math.cos(it.rot) * ch.length * side,
        y: on(it.x, it.z) + ch.seat / 2,
        z: it.z - Math.sin(it.rot) * ch.length * side,
        rot: it.rot,
      })));
  }

  /* Black square-head light poles. Geometry only — no night source exists. */
  const L = C.lamp;
  group.add(instanced(new THREE.BoxGeometry(L.pole, L.height, L.pole), painted(colors.poleBlack),
    C.lamps, (it) => ({ x: it.x, y: on(it.x, it.z) + L.height / 2, z: it.z })));
  group.add(instanced(new THREE.BoxGeometry(L.head[0], L.head[1], L.head[2]), painted(colors.luminaire),
    C.lamps, (it) => ({ x: it.x, y: on(it.x, it.z) + L.height + L.head[1] / 2, z: it.z })));

  /* Bike-rack loops at the undercrofts. */
  const R = C.rack;
  const hoops = [];
  for (const r of C.racks) {
    for (let h = 0; h < r.hoops; h++) {
      const at = (h - (r.hoops - 1) / 2) * R.spacing;
      hoops.push({ x: r.x + Math.sin(r.rot) * at, z: r.z + Math.cos(r.rot) * at, rot: r.rot });
    }
  }
  group.add(instanced(new THREE.TorusGeometry(R.hoopWidth / 2, 0.035, 5, 10, Math.PI),
    painted(colors.rackYellow), hoops,
    (it) => ({ x: it.x, y: on(it.x, it.z), z: it.z, rot: it.rot })));

  /* West: half-buried white granite boulders and bunch grass on the dry slope. */
  group.add(instanced(new THREE.IcosahedronGeometry(1, 0), rock(colors.boulder), W.boulders,
    (b, i) => ({
      x: b.x, y: ground(b.x, b.z) + b.r * 0.35, z: b.z,
      rot: hash(i, 1) * Math.PI, rotX: hash(i, 2) * 0.4,
      scale: [b.r, b.r * 0.8, b.r * 0.9],
    })));

  const tufts = [];
  const spans = W.slope;
  for (let k = 0; k < W.grasses.count; k++) {
    const s = spans[Math.floor(hash(W.grasses.seed, k, 0) * spans.length) % spans.length];
    tufts.push({
      x: s.x0 + hash(W.grasses.seed, k, 1) * (s.x1 - s.x0),
      z: s.z0 + hash(W.grasses.seed, k, 2) * (s.z1 - s.z0),
      k,
    });
  }
  group.add(instanced(new THREE.ConeGeometry(W.grasses.radius, W.grasses.height, 5),
    foliage(colors.bunchGrass), tufts,
    (t) => ({ x: t.x, y: ground(t.x, t.z) + W.grasses.height / 2, z: t.z, rot: hash(t.k, 3) * Math.PI })));
  group.add(instanced(new THREE.ConeGeometry(W.grasses.radius * 0.8, W.grasses.height * 0.8, 5),
    foliage(colors.fescueBlue), tufts.filter((t) => hash(t.k, 4) < 0.4),
    (t) => ({ x: t.x + 0.5, y: ground(t.x, t.z) + W.grasses.height * 0.4, z: t.z + 0.4, rot: hash(t.k, 5) * Math.PI })));

  buildLavaWalls(section, group, ground);
}

/* The recurring lava-rock walls: dark scoria rubble under a smooth pale
   coping, board-formed pilasters at intervals, a corten strip between. */
function buildLavaWalls(section, group, ground) {
  const { colors } = section;
  const W = section.west;
  const L = W.lavaWall;
  const rocks = [];
  const copings = [];
  const cortens = [];
  const piers = [];
  W.lavaWalls.forEach((w, wi) => {
    const len = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
    const ux = (w.b[0] - w.a[0]) / len;
    const uz = (w.b[1] - w.a[1]) / len;
    const rot = Math.atan2(-uz, ux);
    const at = (u, off) => ({ x: w.a[0] + ux * u - uz * off, z: w.a[1] + uz * u + ux * off });
    const rockTop = w.height - L.coping.height - L.corten.height;
    for (let r = 0; r < L.rockRows; r++) {
      const rowY = ((r + 0.5) * rockTop) / L.rockRows;
      const step = 0.55;
      for (let u = step / 2; u < len; u += step) {
        const j = hash(L.seed, wi, r, Math.round(u * 10));
        const p = at(u + (j - 0.5) * 0.16, (j - 0.5) * 0.1);
        rocks.push({
          x: p.x, y: ground(p.x, p.z) + rowY, z: p.z,
          rot: rot + (j - 0.5) * 0.7, rotX: (hash(L.seed + 1, wi, r, u) - 0.5) * 0.35,
          scale: [step * 1.15, (rockTop / L.rockRows) * 1.2, L.thickness],
          dark: j < 0.4,
        });
      }
    }
    const mid = at(len / 2, 0);
    const g = ground(mid.x, mid.z);
    cortens.push({ x: mid.x, y: g + rockTop + L.corten.height / 2, z: mid.z, rot, scale: [len, L.corten.height, L.thickness + 0.04] });
    copings.push({
      x: mid.x, y: g + w.height - L.coping.height / 2, z: mid.z, rot,
      scale: [len, L.coping.height, L.thickness + 2 * L.coping.overhang],
    });
    for (let u = 0; u <= len + 0.01; u += L.pilaster.spacing) {
      const p = at(Math.min(u, len), 0);
      piers.push({
        x: p.x, y: ground(p.x, p.z) + (w.height + L.pilaster.rise) / 2, z: p.z, rot,
        scale: [L.pilaster.width, w.height + L.pilaster.rise, L.pilaster.depth],
      });
    }
  });
  const box = new THREE.BoxGeometry(1, 1, 1);
  group.add(instanced(box, rock(colors.lavaRock), rocks.filter((r) => !r.dark), (it) => it));
  group.add(instanced(box, rock(colors.lavaRockDark), rocks.filter((r) => r.dark), (it) => it));
  group.add(instanced(box, painted(colors.cortenSteel), cortens, (it) => it));
  group.add(instanced(box, concrete(colors.wallCoping), copings, (it) => it));
  group.add(instanced(box, concrete(colors.wallCoping), piers, (it) => it));
}

/* ------------------------------------------------------------------- api */

/**
 * Build Keeling's photo-sourced detail.
 *
 * `photo` is the loaded photo-detail document; this reads only its `keeling`
 * section and returns `{ group, counts }` (empty and harmless if the section is
 * missing, so a half-wired boot still runs). `surfaceAt` — the height of the
 * DRAWN terrain triangle — places everything that stands on the ground;
 * `heightAt` sets the building bases, because that is what campus-massing.js
 * used to put the measured masses there and the two must not diverge.
 */
export function createPhotoKeeling(scene, { photo, heightAt, surfaceAt } = {}) {
  const group = new THREE.Group();
  group.name = "photo-keeling";
  const section = photo?.keeling;
  if (!section) {
    scene?.add(group);
    return { group, counts: {} };
  }
  const ground = surfaceAt || heightAt;
  const base = heightAt || surfaceAt;
  if (typeof ground !== "function" || typeof base !== "function") {
    throw new Error("campus-photo-keeling: needs surfaceAt (or heightAt) to place on the ground");
  }

  /* Match campus-massing.js exactly: the mass sits on the MEDIAN ground under
     its ring, lifted if that would bury a high corner. Any other base and the
     facade layers slide off the wall they are supposed to be hanging on. */
  const baseY = {};
  const roofY = {};
  for (const [key, b] of Object.entries(section.buildings)) {
    const ring = ringOf(section, key);
    const gs = ring.map(([x, z]) => base(x, z)).filter((v) => Number.isFinite(v)).sort((p, q) => p - q);
    const median = gs.length ? gs[Math.floor(gs.length / 2)] : 0;
    const highest = gs.length ? gs[gs.length - 1] : 0;
    roofY[key] = Math.max(median + b.height, highest);
    baseY[key] = roofY[key] - b.height;
  }

  const bins = {
    slabBands: [], galleryBack: [], screens: [], railCaps: [], posts: [], bars: [], fins: [], tabs: [], doors: [],
    frameBands: [], panels: [], glass: [], frames: [], stairRed: [], landings: [],
    groundGlass: [], columns: [],
    counts: {},
  };
  const keyOf = (id) => (id.startsWith("north") ? "north" : id.startsWith("south") ? "south" : "bar");
  for (const f of section.facades) {
    const frame = frameOf(f);
    const b = baseY[keyOf(f.id)];
    if (f.system === "A") collectSystemA(section, f, frame, b, bins);
    else if (f.system === "B") collectSystemB(section, f, frame, b, bins);
    else collectEnd(section, f, frame, b, bins);
  }

  const { colors } = section;
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const plane = new THREE.PlaneGeometry(1, 1);
  const add = (geo, mat, items) => {
    if (!items.length) return;
    group.add(instanced(geo, mat, items, (it) => it));
  };

  add(plane, concrete(colors.gallerySoffit), bins.galleryBack);
  add(unit, concrete(colors.slabEdge), bins.slabBands);
  add(unit, concrete(colors.frameConcrete), bins.frameBands);
  for (const tone of ["precastPanel", "precastPanelWarm", "precastPanelPale"]) {
    add(unit, concrete(colors[tone]), bins.panels.filter((p) => p.tone === tone));
  }
  for (const tint of new Set(bins.glass.map((g) => g.tint))) {
    add(plane, glassMat(colors[tint]), bins.glass.filter((g) => g.tint === tint));
  }
  add(unit, painted(colors.windowFrame), bins.frames);
  add(plane, glassMat(colors.glassGround), bins.groundGlass);
  add(unit, concrete(colors.column), bins.columns);
  add(unit, painted(colors.stairRed), bins.stairRed);
  add(unit, concrete(colors.soffit), bins.landings);
  add(unit, painted(colors.doorRed), bins.doors);
  add(plane, screen(colors.gratingBar, section.systemA.balustrade.openness), bins.screens);
  add(unit, grating(colors.railCap), bins.railCaps);
  add(unit, grating(colors.gratingBar), bins.posts);
  add(unit, grating(colors.gratingBar), bins.bars);
  add(unit, grating(colors.gratingFin), bins.fins);
  add(unit, metal(colors.tabPlate), bins.tabs);

  buildRoofs(section, group, ground, roofY, bins);
  buildGround(section, group, ground);

  scene?.add(group);
  return {
    group,
    counts: {
      facades: section.facades.length,
      fins: bins.fins.length,
      panels: bins.panels.length,
      windows: bins.glass.length,
      slabBands: bins.slabBands.length,
      bars: bins.bars.length,
      pv: bins.counts.pv || 0,
      greenRoofBands: bins.counts.greenRoofBands || 0,
      lamps: section.courtyard.lamps.length,
      boulders: section.west.boulders.length,
      draws: group.children.length,
    },
  };
}
