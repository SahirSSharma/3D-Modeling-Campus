// Eighth College's four gathering places, from photographs — the INVENTED class.
//
// The Meditation Pavilion in the Bamboo Garden, the Tea House in the Ramble,
// the stair south of the basketball court, and the BBQ / fire-feature terrace.
// Everything here comes from docs/data/campus-photo-detail.json's
// `eighthgathering` section: dated built photography (EYRC / Lawrence Anderson
// 2024-25, SWA Group 2024-25) plus two registered plans. It READS that section
// and the terrain height functions and writes nothing back, ever.
//
// Four decisions shaped this file, and each of them is a place the shipped
// eighth section was wrong:
//
//   1. THE SURVEY DECIDES THE EXTENT, EVERY TIME. The eighth section shrank
//      the Meditation Pavilion to a 6.6 x 4.6 m slab because it read the
//      surveyed opening between courtyard-328 and courtyard-329 as "~11 x 8 m".
//      Sweeping z at 0.05 m across the two measured rings puts the opening at
//      14.90 x 7.90 m. Three independent reads of the roof — phf47's horizon
//      photogrammetry at 12.6 m, SWA-3's aerial at 14.3 m, the 2025 plan's
//      13.0 m marker — all land inside it. The roof ships at 13.5 x 7.3 m and
//      the deck is CLIPPED to what the survey allows, not to what SWA-21
//      suggests. Same rule cut the court stair from 6.5 m to 5.8 m wide,
//      where planting-bed-1760's measured east edge stops it.
//
//   2. EPOCH DECIDES EXISTENCE. Three amphitheatre tiers ship today off the
//      2021 DESIGN plan's zigzag. The 2025 BUILT plan draws nothing there and
//      SWA-16 photographs that ground clear. They are retired (see the
//      section's `supersedes`) and the stair that IS south of the court —
//      seven risers, a raking cheek wall each side, a stainless pipe handrail
//      on a mid-run standard — is built instead. Which also means the
//      "the 2014 LiDAR is smooth here so there is no step" argument, which is
//      load-bearing in two shipped Eighth module headers, is void: it
//      describes a demolished parking lot.
//
//   3. NOTHING CLIMBS TO NOTHING. The terrain under Eighth is 2014 LiDAR of a
//      car park, so a terrace stair placed on it has no upper level to reach.
//      Both stairs here carry their own top: the court stair lands a 0.10 m
//      lip against Pulse's measured north face, and the terrace stair ships
//      its landing AND the retaining faces of that landing down to the drawn
//      ground. Nothing hovers.
//
//   4. THE OBJECTS ARE ASSEMBLIES, NOT BOXES. The pavilion's screen is three
//      free-standing curved veneer drums built from real panel segments with
//      real open slots between them, each carrying a cantilevered bench with
//      an LED shadow gap under it. The fire feature is a three-course precast
//      wall with a glazed firebox and a media bed, not a floating pane. The
//      canopy has base plates, beams, purlins and a fascia. The tea house is
//      104 wall battens at a MEASURED 0.119 m pitch — 26 a face, re-counted in
//      arbitration after the round-one scan turned out to have run across BOTH
//      visible faces of the cube — plus the roof battens, a shoe rail and the
//      warm cavity glow that is the object's whole identity after dark.
//
//   5. THE TERRACE ARRANGEMENT IS SOLVED, AND IT SAYS SO. Nothing registers
//      the BBQ furniture to courtyard-2375 — the ortho has it in deep shadow,
//      the 2025 plan draws no furniture, and no frame shares a landmark — so
//      every (u, v) and every rot here is [estimated] and lives under one
//      declared owner, `bbq.arrangement`. What that block also carries is a
//      separation solve: round one's arrangement had 26 solid-solid
//      intersections in it, up to 0.79 m, including a chair standing inside a
//      conical planter, all of it stamped `measured`. The spacings are now
//      solved against an oriented-footprint check that the test re-runs over
//      the shipped numbers, with one declared exemption — the chairs tucked
//      under their cafe tables, which clear them by 0.20 m in section.
//
// Colours are DATA: every hex comes from the section's `colors` block and this
// file contains none. Surfaces come from the procedural material library
// (campus-materials.js) — code-generated maps only, never a photograph.
// Ground decals ride campus-overlay.js's ladder; there is no local lift
// constant here. Deterministic: irregularity is `hash`, never Math.random.
import * as THREE from "../vendor/three/three.module.min.js";
import { applyOverlayDepth, OVERLAY, overlayLift } from "./campus-overlay.js";
import { sharedMaterialLibrary } from "./campus-materials.js";
import { fillPoly } from "./campus-drape.js";

const PAD = "pad";
const CARPET = "carpet";

/* WHAT READS AS GROUND IS THE DECAL, NOT THE TERRAIN. Every flat surface this
   section draws — the bark field, the tea house's cobble, the terrace's unit
   pavers, the turf rug — is a decal lifted onto campus-overlay.js's ladder, so
   the visible ground under those things is `ground(x, z) + overlayLift(rung)`.
   Round one placed every solid that stands on them at the RAW terrain instead,
   which put 194 solids on the terrace and 23 at the tea house 90 mm INSIDE the
   surface they are standing on — every chair, table, planter, canopy base plate
   and the tea plinth. Anything that bears on one of this section's own decals
   now bears on that decal's plane; anything that skirts DOWN to the terrain
   (a casting's buried face) still uses the raw ground, which is the point of
   `seat` returning two numbers. */
const LIFT_PAD = overlayLift(PAD);
const LIFT_CARPET = overlayLift(CARPET);

/** Ray-cast point-in-polygon, for asking which decal a thing stands on. */
function inPoly(x, z, r) {
  let ins = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, zi] = r[i], [xj, zj] = r[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
}

const lib = () => sharedMaterialLibrary(THREE);

/* Which procedural class carries each colour role. Roughness/metalness are how
   a surface answers this scene's light, not a property of the campus, so they
   live here and not in the data file. */
const CLASS = {
  woodScreen: "woodSlat", teaWood: "woodSlat",
  pavilionRoof: "metalPanelSeam", pavilionFascia: "metalPanel",
  pavilionSoffit: "stucco", stucco: "stucco",
  boardConcrete: "boardFormedConcrete",
  groundConcrete: "smoothConcrete", seatPod: "smoothConcrete",
  counter: "smoothConcrete", fireWall: "smoothConcrete",
  conePlanter: "smoothConcrete", planterCharcoal: "smoothConcrete",
  barkMulch: "barkEucalyptus",
  gravelMargin: "decomposedGranite", cobblePale: "decomposedGranite",
  standingStone: "lavaRock", boulder: "lavaRock", lavaMedia: "lavaRock",
  railing: "metalPanel", metal: "metalPanel", tableLeg: "metalPanel",
  canopyPost: "metalPanel", poleDark: "metalPanel", teaShoe: "metalPanel",
  grillLid: "metalPanel", grillFascia: "metalPanel", extinguisher: "metalPanel",
  canopyDeck: "metalPanelSeam",
  cafeChair: "metalPanel", wireChair: "metalPanel", adirondack: "metalPanel",
  tableTop: "smoothConcrete",
  fireGlass: "glass",
  paverGrey: "pavingConcreteUnit",
  muralBlue: "stucco", muralPale: "stucco",
  oculusSky: "glass",
};
/* The library's `foliage` class is an alpha-cut CARD map: cutting holes in
   clump geometry or in a turf rug shreds it, which is the failure keeling's
   header records. Plant clumps and the turf inset take a plain lit material
   instead, and the sourced hex still decides the colour. */
const PLAIN = {
  rushGreen: { roughness: 0.95 },
  agaveGrey: { roughness: 0.9 },
  turfPanel: { roughness: 0.98 },
};
const FINISH = {
  railing: { metalness: 0.8, roughness: 0.35 },
  metal: { metalness: 0.8, roughness: 0.35 },
  tableLeg: { metalness: 0.7, roughness: 0.4 },
  canopyPost: { metalness: 0.7, roughness: 0.4 },
  poleDark: { metalness: 0.6, roughness: 0.45 },
  teaShoe: { metalness: 0.6, roughness: 0.45 },
  grillLid: { metalness: 0.6, roughness: 0.3 },
  grillFascia: { metalness: 0.5, roughness: 0.35 },
  extinguisher: { metalness: 0.3, roughness: 0.4 },
  canopyDeck: { metalness: 0.55, roughness: 0.45 },
  pavilionRoof: { metalness: 0.6, roughness: 0.4 },
  pavilionFascia: { metalness: 0.3, roughness: 0.55 },
  /* Moulded HDPE and powder-coated wire read as plastic, not steel. */
  adirondack: { metalness: 0.05, roughness: 0.65 },
  cafeChair: { metalness: 0.35, roughness: 0.5 },
  wireChair: { metalness: 0.35, roughness: 0.5 },
};
/* The warm-LED roles glow rather than reflect: recessed strips, in-grade
   uplights, the tea house cavity. Emissive, so they read at dusk. */
const EMISSIVE = new Set(["ledWarm"]);

