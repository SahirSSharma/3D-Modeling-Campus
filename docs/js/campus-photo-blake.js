// Blake Hall, from photographs — the INVENTED class.
//
// Tucker, Sadler & Bennett (the year is a declared 1967-vs-1968 conflict, not
// an assertion — see the section's conflicts[]), for Revelle College; renovated
// LEED Gold and repainted WHITE by Vasquez Marshall, complete by January 2014.
// NOT a Fleet hall. Argo's sibling — the same family language (white precast
// fins, awning sashes, plain parapet band, recessed ground colonnade) but a
// DIFFERENT module. The only things this file takes from the survey are where
// Blake stands and how tall it is: the ring campus-massing.js actually EXTRUDES
// (the university's own massing ring — the OSM ring is suppressed under it),
// that ring's INNER ring, and the mass's own 12.4 m per-mass LiDAR height.
//
// FOUR THINGS DECIDED THE SHAPE OF THIS FILE.
//
//   0. BLAKE IS A COURTYARD DONUT AND THE WELL IS OPEN. The previous build
//      painted a decal lid over it at the roof plane and declared everything
//      below "not sourced". Four independent sources say otherwise: the survey
//      itself (massing[58] carries two rings and campus-massing.js:826 pushes
//      every ring after the first into shape.holes, so the extruder has always
//      built this void); the 2026 ortho, looking down at crowns, beds and
//      paving eleven metres below; Vasquez Marshall's own scope ("a completely
//      renovated courtyard concept at the building's center"); and two
//      photographs taken INSIDE it. The lid is gone. The court floor is at
//      surfaceAt on the paving rung and the well faces carry the gallery
//      language those photographs actually show — pale horizontal board
//      cladding, picket guards on three levels, door-plus-window bays — which
//      is a completely different system from the Argo courtyard pattern the
//      old build was extending into a court it could not see.
//
//   1. THE STOREY IS 3.10 m AND THE PARAPET IS INSIDE THE HEIGHT. 12.40 =
//      4 x 3.10 with zero residual, read off a four-step stack in the
//      near-orthographic south elevation whose every line is an independently
//      visible feature. The 12.4 m is the top of the LEVEL 4 ROOF SLAB, not
//      the top of the outer wall: the outer parapet tops out at 10.59 m and
//      the slab stands 1.81 m proud of it. The LiDAR builder's own guard
//      proves that anchoring — it withholds massHeights when p98 - p75 > 2 m,
//      Blake HAS an entry, and the alternative anchoring would have put a
//      2.12 m step between planes and fired it.
//
//   2. THE LEVEL 4 BAR IS MEASURED AND NOT BUILT. Its plan is a 35.5 x 19.1 m
//      east-west bar with 9.3 m and 9.5 m roof terraces north and south of it,
//      all in the section's `level4` with the arithmetic. The VOLUME is not
//      built: campus-massing.js extrudes Blake's ring flat to 12.40 m, so a
//      9.30 m terrace deck would be three metres inside a solid mass —
//      invisible, and intersecting, which this project forbids. Better absent
//      than wrong. The band between 10.59 m and 12.40 m on the outer
//      elevations is dressed as plain precast under the honest name
//      `system.surveyOvershoot`, and the whole thing is the section's largest
//      declared conflict rather than a quiet compromise.
//
//   3. EVERY METRE THAT DECIDES THE BUILDING, AND EVERY COLOUR, IS THE
//      SECTION'S. Storey heights, bay modules, plan positions and hexes all
//      come from the section's `grid`, `system`, `court`, `roof` and `colors`
//      blocks, each derived in `derivations.figures` with its own arithmetic,
//      extended in `estimates` with a band and the ladder that failed, or read
//      in `reads` with a tolerance. There is NO hex in this file and the test
//      gates that. There ARE bare decimal literals — the 2026-08-20 audit
//      counted 85 — and the header used to claim otherwise; that claim was
//      false and is withdrawn (R2 item B4/5). They are proportions and render
//      trim (rock pitch, crown offsets, panel gaps, skirt drops); the ones
//      that decide a datum are in the section's `draw`. Irregularity comes
//      from `hash` off the section's pinned seed. Nothing reads a clock or a
//      random source.
import * as THREE from "../vendor/three/three.module.min.js";
import { applyOverlayDepth, OVERLAY, overlayLift } from "./campus-overlay.js";
import { sharedMaterialLibrary } from "./campus-materials.js";

const lib = () => sharedMaterialLibrary(THREE);

const concrete = (color) => lib().get("smoothConcrete", { color });
const painted = (color) => lib().get("metalPanel", { color, metalness: 0.35, roughness: 0.55 });
const louvre = (color) => lib().get("metalPanelSeam", { color, metalness: 0.5, roughness: 0.5 });
const glassMat = (color) => lib().get("glass", { color });
const rock = (color) => lib().get("lavaRock", { color });
const boardClad = (color, repeat) => lib().get("metalPanelSeam", { color, repeat, metalness: 0.1, roughness: 0.8 });
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
   at the spandrel bands. Two fin storeys, then the parapet around the Level 4
   roof terrace, then the survey-overshoot band. */
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
      const sky = hash(section.seed, s, i, Math.round(length)) < 0.2;
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

