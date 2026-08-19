// Eighth College's SITEWORKS, from photographs — the INVENTED class.
//
// HKS + EYRC + Kitchell, landscape by SWA Group, 2023-24. This file builds the
// small repeated kit that fills the space between the five towers: one
// pedestrian post-top luminaire, a second street luminaire on the vehicular
// edge, a bollard light, a picket guard, a handrail, staple bike hoops, two
// planter families, the applied signage, a wayfinding totem, a blue-light
// tower, a dual-bay waste receptacle, a stainless bollard rank, the
// detectable-warning tiles, wall sconces, and the two basketball standards.
//
// SIX THINGS DECIDED THE SHAPE OF THIS FILE.
//
//   0. THE GROUND HERE IS NOT THE TERRAIN. campus-eighth.js repaints every one
//      of campus-eighth.json's ground features — the same 36 polygons this
//      section anchors to — as a lifted decal on campus-overlay.js's `pad`
//      rung, +0.09 m. Anything seated on the raw `surfaceAt` therefore stands
//      NINE CENTIMETRES UNDER the paving a viewer can see: measured over all
//      86 fixture positions the median burial was 0.090 m and the worst
//      0.237 m, which swallowed most of the 0.15 m guard kerb. So every
//      fixture in this file seats on `surfaceAt + overlayLift(rung)` with the
//      rung read from `section.groundDatum`, never on a number written here.
//      The one exception is the detectable-warning tile, which is itself a
//      decal LYING ON that paving and so climbs one rung further — on `pad` it
//      shared its host walkway's exact lift, renderOrder and polygon offset,
//      which is a guaranteed z-fight.
//
//   1. THE 2014 LiDAR IS BLIND HERE. Eighth was built on a demolished parking
//      lot; campus-lidar.json has no massHeights entry for any Eighth mass and
//      campus-massing.js records that LiDAR "measures Sankofa at parking-lot
//      height". So the argument that withholds every stair, terrace, retaining
//      wall and handrail in campus-eighth.js and campus-eighth-furniture.js —
//      "the LiDAR under the courtyard is smooth, so there is no built grade" —
//      is VOID over this college. It describes ground that no longer exists.
//      EYRC phf03 photographs a full 14-riser exterior flight with both
//      stainless rails; swa-14, swa-16 and phf19 photograph three more. The
//      guard and the handrail therefore ship. What does NOT ship is a rail on
//      a flight this module does not own: every run here is a RAMP or a graded
//      walk, seated post by post and picket by picket on `surfaceAt`, so it
//      follows the drawn ground instead of hanging over a stair that has not
//      been built (see the section's `absent`).
//
//   2. EVERY POSITION IS [estimated], AND THAT IS NOT THE SAME AS GUESSED.
//      No photograph in the 2024-25 published set is registered to the ArcGIS
//      survey, so no fixture here has a measured world coordinate. What the
//      section carries instead is a declared geometric RULE per system, run
//      over rings copied verbatim out of campus-eighth.json and
//      campus-arcgis.json: L1 poles at 20 m along a surveyed paved polygon's
//      perimeter, held 1.2 m inside it; bollard lights exactly where a
//      surveyed bed meets a surveyed walk, which is the placement rule every
//      photograph shows; waste pairs on paving with their back to a bed;
//      guard and handrail runs fitted to the principal axis of the surveyed
//      polygon that contains them. The survey beats the photograph on ground
//      extents, always — and it disqualifies things. Surveyed walkway-3238 has
//      15 of its 24 vertices INSIDE Pulse Tower's massing ring, so it is an
//      undercroft and carries nothing; surveyed walkway-3255 is entirely
//      inside the Podemos academic ring; surveyed walkway-2989 is entirely
//      inside Azad's campus-3d footprint, which is a DIFFERENT polygon from
//      Azad's ArcGIS massing ring and is also drawn. Both footprint sets are
//      in the rejection test, because both are on screen.
//
//   3. THE CLIPS ARE LOAD-BEARING, NOT DECORATION. The surveyed basketball
//      court is a paved polygon, so the L1 rule generates poles standing on
//      the playing surface. swa-16 is a clean sunlit photograph of that whole
//      court with nothing on it. Six poles are therefore CLIPPED — the module
//      drops them before it builds, and the test asserts both that the section
//      declares them and that no instance survives inside the rectangle. Four
//      more clips keep this module out of ground that is already someone
//      else's: the two picket bridges the `eighth` section ships WITH their
//      own guards, its three amphitheatre tiers, and the Meditation Pavilion,
//      whose plate is now eighthgathering's measured 13.5 x 7.3 m. (The east
//      standard's setback used to be squeezed to 0.60 m to miss those tiers;
//      arbitration measured the standard properly — the pole stands 0.20 m
//      OUTSIDE the baseline with a 1.42 m arm, which clears the tiers by
//      0.7 m, so both standards are symmetric and the fudge is gone.)
//
//   4. THE SHIPPED `eighth` SECTION IS WRONG IN FIVE PLACES AND THIS FILE DOES
//      NOT SILENTLY FIX IT. The pole colour #2b2b2e is a backlit silhouette of
//      an object that reads #b2b6b8 in the one sunlit sky-free frame. The bike
//      hoops are built on 25 mm tube, which is a sign post. The court key and
//      trident hexes are shadowed Apple reads against a 2025 photograph in
//      direct sunlight that says GOLD. The four "planter-cube"s are the wrong
//      HEIGHT and the wrong COLOUR — round one read them at 9x as a continuous
//      seat wall and asked for their deletion, and arbitration overturned that:
//      phf22 does resolve a pale precast box, 1.15 m tall and #a49f8b sunlit,
//      and eighthramble owns it. Every one of those is named in the section's
//      `supersedes` with the frame that overturns it; the main session performs
//      the removal and this file never edits another module's data.
//
//   5. WHERE THIS INVENTED KIT MEETS MEASURED WORK, THE MEASURED WORK WINS AND
//      THIS SECTION MOVES. Round one put bike hoops through the shipped
//      picnic tables, a waste pair and a handrail through campus-eighth-
//      furniture.js's two-frame-confirmed plaza objects, and a guard run
//      through the BBQ canopy. Every collision is repaired in the DATA by the
//      smallest deterministic displacement that clears (see the section's
//      `measuredObstacles`), and the test re-runs the overlap against those
//      two files rather than against a copy kept here.
//
//   6. TWO THINGS THIS FILE USED TO DO AND NO LONGER DOES. It built the orange
//      CALISTHENICS RIG beside the court — and so did eighthcourtyards, at a
//      different size 4.9 m away, with nothing arbitrating the pair. The rig is
//      campus-photo-pulsefitness.js's outright, the geometry here is DELETED
//      rather than left behind a flag, and the section records it in `absent`
//      the way absent[14] records the amphitheatre tiers. The court's own
//      hardware stays. It also carried numbers the section had never seen: a
//      0.07 m court brace, a 0.45 m rung pitch, two fractions of the arm, a
//      shade-crown top radius, an L2 head split and a base-plate thickness.
//      Every one is now derived and lives in the section, or is gone with the
//      rig — a figure this module needs is a figure the section states.
//
// Colours are DATA — every hex comes from the `colors` block of the photo
// document's `eighthsiteworks` section, and every role has a per-role
// provenance line in `colorSources`. Repeats are InstancedMesh: the whole kit
// is 4,326 instances in 70 draws, and the guardrail pickets alone are 1,023 of
// them, in one draw per finish.
//
// Every DIMENSION in the section is now gated by the arithmetic its own
// derivation states, not merely by a provenance sentence — a mutation pass had
// shipped a 3.5 m "bollard light" and a 12 m dustbin through a green suite. The
// consequence for this file is that a number the section derives must LIVE in
// the section: the board's 6 in bottom-below-rim used to be a bare 0.15 inside
// buildCourt while `standard.rise` was derived from it, so the two could drift
// apart with nothing to say so. It is data now.
//
// Surfaces come from the procedural material library (campus-materials.js):
// the colours stay this section's sourced hexes, the library only supplies
// microstructure. Deterministic: the library is seeded and this file's own
// variation comes from `hash` off the section's pinned seed. Nothing in the
// chain reads a clock or a random source, and the test greps for both.
import * as THREE from "../vendor/three/three.module.min.js";
import { applyOverlayDepth, OVERLAY, overlayLift } from "./campus-overlay.js";
import { sharedMaterialLibrary } from "./campus-materials.js";

