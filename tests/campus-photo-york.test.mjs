/* York Hall's photo-sourced detail section.
 *
 * INVENTED class, so the gates are about quarantine and about not
 * contradicting the measured world:
 *
 *   - it is labelled, epoch-stamped, sourced, and it says what it left out;
 *   - colours are data, and they are hex — measured off the 2024
 *     post-retrofit photography, the current epoch;
 *   - every facade hangs off two points ON the DRAWN York mass — the arcgis
 *     ring campus-massing.js extrudes, carried verbatim in measured.mass —
 *     except the service tower, which the facilities inventory does not
 *     trace and which keeps the survey ring; outward normals genuinely point
 *     out of the mass, and no layer floats more than a metre proud;
 *   - LiDAR decides height: the dressing solves on the drawn prism (the
 *     massHeights read campus-massing extrudes), the West bar is the sourced
 *     TWO storeys over the arcade, and the field behind the fins is CMU,
 *     not glass;
 *   - the sourced-vs-drawn column-count conflict is carried, not resolved
 *     by guessing — bay from the drawing, length from LiDAR;
 *   - the south end is [estimated] and SAYS so, naming the sourced north
 *     pattern it extends; service dock/trash stay unbuilt and declared;
 *   - nothing solid sits inside a measured footprint or within 3 m of the
 *     corridor-staging centreline;
 *   - the module builds deterministically, seats its ground objects on a
 *     ROLLING sampler (a flat fake sampler hid real floaters before), and
 *     wears the material library;
 *   - and York is built exactly ONCE: the revelle module no longer draws it.
 *
 * The section will live under the `york` key of campus-photo-detail.json;
 * until the main session merges it, it is read from the build-side file the
 * York agent wrote, so this test does not depend on the merge having
 * happened — the fallback goes away with the merge, exactly as Keeling's did.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as THREE from "../docs/vendor/three/three.module.min.js";
import { createPhotoYork } from "../docs/js/campus-photo-york.js";
import { assembleMasses } from "../docs/js/campus-massing.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(p, "utf8"));

/* PHOTO_DETAIL lets a repair agent (or the merge review) run this whole file
   against a candidate section BEFORE it lands in the shipped document; unset,
   it reads what actually ships. */
const section = read(process.env.PHOTO_DETAIL || join(root, "docs/data/campus-photo-detail.json")).york;

const campus = read(join(root, "docs/data/campus-3d.json"));
const staging = read(join(root, "docs/data/corridor-staging.json"));
const SURVEY = campus.buildings.find((b) => b.n === "York Hall").p;
const LIDAR_H = campus.buildings.find((b) => b.n === "York Hall").h;
/* v3: the membrane solves on the DRAWN mass — the arcgis ring + LiDAR
   massHeights pair campus-massing.js extrudes — so the dressing sits on the
   visible wall and the coping on the visible parapet. Pre-merge sections
   without the mass block still solve on the survey ring. */
const MASS = section?.measured?.mass;
const RING = MASS?.ring ?? SURVEY;

const inRing = (x, z, r) => {
  let ins = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, zi] = r[i];
    const [xj, zj] = r[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
};

/** Distance from a point to the nearest edge of a ring. */
function toRingEdge(x, z, r = RING) {
  let best = Infinity;
  for (let i = 0; i < r.length; i++) {
    const [ax, az] = r[i];
    const [bx, bz] = r[(i + 1) % r.length];
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz;
    let t = len2 ? ((x - ax) * dx + (z - az) * dz) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
}

function toRoute(x, z) {
  const line = staging.route.points;
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, az] = line[i];
    const [bx, bz] = line[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz;
    let t = len2 ? ((x - ax) * dx + (z - az) * dz) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
    if (d < best) best = d;
  }
  return best;
}

/* The tower is real [DPR Image 4] but ABSENT from the facilities massing —
   its facades stay on the survey ring; everything else hangs on the drawn
   ring campus-massing.js extrudes. */
const ringFor = (f) => (MASS && f.structure !== "tower" ? RING : SURVEY);

