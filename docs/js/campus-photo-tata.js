// Tata Hall for the Sciences — from documents, drawings and photographs: the
// INVENTED class, R5 batch. Called the Biological and Physical Sciences
// Building in every planning document.
//
// Five facts shaped this file, and each is a place a plausible build goes
// wrong:
//
//   1. THERE IS NO LiDAR HERE AND THE HEIGHT IS STILL SOLVED. The 2014 flight
//      passed over the grassy Urey Green quad this building replaced in
//      2016-18, so campus-lidar.json carries neither massHeights['m:-55,171']
//      nor heights['Tata Hall'] — correctly. The height comes from a
//      regulatory statement (Coastal Commission 6-16-0252: 100 ft) closed
//      against two drawn spot elevations, and NOTHING in this file cites the
//      laser for a height. The one thing the flight contributes is the GROUND
//      it flew over, and that is the datum the extrusion is measured from.
//
//   2. THE EXTRUSION IS SHIPPED, NOT THE ABSOLUTE TOP. The documents put the
//      parapet at renderer y 48.293. The terrain under this building is the
//      PRE-CONSTRUCTION surface — the project cut 5,727 cu yd — so seating to
//      a fixed absolute would silently absorb a future terrain correction.
//      The shell is seated the way campus-massing.js seats a mass and lifted
//      by the section's own extrusion, so a terrain change MOVES the building
//      visibly. The residual between the two is gated, not hidden.
//
//   3. LEVEL 1 IS BURIED, AND THAT IS TRUE. The drawn 2014 ground runs 19.9 to
//      22.4 across this band; the derived Level 1 floor is at 17.68. The whole
//      first storey is under the terrain. It is still built, because deleting
//      it would claim a five-storey building, and it is not lifted, because
//      lifting it would break the sourced height chain to hide a terrain
//      error that belongs to the measured layer.
//
//   4. THE FIN IS A GRATING, NOT A BLADE. Eight vertical bearing bars at
//      1-3/16 in centres across a 9-11/16 in comb. It is see-through, and a
//      solid plate would read as a louvre wall at every distance. So the bars
//      are drawn — all 5,568 of them, in one instanced draw.
//
//   5. NO DIMENSION AND NO COLOUR LIVES IN THIS FILE. Every metre comes from
//      the section's `derivations.figures`, `estimates`, `reads` or `draw`
//      blocks, and every hex goes through a guard that throws on an undeclared
//      role, because campus-materials.js silently ships opaque WHITE for a
//      missing colour. Provenance is in the mesh names (-sourced /
//      -estimated) or it is not in the scene at all.
//
// Surfaces come from the procedural material library (campus-materials.js);
// deterministic throughout — no clock, no randomness, no loaded texture.
import * as THREE from "../vendor/three/three.module.min.js";
import { applyOverlayDepth, OVERLAY, overlayLift } from "./campus-overlay.js";
import { sharedMaterialLibrary } from "./campus-materials.js";

let LIB = null;
const lib = () => (LIB ??= sharedMaterialLibrary(THREE));

const cast = (color, repeat) => lib().get("smoothConcrete", { color, repeat });
const membrane = (color, repeat) => lib().get("roofMembrane", { color, repeat });
const glassOf = (color) => lib().get("glass", { color });
const metal = (color) => lib().get("metalPanel", { color, metalness: 0.65, roughness: 0.4 });
const foliage = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0.0 });

const decal = (color, rung, cls, repeat) =>
  applyOverlayDepth(lib().get(cls, { color, repeat }), rung);

/** Deterministic 0..1 from any integer mix — a reload rebuilds the same site. */
function hash(...ns) {
  let s = 0;
  for (let i = 0; i < ns.length; i++) s = s * 131.71 + ns[i] * 57.13 + 7.9;
  const v = Math.sin(s) * 43758.5453;
  return v - Math.floor(v);
}

/** One InstancedMesh from a list of placements. */
function instanced(geo, mat, items, name) {
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
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (name) mesh.name = name;
  return mesh;
}

/** A flat XZ quad lying in the ground plane. */
function quad(w, d) {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  return g;
}

