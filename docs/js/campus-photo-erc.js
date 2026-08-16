// Eleanor Roosevelt College, from photographs — the photo-sourced INVENTED
// class, the same one campus-photo-eighth.js and campus-photo-revelle.js
// belong to.
//
// Everything drawn here is modelled off dated photographs of ERC (Safdie
// Rabines' 2003 completion set, which is still the newest evidence for these
// exteriors, plus the college's own virtual tour). Photos decide WHAT EXISTS
// and HOW IT LOOKS; the measured world keeps deciding WHERE and HOW BIG. So
// nothing in this file is a free-standing position:
//
//   - every residence-hall pinstripe and apartment fin rides a real ring edge
//     from campus-3d.json, pushed a few centimetres outboard of the measured
//     wall. The massing underneath is never moved, replaced or recoloured;
//   - the Ventanas colonnade, glulam soffit, curtain wall and the curved
//     amphitheatre are all offsets of the MEASURED curved south face of Café
//     Ventanas, so the arc is the survey's arc and not a drawn one;
//   - the Great Hall arcade is an offset of its measured drum;
//   - the promenade furniture sits in the real voids between the I-House legs,
//     under bridges that are measured massing and are not touched here.
//
// Two AGENTS.md rules shape the file the way they shaped Revelle's:
//
//   1. The measured ground is never replaced. The ERC Green's crossing paths
//      are ALREADY in the surveyed arcgis ground layer, so this file draws no
//      path decal at all — only the promenade's scored joints and the mulch
//      beds, which are lifted decals on the overlay ladder over paving that
//      the survey already has.
//   2. `heightAt` is not the surface you can see. Everything PLACED sits on
//      `surfaceAt`; `heightAt` is only the fallback so an older call site
//      still works.
//
// Colours are DATA — every hex comes from the `colors` block of the photo
// document's `erc` section, and the two low-confidence families (the Ventanas
// glulam hue and the Great Hall's stucco/lavender bands) are flagged as such
// in the section's `confidence` block rather than quietly shipped as fact.
// Repeats are InstancedMesh: the facade bands alone are several hundred
// strips.
//
// What is deliberately NOT here is the section's `absent` array, and it is
// long: no ERC entry sign, no Max Hooper Schneider piece, no Green centre
// node, no Mesa Verde or Geneva facade detail, no admin or Pangea elevations,
// no UNDA (it stands on Rady's lawn and belongs to Rady's section), and no
// lettering anywhere, because there is no text mechanism and an invented
// wordmark is a second claim. Better absent than wrong.
import * as THREE from "../vendor/three/three.module.min.js";
import { applyOverlayDepth, OVERLAY, overlayLift } from "./campus-overlay.js";

/* The promenade decals ride two rungs so the mulch beds paint over the
   measured paving and the scored joints paint over the beds. */
const BED_RUNG = "carpet";
const SCORE_RUNG = "paint";

const stucco = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.0 });
const concrete = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0.0 });
const painted = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.4 });
const glass = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.16, metalness: 0.6 });
const timber = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.0 });
const lit = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.35, emissive: color, emissiveIntensity: 0.35 });

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

/** Adds an instanced run and stamps its render order if it is a decal. */
function add(group, mesh, rung) {
  if (rung) mesh.renderOrder = OVERLAY[rung].renderOrder;
  group.add(mesh);
  return mesh;
}

/* A 1 m unit box, stretched along X per instance. Every strip that follows a
   measured ring edge uses this, because the edge lengths all differ. */
const unitStrip = (h, d) => new THREE.BoxGeometry(1, h, d);

/* ------------------------------------------- residence halls, west of the Green */