const lib = () => sharedMaterialLibrary(THREE);

const concrete = (color) => lib().get("smoothConcrete", { color });
const boardformed = (color) => lib().get("boardFormedConcrete", { color, normalScale: 0.6 });
/* Galvanised and stainless: bright, low-roughness, genuinely metal. */
const galv = (color) => lib().get("metalPanel", { color, metalness: 0.75, roughness: 0.38 });
/* Painted steel and painted alloy — poles, bollards, receptacles, totems. */
const painted = (color) => lib().get("metalPanel", { color, metalness: 0.35, roughness: 0.55 });
/* Applied dimensional letters and vinyl-faced lenses: flat, barely metallic. */
const applied = (color) => lib().get("metalPanel", { color, metalness: 0.1, roughness: 0.7 });
const glassMat = (color) => lib().get("glass", { color });

/** Deterministic 0..1 from any integer mix — a reload rebuilds the same site. */
function hash(...ns) {
  let s = 0;
  for (let i = 0; i < ns.length; i++) s = s * 131.71 + ns[i] * 57.13 + 7.9;
  const v = Math.sin(s) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * One InstancedMesh from a list of placements. `place` returns
 * `{ x, y, z, rot?, rotX?, rotZ?, scale? }`; rotation composes YXZ, so `rot`
 * (about Y) is applied first and `rotX` tilts in the frame it leaves behind.
 */
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

/** A cylinder whose axis lies along local +Z, so `rot` alone aims it in plan. */
function tube(radius, length, seg = 8) {
  const g = new THREE.CylinderGeometry(radius, radius, length, seg, 1);
  g.rotateX(Math.PI / 2);
  return g;
}

/* --------------------------------------------------------------- clipping */

/** True when (x, z) falls inside any declared clip rectangle. */
function clipped(section, x, z) {
  return (section.clips || []).some(
    (c) => x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1
  );
}

/* ------------------------------------------------------------- run frames */

/**
 * A guard/handrail run resampled at `step` metres, every station carrying the
 * height of the DRAWN terrain under it. Nothing on a run is placed at a single
 * datum: the kerb, the rails and every picket seat on their own station, so a
 * run crossing a slope follows it instead of hanging off one end.
 */
function stations(run, step, ground) {
  const [ax, az] = run.a;
  const [bx, bz] = run.b;
  const len = Math.hypot(bx - ax, bz - az);
  const n = Math.max(1, Math.round(len / step));
  const rot = Math.atan2(bx - ax, bz - az);
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = ax + (bx - ax) * t;
    const z = az + (bz - az) * t;
    out.push({ x, z, g: ground(x, z), t, rot });
  }
  return { len, rot, points: out, seg: len / n };
}

/* ------------------------------------------------------------- L1 luminaire */

function buildL1(section, group, ground, counts) {
  const C = section.colors;
  const L = section.systems.l1Pole;
  const items = L.items.filter((it) => !clipped(section, it.x, it.z));
  counts.l1Poles = items.length;
  counts.l1PolesClipped = L.items.length - items.length;
  if (!items.length) return;

  const pedR = L.pedestal.diameter / 2;
  const shadeR = L.shade.diameter / 2;
  /* The declared assembly, grade upward: the lower concrete drum, the second
     concrete step on top of it (swa-14 at 7x reads TWO, and the 0.56 m step is
     what the other sections were calling "the base"), base cover, shaft,
     conical fitter, collar, V-yoke, shade rim, crown at the solved 5.75 m. */
  const pedTop = L.pedestal.proud + L.pedestalStep.proud;
  const fitterTop = L.shaft.top;
  const collarTop = fitterTop + L.collar.height;
  const rimY = collarTop + L.yoke.height;

  const at = (it) => ground(it.x, it.z);
  /* The yoke's plan direction is unresolved per instance; the pinned seed
     fixes it so two loads produce the same matrices. */
  const yaw = (it, i) => hash(section.seed, i, it.x, it.z) * Math.PI * 2;

  group.add(instanced(
    new THREE.CylinderGeometry(pedR - L.pedestal.chamfer, pedR, L.pedestal.proud, 16),
    boardformed(C.l1Pedestal), items,
    (it) => ({ x: it.x, y: at(it) + L.pedestal.proud / 2, z: it.z })));

  group.add(instanced(
    new THREE.CylinderGeometry(L.pedestalStep.diameter / 2, L.pedestalStep.diameter / 2, L.pedestalStep.proud, 16),
    boardformed(C.l1Pedestal), items,
    (it) => ({ x: it.x, y: at(it) + L.pedestal.proud + L.pedestalStep.proud / 2, z: it.z })));

  group.add(instanced(
    new THREE.CylinderGeometry(L.baseCover.diameter / 2, L.baseCover.diameter / 2, L.baseCover.height, 12),
    painted(C.l1Finish), items,
    (it) => ({ x: it.x, y: at(it) + pedTop + L.baseCover.height / 2, z: it.z })));

  group.add(instanced(
    new THREE.CylinderGeometry(L.shaft.diameter / 2, L.shaft.diameter / 2, fitterTop - L.fitter.height - pedTop, 10),
    painted(C.l1Finish), items,
    (it) => ({ x: it.x, y: at(it) + (pedTop + fitterTop - L.fitter.height) / 2, z: it.z })));

  group.add(instanced(
    new THREE.CylinderGeometry(L.fitter.upper / 2, L.fitter.lower / 2, L.fitter.height, 10),
    painted(C.l1Finish), items,
    (it) => ({ x: it.x, y: at(it) + fitterTop - L.fitter.height / 2, z: it.z })));

  group.add(instanced(
    new THREE.CylinderGeometry(L.yoke.chordAtCollar / 2, L.fitter.upper / 2, L.collar.height, 10),
    painted(C.l1Finish), items,
    (it) => ({ x: it.x, y: at(it) + fitterTop + L.collar.height / 2, z: it.z })));

  /* The signature: TWO flat blades splaying up and out from the collar to the
     shade rim, leaving a triangular void you see sky through. A closed cone
     here is the single thing that would make this fixture read as the wrong
     product, so the blades are real boxes with real air between them. */
  const bladeRun = Math.hypot(shadeR - L.yoke.chordAtCollar / 2, L.yoke.height);
  const bladeTilt = Math.atan2(shadeR - L.yoke.chordAtCollar / 2, L.yoke.height);
  const blades = [];
  items.forEach((it, i) => {
    for (let b = 0; b < L.yoke.blades; b++) {
      const a = yaw(it, i) + (b * Math.PI * 2) / L.yoke.blades;
      const reach = (shadeR + L.yoke.chordAtCollar / 2) / 2 - L.yoke.chordAtCollar / 2;
      blades.push({
        x: it.x + Math.sin(a) * reach,
        y: at(it) + collarTop + L.yoke.height / 2,
        z: it.z + Math.cos(a) * reach,
        rot: a,
        rotX: bladeTilt,
        scale: [L.yoke.chordAtRim, bladeRun, L.yoke.thickness],
      });
    }
  });
  counts.l1YokeBlades = blades.length;
  group.add(instanced(new THREE.BoxGeometry(1, 1, 1), painted(C.l1Finish), blades, (it) => it));

  /* The lily-pad shade: a thin rim ring under a shallow crown. The crown is a
     SPHERICAL CAP and carries no dimension of its own — its base radius is the
     measured shade radius and its rise the measured dome rise, and those two
     fix the sphere and the half-angle outright (see shade.crownNote). It used
     to be a truncated cone with a `shadeR * 0.35` top, a fraction that lived
     here and appeared nowhere in the section. */
  group.add(instanced(
    new THREE.CylinderGeometry(shadeR, shadeR, L.shade.rimEdge, 24),
    painted(C.l1Finish), items,
    (it) => ({ x: it.x, y: at(it) + rimY + L.shade.rimEdge / 2, z: it.z })));
  const crownR = (shadeR * shadeR + L.shade.domeRise * L.shade.domeRise) / (2 * L.shade.domeRise);
  group.add(instanced(
    new THREE.SphereGeometry(crownR, 24, 6, 0, Math.PI * 2, 0, Math.asin(shadeR / crownR)),
    painted(C.l1Finish), items,
    (it) => ({
      x: it.x, z: it.z,
      y: at(it) + rimY + L.shade.rimEdge + L.shade.domeRise - crownR,
    })));

  /* Downlight only: the emitting face is a flat disc inset under the shade. */
  group.add(instanced(
    new THREE.CylinderGeometry(L.diffuser.diameter / 2, L.diffuser.diameter / 2, L.diffuser.thickness, 20),
    applied(C.l1Diffuser), items,
    (it) => ({ x: it.x, y: at(it) + rimY - L.diffuser.below - L.diffuser.thickness / 2, z: it.z })));
}

