// York Hall, from photographs and drawings — the INVENTED class.
//
// Neptune & Thomas Associates, 1966; seismically rehabilitated 2021-24 by LPA.
// Four seismically separate structures on one comb footprint: the two-storey
// West bar fronting Revelle Plaza, the four-storey North and South wings
// projecting east, and the one-storey Lecture Hall between them. The ground
// storey is below grade and the courtyards sit on its roof — a podium the
// flat-slab massing cannot carve, so the deck reads as grade here.
//
// Everything hangs off the DRAWN York mass: the facilities (arcgis) ring
// campus-massing.js actually extrudes, carried verbatim in
// `measured.mass.ring`, with its LiDAR massHeights read as `measured.mass.h`.
// Every dressed datum solves on the SAME rule campus-massing.js uses
// (rim-median ground + h, lifted past a high corner), so the membrane sits on
// the visible wall and the coping sits on the visible parapet. The 2026-08-17
// audit is why: solved on campus-3d's h=20 over the survey ring, the whole
// membrane floated 6 m over the drawn parapet, the west dressing stood a
// metre INSIDE the drawn wall (the plaza frontage showed the massing's
// generic stripe tile — no tan CMU at all), and the fan-capital arcade was
// buried below plaza grade. The blank service tower alone keeps the survey
// ring: the facilities inventory does not trace it.
//
// The storey grid is the drawn prism read back: massHeights 15.1 m over the
// arcgis 4 levels gives 3.775 m per storey (the inventory's 5.0 estimate is a
// declared SOURCE CONFLICT — it cannot fit the drawn prism). Storey lines
// count DOWN from the drawn parapet; the bottom storey is the podium storey,
// buried under the plaza and the courtyard decks, emerging at the ravine.
// The arcade colonnade rises from the DRAWN plaza surface (surfaceAt at each
// column foot) to the fascia, and every face carries a CMU skirt down to the
// drawn terrain so no ground ever passes under the building.
//
// Three findings from the zone-1 inventory decide the membrane itself:
//
//   1. TWO fin storeys on the west over the arcade, not three — STRUCTURE
//      calls York West a "two-story concrete lift slab and CMU shear wall
//      structure", and both the 2019 and 2024 photography count two. From
//      the plaza, arcade + 2 storeys reach exactly the drawn parapet.
//   2. The field behind the fins is textured CMU, NOT glass. Per 6 ft bay:
//      one fin, one narrow flush metal window slot beside it, one wide panel
//      of split-face block. The CMU rides the library's `brick` class with
//      the repeat tuned to the real 8 in / 16 in block coursing.
//   3. The fins are spindle-shaped with trapezoidal haunches, ~0.17 m wide
//      and ~0.12 m average projection — the 500 lb mass figure forbids a
//      deep blade. One extruded profile, instanced ~500 times.
//
// Colours are DATA — every hex comes from the `colors` block of the photo
// document's `york` section, measured off the 2024 post-retrofit photography
// (the retrofit repainted the fins crisp white; pre-2021 greys are a dead
// epoch). What is deliberately NOT here is the section's `absent` list.
//
// Surfaces come from the procedural material library (campus-materials.js);
// deterministic throughout — the only irregularity source is `hash`.
import * as THREE from "../vendor/three/three.module.min.js";
import { applyOverlayDepth, OVERLAY, overlayLift } from "./campus-overlay.js";
import { createMaterialLibrary } from "./campus-materials.js";

const PAD = "pad";
const CARPET = "carpet";

/* The brick class tiles 8 courses x 4 units; at the sourced 8 in / 16 in
   block that is one 1.624 m square of real wall per repeat. */
const CMU_TILE = 8 * 0.203;

let LIB = null;
const lib = () => (LIB ??= createMaterialLibrary(THREE));

const concrete = (color) => lib().get("smoothConcrete", { color });
const boardformed = (color) =>
  lib().get("boardFormedConcrete", { color, normalScale: 0.6 });
const painted = (color) =>
  lib().get("metalPanel", { color, metalness: 0.35, roughness: 0.55 });
const metalSeam = (color) =>
  lib().get("metalPanel", { color, standingSeam: true, metalness: 0.4, roughness: 0.5 });
