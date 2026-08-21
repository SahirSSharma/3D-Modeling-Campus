// Argo Hall, from photographs — the INVENTED class.
//
// A Revelle residence hall, renovated, re-railed and repainted WHITE in
// 2015-16 (Vasquez Marshall / Webcor). NOT a Fleet hall. The only things this
// file takes from the survey are where Argo stands and how tall it is: the
// ArcGIS massing ring campus-massing.js extrudes and its LiDAR massHeights
// read. The measured massing is never moved.
//
// Five things decided the shape of this file:
//
//   1. ARGO IS A DONUT. massing[99] carries two rings and campus-massing.js
//      already extrudes the second as a hole, so the court is open, its walls
//      are 78.20 m of real elevation, and the full-height stair/lift core
//      stands into it from the west. The previous revision asserted the
//      extrusion was SOLID and painted a lid of roof-plane decals across the
//      opening. There is no lid here. There is no roof over Argo's court.
//
//   2. 18.70 m IS THE TOP OF THE COPING, NOT THE ROOF DECK. The LiDAR p98
//      lands inside a parapet band that is 9.6 % of the plate, and the
//      facade's own coping-to-soffit distance measures 5.547445 storey
//      pitches. So the deck — the membrane, the curbs, the west recess — sits
//      one parapet below the number, and the ground storey is TALLER than a
//      residential storey, which is what makes the base a height a person can
//      walk under.
//
//   3. Bays are COUNTS, not metres. 30 bays per elevation is the
//      foreshortening-immune photogrammetric fact; the module is the surveyed
//      face length divided by that count.
//
//   4. THE COURT IS A DIFFERENT SYSTEM FROM THE OUTER FACES and always was.
//      Outside: canted precast window surrounds splaying into a sawtooth.
//      Inside: painted running-bond CMU behind open-air access galleries.
//      Neither is extended into the other's territory; both are sourced.
//
//   5. THE GROUND STOREY IS NOT A CONTINUOUS COLONNADE. It is a solid
//      panelled base wall punched at the entries. The one opening built is
//      the north entry, and its extent is the measured boardwalk's, because
//      that is the only plan datum any source gives it.
//
// Colours and DIMENSIONS are both DATA. Every hex comes from the section's
// `colors` block and every metre from its `derivations.figures`,
// `estimates`, `reads` or `draw` blocks — this file carries neither. Surfaces
// come from the procedural material library (campus-materials.js);
// deterministic — the library is seeded and this file's own irregularity
// comes from `hash`.
import * as THREE from "../vendor/three/three.module.min.js";
import { applyOverlayDepth, OVERLAY, overlayLift } from "./campus-overlay.js";
import { sharedMaterialLibrary } from "./campus-materials.js";

const lib = () => sharedMaterialLibrary(THREE);

const concrete = (color) => lib().get("smoothConcrete", { color });
const masonry = (color, repeat) => lib().get("brick", { color, repeat });
const painted = (color) => lib().get("metalPanel", { color, metalness: 0.35, roughness: 0.55 });
const wood = (color, repeat) => lib().get("woodSlat", { color, repeat });
const glassMat = (color) => lib().get("glass", { color });
const foliage = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0.0 });
/* The colonnade recess is the photographed near-black VOID, not glazing: a
   fully matte plane, so the IBL/env reflections cannot lift it into the pale
   striped screen the audit failed it for. */
const matte = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 1.0, metalness: 0.0, envMapIntensity: 0.15 });

function decal(color, rung, cls = "smoothConcrete", repeat) {
  return applyOverlayDepth(lib().get(cls, { color, repeat }), rung);
}

/** Deterministic 0..1 from any integer mix — a reload rebuilds the same facade. */
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

/** Even-odd point-in-ring, used to clip the court floor to the survey hole. */
function inRing(x, z, r) {
  let ins = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, zi] = r[i];
    const [xj, zj] = r[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
}

/**
 * A face's own coordinate frame from the two MEASURED ring vertices the data
 * names. `at(u, w, y)` is u metres along the face from its start, w metres
 * proud of it (outward along `out`), y in world height. `uOf` inverts it.
 */
function frameOf(f) {
  const [ax, az] = f.a;
  const [bx, bz] = f.b;
  const nl = Math.hypot(f.out[0], f.out[1]);
  const nx = f.out[0] / nl;
  const nz = f.out[1] / nl;
  const tx = nz;
  const tz = -nx;
  let sx = ax, sz = az, ex = bx, ez = bz;
  if ((ex - sx) * tx + (ez - sz) * tz < 0) {
    sx = bx; sz = bz; ex = ax; ez = az;
  }
  const length = Math.hypot(ex - sx, ez - sz);
  return {
    id: f.id,
    length,
    rot: Math.atan2(nx, nz),
    at: (u, w, y) => ({ x: sx + tx * u + nx * w, y, z: sz + tz * u + nz * w }),
    uOf: (x, z) => (x - sx) * tx + (z - sz) * tz,
  };
}

/** The lowest drawn surface under a face, sampled along it. */
function lowestUnder(frame, ground, step) {
  let lo = Infinity;
  const n = Math.max(2, Math.ceil(frame.length / step));
  for (let i = 0; i <= n; i++) {
    const p = frame.at((i * frame.length) / n, 0, 0);
    const g = ground(p.x, p.z);
    if (Number.isFinite(g) && g < lo) lo = g;
  }
  return lo;
}

/* ------------------------------------------------------------ outer faces */

