// Sankofa Hall (TDLLN Building 4, Eighth College), from photographs — the
// INVENTED class.
//
// HKS (design architect) + EYRC + Kitchell + SWA. Topped out Aug 2022,
// occupied winter 2024. One slender cast-in-place concrete slab of 21 levels,
// a 10-storey wing hung off its south-west end (Sankofa Mid), and a
// one-storey Restaurant/Retail plinth wrapping its south-east and north-east
// flanks (Sankofa Base). It is the tallest thing in the college and reads from
// most of campus, so its CROWN and its NORTH-EAST CORNER are the two systems
// that had to be right at long range.
//
// THE EPOCH FACT THAT DECIDES EVERYTHING HERE. Eighth College was built
// ~2023 and the project's 2014 LiDAR is BLIND to it — campus-lidar.json
// massHeights has no entry for any Eighth mass, and campus-massing.js records
// that the survey "measures Sankofa at parking-lot height". So the drawn prism
// is the university facilities massing ring and its GIS h, copied verbatim
// into `measured.masses.*.ring` (campus-arcgis.json massing, /10 to metres,
// closing vertex included so the rim-median datum samples exactly as
// campus-massing.js roofElevation does). No LiDAR height is read anywhere in
// this file, and campus-3d.json's OSM h = 37.2 for "Sankofa" — a ring
// campus-massing SUPPRESSES and does not extrude — is never read either.
//
// Five things decided the shape of this file:
//
//   1. THE DRAWN BOX WINS, AND THE CONFLICT IS DECLARED. Largo Concrete's own
//      record for Building 4 is 21 cast-in-place levels at 10'-6" typical with
//      select levels at 11'-0" and 11'-6" — 67.2 to 67.7 m, almost exactly one
//      storey more than the drawn 64.0 m. But 64.0 is 21 x 3.048 m (21 x 10 ft),
//      the LRDP formula every Eighth mass except the Base wears, and it is the
//      only prism this project has. Per the Keeling rule the drawn box is
//      filled with 21 bands of 64.0/21 = 3.0476 m; 3.2004 is never extruded and
//      lives in the section's `conflicts`.
//
//   2. THE OUTWARD NORMALS COME FROM THE RING'S WINDING, NOT FROM A STORED
//      BEARING. The tower ring is re-entrant at the north-east notch, so the
//      usual "which side is the centroid on" test is wrong exactly there — and
//      the research inventory's two cheek bearings are not this edge pair at
//      all. Signed area is -1079.745 m² (clockwise), so an edge with tangent t
//      has outward normal (-t.z, t.x), and the cheeks face 53.8 and 142.5
//      degrees (north = -z). 143.7 is the SOUTH-EAST LONG FACE's normal and an
//      earlier draft of the section wrote it here by mistake. Nothing in this
//      file can inherit either slip: no bearing is ever read, only solved.
//      The same re-entrancy is why a BOUNDARY FIN is dropped when it lands
//      inside its own mass — at a concave corner the edge normal points into
//      the neighbouring face's solid.
//
//   3. THE PLINTH IS NOT WHERE THE PROSE SAYS IT IS, AND THE SURVEY DECIDES.
//      Sampled against the drawn rings, 74% of the plinth's 26.93 m "north-east
//      end" is UNDER the tower — the tower cantilevers 2.5-4.4 m past it at
//      that corner. Every plinth face is therefore emitted as EXPOSED RUNS:
//      one-metre sub-segments whose midpoint falls inside the tower or the Mid
//      are dropped, wall, canopy, storefront and all. That is also what keeps
//      the exposed plinth roof at the ~840 m² the survey arithmetic predicts
//      (2508.6 less the 1079.7 tower plate and the 589.4 Mid plate) instead of
//      carpeting 2508 m² of roof through two buildings.
//
//   4. THE NORTH-EAST LOGGIA STACK IS THE BUILDING'S SIGNATURE, AND ITS COUNT
//      IS CLOSED BY A DOCUMENT. Twenty open recessed loggias, one per
//      residential floor — the university's own layout PDF says L1 lobby,
//      L2-L21 residential, which closes what phf17 can only count to ~19 before
//      the crop runs out. Each carries a projecting slab, a glazed lounge, a
//      balustrade and a downlight at the open corner; that vertical run of
//      lights is how you identify this building at night. The surveyed
//      re-entrant notch is where the stack sits, so the stack wraps onto the
//      notch's south-east cheek and the notch is cut, never smoothed.
//
//   5. THERE IS NO PHOTOVOLTAIC ARRAY, AND THE ABSENCE IS THE FINDING. The
//      2021 design renderings draw large dark PV fields across these roofs;
//      the 2024-25 built aerials show membrane, parapets, penthouses and RTUs
//      and nothing else — with Keeling's own roof PV visible in the same frames
//      as the positive control. This is Keeling's deleted-canopy trap running
//      the other way, and it is recorded as an explicit `absent` entry rather
//      than built from the rendering.
//
// Colours are DATA — every hex comes from the `colors` block of the photo
// document's `sankofa` section, with per-role provenance in `colorSources`.
// Surfaces come from the procedural material library (campus-materials.js):
// code-generated maps only, never a photograph or a satellite pixel.
// Deterministic — the only irregularity source is `hash`, seeded from the
// section's pinned `seed`.
import * as THREE from "../vendor/three/three.module.min.js";
import { applyOverlayDepth, OVERLAY, overlayLift } from "./campus-overlay.js";
import { createMaterialLibrary } from "./campus-materials.js";

const PAD = "pad";
const CARPET = "carpet";
const PAINT = "paint";

let LIB = null;
const lib = () => (LIB ??= createMaterialLibrary(THREE));

/* Large-format flat rainscreen panel: barely metallic, matte. */
const panelMat = (c) => lib().get("metalPanel", { color: c, metalness: 0.16, roughness: 0.62 });
/* Folded metal fins and their warm returns — a touch crisper than the field. */
const finMat = (c) => lib().get("metalPanel", { color: c, metalness: 0.24, roughness: 0.54 });
const painted = (c) => lib().get("metalPanel", { color: c, metalness: 0.35, roughness: 0.55 });
const louvreMat = (c) => lib().get("metalPanelSeam", { color: c, metalness: 0.5, roughness: 0.5 });
const concrete = (c) => lib().get("smoothConcrete", { color: c });
const boardformed = (c) => lib().get("boardFormedConcrete", { color: c, normalScale: 0.6 });
const glassMat = (c) => lib().get("glass", { color: c });
const membraneMat = (c, repeat) => lib().get("roofMembrane", { color: c, repeat });
const woodMat = (c, repeat) => lib().get("woodSlat", { color: c, repeat });
/* Long-format brick in running bond. The library's `brick` class tiles 8
   courses x 4 units per repeat, so the real tile is 4*unitLength wide and
   8*courseHeight tall — the per-surface repeat lever that puts the coursing at
   the declared (and, here, [estimated]) scale. */
const brickMat = (c, w, h, B) =>
  lib().get("brick", {
    color: c, normalScale: 0.8,
    repeat: [Math.max(0.2, w / (4 * B.unitLength)), Math.max(0.2, h / (8 * B.courseHeight))],
  });
/* The loggia downlight lens. Geometry with a LOW emissive so it reads as a
   luminaire rather than as an invented night source — the standard Keeling's
   lamps set, taken one step further only because the vertical run of these
   lights is the sourced, named identity of this building. */
const lens = (c, intensity) =>
  new THREE.MeshStandardMaterial({
    color: c, emissive: new THREE.Color(c), emissiveIntensity: intensity,
    roughness: 0.35, metalness: 0.0,
  });

function decal(color, rung, cls = "smoothConcrete", repeat) {
  return applyOverlayDepth(lib().get(cls, { color, repeat }), rung);
}

/** Deterministic 0..1 from any integer mix — a reload rebuilds the same tower. */
function hash(...ns) {
  let s = 0;
  for (let i = 0; i < ns.length; i++) s = s * 131.71 + ns[i] * 57.13 + 7.9;
  const v = Math.sin(s) * 43758.5453;
  return v - Math.floor(v);
}
const pick = (list, ...ns) => list[Math.floor(hash(...ns) * list.length) % list.length];

/** One InstancedMesh from a list of placements (the keeling/york convention). */
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

/** A flat XZ quad lying in the ground plane. */
function quad(w, d) {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  return g;
}

/* --------------------------------------------------------------- geometry */

/** The ring without its repeated closing vertex — the vertex list facades index. */
function vertsOf(ring) {
  const v = ring.slice();
  const f = v[0];
  const l = v[v.length - 1];
  if (v.length > 1 && f[0] === l[0] && f[1] === l[1]) v.pop();
  return v;
}

