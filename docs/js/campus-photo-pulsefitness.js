// Pulse's OUTDOOR FITNESS ZONE, from one photograph — the INVENTED class.
//
// Eighth College / Theatre District Living & Learning Neighborhood, 2023-24.
// This file builds ONE object: the open-air calisthenics / functional-training
// rig on Pulse's north colonnade terrace, with its two hung heavy bags. That is
// the whole of Eighth's outdoor fitness kit as the sources resolve it.
//
// FIVE THINGS DECIDED THE SHAPE OF THIS FILE.
//
//   0. THERE IS EXACTLY ONE FRAME. SWA Group image -16 is the only photograph
//      in the EYRC (phf01-49) or SWA (-1..-23) sets that resolves this object
//      at all — round one's second citation, phf22, shows a BIKE REPAIR STAND
//      on the Sun Lawn edge and no rig. One frame means one camera, and it
//      means every dimension here has to come out of that camera or be
//      declared. The section carries the resection (`camera`), the raw pixel
//      readings it was run on (`reads`), and the arithmetic per figure
//      (`derivations`); this module reads the answers and never re-derives.
//
//   1. THE RIG SHIPPED TWICE, AT TWO SIZES, 4.9 m APART, AND BOTH WERE WRONG.
//      eighthCourtyards had it 5.0 x 2.0 m at (-169.5, 534.5); eighthSiteworks
//      had it 4.0 x 2.0 at (-174.0, 537.0), with its own note admitting "no
//      calibration object on it". Neither had a camera. The resection makes it
//      7.72 m long, 2.89 m to the top of the frame, standing against Pulse's
//      surveyed north face 16 m further from the court than either guess. Both
//      predecessors are named in the section's `supersedes`; this module owns
//      the object outright and edits no other file.
//
//   2. THE POSITION IS [estimated] AND THE ERROR BAR IS PART OF THE DATA. No
//      2024-25 photograph is registered to the ArcGIS survey, so there is no
//      surveyed coordinate for this rig. What there is: a single-view SCALE
//      argument that pins it to the plane of the surveyed facade (the rig
//      images at 38.5-43.7 px/m and the facade directly above it at 40 +/- 2,
//      so they are at the same distance; ten metres nearer the court would make
//      the heavy bags 0.18 m across), and +/- 2.5 m in x, +/- 1.6 m in z on top
//      of that. It is written down in `positionCaveat` rather than rounded away.
//      The check that it is not nonsense is independent: the resected footprint
//      lands inside surveyed walkway-3238, the ONLY paved polygon in that 17.6 m
//      strip, in the only part of it that is not under Pulse's massing ring.
//
//   3. THE GROUND HERE IS NOT THE TERRAIN, AND THE RIG IS RIGID. walkway-3238
//      is a campus-eighth.json ground feature and campus-eighth.js repaints
//      every one of those as a decal on campus-overlay.js's `pad` rung, +0.09 m.
//      So the seating datum is `surfaceAt + overlayLift(section.groundDatum.rung)`
//      and never the raw sampler — the same argument, rung and number as
//      eighthSiteworks, because it is the same paving. A welded steel frame
//      cannot follow a slope, either: all fourteen posts stand on ONE datum,
//      the HIGHEST of their fourteen seats, and each footing is then extended
//      DOWNWARD as a levelling pier to its own local ground. On the flat pad
//      that is a 16 mm plate; on a slope nothing hovers and nothing shears.
//
//   4. THE BAGS ARE REAL AND THEY ARE OUTDOORS. UCSD's programme text puts
//      punching bags in the L1 gym, which is true and is a different room;
//      round one stopped there and concluded there was no outdoor bag. swa-16
//      shows two black cylindrical heavy bags on webbing hangers, on cantilever
//      arms at the rig's two ends, in the open. They are built at the sizes the
//      camera gives (0.48 m across, 0.98 m long, bottoms 0.96 m clear), and
//      what is NOT known about them — make, fill, swivel — is in `absent`.
//
// Colours are DATA — every hex comes from the `colors` block of the photo
// document's `pulsefitness` section, and every role has a per-role provenance
// line in `colorSources`, including the two that ship as SHADOW reads against
// the project's usual rule and say so. Surfaces come from the procedural
// material library (campus-materials.js): the colours stay this section's
// sourced hexes, the library only supplies microstructure. Deterministic: the
// library is seeded and this file's own variation comes from `hash` off the
// section's pinned seed. Nothing in the chain reads a clock or a random source.
import * as THREE from "../vendor/three/three.module.min.js";
import { overlayLift } from "./campus-overlay.js";
import { sharedMaterialLibrary } from "./campus-materials.js";

