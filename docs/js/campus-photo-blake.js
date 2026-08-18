// Blake Hall, from photographs — the INVENTED class.
//
// Tucker, Sadler & Bennett, 1967, for Revelle College; renovated LEED Gold and
// repainted WHITE by Vasquez Marshall. NOT a Fleet hall. Argo's sibling — the
// same family language (white precast fins, awning sashes, plain parapet band,
// recessed ground colonnade) but a DIFFERENT module, and the inventory is
// explicit that copying Argo's rhythm onto Blake is wrong. The only things
// this file takes from the survey are where Blake stands and how tall it is:
// the ring campus-massing.js actually EXTRUDES (the university's own massing
// ring — the OSM ring is suppressed under it) and that mass's own 12.4 m
// per-mass LiDAR height.
//
// Three things decided the shape of this file:
//
//   1. The building solves on the DRAWN LiDAR height: 12.4 m is four levels
//      of 2.8 m plus a 1.2 m parapet with zero residual, within 2% of the
//      inventory's assumed 3.05 m anchor (declared [estimated]). An earlier
//      build used the campus-3d builder's 15.6 m on the suppressed OSM ring;
//      the LiDAR itself says 12.4, and the 15.6 hung the whole roofscape
//      3.2 m over the drawn roof — the losing read stays on the record in
//      the section's measured.heightNote.
//
//   2. Bays are COUNTS, not metres. ~30-31 bays over the near-orthographic
//      south elevation is the foreshortening-immune fact; the photo-derived
//      58 m length does not reconcile with the 37.5 m drawn ring, and the
//      ring wins. The sibling difference from Argo survives per bay: a large
//      glazed panel at 0.85 of the bay against Argo's 0.66 narrow window, and
//      2 fin storeys plus penthouse against Argo's 5.
//
//   3. The drawn extrusion is flat-topped at 12.4 m (its only opening is the
//      courtyard well), so the set-back penthouse and its terrace cannot be
//      carved out of it. The band above the fin storeys is dressed as plain
//      precast, and the penthouse, guardrail and mechanical screen are
//      DECLARED absent, not faked.
//
// The east end wall is honoured as what the photographs show — a glazed grid
// with mullions and flat pilasters, not the fin field. The south base carries
// the lava-rock rubble terrace wall, the best instance on campus.
//
// Colours are DATA from the section's `colors` block: Argo's daylight precast
// whites with Blake's dusk relationships, per the inventory — the backlit
// Street View samples and every pre-repaint tan are dead epochs. Surfaces come
// from the seeded material library; irregularity comes from `hash`. Deterministic.
import * as THREE from "../vendor/three/three.module.min.js";
import { applyOverlayDepth, OVERLAY, overlayLift } from "./campus-overlay.js";
import { createMaterialLibrary } from "./campus-materials.js";

const PAD = "pad";
const CARPET = "carpet";

let LIB = null;
const lib = () => (LIB ??= createMaterialLibrary(THREE));

const concrete = (color) => lib().get("smoothConcrete", { color });
const painted = (color) => lib().get("metalPanel", { color, metalness: 0.35, roughness: 0.55 });
const louvre = (color) => lib().get("metalPanelSeam", { color, metalness: 0.5, roughness: 0.5 });
const glassMat = (color) => lib().get("glass", { color });
const rock = (color) => lib().get("lavaRock", { color });
const foliage = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0.0 });

function decal(color, rung, cls = "smoothConcrete", repeat) {
  return applyOverlayDepth(lib().get(cls, { color, repeat }), rung);
}

/** Deterministic 0..1 from any integer mix. */
function hash(...ns) {
  let s = 0;
  for (let i = 0; i < ns.length; i++) s = s * 131.71 + ns[i] * 57.13 + 7.9;
  const v = Math.sin(s) * 43758.5453;
  return v - Math.floor(v);
}

/** One InstancedMesh from a list of placements. */
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

/** A flat XZ decal quad lying in the ground plane. */
function quad(w, d) {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  return g;
}

/** A facade's own coordinate frame from its two MEASURED ring vertices.
 *
 * The tangent is the a-b chord itself, not a perpendicular of the declared
 * `out` normal: the survey edges are not exactly axis-aligned, and a frame
 * that assumed they were placed the east treatment on a plane that drifted
 * half a metre off the wall along its 37.7 m run — proud of the wall at one
 * end, buried inside it at the other, so the glazed grid vanished mid-face.
 * `out` only picks which side of the chord is outdoors.
 *
 * `bulge` rides every offset outward of the outermost measured ring vertex
 * within the face's span: the east face's chord cuts the corner at the ring's
 * mid-edge vertex, and anything placed on the bare chord plane there would be
 * inside the drawn wall. */
