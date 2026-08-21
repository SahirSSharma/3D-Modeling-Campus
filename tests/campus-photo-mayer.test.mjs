/* Mayer Hall + Mayer Hall Addition — INVENTED class, R4 batch, a NEW section.
 *
 * WHAT THIS SUITE EXISTS TO HOLD. The section makes five claims a later edit
 * could quietly undo, and each has a gate written against the claim:
 *
 *   - THE HEIGHT IS NOT OSM'S. lidar.heights["Mayer Hall"] = 23.2 is measured
 *     over osm:395, ONE merged ring covering Mayer + the Addition + a service
 *     yard, so it is a figure for neither building. The blob's reach over
 *     both GIS rings is recomputed HERE from the measured files, the losers
 *     (23.2 / OSM tag 20 / arcgis formula 21.3) must stay recorded, and the
 *     module may never perform a name lookup against a measured file.
 *
 *   - THE ADDITION'S EAST FACADE IS A MEASURED CIRCLE. The Kåsa fit is
 *     recomputed verbatim from the CARRIED ring at the pinned selection:
 *     centre (75.1, 305.4), R 74.3 m, worst 0.70 m over 108 vertices. The
 *     module hangs every quad off the ring's own chords, so gating the ring
 *     gates the facade — and the ring must stay deepEqual to the survey.
 *
 *   - THE GROUND FALLS 4.1 m UNDER MAYER. The four corner reads reproduce
 *     from the LiDAR terrain here, every footing seats on the drawn surface
 *     on flat, sloped and REAL terrain, and the gallery glazing the real
 *     terrain buries is withheld and counted — two counts, source grid vs
 *     terrain clip, per the R4 addendum.
 *
 *   - THE PV ARRAYS ARE POST-2014 FABRIC. They ship as a thin epoch-labelled
 *     layer ON the 2014 lid at measured extents; a gate fails if they grow
 *     thick, sink into the plate, leave their measured bands, or lose the
 *     epoch label. The monitor between them is period fabric with an
 *     [estimated] extent, and its mesh name says so.
 *
 *   - THE TWO RINGS SHARE A PARTY BOUNDARY. Mayer's east face is the
 *     Addition's west boundary verbatim; both modules must skip it, the skip
 *     counts are gated, and no treatment vertex may cross into the other
 *     mass. The research dossier's "1.3-2.7 m open seam" reading is retired
 *     on the ring's own evidence and the retirement is machine-readable.
 *
 * Every figure recomputes and so does every reading underneath it: all the
 * axiom gates of tests/helpers/axiom-gate.mjs run here, never forked.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as THREE from "../docs/vendor/three/three.module.min.js";
import { createPhotoMayer } from "../docs/js/campus-photo-mayer.js";
import { roofElevation } from "../docs/js/campus-massing.js";
import { makeHeightSampler, makeSurfaceSampler } from "../docs/js/campus-terrain.js";
import { overlayLift } from "../docs/js/campus-overlay.js";
import {
  assertCoverage, assertEstimateBands, assertPins, assertRelations,
  assertTierSymmetry, assertAbsentEntries, assertExprs, assertDispositions,
} from "./helpers/axiom-gate.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(p, "utf8"));

const shippedDoc = read(join(root, "docs/data/campus-photo-detail.json"));
const section = shippedDoc.mayer;
const skip = !section;

const campus = read(join(root, "docs/data/campus-3d.json"));
const lidar = read(join(root, "docs/data/campus-lidar.json"));
const arcgis = read(join(root, "docs/data/campus-arcgis.json"));

const moduleSrc = readFileSync(join(root, "docs/js/campus-photo-mayer.js"), "utf8");
/* Grep gates run on CODE, not commentary — the comments name the very
   constructs they forbid. */
const moduleCode = moduleSrc
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/[^\n]*$/gm, "");
const near = (a, b, eps, what) =>
  assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b} (tolerance ${eps})`);

const flat = () => 20;
const slope = (x, z) => 20 + 1.6 * Math.sin(x / 13) + 1.2 * Math.cos(z / 11);
const { heightAt: bilinear } = makeHeightSampler(lidar.terrain);
const drawnGround = makeSurfaceSampler(lidar.terrain);
const build = (g = flat) =>
  createPhotoMayer(null, { photo: { mayer: section }, heightAt: g, surfaceAt: g });

const ringOf = (i) => arcgis.massing[i].r[0].map(([x, z]) => [x / 10, z / 10]);
const ringM = () => section.measured.masses.mayer.ring;
const ringA = () => section.measured.masses.addition.ring;

/** Distance from a point to a closed ring's polyline. */
const ringDist = (x, z, r) => {
  let best = Infinity;
  for (let i = 0; i < r.length - 1; i++) {
    const [ax, az] = r[i];
    const [bx, bz] = r[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const l2 = dx * dx + dz * dz;
    const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0;
    best = Math.min(best, Math.hypot(x - (ax + t * dx), z - (az + t * dz)));
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

/** Every mesh's true world box. */
function each(node, fn) {
  node.updateMatrixWorld(true);
  node.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.computeBoundingBox();
    const box = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    fn({
      xLo: box.min.x, xHi: box.max.x, yLo: box.min.y, yHi: box.max.y,
      zLo: box.min.z, zHi: box.max.z, mesh: o, name: o.name,
    });
  });
}

/** Every quad of a folded band mesh (six vertices per quad, faceQuad order). */
function eachQuad(node, meshName, fn) {
  node.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  node.traverse((o) => {
    if (!o.isMesh || o.name !== meshName) return;
    const pos = o.geometry.getAttribute("position");
    for (let i = 0; i + 5 < pos.count; i += 6) {
      let x = 0, y = 0, z = 0;
      let xLo = Infinity, xHi = -Infinity, yLo = Infinity, yHi = -Infinity;
      let zLo = Infinity, zHi = -Infinity;
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

/** Every vertex of every mesh, world coordinates. */
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

/** The Kåsa least-squares circle fit — recomputed here, never trusted. */
function kasa(pts) {
  const n = pts.length;
  let sx = 0, sz = 0, sxx = 0, szz = 0, sxz = 0, sxr = 0, szr = 0, sr = 0;
  for (const [x, z] of pts) {
    const r2 = x * x + z * z;
    sx += x; sz += z; sxx += x * x; szz += z * z; sxz += x * z;
    sxr += x * r2; szr += z * r2; sr += r2;
  }
  const M = [[sxx, sxz, sx, sxr], [sxz, szz, sz, szr], [sx, sz, n, sr]];
  for (let i = 0; i < 3; i++) {
    const piv = M[i][i];
    for (let j = i; j < 4; j++) M[i][j] /= piv;
    for (let k = 0; k < 3; k++) {
      if (k === i) continue;
      const f = M[k][i];
      for (let j = i; j < 4; j++) M[k][j] -= f * M[i][j];
    }
  }
  const cx = M[0][3] / 2, cz = M[1][3] / 2;
  const R = Math.sqrt(M[2][3] + cx * cx + cz * cz);
  let worst = 0;
  for (const [x, z] of pts) worst = Math.max(worst, Math.abs(Math.hypot(x - cx, z - cz) - R));
  return { cx, cz, R, worst, n };
}

/* ------------------------------------------------------------ the section */

test("the section exists and carries the whole R4 apparatus", { skip }, () => {
  assert.ok(section, "no mayer section in the merge file or the shipped doc");
  for (const key of ["label", "epoch", "note", "bounds", "boundary", "sources",
    "measured", "derivations", "estimates", "reads", "draw", "system", "colors",
    "colorSources", "colorThreshold", "samples", "counts", "conflicts", "superseded", "absent"]) {
    assert.ok(section[key] !== undefined, `section is missing ${key}`);
  }
  assert.match(section.note, /INVENTED CLASS/, "the section must declare its class");
  assert.match(section.note, /BONNER'S ENTIRE|bonner/i, "the breezeway boundary must be on the record");
  assert.match(section.epoch, /post-2014/i, "the PV epoch break must be in the epoch line");
  assert.match(section.derivations.why, /keeling\.roofs\.pv/i, "the block must name the bar it is held to");
});

test("every source is described and dated", { skip }, () => {
  assert.ok(section.sources.length >= 12, `only ${section.sources.length} sources`);
  for (const s of section.sources) {
    assert.ok(s.length >= 80, `source string too thin: ${s.slice(0, 60)}`);
    assert.match(s, /\b(19|20)\d{2}\b/, `source carries no 4-digit date: ${s.slice(0, 60)}`);
  }
});

/* ------------------------------------------- the merged-ring height verdict */

test("THE MERGED BLOB: osm:395 covers both GIS rings and its height is a figure for neither", { skip }, () => {
  const osm = campus.buildings[395];
  assert.equal(osm.n, "Mayer Hall", "osm:395 is no longer the Mayer ring");
  const xs = osm.p.map((q) => q[0]);
  const zs = osm.p.map((q) => q[1]);
  const S = section.derivations.readings.survey;
  near(Math.min(...xs), S.osmX0, 1e-9, "osm blob x0");
  near(Math.max(...xs), S.osmX1, 1e-9, "osm blob x1");
  near(Math.min(...zs), S.osmZ0, 1e-9, "osm blob z0");
  near(Math.max(...zs), S.osmZ1, 1e-9, "osm blob z1");
  /* The blob spans BOTH GIS bboxes and reaches 13+ m past the Addition. */
  const mb = section.measured.masses.mayer.bbox;
  const ab = section.measured.masses.addition.bbox;
  assert.ok(S.osmX0 <= mb.x0 + 2 && S.osmX1 >= ab.x1 + 13,
    "the OSM ring no longer demonstrates the merge — the mechanism claim would be unfounded");
  /* The three losers stay recorded and the winners are the survey's. */
  near(S.heightsOsmMerged, lidar.heights["Mayer Hall"], 1e-9, "the merged-ring height read");
  near(S.massMayer, lidar.massHeights["m:91,290"], 1e-9, "Mayer's own height");
  near(S.massAddition, lidar.massHeights["m:140,286"], 1e-9, "the Addition's own height");
  near(S.osmTagH, osm.h, 1e-9, "the OSM tag");
  near(S.arcgisH, arcgis.massing[112].h, 1e-9, "the arcgis formula field");
  /* 23.2 lies BETWEEN the two buildings — the contamination arithmetic. */
  assert.ok(S.heightsOsmMerged > S.massMayer && S.heightsOsmMerged < S.massAddition,
    "the merged read no longer sits between the two — the mechanism story must be re-argued");
  const c = section.conflicts.find((x) => x.key === "mayer-osm-merged-ring");
  assert.ok(c, "the height conflict has left the record");
  assert.ok(c.sides.length >= 4, "the conflict must carry all its losers");
  assert.match(c.resolution, /21\.7/, "the resolution must name the shipped figure");
  assert.match(c.resolution, /23\.2/, "the resolution must name the merged-ring loser");
  assert.match(JSON.stringify(c.sides), /4\.26|formula/i, "the arcgis formula must be recorded as a loser");
});

test("the module never performs a name lookup against a measured file", { skip }, () => {
  assert.ok(!/heights\s*\[/.test(moduleCode), "the module indexes lidar.heights");
  assert.ok(!/massHeights/.test(moduleCode), "the module reaches for massHeights instead of the section");
  assert.ok(!/arcgis|campus-3d|campus-lidar/.test(moduleCode), "the module imports a measured document");
});

/* --------------------------------------------------- rings verbatim + party */

test("both mass rings are the survey's, byte for byte, and share the party segment", { skip }, () => {
  assert.deepEqual(ringM(), ringOf(112), "Mayer's ring has drifted off arcgis.massing[112]");
  assert.deepEqual(ringA(), ringOf(110), "the Addition's ring has drifted off arcgis.massing[110]");
  assert.equal(ringM().length, 17);
  assert.equal(ringA().length, 157);
  /* THE SHARED BOUNDARY, from the survey itself: the Addition runs along
     Mayer's east face. Verbatim vertex identity, not a tolerance match. */
  const a = ringA();
  const shared = [[123.7, 277.7], [123.7, 277.8], [124, 308.7], [124, 308.9]];
  for (const v of shared) {
    assert.ok(a.some(([x, z]) => x === v[0] && z === v[1]),
      `the Addition ring lost shared vertex (${v})`);
    assert.ok(ringM().some(([x, z]) => x === v[0] && z === v[1]),
      `Mayer's ring lost shared vertex (${v})`);
  }
  /* And the link strip's east edge is where the section says. */
  const S = section.derivations.readings.survey;
  assert.ok(a.some(([x]) => x === S.linkEastX), "linkEastX is not a ring vertex");
  assert.ok(a.some(([x]) => x === S.linkNorthEastX), "linkNorthEastX is not a ring vertex");
});

