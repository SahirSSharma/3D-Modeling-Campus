/* Blake Hall's photo-sourced detail section — INVENTED class, R1 revision.
 *
 * Blake is Argo's sibling, same family language and a DIFFERENT module, so
 * beyond the quarantine gates this file gates the DIFFERENCE. What R1 changed,
 * and what these gates therefore exist to hold:
 *
 *   - THE WELL IS OPEN. The previous build painted a decal lid over the drawn
 *     courtyard void at the roof plane and declared everything below it
 *     unsourced. Both halves were false. There is no lid here, the court floor
 *     is at surfaceAt, and the well faces carry the gallery language two dated
 *     photographs actually show.
 *   - THE STOREY IS 3.10 m AND THE PARAPET IS INSIDE THE HEIGHT: 12.40 =
 *     4 x 3.10 with zero residual, the outer parapet topping out at 10.59 m
 *     and the Level 4 roof slab standing 1.81 m proud of it.
 *   - EVERY FIGURE RECOMPUTES. The Eighth audit proved 22 presence gates can
 *     pass on wholesale fabricated values, so the central gate here evaluates
 *     each derivation's own `expr` against the raw `readings` and fails if the
 *     section's value drifts from its own arithmetic. A self-consistent
 *     fabrication cannot pass it.
 *   - AND THE AXIOM LAYER UNDERNEATH IT IS GATED TOO (R2 item S1). The R1
 *     suite recomputed the figures and never looked at what they were computed
 *     FROM: `px.l4Floor` and `px.parapetTop` both moved 100 px, the Level 4
 *     terrace deck moved 2.26 m, and all 26 tests passed. Every reading is now
 *     pinned to a literal here, the relations the section states in prose are
 *     asserted, every estimate carries a band its shipped value must sit
 *     inside, and a coverage walk fails on any bare number in `readings`,
 *     `estimates` or `draw`. The apparatus is tests/helpers/axiom-gate.mjs,
 *     shared by all six R1 suites — never forked.
 *   - NO ROOF PLACEMENT STANDS ABOVE THE MEASURED LiDAR MAXIMUM (R2 item B2).
 *     The retired gate derived its ceiling from the roof block it was gating,
 *     so it could not fail; against the anchor read from campus-lidar.json,
 *     65 placements stood up to +2.510 m over it. The coping, the mechanical
 *     screen and the vent geometry are withheld rather than re-seated, because
 *     the only datum below the anchor is inside solid mass.
 *   - THE ABSENT LIST DOES NOT SHRINK, PER ENTRY. absent[0] is retired, not
 *     deleted, and superseded['absent#1'] must still quote it verbatim; and
 *     every other entry is now matched by a stable key, so no single one can
 *     be dropped under a list-length gate.
 *   - the east end is a glazed grid, not the fin field;
 *   - the 2013 west-end frames are geometry-only — pre-repaint colour is dead;
 *   - the north road's dumpsters belong to Machining & Additive Prototyping
 *     Services and stay off Blake's record;
 *   - the mechanical screen is NOT PV, and its record says why.
 *
 * The section lives under the `blake` key of docs/data/campus-photo-detail.json.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as THREE from "../docs/vendor/three/three.module.min.js";
import { createPhotoBlake } from "../docs/js/campus-photo-blake.js";
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
const section = merged.blake;
const argo = merged.argo;

const campus = read(join(root, "docs/data/campus-3d.json"));
const staging = read(join(root, "docs/data/corridor-staging.json"));
const lidar = read(join(root, "docs/data/campus-lidar.json"));
const arcgis = read(join(root, "docs/data/campus-arcgis.json"));

/* The ring that RENDERS is the university's massing ring — campus-massing.js
   extrudes it WITH its inner courtyard well and suppresses the OSM ring
   underneath. The photo detail must register to the drawn mass: the audit
   caught the roofscape hovering 3.2 m over the drawn roof because the section
   was built on the OSM side's 15.6 m. */
const drawn = assembleMasses({ campus, lidar, arcgis, colors: null })
  .find((m) => m.name === "Blake Hall" && m.src === "gis");
const ring = drawn.rings[0];
const well = drawn.rings[1];
const drawnGround = makeSurfaceSampler(lidar.terrain);

const bbox = (r) => ({
  x0: Math.min(...r.map((p) => p[0])), x1: Math.max(...r.map((p) => p[0])),
  z0: Math.min(...r.map((p) => p[1])), z1: Math.max(...r.map((p) => p[1])),
});
const RING = bbox(ring);
const WELL = bbox(well);

const inRing = (x, z, r) => {
  let ins = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, zi] = r[i];
    const [xj, zj] = r[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
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

/** Every solid the section stands on the ground outside the building, as (x, z). */
function solids() {
  const L = section.ground.south.lavaWall;
  const out = [];
  const n = Math.ceil(Math.hypot(L.b[0] - L.a[0], L.b[1] - L.a[1]) / 2);
  for (let i = 0; i <= n; i++) {
    out.push([L.a[0] + ((L.b[0] - L.a[0]) * i) / n, L.a[1] + ((L.b[1] - L.a[1]) * i) / n]);
  }
  return out;
}

const moduleSrc = readFileSync(join(root, "docs/js/campus-photo-blake.js"), "utf8");
const near = (a, b, eps, what) =>
  assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b} (tolerance ${eps})`);

/* ------------------------------------------------------------ the section */

test("the section exists and is reachable", () => {
  assert.ok(section, "no blake section in the merged doc or the build-side file");
  assert.ok(argo, "the sibling gates need the argo section too");
  for (const k of ["label", "epoch", "note", "seed", "bounds", "sources", "measured",
    "derivations", "estimates", "reads", "draw", "grid", "level4", "facades", "system",
    "signage", "court", "roof", "ground", "colors", "colorNote", "colorSources", "colorFallback",
    "conflicts", "superseded", "counts", "absent"]) {
    assert.ok(section[k] !== undefined, `section is missing ${k}`);
  }
  assert.equal(typeof section.seed, "number");
});

test("it says what it is, and the epoch is the EXIF date and not Argo's programme", () => {
  assert.match(section.label, /Blake/);
  assert.match(section.label, /Revelle/);
  assert.match(section.label, /NOT a Fleet hall/);
  assert.match(section.label, /DIFFERENT module/i, "the sibling distinction is the label's job too");
  assert.ok(!/1967\)/.test(section.label) && !/, 1967/.test(section.label),
    "the label must stop asserting 1967 flat — the year is a declared conflict");
  assert.match(section.label, /conflicts\[\]/, "and it must point at where the year is adjudicated");
  assert.match(section.epoch, /2014-01-12/, "the Vasquez Marshall set is EXIF-dated, not 'c.2015-16'");
  assert.match(section.epoch, /EXIF/i);
  assert.ok(!/2015-16 Vasquez|c\.2015-16 Vasquez/.test(section.epoch),
    "the refuted 'c.2015-16 Vasquez Marshall photography' claim must be gone from the epoch");
  assert.match(section.epoch, /geometry only/i, "the 2013 pre-repaint frames are geometry-only");
  assert.match(section.note, /INVENTED/);
  assert.match(section.colorNote, /FALSE|refut/i,
    "the colorNote must say the same-programme-as-Argo premise is refuted, not repeat it");
  assert.match(section.colorNote, /THE SHIPPED PREMISE WAS FALSE/,
    "the refutation must lead, so nobody reads the quoted premise as the claim");
  assert.ok(/It read '/.test(section.colorNote),
    "the refuted premise may only appear as a quotation of what it replaces");
});

test("every source is described and dated", () => {
  assert.ok(section.sources.length >= 8, `only ${section.sources.length} sources`);
  for (const s of section.sources) {
    assert.ok(s.length >= 80, `source is not described: ${s.slice(0, 70)}`);
    assert.match(s, /\b(19|20)\d\d\b/, `source has no date: ${s.slice(0, 70)}`);
  }
  const joined = section.sources.join("\n");
  assert.match(joined, /vmarch\.net/, "the architect of record must be cited");
  assert.match(joined, /modernsandiego\.com/, "the independent firm corroboration must be cited");
  assert.match(joined, /_67\.jpg/, "the frame every px reading comes from must be cited");
  assert.match(joined, /_3\.jpg/, "the frame that breaks the lid must be cited");
  assert.match(joined, /chunk_4_6\.jpg/, "the ortho must be cited");
});

/* ------------------------------------------- the arithmetic, recomputed */

/** The scope every `expr` is evaluated against: the section's own units and
 *  readings, the drawn ring and well bboxes, and every figure's DECLARED value
 *  seeded so an expression may build on an earlier figure whatever order the
 *  document happens to list them in. */
function exprScope() {
  const D = section.derivations;
  const scope = { ...D.units, ...D.readings, ring: RING, well: WELL };
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
  const R = D.readings;
  for (const k of ["px", "ortho", "survey", "published", "code", "product"]) {
    assert.ok(R[k], `readings is missing ${k}`);
    assert.ok(R[k].source && R[k].source.length > 80, `readings.${k} has no described source`);
  }
  /* The survey readings must BE the survey, not a transcription of it. */
  near(R.survey.lidarHeight, lidar.heights["Blake Hall"], 1e-9, "readings.survey.lidarHeight");
  for (const [x, z] of [[R.survey.notchX0, R.survey.notchZ0], [R.survey.notchX1, R.survey.notchZ1]]) {
    assert.ok(well.some(([wx]) => wx === x), `notch x ${x} is not a vertex of the drawn well ring`);
    assert.ok(well.some(([, wz]) => wz === z), `notch z ${z} is not a vertex of the drawn well ring`);
  }
  for (const [key, fig] of Object.entries(D.figures)) {
    assert.ok(typeof fig.value === "number", `${key} has no value`);
    assert.ok(fig.why && fig.why.length > 40, `${key} is unmotivated: ${fig.why}`);
  }

  /* S1(vi): the shared evaluator, not a parallel hand-written one. `expr` now
     means arithmetic over the section's own readings and nothing else — an
     identifier that resolves to no reading, or a stray word of prose, is a hard
     failure rather than something the evaluator shrugs off. */
  const { evaluated, prose } = assertExprs({
    figures: D.figures, scope: exprScope(), label: "blake",
  });
  assert.equal(prose, 0, "every blake figure is arithmetic — none has fallen back to prose");
  assert.ok(evaluated >= 50, `only ${evaluated} figures evaluated — the block is too thin`);
});

/* ------------------------------------------- S1: the axiom layer, gated */

/* Every reading Blake carries, pinned to a LITERAL here, with the artefact it
   was read off named. The literal lives in the test, so moving a reading in the
   section moves it away from its pin and fails — which is the whole of R2 item
   S1(iii). Blake is the batch's worked example: the R1 suite recomputed all 53
   figures faithfully and never once looked at the 55 numbers they recompute
   FROM, so `px.l4Floor` and `px.parapetTop` could both move 100 px, drag the
   Level 4 terrace deck 2.26 m with them, and pass 26/26. */
const FRAME = "vmarch-bradley_VMA_UCSDBlake_67.jpg at its original 2500x1283, all band edges read in ONE vertical strip at x 1470-1620";
const ORTHO = "docs/data/textures/chunk_4_6.jpg at 8 px/m, 2026 epoch, raw plan read before the recon's imported +1.1/+3.6 displacement";
const GIS = "docs/data/campus-arcgis.json massing 'Blake Hall' rings at /10, carried verbatim";
const IBC = "IBC 2021 — the code clause itself, a whole number of inches";
const STOCK = "a stock product size in whole inches, the Keeling `panel [1.65, 0.99]` class";
const VM = "vmarch.net's own published project data sheet for Blake Hall";

const pin = (value, truth, tol) => ({ value, truth, tol });
const READING_PINS = {
  "px.grade": pin(1046, `${FRAME} — grade line`),
  "px.l2Floor": pin(909, `${FRAME} — colonnade fascia / L2 floor line`),
  "px.l3Floor": pin(772, `${FRAME} — L3 head / floor line`),
  "px.l4Floor": pin(635, `${FRAME} — L4 floor, which IS the roof-terrace deck`),
  "px.parapetTop": pin(578, `${FRAME} — top of the outer parapet band`),
  "px.l4Sill": pin(570, `${FRAME} — L4 set-back storey sill`),
  "px.l4Head": pin(527, `${FRAME} — L4 set-back storey head`),
  "px.l4SlabUnder": pin(508, `${FRAME} — underside of the oversailing L4 roof slab`),
  "px.l4SlabTop": pin(498, `${FRAME} — top of the L4 roof slab, the LiDAR maximum`),
  "px.storeyStep": pin(137, `${FRAME} — the constant step of the four-line stack`),
  "px.spandrelBand": pin(27, `${FRAME} — solid spandrel between floors`),
  "px.opening": pin(110, `${FRAME} — glazed opening within one storey`),
  "px.awningSash": pin(42.5, `${FRAME} — the bottom-hinged awning sash, midpoint of a 40-45 px read`, 5e-6),
  "px.finPitch": pin(58.5, `${FRAME} — fin pitch, the local horizontal scale`),
  "px.elevationWidth": pin(1797, `${FRAME} — the full south elevation across the frame`),
  "px.bayPitchMedian": pin(60, `${FRAME} — median glazing-band peak pitch, the independent bay check`),
  "px.lavaExposedWest": pin(62, `${FRAME} — lava wall exposed face at image x 800`),
  "px.lavaExposedMid": pin(61, `${FRAME} — lava wall exposed face at image x 1250`),
  "px.lavaExposedEast": pin(110, `${FRAME} — lava wall exposed face at image x 1600`),
  "px.lavaScaleWest": pin(49.2, `${FRAME} — local px/m at the west lava station`),
  "px.lavaScaleMid": pin(48, `${FRAME} — local px/m at the mid lava station`),
  "px.lavaScaleEast": pin(46.8, `${FRAME} — local px/m at the east lava station`),
  "ortho.l4RawX0": pin(-58.6, `${ORTHO} — raised plate west edge`),
  "ortho.l4RawX1": pin(-23.1, `${ORTHO} — raised plate east edge`),
  "ortho.l4RawZ0": pin(321.5, `${ORTHO} — raised plate north edge`),
  "ortho.l4RawZ1": pin(340.6, `${ORTHO} — raised plate south edge`),
  "ortho.dispX": pin(1.1, "revelle-recon.md 1.2 / Rung 5 item 24 — the top displacement MEASURED on Argo over this same ortho chunk, imported and never fitted here"),
  "ortho.dispZ": pin(3.6, "revelle-recon.md 1.2 / Rung 5 item 24 — the z half of the same imported displacement"),
  "ortho.notchRawX0": pin(-49.1, `${ORTHO} — the pale core block's west edge`),
  "ortho.notchRawX1": pin(-45.9, `${ORTHO} — the pale core block's east edge`),
  "ortho.notchRawZ0": pin(329.5, `${ORTHO} — the pale core block's north edge`),
  "ortho.notchRawZ1": pin(332.2, `${ORTHO} — the pale core block's south edge`),
  "survey.lidarHeight": pin(12.4, "docs/data/campus-lidar.json heights['Blake Hall'], the 2014 per-mass roof plane the extruder uses"),
  "survey.storeys": pin(4, "a COUNT off the south elevation's four-step stack, corroborated by the arcgis levels field"),
  "survey.southFaceLength": pin(37.5, `${GIS} — the drawn south face's own chord length`),
  "survey.countedBays": pin(30, `${FRAME} — a COUNT, foreshortening-immune, confirmed by peak detection on the glazing bands`),
  "survey.outerArea": pin(1405.6, `${GIS} — the shoelace area of the outer ring`),
  "survey.wellArea": pin(256.8, `${GIS} — the shoelace area of the inner (courtyard) ring`),
  "survey.notchX0": pin(-47.4, `${GIS} — a vertex of the drawn inner ring, carried verbatim`),
  "survey.notchX1": pin(-44.4, `${GIS} — a vertex of the drawn inner ring, carried verbatim`),
  "survey.notchZ0": pin(333.3, `${GIS} — a vertex of the drawn inner ring, carried verbatim`),
  "survey.notchZ1": pin(336.2, `${GIS} — a vertex of the drawn inner ring, carried verbatim`),
  "published.squareFeet": pin(38880, `${VM} — the published gross area`),
  "published.sqftPerSqm": pin(10.7639, "exact by definition: 1 m^2 = 10.7639 square feet"),
  "published.lavaDistanceFactor": pin(1.085, "D/(D-3.9) at D = 50 m — the wall stands 3.9 m nearer the camera than the facade it is scaled against"),
  "code.guardHeightIn": pin(42, `${IBC} §1015.2 — 42 in minimum guard at an occupied roof`),
  "code.guardSphereIn": pin(4, `${IBC} §1015.4 — a 4 in sphere may not pass a required guard`),
  "product.mullionIn": pin(2, `${STOCK} — 2 in storefront mullion face`),
  "product.picketIn": pin(1.25, `${STOCK} — 1-1/4 in square picket stock`),
  "product.railFaceIn": pin(2, `${STOCK} — 2 in flat rail section`),
  "product.postIn": pin(2, `${STOCK} — 2 in stub-post section`),
  "product.doorLeafIn": pin(36, `${STOCK} — a 36 in door leaf`),
  "product.doorHeightIn": pin(80, `${STOCK} — an 80 in door leaf height`),
  "product.windowHeightIn": pin(48, `${STOCK} — a 48 in sash`),
  "product.boardIn": pin(8, `${STOCK} — 8 in nominal horizontal board cladding`),
  "product.fixtureIn": pin(12, `${STOCK} — a 12 in square wall-mounted light fixture`),
};
const UNIT_PINS = {
  inch: pin(0.0254, "exact by definition: 1 international inch = 0.0254 m"),
  foot: pin(0.3048, "exact by definition: 1 international foot = 0.3048 m"),
};