function frameOf(f, ring) {
  const [ax, az] = f.a;
  const [bx, bz] = f.b;
  const length = Math.hypot(bx - ax, bz - az);
  const tx = (bx - ax) / length;
  const tz = (bz - az) / length;
  let nx = -tz;
  let nz = tx;
  if (nx * f.out[0] + nz * f.out[1] < 0) { nx = -nx; nz = -nz; }
  let bulge = 0;
  for (const [vx, vz] of ring || []) {
    const u = (vx - ax) * tx + (vz - az) * tz;
    if (u <= 0.01 || u >= length - 0.01) continue;
    const d = (vx - ax) * nx + (vz - az) * nz;
    if (d > bulge) bulge = d;
  }
  return {
    id: f.id,
    length,
    rot: Math.atan2(nx, nz),
    at: (u, w, y) => ({ x: ax + tx * u + nx * (w + bulge), y, z: az + tz * u + nz * (w + bulge) }),
  };
}

/* ---------------------------------------------------------------- facades */

/* The Blake panel bay: a large frosted glazed panel filling most of the bay,
   a full-width dark awning sash below it, faceted fins between bays that stop
   at the spandrel bands. Two fin storeys, then the plain upper band standing
   in for the set-back penthouse level, then the parapet. */
function collectPanelFace(section, f, frame, base, ground, bins) {
  const G = section.grid;
  const S = section.system;
  const F = G.floorToFloor;
  const module = frame.length / G.longFaceBays;
  const { rot, length } = frame;
  const panW = module * S.panel.widthFrac;
  const spandrelH = F * S.bands.spandrelFrac;
  const awningH = F * S.bands.awningFrac;
  const panH = F - spandrelH - awningH;

  for (let s = 1; s <= G.finStoreys; s++) {
    const y0 = base + s * F;

    bins.spandrels.push({
      ...frame.at(length / 2, 0.03, y0 + spandrelH / 2),
      rot,
      scale: [length, spandrelH, 0.06],
    });

    for (let i = 0; i < G.longFaceBays; i++) {
      const u = (i + 0.5) * module;
      const sky = hash(7, s, i, Math.round(length)) < 0.2;
      (sky ? bins.glassSky : bins.glassFrosted).push({
        ...frame.at(u, 0.02, y0 + spandrelH + awningH + panH / 2),
        rot,
        scale: [panW - 0.05, panH - 0.1, 1],
      });
      /* Full-bay-width dark-framed awning sash, projecting. */
      bins.awnings.push({
        ...frame.at(u, S.awning.proud, y0 + spandrelH + awningH / 2),
        rot,
        rotX: S.awning.tilt,
        scale: [panW - 0.06, 0.05, S.awning.depth],
      });
    }

    /* Faceted fins on the bay boundaries: a wider flat face plus a narrow
       return, storey-tall, stopping at the spandrel bands. */
    for (let i = 0; i <= G.longFaceBays; i++) {
      const u = i * module;
      bins.fins.push({
        ...frame.at(u, S.fin.proud / 2, y0 + spandrelH + (F - spandrelH) / 2),
        rot,
        scale: [S.fin.width, F - spandrelH, S.fin.proud],
      });
      bins.finReturns.push({
        ...frame.at(u + S.fin.width / 2, S.fin.returnProud / 2, y0 + spandrelH + (F - spandrelH) / 2),
        rot,
        scale: [S.fin.returnWidth, F - spandrelH, S.fin.returnProud],
      });
    }
  }

  collectUpper(section, frame, base, bins);
  collectGround(section, f, frame, base, ground, bins);
}

/* The east end: a glazed grid with mullions and flat pilasters over the fin
   storeys — treated differently from the long faces, as the photographs show. */
