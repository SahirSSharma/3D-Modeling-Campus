/* Tata Hall for the Sciences — the INVENTED class, at the ultra standard.
 *
 * The Eighth audit proved that presence gates pass on wholesale fabricated
 * values, so almost nothing here merely checks that a key exists. Every drawn
 * figure is recomputed INDEPENDENTLY from the section's own readings and must
 * match; every drawn number must be covered by a derivation, a banded estimate
 * that names the pattern it extends, or a cited read; the surveyed ring must
 * be byte-identical to the survey; and the geometry is rebuilt on flat ground,
 * on an exaggerated slope and on the REAL drawn LiDAR surface with nothing
 * hovering and nothing sinking.
 *
 * The section-level claims this file exists to hold Tata to:
 *
 *   - NO FIGURE IN THIS SECTION CITES LiDAR FOR A HEIGHT. The 2014 flight saw
 *     a lawn. There is an explicit gate for this and it walks every expression
 *     in the derivation table, not just the ones anybody remembered.
 *   - the height chain closes on the CCC's stated 100 ft to the millimetre,
 *     from GB7's storey count and two drawn spot elevations, with nothing
 *     tuned;
 *   - the storey conflict is settled 2-1 and Emeriti's eight is the loser;
 *   - the six face sets PARTITION the survey ring's edges, so no face the
 *     survey draws can ship as bare shell;
 *   - the fin is a GRATING at a MEASURED pitch, and the pitch is a read with a
 *     tolerance rather than a count divided by an assumption;
 *   - Level 1 is buried by a wrong-epoch terrain and that is left standing;
 *   - the absent list does not shrink, and retired dossier conclusions leave
 *     through superseded[], never by deletion.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as THREE from "../docs/vendor/three/three.module.min.js";
/* S1 — the axiom-layer gate. ONE shared apparatus; this file must never fork
   or reimplement it. */
import {
  assertCoverage, assertEstimateBands, assertPins, assertRelations, assertTierSymmetry,
  assertAbsentEntries, assertExprs,
} from "./helpers/axiom-gate.mjs";
import { createPhotoTata } from "../docs/js/campus-photo-tata.js";
import { roofElevation } from "../docs/js/campus-massing.js";
import { makeSurfaceSampler } from "../docs/js/campus-terrain.js";
import { overlayLift } from "../docs/js/campus-overlay.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(p, "utf8"));

/* PHOTO_DETAIL still lets a repair agent point the whole file at a candidate. */
const section = process.env.PHOTO_DETAIL
  ? read(process.env.PHOTO_DETAIL).tata
  : read(join(root, "docs/data/campus-photo-detail.json")).tata;

const lidar = read(join(root, "docs/data/campus-lidar.json"));
const arcgis = read(join(root, "docs/data/campus-arcgis.json"));
const campus = read(join(root, "docs/data/campus-3d.json"));
const drawnGround = makeSurfaceSampler(lidar.terrain);
const moduleSrc = readFileSync(join(root, "docs/js/campus-photo-tata.js"), "utf8");

const MASS_INDEX = 244;
const MASSING = arcgis.massing[MASS_INDEX];
const ring0 = MASSING.r[0].map(([x, z]) => [x / 10, z / 10]);

const seg = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const at = (o, path) => path.split(".").reduce((v, k) => (v == null ? v : v[k]), o);
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

/* An INDEPENDENT mirror of the module's ring walk: every non-degenerate edge
   of the SHIPPED SURVEY, with the outward normal the ring's own winding gives
   it. Everything about the faces derives from this rather than from the
   section's own face lengths. */
function surveyEdges() {
  let a = 0;
  for (let i = 0; i < ring0.length - 1; i++) {
    a += ring0[i][0] * ring0[i + 1][1] - ring0[i + 1][0] * ring0[i][1];
  }
  const s = a > 0 ? 1 : -1;
  const out = [];
  for (let k = 0; k < ring0.length - 1; k++) {
    const [ax, az] = ring0[k];
    const [bx, bz] = ring0[k + 1];
    const L = seg([ax, az], [bx, bz]);
    if (!(L > 0)) continue;
    out.push({ k, a: [ax, az], b: [bx, bz], length: L, nx: (s * (bz - az)) / L, nz: (-s * (bx - ax)) / L });
  }
  return out;
}
const EDGES = surveyEdges();
const edgeAt = (k) => EDGES.find((e) => e.k === k);
const setLength = (name) => section.system.faceSets[name].edges.reduce((t, k) => t + edgeAt(k).length, 0);

/* The compass quarter an edge's own outward normal points into. */
const quarter = (e) => (Math.abs(e.nz) >= Math.abs(e.nx) ? (e.nz > 0 ? "S" : "N") : (e.nx > 0 ? "E" : "W"));

/* Which quarters each declared face set is allowed to contain. This is the
   gate that catches an edge index moved into the wrong set: the ring decides,
   not the label. */
const SET_QUARTERS = {
  south: ["S"], barEast: ["E"], barWest: ["W"], wingEast: ["E"], wingWest: ["W"], north: ["N"],
};

/* ------------------------------------------------------- identity & record */

test("the section exists and carries the whole ultra apparatus", () => {
  assert.ok(section, "no tata section");
  for (const k of ["label", "epoch", "note", "confidence", "seed", "bounds", "sources",
    "ring", "measured", "colors", "colorSources", "derivations", "estimates", "reads",
    "draw", "grid", "system", "roof", "ground", "counts", "conflicts", "absent", "superseded"]) {
    assert.ok(section[k] !== undefined, `section is missing ${k}`);
  }
  assert.equal(typeof section.seed, "number");
});

test("it says what it is: a document-derived height, a dead LiDAR epoch, honest", () => {
  assert.match(section.label, /Tata Hall/);
  assert.match(section.label, /Biological and Physical Sciences|BPSB/i,
    "the planning-document name is the one to search under and belongs in the label");
  assert.match(section.label, /Muir/i,
    "two first-party planning documents place the site in Muir and the label must not hide it");
  assert.match(section.note, /INVENTED/, "the note must declare the class");
  assert.match(section.note, /NO FIGURE IN THIS SECTION CITES LiDAR FOR HEIGHT/i,
    "the LiDAR negative is the section's defining claim and belongs in the note");
  assert.match(section.epoch, /BLIND|did not exist/i, "the 2014 flight saw a lawn and the epoch must say so");
  assert.match(section.epoch, /2026|2018|2016|2015/, "the epoch ladder must be dated");
  assert.ok(section.confidence.length > 300, "the confidence statement must be per-claim, not a word");
  assert.match(section.confidence, /WITHHELD/, "confidence must name what it is NOT confident enough to build");
});

test("every source is described and dated, and the ladder's rungs are all named", () => {
  assert.ok(section.sources.length >= 12, `only ${section.sources.length} sources`);
  for (const s of section.sources) {
    assert.ok(s.length >= 120, `source is not described: ${s.slice(0, 70)}`);
    assert.match(s, /\b(19|20)\d\d\b/, `source has no date: ${s.slice(0, 70)}`);
  }
  const joined = section.sources.join("\n");
  for (const [what, re] of [
    ["the Coastal Commission staff report, the height source", /documents\.coastal\.ca\.gov|6-16-0252/],
    ["Regents GB7, the storey count and the programme", /regents\.universityofcalifornia\.edu|GB7/],
    ["the metal trade press, which dimensions the fin", /metalconstructionnews/],
    ["educationsnapshots, the electrochromic and Panelite glazing", /educationsnapshots/],
    ["ArchDaily", /archdaily/],
    ["CO Architects' own project page", /coarchitects\.com/],
    ["Spurlock, the landscape", /spurlock-land\.com/],
    ["img1, the one colour frame", /spurlock_tata_img1\.jpg/],
    ["es-2, the south elevation and quadrangle aerial", /es-2\.jpg/],
    ["N102, the north elevation", /co_14004_000_N102\.jpg/],
    ["the axon and its one drawn dimension", /co_Tata-Hall-Axon\.jpg/],
    ["the survey ring, by literal index", /massing\[244\]/],
    ["the LiDAR file, cited for its silence", /campus-lidar\.json/],
    ["the 2026 ortho", /chunk_4_6\.jpg/],
  ]) assert.match(joined, re, `sources[] no longer cites ${what}`);
});

/* ------------------------------------------------------------ the LiDAR gate */

test("NO figure in this section cites LiDAR for a height", () => {
  /* The one thing the 2014 flight contributes is the GROUND it flew over. Any
     other use of it, anywhere in the derivation table, is a fabrication —
     there was no building inside this ring in 2014. */
  const ALLOWED = new Set(["grid.extrusionAboveRim", "grid.rimToLevel1", "grid.parapetRendererY"]);
  let cited = 0;
  for (const [path, decl] of Object.entries(section.derivations.figures)) {
    if (path === "why" || typeof decl === "string" || !decl.expr) continue;
    if (!/r\.lidar\./.test(decl.expr)) continue;
    cited += 1;
    assert.ok(ALLOWED.has(path),
      `${path} references the 2014 flight in its own expression — the flight saw a lawn here, `
      + "and the only reading it may contribute is rimBase2014, the ground");
    assert.match(decl.expr, /r\.lidar\.(rimBase2014|datum)\b/,
      `${path} reads something other than the ground or the datum out of the 2014 flight`);
  }
  assert.equal(cited, 3, "the three ground-and-datum figures must still be there — a vacuous gate is not a gate");

  /* And the section must ship the two nulls, not invent them away. */
  assert.equal(section.measured.lidarMassHeight, null);
  assert.equal(section.measured.lidarHeight, null);
  assert.equal(lidar.massHeights["m:-55,171"], undefined,
    "campus-lidar.json has grown a massHeights entry for Tata — the section's whole premise would be gone");
  assert.equal(lidar.heights["Tata Hall"], undefined,
    "campus-lidar.json has grown a heights entry for Tata");
  assert.match(section.measured.lidarNegativeNote, /3\.04/,
    "the canopy signature that proves the negative must be in the record");
  assert.match(section.measured.lidarNegativeNote, /11,?300/,
    "the count of above-ground returns that are NOT a building must be in the record");
  assert.match(section.measured.lidarNegativeNote, /CA_SanDiego_2015_C17_1|no newer public/i,
    "the verified negative on newer point clouds must be in the record so nobody re-runs it");
});