function signedArea(verts) {
  let s = 0;
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

/**
 * Outward normal of the edge a->b, decided by the ring's WINDING and not by
 * the centroid. A clockwise ring (negative signed area, which all three
 * Sankofa masses are) has outward = (-t.z, t.x). The centroid test is wrong at
 * a re-entrant vertex, and the tower ring is re-entrant at exactly the corner
 * this file cares most about.
 */
function outwardOf(verts, i, j) {
  const [ax, az] = verts[i];
  const [bx, bz] = verts[j];
  const len = Math.hypot(bx - ax, bz - az) || 1;
  const tx = (bx - ax) / len;
  const tz = (bz - az) / len;
  return signedArea(verts) < 0 ? [-tz, tx] : [tz, -tx];
}

/**
 * A face's own frame. The tangent is the DRAWN edge itself; `at(u, w, y)` is u
 * metres along the face from vertex `a`, w metres proud of it, y in world
 * height. A box rotated by `rot` has its local +Z pointing out of the face.
 */
function frameOf(a, b, out) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const tx = (b[0] - a[0]) / length;
  const tz = (b[1] - a[1]) / length;
  const [nx, nz] = out;
  return {
    length,
    rot: Math.atan2(nx, nz),
    nx, nz, tx, tz,
    at: (u, w, y) => ({ x: a[0] + tx * u + nx * w, y, z: a[1] + tz * u + nz * w }),
  };
}

/** Bay centres along a face, the leftover split evenly at both ends. */
function bayCentres(length, module) {
  const n = Math.max(1, Math.round(length / module));
  const pad = (length - n * module) / 2;
  const out = [];
  for (let i = 0; i < n; i++) out.push({ i, u: pad + (i + 0.5) * module });
  return out;
}

const inRing = (x, z, r) => {
  let ins = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, zi] = r[i];
    const [xj, zj] = r[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
};

/** All interior x-spans of a ring at a given z, parity-paired. */
function spansAt(ring, z) {
  const xs = [];
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i];
    const [bx, bz] = ring[(i + 1) % ring.length];
    if (z < Math.min(az, bz) || z >= Math.max(az, bz) || az === bz) continue;
    xs.push(ax + ((bx - ax) * (z - az)) / (bz - az));
  }
  xs.sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i + 1 < xs.length; i += 2) out.push([xs[i], xs[i + 1]]);
  return out;
}

/** a minus b, both lists of [x0, x1] intervals. */
function subtractSpans(a, b) {
  let out = a.slice();
  for (const [c0, c1] of b) {
    const next = [];
    for (const [s0, s1] of out) {
      if (c1 <= s0 || c0 >= s1) { next.push([s0, s1]); continue; }
      if (c0 > s0) next.push([s0, c0]);
      if (c1 < s1) next.push([c1, s1]);
    }
    out = next;
  }
  return out.filter(([s0, s1]) => s1 - s0 > 0.15);
}

/**
 * The runs of a plinth face that are NOT buried in the tower or the Mid,
 * sampled every `step` metres a little proud of the wall. 74% of the plinth's
 * north-east edge is under the tower; without this the wall, the canopy and
 * the storefront would all be built inside another building.
 */
function exposedRuns(frame, blockers, step = 1.0, off = 0.6) {
  const n = Math.max(1, Math.ceil(frame.length / step));
  const cells = [];
  for (let i = 0; i < n; i++) {
    const u = ((i + 0.5) * frame.length) / n;
    /* Sampled at TWO depths: a little proud, and on the wall plane itself.
       Where a blocker's boundary crosses the plinth edge at an angle the two
       disagree, and a storefront mullion sitting 57 mm off the wall then lands
       inside the tower while the 0.6 m probe reads clear. */
    cells.push([0.02, off].every((w) => {
      const p = frame.at(u, w, 0);
      return !blockers.some((r) => inRing(p.x, p.z, r));
    }));
  }
  const runs = [];
  let start = null;
  for (let i = 0; i <= n; i++) {
    const open = i < n && cells[i];
    if (open && start === null) start = i;
    if (!open && start !== null) {
      runs.push([(start * frame.length) / n, (i * frame.length) / n]);
      start = null;
    }
  }
  return runs.filter(([a, b]) => b - a > 0.4);
}

const inRuns = (u, runs) => runs.some(([a, b]) => u >= a && u <= b);

/** campus-massing.js roofElevation, verbatim in rule: rim-median ground under
 *  the DRAWN ring plus the drawn height, never below the highest footprint
 *  ground. The ring is passed WITH its closing vertex so the median samples
 *  exactly the same list the extruder does. */
function roofElevationOf(ring, h, base) {
  let highest = -Infinity;
  const gs = [];
  for (const [x, z] of ring) {
    const g = base(x, z);
    if (g != null && Number.isFinite(g)) {
      gs.push(g);
      if (g > highest) highest = g;
    }
  }
  let surveyed = h;
  if (gs.length) {
    gs.sort((a, b) => a - b);
    surveyed = gs[Math.floor(gs.length / 2)] + h;
  }
  return highest > -Infinity && surveyed < highest ? highest : surveyed;
}

/** Lowest drawn-terrain height along a face — skirts run down to this so no
    ground ever passes under the building. */
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

/* ------------------------------------------------------- the tower membrane */

/** The pleat: the wall folds in and out in plan at every `everyBays` bays. */
const pleatProud = (P, bay) => (Math.floor(bay / P.everyBays) % 2 ? P.foldDepth : 0);

/**
 * The one facade system, on every membrane face of the tower and the Mid:
 * pleated rainscreen panels with fine vertical reveals, a one-storey folded
 * fin at every bay boundary whose RETURN face is warm, and one tall narrow
 * slot window per bay in a recessed charcoal surround.
 */
function collectMembrane(section, f, frame, ctx, bins) {
  const FS = section.facadeSystem;
  const P = FS.pleat;
  const W = FS.window;
  const { roofY, storeyH, levels } = ctx.mass[f.mass];
  const bottom = ctx.faceBottom(f);
  const M = frame.length / Math.max(1, f.bays);
  const bays = bayCentres(frame.length, M);
  const blank = f.system === "membraneBlank";
  const seed = section.seed;
  let lowest = roofY;

  for (let k = 0; k < levels; k++) {
    const y0 = roofY - (k + 1) * storeyH;
    const y1 = y0 + storeyH;
    if (y1 <= bottom + 0.05) continue;
    const b0 = Math.max(y0, bottom);
    const h = y1 - b0;
    lowest = Math.min(lowest, b0);

    for (const bay of bays) {
      const proud = FS.standoff + pleatProud(P, bay.i);
      const tone = pleatProud(P, bay.i) > 0 ? "panelSunlit" : "panelBody";
      bins.panels.push({
        tone,
        ...frame.at(bay.u, proud + FS.panel.thickness / 2, b0 + h / 2),
        rot: frame.rot,
        scale: [M - FS.panel.gap, h, FS.panel.thickness],
      });
      /* Fine vertical reveal joints — sourced as a COUNT (4-6 across a panel
         field in phf22), laid on the section's [estimated] 1.20 m module. */
      const face = proud + FS.panel.thickness;
      for (let r = section.grid.panelModule; r < M - 0.2; r += section.grid.panelModule) {
        bins.reveals.push({
          ...frame.at(bay.u - M / 2 + r, face + FS.panel.revealDepth / 2, b0 + h / 2),
          rot: frame.rot,
          scale: [FS.panel.revealWidth, h - 0.06, FS.panel.revealDepth],
        });
      }
      if (blank || h < W.height + W.sill + 0.2) continue;
      /* The slot: glass set behind a recessed charcoal surround wider than it. */
      const sw = Math.max(0.02, proud - W.recess);
      bins.surrounds.push({
        ...frame.at(bay.u, sw + W.surroundProud / 2, b0 + W.sill + W.height / 2),
        rot: frame.rot,
        scale: [W.surroundWidth, W.height + 0.24, W.surroundProud],
      });
      bins.glass.push({
        tint: hash(seed, k, bay.i, frame.length) < 0.3 ? "glassSky" : "glassShade",
        ...frame.at(bay.u, sw + W.surroundProud + 0.02, b0 + W.sill + W.height / 2),
        rot: frame.rot,
        scale: [W.width, W.height, 1],
      });
      if (bay.i % W.ventEveryBays === 0) {
        bins.vents.push({
          ...frame.at(bay.u, sw + W.surroundProud + 0.03, b0 + W.sill + W.height + W.ventHeight / 2 + 0.04),
          rot: frame.rot,
          scale: [W.width, W.ventHeight, 0.05],
        });
      }
    }

    /* One folded fin at every bay boundary, one storey tall, with a sloped
       cap. The fin's OUTER face is panel grey and its RETURN face is warm —
       which is why this building photographs neutral from the north-west and
       amber from the south-east.
       A BOUNDARY fin (i = 0 or i = f.bays) is dropped when the offset lands
       INSIDE its own mass. At the re-entrant notch the cheek's outward normal
       points into the next face's solid, and an unconditional boundary fin
       buried one instance per storey — twenty of them — inside the tower at
       P3. The ring test is the general form of the rule and costs nothing on a
       convex corner. */
    const F = FS.fin;
    const ring = ctx.ringOf(f.mass);
    for (let i = 0; i <= f.bays; i++) {
      const u = Math.min(frame.length - 0.02, Math.max(0.02, bays.length ? bays[0].u - M / 2 + i * M : i * M));
      const depth = Math.max(pleatProud(P, Math.max(0, i - 1)), pleatProud(P, i)) + F.projection;
      const w = FS.standoff + depth / 2;
      /* A fin at the END of a run folds its warm return INWARD, not off the
         end of the face — otherwise the return steps past the last vertex and
         into the neighbouring mass. */
      const off = (F.thickness + F.returnThickness) / 2;
      const ru = i === f.bays ? u - off : u + off;
      if (i === 0 || i === f.bays) {
        const pf = frame.at(u, w, 0);
        const pr = frame.at(ru, w, 0);
        if (inRing(pf.x, pf.z, ring) || inRing(pr.x, pr.z, ring)) {
          bins.counts.finsBuried++;
          continue;
        }
      }
      bins.fins.push({
        ...frame.at(u, w, b0 + h / 2), rot: frame.rot,
        scale: [F.thickness, h - F.capHeight, depth],
      });
      bins.finReturns.push({
        tone: pick(F.warmPalette, seed + 3, i, k, Math.round(frame.length * 10)),
        ...frame.at(ru, w, b0 + h / 2),
        rot: frame.rot,
        scale: [F.returnThickness, h - F.capHeight, depth - 0.02],
      });
      bins.finCaps.push({
        ...frame.at(u, w, b0 + h - F.capHeight / 2), rot: frame.rot,
        scale: [F.thickness + 2 * F.returnThickness, F.capHeight, depth],
      });
    }
  }

  /* The skirt: plain panel from the lowest band down PAST the drawn terrain,
     so no ground passes under the building. On faces the plinth stands in
     front of, it is the recessed dark the undercroft reads as.
     NOT on the south-west end: that face starts at the MID's parapet and the
     Mid is what carries it, so a skirt there would be a 31 m wall driven
     straight down through the Mid. A face whose carrier is another mass is
     carried, not skirted. */
  const gmin = groundMinAlong(frame, ctx.ground) - 0.6;
  if (f.startsAt !== "midRoof" && lowest - gmin > 0.25) {
    bins.skirts.push({
      tone: f.startsAt === "grade" ? "panelBody" : "loggiaSoffit",
      ...frame.at(frame.length / 2, FS.standoff + 0.03, (lowest + gmin) / 2),
      rot: frame.rot,
      scale: [frame.length, lowest - gmin, 0.06],
    });
    bins.counts.deepestSkirt = Math.max(bins.counts.deepestSkirt, lowest - gmin);
  }
}