/* The standard Argo bay, applied to every outer face — the three sourced
   faces and the [estimated] west, which extends the identical module with NO
   door. Five residential storeys over ONE TALLER ground storey. */
function collectFace(ctx, f, frame, bins) {
  const { G, S, D, baseY, deckY, roofY, ground } = ctx;
  const F = G.floorToFloor;
  const module = frame.length / G.longFaceBays;
  const { rot, length } = frame;
  const winW = module * S.window.widthFrac;
  const spandrelH = F * S.bands.spandrelFrac;
  const awningH = F * S.bands.awningFrac;
  const winH = F - spandrelH - awningH;
  const firstFloor = baseY + G.groundStorey;

  for (let s = 0; s < G.finStoreys; s++) {
    const y0 = firstFloor + s * F;

    /* Continuous spandrel band under the window band of this storey. */
    bins.spandrels.push({
      ...frame.at(length / 2, D.wallOffset, y0 + spandrelH / 2),
      rot,
      scale: [length, spandrelH, D.bandThickness],
    });

    for (let i = 0; i < G.longFaceBays; i++) {
      const u = (i + 0.5) * module;

      /* Frosted / sky-reflecting window glass, recessed behind the reveals.
         The dominant read is blind-down frosted; a deterministic quarter
         reflect sky. */
      const sky = hash(3, s, i, Math.round(length)) < 0.25;
      (sky ? bins.glassSky : bins.glassFrosted).push({
        ...frame.at(u, D.glassOffset, y0 + spandrelH + awningH + winH / 2),
        rot,
        scale: [winW - D.glassInset, winH - D.glassInsetV, 1],
      });

      /* The bottom-hinged awning sash below the window, projecting outward —
         the small dark angled wedges all over the elevation. Its projection
         is the sash's own height times the sine of the opening angle. */
      bins.awnings.push({
        ...frame.at(u, S.awning.proud, y0 + spandrelH + awningH / 2),
        rot,
        rotX: S.awning.tilt,
        scale: [winW - D.sashInset, D.sashThickness, S.awning.depth],
      });

      /* The canted precast surrounds: two opposed splayed reveals per bay —
         one lit face, one shadowed face. This is the sawtooth. */
      for (const side of [-1, 1]) {
        const bin = side < 0 ? bins.revealL : bins.revealR;
        bin.push({
          ...frame.at(u + (side * winW) / 2, S.cant.depth / 2, y0 + F / 2),
          rot: rot + side * S.cant.angle,
          scale: [S.cant.thickness, F - D.revealShorten, S.cant.depth],
        });
      }
    }

    /* Pier faces on the bay boundaries. */
    for (let i = 0; i <= G.longFaceBays; i++) {
      bins.piers.push({
        ...frame.at(i * module, S.pier.proud, y0 + F / 2),
        rot,
        scale: [module - winW - D.pierClear, F, S.pier.thickness],
      });
    }

    /* The corner bracket/nub at every floor level — the stack of five small
       cantilevered blocks in webcor-argo-N17.jpg. */
    for (const u of [D.nubInset, length - D.nubInset]) {
      bins.nubs.push({
        ...frame.at(u, S.corner.nubProud, y0 + S.corner.nubSize / 2),
        rot,
        scale: [S.corner.nubSize, S.corner.nubSize, S.corner.nubSize],
      });
    }
  }

  /* Parapet band with drip cap and panel joints at every 2 bays. The band
     runs from the ROOF DECK to the coping plane, which is what makes the
     LiDAR 18.70 m the top of the coping rather than the top of the deck. */
  const P = S.parapet;
  bins.parapets.push({
    ...frame.at(length / 2, P.proud, deckY + P.height / 2),
    rot,
    scale: [length, P.height, P.thickness],
  });
  bins.drips.push({
    ...frame.at(length / 2, P.proud + D.dripOffset, roofY - P.dripCap / 2),
    rot,
    scale: [length, P.dripCap, P.thickness + D.dripSpread],
  });
  for (let i = P.jointEveryBays; i < G.longFaceBays; i += P.jointEveryBays) {
    bins.joints.push({
      ...frame.at(i * module, P.proud + P.thickness / 2 + D.jointOffset, deckY + P.height / 2),
      rot,
      scale: [D.jointWidth, P.height - D.jointShorten, D.jointDepth],
    });
  }

  /* Wider blank pilaster returns at the corners — wider than a bay, which is
     what the source says and what the shipped 1.0 m contradicted. */
  const pw = S.corner.pilasterWidth;
  for (const u of [pw / 2, length - pw / 2]) {
    bins.pilasters.push({
      ...frame.at(u, S.corner.proud, (firstFloor + roofY) / 2),
      rot,
      scale: [pw, roofY - firstFloor, S.corner.thickness],
    });
  }

  /* THE GROUND STOREY: a solid panelled base wall, set back behind the
     facade line, with large panel joints and a deep oversailing fascia —
     punched only where a photograph shows an opening. The wall extends DOWN
     to the drawn surface on Argo's sloped site, mirroring the measured
     massing's own skirt, instead of hanging in the air beside the correctly
     seated boardwalk. */
  const GR = S.ground;
  const bottom = Math.min(baseY, lowestUnder(frame, ground, 2)) - D.skirtDrop;
  const top = baseY + G.groundStorey;

  /* The one sourced opening, mapped onto this face's own u axis. */
  const CO = S.colonnade;
  let gap = null;
  if (CO && CO.face === frame.id) {
    const zf = (f.a[1] + f.b[1]) / 2;
    const ua = frame.uOf(CO.x0, zf);
    const ub = frame.uOf(CO.x1, zf);
    gap = [Math.min(ua, ub), Math.max(ua, ub)];
  }
  const runs = gap ? [[0, gap[0]], [gap[1], length]] : [[0, length]];
  for (const [u0, u1] of runs) {
    if (u1 - u0 < GR.columnSize) continue;
    bins.baseWall.push({
      ...frame.at((u0 + u1) / 2, -GR.baseWallRecess, (bottom + top) / 2),
      rot,
      scale: [u1 - u0, top - bottom, D.bandThickness],
    });
    const pitch = GR.panelJointEveryBays * module;
    for (let u = u0 + pitch; u < u1 - pitch / 2; u += pitch) {
      bins.joints.push({
        ...frame.at(u, -GR.baseWallRecess + D.bandThickness / 2 + D.jointOffset, (bottom + top) / 2),
        rot,
        scale: [D.jointWidth, top - bottom - D.jointShorten, D.jointDepth],
      });
    }
  }
  if (gap) {
    bins.recess.push({
      ...frame.at((gap[0] + gap[1]) / 2, D.wallOffset, (bottom + top) / 2),
      rot,
      scale: [gap[1] - gap[0] - D.recessInset, top - bottom, 1],
    });
    for (let k = 0; k <= CO.spans; k++) {
      const u = gap[0] + (k * (gap[1] - gap[0])) / CO.spans;
      const p = frame.at(u, GR.columnProud + GR.columnSize / 2, 0);
      const g = ground(p.x, p.z);
      const cb = Math.min(baseY, Number.isFinite(g) ? g : baseY) - D.footingDrop;
      bins.columns.push({
        x: p.x, y: (cb + top) / 2, z: p.z,
        rot,
        scale: [GR.columnSize, top - cb, GR.columnSize],
      });
    }
  }
  bins.soffits.push({
    ...frame.at(length / 2, D.soffitOffset, top - GR.fasciaDepth / 2),
    rot,
    scale: [length, GR.fasciaDepth, D.soffitThickness],
  });
}

