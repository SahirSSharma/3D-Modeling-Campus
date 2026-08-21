/* The Revelle Commons cluster's photo-sourced detail section — INVENTED class,
 * R2 batch, a NEW section.
 *
 * WHAT THIS SUITE EXISTS TO HOLD. The section makes four claims that are not
 * obvious and that a later edit could quietly undo, and each has a gate here
 * written against it rather than against the geometry that happens to result:
 *
 *   - THREE ROOFS, ONE PRISM, AND THE MEASURED STACK ONLY FITS ONE OF THEM.
 *     LiDAR puts the three blocks at 9.9 / 7.5 / 5.0 m and the extruder closes
 *     ONE mass at 11.3 m over all of them. The bands hang UPWARD from each
 *     block's own drawn surface, so no sourced figure is stretched, and the
 *     residue is declared per block. The consequence the research did not
 *     anticipate is gated here: the stack is 9.772 m and CANNOT be hung on a
 *     7.5 m block, so the parapet, soffit and plinth keep their measured values
 *     and the glazing band is derived per block. A gate fails if the glazing
 *     ever stops being the term that absorbs the difference.
 *
 *   - THE LOCAL ORTHO RE-FIT REFUTES THE RATE IT WAS ASKED TO CHECK, AND SO NO
 *     ORTHO FIGURE SHIPS. Six roof edges at three LiDAR heights are pinned here
 *     as literals, the two competing models are RECOMPUTED from them in this
 *     file, and the gate fails if a constant offset ever stops beating a
 *     height-proportional one — which is the only thing that would justify
 *     shipping an ortho-derived figure. A second gate walks the built scene and
 *     fails if any roof object or landscape object appears at all.
 *
 *   - EVERY FIGURE RECOMPUTES AND SO DOES EVERY READING UNDERNEATH IT. The
 *     Eighth audit proved 22 presence gates can pass on wholesale fabricated
 *     values, and R1 proved that recomputing figures faithfully from UNPINNED
 *     readings catches nothing. All eight gates of tests/helpers/axiom-gate.mjs
 *     run here — never forked.
 *
 *   - NOTHING PAVES A SURVEYED BED. round1-critic.md A1 caught
 *     galbraith.north.apron paving 199 m2 of three surveyed green rings. This
 *     section declines to build the south terrace at all, and a gate walks
 *     every placement against all seventeen arcgis.ground rings inside the
 *     declared bounds so that a later "small" landscape addition cannot repeat
 *     it silently.
 *
 * The section lives under the `revellecommons` key of
 * docs/data/campus-photo-detail.json once main merges it.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as THREE from "../docs/vendor/three/three.module.min.js";
import { createPhotoRevellecommons } from "../docs/js/campus-photo-revellecommons.js";
import { roofElevation, assembleMasses } from "../docs/js/campus-massing.js";
import { makeSurfaceSampler } from "../docs/js/campus-terrain.js";
import { overlayLift } from "../docs/js/campus-overlay.js";
import {
  assertCoverage, assertEstimateBands, assertPins, assertRelations,
  assertTierSymmetry, assertAbsentEntries, assertExprs, assertDispositions,
} from "./helpers/axiom-gate.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(p, "utf8"));

const merged = read(process.env.PHOTO_DETAIL || join(root, "docs/data/campus-photo-detail.json"));
const section = merged.revellecommons;

const campus = read(join(root, "docs/data/campus-3d.json"));
const lidar = read(join(root, "docs/data/campus-lidar.json"));
const arcgis = read(join(root, "docs/data/campus-arcgis.json"));

/* The ring that RENDERS is the university's massing ring: campus-massing.js
   extrudes massing[96] with its inner courtyard ring and suppresses the three
   OSM rings underneath. Every facade in this section must register to it. */
const drawn = assembleMasses({ campus, lidar, arcgis, colors: null })
  .find((m) => m.name === "Revelle Commons" && m.src === "gis");
const ring = drawn.rings[0];
const courtRing = drawn.rings[1];
const drawnGround = makeSurfaceSampler(lidar.terrain);

/** The ring indices a face spans, honouring the ring's repeated closing vertex:
 *  `b` is matched at the first occurrence AFTER `a` where one exists. */
function ringSpan(f) {
  const ia = ring.findIndex(([x, z]) => x === f.a[0] && z === f.a[1]);
  let ib = -1;
  for (let i = ia + 1; i < ring.length; i++) {
    if (ring[i][0] === f.b[0] && ring[i][1] === f.b[1]) { ib = i; break; }
  }
  if (ib === -1) ib = ring.findIndex(([x, z]) => x === f.b[0] && z === f.b[1]);
  return [ia, ib];
}

const moduleSrc = readFileSync(join(root, "docs/js/campus-photo-revellecommons.js"), "utf8");
const near = (a, b, eps, what) =>
  assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b} (tolerance ${eps})`);

const flat = () => 20;
const slope = (x, z) => 20 + 1.2 * Math.sin(x / 14) + 0.9 * Math.cos(z / 17);
const build = (g = flat) =>
  createPhotoRevellecommons(null, { photo: { revellecommons: section }, heightAt: g, surfaceAt: g });

/** Every placement's TRUE world extent — the geometry's own bounding box pushed
 *  through its matrix, because a rotated plane has no thickness in its own
 *  scale and a draped mesh carries absolute coordinates in its vertices. */
function each(node, fn) {
  const m = new THREE.Matrix4();
  node.updateMatrixWorld(true);
  node.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox;
    const mats = [];
    if (o.isInstancedMesh) {
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m);
        mats.push(new THREE.Matrix4().multiplyMatrices(o.matrixWorld, m));
      }
    } else mats.push(o.matrixWorld.clone());
    for (const M of mats) {
      const box = new THREE.Box3(bb.min.clone(), bb.max.clone()).applyMatrix4(M);
      fn({
        x: (box.min.x + box.max.x) / 2, y: (box.min.y + box.max.y) / 2,
        z: (box.min.z + box.max.z) / 2,
        xLo: box.min.x, xHi: box.max.x, yLo: box.min.y, yHi: box.max.y,
        zLo: box.min.z, zHi: box.max.z, mesh: o, name: o.name,
      });
    }
  });
}

/* ------------------------------------------------------------ the section */

test("the section exists and is reachable", () => {
  assert.ok(section, "no revellecommons section in the merge file or the shipped doc");
  for (const k of ["label", "epoch", "note", "seed", "bounds", "boundsNote", "boundary",
    "sources", "measured", "derivations", "estimates", "reads", "draw", "facades",
    "facadesNote", "system", "court", "colors", "colorSources", "colorNote",
    "colorFallback", "counts", "conflicts", "superseded", "supersededNote", "absent"]) {
    assert.ok(section[k] !== undefined, `section is missing ${k}`);
  }
  assert.equal(typeof section.seed, "number");
});

test("it says what it is: one building, three blocks, two of the names are tenancies", () => {
  assert.match(section.label, /ONE 1966 building/);
  assert.match(section.label, /TENANC/i, "the label must say what 64 Degrees and 64 North actually are");
  assert.match(section.label, /NOT averaged/i, "and it must point at where the height conflict is adjudicated");
  assert.match(section.epoch, /2014/);
  assert.match(section.epoch, /no re-clad|NO re-clad/i,
    "the epoch's validity rests on there having been no re-clad and must say so");
  assert.match(section.epoch, /no ortho-derived figure ships/i,
    "the 2026 ortho is a later epoch used for corroboration only and the epoch must say so");
  assert.match(section.note, /INVENTED/);
  /* The section must never speak of three buildings. The label carries the
     positive claim; the blocksNote is allowed to name the error it forbids,
     so it is checked for the claim rather than searched for the phrase. */
  assert.ok(!/three buildings/i.test(section.label),
    "three OSM rings are three BLOCKS of one building — never three buildings");
  assert.match(section.measured.blocksNote, /ONE building/);
  assert.match(section.measured.blocksNote, /never speaks of them as three buildings/);
});

test("every source is described and dated", () => {
  assert.ok(section.sources.length >= 8, `only ${section.sources.length} sources`);
  for (const s of section.sources) {
    assert.ok(s.length >= 80, `source is not described: ${s.slice(0, 70)}`);
    assert.match(s, /\b(19|20)\d\d\b/, `source has no date: ${s.slice(0, 70)}`);
  }
  const joined = section.sources.join("\n");
  assert.match(joined, /suffolk-Desktop-2_1-UCSD-64-degrees-3\.jpg/,
    "the frame every band figure comes from must be cited");
  assert.match(joined, /studioe-64degrees/, "the Studio E set must be cited");
  assert.match(joined, /chunk_4_6\.jpg/, "the ortho must be cited even though nothing derived from it ships");
  assert.match(joined, /campus-lidar\.json/, "the height authority must be cited");
  assert.match(joined, /ground#3267/, "the ring that types the court as paved must be cited");
});

/* ------------------------------------------- the arithmetic, recomputed */

/** The scope every `expr` is evaluated against: the section's own units and
 *  readings, plus every figure's DECLARED value seeded by path so an expression
 *  may build on an earlier figure whatever order the document lists them in,
 *  plus the one estimate an expr is allowed to reference. */
function exprScope() {
  const D = section.derivations;
  const scope = { ...D.units, ...D.readings };
  /* Seeded BEFORE the figures so `system.mullion.width` cannot clobber it. */
  scope.system = {
    columns: { spacingBays: section.system.columns.spacingBays },
    canopy: { dropBelowSoffit: section.system.canopy.dropBelowSoffit },
  };
  for (const [key, fig] of Object.entries(D.figures)) {
    const parts = key.split(".");
    let o = scope;
    for (let i = 0; i < parts.length - 1; i++) o = (o[parts[i]] ??= {});
    o[parts[parts.length - 1]] = fig.value;
  }
  return scope;
}

test("every derivation recomputes from its own readings — a fabrication cannot self-agree", () => {
  const D = section.derivations;
  assert.match(D.why, /KEELING/i, "the block must name the bar it is held to");
  for (const k of ["px", "published", "survey", "ring", "ortho"]) {
    assert.ok(D.readings[k], `readings is missing ${k}`);
  }
  for (const k of ["px", "published", "survey", "ortho"]) {
    assert.ok(D.readings[k].source && D.readings[k].source.length > 80,
      `readings.${k} has no described source`);
  }
  for (const [key, fig] of Object.entries(D.figures)) {
    assert.ok(typeof fig.value === "number", `${key} has no value`);
    assert.ok(fig.why && fig.why.length > 40, `${key} is unmotivated: ${fig.why}`);
  }
  const { evaluated, prose } = assertExprs({
    figures: D.figures, scope: exprScope(), label: "revellecommons",
  });
  assert.ok(evaluated >= 30, `only ${evaluated} figures evaluated — the block is too thin`);
  /* Prose derivations are allowed but must stay rare and must never be where a
     drawn dimension hides. The prose figures here are the eight ortho-fit
     statistics and the two edge COUNTS, and not one of them draws anything.
     `graphic.firstBay` used to be among them and is now an evaluated expr —
     audit finding 1 moved the station 3 bays inside a prose rule with every
     gate passing. */
  assert.ok(prose <= 11, `${prose} figures fell back to prose — arithmetic is the default`);
  for (const [key, decl] of Object.entries(D.figures)) {
    if (decl.expr === undefined) {
      assert.match(key, /^(orthoFit|graphic\.firstBay|canopy\.attachHeight)/,
        `${key} is prose and is not one of the declared prose figures — every drawn figure must be arithmetic`);
    }
  }
});

/* ------------------------------------------- S1: the axiom layer, gated */

const ELEV = "suffolk-Desktop-2_1-UCSD-64-degrees-3.jpg at its original 1440x800, all five band edges read as 50% crossings between the local plateaus either side, in the strip x 300..1000";
const ORTHO = "docs/data/textures/chunk_4_6.jpg at 8.000 px/m per docs/data/textures/manifest.json, strongest-gradient edge with a parabolic sub-pixel fit in a +/-2.6 m window";
const GIS = "docs/data/campus-arcgis.json massing[96] ring 0 at /10, carried verbatim — a vertex of the ring campus-massing.js extrudes";
const LID = "docs/data/campus-lidar.json, the CA_SanDiegoQL2_2014 flight";
const F33 = "studioe-64degrees-33.jpg at its original 1500x1000, the dusk frame of the SOUTH frontage, scaled by the round column beside the canopy at the same depth";
const FES = "Foodservice Equipment & Supplies magazine, 2015-02-01, '56-foot-wide, 22-foot-high'";

const pin = (value, truth, tol) => ({ value, truth, tol });
const READING_PINS = {
  "px.parapetTop": pin(28.10, `${ELEV} — sky / top of the brown parapet band`),
  "px.parapetToSoffit": pin(133.13, `${ELEV} — parapet band foot / soffit`),
  "px.soffitToGlazing": pin(220.71, `${ELEV} — soffit / head of the glazing`),
  "px.transomLo": pin(477.50, `${ELEV} — the transom bar's upper half-max crossing. The bar is BRIGHT against the graphic (baseline L 99.6, peak L 130.3 at y 479), and its edges are the crossings of that peak, not gradient extrema`),
  "px.transomHi": pin(480.81, `${ELEV} — the same bar's lower half-max crossing, giving a full width at half maximum of 3.31 px`),
  "px.glazingToPlinth": pin(632.96, `${ELEV} — foot of glazing / top of plinth, a 50% crossing of row TEXTURE because the luminances differ by under 7`),
  "px.plinthToPaving": pin(695.75, `${ELEV} — foot of plinth / paving`),
  "px.panelFirst": pin(230.8, `${ELEV} — the first mullion pair-centre, from a full-height vertical-line detector`),
  "px.panelLast": pin(1397.0, `${ELEV} — the twelfth and last mullion pair-centre`),
  "px.panelCount": pin(11, `${ELEV} — a COUNT of glazing panels between twelve located mullion centres, foreshortening-immune`),
  "px.f33ColumnTop": pin(270, `${F33} — the capital of the round column standing beside the canopy, i.e. the soffit underside`),
  "px.f33ColumnFoot": pin(640, `${F33} — the same column's foot at the paving; the pair gives the frame's local scale at the canopy's own depth`),
  "px.f33CanopyTop": pin(390, `${F33} — the canopy fabric's attachment edge at the wall`),
  "px.f33CanopyOuter": pin(520, `${F33} — the canopy's free outer edge; the two give a VERTICAL drop, the one canopy dimension an oblique frame does not foreshorten`),
  "px.mullionPairGap": pin(7.911, `${ELEV} — mean separation of the nine interior mullion edge PAIRS, i.e. the mullion's own face width in pixels`),
  "px.signX0": pin(990, `${ELEV} — west edge of the 3-D yellow sign, from a saturation mask over 19,066 px`),
  "px.signX1": pin(1229, `${ELEV} — east edge of the same mask`),
  "px.signY0": pin(486, `${ELEV} — top of the same mask`),
  "px.signY1": pin(631, `${ELEV} — foot of the same mask, which lands 1.96 px off the independently read plinth-top line`),
  "published.graphicWidthFt": pin(56, `${FES} — the WIDTH, which is the only external scale this elevation has`),
  "published.graphicHeightFt": pin(22, `${FES} — the HEIGHT, carried as an independent check that fails by 10% and never as a scale`),
  "survey.lidarDegrees": pin(9.9, `${LID} heights['64 Degrees']`),
  "survey.lidarCommons": pin(7.5, `${LID} heights['Revelle Commons']`),
  "survey.lidarNorth": pin(5.0, `${LID} heights['64 North']`),
  "survey.massHeight": pin(11.3, `${LID} massHeights['m:-100,359'] — the single height the extruder closes all three blocks at`),
  "survey.prismBase": pin(23.8, "campus-massing.js roofElevation over the massing ring returns 35.100 and the drawn prism base is that less the drawn 11.3 m height"),
  "ring.dgEast_ax": pin(-63.3, `${GIS} — the 64 Degrees east face's south end`),
  "ring.dgEast_az": pin(378.6, `${GIS} — the same vertex`),
  "ring.dgEast_bx": pin(-63.7, `${GIS} — the 64 Degrees east face's north end`),
  "ring.dgEast_bz": pin(344.7, `${GIS} — the same vertex`),
  "ring.dgSouth_ax": pin(-92.7, `${GIS} — the 64 Degrees south face's west end`),
  "ring.dgSouth_az": pin(378.9, `${GIS} — the same vertex`),
  "ring.dgSouth_bx": pin(-63.3, `${GIS} — the 64 Degrees south face's east end`),
  "ring.dgSouth_bz": pin(378.6, `${GIS} — the same vertex`),
  "ring.dgNorth_ax": pin(-63.7, `${GIS} — the 64 Degrees north face's east end`),
  "ring.dgNorth_az": pin(344.4, `${GIS} — the same vertex`),
  "ring.dgNorth_bx": pin(-93.0, `${GIS} — the 64 Degrees north face's west end`),
  "ring.dgNorth_bz": pin(344.7, `${GIS} — the same vertex`),
  "ring.commonsSouth_ax": pin(-136.4, `${GIS} — the Commons south face's west end`),
  "ring.commonsSouth_az": pin(396.1, `${GIS} — the same vertex`),
  "ring.commonsSouth_bx": pin(-92.6, `${GIS} — the Commons south face's east end`),
  "ring.commonsSouth_bz": pin(395.8, `${GIS} — the same vertex`),
  "ring.northNorth_ax": pin(-93.3, `${GIS} — 64 North's north face, east end`),
  "ring.northNorth_az": pin(327.7, `${GIS} — the same vertex`),
  "ring.northNorth_bx": pin(-112.6, `${GIS} — 64 North's north face, west end`),
  "ring.northNorth_bz": pin(327.9, `${GIS} — the same vertex`),
  "ring.northWest_ax": pin(-112.6, `${GIS} — 64 North's west face, north end`),
  "ring.northWest_az": pin(327.9, `${GIS} — the same vertex`),
  "ring.northWest_bx": pin(-112.4, `${GIS} — 64 North's west face, south end`),
  "ring.northWest_bz": pin(349.7, `${GIS} — the same vertex`),
  "ring.northEast_ax": pin(-92.9, `${GIS} — 64 North's east face, north end`),
  "ring.northEast_az": pin(344.6, `${GIS} — the same vertex`),
  "ring.northEast_bx": pin(-93.3, `${GIS} — 64 North's east face, south end`),
  "ring.northEast_bz": pin(328.0, `${GIS} — the same vertex`),
  "ortho.commonsN.raw": pin(347.862, `${ORTHO} — Commons north roof edge, bright membrane against the dark lawn of arcgis.ground#1171`),
  "ortho.commonsN.osm": pin(349.5, "docs/data/campus-3d.json buildings[397], the OSM north wall this edge belongs to"),
  "ortho.commonsN.h": pin(7.5, `${LID} — the block this edge belongs to`),
  "ortho.degreesN.raw": pin(342.145, `${ORTHO} — 64 Degrees north roof edge`),
  "ortho.degreesN.osm": pin(344.0, "docs/data/campus-3d.json buildings[409], the OSM north wall"),
  "ortho.degreesN.h": pin(9.9, `${LID} — the block this edge belongs to`),
  "ortho.northN.raw": pin(328.366, `${ORTHO} — 64 North's north roof edge, with its own 0.4 m wall shadow immediately north of it`),
  "ortho.northN.osm": pin(330.0, "docs/data/campus-3d.json buildings[436], the OSM north wall"),
  "ortho.northN.h": pin(5.0, `${LID} — the block this edge belongs to`),
  "ortho.commonsW.raw": pin(-140.096, `${ORTHO} — Commons west roof edge, against the service apron`),
  "ortho.commonsW.osm": pin(-139.5, "docs/data/campus-3d.json buildings[397], the OSM west wall"),
  "ortho.commonsW.h": pin(7.5, `${LID} — the block this edge belongs to`),
  "ortho.degreesE.raw": pin(-64.395, `${ORTHO} — 64 Degrees east roof edge, against the unnamed plaza`),
  "ortho.degreesE.osm": pin(-63.7, "docs/data/campus-3d.json buildings[409], the OSM east wall"),
  "ortho.degreesE.h": pin(9.9, `${LID} — the block this edge belongs to`),
};
const UNIT_PINS = {
  inch: pin(0.0254, "exact by definition: 1 international inch = 0.0254 m"),
  foot: pin(0.3048, "exact by definition: 1 international foot = 0.3048 m"),
};

