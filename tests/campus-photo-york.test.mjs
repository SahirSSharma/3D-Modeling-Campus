/* York Hall's photo-sourced detail section — INVENTED class.
 *
 * The R1 revision rewrote this file around one lesson: the Eighth audit
 * proved that twenty-two PRESENCE gates pass happily over wholesale
 * fabricated values. So the gates here check ARITHMETIC and GEOMETRY, and a
 * figure that is replaced by a self-consistent invention has to fail:
 *
 *   - every drawn dimension is recomputed HERE, independently, out of the
 *     section's own pinned citations, and is then checked both against the
 *     section's stated derivation and against the field the module reads;
 *   - no drawn number may simply appear: it is derived, or it is a labelled
 *     [estimated] that names the sourced pattern it extends, or it is a read
 *     that names its frame and the tolerance that frame supports;
 *   - the LiDAR readings the whole building solves on — rimBase and the
 *     per-face grounds — are RE-SAMPLED here from campus-lidar.json through
 *     campus-terrain.js, so measured.parts cannot drift from the terrain;
 *   - colours are data, they are hex, and EVERY one of the 21 has a
 *     colorSources line with a tier — including the nine that ship as
 *     `sourced` off a frame that is not on disk and say so;
 *   - measured.mass is the EXACT ring and height campus-massing.js extrudes,
 *     byte for byte;
 *   - the sourced 35-column arcade is BUILT, and the losing 25-column read
 *     stays on the record; absent[] does not shrink and retirements go
 *     through superseded[];
 *   - nothing hovers and nothing sinks — on flat ground, on an exaggerated
 *     slope, and on the REAL drawn LiDAR surface, at every footing;
 *   - nothing this section stands on the ground sits inside a measured
 *     footprint or crosses a surveyed facade;
 *   - the module carries no colour and no dimension of its own, reads only
 *     its own key, and two builds are byte-identical.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as THREE from "../docs/vendor/three/three.module.min.js";
import { createPhotoYork } from "../docs/js/campus-photo-york.js";
import { assembleMasses } from "../docs/js/campus-massing.js";
import { makeSurfaceSampler, makeHeightSampler } from "../docs/js/campus-terrain.js";
import { overlayLift } from "../docs/js/campus-overlay.js";
/* R2 arbitration S1 — the axiom-layer gate. ONE shared apparatus for all six
   Revelle R1 suites; this suite does not fork or reimplement it. */
import {
  assertCoverage, assertEstimateBands, assertPins, assertRelations,
  assertTierSymmetry, assertAbsentEntries, assertExprs, assertDispositions,
} from "./helpers/axiom-gate.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(p, "utf8"));

/* The shipped document is the only source; PHOTO_DETAIL still overrides, so
   a repair agent can run every gate against a candidate document. */
const shipped = read(process.env.PHOTO_DETAIL || join(root, "docs/data/campus-photo-detail.json"));
const section = shipped.york;

const campus = read(join(root, "docs/data/campus-3d.json"));
const staging = read(join(root, "docs/data/corridor-staging.json"));
const lidarFile = read(join(root, "docs/data/campus-lidar.json"));
const SURVEY = campus.buildings.find((b) => b.n === "York Hall").p;
const LIDAR_H = campus.buildings.find((b) => b.n === "York Hall").h;
const MASS = section.measured.mass;
const RING = MASS.ring;

const drawnGround = makeSurfaceSampler(lidarFile.terrain);
const { heightAt: gridGround } = makeHeightSampler(lidarFile.terrain);

const moduleSrc = readFileSync(join(root, "docs/js/campus-photo-york.js"), "utf8");