const glassMat = (color) => lib().get("glass", { color });
/* Split-face CMU: running bond at true block scale, per-surface repeat. */
const cmu = (color, w, h) =>
  lib().get("brick", { color, normalScale: 0.7, repeat: [w / CMU_TILE, h / CMU_TILE] });
/* Agave clumps stay a plain standard material, same reasoning as Keeling's. */
const foliage = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0.0 });

function decal(color, rung, cls = "smoothConcrete", repeat) {
  return applyOverlayDepth(lib().get(cls, { color, repeat }), rung);
}

/** Deterministic 0..1 — a reload rebuilds the same courtyard. */
function hash(...ns) {
  let s = 0;
  for (let i = 0; i < ns.length; i++) s = s * 131.71 + ns[i] * 57.13 + 7.9;
  const v = Math.sin(s) * 43758.5453;
  return v - Math.floor(v);
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

/* One drape vertex every 2 m: ground decals follow the drawn terrain instead
   of seating flat at their rect centre (the galbraith lesson). */
const DRAPE_SEG = 2;
function drapedQuad(r, ground, lift) {
  const w = r.x1 - r.x0;
  const d = r.z1 - r.z0;
  const cx = (r.x0 + r.x1) / 2;
  const cz = (r.z0 + r.z1) / 2;
  const geo = new THREE.PlaneGeometry(w, d,
    Math.max(1, Math.ceil(w / DRAPE_SEG)), Math.max(1, Math.ceil(d / DRAPE_SEG)));
  geo.rotateX(-Math.PI / 2);
  const base = ground(cx, cz);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, ground(cx + pos.getX(i), cz + pos.getZ(i)) - base);
  }
  geo.computeVertexNormals();
  const place = (mesh) => {
    mesh.position.set(cx, base + lift, cz);
    mesh.name = "ground-decal";
  };
  return { geo, place };
}

/**
 * A facade's own frame. The tangent is the DRAWN edge itself (galbraith
 * lesson: a frame built on the cardinal walks off a not-quite-square wall);
 * `out` only decides which perpendicular is outward. `at(u, w, y)`: u metres
 * along the face, w metres proud, y world height. A box rotated by `rot` has
 * its local +Z pointing out of the face and +X running along it.
 */
function frameOf(f) {
  const [sx, sz] = f.a;
  const [ex, ez] = f.b;
  const length = Math.hypot(ex - sx, ez - sz);
  const tx = (ex - sx) / length;
  const tz = (ez - sz) / length;
  let nx = tz;
  let nz = -tx;
  if (nx * f.out[0] + nz * f.out[1] < 0) { nx = -nx; nz = -nz; }
  return {
    id: f.id,
    length,
    rot: Math.atan2(nx, nz),
    at: (u, w, y) => ({ x: sx + tx * u + nx * w, y, z: sz + tz * u + nz * w }),
  };
}

/** Bay centres along a face, leftover split evenly at both ends. */
function bayCentres(length, module) {
  const n = Math.max(1, Math.floor(length / module));
  const pad = (length - n * module) / 2;
  const out = [];
  for (let i = 0; i < n; i++) out.push({ i, u: pad + (i + 0.5) * module });
  return out;
}

/** Lowest drawn-terrain height along a face, sampled every 2 m at the wall.
    Skirts and colonnades extend DOWN to this so nothing hangs over the
    ravine — the exact failure the 2026-08-17 audit photographed. */
function groundMinAlong(frame, ground) {
  let gmin = Infinity;
  const n = Math.max(2, Math.ceil(frame.length / 2));
  for (let i = 0; i <= n; i++) {
    const p = frame.at((i * frame.length) / n, 0.1, 0);
    const g = ground(p.x, p.z);
    if (Number.isFinite(g) && g < gmin) gmin = g;
  }
  return Number.isFinite(gmin) ? gmin : 0;
}

/**
 * The fin: ONE extruded elevation profile, instanced everywhere. Spindle in
 * elevation — fuller at mid-storey — flaring into a trapezoidal haunch where
 * it lands on the band at top and bottom (lpa-york-1, lpa-catalyst sidebar).
 * Local +Z is outward, +X along the face, y runs 0..finHeight.
 */