function buildResidenceHalls(section, group, ground) {
  const { colors } = section;
  const r = section.residenceHalls;

  /* THE facade motif: two thin parallel pinstripes at every floor line,
     wrapping the whole block including the blank chamfered ends. Each strip
     is one instance stretched to its measured edge's length. */
  const strips = [];
  for (const e of r.bands) {
    for (const fl of r.floorLines) {
      for (const side of [-1, 1]) strips.push({ e, y: fl + (side * r.bandGap) / 2 });
    }
  }
  add(group, instanced(
    unitStrip(r.bandHeight, r.bandThickness), stucco(colors.bandGrey), strips,
    ({ e, y }) => ({ x: e.x, y: ground(e.x, e.z) + y, z: e.z, rot: e.rot, scale: [e.len, 1, 1] })
  ));

  /* The blank Green-facing end walls are blank except for one narrow slot
     window per floor, set high. */
  add(group, instanced(
    new THREE.BoxGeometry(r.slot.width, r.slot.height, r.slot.depth), glass(colors.slotGlass),
    r.slots, (s) => ({ x: s.x, y: ground(s.x, s.z) + s.y, z: s.z, rot: s.rot })
  ));

  /* Stacked recessed loggias on the long zig-zag elevations. Two thin pipe
     rails and nothing between them: the photographs show slender metal
     railings you can see through, and a solid infill plane standing off a
     cream wall would read as a dark band the building does not have. */
  add(group, instanced(
    unitStrip(0.05, 0.05), painted(colors.railDark), r.loggias,
    (l) => ({ x: l.x, y: ground(l.x, l.z) + l.y + r.loggiaRailHeight, z: l.z, rot: l.rot, scale: [l.len, 1, 1] })
  ));
  add(group, instanced(
    unitStrip(0.04, 0.04), painted(colors.loggiaRail), r.loggias,
    (l) => ({ x: l.x, y: ground(l.x, l.z) + l.y + r.loggiaRailHeight * 0.5, z: l.z, rot: l.rot, scale: [l.len, 1, 1] })
  ));
}

/* -------------------------------------------------- apartments, east of the Green */

function buildApartments(section, group, ground) {
  const { colors } = section;
  const a = section.apartments;

  /* The apartments wear the same grey line as one HEAVIER band that projects
     as a physical ledge — a fin, not paint. */
  const fins = [];
  for (const e of a.fins) for (const fl of a.floorLines) fins.push({ e, y: fl });
  add(group, instanced(
    unitStrip(a.finHeight, a.finDepth), stucco(colors.bandGreyDeep), fins,
    ({ e, y }) => ({ x: e.x, y: ground(e.x, e.z) + y, z: e.z, rot: e.rot, scale: [e.len, 1, 1] })
  ));

  add(group, instanced(
    new THREE.BoxGeometry(a.window.width, a.window.height, a.window.depth), stucco(colors.windowBox),
    a.windows, (w) => ({ x: w.x, y: ground(w.x, w.z) + w.y, z: w.z, rot: w.rot })
  ));

  add(group, instanced(
    new THREE.BoxGeometry(a.sconce.width, a.sconce.height, a.sconce.depth), lit(colors.sconce),
    a.sconces, (s) => ({ x: s.x, y: ground(s.x, s.z) + s.y, z: s.z, rot: s.rot })
  ));
}

/* ------------------------------------------------- Café Ventanas and its terrace */

function buildVentanas(section, group, ground) {
  const { colors } = section;
  const v = section.ventanas;

  /* Round white columns outboard of the glass, on the measured curve. */
  add(group, instanced(
    new THREE.CylinderGeometry(v.column.radius, v.column.radius, v.column.height, 12),
    concrete(colors.columnWhite), v.columns,
    (c) => ({ x: c.x, y: ground(c.x, c.z) + v.column.height / 2, z: c.z })
  ));

  /* The exposed glulam roof oversailing the measured mass: a deep honey
     soffit with a thin white fascia at its outer edge. The hue is a visual
     read off a dusk frame — see the section's `confidence.low`. */
  add(group, instanced(
    unitStrip(v.soffit.thickness, v.soffit.width), timber(colors.glulam), v.soffitRun,
    (p) => ({ x: p.x, y: ground(p.x, p.z) + v.soffit.y, z: p.z, rot: p.rot, scale: [p.step + 0.4, 1, 1] })
  ));
  add(group, instanced(
    unitStrip(v.soffit.fascia, 0.18), stucco(colors.fasciaWhite), v.soffitRun,
    /* The strip's local +Z points back at the building, because the run was
       offset along the face's OUTWARD normal — so the fascia, which is the
       roof's outer edge, subtracts. */
    (p) => ({
      x: p.x - Math.sin(p.rot) * (v.soffit.width / 2),
      y: ground(p.x, p.z) + v.soffit.y + v.soffit.thickness / 2,
      z: p.z - Math.cos(p.rot) * (v.soffit.width / 2),
      rot: p.rot,
      scale: [p.step + 0.4, 1, 1],
    })
  ));

  /* Full-height curtain wall, just off the measured face. */
  add(group, instanced(
    unitStrip(v.glass.top - v.glass.base, 0.12), glass(colors.curtainGlass), v.glassRun,
    (p) => ({
      x: p.x, y: ground(p.x, p.z) + (v.glass.base + v.glass.top) / 2, z: p.z,
      rot: p.rot, scale: [p.step + 0.2, 1, 1],
    })
  ));

  /* The curved amphitheatre down to the Green. Each riser is drawn as its own
     concentric nosing sitting ON the measured ground rather than as a stack
     off one datum — the terrace grade is LiDAR's to describe, and a stacked
     flight would float at one end of the arc and bury itself at the other. */
  const am = v.amphitheatre;
  const nosings = am.arcs.flatMap((arc) => arc.points);
  add(group, instanced(
    unitStrip(am.riserHeight, am.tread), concrete(colors.terraceConcrete), nosings,
    (p) => ({ x: p.x, y: ground(p.x, p.z) + am.riserHeight / 2, z: p.z, rot: p.rot, scale: [p.step + 0.3, 1, 1] })
  ));
  add(group, instanced(
    new THREE.CylinderGeometry(0.11, 0.11, 0.3, 8), lit(colors.stepLight), am.lights,
    (p) => ({ x: p.x, y: ground(p.x, p.z) + 0.15, z: p.z })
  ));

  /* A pipe handrail running down the steps: two posts and a top tube. */
  const posts = [];
  for (const r of am.rails) {
    for (const side of [-1, 1]) {
      posts.push({
        x: r.x + Math.cos(r.rot) * ((am.railLength / 2) * side),
        z: r.z - Math.sin(r.rot) * ((am.railLength / 2) * side),
      });
    }
  }
  add(group, instanced(
    new THREE.CylinderGeometry(0.03, 0.03, am.railHeight, 6), painted(colors.pipeRail), posts,
    (p) => ({ x: p.x, y: ground(p.x, p.z) + am.railHeight / 2, z: p.z })
  ));
  add(group, instanced(
    new THREE.BoxGeometry(am.railLength, 0.05, 0.05), painted(colors.pipeRail), am.rails,
    (r) => ({ x: r.x, y: ground(r.x, r.z) + am.railHeight, z: r.z, rot: r.rot })
  ));
}