/* ------------------------------------------------------------- L2 luminaire */

function buildL2(section, group, ground, counts) {
  const C = section.colors;
  const L = section.systems.l2Pole;
  const items = L.items.filter((it) => !clipped(section, it.x, it.z));
  counts.l2Poles = items.length;
  if (!items.length) return;
  const at = (it) => ground(it.x, it.z);
  const armY = L.height - L.pole.stubAboveArm;

  group.add(instanced(new THREE.BoxGeometry(L.pole.square, L.height, L.pole.square),
    painted(C.l2Pole), items,
    (it) => ({ x: it.x, y: at(it) + L.height / 2, z: it.z, rot: it.rotY })));

  /* A short side arm dropping to a flat wedge-profile blade head. */
  group.add(instanced(new THREE.BoxGeometry(L.arm.section, L.arm.section, L.arm.projection),
    painted(C.l2Pole), items, (it) => ({
      x: it.x + Math.sin(it.rotY) * (L.pole.square + L.arm.projection) / 2,
      y: at(it) + armY - L.arm.drop / 2,
      z: it.z + Math.cos(it.rotY) * (L.pole.square + L.arm.projection) / 2,
      rot: it.rotY,
    })));

  const headOut = L.pole.square / 2 + L.arm.projection + L.head.length / 2;
  /* Two boxes stepping a linear wedge. The break is the section's derived
     `rootFraction`, which is 1/2 for any linear taper — the value that makes
     the two-box silhouette equal the wedge's — not the bare 0.42 that used to
     live here. */
  const rootLen = L.head.length * L.head.rootFraction;
  const noseLen = L.head.length - rootLen;
  group.add(instanced(new THREE.BoxGeometry(L.head.width, L.head.thickAtArm, rootLen),
    painted(C.l2Pole), items, (it) => ({
      x: it.x + Math.sin(it.rotY) * (headOut - noseLen / 2),
      y: at(it) + armY - L.arm.drop - L.head.thickAtArm / 2,
      z: it.z + Math.cos(it.rotY) * (headOut - noseLen / 2),
      rot: it.rotY,
    })));
  group.add(instanced(new THREE.BoxGeometry(L.head.width, L.head.thickAtNose, noseLen),
    painted(C.l2Pole), items, (it) => ({
      x: it.x + Math.sin(it.rotY) * (headOut + rootLen / 2),
      y: at(it) + armY - L.arm.drop - L.head.thickAtNose / 2,
      z: it.z + Math.cos(it.rotY) * (headOut + rootLen / 2),
      rot: it.rotY,
    })));
}

/* --------------------------------------------------------------- bollards */

function buildBollardLights(section, group, ground, counts) {
  const C = section.colors;
  const B = section.systems.bollardLight;
  const items = B.items.filter((it) => !clipped(section, it.x, it.z));
  counts.bollardLights = items.length;
  if (!items.length) return;
  const bodyH = B.height - B.cap.thickness;
  const at = (it) => ground(it.x, it.z);

  group.add(instanced(new THREE.BoxGeometry(B.body.square, bodyH, B.body.square),
    painted(C.bollardBody), items,
    (it) => ({ x: it.x, y: at(it) + bodyH / 2, z: it.z, rot: it.rotY })));
  group.add(instanced(new THREE.BoxGeometry(B.cap.square, B.cap.thickness, B.cap.square),
    painted(C.bollardBody), items,
    (it) => ({ x: it.x, y: at(it) + bodyH + B.cap.thickness / 2, z: it.z, rot: it.rotY })));

  /* One flush vertical lens in the face that looks at the walk — `rotY` is
     already the direction away from the planting bed the bollard stands on. */
  const lensY = bodyH - B.lens.belowCap - B.lens.height / 2;
  group.add(instanced(new THREE.BoxGeometry(B.lens.width, B.lens.height, B.lens.proud),
    applied(C.l1Diffuser), items, (it) => ({
      x: it.x + Math.sin(it.rotY) * (B.body.square / 2),
      y: at(it) + lensY,
      z: it.z + Math.cos(it.rotY) * (B.body.square / 2),
      rot: it.rotY,
    })));
}

function buildTrafficBollards(section, group, ground, counts) {
  const C = section.colors;
  const T = section.systems.trafficBollard;
  const items = T.items.filter((it) => !clipped(section, it.x, it.z));
  counts.trafficBollards = items.length;
  if (!items.length) return;
  const r = T.diameter / 2;
  const body = T.height - T.cap.rise;
  group.add(instanced(new THREE.CylinderGeometry(r, r, body, 14),
    galv(C.trafficBollard), items,
    (it) => ({ x: it.x, y: ground(it.x, it.z) + body / 2, z: it.z })));
  /* The cap is a SPHERICAL CAP and carries no dimension of its own — exactly
     the L1 shade crown's argument. Its base radius is the sleeve's and its rise
     the measured `cap.rise`, and those two fix the sphere and the half-angle
     outright, so there is no free parameter left to invent. It used to be a
     truncated cone with an `r * 0.86` top: a fraction that lived here, that the
     section had never seen, and that nothing derived. */
  const capR = (r * r + T.cap.rise * T.cap.rise) / (2 * T.cap.rise);
  group.add(instanced(
    new THREE.SphereGeometry(capR, 14, 6, 0, Math.PI * 2, 0, Math.asin(r / capR)),
    galv(C.trafficBollard), items,
    (it) => ({ x: it.x, y: ground(it.x, it.z) + body + T.cap.rise - capR, z: it.z })));
}

/* -------------------------------------------------------------- guardrail */