test("S1(iii): every reading is pinned to the artefact it was read off", () => {
  const n = assertPins({
    readings: section.derivations.readings, pins: READING_PINS,
    namespaces: ["px", "published", "survey", "ring", "ortho"],
    label: "revellecommons readings",
  });
  assert.ok(n >= 60, `only ${n} readings pinned — the section carries more than that`);
  assertPins({ readings: section.derivations.units, pins: UNIT_PINS, namespaces: [], label: "revellecommons units" });
  /* THE READINGS MUST BE THE SURVEY, not a transcription of it. */
  near(section.derivations.readings.survey.lidarDegrees, lidar.heights["64 Degrees"], 1e-9, "lidarDegrees");
  near(section.derivations.readings.survey.lidarCommons, lidar.heights["Revelle Commons"], 1e-9, "lidarCommons");
  near(section.derivations.readings.survey.lidarNorth, lidar.heights["64 North"], 1e-9, "lidarNorth");
  near(section.derivations.readings.survey.massHeight, lidar.massHeights["m:-100,359"], 1e-9, "massHeight");
  near(section.derivations.readings.survey.massHeight, drawn.h, 1e-9,
    "the drawn mass's height is no longer massHeights — rekey the section");
  /* And every ring reading must be a VERTEX of the ring the extruder draws. */
  const R = section.derivations.readings.ring;
  for (const f of section.facades) {
    for (const [xk, zk] of [[`${f.id}_ax`, `${f.id}_az`], [`${f.id}_bx`, `${f.id}_bz`]]) {
      assert.ok(ring.some(([x, z]) => x === R[xk] && z === R[zk]),
        `${f.id}: (${R[xk]}, ${R[zk]}) is not a vertex of the drawn Revelle Commons ring`);
    }
  }
});

test("S1(iii): the relations the section states in PROSE are asserted", () => {
  const D = section.derivations;
  const F = D.figures;
  const B = section.system.bands;
  const rel = [];
  /* THE KEYSTONE. The four bands must sum to the span read independently as
     one, or one of the five edges has moved and every figure moved with it. */
  rel.push({ name: "the four bands sum to the independently read stack",
    got: F["band.parapet"].value + F["band.soffit"].value
       + F["band.glazingDegrees"].value + F["band.plinth"].value,
    want: F["stack.degrees"].value, tol: 1e-6 });
  rel.push({ name: "the stack closes against LiDAR to better than 2%",
    got: Math.abs(F["stack.lidarResidualPct"].value), want: 1.3, tol: 0.7 });
  /* The Commons' glazing is what absorbs the block's height difference, and
     the parapet, soffit and plinth are the SAME numbers on both blocks. */
  rel.push({ name: "the Commons block closes on its own LiDAR height",
    got: B.parapet + B.soffit + B.plinth + B.glazing.commons,
    want: D.readings.survey.lidarCommons, tol: 1e-6 });
  rel.push({ name: "the 64 Degrees block closes on its own measured stack",
    got: B.parapet + B.soffit + B.plinth + B.glazing.degrees,
    want: F["stack.degrees"].value, tol: 1e-6 });
  /* The residues are the drawn lid less each block's own roof. */
  for (const [k, r] of [["Degrees", "degrees"], ["Commons", "commons"], ["North", "north"]]) {
    rel.push({ name: `residue.${r} is the drawn lid less the ${r} roof`,
      got: F[`residue.${r}`].value,
      want: D.readings.survey.massHeight - D.readings.survey[`lidar${k}`], tol: 1e-6 });
  }
  /* The per-face fit: bays x bay IS the surveyed length, on every face. */
  for (const f of section.facades.filter((q) => q.glazed)) {
    /* On precision: `bay` is published to six decimal places, so bays x bay
       reproduces the surveyed length only to bays x 5e-7 — 1.4e-5 on the
       28-bay Commons face. The tolerance is that publication floor, NOT a
       modelling tolerance: it is two orders of magnitude below the 0.001 m at
       which any real change to the fit would show. */
    rel.push({ name: `${f.id}: bays x bay is the surveyed face length`,
      got: f.bays * f.bay, want: f.length, tol: f.bays * 5e-7 + 1e-9 });
    rel.push({ name: `${f.id}: the declared length is the drawn ring's own chord`,
      got: f.length, want: Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]), tol: 1e-6 });
  }
  /* Every face, glazed or blank, must carry the drawn ring's own chord length. */
  for (const f of section.facades) {
    rel.push({ name: `${f.id}: length is the ring chord`,
      got: f.length, want: Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]), tol: 1e-6 });
  }
  /* THE BLANK BLOCK CLOSES ON ITS OWN LiDAR HEIGHT, exactly as the glazed ones
     do — the blank precast band is the same derivation in a different material. */
  rel.push({ name: "the 64 North block closes on its own LiDAR height",
    got: B.parapet + B.soffit + B.plinth + B.blank.north,
    want: D.readings.survey.lidarNorth, tol: 1e-6 });
  /* The graphic is 11 of the east face's 22 bays and its width closes. */
  rel.push({ name: "the graphic's 11 counted panels at the nominal module ARE its published width",
    got: section.system.graphic.bays * F["bay.module"].value,
    want: F["scale.graphicWidth"].value, tol: section.system.graphic.bays * 5e-7 + 1e-9 });
  rel.push({ name: "the graphic fits inside the east face's bay count",
    got: Math.sign(section.facades[0].bays - (section.system.graphic.firstBay + section.system.graphic.bays)),
    want: 1, tol: 0 });
  assertRelations({ relations: rel, label: "revellecommons" });
});

/* Every `draw` number is a RENDER OFFSET and must carry its own sibling Note.
   This is a RULE rather than blake's allowlist: an allowlist grows by one line
   per new offset and nobody notices, whereas this fails the moment an offset is
   added without the sentence that says why it is not a measurement. */
const drawNoteFor = (path) => {
  const parts = path.split(".").slice(1);
  const note = section.draw[`${parts[0]}Note`];
  return typeof note === "string" && note.length > 40 ? "declared render offset" : null;
};

test("S1(i): no bare number survives in readings, estimates or draw", () => {
  const paths = assertCoverage({
    section, label: "revellecommons", minimum: 75,
    /* colorSources and colorThreshold joined the walk at re-audit: their numbers
       are the tier gate's operands and were the one attack surface S1(i) did
       not cover. Every one resolves through a pin in this file. */
    roots: { "derivations.readings": {}, "derivations.units": {}, estimates: {}, draw: {},
      colorSources: {}, colorThreshold: {} },
    uncovered: {},
    classify: (path) => {
      if (path.startsWith("derivations.readings.")) {
        return READING_PINS[path.slice("derivations.readings.".length)] ? "pinned" : null;
      }
      if (path.startsWith("derivations.units.")) {
        return UNIT_PINS[path.slice("derivations.units.".length)] ? "pinned" : null;
      }
      if (/^estimates\..+\.(value|band\.[01])$/.test(path)) return "banded";
      if (path.startsWith("draw.")) return drawNoteFor(path);
      if (/^colorSources\.[A-Za-z]+\.sample(L|Sd)$/.test(path)) {
        return SAMPLE_PINS[path.split(".")[1]] ? "pinned sample" : null;
      }
      if (/^colorThreshold\.(sunlitMin|sdMax)$/.test(path)) return "pinned threshold";
      if (/^colorThreshold\.controls\.\d+\.(L|px|rect\.\d+)$/.test(path)) {
        return CONTROL_PINS[section.colorThreshold.controls[Number(path.split(".")[2])]?.key]
          ? "pinned control" : null;
      }
      return null;
    },
  });
  assert.ok(paths.length >= 110, `the walk only found ${paths.length} numbers in the axiom layer`);
  /* And the rule really bites: every draw number resolved through a Note. */
  const drawNumbers = paths.filter((p) => p.path.startsWith("draw."));
  assert.ok(drawNumbers.length >= 10, `only ${drawNumbers.length} draw numbers walked`);
  for (const { path } of drawNumbers) {
    assert.ok(drawNoteFor(path), `${path} has no sibling Note explaining why it is not a measurement`);
  }
});

const EST_SHIPPED = {
  "facade.moduleExtension": () =>
    Math.max(...section.facades
      .filter((f) => f.glazed && f.id !== section.system.graphic.face).map((f) => f.bay)),
  "system.columns.spacingBays": () => section.system.columns.spacingBays,
  "system.columns.diameter": () => section.system.columns.diameter,
  "system.canopy.bays": () => section.system.canopy.bays,
  "system.canopy.projection": () => section.system.canopy.projection,
  "system.graphic.centreOffsetBays": () =>
    (section.system.graphic.firstBay + section.system.graphic.bays / 2)
    - section.facades.find((f) => f.id === section.system.graphic.face).bays / 2,
};