/* ------------------------------------------------------------ court faces */

/* The 78.20 m the model has never had. Five stacked open-air access
   galleries, L2..L6, over a closed ground storey — the breezeway is sourced
   as existing and its position on the ring is not, so it is not guessed into
   place. Painted running-bond CMU behind, a deck, a downstand edge beam at
   the open edge, a code-dimensioned picket guard on top, six suite doors per
   level at the derived suite spacing, one lift-lobby door per level on the
   core's east face, and one slat screen per long wall per level. */
function collectCourtFace(ctx, f, frame, bins) {
  const { G, S, C, D, baseY, deckY, roofY, ground } = ctx;
  const F = G.floorToFloor;
  const { rot, length } = frame;
  const firstFloor = baseY + G.groundStorey;
  const proj = C.gallery.projection;
  const guardW = proj - C.gallery.beamThickness - C.guard.railSection / 2;
  /* campus-materials' brick class tiles cmuCourses courses by four units, so
     one texture tile covers cmuCourses courses each way — the York
     convention. The repeat is per-face because the faces differ in length,
     and instances of one mesh share one material, so faces are binned by it. */
  const cmuRepeat = [
    length / (D.tiles.cmuCourses * C.cmu.length),
    F / (D.tiles.cmuCourses * C.cmu.course),
  ];
  const baseRepeat = [cmuRepeat[0], G.groundStorey / (D.tiles.cmuCourses * C.cmu.course)];

  /* The ground storey of the court: the same closed base condition as
     outside, clad in the court's own masonry and skirted to the court floor. */
  const bottom = Math.min(baseY, lowestUnder(frame, ground, 2)) - D.skirtDrop;
  bins.courtBase.push({
    ...frame.at(length / 2, D.wallOffset, (bottom + firstFloor) / 2),
    rot,
    scale: [length, firstFloor - bottom, D.bandThickness],
    repeat: baseRepeat,
  });

  /* THE DECK AT INDEX s IS ALSO THE SOFFIT OF THE GALLERY BELOW, so five
     galleries need SIX deck-and-beam pairs: the pass at s = finStoreys is the
     top gallery's ceiling, at the roof deck. Only the deck and the beam run to
     it — the CMU back wall, the guard, the doors, the screens, the sconces and
     the plaques stop at finStoreys, because the extra pair is a ceiling and
     not a new gallery. */
  for (let s = 0; s <= G.finStoreys; s++) {
    const deckTop = firstFloor + s * F;

    bins.decks.push({
      ...frame.at(length / 2, proj / 2, deckTop - C.gallery.deckThickness / 2),
      rot,
      scale: [length, C.gallery.deckThickness, proj],
    });

    /* The projecting downstand edge beam — the band that reads as a stripe
       down the court in the 2008 aerial. */
    bins.beams.push({
      ...frame.at(length / 2, proj - C.gallery.beamThickness / 2, deckTop - C.gallery.beamDepth / 2),
      rot,
      scale: [length, C.gallery.beamDepth, C.gallery.beamThickness],
    });
  }

  for (let s = 0; s < G.finStoreys; s++) {
    const deckTop = firstFloor + s * F;

    /* Painted CMU back wall for the full storey. */
    bins.cmu.push({
      ...frame.at(length / 2, D.wallOffset, deckTop + F / 2),
      rot,
      scale: [length, F, D.bandThickness],
      repeat: cmuRepeat,
    });

    /* The white-painted vertical picket guard, every dimension a code clause. */
    const n = Math.floor(length / C.guard.picketPitch);
    for (let i = 0; i < n; i++) {
      bins.pickets.push({
        ...frame.at(((i + 0.5) * length) / n, guardW, deckTop + C.guard.height / 2),
        rot,
        scale: [C.guard.picketDia, C.guard.height, C.guard.picketDia],
      });
    }
    for (const h of [C.guard.height - C.guard.railSection / 2, C.guard.railMidHeight, C.guard.railLowHeight]) {
      bins.rails.push({
        ...frame.at(length / 2, guardW, deckTop + h),
        rot,
        scale: [length, C.guard.railSection, C.guard.railSection],
      });
    }

    /* Suite doors on the long walls, the lift-lobby door on the core's east
       face; sconce beside each, room-number plate beside each suite door. */
    const doors = (f.doors || 0) + (f.coreDoors || 0);
    for (let k = 0; k < doors; k++) {
      const u = length / 2 + (k - (doors - 1) / 2) * C.suiteSpacing;
      bins.doors.push({
        ...frame.at(u, D.wallOffset + D.glassOffset, deckTop + C.door.height / 2),
        rot,
        scale: [C.door.width, C.door.height, D.bandThickness],
      });
      bins.sconces.push({
        ...frame.at(u + C.door.width, D.wallOffset + C.sconce.size / 2, deckTop + C.sconce.height),
        rot,
        scale: [C.sconce.size, C.sconce.size, C.sconce.size],
      });
      if (k < (f.doors || 0)) {
        bins.plaques.push({
          ...frame.at(u - C.door.width, D.wallOffset + D.glassOffset, deckTop + C.plaque.height),
          rot,
          scale: [C.plaque.size, C.plaque.size, D.jointDepth],
        });
      }
    }

    /* One slat screen per long wall per level, midway between that wall's two
       sourced doors — the only position the sourced rhythm supplies. */
    if (f.kind === "wall") {
      for (let k = 0; k < C.screen.perWallPerLevel; k++) {
        const u = length / 2 + (k - (C.screen.perWallPerLevel - 1) / 2) * C.suiteSpacing;
        for (let i = 0; i < C.screen.slats; i++) {
          const su = u - C.screen.width / 2 + (i + 0.5) * C.screen.slatPitch;
          bins.slats.push({
            ...frame.at(su, guardW, deckTop + C.guard.height + C.screen.height / 2),
            rot,
            scale: [C.screen.slatSection, C.screen.height, C.screen.slatSection],
          });
        }
      }
    }
  }

  /* The court rim carries the same parapet and coping the outer perimeter
     does — the ortho shows the pale band on both sides. The band is binned
     separately from the outer parapets because it stands proud INTO the
     court, and the gate that keeps outer layers off the building would
     otherwise measure it against the wrong face. */
  bins.courtParapets.push({
    ...frame.at(length / 2, S.parapet.proud, deckY + S.parapet.height / 2),
    rot,
    scale: [length, S.parapet.height, S.parapet.thickness],
  });
  bins.copings.push({
    ...frame.at(length / 2, -ctx.section.roof.coping.width / 2 + ctx.section.roof.coping.overhang,
      roofY - ctx.section.roof.coping.cap / 2),
    rot,
    scale: [length, ctx.section.roof.coping.cap, ctx.section.roof.coping.width],
  });
}

