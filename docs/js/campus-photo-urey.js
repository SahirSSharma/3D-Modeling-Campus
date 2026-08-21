// Urey Hall, Revelle College — the four-plane 1963 laboratory slab, from the
// 2014 point-cloud re-measure and dated photographs. INVENTED class: nothing
// measured reads from this section.
//
// THE ONE THING THIS FILE EXISTS TO GET RIGHT: Urey is FOUR hard roof planes,
// not a prism and not a staircase of "~16 m steps". The 2014 EPT re-measure
// resolves the GIS mass-22 ring into podium wings at 4.02/3.98 m, the main
// slab at 25.43 m, a west crown L at 30.45 m and an east tower at 29.18 m —
// and everything between those plateaus is eucalyptus canopy, not concrete.
// The measured layer, with massHeights withheld for this mass, extrudes the
// whole ring at heights["Urey Hall"] = 30.5; that is measured-layer behaviour
// and is not this module's to change, but this module must not decorate it as
// if true. So the section carries the partition — every plane's plan is the
// SURVEYED ring clipped by declared axis-aligned boxes whose bounds are ring
// vertices, so the pieces sum exactly to the ring and no plan edge is
// invented — and this module extrudes each plane to its own measured
// plateau over one shared rim datum. ONE DATUM PER MASS, NEVER ONE PER PROP:
// the rim is the median drawn surface along the mass's own ring (the EPT rim
// base, 126.28 abs = 23.88 local, is the check on it), and all four planes
// hang from it together.
//
// Rules this build carries from its dossier and the R1-R3 lessons:
//
//   1. NOTHING HERE IS EVER KEYED BY NAME against a measured file. Every ring
//      and height is carried in the section; heights["Urey Hall"] = 30.5 is
//      quoted only as the check on the crown (it is the p98 over the OSM ring,
//      which is the crown to 0.05 m) and massHeights is never indexed.
//
//   2. THE SOUTH ELEVATION IS A STACK, NOT A FACE. What stands at z 315.8 is
//      the 1991 Office Addition (12.1 m, its own GIS mass, drawn correctly by
//      the measured layer and left untouched here); the slab's real south face
//      is at z 282.4 and the podium wall at z 309.5. The held
//      revelle.systems.ureyCorner dressed the Addition's ground with a 30 m
//      screen; this section supersedes it and builds the real planes.
//
//   3. SEVEN EQUAL GALLERY BANDS, MEASURED. One tall ground storey to the
//      podium datum 4.00 = (4.02 + 3.98)/2, then (25.43 - 4.00)/7 = 3.0614 m
//      floors. The band pitch counted off the 1965-70 south-face frame is
//      uniform to 2.1%, which is the photograph agreeing with the arithmetic.
//      The fascia depth is the band FWHM off the same frame; the in-band
//      rhythm (posts, glazing split) is absent A2 and is NOT drawn.
//
//   4. WITHHOLDINGS ARE REAL IN THE SCENE. No entrance canopy, no
//      screen-block wall, no roof furniture, no 32.9 m spike, no pre-1991
//      court, no Addition dressing: each has a failed ladder in `absent` and
//      a gate that walks the mesh names. The east tower tops out at 29.18
//      exactly because the spike is recorded, unmodelled.
//
//   5. PROVENANCE LIVES IN THE MESH NAMES. Every mesh is
//      urey-<element>-sourced|estimated; an element whose depth or colour is
//      an [estimated] extension (the gallery fascia's white, the curtain
//      floor lines, the louvre band, the two shadow-blind roof colours) says
//      so in its own name, so a render alone shows the tier.
//
//   6. NO DIMENSION AND NO COLOUR LIVES IN THIS FILE. Every metre comes from
//      the section's `derivations`/`estimates`/`reads`/`draw`; every hex from
//      `colors` through a guard that throws on an undeclared role.
import * as THREE from "../vendor/three/three.module.min.js";
import { applyOverlayDepth, overlayLift, OVERLAY } from "./campus-overlay.js";
import { sharedMaterialLibrary } from "./campus-materials.js";