/** Read a dotted path out of the section, array indices included. */
const at = (obj, path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
const near = (a, b, eps, what) =>
  assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b} (tolerance ${eps})`);

const inRing = (x, z, r) => {
  let ins = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, zi] = r[i];
    const [xj, zj] = r[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
};

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
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
}

/* The tower is real [DPR Image 4] but ABSENT from the facilities massing —
   its facades stay on the survey ring; everything else hangs on the drawn
   ring campus-massing.js extrudes. */
const ringFor = (f) => (f.structure === "tower" ? SURVEY : RING);

/** Every solid thing the section stands on the ground, as (x, z). */
function solids() {
  const out = [];
  for (const p of section.courtyards.items) out.push([p.x, p.z]);
  for (const r of section.westGround.racks) out.push([r.x, r.z]);
  const E = section.eastSide;
  /* The retaining wall was here; it is retired (R2 arbitration P3). */
  for (const seg of [E.ramp]) {
    const n = Math.ceil(Math.hypot(seg.b[0] - seg.a[0], seg.b[1] - seg.a[1]) / 2);
    for (let i = 0; i <= n; i++) {
      out.push([seg.a[0] + ((seg.b[0] - seg.a[0]) * i) / n, seg.a[1] + ((seg.b[1] - seg.a[1]) * i) / n]);
    }
  }
  return out;
}

/** Ground decals — allowed anywhere on the ground, never inside a wall. */
function decals() {
  const M = section.westGround.mulch;
  const [ax, az] = M.wall.a;
  const [bx, bz] = M.wall.b;
  const wallX = (z) => ax + ((bx - ax) * (z - az)) / (bz - az);
  const edge = (z) => Math.min(wallX(z) - section.draw.mulchWallClear, M.xWest + M.widthMax);
  const out = [];
  for (const band of M.bands) {
    for (const z of [band.z0, band.z1]) out.push([M.xWest, z], [edge(z), z]);
  }
  const P = section.eastSide.parking;
  for (const x of [P.x0, P.x1]) for (const z of [P.z0, P.z1]) out.push([x, z]);
  return out;
}

/** The outermost sampled line of every facade layer, at its reach. */
function facadePoints() {
  const D = section.draw;
  const reach = Math.max(
    D.finStandoff + section.finSystem.proudHaunch,
    D.columnStandoff + section.arcade.capital
  );
  const out = [];
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

test("the section exists and carries the whole R1 apparatus", () => {
  assert.ok(section, "no york section in the merge file or the shipped document");
  for (const k of ["label", "epoch", "note", "seed", "architect", "provenance", "sources",
    "sourceFiles", "bounds", "measured", "derivations", "estimates", "reads", "draw",
    "grid", "structures", "finSystem", "arcade", "facades", "eastSide", "courtyards",
    "westGround", "roof", "colors", "colorSources", "colorConflicts", "conflicts",
    "boundary", "counts", "absent", "superseded"]) {
    assert.ok(section[k] !== undefined, `section is missing ${k}`);
  }
  assert.equal(typeof section.seed, "number");
});

test("it says what it is, where it came from, and what it left out", () => {
  assert.match(section.label, /York/i);
  assert.match(section.label, /four/i, "the four-structure finding is the headline");
  assert.match(section.epoch, /2024/, "the current epoch is the 2024 post-retrofit record");
  assert.match(section.epoch, /2008/, "the 2008 grid frame is an older epoch and must be stamped");
  assert.match(section.note, /INVENTED/, "the note must declare the class");
  assert.ok(Array.isArray(section.sources) && section.sources.length >= 8);
  for (const s of section.sources) {
    assert.ok(s.length >= 80, `source is not described: ${s.slice(0, 60)}`);
    assert.match(s, /\b(19|20)\d\d\b/, `source carries no 4-digit date: ${s.slice(0, 60)}`);
  }
  /* The dead named-buildings index is replaced, not merely dropped. */
  const joinedSources = section.sources.join("\n");
  for (const s of section.sources) {
    if (!/facilities\/services\/general\/named\/index\.html/.test(s)) continue;
    assert.match(s, /REPLACES the dead/,
      "the blink URL that 404s may only appear as a named retirement, never as a live citation");
  }
  assert.match(joinedSources, /stewardship\/named-buildings\/york-hall\.html/,
    "the live Blink stewardship page must replace the dead index");
  /* Absent never shrinks — and since R2 arbitration S1(v) it is no longer
     gated by LIST LENGTH, which cannot tell a retirement from a deletion and
     cannot notice a substitution. See the per-entry gate below. */
  for (const gap of section.absent) {
    assert.equal(typeof gap, "string");
    assert.ok(gap.length > 80, `absent entry is a stub: ${gap.slice(0, 50)}`);
  }
});

test("the retirements go through superseded[] and name real evidence", () => {
  const S = section.superseded;
  for (const key of ["grid.finModule=1.829", "grid.arcadeBay=3.658",
    "grid.floorToFloor=3.775", "grid.floorToFloor=5.0", "arcade.builtColumns=25",
    "finSystem.width=0.17", "eastSide.retainingWall.x=146.5"]) {
    assert.ok(S[key], `no superseded record for ${key}`);
    assert.ok(S[key].supersededBy && S[key].evidence.length > 60,
      `${key} is retired without evidence`);
  }
  /* A retirement must not simply delete the loser: the losing read stays
     recoverable from the record. */
  const record = JSON.stringify(section.superseded) + section.grid.source + section.absent.join("\n");
  for (const loser of ["1.829", "3.658", "3.775", "5.0", "25", "0.17", "146.5"]) {
    assert.ok(record.includes(loser), `the retired value ${loser} is gone from the record`);
  }
});

test("the architect is recorded and the date conflict is declared, not averaged", () => {
  const A = section.architect;
  assert.match(A.firm, /Neptune & Thomas/);
  assert.deepEqual(A.principals, ["Donald Neptune", "Joseph Thomas"]);
  assert.equal(A.built, 1966);
  assert.ok(A.source.length > 120 && /STRUCTURE/.test(A.source) && /LPA|Plan\/Design\/Build/.test(A.source),
    "two independent sources must be named for the architect");
  assert.match(A.conflict, /1965/, "the Emeriti 1965 date stays on the record");
});

test("the provenance failure is on the record, not papered over", () => {
  const P = section.provenance;
  assert.ok(P.missing.length >= 5, "the missing-file list is too short to be the real one");
  assert.match(P.missing.join("\n"), /scratchpad/, "the scratchpad paths must be named as missing");
  assert.match(P.refuted, /2 fins per bay|two fins per bay/i,
    "the one refuted inherited claim must be named");
  assert.ok(P.reconfirmedLive.length > 100, "what WAS re-confirmed must be recorded too");
  assert.ok(P.recovered.some((r) => /bb8089859p/.test(r)), "the recovered roof frame must be listed");
  assert.match(P.recovered.join("\n"), /Anubis|UNVERIFIED/,
    "the roof frame's unverified caption must be carried as a caveat");
  /* No source string may still cite a scratchpad path as if it were openable. */
  assert.ok(!/scratchpad\//.test(section.sourceFiles.split("NOT ON DISK")[0]),
    "sourceFiles presents a scratchpad path as an on-disk file");
});

/* ------------------------------------------- the readings, re-sampled */

test("the LiDAR readings are the terrain's, re-sampled here and not asserted", () => {
  const R = section.derivations.readings;
  /* rimBase is the median of groundAt over every drawn ring vertex — the same
     statistic scripts/build-campus-lidar.mjs uses to make massHeights. */
  const gs = RING.map(([x, z]) => gridGround(x, z)).sort((a, b) => a - b);
  const rim = gs[Math.floor(gs.length / 2)];
  assert.equal(R.lidar.ringVertices, RING.length);
  near(R.lidar.rimBase, rim, 5e-3, "readings.lidar.rimBase is not the ring's median ground");
  near(section.measured.rimBase, rim, 5e-3, "measured.rimBase drifted from the terrain");
  assert.equal(R.lidar.massH, MASS.h);
  /* And every per-face ground is re-sampled off the drawn surface. */
  for (const [id, g] of Object.entries(R.terrain.faces)) {
    const f = section.facades.find((x) => x.id === id);
    assert.ok(f, `readings.terrain names unknown face ${id}`);
    const v = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      v.push(drawnGround(f.a[0] + (f.b[0] - f.a[0]) * t, f.a[1] + (f.b[1] - f.a[1]) * t));
    }
    v.sort((a, b) => a - b);
    near(g.min, v[0], 5e-3, `${id} ground min`);
    near(g.med, v[Math.floor(v.length / 2)], 5e-3, `${id} ground median`);
    near(g.max, v[v.length - 1], 5e-3, `${id} ground max`);
  }
  /* The courtyard decks are the load-bearing claim: DEAD FLAT at 23.70. */
  for (const [key, box] of [["courtyard1Deck", [105, 133, 363, 375]], ["courtyard2Deck", [104, 134, 393, 406]]]) {
    const v = [];
    for (let i = 0; i <= 16; i++) {
      for (let j = 0; j <= 16; j++) {
        v.push(drawnGround(box[0] + ((box[1] - box[0]) * i) / 16, box[2] + ((box[3] - box[2]) * j) / 16));
      }
    }
    v.sort((a, b) => a - b);
    near(R.terrain[key].med, v[Math.floor(v.length / 2)], 5e-3, `${key} median`);
  }
  assert.ok(Math.abs(R.terrain.courtyard1Deck.med - R.terrain.courtyard2Deck.med) < 0.05,
    "the two courtyard decks must read the same podium elevation — that is the whole finding");
  /* Every reading group says where it came from. */
  for (const k of ["imperial", "px2008", "counted", "lidar", "ring", "product"]) {
    assert.ok(section.derivations.readings[k].source.length > 60, `readings.${k} has no source`);
  }
  assert.match(R.px2008.source, /RATIO|ratio/,
    "the 2008 frame's ratio-only discipline must be stated where its pixels are");
});

/**
 * THE HEADLINE GATE. Every drawn dimension is recomputed here, independently,
 * out of the pinned citations — then checked BOTH against the section's own
 * stated derivation and against the field the module actually reads. A
 * fabricated figure fails on the second check; a fabricated derivation fails
 * on the first. This is the gate that did not exist when this section shipped
 * a fin module that was 2x wrong.
 */
test("every derived dimension reproduces from its own citations, and is what the section ships", () => {
  const R = section.derivations.readings;
  const { inch: IN, foot: FT, pound: LB, concreteDensity: RHO } = section.derivations.units;
  const { imperial: imp, px2008: px, counted: cnt, lidar: lid, ring, product: prod, terrain: terr } = R;

  const cmuCourse = imp.cmuCourseIn * IN;
  const courses = Math.round(px.storeyPitch / px.cmuCoursePeriod);
  const f2f = courses * cmuCourse;
  const parapet = lid.massH - 4 * f2f;
  const finModule = imp.finModuleFeet * FT;
  /* THE BAY IS MEASURED, NOT INFERRED FROM THE COLUMN COUNT (visual round 2,
     MAJOR 4, 2026-08-21). It used to be `ring.westEdgeLength / (counted
     .arcadeColumns - 1)` — the drawn west edge over STRUCTURE's 35 columns —
     and that is refuted by the frame the rest of this facade is measured on:
     at 250 px to a storey, 91.1055 / 34 = 2.6796 m predicts a 183 px column
     pitch where the pinned reading is 268 px. The bay now comes off the same
     single scale as everything else, and the 35 stays sourced and declared
     irreconcilable in conflicts[] rather than deleted. */
  const bay = (px.columnPitch / px.storeyPitch) * f2f;
  const archRadius = bay / 2 - section.estimates["arcade.shaftBase"].value;
  const bandH = section.reads["finSystem.band.height"].value;
  const finH = f2f - bandH;
  const finVol = (cnt.finMassLb * LB) / RHO;
  const E = section.estimates;
  const RD = section.reads;
  /* The spindle profile's mean projection, by the shoelace formula over the
     seven points the module extrudes — recomputed here from the ESTIMATES,
     not copied from the section's stated value. */
  const pts = [[0, 0], [E["finSystem.proudHaunch"].value, 0],
    [E["finSystem.proudMin"].value, E["finSystem.haunchHeight"].value],
    [E["finSystem.proudMid"].value, finH / 2],
    [E["finSystem.proudMin"].value, finH - E["finSystem.haunchHeight"].value],
    [E["finSystem.proudHaunch"].value, finH], [0, finH]];
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const q = pts[(i + 1) % pts.length];
    area += pts[i][0] * q[1] - q[0] * pts[i][1];
  }
  const meanProud = Math.abs(area) / 2 / finH;
  const roofElev = lid.rimBase + lid.massH;
  const westMed = terr.faces.west.med;

  const expect = {
    "grid.cmuCourse": cmuCourse,
    "grid.cmuUnit": imp.cmuUnitIn * IN,
    "grid.cmuCoursesPerStorey": courses,
    "grid.floorToFloor": f2f,
    "grid.parapet": parapet,
    "grid.finModule": finModule,
    "grid.arcadeBay": bay,
    /* The fins-per-bay is now a PURE PIXEL RATIO off the frame, so it no
       longer inherits the unresolved module: 268 / 91.3 = 2.94 -> 3. Under
       the old expr, round(bay / finModule), it would read 4 at the measured
       bay and the arcade would silently agree with a module the same frame
       refutes three ways. See conflicts[0]. */
    "grid.finsPerBay": Math.round(px.columnPitch / px.finPitch),
    "arcade.bay": bay,
    "arcade.capital": bay / 2 - E["arcade.capitalGap"].value,
    "arcade.archRadius": archRadius,
    "arcade.depth": bay,
    "finSystem.height": finH,
    "finSystem.volume": finVol,
    "finSystem.meanProud": meanProud,
    /* R2 arbitration Y1: the fin and its slot are MEASURED AS FRACTIONS of
       the fin module and the metre value is that fraction times the module.
       The retired mass chain (finVol / f2f / meanProud = 0.2028 m) is 2.9x
       the frame's own reading and is now a declared conflict, not a
       derivation; the retired 0.425 m slot was DPR 523's prose midpoint and
       its expr referenced a reading that never existed. */
    "finSystem.width": RD["finSystem.widthOfModule"].value * finModule,
    "finSystem.windowWidth": RD["finSystem.windowWidthOfModule"].value * finModule,
    "eastSide.doors.width": prod.doorLeafIn * IN,
    "eastSide.doors.height": prod.doorHeightIn * IN,
    "eastSide.doors.everyBays": Math.round(f2f / finModule),
    /* `eastSide.retainingWall.x` is GONE, not moved: the wall is retired
       (R2 arbitration P3) and audit-york F10's derivation is retired with it. */
    "westGround.rack.hoopWidth": prod.bikeHoopWidthIn * IN,
    "westGround.rack.spacing": prod.bikeHoopPitchIn * IN,
    "westGround.mulch.xWest": shipped.plaza.dgBelt.x1 + section.draw.beltGap,
    "courtyards.benchSeat": prod.benchSeatIn * IN,
    "courtyards.benchRadius": E["courtyards.planterRadius"].value
      + E["courtyards.benchGap"].value + E["courtyards.benchWidth"].value,
    "courtyards.deckElevation": terr.courtyard1Deck.med,
    "courtyards.stepBelowPlaza": westMed - terr.courtyard1Deck.med,
    "courtyards.lecture.doorSize.0": prod.doorLeafIn * IN,
    "courtyards.lecture.doorSize.1": prod.doorHeightIn * IN,
    "roof.louvreWell.bladePitch": E["roof.louvreWell.bladeLength"].value
      * E["roof.louvreWell.closePackFraction"].value,
    "measured.roofElevation": roofElev,
    "measured.courtyardStep": westMed - terr.courtyard1Deck.med,
    "closure.courseCount": f2f / cmuCourse,
    "closure.eastElevation": 4 * f2f + parapet,
    "closure.plazaFrontage": 3 * f2f + parapet,
    "closure.podiumStorey": westMed - f2f,
  };
  for (const p of section.measured.parts) {
    expect[`measured.parts.${p.key}.height`] = roofElev - p.ground;
  }

  /* Figures that are bookkeeping over other blocks and have no field of their
     own to ship. Everything else must ALSO be the number the module reads. */
  const solvedOnly = new Set(["closure.courseCount", "closure.eastElevation",
    "closure.plazaFrontage", "closure.podiumStorey", "measured.courtyardStep",
    ...section.measured.parts.map((p) => `measured.parts.${p.key}.height`)]);

  const figures = section.derivations.figures;
  assert.deepEqual(Object.keys(figures).sort(), Object.keys(expect).sort(),
    "the derivation table and this test's independent recomputation must cover the same figures");
  for (const [path, want] of Object.entries(expect)) {
    const decl = figures[path];
    assert.ok(decl && decl.expr, `${path} has no stated derivation`);
    assert.ok(Math.abs(decl.value - want) < 5e-6,
      `${path}: the section states ${decl.value} but its own citations give ${want}`);
    if (solvedOnly.has(path)) continue;
    const shippedValue = at(section, path);
    assert.equal(typeof shippedValue, "number", `${path} is not a number in the section`);
    assert.ok(Math.abs(shippedValue - want) < 5e-6,
      `${path}: the section SHIPS ${shippedValue} but derives ${want}`);
  }

  /* The three figures the whole revision turns on, pinned to the metre so a
     regression to the retired values cannot pass quietly. */
  near(section.grid.finModule, 0.9144, 1e-9, "the fin module is 3 ft");
  near(section.grid.floorToFloor, 3.6576, 1e-9, "the storey is 12 ft = 18 CMU courses");
  near(section.grid.arcadeBay, 3.9209472, 1e-6, "the arcade bay is MEASURED off the 2008 frame");
  assert.equal(section.grid.finsPerBay, 3, "THREE fins per arcade bay, not two");
  /* THE CONTRADICTION IS THE POINT, AND IT MUST STAY VISIBLE. The measured
     bay divided by the ASSERTED module is 4.29 against a measured 2.94, which
     is conflicts[0] expressed as arithmetic. If some future change makes these
     agree, one of the two has been moved and this gate says so. */
  assert.ok(Math.abs(section.grid.arcadeBay / section.grid.finModule - section.grid.finsPerBay) > 1,
    "the arcade grid and the fin grid must still DISAGREE — conflicts[0] is unresolved and quiet agreement means a figure was moved");
  /* And the retired ones must not be back. */
  for (const dead of [1.829, 3.658, 3.775, 5.0, 2.679573186]) {
    assert.notEqual(section.grid.finModule, dead);
    assert.notEqual(section.grid.arcadeBay, dead);
    assert.notEqual(section.grid.floorToFloor, dead);
  }
});

test("the building CLOSES against LiDAR, and the COURSE COUNT is what decides the storey", () => {
  const f = section.grid.floorToFloor;
  const c = section.grid.parapet;
  const course = section.grid.cmuCourse;
  const terr = section.derivations.readings.terrain;

  /* 4f + c is exact by construction of c, so it is bookkeeping, not evidence. */
  near(4 * f + c, MASS.h, 1e-9, "the four-storey east elevation must be the drawn prism exactly");

  /* THE DISCRIMINATOR. A CMU wall is laid in whole 8 in courses, so the
     storey must be an exact integer number of them. This is the gate that
     actually separates 3.6576 from its two retired rivals, and it is a COUNT
     in a photograph — no scale, no camera model, no fin module. */
  const courses = f / course;
  near(courses, Math.round(courses), 1e-9, "the storey is not a whole number of CMU courses");
  assert.equal(Math.round(courses), 18, "18 courses of 8 in = 12 ft 0 in");
  /* 3.658 is NOT in this list: it is 12 ft to three places, i.e. the same
     storey, and it was retired as a BAY rather than as a storey height. */
  for (const dead of [3.775, 5.0]) {
    const n = dead / course;
    assert.ok(Math.abs(n - Math.round(n)) > 0.05,
      `the retired ${dead} m storey is a whole ${n} courses — this gate would not discriminate and is decoration`);
  }

  /* CORROBORATION, on a face that took no part in deriving f or c: the plaza
     frontage measured where a person stands, not at the wall chord. */
  const plaza = 3 * f + c;
  const roofElev = section.measured.roofElevation;
  const lo = roofElev - terr.westPlaza.max;
  const hi = roofElev - terr.westPlaza.min;
  assert.ok(plaza >= lo && plaza <= hi,
    `3f + c = ${plaza.toFixed(3)} m falls outside the ${lo.toFixed(2)}-${hi.toFixed(2)} m the terrain gives the plaza frontage`);
  /* And the section must not oversell it: the band is wide, and the section
     says so rather than presenting corroboration as proof. */
  assert.match(section.derivations.figures["closure.plazaFrontage"].why, /CORROBORATION|not proof/i,
    "the frontage closure must be declared corroboration, not the discriminator");
  /* The inventory's 5.0 m IS refuted by this band, which is the one thing it
     does decide outright. */
  assert.ok(3 * 5.0 > hi + 1,
    "the inventory's 5.0 m must still be refuted by the frontage the photograph measures");

  /* The podium storey: plaza grade less one storey should land near rimBase. */
  assert.ok(Math.abs(terr.faces.west.med - f - section.measured.rimBase) < 0.4,
    "plaza grade less one storey should land within 0.4 m of rimBase — the buried podium storey");
});

/**
 * COVERAGE. Every number the geometry blocks carry is derived, a labelled
 * estimate that names the pattern it extends, or a cited read with a
 * tolerance. Nothing may simply appear.
 */
test("no drawn number is uncovered: derivation, labelled estimate, or cited read", () => {
  /* Exempt: PLAN COORDINATES, which are ring vertices, positions read off a
     frame, or the plan rectangles of objects whose SIZE is covered above.
     A coordinate is not a dimension and deriving one would be a fiction. */
  const exempt = new Set([
    "courtyards.items", "courtyards.lecture.vents", "courtyards.lecture.doorsAt",
    "westGround.racks", "westGround.mulch.wall", "westGround.mulch.bands",
    "eastSide.parking", "eastSide.ramp.a", "eastSide.ramp.b",
    "eastSide.retainingWall.a", "eastSide.retainingWall.b",
    "roof.louvreWell.x0", "roof.louvreWell.x1", "roof.louvreWell.z0",
    "roof.louvreWell.z1", "roof.louvreWell.rows", "roof.penthouse.x", "roof.penthouse.z",
  ]);
  const paths = [];
  const walk = (v, p) => {
    if (exempt.has(p)) return;
    if (typeof v === "number") { paths.push(p); return; }
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, `${p}.${i}`)); return; }
    if (v && typeof v === "object") for (const k of Object.keys(v)) walk(v[k], p ? `${p}.${k}` : k);
  };
  for (const r of ["grid", "finSystem", "arcade", "eastSide", "courtyards", "westGround", "roof", "structures"]) {
    walk(section[r], r);
  }
  assert.ok(paths.length > 40, `only ${paths.length} drawn numbers found — the walk did not run`);

  const derived = new Set(Object.keys(section.derivations.figures));
  const est = section.estimates;
  const reads = section.reads;
  for (const p of paths) {
    const where = derived.has(p) ? "derived" : est[p] ? "estimated" : reads[p] ? "read" : null;
    assert.ok(where,
      `${p} = ${at(section, p)} is a bare number: derive it, label it [estimated] with the pattern it extends, or cite the frame it is read off`);
  }

  const exprs = Object.values(section.derivations.figures).map((f) => f.expr).join(" ");
  for (const [p, e] of Object.entries(est)) {
    if (p === "why") continue;
    assert.match(e.why, /\[estimated\]/, `${p} must carry the [estimated] label`);
    assert.ok(e.extends && e.extends.length > 15, `${p} must record which sourced pattern it extends`);
    const shippedValue = at(section, p);
    if (shippedValue === undefined) {
      /* An estimate that is an INPUT to a derivation rather than a shipped
         field must actually be used by one — a dead estimate is a claim
         nobody can check. */
      /* S1(vi) rewrote every expr into arithmetic over an `est.` scope, so an
         estimate is named as `est.<dotted key>` rather than in brackets. */
      assert.ok(exprs.includes(`est.${p}`),
        `${p} ships nowhere and no derivation names it — it is a dead estimate`);
      continue;
    }
    assert.ok(Math.abs(shippedValue - e.value) < 5e-6, `${p} ships ${shippedValue} but its estimate says ${e.value}`);
  }
  for (const [p, r] of Object.entries(reads)) {
    if (p === "why") continue;
    assert.ok(r.source && r.source.length > 60, `${p} must name the frame or plan it is read off`);
    assert.equal(typeof r.tolerance, "number", `${p} must carry the tolerance its frame supports`);
    const shippedValue = at(section, p);
    assert.ok(shippedValue !== undefined, `${p} is read but not shipped`);
    assert.ok(Math.abs(shippedValue - r.value) < 5e-6, `${p} ships ${shippedValue} but its read says ${r.value}`);
  }
  /* One number, one provenance. */
  for (const p of Object.keys(est)) {
    if (p === "why") continue;
    assert.ok(!derived.has(p) && !reads[p], `${p} claims two provenances`);
  }
  for (const p of Object.keys(reads)) {
    if (p === "why") continue;
    assert.ok(!derived.has(p), `${p} claims two provenances`);
  }
});

/* ==========================================================================
 * R2 ARBITRATION S1 — THE AXIOM LAYER, GATED.
 *
 * Everything above this line checks the layer AT and ABOVE the figures. The
 * layer UNDERNEATH — the readings the figures derive from, the estimates they
 * inherit, and the `draw` block that carries numbers straight to the geometry
 * — was unchecked, and audit-york F3 proved it: seven self-consistent
 * fabrications survived all 33 gates, including `px2008.finPitch 91.3 -> 60`,
 * the sole evidence for the revision's headline. Every gate below is a
 * TIGHTENING. The shared apparatus is tests/helpers/axiom-gate.mjs, one copy
 * for all six Revelle suites.
 * ======================================================================== */

/* Every reading with an external truth, pinned to a literal HERE — the way
   this suite already pinned the 35 arcade columns. Moving the reading in the
   section moves it away from its pin and fails. */
const READING_PINS = {
  "units.inch": { value: 0.0254, truth: "exact by definition: 1 in = 25.4 mm" },
  "units.foot": { value: 0.3048, truth: "exact by definition: 1 ft = 12 in = 304.8 mm" },
  "units.pound": { value: 0.45359237, truth: "exact by definition: 1 lb = 0.45359237 kg" },
  "units.concreteDensity": { value: 2400, truth: "standard density of normal-weight structural concrete, kg/m3" },
  "imperial.finModuleFeet": { value: 3, truth: "the imperial module this section ASSERTS; see conflicts[0], it is not resolved" },
  "imperial.storeyFeet": { value: 12, truth: "12 ft = 18 CMU courses of 8 in, counted in UCOP2008 p11" },
  "imperial.arcadeRunFeet": { value: 300, truth: "STRUCTURE 2024: 'a 300-foot-long column arcade'" },
  "imperial.cmuCourseIn": { value: 8, truth: "the American nominal CMU course STRUCTURE's 'concrete masonry unit' names" },
  "imperial.cmuUnitIn": { value: 16, truth: "the American nominal CMU unit length, 16 in" },
  "px2008.storeyPitch": { value: 250, truth: "UCOP2008-p11_york-west-arcade-COLOUR.png: mid-floor band top y=154 to arcade fascia top y=404" },
  "px2008.cmuCoursePeriod": { value: 13.9, truth: "UCOP2008 p11: Fourier period of the split-face coursing, four sunlit panels agreeing to +/-0.4 px" },
  "px2008.finPitch": { value: 91.3, truth: "UCOP2008 p11: mean of the four gaps between fin peaks at x = 426, 518, 610, 700, 791" },
  "px2008.columnPitch": { value: 268, truth: "UCOP2008 p11: Fourier period of the bright arcade shafts at y 555-625" },
  "counted.arcadeColumns": { value: 35, truth: "STRUCTURE 2024: 'Thirty-five fluted, cast-in-place concrete columns'" },
  "counted.finsSourced": { value: 805, truth: "STRUCTURE 2024: 'Eight-hundred and five vertical, story-tall precast concrete fins'" },
  "counted.finsLPA": { value: 800, truth: "LPA Design Studios: 'roughly 75% of 800 precast facade fins'" },
  "counted.finMassLb": { value: 500, truth: "STRUCTURE 2024: 'Each fin weighs nearly 500 lbs' — an approximate magazine figure" },
  "counted.structures": { value: 4, truth: "STRUCTURE 2024: four seismically separate structures" },
  "counted.utilityTunnelFt": { value: 10, truth: "LPA Design Studios: a 10-foot-diameter utility tunnel protected in place" },
  "lidar.massH": { value: 15.1, truth: "docs/data/campus-lidar.json massHeights['m:115,377'], LiDAR 2014" },
  "lidar.rimBase": { value: 21.222, tol: 5e-3, truth: "the median of groundAt over all 63 drawn ring vertices, campus-lidar.json terrain" },
  "lidar.ringVertices": { value: 63, truth: "the vertex count of the drawn arcgis 'York Hall' outer ring" },
  "ring.westEdgeLength": { value: 91.105488309, tol: 1e-6, truth: "campus-arcgis.json massing 'York Hall' outer ring, (83.8, 429.9) to (82.8, 338.8)" },
  "product.doorLeafIn": { value: 36, truth: "a stock 3'-0\" hollow-metal exterior door leaf" },
  "product.doorHeightIn": { value: 84, truth: "a stock 7'-0\" hollow-metal exterior door leaf" },
  "product.bikeHoopWidthIn": { value: 30, truth: "a stock inverted-U loop bike rack hoop is 30 in wide" },
  "product.bikeHoopPitchIn": { value: 36, truth: "loop bike rack hoops are set on 36 in centres" },
  "product.benchSeatIn": { value: 17, truth: "the standard finished seat height of a built-in bench, 17 in" },
};
/* These blocks must be pinned EXHAUSTIVELY, so a new unpinned reading cannot
   be slipped into a pinned block. `terrain` is not here because it is
   RE-SAMPLED from campus-lidar.json above, which binds harder than a pin. */
const PINNED_NAMESPACES = ["units", "imperial", "px2008", "counted", "lidar", "ring", "product"];

/* The `reads` block, pinned the same way. audit-york F4's surviving mutation
   moved BOTH sides of a comparison at once; literals cannot both move. */
const READ_PINS = {
  "grid.storeys": { value: 4, truth: "campus-arcgis.json massing 'York Hall' levels = 4" },
  "arcade.columnsSourced": { value: 35, truth: "STRUCTURE 2024: thirty-five fluted cast-in-place columns" },
  "arcade.sides": { value: 6, truth: "STRUCTURE 2024 and LPA: HEXAGONAL fan-vaulted columns" },
  "finSystem.band.height": { value: 0.55, truth: "the inventory's read of the smooth white precast mid-floor bands off lpa-york-1.jpg (2024)" },
  "finSystem.widthOfModule": { value: 0.0761, truth: "R2 Y1: FWHM 6.9 px over a 90.7 px pitch, UCOP2008-p11_york-finfield-3x.png" },
  "finSystem.windowWidthOfModule": { value: 0.0805, truth: "R2 Y1: half-depth width 7.3 px over a 90.7 px pitch, same frame" },
  "finSystem.windowsPerFin": { value: 1, truth: "R2 Y1: fourteen of fourteen slots, seven fins in both storey bands, same frame" },
  "roof.louvreWell.bladeHeight": { value: 2.2, truth: "ARK bb8089859p: blades of the order of 2-2.5 m, comparable to the adjacent penthouse" },
  "roof.louvreWell.rowCount": { value: 1, truth: "ARK bb8089859p shows a SINGLE row of blades running the full visible length" },
  "roof.penthouse.size.0": { value: 4.5, truth: "ARK bb8089859p: the glazed bulkhead's long plan dimension, 'roughly 4-5 m'" },
  "roof.penthouse.size.1": { value: 2.5, truth: "ARK bb8089859p: the glazed bulkhead is '~2.5 m tall'" },
  "roof.penthouse.size.2": { value: 3, truth: "ARK bb8089859p: the glazed bulkhead's short plan dimension, 'roughly 3 m'" },
  "structures.tower.cap": { value: 1.8, truth: "DPR 523 Image 4 (ARG 2015): a service tower rising SLIGHTLY above the parapet" },
  "arcade.backGlazing.lightsPerBay": { value: 3, truth: "UCOP2008-p11_york-arcade-3x.png: two thin white mullions divide the glazed back wall of the bike-rack bay into three lights" },
};

/* `expr` is arithmetic over the section's own readings. `est` is the estimate
   values as a nested tree (their keys are dotted); `part` is measured.parts
   grounds by camelised key, and each is asserted against the terrain reading
   measured.partsNote names for it. Nothing here is a number this file
   invents — every leaf comes out of the section or out of shipped.plaza. */
function exprScope(sec) {
  const est = {};
  for (const [k, v] of Object.entries(sec.estimates)) {
    if (k === "why") continue;
    const parts = k.split(".");
    let node = est;
    for (let i = 0; i < parts.length - 1; i++) node = node[parts[i]] ??= {};
    node[parts.at(-1)] = v.value;
  }
  const part = {};
  for (const p of sec.measured.parts) part[p.key.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase())] = p.ground;
  const R = sec.derivations.readings;
  return {
    ...R,
    inch: R.units.inch, foot: R.units.foot, pound: R.units.pound,
    grid: sec.grid, finSystem: sec.finSystem, draw: sec.draw,
    measured: { roofElevation: sec.measured.roofElevation },
    plaza: shipped.plaza,
    est, part,
  };
}

test("S1(i)+(ii): the AXIOM layer is covered, and every estimate carries a band", () => {
  const uncovered = {};   /* deliberately empty: nothing in york needed an escape */
  const est = section.estimates;
  const reads = section.reads;
  const drawBands = section.draw.bands;
  /* Tessellation counts, not lengths: how many segments a lathe or a torus is
     cut into. They are banded like everything else but the "an offset that big
     is a dimension" ceiling is a metre rule and does not apply to a count. */
  const MESH_RES = new Set(["columnLatheSegments", "hoopRadialSegments",
    "hoopTubularSegments", "agavePerPlanter", "tiles.cmuCourses"]);

  const walked = assertCoverage({
    section,
    label: "york",
    minimum: 120,
    roots: {
      "derivations.readings": {},
      estimates: {},
      draw: {},
    },
    uncovered,
    classify(path) {
      /* The readings. Pinned to a literal here, or re-sampled from the LiDAR
         file by the gate above — the terrain block is not asserted at all. */
      if (path.startsWith("derivations.readings.terrain.")) return "re-sampled from campus-lidar.json";
      const asReading = path.replace("derivations.readings.", "");
      if (READING_PINS[asReading]) return "pinned";
      /* The estimates: a value inside its own published band, or the band. */
      const m = /^estimates\.(.+)\.(value|band\.[01])$/.exec(path);
      if (m && est[m[1]]) return m[2] === "value" ? "banded" : "the band itself";
      /* `draw`: render offsets, every one of them banded in draw.bands. */
      if (path.startsWith("draw.bands.")) return "the band itself";
      if (path.startsWith("draw.")) {
        const leaf = path.replace("draw.", "");
        return drawBands[leaf] ? "banded render offset" : null;
      }
      return null;
    },
  });
  assert.ok(walked.length >= 120, `the axiom walk found only ${walked.length} numbers`);

  /* Every `draw` leaf is banded, the band table is exhaustive, and the shipped
     offset is inside it. A moved offset is a moved dimension in disguise. */
  const drawLeaves = [];
  (function walk(v, p) {
    if (typeof v === "number") { drawLeaves.push(p); return; }
    if (v && typeof v === "object" && !Array.isArray(v)) for (const k of Object.keys(v)) walk(v[k], p ? `${p}.${k}` : k);
  })({ ...section.draw, bands: undefined }, "");
  assert.ok(drawLeaves.length >= 40, `only ${drawLeaves.length} draw offsets found`);
  for (const leaf of drawLeaves) {
    const b = drawBands[leaf];
    assert.ok(Array.isArray(b) && b.length === 2 && b[0] < b[1], `draw.${leaf} has no ordered band`);
    const v = leaf.split(".").reduce((o, k) => o[k], section.draw);
    assert.ok(v >= b[0] && v <= b[1], `draw.${leaf} ships ${v}, outside its own published band [${b}]`);
    if (MESH_RES.has(leaf)) {
      assert.ok(Number.isInteger(v) && v >= 1, `draw.${leaf} is a mesh resolution and must be a whole count`);
      continue;
    }
    assert.ok(b[1] <= 16, `draw.${leaf}'s band reaches ${b[1]} — an offset that big is a dimension`);
  }
  for (const k of Object.keys(drawBands)) {
    assert.ok(drawLeaves.includes(k), `draw.bands still bands ${k}, which the walk no longer finds`);
  }
  assert.ok(section.draw.bandsWhy.length > 200, "the draw bands must say what a band is and what it is not");

  /* S1(ii). Every estimate: [estimated] label, the pattern it extends, a
     machine-readable band, and the SHIPPED value inside it. */
  const checked = assertEstimateBands({
    estimates: est,
    label: "york",
    valueAt: (key) => {
      const v = at(section, key);
      /* An estimate that is an INPUT to a derivation rather than a shipped
         field is checked against its own declared value; the coverage gate
         above separately proves no estimate is dead. */
      return v === undefined ? est[key].value : v;
    },
  });
  assert.ok(checked >= 25, `only ${checked} estimates were banded`);
  for (const [k, e] of Object.entries(est)) {
    if (k === "why") continue;
    assert.ok(e.bandWhy && e.bandWhy.length > 60,
      `${k} carries a band and no account of what the band is — a band nobody argued for is a number`);
    /* A band drawn tight around the shipped value is the defect wearing the
       fix's clothes: the value may not be the band's own endpoint. */
    assert.ok(e.value > e.band[0] && e.value < e.band[1],
      `${k} ships ${e.value} exactly on its band endpoint — the band was drawn to the value`);
    assert.ok(!reads[k] && !section.derivations.figures[k], `${k} claims two provenances`);
  }
});

