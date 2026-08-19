// Azad Hall (TDLLN "BLDG 2"), from photographs and the architect's drawings —
// the INVENTED class.
//
// HKS (design architect) + EYRC, Kitchell design-build, SWA landscape, 2021-23.
// NOT Safdie Rabines / OJB — that team did Sixth College. Azad is the
// nine-storey west bar of Eighth College and the only mass in the neighbourhood
// whose ring is orthogonal to the world grid; every other Eighth ring is
// rotated 20-30 degrees.
//
// Everything hangs off the DRAWN mass: the facilities (arcgis) ring
// campus-massing.js actually extrudes, carried VERBATIM in
// `measured.mass.ring`, with `measured.mass.h` = the GIS 27.4 m. NO LiDAR
// height is read anywhere, and none exists: campus-lidar.json massHeights has
// no entry for this mass, because the 2014 flight is blind to a 2023 building.
// The dressed datum solves on the SAME rule campus-massing.js uses (rim-median
// ground + h, lifted past a high corner), so the wall dressing sits on the
// visible wall; the parapet is dressed ABOVE the prism top, because the massing
// extrudes a SOLID box and a parapet solved inside it would simply be buried
// (the york lesson, running the other way).
//
// Five things decided the shape of this file:
//
//   1. THE STOREY GRID IS THE DRAWN PRISM READ BACK. 27.4 / 9 = 3.0444 m, and
//      the sourced 3.048 m floor-to-floor agrees to 0.12 percent — a
//      corroboration, not a conflict. Every vertical facade dimension is still
//      carried as a FRACTION of the storey (the argo lesson), so it rescales
//      with the anchor instead of floating off it.
//
//   2. THE WINDOW IS THE BUILDING. HKS "popped out and rotated windows six
//      degrees on the lower towers" for cross-ventilation; Azad is the lowest
//      tower, so it gets the rotated pop-out box and NOT the fins the taller
//      towers wear. Each box is a rotated open tube: the deep jamb comes
//      forward and is clad in amber metal with the head hood and the sill
//      soffit, and the shallow jamb sits flush in the panel plane. A flat
//      punched grid — which is what campus-eighth.json's style string still
//      claims — reproduces none of it.
//
//   3. LEVEL 1 IS A COLONNADE, NOT A WALL, AND IT HAS DOORS. Regents p.5 draws
//      round column symbols outside the enclosed line on BOTH long faces and the
//      built photographs confirm it. The drawn prism is solid and may not be
//      carved, so the 2.4 m colonnade depth is RECORDED in the data and read as
//      a near-black void behind columns standing 0.46 m proud, with a deep
//      soffit fascia where the eight residential floors oversail — the same
//      device campus-photo-argo.js uses for Argo's ground storey. Against that
//      void stands the real storefront az_base_47 resolves: three 0.80 m lights
//      under a rail at 1.58 m and a head at 2.52 m, one light per assembly a
//      glazed DOOR carrying a vertical pull at 0.87 m. (That pull height is what
//      pins the crop's scale — at any smaller ruler it sits at an impossible
//      height. The first build shipped one undivided matte box per bay, and a
//      building nobody could walk into.)
//
//   4. NOTHING MAY HOVER **AND NOTHING MAY INTERSECT** — one rule, two halves,
//      and the first build only had a gate for the first half. Anything laid on
//      the roof is CLIPPED to the ring rather than to its bounding box: the
//      mirrored 1.7 x 0.8 m niches at x = -184 are the live case, where the west
//      cross band spans z 608.7..620.8 and not the building's full
//      605.7..623.4, and `ringSpanAtX` is what makes that true rather than a
//      comment. The east PORCH is the same lesson in plan: its width is the
//      drawn length of the ONE face it backs onto, because taking it from the
//      ring's bounding box put a 17.7 m soffit across a wall that steps 1.25 m
//      at z = 613.2 and left it unsupported for 7.5 m. And every fitting that
//      stands on the ground is placed FACE-RELATIVE — a face, a distance along
//      it, a distance proud of it — so the test can sweep them all against each
//      other as oriented boxes. It found the hedge driven through seven
//      colonnade columns, the guardrail through a planter cube and the standpipe
//      buried in its own hedge; the perpendicular bands in `ground.bands` are
//      what keeps them apart now.
//
//   5. THE ROOF CARRIES NO PHOTOVOLTAICS. The 2021 renderings draw PV fields on
//      the low Eighth roofs; the built-epoch Apple 3D capture shows white
//      membrane, a grey walkway ring, one penthouse and scattered RTUs and no
//      array at all. Under the epoch rule the rendering loses — the Keeling
//      trap running the other way, and it is in `absent` with the frame named.
//
// The prism's LENGTH is a declared, unresolved source conflict: the drawn ring
// is 39.7 m where OSM says 51.1 m and the architect's own registered plan says
// 53.6 m. Re-cutting a measured mass is forbidden, so every facade system here
// is a metre MODULE that tiles whatever ring ships, and every bay count is the
// count of the short drawn building.
//
// Colours are DATA — every hex comes from the section's `colors` block, with a
// per-role provenance entry in `colorSources`. Surfaces come from the
// procedural material library (campus-materials.js); deterministic throughout —
// the only irregularity source is `hash`, seeded from the section.
//
// A NUMBER THIS FILE TYPES IS A DEFECT. Where a figure is a consequence of
// another figure it is COMPUTED here and does not appear in the data at all —
// the walkway's end trim is its own width, a drain's inset is the centre line of
// the band it stands on, the ladder's rung count is solved from the penthouse
// height at OSHA's 12-inch pitch, the guardrail's offset is the recorded
// colonnade band, the planting bed fills the strip the columns leave, picket
// centres are the canonical Eighth guard's MEASURED 0.1016 m (arbitrated
// 2026-08-19, owned by eighthsiteworks.systems.guardrail). The only bare
// constants below are MODELLING RESOLUTIONS (DRAPE_SEG, HEDGE_SEG), and each
// says which it is.
import * as THREE from "../vendor/three/three.module.min.js";
import { applyOverlayDepth, OVERLAY, overlayLift } from "./campus-overlay.js";
import { createMaterialLibrary } from "./campus-materials.js";

const CARPET = "carpet";
const PAINT = "paint";

/* Burnished CMU / linear brick: the library's brick class tiles 8 courses x 4
   units, so one repeat is one 1.624 m square of real wall at 8 in / 16 in. */
const BLOCK_TILE = 8 * 0.203;
/* The rainscreen panel class tiles a 6 x 6 joint grid. */
const PANEL_GRID = 6;

/* Modelling resolution, not a measurement — the length of one hedge box, the
   same kind of constant as DRAPE_SEG below. Small enough that interrupting the
   bed around a fitting leaves a gap the size of the fitting. */
const HEDGE_SEG = 0.8;
/* Planting clearance around a fitting standing in the bed. */
const HEDGE_CLEAR = 0.15;

let LIB = null;
const lib = () => (LIB ??= createMaterialLibrary(THREE));

