/* Argo Hall's photo-sourced detail section — the INVENTED class, at the ultra
 * standard.
 *
 * The Eighth audit proved that 22 presence gates will pass on wholesale
 * fabricated values, so almost nothing here merely checks that a key exists.
 * Every drawn figure is recomputed INDEPENDENTLY from the section's own
 * readings and must match; every drawn number must be covered by a
 * derivation, a labelled estimate that names the pattern it extends, or a
 * cited read; every surveyed ring must be byte-identical to the survey; and
 * the geometry is re-built on flat ground, on an exaggerated slope and on the
 * REAL drawn LiDAR surface, with nothing hovering, nothing sinking and
 * nothing crossing a surveyed facade.
 *
 * The section-level claims this file exists to hold Argo to:
 *
 *   - ARGO IS A DONUT. The court is open, its eight faces are built, and no
 *     lid is drawn over it. The old lid's keys must be gone AND recorded.
 *   - 18.70 m is the top of the COPING, so the roof deck is one parapet
 *     lower and everything on the plate sits on the deck.
 *   - the storey stack closes on 18.70 m with zero residual;
 *   - the ground storey is a solid base wall punched at ONE sourced opening,
 *     not a continuous colonnade;
 *   - colours are data, hex, WHITE, and every role carries a tier;
 *   - the absent list does not shrink, and retired claims leave through
 *     superseded[], never by deletion.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as THREE from "../docs/vendor/three/three.module.min.js";
/* S1 — the axiom-layer gate. ONE shared apparatus for all six R1 suites; this
   file must never fork or reimplement it. */
import {
  assertCoverage, assertEstimateBands, assertPins, assertRelations, assertTierSymmetry,
  assertAbsentEntries, assertExprs, assertDispositions,
} from "./helpers/axiom-gate.mjs";
import { createPhotoArgo } from "../docs/js/campus-photo-argo.js";
import { assembleMasses, roofElevation } from "../docs/js/campus-massing.js";
import { makeSurfaceSampler } from "../docs/js/campus-terrain.js";
import { overlayLift } from "../docs/js/campus-overlay.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(p, "utf8"));

/* The shipped document is the only source; PHOTO_DETAIL still lets a repair
   agent point the whole file at a candidate. */
const section = read(
  process.env.PHOTO_DETAIL || join(root, "docs/data/campus-photo-detail.json"),
).argo;

const campus = read(join(root, "docs/data/campus-3d.json"));
const lidar = read(join(root, "docs/data/campus-lidar.json"));
const arcgis = read(join(root, "docs/data/campus-arcgis.json"));
const staging = read(join(root, "docs/data/corridor-staging.json"));
const shipped = read(join(root, "docs/data/campus-photo-detail.json")).argo;
const osmRing = campus.buildings.find((b) => b.n === "Argo Hall").p;
const drawnGround = makeSurfaceSampler(lidar.terrain);
const moduleSrc = readFileSync(join(root, "docs/js/campus-photo-argo.js"), "utf8");

const MASSING = arcgis.massing[99];
const ring0 = MASSING.r[0].map(([x, z]) => [x / 10, z / 10]);
const ring1 = MASSING.r[1].map(([x, z]) => [x / 10, z / 10]);