/* ------------------------------------------------------------ the arithmetic */

test("every drawn figure is the arithmetic its own readings give", () => {
  const R = section.derivations.readings;
  const FT = R.units.foot;
  const IN = R.units.inch;
  /* Recomputed here from the readings ALONE — never from the section's own
     stated values — so a self-consistent fabrication cannot pass. */
  const F = (R.ccc.ureyGreenFt - R.ccc.lowGradeFt) * FT;
  const parapet = (R.ccc.statedHeightFt - R.ccc.storeysAboveGrade * (R.ccc.ureyGreenFt - R.ccc.lowGradeFt)) * FT;
  const buildingHeight = R.ccc.statedHeightFt * FT;
  const level1Absolute = R.ccc.lowGradeFt * FT;
  const parapetAbsolute = (R.ccc.lowGradeFt + R.ccc.statedHeightFt) * FT;
  const finHeight = R.trade.finHeightFt * FT;
  const finSpacing = R.ortho.finPitchPx / R.ortho.pxPerM;
  /* The three finned face lengths come from the SURVEY RING, not from the
     section's own survey readings. */
  const southLen = setLength("south");
  const eastLen = setLength("barEast");
  const westLen = setLength("barWest");
  const finnedLength = southLen + eastLen + westLen;
  const cccResiduals = [R.ccc.pacificFt * FT - 33.2, R.ccc.bonnerFt * FT - 15.4,
    R.ccc.ureyFt * FT - 30.5, R.ccc.recGymFt * FT - 7.5];

  const expect = {
    "grid.levelsAboveGrade": R.gb7.storeysAboveGrade,
    "grid.basementLevels": R.gb7.basementLevels,
    "grid.floorToFloor": F,
    "grid.parapet": parapet,
    "grid.buildingHeight": buildingHeight,
    "grid.level1Absolute": level1Absolute,
    "grid.level2Absolute": R.ccc.ureyGreenFt * FT,
    "grid.parapetAbsolute": parapetAbsolute,
    "grid.parapetRendererY": parapetAbsolute - R.lidar.datum,
    "grid.extrusionAboveRim": parapetAbsolute - R.lidar.rimBase2014,
    "grid.rimToLevel1": R.lidar.rimBase2014 - level1Absolute,
    "system.fin.width": R.trade.finWidthIn * IN,
    "system.fin.depth": R.trade.finDepthIn * IN,
    "system.fin.height": finHeight,
    "system.fin.barCount": R.trade.barCount,
    "system.fin.barCentres": R.trade.barCentresIn * IN,
    "system.fin.barSpan": R.trade.barCount * R.trade.barCentresIn * IN,
    "system.fin.crossbarSpacing": R.trade.crossbarSpacingIn * IN,
    "system.fin.spandrelExposed": F - finHeight,
    "system.fin.spacing": finSpacing,
    "system.fin.finnedLength": finnedLength,
    "system.fin.perStorey": finnedLength / finSpacing,
    "system.spandrel.exposed": F - finHeight,
    "system.facadeZone": (R.survey.barDepth - R.axon.drawnWidthFt * FT) / 2,
    "roof.parapet.height": parapet,
    "check.finsAtMeasuredPitch": (finnedLength / finSpacing) * R.gb7.storeysAboveGrade,
    "check.publishedFinCoverage": (R.trade.finCount * finSpacing) / (R.gb7.storeysAboveGrade * finnedLength),
    "check.cccNeighbourResidual": cccResiduals.reduce((s, v) => s + v, 0) / 4,
    "check.heightCloses": R.gb7.storeysAboveGrade * F + parapet,
  };

  const figures = section.derivations.figures;
  assert.deepEqual(Object.keys(figures).sort(), Object.keys(expect).sort(),
    "the derivation table and this test's independent recomputation must cover the same figures");
  for (const [path, want] of Object.entries(expect)) {
    const decl = figures[path];
    assert.ok(decl && decl.expr, `${path} has no stated derivation`);
    assert.ok(decl.derivation && decl.derivation.length > 20, `${path} lost the prose behind its expr`);
    near(decl.value, want, 5e-6, `${path}: the section STATES ${decl.value}, its own readings give`);
    if (!path.startsWith("check.")) {
      near(at(section, path), want, 5e-6, `${path}: the section SHIPS ${at(section, path)}, its own readings give`);
    }
  }

  /* THE CHECK THAT MAKES SECTION 2 A DERIVATION AND NOT A COINCIDENCE: six
     uniform storeys of a floor-to-floor got from two drawn grades, plus a
     parapet got by residual, land on a separately stated 100 ft exactly. */
  near(R.gb7.storeysAboveGrade * F + parapet, buildingHeight, 1e-9,
    "the storey stack does not close on the CCC's stated height");
  near(F, 15.6 * FT, 1e-9, "the floor-to-floor is not the 15.6 ft the two drawn spots give");
  near(parapet, 6.4 * FT, 1e-9, "the parapet residual is not the 6.4 ft the arithmetic leaves");
  /* And the spandrel band is the difference of two INDEPENDENTLY sourced
     numbers — a drawn grade difference and a trade-press fin height. */
  assert.ok(section.system.spandrel.exposed > 0,
    "the published fin is taller than the derived storey — one of the two sources is being misread");
  assert.ok(section.system.spandrel.exposed < F / 2,
    "the exposed spandrel is more than half the storey, which no photograph in the set shows");

  /* The competing datum is recorded and NOT used: from +400.0 ft everything
     would sit 1.71 m higher. */
  near((R.ccc.fireLaneFt - R.ccc.lowGradeFt) * FT, 1.7069, 1e-3,
    "the heightDatum conflict's stated shift must still be the arithmetic of its own two readings");

  /* The two losers stay losers, by more than rounding. */
  assert.ok(buildingHeight - R.survey.arcgisH > 4, "the ArcGIS formula must still be metres short");
  assert.ok(buildingHeight - R.survey.osmHeight > 4, "the OSM guess must still be metres short");
  assert.equal(R.survey.arcgisH, MASSING.h, "the recorded ArcGIS formula height drifted from the shipped file");
  assert.equal(R.survey.arcgisLevels, MASSING.levels);
  near(R.survey.arcgisH, R.survey.arcgisLevels * 4.267, 5e-3,
    "arcgis h must still be the Revelle-wide 6 x 4.267 formula it is recorded as being");
});

test("the fin is a GRATING, and its own two published numbers agree", () => {
  const R = section.derivations.readings;
  const S = section.system.fin;
  /* Eight bars at 1-3/16 in centres span 9.5 in against a 9-11/16 in overall
     width. If those two disagreed by more than an outer half-bar the
     construction line would have been misread. */
  const overall = R.trade.finWidthIn * R.units.inch;
  near(S.barSpan, overall, R.trade.barCentresIn * R.units.inch,
    "the eight bars at their published centres do not span the published fin width");
  assert.ok(S.barSpan <= overall, "the bars span more than the fin is wide");
  /* It is see-through: the daylight between bars must be a real fraction of
     the pitch, which is what a solid plate would not have. */
  const gap = S.barCentres - S.barWidth;
  assert.ok(gap > S.barCentres * 0.5,
    `the comb is ${(100 * gap / S.barCentres).toFixed(0)} % open — below half it stops reading as a grating`);
  assert.ok(S.barWidth < S.depth, "a bearing bar thicker than the grating is deep is not a bearing bar");
  /* And the whole assembly stays inside the facade zone the axon's one drawn
     dimension leaves against the survey ring. */
  const reach = section.draw.wallOffset + section.draw.glassOffset + S.barSpan;
  assert.ok(reach < section.system.facadeZone,
    `the fin reaches ${reach.toFixed(3)} m off the ring against a ${section.system.facadeZone} m facade zone`);
});

test("the fin pitch is a READ with a tolerance, and its evidence is on the record", () => {
  const rd = section.reads["system.fin.spacing"];
  assert.ok(rd, "the fin pitch must be a read — it is measured, not derived from a count");
  near(rd.value, 8.5 / 8, 5e-6, "the shipped pitch is not the autocorrelation lag over the chunk's own scale");
  near(rd.tolerance, 0.5 / 8, 5e-6, "the tolerance is not half a pixel at 8 px/m");
  assert.match(rd.source, /autocorrelation/i);
  assert.match(rd.source, /chunk_4_6\.jpg/);
  /* The method has to name the two things that make it believable: the two
     independent halves and the control bands. */
  const method = section.derivations.readings.ortho.source;
  assert.match(method, /west half/i);
  assert.match(method, /east half/i);
  assert.match(method, /CONTROL/i, "the controls are what separate a peak from wishful thinking");
  assert.match(method, /0\.208/, "the lean is why the dossier's scan missed it and must be stated");
  /* And the published count is kept as a CHECK, not averaged in. */
  const cover = section.derivations.figures["check.publishedFinCoverage"].value;
  assert.ok(cover > 0.8 && cover < 1.0,
    `653 fins at the measured pitch cover ${(100 * cover).toFixed(1)} % of the three-face run — outside 80-100 % the two sources are not describing the same building`);
});

/* ------------------------------------------------------------ the survey */