/* York's envelope, taken from the measured ring rather than typed in. */
function yorkBounds(pad = 25) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z] of RING) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x);
    z0 = Math.min(z0, z); z1 = Math.max(z1, z);
  }
  return { x0: x0 - pad, z0: z0 - pad, x1: x1 + pad, z1: z1 + pad };
}

/** Every solid thing the section stands on the ground, as (x, z). */
function solids() {
  if (!section) return [];
  const out = [];
  for (const p of section.courtyards.items) out.push([p.x, p.z]);
  for (const r of section.westGround.racks) out.push([r.x, r.z]);
  const E = section.eastSide;
  for (const seg of [E.retainingWall, E.ramp]) {
    const n = Math.ceil(Math.hypot(seg.b[0] - seg.a[0], seg.b[1] - seg.a[1]) / 2);
    for (let i = 0; i <= n; i++) {
      out.push([seg.a[0] + ((seg.b[0] - seg.a[0]) * i) / n, seg.a[1] + ((seg.b[1] - seg.a[1]) * i) / n]);
    }
  }
  return out;
}

/** Ground decals — allowed anywhere on the ground, never inside a wall. */
function decals() {
  if (!section) return [];
  const out = [];
  const rects = [...section.westGround.mulch, section.eastSide.parking];
  for (const r of rects) for (const x of [r.x0, r.x1]) for (const z of [r.z0, r.z1]) out.push([x, z]);
  return out;
}

/** The outermost sampled line of every facade layer, at its reach. */
function facadePoints() {
  if (!section) return [];
  const out = [];
  const reach = Math.max(
    section.finSystem.standoff + section.finSystem.proudHaunch,
    section.arcade.columnStandoff + section.arcade.capital
  );
  for (const f of section.facades) {
    const nl = Math.hypot(f.out[0], f.out[1]);
    const nx = f.out[0] / nl;
    const nz = f.out[1] / nl;
    const n = Math.ceil(Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]) / 2);
    for (let i = 0; i <= n; i++) {
      const x = f.a[0] + ((f.b[0] - f.a[0]) * i) / n;
      const z = f.a[1] + ((f.b[1] - f.a[1]) * i) / n;
      out.push([x + nx * reach, z + nz * reach]);
    }
  }
  return out;
}

/* ---------------------------------------------------------------- gates */

test("the section exists and is reachable", () => {
  assert.ok(section, "no york section in the merged document or the build-side file");
});

