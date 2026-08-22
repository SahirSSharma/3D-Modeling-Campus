// Natural Sciences Building, Revelle College — the Bohlin Cywinski Jackson
// laboratory building of 2003, from the 2014 point-cloud re-measure and dated
// photographs. INVENTED class: nothing measured reads from this section.
//
// THE FOUR THINGS THIS FILE EXISTS TO GET RIGHT:
//
//   1. IT IS NOT A 1960s REVELLE BUILDING. Bohlin Cywinski Jackson with Bundy
//      & Thompson, completed 2003, 180,000 SF. Cast-in-place concrete piers,
//      aluminium horizontal sunshades, a blue-tinted curtain wall, a
//      terracotta corrugated rainscreen plinth and a thin overhanging roof
//      slab. No board-form mushroom arcade and no Revelle palette. The archive
//      rung that carries every other building in this zone is EMPTY here,
//      because in the collections' subject period this building did not exist.
//
//   2. THE ROOF IS AT 27.10 m AND THE DRAWN PRISM IS AT 30.3. campus-massing
//      extrudes the GIS ring flat to massHeights 30.3 — a height that is the
//      p98 over a plate whose real plane is 27.10, whose mechanical spine is
//      29.35/29.37, whose upper blocks are 30.03, and whose west lobe is
//      4.60-7.13. A single flat lid is wrong about every one of those at once.
//      This module carries the measured envelope, exactly as campus-photo-urey
//      and campus-photo-bonner do for their masses; the prism's retirement is
//      DECLARED for the merge to wire (skipGis + REPLACES_MEASURED) and is not
//      done here. Nothing measured is moved and nothing is averaged.
//
//   3. THERE IS NO SEVENTH STOREY. The 4.70 m between the GIS formula height
//      and massHeights decomposes to 0.00: +1.50 to the real roof plane, +2.93
//      to the mechanical blocks, +0.27 for the p98 rule overshooting into
//      stack returns. Six floors at 4.4167 m, and the facades close on 27.10.
//
//   4. A FACADE MAY ONLY HANG ON AN EDGE THAT LIES ON THE SURVEY RING, OR
//      ON A CUT THAT STANDS PROUD OF A LOWER NEIGHBOUR. The roof planes are
//      the ring clipped by declared boxes and the boxes tile the plane, so
//      the pieces sum exactly to the ring — but a clip introduces CUT edges.
//      A cut between two pieces of the SAME height is interior and is
//      refused. A cut at a height step (the west lobe under the 27.10 mass)
//      is an elevation from the lower roof up, and is dressed as the
//      building's own sourced pattern labelled [estimated]. The builder
//      lays no fixed bay pitch: each face takes its wing's own column grid,
//      which is that wing's surveyed span over a whole number of 24 ft
//      nominal bays.
//
// NO DIMENSION AND NO COLOUR LIVES IN THIS FILE. Every metre comes from the
// section's `derivations` / `estimates` / `reads` / `draw`; every hex from
// `colors` through a guard that throws on an undeclared role. Surfaces come
// from the procedural material library and every map is code-generated.
import * as THREE from "../vendor/three/three.module.min.js";
import { applyOverlayDepth, overlayLift, OVERLAY } from "./campus-overlay.js";
import { sharedMaterialLibrary } from "./campus-materials.js";

let LIB = null;
const lib = () => (LIB ??= sharedMaterialLibrary(THREE));

/* ------------------------------------------------------------ geometry */

const ringArea = (ring) => {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return Math.abs(a / 2);
};

/** Signed area of a closed ring: positive is counter-clockwise in (x, z). */
const ringCcw = (ring) => {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return a > 0;
};

/**
 * The plan of one piece: the surveyed ring clipped by one axis-aligned box
 * (Sutherland-Hodgman). The section's boxes TILE the plane, so the pieces sum
 * exactly to the ring's own area and no plan edge is invented — every boundary
 * of a piece is either the survey's own polyline or a declared cut, and only
 * the former is ever dressed.
 */
function clipRingBox(ring, box) {
  const [[bx0, bz0], [bx1, bz1]] = box;
  let pts = ring.slice(0, -1);
  for (const side of [(p) => p[0] - bx0, (p) => bx1 - p[0], (p) => p[1] - bz0, (p) => bz1 - p[1]]) {
    if (!pts.length) break;
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const da = side(a);
      const db = side(b);
      if (da >= 0) out.push(a);
      if ((da >= 0) !== (db >= 0)) {
        const t = da / (da - db);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    pts = out;
  }
  let clean = [];
  for (const p of pts) {
    const last = clean[clean.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 1e-9) clean.push(p);
  }
  while (clean.length > 1 &&
    Math.hypot(clean[0][0] - clean[clean.length - 1][0], clean[0][1] - clean[clean.length - 1][1]) <= 1e-9) {
    clean.pop();
  }
  /* REMOVE THE ZERO-AREA FLAPS. Sutherland-Hodgman on a concave ring keeps
     boundary excursions as out-and-back spikes along the clip line: zero area,
     but their edges are real to the wall walker, which then hangs a wall on a
     face that does not exist. A spike is a vertex whose two edges retrace each
     other; remove until stable. (The Urey lesson, carried whole.) */
  for (let changed = true; changed && clean.length >= 3;) {
    changed = false;
    for (let i = 0; i < clean.length; i++) {
      const a = clean[(i + clean.length - 1) % clean.length];
      const b = clean[i];
      const c = clean[(i + 1) % clean.length];
      const d1x = b[0] - a[0];
      const d1z = b[1] - a[1];
      const d2x = c[0] - b[0];
      const d2z = c[1] - b[1];
      const l1 = Math.hypot(d1x, d1z);
      const l2 = Math.hypot(d2x, d2z);
      if (!(l1 > 0) || !(l2 > 0)) { clean.splice(i, 1); changed = true; break; }
      const cross = (d1x * d2z - d1z * d2x) / (l1 * l2);
      const dot = (d1x * d2x + d1z * d2z) / (l1 * l2);
      if (Math.abs(cross) < 1e-4 && dot < 0) { clean.splice(i, 1); changed = true; break; }
    }
  }
  if (clean.length < 3) return null;
  clean.push([clean[0][0], clean[0][1]]);
  if (ringArea(clean) < 1e-6) return null;
  return clean;
}

/** Outward frame of one polygon edge, fixed by the polygon's own winding. */
function edgeFrame(a, b, ccw) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const tx = (b[0] - a[0]) / length;
  const tz = (b[1] - a[1]) / length;
  const s = ccw ? 1 : -1;
  return {
    ax: a[0], az: a[1], bx: b[0], bz: b[1], length, tx, tz, nx: s * tz, nz: -s * tx,
    at(u, w) { return { x: a[0] + tx * u + this.nx * w, z: a[1] + tz * u + this.nz * w }; },
  };
}