test("S1(ii): every estimate carries a band, and the shipped value is inside it", () => {
  const n = assertEstimateBands({
    estimates: section.estimates,
    valueAt: (key) => {
      const f = EST_SHIPPED[key];
      assert.ok(f, `revellecommons: estimate ${key} governs no shipped value this suite knows about`);
      return f();
    },
    label: "revellecommons",
  });
  assert.equal(n, Object.keys(section.estimates).length, "every estimate must be banded");
  for (const [k, e] of Object.entries(section.estimates)) {
    assert.ok(e.bandWhy && e.bandWhy.length > 80, `estimate ${k}'s band is a bare pair with no argument`);
    assert.ok(e.why.length > 120, `estimate ${k} does not record its failed ladder`);
    assert.match(e.why, /Ladder|rung/i, `estimate ${k} does not name the ladder it climbed`);
  }
  /* The whole POPULATION sits inside the module band, not just the one value
     the band gate compares — a band over a single sample is not a band. */
  const [lo, hi] = section.estimates["facade.moduleExtension"].band;
  for (const f of section.facades.filter((q) => q.glazed)) {
    assert.ok(f.bay >= lo - 1e-9 && f.bay <= hi + 1e-9,
      `${f.id} ships a ${f.bay} m bay, outside the extension's own published band [${lo}, ${hi}]`);
  }
  /* And the column spacings, which are a whole number of each face's own bay. */
  const [cLo, cHi] = section.estimates["system.columns.spacingBays"].band;
  for (const r of section.system.columns.runs) {
    const f = section.facades.find((q) => q.id === r.face);
    const bays = r.spacing / f.bay;
    assert.ok(bays >= cLo - 1e-6 && bays <= cHi + 1e-6,
      `${r.face}'s colonnade spacing is ${bays} bays, outside the band [${cLo}, ${cHi}]`);
  }
});

test("S1(iv): the tier gate runs BOTH ways over colours and estimates", () => {
  const entries = [
    ...Object.entries(section.colorSources).map(([key, p]) => ({ key: `colour:${key}`, text: `[${p.tier}] ${p.source}` })),
    ...Object.entries(section.estimates).map(([key, e]) => ({ key: `estimate:${key}`, text: e.why })),
  ];
  const n = assertTierSymmetry({ entries, label: "revellecommons" });
  assert.ok(n >= 14, `the tier gate only walked ${n} lines`);
  /* The two roles that EXTEND a pattern must be estimated, both ways round. */
  for (const k of ["plinth", "signageWall"]) {
    assert.equal(section.colorSources[k].tier, "estimated",
      `${k} extends another element's sample and may not be promoted above [estimated]`);
    assert.match(section.colorSources[k].source, /xtends/,
      `${k} is tiered estimated and must say what it extends`);
  }
});

/* ------------------------------------------- THE HEIGHT DECISION, GATED */

test("the stack hangs UPWARD, the shorter block derives its glazing, and the residue is declared", () => {
  const F = section.derivations.figures;
  const B = section.system.bands;
  const S = section.derivations.readings.survey;
  /* THE FINDING THE RESEARCH DID NOT ANTICIPATE, held here so a later edit
     cannot quietly hang the measured stack on a block that cannot carry it. */
  assert.ok(F["stack.degrees"].value > S.lidarCommons,
    "the measured stack is no longer taller than the Commons block — if that is real, band.glazingCommons is no longer a derivation and this whole design changes");
  assert.ok(F["stack.degrees"].value > S.lidarNorth,
    "the measured stack must not fit the 5.0 m north block either");
  /* The parapet, soffit and plinth are ONE set of numbers, not per-block. */
  assert.equal(typeof B.parapet, "number", "the parapet must be one measured value for the whole building");
  assert.equal(typeof B.soffit, "number");
  assert.equal(typeof B.plinth, "number");
  assert.ok(B.glazing.degrees !== B.glazing.commons,
    "the glazing is the ONLY per-block term and the two blocks must differ in it");
  near(B.glazing.commons, F["band.glazingCommons"].value, 1e-9, "the Commons glazing drifted from its derivation");
  near(B.glazing.degrees, F["band.glazingDegrees"].value, 1e-9, "the 64 Degrees glazing drifted from its read");
  /* The conflict carries ALL FOUR numbers and refuses the fourth opinion. */
  const c = section.conflicts.find((q) => q.key === "three-roofs-one-prism");
  assert.ok(c, "the governing height conflict is not declared");
  const sides = c.sides.join(" ");
  for (const v of ["9.9", "7.5", "5.0", "11.3"]) {
    assert.ok(sides.includes(v), `the height conflict does not carry ${v}`);
  }
  assert.match(sides, /arcgis\.h[^.]*NOT admitted|not a measurement/i,
    "arcgis.h = 8.5 is a formula and the conflict must refuse it as a fourth opinion");
  assert.match(c.resolution, /NOT AVERAGED/);
  assert.match(c.resolution, /option \(2\)/i, "the resolution must name which option it took");
  /* THE RESIDUE, PER BLOCK, TIED TO ITS BLOCK BY NAME. A loose alternation over
     the three numbers passed a mutation that deleted the whole residue sentence,
     because the resolution's own "1.4-6.3 m wrong" phrase about the REJECTED
     option matched it. Each residue must now appear beside the block it belongs
     to, and the values are read from the figures rather than typed here. */
  for (const [key, block] of [["residue.degrees", "64 Degrees"],
    ["residue.commons", "the Commons"], ["residue.north", "64 North"]]) {
    const re = new RegExp(`${F[key].value.toFixed(1)} m on ${block}`);
    assert.match(c.resolution, re,
      `the resolution does not carry ${key} against the block it belongs to`);
  }
  assert.match(c.resolution, new RegExp(F["residue.degreesTreated"].value.toFixed(3)),
    "and the residue measured against the treatment's own top must be there too");
  /* 64 NORTH CARRIES THE BANDS AND NOT THE GLAZING, on all three of its faces.
     The line is PROGRAM: the parapet, soffit and plinth are not program-bearing
     and are continuous round the complex; glazing is, and both plans put
     back-of-house behind these faces. Its band closes on its own LiDAR height
     exactly as the Commons' does. */
  assert.equal(section.measured.blocks.north.treated, "bands");
  const northFaces = section.facades.filter((f) => f.block === "north");
  assert.equal(northFaces.length, 3, "all three of 64 North's faces must be dressed, or none");
  for (const f of northFaces) {
    assert.equal(f.glazed, false, `${f.id} may not carry glazing — both plans put back-of-house behind it`);
  }
  assert.equal(typeof B.blank.north, "number", "the north block's blank precast band is not declared");
  near(B.blank.north, F["band.blankNorth"].value, 1e-9, "the blank band drifted from its derivation");
  assert.ok(B.blank.north !== B.glazing.degrees && B.blank.north !== B.glazing.commons,
    "the blank band must be its own block's derivation, not another block's");
  assert.match(section.measured.blocks.north.note, /program-bearing/i,
    "the record must say WHY the line falls between the bands and the glazing");
  assert.ok(section.superseded["absent.northBlockUntreated"],
    "the reversal of the untreated ruling must be recorded, not silently applied");
});

/* ------------------------- THE ORTHO RE-FIT, RECOMPUTED IN THIS FILE */

test("the local ortho re-fit is reproduced here, and a constant still beats a rate", () => {
  const O = section.derivations.readings.ortho;
  const F = section.derivations.figures;
  const AX = { Z: ["commonsN", "degreesN", "northN"], X: ["commonsW", "degreesE"] };
  const rms = (v) => Math.sqrt(v.reduce((a, q) => a + q * q, 0) / v.length);
  /* THE WITHDRAWN EDGE MUST STAY WITHDRAWN. It failed the section's own stated
     criterion — bright surface on BOTH sides of a 0.5 m dark stripe — and
     re-admitting it would put back a reading the method cannot produce. */
  assert.equal(O.northW, undefined,
    "64 North's west roof edge is back in the fit; the section's own criterion does not describe it");
  assert.equal(Object.keys(O).filter((k) => k !== "source").length, 5,
    "the ortho block must carry exactly the five edges the fit uses");
  for (const [ax, keys] of Object.entries(AX)) {
    assert.equal(F[`orthoFit.edges${ax}`].value, keys.length,
      `the declared ${ax} edge count is not what this suite fits`);
    const d = keys.map((k) => O[k].raw - O[k].osm);
    const h = keys.map((k) => O[k].h);
    const c = d.reduce((a, q) => a + q, 0) / d.length;
    const rate = d.reduce((a, q, i) => a + h[i] * q, 0) / h.reduce((a, q) => a + q * q, 0);
    near(F[`orthoFit.offset${ax}`].value, c, 1e-6, `the declared ${ax} offset is not the mean of its own readings`);
    near(F[`orthoFit.rate${ax}`].value, rate, 1e-6, `the declared ${ax} rate is not the fit of its own readings`);
    near(F[`orthoFit.rmsConstant${ax}`].value, rms(d.map((q) => q - c)), 1e-6, `${ax} constant rms`);
    near(F[`orthoFit.rmsRate${ax}`].value, rms(d.map((q, i) => q - rate * h[i])), 1e-6, `${ax} rate rms`);
  }
  /* THE FINDING, ON THE AXIS THAT CAN CARRY IT. Three z edges at three heights
     discriminate. The two remaining x edges cannot — two observations cannot
     separate two one-parameter models — and the section publishes that ratio,
     which is below 1, as evidence of weakness rather than claiming it as
     support. The shipped "the two axes agree" was withdrawn at audit. */
  assert.ok(F["orthoFit.rmsConstantZ"].value < F["orthoFit.rmsRateZ"].value,
    "z: a height-proportional model now fits at least as well as a constant — the refutation must be re-argued, not quietly kept");
  assert.ok(F["orthoFit.modelRatioZ"].value > 2,
    `z: the constant only wins by ${F["orthoFit.modelRatioZ"].value}, too thin to carry a withholding this large`);
  assert.equal(F["orthoFit.edgesX"].value, 2);
  assert.ok(F["orthoFit.modelRatioX"].value < 2,
    "the x axis has two edges and cannot discriminate; if it now can, the section must argue it rather than record it as weak");
  assert.match(section.conflicts.find((q) => q.key === "ortho-displacement-model").sides.join(" "),
    /NON-DISCRIMINATING/, "the x axis's weakness must be on the record, not implied");

  /* THE DIAGNOSTIC THAT NEEDS NO FIT AT ALL, recomputed here from the pinned
     readings. It is what survives any argument about model selection, and it is
     why the refutation stands even though the x axis lost its third edge. */
  const anti = Math.abs(O.northN.raw - O.northN.osm) / Math.abs(O.degreesN.raw - O.degreesN.osm);
  near(F["orthoFit.antiHeightZ"].value, anti, 1e-6, "the declared anti-height ratio is not its own readings'");
  near(F["orthoFit.antiHeightPredicted"].value, O.northN.h / O.degreesN.h, 1e-6,
    "the proportional prediction is not the two blocks' own height ratio");
  assert.ok(anti > F["orthoFit.antiHeightPredicted"].value * 1.5,
    `the 5.0 m block displaces ${anti.toFixed(3)} of the 9.9 m block's against a proportional ${F["orthoFit.antiHeightPredicted"].value.toFixed(3)} — if that gap closes the fit-free refutation is gone`);
  /* The dossier's imported rate is worse than both, and the section says so. */
  const c = section.conflicts.find((q) => q.key === "ortho-displacement-model");
  assert.ok(c, "the ortho model conflict is not declared");
  assert.match(c.resolution, /NO ORTHO-DERIVED FIGURE SHIPS|no ortho-derived position ships/i,
    "the consequence, not just the finding, must be on the record");
  /* MINOR 7: the Apple analogy was BACKWARDS — CLAUDE.md's own remedy is a
     fitted registration, which is what this section produced — and the correct
     ground is coverage, not magnitude. */
  assert.match(c.resolution, /BACKWARDS/,
    "the withdrawn Apple-offset analogy must be recorded as withdrawn, not deleted");
  assert.match(c.resolution, /BOTH SOUTH EDGES ARE EXCLUDED/,
    "the real ground — the fit is unconstrained exactly where the terrace is — must be the stated one");
  assert.ok(section.superseded["research.orthoDisplacementRate"],
    "the imported rate's retirement must be recorded, not merely disagreed with");
});

/* ------------------------------------------------------- the quarantine */

test("the drawn rings are the survey's, copied verbatim", () => {
  assert.deepEqual(section.measured.ring, ring,
    "measured.ring must be the ring the massing draws for this cluster, byte for byte");
  assert.deepEqual([section.court.x0, section.court.x1, section.court.z0, section.court.z1],
    [Math.min(...courtRing.map((p) => p[0])), Math.max(...courtRing.map((p) => p[0])),
      Math.min(...courtRing.map((p) => p[1])), Math.max(...courtRing.map((p) => p[1]))],
    "the court's extent must be the drawn inner ring's own bbox");
  assert.match(section.measured.courtyardRingNote, /shape\.holes|826/,
    "the court note must record that the extruder opens this void and gives it no floor");
  assert.equal(section.court.datum, "surfaceAt", "the court floor is GROUND");
  assert.equal(section.court.facesBuilt, false, "the court's four walls have no photograph and must stay bare");
});