function finGeometry(F, storeyHeight) {
  const H = storeyHeight - F.band.height;
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(F.proudHaunch, 0);
  s.lineTo(F.proudMin, F.haunchHeight);
  s.lineTo(F.proudMid, H / 2);
  s.lineTo(F.proudMin, H - F.haunchHeight);
  s.lineTo(F.proudHaunch, H);
  s.lineTo(0, H);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: F.width, bevelEnabled: false });
  geo.rotateY(-Math.PI / 2);
  geo.translate(F.width / 2, 0, 0);
  return geo;
}

/**
 * The fluted arcade column, UNIT height: slender shaft narrowing to a waist
 * then flaring into the fan capital whose neighbours nearly meet — the
 * pointed arch is the void between two capitals. Six lathe segments keep the
 * fluted read. Built at height 1 and scaled per instance, because every
 * column runs from ITS OWN drawn-surface foot up to the shared fascia.
 */
function flareColumn(baseR, waistR, capR) {
  const pts = [];
  const segments = 10;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const r = t < 0.55
      ? baseR + (waistR - baseR) * (t / 0.55)
      : waistR + (capR - waistR) * Math.pow((t - 0.55) / 0.45, 2.2);
    pts.push(new THREE.Vector2(r, t));
  }
  return new THREE.LatheGeometry(pts, 6);
}

/* -------------------------------------------------------- facade systems */

/**
 * The shared fin membrane on a face. Storey lines count DOWN from the drawn
 * parapet: `finStoreys` fin storeys hang from the top, each a split-face CMU
 * field with a white precast band at its head (the topmost band sits flush
 * under the coping), one fin and one narrow window slot per 6 ft bay. Below
 * the fin zone the field is plain CMU carried down PAST the drawn terrain —
 * the podium storey on the court sides, the meeting-grade skirt on the
 * ravine sides. Faces with an arcade leave the zone under the fins to the
 * arcade's own back wall.
 */
function collectFinFace(section, f, frame, ctx, bins) {
  const F = section.finSystem;
  const G = section.grid;
  const { roofY, storeyH, ground } = ctx;
  const { rot, length } = frame;
  const storeys = f.finStoreys;
  const bays = bayCentres(length, G.finModule);
  const fieldH = storeyH - F.band.height;
  const finBottom = roofY - storeys * storeyH;
  const hasArcade = f.system === "westFace" || f.system === "courtFace";

  /* CMU field + band per fin storey, counted from the bottom of the zone. */
  for (let lv = 0; lv < storeys; lv++) {
    const B = finBottom + lv * storeyH;
    bins.cmuPanels.push({
      tone: f.cmuTone || "cmuSunlit",
      w: length, h: fieldH,
      ...frame.at(length / 2, F.standoff, B + fieldH / 2),
      rot,
    });
    bins.bands.push({
      ...frame.at(length / 2, F.band.proud / 2, B + fieldH + F.band.height / 2),
      rot,
      scale: [length, F.band.height, F.band.proud + F.standoff],
    });
  }

  /* Below the fin zone: plain CMU down past the drawn terrain (skirt), on
     every face the arcade does not own. */
  if (!hasArcade) {
    const bottom = groundMinAlong(frame, ground) - 0.5;
    if (finBottom - bottom > 0.25) {
      bins.cmuPanels.push({
        tone: f.cmuTone || "cmuSunlit",
        w: length, h: finBottom - bottom,
        ...frame.at(length / 2, F.standoff, (finBottom + bottom) / 2),
        rot,
      });
    }
  }

  /* Fins and their window slots, per 6 ft module, on the fin storeys only. */
  for (let lv = 0; lv < storeys; lv++) {
    const y0 = finBottom + lv * storeyH;
    for (const bay of bays) {
      bins.fins.push({ ...frame.at(bay.u, F.standoff, y0), rot });
      const winH = fieldH - F.windowSill - 0.35;
      bins.windows.push({
        ...frame.at(
          bay.u + F.width / 2 + F.windowWidth / 2 + 0.05,
          F.windowStandoff,
          y0 + F.windowSill + winH / 2
        ),
        rot,
        scale: [F.windowWidth, winH, 1],
      });
    }
  }

  /* Corridor doors AT GRADE on the east faces (DPR: a run of single metal
     doors, not windows) — each leaf stands on the drawn surface under it. */
  if (f.doors) {
    const D = section.eastSide.doors;
    for (const bay of bays) {
      if (bay.i % D.everyBays !== 0) continue;
      const foot = frame.at(bay.u, D.standoff, 0);
      const g = ground(foot.x, foot.z);
      if (!Number.isFinite(g)) continue;
      bins.doors.push({
        x: foot.x, y: g + D.height / 2, z: foot.z,
        rot,
        scale: [D.width, D.height, 0.08],
      });
    }
  }

  collectCoping(section, frame, roofY, bins);
}