test("S1(iii): every reading is pinned to an external truth, and the stated relations are asserted", () => {
  const R = section.derivations.readings;
  assertPins({ readings: R, pins: READING_PINS, namespaces: PINNED_NAMESPACES, label: "york readings" });

  /* THE ACCEPTANCE TEST THE ARBITRATION NAMES. px2008.finPitch is the sole
     evidence for "three fins per bay, not two", and audit-york F3 moved it
     91.3 -> 60 with every one of the 33 gates still passing. It cannot now. */
  const mutated = JSON.parse(JSON.stringify(R));
  mutated.px2008.finPitch = 60;
  assert.throws(
    () => assertPins({ readings: mutated, pins: READING_PINS, namespaces: PINNED_NAMESPACES, label: "york readings" }),
    /px2008\.finPitch has moved off its external truth/,
    "px2008.finPitch must not be able to go 91.3 -> 60 and pass");
  /* And the whole px2008 block is pinned, not just that one member. */
  for (const k of ["storeyPitch", "cmuCoursePeriod", "finPitch", "columnPitch"]) {
    const m2 = JSON.parse(JSON.stringify(R));
    m2.px2008[k] *= 1.1;
    assert.throws(() => assertPins({ readings: m2, pins: READING_PINS, namespaces: PINNED_NAMESPACES, label: "york readings" }),
      /px2008/, `px2008.${k} is not pinned`);
  }
  /* A new unpinned member of a pinned block fails too. */
  const m3 = JSON.parse(JSON.stringify(R));
  m3.counted.inventedCount = 12;
  assert.throws(() => assertPins({ readings: m3, pins: READING_PINS, namespaces: PINNED_NAMESPACES, label: "york readings" }),
    /is a reading in a pinned block and it is not pinned/);

  /* The `reads` block, same treatment. This is what closes audit-york F4: the
     roof gate's ceiling is its own subject, and both sides used to be free. */
  const readValues = {};
  for (const [k, v] of Object.entries(section.reads)) {
    if (k === "why") continue;
    assert.ok(READ_PINS[k], `read ${k} is not pinned to an external truth`);
    readValues[k.replace(/\./g, "_")] = v.value;
  }
  const readPins = Object.fromEntries(Object.entries(READ_PINS).map(([k, p]) => [k.replace(/\./g, "_"), p]));
  for (const k of Object.keys(READ_PINS)) assert.ok(section.reads[k], `pinned read ${k} no longer exists`);
  assertPins({ readings: readValues, pins: readPins, label: "york reads" });
  for (const [a, b] of [["roof.louvreWell.bladeHeight", 3.5], ["roof.penthouse.size.1", 4.0]]) {
    const bad = { ...readValues, [a.replace(/\./g, "_")]: b };
    assert.throws(() => assertPins({ readings: bad, pins: readPins, label: "york reads" }), /moved off its external truth/,
      `${a} -> ${b} must fail: 3.5 m blades under a 4.0 m penthouse passed 33/33`);
  }

  /* S1(iii)'s second half: relations the section states in PROSE, asserted.
     measured.partsNote says which terrain statistic each face's ground IS. */
  const T = R.terrain;
  const PART_TRUTH = {
    "west-plaza-high": T.faces.west.max,
    "west-plaza-low": T.faces.west.min,
    "courtyard1-deck": T.courtyard1Deck.med,
    "courtyard2-deck": T.courtyard2Deck.med,
    "east-ravine-north": T.faces["north-east"].med,
    "east-ravine-south": T.faces["south-east"].med,
    "north-approach": T.faces["north-wing"].med,
    "south-end-wing": T.faces["south-end-wing"].med,
    "south-end-bar": T.faces["south-end-bar"].med,
  };
  assert.equal(section.measured.parts.length, Object.keys(PART_TRUTH).length,
    "a part has appeared or vanished without a terrain statistic to be");
  assertRelations({
    label: "york",
    relations: [
      ...section.measured.parts.map((p) => ({
        name: `measured.parts['${p.key}'].ground is the terrain statistic partsNote names`,
        got: p.ground, want: PART_TRUTH[p.key],
      })),
      /* The grid says one 3 ft module governs fin, bay and storey together. */
      { name: "floorToFloor is four fin modules", got: section.grid.floorToFloor, want: 4 * section.grid.finModule },
      { name: "floorToFloor is 18 CMU courses", got: section.grid.floorToFloor, want: 18 * section.grid.cmuCourse },
      { name: "the CMU unit is two courses", got: section.grid.cmuUnit, want: 2 * section.grid.cmuCourse },
      { name: "the 300 ft sourced arcade run is the drawn west edge", got: R.ring.westEdgeLength / R.units.foot, want: 300, tol: 1.2 },
      /* And the two courtyard decks are ONE podium — the whole finding. */
      { name: "both courtyard decks read one podium elevation", got: T.courtyard1Deck.med, want: T.courtyard2Deck.med, tol: 0.05 },
    ],
  });
});