const concrete = (color) => lib().get("smoothConcrete", { color });
const painted = (color) => lib().get("metalPanel", { color, metalness: 0.35, roughness: 0.55 });
const metalRib = (color) => lib().get("metalPanel", { color, standingSeam: true, metalness: 0.4, roughness: 0.5 });
const glassMat = (color) => lib().get("glass", { color });
const membrane = (color, repeat) => lib().get("roofMembrane", { color, repeat });
const blockMat = (color, w, h) =>
  lib().get("brick", { color, normalScale: 0.6, repeat: [w / BLOCK_TILE, h / BLOCK_TILE] });
/* The prefabricated rainscreen: a rectangular joint grid at the measured
   1.02 m panel width, two courses per storey (floor line + window head). */
const panelMat = (color, w, h, panelW, courseH) =>
  lib().get("pavingConcreteUnit", {
    color,
    normalScale: 0.45,
    roughness: 0.62,
    repeat: [w / (PANEL_GRID * panelW), h / (PANEL_GRID * courseH)],
  });
/* The Level-1 recess and the porch soffit shadow are a photographed near-black
   VOID, not glazing: fully matte, so image-based light cannot lift them into a
   pale screen (the argo audit's finding, same reasoning). */
const matte = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 1.0, metalness: 0.0, envMapIntensity: 0.15 });
const foliage = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0.0 });

function decal(color, rung, cls = "smoothConcrete", repeat) {
  return applyOverlayDepth(lib().get(cls, { color, repeat }), rung);
}

/** Deterministic 0..1 from any integer mix, seeded by the section. */
function makeHash(seed) {
  return (...ns) => {
    let s = seed % 9973;
    for (let i = 0; i < ns.length; i++) s = s * 131.71 + ns[i] * 57.13 + 7.9;
    const v = Math.sin(s) * 43758.5453;
    return v - Math.floor(v);
  };
}

/** One InstancedMesh from a list of placements (the keeling/york convention). */
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

/** Name an InstancedMesh so a failing gate can say WHICH family collided. */
function named(mesh, name) {
  mesh.name = name;
  return mesh;
}

/** A flat XZ quad lying in the ground plane. */
function quad(w, d) {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  return g;
}

/* One drape vertex every 2 m: a ground decal follows the DRAWN terrain instead
   of seating flat at its rect centre (the galbraith lesson). */
const DRAPE_SEG = 2;
function drapedDecal(cx, cz, w, d, ground, mat, rung, rot = 0) {
  const geo = new THREE.PlaneGeometry(w, d,
    Math.max(1, Math.ceil(w / DRAPE_SEG)), Math.max(1, Math.ceil(d / DRAPE_SEG)));
  geo.rotateX(-Math.PI / 2);
  const base = ground(cx, cz);
  const pos = geo.attributes.position;
  /* The mesh carries rotation.y = rot, so a local (lx, lz) lands at
     (cx + lx cos + lz sin, cz - lx sin + lz cos). The drape has to sample the
     terrain THERE, not at the unrotated point, or a rotated decal follows the
     wrong ridge. */
  const ca = Math.cos(rot);
  const sa = Math.sin(rot);
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const lz = pos.getZ(i);
    pos.setY(i, ground(cx + lx * ca + lz * sa, cz - lx * sa + lz * ca) - base);
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.y = rot;
  mesh.position.set(cx, base + overlayLift(rung), cz);
  mesh.renderOrder = OVERLAY[rung].renderOrder;
  mesh.name = "ground-decal";
  return mesh;
}

/**
 * A facade's own frame, built on the DRAWN edge the data names. `at(u, w, y)`
 * is u metres along the face from its start, w metres proud of it, y in world
 * height. A box rotated by `rot` has local +Z out of the face, +X along it.
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
  if ((ex - sx) * tx + (ez - sz) * tz < 0) { sx = bx; sz = bz; ex = ax; ez = az; }
  const length = Math.hypot(ex - sx, ez - sz);
  return {
    id: f.id,
    length,
    rot: Math.atan2(nx, nz),
    at: (u, w, y) => ({ x: sx + tx * u + nx * w, y, z: sz + tz * u + nz * w }),
  };
}

/**
 * Bay centres along a face. The count is the ROUNDED number of modules, not
 * the floored one: the drawn runs are 3.8-25.9 m and flooring a 25.9 m run at
 * the 3.74 m bay leaves 1.75 m of dead panel at each end, which the photograph
 * plainly does not show — the bedroom rhythm runs to the corner. Rounding keeps
 * the effective pitch inside 3.40-3.83 m against the measured 3.74 m.
 */
function bayCentres(length, module) {
  const n = Math.max(1, Math.round(length / module));
  const pad = (length - n * module) / 2;
  const out = [];
  for (let i = 0; i < n; i++) out.push({ i, u: pad + (i + 0.5) * module });
  return out;
}

/** Lowest DRAWN-terrain height along a face, sampled every 2 m at the wall.
    Base walls skirt down to this so no ground ever passes under the building —
    the site falls to the west and the west end needs the deepest skirt. */
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
 * The roof plate's z extent at a given x, read off the RING. This is the clip:
 * a band or a box drawn on the bounding box would hang past the wall wherever
 * the ring steps back — at the two mirrored niches it would hover 0.8 m at both
 * ends. Returns null where the ring has no roof at that x.
 */
function ringSpanAtX(ring, x) {
  let z0 = Infinity;
  let z1 = -Infinity;
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i];
    const [bx, bz] = ring[(i + 1) % ring.length];
    if (ax === bx) continue;
    const t = (x - ax) / (bx - ax);
    if (t < 0 || t > 1) continue;
    const z = az + (bz - az) * t;
    if (z < z0) z0 = z;
    if (z > z1) z1 = z;
  }
  return z1 > z0 ? [z0, z1] : null;
}

/** Ring vertices without the duplicated closing point. */
function openRing(ring) {
  const r = ring.slice();
  const a = r[0];
  const b = r[r.length - 1];
  if (a[0] === b[0] && a[1] === b[1]) r.pop();
  return r;
}

/* ------------------------------------------------------------ the window */

/**
 * One rotated pop-out window box. The assembly is an open tube rotated in plan
 * about the bay centre: the deep jamb comes forward (clad amber with the head
 * hood and the sill soffit) and the shallow jamb sits flush in the panel plane,
 * which is what the head hood's asymmetric overhang shows in phf47. `dir` is
 * the rotation sense; the section's `rotationMirrors` decides whether it
 * alternates (see the declared conflict — it does not, on the evidence there
 * is).
 */