/* Above the fin storeys the outer wall is the PARAPET around the Level 4 roof
   terrace — it starts at the terrace deck and stops 1.29 m up, both measured —
   and above THAT is the survey overshoot: the band the flat-topped extrusion
   puts where the real building has open terrace 9.4 m behind. It is dressed as
   plain precast and named for what it is; see the section's
   conflicts['flat-topped-mass']. */
function collectUpper(section, frame, base, bins) {
  const G = section.grid;
  const S = section.system;
  const module = frame.length / G.longFaceBays;
  const { rot, length } = frame;

  const P = S.parapet;
  const pY = base + G.terraceDeck;
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

  const O = S.surveyOvershoot;
  const oY0 = base + G.parapetTop;
  const oH = G.roofSlab - G.parapetTop;
  bins.upperBands.push({
    ...frame.at(length / 2, O.proud, oY0 + oH / 2),
    rot,
    scale: [length, oH, 0.06],
  });
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
  /* Storefront differentiation, at the level the source supports: _67 shows a
     glazed storefront behind the colonnade whose mullions fall on the facade's
     OWN bay module (reads['ground.storefront.mullionPitch']), so one mullion
     goes on every bay boundary but the two at each face's ends, which are the
     building corners. No lettering and no per-bay tenancy — which bay is a
     door, a shopfront or the solid panel is declared in absent[]. */
  const SF = GR.storefront;
  if (SF) {
    for (let i = SF.skipEnds; i <= G.longFaceBays - SF.skipEnds; i += SF.pitchBays) {
      bins.storefront.push({
        ...frame.at(i * module, 0.03 + section.draw.storefrontProud, (recessBottom + recessTop) / 2),
        rot,
        scale: [SF.mullionWidth, recessTop - recessBottom, SF.mullionWidth],
      });
    }
  }

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

/* Deterministic COLOUR textures, self-contained on purpose.
   campus-materials.js bakes grey relief multiplied into one caller colour;
   the membrane's staining needs two colours in one map, so this bakes its own
   RGBA the same DataTexture way — a closed-form field over (u, v),
   byte-identical in Node and the browser, colours fed from the section's
   `colors` block, never from photo or satellite pixels. */
function bakeNoise(u, v, seed, cells, oct) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  for (let o = 0; o < oct; o++) {
    const n = cells << o;
    const x = u * n;
    const z = v * n;
    const xi = Math.floor(x);
    const zi = Math.floor(z);
    const fx = x - xi;
    const fz = z - zi;
    const s = (i, j) => hash(seed, o, ((xi + i) % n + n) % n, ((zi + j) % n + n) % n);
    const sx = fx * fx * (3 - 2 * fx);
    const sz = fz * fz * (3 - 2 * fz);
    sum += amp * ((s(0, 0) * (1 - sx) + s(1, 0) * sx) * (1 - sz)
      + (s(0, 1) * (1 - sx) + s(1, 1) * sx) * sz);
    norm += amp;
    amp *= 0.5;
  }
  return sum / norm;
}

const hex2rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function bakeTexturePair(field) {
  const S = 256;
  const albedo = new Uint8Array(S * S * 4);
  const rough = new Uint8Array(S * S * 4);
  const out = [0, 0, 0, 0.9];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      field((x + 0.5) / S, (y + 0.5) / S, out);
      const i = (y * S + x) * 4;
      albedo[i] = Math.max(0, Math.min(255, Math.round(out[0])));
      albedo[i + 1] = Math.max(0, Math.min(255, Math.round(out[1])));
      albedo[i + 2] = Math.max(0, Math.min(255, Math.round(out[2])));
      albedo[i + 3] = 255;
      const r = Math.max(0, Math.min(255, Math.round(out[3] * 255)));
      rough[i] = rough[i + 1] = rough[i + 2] = r;
      rough[i + 3] = 255;
    }
  }
  const tex = (data, srgb) => {
    const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  };
  return { map: tex(albedo, true), roughnessMap: tex(rough, false) };
}

/** The weathered patch-stained membrane (section roof.membrane): the ortho's
    cool near-white field, its neutral-grey patch staining, a faint seam grid.
    Both colours are 2026 daylight-nadir measurements of THIS roof — the warm
    off-white and the rust stain the previous build used were Argo's, borrowed
    on a premise the section's colorNote now refutes. */
function blakeMembraneTexture(colors) {
  const base = hex2rgb(colors.membraneBase);
  const stain = hex2rgb(colors.membraneStain);
  return bakeTexturePair((u, v, out) => {
    const mottle = bakeNoise(u, v, 11, 6, 3);
    const blotch = bakeNoise(u, v, 12, 5, 4);
    /* Sparse flecking, not cowhide: a high threshold and a soft cap keep the
       field reading white with grey patches, matching the ortho's weathering. */
    const k = Math.max(0, Math.min(1, (blotch - 0.66) / 0.1)) * (0.2 + 0.45 * mottle);
    const seamU = (u * 6) % 1;
    const seamV = (v * 6) % 1;
    const seam = (seamU < 0.02 || seamV < 0.02) ? 0.94 : 1;
    const tone = (0.94 + 0.08 * mottle) * seam;
    for (let c = 0; c < 3; c++) out[c] = base[c] * tone * (1 - 0.8 * k) + stain[c] * (0.9 + 0.2 * mottle) * 0.8 * k;
    out[3] = 0.8 + 0.12 * mottle + 0.08 * k;
  });
}

