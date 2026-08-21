// York Hall, from photographs and drawings — the INVENTED class.
//
// Neptune & Thomas Associates, 1966 [STRUCTURE 2024, LPA, UCSD Plan/Design/
// Build]; seismically rehabilitated 2021-24 by LPA. Four seismically separate
// structures on one comb footprint: the West bar fronting Revelle Plaza, the
// North and South wings projecting east, and the Lecture Hall between them.
// The ground storey is below grade and the courtyards sit on its roof — a
// podium the flat-slab massing cannot carve, so the deck reads as grade here.
//
// Everything hangs off the DRAWN York mass: the facilities (arcgis) ring
// campus-massing.js actually extrudes, carried verbatim in
// `measured.mass.ring`, with its LiDAR massHeights read as `measured.mass.h`.
// Every dressed datum solves on the SAME rule campus-massing.js uses
// (rim-median ground + h, lifted past a high corner), so the membrane sits on
// the visible wall and the coping sits on the visible parapet.
//
// THE MODULE CARRIES NO DIMENSION OF ITS OWN. Every metre comes from the
// section's `derivations.figures` (with its arithmetic), `estimates` (naming
// the sourced pattern it extends), `reads` (naming the frame and its
// tolerance) or `draw` (render offsets, which are not claims about the
// building). Every colour comes from `colors`, and every colour has a
// `colorSources` tier line. The one irregularity source is `hash`, seeded
// from the section's own pinned seed.
//
// THE GRID IS NO LONGER ONE GRID, and that is the honest state of it. The
// arcade is measured and the fin module is asserted, so they do not divide
// into each other; conflicts[0] is unresolved and the section now says so in
// arithmetic rather than in prose:
//
//   1. FLOOR TO FLOOR is 3.6576 m — 18 CMU courses of 8 in, counted in the
//      2008 UC Regents transparency. It then closes the building against
//      LiDAR on three faces that took no part in producing it. The retired
//      3.775 was 15.1/4 back-solved from the prism.
//   2. THE FIN MODULE is 0.9144 m (3 ft), not 1.829 — but it is ASSERTED and
//      NOT derived, and the section labels it [conflicted, asserted]: the
//      2008 frame's horizontal and vertical scales give 0.911 m and 1.320 m
//      and the CMU-coursing tie-break failed (conflicts[0]). At 1.829 the
//      whole dressed comb yields 572 fins against a sourced 805, and the
//      sourced faces alone 364 — see counts.finCensus.retired; the "477" this
//      comment used to quote reproduces as nothing. THREE fins per arcade
//      bay, not two. The fin's WIDTH and its window SLOT are measured as
//      FRACTIONS of this module (finSystem.widthOfModule = 0.0761,
//      windowWidthOfModule = 0.0805), so they survive a re-solve of it.
//   3. THE ARCADE BAY is 3.9209 m, MEASURED off the same frame and the same
//      single scale as everything else here: 268 px of column pitch against
//      250 px of storey pitch, at a 3.6576 m storey. The built west row is
//      therefore 24 columns. It was 2.6796 m — the drawn 91.1055 m west edge
//      divided by STRUCTURE's 35 columns — and that predicts a 183 px pitch
//      in a frame that measures 268-281 px, which foreshortening cannot
//      close because a facade photographed obliquely is compressed, never
//      stretched. The 35 is not deleted: it stays sourced, and the fact that
//      it cannot be reconciled with the photographed rhythm is declared.
//
// The arcade is an OPEN COVERED WALK: the heads are semicircular (both prior
// readings of the frame agree, and the lancet that shipped was an artefact of
// meeting two lathe flares in a cusp), the screen is pierced, and there is a
// shaded soffit over the recess and a glazed back wall behind it. Its FLOOR is
// the plaza's ground and York does not double-build it (boundary[]). The
// recess it can draw is 0.55 m against a declared depth of one full bay,
// because campus-massing.js extrudes the drawn ring as a SOLID prism under
// this membrane — declared in arcade.depth, conflicts[] and absent[], not
// faked, and it stops at 0.70 m proud because that is all the ground York owns
// at the north end before the plaza's belt begins.
//
// The Lecture Hall, the two courtyard end walls and the service tower are the
// three masses that used to ship as raw planes. The first two now carry this
// building's own precast storey bands as a labelled [estimated] extension;
// the third is DECLARED blank on two epochs of source and gains only the
// coping every other face terminates in.
//
// The parapet is no longer a free number either: 15.1 less four 12 ft storeys
// leaves 0.4696 m of coping, and that residual is what makes the plaza
// frontage land inside the band the terrain measures for it.
//
// York straddles a ravine, so ONE roof elevation gives MANY face heights:
// `measured.parts` records them and the skirts solve against the drawn
// surface at every footing. The south-end faces keep their [estimated]
// PATTERN and take their MEASURED heights — the label covers what a wall
// looks like, never how tall it is.
//
// What is deliberately NOT here is the section's `absent` list.
//
// Surfaces come from the procedural material library (campus-materials.js);
// deterministic throughout.
import * as THREE from "../vendor/three/three.module.min.js";
import { applyOverlayDepth, OVERLAY, overlayLift } from "./campus-overlay.js";
import { sharedMaterialLibrary } from "./campus-materials.js";

const lib = () => sharedMaterialLibrary(THREE);

const concrete = (color) => lib().get("smoothConcrete", { color });
const painted = (color) =>
  lib().get("metalPanel", { color, metalness: 0.35, roughness: 0.55 });
const metalSeam = (color) =>
  lib().get("metalPanel", { color, standingSeam: true, metalness: 0.4, roughness: 0.5 });
const glassMat = (color) => lib().get("glass", { color });
/* Split-face CMU at true block scale. `tile` is how much real wall one
   texture repeat covers and comes from the section (draw.tiles.cmuCourses x
   grid.cmuCourse); the normal scale is a material parameter, not a metre. */
const cmu = (color, w, h, tile) =>
  lib().get("brick", { color, normalScale: 0.7, repeat: [w / tile, h / tile] });
/* Agave clumps stay a plain standard material, same reasoning as Keeling's. */
const foliage = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0.0 });

/** Deterministic 0..1, seeded from the section — a reload rebuilds the same
    courtyard, and two different sections cannot share an accident. */
function hash(...ns) {
  let s = 0;
  for (let i = 0; i < ns.length; i++) s = s * 131.71 + ns[i] * 57.13 + 7.9;
  const v = Math.sin(s) * 43758.5453;
  return v - Math.floor(v);
}