function collectWindow(W, frame, u, y0, storeyH, dir, bins) {
  const openW = W.openingWidth;
  const openH = W.openingHeightFrac * storeyH;
  const sill = y0 + W.sillFrac * storeyH;
  const top = sill + openH;
  const D = W.boxDepth;
  const rb = W.revealBoard;
  const rot = frame.rot + dir * W.tilt;
  const ca = Math.cos(rot);
  const sa = Math.sin(rot);
  const o = frame.at(u, 0, 0);
  const put = (bin, du, dw, y, scale) =>
    bin.push({ x: o.x + du * ca + dw * sa, y, z: o.z - du * sa + dw * ca, rot, scale });

  /* Which jamb comes forward: rotating by +tilt swings the -X end outward. */
  const deep = -dir;

  put(bins.amber, 0, D / 2, top + rb / 2, [openW + 2 * rb, rb, D]);            // head hood
  put(bins.amber, 0, D / 2, sill - rb / 2, [openW + 2 * rb, rb, D]);           // sill soffit
  put(bins.amber, deep * (openW / 2 + rb / 2), D / 2, (sill + top) / 2, [rb, openH, D]);
  put(bins.frames, -deep * (openW / 2 + 0.03), 0.04, (sill + top) / 2, [0.06, openH, 0.08]);
  put(bins.glass, 0, D, (sill + top) / 2, [openW - 0.06, openH - 0.06, 1]);
  put(bins.frames, openW * (0.5 - W.operableLeafFrac), D + 0.012, (sill + top) / 2,
    [W.mullion, openH - 0.04, 0.05]);
  return { sill, top };
}

/** A flat glazed opening with an amber head and sill — the west lounge window
    and the east core's corridor glazing. No rotation: only the bedroom bay is
    a pop-out box, and nothing here invents one. */
function collectFlatWindow(W, frame, u, y0, storeyH, width, heightFrac, bins, ambered) {
  const openH = heightFrac * storeyH;
  const sill = y0 + W.sillFrac * storeyH;
  const top = sill + openH;
  const rb = W.revealBoard;
  const { rot } = frame;
  bins.glass.push({ ...frame.at(u, 0.05, (sill + top) / 2), rot, scale: [width, openH, 1] });
  bins.frames.push({ ...frame.at(u, 0.06, (sill + top) / 2), rot, scale: [W.mullion, openH, 0.06] });
  if (ambered) {
    bins.amber.push({ ...frame.at(u, 0.06, top + rb / 2), rot, scale: [width + 2 * rb, rb, 0.14] });
    bins.amber.push({ ...frame.at(u, 0.06, sill - rb / 2), rot, scale: [width + 2 * rb, rb, 0.14] });
  }
  return { sill, top };
}

/**
 * One Level-1 storefront assembly, centred on a colonnade bay.
 *
 * az_base_47 resolves this directly and it is NOT one undivided dark plane:
 * three near-equal lights under a continuous horizontal rail, in a dark
 * aluminium frame, and ONE light per assembly is a glazed DOOR carrying a
 * vertical pull at 0.87 m — which is the handle height that pins the crop's
 * scale. `sillY` is the Level-1 floor; the near-black matte recess stays as the
 * BACKING behind the glass, which is what the photographs read.
 */
function collectStorefront(section, frame, u, sillY, isDoor, bins) {
  const S = section.storefront;
  const C = section.colonnade;
  const { rot } = frame;
  const wallW = C.baseWallStandoff + 0.05;        // the storefront glass line
  const asmW = S.lights * S.lightWidth;
  const headY = sillY + S.headHeight;
  const railY = sillY + S.railHeight;
  const m = S.mullion;

  /* The shadowed colonnade recess the glass is read against. */
  bins.storefront.push({
    ...frame.at(u, wallW - 0.02, (sillY + headY) / 2),
    rot,
    scale: [asmW, headY - sillY, 1],
  });

  /* Lights: each split by the continuous rail into a lower and an upper pane. */
  const lightGlass = S.lightWidth - m;
  for (let i = 0; i < S.lights; i++) {
    const du = (i + 0.5) * S.lightWidth - asmW / 2;
    for (const [y0, y1] of [[sillY + m / 2, railY - m / 2], [railY + m / 2, headY - m / 2]]) {
      bins.sfGlass.push({
        ...frame.at(u + du, wallW + 0.02, (y0 + y1) / 2),
        rot,
        scale: [lightGlass, y1 - y0, 1],
      });
    }
  }
  /* Frame: jambs and mullions, head, rail, sill. */
  for (let i = 0; i <= S.lights; i++) {
    bins.sfFrames.push({
      ...frame.at(u + i * S.lightWidth - asmW / 2, wallW + 0.03, (sillY + headY) / 2),
      rot,
      scale: [m, headY - sillY, 0.07],
    });
  }
  for (const y of [sillY + m / 2, railY, headY - m / 2]) {
    bins.sfFrames.push({
      ...frame.at(u, wallW + 0.03, y),
      rot,
      scale: [asmW, m, 0.07],
    });
  }
  if (isDoor) {
    /* The leaf is the light at the assembly's start end — the one phf47 shows
       the pull on. The pull stands proud of the leaf, on its opening edge. */
    const leafU = u + 0.5 * S.lightWidth - asmW / 2;
    const P = S.pull;
    bins.doorPulls.push({
      ...frame.at(leafU + lightGlass / 2 - P.diameter, wallW + 0.06, sillY + P.height),
      rot,
      scale: [P.diameter, P.length, P.diameter],
    });
    bins.counts.doors++;
  }
}

/* ----------------------------------------------------------- the facades */