test("S1(iv): the tier gate runs BOTH ways over colorSources and estimates", () => {
  const entries = [
    ...Object.entries(section.colorSources).map(([key, cs]) => ({ key: `colorSources.${key}`, text: cs.source })),
    ...Object.entries(section.estimates).filter(([k]) => k !== "why")
      .map(([key, e]) => ({ key: `estimates.${key}`, text: e.why })),
  ];
  assert.ok(entries.length >= 44, `the tier gate walked only ${entries.length} lines`);
  assertTierSymmetry({ entries, label: "york" });

  /* The gate that catches a PROMOTION: an [estimated] line acquiring a
     [measured] or [sourced] label because it cites the parent it extends. */
  const promoted = { key: "colorSources.cmuArcadeBack", text: section.colorSources.cmuArcadeBack.source.replace("[estimated]", "[sourced]") };
  assert.throws(() => assertTierSymmetry({ entries: [promoted], label: "york" }),
    /its own source string hedges/,
    "an [estimated] line that extends a parent must not be promotable by relabelling");
  /* And a tier above [estimated] that names no artefact at all. */
  assert.throws(() => assertTierSymmetry({ entries: [{ key: "x", text: "[sourced] the colour of the thing" }], label: "york" }),
    /names no artefact/);
});

test("S1(v): absent is gated PER ENTRY, not by list length", () => {
  /* Each withholding is matched by a stable key with the probe that holds it.
     An entry may leave only by being BUILT (said so here) or by being claimed
     in a sibling's absent — a withholding may not disappear silently. */
  const ABSENT = {
    "south-end-elevation": [/^South end elevation/, /HEIGHT IS NOT ESTIMATED/],
    "service-condition": [/Loading dock, trash enclosure/, /better absent than wrong/],
    "fascia-lettering": [/'York Hall' lettering/, /DESCRIPTION IS DISPUTED/],
    "ravine-steps": [/^Steps climbing from the ravine/, /unsourced; unbuilt/],
    "mayer-bridge": [/^Bridge over the sunken walkway/, /undimensioned; unbuilt/],
    "podium-storey": [/^The sunken walkway and the below-grade/, /21\.222/],
    "arcade-inner-row": [/^Inner \(second\) row of arcade columns/, /PARTLY CONTRADICTED/],
    "columns-vs-bay": [/^35 sourced columns vs the drawn 12 ft bay/, /RE-OPENED AND RE-DECIDED .* AGAINST THE COUNT/],
    "arcade-drawn-depth": [/^THE ARCADE'S TRUE DEPTH CANNOT BE DRAWN/, /owedTo.*suppress or hollow the massing prism/],
    "plain-wall-articulation": [/^WHETHER THE LECTURE HALL AND THE TWO COURTYARD END WALLS/, /ladder climbed .* and exhausted/],
    "arcade-entry-doors": [/^West arcade entry door positions/, /not georeferenced/],
    "lecture-raked-roof": [/^Lecture Hall raked roof/, /measured height not contradicted/],
    "roof-equipment-wing": [/^Roof equipment/, /which wing/i],
    "plaza-landscape": [/^Eucalyptus trees, mulch-belt planting/, /x = 82\.1/],
    "utility-tunnel": [/utility tunnel beneath the colonnade/, /PROTECT IN PLACE/],
    "floor-area": [/^122,000 vs 134,000 sq ft/, /ASSIGNABLE area/],
    "drawn-vs-survey-ring": [/^The drawn facilities comb differs from the survey ring/, /298\.9 ft/],
    "floor-to-floor-5m": [/^The inventory's 5\.0 m floor-to-floor/, /RESOLVED .* AT 3\.6576 m/],
    "plaza-to-courtyard-step": [/^THE PLAZA-TO-COURTYARD STEP/, /owedTo.*R6.*Edges \+ revellesiteworks/],
    "wings-lower-storeys-clad": [/^WHETHER THE WINGS' LOWER STOREYS ARE FIN-CLAD/, /Not acted on/],
    "rectified-west-frame": [/^AN ORTHOGRAPHIC OR RECTIFIED FRAME/, /1\.46/],
    "dpr-523": [/^DPR 523 pp\. 431-436/, /NOT ON DISK/],
    "east-retaining-wall": [/^EAST-SIDE RETAINING WALL/, /WHAT WAS LOOKED FOR/],
  };
  const keyed = section.absent.map((text) => {
    const hits = Object.entries(ABSENT).filter(([, [id]]) => id.test(text)).map(([k]) => k);
    assert.equal(hits.length, 1,
      `absent entry matches ${hits.length} known withholdings (${hits}): ${text.slice(0, 70)}`);
    return { key: hits[0], text };
  });
  const have = assertAbsentEntries({
    absent: keyed,
    expected: Object.fromEntries(Object.entries(ABSENT).map(([k, [, probe]]) => [k, probe])),
    built: {},
    label: "york",
  });
  assert.equal(have, Object.keys(ABSENT).length, "every known withholding must be present exactly once");

  /* A deletion must fail even though the list is still long. */
  assert.throws(() => assertAbsentEntries({
    absent: keyed.filter((e) => e.key !== "plaza-to-courtyard-step"),
    expected: Object.fromEntries(Object.entries(ABSENT).map(([k, [, probe]]) => [k, probe])),
    label: "york",
  }), /has disappeared and is neither built nor claimed/);
  /* P6: the step is OWED to a batch, not merely listed. */
  const step = section.absent.find((a) => /THE PLAZA-TO-COURTYARD STEP/.test(a));
  assert.match(step, /owedTo: "R6"/, "the 0.961 m drop must be assigned to R6, not left on a list");
  assert.match(step, /0\.961|23\.70 m dead flat/, "the withholding itself must survive the assignment verbatim in substance");
});

test("S1(vi): every expr EVALUATES and reproduces its own value", () => {
  const figures = section.derivations.figures;
  const scope = exprScope(section);
  const { evaluated } = assertExprs({ figures, scope, label: "york" });
  assert.ok(evaluated >= 35, `only ${evaluated} exprs were evaluated`);
  /* `expr` is arithmetic ONLY: no figure may carry prose under that name. */
  for (const [k, f] of Object.entries(figures)) {
    if (k === "why") continue;
    if (f.expr === undefined) continue;
    assert.ok(!/\bof\b|\bmedian\b|\bvertices\b|\bwith\b|\[|'/.test(f.expr),
      `${k}'s expr is prose wearing an arithmetic name: ${f.expr}`);
  }
  /* And prose that WAS an expr is not lost — it moved to `derivation`. */
  for (const k of ["measured.courtyardStep", "courtyards.deckElevation", "closure.podiumStorey",
    "finSystem.meanProud", "courtyards.stepBelowPlaza"]) {
    assert.ok(figures[k].derivation && figures[k].derivation.length > 60,
      `${k} lost the prose its expr used to carry`);
  }

  /* THE TWO ACCEPTANCE TESTS THE ARBITRATION NAMES.
     F6 — an expr referencing a reading that exists nowhere. This was live:
     finSystem.windowWidth's expr named `reads.finSystem.windowBand`, which
     appears in no file in this repo, and nothing noticed. */
  assert.throws(() => assertExprs({
    figures: { x: { value: 0.425, expr: "(reads.finSystem.windowBand.0 + reads.finSystem.windowBand.1) / 2" } },
    scope, label: "york",
  }), /resolves to undefined|an expr referencing a reading that does not exist/,
    "an expr naming a reading that does not exist must be a hard failure");
  /* F7 — an expr that is a real formula but does not give its own value. */
  assert.throws(() => assertExprs({
    figures: { x: { value: section.grid.floorToFloor, expr: "grid.cmuCourse * 99" } },
    scope, label: "york",
  }), /own expr does not reproduce its own value/,
    "an expr that does not give its own value must fail");
  /* And prose may not sneak back in under the name `expr`. */
  assert.throws(() => assertExprs({
    figures: { x: { value: 1, expr: "median of derivations.readings.terrain.courtyard1Deck" } },
    scope, label: "york",
  }), /illegal character|does not reproduce|resolves to undefined/);
});

test("S2: every `sup` york is named for carries a disposition and a reciprocal claim", () => {
  /* revelle.json's retirement items carry `sup: "york"`, which reads to any
     consumer and to any gate as a TRANSFER. Thirteen of the batch's 56 are
     deletions on evidence, and only the prose could tell them apart. York is
     named on 22 of them — the most of any section — and this is york's half
     of the interlock: the reciprocal claim, in york's own file, saying which
     it is and what york ships for it. blake's lava-wall record is the shape. */
  const claims = Object.entries(section.superseded)
    .filter(([k]) => k.startsWith("revelle."))
    .map(([key, v]) => ({ key, ...v }));
  assert.equal(claims.length, 2, "york is named as successor on exactly two revelle runs");

  const revelle = existsSync(join(root, "Revelle-College-Sources/merge/r1/revelle.json"))
    ? read(join(root, "Revelle-College-Sources/merge/r1/revelle.json"))
    : shipped.revelle;
  const named = { bins: 0, racks: 0 };
  for (const [k, o] of Object.entries(revelle)) {
    if (!o || !Array.isArray(o.items) || !(k in named)) continue;
    named[k] = o.items.filter((it) => it.sup === "york").length;
  }
  assert.equal(named.bins + named.racks, 22,
    `revelle names york on ${named.bins + named.racks} items — the reciprocal set has changed and york's claims have not`);

  assertDispositions({
    label: "york",
    items: claims.map((c) => ({ key: c.key, disposition: c.disposition, sup: "york", detail: c.evidence })),
    reciprocals: Object.fromEntries(claims.map((c) => [`york:${c.key}`, c])),
  });

  const bins = section.superseded["revelle.bins#0-5"];
  assert.equal(bins.disposition, "deleted-on-evidence",
    "the six bins were DELETED on a 2024 photograph; a field that reads as a transfer says the opposite of what happened");
  assert.equal(bins.ships, false, "york ships no bins and is not meant to");
  assert.equal(named.bins, 6, "the deleted run is six bins");
  assert.ok(!/bins/i.test(JSON.stringify(section.westGround)), "york must not have quietly started shipping bins");

  const racks = section.superseded["revelle.racks#11-26"];
  assert.equal(racks.disposition, "transferred", "the sixteen hoops are a real transfer");
  assert.equal(racks.ships, true);
  assert.equal(racks.countChange, true, "16 hoops shipped as 10 is a count change");
  assert.equal(racks.retiredCount, named.racks, "the retired count must be the run revelle actually carries");
  /* THE REDUCTION IS A COUNT, NOT A SENTENCE — re-derived from what york
     builds, so it cannot drift from the geometry. */
  const hoops = section.westGround.racks.reduce((a, r) => a + r.hoops, 0);
  assert.equal(racks.count, hoops, `york claims ${racks.count} hoops and builds ${hoops}`);
  assert.ok(racks.count < racks.retiredCount, "a transfer with no reduction should not declare a count change");
  /* A successor that stops shipping the object must fail — audit-plaza F4. */
  assert.throws(() => assertDispositions({
    label: "york",
    items: [{ key: "revelle.racks#11-26", disposition: "transferred", sup: "york", detail: racks.evidence }],
    reciprocals: { "york:revelle.racks#11-26": { ...racks, ships: false } },
  }), /claims .* and ships nothing/);
  /* And a `sup` with no disposition at all. */
  assert.throws(() => assertDispositions({
    label: "york",
    items: [{ key: "revelle.bins#0-5", sup: "york", detail: bins.evidence }],
    reciprocals: {},
  }), /carries `sup` and no `disposition`/);
});

test("Y2: the fin module ships as [conflicted, asserted] and never implies it is settled", () => {
  /* The module is UNRESOLVED and not resolvable on the frames in this repo.
     0.9144 stays — changing it is not warranted either — but nothing may
     present it as derived, and the two figures R2 ruled on for this facade
     ship as FRACTIONS of it so a future re-solve carries them correctly. */
  near(section.grid.finModule, 0.9144, 1e-9, "the module is unchanged");
  assert.match(section.derivations.figures["grid.finModule"].why, /\[conflicted, asserted\]/,
    "the module must not be presented as derived");
  const c0 = section.conflicts[0];
  assert.match(c0, /^FIN MODULE — UNRESOLVED/, "conflicts[0] must lead with the unresolved module");
  assert.match(c0, /1\.320 m/, "conflicts[0] must record the frame's own vertical-scale answer");
  assert.match(c0, /2\.53 m/, "conflicts[0] must record what a 0.9144 module implies for the storey");
  assert.match(c0, /FORESHORTENING DOES NOT RESCUE IT/, "the geometry of the disagreement must be stated");
  assert.match(c0, /r = 0\.15|autocorrelat/i,
    "the FAILED CMU-course cross-check is the negative result and must be reported, not dropped");
  /* The metre values must be exactly consequent on the module, and the
     fractions must be the things that are labelled measured. */
  for (const k of ["finSystem.widthOfModule", "finSystem.windowWidthOfModule"]) {
    assert.ok(section.reads[k], `${k} must ship as a read of the frame, not as a derived metre`);
    assert.ok(Array.isArray(section.reads[k].band), `${k} must carry the band the frame supports`);
  }
  assert.match(section.finSystem.source, /CONSEQUENT ON AN UNRESOLVED MODULE/,
    "the fin block must say out loud that its metres depend on an unresolved module");
  /* The retired 0.2028 m width was wrong at BOTH candidate modules, so no
     re-solve rescues it. */
  for (const m of [0.9144, 1.32]) {
    assert.ok(0.202813297 / (section.finSystem.widthOfModule * m) > 1.9,
      `the retired 0.2028 m width must still be refuted at a ${m} m module`);
  }
});

test("P4: no figure in the record is a number that reproduces as nothing", () => {
  /* audit-york F11. `477` was cited as what the retired 1.829 m module yields;
     the section's own census gives 364 / 454 / 572 and 477 is none of them. */
  const C = section.counts.finCensus.retired;
  const ev = section.superseded["grid.finModule=1.829"].evidence;
  for (const n of [C.sourcedFaces, C.plusSouthEnd, C.wholeDressedComb]) {
    assert.match(ev, new RegExp(`\\b${n}\\b`), `the retirement must cite ${n}, which the census actually computes`);
  }
  /* 477 may still appear — the losing read stays on the record, as everything
     retired in this section does — but ONLY as a named retirement, never as a
     live claim, which is the same rule the dead blink URL is held to. */
  const places = [
    ["superseded['grid.finModule=1.829'].evidence", ev],
    ["campus-photo-york.js", moduleSrc],
    ...section.conflicts.map((c, i) => [`conflicts[${i}]`, c]),
    ...section.absent.map((a, i) => [`absent[${i}]`, a]),
    ...Object.entries(section.superseded).map(([k, v]) => [`superseded['${k}']`, JSON.stringify(v)]),
    ["grid.source", section.grid.source],
  ];
  for (const [where, text] of places) {
    if (!/(?<![\d.])477(?![\d])/.test(text)) continue;
    assert.match(text, /reproduces as nothing/,
      `${where} states 477 fins without saying it reproduces as nothing`);
  }
  /* And 366 is not to be rounded to 368: the built slot count is now gated
     against the built fin count directly (see the module-build test). */
  for (const [where, text] of places) {
    assert.ok(!/(?<![\d.])368(?![\d])/.test(text),
      `${where} carries the unreproducible 368-window figure`);
  }
});

test("colours are data, hex, epoch-honest, and every one carries a tier", () => {
  const keys = Object.keys(section.colors);
  /* BASELINE CHANGED from `>= 21` to an EXACT 20 — a tightening, and the one
     lost role is `retainingBoard`, whose object is retired (R2 arbitration
     P3). An exact count means a colour cannot be dropped OR added silently. */
  assert.equal(keys.length, 20, `${keys.length} colours — one role per colour, and retainingBoard is retired`);
  const tiers = { measured: 0, sourced: 0, estimated: 0 };
  for (const [k, v] of Object.entries(section.colors)) {
    assert.match(v, /^#[0-9a-f]{6}$/, `${k} is not a lowercase 6-digit hex`);
    const cs = section.colorSources[k];
    assert.ok(cs, `${k} has no colorSources line`);
    assert.ok(["measured", "sourced", "estimated"].includes(cs.tier), `${k} has no tier`);
    assert.match(cs.source, /^\[(measured|sourced|estimated)\]/, `${k}'s provenance line has no tier label`);
    assert.equal(cs.source.slice(1, cs.source.indexOf("]")), cs.tier, `${k}'s tier and label disagree`);
    assert.ok(cs.source.length > 80, `${k}'s provenance is a stub`);
    tiers[cs.tier]++;
  }
  assert.equal(Object.keys(section.colorSources).length, keys.length,
    "colorSources and colors must cover exactly the same roles");
  /* NOTHING is `measured` here, and the section must not pretend otherwise:
     the only colour frame on disk is a dead epoch. */
  assert.equal(tiers.measured, 0,
    "no York hex is re-derivable from a file in this repo — a `measured` tier here would be a claim nobody can check");
  assert.ok(tiers.sourced >= 8 && tiers.estimated >= 10,
    `tiering looks wrong: ${tiers.sourced} sourced, ${tiers.estimated} estimated`);
  /* Every `sourced` hex must admit that its frame is not on disk. */
  for (const [k, cs] of Object.entries(section.colorSources)) {
    if (cs.tier !== "sourced") continue;
    assert.match(cs.source, /PROVENANCE CAVEAT/, `${k} claims sourced without the on-disk caveat`);
  }
  /* Every `estimated` hex names what it extends or why nothing resolves it. */
  for (const [k, cs] of Object.entries(section.colorSources)) {
    if (cs.tier !== "estimated") continue;
    assert.match(cs.source, /extends|no frame|nothing samples|no crop|does not resolve|not a colour source/i,
      `${k} is estimated without saying what it extends`);
  }
  /* The 2008 medians are recorded and pasted into nothing. */
  const dead = section.colorConflicts.epoch2008;
  assert.ok(dead.frame.includes("UCOP2008"), "the dead-epoch frame must be named");
  const shippedHexes = new Set(Object.values(section.colors));
  const deadHexes = JSON.stringify(dead).match(/#[0-9a-f]{6}/g) || [];
  assert.ok(deadHexes.length >= 10, "the 2008 medians must be recorded, not summarised");
  for (const h of deadHexes) {
    assert.ok(!shippedHexes.has(h), `${h} is a 2008 under-exposed median and it is SHIPPING as a material colour`);
  }
  /* The measured CMU values, verbatim from the inventory (2024 epoch). */
  assert.equal(section.colors.cmuSunlit, "#b6956d");
  assert.equal(section.colors.cmuShaded, "#967e60");
  assert.equal(section.colors.precastAmbient, "#cbc6ba");
  /* R2 arbitration C-colour. York KEEPS both of the two hexes it was
     contested on, and they are pinned here so a later merge cannot quietly
     harmonise them: `benchWood` #8e6b60 wins against argo's #96754f (two
     sections against one, and the outlier's frame cannot be re-opened), and
     `precastAmbient` #cbc6ba is kept ALONGSIDE argo's #a6b5b7 — different
     buildings, both sourced, the clearest defensible disagreement in the
     table. Blake's byte-identical copy of argo's is the one that goes. */
  assert.equal(section.colors.benchWood, "#8e6b60", "benchWood is york/revelle's, and argo imports it");
  assert.notEqual(section.colors.precastAmbient, "#a6b5b7",
    "york's precast is independently sourced off lpa-york-1/2.jpg (2024) and must not be harmonised to argo's");
  const ch = (h, i) => parseInt(h.slice(i, i + 2), 16);
  const c = section.colors.cmuSunlit;
  assert.ok(ch(c, 1) > ch(c, 3) && ch(c, 3) > ch(c, 5), "cmuSunlit is not a warm tan");
  const luma = (h) => 0.299 * ch(h, 1) + 0.587 * ch(h, 3) + 0.114 * ch(h, 5);
  assert.ok(luma(section.colors.precastAmbient) > luma(section.colors.cmuSunlit),
    "the repainted white fins must read brighter than the CMU field");
});

test("the conflicts are declared and not averaged", () => {
  assert.ok(section.conflicts.length >= 6, "too few declared conflicts for what this section carries");
  for (const c of section.conflicts) assert.ok(c.length > 150, `conflict is a stub: ${c.slice(0, 60)}`);
  const joined = section.conflicts.join("\n");
  for (const [must, why] of [
    [/1\.46|two scales/i, "the 2008 frame's horizontal-vs-vertical scale disagreement"],
    [/805/, "the fin-count residual"],
    [/window slot/i, "the slot-versus-module tension, which is open for arbitration"],
    [/1965/, "the year-built conflict"],
    [/122,000|134,000/, "the floor-area conflict"],
    [/exposure/i, "the colour-epoch conflict"],
  ]) {
    assert.match(joined, must, `conflicts[] no longer declares ${why}`);
  }
  /* The fin census is computed, not asserted. */
  const C = section.counts.finCensus;
  const isFin = (f) => ["finFace", "westFace", "courtFace"].includes(f.system);
  const len = (f) => Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]);
  const fins = (set, m) => set.reduce((a, f) => a + Math.max(0, Math.floor(len(f) / m)) * f.finStoreys, 0);
  const finFaces = section.facades.filter(isFin);
  const sourced = finFaces.filter((f) => !f.estimated);
  const south = finFaces.filter((f) => f.estimated && /^south-end-(wing|bar)/.test(f.id));
  for (const name of ["derived", "retired"]) {
    const m = C[name].module;
    assert.equal(C[name].sourcedFaces, fins(sourced, m), `${name} census: sourced faces`);
    assert.equal(C[name].plusSouthEnd, fins([...sourced, ...south], m), `${name} census: + south end`);
    assert.equal(C[name].wholeDressedComb, fins(finFaces, m), `${name} census: whole comb`);
  }
  near(C.derived.module, section.grid.finModule, 1e-9, "the census must be run on the shipped module");
  assert.equal(C.retired.module, 1.829, "the retired module must stay in the census as the comparison");
  /* The point of the census: 805 is bracketed by the derived module and is
     nowhere near the retired one. */
  assert.ok(C.derived.sourcedFaces < section.counts.finsSourced
    && C.derived.plusSouthEnd > section.counts.finsSourced,
    "the derived module must bracket the sourced 805, which is the claim conflicts[] makes");
  assert.ok(C.retired.wholeDressedComb < section.counts.finsSourced,
    "the retired module must still be short of 805 even with every face dressed");
});

test("the york/plaza boundary is stated once, and the overlaps are flagged not claimed", () => {
  const B = section.boundary;
  assert.match(B.dgBelt, /82/, "the x=82 abutment must be stated");
  near(section.westGround.mulch.xWest, shipped.plaza.dgBelt.x1 + section.draw.beltGap, 1e-9,
    "York's ground must start where the plaza's DG belt ends");
  assert.ok(B.resolved.length >= 2 && B.flagged.length >= 2);
  for (const s of [...B.resolved, ...B.flagged]) assert.ok(s.length > 150, `boundary note is a stub: ${s.slice(0, 50)}`);
  /* BASELINE CHANGED (R2 arbitration P3): the retaining wall is RETIRED, so
     the gate that checked its clearance from the measured eucalyptus is
     replaced by one that checks the wall is gone from every place it lived —
     a retirement that leaves a stub behind is not a retirement. R1's move
     cleared the trunk by 6.2 m but the CROWN by only 0.4 m (audit-york F9),
     and no rung of the ladder gives the wall a grade to retain at all. */
  assert.equal(section.eastSide.retainingWall, undefined, "the retired retaining wall is still shipping");
  assert.equal(section.derivations.figures["eastSide.retainingWall.x"], undefined,
    "the retired wall's derivation is still in the figures table");
  for (const k of Object.keys(section.estimates)) {
    assert.ok(!/retainingWall/.test(k), `${k} is an estimate for a retired object`);
  }
  assert.equal(section.colors.retainingBoard, undefined, "the retired wall's colour has no consumer left");
  assert.equal(section.colorSources.retainingBoard, undefined, "a colorSources line without a colour");
  assert.ok(!/retainingBoard|retainingWall/.test(moduleSrc), "the module still builds the retired wall");
  /* And the retirement says what was looked for, why nothing was found, and
     that audit-york F10 is part of the same retirement rather than pending. */
  const retire = section.absent.find((a) => /RETAINING WALL/i.test(a) && /RETIRED/.test(a));
  assert.ok(retire, "absent must carry the retaining wall's retirement");
  assert.match(retire, /WHAT WAS LOOKED FOR/, "the retirement must state what was looked for");
  assert.match(retire, /3-7 cm\/m|terrace/, "the retirement must state why nothing was found");
  assert.match(retire, /F10/, "audit-york F10 is retired with the wall and must say so");
  /* The eucalyptus is now unopposed, and the record says so rather than
     claiming a clearance from an object that no longer exists. */
  assert.match(B.resolved[0], /RETIRED/, "the eucalyptus resolution must be the retirement, not a 0.4 m clearance");
  /* The two flagged overlaps are FLAGGED, i.e. this section did not move them. */
  assert.deepEqual(shipped.plaza.treeOverrides.pines.items[0], { x: 82.7, z: 336.6, h: 25.1, r: 6.1 },
    "the Torrey pine in York's west wall is flagged for the critic and must not have been moved");
  /* R2 arbitration P2. The gate above is UNCHANGED — it tests the right thing
     and it passes. What was wrong was the PROSE: 'within 0.1-1.0 m' does not
     reproduce. The nearest drawn ring edge and the west wall chord are BOTH
     2.20 m from the trunk, because z = 336.6 is 2.2 m north of where the west
     wall begins. Re-measured here so the corrected number cannot drift back. */
  const pine = shipped.plaza.treeOverrides.pines.items[0];
  const west = section.facades.find((f) => f.id === "west");
  const toChord = (() => {
    const [ax, az] = west.a; const [bx, bz] = west.b;
    const dx = bx - ax; const dz = bz - az;
    let t = ((pine.x - ax) * dx + (pine.z - az) * dz) / (dx * dx + dz * dz);
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(pine.x - (ax + dx * t), pine.z - (az + dz * t));
  })();
  near(toChord, 2.2, 5e-3, "the pine's distance to the west wall chord");
  near(toRingEdge(pine.x, pine.z, RING), 2.2, 5e-3, "the pine's distance to the nearest drawn ring edge");
  assert.match(B.flagged[0], /2\.20 m/, "the flag must state the distance that reproduces");
  assert.match(B.flagged[0], /'within 0\.1-1\.0 m' does not reproduce/,
    "the retired proximity stays on the record, but only as a named retirement — never as a live claim");
  /* And the flagged QUESTION is now ANSWERED: yes, the crown may cross the
     membrane. It is recorded, not corrected, and nothing is moved. */
  assert.match(B.flagged[0], /ALLOWED/, "the crown-crossing question must be answered, not left open");
  assert.match(B.flagged[0], /RECORDED, NOT CORRECTED/, "the disposition must be stated");
  assert.ok(pine.r - toChord > 3, "the crown genuinely does reach into the building — that is the fact being allowed");
});

test("LiDAR decides height: the dressing solves on the drawn prism", () => {
  assert.equal(section.measured.building, "York Hall");
  assert.equal(section.measured.lidarHeight, LIDAR_H, "lidarHeight drifted from the survey");
  const arcgis = read(join(root, "docs/data/campus-arcgis.json"));
  const drawn = assembleMasses({ campus, lidar: lidarFile, arcgis, colors: null })
    .find((m) => m.name === "York Hall" && m.src === "gis");
  assert.ok(drawn, "no drawn 'York Hall' gis mass — the wall the membrane hangs on is gone");
  assert.equal(MASS.h, drawn.h, "measured.mass.h drifted from the height campus-massing.js extrudes");
  assert.deepEqual(MASS.ring, drawn.rings[0],
    "measured.mass.ring must be the drawn mass's outer ring, byte for byte");
  assert.equal(section.grid.storeys, 4, "the drawn prism is 4 levels [arcgis]");
  assert.match(section.grid.source, /CONFLICT/i, "the 5.0 m estimate stays on the record as a declared conflict");
  assert.ok(section.structures.tower.cap > 0 && section.structures.tower.cap <= 2.5);
});

/* RE-DECIDED 2026-08-21, visual round 2, MAJOR 4. The 35 is still SOURCED and
   still on the record everywhere it was; what is retired is the inference
   that divided the drawn west edge by it to get a bay. The frame refutes that
   bay, so this gate no longer checks that the arcade builds 35 — it checks
   that the count survives as a source, that the refutation is stated with its
   arithmetic, and that neither reading has been quietly dropped. */
test("the 35-column source SURVIVES, the bay it implied does not, and both stay recorded", () => {
  const A = section.arcade;
  assert.equal(A.columnsSourced, 35, "the sourced count stays on the record");
  assert.equal(section.counts.arcadeColumnsSourced, 35, "and stays in the counts block");
  assert.equal(section.derivations.readings.counted.arcadeColumns, 35, "and stays a pinned reading");
  assert.equal(A.sides, 6, "hexagonal, and now sourced rather than true by accident");
  assert.match(A.note, /RE-DECIDED/i, "the note must record that this was re-decided, and how");
  assert.match(A.note, /hexagon/i, "the hexagon must be written down where the geometry is");
  assert.match(A.note, /semicircular/i, "the head profile must be written down where the geometry is");

  const west = section.facades.find((f) => f.id === "west");
  const len = Math.hypot(west.b[0] - west.a[0], west.b[1] - west.a[1]);
  near(len, section.derivations.readings.ring.westEdgeLength, 1e-6, "the west edge length reading");
  /* 91.1055 m is 298.9 ft against a sourced 300 ft — same object, 0.35%. That
     part of the 2026-08-20 finding stands and is not being re-litigated. */
  const ft = len / 0.3048;
  assert.ok(Math.abs(ft - 300) / 300 < 0.01,
    `the drawn west edge is ${ft.toFixed(1)} ft against a sourced 300 ft — too far apart to be the same wall`);

  /* THE REFUTATION, RECOMPUTED HERE. A 35-column row over this wall is a
     2.6796 m bay, which at the frame's 250 px storey is 183 px of column
     pitch against a pinned reading of 268 px. Foreshortening compresses a
     facade horizontally and cannot stretch one, so the gap cannot close in
     the direction the count needs. */
  const px = section.derivations.readings.px2008;
  const impliedBay = len / (A.columnsSourced - 1);
  const impliedPitch = (impliedBay / section.grid.floorToFloor) * px.storeyPitch;
  assert.ok(impliedPitch < px.columnPitch * 0.75,
    `the 35-column bay implies ${impliedPitch.toFixed(0)} px of column pitch against a measured ${px.columnPitch} — if these have converged, a reading has moved`);
  /* And the built row is what the MEASURED bay gives, not what the count did. */
  assert.equal(Math.floor(len / A.bay) + 1, section.counts.arcadeColumns,
    "the measured bay over the drawn west edge must give the declared built count");
  assert.equal(section.counts.arcadeColumns, 24);

  /* Neither reading may vanish from the record. */
  const record = JSON.stringify(section.conflicts) + section.absent.join("\n")
    + JSON.stringify(section.superseded);
  for (const keep of ["35", "2.6796", "300-foot", "25 columns"]) {
    assert.ok(record.includes(keep), `the record has lost ${keep}`);
  }
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
    const mx = (f.a[0] + f.b[0]) / 2;
    const mz = (f.a[1] + f.b[1]) / 2;
    assert.ok(!inRing(mx + f.out[0] * 0.5, mz + f.out[1] * 0.5, r), `${f.id}'s normal points into the building`);
    assert.ok(inRing(mx - f.out[0] * 0.5, mz - f.out[1] * 0.5, r), `${f.id} does not back onto the mass`);
    assert.match(f.source, /\w/, `${f.id} has no source`);
    assert.ok(section.structures[f.structure], `${f.id} names unknown structure ${f.structure}`);
    /* No source string may cite a file the provenance block calls missing as
       though it were openable — every one must be marked. */
    if (/lpa-york-\d\.jpg|structuremag-york-hall/.test(f.source)) {
      assert.match(f.source, /not on disk|NOT on disk|provenance/i,
        `${f.id} cites a missing file without saying so`);
    }
  }
  for (const k of ["west", "north", "south", "lecture", "tower"]) {
    assert.ok(section.facades.some((f) => f.structure === k), `${k} has no dressed face`);
  }
  const perim = RING.reduce((s, p, i) => {
    const q = RING[(i + 1) % RING.length];
    return s + Math.hypot(q[0] - p[0], q[1] - p[1]);
  }, 0);
  const covered = section.facades.reduce(
    (s, f) => s + (f.structure === "tower" ? 0 : Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1])), 0);
  assert.ok(covered > 0.75 * perim && covered < perim,
    `facades cover ${covered.toFixed(1)} m of a ${perim.toFixed(1)} m drawn ring — a face is missing or doubled`);
  assert.ok(section.absent.some((a) => /notch|jog|stair bump/i.test(a)),
    "the undressed drawn notches must be declared");
});

test("the sourceless south end is [estimated] in PATTERN and measured in HEIGHT", () => {
  const ids = ["south-end-wing", "south-end-bar", "south-end-wing-east"];
  for (const id of ids) {
    const f = section.facades.find((x) => x.id === id);
    assert.ok(f, `${id} — the face is built, not skipped`);
    assert.equal(f.estimated, true, `${id} must be declared [estimated]`);
    assert.match(f.source, /estimated/i);
    const ref = section.facades.find((x) => x.id === f.patternRef);
    assert.ok(ref, `${id}'s patternRef names unknown face ${f.patternRef}`);
    assert.ok(!ref.estimated, `${id} extends ${ref.id}, which must itself be sourced`);
    assert.equal(ref.structure === "west", f.structure === "west", "the pattern comes from the same structure family");
    assert.equal(ref.finStoreys, f.finStoreys, "the extension keeps the sibling's storey count");
  }
  /* THE HEIGHT IS NOT ESTIMATED. measured.parts must carry the south end off
     LiDAR, and its entry must say the label covers the pattern only. */
  const p = section.measured.parts.find((x) => x.key === "south-end-wing");
  assert.ok(p, "measured.parts must carry the south end");
  assert.match(p.source, /MEASURED HEIGHT/, "the south end's height must be declared measured, not estimated");
  near(p.ground, section.derivations.readings.terrain.faces["south-end-wing"].med, 1e-9,
    "the south end's ground must be the terrain's, not a guess");
  assert.ok(section.absent.some((a) => /south end/i.test(a) && /HEIGHT IS NOT ESTIMATED/i.test(a)),
    "absent must record that the [estimated] label covers the pattern and never the height");
});

test("three fins per bay, ONE SLOT PER FIN, and the field stays block not glass", () => {
  const G = section.grid;
  const F = section.finSystem;
  const west = section.facades.find((f) => f.id === "west");
  assert.equal(west.system, "westFace");
  assert.equal(west.finStoreys, 2, "STRUCTURE: York West is a two-story structure — not three");
  for (const id of ["north-wing", "north-east", "south-east", "south-end-wing"]) {
    assert.equal(section.facades.find((f) => f.id === id).finStoreys, 4, `${id} is four storeys`);
  }
  /* R2 ARBITRATION Y1. BASELINE CHANGED, AND IT IS A TIGHTENING IN BOTH
     DIRECTIONS. The retired gate was `windowWidth` inside DPR 523's PROSE
     band 0.35-0.5 m plus `windowsPerBay === 1`; the frame the section itself
     cites measures the slot at 0.0805 of the fin module and finds one beside
     EVERY fin in both storey bands (14 of 14), so the prose band is a
     declared conflict and the count is per fin. The slot is now pinned to a
     measured FRACTION rather than allowed a 0.15 m prose range. */
  assert.equal(F.windowsPerBay, undefined,
    "windowsPerBay is retired — the slot is per FIN and shipping both counts would let a consumer pick");
  assert.equal(F.windowsPerFin, 1, "one narrow flush metal window slot per FIN [14 of 14 in the 2008 frame]");
  near(F.windowWidthOfModule, 0.0805, 1e-9, "the slot's measured fraction of the fin module");
  near(F.widthOfModule, 0.0761, 1e-9, "the fin's measured fraction of the fin module");
  /* Y2: the metre values are CONSEQUENT on an unresolved module and must be
     exactly the fraction times it, so a re-solve of the module carries them. */
  near(F.width, F.widthOfModule * G.finModule, 1e-12, "the fin's metre value must be its fraction of the module");
  near(F.windowWidth, F.windowWidthOfModule * G.finModule, 1e-12, "the slot's metre value must be its fraction of the module");
  /* THE REPEATING UNIT IS NOW THE FIN MODULE: one fin, one slot, and the rest
     split-face block. A glazed-band York reads completely wrong, and this is
     the gate that says so on the unit that actually repeats. The section's
     own R1 reasoning — that a per-fin slot would make the field 46% glass —
     was true only of the 0.425 m slot it had imported from prose. */
  const solid = G.finModule - F.windowsPerFin * F.width - F.windowsPerFin * F.windowWidth;
  assert.ok(solid / G.finModule > 0.5,
    `only ${(100 * solid / G.finModule).toFixed(0)}% of each fin module stays solid CMU — the field must read as block, not glass`);
  near(solid / G.finModule, 0.843, 1e-3, "the frame's own proportions give 84.3% solid CMU per module");
  assert.ok(F.proudHaunch <= 0.3, `fin haunch ${F.proudHaunch} m — do not model a 0.5 m blade`);
  assert.ok(F.proudMid <= 0.2 && F.proudMin < F.proudMid, "spindle profile");
  /* The fin's own volume must still be the sourced 500 lb — that reading is
     unchanged and is pinned. What is retired is the claim that the mass
     DERIVES the width: it pins the cross-sectional AREA, and the projection
     it would be divided by is a stack of [estimated] spindle dimensions. Both
     readings stay on the record and neither is averaged. */
  const U = section.derivations.units;
  const lbs = F.volume * U.concreteDensity / U.pound;
  near(lbs, section.derivations.readings.counted.finMassLb, 1e-3,
    "the fin's own volume must be the sourced 500 lb");
  const massWidth = F.volume / G.floorToFloor / F.meanProud;
  assert.ok(massWidth / F.width > 2,
    "the mass chain and the frame must still DISAGREE — if they have converged, one of them has been quietly moved");
  assert.match(section.derivations.figures["finSystem.width"].why, /\[conflicted\]/,
    "finSystem.width is conflicted, not derived");
  assert.match(JSON.stringify(section.conflicts), /0\.025836/,
    "the retained mass reading must state the AREA it actually pins");
  for (const f of section.facades.filter((x) => x.structure === "tower")) {
    assert.equal(f.system, "towerBlank", `${f.id}: the service tower is blank — no fins, no openings`);
  }
});

test("no facade layer floats more than a metre off its measured face", () => {
  const D = section.draw;
  const reaches = [
    D.finStandoff + section.finSystem.proudHaunch,
    D.bandProud + D.finStandoff,
    /* The arcade's reach IS columnStandoff exactly. It used to be
       columnStandoff + 0.5, a stand-in for how far the lathe capital bulged
       outward; the fan is now cut in the screen and the shafts are inset by
       their own base radius so their faces sit IN the screen's outer plane,
       so nothing in the arcade passes it. That is why the recess could be
       deepened to 0.85 m and still clear this section's own 1.0 m rule. */
    D.columnStandoff,
    D.doorStandoff + D.doorThickness,
  ];
  for (const r of reaches) assert.ok(r <= 1.0, `a facade layer reaches ${r.toFixed(2)} m off the measured wall`);
  /* And the claim that makes the arcade's reach exactly columnStandoff: the
     shafts are inset by their own base radius, and the screen is extruded
     inward from the same plane. If either stops being true the arcade is
     reaching further than this gate measures. */
  const src = readFileSync(join(root, "docs/js/campus-photo-york.js"), "utf8");
  assert.match(src, /D\.columnStandoff - A\.shaftBase/,
    "the shafts must be inset by their base radius or their faces pass the screen");
  assert.match(src, /D\.columnStandoff - D\.arcadeScreenDepth/,
    "the screen must be extruded INWARD from columnStandoff");
  assert.ok(D.columnStandoff - D.backStandoff > 0.5,
    "the drawn arcade recess collapsed — under 0.5 m it reads as a niche again (visual round 2, MAJOR 3)");
});

/* THE GATE THAT WOULD HAVE CAUGHT THE ROUND-2 REGRESSION.
 *
 * The arcade rebuild shipped the soffit block's front face and the arcade
 * screen's outer face BOTH at `columnStandoff`, and the mullions in the
 * glazing's own plane. Nothing in this suite looked at depth: every geometric
 * gate here asks where a surface IS, and coplanarity is a relationship BETWEEN
 * two surfaces. The re-audit found the result immediately — 91 m of torn tan
 * dashes across the white fascia band at eye level on the signature elevation,
 * in four frames at four camera distances, plus mullions rendering as broken
 * dotted lines.
 *
 * So: every face plane of every arcade layer is recomputed here from `draw`
 * and `arcade`, in the same standoff coordinate the module builds in, and no
 * two may land within `MIN_SEPARATION` of each other. This is a real gate, not
 * a restatement — it fails on the exact geometry that shipped. */
test("no two arcade layers share a face plane — the round-2 z-fighting gate", () => {
  const D = section.draw;
  const A = section.arcade;
  /* Standoff of each layer's faces, outward-positive off the ring chord —
     the `w` argument the module's frameOf().at() takes. */
  const planes = {
    "back wall": [D.backStandoff],
    "soffit": [
      D.backStandoff / 2,
      D.columnStandoff - D.arcadeScreenDepth / 2,
    ],
    "glazing": [
      D.windowStandoff + D.doorThickness / 2 - D.doorThickness / 2,
      D.windowStandoff + D.doorThickness / 2 + D.doorThickness / 2,
    ],
    "mullions": [
      D.windowStandoff + D.doorThickness - D.doorThickness / 2,
      D.windowStandoff + D.doorThickness + D.doorThickness / 2,
    ],
    "screen": [D.columnStandoff - D.arcadeScreenDepth, D.columnStandoff],
  };
  /* Two surfaces closer than this in depth cannot be relied on to resolve at
     the distances this building is seen from; the observed failure was at
     exactly 0.0 m. */
  const MIN_SEPARATION = 0.02;
  const check = (byLayer) => {
    const flat = [];
    for (const [layer, ws] of Object.entries(byLayer)) for (const w of ws) flat.push({ layer, w });
    for (let i = 0; i < flat.length; i++) {
      for (let j = i + 1; j < flat.length; j++) {
        if (flat[i].layer === flat[j].layer) continue;
        assert.ok(
          Math.abs(flat[i].w - flat[j].w) >= MIN_SEPARATION,
          `${flat[i].layer} at ${flat[i].w.toFixed(3)} m and ${flat[j].layer} at ${flat[j].w.toFixed(3)} m `
          + "are the same plane — coplanar surfaces tear, they do not blend",
        );
      }
    }
  };
  check(planes);

  /* THE TWO CONFIGURATIONS THAT ACTUALLY SHIPPED AND FAILED, so this gate is
     demonstrated rather than merely asserted. Both must throw. */
  assert.throws(() => check({
    ...planes,
    soffit: [D.backStandoff, D.columnStandoff],   /* round 2 as shipped */
  }), /are the same plane/,
    "the gate must fail on the soffit front face that tore the fascia band");
  assert.throws(() => check({
    ...planes,
    mullions: [D.windowStandoff, D.windowStandoff + D.doorThickness],  /* round 2 as shipped */
  }), /are the same plane/,
    "the gate must fail on mullions sharing the glazing plane");
  /* And the shafts really are inset to sit IN the screen's outer plane, which
     is the one deliberate coincidence in the assembly and is a coincidence of
     the shaft's SURFACE with the screen's, not of two flat faces. */
  near(D.columnStandoff - A.shaftBase + A.shaftBase, D.columnStandoff, 1e-9,
    "the shafts must be inset by their base radius so their faces sit in the screen plane");

  /* The mullions stand PROUD of the glass rather than in it — they are members
     in front of a glazed screen, and sharing its plane is what made them
     render as dotted broken verticals. */
  assert.ok(D.windowStandoff + D.doorThickness > D.windowStandoff + D.doorThickness / 2,
    "the mullions must sit proud of the glazing plane");

  /* The separate fascia box is retired, not hidden: the band is the screen's
     head and the retirement is on the record with its evidence. */
  const src = readFileSync(join(root, "docs/js/campus-photo-york.js"), "utf8");
  assert.ok(!/bins\.fascia\b/.test(src), "the redundant fascia box is retired");
  assert.ok(section.superseded["arcade.fascia=separate-box"],
    "retiring the fascia box must go through superseded[] like every other retirement");
  assert.equal(section.superseded["arcade.fascia=separate-box"].ships, true,
    "the BAND still ships — only the box that drew it is retired");
  assert.ok(section.arcade.fascia.height > 0,
    "the sourced fascia height still governs the band the screen leaves above its crowns");
  for (const dead of ["fasciaProud", "fasciaDepth"]) {
    assert.equal(D[dead], undefined, `${dead} positioned the retired box and must not linger as a dead offset`);
    assert.equal(D.bands[dead], undefined, `${dead} must not linger in the band table either`);
  }
});

test("everything sits inside the declared bounds", () => {
  const b = section.bounds;
  for (const [x, z] of [...solids(), ...decals(), ...facadePoints()]) {
    assert.ok(x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1,
      `(${x}, ${z}) is outside the declared bounds ${JSON.stringify(b)}`);
  }
  /* And bounds is the ring's own extent plus a pad, not a number typed in. */
  const xs = RING.map((p) => p[0]);
  const zs = RING.map((p) => p[1]);
  near(b.x1 - Math.max(...xs), Math.min(...xs) - b.x0, 1e-6, "the bounds pad is not symmetric");
});

test("nothing invented sits inside a measured building footprint", () => {
  const rings = campus.buildings.filter((b) => b.p && b.p.length >= 3);
  for (const [x, z] of [...solids(), ...decals()]) {
    for (const b of rings) {
      assert.ok(!inRing(x, z, b.p), `(${x}, ${z}) is inside ${b.n || "an unnamed mass"}`);
    }
  }
  /* The mulch bed was the one that failed this for real: its east edge now
     follows the drawn wall chord, so no corner of it may enter the DRAWN ring
     either — the survey ring alone did not catch it. */
  for (const [x, z] of decals()) {
    assert.ok(!inRing(x, z, RING), `(${x.toFixed(2)}, ${z.toFixed(2)}) is inside York's own drawn ring`);
  }
});

test("no solid object crowds the scooter corridor", () => {
  let worst = Infinity;
  let at2 = null;
  for (const [x, z] of [...solids(), ...facadePoints()]) {
    const d = toRoute(x, z);
    if (d < worst) { worst = d; at2 = [x, z]; }
  }
  assert.ok(worst >= 3, `closest solid is ${worst.toFixed(2)} m from the centreline at ${at2}`);
});

test("the ground scope stops at York's own aprons — no double-build of the plaza belt", () => {
  const M = section.westGround.mulch;
  assert.ok(M.xWest >= 82, `mulch starts at x=${M.xWest}, inside the plaza module's DG belt`);
  for (const r of section.westGround.racks) assert.ok(r.x >= 82, "racks belong to York's own frontage");
  assert.match(section.westGround.source, /plaza landscape/i, "the hand-off to the plaza module must be written down");
  assert.ok(section.absent.some((a) => /plaza landscape|dgBelt/i.test(a)), "the not-rebuilt-here belt must be declared");
  /* The bed follows the WALL, not a rectangle — the shipped rectangle put a
     metre of mulch inside the building at the north end. */
  assert.ok(M.wall && M.bands, "the bed must be declared against the wall chord");
  assert.deepEqual(M.wall.a, section.facades.find((f) => f.id === "west").a);
  assert.deepEqual(M.wall.b, section.facades.find((f) => f.id === "west").b);
});

test("the courtyards are a podium, and the roof is what the photograph shows", () => {
  const C = section.courtyards;
  assert.match(C.deckNote, /roof/i, "the podium fact must be recorded");
  assert.match(C.source, /estimated/i, "planter positions are [estimated] and must say so");
  assert.ok(C.stepBelowPlaza > 0.5, "the plaza-to-courtyard step must be recorded, not lost");
  for (const p of C.items) assert.ok(!inRing(p.x, p.z, RING), `planter (${p.x}, ${p.z}) is inside the measured mass`);

  const L = section.roof.louvreWell;
  /* RETIRED with the research doc's authority: the old gate capped the blades
     at 1.5 m to keep an UNSOURCED figure curb-scale. The height is now sourced
     off ARK bb8089859p at 2.2 +/- 0.3 m, so the cap is replaced by the read's
     own tolerance plus the photograph's own comparison — the blades are
     'comparable to' the penthouse and may not exceed it. */
  const R = section.reads["roof.louvreWell.bladeHeight"];
  assert.ok(Math.abs(L.bladeHeight - R.value) <= R.tolerance, "blade height is outside its own read tolerance");
  assert.ok(L.bladeHeight <= section.roof.penthouse.size[1],
    "bb8089859p compares the blades TO the penthouse — they may not stand taller than it");
  /* R2 arbitration S1(iii), closing audit-york F4. The comparison above
     derives its ceiling FROM ITS OWN SUBJECT, so 'penthouse 2.5 -> 4.0 and
     blades 2.2 -> 3.5' — a 60% inflation of the whole roof — passed 33/33.
     BOTH READS ARE NOW PINNED AS LITERALS, in the test, so neither side of
     the comparison can move at all. The arbitration asked for the ceiling to
     be re-pinned to York's LiDAR maximum instead; there is no single such
     figure (campus-3d h=20, lidar heights 12.6, massHeights 15.1) and the
     contest is recorded in conflicts[] rather than resolved by invention. */
  assert.match(JSON.stringify(section.conflicts), /LIDAR HEIGHT ANCHOR IS ITSELF CONTESTED/,
    "the unresolved LiDAR anchor must be declared, not quietly worked around");

  /* P3: the penthouse stands BESIDE THE BLADE BANK, which is what its own
     source string always said and what its coordinates did not do — they put
     it 65 m away on another wing. The blades are independently placed and did
     not move; the penthouse did, and the well is re-checked against it here. */
  const PH = section.roof.penthouse;
  assert.equal(PH.structure, L.structure, "the bulkhead and the blade bank stand on ONE wing");
  const wellEdge = Math.max(
    L.x0 - (PH.x + PH.size[0] / 2), PH.x - PH.size[0] / 2 - L.x1,
    L.z0 - (PH.z + PH.size[2] / 2), PH.z - PH.size[2] / 2 - L.z1);
  assert.ok(wellEdge > 0, "the penthouse overlaps the louvre well — the blades would run through it");
  assert.ok(wellEdge < 2 * section.draw.wellMargin,
    `the penthouse stands ${wellEdge.toFixed(1)} m from the blade bank — bb8089859p shows it BESIDE the bank`);
  assert.ok(inRing(PH.x, PH.z, RING), "the penthouse must stand on a roof York actually has");
  for (const dx of [-1, 1]) for (const dz of [-1, 1]) {
    assert.ok(inRing(PH.x + dx * PH.size[0] / 2, PH.z + dz * PH.size[2] / 2, RING),
      "a corner of the penthouse hangs off the drawn ring");
  }
  assert.match(PH.source, /RELOCATED/, "the relocation must be on the record where the old coordinates were");
  assert.match(L.source, /RE-CHECKED/, "the well must record that it was re-checked against the moved penthouse");
  assert.notDeepEqual([PH.x, PH.z], [112, 419], "the retired south-wing coordinates are back");
  assert.equal(L.rowCount, 1, "bb8089859p shows a SINGLE row of blades, not two");
  assert.equal(L.rows.length, L.rowCount, "the built rows must be the sourced row count");
  assert.ok(L.bladeTiltDeg > 0, "the blades are TILTED, not upright — that is what the photograph changes");
  assert.match(L.source, /bb8089859p/, "the roof must cite the frame it is now built from");
  assert.match(L.source, /UNSOURCED PLACEMENT/, "which wing carries it is still unsourced and must say so");
  assert.equal(section.roof.penthouse.glazed, true, "bb8089859p shows a GLAZED bulkhead, not a louvered block");
  assert.ok(!/louvered/i.test(section.roof.penthouse.source),
    "the penthouse's source must no longer describe it as louvered");
  assert.match(section.roof.wingAssignment, /\[estimated\]/, "the wing assignment stays declared estimated");
  assert.ok(section.absent.some((a) => /which wing/i.test(a) && /Roof equipment/i.test(a)),
    "absent must keep the open part: which wing carries which");
  assert.match(section.roof.westNote, /clean|coping/i, "York West's roof stays clean [sourced]");
});

test("york is built exactly once: the revelle module no longer draws it", () => {
  const src = readFileSync(join(root, "docs/js/campus-photo-revelle.js"), "utf8");
  assert.ok(!/buildYork/.test(src), "campus-photo-revelle.js still has buildYork");
  assert.ok(!/systems\.yorkArcade\.|systems\.yorkFins\./.test(src),
    "campus-photo-revelle.js still reads the legacy york keys");
});

/* ----------------------------------------------- the module, run for real */

const flat = () => 21.0;
const build = (g = flat) => createPhotoYork(null, { photo: { york: section }, heightAt: g, surfaceAt: g });

test("the module builds the section, and the declared counts are the built ones", () => {
  const a = build();
  assert.ok(a.group instanceof THREE.Group);
  assert.equal(a.counts.facades, section.counts.facades, "declared facade count");
  assert.equal(a.counts.arcadeColumns, section.counts.arcadeColumns,
    "the west arcade row must build the count the section declares");
  assert.equal(a.counts.arcadeColumns, 24);
  assert.ok(a.counts.courtColumns >= 20, "both courtyard arcades are built");
  /* MAJOR 3: the arcade is PIERCED. A bay that is not an opening is a solid
     pier, which is what the arcade looked like before this round, so the
     count of solid bays must be zero and every bay must carry glazing behind
     its opening. */
  assert.ok(a.counts.arcadeOpenings >= 40, `only ${a.counts.arcadeOpenings} arch openings were cut`);
  assert.equal(a.counts.arcadeSolidBays, 0, "a bay with no opening is the niche this round removed");
  assert.equal(a.counts.arcadeGlass, a.counts.arcadeOpenings,
    "every opening must show the sourced glazed back wall through it");
  /* MAJORS 1 and 2: the three masses that shipped as raw planes are dressed.
     Five faces (three lecture, two court end walls) x at least two storey
     lines each. */
  assert.ok(a.counts.dressedBands >= 10,
    `only ${a.counts.dressedBands} storey bands on the plain walls — the Lecture Hall and the court end walls read as raw grey without them`);
  assert.ok(a.counts.fins >= 800, `only ${a.counts.fins} fins — the membrane is the building`);
  assert.equal(a.counts.finsBuilt, section.counts.finCensus.derived.wholeDressedComb,
    "the built fin count must be the census the section declares");
  /* BASELINE CHANGED (R2 arbitration Y1): the retired gate was
     `windows < fins`, which encoded the refuted per-arcade-bay slot. There is
     one slot per fin, so the two counts must be EQUAL — a stricter gate than
     an inequality, and it is also what makes audit-york F11's unreproducible
     `windows 368` a checkable number instead of prose in a buildlog. */
  assert.equal(a.counts.windows, a.counts.fins * section.finSystem.windowsPerFin,
    "one narrow flush metal slot per fin, in every storey of every fin-clad face");
  assert.ok(a.counts.cmuPanels > 30, "the CMU field is built per storey per face");
  assert.ok(a.counts.doors > 10, "the east corridor door runs are built");
  assert.equal(a.counts.planters, section.courtyards.items.length);
  assert.ok(a.counts.roofBlades > 40, "the louvre row is built");
  /* The storey grid the module built on is the derived one, not 15.1/4. */
  near(a.counts.storeyH, section.grid.floorToFloor, 1e-9, "the module built on a storey it invented");
  near(a.counts.roofY - a.counts.finTop, section.grid.parapet, 1e-9,
    "the coping must be the drawn prism's residual, not a free number");
  near(a.counts.roofY, flat() + MASS.h, 1e-9, "the parapet is rim-median ground plus the LiDAR height");
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

test("a missing section is harmless, a missing sampler is not silent", () => {
  const empty = createPhotoYork(null, { photo: {} });
  assert.equal(empty.group.children.length, 0);
  assert.deepEqual(empty.counts, {});
  assert.throws(() => createPhotoYork(null, { photo: { york: section } }), /surfaceAt/);
  assert.throws(() => createPhotoYork(null, {
    photo: { york: { ...section, draw: undefined } }, surfaceAt: flat,
  }), /draw/);
  const added = [];
  createPhotoYork({ add: (g) => added.push(g) }, { photo: { york: section }, surfaceAt: flat });
  assert.equal(added.length, 1);
});

/* Flat, an exaggerated slope, and the REAL drawn LiDAR surface. The last one
   is the case that ships, and it is the height of the drawn TRIANGLE rather
   than the interpolated grid, which is the whole point of surfaceAt. */
const GROUNDS = [
  ["flat", flat],
  ["slope", (x, z) => 21 + 2 * Math.sin(x / 18) + 1.5 * Math.cos(z / 23)],
  ["drawn", drawnGround],
];

test("ground objects seat on their own surface — nothing floats, nothing buries", () => {
  for (const [label, ground] of GROUNDS) {
    const { group } = build(ground);
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
        const dy = pos.y - ground(pos.x, pos.z);
        assert.ok(dy > -0.7 && dy < 4.0,
          `${label}: a ground instance at (${pos.x.toFixed(1)}, ${pos.z.toFixed(1)}) sits ${dy.toFixed(2)} m off the terrain`);
        seen++;
      }
    });
    assert.ok(seen > 60, `${label}: only ${seen} ground instances sampled`);

    /* Ground decals are DRAPED: every vertex hugs the surface, at its own
       declared overlay rung and no other. */
    group.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    let decalMeshes = 0;
    let verts = 0;
    const lifts = [overlayLift(section.draw.carpetRung), overlayLift(section.draw.groundDatumRung)];
    gr.traverse((o) => {
      if (!o.isMesh || o.name !== "ground-decal") return;
      decalMeshes++;
      const p = o.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
        const dy = v.y - ground(v.x, v.z);
        assert.ok(lifts.some((L) => Math.abs(dy - L) < 0.02),
          `${label}: ground-decal vertex at (${v.x.toFixed(1)}, ${v.z.toFixed(1)}) sits ${dy.toFixed(3)} m off the terrain — not on a declared overlay rung`);
        verts++;
      }
    });
    assert.ok(decalMeshes >= 5, `${label}: only ${decalMeshes} draped ground decals`);
    assert.ok(verts > 150, `${label}: only ${verts} draped vertices checked`);
  }
});

