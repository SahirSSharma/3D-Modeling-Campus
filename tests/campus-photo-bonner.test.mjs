/* Bonner Hall + the hexagonal breezeway — INVENTED class, R4 batch, a NEW
 * section (the star of R4: the signature structure of this half of Revelle).
 *
 * WHAT THIS SUITE EXISTS TO HOLD. The section makes five claims a later edit
 * could quietly undo, and each has a gate written against the claim:
 *
 *   - THE BREEZEWAY IS WHERE THE RINGS ARE AND AS TALL AS THE LASER SAYS.
 *     The superseded legacy object stood 16.15 m west at 3 x 3.6 m; the OSM
 *     h values are deck reads. The rings are deepEqualed against the survey,
 *     the envelope/rows/corridor arithmetic is RECOMPUTED here from the
 *     rings, the OSM-h-as-deck-read identification is recomputed, and the
 *     laser's refusal of both rings (no osmHeights key) is itself gated.
 *
 *   - THE FACADE HANGS FROM THE MEASURED PLATE. massHeights' 19.2 includes
 *     the louvre spine; nothing treated may rise past repo 35.71 except the
 *     spine itself, and the storey pitch must be the measured 3.965, never
 *     the ArcGIS 4.275 formula.
 *
 *   - EVERY FIGURE RECOMPUTES AND EVERY READING UNDERNEATH IT IS PINNED.
 *     The axiom-gate apparatus (tests/helpers/axiom-gate.mjs) runs here,
 *     never forked; every EPT probe literal, ring read, and channel-mean
 *     colour read is pinned to a literal in THIS file.
 *
 *   - THE WITHHOLDINGS ARE REAL IN THE SCENE. Declare-and-withhold pairs
 *     carry BOTH counts (facade bands the drawn ground buries, podium risers
 *     the decimated terrain cannot carry, the two junction hex cells the OSM
 *     overrun pushes past the Mayer face) and the absent list's objects
 *     (balconies, penthouse, planters, arch profiles, ballast) must appear
 *     in NO mesh name.
 *
 *   - PROVENANCE LIVES IN THE MESH NAMES. Deck 3's strand mapping is
 *     estimated where decks 1-2 are sourced; the north/east/west facades
 *     extend the court-face (true south, +z) system — arbitration D6;
 *     the arcade columns extend a measured pitch — and
 *     every one of those distinctions is a -sourced/-estimated suffix a
 *     render alone can show.
 *
 * The section ships under the `bonner` key of docs/data/campus-photo-detail.json
 * once main merges Revelle-College-Sources/merge/r4/bonner.json.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as THREE from "../docs/vendor/three/three.module.min.js";
import { createPhotoBonner } from "../docs/js/campus-photo-bonner.js";
import { makeSurfaceSampler } from "../docs/js/campus-terrain.js";
import { roofElevation } from "../docs/js/campus-massing.js";
import {
  assertCoverage, assertEstimateBands, assertPins, assertRelations,
  assertTierSymmetry, assertAbsentEntries, assertExprs,
} from "./helpers/axiom-gate.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(p, "utf8"));

const shipped = read(process.env.PHOTO_DETAIL || join(root, "docs/data/campus-photo-detail.json"));
const section = shipped.bonner;

/* The section is NEW in R4: when neither the merge file nor a shipped key
   exists there is nothing to test yet, and the addendum says SKIP, not fail. */
const t = section ? test : (name) => test(name, { skip: "no bonner section yet (pre-R4)" }, () => {});

const campus = read(join(root, "docs/data/campus-3d.json"));
const lidar = read(join(root, "docs/data/campus-lidar.json"));
const arcgis = read(join(root, "docs/data/campus-arcgis.json"));
const manifest = read(join(root, "docs/data/textures/manifest.json"));

const moduleSrc = readFileSync(join(root, "docs/js/campus-photo-bonner.js"), "utf8");
/* Gates that grep for forbidden constructs run on the CODE, not the prose. */
const moduleCode = moduleSrc
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/[^\n]*$/gm, "");

const near = (a, b, eps, what) =>
  assert.ok(typeof a === "number" && Math.abs(a - b) <= eps,
    `${what}: ${a} vs ${b} (tolerance ${eps})`);

const flat = () => 20;
const slope = (x, z) => 20 + 1.4 * Math.sin(x / 11) + 1.1 * Math.cos(z / 13);
const drawnGround = makeSurfaceSampler(lidar.terrain);
const build = (g = drawnGround) =>
  createPhotoBonner(null, { photo: { bonner: section }, heightAt: g, surfaceAt: g });

const div10 = (r) => r.map(([x, z]) => [x / 10, z / 10]);

/* The cell/rows rule, restated here so the section's rows and the module's
   cells are both held to the same derivation from the same rings. */
const ROWS_RULE = { maxDx: 0.3, minLen: 2.0, maxLen: 4.5, snap: 0.6 };
function rowsOf(ringOpen) {
  const ring = ringOpen.concat([ringOpen[0]]);
  const xs = ringOpen.map((p) => p[0]);
  const xmin = Math.min(...xs);
  const xmax = Math.max(...xs);
  const rows = { E: [], W: [] };
  for (let k = 0; k < ring.length - 1; k++) {
    const [ax, az] = ring[k];
    const [bx, bz] = ring[k + 1];
    const L = Math.hypot(bx - ax, bz - az);
    if (Math.abs(bx - ax) > ROWS_RULE.maxDx || L < ROWS_RULE.minLen || L > ROWS_RULE.maxLen) continue;
    const mx = (ax + bx) / 2;
    const mz = (az + bz) / 2;
    if (Math.abs(mx - xmax) < ROWS_RULE.snap) rows.E.push(Number(mz.toFixed(3)));
    else if (Math.abs(mx - xmin) < ROWS_RULE.snap) rows.W.push(Number(mz.toFixed(3)));
  }
  rows.E.sort((a, b) => a - b);
  rows.W.sort((a, b) => a - b);
  return rows;
}

const ringDist = (x, z, r) => {
  let best = Infinity;
  for (let i = 0; i < r.length - 1; i++) {
    const [ax, az] = r[i];
    const [bx, bz] = r[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const l2 = dx * dx + dz * dz;
    const tt = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0;
    best = Math.min(best, Math.hypot(x - (ax + tt * dx), z - (az + tt * dz)));
  }
  return best;
};

const inRing = (x, z, r) => {
  let ins = false;
  for (let i = 0, j = r.length - 2; i < r.length - 1; j = i++) {
    const [xi, zi] = r[i];
    const [xj, zj] = r[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
};

/** Every mesh's world bbox. */
function eachMesh(node, fn) {
  node.updateMatrixWorld(true);
  node.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    fn({
      name: o.name, mesh: o,
      xLo: bb.min.x, xHi: bb.max.x, yLo: bb.min.y, yHi: bb.max.y,
      zLo: bb.min.z, zHi: bb.max.z,
      x: (bb.min.x + bb.max.x) / 2, z: (bb.min.z + bb.max.z) / 2,
    });
  });
}

/** Every vertex of every mesh, in world coordinates. */
function eachVertex(node, fn) {
  node.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  node.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      fn(v.x, v.y, v.z, o.name);
    }
  });
}

/* ------------------------------------------------------------ the section */

t("the section exists and carries the whole apparatus", () => {
  for (const k of ["label", "epoch", "note", "bounds", "boundsNote", "sources",
    "measured", "derivations", "estimates", "reads", "draw", "system", "colors",
    "colorSources", "colorSourcesNote", "colorNote", "samples", "counts", "conflicts",
    "supersedes", "superseded", "supersededNote", "absent"]) {
    assert.ok(section[k] !== undefined, `section is missing ${k}`);
  }
  /* No seed: the module builds no irregularity at all, so a seed would be
     inert apparatus — a declared input nothing consumes (audit note 4). */
  assert.equal(section.seed, undefined,
    "a seed has appeared; if anything is now irregular it must be consumed and gated, and if not it is inert apparatus");
  assert.match(section.label, /MEASURED ROOF PLATE/);
  assert.match(section.label, /TWO ANTIPHASE ZIGZAG CHAINS/);
  assert.match(section.label, /retired by the R4 massing override/i);
  assert.match(section.note, /INVENTED/);
  assert.match(section.epoch, /2014 LiDAR/);
  assert.match(section.epoch, /NO ORTHO-DERIVED POSITION SHIPS/i);
  assert.match(section.epoch, /DEAD epoch break/i,
    "the 1968 court ground is superseded by today's lawns and the epoch must say so");
});

t("every source is described and dated, and the load-bearing ones are cited", () => {
  assert.ok(section.sources.length >= 12, `only ${section.sources.length} sources`);
  for (const s of section.sources) {
    assert.ok(s.length >= 80, `source is not described: ${s.slice(0, 70)}`);
    assert.match(s, /\b(19|20)\d\d\b/, `source has no date: ${s.slice(0, 70)}`);
  }
  const joined = section.sources.join("\n");
  for (const must of [
    /bb2799709r/, /bb34824128/, /bb61786853/, /bb7953510x/, /bb46427343/,
    /bb0137569z/, /bb9362031p/, /flickr-9339401716/, /steinhart-2015_CADU171/,
    /campus-lidar\.json/, /campus-arcgis\.json/, /campus-3d\.json/,
    /chunk_4_6\.jpg/, /chunk_5_6\.jpg/, /CA_SanDiegoQL2_2014/,
    /modernistarchitecture/, /Know-Your-Campus/,
  ]) {
    assert.match(joined, must, `a load-bearing source is not cited: ${must}`);
  }
});

/* ================== THE SURVEY, CARRIED VERBATIM ================== */