/* ------------------------------------------------- the north-east loggias */

/**
 * The full-height stack of open recessed loggias at the north-east end, and
 * its return onto the surveyed notch's south-east cheek. One per residential
 * floor: L1 is the lobby, L2-L21 are the twenty loggias, which is what the
 * university's own layout PDF closes the count with.
 */
function collectLoggia(section, f, frame, ctx, bins) {
  const L = section.loggia;
  const FS = section.facadeSystem;
  const { roofY, storeyH, levels } = ctx.mass[f.mass];
  const baseY = roofY - levels * storeyH;
  const isReturn = f.system === "loggiaReturn";
  /* The composition is a COUNT over the surveyed face, exactly like every bay
     rhythm in this section: the north-east end carries 5 bays of its own
     16.34 m, and the loggia takes 2 of them, the curtain wall 3, the pier 0.
     Nothing here is a typed width — see the section's conflicts[3]. */
  const M = frame.length / Math.max(1, f.bays);
  const openW = isReturn ? frame.length : Math.min(L.loggiaBays * M, frame.length);
  const uc = isReturn ? frame.length / 2 : openW / 2;
  /* The slab above each loggia drops a shadow gap below the structural line,
     which is what makes every opening read as separate in phf17. */
  const clear = storeyH - L.slabThickness - L.soffitDrop;

  for (let k = 1; k <= L.count; k++) {
    const yFloor = baseY + k * storeyH;
    const yCeil = yFloor + storeyH;
    /* The dark recess the loggia reads as, and the glazed lounge behind it. */
    bins.recessBacks.push({
      ...frame.at(uc, FS.standoff, yFloor + clear / 2), rot: frame.rot,
      scale: [openW - 0.1, clear, 1],
    });
    bins.glass.push({
      tint: "glassShade",
      ...frame.at(uc, FS.standoff + L.glassInset, yFloor + clear / 2), rot: frame.rot,
      scale: [openW - 0.6, clear - 0.4, 1],
    });
    /* The projecting floor slab — the continuous white bands of phf15. */
    bins.loggiaSlabs.push({
      ...frame.at(uc, L.slabProjection / 2, yFloor - L.slabThickness / 2), rot: frame.rot,
      scale: [openW, L.slabThickness, L.slabProjection],
    });
    /* Balustrade at the open edge: 42 in guard, posts and a top rail. */
    const bu0 = uc - openW / 2 + 0.2;
    const n = Math.max(1, Math.round((openW - 0.4) / L.balustrade.postSpacing));
    for (let p = 0; p <= n; p++) {
      bins.railPosts.push({
        ...frame.at(bu0 + (p * (openW - 0.4)) / n, L.slabProjection - 0.12,
          yFloor + L.balustrade.height / 2),
        rot: frame.rot,
        scale: [L.balustrade.bar, L.balustrade.height, L.balustrade.bar],
      });
    }
    for (const hh of [L.balustrade.height, L.balustrade.height * 0.5]) {
      bins.railBars.push({
        ...frame.at(uc, L.slabProjection - 0.12, yFloor + hh), rot: frame.rot,
        scale: [openW - 0.35, L.balustrade.bar, L.balustrade.bar],
      });
    }
    /* One downlight at the OPEN CORNER of every floor — the vertical run of
       bright points that identifies this building at night. Not on the
       return cheek: phf17 resolves one run, not two. */
    if (!isReturn) {
      bins.downlights.push({
        ...frame.at(L.downlight.inset, L.slabProjection - 0.5, yCeil - L.slabThickness - L.downlight.depth / 2),
        rot: frame.rot,
      });
    }
  }
  /* The top soffit: the slab that closes the highest loggia. */
  bins.loggiaSlabs.push({
    ...frame.at(uc, L.slabProjection / 2, roofY - L.slabThickness / 2), rot: frame.rot,
    scale: [openW, L.slabThickness, L.slabProjection],
  });

  if (isReturn) {
    collectGroundBand(section, f, frame, ctx, bins, frame.length, 0);
    return;
  }

  /* Beside the loggia: the dark glazed curtain-walled study/lounge bay, and
     then — only if the section's own count says so — a solid pier. It does
     not: Apple close-08 and orbit-08 read the glazed bay running unbroken to
     the north-west corner, so `pierBays` is 0 and nothing is emitted for it.
     See the section's conflicts[3]. */
  const curtainW = L.curtainBays * M;
  const pierW = L.pierBays * M;
  const u1 = openW + curtainW / 2;
  const u2 = openW + curtainW + pierW / 2;
  for (let k = 1; k <= L.count + 1; k++) {
    const y0 = baseY + k * storeyH;
    if (curtainW > 0.4) {
      bins.glass.push({
        tint: "glassShade",
        ...frame.at(u1, FS.standoff + 0.04, y0 + storeyH / 2), rot: frame.rot,
        scale: [curtainW - 0.3, storeyH - 0.35, 1],
      });
      bins.curtainMullions.push({
        ...frame.at(u1, FS.standoff + 0.09, y0 + 0.1), rot: frame.rot,
        scale: [curtainW, 0.2, 0.08],
      });
    }
    if (pierW > 0.4) {
      bins.panels.push({
        tone: "panelBody",
        ...frame.at(u2, FS.standoff + FS.panel.thickness / 2, y0 + storeyH / 2),
        rot: frame.rot,
        scale: [pierW - FS.panel.gap, storeyH, FS.panel.thickness],
      });
    }
  }
  collectGroundBand(section, f, frame, ctx, bins, frame.length, 0);
}

/** The lobby storey under the loggia stack, and the skirt below it. */
function collectGroundBand(section, f, frame, ctx, bins, width, u0) {
  const FS = section.facadeSystem;
  const { roofY, storeyH, levels } = ctx.mass[f.mass];
  const baseY = roofY - levels * storeyH;
  const gmin = groundMinAlong(frame, ctx.ground) - 0.6;
  bins.recessBacks.push({
    ...frame.at(u0 + width / 2, FS.standoff, (baseY + gmin) / 2 + storeyH / 2), rot: frame.rot,
    scale: [width - 0.1, baseY + storeyH - gmin, 1],
  });
  bins.groundGlass.push({
    ...frame.at(u0 + width / 2, FS.standoff + 0.06, baseY + storeyH / 2), rot: frame.rot,
    scale: [width - 0.8, storeyH - 0.5, 1],
  });
}

