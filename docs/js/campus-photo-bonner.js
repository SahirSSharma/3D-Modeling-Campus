// Bonner Hall AND the hexagonal breezeway it shares with Mayer Hall —
// from photographs, the surveyed rings and the full-depth 2014 laser: the
// INVENTED class, R4 batch.
//
// Five facts shaped this module, and each is a place a plausible build goes
// wrong:
//
//   1. THE FACADE HANGS FROM THE MEASURED PLATE, NEVER FROM THE DRAWN PRISM.
//      massHeights' historical 19.2 read was plate + louvre spine, a drawn lid
//      metres above the real parapet; the R4 arbitration override (2026-08-21)
//      retired it and the file now ships 15.4 so lid = plate. Every band here
//      still hangs DOWN from the one EPT plate plane the section carries — the
//      rule survives the override, because a treatment pinned to whatever the
//      extruder does would inherit the next height read's mistakes too.
//
//   2. THE BREEZEWAY IS NEVER KEYED BY THE OSM HEIGHTS. The chain rings win
//      the PLAN verbatim; their h values are position-keyed mapper reads of
//      the two lower DECK planes and build nothing. Every deck, the canopy
//      and the court datum come from the section's own EPT-derived figures.
//      The module never opens a measured file at all.
//
//   3. THE CELLS ARE DERIVED FROM THE RINGS, NEVER TYPED. Each strand's seven
//      hex cells are re-derived here from its own carried ring by the same
//      outer-face rule the test re-runs, so a column cannot stand anywhere
//      the survey does not put a cell. One round column per cell, fourteen
//      total — not the superseded object's twelve on two straight rows.
//
//   4. THE CHAIN LANDS ON THE MAYER FACE, NOT ON THE OSM RING END. The rings
//      run 1.9 m past the GIS face at z 278.0 — tracing error, recorded, and
//      every chain plate is clipped there. Deck 3's termination is unresolved
//      (gap g8), so it is TRIMMED short at its last measured cell and its
//      mesh says -estimated.
//
//   5. NO DIMENSION AND NO COLOUR LIVES IN THIS FILE. Every metre comes from
//      the section — figures mirrored into `system`, banded `estimates`, or
//      `draw` render offsets — and every hex goes through a guard that throws
//      on an undeclared role, because campus-materials.js silently ships
//      OPAQUE WHITE for a missing colour. Provenance is in the mesh NAMES
//      (-sourced / -estimated) or it is not in the scene at all.
//
// Surfaces come from the procedural material library (campus-materials.js):
// the library supplies microstructure at true material scale, the section
// supplies the colour. Deterministic throughout — no clock, no randomness.
import * as THREE from "../vendor/three/three.module.min.js";
import { applyOverlayDepth, overlayLift, OVERLAY } from "./campus-overlay.js";
import { sharedMaterialLibrary } from "./campus-materials.js";

let LIB = null;
const lib = () => (LIB ??= sharedMaterialLibrary(THREE));

const aggregate = (color) => lib().get("stucco", { color });
const cast = (color) => lib().get("smoothConcrete", { color });
const steel = (color) => lib().get("metalPanel", { color });
const glassOf = (color) => lib().get("glass", { color });

/** Signed area of a closed ring: positive is counter-clockwise in (x, z). */
function ringCcw(ring) {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return a > 0;
}

/**
 * THE MITRED OFFSET RING (fleets precedent, verbatim in method). Bands drawn
 * per-edge at a raw offset leave a wedge at every plane change, and with the
 * massing prism retired (skipGis, R4 visual round) a wedge is DAYLIGHT, not a
 * hairline over concrete. Each edge's supporting line is offset, consecutive
 * lines are intersected, and adjacent band runs share the intersection as
 * their corner. Near-parallel survey jogs fall back to the plain offset.
 */
function offsetRing(ring, off, ccw) {
  const es = [];
  for (let k = 0; k < ring.length - 1; k++) {
    const [ax, az] = ring[k];
    const [bx, bz] = ring[k + 1];
    const L = Math.hypot(bx - ax, bz - az);
    if (!(L > 0)) continue;
    const s = ccw ? 1 : -1;
    const nx = (s * (bz - az)) / L;
    const nz = (-s * (bx - ax)) / L;
    es.push({ k, a: [ax + nx * off, az + nz * off], b: [bx + nx * off, bz + nz * off],
      d: [(bx - ax) / L, (bz - az) / L] });
  }
  const n = es.length;
  for (let i = 0; i < n; i++) {
    const cur = es[i];
    const nxt = es[(i + 1) % n];
    const det = cur.d[0] * -nxt.d[1] - cur.d[1] * -nxt.d[0];
    if (Math.abs(det) < 1e-6) continue;
    const rx = nxt.a[0] - cur.a[0];
    const rz = nxt.a[1] - cur.a[1];
    const t = (rx * -nxt.d[1] - rz * -nxt.d[0]) / det;
    const px = cur.a[0] + cur.d[0] * t;
    const pz = cur.a[1] + cur.d[1] * t;
    /* A corner may not travel further than the offset's own diagonal reach. */
    if (Math.hypot(px - cur.b[0], pz - cur.b[1]) > off * 8) continue;
    cur.b = [px, pz];
    nxt.a = [px, pz];
  }
  return es;
}