let LIB = null;
const lib = () => (LIB ??= sharedMaterialLibrary(THREE));

/** Signed area of a closed ring: positive is counter-clockwise in (x, z). */
function ringCcw(ring) {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return a > 0;
}

const ringArea = (ring) => {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return Math.abs(a / 2);
};

/**
 * THE PLAN OF ONE ROOF PLANE: the surveyed ring clipped by one axis-aligned
 * box (Sutherland-Hodgman). The box bounds are ring vertices carried in the
 * section, so the partition invents no plan edge — every boundary of a piece
 * is either the survey's own polyline or a straight cut whose position is a
 * surveyed vertex coordinate. The pieces of all boxes together sum exactly to
 * the ring's own area, and the test asserts that to 1e-6.
 */
function clipRingBox(ring, box) {
  const [[bx0, bz0], [bx1, bz1]] = box;
  let pts = ring.slice(0, -1);
  const planes = [
    (p) => p[0] - bx0, // keep x >= bx0
    (p) => bx1 - p[0],
    (p) => p[1] - bz0,
    (p) => bz1 - p[1],
  ];
  for (const side of planes) {
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
  /* Drop consecutive duplicates the clip introduces; keep the ring closed. */
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
     boundary excursions as out-and-back spikes along the clip line — zero
     area, but their edges are real to the wall walker, which then hangs a
     wall (and once hung a louvre) on a face that does not exist. A spike is a
     vertex whose two edges retrace each other; remove until stable. */
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
  {
    const dedup = [];
    for (const p of clean) {
      const last = dedup[dedup.length - 1];
      if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 1e-9) dedup.push(p);
    }
    while (dedup.length > 1 &&
      Math.hypot(dedup[0][0] - dedup[dedup.length - 1][0], dedup[0][1] - dedup[dedup.length - 1][1]) <= 1e-9) {
      dedup.pop();
    }
    clean = dedup;
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
    ax: a[0], az: a[1], length, tx, tz, nx: s * tz, nz: -s * tx,
    at(u, w) { return { x: a[0] + tx * u + this.nx * w, z: a[1] + tz * u + this.nz * w }; },
  };
}

/**
 * THE MITRED OFFSET RING — the Fleets lesson carried whole. A band drawn
 * `off` proud of each edge independently opens a bright wedge at every plane
 * change; offsetting each edge's supporting LINE and intersecting consecutive
 * lines makes adjacent runs share their corner exactly.
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
    es.push({ a: [ax + nx * off, az + nz * off], b: [bx + nx * off, bz + nz * off],
      d: [(bx - ax) / L, (bz - az) / L], nx, nz });
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
    if (Math.hypot(px - cur.b[0], pz - cur.b[1]) > Math.abs(off) * 8) continue;
    cur.b = [px, pz];
    nxt.a = [px, pz];
  }
  return es;
}

/** One face quad in world coordinates with UVs already in tile units. */
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

/** Horizontal lid over a plan polygon, triangulated the way campus-world
 *  triangulates a surveyed ring (same ShapeUtils call, same y-negation). */
function lidGeometry(out, plan, y, tile) {
  const contour = plan.slice(0, -1).map(([x, z]) => new THREE.Vector2(x, -z));
  if (contour.length < 3) return;
  let faces;
  try {
    faces = THREE.ShapeUtils.triangulateShape(contour, []);
  } catch {
    return;
  }
  for (const [i, j, k] of faces) {
    for (const idx of [i, j, k]) {
      out.pos.push(contour[idx].x, y, -contour[idx].y);
      out.uv.push(contour[idx].x / tile, -contour[idx].y / tile);
    }
  }
  out.runs++;
}

