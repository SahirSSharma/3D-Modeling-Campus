// Mayer Hall (1963, Risley & Gould) and the Mayer Hall Addition (2004, MBT
// Architecture) — photo-sourced detail, the INVENTED class, R4 batch.
//
// TWO BUILDINGS, TWO EPOCHS, ONE PARTY WALL. Five things shaped this file, and
// each is a place a plausible build goes wrong:
//
//   1. THE OSM RING IS A MERGED BLOB AND NOTHING HERE EVER READS IT. osm:395
//      covers Mayer + the Addition + a SE service yard in one ring, so
//      lidar.heights["Mayer Hall"] = 23.2 is a percentile over BOTH buildings
//      and is not a Mayer figure. Every height and ring this module uses is
//      carried in the section, keyed by POSITION (the GIS rings and their
//      massHeights: Mayer 21.7, Addition 23.8), and the module performs no
//      lookup against a measured file at all.
//
//   2. THE TWO GIS RINGS SHARE A BOUNDARY SEGMENT VERBATIM. The Addition's
//      ring runs along x 123.7..124.0 for z 277.7..308.9 — Mayer's own east
//      face — so the "seam" between the masses is INSIDE the Addition's ring
//      (it is the glazed link) and there is no daylight slot to fill. Both
//      buildings therefore SKIP their shared segments: a facade hung on a
//      party wall is a facade drawn inside another building. The skipped
//      faces are counted, and the link's own exposed stub faces take glass.
//
//   3. THE GROUND FALLS 4.1 m WEST -> EAST UNDER MAYER, which is why every
//      footing here seats on `surfaceAt` and why the gallery glazing is
//      CLIPPED per segment: the storey grid hangs from the lid at one
//      elevation, the drawn terrain climbs 4 m along the face, and a glazing
//      segment whose foot the drawn surface buries is withheld and counted
//      rather than left emerging from the dirt. The five-storey building
//      reads as four from the high side — that is the site, not an error.
//
//   4. NO BAY RHYTHM IS INVENTED. Mayer's structural bay count has no source
//      (research-mayer 5.3), so the long faces carry the sourced HORIZONTAL
//      system only — continuous slab fascias, exposed-aggregate balustrade
//      bands, a recessed full-length glass line — and no pier, mullion,
//      stair or opening grid. The Addition's punched-window rhythm is
//      visible in photographs but unscaled, and which glazing system sits on
//      which face is unresolved, so its faces ship as field + floor bands
//      and no window. Better a plain sourced band than an invented rhythm.
//
//   5. THE PV ARRAYS ARE POST-2014 FABRIC ON A 2014-MEASURED PLATE. LiDAR's
//      21.7 predates them; they ship as a thin epoch-labelled layer ON the
//      lid, never absorbed into a taller prism. The clerestory monitor spine
//      between them is period fabric (1964 photograph; the 2026 ortho reads
//      its z band); its x extent and height are [estimated] and its mesh
//      name says so.
//
// No dimension and no colour lives in this file: every metre comes from
// `derivations.figures` (with arithmetic), `estimates` (banded, naming the
// pattern extended) or `draw` (declared render offsets); every hex from
// `section.colors` through a guard that throws. Deterministic throughout.
import * as THREE from "../vendor/three/three.module.min.js";
import { applyOverlayDepth, overlayLift, OVERLAY } from "./campus-overlay.js";
import { sharedMaterialLibrary } from "./campus-materials.js";
import { roofElevation } from "./campus-massing.js";

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

/**
 * A frame on one straight run of the ring. Outward normal from the RING'S OWN
 * WINDING, never from a centroid test — the Addition is an L with a notch and
 * a centroid flips the normal exactly on the re-entrant edges.
 */
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