test("every facade hangs off two vertices of the drawn ring, with its normal outward", () => {
  const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const cz = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  assert.equal(section.facades.length, 7, "seven faces of the cluster's ten external runs");
  for (const f of section.facades) {
    for (const p of [f.a, f.b]) {
      assert.ok(ring.some(([x, z]) => x === p[0] && z === p[1]),
        `${f.id}: ${JSON.stringify(p)} is not a vertex of the drawn ring`);
    }
    assert.notDeepEqual(f.a, f.b, `${f.id} is a zero-length face`);
    const mx = (f.a[0] + f.b[0]) / 2 - cx;
    const mz = (f.a[1] + f.b[1]) / 2 - cz;
    assert.ok(mx * f.out[0] + mz * f.out[1] > 0, `${f.id}'s normal points into the building`);
    assert.ok(f.source && f.source.length > 80, `${f.id} has no described source`);
    assert.equal(f.estimated, f.tier === "estimated", `${f.id}'s estimated flag disagrees with its tier`);
  }
  /* THREE OF THE FOUR FACES SPAN COLLINEAR INTERMEDIATE VERTICES and they are
     checked rather than ignored: a face declared as one chord across a ring
     that actually bends would slice through its own building. */
  for (const f of section.facades) {
    /* The drawn ring is CLOSED — its first vertex is repeated as its last — so a
       face ending on that vertex must match the LATER occurrence or the walk
       runs backwards round the whole building. 64 North's east face ends
       exactly there and did. */
    const [ia, ib] = ringSpan(f);
    const len = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]);
    for (let i = Math.min(ia, ib) + 1; i < Math.max(ia, ib); i++) {
      const [x, z] = ring[i];
      const t = ((x - f.a[0]) * (f.b[0] - f.a[0]) + (z - f.a[1]) * (f.b[1] - f.a[1])) / (len * len);
      const dx = x - (f.a[0] + t * (f.b[0] - f.a[0]));
      const dz = z - (f.a[1] + t * (f.b[1] - f.a[1]));
      assert.ok(Math.hypot(dx, dz) <= 0.10,
        `${f.id}: ring vertex ${i} (${x}, ${z}) is ${Math.hypot(dx, dz).toFixed(3)} m off the declared chord`);
    }
  }
  /* Only ONE face is a labelled extension and it is the unphotographed one. */
  const est = section.facades.filter((f) => f.tier === "estimated");
  assert.deepEqual(est.map((f) => f.id).sort(),
    ["dgNorth", "northEast", "northNorth", "northWest"],
    "exactly four faces are [estimated] extensions and this suite knows which");
  for (const f of est) assert.match(f.source, /\[estimated\]|DEAD COLOUR EPOCH|NO PHOTOGRAPH/i,
    `${f.id} is an extension and its source must say so`);
  /* AND THE LINE BETWEEN THEM IS PROGRAM, not photography. Every blank face is
     [estimated]; every glazed face that is [estimated] must be one the plans
     put a PUBLIC program behind, which is the whole argument for extending a
     glazed system at all. */
  for (const f of section.facades.filter((q) => !q.glazed)) {
    assert.equal(f.tier, "estimated", `${f.id} carries no photograph and may not claim a tier above [estimated]`);
    assert.equal(f.block, "north", "only the 64 North block ships blank faces");
  }
});

test("the module nominal is declared as a divisor, and every shipped bay differs from it", () => {
  const F = section.derivations.figures;
  assert.match(section.system.bay.moduleNote, /GENERATOR NOMINAL/,
    "the nominal must be labelled as the divisor it is, not left reading as a shipped dimension");
  for (const f of section.facades.filter((q) => q.glazed)) {
    near(f.bay, F[`face.${f.id}.bay`].value, 1e-9, `${f.id}'s bay drifted from its derivation`);
    assert.equal(f.bays, F[`face.${f.id}.bays`].value, `${f.id}'s bay count drifted`);
    assert.notEqual(f.bay, F["bay.module"].value,
      `${f.id} ships exactly the nominal — if that is real the moduleNote is wrong`);
  }
  /* The spread is REAL: four faces, four different bays. */
  assert.equal(new Set(section.facades.filter((f) => f.glazed).map((f) => f.bay)).size, 4,
    "the whole point of the per-face fit is that the faces differ");
  /* A BLANK face declares no bay at all — declaring one would assert a rhythm
     no source gives, which is exactly what its glazing withholding refuses. */
  for (const f of section.facades.filter((q) => !q.glazed)) {
    assert.equal(f.bays, undefined, `${f.id} is blank and must declare no bay count`);
    assert.equal(f.bay, undefined, `${f.id} is blank and must declare no bay`);
  }
});

/* ---------------------------------------------------- provenance apparatus */