t("Bonner's ring is arcgis.massing[206], byte for byte, with its own keys", () => {
  const B = section.measured.building;
  assert.equal(B.gisName, "Bonner Hall");
  assert.equal(arcgis.massing[B.massingIndex].n, "Bonner Hall",
    "massing[206] no longer names Bonner — the index-stable crop rule may have been violated upstream");
  assert.deepEqual(B.ring, div10(arcgis.massing[B.massingIndex].r[0]),
    "building ring is not the survey's, verbatim at /10");
  assert.equal(arcgis.massing[B.massingIndex].r.length, 1, "Bonner has grown a hole");
  const cx = B.ring.reduce((s, p) => s + p[0], 0) / B.ring.length;
  const cz = B.ring.reduce((s, p) => s + p[1], 0) / B.ring.length;
  assert.equal(B.mKey, `m:${Math.round(cx)},${Math.round(cz)}`, "the m: key is not the ring's own");
  near(B.massHeight, lidar.massHeights[B.mKey], 1e-9, "massHeight is not massHeights at the ring's key");
  near(B.heightsLabel, lidar.heights["Bonner Hall"], 1e-9, "heightsLabel is not the file's");
  near(B.arcgisH, arcgis.massing[B.massingIndex].h, 1e-9, "arcgisH is not the file's");
  assert.equal(B.levels, 4, "Bonner is four storeys on four independent sources");
  near(B.osmH, campus.buildings[B.osmIndex].h, 1e-9, "the recorded OSM h is not the file's");
  /* Area and bbox are the ring's own. */
  let a = 0;
  for (let i = 0; i < B.ring.length - 1; i++) {
    a += B.ring[i][0] * B.ring[i + 1][1] - B.ring[i + 1][0] * B.ring[i][1];
  }
  near(B.areaM2, Math.abs(a / 2), 0.01, "areaM2 is not the shoelace of the ring");
  const xs = B.ring.map((p) => p[0]);
  const zs = B.ring.map((p) => p[1]);
  near(B.bbox.x0, Math.min(...xs), 1e-9, "bbox x0");
  near(B.bbox.x1, Math.max(...xs), 1e-9, "bbox x1");
  near(B.bbox.z0, Math.min(...zs), 1e-9, "bbox z0");
  near(B.bbox.z1, Math.max(...zs), 1e-9, "bbox z1");
  /* The wing and shaft boxes sit inside the ring's own extent. */
  for (const box of [B.wing, B.shaft]) {
    assert.ok(box.x0 >= B.bbox.x0 - 1e-9 && box.x1 <= B.bbox.x1 + 1e-9
      && box.z0 >= B.bbox.z0 - 1e-9 && box.z1 <= B.bbox.z1 + 1e-9,
      "a declared sub-box has left the surveyed footprint");
  }
});

t("the chain rings are the OSM survey's, verbatim, and the laser REFUSED them", () => {
  const C = section.measured.breezeway.chains;
  for (const [key, idx] of [["osm:917", 917], ["osm:918", 918]]) {
    const c = C[key];
    assert.equal(c.index, idx);
    assert.deepEqual(c.ring, campus.buildings[idx].p.map((q) => [q[0], q[1]]),
      `${key}'s ring is not campus-3d buildings[${idx}].p, verbatim`);
    near(c.osmH, campus.buildings[idx].h, 1e-9, `${key}'s recorded h is not the file's`);
    /* The rows are the rings' own, by the rule. */
    assert.deepEqual(c.rows, rowsOf(c.ring),
      `${key}'s declared rows are not the ring's own outer-face centroids`);
    assert.equal(c.rows.E.length + c.rows.W.length, 7,
      `${key} no longer derives 7 cells — the zigzag has changed`);
  }
  /* THE LASER'S REFUSAL IS EVIDENCE: a build to the OSM h ships the breezeway
     at barely half its surveyed height, and the section's whole height story
     rests on osmHeights having no opinion here. */
  for (const k of [917, 918]) {
    assert.ok(!(k in lidar.osmHeights) && !(String(k) in lidar.osmHeights),
      `lidar.osmHeights now carries key ${k} — the height conflict must be re-adjudicated, not silently kept`);
  }
  /* Envelope, recomputed from both rings together. */
  const all = [...C["osm:917"].ring, ...C["osm:918"].ring];
  const env = section.measured.breezeway.envelope;
  near(env.x0, Math.min(...all.map((p) => p[0])), 1e-9, "envelope x0");
  near(env.x1, Math.max(...all.map((p) => p[0])), 1e-9, "envelope x1");
  near(env.z0, Math.min(...all.map((p) => p[1])), 1e-9, "envelope z0");
  near(env.z1, Math.max(...all.map((p) => p[1])), 1e-9, "envelope z1");
});

t("every owned ground ring is the survey's, verbatim, by index", () => {
  const owned = section.measured.groundRings.owned;
  assert.equal(owned.length, 5);
  assert.deepEqual(owned.map((g) => g.index), [2009, 2166, 3269, 3270, 3271],
    "the owned index set has changed — landscape ownership is declared, not drifted");
  for (const g of owned) {
    assert.deepEqual(g.rings, arcgis.ground[g.index].r.map(div10),
      `ground #${g.index} is not the survey's rings at /10`);
    assert.equal(g.kind, arcgis.ground[g.index].k, `ground #${g.index}'s kind moved`);
    assert.ok(["lawn", "paving"].includes(g.role), `ground #${g.index} has unknown role ${g.role}`);
  }
});

/* ============ THE BREEZEWAY ARITHMETIC, RECOMPUTED FROM THE RINGS ============ */

t("envelope, corridor, rows and the legacy offset all recompute from the rings", () => {
  const R = section.derivations.readings.ring;
  const C = section.measured.breezeway.chains;
  const r917 = C["osm:917"].ring;
  /* Corridor edges: the east-bulge row at z ~ 269.8 has its outer face at
     x ~ 90.75 and its inner verts at x ~ 86.2. */
  const band = r917.filter((p) => p[1] > 267 && p[1] < 272.5);
  near(Math.max(...band.map((p) => p[0])), R.corridorOuterX, 0.1, "east outer face x");
  near(Math.min(...band.map((p) => p[0])), R.corridorInnerX, 0.1, "east inner face x");
  const r918 = C["osm:918"].ring;
  const wband = r918.filter((p) => p[1] > 250.5 && p[1] < 253.5);
  near(Math.min(...wband.map((p) => p[0])), R.corridorWestOuterX, 0.15, "west outer face x");
  near(Math.max(...wband.map((p) => p[0])), R.corridorWestInnerX, 0.15, "west inner face x");
  /* Row pins are the rings' own rows. */
  near(R.row917E1, C["osm:917"].rows.E[0], 1e-9, "row917E1");
  near(R.row917E4, C["osm:917"].rows.E[3], 1e-9, "row917E4");
  near(R.row918W1, C["osm:918"].rows.W[0], 1e-9, "row918W1");
  near(R.row918W3, C["osm:918"].rows.W[2], 1e-9, "row918W3");
  /* THE LEGACY OBJECT'S OWN NUMBERS, read off the shipped document — the
     supersession is an argument against a real record, not a memory. */
  const legacy = shipped.revelle?.systems?.breezeway;
  assert.ok(legacy, "revelle.systems.breezeway has vanished from the shipped doc — the supersedes record has lost its subject and must be re-argued");
  near(R.legacyCentreX, legacy.centreX, 1e-9, "legacyCentreX is not the shipped object's");
  near(R.legacyLevels, legacy.levels, 1e-9, "legacyLevels");
  near(R.legacyLevelHeight, legacy.levelHeight, 1e-9, "legacyLevelHeight");
});