function material(role, hex, repeat) {
  if (EMISSIVE.has(role)) {
    return new THREE.MeshStandardMaterial({
      color: hex, emissive: new THREE.Color(hex), emissiveIntensity: 0.85,
      roughness: 0.6, metalness: 0,
    });
  }
  if (PLAIN[role]) {
    return new THREE.MeshStandardMaterial({ color: hex, metalness: 0, ...PLAIN[role] });
  }
  const cls = CLASS[role] || "smoothConcrete";
  return lib().get(cls, { color: hex, repeat, ...(FINISH[role] || {}) });
}

/** Deterministic 0..1 from any integer mix — a reload rebuilds the same scene. */
function hash(...ns) {
  let s = 0;
  for (let i = 0; i < ns.length; i++) s = s * 131.71 + ns[i] * 57.13 + 7.9;
  const v = Math.sin(s) * 43758.5453;
  return v - Math.floor(v);
}

/* ------------------------------------------------------------- batching --- */

/**
 * Collects every solid as a transform against one of four unit primitives and
 * emits ONE InstancedMesh per (primitive, colour) pair. The tea house alone is
 * ~180 battens and the BBQ terrace another few hundred pieces; per-object
 * meshes would be a thousand draw calls for one corner of one college.
 */
function batcher() {
  const bins = new Map();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  const eul = new THREE.Euler();
  let n = 0;

  function push(prim, role, x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) {
    const key = `${prim}|${role}`;
    let bin = bins.get(key);
    if (!bin) bins.set(key, (bin = { prim, role, mats: [] }));
    pos.set(x, y, z);
    eul.set(rx, ry, rz, "YXZ");
    quat.setFromEuler(eul);
    scl.set(sx, sy, sz);
    bin.mats.push(new THREE.Matrix4().compose(pos, quat, scl));
    n++;
  }

  return {
    box: (role, x, y, z, w, h, d, ry = 0, rx = 0, rz = 0) =>
      push("box", role, x, y, z, w, h, d, ry, rx, rz),
    cyl: (role, x, y, z, r, h, ry = 0, rx = 0, rz = 0) =>
      push("cyl", role, x, y, z, r * 2, h, r * 2, ry, rx, rz),
    /** An ellipsoid-ish blob: a low-poly sphere scaled on three axes. */
    blob: (role, x, y, z, sx, sy, sz, ry = 0) =>
      push("sph", role, x, y, z, sx, sy, sz, ry),
    cone: (role, x, y, z, r, h, ry = 0) =>
      push("cone", role, x, y, z, r * 2, h, r * 2, ry),
    /** A truncated cone for tapered planters: unit is r=0.5 top, r=0.5 base. */
    taper: (role, x, y, z, rTop, rBase, h) =>
      push(`tap:${rTop.toFixed(3)}:${rBase.toFixed(3)}`, role, x, y, z, 1, h, 1),
    get count() { return n; },

    build(group, colors) {
      const unit = {
        box: new THREE.BoxGeometry(1, 1, 1),
        cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 14),
        sph: new THREE.SphereGeometry(0.5, 12, 8),
        cone: new THREE.ConeGeometry(0.5, 1, 10),
      };
      let drawn = 0;
      for (const bin of bins.values()) {
        const hex = colors[bin.role];
        if (!hex) continue;
        let geo = unit[bin.prim];
        if (!geo && bin.prim.startsWith("tap:")) {
          const [, rt, rb] = bin.prim.split(":");
          geo = new THREE.CylinderGeometry(Number(rt), Number(rb), 1, 20, 1, false);
        }
        if (!geo) continue;
        const mat = material(bin.role, hex);
        const inst = new THREE.InstancedMesh(geo, mat, bin.mats.length);
        bin.mats.forEach((m, i) => inst.setMatrixAt(i, m));
        inst.instanceMatrix.needsUpdate = true;
        inst.castShadow = true;
        inst.receiveShadow = true;
        inst.name = `${bin.prim}-${bin.role}`;
        group.add(inst);
        drawn++;
      }
      /* Unit primitives nobody reached are geometry nobody owns. */
      for (const [prim, geo] of Object.entries(unit)) {
        let used = false;
        for (const bin of bins.values()) if (bin.prim === prim && colors[bin.role]) used = true;
        if (!used) geo.dispose();
      }
      return drawn;
    },
  };
}

/* --------------------------------------------------------------- decals --- */