/* The only sanctioned escape, and it is visible in the file. These four are
   RENDER OFFSETS: they have no external truth to be pinned to, they decide no
   dimension of the building, and each is declared with its own note in the
   section's `draw` block. They are here rather than behind a widened threshold
   precisely so a fifth one cannot be added quietly. */
const UNCOVERED = {
  "draw.wellFaceProud": "A render offset, not a measurement: cladding, doors, windows and fixtures are pushed this far outward of the well ring's chord plane so they read against the massing's own inner wall instead of z-fighting it. Declared in draw.wellFaceProudNote; no source can measure it because it does not exist in the building.",
  "draw.railProud": "A render offset expressing a SOURCED fact (_3 shows the guard on stub posts standing just proud of the slab edge) whose magnitude nothing measures. Declared in draw.railProudNote.",
  "draw.slabEdgeProud": "A render offset that keeps the gallery slab-edge line — a sourced feature of _3 — off the cladding plane it would otherwise z-fight. Declared in draw.slabEdgeProudNote; it decides no dimension.",
  "draw.boulderBury": "A render fraction, not a length: the share of its own radius each boulder is bedded into the DG, which the court's 'nothing sinks' gate is written against. Declared in draw.boulderBuryNote; _25 shows boulders set INTO their beds and measures nothing about how far.",
  "draw.crownClear": "A render clearance, not a measurement: how far clear of the drawn well ring a palm crown's DRAWN radius is trimmed, so a measured canopy cannot grow into the gallery slab or the solid core notch. The rule is in draw.crownClearNote and the trimmed number is nowhere \u2014 it re-derives from measured.courtyardRing. Set just outside draw.wellFaceProud so the clip is against the face the eye sees.",
  "draw.storefrontProud": "A render offset, not a dimension: how far the storefront mullions stand outward of the ground-recess glazing plane so they frame it instead of z-fighting it. Declared in draw.storefrontProudNote; nothing in the building measures it.",
  "draw.membraneInset": "A render offset: how far inside the drawn ring the membrane decal stops so the field does not bleed over the rim of the extruded mass. Declared in draw.membraneInsetNote. It used to be taken from roof.coping.width, which made a render inset depend on a piece of geometry that is now withheld.",
};

test("S1(iii): every reading is pinned to the artefact it was read off", () => {
  const R = section.derivations.readings;
  const n = assertPins({
    readings: R, pins: READING_PINS,
    namespaces: ["px", "ortho", "survey", "published", "code", "product"],
    label: "blake readings",
  });
  assert.ok(n >= 55, `only ${n} readings pinned — blake carries more than that`);
  assertPins({ readings: section.derivations.units, pins: UNIT_PINS, namespaces: [], label: "blake units" });
});

test("S1(iii): the relations the section states in PROSE are asserted", () => {
  const R = section.derivations.readings;
  const G = section.grid;
  const S = section.system;
  const px = R.px;
  /* THE CONSTRAINT B3 IS ABOUT. `grid.terraceDeck`'s own `why` says "411 px =
     3 x 137"; `px.storeyStep` is 137 and is in the file; nothing checked that
     the stack actually steps by it. 2 px is the stated tolerance — on the
     shipped readings all four steps are 137 EXACTLY. */
  const steps = [
    ["grade -> l2Floor", px.grade - px.l2Floor],
    ["l2Floor -> l3Floor", px.l2Floor - px.l3Floor],
    ["l3Floor -> l4Floor", px.l3Floor - px.l4Floor],
    ["l4Floor -> l4SlabTop", px.l4Floor - px.l4SlabTop],
  ];
  assertRelations({
    label: "blake",
    relations: [
      ...steps.map(([name, got]) => ({ name: `the storey stack steps by storeyStep (${name})`, got, want: px.storeyStep, tol: 2 })),
      { name: "spandrelBand + opening is one whole storey step", got: px.spandrelBand + px.opening, want: px.storeyStep, tol: 2 },
      { name: "the terrace deck is three storeys up", got: G.terraceDeck, want: (G.storeys - 1) * G.floorToFloor, tol: 1e-6 },
      { name: "storeys x floorToFloor IS the drawn LiDAR height", got: G.storeys * G.floorToFloor, want: R.survey.lidarHeight, tol: 1e-9 },
      { name: "parapetTop is the deck plus the parapet", got: G.terraceDeck + G.parapet, want: G.parapetTop, tol: 1e-9 },
      { name: "the L4 slab stands slabProud over the parapet", got: G.roofSlab - G.parapetTop, want: G.slabProud, tol: 1e-6 },
      { name: "spandrelFrac + openingFrac accounts for the whole storey", got: S.bands.spandrelFrac + S.bands.openingFrac, want: 1, tol: 1e-6 },
      { name: "the bay module is the face length over the counted bays", got: R.survey.southFaceLength / R.survey.countedBays, want: section.derivations.figures["system.bayModule"].value, tol: 1e-9 },
      { name: "the mid rail sits inside the picket panel", got: Math.sign(S.wellFace.midRailHeight - S.wellFace.bottomRailHeight), want: 1, tol: 0 },
    ],
  });
});

test("S1(i): no bare number survives in readings, estimates or draw", () => {
  const paths = assertCoverage({
    section, label: "blake", minimum: 80,
    /* B4: the per-face bay table is a drawn-number block and is walked too, so
       a figure cannot be added to it outside the survey re-derivation. */
    roots: {
      "derivations.readings": {}, "derivations.units": {}, estimates: {}, draw: {},
      "system.wellFace.faceBays": {},
    },
    uncovered: UNCOVERED,
    classify: (path) => {
      if (path.startsWith("derivations.readings.")) {
        return READING_PINS[path.slice("derivations.readings.".length)] ? "pinned" : null;
      }
      if (path.startsWith("derivations.units.")) {
        return UNIT_PINS[path.slice("derivations.units.".length)] ? "pinned" : null;
      }
      if (/^estimates\..+\.(value|band\.[01])$/.test(path)) return "banded";
      /* Every leaf here is re-derived from measured.courtyardRing and asserted
         EXACTLY, table-wide and exhaustively over the ring's edges, by
         "B4 the well-face bay is declared PER FACE". Nothing in this block can
         be typed: the vertex coordinates are the survey's, and the lengths,
         counts, bays and window widths all fall out of faceBayFit's rule. */
      if (/^system\.wellFace\.faceBays\.\d+\.(i|length|bays|bay|windowWidth|[ab]\.[01])$/.test(path)) {
        return "derived";
      }
      return null;
    },
  });
  assert.ok(paths.length >= 85, `the walk only found ${paths.length} numbers in the axiom layer`);
});

/* The shipped value each estimate actually governs, so a band cannot be
   satisfied by a number that nothing draws. */