/* The white coping SEATS on the drawn parapet: it overlaps the lip (0.15 m
   down) and rises only its own height above, trimmed to the exact face
   length so segments mitre at the ring corners instead of overshooting. */
function collectCoping(section, frame, roofY, bins) {
  const C = section.finSystem.coping;
  bins.copings.push({
    ...frame.at(frame.length / 2, 0, roofY + C.height / 2 - 0.15),
    rot: frame.rot,
    scale: [frame.length, C.height, C.overhang * 2 + 0.3],
  });
}

/** The flared-column arcade row: every column rises from the DRAWN surface
    at its own foot to the fascia; the deep white fascia hangs at the top of
    the arcade zone (directly under the fin storeys), and the dark recessed
    CMU back plane stands in for the arcade's depth, carried down past the
    terrain. */
function collectArcade(section, f, frame, ctx, bins) {
  const A = section.arcade;
  const { roofY, storeyH, ground } = ctx;
  const { rot, length } = frame;
  const zoneTop = roofY - f.finStoreys * storeyH;
  const capTop = zoneTop - A.fascia.height;
  const n = Math.floor(length / A.bay);
  const pad = (length - n * A.bay) / 2;
  let built = 0;
  for (let i = 0; i <= n; i++) {
    const p = frame.at(pad + i * A.bay, A.columnStandoff, 0);
    const g = ground(p.x, p.z);
    if (!Number.isFinite(g) || capTop - g < 1) continue;
    bins.columns.push({ x: p.x, y: g, z: p.z, rot, scale: [1, capTop - g, 1] });
    built++;
  }
  bins.fascia.push({
    ...frame.at(length / 2, A.fascia.proud / 2, zoneTop - A.fascia.height / 2),
    rot,
    scale: [length, A.fascia.height, A.fascia.proud + 0.05],
  });
  const backBottom = groundMinAlong(frame, ground) - 0.5;
  bins.backWalls.push({
    w: length, h: zoneTop - backBottom,
    ...frame.at(length / 2, A.backStandoff, (zoneTop + backBottom) / 2),
    rot,
  });
  return built;
}

/* ------------------------------------------------------------- the build */