/* ------------------------------------------------------------------ furniture */

function buildFurniture(section, group, ground) {
  const { colors } = section;
  const f = section.furniture;

  /* Mesh-top picnic tables with attached benches — the dominant repeated
     object on the Ventanas terrace, and one instanced asset. */
  const t = f.table;
  add(group, instanced(
    new THREE.BoxGeometry(t.size, 0.05, t.size), painted(colors.tableMetal), f.tables,
    (it) => ({ x: it.x, y: ground(it.x, it.z) + t.height, z: it.z, rot: it.rot })
  ));
  for (const side of [-1, 1]) {
    add(group, instanced(
      new THREE.BoxGeometry(t.size, 0.04, t.benchWidth), painted(colors.tableMetal), f.tables,
      (it) => ({
        x: it.x + Math.sin(it.rot) * (t.size / 2 + 0.2) * side,
        y: ground(it.x, it.z) + t.benchHeight,
        z: it.z + Math.cos(it.rot) * (t.size / 2 + 0.2) * side,
        rot: it.rot,
      })
    ));
  }
  add(group, instanced(
    new THREE.BoxGeometry(0.1, t.height, t.size * 0.8), painted(colors.tableMetal), f.tables,
    (it) => ({ x: it.x, y: ground(it.x, it.z) + t.height / 2, z: it.z, rot: it.rot })
  ));

  const u = f.umbrella;
  add(group, instanced(
    new THREE.CylinderGeometry(0.04, 0.04, u.poleHeight, 6), painted(colors.tableMetal), f.umbrellas,
    (it) => ({ x: it.x, y: ground(it.x, it.z) + u.poleHeight / 2, z: it.z })
  ));
  add(group, instanced(
    new THREE.ConeGeometry(u.radius, 0.45, 8), stucco(colors.umbrellaFabric), f.umbrellas,
    (it) => ({ x: it.x, y: ground(it.x, it.z) + u.canopyHeight + 0.22, z: it.z })
  ));

  /* Two lamp families, kept distinct because the photographs show two: the
     campus-standard square lantern along the Green, and a small cylindrical
     head in the I-House courtyards. */
  const sq = f.squareLamp;
  add(group, instanced(
    new THREE.BoxGeometry(sq.pole, sq.height, sq.pole), painted(colors.lampPole), f.squareLamps,
    (it) => ({ x: it.x, y: ground(it.x, it.z) + sq.height / 2, z: it.z })
  ));
  add(group, instanced(
    new THREE.BoxGeometry(sq.head[0], sq.head[1], sq.head[2]), lit(colors.lantern), f.squareLamps,
    (it) => ({ x: it.x, y: ground(it.x, it.z) + sq.height + sq.head[1] / 2, z: it.z })
  ));

  const gl = f.globeLamp;
  add(group, instanced(
    new THREE.CylinderGeometry(gl.pole / 2, gl.pole / 2, gl.height, 6), painted(colors.lampPole), f.globeLamps,
    (it) => ({ x: it.x, y: ground(it.x, it.z) + gl.height / 2, z: it.z })
  ));
  add(group, instanced(
    new THREE.CylinderGeometry(gl.radius, gl.radius, gl.radius * 2.2, 10), lit(colors.globeLamp), f.globeLamps,
    (it) => ({ x: it.x, y: ground(it.x, it.z) + gl.height + gl.radius, z: it.z })
  ));
}