/* --------------------------------------------------------- the roof crown */

/** The parapet: a CONTINUATION of the membrane, capped by a thin coping —
 *  stepped DOWN over the loggia stack and topped there by a pipe guardrail,
 *  which is what gives the crown its asymmetric silhouette from campus. */
function collectParapet(section, verts, roofY, stepFaces, bins, skip = new Set()) {
  const PB = section.parapet;
  for (let i = 0; i < verts.length; i++) {
    /* A SHARED edge carries no parapet and no coping, for the same reason it
       carries no facade: everything hung on it stands inside the neighbouring
       mass's own drawn solid. The Mid's party wall ran 19.83 m of parapet and
       coping at y 43.1 wholly inside the tower until this exclusion existed,
       and the index comes straight off the section's `shared` facade record so
       the two can never drift apart. */
    if (skip.has(i)) continue;
    const j = (i + 1) % verts.length;
    const a = verts[i];
    const b = verts[j];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.2) continue;
    const frame = frameOf(a, b, outwardOf(verts, i, j));
    const stepped = stepFaces.has(i);
    /* Over the loggia stack the parapet drops to a low upstand and the pipe
       guardrail carries the edge instead — the step is what the crown's
       asymmetric silhouette in phf17 is made of. The upstand still gets its
       coping, so no roof edge is ever left raw. */
    const h = Math.max(0, stepped ? PB.height - PB.neStepDown : PB.height);
    if (h > 0.02) {
      bins.parapets.push({
        ...frame.at(len / 2, section.facadeSystem.standoff + 0.12, roofY + h / 2), rot: frame.rot,
        scale: [len, h, 0.3],
      });
    }
    /* EVERY roof edge is coped, including the stepped ones. The measured
       1.12 m step-down is larger than the 1.067 m upstand it steps off, which
       is not a contradiction — it is the finding: over the loggia stack the
       SOLID parapet is gone entirely and the edge is a metal coping trim plus
       the pipe guardrail. Coping the edge anyway is what keeps the membrane
       from terminating raw. */
    bins.copings.push({
      ...frame.at(len / 2, section.facadeSystem.standoff + 0.12, roofY + h + PB.copingHeight / 2),
      rot: frame.rot,
      scale: [len, PB.copingHeight, 0.3 + 2 * PB.copingProud],
    });
    if (!stepped) continue;
    /* The slender pipe guardrail that replaces the missing parapet height. */
    const R = PB.rail;
    const n = Math.max(1, Math.round(len / R.postSpacing));
    for (let p = 0; p <= n; p++) {
      bins.railPosts.push({
        ...frame.at((p * (len - 0.3)) / n + 0.15, 0.1, roofY + h + R.height / 2), rot: frame.rot,
        scale: [R.bar, R.height, R.bar],
      });
    }
    for (const hh of [R.height, R.height * 0.55]) {
      bins.railBars.push({
        ...frame.at(len / 2, 0.1, roofY + h + hh), rot: frame.rot,
        scale: [len - 0.3, R.bar, R.bar],
      });
    }
  }
}

/** The tower roof's own (u, v) frame: u along the south-east face's tangent
    from P1, v inward. Every roof item is placed and CLIPPED in it. */
function roofFrameOf(verts, edge) {
  const a = verts[edge];
  const b = verts[(edge + 1) % verts.length];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const tx = (b[0] - a[0]) / len;
  const tz = (b[1] - a[1]) / len;
  const [ox, oz] = outwardOf(verts, edge, (edge + 1) % verts.length);
  const ix = -ox;
  const iz = -oz;
  return {
    at: (u, v) => ({ x: a[0] + tx * u + ix * v, z: a[1] + tz * u + iz * v }),
    rot: Math.atan2(ix, iz),
    len,
  };
}

/**
 * Does a footprint of `su` x `sv` centred at (u, v) sit wholly on the drawn
 * roof? All four corners inside the ring, and the centre outside every
 * declared clip. Keeling's `pv.clips` exist for exactly this reason —
 * "because nothing may hover" — and the corner test is its general form.
 */
function roofFits(rf, verts, clips, u, v, su, sv) {
  for (const c of clips) {
    if (u + su / 2 > c.u0 && u - su / 2 < c.u1 && v + sv / 2 > c.v0 && v - sv / 2 < c.v1) return false;
  }
  for (const du of [-su / 2, su / 2]) {
    for (const dv of [-sv / 2, sv / 2]) {
      const p = rf.at(u + du, v + dv);
      if (!inRing(p.x, p.z, verts)) return false;
    }
  }
  return true;
}