function buildFacades(section, group, ctx, bins) {
  const { roofY, ground } = ctx;
  for (const f of section.facades) {
    const frame = frameOf(f);
    const gmin = () => groundMinAlong(frame, ground) - 0.5;
    if (f.system === "westFace") {
      bins.counts.arcadeColumns = collectArcade(section, f, frame, ctx, bins);
      collectFinFace(section, f, frame, ctx, bins);
    } else if (f.system === "courtFace") {
      bins.counts.courtColumns += collectArcade(section, f, frame, ctx, bins);
      collectFinFace(section, f, frame, ctx, bins);
    } else if (f.system === "finFace") {
      collectFinFace(section, f, frame, ctx, bins);
    } else if (f.system === "endWall") {
      /* The tall blank white end wall closing each courtyard (DPR Image 9),
         from past the court deck up to the drawn parapet. */
      const b = gmin();
      bins.endWalls.push({
        w: frame.length, h: roofY - b,
        ...frame.at(frame.length / 2, 0.1, (roofY + b) / 2),
        rot: frame.rot,
      });
      collectCoping(section, frame, roofY, bins);
    } else if (f.system === "towerBlank") {
      /* The blank service tower's walls stop at the parapet; its cap box
         (buildRoof) is the 'slightly above' rise. */
      const b = gmin();
      bins.towerWalls.push({
        w: frame.length, h: roofY - b,
        ...frame.at(frame.length / 2, 0.04, (roofY + b) / 2),
        rot: frame.rot,
      });
    } else if (f.system === "plain") {
      /* The Lecture Hall: a plain white box, no fins, meeting the ground. */
      const b = gmin();
      bins.plainWalls.push({
        w: frame.length, h: roofY - b,
        ...frame.at(frame.length / 2, 0.1, (roofY + b) / 2),
        rot: frame.rot,
      });
      collectCoping(section, frame, roofY, bins);
      if (f.vents) {
        const L = section.courtyards.lecture;
        const sz = f.a[1];
        for (const v of L.vents) {
          const p = frame.at(Math.abs(v.z - sz), 0.12, 0);
          const g = ground(p.x, p.z);
          bins.vents.push({
            x: p.x, y: (Number.isFinite(g) ? g : b + 0.5) + 2.4, z: p.z,
            rot: frame.rot,
            scale: L.ventSize,
          });
        }
      }
      if (f.lectureDoors) {
        const L = section.courtyards.lecture;
        const sz = f.a[1];
        for (const off of [-0.55, 0.55]) {
          const p = frame.at(Math.abs(L.doorsAt - sz) + off, 0.12, 0);
          const g = ground(p.x, p.z);
          bins.lectureGlass.push({
            x: p.x,
            y: (Number.isFinite(g) ? g : b + 0.5) + L.doorSize[1] / 2,
            z: p.z,
            rot: frame.rot,
            scale: [L.doorSize[0], L.doorSize[1], 1],
          });
        }
      }
    }
  }
}

/* Courtyard podium furniture: hexagonal white planters with agave, ringed by
   built-in wood benches — the campus-wide Revelle hexagon motif. */
function buildCourtyards(section, gr, ground) {
  const C = section.courtyards;
  const { colors } = section;
  const on = (x, z) => ground(x, z);

  gr.add(instanced(
    new THREE.CylinderGeometry(1, 1, 1, 6), concrete(colors.planterWhite), C.items,
    (p) => ({
      x: p.x, y: on(p.x, p.z) + C.planterHeight / 2, z: p.z,
      scale: [C.planterRadius, C.planterHeight, C.planterRadius],
    })
  ));
  /* Six bench segments per planter, following the hexagon. */
  const segs = [];
  C.items.forEach((p, pi) => {
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
      segs.push({
        x: p.x + Math.cos(a) * C.benchRadius,
        z: p.z + Math.sin(a) * C.benchRadius,
        rot: -a + Math.PI / 2,
        pi,
      });
    }
  });
  const side = 2 * C.benchRadius * Math.tan(Math.PI / 6) - 0.08;
  gr.add(instanced(
    new THREE.BoxGeometry(side, 0.07, C.benchWidth), lib().get("woodSlat", { color: colors.benchWood }),
    segs, (s) => ({ x: s.x, y: on(s.x, s.z) + C.benchSeat, z: s.z, rot: s.rot })
  ));
  gr.add(instanced(
    new THREE.BoxGeometry(0.12, C.benchSeat - 0.07, C.benchWidth * 0.8),
    concrete(colors.planterWhite), segs,
    (s) => ({ x: s.x, y: on(s.x, s.z) + (C.benchSeat - 0.07) / 2, z: s.z, rot: s.rot })
  ));
  /* Agave: a few cones per planter, jittered deterministically. */
  const agaves = [];
  C.items.forEach((p, pi) => {
    for (let k = 0; k < 3; k++) {
      agaves.push({
        x: p.x + (hash(pi, k, 1) - 0.5) * C.planterRadius,
        z: p.z + (hash(pi, k, 2) - 0.5) * C.planterRadius,
        rot: hash(pi, k, 3) * Math.PI,
        base: p,
      });
    }
  });
  gr.add(instanced(
    new THREE.ConeGeometry(0.5, 0.8, 6), foliage(colors.agaveGreen), agaves,
    (a) => ({
      x: a.x, y: on(a.base.x, a.base.z) + C.planterHeight + 0.4, z: a.z, rot: a.rot,
    })
  ));
}

