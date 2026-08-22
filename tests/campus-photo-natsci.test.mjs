/* Natural Sciences Building — INVENTED class, R5 batch, a NEW section.
 *
 * WHAT THIS SUITE EXISTS TO HOLD. The section makes five claims a later edit
 * could quietly undo, and each has a gate written against the CLAIM rather
 * than against the geometry that happens to result:
 *
 *   - IT IS A 2003 BCJ LABORATORY BUILDING, NOT A 1960s REVELLE ONE, and the
 *     three live names (GIS plural, OSM singular, BCJ) are all carried with
 *     the OSM singular protected, because campus-lidar and campus-colleges
 *     read it.
 *
 *   - THE STOREY RECONCILIATION CLOSES. Six floors at 4.4167 m, and the 4.70 m
 *     between the GIS formula height and massHeights decomposes to 0.00 with
 *     no seventh storey. This suite recomputes §4 and §0.2 from the READINGS
 *     alone — not from the section's own figures — and requires the answers.
 *
 *   - THE PARTITION IS THE SURVEY. Every roof plane's plan is the verbatim
 *     ring clipped by declared boxes, the boxes tile the plane, and the
 *     pieces' shoelace areas sum to the ring's own to 1e-6, recomputed here by
 *     an INDEPENDENT clipper. A facade may hang only on an edge that lies on
 *     the survey polyline; the partition's interior cuts must be refused.
 *
 *   - THE BUILDER LAYS NO FIXED BAY PITCH. Each face takes its wing's column
 *     grid, which is that wing's surveyed span over a whole number of 24 ft
 *     nominal bays, and the cross grid must reproduce the photographed pier
 *     count exactly.
 *
 *   - THE WITHHOLDINGS ARE REAL IN THE SCENE. No mullion grid, no forecourt
 *     carpet or trees, no yard contents, no lettering, no site utility, no
 *     basement, no corner blocks, and the mechanical tops at 30.03 with the
 *     32.52 spike recorded and unmodelled. Gates walk the mesh names and the
 *     built maxima.
 *
 * STAGING FALLBACK — main removes at merge. The section under test is the R5
 * merge candidate if it is on disk, and the shipped doc key once main has
 * merged it. Everything below runs identically on either.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as THREE from "../docs/vendor/three/three.module.min.js";
import {
  assertCoverage, assertEstimateBands, assertPins, assertRelations,
  assertTierSymmetry, assertAbsentEntries, assertExprs, assertDispositions,
} from "./helpers/axiom-gate.mjs";
import { createPhotoNatsci } from "../docs/js/campus-photo-natsci.js";
import { makeSurfaceSampler } from "../docs/js/campus-terrain.js";
import { overlayLift } from "../docs/js/campus-overlay.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));

/* The R5 merge candidate is the section under test while it is on disk;
   the shipped doc key once main has copied it. PHOTO_DETAIL still wins. */
const MERGE = "Revelle-College-Sources/merge/r5/natsci.json";
const section = process.env.PHOTO_DETAIL
  ? (read(process.env.PHOTO_DETAIL).natsci ?? read(process.env.PHOTO_DETAIL))
  : existsSync(join(root, MERGE))
    ? read(MERGE)
    : read("docs/data/campus-photo-detail.json").natsci;

if (!section) {
  test("natsci section does not exist yet (new R5 key; merge file absent) — suite skipped", { skip: true }, () => {});
} else {

const campus = read("docs/data/campus-3d.json");
const lidar = read("docs/data/campus-lidar.json");
const arcgis = read("docs/data/campus-arcgis.json");
const shippedDoc = read("docs/data/campus-photo-detail.json");

const moduleSrc = readFileSync(join(root, "docs/js/campus-photo-natsci.js"), "utf8");
/* Gates that grep for forbidden constructs run on the CODE, not the prose. */
const moduleCode = moduleSrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/[^\n]*$/gm, "");

const R = section.derivations.readings;
const FIG = section.derivations.figures;
const SY = section.system;
const D = section.draw;
const fig = (k) => FIG[k].value;

const near = (a, b, eps, what) =>
  assert.ok(typeof a === "number" && Math.abs(a - b) <= eps, `${what}: ${a} vs ${b} (tolerance ${eps})`);

const flat = () => 20;
const slope = (x, z) => 20 + 1.4 * Math.sin(x / 11) + 1.1 * Math.cos(z / 13);
/* A 6 m shoulder crossing the north face — the burial gate's own instrument.
   Nothing on campus looks like this and that is the point. */
const bump = (x, z) => 20 + (Math.abs(z - 285.2) < 3 && x > -150 && x < -120 ? 6 : 0);
const drawnGround = makeSurfaceSampler(lidar.terrain);
const build = (g = flat) =>
  createPhotoNatsci(null, { photo: { natsci: section }, heightAt: g, surfaceAt: g });

const shoelace = (r) => {
  let a = 0;
  for (let i = 0; i < r.length - 1; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1];
  return Math.abs(a / 2);
};
const inRing = (x, z, r) => {
  let ins = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, zi] = r[i];
    const [xj, zj] = r[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
};

/* An INDEPENDENT Sutherland-Hodgman with spike removal, so the partition gate
   does not trust the module's own clipper. */
function clipBox(ring, box) {
  const [[bx0, bz0], [bx1, bz1]] = box;
  let pts = ring.slice(0, -1);
  for (const side of [(p) => p[0] - bx0, (p) => bx1 - p[0], (p) => p[1] - bz0, (p) => bz1 - p[1]]) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const da = side(a);
      const db = side(b);
      if (da >= 0) out.push(a);
      if ((da >= 0) !== (db >= 0)) {
        const t = da / (da - db);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    pts = out;
    if (!pts.length) break;
  }
  let clean = [];
  for (const p of pts) {
    const last = clean[clean.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 1e-9) clean.push(p);
  }
  while (clean.length > 1 &&
    Math.hypot(clean[0][0] - clean[clean.length - 1][0], clean[0][1] - clean[clean.length - 1][1]) <= 1e-9) clean.pop();
  for (let changed = true; changed && clean.length >= 3;) {
    changed = false;
    for (let i = 0; i < clean.length; i++) {
      const a = clean[(i + clean.length - 1) % clean.length];
      const b = clean[i];
      const c = clean[(i + 1) % clean.length];
      const l1 = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const l2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
      if (!(l1 > 0) || !(l2 > 0)) { clean.splice(i, 1); changed = true; break; }
      const cross = ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) / (l1 * l2);
      const dot = ((b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1])) / (l1 * l2);
      if (Math.abs(cross) < 1e-4 && dot < 0) { clean.splice(i, 1); changed = true; break; }
    }
  }
  if (clean.length < 3) return null;
  clean.push([clean[0][0], clean[0][1]]);
  return shoelace(clean) < 1e-6 ? null : clean;
}

