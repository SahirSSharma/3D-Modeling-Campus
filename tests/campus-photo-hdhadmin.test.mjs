/* The HDH Administration Building's section — the INVENTED class, R5 batch,
 * at the ultra standard.
 *
 * The Eighth audit proved that presence gates pass on wholesale fabricated
 * values, so almost nothing here merely checks that a key exists. Every drawn
 * figure is recomputed INDEPENDENTLY from the section's own readings; every
 * number underneath those figures is pinned to the artefact it was read off,
 * or is a MIRROR whose origin is named here, or is copied verbatim from a
 * shipped survey file this suite re-opens; and the geometry is rebuilt on flat
 * ground, on an exaggerated slope and on the REAL drawn LiDAR surface, with
 * nothing hovering, nothing sinking and nothing standing inside a measured
 * footprint.
 *
 * The section-level claims this file exists to hold hdhadmin to:
 *
 *   - THE DRAWN PRISM IS 4.27 m TOO TALL AND THIS MODULE REPLACES IT. The
 *     overshoot is recomputed from campus-massing.js itself, the envelope
 *     closes on the MEASURED plate at repo 38.20, and the skipGis /
 *     REPLACES_MEASURED wiring main must do is declared and checked.
 *
 *   - THE PENTHOUSE IS SIX MEASURED CONTROL POINTS, NOT A SHAPE. The pleat is
 *     deepEqualed against the laser's own profile, its bay slopes are
 *     recomputed, its two independent rising limbs are asserted to agree, and
 *     bay 3 must STOP at the survey ring rather than be completed.
 *
 *   - THE VEIL'S EXTENT IS THE SURVEY'S OWN JOG. The whole facade table is
 *     re-derived here from arcgis.massing[144] and deepEqualed, so a facade
 *     cannot drift off the ring and a system cannot quietly annex a run.
 *
 *   - HALF THIS BUILDING IS [estimated] AND THE SCENE SAYS SO. The sourced
 *     fraction is computed, the north and east faces must be labelled, and
 *     every mesh they make must carry -estimated in its name.
 *
 *   - COLOURS ARE DATA, AND A PROVENANCE LINE THAT STATES ITS HEX MUST SHIP
 *     THAT HEX.
 *
 *   - THE ABSENT LIST DOES NOT SHRINK.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as THREE from "../docs/vendor/three/three.module.min.js";
import {
  assertCoverage, assertEstimateBands, assertPins, assertRelations,
  assertTierSymmetry, assertAbsentEntries, assertExprs,
} from "./helpers/axiom-gate.mjs";
import { createPhotoHdhAdmin } from "../docs/js/campus-photo-hdhadmin.js";
import { assembleMasses, roofElevation } from "../docs/js/campus-massing.js";
import { makeSurfaceSampler, makeHeightSampler } from "../docs/js/campus-terrain.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(p, "utf8"));

const shippedDoc = read(join(root, "docs/data/campus-photo-detail.json"));
/* PHOTO_DETAIL WINS OVER EVERYTHING — it is how a repair agent or a mutation
   run points the whole suite at one document, and a fallback that silently
   outranked it would make every such run vacuous. It takes either shape: a
   full photo-detail doc, or a bare section. */
const override = process.env.PHOTO_DETAIL ? read(process.env.PHOTO_DETAIL) : null;
const section = override ? (override.hdhadmin ?? override) : shippedDoc.hdhadmin;
assert.ok(section && section.measured,
  "no hdhadmin section: neither PHOTO_DETAIL nor a shipped doc key");

const campus = read(join(root, "docs/data/campus-3d.json"));
const lidar = read(join(root, "docs/data/campus-lidar.json"));
const arcgis = read(join(root, "docs/data/campus-arcgis.json"));
const manifest = read(join(root, "docs/data/textures/manifest.json"));
const moduleSrc = readFileSync(join(root, "docs/js/campus-photo-hdhadmin.js"), "utf8");
/* Gates that grep for forbidden constructs run on the CODE, not the prose. */
const moduleCode = moduleSrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/[^\n]*$/gm, "");

const MASSING_INDEX = 144;
const MASS = arcgis.massing[MASSING_INDEX];
const ringRaw = MASS.r[0].map(([x, z]) => [x / 10, z / 10]);
const ring = (() => {
  const r = ringRaw.slice();
  while (r.length > 2 && r[r.length - 1][0] === r[r.length - 2][0] &&
    r[r.length - 1][1] === r[r.length - 2][1]) r.pop();
  return r;
})();
const ringOpen = ring.slice(0, -1);

const drawnGround = makeSurfaceSampler(lidar.terrain);
const heightSampler = makeHeightSampler(lidar.terrain).heightAt;

const near = (a, b, eps, what) =>
  assert.ok(typeof a === "number" && Math.abs(a - b) <= eps, `${what}: ${a} vs ${b} (tolerance ${eps})`);
const at = (o, path) => path.split(".").reduce((v, k) => (v == null ? v : v[k]), o);
const seg = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const inRing = (x, z, r) => {
  let ins = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, zi] = r[i];
    const [xj, zj] = r[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
};

const R = section.derivations.readings;
const SYS = section.system;
/** colorSources values are strings or natsci-style {source, tier, extends} objects. */
const srcLine = (v) => (typeof v === "string" ? v : v.source);

/* --------------------------------------------------------- the apparatus */

test("the section carries the whole ultra apparatus", () => {
  for (const k of ["label", "epoch", "note", "confidence", "seed", "bounds", "boundsNote",
    "names", "address", "centroid", "credits", "sources", "measured", "derivations",
    "estimates", "reads", "draw", "system", "facades", "facadeSystems", "roof", "ground",
    "colors", "colorSources", "colorNote", "counts", "conflicts", "supersedes",
    "supersededNote", "superseded", "absent"]) {
    assert.ok(section[k] !== undefined, `section is missing ${k}`);
  }
  assert.equal(typeof section.seed, "number");
});

test("it says what it is: a 2009 Studio E building, a penthouse, an overshooting prism", () => {
  assert.match(section.label, /Studio E/);
  assert.match(section.label, /2009/);
  assert.match(section.label, /PENTHOUSE/i, "the penthouse is the silhouette and belongs in the label");
  assert.match(section.label, /NOT 1960s Revelle fabric/i,
    "the one thing an agent in a hurry gets wrong here is extending a Revelle 1960s pattern onto a 2009 building");
  assert.match(section.label, /skipGis/, "the massing retirement main must wire belongs in the label");
  assert.match(section.epoch, /NO epoch break/i,
    "this section's unusual fact is that its five epochs agree; say so rather than hunting a conflict");
  assert.match(section.note, /INVENTED/, "the note must declare the class");
  assert.ok(section.confidence.length > 400, "the confidence statement must be per-claim, not a word");
  assert.match(section.confidence, /49 ?%|HALVED/i,
    "the confidence statement must state that half the perimeter is estimated — it is this section's biggest weakness");
});

test("every source is described and dated, and the ladder's rungs are all named", () => {
  assert.ok(section.sources.length >= 14, `only ${section.sources.length} sources`);
  for (const s of section.sources) {
    assert.ok(s.length >= 100, `source is not described: ${s.slice(0, 70)}`);
    assert.match(s, /\b(19|20)\d\d\b/, `source has no date: ${s.slice(0, 70)}`);
  }
  const joined = section.sources.join("\n");
  for (const [what, re] of [
    ["Studio E's own project page", /studioearchitects\.com\/work/],
    ["the SECTION sheet with its printed scale bar", /UCSD-Housing-D-17/],
    ["the SITE PLAN that settles identity and CANNOT be georeferenced", /UCSD-Housing-D-18/],
    ["ArchDaily", /archdaily\.com\/130992/],
    ["the load-bearing 2010 south-west frame", /archdaily_hdh-10/],
    ["the 2010 west elevation", /archdaily_hdh-6/],
    ["the published floor plans", /archdaily_hdh-11/],
    ["Swinerton, the builder", /swinerton\.com/],
    ["SDAF Open House 2025, the newest epoch", /sdarchitecture\.org/],
    ["the survey ring", /massing\[144\]/],
    ["the OSM witness", /buildings\[410\]/],
    ["the LiDAR probe", /CA_SanDiegoQL2_2014/],
    ["the 2026 ortho, both chunks", /chunk_3_6\.jpg/],
    ["the Street View rung, searched and still OPEN", /Street View/i],
  ]) assert.match(joined, re, `sources[] no longer cites ${what}`);
  /* The site plan is cited AND disqualified as a position source in the same
     breath; losing the disqualification is how a schematic becomes a survey. */
  assert.match(joined, /NO scale bar|carries NO scale/,
    "the site plan's citation must carry the reason it cannot georeference anything");
});

/* ---------------------------------------------------------- the arithmetic */