function collectFace(section, f, frame, ctx, bins) {
  const { roofY, baseY, storeyH, ground } = ctx;
  const P = section.panel;
  const W = section.window;
  const C = section.colonnade;
  const G = section.grid;
  const { rot, length } = frame;
  const floors = G.residentialFloors;
  const level1Top = baseY + storeyH;
  const gmin = groundMinAlong(frame, ground) - 0.5;

  /* The prefabricated panel field: one surface per face over all eight
     residential storeys, so the joint grid rides at its true 1.02 m module. */
  bins.panels.push({
    w: length,
    h: roofY - level1Top,
    ...frame.at(length / 2, P.standoff, (level1Top + roofY) / 2),
    rot,
  });

  /* Level 1. Long faces are the COLONNADE; every other face is the base wall,
     skirted past the drawn terrain so no ground passes under the building. */
  const wallTop = f.colonnade ? level1Top - C.soffitFascia : level1Top;
  bins.baseWalls.push({
    w: length,
    h: wallTop - gmin,
    ...frame.at(length / 2, C.baseWallStandoff, (wallTop + gmin) / 2),
    rot,
  });

  if (f.colonnade) {
    const bays = bayCentres(length, C.columnSpacing);
    /* One entry door per drawn colonnade face, at its centre bay — the
       [estimated] cadence the section declares. */
    const doorBay = Math.floor((bays.length - 1) / 2);
    for (const bay of bays) {
      /* Tall dark-framed storefront, three lights and a rail, between the
         burnished-block piers — az_base_47 resolves it and one light is a
         door. Its sill is the Level-1 FLOOR (the raised terrace the base wall
         skirts down from), not the lowest terrain along the face. */
      collectStorefront(section, frame, bay.u, baseY, bay.i === doorBay, bins);
      /* Round exposed-concrete column, from ITS OWN drawn surface to the
         fascia — the site rolls, and a shared foot would float. */
      const p = frame.at(bay.u, C.columnProud + C.columnDiameter / 2, 0);
      const g = ground(p.x, p.z);
      const foot = (Number.isFinite(g) ? g : baseY) - 0.15;
      bins.columns.push({
        x: p.x, y: (foot + wallTop) / 2, z: p.z,
        scale: [C.columnDiameter / 2, wallTop - foot, C.columnDiameter / 2],
      });
      /* Recessed downlight in the flat concrete soffit. */
      bins.downlights.push({
        ...frame.at(bay.u, C.columnProud * 0.55, level1Top - C.soffitFascia - 0.04),
        rot: 0,
      });
    }
    /* In-ground uplights stand in the OPEN paving BETWEEN the columns, on the
       column centre line — phf47 shows them in the paving, and the first build
       put them at the column feet 1.42 m proud, inside the planting bed. One at
       every second bay gap, so a fitting is never nearer a shaft than half a
       column spacing. */
    for (let i = 0; i + 1 < bays.length; i += 2) {
      const q = frame.at((bays[i].u + bays[i + 1].u) / 2,
        C.columnProud + C.columnDiameter / 2, 0);
      const gq = ground(q.x, q.z);
      if (Number.isFinite(gq)) bins.uplights.push({ x: q.x, y: gq, z: q.z });
    }
    /* The deep soffit fascia where the eight residential floors oversail. */
    const reach = C.columnProud + C.columnDiameter + 0.25;
    bins.soffits.push({
      ...frame.at(length / 2, reach / 2, level1Top - C.soffitFascia / 2),
      rot,
      scale: [length, C.soffitFascia, reach],
    });
  } else if (f.system === "coreFace") {
    /* The glazed lobby line under the entry porch. */
    bins.lobby.push({
      ...frame.at(length / 2, C.baseWallStandoff + 0.05, (gmin + 0.6 + level1Top - 0.5) / 2),
      rot,
      scale: [length * 0.62, level1Top - 0.5 - (gmin + 0.6), 1],
    });
  }

  /* The residential storeys. */
  for (let s = 0; s < floors; s++) {
    const y0 = level1Top + s * storeyH;
    if (f.system === "longFace") {
      const bays = bayCentres(length, G.bay);
      for (const bay of bays) {
        const dir = W.rotationMirrors && bay.i % 2 === 1 ? -1 : 1;
        collectWindow(W, frame, bay.u, y0, storeyH, dir, bins);
        bins.counts.popouts++;
      }
    } else if (f.system === "endFace") {
      if (f.westRole === "lounge") {
        collectFlatWindow(W, frame, length / 2, y0, storeyH,
          section.westEnd.loungeWindowWidth, W.openingHeightFrac, bins, true);
        bins.counts.lounge++;
      } else {
        collectWindow(W, frame, length / 2, y0, storeyH, 1, bins);
        bins.counts.popouts++;
      }
    } else if (f.system === "coreFace") {
      const E = section.eastCore;
      collectFlatWindow(W, frame, length / 2, y0, storeyH,
        E.corridorWindowWidth, E.corridorWindowHeightFrac, bins, false);
      bins.counts.corridor++;
    }
  }

  /* The stair core reads as one continuous glazed slot, floor to parapet. */
  if (f.system === "coreFace") {
    const E = section.eastCore;
    bins.glass.push({
      ...frame.at(E.stairSlotInset, 0.05, (level1Top + roofY) / 2),
      rot,
      scale: [E.stairSlotWidth, roofY - level1Top - 0.2, 1],
    });
    bins.counts.stairSlots++;
  }
}

/* -------------------------------------------------------------- the roof */