/** The stair/lift core's footprint, from the ONE place it is measured: the four
 *  vertices of the drawn inner ring carried verbatim into the section's survey
 *  readings. It is SOLID MASS to 12.40 m, and it used to be treated as a void
 *  twice with opposite signs — the membrane was cut open over it (a 3.0 x 2.9 m
 *  hole in a roof the section calls one plane) and its three well-ring faces
 *  were dressed with residence-room bays (12 glazed doors and 12 room windows
 *  on a stair core nothing photographs). One rectangle, read here, used by
 *  both, so a fix to one can no longer move the error into the other. */
function notchRect(section) {
  const S = section.derivations.readings.survey;
  return { x0: S.notchX0, x1: S.notchX1, z0: S.notchZ0, z1: S.notchZ1 };
}

/** True if a well-ring vertex lies on the core notch. The survey rectangle is
 *  the notch's own vertices, so the tolerance only absorbs the ring's 0.1 m
 *  drafting slop at the two corners it shares with the west run. */
function onNotch(p, N) {
  return p[0] >= N.x0 - 0.15 && p[0] <= N.x1 + 0.15
    && p[1] >= N.z0 - 0.15 && p[1] <= N.z1 + 0.15;
}

/** True if (x, z) is inside a closed ring. */
function inRing(x, z, r) {
  let ins = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, zi] = r[i];
    const [xj, zj] = r[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
}

/* The roofscape, and what is left of it.
 *
 * THE CEILING IS THE MEASURED LiDAR MAXIMUM (section roof.anchorGate; R2 item
 * B2). The retired gate asked whether a roof item stood higher than the roof
 * block's own declared heights plus half a metre, which is not a gate at all —
 * whatever the block said, it passed. Held to the LiDAR anchor instead, the R1
 * build put 65 solid placements above it, to +2.510 m: the coping on all four
 * faces, the mechanical screen's enclosure, deck and 32 blocks, and all twelve
 * vent curbs with their caps. That is the exact sin roof.plates was withdrawn
 * for, six times larger.
 *
 * NONE OF IT IS RE-SEATED, BECAUSE THERE IS NOWHERE BELOW THE ANCHOR TO STAND.
 * The only lower datum in this building is the 9.30 m roof-terrace deck, and
 * the drawn mass is flat-topped at 12.40 m, so that deck is three metres inside
 * solid mass — invisible and intersecting, which this project forbids. So the
 * coping, the screen and the vents are WITHHELD, their measured plans, tones
 * and adjudications kept in the section with built:false, and each declared in
 * absent[] with the frame that would settle it. Better absent than wrong.
 *
 * The 2026-08-18 not-PV adjudication is unaffected and stands in the data: the
 * cream checkerboard is a screened MECHANICAL enclosure, not an array. It is
 * withheld for its HEIGHT, which was never measurable, not for its identity.
 *
 * What still draws here is the membrane, which is not furniture standing on the
 * roof but a decal ON the drawn surface, lifted only by the repo's own declared
 * pad rung. It is laid in five bands: four round the open well, and a fifth
 * over the stair/lift core, which is inside the court rectangle but is SOLID
 * MASS to 12.40 m and was carrying a 3.0 x 2.9 m hole. */
function buildRoof(section, group, roofY, bins) {
  const R = section.roof;
  const { colors } = section;

  const ring = section.measured.ring;
  const rx0 = Math.min(...ring.map((p) => p[0]));
  const rx1 = Math.max(...ring.map((p) => p[0]));
  const rz0 = Math.min(...ring.map((p) => p[1]));
  const rz1 = Math.max(...ring.map((p) => p[1]));
  const C = section.court;
  const N = notchRect(section);

  const membrane = blakeMembraneTexture(colors);
  const membraneMat = (repeat) => {
    const maps = Object.fromEntries(Object.entries(membrane).map(([k, t]) => {
      const c = t.clone();
      c.repeat.set(repeat[0], repeat[1]);
      c.needsUpdate = true;
      return [k, c];
    }));
    return applyOverlayDepth(new THREE.MeshStandardMaterial({ ...maps, roughness: 1, metalness: 0 }), "pad");
  };

  /* Membrane over the whole drawn roof plane, in four bands around the open
     well — the well is a real hole and nothing is laid across it — plus a
     fifth over the SOLID core notch, which is inside the court rectangle the
     other four are cut against and is mass to 12.40 m. The notch rectangle is
     read from ONE place (notchRect) that the well-face dressing reads too, so
     the two cannot disagree about which side of it is solid. */
  const inset = section.draw.membraneInset;
  const bands = [
    { x0: rx0 + inset, x1: rx1 - inset, z0: rz0 + inset, z1: C.z0 },
    { x0: rx0 + inset, x1: rx1 - inset, z0: C.z1, z1: rz1 - inset },
    { x0: rx0 + inset, x1: C.x0, z0: C.z0, z1: C.z1 },
    { x0: C.x1, x1: rx1 - inset, z0: C.z0, z1: C.z1 },
    { x0: N.x0, x1: N.x1, z0: N.z0, z1: N.z1 },
  ];
  for (const b of bands) {
    const w = b.x1 - b.x0;
    const d = b.z1 - b.z0;
    const mesh = new THREE.Mesh(quad(w, d), membraneMat([Math.max(1, w / 9), Math.max(1, d / 9)]));
    mesh.position.set((b.x0 + b.x1) / 2, roofY + overlayLift("pad"), (b.z0 + b.z1) / 2);
    mesh.renderOrder = OVERLAY.pad.renderOrder;
    mesh.name = "membrane-band";
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  bins.counts.membraneBands = bands.length;

  /* The coping, the mechanical screen and the vents all stood above the
     measured LiDAR maximum and are WITHHELD — see this function's header and
     the section's roof.anchorGate. Their records must say so, and if one of
     them is ever flipped back to built:true it must come back with a seat
     under the anchor rather than by deleting these guards. */
  for (const [key, block] of [["coping", R.coping], ["screen", R.screen], ["vents", R.vents]]) {
    if (block.built !== false) {
      throw new Error(`campus-photo-blake: roof.${key} claims built:${block.built} but stands `
        + "above the measured LiDAR anchor — see roof.anchorGate and absent[]");
    }
  }
}

/* ------------------------------------------------------------------ court */

/** The well ring's faces, each with the normal that points INTO the court.
 *  The winding is read off the ring's own signed area rather than assumed, and
 *  the notch's three faces fall out of the same loop with the right normals —
 *  they are edges of a concave polygon, not a special case. */
function wellFaces(ringClosed) {
  const r = ringClosed.slice(0, -1);
  let area = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    area += r[j][0] * r[i][1] - r[i][0] * r[j][1];
  }
  const ccw = area > 0;
  const out = [];
  for (let i = 0; i < r.length; i++) {
    const [ax, az] = r[i];
    const [bx, bz] = r[(i + 1) % r.length];
    const length = Math.hypot(bx - ax, bz - az);
    if (length < 1e-6) continue;
    const tx = (bx - ax) / length;
    const tz = (bz - az) / length;
    /* Inward (into the polygon = into the court) for the ring's own winding. */
    const nx = ccw ? -tz : tz;
    const nz = ccw ? tx : -tx;
    out.push({
      a: r[i],
      b: r[(i + 1) % r.length],
      length,
      rot: Math.atan2(nx, nz),
      at: (u, w, y) => ({ x: ax + tx * u + nx * w, y, z: az + tz * u + nz * w }),
    });
  }
  return out;
}