/** One InstancedMesh from a list of placements (keeling convention). */
function instanced(geo, mat, items, place) {
  const mesh = new THREE.InstancedMesh(geo, mat, items.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const pos = new THREE.Vector3();
  items.forEach((it, i) => {
    const p = place(it, i);
    e.set(p.rotX || 0, p.rot || 0, p.rotZ || 0, "YXZ");
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

/**
 * A facade's own frame. The tangent is the DRAWN edge itself (galbraith
 * lesson: a frame built on the cardinal walks off a not-quite-square wall);
 * `out` only decides which perpendicular is outward. `at(u, w, y)`: u metres
 * along the face, w metres proud, y world height. A box rotated by `rot` has
 * its local +Z pointing out of the face and +X running along it.
 */
function frameOf(f) {
  const [sx, sz] = f.a;
  const [ex, ez] = f.b;
  const length = Math.hypot(ex - sx, ez - sz);
  const tx = (ex - sx) / length;
  const tz = (ez - sz) / length;
  let nx = tz;
  let nz = -tx;
  if (nx * f.out[0] + nz * f.out[1] < 0) { nx = -nx; nz = -nz; }
  return {
    id: f.id,
    length,
    rot: Math.atan2(nx, nz),
    at: (u, w, y) => ({ x: sx + tx * u + nx * w, y, z: sz + tz * u + nz * w }),
  };
}

/** Bay centres along a face, leftover split evenly at both ends. A face
    SHORTER than the module gets none: at the derived 0.9144 m fin module many
    of the drawn ring's returns are 0.2-0.3 m jogs, and forcing a bay onto one
    put a fin wider than the wall it stands on. Those faces keep their CMU
    field and their band and carry no fin, which is what a jog is. */
function bayCentres(length, module) {
  const n = Math.floor(length / module);
  if (n < 1) return [];
  const pad = (length - n * module) / 2;
  const out = [];
  for (let i = 0; i < n; i++) out.push({ i, u: pad + (i + 0.5) * module });
  return out;
}

/**
 * The fin: ONE extruded elevation profile, instanced everywhere. Spindle in
 * elevation — fuller at mid-storey — flaring into a trapezoidal haunch where
 * it lands on the band at top and bottom. The SHAPE is the inventory's
 * [estimated] read; the WIDTH is derived from STRUCTURE's sourced ~500 lb.
 * Local +Z is outward, +X along the face, y runs 0..finSystem.height.
 */
function finGeometry(F) {
  const H = F.height;
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(F.proudHaunch, 0);
  s.lineTo(F.proudMin, F.haunchHeight);
  s.lineTo(F.proudMid, H / 2);
  s.lineTo(F.proudMin, H - F.haunchHeight);
  s.lineTo(F.proudHaunch, H);
  s.lineTo(0, H);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: F.width, bevelEnabled: false });
  geo.rotateY(-Math.PI / 2);
  geo.translate(F.width / 2, 0, 0);
  return geo;
}

/**
 * The hexagonal arcade SHAFT, UNIT height: slender, narrowing from
 * `shaftBase` to `shaftWaist`. `arcade.sides` lathe segments, and the six is
 * SOURCED — STRUCTURE and LPA both call these columns hexagonal and LPA calls
 * them fan-vaulted. Built at height 1 and scaled per instance, because every
 * shaft runs from ITS OWN drawn-surface foot to the shared springing line.
 *
 * IT NO LONGER CARRIES THE FAN. Until 2026-08-21 this lathe ran on past the
 * waist into a power-law flare of radius `arcade.capital`, and TWO SUCH
 * FLARES MEET IN A CUSP — so the shipped arcade was a run of pointed lancet
 * arches, a profile no source claims and which both readings of the 2008
 * frame call round (visual round 2, MAJOR 4). A lathe is also a solid of
 * revolution, so a 1.9 m capital bulged 1.9 m into the plaza as well as along
 * the wall, and because the lathe is y-scaled per instance a circular profile
 * could not have stayed circular anyway. The fan is now the spandrel of
 * `arcadeScreen` and the head it leaves is a true semicircle of
 * `arcade.archRadius`.
 */
function shaftGeometry(A, P) {
  const pts = [];
  for (let i = 0; i <= P.columnLatheSegments; i++) {
    const t = i / P.columnLatheSegments;
    /* Straight taper base -> waist. `columnWaistFrac` still says WHERE the
       waist is: the shaft is drawn only up to the springing, so the waist sits
       at that fraction of the visible shaft and the flare above it belongs to
       the screen now. */
    const r = A.shaftBase + (A.shaftWaist - A.shaftBase)
      * Math.min(1, t / P.columnWaistFrac);
    pts.push(new THREE.Vector2(r, t));
  }
  return new THREE.LatheGeometry(pts, A.sides);
}

/**
 * The pierced arcade screen for one face: the wall the arches are cut
 * THROUGH, so the covered walk is an opening with a far side rather than a
 * row of arch-shaped niches (visual round 2, MAJOR 3). One extruded shape per
 * face, local x along the face and y in world height, extruded outward by
 * `draw.arcadeScreenDepth`.
 *
 * Each opening runs `arcade.archRadius` either side of its bay centre,
 * straight down past the lowest ground on the face, and is closed at the top
 * by a SEMICIRCULAR head springing at `capTop - archRadius` and crowning at
 * `capTop` — the underside of the fascia, which is where UCOP2008 p11 puts
 * the crown. A bay whose zone is too short to hold its own head is left
 * solid and reported rather than half-drawn.
 */
function arcadeScreen(A, bayCentres, length, bottom, capTop, top) {
  const R = A.archRadius;
  const springLine = capTop - R;
  /* The screen runs up to `top`, the head of the whole arcade zone, not to the
     arch crown — so the band above the arches IS the screen, in the same white
     precast, which is what the frame shows. Stopping it at the crown left the
     soffit block's tan end grain reading as the fascia. */
  const outer = new THREE.Shape();
  outer.moveTo(-length / 2, bottom);
  outer.lineTo(length / 2, bottom);
  outer.lineTo(length / 2, top);
  outer.lineTo(-length / 2, top);
  outer.closePath();
  let pierced = 0;
  if (springLine > bottom) {
    for (const u of bayCentres) {
      const c = u - length / 2;
      const hole = new THREE.Path();
      hole.moveTo(c - R, bottom);
      hole.lineTo(c - R, springLine);
      hole.absarc(c, springLine, R, Math.PI, 0, true);
      hole.lineTo(c + R, bottom);
      hole.closePath();
      outer.holes.push(hole);
      pierced++;
    }
  }
  return {
    geo: new THREE.ExtrudeGeometry(outer, { depth: 1, bevelEnabled: false }),
    pierced,
    springLine,
  };
}

/* -------------------------------------------------------- ground decals */

/** One drape vertex every `draw.drapeSegment` metres: ground decals follow
    the drawn terrain instead of seating flat at their rect centre (the
    galbraith lesson). `edge(z)` gives the east edge, so a bed can follow a
    wall chord instead of being an axis-aligned rectangle. */
function drapedStrip(z0, z1, xWest, edge, ground, lift, D) {
  const cz = (z0 + z1) / 2;
  const depth = z1 - z0;
  const rows = Math.max(1, Math.ceil(depth / D.drapeSegment));
  const cols = Math.max(1, Math.ceil(Math.abs(edge(cz) - xWest) / D.drapeSegment));
  const geo = new THREE.PlaneGeometry(1, depth, cols, rows);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const cx = (xWest + edge(cz)) / 2;
  const base = ground(cx, cz);
  for (let i = 0; i < pos.count; i++) {
    const z = cz + pos.getZ(i);
    const t = pos.getX(i) + 0.5;                 /* 0 at west, 1 at the wall */
    const x = xWest + (edge(z) - xWest) * t;
    pos.setX(i, x - cx);
    pos.setY(i, ground(x, z) - base);
  }
  geo.computeVertexNormals();
  const mesh = (mat) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(cx, base + lift, cz);
    m.name = "ground-decal";
    m.renderOrder = null;
    return m;
  };
  return { mesh, cx, cz, base };
}

/** The axis-aligned case, expressed through the same drape. */
function drapedQuad(r, ground, lift, D) {
  return drapedStrip(r.z0, r.z1, r.x0, () => r.x1, ground, lift, D);
}

/* Lowest drawn-terrain height along a face, sampled every `draw.segLength`
   metres at the wall. Skirts and colonnades extend DOWN to this so nothing
   hangs over the ravine — the exact failure the 2026-08-17 audit
   photographed, and the reason the per-face heights in `measured.parts` are
   an inventory rather than a set of build inputs. */
function groundMinAlong(frame, ground, D) {
  let gmin = Infinity;
  const n = Math.max(2, Math.ceil(frame.length / D.segLength));
  for (let i = 0; i <= n; i++) {
    const p = frame.at((i * frame.length) / n, D.wallOffset, 0);
    const g = ground(p.x, p.z);
    if (Number.isFinite(g) && g < gmin) gmin = g;
  }
  return Number.isFinite(gmin) ? gmin : 0;
}

/* -------------------------------------------------------- facade systems */

/**
 * The shared fin membrane on a face. Storey lines count DOWN from the
 * UNDERSIDE OF THE COPING — the drawn parapet less `grid.parapet` — so the
 * fin storeys are true 12 ft storeys and the residual is the coping rather
 * than being smeared through the whole elevation. `finStoreys` fin storeys
 * hang from there, each a split-face CMU field with a white precast band at
 * its head, THREE fins per arcade bay and ONE narrow flush metal window slot
 * PER FIN — fourteen of fourteen slots found beside the seven fins in both
 * storey bands of the section's own frame (conflicts[2]).
 * Below the fin zone the field is plain CMU carried down PAST the drawn
 * terrain — the podium storey on the court sides, the meeting-grade skirt on
 * the ravine sides. Faces with an arcade leave that zone to the arcade.
 */
function collectFinFace(section, f, frame, ctx, bins) {
  const F = section.finSystem;
  const G = section.grid;
  const D = section.draw;
  const { finTop, storeyH, ground } = ctx;
  const { rot, length } = frame;
  const storeys = f.finStoreys;
  const fins = bayCentres(length, G.finModule);
  const fieldH = F.height;
  const finBottom = finTop - storeys * storeyH;
  const hasArcade = f.system === "westFace" || f.system === "courtFace";

  /* CMU field + band per fin storey, counted from the bottom of the zone. */
  for (let lv = 0; lv < storeys; lv++) {
    const B = finBottom + lv * storeyH;
    bins.cmuPanels.push({
      tone: f.cmuTone || "cmuSunlit",
      w: length, h: fieldH,
      ...frame.at(length / 2, D.finStandoff, B + fieldH / 2),
      rot,
    });
    bins.bands.push({
      ...frame.at(length / 2, D.bandProud / 2, B + fieldH + F.band.height / 2),
      rot,
      scale: [length, F.band.height, D.bandProud + D.finStandoff],
    });
  }

  /* THE BASE BAND. The lowest fin storey used to end in mid-air: the fins
     stand proud of the wall, the CMU field behind them is a zero-thickness
     plane, and on the ravine faces `finBottom` is up to 1.6 m above the
     paving — so at every corner the stack of fin haunches read as a ragged
     serration hanging clear of the ground (visual round 2, minor). The fins
     now land on a continuous precast band, which is what they land on at
     every storey head above. The arcade faces already have one: their fascia.
     Uses no dimension the band at the head does not already use. */
  if (!hasArcade) {
    bins.bands.push({
      ...frame.at(length / 2, D.bandProud / 2, finBottom - F.band.height / 2),
      rot,
      scale: [length, F.band.height, D.bandProud + D.finStandoff],
    });
  }

  /* Below the fin zone: plain CMU down past the drawn terrain (skirt), on
     every face the arcade does not own. */
  if (!hasArcade) {
    const bottom = groundMinAlong(frame, ground, D) - D.skirtDrop;
    if (finBottom - bottom > D.skirtMinimum) {
      bins.cmuPanels.push({
        tone: f.cmuTone || "cmuSunlit",
        w: length, h: finBottom - bottom,
        ...frame.at(length / 2, D.finStandoff / 2, (finBottom + bottom) / 2),
        rot,
        /* THE SKIRT IS A SOLID, not a plane. Every other CMU field is a plane
           and that is fine because a fin storey is read face-on, but the wall
           BASE is read at corners and obliquely — and a zero-thickness plane
           seen edge-on is invisible, which left the fin membrane above it
           looking like it hung in the air (visual round 2, minor). Its depth
           is the membrane's own standoff, so the base closes flush under the
           fins instead of behind them. */
        boxed: D.finStandoff,
      });
    }
  }

  /* Fins per 3 ft module, and ONE window slot PER FIN — the frame shows a
     slot beside every fin in both storey bands, not one per arcade bay. The
     slot sits immediately beside its own fin, sharing an edge with it: that
     offset is (fin width + slot width) / 2 and uses no figure the frame did
     not measure. Their apparent separation in the photograph sweeps through
     zero across the frame, which is parallax off members standing proud of
     the slot plane, so the frame does not give a real gap to model. */
  for (let lv = 0; lv < storeys; lv++) {
    const y0 = finBottom + lv * storeyH;
    const winH = fieldH - F.windowSill - F.band.height;
    const beside = (F.width + F.windowWidth) / 2;
    for (const bay of fins) {
      bins.fins.push({ ...frame.at(bay.u, D.finStandoff, y0), rot });
      for (let s = 0; s < F.windowsPerFin; s++) {
        bins.windows.push({
          ...frame.at(bay.u + beside, D.windowStandoff, y0 + F.windowSill + winH / 2),
          rot,
          scale: [F.windowWidth, winH, 1],
        });
      }
    }
  }

  /* Corridor doors AT GRADE on the east faces (DPR: a run of single metal
     doors, not windows) — each leaf stands on the drawn surface under it. */
  if (f.doors) {
    const E = section.eastSide.doors;
    for (const bay of fins) {
      if (bay.i % E.everyBays !== 0) continue;
      const foot = frame.at(bay.u, D.doorStandoff, 0);
      const g = ground(foot.x, foot.z);
      if (!Number.isFinite(g)) continue;
      bins.doors.push({
        x: foot.x, y: g + E.height / 2, z: foot.z,
        rot,
        scale: [E.width, E.height, D.doorThickness],
      });
    }
  }

  collectCoping(section, frame, ctx, bins);
}

/**
 * THE PLAIN-WALL DRESSING — the [estimated] extension the ultra standard asks
 * for, and nothing more (visual round 2, MAJORS 1 and 2).
 *
 * The Lecture Hall's three faces and the two courtyard end walls used to ship
 * as one flat untextured plane each, from the ground to the parapet. They are
 * the largest surfaces in the east views and both courtyards look straight at
 * them, so they read as unfinished rather than as the plain white boxes their
 * sources call them. The ladder for these elevations ends at DPR 523's "plain
 * white box" and "one tall blank white end wall", which say what the wall
 * LACKS and dimension nothing — so what crosses the gap is THIS BUILDING'S OWN
 * sourced pattern and only that: the smooth white precast band at every 12 ft
 * storey line, the same element the West bar carries under each fin storey,
 * running down from the coping to the wall base. No fins, no window slots, no
 * invented openings; the only openings on these faces are DPR Image 5's own
 * louvered vents and paired glazed doors, which were already built.
 */
function collectStoreyBands(section, frame, ctx, bins, bottom) {
  const D = section.draw;
  const F = section.finSystem;
  const { finTop, storeyH } = ctx;
  const { rot, length } = frame;
  let bands = 0;
  for (let lv = 1; ; lv++) {
    const y = finTop - lv * storeyH;
    if (y - F.band.height / 2 <= bottom) break;
    /* Their own bin, because their COLOUR has to differ from the field. On a
       fin face the band is precastAmbient against split-face CMU and reads on
       hue alone; on a white box the field is precastAmbient too, so a band in
       the same hex is a 0.1 m projection with no albedo step behind it and
       disappears — which is exactly what the first attempt at this repair
       shipped. These carry `precastBright`, the same white as the coping and
       the arcade fascia, which is the relationship the West bar has: bright
       precast band, darker field. Both hexes are already in `colors` with
       their own colorSources line; no colour is invented here. */
    bins.dressBands.push({
      ...frame.at(length / 2, D.bandProud / 2, y),
      rot,
      scale: [length, F.band.height, D.bandProud + D.wallOffset],
    });
    bands++;
  }
  return bands;
}

/* The white coping IS the drawn prism's residual: `grid.parapet` metres
   between the fin zone's head and the drawn parapet, trimmed to the exact
   face length so segments mitre at the ring corners instead of overshooting. */
function collectCoping(section, frame, ctx, bins) {
  const D = section.draw;
  const h = section.grid.parapet;
  bins.copings.push({
    ...frame.at(frame.length / 2, 0, ctx.roofY - h / 2),
    rot: frame.rot,
    scale: [frame.length, h, D.copingOverhang * 2 + D.copingSeat],
  });
}

/**
 * The arcade: an OPEN COVERED WALK, not a relief.
 *
 * Four layers, outermost first, and SINCE THE ROUND-2 RE-AUDIT NO TWO OF THEM
 * SHARE A FACE PLANE. (1) the pierced screen carrying the semicircular heads
 * and, in the solid strip above their crowns, the white fascia band itself;
 * its outer face is at `draw.columnStandoff` and the hexagonal shafts are
 * inset by their own base radius so their faces sit IN that plane — which is
 * why the whole membrane's reach here is exactly columnStandoff and nothing
 * bulges into the plaza. (2) the soffit block over the recess, so what you see
 * through an arch is a shaded ceiling. (3) the sourced glazed screen and, a
 * leaf proud of it, its mullions. (4) the CMU back plane.
 *
 * The FLOOR is the plaza's ground and is deliberately not drawn here; see
 * boundary.arcadeVsMulch.
 *
 * WHY THE DEPTHS LOOK FUSSY. Round 2 shipped the soffit's front face and the
 * screen's outer face both at `columnStandoff`, and the mullions in the
 * glazing's own plane. Coplanar surfaces do not blend, they FIGHT: the
 * re-audit found 91 m of torn tan dashes across the white fascia band on the
 * building's signature elevation, and mullions rendering as broken dots. Every
 * offset below is now chosen so that its faces land between other layers'
 * faces rather than on them, and the suite asserts that as a gate.
 *
 * THE RECESS IS 0.55 m AND THE ARCADE IS 3.92 m DEEP. campus-massing.js
 * extrudes the drawn ring as a solid prism and this membrane is a skin on it,
 * so nothing set behind the ring chord can be seen at all; the whole arcade is
 * therefore drawn OUTWARD of the chord and the shortfall is declared in
 * `arcade.depth`, in conflicts[] and in absent[]. It is not closed by pushing
 * the columns into the plaza.
 */
function collectArcade(section, f, frame, ctx, bins) {
  const A = section.arcade;
  const D = section.draw;
  const C = section.colors;
  const { finTop, storeyH, ground } = ctx;
  const { rot, length } = frame;
  const zoneTop = finTop - f.finStoreys * storeyH;
  const capTop = zoneTop - A.fascia.height;
  const recess = D.columnStandoff - D.backStandoff;
  const n = Math.floor(length / A.bay + D.bayRounding);
  const pad = (length - n * A.bay) / 2;

  /* The shafts. Each runs from its own drawn-surface foot to the springing,
     and its axis is set back by its own base radius so the shaft face sits in
     the plane of the screen. */
  const springLine = capTop - A.archRadius;
  const feet = [];
  let built = 0;
  for (let i = 0; i <= n; i++) {
    const u = pad + i * A.bay;
    const p = frame.at(u, D.columnStandoff - A.shaftBase, 0);
    const g = ground(p.x, p.z);
    /* `columnMinimum` gates the arcade ZONE, as it always has — not the shaft.
       A shaft now runs foot to SPRINGING rather than foot to fascia, and the
       springing is a LEVEL line while the plaza under the west face rises
       1.3 m along its run, so the shafts are legitimately 0.65-2.0 m tall and
       a minimum applied to the shaft deleted five of them at the high end and
       left a blank stretch of screen where the arcade should be. What must
       hold is that every shaft tops out on the SAME springing, and the suite
       asserts that instead. */
    if (!Number.isFinite(g) || capTop - g < D.columnMinimum) continue;
    feet.push(u);
    if (springLine - g <= 0) continue;   /* ground above the springing: arch only */
    bins.columns.push({ x: p.x, y: g, z: p.z, rot, scale: [1, springLine - g, 1] });
    built++;
  }

  /* The screen, pierced between every pair of consecutive built shafts. */
  const bottom = groundMinAlong(frame, ground, D) - D.skirtDrop;
  const bays = [];
  for (let i = 0; i + 1 < feet.length; i++) bays.push((feet[i] + feet[i + 1]) / 2);
  const screen = arcadeScreen(A, bays, length, bottom, capTop, zoneTop);
  bins.screens.push({
    geo: screen.geo,
    ...frame.at(length / 2, D.columnStandoff - D.arcadeScreenDepth, 0),
    rot,
    depth: D.arcadeScreenDepth,
  });
  bins.counts.arcadeOpenings += screen.pierced;
  bins.counts.arcadeSolidBays += bays.length - screen.pierced;

  /* THE FASCIA IS THE SCREEN'S HEAD and is no longer a box of its own. The
     screen runs to zoneTop while its openings crown at capTop, so the solid
     strip it leaves above the arches IS the band, exactly arcade.fascia.height
     tall and in the same white precast. The separate box that used to draw it
     sat at the WALL, behind the recess, where nothing could see it — and the
     surface that then read as the fascia was the soffit block's front face,
     which is what tore (visual round 2 re-audit, the z-fighting major). The
     sourced figure still governs the band; only the redundant box is gone.
     See superseded['arcade.fascia=separate-box'].

     THE SOFFIT is the head of the recess: solid building above the arch crown,
     so its underside at capTop is the shaded ceiling you see through an
     opening. Its depth is chosen so that NEITHER of its faces lands on any
     other surface in this assembly — the front is buried half-way through the
     screen's thickness and the back half-way between the ring chord and the
     CMU back plane. Two coplanar faces at 91 m of eye-level facade is what
     this round is fixing; every layer here now has its own depth. */
  bins.soffits.push({
    ...frame.at(
      length / 2,
      (D.backStandoff / 2 + (D.columnStandoff - D.arcadeScreenDepth / 2)) / 2,
      capTop + A.fascia.height / 2
    ),
    rot,
    scale: [
      length,
      A.fascia.height,
      D.columnStandoff - D.arcadeScreenDepth / 2 - D.backStandoff / 2,
    ],
  });

  /* THE FLOOR IS NOT DRAWN HERE, and that is a boundary decision rather than
     an omission. The critic asked for a floor inside the arcade; the arcade's
     floor is the plaza's own paved ground, and it is already drawn — by the
     terrain and by the plaza section, which owns everything west of York's
     wall. A decal here would be York building ground it does not own, and it
     would be COPLANAR with york.westGround.mulch over 0.7 m of the whole 91 m
     frontage on the same overlay rung, which is a z-fight along the most
     photographed facade on the college. What makes the recess read is the
     soffit above it and the dark glazed back wall behind it, both of which
     are York's. The mulch/arcade edge itself is declared in boundary[]. */

  const backBottom = bottom;
  bins.backWalls.push({
    w: length, h: zoneTop - backBottom,
    ...frame.at(length / 2, D.backStandoff, (zoneTop + backBottom) / 2),
    rot,
  });

  /* The sourced back wall: a full-height glazed screen per bay, divided into
     `arcade.backGlazing.lightsPerBay` lights by thin white mullions
     [UCOP2008 p11]. Carried across every bay as the [estimated] extension the
     section declares; the dark entry recess the same frame shows stays
     UNBUILT because absent[] says its bay was never georeferenced. */
  const lights = A.backGlazing.lightsPerBay;
  const mullion = section.finSystem.width;
  for (const u of bays) {
    /* The glazing sits a leaf-thickness clear of the CMU back plane and the
       MULLIONS STAND A FURTHER LEAF PROUD OF IT, because they are members in
       front of the glass and not lines drawn on it. Sharing one plane is what
       made them render as dotted broken verticals instead of as the thin white
       members the 2008 frame shows (visual round 2 re-audit). */
    const p = frame.at(u, D.windowStandoff + D.doorThickness / 2, 0);
    const g = ground(p.x, p.z);
    /* THE GLAZING STOPS AT THE SPRINGING, not at the crown. Running it the
       full height of the opening meant the only thing visible through an arch
       was glass, so the recess had no internal modelling at all and read as a
       flat black hole (visual round 2 re-audit, minor). Below the springing is
       a rectangular glazed screen, which is what UCOP2008 p11 shows; the
       semicircular head above it is the vault — the screen's own white
       intrados ring, and the shaded CMU back wall behind it. Three tones and
       three orientations instead of one flat pane. */
    if (!Number.isFinite(g) || springLine - g <= 0) continue;
    const h = springLine - g;
    bins.arcadeGlass.push({
      x: p.x, y: g + h / 2, z: p.z, rot,
      /* Thin: a unit box left at depth 1 would be a metre-thick slab of glass
         reaching through the screen behind it. It is a glazed screen ON the
         back wall, so it takes the same leaf thickness as the doors. */
      scale: [2 * A.archRadius, h, D.doorThickness],
    });
    for (let k = 1; k < lights; k++) {
      const off = (k / lights - 0.5) * 2 * A.archRadius;
      const q = frame.at(u + off, D.windowStandoff + D.doorThickness, 0);
      bins.arcadeMullions.push({
        x: q.x, y: g + h / 2, z: q.z, rot,
        scale: [mullion, h, D.doorThickness],
      });
    }
  }
  return built;
}

/* ------------------------------------------------------------- the build */

function buildFacades(section, ctx, bins) {
  const D = section.draw;
  const { roofY, ground } = ctx;
  for (const f of section.facades) {
    const frame = frameOf(f);
    const gmin = () => groundMinAlong(frame, ground, D) - D.skirtDrop;
    if (f.system === "westFace") {
      bins.counts.arcadeColumns = collectArcade(section, f, frame, ctx, bins);
      collectFinFace(section, f, frame, ctx, bins);
    } else if (f.system === "courtFace") {
      bins.counts.courtColumns += collectArcade(section, f, frame, ctx, bins);
      collectFinFace(section, f, frame, ctx, bins);
    } else if (f.system === "finFace") {
      collectFinFace(section, f, frame, ctx, bins);
    } else if (f.system === "endWall") {
      /* The tall blank white end wall closing each courtyard (DPR Image 9),
         from past the court deck up to the drawn parapet. */
      const b = gmin();
      bins.endWalls.push({
        w: frame.length, h: roofY - b,
        ...frame.at(frame.length / 2, D.wallOffset, (roofY + b) / 2),
        rot: frame.rot,
      });
      bins.counts.dressedBands += collectStoreyBands(section, frame, ctx, bins, b);
      collectCoping(section, frame, ctx, bins);
    } else if (f.system === "towerBlank") {
      /* The blank service tower's walls stop at the parapet; its cap box
         (buildRoof) is the 'slightly above' rise. IT IS BLANK BY CLAIM, in two
         epochs (structures.tower.blankNote) — so it gains no fins and no
         openings. What it gains is the COPING every other face on this
         building terminates in: without it a sourced blank wall stopped dead
         at the parapet and read as an unfinished one (visual round 2,
         MAJOR 1). */
      const b = gmin();
      bins.towerWalls.push({
        w: frame.length, h: roofY - b,
        ...frame.at(frame.length / 2, D.towerWallOffset, (roofY + b) / 2),
        rot: frame.rot,
      });
      collectCoping(section, frame, ctx, bins);
    } else if (f.system === "plain") {
      /* The Lecture Hall: a plain white box, no fins, meeting the ground. */
      const b = gmin();
      bins.plainWalls.push({
        w: frame.length, h: roofY - b,
        ...frame.at(frame.length / 2, D.wallOffset, (roofY + b) / 2),
        rot: frame.rot,
      });
      bins.counts.dressedBands += collectStoreyBands(section, frame, ctx, bins, b);
      collectCoping(section, frame, ctx, bins);
      const L = section.courtyards.lecture;
      if (f.vents) {
        const sz = f.a[1];
        for (const v of L.vents) {
          const p = frame.at(Math.abs(v.z - sz), D.ventProud, 0);
          const g = ground(p.x, p.z);
          bins.vents.push({
            x: p.x, y: (Number.isFinite(g) ? g : b) + L.ventHeight, z: p.z,
            rot: frame.rot,
            scale: L.ventSize,
          });
        }
      }
      if (f.lectureDoors) {
        const sz = f.a[1];
        for (const side of [-1, 1]) {
          const p = frame.at(Math.abs(L.doorsAt - sz) + side * L.doorSize[0] / 2, D.ventProud, 0);
          const g = ground(p.x, p.z);
          bins.lectureGlass.push({
            x: p.x,
            y: (Number.isFinite(g) ? g : b) + L.doorSize[1] / 2,
            z: p.z,
            rot: frame.rot,
            scale: [L.doorSize[0], L.doorSize[1], 1],
          });
        }
      }
    }
  }
}

/* Courtyard podium furniture: hexagonal white planters with agave, ringed by
   built-in wood benches — the campus-wide Revelle hexagon, the same figure as
   the arcade's hexagonal columns and the Bonner-Mayer-York breezeways. */
function buildCourtyards(section, gr, seat) {
  const C = section.courtyards;
  const D = section.draw;
  const { colors, seed } = section;
  const sides = section.arcade.sides;

  gr.add(instanced(
    new THREE.CylinderGeometry(1, 1, 1, sides), concrete(colors.planterWhite), C.items,
    (p) => ({
      x: p.x, y: seat(p.x, p.z) + C.planterHeight / 2, z: p.z,
      scale: [C.planterRadius, C.planterHeight, C.planterRadius],
    })
  ));
  /* One bench segment per planter face, following the same hexagon. */
  const segs = [];
  C.items.forEach((p, pi) => {
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2 + Math.PI / sides;
      segs.push({
        x: p.x + Math.cos(a) * C.benchRadius,
        z: p.z + Math.sin(a) * C.benchRadius,
        rot: -a + Math.PI / 2,
        pi,
      });
    }
  });
  const side = 2 * C.benchRadius * Math.tan(Math.PI / sides) - D.benchJoint;
  gr.add(instanced(
    new THREE.BoxGeometry(side, D.benchSlab, C.benchWidth),
    lib().get("woodSlat", { color: colors.benchWood }),
    segs, (s) => ({ x: s.x, y: seat(s.x, s.z) + C.benchSeat, z: s.z, rot: s.rot })
  ));
  gr.add(instanced(
    new THREE.BoxGeometry(D.benchLegWidth, C.benchSeat - D.benchSlab, C.benchWidth * D.benchLegDepthFrac),
    concrete(colors.planterWhite), segs,
    (s) => ({ x: s.x, y: seat(s.x, s.z) + (C.benchSeat - D.benchSlab) / 2, z: s.z, rot: s.rot })
  ));
  /* Agave: a few cones per planter, jittered deterministically off the
     section's own pinned seed. */
  const agaves = [];
  C.items.forEach((p, pi) => {
    for (let k = 0; k < D.agavePerPlanter; k++) {
      /* Salts 0/1/2 are the three quantities being jittered, nothing more. */
      const j = (n) => hash(seed, pi, k, n);
      agaves.push({
        x: p.x + (j(0) - 0.5) * C.planterRadius,
        z: p.z + (j(1) - 0.5) * C.planterRadius,
        rot: j(2) * Math.PI,
        base: p,
      });
    }
  });
  gr.add(instanced(
    new THREE.ConeGeometry(D.agaveRadius, D.agaveHeight, sides), foliage(colors.agaveGreen), agaves,
    (a) => ({
      x: a.x, y: seat(a.base.x, a.base.z) + C.planterHeight + D.agaveLift, z: a.z, rot: a.rot,
    })
  ));
}