function buildRoof(section, group, ctx, bins) {
  const R = section.roof;
  const { colors } = section;
  const { roofY, ring } = ctx;
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const gr = new THREE.Group();
  gr.name = "azad-roof";

  /* White single-ply membrane over the WHOLE drawn plate — a Shape built from
     the ring itself, so it cannot overrun a notch the way a bbox quad does. */
  const shape = new THREE.Shape();
  ring.forEach(([x, z], i) => (i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)));
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  /* (x, -z) then -90 about X puts the plate in the world XZ plane with its
     normal UP; the naive (x, z) + (+90) lands in the right place with the
     normal pointing down and the membrane invisible from above. */
  geo.rotateX(-Math.PI / 2);
  const xs = ring.map((p) => p[0]);
  const zs = ring.map((p) => p[1]);
  const spanX = Math.max(...xs) - Math.min(...xs);
  const spanZ = Math.max(...zs) - Math.min(...zs);
  const memb = new THREE.Mesh(geo, membrane(colors.roofMembrane, [spanX / 12, spanZ / 12]));
  memb.position.y = roofY + 0.02;
  memb.receiveShadow = true;
  memb.name = "roof-membrane";
  gr.add(memb);

  /* Parapet and coping, per DRAWN face, so they mitre round every notch. */
  const par = [];
  const cop = [];
  const P = R.parapet;
  for (const f of section.facades) {
    const fr = frameOf(f);
    par.push({
      ...fr.at(fr.length / 2, 0, roofY + P.height / 2),
      rot: fr.rot,
      scale: [fr.length, P.height, P.thickness],
    });
    cop.push({
      ...fr.at(fr.length / 2, 0, roofY + P.height + P.coping / 2),
      rot: fr.rot,
      scale: [fr.length, P.coping, P.thickness + 2 * P.copingOverhang],
    });
  }
  gr.add(instanced(unit, concrete(colors.roofMembrane), par));
  gr.add(instanced(unit, painted(colors.copingMetal), cop));
  bins.counts.parapetRuns = par.length;

  /* Grey protection-mat walkway: a band just inside the parapet on every face
     long enough to carry one, trimmed at both ends so a band can never poke
     out through the adjacent face at a concave corner. */
  const Wk = R.walkway;
  /* The trim is the band's OWN width — the smallest pull-back that guarantees a
     band cannot poke out through the adjacent face at a concave corner, whatever
     the corner angle. It is read from `width`, never typed beside it. */
  const trim = Wk.width;
  const walk = [];
  for (const f of section.facades) {
    const fr = frameOf(f);
    const run = fr.length - 2 * trim;
    if (run <= 0.4) continue;
    walk.push({
      ...fr.at(fr.length / 2, -(P.thickness / 2 + Wk.width / 2), roofY + 0.05),
      rot: fr.rot,
      scale: [run, 0.04, Wk.width],
    });
  }
  /* Cross bands, CLIPPED to the ring's own span at their x. */
  const cross = [];
  for (const band of Wk.crossBands) {
    const span = ringSpanAtX(ring, band.x);
    if (!span) continue;
    const z0 = span[0] + Wk.width;
    const z1 = span[1] - Wk.width;
    if (z1 - z0 < 0.5) continue;
    cross.push({
      x: band.x, y: roofY + 0.05, z: (z0 + z1) / 2,
      scale: [Wk.width, 0.04, z1 - z0],
    });
  }
  gr.add(instanced(unit, concrete(colors.roofWalkway), [...walk, ...cross]));
  bins.counts.walkwayBands = walk.length;
  bins.counts.crossBands = cross.length;
  bins.roofFootprints.push(
    ...walk.map((w) => ({ x: w.x, z: w.z, w: w.scale[0], d: w.scale[2], rot: w.rot })),
    ...cross.map((c) => ({ x: c.x, z: c.z, w: c.scale[0], d: c.scale[2], rot: 0 }))
  );

  /* The lift-overrun / stair-bulkhead penthouse at the east third, seated on
     the membrane and centred in the ring's own span at its x. */
  const H = R.penthouse;
  const span = ringSpanAtX(ring, H.x);
  const pz = span ? (span[0] + span[1]) / 2 : 0;
  const pent = new THREE.Mesh(
    new THREE.BoxGeometry(H.size[0], H.size[1], H.size[2]),
    panelMat(colors.penthouseWhite, H.size[0], H.size[1], section.panel.width, 1.5)
  );
  pent.position.set(H.x, roofY + H.size[1] / 2, pz);
  pent.castShadow = pent.receiveShadow = true;
  pent.name = "roof-penthouse";
  gr.add(pent);
  bins.counts.penthouses = 1;
  bins.roofFootprints.push({ x: H.x, z: pz, w: H.size[0], d: H.size[2], rot: 0 });
  /* Its dark north face. */
  const dark = new THREE.Mesh(
    new THREE.PlaneGeometry(H.size[0] - 0.2, H.size[1] - 0.2),
    metalRib(colors.penthouseDark)
  );
  dark.position.set(H.x, roofY + H.size[1] / 2, pz - H.size[2] / 2 - 0.03);
  dark.rotation.y = Math.PI;
  gr.add(dark);

  /* The caged roof-access ladder on the penthouse's west face. Nothing here is
     eyeballed off the Apple mesh, which resolves only that a rung-striped caged
     element is there: the rails stand at OSHA's 16-inch minimum rung length,
     the rungs at its 12-inch maximum pitch — so the COUNT is a consequence of
     the penthouse height and is not typed — and the cage at its 27-inch
     stand-off from the rung centreline. */
  const L = H.ladder;
  const lx = H.x - H.size[0] / 2 - 0.09;
  const climb = H.size[1] - 2 * L.rungPitch;
  const nRung = Math.max(2, Math.floor(climb / L.rungPitch) + 1);
  const stiles = [-1, 1].map((s) => ({
    x: lx, y: roofY + H.size[1] / 2, z: pz + (s * L.railSpacing) / 2,
    scale: [0.06, H.size[1], 0.06],
  }));
  const rungs = [];
  for (let i = 0; i < nRung; i++) {
    rungs.push({
      x: lx, y: roofY + L.rungPitch + (i * climb) / (nRung - 1), z: pz,
      scale: [0.05, 0.04, L.railSpacing],
    });
  }
  /* Cage hoops start where OSHA's cage starts — 7 ft up — and repeat at the
     standard 4 ft. */
  const cage = [];
  const cageBase = 2.134;
  const cagePitch = 1.219;
  for (let y = cageBase; y <= H.size[1] - 0.2; y += cagePitch) {
    cage.push({
      x: lx - L.cageStandoff / 2, y: roofY + y, z: pz,
      scale: [L.cageStandoff, 0.05, L.railSpacing + 0.1],
    });
  }
  gr.add(instanced(unit, painted(colors.guardrailGalv), [...stiles, ...rungs, ...cage]));
  bins.counts.ladderRungs = rungs.length;

  /* Rooftop mechanical: low RTU / condenser clusters with a fan disc each. */
  const M = R.mechanical;
  gr.add(instanced(unit, metalRib(colors.rtuGrey), M.units, (u) => ({
    x: u.x, y: roofY + u.size[1] / 2, z: u.z, scale: u.size,
  })));
  gr.add(instanced(new THREE.CylinderGeometry(1, 1, 1, 12), painted(colors.penthouseDark),
    M.units, (u) => ({
      x: u.x, y: roofY + u.size[1] + 0.05, z: u.z, scale: [u.fan / 2, 0.1, u.fan / 2],
    })));
  bins.counts.mechanical = M.units.length;
  for (const u of M.units) bins.roofFootprints.push({ x: u.x, z: u.z, w: u.size[0], d: u.size[2], rot: 0 });

  /* Domed drains / vent caps along the perimeter band. Their COUNT is a
     consequence of the shipped perimeter, not of a photograph. */
  const D = R.drains;
  const domes = [];
  /* The dome stands on the CENTRE LINE of the walkway band it is photographed
     on, so its inset is that band's own geometry and not a typed number; and it
     starts one band width in, the same trim the band itself takes, so a dome
     can never sit on a mitre. */
  const drainInset = P.thickness / 2 + Wk.width / 2;
  for (const f of section.facades) {
    const fr = frameOf(f);
    if (fr.length - 2 * trim <= 0.4) continue;
    for (let u = trim; u <= fr.length - trim; u += D.spacing) {
      const p = fr.at(u, -drainInset, roofY + 0.05);
      domes.push(p);
      bins.roofFootprints.push({ x: p.x, z: p.z, w: 2 * D.radius, d: 2 * D.radius, rot: 0 });
    }
  }
  gr.add(instanced(new THREE.SphereGeometry(1, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2),
    concrete(colors.drainWhite), domes,
    (p) => ({ x: p.x, y: p.y, z: p.z, scale: [D.radius, D.height, D.radius] })));
  bins.counts.drains = domes.length;

  group.add(gr);
}

/* ------------------------------------------------------------ the ground */

/* The east entry porch, off The Ramble. The Regents plan notches it INTO the
   footprint; the drawn prism is solid and cannot be notched, so it builds
   EASTWARD off the drawn east face — inside the 4.4 m the drawn ring is short
   at that end, and onto the paving ArcGIS ground ring #2989 already surveys as
   'walk', which is exactly where the plan puts the porch floor.

   Its WIDTH is the drawn length of the ONE face it backs onto, `porch.face`,
   and not the ring's bounding box. The first build spanned min(ring.z) to
   max(ring.z) and shipped a 17.7 m soffit — twice the plan's roughly 9 m — and
   because the drawn east elevation STEPS 1.25 m at z = 613.2 that soffit stood
   clear of the wall, with daylight behind it, for 7.5 m of its length. Backing
   the porch onto one drawn face puts every millimetre of its inner edge on a
   wall, and the drawn 8.20 m is the plan's 9 m inside the declared length
   conflict. Every layout offset below is derived from a dimension in the data;
   the first build's 1.1 / 2.2 / 0.15 / 0.5 / 1.75 m existed in no field. */