/* The court, which is the whole point of this revision.
 *
 * The floor is TESSELLATED and every vertex sits on surfaceAt at its own
 * (x, z) plus the paving rung, so it follows the drawn triangle exactly and
 * can neither hover nor sink — the CLAUDE.md rule for anything placed on the
 * ground, applied to a floor eleven metres inside a building. Beds, boulders
 * and palms all seat on that same datum, so the court has one datum and
 * nothing in it can disagree about where the floor is.
 *
 * The well FACES carry the language _3 and _25 photograph: pale horizontal
 * board cladding, a picket guard on stub posts at levels 2, 3 and 4 over a
 * separate slab-edge line, and a repeating bay of a dark-framed room door plus
 * a window with a square wall light between bays. The gallery walkway's open
 * DEPTH is not built — the drawn mass is solid where the walkway is open — and
 * that is declared in the section rather than faked with a projecting deck. */
function buildCourt(section, group, baseY, ground, bins) {
  const C = section.court;
  const W = section.system.wellFace;
  const { colors } = section;
  const ring = section.measured.courtyardRing;
  const D = section.draw;
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const lift = overlayLift(D.courtRung);
  const seat = (x, z) => ground(x, z) + lift;

  /* ---- the floor, following the drawn surface ---- */
  const step = 1;
  const nx = Math.max(1, Math.ceil((C.x1 - C.x0) / step));
  const nz = Math.max(1, Math.ceil((C.z1 - C.z0) / step));
  const dx = (C.x1 - C.x0) / nx;
  const dz = (C.z1 - C.z0) / nz;
  const verts = [];
  const uvs = [];
  const idx = [];
  const at = (i, j) => {
    const x = C.x0 + i * dx;
    const z = C.z0 + j * dz;
    verts.push(x, seat(x, z), z);
    uvs.push(x / 2, z / 2);
    return verts.length / 3 - 1;
  };
  const grid = [];
  for (let i = 0; i <= nx; i++) {
    grid.push([]);
    for (let j = 0; j <= nz; j++) grid[i].push(at(i, j));
  }
  let cells = 0;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const cx = C.x0 + (i + 0.5) * dx;
      const cz = C.z0 + (j + 0.5) * dz;
      if (!inRing(cx, cz, ring)) continue;
      idx.push(grid[i][j], grid[i][j + 1], grid[i + 1][j + 1]);
      idx.push(grid[i][j], grid[i + 1][j + 1], grid[i + 1][j]);
      cells++;
    }
  }
  const floorGeo = new THREE.BufferGeometry();
  floorGeo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  floorGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  floorGeo.setIndex(idx);
  floorGeo.computeVertexNormals();
  const floor = new THREE.Mesh(floorGeo,
    decal(colors.courtConcrete, D.courtRung, "pavingConcreteUnit", [1, 1]));
  floor.renderOrder = OVERLAY[D.courtRung].renderOrder;
  floor.name = "court-floor";
  floor.receiveShadow = true;
  group.add(floor);
  bins.counts.courtFloorCells = cells;

  /* ---- decomposed-granite beds, on the rung above the paving ---- */
  const bedLift = overlayLift(D.bedRung);
  for (const b of C.beds) {
    const bw = b.x1 - b.x0;
    const bd = b.z1 - b.z0;
    const bx = (b.x0 + b.x1) / 2;
    const bz = (b.z0 + b.z1) / 2;
    const bed = new THREE.Mesh(quad(bw, bd),
      decal(colors.decomposedGranite, D.bedRung, "decomposedGranite", [bw / 2, bd / 2]));
    bed.position.set(bx, ground(bx, bz) + bedLift, bz);
    bed.renderOrder = OVERLAY[D.bedRung].renderOrder;
    bed.name = "court-bed";
    bed.receiveShadow = true;
    group.add(bed);
  }
  bins.counts.courtBeds = C.beds.length;

  /* ---- granite boulders ---- */
  group.add(instanced(new THREE.IcosahedronGeometry(1, 1), concrete(colors.boulderGrey), C.boulders,
    (b, i) => ({
      x: b.x, y: seat(b.x, b.z) + b.r * (0.62 - D.boulderBury), z: b.z,
      rot: hash(section.seed, i, 3) * Math.PI,
      scale: [b.r, b.r * 0.62, b.r * 0.85],
    })));
  bins.counts.courtBoulders = C.boulders.length;

  /* ---- Washingtonia fan palms, seated on the court floor ---- */
  const palms = C.palms;
  group.add(instanced(new THREE.CylinderGeometry(1, 1.4, 1, 8),
    lib().get("barkEucalyptus", { color: colors.palmTrunk }), palms,
    (p) => ({
      x: p.x, y: seat(p.x, p.z) + p.height / 2, z: p.z,
      scale: [C.palmTrunkRadius, p.height, C.palmTrunkRadius],
    })));
  /* THE CLIP, stated as a rule (draw.crownClearNote). Crown centres and radii
     are measured off the 2026 ortho and are not moved; the DRAWN cone is
     trimmed to the well the massing actually opens, less draw.crownClear, so a
     canopy cannot grow into a gallery slab, a guard or the solid core notch.
     It bites on palm-4, whose 2.6 m crown reaches into the notch. */
  const ringPts = section.measured.courtyardRing;
  const toRing = (px, pz) => {
    let best = Infinity;
    for (let i = 1; i < ringPts.length; i++) {
      const [ax, az] = ringPts[i - 1];
      const [bx, bz] = ringPts[i];
      const dx = bx - ax;
      const dz = bz - az;
      const l2 = dx * dx + dz * dz;
      const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0;
      best = Math.min(best, Math.hypot(px - (ax + t * dx), pz - (az + t * dz)));
    }
    return best;
  };
  const crownRadius = (p) => Math.max(0, Math.min(p.radius, toRing(p.x, p.z) - D.crownClear));
  const crowns = instanced(new THREE.ConeGeometry(1, 1, 9), foliage(colors.palmFrond), palms,
    (p) => ({ x: p.x, y: seat(p.x, p.z) + p.height + 0.3, z: p.z, scale: [crownRadius(p), 1.1, crownRadius(p)] }));
  crowns.name = "court-crowns";
  group.add(crowns);
  group.add(instanced(new THREE.ConeGeometry(1, 1, 9), foliage(colors.palmFrond), palms,
    (p) => ({
      x: p.x, y: seat(p.x, p.z) + p.height - 0.15, z: p.z, rotX: Math.PI,
      scale: [p.radius * 1.05, 0.7, p.radius * 1.05],
    })));
  bins.counts.courtPalms = palms.length;

  /* ---- the well faces ---- */
  const faces = wellFaces(ring);
  const clad = [];
  const slabEdges = [];
  const topRails = [];
  const midRails = [];
  const bottomRails = [];
  const posts = [];
  const pickets = [];
  const doors = [];
  const doorGlass = [];
  const windows = [];
  const winGlass = [];
  const lights = [];
  const wallH = section.grid.roofSlab;
  const N = notchRect(section);

  for (const face of faces) {
    const { rot, length } = face;
    /* The three faces of the SOLID stair/lift core. research-blake authorises
       dressing them with "the same gallery-adjacent language; the galleries
       pass it" — cladding and a passing walkway. It does not authorise a
       repeating residence-room bay, and nothing photographs the core, so the
       room bays are suppressed over its footprint and the guard, the slab edge
       and the cladding carry straight past. Same rectangle as the membrane's
       fifth band; see notchRect. */
    const core = onNotch(face.a, N) && onNotch(face.b, N);
    /* Cladding over the full height of the face, carried DOWN to the lowest
       court floor under it so a rolling surface cannot open a gap at its
       foot — the same skirt argument as the outer colonnade's. */
    let gmin = baseY;
    const samples = Math.max(2, Math.ceil(length / 2));
    for (let i = 0; i <= samples; i++) {
      const p = face.at((i * length) / samples, 0, 0);
      const g = seat(p.x, p.z);
      if (Number.isFinite(g) && g < gmin) gmin = g;
    }
    const cladBottom = gmin - 0.3;
    const cladTop = baseY + wallH;
    clad.push({
      ...face.at(length / 2, D.wellFaceProud, (cladBottom + cladTop) / 2),
      rot,
      scale: [length, cladTop - cladBottom, 0.06],
      repeat: [length / W.bayModule, (cladTop - cladBottom) / W.boardPitch],
    });

    const bays = Math.max(1, Math.round(length / W.bayModule));
    const bay = length / bays;
    /* The window takes what is left of the bay once the door leaf and a
       one-board reveal at each end are out — the section's own expression,
       evaluated against the bay this face actually has. */
    const winW = bay - W.doorWidth - 2 * W.boardPitch;

    for (const level of W.levels) {
      const y0 = baseY + level.deck;

      for (let b = 0; b < bays && !core; b++) {
        const u0 = b * bay;
        const doorU = u0 + W.boardPitch + W.doorWidth / 2;
        doors.push({
          ...face.at(doorU, D.wellFaceProud + 0.01, y0 + W.doorHeight / 2),
          rot,
          scale: [W.doorWidth, W.doorHeight, 0.05],
        });
        doorGlass.push({
          ...face.at(doorU, D.wellFaceProud + 0.03, y0 + W.doorHeight / 2),
          rot,
          scale: [W.doorWidth - W.railFace * 2, W.doorHeight - W.railFace * 2, 1],
        });
        if (winW > W.doorWidth / 2) {
          const winU = u0 + W.boardPitch + W.doorWidth + winW / 2;
          windows.push({
            ...face.at(winU, D.wellFaceProud + 0.01, y0 + W.windowSill + W.windowHeight / 2),
            rot,
            scale: [winW, W.windowHeight, 0.05],
          });
          winGlass.push({
            ...face.at(winU, D.wellFaceProud + 0.03, y0 + W.windowSill + W.windowHeight / 2),
            rot,
            scale: [winW - W.railFace * 2, W.windowHeight - W.railFace * 2, 1],
          });
        }
        /* A square wall-mounted fixture on the internal bay boundaries. */
        if (b > 0) {
          lights.push({
            ...face.at(u0, D.wellFaceProud + 0.04, y0 + W.fixtureHeight),
            rot,
            scale: [W.fixture, W.fixture, 0.08],
          });
        }
      }

      if (!level.gallery) continue;
      /* The slab edge reads BELOW the rail as its own line, and the guard
         stands on stub posts off that edge — both straight out of _3. */
      slabEdges.push({
        ...face.at(length / 2, D.slabEdgeProud + D.railProud, y0 - W.slabEdge / 2),
        rot,
        scale: [length, W.slabEdge, 0.08],
      });
      topRails.push({
        ...face.at(length / 2, D.railProud, y0 + W.guardHeight - W.railFace / 2),
        rot,
        scale: [length, W.railFace, W.railFace],
      });
      midRails.push({
        ...face.at(length / 2, D.railProud, y0 + W.midRailHeight),
        rot,
        scale: [length, W.railFace, W.railFace * 0.7],
      });
      /* The picket panel is HELD OFF THE DECK. _3 shows it occupying roughly
         the top 60% of the guard, closed by a bottom rail, over an open gap of
         about a third of the guard height — a continuous stripe of light under
         every rail on three levels and eight faces. The shipped build ran the
         pickets deck-to-top and modelled no bottom rail at all. */
      bottomRails.push({
        ...face.at(length / 2, D.railProud, y0 + W.bottomRailHeight),
        rot,
        scale: [length, W.railFace, W.railFace * 0.7],
      });
      const nPosts = Math.max(2, Math.round(length / W.bayModule) + 1);
      for (let p = 0; p < nPosts; p++) {
        posts.push({
          ...face.at((p * length) / (nPosts - 1), D.railProud, y0 + W.guardHeight / 2),
          rot,
          scale: [W.postWidth, W.guardHeight, W.postWidth],
        });
      }
      const nPickets = Math.max(2, Math.floor(length / W.picketPitch));
      const pLo = W.bottomRailHeight + W.railFace / 2;
      const pHi = W.guardHeight - W.railFace / 2;
      for (let p = 0; p < nPickets; p++) {
        pickets.push({
          ...face.at((p + 0.5) * (length / nPickets), D.railProud, y0 + (pLo + pHi) / 2),
          rot,
          scale: [W.picketWidth, pHi - pLo, W.picketWidth],
        });
      }
    }
  }

  /* One cladding mesh per face: the board course has to land on the metre, so
     the seam repeat is per-face and cannot be shared by an InstancedMesh. */
  for (const c of clad) {
    const mesh = new THREE.Mesh(unit, boardClad(colors.wellBoard, c.repeat));
    mesh.position.set(c.x, c.y, c.z);
    mesh.rotation.y = c.rot;
    mesh.scale.set(c.scale[0], c.scale[1], c.scale[2]);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.name = "well-cladding";
    group.add(mesh);
  }
  const plane = new THREE.PlaneGeometry(1, 1);
  const add = (geo, mat, items, name) => {
    if (!items.length) return;
    const mesh = instanced(geo, mat, items);
    if (name) mesh.name = name;
    group.add(mesh);
  };
  add(unit, concrete(colors.courtConcrete), slabEdges, "well-slab-edges");
  add(unit, painted(colors.wellRail), topRails);
  add(unit, painted(colors.wellRail), midRails);
  add(unit, painted(colors.wellRail), bottomRails, "well-bottom-rails");
  add(unit, painted(colors.wellRail), posts);
  add(unit, painted(colors.wellRail), pickets, "well-pickets");
  add(unit, painted(colors.wellDoorFrame), doors, "well-doors");
  add(plane, glassMat(colors.wellGlass), doorGlass);
  add(unit, painted(colors.wellDoorFrame), windows, "well-windows");
  add(plane, glassMat(colors.wellGlass), winGlass);
  add(unit, painted(colors.wellLight), lights, "well-lights");

  bins.counts.wellFaces = faces.length;
  bins.counts.wellDoors = doors.length;
  bins.counts.wellWindows = windows.length;
  bins.counts.wellLights = lights.length;
  bins.counts.wellPickets = pickets.length;
  bins.counts.wellPosts = posts.length;
  bins.counts.wellRailRuns = topRails.length + midRails.length + bottomRails.length;
}