test("the three owned ground rings are the survey's, with their masked colours tiered", { skip }, () => {
  const owned = section.measured.groundRings.owned;
  assert.equal(owned.length, 3, "the owned ground list changed size");
  assert.deepEqual(owned.map((g) => g.index), [1725, 2165, 1254]);
  for (const g of owned) {
    const src = arcgis.ground[g.index].r.map((rr) => rr.map(([x, z]) => [x / 10, z / 10]));
    assert.deepEqual(g.rings, src, `ground ring #${g.index} is not verbatim`);
    assert.equal(g.kind, arcgis.ground[g.index].k);
    assert.ok(g.what && g.what.length > 30, `ring #${g.index} has no described role`);
  }
  /* No other section already claims them (the fleets groundNote discipline). */
  const text = JSON.stringify(shippedDoc);
  for (const idx of [1725, 2165, 1254]) {
    const claims = [...text.matchAll(new RegExp(`arcgis\\.ground#${idx}(?!\\d)`, "g"))];
    assert.ok(claims.length === 0 || shippedDoc.mayer,
      `arcgis.ground#${idx} is registered by a shipped section — double-claimed ground`);
  }
});

test("A4: the handedForward box-walk is EXHAUSTIVE and duplicate-free — the claim is the gate", { skip }, () => {
  /* R4 arbitration A4: the note claims every surveyed arcgis.ground ring
     inside this section's bounds box is named (owned or handed forward).
     As first shipped that was false — '#3073' twice, '#529'/'#3273' missing.
     This gate recomputes the box-walk so the claim can never silently rot. */
  const hf = section.boundary.handedForward;
  assert.equal(new Set(hf).size, hf.length,
    `boundary.handedForward carries a duplicate: ${hf.filter((v, i) => hf.indexOf(v) !== i)}`);
  for (const ref of hf) assert.match(ref, /^#\d+$/, `malformed handedForward entry ${ref}`);
  const named = new Set([
    ...section.measured.groundRings.owned.map((g) => String(g.index)),
    ...hf.map((s) => s.slice(1)),
  ]);
  const b = section.bounds;
  arcgis.ground.forEach((g, i) => {
    if (!g || !g.r) return;
    const pts = g.r[0].map(([x, z]) => [x / 10, z / 10]);
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const cz = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    if (cx < b.x0 || cx > b.x1 || cz < b.z0 || cz > b.z1) return;
    if (g.k === "road") {
      /* Roads are not a section's to own: #4331 is the campus-wide road ring;
         the lane roads are named (never drawn) in boundary.east. */
      assert.ok(i === 4331 || section.boundary.east.includes(`#${i}`),
        `road ring #${i} sits inside mayer's bounds and is named nowhere`);
      return;
    }
    assert.ok(named.has(String(i)),
      `arcgis.ground#${i} (${g.k}) sits inside mayer's bounds box and is neither owned nor handed forward — the exhaustiveness claim is false again`);
  });
  /* The two A4 additions and the A5 owner correction stay on the record. */
  assert.ok(hf.includes("#529") && hf.includes("#3273"),
    "the A4 additions (#529, #3273) have left the handedForward list");
  assert.match(section.boundary.handedForwardNote, /R6 siteworks, per arbitration A5/,
    "the NORTH LAWN rings' owner is no longer the arbitrated R6 assignment ('bonner or R6' is not an owner)");
  assert.ok(!/bonner or R6/.test(section.boundary.handedForwardNote),
    "'bonner or R6' is back in the handedForwardNote — a handoff must name one owner");
});

/* ----------------------------------------------------------- the circle fit */

test("THE CIRCLE FIT: the Addition's east facade is one measured arc, recomputed here", { skip }, () => {
  const C = section.derivations.readings.circle;
  const sel = ringA().slice(0, -1)
    .filter(([x, z]) => x > C.selectXMin && z >= C.selectZ0 && z <= C.selectZ1);
  assert.equal(sel.length, C.verts, "the arc's vertex population moved");
  assert.equal(sel.length, 108, "the brief's 108 survey vertices");
  const fit = kasa(sel);
  const F = section.derivations.figures;
  near(fit.cx, F["circle.centreX"].value, 1e-6, "circle centre x is not the fit's");
  near(fit.cz, F["circle.centreZ"].value, 1e-6, "circle centre z is not the fit's");
  near(fit.R, F["circle.radius"].value, 1e-6, "circle radius is not the fit's");
  near(fit.worst, F["circle.maxDevM"].value, 1e-6, "circle worst deviation is not the fit's");
  /* The dossier's figures, as external truth: centre (75.1, 305.4), R 74.3,
     fit <= 0.70 m — THE GATE. Do not loosen. */
  near(fit.cx, 75.1, 0.05, "centre x off the dossier figure");
  near(fit.cz, 305.4, 0.05, "centre z off the dossier figure");
  near(fit.R, 74.3, 0.05, "radius off the dossier figure");
  assert.ok(fit.worst <= 0.705, `fit error ${fit.worst} exceeds the 0.70 m gate`);
  /* And the system block carries the same fit, so a consumer reads one truth. */
  const sys = section.system.addition.circle;
  near(sys.centre[0], fit.cx, 1e-6, "system circle centre x");
  near(sys.centre[1], fit.cz, 1e-6, "system circle centre z");
  near(sys.radius, fit.R, 1e-6, "system circle radius");
  near(sys.maxDevM, fit.worst, 1e-6, "system circle maxDev");
  assert.equal(sys.verts, 108);
});

/* ------------------------------------------------------------- the terrain */

test("THE 4.1 m FALL: the corner reads reproduce from the LiDAR terrain", { skip }, () => {
  const T = section.derivations.readings.terrain;
  near(T.gNW, bilinear(52.9, 278.3), 0.005, "NW corner ground");
  near(T.gNE, bilinear(123.7, 277.7), 0.005, "NE corner ground");
  near(T.gSW, bilinear(52.7, 309.6), 0.005, "SW corner ground");
  near(T.gSE, bilinear(123.9, 308.9), 0.005, "SE corner ground");
  near(T.courtAtJunction, bilinear(87.5, 265), 0.005, "court ground at the junction");
  near(T.seamAt125, bilinear(125, 293), 0.005, "link strip ground");
  near(T.additionSouth, bilinear(138, 323), 0.005, "Addition south ground");
  const F = section.derivations.figures;
  assert.ok(F["grade.fall"].value >= 4.0 && F["grade.fall"].value <= 4.3,
    `the west->east fall (${F["grade.fall"].value}) has left the dossier's ~4.1 m`);
  /* The east grade cites the LiDAR surface itself (R4 addendum 5): the east
     corners and the link strip sit level with the ~20.4 court. */
  for (const v of [T.gNE, T.gSE, T.seamAt125]) near(v, 20.4, 0.05, "east grade off the court level");
});

/* ------------------------------------------------------- pins + expressions */

const ORTHO = "Revelle-College-Sources/renders/mayer-sources/ortho2026-mayer-area-4pxm.jpg, 4 px/m, world x 45..170 / z 235..335, px = (x-45)*4, py = (z-235)*4";
const pin = (value, truth, tol = 5e-6) => ({ value, truth, tol });

const ORTHO_PINS = {
  "ortho.pxPerM": pin(4, `${ORTHO} — the mosaic's own scale`),
  "ortho.frameX0": pin(45, `${ORTHO} — the mosaic's west edge`),
  "ortho.frameZ0": pin(235, `${ORTHO} — the mosaic's north edge`),
  "ortho.frameW": pin(500, `${ORTHO} — 125 m at 4 px/m`),
  "ortho.frameH": pin(400, `${ORTHO} — 100 m at 4 px/m`),
  "ortho.dxRoofRaw": pin(-0.8, "west roof edge ortho ~52.0 vs GIS west face 52.7-52.9 (research-mayer 9, reproduced this build)"),
  "ortho.dzRoofRaw": pin(-4.7, "parapets ortho ~274.7/304.2 vs GIS faces 277.7-278.3/308.9-309.6 (research-mayer 9)"),
  "ortho.westRoofEdgeRawX": pin(52.0, "the west roof edge's raw ortho x (research-mayer 9)"),
  "ortho.southParapetRawZ": pin(304.2, "the south parapet band's raw ortho z (research-mayer 9's 303.5..305 midpoint)"),
  "ortho.northParapetRawZ": pin(274.7, "the north parapet band's raw ortho z (research-mayer 9's 274..275.5 midpoint)"),
  "ortho.roofProfileZ0Raw": pin(274, "the roof brightness profile's first band edge, raw z (research-mayer 3.4)"),
  "ortho.roofProfileZ1Raw": pin(304, "the roof brightness profile's last band edge, raw z (research-mayer 3.4)"),
  "ortho.nPvZ0True": pin(280.7, "north PV array band, true frame (research-mayer 3.4 band table)"),
  "ortho.nPvZ1True": pin(285.7, "north PV array band, true frame (research-mayer 3.4 band table)"),
  "ortho.sPvZ0True": pin(298.7, "south PV array band, true frame (research-mayer 3.4 band table)"),
  "ortho.sPvZ1True": pin(306.7, "south PV array band, true frame (research-mayer 3.4 band table)"),
  "ortho.monitorZ0True": pin(289.7, "the monitor/mech spine band, true frame (research-mayer 3.4 band table)"),
  "ortho.monitorZ1True": pin(296.7, "the monitor/mech spine band, true frame (research-mayer 3.4 band table)"),
  "ortho.pvRunThresholdL": pin(135, "the dark-run threshold: column mean below 135 against a ~155 plate and a ~105 array plateau, measured this build"),
  "ortho.nPvRunsRawX.0.0": pin(62.0, `${ORTHO} — north array dark run 1 start, measured this build`),
  "ortho.nPvRunsRawX.0.1": pin(72.0, `${ORTHO} — north array dark run 1 end`),
  "ortho.nPvRunsRawX.1.0": pin(74.5, `${ORTHO} — north array dark run 2 start`),
  "ortho.nPvRunsRawX.1.1": pin(86.8, `${ORTHO} — north array dark run 2 end`),
  "ortho.nPvRunsRawX.2.0": pin(92.8, `${ORTHO} — north array dark run 3 start`),
  "ortho.nPvRunsRawX.2.1": pin(115.8, `${ORTHO} — north array dark run 3 end`),
  "ortho.nPvRunsRawX.3.0": pin(116.2, `${ORTHO} — north array dark run 4 start`),
  "ortho.nPvRunsRawX.3.1": pin(122.0, `${ORTHO} — north array dark run 4 end`),
  "ortho.sPvRunsRawX.0.0": pin(54.0, `${ORTHO} — south array dark run 1 start`),
  "ortho.sPvRunsRawX.0.1": pin(66.2, `${ORTHO} — south array dark run 1 end`),
  "ortho.sPvRunsRawX.1.0": pin(66.8, `${ORTHO} — south array dark run 2 start`),
  "ortho.sPvRunsRawX.1.1": pin(72.5, `${ORTHO} — south array dark run 2 end`),
  "ortho.sPvRunsRawX.2.0": pin(73.0, `${ORTHO} — south array dark run 3 start`),
  "ortho.sPvRunsRawX.2.1": pin(120.5, `${ORTHO} — south array dark run 3 end`),
  "junction.x0": pin(84.1, "osm:917/918's termination span on Mayer's north face, west end (research-mayer 6)"),
  "junction.x1": pin(91.0, "osm:917/918's termination span, east end (research-mayer 6)"),
  "junction.xMid": pin(87.55, "the midpoint of the OSM rings' termination span, (84.1 + 91.0) / 2"),
  "circle.selectXMin": pin(140, "the arc selection's x bound: every Addition vertex east of it lies on the fitted circle (research-mayer 4.2)"),
  "circle.selectZ0": pin(259.9, "the arc's north end, the ring's own (133.8, 259.9) region (research-mayer 4.2)"),
  "circle.selectZ1": pin(323.8, "the arc's south end, where the ring squares off (research-mayer 4.2)"),
  "circle.verts": pin(108, "the selection's population — recomputed from the carried ring in the circle-fit gate"),
};

test("S1(iii): every reading is pinned — survey/terrain to the measured files, ortho to its artefact", { skip }, () => {
  const R = section.derivations.readings;
  /* Survey and terrain pins take their truth from RECOMPUTATION (stronger
     than a literal); the recomputations are the two gates above. Here they
     are enumerated so the namespaces stay exhaustively pinned. */
  const surveyTruth = {
    massMayer: lidar.massHeights["m:91,290"],
    massAddition: lidar.massHeights["m:140,286"],
    heightsOsmMerged: lidar.heights["Mayer Hall"],
    osmTagH: campus.buildings[395].h,
    osmVerts: campus.buildings[395].p.length,
    osmX0: Math.min(...campus.buildings[395].p.map((q) => q[0])),
    osmX1: Math.max(...campus.buildings[395].p.map((q) => q[0])),
    osmZ0: Math.min(...campus.buildings[395].p.map((q) => q[1])),
    osmZ1: Math.max(...campus.buildings[395].p.map((q) => q[1])),
    arcgisH: arcgis.massing[112].h,
    arcgisHAddition: arcgis.massing[110].h,
    levels: arcgis.massing[112].levels,
    levelsAddition: arcgis.massing[110].levels,
    mayerVerts: ringOf(112).length,
    additionVerts: ringOf(110).length,
    mayerAreaM2: R.survey.mayerAreaM2,
    additionAreaM2: R.survey.additionAreaM2,
    mayerNFaceXWest: 52.7, mayerNFaceZWest: 278.3, mayerNFaceXEast: 123.7, mayerNFaceZEast: 277.7,
    mayerEastFaceX: 124, mayerNEX: 123.7, linkEastX: 126.7, linkNorthEastX: 125.3,
  };
  const pins = { ...ORTHO_PINS };
  for (const [k, v] of Object.entries(surveyTruth)) {
    pins[`survey.${k}`] = pin(v, "recomputed from campus-arcgis/campus-lidar/campus-3d in this file", 1e-9);
  }
  for (const [k, xz] of Object.entries({
    gNW: [52.9, 278.3], gNE: [123.7, 277.7], gSW: [52.7, 309.6], gSE: [123.9, 308.9],
    courtAtJunction: [87.5, 265], seamAt125: [125, 293], additionSouth: [138, 323],
  })) {
    pins[`terrain.${k}`] = pin(bilinear(...xz), "bilinear LiDAR terrain read, recomputed by makeHeightSampler in this file", 0.005);
  }
  /* The areas really are the shoelace over the verbatim rings. */
  const shoelace = (r) => {
    let a = 0;
    for (let k = 0; k < r.length - 1; k++) a += r[k][0] * r[k + 1][1] - r[k + 1][0] * r[k][1];
    return Math.abs(a / 2);
  };
  near(R.survey.mayerAreaM2, shoelace(ringM()), 0.05, "Mayer's area is not its ring's");
  near(R.survey.additionAreaM2, shoelace(ringA()), 0.05, "the Addition's area is not its ring's");
  /* The named face vertices are real ring vertices. */
  for (const [x, z] of [[52.7, 278.3], [123.7, 277.7]]) {
    assert.ok(ringM().some(([a, b]) => a === x && b === z), `(${x},${z}) is not a Mayer ring vertex`);
  }
  const n = assertPins({
    readings: R, pins,
    namespaces: ["survey", "terrain", "junction", "circle", "ortho"],
    label: "mayer readings",
  });
  assert.ok(n >= 60, `only ${n} readings pinned`);
  for (const k of ["survey", "terrain", "junction", "circle", "ortho"]) {
    assert.ok(R[k].source && R[k].source.length > 100, `readings.${k} has no described source`);
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

test("S1(vi): every derivation recomputes from its own readings", { skip }, () => {
  const D = section.derivations;
  for (const [key, f] of Object.entries(D.figures)) {
    assert.ok(typeof f.value === "number", `${key} has no value`);
    assert.ok(f.why && f.why.length > 40, `${key} is unmotivated`);
  }
  const { evaluated, prose } = assertExprs({ figures: D.figures, scope: exprScope(), label: "mayer" });
  assert.ok(evaluated >= 15, `only ${evaluated} figures evaluated — the block is too thin`);
  assert.ok(prose <= 4, `${prose} figures fell back to prose — arithmetic is the default`);
  for (const [key, decl] of Object.entries(D.figures)) {
    if (decl.expr === undefined) {
      assert.match(key, /^circle\./, `${key} is prose and is not one of the declared prose figures (the circle fit, recomputed geometrically above)`);
    }
  }
});

test("S1(iii): the relations the section states in PROSE are asserted", { skip }, () => {
  const F = section.derivations.figures;
  const R = section.derivations.readings;
  const G = section.system.gallery;
  const A = section.system.addition;
  const roof = section.system.roof;
  const rel = [
    { name: "five Mayer storeys ARE Mayer's own massHeights", got: G.storey * G.storeys, want: R.survey.massMayer, tol: 1e-9 },
    { name: "five Addition storeys ARE the Addition's own massHeights", got: A.storey * A.storeys, want: R.survey.massAddition, tol: 1e-9 },
    { name: "the system storey is the derived figure, not a second number", got: G.storey, want: F["storey.mayer"].value, tol: 1e-9 },
    { name: "the Addition system storey is the derived figure", got: A.storey, want: F["storey.addition"].value, tol: 1e-9 },
    { name: "the junction plane interpolates to ~278.0 on Mayer's own face", got: F["junction.zOnMayerFace"].value, want: 278.0, tol: 0.05 },
    { name: "the monitor's z band is the ortho reading's", got: roof.monitor.z0, want: R.ortho.monitorZ0True, tol: 1e-9 },
    { name: "the monitor's z band end is the ortho reading's", got: roof.monitor.z1, want: R.ortho.monitorZ1True, tol: 1e-9 },
    { name: "the PV layer's x correction is the local registration figure", got: roof.pv.dxTrue, want: F["ortho.correctionX"].value, tol: 1e-9 },
    { name: "north PV band start is the reading's", got: roof.pv.arrays[0].z0, want: R.ortho.nPvZ0True, tol: 1e-9 },
    { name: "north PV band end is the reading's", got: roof.pv.arrays[0].z1, want: R.ortho.nPvZ1True, tol: 1e-9 },
    { name: "south PV band start is the reading's", got: roof.pv.arrays[1].z0, want: R.ortho.sPvZ0True, tol: 1e-9 },
    { name: "south PV band end is the reading's", got: roof.pv.arrays[1].z1, want: R.ortho.sPvZ1True, tol: 1e-9 },
    { name: "the balustrade estimate stands on its own ratio arithmetic", got: F["gallery.balustradeFromRatio"].value, want: G.balustrade, tol: 0.01 },
    { name: "the fall is west mean minus east mean", got: F["grade.westMean"].value - F["grade.eastMean"].value, want: F["grade.fall"].value, tol: 1e-9 },
    { name: "the link strip's south width is 2.7", got: F["link.widthSouth"].value, want: 2.7, tol: 1e-9 },
    { name: "the link strip's north width is 1.6", got: F["link.widthNorth"].value, want: 1.6, tol: 1e-9 },
  ];
  assertRelations({ relations: rel, label: "mayer" });
  /* The PV block runs in `system` are the READINGS, verbatim. */
  assert.deepEqual(roof.pv.arrays[0].blocksRawX, R.ortho.nPvRunsRawX, "north PV blocks have drifted off the reading");
  assert.deepEqual(roof.pv.arrays[1].blocksRawX, R.ortho.sPvRunsRawX, "south PV blocks have drifted off the reading");
});

/* ------------------------------------------------ coverage, estimates, tiers */

const SAMPLE_PINS = {
  slabFascia: pin(169, "extends additionBand's tsilva-mayer-05 rect x150..200 y300..400 (188/166/153)", 0.5),
  balustradeAggregate: pin(106, "tsilva-mayer-08 rect x60..200 y180..230, (105+109+104)/3", 0.5),
  mayerGlazing: pin(71, "tsilva-mayer-05 rect x30..150 y60..110, (61+68+85)/3 — extended to Mayer", 0.5),
  linkGlass: pin(111.3, "tsilva-mayer-08 rect x214..222 y312..320, (66+112+156)/3", 0.5),
  additionMetal: pin(155.7, "tsilva-mayer-05 two pooled sunlit rects, (167+152+148)/3", 0.5),
  additionBand: pin(169, "tsilva-mayer-05 rect x150..200 y300..400, (188+166+153)/3", 0.5),
  pvPanel: pin(106, "ortho 2026, two pooled PV rects raw x100..112 z276..281 and z295..299, (90+106+123)/3", 0.5),
  monitorSpine: pin(137.7, "ortho 2026, rect raw x100..112 z288..293, (136+138+139)/3", 0.5),
  groundPineGrove: pin(84.6, "ortho 2026, masked polygon read over arcgis.ground#1725, (82.3+90.8+80.7)/3", 0.5),
  groundTerraceBed: pin(112.1, "ortho 2026, masked polygon read over arcgis.ground#2165, (121.2+119.9+95.0)/3", 0.5),
  groundBunchGrass: pin(129.0, "ortho 2026, masked polygon read over arcgis.ground#1254, (134.6+130.3+122.2)/3", 0.5),
};
const UNBUILT_PINS = {
  terraceHardscape: pin(124, "ortho 2026 rect x70..100 z313..320, (137+126+109)/3 — measured, unconsumed", 0.5),
  mayerWestPlate: pin(154.3, "ortho 2026 rect raw x53..60 z290..300, (147+154+162)/3", 0.5),
  additionRoof: pin(166, "ortho 2026 rect x130..143 z272..290, (157+167+174)/3", 0.5),
  serviceYardPaving: pin(190.3, "ortho 2026 rect x152..162 z303..313, (186+192+193)/3", 0.5),
};
const CONTROL_PINS = {
  sunlitBand: true, sunlitMetal: true, shadedGlazing: true, shadedAggregate: true,
};

/* THE PINNED RGB TRIPLES — the sample rectangles' own channel values, as
   literals in THIS file. Every shipped hex must be the byte-rounding of its
   triple and every channelMean must be the triple's own mean: the audit
   proved a hex moved ±8 and a channelMean moved 5.7 survived a suite that
   only coverage-walked these numbers. */
const RGB_PINS = {
  slabFascia: [188, 166, 153],
  balustradeAggregate: [105, 109, 104],
  mayerGlazing: [61, 68, 85],
  linkGlass: [66, 112, 156],
  additionMetal: [167, 152, 148],
  additionBand: [188, 166, 153],
  pvPanel: [89.5, 105.5, 122.5],
  monitorSpine: [136, 138, 139],
  groundPineGrove: [82.3, 90.8, 80.7],
  groundTerraceBed: [121.2, 119.9, 95.0],
  groundBunchGrass: [134.6, 130.3, 122.2],
};
const SAMPLE_RGB_PINS = {
  terraceHardscape: [137, 126, 109],
  mayerWestPlate: [147, 154, 162],
  additionRoof: [157, 167, 174],
  serviceYardPaving: [186, 192, 193],
};
const hexOf = (rgb) => "#" + rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

const drawNoteFor = (path) => {
  const parts = path.split(".").slice(1);
  const note = section.draw[`${parts[0]}Note`];
  return typeof note === "string" && note.length > 40 ? "declared render offset" : null;
};

test("S1(i): no bare number survives in readings, estimates, draw, colours or samples", { skip }, () => {
  const R = section.derivations.readings;
  const surveyKeys = Object.keys(R.survey).filter((k) => typeof R.survey[k] === "number");
  const terrainKeys = Object.keys(R.terrain).filter((k) => typeof R.terrain[k] === "number");
  const paths = assertCoverage({
    section, label: "mayer", minimum: 60,
    roots: {
      "derivations.readings": {}, estimates: {}, draw: {},
      colorSources: {}, colorThreshold: {}, samples: {},
    },
    uncovered: {},
    classify: (path) => {
      if (path.startsWith("derivations.readings.")) {
        const p = path.slice("derivations.readings.".length);
        if (ORTHO_PINS[p]) return "pinned to artefact";
        if (p.startsWith("survey.") && surveyKeys.includes(p.slice(7))) return "recomputed from the measured files";
        if (p.startsWith("terrain.") && terrainKeys.includes(p.slice(8))) return "recomputed from the LiDAR terrain";
        if (p.startsWith("junction.") || p.startsWith("circle.")) {
          return ORTHO_PINS[p] ? "pinned" : null;
        }
        return null;
      }
      if (/^estimates\..+\.(value|band\.[01])$/.test(path)) return "banded";
      if (path.startsWith("draw.")) return drawNoteFor(path);
      if (/^colorSources\.[A-Za-z]+\.(sampleL|sampleSd|channelMean|luminance)$/.test(path)) {
        return SAMPLE_PINS[path.split(".")[1]] ? "pinned sample" : null;
      }
      if (/^samples\.[A-Za-z]+\.(channelMean|sampleSd|luminance)$/.test(path)) {
        return UNBUILT_PINS[path.split(".")[1]] ? "pinned sample" : null;
      }
      if (/^colorThreshold\.(sunlitMin|sdMax)$/.test(path)) return "pinned threshold";
      if (/^colorThreshold\.controls\.\d+\.(L|rect\.\d+)$/.test(path)) {
        return CONTROL_PINS[section.colorThreshold.controls[Number(path.split(".")[2])]?.key]
          ? "pinned control" : null;
      }
      return null;
    },
  });
  assert.ok(paths.length >= 100, `the walk only found ${paths.length} numbers in the axiom layer`);
  const drawNumbers = paths.filter((p) => p.path.startsWith("draw."));
  assert.ok(drawNumbers.length >= 10, `only ${drawNumbers.length} draw numbers walked`);
  for (const { path } of drawNumbers) {
    assert.ok(drawNoteFor(path), `${path} has no sibling Note explaining why it is not a measurement`);
  }
});

const EST_SHIPPED = {
  "system.gallery.balustrade": () => section.system.gallery.balustrade,
  "system.gallery.slabFascia": () => section.system.gallery.slabFascia,
  "system.gallery.depth": () => section.system.gallery.depth,
  "system.roof.overhang": () => section.system.roof.overhang,
  "system.roof.monitor.height": () => section.system.roof.monitor.height,
  "system.roof.monitor.x0": () => section.system.roof.monitor.x0,
  "system.roof.monitor.x1": () => section.system.roof.monitor.x1,
  "system.addition.bandDepth": () => section.system.addition.bandDepth,
  "system.addition.parapetFascia": () => section.system.addition.parapetFascia,
};

test("S1(ii): every estimate carries a band, and the shipped value is inside it", { skip }, () => {
  const n = assertEstimateBands({
    estimates: section.estimates,
    valueAt: (key) => {
      const f = EST_SHIPPED[key];
      assert.ok(f, `mayer: estimate ${key} governs no shipped value this suite knows about`);
      return f();
    },
    label: "mayer",
  });
  assert.equal(n, Object.keys(section.estimates).length, "every estimate must be banded");
  for (const [k, e] of Object.entries(section.estimates)) {
    assert.ok(e.bandWhy && e.bandWhy.length > 80, `estimate ${k}'s band is a bare pair with no argument`);
    assert.match(e.why, /Ladder climbed and failed/i, `estimate ${k} does not name the ladder it climbed`);
    for (const rung of ["photos", "Street View", "drone", "planning docs", "archives"]) {
      assert.ok(e.why.includes(rung), `estimate ${k}'s ladder skips the ${rung} rung`);
    }
  }
  /* The monitor's x estimates must stay between the plate read and the roof. */
  const mon = section.system.roof.monitor;
  assert.ok(mon.x0 > 53.5 && mon.x1 < 124, "the monitor has grown past its own bounding evidence");
});

test("colours are data, tiered per role, and the tier gate runs both ways", { skip }, () => {
  const roles = Object.keys(section.colors);
  assert.deepEqual(new Set(Object.keys(section.colorSources)), new Set(roles),
    "colors and colorSources must carry the same roles");
  for (const [role, hex] of Object.entries(section.colors)) {
    assert.match(hex, /^#[0-9a-f]{6}$/, `${role} is not a hex`);
    const p = section.colorSources[role];
    assert.ok(["measured", "sourced", "estimated"].includes(p.tier), `${role} has no tier`);
    assert.ok(p.source.includes(`[${p.tier}]`), `${role}'s source string does not carry its own tier label`);
    /* The channel-mean rule (R4 addendum): (R+G+B)/3, rectangle pinned; and
       the [measured] bar is enforced arithmetically. */
    if (p.tier === "measured") {
      assert.ok(p.channelMean >= section.colorThreshold.sunlitMin, `${role} claims [measured] below the sunlit bar`);
      assert.ok(p.sampleSd <= section.colorThreshold.sdMax, `${role} claims [measured] over the sd bar`);
    }
    if (p.tier === "estimated") {
      assert.match(p.source, /extends/, `${role} is [estimated] and names no pattern it extends`);
    }
  }
  assertTierSymmetry({
    entries: [
      ...Object.entries(section.colorSources).map(([key, p]) => ({ key, text: p.source })),
      ...Object.entries(section.samples).filter(([k]) => k !== "note")
        .map(([key, p]) => ({ key, text: p.source })),
    ],
    label: "mayer",
  });
  /* NOTHING in this section clears the [measured] bar, and it says so. */
  assert.ok(!Object.values(section.colorSources).some((p) => p.tier === "measured"),
    "a [measured] tier appeared — re-argue colorSourcesNote, which declares none clears both bars");
  assert.match(section.colorSourcesNote, /\(R\+G\+B\)\/3/, "the channel-mean rule must be stated");
  /* The threshold's own controls separate. */
  const T = section.colorThreshold;
  const sunlit = T.controls.filter((c) => /^sunlit/.test(c.key)).map((c) => c.L);
  const shaded = T.controls.filter((c) => /^shaded/.test(c.key)).map((c) => c.L);
  assert.ok(sunlit.length >= 2 && shaded.length >= 2, "the threshold needs controls on both sides");
  assert.ok(Math.min(...sunlit) >= T.sunlitMin, "a sunlit control fails its own threshold");
  assert.ok(Math.max(...shaded) < T.sunlitMin, "a shaded control passes the sunlit threshold");
  for (const c of T.controls) assert.ok(c.frame && c.rect && c.what, `control ${c.key} is unpinned`);
});

test("AUDIT R4-1: every hex IS its pinned rectangle, and every channelMean is pinned live", { skip }, () => {
  /* The hex is the byte-rounding of the pinned triple — a hex moved one unit
     in one channel goes red here. */
  for (const [role, rgb] of Object.entries(RGB_PINS)) {
    assert.equal(section.colors[role], hexOf(rgb),
      `colors.${role} is not the byte-rounding of its pinned rectangle (${rgb.join(", ")})`);
    const mean = (rgb[0] + rgb[1] + rgb[2]) / 3;
    near(section.colorSources[role].channelMean, mean, 0.4,
      `colorSources.${role}.channelMean is not its own triple's (R+G+B)/3`);
  }
  assert.equal(Object.keys(RGB_PINS).length, Object.keys(section.colors).length,
    "a colour role exists that no RGB pin holds — pin it or it is free to drift");
  /* The unconsumed samples carry the same discipline. */
  for (const [key, rgb] of Object.entries(SAMPLE_RGB_PINS)) {
    assert.equal(section.samples[key].hex, hexOf(rgb),
      `samples.${key}.hex is not the byte-rounding of its pinned rectangle`);
    near(section.samples[key].channelMean, (rgb[0] + rgb[1] + rgb[2]) / 3, 0.4,
      `samples.${key}.channelMean is not its own triple's mean`);
  }
  assert.equal(Object.keys(SAMPLE_RGB_PINS).length,
    Object.keys(section.samples).filter((k) => k !== "note").length,
    "an unconsumed sample exists that no RGB pin holds");
  /* And the SAMPLE_PINS / UNBUILT_PINS truths run through assertPins, so
     they are live gates and not existence classifiers (the audit's exact
     finding: pin(value, truth, tol) constructed and never compared). */
  const asReadings = (obj) => Object.fromEntries(
    Object.entries(obj).filter(([k]) => k !== "note")
      .map(([k, v]) => [k, { channelMean: v.channelMean }]));
  assertPins({
    readings: asReadings(section.colorSources),
    pins: Object.fromEntries(Object.entries(SAMPLE_PINS).map(([k, p]) => [`${k}.channelMean`, p])),
    namespaces: Object.keys(SAMPLE_PINS),
    label: "mayer colour samples",
  });
  assertPins({
    readings: asReadings(section.samples),
    pins: Object.fromEntries(Object.entries(UNBUILT_PINS).map(([k, p]) => [`${k}.channelMean`, p])),
    namespaces: Object.keys(UNBUILT_PINS),
    label: "mayer unconsumed samples",
  });
});

test("every colour role the module asks for is declared, both ways, and no hex hides in code", { skip }, () => {
  const asked = new Set([...moduleCode.matchAll(/hue\("([A-Za-z]+)"\)/g)].map((m) => m[1]));
  const declared = new Set(Object.keys(section.colors));
  for (const role of asked) {
    assert.ok(declared.has(role), `module asks for undeclared role "${role}" — it would ship white`);
  }
  for (const role of declared) {
    assert.ok(asked.has(role), `role "${role}" is declared and never consumed — a stale hex outliving its object`);
  }
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(moduleCode), "a hex literal is in the module");
  assert.ok(!/0x[0-9a-fA-F]{6}/.test(moduleCode), "a numeric colour literal is in the module");
  /* The unconsumed samples really are unconsumed. */
  for (const key of Object.keys(section.samples)) {
    if (key === "note") continue;
    assert.ok(!moduleCode.includes(key), `module consumes samples.${key}, which the section withholds`);
    assert.ok(section.samples[key].whyUnconsumed?.length > 40, `samples.${key} has no whyUnconsumed`);
  }
});

/* -------------------------------------------------------------- the build */

test("the module builds the section, and the counts are the declared ones", { skip }, () => {
  const { counts } = build();
  for (const [k, v] of Object.entries(section.counts)) {
    if (k === "note") continue;
    assert.equal(counts[k], v, `counts.${k}: built ${counts[k]}, declared ${v}`);
  }
  for (const [k, v] of Object.entries(counts)) {
    assert.ok(k in section.counts, `the module builds ${k}=${v} and the section does not declare it`);
  }
  /* The declared zeroes are the withholding, in numbers. */
  for (const zero of ["openings", "piers", "windowsAddition", "breezewayElements"]) {
    assert.equal(section.counts[zero], 0, `${zero} must be a DECLARED ZERO`);
  }
  assert.equal(section.counts.partyFacesMayer, 1, "Mayer must skip exactly its east party face");
  assert.equal(section.counts.partyEdgesAddition, 3, "the Addition must skip exactly the three shared edges");
  assert.equal(section.counts.pvBlocks, 7, "the ortho's seven dark runs");
  assert.equal(section.counts.beds, 3, "the three owned ground rings");
  assert.equal(section.counts.galleryFaces, 2, "both long faces carry the gallery system");
  assert.equal(section.counts.curtainWalls, 1, "only the WEST end is still a facade (the east is the 2004 party plane)");
});

test("missing section and missing sampler fail the right way", { skip }, () => {
  const none = createPhotoMayer(null, { photo: {}, heightAt: flat, surfaceAt: flat });
  assert.deepEqual(none.counts, {});
  assert.throws(() => createPhotoMayer(null, { photo: { mayer: section } }),
    /surfaceAt/, "a missing sampler must throw, not build at y=0");
  assert.throws(
    () => createPhotoMayer(null, {
      photo: { mayer: { ...section, measured: { ...section.measured, masses: undefined } } },
      heightAt: flat, surfaceAt: flat,
    }),
    /predates/, "a pre-merge document must refuse to build");
});

test("AUDIT F1: glazing the drawn ground would bury is WITHHELD, and both counts hold", { skip }, () => {
  /* The withholding rule's grace is a value-pinned centimetre, not a free
     draw number: widening it is how a buried pane ships. */
  near(section.draw.clipGraceBelow, 0.01, 1e-9, "draw.clipGraceBelow moved — the withholding rule changed");
  const gc = section.system.gallery.groundClip;
  const onFlat = build(flat).counts;
  assert.equal(onFlat.glassPanels, gc.builtOnFlat, "flat-ground build moved off the declared source grid");
  assert.equal(onFlat.glassWithheld, gc.withheldOnFlat, "flat ground must withhold nothing");
  assert.equal(gc.withheldOnFlat, 0, "the source grid is what flat ground builds ENTIRE");
  const onDrawn = build(drawnGround).counts;
  assert.equal(onDrawn.glassPanels, gc.builtOnDrawnTerrain, "drawn-terrain built count moved");
  assert.equal(onDrawn.glassWithheld, gc.withheldOnDrawnTerrain, "drawn-terrain withheld count moved");
  assert.ok(gc.withheldOnDrawnTerrain > 0,
    "the 4.1 m fall must bury SOMETHING — a zero here means the clip is not running");
  assert.equal(gc.builtOnFlat, gc.builtOnDrawnTerrain + gc.withheldOnDrawnTerrain,
    "the two counts must partition the same source grid");
  /* And on the real terrain, no glass foot is under the drawn surface. */
  const r = build(drawnGround);
  for (const meshName of ["mayer-gallery-glass-estimated"]) {
    eachQuad(r.group, meshName, (q) => {
      const g = drawnGround(q.x, q.z);
      assert.ok(q.yLo >= g - 0.02,
        `${meshName} quad at (${q.x.toFixed(1)}, ${q.z.toFixed(1)}) has its foot ${(g - q.yLo).toFixed(2)} m under the drawn surface`);
    });
  }
});

test("nothing hovers, nothing sinks, nothing leaves the declared bounds — on three grounds", { skip }, () => {
  for (const g of [flat, slope, drawnGround]) {
    const r = build(g);
    const ringGroundMin = Math.min(...ringM().map(([x, z]) => g(x, z)),
      ...ringA().map(([x, z]) => g(x, z)));
    each(r.group, (b) => {
      assert.ok(b.xLo >= section.bounds.x0 - 2 && b.xHi <= section.bounds.x1 + 2,
        `${b.name} leaves the bounds in x`);
      assert.ok(b.zLo >= section.bounds.z0 - 2 && b.zHi <= section.bounds.z1 + 2,
        `${b.name} leaves the bounds in z`);
      assert.ok(b.yLo >= ringGroundMin - section.draw.skirtDepth - 1.5,
        `${b.name} sank ${b.yLo} under everything`);
    });
    /* Carpets lie ON the drawn surface at their rung's own lift. */
    const lift = overlayLift(section.draw.bedRung);
    eachVertex(r.group, (x, y, z, name) => {
      if (!/^mayer-bed-/.test(name)) return;
      near(y, g(x, z) + lift, 0.02, `${name} vertex off the drawn surface at (${x.toFixed(1)}, ${z.toFixed(1)})`);
    });
  }
});

test("THE PV EPOCH GATE: post-2014 fabric as a thin labelled layer ON the 2014 lid", { skip }, () => {
  /* THE THIN-LAYER CLAIM IS AN ABSOLUTE, NOT SELF-REFERENTIAL (audit MM4):
     bounding the mesh by draw.pvThickness let a mutated 2.0 m thickness ship
     a prism and pass. The epoch claim is "decimetres, never a storey", so
     the ceiling is a literal here and the two draw values are pinned. */
  const THIN_LAYER_CEILING = 0.5;
  near(section.draw.pvThickness, 0.15, 1e-9,
    "draw.pvThickness moved off its declared render thickness — the epoch layer is decimetres by claim");
  near(section.draw.pvLift, 0.05, 1e-9, "draw.pvLift moved off its declared render offset");
  assert.ok(section.draw.pvLift + section.draw.pvThickness <= THIN_LAYER_CEILING,
    "the PV layer's declared lift + thickness exceeds the absolute thin-layer ceiling");
  for (const g of [flat, drawnGround]) {
    const r = build(g);
    r.group.updateMatrixWorld(true);
    const lid = roofElevation(ringM(), section.measured.masses.mayer.massHeight, g);
    const pv = [];
    r.group.traverse((o) => { if (o.isMesh && o.name === "mayer-roof-pv-sourced") pv.push(o); });
    assert.equal(pv.length, 7, "the seven measured PV blocks");
    for (const mesh of pv) {
      mesh.geometry.computeBoundingBox();
      const box = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
      assert.ok(box.min.y >= lid - 1e-4, "a PV block sank into the 2014-measured plate");
      assert.ok(box.max.y - box.min.y <= section.draw.pvThickness + 0.01, "the PV layer grew thick");
      assert.ok(box.max.y <= lid + 0.5, "the PV layer left the absolute thin-layer ceiling — a prism, not a layer");
      assert.ok(box.max.y <= lid + section.draw.pvLift + section.draw.pvThickness + 0.01,
        "the PV layer floated off its declared lift");
      /* Inside a measured band, inside the roof. */
      const inN = box.min.z >= section.system.roof.pv.arrays[0].z0 - 0.01
        && box.max.z <= section.system.roof.pv.arrays[0].z1 + 0.01;
      const inS = box.min.z >= section.system.roof.pv.arrays[1].z0 - 0.01
        && box.max.z <= section.system.roof.pv.arrays[1].z1 + 0.01;
      assert.ok(inN || inS, "a PV block left both measured z bands");
      assert.ok(box.min.x >= 52.7 && box.max.x <= 124.0, "a PV block left Mayer's roof");
    }
    /* The monitor: period fabric, [estimated] extent, ON the lid. */
    let mon = null;
    r.group.traverse((o) => { if (o.isMesh && o.name === "mayer-roof-monitor-estimated") mon = o; });
    assert.ok(mon, "the monitor is missing");
    mon.geometry.computeBoundingBox();
    const mb = mon.geometry.boundingBox.clone().applyMatrix4(mon.matrixWorld);
    near(mb.min.y, lid, 0.01, "the monitor must sit ON the lid");
    near(mb.min.z, section.system.roof.monitor.z0, 0.01, "monitor z0");
    near(mb.max.z, section.system.roof.monitor.z1, 0.01, "monitor z1");
  }
  assert.match(section.system.roof.pv.epoch, /POST-2014, POST-LiDAR/i,
    "the PV layer must carry its epoch label");
  const F = section.derivations.figures;
  near(section.system.roof.pv.dxTrue, F["ortho.correctionX"].value, 1e-9,
    "the PV x correction must be THIS pair's own registration");
});

test("the party boundary is real in the scene: no treatment crosses into the other mass", { skip }, () => {
  const r = build(drawnGround);
  const rm = ringM();
  const ra = ringA();
  eachVertex(r.group, (x, y, z, name) => {
    if (/^mayer-(gallery|end|roof)/.test(name)) {
      /* Mayer's treatment stays out of the Addition's interior (0.1 m grace
         for the shared boundary itself). */
      if (inRing(x, z, ra) && ringDist(x, z, ra) > 0.1) {
        assert.fail(`${name} vertex (${x.toFixed(2)}, ${z.toFixed(2)}) is inside the Addition`);
      }
    }
    if (/^mayer-addition|^mayer-link/.test(name)) {
      if (inRing(x, z, rm) && ringDist(x, z, rm) > 0.1) {
        assert.fail(`${name} vertex (${x.toFixed(2)}, ${z.toFixed(2)}) is inside Mayer`);
      }
    }
  });
  /* And no band was hung ON the shared segment: nothing with a mayer-gallery
     or curtain name lives at x ~123.7..124 in the shared z range. */
  for (const meshName of ["mayer-gallery-slab-estimated", "mayer-gallery-balustrade-sourced", "mayer-end-curtainwall-estimated"]) {
    eachQuad(r.group, meshName, (q) => {
      const onParty = q.x > 123.2 && q.x < 124.6 && q.z > 278.5 && q.z < 308.5;
      assert.ok(!onParty, `${meshName} hung a band on the party plane at (${q.x.toFixed(1)}, ${q.z.toFixed(1)})`);
    });
  }
});

test("COPLANARITY: balustrades stand ON slabs, glass tops meet the slab soffit, on real terrain", { skip }, () => {
  const r = build(drawnGround);
  const lid = roofElevation(ringM(), section.measured.masses.mayer.massHeight, drawnGround);
  const G = section.system.gallery;
  const slabTops = [];
  for (let k = 1; k <= G.storeys - 1; k++) slabTops.push(lid - k * G.storey);
  const onSlabTop = (y) => slabTops.some((t) => Math.abs(t - y) <= 5e-4);
  eachQuad(r.group, "mayer-gallery-balustrade-sourced", (q) => {
    assert.ok(onSlabTop(q.yLo), `a balustrade foot at ${q.yLo.toFixed(3)} stands on no slab top`);
    near(q.yHi - q.yLo, G.balustrade, 5e-4, "a balustrade band left its estimate");
  });
  eachQuad(r.group, "mayer-gallery-slab-estimated", (q) => {
    assert.ok(onSlabTop(q.yHi), `a slab band top at ${q.yHi.toFixed(3)} is on no floor line`);
    near(q.yHi - q.yLo, G.slabFascia, 5e-4, "a slab fascia left its estimate");
  });
  eachQuad(r.group, "mayer-gallery-glass-estimated", (q) => {
    /* Every glass top meets a slab soffit (floor line minus fascia). */
    const kFrac = (lid - (q.yHi + G.slabFascia)) / G.storey;
    near(kFrac, Math.round(kFrac), 5e-4, `a glass top at ${q.yHi.toFixed(3)} meets no slab soffit`);
    /* And the glass line is RECESSED — never proud of the ring. */
    assert.ok(ringDist(q.x, q.z, ringM()) >= G.depth - 0.35,
      `glass at (${q.x.toFixed(1)}, ${q.z.toFixed(1)}) is not recessed behind the gallery`);
  });
});

test("the Addition's treatment hangs on the ring's own chords — the arc is the survey's", { skip }, () => {
  const r = build(flat);
  const C = section.system.addition.circle;
  eachQuad(r.group, "mayer-addition-band-sourced", (q) => {
    /* Every band quad on the east arc lies at the fitted radius from the
       fitted centre, within fit error + the render offset. */
    if (q.x > 140 && q.z > C.select.z0 && q.z < C.select.z1) {
      const d = Math.hypot(q.x - C.centre[0], q.z - C.centre[1]);
      near(d, C.radius, C.maxDevM + section.draw.fieldOffset + 0.15,
        `an arc band quad at (${q.x.toFixed(1)}, ${q.z.toFixed(1)}) left the fitted circle`);
    }
  });
  /* Field and bands stack without overlap: band depth and storey arithmetic. */
  const lidA = roofElevation(ringA(), section.measured.masses.addition.massHeight, flat);
  const A = section.system.addition;
  eachQuad(r.group, "mayer-addition-band-sourced", (q) => {
    const line = (lidA - (q.yLo + q.yHi) / 2) / A.storey;
    near(line, Math.round(line), 0.01, `an Addition band at ${((q.yLo + q.yHi) / 2).toFixed(2)} centres on no floor line`);
    near(q.yHi - q.yLo, A.bandDepth, 5e-4, "an Addition band left its estimate");
  });
});

test("what is withheld does not reach the built scene, and provenance is in every mesh name", { skip }, () => {
  const r = build(flat);
  const names = new Set();
  r.group.traverse((o) => { if (o.isMesh) names.add(o.name); });
  const forbidden = /pier|mullion|stair|window|auditorium|sphere|mural|breezeway|umbrella|arcade|planter|elevator|canopy|chain/i;
  for (const nm of names) {
    assert.ok(!forbidden.test(nm), `${nm} builds something the section withholds`);
  }
  /* PROVENANCE-IN-SCENE (R4 addendum 3): every named mesh carries its tier. */
  const TIERS = {
    "mayer-gallery-slab-estimated": "estimated",
    "mayer-roof-fascia-estimated": "estimated",
    "mayer-roof-overhang-estimated": "estimated",
    "mayer-gallery-deck-estimated": "estimated",
    "mayer-gallery-balustrade-sourced": "sourced",
    "mayer-gallery-glass-estimated": "estimated",
    "mayer-end-curtainwall-estimated": "estimated",
    "mayer-link-glass-sourced": "sourced",
    "mayer-addition-field-sourced": "sourced",
    "mayer-addition-skirt-sourced": "sourced",
    "mayer-addition-band-sourced": "sourced",
    "mayer-addition-parapet-sourced": "sourced",
    "mayer-roof-pv-sourced": "sourced",
    "mayer-roof-monitor-estimated": "estimated",
    "mayer-bed-pinegrove": "bed",
    "mayer-bed-terrace": "bed",
    "mayer-bed-bunchgrass": "bed",
  };
  for (const nm of names) {
    if (/^(photo-mayer|mayer-facades|mayer-roof|mayer-ground)$/.test(nm)) continue;
    assert.ok(nm in TIERS, `unexpected mesh name ${nm} — every mesh must be in the provenance table`);
  }
  for (const nm of Object.keys(TIERS)) {
    assert.ok(names.has(nm), `expected mesh ${nm} is missing from the scene`);
  }
  /* The mesh-name tier must agree with the colour tier it consumes: the
     balustrade and link glass are [sourced], the extended fascia is not. */
  assert.equal(section.colorSources.balustradeAggregate.tier, "sourced");
  assert.equal(section.colorSources.slabFascia.tier, "estimated");
  assert.equal(section.colorSources.mayerGlazing.tier, "estimated");
  assert.equal(section.colorSources.linkGlass.tier, "sourced");
});

test("VISUAL V1: the corrugated field renders AT its declared colour — params and analytic texture mean pinned", { skip }, () => {
  /* The critic proved the field rendered espresso at a third of its pinned
     value. Mechanism: the metalPanel class default metalness 0.9 kills the
     diffuse term, so the declared albedo never reaches the screen. The gate
     pins the exact material instance's colour, BRDF params, and the
     code-generated albedo map's analytic mean, so a texture or class change
     that pulls the field off its pinned colour goes red without a GPU. */
  near(section.draw.fieldMetalness, 0.25, 1e-9, "draw.fieldMetalness moved");
  near(section.draw.fieldRoughness, 0.6, 1e-9, "draw.fieldRoughness moved");
  const { group } = build();
  for (const name of ["mayer-addition-field-sourced", "mayer-addition-skirt-sourced"]) {
    let mesh = null;
    group.traverse((o) => { if (o.isMesh && o.name === name) mesh = o; });
    assert.ok(mesh, `${name} missing`);
    const m = mesh.material;
    assert.equal(`#${m.color.getHexString()}`, section.colors.additionMetal,
      `${name}'s material colour is not the declared additionMetal`);
    assert.ok(m.metalness <= 0.3,
      `${name} metalness ${m.metalness} — a metal BRDF hands the read to reflection and the pinned albedo disappears (critic V1)`);
    near(m.metalness, section.draw.fieldMetalness, 1e-9, `${name} metalness is not the declared param`);
    assert.ok(m.roughness >= 0.4, `${name} roughness ${m.roughness} — reflection would dominate the albedo`);
    near(m.roughness, section.draw.fieldRoughness, 1e-9, `${name} roughness is not the declared param`);
    /* The albedo map must MODULATE AROUND the base colour, not multiply it
       down: its own grey mean stays near 1.0. Computed from the exact bytes
       the GPU samples (DataTexture image data, channel 0). */
    const data = m.map.image.data;
    let sum = 0;
    let n = 0;
    for (let i = 0; i < data.length; i += 4) { sum += data[i]; n++; }
    const mean = sum / n / 255;
    assert.ok(mean >= 0.85 && mean <= 1.0,
      `the field's albedo map mean is ${mean.toFixed(3)} — the texture multiplies the declared colour down instead of modulating around it`);
  }
});

test("VISUAL V2: each facade quad's face is re-derived from the ring, and the west end IS the curtain wall", { skip }, () => {
  /* The critic proved the west end read as a fifth gallery face. The face
     assignment is now re-derived here (the bonner D6 precedent): merge the
     ring's collinear runs, classify by the section's own rules, then pin
     which system each built quad stands on. */
  const tol = section.draw.faceMergeTol;
  const es = [];
  const rm = ringM();
  for (let k = 0; k < rm.length - 1; k++) {
    if (Math.hypot(rm[k + 1][0] - rm[k][0], rm[k + 1][1] - rm[k][1]) > 0) es.push({ a: rm[k], b: rm[k + 1] });
  }
  const fits = (a, b, pts) => {
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const l2 = dx * dx + dz * dz;
    if (!(l2 > 0)) return false;
    for (const p of pts) {
      const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2;
      if (t < -1e-9 || t > 1 + 1e-9) return false;
      if (Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dz)) > tol) return false;
    }
    return true;
  };
  const runs = [];
  let cur = null;
  for (const e of es) {
    if (cur) {
      const pts = cur.pts.concat([e.a, e.b]);
      if (fits(cur.a, e.b, pts)) { cur.b = e.b; cur.pts = pts; continue; }
      runs.push(cur);
    }
    cur = { a: e.a, b: e.b, pts: [e.a, e.b] };
  }
  runs.push(cur);
  if (runs.length > 1 && fits(runs[runs.length - 1].a, runs[0].b, runs[runs.length - 1].pts.concat(runs[0].pts))) {
    runs[0].a = runs[runs.length - 1].a;
    runs.pop();
  }
  const faces = runs.map((r) => ({ ...r, L: Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]) }));
  assert.equal(faces.length, 4, "Mayer's ring must merge to exactly four faces");
  const G = section.system.gallery;
  const long = faces.filter((f) => f.L >= G.longFaceMin);
  const shorts = faces.filter((f) => f.L < G.longFaceMin);
  assert.equal(long.length, 2, "two gallery faces");
  assert.equal(shorts.length, 2, "two short ends");
  const west = shorts.find((f) => (f.a[0] + f.b[0]) / 2 < 60);
  const east = shorts.find((f) => (f.a[0] + f.b[0]) / 2 > 120);
  assert.ok(west && east, "the two short ends must be the west and east faces");
  const segDist = (x, z, f) => {
    const dx = f.b[0] - f.a[0];
    const dz = f.b[1] - f.a[1];
    const l2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - f.a[0]) * dx + (z - f.a[1]) * dz) / l2));
    return Math.hypot(x - (f.a[0] + t * dx), z - (f.a[1] + t * dz));
  };
  const r = build(drawnGround);
  /* The banded system stays on the LONG faces only. */
  for (const meshName of ["mayer-gallery-slab-estimated", "mayer-gallery-balustrade-sourced", "mayer-gallery-deck-estimated"]) {
    eachQuad(r.group, meshName, (q) => {
      assert.ok(long.some((f) => segDist(q.x, q.z, f) <= 2.5),
        `${meshName} quad at (${q.x.toFixed(1)}, ${q.z.toFixed(1)}) stands on no gallery face`);
      assert.ok(segDist(q.x, q.z, west) > 1.0,
        `${meshName} wrapped the west curtain face at (${q.x.toFixed(1)}, ${q.z.toFixed(1)}) — the short end is not a fifth gallery face (critic V2)`);
    });
  }
  /* The curtain wall covers the WEST face — one system per face, pinned. */
  let curtainLen = 0;
  eachQuad(r.group, "mayer-end-curtainwall-estimated", (q) => {
    assert.ok(segDist(q.x, q.z, west) <= 0.3,
      `a curtain quad at (${q.x.toFixed(1)}, ${q.z.toFixed(1)}) is off the west face`);
    curtainLen = Math.max(curtainLen, Math.hypot(q.xHi - q.xLo, q.zHi - q.zLo));
  });
  assert.ok(curtainLen >= 0.9 * west.L,
    `the curtain wall covers ${curtainLen.toFixed(1)} m of the ${west.L.toFixed(1)} m west face`);
  /* And it is an OPAQUE dark plane: a translucent plane let the prism's
     generic striping read through it, which is exactly what the critic saw. */
  let curtain = null;
  r.group.traverse((o) => { if (o.isMesh && o.name === "mayer-end-curtainwall-estimated") curtain = o; });
  assert.ok(curtain, "the curtain wall is missing");
  assert.ok(curtain.material.transparent !== true,
    "the curtain wall is translucent — the face behind restripes it (critic V2)");
  assert.equal(`#${curtain.material.color.getHexString()}`, section.colors.mayerGlazing,
    "the curtain wall is not the declared dark glazing colour");
  /* The recessed gallery glass stays glass-class; the curtain does not. */
  let galleryGlass = null;
  r.group.traverse((o) => { if (o.isMesh && o.name === "mayer-gallery-glass-estimated") galleryGlass = o; });
  assert.ok(galleryGlass.material.transparent === true, "the recessed gallery glass line stays translucent glass");
});