function buildPorch(section, gr, ctx) {
  const P = section.porch;
  const { colors } = section;
  const { baseY, storeyH, ground } = ctx;
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const level1Top = baseY + storeyH;

  const face = section.facades.find((f) => f.id === P.face);
  if (!face) throw new Error(`campus-photo-azad: porch.face ${P.face} is not a drawn face`);
  const fr = frameOf(face);
  const w = fr.length;                 // along the drawn face
  const d = P.depth;                   // out from it
  const mid = fr.at(w / 2, d / 2, 0);

  /* Unit-paver floor, draped on the drawn surface on the carpet rung. */
  gr.add(drapedDecal(mid.x, mid.z, w, d, ground,
    decal(colors.porchPaver, CARPET, "pavingConcreteUnit", [w / 1.8, d / 1.8]), CARPET, fr.rot));

  /* Flat exposed-concrete soffit slab, and the SQUARE columns that carry its
     outer edge (the colonnade's are round — the rendering is explicit). */
  const soffit = new THREE.Mesh(
    new THREE.BoxGeometry(w, P.soffitThickness, d),
    concrete(colors.exposedConcrete)
  );
  soffit.position.set(mid.x, level1Top - P.soffitThickness / 2, mid.z);
  soffit.rotation.y = fr.rot;
  soffit.castShadow = soffit.receiveShadow = true;
  soffit.name = "porch-soffit";
  gr.add(soffit);
  const under = new THREE.Mesh(quad(w - 0.1, d - 0.1), matte(colors.recessVoid));
  under.position.set(mid.x, level1Top - P.soffitThickness - 0.01, mid.z);
  under.rotation.set(Math.PI, fr.rot, 0, "YXZ");
  gr.add(under);

  /* Columns stand at the soffit's OUTER edge, inset by half their own size, and
     spread evenly between the two low end walls, clear of both. */
  const cols = [];
  const colW = d - P.columnSize / 2;
  const colPad = P.lowWall.thickness + P.columnSize / 2;
  for (let i = 0; i < P.columns; i++) {
    const u = colPad + (i * (w - 2 * colPad)) / (P.columns - 1);
    const p = fr.at(u, colW, 0);
    const g = ground(p.x, p.z);
    const top = level1Top - P.soffitThickness;
    cols.push({
      x: p.x, y: (g + top) / 2, z: p.z, rot: fr.rot,
      scale: [P.columnSize, top - g, P.columnSize],
    });
  }
  gr.add(named(instanced(unit, concrete(colors.exposedConcrete), cols), "azad-porch-columns"));

  /* The furniture the Regents p.4 rendering shows: a round fire-pit table at
     centre, two long sofas facing each other across it, round side tables at
     their inner ends. The sofas stand one `seatReach` clear of the fire pit —
     the standard 18-inch reach from a seat front to a low table — so the
     spacing is a consequence of the fire pit's own radius. */
  const fp = fr.at(w / 2, d / 2, 0);
  const fg = ground(fp.x, fp.z);
  gr.add(named(instanced(new THREE.CylinderGeometry(1, 1, 1, 16), concrete(colors.firepitDark),
    [{ x: fp.x, y: fg + P.firepit.height / 2, z: fp.z, rot: fr.rot,
      scale: [P.firepit.r, P.firepit.height, P.firepit.r] }]), "azad-porch-firepit"));
  const sofas = [];
  const backs = [];
  const tables = [];
  const sofaU = P.firepit.r + P.seatReach + P.sofa.depth / 2;
  for (const s of [-1, 1]) {
    const p = fr.at(w / 2 + s * sofaU, d / 2, 0);
    const g = ground(p.x, p.z);
    sofas.push({
      x: p.x, y: g + P.sofa.seat, z: p.z, rot: fr.rot,
      scale: [P.sofa.depth, 0.16, P.sofa.length],
    });
    const b = fr.at(w / 2 + s * (sofaU + P.sofa.depth / 2 - 0.12), d / 2, 0);
    backs.push({
      x: b.x, y: g + P.sofa.back / 2 + 0.16, z: b.z, rot: fr.rot,
      scale: [0.2, P.sofa.back - 0.16, P.sofa.length],
    });
    /* Side table tangent to the sofa's INNER end — the outer end faces the
       column line and there is no room for one there. */
    const t = fr.at(w / 2 + s * sofaU, d / 2 - P.sofa.length / 2 - P.sideTable.r, 0);
    tables.push({
      x: t.x, y: ground(t.x, t.z) + P.sideTable.height / 2, z: t.z, rot: fr.rot,
      scale: [P.sideTable.r, P.sideTable.height, P.sideTable.r],
    });
  }
  gr.add(named(instanced(unit, lib().get("stucco", { color: colors.sofaGrey }), [...sofas, ...backs]), "azad-porch-sofas"));
  gr.add(named(instanced(new THREE.CylinderGeometry(1, 1, 1, 12), painted(colors.firepitDark), tables), "azad-porch-tables"));

  /* Low wall + planting bed at each END of the porch, between it and the
     Ramble; the outer side stays open, because that is where you walk in. */
  const walls = [];
  for (const s of [-1, 1]) {
    const u = s < 0 ? -P.lowWall.thickness / 2 : w + P.lowWall.thickness / 2;
    const p = fr.at(u, d / 2, 0);
    const g = ground(p.x, p.z);
    walls.push({
      x: p.x, y: g + P.lowWall.height / 2, z: p.z, rot: fr.rot,
      scale: [P.lowWall.thickness, P.lowWall.height, d],
    });
    const b = fr.at(u + s * (P.bedDepth / 2 + P.lowWall.thickness / 2), d / 2, 0);
    gr.add(drapedDecal(b.x, b.z, P.bedDepth, d, ground,
      decal(colors.plantingSoil, CARPET, "decomposedGranite", [P.bedDepth / 1.6, d / 1.6]),
      CARPET, fr.rot));
  }
  gr.add(named(instanced(unit, concrete(colors.exposedConcrete), walls), "azad-porch-walls"));
  return { columns: cols.length, sofas: sofas.length, walls: walls.length, width: w };
}

/* The photographed north-colonnade band — the 5 m strip campus-eighth-
   furniture.js excludes by design, which is exactly the band the ultra
   standard requires be filled. Everything seats on its OWN drawn surface. */