test("every arcade column reaches its own ground and none is left hanging", () => {
  /* The columns are the one system that solves per footing, so a wrong datum
     shows here first — this is the failure the 2026-08-17 audit photographed,
     with the colonnade buried below plaza grade. */
  for (const [label, ground] of GROUNDS) {
    const r = build(ground);
    /* Every arcade face is two fin storeys, so there is ONE springing line on
       the building and it is recomputed here from the section rather than read
       off the module. */
    const SPRING = r.counts.finTop - 2 * section.grid.floorToFloor
      - section.arcade.fascia.height - section.arcade.archRadius;
    const columns = r.group.children.find((c) => c.isInstancedMesh
      && c.geometry.type === "LatheGeometry" && c.count === r.counts.arcadeColumns + r.counts.courtColumns);
    assert.ok(columns, `${label}: no arcade column mesh`);
    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    for (let i = 0; i < columns.count; i++) {
      columns.getMatrixAt(i, m);
      m.decompose(pos, q, sc);
      near(pos.y, ground(pos.x, pos.z), 2e-3,
        `${label}: a column foot at (${pos.x.toFixed(1)}, ${pos.z.toFixed(1)}) is off its own ground`);
      /* Since 2026-08-21 a shaft runs foot to SPRINGING, not foot to fascia:
         the fan above the springing is cut in the arcade screen, because two
         lathe flares meeting make a pointed arch and a lathe capital bulges
         its full radius into the plaza. The springing is a LEVEL line and the
         plaza under the west face rises 1.3 m along its run, so a shaft's
         HEIGHT is legitimately variable and a magnitude floor on it is
         meaningless — it deleted five real columns. What must hold, and is a
         far stronger claim, is that every shaft on the building tops out on
         exactly the same springing line. */
      assert.ok(sc.y > 0, `${label}: a column has no height at all`);
      /* 1e-4 because the height is read back through a Matrix4 compose and
         decompose in float32, not because the springing is approximate — the
         observed round-trip error is ~1e-6 m and a real drift would be
         centimetres. */
      near(pos.y + sc.y, SPRING, 1e-4,
        `${label}: a column at (${pos.x.toFixed(1)}, ${pos.z.toFixed(1)}) tops out off the springing line`);
      assert.ok(pos.y + sc.y < r.counts.finTop + 1e-6,
        `${label}: a column pushes up through the fin storeys above it`);
    }

    /* THE GLAZING STOPS AT THE SPRINGING TOO, so the semicircular head stays a
       vault rather than a pane. Running the glass to the crown left the recess
       with nothing in it but glass, which is why the re-audit read every arch
       as a flat black hole. */
    const glass = r.group.children.find((c) => c.isInstancedMesh
      && c.geometry.type === "BoxGeometry" && c.count === r.counts.arcadeGlass);
    assert.ok(glass, `${label}: no arcade glazing mesh`);
    for (let i = 0; i < glass.count; i++) {
      glass.getMatrixAt(i, m);
      m.decompose(pos, q, sc);
      near(pos.y + sc.y / 2, SPRING, 1e-4,
        `${label}: an arcade glazing panel reaches past the springing into the arch head`);
    }
  }
});

