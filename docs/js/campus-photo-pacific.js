// Pacific Hall, from photographs, the surveyed GIS ring and the full-depth
// 2014 laser — the INVENTED class, R5 batch.
//
// Five facts shaped this module, and every one of them is a place a plausible
// build of this building goes wrong:
//
//   1. THE FACADE CLOSES AT THE PARAPET, repo 51.26 — NEVER at the drawn
//      prism top. massHeights['m:-92,234'] = 33.2 is a correct measurement of
//      the wrong object: it is the p98 of every above-ground return inside the
//      ring, which is the rooftop mechanical penthouse's screen plane at repo
//      55.2, and 55.2 less the rim median 22.00 is 33.2 to the last digit. The
//      real coping is 3.94 m lower. A facade closed at 33.2 ships a storey of
//      blank precast above the actual coping. Every height here comes out of
//      the section's own figures, which hang on the laser's plate and coping
//      planes and on nothing the extruder does.
//
//   2. PACIFIC IS NOT ONE PRISM. It is a 6-storey bar plus a 4-storey north
//      wing whose roof plate is 8.82 m lower — two flat planes, each tight to
//      +/-0.05 m. The GIS ring is a single polygon and the extruder builds one
//      solid; here the ring is PARTITIONED by the laser's own wing probe box,
//      each part carries its own plate and its own storey count, and the clip
//      line between them carries the step wall. Anything that dresses Pacific
//      as one 6-storey volume puts two storeys of invented wall over the wing.
//
//   3. THERE IS ONE BAY DIMENSION ON THIS BUILDING AND IT IS MEASURED. The
//      ortho resolves 6.37 +/- 0.13 m panel joints on the south face; ten of
//      them fit the SURVEYED 64.80 m run at 6.48 m. Every other run re-solves
//      that same module against its own surveyed length by a stated rule —
//      there is no second typed bay anywhere. Below the half-module the source
//      refuses to resolve, so there is exactly ONE opening per half-module and
//      no invented mullion count.
//
//   4. THE ARCS ARE NOT RE-PARAMETERISED. Both south corners are true circles
//      (Kasa fits at 0.026 and 0.019 m RMS over 34 and 27 vertices), and the
//      honest way to build a measured arc is to build the survey's own
//      vertices. Every band, opening and awning here rides the shipped ring's
//      polyline, so the arcs reach the scene as the survey drew them and a
//      fitted centre and radius stay in the record where they belong.
//
//   5. NO DIMENSION AND NO COLOUR LIVES IN THIS FILE. Every metre comes from
//      the section — figures mirrored into `system`, banded `estimates`, or
//      `draw` render offsets — and every hex goes through a guard that throws
//      on an undeclared role, because campus-materials.js silently ships
//      OPAQUE WHITE for a missing colour. Provenance is in the mesh NAMES
//      (-sourced / -estimated / -measured) or it is not in the scene at all.
//
// Surfaces come from the procedural material library (campus-materials.js):
// the library supplies microstructure at true material scale, the section
// supplies the colour. Deterministic throughout — no clock, no randomness, no
// seed, because nothing here is irregular: every placement is on a module the
// section derives.
import * as THREE from "../vendor/three/three.module.min.js";
import { applyOverlayDepth, overlayLift, OVERLAY } from "./campus-overlay.js";
import { sharedMaterialLibrary } from "./campus-materials.js";

let LIB = null;
const lib = () => (LIB ??= sharedMaterialLibrary(THREE));

const aggregate = (color) => lib().get("stucco", { color });
const cast = (color) => lib().get("smoothConcrete", { color });
const metal = (color) => lib().get("metalPanel", { color });
const seamed = (color) => lib().get("metalPanelSeam", { color });
/* A barrel-vault shell is a surface, not a solid: the 2010 frame reads its
   LIGHTER UNDERSIDE from below, so both faces have to draw. */
const shellOf = (color) => lib().get("metalPanelSeam", { color, side: THREE.DoubleSide });
const glassOf = (color) => lib().get("glass", { color });
const membraneOf = (color) => lib().get("roofMembrane", { color });
const pavingOf = (color) => lib().get("pavingConcreteUnit", { color });
const asphaltOf = (color) => lib().get("asphalt", { color });
const mulchOf = (color) => lib().get("lavaRock", { color });

/* ------------------------------------------------------------- geometry */

/** Signed area of a closed ring: positive is counter-clockwise in (x, z). */
function ringCcw(open) {
  let a = 0;
  for (let i = 0; i < open.length; i++) {
    const b = open[(i + 1) % open.length];
    a += open[i][0] * b[1] - b[0] * open[i][1];
  }
  return a > 0;
}