test("the surveyed ring is the survey, byte for byte, and the parts are its own extents", () => {
  assert.equal(MASSING.n, "Tata Hall", "massing[244] moved — this section cites it by literal index");
  assert.deepEqual(section.measured.mass.ring, ring0, "the ring is not massing[244].r[0] at /10");
  assert.equal(section.measured.arcgisMass, MASS_INDEX);
  assert.equal(MASSING.r.length, 1, "the survey has grown a second ring and the section still claims one");
  near(section.measured.mass.perimeter, EDGES.reduce((t, e) => t + e.length, 0), 5e-6, "perimeter");
  /* The three declared parts are the ring's own bounding extents. */
  const P = section.measured.mass.parts;
  const inBox = (p, b) => p[0] >= b.x0 - 1e-9 && p[0] <= b.x1 + 1e-9 && p[1] >= b.z0 - 1e-9 && p[1] <= b.z1 + 1e-9;
  for (const v of ring0) {
    assert.ok(inBox(v, P.bar) || inBox(v, P.wing) || inBox(v, P.westStep),
      `survey vertex ${JSON.stringify(v)} is in none of the three declared parts`);
  }
  const xs = ring0.map((p) => p[0]);
  const zs = ring0.map((p) => p[1]);
  near(Math.min(...xs), Math.min(P.bar.x0, P.wing.x0, P.westStep.x0), 1e-9, "the parts miss the ring's west edge");
  near(Math.max(...xs), Math.max(P.bar.x1, P.wing.x1, P.westStep.x1), 1e-9, "the parts miss the ring's east edge");
  near(Math.min(...zs), Math.min(P.bar.z0, P.wing.z0, P.westStep.z0), 1e-9, "the parts miss the ring's north edge");
  near(Math.max(...zs), Math.max(P.bar.z1, P.wing.z1, P.westStep.z1), 1e-9, "the parts miss the ring's south edge");
  near(section.derivations.readings.survey.barDepth, P.bar.z1 - P.bar.z0, 1e-9,
    "the bar depth the facade zone divides is not the bar's own declared extent");
});

test("the six face sets PARTITION the ring, and every one agrees with the ring's own normals", () => {
  const sets = section.system.faceSets;
  assert.deepEqual(Object.keys(sets).sort(), Object.keys(SET_QUARTERS).sort());
  const seen = new Map();
  for (const [name, set] of Object.entries(sets)) {
    assert.ok(set.edges.length > 0, `${name} names no edges`);
    for (const k of set.edges) {
      const e = edgeAt(k);
      assert.ok(e, `${name} names edge ${k}, which the survey ring does not have as a non-degenerate edge`);
      assert.equal(seen.has(k), false, `edge ${k} is claimed by both ${seen.get(k)} and ${name}`);
      seen.set(k, name);
      assert.ok(SET_QUARTERS[name].includes(quarter(e)),
        `${name} claims edge ${k}, whose own outward normal points ${quarter(e)} — the ring decides, not the label`);
    }
    assert.ok(["vision", "electro", "open"].includes(set.glazing), `${name} has no known glazing system`);
    assert.ok(["sourced", "estimated"].includes(set.tier), `${name} carries no tier`);
    assert.equal(typeof set.finned, "boolean");
  }
  assert.equal(seen.size, EDGES.length,
    `the face sets cover ${seen.size} of the ring's ${EDGES.length} edges — a face the survey draws would ship as bare shell`);

  /* The declared face lengths are the ring's own, recomputed. */
  const R = section.derivations.readings.survey;
  near(R.southFaceLength, setLength("south"), 5e-6, "southFaceLength");
  near(R.barEastEndLength, setLength("barEast"), 5e-6, "barEastEndLength");
  near(R.barWestEndLength, setLength("barWest"), 5e-6, "barWestEndLength");
  near(section.system.fin.finnedLength, setLength("south") + setLength("barEast") + setLength("barWest"),
    5e-6, "finnedLength");

  /* THE NORTH IS NOT FINNED, which is what licenses excluding 89 m of
     elevation from the fin arithmetic, and the evidence is N102. */
  assert.equal(sets.north.finned, false);
  assert.match(section.sources.join("\n"), /N102[\s\S]*?north/i,
    "the north face's exclusion from the fin run rests on N102 and the sources must say so");
  /* The two ends are finned on an ESTIMATE and must say so on their own line. */
  for (const name of ["barEast", "barWest"]) {
    assert.equal(sets[name].finned, true);
    assert.equal(sets[name].tier, "estimated",
      `${name} is finned on an assumption about which elevations are screened and must not claim [sourced]`);
  }
  assert.equal(sets.south.tier, "sourced");
});