test("it says what it is, where it came from, and what it left out", () => {
  assert.match(section.label, /York/i);
  assert.match(section.label, /four/i, "the four-structure finding is the headline");
  assert.ok(section.epoch, "no epoch stamp");
  assert.match(section.epoch, /2024/, "the current epoch is the 2024 post-retrofit photography");
  assert.match(section.note, /INVENTED/, "the note must declare the class");
  assert.ok(Array.isArray(section.sources) && section.sources.length >= 8);
  for (const url of section.sources) assert.match(url, /^https:\/\//);
  assert.ok(Array.isArray(section.absent) && section.absent.length >= 12,
    `absent has ${section.absent?.length} entries — this list does not shrink`);
  for (const gap of section.absent) assert.equal(typeof gap, "string");
  assert.ok(section.absent.some((a) => /south end/i.test(a)),
    "the sourceless south end must stay declared");
  assert.ok(section.absent.some((a) => /dock|trash/i.test(a)),
    "the unbuilt service condition must stay declared");
  assert.ok(section.absent.some((a) => /signage|serif/i.test(a)),
    "the unbuilt 'York Hall' lettering must stay declared");
  assert.ok(section.absent.some((a) => /35 sourced columns/i.test(a)),
    "the unreconciled column count must stay on the record");
});

test("colours are data, hex, and the right epoch", () => {
  const keys = Object.keys(section.colors);
  assert.ok(keys.length >= 18, `only ${keys.length} colours`);
  for (const [k, v] of Object.entries(section.colors)) {
    assert.match(v, /^#[0-9a-f]{6}$/, `${k} is not a lowercase 6-digit hex`);
  }
  /* The measured CMU values, verbatim from the inventory (lpa-york-1, 2024). */
  assert.equal(section.colors.cmuSunlit, "#b6956d");
  assert.equal(section.colors.cmuShaded, "#967e60");
  assert.equal(section.colors.precastAmbient, "#cbc6ba");
  /* The CMU is warm golden tan — r > g > b — and the white precast reads
     brighter than the block field it frames. */
  const ch = (h, i) => parseInt(h.slice(i, i + 2), 16);
  const c = section.colors.cmuSunlit;
  assert.ok(ch(c, 1) > ch(c, 3) && ch(c, 3) > ch(c, 5), "cmuSunlit is not a warm tan");
  const luma = (h) => 0.299 * ch(h, 1) + 0.587 * ch(h, 3) + 0.114 * ch(h, 5);
  assert.ok(luma(section.colors.precastAmbient) > luma(section.colors.cmuSunlit),
    "the repainted white fins must read brighter than the CMU field");
});

test("LiDAR decides height: the dressing solves on the drawn prism", () => {
  assert.equal(section.measured.building, "York Hall");
  assert.equal(section.measured.lidarHeight, LIDAR_H, "lidarHeight drifted from the survey");
  if (MASS) {
    /* v3: measured.mass must be the EXACT ring + height campus-massing.js
       extrudes — anything else and the membrane floats off the visible wall,
       which is precisely what the 2026-08-17 audit photographed. */
    const lidarFile = read(join(root, "docs/data/campus-lidar.json"));
    const arcgis = read(join(root, "docs/data/campus-arcgis.json"));
    const drawn = assembleMasses({ campus, lidar: lidarFile, arcgis, colors: null })
      .find((m) => m.name === "York Hall" && m.src === "gis");
    assert.ok(drawn, "no drawn 'York Hall' gis mass — the wall the membrane hangs on is gone");
    assert.equal(MASS.h, drawn.h, "measured.mass.h drifted from the height campus-massing.js extrudes");
    assert.deepEqual(MASS.ring, drawn.rings[0],
      "measured.mass.ring must be the drawn mass's outer ring, byte for byte");
    /* The prism is 4 levels; storey height is the prism read back, and the
       whole membrane fits inside it. */
    const g = section.grid;
    assert.equal(g.storeys, 4, "the drawn prism is 4 levels [arcgis]");
    assert.ok(Math.abs(g.storeys * g.floorToFloor - MASS.h) < 1e-9,
      `${g.storeys} x ${g.floorToFloor} != drawn prism ${MASS.h}`);
    assert.match(g.source, /CONFLICT/i, "the 5.0 m estimate stays on the record as a declared conflict");
  } else {
    /* pre-merge shape: per-structure dressed roofs against the survey h. */
    for (const [k, s] of Object.entries(section.structures)) {
      assert.ok(s.roof <= LIDAR_H + 1e-9, `${k} dresses above the measured height`);
    }
  }
  /* The tower rises only 'slightly' above the parapet. */
  assert.ok(section.structures.tower.cap > 0 && section.structures.tower.cap <= 2.5);
});

test("the grid is the drawing read back: 6 ft fins, 12 ft bays, real CMU coursing", () => {
  const g = section.grid;
  assert.equal(g.finModule, 1.829, "fin centres are the drawn 6 ft");
  assert.equal(g.arcadeBay, 3.658, "the arcade bay is the drawn 12'-0\" — exactly 2 fins per bay");
  assert.ok(Math.abs(g.arcadeBay - 2 * g.finModule) < 1e-9);
  assert.equal(g.cmuCourse, 0.203, "8 in block courses");
  assert.equal(g.cmuUnit, 0.406, "16 in block units");
  if (MASS) {
    assert.equal(g.floorToFloor, MASS.h / 4, "storey height is the drawn prism over its 4 levels");
  } else {
    assert.equal(g.floorToFloor, 5.0, "the measured 5.0 m lab floor-to-floor");
  }
});

test("the column-count conflict is carried, not resolved by guessing", () => {
  const A = section.arcade;
  assert.equal(A.columnsSourced, 35, "the sourced count stays on the record");
  assert.match(A.note, /UNRECONCILED/i, "and the note says it does not reconcile");
  /* Bay from the drawing, length from LiDAR: the built row must be
     floor(measured west edge / 3.658) + 1 — NOT 35. */
  const west = section.facades.find((f) => f.id === "west");
  const len = Math.hypot(west.b[0] - west.a[0], west.b[1] - west.a[1]);
  assert.ok(Math.abs(len - 91.44) < 2, `the west face reads ${len.toFixed(1)} m, not the sourced 300 ft`);
  assert.equal(Math.floor(len / A.bay) + 1, MASS ? 25 : 26,
    "the drawn bay over the drawn west edge gives the built row — NOT 35");
});

test("every facade hangs ON the drawn ring and faces out of the mass", () => {
  for (const f of section.facades) {
    const r = ringFor(f);
    for (const p of [f.a, f.b]) {
      assert.ok(toRingEdge(p[0], p[1], r) < 0.15,
        `${f.id}: ${JSON.stringify(p)} is ${toRingEdge(p[0], p[1], r).toFixed(2)} m off its ring`);
    }
    assert.notDeepEqual(f.a, f.b, `${f.id} is a zero-length face`);
    assert.ok(Math.hypot(f.out[0], f.out[1]) > 0.9, `${f.id} has no outward normal`);
    /* Half a metre along the normal must leave the polygon; half a metre
       against it must enter it. (A centroid test fails on a comb — the
       courtyard faces legitimately point toward the centroid.) */
    const mx = (f.a[0] + f.b[0]) / 2;
    const mz = (f.a[1] + f.b[1]) / 2;
    assert.ok(!inRing(mx + f.out[0] * 0.5, mz + f.out[1] * 0.5, r),
      `${f.id}'s normal points into the building`);
    assert.ok(inRing(mx - f.out[0] * 0.5, mz - f.out[1] * 0.5, r),
      `${f.id} does not back onto the mass`);
    assert.match(f.source, /\w/, `${f.id} has no source`);
    assert.ok(section.structures[f.structure], `${f.id} names unknown structure ${f.structure}`);
  }
  /* All five structures wear at least one dressed face. Coverage: on the
     survey ring the facades tile the whole perimeter; the drawn facilities
     ring carries notches, jogs and a stair bump that stay undressed
     (declared in absent[]), so the non-tower facades must cover most — but
     never more than — its perimeter. */
  for (const k of ["west", "north", "south", "lecture", "tower"]) {
    assert.ok(section.facades.some((f) => f.structure === k), `${k} has no dressed face`);
  }
  const perim = RING.reduce((s, p, i) => {
    const q = RING[(i + 1) % RING.length];
    return s + Math.hypot(q[0] - p[0], q[1] - p[1]);
  }, 0);
  const covered = section.facades.reduce(
    (s, f) => s + (MASS && f.structure === "tower" ? 0 : Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1])), 0);
  if (MASS) {
    assert.ok(covered > 0.75 * perim && covered < perim,
      `facades cover ${covered.toFixed(1)} m of a ${perim.toFixed(1)} m drawn ring — a face is missing or doubled`);
    assert.ok(section.absent.some((a) => /notch|jog|stair bump/i.test(a)),
      "the undressed drawn notches must be declared");
  } else {
    assert.ok(Math.abs(covered - perim) < 2,
      `facades cover ${covered.toFixed(1)} m of a ${perim.toFixed(1)} m ring — a face is missing or doubled`);
  }
});