/* The court floor, which the shipped section did not have at all: laid over
   ring 1 on the campus-overlay 'pad' rung above the DRAWN surface, in cells
   on the building's own bay module so it follows rolling ground instead of
   hovering over it at one datum. */
function buildCourtFloor(ctx, group) {
  const { section, C, D, ground, colors } = ctx;
  const hole = section.measured.mass.hole;
  const xs = hole.map((p) => p[0]);
  const zs = hole.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const z0 = Math.min(...zs), z1 = Math.max(...zs);
  const cell = C.floor.cell;
  const nx = Math.ceil((x1 - x0) / cell);
  const nz = Math.ceil((z1 - z0) / cell);
  const lift = overlayLift(C.floor.rung);
  const cells = [];
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const x = x0 + (i + 0.5) * cell;
      const z = z0 + (j + 0.5) * cell;
      if (!inRing(x, z, hole)) continue;
      cells.push({ x, y: ground(x, z) + lift, z });
    }
  }
  const geo = quad(cell - D.courtFloorGap, cell - D.courtFloorGap);
  const mesh = instanced(
    geo,
    decal(colors.courtPaving, C.floor.rung, "pavingConcreteUnit", [1, 1]),
    cells
  );
  mesh.renderOrder = OVERLAY[C.floor.rung].renderOrder;
  mesh.castShadow = false;
  mesh.name = "court-floor";
  group.add(mesh);
  return cells.length;
}

/* ------------------------------------------------------------------- roof */

/* What is genuinely on the roof plate, at the ROOF DECK — one parapet below
   the 18.70 m coping plane. The plate is the outer ring LESS THE COURT HOLE:
   there is no roof over Argo's court, and the lid that used to be drawn there
   is deleted with the premise it stood on. */