/* ------------------------------------------------------- Middle Earth pavilion */

function buildMiddleEarth(section, group, ground) {
  const { colors } = section;
  const m = section.middleEarth;

  add(group, instanced(
    unitStrip(m.glass.top - m.glass.base, 0.1), glass(colors.pavilionGlass), m.faces,
    (e) => ({
      x: e.x, y: ground(e.x, e.z) + (m.glass.base + m.glass.top) / 2, z: e.z,
      rot: e.rot, scale: [e.len, 1, 1],
    })
  ));
  add(group, instanced(
    unitStrip(m.fascia.height, m.fascia.depth), stucco(colors.fasciaWhite), m.faces,
    (e) => ({ x: e.x, y: ground(e.x, e.z) + m.fascia.y, z: e.z, rot: e.rot, scale: [e.len, 1, 1] })
  ));
  add(group, instanced(
    new THREE.CylinderGeometry(m.column.radius, m.column.radius, m.column.height, 8),
    painted(colors.columnWhite), m.columns,
    (c) => ({ x: c.x, y: ground(c.x, c.z) + m.column.height / 2, z: c.z })
  ));
}

/* ----------------------------------------------------------------- Great Hall */

function buildGreatHall(section, group, ground) {
  const { colors } = section;
  const g = section.greatHall;

  add(group, instanced(
    new THREE.CylinderGeometry(g.column.radius, g.column.radius, g.column.height, 10),
    concrete(colors.columnWhite), g.columns,
    (c) => ({ x: c.x, y: ground(c.x, c.z) + g.column.height / 2, z: c.z })
  ));
  add(group, instanced(
    unitStrip(g.fascia.thickness, g.fascia.width), timber(colors.glulam), g.fasciaRun,
    (p) => ({ x: p.x, y: ground(p.x, p.z) + g.fascia.y, z: p.z, rot: p.rot, scale: [p.step + 0.4, 1, 1] })
  ));

  /* Two lavender-grey bands. Both hues are a LOW-confidence read off dusk
     photography — see `confidence.low` in the section. */
  const bands = [];
  for (const e of g.bands) for (const y of g.bandLines) bands.push({ e, y });
  add(group, instanced(
    unitStrip(g.bandHeight, 0.06), stucco(colors.greatHallBand), bands,
    ({ e, y }) => ({ x: e.x, y: ground(e.x, e.z) + y, z: e.z, rot: e.rot, scale: [e.len, 1, 1] })
  ));
}

/* ----------------------------------------------------------- I-House promenade */

function buildPromenade(section, group, ground) {
  const { colors } = section;
  const p = section.promenade;

  /* Mulch planting beds and scored paving joints — lifted decals over paving
     the survey already has, never a replacement for it. */
  add(group, instanced(
    quad(p.bed.length, p.bed.width), decal(colors.mulch, BED_RUNG), p.beds,
    (b) => ({ x: b.x, y: ground(b.x, b.z) + overlayLift(BED_RUNG), z: b.z, rot: b.rot })
  ), BED_RUNG);
  add(group, instanced(
    quad(1, p.scoreWidth), decal(colors.scoreLine, SCORE_RUNG), p.scoreLines,
    (s) => ({ x: s.x, y: ground(s.x, s.z) + overlayLift(SCORE_RUNG), z: s.z, rot: s.rot, scale: [s.len, 1, 1] })
  ), SCORE_RUNG);

  add(group, instanced(
    new THREE.BoxGeometry(p.seat.length, p.seat.height, p.seat.width), concrete(colors.seatConcrete),
    p.seats, (s) => ({ x: s.x, y: ground(s.x, s.z) + p.seat.height / 2, z: s.z, rot: s.rot })
  ));

  /* Galvanised loop bike racks, one hoop run per rack. The hoops are spaced
     ACROSS their own plane, not along it — a bike stands in the plane of its
     loop, so a row of loops is a row of parallel arches. */
  const hoops = [];
  for (const r of p.racks) {
    for (let h = 0; h < p.rack.hoops; h++) {
      const at = (h - (p.rack.hoops - 1) / 2) * p.rack.spacing;
      hoops.push({ x: r.x + Math.sin(r.rot) * at, z: r.z + Math.cos(r.rot) * at, rot: r.rot });
    }
  }
  add(group, instanced(
    new THREE.TorusGeometry(p.rack.width / 2, 0.025, 6, 10, Math.PI), painted(colors.rack), hoops,
    (h) => ({ x: h.x, y: ground(h.x, h.z) + p.rack.height - p.rack.width / 2, z: h.z, rot: h.rot })
  ));

  add(group, instanced(
    new THREE.BoxGeometry(p.sconce.width, p.sconce.height, p.sconce.depth), lit(colors.sconce),
    p.sconces, (s) => ({ x: s.x, y: ground(s.x, s.z) + s.y, z: s.z, rot: s.rot })
  ));
}