/* The west base: loop bike racks against the CMU back wall, bark-mulch beds
   whose EAST edge follows the drawn west wall chord — the shipped
   axis-aligned rectangles put ~1.05 m of mulch inside the building at the
   north end, because the wall is not axis-aligned. Trees and the DG belt west
   of x = 82 belong to the plaza landscape module; the abutment at x = 82.1 is
   stated in both sections. */
function buildWestGround(section, gr, seat, ground) {
  const W = section.westGround;
  const D = section.draw;
  const { colors } = section;
  const hoops = [];
  for (const r of W.racks) {
    for (let h = 0; h < r.hoops; h++) {
      const at = (h - (r.hoops - 1) / 2) * W.rack.spacing;
      hoops.push({ x: r.x + Math.sin(r.rot) * at, z: r.z + Math.cos(r.rot) * at, rot: r.rot });
    }
  }
  gr.add(instanced(
    new THREE.TorusGeometry(W.rack.hoopWidth / 2, D.hoopTube, D.hoopRadialSegments, D.hoopTubularSegments, Math.PI),
    painted(colors.rackBlack), hoops,
    (it) => ({ x: it.x, y: seat(it.x, it.z), z: it.z, rot: it.rot })
  ));

  const M = W.mulch;
  const [ax, az] = M.wall.a;
  const [bx, bz] = M.wall.b;
  /* The wall chord as x(z), less the clearance, capped at the widest the bed
     is allowed to get (the [estimated] widthMax). */
  const wallX = (z) => ax + ((bx - ax) * (z - az)) / (bz - az);
  const edge = (z) => Math.min(wallX(z) - D.mulchWallClear, M.xWest + M.widthMax);
  const lift = overlayLift(D.carpetRung);
  for (const band of M.bands) {
    const strip = drapedStrip(band.z0, band.z1, M.xWest, edge, ground, lift, D);
    const mesh = strip.mesh(applyOverlayDepth(
      lib().get("decomposedGranite", {
        color: colors.mulch,
        repeat: [(edge(strip.cz) - M.xWest) / D.tiles.mulch, (band.z1 - band.z0) / D.tiles.mulch],
      }), D.carpetRung));
    mesh.renderOrder = OVERLAY[D.carpetRung].renderOrder;
    gr.add(mesh);
  }
}