const ringArea = (open) => {
  let a = 0;
  for (let i = 0; i < open.length; i++) {
    const b = open[(i + 1) % open.length];
    a += open[i][0] * b[1] - b[0] * open[i][1];
  }
  return Math.abs(a / 2);
};

/** Sutherland-Hodgman clip of a CLOSED-implicit ring against a rectangle. */
function clipRect(open, x0, z0, x1, z1) {
  const inside = [(p) => p[0] >= x0, (p) => p[0] <= x1, (p) => p[1] >= z0, (p) => p[1] <= z1];
  const cross = [
    (a, b) => [x0, a[1] + ((b[1] - a[1]) * (x0 - a[0])) / (b[0] - a[0])],
    (a, b) => [x1, a[1] + ((b[1] - a[1]) * (x1 - a[0])) / (b[0] - a[0])],
    (a, b) => [a[0] + ((b[0] - a[0]) * (z0 - a[1])) / (b[1] - a[1]), z0],
    (a, b) => [a[0] + ((b[0] - a[0]) * (z1 - a[1])) / (b[1] - a[1]), z1],
  ];
  let poly = open;
  for (let e = 0; e < 4 && poly.length; e++) {
    const next = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const ain = inside[e](a);
      const bin = inside[e](b);
      if (ain) next.push(a);
      if (ain !== bin) next.push(cross[e](a, b));
    }
    poly = next;
  }
  return poly;
}

/** Even-odd point-in-ring over an open vertex list. */
function inRing(x, z, r) {
  let ins = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, zi] = r[i];
    const [xj, zj] = r[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
}

const bin = () => ({ pos: [], uv: [], runs: 0 });

/** One quad from four world corners, wound so its normal faces the viewer. */
function quad(out, a, b, c, d, tu, tv, flip) {
  const p = flip ? [a, d, c, a, c, b] : [a, b, c, a, c, d];
  const t = flip ? [[0, 0], [0, tv], [tu, tv], [0, 0], [tu, tv], [tu, 0]]
    : [[0, 0], [tu, 0], [tu, tv], [0, 0], [tu, tv], [0, tv]];
  for (let i = 0; i < p.length; i++) {
    out.pos.push(p[i].x, p[i].y, p[i].z);
    out.uv.push(t[i][0], t[i][1]);
  }
  out.runs++;
}

/** The same quad wound BOTH ways — used where a reveal can be seen from either side. */
function quad2(out, a, b, c, d, tu, tv) {
  quad(out, a, b, c, d, tu, tv, false);
  quad(out, a, b, c, d, tu, tv, true);
}

function geometryOf(b) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(b.pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(b.uv, 2));
  geo.computeVertexNormals();
  return geo;
}

/**
 * A run's own coordinate frame, built from the surveyed vertices it spans.
 * `at(u, w, y)` is u metres along the run's polyline from its start, w metres
 * proud of the face (the run's own per-edge outward normal), y in world
 * height. Because the frame walks the SHIPPED vertices, a run that bends — the
 * north face's shallow V, and both circular arcs — bends with them.
 */
function runFrame(open, v0, v1, ccw) {
  const n = open.length;
  const edges = [];
  let u = 0;
  for (let i = v0; i < v1; i++) {
    const a = open[i % n];
    const b = open[(i + 1) % n];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!(L > 0)) continue;
    const tx = (b[0] - a[0]) / L;
    const tz = (b[1] - a[1]) / L;
    const s = ccw ? 1 : -1;
    const nx = s * tz;
    const nz = -s * tx;
    edges.push({ u0: u, u1: u + L, L, ax: a[0], az: a[1], tx, tz, nx, nz });
    u += L;
  }
  const edgeAt = (uu) => {
    for (const e of edges) if (uu <= e.u1 + 1e-9) return e;
    return edges[edges.length - 1];
  };
  return {
    edges,
    length: u,
    edgeAt,
    at(uu, w, y) {
      const e = edgeAt(uu);
      const d = uu - e.u0;
      return {
        x: e.ax + e.tx * d + e.nx * w,
        y,
        z: e.az + e.tz * d + e.nz * w,
      };
    },
  };
}