test("the massing retirement main must wire is declared, keyed, and NOT in massHeights", () => {
  const M = section.measured.massing;
  assert.equal(M.skipGisKey, "m:-55,171");
  assert.equal(M.replacesMeasured, "photo-tata");
  /* The key really is this mass's own rounded GIS centroid — the mean over the
     STORED ring, trailing duplicate vertex included, which is how
     scripts/build-campus-lidar.mjs keys massHeights and how campus-massing.js
     keys skipGis. Getting this wrong is how main would wire a skipGis key for
     a mass that does not exist. */
  const raw = MASSING.r[0];
  const cx = raw.reduce((s, p) => s + p[0], 0) / raw.length / 10;
  const cz = raw.reduce((s, p) => s + p[1], 0) / raw.length / 10;
  assert.equal(`m:${Math.round(cx)},${Math.round(cz)}`, M.skipGisKey,
    "the skipGis key is not this mass's own rounded centroid");
  /* AND — unlike Urey and Bonner, whose retirements replaced a LiDAR read that
     was wrong about a stepped roof — this key is NOT in massHeights, because
     the 2014 flight saw a lawn. A sibling suite asserts the opposite of this
     line and both are right about their own building. */
  assert.equal(lidar.massHeights[M.skipGisKey], undefined,
    "massHeights has grown an entry for this key — the section's whole LiDAR negative would be gone");
  assert.match(M.why, /ONE commit/i,
    "skipGis and REPLACES_MEASURED must be wired together — one without the other doubles the envelope or holes the far silhouette");
  assert.match(M.why, /2\.2 m|25\.6/,
    "the why must state what the doubled envelope would actually look like, in metres");

  /* The PHOTO_CARRIED bbox is the survey ring's own extent, not a redrawing. */
  const xs = ring0.map((p) => p[0]);
  const zs = ring0.map((p) => p[1]);
  near(M.photoCarried.minX, Math.min(...xs), 1e-9, "photoCarried minX");
  near(M.photoCarried.maxX, Math.max(...xs), 1e-9, "photoCarried maxX");
  near(M.photoCarried.minZ, Math.min(...zs), 1e-9, "photoCarried minZ");
  near(M.photoCarried.maxZ, Math.max(...zs), 1e-9, "photoCarried maxZ");

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

/* ------------------------------------------------------- S1: the axiom layer */

const CCC = "California Coastal Commission 6-16-0252, staff report + addendum of 2016-07-13, cached at Revelle-College-Sources/plans-and-drawings/CCC_2016-07-13_w11c-addendum_6-16-0252.pdf";
const GB7 = "UC Regents Committee on Grounds and Buildings item GB7, 2015-07-21, cached at Revelle-College-Sources/plans-and-drawings/UCRegents_2015-07-21_GB7_BPSB-design-approval.pdf";
const TRADE = "metalconstructionnews.com's Tata Hall for the Sciences project page, fetched 2026-08-21";
const ORTHO = "docs/data/textures/chunk_4_6.jpg, the Google (c)2026 z20 ortho at 8 px/m";
const pin = (value, truth, tol) => ({ value, truth, ...(tol === undefined ? {} : { tol }) });

const READING_PINS = {
  "units.inch": pin(0.0254, "the international inch, 25.4 mm exactly by definition"),
  "units.foot": pin(0.3048, "the international foot, 12 inches exactly by definition"),

  "ccc.statedHeightFt": pin(100, `${CCC} — '100-ft. tall', stated four times`),
  "ccc.lowGradeFt": pin(394.4, `${CCC} Exhibit 2 site plan, the drawn spot at the north-east low corner`),
  "ccc.ureyGreenFt": pin(410.0, `${CCC} Exhibit 2 site plan, the drawn spot on the Urey Green side`),
  "ccc.fireLaneFt": pin(400.0, `${CCC} Exhibit 2 site plan, the fire-lane turnaround spot — the LOSING datum`),
  "ccc.westDriveFt": pin(404.0, `${CCC} Exhibit 2 site plan, the west service drive spot`),
  "ccc.nwCornerFt": pin(406.4, `${CCC} Exhibit 2 site plan, the north-west building corner, marked SLOPE UP`),
  "ccc.storeysAboveGrade": pin(6, `${CCC} — 'six stories above ground'`),
  "ccc.storeysBelowGrade": pin(1, `${CCC} — 'one subterranean story'`),
  "ccc.areaSf": pin(129000, `${CCC} — 'approximately 129,000 sq. ft.'`),
  "ccc.cutCuYd": pin(5727, `${CCC} — the project's cut, which is why the shipped terrain is the wrong epoch`),
  "ccc.fillCuYd": pin(575, `${CCC} — the project's fill, an order of magnitude under the cut`),
  "ccc.pacificFt": pin(99, `${CCC} — Pacific Hall, one of the four neighbours that licence the 100 ft`),
  "ccc.bonnerFt": pin(61, `${CCC} — Bonner Hall, one of the four neighbours`),
  "ccc.ureyFt": pin(96, `${CCC} — Urey Hall, one of the four neighbours`),
  "ccc.recGymFt": pin(29, `${CCC} — the Recreation Gymnasium, one of the four neighbours`),

  "gb7.storeysAboveGrade": pin(6, `${GB7} — 'a six-story plus basement cast-in-place concrete building'`),
  "gb7.basementLevels": pin(1, `${GB7} — the Basement Level, named separately from Levels 1-6`),
  "gb7.areaGsf": pin(126000, `${GB7} — the gross area at design approval`),
  "gb7.areaAsf": pin(73200, `${GB7} — the assignable area at design approval`),
  "gb7.bridgeLevel": pin(5, `${GB7} — the pedestrian bridge to Pacific Hall is at Level 5`),
  "gb7.auditoriumSeats": pin(175, `${GB7} — the 175-seat auditorium, which is what the green box is believed to be`),
  "gb7.auditoriumLevel": pin(3, `${GB7} — the auditorium is on Level 3`),
  "gb7.siteElevationLoFt": pin(394, `${GB7} — 'at an elevation of 394-412 feet above mean sea level'`),
  "gb7.siteElevationHiFt": pin(412, `${GB7} — the top of that band`),

  "trade.finWidthIn": pin(9.6875, `${TRADE} — 9-11/16 in, the comb's overall width`),
  "trade.finDepthIn": pin(2, `${TRADE} — 2 in deep`),
  "trade.finHeightFt": pin(13, `${TRADE} — 13 ft, the most common fin height ('varies')`),
  "trade.finCount": pin(653, `${TRADE} — 653 fins on the building`),
  "trade.barCount": pin(8, `${TRADE} — eight vertical bearing bars to a fin`),
  "trade.barCentresIn": pin(1.1875, `${TRADE} — 1-3/16 in centres`),
  "trade.crossbarSpacingIn": pin(8, `${TRADE} — dovetail-welded crossbars at 8 in o.c.`),

  "axon.drawnWidthFt": pin(65, "Revelle-College-Sources/renders/tata-sources/co_Tata-Hall-Axon.jpg — the ONE dimension line on the only drawing in the set"),

  "survey.massIndex": pin(244, "docs/data/campus-arcgis.json massing[244], cited by literal index"),
  "survey.arcgisH": pin(25.6, "docs/data/campus-arcgis.json massing[244].h — the Revelle-wide FORMULA 6 x 4.267, recorded to be distrusted"),
  "survey.arcgisLevels": pin(6, "docs/data/campus-arcgis.json massing[244].levels"),
  "survey.perimeter": pin(255.336981, "the summed length of massing[244] ring 0's own non-degenerate edges", 5e-6),
  "survey.southFaceLength": pin(89.322495, "the summed length of the ring edges in the declared `south` face set", 5e-6),
  "survey.barEastEndLength": pin(19.901, "the summed length of the ring edges in the declared `barEast` face set", 5e-4),
  "survey.barWestEndLength": pin(19.903, "the summed length of the ring edges in the declared `barWest` face set", 5e-4),
  "survey.barDepth": pin(20.7, "the z extent of the ring's bar, 165.2..185.9, which the axon's 65 ft is measured against"),
  "survey.osmHeight": pin(26.4, "docs/data/campus-3d.json's OSM levels guess for 'Tata Hall for the Sciences', recorded to be distrusted"),

  "lidar.datum": pin(102.4, "docs/data/campus-lidar.json datum"),
  "lidar.rimBase2014": pin(123.03, "research-tata.md section 3: the median of 1,025 GROUND returns within 4 m outside the ring in the 2014 flight — the ONLY thing that flight contributes"),
  "lidar.rimBaseSamples": pin(1025, "the n behind that median"),
  "lidar.aboveGroundReturns": pin(11300, "the above-ground returns inside the ring that are CANOPY, not a building"),
  "lidar.cells": pin(591, "the 1.5 m cells those returns fall in"),
  "lidar.spreadP50": pin(3.04, "the per-cell p90-minus-p35 median — the canopy signature; a real roof measures 0.01-0.05 m"),
  "lidar.hardCellsAbove2m": pin(19, "the 19 of 591 cells that do read as hard surfaces, scattered 5.5..21.4 m with no plateau"),

  "ortho.pxPerM": pin(8, `${ORTHO} — the chunk's own scale`),
  "ortho.finPitchPx": pin(8.5, `${ORTHO} — the autocorrelation peak in the leaning south fin band`),
  "ortho.finPitchTolPx": pin(0.5, `${ORTHO} — half a pixel, the finest thing this source can say`),
  "ortho.bandZ0": pin(180.5, `${ORTHO} — the north edge of the band the signal is in`),
  "ortho.bandZ1": pin(184.0, `${ORTHO} — the south edge of that band`),

  "code.guardHeightIn": pin(42, "IBC 2021 section 1015.3 — recorded for the WITHHELD ramp guard; nothing built reads it"),

  "img1.width": pin(1920, "Revelle-College-Sources/renders/tata-sources/spurlock_tata_img1.jpg, the section's only colour frame"),
  "img1.height": pin(1080, "the same frame's height; every colour rect is in these pixels"),
};

const DRAW_PINS = {
  wallOffset: pin(0.03, "the depth an applied band stands off the surveyed face so it resolves against the shell without z-fighting"),
  glassOffset: pin(0.02, "glazing sits this far in front of the spandrel plane so the two never co-plane"),
  bandThickness: pin(0.06, "the drawn thickness of every applied band; the wall offset must stay under it"),
  skirtDepth: pin(0.4, "how far the shell is skirted BELOW the lowest drawn surface under it so no terrain triangle shows through"),
  groundClipSamples: pin(12, "how many points along each surveyed edge the drawn surface is sampled at to find that lowest grade"),
  groundCell: pin(3, "the cell a ground decal is laid in, so a paved or planted area follows rolling terrain instead of hovering at one datum"),
  scatterSpread: pin(0.25, "the +/- fraction the deterministic scatter varies a planted object's size by; it is also the inset a bed keeps from its own declared edge, so nothing planted overhangs the extent it is planted in"),
  decalGap: pin(0.02, "the gap left between adjacent ground cells so they never z-fight on a slope"),
  "tiles.concrete": pin(2.4, "texture repeat in metres for the concrete class"),
  "tiles.plank": pin(1.4, "texture repeat in metres for the boardwalk plank class"),
  "tiles.stone": pin(1.2, "texture repeat in metres for the boulder stone class"),
};

const ABSENT = {
  parapetHeight: /PARAPET HEIGHT/,
  roofEquipment: /THE ROOF EQUIPMENT/,
  bridge: /THE LEVEL-5 PEDESTRIAN BRIDGE/,
  greenBox: /THE GREEN AUDITORIUM BOX/,
  entryCanopy: /THE ENTRY CANOPY AND ITS SOFFIT/,
  ramp: /THE UREY GREEN PEDESTRIAN RAMP/,
  colonnade: /THE LEVEL 2 COLONNADE/,
  wingProgramme: /THE NORTH WING'S PROGRAMME/,
  finFinish: /THE FIN FINISH SEPARATED FROM THE GLASS/,
  panelite: /THE PANELITE INSULATED GLASS PANELS/,
  electrochromic: /THE ELECTROCHROMIC GLAZING HAS NO FIXED COLOUR/,
  basement: /THE BASEMENT AND THE NMR VOLUME/,
  groundPlan: /THE GROUND BAND'S PLAN/,
  landscapeColour: /THE TURF LAWN PANEL, THE FLAGSTONE TERRACE/,
  parapetCap: /THE DARK PARAPET CAPPING BAND/,
  oceanTerraces: /EXTERIOR TERRACES WITH PACIFIC OCEAN VIEWS/,
  loadingDock: /THE LOADING DOCK/,
  terrainEpoch: /THE 2014 GROUND UNDER THIS BUILDING IS THE PRE-CONSTRUCTION SURFACE/,
  colorimetry: /NO COLORIMETRIC SOURCE EXISTS/,
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
  const paths = assertCoverage({
    section,
    roots: {
      grid: exempt, system: exempt, roof: exempt, ground: exempt,
      "derivations.readings": {}, estimates: {}, draw: {},
    },
    classify,
    uncovered: {},
    minimum: 100,
    label: "tata",
  });
  assert.ok(paths.filter((p) => p.path.startsWith("draw.")).length >= 10,
    "the draw block did not get walked");
  assert.ok(paths.filter((p) => p.path.startsWith("grid.")).length >= 11,
    "the height chain did not get walked");

  for (const [p, e] of Object.entries(est)) {
    if (p === "why") continue;
    assert.match(e.why, /\[estimated\]/, `${p} must carry the [estimated] label`);
    assert.ok(e.extends && e.extends.length > 25, `${p} must record which sourced pattern it extends`);
    near(at(section, p), e.value, 5e-6, `${p} ships a value its estimate does not state`);
  }
  for (const [p, rd] of Object.entries(reads)) {
    if (p === "why") continue;
    assert.ok(rd.source && rd.source.length > 40, `${p} must name the artefact it is read off`);
    assert.equal(typeof rd.tolerance, "number", `${p} must carry the tolerance its source supports`);
    near(at(section, p), rd.value, 5e-6, `${p} ships a value its read does not state`);
  }
  /* One number, one provenance. */
  for (const p of Object.keys(est)) {
    if (p === "why") continue;
    assert.ok(!derived.has(p) && !reads[p], `${p} claims two provenances`);
  }
  for (const [p, why] of Object.entries(exempt)) {
    assert.ok(why.length > 80, `exemption ${p} is unmotivated: ${why.slice(0, 50)}`);
  }
  /* The ground exemptions are the only large ones and they buy a geometric
     gate rather than a free pass — see the ground band test below. */
  for (const k of ["ground.terrace", "ground.beds", "ground.swale"]) {
    assert.ok(exempt[k], `the ground band's ${k} must be exempted EXPLICITLY, with its reason on the record`);
  }
});

test("S1(ii): every estimate carries a machine-readable band and ships inside it", () => {
  const n = assertEstimateBands({
    estimates: section.estimates,
    valueAt: (key) => at(section, key),
    skip: ["why"],
    label: "tata",
  });
  assert.equal(n, 14, "the estimate count is declared here so a new unbanded one cannot arrive quietly");
  /* A band may not be a place to park a value the section does not ship. */
  assert.throws(
    () => assertEstimateBands({
      estimates: section.estimates,
      valueAt: (k) => (k === "system.fin.barWidth" ? 0.005 : at(section, k)),
      skip: ["why"], label: "tata",
    }),
    /ships 0\.005 but states/,
  );
  /* And a value outside its own band fails, which is the S1(ii) acceptance. */
  for (const bad of [0.001, 0.02]) {
    assert.throws(
      () => assertEstimateBands({
        estimates: { "system.fin.barWidth": { ...section.estimates["system.fin.barWidth"], value: bad } },
        valueAt: () => bad, label: "tata",
      }),
      /outside its own published band/,
      `system.fin.barWidth can still reach ${bad}`,
    );
  }
});

test("S1(iii): every reading with an external truth is pinned to that truth", () => {
  const R = section.derivations.readings;
  assert.equal(
    assertPins({
      readings: R,
      pins: READING_PINS,
      namespaces: ["units", "ccc", "gb7", "trade", "axon", "survey", "lidar", "ortho", "code", "img1"],
      label: "tata",
    }),
    Object.keys(READING_PINS).length,
  );
  assert.equal(
    assertPins({ readings: section.draw, pins: DRAW_PINS, namespaces: ["tiles"], label: "tata draw" }),
    Object.keys(DRAW_PINS).length,
  );
  /* The mutations this gate exists for. */
  assert.throws(() => assertPins({
    readings: { ...R, ccc: { ...R.ccc, statedHeightFt: 120 } }, pins: READING_PINS, label: "tata",
  }), /ccc\.statedHeightFt/, "the stated height could go 100 -> 120");
  assert.throws(() => assertPins({
    readings: { ...R, ccc: { ...R.ccc, lowGradeFt: 400 } }, pins: READING_PINS, label: "tata",
  }), /ccc\.lowGradeFt/, "the height datum could be swapped for the losing one");
  assert.throws(() => assertPins({
    readings: { ...R, trade: { ...R.trade, finCount: 900 } }, pins: READING_PINS, label: "tata",
  }), /trade\.finCount/, "the published fin count could move");
  assert.throws(() => assertPins({
    readings: { ...section.draw, wallOffset: 0.3 }, pins: DRAW_PINS, label: "tata draw",
  }), /wallOffset/, "a render offset could be moved by a factor of ten");
  assert.throws(() => assertPins({
    readings: { ...R, ccc: { ...R.ccc, roofHeightFt: 88 } }, pins: READING_PINS,
    namespaces: ["ccc"], label: "tata",
  }), /is not pinned/, "a new reading could appear inside a pinned block unpinned");

  /* Every relation the section states in PROSE about its own readings. */
  const FT = R.units.foot;
  assertRelations({
    label: "tata",
    relations: [
      { name: "the foot is twelve inches", got: R.units.foot, want: 12 * R.units.inch },
      { name: "GB7 and the CCC agree INDEPENDENTLY on the above-grade storey count",
        got: R.gb7.storeysAboveGrade, want: R.ccc.storeysAboveGrade },
      { name: "GB7 and the CCC agree on the basement", got: R.gb7.basementLevels, want: R.ccc.storeysBelowGrade },
      { name: "the two drawn spots fall inside GB7's own stated 394-412 ft site band (low)",
        got: Math.min(R.ccc.lowGradeFt, R.ccc.ureyGreenFt) >= R.gb7.siteElevationLoFt ? 1 : 0, want: 1 },
      { name: "the two drawn spots fall inside GB7's own stated 394-412 ft site band (high)",
        got: Math.max(R.ccc.lowGradeFt, R.ccc.ureyGreenFt) <= R.gb7.siteElevationHiFt ? 1 : 0, want: 1 },
      { name: "the four drawn intermediate spots all lie between the two the section anchors to",
        got: [R.ccc.fireLaneFt, R.ccc.westDriveFt, R.ccc.nwCornerFt]
          .every((v) => v > R.ccc.lowGradeFt && v < R.ccc.ureyGreenFt) ? 1 : 0, want: 1 },
      { name: "the CCC's own project is overwhelmingly a CUT, which is why the terrain is the wrong epoch",
        got: R.ccc.cutCuYd / R.ccc.fillCuYd > 5 ? 1 : 0, want: 1 },
      { name: "trade: eight bars at their published centres span no more than the published fin width",
        got: R.trade.barCount * R.trade.barCentresIn <= R.trade.finWidthIn ? 1 : 0, want: 1 },
      { name: "trade: the published fin is SHORTER than the derived storey, which is what leaves a spandrel band",
        got: R.trade.finHeightFt * FT < (R.ccc.ureyGreenFt - R.ccc.lowGradeFt) * FT ? 1 : 0, want: 1 },
      { name: "lidar: only a small minority of the ring's cells read as hard surface at all",
        got: R.lidar.hardCellsAbove2m / R.lidar.cells < 0.05 ? 1 : 0, want: 1 },
      { name: "lidar: the per-cell spread is two orders above a real roof's 0.01-0.05 m",
        got: R.lidar.spreadP50 > 1 ? 1 : 0, want: 1 },
      { name: "ortho: the measured pitch is between the two hypotheses about which elevations are finned",
        got: (R.ortho.finPitchPx / R.ortho.pxPerM) > 0.8 && (R.ortho.finPitchPx / R.ortho.pxPerM) < 1.3 ? 1 : 0, want: 1 },
      { name: "survey: the ring's north and south runs are the same face length to a decimetre",
        got: Math.abs(setLength("south") - setLength("north")), want: 0, tol: 0.1 },
      { name: "survey: the two ends of the bar are the same length to a decimetre",
        got: Math.abs(setLength("barEast") - setLength("barWest")), want: 0, tol: 0.1 },
      { name: "the axon's drawn 65 ft is NARROWER than the survey ring's own bar depth, which is what leaves a facade zone",
        got: R.axon.drawnWidthFt * FT < R.survey.barDepth ? 1 : 0, want: 1 },
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
  assertTierSymmetry({ entries, label: "tata" });
  /* A promotion must fail: an [estimated] line relabelled [sourced] because it
     cites the parent it extends. */
  for (const role of ["parapet", "plazaPave", "membrane"]) {
    assert.throws(() => assertTierSymmetry({
      entries: [{ key: `colorSources.${role}`, text: section.colorSources[role].replace("[estimated]", "[sourced]") }],
      label: "tata",
    }), /hedges|names no artefact/, `colorSources.${role} could be promoted to [sourced] by relabelling it`);
  }
});

test("S1(v): every absent entry is held by a stable key and a probe", () => {
  const entries = absentEntries();
  assert.equal(assertAbsentEntries({ absent: entries, expected: ABSENT, label: "tata" }), entries.length);
  assert.equal(entries.length, Object.keys(ABSENT).length);
  assert.ok(section.absent.length >= 19,
    `absent went to ${section.absent.length} — this list does not shrink`);
  for (const a of section.absent) {
    assert.equal(typeof a, "string");
    assert.ok(a.length > 120, `absent entry is a stub: ${a.slice(0, 60)}`);
  }
  /* A withholding may not leave silently, and may not be replaced by another. */
  assert.throws(() => assertAbsentEntries({
    absent: entries.filter((e) => e.key !== "bridge"), expected: ABSENT, label: "tata",
  }), /may not leave silently/);
  assert.throws(() => assertAbsentEntries({
    absent: entries.map((e) => (e.key === "roofEquipment" ? { key: e.key, text: "the roof is fine" } : e)),
    expected: ABSENT, label: "tata",
  }), /no longer says what it withholds/);

  /* The four things the dossier asked for and this section refuses to guess
     must each say WHY, not merely that they are missing. */
  const j = section.absent.join("\n");
  assert.match(j, /heights/i, "the roof equipment's missing HEIGHTS are the reason it is not built");
  assert.match(j, /0\.208/, "the ortho's lean is the second reason and must be stated");
  assert.match(j, /1:12|57 m/, "the ramp's run is why it is out of scope and must be stated");
  assert.match(j, /Adobe RGB/, "the colour-space finding is why four landscape objects are withheld");
});

test("S1(vi): every expr is arithmetic, is EVALUATED, and reproduces its own value", () => {
  const scope = { r: section.derivations.readings, s: section };
  const { evaluated, prose } = assertExprs({ figures: section.derivations.figures, scope, label: "tata" });
  assert.equal(evaluated, 29, "all 29 figures evaluate");
  assert.equal(prose, 0, "no figure may hide behind prose");
  assert.throws(() => assertExprs({
    figures: { "grid.parapet": { value: 1.95072, expr: "r.ccc.parapetFt * r.units.foot" } },
    scope, label: "tata",
  }), /does not exist/);
  assert.throws(() => assertExprs({
    figures: { "grid.floorToFloor": { value: 4.75488, expr: "r.ccc.statedHeightFt * r.units.foot" } },
    scope, label: "tata",
  }), /does not reproduce its own value/);
  assert.throws(() => assertExprs({
    figures: { "grid.parapet": { value: 1.95072, expr: "the stated height less six derived storeys" } },
    scope, label: "tata",
  }), /illegal character|does not exist|does not reproduce/);
});

/* ---------------------------------------------------------------- conflicts */

test("conflicts are declared, never averaged, and the storey ruling names its loser", () => {
  assert.ok(section.conflicts.length >= 8, `only ${section.conflicts.length} conflicts`);
  for (const c of section.conflicts) assert.ok(c.length > 200, `a conflict is a stub: ${c.slice(0, 60)}`);
  const j = section.conflicts.join("\n");
  for (const [what, re] of [
    ["the storey split", /conflicts\.storeys/],
    ["the height split", /conflicts\.height\b/],
    ["the height datum", /conflicts\.heightDatum/],
    ["the fin rhythm, which this section overturns", /conflicts\.finRhythm/],
    ["which elevations are finned", /conflicts\.finnedFaces/],
    ["Revelle against Muir", /conflicts\.college/],
    ["the five published areas", /conflicts\.area/],
    ["the wrong-epoch terrain", /conflicts\.terrainEpoch/],
    ["the seat datum", /conflicts\.seatDatum/],
    ["the Adobe RGB trap", /conflicts\.colourSpace/],
  ]) assert.match(j, re, `conflicts[] no longer carries ${what}`);

  /* THE STOREY RULING, in substance: six above grade plus one basement, the
     two documents agreeing independently, ArcGIS correct, Emeriti the loser. */
  const storeys = section.conflicts.find((c) => /conflicts\.storeys/.test(c));
  assert.match(storeys, /six above grade plus one basement/i);
  assert.match(storeys, /independently/i, "what settles it is that the two documents agree independently");
  assert.match(storeys, /LOSER IS EMERITI'S EIGHT/i, "the loser must be named, not merely outvoted");
  assert.match(storeys, /Urey Hall/, "the ruling records where the losing figure probably came from");
  assert.match(storeys, /arcgis 6 is the above-grade count and is CORRECT/i,
    "this is the one Revelle mass where the GIS levels figure survives a document and the section must say so");
  assert.equal(section.grid.levelsAboveGrade, 6);
  assert.equal(section.grid.basementLevels, 1);
  assert.equal(section.grid.levelsAboveGrade + section.grid.basementLevels, 7);

  /* The fin-rhythm conflict must keep the LOSING derivation alive as a check
     rather than deleting it, which is the difference between adjudicating and
     overwriting. */
  const rhythm = section.conflicts.find((c) => /conflicts\.finRhythm/.test(c));
  assert.match(rhythm, /VERIFIED NEGATIVE/i);
  assert.match(rhythm, /check\.publishedFinCoverage/);
  assert.match(rhythm, /control band/i);
  assert.ok(section.derivations.figures["check.publishedFinCoverage"],
    "the overturned derivation must survive as the check the conflict says it survives as");
});

test("retired dossier conclusions left through superseded[], naming their evidence", () => {
  assert.ok(section.superseded.length >= 5, `superseded is ${section.superseded.length}`);
  for (const s of section.superseded) {
    for (const k of ["was", "nowIs", "why", "evidence"]) {
      assert.ok(s[k] && s[k].length > 40, `a superseded record is missing ${k}`);
    }
  }
  const j = JSON.stringify(section.superseded);
  for (const must of [/verified negative/i, /north wing/i, /img6/, /Adobe RGB/, /green/i]) {
    assert.match(j, must, `superseded[] no longer records ${must}`);
  }
  assert.match(section.supersededNote, /Nothing is deleted/i);
});

/* ------------------------------------------------------------------ colour */

test("colours are data, hex, one frame, and every role carries a tier", () => {
  const entries = Object.entries(section.colors);
  assert.ok(entries.length >= 14, `only ${entries.length} colours`);
  for (const [k, v] of entries) {
    assert.match(v, /^#[0-9a-f]{6}$/, `${k} is not a lowercase 6-digit hex`);
    const src = section.colorSources[k];
    assert.ok(src, `${k} has no colorSources line`);
    assert.match(src, /^\[(measured|sourced|estimated)\]/, `${k}'s provenance carries no tier`);
    assert.ok(src.length > 80, `${k}'s provenance is a stub`);
  }
  assert.deepEqual(Object.keys(section.colorSources).sort(), Object.keys(section.colors).sort(),
    "colorSources and colors must cover exactly the same roles");

  /* ONE FRAME. Every [sourced] hex comes from the only frame in the set that
     carries no ICC profile, and says which rect. */
  let sourcedRoles = 0;
  for (const [role, src] of Object.entries(section.colorSources)) {
    if (!src.startsWith("[sourced]")) continue;
    sourcedRoles += 1;
    assert.match(src, /spurlock_tata_img1\.jpg/, `${role} is [sourced] off a frame that is not the section's colour frame`);
    assert.match(src, /NO ICC profile/, `${role} must carry the reason its bytes may be read as sRGB`);
    assert.match(src, /\(\d+,\d+,\d+,\d+\)/, `${role} must pin its sample rect`);
    assert.match(src, /median RGB/, `${role} must state the method`);
    assert.equal(/luminance/i.test(src), false, `${role} says 'luminance' — the R4 addendum bans the word`);
  }
  assert.ok(sourcedRoles >= 9, `only ${sourcedRoles} roles are sourced off a pinned rect`);

  /* SHIPS-VS-DERIVES. Every provenance line that states its result as
     `= #xxxxxx` must ship exactly that hex. */
  let stated = 0;
  for (const [role, src] of Object.entries(section.colorSources)) {
    const m = /= (#[0-9a-f]{6})\b/.exec(src);
    if (!m) continue;
    stated += 1;
    assert.equal(section.colors[role], m[1],
      `${role} ships ${section.colors[role]} but its own provenance line derives ${m[1]}`);
  }
  assert.ok(stated >= 9, `only ${stated} provenance lines state their hex — every sourced read must`);

  /* Every [estimated] role must ship an EXISTING hex and name the sourced
     parent it takes it from, and that parent may not itself be an estimate. */
  for (const [role, src] of Object.entries(section.colorSources)) {
    if (!src.startsWith("[estimated]")) continue;
    const named = /colors\.(\w+)/.exec(src);
    assert.ok(named, `${role} is [estimated] and names no parent role`);
    assert.equal(section.colors[named[1]], section.colors[role],
      `${role} must ship the same hex as the role it names`);
    assert.match(section.colorSources[named[1]], /^\[sourced\]/,
      `${role} extends ${named[1]}, which is itself an estimate`);
  }

  /* No hex literal may live in the module, and every declared role must be
     drawn or named as a parent. */
  assert.equal(moduleSrc.match(/#[0-9a-fA-F]{6}\b/g), null, "a colour literal leaked into the builder");
  const named = new Set();
  for (const v of Object.values(section.colorSources)) {
    for (const m of v.matchAll(/colors\.(\w+)/g)) named.add(m[1]);
  }
  for (const role of Object.keys(section.colors)) {
    assert.ok(moduleSrc.includes(`"${role}"`) || named.has(role),
      `colors.${role} is declared and nothing references it — a role nobody draws is a claim nobody checks`);
  }
});

test("nothing in this section rests on the unresolved ortho-as-colour-source ruling", () => {
  /* P101's walk: every colorSources line. estimates/reads are not in that
     walk — Tata's fin-pitch read cites chunk_4_6.jpg as geometry, which is
     allowed. A colour line that names the chunk or an ortho pixel as a
     sample is the ruling Sahir has not made. */
  for (const [role, line] of Object.entries(section.colorSources)) {
    if (role === "why") continue;
    assert.ok(!/chunk_\d+_\d+\.jpg|\bortho pixel\b|\borthophoto pixel\b/i.test(line),
      `colour ${role} is sampled off orthophoto pixels, which is the ruling Sahir has not made`);
  }
});

/* ------------------------------------------------------------- the module */

test("the module carries no dimension of its own — geometry is data", () => {
  const src = moduleSrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const allowed = new Map([
    ["43758.5453", "hash constant"], ["131.71", "hash constant"],
    ["57.13", "hash constant"], ["7.9", "hash constant"],
    ["0.65", "material metalness"], ["0.4", "material roughness"],
    ["0.95", "material roughness"], ["0.0", "material metalness"],
    ["0.5", "a half: the centre of a cell, a bay, a bar or a band"],
  ]);
  const found = new Set(src.match(/\b\d+\.\d+\b/g) || []);
  for (const n of found) {
    assert.ok(allowed.has(n),
      `${n} is a bare number in the builder — move it into the section's derivations, estimates, reads or draw block`);
  }
  for (const key of ["extrusionAboveRim", "buildingHeight", "faceSets", "spacing", "barCentres",
    "groundCell", "skirtDepth", "tuftDensity"]) {
    assert.ok(src.includes(key), `the builder never reads ${key}`);
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
  assert.deepEqual([...new Set(keys)], ["tata"], "the module reads a key that is not its own");
  /* And it must never read a measured file, least of all the LiDAR one. */
  const bare = moduleSrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.equal(/campus-lidar|campus-arcgis|campus-3d/.test(bare), false,
    "the module opens a measured file — everything it needs is in its own section");
});

const flat = () => 20;
const build = (g = flat) => createPhotoTata(null, { photo: { tata: section }, heightAt: g, surfaceAt: g });

/** The seat, mirrored from campus-massing.js rather than from the module. */
function seatOf(ground) {
  const top = roofElevation(section.measured.mass.ring, section.grid.extrusionAboveRim, ground);
  return {
    parapetTopY: top,
    roofDeckY: top - section.grid.parapet,
    level1Y: top - section.grid.buildingHeight,
  };
}

test("the module builds every system, and the counts are the declared ones", () => {
  const { group, counts } = build();
  for (const [k, v] of Object.entries(section.counts)) {
    if (k === "note") continue;
    assert.equal(counts[k], v, `count ${k}`);
  }
  /* Recomputed here from the SURVEY, not trusted from the declaration. */
  const storeys = section.grid.levelsAboveGrade;
  assert.equal(counts.edges, EDGES.length);
  assert.equal(counts.glazingBands, EDGES.length * storeys, "one glazing band per surveyed edge per storey");
  assert.equal(counts.spandrelBands, EDGES.length * storeys, "one spandrel band per surveyed edge per storey");
  assert.equal(counts.parapetRuns, EDGES.length, "one parapet run per surveyed edge");
  assert.equal(counts.finBars, counts.fins * section.system.fin.barCount);
  /* THE FIN STATIONS, recomputed edge by edge from the survey ring and the
     measured pitch — the module's own count is never trusted. */
  let stations = 0;
  for (const [name, set] of Object.entries(section.system.faceSets)) {
    if (!set.finned) continue;
    for (const k of set.edges) stations += Math.floor(edgeAt(k).length / section.system.fin.spacing);
  }
  assert.equal(counts.fins, stations * storeys,
    "the fin count is not the measured pitch laid whole along the survey ring's own finned edges");
  /* A survey jog too short for one fin gets none, which is why the built count
     is under the ideal — and the section says so. */
  assert.ok(counts.fins / storeys < section.system.fin.perStorey,
    "the built stations exceed the unbroken-run ideal, which is impossible");

  for (const n of ["tata-facades", "tata-roof", "tata-ground"]) {
    assert.ok(group.children.find((c) => c.name === n), `no ${n} group`);
  }
  assert.ok(group.children.find((c) => c.name === "tata-shell-derived"), "no shell — the silhouette is this module's");

  const missing = createPhotoTata(null, { photo: {}, heightAt: flat, surfaceAt: flat });
  assert.deepEqual(missing.counts, {}, "a missing section builds nothing and breaks nothing");
  assert.throws(() => createPhotoTata(null, { photo: { tata: section } }), /surfaceAt/,
    "a missing sampler must not be silent");
});

test("PRE-MERGE GUARD: a section without the apparatus builds NOTHING and names what it wants", () => {
  for (const strip of ["grid", "system", "measured", "draw", "estimates", "reads", "colors", "roof", "ground"]) {
    const half = { ...section };
    delete half[strip];
    const r = createPhotoTata(null, { photo: { tata: half }, heightAt: flat, surfaceAt: flat });
    assert.equal(r.group.children.length, 0, `a section with no ${strip} drew geometry off a shape it does not have`);
    assert.match(r.counts.pendingMerge, new RegExp(strip),
      "the guard must name what it is waiting for, so the merge cannot half-land unnoticed");
  }
  /* And the finer keys the whole build turns on. */
  const noExtrusion = { ...section, grid: { ...section.grid } };
  delete noExtrusion.grid.extrusionAboveRim;
  const r = createPhotoTata(null, { photo: { tata: noExtrusion }, heightAt: flat, surfaceAt: flat });
  assert.equal(r.group.children.length, 0);
  assert.match(r.counts.pendingMerge, /extrusionAboveRim/);
  /* An undeclared colour role must THROW rather than silently ship white. */
  const noColour = { ...section, colors: { ...section.colors } };
  delete noColour.colors.finSilver;
  assert.throws(() => createPhotoTata(null, { photo: { tata: noColour }, heightAt: flat, surfaceAt: flat }),
    /no colour declared for role "finSilver"/,
    "campus-materials.js ships opaque WHITE for a missing colour and that must never reach a material");
  /* A face set that stops covering the ring must refuse to build, because the
     uncovered elevation would ship as bare shell and look finished. */
  const shortSets = { ...section, system: { ...section.system, faceSets: { ...section.system.faceSets } } };
  delete shortSets.system.faceSets.north;
  assert.throws(() => createPhotoTata(null, { photo: { tata: shortSets }, heightAt: flat, surfaceAt: flat }),
    /face sets cover \d+ of \d+/,
    "an unnamed elevation would ship as bare shell with nothing on screen to say so");
});

test("the group is added to a scene when there is one", () => {
  const added = [];
  const r = createPhotoTata({ add: (g) => added.push(g) }, { photo: { tata: section }, surfaceAt: flat });
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

test("the height chain lands where the documents put it, on every surface", () => {
  const sloped = (x, z) => 20 + 1.2 * Math.sin(x / 14) + 0.9 * Math.cos(z / 17);
  for (const [label, ground] of [["flat", flat], ["slope", sloped], ["drawn", drawnGround]]) {
    const { counts } = build(ground);
    const want = seatOf(ground);
    near(counts.parapetTopY, want.parapetTopY, 1e-9, `${label}: the module's parapet plane is not campus-massing's seat plus the section's extrusion`);
    near(counts.roofDeckY, want.roofDeckY, 1e-9, `${label}: the roof deck is not one parapet below the parapet top`);
    near(counts.level1Y, want.level1Y, 1e-9, `${label}: Level 1 is not the stated 100 ft below the parapet`);
    /* Six storeys plus a parapet close the whole extrusion, with no residual. */
    near(counts.roofDeckY - counts.level1Y,
      section.grid.levelsAboveGrade * section.grid.floorToFloor, 1e-9,
      `${label}: the storey stack does not fill the shell from Level 1 to the roof deck`);
  }

  /* ON THE REAL TERRAIN: the drawn top and the documents' absolute top must
     agree to the residual the section declares and explains, and no further. */
  const drawnTop = seatOf(drawnGround).parapetTopY;
  const residual = section.grid.parapetRendererY - drawnTop;
  assert.ok(Math.abs(residual) < 0.5,
    `the drawn parapet is ${residual.toFixed(3)} m off the documents' absolute — beyond half a metre the seat and the chain are describing different buildings`);
  assert.match(section.conflicts.join("\n"), /conflicts\.seatDatum/,
    "the residual between the extrusion and the absolute must be a declared conflict, not a silent drift");

  /* LEVEL 1 IS BURIED, and that is the terrain's fault and is left standing. */
  const l1 = seatOf(drawnGround).level1Y;
  let lowest = Infinity;
  for (const [x, z] of ring0) lowest = Math.min(lowest, drawnGround(x, z));
  assert.ok(l1 < lowest,
    "Level 1 is no longer under the drawn 2014 surface — either the terrain changed epoch or the height chain moved");
  assert.match(section.absent.join("\n"), /PRE-CONSTRUCTION SURFACE/,
    "the buried storey is a withholding about the terrain and must stay declared");

  /* AND THE INDEPENDENT CORROBORATION: the derived Level 2 floor, which came
     only from a drawn +410 ft spot and GB7's sentence, lands within a quarter
     of a metre of the 2014 flight's own highest ground under the ring — the
     Urey Green edge. Nothing in the height chain knows that. */
  const level2 = l1 + section.grid.floorToFloor;
  let highest = -Infinity;
  for (const [x, z] of ring0) highest = Math.max(highest, drawnGround(x, z));
  assert.ok(Math.abs(level2 - highest) < 0.5,
    `the derived Level 2 floor is ${(level2 - highest).toFixed(2)} m off the 2014 grade at the Urey Green edge — `
    + "GB7 says Level 2 is entered directly from Urey Green and the two epochs should still nearly agree there");
});

test("nothing hovers and nothing sinks — flat, an exaggerated slope, and the DRAWN LiDAR surface", () => {
  const sloped = (x, z) => 20 + 1.2 * Math.sin(x / 14) + 0.9 * Math.cos(z / 17);
  const lift = overlayLift("pad");
  for (const [label, ground] of [["flat", flat], ["slope", sloped], ["drawn", drawnGround]]) {
    const { group, counts } = build(ground);
    group.updateMatrixWorld(true);
    const { parapetTopY, roofDeckY, level1Y } = seatOf(ground);

    /* THE SHELL is skirted below the lowest drawn surface under the ring, so
       no terrain triangle can show through it, and it never runs away. */
    const shell = group.children.find((c) => c.name === "tata-shell-derived");
    shell.geometry.computeBoundingBox();
    const bb = shell.geometry.boundingBox;
    let lowestUnder = Infinity;
    for (const [x, z] of ring0) lowestUnder = Math.min(lowestUnder, ground(x, z));
    near(bb.max.y, roofDeckY, 1e-4, `${label}: the shell does not top out on the roof deck`);
    assert.ok(bb.min.y <= Math.min(level1Y, lowestUnder) + 1e-6,
      `${label}: the shell's base at ${bb.min.y.toFixed(2)} floats over the drawn surface`);
    assert.ok(bb.min.y >= Math.min(level1Y, lowestUnder) - 1.0,
      `${label}: the shell plunges to ${bb.min.y.toFixed(2)} — a runaway skirt`);

    /* THE FACADE fills the shell exactly and never leaves it. */
    let checked = 0;
    let lowBand = Infinity;
    let highBand = -Infinity;
    each(group.children.find((c) => c.name === "tata-facades"), (x, y, z, sy) => {
      lowBand = Math.min(lowBand, y - sy / 2);
      highBand = Math.max(highBand, y + sy / 2);
      checked += 1;
    });
    near(lowBand, level1Y, 1e-4, `${label}: the facade does not start at the Level 1 floor`);
    near(highBand, roofDeckY, 1e-4, `${label}: the facade does not top out on the roof deck`);

    /* THE PARAPET stands on the deck and stops at the stated top. */
    each(group.children.find((c) => c.name === "tata-roof"), (x, y, z, sy, o) => {
      assert.ok(y - sy / 2 >= roofDeckY - 1e-4,
        `${label}: ${o.name} dips to ${(y - sy / 2).toFixed(3)} into the shell`);
      assert.ok(y + sy / 2 <= parapetTopY + 1e-4,
        `${label}: ${o.name} stands at ${(y + sy / 2).toFixed(3)}, over the stated parapet top`);
      checked += 1;
    });

    /* THE GROUND BAND seats on the DRAWN surface, one item at a time. */
    each(group.children.find((c) => c.name === "tata-ground"), (x, y, z, sy, o) => {
      const g = ground(x, z);
      if (/^ground-boulders/.test(o.name || "")) {
        /* A boulder is HALF-BURIED — the sourced character — so its centre is
           on the surface and only its rise shows. */
        near(y, g, 2e-4, `${label}: a boulder at (${x.toFixed(1)}, ${z.toFixed(1)}) is not set into the drawn surface`);
        return;
      }
      if (/^ground-(terrace|north-plaza|west-apron|swale|boardwalk|bed-mulch)/.test(o.name || "")) {
        near(y, g + lift, 2e-4,
          `${label}: a ground decal at (${x.toFixed(1)}, ${z.toFixed(1)}) is off the drawn surface`);
        return;
      }
      /* Planting stands ON the surface: bottom on it, nothing hanging under. */
      near(y - sy / 2, g, 2e-4,
        `${label}: ${o.name} at (${x.toFixed(1)}, ${z.toFixed(1)}) does not stand on the drawn surface`);
      checked += 1;
    });
    assert.ok(checked > 1500, `${label}: only ${checked} placements checked — the loops did not run`);
    assert.ok(counts.finBars > 5000, `${label}: the fins did not build`);
  }
});

test("the fins are laid at the measured pitch, on the ring, inside the facade zone", () => {
  const { group } = build();
  group.updateMatrixWorld(true);
  const bars = [];
  each(group.children.find((c) => c.name === "tata-facades"), (x, y, z, sy, o) => {
    if (o.name === "facade-fin-bars-sourced") bars.push([x, z]);
  });
  assert.ok(bars.length > 5000, "the fin bars did not build");

  /* Every bar stands off the ring within the axon-derived facade zone, and
     never inside the building. */
  const distToRing = (x, z) => {
    let d = Infinity;
    for (const e of EDGES) {
      const dx = e.b[0] - e.a[0];
      const dz = e.b[1] - e.a[1];
      const l2 = dx * dx + dz * dz;
      let t = l2 ? ((x - e.a[0]) * dx + (z - e.a[1]) * dz) / l2 : 0;
      t = Math.max(0, Math.min(1, t));
      d = Math.min(d, Math.hypot(x - (e.a[0] + dx * t), z - (e.a[1] + dz * t)));
    }
    return d;
  };
  let worst = 0;
  for (const [x, z] of bars) {
    assert.equal(inRing(x, z, ring0), false, `a fin bar at (${x.toFixed(2)}, ${z.toFixed(2)}) stands inside the building`);
    worst = Math.max(worst, distToRing(x, z));
  }
  assert.ok(worst <= section.system.facadeZone,
    `a fin bar reaches ${worst.toFixed(3)} m off the survey ring against the ${section.system.facadeZone} m facade zone the axon's 65 ft leaves`);

  /* THE STATION GATE. The fin stations on the longest finned edge are
     recomputed here from the survey and the measured pitch, and the BUILT bars
     must sit on them — a pitch that drifted in the builder fails here even if
     the count still matched. */
  const longest = section.system.faceSets.south.edges
    .map((k) => edgeAt(k)).sort((a, b) => b.length - a.length)[0];
  const spacing = section.system.fin.spacing;
  const n = Math.floor(longest.length / spacing);
  const u0 = (longest.length - (n - 1) * spacing) / 2;
  const tx = (longest.b[0] - longest.a[0]) / longest.length;
  const tz = (longest.b[1] - longest.a[1]) / longest.length;
  const stations = [];
  for (let i = 0; i < n; i++) {
    const u = u0 + i * spacing;
    stations.push([longest.a[0] + tx * u, longest.a[1] + tz * u]);
  }
  assert.ok(stations.length > 40, "the longest south run should carry dozens of fins");
  for (const [sx, sz] of stations) {
    const hit = bars.some(([x, z]) => Math.hypot(x - sx, z - sz) <= section.system.facadeZone + 1e-3);
    assert.ok(hit, `no fin stands at the derived station (${sx.toFixed(2)}, ${sz.toFixed(2)})`);
  }
  /* And a pitch nudged by one pixel must MISS those stations, or the gate
     proves nothing. */
  const offSpacing = (section.derivations.readings.ortho.finPitchPx + 1) / section.derivations.readings.ortho.pxPerM;
  const m = Math.floor(longest.length / offSpacing);
  const v0 = (longest.length - (m - 1) * offSpacing) / 2;
  let misses = 0;
  for (let i = 0; i < m; i++) {
    const u = v0 + i * offSpacing;
    const px = longest.a[0] + tx * u;
    const pz = longest.a[1] + tz * u;
    if (!stations.some(([sx, sz]) => Math.hypot(px - sx, pz - sz) < 0.1)) misses += 1;
  }
  assert.ok(misses > m / 2,
    "a one-pixel change in the measured pitch still lands on the shipped stations — the station gate is vacuous");
});

test("the ground band stays inside its declared bounds and clear of the building", () => {
  const B = section.bounds;
  const G = section.ground;
  const rects = [G.terrace, G.northPlaza, G.westApron, G.swale, G.boardwalk, ...G.beds];
  for (const r of rects) {
    for (const [x, z] of [[r.x0, r.z0], [r.x1, r.z0], [r.x0, r.z1], [r.x1, r.z1]]) {
      assert.ok(x >= B.x0 && x <= B.x1 && z >= B.z0 && z <= B.z1,
        `a declared ground extent corner (${x}, ${z}) is outside the section's own bounds`);
      assert.equal(inRing(x, z, ring0), false,
        `a declared ground extent corner (${x}, ${z}) is inside the surveyed building`);
    }
    assert.ok(r.x1 > r.x0 && r.z1 > r.z0, "a declared ground extent is inverted or empty");
  }
  /* THE SCOPE LINE. Nothing may claim Urey Green, which is a shared landscape
     with its own future key. */
  assert.equal(B.z1, 192, "the scope line against Urey Green moved");
  for (const r of rects) {
    assert.ok(r.z1 <= 192, `a ground extent runs to z ${r.z1}, into the Urey Green quad this section does not claim`);
  }
  assert.match(section.ground.note, /ureygreen/, "the successor for everything south of the band must be named");
  assert.match(section.ground.planNote, /DECLARED-APPROXIMATE/);

  /* AND THE BUILT SCENE IS HELD TO THE SAME LINE, by its own bounding boxes
     rather than by its centres: a boulder whose centre is inside the band and
     whose body is not has still crossed into a landscape this section does not
     claim. Nothing built by this module — facade, roof or ground — may leave
     the declared band on any side. */
  const { group } = build(drawnGround);
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  assert.ok(box.min.x >= B.x0 && box.max.x <= B.x1,
    `the built section spans x ${box.min.x.toFixed(2)}..${box.max.x.toFixed(2)} against a declared ${B.x0}..${B.x1}`);
  assert.ok(box.min.z >= B.z0 && box.max.z <= B.z1,
    `the built section spans z ${box.min.z.toFixed(2)}..${box.max.z.toFixed(2)} against a declared ${B.z0}..${B.z1} — the south edge is the scope line against Urey Green`);
  each(group.children.find((c) => c.name === "tata-ground"), (x, y, z) => {
    assert.equal(inRing(x, z, ring0), false,
      `a built ground item at (${x.toFixed(1)}, ${z.toFixed(1)}) is inside the surveyed building`);
  });
  /* A bed too narrow to CONTAIN a class must not get it — the rule that keeps
     the south berm's planting off the scope line. The 1.2 m south berm is the
     case, and it must hold bunchgrass and neither shrubs nor boulders. */
  const berm = G.beds.find((b) => b.id === "southBerm");
  assert.ok(berm.z1 - berm.z0 < 2 * section.ground.shrubRadius * (1 + section.draw.scatterSpread),
    "the south berm is no longer the narrow case this rule exists for — re-check that the rule still bites");
});

test("nothing invented sits inside another measured building's footprint", () => {
  const others = campus.buildings.filter((b) => b.p && b.p.length >= 3 && !/Tata/i.test(b.n || ""));
  const G = section.ground;
  for (const r of [G.terrace, G.northPlaza, G.westApron, G.swale, G.boardwalk, ...G.beds]) {
    for (const [x, z] of [[r.x0, r.z0], [r.x1, r.z0], [r.x0, r.z1], [r.x1, r.z1]]) {
      for (const b of others) {
        assert.ok(!inRing(x, z, b.p), `(${x}, ${z}) is inside ${b.n || "an unnamed mass"}`);
      }
    }
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
      else if (o.isMesh) out.push([o.position.x, o.position.y, o.position.z,
        ...Array.from(o.geometry.attributes.position.array.slice(0, 32))]);
    });
    return out;
  };
  assert.deepEqual(sig(a), sig(b));
});

test("the material library is on the surfaces, and provenance is readable off the scene", () => {
  assert.match(moduleSrc, /(?:shared|create)MaterialLibrary/, "surfaces come from campus-materials.js");
  const { group } = build();
  let textured = 0;
  let glass = 0;
  group.traverse((o) => {
    if (!o.isMesh && !o.isInstancedMesh) return;
    for (const m of [].concat(o.material)) {
      if (m?.map && m?.roughnessMap) textured += 1;
      if (m?.transparent && m.opacity < 1) glass += 1;
    }
  });
  assert.ok(textured >= 6, `only ${textured} textured meshes — the library is not applied`);
  assert.ok(glass >= 1, "the glazing does not carry the library's glass");

  const names = [];
  group.traverse((o) => { if (o.name) names.push(o.name); });
  for (const must of ["tata-shell-derived", "facade-spandrel-sourced", "facade-glass-vision-sourced",
    "facade-glass-electro-estimated", "facade-glass-open-estimated", "facade-fin-bars-sourced",
    "parapet-runs-derived", "coping-runs-estimated", "ground-boulders-sourced",
    "ground-bunchgrass-estimated", "ground-swale-sourced"]) {
    assert.ok(names.includes(must), `no ${must} in the scene — the tier must be readable off a render`);
  }
});

/* ------------------------------------------------- elevated depth write */

test("elevated surfaces write depth — the overlay ladder is for the ground", () => {
  /* T1 / critic finding [0]: the ExtrudeGeometry roof cap was given
     applyOverlayDepth(..., "pad"), so campus-overlay.js set depthWrite:false
     on a 27 m roof and north-west ground decals painted through it. Glass
     is allowed to skip the write (the library's glass class is transparent
     at 0.35); every other material on a surface more than ~3 m above the
     drawn terrain is a wall, a roof, a parapet or a fin, and must occlude. */
  const ground = drawnGround;
  const { group } = build(ground);
  group.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const ELEVATED = 3;
  const offenders = [];
  group.traverse((o) => {
    if (!o.isMesh && !o.isInstancedMesh) return;
    const mats = [].concat(o.material);
    const bad = mats.filter((m) => m && m.depthWrite === false && !m.transparent);
    if (!bad.length) return;
    box.setFromObject(o);
    const gx = (box.min.x + box.max.x) / 2;
    const gz = (box.min.z + box.max.z) / 2;
    const g = ground(gx, gz);
    if (!Number.isFinite(g)) return;
    /* Ground pads sit centimetres above grade. The roof deck is ~26 m up.
       A mesh whose world box REACHES more than ~3 m above the drawn
       terrain has an elevated surface; opaque depthWrite:false on that
       mesh is the see-through-roof class (the shell's minY is the skirt
       below grade, so minY-only would miss the extrusion cap). */
    if (box.max.y > g + ELEVATED) {
      offenders.push(
        `${o.name || "(unnamed)"} worldY ${box.min.y.toFixed(2)}..${box.max.y.toFixed(2)} `
        + `against terrain ${g.toFixed(2)} (${bad.length} opaque depthWrite:false material${bad.length === 1 ? "" : "s"})`,
      );
    }
  });
  assert.equal(offenders.length, 0,
    `opaque depthWrite:false on a surface more than ${ELEVATED} m above terrain: ${offenders.join("; ")}`);
});