function buildGroundFittings(section, gr, ctx, bins) {
  const G = section.ground;
  const C = section.colonnade;
  const { colors } = section;
  const { ground, hash } = ctx;
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const faceById = new Map(section.facades.map((f) => [f.id, f]));
  const frameById = new Map(section.facades.map((f) => [f.id, frameOf(f)]));

  /* Galvanised vertical-picket guardrail along the raised terrace edge. The
     terrace runs out past the column line by the same 2.4 m the Regents p.5
     colonnade band measures, so the rail's offset is DERIVED from the recorded
     colonnade section and is not a typed distance. */
  const R = G.guardrail;
  const railOffset = C.columnProud + C.columnDiameter + C.depth;
  const rf = faceById.get(R.face);
  if (rf) {
    const fr = frameById.get(R.face);
    const u0 = (fr.length - R.length) / 2;
    const posts = [];
    const pickets = [];
    const rails = [];
    const nPost = Math.max(2, Math.round(R.length / R.postSpacing) + 1);
    for (let i = 0; i < nPost; i++) {
      const p = fr.at(u0 + (i * R.length) / (nPost - 1), railOffset, 0);
      const g = ground(p.x, p.z);
      posts.push({ x: p.x, y: g + R.height / 2, z: p.z, rot: fr.rot, scale: [0.06, R.height, 0.06] });
    }
    /* Picket centres are the MEASURED canonical Eighth spacing, arbitrated
       2026-08-19 and owned by eighthsiteworks.systems.guardrail: 0.1016 m
       centres on a 0.019 m picket, so the clear opening is 0.0826 m and the
       4-inch sphere still passes with 19 mm to spare. The earlier reading here
       took SPHERE_RULE as the clear OPENING and put the centres at 0.1206 m —
       the widest legal spacing rather than the built one. */
    const picketSpacing = R.picketSpacing;
    const nPick = Math.floor(R.length / picketSpacing);
    for (let i = 0; i <= nPick; i++) {
      const p = fr.at(u0 + (i * R.length) / nPick, railOffset, 0);
      const g = ground(p.x, p.z);
      pickets.push({
        x: p.x, y: g + (R.height - 0.08) / 2, z: p.z, rot: fr.rot,
        scale: [R.picket, R.height - 0.08, R.picket],
      });
    }
    for (const yf of [1.0, 0.06]) {
      const seg = Math.max(2, Math.ceil(R.length / 2));
      for (let i = 0; i < seg; i++) {
        const u = u0 + ((i + 0.5) * R.length) / seg;
        const p = fr.at(u, railOffset, 0);
        const g = ground(p.x, p.z);
        rails.push({
          x: p.x, y: g + R.height * yf, z: p.z, rot: fr.rot,
          scale: [R.length / seg + 0.02, 0.05, 0.04],
        });
      }
    }
    gr.add(named(instanced(unit, painted(colors.guardrailGalv), [...posts, ...pickets, ...rails]), "azad-guardrail"));
    bins.counts.guardrailPickets = pickets.length;
  }

  /* The red fire-department standpipe, against the base wall where its own
     source puts it. Built BEFORE the hedge, because the bed is interrupted
     around it — a planting bed does not grow through an FDC. */
  const Sp = G.standpipe;
  const spFrame = frameById.get(Sp.face);
  const pipes = [];
  if (spFrame) {
    const p = spFrame.at(Sp.u, Sp.offset, 0);
    pipes.push({
      x: p.x, y: ground(p.x, p.z) + Sp.height / 2, z: p.z,
      scale: [Sp.radius, Sp.height, Sp.radius],
    });
  }
  gr.add(named(instanced(new THREE.CylinderGeometry(1, 1, 1, 10), painted(colors.standpipeRed), pipes), "azad-standpipe"));
  bins.counts.standpipes = pipes.length;

  /* Low clipped evergreen hedge along the base of the storefront, in the clear
     strip between the glass line and the back of the column shafts. */
  const Hd = G.hedge;
  const hedges = [];
  for (const id of Hd.faces) {
    const f = faceById.get(id);
    if (!f) continue;
    const fr = frameById.get(id);
    const seg = Math.max(2, Math.ceil(fr.length / HEDGE_SEG));
    const segLen = fr.length / seg;
    for (let i = 0; i < seg; i++) {
      const u = (i + 0.5) * segLen;
      /* Interrupt the bed where a fitting stands in it. */
      if (id === Sp.face &&
          Math.abs(u - Sp.u) < segLen / 2 + Sp.radius + HEDGE_CLEAR) continue;
      const p = fr.at(u, Hd.offset, 0);
      const g = ground(p.x, p.z);
      /* A clipped hedge is not a perfectly flat extrusion: a small
         deterministic wobble per segment, from the section's pinned seed. */
      const h = Hd.height * (0.92 + 0.16 * hash(11, i, Math.round(fr.length * 10)));
      hedges.push({
        x: p.x, y: g + h / 2, z: p.z, rot: fr.rot,
        scale: [segLen, h, Hd.depth],
      });
    }
  }
  gr.add(named(instanced(unit, foliage(colors.hedgeGreen), hedges), "azad-hedge"));
  bins.counts.hedgeSegments = hedges.length;

  /* Dark-grey concrete planter cubes, and what grows out of them. The shrub
     seats exactly ON the cube's top — it neither floats nor sinks into it. */
  const Pc = G.planterCubes;
  const cubes = Pc.items.map((it) => {
    const fr = frameById.get(it.face);
    const p = fr.at(it.u, Pc.offset, 0);
    return { x: p.x, z: p.z, rot: fr.rot, g: ground(p.x, p.z) };
  });
  gr.add(named(instanced(unit, concrete(colors.planterCubeGrey), cubes, (c) => ({
    x: c.x, y: c.g + Pc.size[1] / 2, z: c.z, rot: c.rot, scale: Pc.size,
  })), "azad-planter-cubes"));
  gr.add(named(instanced(new THREE.ConeGeometry(1, 1, 6), foliage(colors.hedgeGreen), cubes, (c, i) => ({
    x: c.x, y: c.g + Pc.size[1] + Pc.shrub.height / 2, z: c.z,
    rot: hash(23, i) * Math.PI,
    scale: [Pc.shrub.radius, Pc.shrub.height, Pc.shrub.radius],
  })), "azad-planter-shrubs"));

  /* Hoop bike racks, a run of `count` at `spacing` along their own face. */
  const Bk = G.bikeRacks;
  const bkFrame = frameById.get(Bk.face);
  const hoops = [];
  for (let i = 0; i < Bk.count; i++) {
    const p = bkFrame.at(Bk.firstU + i * Bk.spacing, Bk.offset, 0);
    hoops.push({ x: p.x, y: ground(p.x, p.z), z: p.z, rot: bkFrame.rot });
  }
  gr.add(named(instanced(
    new THREE.TorusGeometry(Bk.hoopWidth / 2, Bk.tube, 5, 10, Math.PI),
    painted(colors.rackBlack), hoops
  ), "azad-bike-racks"));
  bins.counts.bikeHoops = hoops.length;

  /* In-ground uplights at every second colonnade column foot. */
  const upGeo = new THREE.CircleGeometry(1, 10);
  upGeo.rotateX(-Math.PI / 2);
  const up = instanced(upGeo,
    applyOverlayDepth(new THREE.MeshStandardMaterial({
      color: colors.uplightGlow, roughness: 0.5, metalness: 0.2,
      emissive: colors.uplightGlow, emissiveIntensity: 0.35,
    }), PAINT),
    bins.uplights,
    (u) => ({ x: u.x, y: u.y + overlayLift(PAINT), z: u.z, scale: [G.uplights.radius, 1, G.uplights.radius] }));
  up.renderOrder = OVERLAY[PAINT].renderOrder;
  up.castShadow = false;
  /* NOT "ground-decal": that name marks the DRAPED meshes the seating gate
     walks vertex by vertex, and an InstancedMesh's geometry sits at the
     origin — it is covered by the instance sweep instead. */
  up.name = "azad-uplights";
  gr.add(up);
  bins.counts.uplights = bins.uplights.length;
}

/* --------------------------------------------------------------------- api */

/**
 * Build Azad Hall's photo-sourced detail.
 *
 * `photo` is the loaded photo-detail document; this reads only its `azad`
 * section and writes nothing back, and returns `{ group, counts }` (empty and
 * harmless if the section is missing). `surfaceAt` — the height of the DRAWN
 * terrain triangle — seats everything that stands on the ground; `heightAt`
 * solves the drawn prism exactly as campus-massing.js roofElevation does:
 * rim-median ground under `measured.mass.ring` (the arcgis ring campus-massing
 * extrudes, copied verbatim) plus `measured.mass.h` (the GIS height — there is
 * NO LiDAR height for this mass and none is read), lifted past a high corner.
 */