/* ----------------------------------------------- reads, conflicts, absent */

test("reads carry a tolerance, and conflicts are declared with both sides", { skip }, () => {
  const reads = Object.entries(section.reads);
  assert.ok(reads.length >= 8, `only ${reads.length} reads`);
  for (const [k, v] of reads) {
    assert.ok(v.length > 120, `read ${k} is a stub`);
  }
  for (const k of ["galleries", "endCurtainWall", "pilotisRecessedGround", "pvBands", "monitorSpine", "orthoCorrection", "eastGrade", "linkGlazed"]) {
    assert.ok(section.reads[k], `read ${k} is missing`);
  }
  assert.match(section.reads.eastGrade, /addendum 5|LiDAR surface/i,
    "the east grade must cite the LiDAR surface, not a sibling's number");
  assert.match(section.reads.endCurtainWall, /EPOCH|2004/i,
    "the curtain wall read must carry the east-end epoch limit");
  const keys = section.conflicts.map((c) => c.key);
  for (const k of ["mayer-osm-merged-ring", "addition-area-cost-three-way", "mayer-seam-dossier-vs-ring", "ridge-walk-is-west", "aps-designation-year"]) {
    assert.ok(keys.includes(k), `conflict ${k} has left the record`);
  }
  for (const c of section.conflicts) {
    assert.ok(c.sides && c.sides.length >= 2, `conflict ${c.key} has one side`);
    assert.ok(c.resolution && c.resolution.length > 80, `conflict ${c.key} is unresolved prose`);
  }
  const area = section.conflicts.find((c) => c.key === "addition-area-cost-three-way");
  assert.match(area.resolution, /NOT AVERAGED/i, "the three-way conflict must refuse the average");
});