test("the sourceless south end is [estimated] and names its pattern", () => {
  const wing = section.facades.find((f) => f.id === "south-end-wing");
  const bar = section.facades.find((f) => f.id === "south-end-bar");
  const east = section.facades.find((f) => f.id === "south-end-wing-east");
  for (const f of [wing, bar, ...(east ? [east] : [])]) {
    assert.ok(f, "the south end facades exist — the face is built, not skipped");
    assert.equal(f.estimated, true, `${f.id} must be declared [estimated]`);
    assert.match(f.source, /estimated/i);
    const ref = section.facades.find((x) => x.id === f.patternRef);
    assert.ok(ref, `${f.id}'s patternRef names unknown face ${f.patternRef}`);
    assert.ok(!ref.estimated, `${f.id} extends ${ref.id}, which must itself be sourced`);
    assert.equal(ref.structure === "west", f.structure === "west",
      "the pattern comes from the same structure family");
    assert.equal(ref.finStoreys, f.finStoreys, "the extension keeps the sibling's storey count");
  }
});

test("two fin storeys on the west, four on the wings, CMU not glass", () => {
  const west = section.facades.find((f) => f.id === "west");
  assert.equal(west.system, "westFace");
  assert.equal(west.finStoreys, 2,
    "STRUCTURE: 'two-story concrete lift slab and CMU shear wall structure' — not three");
  if (!MASS) {
    assert.equal(west.finBase, section.arcade.height, "the fin storeys start above the arcade");
  }
  for (const id of ["north-wing", "north-east", "south-east", "south-end-wing"]) {
    assert.equal(section.facades.find((f) => f.id === id).finStoreys, 4, `${id} is four storeys`);
  }
  /* The bay rhythm is fin + window slot + CMU panel: the window is the
     narrow flush slot, and fin + slot leave most of the bay solid block. */
  const F = section.finSystem;
  assert.ok(F.windowWidth >= 0.35 && F.windowWidth <= 0.5, "narrow flush metal window slots");
  assert.ok(F.width + F.windowWidth < section.grid.finModule * 0.4,
    "most of each bay must stay solid CMU — a glazed-band York reads completely wrong");
  /* The mass figure forbids a deep blade. */
  assert.ok(F.proudHaunch <= 0.3, `fin haunch ${F.proudHaunch} m — do not model a 0.5 m blade`);
  assert.ok(F.proudMid <= 0.2 && F.proudMin < F.proudMid, "spindle profile, ~0.12 m average");
  /* The blank tower has no fins at all. */
  for (const f of section.facades.filter((x) => x.structure === "tower")) {
    assert.equal(f.system, "towerBlank", `${f.id}: the service tower is blank — no fins, no openings`);
  }
});