function buildTowerRoof(section, parent, verts, roofY, counts) {
  const R = section.roof;
  const { colors } = section;
  /* Everything that stands ON the tower's roof lives in one named group, so
     the clip gate can find it and prove the notch is genuinely empty. */
  const group = new THREE.Group();
  group.name = "sankofa-tower-roof";
  parent.add(group);
  const rf = roofFrameOf(verts, R.frame.originFace);
  const clips = R.clips || [];

  /* Roof extent in the frame, from the ring itself. */
  let uMax = 0;
  let vMax = 0;
  for (let i = 0; i < verts.length; i++) {
    const p = verts[i];
    const a = verts[R.frame.originFace];
    const b = verts[(R.frame.originFace + 1) % verts.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const tx = (b[0] - a[0]) / len;
    const tz = (b[1] - a[1]) / len;
    const [ox, oz] = outwardOf(verts, R.frame.originFace, (R.frame.originFace + 1) % verts.length);
    const dx = p[0] - a[0];
    const dz = p[1] - a[1];
    uMax = Math.max(uMax, dx * tx + dz * tz);
    vMax = Math.max(vMax, dx * -ox + dz * -oz);
  }

  /* The membrane field, laid as strips clipped to the drawn ring so it never
     paints over the notch void. */
  const field = [];
  const strip = 1.5;
  for (let u = 0; u < uMax; u += strip) {
    const su = Math.min(strip, uMax - u);
    for (let v = 0; v < vMax; v += strip) {
      const sv = Math.min(strip, vMax - v);
      const uc = u + su / 2;
      const vc = v + sv / 2;
      if (!roofFits(rf, verts, clips, uc, vc, su * 0.98, sv * 0.98)) continue;
      field.push({ ...rf.at(uc, vc), y: roofY + 0.02, rot: rf.rot, scale: [su, 1, sv] });
    }
  }
  const fieldMesh = instanced(quad(1, 1),
    decal(colors.roofMembrane, PAD, "roofMembrane", [strip / 2, strip / 2]), field, (it) => it);
  fieldMesh.renderOrder = OVERLAY[PAD].renderOrder;
  group.add(fieldMesh);
  counts.roofFieldStrips = field.length;

  /* Everything on this roof is stored as a FRACTION of the frame's own extent
     — a photograph gives you ratios, a keyboard gives you round metres. */
  const uAt = (fr) => fr * uMax;
  const vAt = (fr) => fr * vMax;

  /* The two pale walkway pads inside both long parapets, plus cross-legs to
     each equipment island. Laid as 1 m strips and clipped, which is what
     stops the south-east run cantilevering over the surveyed notch. */
  const W = R.walkway;
  const pads = [];
  let padsClipped = 0;
  const vLines = [W.inset + W.width / 2, vMax - W.inset - W.width / 2];
  for (const v of vLines) {
    for (let u = 0.5; u < uMax; u += W.strip) {
      const su = Math.min(W.strip, uMax - u);
      if (!roofFits(rf, verts, clips, u + su / 2, v, su, W.width)) { padsClipped++; continue; }
      pads.push({ ...rf.at(u + su / 2, v), y: roofY + 0.05, rot: rf.rot, scale: [su, 1, W.width] });
    }
  }
  /* A cross-leg is what connects a walkway run to a piece of plant, so it is
     DERIVED from where the plant is rather than stored as its own list of
     round metres: one leg at the u of every penthouse and every island. */
  const crossLegs = [...new Set(
    [...R.penthouses, ...R.equipment].map((p) => Math.round(uAt(p.uFrac) * 100) / 100),
  )].sort((a, b) => a - b);
  for (const u of crossLegs) {
    for (let v = vLines[0]; v < vLines[1]; v += W.strip) {
      const sv = Math.min(W.strip, vLines[1] - v);
      if (!roofFits(rf, verts, clips, u, v + sv / 2, W.width, sv)) { padsClipped++; continue; }
      pads.push({ ...rf.at(u, v + sv / 2), y: roofY + 0.05, rot: rf.rot, scale: [W.width, 1, sv] });
    }
  }
  const padMesh = instanced(quad(1, 1),
    decal(colors.roofWalkPad, CARPET, "roofMembrane", [1, 1]), pads, (it) => it);
  padMesh.renderOrder = OVERLAY[CARPET].renderOrder;
  group.add(padMesh);
  counts.roofPads = pads.length;
  counts.roofPadsClipped = padsClipped;

  /* Penthouses: the measured 4.38 m lift overrun and the [estimated] stair
     head, both clad in the same pale rainscreen panel as the tower. */
  const houses = [];
  const louvres = [];
  const hatches = [];
  for (const p of R.penthouses) {
    const pu = uAt(p.uFrac);
    const pv = vAt(p.vFrac);
    if (!roofFits(rf, verts, clips, pu, pv, p.size[0], p.size[2])) continue;
    const c = rf.at(pu, pv);
    houses.push({ x: c.x, y: roofY + p.size[1] / 2, z: c.z, rot: rf.rot, scale: p.size });
    if (p.louvre) {
      const lc = rf.at(pu, pv - p.size[2] / 2 - 0.05);
      louvres.push({
        x: lc.x, y: roofY + p.size[1] * 0.55, z: lc.z, rot: rf.rot,
        scale: [p.louvre.size[0], p.louvre.size[1], 0.1],
      });
    }
    if (p.hatch) {
      hatches.push({ x: c.x, y: roofY + p.size[1] + p.hatch[1] / 2, z: c.z, rot: rf.rot, scale: p.hatch });
    }
  }
  const unit = new THREE.BoxGeometry(1, 1, 1);
  group.add(instanced(unit, panelMat(colors.panelSunlit), houses, (it) => it));
  group.add(instanced(unit, louvreMat(colors.louvreDark), louvres, (it) => it));
  group.add(instanced(unit, painted(colors.mechanicalGrey), hatches, (it) => it));
  counts.roofPenthouses = houses.length;

  /* Mechanical: the cylinder, the AHUs, the RTUs and the north-east pipe rack,
     counted south-west to north-east off phf15. Everything sits on the darker
     membrane field between the two pale pads, never on a pad. */
  const boxes = [];
  const cylinders = [];
  const pipes = [];
  let equipmentClipped = 0;
  for (const e of R.equipment) {
    const eu = uAt(e.uFrac);
    const ev = vAt(e.vFrac);
    const su = e.kind === "cylinder" ? e.diameter : e.size[0];
    const sv = e.kind === "cylinder" ? e.diameter : e.size[2];
    if (!roofFits(rf, verts, clips, eu, ev, su, sv)) { equipmentClipped++; continue; }
    const c = rf.at(eu, ev);
    if (e.kind === "cylinder") {
      cylinders.push({ x: c.x, y: roofY + e.height / 2, z: c.z, scale: [e.diameter, e.height, e.diameter] });
      continue;
    }
    boxes.push({ x: c.x, y: roofY + e.size[1] / 2, z: c.z, rot: rf.rot, scale: e.size });
    if (e.kind !== "rack") continue;
    for (let p = 0; p < (e.pipes || 0); p++) {
      const pu = eu - e.size[0] / 2 + ((p + 0.5) * e.size[0]) / e.pipes;
      const q = rf.at(pu, ev);
      pipes.push({
        x: q.x, y: roofY + e.size[1] * 0.5 + 0.55, z: q.z,
        scale: [0.16, e.size[1] * 1.1, 0.16],
      });
    }
  }
  group.add(instanced(unit, painted(colors.mechanicalGrey), boxes, (it) => it));
  group.add(instanced(new THREE.CylinderGeometry(0.5, 0.5, 1, 14), painted(colors.mechanicalGrey),
    cylinders, (it) => it));
  group.add(instanced(new THREE.CylinderGeometry(0.5, 0.5, 1, 8), painted(colors.louvreDark),
    pipes, (it) => it));
  counts.roofEquipment = boxes.length + cylinders.length;
  counts.roofEquipmentClipped = equipmentClipped;

  /* Small curbs, vents and roof-drain pairs — a SEEDED scatter, because phf15
     resolves that they are there but not where. Every candidate whose
     footprint is not wholly on the drawn roof is dropped, which is exactly
     what keeps the north-east notch empty. */
  const C = R.curbs;
  const curbs = [];
  let curbsClipped = 0;
  for (let i = 0; i < C.candidates; i++) {
    const u = hash(section.seed, i, 1) * uMax;
    const v = hash(section.seed, i, 2) * vMax;
    if (!roofFits(rf, verts, clips, u, v, C.size[0] + 0.4, C.size[2] + 0.4)) { curbsClipped++; continue; }
    const c = rf.at(u, v);
    curbs.push({ x: c.x, y: roofY + C.size[1] / 2, z: c.z, rot: rf.rot, scale: C.size });
  }
  group.add(instanced(unit, painted(colors.mechanicalGrey), curbs, (it) => it));
  counts.roofCurbs = curbs.length;
  counts.roofCurbsClipped = curbsClipped;

  /* The finding, stated in the counts: no photovoltaics of any kind. */
  counts.pv = R.pv.panels;
  counts.pvRacks = R.pv.racks;
  counts.pvBallastTrays = R.pv.ballastTrays;
}

function buildMidRoof(section, parent, verts, roofY, counts) {
  const M = section.midRoof;
  const { colors } = section;
  const group = new THREE.Group();
  group.name = "sankofa-mid-roof";
  parent.add(group);
  const field = [];
  let z0 = Infinity;
  let z1 = -Infinity;
  let x0 = Infinity;
  let x1 = -Infinity;
  for (const [x, z] of verts) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x);
    z0 = Math.min(z0, z); z1 = Math.max(z1, z);
  }
  for (let z = z0; z < z1; z += 1.5) {
    const zc = z + Math.min(1.5, z1 - z) / 2;
    for (const [a, b] of spansAt(verts, zc)) {
      if (b - a < 0.4) continue;
      field.push({ x: (a + b) / 2, y: roofY + 0.02, z: zc, scale: [b - a, 1, Math.min(1.5, z1 - z)] });
    }
  }
  const mesh = instanced(quad(1, 1), decal(colors.roofMembrane, PAD, "roofMembrane", [0.75, 0.75]),
    field, (it) => it);
  mesh.renderOrder = OVERLAY[PAD].renderOrder;
  group.add(mesh);
  counts.midRoofStrips = field.length;

  const unit = new THREE.BoxGeometry(1, 1, 1);
  const boxes = [];
  /* The stair/plant box's position is a FRACTION of the Mid's own drawn
     bounding box — which is what "toward the west third" means once it is a
     number instead of a sentence. */
  const bx = x0 + M.box.xFrac * (x1 - x0);
  const bz = z0 + M.box.zFrac * (z1 - z0);
  if (inRing(bx, bz, verts)) {
    boxes.push({ x: bx, y: roofY + M.box.size[1] / 2, z: bz, scale: M.box.size });
  }
  /* The small units are a SEEDED SCATTER, not three typed positions: phf15
     gives a COUNT and no frame gives a location. The first `count` candidates
     that land inside the drawn ring are kept. */
  const U = M.units;
  const units = [];
  for (let i = 0; i < U.candidates && units.length < U.count; i++) {
    const x = x0 + hash(section.seed, i, 11) * (x1 - x0);
    const z = z0 + hash(section.seed, i, 12) * (z1 - z0);
    if (!inRing(x, z, verts)) continue;
    units.push({ x, y: roofY + U.size[1] / 2, z, scale: U.size });
  }
  group.add(instanced(unit, panelMat(section.colors.panelSunlit), [...boxes, ...units], (it) => it));
  counts.midRoofUnits = boxes.length + units.length;
  counts.midRoofScattered = units.length;
  counts.midRoofPv = M.pv.panels;
}

/** The plinth roof: dark membrane with a light edge band, laid as strips
    CLIPPED against the tower and the Mid so it exists only where the plinth
    actually has a roof — ~840 m² of the 2508.6 m² plate. */