/**
 * THE MITRED OFFSET RING. A band drawn `off` proud of each edge independently
 * opens a bright wedge at every plane change; offsetting each edge's supporting
 * LINE and intersecting consecutive lines makes adjacent runs share their
 * corner exactly.
 */
function offsetRing(ring, off, ccw) {
  const es = [];
  /* `off` may be one number for the whole ring or one per edge. A PER-EDGE
     offset is what keeps the roof slab honest: an interior CUT between two
     pieces of the same plane gets offset 0, so no fascia band and no membrane
     inset ever appears along a line that is not a wall. */
  const offAt = (k) => (Array.isArray(off) ? off[k] : off);
  let scale = 0;
  for (let k = 0; k < ring.length - 1; k++) {
    const [ax, az] = ring[k];
    const [bx, bz] = ring[k + 1];
    const L = Math.hypot(bx - ax, bz - az);
    if (!(L > 0)) continue;
    const s = ccw ? 1 : -1;
    const nx = (s * (bz - az)) / L;
    const nz = (-s * (bx - ax)) / L;
    const o = offAt(k);
    scale = Math.max(scale, Math.abs(o));
    es.push({
      a: [ax + nx * o, az + nz * o], b: [bx + nx * o, bz + nz * o],
      d: [(bx - ax) / L, (bz - az) / L], off: o,
    });
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
    if (Math.hypot(px - cur.b[0], pz - cur.b[1]) > scale * 8) continue;
    cur.b = [px, pz];
    nxt.a = [px, pz];
  }
  return es;
}

/** The closed polygon those mitred segments trace. */
const offsetPlan = (segs) => {
  const p = segs.map((s) => [s.a[0], s.a[1]]);
  p.push([p[0][0], p[0][1]]);
  return p;
};

/** One face quad in world coordinates with UVs already in tile units. */
function faceQuad(out, fr, off, u0, u1, yLo, yHi, tileU, tileV) {
  if (!(yHi > yLo) || !(u1 > u0)) return;
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

/** Horizontal lid over a plan polygon; `down` flips it to face the ground. */
function lidGeometry(out, plan, y, tile, down) {
  const contour = plan.slice(0, -1).map(([x, z]) => new THREE.Vector2(x, -z));
  if (contour.length < 3) return;
  let faces;
  try {
    faces = THREE.ShapeUtils.triangulateShape(contour, []);
  } catch {
    return;
  }
  for (const tri of faces) {
    const order = down ? [tri[2], tri[1], tri[0]] : tri;
    for (const idx of order) {
      out.pos.push(contour[idx].x, y, -contour[idx].y);
      out.uv.push(contour[idx].x / tile, -contour[idx].y / tile);
    }
  }
  out.runs++;
}

/**
 * A SURVEYED GROUND RING, DRAPED. The ring's own boundary is triangulated the
 * way campus-world.js does it, split until no edge exceeds `seg`, every vertex
 * on its own `surfaceAt` — so a carpet follows rolling ground instead of
 * hovering over it at one datum.
 */
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
        throw new Error(`campus-photo-natsci: surfaceAt returned ${g} inside a surveyed ground ring at (${p.x}, ${p.y})`);
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

function bandGeometry(bin) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(bin.pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(bin.uv, 2));
  geo.computeVertexNormals();
  return geo;
}