/** A polygon drawn flat on the measured terrain, on the shared overlay ladder. */
function polyDecal(poly, role, hex, rung, ground, repeat) {
  const pos = [];
  fillPoly(pos, poly, ground, overlayLift(rung));
  if (!pos.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  const nrm = new Float32Array(pos.length);
  for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1;
  geo.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
  const mat = applyOverlayDepth(material(role, hex, repeat), rung);
  mat.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = OVERLAY[rung].renderOrder;
  mesh.receiveShadow = true;
  return mesh;
}

const rectPoly = (r) => [[r.x0, r.z0], [r.x1, r.z0], [r.x1, r.z1], [r.x0, r.z1]];

/**
 * How a rigid slab seats on rolling ground. A deck, a plinth or a stair is one
 * casting: it has ONE datum, and if that datum is an average the drawn terrain
 * comes up through it at the high corner. So the datum is the HIGHEST ground
 * under the rim (nothing is ever buried) and the structure skirts DOWN to the
 * lowest (no ground passes under it). Returns { top, bottom } in world height.
 */
function seat(rect, ground, step = 1) {
  let hi = -Infinity, lo = Infinity;
  const nx = Math.max(2, Math.ceil((rect.x1 - rect.x0) / step));
  const nz = Math.max(2, Math.ceil((rect.z1 - rect.z0) / step));
  const take = (x, z) => {
    const g = ground(x, z);
    if (!Number.isFinite(g)) return;
    hi = Math.max(hi, g); lo = Math.min(lo, g);
  };
  for (let i = 0; i <= nx; i++) {
    const x = rect.x0 + ((rect.x1 - rect.x0) * i) / nx;
    take(x, rect.z0); take(x, rect.z1);
  }
  for (let j = 0; j <= nz; j++) {
    const z = rect.z0 + ((rect.z1 - rect.z0) * j) / nz;
    take(rect.x0, z); take(rect.x1, z);
  }
  if (!Number.isFinite(hi)) return { top: 0, bottom: 0 };
  return { top: hi, bottom: lo };
}

/** The same seat, for a rotated footprint given as world corner points. */
function seatPoints(pts, ground) {
  let hi = -Infinity, lo = Infinity;
  for (const [x, z] of pts) {
    const g = ground(x, z);
    if (!Number.isFinite(g)) continue;
    hi = Math.max(hi, g); lo = Math.min(lo, g);
  }
  if (!Number.isFinite(hi)) return { top: 0, bottom: 0 };
  return { top: hi, bottom: lo };
}

/* ---------------------------------------------------------- roof shells --- */

/**
 * A hipped roof shell: eave rectangle w x d, ridge along local x of length
 * (w - d), rise from the pitch. Returned centred on the origin with the eave
 * plane at y = 0. This is the Meditation Pavilion's roof — SWA-3's hip and
 * ridge creases are the reason it is not a flat slab.
 */
function hipRoofGeometry(w, d, rise) {
  const hw = w / 2, hd = d / 2, hr = (w - d) / 2;
  const A = [-hw, 0, -hd], B = [hw, 0, -hd], C = [hw, 0, hd], D = [-hw, 0, hd];
  const R0 = [-hr, rise, 0], R1 = [hr, rise, 0];
  const tris = [
    A, B, R1, A, R1, R0,          /* north trapezoid */
    C, D, R0, C, R0, R1,          /* south trapezoid */
    B, C, R1,                     /* east hip */
    D, A, R0,                     /* west hip */
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(tris.flat(), 3));
  g.computeVertexNormals();
  return g;
}

/* ------------------------------------------------- the meditation pavilion */

function buildMeditation(sec, b, group, ground, counts) {
  const M = sec.meditation, C = sec.colors;
  const [cx, cz] = M.centre;
  const deck = M.deck.rect;
  /* One casting, one datum: the deck sits on the HIGHEST ground under its rim
     and skirts down to the lowest, so no ground comes up through it. */
  const dSeat = seat(deck, ground);
  /* The deck stands IN the bark field, which is a decal on the pad rung, so its
     0.45 m is measured from the bark's own surface — from the raw terrain it
     would read 0.36 m tall against the ground beside it. The skirt below still
     runs to the raw terrain, because that is what it is skirting to. */
  const deckTop = dSeat.top + LIFT_PAD + M.deck.height;

  /* The bark field, clipped to the MEASURED spine opening and held clear of it
     by `inset`, so it can never paint over courtyard-328 or courtyard-329 —
     which are surveyed rings this section does not own. */
  const bi = M.bark.inset;
  const barkRect = {
    x0: M.bark.rect.x0 + bi, x1: M.bark.rect.x1 - bi,
    z0: M.bark.rect.z0 + bi, z1: M.bark.rect.z1 - bi,
  };
  const bark = polyDecal(rectPoly(barkRect), "barkMulch", C.barkMulch, PAD, ground, 14);
  if (bark) { bark.name = "meditation-bark"; group.add(bark); counts.decals++; }

  /* Board-formed deck with a battered face: a lower plinth block and the deck
     slab proud of it, which is what reads as the chamfer in SWA-21. */
  const dw = deck.x1 - deck.x0, dd = deck.z1 - deck.z0;
  const bt = M.deck.batter;
  const skirtH = deckTop - 0.08 - dSeat.bottom;
  b.box("boardConcrete", cx, dSeat.bottom + skirtH / 2, cz,
    dw - bt * 2, skirtH, dd - bt * 2);
  b.box("boardConcrete", cx, deckTop - 0.04, cz, dw, 0.08, dd);
  /* The LED nosing recessed under the deck lip — people sit on this edge. */
  const [nw, nh] = M.deck.ledNosing;
  for (const [ax, az, len, ry] of [
    [cx, deck.z0 + bt + nw / 2, dw - bt * 2, 0], [cx, deck.z1 - bt - nw / 2, dw - bt * 2, 0],
    [deck.x0 + bt + nw / 2, cz, dd - bt * 2, Math.PI / 2],
    [deck.x1 - bt - nw / 2, cz, dd - bt * 2, Math.PI / 2],
  ]) b.box("ledWarm", ax, deckTop - 0.10, az, len, nh, nw, ry);

  /* In-grade uplights around the deck perimeter, at the declared pitch. */
  const up = M.deck.uplights;
  const iw = dw - up.inset * 2, id = dd - up.inset * 2;
  const per = 2 * (iw + id), step = per / up.count;
  for (let i = 0; i < up.count; i++) {
    let t = i * step;
    let x, z;
    if (t < iw) { x = deck.x0 + up.inset + t; z = deck.z0 + up.inset; }
    else if (t < iw + id) { x = deck.x1 - up.inset; z = deck.z0 + up.inset + (t - iw); }
    else if (t < 2 * iw + id) { x = deck.x1 - up.inset - (t - iw - id); z = deck.z1 - up.inset; }
    else { x = deck.x0 + up.inset; z = deck.z1 - up.inset - (t - 2 * iw - id); }
    b.cyl("ledWarm", x, deckTop + up.proud / 2, z, up.diameter / 2, up.proud);
    counts.deckUplights++;
  }

  /* The gravel margin: a recessed band of gravel between the deck edge and the
     drum bases, sitting ON the deck it belongs to. */
  const gm = M.deck.gravelMargin;
  for (const [ax, az, w, d] of [
    [cx, deck.z0 + gm / 2, dw, gm], [cx, deck.z1 - gm / 2, dw, gm],
    [deck.x0 + gm / 2, cz, gm, dd - gm * 2], [deck.x1 - gm / 2, cz, gm, dd - gm * 2],
  ]) b.box("gravelMargin", ax, deckTop + 0.015, az, w, 0.03, d);

  /* --- the three curved veneer screen drums --- */
  const SC = M.drums.screen;
  const screenTop = deckTop + SC.height;
  const SEGS = 4;  /* chord segments per panel — the curve you can see */
  M.drums.list.forEach((drum, di) => {
    counts.pavilionDrums++;
    counts.pavilionBenches++;
    const step = (SC.panelWidth + SC.slot) / drum.r;
    for (const [a0, a1] of drum.arcs) {
      const nPanels = Math.max(1, Math.floor(((a1 - a0) * drum.r) / (SC.panelWidth + SC.slot)));
      const pad = ((a1 - a0) - nPanels * step) / 2;
      const sw = SC.panelWidth / drum.r;
      for (let p = 0; p < nPanels; p++) {
        counts.pavilionPanels++;
        const s0 = a0 + pad + p * step;
        for (let k = 0; k < SEGS; k++) {
          const am = s0 + (sw * (k + 0.5)) / SEGS;
          const chord = 2 * drum.r * Math.sin(sw / (2 * SEGS)) + 0.004;
          const x = drum.cx + Math.cos(am) * drum.r;
          const z = drum.cz + Math.sin(am) * drum.r;
          b.box("woodScreen", x, deckTop + SC.height / 2, z,
            SC.thickness, SC.height, chord, -am);
        }
      }
      /* The cantilevered bench: same veneer, inside face, LED gap beneath. */
      const B = M.bench;
      const face = drum.r - SC.thickness / 2;   /* the screen's inner face */
      const br = face - B.depth / 2;
      const bn = Math.max(2, Math.round(((a1 - a0) * br) / 0.5));
      for (let k = 0; k < bn; k++) {
        const am = a0 + ((a1 - a0) * (k + 0.5)) / bn;
        const chord = 2 * br * Math.sin((a1 - a0) / (2 * bn)) + 0.006;
        const x = drum.cx + Math.cos(am) * br;
        const z = drum.cz + Math.sin(am) * br;
        b.box("woodScreen", x, deckTop + B.seatHeight, z, B.depth, B.slab, chord, -am);
        /* The LED sits at the BACK of the shadow gap, against the screen it is
           fixed to — which is where phf49 shows the wash starting. The gap is
           one seat slab deep, which is what `ledGap` declares. */
        const lr = face - 0.05;
        b.box("ledWarm", drum.cx + Math.cos(am) * lr, deckTop + B.seatHeight - B.ledGap,
          drum.cz + Math.sin(am) * lr, 0.1, B.ledGap / 2, chord, -am);
      }
      /* The dark blade bracket at each bench's free end (phf48), fixed back to
         the screen so nothing about the cantilever floats. */
      const [bw, bh, bd] = M.bench.bracket;
      const brr = face - bd / 2;
      /* At the first and last PANEL centres, not the raw arc ends: the arc
         ends are open slots and a bracket there is fixed to nothing. */
      for (const ae of [a0 + pad + sw / 2, a0 + pad + (nPanels - 1) * step + sw / 2]) {
        const x = drum.cx + Math.cos(ae) * brr;
        const z = drum.cz + Math.sin(ae) * brr;
        b.box("teaShoe", x, deckTop + B.seatHeight - bh / 2 - 0.03, z, bw, bh, bd, -ae);
      }
    }

    /* One standing stone per chamber, in its own recessed gravel ring. */
    const st = M.stones.list.find((s) => s.drum === drum.id);
    if (st) {
      const ST = M.stones;
      const ang = Math.PI / 2 + di * 0.7;
      const sx = drum.cx + Math.cos(ang) * ST.offset;
      const sz = drum.cz + Math.sin(ang) * ST.offset;
      /* The ring is cut INTO the deck, so its gravel surface sits `gravelRecess`
         below the deck top — and the stone stands on the gravel, not on the
         deck it is recessed out of. */
      const gTop = deckTop - ST.gravelRecess;
      b.cyl("gravelMargin", sx, gTop - 0.02, sz, ST.gravelRing / 2, 0.04);
      const lean = 0.05 + hash(sec.seed, di, 11) * 0.09;
      const [p0, p1] = ST.plan, [d0, d1] = ST.depth;
      b.box("standingStone", sx, gTop + st.h / 2, sz,
        p0 + hash(sec.seed, di, 12) * (p1 - p0), st.h,
        d0 + hash(sec.seed, di, 13) * (d1 - d0),
        hash(sec.seed, di, 14) * Math.PI, lean, lean * 0.6);
      counts.standingStones++;
    }
  });

  /* --- the roof: soffit, oculi, downlights, fascia, hipped seam plate --- */
  const R = M.roof;
  const rr = R.rect, rw = rr.x1 - rr.x0, rd = rr.z1 - rr.z0;
  const soffitY = deckTop + R.soffitClear;
  b.box("pavilionSoffit", cx, soffitY + 0.03, cz, rw - 0.02, 0.06, rd - 0.02);

  M.drums.list.forEach((drum, di) => {
    const size = M.oculi.sizes[drum.id] || M.oculi.sizes.mid;
    /* A GLAZED oval flush in the soffit — dark in phf48, blue sky in phf49. */
    b.blob("oculusSky", drum.cx, soffitY + 0.055, drum.cz, size[0], 0.05, size[1]);
    counts.oculi++;
    for (let k = 0; k < R.downlights.perChamber; k++) {
      const a = (k / R.downlights.perChamber) * Math.PI * 2 + 0.4;
      /* Recessed INTO the soffit slab, dropping 15 mm proud of it. */
      b.cyl("ledWarm", drum.cx + Math.cos(a) * (drum.r * 0.62),
        soffitY + 0.01, drum.cz + Math.sin(a) * (drum.r * 0.62),
        R.downlights.diameter / 2, 0.05);
      counts.soffitDownlights++;
    }
  });

  /* The deep dark fascia band, all four sides, sitting on the soffit. */
  const fz = soffitY + R.fascia / 2 + 0.06;
  b.box("pavilionFascia", cx, fz, rr.z0 + 0.05, rw, R.fascia, 0.1);
  b.box("pavilionFascia", cx, fz, rr.z1 - 0.05, rw, R.fascia, 0.1);
  b.box("pavilionFascia", rr.x0 + 0.05, fz, cz, 0.1, R.fascia, rd - 0.2);
  b.box("pavilionFascia", rr.x1 - 0.05, fz, cz, 0.1, R.fascia, rd - 0.2);

  const eaveY = soffitY + 0.06 + R.fascia;
  const shell = new THREE.Mesh(
    hipRoofGeometry(rw, rd, R.ridgeRise),
    material("pavilionRoof", C.pavilionRoof, [rw / 2, rd / 2])
  );
  shell.material.side = THREE.DoubleSide;
  shell.position.set(cx, eaveY, cz);
  shell.castShadow = true;
  shell.receiveShadow = true;
  shell.name = "meditation-roof";
  group.add(shell);

  /* Standing seams up each slope, at the standard panel width, clipped where
     the trapezoid meets the hip so no rib overhangs the roof it sits on. */
  const nSeam = Math.floor(rw / R.seam);
  const padS = (rw - nSeam * R.seam) / 2;
  for (let i = 0; i < nSeam; i++) {
    const lx = -rw / 2 + padS + (i + 0.5) * R.seam;
    const run = Math.min(rd / 2, rw / 2 - Math.abs(lx));
    if (run < 0.15) continue;
    const slope = run / Math.cos(R.pitch);
    for (const side of [-1, 1]) {
      const zMid = side * (rd / 2 - run / 2);
      const yMid = eaveY + ((rd / 2 - Math.abs(zMid)) / (rd / 2)) * R.ridgeRise;
      b.box("pavilionRoof", cx + lx, yMid + 0.02, cz + zMid,
        0.035, 0.03, slope, 0, -side * R.pitch);
      counts.roofSeams++;
    }
  }
  /* The rafter-tail batten row along the eaves, on the upper surface. */
  const [ew, eh, ed] = R.eaveBatten;
  for (const [along, fixed, horiz] of [
    [rw, rr.z0 + 0.16, true], [rw, rr.z1 - 0.16, true],
    [rd, rr.x0 + 0.16, false], [rd, rr.x1 - 0.16, false],
  ]) {
    const n = Math.floor(along / R.eaveBattenPitch);
    const pad = (along - n * R.eaveBattenPitch) / 2;
    for (let i = 0; i < n; i++) {
      const t = -along / 2 + pad + (i + 0.5) * R.eaveBattenPitch;
      const x = horiz ? cx + t : fixed;
      const z = horiz ? fixed : cz + t;
      b.box("pavilionRoof", x, eaveY + eh / 2 + 0.01, z,
        horiz ? ew : ed, eh, horiz ? ed : ew);
      counts.eaveBattens++;
    }
  }

  /* Loose objects on the surveyed courtyard ground either side of the spine. */
  for (const s of M.slabStones.list) {
    const g = ground(s.x, s.z);
    b.box("standingStone", s.x, g + s.h / 2, s.z, s.w, s.h, s.d, s.rot);
    counts.slabStones++;
  }
  for (const p of M.seatPods.list) {
    const g = ground(p.x, p.z);
    b.blob("seatPod", p.x, g + p.h / 2, p.z, p.w, p.h, p.d, p.rot);
    counts.seatPods++;
  }
  /* The two charcoal planter cubes that used to stand in the measured throats
     are GONE from here. Arbitrated 2026-08-19: they are the same family
     eighthcourtyards.bambooGarden.planterCubes counts twelve of in SWA -3, at a
     size measured against people sitting on the rims rather than fitted to a
     throat. One owner, one family — see `absent`. */
}

/* -------------------------------------------------------- the tea house --- */

function buildTeaHouse(sec, b, group, ground, counts) {
  const T = sec.teaHouse, C = sec.colors;
  const [tx, tz] = T.position;
  const rot = T.rotY;
  const c = Math.cos(rot), s = Math.sin(rot);
  /* Local (u, v) in the measured channel frame -> world. */
  const W = (u, v) => [tx + u * c + v * s, tz - u * s + v * c];

  /* The pale rounded cobble bed, CLIPPED to the measured gap polygon. */
  const gap = sec.measured.teaHouse.gap;
  const cob = polyDecal(gap, "cobblePale", C.cobblePale, PAD, ground, 20);
  if (cob) { cob.name = "tea-cobble"; group.add(cob); counts.decals++; }
  /* Inside the gap the visible ground is the cobble, not the terrain. */
  const bed = (x, z) => ground(x, z) + (inPoly(x, z, gap) ? LIFT_PAD : 0);

  /* Two-riser cast plinth. The entry oversail is on local -v. */
  const P = T.plinth, cube = T.cube;
  const pw = cube.size + P.oversailOther * 2;
  const pdTop = cube.size + P.oversailEntry + P.oversailOther;
  const topOff = (P.oversailOther - P.oversailEntry) / 2;
  const lowD = pdTop + P.tread;
  const lowOff = topOff - P.tread / 2;
  /* Same rule as the pavilion deck: one casting, seated on the highest ground
     under its own rim and skirted down to the lowest. The two datums come from
     two different surfaces on purpose — the plinth STANDS on the cobble bed and
     SKIRTS to the terrain under it. */
  const pPts = [
    [-pw / 2, lowOff - lowD / 2], [pw / 2, lowOff - lowD / 2],
    [pw / 2, lowOff + lowD / 2], [-pw / 2, lowOff + lowD / 2],
    [0, lowOff - lowD / 2], [0, lowOff + lowD / 2],
  ].map(([u, v]) => W(u, v));
  const pSeat = {
    top: seatPoints(pPts, bed).top,
    bottom: seatPoints(pPts, ground).bottom,
  };
  const g = pSeat.top;
  let [x, z] = W(0, lowOff);
  const lowH = g + P.riser - pSeat.bottom;
  b.box("boardConcrete", x, pSeat.bottom + lowH / 2, z, pw, lowH, lowD, rot);
  [x, z] = W(0, topOff);
  b.box("boardConcrete", x, g + P.riser + (P.platform - P.riser) / 2, z,
    pw, P.platform - P.riser, pdTop, rot);
  const plat = g + P.platform;

  /* The batten screen. 26 battens a face at the MEASURED 0.119 m pitch: FFT
     and autocorrelation at five scan heights on each SWA -23 face, a direct
     peak read at 11.83 px, and phf44's 8.83 px over a 233 px face all converge
     on 26 +/- 3. The round-one 66 was a scan across both visible faces of the
     cube attributed to one, which doubled the screen. */
  const BT = T.battens;
  const half = cube.size / 2, hf = cube.battenedFace / 2;
  const ridgeAt = -half + cube.size * cube.ridgeFrac;
  const profile = (lu) => (lu <= ridgeAt
    ? cube.eave + (cube.ridge - cube.eave) * (lu + half) / (ridgeAt + half)
    : cube.ridge - (cube.ridge - cube.eave) * (lu - ridgeAt) / (half - ridgeAt));
  const PO = T.portal;
  const portalLo = hf - PO.width;   /* the portal wraps the +u / -v corner */
  const rt = PO.revealThickness;
  /* A batten over the opening starts on TOP of the head beam, not at the head
     of the opening — the beam is a solid member `rt` deep and the battens are
     fixed to its upper face. Starting them at PO.height ran 18 battens and both
     jambs through the reveal by the beam's whole depth. */
  const portalFoot = PO.height + rt;
  /* And a batten that is not over the opening lands on the SHOE — the dark
     metal rail and blocks are plates UNDER the batten bundles, so the screen
     starts at the top of the taller of the two. Starting it at the platform
     ran the rail through all 104 battens by its own 0.05 m height. */
  const shoeTop = Math.max(T.shoes.rail[1], T.shoes.block[1]);

  for (let i = 0; i < BT.perFace; i++) {
    const t = -hf + BT.pitch * (i + 0.5);
    /* Gable faces at local v = +-half: height follows the roof profile. */
    for (const side of [-1, 1]) {
      const inPortal = side < 0 && t > portalLo;
      const foot = inPortal ? portalFoot : shoeTop;
      const h = profile(t) - foot;
      if (h > 0.04) {
        const [wx, wz] = W(t, side * half);
        b.box("teaWood", wx, plat + foot + h / 2, wz,
          BT.face, h, BT.depth, rot);
        counts.teaWallBattens++;
      }
    }
    /* Eave faces at local u = +-half: constant eave height. */
    for (const side of [-1, 1]) {
      const inPortal = side > 0 && t < -portalLo;
      const foot = inPortal ? portalFoot : shoeTop;
      const h = cube.eave - foot;
      if (h > 0.04) {
        const [wx, wz] = W(side * half, t);
        b.box("teaWood", wx, plat + foot + h / 2, wz,
          BT.depth, h, BT.face, rot);
        counts.teaWallBattens++;
      }
    }
  }

  /* The heavy solid reveal framing the corner portal — a head beam and one
     inner jamb per face, and NO corner post, because the portal is cut through
     that corner. It reads as a solid box against the fine battens (phf45). */
  /* The two members MEET at the corner instead of running through each other:
     the head on the +u face carries the corner and the one on the -v face
     stops against its inner face. Both stop at the jamb they land on rather
     than overhanging into the batten field beside the opening. */
  const headHi = half - PO.revealDepth / 2;
  let [hx, hz] = W((portalLo + headHi) / 2, -half);
  b.box("teaWood", hx, plat + PO.height + rt / 2, hz,
    headHi - portalLo, rt, PO.revealDepth, rot);
  [hx, hz] = W(half, -(portalLo + half) / 2);
  b.box("teaWood", hx, plat + PO.height + rt / 2, hz,
    PO.revealDepth, rt, half - portalLo, rot);
  /* The two inner jambs, stopping UNDER the head they carry rather than
     running up through it, and standing INSIDE the opening rather than
     underneath the battens beside it. */
  [hx, hz] = W(portalLo + rt / 2, -half);
  b.box("teaWood", hx, plat + PO.height / 2, hz,
    rt, PO.height, PO.revealDepth, rot);
  [hx, hz] = W(half, -(portalLo + rt / 2));
  b.box("teaWood", hx, plat + PO.height / 2, hz,
    PO.revealDepth, PO.height, rt, rot);

  /* Dark metal shoe rail under each face, plus a block per batten bundle. The
     shoe caps a batten base, so it STOPS AT THE PORTAL: past the jamb there is
     no batten to cap, and a rail run through it is a metal sill across an
     opening people walk through. */
  const [sd, sh] = T.shoes.rail;
  const stop = portalLo;   /* the jamb's own outer face */
  for (const [u, v, along, run] of [
    [(-hf + stop) / 2, -half, true, stop + hf],
    [0, half, true, cube.battenedFace],
    [-half, 0, false, cube.battenedFace],
    [half, (hf - stop) / 2, false, stop + hf],
  ]) {
    const [wx, wz] = W(u, v);
    b.box("teaShoe", wx, plat + sh / 2, wz,
      along ? run : sd, sh, along ? sd : run, rot);
  }
  const [bw, bh, bd] = T.shoes.block;
  for (let i = 0; i < BT.perFace; i += T.shoes.blockEvery) {
    const t = -hf + BT.pitch * (i + 0.5);
    for (const [u, v, along] of [[t, -half, true], [t, half, true], [-half, t, false], [half, t, false]]) {
      /* And no block stands in the doorway either. */
      if (along && v < 0 && u > stop) continue;
      if (!along && u > 0 && v < -stop) continue;
      const [wx, wz] = W(u, v);
      b.box("teaShoe", wx, plat + bh / 2, wz, along ? bw : bd, bh, along ? bd : bw, rot);
      counts.teaShoeBlocks++;
    }
  }

  /* Roof planes: the SAME batten screen, parallel to the ridge, both slopes,
     carried on three rafters a slope. A batten roof with no rafters under it
     is a row of floating sticks, and the support gate says so. */
  for (const sign of [-1, 1]) {
    const uEave = sign * half;
    const run = Math.abs(uEave - ridgeAt);
    const rise = cube.ridge - cube.eave;
    const slope = Math.hypot(run, rise);
    const ang = Math.atan2(rise, run) * (sign > 0 ? 1 : -1);
    for (const lv of [-half + 0.25, 0, half - 0.25]) {
      const [rx2, rz2] = W((uEave + ridgeAt) / 2, lv);
      b.box("teaWood", rx2, plat + cube.eave + rise / 2 - 0.045, rz2,
        slope, 0.09, 0.06, rot, 0, ang);
    }
    const n = Math.max(1, Math.round(slope / BT.pitch));
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n;
      const u = uEave + (ridgeAt - uEave) * f;
      const y = plat + cube.eave + rise * f;
      const [wx, wz] = W(u, 0);
      b.box("teaWood", wx, y + BT.depth / 2, wz, BT.face, BT.depth, cube.size, rot, 0, ang);
      counts.teaRoofBattens++;
    }
  }

  /* The warm cavity glow: an emissive core inside the screen. That glow is the
     object's whole identity after dark and a build without it fails SWA-23. */
  const [gw, gh, gd] = T.glow.core;
  b.box("ledWarm", tx, plat + T.glow.centreHeight, tz, gw, gh, gd, rot);

  /* One L-shaped cast bench along the two closed faces. */
  const BN = T.bench;
  const inner = half - BN.depth / 2 - 0.12;
  for (const [u, v, w, d] of [
    [0, inner, cube.size - BN.depth - 0.3, BN.depth],
    [-inner, -0.2, BN.depth, cube.size - BN.depth - 0.3],
  ]) {
    const [wx, wz] = W(u, v);
    b.box("boardConcrete", wx, plat + BN.seatHeight / 2, wz, w, BN.seatHeight, d, rot);
  }

  /* The setting, every point verified inside the surveyed courtyard ring. */
  const S = T.setting;
  for (let i = 0; i < S.boulders.list.length; i++) {
    const [bx, bz, r] = S.boulders.list[i];
    const bg = ground(bx, bz);
    b.blob("boulder", bx, bg + r * 0.68, bz,
      r * 2, r * 1.55, r * 1.8 + hash(sec.seed, i, 3) * 0.2, hash(sec.seed, i, 4) * Math.PI);
    counts.teaBoulders++;
  }
  for (let i = 0; i < S.rushes.list.length; i++) {
    const [rx, rz] = S.rushes.list[i];
    const rg = ground(rx, rz);
    const [rw2, rh] = [S.rushes.size[0], S.rushes.size[1]];
    for (let k = 0; k < 5; k++) {
      const a = hash(sec.seed, i, k, 5) * Math.PI * 2;
      const d = hash(sec.seed, i, k, 6) * rw2 * 0.3;
      b.cone("rushGreen", rx + Math.cos(a) * d, rg + rh / 2, rz + Math.sin(a) * d,
        rw2 * 0.16, rh * (0.75 + hash(sec.seed, i, k, 7) * 0.5));
    }
    counts.teaRushes++;
  }
  for (let i = 0; i < S.agaves.list.length; i++) {
    const [ax, az] = S.agaves.list[i];
    const ag = ground(ax, az);
    const [aw, ah] = S.agaves.size;
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 + hash(sec.seed, i, 8) * 0.6;
      b.box("agaveGrey", ax + Math.cos(a) * aw * 0.22, ag + ah * 0.35,
        az + Math.sin(a) * aw * 0.22, 0.09, ah * 0.75, aw * 0.42, -a, 0.75, 0);
    }
    counts.teaAgaves++;
  }
  const PL = S.poleLight;
  const [px, pz] = PL.at;
  const pg = ground(px, pz);
  b.cyl("groundConcrete", px, pg + PL.base[1] / 2, pz, PL.base[0] / 2, PL.base[1]);
  b.cyl("poleDark", px, pg + PL.base[1] + PL.height / 2, pz, PL.shaft / 2, PL.height);
  b.box("poleDark", px, pg + PL.base[1] + PL.height + PL.head[1] / 2, pz,
    PL.head[0], PL.head[1], PL.head[0]);

  /* The picket guardrail, standing ON the measured lobe boundary. */
  const RL = S.rail;
  const len = RL.z1 - RL.z0;
  const nPick = Math.floor(len / RL.pitch);
  for (let i = 0; i < nPick; i++) {
    const zz = RL.z0 + (i + 0.5) * RL.pitch;
    b.cyl("railing", RL.x, ground(RL.x, zz) + RL.height / 2, zz, RL.picket / 2, RL.height);
    counts.teaRailPickets++;
  }
  const mz = (RL.z0 + RL.z1) / 2;
  b.cyl("railing", RL.x, ground(RL.x, mz) + RL.height, mz, RL.topRail / 2, len, 0, Math.PI / 2);
}