test("no facade layer floats more than a metre off its measured face", () => {
  const F = section.finSystem;
  const A = section.arcade;
  const reaches = [
    F.standoff + F.proudHaunch,
    F.band.proud + F.standoff,
    A.fascia.proud + 0.05,
    A.columnStandoff + 0.5,
    section.eastSide.doors.standoff + 0.08,
  ];
  for (const r of reaches) {
    assert.ok(r <= 1.0, `a facade layer reaches ${r.toFixed(2)} m off the measured wall`);
  }
});

test("everything sits inside York's envelope", () => {
  const b = yorkBounds();
  for (const [x, z] of [...solids(), ...decals(), ...facadePoints()]) {
    assert.ok(x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1,
      `(${x}, ${z}) is outside York ${JSON.stringify(b)}`);
  }
});

test("nothing invented sits inside a measured building footprint", () => {
  const rings = campus.buildings.filter((b) => b.p && b.p.length >= 3);
  for (const [x, z] of [...solids(), ...decals()]) {
    for (const b of rings) {
      assert.ok(!inRing(x, z, b.p), `(${x}, ${z}) is inside ${b.n || "an unnamed mass"}`);
    }
  }
});

test("no solid object crowds the scooter corridor", () => {
  let worst = Infinity;
  let at = null;
  for (const [x, z] of [...solids(), ...facadePoints()]) {
    const d = toRoute(x, z);
    if (d < worst) { worst = d; at = [x, z]; }
  }
  assert.ok(worst >= 3, `closest solid is ${worst.toFixed(2)} m from the centreline at ${at}`);
});