/** Distance from a point to the survey polyline. */
function toRing(x, z, ring) {
  let best = Infinity;
  for (let k = 0; k < ring.length - 1; k++) {
    const [ax, az] = ring[k];
    const [bx, bz] = ring[k + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const l2 = dx * dx + dz * dz;
    let t = l2 ? ((x - ax) * dx + (z - az) * dz) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
}

const RING = section.measured.natsci.ring;

/* ------------------------------------------------------ identity & record */

test("the section carries the whole ultra apparatus", () => {
  for (const k of ["label", "epoch", "note", "confidence", "seed", "bounds", "boundary", "sources",
    "measured", "derivations", "estimates", "reads", "draw", "system", "colors", "colorThreshold",
    "colorSources", "samples", "ground", "counts", "conflicts", "absent", "supersedes"]) {
    assert.ok(section[k] !== undefined, `section is missing ${k}`);
  }
  assert.equal(typeof section.seed, "number");
  assert.ok(section.confidence.length > 400, "the confidence statement must be per-claim, not a word");
});

test("it says what it is: BCJ 2003, NOT a 1960s Revelle building, and the name split is live", () => {
  assert.match(section.label, /Bohlin Cywinski Jackson/);
  assert.match(section.label, /2003/);
  assert.match(section.label, /NOT a 1960s Revelle building/i,
    "the misattribution this whole dossier exists to correct must be in the label");
  assert.match(section.label, /Natural Science Building/,
    "the OSM singular is a live key and must appear in the label, not be quietly dropped");
  assert.match(section.label, /Natural Sciences Laboratory Building/, "BCJ's own project name");
  /* The epoch ladder inverts here: newest is best, and there is NO dead epoch. */
  assert.match(section.epoch, /inverts?/i);
  assert.match(section.epoch, /2014/, "the LiDAR epoch must be declared VALID, not merely present");
  assert.match(section.epoch, /EMPTY/i, "the empty archive rung is a fact of this building's epoch");
  assert.match(section.note, /INVENTED/);
  /* The three shipped names must equal the three surveys' own keys. */
  assert.equal(section.measured.natsci.gisName, arcgis.massing[101].n);
  assert.equal(section.measured.natsci.osmName, campus.buildings[398].n);
  assert.ok(lidar.heights[section.measured.natsci.osmName] !== undefined,
    "the OSM singular must still be a live key in campus-lidar heights — if this fails somebody 'fixed' it");
});

test("every source is described and dated, and the verified negatives are all named", () => {
  assert.ok(section.sources.length >= 12, `only ${section.sources.length} sources`);
  for (const s of section.sources) {
    assert.ok(s.length >= 80, `source is not described: ${s.slice(0, 70)}`);
    assert.match(s, /\b(19|20)\d\d\b/, `source has no date: ${s.slice(0, 70)}`);
  }
  const all = section.sources.join("\n");
  for (const [what, re] of [
    ["the empty Calisphere rung", /VERIFIED EMPTY/],
    ["the missing Facilities record", /no UCSD Facilities Information System record/i],
    ["the ZERO_RESULTS inside the court", /ZERO_RESULTS/],
    ["the oceanlight enumeration", /21205-21240/],
  ]) {
    assert.match(all, re, `the source ladder does not record ${what} — a climbed-and-empty rung is a result`);
  }
});

test("every surveyed ring is the survey, byte for byte", () => {
  const gis = arcgis.massing[101].r[0].map(([x, z]) => [x / 10, z / 10]);
  assert.deepEqual(RING, gis, "the GIS ring is not arcgis.massing[101].r[0] at /10");
  assert.equal(RING.length, 85);
  assert.deepEqual(section.measured.osm.ring, campus.buildings[398].p,
    "the OSM ring is not campus-3d buildings[398].p");
  near(shoelace(RING), section.measured.natsci.areaM2, 1e-6, "the declared ring area is not the ring's");
  near(R.survey.ringArea, shoelace(RING), 1e-4, "the reading's ring area is not the ring's");
  /* And the survey values it quotes are the survey's. */
  assert.equal(R.survey.massHeight, lidar.massHeights["m:-156,308"]);
  assert.equal(R.survey.osmHeight, lidar.heights["Natural Science Building"]);
  assert.equal(R.survey.gisH, arcgis.massing[101].h);
  assert.equal(R.survey.gisLevels, arcgis.massing[101].levels);
  assert.equal(R.survey.lidarDatum, lidar.datum);
});

/* ----------------------------------------- the arithmetic, recomputed here */

test("§4: the storey reconciliation closes, recomputed from the readings alone", () => {
  /* Deliberately NOT read from FIG: every number below is rebuilt from the
     point cloud, the survey and BCJ, and must meet the section where it is. */
  const roof = R.ept.roofPlane;
  const slab = section.estimates["roof.slab"].value;
  const levels = R.published.levelsAboveGrade;
  const F = (roof - slab) / levels;
  near(F, 4.416667, 5e-6, "floor to floor");
  near(fig("storey.floorToFloor"), F, 5e-6, "the section's floor-to-floor is not the arithmetic's");
  near(fig("storey.soffit"), roof - slab, 5e-6, "the soffit is not the roof less the slab");
  for (let i = 1; i <= 6; i++) near(fig(`storey.f${i}`), (i - 1) * F, 5e-6, `floor ${i}`);
  /* 14 ft 6 in, from three inputs none of which knows about feet. */
  near(F / R.units.foot, 14.490377, 5e-6, "floor to floor in feet");
  assert.ok(Math.abs(F - (14 * R.units.foot + 6 * R.units.inch)) < 0.005,
    "the derived floor-to-floor is not within 5 mm of the canonical 14 ft 6 in");

  /* THE CLOSING CHECK: the 1.50 m the GIS formula is short of the measured
     roof, decomposed into six short floors plus a roof slab — and the slab it
     recovers must be the slab the section estimated, WITHOUT being told it. */
  const gap = roof - R.survey.gisH;
  near(gap, 1.5, 1e-9, "roof over the GIS formula height");
  const formulaGap = levels * (F - R.survey.gisFormulaModule);
  near(formulaGap, 0.898002, 5e-6, "the formula shortfall over six floors");
  near(gap - formulaGap, slab, 0.005,
    "§4 does not close: the gap left after the formula shortfall is not the roof slab");
  near(fig("check.slabRemainder"), gap - formulaGap, 5e-6, "check.slabRemainder");
  near(R.survey.gisLevels * R.survey.gisFormulaModule, R.survey.gisH, 0.005,
    "the GIS h is not 6 x 4.267 — the loser this section records is not the loser it has");
});

test("§0.2: the 4.70 m decomposes EXACTLY, and there is no seventh storey", () => {
  const s1 = R.ept.roofPlane - R.survey.gisH;
  const s2 = R.ept.mechBlocks - R.ept.roofPlane;
  const s3 = R.survey.massHeight - R.ept.mechBlocks;
  const total = R.survey.massHeight - R.survey.gisH;
  near(s1, 1.5, 1e-9, "step 1");
  near(s2, 2.93, 1e-9, "step 2");
  near(s3, 0.27, 1e-9, "step 3");
  near(total, 4.7, 1e-9, "the whole gap");
  near(total - (s1 + s2 + s3), 0, 1e-9, "the decomposition leaves a residual");
  near(fig("check.decompCloses"), 0, 1e-9, "the section's own closure figure is not zero");
  /* A seventh storey would be one floorToFloor; the excess is NOT one. */
  const F = fig("storey.floorToFloor");
  assert.ok(Math.abs(total - F) > 0.25,
    "the 4.70 m is within a quarter metre of one storey — the no-seventh-storey claim needs a stronger statement than this suite can make");
  assert.equal(R.published.levelsAboveGrade, R.survey.gisLevels,
    "BCJ's floor count and the GIS levels must agree — that agreement is what makes the seventh storey impossible");
});

test("§3.2: the published area closes to under three percent", () => {
  const sqm = R.survey.ringArea * R.published.levelsAboveGrade;
  const sf = sqm * R.units.sqftPerSqm + R.published.vivariumSf + R.published.nmrSf;
  const pct = (100 * (sf - R.published.sizeSf)) / R.published.sizeSf;
  near(fig("area.withBasementSf"), sf, 1e-3, "the with-basement area");
  near(fig("check.areaAgreementPct"), pct, 1e-4, "the agreement percentage");
  assert.ok(Math.abs(pct) < 3,
    `the survey ring, the storey count and BCJ's published SF disagree by ${pct.toFixed(2)}% — over the 3% the section claims`);
});

test("§5.7: the bay module is a rule, not a pitch, and the cross grid reproduces the pier count", () => {
  const nominal = 24 * R.units.foot;
  near(fig("bay.nominal"), nominal, 1e-9, "the nominal bay is not 24 ft");
  near(fig("bay.fromSouth"), R.plan.bayPx / (R.plan.southFitPx / R.plan.southSurvey), 5e-6, "south fit");
  near(fig("bay.fromNorth"), R.plan.bayPx / (R.plan.northFitPx / R.plan.northSurvey), 5e-6, "north fit");
  near(fig("bay.fromPiers"), R.plan.eastFaceSurvey / (R.plan.pierCountEast - 1), 5e-6, "pier count");
  const grid = (span) => {
    const bays = Math.round(span / nominal);
    return { bays, pitch: span / bays };
  };
  for (const [key, span, wantBays, wantPitch] of [
    ["northLong", R.wing.northLength, 9, 7.066667],
    ["northCross", R.wing.northDepth, 4, 7.0],
    ["southLong", R.wing.southLength, 5, 7.02],
    ["southCross", R.wing.southWidth, 4, 6.475],
  ]) {
    const g = grid(span);
    assert.equal(g.bays, wantBays, `${key} bay count`);
    near(g.pitch, wantPitch, 5e-6, `${key} pitch`);
    assert.equal(SY.grids[key].bays, wantBays, `${key} ships the wrong bay count`);
    near(SY.grids[key].pitch, wantPitch, 5e-6, `${key} ships the wrong pitch`);
    near(SY.grids[key].span, span, 1e-9, `${key} ships a span its wing does not have`);
  }
  /* The rule and the photograph agree on the one face where both apply. */
  near(SY.grids.northCross.pitch, fig("bay.fromPiers"), 1e-9,
    "the derived cross pitch is not the photographed pier pitch — the check that ties the rule to a frame");
  /* The three bracket values, and the ONE that leaves the bracket, declared. */
  const lo = Math.min(fig("bay.fromPiers"), fig("bay.fromSouth"), fig("bay.fromNorth"));
  const hi = Math.max(fig("bay.fromPiers"), fig("bay.fromSouth"), fig("bay.fromNorth"));
  assert.ok(nominal > lo && nominal < hi, "the nominal bay must sit inside all three derivations");
  const out = Object.entries(SY.grids)
    .filter(([k, g]) => g.pitch !== undefined && (g.pitch < lo - 1e-9 || g.pitch > hi + 1e-9))
    .map(([k]) => k);
  assert.deepEqual(out, ["southCross"],
    "exactly one grid may fall outside the bracket and it must be southCross, which conflicts['south-cross-bay'] declares");
  assert.ok(section.conflicts.some((c) => c.key === "south-cross-bay"),
    "the out-of-bracket pitch must be declared as a conflict, not adjusted");
  /* And nothing in the builder lays a fixed pitch. */
  assert.equal(moduleCode.match(/7\.3\d/), null, "a bay pitch literal leaked into the builder");
});

test("§6: the ortho model reproduces both ends inside its own declared residual", () => {
  const at = (z) => R.ortho.modelIntercept + R.ortho.modelSlope * (z - R.ortho.modelZ0);
  const dzS = R.ortho.edgeSouthOrtho - R.ortho.edgeSouthRing;
  const dzNA = R.ortho.edgeNorthOrthoA - R.ortho.edgeNorthRingA;
  const dzNB = R.ortho.edgeNorthOrthoB - R.ortho.edgeNorthRingB;
  near(fig("ortho.dzSouth"), dzS, 1e-9, "south fit");
  near(fig("ortho.dzNorthA"), dzNA, 1e-9, "north fit A");
  assert.ok(Math.abs(at(R.ortho.edgeSouthRing) - dzS) <= R.ortho.modelResidual, "the model misses the south edge");
  assert.ok(Math.abs(at(R.ortho.edgeNorthRingA) - dzNA) <= R.ortho.modelResidual, "the model misses the north edge");
  /* The two-point slope corroborates the published least-squares one. */
  const two = (dzS - dzNB) / (R.ortho.edgeSouthRing - R.ortho.edgeNorthRingB);
  near(fig("ortho.twoPointSlope"), two, 5e-6, "two-point slope");
  assert.ok(Math.abs(two - R.ortho.modelSlope) < 0.01,
    "the two-point slope and the published model disagree by more than 0.01 m/m");
  /* THE SIGN FLIPS, which is the whole reason a single offset is banned. */
  assert.ok(dzNA < 0 && dzS > 0, "the z residual must change sign across the building — that is the finding");
  assert.ok(section.conflicts.some((c) => c.key === "ortho-z-registration"));
});

test("the re-measure reproduces the shipped LiDAR builder on BOTH rings", () => {
  near(fig("check.reproducesMassHeights"), Math.abs(R.ept.gisRingP98 - R.survey.massHeight), 1e-9, "gis");
  near(fig("check.reproducesOsmHeights"), Math.abs(R.ept.osmRingP98 - R.survey.osmHeight), 1e-9, "osm");
  assert.ok(Math.abs(R.ept.gisRingP98 - R.survey.massHeight) <= 0.05 + 1e-9,
    "the re-measure does not reproduce massHeights — the rim base or the box is wrong");
  assert.ok(Math.abs(R.ept.osmRingP98 - R.survey.osmHeight) <= 0.05 + 1e-9,
    "the re-measure does not reproduce heights['Natural Science Building']");
  near(fig("rim.local"), R.ept.rimBaseAbs - R.survey.lidarDatum, 1e-9, "the rim base in renderer y");
});

/* --------------------------------------------------- the axiom-layer gates */

function exprScope() {
  const scope = {};
  for (const [k, v] of Object.entries(R)) scope[k] = v && typeof v === "object" ? { ...v } : v;
  /* Estimates are in scope too: roof.slab is an ESTIMATE that storey.floorToFloor
     derives from, and an expr that could not name it would have to hide it. */
  const put = (key, value) => {
    const parts = key.split(".");
    let o = scope;
    for (let i = 0; i < parts.length - 1; i++) o = (o[parts[i]] ??= {});
    o[parts[parts.length - 1]] = value;
  };
  for (const [key, e] of Object.entries(section.estimates)) {
    if (key === "why" || typeof e !== "object") continue;
    put(key, e.value);
  }
  for (const [key, f] of Object.entries(FIG)) put(key, f.value);
  return scope;
}

test("S1(vi): every expr is arithmetic, is EVALUATED, and reproduces its own value", () => {
  assert.match(section.derivations.why, /keeling\.roofs\.pv/i, "the block must name the bar it is held to");
  for (const [key, f] of Object.entries(FIG)) {
    assert.ok(typeof f.value === "number", `${key} has no value`);
    assert.ok(f.why && f.why.length > 40, `${key} is unmotivated`);
  }
  const { evaluated, prose } = assertExprs({ figures: FIG, scope: exprScope(), label: "natsci" });
  assert.ok(evaluated >= 55, `only ${evaluated} figures evaluated`);
  assert.equal(prose, 0, `${prose} figures fell back to prose — every figure here is arithmetic`);
});

test("S1(ii): every estimate carries a machine-readable band and ships inside it", () => {
  const valueAt = (key) => {
    /* Where the shipped value lives is per-key; each is named here so a
       renamed consumer cannot orphan its own band. */
    const map = {
      "roof.slab": SY.roof.slab,
      "roof.overhang": SY.roof.overhang,
      "system.louvre.depth": SY.louvre.depth,
      "system.louvre.blade": SY.louvre.blade,
      "system.louvre.standoff": SY.louvre.standoff,
      "system.pier.proud": SY.pier.proud,
      "system.pier.width": SY.pier.width,
      "system.mast.section": SY.mast.section,
      "system.mast.rise": SY.mast.rise,
      "system.plinth.storeysWest": SY.faceRules.systems.west.plinthStoreys,
      "ground.dgWidth": section.ground.west.dgWidth,
      "ground.mowStripWidth": section.ground.west.mowStripWidth,
      "ground.colonnadeStandoff": section.ground.west.colonnadeStandoff,
      "ground.colonnadeSize": section.ground.west.colonnadeSize,
      "ground.serviceYard.depth": section.ground.serviceYard.depth,
      "ground.serviceYard.wallThickness": section.ground.serviceYard.wallThickness,
      "ground.steps.rise": section.ground.east.stepRise,
      "ground.steps.tread": section.ground.east.stepTread,
      "system.canopy.projection": SY.canopy.projection,
      "system.canopy.thickness": SY.canopy.thickness,
      "system.stair.width": SY.stair.width,
      "lobe.plane": SY.planes.low.h,
    };
    assert.ok(map[key] !== undefined, `estimate ${key} names no shipped consumer in this suite`);
    return map[key];
  };
  const n = assertEstimateBands({ estimates: section.estimates, valueAt, label: "natsci" });
  assert.ok(n >= 20, `only ${n} estimates banded`);
  for (const [key, e] of Object.entries(section.estimates)) {
    if (key === "why") continue;
    assert.ok(e.bandWhy && e.bandWhy.length > 50, `estimate ${key} does not state what its band excludes`);
  }
  /* The lobe's band is the building's own three measured plateaus and may not
     reach outside them — the one place an estimate is bounded by measurement. */
  assert.deepEqual(section.estimates["lobe.plane"].band, [R.ept.lobeLow, R.ept.lobeTower],
    "the west lobe's band must be its own measured plateaus, nothing wider");
});

test("S1(iii): every reading with an external truth is pinned to that truth", () => {
  const pin = (value, truth, tol) => ({ value, truth, tol: tol ?? 5e-6 });
  const EPT = "the 2014 USGS 3DEP EPT re-measure, research-natsci.md §2's pasted output";
  const CELLS = "research-natsci.md §2.1's connected-component cell-centre extents";
  const pins = {
    "units.foot": pin(0.3048, "the international foot, exact by definition"),
    "units.inch": pin(0.0254, "the international inch, exact by definition"),
    "units.sqftPerSqm": pin(10.7639104, "1 m^2 in square feet, exact by definition"),

    "ept.rimBaseAbs": pin(124.99, `${EPT}: 'rim base 124.99 (1533 pts)'`),
    "ept.rimBasePts": pin(1533, `${EPT}: the ground-return count behind the rim base`),
    "ept.roofPlane": pin(27.10, `${EPT}: '24-27.5 n=669 p50=27.10'`),
    "ept.roofCells": pin(669, `${EPT}: the main plane's cell count`),
    "ept.roofP25": pin(27.03, `${EPT}: the main plane's p25`),
    "ept.roofP75": pin(27.14, `${EPT}: the main plane's p75`),
    "ept.roofMax": pin(27.38, `${EPT}: the main plane's max`),
    "ept.roofSpread": pin(0.02, `${EPT}: 'spread p50=0.02', the tightest read in this batch`),
    "ept.mechSpineN": pin(29.35, `${EPT}: '27.5-29.5 n=74 p50=29.35'`),
    "ept.mechSpineNCells": pin(34, `${CELLS}: the north spine's 34-cell component`),
    "ept.mechSpineS": pin(29.37, `${CELLS}: the south spine's 29-cell component`),
    "ept.mechSpineSCells": pin(29, `${CELLS}: the south spine's cell count`),
    "ept.mechBlocks": pin(30.03, `${EPT}: '29.5-32 n=54 p50=30.03'`),
    "ept.mechBlockCells": pin(54, `${EPT}: the upper blocks' cell count`),
    "ept.mechBlockP25": pin(29.95, `${EPT}: the upper blocks' p25`),
    "ept.mechBlockP75": pin(30.19, `${EPT}: the upper blocks' p75`),
    "ept.mechBlockMax": pin(30.37, `${EPT}: the upper blocks' max`),
    "ept.spikeMax": pin(32.52, `${EPT}: 'GIS ring returns 16641 ... max 32.52' — recorded, unmodelled`),
    "ept.lobeLow": pin(4.60, `${EPT}: '3-6 n=23 p50=4.66' resolved to the 14-cell 4.60 component`),
    "ept.lobeLowCells": pin(14, `${CELLS}: the 4.60 m component`),
    "ept.lobeStep": pin(5.82, `${CELLS}: the 5.82 m step's 6-cell component`),
    "ept.lobeStepCells": pin(6, `${CELLS}: the 5.82 m component`),
    "ept.lobeTower": pin(7.13, `${CELLS}: the 7.13 m tower's 5 tight cells`),
    "ept.lobeTowerCells": pin(5, `${CELLS}: the 7.13 m component's tight cells`),
    "ept.gisRingP98": pin(30.26, `${EPT}: 'GIS ring returns 16641: ... p98 30.26'`),
    "ept.osmRingP98": pin(30.25, `${EPT}: 'OSM ring returns 16550: ... p98 30.25'`),
    "ept.groundMedianN": pin(124.85, `${EPT}: 'ground medians N(z<300) 124.85'`),
    "ept.groundMedianS": pin(124.99, `${EPT}: 'S(z>320) 124.99'`),
    "ept.groundMedianE": pin(125.05, `${EPT}: 'E(x>-120) 125.05'`),
    "ept.groundMedianW": pin(124.70, `${EPT}: 'W(x<-170) 124.70'`),
    "ept.neOvershootRead": pin(0.10, "research-natsci.md §3: the three cells at the inner south-east corner reading ground"),
    "ept.cellSize": pin(1.5, `${EPT}: the 1.5 m cell the p90 is taken per`),
    "ept.cellMinReturns": pin(3, `${EPT}: 'cells with >=3 returns'`),

    "survey.lidarDatum": pin(102.4, "docs/data/campus-lidar.json datum"),
    "survey.massHeight": pin(30.3, "docs/data/campus-lidar.json massHeights['m:-156,308']"),
    "survey.osmHeight": pin(30.2, "docs/data/campus-lidar.json heights['Natural Science Building']"),
    "survey.gisH": pin(25.6, "docs/data/campus-arcgis.json massing[101].h"),
    "survey.gisLevels": pin(6, "docs/data/campus-arcgis.json massing[101].levels"),
    "survey.gisFormulaModule": pin(4.267, "the campus-wide GIS module formula, revelle-recon.md §0.1"),
    "survey.ringVerts": pin(85, "arcgis.massing[101].r[0].length"),
    "survey.ringArea": pin(2675.5, "the shoelace area of arcgis.massing[101].r[0] at /10", 0.01),
    "survey.osmVerts": pin(28, "campus-3d.json buildings[398].p.length"),
    "survey.osmArea": pin(2683.515, "the shoelace area of campus-3d.json buildings[398].p", 0.01),
    "survey.massingIndex": pin(101, "the literal arcgis.massing index, never renumbered"),
    "survey.osmIndex": pin(398, "the literal campus-3d buildings index"),

    "published.completed": pin(2003, "BCJ's own project page and Architizer's 'Year 2003'"),
    "published.sizeSf": pin(180000, "BCJ's own project page for the Natural Sciences Laboratory Building: '180,000 SF'"),
    "published.vivariumSf": pin(7000, "BCJ's own project page: the basement vivarium, 7,000 sf, below grade and modelled by nothing"),
    "published.nmrSf": pin(5000, "BCJ's own project page: the basement NMR suite, 5,000 sf with two 900 MHz magnets"),
    "published.levelsAboveGrade": pin(6, "BCJ's floor description, corroborated by GIS levels and a band count"),
    "published.nmrMagnetMHz": pin(900, "BCJ's own project page: two 900 MHz magnets in the basement NMR suite, the programme fact behind the roofscape"),

    "plan.bayPx": pin(149, "architizer-bcj-natsci-07: the uniform longitudinal bay in plan pixels"),
    "plan.columnLines": pin(8, "architizer-bcj-natsci-07: eight column lines across the north wing's main block"),
    "plan.southFitPx": pin(536, "architizer-bcj-natsci-07: the south wing's wall pair, plan x 554 -> 1090"),
    "plan.southSurvey": pin(25.9, "the surveyed south wing width the south fit is scaled against"),
    "plan.northFitPx": pin(535, "architizer-bcj-natsci-07: the north wing's wall pair, plan y 154 -> 689"),
    "plan.northSurvey": pin(27.2, "the surveyed north wing depth the north fit is scaled against"),
    "plan.pierCountEast": pin(5, "architizer-bcj-natsci-06: five piers counted on the east end face"),
    "plan.eastFaceSurvey": pin(28.0, "the surveyed east end face length those five piers span"),

    "wing.northLength": pin(63.6, "research-natsci.md §3.1: the north wing, x -166.2..-102.6"),
    "wing.northDepth": pin(28.0, "research-natsci.md §3.1: the north wing, z 283.3..311.3"),
    "wing.southLength": pin(35.1, "research-natsci.md §3.1: the south wing, z 311.3..346.4"),
    "wing.southWidth": pin(25.9, "research-natsci.md §3.1: the south wing, x -166.2..-140.3"),
    "wing.splitZ": pin(311.3, "the surveyed inner corner of the L, where the north wing ends"),
    "wing.originX": pin(-166.2, "the wings' west structural datum, research-natsci.md §3.1"),
    "wing.originZNorth": pin(283.3, "the north wing's own north structural datum"),
    "wing.originZSouth": pin(311.3, "the south wing's own north structural datum, the inner corner"),

    "ortho.pxPerM": pin(8, "docs/data/textures/chunk_4_6.jpg at zoom 20 per the manifest"),
    "ortho.edgeNorthRingA": pin(283.35, "research-natsci.md §6: the ring value at the north wall, x -111..-103"),
    "ortho.edgeNorthOrthoA": pin(277.85, "research-natsci.md §6: the ortho edge fit there"),
    "ortho.edgeNorthRingB": pin(285.2, "research-natsci.md §6: the ring value at the wall's western step"),
    "ortho.edgeNorthOrthoB": pin(279.8, "research-natsci.md §6: the ortho edge fit there"),
    "ortho.edgeSouthRing": pin(346.4, "research-natsci.md §6: the ring value at the south wall"),
    "ortho.edgeSouthOrtho": pin(347.4, "research-natsci.md §6: the ortho edge fit there"),
    "ortho.dxEast": pin(-0.3, "research-natsci.md §6: the east wall's x fit"),
    "ortho.dxWestSouth": pin(-0.5, "research-natsci.md §6: the south wing west wall's x fit"),
    "ortho.dxInnerEast": pin(0.65, "research-natsci.md §6: the inner east wall's x fit"),
    "ortho.modelIntercept": pin(-5.4, "research-natsci.md §6's published model, dz = -5.4 + 0.102(z - 283)"),
    "ortho.modelZ0": pin(283, "the same model's z origin"),
    "ortho.modelSlope": pin(0.102, "the same model's slope"),
    "ortho.modelResidual": pin(1.3, "the same model's declared residual, +/- 1.3 m"),
    "ortho.dxBand": pin(1.5, "research-natsci.md §0.3: x reads are good to +/- 1.5 m with no trend"),

    "facade.bladesPerStorey": pin(5, "architizer-bcj-natsci-06 and -10: roughly 5-6 blades per storey; 5 ships"),
    "facade.plinthStoreysNorth": pin(2, "gsv_2025-02_north-face_*: a TWO-storey terracotta rainscreen"),
    "facade.stepsEast": pin(4, "gsv_2020-03 and oceanlight-21226: four to five shallow steps; 4 ships"),
    "facade.glazedSlotStoreys": pin(6, "gsv_2025-02_west-face_*: a six-storey glazed slot at the NW corner"),
    "facade.cmuWallHeight": pin(3.0, "gsv_2025-02_south-face_*: a grey CMU screen wall roughly 3 m high"),

    "roofObjects.blowerNCount": pin(5, "ortho2026-natsci-eastarm-roof-10x.png: five blowers on the north bank"),
    "roofObjects.blowerNx0": pin(-133.1, "the same frame: the westmost blower's x centre"),
    "roofObjects.blowerNx1": pin(-120.1, "the same frame: the eastmost blower's x centre"),
    "roofObjects.blowerSize": pin(2.5, "the same frame: about 2.5 m per scroll casing"),
    "roofObjects.blowerSCount": pin(4, "ortho2026-natsci-northarm-roof-10x.png: '~4-5'; 4 ships"),
    "roofObjects.condenserX0": pin(-148.0, "research-natsci.md §2.2: the condenser box, true x -148..-144.4"),
    "roofObjects.condenserX1": pin(-144.4, "the same read's east limit"),
    "roofObjects.condenserW": pin(3.6, "the same read: about 3.6 x 3.1 m"),
    "roofObjects.condenserD": pin(3.1, "the same read's depth"),
    "roofObjects.condenserFans": pin(4, "the same read: 2 x 2 round fans"),
    "roofObjects.ductX0": pin(-141.0, "research-natsci.md §2.2: the duct run, true x -141..-106; the plate ends first"),
    "roofObjects.ductX1": pin(-109.0, "the §5.6 rect's own east limit at the declared local displacement"),
    "roofObjects.ductW": pin(3.0, "the §5.6 rect's z extent, which a z DIFFERENCE may carry where a z position may not"),
  };
  /* The cell block is pinned exhaustively — a new unpinned cell extent cannot
     be slipped into the block the mech and lobe plans are built from. */
  const cellPins = {
    spineNx0: -132.8, spineNx1: -111.8, spineNz0: 296.3, spineNz1: 299.3,
    spineSx0: -153.8, spineSx1: -150.8, spineSz0: 317.3, spineSz1: 336.8,
    blockAx0: -155.3, blockAx1: -150.8, blockAz0: 296.3, blockAz1: 305.3,
    blockBx0: -155.3, blockBx1: -150.8, blockBz0: 338.3, blockBz1: 344.3,
    blockCx0: -156.8, blockCx1: -155.3, blockCz0: 279.8, blockCz1: 288.8,
    blockDx0: -110.3, blockDx1: -107.3, blockDz0: 296.3, blockDz1: 299.3,
    lobeLowx0: -173.3, lobeLowx1: -164.3, lobeLowz0: 299.3, lobeLowz1: 303.8,
    lobeStepx0: -176.3, lobeStepx1: -174.8, lobeStepz0: 300.8, lobeStepz1: 308.3,
    lobeTowerx0: -171.8, lobeTowerx1: -167.3, lobeTowerz0: 302.3, lobeTowerz1: 306.8,
  };
  for (const [k, v] of Object.entries(cellPins)) {
    pins[`cells.${k}`] = pin(v, `${CELLS}: the cell-centre extent this plan is grown from`);
  }
  const n = assertPins({
    readings: R,
    pins,
    namespaces: ["ept", "survey", "published", "plan", "wing", "ortho", "facade", "roofObjects", "cells", "units"],
    label: "natsci",
  });
  assert.ok(n >= 100, `only ${n} readings pinned`);
});

test("S1(i): no number anywhere in the axiom layer is uncovered", () => {
  const estimateKeys = new Set(Object.keys(section.estimates));
  const figureKeys = new Set(Object.keys(FIG));
  const readingValues = new Set();
  const walkNums = (o) => {
    if (typeof o === "number") { readingValues.add(o); return; }
    if (Array.isArray(o)) { o.forEach(walkNums); return; }
    if (o && typeof o === "object") Object.values(o).forEach(walkNums);
  };
  walkNums(R);
  const figValues = new Set(Object.values(FIG).map((f) => f.value));
  const estValues = new Set(Object.values(section.estimates).filter((e) => typeof e === "object").map((e) => e.value));
  const readValues = new Set(Object.values(section.reads).filter((r) => typeof r === "object").map((r) => r.value));

  /* A number in the drawn layer is covered when it IS a derived figure, a
     banded estimate, a cited read, a pinned reading, or a render offset whose
     own `<key>Note` says why it is not a dimension. */
  /* A render offset is covered when the section says, next to it, why it is
     not a dimension: its own `<key>Note`, its container's `note`, or the note
     that names the whole block it lives in (`draw.tilesNote` over
     `draw.tiles.*`). Nothing shorter than a real sentence counts. */
  const noteFor = (path) => {
    const parts = path.split(".");
    const chain = [section];
    for (const p of parts) {
      const parent = chain[chain.length - 1];
      chain.push(parent?.[Array.isArray(parent) ? Number(p) : p]);
    }
    const candidates = [];
    for (let i = parts.length; i >= 1; i--) {
      const holder = chain[i - 1];
      candidates.push(holder?.[`${parts[i - 1]}Note`]);
      if (i === parts.length) candidates.push(chain[i - 1]?.note);
    }
    candidates.push(chain[chain.length - 2]?.note);
    return candidates.find((c) => typeof c === "string" && c.length > 60) || null;
  };
  const classify = (path, value) => {
    if (figValues.has(value) && [...figValues].some((v) => Math.abs(v - value) < 1e-9)) return "figure";
    if (estValues.has(value)) return "estimate";
    if (readValues.has(value)) return "read";
    if (readingValues.has(value)) return "reading";
    if (noteFor(path)) return "declared render offset or sampling constant";
    /* A mech or lobe PLAN is its pinned cell-centre extent grown by half a
       cell, which is what a cell-centre extent means as a footprint. */
    const half = fig("grid.cellHalf");
    /* The partition's complement boxes and the grids' application boxes are
       the declared planeBounds and the derived lobe box, never free numbers. */
    /* Band edges are checked by S1(ii), which is the gate for them. */
    if (/^estimates\.[\w.]+\.band\.\d+$/.test(path)) return "estimate band edge";
    /* A read's `tolerance` is part of its citation — what the named frame or
       clause supports — and is gated by S1(iii)'s pins, not by this walk. */
    if (/^reads\.[\w.]+\.tolerance$/.test(path)) return "read tolerance";
    const PB = SY.planeBounds;
    if (/^system\.(planes\.\w+\.clip|grids\.\w+\.box)\./.test(path)) {
      const allowed = [PB.x0, PB.x1, PB.z0, PB.z1, PB.splitZ,
        fig("lobe.boxX0"), fig("lobe.boxX1"), fig("lobe.boxZ0"), fig("lobe.boxZ1")];
      if (allowed.some((v) => Math.abs(v - value) < 1e-9)) return "partition bound";
    }
    for (const v of Object.values(R.cells)) {
      if (typeof v !== "number") continue;
      if (Math.abs(value - (v + half)) < 1e-9 || Math.abs(value - (v - half)) < 1e-9) return "cell extent grown by half a cell";
    }
    return null;
  };
  const paths = assertCoverage({
    section,
    roots: {
      draw: {},
      system: { "system.planeBounds.note": true },
      "ground.west": {},
      "ground.east": {},
      "ground.serviceYard": {},
      estimates: {},
      reads: {},
    },
    classify,
    uncovered: {
      "system.canopy.columnSize": "The slim canopy columns' section. Bounded by system.canopy.thickness, which it may not exceed and does not; carried inside the canopy block with its own note rather than as a free estimate.",
      "system.stair.guardHeight": "42 in, the California Building Code guard height for an exterior stair. A CODE CLAUSE, not a read of this building — the steel-mesh guards themselves are sourced in research §5.0 and §5.4.",
      "system.mech.walkway.width": "36 in, a roof walkway pad's own product width. The markings' EXISTENCE and pale colour are the sourced part; their width is a product dimension.",
      "system.mech.walkway.inset": "How far inside the plate rim the marking band runs, read as 'bordering the membrane' and laid one band width plus a margin in. A layout constant, not a measurement of the building.",
      "system.mech.condenser.cz": "The condenser's z centre, 295.2: the §5.6 rect's own centre with THAT RECT'S declared local displacement (-1.0,-4.7) applied. It is a re-anchored ortho read and its residual is ortho.modelResidual; it cannot be a raw reading because §0.3 forbids raw z on this building.",
      "system.mech.duct.anchorZ": "310.3, the SURVEYED z of the north wing's inner south wall, off which the duct run is anchored. It is a ring coordinate rather than a reading, and the ring is carried verbatim in measured.natsci.ring.",
      "ground.west.colonnadeHeight": "4.2 m, just under the first floor line. Bounded above by storey.floorToFloor, which it may not exceed and does not; carried inside the west block with its own note.",
      "ground.serviceYard.dockHeight": "48 in, a truck-bed height. A PRODUCT DIMENSION, not a read: the dock's existence and its yellow-painted edge are the sourced part and the yellow is not rendered (absent A6).",
      "ground.serviceYard.dockDepth": "One truck-bay depth, 3.0 m. Same status as dockHeight, and bounded above by ground.serviceYard.depth, which it may not exceed and does not.",
      "ground.east.stepCount": "The sourced count of entrance steps, carried into the ground block as the builder's own consumer; it is pinned in reads['facade.stepsEast'] and in derivations.readings.facade.",
    },
    minimum: 90,
    label: "natsci",
  });
  assert.ok(paths.length >= 90, `the coverage walk found only ${paths.length} numbers`);
});

test("S1(iv): the tier gate runs BOTH ways over colours, samples and estimates", () => {
  const entries = Object.entries(section.colorSources)
    .filter(([key]) => key !== "why")
    .map(([key, v]) => ({ key: `colors.${key}`, text: v.source }));
  for (const [key, e] of Object.entries(section.estimates)) {
    if (key === "why") continue;
    entries.push({ key: `estimates.${key}`, text: e.why });
  }
  for (const [key, s] of Object.entries(SY.faceRules.systems)) {
    entries.push({ key: `faceRules.${key}`, text: `[${s.tier}] ${s.source}` });
  }
  const n = assertTierSymmetry({ entries, label: "natsci" });
  assert.ok(n >= 25, `the tier gate walked only ${n} entries`);
});

test("S1(v): every absent entry is held by a stable key and a probe", () => {
  const expected = {};
  const probes = {
    A1: /west lobe/i, A2: /ZERO_RESULTS/, A3: /32\.52/, A4: /rust-red/i, A5: /mullion/i,
    A6: /never sampled/i, A7: /service yard/i, A8: /forecourt/i, A9: /text mechanism/i,
    A10: /basement/i, A11: /circular/i, A12: /cut/i, A13: /blade/i, A14: /calibration/i,
    A15: /corner block/i, A16: /step return/i,
  };
  for (const entry of section.absent) {
    const m = /^(A\d+)/.exec(entry);
    assert.ok(m, `absent entry does not start with a stable key: ${entry.slice(0, 60)}`);
    expected[m[1]] = probes[m[1]] || /./;
    assert.ok(probes[m[1]], `absent key ${m[1]} has no probe in this suite`);
  }
  const keyed = section.absent.map((e) => /^(A\d+)/.exec(e)[1]);
  assert.equal(new Set(keyed).size, keyed.length, "two absent entries share a key");
  const n = assertAbsentEntries({
    absent: section.absent.map((e) => ({ key: /^(A\d+)/.exec(e)[1], text: e })),
    expected,
    label: "natsci",
  });
  assert.ok(n >= 16, `only ${n} absent entries`);
  /* Every entry must name a climbed ladder or a renderer limit, not just a gap. */
  for (const e of section.absent) {
    assert.ok(e.length > 200, `absent entry is a stub: ${e.slice(0, 70)}`);
    assert.ok(/ladder|rung|no source|NOT BUILT|NOTHING IS BUILT|BUILT BY NOTHING|not rendered|NOT MODELLED|renderer limitation|MODELLED BY NOTHING|no plan|derivable from nothing|not resolvable|VERIFIED EMPTY|no rung/i.test(e),
      `absent entry ${e.slice(0, 40)} does not say what was tried`);
  }
});

test("S2: both supersessions declare what happened and state their ground", () => {
  const n = assertDispositions({ items: section.supersedes.map((s) => ({ ...s, detail: s.detail })), label: "natsci" });
  assert.equal(n, 2);
  for (const s of section.supersedes) assert.equal(s.disposition, "deleted-on-evidence");
  assert.match(section.supersedes.map((s) => s.detail).join("\n"), /Bohlin Cywinski Jackson/);
});

test("S1: the readings' internal relations hold", () => {
  assertRelations({
    label: "natsci",
    relations: [
      { name: "the two rings' areas agree to under a percent",
        got: (100 * Math.abs(R.survey.ringArea - R.survey.osmArea)) / R.survey.ringArea, want: 0, tol: 1 },
      { name: "the ground medians span under half a metre across the whole site (which is why absent A12 cannot resolve the cut)",
        got: Math.max(R.ept.groundMedianN, R.ept.groundMedianS, R.ept.groundMedianE, R.ept.groundMedianW)
          - Math.min(R.ept.groundMedianN, R.ept.groundMedianS, R.ept.groundMedianE, R.ept.groundMedianW),
        want: 0.35, tol: 0.01 },
      { name: "the main roof plane sits inside its own quartiles",
        got: R.ept.roofPlane, want: (R.ept.roofP25 + R.ept.roofP75) / 2, tol: 0.06 },
      { name: "the upper mech plane sits inside its own quartiles",
        got: R.ept.mechBlocks, want: (R.ept.mechBlockP25 + R.ept.mechBlockP75) / 2, tol: 0.08 },
      { name: "the two penthouse plateaus are one plane to inside their own spread",
        got: Math.abs(R.ept.mechSpineS - R.ept.mechSpineN), want: 0, tol: 0.03 },
      { name: "the rim base is above the datum by the declared local rim",
        got: R.ept.rimBaseAbs - R.survey.lidarDatum, want: fig("rim.local"), tol: 1e-9 },
      { name: "the blower bank's span is its pitch over its own gaps",
        got: R.roofObjects.blowerNx1 - R.roofObjects.blowerNx0,
        want: (R.roofObjects.blowerNCount - 1) * fig("roofObjects.blowerNPitch"), tol: 5e-6 },
    ],
  });
});

/* ------------------------------------------------------------- colours */

test("colours are data, hex, tiered, and every stated hex is the shipped hex", () => {
  const entries = Object.entries(section.colors);
  assert.ok(entries.length >= 20, `only ${entries.length} colours`);
  for (const [k, v] of entries) {
    assert.match(v, /^#[0-9a-f]{6}$/, `${k} is not a lowercase 6-digit hex`);
    const src = section.colorSources[k];
    assert.ok(src, `${k} has no colorSources entry`);
    assert.match(src.source, /^\[(measured|sourced|estimated)\]/, `${k}'s provenance carries no tier`);
    assert.equal(src.tier, /^\[(\w+)\]/.exec(src.source)[1], `${k}'s tier field and its prose disagree`);
    assert.ok(src.source.length > 100, `${k}'s provenance is a stub`);
    /* The hex must be the byte-rounding of its own recorded channel means. */
    const want = "#" + src.rgb.map((n) => n.toString(16).padStart(2, "0")).join("");
    assert.equal(v, want, `${k} ships ${v} but its own recorded channels round to ${want}`);
  }
  const roles = Object.keys(section.colorSources).filter((k) => k !== "why");
  assert.deepEqual(roles.sort(), Object.keys(section.colors).sort());

  /* THE R4b F1 GATE: colour was the one figure class with no ships-vs-derives
     check — a hex could drift while its provenance line went on quoting the
     old value. Every line that states its result as `= #xxxxxx` must ship it. */
  let stated = 0;
  for (const [role, src] of Object.entries(section.colorSources)) {
    if (role === "why") continue;
    const m = /= (#[0-9a-f]{6})\b/.exec(src.source);
    assert.ok(m, `${role}'s provenance line does not state its hex`);
    stated++;
    assert.equal(section.colors[role], m[1],
      `${role} ships ${section.colors[role]} but its own provenance line derives ${m[1]}`);
  }
  assert.equal(stated, Object.keys(section.colors).length, "every role must state its hex");

  /* NOTHING HERE REACHES [measured], and the threshold says why. */
  const CT = section.colorThreshold;
  for (const [role, src] of Object.entries(section.colorSources)) {
    if (role === "why") continue;
    assert.notEqual(src.tier, "measured",
      `${role} claims [measured]; no rect on this building passes the ${CT.sunlitMin}/${CT.sdMax} bar and §9.9 says so`);
  }
  assert.match(CT.note, /9\.9|uncalibrated|overcast/i);

  /* Every [estimated] role ships EXACTLY its named parent's hex, and no
     parent is itself an estimate — a promotion chain is how an invention
     acquires a measured pedigree. */
  for (const [role, src] of Object.entries(section.colorSources)) {
    if (role === "why" || src.tier !== "estimated") continue;
    const parent = src.extends;
    assert.ok(parent, `${role} is [estimated] and names no parent`);
    assert.equal(section.colors[role], section.colors[parent],
      `${role} claims to extend ${parent} and ships a different hex`);
    assert.equal(section.colorSources[parent].tier, "sourced",
      `${role} extends ${parent}, which is itself an estimate — an estimate may not inherit from an estimate`);
    assert.match(src.source, new RegExp(`colors\\.${parent}\\b`), `${role} must name its parent in prose too`);
  }

  /* No hex literal may live in the module, and every declared role must have
     a consumer there — a role nobody draws is a claim nobody checks. */
  assert.equal(moduleSrc.match(/#[0-9a-fA-F]{6}\b/g), null, "a colour literal leaked into the builder");
  for (const role of Object.keys(section.colors)) {
    assert.ok(moduleCode.includes(`hue("${role}")`),
      `colors.${role} is declared and the builder never draws it`);
  }
  for (const m of moduleCode.matchAll(/hue\("(\w+)"\)/g)) {
    assert.ok(section.colors[m[1]], `the builder draws colors.${m[1]}, which the section does not declare`);
  }
});

test("nothing in this section rests on the unresolved ortho-as-colour-source ruling", () => {
  assert.match(section.colorSources.why, /ortho/i);
  assert.match(section.colorSources.why, /NOT used|not used/,
    "the colour block must say in as many words that the ortho-derived tone is not used");
  for (const [role, src] of Object.entries(section.colorSources)) {
    if (role === "why") continue;
    const line = src.source;
    assert.ok(!/chunk_\d+_\d+\.jpg|ortho pixel|orthophoto pixel/i.test(line),
      `colour ${role} is sampled off orthophoto pixels, which is the ruling Sahir has not made`);
  }
  const flagged = section.conflicts.find((c) => c.key === "orthoColourRuling");
  assert.ok(flagged, "the ortho-as-colour-source ruling must be carried as a declared conflict");
  assert.match(flagged.resolution, /NOT sampled|not sampled/i);
  /* The dossier's four candidate values stay on the record — quarantined, not dropped. */
  const record = JSON.stringify(flagged);
  for (const hex of ["#697558", "#b4b6b8", "#b0b2b4", "#adb0b3"]) {
    assert.ok(record.includes(hex), `conflicts.orthoColourRuling lost the dossier's ${hex}`);
  }
});

test("the recorded samples build nothing and say so", () => {
  for (const [k, s] of Object.entries(section.samples)) {
    if (k === "why" || k === "rejected") continue;
    assert.ok(Array.isArray(s.rgb) && s.rgb.length === 3, `sample ${k} has no channel record`);
    assert.ok(s.source.length > 80, `sample ${k} is a stub`);
    assert.equal(section.colors[k], undefined, `sample ${k} is also a shipped colour — pick one`);
  }
  assert.ok(Object.keys(section.samples.rejected).length >= 3, "the rejected rects must stay on the record");
  for (const v of Object.values(section.samples.rejected)) {
    assert.match(v, /REJECTED/, "a rejected read must say it was rejected");
  }
});

/* ----------------------------------------------- the partition and the ring */

test("the roof planes partition the survey ring EXACTLY, recomputed independently", () => {
  let sum = 0;
  const pieces = [];
  for (const [name, plane] of Object.entries(SY.planes)) {
    for (const box of plane.clip) {
      const p = clipBox(RING, box);
      if (!p) continue;
      pieces.push({ name, plan: p, area: shoelace(p) });
      sum += shoelace(p);
    }
  }
  assert.equal(pieces.length, 4, "the partition must be four pieces");
  near(sum, shoelace(RING), 1e-6,
    "the partition's pieces do not sum to the survey ring — a plan edge has been invented or lost");
  /* The low box is EXACTLY the three measured components grown by half a cell. */
  const [[bx0, bz0], [bx1, bz1]] = SY.planes.low.clip[0];
  near(bx0, fig("lobe.boxX0"), 1e-9, "low box x0");
  near(bx1, fig("lobe.boxX1"), 1e-9, "low box x1");
  near(bz0, fig("lobe.boxZ0"), 1e-9, "low box z0");
  near(bz1, fig("lobe.boxZ1"), 1e-9, "low box z1");
  const C = R.cells;
  const h = fig("grid.cellHalf");
  near(bx0, Math.min(C.lobeLowx0, C.lobeStepx0, C.lobeTowerx0) - h, 1e-9, "low box x0 is not the cell union");
  near(bx1, Math.max(C.lobeLowx1, C.lobeStepx1, C.lobeTowerx1) + h, 1e-9, "low box x1 is not the cell union");
  near(bz0, Math.min(C.lobeLowz0, C.lobeStepz0, C.lobeTowerz0) - h, 1e-9, "low box z0 is not the cell union");
  near(bz1, Math.max(C.lobeLowz1, C.lobeStepz1, C.lobeTowerz1) + h, 1e-9, "low box z1 is not the cell union");
  /* Every plane's height is a measured plateau or the lobe's banded estimate. */
  const plateaus = [R.ept.roofPlane, R.ept.lobeLow, R.ept.lobeStep, R.ept.lobeTower];
  for (const [name, plane] of Object.entries(SY.planes)) {
    assert.ok(plateaus.some((p) => Math.abs(p - plane.h) < 1e-9),
      `plane ${name} sits at ${plane.h}, which is not a measured plateau`);
  }
  for (const s of SY.lobeSteps) {
    assert.ok(plateaus.some((p) => Math.abs(p - s.h) < 1e-9), `lobe step ${s.id} is not a measured plateau`);
    /* Its plan is its own cell extent grown by half a cell, not a free box. */
    const c = R.cells;
    near(s.x1 - s.x0, (c[`${s.id}x1`] - c[`${s.id}x0`]) + 2 * h, 1e-9, `${s.id} width`);
    near(s.z1 - s.z0, (c[`${s.id}z1`] - c[`${s.id}z0`]) + 2 * h, 1e-9, `${s.id} depth`);
  }
});

test("a facade hangs only on an edge that lies on the survey ring", () => {
  /* Recomputed here: for every dressed piece, split its clipped plan into
     edges over the minimum, and count the ones that lie on the survey
     polyline against the ones that do not. The module's own counts must match,
     and the cut count must not be zero — if it were, the gate is not running. */
  let onRing = 0;
  let cuts = 0;
  for (const plane of Object.values(SY.planes)) {
    if (!plane.dressed) continue;
    for (const box of plane.clip) {
      const p = clipBox(RING, box);
      if (!p) continue;
      for (let k = 0; k < p.length - 1; k++) {
        const len = Math.hypot(p[k + 1][0] - p[k][0], p[k + 1][1] - p[k][1]);
        if (!(len > D.minFacadeEdge)) continue;
        const mx = (p[k][0] + p[k + 1][0]) / 2;
        const mz = (p[k][1] + p[k + 1][1]) / 2;
        const ok = toRing(p[k][0], p[k][1], RING) <= D.ringTolerance &&
          toRing(p[k + 1][0], p[k + 1][1], RING) <= D.ringTolerance &&
          toRing(mx, mz, RING) <= D.ringTolerance;
        if (ok) onRing++; else cuts++;
      }
    }
  }
  assert.ok(cuts > 0, "no cut edge was found — the on-ring gate cannot be doing anything");
  const { exposed, buried } = partitionCuts();
  const { counts } = build();
  assert.equal(counts.dressedFaces, onRing + exposed.length,
    "the module dressed a different set of edges than the survey ring plus the proud height-step cuts");
  assert.equal(counts.cutFacesSkipped, buried.length,
    "the module skipped a different set of buried cuts");
  assert.equal(counts.dressedFaces, section.counts.dressedFaces);
  assert.equal(counts.cutFacesSkipped, section.counts.cutFacesSkipped);
});

/**
 * Partition cuts, split by whether they stand proud of the neighbouring
 * plane. Recomputed here from the survey ring and the declared boxes — the
 * module's own skip/dress decision is what is under test, not its classifier.
 * A cut is EXPOSED when this piece's roof is taller than the neighbour's
 * (the west-lobe height step). Same-height cuts between the three 27.10
 * pieces stay buried.
 */
function partitionCuts() {
  const frameOf = (a, b, ccw) => {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!(length > 0)) return null;
    const tx = (b[0] - a[0]) / length;
    const tz = (b[1] - a[1]) / length;
    const s = ccw ? 1 : -1;
    const nx = s * tz;
    const nz = -s * tx;
    return {
      ax: a[0], az: a[1], bx: b[0], bz: b[1], length, tx, tz, nx, nz,
      at(u, w) { return { x: a[0] + tx * u + nx * w, z: a[1] + tz * u + nz * w }; },
    };
  };
  const ccwOf = (ring) => {
    let a = 0;
    for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    return a > 0;
  };
  /* A cut can straddle two neighbours (mainEast's west clip is one edge
     against both the north strip AND the lobe). Split it on each lower
     plane's box; the overlap is the proud frontage. */
  const overlapUs = (fr, box) => {
    const along = (x, z) => (x - fr.ax) * fr.tx + (z - fr.az) * fr.tz;
    const u0 = Math.max(0, Math.min(along(box[0][0], box[0][1]), along(box[0][0], box[1][1]),
      along(box[1][0], box[0][1]), along(box[1][0], box[1][1])));
    const u1 = Math.min(fr.length, Math.max(along(box[0][0], box[0][1]), along(box[0][0], box[1][1]),
      along(box[1][0], box[0][1]), along(box[1][0], box[1][1])));
    /* The face must also sit on the box in the cross direction, not merely
       project onto its span. */
    if (!(u1 - u0 > D.minFacadeEdge)) return null;
    const mid = fr.at((u0 + u1) / 2, 0);
    const onBox = mid.x >= box[0][0] - D.ringTolerance && mid.x <= box[1][0] + D.ringTolerance
      && mid.z >= box[0][1] - D.ringTolerance && mid.z <= box[1][1] + D.ringTolerance;
    /* The face must face INTO the lower box, not merely share its line.
       A clip spike on the same line with the inward normal is not an elevation. */
    const probe = fig("grid.cellHalf");
    const ox = mid.x + fr.nx * probe;
    const oz = mid.z + fr.nz * probe;
    const facesIt = ox >= box[0][0] && ox <= box[1][0] && oz >= box[0][1] && oz <= box[1][1];
    if (!onBox || !facesIt) return null;
    return { u0, u1 };
  };
  const exposed = [];
  const buried = [];
  for (const [name, plane] of Object.entries(SY.planes)) {
    if (!plane.dressed) continue;
    for (const box of plane.clip) {
      const p = clipBox(RING, box);
      if (!p) continue;
      const ccw = ccwOf(p);
      for (let k = 0; k < p.length - 1; k++) {
        const fr = frameOf(p[k], p[k + 1], ccw);
        if (!fr || !(fr.length > D.minFacadeEdge)) continue;
        const mid = fr.at(fr.length / 2, 0);
        const on = toRing(fr.ax, fr.az, RING) <= D.ringTolerance
          && toRing(fr.bx, fr.bz, RING) <= D.ringTolerance
          && toRing(mid.x, mid.z, RING) <= D.ringTolerance;
        if (on) continue;
        const proud = [];
        for (const other of Object.values(SY.planes)) {
          if (!(plane.h > other.h)) continue;
          for (const ob of other.clip) {
            const hit = overlapUs(fr, ob);
            if (hit) proud.push({ ...hit, neighborH: other.h });
          }
        }
        if (!proud.length) {
          buried.push({
            name, fr, thisH: plane.h, neighborH: plane.h,
            midX: mid.x, midZ: mid.z, length: fr.length,
          });
          continue;
        }
        for (const seg of proud) {
          const a = fr.at(seg.u0, 0);
          const b = fr.at(seg.u1, 0);
          const sub = frameOf([a.x, a.z], [b.x, b.z], ccw);
          if (!sub) continue;
          sub.nx = fr.nx;
          sub.nz = fr.nz;
          const sm = sub.at(sub.length / 2, 0);
          exposed.push({
            name, fr: sub, thisH: plane.h, neighborH: seg.neighborH,
            midX: sm.x, midZ: sm.z, length: sub.length,
          });
        }
      }
    }
  }
  return { exposed, buried };
}

/** Plan-distance from (x, z) to segment ab. */
function segDist(x, z, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 ? ((x - ax) * dx + (z - az) * dz) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
}

/** y-span and along-face span of named merged meshes on a face.
 *  A wall is one quad: vertices live at the ends of a (possibly longer)
 *  edge, so coverage is a triangle whose three vertices hug this face's
 *  LINE and whose u-range overlaps the segment. A neighbouring elevation's
 *  corner cannot span the face. */
function fieldYOnFace(group, nameRe, fr, tol) {
  let lo = Infinity;
  let hi = -Infinity;
  let uLo = Infinity;
  let uHi = -Infinity;
  let n = 0;
  group.traverse((o) => {
    if (!nameRe.test(o.name) || !o.geometry?.attributes?.position) return;
    const p = o.geometry.attributes.position;
    for (let i = 0; i + 2 < p.count; i += 3) {
      const xs = [p.getX(i), p.getX(i + 1), p.getX(i + 2)];
      const ys = [p.getY(i), p.getY(i + 1), p.getY(i + 2)];
      const zs = [p.getZ(i), p.getZ(i + 1), p.getZ(i + 2)];
      const us = [];
      let far = false;
      let wSum = 0;
      for (let k = 0; k < 3; k++) {
        const u = (xs[k] - fr.ax) * fr.tx + (zs[k] - fr.az) * fr.tz;
        us.push(u);
        const w = (xs[k] - fr.ax) * fr.nx + (zs[k] - fr.az) * fr.nz;
        wSum += w;
        const px = fr.ax + fr.tx * u;
        const pz = fr.az + fr.tz * u;
        if (Math.hypot(xs[k] - px, zs[k] - pz) > tol) far = true;
      }
      if (far || wSum <= 0) continue;
      const tu0 = Math.min(...us);
      const tu1 = Math.max(...us);
      if (tu1 < 0 || tu0 > fr.length) continue;
      lo = Math.min(lo, ...ys);
      hi = Math.max(hi, ...ys);
      uLo = Math.min(uLo, Math.max(0, tu0));
      uHi = Math.max(uHi, Math.min(fr.length, tu1));
      n++;
    }
  });
  return { lo, hi, n, uSpan: n ? uHi - uLo : 0 };
}

test("every partition cut standing proud of an adjacent roof is dressed — A2 / ultra standard", () => {
  /* THE CRITIC'S HEADLESS PROBE, per face. A treated building is never
     partially detailed: a cut that stands proud of a lower neighbour is an
     elevation, and the curtain/plinth field must cover the exposed y-span
     of the mass wall on that face. Buried same-height cuts stay refused.
     This is the gate the west-lobe blank face would have gone red on. */
  const { exposed, buried } = partitionCuts();
  assert.ok(exposed.length >= 3,
    `the height-step class has no members — the probe is not running (${exposed.length} exposed / ${buried.length} buried)`);
  const { group, counts } = build();
  group.updateMatrixWorld(true);
  const rim = counts.rim;
  const soffitY = counts.soffitY;
  const tol = D.wallOffset + D.fieldStandoff + D.bandStandoff;
  const bare = [];
  for (const face of exposed) {
    const mass = fieldYOnFace(group, /natsci-mass-walls/, face.fr, tol);
    const dressed = fieldYOnFace(group, /natsci-(curtain-wall|plinth)/, face.fr, tol);
    const wantLo = rim + face.neighborH;
    const wantHi = soffitY;
    const spanOk = dressed.uSpan >= face.length - SY.pier.width;
    const ok = mass.n > 0
      && dressed.n > 0
      && spanOk
      && dressed.lo <= wantLo + D.ringTolerance
      && dressed.hi >= wantHi - D.ringTolerance;
    if (!ok) {
      bare.push(`${face.name} @ (${face.midX.toFixed(2)}, ${face.midZ.toFixed(2)}) `
        + `len ${face.length.toFixed(2)} proud ${face.thisH} over ${face.neighborH}: `
        + `mass n=${mass.n} y ${mass.n ? mass.lo.toFixed(2) : "—"}..${mass.n ? mass.hi.toFixed(2) : "—"}, `
        + `fields n=${dressed.n} y ${dressed.n ? dressed.lo.toFixed(2) : "—"}..${dressed.n ? dressed.hi.toFixed(2) : "—"} `
        + `uSpan ${dressed.uSpan.toFixed(2)}, `
        + `want ${wantLo.toFixed(2)}..${wantHi.toFixed(2)}`);
    }
  }
  assert.equal(bare.length, 0,
    `bare exposed cut faces (ultra standard — a treated building is never partially detailed):\n  ${bare.join("\n  ")}`);
  /* The four same-height cuts between the 27.10 pieces stay interior. */
  for (const face of buried) {
    const dressed = fieldYOnFace(group, /natsci-(curtain-wall|plinth)/, face.fr, tol);
    assert.equal(dressed.n, 0,
      `${face.name} @ (${face.midX.toFixed(2)}, ${face.midZ.toFixed(2)}) is a buried cut and is dressed`);
  }
});

/* ------------------------------------------------------- module contract */

test("the module carries no dimension of its own — geometry is data", () => {
  const allowed = new Set([
    "0.5", // a half: the centre of a bay, a cell or a fan quadrant
    "1.0", // material roughness
    "0.0", // material metalness
  ]);
  const found = new Set(moduleCode.match(/\b\d+\.\d+\b/g) || []);
  for (const n of found) {
    assert.ok(allowed.has(n),
      `${n} is a bare number in the builder — move it into the section's derivations, estimates, reads or draw block`);
  }
  for (const key of ["draw", "planes", "grids", "louvre", "pier", "mast", "canopy", "stair", "mech", "serviceYard"]) {
    assert.ok(moduleCode.includes(key), `the builder never reads section.${key}`);
  }
});

test("the module is a one-way reader, deterministic, and on the shared ladders", () => {
  assert.equal(moduleCode.match(/Math\.random/), null, "the module uses Math.random");
  assert.equal(moduleCode.match(/\bnew Date\b|Date\.now|performance\.now/), null, "the module reads a clock");
  assert.equal(moduleCode.match(/new THREE\.TextureLoader|\.load\(/), null,
    "textures are code-generated here, never loaded from a photograph");
  assert.equal(moduleCode.match(/section\.\w+\s*=[^=]/), null, "the module writes back into the section");
  assert.match(moduleSrc, /from "\.\/campus-overlay\.js"/);
  assert.match(moduleSrc, /from "\.\/campus-materials\.js"/);
  assert.match(moduleCode, /overlayLift\(/, "seated ground geometry must take its lift from campus-overlay.js");
  assert.match(moduleCode, /sharedMaterialLibrary/, "surfaces come from campus-materials.js");
  const keys = [...moduleSrc.matchAll(/photo\?\.(\w+)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(keys)], ["natsci"], "the module reads a key that is not its own");
  /* heightAt must never place anything on the ground here. */
  assert.equal(moduleCode.match(/heightAt\(/), null, "the module calls heightAt — everything seats on surfaceAt");
});

test("a half-landed merge builds NOTHING and names what it is waiting for", () => {
  const missing = createPhotoNatsci(null, { photo: {}, heightAt: flat, surfaceAt: flat });
  assert.deepEqual(missing.counts, {}, "a missing section must build nothing and break nothing");
  for (const key of ["system", "draw", "colors", "ground", "estimates"]) {
    const half = { ...section };
    delete half[key];
    const r = createPhotoNatsci(null, { photo: { natsci: half }, surfaceAt: flat });
    assert.equal(r.group.children.length, 0, `a section without ${key} drew geometry off a shape it does not have`);
    assert.match(r.counts.pendingMerge, new RegExp(key), `the guard must name ${key}`);
  }
  const noPlanes = { ...section, system: { ...section.system } };
  delete noPlanes.system.planes;
  const r = createPhotoNatsci(null, { photo: { natsci: noPlanes }, surfaceAt: flat });
  assert.equal(r.group.children.length, 0);
  assert.match(r.counts.pendingMerge, /system\.planes/);
  assert.throws(() => createPhotoNatsci(null, { photo: { natsci: section } }), /surfaceAt/,
    "a missing sampler must not be silent");
});

/* --------------------------------------------- the module, actually running */

/**
 * Every INSTANCE placement in a subtree, as (x, y, z, scale, node). Merged
 * BufferGeometry meshes are NOT reported here: their object position is the
 * world origin and their scale is one, so a box test over them measures
 * nothing at all. They are walked vertex by vertex in `eachVertex`.
 */
function each(node, fn) {
  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const e = new THREE.Euler();
  node.traverse((o) => {
    if (!o.isInstancedMesh) return;
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m);
      m.decompose(pos, q, sc);
      e.setFromQuaternion(q, "YXZ");
      fn(pos.x, pos.y, pos.z, sc, o, e.y);
    }
  });
}

/** The four plan corners of a box placed with a Y rotation. */
function planCorners(x, z, sc, rot) {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const out = [];
  for (const dx of [-sc.x / 2, sc.x / 2]) {
    for (const dz of [-sc.z / 2, sc.z / 2]) {
      out.push([x + dx * c + dz * s, z - dx * s + dz * c]);
    }
  }
  return out;
}

/** Every vertex of every merged mesh in a subtree, as (x, y, z, node). */
function eachVertex(node, fn) {
  node.traverse((o) => {
    if (o.isInstancedMesh || !o.isMesh) return;
    const p = o.geometry?.attributes?.position;
    if (!p) return;
    for (let i = 0; i < p.count; i++) fn(p.getX(i), p.getY(i), p.getZ(i), o);
  });
}

test("the module builds every system, and the counts are the declared ones on every terrain", () => {
  for (const [label, g] of [["flat", flat], ["slope", slope], ["bump", bump], ["drawn", drawnGround]]) {
    const { counts } = build(g);
    for (const [k, v] of Object.entries(section.counts)) {
      if (k === "note") continue;
      assert.equal(counts[k], v, `${label}: count ${k}`);
    }
  }
  const { group, counts } = build();
  assert.ok(group.children.find((c) => c.name === "natsci-building"), "no natsci-building group");
  assert.ok(group.children.find((c) => c.name === "natsci-ground"), "no natsci-ground group");
  /* Recomputed rather than trusted: every count that is a product of declared
     figures is rebuilt from those figures here. */
  assert.equal(counts.planes, Object.keys(SY.planes).length);
  assert.equal(counts.lobeSteps, SY.lobeSteps.length);
  assert.equal(counts.penthouses, SY.mech.spines.length);
  assert.equal(counts.mechBlocks, SY.mech.blocks.length);
  assert.equal(counts.blowers, SY.mech.blowerN.count + SY.mech.blowerS.count);
  assert.equal(counts.condenserFans, SY.mech.condenser.fans);
  assert.equal(counts.steps, section.ground.east.stepCount);
  assert.equal(counts.curtainFields, counts.dressedFaces, "every dressed face carries a curtain field");
  /* Step returns start at the lobe roof, above the one-storey plinth head. */
  assert.equal(counts.plinthFields + partitionCuts().exposed.length, counts.dressedFaces,
    "every survey-ring face carries a plinth; proud cuts start above the plinth");
  assert.equal(counts.masts, counts.piers, "the masts are paired to the piers");
  assert.ok(counts.estimatedFaces > 0 && counts.estimatedFaces < counts.dressedFaces,
    "the [estimated] extension must be a real minority of the faces, not all of them and not none");
  assert.equal(counts.stairs, 3, "one external stair per sourced wing end: east end, south end, north-west");
});

test("nothing hovers and nothing sinks — flat, a slope, a 6 m shoulder, and the DRAWN LiDAR surface", () => {
  for (const [label, g] of [["flat", flat], ["slope", slope], ["bump", bump], ["drawn", drawnGround]]) {
    const { group, counts } = build(g);
    group.updateMatrixWorld(true);
    const roofY = counts.roofY;
    const rim = counts.rim;
    near(roofY - rim, SY.planes.mainEast.h, 1e-9, `${label}: the roof plane is not 27.10 over the rim`);
    near(counts.soffitY, rim + SY.roof.soffit, 1e-9, `${label}: the soffit is not one slab below the roof`);

    /* THE DECLARED FLOOR of the whole mass: the lowest drawn surface anywhere
       under the survey ring, less the skirt. One datum per mass means one
       floor, not one per vertex — a wall foot follows its PIECE's lowest
       ground, which on a slope is well below the ground at its own corner. */
    let sceneFloor = Infinity;
    for (let x = section.bounds.x0; x <= section.bounds.x1; x += 1) {
      for (let z = section.bounds.z0; z <= section.bounds.z1; z += 1) {
        const v = g(x, z);
        if (Number.isFinite(v)) sceneFloor = Math.min(sceneFloor, v);
      }
    }
    sceneFloor -= D.skirtDepth;

    let checked = 0;
    let maxSolid = -Infinity;
    each(group, (x, y, z, sc, o) => {
      checked++;
      const g0 = g(x, z);
      const bottom = y - sc.y / 2;
      /* GROUND-SEATED POPULATIONS: nothing may float over the drawn surface,
         and nothing may plunge — a runaway skirt is as wrong as a hover. */
      if (/entrance-ground|service-yard/.test(o.name)) {
        assert.ok(bottom <= g0 + 0.01,
          `${label}: ${o.name} bottom ${bottom.toFixed(2)} floats over the drawn surface ${g0.toFixed(2)} at (${x.toFixed(1)}, ${z.toFixed(1)})`);
        assert.ok(bottom >= g0 - D.skirtDepth - 0.01,
          `${label}: ${o.name} plunges to ${bottom.toFixed(2)} under ${g0.toFixed(2)} — a runaway skirt`);
      }
      /* ROOF POPULATIONS: everything the roofscape carries stands ON the
         27.10 m plane, never below it and never above the measured mech. */
      if (/mech|walkway/.test(o.name)) {
        assert.ok(bottom >= roofY - 0.01,
          `${label}: ${o.name} dips to ${bottom.toFixed(2)} below the roof plane ${roofY.toFixed(2)}`);
        maxSolid = Math.max(maxSolid, y + sc.y / 2);
      }
      /* Nothing anywhere may sit under the mass's own skirt. */
      assert.ok(bottom >= sceneFloor - 0.01,
        `${label}: ${o.name} sits at ${bottom.toFixed(2)}, below the mass's declared floor ${sceneFloor.toFixed(2)}`);
    });
    /* The merged fields — walls, plinth, curtain, membrane, fascia, soffit,
       carpets — are one mesh each at the world origin, so they are checked
       VERTEX BY VERTEX or not at all. */
    eachVertex(group, (x, y, z, o) => {
      checked++;
      const g0 = g(x, z);
      if (/west-(dg|mow)|lawn/.test(o.name)) {
        near(y, g0 + overlayLift(/lawn/.test(o.name) ? D.bedRung : section.ground.west.rung), 2e-4,
          `${label}: ${o.name} is off the drawn surface at (${x.toFixed(1)}, ${z.toFixed(1)})`);
        return;
      }
      if (/walkway|membrane/.test(o.name)) {
        assert.ok(y >= roofY - 0.01, `${label}: ${o.name} dips below the roof plane`);
        return;
      }
      assert.ok(y >= sceneFloor - 0.01,
        `${label}: ${o.name} has a vertex at ${y.toFixed(2)}, below the mass's declared floor ${sceneFloor.toFixed(2)} at (${x.toFixed(1)}, ${z.toFixed(1)})`);
      assert.ok(y <= roofY + 0.01,
        `${label}: ${o.name} has a vertex at ${y.toFixed(2)}, above the roof plane ${roofY.toFixed(2)}`);
    });
    assert.ok(checked > 600, `${label}: only ${checked} placements checked — the loops did not run`);
    /* THE MECHANICAL TOPS OUT AT 30.03 AND THE 32.52 SPIKE IS NOT MODELLED. */
    near(maxSolid, rim + R.ept.mechBlocks, 2e-4,
      `${label}: the roofscape's maximum is not the measured 30.03 plane`);
    assert.ok(maxSolid < rim + R.ept.spikeMax - 1,
      `${label}: something was built up to the 32.52 m spike, which absent A3 withholds`);
  }
});

test("the drawn LiDAR surface reproduces the point cloud's own rim base", () => {
  const { counts } = build(drawnGround);
  near(counts.rim, fig("rim.local"), 0.05,
    "the median drawn surface along the mass ring and the independent EPT rim base disagree — one datum per mass means these two must be the same number");
});

test("every facade closes on 27.10 m, and the plinth stops where its own storeys do", () => {
  const { group, counts } = build();
  group.updateMatrixWorld(true);
  const roofY = counts.roofY;
  const F = fig("storey.floorToFloor");
  const bb = (name) => {
    let lo = Infinity;
    let hi = -Infinity;
    group.traverse((o) => {
      if (o.name !== name || !o.geometry?.attributes?.position) return;
      const p = o.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) { lo = Math.min(lo, p.getY(i)); hi = Math.max(hi, p.getY(i)); }
    });
    return { lo, hi };
  };
  near(bb("natsci-mass-walls-sourced").hi, roofY, 2e-4, "the mass walls do not close on the roof plane");
  near(bb("natsci-roof-membrane-estimated").hi, roofY + D.membraneLift, 2e-4, "the membrane is not on the roof plane");
  near(bb("natsci-roof-fascia-estimated").hi, roofY, 2e-4, "the fascia does not top out on the roof plane");
  near(bb("natsci-roof-fascia-estimated").lo, counts.soffitY, 2e-4, "the fascia is not one slab deep");
  near(bb("natsci-curtain-wall-sourced").hi, counts.soffitY, 2e-4, "the curtain wall runs past the soffit");
  /* The plinth's head is a whole number of this building's own storeys, and
     the north face's two are the sourced ones. */
  const plinthHi = bb("natsci-plinth-sourced").hi;
  near(plinthHi, counts.rim + R.facade.plinthStoreysNorth * F, 2e-4,
    "the tallest plinth is not the north face's sourced two storeys");
  near(bb("natsci-curtain-wall-sourced").lo, counts.rim + SY.faceRules.systems.west.plinthStoreys * F, 2e-4,
    "the lowest curtain wall does not start at the one-storey plinth head");
  /* NO PARAPET is drawn anywhere: nothing solid stands between the roof plane
     and the mechanical, which is what makes 27.10 the top of the slab. */
  let parapets = 0;
  each(group, (x, y, z, sc, o) => {
    if (/mech|mast|walkway/.test(o.name)) return;
    if (y - sc.y / 2 > roofY + 0.01) parapets++;
  });
  assert.equal(parapets, 0, "something stands on the roof plane that is not the mechanical — a parapet was drawn");
});

test("everything on the roof is on the roof plate, and nothing hangs over the rim", () => {
  const { group } = build();
  group.updateMatrixWorld(true);
  const lowBox = SY.planes.low.clip[0];
  /* A corner exactly ON the ring is on the plate: even-odd is undefined on a
     boundary, and the module seats its boxes to the ring's own tolerance. */
  const on = (x, z) => inRing(x, z, RING) || toRing(x, z, RING) <= D.ringTolerance + 1e-6;
  each(group, (x, y, z, sc, o, rot) => {
    if (!/mech|walkway/.test(o.name)) return;
    /* Every corner, not just the centre: a footprint whose middle is on the
       plate can still hang its rim over the edge, and there is no roof there. */
    for (const [cx, cz] of planCorners(x, z, sc, rot)) {
      assert.ok(on(cx, cz), `${o.name} corner (${cx.toFixed(1)}, ${cz.toFixed(1)}) runs off the roof plate`);
      assert.ok(!(cx >= lowBox[0][0] && cx <= lowBox[1][0] && cz >= lowBox[0][1] && cz <= lowBox[1][1]),
        `${o.name} corner (${cx.toFixed(1)}, ${cz.toFixed(1)}) stands over the 4.6 m west lobe at roof height`);
    }
  });
  /* The south blower row takes the PLATEAU's z, not the ortho's — the whole
     point of conflicts['south-blower-row-z']. */
  const spineS = SY.mech.spines.find((s) => s.id === "spineS");
  let rows = 0;
  each(group, (x, y, z, sc, o) => {
    if (!/blower/.test(o.name) || x < spineS.x0 - 5) return;
    if (z < spineS.z0 || z > spineS.z1) return;
    rows++;
  });
  assert.ok(rows >= SY.mech.blowerS.count * 2,
    "the south blower row is not inside its penthouse's own measured z extent — the forbidden ortho z read came back");
});

test("the built piers, blowers, condenser and colonnade land on the DERIVED stations", () => {
  /* P101 §SURGERY Gate 1. Containment is not a station gate: a 0.5 m slide
     along a face normal stays inside the plate, inside the bounds, and on
     the survey's own side of the polyline. This test re-derives
     origin + k·pitch on each dressable face, the blower x-row, the
     condenser centre and the colonnade offset from the section's own
     figures and requires every built instance to land on that station. */
  const { group } = build();
  const STATION = 0.05;
  const FIELD_OFF = D.wallOffset + D.fieldStandoff;
  const ccwOf = (ring) => {
    let a = 0;
    for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    return a > 0;
  };
  const frameOf = (a, b, ccw) => {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!(length > 0)) return null;
    const tx = (b[0] - a[0]) / length;
    const tz = (b[1] - a[1]) / length;
    const s = ccw ? 1 : -1;
    const nx = s * tz;
    const nz = -s * tx;
    return {
      ax: a[0], az: a[1], length, tx, tz, nx, nz,
      at(u, w) { return { x: a[0] + tx * u + nx * w, z: a[1] + tz * u + nz * w }; },
    };
  };
  const inBox = (x, z, box) => x >= box[0][0] && x <= box[1][0] && z >= box[0][1] && z <= box[1][1];
  const dressable = [];
  for (const plane of Object.values(SY.planes)) {
    if (!plane.dressed) continue;
    for (const box of plane.clip) {
      const plan = clipBox(RING, box);
      if (!plan) continue;
      const ccw = ccwOf(plan);
      for (let k = 0; k < plan.length - 1; k++) {
        const fr = frameOf(plan[k], plan[k + 1], ccw);
        if (!fr || !(fr.length > D.minFacadeEdge)) continue;
        const mid = fr.at(fr.length / 2, 0);
        const end = fr.at(fr.length, 0);
        if (toRing(fr.ax, fr.az, RING) > D.ringTolerance
          || toRing(end.x, end.z, RING) > D.ringTolerance
          || toRing(mid.x, mid.z, RING) > D.ringTolerance) {
          /* A proud height-step cut is also a dressable elevation. */
          continue;
        }
        dressable.push(fr);
      }
    }
  }
  for (const face of partitionCuts().exposed) {
    face.fr.stepReturn = true;
    dressable.push(face.fr);
  }
  const stationsOn = (fr, grid, pad) => {
    const out = [];
    if (!grid) return out;
    const along = (p) => (p.x - fr.ax) * fr.tx + (p.z - fr.az) * fr.tz;
    for (let k = 0; k <= grid.bays; k++) {
      const c = grid.origin + k * grid.pitch;
      const u = along(grid.axis === "x" ? { x: c, z: fr.az } : { x: fr.ax, z: c });
      if (u >= -pad && u <= fr.length + pad) out.push(Math.max(0, Math.min(fr.length, u)));
    }
    return out;
  };
  const gridOf = (fr) => {
    const m = fr.at(fr.length / 2, 0);
    const axis = Math.abs(fr.tx) >= Math.abs(fr.tz) ? "x" : "z";
    return Object.values(SY.grids).find((g) => g.axis === axis && inBox(m.x, m.z, g.box)) || null;
  };
  const wantPiers = [];
  const wantCols = [];
  const pierW = FIELD_OFF + SY.pier.proud / 2;
  const colW = FIELD_OFF + section.ground.west.colonnadeStandoff;
  const RULES = SY.faceRules;
  for (const fr of dressable) {
    const grid = gridOf(fr);
    for (const u of stationsOn(fr, grid, SY.pier.width)) {
      const p = fr.at(u, pierW);
      wantPiers.push([p.x, p.z]);
    }
    const mid = fr.at(fr.length / 2, 0);
    const isWest = fr.nx <= -RULES.axisNormal;
    if (isWest && !fr.stepReturn && grid && fr.length > grid.pitch) {
      for (const u of stationsOn(fr, grid, 0)) {
        if (!(u > 0 && u < fr.length)) continue;
        const p = fr.at(u, colW);
        wantCols.push([p.x, p.z]);
      }
    }
  }

  const piers = [];
  const colonnade = [];
  const blowers = [];
  const condensers = [];
  each(group, (x, y, z, sc, o) => {
    if (o.name === "natsci-pier-sourced") {
      const colH = section.ground.west.colonnadeHeight + D.skirtDepth;
      if (Math.abs(sc.y - colH) <= 0.05 && Math.abs(sc.x - section.ground.west.colonnadeSize) <= 0.05) {
        colonnade.push([x, z]);
      } else if (Math.abs(sc.x - SY.stair.width) <= 0.05 && Math.abs(sc.z - SY.stair.width) <= 0.05) {
        /* stairs: same mesh, not a column-grid station */
      } else {
        piers.push([x, z]);
      }
    }
    if (/natsci-mech-blower/.test(o.name) && !/-round$/.test(o.name)) blowers.push([x, z]);
    if (/natsci-mech-condenser/.test(o.name) && !/-round$/.test(o.name)) condensers.push([x, z]);
  });

  const nearest = (got, want) => Math.min(...want.map(([wx, wz]) => Math.hypot(got[0] - wx, got[1] - wz)));
  assert.equal(piers.length, section.counts.piers, "classified pier count");
  assert.equal(wantPiers.length, piers.length,
    `derived ${wantPiers.length} pier stations against ${piers.length} built`);
  for (const p of piers) {
    const d = nearest(p, wantPiers);
    assert.ok(d <= STATION,
      `pier at (${p[0].toFixed(3)}, ${p[1].toFixed(3)}) stands ${d.toFixed(3)} m off every derived origin+k·pitch station`);
  }
  for (const w of wantPiers) {
    const d = Math.min(...piers.map((p) => Math.hypot(p[0] - w[0], p[1] - w[1])));
    assert.ok(d <= STATION,
      `no built pier lands on derived station (${w[0].toFixed(3)}, ${w[1].toFixed(3)})`);
  }

  assert.equal(colonnade.length, section.counts.colonnade, "classified colonnade count");
  assert.equal(wantCols.length, colonnade.length,
    `derived ${wantCols.length} colonnade stations against ${colonnade.length} built`);
  for (const p of colonnade) {
    const d = nearest(p, wantCols);
    assert.ok(d <= STATION,
      `colonnade at (${p[0].toFixed(3)}, ${p[1].toFixed(3)}) stands ${d.toFixed(3)} m off every derived station`);
  }

  const BN = SY.mech.blowerN;
  const spineN = SY.mech.spines.find((s) => s.id === BN.anchor);
  const wantBlowX = [];
  for (let k = 0; k < BN.count; k++) wantBlowX.push(BN.x0 + k * BN.pitch);
  const northBlow = blowers.filter(([x]) =>
    wantBlowX.some((s) => Math.abs(x - s) <= STATION)).sort((a, b) => a[0] - b[0]);
  assert.ok(northBlow.length >= BN.count, `only ${northBlow.length} north-bank blowers`);
  for (let k = 0; k < BN.count; k++) {
    const hit = northBlow.some(([x]) => Math.abs(x - wantBlowX[k]) <= STATION);
    assert.ok(hit, `no built blower lands on derived x-station ${wantBlowX[k]}`);
  }
  for (const [x] of northBlow) {
    const dist = Math.min(...wantBlowX.map((s) => Math.abs(x - s)));
    assert.ok(dist <= STATION, `north blower at x=${x.toFixed(3)} stands ${dist.toFixed(3)} m off every derived x-station`);
  }

  const BS = SY.mech.blowerS;
  const spineS = SY.mech.spines.find((s) => s.id === BS.anchor);
  const wantBlowZ = [];
  for (let k = 0; k < BS.count; k++) {
    wantBlowZ.push(spineS.z0 + ((k + 0.5) * (spineS.z1 - spineS.z0)) / BS.count);
  }
  const wantSouthX = spineS.x1 + BS.size / 2;
  const southBlow = blowers.filter(([x]) => Math.abs(x - wantSouthX) <= 1).sort((a, b) => a[1] - b[1]);
  assert.ok(southBlow.length >= BS.count, `only ${southBlow.length} south-row blowers`);
  for (const [x, z] of southBlow) {
    assert.ok(Math.abs(x - wantSouthX) <= STATION,
      `south blower at (${x.toFixed(3)}, ${z.toFixed(3)}) is not on the derived east-flank x ${wantSouthX}`);
    const dist = Math.min(...wantBlowZ.map((s) => Math.abs(z - s)));
    assert.ok(dist <= STATION,
      `south blower at z=${z.toFixed(3)} stands ${dist.toFixed(3)} m off every derived z-station`);
  }
  for (const sz of wantBlowZ) {
    assert.ok(southBlow.some(([, z]) => Math.abs(z - sz) <= STATION),
      `no built blower lands on derived south z-station ${sz}`);
  }

  const CD = SY.mech.condenser;
  assert.equal(condensers.length, 1, "one condenser box");
  near(condensers[0][0], CD.cx, STATION, "condenser x");
  near(condensers[0][1], CD.cz, STATION, "condenser z");
});

test("nothing invented sits inside another measured building's footprint, and the bounds hold", () => {
  const { group } = build();
  group.updateMatrixWorld(true);
  const others = campus.buildings
    .filter((b, i) => i !== 398 && b.p && b.p.length >= 3)
    .filter((b) => b.p.some(([x, z]) => x > section.bounds.x0 - 40 && x < section.bounds.x1 + 40
      && z > section.bounds.z0 - 40 && z < section.bounds.z1 + 40));
  const B = section.bounds;
  const check = (x, z, o) => {
    assert.ok(x >= B.x0 && x <= B.x1 && z >= B.z0 && z <= B.z1,
      `${o.name} at (${x.toFixed(1)}, ${z.toFixed(1)}) is outside the section's declared bounds`);
    for (const b of others) {
      assert.ok(!inRing(x, z, b.p), `${o.name} at (${x.toFixed(1)}, ${z.toFixed(1)}) is inside ${b.n || "an unnamed mass"}`);
    }
  };
  each(group, (x, y, z, sc, o, rot) => {
    for (const [cx, cz] of planCorners(x, z, sc, rot)) check(cx, cz, o);
  });
  eachVertex(group, (x, y, z, o) => check(x, z, o));
});

test("the ground claims are the survey's, split where §8 says and nowhere else", () => {
  const owned = section.ground.rings.owned;
  for (const o of owned) {
    const survey = arcgis.ground[o.index].r.map((r) => r.map(([x, z]) => [x / 10, z / 10]));
    assert.deepEqual(o.rings, survey, `ground#${o.index} is not the survey ring at /10`);
    assert.equal(arcgis.ground[o.index].k, o.kind, `ground#${o.index} kind`);
    near(shoelace(survey[0]), o.fullAreaM2, 0.1, `ground#${o.index} full area`);
  }
  const split = owned.find((o) => o.index === 1171);
  const clipped = clipBox(split.rings[0], split.clip[0]);
  near(shoelace(clipped), split.claimedAreaM2, 0.1, "the #1171 split does not claim what it says it claims");
  assert.ok(shoelace(clipped) < shoelace(split.rings[0]), "the split must claim LESS than the whole ring");
  /* The declared split line is §8's own: x -105 and z 336. */
  assert.equal(split.clip[0][1][0], -105);
  assert.equal(split.clip[0][1][1], 336);
  /* #2376 is owned and DELIBERATELY undressed. */
  const inset = owned.find((o) => o.index === 2376);
  assert.equal(inset.carpet, false);
  assert.ok(inset.what.length > 200, "an owned-and-undressed ring must say why at length");
  /* And the shipped revellecommons section must still not be dressing it. */
  const rc = JSON.stringify(shippedDoc.revellecommons ?? {});
  assert.match(rc, /1171/, "revellecommons no longer mentions #1171 — re-check the split before shipping");
  /* Nothing north of the P101 kerb is claimed. */
  /* The bounds may reach north of the LANDSCAPE claim, because the roof slab
     oversails the ring — but the note must say so, and the boundary must state
     the kerb the landscape stops at. */
  assert.match(section.bounds.note, /NOT A LAND CLAIM/i,
    "the bounds reach past the landscape claim and must explain why");
  assert.match(section.boundary.north, /281/, "the north boundary must state the kerb it stops at");
  assert.ok(section.bounds.z0 > 275 && section.bounds.z0 < 280,
    "the bounds' north edge is the roof slab's oversail off a z 280.0 ring, nothing more");
  /* Tata's declared territory (research-tata.md §9.3): x −85..12, z 143..192.
     An overlap check against THOSE named figures, not just the local z0 band —
     widening x1 alone into tata's x-range must trip, and so must a z reach
     into 143..192. */
  const TATA_X0 = -85;
  const TATA_X1 = 12;
  const TATA_Z0 = 143;
  const TATA_Z1 = 192;
  assert.ok(section.bounds.x1 < TATA_X0 || section.bounds.x0 > TATA_X1,
    `natsci x ${section.bounds.x0}..${section.bounds.x1} enters tata's declared x ${TATA_X0}..${TATA_X1}`);
  assert.ok(section.bounds.z1 < TATA_Z0 || section.bounds.z0 > TATA_Z1,
    `natsci z ${section.bounds.z0}..${section.bounds.z1} enters tata's declared z ${TATA_Z0}..${TATA_Z1}`);
  for (const nm of section.ground.rings.notMine) {
    assert.ok(arcgis.ground[nm.index], `ground#${nm.index} does not exist`);
    assert.ok(!owned.some((o) => o.index === nm.index), `ground#${nm.index} is both owned and not-mine`);
  }
});

test("the withholdings are real in the scene", () => {
  const { group, counts } = build();
  for (const k of ["spikes", "forecourtObjects", "yardObjects", "mullions", "letters",
    "siteUtilities", "basements", "cornerBlocks"]) {
    assert.equal(counts[k], 0, `${k} is not zero — a declared withholding got built`);
    assert.equal(section.counts[k], 0, `the section declares ${k} non-zero`);
  }
  const names = [];
  group.traverse((o) => { if (o.name) names.push(o.name); });
  for (const forbidden of [/mullion/i, /tree/i, /bench/i, /bike/i, /rack/i, /bin\b/i, /cylinder/i,
    /letter/i, /sign/i, /tank/i, /basement/i, /corner-block/i, /parapet/i]) {
    assert.ok(!names.some((n) => forbidden.test(n)),
      `a mesh named for a withheld object exists: ${names.find((n) => forbidden.test(n))}`);
  }
  /* Every mesh declares its tier in its own name, and the estimated set is
     exactly the declared one — a render alone must show the tier. */
  for (const n of names) {
    if (n === "photo-natsci" || n === "natsci-building" || n === "natsci-ground") continue;
    assert.match(n, /^natsci-.*-(sourced|estimated)(-round)?$/, `mesh ${n} does not declare its tier`);
  }
});

test("conflicts are declared, adjudicated, and never averaged", () => {
  const keys = section.conflicts.map((c) => c.key);
  for (const k of ["name", "division-alias", "completion-year", "gis-h-formula", "seventh-storey",
    "bay-module", "south-cross-bay", "ring-west-lobe", "ring-east-edge", "ring-ne-overshoot",
    "ortho-z-registration", "south-blower-row-z", "mech-spine-extent", "gis-prism-vs-measured-roof",
    "tata-quadrangle-boundary", "courts-mapping", "orthoColourRuling"]) {
    assert.ok(keys.includes(k), `conflicts is missing ${k}`);
  }
  assert.equal(new Set(keys).size, keys.length, "two conflicts share a key");
  for (const c of section.conflicts) {
    assert.ok(c.sides.length >= 2, `${c.key} has fewer than two sides`);
    for (const s of c.sides) assert.ok(s.length > 40, `${c.key} has a stub side`);
    assert.ok(c.resolution.length > 120, `${c.key}'s resolution is a stub`);
    assert.equal(/\baverag/i.test(c.resolution) && !/NOT AVERAGED|never averaged|WITHOUT AVERAGING|not averaged in|is not averaged|NOT RESOLVED|not resolve/i.test(c.resolution), false,
      `${c.key} appears to average its sides`);
  }
  /* The name conflict must protect the OSM singular by name. */
  const name = section.conflicts.find((c) => c.key === "name");
  assert.match(name.resolution, /must NOT be 'fixed'|do not "fix"|not be 'fixed'/i);
  /* The prism conflict must name the wiring it declares rather than doing it. */
  const prism = section.conflicts.find((c) => c.key === "gis-prism-vs-measured-roof");
  assert.match(prism.resolution, /skipGis/);
  assert.match(prism.resolution, /REPLACES_MEASURED/);
  assert.equal(moduleCode.match(/skipGis|REPLACES_MEASURED/), null,
    "the module must DECLARE the retirement, never wire it — campus-massing and campus-walk are main's to edit");
});

test("two builds are byte-identical — no hidden randomness", () => {
  const a = build();
  const b = build();
  assert.deepEqual(a.counts, b.counts);
  const sig = (r) => {
    const out = [];
    r.group.traverse((o) => {
      if (o.isInstancedMesh) out.push(Array.from(o.instanceMatrix.array));
      else if (o.isMesh) out.push(Array.from(o.geometry.attributes.position.array));
    });
    return out;
  };
  assert.deepEqual(sig(a), sig(b));
});

test("the material library is on every surface and no map came from a photograph", () => {
  const { group } = build();
  let textured = 0;
  let meshes = 0;
  group.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    assert.ok(o.material, `${o.name} has no material`);
    if (o.material.map && o.material.roughnessMap) textured++;
  });
  assert.ok(meshes > 15, `only ${meshes} meshes`);
  assert.ok(textured >= meshes - 2, `${meshes - textured} meshes carry no generated maps`);
});

}