test("every drawn figure is the arithmetic its own readings give", () => {
  const IN = R.units.inch;
  /* Recomputed HERE from the readings alone — never from the section's own
     stated values — so a self-consistent fabrication cannot pass. */
  const pxPerM = (R.section.scaleTick2 - R.section.scaleTick0) / 2 / (R.section.scaleTickFeet * R.units.foot);
  const roofToL4 = (R.section.slabL4Px - R.section.slabRoofPx) / pxPerM;
  const l4ToL3 = (R.section.slabL3Px - R.section.slabL4Px) / pxPerM;
  const l3ToL2 = (R.section.slabL2Px - R.section.slabL3Px) / pxPerM;
  const l2ToL1 = (R.section.slabL1Px - R.section.slabL2Px) / pxPerM;
  const stack = (R.section.slabL1Px - R.section.slabRoofPx) / pxPerM;
  const buildUp = section.reads["system.plate.roofBuildUp"].value;
  const l1 = R.lidar.plate - buildUp - stack;
  const l2 = l1 + l2ToL1;
  const l3 = l2 + l3ToL2;
  const l4 = l3 + l4ToL3;
  const prismTop = section.reads["roof.prism.top"].value;
  const parapetN = R.lidar.plate - R.lidar.gradeNorth;
  const orthoDz = ((R.ortho.northApparentZ - R.ortho.northTrueZ) +
    (R.ortho.southApparentZ - R.ortho.southTrueZ)) / 2;
  const mullions = section.estimates["roof.penthouse.mullionsPerBay"].value;

  const expect = {
    "system.section.pxPerMetre": pxPerM,
    "system.storeys.roofToL4": roofToL4,
    "system.storeys.l4ToL3": l4ToL3,
    "system.storeys.l3ToL2": l3ToL2,
    "system.storeys.l2ToL1": l2ToL1,
    "system.storeys.kitchenToRoofSlab": stack,
    "system.storeys.l1FinishedFloor": l1,
    "system.storeys.l2FinishedFloor": l2,
    "system.storeys.l3FinishedFloor": l3,
    "system.storeys.l4FinishedFloor": l4,
    "system.storeys.roofSlab": l4 + roofToL4,
    "system.parapet.aboveNorthGrade": parapetN,
    "system.parapet.aboveSouthGrade": R.lidar.plate - R.lidar.gradeSouth,
    "system.parapet.aboveWestGrade": R.lidar.plate - R.lidar.gradeWest,
    "system.parapet.aboveEastGrade": R.lidar.plate - R.lidar.gradeEast,
    "system.storeyPitchMean": parapetN / R.survey.levels,
    "system.areaCheck.levels": (R.published.gsf * R.units.sqft) / R.survey.ringArea,
    "roof.prism.overshoot": prismTop - R.lidar.plate,
    "roof.prism.belowHighestRidge": prismTop - R.lidar.ringEdgeTop,
    "roof.penthouse.bays.0.fallSlope": (R.lidar.ridge1Top - R.lidar.valley1Top) / (R.lidar.valley1X - R.lidar.ridge1X),
    "roof.penthouse.bays.1.fallSlope": (R.lidar.ridge2Top - R.lidar.valley2Top) / (R.lidar.valley2X - R.lidar.ridge2X),
    "roof.penthouse.bays.2.riseSlope": (R.lidar.ringEdgeTop - R.lidar.valley2Top) / (R.lidar.ringEdgeX - R.lidar.valley2X),
    "roof.penthouse.bays.0.riseSlope": (R.lidar.ridge1Top - R.lidar.penthouseWestTop) / (R.lidar.ridge1X - R.lidar.penthouseWestX),
    "roof.penthouse.bays.1.riseSlope": (R.lidar.ridge2Top - R.lidar.valley1Top) / (R.lidar.ridge2X - R.lidar.valley1X),
    "roof.penthouse.bays.2.mullions": Math.round(mullions *
      ((R.lidar.ringEdgeX - R.lidar.bay2X1) / (R.lidar.bay1X1 - R.lidar.penthouseWestX))),
    "roof.penthouse.maxAbovePlate": R.lidar.ringEdgeTop - R.lidar.plate,
    "roof.penthouse.ridge2AbovePlate": R.lidar.ridge2Top - R.lidar.plate,
    "roof.penthouse.length": R.lidar.ringEdgeX - R.lidar.penthouseWestX,
    "roof.penthouse.depth": R.lidar.penthouseZ1 - R.lidar.penthouseZ0,
    "roof.westVolume.x0": Math.max(R.lidar.westVolumeReadX0, R.survey.ringWestX),
    "roof.westVolume.abovePlateWest": R.lidar.westVolumeTopWest - R.lidar.plate,
    "roof.westVolume.abovePlateEast": R.lidar.westVolumeTopEast - R.lidar.plate,
    "roof.nwLow.abovePlate": R.lidar.nwLowTop - R.lidar.plate,
    "ground.ortho.dz": orthoDz,
    "ground.ortho.ratePerMetre": orthoDz / parapetN,
    "ground.ortho.impliedHeight": -orthoDz / -R.ortho.argoRateZ,
    "system.gallery.clear": R.code.corridorClearIn * IN,
    "system.gallery.projection": R.code.corridorClearIn * IN + section.estimates["system.gallery.beamThickness"].value,
    "system.door.width": R.code.doorLeafIn * IN,
    "system.door.height": R.code.doorHeightIn * IN,
    "system.guard.height": R.code.guardHeightIn * IN,
    "system.guard.meshClear": R.code.guardSphereIn * IN,
    "system.veil.height": l4 + roofToL4 - l2,
    "system.canopy.soffit": l4 + roofToL4 - section.estimates["system.canopy.depth"].value,
  };

  const figures = section.derivations.figures;
  assert.deepEqual(Object.keys(figures).sort(), Object.keys(expect).sort(),
    "the derivation table and this test's independent recomputation must cover the same figures");
  for (const [path, want] of Object.entries(expect)) {
    const decl = figures[path];
    assert.ok(decl && decl.expr, `${path} has no stated derivation`);
    assert.ok(decl.derivation && decl.derivation.length > 40, `${path} lost the prose behind its expr`);
    near(decl.value, want, 5e-6, `${path}: the section STATES ${decl.value}, its own readings give`);
    near(at(section, path), want, 5e-6, `${path}: the section SHIPS ${at(section, path)}, its own readings give`);
  }

  /* THE STACK CLOSES ON THE MEASURED PLATE WITH ZERO RESIDUAL, which is the
     whole point of hanging it off the laser rather than off the prism. */
  near(SYS.storeys.roofSlab + buildUp, R.lidar.plate, 1e-9,
    "the four drawn storeys plus the build-up do not close on the measured roof plate");
  /* Five shipped figures, each stated to six decimals, so the sum carries five
     roundings — the tolerance is the format's, not the arithmetic's. */
  near(SYS.storeys.l1FinishedFloor + SYS.storeys.l2ToL1 + SYS.storeys.l3ToL2 +
    SYS.storeys.l4ToL3 + SYS.storeys.roofToL4, SYS.storeys.roofSlab, 5e-6, "the storey stack");
  /* THE TWO SOURCES AGREE, and the residual is the whole of the agreement.
     The 2009 drawing's kitchen-floor-to-roof-slab stack is 15.33 m; the 2014
     laser's parapet over the north grade is 15.79 m. The 0.46 m between them
     is slab, roof build-up and the plate's height over the kitchen floor —
     one storey's worth of construction, not a disagreement. If that gap ever
     opens past 0.7 m, one of the two has moved and the section's central
     claim is gone. */
  const residual = SYS.parapet.aboveNorthGrade - stack;
  assert.ok(residual > 0 && residual < 0.7,
    `the drawing and the laser are ${residual.toFixed(2)} m apart — that is no longer a slab and a build-up`);
  /* The arcgis 4.275 m module is a FORMULA artefact and must never become a
     dimension: the measured pitch is nowhere near it. */
  assert.ok(Math.abs(SYS.storeyPitchMean - R.survey.formulaHeight / R.survey.levels) > 0.2,
    "the measured storey pitch has drifted onto the arcgis 4.275 m formula artefact");
  assert.ok(Math.abs(stack / R.survey.levels - R.survey.formulaHeight / R.survey.levels) > 0.2,
    "the drawn mean storey has drifted onto the same formula artefact");
});

test("the mechanical penthouse recomputes, and its two rising limbs agree", () => {
  const P = section.roof.penthouse;
  /* The profile IS the laser's six control points, in order, west to east. */
  assert.deepEqual(P.profile.map((p) => [p.x, p.y]), [
    [R.lidar.penthouseWestX, R.lidar.penthouseWestTop],
    [R.lidar.ridge1X, R.lidar.ridge1Top],
    [R.lidar.valley1X, R.lidar.valley1Top],
    [R.lidar.ridge2X, R.lidar.ridge2Top],
    [R.lidar.valley2X, R.lidar.valley2Top],
    [R.lidar.ringEdgeX, R.lidar.ringEdgeTop],
  ], "the pleat is not the laser's own profile");
  assert.deepEqual(P.profile.map((p) => p.kind),
    ["westFace", "ridge", "valley", "ridge", "valley", "cutByRing"],
    "three ridges and two valleys, and the last point is CUT BY THE RING, not a ridge");
  for (let i = 1; i < P.profile.length; i++) {
    assert.ok(P.profile[i].x > P.profile[i - 1].x, "the profile must run west to east and never double back");
  }
  /* Every bay falls WEST to EAST — the pleat's direction, not its shape. */
  assert.ok(P.bays[0].fallSlope > 0 && P.bays[1].fallSlope > 0,
    "a bay's shallow limb must fall eastward");
  assert.ok(P.bays[0].riseSlope > P.bays[0].fallSlope,
    "bay 1's west limb must be the STEEP one");
  assert.ok(P.bays[1].riseSlope > P.bays[1].fallSlope, "bay 2's west limb must be the steep one");
  /* THE COINCIDENCE NOBODY FITTED: two independently binned rising limbs of
     one manufactured screen return the same pitch. If this stops holding, a
     control point has been moved. */
  const rel = Math.abs(P.bays[0].riseSlope - P.bays[1].riseSlope) / P.bays[1].riseSlope;
  assert.ok(rel < 0.01,
    `the two rising limbs disagree by ${(100 * rel).toFixed(2)} % — they measured 0.18 % apart`);
  /* Bay 3 is CUT and must not be completed into a symmetric tooth. */
  assert.equal(P.bays[2].fallSlope, null, "bay 3 has been given a falling limb the laser never saw");
  near(P.bays[2].x1, R.lidar.ringEdgeX, 1e-9, "bay 3 must stop at the survey ring");
  assert.ok(P.bays[2].mullions < P.bays[0].mullions, "the truncated bay must not wear a full bay's frame");
  /* The bays tile the pleat exactly, with no gap and no overlap. */
  near(P.bays[0].x0, P.profile[0].x, 1e-9, "the bays do not start at the penthouse's west face");
  for (let i = 1; i < P.bays.length; i++) {
    near(P.bays[i].x0, P.bays[i - 1].x1, 1e-9, "the penthouse bays do not tile");
  }
  /* Blade DIRECTION is sourced now; PITCH is still an estimate, and the two
     must not be allowed to swap tiers. */
  assert.equal(P.bladeDirection, "horizontal");
  assert.match(P.bladeDirectionSource, /^\[sourced\]/);
  assert.match(P.bladeDirectionSource, /archdaily_hdh-10/);
  assert.ok(section.estimates["roof.penthouse.bladePitch"], "the blade PITCH must stay an estimate");
  assert.match(P.openNote, /laser|p10/i, "the open-screen claim must rest on the laser, not on the eye");
});

test("the ORTHO independently returns this building's height, and the SECTION sheet independently returns its pleat", () => {
  /* Leg 1: the ortho's own top-displacement geometry, with Argo's rate. */
  near(section.ground.ortho.impliedHeight, SYS.parapet.aboveNorthGrade, 0.3,
    "the ortho's displacement-derived height no longer agrees with the laser's parapet");
  /* And the rate this building returns corroborates the one Argo recorded. */
  near(Math.abs(section.ground.ortho.ratePerMetre), Math.abs(R.ortho.argoRateZ), 0.005,
    "the two buildings' ortho z-displacement rates have diverged");
  /* Leg 2: the section sheet's own scale bar against the laser's. The dossier
     fits section px to world x on the two clear ridges: 240 px over 12.5 m =
     19.2 px/m, against the sheet's printed 19.439. Recomputed here. */
  const fitted = (R.section.ridge2Px - R.section.ridge1Px) / (R.lidar.ridge2X - R.lidar.ridge1X);
  const printed = SYS.section.pxPerMetre;
  assert.ok(Math.abs(fitted - printed) / printed < 0.02,
    `the laser-fitted scale ${fitted.toFixed(2)} and the sheet's printed scale ${printed.toFixed(2)} differ by more than 2 %`);
  /* And valley 2, which was NOT used in the fit, lands on the laser's valley 2
     to well under a metre — the check that makes the registration a
     measurement rather than a two-point fit. */
  const worldOf = (px) => R.lidar.ridge1X + (px - R.section.ridge1Px) / fitted;
  near(worldOf(R.section.valley2Px), R.lidar.valley2X, 0.7,
    "the section sheet's valley 2 no longer lands on the laser's — the registration is gone");
  /* Leg 3: the section's drawn heights above its own roof slab against the
     laser's heights above the plate, at the same three features. */
  const buildUp = section.reads["system.plate.roofBuildUp"].value;
  for (const [drawn, measured, what] of [
    [R.section.ridge1AboveSlab, R.lidar.ridge1Top - R.lidar.plate, "ridge 1"],
    [R.section.ridge2AboveSlab, R.lidar.ridge2Top - R.lidar.plate, "ridge 2"],
    [R.section.valley2AboveSlab, R.lidar.valley2Top - R.lidar.plate, "valley 2"],
  ]) {
    near(Math.abs(drawn - measured - buildUp), 0, 0.25,
      `${what}: the 2009 drawing and the 2014 laser have drifted apart past the +/-0.22 m the residual allows`);
  }
});

/* ------------------------------------------------------- S1: the axiom layer */

const SEC17 = "studioe_UCSD-Housing-D-17.jpg, Studio E's published SECTION sheet, 2009, read in source pixels";
const EPT = "the full-depth EPT probe of CA_SanDiegoQL2_2014 over x -215..-135 / z 350..415, 17 tiles / 30,686 returns, repo = elevation - datum 102.4";
const ORTHO = "docs/data/textures/chunk_3_6.jpg + chunk_4_6.jpg, the Google (c)2026 z20 ortho at 8 px/m, generated 2026-08-04";
const IBC = "IBC 2021 / ICC A117.1, the same clauses campus-photo-argo.js's section cites";
const pin = (value, truth, tol) => ({ value, truth, ...(tol === undefined ? {} : { tol }) });