const inRing = (x, z, r) => {
  let ins = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, zi] = r[i];
    const [xj, zj] = r[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
};
const seg = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const at = (o, path) => path.split(".").reduce((v, k) => (v == null ? v : v[k]), o);
const near = (a, b, eps, what) =>
  assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b} (tolerance ${eps})`);

/* Every figure whose value is inherited from the [estimated] grid.floorToFloor
   and is therefore STATED to the centimetre, with the tolerance that rounding
   costs: one half-centimetre per rounded input. */
const PRECISION = {
  "grid.parapet": 0.005,
  "grid.groundStorey": 0.005,
  "system.parapet.height": 0.005,
  "system.awning.depth": 0.005,
  "system.awning.proud": 0.0025,
  "system.corner.pilasterWidth": 0.005,
  "system.ground.height": 0.005,
  "court.gallery.beamDepth": 0.005,
  "court.screen.height": 0.01,
};

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

/* The maximum plan reach any OUTER facade layer is allowed off the measured
   wall — the staging route passes 1.6-2.3 m off the east face. */
function maxReach() {
  const S = section.system;
  return Math.max(
    S.cant.depth,
    S.awning.proud + S.awning.depth / 2,
    S.ground.columnProud + S.ground.columnSize,
    S.parapet.proud + S.parapet.thickness + section.draw.dripSpread,
    S.corner.nubProud + S.corner.nubSize / 2,
    S.corner.proud + S.corner.thickness
  );
}

function facadePoints() {
  const out = [];
  const reach = maxReach();
  for (const f of section.facades) {
    const nl = Math.hypot(f.out[0], f.out[1]);
    const nx = f.out[0] / nl;
    const nz = f.out[1] / nl;
    const n = Math.ceil(seg(f.a, f.b) / 2);
    for (let i = 0; i <= n; i++) {
      const x = f.a[0] + ((f.b[0] - f.a[0]) * i) / n;
      const z = f.a[1] + ((f.b[1] - f.a[1]) * i) / n;
      for (const w of [0.05, reach]) out.push([x + nx * w, z + nz * w]);
    }
  }
  return out;
}

/** Every solid the section stands on the OUTSIDE ground, as (x, z). */
function solids() {
  const N = section.ground.north;
  const out = [[N.planter.x, N.planter.z], [N.bench.x, N.bench.z]];
  const B = N.boardwalk;
  for (const x of [B.x0, B.x1]) for (const z of [B.z0, B.z1]) out.push([x, z]);
  return out;
}

/* ------------------------------------------------------- identity & record */

test("the section exists and carries the whole ultra apparatus", () => {
  assert.ok(section, "no argo section in the shipped doc");
  for (const k of ["label", "epoch", "note", "confidence", "seed", "bounds", "sources",
    "ring", "measured", "colors", "colorSources", "derivations", "estimates", "reads",
    "draw", "grid", "facades", "system", "court", "signage", "roof", "ground",
    "counts", "conflicts", "absent", "superseded"]) {
    assert.ok(section[k] !== undefined, `section is missing ${k}`);
  }
  assert.equal(typeof section.seed, "number");
});

test("it says what it is: a Revelle residence hall, a DONUT, white epoch, honest", () => {
  assert.match(section.label, /Argo/);
  assert.match(section.label, /Revelle/);
  assert.match(section.label, /NOT a Fleet hall/, "Argo must not be misattributed to the Fleet");
  assert.match(section.label, /DONUT/i, "the shape claim belongs in the label — it is what the revision turns on");
  assert.match(section.label, /INHERITED|UNVERIFIED/i,
    "the Tucker, Sadler & Bennett attribution could not be confirmed and must be demoted, not asserted");
  assert.match(section.epoch, /dead epoch/i, "the pre-2014 tan must be named a dead epoch");
  assert.match(section.epoch, /court/i,
    "the epoch rule must be extended to the court: the 2008 blue-and-mesh galleries are dead too");
  assert.match(section.note, /INVENTED/, "the note must declare the class");
  assert.ok(section.confidence.length > 200, "the confidence statement must be per-claim, not a word");
});

test("every source is described and dated, and the ladder's rungs are all named", () => {
  assert.ok(section.sources.length >= 10, `only ${section.sources.length} sources`);
  for (const s of section.sources) {
    assert.ok(s.length >= 80, `source is not described: ${s.slice(0, 70)}`);
    assert.match(s, /\b(19|20)\d\d\b/, `source has no date: ${s.slice(0, 70)}`);
  }
  const joined = section.sources.join("\n");
  for (const [what, re] of [
    ["Webcor's published area and scope", /webcor\.com/],
    ["Vasquez Marshall on Blake, the suite arithmetic", /vmarch\.net/],
    ["El Mac's own blog", /mac-arte\.blogspot\.com/],
    ["N18, the elevation every pixel reading comes off", /webcor-argo-N18/],
    ["N17, the frame that refutes the continuous colonnade", /webcor-argo-N17/],
    ["N9, the court gallery", /webcor-argo-N9/],
    ["the 2008 UC Regents deck, the planning-document rung", /UCRegents_2008-11-18/],
    ["the 2026 ortho", /chunk_4_6\.jpg/],
    ["the survey ring", /massing\[99\]/],
    ["the LiDAR read", /massHeights/],
    ["the Nov 2024 photosphere", /revelle\/sv\/argo\.jpg/],
  ]) assert.match(joined, re, `sources[] no longer cites ${what}`);
  /* The dead citation the section used to carry must not come back. */
  assert.equal(/vmarch-bradley_vma_argo_7a/.test(JSON.stringify(section.facades)), false,
    "a facade still cites vmarch-bradley_vma_argo_7a.jpg, whose page 404s today");
});

/* ---------------------------------------------------------- the arithmetic */

test("every drawn figure is the arithmetic its own readings give", () => {
  const R = section.derivations.readings;
  const IN = R.units.inch;
  /* Recomputed here from the readings ALONE — never from the section's own
     stated values — so a self-consistent fabrication cannot pass. */
  const Fpx = (R.px.windowHeads[4] - R.px.windowHeads[0]) / 4;
  const headSpan = R.px.windowHeads[1] - R.px.windowHeads[0];
  const parapetFrac = (R.px.soffitTop - 5 * Fpx - R.px.copingTop) / Fpx;
  const eastLength = seg([-20.2, 366.4], [-19.9, 403.8]);
  const module = eastLength / R.survey.outerBays;
  const F = section.grid.floorToFloor;
  const parapet = parapetFrac * F;
  const groundStorey = R.survey.massHeight - (5 + parapetFrac) * F;
  const sFrac = (R.px.windowHeads[1] - R.px.awningBottom) / headSpan;
  const aFrac = (R.px.awningBottom - R.px.fixedLightBottom) / headSpan;
  const finStoreys = R.published.levelsAboveGrade - 1;
  const backWall = [
    seg([-30.6, 377.0], [-30.5, 393.3]), seg([-30.5, 393.3], [-46.9, 393.4]),
    seg([-47.0, 377.1], [-30.6, 377.0]), seg([-46.9, 393.4], [-46.9, 389.2]),
    seg([-47.0, 381.3], [-47.0, 377.1]),
  ].reduce((s, v) => s + v, 0);
  const suitesPerLevel = (R.published.residences / finStoreys) / (R.published.blakeBedrooms / R.published.blakeSuites);
  const guardHeight = R.code.guardHeightIn * IN;
  const picketClear = R.code.guardSphereIn * IN;
  const picketDia = section.court.guard.picketDia;
  const beamDepth = sFrac * F;
  const doorW = R.code.doorLeafIn * IN;
  const screenW = 2 * doorW;
  let holeArea = 0;
  for (let i = 0; i < ring1.length - 1; i++) holeArea += ring1[i][0] * ring1[i + 1][1] - ring1[i + 1][0] * ring1[i][1];
  holeArea = Math.abs(holeArea) / 2;

  const expect = {
    "grid.finStoreys": finStoreys,
    "grid.module": module,
    "grid.parapetFrac": parapetFrac,
    "grid.parapet": parapet,
    "grid.groundStorey": groundStorey,
    "system.bands.windowFrac": (R.px.fixedLightBottom - R.px.windowHeads[0]) / headSpan,
    "system.bands.awningFrac": aFrac,
    "system.bands.spandrelFrac": sFrac,
    "system.awning.depth": aFrac * F * Math.sin(section.system.awning.tilt),
    "system.awning.proud": (aFrac * F * Math.sin(section.system.awning.tilt)) / 2,
    "system.parapet.height": parapet,
    "system.corner.pilasterWidth": section.system.corner.pilasterBays * module,
    "system.ground.height": groundStorey,
    "system.ground.baseWallRecess": section.system.cant.depth,
    "court.bedroomsPerSuite": R.published.blakeBedrooms / R.published.blakeSuites,
    "court.bedroomsPerLevel": R.published.residences / finStoreys,
    "court.suitesPerLevel": suitesPerLevel,
    "court.galleries": finStoreys,
    "court.galleryBackWall": backWall,
    "court.suiteSpacing": backWall / suitesPerLevel,
    "court.doorsPerLongWall": suitesPerLevel / 3,
    "court.guard.height": guardHeight,
    "court.guard.picketClear": picketClear,
    "court.guard.picketPitch": picketClear + picketDia,
    "court.guard.railSection": 2 * picketDia,
    "court.guard.railMidHeight": guardHeight / 2,
    "court.guard.railLowHeight": picketClear,
    "court.gallery.clear": R.code.corridorClearIn * IN,
    "court.gallery.beamThickness": R.cmu.thicknessIn * IN,
    "court.gallery.beamDepth": beamDepth,
    "court.gallery.deckThickness": R.cmu.thicknessIn * IN,
    "court.gallery.projection": R.code.corridorClearIn * IN + R.cmu.thicknessIn * IN,
    "court.cmu.course": R.cmu.courseIn * IN,
    "court.cmu.length": R.cmu.lengthIn * IN,
    "court.door.width": doorW,
    "court.door.height": R.code.doorHeightIn * IN,
    "court.sconce.height": R.code.doorHeightIn * IN,
    "court.plaque.size": R.cmu.courseIn * IN,
    "court.plaque.height": R.code.signCentreIn * IN,
    "court.screen.width": screenW,
    "court.screen.height": F - beamDepth - guardHeight,
    "court.screen.slatPitch": R.cmu.courseIn * IN,
    "court.screen.slats": Math.floor(screenW / (R.cmu.courseIn * IN)),
    "court.screen.slatSection": 2 * picketDia,
    "court.floor.cell": module,
    "court.floor.area": holeArea,
    "court.tree.x": -37.25 - R.ortho.priorDx + R.ortho.dx,
    "court.tree.z": 385.95 - R.ortho.priorDz + R.ortho.dz,
  };

  const figures = section.derivations.figures;
  assert.deepEqual(Object.keys(figures).sort(), Object.keys(expect).sort(),
    "the derivation table and this test's independent recomputation must cover the same figures");
  for (const [path, want] of Object.entries(expect)) {
    const decl = figures[path];
    /* BASELINE CHANGE (R2 S1 vi): `expr` is arithmetic now and is often shorter
       than the prose it replaced, so the length gate moves to `derivation`. */
    assert.ok(decl && decl.expr, `${path} has no stated derivation`);
    assert.ok(decl.derivation && decl.derivation.length > 20, `${path} lost the prose behind its expr`);
    /* BASELINE CHANGE (R2 P4, argo findings 9 and 10): a figure inherited from
       grid.floorToFloor — an [estimated] 2.80 m inside a 2.66-2.85 m band, i.e.
       +/-3.4 % — is stated to the centimetre, so it is checked against the full
       arithmetic to the half-centimetre that rounding can cost, and to one
       half-centimetre per rounded input where two of them compound. This is not
       a slackened gate: PRECISION is a per-figure declaration of how coarse the
       shipped statement is, and every figure not in it is still held to 5e-6. */
    const tol = PRECISION[path] ?? 5e-6;
    near(decl.value, want, tol, `${path}: the section STATES ${decl.value}, its own readings give`);
    near(at(section, path), want, tol, `${path}: the section SHIPS ${at(section, path)}, its own readings give`);
  }

  /* The solve closes on the LiDAR plane with zero residual, and closes on the
     figures the section actually ships rather than on this test's copies. */
  const g = section.grid;
  near(g.groundStorey + 5 * g.floorToFloor + g.parapet, R.survey.massHeight, 1e-9,
    "the storey stack does not close on the drawn mass's LiDAR height");
  near(g.storeys, R.published.levelsAboveGrade, 0, "storeys");
  /* The ground storey is TALLER than a residential storey — the correction
     the shipped six-equal-storeys solve got backwards. */
  assert.ok(g.groundStorey > g.floorToFloor,
    `ground storey ${g.groundStorey} is not taller than the residential ${g.floorToFloor} — the walk-under fails`);
  assert.ok(g.parapet > 1.2, "the parapet must exceed the superseded 1.2 m it replaced");
  /* Three bands, one storey, exactly. */
  const B = section.system.bands;
  near(B.windowFrac + B.awningFrac + B.spandrelFrac, 1, 1e-9, "the band fractions must fill the storey");
  /* And a 10 ft floor-to-floor really is ruled out, which is the claim the
     anchor note makes. */
  assert.ok(R.survey.massHeight - (5 + section.grid.parapetFrac) * (10 * R.units.foot) < 2,
    "the anchorNote claims a 10 ft storey leaves an impossible ground storey — the arithmetic must say so");
});

test("the mural's scale is the arithmetic its coursing gives, and it is not built", () => {
  const M = section.court.mural;
  const IN = section.derivations.readings.units.inch;
  const course = section.derivations.readings.cmu.courseIn * IN;
  near(M.framedWidth, (1022 / 31.9) * course, 5e-3, "mural framed width from the 31.9 px bed-joint pitch");
  near(M.framedHeight, (1440 / 31.9) * course, 5e-3, "mural framed height");
  /* The evidence is that 6.51 m equals a surveyed wall on this building. */
  const faces = section.court.faces.filter((f) => Math.abs(f.length - M.framedWidth) < 0.2);
  assert.ok(faces.length >= 1, "the mural's framed width no longer matches any surveyed face — the evidence is gone");
  assert.deepEqual(M.candidateFaces.slice().sort(), ["I3", "I5"]);
  assert.equal(M.built, false, "a living artist's attributed work may not be approximated procedurally");
  assert.equal(M.painted, 2015, "signed ELMAC MMXV; the blog post is the 2016 publication of a 2015 work");
  assert.equal(Object.keys(M.palette).length, 5);
  for (const hex of Object.keys(M.palette)) assert.match(hex, /^#[0-9a-f]{6}$/);
  /* And the palette must NOT leak into colors[], which is what gets drawn. */
  for (const hex of Object.keys(M.palette)) {
    assert.equal(Object.values(section.colors).includes(hex), false,
      `${hex} is a mural hex and it has reached the drawn palette`);
  }
});

/* ------------------------------------------------------- S1: the axiom layer */

/* S1(iii). Every reading with an external truth, pinned to a literal HERE, so
   moving it in the section moves it away from its artefact and fails. The
   namespaces below are pinned EXHAUSTIVELY: a new unpinned reading cannot be
   added to a pinned block. */
const N18 = "webcor-argo-N18.jpg (4000 x 2667), the near-orthographic east elevation, vertical read down one column band, crop origin x = 0.19 W / y = 0.44 H";
const IBC = "IBC 2021 as cited in derivations.readings.code.source";
const ORTHO = "docs/data/textures/chunk_4_6.jpg, the Google (c)2026 z20 ortho at 8 px/m, four-feature edge fit";
const pin = (value, truth, tol) => ({ value, truth, ...(tol === undefined ? {} : { tol }) });
const READING_PINS = {
  "units.inch": pin(0.0254, "the international inch, 25.4 mm exactly by definition"),
  "units.foot": pin(0.3048, "the international foot, 12 inches exactly by definition"),

  "px.copingTop": pin(143, N18),
  "px.windowHeads.0": pin(188, N18),
  "px.windowHeads.1": pin(291, N18),
  "px.windowHeads.2": pin(393, N18),
  "px.windowHeads.3": pin(496, N18),
  "px.windowHeads.4": pin(599, N18),
  "px.fixedLightBottom": pin(248, N18),
  "px.awningBottom": pin(268, N18),
  "px.soffitTop": pin(713, N18),
  "px.bayPitch": pin(46.6, `${N18} — 33 pier peaks across the storey-3 window band, 27 intervals`),
  "px.bayPitchSd": pin(0.5, `${N18} — the sd of those 27 pier-pitch intervals`),
  "px.parapetSpan": pin(1415, `${N18} — corner-to-corner across the parapet band; HALF of a declared conflict`),
  "px.pierRunSpan": pin(1440, `${N18} — first pier to last pier; the other half of that conflict`),

  "survey.massHeight": pin(18.7, "docs/data/campus-lidar.json massHeights['m:-40,383'], the 2014 flight over the GIS ring"),
  "survey.ringHeight": pin(18.4, "docs/data/campus-lidar.json heights['Argo Hall'], the same flight over the OSM ring"),
  "survey.formulaHeight": pin(18.3, "docs/data/campus-arcgis.json massing[99].h, a FORMULA of 6 levels x 3.050 m"),
  "survey.levels": pin(6, "docs/data/campus-arcgis.json massing[99].levels"),
  "survey.outerBays": pin(30, `${N18} — the pier-peak COUNT across one full elevation, foreshortening-immune`),
  "survey.eastFaceLength": pin(37.401203, "campus-arcgis massing[99] ring 0, the east face (-20.2, 366.4)-(-19.9, 403.8)"),

  "published.gsf": pin(74836, "Webcor's project page for the 2015-16 Argo Hall Renovation: 74,836 sf"),
  "published.levelsAboveGrade": pin(6, "Webcor's project page: six levels above grade"),
  "published.residences": pin(180, "Webcor's project page: 180 student residences"),
  "published.blakeSuites": pin(12, "Vasquez Marshall's Blake Hall page: 12 residential suites"),
  "published.blakeBedrooms": pin(72, "Vasquez Marshall's Blake Hall page: 72 bedrooms"),
  "published.blakeFloors": pin(2, "Vasquez Marshall's Blake Hall page: over 2 floors"),

  "cmu.courseIn": pin(8, "standard 8 in concrete-masonry coursing, confirmed by the El Mac mural's bed-joint scan"),
  "cmu.lengthIn": pin(16, "standard 16 in concrete-masonry unit length, running bond"),
  "cmu.thicknessIn": pin(8, "standard 8 in concrete-masonry unit thickness"),

  "code.guardHeightIn": pin(42, `${IBC} §1015.3, guards not less than 42 in high`),
  "code.guardSphereIn": pin(4, `${IBC} §1015.4, no opening passing a 4 in sphere`),
  "code.corridorClearIn": pin(44, `${IBC} §1020.3, corridor minimum clear width 44 in`),
  "code.doorLeafIn": pin(36, `${IBC} §1010.1.1, door leaves 36 in wide minimum`),
  "code.doorHeightIn": pin(80, `${IBC} §1010.1.1, door leaves 80 in high minimum`),
  "code.signCentreIn": pin(60, "ICC A117.1 §703.4, room-identification sign baseline 48-60 in above the floor"),

  "ortho.dx": pin(0.93, `${ORTHO} — the accepted x correction`),
  "ortho.dz": pin(3.78, `${ORTHO} — the accepted z correction`),
  "ortho.priorDx": pin(1.75, "docs/data/campus-photo-detail.json argo.roof: the SHIPPED plate-centre x correction"),
  "ortho.priorDz": pin(4.15, "docs/data/campus-photo-detail.json argo.roof: the SHIPPED plate-centre z correction"),
  "ortho.priorTreeX": pin(-37.25, "docs/data/campus-photo-detail.json argo.roof.tree.x, the shipped ortho crown read"),
  "ortho.priorTreeZ": pin(385.95, "docs/data/campus-photo-detail.json argo.roof.tree.z, the shipped ortho crown read"),
};

/* S1(i). `draw` is render offsets, not dimensions — and R1 walked none of them.
   Each is pinned to a literal here with the rule that fixes it, because an
   offset nobody checks is the easiest place in the file to hide a dimension. */
const DRAW_PINS = {
  wallOffset: pin(0.03, "the depth a wall-plane decal stands off the surveyed face so it resolves without z-fighting"),
  bandThickness: pin(0.06, "the thickness every applied band is drawn at; the wall offset must stay under it"),
  glassOffset: pin(0.02, "glazing sits this far in front of the spandrel plane so the two never co-plane"),
  glassInset: pin(0.06, "the glazing is inset this far from the opening's jambs, inside the reveal"),
  glassInsetV: pin(0.12, "the vertical counterpart of glassInset, twice it, because heads and sills are deeper"),
  sashThickness: pin(0.05, "the drawn thickness of the awning sash frame — a render solid, not a measured section"),
  sashInset: pin(0.08, "the sash sits this far inside its opening so its frame reads against the reveal"),
  revealShorten: pin(0.1, "the canted reveal is drawn this much short of the opening so it never pierces the pier"),
  pierClear: pin(0.04, "the clear the pier keeps from the opening edge so adjacent bays do not merge"),
  dripOffset: pin(0.03, "the drip cap stands this far off the parapet face"),
  dripSpread: pin(0.06, "the drip cap's outward spread; it is inside the outer-reach gate maxReach() enforces"),
  jointOffset: pin(0.005, "the panel-joint decal's standoff, the smallest offset in the file and under wallOffset"),
  jointWidth: pin(0.03, "the drawn width of a precast panel joint groove"),
  jointDepth: pin(0.02, "the drawn depth of that groove, shallower than it is wide"),
  jointShorten: pin(0.15, "the joint is drawn short of the band it runs in so it does not overshoot the panel"),
  nubInset: pin(0.35, "the corner bracket's inset from the corner, so a bracket never overhangs two faces at once"),
  recessInset: pin(0.4, "the colonnade recess plane is drawn inside its opening by this much on each side"),
  skirtDrop: pin(0.3, "how far a ground-meeting wall is skirted BELOW the drawn surface so no terrain triangle shows"),
  footingDrop: pin(0.15, "the same idea for a column: its footing continues below the drawn surface"),
  soffitOffset: pin(0.12, "the oversailing soffit's standoff from the wall plane"),
  soffitThickness: pin(0.24, "the drawn thickness of that soffit slab, twice its standoff"),
  plateInset: pin(0.15, "the roof membrane is clipped this far inside the plate so it never shows past the coping"),
  membraneLift: pin(0.02, "the membrane sits this far above the roof deck — a decal lift, not a build-up"),
  stainLift: pin(0.03, "a stain decal sits above the membrane by more than the membrane sits above the deck"),
  stainAspect: pin(0.6, "the short-to-long axis ratio the ortho's patch stains are drawn at"),
  soilDrop: pin(0.08, "the planter's soil surface is drawn this far below its wall's top"),
  benchSlab: pin(0.06, "the drawn thickness of the bench seat slab"),
  benchLeg: pin(0.06, "the drawn section of a bench leg, the same stock as the slab"),
  benchLegFrac: pin(0.4, "where along the bench the legs stand, as a fraction of its length from each end"),
  benchLegInset: pin(0.1, "how far the legs are inset from the seat's edge"),
  courtFloorGap: pin(0.02, "the gap left between court floor cells so adjacent cells never z-fight on a slope"),
  "tiles.plank": pin(1.4, "texture repeats per metre for the boardwalk plank class"),
  "tiles.slat": pin(1.2, "texture repeats per metre for the slat class"),
  "tiles.membraneTilesPerJoint": pin(4, "membrane texture tiles per expansion-joint bay, so the grid reads at 3 m"),
  "tiles.cmuCourses": pin(8, "courses per masonry texture tile — the York convention, eight courses each way"),
};

/* S1(v). `absent` was gated by LIST LENGTH, which cannot tell a retirement from
   a deletion. Every entry now has a stable key and a probe for what it
   withholds; an entry may leave only by being BUILT and said so here. */
const ABSENT = {
  westDoor: /West\/rear entrance/,
  mural: /EL MAC'S 'AN ENDURING SPELL' — RESOLVED/,
  retiredCourtyard: /SUPERSEDED, KEPT IN THE RECORD/,
  eastFrontage: /planter wall, clipped hedge/,
  lamps: /globe-headed and cantilever-head lamp posts/,
  planterTrees: /TWO mature plane\/sycamore-type trees/,
  parapetLettering: /'ARGO HALL' parapet lettering/,
  curbHeights: /curb HEIGHTS/,
  roofDeck: /THE ROOF DECK AND EVERYTHING THAT STANDS ON IT/,
  service: /Loading dock/,
  lobbyDoors: /Ground-floor lobby doors/,
  buildDate: /Construction date 1966/,
  breezeway: /BREEZEWAY'S POSITION/,
  galleryDepth: /GALLERY'S DEPTH/,
  screenRhythm: /SLAT SCREENS' RHYTHM/,
  courtFloorFinish: /COURT FLOOR'S MATERIAL/,
  benchAndBed: /BENCH'S LENGTH/,
  splay: /SPLAY ANGLE/,
  courtGroundStorey: /COURT'S GROUND-STOREY CONDITION/,
  photosphereCache: /CACHED COPY OF THE NOVEMBER 2024/,
  exitSigns: /EXIT SIGNS, WAYFINDING/,
  legacyRacks: /BIKE-RACK RUN IS NOT REBUILT/,
  argoBlakeGapGround: /ARGO-BLAKE GAP'S GROUND SURFACE/,
};

const absentEntries = () => {
  const out = section.absent.map((text) => {
    const hits = Object.entries(ABSENT).filter(([, re]) => re.test(text));
    assert.equal(hits.length, 1,
      `absent entry matches ${hits.length} known probes, not one: ${text.slice(0, 70)}`);
    return { key: hits[0][0], text };
  });
  assert.equal(new Set(out.map((e) => e.key)).size, out.length, "two absent entries share one key");
  return out;
};

test("S1(i): no number anywhere in the axiom layer is uncovered", () => {
  const exempt = section.derivations.exempt;
  const derived = new Set(Object.keys(section.derivations.figures));
  const est = section.estimates;
  const reads = section.reads;
  const classify = (path) => {
    if (path.startsWith("derivations.readings.")) {
      return READING_PINS[path.slice("derivations.readings.".length)] ? "pinned" : null;
    }
    if (path.startsWith("draw.")) return DRAW_PINS[path.slice("draw.".length)] ? "pinned" : null;
    if (/^estimates\..+\.(value|band\.[01])$/.test(path)) return "banded";
    return derived.has(path) ? "derived" : est[path] ? "estimated" : reads[path] ? "read" : null;
  };
  /* BASELINE CHANGE (R2 S1 i): the walk covered the DRAWN blocks only. It now
     also walks the readings the figures derive FROM, the estimates they
     inherit, and the `draw` block, whose 35 numbers nothing checked at all. */
  const paths = assertCoverage({
    section,
    roots: {
      grid: exempt, system: exempt, court: exempt, roof: exempt, ground: exempt,
      "derivations.readings": {}, estimates: {}, draw: {},
    },
    classify,
    uncovered: {},
    minimum: 200,
    label: "argo",
  });
  assert.ok(paths.filter((p) => p.path.startsWith("draw.")).length >= 33,
    "the draw block is what this extension exists for and it did not get walked");

  for (const [p, e] of Object.entries(est)) {
    if (p === "why") continue;
    assert.match(e.why, /\[estimated\]/, `${p} must carry the [estimated] label`);
    assert.ok(e.extends && e.extends.length > 25, `${p} must record which sourced pattern it extends`);
    near(at(section, p), e.value, 5e-6, `${p} ships a value its estimate does not state`);
  }
  for (const [p, r] of Object.entries(reads)) {
    if (p === "why") continue;
    assert.ok(r.source && r.source.length > 40, `${p} must name the frame, survey or clause it is read off`);
    assert.equal(typeof r.tolerance, "number", `${p} must carry the tolerance its source supports`);
    near(at(section, p), r.value, 5e-6, `${p} ships a value its read does not state`);
  }
  /* One number, one provenance. */
  for (const p of Object.keys(est)) {
    if (p === "why") continue;
    assert.ok(!derived.has(p) && !reads[p], `${p} claims two provenances`);
  }
  for (const [p, why] of Object.entries(exempt)) {
    assert.ok(why.length > 80, `exemption ${p} is unmotivated: ${why.slice(0, 50)}`);
  }
});

test("S1(ii): every estimate carries a machine-readable band and ships inside it", () => {
  const n = assertEstimateBands({
    estimates: section.estimates,
    valueAt: (key) => at(section, key),
    skip: ["why"],
    label: "argo",
  });
  assert.equal(n, 30, "every estimate is banded and the count is declared here");
  /* The acceptance test S1(ii) names: the band is the section's OWN published
     2.66-2.85 m, so 2.25 m — 0.41 m outside it — cannot be reached. */
  assert.deepEqual(section.estimates["grid.floorToFloor"].band, [2.66, 2.85]);
  for (const bad of [2.25, 3.048]) {
    assert.throws(
      () => assertEstimateBands({
        estimates: { "grid.floorToFloor": { ...section.estimates["grid.floorToFloor"], value: bad } },
        valueAt: () => bad,
        label: "argo",
      }),
      /outside its own published band/,
      `grid.floorToFloor can still reach ${bad} m`,
    );
  }
  /* And a band must never be usable as a place to park a value the section
     does not actually ship. */
  assert.throws(
    () => assertEstimateBands({
      estimates: section.estimates, valueAt: (k) => (k === "court.tree.height" ? 2.39 : at(section, k)),
      skip: ["why"], label: "argo",
    }),
    /ships 2\.39 but states 2\.4/,
  );
});

test("S1(iii): every reading with an external truth is pinned to that truth", () => {
  const R = section.derivations.readings;
  assert.equal(
    assertPins({
      readings: R,
      pins: READING_PINS,
      namespaces: ["units", "px", "survey", "published", "cmu", "code", "ortho"],
      label: "argo",
    }),
    Object.keys(READING_PINS).length,
  );
  /* The `draw` offsets are pinned the same way and for the same reason: the
     coverage walk only asks that a number be accounted for, so without a pin a
     render offset could be moved to any value and stay "covered". */
  assert.equal(
    assertPins({ readings: section.draw, pins: DRAW_PINS, namespaces: ["tiles"], label: "argo draw" }),
    Object.keys(DRAW_PINS).length,
  );
  assert.throws(() => assertPins({
    readings: { ...section.draw, wallOffset: 0.3 }, pins: DRAW_PINS, label: "argo draw",
  }), /wallOffset/, "a render offset could be moved by a factor of ten");

  /* The two acceptance mutations S1(iii) names by hand. */
  assert.throws(() => assertPins({
    readings: { ...R, code: { ...R.code, corridorClearIn: 88 } }, pins: READING_PINS, label: "argo",
  }), /code\.corridorClearIn/, "corridorClearIn could go 44 -> 88");
  assert.throws(() => assertPins({
    readings: { ...R, published: { ...R.published, residences: 270 } }, pins: READING_PINS, label: "argo",
  }), /published\.residences/, "published.residences could go 180 -> 270");
  /* A new reading may not appear inside a pinned block unpinned. */
  assert.throws(() => assertPins({
    readings: { ...R, code: { ...R.code, sillHeightIn: 30 } }, pins: READING_PINS,
    namespaces: ["code"], label: "argo",
  }), /is not pinned/);

  /* And every relation the section states in PROSE about its own readings is
     asserted, because a reading moved consistently with its neighbours is what
     survived R1's mutation testing. */
  const IN = R.units.inch;
  const heads = R.px.windowHeads;
  const Fpx = (heads[4] - heads[0]) / 4;
  assertRelations({
    label: "argo",
    relations: [
      { name: "the foot is twelve inches", got: R.units.foot, want: 12 * IN },
      { name: "N18's storey pitch, stated as 102.75 px in grid.parapetFrac", got: Fpx, want: 102.75 },
      ...heads.slice(1).map((h, i) => ({
        name: `window head ${i} -> ${i + 1} is one storey pitch (px.source: no systematic drift end to end)`,
        /* The heads are INTEGER pixel reads of a 102.75 px pitch, so each one
           may sit a pixel either side of the ideal; anything beyond that is
           drift, which the source says is not there. */
        got: h - heads[i], want: Fpx, tol: 1,
      })),
      { name: "the two span reads do not reconcile, and the conflict is 25 px (conflicts[4])",
        got: R.px.pierRunSpan - R.px.parapetSpan, want: 25 },
      { name: "bayNote: the N18 pitch ratio is 46.6 / 102.75 = 0.453",
        got: R.px.bayPitch / Fpx, want: 0.453, tol: 0.001 },
      { name: "survey.formulaHeightSource: massing[99].h is 6 levels x 3.050 m",
        got: R.survey.formulaHeight, want: R.survey.levels * 3.05, tol: 5e-6 },
      { name: "survey.eastFaceLength is the survey ring's own east face",
        got: R.survey.eastFaceLength,
        want: (() => { const e = section.facades.find((f) => f.id === "east"); return seg(e.a, e.b); })(),
        tol: 5e-6 },
      { name: "published: 180 over 5 residential levels is Blake's own 72 over 2",
        got: R.published.residences / (R.published.levelsAboveGrade - 1),
        want: R.published.blakeBedrooms / R.published.blakeFloors },
      { name: "code.source: the 42 in guard lands inside N9's 1.05-1.10 m read",
        got: R.code.guardHeightIn * IN, want: 1.075, tol: 0.026 },
      { name: "cmu.source: 1022 px / 31.92 px per course at 8 in is the core's surveyed 6.5 m face",
        got: (1022 / 31.92) * R.cmu.courseIn * IN, want: 6.5, tol: 0.01 },
      { name: "ortho.source: the correction's magnitude is 3.89 m",
        got: Math.hypot(R.ortho.dx, R.ortho.dz), want: 3.89, tol: 0.005 },
      { name: "ortho.source: 0.208 m of displacement per metre of height",
        got: Math.hypot(R.ortho.dx, R.ortho.dz) / R.survey.massHeight, want: 0.208, tol: 0.001 },
    ],
  });
});

test("S1(iv): the tier gate runs BOTH ways over colours and estimates", () => {
  const entries = [
    ...Object.entries(section.colorSources).map(([key, text]) => ({ key: `colorSources.${key}`, text })),
    ...Object.entries(section.estimates)
      .filter(([k]) => k !== "why")
      .map(([key, e]) => ({ key: `estimates.${key}`, text: e.why })),
  ];
  assertTierSymmetry({ entries, label: "argo" });
  /* C0 Fact Three: argo's [sourced] hexes rest on a frame nobody can re-open,
     and the flag is on the line itself rather than only in absent[]. */
  for (const role of ["column", "parapet", "precastAmbient", "spandrel", "windowFrosted", "precast"]) {
    assert.match(section.colorSources[role], /^\[sourced\]/, `${role} is KEPT at [sourced] by the R2 arbitration`);
    assert.match(section.colorSources[role], /NOT CACHED IN THIS REPO/,
      `${role} must carry the uncacheable-citation flag on its own line`);
  }
  assert.match(section.colorSources.doorBronze, /UNCACHED NOVEMBER 2024 FRAME/,
    "doorBronze is KEPT, and the hex it inherits rests on the same uncached frame — say so here");
  /* A promotion must fail: an [estimated] line relabelled [sourced] because it
     cites the parent it extends. */
  assert.throws(() => assertTierSymmetry({
    entries: [{ key: "colorSources.benchWood", text: section.colorSources.benchWood.replace("[estimated]", "[sourced]") }],
    label: "argo",
  }), /hedges/);
});

test("S1(v): every absent entry is held by a stable key and a probe", () => {
  const entries = absentEntries();
  assert.equal(assertAbsentEntries({ absent: entries, expected: ABSENT, label: "argo" }), entries.length);
  assert.equal(entries.length, 23,
    "21 R1 withholdings, plus the Argo-Blake gap's ground assigned in R2, plus the roof deck withheld in visual round 2");
  /* BASELINE CHANGE (R2 S1 v): the list-length gate is replaced, but the list
     still may not shrink — that claim was never the problem with it. */
  /* 21 is the R1 merge-day count; the floor is a literal so a shrink cannot
     hide behind re-reading the same document it edited. */
  assert.ok(section.absent.length >= 21,
    `absent went from 21 to ${section.absent.length} — this list does not shrink`);
  /* A withholding may not leave silently, and may not be replaced by another. */
  assert.throws(() => assertAbsentEntries({
    absent: entries.filter((e) => e.key !== "galleryDepth"), expected: ABSENT, label: "argo",
  }), /may not leave silently/);
  assert.throws(() => assertAbsentEntries({
    absent: entries.map((e) => (e.key === "breezeway" ? { key: e.key, text: "not resolved" } : e)),
    expected: ABSENT, label: "argo",
  }), /no longer says what it withholds/);
});

test("S1(vi): every expr is arithmetic, is EVALUATED, and reproduces its own value", () => {
  const R = section.derivations.readings;
  /* The evaluator's scope: the section's own readings, its own shipped
     figures, and two adapters — `px` for the window-head array, which the
     expression grammar cannot index, and `face` for the surveyed court-face
     lengths, which the suite has already checked against the survey ring. */
  const scope = {
    r: R,
    s: section,
    px: { ...R.px, head0: R.px.windowHeads[0], head1: R.px.windowHeads[1], head4: R.px.windowHeads[4] },
    face: Object.fromEntries(section.court.faces.map((f) => [f.id, f.length])),
  };
  const { evaluated, prose } = assertExprs({ figures: section.derivations.figures, scope, label: "argo" });
  assert.equal(evaluated, 48, "all 48 figures evaluate — none was left as prose under the name `expr`");
  assert.equal(prose, 0);
  /* An expr referencing a reading that does not exist is a hard failure, and
     an expr rewritten to a formula that does not give its own value fails. */
  assert.throws(() => assertExprs({
    figures: { "court.gallery.clear": { value: 1.1176, expr: "r.code.corridorClearWidth * r.units.inch" } },
    scope, label: "argo",
  }), /does not exist/);
  assert.throws(() => assertExprs({
    figures: { "court.door.width": { value: 0.9144, expr: "r.code.doorHeightIn * r.units.inch" } },
    scope, label: "argo",
  }), /does not reproduce its own value/);
  assert.throws(() => assertExprs({
    figures: { "grid.module": { value: 1.246707, expr: "the GIS ring's east face over 30 bays" } },
    scope, label: "argo",
  }), /illegal character|does not exist|does not reproduce/);
});

test("S2: the item that names argo as its successor declares what happened to it", () => {
  const claims = section.supersededClaims;
  const items = Object.entries(claims).map(([key, c]) => ({
    key, disposition: c.disposition, sup: c.sup, detail: c.detail,
  }));
  assert.equal(assertDispositions({ items, label: "argo" }), 1);
  const racks = claims["revelle.racks#z362.5-x-53..-39.8"];
  assert.equal(racks.disposition, "deleted-on-evidence",
    "seven hoops -> argo is a DELETION on evidence, not a transfer; the field must not say the opposite");
  assert.equal(racks.ships, false);
  assert.equal(racks.count, 0);
  assert.match(racks.detail, /not one bike hoop/i, "a deletion on evidence states its ground");
  assert.equal(section.ground.racks, undefined, "and argo ships no successor object for them");
  /* A deletion may not be quietly re-labelled a transfer to make a walk pass,
     because argo would then have to ship the objects and it does not. */
  assert.throws(() => assertDispositions({
    items: items.map((it) => ({ ...it, disposition: "transferred" })), reciprocals: {}, label: "argo",
  }), /carries no reciprocal claim/);
  assert.throws(() => assertDispositions({
    items: items.map((it) => ({ ...it, disposition: undefined })), label: "argo",
  }), /no `disposition`/);
});

/* ------------------------------------------------------------- the survey */

test("every surveyed ring is the survey, byte for byte", () => {
  assert.equal(MASSING.n, "Revelle Residence Hall - Argo", "massing[99] moved");
  assert.deepEqual(section.measured.mass.ring, ring0, "the outer ring is not massing[99].r[0] at /10");
  assert.deepEqual(section.measured.mass.hole, ring1,
    "the COURT ring is not massing[99].r[1] at /10 — this is the ring the whole revision turns on");
  assert.deepEqual(section.measured.ring, osmRing, "measured.ring must stay the full OSM survey ring for the rim-median seat");
  const drawn = assembleMasses({ campus, lidar, arcgis, colors: null })
    .find((m) => m.name === "Argo Hall" && m.src === "gis");
  assert.ok(drawn, "no drawn 'Argo Hall' gis mass");
  assert.equal(section.measured.mass.h, drawn.h, "mass.h drifted from the height campus-massing.js extrudes");
  assert.deepEqual(section.measured.mass.ring, drawn.rings[0]);
  assert.deepEqual(section.measured.mass.hole, drawn.rings[1],
    "campus-massing.js no longer extrudes the court as a hole — the section's premise would be gone");
  assert.equal(section.measured.lidarHeight, lidar.heights["Argo Hall"]);
  assert.equal(section.measured.mass.h, lidar.massHeights["m:-40,383"]);
  /* The area argument is arithmetic and it must still work. */
  const A = section.measured.mass.areas;
  const SF = 10.7639104;
  assert.ok(Math.abs(A.plate * 6 * SF / section.derivations.readings.published.gsf - 1) < 0.05,
    "the donut no longer reproduces Webcor's published area");
  assert.ok(A.outer * 6 * SF / section.derivations.readings.published.gsf - 1 > 0.15,
    "a solid prism must still miss Webcor's area badly — that comparison is the proof");
});

test("every facade hangs off two vertices of the ring that actually extrudes", () => {
  const cx = ring0.reduce((s, p) => s + p[0], 0) / ring0.length;
  const cz = ring0.reduce((s, p) => s + p[1], 0) / ring0.length;
  for (const f of section.facades) {
    for (const p of [f.a, f.b]) {
      assert.ok(ring0.some(([x, z]) => x === p[0] && z === p[1]),
        `${f.id}: ${JSON.stringify(p)} is not a vertex of massing[99] ring 0`);
    }
    assert.notDeepEqual(f.a, f.b, `${f.id} is a zero-length face`);
    const mx = (f.a[0] + f.b[0]) / 2 - cx;
    const mz = (f.a[1] + f.b[1]) / 2 - cz;
    assert.ok(mx * f.out[0] + mz * f.out[1] > 0, `${f.id}'s normal points into the building`);
    assert.equal(f.finStoreys, section.grid.finStoreys, `${f.id} disagrees with the grid`);
    assert.ok(f.source.length > 60, `${f.id} has no real source line`);
    /* The module must land where the count says it does. */
    const m = seg(f.a, f.b) / section.grid.longFaceBays;
    assert.ok(m > 1.207 && m < 1.29, `${f.id}: module ${m.toFixed(3)} m is outside the +/-1-bay band`);
  }
  assert.equal(section.facades.length, 4, "a square donut wears four outer faces");
  /* The four outer faces must cover the whole ring, not a subset of it. */
  const total = section.facades.reduce((s, f) => s + seg(f.a, f.b), 0);
  near(total, section.measured.mass.segments.outerPerimeter, 0.05, "the four faces do not close the ring");
});