/* ------------------------------------------------------- the court stair --- */

function buildCourtStair(sec, b, group, ground, counts) {
  const S = sec.courtStair;
  const st = S.stair, r = st.rect;
  const w = r.x1 - r.x0, cxm = (r.x0 + r.x1) / 2;
  const sSeat = seat(r, ground);
  const g0 = sSeat.top;

  for (let i = 0; i < st.risers; i++) {
    const z0 = r.z0 + i * st.tread;
    const top = g0 + (i + 1) * st.riser;
    /* Every tread is a solid block down to the LOWEST ground under the flight,
       so the flight is a mass with faces, never a stack of floating slabs. It
       runs BETWEEN the two cheek walls, not through them: a full-width tread
       with a cheek drawn inside it is 17 solids of pure interpenetration. */
    b.box("groundConcrete", cxm, (sSeat.bottom + top) / 2, z0 + st.tread / 2,
      w - st.cheek.thickness * 2, top - sSeat.bottom, st.tread);
    counts.courtStairTreads++;
    /* Raking cheek wall each side, stepping with the tread it flanks. They sit
       INSIDE the clipped rectangle: the plan's own 6.5 m width already lost
       0.7 m to planting-bed-1760's measured edge, and a cheek hung outside
       would put it straight back into the surveyed bed. */
    for (const side of [-1, 1]) {
      b.box("boardConcrete", cxm + side * (w / 2 - st.cheek.thickness / 2),
        (sSeat.bottom + top + st.cheek.proud) / 2, z0 + st.tread / 2,
        st.cheek.thickness, top + st.cheek.proud - sSeat.bottom, st.tread);
    }
  }
  /* The landing lip that closes the flight against Pulse's measured face. */
  b.box("groundConcrete", cxm, (sSeat.bottom + g0 + st.totalRise) / 2,
    r.z1 + st.landing.depth / 2, w, g0 + st.totalRise - sSeat.bottom, st.landing.depth);

  /* Stainless pipe handrail on a mid-run standard. */
  const H = st.handrail;
  const hx = r.x1 - H.offset;
  for (let p = 0; p < H.posts; p++) {
    const t = p / (H.posts - 1);
    const z = r.z0 + 0.25 + t * (r.z1 - r.z0 - 0.5);
    const nose = g0 + Math.min(st.totalRise, ((z - r.z0) / st.tread) * st.riser);
    b.cyl("metal", hx, nose + H.height / 2, z, H.pipe / 2, H.height);
    counts.courtStairPosts++;
  }
  const rz0 = r.z0 + 0.25, rz1 = r.z1 - 0.25;
  const ry0 = g0 + ((rz0 - r.z0) / st.tread) * st.riser + H.height;
  const ry1 = g0 + Math.min(st.totalRise, ((rz1 - r.z0) / st.tread) * st.riser) + H.height;
  const rl = Math.hypot(rz1 - rz0, ry1 - ry0);
  b.cyl("metal", hx, (ry0 + ry1) / 2, (rz0 + rz1) / 2, H.pipe / 2, rl,
    0, Math.PI / 2 - Math.atan2(ry1 - ry0, rz1 - rz0), 0);

  /* The low seat wall run beside the stair. */
  const sw = S.seatWall, sr = sw.rect;
  const swx = (sr.x0 + sr.x1) / 2, swz = (sr.z0 + sr.z1) / 2;
  const sg = ground(swx, swz);
  b.box("boardConcrete", swx, sg + (sw.height - sw.chamfer) / 2, swz,
    sr.x1 - sr.x0, sw.height - sw.chamfer, sr.z1 - sr.z0);
  b.box("boardConcrete", swx, sg + sw.height - sw.chamfer / 2, swz,
    sr.x1 - sr.x0 - 0.06, sw.chamfer, sr.z1 - sr.z0 - 0.06);
}