function collectGridFace(section, f, frame, base, ground, bins) {
  const G = section.grid;
  const S = section.system;
  const GG = S.glazedGrid;
  const F = G.floorToFloor;
  const module = frame.length / G.longFaceBays;
  const { rot, length } = frame;
  const fieldH = G.finStoreys * F;

  bins.glassFrosted.push({
    ...frame.at(length / 2, 0.02, base + F + fieldH / 2),
    rot,
    scale: [length - 0.5, fieldH - 0.15, 1],
  });
  for (let i = 0; i <= G.longFaceBays; i += GG.mullionEveryBays) {
    bins.mullions.push({
      ...frame.at(i * module, 0.06, base + F + fieldH / 2),
      rot,
      scale: [GG.mullionWidth, fieldH, 0.1],
    });
  }
  /* Horizontal mullions on EVERY storey line of the field, its bottom edge
     included, so the grid reads edge to edge against the storey grid — the
     audit failed a field whose bottom line was missing and whose plane was
     registered half a metre inside the drawn wall (see frameOf). */
  for (let s = 0; s <= G.finStoreys; s++) {
    bins.mullions.push({
      ...frame.at(length / 2, 0.06, base + (s + 1) * F),
      rot,
      scale: [length - 0.5, GG.mullionWidth, 0.1],
    });
  }
  for (let i = GG.pilasterEveryBays; i < G.longFaceBays; i += GG.pilasterEveryBays) {
    bins.pilasters.push({
      ...frame.at(i * module, 0.04, base + F + fieldH / 2),
      rot,
      scale: [GG.pilasterWidth, fieldH, 0.08],
    });
  }

  collectUpper(section, frame, base, bins);
  collectGround(section, f, frame, base, ground, bins);
}

/* The plain upper band (the penthouse level the flat-topped extrusion cannot
   set back — declared, not faked) and the parapet with its panel joints. */
function collectUpper(section, frame, base, bins) {
  const G = section.grid;
  const S = section.system;
  const F = G.floorToFloor;
  const module = frame.length / G.longFaceBays;
  const { rot, length } = frame;
  const bandY0 = base + (G.finStoreys + 1) * F;

  bins.upperBands.push({
    ...frame.at(length / 2, S.upperBand.proud, bandY0 + F / 2),
    rot,
    scale: [length, F, 0.06],
  });

  const P = S.parapet;
  const pY = bandY0 + F;
  bins.parapets.push({
    ...frame.at(length / 2, P.proud, pY + P.height / 2),
    rot,
    scale: [length, P.height, P.thickness],
  });
  bins.drips.push({
    ...frame.at(length / 2, P.proud + 0.03, pY + P.height - P.dripCap / 2),
    rot,
    scale: [length, P.dripCap, P.thickness + 0.06],
  });
  for (let i = P.jointEveryBays; i < G.longFaceBays; i += P.jointEveryBays) {
    bins.joints.push({
      ...frame.at(i * module, P.proud + P.thickness / 2 + 0.005, pY + P.height / 2),
      rot,
      scale: [0.03, P.height - 0.15, 0.02],
    });
  }
}

/* The ground colonnade: near-black recess glazing tight to the wall, square
   white columns just proud of it, soffit fascia; on the south, the storefront
   extras — Roger's Market green fascia panel and the louvered/slatted panel. */
function collectGround(section, f, frame, base, ground, bins) {
  const G = section.grid;
  const S = section.system;
  const GR = S.ground;
  const F = G.floorToFloor;
  const module = frame.length / G.longFaceBays;
  const { rot, length } = frame;

  /* The recess glazing and the columns stand ON the rolling terrain: the flat
     base is the rim-median seat, so they extend DOWN to the drawn surface —
     mirroring the measured massing's wall skirt — and can never float. */
  let gmin = base;
  const samples = Math.max(2, Math.ceil(length / 2));
  for (let i = 0; i <= samples; i++) {
    const p = frame.at((i * length) / samples, 0.03, 0);
    const g = ground(p.x, p.z);
    if (Number.isFinite(g) && g < gmin) gmin = g;
  }
  const recessBottom = gmin - 0.3;
  const recessTop = base + GR.glazingHeight;
  bins.recess.push({
    ...frame.at(length / 2, 0.03, (recessBottom + recessTop) / 2),
    rot,
    scale: [length - 0.4, recessTop - recessBottom, 1],
  });
  for (let i = 0; i < G.longFaceBays; i += GR.columnSpacingBays) {
    const p = frame.at((i + 0.5) * module, GR.columnProud + GR.columnSize / 2, 0);
    const g = ground(p.x, p.z);
    const bottom = Math.min(base, Number.isFinite(g) ? g : base) - 0.15;
    const top = base + F;
    bins.columns.push({
      x: p.x, y: (bottom + top) / 2, z: p.z,
      rot,
      scale: [GR.columnSize, top - bottom, GR.columnSize],
    });
  }
  bins.soffits.push({
    ...frame.at(length / 2, 0.12, base + F - GR.soffitFascia / 2),
    rot,
    scale: [length, GR.soffitFascia, 0.24],
  });

  if (GR.marketSign && GR.marketSign.face === f.id) {
    const M = GR.marketSign;
    bins.signs.push({
      ...frame.at(M.u, 0.08, base + M.y),
      rot,
      scale: [M.width, M.height, 0.05],
    });
  }
  if (GR.louvre && GR.louvre.face === f.id) {
    const L = GR.louvre;
    bins.louvres.push({
      ...frame.at(L.u, 0.06, base + L.height / 2 + 0.1),
      rot,
      scale: [L.width, L.height, 0.08],
    });
  }
}