/**
 * A SURVEYED GROUND RING, DRAPED — the Fleets carpet, unchanged in method.
 * The ring's own boundary is triangulated exactly as campus-world.js does,
 * split until no edge exceeds `seg`, every vertex on its own `surfaceAt`.
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
        throw new Error(`campus-photo-urey: surfaceAt returned ${g} inside a surveyed ground ring at (${p.x}, ${p.y})`);
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
    const A = new THREE.Vector2(verts[i].x, -verts[i].y);
    const B = new THREE.Vector2(verts[j].x, -verts[j].y);
    const C = new THREE.Vector2(verts[k].x, -verts[k].y);
    split(A, B, C, 0);
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
    throw new Error("campus-photo-urey: surfaceAt returned nothing finite along the mass ring");
  }
  gs.sort((a, b) => a - b);
  return { median: gs[Math.floor(gs.length / 2)], min: gs[0], max: gs[gs.length - 1] };
}

/* ------------------------------------------------------------------ api */

/**
 * Build Urey Hall's photo-sourced detail. `photo` is the loaded photo-detail
 * document; this reads only its `urey` key. Everything on the ground seats on
 * `surfaceAt` — the drawn triangle — never `heightAt`. The 1991 Office
 * Addition is measured-layer geometry (massHeights 12.1 is a valid 2014 read)
 * and this module builds NOTHING of it.
 */