t("THE SUPERSESSION: the record names the legacy object, the offset, and what main must do", () => {
  assert.equal(section.supersedes.length, 1);
  const s = section.supersedes[0];
  assert.equal(s.key, "revelle.systems.breezeway");
  assert.match(s.reason, /16\.15/);
  assert.match(s.reason, /71\.25/);
  assert.match(s.reason, /87\.4/);
  assert.match(s.reason, /3 levels x 3\.6/);
  assert.match(s.replacedBy, /osm:917\/osm:918/);
  assert.match(s.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(s.mainMustApply, /superseded/);
  assert.match(s.mainMustApply, /does NOT edit revelle/i,
    "the record must state that this section never touches the revelle section itself");
  /* Until main applies the flip, the legacy object must still be HELD for R4
     (owner field); after the flip, the revelle record must name bonner. */
  const legacy = shipped.revelle?.systems?.breezeway;
  const flipped = JSON.stringify(shipped.revelle?.superseded ?? {}).includes("bonner");
  assert.ok(legacy.owner === "R4" || flipped,
    "the shipped legacy breezeway is neither held for R4 nor superseded toward bonner — the merge state is inconsistent");
});

t("the deck-strand map is DERIVED from the OSM h pair, and deck 3 stays estimated", () => {
  const BW = section.system.breezeway;
  const C = section.measured.breezeway.chains;
  assert.equal(BW.decks.length, 3);
  for (const deck of BW.decks.slice(0, 2)) {
    /* The [sourced] assignment: each of the two lower decks rides the strand
       whose OSM h is the nearer read of its own measured plane. */
    let best = null;
    for (const key of Object.keys(C)) {
      const d = Math.abs(C[key].osmH - deck.h);
      if (!best || d < best.d) best = { key, d };
    }
    assert.equal(deck.strand, best.key,
      `deck at +${deck.h} declares strand ${deck.strand} but the OSM h pair reads ${best.key}`);
    assert.equal(deck.tier, "sourced");
    assert.ok(best.d <= 0.6 + 1e-9,
      `the OSM deck read is now ${best.d.toFixed(2)} m off — the identification needs re-arguing`);
  }
  assert.equal(BW.decks[2].tier, "estimated",
    "deck 3's strand mapping is gap g8 and must stay [estimated] until a drawing or drone frame appears");
  assert.match(BW.strandMapNote, /g8/);
  assert.match(BW.strandMapNote, /bb34824128/);
});

/* ==================== THE AXIOM LAYER, GATED ==================== */

const EPT = "CA_SanDiegoQL2_2014 full-depth EPT, research-bonner.md §2.3/§3.4 probe literals (probe-bonner.mjs / probe-breezeway.mjs / probe-court-west.mjs, rerunnable against the public bucket)";
const RNG = "arithmetic over the carried chain rings campus-3d.json buildings[917]/[918], recomputed in this suite";
const FLK = "Revelle-College-Sources/renders/bonner-sources/flickr-9339401716_bonner-2013.jpg, taken 2013-07-19, channel means (R+G+B)/3 over a pinned rect, reproduced with sharp 2026-08-21";
const OR4 = "docs/data/textures/chunk_4_6.jpg, 2026 build-time ortho at 8 px/m per manifest.json, channel means (R+G+B)/3 over a pinned rect, sharp 2026-08-21";
const OR5 = "docs/data/textures/chunk_5_6.jpg, 2026 build-time ortho at 4 px/m per manifest.json, channel means (R+G+B)/3 over a pinned rect, sharp 2026-08-21";

const pin = (value, truth, tol) => ({ value, truth, tol });
const READING_PINS = {
  "survey.massBonner": pin(15.4, "docs/data/campus-lidar.json massHeights['m:80,205'] — since the R4 arbitration override of 2026-08-21 the file ships 15.4 (lid = plate: 35.71 - base 20.3); the historical 19.2 read (plate + spine) is held in conflicts['bonner-drawn-prism-overshoot']"),
  "survey.heightsBonnerLabel": pin(19.4, "docs/data/campus-lidar.json heights['Bonner Hall'] — the un-overridden p-high over the crude OSM ring (plate + spine mechanism); still ships, still a loser for any parapet use"),
  "survey.arcgisH": pin(17.1, "docs/data/campus-arcgis.json massing[206].h = 4 levels x 4.275 — a FORMULA, admitted only as the fourth storey-count witness"),
  "survey.levels": pin(4, "docs/data/campus-arcgis.json massing[206].levels — one of four independent 4-storey witnesses"),
  "survey.osmBonnerH": pin(12, "campus-3d.json buildings[400].h — the OSM guess, a recorded loser"),
  "survey.osmH917": pin(8.4, "campus-3d.json buildings[917].h — a mapper's read of DECK 2, not a structure height"),
  "survey.osmH918": pin(4.8, "campus-3d.json buildings[918].h — a mapper's read of DECK 1"),
  "survey.datum": pin(102.4, "docs/data/campus-lidar.json datum: repo = flight elevation - 102.4"),
  "survey.terrainCourt": pin(20.4, "docs/data/campus-lidar.json terrain at the court (z/10, bilinear) — the decimated drawn grid's own read, cross-checked against the drawn sampler in this suite"),
  "ept.plateElev": pin(138.11, `${EPT} — the main roof plate, n~2700, p25-p75 spread 0.02 m`),
  "ept.eastGradeElev": pin(122.25, `${EPT} — class-2 ground median east of Bonner`),
  "ept.courtGroundElev": pin(122.78, `${EPT} — the breezeway court's class-2 median, n 660`),
  "ept.courtGroundN": pin(660, `${EPT} — a COUNT of the court ground returns`),
  "ept.westGradeRepo": pin(21.0, `${EPT} — ter(55,210), the west grade in repo metres`),
  "ept.wingRoofElev": pin(130.40, `${EPT} — the west wing's own roof plane`),
  "ept.spineP98Elev": pin(140.91, `${EPT} — the louvre crest, p98 of the spine band x 66..76`),
  "ept.chainReturns": pin(647, `${EPT} — a COUNT of non-ground returns inside the chain footprint`),
  "ept.deck1H": pin(4.2, `${EPT} — deck plate 1's height over the court ground (34 returns at 4.0..4.5)`),
  "ept.deck2H": pin(8.0, `${EPT} — deck plate 2 (28 returns)`),
  "ept.deck3H": pin(11.6, `${EPT} — deck plate 3 (187 returns at 11.5..12.5)`),
  "ept.canopyH": pin(15.2, `${EPT} — the umbrella canopy (345 returns)`),
  "ept.canopyFlatLo": pin(15.16, `${EPT} — the canopy top's minimum across all per-2-m z-slices: it does not step`),
  "ept.canopyFlatHi": pin(15.22, `${EPT} — the same maximum`),
  "ept.deck1Returns": pin(34, `${EPT} — a COUNT`),
  "ept.deck2Returns": pin(28, `${EPT} — a COUNT`),
  "ept.deck3Returns": pin(187, `${EPT} — a COUNT`),
  "ept.canopyReturns": pin(345, `${EPT} — a COUNT`),
  "ept.mayerEaveReturns": pin(42, `${EPT} — a COUNT at h=19.0, z>=277.5: Mayer's north eave (repo frame, +z = south) entering the box, NOT the breezeway`),
  "ept.westArcadeElev": pin(126.97, `${EPT} — the p50 plane west of the chain (x 78..83.8): the ground vault arcade`),
  "ept.eastArcadeH": pin(5.3, `${EPT} — the p50 plane height east of the chain (x 91..96)`),
  "ept.podiumWestRepo": pin(24.0, `${EPT} — court ground west of x~66 (24.0..24.7): the podium terrace`),
  "ept.podiumEastRepo": pin(20.4, `${EPT} — court ground east of the step (20.4..20.9)`),
  "ept.mayerFaceZ": pin(278.0, "research-mayer.md's GIS-derived Mayer court face, checked against this dossier's data (research-bonner.md §3.4) — where the chain lands"),
  "ring.envX0": pin(83.8, `${RNG} — min x over both rings`),
  "ring.envX1": pin(91.0, `${RNG} — max x`),
  "ring.envZ0": pin(249.7, `${RNG} — min z`),
  "ring.envZ1": pin(279.9, `${RNG} — max z`),
  "ring.corridorOuterX": pin(90.75, `${RNG} — ring 917's east outer face at the z~269.8 row`),
  "ring.corridorInnerX": pin(86.2, `${RNG} — ring 917's inner verts at the same row`),
  "ring.corridorWestOuterX": pin(83.85, `${RNG} — ring 918's west outer face at the z~252.15 row`),
  "ring.corridorWestInnerX": pin(88.4, `${RNG} — ring 918's east-side verts at the same row`),
  "ring.row917E1": pin(252.75, `${RNG} — ring 917's first east-out row centroid`),
  "ring.row917E4": pin(278.2, `${RNG} — ring 917's last east-out row centroid`),
  "ring.row918W1": pin(252.15, `${RNG} — ring 918's first west-out row centroid`),
  "ring.row918W3": pin(269.15, `${RNG} — ring 918's third west-out row centroid`),
  "ring.legacyCentreX": pin(71.25, "the shipped revelle.systems.breezeway's own centreX — the losing side of the supersession, read off the shipped doc in this suite"),
  "ring.legacyLevels": pin(3, "the shipped legacy object's levels — wrong in section, quoted as the loser"),
  "ring.legacyLevelHeight": pin(3.6, "the shipped legacy object's levelHeight — the invented 3 x 3.6 section"),
  "px.goldR": pin(174.0, `${FLK}: rect (660,380,980,560), sunlit gold aggregate — R`, 0.5),
  "px.goldG": pin(143.9, "the same pinned rectangle, the G channel of the read", 0.5),
  "px.goldB": pin(106.7, "the same pinned rectangle, the B channel of the read", 0.5),
  "px.goldShadedR": pin(96.0, `${FLK}: rect (300,120,560,150), shaded upper spandrel — R (UNCONSUMED, see samples)`, 0.5),
  "px.goldShadedG": pin(91.1, "the same pinned rectangle, the G channel of the read", 0.5),
  "px.goldShadedB": pin(81.3, "the same pinned rectangle, the B channel of the read", 0.5),
  "px.creamR": pin(175.0, `${FLK}: rect (560,286,900,300), sunlit cream slab edge — R`, 0.5),
  "px.creamG": pin(170.0, "the same pinned rectangle, the G channel of the read", 0.5),
  "px.creamB": pin(163.8, "the same pinned rectangle, the B channel of the read", 0.5),
  "px.windowR": pin(102.4, `${FLK}: rect (380,205,560,240), window band — R`, 0.5),
  "px.windowG": pin(102.4, "the same pinned rectangle, the G channel of the read", 0.5),
  "px.windowB": pin(97.3, "the same pinned rectangle, the B channel of the read", 0.5),
  "px.balustradeR": pin(113.8, `${FLK}: rect (220,535,400,565), balustrade aggregate — R (UNCONSUMED, see samples)`, 0.5),
  "px.balustradeG": pin(106.2, "the same pinned rectangle, the G channel of the read", 0.5),
  "px.balustradeB": pin(97.2, "the same pinned rectangle, the B channel of the read", 0.5),
  "ortho.chunk46PxPerM": pin(8, "manifest.json chunk_4_6.jpg: w 2040 over x1-x0 = 255 — 8 px/m exactly, recomputed in this suite"),
  "ortho.chunk56PxPerM": pin(4, "manifest.json chunk_5_6.jpg: w 1020 over 255 — 4 px/m exactly"),
  "ortho.louvreCrossings": pin(60, "research-bonner.md §2.4 — a COUNT of brightness mean-crossings along the spine run in chunk_4_6"),
  "ortho.louvreRunM": pin(74.0, "the spine run's length, z 170..244 — asserted equal to spineZ1 - spineZ0 in relations"),
  "ortho.spineX0": pin(72, "research-bonner.md §2.4 — the spine band's west edge in world x"),
  "ortho.spineX1": pin(80, "the same spine band read, its east edge in world x"),
  "ortho.spineZ0": pin(170, "the spine profile run's north end (min z; repo frame, +z = south)"),
  "ortho.spineZ1": pin(244, "the same spine profile run, its south end in world z"),
  "ortho.canopyR": pin(156.7, `${OR5}: rect (30,418,44,432), one hex plate at ~(87,253) — R`, 0.5),
  "ortho.canopyG": pin(147.9, "the same pinned rectangle, the G channel of the read", 0.5),
  "ortho.canopyB": pin(137.1, "the same pinned rectangle, the B channel of the read", 0.5),
  "ortho.ballastR": pin(193.0, `${OR4}: rect (1912,424,1976,504) = world x 62..70, z 200..210, the roof ballast — R (consumed by the main roof plate since the R4 visual round: photo-bonner REPLACES_MEASURED)`, 0.5),
  "ortho.ballastG": pin(165.8, "the same pinned rectangle, the G channel of the read", 0.5),
  "ortho.ballastB": pin(144.4, "the same pinned rectangle, the B channel of the read", 0.5),
  "ortho.lawnR": pin(109.2, `${OR5}: rect (68,432,108,472), open lawn arcgis.ground#2166 — R`, 0.5),
  "ortho.lawnG": pin(117.8, "the same pinned rectangle, the G channel of the read", 0.5),
  "ortho.lawnB": pin(69.9, "the same pinned rectangle, the B channel of the read", 0.5),
  "ortho.walkR": pin(136.2, `${OR4}: rect (1960,864,1974,912), sunlit run of walk arcgis.ground#3271 — R`, 0.5),
  "ortho.walkG": pin(126.9, "the same pinned rectangle, the G channel of the read", 0.5),
  "ortho.walkB": pin(116.0, "the same pinned rectangle, the B channel of the read", 0.5),
  "ortho.lawn2009ShadowR": pin(54.1, `${OR4}: rect (1976,864,2024,920), inside lawn #2009 — R: tree-canopy shadow, the read that DISQUALIFIED the rect (UNCONSUMED)`, 0.5),
  "ortho.lawn2009ShadowG": pin(71.1, "the same pinned rectangle, the G channel of the read", 0.5),
  "ortho.lawn2009ShadowB": pin(69.4, "the same pinned rectangle, the B channel of the read", 0.5),
  "ortho.wingRoofR": pin(101.9, `${OR4}: rect (1844,440,1876,560) = world x 53.5..57.5, z 202..217, the wing roof field — R. DISQUALIFIED for a material (per-channel sd 61/47/35, rooftop structure) and parked UNCONSUMED in samples.wingRoofMixed`, 0.5),
  "ortho.wingRoofG": pin(102.5, "the same pinned rectangle, the G channel of the read", 0.5),
  "ortho.wingRoofB": pin(107.4, "the same pinned rectangle, the B channel of the read", 0.5),
};

t("S1(iii): every reading is pinned to the artefact it was read off", () => {
  const n = assertPins({
    readings: section.derivations.readings, pins: READING_PINS,
    namespaces: ["survey", "ept", "ring", "px", "ortho"],
    label: "bonner readings",
  });
  assert.ok(n >= 60, `only ${n} readings pinned`);
  /* The survey readings must BE the files'. */
  const S = section.derivations.readings.survey;
  near(S.massBonner, lidar.massHeights["m:80,205"], 1e-9, "massBonner is not the file's");
  near(S.heightsBonnerLabel, lidar.heights["Bonner Hall"], 1e-9, "heightsBonnerLabel");
  near(S.arcgisH, arcgis.massing[206].h, 1e-9, "arcgisH");
  near(S.osmH917, campus.buildings[917].h, 1e-9, "osmH917");
  near(S.osmH918, campus.buildings[918].h, 1e-9, "osmH918");
  near(S.osmBonnerH, campus.buildings[400].h, 1e-9, "osmBonnerH");
  near(S.datum, lidar.datum, 1e-9, "datum");
  /* The ortho scales are the manifest's. */
  const O = section.derivations.readings.ortho;
  const c46 = manifest.chunks.find((c) => c.file === "chunk_4_6.jpg");
  const c56 = manifest.chunks.find((c) => c.file === "chunk_5_6.jpg");
  assert.ok(c46 && c56, "an ortho chunk left the manifest — the pinned rect reads lose their frame");
  near(O.chunk46PxPerM, c46.w / (c46.x1 - c46.x0), 1e-9, "chunk_4_6 scale");
  near(O.chunk56PxPerM, c56.w / (c56.x1 - c56.x0), 1e-9, "chunk_5_6 scale");
  /* The drawn terrain agrees with the probe's court datum. */
  const F = section.derivations.figures;
  near(drawnGround(87.4, 265), F["court.repo"].value, 0.08,
    "the drawn surface at the court centre has moved off the probed datum");
  for (const k of ["survey", "ept", "ring", "px", "ortho"]) {
    assert.ok(section.derivations.readings[k].source.length > 100,
      `readings.${k} has no described source`);
  }
});

function exprScope() {
  const D = section.derivations;
  const scope = {};
  for (const [k, v] of Object.entries(D.readings)) {
    scope[k] = v && typeof v === "object" ? { ...v } : v;
  }
  for (const [key, f] of Object.entries(D.figures)) {
    const parts = key.split(".");
    let o = scope;
    for (let i = 0; i < parts.length - 1; i++) o = (o[parts[i]] ??= {});
    o[parts[parts.length - 1]] = f.value;
  }
  return scope;
}

t("S1(vi): every derivation recomputes from its own readings", () => {
  const D = section.derivations;
  assert.match(D.why, /keeling\.roofs\.pv/i, "the block must name the bar it is held to");
  for (const [key, f] of Object.entries(D.figures)) {
    assert.ok(typeof f.value === "number", `${key} has no value`);
    assert.ok(f.why && f.why.length > 40, `${key} is unmotivated`);
  }
  const { evaluated, prose } = assertExprs({ figures: D.figures, scope: exprScope(), label: "bonner" });
  assert.ok(evaluated >= 35, `only ${evaluated} figures evaluated — the block is too thin`);
  assert.ok(prose <= 2, `${prose} figures fell back to prose — arithmetic is the default`);
  for (const [key, decl] of Object.entries(D.figures)) {
    if (decl.expr === undefined) {
      assert.match(key, /^breezeway\.cellsPerStrand$/,
        `${key} is prose and is not the declared prose COUNT`);
    }
  }
});

t("S1(iii): the relations the section states in prose are asserted", () => {
  const F = section.derivations.figures;
  const R = section.derivations.readings;
  const S = section.system;
  const rel = [];
  /* THE KEYSTONE: the stack closes on the measured plate and the east grade. */
  rel.push({ name: "plate - 4 storeys IS the east grade",
    got: F["plate.repo"].value - 4 * F["storey.pitch"].value,
    want: F["grade.eastRepo"].value, tol: 1e-6 });
  /* The shipped system IS the derivation. */
  rel.push({ name: "system plate is the figure", got: S.stack.plateRepo, want: F["plate.repo"].value });
  rel.push({ name: "system storey is the measured pitch", got: S.stack.storey, want: F["storey.pitch"].value });
  rel.push({ name: "system foot is the figure", got: S.stack.footRepo, want: F["stack.footRepo"].value });
  rel.push({ name: "system storeys is the survey's 4", got: S.stack.storeys, want: R.survey.levels });
  rel.push({ name: "the wing roof is the figure", got: S.facade.wingRoofRepo, want: F["wing.roofRepo"].value });
  rel.push({ name: "spine crest is the figure", got: S.spine.crest, want: F["spine.crestAbovePlate"].value, tol: 5e-3 });
  rel.push({ name: "spine pitch is the figure", got: S.spine.pitch, want: F["louvre.pitch"].value });
  rel.push({ name: "spine count is the crossing count", got: S.spine.count, want: F["louvre.count"].value });
  for (const k of ["spineX0", "spineX1", "spineZ0", "spineZ1"]) {
    rel.push({ name: `spine band ${k} is the reading`, got: S.spine[k.replace("spine", "").toLowerCase()], want: R.ortho[k] });
  }
  rel.push({ name: "the louvre run is the spine band's own length",
    got: R.ortho.spineZ1 - R.ortho.spineZ0, want: R.ortho.louvreRunM });
  /* THE SHARED COURT DATUM and the breezeway planes. */
  rel.push({ name: "system court datum is the figure", got: S.breezeway.courtRepo, want: F["court.repo"].value });
  rel.push({ name: "system corridor is the figure", got: S.breezeway.corridor, want: F["breezeway.corridor"].value, tol: 5e-3 });
  S.breezeway.decks.forEach((deck, i) => {
    rel.push({ name: `deck ${i + 1} h is the EPT bin`, got: deck.h, want: R.ept[`deck${i + 1}H`] });
    rel.push({ name: `deck ${i + 1} repo is the figure`, got: deck.repo, want: F[`breezeway.deck${i + 1}Repo`].value });
  });
  rel.push({ name: "canopy repo is the figure", got: S.breezeway.canopyRepo, want: F["breezeway.canopyRepo"].value });
  rel.push({ name: "the canopy's measured flat band contains its height",
    got: Math.max(R.ept.canopyFlatLo, Math.min(R.ept.canopyFlatHi, R.ept.canopyH)),
    want: R.ept.canopyH });
  rel.push({ name: "landZ is the Mayer face", got: S.breezeway.landZ, want: F["chain.landZ"].value });
  rel.push({ name: "west arcade soffit is the figure", got: S.breezeway.arcadeWest.soffitH, want: F["arcade.westSoffitH"].value, tol: 5e-3 });
  rel.push({ name: "east arcade soffit is the figure", got: S.breezeway.arcadeEast.soffitH, want: F["arcade.eastSoffitH"].value });
  rel.push({ name: "the west arcade plane IS the deck-1 plane (coplanarity claim)",
    got: S.breezeway.courtRepo + S.breezeway.arcadeWest.soffitH,
    want: S.breezeway.decks[0].repo, tol: 0.05 });
  rel.push({ name: "the west arcade strip is clipped at the Mayer face",
    got: S.breezeway.arcadeWest.z1, want: S.breezeway.landZ });
  /* The east strip is held to lawn #2166's own surveyed edge. */
  const lawn2166 = section.measured.groundRings.owned.find((g) => g.index === 2166).rings[0];
  rel.push({ name: "east arcade z0 is lawn #2166's own north edge (min z; +z = south)",
    got: S.breezeway.arcadeEast.z0, want: Math.min(...lawn2166.map((p) => p[1])), tol: 0.05 });
  rel.push({ name: "east arcade z1 is lawn #2166's own south edge",
    got: S.breezeway.arcadeEast.z1, want: Math.max(...lawn2166.map((p) => p[1])), tol: 0.05 });
  /* Junction geometry hangs off the surveyed rings. */
  const B = section.measured.building;
  rel.push({ name: "the Bonner-face gallery sits on the ring's own south (court) face",
    got: S.breezeway.galleryBonner.z, want: B.bbox.z1 });
  rel.push({ name: "the landings start on the ring's own south (court) face",
    got: S.breezeway.landings.z0, want: B.bbox.z1 });
  rel.push({ name: "the Mayer-face gallery sits on the face the chain lands on",
    got: S.breezeway.galleryMayer.z, want: S.breezeway.landZ });
  /* The stair run is walk #3269's own bbox. */
  const walk3269 = section.measured.groundRings.owned.find((g) => g.index === 3269).rings[0];
  rel.push({ name: "stairs x0 is walk #3269's west edge", got: S.stairs.x0, want: Math.min(...walk3269.map((p) => p[0])), tol: 0.05 });
  rel.push({ name: "stairs x1 is walk #3269's east edge", got: S.stairs.x1, want: Math.max(...walk3269.map((p) => p[0])), tol: 0.05 });
  rel.push({ name: "stairs z0 is walk #3269's north edge (min z; +z = south)", got: S.stairs.z0, want: Math.min(...walk3269.map((p) => p[1])), tol: 0.05 });
  rel.push({ name: "stairs z1 is walk #3269's south edge", got: S.stairs.z1, want: Math.max(...walk3269.map((p) => p[1])), tol: 0.05 });
  /* DECK 3'S TRIM IS THE RING'S OWN LINE, NOT A FREE KNOB (audit finding 3):
     the trim must sit exactly where the deck-3 strand's terminal WITHHELD
     cell's outer face begins — the last surveyed z before the junction cell —
     and strictly short of the Mayer face, so deck 3 can never slide to the
     face while g8 stays open. */
  {
    const strand = section.measured.breezeway.chains[S.breezeway.decks[2].strand];
    const ringC = strand.ring.concat([strand.ring[0]]);
    const xs2 = strand.ring.map((p) => p[0]);
    const xmin2 = Math.min(...xs2);
    const xmax2 = Math.max(...xs2);
    let terminalFaceStartZ = null;
    for (let k = 0; k < ringC.length - 1; k++) {
      const [ax, az] = ringC[k];
      const [bx, bz] = ringC[k + 1];
      const L = Math.hypot(bx - ax, bz - az);
      if (Math.abs(bx - ax) > ROWS_RULE.maxDx || L < ROWS_RULE.minLen || L > ROWS_RULE.maxLen) continue;
      const mx = (ax + bx) / 2;
      if (Math.abs(mx - xmax2) >= ROWS_RULE.snap && Math.abs(mx - xmin2) >= ROWS_RULE.snap) continue;
      const mz = (az + bz) / 2;
      if (mz + S.breezeway.columnDiameter / 2 > S.breezeway.landZ) {
        terminalFaceStartZ = Math.min(az, bz);
      }
    }
    assert.ok(terminalFaceStartZ !== null,
      "the deck-3 strand no longer derives a withheld terminal cell — g8's trim has lost its subject");
    rel.push({ name: "deck 3's trim is the terminal withheld cell's own face start",
      got: section.draw.deck3TrimZ, want: terminalFaceStartZ, tol: 1e-9 });
    assert.ok(section.draw.deck3TrimZ < S.breezeway.landZ - 1,
      "deck 3's trim has slid up to the Mayer face — the very thing g8 withholds");
  }
  rel.push({ name: "planned risers is the figure", got: S.stairs.plannedRisers, want: F["stairs.plannedRisers"].value });
  rel.push({ name: "built risers is the declared count", got: S.stairs.builtRisers, want: section.counts.stairsBuilt });
  /* THE MEASURED STOREY IS NOT THE FORMULA. */
  assert.ok(Math.abs(S.stack.storey - F["check.arcgisStorey"].value) > 0.25,
    "the shipped storey has drifted toward the ArcGIS 4.275 formula — the measured 3.965 is the only storey that closes on the plate");
  /* The strand pitches agree across the two independent strands. */
  rel.push({ name: "the two strands' pitches agree",
    got: F["breezeway.strandPitch917"].value, want: F["breezeway.strandPitch918"].value, tol: 0.05 });
  /* The estimated arcade pitch extends the measured row pitch. */
  rel.push({ name: "the arcade pitch extends the measured row pitch",
    got: S.breezeway.arcadeColumnPitch, want: F["breezeway.rowPitch"].value, tol: 0.01 });
  assertRelations({ relations: rel, label: "bonner" });
});

const drawNoteFor = (path) => {
  const parts = path.split(".").slice(1);
  const note = section.draw[`${parts[0]}Note`];
  return typeof note === "string" && note.length > 40 ? "declared render offset" : null;
};

t("S1(i): no bare number survives in readings, estimates, draw, colours or samples", () => {
  const paths = assertCoverage({
    section, label: "bonner", minimum: 120,
    roots: {
      "derivations.readings": {}, estimates: {}, draw: {},
      colorSources: {}, samples: {},
    },
    uncovered: {},
    classify: (path) => {
      if (path.startsWith("derivations.readings.")) {
        return READING_PINS[path.slice("derivations.readings.".length)] ? "pinned" : null;
      }
      if (/^estimates\..+\.(value|band\.[01])$/.test(path)) return "banded";
      if (path.startsWith("draw.")) return drawNoteFor(path);
      if (/^colorSources\.[A-Za-z]+\.(r|g|b|channelMean)$/.test(path)) {
        return "channel read, recomputed against the pinned px/ortho readings in the colour gate";
      }
      if (/^samples\.[A-Za-z0-9]+\.(r|g|b|channelMean)$/.test(path)) {
        return "unconsumed channel read, recomputed in the colour gate";
      }
      return null;
    },
  });
  const drawNumbers = paths.filter((p) => p.path.startsWith("draw."));
  assert.ok(drawNumbers.length >= 12, `only ${drawNumbers.length} draw numbers walked`);
  for (const { path } of drawNumbers) {
    assert.ok(drawNoteFor(path), `${path} has no sibling Note explaining why it is not a measurement`);
  }
});

const EST_SHIPPED = {
  "system.facade.windowOfStorey": () => section.system.facade.windowOfStorey,
  "system.facade.slabDepth": () => section.system.facade.slabDepth,
  "system.breezeway.columnDiameter": () => section.system.breezeway.columnDiameter,
  "system.breezeway.plateThickness": () => section.system.breezeway.plateThickness,
  "system.breezeway.railHeight": () => section.system.breezeway.railHeight,
  "system.breezeway.capitalDepth": () => section.system.breezeway.capitalDepth,
  "system.breezeway.picketSpacing": () => section.system.breezeway.picketSpacing,
  "system.breezeway.arcadeColumnPitch": () => section.system.breezeway.arcadeColumnPitch,
  "system.breezeway.galleryDepth": () => section.system.breezeway.galleryDepth,
  "system.spine.louvreTiltDeg": () => section.system.spine.louvreTiltDeg,
  "system.stairs.rise": () => section.system.stairs.rise,
};

t("S1(ii): every estimate carries a band, its failed ladder, and the shipped value inside it", () => {
  const n = assertEstimateBands({
    estimates: section.estimates,
    valueAt: (key) => {
      const f = EST_SHIPPED[key];
      assert.ok(f, `bonner: estimate ${key} governs no shipped value this suite knows about`);
      return f();
    },
    label: "bonner",
  });
  assert.equal(n, Object.keys(section.estimates).length, "every estimate must be banded");
  for (const [k, e] of Object.entries(section.estimates)) {
    assert.ok(e.bandWhy && e.bandWhy.length > 80, `estimate ${k}'s band is a bare pair with no argument`);
    assert.ok(e.why.length > 120, `estimate ${k} does not record its failed ladder`);
    assert.match(e.why, /Ladder climbed and failed/i, `estimate ${k} does not name the ladder`);
    for (const rung of ["photos", "Street View", "drone", "planning docs", "archives"]) {
      assert.ok(e.why.includes(rung), `estimate ${k}'s ladder skips the ${rung} rung`);
    }
  }
});

t("S1(iv): every read and colour line carries a symmetric tier label", () => {
  const entries = [];
  for (const [key, text] of Object.entries(section.reads)) {
    entries.push({ key: `reads.${key}`, text });
  }
  for (const [key, cs] of Object.entries(section.colorSources)) {
    entries.push({ key: `colorSources.${key}`, text: `${cs.tier} ${cs.source}` });
  }
  assertTierSymmetry({ entries, label: "bonner" });
  /* The R4 addendum's colour lesson: the statistic is the channel mean, and
     the WORD "luminance" is banned from the colour apparatus. */
  assert.ok(!/luminance/i.test(JSON.stringify(section.colorSources))
    && !/luminance/i.test(JSON.stringify(section.samples))
    && !/luminance/i.test(section.colorSourcesNote),
    "the colour apparatus uses the word 'luminance' — the statistic is channel-mean, (R+G+B)/3, per the R4 addendum");
});

t("every hex is its own pinned channels, rounded — and estimated roles name what they extend", () => {
  const R = section.derivations.readings;
  const CHANNELS = {
    goldAggregate: [R.px.goldR, R.px.goldG, R.px.goldB],
    creamSlab: [R.px.creamR, R.px.creamG, R.px.creamB],
    windowBand: [R.px.windowR, R.px.windowG, R.px.windowB],
    louvrePrecast: [R.px.creamR, R.px.creamG, R.px.creamB],
    canopyTop: [R.ortho.canopyR, R.ortho.canopyG, R.ortho.canopyB],
    vaultConcrete: [R.ortho.canopyR, R.ortho.canopyG, R.ortho.canopyB],
    deckConcrete: [R.ortho.canopyR, R.ortho.canopyG, R.ortho.canopyB],
    courtLawn: [R.ortho.lawnR, R.ortho.lawnG, R.ortho.lawnB],
    walkPaving: [R.ortho.walkR, R.ortho.walkG, R.ortho.walkB],
    hexPaving: [R.ortho.walkR, R.ortho.walkG, R.ortho.walkB],
    roofBallast: [R.ortho.ballastR, R.ortho.ballastG, R.ortho.ballastB],
    wingRoof: [R.ortho.canopyR, R.ortho.canopyG, R.ortho.canopyB],
  };
  for (const [role, hex] of Object.entries(section.colors)) {
    const cs = section.colorSources[role];
    assert.ok(cs, `colour role ${role} has no colorSources line`);
    if (role === "railPaint") {
      /* The one direction-only colour: [estimated], no pinned rect exists. */
      assert.equal(cs.tier, "[estimated]");
      assert.match(cs.source, /bb0137569z/);
      continue;
    }
    const ch = CHANNELS[role];
    assert.ok(ch, `no channel mapping for role ${role} — add it here with its reading`);
    near(cs.r, ch[0], 1e-9, `${role}.r is not its pinned reading`);
    near(cs.g, ch[1], 1e-9, `${role}.g`);
    near(cs.b, ch[2], 1e-9, `${role}.b`);
    near(cs.channelMean, (ch[0] + ch[1] + ch[2]) / 3, 0.05, `${role}.channelMean is not (R+G+B)/3`);
    const want = `#${ch.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
    assert.equal(hex, want, `${role} ships ${hex}, but its pinned channels round to ${want}`);
    if (cs.tier === "[estimated]") {
      assert.match(cs.source, /extends/, `${role} is [estimated] and does not say what it extends`);
    } else {
      assert.equal(cs.tier, "[measured]", `${role} carries unknown tier ${cs.tier}`);
      assert.match(cs.source, /rect \(\d+,\d+,\d+,\d+\)/, `${role} is [measured] with no pinned rectangle`);
    }
  }
  /* Unconsumed samples: really unconsumed, and their hexes round too. */
  for (const [key, smp] of Object.entries(section.samples)) {
    if (key === "note") continue;
    assert.ok(smp.whyUnconsumed && smp.whyUnconsumed.length > 40, `sample ${key} has no whyUnconsumed`);
    assert.ok(!Object.values(section.colors).includes(smp.hex)
      || key === "walk3270Shadowed" === false,
      `sample ${key}'s hex ${smp.hex} is consumed by a colour role — it is not an unconsumed sample`);
    const want = `#${[smp.r, smp.g, smp.b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
    assert.equal(smp.hex, want, `sample ${key}'s hex is not its own channels`);
    near(smp.channelMean, (smp.r + smp.g + smp.b) / 3, 0.05, `sample ${key} channelMean`);
  }
});

/* ==================== THE MODULE CONTRACT ==================== */

t("the module reads only its own photo key and no measured file", () => {
  assert.match(moduleCode, /photo\?\.bonner/, "the module must read photo?.bonner");
  assert.ok(!/heights\s*\[/.test(moduleCode), "the module indexes lidar.heights");
  assert.ok(!/massHeights/.test(moduleCode), "the module reaches into campus-lidar.json");
  assert.ok(!/arcgis|campus-3d|campus-lidar/.test(moduleCode),
    "the module reads a measured document at runtime");
  assert.ok(!/Math\.random|Date\.now|performance\.|TextureLoader/.test(moduleCode),
    "the module uses a nondeterministic or loading construct");
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(moduleCode), "a hex colour literal lives in the module");
  /* No load-bearing dimension may be typed in the module. */
  for (const dim of ["35.71", "19.85", "3.965", "4.55", "8.48", "24.58", "28.38",
    "31.98", "35.58", "20.38", "16.15", "15.86", "1.05", "11.6", "15.2", "19.2", "15.4",
    "83.8", "91.0", "87.4", "278.0", "126.97", "122.78", "138.11"]) {
    assert.ok(!moduleCode.includes(dim),
      `the module carries the bare dimension ${dim} — every metre must come through the section`);
  }
  assert.match(moduleSrc, /NEVER FROM THE DRAWN PRISM/i,
    "the module must state the plate rule it is gated on");
});

t("a missing section builds nothing; a missing sampler throws", () => {
  const empty = createPhotoBonner(null, { photo: {} });
  assert.deepEqual(empty.counts, {});
  assert.equal(empty.group.children.length, 0);
  assert.throws(() => createPhotoBonner(null, { photo: { bonner: section } }),
    /surfaceAt/, "building with no ground sampler must throw, not sink");
});

t("two builds are byte-identical", () => {
  const ser = (r) => {
    const parts = [];
    r.group.updateMatrixWorld(true);
    r.group.traverse((o) => {
      if (!o.isMesh) return;
      const p = o.geometry.getAttribute("position");
      parts.push(o.name,
        Buffer.from(p.array.buffer, p.array.byteOffset, p.array.byteLength).toString("base64"));
    });
    return parts.join("|");
  };
  assert.equal(ser(build()), ser(build()), "the build is not deterministic");
});

/* ==================== THE BUILT SCENE ==================== */

t("counts: declared == built on the drawn surface, and the withholdings are counted", () => {
  const { counts } = build();
  for (const [k, v] of Object.entries(section.counts)) {
    if (k === "note") continue;
    assert.equal(counts[k], v, `counts.${k}: declared ${v}, built ${counts[k]}`);
  }
  for (const k of Object.keys(counts)) {
    assert.ok(k in section.counts, `the module counts ${k} and the section does not declare it`);
  }
  /* The declare-and-withhold pairs carry BOTH counts and neither is zero
     where the clip is real. */
  assert.equal(counts.cellsPlanned, 14, "the rings derive 14 cells");
  assert.equal(counts.cellsPlanned - counts.cellsWithheld, counts.canopyCells,
    "built cells + withheld cells must equal the plan");
  assert.ok(counts.stairsPlanned > counts.stairsBuilt,
    "the podium stair clip is real: the decimated terrain carries less than the measured step");
  assert.ok(counts.facadeWithheldBands > 0,
    "the west grade rises past the bottom band and some window bands must be withheld");
  assert.equal(counts.spineBladesPlanned, counts.spineBladesBuilt,
    "nothing clips the roof: the spine ships complete");
});

t("every mesh name carries its provenance tier", () => {
  const { group } = build();
  const names = new Set();
  group.traverse((o) => { if (o.isMesh) names.add(o.name); });
  assert.ok(names.size >= 20, `only ${names.size} distinct mesh names`);
  for (const n of names) {
    assert.match(n, /^bonner-[a-z0-9-]+-(sourced|estimated)$/,
      `mesh "${n}" does not carry a -sourced/-estimated provenance suffix`);
  }
  for (const must of [
    "bonner-facade-spandrel-sourced", "bonner-facade-spandrel-estimated",
    "bonner-facade-window-sourced", "bonner-facade-window-estimated",
    "bonner-wing-wall-estimated",
    "bonner-spine-louvre-sourced",
    "bonner-breezeway-deck-1-sourced", "bonner-breezeway-deck-2-sourced",
    "bonner-breezeway-deck-3-estimated",
    "bonner-breezeway-canopy-sourced", "bonner-breezeway-column-sourced",
    "bonner-breezeway-arcade-soffit-west-sourced",
    "bonner-breezeway-arcade-column-estimated",
    "bonner-gallery-slab-estimated", "bonner-stairs-estimated",
    "bonner-court-hexpaving-sourced", "bonner-lawn-sourced", "bonner-walk-sourced",
    "bonner-roof-main-sourced", "bonner-roof-wing-sourced",
    "bonner-step-window-estimated", "bonner-step-spandrel-estimated",
  ]) {
    assert.ok(names.has(must), `the scene is missing ${must}`);
  }
  /* THE WITHHOLDINGS ARE REAL: nothing absent may reach a mesh name. */
  for (const n of names) {
    assert.ok(!/balcony|penthouse|planter|bollard|arch(?!$)|letter|ballast|bench|recess/.test(n),
      `mesh "${n}" ships an object the absent list withholds`);
  }
});

t("the measured planes are exactly where the laser put them, on every terrain", () => {
  const BW = section.system.breezeway;
  const ST = section.system.stack;
  for (const g of [flat, slope, drawnGround]) {
    const { group } = build(g);
    const canopyTops = [];
    eachMesh(group, (m) => {
      if (m.name.startsWith("bonner-breezeway-deck-")) {
        const deck = BW.decks[Number(m.name.split("-")[3]) - 1];
        near(m.yHi, deck.repo, 1e-3, `${m.name} top`);
        near(m.yLo, deck.repo - BW.plateThickness, 1e-3, `${m.name} soffit`);
      }
      if (m.name === "bonner-breezeway-canopy-sourced") canopyTops.push(m.yHi);
      if (m.name === "bonner-breezeway-landing-sourced") {
        const match = BW.decks.some((d) => Math.abs(m.yHi - d.repo) < 1e-3);
        assert.ok(match, "a landing plate is not coplanar with any deck");
      }
      if (m.name === "bonner-breezeway-arcade-soffit-west-sourced") {
        near(m.yHi, BW.courtRepo + BW.arcadeWest.soffitH, 1e-3, "west arcade plane");
      }
      if (m.name === "bonner-breezeway-arcade-soffit-east-sourced") {
        near(m.yHi, BW.courtRepo + BW.arcadeEast.soffitH, 1e-3, "east arcade plane");
      }
      if (m.name === "bonner-roof-main-sourced") {
        near(m.yHi, ST.plateRepo, 1e-3, "the main roof plate is not at the measured plate");
      }
      if (m.name === "bonner-roof-wing-sourced") {
        near(m.yHi, section.system.facade.wingRoofRepo, 1e-3,
          "the wing roof plate is not at its measured 28.0 plane");
      }
    });
    assert.equal(canopyTops.length, section.counts.canopyCells);
    /* COPLANARITY: the canopy is ONE plane, as measured (±0.04 in the cloud). */
    near(Math.min(...canopyTops), Math.max(...canopyTops), 1e-6,
      "the canopy steps — the measured top plane is constant across the whole chain");
    near(canopyTops[0], BW.canopyRepo, 1e-3, "the canopy is not at its measured plane");
    assert.ok(BW.canopyRepo < ST.plateRepo,
      "the canopy must sit under Bonner's plate (measured 0.13 m below)");
  }
});

t("the facade hangs from the plate; only the spine rises past it", () => {
  const ST = section.system.stack;
  const SP = section.system.spine;
  const { group } = build();
  const facades = group.children.find((c) => c.name === "bonner-facades");
  const spine = group.children.find((c) => c.name === "bonner-spine");
  let topFacade = -Infinity;
  eachVertex(facades, (x, y) => { if (y > topFacade) topFacade = y; });
  near(topFacade, ST.plateRepo, 1e-3,
    "the treated facade must stop at the measured plate — never at the drawn prism's lid");
  /* THE OVERRIDE'S OWN INTENT, GATED: since 2026-08-21 the extruder's lid
     (roofElevation over the surveyed ring at the file's own massHeight) must
     close on the measured plate — that is what MEASURED_OVERRIDES bought. */
  const lid = roofElevation(section.measured.building.ring,
    section.measured.building.massHeight, drawnGround);
  near(lid, ST.plateRepo, 0.05,
    "the drawn prism's lid has moved off the measured plate — the R4 massing override has been reverted or re-broken upstream");
  let topSpine = -Infinity;
  let loSpine = Infinity;
  eachVertex(spine, (x, y) => { if (y > topSpine) topSpine = y; if (y < loSpine) loSpine = y; });
  near(topSpine, ST.plateRepo + SP.crest, 0.06, "the louvre crest is not at its measured height");
  assert.ok(loSpine >= ST.plateRepo - 0.06, "a louvre blade hangs below the plate");
  /* Every facade vertex stays on the surveyed ring (offset + proud glass). */
  const ring = section.measured.building.ring;
  const D = section.draw;
  let worst = 0;
  eachVertex(facades, (x, y, z) => {
    const d = ringDist(x, z, ring);
    if (d > worst) worst = d;
  });
  assert.ok(worst <= D.wallOffset + D.openingProud + 0.05,
    `a facade vertex stands ${worst.toFixed(3)} m off the surveyed ring — the treatment has left the building`);
});

t("windows never emerge from the drawn dirt, and wing walls stop at the wing's own roof", () => {
  const { group } = build();
  const FA = section.system.facade;
  eachMesh(group, (m) => {
    if (m.name === "bonner-wing-wall-estimated") {
      near(m.yHi, FA.wingRoofRepo, 1e-3,
        "the wing's walls must stop at its measured 2-storey roof, not climb the 4-storey stack");
    }
  });
  for (const mName of ["bonner-facade-window-sourced", "bonner-facade-window-estimated"]) {
    group.traverse((o) => {
      if (!o.isMesh || o.name !== mName) return;
      const pos = o.geometry.getAttribute("position");
      for (let i = 0; i + 5 < pos.count; i += 6) {
        let yLo = Infinity;
        let cx = 0;
        let cz = 0;
        for (let k2 = 0; k2 < 6; k2++) {
          const y = pos.getY(i + k2);
          if (y < yLo) yLo = y;
          cx += pos.getX(i + k2) / 6;
          cz += pos.getZ(i + k2) / 6;
        }
        assert.ok(yLo >= drawnGround(cx, cz) - 0.2,
          `${mName}: a window quad at (${cx.toFixed(1)}, ${cz.toFixed(1)}) sits in the drawn ground — the burial clip has stopped working`);
      }
    });
  }
});

t("the chain is clipped at the Mayer face and nothing enters either building", () => {
  const BW = section.system.breezeway;
  const { group } = build();
  const bw = group.children.find((c) => c.name === "bonner-breezeway");
  eachMesh(bw, (m) => {
    if (/deck-[12]/.test(m.name)) {
      assert.ok(m.zHi <= BW.landZ + 1e-6, `${m.name} runs past the Mayer face`);
    }
    if (/deck-3/.test(m.name)) {
      assert.ok(m.zHi <= section.draw.deck3TrimZ + 1e-6,
        "deck 3 must stop at its trim (gap g8), short of the face");
    }
    if (/canopy|column-sourced|capital-sourced/.test(m.name)) {
      assert.ok(m.zHi <= BW.landZ + 1e-6, `${m.name} crosses into Mayer`);
    }
  });
  /* Nothing of the breezeway or ground stands INSIDE Bonner's surveyed ring. */
  const ring = section.measured.building.ring;
  const gr = group.children.find((c) => c.name === "bonner-ground");
  for (const node of [bw, gr]) {
    eachVertex(node, (x, y, z, name) => {
      if (z > ring.map((p) => p[1]).reduce((a, b) => Math.max(a, b)) - 0.05) return;
      assert.ok(!inRing(x, z, ring),
        `${name} vertex (${x.toFixed(1)}, ${z.toFixed(1)}) stands inside Bonner's surveyed footprint`);
    });
  }
  /* And the whole section stays inside its own declared bounds. */
  const bounds = section.bounds;
  eachVertex(group, (x, y, z, name) => {
    assert.ok(x >= bounds.x0 - 1.2 && x <= bounds.x1 + 1.2
      && z >= bounds.z0 - 1.2 && z <= bounds.z1 + 1.2,
      `${name} vertex (${x.toFixed(1)}, ${z.toFixed(1)}) has left the section's bounds`);
  });
});

t("everything seated on the ground actually seats, on flat, slope and drawn terrain", () => {
  for (const g of [flat, slope, drawnGround]) {
    const { group } = build(g);
    eachMesh(group, (m) => {
      if (/column|post|capital/.test(m.name) && !/capital/.test(m.name)) {
        const surf = g(m.x, m.z);
        assert.ok(m.yLo <= surf + 0.01, `${m.name} hovers: foot ${m.yLo.toFixed(2)} over ground ${surf.toFixed(2)}`);
        assert.ok(m.yLo >= surf - 1.0, `${m.name} is buried a metre deep`);
      }
      if (m.name === "bonner-stairs-estimated") {
        let under = -Infinity;
        for (const [sx, sz] of [[m.xLo, m.zLo], [m.xHi, m.zHi], [m.x, m.z]]) {
          const v = g(sx, sz);
          if (Number.isFinite(v) && v > under) under = v;
        }
        assert.ok(m.yHi >= under - 1e-3, `a stair tread sits under the drawn ground`);
        assert.ok(m.yHi <= under + section.system.stairs.rise + 0.6,
          "a stair tread floats high over the drawn ground");
      }
    });
    /* No NaN anywhere. */
    eachVertex(group, (x, y, z, name) => {
      assert.ok(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z),
        `${name} has a non-finite vertex`);
    });
  }
});

