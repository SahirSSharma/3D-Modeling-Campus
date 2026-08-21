// The six Fleet residence halls and their 2011 courtyards, Revelle College —
// from photographs and one landscape drawing, the INVENTED class.
//
// ONE BUILDING TYPE BUILT SIX TIMES: Beagle, Challenger, Discovery, Atlantis,
// Galathea and Meteor, footprint areas agreeing to 0.5% rsd, four storeys on
// four independent sources, one facade system in every photograph, and one
// landscape project over all six courtyards at once. Six things shaped this
// file, and every one of them is a place a "six copies of one prism" build
// goes wrong:
//
//   1. NOTHING HERE IS EVER KEYED BY NAME. OpenStreetMap has GALATHEA and
//      METEOR on each other's buildings, three first-party UCSD sources say
//      so, and the LiDAR proves it arithmetically: key the two halls by
//      POSITION and two independent measurements over two different polygons
//      agree to 0.00 m twice; key them by NAME and both are 0.7 m out. So the
//      module never performs a lookup against a measured file at all — every
//      height, ring and position it uses is carried in the section, which
//      records the corrected mapping and is gated against the survey.
//
//   2. TWO OF THE SIX ARE MIRRORED, AND THIS FILE CANNOT GET THAT WRONG
//      BECAUSE IT NEVER INSTANCES A SHARED MESH. Meteor and Challenger are
//      genuine reflections of the other four (3.1% of raster cells against
//      48.7% — and rot180 is not the answer, the plan is already C2). Every
//      hall's treatment is generated edge by edge from ITS OWN surveyed ring,
//      so the hand is carried by the survey. The section still declares the
//      hand per hall and the test still checks it in world coordinates,
//      because a later refactor toward one shared mesh is exactly what would
//      break it.
//
//   3. ONE STACK, SIX HEIGHTS. The six massHeights span 1.1 m while the ground
//      under a SINGLE hall swings 0.8-2.7 m, so the spread is the ground's and
//      not the buildings'. What varies per hall is the METRE and not the
//      model: four storeys and a parapet cap, both derived from that hall's
//      own massHeights through one shared photographic ratio.
//
//   4. THE OPENINGS ARE ON A SOURCED MODULE, AND THE FRAME BETWEEN THEM IS
//      NOT. Three bays per long face at one dimensioned 12' x 14' room module,
//      four storeys, one window over one painted spandrel per bay, with the
//      remainder of the face left as the stair slot. What is still withheld is
//      the exposed concrete frame the source photograph is unmistakably
//      gridded by: no source gives a pier width, so no pier, mullion or
//      transom is drawn, and the bays read as bays because the openings are on
//      the module. The accent is ONE paint, sampled on Galathea by name and
//      extended to the other five as a labelled [estimated] role — and the two
//      populations are pixel-identical, so the split lives in the mesh NAMES
//      or it does not live in the scene at all.
//
//   5. AN OPENING THAT THE DRAWN GROUND WOULD BURY IS NOT BUILT. The storey
//      grid hangs from one elevation per hall, as a building does; the terrain
//      under a single hall swings up to 2.66 m, as a hillside does. Where the
//      two meet, the bottom storey's painted band would sit partly under the
//      drawn surface and emerge from it — which no source frame shows and
//      which absent A1 already declines to invent. Those cells ship as plain
//      wall and are counted. Seating the grid on the ring's ground MAXIMUM
//      instead was tried and refused on arithmetic: it drives Beagle's
//      masonry cap to -0.27 m, i.e. it can only be paid for by scaling a
//      sourced element.
//
//   6. THE GROUND IS REGISTERED, NOT INVENTED. Fifteen surveyed arcgis.ground
//      rings carry the 2011 Garbini landscape; campus-world.js already draws
//      every one of them on the `ground` rung, so this module lays the
//      project's own material one rung above on `carpet` and re-outlines
//      nothing. Not one bed here has an edge this file chose.
//
//   7. NO DIMENSION AND NO COLOUR LIVES IN THIS FILE. Every metre comes from
//      `derivations.figures` (with the arithmetic that produces it),
//      `estimates` (banded, labelled, naming the pattern extended) or `draw`
//      (render offsets, declared as offsets and not as claims about the
//      building). Every hex comes from `colors` through a guard that throws.
//      The test fails on a bare number or a hex literal here.
//
// Surfaces come from the procedural material library (campus-materials.js):
// the library supplies microstructure at true material scale, the section
// supplies the colour. Deterministic throughout.
import * as THREE from "../vendor/three/three.module.min.js";
import { applyOverlayDepth, overlayLift, OVERLAY } from "./campus-overlay.js";
import { sharedMaterialLibrary } from "./campus-materials.js";
import { roofElevation } from "./campus-massing.js";