export function createPhotoAzad(scene, { photo, heightAt, surfaceAt } = {}) {
  const group = new THREE.Group();
  group.name = "photo-azad";
  const section = photo?.azad;
  if (!section) {
    scene?.add(group);
    return { group, counts: {} };
  }
  const ground = surfaceAt || heightAt;
  const baseFn = heightAt || surfaceAt;
  if (typeof ground !== "function" || typeof baseFn !== "function") {
    throw new Error("campus-photo-azad: needs surfaceAt (or heightAt) to place on the ground");
  }

  const mass = section.measured.mass;
  const ring = openRing(mass.ring);
  /* The median is taken over mass.ring EXACTLY as campus-massing.js hands it to
     roofElevation — the CLOSING DUPLICATE INCLUDED. Dropping it changes the
     vertex count from 23 to 22 and can pick a different rank, which on today's
     flat ground under Azad is 0.0000 m but reaches 0.34 m on a rolling sampler:
     the whole dressing would slide off the wall it claims to hang on. Geometry
     still uses the OPEN ring; only this anchor uses the raw one. */
  const gs = mass.ring.map(([x, z]) => baseFn(x, z)).filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  const median = gs.length ? gs[Math.floor(gs.length / 2)] : 0;
  const highest = gs.length ? gs[gs.length - 1] : 0;
  const roofY = Math.max(median + mass.h, highest);
  const baseY = roofY - mass.h;
  const storeyH = mass.h / (section.grid.storeys ?? mass.levels);
  const hash = makeHash(section.seed);
  const ctx = { roofY, baseY, storeyH, ground, ring, hash };

  const bins = {
    panels: [], baseWalls: [], storefront: [], sfGlass: [], sfFrames: [], doorPulls: [],
    columns: [], soffits: [], downlights: [],
    lobby: [], amber: [], frames: [], glass: [], uplights: [], roofFootprints: [],
    counts: {
      popouts: 0, lounge: 0, corridor: 0, stairSlots: 0, doors: 0,
      parapetRuns: 0, walkwayBands: 0, crossBands: 0, mechanical: 0, drains: 0,
      ladderRungs: 0, guardrailPickets: 0, hedgeSegments: 0, uplights: 0,
      standpipes: 0, bikeHoops: 0,
    },
  };

  const facades = new THREE.Group();
  facades.name = "azad-facades";
  for (const f of section.facades) collectFace(section, f, frameOf(f), ctx, bins);

  const { colors } = section;
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const plane = new THREE.PlaneGeometry(1, 1);
  const add = (geo, mat, items, name) => {
    if (!items.length) return;
    const mesh = instanced(geo, mat, items);
    if (name) mesh.name = name;
    facades.add(mesh);
  };

  /* Panel fields and base walls are individual meshes so each carries its
     joint grid at true scale — the per-surface repeat lever. */
  for (const p of bins.panels) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.h),
      panelMat(colors.wallPanel, p.w, p.h, section.panel.width, storeyH / section.panel.coursesPerStorey));
    m.position.set(p.x, p.y, p.z);
    m.rotation.y = p.rot;
    m.castShadow = m.receiveShadow = true;
    m.name = "azad-panel-field";
    facades.add(m);
  }
  for (const w of bins.baseWalls) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w.w, w.h), blockMat(colors.baseBlock, w.w, w.h));
    m.position.set(w.x, w.y, w.z);
    m.rotation.y = w.rot;
    m.castShadow = m.receiveShadow = true;
    m.name = "azad-base-wall";
    facades.add(m);
  }
  add(plane, matte(colors.recessVoid), bins.storefront, "azad-storefront");
  add(plane, glassMat(colors.lobbyGlass), bins.sfGlass, "azad-storefront-glass");
  add(unit, painted(colors.windowFrame), bins.sfFrames, "azad-storefront-frame");
  add(new THREE.CylinderGeometry(1, 1, 1, 8), painted(colors.doorPull), bins.doorPulls, "azad-door-pulls");
  add(plane, glassMat(colors.lobbyGlass), bins.lobby, "azad-lobby");
  add(new THREE.CylinderGeometry(1, 1, 1, 14), concrete(colors.exposedConcrete), bins.columns, "azad-colonnade");
  add(unit, concrete(colors.exposedConcrete), bins.soffits, "azad-soffit");
  add(unit, painted(colors.amberReveal), bins.amber, "azad-amber");
  add(unit, painted(colors.windowFrame), bins.frames, "azad-frames");
  add(plane, glassMat(colors.glazing), bins.glass, "azad-glass");
  {
    const g = new THREE.CircleGeometry(1, 8);
    g.rotateX(Math.PI / 2);
    add(g, painted(colors.uplightGlow), bins.downlights.map((d) => ({ ...d, scale: [0.09, 1, 0.09] })),
      "azad-downlights");
  }
  group.add(facades);

  buildRoof(section, group, ctx, bins);

  const gr = new THREE.Group();
  gr.name = "azad-ground";
  const porch = buildPorch(section, gr, ctx);
  buildGroundFittings(section, gr, ctx, bins);
  group.add(gr);

  scene?.add(group);
  return {
    group,
    counts: {
      facades: section.facades.length,
      longFaces: section.facades.filter((f) => f.system === "longFace").length,
      coreFaces: section.facades.filter((f) => f.system === "coreFace").length,
      endFaces: section.facades.filter((f) => f.system === "endFace").length,
      returns: section.facades.filter((f) => f.system === "return").length,
      panelFields: bins.panels.length,
      baseWalls: bins.baseWalls.length,
      popoutWindows: bins.counts.popouts,
      loungeWindows: bins.counts.lounge,
      corridorWindows: bins.counts.corridor,
      stairSlots: bins.counts.stairSlots,
      colonnadeColumns: bins.columns.length,
      storefronts: bins.storefront.length,
      storefrontPanes: bins.sfGlass.length,
      storefrontFrames: bins.sfFrames.length,
      doors: bins.counts.doors,
      amberPieces: bins.amber.length,
      glassPanes: bins.glass.length,
      parapetRuns: bins.counts.parapetRuns,
      walkwayBands: bins.counts.walkwayBands,
      crossBands: bins.counts.crossBands,
      roofMechanical: bins.counts.mechanical,
      drains: bins.counts.drains,
      penthouses: bins.counts.penthouses,
      ladderRungs: bins.counts.ladderRungs,
      pv: 0,
      porchColumns: porch.columns,
      porchSofas: porch.sofas,
      porchWalls: porch.walls,
      porchWidth: porch.width,
      guardrailPickets: bins.counts.guardrailPickets,
      hedgeSegments: bins.counts.hedgeSegments,
      planterCubes: section.ground.planterCubes.items.length,
      bikeHoops: bins.counts.bikeHoops,
      standpipes: bins.counts.standpipes,
      uplights: bins.counts.uplights,
      draws: group.children.reduce((s, g2) => s + (g2.children?.length ?? 0), 0),
    },
  };
}