const EST_SHIPPED = {
  "wellFace.bayModule": () => section.system.wellFace.bayModule,
  "wellFace.boardPitch": () => section.system.wellFace.boardPitch,
  "wellFace.fixture": () => section.system.wellFace.fixture,
  "court.beds": () => Math.max(...section.court.beds.flatMap((b) => [b.x1 - b.x0, b.z1 - b.z0])),
  "court.boulders": () => Math.max(...section.court.boulders.map((b) => b.r)),
  "ground.south.lavaWall.thickness": () => section.ground.south.lavaWall.thickness,
  "ground.south.lavaWall.profileKnee": () => section.ground.south.lavaWall.profile.knee,
  "system.ground": () => section.facades.length,
  "wellFace.groundLevel": () => section.system.wellFace.levels.length,
};

test("S1(ii): every estimate carries a band, and the shipped value is inside it", () => {
  const n = assertEstimateBands({
    estimates: section.estimates,
    valueAt: (key) => {
      const f = EST_SHIPPED[key];
      assert.ok(f, `blake: estimate ${key} governs no shipped value this suite knows about`);
      return f();
    },
    label: "blake",
  });
  assert.equal(n, Object.keys(section.estimates).length, "every estimate must be banded");
  for (const [k, e] of Object.entries(section.estimates)) {
    assert.ok(e.bandWhy && e.bandWhy.length > 80, `estimate ${k}'s band is a bare pair with no argument`);
    assert.ok(e.why.length > 120, `estimate ${k} does not record its failed ladder`);
  }
  /* And the whole population sits inside the band, not just the one value the
     band gate compares — a band over a single sample is not a band. */
  const [bLo, bHi] = section.estimates["court.beds"].band;
  for (const b of section.court.beds) {
    for (const side of [b.x1 - b.x0, b.z1 - b.z0]) {
      assert.ok(side >= bLo - 1e-9 && side <= bHi + 1e-9, `bed ${b.key} side ${side} is outside the estimate's band`);
    }
  }
  const [rLo, rHi] = section.estimates["court.boulders"].band;
  for (const b of section.court.boulders) {
    assert.ok(b.r >= rLo - 1e-9 && b.r <= rHi + 1e-9, `boulder ${b.key} radius ${b.r} is outside the estimate's band`);
  }
});

test("S1(iv): the tier gate runs BOTH ways over colours and estimates", () => {
  /* The R1 gate only forbade a [measured] line from calling its own hex
     estimated. This one also fails a line that claims a tier above [estimated]
     while hedging or while naming no artefact — which is what catches a
     promotion, audit minor 10's `lavaRock` case included. */
  const entries = [
    ...Object.entries(section.colorSources).map(([key, p]) => ({ key: `colour:${key}`, text: `[${p.tier}] ${p.source}` })),
    ...Object.entries(section.estimates).map(([key, e]) => ({ key: `estimate:${key}`, text: e.why })),
  ];
  const n = assertTierSymmetry({ entries, label: "blake" });
  assert.ok(n >= 30, `the tier gate only walked ${n} lines`);
});

test("every drawn figure is pinned to its derivation, not merely near it", () => {
  const F = section.derivations.figures;
  const pin = (path, actual) => near(actual, F[path].value, 1e-9, `${path} drifted from its derivation`);
  const G = section.grid;
  pin("grid.floorToFloor", G.floorToFloor);
  pin("grid.terraceDeck", G.terraceDeck);
  pin("grid.parapet", G.parapet);
  pin("grid.parapetTop", G.parapetTop);
  pin("grid.roofSlab", G.roofSlab);
  pin("grid.slabProud", G.slabProud);
  pin("grid.slabThickness", G.slabThickness);
  pin("system.bands.spandrelFrac", section.system.bands.spandrelFrac);
  pin("system.bands.awningFrac", section.system.bands.awningFrac);
  pin("system.bands.panelFrac", section.system.bands.panelFrac);
  pin("grid.parapet", section.system.parapet.height);
  const W = section.system.wellFace;
  pin("wellFace.bayModule", W.bayModule);
  pin("wellFace.doorWidth", W.doorWidth);
  pin("wellFace.doorHeight", W.doorHeight);
  pin("wellFace.windowWidth", W.windowWidth);
  pin("wellFace.windowHeight", W.windowHeight);
  pin("wellFace.windowSill", W.windowSill);
  pin("wellFace.boardPitch", W.boardPitch);
  pin("wellFace.fixture", W.fixture);
  pin("wellFace.fixtureHeight", W.fixtureHeight);
  pin("gallery.guardHeight", W.guardHeight);
  pin("gallery.midRailHeight", W.midRailHeight);
  pin("gallery.picketPitch", W.picketPitch);
  pin("gallery.picketWidth", W.picketWidth);
  pin("gallery.railFace", W.railFace);
  pin("gallery.postWidth", W.postWidth);
  pin("gallery.bottomRailHeight", W.bottomRailHeight);
  for (const t of section.level4.terraces) {
    pin("level4.terraceX0", t.x0);
    pin("level4.terraceX1", t.x1);
  }
  pin("grid.slabThickness", W.slabEdge);
  for (const p of ["x0", "x1", "z0", "z1"]) pin(`level4.${p}`, section.level4[p]);
  pin("grid.terraceDeck", section.level4.deck);
  pin("grid.roofSlab", section.level4.top);
  pin("grid.terraceDeck", section.roof.screen.deck);
  pin("court.palmHeight", section.court.palms[0].height);
  /* The well-face level decks ARE the storey grid, not a parallel set. */
  const decks = section.system.wellFace.levels.map((l) => l.deck);
  assert.deepEqual(decks, [0, G.floorToFloor, Number((2 * G.floorToFloor).toFixed(6)), G.terraceDeck]);
  /* And the solve closes without a parapet term. */
  near(G.storeys * G.floorToFloor, section.measured.lidarHeight, 1e-9,
    "storeys x floorToFloor must BE the drawn height — the parapet is inside it, not on top");
  assert.ok(G.parapetTop < G.roofSlab, "the outer parapet must sit below the L4 roof slab");
  assert.ok(G.solve.startsWith("12.40 = 4 x 3.10"), "the solve must lead with the arithmetic that closes");
  assert.match(G.solve, /shipped/i, "and it must name the retired 2.8 m solve as retired");
});

test("the Level 4 plan closes against the survey, and it is declared unbuilt", () => {
  const L = section.level4;
  const F = section.derivations.figures;
  near(F["level4.width"].value, L.x1 - L.x0, 1e-9, "level4 width");
  near(F["level4.depth"].value, L.z1 - L.z0, 1e-9, "level4 depth");
  assert.ok(L.x0 >= RING.x0 && L.x1 <= RING.x1 && L.z0 >= RING.z0 && L.z1 <= RING.z1,
    "the Level 4 bar runs off the drawn ring");
  assert.ok(L.x0 < WELL.x0 && L.x1 > WELL.x1 && L.z0 < WELL.z0 && L.z1 > WELL.z1,
    "the Level 4 bar must contain the well — the court punches through its middle");
  assert.equal(L.built, false, "the Level 4 volume is NOT built against a flat-topped mass");
  assert.match(L.note, /flat-topped|conflicts/i, "and it must say why");
  assert.equal(L.parts.length, 4, "west leg, east leg, and the two 1.3 m gallery strips");
  for (const p of L.parts) assert.ok(p.what && p.what.length > 40, `part ${p.key} is unexplained`);
  assert.equal(L.terraces.length, 2);

  /* R2 item B1. The compromise stands — declining to build a volume inside
     solid measured mass is right — but the CLAIM that the record is "one edit
     from real" was false and had to be made true or withdrawn. These are the
     three data pieces that were missing and the correction that replaces the
     claim. */
  for (const t of L.terraces) {
    assert.equal(typeof t.x0, "number", `terrace ${t.key} still says 'full width' in prose only`);
    assert.equal(typeof t.x1, "number", `terrace ${t.key} has no east extent`);
    near(t.x0, RING.x0, 1e-9, `terrace ${t.key} x0 is not the drawn ring's own west edge`);
    near(t.x1, RING.x1, 1e-9, `terrace ${t.key} x1 is not the drawn ring's own east edge`);
    near(t.z1 - t.z0, t.depth, 1e-9, `terrace ${t.key}'s depth does not match its own z extent`);
  }
  const V = section.roof.vents.items;
  const onBar = (v) => v.x >= L.x0 && v.x <= L.x1 && v.z >= L.z0 && v.z <= L.z1;
  for (const v of V) {
    assert.ok(v.level === "terrace" || v.level === "bar",
      `vent (${v.x}, ${v.z}) carries no level — a stepped mass would float it 3.10 m over the terrace it belongs to`);
    assert.equal(v.level, onBar(v) ? "bar" : "terrace",
      `vent (${v.x}, ${v.z}) is labelled ${v.level} and its measured plan says otherwise`);
  }
  assert.equal(V.filter((v) => v.level === "terrace").length, 7, "7 of the 12 vents are on the 9.30 m terraces");
  assert.equal(V.filter((v) => v.level === "bar").length, 5);
  const M = section.roof.membrane.split;
  assert.ok(M, "the membrane must anticipate the split at the bar edges — it is not one plane in the real building");
  assert.deepEqual(M.at, [L.z0, L.z1], "the split is at level4.z0 / level4.z1, not at a re-picked shadow line");
  assert.equal(M.planes.length, 3, "three planes at two heights");
  assert.deepEqual(M.planes.map((p) => p.deck),
    [section.grid.terraceDeck, section.grid.roofSlab, section.grid.terraceDeck]);
  assert.equal(M.built, false);
  const ftm = section.conflicts.find((c) => c.key === "flat-topped-mass");
  assert.ok(!/one edit (?:from|away)/i.test(ftm.resolution + L.note),
    "the false completeness claim must be withdrawn, not repeated");
  assert.match(ftm.resolution, /NO FACADE SYSTEM AT ALL/,
    "the biggest gap — the bar has no facade system — must be named, not implied");
  assert.match(ftm.resolution, /RECORDED:/, "and the record must say exactly what it does hold");
});

/* --------------------------------------------------------- the quarantine */

test("the seat ring and the well ring are the survey's, copied verbatim", () => {
  assert.deepEqual(section.measured.ring, ring,
    "measured.ring must be the ring the massing draws for Blake Hall, byte for byte");
  assert.deepEqual(section.measured.courtyardRing, well,
    "the drawn inner ring (the courtyard well) must be carried verbatim too");
  assert.equal(drawn.h, lidar.heights["Blake Hall"],
    "the drawn mass's height is no longer the per-name LiDAR read — rekey the section");
  assert.equal(section.measured.lidarHeight, drawn.h,
    "lidarHeight must be the height campus-massing.js extrudes");
  assert.match(section.measured.heightNote, /15\.6/, "the losing 15.6 m read stays on the record");
  assert.match(section.measured.courtyardRingNote, /shape\.holes|holes/,
    "the well note must record that the extruder has always opened this void");
});

test("every facade hangs off two vertices of the measured ring", () => {
  const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const cz = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  for (const f of section.facades) {
    for (const p of [f.a, f.b]) {
      assert.ok(ring.some(([x, z]) => x === p[0] && z === p[1]),
        `${f.id}: ${JSON.stringify(p)} is not a vertex of the Blake Hall ring`);
    }
    assert.notDeepEqual(f.a, f.b, `${f.id} is a zero-length face`);
    const mx = (f.a[0] + f.b[0]) / 2 - cx;
    const mz = (f.a[1] + f.b[1]) / 2 - cz;
    assert.ok(mx * f.out[0] + mz * f.out[1] > 0, `${f.id}'s normal points into the building`);
    assert.match(f.source, /\w/, `${f.id} has no source`);
    assert.notEqual(f.estimated, true, `${f.id} is sourced`);
  }
  assert.equal(section.facades.length, 4);
});

test("bays are counts against the measured ring — the 58 m read lost to the ring", () => {
  const g = section.grid;
  assert.equal(g.longFaceBays, 30, "30 bays [measured, near-orthographic]");
  assert.match(g.bayNote, /37\.5/, "the winning ring length must be named");
  assert.match(g.bayNote, /58/, "and the losing photo-derived one");
  assert.match(g.bayNote, /Nyquist/i,
    "the ortho cross-check's resolution limit must be recorded so nobody re-refereed 30 vs 25 with it");
  for (const f of section.facades) {
    const len = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]);
    const module = len / g.longFaceBays;
    assert.ok(module > 1.1 && module < 1.35,
      `${f.id}: module ${module.toFixed(3)} m is off the ring/count read`);
  }
});