let LIB = null;
const lib = () => (LIB ??= sharedMaterialLibrary(THREE));

/* Concrete masonry at true unit scale — the wall field, the parapet cap and
   the stair tower are the same fabric and take the same class.
   ONE MATERIAL PER ROLE, NOT ONE PER RUN. The band runs carry UVs already
   divided by their own tile size (`bandQuad` below), so a single texture at
   repeat 1 lands at true unit scale on a 26 m wall and a 2.9 m tower alike.
   A per-run `repeat` would have meant 157 distinct materials per role, which
   campus-perf.js's material dedupe cannot fold and the batcher cannot draw
   together. */
const cmu = (color) => lib().get("brick", { color, normalScale: 0.9 });
const painted = (color) => lib().get("smoothConcrete", { color });

/**
 * THE HALL'S OWN FRAME FOR ONE SURVEYED RING EDGE. The tangent is the drawn
 * edge itself; the outward normal is fixed by the RING'S OWN WINDING, not by
 * "away from the centroid" — a pinwheel has two re-entrant corners and a
 * centroid test flips the normal on exactly those edges, which is where the
 * stair tower stands.
 */
function edgeFrame(ring, k, ccw) {
  const [ax, az] = ring[k];
  const [bx, bz] = ring[k + 1];
  const length = Math.hypot(bx - ax, bz - az);
  const tx = (bx - ax) / length;
  const tz = (bz - az) / length;
  const s = ccw ? 1 : -1;
  const nx = s * tz;
  const nz = -s * tx;
  return {
    ax, az, bx, bz, length, nx, nz, tx, tz, rot: Math.atan2(nx, nz),
    at: (u, w) => ({ x: ax + tx * u + nx * w, z: az + tz * u + nz * w }),
  };
}

/**
 * THE MITRED OFFSET RING. Every band on a hall is drawn `off` metres proud of
 * the surveyed ring, and the first round drew each edge's offset quad
 * independently — so at every plane change the two offset quads DIVERGED and
 * left a wedge, and the extruded prism's own lit corner showed through it as a
 * bright hairline from parapet to grade. The visual critic measured them at
 * L 199-206 against a wall of 110, on every hall at every azimuth, landing
 * exactly where the exposed concrete piers would be — a pier grid drawn for
 * free, in the wrong colour, on the lines this section spent its credibility
 * refusing to draw a pier on.
 *
 * The fix is geometric: offset each edge's supporting LINE, then intersect
 * consecutive lines and use the intersection as the shared corner. Convex
 * corners extend to meet, re-entrant ones trim back, and adjacent quads share
 * an edge exactly. Near-parallel neighbours (the survey's 0.1 m jogs) have no
 * usable intersection and fall back to the plain offset point, which is where
 * the two quads already coincide to within the jog.
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
    /* Solve cur.a + t*cur.d == nxt.a + u*nxt.d. */
    const det = cur.d[0] * -nxt.d[1] - cur.d[1] * -nxt.d[0];
    if (Math.abs(det) < 1e-6) continue;
    const rx = nxt.a[0] - cur.a[0];
    const rz = nxt.a[1] - cur.a[1];
    const t = (rx * -nxt.d[1] - rz * -nxt.d[0]) / det;
    const px = cur.a[0] + cur.d[0] * t;
    const pz = cur.a[1] + cur.d[1] * t;
    /* A corner may not travel further than the offset's own diagonal reach; a
       near-tangential pair would otherwise throw the joint metres away. */
    if (Math.hypot(px - cur.b[0], pz - cur.b[1]) > off * 8) continue;
    cur.b = [px, pz];
    nxt.a = [px, pz];
  }
  return es;
}