const READING_PINS = {
  "units.inch": pin(0.0254, "the international inch, 25.4 mm exactly by definition"),
  "units.foot": pin(0.3048, "the international foot, 12 inches exactly by definition"),
  "units.sqft": pin(0.09290304, "the international square foot, 0.3048^2 exactly by definition"),

  "section.scaleTick0": pin(780.0, `${SEC17} — the first tick centre of the sheet's own printed scale bar`),
  "section.scaleTick1": pin(839.0, `${SEC17} — the second tick centre`),
  "section.scaleTick2": pin(898.5, `${SEC17} — the third tick centre`),
  "section.scaleTickFeet": pin(10, `${SEC17} — the bar's own printed interval, 10 ft`),
  "section.slabRoofPx": pin(351, `${SEC17} — the L4 roof slab band`),
  "section.slabL4Px": pin(427.5, `${SEC17} — the level-4 SUPPORT slab band`),
  "section.slabL3Px": pin(502, `${SEC17} — the unlabelled level-3 slab band`),
  "section.slabL2Px": pin(576.5, `${SEC17} — the level-2 OPEN OFFICE slab band`),
  "section.slabL1Px": pin(649, `${SEC17} — the CATERING KITCHEN FLOOR slab band`),
  "section.ridge1Px": pin(475, `${SEC17} — the first drawn penthouse ridge, one of the two registration points`),
  "section.ridge2Px": pin(715, `${SEC17} — the second drawn penthouse ridge, the other registration point`),
  "section.valley2Px": pin(945, `${SEC17} — the second drawn valley, NOT used in the fit and so the check on it`),
  "section.ridge1AboveSlab": pin(4.27, `${SEC17} — ridge 1's drawn height over the L4 roof-slab centreline`),
  "section.ridge2AboveSlab": pin(4.73, `${SEC17} — ridge 2's drawn height over the same datum`),
  "section.valley2AboveSlab": pin(3.70, `${SEC17} — valley 2's drawn height over the same datum`),

  "lidar.datum": pin(102.4, "docs/data/campus-lidar.json `datum`"),
  "lidar.plateNorthP50": pin(38.15, `${EPT} — the north band x -194..-153 / z 370..378, n 1866`),
  "lidar.plateSouthP50": pin(38.26, `${EPT} — the south strip x -184..-155 / z 392..394, n 374`),
  "lidar.plate": pin(38.20, `${EPT} — the main roof plate over both penthouse-free zones, 2,240 returns, one plane to 0.02-0.15 m`),
  "lidar.gradeNorth": pin(22.41, `${EPT} — class-2 median, north band z 360..368.5, n 706`),
  "lidar.gradeSouth": pin(22.48, `${EPT} — class-2 median, south band z 396..404, n 598`),
  "lidar.gradeEast": pin(23.28, `${EPT} — class-2 median, east band x -151..-144, n 146`),
  "lidar.gradeWest": pin(21.97, `${EPT} — class-2 median, west band x -204..-197, n 357`),
  "lidar.penthouseZ0": pin(379.5, `${EPT} — the penthouse's north edge off the 1 m max-height raster`),
  "lidar.penthouseZ1": pin(391.5, `${EPT} — the penthouse's south edge off the same raster`),
  "lidar.penthouseWestX": pin(-184.5, `${EPT} — the penthouse's west face`),
  "lidar.penthouseWestTop": pin(40.76, `${EPT} — p98 in the 1 m bin at x -184, where the west face begins`),
  "lidar.bay1X1": pin(-172.5, `${EPT} — bay 1 / bay 2 boundary off the 1 m raster`),
  "lidar.bay2X1": pin(-156.5, `${EPT} — bay 2 / bay 3 boundary off the same raster`),
  "lidar.ridge1X": pin(-181.5, `${EPT} — RIDGE 1, fitted between the 42.15 / 42.14 bins at x -182 and -181`),
  "lidar.ridge1Top": pin(42.15, `${EPT} — p98 at ridge 1, +3.95 over the plate`),
  "lidar.valley1X": pin(-173.0, `${EPT} — VALLEY 1`),
  "lidar.valley1Top": pin(40.81, `${EPT} — p98 at valley 1, +2.61 over the plate`),
  "lidar.ridge2X": pin(-169.0, `${EPT} — RIDGE 2, the tallest resolved ridge`),
  "lidar.ridge2Top": pin(42.66, `${EPT} — p98 at ridge 2, +4.46 over the plate`),
  "lidar.valley2X": pin(-157.0, `${EPT} — VALLEY 2, the feature the section sheet lands on to 0.0 m`),
  "lidar.valley2Top": pin(41.72, `${EPT} — p98 at valley 2, +3.52 over the plate`),
  "lidar.ringEdgeX": pin(-151.7, `${EPT} — the survey ring's east edge, which CUTS bay 3 mid-climb`),
  "lidar.ringEdgeTop": pin(42.69, `${EPT} — p98 at x -151, the tallest point on this roof, +4.49 over the plate`),
  "lidar.westVolumeReadX0": pin(-196.5, `${EPT} — the west volume's RAW west extent, 0.5 m outside the survey ring; a declared conflict`),
  "lidar.westVolumeX1": pin(-184.5, `${EPT} — the west volume's east face`),
  "lidar.westVolumeZ0": pin(380.0, `${EPT} — the west volume's north edge`),
  "lidar.westVolumeZ1": pin(391.5, `${EPT} — the west volume's south edge`),
  "lidar.westVolumeTopWest": pin(40.38, `${EPT} — its flat top at the west end`),
  "lidar.westVolumeTopEast": pin(40.57, `${EPT} — and at the east end, a 1.6 % fall`),
  "lidar.nwLowX0": pin(-194.0, `${EPT} — the north-west low element's west edge`),
  "lidar.nwLowX1": pin(-187.0, `${EPT} — its east edge`),
  "lidar.nwLowZ0": pin(369.5, `${EPT} — its north edge`),
  "lidar.nwLowZ1": pin(379.0, `${EPT} — its south edge`),
  "lidar.nwLowTop": pin(38.78, `${EPT} — its top, from a 38.73-38.83 read, i.e. 0.58 m over the plate`),
  "lidar.treeRowX0": pin(-184.0, `${EPT} — the west end of the measured-but-unlisted south return band`),
  "lidar.treeRowX1": pin(-155.0, `${EPT} — its east end`),
  "lidar.treeRowZ0": pin(394.6, `${EPT} — its north edge, 0.2 m off the surveyed south wall`),
  "lidar.treeRowZ1": pin(400.5, `${EPT} — its south edge, including the 97 further returns`),
  "lidar.treeRowCrownLo": pin(25.2, `${EPT} — the band's lower return height, 2.7 m over the south grade`),
  "lidar.treeRowCrownHi": pin(26.6, `${EPT} — its upper return height, 4.1 m over the south grade`),
  "lidar.treeRowReturns": pin(254, `${EPT} — the return COUNT in x -184..-155 / z 394.6..397.5, none of which became a lidar.trees entry`),

  "survey.massHeight": pin(19.4, "docs/data/campus-lidar.json massHeights['m:-175,382'] — what campus-massing.js extrudes"),
  "survey.ringHeight": pin(19.8, "docs/data/campus-lidar.json heights['Housing Dining and Hospitality Administration Building']"),
  "survey.formulaHeight": pin(17.1, "docs/data/campus-arcgis.json massing[144].h, a FORMULA of 4 levels x 4.275 m"),
  "survey.levels": pin(4, "docs/data/campus-arcgis.json massing[144].levels"),
  "survey.osmHeight": pin(15.6, "docs/data/campus-3d.json buildings[410].h, a mapper's tag"),
  "survey.ringArea": pin(1037.78, "the shoelace area of arcgis.massing[144] ring 0 at /10, recomputed in this suite", 0.01),
  "survey.ringPerimeter": pin(138.767598, "the perimeter of the same ring, recomputed in this suite", 0.01),
  "survey.ringWestX": pin(-196.0, "the survey ring's own west wall for the z 380.6-391.5 band, arcgis.massing[144]"),
  "survey.ringSouthZ": pin(394.4, "the survey ring's own south wall along the 33.7 m gallery face"),

  "published.gsf": pin(43400, "Studio E's project page and ArchDaily both: 43,400 ft2 gross"),
  "published.projectYear": pin(2009, "ArchDaily's Project Year field, corroborated by all three awards being dated 2010"),
  "published.awardsYear": pin(2010, "studioearchitects.com/awards — Orchid, Divine Detail and California Construction, all 2010"),
  "published.kitchenStudioE": pin(13000, "Studio E's project page: a 13,000 ft2 catering kitchen — HALF of a declared conflict"),
  "published.kitchenArchDaily": pin(8000, "ArchDaily and the SDAF 2025 listing: 8,000 SF — the other half of that conflict"),

  "ortho.pxPerM": pin(8, `${ORTHO} — 2040 px over 255 m, from docs/data/textures/manifest.json`),
  "ortho.northApparentZ": pin(366.32, `${ORTHO} — the roof's apparent north edge, bright-plate edge detection at threshold 195, mean over 11 columns`),
  "ortho.southApparentZ": pin(391.20, `${ORTHO} — its apparent south edge, same method`),
  "ortho.eastApparentX": pin(-151.20, `${ORTHO} — its apparent east edge, mean over 8 rows`),
  "ortho.northTrueZ": pin(369.5, "the survey ring's true north edge, arcgis.massing[144]"),
  "ortho.southTrueZ": pin(394.3, "the survey ring's true south edge over the sampled span"),
  "ortho.eastTrueX": pin(-151.7, "the survey ring's true east edge"),
  "ortho.argoRateZ": pin(-0.196, "Argo's independently recorded z-displacement rate for the same 2026 capture, revelle-recon.md rung-5 item 24"),

  "code.corridorClearIn": pin(44, `${IBC} §1020.3, corridor minimum clear width 44 in`),
  "code.guardHeightIn": pin(42, `${IBC} §1015.3, guards not less than 42 in high`),
  "code.guardSphereIn": pin(4, `${IBC} §1015.4, no opening passing a 4 in sphere`),
  "code.doorLeafIn": pin(36, `${IBC} §1010.1.1, door leaves 36 in wide minimum`),
  "code.doorHeightIn": pin(80, `${IBC} §1010.1.1, door leaves 80 in high minimum`),
};

const DRAW_PINS = {
  wallOffset: pin(0.04, "the depth an applied band stands off the surveyed face so it resolves without z-fighting; must stay under bandThickness"),
  bandThickness: pin(0.08, "the thickness every applied wall band is drawn at"),
  glassOffset: pin(0.03, "glazing sits this far in front of the band plane so the two never co-plane"),
  glassInset: pin(0.06, "the glazing is inset this far from its opening's jambs"),
  jointWidth: pin(0.03, "the drawn width of a board-formed panel joint groove"),
  jointDepth: pin(0.02, "the drawn depth of that groove, shallower than it is wide"),
  skirtDrop: pin(0.6, "how far a ground-meeting wall is skirted BELOW the drawn surface so no terrain triangle shows at its foot"),
  footingDrop: pin(0.2, "the same idea for a stair tread: its footing continues below the drawn surface"),
  plateInset: pin(0.05, "the roof plate cap is clipped this far inside the survey ring so it never shows past the wall skin"),
  membraneLift: pin(0.02, "the plate's membrane sits this far above the cap — a decal lift, not a build-up"),
  screenInset: pin(0.06, "the penthouse louvre screen stands this far inside its own frame line"),
  mullionSection: pin(0.09, "the drawn square section of a penthouse frame mullion"),
  railSection: pin(0.05, "the drawn square section of a guard rail bar"),
  postSection: pin(0.07, "the drawn square section of a guard post, larger than the rail it carries"),
  meshPanelInset: pin(0.08, "the mesh infill panel is inset this far inside its guard frame on every side"),
  soffitThickness: pin(0.12, "the drawn thickness of a canopy or gallery soffit plane"),
  panelGap: pin(0.04, "the gap between adjacent veil panels so the assembly reads as separate hung sheets"),
  slatSection: pin(0.05, "the drawn square section of one slat in the base's vertical-slat gate"),
  stairSlab: pin(0.16, "the drawn thickness of a stair tread slab"),
  cellMetres: pin(1.6, "the cell size the measured tree-row band is laid in, so it follows rolling ground"),
  groundSamples: pin(6, "how many points along a wall run the builder samples the drawn surface at"),
  boardNormalScale: pin(0.9, "relief scale for the board-formed concrete class — art direction on cost, not a dimension"),
  seamNormalScale: pin(0.8, "relief scale for the seamed metal panel class — art direction on cost, not a dimension"),
  "tiles.boardMetres": pin(0.30, "metres of wall per board-formed texture tile, one form-board course"),
  "tiles.seamMetres": pin(0.45, "metres of wall per metal-panel texture tile, one flat-lock seam pitch"),
  "tiles.paveMetres": pin(0.9, "metres per paving texture tile on the ramp and stair"),
  "tiles.meshMetres": pin(0.12, "metres per mesh texture tile on the gallery guards"),
  "tiles.foliageMetres": pin(1.6, "metres per foliage texture tile on the south tree row"),
};

/* Every number in a DRAWN block that is neither derived, estimated nor read is
   a MIRROR of one that is, or a value copied verbatim from a shipped survey.
   Both are named exhaustively here, so a new bare number cannot appear in
   `system`, `roof` or `ground` without this file noticing. */