test("the sibling difference survives: Blake is not Argo at another address", () => {
  assert.ok(section.system.panel.widthFrac >= 0.8,
    "Blake's bay carries a LARGE glazed panel filling most of the bay");
  assert.ok(argo.system.window.widthFrac <= 0.7, "Argo's bay carries a NARROW window");
  assert.ok(section.system.panel.widthFrac - argo.system.window.widthFrac >= 0.15,
    "the per-bay difference is the single most important distinction and must stay legible");
  assert.equal(section.grid.finStoreys, 2);
  assert.equal(argo.grid.finStoreys, 5);
  assert.ok(section.system.fin.proud > 0.15, "Blake's fins project — faceted, with a return");
  assert.ok(section.system.fin.returnWidth < section.system.fin.width, "the return is the NARROW facet");
  /* And the well faces are NOT the Argo courtyard pattern the old build extended. */
  assert.ok(!/Argo/.test(section.system.wellFace.note),
    "the well faces are sourced in their own right now and must not cite Argo's courtyard");
  assert.match(section.system.wellFace.note, /board/i, "horizontal board cladding, not precast fins");
});

/* ------------------------------------------------------------- the court */

test("there is no lid: the well is open, floored on the ground, and the core is dressed", () => {
  assert.equal(section.roof.courtyard, undefined, "roof.courtyard is the lid and it must be gone");
  assert.equal(section.roof.plates, undefined,
    "roof.plates raised an inner plate 0.4 m ABOVE the LiDAR maximum on an estimate — withdrawn");
  assert.equal(section.roof.pv, undefined, "the misread PV array must stay unbuilt");
  assert.ok(!/courtyard-decal/.test(moduleSrc), "the lid mesh must be gone from the module");
  const C = section.court;
  assert.equal(C.datum, "surfaceAt", "the court floor is GROUND and seats on the drawn surface");
  near(C.x0, WELL.x0, 1e-9, "court x0 is off the drawn well");
  near(C.x1, WELL.x1, 1e-9, "court x1 is off the drawn well");
  near(C.z0, WELL.z0, 1e-9, "court z0 is off the drawn well");
  near(C.z1, WELL.z1, 1e-9, "court z1 is off the drawn well");
  assert.match(C.note, /shape\.holes|extruder/i, "the survey argument must be on the record");
  assert.match(C.note, /vasquez|courtyard concept/i, "and the architect's own scope");
  /* Everything in the court is inside the well and clear of the solid notch. */
  const F = section.derivations.figures;
  const notch = {
    x0: section.derivations.readings.survey.notchX0, x1: section.derivations.readings.survey.notchX1,
    z0: section.derivations.readings.survey.notchZ0, z1: section.derivations.readings.survey.notchZ1,
  };
  void F;
  const clearOfNotch = (x0, x1, z0, z1) =>
    x1 <= notch.x0 || x0 >= notch.x1 || z1 <= notch.z0 || z0 >= notch.z1;
  for (const p of C.palms) {
    assert.ok(inRing(p.x, p.z, well), `palm ${p.key} is outside the drawn well`);
    assert.ok(clearOfNotch(p.x, p.x, p.z, p.z), `palm ${p.key} stands inside the solid core notch`);
  }
  for (const b of C.beds) {
    assert.ok(b.x0 >= WELL.x0 && b.x1 <= WELL.x1 && b.z0 >= WELL.z0 && b.z1 <= WELL.z1,
      `bed ${b.key} runs outside the well`);
    assert.ok(clearOfNotch(b.x0, b.x1, b.z0, b.z1),
      `bed ${b.key} laps the solid core notch — a bed decal painted on a wall`);
  }
  for (const b of C.boulders) {
    assert.ok(inRing(b.x, b.z, well), `boulder ${b.key} is outside the drawn well`);
    assert.ok(clearOfNotch(b.x, b.x, b.z, b.z), `boulder ${b.key} sits inside the solid core notch`);
  }
  /* The core is DRESSED, not built: the notch is already solid mass. */
  assert.match(section.measured.courtyardRingNote, /notch/i);
  assert.match(section.measured.courtyardRingNote, /DRESSED|dressed/,
    "the core must be recorded as dressed rather than built — the extruder already stands it up");
  /* The breezeway and the trellises are declared, not guessed. */
  assert.equal(C.breezeway.built, false);
  assert.equal(section.roof.trellises.built, false);
  assert.match(section.roof.trellises.note, /unresolved/i);
});

test("the well faces are the sourced gallery system, on the storey grid", () => {
  const W = section.system.wellFace;
  assert.equal(W.levels.length, 4);
  assert.deepEqual(W.levels.map((l) => l.gallery), [false, true, true, true],
    "gallery access is on levels 2, 3 and 4 [sourced]; grade is not a gallery");
  for (const l of W.levels) assert.ok(l.note && l.note.length > 30, `level ${l.key} is unexplained`);
  /* The bay must actually hold what it claims to hold. */
  assert.ok(W.windowWidth > 0, "the window has no room in the bay");
  near(W.bayModule, W.doorWidth + W.windowWidth + 2 * W.boardPitch, 1e-9,
    "door + window + two reveals must fill the nominal bay exactly");
  near(W.windowSill + W.windowHeight, W.doorHeight, 1e-9,
    "the window head must align with the door head, which is what _3 shows");
  assert.ok(W.guardHeight >= 42 * 0.0254 - 1e-9, "the guard must clear the IBC 42 in minimum");
  assert.ok(W.picketPitch - W.picketWidth <= 4 * 0.0254 + 1e-9,
    "a 4 in sphere must not pass the guard — IBC 2021 1015.4");
  assert.ok(W.midRailHeight < W.guardHeight);
  assert.match(W.depthNote, /not built/i, "the unbuilt walkway depth must be declared");
  /* R2 item B4/6: the picket panel is HELD OFF THE DECK. _3 shows it filling
     roughly the top 60% of the guard, closed by a bottom rail over an open
     third; the shipped build ran the pickets deck-to-top and modelled no bottom
     rail at all. */
  assert.ok(W.bottomRailHeight > 0, "there is no bottom rail — the pickets run deck-to-top");
  assert.ok(W.bottomRailHeight < W.midRailHeight,
    "the bottom rail must sit below the mid rail, not replace it");
  const panel = (W.guardHeight - W.railFace / 2 - (W.bottomRailHeight + W.railFace / 2)) / W.guardHeight;
  assert.ok(panel > 0.5 && panel < 0.7,
    `the picket panel fills ${(panel * 100).toFixed(0)}% of the guard — _3 reads roughly the top 60%`);
  assert.match(section.reads["gallery.picketPanel"], /toleranc/i,
    "the proportion is a read and must carry its tolerance");
});

/* -------------------------------------------------------------- the roof */

