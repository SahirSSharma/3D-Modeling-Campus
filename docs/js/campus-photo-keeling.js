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
//   1. The building solves on one grid — but the DRAWN box is the datum.
//      37.2 / 30.0 / 22.8 m are 10, 8 and 6 storeys of 3.60 m plus a 1.20 m
//      parapet with zero residual, yet those are campus-3d's OSM-side
//      heights: what campus-massing actually extrudes is the reconciled
//      34.2 / 27 / 18.3 m (`buildings.*.measured.drawnHeight`, recomputed by
//      test from assembleMasses over the shipped files), and a skin hung on
//      a taller claim floats a phantom top storey above the real lid. So the
//      storey height drawn here is drawnHeight / storeys per building, the
//      photographed plate COUNT filling the drawn box exactly, and the
//      parapet band stands ON the lid like the rails and penthouses.
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
// What is NOT here is in the section's `absent` array. The south side is the
// section's declared epoch conflict: the 2013 aerials show dark green courts,
// the gap-closure reading of the current orthophoto shows them resurfaced
// BLUE, and the 2026-08-04 chunks show construction shading over part of that
// strip. Newest reading wins on appearance — the courts are built BLUE, as
// flat decals only, and everything above the surface stays in `absent`.
//
// Surfaces come from the procedural material library (campus-materials.js):
// the colours stay this section's sourced hexes, the library only supplies
// microstructure — precast reads as sand-blasted concrete, the courtyard as
// jointed unit paving, the dry slope as decomposed granite. Deterministic:
// the library is seeded, and this file's own irregularity comes from `hash`.
import * as THREE from "../vendor/three/three.module.min.js";
import { applyOverlayDepth, OVERLAY, overlayLift } from "./campus-overlay.js";
import { sharedMaterialLibrary } from "./campus-materials.js";

/* Ground decals ride the overlay ladder so they paint over the measured
   terrain in a fixed order instead of z-fighting it. */
const PAD = "pad";
const CARPET = "carpet";
const PAINT = "paint";
const LOGO = "logo";

/* The process-wide shared material library. Every
   opaque surface routes through it; the colours stay the section's hexes and
   the library multiplies its computed variation into them. */
const lib = () => sharedMaterialLibrary(THREE);

/* Sand-blasted precast, cast-in-place frames, copings. */
const concrete = (color) => lib().get("smoothConcrete", { color });
/* Board-formed: seat walls, lawn frames, wall pilasters — the visible grain. */
const boardformed = (color) =>
  lib().get("boardFormedConcrete", { color, normalScale: 0.6 });
/* FRP grating bars/fins/posts: barely metallic, warm tan stays the caller's. */
const grating = (color) =>
  lib().get("metalPanel", { color, metalness: 0.12, roughness: 0.68 });
/* Painted steel and painted mouldings. */
const painted = (color) =>
  lib().get("metalPanel", { color, metalness: 0.35, roughness: 0.55 });
const metal = (color) => lib().get("metalPanel", { color });
const glassMat = (color) => lib().get("glass", { color });
const rock = (color) => lib().get("lavaRock", { color });
/* Plant clumps stay a plain lambert-ish standard material: the library's
   foliage class is an alpha-cut CARD map, and cutting holes in cone/sphere
   clump geometry would shred it. */
const foliage = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0.0 });

/**
 * A ground decal in a named material class. `repeat` is the per-surface
 * lever: pass the quad's world size and the class's real-world tile size and
 * the microstructure lands at true scale (e.g. 1.2 m unit pavers).
 */
function decal(color, rung, cls = "smoothConcrete", repeat) {
  return applyOverlayDepth(lib().get(cls, { color, repeat }), rung);
}