test("the ground scope stops at York's own aprons — no double-build of the plaza belt", () => {
  /* The plaza landscape module owns the trees, the DG belt (x 66-82) and all
     plaza furniture. York's own ground must stay east of that line. */
  for (const r of section.westGround.mulch) {
    assert.ok(r.x0 >= 82, `mulch bed starts at x=${r.x0}, inside the plaza module's DG belt`);
  }
  for (const r of section.westGround.racks) {
    assert.ok(r.x >= 82, "racks belong to York's own frontage");
  }
  assert.match(section.westGround.source, /plaza landscape/i,
    "the hand-off to the plaza module must be written down");
  assert.ok(section.absent.some((a) => /plaza landscape|dgBelt/i.test(a)),
    "the not-rebuilt-here belt must be declared");
});

test("the courtyards are a podium and say so; roof gear stays curb-scale and placed by the BIM", () => {
  assert.match(section.courtyards.deckNote, /roof/i, "the podium fact must be recorded");
  assert.match(section.courtyards.source, /estimated/i,
    "planter positions are [estimated] and must say so");
  /* Planters inside the courtyard notches: outside the built ring, between
     the wings. */
  for (const p of section.courtyards.items) {
    assert.ok(!inRing(p.x, p.z, RING), `planter (${p.x}, ${p.z}) is inside the measured mass`);
  }
  const L = section.roof.louvreWell;
  assert.equal(L.structure, "north", "the louvre well is the north wing's [BIM]");
  assert.match(L.source, /estimated/i, "blade heights are [estimated] and must say so");
  assert.ok(L.bladeHeight <= 1.5, "roof relief stays curb-scale over the LiDAR maximum");
  assert.equal(section.roof.penthouse.structure, "south",
    "the mechanical penthouse is the four-storey south wing's [BIM]");
  assert.match(section.roof.westNote, /clean|coping/i, "York West's roof stays clean [sourced]");
});

test("york is built exactly once: the revelle module no longer draws it", () => {
  const src = readFileSync(join(root, "docs/js/campus-photo-revelle.js"), "utf8");
  assert.ok(!/buildYork/.test(src), "campus-photo-revelle.js still has buildYork");
  assert.ok(!/systems\.yorkArcade\.|systems\.yorkFins\./.test(src),
    "campus-photo-revelle.js still reads the legacy york keys");
});

/* ----------------------------------------------- the module, run for real */

const flatGround = () => 21.0;
const build = (g = flatGround) =>
  createPhotoYork(null, { photo: { york: section }, heightAt: g, surfaceAt: g });

test("the module builds the section: structure and counts", () => {
  const a = build();
  assert.ok(a.group instanceof THREE.Group);
  assert.equal(a.counts.facades, section.facades.length);
  assert.equal(a.counts.arcadeColumns, MASS ? 25 : 26,
    "the west arcade row is the drawn bay over the drawn west edge");
  assert.ok(a.counts.courtColumns >= 20, "both courtyard arcades are built");
  assert.ok(a.counts.fins >= 400, `only ${a.counts.fins} fins — the membrane is the building`);
  assert.ok(a.counts.windows === a.counts.fins, "one narrow slot beside every fin");
  assert.ok(a.counts.cmuPanels > 30, "the CMU field is built per storey per face");
  assert.ok(a.counts.doors > 10, "the east corridor door runs are built");
  assert.equal(a.counts.planters, 6);
  assert.ok(a.counts.roofBlades > 40, "the north wing louvre rows are built");
});

test("two builds are byte-identical — no hidden randomness", () => {
  const a = build();
  const b = build();
  assert.deepEqual(a.counts, b.counts);
  const sig = (r) => {
    const out = [];
    r.group.traverse((o) => {
      if (o.isInstancedMesh) out.push(Array.from(o.instanceMatrix.array));
      else if (o.isMesh) out.push([o.position.x, o.position.y, o.position.z]);
    });
    return out;
  };
  assert.deepEqual(sig(a), sig(b));
});