test("the roof read stays on the roof, plan measured and height estimated", () => {
  const R = section.roof;
  assert.match(R.source, /\[estimated\]/i);
  assert.match(R.plateNote, /ONE roof plane|one roof plane/i);
  const S = R.screen;
  assert.ok(S, "the adjudicated mechanical screen is missing — the roof went back to the PV misread");
  assert.match(S.note, /ADJUDICATION/, "the adjudication must be on the record");
  assert.match(S.note, /cream/i, "the screen's sourced tone is the adjudication's evidence");
  assert.match(S.note, /Keeling/, "and the known-PV comparison that decided it");
  assert.match(S.note, /-53\.5/, "the losing PV read stays recorded");
  assert.match(S.note, /\[estimated\]/, "screen heights are estimates — no oblique exists");
  assert.match(S.note, /#b6af9b/, "the re-verified 2026 ortho sample must be cited");
  for (const [x, z] of [[S.x0, S.z0], [S.x1, S.z1]]) {
    assert.ok(inRing(x, z, ring), `screen corner (${x}, ${z}) runs off the measured ring`);
  }
  assert.ok(S.z1 < (RING.z0 + RING.z1) / 2, "the screen is on the NORTH roof terrace [measured, ortho]");
  assert.ok(S.z0 >= RING.z0 && S.z1 <= section.level4.z0,
    "the screen must sit on the north TERRACE band, north of the Level 4 bar");
  assert.ok(Array.isArray(R.vents.items) && R.vents.items.length >= 10,
    `only ${R.vents?.items?.length} vents — the ortho reads ~12`);
  for (const v of R.vents.items) {
    assert.ok(inRing(v.x, v.z, ring), `vent (${v.x}, ${v.z}) runs off the ring`);
    assert.ok(!inRing(v.x, v.z, well), `vent (${v.x}, ${v.z}) stands over the open well`);
  }
  /* R2 item B2. The measured plans, the tones and the 2026-08-18 not-PV
     adjudication all stay; what is withdrawn is the GEOMETRY, because it stood
     above the measured LiDAR maximum and there is no datum below the anchor to
     re-seat it on. Each carries built:false and its own withdrawal note. */
  for (const key of ["coping", "screen", "vents"]) {
    assert.equal(R[key].built, false,
      `roof.${key} is built again and it stands above the LiDAR anchor — see roof.anchorGate`);
    assert.match(R[key].note, /NOT BUILT|NO LONGER BUILT/i, `roof.${key} does not say it is withheld`);
  }
  assert.match(S.note, /2\.51 m ABOVE/, "the screen's overshoot must be on the record IN METRES");
  const A = R.anchorGate;
  assert.ok(A, "the roof-placement gate's anchor must be declared in the section");
  near(A.anchor, lidar.heights["Blake Hall"], 1e-9,
    "the declared anchor is not the measured LiDAR maximum for Blake");
  assert.match(A.anchorSource, /campus-lidar\.json/, "and it must name the file it is read from");
  assert.match(A.note, /never widened|not a figure derived from the roof block/i,
    "the gate must record that its ceiling is external to its subject");
});

test("the lava wall is Blake's, at its declared height, off the route, and honestly tiered", () => {
  const S = section.ground.south;
  assert.ok(S.lavaWall.height >= 1.2 && S.lavaWall.height <= 1.5, "the wall is the sourced 1.2-1.5 m");
  assert.match(S.lavaWall.note, /no coping/i, "rough stone throughout — no coping");
  assert.match(S.lavaWall.note, /SOLE OWNER/i, "the duplication adjudication must be on the record");
  assert.match(S.lavaWall.note, /NON-UNIFORM/i, "the wall nearly doubles toward the east and must say so");
  assert.match(S.lavaWall.note, /END WRAPS/i, "the unmodelled end wraps must be declared");
  assert.match(S.lavaWall.note, /\[estimated\]/, "the thickness is an estimate and never was measured");
  assert.ok(section.estimates["ground.south.lavaWall.thickness"],
    "the thickness must carry its own failed-ladder record");
  assert.match(S.terrace.note, /\[estimated\]/, "the terrace lift is declared estimated");
  const rings = campus.buildings.filter((b) => b.p && b.p.length >= 3);
  for (const [x, z] of solids()) {
    for (const b of rings) {
      assert.ok(!inRing(x, z, b.p), `(${x}, ${z}) is inside ${b.n || "an unnamed mass"}`);
    }
    assert.ok(toRoute(x, z) >= 3, "the wall stays clear of the staging route");
  }
});

/* ---------------------------------------------------- provenance apparatus */

test("colours are data, hex, tiered per role, and the shadow palette is gone", () => {
  const entries = Object.entries(section.colors);
  assert.ok(entries.length >= 25, `only ${entries.length} colours`);
  const luma = (hex) =>
    0.299 * parseInt(hex.slice(1, 3), 16) + 0.587 * parseInt(hex.slice(3, 5), 16) + 0.114 * parseInt(hex.slice(5, 7), 16);
  for (const [k, v] of entries) {
    assert.match(v, /^#[0-9a-f]{6}$/, `${k} is not a lowercase 6-digit hex`);
    assert.notEqual(v, "#c9bca0", `${k} is the pre-2014 tan — a dead epoch`);
    for (const dead of ["#5b595e", "#6d6863"]) {
      assert.notEqual(v, dead, `${k} is a backlit Jul 2022 sample and those are unusable`);
    }
    /* The shade-sampled courtyard palette that the previous build painted as
       material must not come back under any role name. */
    for (const shade of ["#2e333b", "#1d232b", "#31474a", "#414f5c", "#3d4953"]) {
      assert.notEqual(v, shade, `${k} is a FULL-SHADE ortho sample — shadow is not a material`);
    }
    const p = section.colorSources[k];
    assert.ok(p, `${k} has no colorSources line`);
    assert.match(p.tier, /^(measured|sourced|estimated)$/, `${k}'s tier is ${p.tier}`);
    assert.ok(p.source && p.source.length > 60, `${k}'s provenance is a stub`);
    if (p.tier !== "estimated") {
      assert.ok(!/\[estimated\]/.test(p.source),
        `${k} is tiered ${p.tier} but its own provenance calls the hex estimated`);
    }
  }
  /* R2 colour rulings. Five roles were BYTE-IDENTICAL copies of argo's hexes,
     borrowed on the one-repaint-programme premise blake's own R1 work refuted,
     so they are removed and declared absent rather than reconciled: two
     buildings holding the same hex because one copied the other is not two
     measurements. They draw in `precast` — the one white the section still
     carries and still declares as borrowed — through colorFallback, which is a
     fallback and never a source. */
  const BORROWED = ["column", "parapet", "precastAmbient", "spandrel", "windowFrosted"];
  const joinedAbsent = section.absent.join("\n");
  for (const k of BORROWED) {
    assert.equal(section.colors[k], undefined, `${k} is back in colors — it was argo's hex, not a Blake read`);
    assert.equal(section.colorSources[k], undefined, `${k} still carries a provenance line for a colour it no longer has`);
    const to = section.colorFallback[k];
    assert.ok(to && section.colors[to] !== undefined, `${k} has no colorFallback target that exists`);
    assert.match(joinedAbsent, new RegExp(`Blake's [A-Z ]*${k === "precastAmbient" ? "AMBIENT PRECAST" : k === "windowFrosted" ? "FROSTED GLAZING" : k === "parapet" ? "PARAPET BAND" : k === "spandrel" ? "SPANDREL" : "PRECAST COLUMN"} COLOUR`),
      `${k}'s removal is not declared in absent[]`);
  }
  assert.match(section.colorFallback.note, /never a source|fallback, never/i,
    "colorFallback must say it is not a source");
  assert.match(section.colorFallback.note, /REFUTED/,
    "colorFallback must record that the premise for the borrowing is refuted, not restate the borrowing");
  assert.match(section.colorFallback.note, /2014-01-12/,
    "and it must name the EXIF dates that refuted it");
  assert.match(section.colorNote, /NOTHING HERE JUSTIFIES BORROWING ANY LONGER/,
    "the colorNote must stop justifying the borrowing it now records as baseless");
  /* `lawn` gave the shared name up and KEPT its value: Blake's raised terrace
     lawn is a different piece of ground from the plaza turf, not a second
     opinion about the same grass. */
  assert.equal(section.colors.lawn, undefined, "the shared `lawn` name went to plaza's measured value");
  assert.equal(section.colors.terraceLawn, "#5a7a3f", "blake's own terrace lawn keeps its hex under its own name");
  assert.equal(section.colorSources.terraceLawn.tier, "estimated");
  assert.match(section.colorSources.terraceLawn.source, /RENAMED/);
  assert.notEqual(section.colors.terraceLawn, "#6f8054", "and it must not be forced to plaza's value either");
  /* The two lava hexes blake WON, and the one it keeps under protest. */
  assert.equal(section.colors.lavaRock, "#6e4b3b", "three sections agree on the rubble");
  assert.equal(section.colors.lavaRockDark, "#4a3229", "blake wins the darker half on argument");
  assert.equal(section.colors.mullion, "#2f3134");
  assert.match(section.colorSources.mullion.source, /UNDER PROTEST/,
    "mullion is a pragmatic call and the file must say so");
  assert.match(section.colorSources.mullion.source, /no evidential weight/i);

  assert.ok(luma(section.colors.precast) > 170, "the repaint precast reads WHITE");
  assert.equal(section.colorSources.precast.tier, "estimated",
    "the borrowed Argo whites must be tiered estimated now that the premise is refuted");
  assert.match(section.colorSources.precast.source, /borrow/i);
  assert.equal(section.colors.membraneBase, "#ebf0ee", "the membrane is the ortho's cool white");
  assert.equal(section.colorSources.membraneBase.tier, "measured");
  assert.equal(section.colors.screenCream, "#b6af9b", "the re-verified adjudication sample");
  assert.ok(luma(section.colors.lavaRock) < 120, "the lava rock is dark volcanic rubble");
  assert.equal(section.colorSources.courtConcrete.tier, "measured");
  assert.match(section.colorSources.courtConcrete.source, /grey-referenc/i,
    "the court concrete's white balance and its assumption must be stated");
  /* And no hex may leak into the builder. */
  assert.equal(moduleSrc.match(/#[0-9a-fA-F]{6}\b/g), null,
    "a colour literal leaked into the builder — colours are the section's");
});

test("estimates name the ladder that failed, and reads carry a tolerance", () => {
  assert.ok(Object.keys(section.estimates).length >= 5);
  /* BASELINE CHANGE, with its reason: the ladder used to be checked on a bare
     prose string; estimates are objects now (S1(ii)) so the ladder lives in
     `why` and the checkable half lives beside it in `band`. */
  assert.match(section.estimates["wellFace.bayModule"].why, /Street View/i,
    "the ladder must be recorded rung by rung");
  assert.match(section.estimates["wellFace.bayModule"].why, /SAME BUILDING/i,
    "an estimate may only extend the same building's own sourced pattern");
  assert.ok(Object.keys(section.reads).length >= 4);
  for (const [k, v] of Object.entries(section.reads)) {
    assert.match(v, /toleranc|\+\/-|GRAZES|resolution limit/i, `read ${k} carries no tolerance`);
  }
});

test("conflicts are declared with both sides, never averaged", () => {
  assert.ok(section.conflicts.length >= 7, `only ${section.conflicts.length} conflicts declared`);
  const keys = section.conflicts.map((c) => c.key);
  for (const must of ["flat-topped-mass", "blake-year", "band-fractions", "membrane-tone",
    "court-palette", "court-epoch", "lava-height"]) {
    assert.ok(keys.includes(must), `conflict ${must} is not declared`);
  }
  for (const c of section.conflicts) {
    assert.ok(c.what && c.what.length > 60, `conflict ${c.key} does not say what it is about`);
    assert.ok(Array.isArray(c.sides) && c.sides.length >= 2, `conflict ${c.key} has fewer than two sides`);
    for (const s of c.sides) assert.ok(s.length > 40, `conflict ${c.key} has a stub side`);
    assert.ok(c.resolution && c.resolution.length > 60, `conflict ${c.key} is unresolved on the record`);
  }
  const year = section.conflicts.find((c) => c.key === "blake-year");
  assert.match(year.sides.join(" "), /1967/);
  assert.match(year.sides.join(" "), /1968/);
  assert.match(year.resolution, /NOT AVERAGED|not averaged/i);
  const palette = section.conflicts.find((c) => c.key === "court-palette");
  assert.match(palette.sides.join(" "), /#2e333b/, "the retired shadow hexes must stay legible");
});

/* S1(v). `absent` was gated by LIST LENGTH, which cannot tell a withdrawal from
   a deletion: the audit deleted absent[2] — the entire north/east/west bay-count
   declaration — and 26 tests passed. Every entry now has a stable key here and
   a probe that holds its content, so an entry may only leave by being BUILT
   (said so here, in `built`) or by being claimed in a sibling's absent list.
   BASELINE CHANGE: the eight keyword `assert.match`es over the joined list are
   replaced by 29 per-entry probes, because a keyword match cannot notice which
   entry it matched. */
const ABSENT_KEYS = [
  ["courtyard-interior-retired", /^RETIRED — see superseded/],
  ["level4-volume", /^The Level 4 VOLUME/],
  ["bay-counts-north-east-west", /^Bay counts on the NORTH/],
  ["wellface-bay-count", /^The WELL-FACE bay count/],
  ["court-floor-datum", /^The COURT FLOOR DATUM/],
  ["breezeway", /^The BREEZEWAY/],
  ["trellises", /^The two TRELLIS/],
  ["level4-setback-east-west", /^The Level 4 set-back/],
  ["roof-terrace-guard", /^The ROOF-TERRACE GUARD/],
  ["courtyard-planting-2026", /^The COURTYARD PLANTING/],
  ["water-feature", /^The WATER FEATURE/],
  ["gallery-walkway-depth", /^The GALLERY WALKWAY DEPTH/],
  ["signage-text", /^'Blake Hall' parapet lettering/],
  ["movable-court-furniture", /^Movable court furniture/],
  ["north-slope-planting", /^North-slope Torrey pines/],
  ["machining-dumpsters", /^The dumpsters and loading dock/],
  ["roof-equipment-heights", /^Roof equipment HEIGHTS/],
  ["lamp-posts", /^Lamp posts\./],
  ["blake-service-specifics", /^Blake own loading/],
  ["bike-racks", /^Bike racks/],
  ["lava-wall-end-wraps", /^The lava wall's END WRAPS/],
  ["terrace-deck", /^The RAISED TERRACE DECK/],
  ["colonnade-shop-layout", /^The COLONNADE's per-bay SHOP LAYOUT/],
  ["roof-coping", /^The ROOF COPING as geometry/],
  ["roof-screen-geometry", /^The ROOF MECHANICAL SCREEN as geometry/],
  ["roof-vent-geometry", /^The twelve ROOF VENTS as geometry/],
  ["colour-column", /^Blake's PRECAST COLUMN COLOUR/],
  ["colour-parapet", /^Blake's PARAPET BAND COLOUR/],
  ["colour-precast-ambient", /^Blake's AMBIENT PRECAST COLOUR/],
  ["colour-spandrel", /^Blake's SPANDREL COLOUR/],
  ["colour-window-frosted", /^Blake's FROSTED GLAZING COLOUR/],
];
const ABSENT_EXPECTED = {
  "courtyard-interior-retired": /absent lists do not shrink/,
  "level4-volume": /three metres inside a solid mass|nine|invisible and intersecting/i,
  "bay-counts-north-east-west": /Every rung fails/,
  "wellface-bay-count": /no orthographic view of a well face/i,
  "court-floor-datum": /surfaceAt/,
  breezeway: /its plan position is given by nothing/i,
  trellises: /LEVEL unresolved/i,
  "level4-setback-east-west": /registration tolerance/i,
  "roof-terrace-guard": /picket guardrail/i,
  "courtyard-planting-2026": /twelve years newer/i,
  "water-feature": /a plan read out of a shadow is not a plan/i,
  "gallery-walkway-depth": /does not project a deck/i,
  "signage-text": /two rooms on two levels/i,
  "movable-court-furniture": /umbrella/i,
  "north-slope-planting": /landscape\/LiDAR-owned/i,
  "machining-dumpsters": /Machining/,
  "roof-equipment-heights": /no oblique of this roof exists/i,
  "lamp-posts": /PLAZA section/i,
  "blake-service-specifics": /ladder is exhausted/i,
  "bike-racks": /no measured plan positions/i,
  "lava-wall-end-wraps": /wraps at both ends/i,
  "terrace-deck": /flat to 0\.05 m|nothing to stand on/i,
  "colonnade-shop-layout": /Every rung fails/,
  "roof-coping": /above the MEASURED LiDAR maximum/i,
  "roof-screen-geometry": /2\.51 m above the measured LiDAR maximum|THE FRAMES THAT WOULD SETTLE IT/i,
  "roof-vent-geometry": /nowhere below the anchor to seat them/i,
  "colour-column": /only frame of the ground colonnade is _67/i,
  "colour-parapet": /#dfd8d5/,
  "colour-precast-ambient": /no sample of a shaded precast face/i,
  "colour-spandrel": /#e0d8d4/,
  "colour-window-frosted": /#c7c9c4/,
};

test("the absent list does not shrink, PER ENTRY, and absent[1] is retired via superseded", () => {
  assert.ok(section.absent.length >= 29, `absent shrank to ${section.absent.length}`);
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
  assertAbsentEntries({
    absent: keyed, expected: ABSENT_EXPECTED, built: {}, label: "blake absent",
  });
  /* Retirement is by supersession, never by deletion. */
  const rec = section.superseded["absent#1"];
  assert.ok(rec, "absent[1]'s retirement record is missing");
  assert.ok(section.absent[0].includes(rec.retired),
    "the retired entry must still be carried VERBATIM inside absent[] — the list does not shrink");
  assert.ok(rec.by.includes("blake.system.wellFace") && rec.by.includes("blake.court"),
    "the record must name what supersedes it");
  assert.ok(rec.why.length > 100 && /_3|_25/.test(rec.why), "and the evidence that retired it");
  assert.match(rec.date, /^\d{4}-\d{2}-\d{2}$/);
  const lava = section.superseded["revelle.lavaWalls#30-44"];
  assert.ok(lava, "the duplicated lava wall adjudication must be recorded");
  assert.ok(lava.by.includes("blake.ground.south.lavaWall"));
  assert.match(lava.why, /college-wide default|COLLEGE-WIDE DEFAULT/i,
    "the reason revelle's figures lose must be the record, not just the verdict");
  assert.match(lava.why, /30 PLAZA SEGMENTS|remaining 30/i,
    "the adjudication must say what it does NOT cover");
});

/* S2. `sup` reads as a transfer whether the object moved to the named successor
   or was deleted on evidence, and only the prose could tell the two apart. The
   revelle suite cannot detect a declared successor that has stopped shipping the
   object — deleting york.westGround.racks passes it today — and blake's lava
   wall is the one two-sided retirement in the batch, so it is the pattern. Blake
   is the SUCCESSOR in both of its records, so blake's own BUILT counts are the
   reciprocal: if blake stops shipping the wall or the gallery, the claim fails
   here rather than nowhere. */
test("S2: every retirement declares its disposition and is honoured by what actually builds", () => {
  const { counts } = build();
  const S = section.superseded;
  assert.match(section.supersededNote, /machine-readable/i,
    "the section must say the disposition is a field and not a reading of the prose");
  for (const [key, rec] of Object.entries(S)) {
    assert.ok(rec.disposition, `superseded[${key}] carries no disposition`);
    assert.ok(rec.claims && rec.claims.length > 20, `superseded[${key}] does not say what it claims`);
    assert.ok(Array.isArray(rec.ships) && rec.ships.length > 0,
      `superseded[${key}] names nothing that ships the object`);
  }
  assertDispositions({
    label: "blake",
    items: Object.entries(S).map(([key, rec]) => ({
      key, disposition: rec.disposition, sup: ["blake"], detail: rec.why,
    })),
    reciprocals: {
      "blake:revelle.lavaWalls#30-44": {
        ships: counts.lavaRocks > 0,
        count: S["revelle.lavaWalls#30-44"].count,
        countChange: S["revelle.lavaWalls#30-44"].countChange,
      },
      "blake:absent#1": {
        ships: counts.wellFaces > 0 && counts.wellPickets > 0 && counts.courtPalms > 0,
        count: S["absent#1"].count,
      },
    },
  });
  /* The lava wall's count change is a NUMBER, not only prose: 15 retired
     revelle segments become ONE blake run. */
  const lava = S["revelle.lavaWalls#30-44"];
  assert.equal(lava.countChange, true);
  assert.equal(lava.count, 1, "blake ships one continuous run in place of 15 segments");
  assert.match(lava.countNote, /15 -> 1|15 retired/,
    "the reduction must be stated as a count, not left in supersededDetail prose");
  assert.equal(S["absent#1"].count, counts.wellFaces,
    "absent#1 claims the courtyard interior and its count must be what blake actually dresses");
});

test("the signage is recorded, not rendered", () => {
  assert.equal(section.signage.built, false);
  assert.equal(section.signage.text, "Blake Hall");
  assert.ok(section.signage.capHeight > argo.signage.capHeight,
    "Blake's lettering is the larger of the two [measured]");
  assert.match(section.signage.note, /level 4 LOUNGE|chartreuse/i,
    "the well faces' level graphics are recorded here too");
});

/* ------------------------------------------- the module, actually running */

const flat = () => 20;
const slope = (x, z) => 20 + 1.2 * Math.sin(x / 14) + 0.9 * Math.cos(z / 17);
const build = (g = flat) => createPhotoBlake(null, { photo: { blake: section }, heightAt: g, surfaceAt: g });

test("the module builds the section, and the counts are the declared ones", () => {
  const { group, counts } = build();
  assert.ok(Object.keys(section.counts).length >= 12,
    "the section must declare its counts so the build can be held to them");
  for (const [k, v] of Object.entries(section.counts)) {
    if (k === "note") continue;
    assert.equal(counts[k], v, `count ${k}: built ${counts[k]}, declared ${v}`);
  }
  assert.equal(counts.windows, 3 * 2 * 30 + 1,
    "a glazed panel per bay on the three panel faces, one grid field on the east");
  assert.equal(counts.awnings, 3 * 2 * 30, "a full-width sash under every panel");
  assert.equal(counts.fins, 3 * 2 * 31, "fins on every bay boundary of the panel faces");
  assert.equal(counts.pv, undefined, "the misread PV array must not come back");
  /* BASELINE CHANGE, and the reason: `counts.vents === roof.vents.items.length`
     asserted that every measured vent BUILDS. Under the LiDAR-anchor ruling
     (R2 item B2) the vent geometry is withheld, so the count must be gone —
     not zero, gone, because a zero count reads as a build that produced
     nothing rather than as a withholding. Same for the screen's blocks. */
  assert.equal(counts.vents, undefined, "the vent geometry is withheld — see roof.anchorGate");
  assert.equal(counts.screenBlocks, undefined, "the mechanical screen's geometry is withheld too");
  assert.equal(counts.courtPalms, section.court.palms.length);
  /* R2 item B4/(7)+(8), which are ONE bug with opposite signs: the solid
     stair/lift core was treated as a void when the facade was dressed (12
     glazed room doors and 12 room windows on a 3.0 x 2.9 m core nothing
     photographs) and as a void again when the membrane was cut (a 3.0 x 2.9 m
     hole in a roof the section calls one plane). Gated together here so a fix
     to one cannot move the error into the other: the notch rectangle is read
     from ONE place and both sides are asserted against the same numbers. */
  const N = {
    x0: section.derivations.readings.survey.notchX0, x1: section.derivations.readings.survey.notchX1,
    z0: section.derivations.readings.survey.notchZ0, z1: section.derivations.readings.survey.notchZ1,
  };
  const coreFaces = section.measured.courtyardRing.slice(0, -1).filter((p, i, r) => {
    const q = r[(i + 1) % r.length];
    const on = (v) => v[0] >= N.x0 - 0.15 && v[0] <= N.x1 + 0.15 && v[1] >= N.z0 - 0.15 && v[1] <= N.z1 + 0.15;
    return on(p) && on(q);
  }).length;
  assert.equal(coreFaces, 3, "the core notch is three faces of the drawn well ring");
  const ringPts = section.measured.courtyardRing.slice(0, -1);
  const onCore = (v) => v[0] >= N.x0 - 0.15 && v[0] <= N.x1 + 0.15 && v[1] >= N.z0 - 0.15 && v[1] <= N.z1 + 0.15;
  let dressedBays = 0;
  let coreBays = 0;
  for (let i = 0; i < ringPts.length; i++) {
    const a = ringPts[i];
    const b = ringPts[(i + 1) % ringPts.length];
    const bays = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / section.system.wellFace.bayModule));
    if (onCore(a) && onCore(b)) coreBays += bays; else dressedBays += bays;
  }
  assert.equal(coreBays, 3, "one bay per core face is what the shipped build was dressing onto the solid core");
  assert.equal(counts.wellDoors, dressedBays * section.system.wellFace.levels.length,
    "the three core-notch faces must carry NO room bay — the core is solid and nothing photographs it");
  assert.equal(counts.wellWindows, counts.wellDoors, "a window beside every door, and none on the core");
  /* B4 / audit-blake Major 4: the shipped bay is PER FACE and the count follows
     the declared table, not the 3.75 nominal. */
  assert.equal(dressedBays,
    section.system.wellFace.faceBays.filter((f) => !f.core).reduce((n, f) => n + f.bays, 0),
    "the bay count must follow the DECLARED per-face table, not a re-fit at the point of use");
  assert.equal(counts.membraneBands, 5,
    "four bands round the OPEN well plus a fifth over the SOLID core — the notch is inside the court rectangle the other four are cut against");
  /* And the membrane's fifth band really covers the notch, on the drawn plane. */
  const { group: g2 } = build();
  g2.updateMatrixWorld(true);
  const cx = (N.x0 + N.x1) / 2;
  const cz = (N.z0 + N.z1) / 2;
  let covered = false;
  each(g2.children.find((c) => c.name === "blake-roof"), (e) => {
    if (e.name !== "membrane-band") return;
    if (e.xLo <= cx && e.xHi >= cx && e.zLo <= cz && e.zHi >= cz) covered = true;
  });
  assert.ok(covered, "the roof over the solid core carries no membrane — the raw massing shows through");
  assert.equal(counts.wellFaces, section.measured.courtyardRing.length - 1,
    "every segment of the drawn well ring is a dressed face, the core notch's three included");
  assert.ok(counts.wellDoors > 0 && counts.wellWindows > 0 && counts.wellPickets > 500,
    "the sourced gallery system is not built");
  assert.ok(counts.lavaRocks > 100, "the rubble wall is built from rocks, not a slab");
  for (const name of ["blake-facades", "blake-roof", "blake-court", "blake-ground"]) {
    assert.ok(group.children.find((c) => c.name === name), `no ${name} group`);
  }
  const missing = createPhotoBlake(null, { photo: {}, heightAt: flat, surfaceAt: flat });
  assert.deepEqual(missing.counts, {}, "a missing section builds nothing and breaks nothing");
  assert.throws(() => createPhotoBlake(null, { photo: { blake: section } }), /surfaceAt/,
    "a missing sampler must be loud, not silent");
  /* A PARTIAL merge must be loud too. The pre-R1 section describes a building
     with a lid over its courtyard; half-building it would ship a Blake with a
     hole where its court is and nothing on screen to say so. */
  const preR1 = { ...section };
  delete preR1.court;
  assert.throws(() => createPhotoBlake(null, { photo: { blake: preR1 }, surfaceAt: flat }),
    /pre-R1|merge/i, "a pre-R1 section must fail loudly rather than build half a Blake");
});

/** Every placement's TRUE world-space extent — the geometry's own bounding box
 *  pushed through its matrix, not the instance scale, because a rotated plane
 *  decal has scale 1 in y and no thickness at all, and a mesh whose vertices
 *  carry absolute coordinates sits at the origin. Both of those hid real
 *  answers behind a position-and-scale read. */
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
        x: (box.min.x + box.max.x) / 2, z: (box.min.z + box.max.z) / 2,
        y: (box.min.y + box.max.y) / 2,
        xLo: box.min.x, xHi: box.max.x, yLo: box.min.y, yHi: box.max.y,
        zLo: box.min.z, zHi: box.max.z, mesh: o, name: o.name,
      });
    }
  });
}

test("the facade seats on campus-massing's own roof elevation, over rolling ground", () => {
  const { group } = build(slope);
  group.updateMatrixWorld(true);
  const roofY = roofElevation(section.measured.ring, section.measured.lidarHeight, slope);
  const baseY = roofY - section.measured.lidarHeight;

  let checked = 0;
  let maxTop = -Infinity;
  let columns = 0;
  let parapetTop = -Infinity;
  each(group.children.find((c) => c.name === "blake-facades"), (e) => {
    if (e.name === "ground-columns" || e.name === "ground-recess" || e.name === "storefront-mullions") {
      const g = slope(e.x, e.z);
      assert.ok(e.yLo <= g + 0.01,
        `${e.name} bottom ${e.yLo.toFixed(2)} floats over the drawn surface ${g.toFixed(2)}`);
      assert.ok(e.yLo >= baseY - 4, `${e.name} plunges to ${e.yLo.toFixed(2)} — a runaway skirt`);
      if (e.name === "ground-columns") columns++;
    } else {
      assert.ok(e.y >= baseY - 0.1, `a facade element sits at y=${e.y.toFixed(2)}, under the base`);
    }
    assert.ok(e.y <= roofY + 0.1, `a facade element floats at y=${e.y.toFixed(2)}, over the measured top`);
    if (e.name === "outer-parapet") parapetTop = Math.max(parapetTop, e.yHi);
    maxTop = Math.max(maxTop, e.yHi);
    checked++;
  });
  assert.ok(columns >= 4 * 8, `only ${columns} columns seated — the colonnade check did not run`);
  near(maxTop, roofY, 0.05, "the facade top is not campus-massing's roof elevation");
  /* THE R1 CLAIM, GATED: the outer parapet stops at the MEASURED 10.59 m and
     the band above it is the survey overshoot, not more building. */
  near(parapetTop, baseY + section.grid.parapetTop, 0.02,
    "the outer parapet no longer tops out at the measured parapetTop");
  assert.ok(roofY - parapetTop > 1.5,
    "the Level 4 roof slab must stand proud of the parapet, which is the whole R1 height finding");
  assert.ok(checked > 800, `only ${checked} placements checked — the facade loops did not run`);
});

test("the court floor IS the drawn surface, and nothing in the court hovers or sinks", () => {
  for (const [label, ground] of [["flat", flat], ["slope", slope], ["drawn", drawnGround]]) {
    const r = build(ground);
    r.group.updateMatrixWorld(true);
    const lift = overlayLift(section.draw.courtRung);
    const seat = (x, z) => ground(x, z) + lift;
    const court = r.group.children.find((c) => c.name === "blake-court");
    const floor = court.children.find((c) => c.name === "court-floor");
    assert.ok(floor, `${label}: no court floor`);
    /* Every floor vertex is its own local drawn surface plus the rung — not
       one plane sampled at the middle, which is what hovers on a slope. */
    const pos = floor.geometry.getAttribute("position");
    let n = 0;
    for (let i = 0; i < pos.count; i++) {
      near(pos.getY(i), seat(pos.getX(i), pos.getZ(i)), 1e-4,
        `${label}: court floor vertex ${i} is not on the drawn surface`);
      n++;
    }
    assert.ok(n > 200, `${label}: the court floor is not tessellated (${n} vertices)`);

    /* Palms, boulders and beds all sit on that one datum. */
    /* Palms, boulders and beds all sit on that one datum, and the cladding
       skirt reaches down to it. Only a boulder may break the plane, by the
       fraction of its own radius the section declares it is bedded into. */
    const bury = section.draw.boulderBury;
    const roofY = roofElevation(section.measured.ring, section.measured.lidarHeight, ground);
    each(court, (e) => {
      if (e.mesh === floor) return;
      const s = seat(e.x, e.z);
      if (e.name === "court-bed") {
        near(e.y, ground(e.x, e.z) + overlayLift(section.draw.bedRung), 1e-6,
          `${label}: a bed is off its rung`);
      }
      if (e.name === "well-cladding") {
        /* The cladding is a SKIRT, like the outer colonnade's: it reaches down
           past the lowest floor under its own face so a rolling surface cannot
           open a gap at its foot. Gate it the same way — never hovering, never
           running away. */
        assert.ok(e.yLo <= s + 0.01,
          `${label}: the well cladding hovers at ${e.yLo.toFixed(2)} over a floor at ${s.toFixed(2)}`);
        assert.ok(e.yLo >= s - 4, `${label}: the well cladding skirt runs away to ${e.yLo.toFixed(2)}`);
      } else {
        assert.ok(e.yLo >= s - Math.max(0.15, bury * 1.3),
          `${label}: ${e.name || "something"} in the court sinks to ${e.yLo.toFixed(2)} under a floor at ${s.toFixed(2)}`);
      }
      assert.ok(e.xLo >= section.bounds.x0 && e.xHi <= section.bounds.x1
        && e.zLo >= section.bounds.z0 && e.zHi <= section.bounds.z1,
        `${label}: a court item at (${e.x.toFixed(1)}, ${e.z.toFixed(1)}) is outside the declared bounds`);
      /* Nothing in the court rises through the roof plane — except the palm
         crowns, which rise into the open well, which is the point. */
      if (e.name === "court-crowns") return;
      assert.ok(e.yHi <= roofY + 0.35,
        `${label}: ${e.name || "a court item"} pokes to ${e.yHi.toFixed(2)} through a ${roofY.toFixed(2)} roof`);
    });
  }
});

test("nothing the section builds leaves its declared bounds", () => {
  const r = build(slope);
  r.group.updateMatrixWorld(true);
  const B = section.bounds;
  each(r.group, (e) => {
    assert.ok(e.xLo >= B.x0 && e.xHi <= B.x1 && e.zLo >= B.z0 && e.zHi <= B.z1,
      `${e.name || "something"} spans (${e.xLo.toFixed(2)}..${e.xHi.toFixed(2)}, ${e.zLo.toFixed(2)}..${e.zHi.toFixed(2)}), outside bounds`);
  });
  /* And the bounds are not a blank cheque: they hug the survey. */
  assert.ok(B.x0 >= RING.x0 - 1 && B.x1 <= RING.x1 + 1, "the x bounds are looser than the ring warrants");
  assert.ok(B.z0 >= RING.z0 - 1, "the north bound is looser than the ring warrants");
  assert.ok(B.z1 <= section.ground.south.lavaWall.a[1] + 1,
    "the south bound is looser than the lava wall warrants");
});

/* R2 item B2 — THE ROOF-PLACEMENT CEILING IS EXTERNAL TO ITS SUBJECT.
 *
 * BASELINE CHANGE, and the reason for it in one line: the retired gate read
 * `roofY + roof.screen.enclosureHeight + roof.screen.blockHeight + 0.5`, so the
 * screen's own declared heights set the ceiling the screen was measured against
 * and it could not fail (enclosure 2 -> 9 and block 0.45 -> 3.0 passed); the
 * ceiling is now the MEASURED LiDAR maximum read from campus-lidar.json, which
 * is the repo's own authority on every height, and under it the R1 build had 65
 * placements up to +2.510 m over the anchor.
 *
 * The only allowance is `overlayLift("pad")` — the repo's declared z-fight rung
 * from campus-overlay.js, which is what makes a decal ON the drawn surface
 * visible. It is not slack: a decal is the surface, and nothing may use the
 * rung to stand something on it. The old `n > 20` placement floor goes with the
 * withheld furniture; five membrane bands is the whole roofscape now, and the
 * floor is written against that. */
test("no roof placement stands above the MEASURED LiDAR maximum for Blake", () => {
  const anchor = lidar.heights["Blake Hall"];
  near(section.roof.anchorGate.anchor, anchor, 1e-9, "the section's declared anchor");
  near(section.measured.lidarHeight, anchor, 1e-9, "the section's own height reading");
  const allowance = overlayLift("pad");
  for (const [label, ground] of [["flat", flat], ["slope", slope], ["drawn", drawnGround]]) {
    const r = build(ground);
    r.group.updateMatrixWorld(true);
    const roofY = roofElevation(section.measured.ring, anchor, ground);
    let n = 0;
    let worst = -Infinity;
    each(r.group.children.find((c) => c.name === "blake-roof"), (e) => {
      assert.ok(e.y >= roofY - 0.05, `${label}: a roof item dips to y=${e.y.toFixed(2)} into the massing`);
      worst = Math.max(worst, e.yHi - roofY);
      assert.ok(e.yHi <= roofY + allowance + 1e-6,
        `${label}: a roof item tops out ${(e.yHi - roofY).toFixed(3)} m above the measured LiDAR maximum. `
        + "Re-seat it below the anchor or withhold it and declare it in absent[] — never raise the ceiling.");
      assert.ok(!inRing(e.x, e.z, well),
        `${label}: a roof item at (${e.x.toFixed(1)}, ${e.z.toFixed(1)}) is laid over the OPEN well`);
      n++;
    });
    assert.ok(n >= 5, `${label}: only ${n} roof placements checked — the membrane did not build`);
    assert.ok(worst <= allowance + 1e-6, `${label}: worst overshoot ${worst}`);
  }
  /* And the whole section, not just the roof group: nothing anywhere may stand
     over the anchor except the court palms, which rise into the OPEN well. */
  const r = build(slope);
  r.group.updateMatrixWorld(true);
  const roofY = roofElevation(section.measured.ring, anchor, slope);
  each(r.group, (e) => {
    if (e.name === "court-crowns") return;
    assert.ok(e.yHi <= roofY + allowance + 1e-6,
      `${e.name || "something"} tops out ${(e.yHi - roofY).toFixed(3)} m above the LiDAR anchor`);
  });
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

test("the material library is on the surfaces, and only deterministic sources", () => {
  assert.match(moduleSrc, /(?:shared|create)MaterialLibrary/, "surfaces come from campus-materials.js");
  assert.ok(!/Math\.random|Date\.now|TextureLoader/.test(moduleSrc), "no nondeterminism in the builder");
  assert.match(moduleSrc, /overlayLift\(D\.courtRung\)/,
    "the court's seating rung must come from the section, not from a number of its own");
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
});

/* ------------------------------------------------- B4: the well-face bays */

/* audit-blake MAJOR 4, ruled option (a) in R2 stage 7: the per-face fit is
   legitimate — a whole number of bays against a MEASURED face length is the
   right way to bay a surveyed ring — but the section declared one 3.75 m bay
   and one 2.4292 m window and then shipped a -18.5%/+14.4% spread around them
   with nothing in the document saying so. The geometry does not move. The
   record now declares the bay per face, and this gate holds all three layers
   together: the survey ring, the declared table, and the built scene. */
test("B4 the well-face bay is declared PER FACE, and survey, record and build agree", () => {
  const W = section.system.wellFace;
  const S = section.derivations.readings.survey;
  const N = { x0: S.notchX0, x1: S.notchX1, z0: S.notchZ0, z1: S.notchZ1 };
  const onCore = (p) =>
    p[0] >= N.x0 - 0.15 && p[0] <= N.x1 + 0.15 && p[1] >= N.z0 - 0.15 && p[1] <= N.z1 + 0.15;

  /* (1) Re-derive the whole table from the SURVEY, independently of what the
     section declares, by derivations.faceBayFit's stated rule. */
  const r = section.measured.courtyardRing.slice(0, -1);
  const want = [];
  for (let i = 0; i < r.length; i++) {
    const a = r[i], b = r[(i + 1) % r.length];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < 1e-6) continue;
    if (onCore(a) && onCore(b)) { want.push({ i, length, core: true, bays: 0 }); continue; }
    const bays = Math.max(1, Math.round(length / W.bayModule));
    const bay = length / bays;
    want.push({ i, length, core: false, bays, bay, windowWidth: bay - W.doorWidth - 2 * W.boardPitch });
  }

  /* (2) The declared table IS that, exactly — same doubles, no rounding, and
     exhaustive over the ring's edges so a face cannot be quietly dropped. */
  assert.equal(W.faceBays.length, want.length,
    "faceBays must carry one entry per surveyed well-ring edge");
  for (const w of want) {
    const got = W.faceBays.find((f) => f.i === w.i);
    assert.ok(got, `faceBays has no entry for ring edge ${w.i}`);
    assert.equal(got.core, w.core, `edge ${w.i}: core flag disagrees with the survey notch`);
    assert.equal(got.length, w.length, `edge ${w.i}: declared length is not the surveyed length`);
    assert.equal(got.bays, w.bays, `edge ${w.i}: declared bay count is not the fit's`);
    if (w.core) continue;
    assert.equal(got.bay, w.bay, `edge ${w.i}: declared bay is not length/bays`);
    assert.equal(got.windowWidth, w.windowWidth, `edge ${w.i}: declared window is not bay - door - 2 boards`);
  }

  /* (3) 3.75 is the GENERATOR NOMINAL and the document must say so rather than
     present it as the shipped bay. It is not the bay of any face. */
  assert.match(W.bayModuleNote, /GENERATOR NOMINAL/,
    "bayModule must be labelled as the divisor it is, not left reading as a shipped dimension");
  assert.match(W.faceBaysNote, /THE SHIPPED BAY IS PER FACE/);
  for (const f of W.faceBays) {
    if (f.core) continue;
    assert.notEqual(f.bay, W.bayModule,
      `edge ${f.i} ships exactly the nominal — if that is real the note is wrong`);
  }

  /* (4) THE BUILT SCENE matches the declared table, face by face. Window width
     is the per-face signal: the door leaf is a product dimension and constant,
     so the bay shows up in the window and nowhere else.
     On precision: instance matrices are Float32Array, so the built width is the
     declared double quantised to single precision. EPS is that storage floor
     (a ~4 m value carries ~2.4e-7 of float32 resolution), NOT a modelling
     tolerance — it is two orders of magnitude below the 0.001 m at which any
     real change to the fit would show. */
  const EPS = 1e-5;
  const { group } = build();
  group.updateMatrixWorld(true);
  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3();
  const builtWidths = [];
  group.traverse((o) => {
    if (o.name !== "well-windows" || !o.isInstancedMesh) return;
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m);
      m.decompose(pos, quat, scl);
      builtWidths.push(scl.x);
    }
  });
  assert.ok(builtWidths.length > 0, "no well-windows instanced mesh in the built scene");

  const expected = [];
  for (const f of W.faceBays) {
    if (f.core) continue;
    for (let l = 0; l < W.levels.length; l++) {
      for (let b = 0; b < f.bays; b++) expected.push(f.windowWidth);
    }
  }
  assert.equal(builtWidths.length, expected.length,
    "the built window population is not the declared table's bays x levels");
  assert.equal(builtWidths.length, 64, "B4 must not change the shipped 64");

  const sortNum = (a, z) => a - z;
  const gotSorted = builtWidths.slice().sort(sortNum);
  const wantSorted = expected.slice().sort(sortNum);
  for (let i = 0; i < wantSorted.length; i++) {
    assert.ok(Math.abs(gotSorted[i] - wantSorted[i]) <= EPS,
      `built window ${gotSorted[i]} is not the declared ${wantSorted[i]} (float32 floor ${EPS})`);
  }
  /* And the spread is REAL and declared — five distinct widths, not one. */
  const distinct = [...new Set(W.faceBays.filter((f) => !f.core).map((f) => f.windowWidth))];
  assert.ok(distinct.length >= 4,
    "the whole point of this record is that the faces differ; a single width means the fit changed");
});

/* ------------------------------------------------------- visual round 2 */

/* R2-VIS/BLAKE-1 — THE RAISED TERRACE DECK IS WITHDRAWN, AND STAYS WITHDRAWN.
 *
 * The round-2 critic caught a green plane hanging a metre over the plaza in
 * front of the colonnade, open to daylight on three edges and cutting the
 * colonnade columns. Its cause was `ground.south.terrace`: a flat quad at one
 * sampled height plus a 1.1 m [estimated] lift, standing on terrain that has
 * no step in it to justify the lift, wearing a lawn material that _67 refutes.
 * This gate fails if the deck comes back, if its record is deleted instead of
 * declared, or if the conflict that explains it is dropped. */
test("R2-VIS: the raised terrace deck is declared, unbuilt, and draws nothing", () => {
  const T = section.ground.south.terrace;
  assert.equal(T.built, false, "the terrace deck must ship with built:false");
  for (const k of ["x0", "z0", "x1", "z1", "lift"]) {
    assert.equal(typeof T[k], "number", `the terrace's measured plan lost ${k} — withdrawing is not deleting`);
  }
  assert.match(T.note, /_67/, "the withdrawal must name the frame that refutes the lawn");
  assert.match(T.note, /flat to 0\.05 m/, "and the terrain measurement that refutes the lift");

  const step = section.conflicts.find((c) => c.key === "terrace-step");
  assert.ok(step, "the grade-step conflict must be declared, not resolved by silence");
  assert.equal(step.sides.length, 2, "a conflict with fewer than two sides is a verdict");
  assert.match(step.resolution, /NOT AVERAGED|not averaged/, "and it must not be averaged");
  assert.match(section.absent.join("\n"), /The RAISED TERRACE DECK/, "and declared absent");

  /* And the flat drawn terrain the withdrawal rests on is checked here rather
     than quoted: if a future LiDAR rebuild puts a real step across the wall's
     line, this fails and the withdrawal gets re-argued. */
  const zw = section.ground.south.lavaWall.a[1];
  let lo = Infinity;
  let hi = -Infinity;
  for (let x = -56; x <= -20; x += 1) {
    const g = drawnGround(x, zw);
    lo = Math.min(lo, g);
    hi = Math.max(hi, g);
  }
  assert.ok(hi - lo <= 0.1,
    `the drawn terrain along the wall now falls ${(hi - lo).toFixed(2)} m — the terrace withdrawal must be re-argued`);

  /* Nothing named for the lawn is built, on any surface. */
  for (const g of [flat, slope, drawnGround]) {
    const r = build(g);
    let found = 0;
    r.group.traverse((o) => { if (o.name === "terrace-lawn") found++; });
    assert.equal(found, 0, "the terrace lawn is being drawn again");
  }
});

/* R2-VIS/BLAKE-2 — THE WALL IS NOT ONE HEIGHT.
 *
 * The section has always said in prose that the wall is a retaining wall on
 * falling ground whose exposed face nearly doubles eastward, and has always
 * drawn one scalar. `profile` puts the three measured stations on the
 * geometry. This gate recomputes the profile from the DERIVATIONS and then
 * measures the BUILT rock tops against it, so flattening the wall back to a
 * scalar — or inventing a profile that is not the stations — fails. */
test("R2-VIS: the lava wall carries its measured non-uniformity onto the geometry", () => {
  const L = section.ground.south.lavaWall;
  const P = L.profile;
  const F = section.derivations.figures;
  assert.ok(P && Array.isArray(P.stations) && P.stations.length === 3, "the wall needs its three stations");
  const st = P.stations.map((s) => ({ u: s.u, h: F[s.figure].value }));
  near(st[0].h, F["lavaWall.exposedWest"].value, 1e-9, "west station");
  near(st[1].u, P.knee, 1e-9, "the middle station sits at the declared knee");
  near(st[2].u, 1, 1e-9, "the east station is the east end");
  /* The east end is the whole point: past 2.2 m of exposed face, as the
     section's own prose has claimed since R1. */
  assert.ok(st[2].h - st[0].h > 0.9,
    `the eastern rise collapsed to ${(st[2].h - st[0].h).toFixed(2)} m — the wall is uniform again`);

  const want = (u) => {
    const t = u / Math.hypot(L.b[0] - L.a[0], L.b[1] - L.a[1]);
    for (let i = 1; i < st.length; i++) {
      if (t <= st[i].u) return L.height + (st[i - 1].h + ((st[i].h - st[i - 1].h) * (t - st[i - 1].u)) / (st[i].u - st[i - 1].u)) - st[0].h;
    }
    return L.height + st[st.length - 1].h - st[0].h;
  };

  const r = build(flat);
  r.group.updateMatrixWorld(true);
  const tops = new Map();
  each(r.group.children.find((c) => c.name === "blake-ground"), (e) => {
    const u = Math.hypot(e.x - L.a[0], e.z - L.a[1]);
    const key = Math.round(u);
    tops.set(key, Math.max(tops.get(key) ?? -Infinity, e.yHi));
  });
  assert.ok(tops.size > 25, `only ${tops.size} stations of wall were measured — the walk did not run`);
  let worst = 0;
  for (const [u, top] of tops) {
    /* The top row's box is 1.2x its own row height, so a row-tall overshoot is
       the geometry and not a drift; what this catches is a wall that ignores
       its profile, which is metres out, not centimetres. */
    const expect = flat() + want(u) * (1 + 0.2 / L.rows);
    worst = Math.max(worst, Math.abs(top - expect));
  }
  assert.ok(worst < 0.2, `the built wall departs from its own profile by ${worst.toFixed(2)} m`);
  /* And the two ends genuinely differ, which a scalar wall cannot do. */
  const east = tops.get(29);
  const west = tops.get(1);
  assert.ok(east - west > 0.8,
    `the built wall rises only ${(east - west).toFixed(2)} m west to east — it is still a scalar`);
});

/* R2-VIS/BLAKE-3 — NO CANOPY GROWS INTO THE BUILDING.
 *
 * Round-2 minor: palm canopies interpenetrating the gallery slab on the well's
 * west side. The crowns' measured centres and radii are untouched; the DRAWN
 * cone is clipped to the well the massing opens. Gate both halves — the clip
 * must happen, and it must never make a crown BIGGER than its measurement. */
test("R2-VIS: palm crowns are clipped to the drawn well and never exceed their measurement", () => {
  const ring = section.measured.courtyardRing;
  const clear = section.draw.crownClear;
  assert.ok(clear > section.draw.wellFaceProud,
    "the crown clearance must clear the cladding face, not just the ring chord");
  const dist = (px, pz) => {
    let best = Infinity;
    for (let i = 1; i < ring.length; i++) {
      const [ax, az] = ring[i - 1];
      const [bx, bz] = ring[i];
      const dx = bx - ax;
      const dz = bz - az;
      const l2 = dx * dx + dz * dz;
      const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0;
      best = Math.min(best, Math.hypot(px - (ax + t * dx), pz - (az + t * dz)));
    }
    return best;
  };
  /* The clip has to BITE, or it is decoration: at least one measured crown is
     wider than the room the drawn well leaves it. */
  const bitten = section.court.palms.filter((p) => p.radius > dist(p.x, p.z) - clear);
  assert.ok(bitten.length >= 1, "no measured crown overruns the well — this gate has stopped testing anything");

  const r = build(drawnGround);
  r.group.updateMatrixWorld(true);
  const court = r.group.children.find((c) => c.name === "blake-court");
  const crowns = [];
  each(court, (e) => { if (e.name === "court-crowns") crowns.push(e); });
  assert.equal(crowns.length, section.court.palms.length, "a crown went missing");
  for (const e of crowns) {
    const p = section.court.palms.reduce((a, b) =>
      Math.hypot(b.x - e.x, b.z - e.z) < Math.hypot(a.x - e.x, a.z - e.z) ? b : a);
    const drawn = Math.max(e.xHi - e.xLo, e.zHi - e.zLo) / 2;
    assert.ok(drawn <= p.radius + 1e-6,
      `crown ${p.key} draws at ${drawn.toFixed(2)} m, wider than its measured ${p.radius} m`);
    assert.ok(drawn <= dist(p.x, p.z) - clear + 1e-6,
      `crown ${p.key} at ${drawn.toFixed(2)} m still reaches into the drawn well face`);
  }
});

/* R2-VIS/BLAKE-4 — THE STOREFRONT RHYTHM IS THE FACADE'S, NOT AN INVENTED ONE.
 *
 * Round-2 minor: the colonnade read as one flat panel. _67 resolves that the
 * storefront behind it is divided on the SAME module as the facade above, and
 * nothing more, so that is what is built. This gate fails if the mullions
 * disappear, if they acquire a pitch of their own, or if the shop layout the
 * section declares absent is quietly invented. */
test("R2-VIS: the colonnade carries the sourced storefront rhythm and no invented layout", () => {
  const SF = section.system.ground.storefront;
  assert.ok(SF, "the storefront block is gone");
  near(SF.mullionWidth, section.derivations.figures["system.ground.storefrontMullion"].value, 1e-9,
    "the mullion face drifted from its stock-size derivation");
  assert.equal(SF.pitchBays, 1, "one mullion per bay boundary is what the read supports");
  assert.match(section.reads["ground.storefront.mullionPitch"], /tolerance/,
    "the pitch is a read and must carry its tolerance");
  assert.match(section.absent.join("\n"), /per-bay SHOP LAYOUT/,
    "the layout the source does not resolve must stay declared absent");
  assert.equal(section.signage.built, false, "no lettering: that limitation is unchanged");

  const r = build(drawnGround);
  const built = r.counts.groundMullions;
  const want = section.facades.length
    * (Math.floor((section.grid.longFaceBays - 2 * SF.skipEnds) / SF.pitchBays) + 1);
  assert.equal(built, want, "the mullion count is not the declared rhythm over the declared bays");
  assert.equal(built, section.counts.groundMullions, "declared and built mullion counts disagree");

  /* On the bay boundaries, which is where a mullion is — never on a column,
     which is what a bay CENTRE carries. */
  r.group.updateMatrixWorld(true);
  const south = section.facades.find((f) => f.id === "south");
  const module = Math.hypot(south.b[0] - south.a[0], south.b[1] - south.a[1]) / section.grid.longFaceBays;
  let onSouth = 0;
  each(r.group.children.find((c) => c.name === "blake-facades"), (e) => {
    if (e.name !== "storefront-mullions") return;
    if (Math.abs(e.z - 353.5) > 1.5) return;
    const len = Math.hypot(south.b[0] - south.a[0], south.b[1] - south.a[1]);
    const tx = (south.b[0] - south.a[0]) / len;
    const tz = (south.b[1] - south.a[1]) / len;
    const u = (e.x - south.a[0]) * tx + (e.z - south.a[1]) * tz;
    /* The corner mullions of the east and west faces also come within 1.5 m of
       the south chord; they belong to their own faces and are checked there. */
    if (u < 0.5 || u > len - 0.5) return;
    const frac = (u / module) % 1;
    assert.ok(Math.min(frac, 1 - frac) < 0.02,
      `a storefront mullion sits at ${frac.toFixed(3)} of a bay — off the measured module`);
    onSouth++;
  });
  assert.ok(onSouth >= section.grid.longFaceBays - 2,
    `only ${onSouth} mullions on the sourced south face`);
});