/** Even-odd point-in-ring. */
function inRing(x, z, r) {
  let ins = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, zi] = r[i];
    const [xj, zj] = r[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
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
 * Every non-degenerate edge of the surveyed ring, in ring order, each with its
 * own frame: `at(u, w, y)` is u metres along the edge from vertex a, w metres
 * proud of it along the OUTWARD normal, y in world height. The outward
 * direction is fixed by the ring's winding and never by a guess about which
 * way is out.
 */
function ringEdges(ring) {
  const ccw = ringCcw(ring);
  const out = [];
  for (let k = 0; k < ring.length - 1; k++) {
    const [ax, az] = ring[k];
    const [bx, bz] = ring[k + 1];
    const length = Math.hypot(bx - ax, bz - az);
    if (!(length > 0)) continue;
    const s = ccw ? 1 : -1;
    const nx = (s * (bz - az)) / length;
    const nz = (-s * (bx - ax)) / length;
    const tx = (bx - ax) / length;
    const tz = (bz - az) / length;
    out.push({
      k, a: [ax, az], b: [bx, bz], length, nx, nz, tx, tz,
      rot: Math.atan2(nx, nz),
      at: (u, w, y) => ({ x: ax + tx * u + nx * w, y, z: az + tz * u + nz * w }),
    });
  }
  return out;
}

/** The lowest and highest drawn surface under an edge, sampled along it. */
function gradesUnder(edge, ground, samples) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i <= samples; i++) {
    const p = edge.at((i * edge.length) / samples, 0, 0);
    const g = ground(p.x, p.z);
    if (!Number.isFinite(g)) {
      throw new Error(`campus-photo-tata: surfaceAt returned ${g} on the surveyed ring at (${p.x}, ${p.z})`);
    }
    if (g < lo) lo = g;
    if (g > hi) hi = g;
  }
  return [lo, hi];
}

/**
 * The watertight shell: the surveyed ring extruded from `bottom` to `top` as
 * ONE solid, so no corner of a 27-edge survey ring can open a wedge of
 * daylight through the building. Shape coordinates are (x, -z) so that the
 * -90 deg rotation about X lands them at (x, y, z) with y running up.
 */
function shellGeometry(ring, bottom, top) {
  /* The survey ring closes on its own first vertex and carries one degenerate
     repeat; both would hand the triangulator a zero-length segment. */
  const pts = [];
  for (const [x, z] of ring) {
    const last = pts[pts.length - 1];
    if (last && Math.hypot(last[0] - x, last[1] - z) < 1e-9) continue;
    pts.push([x, z]);
  }
  if (pts.length > 1 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1e-9) {
    pts.pop();
  }
  const shape = new THREE.Shape();
  pts.forEach(([x, z], i) => (i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)));
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: top - bottom, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, bottom, 0);
  return geo;
}

/* ------------------------------------------------------------- the facade */

/* One storey of one surveyed edge: the exposed concrete spandrel band at the
   floor line, the glazing band above it, and — on the finned face sets — the
   aluminium fins standing in front of the glass. The spandrel band and the fin
   fill the storey EXACTLY, because the fin's published height and the derived
   floor-to-floor are what the spandrel's exposure is the difference of. */
function collectFace(ctx, set, edge, bins) {
  const { S, D, level1Y, storeys } = ctx;
  const F = ctx.G.floorToFloor;
  const exposed = S.spandrel.exposed;
  const glassW = D.wallOffset + D.glassOffset;

  for (let s = 0; s < storeys; s++) {
    const y0 = level1Y + s * F;

    bins.spandrel.push({
      ...edge.at(edge.length / 2, D.wallOffset + S.spandrel.proud, y0 + exposed / 2),
      rot: edge.rot,
      scale: [edge.length, exposed, D.bandThickness],
    });

    bins[`glass_${set.glazing}`].push({
      ...edge.at(edge.length / 2, glassW, y0 + exposed + (F - exposed) / 2),
      rot: edge.rot,
      scale: [edge.length, F - exposed, D.bandThickness],
    });

    if (!set.finned) continue;

    /* Fin stations, centred on the edge so a run reads symmetrically and a
       short survey jog gets no fin at all rather than a squeezed one. */
    const n = Math.floor(edge.length / S.fin.spacing);
    if (n < 1) continue;
    const u0 = (edge.length - (n - 1) * S.fin.spacing) / 2;
    for (let i = 0; i < n; i++) {
      const u = u0 + i * S.fin.spacing;
      /* The comb: eight vertical bearing bars spread across the fin's own
         published width, which for a vertical shading fin is its PROJECTION
         off the glass. The daylight between the bars is what makes this a
         grating and not a plate. */
      for (let bar = 0; bar < S.fin.barCount; bar++) {
        const w = glassW + (bar + 0.5) * S.fin.barCentres;
        bins.finBars.push({
          ...edge.at(u, w, y0 + exposed + S.fin.height / 2),
          rot: edge.rot,
          scale: [S.fin.depth, S.fin.height, S.fin.barWidth],
        });
      }
    }
  }
}