/** The lowest and highest drawn surface under a run, sampled along it. */
function gradesUnder(frame, ground, samples, who) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i <= samples; i++) {
    const p = frame.at((i * frame.length) / samples, 0, 0);
    const g = ground(p.x, p.z);
    if (!Number.isFinite(g)) {
      throw new Error(`campus-photo-pacific: surfaceAt returned ${g} along ${who} at (${p.x}, ${p.z})`);
    }
    if (g < lo) lo = g;
    if (g > hi) hi = g;
  }
  return { lo, hi };
}

/**
 * A horizontal plate from a closed ring: top face, bottom face and side skin.
 * The top plane is the measured one; `thick` is the render body below it.
 */
function ringPlate(out, open, yTop, thick, tile) {
  const contour = open.map(([x, z]) => new THREE.Vector2(x, -z));
  if (contour.length < 3) return 0;
  let faces;
  try {
    faces = THREE.ShapeUtils.triangulateShape(contour, []);
  } catch {
    return 0;
  }
  const push = (x, y, z) => { out.pos.push(x, y, z); out.uv.push(x / tile, z / tile); };
  for (const [i, j, k] of faces) {
    for (const idx of [i, j, k]) push(contour[idx].x, yTop, -contour[idx].y);
    for (const idx of [i, k, j]) push(contour[idx].x, yTop - thick, -contour[idx].y);
  }
  const ccw = ringCcw(open);
  const s = ccw ? 1 : -1;
  for (let e = 0; e < open.length; e++) {
    const a = open[e];
    const b = open[(e + 1) % open.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!(L > 0)) continue;
    const nx = (s * (b[1] - a[1])) / L;
    const nz = (-s * (b[0] - a[0])) / L;
    const face = [
      [a[0], yTop - thick, a[1]], [b[0], yTop - thick, b[1]], [b[0], yTop, b[1]],
      [a[0], yTop - thick, a[1]], [b[0], yTop, b[1]], [a[0], yTop, a[1]],
    ];
    for (const [x, y, z] of face) {
      out.pos.push(x, y, z);
      out.uv.push((x * nz - z * nx) / tile, y / tile);
    }
  }
  out.runs++;
  return 1;
}