/* The east/ravine service side: the parking apron and the ramp with its solid
   parapet. The board-formed retaining wall is retired (see below), and
   dock/trash/yard have no source and stay unbuilt (absent[]). Every solid
   seats segment by segment on the drawn terrain — the ravine is exactly where
   a flat seat would float. */
function buildEastSide(section, gr, ground) {
  const E = section.eastSide;
  const D = section.draw;
  const { colors } = section;

  const wallSegs = (a, b, seg) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(len / seg));
    const out = [];
    for (let i = 0; i < n; i++) {
      const t0 = i / n;
      const t1 = (i + 1) / n;
      const x = a[0] + ((b[0] - a[0]) * (t0 + t1)) / 2;
      const z = a[1] + ((b[1] - a[1]) * (t0 + t1)) / 2;
      out.push({ x, z, len: len / n, rot: Math.atan2(-(b[1] - a[1]), b[0] - a[0]) });
    }
    return out;
  };

  /* The board-formed retaining wall is RETIRED (R2 arbitration P3): the drawn
     surface falls 3-7 cm/m across this whole side and the ravine break is 40 m
     further east, so there was no grade for a 2.2 m wall to retain at any
     alignment this section could defend. Better absent than wrong; what was
     looked for, and audit-york F10's derivation which is retired with it, are
     recorded in the section's absent[]. */

  const P = E.parking;
  const padLift = overlayLift(D.groundDatumRung);
  const park = drapedQuad(P, ground, padLift, D).mesh(applyOverlayDepth(
    lib().get("asphalt", {
      color: colors.asphaltPark,
      repeat: [(P.x1 - P.x0) / D.tiles.asphalt, (P.z1 - P.z0) / D.tiles.asphalt],
    }), D.groundDatumRung));
  park.renderOrder = OVERLAY[D.groundDatumRung].renderOrder;
  gr.add(park);

  const M = E.ramp;
  const carpetLift = overlayLift(D.carpetRung);
  const deck = drapedQuad(
    { x0: M.a[0] - M.width / 2, x1: M.a[0] + M.width / 2, z0: M.a[1], z1: M.b[1] },
    ground, carpetLift, D
  ).mesh(applyOverlayDepth(lib().get("smoothConcrete", { color: colors.rampConcrete }), D.carpetRung));
  deck.renderOrder = OVERLAY[D.carpetRung].renderOrder;
  gr.add(deck);
  /* The parapets stand ON the ramp deck, so they seat on the carpet rung the
     deck itself is lifted to — not on raw terrain a decal has covered. */
  const onDeck = (x, z) => ground(x, z) + carpetLift;
  for (const side of [-1, 1]) {
    const off = side * (M.width / 2 + M.parapetThickness / 2);
    gr.add(instanced(
      new THREE.BoxGeometry(1, 1, 1), concrete(colors.rampConcrete),
      wallSegs([M.a[0] + off, M.a[1]], [M.b[0] + off, M.b[1]], D.segLength),
      (s) => ({
        x: s.x, y: onDeck(s.x, s.z) + M.parapet / 2, z: s.z, rot: s.rot,
        scale: [s.len + D.segOverlap, M.parapet, M.parapetThickness],
      })
    ));
  }
}