/* ------------------------------------------------------------------- roof */

/* The roofscape: coping, the courtyard well, and the PV array on the north
   plate. Plans are measured off the ortho; equipment heights [estimated] — no
   oblique of this roof exists, and the data says so.

   The courtyard is the ROOF-PLANE read the declaration promises: a dark
   planted-bed decal seated ON the roof plane, the kerb ringing it on the
   solid plate, and the crowns emergent exactly where the ortho reads them.
   The drawn massing (the ArcGIS 'Blake Hall' ring carries a second, inner
   ring) opens a well below, and earlier shapes all failed the audit — a tray
   hovering over the open well, a floor at the bottom of it 15 m under the
   massing's own roof plane, and finally a cap that was still 3.2 m in the
   air because the module's roof plane was solved on the losing 15.6 m read
   instead of the mass's own 12.4 (see the header). The decal caps the drawn
   opening AT the drawn roof plane, its plan rect the bounding box of the
   drawn inner ring (section roof.courtyard, registered to
   measured.courtyardRing), oversized by the kerb width so no sliver of the
   void ever shows past its edge; the interior stays declared absent. */
function buildRoof(section, group, roofY, ground, bins) {
  const R = section.roof;
  const { colors } = section;
  const unit = new THREE.BoxGeometry(1, 1, 1);

  const copes = [];
  for (const f of section.facades) {
    const frame = frameOf(f, section.measured.ring);
    copes.push({
      ...frame.at(frame.length / 2, -R.coping.width / 2 + 0.05, roofY + R.coping.height / 2),
      rot: frame.rot,
      scale: [frame.length, R.coping.height, R.coping.width],
    });
  }
  group.add(instanced(unit, concrete(colors.copingWhite), copes));

  /* The courtyard decal, seated ON the roof plane and oversized by the kerb
     width so it caps the drawn well opening with no visible void. */
  const W = R.courtyard;
  const K = R.kerb;
  const wellW = W.x1 - W.x0;
  const wellD = W.z1 - W.z0;
  const wcx = (W.x0 + W.x1) / 2;
  const wcz = (W.z0 + W.z1) / 2;
  const well = new THREE.Mesh(
    quad(wellW + 2 * K.width, wellD + 2 * K.width), decal(colors.wellShade, PAD));
  well.position.set(wcx, roofY + overlayLift(PAD), wcz);
  well.renderOrder = OVERLAY[PAD].renderOrder;
  well.name = "courtyard-decal";
  group.add(well);

  const kerbs = [
    { x: wcx, z: W.z0 - K.width / 2, scale: [wellW + 2 * K.width, K.height, K.width] },
    { x: wcx, z: W.z1 + K.width / 2, scale: [wellW + 2 * K.width, K.height, K.width] },
    { x: W.x0 - K.width / 2, z: wcz, scale: [K.width, K.height, wellD] },
    { x: W.x1 + K.width / 2, z: wcz, scale: [K.width, K.height, wellD] },
  ];
  group.add(instanced(unit, concrete(colors.kerbWhite), kerbs,
    (k) => ({ ...k, y: roofY + K.height / 2 })));

  /* Mature courtyard trees: crowns emergent at the roof plane per the ortho,
     seated on the capping decal — carried by the roof plane, nothing hovers
     and nothing reaches into the declared-absent interior. */
  const crowns = instanced(new THREE.ConeGeometry(1, 1, 7), foliage(colors.treeGreen),
    W.trees, (t) => ({ x: t.x, y: roofY + t.height / 2, z: t.z, scale: [t.radius, t.height, t.radius] }));
  crowns.name = "courtyard-crowns";
  group.add(crowns);
  bins.counts.courtyardTrees = W.trees.length;

  /* The PV array on the north roof plate. */
  const P = R.pv;
  const panels = [];
  for (let r = 0; r < P.rows; r++) {
    const z = P.z0 + (r + 0.5) * ((P.z1 - P.z0) / P.rows);
    for (let x = P.x0 + P.panel[0] / 2; x <= P.x1 - P.panel[0] / 2; x += P.panel[0] + P.gap) {
      panels.push({ x, y: roofY + P.lift, z, rotX: P.tilt });
    }
  }
  group.add(instanced(new THREE.BoxGeometry(P.panel[0], 0.05, P.panel[1]),
    painted(colors.pvPanel), panels));
  group.add(instanced(unit, painted(colors.pvFrame), panels,
    (p) => ({ x: p.x, y: roofY + P.lift / 2, z: p.z, scale: [0.05, P.lift, 0.05] })));
  bins.counts.pv = panels.length;
}