/**
 * THE MITRED OFFSET RING (the fleets lesson, carried forward): every band
 * stands `off` metres proud of the survey line, and two adjacent edges' offset
 * quads must SHARE their corner or a lit wedge opens at every plane change —
 * on the Addition's 108-chord arc that is 107 wedges. Offset each edge's
 * supporting line, intersect consecutive lines, use the intersection as the
 * shared corner; near-parallel neighbours fall back to the plain offset point.
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
    es.push({
      k,
      a: [ax + nx * off, az + nz * off],
      b: [bx + nx * off, bz + nz * off],
      d: [(bx - ax) / L, (bz - az) / L],
      mid: [(ax + bx) / 2, (az + bz) / 2],
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
    if (Math.hypot(px - cur.b[0], pz - cur.b[1]) > Math.abs(off) * 8) continue;
    cur.b = [px, pz];
    nxt.a = [px, pz];
  }
  return es;
}

/**
 * MAXIMAL COLLINEAR FACES OF A SURVEYED RING. The survey wobbles 0.1-0.2 m
 * along a flat face and drops jog vertices into the middle of it, so Mayer's
 * 71 m north face arrives as six segments. Merge while every vertex stays
 * within `tol` of the run's own chord and projects forward along it.
 */
function mergedFaces(ring, tol) {
  const es = [];
  for (let k = 0; k < ring.length - 1; k++) {
    if (Math.hypot(ring[k + 1][0] - ring[k][0], ring[k + 1][1] - ring[k][1]) > 0) {
      es.push({ a: ring[k], b: ring[k + 1] });
    }
  }
  const fits = (a, b, pts) => {
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const l2 = dx * dx + dz * dz;
    if (!(l2 > 0)) return false;
    for (const p of pts) {
      const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2;
      if (t < -1e-9 || t > 1 + 1e-9) return false;
      if (Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dz)) > tol) return false;
    }
    return true;
  };
  const runs = [];
  let cur = null;
  for (const e of es) {
    if (cur) {
      const pts = cur.pts.concat([e.a, e.b]);
      if (fits(cur.a, e.b, pts)) { cur.b = e.b; cur.pts = pts; continue; }
      runs.push(cur);
    }
    cur = { a: e.a, b: e.b, pts: [e.a, e.b] };
  }
  if (cur) runs.push(cur);
  if (runs.length > 1) {
    const first = runs[0];
    const last = runs[runs.length - 1];
    const pts = last.pts.concat(first.pts);
    if (fits(last.a, first.b, pts)) {
      first.a = last.a;
      first.pts = pts;
      runs.pop();
    }
  }
  return runs.map((r) => ({ ...r, L: Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]) }));
}