/* The west base: loop bike racks against the CMU back wall, bark-mulch beds.
   Trees and the DG belt west of here belong to the plaza landscape module. */
function buildWestGround(section, gr, ground) {
  const W = section.westGround;
  const { colors } = section;
  const hoops = [];
  for (const r of W.racks) {
    for (let h = 0; h < r.hoops; h++) {
      const at = (h - (r.hoops - 1) / 2) * W.rack.spacing;
      hoops.push({ x: r.x + Math.sin(r.rot) * at, z: r.z + Math.cos(r.rot) * at, rot: r.rot });
    }
  }
  gr.add(instanced(
    new THREE.TorusGeometry(W.rack.hoopWidth / 2, 0.035, 5, 10, Math.PI),
    painted(colors.rackBlack), hoops,
    (it) => ({ x: it.x, y: ground(it.x, it.z), z: it.z, rot: it.rot })
  ));
  for (const bed of W.mulch) {
    const { geo, place } = drapedQuad(bed, ground, overlayLift(CARPET));
    const mesh = new THREE.Mesh(geo,
      decal(colors.mulch, CARPET, "decomposedGranite", [(bed.x1 - bed.x0) / 1.6, (bed.z1 - bed.z0) / 1.6]));
    place(mesh);
    mesh.renderOrder = OVERLAY[CARPET].renderOrder;
    gr.add(mesh);
  }
}

/* The east/ravine service side: board-formed retaining wall, the parking
   apron, the ramp with its solid parapet. Dock/trash/yard have no source and
   stay unbuilt (absent[]). Every solid seats segment by segment on the drawn
   terrain — the ravine is exactly where a flat seat would float. */
function buildEastSide(section, gr, ground) {
  const E = section.eastSide;
  const { colors } = section;

  const wallSegs = (a, b, seg) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(len / seg));
    const out = [];
    for (let i = 0; i < n; i++) {
      const t0 = i / n;
      const t1 = (i + 1) / n;
      const x = a[0] + (b[0] - a[0]) * (t0 + t1) / 2;
      const z = a[1] + (b[1] - a[1]) * (t0 + t1) / 2;
      out.push({ x, z, len: len / n, rot: Math.atan2(-(b[1] - a[1]), b[0] - a[0]) });
    }
    return out;
  };

  const R = E.retainingWall;
  gr.add(instanced(
    new THREE.BoxGeometry(1, 1, 1), boardformed(colors.retainingBoard),
    wallSegs(R.a, R.b, R.segment),
    (s) => ({
      x: s.x, y: ground(s.x, s.z) + R.height / 2, z: s.z, rot: s.rot,
      scale: [s.len + 0.05, R.height, R.thickness],
    })
  ));

  const P = E.parking;
  const { geo, place } = drapedQuad(P, ground, overlayLift(PAD));
  const park = new THREE.Mesh(geo,
    decal(colors.asphaltPark, PAD, "asphalt", [(P.x1 - P.x0) / 3, (P.z1 - P.z0) / 3]));
  place(park);
  park.renderOrder = OVERLAY[PAD].renderOrder;
  gr.add(park);

  const M = E.ramp;
  const deck = drapedQuad(
    { x0: M.a[0] - M.width / 2, x1: M.a[0] + M.width / 2, z0: M.a[1], z1: M.b[1] },
    ground, overlayLift(CARPET));
  const deckMesh = new THREE.Mesh(deck.geo, decal(colors.rampConcrete, CARPET));
  deck.place(deckMesh);
  deckMesh.renderOrder = OVERLAY[CARPET].renderOrder;
  gr.add(deckMesh);
  for (const side of [-1, 1]) {
    const off = side * (M.width / 2 + M.parapetThickness / 2);
    gr.add(instanced(
      new THREE.BoxGeometry(1, 1, 1), concrete(colors.rampConcrete),
      wallSegs([M.a[0] + off, M.a[1]], [M.b[0] + off, M.b[1]], M.segment),
      (s) => ({
        x: s.x, y: ground(s.x, s.z) + M.parapet / 2, z: s.z, rot: s.rot,
        scale: [s.len + 0.05, M.parapet, M.parapetThickness],
      })
    ));
  }
}

