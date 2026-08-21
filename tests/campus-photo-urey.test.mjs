/* Urey Hall — INVENTED class, R4 batch, a NEW section.
 *
 * WHAT THIS SUITE EXISTS TO HOLD. The section makes four claims a later edit
 * could quietly undo, and each has a gate written against the claim rather
 * than against the geometry that happens to result:
 *
 *   - FOUR PLANES, NOT A PRISM. Every roof plane's plan is the VERBATIM
 *     survey ring clipped by declared boxes; the clip is recomputed here
 *     independently and the pieces' areas must sum to the ring's own shoelace
 *     area to 1e-6, every interior cut must sit on a surveyed vertex
 *     coordinate, and every built lid must sit at rim + its own pinned EPT
 *     plateau. The 30.5 prism is never drawn by this module and the LiDAR
 *     builder's deliberate massHeights withholding must STAND — a value
 *     appearing silently at 'm:-10,266' fails this suite.
 *
 *   - THE WITHHOLDINGS ARE REAL IN THE SCENE. No canopy, no screen-block
 *     wall, no roof furniture, no walk carpet, no Addition dressing, and the
 *     east tower tops at 29.18 exactly (the 32.9 spike is recorded,
 *     unmodelled). A gate walks the mesh names and another measures the
 *     tower's own maximum.
 *
 *   - EVERY FIGURE RECOMPUTES AND EVERY READING UNDERNEATH IT IS PINNED.
 *     The axiom-gate apparatus runs whole: pins, exprs, coverage, banded
 *     estimates, tier symmetry, per-entry absent probes.
 *
 *   - PROVENANCE LIVES IN THE MESH NAMES. Every mesh is
 *     urey-<element>-sourced|estimated and the estimated set is exactly the
 *     declared one; the two identically-hexed white populations (wall paint
 *     [measured], fascia/curtain-line [estimated extension]) are told apart
 *     by name or not at all.
 *
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as THREE from "../docs/vendor/three/three.module.min.js";
import { createPhotoUrey } from "../docs/js/campus-photo-urey.js";
import { makeSurfaceSampler } from "../docs/js/campus-terrain.js";
import { overlayLift } from "../docs/js/campus-overlay.js";
import {
  assertCoverage, assertEstimateBands, assertPins, assertRelations,
  assertTierSymmetry, assertAbsentEntries, assertExprs,
} from "./helpers/axiom-gate.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));

const section = read("docs/data/campus-photo-detail.json").urey;

if (!section) {
  test("urey section does not exist yet (new R4 key; merge file absent) — suite skipped", { skip: true }, () => {});
} else {

const campus = read("docs/data/campus-3d.json");
const lidar = read("docs/data/campus-lidar.json");
const arcgis = read("docs/data/campus-arcgis.json");
const manifest = read("docs/data/textures/manifest.json");

const moduleSrc = readFileSync(join(root, "docs/js/campus-photo-urey.js"), "utf8");
/* Gates that grep for forbidden constructs run on the CODE, not the prose. */
const moduleCode = moduleSrc
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/[^\n]*$/gm, "");

const near = (a, b, eps, what) =>
  assert.ok(typeof a === "number" && Math.abs(a - b) <= eps,
    `${what}: ${a} vs ${b} (tolerance ${eps})`);

const flat = () => 20;
const slope = (x, z) => 20 + 1.4 * Math.sin(x / 11) + 1.1 * Math.cos(z / 13);
/* A terrain with a 6 m shoulder crossing the south face — the burial gate's
   own instrument; nothing on campus looks like this and that is the point. */
const bump = (x, z) => 20 + (Math.abs(z - 282.4) < 3 && x > -10 && x < 0 ? 6 : 0);
const drawnGround = makeSurfaceSampler(lidar.terrain);
const build = (g = flat) =>
  createPhotoUrey(null, { photo: { urey: section }, heightAt: g, surfaceAt: g });

const ringOf = (i) => arcgis.massing[i].r[0].map(([x, z]) => [x / 10, z / 10]);
const shoelace = (r) => {
  let a = 0;
  for (let i = 0; i < r.length - 1; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1];
  return Math.abs(a / 2);
};