/** A surveyed ground ring draped on the drawn terrain (the fleets pattern). */
function drapeRing(rings, ground, lift, seg, maxDepth) {
  const contour = rings[0].map(([x, z]) => new THREE.Vector2(x, -z));
  const holes = rings.slice(1)
    .map((r) => r.map(([x, z]) => new THREE.Vector2(x, -z)))
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
        throw new Error(`campus-photo-pacific: surfaceAt returned ${g} inside a surveyed ground ring at (${p.x}, ${p.y})`);
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

/** One InstancedMesh from a list of placements. */
function instanced(geo, mat, items) {
  const mesh = new THREE.InstancedMesh(geo, mat, items.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  items.forEach((it, i) => {
    e.set(it.rotX || 0, it.rot || 0, 0, "YXZ");
    q.setFromEuler(e);
    s.set(it.scale[0], it.scale[1], it.scale[2]);
    p.set(it.x, it.y, it.z);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/* ------------------------------------------------------------------ api */

/**
 * Build Pacific Hall's photo-sourced detail.
 *
 * `photo` is the loaded photo-detail document; this reads ONLY its `pacific`
 * key. Everything on the ground seats on `surfaceAt` — the drawn terrain
 * triangle — never on `heightAt`; the building's own heights are absolute repo
 * elevations out of the 2014 laser and need no sampler at all.
 */
export function createPhotoPacific(scene, { photo, heightAt, surfaceAt } = {}) {
  const group = new THREE.Group();
  group.name = "photo-pacific";
  const section = photo?.pacific;
  if (!section) {
    scene?.add(group);
    return { group, counts: {} };
  }
  const ground = surfaceAt || heightAt;
  if (typeof ground !== "function") {
    throw new Error("campus-photo-pacific: needs surfaceAt (or heightAt) to place on the ground");
  }

  /* PRE-MERGE GUARD. Every metre this module draws comes out of the section's
     own blocks, and a section that predates the R5 merge has none of them.
     Half a building drawn off a half-section is the silent failure this repo
     keeps failing on, so: build NOTHING and name exactly which keys are
     missing, so a half-landed merge cannot pass unnoticed. */
  const missing = ["measured", "derivations", "estimates", "reads", "draw", "system",
    "colors", "colorSources", "absent", "conflicts"].filter((k) => !section[k]);
  if (section.measured && !section.measured.building?.ring) missing.push("measured.building.ring");
  if (section.measured && !section.measured.groundRings?.owned) missing.push("measured.groundRings.owned");
  if (section.system && !Array.isArray(section.system.runs)) missing.push("system.runs");
  if (section.system?.bay?.module === undefined) missing.push("system.bay.module");
  if (section.system?.wing?.box === undefined) missing.push("system.wing.box");
  if (section.system?.penthouse?.screenTopRepo === undefined) missing.push("system.penthouse.screenTopRepo");
  if (section.system?.awning?.projection === undefined) missing.push("system.awning.projection");
  if (missing.length) {
    scene?.add(group);
    return { group, counts: { pendingMerge: missing.join(",") } };
  }

  const { colors, draw: D, system: S } = section;
  const hue = (role) => {
    const v = colors[role];
    if (typeof v !== "string") {
      throw new Error(`campus-photo-pacific: no colour declared for role "${role}" — `
        + "an unset role silently becomes white in campus-materials.js and must never reach a material");
    }
    return v;
  };
  const T = D.tiles;

  const closed = section.measured.building.ring;
  const ring = closed.slice(0, -1);
  const ccw = ringCcw(ring);
  const BOX = S.wing.box;
  const BAY = S.bay;
  const FA = S.facade;

  const counts = {
    runs: S.runs.length,
    bayRuns: 0, plainRuns: 0, bays: 0,
    openingsPlanned: 0, openingsBuilt: 0, openingsWithheldToGrade: 0,
    reveals: 0, piers: 0, spandrelRuns: 0, plainWallRuns: 0, parapetRuns: 0, skirtRuns: 0,
    awnings: 0, awningBrackets: 0,
    roofPlatesMain: 0, roofPlatesWing: 0, stepWallRuns: 0,
    penthouseWalls: 0, penthouseDecks: 0, penthouseStacks: 0, penthouseStacksWithheld: 0,
    groundRingsOwned: section.measured.groundRings.owned.length, groundRingsDraped: 0,
  };

  /* ------------------------------------------------------------ facades */

  const bins = {
    precastSourced: bin(), precastEstimated: bin(),
    revealSourced: bin(), revealEstimated: bin(),
    glassSourced: bin(), glassEstimated: bin(),
    parapet: bin(), step: bin(),
  };
  const awnings = [];
  const brackets = [];

  /* An edge belongs to the low wing when the ring's INTERIOR beside it lies in
     the laser's wing probe box — sampled one metre inboard along that edge's
     own inward normal, so the bar/wing junction is decided by the ring's own
     geometry and not by a run's midpoint falling a decimetre either side of
     the box line. */
  const wingSide = (e) => {
    const mx = e.ax + e.tx * (e.L / 2) - e.nx;
    const mz = e.az + e.tz * (e.L / 2) - e.nz;
    return mx >= BOX.x0 && mx <= BOX.x1 && mz >= BOX.z0 && mz <= BOX.z1;
  };

  for (const run of S.runs) {
    const frame = runFrame(ring, run.v0, run.v1, ccw);
    if (!frame.edges.length) continue;
    const isWing = frame.edges.every(wingSide);
    const mixed = !isWing && frame.edges.some(wingSide);
    const plate = isWing ? S.wing.plateRepo : S.stack.plateRepo;
    const coping = isWing ? S.wing.copingRepo : S.stack.copingRepo;
    const storeys = isWing ? S.wing.storeys : S.stack.storeys;
    const pitch = S.stack.storeyPitch;
    const sourced = run.tier === "sourced";
    const wallBin = sourced ? bins.precastSourced : bins.precastEstimated;
    const revBin = sourced ? bins.revealSourced : bins.revealEstimated;
    const glassBin = sourced ? bins.glassSourced : bins.glassEstimated;
    const g = gradesUnder(frame, ground, D.groundClipSamples, run.id);
    const floor = Math.min(plate - storeys * pitch, g.lo - D.skirtDepth);

    /* THE BAY RULE, restated in code because it is the section's only bay
       claim: a run carries the system when it is at least one module long,
       and its own module is its surveyed length divided by the bay count the
       measured module picks. There is no second typed bay anywhere. */
    const bays = run.kind === "return" || frame.length < BAY.module
      ? 0
      : Math.max(1, Math.round(frame.length / BAY.module));
    const module = bays ? frame.length / bays : 0;
    const perBay = bays ? Math.max(1, Math.round(module / BAY.halfModule)) : 0;

    if (bays) counts.bayRuns++; else counts.plainRuns++;
    counts.bays += bays;

    /* MIXED runs would need two plates on one bay rhythm; the section's run
       table is built so none exists, and a future edit that creates one is
       caught here rather than silently drawn at the wrong height. */
    if (mixed && bays) {
      throw new Error(`campus-photo-pacific: run ${run.id} straddles the wing plate boundary and carries bays — one rhythm cannot hang from two plates`);
    }

    for (const e of frame.edges) {
      const eWing = wingSide(e);
      const ePlate = eWing ? S.wing.plateRepo : S.stack.plateRepo;
      const eCoping = eWing ? S.wing.copingRepo : S.stack.copingRepo;
      const eStoreys = eWing ? S.wing.storeys : S.stack.storeys;
      const eFloor = Math.min(ePlate - eStoreys * pitch, g.lo - D.skirtDepth);
      const at = (u, w, y) => frame.at(u, w, y);
      const flip = ccw;

      if (!bays) {
        /* Plain precast: the same system without a bay rhythm no source
           resolves at these widths. Runs to the drawn grade and up to the
           plate; the parapet band goes on above it. */
        quad(wallBin, at(e.u0, D.wallOffset, eFloor), at(e.u1, D.wallOffset, eFloor),
          at(e.u1, D.wallOffset, ePlate), at(e.u0, D.wallOffset, ePlate),
          e.L / T.precast, (ePlate - eFloor) / T.precast, flip);
        counts.plainWallRuns++;
      }
      /* The parapet band, on every edge of every run — the pale coping line
         that runs unbroken round both plates. */
      quad(bins.parapet, at(e.u0, D.wallOffset + D.pierProud, ePlate),
        at(e.u1, D.wallOffset + D.pierProud, ePlate),
        at(e.u1, D.wallOffset + D.pierProud, eCoping),
        at(e.u0, D.wallOffset + D.pierProud, eCoping),
        e.L / T.precast, (eCoping - ePlate) / T.precast, flip);
      counts.parapetRuns++;
      if (eFloor < ePlate - eStoreys * pitch) counts.skirtRuns++;
    }

    if (!bays) continue;

    const winH = FA.windowOfStorey * pitch;
    const openW = FA.openingWidthFrac * (module / perBay);

    for (let st = 0; st < storeys; st++) {
      const yTop = plate - st * pitch;
      const yBot = yTop - pitch;
      /* The opening sits centred in its storey: the only symmetric placement,
         and the section resolves no other. */
      const winBot = yBot + (pitch - winH) * 0.5;
      const winTop = winBot + winH;
      const bandFoot = st === storeys - 1 ? floor : yBot;

      /* The two continuous precast bands of the storey — under the openings
         (the spandrel) and over them (the head band). */
      for (const e of frame.edges) {
        quad(wallBin, frame.at(e.u0, D.wallOffset, bandFoot), frame.at(e.u1, D.wallOffset, bandFoot),
          frame.at(e.u1, D.wallOffset, winBot), frame.at(e.u0, D.wallOffset, winBot),
          e.L / T.precast, (winBot - bandFoot) / T.precast, ccw);
        quad(wallBin, frame.at(e.u0, D.wallOffset, winTop), frame.at(e.u1, D.wallOffset, winTop),
          frame.at(e.u1, D.wallOffset, yTop), frame.at(e.u0, D.wallOffset, yTop),
          e.L / T.precast, (yTop - winTop) / T.precast, ccw);
      }
      counts.spandrelRuns += 2;

      /* The openings and the piers between them, laid on the run's own u
         axis so an arc's openings follow the surveyed curve. */
      const slot = module / perBay;
      let pierStart = 0;
      for (let k = 0; k < bays * perBay; k++) {
        const uc = (k + 0.5) * slot;
        const u0 = uc - openW * 0.5;
        const u1 = uc + openW * 0.5;
        counts.openingsPlanned++;

        /* THE GROUND CLIP: where the drawn terrain would bury an opening's
           sill, the opening is WITHHELD and the bay ships as plain precast.
           No source frame shows glazing emerging from the dirt. */
        if (winBot < g.hi) {
          counts.openingsWithheldToGrade++;
          continue;
        }
        counts.openingsBuilt++;

        /* Pier face between the last opening and this one. */
        for (const seg of splitByEdge(frame, pierStart, u0)) {
          quad(wallBin, frame.at(seg[0], D.wallOffset + D.pierProud, winBot),
            frame.at(seg[1], D.wallOffset + D.pierProud, winBot),
            frame.at(seg[1], D.wallOffset + D.pierProud, winTop),
            frame.at(seg[0], D.wallOffset + D.pierProud, winTop),
            (seg[1] - seg[0]) / T.precast, winH / T.precast, ccw);
          counts.piers++;
        }
        pierStart = u1;

        /* The deep reveal: two jambs, a head soffit and a sill, all running
           back from the panel face to the glazing plane. This is what the
           2010 raking-light shadow is, and it is the system's signature. */
        const rd = FA.revealDepth;
        for (const u of [u0, u1]) {
          quad2(revBin, frame.at(u, D.wallOffset, winBot), frame.at(u, D.wallOffset - rd, winBot),
            frame.at(u, D.wallOffset - rd, winTop), frame.at(u, D.wallOffset, winTop),
            rd / T.precast, winH / T.precast);
          counts.reveals++;
        }
        for (const y of [winBot, winTop]) {
          quad2(revBin, frame.at(u0, D.wallOffset, y), frame.at(u1, D.wallOffset, y),
            frame.at(u1, D.wallOffset - rd, y), frame.at(u0, D.wallOffset - rd, y),
            openW / T.precast, rd / T.precast);
          counts.reveals++;
        }

        /* The glazing, set back one reveal depth behind the panel face. */
        quad(glassBin, frame.at(u0, D.wallOffset - rd + D.glassProud, winBot),
          frame.at(u1, D.wallOffset - rd + D.glassProud, winBot),
          frame.at(u1, D.wallOffset - rd + D.glassProud, winTop),
          frame.at(u0, D.wallOffset - rd + D.glassProud, winTop),
          openW / T.glass, winH / T.glass, ccw);

        /* THE BARREL-VAULT AWNINGS. One half-cylinder shell per opening per
           storey, opening downward, on the two sourced ARCS and on
           facade.awningExtraBays of the straight south face at each arc end —
           which is exactly as far as two photographs go. */
        if (awningHere(run, k, bays, perBay, FA.awningExtraBays)) {
          const proj = S.awning.projection;
          const p = frame.at(uc, D.wallOffset + proj * 0.5, winTop + S.awning.headClearance + proj * 0.5);
          const e = frame.edgeAt(uc);
          awnings.push({
            x: p.x, y: p.y, z: p.z,
            rot: Math.atan2(e.nx, e.nz),
            scale: [openW, proj, proj],
          });
          counts.awnings++;
          for (const f of [D.bracketInsetFrac, 1 - D.bracketInsetFrac]) {
            const ub = u0 + openW * f;
            const bp = frame.at(ub, D.wallOffset + proj * 0.5, winTop + S.awning.headClearance * 0.5);
            brackets.push({
              x: bp.x, y: bp.y, z: bp.z,
              rot: Math.atan2(e.nx, e.nz),
              scale: [D.bracketSection, S.awning.headClearance, proj],
            });
            counts.awningBrackets++;
          }
        }
      }
      /* The closing pier at the run's far end. */
      for (const seg of splitByEdge(frame, pierStart, frame.length)) {
        quad(wallBin, frame.at(seg[0], D.wallOffset + D.pierProud, winBot),
          frame.at(seg[1], D.wallOffset + D.pierProud, winBot),
          frame.at(seg[1], D.wallOffset + D.pierProud, winTop),
          frame.at(seg[0], D.wallOffset + D.pierProud, winTop),
          (seg[1] - seg[0]) / T.precast, winH / T.precast, ccw);
        counts.piers++;
      }
    }
  }

  const facades = new THREE.Group();
  facades.name = "pacific-facades";
  const addBin = (b, mat, name, into) => {
    if (!b.runs) return;
    const mesh = new THREE.Mesh(geometryOf(b), mat);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    into.add(mesh);
  };
  addBin(bins.precastSourced, aggregate(hue("precast")), "pacific-facade-precast-sourced", facades);
  addBin(bins.precastEstimated, aggregate(hue("precast")), "pacific-facade-precast-estimated", facades);
  addBin(bins.revealSourced, cast(hue("precast")), "pacific-facade-reveal-sourced", facades);
  addBin(bins.revealEstimated, cast(hue("precast")), "pacific-facade-reveal-estimated", facades);
  addBin(bins.glassSourced, glassOf(hue("glazing")), "pacific-facade-glazing-sourced", facades);
  addBin(bins.glassEstimated, glassOf(hue("glazing")), "pacific-facade-glazing-estimated", facades);
  addBin(bins.parapet, cast(hue("precast")), "pacific-parapet-measured", facades);
  group.add(facades);

  if (awnings.length) {
    /* The shell: a half-cylinder of unit diameter, axis along the face, open
       downward. Its RISE is half its projection — the half-cylinder's own
       geometry, not a second estimate. */
    const shell = new THREE.CylinderGeometry(0.5, 0.5, 1, D.awningSegments, 1, true, 0, Math.PI);
    shell.rotateZ(Math.PI / 2);
    const mesh = instanced(shell, shellOf(hue("awningBlue")), awnings);
    mesh.name = "pacific-awning-shell-sourced";
    facades.add(mesh);
    const br = instanced(new THREE.BoxGeometry(1, 1, 1), metal(hue("awningBlue")), brackets);
    br.name = "pacific-awning-bracket-estimated";
    facades.add(br);
  }

  /* --------------------------------------------------------------- roof */

  const roof = new THREE.Group();
  roof.name = "pacific-roof";
  /* The unbounded sides of each partition half-plane, expressed as the ring's
     own bbox stepped one metre clear so no vertex can land on a clip line the
     partition did not mean to cut. Not a dimension of anything. */
  const bx = ring.reduce((a, p) => ({
    x0: Math.min(a.x0, p[0]), x1: Math.max(a.x1, p[0]),
    z0: Math.min(a.z0, p[1]), z1: Math.max(a.z1, p[1]),
  }), { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity });
  const OUT = { x0: bx.x0 - 1, x1: bx.x1 + 1, z0: bx.z0 - 1, z1: bx.z1 + 1 };
  const wingPoly = clipRect(ring, BOX.x0, OUT.z0, OUT.x1, BOX.z1);
  const mainSouth = clipRect(ring, OUT.x0, BOX.z1, OUT.x1, OUT.z1);
  const mainNorth = clipRect(ring, OUT.x0, OUT.z0, BOX.x0, BOX.z1);

  const mainBin = bin();
  for (const poly of [mainSouth, mainNorth]) {
    if (poly.length >= 3) counts.roofPlatesMain += ringPlate(mainBin, poly, S.stack.plateRepo, D.plateThickness, T.membrane);
  }
  addBin(mainBin, membraneOf(hue("roofMembrane")), "pacific-roof-plate-measured", roof);

  const wingBin = bin();
  if (wingPoly.length >= 3) {
    counts.roofPlatesWing += ringPlate(wingBin, wingPoly, S.wing.plateRepo, D.plateThickness, T.membrane);
  }
  addBin(wingBin, membraneOf(hue("wingRoof")), "pacific-wing-plate-measured", roof);

  /* THE STEP WALL. The 8.82 m the drawn prism does not have: every edge the
     wing clip INTRODUCED (both endpoints on the box's own lines, i.e. not an
     edge of the survey) carries a wall from the wing's plate up to the bar's.
     Ring-borne edges are already facade and are skipped. */
  {
    const onLine = (p) => Math.abs(p[0] - BOX.x0) < 1e-6 || Math.abs(p[1] - BOX.z1) < 1e-6;
    for (let i = 0; i < wingPoly.length; i++) {
      const a = wingPoly[i];
      const b = wingPoly[(i + 1) % wingPoly.length];
      if (!onLine(a) || !onLine(b)) continue;
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (!(L > 0)) continue;
      const A = { x: a[0], y: S.wing.plateRepo, z: a[1] };
      const B = { x: b[0], y: S.wing.plateRepo, z: b[1] };
      quad2(bins.step, A, B, { ...B, y: S.stack.plateRepo }, { ...A, y: S.stack.plateRepo },
        L / T.precast, (S.stack.plateRepo - S.wing.plateRepo) / T.precast);
      counts.stepWallRuns++;
    }
    addBin(bins.step, aggregate(hue("precast")), "pacific-wing-step-wall-measured", roof);
  }

  /* THE ROOFTOP MECHANICAL SPINE — the object that owns the 33.2. Four screen
     walls from the plate to the measured 55.2 plane, and the 55.2 plane
     itself: the p95 sits flat at 55.2 ACROSS the band, which is a horizontal
     surface, not a perimeter. The equipment enclosures at 53.1-54.3 are
     measured and are deliberately NOT drawn — this deck covers all of them,
     so no part of one is visible and drawing one would invent a plan (g7). */
  {
    const P = S.penthouse;
    /* THE CLIP. The band's measured extent is a rectangle and the roof it
       stands on is not: the ring's two east-end slots (g5) cut into z
       223.9-224.4 and z 231.3-231.9 at the band's east end, and a rectangle
       laid over them would hang 4.85 m of screen wall over a hole. The
       footprint is the measured rectangle INTERSECTED with the main roof
       plate, so every measured edge that is genuinely on the plate keeps its
       measured position and only the overhang goes. */
    const foot = clipRect(mainSouth, P.x0, P.z0, P.x1, P.z1);
    const screen = bin();
    for (let i = 0; i < foot.length; i++) {
      const a = foot[i];
      const b = foot[(i + 1) % foot.length];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (!(L > 0)) continue;
      const A = { x: a[0], y: S.stack.plateRepo, z: a[1] };
      const B = { x: b[0], y: S.stack.plateRepo, z: b[1] };
      quad2(screen, A, B, { ...B, y: P.screenTopRepo }, { ...A, y: P.screenTopRepo },
        L / T.screen, (P.screenTopRepo - S.stack.plateRepo) / T.screen);
      counts.penthouseWalls++;
    }
    counts.penthouseDecks += ringPlate(screen, foot, P.screenTopRepo, D.penthouseWallThickness, T.screen);
    counts.penthouseFootArea = ringArea(foot);
    addBin(screen, seamed(hue("penthouseScreen")), "pacific-penthouse-screen-measured", roof);

    /* The stacks: three MEASURED heights, evenly spaced along the measured
       band's centreline. The heights are the laser's; only how many objects
       carry them and where they stand is [estimated] (g7). */
    const cz = (P.z0 + P.z1) * 0.5;
    const stacks = [];
    P.stacksRepo.slice(0, P.stackCount).forEach((top, i) => {
      const x = P.x0 + ((i + 0.5) * (P.x1 - P.x0)) / P.stackCount;
      /* A stack stands on the deck, and the deck is the clipped footprint —
         a station the clip removed carries nothing rather than hovering. */
      if (!inRing(x, cz, foot)) { counts.penthouseStacksWithheld++; return; }
      stacks.push({
        x, y: (P.screenTopRepo + top) * 0.5, z: cz,
        scale: [P.stackDiameter, top - P.screenTopRepo, P.stackDiameter],
      });
    });
    const sm = instanced(new THREE.CylinderGeometry(0.5, 0.5, 1, D.awningSegments), metal(hue("penthouseScreen")), stacks);
    sm.name = "pacific-penthouse-stack-estimated";
    roof.add(sm);
    counts.penthouseStacks = stacks.length;
  }
  group.add(roof);

  /* ------------------------------------------------------------- ground */

  const groundGroup = new THREE.Group();
  groundGroup.name = "pacific-ground";
  {
    const lift = overlayLift(D.bedRung);
    const matOf = {
      walk: pavingOf(hue("apronPaving")),
      road: asphaltOf(hue("serviceRoad")),
      green: mulchOf(hue("plantingBed")),
    };
    for (const r of section.measured.groundRings.owned) {
      const geo = drapeRing(r.rings, ground, lift, D.bedSeg, D.bedMaxDepth);
      if (!geo) continue;
      const mat = matOf[r.kind];
      if (!mat) {
        throw new Error(`campus-photo-pacific: ground ring #${r.index} has kind "${r.kind}" and no colour role`);
      }
      const mesh = new THREE.Mesh(geo, applyOverlayDepth(mat, D.bedRung));
      mesh.renderOrder = OVERLAY[D.bedRung].renderOrder;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.name = `pacific-ground-${r.kind}-${r.index}-measured`;
      groundGroup.add(mesh);
      counts.groundRingsDraped++;
    }
  }
  group.add(groundGroup);

  counts.ringArea = ringArea(ring);
  counts.plateAreaMain = ringArea(mainSouth) + ringArea(mainNorth);
  counts.plateAreaWing = ringArea(wingPoly);
  counts.draws = group.children.reduce((s, g) => s + g.children.length, 0);

  scene?.add(group);
  return { group, counts };
}

/** A u-interval cut at the run's own edge boundaries, so a pier that spans a
    bend is emitted as one piece per edge and follows it. */
function splitByEdge(frame, ua, ub) {
  const out = [];
  if (!(ub - ua > 1e-6)) return out;
  for (const e of frame.edges) {
    const a = Math.max(ua, e.u0);
    const b = Math.min(ub, e.u1);
    if (b - a > 1e-6) out.push([a, b]);
  }
  return out;
}

/** Where an awning goes: every opening of a sourced ARC, plus `extra` bays of
    a sourced straight face at each end — the two arcs' own bays, which is
    exactly as far as the two photographs that see a shell go. */
function awningHere(run, k, bays, perBay, extra) {
  if (run.tier !== "sourced") return false;
  if (run.kind === "arc") return true;
  const bay = Math.floor(k / perBay);
  return bay < extra || bay >= bays - extra;
}