/* The roofscape, per the BIM figures, all seated on the DRAWN parapet: the
   north wing's twin louvre rows in a recessed well, the south wing's
   mechanical penthouse, the tower cap. York West's roof is clean and flat
   [sourced] — coping only. */
function buildRoof(section, group, roofY, bins) {
  const { colors, roof } = section;
  const gr = new THREE.Group();
  gr.name = "york-roof";

  const L = roof.louvreWell;
  const well = new THREE.Mesh(
    new THREE.PlaneGeometry(L.x1 - L.x0, L.z1 - L.z0).rotateX(-Math.PI / 2),
    decal(colors.wellDark, PAD)
  );
  well.position.set((L.x0 + L.x1) / 2, roofY + 0.04, (L.z0 + L.z1) / 2);
  well.renderOrder = OVERLAY[PAD].renderOrder;
  gr.add(well);
  const blades = [];
  for (const z of L.rows) {
    for (let x = L.x0 + 1 + L.bladeLength / 2; x <= L.x1 - 1; x += L.bladePitch) {
      blades.push({ x, z });
    }
  }
  gr.add(instanced(
    new THREE.BoxGeometry(L.bladeThickness, L.bladeHeight, L.bladeLength),
    painted(colors.louvreBlade), blades,
    (b) => ({ x: b.x, y: roofY + L.bladeHeight / 2 + 0.05, z: b.z })
  ));
  bins.counts.roofBlades = blades.length;

  const P = roof.penthouse;
  const pent = new THREE.Mesh(
    new THREE.BoxGeometry(P.size[0], P.size[1], P.size[2]),
    metalSeam(colors.penthouseGrey)
  );
  pent.position.set(P.x, roofY + P.size[1] / 2, P.z);
  pent.castShadow = pent.receiveShadow = true;
  gr.add(pent);

  /* The blank service/stair tower's cap, rising slightly above the drawn
     parapet on its own measured footprint. */
  const T = section.structures.tower;
  const tf = section.facades.filter((f) => f.structure === "tower");
  const xs = tf.flatMap((f) => [f.a[0], f.b[0]]);
  const zs = tf.flatMap((f) => [f.a[1], f.b[1]]);
  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(Math.max(...xs) - Math.min(...xs) - 0.1, T.cap, Math.max(...zs) - Math.min(...zs) - 0.1),
    concrete(section.colors.towerGrey)
  );
  cap.position.set(
    (Math.min(...xs) + Math.max(...xs)) / 2,
    roofY + T.cap / 2,
    (Math.min(...zs) + Math.max(...zs)) / 2
  );
  cap.castShadow = cap.receiveShadow = true;
  gr.add(cap);

  group.add(gr);
}

/* ------------------------------------------------------------------- api */

/**
 * Build York Hall's photo-sourced detail.
 *
 * `photo` is the loaded photo-detail document; this reads only its `york`
 * section and returns `{ group, counts }` (empty and harmless if the section
 * is missing). `surfaceAt` — the drawn terrain triangle — seats everything on
 * the ground; `heightAt` solves the drawn parapet exactly as
 * campus-massing.js roofElevation does — rim-median ground under
 * `measured.mass.ring` (the arcgis part campus-massing extrudes, copied
 * verbatim) plus `measured.mass.h` (its LiDAR massHeights read), lifted past
 * a high corner. Pre-merge sections without the mass block fall back to the
 * facade endpoints + lidarHeight.
 */