/* An INDEPENDENT Sutherland-Hodgman + spike removal, so the partition gate
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
  if (shoelace(clean) < 1e-6) return null;
  return clean;
}

/* The module's own rim: median drawn surface every 2 m along the mass ring. */
function rimOf(ring, g, step) {
  const gs = [];
  for (let k = 0; k < ring.length - 1; k++) {
    const [ax, az] = ring[k];
    const [bx, bz] = ring[k + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
    for (let i = 0; i < n; i++) gs.push(g(ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n));
  }
  gs.sort((a, b) => a - b);
  return gs[Math.floor(gs.length / 2)];
}

const inRing = (x, z, r) => {
  let ins = false;
  for (let i = 0, j = r.length - 2; i < r.length - 1; j = i++) {
    const [xi, zi] = r[i];
    const [xj, zj] = r[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
};

/** Every six-vertex quad of a merged band mesh, as its own extent. */
function eachQuad(node, meshName, fn) {
  node.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  node.traverse((o) => {
    if (!o.isMesh || o.name !== meshName) return;
    const pos = o.geometry.getAttribute("position");
    for (let i = 0; i + 5 < pos.count; i += 6) {
      let x = 0; let y = 0; let z = 0;
      let xLo = Infinity; let xHi = -Infinity;
      let yLo = Infinity; let yHi = -Infinity;
      let zLo = Infinity; let zHi = -Infinity;
      for (let k = 0; k < 6; k++) {
        v.fromBufferAttribute(pos, i + k).applyMatrix4(o.matrixWorld);
        x += v.x / 6; y += v.y / 6; z += v.z / 6;
        xLo = Math.min(xLo, v.x); xHi = Math.max(xHi, v.x);
        yLo = Math.min(yLo, v.y); yHi = Math.max(yHi, v.y);
        zLo = Math.min(zLo, v.z); zHi = Math.max(zHi, v.z);
      }
      fn({ x, y, z, xLo, xHi, yLo, yHi, zLo, zHi });
    }
  });
}

function meshNames(group) {
  const names = [];
  group.traverse((o) => { if (o.isMesh) names.push(o.name); });
  return names;
}

/* ------------------------------------------------------------ the section */

test("the section exists and carries the whole apparatus", () => {
  for (const k of ["label", "epoch", "note", "bounds", "boundsNote", "boundary",
    "sources", "measured", "derivations", "estimates", "reads", "draw", "system",
    "colors", "colorSources", "colorSourcesNote", "colorNote", "colorThreshold",
    "samples", "counts", "conflicts", "supersedes", "supersedesNote", "absent"]) {
    assert.ok(section[k] !== undefined, `section is missing ${k}`);
  }
  /* No `seed`: this section draws no irregularity, so a seed would be a
     declared-but-unconsumed input (audit-urey F6). If jittered planting ever
     lands here, the seed comes back WITH its consumer. */
  assert.equal(section.seed, undefined, "a seed appeared with nothing consuming it");
});

test("it says what it is: four planes, one datum, the prism refused", () => {
  assert.match(section.label, /FOUR HARD ROOF PLANES, NOT A PRISM/);
  assert.match(section.label, /supersedes revelle\.systems\.ureyCorner/);
  assert.match(section.note, /INVENTED/);
  assert.match(section.note, /VERBATIM/);
  assert.match(section.epoch, /1963/);
  assert.match(section.epoch, /1991/);
  assert.match(section.epoch, /LiDAR 2014 is VALID/i);
  assert.match(section.epoch, /PRE-ADDITION epoch/i,
    "the 1960s south-east frames describe a dead ground epoch and the section must say so");
  assert.match(section.measured.datumNote, /ONE DATUM PER MASS/i);
});

test("every source is described and dated, and the load-bearing ones are cited", () => {
  assert.ok(section.sources.length >= 12, `only ${section.sources.length} sources`);
  for (const s of section.sources) {
    assert.ok(s.length >= 80, `source is not described: ${s.slice(0, 70)}`);
    assert.match(s, /\b(19|20)\d\d\b/, `source has no date: ${s.slice(0, 70)}`);
  }
  const joined = section.sources.join("\n");
  for (const must of [
    /Bkey=516/, /Bkey=517/, /CA_SanDiegoQL2_2014/, /campus-arcgis\.json/,
    /campus-lidar\.json/, /campus-3d\.json/, /bb6690636c/, /bb03423561/,
    /bb9352649m/, /ucsdmap-urey-annex\.jpg/, /chunk_4_6\.jpg/, /9339373362/,
  ]) {
    assert.match(joined, must, `a load-bearing source is not cited: ${must}`);
  }
});

/* ================== THE SURVEY, CARRIED VERBATIM ================== */

test("both rings are the survey's, byte for byte, with their own keys", () => {
  const U = section.measured.urey;
  const A = section.measured.addition;
  assert.equal(U.massingIndex, 22);
  assert.equal(A.massingIndex, 351);
  assert.equal(arcgis.massing[22].n, "Urey Hall");
  assert.equal(arcgis.massing[351].n, "Urey Hall Office Addition");
  assert.deepEqual(U.ring, ringOf(22), "urey ring is not arcgis.massing[22].r[0] at /10, verbatim");
  assert.deepEqual(A.ring, ringOf(351), "addition ring is not arcgis.massing[351].r[0] at /10, verbatim");
  for (const [rec, idx] of [[U, 22], [A, 351]]) {
    const cx = rec.ring.reduce((s, p) => s + p[0], 0) / rec.ring.length;
    const cz = rec.ring.reduce((s, p) => s + p[1], 0) / rec.ring.length;
    assert.equal(rec.mKey, `m:${Math.round(cx)},${Math.round(cz)}`, `mKey is not massing[${idx}]'s ring's`);
    near(rec.arcgisH, arcgis.massing[idx].h, 1e-9, `recorded arcgis.h is not the file's (massing[${idx}])`);
    near(rec.levels, arcgis.massing[idx].levels, 1e-9, `recorded levels is not the file's (massing[${idx}])`);
    near(rec.areaM2, shoelace(rec.ring), 0.01, `recorded area is not the ring's (massing[${idx}])`);
  }
});

test("THE WITHHOLDING STANDS: massHeights carries nothing for Urey and 12.1 for the Addition", () => {
  assert.equal(lidar.massHeights[section.measured.urey.mKey], undefined,
    "massHeights['m:-10,266'] now carries a value — the LiDAR builder's deliberate withholding has been reversed upstream, and this section's whole partition must be re-argued against it, not silently kept");
  assert.equal(section.measured.urey.massHeightWithheld, true);
  near(section.measured.addition.massHeight, lidar.massHeights[section.measured.addition.mKey], 1e-9,
    "the Addition's height is not massHeights at its own key");
  near(section.measured.urey.osmHeight, lidar.heights["Urey Hall"], 1e-9,
    "the recorded OSM-ring height is not heights['Urey Hall']");
});

test("the OSM ring swallows the Addition, recomputed — the ureyCorner error's whole mechanism", () => {
  const osm = campus.buildings.find((b) => b.n === "Urey Hall");
  assert.ok(osm, "no OSM 'Urey Hall' ring");
  const maxZ = Math.max(...osm.p.map((p) => p[1]));
  near(section.measured.osm.maxZ, maxZ, 1e-9, "the recorded OSM max z is not the ring's");
  const gisAddMaxZ = Math.max(...section.measured.addition.ring.map((p) => p[1]));
  near(gisAddMaxZ, 316.8, 1e-9, "the Addition's GIS south face has moved");
  /* The OSM max z is the ADDITION's face, not any face of Urey proper: Urey's
     own GIS ring stops 6.3 m short of it. */
  const gisUreyMaxZ = Math.max(...section.measured.urey.ring.map((p) => p[1]));
  near(gisUreyMaxZ, 309.5, 1e-9, "Urey's own GIS south edge has moved");
  assert.ok(maxZ - gisUreyMaxZ > 6,
    "the OSM/GIS south-face gap has closed — the swallowing claim needs re-arguing");
});

/* ================== THE PARTITION, RECOMPUTED ================== */

test("the four-plane partition: pieces sum to the ring exactly, and every cut is surveyed", () => {
  const ring = section.measured.urey.ring;
  const ringA = shoelace(ring);
  let sum = 0;
  let pieces = 0;
  for (const [name, plane] of Object.entries(section.system.planes)) {
    for (const box of plane.clip) {
      const p = clipBox(ring, box);
      if (!p) continue;
      pieces++;
      sum += shoelace(p);
      void name;
    }
  }
  near(sum, ringA, 1e-6,
    "the clip pieces no longer sum to the ring's own area — the partition drops or double-counts ground");
  assert.equal(pieces, section.counts.planPieces, "declared piece count is not the clip's");
  /* Every INTERIOR cut coordinate is a surveyed vertex coordinate. */
  const xs = new Set(ring.map((p) => p[0]));
  const zs = new Set(ring.map((p) => p[1]));
  for (const v of [282.4, 287]) assert.ok(zs.has(v), `partition cut z ${v} is not a surveyed vertex z`);
  for (const v of [21.4, -31.4, -23.9]) assert.ok(xs.has(v), `partition cut x ${v} is not a surveyed vertex x`);
  /* The z 252.6 cut sits inside the slab north edge's own vertex band, which
     the section declares (reads.planePartition) rather than hides. */
  assert.match(section.reads.planePartition, /252\.3\.\.253\.2/);
  const zmin = Math.min(...ring.map((p) => p[1]));
  const zmax = Math.max(...ring.map((p) => p[1]));
  assert.ok(252.6 > 252.3 && 252.6 < 253.2);
  /* Outer box bounds clear the ring entirely — they cut nothing. */
  const xmin = Math.min(...ring.map((p) => p[0]));
  const xmax = Math.max(...ring.map((p) => p[0]));
  for (const [name, plane] of Object.entries(section.system.planes)) {
    for (const [[bx0, bz0], [bx1, bz1]] of plane.clip) {
      for (const b of [bx0, bx1]) {
        assert.ok(b <= xmin || b >= xmax || xs.has(b) || b === 252.6 || b === 7.45,
          `${name}: clip x ${b} is neither outside the ring nor a declared cut`);
      }
      for (const b of [bz0, bz1]) {
        assert.ok(b <= zmin || b >= zmax || zs.has(b) || b === 252.6,
          `${name}: clip z ${b} is neither outside the ring nor a declared cut`);
      }
    }
  }
  /* x 7.45 is the anti-pinch split of the wing's own 0.2 m connecting strip
     (between surveyed x 3.8 and 11.1) — a seam INSIDE one plane, not a cut
     between planes, so it may sit anywhere in that strip. */
  assert.ok(7.45 > 3.8 && 7.45 < 11.1);
});

test("the plane heights are the EPT plateaus, and the losers stay recorded", () => {
  const E = section.derivations.readings.ept;
  near(section.system.planes.podiumN.h, E.podiumN, 1e-9, "podiumN");
  near(section.system.planes.podiumS.h, E.podiumS, 1e-9, "podiumS");
  near(section.system.planes.slab.h, E.slab, 1e-9, "slab");
  near(section.system.planes.crownTower.h, E.crownW, 1e-9, "crownTower");
  near(section.system.planes.eastTower.h, E.crownE, 1e-9, "eastTower");
  /* The crown IS what heights[] measured; the GIS h IS the formula. */
  near(Math.abs(lidar.heights["Urey Hall"] - E.crownW), 0.05, 1e-9,
    "heights['Urey Hall'] no longer sits 0.05 m off the crown plateau");
  near(arcgis.massing[22].h, 7 * 4.27, 0.011, "GIS h 29.9 is no longer the 7 x 4.27 formula (a 0.1-rounded field)");
  near(arcgis.massing[351].h, 3 * 4.27, 0.011, "Addition GIS h is no longer the 3 x 4.27 formula");
});

/* ==================== THE AXIOM LAYER, GATED ==================== */

const EPT = "USGS 3DEP EPT CA_SanDiegoQL2_2014 full-depth re-measure, 2026-08-21 (research-urey.md section 2): per-1.5 m-cell p90 over the GIS mass-22 ring, rim base = median ground return within 3 m of the ring";
const SVY = "docs/data/campus-lidar.json and docs/data/campus-arcgis.json, quoted verbatim";
const PXS = "Revelle-College-Sources/renders/urey-sources/ucsddc-bb6690636c_2.jpg (UCSD DC, 1965-70), row luminance over columns x 300..460, sub-pixel half-maximum centroids and FWHMs against local dark baselines";
const ORT = "docs/data/textures/chunk_4_6.jpg at 8.000 px/m per docs/data/textures/manifest.json, parapet-edge displacement fits on the 25.43 m plane";

const pin = (value, truth, tol) => ({ value, truth, tol });
const READING_PINS = {
  "ept.podiumN": pin(4.02, `${EPT} — the north podium plateau, 172 cells, per-cell spread 0.02 m`),
  "ept.podiumS": pin(3.98, `${EPT} — the south podium plateau, 342 cells`),
  "ept.slab": pin(25.43, `${EPT} — the main slab plane, 674 cells, p25-p75 25.39..25.48, spread 0.01 m: the plane the LiDAR builder's narrative called 'a roof that does not exist'`),
  "ept.crownW": pin(30.45, `${EPT} — the west crown L, 98 cells, spread 0.05 m`),
  "ept.crownE": pin(29.18, `${EPT} — the east tower plateau, 36 cells`),
  "ept.spikeMax": pin(32.95, `${EPT} — the ~4-cell spike on the east tower (x 25..27, z 262..265), recorded and UNBUILT (absent A3)`),
  "ept.rimBaseAbs": pin(126.28, `${EPT} — Urey's rim base, 880 ground points`),
  "ept.rimBaseAdditionAbs": pin(126.63, `${EPT} — the Addition's own rim, 421 points; the ground rises 0.35 m eastward`),
  "ept.slabCells": pin(674, `${EPT} — a COUNT of slab-plateau cells`),
  "ept.crownWCells": pin(98, `${EPT} — a COUNT of crown-W cells in the section-2 output block (the dossier's prose table says 86; the output block is the machine's and wins — recorded in buildlog-urey.md)`),
  "ept.crownECells": pin(36, `${EPT} — a COUNT of east-tower cells`),
  "ept.podiumNCells": pin(172, `${EPT} — a COUNT`),
  "ept.podiumSCells": pin(342, `${EPT} — a COUNT`),
  "ept.slabP25": pin(25.39, `${EPT} — the slab plateau's p25`),
  "ept.slabP75": pin(25.48, `${EPT} — the slab plateau's p75`),
  "survey.lidarDatum": pin(102.4, `${SVY} — campus-lidar.json datum, the absolute-to-local converter`),
  "survey.osmHeightUrey": pin(30.5, `${SVY} — heights['Urey Hall'], the p98 over the OSM ring: the crown, not a roof plane`),
  "survey.massAddition": pin(12.1, `${SVY} — massHeights['m:18,299'], the Addition's valid 2014 read`),
  "survey.gisH": pin(29.9, `${SVY} — massing[22].h, the 7 x 4.27 formula, recorded loser`),
  "survey.gisLevels": pin(7, `${SVY} — massing[22].levels: the slab floors, one of the two right countings`),
  "survey.gisHAddition": pin(12.8, `${SVY} — massing[351].h, the 3 x 4.27 formula, recorded loser`),
  "survey.gisLevelsAddition": pin(3, `${SVY} — massing[351].levels`),
  "survey.facilitiesFloors": pin(8, "UCSD Facilities Information System Bkey=516 (fetched 2026-08-21): '8 Floors' — the other right counting"),
  "survey.facilitiesFloorsAddition": pin(3, "UCSD Facilities Information System Bkey=517 (fetched 2026-08-21): 3 Floors, built 1991"),
  "survey.podiumSouthWestX": pin(-33.1, "arcgis.massing[22].r[0] at /10 — the podium south edge's west extreme vertex (-33.1, 309.5), quoted so the louvre's west-half midpoint is arithmetic over readings"),
  "survey.podiumSouthEastX": pin(2.4, "arcgis.massing[22].r[0] at /10 — the podium south edge's east extreme vertex (2.4, 309.4), the chamfer's start"),
  "px.b8c": pin(221.10, `${PXS} — floor 8's band-line centroid`, 0.005),
  "px.b7c": pin(248.86, `${PXS} — floor 7's`, 0.005),
  "px.b6c": pin(276.30, `${PXS} — floor 6's`, 0.005),
  "px.b5c": pin(303.49, `${PXS} — floor 5's`, 0.005),
  "px.b4c": pin(330.91, `${PXS} — floor 4's; the floor-3 line's FWHM is contaminated by podium brightness and the floor-2 line is hidden behind the podium wall`, 0.005),
  "px.fwhm8": pin(6.349, `${PXS} — floor 8's band FWHM, the cleanest`, 0.001),
  "px.fwhm7": pin(6.193, `${PXS} — floor 7's`, 0.001),
  "px.fwhm6": pin(6.597, `${PXS} — floor 6's`, 0.001),
  "px.fwhm5": pin(7.562, `${PXS} — floor 5's; the monotonic growth downward is the pipe railing resolving nearer the camera`, 0.001),
  "px.fwhm4": pin(8.117, `${PXS} — floor 4's, the most contaminated kept read; the declared spread's far end`, 0.001),
  "px.rooflineRow": pin(194, `${PXS} — the roof-edge line's peak row, sky above it (no FWHM: the sky plateau never crosses its half maximum)`),
  "ortho.chunkX0": pin(-177, "docs/data/textures/manifest.json chunk_4_6.jpg x0"),
  "ortho.chunkZ0": pin(147, "docs/data/textures/manifest.json chunk_4_6.jpg z0"),
  "ortho.pxPerM": pin(8, "docs/data/textures/manifest.json chunk_4_6.jpg: 2040 px over 255 m, exactly 8"),
  "ortho.edgeDzNorth": pin(-5.3, `${ORT} — the north parapet's fitted displacement at 25.43 m`),
  "ortho.edgeDxEast": pin(-2.7, `${ORT} — the east parapet's`),
  "ortho.edgeDzSouthContaminated": pin(-6.5, `${ORT} — the south edge's apparent displacement, REFUSED for the fit: the visible south-face bands lean into the frame`),
};

test("S1(iii): every reading is pinned to the artefact it was read off", () => {
  const n = assertPins({
    readings: section.derivations.readings, pins: READING_PINS,
    namespaces: ["ept", "survey", "px", "ortho"],
    label: "urey readings",
  });
  assert.ok(n >= 40, `only ${n} readings pinned`);
  /* The survey readings must BE the surveys. */
  const S = section.derivations.readings.survey;
  near(S.lidarDatum, lidar.datum, 1e-9, "lidarDatum is not the file's");
  near(S.osmHeightUrey, lidar.heights["Urey Hall"], 1e-9, "osmHeightUrey is not heights['Urey Hall']");
  near(S.massAddition, lidar.massHeights["m:18,299"], 1e-9, "massAddition is not massHeights");
  near(S.gisH, arcgis.massing[22].h, 1e-9, "gisH is not massing[22].h");
  near(S.gisLevels, arcgis.massing[22].levels, 1e-9, "gisLevels is not massing[22].levels");
  near(S.gisHAddition, arcgis.massing[351].h, 1e-9, "gisHAddition is not massing[351].h");
  near(S.gisLevelsAddition, arcgis.massing[351].levels, 1e-9, "gisLevelsAddition");
  assert.ok(section.measured.urey.ring.some((p) => p[0] === S.podiumSouthWestX && p[1] === 309.5),
    "podiumSouthWestX is not a surveyed vertex of the podium south edge");
  assert.ok(section.measured.urey.ring.some((p) => p[0] === S.podiumSouthEastX && p[1] === 309.4),
    "podiumSouthEastX is not a surveyed vertex of the podium south edge");
  /* The ortho geometry is the manifest's. */
  const chunk = manifest.chunks.find((c) => c.file === "chunk_4_6.jpg");
  assert.ok(chunk, "chunk_4_6.jpg has left the manifest");
  const O = section.derivations.readings.ortho;
  near(O.pxPerM, chunk.w / (chunk.x1 - chunk.x0), 1e-9, "ortho scale is not the manifest's");
  near(O.pxPerM, chunk.h / (chunk.z1 - chunk.z0), 1e-9, "ortho scale is not square");
  assert.equal(O.chunkX0, chunk.x0);
  assert.equal(O.chunkZ0, chunk.z0);
  for (const k of ["ept", "survey", "px", "ortho"]) {
    assert.ok(section.derivations.readings[k].source?.length > 100,
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

test("S1(vi): every derivation recomputes from its own readings", () => {
  const D = section.derivations;
  assert.match(D.why, /keeling\.roofs\.pv/i, "the block must name the bar it is held to");
  for (const [key, f] of Object.entries(D.figures)) {
    assert.ok(typeof f.value === "number", `${key} has no value`);
    assert.ok(f.why && f.why.length > 40, `${key} is unmotivated`);
  }
  const { evaluated, prose } = assertExprs({ figures: D.figures, scope: exprScope(), label: "urey" });
  assert.ok(evaluated >= 18, `only ${evaluated} figures evaluated`);
  assert.ok(prose <= 1, `${prose} figures fell back to prose — arithmetic is the default`);
  for (const [key, decl] of Object.entries(D.figures)) {
    if (decl.expr === undefined) {
      assert.match(key, /^ground\.ownedArea$/, `${key} is prose and is not the declared prose figure`);
    }
  }
});

test("S1(iii): the relations the section states in prose are asserted", () => {
  const F = section.derivations.figures;
  const E = section.derivations.readings.ept;
  const rel = [];
  rel.push({ name: "the podium datum is the two wings' mean",
    got: F["podium.datum"].value, want: (E.podiumN + E.podiumS) / 2, tol: 1e-9 });
  rel.push({ name: "THE KEYSTONE: seven equal storeys close the slab on the podium datum",
    got: F["podium.datum"].value + 7 * F["storey.slab"].value, want: E.slab, tol: 1e-9 });
  rel.push({ name: "the shipped storey grid is the derived one — floor 3",
    got: section.system.gallery.levels[1],
    want: F["podium.datum"].value + F["storey.slab"].value, tol: 1e-5 });
  rel.push({ name: "floor 8's line sits one storey under the roof",
    got: section.system.gallery.levels[6] + F["storey.slab"].value, want: E.slab, tol: 1e-5 });
  rel.push({ name: "the crown rise is the two plateaus' difference",
    got: F["crown.rise"].value, want: E.crownW - E.slab, tol: 1e-9 });
  rel.push({ name: "the east rise likewise",
    got: F["eastTower.rise"].value, want: E.crownE - E.slab, tol: 1e-9 });
  rel.push({ name: "the rim in renderer y is the EPT rim over the lidar datum",
    got: F["rim.local"].value, want: E.rimBaseAbs - lidar.datum, tol: 1e-4 });
  rel.push({ name: "the fascia is the two cleanest FWHMs over the pitch, in metres",
    got: F["fascia.metres"].value,
    want: (((section.derivations.readings.px.fwhm8 + section.derivations.readings.px.fwhm7) / 2)
      / F["px.pitch"].value) * F["storey.slab"].value, tol: 1e-5 });
  rel.push({ name: "the shipped fascia is the derived fascia",
    got: section.system.gallery.fascia, want: F["fascia.metres"].value, tol: 1e-9 });
  rel.push({ name: "the shipped curtain line depth is the estimate's value",
    got: section.system.curtain.lineDepth, want: section.estimates["curtain.lineDepth"].value, tol: 1e-9 });
  rel.push({ name: "the shipped louvre depth is the estimate's value",
    got: section.system.louvre.depth, want: section.estimates["louvre.depth"].value, tol: 1e-9 });
  rel.push({ name: "the louvre's west-half line is the podium edge's own midpoint",
    got: section.system.louvre.westHalfMax, want: (-33.1 + 2.4) / 2, tol: 1e-9 });
  /* PITCH UNIFORMITY — the photograph agreeing with the equal-floor model. */
  assert.ok(F["check.pitchSpreadPct"].value < 3,
    `the band pitch now spreads ${F["check.pitchSpreadPct"].value}% — the seven-equal-floors model needs re-arguing before anything is redrawn`);
  /* The two right countings stay reconciled, not averaged. */
  const S = section.derivations.readings.survey;
  assert.equal(S.facilitiesFloors, 8);
  assert.equal(S.gisLevels, 7);
  assert.equal(section.system.storey.floors, 8);
  assert.match(section.system.storey.floorsNote, /neither is wrong/i);
  assertRelations({ relations: rel, label: "urey" });
});

const drawNoteFor = (path) => {
  const parts = path.split(".").slice(1);
  const note = section.draw[`${parts[0]}Note`];
  return typeof note === "string" && note.length > 40 ? "declared render offset" : null;
};

const SAMPLE_PINS = {
  wallPaint: { rgb: [220, 218, 219], mean: 218.8, sd: 14.5, lum: 218.6 },
  louvrePanel: { rgb: [79, 79, 82], mean: 80.1, sd: 62.1, lum: 79.5 },
  glazingDark: { rgb: [82, 81, 84], mean: 82.1, sd: 61.6, lum: 81.5 },
  galleryFascia: { rgb: [220, 218, 219], mean: 218.8, sd: 14.5, lum: 218.6 },
  curtainLine: { rgb: [220, 218, 219], mean: 218.8, sd: 14.5, lum: 218.6 },
  slabRoofMembrane: { rgb: [224, 229, 232], mean: 228.6, sd: 37.8, lum: 228.4 },
  crownRoof: { rgb: [211, 219, 227], mean: 219.1, sd: 53.1, lum: 218.2 },
  podiumDeck: { rgb: [157, 139, 123], mean: 139.5, sd: 24.5, lum: 141.4 },
  podiumRoofNorth: { rgb: [157, 139, 123], mean: 139.5, sd: 24.5, lum: 141.4 },
  eastTowerRoof: { rgb: [224, 229, 232], mean: 228.6, sd: 37.8, lum: 228.4 },
  groundLawn: { rgb: [89, 110, 79], mean: 92.7, sd: 32, lum: 103.5 },
  groundBed: { rgb: [138, 118, 95], mean: 116.7, sd: 45.1, lum: 120.4 },
};
/* The unbuilt samples' numbers are VALUE-PINNED here too (audit-urey F1/F2:
   the first pass held a luminance that recomputed from nothing, and only
   existence was gated). `lum` is Rec.709 of the rect's own channel means and
   is OMITTED where the sample is channel-mean-only per the house rule. */
const UNBUILT_PINS = {
  endTowerField: { mean: 144.5, sd: 7.6, lum: 143.8 },
  wallShadedBase: { mean: 107.1, sd: 84.8, lum: 108.0 },
  slabWestOfPenthouse: { mean: 200.9, sd: 73.0, lum: 200.7 },
  northPodiumShadow: { mean: 92.5, sd: 61.1, lum: 90.3 },
  additionRoof: { mean: 156.7, sd: 32.1 },
  lawnWestGrove: { mean: 77.0, sd: 29.1, lum: 91.4 },
  walkInShadow: { mean: 73.2, sd: 44.9, lum: 72.3 },
};
const CONTROL_PINS = { sunlitWallAnnex: true, shadedWallAnnex: true };

test("S1(i): no bare number survives in readings, estimates, draw, colours or samples", () => {
  const paths = assertCoverage({
    section, label: "urey", minimum: 60,
    roots: {
      "derivations.readings": {}, estimates: {}, draw: {},
      colorSources: {}, colorThreshold: {}, samples: {},
    },
    uncovered: {},
    classify: (path) => {
      if (path.startsWith("derivations.readings.")) {
        return READING_PINS[path.slice("derivations.readings.".length)] ? "pinned" : null;
      }
      if (/^estimates\..+\.(value|band\.[01])$/.test(path)) return "banded";
      if (path.startsWith("draw.")) return drawNoteFor(path);
      if (/^colorSources\.[A-Za-z]+\.(channelMean|sampleSd|luminance)$/.test(path)) {
        return SAMPLE_PINS[path.split(".")[1]] ? "pinned sample" : null;
      }
      if (/^samples\.[A-Za-z]+\.(channelMean|sampleSd|luminance|rect\.\d+)$/.test(path)) {
        return UNBUILT_PINS[path.split(".")[1]] ? "pinned sample" : null;
      }
      if (/^colorThreshold\.(sunlitMin|sdMax)$/.test(path)) return "pinned threshold";
      if (/^colorThreshold\.controls\.\d+\.(L|sdMax|rect\.\d+)$/.test(path)) {
        return CONTROL_PINS[section.colorThreshold.controls[Number(path.split(".")[2])]?.key]
          ? "pinned control" : null;
      }
      return null;
    },
  });
  assert.ok(paths.length >= 80, `the walk only found ${paths.length} numbers in the axiom layer`);
  const drawNumbers = paths.filter((p) => p.path.startsWith("draw."));
  assert.ok(drawNumbers.length >= 8, `only ${drawNumbers.length} draw numbers walked`);
  for (const { path } of drawNumbers) {
    assert.ok(drawNoteFor(path), `${path} has no sibling Note saying why it is not a measurement`);
  }
});

const EST_SHIPPED = {
  "curtain.lineDepth": () => section.system.curtain.lineDepth,
  "louvre.depth": () => section.system.louvre.depth,
};

test("S1(ii): every estimate carries a band, the shipped value inside it, the ladder recorded", () => {
  const n = assertEstimateBands({
    estimates: section.estimates,
    valueAt: (key) => {
      const f = EST_SHIPPED[key];
      assert.ok(f, `urey: estimate ${key} governs no shipped value this suite knows about`);
      return f();
    },
    label: "urey",
  });
  assert.equal(n, Object.keys(section.estimates).length);
  for (const [k, e] of Object.entries(section.estimates)) {
    assert.ok(e.bandWhy?.length > 80, `estimate ${k}'s band is a bare pair with no argument`);
    assert.match(e.why, /Ladder climbed and failed/i);
    for (const rung of ["photos", "Street View", "drone", "planning docs", "archives"]) {
      assert.ok(e.why.includes(rung), `estimate ${k}'s ladder skips the ${rung} rung`);
    }
    /* Both estimates extend the building's OWN measured band population and
       their bands must BE that population's span in metres. */
    const lo = (section.derivations.readings.px.fwhm7 / section.derivations.figures["px.pitch"].value)
      * section.derivations.figures["storey.slab"].value;
    const hi = (section.derivations.readings.px.fwhm4 / section.derivations.figures["px.pitch"].value)
      * section.derivations.figures["storey.slab"].value;
    near(e.band[0], Math.round(lo * 1e4) / 1e4, 1e-9, `${k}'s band floor is not the population's own`);
    near(e.band[1], Math.round(hi * 1e4) / 1e4, 1e-9, `${k}'s band ceiling is not the population's own`);
  }
});

/* ==================== COLOUR ==================== */

test("every hex is the byte-rounding of its own pinned channel means", () => {
  for (const [role, p] of Object.entries(SAMPLE_PINS)) {
    const hex = section.colors[role];
    assert.ok(typeof hex === "string", `no colour for role ${role}`);
    const want = `#${p.rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
    assert.equal(hex.toLowerCase(), want, `${role}'s hex is not its own channel means`);
    const cs = section.colorSources[role];
    assert.ok(cs, `no colorSources line for ${role}`);
    near(cs.channelMean, p.mean, 0.05, `${role}.channelMean`);
    near(cs.sampleSd, p.sd, 0.05, `${role}.sampleSd`);
    near(cs.luminance, p.lum, 0.05, `${role}.luminance`);
    near(cs.channelMean, (p.rgb[0] + p.rgb[1] + p.rgb[2]) / 3, 0.7,
      `${role}: the channel mean is not the mean of its own channels`);
  }
  for (const role of Object.keys(section.colors)) {
    assert.ok(SAMPLE_PINS[role], `colour role ${role} is not pinned in this suite`);
  }
  /* The unbuilt samples recompute too — a recorded read is still a read. */
  for (const [key, p] of Object.entries(UNBUILT_PINS)) {
    const smp = section.samples[key];
    assert.ok(smp, `samples.${key} has disappeared`);
    near(smp.channelMean, p.mean, 0.05, `samples.${key}.channelMean`);
    near(smp.sampleSd, p.sd, 0.05, `samples.${key}.sampleSd`);
    if (p.lum === undefined) {
      assert.equal(smp.luminance, undefined,
        `samples.${key} carries a luminance this suite does not pin — the statistic of record is the channel mean (audit-urey F1)`);
    } else {
      near(smp.luminance, p.lum, 0.05, `samples.${key}.luminance`);
    }
  }
  for (const key of Object.keys(section.samples)) {
    if (key === "samplesNote") continue;
    assert.ok(UNBUILT_PINS[key], `samples.${key} is recorded and not pinned in this suite`);
  }
});

test("the tier rule holds symmetrically, and the threshold decides the tiers", () => {
  const entries = Object.entries(section.colorSources).map(([key, v]) => ({ key, text: v.source }));
  entries.push(...Object.entries(section.samples)
    .filter(([k]) => k !== "samplesNote")
    .map(([key, v]) => ({ key: `samples.${key}`, text: `[sourced] ${v.source}` })));
  assertTierSymmetry({ entries: entries.filter((e) => typeof e.text === "string"), label: "urey" });
  const TH = section.colorThreshold;
  assert.equal(TH.sunlitMin, 120);
  assert.equal(TH.sdMax, 15);
  for (const [role, cs] of Object.entries(section.colorSources)) {
    if (cs.tier === "measured") {
      assert.ok(cs.channelMean >= TH.sunlitMin && cs.sampleSd <= TH.sdMax,
        `${role} claims [measured] and fails the 120/15 rule (${cs.channelMean}/${cs.sampleSd})`);
      assert.match(cs.source, /^\[measured\]/);
    }
    if (cs.tier === "estimated") assert.match(cs.source, /^\[estimated\] extends /);
    if (cs.tier === "sourced") assert.match(cs.source, /^\[sourced\]/);
  }
  /* Ortho reads cap at [sourced] whatever they score. */
  for (const role of ["slabRoofMembrane", "crownRoof", "podiumDeck", "groundLawn", "groundBed"]) {
    assert.notEqual(section.colorSources[role].tier, "measured",
      `${role} is an ortho read and cannot be [measured] — calibration is unknowable`);
  }
  /* The two controls bracket the rule. */
  const [c0, c1] = TH.controls;
  assert.ok(c0.L >= 120 && c0.sdMax <= 15, "the passing control no longer passes");
  assert.ok(c1.L < 120 && c1.sdMax > 15, "the failing control no longer fails");
});

test("colour roles are bidirectional: every declared role referenced, every reference declared", () => {
  const used = new Set();
  for (const m of moduleCode.matchAll(/hue\("([A-Za-z]+)"\)/g)) used.add(m[1]);
  for (const role of Object.keys(section.colors)) {
    assert.ok(used.has(role), `colour role ${role} is declared and never referenced by the module`);
  }
  for (const role of used) {
    assert.ok(section.colors[role], `the module references undeclared colour role ${role}`);
  }
});

/* ==================== MODULE HYGIENE ==================== */

test("the module carries no hex literal, no randomness, no clock, no texture fetch", () => {
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(moduleCode), "hex literal in module code");
  assert.ok(!/0x[0-9a-fA-F]{6}/.test(moduleCode), "numeric colour literal in module code");
  assert.ok(!/Math\.random/.test(moduleCode), "Math.random in module");
  assert.ok(!/Date\.now|new Date/.test(moduleCode), "clock in module");
  assert.ok(!/TextureLoader|ImageLoader|fetch\(/.test(moduleCode), "runtime asset fetch in module");
});

test("the module never reads a measured document or performs a name lookup", () => {
  assert.ok(!/arcgis|campus-3d|campus-lidar/.test(moduleCode),
    "the module reads a measured document at runtime — it must read only its own photo key");
  assert.ok(!/massHeights|heights\s*\[/.test(moduleCode),
    "the module indexes a heights table — every height must come through the section");
  assert.match(moduleSrc, /ONE DATUM PER MASS/i,
    "the module must state the one-datum rule it is gated on");
});

/* ==================== THE BUILT SCENE ==================== */

test("missing section and missing sampler behave as contracted", () => {
  const none = createPhotoUrey(null, { photo: {}, surfaceAt: flat });
  assert.deepEqual(none.counts, {});
  assert.equal(none.group.children.length, 0);
  assert.throws(() => createPhotoUrey(null, { photo: { urey: section } }),
    /surfaceAt/, "a missing sampler must throw, not sink the building 24 m");
});

test("counts declared == counts built, on flat ground", () => {
  const { counts } = build(flat);
  for (const [k, v] of Object.entries(section.counts)) {
    if (k === "note") continue;
    assert.equal(counts[k], v, `counts.${k}: declared ${v}, built ${counts[k]}`);
  }
  for (const [k, v] of Object.entries(counts)) {
    assert.ok(section.counts[k] !== undefined, `built count ${k}=${v} is not declared`);
  }
});

test("two builds are byte-identical", () => {
  const dump = (g) => {
    const parts = [];
    g.group.traverse((o) => {
      if (!o.isMesh) return;
      parts.push(o.name);
      const pos = o.geometry.getAttribute("position");
      parts.push(Buffer.from(pos.array.buffer, pos.array.byteOffset, pos.array.byteLength).toString("base64"));
    });
    return parts.join("|");
  };
  assert.equal(dump(build(drawnGround)), dump(build(drawnGround)), "the build is not deterministic");
});

test("provenance lives in the mesh names, and the estimated set is exactly the declared one", () => {
  const names = meshNames(build(flat).group);
  for (const n of names) {
    assert.match(n, /^urey-[a-z-]+-(sourced|estimated)$/i, `mesh ${n} carries no tier in its name`);
  }
  const est = new Set(names.filter((n) => n.endsWith("-estimated")));
  assert.deepEqual([...est].sort(), [
    "urey-curtain-line-estimated",
    "urey-gallery-fascia-estimated",
    "urey-louvre-band-estimated",
    "urey-roof-eastTower-estimated",
    "urey-roof-podiumN-estimated",
  ], "the estimated population has changed — either a tier moved without its mesh name, or a mesh name moved without its tier");
});

test("the withholdings are real in the scene", () => {
  const names = meshNames(build(flat).group);
  for (const banned of [/canopy/i, /screen/i, /mech/i, /unit/i, /spike/i, /walk/i, /addition/i, /skylight/i, /letter/i]) {
    assert.ok(!names.some((n) => banned.test(n)),
      `a mesh name matches ${banned} — a declared withholding has been built`);
  }
});

test("every lid sits at rim + its own plateau, on all three terrains", () => {
  const ring = section.measured.urey.ring;
  for (const g of [flat, slope, drawnGround]) {
    const { group } = build(g);
    const rim = rimOf(ring, g, section.draw.datumStep);
    group.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    group.traverse((o) => {
      if (!o.isMesh || !/^urey-roof-/.test(o.name)) return;
      const plane = o.name.replace(/^urey-roof-/, "").replace(/-(sourced|estimated)$/, "");
      const h = plane === "penthouse"
        ? section.system.planes.crownTower.h
        : section.system.planes[plane].h;
      const pos = o.geometry.getAttribute("position");
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        near(v.y, rim + h, 3e-4, `${o.name} lid vertex off its plane`);
      }
    });
  }
});

test("on the real drawn terrain the rim datum agrees with the EPT rim base to 0.35 m", () => {
  const rim = rimOf(section.measured.urey.ring, drawnGround, section.draw.datumStep);
  near(rim, section.derivations.figures["rim.local"].value, 0.35,
    "the drawn terrain and the EPT rim base disagree — one of them moved");
});

test("nothing stands above the crown, and the east tower tops at 29.18 exactly", () => {
  for (const g of [flat, drawnGround]) {
    const { group } = build(g);
    const rim = rimOf(section.measured.urey.ring, g, section.draw.datumStep);
    group.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    let maxY = -Infinity;
    let maxEast = -Infinity;
    group.traverse((o) => {
      if (!o.isMesh) return;
      const pos = o.geometry.getAttribute("position");
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        if (v.y > maxY) maxY = v.y;
        if (v.x > 21.4 && v.z > 252.6 && v.z < 282.4 && v.y > maxEast) maxEast = v.y;
      }
    });
    near(maxY, rim + section.system.planes.crownTower.h, 3e-4, "something stands above the crown");
    near(maxEast, rim + section.system.planes.eastTower.h, 3e-4,
      "the east tower is not 29.18 exactly — the 32.9 spike is absent A3 and must stay unbuilt");
  }
});

test("no wall hovers: every mass wall's foot sits below the drawn surface along its plan", () => {
  for (const g of [flat, slope, drawnGround]) {
    const { group } = build(g);
    group.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    group.traverse((o) => {
      if (!o.isMesh || o.name !== "urey-mass-walls-sourced") return;
      const pos = o.geometry.getAttribute("position");
      for (let i = 0; i + 5 < pos.count; i += 6) {
        let yLo = Infinity;
        let gLo = Infinity;
        for (const k of [0, 1]) { // the quad's two foot vertices
          v.fromBufferAttribute(pos, i + k).applyMatrix4(o.matrixWorld);
          yLo = Math.min(yLo, v.y);
          gLo = Math.min(gLo, g(v.x, v.z));
        }
        /* The penthouse's walls stand on the slab roof, not the ground. */
        if (yLo > g(v.x, v.z) + section.system.planes.slab.h - 1) continue;
        assert.ok(yLo <= gLo + 3e-4,
          `a wall foot at y ${yLo.toFixed(2)} hovers over ground ${gLo.toFixed(2)}`);
      }
    });
  }
});

test("the seven gallery bands hang on the measured grid at the measured depth", () => {
  const g = flat;
  const { group } = build(g);
  const rim = rimOf(section.measured.urey.ring, g, section.draw.datumStep);
  const levels = section.system.gallery.levels;
  let quads = 0;
  eachQuad(group, "urey-gallery-fascia-estimated", (q) => {
    quads++;
    const lvl = q.yLo - rim;
    assert.ok(levels.some((L) => Math.abs(L - lvl) < 1e-4),
      `a fascia quad hangs at ${lvl.toFixed(3)}, off the storey grid`);
    near(q.yHi - q.yLo, section.system.gallery.fascia, 3e-4, "a fascia quad is not the measured depth");
  });
  assert.equal(quads, section.counts.fasciaQuads);
  assert.equal(levels.length, section.system.gallery.bands, "the level list is not the band count");
  /* The five north-facing runs, as (x0, x1, z of the surveyed line): the
     z 252.6 partition line over the wing, the ring's own north edges at
     z 252.7-252.8 and 253.1, the west lobe's at 265.6, the east arm's step
     at 256.9. Derived facts about the slab plan, pinned as values. */
  const CURTAIN_EDGES = [
    [-24, 17.7, 252.6], [-37.9, -24, 252.75], [-43.7, -38.3, 253.1],
    [-51, -40.5, 265.6], [18.1, 21.4, 256.9],
  ];
  const curtainUse = CURTAIN_EDGES.map(() => 0);
  let lines = 0;
  eachQuad(group, "urey-curtain-line-estimated", (q) => {
    lines++;
    const lvl = q.yLo - rim;
    assert.ok(levels.some((L) => Math.abs(L - lvl) < 1e-4),
      `a curtain line hangs at ${lvl.toFixed(3)}, off the storey grid`);
    near(q.yHi - q.yLo, section.system.curtain.lineDepth, 3e-4, "a curtain line is not the estimate's depth");
    /* Curtain lines live on the FIVE north-facing runs of the slab plan —
       the partition line over the wing, the ring's own stepped north edges,
       the west lobe's north edge and the east arm's north step — and nowhere
       else. Each signature is used once per storey. */
    const hit = CURTAIN_EDGES.findIndex((e) =>
      Math.abs(q.xLo - Math.min(e[0], e[1])) < 0.25 && Math.abs(q.xHi - Math.max(e[0], e[1])) < 0.25
      && Math.abs(q.z - e[2]) < 0.3);
    assert.ok(hit >= 0,
      `a curtain line at x ${q.xLo.toFixed(1)}..${q.xHi.toFixed(1)}, z ${q.z.toFixed(1)} matches no declared north face`);
    curtainUse[hit]++;
  });
  assert.equal(lines, section.counts.curtainLines);
  assert.deepEqual(curtainUse, CURTAIN_EDGES.map(() => section.system.gallery.bands),
    "each north face must carry exactly the seven lines");
  /* And no fascia band sits on those north edges. */
  eachQuad(group, "urey-gallery-fascia-estimated", (q) => {
    const onCurtain = CURTAIN_EDGES.some((e) =>
      Math.abs(q.xLo - Math.min(e[0], e[1])) < 0.25 && Math.abs(q.xHi - Math.max(e[0], e[1])) < 0.25
      && Math.abs(q.z - e[2]) < 0.3);
    assert.ok(!onCurtain,
      `a gallery band sits on a north face at z ${q.z.toFixed(1)} — the two systems have swapped`);
  });
});

test("the louvre band rides the west half of the podium wall's head, and only there", () => {
  const g = flat;
  const { group } = build(g);
  const rim = rimOf(section.measured.urey.ring, g, section.draw.datumStep);
  let quads = 0;
  eachQuad(group, "urey-louvre-band-estimated", (q) => {
    quads++;
    assert.ok(q.z > 287 && q.z < 310.0, `a louvre quad at z ${q.z.toFixed(1)} is not on the podium's south walls`);
    assert.ok(q.xHi <= section.system.louvre.westHalfMax + 0.1,
      `a louvre quad reaches x ${q.xHi.toFixed(1)}, past the west-half line`);
    near(q.yHi, rim + section.system.planes.podiumS.h, 3e-4, "the louvre is not at the podium head");
    near(q.yHi - q.yLo, section.system.louvre.depth, 3e-4, "the louvre is not the estimate's depth");
  });
  assert.equal(quads, section.counts.louvreQuads);
});

test("DECLARE AND WITHHOLD: a band the terrain would bury is withheld whole, and counted", () => {
  const { counts } = build(bump);
  assert.ok(counts.bandsWithheld > 0,
    "the 6 m shoulder buried no band — the burial rule is not executing");
  assert.ok(counts.fasciaQuads < section.counts.fasciaQuads,
    "bands were withheld but the fascia count did not fall");
  /* And on the bump terrain nothing drawn dips under the ground it spans. */
  const { group } = build(bump);
  eachQuad(group, "urey-gallery-fascia-estimated", (q) => {
    let gmax = -Infinity;
    for (let i = 0; i <= 8; i++) {
      const x = q.xLo + ((q.xHi - q.xLo) * i) / 8;
      const z = q.zLo + ((q.zHi - q.zLo) * i) / 8;
      gmax = Math.max(gmax, bump(x, z));
    }
    assert.ok(q.yLo >= gmax - 3e-4, "a drawn band emerges from the bump terrain");
  });
  /* The drawn LiDAR terrain withholds nothing — a measured zero, declared. */
  const real = build(drawnGround).counts;
  assert.equal(real.bandsWithheld, section.system.gallery.groundClip.withheldOnDrawnTerrain);
  assert.equal(real.fasciaQuads + real.curtainLines, section.system.gallery.groundClip.builtOnDrawnTerrain);
});

test("the carpets lie on the drawn surface at the carpet rung, ring for ring", () => {
  const lift = overlayLift(section.draw.bedRung);
  for (const g of [flat, slope, drawnGround]) {
    const { group, counts } = build(g);
    assert.equal(counts.lawns, 2);
    assert.equal(counts.beds, 4);
    group.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    group.traverse((o) => {
      if (!o.isMesh || !/^urey-(lawn|bed)-sourced$/.test(o.name)) return;
      const pos = o.geometry.getAttribute("position");
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        near(v.y, g(v.x, v.z) + lift, 3e-4, `${o.name} vertex off the drawn surface`);
      }
    });
  }
});

test("the owned ground rings are the survey's, verbatim, and the walk ships as a record only", () => {
  const groundOf = (i) => arcgis.ground[i].r.map((r) => r.map(([x, z]) => [x / 10, z / 10]));
  const expected = { 2155: "lawn", 2008: "lawn", 1249: "bed", 2378: "bed", 2162: "bed", 529: "bed", 2828: "walk" };
  assert.equal(section.measured.groundRings.owned.length, Object.keys(expected).length);
  for (const g of section.measured.groundRings.owned) {
    assert.equal(expected[g.index], g.role, `ring #${g.index}'s role`);
    assert.deepEqual(g.rings, groundOf(g.index), `ring #${g.index} is not the survey's, verbatim`);
    assert.equal(g.kind, arcgis.ground[g.index].k, `ring #${g.index}'s kind`);
    near(g.areaM2, shoelace(g.rings[0]), 0.01, `ring #${g.index}'s area`);
    if (g.role === "walk") {
      assert.equal(g.carpet, false, "the shadow-blind walk must ship as a record, not a surface");
      assert.match(g.what, /RECORD ONLY/);
    }
  }
  /* The boundary conflict ring is carried and drawn by neither claim. */
  assert.equal(section.measured.groundRings.boundary[0].index, 1246);
  const names = meshNames(build(flat).group);
  assert.equal(names.filter((n) => n === "urey-lawn-sourced").length, 2);
  assert.equal(names.filter((n) => n === "urey-bed-sourced").length, 4);
});

test("R4 arbitration D5/B3: the mislabelled frame stays demoted and #1725 points at mayer", () => {
  /* D5: bb9352649m shows Mayer (five levels + external scissor stairs); it may
     be cited as corroboration only, never re-promoted to a load-bearing Urey
     source — the annotation IS the gate. */
  const src = section.sources.find((s) => /bb9352649m/.test(s));
  assert.ok(src, "the bb9352649m source line has vanished instead of staying demoted");
  assert.match(src, /DISPUTED IDENTITY/i,
    "bb9352649m has been re-promoted: the disputed-identity annotation (arbitration D5) is gone");
  assert.match(src, /CORROBORATION ONLY/i, "the frame's corroboration-only status is gone");
  const lawn2008 = section.measured.groundRings.owned.find((g) => g.index === 2008);
  assert.ok(!/camera position of ucsddc-bb9352649m/.test(lawn2008.what),
    "lawn #2008 has re-acquired the struck camera-position claim for bb9352649m");
  /* B3: #1725 is mayer's (JETT SOUTH PINE GROVE) — every urey pointer must
     name the receiver that actually registered it, not 'bonner/breezeway'. */
  for (const [where, text] of [
    ["boundary.east", section.boundary.east],
    ["boundary.handedForwardNote", section.boundary.handedForwardNote],
    ["groundRings.notMine[#1725]", section.measured.groundRings.notMine.find((n) => n.index === 1725).what],
  ]) {
    assert.match(text, /mayer/i, `${where} no longer names mayer as #1725's owner (arbitration B3)`);
    assert.ok(!/1725[^.]*bonner\/breezeway territory/.test(text),
      `${where} still assigns #1725 to bonner/breezeway — the dead pointer is back`);
  }
});

test("nothing built stands inside the Addition's own footprint", () => {
  const add = section.measured.addition.ring;
  const { group } = build(flat);
  group.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  group.traverse((o) => {
    if (!o.isMesh || /^urey-(lawn|bed)/.test(o.name)) return;
    const pos = o.geometry.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if (!inRing(v.x, v.z, add)) continue;
      /* The shared abutment line gets exactly the declared render-offset
         stack's grace (wall + field + band standoffs + mitre margin), derived
         from `draw` so a changed offset moves the grace WITH it — a real
         intrusion is metres, not centimetres. */
      let d = Infinity;
      for (let k = 0; k < add.length - 1; k++) {
        const [ax, az] = add[k];
        const [bx, bz] = add[k + 1];
        const dx = bx - ax;
        const dz = bz - az;
        const l2 = dx * dx + dz * dz;
        const t = l2 ? Math.max(0, Math.min(1, ((v.x - ax) * dx + (v.z - az) * dz) / l2)) : 0;
        d = Math.min(d, Math.hypot(v.x - (ax + t * dx), v.z - (az + t * dz)));
      }
      const grace = section.draw.wallOffset + section.draw.fieldStandoff
        + section.draw.bandStandoff + 0.04;
      assert.ok(d < grace,
        `${o.name} stands ${d.toFixed(2)} m inside the 1991 Office Addition — the module builds NOTHING of it`);
    }
  });
});

test("NEVER FLUSH: every facade layer stands strictly proud of its carrying wall face", () => {
  /* The round-2 visual critic's defect class: the dark glazed fields sat
     flush with or behind the proud-offset mass walls, lost the depth test,
     and every face rendered blank white. The invariant is wall < field <
     band, declared in `draw` and measured here per quad: each facade quad's
     centre must stand further from the plan polyline than the wall face does,
     by at least 0.02 m — a coincident quad fails by name. */
  assert.ok(section.draw.fieldStandoff >= 0.02,
    "fieldStandoff no longer clears the wall face — the blank-face class returns");
  assert.ok(section.draw.bandStandoff >= 0.02,
    "bandStandoff no longer clears the field");
  /* Every plan edge the walls are hung on, from the test's own clipper. */
  const ring = section.measured.urey.ring;
  const edges = [];
  for (const plane of Object.values(section.system.planes)) {
    for (const box of plane.clip) {
      const plan = clipBox(ring, box);
      if (!plan) continue;
      for (let k = 0; k < plan.length - 1; k++) edges.push([plan[k], plan[k + 1]]);
    }
  }
  const P = section.system.penthouse;
  for (const [a, b] of [[[P.x0, P.z0], [P.x1, P.z0]], [[P.x1, P.z0], [P.x1, P.z1]],
    [[P.x1, P.z1], [P.x0, P.z1]], [[P.x0, P.z1], [P.x0, P.z0]]]) edges.push([a, b]);
  const distToEdges = (x, z) => {
    let best = Infinity;
    for (const [a, b] of edges) {
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const l2 = dx * dx + dz * dz;
      if (!(l2 > 0)) continue;
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2));
      best = Math.min(best, Math.hypot(x - (a[0] + t * dx), z - (a[1] + t * dz)));
    }
    return best;
  };
  const { group } = build(flat);
  const wall = section.draw.wallOffset;
  for (const meshName of ["urey-gallery-glazing-sourced", "urey-curtain-glass-sourced",
    "urey-gallery-fascia-estimated", "urey-curtain-line-estimated", "urey-louvre-band-estimated"]) {
    let quads = 0;
    eachQuad(group, meshName, (q) => {
      quads++;
      const d = distToEdges(q.x, q.z);
      assert.ok(d >= wall + 0.02,
        `${meshName}: a quad stands ${d.toFixed(3)} m off the plan — flush with or behind the ${wall} m wall face, the blank-face class`);
      assert.ok(d <= 0.5,
        `${meshName}: a quad floats ${d.toFixed(3)} m off its wall — detached treatment`);
    });
    assert.ok(quads > 0, `${meshName} has no quads to gate`);
  }
});

test("the merge file and the shipped key are byte-twins until main retires the merge file", () => {
  /* The round-3 material fix was synced into the shipped doc AND the merge
     file together (bonner precedent, coordinator-authorized 2026-08-21); a
     divergence means one of them carries a fix the other lost. */
  const mergePath = "Revelle-College-Sources/merge/r4/urey.json";
  if (!existsSync(join(root, mergePath))) return; // main has retired it — shipped stands alone
  assert.equal(JSON.stringify(read(mergePath)), JSON.stringify(section),
    "merge/r4/urey.json and the shipped urey key have diverged");
});

test("VISUAL: the glazed fields are OPAQUE at the declared dark hex — never transmissive", () => {
  /* The round-3 critic's defect (the mayer V2 class): the library glass class
     is transparent at opacity 0.35 with depthWrite off, so the white wall one
     standoff behind the fields showed through and every field washed to
     85-90% of the fascia's luminance — the inverse of the 1965 balance. The
     fields are one uniformly dark matte plane (in-band rhythm A2 and mullion
     module A1 both withheld), and the BUILT material instances are pinned
     here so a transmissive regression fails by name. */
  const { group } = build(flat);
  const want = section.colors.glazingDark.replace("#", "").toLowerCase();
  let seen = 0;
  group.traverse((o) => {
    if (!o.isMesh) return;
    if (o.name !== "urey-gallery-glazing-sourced" && o.name !== "urey-curtain-glass-sourced") return;
    seen++;
    const m = o.material;
    assert.notEqual(m.transparent, true, `${o.name}'s material is transparent — the wall behind will show through`);
    assert.equal(m.opacity, 1, `${o.name}'s material opacity is ${m.opacity}, not 1`);
    assert.notEqual(m.depthWrite, false, `${o.name}'s material has depthWrite off — the glass class's signature`);
    assert.equal(m.color.getHexString(), want,
      `${o.name} renders at #${m.color.getHexString()}, not the declared glazingDark #${want}`);
  });
  assert.equal(seen, 2, "both field meshes must exist to be gated");
  /* And the DATA relation the render depends on: the field is decisively
     darker than the band and wall whites, per the section's own samples. */
  const mean = (role) => {
    const h = section.colors[role].replace("#", "");
    return (parseInt(h.slice(0, 2), 16) + parseInt(h.slice(2, 4), 16) + parseInt(h.slice(4, 6), 16)) / 3;
  };
  assert.ok(mean("glazingDark") < 0.6 * mean("galleryFascia"),
    "glazingDark is no longer decisively darker than the fascia — the 1965 balance inverts");
  assert.ok(mean("glazingDark") < 0.6 * mean("wallPaint"),
    "glazingDark is no longer decisively darker than the wall paint");
});

/* ==================== SUPERSESSION AND THE RECORD ==================== */

test("the ureyCorner supersession: record complete, geometry argued against the surveys", () => {
  assert.equal(section.supersedes.length, 1);
  const s = section.supersedes[0];
  assert.equal(s.key, "revelle.systems.ureyCorner");
  assert.equal(s.disposition, "transferred");
  assert.ok(s.claims.length > 100 && s.ships.length > 100 && s.why.length > 100);
  assert.match(s.date, /^2026-/);
  assert.match(s.mainMustApply, /revelle\.superseded\['systems\.ureyCorner'\] = \['urey'\]/);
  assert.match(s.mainMustApply, /campus-photo-revelle\.js/);
  /* The record's geometry: the screen stood at the OSM max z, which is the
     Addition's face; the real slab face is 33 m north of it. */
  assert.match(s.ships, /z 282\.4/);
  assert.match(s.ships, /z 309\.5/);
  assert.match(s.claims, /z 315\.8/);
  /* Main applied the flip at merge (2026-08-21): revelle's record now names
     this section as owner, retires the draw via superseded, and keeps the
     object as the record the two sides argue over. */
  const revelle = read("docs/data/campus-photo-detail.json").revelle;
  if (revelle?.systems?.ureyCorner) {
    assert.equal(revelle.systems.ureyCorner.owner, "urey",
      "revelle.systems.ureyCorner must name this section as owner after the merge flip");
    assert.ok(revelle.superseded?.["systems.ureyCorner"]?.includes("urey"),
      "the merge flip must retire the corner from revelle's draw");
    near(revelle.systems.ureyCorner.faceZ, section.measured.osm.maxZ, 1e-9,
      "the held corner's faceZ is no longer the OSM max z the record argues against");
  }
  /* And no 30 m surface stands anywhere near z 315.8 in the built scene. */
  const { group } = build(flat);
  group.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  group.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if (v.z > 312 && v.y > 20 + 10) {
        assert.fail(`a surface ${(v.y - 20).toFixed(1)} m tall stands at z ${v.z.toFixed(1)} — the ureyCorner error rebuilt`);
      }
    }
  });
});