/* ----------------------------------------------------------------- ground */

/* Blake's own south apron: the lava-rock rubble terrace wall (no coping —
   rough stone throughout, per the photographs) and the raised lawn terrace it
   retains. This section is the SOLE OWNER of that wall; revelle.lavaWalls
   items 30-44 are the same wall shipped twice and are retired in the section's
   superseded[]. Umbrellas, racks and lamps stay absent; the plaza owns the
   ground beyond the apron. */
function buildGround(section, group, ground, bins) {
  const S = section.ground.south;
  const { colors } = section;
  const unit = new THREE.BoxGeometry(1, 1, 1);

  const L = S.lavaWall;
  const len = Math.hypot(L.b[0] - L.a[0], L.b[1] - L.a[1]);
  const ux = (L.b[0] - L.a[0]) / len;
  const uz = (L.b[1] - L.a[1]) / len;
  const rot = Math.atan2(-uz, ux);

  /* The wall is a RETAINING wall on ground that falls eastward, and its
     exposed face nearly doubles along its run: three stations measured on _67
     give 1.16 m, 1.17 m and 2.17 m. The shipped build drew one scalar, so on
     the flat drawn terrain it came out a uniform 1.35 m — the section said
     "non-uniform" in prose and the geometry did not. `profile` carries the
     measured non-uniformity ADDITIVELY onto that scalar, so the 1.35-vs-1.16
     datum disagreement stays in conflicts['lava-height'] where it was put and
     only the wall's shape changes. */
  const P = L.profile;
  const stations = P.stations.map((st) => ({ u: st.u, h: section.derivations.figures[st.figure].value }));
  const exposedAt = (t) => {
    for (let i = 1; i < stations.length; i++) {
      const a = stations[i - 1];
      const b = stations[i];
      if (t <= b.u) return a.h + ((b.h - a.h) * (t - a.u)) / (b.u - a.u);
    }
    return stations[stations.length - 1].h;
  };
  const wallHeight = (u) => L.height + (exposedAt(u / len) - stations[0].h);

  const rocks = [];
  const step = 0.55;
  for (let r = 0; r < L.rows; r++) {
    for (let u = step / 2; u < len; u += step) {
      const h = wallHeight(u);
      const rowY = ((r + 0.5) * h) / L.rows;
      const j = hash(L.seed, r, Math.round(u * 10));
      const x = L.a[0] + ux * (u + (j - 0.5) * 0.16) - uz * ((j - 0.5) * 0.1);
      const z = L.a[1] + uz * (u + (j - 0.5) * 0.16) + ux * ((j - 0.5) * 0.1);
      rocks.push({
        x, y: ground(x, z) + rowY, z,
        rot: rot + (j - 0.5) * 0.7,
        rotX: (hash(L.seed + 1, r, Math.round(u * 10)) - 0.5) * 0.35,
        scale: [step * 1.15, (h / L.rows) * 1.2, L.thickness],
        dark: j < 0.4,
      });
    }
  }
  group.add(instanced(unit, rock(colors.lavaRock), rocks.filter((x) => !x.dark)));
  group.add(instanced(unit, rock(colors.lavaRockDark), rocks.filter((x) => x.dark)));
  bins.counts.lavaRocks = rocks.length;

  /* THE RAISED TERRACE DECK IS WITHDRAWN (visual round 2). It was a flat green
     quad at one sampled height plus a 1.1 m [estimated] lift, and the terrain
     under it is flat to 0.05 m, so it drew as a lawn hovering a metre over the
     plaza with daylight under its east, west and north edges and its north
     edge cutting the colonnade columns. _67 also refutes the material: the
     ground the wall retains is the PAVED colonnade apron, not grass. The plan
     stays in the section with built:false; see conflicts['terrace-step']. */
  if (S.terrace?.built !== false) {
    const T = S.terrace;
    const tw = T.x1 - T.x0;
    const td = T.z1 - T.z0;
    const cx = (T.x0 + T.x1) / 2;
    const cz = (T.z0 + T.z1) / 2;
    const lawn = new THREE.Mesh(quad(tw, td), decal(colors.terraceLawn, "carpet"));
    lawn.position.set(cx, ground(cx, cz) + T.lift + overlayLift("carpet"), cz);
    lawn.renderOrder = OVERLAY.carpet.renderOrder;
    lawn.name = "terrace-lawn";
    group.add(lawn);
  }
}