let LIB = null;
const lib = () => (LIB ??= sharedMaterialLibrary(THREE));

/* Powder-coated steel — the orange horizontals and the charcoal posts. */
const painted = (color) => lib().get("metalPanel", { color, metalness: 0.35, roughness: 0.55 });
/* Vinyl bag skin and webbing: matte, not metal. */
const vinyl = (color) => lib().get("stucco", { color, roughness: 0.85, normalScale: 0.35 });
const webbing = (color) => lib().get("woodSlat", { color, roughness: 0.9, normalScale: 0.4 });

/** Deterministic 0..1 from any integer mix — a reload rebuilds the same rig. */
function hash(...ns) {
  let s = 0;
  for (let i = 0; i < ns.length; i++) s = s * 131.71 + ns[i] * 57.13 + 7.9;
  const v = Math.sin(s) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * One InstancedMesh from a list of placements. `place` returns
 * `{ x, y, z, rot?, rotX?, rotZ?, scale? }`; rotation composes YXZ, so `rot`
 * (about Y) is applied first and `rotX`/`rotZ` tilt in the frame it leaves.
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

/** A unit cylinder whose axis lies along local +X, so a bare position aims it
 *  along the rig's own axis without a rotation. Scaled per instance. */
function tubeX(radius, segments = 8) {
  const g = new THREE.CylinderGeometry(radius, radius, 1, segments, 1);
  g.rotateZ(Math.PI / 2);
  return g;
}

/** A unit cylinder whose axis lies along local +Z — the rungs and the bag arms. */
function tubeZ(radius, segments = 8) {
  const g = new THREE.CylinderGeometry(radius, radius, 1, segments, 1);
  g.rotateX(Math.PI / 2);
  return g;
}

/* ------------------------------------------------------------------ layout */

/**
 * The rig's post grid in world plan, east to west, near row first.
 * East is +x, so post k of a row sits at `frameEast - k * bayPitch`.
 */
function postGrid(R) {
  const frameEast = R.centre[0] + R.frameLength / 2;
  const out = [];
  for (let row = 0; row < R.rows; row++) {
    for (let k = 0; k < R.uprightsPerRow; k++) {
      out.push({ row, k, x: frameEast - k * R.bayPitch, z: R.rowZ[row] });
    }
  }
  return out;
}

/** The x of a bay's two ends, bay 0 being the easternmost. */
function bayX(R, bay0, bays) {
  const frameEast = R.centre[0] + R.frameLength / 2;
  return [frameEast - bay0 * R.bayPitch, frameEast - (bay0 + bays) * R.bayPitch];
}

/* ------------------------------------------------------------------- build */

function buildFrame(section, group, datum, seatAt, counts) {
  const R = section.rig;
  const C = section.colors;
  const posts = postGrid(R);
  const plate = R.footingPlate;

  /* Footings first: each is a levelling pier from this post's OWN ground up to
     the one datum the rigid frame stands on. On the flat pad every one of them
     is the declared 16 mm plate; on a slope the low corner grows a pier instead
     of the frame hovering or the post burying itself. */
  const footings = posts.map((p) => {
    const ground = seatAt(p.x, p.z);
    const top = datum + plate[1];
    const h = Math.max(plate[1], top - ground);
    return { x: p.x, y: top - h / 2, z: p.z, scale: [plate[0], h, plate[2]] };
  });
  group.add(instanced(new THREE.BoxGeometry(1, 1, 1), painted(C.footingPlate), footings, (it) => it));
  counts.footings = footings.length;

  /* Uprights stand ON the plates and top out at the MEASURED frame height above
     the paving, so the plate is inside the 2.89 m, not added to it. */
  const base = datum + plate[1];
  const upH = R.frameHeight - plate[1];
  const uprights = posts.map((p) => ({
    x: p.x, y: base + upH / 2, z: p.z,
    scale: [R.uprightSection, upH, R.uprightSection],
  }));
  group.add(instanced(new THREE.BoxGeometry(1, 1, 1), painted(C.frameCharcoal), uprights, (it) => it));
  counts.uprights = uprights.length;

  /* Two chords per row, at the two measured heights. */
  const chords = [];
  for (const ch of R.chords) {
    for (let row = 0; row < R.rows; row++) {
      chords.push({
        x: R.centre[0], y: datum + ch.height, z: R.rowZ[row],
        scale: [R.frameLength, 1, 1],
      });
    }
  }
  group.add(instanced(tubeX(R.chordSection / 2, 10), painted(C.safetyOrange), chords, (it) => it));
  counts.chords = chords.length;
}

function buildBars(section, group, datum, counts) {
  const R = section.rig;
  const C = section.colors;
  const orange = [];
  const grip = [];

  /* The monkey-bar bridge: rungs across the two rows, over the measured extent.
     The rung PITCH is the section's [estimated] figure, and it is read from the
     section rather than divided out here so the two can never drift apart. */
  const MB = R.monkeyBridge;
  const [bx0, bx1] = bayX(R, MB.bay0, MB.bays);
  const span = bx0 - bx1;
  const rungs = [];
  for (let i = 0; i < MB.rungCount; i++) {
    rungs.push({
      x: bx0 - (span - (MB.rungCount - 1) * MB.rungPitch) / 2 - i * MB.rungPitch,
      y: datum + MB.height,
      z: (R.rowZ[0] + R.rowZ[1]) / 2,
      scale: [1, 1, R.rowSpacing],
    });
  }
  group.add(instanced(tubeZ(R.gripBarDiameter / 2, 8), painted(C.frameCharcoal), rungs, (it) => it));
  counts.monkeyRungs = rungs.length;

  for (const b of R.pullUpBars) {
    const [x0, x1] = bayX(R, b.bay0, b.bays);
    grip.push({ x: (x0 + x1) / 2, y: datum + b.height, z: R.rowZ[b.row], scale: [x0 - x1, 1, 1] });
  }
  group.add(instanced(tubeX(R.gripBarDiameter / 2, 10), painted(C.frameCharcoal), grip, (it) => it));
  counts.pullUpBars = grip.length;

  for (const b of R.lowerRails) {
    const [x0, x1] = bayX(R, b.bay0, b.bays);
    orange.push({ x: (x0 + x1) / 2, y: datum + b.height, z: R.rowZ[b.row], scale: [x0 - x1, 1, 1] });
  }
  group.add(instanced(tubeX(R.chordSection / 2, 10), painted(C.safetyOrange), orange, (it) => it));
  counts.lowerRails = orange.length;
}

/**
 * The two cantilever arms and the two heavy bags. The arm runs from the top of
 * the end upright OUTWARD along the rig's axis and drops the measured 0.112 m
 * over its 0.73 m, which is where the hanger picks the bag up.
 */
function buildBags(section, group, datum, counts) {
  const R = section.rig;
  const B = section.bags;
  const C = section.colors;
  const frameEast = R.centre[0] + R.frameLength / 2;
  const frameWest = R.centre[0] - R.frameLength / 2;

  const arms = [];
  const bags = [];
  const straps = [];

  for (const arm of R.bagArms) {
    const east = arm.end === "east";
    const rootX = east ? frameEast : frameWest;
    const tipX = east ? rootX + arm.projection : rootX - arm.projection;
    const dy = arm.tipHeight - arm.rootHeight;
    const len = Math.hypot(arm.projection, dy);
    arms.push({
      x: (rootX + tipX) / 2,
      y: datum + (arm.rootHeight + arm.tipHeight) / 2,
      z: R.rowZ[0],
      /* +X tube tilted in the XY plane; east arms drop away from the frame, west
         arms drop the other way, so the sign of the roll follows the end. */
      rotZ: east ? Math.atan2(dy, arm.projection) : -Math.atan2(dy, arm.projection),
      scale: [len, 1, 1],
    });

    const item = B.items.find((b) => b.arm === arm.key);
    bags.push({
      key: item.key,
      x: tipX,
      y: datum + B.topHeight - B.length / 2,
      z: R.rowZ[0],
      scale: [B.diameter, B.length, B.diameter],
    });

    /* Two straps per bag, splayed from the arm tip to the bag's top rim. */
    for (let s = 0; s < B.hangerStraps; s++) {
      const off = (s === 0 ? -1 : 1) * B.diameter * 0.32;
      const drop = B.hangerLength;
      straps.push({
        x: tipX + off / 2,
        y: datum + arm.tipHeight - drop / 2,
        z: R.rowZ[0],
        rotZ: Math.atan2(off, -drop),
        scale: [B.hangerWidth, Math.hypot(drop, off), 0.004],
      });
    }
  }

  group.add(instanced(tubeX(R.chordSection / 2, 10), painted(C.safetyOrange), arms, (it) => it));
  counts.bagArms = arms.length;
  group.add(instanced(new THREE.BoxGeometry(1, 1, 1), webbing(C.hangerWebbing), straps, (it) => it));
  counts.hangers = straps.length;

  /* The bags themselves are the only thing here with any per-instance variation:
     a real hung bag is never square to the frame. The angle is hashed off the
     section's pinned seed, so it is the same on every reload and on every
     machine, and it is small enough that no part of the bag leaves the arm. */
  const bagGeo = new THREE.CylinderGeometry(0.5, 0.47, 1, 16, 1);
  group.add(instanced(bagGeo, vinyl(C.bagBlack), bags, (it, i) => ({
    ...it,
    rot: (hash(section.seed, i, 11) - 0.5) * 0.5,
  })));
  counts.bags = bags.length;
}

/* --------------------------------------------------------------------- api */

/**
 * Every system the section may declare, mapped to the count key that is
 * non-zero only if that system actually put geometry in the group. An unknown
 * key throws rather than shipping uncounted and undrawn.
 */
const SYSTEM_GEOMETRY = {
  rig: "uprights",
  bags: "bags",
};

/**
 * Build Pulse's outdoor fitness zone.
 *
 * `photo` is the loaded photo-detail document; this reads only its
 * `pulsefitness` section and writes nothing back, and returns `{ group, counts }`
 * (empty and harmless if the section is missing, so a half-wired boot still
 * runs). `surfaceAt` — the height of the DRAWN terrain triangle — places
 * everything, because everything here stands on the paving; `heightAt` is only
 * a fallback and would put the rig under the visible ground on any cell where
 * the drawn mesh bows above the sampled grid.
 *
 * THE SEATING DATUM is `surfaceAt + overlayLift(section.groundDatum.rung)`,
 * because campus-eighth.js draws the walkway this rig stands on as a decal one
 * rung up. The rig is RIGID: the frame is built on the highest of its fourteen
 * post seats and each footing is extended down to its own, so the frame never
 * shears and no post ever hangs in the air.
 */
export function createPhotoPulseFitness(scene, { photo, heightAt, surfaceAt } = {}) {
  const group = new THREE.Group();
  group.name = "photo-pulse-fitness";
  const section = photo?.pulsefitness;
  if (!section) {
    scene?.add(group);
    return { group, counts: {} };
  }
  const ground = surfaceAt || heightAt;
  if (typeof ground !== "function") {
    throw new Error("campus-photo-pulsefitness: needs surfaceAt (or heightAt) to place on the ground");
  }
  const rung = section.groundDatum?.rung;
  if (!rung) {
    throw new Error("campus-photo-pulsefitness: the section must declare groundDatum.rung — a rig seated on the raw terrain stands under Eighth's own paving decal");
  }
  const datumLift = overlayLift(rung);
  const seatAt = (x, z) => ground(x, z) + datumLift;

  /* One datum for the whole welded frame: the HIGHEST post seat, so that on a
     slope the footings grow downward instead of the frame floating. */
  const datum = postGrid(section.rig).reduce((m, p) => Math.max(m, seatAt(p.x, p.z)), -Infinity);

  const counts = {};
  buildFrame(section, group, datum, seatAt, counts);
  buildBars(section, group, datum, counts);
  buildBags(section, group, datum, counts);

  scene?.add(group);
  counts.datumLift = datumLift;
  counts.datum = datum;
  for (const key of Object.keys(SYSTEM_GEOMETRY)) {
    if (!(counts[SYSTEM_GEOMETRY[key]] > 0)) {
      throw new Error(`campus-photo-pulsefitness: the section declares "${key}" but nothing was built for it`);
    }
  }
  counts.built = Object.keys(SYSTEM_GEOMETRY);
  counts.systems = counts.built.length;
  counts.draws = group.children.length;
  return { group, counts };
}