t("the ground drapes ride the overlay rung, never the world's own fill", () => {
  const { group } = build();
  const gr = group.children.find((c) => c.name === "bonner-ground");
  let drapes = 0;
  gr.traverse((o) => {
    if (!o.isMesh) return;
    drapes++;
    assert.ok(o.renderOrder > 0, `${o.name} has no overlay renderOrder`);
    assert.ok(o.material.polygonOffset, `${o.name}'s material carries no overlay depth bias`);
  });
  assert.equal(drapes,
    section.counts.lawns + section.counts.walks + section.counts.pavingChains);
});

t("the roof zone carries the whole measured mass: two plates, the 7.71 m step, a closed envelope", () => {
  const F = section.derivations.figures;
  const ST = section.system.stack;
  const FA = section.system.facade;
  const W = section.measured.building.wing;
  /* The step height is a derivation, not a choice. */
  near(F["wing.stepHeight"].value, ST.plateRepo - FA.wingRoofRepo, 1e-6,
    "the step height figure is not the two measured planes' own difference");
  const { group, counts } = build();
  assert.equal(counts.roofPlatesMain, 1);
  assert.equal(counts.roofPlatesWing, 1);
  const rz = group.children.find((c) => c.name === "bonner-roofzone");
  assert.ok(rz, "no roofzone group — the mass is lost when the prism goes");
  let stepLo = Infinity;
  let stepHi = -Infinity;
  eachMesh(rz, (m) => {
    if (m.name.startsWith("bonner-step-")) {
      stepLo = Math.min(stepLo, m.yLo);
      stepHi = Math.max(stepHi, m.yHi);
      assert.ok(m.xLo > W.x0 && m.xHi < W.x1 + 0.05,
        `${m.name} has left the wing junction (x ${m.xLo.toFixed(2)}..${m.xHi.toFixed(2)})`);
      assert.ok(m.zLo >= W.z0 - 0.05 && m.zHi <= W.z1 + 0.05,
        `${m.name} has left the wing's z band`);
      assert.ok(m.xHi - m.xLo < 0.05, `${m.name} is not a plane`);
    }
  });
  near(stepLo, FA.wingRoofRepo, 1e-3, "the step wall's foot is not the wing's measured roof");
  near(stepHi, ST.plateRepo, 1e-3, "the step wall's top is not the measured plate");
  near(stepHi - stepLo, F["wing.stepHeight"].value, 2e-3,
    "the built step is not the derived 7.71 m");
  /* ENVELOPE CLOSURE (critic item 4): with the prism retired, every surveyed
     BAR ring vertex must have treated wall geometry within a mitred corner's
     reach at mid-height — a corner wedge is now daylight, not a hairline. */
  const facades = group.children.find((c) => c.name === "bonner-facades");
  const verts = [];
  /* Any wall vertex marks closure at its corner: every band is vertically
     continuous by construction (full-height wing/shaft bands carry corners
     only at foot and lid), so the gate is about the HORIZONTAL ring. */
  eachVertex(facades, (x, y, z) => {
    if (y > 20 && y < 36) verts.push([x, z]);
  });
  const wingBoxed = (vx, vz) =>
    vx >= W.x0 - 0.1 && vx <= W.x1 + 0.1 && vz >= W.z0 - 0.1 && vz <= W.z1 + 0.1;
  for (const [vx, vz] of section.measured.building.ring) {
    if (wingBoxed(vx, vz)) continue;
    let best = Infinity;
    for (const [fx, fz] of verts) {
      const d = Math.hypot(fx - vx, fz - vz);
      if (d < best) best = d;
    }
    assert.ok(best <= 0.3,
      `ring vertex (${vx}, ${vz}) has no treated wall within ${best.toFixed(2)} m at mid-height — a daylight gap with the prism retired`);
  }
  /* The louvre spine still seats on the main plate (critic item 4). */
  const spine = group.children.find((c) => c.name === "bonner-spine");
  let loSpine = Infinity;
  eachVertex(spine, (x, y) => { if (y < loSpine) loSpine = y; });
  assert.ok(loSpine >= ST.plateRepo - 0.06 && loSpine <= ST.plateRepo + 0.2,
    "the spine no longer seats on the main plate");
});