/* -------------------------------------------------------------- the roof */

/* The parapet GB7 calls integral with the building and a screen for the
   rooftop equipment. Built as one run per surveyed edge plus a filler post at
   every vertex: with 27 edges and no polygon offsetting, the posts are what
   close the wedge a thickness leaves on the outside of every corner. The
   coping cap sits on top and oversails by its own declared overhang. */
function buildParapet(ctx, edges, group) {
  const { R, D, colors, roofDeckY, parapetTopY } = ctx;
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const h = parapetTopY - roofDeckY;
  const runs = [];
  const posts = [];
  const caps = [];
  const capPosts = [];
  for (const e of edges) {
    runs.push({
      ...e.at(e.length / 2, D.wallOffset, roofDeckY + h / 2),
      rot: e.rot,
      scale: [e.length, h, R.parapet.thickness],
    });
    posts.push({
      x: e.a[0] + e.nx * D.wallOffset, y: roofDeckY + h / 2, z: e.a[1] + e.nz * D.wallOffset,
      rot: e.rot,
      scale: [R.parapet.thickness, h, R.parapet.thickness],
    });
    caps.push({
      ...e.at(e.length / 2, D.wallOffset, parapetTopY - R.coping.cap / 2),
      rot: e.rot,
      scale: [e.length, R.coping.cap, R.parapet.thickness + 2 * R.coping.overhang],
    });
    capPosts.push({
      x: e.a[0] + e.nx * D.wallOffset, y: parapetTopY - R.coping.cap / 2, z: e.a[1] + e.nz * D.wallOffset,
      rot: e.rot,
      scale: [R.parapet.thickness + 2 * R.coping.overhang, R.coping.cap,
        R.parapet.thickness + 2 * R.coping.overhang],
    });
  }
  const band = cast(colors.parapet, [D.tiles.concrete, D.tiles.concrete]);
  group.add(instanced(unit, band, runs, "parapet-runs-derived"));
  group.add(instanced(unit, band, posts, "parapet-corners-derived"));
  const cap = cast(colors.parapet, [D.tiles.concrete, D.tiles.concrete]);
  group.add(instanced(unit, cap, caps, "coping-runs-estimated"));
  group.add(instanced(unit, cap, capPosts, "coping-corners-estimated"));
  return { runs: runs.length, caps: caps.length };
}

/* ------------------------------------------------------------- the ground */

/* Everything in the ground band is laid in CELLS on the campus-overlay 'pad'
   rung above the DRAWN surface, one seat per cell, so a decal follows rolling
   ground instead of hovering over it at one datum. Every extent comes from
   the section's `ground` block and every one of them is declared-approximate
   there: the elements are sourced off two photographs, the plan is not, and
   the unregistered Spurlock landscape plan is named in absent[] as the
   successor. */