const MIRRORS = {
  "system.storeys.count": "r:survey.levels",
  "system.gallery.levels.0": "f:system.storeys.l2FinishedFloor",
  "system.gallery.levels.1": "f:system.storeys.l3FinishedFloor",
  "system.gallery.levels.2": "f:system.storeys.l4FinishedFloor",
  "roof.plate.y": "r:lidar.plate",
  "roof.nwLow.x0": "r:lidar.nwLowX0",
  "roof.nwLow.x1": "r:lidar.nwLowX1",
  "roof.nwLow.z0": "r:lidar.nwLowZ0",
  "roof.nwLow.z1": "r:lidar.nwLowZ1",
  "roof.nwLow.top": "r:lidar.nwLowTop",
  "roof.westVolume.x1": "r:lidar.westVolumeX1",
  "roof.westVolume.z0": "r:lidar.westVolumeZ0",
  "roof.westVolume.z1": "r:lidar.westVolumeZ1",
  "roof.westVolume.topWest": "r:lidar.westVolumeTopWest",
  "roof.westVolume.topEast": "r:lidar.westVolumeTopEast",
  "roof.westVolume.readX0": "r:lidar.westVolumeReadX0",
  "roof.penthouse.z0": "r:lidar.penthouseZ0",
  "roof.penthouse.z1": "r:lidar.penthouseZ1",
  "roof.penthouse.profile.0.x": "r:lidar.penthouseWestX",
  "roof.penthouse.profile.0.y": "r:lidar.penthouseWestTop",
  "roof.penthouse.profile.1.x": "r:lidar.ridge1X",
  "roof.penthouse.profile.1.y": "r:lidar.ridge1Top",
  "roof.penthouse.profile.2.x": "r:lidar.valley1X",
  "roof.penthouse.profile.2.y": "r:lidar.valley1Top",
  "roof.penthouse.profile.3.x": "r:lidar.ridge2X",
  "roof.penthouse.profile.3.y": "r:lidar.ridge2Top",
  "roof.penthouse.profile.4.x": "r:lidar.valley2X",
  "roof.penthouse.profile.4.y": "r:lidar.valley2Top",
  "roof.penthouse.profile.5.x": "r:lidar.ringEdgeX",
  "roof.penthouse.profile.5.y": "r:lidar.ringEdgeTop",
  "roof.penthouse.bays.0.x0": "r:lidar.penthouseWestX",
  "roof.penthouse.bays.0.x1": "r:lidar.bay1X1",
  "roof.penthouse.bays.0.mullions": "e:roof.penthouse.mullionsPerBay",
  "roof.penthouse.bays.1.x0": "r:lidar.bay1X1",
  "roof.penthouse.bays.1.x1": "r:lidar.bay2X1",
  "roof.penthouse.bays.1.mullions": "e:roof.penthouse.mullionsPerBay",
  "roof.penthouse.bays.2.x0": "r:lidar.bay2X1",
  "roof.penthouse.bays.2.x1": "r:lidar.ringEdgeX",
  "roof.penthouse.mullionsPerBay": "e:roof.penthouse.mullionsPerBay",
  "ground.treeRow.x0": "r:lidar.treeRowX0",
  "ground.treeRow.x1": "r:lidar.treeRowX1",
  "ground.treeRow.z0": "r:lidar.treeRowZ0",
  "ground.treeRow.z1": "r:lidar.treeRowZ1",
  "ground.treeRow.returns": "r:lidar.treeRowReturns",
  "measured.grades.north": "r:lidar.gradeNorth",
  "measured.grades.south": "r:lidar.gradeSouth",
  "measured.grades.east": "r:lidar.gradeEast",
  "measured.grades.west": "r:lidar.gradeWest",
};
/* Paths whose value is copied verbatim from a shipped survey file. Each is
   asserted against that file directly, in the survey test below. */
const SURVEY_PATHS = /^ground\.rings\.\d+\.(index|bbox\.[xz][01])$|^ground\.lidarTrees\.\d+\.\d$|^(system|ground)\.stair\.ringIndex$/;

test("S1(i): no number anywhere in the axiom layer or the drawn blocks is uncovered", () => {
  const derived = new Set(Object.keys(section.derivations.figures));
  const est = section.estimates;
  const reads = section.reads;
  const classify = (path) => {
    if (path.startsWith("derivations.readings.")) {
      return READING_PINS[path.slice("derivations.readings.".length)] ? "pinned" : null;
    }
    if (path.startsWith("draw.")) return DRAW_PINS[path.slice("draw.".length)] ? "pinned" : null;
    if (/^estimates\..+\.(value|band\.[01])$/.test(path)) return "banded";
    if (/^reads\..+\.(value|tolerance)$/.test(path)) return "read";
    if (derived.has(path)) return "derived";
    if (est[path]) return "estimated";
    if (reads[path]) return "read";
    if (MIRRORS[path]) return "mirror";
    if (SURVEY_PATHS.test(path)) return "survey";
    return null;
  };
  const paths = assertCoverage({
    section,
    roots: {
      "derivations.readings": {}, estimates: {}, reads: {}, draw: {},
      system: {}, roof: {}, ground: {}, "measured.grades": {},
    },
    classify,
    uncovered: {},
    minimum: 240,
    label: "hdhadmin",
  });
  assert.ok(paths.filter((p) => p.path.startsWith("draw.")).length >= 27,
    "the draw block is where a dimension hides as a render offset and it did not get walked");

  /* EVERY MIRROR MUST BE ITS ORIGIN'S VALUE — a mirror is a convenience, not
     a second opinion, and a mirror that drifts is a fabrication with a
     provenance line attached to a different number. */
  let mirrored = 0;
  for (const [path, origin] of Object.entries(MIRRORS)) {
    const got = at(section, path);
    assert.ok(typeof got === "number", `mirror ${path} no longer exists`);
    const [kind, src] = [origin.slice(0, 1), origin.slice(2)];
    const want = kind === "r" ? at(R, src)
      : kind === "f" ? section.derivations.figures[src]?.value
        : section.estimates[src]?.value;
    assert.ok(typeof want === "number", `mirror ${path} names an origin that does not exist: ${origin}`);
    near(got, want, 5e-6, `mirror ${path} has drifted off ${origin}`);
    mirrored++;
  }
  assert.equal(mirrored, Object.keys(MIRRORS).length);

  for (const [p, e] of Object.entries(est)) {
    if (p === "why") continue;
    assert.match(e.why, /\[estimated\]/, `${p} must carry the [estimated] label`);
    assert.ok(e.extends && e.extends.length > 40, `${p} must record which sourced pattern it extends`);
    near(at(section, p), e.value, 5e-6, `${p} ships a value its estimate does not state`);
  }
  for (const [p, r] of Object.entries(reads)) {
    if (p === "why") continue;
    assert.ok(r.source && r.source.length > 80, `${p} must name the frame, probe or clause it is read off`);
    assert.equal(typeof r.tolerance, "number", `${p} must carry the tolerance its source supports`);
    near(at(section, p), r.value, 5e-6, `${p} ships a value its read does not state`);
  }
  /* One number, one provenance. */
  for (const p of Object.keys(est)) {
    if (p === "why") continue;
    assert.ok(!derived.has(p) && !reads[p], `${p} claims two provenances`);
  }
});

test("S1(ii): every estimate carries a machine-readable band and ships inside it", () => {
  const n = assertEstimateBands({
    estimates: section.estimates,
    valueAt: (key) => at(section, key),
    skip: ["why"],
    label: "hdhadmin",
  });
  assert.equal(n, 36,
    "every estimate is banded and the count is declared here — the five withheld classes plus the north/east system's own figures");
  /* The acceptance mutation: the veil's panel width is the signature system's
     one unresolvable dimension and its band is the section's own published
     1.20-2.20 m, so a value outside it cannot be reached. */
  assert.deepEqual(section.estimates["system.veil.panelWidth"].band, [1.20, 2.20]);
  for (const bad of [0.8, 3.5]) {
    assert.throws(() => assertEstimateBands({
      estimates: { "system.veil.panelWidth": { ...section.estimates["system.veil.panelWidth"], value: bad } },
      valueAt: () => bad,
      label: "hdhadmin",
    }), /outside its own published band/, `system.veil.panelWidth can still reach ${bad} m`);
  }
  /* And a band may not be a place to park a value the section does not ship. */
  assert.throws(() => assertEstimateBands({
    estimates: section.estimates,
    valueAt: (k) => (k === "system.canopy.projection" ? 4.9 : at(section, k)),
    skip: ["why"], label: "hdhadmin",
  }), /ships 4\.9 but states 3/);
});

test("S1(iii): every reading with an external truth is pinned to that truth", () => {
  assert.equal(
    assertPins({
      readings: R,
      pins: READING_PINS,
      namespaces: ["units", "section", "lidar", "survey", "published", "ortho", "code"],
      label: "hdhadmin",
    }),
    Object.keys(READING_PINS).length,
  );
  assert.equal(
    assertPins({ readings: section.draw, pins: DRAW_PINS, namespaces: ["tiles"], label: "hdhadmin draw" }),
    Object.keys(DRAW_PINS).length,
  );
  /* Mutations the pins must catch. */
  assert.throws(() => assertPins({
    readings: { ...R, lidar: { ...R.lidar, plate: 42.47 } }, pins: READING_PINS, label: "hdhadmin",
  }), /lidar\.plate/, "the measured plate could be moved onto the drawn prism's top and every band would follow");
  assert.throws(() => assertPins({
    readings: { ...R, code: { ...R.code, corridorClearIn: 88 } }, pins: READING_PINS, label: "hdhadmin",
  }), /code\.corridorClearIn/);
  assert.throws(() => assertPins({
    readings: { ...section.draw, skirtDrop: 6 }, pins: DRAW_PINS, label: "hdhadmin draw",
  }), /skirtDrop/, "a render offset could be moved by a factor of ten");
  /* A new reading may not appear inside a pinned block unpinned. */
  assert.throws(() => assertPins({
    readings: { ...R, lidar: { ...R.lidar, ridge4Top: 44 } }, pins: READING_PINS,
    namespaces: ["lidar"], label: "hdhadmin",
  }), /is not pinned/);

  /* Every relation the section states in prose about its own readings. */
  const IN = R.units.inch;
  assertRelations({
    label: "hdhadmin",
    relations: [
      { name: "the foot is twelve inches", got: R.units.foot, want: 12 * IN },
      { name: "the square foot is the foot squared", got: R.units.sqft, want: R.units.foot ** 2, tol: 1e-9 },
      { name: "the scale bar's two intervals are equal to within half a pixel",
        got: (R.section.scaleTick1 - R.section.scaleTick0) - (R.section.scaleTick2 - R.section.scaleTick1),
        want: 0, tol: 0.5 },
      { name: "arcgis h 17.1 is 4 levels x the 4.275 m FORMULA module, never a height",
        got: R.survey.formulaHeight, want: R.survey.levels * 4.275, tol: 5e-6 },
      { name: "the plate lies between its own north and south band medians",
        got: R.lidar.plate, want: (R.lidar.plateNorthP50 + R.lidar.plateSouthP50) / 2, tol: 0.06 },
      { name: "the OSM tag lands within 0.2 m of the measured parapet — the recorded coincidence",
        got: R.survey.osmHeight, want: R.lidar.plate - R.lidar.gradeSouth, tol: 0.2 },
      { name: "the two p-reads BOTH swallow the penthouse: each exceeds the measured parapet by metres",
        got: R.survey.massHeight - (R.lidar.plate - R.lidar.gradeNorth), want: 3.61, tol: 0.01 },
      { name: "the tree row's crowns stand 2.7-4.1 m over the south grade",
        got: R.lidar.treeRowCrownHi - R.lidar.gradeSouth, want: 4.12, tol: 0.01 },
      { name: "the ortho is 8 px/m: 2040 px over the chunk's own 255 m span",
        got: R.ortho.pxPerM,
        want: (() => {
          const c = manifest.chunks.find((k) => k.file === "chunk_4_6.jpg");
          return c.w / (c.x1 - c.x0);
        })() },
      { name: "the shoelace area over the shipped ring reproduces survey.ringArea",
        got: (() => {
          let a = 0;
          for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
          return Math.abs(a / 2);
        })(), want: R.survey.ringArea, tol: 0.01 },
      { name: "survey.ringWestX is a vertex x the survey ring actually carries",
        got: Math.min(...ringOpen.map((p) => p[0])), want: R.survey.ringWestX, tol: 5e-6 },
    ],
  });
});

test("S1(iv): the tier gate runs BOTH ways over colours, estimates and the facade systems", () => {
  const entries = [
    ...Object.entries(section.colorSources).filter(([key]) => key !== "why")
      .map(([key, v]) => ({ key: `colorSources.${key}`, text: srcLine(v) })),
    ...Object.entries(section.estimates).filter(([k]) => k !== "why")
      .map(([key, e]) => ({ key: `estimates.${key}`, text: e.why })),
    ...Object.entries(section.facadeSystems).filter(([, v]) => v && v.source)
      .map(([key, v]) => ({ key: `facadeSystems.${key}`, text: v.source })),
    { key: "roof.penthouse.bladeDirectionSource", text: section.roof.penthouse.bladeDirectionSource },
  ];
  assertTierSymmetry({ entries, label: "hdhadmin" });
  /* A promotion must fail: an [estimated] line relabelled [sourced] because it
     cites the parent it extends. The north/east system is the one that matters
     on this building — half its perimeter rides on that label. */
  assert.throws(() => assertTierSymmetry({
    entries: [{ key: "facadeSystems.service", text: section.facadeSystems.service.source.replace("[estimated]", "[sourced]") }],
    label: "hdhadmin",
  }), /hedges/, "the north and east faces could be promoted to [sourced] on the strength of what they extend");
  assert.throws(() => assertTierSymmetry({
    entries: [{ key: "colorSources.spiderStainless", text: srcLine(section.colorSources.spiderStainless).replace("[estimated]", "[measured]") }],
    label: "hdhadmin",
  }), /hedges/);
});