test("colours are data, hex, tiered per role, sampled with their rectangles", () => {
  const entries = Object.entries(section.colors);
  assert.ok(entries.length >= 10, `only ${entries.length} colours`);
  for (const [k, v] of entries) {
    assert.match(v, /^#[0-9a-f]{6}$/, `${k} is not a lowercase 6-digit hex`);
    const p = section.colorSources[k];
    assert.ok(p, `${k} has no colorSources line`);
    assert.match(p.tier, /^(measured|sourced|estimated)$/, `${k}'s tier is ${p.tier}`);
    assert.ok(p.source && p.source.length > 60, `${k}'s provenance is a stub`);
    if (p.tier !== "estimated") {
      assert.ok(!/\[estimated\]/.test(p.source),
        `${k} is tiered ${p.tier} but its own provenance calls the hex estimated`);
      /* EVERY non-estimated hex records the rectangle it was sampled from, so
         a value cannot be moved without moving a citable pixel range. */
      assert.match(p.source, /x \d+\.\.\d+, y \d+\.\.\d+/,
        `${k} claims [${p.tier}] and records no sample rectangle`);
      assert.match(p.source, /sd \d/, `${k} records no standard deviation for its sample`);
    }
  }
  /* THE EAST ELEVATION IS IN SHADE and no fabric hex may come from it. */
  assert.match(section.colorNote, /EAST ELEVATION IS IN SHADE/);
  assert.match(section.colorNote, /#d3c2a7/, "the measurement that establishes it must be quoted");
  for (const [k, p] of Object.entries(section.colorSources)) {
    if (k === "graphicPanel") continue;
    assert.ok(!/suffolk-Desktop/.test(p.source),
      `${k} is sampled from the shaded east elevation — a full-shade sample is not a material`);
  }
  assert.match(section.colorSources.graphicPanel.source, /AREA-AVERAGE/,
    "the one thing taken from the shaded frame is a tone, not an albedo, and must say so");
  /* No borrowing from a sibling section. */
  assert.match(section.colorFallback.note, /borrows no hex|Empty by construction/i);
  /* And no hex may leak into the builder. */
  assert.equal(moduleSrc.match(/#[0-9a-fA-F]{6}\b/g), null,
    "a colour literal leaked into the builder — colours are the section's");
});

test("reads carry a tolerance, and conflicts are declared with both sides", () => {
  assert.ok(Object.keys(section.reads).length >= 5);
  for (const [k, v] of Object.entries(section.reads)) {
    assert.match(v, /toleranc|\+\/-/i, `read ${k} carries no tolerance`);
  }
  assert.ok(section.conflicts.length >= 10, `only ${section.conflicts.length} conflicts declared`);
  const keys = section.conflicts.map((c) => c.key);
  for (const must of ["three-roofs-one-prism", "ortho-displacement-model", "gis-vs-osm-outline",
    "graphic-height", "bay-module-5ft", "levels-count", "commons-date", "building-area",
    "the-slot", "sign-and-doors-hand", "suffolk-page-epoch", "ceiling-height"]) {
    assert.ok(keys.includes(must), `conflict ${must} is not declared`);
  }
  for (const c of section.conflicts) {
    assert.ok(c.what && c.what.length > 60, `conflict ${c.key} does not say what it is about`);
    assert.ok(Array.isArray(c.sides) && c.sides.length >= 2, `conflict ${c.key} has fewer than two sides`);
    for (const s of c.sides) assert.ok(s.length > 40, `conflict ${c.key} has a stub side`);
    assert.ok(c.resolution && c.resolution.length > 60, `conflict ${c.key} is unresolved on the record`);
  }
  /* The counted module wins and the round 5 ft stays recorded as the loser. */
  const m = section.conflicts.find((c) => c.key === "bay-module-5ft");
  assert.match(m.sides.join(" "), /1\.524/, "the losing 5 ft hypothesis must stay legible");
  assert.match(m.resolution, /COUNT WINS/i);
  assert.match(m.resolution, /twelve|12 panels/i, "and the 12-panel 'fix' must be explicitly refused");
  /* The building area conflict SHIPS its reconciliation. */
  const a = section.conflicts.find((c) => c.key === "building-area");
  assert.match(a.resolution, /33,500/);
  assert.match(a.resolution, /1\.7%/, "the survey check that adjudicates it must carry its residual");
});

const ABSENT_KEYS = [
  ["courtyard-faces", /^The COURTYARD's four faces/],
  ["west-service-face", /^The WEST \/ SERVICE FACE/],
  ["north-block-untreated-retired", /^RETIRED — see superseded\['absent\.northBlockUntreated'\]/],
  ["north-block-glazing", /^64 NORTH'S GLAZING, OPENINGS AND BAY COUNTS/],
  ["north-block-east-face", /^64 NORTH'S EAST FACE/],
  ["northw-ortho-edge", /^64 NORTH'S WEST ROOF EDGE AS AN ORTHO READING/],
  ["transom-depth-retired", /^THE TRANSOM BAR'S ORIGINAL DEPTH READING/],
  ["commons-north-face", /^THE COMMONS' NORTH FACE/],
  ["commons-roof-rectangle", /^THE COMMONS ROOF'S 6\.3/],
  ["the-slot", /^THE SLOT,/],
  ["degrees-north-openings", /^THE BAY COUNT AND EVERY OPENING/],
  ["north-terrace-objects", /^THE NORTH TERRACE AND ALL ITS OBJECTS/],
  ["south-terrace-landscape", /^THE SOUTH TERRACE LANDSCAPE ENTIRELY/],
  ["shade-retired", /^RETIRED — see superseded\['absent\.buildingMountedShade'\]/],
  ["canopy-dimensions", /^THE CANOPY'S WIDTH, PROJECTION AND EXACT STATION/],
  ["not-mine-handoff", /^THREE THINGS THE VISUAL AUDIT FOUND/],
  ["canopy-colour-white", /^THE CANOPY'S SHIPPED WHITE/],
  ["lettering", /^ALL LETTERING AS TEXT/],
  ["graphic-image", /^THE PRINTED SURF GRAPHIC AS AN IMAGE/],
  ["graphic-station", /^THE GRAPHIC'S STATION/],
  ["column-flare", /^THE COLUMNS' FLARED CAPITALS/],
  ["roofscape", /^THE WHOLE ROOFSCAPE/],
  ["pv-negative", /^PHOTOVOLTAICS/],
  ["sw-notch-handedness", /^THE SOUTH-WEST NOTCH'S HANDEDNESS/],
  ["grove-2026", /^THE 2026 GROVE/],
  ["east-face-colours", /^EVERY COLOUR OF THE 64 DEGREES EAST ELEVATION/],
  ["commons-transom", /^THE COMMONS SOUTH FACE'S TRANSOM/],
  ["blake-strip", /^THE BLAKE STRIP/],
  ["surveyed-ground-rings", /^THE NINE SURVEYED GROUND RINGS/],
  ["interior", /^THE INTERIOR, all of it/],
];
const ABSENT_EXPECTED = {
  "courtyard-faces": /Every rung fails|Ladder climbed and failed/,
  "west-service-face": /DELIVERIES/,
  "north-block-untreated-retired": /absent lists do not shrink/,
  "north-block-glazing": /program-bearing/,
  "north-block-east-face": /dead epoch|2008/,
  "northw-ortho-edge": /bright surface on BOTH sides/,
  "transom-depth-retired": /does not reproduce/,
  "commons-north-face": /does not list this one/,
  "commons-roof-rectangle": /SKYLIGHT ARRAY/,
  "the-slot": /shape\.holes|826/,
  "degrees-north-openings": /\[estimated\]/,
  "north-terrace-objects": /Better absent than placed on a guess/,
  "south-terrace-landscape": /galbraith\.north\.apron|LARGEST SINGLE WITHHOLDING/,
  "shade-retired": /absent lists do not shrink/,
  "canopy-dimensions": /foreshorten/,
  "not-mine-handoff": /ground#3268/,
  "canopy-colour-white": /0xffffff|both directions/,
  lettering: /RENDERER LIMITATION/,
  "graphic-image": /UNRENDERABLE/,
  "graphic-station": /\[-0\.5, 0\.5\]|EVALUATED expr/,
  "column-flare": /Nothing measures it/,
  roofscape: /inside the solid drawn|3\.8 m INSIDE/,
  "pv-negative": /keeling\.roofs\.pv/,
  "sw-notch-handedness": /90 degrees/,
  "grove-2026": /THREE EPOCHS/,
  "east-face-colours": /REFUSED/,
  "commons-transom": /DERIVED/,
  "blake-strip": /blake\.absent\[2\]/,
  "surveyed-ground-rings": /#237[^]*#3267/,
  interior: /Warshaw/i,
};

test("the absent list is complete, PER ENTRY, and every entry says what it withholds", () => {
  assert.ok(section.absent.length >= 30, `absent is only ${section.absent.length} entries`);
  for (const a of section.absent) assert.ok(a.length > 80, `absent entry is a stub: ${a.slice(0, 60)}`);
  const keyed = section.absent.map((text) => {
    const hit = ABSENT_KEYS.find(([, re]) => re.test(text));
    return { key: hit ? hit[0] : `UNKEYED: ${text.slice(0, 60)}`, what: text };
  });
  const seen = new Set();
  for (const e of keyed) {
    assert.ok(!seen.has(e.key), `two absent entries key to ${e.key} — the keys must identify entries`);
    seen.add(e.key);
  }
  assertAbsentEntries({ absent: keyed, expected: ABSENT_EXPECTED, built: {}, label: "revellecommons absent" });
  /* Every entry that claims a failed ladder must have climbed the whole thing. */
  /* The RETIRED entry QUOTES the entries it supersedes, so its copy of the
     ladder phrase is a truncated quotation and not a live withholding. Live
     entries only. */
  const ladders = section.absent.filter((a) =>
    /Ladder climbed and failed/.test(a) && !/^RETIRED — see superseded/.test(a));
  assert.ok(ladders.length >= 3, "the ladder-climbing entries have gone");
  /* RETIREMENT IS BY SUPERSESSION, NEVER BY DELETION. The three entries the 64
     North ruling retired are carried VERBATIM inside the retirement entry. */
  const retirements = section.absent.filter((a) => /^RETIRED — see superseded/.test(a));
  assert.equal(retirements.length, 2,
    "there are two retirement entries — the 64 North ruling and the building-mounted shade ruling");
  const retired = retirements.find((a) => /absent\.northBlockUntreated/.test(a));
  assert.ok(retired, "the 64 North retirement entry is missing");
  /* The SHADE retirement carries its two entries under the same rule. */
  const shade = retirements.find((a) => /absent\.buildingMountedShade/.test(a));
  assert.ok(shade, "the building-mounted shade retirement entry is missing");
  assert.ok(!/\u2026|\.\.\./.test(shade), "the shade retirement carries an ellipsis");
  assert.equal((shade.match(/RETIRED ENTRY \d of 2 <</g) || []).length, 2,
    "both retired shade entries must be carried, each delimited");
  for (const c of [...shade.matchAll(/<<([\s\S]*?)>>/g)].map((m) => m[1])) {
    assert.ok(c.length > 380, `a carried shade entry is only ${c.length} chars`);
    assert.ok(c.trim().endsWith("."), "a carried shade entry was cut short");
  }
  assert.ok(!/\u2026|\.\.\./.test(retired),
    "the retirement entry carries an ellipsis — a truncated excerpt is not a verbatim carry");
  assert.equal((retired.match(/RETIRED ENTRY \d of 3 <</g) || []).length, 3,
    "all three retired entries must be carried, each delimited");
  /* Each carried entry must be COMPLETE: it opens with the heading the retired
     entry opened with and closes with a full stop inside its own delimiters,
     and it still contains the whole ladder it was retired with. */
  const carried = [...retired.matchAll(/<<([\s\S]*?)>>/g)].map((m) => m[1]);
  assert.equal(carried.length, 3);
  const heads = carried.map((c) => c.slice(0, 40));
  assert.ok(heads.some((h) => /^THE 64 NORTH BLOCK'S FACADE TREATMENT/.test(h)), "the treatment entry is not carried");
  assert.ok(heads.some((h) => /^64 NORTH'S NORTH FACE/.test(h)), "the north face entry is not carried");
  assert.ok(heads.some((h) => /^64 NORTH'S WEST FACE/.test(h)), "the west face entry is not carried");
  for (const c of carried) {
    assert.ok(c.length > 380, `a carried entry is only ${c.length} chars — the originals were 387-561`);
    assert.ok(c.trim().endsWith("."), "a carried entry does not end in a full stop — it was cut short");
  }
  /* Two of the three carried their ladder rung by rung and must still. */
  const withLadder = carried.filter((c) => /Ladder climbed and failed/.test(c));
  assert.equal(withLadder.length, 2, "the two ladder-bearing entries must keep their ladders");
  for (const c of withLadder) {
    for (const rung of ["photos", "Street View", "drone", "planning docs", "archives"]) {
      assert.ok(c.includes(rung), `a carried entry's ladder lost the ${rung} rung`);
    }
  }
  assert.match(section.superseded["absent.northBlockUntreated"].why, /CHARACTER-FOR-CHARACTER/,
    "the record must claim exactly what it delivers");
  for (const a of ladders) {
    for (const rung of ["photos", "Street View", "drone", "planning docs", "archives"]) {
      assert.ok(a.includes(rung), `a ladder entry skips the ${rung} rung: ${a.slice(0, 60)}`);
    }
  }
});

test("S2: every retirement declares its disposition and states its ground", () => {
  const S = section.superseded;
  assert.match(section.supersededNote, /machine-readable/i);
  for (const [key, rec] of Object.entries(S)) {
    assert.ok(rec.disposition, `superseded[${key}] carries no disposition`);
    assert.ok(rec.claims && rec.claims.length > 20, `superseded[${key}] does not say what it claims`);
    assert.ok(Array.isArray(rec.ships) && rec.ships.length > 0,
      `superseded[${key}] names nothing that ships in its place`);
    assert.match(rec.date, /^\d{4}-\d{2}-\d{2}$/);
  }
  assertDispositions({
    label: "revellecommons",
    items: Object.entries(S).map(([key, rec]) => ({
      key, disposition: rec.disposition, sup: ["revellecommons"], detail: rec.why,
    })),
    reciprocals: {},
  });
  /* The re-clad retirement is by ARGUMENT, not by a new photograph, and the
     record must carry the more useful fact. */
  const rc = S["revelle.absent[4]"];
  assert.ok(rc, "the re-clad premise's retirement is missing");
  assert.match(rc.why, /there is no re-clad|NO SOURCE DESCRIBES A RE-CLAD/i);
  assert.match(rc.why, /six items|closed list of six/i,
    "the successor claim — what 2014 actually added — must be on the record");
});

/* ------------------------------------------- the module, actually running */

test("the module builds the section, and the counts are the declared ones", () => {
  const { group, counts } = build();
  assert.ok(Object.keys(section.counts).length >= 12,
    "the section must declare its counts so the build can be held to them");
  for (const [k, v] of Object.entries(section.counts)) {
    if (k === "note") continue;
    assert.equal(counts[k], v, `count ${k}: built ${counts[k]}, declared ${v}`);
  }
  /* The two declared ZEROES are zeroes, not absences: a missing key would read
     as "this section has no opinion", and it has a strong one. */
  assert.equal(counts.pv, 0, "the PV negative must be a declared zero, not an omission");
  assert.equal(counts.roofObjects, 0, "the roofscape withholding must be a declared zero too");
  /* Every bay of every face carries exactly one thing — no holes. */
  /* EVERY BAY OF EVERY FACE CARRIES EXACTLY ONE PANEL — no holes anywhere.
     The entry bay is the one that could leave one: its lower 2.03 m is two
     door leaves, and the panel that closes it above them is counted in
     glazingPanels, so the three populations still sum to the bay count. */
  const totalBays = section.facades.filter((f) => f.glazed).reduce((n, f) => n + f.bays, 0);
  assert.equal(counts.graphicPanels + counts.signageWallBays + counts.glazingPanels,
    totalBays,
    "a bay is uncovered — every bay must carry a panel, the entry bay included above its leaves");
  assert.equal(counts.mullions, totalBays + section.facades.filter((f) => f.glazed).length,
    "a mullion on every bay boundary of every GLAZED face, both ends included");
  /* AND NOT ONE MULLION, BAY OR TRANSOM REACHES A BLANK FACE. That is the whole
     content of the 64 North glazing withholding, and it is checked against the
     built scene rather than against the module's own branch. */
  assert.equal(counts.blankBands, section.facades.filter((f) => !f.glazed).length,
    "every blank face must carry exactly one precast band run");
  assert.equal(counts.transomRuns,
    section.facades.filter((f) => f.glazed && section.system.transom.blocks.includes(f.block)).length,
    "the transom runs only on glazed faces of the block its height was measured on");
  /* THE COLONNADE FOLLOWS THE DECLARED TABLE, FACE BY FACE. The module used to
     `find` the first run for a face and silently drop any other, so the table
     could stop being honoured without a count moving. The table must cover each
     south face exactly once, and the built population must be the table's own
     sum — checked against the scene, not against the module's arithmetic. */
  const runFaces = section.system.columns.runs.map((r) => r.face);
  assert.equal(new Set(runFaces).size, runFaces.length,
    "two colonnade runs name the same face — the declared table must have one entry per face");
  for (const face of runFaces) {
    assert.ok(section.facades.some((f) => f.id === face), `a colonnade run names no real face: ${face}`);
  }
  assert.equal(counts.columns, section.system.columns.runs.reduce((n, r) => n + r.count, 0),
    "the built colonnade is not the declared table's own sum");
  const { group: g0 } = build();
  g0.updateMatrixWorld(true);
  const perFace = new Map(section.system.columns.runs.map((r) => [r.face, 0]));
  each(g0, (e) => {
    if (e.name !== "revellecommons-column") return;
    /* Attribute each built column to the face whose chord it stands nearest. */
    let best = null;
    for (const r of section.system.columns.runs) {
      const f = section.facades.find((q) => q.id === r.face);
      const len = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]);
      const t = Math.max(0, Math.min(1,
        ((e.x - f.a[0]) * (f.b[0] - f.a[0]) + (e.z - f.a[1]) * (f.b[1] - f.a[1])) / (len * len)));
      const d = Math.hypot(e.x - (f.a[0] + t * (f.b[0] - f.a[0])), e.z - (f.a[1] + t * (f.b[1] - f.a[1])));
      if (!best || d < best.d) best = { face: r.face, d };
    }
    perFace.set(best.face, perFace.get(best.face) + 1);
  });
  for (const r of section.system.columns.runs) {
    assert.equal(perFace.get(r.face), r.count,
      `${r.face} built ${perFace.get(r.face)} columns against a declared ${r.count}`);
  }
  for (const name of ["revellecommons-facades", "revellecommons-ground"]) {
    assert.ok(group.children.find((c) => c.name === name), `no ${name} group`);
  }
  const missing = createPhotoRevellecommons(null, { photo: {}, heightAt: flat, surfaceAt: flat });
  assert.deepEqual(missing.counts, {}, "a missing section builds nothing and breaks nothing");
  assert.throws(() => createPhotoRevellecommons(null, { photo: { revellecommons: section } }), /surfaceAt/,
    "a missing sampler must be loud, not silent");
  /* A PARTIAL merge must be loud too. */
  const preR2 = { ...section };
  delete preR2.court;
  assert.throws(() => createPhotoRevellecommons(null, { photo: { revellecommons: preR2 }, surfaceAt: flat }),
    /R2 merge|half a cluster/i, "a pre-R2 section must fail loudly rather than build half a cluster");
});

test("nothing hovers, nothing sinks, and nothing leaves the declared bounds", () => {
  const B = section.bounds;
  for (const [label, g] of [["flat", flat], ["slope", slope], ["drawn", drawnGround]]) {
    const r = build(g);
    r.group.updateMatrixWorld(true);
    let n = 0;
    let lowestFoot = Infinity;
    each(r.group, (e) => {
      n++;
      assert.ok(e.xLo >= B.x0 && e.xHi <= B.x1 && e.zLo >= B.z0 && e.zHi <= B.z1,
        `${label}: ${e.name} spans (${e.xLo.toFixed(2)}..${e.xHi.toFixed(2)}, ${e.zLo.toFixed(2)}..${e.zHi.toFixed(2)}), outside bounds`);
      /* NOTHING HOVERS. Everything that meets the ground — the plinth, its
         skirt, the columns — must reach at or below the drawn surface under
         its own footprint, on every one of the three surfaces. */
      if (/skirt|plinth|column/.test(e.name)) {
        const ground = g(e.x, e.z);
        assert.ok(e.yLo <= ground + 0.01,
          `${label}: ${e.name} hovers — its foot is ${e.yLo.toFixed(2)} over a surface at ${ground.toFixed(2)}`);
        assert.ok(e.yLo >= ground - 4,
          `${label}: ${e.name} runs away to ${e.yLo.toFixed(2)} under a surface at ${ground.toFixed(2)}`);
        lowestFoot = Math.min(lowestFoot, e.yLo);
      }
    });
    assert.ok(n > 180, `${label}: only ${n} placements walked — the facade loops did not run`);
    assert.ok(Number.isFinite(lowestFoot), `${label}: no seated element was checked`);
  }
  /* And the bounds are not a blank cheque on three sides. */
  const xs = ring.map((p) => p[0]);
  const zs = ring.map((p) => p[1]);
  near(B.x0, Math.min(...xs) - 1, 1e-6, "the west bound must hug the drawn ring");
  near(B.z0, Math.min(...zs) - 1, 1e-6, "the north bound must hug the drawn ring");
  near(B.z1, Math.max(...zs) + 1, 1e-6, "the south bound must hug the drawn ring");
  /* The EAST bound is the ownership claim, and it meets blake's exactly. */
  assert.equal(B.x1, -58.7, "the east bound is the declared boundary, not the ring's");
  assert.match(section.boundary.claim, /-58\.7/);
  assert.match(section.boundary.fromBlakeSide, /blake\.bounds\.x0/);
  assert.match(section.boundary.fromBlakeSide, /blake\.absent\[2\]/,
    "the claim must state that blake's own west-face withholding stands untouched");
});

test("nothing stands above the drawn prism, and the residue above the treatment is the declared one", () => {
  const F = section.derivations.figures;
  for (const [label, g] of [["flat", flat], ["slope", slope], ["drawn", drawnGround]]) {
    const r = build(g);
    r.group.updateMatrixWorld(true);
    const lid = roofElevation(section.measured.ring, section.derivations.readings.survey.massHeight, g);
    let top = -Infinity;
    each(r.group, (e) => {
      assert.ok(e.yHi <= lid + 1e-6,
        `${label}: ${e.name} tops out ${(e.yHi - lid).toFixed(3)} m above the drawn prism's own lid`);
      top = Math.max(top, e.yHi);
    });
    /* THE RESIDUE IS REAL AND IT IS THE DECLARED SIZE. On flat ground the
       treatment's top is exactly one stack above the datum, so the bare band
       is residue.degreesTreated — the number the section publishes. */
    if (label === "flat") {
      near(lid - top, F["residue.degreesTreated"].value, 0.01,
        "the bare band left above the treatment is not the residue the section declares");
    }
    assert.ok(lid - top > 1.0,
      `${label}: only ${(lid - top).toFixed(2)} m of undressed mass — if the treatment now reaches the lid, the height decision changed`);
  }
});

test("the court floor IS the drawn surface, tessellated, on its declared rung", () => {
  for (const [label, g] of [["flat", flat], ["slope", slope], ["drawn", drawnGround]]) {
    const r = build(g);
    const floor = r.group.children.find((c) => c.name === "revellecommons-ground")
      .children.find((c) => c.name === "revellecommons-court-floor");
    assert.ok(floor, `${label}: no court floor — the extruder's void has no bottom again`);
    const lift = overlayLift(section.draw.courtRung);
    const pos = floor.geometry.getAttribute("position");
    let n = 0;
    for (let i = 0; i < pos.count; i++) {
      near(pos.getY(i), g(pos.getX(i), pos.getZ(i)) + lift, 1e-4,
        `${label}: court floor vertex ${i} is not on the drawn surface plus its rung`);
      n++;
    }
    assert.ok(n > 20, `${label}: the court floor is not tessellated (${n} vertices)`);
  }
  assert.match(moduleSrc, /overlayLift\(D\.courtRung\)/,
    "the court's seating rung must come from the section, not from a number of its own");
});

/* THE GALBRAITH-BEDS GATE. round1-critic.md A1: galbraith.north.apron paved
 * 199 m2 of three surveyed green rings. This section declines the whole south
 * terrace rather than risk it, and this gate holds that decision against a
 * later "small" addition: every placement is walked against EVERY arcgis.ground
 * ring whose centroid falls inside the declared bounds. */
test("no placement stands on a surveyed ground ring", () => {
  const inRing = (x, z, r) => {
    let ins = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, zi] = r[i];
      const [xj, zj] = r[j];
      if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
    }
    return ins;
  };
  const B = section.bounds;
  const local = [];
  /* arcgis.ground is addressed by LITERAL INDEX and dropped slots are null, so
     the walk guards for the hole and never renumbers. The kind field is `k`. */
  arcgis.ground.forEach((gr, i) => {
    if (!gr || !gr.r || !gr.r[0]) return;
    const r = gr.r[0].map(([x, z]) => [x / 10, z / 10]);
    const cx = r.reduce((s, p) => s + p[0], 0) / r.length;
    const cz = r.reduce((s, p) => s + p[1], 0) / r.length;
    if (cx >= B.x0 && cx <= B.x1 && cz >= B.z0 && cz <= B.z1) local.push({ i, r, kind: gr.k });
  });
  assert.ok(local.length >= 8,
    `only ${local.length} surveyed ground rings found inside the bounds — this gate is not testing anything`);
  /* The two the gate exists for: #237 is the green bed 1.4 m south of the
     64 Degrees south wall — the near-miss that decided the terrace withholding
     — and #3267 is the court floor, the one ring anything is laid on. */
  assert.ok(local.some((g) => g.i === 237 && g.kind === "green"),
    "arcgis.ground#237, the bed the terrace would have paved, is not being walked");
  assert.ok(local.some((g) => g.i === 3267 && g.kind === "walk"),
    "arcgis.ground#3267, the court floor, is not being walked");
  /* WHAT THIS GATE IS AND IS NOT ABOUT. Several of these beds are surveyed
     right up to the building line — #2152's ring reaches z 344.7, which IS the
     64 Degrees north wall — so a facade plane standing draw.wallOffset proud of
     its own wall is unavoidably "inside" one. That is a wall, not paving, and
     failing it would make the gate unpassable by any correct build. The rule is
     therefore about GROUND COVER: anything standing further from the drawn ring
     than the widest offset the section declares is out in the landscape, and
     out in the landscape nothing may sit on a surveyed ring. */
  const edgeDistance = (x, z, ring2) => {
    let best = Infinity;
    for (let i = 0; i < ring2.length - 1; i++) {
      const [ax, az] = ring2[i];
      const [bx, bz] = ring2[i + 1];
      const dx = bx - ax;
      const dz = bz - az;
      const l2 = dx * dx + dz * dz;
      const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0;
      best = Math.min(best, Math.hypot(x - (ax + t * dx), z - (az + t * dz)));
    }
    return best;
  };
  /* The allowance is DERIVED, not chosen. A column stands columnProud +
     columnJitter off its face's declared CHORD, but this walk measures distance
     to the ring POLYLINE, and three of the four faces span collinear
     intermediate vertices that sit a little off their own chord. That gap is
     measured here from the ring itself and added, so the allowance tightens
     automatically if the ring is ever straightened and cannot be padded by
     hand. It is checked against the 0.10 m the collinearity gate permits. */
  let chordGap = 0;
  for (const f of section.facades) {
    /* The drawn ring is CLOSED — its first vertex is repeated as its last — so a
       face ending on that vertex must match the LATER occurrence or the walk
       runs backwards round the whole building. 64 North's east face ends
       exactly there and did. */
    const [ia, ib] = ringSpan(f);
    const len = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]);
    for (let i = Math.min(ia, ib) + 1; i < Math.max(ia, ib); i++) {
      const [x, z] = ring[i];
      const t = ((x - f.a[0]) * (f.b[0] - f.a[0]) + (z - f.a[1]) * (f.b[1] - f.a[1])) / (len * len);
      chordGap = Math.max(chordGap, Math.hypot(x - (f.a[0] + t * (f.b[0] - f.a[0])),
        z - (f.a[1] + t * (f.b[1] - f.a[1]))));
    }
  }
  assert.ok(chordGap <= 0.10,
    `the declared chords now depart from the ring by ${chordGap.toFixed(3)} m — the facade gate's own collinearity limit`);
  const maxProud = section.draw.columnProud + section.draw.columnJitter + chordGap;
  const r = build(drawnGround);
  r.group.updateMatrixWorld(true);
  let checked = 0;
  let inLandscape = 0;
  let onCourt = 0;
  each(r.group, (e) => {
    checked++;
    /* An element that FLIES does not stand on anything. The canopy projects
       3.5 m out over the terrace and its lowest point is 4.16 m up; overhanging
       a planting bed is what a canopy does, and it is not paving it. The bar is
       the sourced door head, the lowest thing in this section with a headroom
       meaning. */
    const doorHead = section.system.entry.heightIn * section.derivations.units.inch;
    const flies = e.yLo >= drawnGround(e.x, e.z) + doorHead;
    const onBuilding = flies
      || inRing(e.x, e.z, ring) || edgeDistance(e.x, e.z, ring) <= maxProud + 1e-6;
    if (inRing(e.x, e.z, courtRing) && e.name === "revellecommons-court-floor") onCourt++;
    if (onBuilding) return;
    inLandscape++;
    for (const g of local) {
      assert.ok(!inRing(e.x, e.z, g.r),
        `${e.name} at (${e.x.toFixed(1)}, ${e.z.toFixed(1)}) stands out in the landscape ON surveyed arcgis.ground#${g.i} (${g.kind}) — this is round1-critic A1 happening again`);
    }
  });
  assert.ok(checked > 180, "the walk did not run");
  assert.equal(inLandscape, 0,
    `${inLandscape} placements stand out in the landscape — this section builds no landscape at all and absent['south-terrace-landscape'] says why`);
  assert.ok(onCourt > 0, "the court floor is not on the courtyard ring it declares it paves");
  /* And the court floor really is on #3267, which is the one surveyed ring
     anything here is laid on and the one that types the court as PAVED. */
  const floor = local.find((g) => g.i === 3267);
  const cx = (section.court.x0 + section.court.x1) / 2;
  const cz = (section.court.z0 + section.court.z1) / 2;
  assert.ok(inRing(cx, cz, floor.r),
    "the court's own centre is not inside arcgis.ground#3267 — the section cites that ring as its authority for paving it");
  /* And the five south-frontage beds are handed forward BY NAME. */
  for (const b of ["#513", "#511", "#415", "#1762", "#2696"]) {
    assert.ok(section.boundary.handedForward.includes(b),
      `the south-frontage bed ${b} is not handed forward by name`);
  }
});

/* THE WITHHOLDINGS ARE REAL IN THE SCENE, not only in the prose. */
test("no roof object, no landscape object and no lettering reaches the built scene", () => {
  const r = build(drawnGround);
  const names = new Set();
  r.group.traverse((o) => { if (o.isMesh) names.add(o.name); });
  /* The canopy and the fascia sign are BUILDING-mounted and were ruled outside
     the withheld terrace landscape at visual audit, so they are not in this
     list. Everything that stands on the GROUND still is. */
  for (const forbidden of [/roof/i, /membrane/i, /vent/i, /curb/i, /skylight/i, /duct/i,
    /terrace/i, /paver/i, /umbrella/i, /lounger/i, /bioswale/i, /boardwalk/i, /bridge/i,
    /seat-?wall/i, /tree/i, /planter/i, /letter/i, /text/i, /pv|panel-array/i]) {
    for (const nm of names) {
      assert.ok(!forbidden.test(nm),
        `a mesh named "${nm}" matches ${forbidden} — this section withholds the roofscape, the landscape and all lettering`);
    }
  }
  /* The court floor is the ONE piece of ground, and it is inside the well. */
  const groundGroup = r.group.children.find((c) => c.name === "revellecommons-ground");
  assert.equal(groundGroup.children.length, 1,
    "the court floor is the only ground this section ships");
});

/* ===================== THE AUDIT'S THREE MAJORS, GATED ==================== *
 *
 * Each of the three gates below is written against a specific mutation that
 * passed a green 26-test suite. They are geometric or arithmetic, never lexical,
 * because all three defects were of one family: the section withheld a fact in
 * prose and shipped a definite answer to it in geometry, with nothing between.
 */

test("AUDIT M1: the station group's geometry is the declared rule's, bay by bay", () => {
  const F = section.derivations.figures;
  const G = section.system.graphic;
  const W = section.system.signageWall;
  const face = section.facades.find((f) => f.id === G.face);
  /* (1) The centring rule is ARITHMETIC and is evaluated. It shipped as prose,
     which let audit mutation B2 move the whole group 3 bays — 4.6 m — behind a
     differently-worded rule with every gate passing. */
  assert.ok(F["graphic.firstBay"].expr, "the centring rule must be an evaluated expr, not prose");
  assert.equal(F["graphic.firstBay"].value, Math.floor((face.bays - section.derivations.readings.px.panelCount) / 2),
    "the shipped first bay is not the centring rule's output");
  /* (2) The band is the RULE'S OWN FREEDOM, not the feasible range. Centring 11
     bays in 22 cannot be exact, so the graphic's centre must land within half a
     bay of the face's centre — and nothing wider may be claimed. */
  const est = section.estimates["system.graphic.centreOffsetBays"];
  assert.deepEqual(est.band, [-0.5, 0.5], "the station band is not the centring rule's own freedom");
  assert.match(est.bandWhy, /NARROWED AT AUDIT/);
  assert.equal(section.estimates["system.graphic.firstBay"], undefined,
    "the old unbounded [0, 11] estimate must be gone, not merely supplemented");
  /* (3) THE BUILT SCENE carries the declared bays and no others. Each kind's
     along-face station is recomputed here from the face's own geometry, so a
     station moved anywhere in the data or the module lands somewhere this
     assertion does not expect. */
  const { group } = build();
  group.updateMatrixWorld(true);
  const len = Math.hypot(face.b[0] - face.a[0], face.b[1] - face.a[1]);
  const tx = (face.b[0] - face.a[0]) / len;
  const tz = (face.b[1] - face.a[1]) / len;
  const uOf = (e) => ((e.x - face.a[0]) * tx + (e.z - face.a[1]) * tz) / (len / face.bays);
  const seen = { "revellecommons-graphic-panel": [], "revellecommons-signage-wall": [], "revellecommons-entry-glass": [] };
  each(group, (e) => { if (seen[e.name]) seen[e.name].push(uOf(e)); });
  const bayIndex = (u) => Math.floor(u);
  const gBays = seen["revellecommons-graphic-panel"].map(bayIndex).sort((a, b) => a - b);
  assert.deepEqual(gBays, Array.from({ length: G.bays }, (_, i) => G.firstBay + i),
    "the built graphic does not occupy the bays the centring rule declares");
  const wBays = [...new Set(seen["revellecommons-signage-wall"].map(bayIndex))].sort((a, b) => a - b);
  assert.deepEqual(wBays, Array.from({ length: W.bays }, (_, i) => F["signageWall.firstBay"].value + i),
    "the built signage wall does not occupy the bays the section declares");
  for (const u of seen["revellecommons-entry-glass"]) {
    assert.equal(bayIndex(u), F["entry.bay"].value, "an entry leaf is outside the declared entry bay");
  }
});

test("AUDIT M2: the sign/entry group is NORTH of the graphic, in world coordinates", () => {
  const F = section.derivations.figures;
  const G = section.system.graphic;
  /* The arithmetic relation first: the group follows the graphic, it does not
     precede it. Audit mutation F4 mirrored the whole group and rewrote both
     exprs to stay valid, so the ORDER must be asserted and not just the sums. */
  assert.equal(F["signageWall.firstBay"].value, G.firstBay + G.bays,
    "the signage wall no longer begins where the graphic ends");
  assert.equal(F["entry.bay"].value, G.firstBay + G.bays + section.system.signageWall.bays,
    "the entry is no longer the bay past the signage wall");
  /* AND THE COMPASS HAND ITSELF, measured on the built scene. North is -z, so
     every piece of the group must sit north of every graphic panel. A mirrored
     build satisfies every arithmetic relation above and fails here. */
  const { group } = build();
  group.updateMatrixWorld(true);
  const zOf = { graphic: [], group: [] };
  each(group, (e) => {
    if (e.name === "revellecommons-graphic-panel") zOf.graphic.push(e.z);
    if (e.name === "revellecommons-signage-wall" || e.name === "revellecommons-entry-glass"
      || e.name === "revellecommons-sign") zOf.group.push(e.z);
  });
  assert.ok(zOf.graphic.length === G.bays && zOf.group.length > 0, "the station group did not build");
  assert.ok(Math.max(...zOf.group) < Math.min(...zOf.graphic),
    `the sign/entry group sits SOUTH of the graphic (group z up to ${Math.max(...zOf.group).toFixed(1)}, graphic from ${Math.min(...zOf.graphic).toFixed(1)}). `
    + "Two independent photographic reads put it NORTH — see conflicts['sign-and-doors-hand'] — and the section's own override was reversed at audit.");
  /* The reversal is on the record, and the conflict now RESOLVES rather than
     declaring the hand withheld while shipping a definite one. */
  const c = section.conflicts.find((q) => q.key === "sign-and-doors-hand");
  assert.match(c.resolution, /RESOLVED FOR THE NORTH END/);
  assert.match(c.sides.join(" "), /SOUTH-EAST CORNER/, "the corner frame that decided it must be cited");
  assert.ok(section.superseded["build.compassHand"], "the override reversal must be a superseded record");
  assert.match(section.absent.find((a) => /^THE GRAPHIC'S STATION/.test(a)), /NARROWED AT AUDIT/,
    "the absent entry must stop withholding the hand it no longer withholds");
  /* AND NO PROSE ANYWHERE STILL ASSERTS THE OLD HAND. The reversal left three
     sites reading "immediately south of the graphic" and one still claiming
     §5.1 is contradicted by the elevation frame — a retracted assertion that
     survived because nothing gated the prose against the geometry. */
  const prose = [
    ["system.signageWall.note", section.system.signageWall.note],
    ["system.entry.note", section.system.entry.note],
    ["module bayKind", moduleSrc.slice(moduleSrc.indexOf("function bayKind") - 900, moduleSrc.indexOf("function bayKind"))],
  ];
  for (const [where, text] of prose) {
    /* A note may QUOTE the wording it replaces — that is how this project keeps
       a retirement legible (blake's colorNote does the same) — so retired
       wording is delimited with << >> and stripped here, and the test runs on
       what the note ASSERTS in its own voice. Single quotes are NOT usable as
       the delimiter in this document: "Section 5.1's" and "Studio E's" carry
       apostrophes and would open spans that swallow the assertion itself. */
    const asserted = text.replace(/<<[\s\S]*?>>/g, "<<retired>>");
    assert.ok(!/immediately south of the (graphic|signage wall)/i.test(asserted),
      `${where} still places the station group SOUTH of the graphic in its own voice`);
    assert.ok(!/is contradicted by that frame/i.test(asserted),
      `${where} still asserts research §5.1 is contradicted — that claim was RETRACTED at audit`);
    /* And the quoted form is only allowed where the correction is declared. */
    if (/immediately south of the/i.test(text) || /is contradicted by that frame/i.test(text)) {
      assert.match(text, /CORRECTED AT AUDIT/,
        `${where} quotes the old south-hand wording without saying it was corrected`);
    }
  }
  assert.match(section.system.signageWall.note, /NORTH of the graphic/i);
  assert.match(section.system.entry.note, /RETRACTED/,
    "the entry note must record the retraction, not merely drop the claim");
});

test("AUDIT M3: the residue gate runs on the BUILT scene, PER TREATED BLOCK", () => {
  const F = section.derivations.figures;
  const B = section.system.bands;
  const S = section.derivations.readings.survey;
  /* Audit mutation H changed ONE line of the module — `B.glazing[f.block]` to
     `B.glazing.degrees` — so every block built with the 64 Degrees band and the
     Commons derivation was ignored entirely. All 26 tests passed, because the
     residue gate only ever measured the 64 Degrees block. It now measures every
     treated block against that block's own declared stack. */
  const expected = {
    degrees: B.plinth + B.glazing.degrees + B.soffit + B.parapet,
    commons: B.plinth + B.glazing.commons + B.soffit + B.parapet,
    north: B.plinth + B.blank.north + B.soffit + B.parapet,
  };
  near(expected.degrees, F["stack.degrees"].value, 1e-6, "the 64 Degrees stack");
  near(expected.commons, S.lidarCommons, 1e-6, "the Commons stack must close on its own LiDAR height");
  near(expected.north, S.lidarNorth, 1e-6, "the north stack must close on its own LiDAR height");

  for (const [label, g] of [["flat", flat], ["slope", slope], ["drawn", drawnGround]]) {
    const r = build(g);
    r.group.updateMatrixWorld(true);
    /* Attribute every placement to the block whose face chord it stands
       nearest, then take that block's own maximum top. */
    const tops = {};
    const bases = {};
    /* A corner belongs to two faces at once, so an element sitting on a shared
       ring vertex cannot be attributed to one block — the same corner condition
       VISUAL 1 exempts. Skipped here rather than mis-attributed, which is what
       put a 6.95 m 64 Degrees column on the 5.0 m north block's tally. */
    const atVertex = (x, z) => ring.some(([vx, vz]) =>
      Math.hypot(x - vx, z - vz) <= section.system.mullion.width);
    each(r.group, (e) => {
      if (e.name === "revellecommons-court-floor") return;
      if (atVertex(e.x, e.z)) return;
      let best = null;
      for (const f of section.facades) {
        const len = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]);
        const t = Math.max(0, Math.min(1,
          ((e.x - f.a[0]) * (f.b[0] - f.a[0]) + (e.z - f.a[1]) * (f.b[1] - f.a[1])) / (len * len)));
        const dist = Math.hypot(e.x - (f.a[0] + t * (f.b[0] - f.a[0])),
          e.z - (f.a[1] + t * (f.b[1] - f.a[1])));
        if (!best || dist < best.dist) best = { block: f.block, dist };
      }
      tops[best.block] = Math.max(tops[best.block] ?? -Infinity, e.yHi);
      bases[best.block] = Math.min(bases[best.block] ?? Infinity, e.yLo);
    });
    for (const block of Object.keys(expected)) {
      assert.ok(tops[block] !== undefined, `${label}: the ${block} block built nothing`);
      /* The block's treatment top is its own datum plus its OWN stack. The
         datum is recovered from the skirt's foot, which is the datum less the
         declared skirt depth, so this never re-uses the module's arithmetic. */
      const datum = bases[block] + section.draw.skirtDepth;
      near(tops[block] - datum, expected[block], 0.02,
        `${label}: the ${block} block's treatment is ${(tops[block] - datum).toFixed(3)} m tall against its own declared ${expected[block].toFixed(3)} m. `
        + "A block built with another block's band is exactly what audit finding 3 caught, and it stands above the LiDAR plane it is supposed to close on.");
      /* And it closes on the block's own LiDAR height, not on another's. */
      const lidar = { degrees: S.lidarDegrees, commons: S.lidarCommons, north: S.lidarNorth }[block];
      assert.ok(tops[block] - datum <= lidar + 1e-6,
        `${label}: the ${block} block's treatment stands ${(tops[block] - datum - lidar).toFixed(3)} m above its own LiDAR roof plane`);
    }
  }
});

/* RE-AUDIT FINDING 1. Minor 4 moved the tier gate from lexical to arithmetic,
   which was right — but the arithmetic ran on `sampleL`/`sampleSd`, which the
   section declares ABOUT ITSELF, so the same attack landed one level down: a
   mutation promoted `soffit` to [measured] by moving its own sampleL from 89.5
   to 131.4 and all 31 tests passed. A threshold is worthless if the value it
   judges is supplied by the thing being judged. Both operands are pinned here,
   as literals, exactly the way the section's 65 readings are — and so are the
   four control samples the 120 threshold is justified by. */
const SAMPLE_PINS = {
  parapetBand:     { L: 125.5, sd: 6.8 },
  column:          { L: 173.9, sd: 14.5 },
  courtPaving:     { L: 154.9, sd: 6.3 },
  soffit:          { L: 89.5, sd: 5.1 },
  storefrontGlass: { L: 28.5, sd: 14.3 },
  mullion:         { L: 38.2, sd: 17.2 },
  signYellow:      { L: 157.1, sd: 34.5 },
  graphicPanel:    { L: 107.8, sd: 44.3 },
  canopyFabric:    { L: 65.4, sd: 9.9 },
  plinth:          { L: 73.6, sd: 14.7 },
  signageWall:     { L: 73.6, sd: 14.7 },
};
const CONTROL_PINS = {
  sunlitPavingF16:   { L: 154.9, px: 11228, rect: [350, 863, 750, 890] },
  sunlitPavingElev:  { L: 190.7, px: 18446, rect: [600, 715, 1000, 760] },
  shadedParapetElev: { L: 71.2, px: 53276, rect: [300, 45, 1000, 120] },
  shadedPlinthElev:  { L: 84.1, px: 15621, rect: [600, 645, 980, 685] },
};

test("ROUND-2 VISUAL: every colour role the module asks for is declared, both ways", () => {
  /* THE DEFECT THIS EXISTS FOR. The module referenced `colors.canopyFabric`,
     the section never carried that role, and campus-materials.js destructures
     `color = 0xffffff` — so the missing role did not throw, did not warn, and
     shipped an OPAQUE WHITE canopy sail. Every gate passed: the tier gate walks
     the roles the section DECLARES, the hex-literal gate proves the module holds
     none of its own, and nothing compared the two lists.

     The two lists are compared here, in BOTH directions. A referenced-but-
     undeclared role is the white-sail bug; a declared-but-unreferenced role is a
     colour nobody can see, which is how a stale hex outlives its object. */
  const referenced = new Set(
    [...moduleSrc.matchAll(/hue\("([A-Za-z]+)"\)/g)].map((m) => m[1]),
  );
  assert.ok(referenced.size >= 10,
    `only ${referenced.size} colour roles found in the module — the walk did not run`);
  const declared = new Set(Object.keys(section.colors));
  for (const role of referenced) {
    assert.ok(declared.has(role),
      `the module asks for colour role "${role}" and the section does not declare it. `
      + "campus-materials.js defaults an unset colour to 0xffffff, so this ships as opaque white rather than failing.");
  }
  for (const role of declared) {
    assert.ok(referenced.has(role),
      `the section declares colour role "${role}" and nothing in the module uses it — a hex with no consumer`);
  }
  /* AND THE MODULE MUST NOT BE ABLE TO REACH THE DEFAULT AT ALL. Every colour
     goes through a helper that throws, so this holds at runtime and not only
     under a test that greps source. */
  assert.match(moduleSrc, /const hue = \(role\)/,
    "colours must be routed through a guard, not read off the object directly");
  assert.ok(!/colors\.[A-Za-z]/.test(moduleSrc.replace(/const v = colors\[role\];/, "")),
    "a colour is being read off `colors` directly, bypassing the guard that makes a missing role loud");
  const bare = { ...section, colors: { ...section.colors } };
  delete bare.colors.canopyFabric;
  assert.throws(() => createPhotoRevellecommons(null, { photo: { revellecommons: bare }, surfaceAt: flat }),
    /no colour declared for role "canopyFabric"/,
    "a missing colour role must be a hard error — silently white is what shipped");
});

test("RE-AUDIT 1: the tier gate's own operands are pinned, not self-declared", () => {
  const entries = Object.entries(section.colorSources);
  assert.equal(entries.length, Object.keys(SAMPLE_PINS).length,
    "a colour role was added or removed and this suite does not pin its sample");
  for (const [k, p] of entries) {
    const pin = SAMPLE_PINS[k];
    assert.ok(pin, `${k} carries a sample this suite does not pin — the tier gate would run on an unpinned operand`);
    /* 0.05 is the re-cut floor, not a modelling tolerance: an independent
       re-cut of these same rectangles reproduces every channel mean to <= 1.4
       and every sd to <= 0.9, and the pins are this build's own figures. */
    near(p.sampleL, pin.L, 0.05, `${k}'s sample channel mean has moved off its pin`);
    near(p.sampleSd, pin.sd, 0.05, `${k}'s sample standard deviation has moved off its pin`);
  }
  /* AND THE THRESHOLD'S OWN JUSTIFICATION IS PINNED TOO, with the rectangles
     it was measured from, so the bar cannot be lowered by re-describing the
     evidence for it. */
  const T = section.colorThreshold;
  assert.ok(T, "the tier threshold must be declared as data, not buried in prose");
  assert.equal(T.sunlitMin, 120, "the sunlit threshold has moved");
  assert.equal(T.sdMax, 15, "the single-material threshold has moved");
  assert.equal(T.statistic, "channelMean");
  assert.match(T.statisticNote, /\(R \+ G \+ B\) \/ 3/, "the statistic must be defined, not named");
  assert.match(T.statisticNote, /Rec\.601|luma/i, "and it must say what it is NOT, since a luma gives different figures");
  assert.equal(T.controls.length, 4, "all four controls behind the threshold must be declared");
  for (const c of T.controls) {
    const pin = CONTROL_PINS[c.key];
    assert.ok(pin, `control ${c.key} is not pinned in this suite`);
    near(c.L, pin.L, 0.05, `control ${c.key} has moved off its pin`);
    assert.equal(c.px, pin.px, `control ${c.key}'s pixel count has moved`);
    assert.deepEqual(c.rect, pin.rect, `control ${c.key}'s sample rectangle has moved`);
    assert.ok(c.frame && /\.jpg$/.test(c.frame), `control ${c.key} names no frame`);
    assert.ok(c.what && c.what.length > 60, `control ${c.key} does not say what it is a control for`);
  }
  /* The threshold really does separate the two control populations, computed
     here from the pins rather than read out of the note. */
  const sunlit = T.controls.filter((c) => /^sunlit/.test(c.key)).map((c) => c.L);
  const shaded = T.controls.filter((c) => /^shaded/.test(c.key)).map((c) => c.L);
  assert.equal(sunlit.length, 2);
  assert.equal(shaded.length, 2);
  assert.ok(Math.max(...shaded) < T.sunlitMin && T.sunlitMin < Math.min(...sunlit),
    `the ${T.sunlitMin} threshold does not sit between its own controls (shaded up to ${Math.max(...shaded)}, sunlit from ${Math.min(...sunlit)})`);
  assert.ok(Math.min(...sunlit) - Math.max(...shaded) > 60,
    "the two control populations are no longer cleanly separated — the threshold must be re-argued");
});

test("AUDIT minor 4: the colour tier gate is ARITHMETIC, not lexical", () => {
  /* Audit mutation C promoted `soffit` from [sourced] to [measured] and rewrote
     its source string to drop the hedge and claim it is sunlit. All 26 tests
     passed, because the gate only ever read prose. The rule is numeric now and
     every line carries the two numbers it is judged on. */
  assert.match(section.colorSourcesNote, /sampleL/);
  assert.match(section.colorThreshold.note, /measured, not chosen/i,
    "the threshold must be justified by measurement, not asserted");
  assert.match(section.colorSourcesNote, /CHANNEL MEAN/,
    "the statistic must be named where the samples are described");
  assert.ok(!/luminance/i.test(section.colorSourcesNote),
    "'luminance' is ambiguous between a channel mean and a weighted luma — name the statistic");
  const LIT = section.colorThreshold.sunlitMin;
  const SD = section.colorThreshold.sdMax;
  for (const [k, p] of Object.entries(section.colorSources)) {
    assert.equal(typeof p.sampleL, "number", `${k} records no sample luminance — 'sunlit' is an adjective, not a gate`);
    assert.equal(typeof p.sampleSd, "number", `${k} records no sample standard deviation`);
    /* The tier rule, BOTH WAYS. */
    if (p.tier === "measured") {
      assert.ok(p.sampleL >= LIT,
        `${k} claims [measured] at sample luminance ${p.sampleL} — below ${LIT} the sample is in shade, and shadow is not a material`);
      assert.ok(p.sampleSd <= SD,
        `${k} claims [measured] at sd ${p.sampleSd} — above ${SD} the rectangle holds more than one material`);
    } else if (p.tier === "sourced") {
      assert.ok(p.sampleL < LIT || p.sampleSd > SD,
        `${k} is tiered [sourced] but its own numbers (L ${p.sampleL}, sd ${p.sampleSd}) meet the [measured] bar — a tier may not be deflated either`);
    }
    /* The declared sd must be the one the prose already carried, so the two
       halves of the record cannot drift apart. */
    const inProse = /sd (\d+(?:\.\d+)?)/.exec(p.source);
    if (inProse) {
      near(Number(inProse[1]), p.sampleSd, 0.05, `${k}: the sd in the prose and the sd in the field disagree`);
    }
  }
  /* And the threshold really separates the two populations it was measured
     from — sunlit samples above it, shaded ones below, with no straddling. */
  const lit = Object.values(section.colorSources).filter((p) => p.tier === "measured").map((p) => p.sampleL);
  assert.ok(Math.min(...lit) >= LIT, "a [measured] sample is below the sunlit threshold");
});

test("AUDIT minor 5: a band cannot be widened to admit a bigger value", () => {
  /* Audit mutation E inflated the column diameter 31% by widening its own band
     and rewriting both `why` and `bandWhy`. A band authored beside the value it
     bounds is self-referential; the endpoints are pinned here to the published
     range they claim to be, so widening the band fails in the test file. */
  const e = section.estimates["system.columns.diameter"];
  assert.deepEqual(e.band, [0.6, 0.7],
    "the column diameter band is not research §5.2's published 0.6-0.7 m read — a band may not be widened to admit its own value");
  assert.match(e.bandWhy, /verbatim/i, "and it must say the band is the published read taken verbatim");
  assert.deepEqual(section.estimates["system.columns.spacingBays"].band, [3, 6],
    "the colonnade spacing band has moved off the two-columns-and-no-third read it is written against");
  assert.deepEqual(section.estimates["facade.moduleExtension"].band, [1.53, 1.58],
    "the module band is not the east face's own measured panel-pitch scatter");
  /* THE PROSE RELATION THE AUDIT FOUND UNASSERTED. draw.columnProudNote states
     the offset is set just past half the diameter; mutation E broke it and
     nothing noticed. */
  assert.match(section.draw.columnProudNote, /half/i);
  assert.ok(section.draw.columnProud > section.system.columns.diameter / 2,
    `draw.columnProud (${section.draw.columnProud}) must clear half the column diameter (${section.system.columns.diameter / 2}), which is what its own note claims`);
  assert.ok(section.draw.columnProud < section.system.columns.diameter,
    "and it must not stand the columns a whole diameter off the wall");
});

/* ==================== THE VISUAL AUDIT'S THREE MAJORS ==================== */

test("VISUAL 1: no treatment element is buried inside the drawn ring", () => {
  /* THE DEFECT THIS IS WRITTEN AGAINST. A face is declared as ONE chord between
     two ring vertices, but three of the seven span collinear INTERMEDIATE
     vertices — and "collinear" is only collinear to a tolerance. commonsSouth's
     ring stands 0.0795 m outboard of its own chord at (-110.2, 396), which is
     MORE than the 0.06 m the bands were drawn proud of it, so along that stretch
     the soffit, the parapet, the plinth and the glazing were all inside solid
     mass and simply gone. The render showed the band running present / absent /
     present with the 0.10 m mullions and 0.55 m columns surviving over it, which
     is exactly the depth ordering that diagnoses it.

     The collinearity gate allowed 0.10 m and the draw offset was 0.06 m; the two
     numbers were never related to each other. They are now. */
  const inRing = (x, z) => {
    let ins = false;
    for (let i = 0, j = ring.length - 2; i < ring.length - 1; j = i++) {
      const [xi, zi] = ring[i];
      const [xj, zj] = ring[j];
      if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
    }
    return ins;
  };
  const edgeDist = (x, z) => {
    let best = Infinity;
    for (let i = 0; i < ring.length - 1; i++) {
      const [ax, az] = ring[i];
      const [bx, bz] = ring[i + 1];
      const dx = bx - ax;
      const dz = bz - az;
      const l2 = dx * dx + dz * dz;
      const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0;
      best = Math.min(best, Math.hypot(x - (ax + t * dx), z - (az + t * dz)));
    }
    return best;
  };
  /* A CORNER is its own condition and is exempted tightly: an element whose
     centre sits within one mullion width of a ring VERTEX is turning the corner,
     and a storefront frame that stops at a corner is what a corner looks like.
     The exemption is one mullion wide so it cannot cover a run. */
  const nearVertex = (x, z) =>
    ring.some(([vx, vz]) => Math.hypot(x - vx, z - vz) <= section.system.mullion.width);

  for (const [label, g] of [["flat", flat], ["drawn", drawnGround]]) {
    const r = build(g);
    r.group.updateMatrixWorld(true);
    let checked = 0;
    let corners = 0;
    each(r.group, (e) => {
      if (e.name === "revellecommons-court-floor") return;
      if (nearVertex(e.x, e.z)) { corners++; return; }
      const clear = (inRing(e.x, e.z) ? -1 : 1) * edgeDist(e.x, e.z);
      assert.ok(clear >= 0,
        `${label}: ${e.name} at (${e.x.toFixed(1)}, ${e.z.toFixed(1)}) is ${(-clear).toFixed(4)} m INSIDE the drawn ring and will not render. `
        + "The face's declared chord and the ring it is cut from differ by more than the element's clearance — see faceBulge().");
      checked++;
    });
    assert.ok(checked > 180, `${label}: only ${checked} placements checked`);
    /* Two end mullions per glazed face, plus an end column where a colonnade
       run reaches a corner. Anything beyond that is a run, not a corner. */
    const cap = 2 * section.facades.filter((f) => f.glazed).length
      + section.system.columns.runs.length;
    assert.ok(corners <= cap,
      `${label}: ${corners} placements were exempted as corners against a cap of ${cap} — that is a run, not a corner`);
  }
  /* AND THE CLEARANCE IS DERIVED FROM THE RING, NOT TYPED. Every face's own
     bulge must be covered by the base offset, so a future ring edit that bows a
     face further fails here rather than in a render six steps later. */
  for (const f of section.facades) {
    const [ia, ib] = ringSpan(f);
    const len = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]);
    let nx = (f.b[1] - f.a[1]) / len;
    let nz = -(f.b[0] - f.a[0]) / len;
    if (nx * f.out[0] + nz * f.out[1] < 0) { nx = -nx; nz = -nz; }
    let bulge = 0;
    for (let i = Math.min(ia, ib) + 1; i < Math.max(ia, ib); i++) {
      bulge = Math.max(bulge, (ring[i][0] - f.a[0]) * nx + (ring[i][1] - f.a[1]) * nz);
    }
    assert.ok(bulge <= 0.10, `${f.id}: the ring now bows ${bulge.toFixed(3)} m off its chord`);
  }
});

test("VISUAL 2: the south fascia carries the wordmark, as blank geometry", () => {
  const FS = section.system.fasciaSign;
  assert.equal(FS.built, true, "the south wordmark must ship — it is the most identifiable thing on the elevation");
  assert.equal(FS.lettersBuilt, false, "and it must still be BLANK: there is no text mechanism and none is invented");
  assert.equal(FS.face, "dgSouth");
  /* It is the SAME wordmark at the SAME size as the east sign, which is the one
     with an orthographic frame behind it. */
  near(FS.width, section.system.sign.width, 1e-9, "the two wordmarks must be one measured size");
  near(FS.height, section.system.sign.height, 1e-9);
  const { group, counts } = build();
  assert.equal(counts.fasciaSigns, 1);
  group.updateMatrixWorld(true);
  const face = section.facades.find((f) => f.id === "dgSouth");
  let sign = null;
  each(group, (e) => { if (e.name === "revellecommons-fascia-sign") sign = e; });
  assert.ok(sign, "the fascia sign did not build");
  /* ON THE FASCIA BAND: its centre must lie inside the parapet band's own height
     range on this block, which is where all three frames put it. */
  const datum = Math.min(...[0].map(() => 20));
  const B = section.system.bands;
  const bandLo = 20 + B.plinth + B.glazing.degrees + B.soffit;
  const bandHi = bandLo + B.parapet;
  assert.ok(sign.y > bandLo && sign.y < bandHi,
    `the fascia sign sits at y ${sign.y.toFixed(2)}, outside its own fascia band ${bandLo.toFixed(2)}..${bandHi.toFixed(2)}`);
  void datum;
  /* And it is on the south face, not the east one. */
  assert.ok(Math.abs(sign.z - face.a[1]) < 2,
    `the fascia sign is ${Math.abs(sign.z - face.a[1]).toFixed(1)} m off the south face it belongs to`);
  assert.ok(section.superseded["absent.buildingMountedShade"],
    "retiring the withholding must be recorded, not silently applied");
});

test("VISUAL 3: the 2014 entry canopy is built, below the soffit and clear of heads", () => {
  const CN = section.system.canopy;
  const F = section.derivations.figures;
  assert.equal(CN.built, true, "the canopy attaches to the BUILDING and is not covered by the withheld terrace");
  assert.equal(CN.face, "dgSouth");
  near(CN.fall, F["canopy.fall"].value, 1e-9, "the canopy's fall drifted from its derivation");
  near(CN.attachHeight, F["canopy.attachHeight"].value, 1e-9);
  /* THE FALL IS MEASURED and the two foreshortened dimensions are banded. */
  assert.ok(F["canopy.fall"].expr, "the fall must be arithmetic over the pinned pixel rows");
  for (const k of ["system.canopy.bays", "system.canopy.projection"]) {
    assert.ok(section.estimates[k], `${k} must be a banded estimate, not a bare number`);
  }
  const { group, counts } = build();
  assert.equal(counts.canopies, 1, "one canopy — frames 16, 18 and 33 are one object");
  assert.ok(counts.canopyStruts >= 3, "the radiating frame did not build");
  group.updateMatrixWorld(true);
  let fabric = null;
  const struts = [];
  each(group, (e) => {
    if (e.name === "revellecommons-canopy") fabric = e;
    if (e.name === "revellecommons-canopy-strut") struts.push(e);
  });
  assert.ok(fabric, "the canopy fabric did not build");
  const B = section.system.bands;
  const soffitLo = 20 + B.plinth + B.glazing.degrees;
  assert.ok(fabric.yHi <= soffitLo + 1e-6,
    `the canopy tops out at ${fabric.yHi.toFixed(2)}, above the soffit underside at ${soffitLo.toFixed(2)} it hangs from`);
  /* CLEAR OF HEADS. The lowest thing in this section with a headroom meaning is
     the sourced 80 in door leaf, and the canopy's free edge must clear it. */
  const doorHeight = section.system.entry.heightIn * section.derivations.units.inch;
  assert.ok(fabric.yLo >= 20 + doorHeight,
    `the canopy's free edge falls to ${(fabric.yLo - 20).toFixed(2)} m, below the ${doorHeight.toFixed(2)} m door head it must clear`);
  /* It projects OUT over the terrace, not into the building. */
  const face = section.facades.find((f) => f.id === "dgSouth");
  assert.ok(fabric.zHi > face.a[1] + CN.projection * 0.5,
    "the canopy does not project outward from its own face");
  for (const st of struts) {
    assert.ok(st.yLo >= fabric.yLo - 0.5 && st.yHi <= fabric.yHi + 0.5,
      "a strut does not lie in the fabric's own plane");
  }
  /* IT IS PAINTED, AND IT IS TRANSLUCENT. Both were wrong in round 2: the sail
     shipped at the renderer's white default, and opaque it hid its own frame. */
  assert.equal(section.colors.canopyFabric, "#3c3d43",
    "the canopy fabric's sourced hex has moved");
  assert.equal(section.colorSources.canopyFabric.tier, "sourced",
    "a translucent surface has no albedo and may not claim [measured]");
  assert.equal(typeof section.draw.canopyOpacity, "number");
  assert.ok(section.draw.canopyOpacity > 0 && section.draw.canopyOpacity < 1,
    "the canopy must be translucent — drawn opaque it is a slab and its strut lattice disappears");
  let mat = null;
  group.traverse((o) => { if (o.name === "revellecommons-canopy") mat = o.material; });
  assert.ok(mat, "the canopy has no material");
  assert.equal(mat.transparent, true, "the canopy material is not transparent");
  near(mat.opacity, section.draw.canopyOpacity, 1e-9, "the canopy's opacity is not the declared one");
  assert.notEqual(mat.color.getHex(), 0xffffff,
    "the canopy is white — that is campus-materials' unset-colour default, not a colour");
  /* ONE OBJECT, ONE EPOCH — the critic read frames 16/18 and 33 as two dates. */
  const c = section.conflicts.find((q) => q.key === "canopy-epoch");
  assert.ok(c, "the canopy-epoch conflict must be declared");
  assert.match(c.resolution, /ONE OBJECT/);
  assert.match(c.resolution, /DAYLIGHT/, "and the colour must come from the daylight frame, not the dusk silhouette");
});

test("VISUAL minors: what is NOT this section's geometry is identified, not adopted", () => {
  /* The critic reported umbrellas, a lawn strip and a flat blue rectangle on
     this frontage. None is built here, and saying so precisely is the fix. */
  const { group } = build();
  const names = new Set();
  group.traverse((o) => { if (o.isMesh) names.add(o.name); });
  for (const forbidden of [/umbrella/i, /lawn/i, /turf/i]) {
    for (const nm of names) assert.ok(!forbidden.test(nm), `${nm} matches ${forbidden}`);
  }
  const handoff = section.absent.find((a) => /^THREE THINGS THE VISUAL AUDIT FOUND/.test(a));
  assert.ok(handoff, "the three not-mine findings must be identified in absent[]");
  for (const probe of [/umbrella/i, /ground#237/, /ground#3268/]) {
    assert.match(handoff, probe, `the hand-off does not identify ${probe}`);
  }
  assert.ok(section.conflicts.find((q) => q.key === "ground237-turf"),
    "the survey-versus-photograph conflict about #237 must be declared");
});

test("two builds are byte-identical — no hidden randomness", () => {
  const a = build();
  const b = build();
  assert.deepEqual(a.counts, b.counts);
  const sig = (r) => {
    const out = [];
    r.group.traverse((o) => {
      if (o.isInstancedMesh) out.push(Array.from(o.instanceMatrix.array));
      else if (o.isMesh) out.push(Array.from(o.geometry.getAttribute("position").array));
    });
    return out;
  };
  assert.deepEqual(sig(a), sig(b));
});

test("the material library is on the surfaces, and only deterministic sources", () => {
  assert.match(moduleSrc, /(?:shared|create)MaterialLibrary/, "surfaces come from campus-materials.js");
  assert.ok(!/Math\.random|Date\.now|TextureLoader/.test(moduleSrc), "no nondeterminism in the builder");
  assert.match(moduleSrc, /hash\(section\.seed/, "irregularity may only come from the section's own seed");
  /* And no bare dimension: every number in the builder must be an index, a
     count, a division, or a material parameter — never a metre. */
  const suspicious = moduleSrc
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "")
    .match(/\b\d+\.\d+\b/g) || [];
  for (const s of suspicious) {
    assert.ok(["0.5", "0.8", "0.42", "0.72", "0.0", "0.15", "0.85", "131.71", "57.13", "7.9", "43758.5453"].includes(s),
      `the builder carries a bare decimal ${s} — every metre must come from the section`);
  }
  const { group } = build();
  let textured = 0;
  let glass = 0;
  group.traverse((o) => {
    if (o.isMesh && o.material) {
      if (o.material.map && o.material.roughnessMap) textured++;
      if (o.material.transparent && o.material.opacity < 1) glass++;
    }
  });
  assert.ok(textured >= 5, `only ${textured} textured meshes — the library is not applied`);
  assert.ok(glass >= 1, "the glazing does not carry the library's glass");
});