function buildRoof(ctx, group, bins) {
  const R = ctx.section.roof;
  const { D, colors, deckY, roofY } = ctx;
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const outer = ctx.section.measured.mass.ring;
  const hole = ctx.section.measured.mass.hole;

  /* The weathered membrane over the plate, as a shape with the court as a
     hole: procedural class, ortho-sampled colour, plus hash-scattered grey
     and pink-brown stain decals. */
  const centre = (ring) => {
    const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
    const cz = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    return [cx, cz];
  };
  const inset = (ring, by) => {
    const [cx, cz] = centre(ring);
    return ring.map(([x, z]) => {
      const d = Math.hypot(x - cx, z - cz);
      const k = d > 0 ? (d - by) / d : 1;
      return [cx + (x - cx) * k, cz + (z - cz) * k];
    });
  };
  const toPath = (pts) => {
    const p = new THREE.Path();
    pts.forEach(([x, z], i) => (i ? p.lineTo(x, -z) : p.moveTo(x, -z)));
    p.closePath();
    return p;
  };
  /* Shape coordinates are (x, -z) so that a -90 deg rotation about X lands
     them at (x, 0, z) with the face normal pointing UP. */
  const plate = inset(outer, D.plateInset);
  const shape = new THREE.Shape();
  plate.forEach(([x, z], i) => (i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)));
  shape.closePath();
  /* The court is cut out of the plate and pulled back from its rim. A RADIAL
     inset cannot do this: ring 1 is re-entrant at the core, so pushing its
     vertices away from a centroid drives the notch's corners the wrong way.
     Each vertex is moved along the sum of the two court-face normals that
     meet at it instead. Those normals point INTO the court, so the vertex
     moves AGAINST them, back under the wall — which grows the hole and pulls
     the membrane off the rim on every edge, the notch included. */
  const cf = ctx.section.court.faces;
  const grown = cf.map((f, i) => {
    const prev = cf[(i + cf.length - 1) % cf.length].out;
    const nx = prev[0] + f.out[0];
    const nz = prev[1] + f.out[1];
    const l = Math.hypot(nx, nz) || 1;
    return [f.a[0] - (nx / l) * D.plateInset, f.a[1] - (nz / l) * D.plateInset];
  });
  shape.holes.push(toPath(grown));
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  const tile = R.membrane.jointSpacing * D.tiles.membraneTilesPerJoint;
  const memb = new THREE.Mesh(geo, decal(colors.membraneWhite, "pad", "roofMembrane", [1 / tile, 1 / tile]));
  memb.position.set(0, deckY + D.membraneLift, 0);
  memb.renderOrder = OVERLAY.pad.renderOrder;
  memb.name = "roof-membrane";
  /* THE DECK IS 1.53 m INSIDE THE DRAWN MASS. campus-massing.js extrudes Argo
     flat to 18.70 m, which this section measures as the top of the parapet
     COPING; the deck is grid.parapet below it. Everything that stands on the
     deck was therefore being built inside a solid extrusion — invisible, and
     intersecting. The record stays complete and nothing is drawn; the coping
     band and the court parapet still are, because they belong at the coping
     plane. See roof.deckGate and the section's conflicts. */
  if (R.membrane.built !== false) group.add(memb);

  const xs = plate.map((p) => p[0]);
  const zs = plate.map((p) => p[1]);
  const px0 = Math.min(...xs), px1 = Math.max(...xs);
  const pz0 = Math.min(...zs), pz1 = Math.max(...zs);
  const ST = R.membrane.stains;
  const stains = [];
  for (let i = 0; R.membrane.built !== false && i < ST.count; i++) {
    const r = ST.minR + (ST.maxR - ST.minR) * hash(11, i);
    const x = px0 + r + (px1 - px0 - 2 * r) * hash(12, i);
    const z = pz0 + r + (pz1 - pz0 - 2 * r) * hash(13, i);
    /* A stain cannot fall in the court: there is no membrane under it. The
       whole ELLIPSE is tested, not just its centre — a patch whose middle is
       on the plate can still hang its rim over the rim. */
    const rz = r * (D.stainAspect + D.stainAspect * hash(15, r));
    const box = [[x - r, z - rz], [x + r, z - rz], [x - r, z + rz], [x + r, z + rz]];
    if ([[x, z], ...box].some(([sx, sz]) => inRing(sx, sz, hole))) continue;
    stains.push({ x, z, r, pink: hash(14, i) < 0.45 });
  }
  const stainGeo = new THREE.CircleGeometry(1, 10);
  stainGeo.rotateX(-Math.PI / 2);
  for (const pink of [false, true]) {
    const set = stains.filter((s) => s.pink === pink);
    if (!set.length) continue;
    const mat = applyOverlayDepth(
      new THREE.MeshStandardMaterial({
        color: pink ? colors.stainPink : colors.stainGrey,
        roughness: 0.95, metalness: 0, transparent: true, opacity: 0.75,
      }), "paint");
    const mesh = instanced(stainGeo, mat, set,
      (s) => ({ x: s.x, y: deckY + D.stainLift, z: s.z,
        scale: [s.r, 1, s.r * (D.stainAspect + D.stainAspect * hash(15, s.r))] }));
    mesh.renderOrder = OVERLAY.paint.renderOrder;
    mesh.castShadow = false;
    mesh.name = pink ? "roof-stains-pink" : "roof-stains-grey";
    group.add(mesh);
  }

  /* The coping CAP on the outer perimeter — the band standing proud at the
     top of the parapet. The court rim's caps are collected with the court
     faces, so the ring closes on both sides exactly as the ortho shows. */
  for (const f of ctx.section.facades) {
    const frame = frameOf(f);
    bins.copings.push({
      ...frame.at(frame.length / 2, -R.coping.width / 2 + R.coping.overhang, roofY - R.coping.cap / 2),
      rot: frame.rot,
      scale: [frame.length, R.coping.cap, R.coping.width],
    });
  }
  const copingMesh = instanced(unit, concrete(colors.kerbWhite), bins.copings);
  copingMesh.name = "roof-coping";
  group.add(copingMesh);

  /* The dark recess west of the court, with its pale kerb on the west and
     south edges — re-registered with everything else on this plate. */
  const V = R.westRecess;
  if (V && V.built !== false) {
    const rm = new THREE.Mesh(quad(V.x1 - V.x0, V.z1 - V.z0), decal(colors.recessShade, "carpet"));
    rm.position.set((V.x0 + V.x1) / 2, deckY + D.stainLift, (V.z0 + V.z1) / 2);
    rm.renderOrder = OVERLAY.carpet.renderOrder;
    rm.name = "roof-west-recess";
    group.add(rm);
    group.add(instanced(unit, concrete(colors.kerbWhite), [
      { x: V.x0 - V.kerbWidth / 2, z: (V.z0 + V.z1) / 2, scale: [V.kerbWidth, V.kerbHeight, V.z1 - V.z0 + 2 * V.kerbWidth] },
      { x: (V.x0 + V.x1) / 2, z: V.z1 + V.kerbWidth / 2, scale: [V.x1 - V.x0, V.kerbHeight, V.kerbWidth] },
    ], (k) => ({ ...k, y: deckY + V.kerbHeight / 2 })));
  }

  /* SQUARE mechanical curbs with dark centres — plan measured off the ortho
     and re-registered, heights [estimated].
     THE CLIP: re-registering the plate's furniture moved one curb's footprint
     partly over the court rim, and there is no roof under it any more. A curb
     that crosses the rim is trimmed BACK TO THE RIM along the axis of least
     intrusion, so the read edge that is genuinely on the plate keeps its
     measured position and only the overhang goes. Nothing may hover. */
  const clip = (c) => {
    const [sw0, sd0] = Array.isArray(c.s) ? c.s : [c.s, c.s];
    let x0 = c.x - sw0 / 2, x1 = c.x + sw0 / 2;
    let z0 = c.z - sd0 / 2, z1 = c.z + sd0 / 2;
    const over = [[x0, z0], [x1, z0], [x0, z1], [x1, z1]].some(([x, z]) => inRing(x, z, hole));
    if (!over) return [sw0, sd0, c.x, c.z];
    const hx = hole.map((p) => p[0]);
    const hz = hole.map((p) => p[1]);
    const cx0 = Math.min(...hx), cx1 = Math.max(...hx);
    const cz0 = Math.min(...hz), cz1 = Math.max(...hz);
    const cuts = [
      { by: x1 - cx0, apply: () => { x1 = cx0; } },
      { by: cx1 - x0, apply: () => { x0 = cx1; } },
      { by: z1 - cz0, apply: () => { z1 = cz0; } },
      { by: cz1 - z0, apply: () => { z0 = cz1; } },
    ].filter((k) => k.by > 0).sort((a, b) => a.by - b.by);
    if (cuts.length) cuts[0].apply();
    return [x1 - x0, z1 - z0, (x0 + x1) / 2, (z0 + z1) / 2];
  };
  const Q = R.curbs;
  const curbW = [];
  const curbsBuilt = Q.built !== false;
  const curbD = [];
  for (const raw of curbsBuilt ? Q.items : []) {
    const [sw, sd, cxx, czz] = clip(raw);
    const c = { ...raw, x: cxx, z: czz, core: Math.min(raw.core, Math.min(sw, sd)) };
    if (!c.core || c.core >= Math.min(sw, sd)) {
      curbD.push({ x: c.x, z: c.z, scale: [sw, Q.coreHeight, sd] });
      continue;
    }
    curbW.push({ x: c.x, z: c.z, scale: [sw, Q.height, sd] });
    if (c.core > 0) curbD.push({ x: c.x, z: c.z, scale: [c.core, Q.coreHeight, c.core] });
  }
  if (curbW.length) {
    group.add(instanced(unit, concrete(colors.curbWhite), curbW,
      (c) => ({ ...c, y: deckY + Q.height / 2 })));
  }
  if (curbD.length) {
    group.add(instanced(unit, painted(colors.curbDark), curbD,
      (c) => ({ ...c, y: deckY + Q.coreHeight / 2 })));
  }
}