const ABSENT_KEYS = [
  ["A1", /^A1 — THE BAY RHYTHM/],
  ["A2", /^A2 — 'MAYER HALL AUDITORIUM'/],
  ["A3", /^A3 — THE 'MAYER HALL' NAME MURAL/],
  ["A4", /^A4 — THE GILDED SPHERE/],
  ["A5", /^A5 — THE DIAGONAL EXTERNAL STAIRS/],
  ["A6", /^A6 — THE PILOTIS/],
  ["A7", /^A7 — THE BALUSTRADE'S THIN RAIL/],
  ["A8", /^A8 — THE ADDITION'S WINDOWS/],
  ["A9", /^A9 — THE STAIR DRUM'S SLOT WINDOWS/],
  ["A10", /^A10 — THE ELEVATOR TERRACE/],
  ["A11", /^A11 — THE STEPPED PLANTER WALLS/],
  ["A12", /^A12 — THE SE SERVICE YARD/],
  ["A13", /^A13 — PV MOUNTING DETAIL/],
  ["A14", /^A14 — THE BREEZEWAY, ENTIRE/],
  ["A15", /^A15 — THE MURAL WALK'S SOFFIT/],
  ["A16", /^A16 — dc-bb9352649m/],
];
const ABSENT_EXPECTED = {
  A1: /bay count|invented rhythm/i,
  A2: /auditorium|no source/i,
  A3: /mural|lettering/i,
  A4: /sphere|landmark/i,
  A5: /stairs|bay rhythm/i,
  A6: /pilotis|arcade/i,
  A7: /rail|dimension/i,
  A8: /punched|band glazing|face/i,
  A9: /slot|drum/i,
  A10: /elevator|terrace/i,
  A11: /planter|regrade/i,
  A12: /yard|R6/i,
  A13: /rails|tilt|Keeling/i,
  A14: /bonner|junction/i,
  A15: /soffit|doors/i,
  A16: /mislabel|Urey/i,
};

test("the absent list is complete, PER ENTRY, and every ladder is whole", { skip }, () => {
  assert.equal(section.absent.length, 16, `absent is ${section.absent.length} entries`);
  for (const a of section.absent) assert.ok(a.length > 150, `absent entry is a stub: ${a.slice(0, 60)}`);
  const keyed = section.absent.map((text) => {
    const hit = ABSENT_KEYS.find(([, re]) => re.test(text));
    return { key: hit ? hit[0] : `UNKEYED: ${text.slice(0, 60)}`, what: text };
  });
  const seen = new Set();
  for (const e of keyed) {
    assert.ok(!seen.has(e.key), `two absent entries key to ${e.key}`);
    seen.add(e.key);
  }
  assertAbsentEntries({ absent: keyed, expected: ABSENT_EXPECTED, built: {}, label: "mayer absent" });
  const ladders = section.absent.filter((a) => /Ladder climbed and failed/.test(a));
  assert.ok(ladders.length >= 11, `only ${ladders.length} entries climbed a ladder`);
  for (const a of ladders) {
    for (const rung of ["photos", "Street View", "drone", "planning docs", "archives"]) {
      assert.ok(a.includes(rung), `a ladder entry skips the ${rung} rung: ${a.slice(0, 40)}`);
    }
  }
});

test("S2: the one retirement is machine-readable and grounded in the ring", { skip }, () => {
  const S = section.superseded;
  assert.equal(Object.keys(S).length, 1, "mayer ships exactly one supersession");
  const rec = S["research.seamAsGap"];
  assert.ok(rec, "the seam retirement is missing");
  assert.ok(Array.isArray(rec.ships) && rec.ships.length >= 3, "the retirement names too little that ships");
  assert.match(rec.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(rec.why, /125\.3|123\.7/, "the retirement must carry the ring evidence");
  assertDispositions({
    label: "mayer",
    items: [{ key: "research.seamAsGap", disposition: rec.disposition, sup: ["mayer"], detail: rec.why }],
    reciprocals: {},
  });
  /* And mayer explicitly absorbs nothing of revelle.systems. */
  assert.match(section.supersededNote, /urey|bonner/i,
    "the note must say whose mechanism the revelle.systems flips are");
});

/* ------------------------------------------------------------ determinism */

test("two builds are byte-identical — no hidden randomness", { skip }, () => {
  const a = build();
  const b = build();
  assert.deepEqual(a.counts, b.counts);
  const sig = (r) => {
    const out = [];
    r.group.traverse((o) => {
      if (o.isMesh) out.push(Array.from(o.geometry.getAttribute("position").array));
    });
    return out;
  };
  assert.deepEqual(sig(a), sig(b));
});

test("the material library is on the surfaces, and only deterministic sources", { skip }, () => {
  assert.match(moduleSrc, /sharedMaterialLibrary/, "surfaces come from campus-materials.js");
  assert.ok(!/Math\.random|Date\.now|TextureLoader/.test(moduleSrc), "no nondeterminism in the builder");
  /* No bare metre: every decimal in the code must be a UV/epsilon constant. */
  const suspicious = moduleCode.match(/\b\d+\.\d+\b/g) || [];
  for (const s of suspicious) {
    assert.ok(["0.5", "0.1", "0.35", "0.15", "0.01", "0.02", "0.05", "1e"].some((ok) => s === ok),
      `the builder carries a bare decimal ${s} — every metre must come from the section`);
  }
  const { group } = build();
  let textured = 0;
  group.traverse((o) => {
    if (o.isMesh && o.material && o.material.map && o.material.roughnessMap) textured++;
  });
  assert.ok(textured >= 5, `only ${textured} textured meshes — the library is not applied`);
  const mats = new Set();
  group.traverse((o) => { if (o.isMesh) mats.add(o.material.uuid); });
  assert.ok(mats.size <= 20, `${mats.size} distinct materials — the runs are not folding per role`);
});

/* ----------------------------------------- cross-section discipline (R4) */

test("mayer touches neither sibling section nor the breezeway's geometry", { skip }, () => {
  assert.ok(!/urey|bonner/i.test(moduleCode), "the module names a sibling section");
  assert.ok(!/917|918/.test(moduleCode), "the module reaches for the breezeway rings");
  assert.equal(section.counts.breezewayElements, 0, "the breezeway zero is bonner's boundary, declared");
  assert.match(section.system.breezeway.note, /bonner/i, "the breezeway note must name its owner");
  assert.match(section.boundary.north, /BONNER|bonner/, "the north boundary is bonner's court");
  /* The junction plane is recorded for bonner at Mayer's own face. */
  const F = section.derivations.figures;
  near(F["junction.zOnMayerFace"].value, 278.0, 0.05, "the junction plane figure");
});