test("ground objects seat on a ROLLING sampler — nothing floats, nothing buries", () => {
  /* A flat fake sampler hid real floaters before: it cannot tell y = ground
     from y = 21. This terrain rolls +/- 3.5 m across York's extent, so a
     mis-seated object misses by metres. */
  const sloped = (x, z) => 21 + 2 * Math.sin(x / 18) + 1.5 * Math.cos(z / 23);
  const { group } = build(sloped);
  const gr = group.children.find((c) => c.name === "york-ground");
  assert.ok(gr, "no york-ground group");
  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  let seen = 0;
  gr.traverse((o) => {
    if (!o.isInstancedMesh) return;
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m);
      m.decompose(pos, q, sc);
      const dy = pos.y - sloped(pos.x, pos.z);
      assert.ok(dy > -0.7 && dy < 4.0,
        `a ground instance at (${pos.x.toFixed(1)}, ${pos.z.toFixed(1)}) sits ${dy.toFixed(2)} m off the rolling terrain`);
      seen++;
    }
  });
  assert.ok(seen > 60, `only ${seen} ground instances sampled`);

  /* Ground decals are DRAPED: every vertex hugs the rolling surface. */
  group.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  let decalMeshes = 0;
  let verts = 0;
  gr.traverse((o) => {
    if (!o.isMesh || o.name !== "ground-decal") return;
    decalMeshes++;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
      const dy = v.y - sloped(v.x, v.z);
      assert.ok(dy > -0.02 && dy < 0.3,
        `ground-decal vertex at (${v.x.toFixed(1)}, ${v.z.toFixed(1)}) sits ${dy.toFixed(2)} m off the terrain`);
      verts++;
    }
  });
  assert.ok(decalMeshes >= 5, `only ${decalMeshes} draped ground decals`);
  assert.ok(verts > 150, `only ${verts} draped vertices checked`);
});

test("the facade layers stay on the massing: between base and the LiDAR roof", () => {
  const { group } = build();
  const base = flatGround();
  const top = base + LIDAR_H + section.structures.tower.cap + 0.5;
  let seen = 0;
  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  for (const c of group.children) {
    if (!c.isInstancedMesh) continue;
    for (let i = 0; i < c.count; i++) {
      c.getMatrixAt(i, m);
      pos.setFromMatrixPosition(m);
      assert.ok(pos.y > base - 1, `a facade instance sits at y=${pos.y}, under the base`);
      assert.ok(pos.y < top, `a facade instance floats at y=${pos.y}, over the tower cap`);
      seen++;
    }
  }
  assert.ok(seen > 500, `only ${seen} facade instances sampled`);
});

test("the material library is on the surfaces, and only deterministic sources", () => {
  const { group } = build();
  let textured = 0;
  let glass = 0;
  group.traverse((o) => {
    if (o.isMesh && o.material) {
      if (o.material.map && o.material.normalMap && o.material.roughnessMap) textured++;
      if (o.material.transparent && o.material.opacity < 1 && o.material.envMapIntensity > 1) glass++;
    }
  });
  assert.ok(textured >= 30, `only ${textured} textured meshes — the library is not applied`);
  /* The lecture doors stay true library glass. The window slots do NOT: they
     are flush METAL-framed glazing [DPR], and transparent glass vanished
     against the CMU panel behind each slot — the 2026-08-17 audit's missing
     window rhythm — so they ride the opaque dark metal class instead. */
  assert.ok(glass >= 1, "the lecture doors do not carry the library's reflective glass");
  const winSrc = readFileSync(join(root, "docs/js/campus-photo-york.js"), "utf8");
  assert.match(winSrc, /painted\(colors\.windowGlass\), bins\.windows/,
    "window slots must be opaque dark metal, not transparent glass");
  const src = readFileSync(join(root, "docs/js/campus-photo-york.js"), "utf8");
  assert.match(src, /createMaterialLibrary/, "surfaces come from campus-materials.js");
  assert.match(src, /get\("brick"/, "the CMU rides a coursed block class, not flat colour");
  assert.ok(!/Math\.random|Date\.now/.test(src), "no nondeterminism in the builder");
});