test("the six conflicts are declared with both sides and a stated resolution", () => {
  const keys = section.conflicts.map((c) => c.key);
  assert.deepEqual(keys.sort(), [
    "addition-south-face", "assignable-area", "gis-h-formula",
    "ground1246-overlap", "lidar-builder-narrative", "storey-count",
  ]);
  for (const c of section.conflicts) {
    assert.ok(c.sides.length >= 2, `${c.key} has fewer than two sides`);
    assert.ok(c.resolution.length > 60, `${c.key} has no argued resolution`);
  }
  const narrative = section.conflicts.find((c) => c.key === "lidar-builder-narrative");
  assert.match(narrative.resolution, /withholding .* was correct/i);
  assert.match(narrative.resolution, /canopy/i);
  assert.match(narrative.resolution, /NOT touched/i);
  const g1246 = section.conflicts.find((c) => c.key === "ground1246-overlap");
  assert.match(g1246.resolution, /DECLARED, NOT RESOLVED/i);
});

const ABSENT_EXPECTED = {};
for (const e of [
  ["A1", /MULLION MODULE/],
  ["A2", /BAY RHYTHM/],
  ["A3", /32\.9 m SPIKE/],
  ["A4", /NORTH PODIUM ROOF/],
  ["A5", /ground#1246|NORTH WING/],
  ["A6", /LETTERING/],
  ["A7", /PRE-1991 EAST COURT/],
  ["A8", /COLOUR CALIBRATION/],
  ["A9", /ROOF FURNITURE/],
  ["A10", /WEDGE ENTRANCE CANOPY/],
  ["A11", /SCREEN-BLOCK WALL/],
  ["A12", /OFFICE ADDITION'S OWN TREATMENT/],
  ["A13", /SOUTH DECK'S FURNITURE/],
]) ABSENT_EXPECTED[e[0]] = e[1];

test("S1(v): the absent list is non-shrinking and every entry still says what it withholds", () => {
  const byKey = new Map(section.absent.map((a) => [a.split(" ")[0], a]));
  for (const [key, probe] of Object.entries(ABSENT_EXPECTED)) {
    const entry = byKey.get(key);
    assert.ok(entry, `absent ${key} has disappeared — a withholding may not leave silently`);
    assert.match(entry, probe, `absent ${key} no longer says what it withholds`);
  }
  assertAbsentEntries({
    absent: section.absent.map((a) => a.split(" ")[0]),
    expected: Object.fromEntries(Object.keys(ABSENT_EXPECTED).map((k) => [k, new RegExp(k)])),
    label: "urey",
  });
  /* The estimate-bearing absences name their five-rung ladder. */
  for (const key of ["A1", "A10"]) {
    const entry = byKey.get(key);
    for (const rung of ["photos", "Street View", "drone", "planning docs", "archives"]) {
      assert.ok(entry.includes(rung), `absent ${key} skips the ${rung} rung`);
    }
  }
});

}