/* ==================== CONFLICTS, ABSENT, MODULE ROLES ==================== */

t("the conflicts stay declared, with their losing sides on the record", () => {
  const byKey = Object.fromEntries(section.conflicts.map((c) => [c.key, c]));
  for (const [key, probe] of Object.entries({
    "bonner-drawn-prism-overshoot": /OVERRIDE HAS LANDED[\s\S]*15\.4|MEASURED_OVERRIDES/i,
    "arcgis-h-formula": /FORMULA/,
    "breezeway-osm-heights-are-deck-reads": /barely half its surveyed height/,
    "legacy-breezeway-position": /16\.15/,
    "osm-400-bonner-plan": /GIS renders/,
    "breezeway-date-1965-68": /NOT RESOLVED/,
    "bonner-curtain-bw-misread": /RESOLVED AGAINST THE CURTAIN|B\/W tone as material/i,
    "steinhart-1967-caption": /loser/i,
    "mayer-face-vs-osm-ring-z": /1\.9 m/,
  })) {
    assert.ok(byKey[key], `conflict ${key} has disappeared`);
    assert.ok(byKey[key].sides.length >= 2, `conflict ${key} lost a side`);
    assert.match(byKey[key].resolution, probe, `conflict ${key} no longer says what it ruled`);
  }
  /* The date conflict must stay OPEN — resolving it by fiat is the named
     failure the brief forbids. */
  assert.ok(!/RESOLVED FOR/.test(byKey["breezeway-date-1965-68"].resolution),
    "someone resolved the 1965-68 date conflict without a dated drawing");
});