test("the court's eight faces are the survey hole, and they face into the court", () => {
  const faces = section.court.faces;
  assert.equal(faces.length, 8, "ring 1 has eight segments and all eight must ship");
  const chain = faces.map((f) => f.a);
  assert.deepEqual(chain, ring1.slice(0, 8), "the court faces are not ring 1 walked in order");
  assert.deepEqual(faces[7].b, ring1[8], "the court ring does not close");
  const cx = ring1.slice(0, 8).reduce((s, p) => s + p[0], 0) / 8;
  const cz = ring1.slice(0, 8).reduce((s, p) => s + p[1], 0) / 8;
  for (const f of faces) {
    near(f.length, seg(f.a, f.b), 1e-6, `${f.id} length`);
    assert.equal(Math.hypot(f.out[0], f.out[1]), 1, `${f.id}'s normal is not a unit vector`);
    /* A court face's normal points INTO the open court, i.e. roughly toward
       the court centroid — the opposite convention from an outer face. */
    const mx = (f.a[0] + f.b[0]) / 2 - cx;
    const mz = (f.a[1] + f.b[1]) / 2 - cz;
    assert.ok(mx * f.out[0] + mz * f.out[1] < 0 || f.kind === "core",
      `${f.id}'s normal points into the building rather than into the court`);
    /* A point one metre off the face must be inside the court hole. */
    const p = [(f.a[0] + f.b[0]) / 2 + f.out[0], (f.a[1] + f.b[1]) / 2 + f.out[1]];
    assert.ok(inRing(p[0], p[1], ring1), `${f.id}'s outward side is not open court`);
    assert.ok(f.tier === "sourced" || f.patternRef === "I0",
      `${f.id} is [estimated] and must name the sourced face it extends`);
    assert.ok(f.source.length > 80, `${f.id} has no real source line`);
  }
  assert.equal(faces.filter((f) => f.tier === "sourced").length, 1,
    "exactly one court face is tied to a photograph and the rest extend it");
  /* Six suite doors a level, on the three long walls only. */
  assert.equal(faces.reduce((s, f) => s + (f.doors || 0), 0), section.court.suitesPerLevel);
  for (const f of faces) {
    if (f.doors) assert.ok(f.length > section.court.suiteSpacing,
      `${f.id} carries a suite door on a wall shorter than one suite frontage`);
  }
  /* The core faces run the full height and are the notch the survey draws. */
  const N = section.measured.mass.notch;
  near(N.x1 - N.x0, 6.5, 1e-9, "the notch's width");
  near(N.z1 - N.z0, 7.8, 1e-9, "the notch's depth");
  /* The survey ring carries 0.1 m of vertex jitter along these faces, so the
     declared notch rectangle is checked to that and not tighter. */
  const jitter = 0.1;
  for (const f of faces.filter((x) => x.kind === "core")) {
    for (const p of [f.a, f.b]) {
      assert.ok(p[0] >= N.x0 - jitter && p[0] <= N.x1 + jitter && p[1] >= N.z0 - jitter && p[1] <= N.z1 + jitter,
        `${f.id} vertex ${JSON.stringify(p)} is off the surveyed notch`);
    }
  }
});