/* -------------------------------------------------------------------- api */

/**
 * Build Blake Hall's photo-sourced detail.
 *
 * `photo` is the loaded photo-detail document; this reads only its `blake`
 * section and returns `{ group, counts }` (empty and harmless if the section
 * is missing). `surfaceAt` places everything that stands on the ground — the
 * court floor included, because the court floor IS ground; `heightAt` sets the
 * building base, matching campus-massing.js.
 */
export function createPhotoBlake(scene, { photo, heightAt, surfaceAt } = {}) {
  const group = new THREE.Group();
  group.name = "photo-blake";
  const section = photo?.blake;
  if (!section) {
    scene?.add(group);
    return { group, counts: {} };
  }
  /* This module builds the R1 section: an OPEN court with dressed well faces
     and a storey grid whose parapet is inside the height. The pre-R1 shape
     (roof.courtyard, roof.plates, grid.parapet on top of 4 x 2.8) describes a
     different building, and half-building it would ship a Blake with a hole
     where its courtyard is and no way to tell. Fail loudly on a partial
     merge instead. */
  if (!section.court || !section.system?.wellFace) {
    throw new Error("campus-photo-blake: the document still carries the pre-R1 blake section "
      + "(no court / no system.wellFace) — merge Revelle-College-Sources/merge/r1/blake.json");
  }
  const ground = surfaceAt || heightAt;
  const base = heightAt || surfaceAt;
  if (typeof ground !== "function" || typeof base !== "function") {
    throw new Error("campus-photo-blake: needs surfaceAt (or heightAt) to place on the ground");
  }

  /* Match campus-massing.js roofElevation: rim-median ground over the FULL
     measured ring (measured.ring, copied verbatim from the survey), lifted
     if that would bury a high corner. */
  const verts = section.measured.ring;
  const gs = verts.map(([x, z]) => base(x, z)).filter((v) => Number.isFinite(v)).sort((p, q) => p - q);
  const median = gs.length ? gs[Math.floor(gs.length / 2)] : 0;
  const highest = gs.length ? gs[gs.length - 1] : 0;
  const roofY = Math.max(median + section.measured.lidarHeight, highest);
  const baseY = roofY - section.measured.lidarHeight;

  const bins = {
    spandrels: [], glassFrosted: [], glassSky: [], awnings: [], fins: [], finReturns: [],
    mullions: [], pilasters: [], upperBands: [], parapets: [], drips: [], joints: [],
    recess: [], columns: [], soffits: [], signs: [], louvres: [], storefront: [],
    counts: {},
  };
  const facades = new THREE.Group();
  facades.name = "blake-facades";
  for (const f of section.facades) {
    const frame = frameOf(f, section.measured.ring);
    if (f.kind === "glazedGrid") collectGridFace(section, f, frame, baseY, ground, bins);
    else collectPanelFace(section, f, frame, baseY, ground, bins);
  }

  /* Five facade roles — spandrel, parapet, precastAmbient, column and
     windowFrosted — were byte-identical copies of ARGO's hexes, borrowed on the
     premise of one 2015 repaint programme that this section's own R1 work
     refuted (EXIF 2014-01-12/13 against Webcor's 2015-16 Argo renovation). They
     are removed from `colors`, declared in absent[], and drawn in the ONE white
     the section still carries and still declares as borrowed. `colorFallback`
     is a fallback and never a source; a role that is neither in `colors` nor in
     it is a merge error and must be loud. */
  const { colors } = section;
  const FB = section.colorFallback || {};
  const col = (role) => {
    if (colors[role] !== undefined) return colors[role];
    const to = FB[role];
    if (to && colors[to] !== undefined) return colors[to];
    throw new Error(`campus-photo-blake: colour role \`${role}\` is in neither `
      + "colors nor colorFallback — see the section's colorNote");
  };
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const plane = new THREE.PlaneGeometry(1, 1);
  const add = (geo, mat, items, name) => {
    if (!items.length) return;
    const mesh = instanced(geo, mat, items);
    if (name) mesh.name = name;
    facades.add(mesh);
  };
  add(unit, concrete(col("spandrel")), bins.spandrels);
  add(plane, glassMat(col("windowFrosted")), bins.glassFrosted);
  add(plane, glassMat(colors.windowSky), bins.glassSky);
  add(unit, painted(colors.awningFrame), bins.awnings);
  add(unit, concrete(colors.finWhite), bins.fins);
  add(unit, concrete(colors.finWhite), bins.finReturns);
  add(unit, painted(colors.mullion), bins.mullions);
  add(unit, concrete(colors.pilaster), bins.pilasters);
  add(unit, concrete(colors.precast), bins.upperBands, "survey-overshoot");
  add(unit, concrete(col("parapet")), bins.parapets, "outer-parapet");
  add(unit, concrete(colors.copingWhite), bins.drips);
  add(unit, painted(colors.panelJoint), bins.joints);
  add(plane, glassMat(colors.groundRecess), bins.recess, "ground-recess");
  add(unit, concrete(col("column")), bins.columns, "ground-columns");
  add(unit, painted(colors.mullion), bins.storefront, "storefront-mullions");
  add(unit, concrete(colors.soffit), bins.soffits);
  add(unit, painted(colors.marketGreen), bins.signs);
  add(unit, louvre(colors.louvreGrey), bins.louvres);
  group.add(facades);

  const roof = new THREE.Group();
  roof.name = "blake-roof";
  buildRoof(section, roof, roofY, bins);
  group.add(roof);

  const court = new THREE.Group();
  court.name = "blake-court";
  buildCourt(section, court, baseY, ground, bins);
  group.add(court);

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
      groundMullions: bins.storefront.length,
      columns: bins.columns.length,
      ...bins.counts,
      draws: group.children.reduce((s, g) => s + g.children.length, 0),
    },
  };
}