/** The aggregate screen: tan bars over open air, so it is tinted AND see-through. */
function screen(color, openness) {
  const maps = lib().textures("metalPanel");
  return new THREE.MeshStandardMaterial({
    color,
    map: maps.map,
    roughnessMap: maps.roughnessMap,
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
   layer ends up as ONE instanced draw for the whole complex. `F` is the
   building's DRAWN storey height — lidarHeight / storeys — so the counted
   plates fill the drawn massing box exactly instead of overshooting it. */
function collectSystemA(section, f, frame, base, bins, F) {
  const A = section.systemA;
  const M = section.grid.module;
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

  /* The bar's road-facing base is an OPEN UNDERCROFT on square columns
     (ls_021_s.jpg, ls_014.jpg; systemB.ground.note), not a glazed storefront:
     a dark shadow plane tight to the measured wall with the pale columns
     standing proud of it, same technique as every recessed ground floor. */
  if (f.id.startsWith("bar-west")) {
    const G = section.systemB.ground;
    bins.galleryBack.push({
      ...frame.at(length / 2, 0.02, base + F / 2),
      rot,
      scale: [length - 0.2, F, 1],
    });
    for (const bay of bays) {
      if (bay.i % G.columnSpacingBays !== 0) continue;
      bins.columns.push({
        ...frame.at(bay.u, G.recess + G.columnSize / 2, base + F / 2),
        rot,
        scale: [G.columnSize, F, G.columnSize],
      });
    }
  }
}

/* ------------------------------------------ System B, precast + punched */

function collectSystemB(section, f, frame, base, bins, F) {
  const B = section.systemB;
  const M = section.grid.module;
  const { rot, length } = frame;
  /* Rain-screen: the full panels stand PROUD of the wall (cote15_westtower),
     with the windows and their spandrels recessed behind and between them.
     The strong vertical shadow lines on this facade are panel edges. */
  const proud = B.rainScreen?.proud ?? 0;
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
          ...frame.at(uc, B.standoff + proud - B.panel.thickness / 2, y0 + bandH / 2),
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
      /* The slot is RECESSED (a7_northface): the landing reads as a thin
         nosing IN the wall plane, not a tray hanging off the facade — the
         tray's depth is buried in the measured wall, only its front edge
         and the rail at the wall plane show. */
      bins.landings.push({
        ...frame.at(uOpen, B.standoff + 0.05 - S.landing.depth / 2, y - S.landing.thickness / 2),
        rot,
        scale: [S.openWidth, S.landing.thickness, S.landing.depth],
      });
      bins.screens.push({
        ...frame.at(uOpen, B.standoff + 0.12, y + S.railHeight / 2),
        rot,
        scale: [S.openWidth, S.railHeight, 1],
      });
      bins.railCaps.push({
        ...frame.at(uOpen, B.standoff + 0.12, y + S.railHeight),
        rot,
        scale: [S.openWidth, 0.07, 0.1],
      });
    }
  }

  collectGroundFloor(section, f, frame, base, bins, F);
}

/* End walls: pale precast RAIN-SCREEN with the narrow slot windows of
   c6_towerB. The panels stand the declared rainScreen.proud (0.2 m) off the
   wall in the same staggered layout as System B — the earlier flat storey
   panels with 0.14 m slots vanished at distance and the four tower ends read
   as blank band stacks. Per systemB.rainScreen.endFaces the panelisation is
   an [estimated] extension of the photographed System B pattern; `plain`
   (the unphotographed notch steps) carries the panels with NO windows,
   because a blank wall claims less than glass. */
function collectEnd(section, f, frame, base, bins, F, plain = false) {
  const B = section.systemB;
  const M = section.grid.module;
  const { rot, length } = frame;
  const proud = B.rainScreen?.proud ?? 0;
  const gap = B.panel.gap;
  const bayCount = Math.max(1, Math.floor(length / M));
  const pad = (length - bayCount * M) / 2;
  const uOf = (bay) => pad + bay * M;
  const tones = ["precastPanelPale", "precastPanel", "precastPanelPale"];
  for (let lv = 1; lv < f.storeys; lv++) {
    const y0 = base + lv * F + B.frameBand.height / 2;
    const bandH = F - B.frameBand.height;
    /* The recessed backing the reveals read down to — a darker warm precast
       plane tight to the measured wall, corner to corner. */
    bins.panels.push({
      tone: "precastPanelWarm",
      ...frame.at(length / 2, B.standoff + 0.03, y0 + bandH / 2),
      rot,
      scale: [length - 0.1, bandH, 0.06],
    });
    /* Staggered rain-screen panels: each storey starts its run at a different
       offset so the vertical reveals never stack into one joint — the strong
       vertical shadow lines of cote15_westtower are these panel EDGES. */
    const start = Math.floor(hash(B.panel.seed + 7, lv, frame.length) * 2);
    let bay = -start;
    while (bay < bayCount) {
      const widthBays = pick(B.panel.widthsBays, B.panel.seed + 8, lv, bay, frame.length);
      const b0 = Math.max(0, bay);
      const b1 = Math.min(bayCount, bay + widthBays);
      bay += widthBays;
      if (b1 <= b0) continue;
      const w = (b1 - b0) * M - gap;
      const uc = (uOf(b0) + uOf(b1)) / 2;
      const isSlot = !plain && b1 - b0 >= 1 &&
        hash(B.panel.seed + 9, lv, b0, frame.length) < 0.34;
      if (!isSlot) {
        /* Full-depth box, backing to front face: the exposed side edges are
           what cast the reveal shadows that survive distance. */
        bins.panels.push({
          tone: pick(tones, B.panel.seed + 2, lv, b0, frame.length),
          ...frame.at(uc, B.standoff + proud / 2, y0 + bandH / 2),
          rot,
          scale: [w, bandH, proud],
        });
        continue;
      }
      /* A slot cell: the narrow window sits deep in the wall plane with the
         flanking panels' full 0.2 m returns as its jambs, and the glass dark
         enough (windowFrame's near-black) to hold the slot at 300 m. */
      const slotW = 0.55;
      const slotH = bandH - 0.9;
      const side = (w - slotW) / 2 - gap;
      for (const t of [-1, 1]) {
        bins.panels.push({
          tone: pick(tones, B.panel.seed + 2, lv, b0 + (t + 1) / 2, frame.length),
          ...frame.at(uc + t * (slotW / 2 + gap + side / 2), B.standoff + proud / 2, y0 + bandH / 2),
          rot,
          scale: [side, bandH, proud],
        });
      }
      /* Spandrel above and below the slot, at panel depth, so the recess is
         the slot itself and not a full-height stripe of backing. */
      const sill = 0.45;
      for (const [sy, sh] of [[y0 + sill / 2, sill], [y0 + sill + slotH + (bandH - sill - slotH) / 2, bandH - sill - slotH]]) {
        bins.panels.push({
          tone: pick(tones, B.panel.seed + 4, lv, b0, frame.length),
          ...frame.at(uc, B.standoff + proud / 2, sy),
          rot,
          scale: [slotW, sh, proud],
        });
      }
      /* The pane is 35%-opaque; without a dark ground it reads as the warm
         backing and the slot dies at distance. The soffit-dark reveal sits
         just behind the glass, so the slot stays the darkest thing on the
         elevation (c6_towerB), with the pane's sheen over it. */
      bins.galleryBack.push({
        ...frame.at(uc, B.standoff + 0.08, y0 + sill + slotH / 2),
        rot,
        scale: [slotW, slotH, 1],
      });
      bins.glass.push({
        tint: "windowFrame",
        ...frame.at(uc, B.standoff + 0.11, y0 + sill + slotH / 2),
        rot,
        scale: [slotW, slotH, 1],
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
  /* A plain (notch) wall is a wall to the ground too — no storefront glass. */
  if (!plain) collectGroundFloor(section, f, frame, base, bins, F);
  else {
    bins.panels.push({
      tone: "precastPanelPale",
      ...frame.at(length / 2, B.standoff + B.panel.thickness / 2, base + (F + B.frameBand.height) / 2),
      rot,
      scale: [length - 0.2, F - B.frameBand.height, B.panel.thickness],
    });
  }
}

/* The ground floor everywhere: dark glazing tight to the wall, square columns
   standing proud of it. The columns are what make it read as recessed without
   cutting a hole in measured massing. */
function collectGroundFloor(section, f, frame, base, bins, F) {
  const G = section.systemB.ground;
  const M = section.grid.module;
  const { rot, length } = frame;
  bins.groundGlass.push({
    ...frame.at(length / 2, 0.03, base + G.glazingHeight / 2),
    rot,
    scale: [length - 0.4, Math.min(G.glazingHeight, F - 0.2), 1],
  });
  for (const bay of bayCentres(length, M)) {
    if (bay.i % G.columnSpacingBays !== 0) continue;
    bins.columns.push({
      ...frame.at(bay.u, G.recess + G.columnSize / 2, base + F / 2),
      rot,
      scale: [G.columnSize, F, G.columnSize],
    });
  }
}

/* ------------------------------------------------------------- the roofs */

/** The measured ring: verbatim from the section's `measured` block when it
 *  carries one (the survey ring campus-massing extrudes, INCLUDING the east
 *  notch step — a convex hull bridges that notch with a chamfer that has no
 *  massing under it), else reassembled from the vertices the facades name. */
function ringOf(section, key) {
  const measured = section.buildings?.[key]?.measured?.ring;
  if (Array.isArray(measured) && measured.length >= 3) return measured;
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

  /* The 1.20 m white concrete parapet band on EVERY face (a7_topband):
     fair-faced white, brighter and smoother than the precast field below it,
     with a crisp square coping, a thin shadow reveal at its base, and a
     slender fall-protection rail standing inboard the full length of every
     roof edge. The band STANDS ON the drawn massing lid — `roofY` here is the
     LiDAR box top campus-massing extrudes — the same way the rails and
     penthouses do, so the lid is the roof membrane and everything on it
     (racks, trays, walkways) hides behind this band from the street. */
  const PB = roofs.parapet;
  const copes = [];
  const bands = [];
  const reveals = [];
  const railPosts = [];
  const railBars = [];
  for (const key of ["north", "south", "bar"]) {
    const ring = ringOf(section, key);
    const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
    const cz = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    const y = roofY[key];
    for (let i = 0; i < ring.length; i++) {
      const [ax, az] = ring[i];
      const [bx, bz] = ring[(i + 1) % ring.length];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 0.2) continue;
      const ux = (bx - ax) / len;
      const uz = (bz - az) / len;
      const mx = (ax + bx) / 2;
      const mz = (az + bz) / 2;
      /* Outward normal for this segment: the perpendicular that points away
         from the ring's centroid, so proud/inboard never depend on winding. */
      let nx = uz;
      let nz = -ux;
      if (nx * (mx - cx) + nz * (mz - cz) < 0) { nx = -nx; nz = -nz; }
      const rot = Math.atan2(-uz, ux);
      copes.push({
        x: mx, y: y + PB.height + C.height / 2, z: mz, rot,
        scale: [len, C.height, C.width],
      });
      /* Band: a real wall standing on the lid, outer face proud PB.proud. */
      const bandDepth = 0.4;
      bands.push({
        x: mx + nx * (PB.proud - bandDepth / 2),
        y: y + PB.height / 2,
        z: mz + nz * (PB.proud - bandDepth / 2),
        rot,
        scale: [len, PB.height, bandDepth],
      });
      /* The thin shadow reveal where the band meets the precast field — that
         seam is now the lid line, so the reveal sits just under it. */
      reveals.push({
        x: mx + nx * (PB.proud + 0.012),
        y: y - PB.revealHeight / 2,
        z: mz + nz * (PB.proud + 0.012),
        rot,
        scale: [len, PB.revealHeight, 0.025],
      });
      /* The inboard rail: posts plus two horizontal bars, continuous. */
      const R = PB.rail;
      const rx = mx - nx * R.inset;
      const rz = mz - nz * R.inset;
      const n = Math.max(1, Math.round(len / R.postSpacing));
      for (let p = 0; p <= n; p++) {
        const u = (p / n - 0.5) * (len - 0.3);
        railPosts.push({
          x: rx + ux * u, y: y + R.height / 2, z: rz + uz * u, rot,
          scale: [R.bar, R.height, R.bar],
        });
      }
      for (const h of [R.height, R.height * 0.55]) {
        railBars.push({
          x: rx, y: y + h, z: rz, rot,
          scale: [len - 0.3, R.bar, R.bar],
        });
      }
    }
  }
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  group.add(instanced(unitBox, concrete(colors.parapetWhite), copes, (it) => it));
  group.add(instanced(unitBox, concrete(colors.parapetWhite), bands, (it) => it));
  group.add(instanced(unitBox, concrete(colors.gallerySoffit), reveals, (it) => it));
  group.add(instanced(unitBox, painted(colors.railSteel), railPosts, (it) => it));
  group.add(instanced(unitBox, painted(colors.railSteel), railBars, (it) => it));
  bins.counts.parapetRail = railPosts.length;

  /* PV: low ballasted tilt racks directly ON the tower membranes — the
     earlier canopy was invented and is gone. Single-module landscape rows
     parallel to each tower's long axis, all tilted the same way, split into
     two blocks by a cross service walkway, on slender legs over pale ballast
     trays, inset from the parapet. Row counts and clips are DATA; the clips
     keep hardware off the notch at each tower's east end, where the bounding
     box oversails the measured ring. */
  const P = roofs.pv;
  const sin = Math.sin(P.tilt);
  const cos = Math.cos(P.tilt);
  const backLegH = P.lowEdge + P.panel[1] * sin;
  const panels = [];
  const legs = [];
  const trays = [];
  const walks = [];
  for (const bank of P.banks) {
    const bb = bboxOf(ringOf(section, bank.roof));
    const y = roofY[bank.roof];
    const x0 = bb.x0 + P.inset;
    const x1 = bb.x1 - P.inset;
    const z0 = bb.z0 + P.inset;
    const z1 = bb.z1 - P.inset;
    const zc = (z0 + z1) / 2;
    const xm = (x0 + x1) / 2;
    for (let r = 0; r < bank.rows; r++) {
      const z = zc + (r - (bank.rows - 1) / 2) * P.rowPitch;
      /* Clip the row's x-extent off any declared notch it crosses. */
      let rx1 = x1;
      for (const c of bank.clips || []) {
        if (z + P.panel[1] / 2 > c.z0 && z - P.panel[1] / 2 < c.z1) {
          rx1 = Math.min(rx1, c.x1 - 0.4);
        }
      }
      for (const [bx0, bx1] of [
        [x0, xm - P.walkway / 2],
        [xm + P.walkway / 2, rx1],
      ]) {
        for (let x = bx0 + P.panel[0] / 2; x <= bx1 - P.panel[0] / 2; x += P.panel[0] + 0.06) {
          /* Panel centre height: low (south) edge at lowEdge, tilted up
             toward the north so the face looks south. */
          panels.push({
            x, z,
            y: y + P.lowEdge + (P.panel[1] / 2) * sin + 0.04,
            rotX: P.tilt,
          });
          for (const side of [-1, 1]) {
            const lx = x + side * P.panel[0] * 0.4;
            /* Back (north, -z) legs carry the high edge; front the low. */
            for (const [dz, h] of [[-P.panel[1] * 0.42 * cos, backLegH], [P.panel[1] * 0.42 * cos, P.lowEdge]]) {
              legs.push({ x: lx, y: y + h / 2 + 0.06, z: z + dz, scale: [0.05, h, 0.05] });
              trays.push({ x: lx, y: y + P.ballastTray[1] / 2, z: z + dz, scale: P.ballastTray });
            }
          }
        }
      }
    }
    const span = bank.rows * P.rowPitch + 0.8;
    /* The cross service walkway between the two blocks, plus a connector
       toward the plant end — yellow paint on the membrane. */
    walks.push({ x: xm, y, z: zc, w: P.walkway, d: span });
    walks.push({ x: (xm + x1) / 2, y, z: zc + (bank.rows % 2 === 0 ? P.rowPitch / 2 : 0), w: x1 - xm, d: P.walkway });
  }
  group.add(instanced(new THREE.BoxGeometry(P.panel[0], 0.05, P.panel[1]), painted(colors.pvPanel),
    panels, (it) => it));
  group.add(instanced(unitBox, metal(colors.pvFrame), legs, (it) => it));
  group.add(instanced(unitBox, concrete(colors.ballastTray), trays, (it) => it));
  for (const w of walks) {
    const mesh = new THREE.Mesh(quad(w.w, w.d), decal(colors.walkYellow, PAINT));
    mesh.position.set(w.x, w.y + 0.03, w.z);
    mesh.renderOrder = OVERLAY[PAINT].renderOrder;
    group.add(mesh);
  }

  /* Mechanical penthouses, two per tower: the cream stair-and-lift overrun
     and the lower grey plant box (ls_004, ls_006). */
  const houses = roofs.penthouses.map((p) => {
    const bb = bboxOf(ringOf(section, p.roof));
    return {
      kind: p.kind,
      x: bb.x0 + (bb.x1 - bb.x0) * p.u,
      y: roofY[p.roof] + p.size[1] / 2,
      z: bb.z0 + (bb.z1 - bb.z0) * p.v,
      scale: p.size,
    };
  });
  group.add(instanced(unitBox, concrete(colors.penthouse),
    houses.filter((h) => h.kind !== "plant"), (it) => it));
  group.add(instanced(unitBox, metal(colors.plantBox),
    houses.filter((h) => h.kind === "plant"), (it) => it));

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
  /* All interior x-spans of the bar at a given z, parity-paired. The EXACT
     massing ring has a re-entrant carve at z 463.5-470.1 that cuts nearly
     through the bar and a link stub toward the South Tower at z 484.9-488.8;
     a single min/max edge pair would carpet straight across those voids, so
     every band is laid in 1 m strips clipped to the spans that exist. */
  const spansAt = (z) => {
    const xs = [];
    for (let i = 0; i < ring.length; i++) {
      const [ax, az] = ring[i];
      const [bx, bz] = ring[(i + 1) % ring.length];
      if (z < Math.min(az, bz) || z >= Math.max(az, bz) || az === bz) continue;
      xs.push(ax + ((bx - ax) * (z - az)) / (bz - az));
    }
    xs.sort((a, b) => a - b);
    const out = [];
    for (let i = 0; i + 1 < xs.length; i += 2) out.push([xs[i], xs[i + 1]]);
    return out;
  };
  const clumps = { agave: [], grass: [], shrub: [] };
  for (const band of G.bands) {
    const strips = [];
    for (let z0 = band.z0; z0 < band.z1 - 0.01; z0 += 1) {
      const z1 = Math.min(band.z1, z0 + 1);
      const zc = (z0 + z1) / 2;
      for (const [xa, xb] of spansAt(zc)) {
        const x0 = xa + 0.8;
        const x1 = xb - 0.8 - G.walkWidth;
        if (x1 <= x0) continue;
        strips.push({ x: (x0 + x1) / 2, y: y + 0.14, z: zc, scale: [x1 - x0, 1, z1 - z0] });
      }
    }
    if (strips.length) {
      const mesh = instanced(quad(1, 1), decal(colors[band.color], CARPET), strips, (it) => it);
      mesh.renderOrder = OVERLAY[CARPET].renderOrder;
      group.add(mesh);
    }
    if (!band.clump) continue;
    const zm = (band.z0 + band.z1) / 2;
    const wide = spansAt(zm).sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]))[0];
    if (!wide) continue;
    const n = Math.round((wide[1] - wide[0] - 0.8 - G.walkWidth) * (band.z1 - band.z0) * band.density * 1.1);
    for (let k = 0; k < n; k++) {
      const pz = band.z0 + hash(k, band.z0, 2) * (band.z1 - band.z0);
      /* Plant only on roof that exists at THIS z — never over the carve. */
      const span = spansAt(pz).sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]))[0];
      if (!span) continue;
      const x0 = span[0] + 0.8;
      const x1 = span[1] - 0.8 - G.walkWidth;
      if (x1 <= x0) continue;
      const px = x0 + hash(k, band.z0, 1) * (x1 - x0);
      /* Nothing planted grows up through a terrace deck. */
      if ((roofs.terrace?.decks || []).some((d) => pz >= d.z0 - 0.4 && pz <= d.z1 + 0.4)) continue;
      clumps[band.clump].push({
        x: px,
        y: y + 0.16,
        z: pz,
        rot: hash(k, band.z0, 3) * Math.PI,
        scale: [0.8 + hash(k, band.z0, 4) * 0.5, 0.8 + hash(k, band.z0, 5) * 0.6, 0.8 + hash(k, band.z0, 4) * 0.5],
      });
    }
  }
  /* The maintenance walk hugs the courtyard-side edge — strip by strip along
     the spans that exist, never cantilevered over the carve or the courtyard
     (the old bbox-anchored quad hovered 5 m east of the wall mid-bar). */
  const bb = bboxOf(ring);
  const walkStrips = [];
  for (let z0 = bb.z0 + 2; z0 < bb.z1 - 2.01; z0 += 1) {
    const z1 = Math.min(bb.z1 - 2, z0 + 1);
    const zc = (z0 + z1) / 2;
    const span = spansAt(zc).sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]))[0];
    if (!span || span[1] - span[0] < 0.8 + G.walkWidth) continue;
    walkStrips.push({ x: span[1] - 0.8 - G.walkWidth / 2, y: y + 0.17, z: zc, scale: [G.walkWidth, 1, z1 - z0] });
  }
  const walkMesh = instanced(quad(1, 1), decal(colors.parapetCoping, PAINT), walkStrips, (it) => it);
  walkMesh.renderOrder = OVERLAY[PAINT].renderOrder;
  group.add(walkMesh);

  /* The roof terrace near the North Tower junction: decks on the bar roof
     with white pergola/trellis frames SEATED on them (ls_007, ls_006) — the
     only elevated frames anywhere on these roofs, and the thing the deleted
     PV canopy was most likely mistaken for. */
  const T = roofs.terrace;
  if (T) {
    const deckAt = (zc) => {
      const xb = edgeX(zc, 1);
      return xb == null ? null : { x1: xb - 0.9 - G.walkWidth, x0: xb - 0.9 - G.walkWidth - T.deckWidth };
    };
    for (const d of T.decks) {
      const zc = (d.z0 + d.z1) / 2;
      const span = deckAt(zc);
      if (!span) continue;
      const mesh = new THREE.Mesh(
        quad(span.x1 - span.x0, d.z1 - d.z0),
        decal(colors.deckGrey, PAINT, "woodSlat", [(span.x1 - span.x0) / 1.4, (d.z1 - d.z0) / 1.4])
      );
      mesh.position.set((span.x0 + span.x1) / 2, y + 0.18, zc);
      mesh.renderOrder = OVERLAY[PAINT].renderOrder;
      group.add(mesh);
    }
    const PG = T.pergola;
    const pgParts = [];
    for (const p of T.pergolas) {
      const span = deckAt(p.z);
      if (!span) continue;
      const cx = (span.x0 + span.x1) / 2;
      /* Four posts, two beams, and the slat lid — everything stands on the
         bar's roof plane, nothing floats. */
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          pgParts.push({
            x: cx + (sx * (PG.w - PG.post)) / 2, y: y + PG.h / 2,
            z: p.z + (sz * (PG.d - PG.post)) / 2,
            scale: [PG.post, PG.h, PG.post],
          });
        }
      }
      for (const sz of [-1, 1]) {
        pgParts.push({
          x: cx, y: y + PG.h + PG.beam / 2, z: p.z + (sz * (PG.d - PG.beam)) / 2,
          scale: [PG.w + 0.3, PG.beam, PG.beam],
        });
      }
      for (let u = -PG.w / 2 + PG.slatPitch / 2; u < PG.w / 2; u += PG.slatPitch) {
        pgParts.push({
          x: cx + u, y: y + PG.h + PG.beam + PG.slat[1] / 2, z: p.z,
          scale: [PG.slat[0], PG.slat[1], PG.d + 0.4],
        });
      }
    }
    group.add(instanced(new THREE.BoxGeometry(1, 1, 1), painted(colors.pergolaWhite), pgParts,
      (it) => it));
    bins.counts.pergolas = T.pergolas.length;
  }

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

  /* `tile` is the class's real-world tile size in metres — the per-surface
     repeat lever that puts the microstructure at true scale. */
  const flat = (rects, color, rung, lift, cls, tile) => {
    for (const r of rects) {
      const w = r.x1 - r.x0;
      const d = r.z1 - r.z0;
      const mesh = new THREE.Mesh(
        quad(w, d),
        decal(color, rung, cls, tile ? [w / tile, d / tile] : undefined)
      );
      mesh.position.set((r.x0 + r.x1) / 2, ground((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2) + lift, (r.z0 + r.z1) / 2);
      mesh.renderOrder = OVERLAY[rung].renderOrder;
      group.add(mesh);
    }
  };

  /* Sawn-jointed cast-in-place paving, then the planted troughs on top. The
     joints are what stop a 40 m courtyard reading as one poured white sheet.
     Unit-paver class at 7.2 m/tile puts the cast units at 1.2 m — the module. */
  flat(C.paving, colors.paving, PAD, padLift, "pavingConcreteUnit", 7.2);
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
  flat(section.southSide.apron, colors.paving, PAD, padLift, "pavingConcreteUnit", 7.2);
  flat(W.slope.filter((s) => s.kind === "dg"), colors.dg, PAD, padLift, "decomposedGranite", 2.5);
  flat(W.slope.filter((s) => s.kind === "cobble"), colors.cobble, PAD, padLift, "decomposedGranite", 1.6);
  flat(C.swales.filter((s) => s.kind === "grass"), colors.shrub, CARPET, carpetLift);
  flat(C.swales.filter((s) => s.kind === "dg"), colors.dg, CARPET, carpetLift, "decomposedGranite", 2.5);

  /* The two basketball courts south-west of the South Tower — the declared
     epoch conflict, resolved newest-first: dark green in every 2013 aerial,
     resurfaced BLUE in the gap-closure reading of the current orthophoto, so
     blue is what is built. FLAT DECALS ONLY: the staging route crosses their
     north-east corner, and nothing above the surface has a current source. */
  const SS = section.southSide;
  if (SS.courts) {
    flat([SS.surround], colors.courtSurround, CARPET, carpetLift, "asphalt", 3);
    flat(SS.courts, colors.courtBlue, PAINT, overlayLift(PAINT), "asphalt", 3);
    const lines = [];
    for (const c of SS.courts) {
      const w = c.x1 - c.x0;
      const d = c.z1 - c.z0;
      const cx = (c.x0 + c.x1) / 2;
      const cz = (c.z0 + c.z1) / 2;
      lines.push({ x: cx, z: c.z0 + SS.line / 2, w, d: SS.line });
      lines.push({ x: cx, z: c.z1 - SS.line / 2, w, d: SS.line });
      lines.push({ x: c.x0 + SS.line / 2, z: cz, w: SS.line, d });
      lines.push({ x: c.x1 - SS.line / 2, z: cz, w: SS.line, d });
      lines.push({ x: cx, z: cz, w, d: SS.line });
    }
    const lineMesh = instanced(quad(1, 1), decal(colors.courtLine, LOGO), lines,
      (l) => ({ x: l.x, y: ground(l.x, l.z) + overlayLift(LOGO), z: l.z, scale: [l.w, 1, l.d] }));
    lineMesh.renderOrder = OVERLAY[LOGO].renderOrder;
    group.add(lineMesh);
  }

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
  group.add(instanced(new THREE.BoxGeometry(1, 1, 1), boardformed(colors.seatWall), frames, (it) => it));
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
  group.add(instanced(new THREE.CylinderGeometry(1, 1, 1, 22, 1, true), boardformed(colors.seatWall), seats, (it) => it));
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

  /* West: rounded white-granite boulders, HALF-BURIED and irregular — a
     smoother icosahedron squashed flat and sunk, every one its own shape
     (ls_021_s, ls_024), never a row of cones. */
  group.add(instanced(new THREE.IcosahedronGeometry(1, 1), rock(colors.boulder), W.boulders,
    (b, i) => ({
      x: b.x, y: ground(b.x, b.z) + b.r * 0.22, z: b.z,
      rot: hash(i, 1) * Math.PI, rotX: (hash(i, 2) - 0.5) * 0.5,
      scale: [
        b.r * (0.85 + hash(i, 3) * 0.4),
        b.r * (0.45 + hash(i, 4) * 0.2),
        b.r * (0.75 + hash(i, 5) * 0.35),
      ],
    })));

  /* Bunch grass as soft rounded hummocks in varied sizes, not a comb of
     identical pointed cones — the audit read the old cones as fake rockery. */
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
  const tuftShape = (t, dx, dz, mul) => {
    const s = (0.65 + hash(t.k, 6) * 0.7) * mul;
    const h = W.grasses.height * (0.55 + hash(t.k, 7) * 0.35) * mul;
    return {
      x: t.x + dx, y: ground(t.x + dx, t.z + dz) + h * 0.32, z: t.z + dz,
      rot: hash(t.k, 3) * Math.PI,
      scale: [W.grasses.radius * 2 * s, h, W.grasses.radius * 2 * s * (0.8 + hash(t.k, 8) * 0.4)],
    };
  };
  group.add(instanced(new THREE.SphereGeometry(0.5, 7, 5),
    foliage(colors.bunchGrass), tufts, (t) => tuftShape(t, 0, 0, 1)));
  group.add(instanced(new THREE.SphereGeometry(0.5, 7, 5),
    foliage(colors.fescueBlue), tufts.filter((t) => hash(t.k, 4) < 0.4),
    (t) => tuftShape(t, 0.5, 0.4, 0.75)));

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
  group.add(instanced(box, boardformed(colors.wallCoping), piers, (it) => it));
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

  /* Match campus-massing.js roofElevation EXACTLY — rim-median ground under
     the MEASURED ring plus the reconciled height it draws, lifted if that
     would bury a high corner. `roofY` is therefore the DRAWN LID of each
     mass, and it is the one datum everything on a roof seats on. The
     section's photogrammetric `height` (campus-3d's OSM-side 37.2/30.0/22.8)
     runs taller than the drawn box (34.2/27/18.3): anchoring the skin to it
     hung the parapet, the PV racks and the whole green roof in the air above
     the real lid, and opened a phantom top storey the audit could see
     straight through. `measured.drawnHeight` is the EXACT height
     assembleMasses extrudes (LiDAR-reconciled — the raw campus-lidar lookup
     ran 2.2 m over the South Tower's drawn box), pinned by test against a
     recompute. The drawn storey height is drawnHeight / storeys, so the
     photographed plate COUNT fills the drawn box with zero residual. */
  const baseY = {};
  const roofY = {};
  const storeyH = {};
  for (const [key, b] of Object.entries(section.buildings)) {
    const ring = ringOf(section, key);
    const h = b.measured?.drawnHeight ?? b.height;
    const gs = ring.map(([x, z]) => base(x, z)).filter((v) => Number.isFinite(v)).sort((p, q) => p - q);
    const median = gs.length ? gs[Math.floor(gs.length / 2)] : 0;
    const highest = gs.length ? gs[gs.length - 1] : 0;
    roofY[key] = Math.max(median + h, highest);
    baseY[key] = roofY[key] - h;
    storeyH[key] = h / b.storeys;
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
    const key = keyOf(f.id);
    const b = baseY[key];
    const F = storeyH[key];
    if (f.system === "A") collectSystemA(section, f, frame, b, bins, F);
    else if (f.system === "B") collectSystemB(section, f, frame, b, bins, F);
    else collectEnd(section, f, frame, b, bins, F);
  }

  /* Skin every measured ring segment no facade covers — the notch steps at
     each tower's east end and the bar's ends and kink. Left bare, the parapet
     band bridged the notch over open air with the rack grid visible floating
     in the void behind it. Blank pale precast (c6_towerB's end-wall read),
     no windows: these faces are unphotographed and a wall claims least. */
  let notchFaces = 0;
  for (const key of Object.keys(section.buildings)) {
    /* Only a verbatim measured ring names real wall segments — the facade
       fallback ring is a hull whose chamfer has no massing under it. */
    if (!section.buildings[key].measured?.ring) continue;
    const ring = ringOf(section, key);
    /* A ring segment is covered when BOTH its endpoints lie on a declared
       facade's chord (within 0.25 m — the survey ring wobbles up to ~0.1 m
       about the straight elevations the facades span). Exact endpoint
       matching was not enough: the exact massing rings break each straight
       elevation into several near-collinear survey segments, and every one
       of them belongs to the facade that spans the whole wall. */
    const facades = section.facades.filter((f) => keyOf(f.id) === key);
    const onChord = (q, f) => {
      const dx = f.b[0] - f.a[0];
      const dz = f.b[1] - f.a[1];
      const len2 = dx * dx + dz * dz;
      let t = len2 ? ((q[0] - f.a[0]) * dx + (q[1] - f.a[1]) * dz) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      return Math.hypot(q[0] - (f.a[0] + dx * t), q[1] - (f.a[1] + dz * t)) < 0.25;
    };
    const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
    const cz = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const p = ring[(i + 1) % ring.length];
      if (facades.some((f) => onChord(a, f) && onChord(p, f))) continue;
      const len = Math.hypot(p[0] - a[0], p[1] - a[1]);
      /* Below 0.25 m is a survey-rounding sliver a neighbouring skin already
         hides; everything else gets a wall — NO segment may show raw massing. */
      if (len < 0.25) continue;
      const mx = (a[0] + p[0]) / 2 - cx;
      const mz = (a[1] + p[1]) / 2 - cz;
      const ux = (p[0] - a[0]) / len;
      const uz = (p[1] - a[1]) / len;
      let nx = uz;
      let nz = -ux;
      if (nx * mx + nz * mz < 0) { nx = -nx; nz = -nz; }
      const f = {
        id: `${key}-notch-${i}`,
        ring: section.buildings[key].ring,
        system: "End",
        storeys: section.buildings[key].storeys,
        a, b: p, out: [nx, nz],
      };
      collectEnd(section, f, frameOf(f), baseY[key], bins, storeyH[key], true);
      notchFaces++;
    }
  }
  bins.counts.notchFaces = notchFaces;

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
      parapetRail: bins.counts.parapetRail || 0,
      pergolas: bins.counts.pergolas || 0,
      notchFaces: bins.counts.notchFaces || 0,
      courts: section.southSide.courts?.length || 0,
      lamps: section.courtyard.lamps.length,
      boulders: section.west.boulders.length,
      draws: group.children.length,
    },
  };
}