function buildPlinthRoof(section, parent, baseVerts, blockers, roofY, counts) {
  const P = section.plinth.roof;
  const { colors } = section;
  const group = new THREE.Group();
  group.name = "sankofa-plinth-roof";
  parent.add(group);
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const [, z] of baseVerts) { z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const strips = [];
  for (let z = z0; z < z1; z += P.strip) {
    const d = Math.min(P.strip, z1 - z);
    const zc = z + d / 2;
    const spans = subtractSpans(spansAt(baseVerts, zc), blockers.flatMap((r) => spansAt(r, zc)));
    for (const [a, b] of spans) {
      strips.push({ x: (a + b) / 2, y: roofY + 0.02, z: zc, scale: [b - a, 1, d] });
    }
  }
  const mesh = instanced(quad(1, 1), decal(colors.plinthRoof, PAD, "roofMembrane", [1, 1]),
    strips, (it) => it);
  mesh.renderOrder = OVERLAY[PAD].renderOrder;
  group.add(mesh);
  counts.plinthRoofStrips = strips.length;

  /* The light edge band, dropped wherever the plinth's own edge is buried. */
  const bands = [];
  for (let i = 0; i < baseVerts.length; i++) {
    const j = (i + 1) % baseVerts.length;
    const frame = frameOf(baseVerts[i], baseVerts[j], outwardOf(baseVerts, i, j));
    for (const [a, b] of exposedRuns(frame, blockers, 1.0, 0.4)) {
      const uc = (a + b) / 2;
      bands.push({
        ...frame.at(uc, -P.edgeInset - P.edgeBand / 2, roofY + 0.06), rot: frame.rot,
        scale: [b - a, 1, P.edgeBand],
      });
    }
  }
  const bandMesh = instanced(quad(1, 1), decal(colors.plinthRoofEdge, CARPET), bands, (it) => it);
  bandMesh.renderOrder = OVERLAY[CARPET].renderOrder;
  group.add(bandMesh);
  counts.plinthEdgeBands = bands.length;

  /* The small units are a SEEDED SCATTER over the plinth's own drawn ring,
     clipped against the tower and the Mid so a unit can only land on roof that
     survives the subtraction. phf15 resolves a COUNT; it resolves no position,
     and an earlier draft typed three at round metres. */
  const U = P.units;
  let x0 = Infinity;
  let x1 = -Infinity;
  for (const [x] of baseVerts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
  const units = [];
  for (let i = 0; i < U.candidates && units.length < U.count; i++) {
    const x = x0 + hash(section.seed, i, 21) * (x1 - x0);
    const z = z0 + hash(section.seed, i, 22) * (z1 - z0);
    if (!inRing(x, z, baseVerts)) continue;
    if (blockers.some((r) => inRing(x, z, r))) continue;
    units.push({ x, y: roofY + U.size[1] / 2, z, scale: U.size });
  }
  group.add(instanced(new THREE.BoxGeometry(1, 1, 1), painted(colors.mechanicalGrey), units, (it) => it));
  counts.plinthRoofUnits = units.length;
}

/* ------------------------------------------------------------- the plinth */

function collectPlinthFace(section, f, frame, ctx, bins) {
  const PL = section.plinth;
  const roofY = ctx.mass.base.roofY;
  const runs = exposedRuns(frame, ctx.blockers);
  const gmin = groundMinAlong(frame, ctx.ground) - 0.6;
  bins.counts.plinthRuns += runs.length;

  for (const [a, b] of runs) {
    const w = b - a;
    const uc = (a + b) / 2;
    if (f.system === "storefront" || f.system === "brickGlazed" || f.system === "amazon") {
      /* Full-height glazed shopfront with dark mullions and a spandrel louvre
         band above; brick below the glazed run's own datum where the tenancy
         does not reach. */
      const S = PL.storefront;
      /* The Amazon frontage is the FRACTION the Open House plan gives — half
         the edge — times the surveyed edge, not a typed 14 m. */
      const glazed = f.system === "amazon"
        ? Math.min(w, PL.amazon.frontageFrac * frame.length)
        : w;
      const gc = f.system === "amazon" ? a + glazed / 2 : uc;
      bins.storefrontGlass.push({
        ...frame.at(gc, S.glassInset, roofY - S.spandrel - S.height / 2), rot: frame.rot,
        scale: [glazed - 0.2, S.height - 0.2, 1],
      });
      const M = frame.length / Math.max(1, f.bays);
      for (const bay of bayCentres(frame.length, M)) {
        if (bay.u < gc - glazed / 2 || bay.u > gc + glazed / 2) continue;
        /* And the mullion itself must stand on EXPOSED plinth: on the
           north-east end 74% of the edge is under the tower, and a mullion
           placed half a bay back from an exposed bay centre can land inside
           it. */
        if (!inRuns(bay.u - M / 2, runs)) continue;
        bins.mullions.push({
          ...frame.at(bay.u - M / 2, S.mullionDepth / 2, roofY - S.spandrel - S.height / 2), rot: frame.rot,
          scale: [S.mullion, S.height, S.mullionDepth],
        });
        bins.counts.storefrontBays++;
      }
      bins.spandrels.push({
        ...frame.at(gc, 0.1, roofY - S.spandrel / 2), rot: frame.rot,
        scale: [glazed, S.spandrel, 0.14],
      });
      if (glazed < w - 0.4) {
        const bw = w - glazed;
        bins.brickWalls.push({
          w: bw, h: roofY - gmin,
          ...frame.at(f.system === "amazon" ? a + glazed + bw / 2 : uc, 0.05, (roofY + gmin) / 2),
          rot: frame.rot,
        });
      }
      /* The plinth still needs a wall below the shopfront datum. */
      bins.brickWalls.push({
        w, h: roofY - S.spandrel - S.height - gmin,
        ...frame.at(uc, 0.03, (roofY - S.spandrel - S.height + gmin) / 2),
        rot: frame.rot,
      });
    } else if (f.system === "colonnade") {
      /* The undercroft: rectangular concrete columns on the plinth edge with a
         recessed glazed wall set back behind them, and bike racks under it. */
      const C = PL.colonnade;
      const M = frame.length / Math.max(1, f.bays);
      for (const bay of bayCentres(frame.length, M)) {
        if (!inRuns(bay.u, runs)) continue;
        const p = frame.at(bay.u, -C.columnSize / 2 - 0.05, 0);
        const g = ctx.ground(p.x, p.z);
        if (!Number.isFinite(g)) continue;
        bins.columns.push({
          x: p.x, y: (g + roofY) / 2, z: p.z, rot: frame.rot,
          scale: [C.columnSize, roofY - g, C.columnSize],
        });
        bins.counts.colonnadeColumns++;
      }
      bins.recessBacks.push({
        ...frame.at(uc, -C.recess, (roofY + gmin) / 2), rot: frame.rot,
        scale: [w, roofY - gmin, 1],
      });
      bins.groundGlass.push({
        ...frame.at(uc, -C.recess + C.glassInset, (roofY + gmin) / 2 + 0.2), rot: frame.rot,
        scale: [w - 0.6, Math.max(0.6, roofY - gmin - 1.2), 1],
      });
      /* Soffit: the dark underside every night frame shows lit. */
      bins.soffits.push({
        ...frame.at(uc, -C.recess / 2, roofY - 0.12), rot: frame.rot,
        scale: [w, 0.24, C.recess],
      });
    } else {
      /* base-north-ramble is the one plinth face SWA Learning-9 photographs
         square-on in direct midday sun, so it is the one face that takes the
         sampled brickSunlit; every other brick face takes the derived
         brickBody, which is that sample with the direct-sun lift removed. */
      bins.brickWalls.push({
        w, h: roofY - gmin, tone: f.sunlit ? "brickSunlit" : "brickBody",
        ...frame.at(uc, 0.05, (roofY + gmin) / 2), rot: frame.rot,
      });
      bins.counts.brickWalls++;
    }

    /* The broad flat cantilevered canopy: fascia band, flat top plane, dark
       soffit with recessed downlights. The strongest horizontal in every
       eye-level photograph of this building. */
    if (f.canopy) {
      const K = PL.canopy;
      const under = roofY - (ctx.mass.base.h - K.underside);
      bins.canopyTops.push({
        ...frame.at(uc, K.projection / 2, under + K.fascia - K.topPlate / 2), rot: frame.rot,
        scale: [w, K.topPlate, K.projection],
      });
      bins.canopySoffits.push({
        ...frame.at(uc, K.projection / 2, under + K.topPlate / 2), rot: frame.rot,
        scale: [w, K.topPlate, K.projection],
      });
      bins.canopyFascias.push({
        ...frame.at(uc, K.projection - K.fasciaEdge / 2, under + K.fascia / 2), rot: frame.rot,
        scale: [w, K.fascia, K.fasciaEdge],
      });
      for (let u = a + K.downlight.spacing / 2; u < b; u += K.downlight.spacing) {
        bins.canopyLights.push({
          ...frame.at(u, K.projection * 0.55, under - K.downlight.diameter / 4), rot: frame.rot,
        });
      }
      bins.counts.canopyRuns++;
    }
    /* THE PLAZA TERRACE GUARDRAIL IS NOT BUILT. phf19 shows it and it is real,
       but what carries it is the plaza's level change, not this building, and
       no frame resolves how far that step lies from the plinth wall. An
       earlier draft stood it at an invented 1.20 m standoff with no source of
       any kind. Declared absent — see the section's conflicts[6]. */
  }

  /* Bike racks under the colonnade: one run of standard inverted-U staple
     hoops, built as TWO LEGS plus a semicircular top so the hoop is its full
     sourced 0.914 m tall. An earlier draft drew a bare half-torus of radius
     width/2, which stood 0.305 m — less than half a real rack. */
  if (f.system === "colonnade" && runs.length) {
    const B = PL.bikeRacks;
    const C = PL.colonnade;
    const [a, b] = runs[0];
    const start = a + (b - a) * 0.25;
    const legH = B.height - B.width / 2;
    for (let hI = 0; hI < B.hoops; hI++) {
      const u = start + hI * B.spacing;
      if (!inRuns(u, runs)) continue;
      const p = frame.at(u, -C.recess * 0.5, 0);
      const g = ctx.ground(p.x, p.z);
      if (!Number.isFinite(g)) continue;
      bins.bikeHoops.push({ x: p.x, y: g + legH, z: p.z, rot: frame.rot });
      for (const du of [-B.width / 2, B.width / 2]) {
        const q = frame.at(u + du, -C.recess * 0.5, 0);
        bins.bikeLegs.push({ x: q.x, y: g + legH / 2, z: q.z, rot: frame.rot, scale: [1, legH, 1] });
      }
    }
  }
}

/**
 * The canopy's corner GUSSET. SWA Learning-9 resolves a triangular plate where
 * the canopy turns a corner; the section declares its leg and, until this
 * existed, declared it into thin air. Exactly one corner in the drawn ring has
 * a canopy run arriving and a canopy run leaving — base vertex 9, where the
 * south-east storefront meets the north-east Amazon end — and that is where
 * the plate goes: a triangle filling the quadrant the two canopy rectangles
 * leave open outside the corner, at the full depth of the fascia.
 */
function buildCanopyGusset(section, group, baseVerts, roofY, counts) {
  const K = section.plinth.canopy;
  const runs = section.facades.filter((f) => f.mass === "base" && f.canopy);
  const under = roofY - (section.measured.masses.base.h - K.underside);
  let built = 0;
  for (const f1 of runs) {
    const f2 = runs.find((x) => x.i === f1.j);
    if (!f2) continue;
    const v = baseVerts[f1.j];
    const n1 = outwardOf(baseVerts, f1.i, f1.j);
    const n2 = outwardOf(baseVerts, f2.i, f2.j);
    const L = K.gussetLength;
    /* Drawn about the corner as the LOCAL origin, so the mesh's own transform
       carries it — a geometry that hides its position in its vertices reads as
       (0, 0, 0) to every envelope and corridor gate in this repo.
       The shape's local (x, y) becomes world (x, -z) after rotateX(-90°), and
       the extrusion runs up in +y. */
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(n1[0] * L, -n1[1] * L);
    shape.lineTo(n2[0] * L, -n2[1] * L);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: K.fascia, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, painted(section.colors.canopyFascia));
    mesh.position.set(v[0], under, v[1]);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
    built++;
  }
  counts.canopyGussets = built;
}