export function createPhotoUrey(scene, { photo, heightAt, surfaceAt } = {}) {
  const group = new THREE.Group();
  group.name = "photo-urey";
  const section = photo?.urey;
  if (!section) {
    scene?.add(group);
    return { group, counts: {} };
  }
  const ground = surfaceAt || heightAt;
  if (typeof ground !== "function") {
    throw new Error("campus-photo-urey: needs surfaceAt (or heightAt) to place on the ground");
  }
  if (!section.measured?.urey?.ring || !section.system?.planes) {
    throw new Error("campus-photo-urey: section carries no plane partition — refusing to build a prism");
  }

  const { colors, draw: D } = section;
  /* EVERY COLOUR GOES THROUGH HERE. campus-materials.js defaults an unset
     color to opaque white without a warning, so an undeclared role throws. */
  const hue = (role) => {
    const v = colors[role];
    if (typeof v !== "string") {
      throw new Error(`campus-photo-urey: no colour declared for role "${role}" — `
        + "an unset role silently becomes white in campus-materials.js");
    }
    return v;
  };
  const T = D.tiles;
  /* THE FACADE LAYERING INVARIANT: wall < field < band, always. Every facade
     layer's offset is measured FROM THE WALL FACE (wallOffset) outward, so no
     declared value can ever put a treatment plane flush with or behind the
     wall that carries it — which is exactly what the first shipped constants
     did, and every face rendered blank white with z-fight ticks on the floor
     lines (round-2 visual critic). The suite gates the stacking, per quad. */
  const FIELD_OFF = D.wallOffset + D.fieldStandoff;
  const BAND_OFF = FIELD_OFF + D.bandStandoff;
  const bin = () => ({ pos: [], uv: [], runs: 0 });

  const ring = section.measured.urey.ring;
  const rim = rimDatum(ring, ground, D.datumStep);
  const yOf = (h) => rim.median + h;

  const SY = section.system;
  const levels = SY.gallery.levels; // storey grid, relative to the rim datum
  const fascia = SY.gallery.fascia;

  const bins = {
    walls: bin(),
    fascias: bin(),
    glazing: bin(),
    curtainGlass: bin(),
    curtainLines: bin(),
    louvres: bin(),
  };
  const roofBins = {};
  const counts = {
    planes: 0, planPieces: 0, wallQuads: 0, roofLids: 0,
    galleryBands: SY.gallery.bands, fasciaQuads: 0, glazingFields: 0,
    curtainFields: 0, curtainLines: 0, louvreQuads: 0, penthouse: 0,
  };
  let bandsWithheld = 0;

  /* The maximum drawn surface under one edge run — the burial test. A band
     whose level sits below the ground anywhere along its run is withheld
     whole: no source frame shows a gallery band emerging from a hillside. */
  const gmaxOf = (fr) => {
    let g = -Infinity;
    for (let i = 0; i <= D.clipSamples; i++) {
      const p = fr.at((fr.length * i) / D.clipSamples, 0);
      const v = ground(p.x, p.z);
      if (Number.isFinite(v) && v > g) g = v;
    }
    return g;
  };

  for (const [name, plane] of Object.entries(SY.planes)) {
    counts.planes++;
    const roofBin = (roofBins[name] ??= bin());
    const top = yOf(plane.h);
    for (const box of plane.clip) {
      const plan = clipRingBox(ring, box);
      if (!plan) continue;
      counts.planPieces++;
      const ccw = ringCcw(plan);
      /* Wall foot: below the lowest drawn surface along this piece, so the
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

      /* The walls, mitred and proud like every band in this file, so a
         partition edge shared with a sibling plane offsets the two coincident
         walls APART instead of z-fighting them. */
      for (const seg of offsetRing(plan, D.wallOffset, ccw)) {
        const fr = edgeFrame(seg.a, seg.b, ccw);
        if (!(fr.length > 0)) continue;
        faceQuad(bins.walls, fr, 0, 0, fr.length, foot, top, T.board, T.boardCourse);
        counts.wallQuads++;
      }
      lidGeometry(roofBin, plan, top, T.membrane);
      counts.roofLids++;

      /* ------------------------------------------------ facade treatment */
      if (plane.facade === "slab") {
        for (let k = 0; k < plan.length - 1; k++) {
          const fr = edgeFrame(plan[k], plan[k + 1], ccw);
          if (!(fr.length > D.minFacadeEdge)) continue;
          const gmax = gmaxOf(fr);
          if (fr.nz <= -D.northNormal) {
            /* NORTH: the flush curtain-wall field with thin white floor-edge
               lines — no balconies, and no mullion is drawn because no source
               resolves the module (absent A1). */
            const fieldFoot = Math.max(yOf(SY.storey.podiumDatum), gmax);
            if (top - fascia > fieldFoot) {
              faceQuad(bins.curtainGlass, fr, FIELD_OFF, 0, fr.length,
                fieldFoot, top, T.glass, T.glass);
              counts.curtainFields++;
            }
            for (const lvl of levels) {
              if (yOf(lvl) < gmax) { bandsWithheld++; continue; }
              faceQuad(bins.curtainLines, fr, BAND_OFF, 0, fr.length,
                yOf(lvl), yOf(lvl) + SY.curtain.lineDepth, T.line, T.line);
              counts.curtainLines++;
            }
          } else {
            /* SOUTH, EAST AND WEST: the seven-band gallery system — a white
               walkway fascia at each slab floor line over a dark glazed field.
               The in-band rhythm is absent A2 and nothing subdivides a band. */
            const fieldFoot = Math.max(yOf(SY.storey.podiumDatum), gmax);
            if (top - fascia > fieldFoot) {
              faceQuad(bins.glazing, fr, FIELD_OFF, 0, fr.length,
                fieldFoot, top, T.glass, T.glass);
              counts.glazingFields++;
            }
            for (const lvl of levels) {
              if (yOf(lvl) < gmax) { bandsWithheld++; continue; }
              faceQuad(bins.fascias, fr, BAND_OFF, 0, fr.length,
                yOf(lvl), yOf(lvl) + fascia, T.fascia, T.fascia);
              counts.fasciaQuads++;
            }
          }
        }
      }
      if (plane.facade === "podiumLouvre") {
        /* The podium wall's head louvre — west half of the south edge only,
           which is what the 1964-65 frames show. The half-line is derived in
           the section from the podium south edge's own extreme vertices. */
        for (let k = 0; k < plan.length - 1; k++) {
          const fr = edgeFrame(plan[k], plan[k + 1], ccw);
          if (!(fr.length > D.minFacadeEdge) || fr.nz < D.northNormal) continue;
          const xHi = Math.min(Math.max(plan[k][0], plan[k + 1][0]), SY.louvre.westHalfMax);
          const xLo = Math.min(plan[k][0], plan[k + 1][0]);
          if (xHi - xLo < D.minFacadeEdge) continue;
          /* Map the x-interval back onto the edge's own parameter — one
             expression, valid for either direction of travel; the nz filter
             above guarantees these edges run in x (|tx| near 1). */
          const uOf = (x) => (x - fr.ax) / fr.tx;
          const u0 = Math.min(uOf(xLo), uOf(xHi));
          const u1 = Math.max(uOf(xLo), uOf(xHi));
          const gmax = gmaxOf(fr);
          if (top - SY.louvre.depth < gmax) { bandsWithheld++; continue; }
          faceQuad(bins.louvres, fr, BAND_OFF, u0, u1,
            top - SY.louvre.depth, top, T.louvre, T.louvre);
          counts.louvreQuads++;
        }
      }
    }
  }

  /* THE WEST CROWN'S PENTHOUSE — the other arm of the 30.45 m L, a rooftop
     box on the slab whose plan is the plateau-cell bounding box (a declared
     read, ±0.75 m of cell centre). Same fabric as the walls, same crown lid. */
  {
    const P = SY.penthouse;
    const plan = [[P.x0, P.z0], [P.x1, P.z0], [P.x1, P.z1], [P.x0, P.z1], [P.x0, P.z0]];
    const ccw = ringCcw(plan);
    const yLo = yOf(SY.planes.slab.h);
    const yHi = yOf(SY.planes.crownTower.h);
    for (const seg of offsetRing(plan, D.wallOffset, ccw)) {
      const fr = edgeFrame(seg.a, seg.b, ccw);
      if (!(fr.length > 0)) continue;
      faceQuad(bins.walls, fr, 0, 0, fr.length, yLo, yHi, T.board, T.boardCourse);
      counts.wallQuads++;
    }
    const pb = (roofBins.penthouse ??= bin());
    lidGeometry(pb, plan, yHi, T.membrane);
    counts.roofLids++;
    counts.penthouse = 1;
  }

  /* ---------------------------------------------------------- assembly */
  const facades = new THREE.Group();
  facades.name = "urey-building";
  const board = (color) => lib().get("boardFormedConcrete", { color });
  const membrane = (color) => lib().get("roofMembrane", { color });

  const walls = new THREE.Mesh(bandGeometry(bins.walls), board(hue("wallPaint")));
  walls.castShadow = walls.receiveShadow = true;
  walls.name = "urey-mass-walls-sourced";
  facades.add(walls);

  /* THE ROOF ROLES ARE NAMED LITERALLY, not passed through a variable: the
     suite's bidirectional colour-role gate reads the module's own `hue("...")`
     call sites, and a role reached only through section data is invisible to
     it — which is how a hex acquires no consumer, or a consumer ships white.
     The guard ties the section's declared roofRole back to the literal. */
  const ROOF_HUES = {
    podiumN: hue("podiumRoofNorth"),
    slab: hue("slabRoofMembrane"),
    eastTower: hue("eastTowerRoof"),
    crownTower: hue("crownRoof"),
    podiumS: hue("podiumDeck"),
  };
  for (const [name, rb] of Object.entries(roofBins)) {
    if (!rb.runs) continue;
    const planeName = name === "penthouse" ? "crownTower" : name;
    const cfg = SY.planes[planeName];
    if (ROOF_HUES[planeName] !== colors[cfg.roofRole]) {
      throw new Error(`campus-photo-urey: ${planeName} declares roofRole "${cfg.roofRole}" but the module's literal role carries a different hex`);
    }
    const mesh = new THREE.Mesh(bandGeometry(rb), membrane(ROOF_HUES[planeName]));
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.name = `urey-roof-${name}-${cfg.roofTier}`;
    facades.add(mesh);
  }

  /* THE GLAZED FIELDS ARE OPAQUE DARK PLANES (round-3 visual critic; the
     mayer V2 disease class): the library's `glass` class is hardwired
     transparent at opacity 0.35 with depthWrite off, so once the standoff fix
     put the white wall 0.05 m behind these fields, the wall showed THROUGH
     and every field blended to pale grey — 85-90% of the fascia's luminance,
     the inverse of the 1965 reference balance. With the in-band rhythm
     (absent A2) and the mullion module (absent A1) both withheld, the honest
     render of these fields is one uniformly dark matte plane at the sampled
     dark-glazing hue — OPAQUE, so nothing behind it can re-lighten it. The
     suite pins transparency, opacity, depthWrite and colour on the built
     material instances. */
  if (bins.glazing.runs) {
    const m = new THREE.Mesh(bandGeometry(bins.glazing),
      lib().get("smoothConcrete", { color: hue("glazingDark") }));
    m.castShadow = m.receiveShadow = true;
    m.name = "urey-gallery-glazing-sourced";
    facades.add(m);
  }
  if (bins.curtainGlass.runs) {
    const m = new THREE.Mesh(bandGeometry(bins.curtainGlass),
      lib().get("smoothConcrete", { color: hue("glazingDark") }));
    m.castShadow = m.receiveShadow = true;
    m.name = "urey-curtain-glass-sourced";
    facades.add(m);
  }
  if (bins.fascias.runs) {
    /* The band GEOMETRY is measured (count, pitch, depth off the 1965-70
       frame); the white is an [estimated] extension of the sampled wall
       paint, and the name says so. */
    const m = new THREE.Mesh(bandGeometry(bins.fascias),
      lib().get("smoothConcrete", { color: hue("galleryFascia") }));
    m.castShadow = m.receiveShadow = true;
    m.name = "urey-gallery-fascia-estimated";
    facades.add(m);
  }
  if (bins.curtainLines.runs) {
    const m = new THREE.Mesh(bandGeometry(bins.curtainLines),
      lib().get("smoothConcrete", { color: hue("curtainLine") }));
    m.name = "urey-curtain-line-estimated";
    facades.add(m);
  }
  if (bins.louvres.runs) {
    const m = new THREE.Mesh(bandGeometry(bins.louvres),
      lib().get("metalPanelSeam", { color: hue("louvrePanel") }));
    m.name = "urey-louvre-band-estimated";
    facades.add(m);
  }
  group.add(facades);

  /* ------------------------------------------------------------ ground */
  const gr = new THREE.Group();
  gr.name = "urey-ground";
  const lift = overlayLift(D.bedRung);
  const MAT = {
    lawn: () => lib().get("decomposedGranite", { color: hue("groundLawn"), repeat: 1 / T.lawn }),
    bed: () => lib().get("lavaRock", { color: hue("groundBed"), repeat: 1 / T.bed }),
  };
  const NAME = { lawn: "urey-lawn-sourced", bed: "urey-bed-sourced" };
  const built = { lawn: 0, bed: 0 };
  for (const g of section.measured.groundRings.owned) {
    if (g.carpet === false) continue; // declared record, withheld surface
    const geo = drapeRing(g.rings, ground, lift, D.bedSeg, D.bedMaxDepth);
    if (!geo) continue;
    const make = MAT[g.role];
    if (!make) {
      throw new Error(`campus-photo-urey: surveyed ring #${g.index} declares role "${g.role}", which this module has no material for`);
    }
    const mesh = new THREE.Mesh(geo, applyOverlayDepth(make(), D.bedRung));
    mesh.renderOrder = OVERLAY[D.bedRung].renderOrder;
    mesh.receiveShadow = true;
    mesh.name = NAME[g.role];
    gr.add(mesh);
    built[g.role]++;
  }
  group.add(gr);

  scene?.add(group);
  return {
    group,
    counts: {
      ...counts,
      bandsWithheld,
      lawns: built.lawn,
      beds: built.bed,
      /* DECLARED ZEROES, not omissions: each is withheld with its ladder in
         `absent` — the wedge entrance canopy, the NW screen-block wall, the
         roof furniture row, the 32.9 m spike, the walk carpet in Bonner's
         shadow, and every dressed face of the 1991 Office Addition. */
      canopies: 0,
      screenWalls: 0,
      roofObjects: 0,
      spikes: 0,
      walks: 0,
      additionMeshes: 0,
    },
  };
}