/** Distance from a point to a closed ring's polyline. */
function ringDist(x, z, r) {
  let best = Infinity;
  for (let i = 0; i < r.length - 1; i++) {
    const [ax, az] = r[i];
    const [bx, bz] = r[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const l2 = dx * dx + dz * dz;
    const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0;
    best = Math.min(best, Math.hypot(x - (ax + t * dx), z - (az + t * dz)));
  }
  return best;
}

/** Lowest drawn surface along a ring (vertices + every `step` metres). */
function ringDatum(ring, ground, step) {
  let lo = Infinity;
  for (let k = 0; k < ring.length - 1; k++) {
    const [ax, az] = ring[k];
    const [bx, bz] = ring[k + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
    for (let i = 0; i <= n; i++) {
      const g = ground(ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n);
      if (Number.isFinite(g) && g < lo) lo = g;
    }
  }
  if (!Number.isFinite(lo)) {
    throw new Error("campus-photo-mayer: surfaceAt returned nothing finite along a ring");
  }
  return lo;
}

/** One quad in world coordinates with UVs already in TILE UNITS. */
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

/** A horizontal quad between two parallel offset lines of one face. */
function flatQuad(out, fr, w0, w1, u0, u1, y, tile) {
  const c0 = fr.at(u0, w0);
  const c1 = fr.at(u1, w0);
  const c2 = fr.at(u1, w1);
  const c3 = fr.at(u0, w1);
  const uu = (u1 - u0) / tile;
  const vv = Math.abs(w1 - w0) / tile;
  const quad = [
    [c0, 0, 0], [c1, uu, 0], [c2, uu, vv],
    [c0, 0, 0], [c2, uu, vv], [c3, 0, vv],
  ];
  for (const [pt, a, b] of quad) { out.pos.push(pt.x, y, pt.z); out.uv.push(a, b); }
  out.runs++;
}

/** Fold a bin into one geometry. */
function bandGeometry(bin) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(bin.pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(bin.uv, 2));
  geo.computeVertexNormals();
  return geo;
}

/**
 * A SURVEYED GROUND RING, DRAPED — same ShapeUtils triangulation and the same
 * y-negation campus-world.js uses over the identical polygon, split until no
 * edge exceeds `seg` so the carpet follows the drawn terrain.
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
        throw new Error(`campus-photo-mayer: surfaceAt returned ${g} inside a surveyed ground ring at (${p.x}, ${p.y})`);
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

/* ------------------------------------------------------------------ api */

/**
 * Build Mayer Hall's and the Addition's photo-sourced detail. `photo` is the
 * loaded photo-detail document; this reads only its `mayer` key and writes
 * nothing back. Everything on the ground seats on `surfaceAt` — the drawn
 * terrain triangle — because the site falls 4.1 m under one building. LiDAR
 * is valid on BOTH masses (1963 and 2004 both predate the 2014 flight);
 * arcgis `h` is levels x 4.26, a formula, and is never read here.
 */
export function createPhotoMayer(scene, { photo, heightAt, surfaceAt } = {}) {
  const group = new THREE.Group();
  group.name = "photo-mayer";
  const section = photo?.mayer;
  if (!section) {
    scene?.add(group);
    return { group, counts: {} };
  }
  const ground = surfaceAt || heightAt;
  if (typeof ground !== "function") {
    throw new Error("campus-photo-mayer: needs surfaceAt (or heightAt) to place on the ground");
  }
  if (!section.measured?.masses || !section.system?.gallery || !section.system?.addition) {
    throw new Error("campus-photo-mayer: section predates the R4 merge — refusing to build half a pair");
  }

  const { colors, draw: D } = section;
  /* Every colour goes through here; an undeclared role would silently become
     opaque white in campus-materials.js and must throw instead. */
  const hue = (role) => {
    const v = colors[role];
    if (typeof v !== "string") {
      throw new Error(`campus-photo-mayer: no colour declared for role "${role}" — `
        + "an unset role silently becomes white in campus-materials.js and must never reach a material");
    }
    return v;
  };
  const T = D.tiles;

  const M = section.measured.masses.mayer;
  const A = section.measured.masses.addition;
  const GAL = section.system.gallery;
  const ADD = section.system.addition;
  const ROOF = section.system.roof;

  const bin = () => ({ pos: [], uv: [], runs: 0 });
  const bins = {
    slabs: bin(), slabsRoof: bin(), balustrades: bin(), decks: bin(),
    glass: bin(), curtain: bin(), overhangs: bin(),
    addFields: bin(), addBands: bin(), addParapets: bin(), addSkirts: bin(),
    linkGlass: bin(),
  };
  const counts = {
    masses: 2,
    galleryFaces: 0, curtainFaces: 0, partyFacesMayer: 0,
    slabBands: 0, roofFascias: 0, balustrades: 0, decks: 0, overhangPlates: 0,
    glassPanels: 0, glassWithheld: 0, curtainWalls: 0,
    additionFieldRuns: 0, additionFloorBands: 0, additionParapetRuns: 0,
    additionSkirts: 0, partyEdgesAddition: 0, linkPanels: 0,
    pvBlocks: 0, monitors: 0, beds: 0,
    /* DECLARED ZEROES, not omissions: no bay rhythm, no opening, no pier and
       no window is sourced on either mass, and the breezeway is bonner's. */
    openings: 0, piers: 0, windowsAddition: 0, breezewayElements: 0,
  };

  /* ------------------------------------------------------- Mayer Hall */
  const ringM = M.ring;
  const ccwM = ringCcw(ringM);
  const lidM = roofElevation(ringM, M.massHeight, ground);
  const storey = GAL.storey;
  const baseM = lidM - M.massHeight;
  const slabDeep = GAL.slabFascia;
  const balH = GAL.balustrade;
  const recess = GAL.depth;
  const over = ROOF.overhang;

  const partyOf = (mid, otherRing, aPt, bPt) =>
    ringDist(mid[0], mid[1], otherRing) <= D.partyTol &&
    ringDist(aPt[0], aPt[1], otherRing) <= D.partyTol &&
    ringDist(bPt[0], bPt[1], otherRing) <= D.partyTol;

  for (const face of mergedFaces(ringM, D.faceMergeTol)) {
    const mid = [(face.a[0] + face.b[0]) / 2, (face.a[1] + face.b[1]) / 2];
    const fr = edgeFrame(face.a, face.b, ccwM);
    if (partyOf(mid, A.ring, face.a, face.b)) {
      /* Mayer's east face is the Addition's own west boundary since 2004 —
         a party plane. Nothing is hung on it. */
      counts.partyFacesMayer++;
      continue;
    }
    if (face.L >= GAL.longFaceMin) {
      /* A GALLERY FACE: the Risley & Gould system — continuous slab fascias,
         a solid balustrade band over each slab, the glass line recessed the
         gallery's depth behind them. No bay is drawn: the rhythm has no
         source, and the face reads as the photographs do — as horizontals. */
      counts.galleryFaces++;
      for (let k = 0; k <= GAL.storeys - 1; k++) {
        const slabTop = lidM - k * storey;
        if (k === 0) {
          /* The roof slab overhangs; its fascia rides at the OVERHANG edge. */
          bandQuad(bins.slabsRoof, fr, D.wallOffset + over, slabTop - slabDeep, slabTop, T.fascia, T.fascia);
          flatQuad(bins.overhangs, fr, D.wallOffset, D.wallOffset + over, 0, fr.length, slabTop + D.topLift, T.fascia);
          flatQuad(bins.overhangs, fr, D.wallOffset, D.wallOffset + over, 0, fr.length, slabTop - slabDeep, T.fascia);
          counts.roofFascias++;
          counts.overhangPlates++;
        } else {
          bandQuad(bins.slabs, fr, D.wallOffset, slabTop - slabDeep, slabTop, T.fascia, T.fascia);
          counts.slabBands++;
          bandQuad(bins.balustrades, fr, D.wallOffset, slabTop, slabTop + balH, T.aggregate, T.aggregate);
          counts.balustrades++;
          /* The gallery deck: the slab's own top surface, face line back to
             the glass line. */
          flatQuad(bins.decks, fr, D.wallOffset, -recess, 0, fr.length, slabTop + D.topLift, T.fascia);
          counts.decks++;
        }
        /* THE GLASS LINE UNDER THIS SLAB, clipped by the drawn ground. The
           storey grid hangs from the lid; the terrain climbs 4 m along the
           face; a segment whose foot the drawn surface buries is withheld
           and counted, never left emerging from the dirt (ground floor at
           the west end enters at what the east end calls level 2). */
        const gTop = slabTop - slabDeep;
        const gFoot = lidM - (k + 1) * storey;
        const nSeg = Math.max(1, Math.ceil(fr.length / D.glassSeg));
        for (let sgi = 0; sgi < nSeg; sgi++) {
          const u0 = (fr.length * sgi) / nSeg;
          const u1 = (fr.length * (sgi + 1)) / nSeg;
          let grade = -Infinity;
          for (let i = 0; i <= D.clipSamples; i++) {
            const p = fr.at(u0 + ((u1 - u0) * i) / D.clipSamples, -recess);
            const v = ground(p.x, p.z);
            if (Number.isFinite(v) && v > grade) grade = v;
          }
          if (gFoot < grade - D.clipGraceBelow) { counts.glassWithheld++; continue; }
          faceQuad(bins.glass, fr, -recess, u0, u1, Math.max(gFoot, baseM), gTop, T.glass, T.glass);
          counts.glassPanels++;
        }
      }
    } else if (face.L >= GAL.curtainFaceRange[0] && face.L <= GAL.curtainFaceRange[1]) {
      /* THE WEST SHORT END: floor-to-roof mullioned curtain wall in the 1964
         frame. Mullions have no measured module and are not drawn. Its foot
         sits at the face's own highest drawn ground so no pane emerges from
         the hill. */
      counts.curtainFaces++;
      let hi = -Infinity;
      const n = Math.max(1, Math.ceil(fr.length / D.datumStep));
      for (let i = 0; i <= n; i++) {
        const p = fr.at((fr.length * i) / n, 0);
        const v = ground(p.x, p.z);
        if (Number.isFinite(v) && v > hi) hi = v;
      }
      bandQuad(bins.curtain, fr, D.wallOffset, hi, lidM - slabDeep, T.glass, T.glass);
      counts.curtainWalls++;
      bandQuad(bins.slabsRoof, fr, D.wallOffset + over, lidM - slabDeep, lidM, T.fascia, T.fascia);
      flatQuad(bins.overhangs, fr, D.wallOffset, D.wallOffset + over, 0, fr.length, lidM + D.topLift, T.fascia);
      flatQuad(bins.overhangs, fr, D.wallOffset, D.wallOffset + over, 0, fr.length, lidM - slabDeep, T.fascia);
      counts.roofFascias++;
      counts.overhangPlates++;
    }
  }

  /* ----------------------------------------------- Mayer roof objects */
  /* THE PV ARRAYS — POST-2014 FABRIC, a thin layer on the 2014-measured lid,
     never a taller prism. Extents are ortho reads corrected by THIS pair's
     own local registration; blocks are the ortho's own dark runs. */
  const pvGroup = new THREE.Group();
  pvGroup.name = "mayer-roof";
  const pvMat = lib().get("metalPanel", { color: hue("pvPanel") });
  for (const arr of ROOF.pv.arrays) {
    for (const [rx0, rx1] of arr.blocksRawX) {
      const x0 = rx0 + ROOF.pv.dxTrue;
      const x1 = rx1 + ROOF.pv.dxTrue;
      const geo = new THREE.BoxGeometry(x1 - x0, D.pvThickness, arr.z1 - arr.z0);
      const mesh = new THREE.Mesh(geo, pvMat);
      mesh.position.set((x0 + x1) / 2, lidM + D.pvLift + D.pvThickness / 2, (arr.z0 + arr.z1) / 2);
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.name = "mayer-roof-pv-sourced";
      pvGroup.add(mesh);
      counts.pvBlocks++;
    }
  }
  /* THE CLERESTORY MONITOR SPINE — period fabric (1964 frame; ortho z band).
     Its x extent and height are [estimated], and the mesh name says so. */
  {
    const mon = ROOF.monitor;
    const geo = new THREE.BoxGeometry(mon.x1 - mon.x0, mon.height, mon.z1 - mon.z0);
    const mesh = new THREE.Mesh(geo, lib().get("metalPanel", { color: hue("monitorSpine") }));
    mesh.position.set((mon.x0 + mon.x1) / 2, lidM + mon.height / 2, (mon.z0 + mon.z1) / 2);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.name = "mayer-roof-monitor-estimated";
    pvGroup.add(mesh);
    counts.monitors++;
  }

  /* -------------------------------------------- Mayer Hall Addition */
  const ringA = A.ring;
  const ccwA = ringCcw(ringA);
  const lidA = roofElevation(ringA, A.massHeight, ground);
  const storeyA = ADD.storey;
  const datumA = ringDatum(ringA, ground, D.datumStep);
  const bd = ADD.bandDepth;
  const pf = ADD.parapetFascia;
  const inLinkBox = (x, z) =>
    x >= D.linkBox.x0 && x <= D.linkBox.x1 && z >= D.linkBox.z0 && z <= D.linkBox.z1;

  for (const seg of offsetRing(ringA, D.fieldOffset, ccwA)) {
    const raw0 = ringA[seg.k];
    const raw1 = ringA[seg.k + 1];
    if (partyOf(seg.mid, ringM, raw0, raw1)) {
      counts.partyEdgesAddition++;
      continue;
    }
    const fr = edgeFrame(seg.a, seg.b, ccwA);
    if (!(fr.length > 0)) continue;
    if (inLinkBox(seg.mid[0], seg.mid[1])) {
      /* THE GLAZED LINK's exposed stub faces (tsilva-mayer-08): glass from
         its own highest drawn ground to the parapet fascia. */
      let hi = -Infinity;
      const n = Math.max(1, Math.ceil(fr.length / D.datumStep));
      for (let i = 0; i <= n; i++) {
        const p = fr.at((fr.length * i) / n, 0);
        const v = ground(p.x, p.z);
        if (Number.isFinite(v) && v > hi) hi = v;
      }
      bandQuad(bins.linkGlass, fr, 0, hi, lidA - pf, T.glass, T.glass);
      counts.linkPanels++;
      bandQuad(bins.addParapets, fr, 0, lidA - pf, lidA, T.band, T.band);
      counts.additionParapetRuns++;
      continue;
    }
    /* FIELD + FLOOR BANDS, stacked with nothing overlapping: tan corrugated
       metal panel between buff concrete bands at each of the four floor
       lines, a parapet fascia at the top, a skirt below the datum. The
       punched-window rhythm is unscaled and no window is drawn. */
    bandQuad(bins.addSkirts, fr, 0, datumA - D.skirtDepth, datumA, T.metal, T.metal);
    counts.additionSkirts++;
    let cursor = datumA;
    for (let k = ADD.storeys - 1; k >= 1; k--) {
      const line = lidA - k * storeyA;
      bandQuad(bins.addFields, fr, 0, cursor, line - bd / 2, T.metal, T.metal);
      counts.additionFieldRuns++;
      bandQuad(bins.addBands, fr, 0, line - bd / 2, line + bd / 2, T.band, T.band);
      counts.additionFloorBands++;
      cursor = line + bd / 2;
    }
    bandQuad(bins.addFields, fr, 0, cursor, lidA - pf, T.metal, T.metal);
    counts.additionFieldRuns++;
    bandQuad(bins.addParapets, fr, 0, lidA - pf, lidA, T.band, T.band);
    counts.additionParapetRuns++;
  }

  /* ---------------------------------------------------------- assembly */
  const facades = new THREE.Group();
  facades.name = "mayer-facades";
  const painted = (color) => lib().get("smoothConcrete", { color });
  /* THE CORRUGATED FIELD IS PAINT OVER STEEL, NOT RAW METAL (visual critic
     V1): the class default metalness of 0.9 hands the surface's whole read
     to environment reflection and the declared tan albedo disappears — the
     field rendered espresso at a third of its pinned value while the
     dielectric bands beside it were correct. A factory-painted panel is a
     dielectric coat, so the module declares the BRDF split it means
     (draw.fieldMetalness / draw.fieldRoughness, both Note-carried) and the
     suite pins the material's params and its texture's analytic mean. */
  const corrugated = (color) => lib().get("metalPanel", {
    color, standingSeam: true,
    metalness: D.fieldMetalness, roughness: D.fieldRoughness,
  });
  /* The roles are named LITERALLY at each call site — the suite's
     bidirectional colour-role gate reads these `hue("...")` strings. */
  for (const [key, mat, meshName] of [
    ["slabs", painted(hue("slabFascia")), "mayer-gallery-slab-estimated"],
    ["slabsRoof", painted(hue("slabFascia")), "mayer-roof-fascia-estimated"],
    ["overhangs", painted(hue("slabFascia")), "mayer-roof-overhang-estimated"],
    ["decks", painted(hue("slabFascia")), "mayer-gallery-deck-estimated"],
    ["balustrades", lib().get("stucco", { color: hue("balustradeAggregate") }), "mayer-gallery-balustrade-sourced"],
    ["addFields", corrugated(hue("additionMetal")), "mayer-addition-field-sourced"],
    ["addSkirts", corrugated(hue("additionMetal")), "mayer-addition-skirt-sourced"],
    ["addBands", painted(hue("additionBand")), "mayer-addition-band-sourced"],
    ["addParapets", painted(hue("additionBand")), "mayer-addition-parapet-sourced"],
    /* THE WEST CURTAIN WALL IS AN OPAQUE DARK PLANE (visual critic V2): the
       translucent glass class let the prism's own generic facade striping
       read straight through it, so the sourced short-end/long-face
       distinction did not exist on screen. The 1964 frame reads the end as
       one uniformly dark mullioned plane; with the mullion module withheld,
       the honest render of that is a matte plane at the sampled dark-glazing
       colour — opaque, so nothing behind it can restripe it. */
    ["curtain", painted(hue("mayerGlazing")), "mayer-end-curtainwall-estimated"],
  ]) {
    if (!bins[key].runs) continue;
    const mesh = new THREE.Mesh(bandGeometry(bins[key]), mat);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.name = meshName;
    facades.add(mesh);
  }
  /* Glass takes no maps by design — a pane reads from what it reflects. The
     roles are named literally so the bidirectional colour-role gate sees the
     call sites. */
  for (const [key, color, meshName] of [
    ["glass", hue("mayerGlazing"), "mayer-gallery-glass-estimated"],
    ["linkGlass", hue("linkGlass"), "mayer-link-glass-sourced"],
  ]) {
    if (!bins[key].runs) continue;
    const mesh = new THREE.Mesh(bandGeometry(bins[key]), lib().get("glass", { color }));
    mesh.name = meshName;
    facades.add(mesh);
  }
  group.add(facades);
  group.add(pvGroup);

  /* ------------------------------------------------------------ ground */
  const gr = new THREE.Group();
  gr.name = "mayer-ground";
  const lift = overlayLift(D.bedRung);
  const MAT = {
    pineGrove: () => lib().get("lavaRock", { color: hue("groundPineGrove"), repeat: 1 / T.bed }),
    terraceBed: () => lib().get("lavaRock", { color: hue("groundTerraceBed"), repeat: 1 / T.bed }),
    bunchGrass: () => lib().get("decomposedGranite", { color: hue("groundBunchGrass"), repeat: 1 / T.grass }),
  };
  const NAME = {
    pineGrove: "mayer-bed-pinegrove", terraceBed: "mayer-bed-terrace",
    bunchGrass: "mayer-bed-bunchgrass",
  };
  for (const g of section.measured.groundRings.owned) {
    const geo = drapeRing(g.rings, ground, lift, D.bedSeg, D.bedMaxDepth);
    if (!geo) continue;
    const make = MAT[g.role];
    if (!make) {
      throw new Error(`campus-photo-mayer: surveyed ring #${g.index} declares role "${g.role}", which this module has no material for`);
    }
    const mesh = new THREE.Mesh(geo, applyOverlayDepth(make(), D.bedRung));
    mesh.renderOrder = OVERLAY[D.bedRung].renderOrder;
    mesh.receiveShadow = true;
    mesh.name = NAME[g.role];
    gr.add(mesh);
    counts.beds++;
  }
  group.add(gr);

  scene?.add(group);
  return { group, counts };
}