/* ------------------------------------------------------- the Front Porch */

/**
 * The Front Porch: a large raised wood deck west of Sankofa Mid, named on the
 * 2025 Open House built-condition plan and absent from campus-arcgis.json
 * entirely — so it is CREATED here as new ground geometry, seated on the drawn
 * surface, with its kerb carried down to the lowest surface under the rect so
 * no ground passes beneath it.
 */
function buildFrontPorch(section, group, ground, counts) {
  const F = section.frontPorch;
  const { colors } = section;
  const r = F.rect;
  const w = r.x1 - r.x0;
  const d = r.z1 - r.z0;
  const cx = (r.x0 + r.x1) / 2;
  const cz = (r.z0 + r.z1) / 2;
  const gs = [];
  let gmin = Infinity;
  for (let i = 0; i <= 6; i++) {
    for (let j = 0; j <= 6; j++) {
      const g = ground(r.x0 + (w * i) / 6, r.z0 + (d * j) / 6);
      if (!Number.isFinite(g)) continue;
      gs.push(g);
      gmin = Math.min(gmin, g);
    }
  }
  gs.sort((a, b) => a - b);
  const gm = gs.length ? gs[Math.floor(gs.length / 2)] : 0;
  if (!Number.isFinite(gmin)) gmin = gm;
  const deckY = gm + F.lift;

  /* A deck is FLAT: the platform is one level, and its kerb reaches the lowest
     drawn surface under the rect rather than hovering over a dip. */
  const deck = new THREE.Mesh(quad(w, d),
    decal(colors.deckWood, CARPET, "woodSlat", [w / 1.4, d / 1.4]));
  /* The deck is a flat-on-its-carrier decal, so it rides the overlay ladder's
     carpet rung like every other one in this repo — the depth state comes from
     applyOverlayDepth, the draw order from OVERLAY, and the LIFT from
     overlayLift. Placing it at a raw deckY left the ladder half-applied. */
  deck.position.set(cx, deckY + overlayLift(CARPET), cz);
  deck.renderOrder = OVERLAY[CARPET].renderOrder;
  group.add(deck);

  const kerbs = [
    { x: cx, z: r.z0 + F.kerb / 2, s: [w, deckY - gmin, F.kerb] },
    { x: cx, z: r.z1 - F.kerb / 2, s: [w, deckY - gmin, F.kerb] },
    { x: r.x0 + F.kerb / 2, z: cz, s: [F.kerb, deckY - gmin, d] },
    { x: r.x1 - F.kerb / 2, z: cz, s: [F.kerb, deckY - gmin, d] },
  ];
  group.add(instanced(new THREE.BoxGeometry(1, 1, 1), boardformed(colors.columnConcrete),
    kerbs, (k) => ({ x: k.x, y: (deckY + gmin) / 2, z: k.z, scale: k.s })));

  /* The flight, on the edge the section names. Five 6 in risers, which is what
     the CBC-limited 0.762 m lift divides into exactly. */
  const S = F.steps;
  const treads = [];
  for (let i = 0; i < S.count; i++) {
    const y = deckY - (i + 1) * S.rise;
    const off = (i + 0.5) * S.going;
    const p = S.edge === "west" ? { x: r.x0 - off, z: cz, sx: S.going, sz: S.width }
      : S.edge === "east" ? { x: r.x1 + off, z: cz, sx: S.going, sz: S.width }
      : S.edge === "north" ? { x: cx, z: r.z0 - off, sx: S.width, sz: S.going }
      : { x: cx, z: r.z1 + off, sx: S.width, sz: S.going };
    treads.push({ x: p.x, z: p.z, y: y + S.rise / 2, scale: [p.sx, S.rise, p.sz] });
  }
  group.add(instanced(new THREE.BoxGeometry(1, 1, 1), concrete(colors.columnConcrete),
    treads, (it) => it));

  /* The 1:12 ramp, on the edge the section names — which is the SOUTH edge, and
     is not the west edge the round-one build put it on. Two things follow from
     getting that right: the run no longer reaches 1.49 m outside this
     section's own envelope, and its high end no longer stands proud of the
     deck. The box's LENGTH is on local Z, which is the axis rotX tilts (the
     keeling PV-panel convention), and the centre is dropped by the slab's own
     half-thickness so the ramp's TOP face — not its mid-plane — arrives at the
     deck. */
  const R = F.ramp;
  const rise = deckY - gmin;
  const tilt = Math.asin(Math.min(0.99, rise / R.run));
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(R.width, R.thickness, R.run),
    concrete(colors.columnConcrete));
  const yaw = R.edge === "north" || R.edge === "south" ? 0 : Math.PI / 2;
  /* Under the YXZ order the box's local +Z end rises when rotX is negative.
     The DECK end is the +Z end on the north and west edges and the -Z end on
     the south and east ones, so the sign follows the declared edge. */
  ramp.rotation.set(R.edge === "north" || R.edge === "west" ? -tilt : tilt, yaw, 0, "YXZ");
  const cy = (deckY + gmin) / 2 - (R.thickness / 2) * Math.cos(tilt);
  const seat = R.edge === "west" ? { x: r.x0 - R.run / 2, z: cz }
    : R.edge === "east" ? { x: r.x1 + R.run / 2, z: cz }
    : R.edge === "north" ? { x: cx, z: r.z0 - R.run / 2 }
    : { x: cx, z: r.z1 + R.run / 2 };
  ramp.position.set(seat.x, cy, seat.z);
  ramp.castShadow = ramp.receiveShadow = true;
  group.add(ramp);

  counts.porchSteps = treads.length;
  counts.porchRamps = 1;
  counts.porchDeckY = Math.round(deckY * 1000) / 1000;
  /* The top of the ramp's own high end, so the test can assert it meets the
     deck plane instead of standing above it. */
  counts.porchRampTopY = Math.round((cy + (R.run / 2) * Math.sin(tilt)
    + (R.thickness / 2) * Math.cos(tilt)) * 1000) / 1000;
}

/* ------------------------------------------------------------------- api */

/**
 * Build Sankofa Hall's photo-sourced detail.
 *
 * `photo` is the loaded photo-detail document; this reads only its `sankofa`
 * section, writes nothing back, and returns `{ group, counts }` (empty and
 * harmless if the section is missing, so a half-wired boot still runs).
 * `surfaceAt` — the height of the DRAWN terrain triangle — seats everything
 * that stands on the ground. `heightAt` solves the drawn lid of each mass
 * exactly as campus-massing.js roofElevation does, because that is what put
 * the measured masses there and the two must not diverge.
 */