/** Sutherland-Hodgman clip of a CLOSED ring against one axis half-plane. */
function clipHalf(ring, axis, limit, keepBelow) {
  const ai = axis === "x" ? 0 : 1;
  const inside = (p) => (keepBelow ? p[ai] <= limit : p[ai] >= limit);
  const open = ring.slice(0, -1);
  const out = [];
  for (let i = 0; i < open.length; i++) {
    const a = open[i];
    const b = open[(i + 1) % open.length];
    const cross = () => {
      const t = (limit - a[ai]) / (b[ai] - a[ai]);
      return ai === 0
        ? [limit, a[1] + (b[1] - a[1]) * t]
        : [a[0] + (b[0] - a[0]) * t, limit];
    };
    if (inside(a)) {
      out.push(a);
      if (!inside(b)) out.push(cross());
    } else if (inside(b)) {
      out.push(cross());
    }
  }
  if (out.length < 3) return null;
  return dropSpikes(out);
}

/**
 * Remove zero-area spikes a half-plane clip leaves where the clip line runs
 * ALONG a ring edge (the wing's own z edges): an out-and-back collinear spur
 * has no area but its side skin would render as a floating fin.
 */
function dropSpikes(open) {
  const pts = open.slice();
  let changed = true;
  while (changed && pts.length > 3) {
    changed = false;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i - 1 + pts.length) % pts.length];
      const b = pts[i];
      const c = pts[(i + 1) % pts.length];
      const abx = b[0] - a[0];
      const abz = b[1] - a[1];
      const bcx = c[0] - b[0];
      const bcz = c[1] - b[1];
      const cross = abx * bcz - abz * bcx;
      const dot = abx * bcx + abz * bcz;
      const dup = Math.hypot(bcx, bcz) < 1e-9;
      if (dup || (Math.abs(cross) < 1e-7 && dot <= 1e-9)) {
        pts.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  if (pts.length < 3) return null;
  return pts.concat([pts[0]]);
}

/** One surveyed edge's own frame; outward normal fixed by the ring winding. */
function edgeFrame(a, b, ccw) {
  const [ax, az] = a;
  const [bx, bz] = b;
  const length = Math.hypot(bx - ax, bz - az);
  const tx = (bx - ax) / length;
  const tz = (bz - az) / length;
  const s = ccw ? 1 : -1;
  const nx = s * tz;
  const nz = -s * tx;
  return {
    ax, az, bx, bz, length, nx, nz, tx, tz,
    at: (u, w) => ({ x: ax + tx * u + nx * w, z: az + tz * u + nz * w }),
  };
}

/** A vertical quad on a face, both heights absolute, UVs in tile units. */
function faceQuad(out, fr, off, u0, u1, yLo, yHi, tileU, tileV) {
  const a = fr.at(u0, off);
  const b = fr.at(u1, off);
  const u = (u1 - u0) / tileU;
  const v = (yHi - yLo) / tileV;
  const p = [
    [a.x, yLo, a.z, 0, 0], [b.x, yLo, b.z, u, 0], [b.x, yHi, b.z, u, v],
    [a.x, yLo, a.z, 0, 0], [b.x, yHi, b.z, u, v], [a.x, yHi, a.z, 0, v],
  ];
  for (const [x, y, z, uu, vv] of p) { out.pos.push(x, y, z); out.uv.push(uu, vv); }
  out.runs++;
}

const bandQuad = (out, fr, off, yLo, yHi, tileU, tileV) =>
  faceQuad(out, fr, off, 0, fr.length, yLo, yHi, tileU, tileV);

/** A double-sided vertical quad between two world points (rails, pickets). */
function thinQuad(out, ax, az, bx, bz, yLo, yHi, tileU, tileV) {
  const u = Math.hypot(bx - ax, bz - az) / tileU;
  const v = (yHi - yLo) / tileV;
  const face = [
    [ax, yLo, az, 0, 0], [bx, yLo, bz, u, 0], [bx, yHi, bz, u, v],
    [ax, yLo, az, 0, 0], [bx, yHi, bz, u, v], [ax, yHi, az, 0, v],
  ];
  for (const [x, y, z, uu, vv] of face) { out.pos.push(x, y, z); out.uv.push(uu, vv); }
  for (const [x, y, z, uu, vv] of [face[0], face[2], face[1], face[3], face[5], face[4]]) {
    out.pos.push(x, y, z);
    out.uv.push(uu, vv);
  }
  out.runs++;
}

function bandGeometry(bin) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(bin.pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(bin.uv, 2));
  geo.computeVertexNormals();
  return geo;
}

/** Sutherland-Hodgman clip of a CLOSED ring against z <= zMax. */
function clipRingZ(ring, zMax) {
  const open = ring.slice(0, -1);
  const out = [];
  for (let i = 0; i < open.length; i++) {
    const a = open[i];
    const b = open[(i + 1) % open.length];
    const aIn = a[1] <= zMax;
    const bIn = b[1] <= zMax;
    const cross = () => {
      const t = (zMax - a[1]) / (b[1] - a[1]);
      return [a[0] + (b[0] - a[0]) * t, zMax];
    };
    if (aIn) {
      out.push(a);
      if (!bIn) out.push(cross());
    } else if (bIn) {
      out.push(cross());
    }
  }
  if (out.length < 3) return null;
  return out.concat([out[0]]);
}

/**
 * A horizontal plate extruded from a closed ring: top, bottom and side skin,
 * planar-mapped UVs in tile units.
 */