/** Median drawn surface along a ring — the mass's ONE rim datum. */
function rimDatum(ring, ground, step) {
  const gs = [];
  for (let k = 0; k < ring.length - 1; k++) {
    const [ax, az] = ring[k];
    const [bx, bz] = ring[k + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
    for (let i = 0; i < n; i++) {
      const g = ground(ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n);
      if (Number.isFinite(g)) gs.push(g);
    }
  }
  if (!gs.length) {
    throw new Error("campus-photo-natsci: surfaceAt returned nothing finite along the mass ring");
  }
  gs.sort((a, b) => a - b);
  return gs[Math.floor(gs.length / 2)];
}

/**
 * Proud subsegments of a partition cut: the overlap with each LOWER
 * plane's clip box, where this edge faces into that box. Same-height
 * cuts return nothing and stay refused. A mixed edge (mainEast's west
 * clip against both a full-height strip and the lobe) yields only the
 * proud frontage.
 */
function proudSegments(fr, thisH, planes, minLen, tol, probe) {
  const out = [];
  const along = (x, z) => (x - fr.ax) * fr.tx + (z - fr.az) * fr.tz;
  for (const plane of Object.values(planes)) {
    if (!(thisH > plane.h)) continue;
    for (const box of plane.clip) {
      const u0 = Math.max(0, Math.min(
        along(box[0][0], box[0][1]), along(box[0][0], box[1][1]),
        along(box[1][0], box[0][1]), along(box[1][0], box[1][1])));
      const u1 = Math.min(fr.length, Math.max(
        along(box[0][0], box[0][1]), along(box[0][0], box[1][1]),
        along(box[1][0], box[0][1]), along(box[1][0], box[1][1])));
      if (!(u1 - u0 > minLen)) continue;
      const mid = fr.at((u0 + u1) / 2, 0);
      if (mid.x < box[0][0] - tol || mid.x > box[1][0] + tol
        || mid.z < box[0][1] - tol || mid.z > box[1][1] + tol) continue;
      const ox = mid.x + fr.nx * probe;
      const oz = mid.z + fr.nz * probe;
      if (!inBox(ox, oz, box)) continue;
      out.push({ u0, u1, neighborH: plane.h });
    }
  }
  return out;
}

/**
 * IS THIS EDGE ON THE SURVEY RING? The partition's same-height cut edges
 * are interior and are not elevations; only an edge that lies along the
 * surveyed polyline — or a cut that stands proud of a lower neighbour —
 * may carry a facade. Both endpoints AND the midpoint must sit within
 * `tol` of one ring segment, so a chord across a re-entrant corner cannot
 * pass.
 */
function onSurveyRing(fr, ring, tol) {
  const near = (x, z) => {
    for (let k = 0; k < ring.length - 1; k++) {
      const [ax, az] = ring[k];
      const [bx, bz] = ring[k + 1];
      const dx = bx - ax;
      const dz = bz - az;
      const l2 = dx * dx + dz * dz;
      let t = l2 ? ((x - ax) * dx + (z - az) * dz) / l2 : 0;
      t = Math.max(0, Math.min(1, t));
      if (Math.hypot(x - (ax + dx * t), z - (az + dz * t)) <= tol) return true;
    }
    return false;
  };
  const m = fr.at(fr.length / 2, 0);
  return near(fr.ax, fr.az) && near(fr.bx, fr.bz) && near(m.x, m.z);
}

const inBox = (x, z, [[x0, z0], [x1, z1]]) => x >= x0 && x <= x1 && z >= z0 && z <= z1;

/** Distance from a point to a ring's polyline, within `tol`. */
function nearRing(x, z, r, tol) {
  for (let k = 0; k < r.length - 1; k++) {
    const [ax, az] = r[k];
    const [bx, bz] = r[k + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const l2 = dx * dx + dz * dz;
    let t = l2 ? ((x - ax) * dx + (z - az) * dz) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    if (Math.hypot(x - (ax + dx * t), z - (az + dz * t)) <= tol) return true;
  }
  return false;
}

/** Even-odd point-in-ring, used to keep roof decals on their own plate. */
function inRing(x, z, r) {
  let ins = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, zi] = r[i];
    const [xj, zj] = r[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
}

/* --------------------------------------------------------------- api */

/**
 * Build the Natural Sciences Building's photo-sourced detail. `photo` is the
 * loaded photo-detail document; this reads only its `natsci` key and returns
 * `{ group, counts }`. Everything on the ground seats on `surfaceAt` — the
 * height of the DRAWN triangle — and never on `heightAt`.
 */
export function createPhotoNatsci(scene, { photo, heightAt, surfaceAt } = {}) {
  const group = new THREE.Group();
  group.name = "photo-natsci";
  const section = photo?.natsci;
  if (!section) {
    scene?.add(group);
    return { group, counts: {} };
  }
  const ground = surfaceAt || heightAt;
  if (typeof ground !== "function") {
    throw new Error("campus-photo-natsci: needs surfaceAt (or heightAt) to place on the ground");
  }
  /* PRE-MERGE GUARD. A section that predates this build has none of the keys
     below, and half a building drawn off a half-section is the silent failure
     this repo keeps failing on. Build NOTHING and name what is missing, so the
     merge cannot half-land unnoticed. */
  const missing = ["measured", "derivations", "estimates", "reads", "draw", "system", "colors", "ground"]
    .filter((k) => !section[k]);
  if (section.system && !section.system.planes) missing.push("system.planes");
  if (section.system && !section.system.grids) missing.push("system.grids");
  if (section.system && !section.system.mech) missing.push("system.mech");
  if (section.system && !section.system.faceRules) missing.push("system.faceRules");
  if (!section.measured?.natsci?.ring) missing.push("measured.natsci.ring");
  if (missing.length) {
    scene?.add(group);
    return { group, counts: { pendingMerge: missing.join(",") } };
  }

  const { colors, draw: D, system: SY } = section;
  /* EVERY COLOUR GOES THROUGH HERE. campus-materials.js defaults an unset
     color to opaque white without a warning, so an undeclared role throws. */
  const hue = (role) => {
    const v = colors[role];
    if (typeof v !== "string") {
      throw new Error(`campus-photo-natsci: no colour declared for role "${role}" — `
        + "an unset role silently becomes white in campus-materials.js");
    }
    return v;
  };
  const T = D.tiles;
  const FIG = section.derivations.figures;
  const fig = (k) => {
    const f = FIG[k];
    if (!f || typeof f.value !== "number") {
      throw new Error(`campus-photo-natsci: no derived figure "${k}"`);
    }
    return f.value;
  };
  /* THE FACADE LAYERING INVARIANT: wall < field < band, always. Every layer's
     offset is measured FROM THE WALL FACE outward, so no declared value can
     put a treatment plane behind the wall that carries it. */
  const FIELD_OFF = D.wallOffset + D.fieldStandoff;
  const BAND_OFF = FIELD_OFF + D.bandStandoff;

  const ring = section.measured.natsci.ring;
  const rim = rimDatum(ring, ground, D.datumStep);
  const yOf = (h) => rim + h;

  const F = fig("storey.floorToFloor");
  const roofY = yOf(SY.planes.mainEast.h);
  const soffitY = yOf(SY.roof.soffit);

  const bin = () => ({ pos: [], uv: [], runs: 0 });
  const bins = {
    walls: bin(), lobeWalls: bin(), lobeLids: bin(), membrane: bin(),
    fascia: bin(), soffit: bin(), plinth: bin(), curtain: bin(), markings: bin(),
    mowStrip: bin(), dgStrip: bin(),
  };
  /* Box populations, one InstancedMesh each. campus-mid's perf margin is thin,
     so every repeated solid on this building is an instance of one unit cube
     or one unit cylinder and nothing here allocates per-object geometry. */
  const boxes = {};
  const cyls = {};
  const push = (into, role, item) => ((into[role] ??= []).push(item), item);
  const box = (role, item) => push(boxes, role, item);
  const cyl = (role, item) => push(cyls, role, item);

  const counts = {
    planes: 0, planPieces: 0, wallQuads: 0, roofLids: 0, lobeSteps: 0,
    dressedFaces: 0, cutFacesSkipped: 0, estimatedFaces: 0,
    plinthFields: 0, curtainFields: 0, piers: 0, masts: 0, louvreBlades: 0,
    penthouses: 0, mechBlocks: 0, mechBlocksClipped: 0, blowers: 0,
    condensers: 0, condenserFans: 0, ducts: 0, markingRuns: 0,
    canopies: 0, canopyColumns: 0, steps: 0, stairs: 0, stairGuards: 0,
    screenWalls: 0, docks: 0, colonnade: 0, lawns: 0,
  };

  /* -------------------------------------------------- the roof planes */

  const dressable = [];
  for (const [name, plane] of Object.entries(SY.planes)) {
    counts.planes++;
    const top = yOf(plane.h);
    for (const clipBox of plane.clip) {
      const plan = clipRingBox(ring, clipBox);
      if (!plan) continue;
      counts.planPieces++;
      const ccw = ringCcw(plan);
      /* Wall foot: below the LOWEST drawn surface along this piece, so the
         mass cannot hover on any terrain. */
      let lo = Infinity;
      for (let k = 0; k < plan.length - 1; k++) {
        const [ax, az] = plan[k];
        const [bx, bz] = plan[k + 1];
        const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / D.datumStep));
        for (let i = 0; i <= n; i++) {
          const g = ground(ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n);
          if (Number.isFinite(g) && g < lo) lo = g;
        }
      }
      const foot = lo - D.skirtDepth;
      const wallBin = plane.dressed ? bins.walls : bins.lobeWalls;
      const segs = offsetRing(plan, D.wallOffset, ccw);
      for (const seg of segs) {
        const fr = edgeFrame(seg.a, seg.b, ccw);
        if (!(fr.length > 0)) continue;
        faceQuad(wallBin, fr, 0, 0, fr.length, foot, top, T.board, T.boardCourse);
        counts.wallQuads++;
      }
      if (plane.dressed) {
        /* WHICH EDGES OF THIS PIECE ARE REAL WALLS. The partition's boxes tile
           the plane so the pieces sum exactly to the ring, but that leaves CUT
           edges between two pieces of the SAME plane. A cut is interior: it
           carries no fascia, no membrane inset and no walkway marking, or the
           roof would grow a stripe along a line that is not there. */
        const isWall = [];
        for (let k = 0; k < plan.length - 1; k++) {
          const fr = edgeFrame(plan[k], plan[k + 1], ccw);
          isWall.push(fr.length > 0 && onSurveyRing(fr, ring, D.ringTolerance));
        }
        /* THE MEMBRANE, inset from the real rim only, so it cannot poke
           through the fascia band that wraps it — and flush at every cut, so
           two pieces of one plate meet without a hairline. */
        lidGeometry(bins.membrane,
          offsetPlan(offsetRing(plan, isWall.map((w) => (w ? -D.plateInset : 0)), ccw)),
          top + D.membraneLift, T.membrane);
        /* THE THIN OVERHANGING SLAB: a fascia band and an exposed soffit on a
           plan pushed OUT past the piers. No parapet is drawn, because no
           frame on any rung shows one — which is what makes 27.10 m the top of
           the slab and not the top of an upstand. */
        const eave = offsetRing(plan, isWall.map((w) => (w ? SY.roof.overhang : 0)), ccw);
        for (const seg of eave) {
          const fr = edgeFrame(seg.a, seg.b, ccw);
          if (!(fr.length > 0) || !(seg.off > 0)) continue;
          faceQuad(bins.fascia, fr, 0, 0, fr.length, soffitY, top, T.panel, T.panel);
        }
        lidGeometry(bins.soffit, offsetPlan(eave), soffitY, T.panel, true);
        counts.roofLids++;
        /* The pale safety-walkway markings bordering the membrane. */
        const mark = D.plateInset + SY.mech.walkway.inset;
        const walk = offsetRing(plan, isWall.map((w) => (w ? -mark : 0)), ccw);
        for (const seg of walk) {
          const fr = edgeFrame(seg.a, seg.b, ccw);
          if (!(fr.length > SY.mech.walkway.width) || !(seg.off < 0)) continue;
          const a = fr.at(0, 0);
          const b = fr.at(fr.length, 0);
          const c = fr.at(fr.length, -SY.mech.walkway.width);
          const d = fr.at(0, -SY.mech.walkway.width);
          /* A NEGATIVE OFFSET INVERTS ON A THIN SLIVER. Where a piece is
             narrower than twice the inset, the marking band folds outside its
             own plan and would hover beside the building at roof height. Every
             corner is tested against the piece's plan and the whole band is
             dropped rather than trimmed — a marking is a border, and half of
             one is not a shorter border. */
          if ([a, b, c, d].some((v) => !inRing(v.x, v.z, plan))) continue;
          const y = top + D.markingLift;
          for (const [p, q, r] of [[a, b, c], [a, c, d]]) {
            for (const v of [p, q, r]) { bins.markings.pos.push(v.x, y, v.z); bins.markings.uv.push(v.x, v.z); }
          }
          bins.markings.runs++;
          counts.markingRuns++;
        }
        /* Collect the dressable elevations of this piece. A survey-ring
           edge is an elevation. A cut that stands proud of a lower
           neighbour is an elevation from that neighbour's roof up — the
           west-lobe height step. A same-height cut stays refused. */
        for (let k = 0; k < plan.length - 1; k++) {
          const fr = edgeFrame(plan[k], plan[k + 1], ccw);
          if (!(fr.length > D.minFacadeEdge)) continue;
          if (onSurveyRing(fr, ring, D.ringTolerance)) { dressable.push(fr); continue; }
          const proud = proudSegments(fr, plane.h, SY.planes, D.minFacadeEdge,
            D.ringTolerance, fig("grid.cellHalf"));
          if (!proud.length) { counts.cutFacesSkipped++; continue; }
          for (const seg of proud) {
            const a = fr.at(seg.u0, 0);
            const b = fr.at(seg.u1, 0);
            const sub = edgeFrame([a.x, a.z], [b.x, b.z], ccw);
            if (!(sub.length > D.minFacadeEdge)) continue;
            sub.nx = fr.nx;
            sub.nz = fr.nz;
            sub.clipH = seg.neighborH;
            sub.stepReturn = true;
            dressable.push(sub);
          }
        }
      } else {
        lidGeometry(bins.lobeLids, plan, top, T.membrane);
        counts.roofLids++;
      }
    }
  }

  /* THE WEST LOBE'S TWO MEASURED STEPS, standing on its base plane. */
  for (const step of SY.lobeSteps) {
    const plan = [[step.x0, step.z0], [step.x1, step.z0], [step.x1, step.z1], [step.x0, step.z1], [step.x0, step.z0]];
    const ccw = ringCcw(plan);
    const yLo = yOf(SY.planes.low.h);
    const yHi = yOf(step.h);
    for (const seg of offsetRing(plan, D.wallOffset, ccw)) {
      const fr = edgeFrame(seg.a, seg.b, ccw);
      if (!(fr.length > 0)) continue;
      faceQuad(bins.lobeWalls, fr, 0, 0, fr.length, yLo, yHi, T.board, T.boardCourse);
      counts.wallQuads++;
    }
    lidGeometry(bins.lobeLids, plan, yHi, T.membrane);
    counts.lobeSteps++;
    counts.roofLids++;
  }

  /* ------------------------------------------------------- the facades */

  const RULES = SY.faceRules;
  /** Which of the five declared elevations this surveyed edge belongs to. */
  const systemOf = (fr) => {
    const m = fr.at(fr.length / 2, 0);
    if (fr.nz <= -RULES.axisNormal) return "north";
    if (fr.nx <= -RULES.axisNormal) return "west";
    if (fr.nx >= RULES.axisNormal) return m.x > RULES.eastEndMinX ? "eastEnd" : "estimated";
    if (fr.nz >= RULES.axisNormal) return m.z > RULES.southEndMinZ ? "southEnd" : "estimated";
    return "estimated";
  };
  /** The column grid whose axis matches this edge and whose box holds it. */
  const gridOf = (fr) => {
    const m = fr.at(fr.length / 2, 0);
    const axis = Math.abs(fr.tx) >= Math.abs(fr.tz) ? "x" : "z";
    for (const g of Object.values(SY.grids)) {
      if (!g.axis || g.axis !== axis) continue;
      if (inBox(m.x, m.z, g.box)) return g;
    }
    return null;
  };
  /** The highest drawn surface under a face — a band below it would be buried. */
  const gmaxOf = (fr) => {
    let g = -Infinity;
    for (let i = 0; i <= D.clipSamples; i++) {
      const p = fr.at((fr.length * i) / D.clipSamples, 0);
      const v = ground(p.x, p.z);
      if (Number.isFinite(v) && v > g) g = v;
    }
    return g;
  };

  /** Where this face's own column grid puts its piers, along the face. */
  const stationsOn = (fr, grid, pad) => {
    const out = [];
    if (!grid) return out;
    const along = (p) => (p.x - fr.ax) * fr.tx + (p.z - fr.az) * fr.tz;
    for (let k = 0; k <= grid.bays; k++) {
      const c = grid.origin + k * grid.pitch;
      const u = along(grid.axis === "x" ? { x: c, z: fr.az } : { x: fr.ax, z: c });
      if (u >= -pad && u <= fr.length + pad) out.push(Math.max(0, Math.min(fr.length, u)));
    }
    return out;
  };
  /** The lowest drawn surface under a face — the foot every skirt drops below. */
  const gminOf = (fr) => {
    let g = Infinity;
    for (let i = 0; i <= D.clipSamples; i++) {
      const p = fr.at((fr.length * i) / D.clipSamples, 0);
      const v = ground(p.x, p.z);
      if (Number.isFinite(v) && v < g) g = v;
    }
    return g;
  };

  const LV = SY.louvre;
  const PR = SY.pier;
  const MA = SY.mast;
  /* ONE STAIR PER SOURCED WING END, not one per surveyed jog: §5.3 puts an
     external open stair at the south edge of the east end face, §5.4 one on
     the south end, §5.2 one at the north-west corner. The longest face of each
     of those three systems carries it. */
  const longest = {};

  for (const fr of dressable) {
    const key = fr.stepReturn ? "stepReturn" : systemOf(fr);
    const sys = RULES.systems[key];
    counts.dressedFaces++;
    if (sys.tier === "estimated") counts.estimatedFaces++;
    const gmax = gmaxOf(fr);
    const gmin = gminOf(fr);
    const foot = gmin - D.skirtDepth;
    /* A proud cut is buried below the neighbour's roof; the treatment
       starts there, not at grade. */
    const yLo = fr.clipH != null ? Math.max(yOf(fr.clipH), foot) : foot;
    const plinthTop = Math.max(rim + sys.plinthStoreys * F, gmax);
    if (!fr.stepReturn && (!longest[key] || fr.length > longest[key].length)) longest[key] = fr;

    /* The terracotta corrugated rainscreen plinth, and the blue-tinted
       curtain wall above it. Both are fields: the mullion module is withheld
       (absent A5) so nothing subdivides either one, and the glazing is drawn
       OPAQUE at the sampled hue rather than through the library's transparent
       glass class, which would blend the wall behind it to pale grey. */
    if (plinthTop > yLo) {
      faceQuad(bins.plinth, fr, FIELD_OFF, 0, fr.length, yLo, plinthTop, T.corrugation, T.corrugation);
      counts.plinthFields++;
    }
    const curtainLo = Math.max(plinthTop, yLo);
    if (soffitY > curtainLo) {
      faceQuad(bins.curtain, fr, FIELD_OFF, 0, fr.length, curtainLo, soffitY, T.glass, T.glass);
      counts.curtainFields++;
    }

    /* THE COLUMN GRID. No fixed pitch is laid: the face takes its wing's own
       grid and draws the piers whose grid stations fall on it, so piers land
       on the surveyed ends of the wing rather than on a rhythm this file
       invented. */
    const grid = gridOf(fr);
    const rot = Math.atan2(fr.nx, fr.nz);
    const stations = stationsOn(fr, grid, PR.width);
    for (const u of stations) {
      const p = fr.at(u, FIELD_OFF + PR.proud / 2);
      const pg = Math.max(ground(p.x, p.z) - D.skirtDepth, yLo);
      box("pier", { x: p.x, y: (pg + roofY) / 2, z: p.z, rot,
        scale: [PR.width, roofY - pg, PR.proud] });
      counts.piers++;
      const q = fr.at(u, FIELD_OFF + PR.proud + MA.section / 2);
      const qg = Math.max(ground(q.x, q.z) - D.skirtDepth, yLo);
      box("mast", { x: q.x, y: (qg + roofY + MA.rise) / 2, z: q.z, rot,
        scale: [MA.section, roofY + MA.rise - qg, MA.section] });
      counts.masts++;
    }

    /* The horizontal aluminium louvre sunshades, on their outriggers, one bank
       per bay per storey above the plinth. The COUNT per storey is sourced;
       the depth, thickness and standoff are banded estimates (absent A13). */
    const storeys = section.reads["published.levelsAboveGrade"].value;
    for (let i = 0; grid && i + 1 < stations.length; i++) {
      const u0 = stations[i] + PR.width / 2;
      const u1 = stations[i + 1] - PR.width / 2;
      if (!(u1 - u0 > PR.width)) continue;
      for (let s = 0; s < storeys; s++) {
        const y0 = rim + s * F;
        if (y0 + F <= Math.max(plinthTop, yLo)) continue;
        for (let b = 0; b < LV.bladesPerStorey; b++) {
          const y = y0 + ((b + 0.5) * F) / LV.bladesPerStorey;
          if (y <= Math.max(plinthTop, yLo) || y >= soffitY) continue;
          const p = fr.at((u0 + u1) / 2, FIELD_OFF + LV.standoff + LV.depth / 2);
          box("louvre", { x: p.x, y, z: p.z, rot, scale: [u1 - u0, LV.blade, LV.depth] });
          counts.louvreBlades++;
        }
      }
    }

  }
  const entranceFace = longest.eastEnd || null;
  const serviceFace = longest.southEnd || null;

  /* ------------------------------------------------ the east entrance */

  if (entranceFace) {
    const fr = entranceFace;
    const CA = SY.canopy;
    const rot = Math.atan2(fr.nx, fr.nz);
    const gmax = gmaxOf(fr);
    const mid = fr.at(fr.length / 2, FIELD_OFF + CA.projection / 2);
    /* The flat cantilevered entry canopy, sourced in four independent frames
       across 23 years — the best-sourced element on the best-sourced face. */
    box("wallPaleAir", { x: mid.x, y: rim + F - CA.thickness / 2, z: mid.z, rot,
      scale: [fr.length, CA.thickness, CA.projection] });
    counts.canopies++;
    for (const u of [fr.length / 2 - CA.projection, fr.length / 2 + CA.projection]) {
      const p = fr.at(u, FIELD_OFF + CA.projection - CA.columnSize);
      const g = ground(p.x, p.z);
      box("wallPale", { x: p.x, y: (g - D.skirtDepth + rim + F - CA.thickness) / 2, z: p.z, rot,
        scale: [CA.columnSize, rim + F - CA.thickness - (g - D.skirtDepth), CA.columnSize] });
      counts.canopyColumns++;
    }
    /* The shallow steps across the FULL frontage, which is the one plan datum
       any source gives them. */
    const ST = section.ground.east;
    for (let k = 0; k < ST.stepCount; k++) {
      const depth = ST.stepTread;
      const w = FIELD_OFF + (k + 0.5) * depth;
      const p = fr.at(fr.length / 2, w);
      const g = ground(p.x, p.z);
      const top = gmax + (ST.stepCount - k - 1) * ST.stepRise + ST.stepRise;
      box("wallPale", { x: p.x, y: (g - D.skirtDepth + top) / 2, z: p.z, rot,
        scale: [fr.length, top - (g - D.skirtDepth), depth] });
      counts.steps++;
    }
  }

  /* --------------------------------------------- the exposed stairs */

  const SR = SY.stair;
  const storeyCount = section.reads["published.levelsAboveGrade"].value;
  for (const key of ["eastEnd", "southEnd", "west"]) {
    const fr = longest[key];
    if (!fr) continue;
    const u = fr.length - SR.width / 2;
    if (!(u > SR.width / 2)) continue;
    const p = fr.at(u, FIELD_OFF + SR.width / 2);
    const g = ground(p.x, p.z);
    const rot = Math.atan2(fr.nx, fr.nz);
    /* The shaft: board-formed concrete, full height to the roof slab. */
    box("pier", { x: p.x, y: (g - D.skirtDepth + roofY) / 2, z: p.z, rot,
      scale: [SR.width, roofY - (g - D.skirtDepth), SR.width] });
    counts.stairs++;
    /* The steel-mesh guard on each projecting landing — one per floor line. */
    const q = fr.at(u, FIELD_OFF + SR.width + D.bandStandoff);
    for (let s = 1; s < storeyCount; s++) {
      const y = rim + s * F;
      if (y + SR.guardHeight > roofY) break;
      box("railSteel", { x: q.x, y: y + SR.guardHeight / 2, z: q.z, rot,
        scale: [SR.width, SR.guardHeight, D.bandStandoff] });
      counts.stairGuards++;
    }
  }

  /* -------------------------------------------- the south service yard */

  if (serviceFace) {
    const Y = section.ground.serviceYard;
    const fr = serviceFace;
    const rot = Math.atan2(fr.nx, fr.nz);
    const wp = fr.at(fr.length / 2, Y.depth);
    const gw = ground(wp.x, wp.z);
    box("cmuScreen", { x: wp.x, y: gw + Y.wallHeight / 2, z: wp.z, rot,
      scale: [fr.length, Y.wallHeight, Y.wallThickness] });
    counts.screenWalls++;
    const dp = fr.at(fr.length / 2, FIELD_OFF + Y.dockDepth / 2);
    const gd = ground(dp.x, dp.z);
    box("cmuScreen", { x: dp.x, y: gd + Y.dockHeight / 2, z: dp.z, rot,
      scale: [fr.length, Y.dockHeight, Y.dockDepth] });
    counts.docks++;
  }

  /* ------------------------------------------------ the west sequence */

  {
    const W = section.ground.west;
    const lift = overlayLift(W.rung);
    for (const fr of dressable) {
      if (fr.stepReturn || systemOf(fr) !== "west") continue;
      const grid = gridOf(fr);
      if (!grid || !(fr.length > grid.pitch)) continue;
      const rot = Math.atan2(fr.nx, fr.nz);
      /* Outside-in off the c.2003 frame: lawn, a flush precast mow strip, a
         decomposed-granite strip, then the plinth — with the freestanding
         colonnade standing IN the DG. The lawn itself is the survey's. */
      const lay = (into, w0, w1) => {
        const n = Math.max(1, Math.ceil(fr.length / D.bedSeg));
        for (let i = 0; i < n; i++) {
          const ua = (i * fr.length) / n;
          const ub = ((i + 1) * fr.length) / n;
          const pts = [fr.at(ua, w0), fr.at(ub, w0), fr.at(ub, w1), fr.at(ua, w1)];
          const quadTris = [[0, 1, 2], [0, 2, 3]];
          for (const tri of quadTris) {
            for (const idx of tri) {
              const v = pts[idx];
              into.pos.push(v.x, ground(v.x, v.z) + lift, v.z);
              into.uv.push(v.x, v.z);
            }
          }
        }
        into.runs++;
      };
      const dg0 = FIELD_OFF;
      const dg1 = dg0 + W.dgWidth;
      lay(bins.dgStrip, dg0, dg1);
      lay(bins.mowStrip, dg1, dg1 + W.mowStripWidth);
      for (const u of stationsOn(fr, grid, 0)) {
        if (!(u > 0 && u < fr.length)) continue;
        const p = fr.at(u, FIELD_OFF + W.colonnadeStandoff);
        const g = ground(p.x, p.z);
        box("pier", { x: p.x, y: (g - D.skirtDepth + g + W.colonnadeHeight) / 2, z: p.z, rot,
          scale: [W.colonnadeSize, W.colonnadeHeight + D.skirtDepth, W.colonnadeSize] });
        counts.colonnade++;
      }
    }
  }

  /* ------------------------------------------------- the roofscape */

  {
    const M = SY.mech;
    const plate = ring;
    /* A mech plan is CLIPPED to the plate: a footprint that crosses the rim has
       no roof under it, and nothing may hover. */
    /* A mech item is a BOX and the plate is not convex, so clipping its plan
       to the ring and taking the result's bounding box can still leave a
       corner hanging over the rim — where there is no roof. The box is shrunk
       toward the clipped plan's own centre until every corner is on the plate
       (or within the ring tolerance of its edge). The measured read keeps its
       position and only the overhang goes; an item that cannot be seated at
       all is dropped rather than floated. */
    const onPlate = (x0, z0, x1, z1) => {
      const p = clipRingBox(plate, [[x0, z0], [x1, z1]]);
      if (!p) return null;
      const xs = p.map((q) => q[0]);
      const zs = p.map((q) => q[1]);
      let a0 = Math.min(...xs); let a1 = Math.max(...xs);
      let b0 = Math.min(...zs); let b1 = Math.max(...zs);
      const cx = (a0 + a1) / 2;
      const cz = (b0 + b1) / 2;
      const seated = () => [[a0, b0], [a1, b0], [a0, b1], [a1, b1]]
        .every(([x, z]) => inRing(x, z, plate) || nearRing(x, z, plate, D.ringTolerance));
      for (let i = 0; i < D.seatShrinkSteps && !seated(); i++) {
        a0 += (cx - a0) * D.seatShrinkFrac;
        a1 += (cx - a1) * D.seatShrinkFrac;
        b0 += (cz - b0) * D.seatShrinkFrac;
        b1 += (cz - b1) * D.seatShrinkFrac;
      }
      if (!seated()) return null;
      return { x0: a0, x1: a1, z0: b0, z1: b1, plan: p };
    };
    const seat = (role, c, h, count) => {
      if (!c) return null;
      box(role, { x: (c.x0 + c.x1) / 2, y: (roofY + yOf(h)) / 2, z: (c.z0 + c.z1) / 2,
        scale: [c.x1 - c.x0, yOf(h) - roofY, c.z1 - c.z0] });
      if (count) counts[count]++;
      return c;
    };
    const spineBox = {};
    for (const s of M.spines) {
      const c = onPlate(s.x0, s.z0, s.x1, s.z1);
      spineBox[s.id] = c;
      seat("penthouse", c, s.h, "penthouses");
    }
    for (const b of M.blocks) {
      const c = onPlate(b.x0, b.z0, b.x1, b.z1);
      if (!c) continue;
      if (c.x1 - c.x0 < b.x1 - b.x0 - 1e-6 || c.z1 - c.z0 < b.z1 - b.z0 - 1e-6) counts.mechBlocksClipped++;
      seat("mechBlock", c, b.h, "mechBlocks");
    }
    /* The two blower rows. Their z is the penthouse's own MEASURED edge plus
       half a casing — a re-anchoring, because a raw ortho z read on this
       building is wrong by up to 6 m and is forbidden. */
    const spineTop = (id) => yOf(M.spines.find((s) => s.id === id).h);
    const BN = M.blowerN;
    const cn = spineBox[BN.anchor];
    if (cn) {
      for (let k = 0; k < BN.count; k++) {
        const x = BN.x0 + k * BN.pitch;
        const z = cn.z1 + BN.size / 2;
        box("blower", { x, y: roofY + BN.size / 4, z, scale: [BN.size, BN.size / 2, BN.size] });
        cyl("blower", { x, y: roofY + BN.size / 2 + BN.size / 4, z, scale: [BN.size / 2, BN.size / 2, BN.size / 2] });
        counts.blowers++;
      }
    }
    const BS = M.blowerS;
    const cs = spineBox[BS.anchor];
    if (cs) {
      for (let k = 0; k < BS.count; k++) {
        const z = cs.z0 + ((k + 0.5) * (cs.z1 - cs.z0)) / BS.count;
        const x = cs.x1 + BS.size / 2;
        box("blower", { x, y: roofY + BS.size / 4, z, scale: [BS.size, BS.size / 2, BS.size] });
        cyl("blower", { x, y: roofY + BS.size / 2 + BS.size / 4, z, scale: [BS.size / 2, BS.size / 2, BS.size / 2] });
        counts.blowers++;
      }
    }
    const CD = M.condenser;
    const cc = onPlate(CD.cx - CD.w / 2, CD.cz - CD.d / 2, CD.cx + CD.w / 2, CD.cz + CD.d / 2);
    if (cc) {
      const fanY = roofY + CD.d / 2;
      box("condenser", { x: (cc.x0 + cc.x1) / 2, y: roofY + CD.d / 4, z: (cc.z0 + cc.z1) / 2,
        scale: [cc.x1 - cc.x0, CD.d / 2, cc.z1 - cc.z0] });
      counts.condensers++;
      for (let i = 0; i < CD.fans; i++) {
        const fx = (cc.x0 + cc.x1) / 2 + (i % 2 ? 1 : -1) * (cc.x1 - cc.x0) / 4;
        const fz = (cc.z0 + cc.z1) / 2 + (i < 2 ? -1 : 1) * (cc.z1 - cc.z0) / 4;
        cyl("condenser", { x: fx, y: fanY, z: fz, scale: [(cc.x1 - cc.x0) / 4, CD.d / 4, (cc.x1 - cc.x0) / 4] });
        counts.condenserFans++;
      }
    }
    /* The long duct run, laid one plate inset inside the north wing's own
       SURVEYED inner south wall — a ring edge within a metre of the read. */
    const DU = M.duct;
    const dc = onPlate(DU.x0, DU.anchorZ - D.plateInset - DU.w, DU.x1, DU.anchorZ - D.plateInset);
    if (dc) {
      box("duct", { x: (dc.x0 + dc.x1) / 2, y: roofY + DU.w / 4, z: (dc.z0 + dc.z1) / 2,
        scale: [dc.x1 - dc.x0, DU.w / 2, dc.z1 - dc.z0] });
      counts.ducts++;
    }
  }

  /* ---------------------------------------------------------- assembly */

  const building = new THREE.Group();
  building.name = "natsci-building";
  const board = (color) => lib().get("boardFormedConcrete", { color });
  const smooth = (color) => lib().get("smoothConcrete", { color });
  const membraneMat = (color) => lib().get("roofMembrane", { color });
  const seam = (color) => lib().get("metalPanelSeam", { color });
  const panelMat = (color) => lib().get("metalPanel", { color });
  const cmuMat = (color) => lib().get("brick", { color });
  const dgMat = (color) => lib().get("decomposedGranite", { color });
  const pavingMat = (color) => lib().get("pavingConcreteUnit", { color });

  const addBin = (b, mat, name, into = building, shadow = true) => {
    if (!b.runs) return;
    const m = new THREE.Mesh(bandGeometry(b), mat);
    m.castShadow = m.receiveShadow = shadow;
    m.name = name;
    into.add(m);
  };
  addBin(bins.walls, board(hue("pier")), "natsci-mass-walls-sourced");
  addBin(bins.lobeWalls, smooth(hue("lobeWall")), "natsci-lobe-walls-estimated");
  addBin(bins.lobeLids, membraneMat(hue("lobeWall")), "natsci-lobe-roof-estimated");
  addBin(bins.membrane, membraneMat(hue("roofMembrane")), "natsci-roof-membrane-estimated");
  addBin(bins.fascia, smooth(hue("fascia")), "natsci-roof-fascia-estimated");
  addBin(bins.soffit, smooth(hue("soffit")), "natsci-roof-soffit-sourced");
  addBin(bins.plinth, seam(hue("plinthTerracotta")), "natsci-plinth-sourced");
  addBin(bins.curtain, smooth(hue("curtainGlass")), "natsci-curtain-wall-sourced");

  const unit = new THREE.BoxGeometry(1, 1, 1);
  const drum = new THREE.CylinderGeometry(1, 1, 1, 12);
  const instance = (geo, mat, items, name, into) => {
    if (!items || !items.length) return;
    const mesh = new THREE.InstancedMesh(geo, mat, items.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    items.forEach((it, i) => {
      e.set(0, it.rot || 0, 0, "YXZ");
      q.setFromEuler(e);
      s.set(it.scale[0], it.scale[1], it.scale[2]);
      p.set(it.x, it.y, it.z);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.name = name;
    into.add(mesh);
  };
  /* Every box population's material and TIER live here as literals, so the
     suite's bidirectional colour-role gate can read the module's own call
     sites: a role reached only through section data is invisible to it, which
     is how a hex acquires no consumer or a consumer ships white. */
  const BOX_MATS = {
    pier: [board(hue("pier")), "natsci-pier-sourced"],
    mast: [panelMat(hue("mast")), "natsci-mast-estimated"],
    louvre: [panelMat(hue("louvre")), "natsci-louvre-estimated"],
    wallPale: [smooth(hue("wallPale")), "natsci-entrance-ground-sourced"],
    /* The cantilevered canopy plate is the ONE entrance element that does not
       stand on the ground, so it is binned apart from the steps and columns
       and named apart: a gate that seats the entrance must not have to make an
       exception for the thing that hangs. Same declared colour role. */
    wallPaleAir: [smooth(hue("wallPale")), "natsci-entry-canopy-sourced"],
    railSteel: [panelMat(hue("railSteel")), "natsci-stair-guard-estimated"],
    cmuScreen: [cmuMat(hue("cmuScreen")), "natsci-service-yard-estimated"],
    penthouse: [seam(hue("penthouse")), "natsci-mech-penthouse-estimated"],
    mechBlock: [smooth(hue("mechBlock")), "natsci-mech-block-estimated"],
    blower: [panelMat(hue("blower")), "natsci-mech-blower-estimated"],
    condenser: [panelMat(hue("condenser")), "natsci-mech-condenser-estimated"],
    duct: [seam(hue("duct")), "natsci-mech-duct-estimated"],
  };
  for (const [role, items] of Object.entries(boxes)) {
    const spec = BOX_MATS[role];
    if (!spec) throw new Error(`campus-photo-natsci: box population "${role}" has no declared material`);
    instance(unit, spec[0], items, spec[1], building);
  }
  for (const [role, items] of Object.entries(cyls)) {
    const spec = BOX_MATS[role];
    if (!spec) throw new Error(`campus-photo-natsci: cylinder population "${role}" has no declared material`);
    instance(drum, spec[0], items, `${spec[1]}-round`, building);
  }
  group.add(building);

  /* ------------------------------------------------------------ ground */

  const gr = new THREE.Group();
  gr.name = "natsci-ground";
  const markMat = applyOverlayDepth(smooth(hue("walkwayMarking")), "paint");
  if (bins.markings.runs) {
    const m = new THREE.Mesh(bandGeometry(bins.markings), markMat);
    m.name = "natsci-roof-walkway-estimated";
    m.castShadow = false;
    building.add(m);
  }
  const padRung = section.ground.west.rung;
  const layDecal = (b, mat, name) => {
    if (!b.runs) return;
    const m = new THREE.Mesh(bandGeometry(b), applyOverlayDepth(mat, padRung));
    m.renderOrder = OVERLAY[padRung].renderOrder;
    m.castShadow = false;
    m.receiveShadow = true;
    m.name = name;
    gr.add(m);
  };
  layDecal(bins.dgStrip, dgMat(hue("dgStrip")), "natsci-west-dg-sourced");
  layDecal(bins.mowStrip, pavingMat(hue("mowStrip")), "natsci-west-mow-strip-estimated");

  const bedLift = overlayLift(D.bedRung);
  for (const owned of section.ground.rings.owned) {
    if (owned.carpet === false) continue; // a declared record with its surface withheld
    const rings = owned.rings.map((r) => (owned.clip ? clipRingBox(r, owned.clip[0]) : r)).filter(Boolean);
    if (!rings.length) continue;
    const geo = drapeRing(rings, ground, bedLift, D.bedSeg, D.bedMaxDepth);
    if (!geo) continue;
    const mesh = new THREE.Mesh(geo, applyOverlayDepth(dgMat(hue("lawnTurf")), D.bedRung));
    mesh.renderOrder = OVERLAY[D.bedRung].renderOrder;
    mesh.receiveShadow = true;
    mesh.name = "natsci-lawn-estimated";
    gr.add(mesh);
    counts.lawns++;
  }
  group.add(gr);

  scene?.add(group);
  return {
    group,
    counts: {
      ...counts,
      roofY,
      soffitY,
      rim,
      /* DECLARED ZEROES, not omissions — each has a failed ladder in `absent`:
         the 32.52 m spike (A3), the forecourt's carpet, trees, benches and
         bike racks (A8), the service yard's bins, gas cage, access stair and
         floodlights (A7), the mullion grid (A5), the cut letters and the
         painted address (A9), the circular site utility (A11), the basement
         (A10), and the terracotta corner blocks, panel bands, glazed slot and
         punched windows (A15). */
      spikes: 0,
      forecourtObjects: 0,
      yardObjects: 0,
      mullions: 0,
      letters: 0,
      siteUtilities: 0,
      basements: 0,
      cornerBlocks: 0,
    },
  };
}