/* The roofscape, all seated on the DRAWN parapet. ARK bb8089859p is the only
   openable image of a York roof and it replaces what the BIM axonometric used
   to supply: ONE row of tall TILTED closely-packed blades, and a GLAZED stair
   bulkhead rather than a louvered mechanical block. WHICH wing carries which
   is still the BIM's alone and is declared [estimated] in roof.wingAssignment
   and in absent[]. York West's roof is clean and flat [sourced] — coping only. */
function buildRoof(section, group, roofY, bins) {
  const { colors, roof, draw: D } = section;
  const gr = new THREE.Group();
  gr.name = "york-roof";

  const L = roof.louvreWell;
  const well = new THREE.Mesh(
    new THREE.PlaneGeometry(L.x1 - L.x0, L.z1 - L.z0).rotateX(-Math.PI / 2),
    applyOverlayDepth(lib().get("smoothConcrete", { color: colors.wellDark }), D.groundDatumRung)
  );
  well.position.set((L.x0 + L.x1) / 2, roofY + D.wellLift, (L.z0 + L.z1) / 2);
  well.renderOrder = OVERLAY[D.groundDatumRung].renderOrder;
  gr.add(well);

  const blades = [];
  for (const z of L.rows) {
    for (let x = L.x0 + D.wellMargin; x <= L.x1 - D.wellMargin; x += L.bladePitch) {
      blades.push({ x, z });
    }
  }
  /* Tilted, all leaning the same way [bb8089859p]. The box is rotated about
     its own long axis, so the row keeps its pitch and the blades lean. */
  const tilt = (L.bladeTiltDeg * Math.PI) / 180;
  gr.add(instanced(
    new THREE.BoxGeometry(L.bladeThickness, L.bladeHeight, L.bladeLength),
    painted(colors.louvreBlade), blades,
    (b) => ({
      x: b.x, y: roofY + (L.bladeHeight / 2) * Math.cos(tilt) + D.bladeLift, z: b.z,
      rotZ: tilt,
    })
  ));
  bins.counts.roofBlades = blades.length;

  const P = roof.penthouse;
  const pent = new THREE.Mesh(
    new THREE.BoxGeometry(P.size[0], P.size[1], P.size[2]),
    metalSeam(colors.penthouseGrey)
  );
  pent.position.set(P.x, roofY + P.size[1] / 2, P.z);
  pent.castShadow = pent.receiveShadow = true;
  gr.add(pent);
  /* It is GLAZED on its flanks, not louvered [bb8089859p] — the one change
     the photograph makes to what this object IS. */
  for (const side of [-1, 1]) {
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(P.size[0] - D.penthouseGlassInset, P.size[1] - D.penthouseGlassInset),
      glassMat(colors.lectureGlassDoor)
    );
    glass.position.set(P.x, roofY + P.size[1] / 2, P.z + (side * P.size[2]) / 2 - side * D.penthouseGlassProud);
    glass.rotation.y = side > 0 ? 0 : Math.PI;
    gr.add(glass);
  }

  /* The blank service/stair tower's cap, rising slightly above the drawn
     parapet on its own measured footprint. */
  const T = section.structures.tower;
  const tf = section.facades.filter((f) => f.structure === "tower");
  const xs = tf.flatMap((f) => [f.a[0], f.b[0]]);
  const zs = tf.flatMap((f) => [f.a[1], f.b[1]]);
  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(
      Math.max(...xs) - Math.min(...xs) - D.capInset, T.cap,
      Math.max(...zs) - Math.min(...zs) - D.capInset),
    concrete(colors.towerGrey)
  );
  cap.position.set(
    (Math.min(...xs) + Math.max(...xs)) / 2,
    roofY + T.cap / 2,
    (Math.min(...zs) + Math.max(...zs)) / 2
  );
  cap.castShadow = cap.receiveShadow = true;
  gr.add(cap);

  group.add(gr);
}