export function createPhotoSankofa(scene, { photo, heightAt, surfaceAt } = {}) {
  const group = new THREE.Group();
  group.name = "photo-sankofa";
  const section = photo?.sankofa;
  if (!section) {
    scene?.add(group);
    return { group, counts: {} };
  }
  const ground = surfaceAt || heightAt;
  const base = heightAt || surfaceAt;
  if (typeof ground !== "function" || typeof base !== "function") {
    throw new Error("campus-photo-sankofa: needs surfaceAt (or heightAt) to place on the ground");
  }

  /* The drawn lid of each mass, by the massing's own rule over the DRAWN ring.
     The storey grid is that prism read back — h / levels — so the counted
     bands fill the drawn box with zero residual and the sourced 3.2004 m
     floor-to-floor is never extruded. */
  const mass = {};
  const verts = {};
  for (const [key, m] of Object.entries(section.measured.masses)) {
    verts[key] = vertsOf(m.ring);
    const roofY = roofElevationOf(m.ring, m.h, base);
    mass[key] = {
      h: m.h, levels: m.levels, roofY,
      baseY: roofY - m.h,
      storeyH: m.h / m.levels,
    };
  }

  const ctx = {
    mass, ground, base,
    blockers: [verts.tower, verts.mid],
    ringOf: (key) => verts[key],
    faceBottom: (f) =>
      f.startsAt === "plinthRoof" ? mass.base.roofY
        : f.startsAt === "midRoof" ? mass.mid.roofY
        : -Infinity,
  };

  const bins = {
    panels: [], reveals: [], fins: [], finReturns: [], finCaps: [],
    surrounds: [], glass: [], vents: [], skirts: [],
    recessBacks: [], loggiaSlabs: [], railPosts: [], railBars: [], downlights: [],
    curtainMullions: [], groundGlass: [], parapets: [], copings: [],
    brickWalls: [], storefrontGlass: [], mullions: [], spandrels: [],
    columns: [], soffits: [], bikeHoops: [], bikeLegs: [],
    canopyTops: [], canopySoffits: [], canopyFascias: [], canopyLights: [],
    counts: {
      plinthRuns: 0, storefrontBays: 0, brickWalls: 0,
      colonnadeColumns: 0, canopyRuns: 0, deepestSkirt: 0, finsBuried: 0,
    },
  };

  for (const f of section.facades) {
    if (f.system === "shared") continue;
    const v = verts[f.mass];
    const frame = frameOf(v[f.i], v[f.j], outwardOf(v, f.i, f.j));
    if (f.mass === "base") collectPlinthFace(section, f, frame, ctx, bins);
    else if (f.system === "loggia" || f.system === "loggiaReturn") {
      collectLoggia(section, f, frame, ctx, bins);
    } else collectMembrane(section, f, frame, ctx, bins);
  }

  /* The parapet on the tower and the Mid. The tower's north-east end and its
     notch cheeks step DOWN and take the pipe guardrail instead — the loggia
     stack is what forces it, and it is the crown's asymmetric silhouette. */
  collectParapet(section, verts.tower, mass.tower.roofY, new Set([2, 3, 4]), bins);
  /* The Mid's SHARED party-wall edge takes no parapet and no coping either —
     the index is read off the section's own `shared` facade record, not typed
     here, so the two cannot drift apart. */
  const sharedMid = new Set(section.facades
    .filter((f) => f.system === "shared" && f.mass === "mid")
    .map((f) => f.i));
  collectParapet(section, verts.mid, mass.mid.roofY, new Set(), bins, sharedMid);

  const { colors } = section;
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const plane = new THREE.PlaneGeometry(1, 1);
  const add = (geo, mat, items) => {
    if (!items.length) return;
    group.add(instanced(geo, mat, items, (it) => it));
  };

  add(plane, panelMat(colors.loggiaSoffit), bins.recessBacks);
  for (const tone of ["panelSunlit", "panelBody"]) {
    add(unit, panelMat(colors[tone]), bins.panels.filter((p) => p.tone === tone));
    add(unit, panelMat(colors[tone]), bins.skirts.filter((p) => p.tone === tone));
  }
  add(unit, panelMat(colors.loggiaSoffit), bins.skirts.filter((p) => p.tone === "loggiaSoffit"));
  add(unit, panelMat(colors.panelReveal), bins.reveals);
  add(unit, finMat(colors.panelBright), bins.fins);
  for (const tone of section.facadeSystem.fin.warmPalette) {
    add(unit, finMat(colors[tone]), bins.finReturns.filter((p) => p.tone === tone));
  }
  add(unit, finMat(colors.panelBright), bins.finCaps);
  add(unit, panelMat(colors.surroundCharcoal), bins.surrounds);
  for (const tint of new Set(bins.glass.map((g) => g.tint))) {
    add(plane, glassMat(colors[tint]), bins.glass.filter((g) => g.tint === tint));
  }
  add(unit, painted(colors.surroundCharcoalDeep), bins.vents);
  add(unit, concrete(colors.slabEdgeWhite), bins.loggiaSlabs);
  add(unit, painted(colors.railGalv), bins.railPosts);
  add(unit, painted(colors.railGalv), bins.railBars);
  add(unit, painted(colors.storefrontMullion), bins.curtainMullions);
  add(new THREE.CylinderGeometry(section.loggia.downlight.diameter / 2, section.loggia.downlight.diameter / 2,
    section.loggia.downlight.depth, 10),
    lens(colors.downlightWarm, section.loggia.downlight.emissive), bins.downlights);
  add(plane, glassMat(colors.glassShade), bins.groundGlass);
  add(unit, panelMat(colors.panelBody), bins.parapets);
  add(unit, painted(colors.surroundCharcoalDeep), bins.copings);
  add(plane, glassMat(colors.glassSky), bins.storefrontGlass);
  add(unit, painted(colors.storefrontMullion), bins.mullions);
  add(unit, painted(colors.spandrelLouvre), bins.spandrels);
  add(unit, concrete(colors.columnConcrete), bins.columns);
  add(unit, painted(colors.canopySoffit), bins.soffits);
  add(unit, painted(colors.canopyFascia), bins.canopyTops);
  add(unit, painted(colors.canopySoffit), bins.canopySoffits);
  add(unit, painted(colors.canopyFascia), bins.canopyFascias);
  add(new THREE.CylinderGeometry(section.plinth.canopy.downlight.diameter / 2,
    section.plinth.canopy.downlight.diameter / 2, 0.06, 10),
    lens(colors.downlightWarm, 0.25), bins.canopyLights);
  /* A standard inverted-U staple rack: a semicircular top of radius width/2
     carried on two full-length legs, so the hoop stands its sourced 0.914 m
     rather than the 0.305 m a bare half-torus gives. */
  const BR = section.plinth.bikeRacks;
  add(new THREE.TorusGeometry(BR.width / 2, BR.bar / 2, 6, 12, Math.PI),
    painted(colors.railGalv), bins.bikeHoops);
  add(new THREE.CylinderGeometry(BR.bar / 2, BR.bar / 2, 1, 8),
    painted(colors.railGalv), bins.bikeLegs);

  /* The brick walls are individual meshes so each carries the running bond at
     its own true scale — the per-surface repeat lever. */
  const B = section.plinth.brick;
  for (const w of bins.brickWalls) {
    if (w.h <= 0.1 || w.w <= 0.1) continue;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w.w, w.h),
      brickMat(colors[w.tone || "brickBody"], w.w, w.h, B));
    mesh.position.set(w.x, w.y, w.z);
    mesh.rotation.y = w.rot;
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }

  const counts = { ...bins.counts };
  buildCanopyGusset(section, group, verts.base, mass.base.roofY, counts);
  buildTowerRoof(section, group, verts.tower, mass.tower.roofY, counts);
  buildMidRoof(section, group, verts.mid, mass.mid.roofY, counts);
  buildPlinthRoof(section, group, verts.base, ctx.blockers, mass.base.roofY, counts);

  const gr = new THREE.Group();
  gr.name = "sankofa-ground";
  buildFrontPorch(section, gr, ground, counts);
  group.add(gr);

  scene?.add(group);
  return {
    group,
    counts: {
      ...counts,
      facades: section.facades.length,
      membranePanels: bins.panels.length,
      panelReveals: bins.reveals.length,
      fins: bins.fins.length,
      finReturns: bins.finReturns.length,
      windows: bins.surrounds.length,
      ventBands: bins.vents.length,
      skirts: bins.skirts.length,
      loggias: section.loggia.count,
      loggiaSlabs: bins.loggiaSlabs.length,
      loggiaDownlights: bins.downlights.length,
      parapetSegments: bins.parapets.length,
      copings: bins.copings.length,
      railPosts: bins.railPosts.length,
      brickWallMeshes: bins.brickWalls.filter((w) => w.h > 0.1 && w.w > 0.1).length,
      canopyLights: bins.canopyLights.length,
      bikeHoops: bins.bikeHoops.length,
      bikeLegs: bins.bikeLegs.length,
      curtainMullions: bins.curtainMullions.length,
      wordmarkBuilt: section.signage.built ? 1 : 0,
      draws: group.children.length,
    },
  };
}