/* ----------------------------------------------------------------- ground */

/* Blake's own south apron: the lava-rock rubble terrace wall (no coping —
   rough stone throughout, per the photographs) and the raised lawn terrace it
   retains. Umbrellas, racks and lamps stay absent; the plaza owns the ground
   beyond the apron. */
function buildGround(section, group, ground, bins) {
  const S = section.ground.south;
  const { colors } = section;
  const unit = new THREE.BoxGeometry(1, 1, 1);

  const L = S.lavaWall;
  const len = Math.hypot(L.b[0] - L.a[0], L.b[1] - L.a[1]);
  const ux = (L.b[0] - L.a[0]) / len;
  const uz = (L.b[1] - L.a[1]) / len;
  const rot = Math.atan2(-uz, ux);
  const rocks = [];
  const step = 0.55;
  for (let r = 0; r < L.rows; r++) {
    const rowY = ((r + 0.5) * L.height) / L.rows;
    for (let u = step / 2; u < len; u += step) {
      const j = hash(L.seed, r, Math.round(u * 10));
      const x = L.a[0] + ux * (u + (j - 0.5) * 0.16) - uz * ((j - 0.5) * 0.1);
      const z = L.a[1] + uz * (u + (j - 0.5) * 0.16) + ux * ((j - 0.5) * 0.1);
      rocks.push({
        x, y: ground(x, z) + rowY, z,
        rot: rot + (j - 0.5) * 0.7,
        rotX: (hash(L.seed + 1, r, Math.round(u * 10)) - 0.5) * 0.35,
        scale: [step * 1.15, (L.height / L.rows) * 1.2, L.thickness],
        dark: j < 0.4,
      });
    }
  }
  group.add(instanced(unit, rock(colors.lavaRock), rocks.filter((x) => !x.dark)));
  group.add(instanced(unit, rock(colors.lavaRockDark), rocks.filter((x) => x.dark)));
  bins.counts.lavaRocks = rocks.length;

  /* The raised lawn terrace behind the wall — its declared lift is the wall's
     retained height, so the lawn rides the terrain plus that lift. */
  const T = S.terrace;
  const tw = T.x1 - T.x0;
  const td = T.z1 - T.z0;
  const cx = (T.x0 + T.x1) / 2;
  const cz = (T.z0 + T.z1) / 2;
  const lawn = new THREE.Mesh(quad(tw, td), decal(colors.lawn, CARPET));
  lawn.position.set(cx, ground(cx, cz) + T.lift + overlayLift(CARPET), cz);
  lawn.renderOrder = OVERLAY[CARPET].renderOrder;
  lawn.name = "terrace-lawn";
  group.add(lawn);
}

/* -------------------------------------------------------------------- api */

/**
 * Build Blake Hall's photo-sourced detail.
 *
 * `photo` is the loaded photo-detail document; this reads only its `blake`
 * section and returns `{ group, counts }` (empty and harmless if the section
 * is missing). `surfaceAt` places everything that stands on the ground;
 * `heightAt` sets the building base, matching campus-massing.js.
 */