function buildGuardrails(section, group, ground, counts) {
  const C = section.colors;
  const G = section.systems.guardrail;
  const kerbs = { galv: [], black: [] };
  const rails = { galv: [], black: [] };
  const pickets = { galv: [], black: [] };

  for (const run of G.runs) {
    const st = stations(run, 1.0, ground);
    const f = run.finish;
    /* The kerb is what stands on the ground; the rail stands on the kerb.
       Segment by segment so a run over falling ground follows it. */
    for (let i = 0; i < st.points.length - 1; i++) {
      const a = st.points[i];
      const b = st.points[i + 1];
      const mx = (a.x + b.x) / 2;
      const mz = (a.z + b.z) / 2;
      const g = (a.g + b.g) / 2;
      if (clipped(section, mx, mz)) continue;
      kerbs[f].push({
        x: mx, y: g + G.kerb.height / 2, z: mz, rot: st.rot,
        scale: [G.kerb.thickness, G.kerb.height, st.seg + 0.02],
      });
      /* EACH RAIL CARRIES ITS OWN DEPTH. Both used to be drawn at the top
         rail's 0.048 m box width, so the 1 in Sch.40 bottom tube shipped 45 %
         over-wide — and the section's `bottomRail.depth` was bent to 0.048 to
         match that instead of the other way round. */
      for (const [h, t, dep] of [
        [G.height - G.topRail.thickness / 2, G.topRail.thickness, G.topRail.depth],
        [G.kerb.height + G.bottomRail.above, G.bottomRail.thickness, G.bottomRail.depth],
      ]) {
        rails[f].push({
          x: mx, y: g + h, z: mz, rot: st.rot,
          scale: [dep, t, st.seg + 0.02],
        });
      }
    }
    /* Pickets on the measured 0.1016 m pitch, each seated on its own station. */
    const n = Math.floor(st.len / G.picket.pitch);
    const pad = (st.len - (n - 1) * G.picket.pitch) / 2;
    const ux = (run.b[0] - run.a[0]) / st.len;
    const uz = (run.b[1] - run.a[1]) / st.len;
    const y0 = G.kerb.height + G.bottomRail.above - G.bottomRail.picketStopsBelow;
    const y1 = G.height - G.topRail.thickness;
    for (let i = 0; i < n; i++) {
      const s = pad + i * G.picket.pitch;
      const x = run.a[0] + ux * s;
      const z = run.a[1] + uz * s;
      if (clipped(section, x, z)) continue;
      pickets[f].push({ x, y: ground(x, z) + (y0 + y1) / 2, z, scale: [1, y1 - y0, 1] });
    }
  }

  const box = new THREE.BoxGeometry(1, 1, 1);
  const pick = new THREE.CylinderGeometry(G.picket.diameter / 2, G.picket.diameter / 2, 1, 6);
  const hex = { galv: C.railGalv, black: C.railBlack };
  let pickCount = 0;
  for (const f of ["galv", "black"]) {
    if (kerbs[f].length) group.add(instanced(box, concrete(C.paverField), kerbs[f], (it) => it));
    if (rails[f].length) group.add(instanced(box, galv(hex[f]), rails[f], (it) => it));
    if (pickets[f].length) {
      group.add(instanced(pick, galv(hex[f]), pickets[f], (it) => it));
      /* Closed, domed picket tops — the photographed detail, and the reason a
         picket run catches light along its head instead of going flat. The
         section's `domedTop` is CONSULTED, not decorative: it was true in the
         data and the domes were built unconditionally, so the key claimed a
         choice the module did not have. */
      if (G.picket.domedTop) {
        group.add(instanced(new THREE.SphereGeometry(G.picket.diameter / 2, 6, 4),
          galv(hex[f]), pickets[f],
          (it) => ({ x: it.x, y: it.y + it.scale[1] / 2, z: it.z })));
      }
    }
    pickCount += pickets[f].length;
  }
  counts.guardrailRuns = G.runs.length;
  counts.guardrailPickets = pickCount;
}

/* --------------------------------------------------------------- handrail */

function buildHandrails(section, group, ground, counts) {
  const C = section.colors;
  const H = section.systems.handrail;
  /* THE TERMINAL IS THE FIXTURE'S SIGNATURE AND IT IS BUILT. phf03 shows the
     gripping rail turning through 90 degrees at the foot and running to the
     paving as the SAME tube on a base flange — no separate newel. That verdict
     lived in `terminalPost` and in the suite for a round with nothing drawing
     it. The quarter bend's centreline radius is the section's, and the LOWER
     rail runs one radius further than the top one so it dies into the vertical
     leg instead of stopping in mid-air. */
  const R = H.terminalPost.bendRadius;
  const posts = [];
  const plates = [];
  const railSegs = [];
  const bends = [];
  const legs = [];
  let runs = 0;
  let terminals = 0;

  for (const run of H.runs) {
    runs++;
    const st = stations(run, 0.5, ground);
    const ux = (run.b[0] - run.a[0]) / st.len;
    const uz = (run.b[1] - run.a[1]) / st.len;
    /* Both sides of the ramp, offset half the declared clear width. */
    for (const side of [-1, 1]) {
      const ox = -uz * side * (H.clearWidth / 2);
      const oz = ux * side * (H.clearWidth / 2);
      /* ADA §505.10.2: the top rail runs 0.305 m past each end, level. THE
         EXTENSION IS REAL PLAN LENGTH. It used to be clamped back onto the run
         ends, so every extension collapsed to a zero-length segment and the
         12 in the section cites was asserted and not drawn. */
      const at = (s) => {
        const x = run.a[0] + ux * s + ox;
        const z = run.a[1] + uz * s + oz;
        return { x, z, g: ground(x, z), s };
      };
      for (const [h, extra] of [[H.height, 0], [H.intermediateRail, R]]) {
        const ext = H.extension.length + extra;
        const span = st.len + 2 * ext;
        const n = Math.max(1, Math.round(span / 0.5));
        const line = [];
        for (let i = 0; i <= n; i++) line.push(at(-ext + (span * i) / n));
        for (let i = 0; i < line.length - 1; i++) {
          const a = line[i];
          const b = line[i + 1];
          const mx = (a.x + b.x) / 2;
          const mz = (a.z + b.z) / 2;
          if (clipped(section, mx, mz)) continue;
          railSegs.push({
            x: mx, y: (a.g + b.g) / 2 + h, z: mz,
            rot: Math.atan2(b.x - a.x, b.z - a.z),
            scale: [1, 1, Math.hypot(b.x - a.x, b.z - a.z) + 0.01],
          });
        }
      }
      /* The two down-turns. `dir` is +1 at the far end and -1 at the near one;
         the bend's arc runs from the rail's end tangentially down through a
         quarter circle, and the leg drops from the arc's foot to the paving.
         The torus is authored in its local XY plane, so the yaw that carries
         local +X onto the run's plan direction is atan2(-dz, dx). */
      for (const dir of [-1, 1]) {
        const head = at(dir > 0 ? st.len + H.extension.length : -H.extension.length);
        const foot = at(dir > 0 ? st.len + H.extension.length + R : -H.extension.length - R);
        if (clipped(section, head.x, head.z) || clipped(section, foot.x, foot.z)) continue;
        terminals++;
        const arcTop = head.g + H.height;
        bends.push({ x: head.x, y: arcTop - R, z: head.z, rot: Math.atan2(-uz * dir, ux * dir) });
        const legLen = arcTop - R - foot.g;
        legs.push({ x: foot.x, y: foot.g + legLen / 2, z: foot.z, scale: [1, legLen, 1] });
        plates.push({ x: foot.x, y: foot.g + H.post.basePlateThickness / 2, z: foot.z });
      }
      for (let s = 0; s <= st.len + 1e-6; s += H.post.pitch) {
        const p = at(Math.min(st.len, s));
        if (clipped(section, p.x, p.z)) continue;
        posts.push({ x: p.x, y: p.g + H.height / 2, z: p.z, scale: [1, H.height, 1] });
        plates.push({ x: p.x, y: p.g + H.post.basePlateThickness / 2, z: p.z });
      }
    }
  }

  counts.handrailRuns = runs;
  counts.handrailPosts = posts.length;
  counts.handrailTerminals = terminals;
  const steel = galv(C.handrailSteel);
  const rt = H.tube.diameter / 2;
  group.add(instanced(
    new THREE.CylinderGeometry(H.post.diameter / 2, H.post.diameter / 2, 1, 8), steel, posts, (it) => it));
  group.add(instanced(
    new THREE.CylinderGeometry(H.terminalPost.diameter / 2, H.terminalPost.diameter / 2, 1, 8),
    steel, legs, (it) => it));
  group.add(instanced(new THREE.TorusGeometry(R, rt, 6, 8, Math.PI / 2), steel, bends, (it) => it));
  group.add(instanced(
    new THREE.CylinderGeometry(H.post.basePlate / 2, H.post.basePlate / 2, H.post.basePlateThickness, 10),
    steel, plates, (it) => it));
  group.add(instanced(tube(rt, 1, 8), steel, railSegs, (it) => it));
}