/* ----------------------------------------------------- the deleted claims */

test("the roof lid is gone, and it left through the record rather than by deletion", () => {
  const R = section.roof;
  for (const dead of ["lightWell", "kerb", "core", "trellis", "tree"]) {
    assert.equal(R[dead], undefined, `roof.${dead} is back — the lid was invented and is deleted`);
  }
  /* The lid existed in the pre-R1 shipped document (git fe2d6ed and earlier);
     since the merge the only trace allowed is the superseded record checked
     below — the lid features themselves must never return. */
  assert.match(R.lidNote, /DELETED/);
  assert.match(R.lidNote, /74,836|74836/, "the deletion note must carry the area argument that killed the lid");
  for (const dead of ["wellShade", "coreTop", "trellisWhite"]) {
    assert.equal(section.colors[dead], undefined, `colors.${dead} described a deleted feature`);
  }
  /* Every retirement is on the record, naming what replaced it. */
  assert.ok(section.superseded.length >= 10, `superseded shrank to ${section.superseded.length}`);
  for (const s of section.superseded) {
    for (const k of ["was", "nowIs", "why", "evidence"]) {
      assert.ok(s[k] && s[k].length > 5, `a superseded record is missing ${k}`);
    }
  }
  const j = JSON.stringify(section.superseded);
  for (const must of [/lightWell/, /grid\.solve/, /\+1\.75/, /1\.28/, /colonnade/, /pilasterWidth/, /bands/]) {
    assert.match(j, must, `superseded[] no longer records ${must}`);
  }
  assert.match(section.supersededNote, /never|not deleted|Nothing is deleted/i);
});