/* ------------------------------------------------------------------- api */

/**
 * Build York Hall's photo-sourced detail.
 *
 * `photo` is the loaded photo-detail document; this reads only its `york`
 * section and returns `{ group, counts }` (empty and harmless if the section
 * is missing). `surfaceAt` — the drawn terrain triangle — seats everything on
 * the ground; `heightAt` solves the drawn parapet exactly as
 * campus-massing.js roofElevation does — rim-median ground under
 * `measured.mass.ring` (the arcgis part campus-massing extrudes, copied
 * verbatim) plus `measured.mass.h` (its LiDAR massHeights read), lifted past
 * a high corner.
 */
export function createPhotoYork(scene, { photo, heightAt, surfaceAt } = {}) {
  const group = new THREE.Group();
  group.name = "photo-york";
  const section = photo?.york;
  if (!section) {
    scene?.add(group);
    return { group, counts: {} };
  }
  const ground = surfaceAt || heightAt;
  const baseFn = heightAt || surfaceAt;
  if (typeof ground !== "function" || typeof baseFn !== "function") {
    throw new Error("campus-photo-york: needs surfaceAt (or heightAt) to place on the ground");
  }
  /* HARD MERGE DEPENDENCY. The R1 revision replaced the whole grid this
     membrane is built on — the fin module, the arcade bay, the storey and the
     parapet are all different numbers — and moved every render offset into
     `draw`. There is no way to draw the pre-R1 section with this module, so it
     says which file is missing rather than failing somewhere downstream with
     a NaN. */
  const D = section.draw;
  if (!D) {
    throw new Error(
      "campus-photo-york: the york section has no `draw` block, so it predates the R1 revision. "
      + "Merge Revelle-College-Sources/merge/r1/york.json into docs/data/campus-photo-detail.json."
    );
  }

  /* The drawn parapet, by the massing's own rule over the DRAWN ring. */
  const mass = section.measured.mass;
  const verts = mass.ring;
  const lidarH = mass.h;
  const gs = verts.map(([x, z]) => baseFn(x, z)).filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  const median = gs.length ? gs[Math.floor(gs.length / 2)] : 0;
  const highest = gs.length ? gs[gs.length - 1] : 0;
  const roofY = Math.max(median + lidarH, highest);
  /* Storeys are the DERIVED 12 ft, and the coping is the drawn prism's own
     residual above them — not 15.1/4 smeared through the elevation. */
  const storeyH = section.grid.floorToFloor;
  const finTop = roofY - section.grid.parapet;
  const ctx = { roofY, finTop, storeyH, ground };

  const bins = {
    cmuPanels: [], bands: [], fins: [], windows: [], doors: [], copings: [],
    columns: [], backWalls: [], endWalls: [], towerWalls: [],
    plainWalls: [], vents: [], lectureGlass: [],
    screens: [], soffits: [], arcadeGlass: [], arcadeMullions: [],
    dressBands: [],
    counts: {
      arcadeColumns: 0, courtColumns: 0, roofBlades: 0,
      arcadeOpenings: 0, arcadeSolidBays: 0, dressedBands: 0,
    },
  };
  buildFacades(section, ctx, bins);

  const { colors, grid } = section;
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const plane = new THREE.PlaneGeometry(1, 1);
  const add = (geo, mat, items) => {
    if (!items.length) return;
    group.add(instanced(geo, mat, items, (it) => it));
  };

  /* CMU fields as individual meshes so each carries the block coursing at the
     derived 0.2032 m course — the per-surface repeat lever. The brick class
     tiles `draw.tiles.cmuCourses` courses square. */
  const cmuTile = D.tiles.cmuCourses * grid.cmuCourse;
  const wallMesh = (w, mat) => {
    const mesh = new THREE.Mesh(
      w.boxed ? new THREE.BoxGeometry(w.w, w.h, w.boxed) : new THREE.PlaneGeometry(w.w, w.h),
      mat
    );
    mesh.position.set(w.x, w.y, w.z);
    mesh.rotation.y = w.rot;
    mesh.castShadow = mesh.receiveShadow = true;
    return mesh;
  };
  for (const p of bins.cmuPanels) group.add(wallMesh(p, cmu(colors[p.tone], p.w, p.h, cmuTile)));
  for (const w of bins.backWalls) group.add(wallMesh(w, cmu(colors.cmuArcadeBack, w.w, w.h, cmuTile)));
  for (const w of bins.endWalls) group.add(wallMesh(w, concrete(colors.precastAmbient)));
  for (const w of bins.towerWalls) group.add(wallMesh(w, concrete(colors.towerGrey)));
  for (const w of bins.plainWalls) group.add(wallMesh(w, concrete(colors.precastAmbient)));

  add(unit, concrete(colors.precastAmbient), bins.bands);
  add(unit, concrete(colors.precastBright), bins.dressBands);
  add(unit, concrete(colors.precastBright), bins.copings);
  add(finGeometry(section.finSystem), concrete(colors.precastAmbient), bins.fins);
  /* The slots are FLUSH METAL-FRAMED glazing [DPR] and must read as dark
     slots against the tan field — the library glass is transparent and
     vanished against the CMU behind it (2026-08-17 audit, minor finding). */
  add(plane, painted(colors.windowGlass), bins.windows);
  add(unit, painted(colors.doorMetal), bins.doors);
  add(unit, metalSeam(colors.louvreBlade), bins.vents);
  add(plane, glassMat(colors.lectureGlassDoor), bins.lectureGlass);
  add(shaftGeometry(section.arcade, D), concrete(colors.precastBright), bins.columns);

  /* The arcade, outermost first. The screen is one extruded shape per face
     (its holes are per-face, so it cannot be instanced); the rest bin. */
  for (const s of bins.screens) {
    const mesh = new THREE.Mesh(s.geo, concrete(colors.precastBright));
    mesh.position.set(s.x, s.y, s.z);
    mesh.rotation.y = s.rot;
    mesh.scale.z = s.depth;
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.name = "arcade-screen";
    group.add(mesh);
  }
  add(unit, concrete(colors.archSoffit), bins.soffits);
  add(unit, painted(colors.windowGlass), bins.arcadeGlass);
  add(unit, concrete(colors.precastBright), bins.arcadeMullions);
  /* No arcade floor decal — see collectArcade and boundary.arcadeVsMulch. */

  buildRoof(section, group, roofY, bins);

  /* Everything that stands on the drawn terrain lives in one named group so
     the seating gates can find it. Solids on RAW terrain seat on surfaceAt;
     the two that stand on a decal this section draws seat on that decal's own
     overlay rung, which is the only honest second datum here. */
  const gr = new THREE.Group();
  gr.name = "york-ground";
  const seat = (x, z) => ground(x, z);
  buildCourtyards(section, gr, seat);
  buildWestGround(section, gr, seat, ground);
  buildEastSide(section, gr, ground);
  group.add(gr);

  scene?.add(group);
  return {
    group,
    counts: {
      facades: section.facades.length,
      arcadeColumns: bins.counts.arcadeColumns,
      courtColumns: bins.counts.courtColumns,
      arcadeOpenings: bins.counts.arcadeOpenings,
      arcadeSolidBays: bins.counts.arcadeSolidBays,
      arcadeGlass: bins.arcadeGlass.length,
      dressedBands: bins.counts.dressedBands,
      fins: bins.fins.length,
      finsBuilt: bins.fins.length,
      cmuPanels: bins.cmuPanels.length,
      windows: bins.windows.length,
      doors: bins.doors.length,
      bands: bins.bands.length,
      copings: bins.copings.length,
      planters: section.courtyards.items.length,
      roofBlades: bins.counts.roofBlades,
      roofY,
      finTop,
      storeyH,
      draws: group.children.length,
    },
  };
}