test("the membrane stays between the ground and the drawn parapet, on every terrain", () => {
  for (const [label, ground] of GROUNDS) {
    const r = build(ground);
    const top = r.counts.roofY + section.structures.tower.cap + 0.5;
    let seen = 0;
    let lowest = Infinity;
    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    for (const c of r.group.children) {
      if (!c.isInstancedMesh) continue;
      for (let i = 0; i < c.count; i++) {
        c.getMatrixAt(i, m);
        pos.setFromMatrixPosition(m);
        lowest = Math.min(lowest, pos.y);
        assert.ok(pos.y < top, `${label}: a facade instance floats at y=${pos.y.toFixed(2)}, over the tower cap`);
        seen++;
      }
    }
    assert.ok(seen > 500, `${label}: only ${seen} facade instances sampled`);
    /* Nothing may sit below the lowest ground under the whole building — the
       skirt reaches down to meet grade, it does not fall through the world. */
    const floor = Math.min(...RING.map(([x, z]) => ground(x, z))) - section.draw.skirtDrop - 1;
    assert.ok(lowest > floor, `${label}: something sits at y=${lowest.toFixed(2)}, below ${floor.toFixed(2)}`);
  }
});

test("no dressed layer crosses a surveyed facade into the mass", () => {
  /* Data-level the facades sit ON the ring; this checks the BUILT geometry:
     every instance the facade systems place must be outside the drawn ring,
     or the membrane is inside the wall it dresses (the 2026-08-17 audit's
     west frontage, a metre in). Ring vertices are excluded from the test by
     using a small inward tolerance, since a face laid on the ring touches it. */
  const r = build(drawnGround);
  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  let checked = 0;
  for (const c of r.group.children) {
    if (!c.isInstancedMesh || c.name === "york-ground") continue;
    for (let i = 0; i < c.count; i++) {
      c.getMatrixAt(i, m);
      pos.setFromMatrixPosition(m);
      /* Long runs (copings, bands, fascia) are centred on their face and are
         legitimately over the ring line; only point-like layers are placed
         proud, so only those are meaningful here. */
      const sc = new THREE.Vector3().setFromMatrixScale(m);
      if (Math.max(sc.x, sc.z) > 5) continue;
      if (!inRing(pos.x, pos.z, RING)) { checked++; continue; }
      assert.ok(toRingEdge(pos.x, pos.z, RING) < 0.35,
        `a dressed instance stands ${toRingEdge(pos.x, pos.z, RING).toFixed(2)} m INSIDE the drawn ring at (${pos.x.toFixed(1)}, ${pos.z.toFixed(1)})`);
      checked++;
    }
  }
  assert.ok(checked > 500, `only ${checked} dressed instances checked`);
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
  assert.ok(glass >= 1, "the lecture doors do not carry the library's reflective glass");
  assert.match(moduleSrc, /painted\(colors\.windowGlass\), bins\.windows/,
    "window slots must be opaque dark metal, not transparent glass");
  assert.match(moduleSrc, /(?:shared|create)MaterialLibrary/, "surfaces come from campus-materials.js");
  assert.match(moduleSrc, /get\("brick"/, "the CMU rides a coursed block class, not flat colour");
});

test("the module is a one-way reader, deterministic, and carries no data of its own", () => {
  const stripped = moduleSrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.equal(stripped.match(/Math\.random/), null, "the module uses Math.random");
  assert.equal(stripped.match(/\bnew Date\b|Date\.now|performance\.now/), null, "the module reads a clock");
  assert.equal(stripped.match(/new THREE\.TextureLoader|\.load\(/), null,
    "textures are code-generated here, never loaded from a photograph");
  assert.equal(stripped.match(/section\.\w+\s*=[^=]/), null, "the module writes back into the section");
  assert.equal(stripped.match(/#[0-9a-fA-F]{6}\b/g), null, "the module carries a colour literal — colours are the section's");
  /* It may read only its own key of the photo document. */
  assert.deepEqual([...new Set([...moduleSrc.matchAll(/photo\?\.(\w+)/g)].map((m) => m[1]))], ["york"]);
  /* Determinism has ONE source and it is seeded from the section. */
  assert.match(stripped, /hash\(seed,/, "the jitter must be seeded from the section's own seed");
  /* THE BARE-DIMENSION GATE. Every metre of GEOMETRY in the module comes from
     the section. Two regions are excluded and both are excluded for a stated
     reason, not for convenience:
       - the material helpers, whose numbers are PBR parameters (metalness,
         roughness, normal scale) fed to campus-materials.js. They are not
         dimensions, they describe no part of York, and putting them in the
         section would make `draw` a place to hide metres;
       - `hash`, whose four constants are the fixed multipliers of the
         repo-wide deterministic hash and are the same in every photo module.
     Everything after them is geometry, and the only literals it may carry are
     0, 1, 2 and a half — array indices, midpoints and unit maths — plus the
     180 a degrees-to-radians conversion needs. */
  const geometry = stripped.slice(stripped.indexOf("function instanced"));
  assert.ok(geometry.length > 0.6 * stripped.length,
    "the excluded material/hash prologue has grown — it is not a place to keep dimensions");
  const allowed = new Set(["0", "1", "2", "0.5", "180"]);
  const bad = [];
  for (const [, n] of geometry.matchAll(/(?<![\w.$])(\d+\.\d+|\d+)(?![\w.])/g)) {
    if (allowed.has(n)) continue;
    bad.push(n);
  }
  assert.deepEqual(bad, [],
    `the module carries bare numbers ${JSON.stringify(bad)} — geometry is data, and every metre belongs in derivations/estimates/reads/draw`);
  /* The prologue really is only material parameters: no metre-scale constant
     may hide there either, so nothing in it may be read as a length. */
  const prologue = stripped.slice(0, stripped.indexOf("function instanced"));
  assert.equal(prologue.match(/\bnew THREE\.\w+Geometry/), null,
    "geometry is being built in the material prologue, where the dimension gate does not look");
  /* And the draw block it reads is declared as render offsets, not claims. */
  assert.match(section.draw.why, /not a claim|not claims|Render offsets/i,
    "the draw block must declare that it is offsets and not dimensions");
});