/** Signed area of a closed ring: positive is counter-clockwise in (x, z). */
function ringCcw(ring) {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return a > 0;
}

/**
 * THE HALL DATUM. Lowest drawn surface anywhere along the hall's own ring,
 * sampled at every vertex and every `step` metres between them. Every band on
 * the hall hangs from this ONE height, so a corner between two edges cannot
 * step and the wall's foot is at or below the drawn ground at every station.
 */
function hallDatum(ring, ground, step) {
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
  /* Defaulting to absolute zero here would sink a whole hall's treatment ~24 m
     rather than fail, which is the failure mode this project keeps meeting. */
  if (!Number.isFinite(lo)) {
    throw new Error("campus-photo-fleets: surfaceAt returned nothing finite along a hall's ring");
  }
  return lo;
}

/**
 * ONE QUAD ON A FACE, as two triangles in world coordinates with its UVs
 * already in TILE UNITS. Nothing is scaled: the quad is a stretch of the
 * surveyed edge from `u0` to `u1` along it, offset proud by `off`, between two
 * absolute heights — so a run cannot inherit another run's aspect and a whole
 * role can share one material.
 */
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

/** The whole of a face, edge to edge. */
const bandQuad = (out, fr, off, yLo, yHi, tileU, tileV) =>
  faceQuad(out, fr, off, 0, fr.length, yLo, yHi, tileU, tileV);

/**
 * THE HALL'S LONG FACES, MERGED OUT OF THE SURVEY RATHER THAN LOOKED UP.
 *
 * A Fleet long face is NOT a ring edge. The survey wobbles by up to 0.20 m
 * along a single flat face and drops 0.1-0.3 m jogs into the middle of it, so
 * the 14.7 m bar face arrives as four or five segments. This walks the ring
 * and merges consecutive segments while every vertex so far stays within `tol`
 * of the run's own chord and never runs backwards along it, which is the same
 * collinearity test the facade gates use. The twelve runs that come out in the
 * declared length range are the twelve bar faces, two per hall, on both hands.
 */
function longFaces(ring, tol, range) {
  const es = [];
  for (let k = 0; k < ring.length - 1; k++) {
    if (Math.hypot(ring[k + 1][0] - ring[k][0], ring[k + 1][1] - ring[k][1]) > 0) {
      es.push({ k, a: ring[k], b: ring[k + 1] });
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
      if (fits(cur.a, e.b, pts)) { cur.b = e.b; cur.pts = pts; cur.ks.push(e.k); continue; }
      runs.push(cur);
    }
    cur = { a: e.a, b: e.b, pts: [e.a, e.b], ks: [e.k] };
  }
  if (cur) runs.push(cur);
  /* The ring is closed, so the last run and the first may be one face. */
  if (runs.length > 1) {
    const first = runs[0];
    const last = runs[runs.length - 1];
    const pts = last.pts.concat(first.pts);
    if (fits(last.a, first.b, pts)) {
      first.a = last.a;
      first.ks = last.ks.concat(first.ks);
      runs.pop();
    }
  }
  return runs
    .map((r) => ({ ...r, L: Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]) }))
    .filter((r) => r.L >= range[0] && r.L <= range[1]);
}

/** Fold a run bin into one geometry. */
function bandGeometry(bin) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(bin.pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(bin.uv, 2));
  geo.computeVertexNormals();
  return geo;
}