const ABSENT = {
  prismOvershoot: /g1\/RESOLVED-AS-CONFLICT/,
  spotElevations: /g2 — THE FLOOR PLANS' SPOT ELEVATIONS ARE UNREADABLE/,
  northFace: /g3 — THE NORTH FACE HAS NO PHOTOGRAPH/,
  eastFace: /g4 — THE EAST FACE HAS NO PHOTOGRAPH/,
  westVolumeIdentity: /g5 — THE WEST VOLUME'S IDENTITY/,
  nwLowIdentity: /g6 — THE NORTH-WEST LOW ELEMENT/,
  bladePitch: /g7 — THE LOUVRE BLADE PITCH/,
  bayThreeCut: /g8 — BAY 3 IS CUT BY THE SURVEY RING/,
  galleryExtent: /g9 — THE GALLERY EXTENT/,
  treeRow: /g10 — THE SOUTH TREE ROW IS MEASURED BUT UNLISTED/,
  kitchenArea: /g11 — THE KITCHEN AREA/,
  nameVariance: /g12 — THE NAME VARIANCE/,
  veilModule: /g13 — THE VEIL'S PANEL MODULE/,
  parapetDeck: /g14 — NO PARAPET\/DECK SEPARATION IS CLAIMED/,
  canopyProjection: /g15 — THE CANOPY'S PROJECTION WAS NEVER PROBED/,
  rampAndStair: /g16 — THE RAMP'S LINE AND THE STAIR'S PLAN/,
  lettering: /g17 — THE BUILDING LETTERING IS RECORDED AND NEVER RENDERED/,
  eastMetalRoof: /g18 — THE EAST FACE'S METAL ROOF/,
  appleGrid: /g19 — NO REVELLE APPLE 3D STATION GRID/,
};

const absentEntries = () => section.absent.map((text) => {
  const hits = Object.entries(ABSENT).filter(([, re]) => re.test(text));
  assert.equal(hits.length, 1,
    `absent entry matches ${hits.length} known probes, not one: ${text.slice(0, 70)}`);
  return { key: hits[0][0], text };
});

test("S1(v): every absent entry is held by a stable key and a probe, and the list does not shrink", () => {
  const entries = absentEntries();
  assert.equal(assertAbsentEntries({ absent: entries, expected: ABSENT, label: "hdhadmin" }), entries.length);
  assert.equal(entries.length, 19, "the dossier's twelve gaps plus the seven this build found");
  assert.ok(section.absent.length >= 19, `absent went to ${section.absent.length} — this list does not shrink`);
  for (const a of section.absent) {
    assert.ok(typeof a === "string" && a.length > 150, `absent entry is a stub: ${a.slice(0, 60)}`);
  }
  /* A withholding may not leave silently, nor be replaced by another. */
  assert.throws(() => assertAbsentEntries({
    absent: entries.filter((e) => e.key !== "northFace"), expected: ABSENT, label: "hdhadmin",
  }), /may not leave silently/);
  assert.throws(() => assertAbsentEntries({
    absent: entries.map((e) => (e.key === "veilModule" ? { key: e.key, text: "not resolved" } : e)),
    expected: ABSENT, label: "hdhadmin",
  }), /no longer says what it withholds/);
  /* g3 and g4 must keep saying Street View is OPEN and not failed — the day
     that becomes "failed" is the day nobody looks again. */
  const j = section.absent.join("\n");
  assert.match(j, /OPEN, NOT FAILED|OPEN, not failed/i,
    "the Street View rung must stay recorded as OPEN — 'failed' closes a door nobody has walked to");
  /* And g7's DIRECTION half must be recorded as resolved, not silently kept
     withheld, since this build resolved it off a photograph. */
  assert.match(j, /Blade DIRECTION is now RESOLVED/,
    "g7 was half-resolved by this build and the entry must say which half");
});

test("S1(vi): every expr is arithmetic, is EVALUATED, and reproduces its own value", () => {
  const scope = { r: R, s: section };
  const { evaluated, prose } = assertExprs({ figures: section.derivations.figures, scope, label: "hdhadmin" });
  assert.equal(evaluated, 44, "all 44 figures evaluate");
  assert.equal(prose, 0, "no figure may hide behind prose");
  assert.throws(() => assertExprs({
    figures: { "system.gallery.clear": { value: 1.1176, expr: "r.code.corridorClearWidth * r.units.inch" } },
    scope, label: "hdhadmin",
  }), /does not exist/);
  assert.throws(() => assertExprs({
    figures: { "system.door.width": { value: 0.9144, expr: "r.code.doorHeightIn * r.units.inch" } },
    scope, label: "hdhadmin",
  }), /does not reproduce its own value/);
  assert.throws(() => assertExprs({
    figures: { "system.storeyPitchMean": { value: 3.9475, expr: "the parapet over the surveyed level count" } },
    scope, label: "hdhadmin",
  }), /illegal character|does not exist|does not reproduce/);
});

test("S2: the claim this section supersedes declares what happened to it", () => {
  /* What this section supersedes is a READING of shipped figures, not an
     object transferred to or deleted by a successor, so the shared sup gate's
     transferred/deleted-on-evidence vocabulary does not apply and is not
     borrowed: calling a replacement a deletion would say the opposite of what
     happened. The record is held to the same completeness here instead. */
  assert.ok(section.supersedes.length >= 1);
  for (const s of section.supersedes) {
    assert.equal(s.disposition, "replaced-on-evidence",
      "this section replaces a reading; it neither transfers nor deletes an object");
    for (const k of ["what", "nowIs", "why", "evidence"]) {
      assert.ok(s[k] && s[k].length > 40, `a supersedes record is missing ${k}`);
    }
  }
  /* Nothing measured was edited to make this section work. */
  assert.match(section.supersededNote, /Nothing here is deleted|edits no measured file/i);
});

/* -------------------------------------------------------------- the survey */

test("every surveyed ring and height is the survey, byte for byte", () => {
  assert.equal(MASS.n, "Housing, Dining and Hospitality Services", "massing[144] moved");
  assert.deepEqual(section.measured.mass.ring, ringRaw,
    "the ring is not arcgis.massing[144].r[0] at /10 — including both of its trailing duplicate vertices");
  assert.deepEqual(section.measured.osmRing, campus.buildings[section.measured.osmIndex].p,
    "the OSM witness ring is not campus-3d buildings[410].p");
  assert.equal(campus.buildings[section.measured.osmIndex].n,
    "Housing Dining and Hospitality Administration Building", "buildings[410] moved");
  assert.equal(section.measured.mass.h, lidar.massHeights["m:-175,382"]);
  assert.equal(R.survey.ringHeight,
    lidar.heights["Housing Dining and Hospitality Administration Building"]);
  assert.equal(R.survey.formulaHeight, MASS.h);
  assert.equal(R.survey.levels, MASS.levels);
  assert.equal(R.survey.osmHeight, campus.buildings[section.measured.osmIndex].h);
  assert.equal(R.lidar.datum, lidar.datum);

  /* R5 MERGE RE-PIN (2026-08-22): m:-175,382 is now a declared skipGis
     retirement — assembleMasses filters it, photo-hdhadmin carries the
     silhouette (REPLACES_MEASURED). The prism's absence is itself the gate:
     if it ever renders again it entombs this module. The section's prism
     figures stay verified through campus-massing.js's own roofElevation over
     the survey ring, so the recompute lost no strength — only the retired
     extrusion object. */
  const drawn = assembleMasses({ campus, lidar, arcgis, colors: null })
    .find((m) => m.src === "gis" && m.rings?.[0]?.[0]?.[0] === ringRaw[0][0] &&
      m.rings[0][0][1] === ringRaw[0][1]);
  assert.equal(drawn, undefined, "the m:-175,382 prism is back — it entombs photo-hdhadmin");
  assert.equal(section.measured.mass.h, lidar.massHeights["m:-175,382"],
    "mass.h drifted from the measured plane the prism would have extruded");
  near(section.roof.prism.top, roofElevation(ringRaw, section.measured.mass.h, heightSampler), 1e-6,
    "roof.prism.top is not what campus-massing.js's own roofElevation gives over the survey ring");
  /* And that top really is a storey above the measured plate and a hair below
     the tallest ridge — the two facts the whole section turns on. */
  assert.ok(section.roof.prism.overshoot > 4, "the overshoot claim has evaporated");
  assert.ok(section.roof.prism.belowHighestRidge < 0,
    "the prism must sit BELOW the highest ridge — the lid is simultaneously too tall and too short");

  /* The ground rings are cited by LITERAL index and each is really that ring. */
  for (const r of section.ground.rings) {
    const g = arcgis.ground[r.index];
    assert.ok(g, `arcgis.ground#${r.index} does not exist — an index was renumbered`);
    assert.equal(g.k, r.kind, `arcgis.ground#${r.index} is a ${g.k}, not a ${r.kind}`);
    const pts = g.r.flat().map(([x, z]) => [x / 10, z / 10]);
    const xs = pts.map((p) => p[0]);
    const zs = pts.map((p) => p[1]);
    near(r.bbox.x0, Math.min(...xs), 1e-3, `#${r.index} bbox x0`);
    near(r.bbox.x1, Math.max(...xs), 1e-3, `#${r.index} bbox x1`);
    near(r.bbox.z0, Math.min(...zs), 1e-3, `#${r.index} bbox z0`);
    near(r.bbox.z1, Math.max(...zs), 1e-3, `#${r.index} bbox z1`);
  }
  /* The two rings the section is FORBIDDEN to claim must stay unclaimed. */
  for (const forbidden of [1720, 1130]) {
    assert.equal(section.ground.rings.some((r) => r.index === forbidden), false,
      `arcgis.ground#${forbidden} is claimed here — it is NatSci's or it runs into Keeling's box`);
  }
  /* The extractor's own trees are carried verbatim and drawn by nobody here. */
  assert.deepEqual(section.ground.lidarTrees,
    lidar.trees.filter((t) => t[0] > -215 && t[0] < -138 && t[1] > 355 && t[1] < 412),
    "the carried lidar.trees rows are not the shipped ones");
});