/* ------------------------------------------------------- the BBQ terrace --- */

function buildBbq(sec, b, group, ground, counts) {
  const B = sec.bbq, C = sec.colors;
  const F = sec.measured.bbqTerrace.frame;
  const c = Math.cos(F.rotY), s = Math.sin(F.rotY);
  const W = (u, v) => [F.origin[0] + u * c + v * s, F.origin[1] - u * s + v * c];
  const R = F.rotY;
  /* WHAT THIS TERRACE STANDS ON IS A DECAL, NOT THE TERRAIN. The whole of
     courtyard-2375 is covered by the paver decal on the `pad` rung and the
     turf rug on `carpet` above it, so the visible ground under every chair,
     table, planter, canopy base plate and stair is that decal's plane. Round
     one returned the raw terrain here, which stood 194 solids 90 mm INSIDE
     the surface they are drawn as standing on. `at` now returns the plane the
     thing at (u, v) actually bears on; anything that skirts DOWN into the
     terrain (a casting's buried face) still takes the raw ground, which is why
     `seat`/`seatPoints` keep returning two numbers. */
  const ring = sec.measured.bbqTerrace.ring2375;
  const TU = B.turf;
  const onTurf = (u, v) => u >= TU.u0 && u <= TU.u1 && v >= TU.v0 && v <= TU.v1;
  const pave = (u, v, x, z) => (onTurf(u, v) ? LIFT_CARPET
    : (inPoly(x, z, ring) ? LIFT_PAD : 0));
  const at = (u, v) => {
    const [x, z] = W(u, v);
    return [x, z, ground(x, z) + pave(u, v, x, z)];
  };

  /* Running-bond unit pavers over the surveyed terrace. */
  const pav = polyDecal(sec.measured.bbqTerrace.ring2375, "paverGrey", C.paverGrey, PAD, ground,
    [30 / B.paving.module[1], 30 / B.paving.module[0]]);
  if (pav) { pav.name = "bbq-paving"; group.add(pav); counts.decals++; }

  /* arcgis.ground#2369 IS THE SUN LAWN, so nothing paved is drawn on it here.
     This block used to lay an angular concrete plate mosaic and a checker
     infill over that ring. Arbitrated away 2026-08-19: arcgis.ground[3632]
     hole 176 punches #2369 out of the campus paved-surface survey as an exact
     7-vertex, 351.6 m2 match, the SDAF 2025 plan prints "The Sun Lawn" inside
     it, and ESRI ortho shows uniform mown turf edge to edge. The mosaic is
     real (SWA -12) but has no registered extent; it is declared in `absent`.
     The terrace's own running-bond pavers above are on #2375 and stay. */

  /* The artificial turf inset rug. */
  const T = B.turf;
  const turfPoly = [[T.u0, T.v0], [T.u1, T.v0], [T.u1, T.v1], [T.u0, T.v1]].map(([u, v]) => W(u, v));
  const turf = polyDecal(turfPoly, "turfPanel", C.turfPanel, CARPET, ground, 12);
  if (turf) { turf.name = "bbq-turf"; group.add(turf); counts.decals++; }

  /* --- the grill counter: body, overhanging top, splashback, end piers --- */
  const G = B.grill, ct = G.counter;
  let [x, z, g] = at(ct.u, ct.v);
  b.box("counter", x, g + (ct.h - ct.top) / 2, z, ct.w, ct.h - ct.top, ct.d, R);
  b.box("counter", x, g + ct.h - ct.top / 2, z, ct.w + ct.topProud * 2, ct.top, ct.d + ct.topProud * 2, R);
  [x, z, g] = at(ct.u, ct.v - ct.d / 2 - 0.05);
  b.box("counter", x, g + ct.h + ct.splashback / 2, z, ct.w, ct.splashback, 0.1, R);
  for (const side of [-1, 1]) {
    [x, z, g] = at(ct.u + side * (ct.w / 2 - ct.endPier / 2), ct.v);
    b.box("counter", x, g + ct.h / 2, z, ct.endPier, ct.h, ct.d + 0.05, R);
  }
  for (const bay of G.bays.list) {
    [x, z, g] = at(bay.u, bay.v);
    b.box("grillLid", x, g + G.bays.sill + G.bays.h / 2, z, G.bays.w, G.bays.h, G.bays.d, R);
    b.box("grillFascia", x, g + G.bays.sill - G.bays.fascia[1] / 2 - 0.02, z,
      G.bays.fascia[0], G.bays.fascia[1], G.bays.fascia[2], R);
    b.box("metal", x, g + G.bays.sill + G.bays.surround / 2, z,
      G.bays.w + 0.1, G.bays.surround, G.bays.d + 0.1, R);
    counts.grillBays++;
  }
  const EX = G.extinguisher;
  [x, z, g] = at(EX.u, EX.v);
  b.cyl("metal", x, g + EX.base[1] / 2, z, EX.base[0] / 2, EX.base[1]);
  b.cyl("metal", x, g + EX.postH / 2, z, EX.post / 2, EX.postH);
  b.box("extinguisher", x, g + EX.postH + EX.cabinet[1] / 2, z,
    EX.cabinet[0], EX.cabinet[1], EX.cabinet[2], R);

  /* --- the linear glass-fronted fire feature in its precast block wall --- */
  const FF = B.fire;
  const [fw, fh, fd] = FF.wall;
  for (let k = 0; k < FF.courses; k++) {
    const ch = k === FF.courses - 1 ? fh - k * FF.courseHeight : FF.courseHeight;
    [x, z, g] = at(FF.u, FF.v);
    const yc = g + k * FF.courseHeight + ch / 2;
    if (k === 1) {
      /* The firebox course: wall each side of the opening, not across it. */
      const side = (fw - FF.opening[0]) / 2;
      for (const sgn of [-1, 1]) {
        const [sx, sz] = W(FF.u + sgn * (fw - side) / 2, FF.v);
        b.box("fireWall", sx, yc, sz, side, ch, fd, R);
      }
      const [gx, gz] = W(FF.u, FF.v - fd / 2 + FF.glass / 2 + 0.01);
      b.box("fireGlass", gx, g + FF.sill + FF.opening[1] / 2, gz,
        FF.opening[0], FF.opening[1], FF.glass, R);
      b.box("metal", gx, g + FF.sill + FF.opening[1] / 2, gz,
        FF.opening[0] + FF.frame * 2, FF.opening[1] + FF.frame * 2, FF.frame, R);
      for (let m = 0; m < FF.media; m++) {
        const lu = (hash(sec.seed, m, 31) - 0.5) * (FF.opening[0] - 0.2);
        const lv = (hash(sec.seed, m, 32) - 0.5) * (fd - 0.24);
        const [mxw, mzw] = W(FF.u + lu, FF.v + lv);
        const r = 0.05 + hash(sec.seed, m, 33) * 0.05;
        b.blob("lavaMedia", mxw, g + FF.sill + r * 0.7, mzw, r * 2, r * 1.4, r * 2,
          hash(sec.seed, m, 34) * Math.PI);
      }
      /* The lintel over the opening, spanning the firebox. */
      b.box("fireWall", x, g + FF.sill + FF.opening[1] + (ch - FF.opening[1] - (FF.sill - FF.courseHeight)) / 2,
        z, FF.opening[0], Math.max(0.04, ch - FF.opening[1] - (FF.sill - FF.courseHeight)), fd, R);
    } else {
      b.box("fireWall", x, yc, z, fw, ch, fd, R);
    }
  }

  /* --- seating and tables --- */
  const AD = B.adirondack.product;
  /**
   * The named product: 0.79 x 0.86 x 0.94 m, seat 0.38, 25 deg back rake, 7
   * back slats, 5 seat slats, wide flat arms. `chairLocal` turns a chair-local
   * offset into a world point, so the chair rotates as one object.
   */
  const AD_SLATS = AD.seatSlats;
  const adirondack = (u, v, rot) => {
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const L = (lu, lv) => W(u + lu * cr + lv * sr, v - lu * sr + lv * cr);
    const [, , ag] = at(u, v);
    const rr = R + rot;
    for (let k = 0; k < AD_SLATS; k++) {
      const lv = -AD.d * 0.36 + (AD.d * 0.72 * (k + 0.5)) / AD_SLATS;
      const [px, pz] = L(0, lv);
      b.box("adirondack", px, ag + AD.seat + lv * 0.09, pz,
        AD.w, 0.032, (AD.d * 0.72) / AD_SLATS - 0.02, rr);
    }
    for (let k = 0; k < AD.backSlats; k++) {
      const f = (k + 0.5) / AD.backSlats;
      const hgt = AD.seat + 0.06 + f * (AD.h - AD.seat - 0.06);
      const lv = -(AD.d / 2 - 0.1) - Math.sin(AD.rake) * f * 0.34;
      const [px, pz] = L(0, lv);
      b.box("adirondack", px, ag + hgt, pz, AD.w, 0.065, 0.03, rr, -AD.rake);
    }
    for (const side of [-1, 1]) {
      const [px, pz] = L(side * AD.w / 2, 0.02);
      b.box("adirondack", px, ag + AD.seat + 0.2, pz, AD.arm, 0.04, AD.d * 0.6, rr);
      const [fx, fz] = L(side * AD.w / 2, AD.d * 0.3);
      b.box("adirondack", fx, ag + (AD.seat + 0.2) / 2, fz, 0.05, AD.seat + 0.2, 0.05, rr);
      const [bx, bz] = L(side * AD.w / 2, -AD.d * 0.34);
      b.box("adirondack", bx, ag + AD.seat / 2, bz, 0.05, AD.seat, 0.05, rr);
    }
    counts.adirondacks++;
  };
  for (const a of B.adirondack.aroundFire) adirondack(a.u, a.v, a.rot);
  for (const a of B.adirondack.onTurf) adirondack(a.u, a.v, a.rot);

  for (const t of B.drinkTables.list) {
    const [tx2, tz2, tg] = at(t.u, t.v);
    const D = B.drinkTables;
    b.cyl("planterCharcoal", tx2, tg + 0.015, tz2, D.foot / 2, 0.03);
    b.cyl("planterCharcoal", tx2, tg + D.height / 2, tz2, D.waist / 2, D.height);
    b.cyl("planterCharcoal", tx2, tg + D.height - 0.02, tz2, D.top / 2, 0.04);
    counts.drinkTables++;
  }
  /** A slatted seat and back on four legs — the two chair populations. */
  const slatChair = (role, o, S2, seatSlats) => {
    const rot = o.rot || 0;
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const L = (lu, lv) => W(o.u + lu * cr + lv * sr, o.v - lu * sr + lv * cr);
    const [, , sg] = at(o.u, o.v);
    const rr = R + rot;
    for (let k = 0; k < seatSlats; k++) {
      const lv = -S2.d / 2 + (S2.d * (k + 0.5)) / seatSlats;
      const [px, pz] = L(0, lv);
      b.box(role, px, sg + S2.seat, pz, S2.w, 0.03, S2.d / seatSlats - 0.02, rr);
    }
    const [bx, bz] = L(0, -S2.d / 2 + 0.04);
    for (let k = 0; k < S2.slats; k++) {
      const f = (k + 0.5) / S2.slats;
      b.box(role, bx, sg + S2.seat + 0.04 + f * (S2.h - S2.seat - 0.04), bz,
        S2.w, 0.03, 0.025, rr);
    }
    for (const [du, dv] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const [px, pz] = L(du * (S2.w / 2 - 0.04), dv * (S2.d / 2 - 0.04));
      /* The two back legs run the full height — they ARE the back frame the
         slats are welded to, which is what stops the back floating. */
      const h = dv < 0 ? S2.h : S2.seat;
      b.box(role, px, sg + h / 2, pz, 0.028, h, 0.028, rr);
    }
  };
  for (const o of B.wireChairs.list) { slatChair("wireChair", o, B.wireChairs, 5); counts.wireChairs++; }
  for (const o of B.sageChairs.list) { slatChair("cafeChair", o, { ...B.sageChairs, slats: 4 }, 4); counts.sageChairs++; }
  for (const t of B.cafeTables.list) {
    const [tx2, tz2, tg] = at(t.u, t.v);
    const D = B.cafeTables;
    b.cyl("tableLeg", tx2, tg + 0.02, tz2, D.foot / 2, 0.04);
    b.cyl("tableLeg", tx2, tg + D.height / 2, tz2, D.stem / 2, D.height);
    b.cyl("tableTop", tx2, tg + D.height - 0.02, tz2, D.top / 2, 0.05);
    counts.cafeTables++;
  }
  for (const t of B.picnicTables.list) {
    const [tx2, tz2, tg] = at(t.u, t.v);
    const P = B.picnicTables;
    b.box("tableTop", tx2, tg + P.h - P.top / 2, tz2, P.w, P.top, P.d, R);
    for (const side of [-1, 1]) {
      const [px, pz] = W(t.u + side * (P.w / 2 - 0.22), t.v);
      for (const tilt of [-0.2, 0.2]) {
        b.box("tableLeg", px, tg + (P.h - P.top) / 2, pz, P.leg, P.h - P.top, P.leg, R, 0, tilt);
      }
      b.box("tableLeg", px, tg + 0.32, pz, P.leg * 0.7, P.leg * 0.7, P.d - 0.14, R);
    }
    counts.picnicTables++;
  }
  for (const o of B.plankBenches.list) {
    const [px, pz, pg] = at(o.u, o.v);
    const P = B.plankBenches;
    b.box("counter", px, pg + P.h - 0.06, pz, P.w, 0.12, P.d, R + o.rot);
    for (const side of [-1, 1]) {
      const [qx, qz] = W(o.u + Math.cos(o.rot) * side * (P.w / 2 - 0.3),
        o.v - Math.sin(o.rot) * side * (P.w / 2 - 0.3));
      b.box("counter", qx, pg + (P.h - 0.12) / 2, qz, 0.14, P.h - 0.12, P.d - 0.06, R + o.rot);
    }
    counts.plankBenches++;
  }

  /* Conical precast planters — empty, by the tree rule. */
  const CP = B.conicalPlanters;
  for (const o of CP.list) {
    const [px, pz, pg] = at(o.u, o.v);
    b.taper("conePlanter", px, pg + CP.height / 2, pz, CP.topDia / 2, CP.baseDia / 2, CP.height);
    const inner = CP.topDia / 2 - CP.wall;
    b.cyl("barkMulch", px, pg + CP.height - CP.soilDrop, pz, inner, 0.06);
    counts.conicalPlanters++;
  }

  /* The shade canopy, with real framing. */
  const CN = B.canopy;
  const postTop = CN.clear;
  for (const [du, dv] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const [px, pz, pg] = at(CN.u + du * (CN.w / 2 - 0.3), CN.v + dv * (CN.d / 2 - 0.3));
    b.box("canopyPost", px, pg + CN.basePlate[1] / 2, pz, CN.basePlate[0], CN.basePlate[1], CN.basePlate[0], R);
    b.box("canopyPost", px, pg + postTop / 2, pz, CN.post, postTop, CN.post, R);
  }
  const [cnx, cnz, cng] = at(CN.u, CN.v);
  /* Two primary beams across the posts, five purlins over them, then the deck
     — the deck falls along local +u, so everything on it follows that fall. */
  const deckY = cng + postTop + CN.beam[1] + CN.purlin[1] + CN.deck / 2;
  const fall = (du) => du * Math.sin(CN.pitch);
  for (const dv of [-1, 1]) {
    const [px, pz] = W(CN.u, CN.v + dv * (CN.d / 2 - 0.3));
    b.box("canopyDeck", px, cng + postTop + CN.beam[1] / 2, pz,
      CN.w - 0.2, CN.beam[1], CN.beam[0], R);
  }
  for (let i = 0; i < CN.purlins; i++) {
    const f = (i + 0.5) / CN.purlins;
    const du = -CN.w / 2 + f * CN.w;
    const [px, pz] = W(CN.u + du, CN.v);
    b.box("canopyDeck", px, cng + postTop + CN.beam[1] + CN.purlin[1] / 2 + fall(du) * 0.5, pz,
      CN.purlin[0], CN.purlin[1], CN.d - 0.1, R);
  }
  b.box("canopyDeck", cnx, deckY, cnz, CN.w, CN.deck, CN.d, R, 0, CN.pitch);
  for (const [du, dv, w, d] of [
    [0, -CN.d / 2, CN.w, CN.fascia[0]], [0, CN.d / 2, CN.w, CN.fascia[0]],
    [-CN.w / 2, 0, CN.fascia[0], CN.d], [CN.w / 2, 0, CN.fascia[0], CN.d],
  ]) {
    const [px, pz] = W(CN.u + du, CN.v + dv);
    b.box("canopyDeck", px, deckY + fall(du), pz, w, CN.fascia[1], d, R, 0, CN.pitch);
  }

  /* The service enclosure: four real walls, coping, door, louvre — and the
     eucalyptus mural on its terrace face. */
  const EN = B.enclosure;
  const [enx, enz, eng] = at(EN.u, EN.v);
  for (const [du, dv, w, d] of [
    [0, -EN.d / 2 + EN.wall / 2, EN.w, EN.wall], [0, EN.d / 2 - EN.wall / 2, EN.w, EN.wall],
    [-EN.w / 2 + EN.wall / 2, 0, EN.wall, EN.d - EN.wall * 2],
    [EN.w / 2 - EN.wall / 2, 0, EN.wall, EN.d - EN.wall * 2],
  ]) {
    const [px, pz] = W(EN.u + du, EN.v + dv);
    b.box("stucco", px, eng + EN.h / 2, pz, w, EN.h, d, R);
  }
  b.box("groundConcrete", enx, eng + EN.h + EN.coping[0] / 2, enz,
    EN.w + EN.coping[1] * 0.5, EN.coping[0], EN.d + EN.coping[1] * 0.5, R);
  const [dx2, dz2] = W(EN.u + EN.w / 4, EN.v - EN.d / 2);
  b.box("metal", dx2, eng + EN.door[1] / 2, dz2, EN.door[0], EN.door[1], 0.06, R);
  const [lx2, lz2] = W(EN.u - EN.w / 3, EN.v - EN.d / 2);
  for (let k = 0; k < EN.louvreBlades; k++) {
    b.box("metal", lx2, eng + 1.6 + (k / EN.louvreBlades) * EN.louvre[1], lz2,
      EN.louvre[0], 0.035, 0.05, R, -0.5);
  }
  const MU = B.mural;
  const [mux, muz] = W(EN.u, EN.v - EN.d / 2 - 0.03);
  b.box("muralBlue", mux, eng + MU.sill + MU.h / 2, muz, MU.w, MU.h, 0.04, R);
  for (let k = 0; k < MU.branches; k++) {
    const bu = -MU.w / 2 + MU.w * (k + 0.5) / MU.branches;
    const lean = (hash(sec.seed, k, 41) - 0.5) * 0.7;
    const len = MU.h * (0.6 + hash(sec.seed, k, 42) * 0.35);
    const [px, pz] = W(EN.u + bu, EN.v - EN.d / 2 - 0.05);
    b.box("muralPale", px, eng + MU.sill + len / 2 + 0.1, pz, 0.05, len, MU.relief, R, 0, lean);
    counts.muralBranches++;
  }
  for (let k = 0; k < MU.leaves; k++) {
    const bu = (hash(sec.seed, k, 43) - 0.5) * (MU.w - 0.3);
    const bv = 0.2 + hash(sec.seed, k, 44) * (MU.h - 0.4);
    const [px, pz] = W(EN.u + bu, EN.v - EN.d / 2 - 0.06);
    b.blob("muralPale", px, eng + MU.sill + bv, pz, 0.09, 0.24, MU.relief * 1.5,
      hash(sec.seed, k, 45) * Math.PI);
    counts.muralLeaves++;
  }

  /* The terrace stair — with its landing and the landing's retaining faces,
     because the drawn ground under Eighth has no upper level to arrive at. */
  const ST = B.stair;
  const stw = ST.v1 - ST.v0, stc = (ST.v0 + ST.v1) / 2;
  const tSeat = seatPoints([
    [ST.u0, ST.v0], [ST.landing.u1, ST.v0],
    [ST.landing.u1, ST.v1], [ST.u0, ST.v1], [ST.u0, stc], [ST.landing.u1, stc],
  ].map(([u, v]) => W(u, v)), ground);
  /* The flight stands ON the pavers and skirts DOWN to the terrain, so its top
     datum is the decal plane and its bottom datum is the raw ground. */
  const stg = tSeat.top + LIFT_PAD;
  for (let i = 0; i < ST.risers; i++) {
    const [px, pz] = W(ST.u0 + (i + 0.5) * ST.tread, stc);
    const top = stg + (i + 1) * ST.riser;
    b.box("groundConcrete", px, (tSeat.bottom + top) / 2, pz,
      ST.tread, top - tSeat.bottom, stw, R);
    counts.terraceStairTreads++;
  }
  const rise = ST.risers * ST.riser;
  const ldD = ST.landing.u1 - ST.landing.u0;
  /* The landing is a core INSET BEHIND its three exposed board-formed faces,
     which are the thing you see and which run down to the drawn ground — a
     stair that climbs to nothing is the failure this guards. `retain` is the
     flag that turns the faces on and `retainThickness` is how thick they cast;
     with the faces off the core runs the whole footprint instead, so the
     landing is never a slab standing on nothing. Round one drew the faces
     inside a core that already ran the full footprint, which was three solids
     of pure interpenetration. */
  const lu = (ST.landing.u0 + ST.landing.u1) / 2;
  const lt = ST.landing.retain ? ST.landing.retainThickness : 0;
  const lH = stg + rise - tSeat.bottom, lY = (tSeat.bottom + stg + rise) / 2;
  const [lpx, lpz] = W(lu - lt / 2, stc);
  b.box("groundConcrete", lpx, lY, lpz, ldD - lt, lH, stw - lt * 2, R);
  if (lt > 0) {
    for (const [du, dv, w, d] of [
      [(ldD - lt) / 2, 0, lt, stw],
      [-lt / 2, -(stw - lt) / 2, ldD - lt, lt],
      [-lt / 2, (stw - lt) / 2, ldD - lt, lt],
    ]) {
      const [px, pz] = W(lu + du, stc + dv);
      b.box("boardConcrete", px, lY, pz, w, lH, d, R);
    }
  }
  const SH = ST.handrail;
  for (let p = 0; p < SH.posts; p++) {
    const t = p / (SH.posts - 1);
    const u = ST.u0 + 0.2 + t * (ST.landing.u1 - ST.u0 - 0.4);
    const [px, pz] = W(u, ST.v1 - 0.25);
    const nose = stg + Math.min(rise, ((u - ST.u0) / ST.tread) * ST.riser);
    b.cyl("metal", px, nose + SH.height / 2, pz, SH.pipe / 2, SH.height);
  }
  const u0 = ST.u0 + 0.2, u1 = ST.landing.u1 - 0.2;
  const y0 = stg + SH.height, y1 = stg + rise + SH.height;
  const [rx0, rz0] = W((u0 + u1) / 2, ST.v1 - 0.25);
  /* The rail rises along local +u, so its axis lives in the local XY plane:
     rotZ = phi - pi/2 puts the cylinder's +Y onto (cos phi, sin phi, 0). */
  b.cyl("metal", rx0, (y0 + y1) / 2, rz0, SH.pipe / 2,
    Math.hypot(u1 - u0, y1 - y0), R, 0, Math.atan2(y1 - y0, u1 - u0) - Math.PI / 2);

  /* NO SITE LIGHTING, NO BIKE HOOPS, NO WHITE PLANTER CUBES HERE. All three
     families were hand-placed on this terrace at 0.5 m round local coordinates
     stamped `measured` with no derivation, and arbitration 2026-08-19 gave each
     to the owner that fitted it: eighthsiteworks owns the college's whole
     luminaire schedule (L1 at a fitted 5.75 m, L2 at 7.0 m, the 0.91 m bollard)
     and its bike-rack ranks, including `rack-swa4` on this same surveyed ring;
     the pale precast box this section read as a white cube is the RAMBLE's, at
     a measured 1.8 x 1.8 x 1.15 m. Each hand-over is declared in `absent`. */
}