/**
 * A SURVEYED GROUND RING, DRAPED. The ring's own boundary is triangulated
 * exactly as campus-world.js triangulates it — same ShapeUtils call, same
 * y-negation into shape space — so this carpet lies on the same polygon the
 * world already draws and never re-outlines it. Each triangle is then split at
 * its midpoints until no edge exceeds `seg`, so the surface FOLLOWS the drawn
 * terrain instead of spanning it, and every vertex takes its own `surfaceAt`.
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
    /* One degenerate survey polygon must not cost the quad — the same posture
       campus-world.js takes on the same call. */
    return null;
  }
  const verts = contour.concat(...holes);
  const pos = [];
  const uv = [];
  const emit = (a, b, c) => {
    for (const p of [a, b, c]) {
      const g = ground(p.x, p.y);
      if (!Number.isFinite(g)) {
        throw new Error(`campus-photo-fleets: surfaceAt returned ${g} inside a surveyed ground ring at (${p.x}, ${p.y})`);
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
    /* Back into world space: shape space negated z, so negate it back. */
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
 * Build the Fleet halls' and courtyards' photo-sourced detail.
 *
 * `photo` is the loaded photo-detail document; this reads only its `fleets`
 * section and writes nothing back. `surfaceAt` — the drawn terrain triangle —
 * is what everything on the ground seats on. LiDAR is valid on these
 * buildings: they are 1964-66 structures whose 2010 renovation changed no
 * massing, so massHeights describes them as they stand, and `arcgis.h` is
 * never read here — it is levels x 3.05, a formula, and the section admits it
 * only as a recorded check.
 */
export function createPhotoFleets(scene, { photo, heightAt, surfaceAt } = {}) {
  const group = new THREE.Group();
  group.name = "photo-fleets";
  const section = photo?.fleets;
  if (!section) {
    scene?.add(group);
    return { group, counts: {} };
  }
  const ground = surfaceAt || heightAt;
  if (typeof ground !== "function") {
    throw new Error("campus-photo-fleets: needs surfaceAt (or heightAt) to place on the ground");
  }
  /* A document that predates the R3 merge describes no halls at all. Half
     building this would ship six bare prisms with nothing on screen to say so. */
  if (!section.measured?.halls || !section.system?.stack) {
    throw new Error("campus-photo-fleets: section predates the R3 merge — refusing to build half a quad");
  }

  const { colors, draw: D } = section;
  /* EVERY COLOUR GOES THROUGH HERE, and a role the section does not carry is a
     hard error rather than a default. campus-materials.js destructures
     `color = 0xffffff`, so an undeclared role does not throw, does not warn and
     does not look wrong in code — it ships an OPAQUE WHITE surface. */
  const hue = (role) => {
    const v = colors[role];
    if (typeof v !== "string") {
      throw new Error(`campus-photo-fleets: no colour declared for role "${role}" — `
        + "an unset role silently becomes white in campus-materials.js and must never reach a material");
    }
    return v;
  };
  const T = D.tiles;

  const bin = () => ({ pos: [], uv: [], runs: 0 });
  const bins = {
    walls: bin(), fascias: bin(), caps: bin(), skirts: bin(),
    spandrelsSourced: bin(), spandrelsExtended: bin(), windows: bin(), towers: bin(),
  };
  let towerCount = 0;
  const FA = section.system.facade;
  let openingsWithheld = 0;

  for (const [name, hall] of Object.entries(section.measured.halls)) {
    const ring = hall.ring;
    const stack = section.system.stack.perHall[name];
    if (!stack) {
      throw new Error(`campus-photo-fleets: no stack declared for ${name} — a hall without its own derived storey is a hall wearing another hall's metre`);
    }
    const ccw = ringCcw(ring);
    const datum = hallDatum(ring, ground, D.datumStep);
    /* The lid is the extruder's own: the same function campus-massing.js
       closes this prism with, over the same ring and the same height. A
       treatment derived from a lid this module computed differently would
       stand proud of the mass it dresses. */
    const lid = roofElevation(ring, hall.massHeight, ground);
    /* THE PARAPET ZONE IS WHAT THIS HALL'S OWN HEIGHT LEAVES OVER THE SHARED
       FOUR-STOREY STACK, and it splits so that nothing sourced is scaled: the
       navy fascia band keeps its measured depth on all six and the masonry cap
       above it absorbs the whole of the residue. */
    const fasciaFoot = lid - stack.parapetZone;
    const capFoot = fasciaFoot + stack.fasciaBand;

    /* Every band run is cut from the MITRED offset ring, so consecutive runs
       share their corner exactly and no wedge can open at a plane change. */
    for (const seg of offsetRing(ring, D.wallOffset, ccw)) {
      const fr = edgeFrame([seg.a, seg.b], 0, ccw);
      if (!(fr.length > 0)) continue;
      bandQuad(bins.walls, fr, 0, datum, fasciaFoot, T.block, T.blockCourse);
      bandQuad(bins.skirts, fr, 0, datum - D.skirtDepth, datum, T.block, T.blockCourse);
      bandQuad(bins.fascias, fr, 0, fasciaFoot, capFoot, T.fascia, T.fascia);
      bandQuad(bins.caps, fr, 0, capFoot, lid, T.block, T.blockCourse);
    }

    /* THE OPENING GRID, ON THE LONG FACES ONLY. Three bays of one sourced room
       module laid from each face's OUTER corner, inboard of a measured masonry
       RETURN so the first opening cannot run into the corner arris — MG_23022
       has a pier there and the first round did not. What is left at the
       re-entrant end is blank wall: the big panel the same frame shows, and the
       stair beyond it. Whether the stair slot is glazed or open is unresolved
       and neither is drawn. */
    const accent = hall.accentSourced ? bins.spandrelsSourced : bins.spandrelsExtended;
    const OFF = D.wallOffset;
    const OP = FA.opening;
    for (const face of longFaces(ring, D.faceMergeTol, FA.longFaceRange)) {
      const fr = edgeFrame([face.a, face.b], 0, ccw);
      /* WHICH END THE BAYS START FROM IS DERIVED, NEVER TYPED: the outer end is
         the one further from the hall's own centroid, and the blank panel and
         the stair take the re-entrant end. Getting this backwards would put
         every window on the wrong half of every face without moving a count. */
      const dA = Math.hypot(face.a[0] - hall.centroid[0], face.a[1] - hall.centroid[1]);
      const dB = Math.hypot(face.b[0] - hall.centroid[0], face.b[1] - hall.centroid[1]);
      const outerAtA = dA > dB;
      const width = OP.widthOfBay * FA.bay;
      for (let b = 0; b < FA.baysPerLongFace; b++) {
        /* `u` measured from the OUTER end, past the return, then mapped back
           onto the face's own parameter so one arithmetic serves both hands. */
        const o0 = FA.outerReturn + b * FA.bay;
        const o1 = o0 + width;
        const u0 = outerAtA ? o0 : fr.length - o1;
        const u1 = outerAtA ? o1 : fr.length - o0;
        for (let st = 0; st < section.system.stack.storeys; st++) {
          /* THE STOREY'S FOUR SHARES, top down: wall, glass, wall, spandrel.
             The first round spent the whole storey on glass and spandrel with
             no solid between, so consecutive storeys' glazing touched and each
             bay read as one uninterrupted four-storey slot — a positive
             assertion of MORE glazing than the source shows, which is the
             inverse of everything else this section does. */
          const top = fasciaFoot - st * stack.storey;
          const glassTop = top - OP.wallAboveOfStorey * stack.storey;
          const glassFoot = glassTop - OP.glassOfStorey * stack.storey;
          const spandrelTop = glassFoot - OP.wallBelowOfStorey * stack.storey;
          const spandrelFoot = spandrelTop - OP.spandrelOfStorey * stack.storey;
          /* THE GROUND CLIP. The storey grid hangs from ONE elevation per hall,
             which is what a building does; the drawn terrain under a single
             hall swings up to 2.66 m, which is what a hillside does. Where the
             ground rises past the bottom storey's spandrel foot, the painted
             band would sit partly buried and emerge from the dirt — a thing no
             source frame shows, and a ground-floor condition absent A1 already
             declines to invent. The WHOLE opening goes, not half of it: a
             window over no spandrel asserts a detail nobody has seen. */
          let grade = -Infinity;
          for (let i = 0; i <= FA.groundClip.samples; i++) {
            const p = fr.at(u0 + ((u1 - u0) * i) / FA.groundClip.samples, 0);
            const v = ground(p.x, p.z);
            if (Number.isFinite(v) && v > grade) grade = v;
          }
          if (spandrelFoot < grade) { openingsWithheld++; continue; }
          faceQuad(bins.windows, fr, OFF + D.openingProud, u0, u1,
            glassFoot, glassTop, T.window, T.window);
          faceQuad(accent, fr, OFF + D.openingProud, u0, u1,
            spandrelFoot, spandrelTop, T.spandrel, T.spandrel);
        }
      }
    }

    /* THE STAIR TOWERS. Their footprints are the ring's OWN C2-paired
       projections — the section carries the edge index each stands on, and the
       test re-derives those indices from the ring rather than trusting them.
       The overrun is the only thing in this section allowed above the lid.

       They are built as METRE-UV QUADS on the same shared masonry material as
       the walls, not as instanced unit boxes. A unit box carries 0..1 UVs on
       every face, so one texture spanned each face whatever its size and the
       towers rendered in a coarser bond than the wall they stand on — the
       visual critic's minor m1. Quads cut the same way the wall is cut cannot
       have a different bond. */
    if (section.system.tower.built) {
      const over = section.system.tower.overrun;
      const dep = section.system.tower.depth;
      for (const t of hall.towers) {
        const fr = edgeFrame(ring, t.edge, ccw);
        const yLo = capFoot;
        const yHi = lid + over;
        const u0 = D.towerDepthPad;
        const u1 = fr.length - D.towerDepthPad;
        /* The outer face, on the projection's own line, offset like every other
           band; then the two returns running back into the building. */
        faceQuad(bins.towers, fr, D.wallOffset, u0, u1, yLo, yHi, T.block, T.blockCourse);
        for (const [u, sign] of [[u0, -1], [u1, 1]]) {
          const a = fr.at(u, D.wallOffset);
          const b = fr.at(u, D.wallOffset - dep);
          const side = edgeFrame(sign > 0 ? [[a.x, a.z], [b.x, b.z]] : [[b.x, b.z], [a.x, a.z]],
            0, ccw);
          faceQuad(bins.towers, side, 0, 0, side.length, yLo, yHi, T.block, T.blockCourse);
        }
        /* The cap, a horizontal lid on the overrun. */
        const c0 = fr.at(u0, D.wallOffset);
        const c1 = fr.at(u1, D.wallOffset);
        const c2 = fr.at(u1, D.wallOffset - dep);
        const c3 = fr.at(u0, D.wallOffset - dep);
        const quad = [[c0, 0, 0], [c1, (u1 - u0) / T.block, 0],
          [c2, (u1 - u0) / T.block, dep / T.block], [c3, 0, dep / T.block]];
        for (const [i, j, k] of [[0, 1, 2], [0, 2, 3]]) {
          for (const idx of [i, j, k]) {
            const [pt, uu, vv] = quad[idx];
            bins.towers.pos.push(pt.x, yHi, pt.z);
            bins.towers.uv.push(uu, vv);
          }
        }
        bins.towers.runs++;
        towerCount++;
      }
    }
  }

  /* ---------------------------------------------------------- assembly */
  const plane = new THREE.PlaneGeometry(1, 1);
  const facades = new THREE.Group();
  facades.name = "fleets-facades";
  /* MASONRY MATERIALS ARE SHARED BY HEX, NOT BY ROLE. Wall, skirt, parapet cap
     and stair tower are the same fabric at the same scale, so they must draw as
     one — that is what lets campus-perf.js's dedupe and the batcher fold four
     meshes into one. But each still asks through its OWN colour role, so the
     cap keeps its [estimated] provenance instead of quietly becoming the wall's
     line, and the day a source resolves the cap's own colour the cache simply
     hands back a second material. */
  const masonryByHex = new Map();
  const masonry = (hex) => {
    if (!masonryByHex.has(hex)) masonryByHex.set(hex, cmu(hex));
    return masonryByHex.get(hex);
  };
  /* One mesh per BAND ROLE across all six halls, not one per run: the runs
     already carry world coordinates and tile-unit UVs, so they fold. */
  /* The roles are named LITERALLY here, not passed through a variable: the
     suite's bidirectional colour-role gate compares the module's own
     `hue("...")` call sites against the section's declared roles, and a role
     reached only through a loop variable is invisible to it — which is how a
     hex acquires no consumer, or a consumer acquires no hex and ships white. */
  for (const [key, color, meshName, kind] of [
    ["walls", hue("wallBlock"), "fleets-wall", "masonry"],
    ["skirts", hue("wallBlock"), "fleets-skirt", "masonry"],
    ["fascias", hue("fasciaBand"), "fleets-fascia", "painted"],
    ["caps", hue("parapetCap"), "fleets-parapet-cap", "masonry"],
  ]) {
    if (!bins[key].runs) continue;
    const mesh = new THREE.Mesh(bandGeometry(bins[key]),
      kind === "masonry" ? masonry(color) : painted(color));
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.name = meshName;
    facades.add(mesh);
  }
  /* THE TWO ACCENT MESHES ARE NAMED APART even though they carry the same hex.
     Galathea's paint is sampled by name; the other five extend it. The two
     populations are pixel-identical, so if provenance is not in the mesh NAME
     it is not in the scene at all, and swapping them would be a lie about
     sourcing that nothing could see. */
  for (const [key, color, meshName] of [
    ["spandrelsSourced", hue("spandrelAccent"), "fleets-spandrel-sourced"],
    ["spandrelsExtended", hue("spandrelAccentExtended"), "fleets-spandrel-estimated"],
  ]) {
    if (!bins[key].runs) continue;
    const mesh = new THREE.Mesh(bandGeometry(bins[key]), painted(color));
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.name = meshName;
    facades.add(mesh);
  }
  if (bins.windows.runs) {
    /* Glass takes no maps by design — a pane's read comes from what it
       reflects, and the scenes hand these materials a filtered environment. */
    const glass = new THREE.Mesh(bandGeometry(bins.windows),
      lib().get("glass", { color: hue("windowGlass") }));
    glass.name = "fleets-window";
    facades.add(glass);
  }
  if (bins.towers.runs) {
    const tower = new THREE.Mesh(bandGeometry(bins.towers), masonry(hue("wallBlock")));
    tower.castShadow = tower.receiveShadow = true;
    tower.name = "fleets-stair-tower";
    facades.add(tower);
  }
  group.add(facades);

  /* ------------------------------------------------------------ ground */
  const gr = new THREE.Group();
  gr.name = "fleets-ground";
  const lift = overlayLift(D.bedRung);
  /* The rock mulch is `lavaRock` because the material IS the variance: the
     sample's channel sd of 58/61/63 has no low-variance tile anywhere in it,
     and the class's coarse lumpy relief is what 50-150 mm river cobble at the
     section's own mean colour looks like. The lawn takes the fine even grain
     of `decomposedGranite` rather than `foliage`, whose alpha cut-out would
     punch holes in a ground plane. */
  const MAT = {
    mulch: () => lib().get("lavaRock", { color: hue("groundMulch"), repeat: 1 / T.mulch }),
    lawn: () => lib().get("decomposedGranite", { color: hue("groundLawn"), repeat: 1 / T.lawn }),
    paving: () => lib().get("pavingConcreteUnit", { color: hue("groundPaving"), repeat: 1 / T.paving }),
  };
  const NAME = { mulch: "fleets-bed", lawn: "fleets-lawn", paving: "fleets-paving-patch" };
  const built = { mulch: 0, lawn: 0, paving: 0 };
  for (const g of section.measured.groundRings.owned) {
    const geo = drapeRing(g.rings, ground, lift, D.bedSeg, D.bedMaxDepth);
    if (!geo) continue;
    const make = MAT[g.role];
    if (!make) {
      throw new Error(`campus-photo-fleets: surveyed ring #${g.index} declares role "${g.role}", which this module has no material for`);
    }
    /* The repeat is per SURFACE and the UVs are already in metres, so the
       texture lands at true material scale on every ring whatever its size. */
    const mesh = new THREE.Mesh(geo, applyOverlayDepth(make(), D.bedRung));
    /* Three.js has no per-material render order, so the rung's own order is
       set on the MESH — the decal stack is what keeps this above the world's
       `ground` fill at 900 m as reliably as at 2 m. */
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
      halls: Object.keys(section.measured.halls).length,
      wallPanels: bins.walls.runs,
      fasciaBands: bins.fascias.runs,
      parapetCaps: bins.caps.runs,
      skirts: bins.skirts.runs,
      towers: towerCount,
      spandrelBands: bins.spandrelsSourced.runs + bins.spandrelsExtended.runs,
      windows: bins.windows.runs,
      openings: bins.windows.runs,
      openingsWithheld,
      beds: built.mulch,
      lawns: built.lawn,
      pavingPatches: built.paving,
      /* DECLARED ZEROES, not omissions: the roof zones' level difference is
         not resolvable and the Keeling PV control returns negative on all six
         plates. */
      roofObjects: 0,
      pv: 0,
    },
  };
}