test("every absent entry is a real withholding, not a stub", () => {
  /* BASELINE CHANGE (R2 S1 v): the per-entry key/probe walk moved to the
     S1(v) test above, where a withholding cannot leave silently; what is left
     here is the quality of each entry as prose. */
  for (const a of section.absent) {
    assert.equal(typeof a, "string");
    assert.ok(a.length > 80, `absent entry is a stub: ${a.slice(0, 60)}`);
  }
  const j = section.absent.join("\n");
  /* The mural entry must no longer claim what is now resolved. */
  assert.equal(/no photograph, no palette, no placement/.test(j), false,
    "the mural is sourced now and the absent entry must say what it is, not that nothing is known");
});

test("conflicts are declared and never averaged", () => {
  assert.ok(section.conflicts.length >= 6);
  for (const c of section.conflicts) assert.ok(c.length > 150, `a conflict is a stub: ${c.slice(0, 60)}`);
  const j = section.conflicts.join("\n");
  for (const must of [/bay:floor ratio|BAY:STOREY RATIO/i, /1966/, /74,836/, /18\.4/, /1415/, /racks|RACK POSITION/i, /PHOTOSPHERE/i]) {
    assert.match(j, must, `conflicts[] no longer carries ${must}`);
  }
  /* The dossier's own rounding is recorded as a conflict rather than shipped. */
  assert.match(j, /1\.53|3\.16/, "the dossier's rounded parapet/ground storey must be recorded against the arithmetic that beat them");
});

/* ------------------------------------------------------------------ colour */