export function createPhotoBlake(scene, { photo, heightAt, surfaceAt } = {}) {
  const group = new THREE.Group();
  group.name = "photo-blake";
  const section = photo?.blake;
  if (!section) {
    scene?.add(group);
    return { group, counts: {} };
  }
  const ground = surfaceAt || heightAt;
  const base = heightAt || surfaceAt;
  if (typeof ground !== "function" || typeof base !== "function") {
    throw new Error("campus-photo-blake: needs surfaceAt (or heightAt) to place on the ground");
  }

  /* Match campus-massing.js roofElevation: rim-median ground over the FULL
     measured ring (measured.ring, copied verbatim from the survey), lifted
     if that would bury a high corner. */
  let verts = section.measured.ring;
  if (!Array.isArray(verts) || !verts.length) {
    verts = [];
    const seen = new Set();
    for (const f of section.facades) {
      for (const p of [f.a, f.b]) {
        const k = `${p[0]},${p[1]}`;
        if (!seen.has(k)) { seen.add(k); verts.push(p); }
      }
    }
  }
  const gs = verts.map(([x, z]) => base(x, z)).filter((v) => Number.isFinite(v)).sort((p, q) => p - q);
  const median = gs.length ? gs[Math.floor(gs.length / 2)] : 0;
  const highest = gs.length ? gs[gs.length - 1] : 0;
  const roofY = Math.max(median + section.measured.lidarHeight, highest);
  const baseY = roofY - section.measured.lidarHeight;

  const bins = {
    spandrels: [], glassFrosted: [], glassSky: [], awnings: [], fins: [], finReturns: [],
    mullions: [], pilasters: [], upperBands: [], parapets: [], drips: [], joints: [],
    recess: [], columns: [], soffits: [], signs: [], louvres: [],
    counts: {},
  };
  const facades = new THREE.Group();
  facades.name = "blake-facades";
  for (const f of section.facades) {
    const frame = frameOf(f, section.measured.ring);
    if (f.kind === "glazedGrid") collectGridFace(section, f, frame, baseY, ground, bins);
    else collectPanelFace(section, f, frame, baseY, ground, bins);
  }

  const { colors } = section;
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const plane = new THREE.PlaneGeometry(1, 1);
  const add = (geo, mat, items, name) => {
    if (!items.length) return;
    const mesh = instanced(geo, mat, items);
    if (name) mesh.name = name;
    facades.add(mesh);
  };
  add(unit, concrete(colors.spandrel), bins.spandrels);
  add(plane, glassMat(colors.windowFrosted), bins.glassFrosted);
  add(plane, glassMat(colors.windowSky), bins.glassSky);
  add(unit, painted(colors.awningFrame), bins.awnings);
  add(unit, concrete(colors.finWhite), bins.fins);
  add(unit, concrete(colors.finWhite), bins.finReturns);
  add(unit, painted(colors.mullion), bins.mullions);
  add(unit, concrete(colors.pilaster), bins.pilasters);
  add(unit, concrete(colors.precast), bins.upperBands);
  add(unit, concrete(colors.parapet), bins.parapets);
  add(unit, concrete(colors.copingWhite), bins.drips);
  add(unit, painted(colors.panelJoint), bins.joints);
  add(plane, glassMat(colors.groundRecess), bins.recess, "ground-recess");
  add(unit, concrete(colors.column), bins.columns, "ground-columns");
  add(unit, concrete(colors.soffit), bins.soffits);
  add(unit, painted(colors.marketGreen), bins.signs);
  add(unit, louvre(colors.louvreGrey), bins.louvres);
  group.add(facades);

  const roof = new THREE.Group();
  roof.name = "blake-roof";
  buildRoof(section, roof, roofY, ground, bins);
  group.add(roof);

  const groundGroup = new THREE.Group();
  groundGroup.name = "blake-ground";
  buildGround(section, groundGroup, ground, bins);
  group.add(groundGroup);

  scene?.add(group);
  return {
    group,
    counts: {
      facades: section.facades.length,
      bays: section.grid.longFaceBays,
      windows: bins.glassFrosted.length + bins.glassSky.length,
      fins: bins.fins.length,
      awnings: bins.awnings.length,
      mullions: bins.mullions.length,
      columns: bins.columns.length,
      pv: bins.counts.pv || 0,
      courtyardTrees: bins.counts.courtyardTrees || 0,
      lavaRocks: bins.counts.lavaRocks || 0,
      draws: group.children.reduce((s, g) => s + g.children.length, 0),
    },
  };
}