/* --------------------------------------------------------------- Ellie's Garden */

function buildEllies(section, group, ground) {
  const { colors } = section;
  const e = section.ellies;

  add(group, instanced(
    quad(e.bed.length, e.bed.width), decal(colors.mulch, BED_RUNG), [e.bed],
    (b) => ({ x: b.x, y: ground(b.x, b.z) + overlayLift(BED_RUNG), z: b.z })
  ), BED_RUNG);

  /* The hand-lettered sign, as a BLANK board: there is no text mechanism in
     this project and inventing the lettering would be a second claim. */
  const base = ground(e.sign.x, e.sign.z);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(e.sign.post, e.sign.bottom + e.sign.board[1], e.sign.post),
      timber(colors.signTimber)
    );
    post.position.set(
      e.sign.x + Math.cos(e.sign.rot) * (e.sign.board[0] / 2 - 0.1) * side,
      base + (e.sign.bottom + e.sign.board[1]) / 2,
      e.sign.z - Math.sin(e.sign.rot) * (e.sign.board[0] / 2 - 0.1) * side
    );
    post.castShadow = true;
    group.add(post);
  }
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(e.sign.board[0], e.sign.board[1], 0.06), timber(colors.signBoard)
  );
  board.position.set(e.sign.x, base + e.sign.bottom + e.sign.board[1] / 2, e.sign.z);
  board.rotation.y = e.sign.rot;
  board.castShadow = true;
  group.add(board);

  add(group, instanced(
    new THREE.CylinderGeometry(e.pole.radius, e.pole.radius, e.pole.height, 6), timber(colors.bamboo),
    e.poles, (p) => ({ x: p.x, y: ground(p.x, p.z) + e.pole.height / 2, z: p.z })
  ));
}

/* ------------------------------------------------------------------------ api */

/**
 * Build ERC's photo-sourced detail.
 *
 * `photo` is the loaded photo-detail document; this reads only its `erc`
 * section and returns `{ group, counts }` (empty and harmless if the section
 * is missing, so a half-wired boot still runs). Pass `surfaceAt` — the height
 * of the DRAWN terrain triangle — for everything placed on the ground;
 * `heightAt` is only the fallback.
 */
export function createPhotoErc(scene, { photo, heightAt, surfaceAt } = {}) {
  const group = new THREE.Group();
  group.name = "photo-erc";
  const section = photo?.erc;
  if (!section) {
    scene?.add(group);
    return { group, counts: {} };
  }
  const ground = surfaceAt || heightAt;
  if (typeof ground !== "function") {
    throw new Error("campus-photo-erc: needs surfaceAt (or heightAt) to place on the ground");
  }

  buildResidenceHalls(section, group, ground);
  buildApartments(section, group, ground);
  buildVentanas(section, group, ground);
  buildFurniture(section, group, ground);
  buildMiddleEarth(section, group, ground);
  buildGreatHall(section, group, ground);
  buildPromenade(section, group, ground);
  buildEllies(section, group, ground);

  scene?.add(group);
  return {
    group,
    counts: {
      hallBandEdges: section.residenceHalls.bands.length,
      hallSlots: section.residenceHalls.slots.length,
      apartmentFinEdges: section.apartments.fins.length,
      apartmentWindows: section.apartments.windows.length,
      ventanasColumns: section.ventanas.columns.length,
      amphitheatreRisers: section.ventanas.amphitheatre.arcs.length,
      tables: section.furniture.tables.length,
      umbrellas: section.furniture.umbrellas.length,
      lamps: section.furniture.squareLamps.length + section.furniture.globeLamps.length,
      greatHallColumns: section.greatHall.columns.length,
      promenadeSeats: section.promenade.seats.length,
      draws: group.children.length,
    },
  };
}