function buildGround(ctx, group) {
  const { section, D, colors, ground } = ctx;
  const GD = section.ground;
  const cell = D.groundCell;
  const lift = overlayLift("pad");
  const ring = section.measured.mass.ring;
  const counts = { paved: 0, beds: 0, tufts: 0, shrubs: 0, boulders: 0, swaleCells: 0, boardwalkCells: 0 };

  /* Cells of one declared rectangle, clipped out of the building's own ring so
     nothing is ever laid under the mass. THE CELLS TILE THE RECTANGLE EXACTLY
     rather than being a fixed size stepped across it: `groundCell` sets how
     many there are, and each is the rectangle divided by that count, so a
     declared extent never grows by half a cell at its edges. On this building
     that is a scope rule and not a nicety — the south extents stop at z 192
     and the quad beyond it is a landscape this section does not claim. */
  const cellsOf = (rect) => {
    const nx = Math.max(1, Math.ceil((rect.x1 - rect.x0) / cell));
    const nz = Math.max(1, Math.ceil((rect.z1 - rect.z0) / cell));
    const w = (rect.x1 - rect.x0) / nx;
    const d = (rect.z1 - rect.z0) / nz;
    const out = [];
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const x = rect.x0 + (i + 0.5) * w;
        const z = rect.z0 + (j + 0.5) * d;
        if (inRing(x, z, ring)) continue;
        out.push({ x, y: ground(x, z) + lift, z, w, d });
      }
    }
    return out;
  };

  const lay = (cells, mat, name) => {
    if (!cells.length) return 0;
    /* One mesh per distinct cell size, because instances of one mesh share one
       geometry and the rectangles do not divide alike. */
    const bySize = new Map();
    for (const c of cells) {
      const k = `${c.w},${c.d}`;
      if (!bySize.has(k)) bySize.set(k, []);
      bySize.get(k).push(c);
    }
    let n = 0;
    for (const [k, set] of bySize) {
      const [w, d] = k.split(",").map(Number);
      const geo = quad(Math.max(w - D.decalGap, w / 2), Math.max(d - D.decalGap, d / 2));
      const mesh = instanced(geo, mat, set.map((c) => ({ ...c, scale: [1, 1, 1] })),
        bySize.size > 1 ? `${name}-${n}` : name);
      mesh.renderOrder = OVERLAY.pad.renderOrder;
      mesh.castShadow = false;
      group.add(mesh);
      n += 1;
    }
    return cells.length;
  };

  const paving = decal(colors.plazaPave, "pad", "pavingConcreteUnit", [1, 1]);
  for (const [key, name] of [["terrace", "ground-terrace-estimated"],
    ["northPlaza", "ground-north-plaza-estimated"], ["westApron", "ground-west-apron-estimated"]]) {
    counts.paved += lay(cellsOf(GD[key]), paving, name) ? 1 : 0;
  }

  counts.swaleCells = lay(cellsOf(GD.swale),
    decal(colors.cobble, "pad", "lavaRock", [1, 1]), "ground-swale-sourced");
  counts.boardwalkCells = lay(cellsOf(GD.boardwalk),
    decal(colors.boardwalk, "pad", "woodSlat", [D.tiles.plank, D.tiles.plank]), "ground-boardwalk-sourced");

  /* The planting beds: a mulch floor, then hash-scattered bunchgrass tufts,
     coastal shrubs and half-buried granite boulders at the declared densities.
     Each stands on its OWN drawn surface, so a bed on a slope follows it. */
  const mulchCells = [];
  const tufts = [];
  const shrubs = [];
  const boulders = [];
  GD.beds.forEach((bed, bi) => {
    counts.beds += 1;
    mulchCells.push(...cellsOf(bed));
    const area = (bed.x1 - bed.x0) * (bed.z1 - bed.z0);
    /* Scattered INSET by the plant's own widest reach, so a bed's declared
       extent is the extent of what is planted in it and not of its centres.
       On the south beds that is the z 192 scope line, which nothing this
       section builds may cross. */
    const place = (count, list, height, radius, salt) => {
      const reach = radius * (1 + D.scatterSpread);
      /* A bed too narrow to CONTAIN this class does not get it. The alternative
         is an object overhanging its own declared extent, and on the south
         beds that extent is the z 192 scope line against the Urey Green quad
         this section does not claim. A 1.2 m strip against the facade holds
         bunchgrass and not boulders, which is also what the frames show. */
      if (bed.x1 - bed.x0 < 2 * reach || bed.z1 - bed.z0 < 2 * reach) return;
      const x0 = bed.x0 + reach;
      const x1 = bed.x1 - reach;
      const z0 = bed.z0 + reach;
      const z1 = bed.z1 - reach;
      for (let i = 0; i < count; i++) {
        const x = x0 + (x1 - x0) * hash(salt, bi, i);
        const z = z0 + (z1 - z0) * hash(salt + 1, bi, i);
        if (inRing(x, z, ring)) continue;
        const k = 1 + (hash(salt + 2, bi, i) - 0.5) * 2 * D.scatterSpread;
        list.push({ x, z, h: height * k, r: radius * k });
      }
    };
    place(Math.round(area * GD.tuftDensity), tufts, GD.tuftHeight, GD.tuftRadius, 31);
    place(Math.round(area * GD.shrubDensity), shrubs, GD.shrubHeight, GD.shrubRadius, 41);
    place(Math.round(area * GD.boulderDensity), boulders, GD.boulderRise, GD.boulderRadius, 51);
  });
  lay(mulchCells, decal(colors.mulch, "pad", "lavaRock", [1, 1]), "ground-bed-mulch-sourced");

  const cone = new THREE.ConeGeometry(1, 1, 7);
  const dome = new THREE.SphereGeometry(1, 8, 5);
  const seat = (list, geo, mat, name, sink) => {
    if (!list.length) return 0;
    group.add(instanced(geo, mat, list.map((p) => ({
      x: p.x, y: ground(p.x, p.z) + (sink ? 0 : p.h / 2), z: p.z, scale: [p.r, p.h, p.r],
    })), name));
    return list.length;
  };
  counts.tufts = seat(tufts, cone, foliage(colors.bunchgrass), "ground-bunchgrass-estimated", false);
  counts.shrubs = seat(shrubs, cone, foliage(colors.shrubGreen), "ground-shrub-estimated", false);
  /* A boulder is HALF-BURIED — that is the sourced character — so its dome is
     seated with its equator on the drawn surface and only its rise shows. */
  counts.boulders = seat(boulders, dome, cast(colors.boulder, [D.tiles.stone, D.tiles.stone]),
    "ground-boulders-sourced", true);
  return counts;
}