export function createPhotoYork(scene, { photo, heightAt, surfaceAt } = {}) {
  const group = new THREE.Group();
  group.name = "photo-york";
  const section = photo?.york;
  if (!section) {
    scene?.add(group);
    return { group, counts: {} };
  }
  const ground = surfaceAt || heightAt;
  const baseFn = heightAt || surfaceAt;
  if (typeof ground !== "function" || typeof baseFn !== "function") {
    throw new Error("campus-photo-york: needs surfaceAt (or heightAt) to place on the ground");
  }

  /* The drawn parapet, by the massing's own rule over the DRAWN ring. */
  const mass = section.measured.mass;
  let verts = mass?.ring;
  if (!Array.isArray(verts) || !verts.length) {
    verts = [];
    const seen = new Set();
    for (const f of section.facades) {
      for (const p of [f.a, f.b]) {
        const k = `${p[0]},${p[1]}`;
        if (seen.has(k)) continue;
        seen.add(k);
        verts.push(p);
      }
    }
  }
  const lidarH = mass?.h ?? section.measured.lidarHeight;
  const gs = verts.map(([x, z]) => baseFn(x, z)).filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  const median = gs.length ? gs[Math.floor(gs.length / 2)] : 0;
  const highest = gs.length ? gs[gs.length - 1] : 0;
  const roofY = Math.max(median + lidarH, highest);
  const storeyH = lidarH / (section.grid.storeys ?? 4);
  const ctx = { roofY, storeyH, ground };

  const bins = {
    cmuPanels: [], bands: [], fins: [], windows: [], doors: [], copings: [],
    columns: [], fascia: [], backWalls: [], endWalls: [], towerWalls: [],
    plainWalls: [], vents: [], lectureGlass: [],
    counts: { arcadeColumns: 0, courtColumns: 0 },
  };
  buildFacades(section, group, ctx, bins);

  const { colors } = section;
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const plane = new THREE.PlaneGeometry(1, 1);
  const add = (geo, mat, items) => {
    if (!items.length) return;
    group.add(instanced(geo, mat, items, (it) => it));
  };

  /* CMU fields as individual meshes so each carries the block coursing at
     true 0.203 m scale — the per-surface repeat lever. */
  const wallMesh = (w, mat) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w.w, w.h), mat);
    mesh.position.set(w.x, w.y, w.z);
    mesh.rotation.y = w.rot;
    mesh.castShadow = mesh.receiveShadow = true;
    return mesh;
  };
  for (const p of bins.cmuPanels) group.add(wallMesh(p, cmu(colors[p.tone], p.w, p.h)));
  for (const w of bins.backWalls) group.add(wallMesh(w, cmu(colors.cmuArcadeBack, w.w, w.h)));
  for (const w of bins.endWalls) group.add(wallMesh(w, concrete(colors.precastAmbient)));
  for (const w of bins.towerWalls) group.add(wallMesh(w, concrete(colors.towerGrey)));
  for (const w of bins.plainWalls) group.add(wallMesh(w, concrete(colors.precastAmbient)));

  add(unit, concrete(colors.precastAmbient), bins.bands);
  add(unit, concrete(colors.precastBright), bins.copings);
  add(unit, concrete(colors.precastBright), bins.fascia);
  add(finGeometry(section.finSystem, storeyH),
    concrete(colors.precastAmbient), bins.fins);
  /* The slots are FLUSH METAL-FRAMED glazing [DPR] and must read as dark
     slots against the tan field — the library glass is transparent and
     vanished against the CMU behind it (2026-08-17 audit, minor finding). */
  add(plane, painted(colors.windowGlass), bins.windows);
  add(unit, painted(colors.doorMetal), bins.doors);
  add(unit, metalSeam(colors.louvreBlade), bins.vents);
  add(plane, glassMat(colors.lectureGlassDoor), bins.lectureGlass);
  const A = section.arcade;
  add(flareColumn(A.shaftBase, A.shaftWaist, A.capital),
    concrete(colors.precastBright), bins.columns);

  buildRoof(section, group, roofY, bins);

  /* Everything that stands on the drawn terrain lives in one named group so
     the seating gates can find it. */
  const gr = new THREE.Group();
  gr.name = "york-ground";
  buildCourtyards(section, gr, ground);
  buildWestGround(section, gr, ground);
  buildEastSide(section, gr, ground);
  group.add(gr);

  scene?.add(group);
  return {
    group,
    counts: {
      facades: section.facades.length,
      arcadeColumns: bins.counts.arcadeColumns,
      courtColumns: bins.counts.courtColumns,
      fins: bins.fins.length,
      cmuPanels: bins.cmuPanels.length,
      windows: bins.windows.length,
      doors: bins.doors.length,
      bands: bins.bands.length,
      planters: section.courtyards.items.length,
      roofBlades: bins.counts.roofBlades,
      draws: group.children.length,
    },
  };
}