/* ------------------------------------------------------------------ entry --- */

/**
 * Eighth College's gathering places. Returns `{ group, counts }`; the caller
 * parents the group so a layer toggle controls it. `surfaceAt` places anything
 * that stands on the ground (`heightAt` interpolates every LiDAR sample and the
 * drawn terrain uses every second one, so `heightAt` sits under the visible
 * ground). Missing section, missing height function: a quiet empty group, so an
 * invented overlay can never take the measured campus down with it.
 */
export function createPhotoEighthGathering(scene, { photo, heightAt, surfaceAt } = {}) {
  const group = new THREE.Group();
  group.name = "photo-eighth-gathering";
  const sec = photo?.eighthgathering;
  const ground = surfaceAt || heightAt;
  if (!sec || typeof ground !== "function") {
    scene?.add(group);
    return { group, counts: {} };
  }

  const counts = {
    pavilionDrums: 0, pavilionPanels: 0, pavilionBenches: 0, oculi: 0,
    soffitDownlights: 0, deckUplights: 0, roofSeams: 0, eaveBattens: 0,
    standingStones: 0, slabStones: 0, seatPods: 0,
    teaWallBattens: 0, teaRoofBattens: 0, teaShoeBlocks: 0,
    teaBoulders: 0, teaRushes: 0, teaAgaves: 0, teaRailPickets: 0,
    courtStairTreads: 0, courtStairPosts: 0,
    grillBays: 0, adirondacks: 0, drinkTables: 0, wireChairs: 0, sageChairs: 0,
    cafeTables: 0, picnicTables: 0, plankBenches: 0, conicalPlanters: 0,
    muralBranches: 0, muralLeaves: 0, terraceStairTreads: 0,
    decals: 0, solids: 0, draws: 0,
  };

  const b = batcher();
  buildMeditation(sec, b, group, ground, counts);
  buildTeaHouse(sec, b, group, ground, counts);
  buildCourtStair(sec, b, group, ground, counts);
  buildBbq(sec, b, group, ground, counts);

  counts.solids = b.count;
  b.build(group, sec.colors);
  counts.draws = group.children.length;

  scene?.add(group);
  return { group, counts };
}