/* ---------------------------------------------------------------- the api */

/**
 * Build Tata Hall's photo-, drawing- and document-sourced detail.
 *
 * `photo` is the loaded photo-detail document; this reads ONLY its `tata`
 * section and returns `{ group, counts }` (empty and harmless if the section
 * is missing). This module CARRIES THE BUILDING'S OWN SILHOUETTE, because
 * campus-massing.js would otherwise extrude the same ring to the ArcGIS
 * formula's 25.6 m — see the buildlog for the skipGis / REPLACES_MEASURED /
 * PHOTO_CARRIED wiring that must land with it. `surfaceAt` — the height of the
 * DRAWN terrain triangle — places everything that stands on the ground;
 * `heightAt` seats the shell, because that is what campus-massing.js used to
 * seat the measured mass and the two must not diverge.
 */
export function createPhotoTata(scene, { photo, heightAt, surfaceAt } = {}) {
  const group = new THREE.Group();
  group.name = "photo-tata";
  const section = photo?.tata;
  if (!section) {
    scene?.add(group);
    return { group, counts: {} };
  }
  const ground = surfaceAt || heightAt;
  const base = heightAt || surfaceAt;
  if (typeof ground !== "function" || typeof base !== "function") {
    throw new Error("campus-photo-tata: needs surfaceAt (or heightAt) to place on the ground");
  }

  /* PRE-MERGE GUARD. This builder carries the whole silhouette off a document-
     derived height chain. A section that predates the merge has none of it,
     and half a building drawn off a half-section is the silent failure this
     repo keeps failing on. Build NOTHING and say which keys are missing. */
  const missing = ["measured", "grid", "system", "roof", "ground", "draw", "estimates", "reads", "colors"]
    .filter((k) => !section[k]);
  if (section.grid && section.grid.extrusionAboveRim === undefined) missing.push("grid.extrusionAboveRim");
  if (section.system && !section.system.faceSets) missing.push("system.faceSets");
  if (section.system?.fin && section.system.fin.spacing === undefined) missing.push("system.fin.spacing");
  if (section.measured && !section.measured.mass?.ring) missing.push("measured.mass.ring");
  if (missing.length) {
    scene?.add(group);
    return { group, counts: { pendingMerge: missing.join(",") } };
  }

  const colors = section.colors;
  const hue = (role) => {
    const v = colors[role];
    if (typeof v !== "string") {
      throw new Error(`campus-photo-tata: no colour declared for role "${role}" — `
        + "an unset role silently becomes white in campus-materials.js and must never reach a material");
    }
    return v;
  };
  for (const role of ["spandrel", "finSilver", "visionGlass", "electroGlass", "openGlass",
    "parapet", "membrane", "shellBase", "plazaPave", "boulder", "bunchgrass",
    "shrubGreen", "mulch", "cobble", "boardwalk"]) hue(role);

  const ring = section.measured.mass.ring;
  const G = section.grid;
  const S = section.system;
  const R = section.roof;
  const D = section.draw;
  const edges = ringEdges(ring);

  /* THE SEAT. campus-massing.js roofElevation over the verbatim ring, with the
     section's own document-derived extrusion in place of a LiDAR height there
     is none of. Mirrored rather than imported so the module stays a one-way
     reader of the section. */
  const gs = ring.map(([x, z]) => base(x, z)).filter((v) => Number.isFinite(v)).sort((p, q) => p - q);
  if (!gs.length) throw new Error("campus-photo-tata: no finite ground under the surveyed ring");
  const median = gs[Math.floor(gs.length / 2)];
  const highest = gs[gs.length - 1];
  const parapetTopY = Math.max(median + G.extrusionAboveRim, highest);
  const roofDeckY = parapetTopY - G.parapet;
  const level1Y = parapetTopY - G.buildingHeight;

  let lowest = Infinity;
  for (const e of edges) lowest = Math.min(lowest, gradesUnder(e, ground, D.groundClipSamples)[0]);
  const shellBottom = Math.min(level1Y, lowest) - D.skirtDepth;

  const ctx = {
    section, G, S, R, D, colors, ground, base,
    storeys: G.levelsAboveGrade, level1Y, roofDeckY, parapetTopY,
  };

  /* THE SHELL, one watertight solid from below the lowest drawn ground to the
     roof deck. ExtrudeGeometry emits two material groups — the caps and the
     side skin — so the roof membrane IS the solid's own top face and follows
     the surveyed ring exactly, re-entrant corner included. The cap is ordinary
     opaque roofMembrane (the urey / natsci / pacific idiom): a 27 m roof is
     not a campus-overlay pad, and applyOverlayDepth would turn depthWrite off
     so ground decals north-west of the ring paint through it. There is nothing
     standing on that plate, because nothing sources a height for anything the
     orthophoto shows up there. */
  const shell = new THREE.Mesh(shellGeometry(ring, shellBottom, roofDeckY), [
    membrane(hue("membrane"), [1 / D.tiles.concrete, 1 / D.tiles.concrete]),
    cast(hue("shellBase"), [D.tiles.concrete, D.tiles.concrete]),
  ]);
  shell.castShadow = true;
  shell.receiveShadow = true;
  shell.name = "tata-shell-derived";
  group.add(shell);

  const facades = new THREE.Group();
  facades.name = "tata-facades";
  const bins = {
    spandrel: [], glass_vision: [], glass_electro: [], glass_open: [], finBars: [],
  };
  const byEdge = new Map(edges.map((e) => [e.k, e]));
  let covered = 0;
  for (const set of Object.values(S.faceSets)) {
    for (const k of set.edges) {
      const e = byEdge.get(k);
      if (!e) continue;
      collectFace(ctx, set, e, bins);
      covered += 1;
    }
  }
  if (covered !== edges.length) {
    throw new Error(`campus-photo-tata: the face sets cover ${covered} of ${edges.length} surveyed edges — `
      + "a face the survey draws and the section does not name would ship as bare shell");
  }

  const unit = new THREE.BoxGeometry(1, 1, 1);
  const add = (mat, items, name) => {
    if (items.length) facades.add(instanced(unit, mat, items, name));
  };
  add(cast(hue("spandrel"), [D.tiles.concrete, D.tiles.concrete]), bins.spandrel, "facade-spandrel-sourced");
  add(glassOf(hue("visionGlass")), bins.glass_vision, "facade-glass-vision-sourced");
  add(glassOf(hue("electroGlass")), bins.glass_electro, "facade-glass-electro-estimated");
  add(glassOf(hue("openGlass")), bins.glass_open, "facade-glass-open-estimated");
  add(metal(hue("finSilver")), bins.finBars, "facade-fin-bars-sourced");
  group.add(facades);

  const roof = new THREE.Group();
  roof.name = "tata-roof";
  const parapet = buildParapet(ctx, edges, roof);
  group.add(roof);

  const groundGroup = new THREE.Group();
  groundGroup.name = "tata-ground";
  const gc = buildGround(ctx, groundGroup);
  group.add(groundGroup);

  scene?.add(group);
  return {
    group,
    counts: {
      edges: edges.length,
      faceSets: Object.keys(S.faceSets).length,
      storeys: G.levelsAboveGrade,
      shells: 1,
      glazingBands: bins.glass_vision.length + bins.glass_electro.length + bins.glass_open.length,
      spandrelBands: bins.spandrel.length,
      fins: bins.finBars.length / S.fin.barCount,
      finBars: bins.finBars.length,
      parapetRuns: parapet.runs,
      copingRuns: parapet.caps,
      roofPlates: 1,
      beds: gc.beds,
      paved: gc.paved,
      tufts: gc.tufts,
      shrubs: gc.shrubs,
      boulders: gc.boulders,
      swaleCells: gc.swaleCells,
      boardwalkCells: gc.boardwalkCells,
      parapetTopY,
      roofDeckY,
      level1Y,
      shellBottom,
    },
  };
}