function ringPlate(ring, yTop, thick, tile) {
  const contour = ring.slice(0, -1).map(([x, z]) => new THREE.Vector2(x, -z));
  if (contour.length < 3) return null;
  let faces;
  try {
    faces = THREE.ShapeUtils.triangulateShape(contour, []);
  } catch {
    return null;
  }
  const pos = [];
  const uv = [];
  const push = (x, y, z) => { pos.push(x, y, z); uv.push(x / tile, z / tile); };
  for (const [i, j, k] of faces) {
    /* Top face up, bottom face down: winding flips between them. */
    for (const idx of [i, j, k]) push(contour[idx].x, yTop, -contour[idx].y);
    for (const idx of [i, k, j]) push(contour[idx].x, yTop - thick, -contour[idx].y);
  }
  const ccw = ringCcw(ring);
  for (let e = 0; e < ring.length - 1; e++) {
    const fr = edgeFrame(ring[e], ring[e + 1], ccw);
    if (!(fr.length > 0)) continue;
    const quad = [
      [fr.ax, yTop - thick, fr.az], [fr.bx, yTop - thick, fr.bz], [fr.bx, yTop, fr.bz],
      [fr.ax, yTop - thick, fr.az], [fr.bx, yTop, fr.bz], [fr.ax, yTop, fr.az],
    ];
    for (const [x, y, z] of quad) { pos.push(x, y, z); uv.push((x + z) / tile, y / tile); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return geo;
}

/**
 * The hex-cell centres of one chain strand, derived from its own carried
 * ring: outer-face edges are near-z-parallel (|dx| small), a face-length
 * long, and sit on the strand's own x extreme; each is one cell's outer
 * face, and the cell's centre sits half a corridor inboard of it.
 */
function chainCells(ringOpen, corridor, rule) {
  const ring = ringOpen.concat([ringOpen[0]]);
  const xs = ringOpen.map((p) => p[0]);
  const xmin = Math.min(...xs);
  const xmax = Math.max(...xs);
  const cells = [];
  for (let k = 0; k < ring.length - 1; k++) {
    const [ax, az] = ring[k];
    const [bx, bz] = ring[k + 1];
    const L = Math.hypot(bx - ax, bz - az);
    if (Math.abs(bx - ax) > rule.maxDx || L < rule.minLen || L > rule.maxLen) continue;
    const mx = (ax + bx) / 2;
    const mz = (az + bz) / 2;
    if (Math.abs(mx - xmax) < rule.snap) cells.push({ x: xmax - corridor / 2, z: mz, out: "E" });
    else if (Math.abs(mx - xmin) < rule.snap) cells.push({ x: xmin + corridor / 2, z: mz, out: "W" });
  }
  cells.sort((a, b) => a.z - b.z);
  return cells;
}

/** A surveyed ground ring draped on the drawn terrain (fleets pattern). */
function drapeRing(rings, ground, lift, seg, maxDepth) {
  const contour = rings[0].slice(0, -1).map(([x, z]) => new THREE.Vector2(x, -z));
  const holes = rings.slice(1)
    .map((r) => r.slice(0, -1).map(([x, z]) => new THREE.Vector2(x, -z)))
    .filter((r) => r.length >= 3);
  if (contour.length < 3) return null;
  let faces;
  try {
    faces = THREE.ShapeUtils.triangulateShape(contour, holes);
  } catch {
    return null;
  }
  const verts = contour.concat(...holes);
  const pos = [];
  const uv = [];
  const emit = (a, b, c) => {
    for (const p of [a, b, c]) {
      const g = ground(p.x, p.y);
      if (!Number.isFinite(g)) {
        throw new Error(`campus-photo-bonner: surfaceAt returned ${g} inside a surveyed ground ring at (${p.x}, ${p.y})`);
      }
      pos.push(p.x, g + lift, p.y);
      uv.push(p.x, p.y);
    }
  };
  const split = (a, b, c, depth) => {
    const longest = Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a));
    if (depth >= maxDepth || longest <= seg) { emit(a, b, c); return; }
    const ab = a.clone().add(b).multiplyScalar(0.5);
    const bc = b.clone().add(c).multiplyScalar(0.5);
    const ca = c.clone().add(a).multiplyScalar(0.5);
    split(a, ab, ca, depth + 1);
    split(ab, b, bc, depth + 1);
    split(ca, bc, c, depth + 1);
    split(ab, bc, ca, depth + 1);
  };
  for (const [i, j, k] of faces) {
    split(new THREE.Vector2(verts[i].x, -verts[i].y),
      new THREE.Vector2(verts[j].x, -verts[j].y),
      new THREE.Vector2(verts[k].x, -verts[k].y), 0);
  }
  if (!pos.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return geo;
}

/* The cell-derivation rule mirrors the section's rows rule; these are the
   rule's own tolerances (survey-noise bounds), not dimensions of anything. */
const CELL_RULE = { maxDx: 0.3, minLen: 2.0, maxLen: 4.5, snap: 0.6 };

/* ------------------------------------------------------------------ api */

/**
 * Build Bonner Hall's and the hexagonal breezeway's photo-sourced detail.
 * `photo` is the loaded photo-detail document; this reads ONLY its `bonner`
 * key. Everything on the ground seats on `surfaceAt` — the drawn terrain
 * triangle — never on `heightAt`.
 */
export function createPhotoBonner(scene, { photo, heightAt, surfaceAt } = {}) {
  const group = new THREE.Group();
  group.name = "photo-bonner";
  const section = photo?.bonner;
  if (!section) {
    scene?.add(group);
    return { group, counts: {} };
  }
  const ground = surfaceAt || heightAt;
  if (typeof ground !== "function") {
    throw new Error("campus-photo-bonner: needs surfaceAt (or heightAt) to place on the ground");
  }
  if (!section.measured?.breezeway?.chains || !section.system?.breezeway) {
    throw new Error("campus-photo-bonner: section is missing the breezeway apparatus — refusing to build half the star item");
  }

  const { colors, draw: D, system: S } = section;
  const hue = (role) => {
    const v = colors[role];
    if (typeof v !== "string") {
      throw new Error(`campus-photo-bonner: no colour declared for role "${role}" — `
        + "an unset role silently becomes white in campus-materials.js and must never reach a material");
    }
    return v;
  };
  const T = D.tiles;
  const counts = {
    building: 1,
    facadeSlabRuns: 0, facadeWindowRuns: 0,
    facadeSpandrelRuns: 0, facadeWithheldBands: 0,
    wingWallRuns: 0, wingParapetRuns: 0, shaftWallRuns: 0, skirtRuns: 0,
    roofPlatesMain: 0, roofPlatesWing: 0,
    stepSlabRuns: 0, stepWindowRuns: 0, stepSpandrelRuns: 0,
    spineBladesPlanned: S.spine.count, spineBladesBuilt: 0,
    decks: 0, canopyCells: 0, columns: 0, capitals: 0,
    cellsPlanned: 0, cellsWithheld: 0,
    railBars: 0, railPickets: 0, landings: 0,
    arcadeSoffits: 0, arcadeColumns: 0, gallerySlabs: 0, galleryPosts: 0,
    stairsPlanned: S.stairs.plannedRisers, stairsBuilt: 0,
    pavingChains: 0, lawns: 0, walks: 0,
  };

  /* ------------------------------------------------------------ facades */
  const B = section.measured.building;
  const ring = B.ring;
  const ccw = ringCcw(ring);
  const bin = () => ({ pos: [], uv: [], runs: 0 });
  const bins = {
    slabSourced: bin(), slabEstimated: bin(),
    windowSourced: bin(), windowEstimated: bin(),
    spandrelSourced: bin(), spandrelEstimated: bin(),
    wing: bin(), shaft: bin(), skirt: bin(),
  };
  const inBox = (x, z, b, pad) =>
    x >= b.x0 - pad && x <= b.x1 + pad && z >= b.z0 - pad && z <= b.z1 + pad;
  const FA = S.facade;
  const ST = S.stack;

  /* Every band run is cut from the MITRED offset ring, so consecutive runs
     share their corner exactly and no wedge can open at a plane change — with
     the prism retired, a wedge would be daylight through the building. */
  for (const seg of offsetRing(ring, D.wallOffset, ccw)) {
    const fr = edgeFrame(seg.a, seg.b, ccw);
    if (!(fr.length > 0)) continue;
    const mx = (ring[seg.k][0] + ring[seg.k + 1][0]) / 2;
    const mz = (ring[seg.k][1] + ring[seg.k + 1][1]) / 2;
    /* Grades along this run, for the skirt and the burial clip. */
    let gLo = Infinity;
    let gHi = -Infinity;
    for (let i = 0; i <= D.groundClipSamples; i++) {
      const p = fr.at((fr.length * i) / D.groundClipSamples, 0);
      const g = ground(p.x, p.z);
      if (!Number.isFinite(g)) {
        throw new Error(`campus-photo-bonner: surfaceAt returned ${g} along Bonner's own ring at (${p.x}, ${p.z})`);
      }
      if (g < gLo) gLo = g;
      if (g > gHi) gHi = g;
    }

    if (inBox(mx, mz, B.wing, 0.05)) {
      /* The two-storey west wing: blank aggregate to ITS OWN measured roof
         (gap g4 — no photograph of this wing exists, so no system either). */
      bandQuad(bins.wing, fr, 0, gLo - D.skirtDepth, FA.wingRoofRepo,
        T.aggregate, T.aggregate);
      counts.wingWallRuns++;
      /* The wing PARAPET LINE: the expressed slab edge of the sourced system,
         extended [estimated] at the wing's own measured roof (critic item 3). */
      bandQuad(bins.slabEstimated, fr, 0, FA.wingRoofRepo - FA.slabDepth,
        FA.wingRoofRepo, T.slab, T.slab);
      counts.wingParapetRuns++;
      continue;
    }
    if (inBox(mx, mz, B.shaft, 0.05)) {
      bandQuad(bins.shaft, fr, 0, gLo - D.skirtDepth, ST.plateRepo,
        T.aggregate, T.aggregate);
      counts.shaftWallRuns++;
      continue;
    }

    /* Main bar: face by outward normal, tier by the section's per-face map.
       Repo frame: +z is SOUTH, so nz > 0 is the true-south COURT face
       (z 248.2) — the face the 2013/2015 frames photograph (arbitration D6). */
    const face = Math.abs(fr.nx) > Math.abs(fr.nz)
      ? (fr.nx > 0 ? "east" : "west")
      : (fr.nz > 0 ? "south" : "north");
    const tier = FA.faceTiers[face];
    const slabBin = tier === "sourced" ? bins.slabSourced : bins.slabEstimated;
    const winBin = tier === "sourced" ? bins.windowSourced : bins.windowEstimated;
    const spanBin = tier === "sourced" ? bins.spandrelSourced : bins.spandrelEstimated;

    for (let st = 0; st < ST.storeys; st++) {
      const top = ST.plateRepo - st * ST.storey;
      const storeyFoot = top - ST.storey;
      const slabFoot = top - FA.slabDepth;
      bandQuad(slabBin, fr, 0, slabFoot, top, T.slab, T.slab);
      counts.facadeSlabRuns++;
      const winFoot = slabFoot - FA.windowOfStorey * ST.storey;
      /* THE GROUND CLIP: where the drawn terrain would bury the window band,
         the band is WITHHELD and ships as plain aggregate — no source frame
         shows glazing emerging from the dirt (fleets precedent, counted). */
      if (winFoot < gHi) {
        bandQuad(spanBin, fr, 0, storeyFoot, slabFoot, T.aggregate, T.aggregate);
        counts.facadeWithheldBands++;
        continue;
      }
      bandQuad(winBin, fr, D.openingProud, winFoot, slabFoot,
        T.window, T.window);
      counts.facadeWindowRuns++;
      bandQuad(spanBin, fr, 0, storeyFoot, winFoot, T.aggregate, T.aggregate);
      counts.facadeSpandrelRuns++;
    }
    /* The skirt keeps the treated wall's foot under the drawn dirt. */
    const foot = ST.footRepo;
    if (gLo - D.skirtDepth < foot) {
      bandQuad(bins.skirt, fr, 0, gLo - D.skirtDepth, foot,
        T.aggregate, T.aggregate);
      counts.skirtRuns++;
    }
  }

  const facades = new THREE.Group();
  facades.name = "bonner-facades";
  for (const [key, mat, name] of [
    ["slabSourced", cast(hue("creamSlab")), "bonner-facade-slab-sourced"],
    ["slabEstimated", cast(hue("creamSlab")), "bonner-facade-slab-estimated"],
    ["windowSourced", glassOf(hue("windowBand")), "bonner-facade-window-sourced"],
    ["windowEstimated", glassOf(hue("windowBand")), "bonner-facade-window-estimated"],
    ["spandrelSourced", aggregate(hue("goldAggregate")), "bonner-facade-spandrel-sourced"],
    ["spandrelEstimated", aggregate(hue("goldAggregate")), "bonner-facade-spandrel-estimated"],
    ["wing", aggregate(hue("goldAggregate")), "bonner-wing-wall-estimated"],
    ["shaft", aggregate(hue("goldAggregate")), "bonner-shaft-wall-estimated"],
    ["skirt", aggregate(hue("goldAggregate")), "bonner-facade-skirt-estimated"],
  ]) {
    if (!bins[key].runs) continue;
    const mesh = new THREE.Mesh(bandGeometry(bins[key]), mat);
    if (!name.includes("window")) {
      mesh.castShadow = mesh.receiveShadow = true;
    }
    mesh.name = name;
    facades.add(mesh);
  }
  group.add(facades);

  /* ----------------------------------------------------------- roof zone
     THE MODULE CARRIES THE WHOLE MEASURED MASS (R4 visual round): the GIS
     prism for m:80,205 is a declared skipGis retirement and photo-bonner
     REPLACES_MEASURED, so the two measured roof planes and the step wall
     between them are real surfaces here — the critic must see the 7.71 m
     step edge and its shadow, and nothing may be lost when the prism goes. */
  const roofzone = new THREE.Group();
  roofzone.name = "bonner-roofzone";
  {
    const W = B.wing;
    /* THE JUNCTION LINE IS DERIVED, NEVER TYPED: the bar's own west edge is
       the min x of every ring vertex clear of the wing's z band. One clip at
       that line yields two clean plates — the survey's wing/bar seam is a
       sloped edge, and a z-clip there leaves a knife-blade sliver of "main
       plate" floating over the wing roof (first attempt, measured). The 0.2 m
       of overlap ribbon east of the line reads as the main plate's coping
       over the step wall. */
    let barWestX = Infinity;
    for (const [vx, vz] of ring) {
      if (vz < W.z0 - 0.5 || vz > W.z1 + 0.5) barWestX = Math.min(barWestX, vx);
    }
    const mainPiece = clipHalf(ring, "x", barWestX, false);
    if (mainPiece) {
      const geo = ringPlate(mainPiece, ST.plateRepo, FA.slabDepth, T.slab);
      if (geo) {
        const mesh = new THREE.Mesh(geo,
          lib().get("decomposedGranite", { color: hue("roofBallast") }));
        mesh.castShadow = mesh.receiveShadow = true;
        mesh.name = "bonner-roof-main-sourced";
        roofzone.add(mesh);
        counts.roofPlatesMain++;
      }
    }
    const wingPiece = clipHalf(ring, "x", barWestX, true);
    if (wingPiece) {
      const geo = ringPlate(wingPiece, FA.wingRoofRepo, FA.slabDepth, T.slab);
      if (geo) {
        const mesh = new THREE.Mesh(geo, cast(hue("wingRoof")));
        mesh.castShadow = mesh.receiveShadow = true;
        mesh.name = "bonner-roof-wing-sourced";
        roofzone.add(mesh);
        counts.roofPlatesWing++;
      }
    }

    /* THE STEP WALL: the main bar's west face above the wing roof, from the
       wing's measured 28.0 plane to the measured plate — 7.71 m of building
       the retired prism used to fake. Treated with the same [estimated]
       extension the west face wears, on its own provenance-named meshes,
       offset a wallOffset west of the junction plane so it clears the two
       plates' own side skins. */
    const stepBins = { slab: bin(), window: bin(), spandrel: bin() };
    const stepFr = edgeFrame(
      [barWestX - D.wallOffset, W.z0], [barWestX - D.wallOffset, W.z1], ccw);
    /* The frame's outward normal must face west (-x): under the ring's own
       winding rule the synthetic junction edge is wound z0 -> z1 — asserted
       rather than assumed, because a flipped normal is an inside-out wall. */
    if (stepFr.nx > 0) {
      throw new Error("campus-photo-bonner: the step wall's outward normal faces into the building — the synthetic edge winding no longer matches the ring's");
    }
    for (let st = 0; st < ST.storeys; st++) {
      const top = ST.plateRepo - st * ST.storey;
      if (top <= FA.wingRoofRepo + 1e-9) break;
      const storeyFoot = Math.max(top - ST.storey, FA.wingRoofRepo);
      const slabFoot = top - FA.slabDepth;
      bandQuad(stepBins.slab, stepFr, 0, Math.max(slabFoot, FA.wingRoofRepo), top,
        T.slab, T.slab);
      counts.stepSlabRuns++;
      if (slabFoot <= FA.wingRoofRepo) continue;
      const winFoot = Math.max(slabFoot - FA.windowOfStorey * ST.storey, FA.wingRoofRepo);
      bandQuad(stepBins.window, stepFr, D.openingProud, winFoot, slabFoot,
        T.window, T.window);
      counts.stepWindowRuns++;
      if (winFoot > FA.wingRoofRepo) {
        bandQuad(stepBins.spandrel, stepFr, 0, Math.max(storeyFoot, FA.wingRoofRepo),
          winFoot, T.aggregate, T.aggregate);
        counts.stepSpandrelRuns++;
      }
    }
    for (const [key, mat, name] of [
      ["slab", cast(hue("creamSlab")), "bonner-step-slab-estimated"],
      ["window", glassOf(hue("windowBand")), "bonner-step-window-estimated"],
      ["spandrel", aggregate(hue("goldAggregate")), "bonner-step-spandrel-estimated"],
    ]) {
      if (!stepBins[key].runs) continue;
      const mesh = new THREE.Mesh(bandGeometry(stepBins[key]), mat);
      if (key !== "window") mesh.castShadow = mesh.receiveShadow = true;
      mesh.name = name;
      roofzone.add(mesh);
    }
  }
  group.add(roofzone);

  /* -------------------------------------------------------------- spine */
  const SP = S.spine;
  const spineGroup = new THREE.Group();
  spineGroup.name = "bonner-spine";
  if (SP.built) {
    const tilt = (SP.louvreTiltDeg * Math.PI) / 180;
    const lean = Math.PI / 2 - tilt;
    const len = SP.crest / Math.cos(lean);
    const bladeGeo = new THREE.BoxGeometry(SP.x1 - SP.x0, len, D.bladeThickness);
    const bladeMat = cast(hue("louvrePrecast"));
    const pitch = (SP.z1 - SP.z0) / SP.count;
    for (let i = 0; i < SP.count; i++) {
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.rotation.x = lean;
      blade.position.set((SP.x0 + SP.x1) / 2, ST.plateRepo + SP.crest / 2,
        SP.z0 + pitch * (i + 0.5));
      blade.castShadow = blade.receiveShadow = true;
      blade.name = "bonner-spine-louvre-sourced";
      spineGroup.add(blade);
      counts.spineBladesBuilt++;
    }
  }
  group.add(spineGroup);

  /* ---------------------------------------------------------- breezeway */
  const BW = S.breezeway;
  const chains = section.measured.breezeway.chains;
  const bw = new THREE.Group();
  bw.name = "bonner-breezeway";
  const plateMat = cast(hue("deckConcrete"));
  const vaultMat = cast(hue("vaultConcrete"));
  const canopyMat = cast(hue("canopyTop"));
  const railMat = steel(hue("railPaint"));

  /* Deck plates: each rides its strand's OWN ring, clipped at the Mayer face
     (decks 1-2) or trimmed at its last measured cell (deck 3, gap g8). */
  const railBinSourced = bin();
  const railBinEstimated = bin();
  BW.decks.forEach((deck, di) => {
    const strand = chains[deck.strand];
    const closed = strand.ring.concat([strand.ring[0]]);
    const zEnd = deck.tier === "estimated" ? D.deck3TrimZ : BW.landZ;
    const clipped = clipRingZ(closed, zEnd);
    if (!clipped) return;
    const geo = ringPlate(clipped, deck.repo, BW.plateThickness, T.deck);
    if (!geo) return;
    const mesh = new THREE.Mesh(geo, plateMat);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.name = `bonner-breezeway-deck-${di + 1}-${deck.tier}`;
    bw.add(mesh);
    counts.decks++;

    /* Picket railings along the plate edge — not at the clip line (the deck
       runs into the Mayer face there) and not across the north seam (the
       deck lands on Bonner; repo frame, +z = south). */
    const railBin = deck.tier === "estimated" ? railBinEstimated : railBinSourced;
    const zLo = Math.min(...clipped.map((p) => p[1]));
    for (let e = 0; e < clipped.length - 1; e++) {
      const fr = edgeFrame(clipped[e], clipped[e + 1], ringCcw(clipped));
      if (!(fr.length > 0)) continue;
      const mzE = (fr.az + fr.bz) / 2;
      if (Math.abs(mzE - zEnd) < D.railSkipClip || mzE < zLo + D.railSkipSeam) continue;
      thinQuad(railBin, fr.ax, fr.az, fr.bx, fr.bz,
        deck.repo + BW.railHeight - D.railBar, deck.repo + BW.railHeight,
        T.rail, T.rail);
      counts.railBars++;
      const n = Math.floor(fr.length / BW.picketSpacing);
      for (let i = 1; i < n; i++) {
        const u = (fr.length * i) / n;
        const a = fr.at(u - D.picketWidth / 2, 0);
        const b = fr.at(u + D.picketWidth / 2, 0);
        thinQuad(railBin, a.x, a.z, b.x, b.z,
          deck.repo, deck.repo + BW.railHeight - D.railBar, T.rail, T.rail);
        counts.railPickets++;
      }
    }
  });
  for (const [rb, name] of [
    [railBinSourced, "bonner-breezeway-rail-sourced"],
    [railBinEstimated, "bonner-breezeway-rail-estimated"],
  ]) {
    if (!rb.runs) continue;
    const mesh = new THREE.Mesh(bandGeometry(rb), railMat);
    mesh.name = name;
    bw.add(mesh);
  }

  /* One column per hex cell, derived from each strand's own ring; the flared
     capital carries the umbrella plate at the measured canopy plane. */
  const capitalTopR = (D.capitalFlare * BW.corridor) / 2;
  const hexR = BW.corridor / (2 * Math.cos(Math.PI / 6));
  const colGeoCache = new Map();
  for (const chainKey of Object.keys(chains)) {
    for (const cell of chainCells(chains[chainKey].ring, BW.corridor, CELL_RULE)) {
      counts.cellsPlanned++;
      /* THE JUNCTION WITHHOLDING (gap g8). The criterion is the COLUMN, not
         the centroid: a cell is withheld when its column's own radius would
         cross the Mayer face (cell.z + columnDiameter/2 > landZ). That trips
         for both strands' terminal cells — 917's centroid (278.2) is itself
         past the face; 918's (277.9) is not, but its column crosses — and
         both centroids are inflated toward the face by the OSM ring overrun.
         The per-level termination at the face is unresolved, so those cells
         are WITHHELD and counted, never clamped to an invented position —
         the archive shows them merging into the face landing. */
      if (cell.z + BW.columnDiameter / 2 > BW.landZ) {
        counts.cellsWithheld++;
        continue;
      }
      const g = ground(cell.x, cell.z);
      if (!Number.isFinite(g)) {
        throw new Error(`campus-photo-bonner: surfaceAt returned ${g} at breezeway cell (${cell.x}, ${cell.z})`);
      }
      const capBase = BW.canopyRepo - BW.plateThickness - BW.capitalDepth;
      const h = capBase - (g - D.footingBury);
      const hKey = h.toFixed(3);
      if (!colGeoCache.has(hKey)) {
        colGeoCache.set(hKey,
          new THREE.CylinderGeometry(BW.columnDiameter / 2, BW.columnDiameter / 2, h, 12));
      }
      const col = new THREE.Mesh(colGeoCache.get(hKey), vaultMat);
      col.position.set(cell.x, g - D.footingBury + h / 2, cell.z);
      col.castShadow = col.receiveShadow = true;
      col.name = "bonner-breezeway-column-sourced";
      bw.add(col);
      counts.columns++;
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(capitalTopR, BW.columnDiameter / 2, BW.capitalDepth, 12),
        vaultMat);
      cap.position.set(cell.x, capBase + BW.capitalDepth / 2, cell.z);
      cap.castShadow = cap.receiveShadow = true;
      cap.name = "bonner-breezeway-capital-sourced";
      bw.add(cap);
      counts.capitals++;
      const hexGeo = new THREE.CylinderGeometry(hexR, hexR, BW.plateThickness, 6);
      const hex = new THREE.Mesh(hexGeo, canopyMat);
      hex.rotation.y = Math.PI / 6;
      hex.position.set(cell.x, BW.canopyRepo - BW.plateThickness / 2, cell.z);
      hex.castShadow = hex.receiveShadow = true;
      hex.name = "bonner-breezeway-canopy-sourced";
      bw.add(hex);
      counts.canopyCells++;
    }
  }

  /* Junction landings: the seam between the chain's north end and Bonner's
     south (court) face, one plate per deck — the decks land NEAR Bonner
     floors 2-4 (per-face landing levels unresolved, gap g8 / arbitration D3). */
  const L = BW.landings;
  const env = section.measured.breezeway.envelope;
  for (const deck of BW.decks) {
    const landRing = [
      [env.x0, L.z0], [env.x1, L.z0], [env.x1, L.z1], [env.x0, L.z1], [env.x0, L.z0],
    ];
    const geo = ringPlate(landRing, deck.repo, BW.plateThickness, T.deck);
    const mesh = new THREE.Mesh(geo, plateMat);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.name = "bonner-breezeway-landing-sourced";
    bw.add(mesh);
    counts.landings++;
  }

  /* The ground vault arcade — the UCOP p11 tier: measured soffit planes west
     and east of the chain, the [estimated] column grid beneath them. */
  for (const [strip, name] of [
    [BW.arcadeWest, "bonner-breezeway-arcade-soffit-west-sourced"],
    [BW.arcadeEast, "bonner-breezeway-arcade-soffit-east-sourced"],
  ]) {
    const top = BW.courtRepo + strip.soffitH;
    const soffitRing = [
      [strip.x0, strip.z0], [strip.x1, strip.z0], [strip.x1, strip.z1],
      [strip.x0, strip.z1], [strip.x0, strip.z0],
    ];
    const mesh = new THREE.Mesh(ringPlate(soffitRing, top, BW.plateThickness, T.vault), vaultMat);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.name = name;
    bw.add(mesh);
    counts.arcadeSoffits++;
    for (const rx of [strip.x0 + D.arcadeInset, strip.x1 - D.arcadeInset]) {
      for (let z = strip.z0 + D.arcadeInset; z <= strip.z1 - D.arcadeInset + 1e-9;
        z += BW.arcadeColumnPitch) {
        const g = ground(rx, z);
        if (!Number.isFinite(g)) {
          throw new Error(`campus-photo-bonner: surfaceAt returned ${g} at arcade column (${rx}, ${z})`);
        }
        const capBase = top - BW.plateThickness - BW.capitalDepth;
        const h = capBase - (g - D.footingBury);
        const col = new THREE.Mesh(
          new THREE.CylinderGeometry(BW.columnDiameter / 2, BW.columnDiameter / 2, h, 12),
          vaultMat);
        col.position.set(rx, g - D.footingBury + h / 2, z);
        col.castShadow = col.receiveShadow = true;
        col.name = "bonner-breezeway-arcade-column-estimated";
        bw.add(col);
        counts.arcadeColumns++;
        const cap = new THREE.Mesh(
          new THREE.CylinderGeometry((D.capitalFlare * BW.arcadeColumnPitch) / 2,
            BW.columnDiameter / 2, BW.capitalDepth, 12),
          vaultMat);
        cap.position.set(rx, capBase + BW.capitalDepth / 2, z);
        cap.castShadow = cap.receiveShadow = true;
        cap.name = "bonner-breezeway-arcade-capital-estimated";
        bw.add(cap);
      }
    }
  }

  /* Face-attached two-level gallery bays (gap g2 limits the extent). */
  for (const [gal, dir] of [[BW.galleryBonner, 1], [BW.galleryMayer, -1]]) {
    const zNear = gal.z;
    const zFar = gal.z + dir * BW.galleryDepth;
    const z0 = Math.min(zNear, zFar);
    const z1 = Math.max(zNear, zFar);
    for (const deck of BW.decks.slice(0, 2)) {
      const slabRing = [[gal.x0, z0], [gal.x1, z0], [gal.x1, z1], [gal.x0, z1], [gal.x0, z0]];
      const mesh = new THREE.Mesh(ringPlate(slabRing, deck.repo, BW.plateThickness, T.deck),
        plateMat);
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.name = "bonner-gallery-slab-estimated";
      bw.add(mesh);
      counts.gallerySlabs++;
    }
    const postZ = gal.z + dir * (BW.galleryDepth - D.galleryPostSetback);
    for (let x = gal.x0 + D.galleryPostInset; x <= gal.x1 - D.galleryPostInset + 1e-9;
      x += BW.arcadeColumnPitch) {
      const g = ground(x, postZ);
      if (!Number.isFinite(g)) {
        throw new Error(`campus-photo-bonner: surfaceAt returned ${g} at gallery post (${x}, ${postZ})`);
      }
      const topY = BW.decks[1].repo - BW.plateThickness;
      const h = topY - (g - D.footingBury);
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(BW.columnDiameter / 2, BW.columnDiameter / 2, h, 12),
        vaultMat);
      post.position.set(x, g - D.footingBury + h / 2, postZ);
      post.castShadow = post.receiveShadow = true;
      post.name = "bonner-gallery-post-estimated";
      bw.add(post);
      counts.galleryPosts++;
    }
  }

  /* The west podium stair cascade, terraced onto the DRAWN slope: the
     measured 3.6 m step plans 24 risers; the decimated terrain carries what
     it carries and both counts are declared and gated. */
  const SS = S.stairs;
  const zMid = (SS.z0 + SS.z1) / 2;
  const gTop = ground(SS.x0, zMid);
  const gFoot = ground(SS.x1, zMid);
  if (!Number.isFinite(gTop) || !Number.isFinite(gFoot)) {
    throw new Error("campus-photo-bonner: surfaceAt returned nothing finite on the podium stair run");
  }
  const drop = gTop - gFoot;
  const nSteps = Math.max(1, Math.floor(drop / SS.rise));
  const treadRun = (SS.x1 - SS.x0) / nSteps;
  const stairMat = lib().get("pavingConcreteUnit", { color: hue("walkPaving"), repeat: 1 / T.paving });
  for (let i = 0; i < nSteps; i++) {
    const x0 = SS.x0 + i * treadRun;
    const x1 = x0 + treadRun;
    let want = gTop - (i + 1) * SS.rise;
    let under = -Infinity;
    for (const sx of [x0, (x0 + x1) / 2, x1]) {
      for (const sz of [SS.z0, zMid, SS.z1]) {
        const g = ground(sx, sz);
        if (Number.isFinite(g) && g > under) under = g;
      }
    }
    const top = Math.max(want, under + overlayLift(D.bedRung));
    const geo = new THREE.BoxGeometry(x1 - x0, D.stairSlabThickness, SS.z1 - SS.z0);
    const step = new THREE.Mesh(geo, stairMat);
    step.position.set((x0 + x1) / 2, top - D.stairSlabThickness / 2, zMid);
    step.castShadow = step.receiveShadow = true;
    step.name = "bonner-stairs-estimated";
    bw.add(step);
    counts.stairsBuilt++;
  }
  group.add(bw);

  /* ------------------------------------------------------------- ground */
  const gr = new THREE.Group();
  gr.name = "bonner-ground";
  const lift = overlayLift(D.bedRung);
  const groundMat = {
    lawn: () => lib().get("decomposedGranite", { color: hue("courtLawn"), repeat: 1 / T.lawn }),
    paving: () => lib().get("pavingConcreteUnit", { color: hue("walkPaving"), repeat: 1 / T.paving }),
  };
  const groundName = { lawn: "bonner-lawn-sourced", paving: "bonner-walk-sourced" };
  for (const g of section.measured.groundRings.owned) {
    const geo = drapeRing(g.rings, ground, lift, D.bedSeg, D.bedMaxDepth);
    if (!geo) continue;
    const make = groundMat[g.role];
    if (!make) {
      throw new Error(`campus-photo-bonner: surveyed ring #${g.index} declares role "${g.role}", which this module has no material for`);
    }
    const mesh = new THREE.Mesh(geo, applyOverlayDepth(make(), D.bedRung));
    mesh.renderOrder = OVERLAY[D.bedRung].renderOrder;
    mesh.receiveShadow = true;
    mesh.name = groundName[g.role];
    gr.add(mesh);
    if (g.role === "lawn") counts.lawns++;
    else counts.walks++;
  }
  /* The hex paving chain drapes on the chain rings' OWN surveyed outline. */
  const pavingMat = applyOverlayDepth(
    lib().get("pavingConcreteUnit", { color: hue("hexPaving"), repeat: 1 / T.paving }),
    D.bedRung);
  for (const chainKey of Object.keys(chains)) {
    const closed = chains[chainKey].ring.concat([chains[chainKey].ring[0]]);
    const geo = drapeRing([closed], ground, lift + overlayLift(D.bedRung) * 0.5,
      D.bedSeg, D.bedMaxDepth);
    if (!geo) continue;
    const mesh = new THREE.Mesh(geo, pavingMat);
    mesh.renderOrder = OVERLAY[D.bedRung].renderOrder;
    mesh.receiveShadow = true;
    mesh.name = "bonner-court-hexpaving-sourced";
    gr.add(mesh);
    counts.pavingChains++;
  }
  group.add(gr);

  scene?.add(group);
  return { group, counts };
}