test("colours are data, hex, the repaint whites, and every role carries a tier", () => {
  const entries = Object.entries(section.colors);
  assert.ok(entries.length >= 30, `only ${entries.length} colours`);
  for (const [k, v] of entries) {
    assert.match(v, /^#[0-9a-f]{6}$/, `${k} is not a lowercase 6-digit hex`);
    assert.notEqual(v, "#c9bca0", `${k} is the pre-2014 tan — a dead epoch`);
    const src = section.colorSources[k];
    assert.ok(src, `${k} has no colorSources line`);
    assert.match(src, /^\[(measured|sourced|estimated)\]/, `${k}'s provenance carries no tier: ${src.slice(0, 40)}`);
    assert.ok(src.length > 60, `${k}'s provenance is a stub`);
  }
  assert.deepEqual(Object.keys(section.colorSources).sort(), Object.keys(section.colors).sort(),
    "colorSources and colors must cover exactly the same roles");
  const luma = (hex) =>
    0.299 * parseInt(hex.slice(1, 3), 16) + 0.587 * parseInt(hex.slice(3, 5), 16) + 0.114 * parseInt(hex.slice(5, 7), 16);
  const spread = (hex) => {
    const c = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    return Math.max(...c) - Math.min(...c);
  };
  assert.ok(luma(section.colors.precast) > 170, "the 2015 repaint precast reads WHITE");
  assert.ok(spread(section.colors.precast) < 35, "the precast is near-neutral, not tan");
  assert.ok(luma(section.colors.groundRecess) < 60, "the colonnade recess reads near-black");

  /* THE COURT INTRODUCES NO NEW COLOUR VALUE. N9 is over-exposed and is not a
     colour source, so every court role must SHIP AN EXISTING HEX and say so. */
  const courtRoles = ["cmuWhite", "gallerySoffit", "guardWhite", "beamWhite", "screenWhite",
    "sconceWhite", "doorBronze", "plaqueTan", "courtPaving", "baseWall"];
  for (const role of courtRoles) {
    const hex = section.colors[role];
    assert.ok(hex, `the court needs a ${role}`);
    const src = section.colorSources[role];
    assert.match(src, /^\[estimated\]/, `${role} must be [estimated] — N9 cannot set a colour`);
    const named = /colors\.(\w+)/.exec(src);
    assert.ok(named && section.colors[named[1]] === hex,
      `${role} must ship the same hex as the sourced role it names, and name it`);
    assert.ok(!courtRoles.includes(named[1]), `${role} extends another estimate rather than a sourced role`);
  }
  /* And the uncached-frame caveat must be attached to every hex that depends
     on the frame nobody can re-open. */
  const psphere = Object.entries(section.colorSources).filter(([, v]) => /photosphere/i.test(v));
  assert.ok(psphere.length >= 15);
  for (const [k, v] of psphere) assert.match(v, /NOT CACHED/i, `${k} cites the photosphere without the caveat`);
  /* No hex literal may live in the module. */
  assert.equal(moduleSrc.match(/#[0-9a-fA-F]{6}\b/g), null, "a colour literal leaked into the builder");
});

test("the module carries no dimension of its own — geometry is data", () => {
  const src = moduleSrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const allowed = new Map([
    ["43758.5453", "hash constant"], ["131.71", "hash constant"],
    ["57.13", "hash constant"], ["7.9", "hash constant"],
    ["0.25", "hash threshold, one quarter of the windows reflect sky"],
    ["0.45", "hash threshold, the grey/pink stain split"],
    ["0.35", "material metalness"], ["0.55", "material roughness"],
    ["0.95", "material roughness"], ["0.15", "material envMapIntensity"],
    ["0.75", "material opacity"], ["1.0", "material roughness"], ["0.0", "material metalness"],
    ["0.5", "a half: the centre of a bay, a picket, a slat or a court-floor cell"],
  ]);
  const found = new Set(src.match(/\b\d+\.\d+\b/g) || []);
  for (const n of found) {
    assert.ok(allowed.has(n),
      `${n} is a bare number in the builder — move it into the section's derivations, estimates, reads or draw block`);
  }
  for (const key of ["section.draw", "grid.groundStorey", "court.gallery", "roof.coping", "guard.picketPitch"]) {
    assert.ok(src.includes(key.split(".").pop()), `the builder never reads ${key}`);
  }
});

test("the module is a one-way reader, deterministic, and on the shared ladders", () => {
  assert.equal(moduleSrc.match(/Math\.random/), null, "the module uses Math.random");
  assert.equal(moduleSrc.match(/\bnew Date\b|Date\.now|performance\.now/), null, "the module reads a clock");
  assert.equal(moduleSrc.match(/new THREE\.TextureLoader|\.load\(/), null,
    "textures are code-generated here, never loaded from a photograph");
  assert.equal(moduleSrc.match(/section\.\w+\s*=[^=]/), null, "the module writes back into the section");
  assert.match(moduleSrc, /from "\.\/campus-overlay\.js"/);
  assert.match(moduleSrc, /from "\.\/campus-materials\.js"/);
  assert.match(moduleSrc, /overlayLift\(/, "seated geometry must take its lift from campus-overlay.js");
  const keys = [...moduleSrc.matchAll(/photo\?\.(\w+)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(keys)], ["argo"], "the module reads a key that is not its own");
});

/* ------------------------------------------------ the world it stands in */

test("no OUTER facade layer floats more than half a metre off the measured wall", () => {
  assert.ok(maxReach() <= 0.6,
    `an outer facade layer reaches ${maxReach().toFixed(2)} m — the route passes 1.6 m off the east face`);
});

test("nothing solid crowds the staging route that hugs the east face", () => {
  let worst = Infinity;
  let where = null;
  for (const [x, z] of [...facadePoints(), ...solids()]) {
    const d = toRoute(x, z);
    if (d < worst) { worst = d; where = [x, z]; }
  }
  assert.ok(worst >= 1.0,
    `closest solid is ${worst.toFixed(2)} m from the centreline at ${where} — the ride must clear Argo`);
});

test("nothing invented sits inside a measured building footprint", () => {
  const rings = campus.buildings.filter((b) => b.p && b.p.length >= 3);
  for (const [x, z] of solids()) {
    for (const b of rings) {
      assert.ok(!inRing(x, z, b.p), `(${x}, ${z}) is inside ${b.n || "an unnamed mass"}`);
    }
  }
});

test("the re-registered roof plan lands on the plate and clears the open court", () => {
  const R = section.roof;
  assert.match(R.source, /\[estimated\]/i, "roof heights must be declared estimated");
  near(R.registration.dx, section.derivations.readings.ortho.dx, 1e-9, "roof dx");
  near(R.registration.dz, section.derivations.readings.ortho.dz, 1e-9, "roof dz");
  assert.equal(R.curbs.items.length, 10, "10 square mechanical curbs [measured plan, ortho]");
  /* Every item is the shipped ortho read moved by exactly the registration
     delta — not re-placed by eye. The pre-R1 plan is pinned from the last
     pre-merge document (git HEAD at merge day, 2026-08-21) so the rigid-move
     claim stays checkable after the merge replaced the shipped baseline. */
  const PRE_R1_CURBS = [
    { x: -48.7, z: 377.3, s: 2.4 }, { x: -28.9, z: 377.3, s: 2.4 },
    { x: -48.7, z: 393.8, s: 2.4 }, { x: -28.4, z: 393.8, s: 2.4 },
    { x: -45.1, z: 374.3, s: 2.2 }, { x: -39.5, z: 374.7, s: 1.4 },
    { x: -22.9, z: 373.4, s: [2.8, 1.6] }, { x: -39.3, z: 396.4, s: 1.9 },
    { x: -30.7, z: 398, s: 1.4 }, { x: -49.9, z: 387.7, s: 0.9 },
  ];
  const PRE_R1_RECESS = { x0: -51.4, z0: 381.8, x1: -48.5, z1: 388 };
  const dx = section.derivations.readings.ortho.dx - section.derivations.readings.ortho.priorDx;
  const dz = section.derivations.readings.ortho.dz - section.derivations.readings.ortho.priorDz;
  R.curbs.items.forEach((c, i) => {
    near(c.x, PRE_R1_CURBS[i].x + dx, 1e-6, `curb ${i} x`);
    near(c.z, PRE_R1_CURBS[i].z + dz, 1e-6, `curb ${i} z`);
    assert.deepEqual(c.s, PRE_R1_CURBS[i].s, `curb ${i} changed size as well as position`);
  });
  for (const k of ["x0", "x1"]) near(R.westRecess[k], PRE_R1_RECESS[k] + dx, 1e-6, `westRecess ${k}`);
  for (const k of ["z0", "z1"]) near(R.westRecess[k], PRE_R1_RECESS[k] + dz, 1e-6, `westRecess ${k}`);
  /* On the plate. The court rim is a CLIP, not a re-placement: the declared
     items keep their measured plan, the module trims what overhangs, and the
     gate that matters runs on the BUILT footprints below. */
  for (const c of R.curbs.items) {
    const [sw, sd] = Array.isArray(c.s) ? c.s : [c.s, c.s];
    for (const x of [c.x - sw / 2, c.x + sw / 2]) {
      for (const z of [c.z - sd / 2, c.z + sd / 2]) {
        assert.ok(inRing(x, z, ring0), `curb corner (${x}, ${z}) runs off the roof plate`);
      }
    }
  }
  assert.match(R.curbs.clipNote, /hover/i, "the court-rim clip must be declared, not silently applied");
  assert.match(R.curbs.clipNote, /least intrusion/i, "the clip must state its RULE, so a re-registration re-derives it");
  for (const x of [R.westRecess.x0, R.westRecess.x1]) {
    for (const z of [R.westRecess.z0, R.westRecess.z1]) {
      assert.ok(inRing(x, z, ring0) && !inRing(x, z, ring1), `west recess corner (${x}, ${z}) is off the plate`);
    }
  }
  /* The court tree now stands IN the court, which is the whole correction. */
  assert.ok(inRing(section.court.tree.x, section.court.tree.z, ring1),
    "the courtyard tree is not in the courtyard");
  assert.ok(R.curbs.height <= 0.8, "curb heights are estimated LOW — nothing gives them");
});

test("the signage is recorded, not rendered", () => {
  assert.equal(section.signage.built, false);
  assert.equal(section.signage.text, "ARGO HALL");
  assert.equal(section.signage.face, "east");
  assert.ok(section.signage.capHeight > 0.2 && section.signage.capHeight < 0.5);
});

test("the rack cross-finding is recorded for arbitration and acted on nowhere", () => {
  assert.match(section.ground.racksNote, /355\.5/);
  assert.match(section.ground.racksNote, /not one bike hoop/i,
    "the finding is a POSITIVE observation of a clear ground plane, not an epoch tiebreak");
  assert.match(section.ground.racksNote, /LOW CONFIDENCE/i);
  assert.equal(section.ground.racks, undefined, "this section does not own the racks and must not grow a copy");
  /* And the shipped bench/planter figures are carried unchanged, not guessed. */
  assert.deepEqual(section.ground.north, shipped.ground.north,
    "ground.north is flagged as under-sized and must be carried VERBATIM until a real measurement exists");
});

/* ------------------------------------------- the module, actually running */

const flat = () => 20;
const build = (g = flat) => createPhotoArgo(null, { photo: { argo: section }, heightAt: g, surfaceAt: g });

test("the module builds every system, and the counts are the declared ones", () => {
  const { group, counts } = build();
  for (const [k, v] of Object.entries(section.counts)) {
    if (k === "note") continue;
    assert.equal(counts[k], v, `count ${k}`);
  }
  /* Recomputed here rather than trusted from the declaration. */
  const G = section.grid;
  assert.equal(counts.windows, 4 * G.finStoreys * G.longFaceBays, "a window in every bay of every fin storey of every face");
  assert.equal(counts.reveals, 2 * counts.windows, "two canted reveals per window — the sawtooth");
  assert.equal(counts.awnings, counts.windows);
  assert.equal(counts.piers, 4 * G.finStoreys * (G.longFaceBays + 1));
  assert.equal(counts.suiteDoors, section.court.suitesPerLevel * G.finStoreys);
  /* BASELINE CHANGE (R2 A1): a deck is the soffit of the gallery BELOW it, so
     five galleries need six deck-and-beam pairs per face, not five. */
  assert.equal(counts.galleryDecks, section.court.faces.length * (G.finStoreys + 1));
  const pickets = section.court.faces
    .reduce((s, f) => s + Math.floor(f.length / section.court.guard.picketPitch), 0) * G.finStoreys;
  assert.equal(counts.pickets, pickets, "the guard's picket count is not the code pitch over the surveyed runs");
  assert.equal(counts.columns, section.system.colonnade.spans + 1,
    "the ONE sourced colonnade opening carries the only columns on this building");
  assert.ok(counts.courtFloorCells > 100, "the court floor did not get laid");
  for (const n of ["argo-facades", "argo-court", "argo-roof", "argo-ground"]) {
    assert.ok(group.children.find((c) => c.name === n), `no ${n} group`);
  }
  const missing = createPhotoArgo(null, { photo: {}, heightAt: flat, surfaceAt: flat });
  assert.deepEqual(missing.counts, {}, "a missing section builds nothing and breaks nothing");
  /* PRE-MERGE GUARD: a section without the R1 apparatus must build NOTHING
     and name the keys it is waiting for — half a building drawn off a
     half-section is the silent failure this repo keeps failing on. The merge
     has landed, so the pre-R1 shape is reconstructed by stripping the R1 keys. */
  const preR1 = { ...shipped, grid: { ...shipped.grid } };
  for (const k of ["court", "draw", "estimates", "reads"]) delete preR1[k];
  delete preR1.grid.groundStorey;
  const stale = createPhotoArgo(null, { photo: { argo: preR1 }, heightAt: flat, surfaceAt: flat });
  assert.equal(stale.group.children.length, 0, "a pre-merge section drew geometry off a shape it does not have");
  assert.match(stale.counts.pendingMerge, /court/,
    "the guard must name what it is waiting for, so the merge cannot half-land unnoticed");
  assert.throws(() => createPhotoArgo(null, { photo: { argo: section } }), /surfaceAt/,
    "a missing sampler must not be silent");
});

test("the group is added to a scene when there is one", () => {
  const added = [];
  const r = createPhotoArgo({ add: (g) => added.push(g) }, { photo: { argo: section }, surfaceAt: flat });
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
      fn(o.position.x, o.position.y, o.position.z, o.scale.y, o);
    }
  });
}

test("nothing hovers and nothing sinks — flat, an exaggerated slope, and the DRAWN LiDAR surface", () => {
  const sloped = (x, z) => 20 + 1.2 * Math.sin(x / 14) + 0.9 * Math.cos(z / 17);
  for (const [label, ground] of [["flat", flat], ["slope", sloped], ["drawn", drawnGround]]) {
    const { group, counts } = build(ground);
    group.updateMatrixWorld(true);

    /* The seat is NOT re-derived from the module's own maths: it is
       campus-massing.js roofElevation over the DRAWN mass's ring and height. */
    const M = section.measured.mass;
    const roofY = roofElevation(M.ring, M.h, ground);
    const baseY = roofY - M.h;
    const deckY = baseY + section.grid.groundStorey + section.grid.finStoreys * section.grid.floorToFloor;
    near(counts.roofY, roofY, 1e-9, `${label}: the module's coping plane is not campus-massing's`);
    near(counts.deckY, deckY, 1e-9, `${label}: the roof deck is not one parapet below the coping`);
    near(roofY - deckY, section.grid.parapet, 1e-9, `${label}: the parapet does not close the gap`);

    let checked = 0;
    let maxTop = -Infinity;
    let columns = 0;
    each(group.children.find((c) => c.name === "argo-facades"), (x, y, z, sy, o) => {
      if (o.name === "ground-columns" || o.name === "ground-recess" || o.name === "ground-base-wall") {
        const bottom = y - sy / 2;
        const g = ground(x, z);
        assert.ok(bottom <= g + 0.01,
          `${label}: ${o.name} bottom ${bottom.toFixed(2)} floats over the drawn surface ${g.toFixed(2)} at (${x.toFixed(1)}, ${z.toFixed(1)})`);
        assert.ok(bottom >= baseY - 4, `${label}: ${o.name} plunges to ${bottom.toFixed(2)} — a runaway skirt`);
        if (o.name === "ground-columns") columns++;
      } else {
        assert.ok(y >= baseY - 0.1, `${label}: a facade element sits at y=${y.toFixed(2)}, under the base ${baseY.toFixed(2)}`);
      }
      assert.ok(y <= roofY + 0.1, `${label}: a facade element floats at y=${y.toFixed(2)}, over the coping ${roofY.toFixed(2)}`);
      maxTop = Math.max(maxTop, y + sy / 2);
      checked++;
    });
    assert.equal(columns, section.system.colonnade.spans + 1, `${label}: the colonnade check did not run`);
    near(maxTop, roofY, 0.05, `${label}: the facade does not top out on the massing's coping plane`);

    /* THE ROOF SITS ON THE DECK, NOT ON THE COPING — and the deck is 1.53 m
       INSIDE the flat-topped drawn mass, so nothing may be built on it at all.
       roof.deckGate carries the arithmetic; what is checked here is that the
       drawn scene honours it, in both directions: when the deck is withheld
       nothing stands on it, and when it is not, everything stands exactly on
       it and never on the coping plane instead. */
    const deckWithheld = section.roof.deckGate.built === false;
    let membrane = 0;
    each(group.children.find((c) => c.name === "argo-roof"), (x, y, z, sy, o) => {
      assert.ok(y >= deckY - 0.05, `${label}: a roof item dips to y=${y.toFixed(2)} into the massing`);
      assert.ok(y <= roofY + 0.05, `${label}: a roof item floats at y=${y.toFixed(2)} over the coping plane`);
      if (deckWithheld) {
        assert.ok(y - sy / 2 >= roofY - section.grid.parapet - 1e-6,
          `${label}: ${o.name || "a roof item"} stands at y=${y.toFixed(2)}, below the coping plane and so inside the drawn mass`);
      }
      if (o.name === "roof-membrane") { near(y, deckY + section.draw.membraneLift, 1e-9, `${label}: membrane`); membrane++; }
      checked++;
    });
    assert.equal(membrane, deckWithheld ? 0 : 1,
      `${label}: the membrane is ${deckWithheld ? "drawn on a deck that is inside the mass" : "not on the deck"}`);

    /* THE COURT FLOOR IS AT THE DRAWN SURFACE, 18.70 m BELOW THE DECK. */
    const lift = overlayLift(section.court.floor.rung);
    let cells = 0;
    each(group.children.find((c) => c.name === "argo-court"), (x, y, z, sy, o) => {
      if (o.name === "court-floor") {
        /* Instance matrices are Float32, so the tolerance is the format's,
           not the geometry's. */
        near(y, ground(x, z) + lift, 2e-4,
          `${label}: a court floor cell at (${x.toFixed(1)}, ${z.toFixed(1)}) is off the drawn surface`);
        assert.ok(inRing(x, z, ring1), `${label}: a court floor cell escaped the survey hole`);
        cells++;
        return;
      }
      assert.ok(y >= ground(x, z) - 1.0,
        `${label}: a court element at (${x.toFixed(1)}, ${z.toFixed(1)}) sinks below the court floor`);
      assert.ok(y <= roofY + 0.05, `${label}: a court element floats at y=${y.toFixed(2)} over the coping`);
      checked++;
    });
    assert.equal(cells, counts.courtFloorCells);

    each(group.children.find((c) => c.name === "argo-ground"), (x, y, z) => {
      const g = ground(x, z);
      assert.ok(y >= g - 0.3, `${label}: a ground item at (${x.toFixed(1)}, ${z.toFixed(1)}) sits under the drawn surface`);
      assert.ok(y <= g + 2.5, `${label}: a ground item at (${x.toFixed(1)}, ${z.toFixed(1)}) floats over the drawn surface`);
      checked++;
    });
    assert.ok(checked > 4000, `${label}: only ${checked} placements checked — the loops did not run`);
  }
});

test("A1: every gallery level has a slab above it — the court has no open top", () => {
  /* Phrased over the BUILT scene and not over a loop bound: for every gallery
     level, on every one of the eight court faces, a deck must exist at the top
     of that storey. The R1 revision left the top gallery's doors, screens,
     sconces, plaques, pickets and rails under open sky around 78.20 m of court
     loop, and no gate could see it. */
  const { group, counts } = build();
  group.updateMatrixWorld(true);
  const M = section.measured.mass;
  const roofY = roofElevation(M.ring, M.h, flat);
  const baseY = roofY - M.h;
  const firstFloor = baseY + section.grid.groundStorey;
  const F = section.grid.floorToFloor;
  const tops = [];
  each(group.children.find((c) => c.name === "argo-court"), (x, y, z, sy, o) => {
    if (o.name === "court-decks") tops.push(y + sy / 2);
  });
  assert.equal(tops.length, counts.galleryDecks, "the deck mesh is not the decks the counts claim");
  for (let s = 0; s < section.grid.finStoreys; s++) {
    const want = firstFloor + (s + 1) * F;
    const n = tops.filter((t) => Math.abs(t - want) <= 0.01).length;
    assert.equal(n, section.court.faces.length,
      `gallery level ${s} has ${n} of ${section.court.faces.length} faces ceilinged at y=${want.toFixed(3)} — a gallery is open to the sky`);
  }
  /* The topmost pair is a CEILING, not a new gallery: nothing else steps up
     with it. */
  assert.equal(counts.suiteDoors, section.court.suitesPerLevel * section.grid.finStoreys);
  assert.equal(counts.screens, section.court.faces.filter((f) => f.kind === "wall").length
    * section.court.screen.perWallPerLevel * section.grid.finStoreys);
  /* Instance matrices are Float32, so the tolerance is the format's. */
  near(Math.max(...tops), baseY + section.grid.groundStorey + section.grid.finStoreys * F, 2e-4,
    "the ceiling over the top gallery is not at the roof deck");
});

test("nothing built crosses a surveyed facade", () => {
  const { group } = build();
  group.updateMatrixWorld(true);
  /* The court's galleries hang INTO the court; nothing may push back through
     a court wall into the building, and nothing may leave the court through
     the open corners further than the declared projection. */
  const proj = section.court.projection ?? section.court.gallery.projection;
  let deepest = 0;
  each(group.children.find((c) => c.name === "argo-court"), (x, y, z, sy, o) => {
    if (o.name === "court-floor") return;
    /* Distance from the court hole, positive when outside it. */
    if (inRing(x, z, ring1)) return;
    let d = Infinity;
    for (const f of section.court.faces) {
      const ax = f.a[0], az = f.a[1], bx = f.b[0], bz = f.b[1];
      const dx = bx - ax, dz = bz - az;
      const len2 = dx * dx + dz * dz;
      let t = len2 ? ((x - ax) * dx + (z - az) * dz) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      d = Math.min(d, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
    }
    deepest = Math.max(deepest, d);
  });
  assert.ok(deepest <= section.draw.wallOffset + 1e-6,
    `court geometry stands ${deepest.toFixed(3)} m inside the surveyed wall — the gallery must hang into the court`);
  /* And the outer facade may not reach into the building past its own skin. */
  let inward = 0;
  each(group.children.find((c) => c.name === "argo-facades"), (x, y, z, sy, o) => {
    if (!inRing(x, z, ring0)) return;
    let d = Infinity;
    for (const f of section.facades) {
      const ax = f.a[0], az = f.a[1], bx = f.b[0], bz = f.b[1];
      const dx = bx - ax, dz = bz - az;
      const len2 = dx * dx + dz * dz;
      let t = len2 ? ((x - ax) * dx + (z - az) * dz) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      d = Math.min(d, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
    }
    inward = Math.max(inward, d);
  });
  assert.ok(inward <= section.system.ground.baseWallRecess + section.system.corner.pilasterWidth / 2 + 1e-6,
    `an outer facade layer reaches ${inward.toFixed(3)} m into the building`);
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

test("the material library is on the surfaces, and the recess is a matte void", () => {
  assert.match(moduleSrc, /(?:shared|create)MaterialLibrary/, "surfaces come from campus-materials.js");
  const { group } = build();
  let textured = 0;
  let glass = 0;
  group.traverse((o) => {
    if (o.isMesh && o.material) {
      if (o.material.map && o.material.roughnessMap) textured++;
      if (o.material.transparent && o.material.opacity < 1) glass++;
    }
  });
  assert.ok(textured >= 10, `only ${textured} textured meshes — the library is not applied`);
  assert.ok(glass >= 2, "the glazing does not carry the library's glass");
  let recess = null;
  group.traverse((o) => { if (o.name === "ground-recess") recess = o; });
  assert.ok(recess, "no ground-recess mesh — the north colonnade opening did not build");
  assert.ok(!recess.material.transparent && recess.material.roughness >= 0.9,
    "the colonnade recess must be a matte opaque plane, not glazing");
  /* The court's masonry must actually be masonry, binned so it is not
     stretched across faces of different lengths. */
  const cmu = [];
  group.traverse((o) => { if (/court-cmu/.test(o.name || "")) cmu.push(o); });
  assert.ok(cmu.length >= 4, "the court's CMU is drawn with one repeat for every face length");
  for (const m of cmu) assert.ok(m.material.map, "the court masonry carries no texture");
});

test("no built roof furniture hangs over the open court", () => {
  /* The lid is gone, so there is no longer a surface under the court rim.
     Every drawn box on the plate is checked by its own footprint corners,
     which is what the declared clip exists to guarantee. */
  const { group } = build();
  group.updateMatrixWorld(true);
  const roof = group.children.find((c) => c.name === "argo-roof");
  let worst = null;
  roof.traverse((o) => {
    if (!o.isInstancedMesh && !o.isMesh) return;
    if (o.name === "roof-membrane") return;
    /* The coping cap is a CANTILEVER off the parapet, not a hover: the ortho
       reads it as a raised band with an outer shadow line, so it oversails
       the court rim by its own declared overhang. Checked separately. */
    if (o.name === "roof-coping") return;
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox;
    const push = (M) => {
      for (const cx of [bb.min.x, bb.max.x]) {
        for (const cy of [bb.min.y, bb.max.y]) {
          for (const cz of [bb.min.z, bb.max.z]) {
            const wx = M[0] * cx + M[4] * cy + M[8] * cz + M[12];
            const wz = M[2] * cx + M[6] * cy + M[10] * cz + M[14];
            if (inRing(wx, wz, ring1)) worst = `${o.name || "unnamed"} at (${wx.toFixed(2)}, ${wz.toFixed(2)})`;
          }
        }
      }
    };
    if (o.isInstancedMesh) {
      for (let i = 0; i < o.count; i++) push(Array.from(o.instanceMatrix.array.slice(i * 16, i * 16 + 16)));
    } else {
      push(o.matrixWorld.elements);
    }
  });
  assert.equal(worst, null, `${worst} hangs over the OPEN COURT — nothing may hover`);
  /* The one thing allowed over the rim, held to its own declared figure. */
  const coping = [];
  roof.traverse((o) => { if (o.name === "roof-coping") coping.push(o); });
  assert.equal(coping.length, 1, "no coping band");
  let over = 0;
  coping[0].geometry.computeBoundingBox();
  const bb = coping[0].geometry.boundingBox;
  for (let i = 0; i < coping[0].count; i++) {
    const M = Array.from(coping[0].instanceMatrix.array.slice(i * 16, i * 16 + 16));
    for (const cx of [bb.min.x, bb.max.x]) {
      for (const cz of [bb.min.z, bb.max.z]) {
        const wx = M[0] * cx + M[8] * cz + M[12];
        const wz = M[2] * cx + M[10] * cz + M[14];
        if (!inRing(wx, wz, ring1)) continue;
        let d = Infinity;
        for (const f of section.court.faces) {
          const dx = f.b[0] - f.a[0], dz = f.b[1] - f.a[1];
          const l2 = dx * dx + dz * dz;
          let t = l2 ? ((wx - f.a[0]) * dx + (wz - f.a[1]) * dz) / l2 : 0;
          t = Math.max(0, Math.min(1, t));
          d = Math.min(d, Math.hypot(wx - (f.a[0] + dx * t), wz - (f.a[1] + dz * t)));
        }
        over = Math.max(over, d);
      }
    }
  }
  /* A face frame runs perpendicular to the declared `out` normal, and the
     survey ring is not perfectly axis-aligned, so a full-length band sits up
     to the segment's own jitter off it at the far end. That allowance is
     computed HERE from the survey rather than declared, so it can never be
     widened to make something pass. */
  const jitter = Math.max(...section.court.faces.map(
    (f) => Math.abs((f.b[0] - f.a[0]) * f.out[0] + (f.b[1] - f.a[1]) * f.out[1])));
  assert.ok(jitter <= 0.1 + 1e-6, `the survey ring's own jitter is ${jitter} m — too loose to gate against`);
  assert.ok(over <= section.roof.coping.overhang + jitter + 1e-3,
    `the coping oversails the court rim by ${over.toFixed(3)} m against a declared ${section.roof.coping.overhang} m plus ${jitter.toFixed(2)} m of survey jitter`);
  /* And the membrane really does have the court punched out of it — whenever
     it is drawn at all. It is not, while the deck is withheld. */
  const memb = [];
  roof.traverse((o) => { if (o.name === "roof-membrane") memb.push(o); });
  assert.equal(memb.length, section.roof.membrane.built === false ? 0 : 1);
  for (const m of memb) {
    const pos = m.geometry.attributes.position;
    let inside = 0;
    for (let i = 0; i < pos.count; i++) {
      if (inRing(pos.getX(i), pos.getZ(i), ring1)) inside++;
    }
    assert.equal(inside, 0, `${inside} membrane vertices sit over the open court — there is no roof there`);
  }
});

/* ------------------------------------------------------- visual round 2 */

/* R2-VIS/ARGO — THE ROOF DECK IS INSIDE THE DRAWN MASS, AND THAT IS WHY THE
 * ROOF IS BARE.
 *
 * The round-2 critic read Argo's roof as one unbroken white plane and called
 * it an R1 surgery regression. It was not: every curb, the west recess, the
 * membrane and its stains were still being built, still registered and still
 * clipped — 1.53 m inside a solid extrusion, with the massing's own top cap
 * drawn over them. This gate holds all three legs of the adjudication:
 * the arithmetic that puts the deck inside the mass, the record staying
 * complete, and the drawn scene staying empty of it. It fails if the deck
 * furniture is quietly restored, if it is raised to the coping plane to make
 * it visible, or if the measurements are deleted instead of withheld. */
test("R2-VIS: the roof deck is withheld because it is inside the mass, with its record intact", () => {
  const R = section.roof;
  const gate = R.deckGate;
  assert.ok(gate, "the deck gate is gone — the withholding has lost its reason");
  assert.equal(gate.built, false);
  for (const part of [R.membrane, R.curbs, R.westRecess]) {
    assert.equal(part.built, false, "a deck part is being built again without the gate moving");
  }

  /* THE ARITHMETIC, recomputed from the survey and the section's own grid —
     not quoted from the gate's prose. */
  const M = section.measured.mass;
  const roofY = roofElevation(M.ring, M.h, drawnGround);
  const deckY = roofY - section.grid.parapet;
  assert.ok(roofY - deckY > 1,
    `the parapet is only ${(roofY - deckY).toFixed(2)} m — the deck is no longer meaningfully inside the mass`);
  const drawnMass = assembleMasses({ campus, lidar, arcgis, colors: null })
    .find((m) => m.name === "Argo Hall" && m.src === "gis");
  near(M.h, drawnMass.h, 1e-9, "the mass extrudes to the height campus-massing.js gives it");
  /* And the other road stays closed: on the coping plane the tallest curb core
     would stand above that same measured maximum, which is blake's ceiling. */
  assert.ok(roofY + R.curbs.coreHeight > roofY,
    "a zero-height curb would make this gate vacuous");

  /* THE RECORD IS COMPLETE. Withdrawing is not deleting: the plans, the
     registration and the clip rule are all still here to be restored from. */
  assert.equal(R.curbs.items.length, 10, "the ten measured curbs left the record");
  assert.match(R.curbs.clipNote, /least intrusion/i, "the clip rule left the record");
  for (const k of ["x0", "x1", "z0", "z1"]) {
    assert.equal(typeof R.westRecess[k], "number", `the west recess lost ${k}`);
  }
  near(R.registration.dx, 0.93, 1e-9, "the R1 registration left the record");
  near(R.registration.dz, 3.78, 1e-9, "the R1 registration left the record");
  assert.match(section.absent.join("\n"), /THE ROOF DECK AND EVERYTHING THAT STANDS ON IT/,
    "the withholding must be declared in absent[]");
  assert.match(section.conflicts.join("\n"), /THE DRAWN MASS IS FLAT-TOPPED/,
    "and carried as a conflict, because two sources disagree about the top");
  assert.equal(section.counts.curbs, 0, "the declared count must be what is built, which is nothing");

  /* AND THE SCENE IS EMPTY OF IT, on every surface. */
  for (const g of [flat, drawnGround]) {
    const { group, counts } = build(g);
    assert.equal(counts.curbs, 0, "curbs are being built again");
    group.updateMatrixWorld(true);
    const roof = group.children.find((c) => c.name === "argo-roof");
    const names = [];
    roof.traverse((o) => { if ((o.isMesh || o.isInstancedMesh) && (o.count ?? 1) > 0) names.push(o.name); });
    assert.deepEqual(names, ["roof-coping"],
      `the roof draws ${names.join(", ")} — only the coping band belongs at the coping plane`);
  }
});