test("the facade table IS the survey ring, re-derived here and deepEqualed", () => {
  /* Re-derived from arcgis.massing[144] with the ring's own winding, exactly
     as the section claims to have done it. A facade cannot drift off the ring
     and a system cannot annex a run without this failing. */
  let a2 = 0;
  for (let i = 0; i < ring.length - 1; i++) a2 += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  const ccw = a2 > 0;
  const rebuilt = ringOpen.map((a, i) => {
    const b = ringOpen[(i + 1) % ringOpen.length];
    const L = seg(a, b);
    const s = ccw ? 1 : -1;
    const nx = (s * (b[1] - a[1])) / L;
    const nz = (-s * (b[0] - a[0])) / L;
    const wall = Math.abs(nx) > Math.abs(nz) ? (nx > 0 ? "east" : "west") : (nz > 0 ? "south" : "north");
    return { i, a, b, out: [Number(nx.toFixed(6)), Number(nz.toFixed(6))], length: Number(L.toFixed(6)), wall };
  });
  assert.equal(section.facades.length, rebuilt.length);
  section.facades.forEach((f, i) => {
    const w = rebuilt[i];
    assert.equal(f.i, w.i);
    assert.deepEqual(f.a, w.a, `facade ${i} start is not the ring's vertex`);
    assert.deepEqual(f.b, w.b, `facade ${i} end is not the ring's vertex`);
    assert.deepEqual(f.out, w.out, `facade ${i} normal is not the ring's own outward normal`);
    near(f.length, w.length, 5e-6, `facade ${i} length`);
    assert.equal(f.wall, w.wall, `facade ${i} wall`);
    /* Outward really means outward: a point one metre off the face is outside
       the surveyed footprint. */
    /* The probe is a twentieth of a metre, not a metre: the survey carries a
       0.14 m diagonal jog at the south-west step and a metre off IT lands back
       inside the building's own re-entrant corner. */
    const mx = (f.a[0] + f.b[0]) / 2 + f.out[0] * 0.05;
    const mz = (f.a[1] + f.b[1]) / 2 + f.out[1] * 0.05;
    assert.equal(inRing(mx, mz, ring), false, `facade ${i}'s normal points INTO the building`);
  });
  /* The four faces close the ring exactly. */
  const total = section.facades.reduce((s, f) => s + f.length, 0);
  near(total, R.survey.ringPerimeter, 5e-6, "the facade runs do not close the survey ring");

  /* THE VEIL'S EXTENT IS THE SURVEY'S OWN JOG — the claim the whole west face
     rests on. The veil must be the PROJECTING west run (the ring's own
     westernmost x) plus the south return it turns, and the metal flank the
     SET-BACK run. If the two ever swap, the photograph stops matching the plan. */
  const westX = (f) => (f.a[0] + f.b[0]) / 2;
  const veilWest = section.facades.filter((f) => f.system === "veil" && f.wall === "west");
  const metalWest = section.facades.filter((f) => f.system === "metal" && f.wall === "west");
  assert.ok(veilWest.length && metalWest.length);
  assert.ok(Math.max(...veilWest.map(westX)) < Math.min(...metalWest.map(westX)),
    "the veil is no longer on the PROJECTING west run — it and the metal flank have swapped");
  near(Math.min(...veilWest.map(westX)), R.survey.ringWestX, 1e-6,
    "the veil run is not on the survey ring's own west wall");
  assert.ok(section.facades.some((f) => f.system === "veil" && f.wall === "south"),
    "the veil must wrap the south-west corner — that is the glass box both 2010 frames show");
  /* The gallery is the 33.7 m face at the ring's own south wall, and nothing
     else: the SE notch's south edges are service, not gallery. */
  for (const f of section.facades.filter((x) => x.system === "gallery")) {
    near((f.a[1] + f.b[1]) / 2, R.survey.ringSouthZ, 0.2, "a gallery run is not on the south wall");
  }

  /* The declared runs are the arithmetic of the table. */
  const runOf = (sys) => section.facades.filter((f) => f.system === sys)
    .reduce((s, f) => s + f.length, 0);
  for (const sys of ["veil", "metal", "gallery", "service"]) {
    near(section.facadeSystems[sys].run, runOf(sys), 5e-6, `${sys} run`);
  }
  near(section.facadeSystems.gallery.run, 33.7, 0.05,
    "the sourced south gallery face is the dossier's own 34 m");
  near(section.facadeSystems.sourcedRun,
    runOf("veil") + runOf("metal") + runOf("gallery"), 5e-6, "sourcedRun");
  near(section.facadeSystems.sourcedFraction,
    section.facadeSystems.sourcedRun / R.survey.ringPerimeter, 5e-6, "sourcedFraction");
  /* HALF THIS BUILDING IS ESTIMATED. The number is stated so it cannot creep,
     and the service system must stay labelled whatever else changes. */
  assert.ok(section.facadeSystems.sourcedFraction > 0.45 && section.facadeSystems.sourcedFraction < 0.55,
    `the sourced fraction is ${section.facadeSystems.sourcedFraction} — it measured 0.493`);
  assert.equal(section.facadeSystems.service.tier, "estimated");
  assert.equal(section.facadeSystems.service.extends, "gallery");
  for (const f of section.facades) {
    if (f.wall === "north" || f.wall === "east") {
      assert.equal(f.system, "service",
        `the ${f.wall} run ${f.i} claims the ${f.system} system — no photograph of either face exists on any rung`);
    }
  }
});

test("the massing retirement main must wire is declared, keyed and reciprocal", () => {
  const M = section.measured.massing;
  assert.equal(M.skipGisKey, "m:-175,382");
  assert.equal(M.replacesMeasured, "photo-hdhadmin");
  /* The key really is this mass's rounded GIS centroid, which is how
     campus-massing.js keys skipGis and how campus-lidar keys massHeights. */
  /* Recomputed the way scripts/build-campus-lidar.mjs:1537 does it — the mean
     over the STORED ring, trailing duplicate vertices included, which is what
     makes m:-175,382 and not m:-174,383. Getting this wrong is how main would
     wire a skipGis key for a mass that does not exist. */
  const cx = ringRaw.reduce((s, p) => s + p[0], 0) / ringRaw.length;
  const cz = ringRaw.reduce((s, p) => s + p[1], 0) / ringRaw.length;
  assert.equal(`m:${Math.round(cx)},${Math.round(cz)}`, M.skipGisKey,
    "the skipGis key is not this mass's own rounded centroid");
  assert.ok(lidar.massHeights[M.skipGisKey] !== undefined,
    "the skipGis key must be the same key massHeights uses, or main will wire a mass that does not exist");
  assert.match(M.why, /one commit|together/i,
    "skipGis and REPLACES_MEASURED must be wired together — one without the other doubles the envelope or holes the silhouette");
  assert.equal(section.group === undefined, true);
  /* And this suite must be told the moment main HAS wired it, so a doubled
     envelope cannot ship quietly: once campus-massing.js skips this mass, the
     module is the only thing drawing it. */
  const massingSrc = readFileSync(join(root, "docs/js/campus-massing.js"), "utf8");
  const walkSrc = readFileSync(join(root, "docs/js/campus-walk.js"), "utf8");
  const skipped = massingSrc.includes(`"${M.skipGisKey}"`);
  const replaces = walkSrc.includes(`"${M.replacesMeasured}"`);
  assert.equal(skipped, replaces,
    `campus-massing.js ${skipped ? "does" : "does NOT"} skip ${M.skipGisKey} but campus-walk.js ${replaces ? "does" : "does NOT"} list ${M.replacesMeasured} — these two must land in the same commit`);
});

/* ------------------------------------------------------------------ colour */