/* -------------------------------------------------------------- bike racks */

function buildBikeRacks(section, group, ground, counts) {
  const C = section.colors;
  const R = section.systems.bikeRack;
  const legs = { galv: [], black: [] };
  const bars = { galv: [], black: [] };
  const bends = { galv: [], black: [] };
  let hoops = 0;

  const halfW = R.hoop.width / 2;
  const bend = R.hoop.bendRadius;
  const legTop = R.hoop.height - bend;
  const barHalf = halfW - bend;

  for (const rank of R.ranks) {
    const f = rank.finish;
    for (let h = 0; h < rank.hoops; h++) {
      const along = (h - (rank.hoops - 1) / 2) * R.hoop.spacing;
      const cx = rank.x + Math.sin(rank.rotY) * along;
      const cz = rank.z + Math.cos(rank.rotY) * along;
      if (clipped(section, cx, cz)) continue;
      hoops++;
      const g = ground(cx, cz);
      /* Hoop plane runs across the rank, so bikes park on both faces. */
      const px = Math.cos(rank.rotY);
      const pz = -Math.sin(rank.rotY);
      for (const s of [-1, 1]) {
        legs[f].push({
          x: cx + px * halfW * s, y: g + legTop / 2, z: cz + pz * halfW * s,
          scale: [1, legTop, 1],
        });
        /* The quarter bend's local +X must point outward along the hoop plane
           and its local +Y must stay up, so the arc runs from the leg head to
           the crossbar end. A yaw alone does that; any tilt breaks the join. */
        bends[f].push({
          x: cx + px * barHalf * s, y: g + legTop, z: cz + pz * barHalf * s,
          rot: rank.rotY + (s > 0 ? 0 : Math.PI),
        });
      }
      bars[f].push({
        x: cx, y: g + R.hoop.height, z: cz,
        rot: rank.rotY + Math.PI / 2, scale: [1, 1, barHalf * 2],
      });
    }
  }

  counts.bikeRanks = R.ranks.length;
  counts.bikeHoops = hoops;
  const t = R.hoop.tube / 2;
  const legGeo = new THREE.CylinderGeometry(t, t, 1, 8);
  const barGeo = tube(t, 1, 8);
  const bendGeo = new THREE.TorusGeometry(bend, t, 6, 6, Math.PI / 2);
  const hex = { galv: C.railGalv, black: C.railBlack };
  for (const f of ["galv", "black"]) {
    if (legs[f].length) group.add(instanced(legGeo, galv(hex[f]), legs[f], (it) => it));
    if (bars[f].length) group.add(instanced(barGeo, galv(hex[f]), bars[f], (it) => it));
    if (bends[f].length) group.add(instanced(bendGeo, galv(hex[f]), bends[f], (it) => it));
  }
}

/* --------------------------------------------------------------- planters */

function buildPlanters(section, group, ground, counts) {
  const C = section.colors;
  const A = section.systems.planterA;
  const B = section.systems.planterB;

  const aItems = A.items.filter((it) => !clipped(section, it.x, it.z));
  counts.plantersRound = aItems.length;
  if (aItems.length) {
    const rTop = A.rimDiameter / 2;
    const rBot = A.baseDiameter / 2;
    group.add(instanced(
      new THREE.CylinderGeometry(rTop - A.rim.thickness / 2, rBot, A.height, 20),
      concrete(C.planterCream), aItems,
      (it) => ({ x: it.x, y: ground(it.x, it.z) + A.height / 2, z: it.z })));
    /* The rolled half-round rim, proud of the body — the profile that makes
       this read as a precast vase rather than a bucket. */
    const rim = new THREE.TorusGeometry(rTop - A.rim.thickness / 2, A.rim.thickness / 2, 6, 24);
    rim.rotateX(Math.PI / 2);
    group.add(instanced(rim, concrete(C.planterCream), aItems,
      (it) => ({ x: it.x, y: ground(it.x, it.z) + A.height - A.rim.thickness / 2, z: it.z })));
    group.add(instanced(
      new THREE.CylinderGeometry(rTop - A.rim.thickness - A.rim.wall, rTop - A.rim.thickness - A.rim.wall, 0.02, 18),
      concrete(C.planterCharcoal), aItems,
      (it) => ({ x: it.x, y: ground(it.x, it.z) + A.height - A.soilBelowRim, z: it.z })));
  }

  const bItems = B.items.filter((it) => !clipped(section, it.x, it.z));
  counts.plantersBox = bItems.length;
  if (bItems.length) {
    group.add(instanced(new THREE.BoxGeometry(1, B.height, 1), concrete(C.planterCharcoal), bItems,
      (it) => ({
        x: it.x, y: ground(it.x, it.z) + B.height / 2, z: it.z, rot: it.rotY || 0,
        scale: [B.plan[it.plan][0], 1, B.plan[it.plan][1]],
      })));
  }
}

/* ------------------------------------------------------------- receptacles */

function buildWaste(section, group, ground, counts) {
  const C = section.colors;
  const W = section.systems.waste;
  const items = W.items.filter((it) => !clipped(section, it.x, it.z));
  counts.wasteUnits = items.length;
  if (!items.length) return;
  const [w, h, d] = W.overall;
  const at = (it) => ground(it.x, it.z);

  group.add(instanced(new THREE.BoxGeometry(w, h, d), painted(C.wasteSurround), items,
    (it) => ({ x: it.x, y: at(it) + h / 2, z: it.z, rot: it.rotY })));
  /* Corner posts and the centre mullion stand a little proud — the visible
     frame that makes it one surround around two bays, not two bins. */
  const posts = [];
  const mullions = [];
  const lids = [];
  const tabs = [];
  const throats = [];
  const arches = [];
  for (const it of items) {
    const sx = Math.sin(it.rotY);
    const cz = Math.cos(it.rotY);
    const put = (u, v) => ({ x: it.x + cz * u + sx * v, z: it.z - sx * u + cz * v });
    for (const u of [-w / 2, w / 2]) {
      for (const v of [-d / 2, d / 2]) {
        posts.push({ ...put(u, v), y: at(it) + h / 2, rot: it.rotY });
      }
    }
    mullions.push({ ...put(0, 0), y: at(it) + h / 2, rot: it.rotY });
    for (const u of [-W.bay.width / 2, W.bay.width / 2]) {
      lids.push({ ...put(u, 0), y: at(it) + h + W.lid.thickness / 2, rot: it.rotY });
      tabs.push({
        ...put(u, d / 2 - W.lid.tab[2] / 2 - 0.02),
        y: at(it) + h + W.lid.thickness + W.lid.tab[1] / 2, rot: it.rotY,
      });
      const throatTop = h - W.throat.belowLid;
      const boxH = W.throat.height;
      throats.push({ ...put(u, d / 2), y: at(it) + throatTop - W.throat.archRadius - boxH / 2, rot: it.rotY });
      arches.push({ ...put(u, d / 2), y: at(it) + throatTop - W.throat.archRadius, rot: it.rotY });
    }
  }
  const cp = W.cornerPost;
  group.add(instanced(new THREE.BoxGeometry(cp, h, cp), painted(C.wasteSurround), posts, (it) => it));
  group.add(instanced(new THREE.BoxGeometry(W.mullion, h, d + 0.01), painted(C.wasteSurround), mullions, (it) => it));
  group.add(instanced(
    new THREE.BoxGeometry(W.bay.width + W.lid.oversail * 2, W.lid.thickness, d + W.lid.oversail * 2),
    painted(C.wasteSurround), lids, (it) => it));
  group.add(instanced(new THREE.BoxGeometry(W.lid.tab[0], W.lid.tab[1], W.lid.tab[2]),
    galv(C.trafficBollard), tabs, (it) => it));
  group.add(instanced(new THREE.BoxGeometry(W.throat.width, W.throat.height, 0.02),
    applied(C.l2Pole), throats, (it) => it));
  const arch = new THREE.CylinderGeometry(W.throat.archRadius, W.throat.archRadius, 0.02, 12, 1, false, 0, Math.PI);
  arch.rotateX(Math.PI / 2);
  group.add(instanced(arch, applied(C.l2Pole), arches, (it) => it));
}