t("S1(v): the absent list is non-shrinking and each entry still says what it withholds", () => {
  assertAbsentEntries({
    absent: section.absent,
    expected: {
      "mayer-york-elevated-segment": /column-vault undercroft|Better absent than wrong/,
      "mayer-york-plane-127": /127\.0/,
      "gallery-extent-beyond-court-bays": /g2/,
      "pointed-arch-profile": /undimensioned/,
      "west-wing-facade-system": /g4/,
      "spine-penthouse-block": /round vent/,
      "spine-steel-supports": /steel/,
      "east-edge-142-returns": /class 1|class-blind|eucalyptus/,
      "balcony-end-bays": /balustrade/,
      "ground-floor-recess": /recess/,
      "building-lettering": /no text mechanism/,
      "court-1968-furniture": /DEAD EPOCH/,
    },
    label: "bonner",
  });
  /* The Mayer-York verdict carries its full failed ladder. */
  const my = section.absent.find((e) => e.key === "mayer-york-elevated-segment");
  for (const rung of ["OSM", "GIS", "ortho", "point cloud", "archive"]) {
    assert.ok(my.what.includes(rung), `the Mayer-York absence skips the ${rung} rung`);
  }
});

t("D6: the sourced system rides the COURT face (nz > 0, repo-true south) and no curtain exists", () => {
  /* THE ARBITRATED SWAP (round4 D6). The repo frame has +z = SOUTH; Bonner's
     court face at z 248.2 has outward normal +z and is the face the 2013/2015
     colour frames photograph. This gate pins the corrected assignment with
     the same rigor the audit proved on the old one:
       (a) the module's face test is repo-true (nz > 0 is "south");
       (b) faceTiers: ONLY south is sourced; north/east/west extend it;
       (c) no curtain: not in the module, not in a mesh name, not as a colour
           role — the role was RETIRED with a record, and re-adding it without
           re-arguing conflicts['bonner-curtain-bw-misread'] must fail here;
       (d) in the built scene the sourced window/spandrel bands face true
           south (every quad normal has nz > 0) and the estimated bands
           include the unphotographed z 164.7 face. */
  assert.match(moduleCode, /fr\.nz > 0 \? "south" : "north"/,
    "the module's face test is not repo-true (+z = south) — the D1-of-R1 compass error is back");
  assert.deepEqual(section.system.facade.faceTiers,
    { south: "sourced", east: "estimated", west: "estimated", north: "estimated" },
    "faceTiers moved off the arbitrated D6 assignment: only the court (south) face is sourced");
  assert.match(section.system.facade.faceTiersNote, /\+z = south|repo-true/i,
    "faceTiersNote no longer states the repo frame it is keyed to");
  assert.match(section.system.facade.faceTiersNote, /must not be re-promoted from B\/W tone/i,
    "the R5 caution against re-promoting the curtain from B/W tone has been dropped");
  assert.ok(!/curtain/i.test(moduleCode), "a curtain construct is back in the module");
  assert.ok(!("curtainWall" in section.colors),
    "colour role curtainWall has been re-declared — it was retired at D6 with a record");
  assert.match(section.colorSourcesNote, /RETIREMENT RECORD/,
    "the curtainWall retirement record has been dropped from colorSourcesNote");
  const { group } = build();
  const names = new Set();
  group.traverse((o) => { if (o.isMesh) names.add(o.name); });
  for (const n of names) {
    assert.ok(!/curtain/i.test(n), `mesh "${n}" ships the retired curtain treatment`);
  }
  /* (d) — classify each facade quad by its NEAREST surveyed ring edge, using
     the module's own rule (|nx| vs |nz|, then sign): winding-independent, and
     the classification is re-derived here from the ring, not read back. */
  const ring = section.measured.building.ring;
  const rccw = (() => {
    let a2 = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      a2 += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    }
    return a2 > 0;
  })();
  const edges = [];
  for (let k = 0; k < ring.length - 1; k++) {
    const [ax, az] = ring[k];
    const [bx, bz] = ring[k + 1];
    const L = Math.hypot(bx - ax, bz - az);
    if (!(L > 0)) continue;
    const tx = (bx - ax) / L;
    const tz = (bz - az) / L;
    const s = rccw ? 1 : -1;
    const nx = s * tz;
    const nz = -s * tx;
    const face = Math.abs(nx) > Math.abs(nz)
      ? (nx > 0 ? "east" : "west")
      : (nz > 0 ? "south" : "north");
    edges.push({ ax, az, bx, bz, face });
  }
  const faceAt = (x, z) => {
    let best = null;
    for (const e of edges) {
      const dx = e.bx - e.ax;
      const dz = e.bz - e.az;
      const l2 = dx * dx + dz * dz;
      const tt = l2 ? Math.max(0, Math.min(1, ((x - e.ax) * dx + (z - e.az) * dz) / l2)) : 0;
      const d = Math.hypot(x - (e.ax + tt * dx), z - (e.az + tt * dz));
      if (!best || d < best.d) best = { d, face: e.face };
    }
    return best.face;
  };
  let sourcedQuads = 0;
  let estimatedNorthQuads = 0;
  group.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry.getAttribute("position");
    const sourced = o.name === "bonner-facade-window-sourced" || o.name === "bonner-facade-spandrel-sourced";
    const estimated = o.name === "bonner-facade-window-estimated" || o.name === "bonner-facade-spandrel-estimated";
    if (!sourced && !estimated) return;
    for (let i = 0; i + 5 < pos.count; i += 6) {
      let cx = 0;
      let cz = 0;
      for (let k2 = 0; k2 < 6; k2++) { cx += pos.getX(i + k2) / 6; cz += pos.getZ(i + k2) / 6; }
      const face = faceAt(cx, cz);
      if (sourced) {
        sourcedQuads++;
        assert.equal(face, "south",
          `${o.name}: a sourced facade quad at (${cx.toFixed(1)}, ${cz.toFixed(1)}) rides the ${face} face — the sourced system has left the court face`);
      } else if (face === "north") {
        estimatedNorthQuads++;
      }
    }
  });
  assert.ok(sourcedQuads >= 10, `only ${sourcedQuads} sourced facade quads — the court face lost its system`);
  assert.ok(estimatedNorthQuads > 0,
    "no [estimated] facade band stands on the unphotographed z 164.7 (true north) face — the extension is gone");
});

t("colour roles are bidirectional: every module role declared, every declared role consumed", () => {
  const used = new Set();
  for (const m of moduleCode.matchAll(/hue\("([A-Za-z]+)"\)/g)) used.add(m[1]);
  for (const role of used) {
    assert.ok(section.colors[role], `the module asks for undeclared colour role "${role}"`);
  }
  for (const role of Object.keys(section.colors)) {
    assert.ok(used.has(role),
      `colour role "${role}" is declared and never consumed — an orphan hex is a fabrication waiting to be believed`);
  }
});