test("colours are data, hex, tiered, and a line that states its hex ships it", () => {
  const entries = Object.entries(section.colors);
  assert.ok(entries.length >= 20, `only ${entries.length} colours`);
  for (const [k, v] of entries) {
    assert.match(v, /^#[0-9a-f]{6}$/, `${k} is not a lowercase 6-digit hex`);
    const raw = section.colorSources[k];
    assert.ok(raw, `${k} has no colorSources line`);
    const src = srcLine(raw);
    assert.match(src, /^\[(measured|sourced|estimated)\]/, `${k}'s provenance carries no tier`);
    assert.ok(src.length > 100, `${k}'s provenance is a stub`);
    if (typeof raw === "object") {
      assert.equal(raw.tier, /^\[(\w+)\]/.exec(src)[1], `${k}'s tier field and its prose disagree`);
    }
  }
  const roles = Object.keys(section.colorSources).filter((k) => k !== "why");
  assert.deepEqual(roles.sort(), Object.keys(section.colors).sort(),
    "colorSources and colors must cover exactly the same roles");

  /* THE SHIPS-VS-DERIVES GATE. Every line that states its result as
     `= #xxxxxx` must ship exactly that hex; a hex could otherwise drift while
     its provenance line kept stating the old value. */
  let stated = 0;
  for (const [role, raw] of Object.entries(section.colorSources)) {
    if (role === "why") continue;
    const m = /= (#[0-9a-f]{6})\b/.exec(srcLine(raw));
    if (!m) continue;
    stated++;
    assert.equal(section.colors[role], m[1],
      `${role} ships ${section.colors[role]} but its own provenance line derives ${m[1]}`);
  }
  assert.ok(stated >= 19, `only ${stated} provenance lines state their hex — every sampled rect must`);

  /* Every photographic read states its method, its rect, its frame and its
     date, and never says 'luminance' (the R4 addendum bans the word). */
  const sampled = Object.entries(section.colorSources)
    .filter(([k, v]) => k !== "why" && /^\[(sourced|measured)\]/.test(srcLine(v)));
  assert.ok(sampled.length >= 19);
  for (const [role, raw] of sampled) {
    const src = srcLine(raw);
    assert.match(src, /channel-mean/, `${role} must state the (R+G+B)/3 method`);
    assert.match(src, /\(\d+,\d+,\d+,\d+\)|world rect/, `${role} must pin its sample rect`);
    assert.match(src, /\b(19|20)\d\d\b/, `${role} must date its source`);
    assert.equal(/luminance/i.test(src), false, `${role} says 'luminance' — the R4 addendum bans the word`);
  }
  /* An [estimated] colour must SHIP an existing hex and NAME the role it
     extends — a new hex would be an invented colour wearing a tier. An
     estimate may not inherit from an estimate. */
  for (const [role, raw] of Object.entries(section.colorSources)) {
    if (role === "why") continue;
    const src = srcLine(raw);
    if (!/^\[estimated\]/.test(src)) continue;
    const parent = (typeof raw === "object" && raw.extends) || /colors\.(\w+)/.exec(src)?.[1];
    assert.ok(parent, `${role} is [estimated] and names no parent role`);
    assert.equal(section.colors[parent], section.colors[role],
      `${role} must ship the same hex as the sourced role it names`);
    assert.match(srcLine(section.colorSources[parent]), /^\[(sourced|measured)\]/,
      `${role} extends another estimate rather than a sourced role`);
    assert.match(src, new RegExp(`colors\\.${parent}\\b`), `${role} must name its parent in prose too`);
  }
  /* No hex literal may live in the module, and no declared role may go
     unreferenced — a role nobody draws is a claim nobody checks. */
  assert.equal(moduleSrc.match(/#[0-9a-fA-F]{6}\b/g), null, "a colour literal leaked into the builder");
  const named = new Set(SYS.veil.palette);
  for (const [k, v] of Object.entries(section.colorSources)) {
    if (k === "why") continue;
    for (const m of srcLine(v).matchAll(/colors\.(\w+)/g)) named.add(m[1]);
  }
  for (const role of Object.keys(section.colors)) {
    assert.ok(moduleCode.includes(`"${role}"`) || named.has(role),
      `colors.${role} is declared and nothing references it`);
  }
  /* And the veil's palette must name roles this section actually declares — a
     palette entry naming a colour that does not exist would ship the material
     library's silent opaque white across this building's signature system. */
  for (const role of SYS.veil.palette) {
    assert.ok(section.colors[role], `system.veil.palette names colors.${role}, which does not exist`);
  }
});

test("nothing in this section rests on the unresolved ortho-as-colour-source ruling", () => {
  assert.match(section.colorSources.why, /ortho/i);
  assert.match(section.colorSources.why, /NOT used|not used/,
    "the colour block must say in as many words that the ortho-derived tone is not used");
  for (const [role, raw] of Object.entries(section.colorSources)) {
    if (role === "why") continue;
    const line = srcLine(raw);
    assert.ok(!/chunk_\d+_\d+\.jpg|ortho pixel|orthophoto pixel/i.test(line),
      `colour ${role} is sampled off orthophoto pixels, which is the ruling Sahir has not made`);
  }
  const flagged = section.conflicts.find((c) => /orthoColourRuling/.test(c));
  assert.ok(flagged, "the ortho-as-colour-source ruling must be carried as a declared conflict");
  assert.match(flagged, /NOT sampled|not sampled/i);
  /* The dossier's two candidate values stay on the record — quarantined, not dropped. */
  const record = flagged;
  for (const hex of ["#acb8c3", "#9cb4c6", "#b8b8b8", "#b3b3b3"]) {
    assert.ok(record.includes(hex), `conflicts.orthoColourRuling lost the dossier's ${hex}`);
  }
});

/* ------------------------------------------------------------- the module */

test("the module carries no dimension of its own — geometry is data", () => {
  const allowed = new Map([
    ["131.71", "hash constant"], ["57.13", "hash constant"], ["7.9", "hash constant"],
    ["43758.5453", "hash constant"],
    ["0.8", "material metalness"], ["0.4", "material roughness / normal scale"],
    ["0.5", "a half: the centre of a bay, a panel, a cell or a ripple's swing"],
  ]);
  const found = new Set(moduleCode.match(/\b\d+\.\d+\b/g) || []);
  for (const n of found) {
    assert.ok(allowed.has(n),
      `${n} is a bare number in the builder — move it into the section's derivations, estimates, reads or draw block`);
  }
  /* And the builder must actually READ the blocks it claims to. */
  for (const key of ["draw", "storeys", "penthouse", "profile", "veil", "gallery",
    "overlook", "treeRow", "bayModule", "postPitch", "bladePitch", "slatPitch"]) {
    assert.ok(moduleCode.includes(key), `the builder never reads ${key}`);
  }
});

test("the module is a one-way reader, deterministic, and on the shared ladders", () => {
  assert.equal(moduleCode.match(/Math\.random/), null, "the module uses Math.random");
  assert.equal(moduleCode.match(/\bnew Date\b|Date\.now|performance\.now/), null, "the module reads a clock");
  assert.equal(moduleCode.match(/new THREE\.TextureLoader|\.load\(/), null,
    "textures are code-generated here, never loaded from a photograph");
  assert.equal(moduleCode.match(/section\.\w+\s*=[^=]|S\.\w+\s*=[^=]/), null,
    "the module writes back into the section");
  assert.match(moduleSrc, /from "\.\/campus-overlay\.js"/);
  assert.match(moduleSrc, /from "\.\/campus-materials\.js"/);
  assert.match(moduleSrc, /overlayLift\(/, "seated geometry must take its lift from campus-overlay.js");
  assert.equal(moduleCode.match(/lift\s*=\s*0\.\d/), null,
    "no module may define a local overlay lift — campus-overlay.js owns the ladder");
  assert.deepEqual([...new Set([...moduleSrc.matchAll(/photo\?\.(\w+)/g)].map((m) => m[1]))], ["hdhadmin"],
    "the module reads a key that is not its own");
  /* It must not open a measured file either. */
  assert.equal(moduleCode.match(/campus-(lidar|3d|arcgis|colors)\.json/), null,
    "the module reads a measured data file directly instead of taking the section's copy");
});

const flat = () => 20;
const sloped = (x, z) => 20 + 1.4 * Math.sin(x / 11) + 1.1 * Math.cos(z / 13);
const build = (g = drawnGround) =>
  createPhotoHdhAdmin(null, { photo: { hdhadmin: section }, heightAt: g, surfaceAt: g });

test("the module builds every system, and the counts are the arithmetic", () => {
  const { group, counts } = build();
  for (const n of ["hdhadmin-envelope", "hdhadmin-roof", "hdhadmin-facades", "hdhadmin-ground"]) {
    assert.ok(group.children.find((c) => c.name === n), `no ${n} group`);
  }
  /* Recomputed here rather than trusted. */
  assert.equal(counts.facadeRuns, ringOpen.length, "one run per surveyed edge");
  for (const [k, sys] of [["veilRuns", "veil"], ["metalRuns", "metal"],
    ["galleryRuns", "gallery"], ["serviceRuns", "service"]]) {
    assert.equal(counts[k], section.facades.filter((f) => f.system === sys).length, k);
  }
  assert.equal(counts.storeys, R.survey.levels);
  assert.equal(counts.plateY, R.lidar.plate, "the module tops the envelope out somewhere other than the measured plate");
  assert.equal(counts.penthouseBays, 3);
  assert.equal(counts.penthouseProfile, 6);
  near(counts.penthouseLength, R.lidar.ringEdgeX - R.lidar.penthouseWestX, 1e-6, "penthouse length");
  /* THREE GALLERY TIERS ON THE ONE SOURCED FACE, and nowhere else. */
  assert.equal(counts.galleryDecks,
    SYS.gallery.levels.length * section.facades.filter((f) => f.system === "gallery").length,
    "a gallery tier per level per sourced south run — and none on the service faces");
  /* The pleat's blade count is the profile's own run over the declared pitch. */
  const P = section.roof.penthouse;
  let want = 0;
  for (let i = 0; i < P.profile.length - 1; i++) {
    const a = P.profile[i];
    const b = P.profile[i + 1];
    want += Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / P.bladePitch));
  }
  assert.equal(counts.topBlades, want, "the pleat's blades are not its measured run over the declared pitch");
  assert.equal(counts.mullions,
    2 * P.bays.reduce((s, b) => s + b.mullions, 0),
    "one mullion per bay count, on each of the two gable walls");
  assert.equal(counts.slats, SYS.base.slatCount);
  assert.ok(counts.veilPanels > 40 && counts.spiders === 4 * counts.veilPanels,
    "four spider fittings per veil panel");
  /* The tree row is carved for the ramp and the carve is VISIBLE. */
  assert.ok(counts.treeRowCellsCarvedForRamp > 0,
    "the ramp no longer crosses the measured row — either is fine, but the count must say which");
  assert.equal(counts.stairTreads, SYS.stair.legs * Math.round(SYS.stair.treads / SYS.stair.legs));

  /* PERF. campus-mid's margin is thin and this building is a whole envelope,
     so the draw-call budget is a gate, not a hope. */
  let meshes = 0;
  group.traverse((o) => { if (o.isMesh || o.isInstancedMesh) meshes++; });
  assert.ok(meshes <= 40, `${meshes} draw calls for one building — instance or merge harder`);

  const missing = createPhotoHdhAdmin(null, { photo: {}, heightAt: flat, surfaceAt: flat });
  assert.deepEqual(missing.counts, {}, "a missing section builds nothing and breaks nothing");
  assert.throws(() => createPhotoHdhAdmin(null, { photo: { hdhadmin: section } }), /surfaceAt/,
    "a missing sampler must not be silent");
});

test("the pre-merge guard refuses a half-section rather than drawing half a building", () => {
  for (const strip of ["system", "roof", "ground", "draw", "colors", "measured"]) {
    const half = { ...section };
    delete half[strip];
    const r = createPhotoHdhAdmin(null, { photo: { hdhadmin: half }, surfaceAt: flat });
    assert.equal(r.group.children.length, 0, `a section without ${strip} drew geometry anyway`);
    assert.match(r.counts.pendingMerge, new RegExp(strip), "the guard must name what it is waiting for");
  }
  /* And the deep keys, which is where a half-landed merge actually bites. */
  const noProfile = { ...section, roof: { ...section.roof, penthouse: { ...section.roof.penthouse, profile: null } } };
  const r = createPhotoHdhAdmin(null, { photo: { hdhadmin: noProfile }, surfaceAt: flat });
  assert.equal(r.group.children.length, 0);
  assert.match(r.counts.pendingMerge, /roof\.penthouse\.profile/);
  /* If the shipped doc has no hdhadmin key yet, it must build nothing. */
  if (!shippedDoc.hdhadmin) {
    const pre = createPhotoHdhAdmin(null, { photo: shippedDoc, surfaceAt: flat });
    assert.deepEqual(pre.counts, {}, "the unmerged shipped doc drew geometry");
  }
});

test("the group is added to a scene when there is one", () => {
  const added = [];
  const r = createPhotoHdhAdmin({ add: (g) => added.push(g) },
    { photo: { hdhadmin: section }, surfaceAt: flat });
  assert.deepEqual(added, [r.group]);
});

/** Every placement in a subtree, as (x, y, z, scaleY, node). */
function each(node, fn) {
  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  node.traverse((o) => {
    if (o.isInstancedMesh) {
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m);
        m.decompose(pos, q, sc);
        fn(pos.x, pos.y, pos.z, sc.y, o);
      }
    } else if (o.isMesh) {
      const p = o.geometry.attributes.position;
      if (!p) return;
      const v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
        fn(v.x, v.y, v.z, 0, o);
      }
    }
  });
}

test("nothing hovers and nothing sinks — flat, an exaggerated slope, and the DRAWN LiDAR surface", () => {
  const plateY = R.lidar.plate;
  const highest = R.lidar.ringEdgeTop;
  for (const [label, ground] of [["flat", flat], ["slope", sloped], ["drawn", drawnGround]]) {
    const { group, counts } = build(ground);
    group.updateMatrixWorld(true);

    /* THE ENVELOPE closes on the MEASURED plate — never on the drawn prism,
       which stands 4.27 m higher — and its foot reaches the drawn surface on
       every terrain, so no terrain triangle can show under a wall. */
    const env = group.children.find((c) => c.name === "hdhadmin-envelope");
    let top = -Infinity;
    let checked = 0;
    each(env, (x, y, z) => {
      assert.ok(y <= plateY + 1e-6,
        `${label}: an envelope vertex stands at y=${y.toFixed(2)}, above the measured plate ${plateY}`);
      top = Math.max(top, y);
      checked++;
    });
    near(top, plateY, 1e-6, `${label}: the envelope does not top out on the measured plate`);
    assert.ok(section.roof.prism.top - top > 4,
      `${label}: the envelope has crept up toward the drawn prism`);

    /* THE ROOF sits on the plate and nothing on it exceeds the tallest thing
       the laser found. */
    const roof = group.children.find((c) => c.name === "hdhadmin-roof");
    let rlo = Infinity;
    let rhi = -Infinity;
    each(roof, (x, y, z, sy) => {
      rlo = Math.min(rlo, y - sy / 2);
      rhi = Math.max(rhi, y + sy / 2);
      checked++;
    });
    assert.ok(rlo >= plateY - 1e-4, `${label}: a roof item dips to ${rlo.toFixed(2)}, below the plate`);
    assert.ok(rhi <= highest + section.roof.penthouse.bladeDepth,
      `${label}: a roof item reaches ${rhi.toFixed(2)}, above the laser's tallest return ${highest}`);

    /* EVERYTHING ON THE GROUND SEATS ON THE DRAWN SURFACE. */
    const gnd = group.children.find((c) => c.name === "hdhadmin-ground");
    each(gnd, (x, y, z, sy, o) => {
      const g = ground(x, z);
      const bottom = sy ? y - sy / 2 : y;
      assert.ok(bottom >= g - section.draw.skirtDrop - section.draw.footingDrop - 0.01,
        `${label}: ${o.name} at (${x.toFixed(1)}, ${z.toFixed(1)}) sinks to ${bottom.toFixed(2)} under the drawn surface ${g.toFixed(2)}`);
      /* Nothing on the ground may float: the tree row's crowns are the tallest
         thing here and they stand a measured 4.12 m over the grade. */
      const reach = R.lidar.treeRowCrownHi - R.lidar.gradeSouth + SYS.guard.height;
      assert.ok(y <= g + reach + SYS.storeys.l2FinishedFloor - R.lidar.gradeSouth,
        `${label}: ${o.name} at (${x.toFixed(1)}, ${z.toFixed(1)}) floats at ${y.toFixed(2)} over ${g.toFixed(2)}`);
      checked++;
    });
    assert.ok(checked > 3000, `${label}: only ${checked} placements checked — the loops did not run`);
    assert.equal(counts.facadeRuns, ringOpen.length);
  }
});

test("nothing built stands inside a measured footprint, enters Keeling, or leaves the declared bounds", () => {
  const { group } = build();
  group.updateMatrixWorld(true);
  const others = campus.buildings
    .filter((b, i) => b.p && b.p.length >= 3 && i !== section.measured.osmIndex);
  const B = section.bounds;
  const KEELING = { x0: -200, x1: -130, z0: 405, z1: 500 };
  let worstIn = null;
  let worstOut = null;
  let keeling = null;
  const gnd = group.children.find((c) => c.name === "hdhadmin-ground");
  each(group, (x, y, z, sy, o) => {
    if (x < B.x0 || x > B.x1 || z < B.z0 || z > B.z1) worstOut = `${o.name} at (${x.toFixed(1)}, ${z.toFixed(1)})`;
    if (x >= KEELING.x0 && x <= KEELING.x1 && z >= KEELING.z0 && z <= KEELING.z1) {
      keeling = `${o.name} at (${x.toFixed(1)}, ${z.toFixed(1)})`;
    }
  });
  /* Only the GROUND group can collide with a neighbour's footprint; the
     envelope legitimately stands on this building's own. */
  each(gnd, (x, y, z, sy, o) => {
    for (const b of others) if (inRing(x, z, b.p)) worstIn = `${o.name} at (${x.toFixed(1)}, ${z.toFixed(1)}) is inside ${b.n || "an unnamed mass"}`;
  });
  assert.equal(worstIn, null, `${worstIn}`);
  assert.equal(worstOut, null, `${worstOut} is outside the declared bounds`);
  assert.equal(keeling, null, `${keeling} has entered Keeling's exclusion box — out of scope at the bar already`);

  /* THE ZIGZAG STAIR MUST NOT STAND IN THE BUILDING. Its berm ring overlaps
     the west wall, so this is a real collision the builder has to clip. */
  let stair = null;
  gnd.traverse((o) => { if (o.name === "ground-zigzag-stair-estimated") stair = o; });
  assert.ok(stair, "the zigzag stair did not build");
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  for (let i = 0; i < stair.count; i++) {
    stair.getMatrixAt(i, m);
    m.decompose(p, q, s);
    for (const dx of [-s.x / 2, s.x / 2]) {
      for (const dz of [-s.z / 2, s.z / 2]) {
        assert.equal(inRing(p.x + dx, p.z + dz, ring), false,
          `a stair tread corner at (${(p.x + dx).toFixed(2)}, ${(p.z + dz).toFixed(2)}) stands inside the surveyed footprint`);
      }
    }
  }
});

test("the ramp and the overlook occupy the same face without occupying each other", () => {
  const { group } = build();
  group.updateMatrixWorld(true);
  const boxOf = (name) => {
    let found = null;
    group.traverse((o) => { if (o.name === name) found = o; });
    assert.ok(found, `no ${name}`);
    return new THREE.Box3().setFromObject(found);
  };
  const ramp = boxOf("ground-ramp-estimated");
  const overlook = boxOf("facade-overlook-estimated");
  assert.equal(ramp.intersectsBox(overlook), false,
    "the ramp runs through the OVERLOOK pier — it must arrive beside it");
  /* Both stand on the south side of the surveyed south wall. */
  assert.ok(ramp.min.z > R.survey.ringSouthZ - 1, "the ramp is not on the south face");
  assert.ok(overlook.min.z > R.survey.ringSouthZ - 1, "the overlook is not on the south face");
  /* And the ramp climbs toward the WEST, which is the direction Studio E's
     own copy fixes ("the southern campus-connecting ramp"). */
  assert.equal(SYS.ramp.risesToward, "west");
});

test("the built mullions, veil columns, gallery posts and tree-row cells land on the DERIVED stations", () => {
  /* P101 §SURGERY Gate 1. Containment is not a station gate: a 0.5 m slide
     of every penthouse mullion stays on the plate, inside the bounds, and
     outside Keeling. This test re-derives origin + k·pitch from the
     section's own figures and requires every built instance to land on
     that station. */
  const STATION = 0.1;
  const { group } = build();
  const D = section.draw;
  const eachInstance = (node, fn) => {
    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    node.traverse((o) => {
      if (!o.isInstancedMesh) return;
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m);
        m.decompose(pos, q, sc);
        fn(pos.x, pos.y, pos.z, sc, o);
      }
    });
  };
  const frameOf = (f) => {
    const [ax, az] = f.a;
    const [bx, bz] = f.b;
    const length = Math.hypot(bx - ax, bz - az);
    const tx = (bx - ax) / length;
    const tz = (bz - az) / length;
    const [nx, nz] = f.out;
    return {
      length, tx, tz, nx, nz, ax, az,
      at: (u, w) => ({ x: ax + tx * u + nx * w, z: az + tz * u + nz * w }),
      along: (x, z) => (x - ax) * tx + (z - az) * tz,
    };
  };

  const P = section.roof.penthouse;
  const wantMullionX = [];
  for (const bay of P.bays) {
    for (let k = 1; k <= bay.mullions; k++) {
      wantMullionX.push(bay.x0 + ((bay.x1 - bay.x0) * k) / (bay.mullions + 1));
    }
  }
  const gotMullion = [];
  eachInstance(group, (x, y, z, sc, o) => {
    if (o.name === "roof-penthouse-mullions-estimated") gotMullion.push([x, z]);
  });
  assert.equal(gotMullion.length, 2 * wantMullionX.length,
    `derived ${wantMullionX.length} x-stations × 2 gables against ${gotMullion.length} built mullions`);
  for (const [x, z] of gotMullion) {
    const dx = Math.min(...wantMullionX.map((s) => Math.abs(x - s)));
    assert.ok(dx <= STATION,
      `mullion at (${x.toFixed(3)}, ${z.toFixed(3)}) stands ${dx.toFixed(3)} m off every derived origin+k·pitch x-station`);
    const dz = Math.min(Math.abs(z - P.z0), Math.abs(z - P.z1));
    assert.ok(dz <= STATION,
      `mullion at (${x.toFixed(3)}, ${z.toFixed(3)}) is not on a gable wall`);
  }
  for (const sx of wantMullionX) {
    assert.ok(gotMullion.some(([x]) => Math.abs(x - sx) <= STATION),
      `no built mullion lands on derived x-station ${sx}`);
  }

  const V = SYS.veil;
  const veilFrames = [];
  for (const f of section.facades) {
    if (f.system !== "veil") continue;
    const fr = frameOf(f);
    const cols = Math.max(1, Math.round(fr.length / (V.panelWidth + D.panelGap)));
    const stations = [];
    for (let i = 0; i < cols; i++) stations.push(((i + 0.5) * fr.length) / cols);
    veilFrames.push({ fr, stations });
  }
  const gotVeil = [];
  eachInstance(group, (x, y, z, sc, o) => {
    if (/^facade-veil-panels-/.test(o.name)) gotVeil.push([x, z]);
  });
  assert.ok(gotVeil.length > 0, "no veil panels built");
  for (const [x, z] of gotVeil) {
    let best = Infinity;
    for (const { fr, stations } of veilFrames) {
      const u = fr.along(x, z);
      const d = Math.min(...stations.map((s) => Math.abs(u - s)));
      if (d < best) best = d;
    }
    assert.ok(best <= STATION,
      `veil panel at (${x.toFixed(3)}, ${z.toFixed(3)}) stands ${best.toFixed(3)} m off every derived column station`);
  }

  const G = SYS.gallery;
  const gw = G.projection - D.railSection;
  const wantPosts = [];
  for (const f of section.facades) {
    if (f.system !== "gallery") continue;
    const fr = frameOf(f);
    const np = Math.max(2, Math.round(fr.length / SYS.guard.postPitch));
    for (const y of G.levels) {
      for (let k = 0; k <= np; k++) {
        const p = fr.at((k * fr.length) / np, gw);
        wantPosts.push([p.x, p.z]);
      }
    }
  }
  const gotPosts = [];
  eachInstance(group, (x, y, z, sc, o) => {
    if (o.name === "facade-gallery-posts-sourced") gotPosts.push([x, z]);
  });
  assert.equal(gotPosts.length, wantPosts.length,
    `derived ${wantPosts.length} gallery-post stations against ${gotPosts.length} built`);
  const nearest = (got, want) => Math.min(...want.map(([wx, wz]) => Math.hypot(got[0] - wx, got[1] - wz)));
  for (const p of gotPosts) {
    const d = nearest(p, wantPosts);
    assert.ok(d <= STATION,
      `gallery post at (${p[0].toFixed(3)}, ${p[1].toFixed(3)}) stands ${d.toFixed(3)} m off every derived origin+k·pitch station`);
  }
  for (const w of wantPosts) {
    const d = Math.min(...gotPosts.map((p) => Math.hypot(p[0] - w[0], p[1] - w[1])));
    assert.ok(d <= STATION,
      `no built gallery post lands on derived station (${w[0].toFixed(3)}, ${w[1].toFixed(3)})`);
  }

  const TR = section.ground.treeRow;
  const galleryFaces = section.facades.filter((f) => f.system === "gallery");
  const gz = Math.max(...galleryFaces.flatMap((f) => [f.a[1], f.b[1]]));
  const gxWest = Math.min(...galleryFaces.flatMap((f) => [f.a[0], f.b[0]]));
  const rampX0 = gxWest + SYS.overlook.length + D.postSection;
  const rampX1 = rampX0 + SYS.ramp.run;
  const rampZ = gz + SYS.ramp.offset;
  const h0 = SYS.ramp.width / 2;
  const nx = Math.max(1, Math.round((TR.x1 - TR.x0) / D.cellMetres));
  const nz = Math.max(1, Math.round((TR.z1 - TR.z0) / D.cellMetres));
  const wantCells = [];
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const x = TR.x0 + ((i + 0.5) * (TR.x1 - TR.x0)) / nx;
      const z = TR.z0 + ((j + 0.5) * (TR.z1 - TR.z0)) / nz;
      if (x >= rampX0 && x <= rampX1 && z >= rampZ - h0 && z <= rampZ + h0) continue;
      wantCells.push([x, z]);
    }
  }
  const gotCells = [];
  eachInstance(group, (x, y, z, sc, o) => {
    if (o.name === "ground-south-tree-row-measured") gotCells.push([x, z]);
  });
  assert.equal(gotCells.length, wantCells.length,
    `derived ${wantCells.length} tree-row-cell stations against ${gotCells.length} built`);
  for (const p of gotCells) {
    const d = nearest(p, wantCells);
    assert.ok(d <= STATION,
      `tree-row cell at (${p[0].toFixed(3)}, ${p[1].toFixed(3)}) stands ${d.toFixed(3)} m off every derived cell station`);
  }
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