/* ----------------------------------------------------------------- ground */

/* Argo's own north-entry apron: the post-2015 boardwalk, the corten-edged
   planter (its two trees are LiDAR/plaza-owned and stay absent) and the
   wood-slat bench. Its bench length and planter plan are both known to be
   under-sized against the photosphere and are carried unchanged and flagged
   rather than guessed at. The east frontage builds NOTHING — see absent[]. */
function buildGround(ctx, group) {
  const { section, D, colors, ground } = ctx;
  const N = section.ground.north;
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const padLift = overlayLift("pad");

  const B = N.boardwalk;
  const bw = new THREE.Mesh(
    quad(B.x1 - B.x0, B.z1 - B.z0),
    decal(colors.boardwalkWood, "pad", "woodSlat",
      [(B.x1 - B.x0) / D.tiles.plank, (B.z1 - B.z0) / D.tiles.plank])
  );
  const bcx = (B.x0 + B.x1) / 2;
  const bcz = (B.z0 + B.z1) / 2;
  bw.position.set(bcx, ground(bcx, bcz) + padLift, bcz);
  bw.renderOrder = OVERLAY.pad.renderOrder;
  bw.name = "ground-decal";
  group.add(bw);

  /* Corten planter: four walls and a soil decal, seated on the surface. */
  const P = N.planter;
  const g = ground(P.x, P.z);
  const walls = [
    { x: P.x, z: P.z - P.d / 2 + P.wall / 2, scale: [P.w, P.height, P.wall] },
    { x: P.x, z: P.z + P.d / 2 - P.wall / 2, scale: [P.w, P.height, P.wall] },
    { x: P.x - P.w / 2 + P.wall / 2, z: P.z, scale: [P.wall, P.height, P.d] },
    { x: P.x + P.w / 2 - P.wall / 2, z: P.z, scale: [P.wall, P.height, P.d] },
  ];
  group.add(instanced(unit, painted(colors.corten), walls,
    (w) => ({ ...w, y: g + P.height / 2 })));
  const soil = new THREE.Mesh(quad(P.w - 2 * P.wall, P.d - 2 * P.wall), decal(colors.planterSoil, "pad"));
  soil.position.set(P.x, g + P.height - D.soilDrop, P.z);
  soil.name = "planter-soil";
  group.add(soil);

  /* The long wood-slat bench on steel legs. */
  const S = N.bench;
  const bg = ground(S.x, S.z);
  const bench = [
    { mat: "wood", x: S.x, y: bg + S.seatHeight, z: S.z, scale: [S.length, D.benchSlab, S.width] },
    { mat: "steel", x: S.x - S.length * D.benchLegFrac, y: bg + S.seatHeight / 2, z: S.z, scale: [D.benchLeg, S.seatHeight, S.width - D.benchLegInset] },
    { mat: "steel", x: S.x + S.length * D.benchLegFrac, y: bg + S.seatHeight / 2, z: S.z, scale: [D.benchLeg, S.seatHeight, S.width - D.benchLegInset] },
  ];
  group.add(instanced(unit, wood(colors.benchWood, [S.length / D.tiles.slat, 1]),
    bench.filter((b) => b.mat === "wood")));
  group.add(instanced(unit, painted(colors.benchSteel), bench.filter((b) => b.mat === "steel")));
}