/* ------------------------------------------------ totem and blue-light tower */

function buildTotem(section, group, ground, counts) {
  const C = section.colors;
  const T = section.systems.wayfindingTotem;
  const items = T.items.filter((it) => !clipped(section, it.x, it.z));
  counts.totems = items.length;
  if (!items.length) return;
  const [w, h, d] = T.size;
  group.add(instanced(new THREE.BoxGeometry(w, h - T.header.height, d), painted(C.totemBody), items,
    (it) => ({ x: it.x, y: ground(it.x, it.z) + (h - T.header.height) / 2, z: it.z, rot: it.rotY })));
  group.add(instanced(new THREE.BoxGeometry(w, T.header.height, d + 0.01), applied(C.totemHeader), items,
    (it) => ({ x: it.x, y: ground(it.x, it.z) + h - T.header.height / 2, z: it.z, rot: it.rotY })));
}

function buildBlueLight(section, group, ground, counts) {
  const C = section.colors;
  const B = section.systems.blueLight;
  const items = B.items.filter((it) => !clipped(section, it.x, it.z));
  counts.blueLights = items.length;
  if (!items.length) return;
  const at = (it) => ground(it.x, it.z);
  const s = B.section;
  group.add(instanced(new THREE.BoxGeometry(s, B.callStation.height, s), painted(C.blueLight), items,
    (it) => ({ x: it.x, y: at(it) + B.callStation.height / 2, z: it.z, rot: it.rotY })));
  group.add(instanced(new THREE.BoxGeometry(B.mast.square, B.mast.to - B.mast.from, B.mast.square),
    painted(C.blueLight), items,
    (it) => ({ x: it.x, y: at(it) + (B.mast.from + B.mast.to) / 2, z: it.z, rot: it.rotY })));
  group.add(instanced(
    new THREE.CylinderGeometry(B.shade.diameter / 2, B.mast.square, B.shade.height, 12),
    painted(C.l1Pedestal), items,
    (it) => ({ x: it.x, y: at(it) + B.shade.at + B.shade.height / 2, z: it.z })));
  group.add(instanced(
    new THREE.CylinderGeometry(B.beacon.diameter / 2, B.beacon.diameter / 2, B.beacon.height, 12),
    applied(C.blueLight), items,
    (it) => ({ x: it.x, y: at(it) + B.height - B.beacon.height / 2, z: it.z })));
  group.add(instanced(
    new THREE.CylinderGeometry(B.callStation.buttonDiameter / 2, B.callStation.buttonDiameter / 2, 0.02, 10),
    applied(C.safetyOrange), items, (it) => ({
      x: it.x + Math.sin(it.rotY) * (s / 2), y: at(it) + B.callStation.buttonAt,
      z: it.z + Math.cos(it.rotY) * (s / 2), rot: it.rotY, rotX: Math.PI / 2,
    })));
}

/* ---------------------------------------------------- detectable warnings */

/**
 * The tile is a DECAL LYING ON THE PAVING, so it takes its own rung — one
 * above whatever draws the walk it marks — and not the fixture datum.
 *
 * `rawGround` is the unlifted surface sampler: this function adds its own
 * rung's lift, and adding the fixture datum on top would double-count.
 *
 * Both the panel and every dome FOLLOW the drawn ground. The panel is a
 * subdivided grid whose every vertex is sampled, merged across all four items
 * into one draw; the domes are sampled at their own (x, z). One flat quad at
 * the panel centre, which is what round one built, cuts 0.076 m into the
 * ground at its upslope edge on the 1:12 fall the test itself uses.
 *
 * The tile's POSITION is the section's business, not this function's, but it
 * is worth saying why it moved: a warning surface is a surface OF the walk, so
 * all four corners have to fall inside the surveyed polygon the item names.
 * Both panels used to be centred on their walk's boundary, which put half of
 * each lifted decal over ground its host walk does not cover. See the section's
 * `detectableWarning.seatingRule`; the test re-checks every corner.
 */