test("the material library is on the surfaces, and provenance is readable off the scene", () => {
  assert.match(moduleSrc, /sharedMaterialLibrary/, "surfaces come from campus-materials.js");
  const { group } = build();
  let textured = 0;
  group.traverse((o) => { if ((o.isMesh || o.isInstancedMesh) && o.material?.map) textured++; });
  assert.ok(textured >= 10, `only ${textured} textured meshes — the library is not applied`);

  /* EVERY DRAWN MESH DECLARES ITS TIER IN ITS NAME, so a render alone shows
     which half of this building is estimated. */
  const names = [];
  group.traverse((o) => { if ((o.isMesh || o.isInstancedMesh) && o.name) names.push(o.name); });
  assert.ok(names.length >= 25);
  for (const n of names) {
    assert.match(n, /-(measured|sourced|estimated)$/,
      `mesh "${n}" carries no tier — a render must show which half of this building is estimated`);
  }
  for (const must of [
    "hdhadmin-wall-concrete-estimated", "hdhadmin-wall-glazing-estimated",
    "roof-penthouse-pleat-blades-measured", "roof-penthouse-screen-blades-measured",
    "roof-west-volume-measured", "roof-nw-low-element-measured", "roof-plate-measured",
    "facade-gallery-decks-sourced", "facade-canopy-sourced", "facade-overlook-estimated",
    "ground-south-tree-row-measured", "ground-ramp-estimated", "ground-zigzag-stair-estimated",
  ]) assert.ok(names.includes(must), `no ${must} in the scene`);
  /* The two UNIDENTIFIED roof solids may be built and must NOT be named. */
  for (const forbidden of [/canopy-overrun/, /plant-enclosure/, /skylight/, /duct/, /lift/]) {
    assert.equal(names.some((n) => forbidden.test(n)), false,
      `a mesh name identifies a roof solid the sources do not identify (${forbidden})`);
  }
  /* The lettering is recorded and never rendered. */
  assert.equal(names.some((n) => /letter|sign|text/i.test(n)), false,
    "the building lettering is recorded in absent[] g17 and this repo has no text mechanism");
});

/* ------------------------------------------------------------- conflicts */

test("conflicts are declared and never averaged", () => {
  assert.ok(section.conflicts.length >= 8, `only ${section.conflicts.length} conflicts`);
  for (const c of section.conflicts) assert.ok(c.length > 250, `a conflict is a stub: ${c.slice(0, 60)}`);
  const j = section.conflicts.join("\n");
  for (const must of [
    /hdhadmin-prism-overshoot/, /hdhadmin-kitchen-area/, /hdhadmin-bay-slope-binning/,
    /hdhadmin-west-volume-overhang/, /hdhadmin-penthouse-white-frame/,
    /hdhadmin-osm-height-coincidence/, /hdhadmin-terrace-band-attribution/,
    /orthoColourRuling/,
  ]) assert.match(j, must, `conflicts[] no longer carries ${must}`);
  /* The prism conflict must name all five height figures, because the whole
     failure mode here is picking one of them for the wrong job. */
  const prism = section.conflicts.find((c) => c.startsWith("hdhadmin-prism-overshoot"));
  for (const fig of ["19.4", "19.8", "17.1", "15.6", "38.20"]) {
    assert.ok(prism.includes(fig), `the prism conflict no longer names the ${fig} figure`);
  }
  assert.match(prism, /NOT RESOLVED BY AVERAGING/i);
  /* And the kitchen conflict must keep both figures. */
  const kitchen = section.conflicts.find((c) => c.startsWith("hdhadmin-kitchen-area"));
  assert.ok(kitchen.includes("13,000") && kitchen.includes("8,000"),
    "the kitchen conflict must carry BOTH figures — averaging them is the failure it exists to prevent");
  /* A conflict may not be closed in prose while its identifying strings
     survive. Mutation (h): flipping kitchen-area to "RESOLVED: ..." kept
     both figures and the key; the suite stayed green. */
  for (const c of section.conflicts) {
    assert.ok(!/^[a-z0-9.-]+\s+[—–-]\s*RESOLVED\b/i.test(c),
      `conflict closed in prose: ${c.slice(0, 80)}`);
  }
});

test("the names, the identity trail and the epoch chain are all on the record", () => {
  for (const k of ["gis", "osm", "architect", "directory"]) {
    assert.ok(section.names[k] && section.names[k].length > 5, `names.${k} is missing`);
  }
  assert.equal(section.names.gis, MASS.n, "names.gis is not what the GIS actually says");
  assert.equal(section.names.osm, campus.buildings[section.measured.osmIndex].n,
    "names.osm is not what the OSM actually says");
  assert.match(section.names.note, /NOT a conflicts\[\] entry|no contradiction/i,
    "four names for one mass is a variance, not a conflict — say which");
  /* The site plan is the fourth identity witness AND is disqualified as a
     position source; losing either half breaks the trail. */
  assert.match(section.names.note, /site plan/i);
  assert.match(section.names.note, /NATURAL SCIENCES|SERVICE YARD/);
  assert.equal(section.credits.projectYear, R.published.projectYear);
  assert.match(section.measured.heights.note, /SWALLOWS THE PENTHOUSE/i,
    "the height note's whole job is saying which read swallows the penthouse");
  assert.match(section.measured.grades.note, /surfaceAt/,
    "the grade medians are recorded and must say they are never used as a constant");
});