/* -------------------------------------------------------------------- api */

/**
 * Build Argo Hall's photo-sourced detail.
 *
 * `photo` is the loaded photo-detail document; this reads only its `argo`
 * section and returns `{ group, counts }` (empty and harmless if the section
 * is missing). `surfaceAt` — the height of the DRAWN terrain triangle —
 * places everything that stands on the ground, including the court floor;
 * `heightAt` sets the building base, because that is what campus-massing.js
 * used to seat the measured mass and the two must not diverge.
 */
export function createPhotoArgo(scene, { photo, heightAt, surfaceAt } = {}) {
  const group = new THREE.Group();
  group.name = "photo-argo";
  const section = photo?.argo;
  if (!section) {
    scene?.add(group);
    return { group, counts: {} };
  }
  const ground = surfaceAt || heightAt;
  const base = heightAt || surfaceAt;
  if (typeof ground !== "function" || typeof base !== "function") {
    throw new Error("campus-photo-argo: needs surfaceAt (or heightAt) to place on the ground");
  }
  /* PRE-MERGE GUARD. This builder is the R1 revision: it draws the court's
     eight elevations, seats the roof on a deck one parapet below the coping
     plane, and takes every metre out of the section's own derivation blocks.
     A section that predates the revision has none of those, and half a
     building drawn off a half-section would be the silent failure this repo
     keeps failing on. Build NOTHING and say which keys are missing, so the
     merge cannot half-land unnoticed. */
  const missing = ["court", "draw", "estimates", "reads"].filter((k) => !section[k]);
  if (section.grid?.groundStorey === undefined) missing.push("grid.groundStorey");
  if (missing.length) {
    scene?.add(group);
    return { group, counts: { pendingMerge: missing.join(",") } };
  }

  /* Match campus-massing.js roofElevation over the DRAWN mass: rim-median
     ground under measured.mass.ring (the arcgis outer ring campus-massing
     extrudes, copied verbatim) plus measured.mass.h (its LiDAR massHeights
     read), lifted if that would bury a high corner. */
  const mass = section.measured.mass;
  let verts = mass?.ring ?? section.measured.ring;
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
  const lidarH = mass?.h ?? section.measured.lidarHeight;
  const gs = verts.map(([x, z]) => base(x, z)).filter((v) => Number.isFinite(v)).sort((p, q) => p - q);
  const median = gs.length ? gs[Math.floor(gs.length / 2)] : 0;
  const highest = gs.length ? gs[gs.length - 1] : 0;
  const roofY = Math.max(median + lidarH, highest);
  const baseY = roofY - lidarH;

  const G = section.grid;
  const ctx = {
    section, G, S: section.system, C: section.court, D: section.draw,
    colors: section.colors, ground, baseY, roofY,
    /* THE ROOF DECK, one parapet below the coping plane the LiDAR measured. */
    deckY: baseY + G.groundStorey + G.finStoreys * G.floorToFloor,
  };

  const bins = {
    spandrels: [], glassFrosted: [], glassSky: [], awnings: [], revealL: [], revealR: [],
    piers: [], nubs: [], parapets: [], drips: [], joints: [], pilasters: [],
    recess: [], columns: [], soffits: [], baseWall: [], copings: [],
    courtParapets: [], courtBase: [], cmu: [], decks: [], beams: [], pickets: [], rails: [],
    doors: [], sconces: [], plaques: [], slats: [],
  };
  for (const f of section.facades) collectFace(ctx, f, frameOf(f), bins);
  for (const f of section.court.faces) collectCourtFace(ctx, f, frameOf(f), bins);

  const { colors } = section;
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const plane = new THREE.PlaneGeometry(1, 1);
  const facades = new THREE.Group();
  facades.name = "argo-facades";
  const add = (geo, mat, items, name, into = facades) => {
    if (!items.length) return;
    const mesh = instanced(geo, mat, items);
    if (name) mesh.name = name;
    into.add(mesh);
  };
  add(unit, concrete(colors.spandrel), bins.spandrels);
  add(plane, glassMat(colors.windowFrosted), bins.glassFrosted);
  add(plane, glassMat(colors.windowSky), bins.glassSky);
  add(unit, painted(colors.awningFrame), bins.awnings);
  add(unit, concrete(colors.revealWhite), bins.revealL);
  add(unit, concrete(colors.revealWhite), bins.revealR);
  add(unit, concrete(colors.precast), bins.piers);
  add(unit, concrete(colors.precast), bins.nubs);
  add(unit, concrete(colors.parapet), bins.parapets);
  add(unit, concrete(colors.copingWhite), bins.drips);
  add(unit, painted(colors.panelJoint), bins.joints);
  add(unit, concrete(colors.precast), bins.pilasters);
  add(unit, concrete(colors.baseWall), bins.baseWall, "ground-base-wall");
  add(plane, matte(colors.groundRecess), bins.recess, "ground-recess");
  add(unit, concrete(colors.column), bins.columns, "ground-columns");
  add(unit, concrete(colors.soffit), bins.soffits);
  group.add(facades);

  const court = new THREE.Group();
  court.name = "argo-court";
  /* Instances of one mesh share one material, so the masonry is binned by its
     own texture repeat: the court faces differ in length and a single repeat
     would stretch the coursing on all but one of them. */
  const byRepeat = (items, name) => {
    const groups = new Map();
    for (const it of items) {
      const k = it.repeat.join();
      if (!groups.has(k)) groups.set(k, { repeat: it.repeat, items: [] });
      groups.get(k).items.push(it);
    }
    let n = 0;
    for (const g of groups.values()) add(unit, masonry(colors.cmuWhite, g.repeat), g.items, `${name}-${n++}`, court);
  };
  byRepeat(bins.cmu, "court-cmu");
  byRepeat(bins.courtBase, "court-base");
  add(unit, concrete(colors.parapet), bins.courtParapets, "court-parapet", court);
  add(unit, concrete(colors.gallerySoffit), bins.decks, "court-decks", court);
  add(unit, concrete(colors.beamWhite), bins.beams, "court-beams", court);
  add(unit, painted(colors.guardWhite), bins.pickets, "court-pickets", court);
  add(unit, painted(colors.guardWhite), bins.rails, "court-rails", court);
  add(unit, painted(colors.doorBronze), bins.doors, "court-doors", court);
  add(unit, painted(colors.sconceWhite), bins.sconces, "court-sconces", court);
  add(unit, painted(colors.plaqueTan), bins.plaques, "court-plaques", court);
  add(unit, painted(colors.screenWhite), bins.slats, "court-screens", court);
  const T = section.court.tree;
  court.add(instanced(
    new THREE.ConeGeometry(1, 1, 7),
    foliage(colors.treeGreen),
    [{ x: T.x, y: ground(T.x, T.z) + overlayLift(section.court.floor.rung) + T.height / 2, z: T.z,
      scale: [T.radius, T.height, T.radius] }]
  ));
  const floorCells = buildCourtFloor(ctx, court);
  group.add(court);

  const roof = new THREE.Group();
  roof.name = "argo-roof";
  buildRoof(ctx, roof, bins);
  group.add(roof);

  const groundGroup = new THREE.Group();
  groundGroup.name = "argo-ground";
  buildGround(ctx, groundGroup);
  group.add(groundGroup);

  scene?.add(group);
  return {
    group,
    counts: {
      facades: section.facades.length,
      courtFaces: section.court.faces.length,
      bays: G.longFaceBays,
      windows: bins.glassFrosted.length + bins.glassSky.length,
      reveals: bins.revealL.length + bins.revealR.length,
      awnings: bins.awnings.length,
      piers: bins.piers.length,
      nubs: bins.nubs.length,
      galleries: G.finStoreys,
      galleryDecks: bins.decks.length,
      suiteDoors: bins.plaques.length,
      coreDoors: bins.doors.length - bins.plaques.length,
      sconces: bins.sconces.length,
      plaques: bins.plaques.length,
      screens: bins.slats.length / section.court.screen.slats,
      screenSlats: bins.slats.length,
      pickets: bins.pickets.length,
      courtFloorCells: floorCells,
      columns: bins.columns.length,
      curbs: section.roof.curbs.built === false ? 0 : section.roof.curbs.items.length,
      draws: group.children.reduce((s, g) => s + g.children.length, 0),
      deckY: ctx.deckY,
      roofY,
    },
  };
}