function buildWarnings(section, group, rawGround, counts) {
  const C = section.colors;
  const D = section.systems.detectableWarning;
  const items = D.items.filter((it) => !clipped(section, it.x, it.z));
  counts.warningPanels = items.length;
  if (!items.length) return;
  const lift = overlayLift(D.rung);
  const NU = 8;
  const NV = 4;
  const pos = [];
  const uv = [];
  const idx = [];
  for (const it of items) {
    const c = Math.cos(it.rotY);
    const s = Math.sin(it.rotY);
    const base = pos.length / 3;
    for (let j = 0; j <= NV; j++) {
      for (let i = 0; i <= NU; i++) {
        const u = (i / NU - 0.5) * D.panel.width;
        const v = (j / NV - 0.5) * D.panel.depth;
        const x = it.x + c * u + s * v;
        const z = it.z - s * u + c * v;
        pos.push(x, rawGround(x, z) + lift, z);
        uv.push(i / NU, j / NV);
      }
    }
    for (let j = 0; j < NV; j++) {
      for (let i = 0; i < NU; i++) {
        const a = base + j * (NU + 1) + i;
        idx.push(a, a + NU + 1, a + 1, a + 1, a + NU + 1, a + NU + 2);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const panel = new THREE.Mesh(geo, applyOverlayDepth(lib().get("pavingConcreteUnit", {
    color: C.warningYellow,
    /* The texture repeats once per TILE, and the tile is the section's declared
       24 in product module — the panel is exactly three of them across and one
       deep. The 0.61 used to be written here twice, which is a dimension the
       section owns living in the module. */
    repeat: [D.panel.width / D.panel.tileModule, D.panel.depth / D.panel.tileModule],
  }), D.rung));
  panel.renderOrder = OVERLAY[D.rung].renderOrder;
  panel.castShadow = false;
  panel.receiveShadow = true;
  group.add(panel);

  /* The domes are what the surface IS: a real aligned grid of truncated cones
     standing on the tile, not a texture pretending to be one. */
  const domes = [];
  const nx = Math.floor(D.panel.width / D.dome.pitch);
  const nz = Math.floor(D.panel.depth / D.dome.pitch);
  for (const it of items) {
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const u = (i - (nx - 1) / 2) * D.dome.pitch;
        const v = (j - (nz - 1) / 2) * D.dome.pitch;
        const x = it.x + Math.cos(it.rotY) * u + Math.sin(it.rotY) * v;
        const z = it.z - Math.sin(it.rotY) * u + Math.cos(it.rotY) * v;
        domes.push({ x, y: rawGround(x, z) + lift + D.dome.height / 2, z });
      }
    }
  }
  counts.warningDomes = domes.length;
  group.add(instanced(
    new THREE.CylinderGeometry(D.dome.topDiameter / 2, D.dome.baseDiameter / 2, D.dome.height, 6),
    applied(C.warningYellow), domes, (it) => it));
}

/* ------------------------------------------------------------ face frames */

/**
 * A signage face's own frame, built from two vertices of the MEASURED massing
 * ring the section names. `at(u, w)` is u metres along the face from its
 * start and w metres proud of it.
 */
function frameOf(f) {
  const nl = Math.hypot(f.out[0], f.out[1]);
  const nx = f.out[0] / nl;
  const nz = f.out[1] / nl;
  const tx = nz;
  const tz = -nx;
  let sx = f.a[0], sz = f.a[1], ex = f.b[0], ez = f.b[1];
  if ((ex - sx) * tx + (ez - sz) * tz < 0) {
    sx = f.b[0]; sz = f.b[1]; ex = f.a[0]; ez = f.a[1];
  }
  return {
    length: Math.hypot(ex - sx, ez - sz),
    rot: Math.atan2(nx, nz),
    mid: [(sx + ex) / 2, (sz + ez) / 2],
    at: (u, w) => ({ x: sx + tx * u + nx * w, z: sz + tz * u + nz * w }),
  };
}

/* ---------------------------------------------------------------- signage */

function buildSignage(section, group, ground, counts) {
  const C = section.colors;
  const S = section.systems.signage;
  const letters = [];
  const rules = [];
  const numerals = [];
  /* `standoff` is the clear gap BEHIND the element, so an element of depth
     `relief` has its centre at standoff + relief/2 and its back face lands on
     the drawn wall when standoff is 0. Nothing on Eighth ships a rain screen —
     the masses are drawn at the survey ring — so the section declares 0 and
     these solids touch the wall instead of floating 0.29 m off it. */
  const outAt = (relief) => S.standoff + relief / 2;

  for (const w of S.wordmarks) {
    const fr = frameOf(w.face);
    const g = ground(fr.mid[0], fr.mid[1]);
    const u0 = fr.length * w.uFraction;
    const base = g + w.aboveWalk;
    const p = fr.at(u0, outAt(w.relief));
    letters.push({
      x: p.x, y: base + w.capHeight / 2, z: p.z, rot: fr.rot,
      scale: [w.wordLength, w.capHeight, w.relief],
    });
    const ul = fr.at(u0 + (w.underline.leftOverhang - w.underline.rightOverhang) / -2, outAt(w.relief));
    rules.push({
      x: ul.x, y: base - w.underline.belowBaseline - w.underline.thickness / 2, z: ul.z, rot: fr.rot,
      scale: [w.underline.length, w.underline.thickness, w.relief],
    });
    const cr = fr.at(u0 + w.wordLength / 2 + w.capRule.gap + w.capRule.length / 2, outAt(w.relief));
    rules.push({
      x: cr.x, y: base + w.capHeight - w.capRule.thickness / 2, z: cr.z, rot: fr.rot,
      scale: [w.capRule.length, w.capRule.thickness, w.relief],
    });
  }
  for (const n of S.numerals) {
    const fr = frameOf(n.face);
    const g = ground(fr.mid[0], fr.mid[1]);
    const p = fr.at(fr.length * n.uFraction, outAt(n.relief));
    numerals.push({
      x: p.x, y: g + n.aboveWalk + n.height / 2, z: p.z, rot: fr.rot,
      scale: [n.width, n.height, n.relief],
    });
  }

  counts.wordmarks = S.wordmarks.length;
  counts.numerals = S.numerals.length;
  const box = new THREE.BoxGeometry(1, 1, 1);
  group.add(instanced(box, applied(C.wordmarkDark), letters, (it) => it));
  group.add(instanced(box, applied(C.wordmarkDark), rules, (it) => it));
  group.add(instanced(box, applied(C.addressNavy), numerals, (it) => it));
}

/* ------------------------------------------------------- wall sconces only */

function buildSconces(section, group, ground, counts) {
  const C = section.colors;
  const A = section.systems.ancillaryLighting;
  const boxes = [];
  const lenses = [];
  for (const f of A.sconce.faces) {
    const fr = frameOf(f.face);
    const g = ground(fr.mid[0], fr.mid[1]);
    for (let i = 0; i < f.count; i++) {
      const u = (fr.length * (i + 1)) / (f.count + 1);
      const p = fr.at(u, A.sconce.size[2] / 2);
      boxes.push({
        x: p.x, y: g + A.sconce.atDoorHead, z: p.z, rot: fr.rot,
        scale: [A.sconce.size[0], A.sconce.size[1], A.sconce.size[2]],
      });
      const l = fr.at(u, A.sconce.size[2] + A.sconce.lens[2] / 2);
      lenses.push({
        x: l.x, y: g + A.sconce.atDoorHead, z: l.z, rot: fr.rot,
        scale: [A.sconce.lens[0], A.sconce.lens[1], A.sconce.lens[2]],
      });
    }
  }
  counts.sconces = boxes.length;
  const box = new THREE.BoxGeometry(1, 1, 1);
  group.add(instanced(box, painted(C.l2Pole), boxes, (it) => it));
  group.add(instanced(box, applied(C.l1Diffuser), lenses, (it) => it));
}

/* --------------------------------------------------------- court hardware */

function buildCourt(section, group, ground, counts) {
  const C = section.colors;
  const K = section.systems.courtHardware;
  const S = K.standard;
  const poles = [];
  const arms = [];
  const braces = [];
  const boards = [];
  const frames = [];
  const rims = [];
  const nets = [];

  for (const h of K.hoops) {
    const g = ground(h.x, h.z);
    /* The arm is the measured 1.42 m reach; the pole stands 0.20 m outside the
       baseline, so the board face lands 1.22 m INSIDE it — the regulation 4 ft
       overhang SWA -16 shows. */
    const armLength = h.setBack;
    /* `rotY` points from the standard IN toward the court, so the arm, the
       board and the rim all march along +local Z. */
    const sx = Math.sin(h.rotY);
    const cz = Math.cos(h.rotY);
    poles.push({ x: h.x, y: g + S.rise / 2, z: h.z, scale: [1, S.rise, 1] });
    arms.push({
      x: h.x + sx * armLength / 2, y: g + S.rise - S.armDiameter / 2,
      z: h.z + cz * armLength / 2, rot: h.rotY, scale: [1, 1, armLength],
    });
    /* The diagonal strut, foot on the mast at `braceFrom` and head ON THE
       ARM'S CENTRELINE at the section's derived `braceToArm` — which is the
       furthest out it can tie without its end cap reaching the backboard
       assembly. Both used to be bare fractions of the arm (0.35 and 0.7) that
       lived here and appeared nowhere in the section. */
    const braceRise = S.rise - S.armDiameter / 2 - S.braceFrom;
    const braceRun = S.braceToArm;
    braces.push({
      x: h.x + sx * braceRun / 2, y: g + S.braceFrom + braceRise / 2,
      z: h.z + cz * braceRun / 2, rot: h.rotY,
      rotX: -Math.atan2(braceRise, braceRun),
      scale: [1, 1, Math.hypot(braceRise, braceRun)],
    });
    /* The board's centre, from the rim it is set out against: the bottom edge
       of a 42 in board hangs `bottomBelowRim` (6 in) under the rim's plane, so
       the centre is half a board above that. It is DATA, not a literal here —
       the section's `standard.rise` is derived from the same number.
       IN PLAN, `setBack` IS THE ARM'S REACH TO THE BOARD'S FACE, not to its
       centre: the section's whole standard is set out from the face (pole
       0.20 m outside the baseline, face 1.22 m inside it). The centre
       therefore sits half a board thickness short of the arm's end, and the
       rim's regulation projection is measured from that face. Both used to be
       taken off the centre, which pulled the rim 0.030 m too close to the
       glass and put the face 1.25 m inside the baseline. */
    const boardCz = K.rim.height + K.backboard.height / 2 - K.backboard.bottomBelowRim;
    const faceToCentre = K.backboard.thickness / 2;
    const bx = h.x + sx * (armLength - faceToCentre);
    const bz = h.z + cz * (armLength - faceToCentre);
    const rimOut = faceToCentre + K.rim.projection + K.rim.diameter / 2;
    boards.push({
      x: bx, y: g + boardCz, z: bz, rot: h.rotY,
      scale: [K.backboard.width, K.backboard.height, K.backboard.thickness],
    });
    for (const [fw, fh, du, dy] of [
      [K.backboard.width, K.backboard.frame, 0, (K.backboard.height - K.backboard.frame) / 2],
      [K.backboard.width, K.backboard.frame, 0, -(K.backboard.height - K.backboard.frame) / 2],
      [K.backboard.frame, K.backboard.height, (K.backboard.width - K.backboard.frame) / 2, 0],
      [K.backboard.frame, K.backboard.height, -(K.backboard.width - K.backboard.frame) / 2, 0],
    ]) {
      frames.push({
        x: bx + cz * du, y: g + boardCz + dy, z: bz - sx * du, rot: h.rotY,
        scale: [fw, fh, K.backboard.frameDepth],
      });
    }
    rims.push({ x: bx + sx * rimOut, y: g + K.rim.height, z: bz + cz * rimOut });
    nets.push({
      x: bx + sx * rimOut,
      y: g + K.rim.height - K.rim.net.length / 2,
      z: bz + cz * rimOut,
    });
  }

  const post = new THREE.CylinderGeometry(S.poleDiameter / 2, S.poleDiameter / 2, 1, 10);
  group.add(instanced(post, galv(C.courtStandard), poles, (it) => it));
  const arm = tube(S.armDiameter / 2, 1, 8);
  group.add(instanced(arm, galv(C.courtStandard), arms, (it) => it));
  group.add(instanced(tube(S.braceDiameter / 2, 1, 6), galv(C.courtStandard), braces, (it) => it));
  group.add(instanced(new THREE.BoxGeometry(1, 1, 1), glassMat(C.backboardGlass), boards, (it) => it));
  group.add(instanced(new THREE.BoxGeometry(1, 1, 1), galv(C.backboardFrame), frames, (it) => it));
  const rimGeo = new THREE.TorusGeometry(K.rim.diameter / 2, K.rim.tube / 2, 6, 16);
  rimGeo.rotateX(Math.PI / 2);
  group.add(instanced(rimGeo, painted(C.safetyOrange), rims, (it) => it));
  group.add(instanced(
    new THREE.CylinderGeometry(K.rim.net.topDiameter / 2, K.rim.net.bottomDiameter / 2, K.rim.net.length, 12, 1, true),
    new THREE.MeshStandardMaterial({
      color: C.netWhite, roughness: 0.9, metalness: 0, side: THREE.DoubleSide,
      transparent: true, opacity: 0.55, depthWrite: false,
    }), nets, (it) => it));
  counts.courtHoops = K.hoops.length;
  /* THE CALISTHENICS RIG IS NOT HERE. It was built at this end of the court by
     this module AND by eighthcourtyards, at two different sizes 4.9 m apart,
     and nothing arbitrated the pair. It is now owned outright by
     campus-photo-pulsefitness.js and the geometry is deleted rather than left
     behind a flag; this section records it in `absent` instead of sizing it.
     The court's own hardware — standards, braces, boards, rims, nets — stays. */
}

/* ------------------------------------------------------------------- api */

/**
 * Every system the section may declare, mapped to the count key that is
 * non-zero only if that system actually put geometry in the group. `null` is a
 * system that is DECLARED AND NOT PLACED on purpose — l1bPole has no surveyed
 * position, so it ships with an empty items[] and builds nothing.
 *
 * This table is why `counts.systems` means something. It used to be
 * `Object.keys(section.systems).length`, which counted l1bPole as built and
 * could not have noticed a system losing its builder — it would have gone on
 * reporting seventeen with sixteen, then fifteen, on screen. An unknown key
 * throws rather than being silently uncounted.
 */
const SYSTEM_GEOMETRY = {
  l1Pole: "l1Poles",
  l1bPole: null,
  l2Pole: "l2Poles",
  bollardLight: "bollardLights",
  guardrail: "guardrailPickets",
  handrail: "handrailPosts",
  bikeRack: "bikeHoops",
  planterA: "plantersRound",
  planterB: "plantersBox",
  waste: "wasteUnits",
  trafficBollard: "trafficBollards",
  detectableWarning: "warningPanels",
  wayfindingTotem: "totems",
  blueLight: "blueLights",
  signage: "wordmarks",
  ancillaryLighting: "sconces",
  courtHardware: "courtHoops",
};

/**
 * Build Eighth College's photo-sourced siteworks.
 *
 * `photo` is the loaded photo-detail document; this reads only its
 * `eighthsiteworks` section and writes nothing back, and returns
 * `{ group, counts }` (empty and harmless if the section is missing, so a
 * half-wired boot still runs). `surfaceAt` — the height of the DRAWN terrain
 * triangle — places everything, because everything here stands on the ground
 * or on a wall whose base is on the ground; `heightAt` is only a fallback.
 *
 * THE SEATING DATUM is `surfaceAt + overlayLift(section.groundDatum.rung)`,
 * not `surfaceAt`. campus-eighth.js repaints every one of this section's
 * anchor polygons as a decal one rung up, so the visible ground under every
 * fixture here is that rung, not the terrain triangle. The only thing that
 * takes the raw sampler is the detectable-warning tile, which adds its OWN
 * rung's lift (a decal lying on the paving, so one rung higher again).
 */
export function createPhotoEighthSiteworks(scene, { photo, heightAt, surfaceAt } = {}) {
  const group = new THREE.Group();
  group.name = "photo-eighth-siteworks";
  const section = photo?.eighthsiteworks;
  if (!section) {
    scene?.add(group);
    return { group, counts: {} };
  }
  const ground = surfaceAt || heightAt;
  if (typeof ground !== "function") {
    throw new Error("campus-photo-eighthsiteworks: needs surfaceAt (or heightAt) to place on the ground");
  }
  const datum = section.groundDatum?.rung;
  if (!datum) {
    throw new Error("campus-photo-eighthsiteworks: the section must declare groundDatum.rung — a fixture seated on the raw terrain stands under Eighth's own paving decal");
  }
  const datumLift = overlayLift(datum);
  const seat = (x, z) => ground(x, z) + datumLift;

  const counts = {};
  buildL1(section, group, seat, counts);
  buildL2(section, group, seat, counts);
  buildBollardLights(section, group, seat, counts);
  buildGuardrails(section, group, seat, counts);
  buildHandrails(section, group, seat, counts);
  buildBikeRacks(section, group, seat, counts);
  buildPlanters(section, group, seat, counts);
  buildWaste(section, group, seat, counts);
  buildTrafficBollards(section, group, seat, counts);
  buildWarnings(section, group, ground, counts);
  buildTotem(section, group, seat, counts);
  buildBlueLight(section, group, seat, counts);
  buildSignage(section, group, seat, counts);
  buildSconces(section, group, seat, counts);
  buildCourt(section, group, seat, counts);

  scene?.add(group);
  counts.datumLift = datumLift;
  for (const key of Object.keys(section.systems)) {
    if (!(key in SYSTEM_GEOMETRY)) {
      throw new Error(`campus-photo-eighthsiteworks: the section declares a system "${key}" that no builder here owns — add it to SYSTEM_GEOMETRY or it ships uncounted and undrawn`);
    }
  }
  counts.built = Object.entries(SYSTEM_GEOMETRY)
    .filter(([key, k]) => k && section.systems[key] && counts[k] > 0)
    .map(([key]) => key);
  counts.systems = counts.built.length;
  counts.draws = group.children.length;
  return { group, counts };
}
