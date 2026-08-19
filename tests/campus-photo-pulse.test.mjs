/* Pulse Hall's photo-sourced detail section and its builder.
 *
 * INVENTED class, so the gates are about quarantine, provenance, and not
 * contradicting the measured world:
 *
 *   - every colour role carries its own provenance and its own tier, and
 *     every source carries a DATE (this is a 2023 building described by
 *     sources from 2020, 2021, 2024-25 and 2026 — an undated source here is
 *     a source whose epoch cannot be judged);
 *   - the two rings are the shipped arcgis massing rings, byte for byte at
 *     decimetres/10, and the heights are the GIS h campus-massing.js extrudes;
 *   - NO LiDAR height is read, because there is none: the 2014 survey is
 *     blind to a 2023 building and campus-lidar.json has no Pulse entry;
 *   - the storey grid is the DRAWN prism read back with zero residual, and
 *     the sourced 3.048 m is a declared SOURCE CONFLICT rather than a
 *     silently-preferred number;
 *   - EVERY ARCHITECTURAL DIMENSION IS GATED AGAINST ITS OWN DERIVATION.
 *     This file used to check only topology — ring identity, endpoints,
 *     shared edges, clip probes, determinism, the PRESENCE of provenance —
 *     and an audit proved it: a section with every sourced figure replaced by
 *     a self-consistent fabrication (window 3.6 x 1.1, pier 0.20, colonnade
 *     clear 1.2, paver rotation 0) passed all 22 gates. So the derivation
 *     block is now recomputed here from its own pinned citations, every
 *     drawn number in the geometry blocks must be covered by a derivation, a
 *     labelled estimate or a cited read, and the module may not carry a bare
 *     dimension of its own;
 *   - nothing hovers and nothing intersects: facades top out exactly at the
 *     drawn deck, roof items stay on their own lid AND are swept pairwise for
 *     interpenetration, terrace pavers stay above the Mid deck, the ground
 *     classes seat on the drawn surface or on the structure that carries
 *     them, and the whole ground group stays inside a declared envelope;
 *   - the clips are checked by ABSENCE, not by existence — each declared
 *     forbidden probe is inside its mass's bounding box, outside its ring,
 *     and has no item of that mass anywhere near it;
 *   - there is no PV anywhere, on either lid;
 *   - the absent list does not shrink.
 *
 * TWO TERRAINS. Most gates run on a rolling synthetic sampler, because flat
 * samplers have hidden real floaters before. The GROUND STOREY additionally
 * runs on the terrain that actually ships (makeSurfaceSampler over
 * campus-lidar.json), because the exterior flight is solved against the drawn
 * surface: on a caricature terrain with 4 m of relief across one building the
 * flight correctly builds nothing, and a gate that only ever sees that case
 * would be gating an empty set.
 *
 * The section lives under the `pulse` key of docs/data/campus-photo-detail.json.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as THREE from "../docs/vendor/three/three.module.min.js";
import { createPhotoPulse } from "../docs/js/campus-photo-pulse.js";
import { assembleMasses, roofElevation } from "../docs/js/campus-massing.js";
import { makeSurfaceSampler } from "../docs/js/campus-terrain.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(p, "utf8"));

/* PHOTO_DETAIL lets a repair agent (or the merge review) run this whole file
   against a candidate section BEFORE it lands in the shipped document. */
const shipped = read(process.env.PHOTO_DETAIL || join(root, "docs/data/campus-photo-detail.json"));

const section = shipped.pulse;

const arcgis = read(join(root, "docs/data/campus-arcgis.json"));
const lidar = read(join(root, "docs/data/campus-lidar.json"));
const campus = read(join(root, "docs/data/campus-3d.json"));

/* ------------------------------------------------------------- helpers */

const inRing = (x, z, r) => {
  let ins = false;
  for (let i = 0, j = r.length - 2; i < r.length - 1; j = i++) {
    const [xi, zi] = r[i];
    const [xj, zj] = r[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
};

function edgeDistance(x, z, r) {
  let best = Infinity;
  for (let i = 0; i < r.length - 1; i++) {
    const [ax, az] = r[i];
    const [bx, bz] = r[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz;
    let t = len2 ? ((x - ax) * dx + (z - az) * dz) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
}
const outside = (x, z, r) => (inRing(x, z, r) ? 0 : edgeDistance(x, z, r));
const bbox = (r) => ({
  x0: Math.min(...r.map((p) => p[0])), x1: Math.max(...r.map((p) => p[0])),
  z0: Math.min(...r.map((p) => p[1])), z1: Math.max(...r.map((p) => p[1])),
});
const at = (obj, path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);

/* A rolling fake terrain — flat samplers have hidden real floaters before. */
const sloped = (x, z) => 20 + 1.2 * Math.sin(x / 14) + 0.9 * Math.cos(z / 17);
/* And the terrain that actually ships. */
const drawn = makeSurfaceSampler(lidar.terrain);
const build = (g = sloped) =>
  createPhotoPulse(null, { photo: { pulse: section }, heightAt: g, surfaceAt: g });

/**
 * Walk every placement in a node and report its TRUE world extent.
 *
 * Not the instance scale: a cylinder vent and a sphere crown carry their size
 * in the geometry, and reading scale.y called a 0.42 m vent 1.0 m tall and put
 * its bottom half a metre inside the roof it was standing on. The box is the
 * geometry's own bounds pushed through the instance matrix; `rect` is the same
 * placement as an oriented rectangle in plan, for the intersection sweep.
 */
function each(node, fn) {
  if (!node) return;
  const m = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const world = (geo, mat) => {
    if (!geo.boundingBox) geo.computeBoundingBox();
    const b = geo.boundingBox;
    let lo = Infinity;
    let hi = -Infinity;
    for (const x of [b.min.x, b.max.x]) {
      for (const y of [b.min.y, b.max.y]) {
        for (const z of [b.min.z, b.max.z]) {
          v.set(x, y, z).applyMatrix4(mat);
          lo = Math.min(lo, v.y);
          hi = Math.max(hi, v.y);
        }
      }
    }
    const e = mat.elements;
    const hx = (b.max.x - b.min.x) / 2;
    const hz = (b.max.z - b.min.z) / 2;
    return {
      lo, hi,
      rect: {
        x: e[12], z: e[14],
        ux: e[0] * hx, uz: e[2] * hx,
        vx: e[8] * hz, vz: e[10] * hz,
      },
    };
  };
  node.traverse((o) => {
    if (o.isInstancedMesh) {
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m);
        fn(m.elements[12], m.elements[13], m.elements[14], world(o.geometry, m), o, i);
      }
    } else if (o.isMesh) {
      o.updateMatrix();
      fn(o.position.x, o.position.y, o.position.z, world(o.geometry, o.matrix), o, 0);
    }
  });
}

/** Separating-axis penetration of two oriented plan rectangles. <= 0 = apart. */
function penetration(a, b) {
  const axes = [];
  for (const r of [a, b]) {
    const ul = Math.hypot(r.ux, r.uz) || 1;
    const vl = Math.hypot(r.vx, r.vz) || 1;
    axes.push([r.ux / ul, r.uz / ul], [r.vx / vl, r.vz / vl]);
  }
  let min = Infinity;
  for (const [nx, nz] of axes) {
    const ra = Math.abs(a.ux * nx + a.uz * nz) + Math.abs(a.vx * nx + a.vz * nz);
    const rb = Math.abs(b.ux * nx + b.uz * nz) + Math.abs(b.vx * nx + b.vz * nz);
    const d = Math.abs((b.x - a.x) * nx + (b.z - a.z) * nz);
    const pen = ra + rb - d;
    if (pen <= 0) return pen;
    if (pen < min) min = pen;
  }
  return min;
}

/* ------------------------------------------------------------- the data */

test("the section exists and is reachable", () => {
  assert.ok(section, "no pulse section in the merged doc or the build-side file");
});

test("it says what it is: one bar, two GIS masses, the right architect, honest", () => {
  assert.match(section.label, /Pulse/);
  assert.match(section.label, /Eighth College|Theatre District/);
  assert.match(section.label, /HKS/, "the design architect is HKS, not Safdie Rabines");
  assert.ok(!/Safdie|OJB/i.test(section.label + section.epoch + section.note),
    "Safdie Rabines / OJB designed Sixth College, not this building");
  assert.match(section.note, /INVENTED/, "the note must declare the class");
  assert.match(section.epoch, /LiDAR IS BLIND|no entry/i,
    "the epoch stamp must say the 2014 LiDAR cannot see this building");
  assert.ok(section.confidence, "no confidence statement");
  assert.equal(typeof section.seed, "number", "the section must pin a seed");
});

test("every source carries a date, and the dead-epoch renderings are labelled", () => {
  assert.ok(Array.isArray(section.sources) && section.sources.length >= 8,
    `only ${section.sources?.length} sources`);
  for (const s of section.sources) {
    assert.match(s.url, /^(https:\/\/|file:)/, `bad source url ${s.url}`);
    assert.match(String(s.date), /\d{4}/, `source ${s.url} has no date`);
    assert.ok(s.what && s.what.length > 20, `source ${s.url} does not say what it is`);
    assert.ok(s.rung, `source ${s.url} has no ladder rung`);
  }
  const renders = section.sources.find((s) => /revelle\.ucsd\.edu/.test(s.url));
  assert.match(renders.rung, /DESIGN epoch|superseded/i,
    "the 2021 renderings must be labelled the dead epoch they are");
  /* Every guard, picket spacing and stair proportion here is solved on a code
     rule rather than eyeballed, so the code edition is a source like any
     other and has to be citable. */
  assert.ok(section.sources.some((s) => /code/i.test(s.rung)),
    "the code rules the guard and the flight are solved on must be a listed source");
});

test("colours are data, lowercase hex, and EVERY role carries its own provenance", () => {
  const entries = Object.entries(section.colors);
  assert.ok(entries.length >= 20, `only ${entries.length} colours`);
  for (const [k, v] of entries) {
    assert.match(v, /^#[0-9a-f]{6}$/, `${k} is not a lowercase 6-digit hex`);
    const p = section.colorSources[k];
    assert.ok(p, `${k} has no colorSources entry`);
    assert.ok(["measured", "sourced", "estimated"].includes(p.tier), `${k} has tier ${p.tier}`);
    assert.ok(p.source && p.source.length > 25, `${k}'s provenance is too thin`);
    if (p.tier === "estimated") {
      assert.match(p.source, /\[estimated\]/, `${k} is estimated and must say so`);
    }
    /* And the converse, which is the hole an audit found: a role may not wear
       a `sourced` tier while its own provenance admits the hex is invented. */
    if (p.tier !== "estimated") {
      assert.ok(!/\[estimated\]|hex is \[?estimated/i.test(p.source),
        `${k} is tiered ${p.tier} but its own provenance calls the hex estimated`);
    }
  }
  /* The measured roles are the ones k-means actually produced off SWA-16. */
  for (const k of ["fieldPanelSunlit", "accentPanel", "windowGlass", "frameGold", "frameCharcoal"]) {
    assert.equal(section.colorSources[k].tier, "measured", `${k} must be measured`);
    assert.match(section.colorSources[k].source, /Learning-16/, `${k} must name its frame`);
  }
  /* The neutral working field colour is the mean of two measured samples. */
  const mid = (a, b, i) =>
    Math.round((parseInt(a.slice(i, i + 2), 16) + parseInt(b.slice(i, i + 2), 16)) / 2);
  const A = section.colors.fieldPanelSunlit;
  const B = section.colors.fieldPanelShade;
  const F = section.colors.fieldPanel;
  for (const i of [1, 3, 5]) {
    assert.ok(Math.abs(mid(A, B, i) - parseInt(F.slice(i, i + 2), 16)) <= 1,
      "fieldPanel must be the mean of the two measured samples it claims to be");
  }
});

/* ------------------------------------------------ THE KEELING BAR gates */

/**
 * The citations. These are literals on purpose: a pixel count, a published
 * foot, a code rule and a stock product size are the SOURCE, not something
 * derived from it, and pinning them is what stops a fabricated dimension
 * being made to pass by rewriting its own derivation's inputs. Keeling pins
 * `panel [1.65, 0.99]` the same way.
 */
test("the citations are pinned: pixels, feet, code rules, product sizes", () => {
  const R = section.derivations.readings;
  assert.equal(section.derivations.units.inch, 0.0254);
  assert.equal(section.derivations.units.foot, 0.3048);
  assert.deepEqual(
    { storeyPitch: R.px.storeyPitch, bayPitch: R.px.bayPitch, windowWidth: R.px.windowWidth,
      windowHeight: R.px.windowHeight, frameFace: R.px.frameFace, panelJoint: R.px.panelJoint,
      colonnadeClear: R.px.colonnadeClear },
    { storeyPitch: 125, bayPitch: 180, windowWidth: 100, windowHeight: 100,
      frameFace: 6, panelJoint: 28, colonnadeClear: 105 },
    "the SWA-16 pixel readings moved — that is a change to what the photograph is claimed to show");
  assert.equal(R.published.storeyFeet, 10);
  assert.equal(R.published.screenTopFeet, 115, "the 2020 deck's published top-of-screen");
  assert.equal(R.published.rotationDeg, 6, "HKS published six degrees");
  assert.deepEqual(R.code,
    { guardHeightIn: 42, guardSphereIn: 4, handrailHeightIn: 36, stairRiserIn: 6,
      stairGoingIn: 12, source: R.code.source },
    "the code rules are IBC 2021 and do not move");
  assert.equal(R.ring.measuredFaceLength, 48.7, "the survey ring's own 48.7 m face");
  assert.equal(R.ring.countedBays, 11, "eleven window columns counted across it");
  assert.equal(R.ring.towerStripDepth, section.measured.depth.towerStrip);
  assert.ok(R.px.source.length > 40 && R.code.source.length > 40 && R.product.source.length > 40,
    "every reading group must say where it comes from");
});

/**
 * THE HEADLINE GATE. Every drawn dimension is recomputed here, independently,
 * out of the pinned citations — and then checked BOTH against the section's
 * own stated derivation value and against the field the module actually
 * reads. A fabricated figure fails on the second check; a fabricated
 * derivation fails on the first.
 */
test("every derived dimension reproduces from its own citations, and is what the section ships", () => {
  const R = section.derivations.readings;
  const IN = section.derivations.units.inch;
  const FT = section.derivations.units.foot;
  const { px, published: pub, code, product: prod, ring } = R;
  const storey = pub.storeyFeet * FT;
  const bay = ring.measuredFaceLength / ring.countedBays;
  const T = section.measured.masses.tower;
  const M = section.measured.masses.mid;

  const panel = (px.panelJoint / px.storeyPitch) * storey;
  const wWidth = (px.windowWidth / px.bayPitch) * bay;
  const wHeight = (px.windowHeight / px.storeyPitch) * storey;
  const face = (px.frameFace / px.windowWidth) * wWidth;
  const clear = (px.colonnadeClear / px.storeyPitch) * storey;
  const pier = section.groundStorey.colonnade.pierSize;
  const parapetT = (prod.wallStructureIn + 2 * prod.rainscreenCavityIn) * IN;
  const padW = prod.walkPadWidthIn * IN;
  const going = code.stairGoingIn * IN;
  const deckDepth = pier;
  const ventR = (prod.ventPipeIn * IN) / 2;
  const columnPitch = bay / (2 * section.lantern.columnsPerFacet);
  const opening = columnPitch - section.lantern.frameFace;
  const picket = prod.picketIn * IN;

  const expect = {
    "grid.bayModule": bay,
    "grid.residentialRowsTower": T.levels - section.grid.groundStoreys,
    "grid.residentialRowsMid": M.levels - section.grid.groundStoreys,
    "system.panel.width": panel,
    "system.panel.widthTolerance": (px.panelJointTolerance / px.storeyPitch) * storey,
    "system.chimney.width": section.system.chimney.panelsWide * panel,
    "system.window.width": wWidth,
    "system.window.height": wHeight,
    "system.window.sill": storey - wHeight - face,
    "system.window.projection": wWidth * Math.sin((pub.rotationDeg * Math.PI) / 180),
    "system.window.transomFrac": 2 / 3,
    "system.frame.face": face,
    "system.frame.proud": face,
    "system.commonRoom.height": wHeight,
    "system.commonRoom.sill": storey - wHeight - face,
    "system.stepWall.thickness": parapetT,
    "lantern.rowsTower": T.levels,
    "lantern.rowsMid": M.levels,
    "lantern.columnPitch": columnPitch,
    "lantern.opening.0": opening,
    "lantern.opening.1": opening,
    "lantern.frameProud": section.lantern.frameFace,
    "lantern.sill": storey - wHeight - face,
    "groundStorey.clearHeight": clear,
    "groundStorey.colonnade.pierProud": pier / 2,
    "groundStorey.colonnade.oversail": pier,
    "groundStorey.colonnade.soffitFasciaTower": T.h / T.levels - clear,
    "groundStorey.colonnade.soffitFasciaMid": M.h / M.levels - clear,
    "groundStorey.breezeway.width": bay,
    "groundStorey.stair.width": bay - pier,
    "groundStorey.stair.rise": code.stairRiserIn * IN,
    "groundStorey.stair.going": going,
    "groundStorey.stair.flightHeight": section.groundStorey.stair.risersSourced * code.stairRiserIn * IN,
    "groundStorey.stair.handrails": 2,
    "groundStorey.stair.handrailHeight": code.handrailHeightIn * IN,
    "groundStorey.stair.handrailOD": prod.pipeOdIn * IN,
    "groundStorey.northTerrace.deckDepth": deckDepth,
    "groundStorey.northTerrace.guardHeight": code.guardHeightIn * IN,
    "groundStorey.northTerrace.picket": picket,
    "groundStorey.northTerrace.picketPitch": code.guardSphereIn * IN + picket,
    "groundStorey.northTerrace.railOD": prod.pipeOdIn * IN,
    "groundStorey.envelope": Math.max(section.groundStorey.porch.depth,
      deckDepth + section.groundStorey.stair.risersSourced * going) + (prod.pipeOdIn * IN) / 2,
    "roof.parapet.height": code.guardHeightIn * IN,
    "roof.parapet.thickness": parapetT,
    "roof.parapet.copingHeight": prod.copingFaceIn * IN,
    "roof.parapet.copingOversail": prod.copingDripIn * IN,
    "roof.walkPad.width": padW,
    "roof.walkPad.thickness": prod.walkPadThicknessIn * IN,
    "roof.walkPad.inset": padW / 2,
    "roof.walkPad.segment": padW,
    "roof.screenWells.height": pub.screenTopFeet * FT - T.h,
    "roof.screenWells.wallThickness": (prod.screenStructureIn + 2 * prod.rainscreenCavityIn) * IN,
    "roof.condensers.pitch": section.roof.condensers.size[0] + prod.condenserClearIn * IN,
    "roof.condensers.clearance": prod.condenserClearIn * IN,
    "roof.bulkhead.height": T.h / T.levels,
    "roof.vents.radius": ventR,
    "roof.vents.height": prod.ventAboveRoofIn * IN,
    "roof.vents.edgeClear": parapetT + ventR,
    "terrace.xEast": M.ring[1][0] + section.terrace.sourced.uFrac * ring.measuredFaceLength,
    "terrace.sourced.length": section.terrace.sourced.uFrac * ring.measuredFaceLength,
    "terrace.paver": prod.paverIn * IN,
    "terrace.paverThickness": prod.paverThicknessIn * IN,
    "terrace.paverRotationDeg": 45,
    "terrace.edgeClear": parapetT,
    "terrace.planterSize.1": prod.planterSoilIn * IN,
  };

  /* Two figures are solved per mass inside the module and have no stored
     field of their own; everything else must ALSO be the value the module
     reads, or the derivation is decoration. */
  const solvedOnly = new Set([
    "groundStorey.colonnade.soffitFasciaTower",
    "groundStorey.colonnade.soffitFasciaMid",
  ]);
  const figures = section.derivations.figures;
  assert.deepEqual(Object.keys(figures).sort(), Object.keys(expect).sort(),
    "the derivation table and this test's independent recomputation must cover the same figures");
  for (const [path, want] of Object.entries(expect)) {
    const decl = figures[path];
    assert.ok(decl && decl.expr, `${path} has no stated derivation`);
    assert.ok(Math.abs(decl.value - want) < 5e-6,
      `${path}: the section states ${decl.value} but its own citations give ${want}`);
    if (solvedOnly.has(path)) continue;
    const shippedValue = at(section, path.replace(/\.(\d+)$/, ".$1"));
    assert.equal(typeof shippedValue, "number", `${path} is not a number in the section`);
    assert.ok(Math.abs(shippedValue - want) < 5e-6,
      `${path}: the section SHIPS ${shippedValue} but derives ${want}`);
  }
  /* The derived window is the one the audit's fabrication replaced. Spot-check
     that the derivation actually bites on the numbers that matter. */
  assert.ok(Math.abs(section.system.window.width - 2.4596) < 1e-3);
  assert.ok(Math.abs(section.groundStorey.clearHeight - 2.5603) < 1e-3);
  assert.ok(Math.abs(section.roof.parapet.height - 1.0668) < 1e-4, "42 inches, exactly");
});

/**
 * COVERAGE. Every number the geometry blocks carry is either derived, a
 * labelled estimate that names the pattern it extends, or a cited read with a
 * tolerance. Nothing may simply appear.
 */
test("no drawn number is uncovered: derivation, labelled estimate, or cited read", () => {
  const exempt = new Set(["roof.clips", "roof.pv", "terrace.planters"]);
  const paths = [];
  const walk = (v, p) => {
    if (exempt.has(p)) return;
    if (typeof v === "number") { paths.push(p); return; }
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, `${p}.${i}`)); return; }
    if (v && typeof v === "object") for (const k of Object.keys(v)) walk(v[k], p ? `${p}.${k}` : k);
  };
  for (const r of ["grid", "system", "lantern", "groundStorey", "roof", "terrace"]) walk(section[r], r);
  assert.ok(paths.length > 50, `only ${paths.length} drawn numbers found — the walk did not run`);

  const derived = new Set(Object.keys(section.derivations.figures));
  const est = section.estimates;
  const reads = section.reads;
  for (const p of paths) {
    const where = derived.has(p) ? "derived" : est[p] ? "estimated" : reads[p] ? "read" : null;
    assert.ok(where,
      `${p} = ${at(section, p)} is a bare number: derive it, label it [estimated] with the pattern it extends, or cite the frame it is read off`);
  }
  for (const [p, e] of Object.entries(est)) {
    if (p === "why") continue;
    assert.match(e.why, /\[estimated\]/, `${p} must carry the [estimated] label`);
    assert.ok(e.extends && e.extends.length > 15,
      `${p} must record which sourced pattern it extends`);
    assert.ok(Math.abs(at(section, p) - e.value) < 5e-6,
      `${p} ships ${at(section, p)} but its estimate says ${e.value}`);
  }
  for (const [p, r] of Object.entries(reads)) {
    if (p === "why") continue;
    assert.ok(r.source && r.source.length > 25, `${p} must name the frame or plan it is read off`);
    assert.equal(typeof r.tolerance, "number", `${p} must carry the tolerance its frame supports`);
    if (p === "terrace.planters") continue;
    assert.ok(Math.abs(at(section, p) - r.value) < 5e-6,
      `${p} ships ${at(section, p)} but its read says ${r.value}`);
  }
  /* The three tiers must not overlap: one number, one provenance. */
  for (const p of Object.keys(est)) {
    if (p === "why") continue;
    assert.ok(!derived.has(p) && !reads[p], `${p} claims two provenances`);
  }
});

test("the module carries no dimension of its own — geometry is data", () => {
  const src = readFileSync(join(root, "docs/js/campus-photo-pulse.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  /* Every decimal the module is allowed to contain, and why. Anything else is
     a building dimension that belongs in the section — Keeling puts
     `ballastTray [0.5, 0.06, 0.38]` in the document, and so does this. */
  const allowed = new Map([
    ["43758.5453", "hash constant"], ["131.71", "hash constant"],
    ["57.13", "hash constant"], ["7.9", "hash constant"],
    ["0.34", "hash threshold, one third"], ["0.67", "hash threshold, two thirds"],
    ["0.5", "a half"], ["0.0", "metalness zero"],
    ["0.06", "material metalness"], ["0.35", "material metalness"],
    ["0.42", "material roughness"], ["0.45", "material normalScale"],
    ["0.55", "material roughness"], ["0.7", "material normalScale"],
    ["0.78", "material roughness"], ["0.95", "material roughness"],
    ["0.98", "material roughness"],
  ]);
  const found = new Set(src.match(/\b\d+\.\d+\b/g) || []);
  for (const n of found) {
    assert.ok(allowed.has(n),
      `${n} is a bare number in the builder — move it into the section's derivations, estimates, reads or draw block`);
  }
  /* And the module must actually be reading the data blocks. */
  for (const key of ["section.draw", "derivations.readings", "system.window", "roof.parapet"]) {
    assert.ok(src.includes(key.split(".").pop()), `the builder never reads ${key}`);
  }
});

test("the rings are the shipped arcgis massing rings, byte for byte at /10", () => {
  const drawnMasses = assembleMasses({ campus, lidar, arcgis, colors: null })
    .filter((m) => m.name === "Pulse" && m.src === "gis");
  assert.equal(drawnMasses.length, 2, "campus-massing does not draw two Pulse gis masses any more");
  for (const [key, gisIndex, h, levels] of [["tower", 463, 30.5, 10], ["mid", 487, 27.4, 9]]) {
    const M = section.measured.masses[key];
    assert.equal(M.gisIndex, gisIndex);
    assert.equal(M.gisName, arcgis.massing[gisIndex].n);
    assert.equal(M.h, h, `${key}.h drifted from the GIS h`);
    assert.equal(M.levels, levels);
    assert.deepEqual(M.ring, arcgis.massing[gisIndex].r[0].map(([x, z]) => [x / 10, z / 10]),
      `${key}.ring is not the arcgis ring at decimetres/10`);
    const mass = drawnMasses.find((d) => d.h === h);
    assert.ok(mass, `no drawn gis mass at h ${h}`);
    assert.deepEqual(M.ring, mass.rings[0],
      `${key}.ring is not the ring campus-massing.js actually extrudes`);
  }
});

test("NO LiDAR height is read, because there is none", () => {
  /* The two geometry keys campus-massing would use for these masses. */
  for (const key of ["m:-154,556", "m:-186,562"]) {
    assert.equal(lidar.massHeights?.[key], undefined,
      `campus-lidar now has ${key} — re-derive the height stack before trusting this section`);
  }
  assert.equal(section.measured.lidarHeight, null, "no LiDAR height may be claimed here");
  assert.match(section.measured.lidarNote, /NO LiDAR/i);
  /* campus-3d DOES carry an OSM 'Pulse' ring with an h. It is a levels guess
     over a footprint that merges the two masses; the section must name it and
     must not use it anywhere. */
  const osm = campus.buildings.filter((b) => /^Pulse$/i.test(b.n || ""));
  assert.equal(osm.length, 1, "the OSM Pulse ring moved — re-check measured.osmNote");
  assert.match(section.measured.osmNote, new RegExp(String(osm[0].h)),
    "the OSM h must be named in the section as the number that is NOT used");
  const used = JSON.stringify(section.measured.masses) + JSON.stringify(section.measured.heightStack);
  assert.ok(!used.includes(String(osm[0].h)),
    `the OSM h ${osm[0].h} leaked into the height stack`);
  /* Comments are allowed to EXPLAIN why there is no LiDAR read; code is not
     allowed to take one. */
  const src = readFileSync(join(root, "docs/js/campus-photo-pulse.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/massHeights|lidarHeight|campus-lidar/.test(src),
    "the builder must not reach for a LiDAR height for a 2023 building");
});

test("the storey grid is the DRAWN prism read back, and 3.048 is a declared conflict", () => {
  const H = section.measured.heightStack;
  const T = section.measured.masses.tower;
  const M = section.measured.masses.mid;
  assert.ok(Math.abs(T.h / T.levels - H.floorToFloorDrawnTower) < 1e-9,
    "the Tower's drawn storey is h / levels, with zero residual");
  assert.ok(Math.abs(M.h / M.levels - H.floorToFloorDrawnMid) < 1e-3,
    "the Mid's drawn storey is h / levels");
  assert.equal(H.floorToFloorSourced, 3.048, "the sourced 10 ft floor-to-floor stays on the record");
  assert.match(H.conflict, /SOURCE CONFLICT/, "the drawn/sourced disagreement must be declared");
  assert.match(H.conflict, /DRAWN PRISM WINS/i);
  /* And the conflict must say which of the two the photographed RATIOS
     convert on, because that is the rule every derived dimension uses. */
  assert.match(H.conflict, /SOURCED 3\.048/,
    "the height stack must say the photographed ratios convert on the sourced storey");
  assert.match(H.note, /115/, "the published 115 ft top-of-screen is the second epoch");
  assert.equal(H.screenTopFt, 115);
  assert.ok(Math.abs(section.roof.screenWells.height - (115 * 0.3048 - T.h)) < 0.01,
    "the screen well height must resolve to the published 115 ft over the drawn deck");
  assert.equal(section.grid.residentialRowsTower, T.levels - 1);
  assert.equal(section.grid.residentialRowsMid, M.levels - 1);
  assert.match(section.grid.bayConflict, /campus-eighth\.json/,
    "the shipped 3.5 m bay disagreement must be recorded, not deleted");
  /* The bay note must describe the modules this section actually builds. */
  const built = section.facades
    .filter((f) => f.system === "field").map((f) => f.length / f.bays);
  for (const module of built) {
    assert.ok(section.grid.bayNote.includes(module.toFixed(3)),
      `the bay note does not account for a built module of ${module.toFixed(3)} m`);
  }
  assert.ok(!/4\.87/.test(section.grid.bayNote),
    "the 10-bay reading is not used and must not appear as if it were built");
  assert.match(section.grid.bayConflict, /4\.87/,
    "the unused 10-bay reading belongs in the conflict note, named as unused");
});

test("the three shared edges are real, and the perimeter is the external runs only", () => {
  const T = section.measured.masses.tower.ring;
  const M = section.measured.masses.mid.ring;
  assert.equal(section.measured.sharedEdges.length, 3);
  for (const e of section.measured.sharedEdges) {
    /* Both endpoints must lie ON both rings. Not "be a vertex of both": the
       T1/M4 pair overlaps partially (T1 is z 558.3-562.5, M4 is 558.0-562.5),
       so one endpoint is a Tower vertex sitting mid-segment on the Mid — which
       is exactly the condition `overlap` declares. */
    for (const p of [e.a, e.b]) {
      assert.ok(edgeDistance(p[0], p[1], T) < 1e-9, `${e.pair}: ${p} is not on the Tower ring`);
      assert.ok(edgeDistance(p[0], p[1], M) < 1e-9, `${e.pair}: ${p} is not on the Mid ring`);
    }
    const coincident = [e.a, e.b].every((p) =>
      T.some(([x, z]) => x === p[0] && z === p[1]) && M.some(([x, z]) => x === p[0] && z === p[1]));
    if (!coincident) {
      assert.equal(e.overlap, true, `${e.pair} is a partial overlap and must declare it`);
      assert.ok(e.overlapNote && e.overlapNote.length > 60, `${e.pair} must explain the overlap`);
    }
    /* And the midpoint, pushed off the Tower, must land inside the Mid. */
    const mx = (e.a[0] + e.b[0]) / 2;
    const mz = (e.a[1] + e.b[1]) / 2;
    const L = Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1]);
    let nx = (e.b[1] - e.a[1]) / L;
    let nz = -(e.b[0] - e.a[0]) / L;
    if (inRing(mx + nx * 0.4, mz + nz * 0.4, T)) { nx = -nx; nz = -nz; }
    assert.ok(inRing(mx + nx * 0.4, mz + nz * 0.4, M),
      `${e.pair} is not actually shared — the other side is open air, so it needs a facade`);
  }
  /* No facade may be built on a shared edge below the deck step. */
  const sharedKeys = new Set(section.measured.sharedEdges.flatMap((e) =>
    [`${e.a}|${e.b}`, `${e.b}|${e.a}`]));
  for (const f of section.facades) {
    if (f.system === "stepFace") continue;
    assert.ok(!sharedKeys.has(`${f.a}|${f.b}`), `${f.id} builds a facade on an internal edge`);
  }
  const sum = section.facades
    .filter((f) => f.system !== "stepFace")
    .reduce((s, f) => s + f.length, 0);
  assert.ok(Math.abs(sum - section.measured.perimeter.externalFacade) < 0.05,
    "the declared external perimeter is not the sum of the external runs");
  assert.match(section.measured.perimeter.note, /225\.3/,
    "the inventory's 225.3 m figure and why it differs must stay on the record");
});

test("every facade endpoint lies ON its mass's drawn ring", () => {
  for (const f of section.facades) {
    const ring = section.measured.masses[f.mass].ring;
    for (const p of [f.a, f.b]) {
      assert.ok(edgeDistance(p[0], p[1], ring) < 1e-6,
        `${f.id}: ${JSON.stringify(p)} is not on the ${f.mass} ring`);
    }
    /* A split run (the Mid's west end) must say where its station came from. */
    const onVertex = ring.some(([x, z]) => x === f.a[0] && z === f.a[1])
      && ring.some(([x, z]) => x === f.b[0] && z === f.b[1]);
    if (!onVertex) {
      assert.ok(f.derivedFrom, `${f.id} is split off a segment and must say how`);
    }
    assert.ok(Math.abs(Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]) - f.length) < 0.01,
      `${f.id}'s declared length is not its own geometry`);
    /* The normal must point out of the building. */
    const c = ring.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0]).map((v) => v / ring.length);
    const mx = (f.a[0] + f.b[0]) / 2 - c[0];
    const mz = (f.a[1] + f.b[1]) / 2 - c[1];
    assert.ok(mx * f.out[0] + mz * f.out[1] > 0, `${f.id}'s normal points into the building`);
    assert.ok(f.source && f.source.length > 30, `${f.id} has no real source`);
    assert.ok(["measured", "sourced"].includes(f.tier), `${f.id} has tier ${f.tier}`);
    if (f.tier === "sourced" && f.system === "field" && f.id !== "T-north-westBar") {
      assert.ok(f.patternRef, `${f.id} extends a pattern and must name it`);
      assert.ok(section.facades.some((x) => x.id === f.patternRef && x.tier === "measured"),
        `${f.id}'s patternRef must be a MEASURED face`);
    }
  }
  assert.equal(section.facades.length, section.counts.facades);
});

test("the six degrees are sourced and the SENSE is declared estimated", () => {
  const W = section.system.window;
  assert.equal(W.rotationDeg, 6, "HKS published six degrees");
  assert.ok(Math.abs(W.projection - W.width * Math.sin((6 * Math.PI) / 180)) < 1e-6,
    "the projection must be the derived opening x sin 6 deg, not a round number");
  assert.match(W.senseNote, /\[estimated\]/, "the rotation sense is not sourced");
  assert.match(section.system.serration, /NOT additionally folded|not additionally folded/i,
    "the serration must be built as the rotated boxes only");
  assert.match(section.system.commonRoom.note, /\[estimated\]/,
    "the common room's glazing width is an estimate and must say so");
});

test("there is NO photovoltaic array, and the negative names its control", () => {
  assert.equal(section.roof.pv.built, false);
  assert.equal(section.roof.pv.banks, 0);
  assert.equal(section.roof.pv.panels, 0);
  assert.match(section.roof.pv.note, /KEELING/, "the in-frame control must be named");
  assert.match(section.roof.pv.note, /phf15/, "the frame carrying the negative must be named");
  assert.ok(section.absent.some((a) => /PHOTOVOLTAIC/i.test(a) && /KEELING/i.test(a)),
    "the PV absence must also be in the absent list, Keeling-style");
});

test("the absent list is long, specific, and does not shrink", () => {
  assert.ok(Array.isArray(section.absent) && section.absent.length >= 24,
    `absent has ${section.absent?.length} entries — better absent than wrong, and this list does not shrink`);
  for (const a of section.absent) {
    assert.equal(typeof a, "string");
    assert.ok(a.length > 60, `an absent entry must say WHY: ${a}`);
  }
  const must = [
    [/PHOTOVOLTAIC/i, "the PV negative"],
    [/9155|9175|ADDRESS/i, "the unresolved street address"],
    [/WORDMARK/i, "the missing PULSE wordmark"],
    [/loggia|recess/i, "the west end's Apple-mesh recesses"],
    [/slot window/i, "the unmeasured slot windows"],
    [/pergola|communal table/i, "the terrace's unresolved long element"],
    [/1\.02/, "the panel-module conflict"],
    [/interior/i, "the undocumented interiors"],
    [/balcon/i, "Survivance's balconies not migrating here"],
    [/CEQA|EIR/i, "the unmined planning record"],
    [/DOOR/i, "every opening but the colonnade pair"],
    [/BREEZEWAY'S PLANTING|planting wedges/i, "the breezeway's dropped contents"],
    [/LEVEL CHANGE/i, "the court-to-colonnade level change the drawn terrain lacks"],
    [/STEP UP FROM GRADE/i, "the Front Porch's withdrawn 'raised' claim"],
    [/GUARD ON THE FRONT PORCH/i, "the guard that belongs on the north terrace"],
    [/ROOF DRAINS/i, "vents and drains conflated into one class"],
  ];
  for (const [re, what] of must) {
    assert.ok(section.absent.some((a) => re.test(a)), `${what} must stay declared`);
  }
});

/* ------------------------------------------- the module, actually running */

test("the module builds the section, and the counts are the declared ones", () => {
  const { group, counts } = build();
  const C = section.counts;
  assert.equal(counts.facades, C.facades);
  assert.equal(counts.sharedEdges, C.sharedEdges);
  assert.equal(counts.stepWalls, C.stepWalls);
  assert.equal(counts.parapetRuns, C.parapetRuns);
  assert.equal(counts.copingRuns, C.parapetRuns, "every parapet run is capped");
  assert.equal(counts.commonRoomGlazing, C.commonRoomGlazing);
  assert.equal(counts.lanternOpenings, C.lanternOpenings);
  assert.equal(counts.screenWells, C.screenWells);
  assert.equal(counts.condensers, C.condensers);
  assert.equal(counts.bulkheads, C.bulkheads);
  assert.equal(counts.terracePlanters, C.terracePlanters);
  assert.equal(counts.terraceTrees, C.terracePlanters, "one tree per planter");
  assert.equal(counts.entranceLeaves, C.entranceLeaves);
  assert.equal(counts.stairRisersSourced, C.stairRisersSourced);
  assert.equal(counts.pv, 0, "zero panels, on either lid");

  /* The window total is RE-DERIVED from the facade table, not trusted. */
  let expect = 0;
  for (const f of section.facades) {
    if (f.system !== "field") continue;
    const rows = f.mass === "tower"
      ? section.grid.residentialRowsTower : section.grid.residentialRowsMid;
    const live = f.bays - (f.blankBays ? f.blankBays[1] - f.blankBays[0] : 0);
    expect += live * rows;
  }
  assert.equal(expect, C.windowsOnFieldFaces, "the declared window count is not the table's");
  assert.equal(counts.windows, expect + C.commonRoomGlazing);
  assert.equal(counts.goldFrames + counts.charcoalFrames, expect,
    "every field window wears exactly one picture frame");
  assert.ok(counts.goldFrames > 0 && counts.charcoalFrames > 0,
    "the gold/charcoal alternation is this elevation's strongest cue");
  assert.ok(counts.chimneyPanels <= C.chimneyPanelsMax && counts.chimneyPanels > 90,
    `chimneyPanels ${counts.chimneyPanels} is outside the declared ceiling`);

  /* The lantern terminates BOTH ends of the bar. */
  const L = section.lantern;
  assert.equal(counts.lanternOpenings,
    L.facetsTower.length * L.columnsPerFacet * L.rowsTower
    + L.facetsMid.length * L.columnsPerFacet * L.rowsMid);

  for (const n of ["pulse-facades", "pulse-roof", "pulse-terrace", "pulse-ground"]) {
    assert.ok(group.children.find((c) => c.name === n), `no ${n} group`);
  }
  const missing = createPhotoPulse(null, { photo: {}, heightAt: sloped, surfaceAt: sloped });
  assert.deepEqual(missing.counts, {}, "a missing section builds nothing and breaks nothing");
});

test("the facade tops out EXACTLY at the drawn deck, on the massing's own rule", () => {
  const { group } = build();
  group.updateMatrixWorld(true);
  const T = section.measured.masses.tower;
  const M = section.measured.masses.mid;
  /* Not re-derived from the module's maths: campus-massing.js roofElevation
     over the DRAWN ring and the DRAWN h — the rule the visible extrusion uses. */
  const towerRoof = roofElevation(T.ring, T.h, sloped);
  const midRoof = roofElevation(M.ring, M.h, sloped);
  let top = -Infinity;
  let checked = 0;
  each(group.getObjectByName("pulse-facades"), (x, y, z, box) => {
    top = Math.max(top, box.hi);
    checked++;
  });
  assert.ok(checked > 1200, `only ${checked} facade placements — the loops did not run`);
  assert.ok(Math.abs(top - towerRoof) <= 0.02,
    `the facade tops out at ${top.toFixed(3)} against the drawn deck ${towerRoof.toFixed(3)}`);
  /* The step is solved from the two drawn prisms, never assumed to be 3.1 m. */
  let stepBottom = Infinity;
  let stepTop = -Infinity;
  each(group.getObjectByName("pulse-facades"), (x, y, z, box, o) => {
    if (o.name !== "pulse-step-wall") return;
    stepBottom = Math.min(stepBottom, box.lo);
    stepTop = Math.max(stepTop, box.hi);
  });
  assert.ok(Math.abs(stepBottom - midRoof) < 0.02, "the step wall does not start at the Mid deck");
  assert.ok(Math.abs(stepTop - towerRoof) < 0.02, "the step wall does not reach the Tower deck");
});

test("the window box really is rotated six degrees, at the DERIVED opening width", () => {
  const { group } = build();
  group.updateMatrixWorld(true);
  const W = section.system.window;
  const D = section.draw;
  /* Measured off the built matrices, on the sourced north elevation only, so
     a rotation that got dropped or doubled cannot pass. */
  const f = section.facades.find((x) => x.id === "T-north-westBar");
  const L = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]);
  /* The normal is re-derived from the ring segment, exactly as the builder
     does: the section's stored `out` is rounded to four places and would put
     a 5e-5 wobble into every reading here. */
  const tx = (f.b[0] - f.a[0]) / L;
  const tz = (f.b[1] - f.a[1]) / L;
  const flip = tz * f.out[0] + -tx * f.out[1] < 0 ? -1 : 1;
  const nx = flip * tz;
  const nz = flip * -tx;
  const proudOf = (x, z) => (x - f.a[0]) * nx + (z - f.a[1]) * nz;
  const v = new THREE.Vector3();
  const m = new THREE.Matrix4();
  let checked = 0;
  let widest = 0;
  group.traverse((o) => {
    if (!o.isInstancedMesh || o.name !== "pulse-window") return;
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m);
      const cx = m.elements[12];
      const cz = m.elements[14];
      /* Only the windows on this face. */
      const along = (cx - f.a[0]) * (f.b[0] - f.a[0]) / L + (cz - f.a[1]) * (f.b[1] - f.a[1]) / L;
      if (along < 0 || along > L) continue;
      /* 1e-3, not 1e-9: instanceMatrix is a Float32Array and world coordinates
         here are ~200, so every reading carries ~5e-5 of float32 quantisation. */
      if (Math.abs(proudOf(cx, cz) - (D.windowStandoff + (W.width / 2) * Math.sin((W.rotationDeg * Math.PI) / 180))) > 1e-3) continue;
      const jambs = [-0.5, 0.5].map((t) => {
        v.set(t, 0, 0).applyMatrix4(m);
        return { proud: proudOf(v.x, v.z), x: v.x, z: v.z };
      }).sort((a, b) => a.proud - b.proud);
      assert.ok(Math.abs(jambs[0].proud - D.windowStandoff) < 1e-3,
        `the trailing jamb stands ${(jambs[0].proud - D.windowStandoff).toFixed(4)} m off flush`);
      assert.ok(Math.abs(jambs[1].proud - D.windowStandoff - W.projection) < 1e-3,
        `the leading jamb projects ${(jambs[1].proud - D.windowStandoff).toFixed(4)} m, not the derived ${W.projection}`);
      /* And the opening that got built is the DERIVED one: jamb to jamb. */
      widest = Math.max(widest, Math.hypot(jambs[1].x - jambs[0].x, jambs[1].z - jambs[0].z));
      checked++;
    }
  });
  assert.equal(checked, f.bays * section.grid.residentialRowsTower,
    "not every window on the sourced north elevation was measured");
  assert.ok(Math.abs(widest - W.width) < 2e-3,
    `the built opening measures ${widest.toFixed(4)} m, not the derived ${W.width}`);
});

test("nothing escapes the drawn footprint envelope — facades AND ground", () => {
  const { group } = build();
  group.updateMatrixWorld(true);
  const T = section.measured.masses.tower.ring;
  const M = section.measured.masses.mid.ring;
  const W = section.system.window;
  const CR = section.system.commonRoom;
  const FR = section.system.frame;
  /* The deepest a facade layer can be: the standoff, plus twice the leading
     jamb's swing, plus the picture frame's own projection. */
  const reach = section.draw.windowStandoff
    + 2 * (CR.glazingWidth / 2) * Math.sin((W.rotationDeg * Math.PI) / 180)
    + FR.proud;
  /* Bounded by the structure that carries the oversail: no dressing layer may
     stand further off the wall than the pier the facade sits on. That is a
     derived bound; the 0.55 m this line used to carry was a round number
     chosen to fit the old figures. */
  assert.ok(reach < section.groundStorey.colonnade.pierSize,
    `a facade layer would reach ${reach.toFixed(3)} m off the wall, past the ${section.groundStorey.colonnade.pierSize} m pier that carries it`);
  let worst = 0;
  let at2 = null;
  each(group.getObjectByName("pulse-facades"), (x, y, z, box, o) => {
    const d = Math.min(outside(x, z, T), outside(x, z, M));
    if (d > worst) { worst = d; at2 = o.name; }
  });
  assert.ok(worst <= reach + 0.02,
    `${at2} stands ${worst.toFixed(3)} m off both drawn rings`);

  /* THE GROUND GROUP, which used to be wholly ungated: a porch, a terrace and
     a flight legitimately stand outside the footprint, but only as far as the
     section's own derived envelope. */
  const env = section.groundStorey.envelope;
  let gWorst = 0;
  let gAt = null;
  const consider = (x, z, name) => {
    const d = Math.min(outside(x, z, T), outside(x, z, M));
    if (d > gWorst) { gWorst = d; gAt = name; }
  };
  each(group.getObjectByName("pulse-ground"), (x, y, z, box, o) => consider(x, z, o.name));
  /* The porch is a draped mesh: its VERTICES are what reach, not its centre. */
  group.getObjectByName("pulse-ground").traverse((o) => {
    if (o.name !== "ground-decal") return;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      consider(o.position.x + p.getX(i), o.position.z + p.getZ(i), "porch deck");
    }
  });
  assert.ok(gWorst <= env + 0.02,
    `${gAt} stands ${gWorst.toFixed(3)} m outside both rings, past the declared envelope ${env}`);
  assert.ok(gWorst > env / 2,
    "the envelope is far looser than anything built — derive it from what is actually there");
});

test("every roof item sits ON its own lid, and the clips are respected BY ABSENCE", () => {
  const { group } = build();
  group.updateMatrixWorld(true);
  const T = section.measured.masses.tower;
  const M = section.measured.masses.mid;
  const towerRoof = roofElevation(T.ring, T.h, sloped);
  const midRoof = roofElevation(M.ring, M.h, sloped);
  const decks = { tower: towerRoof, mid: midRoof };

  const items = [];
  for (const g of ["pulse-roof", "pulse-terrace"]) {
    each(group.getObjectByName(g), (x, y, z, box, o) => {
      if (o.name === "pulse-membrane") return;
      items.push({ x, y, z, box, name: o.name });
    });
  }
  assert.ok(items.length > 300, `only ${items.length} roof/terrace placements`);
  for (const it of items) {
    /* WHICH lid an item belongs to is decided by the ring it stands over, not
       by which deck its y happens to be nearest — a terrace tree is nearer
       the Tower deck in y and would have been checked against the wrong one. */
    const onT = inRing(it.x, it.z, T.ring);
    const onM = inRing(it.x, it.z, M.ring);
    assert.ok(onT || onM, `${it.name} at (${it.x.toFixed(1)}, ${it.z.toFixed(1)}) is off both lids`);
    assert.ok(!(onT && onM), `${it.name} stands over both rings — they must not overlap`);
    const deck = onT ? towerRoof : midRoof;
    assert.ok(it.box.lo >= deck - 0.02,
      `${it.name} dips ${(deck - it.box.lo).toFixed(2)} m into the mass below it`);
    const ceiling = onT
      ? towerRoof + section.roof.screenWells.height
      : midRoof + section.terrace.treeHeight + section.terrace.planterSize[1]
        + section.terrace.paverThickness + section.draw.membraneLift;
    assert.ok(it.box.hi <= ceiling + 0.02,
      `${it.name} tops out at ${it.box.hi.toFixed(2)}, above its lid's ${ceiling.toFixed(2)}`);
  }
  /* THE CLIPS, checked by absence, at the section's own derived probe clear. */
  for (const c of section.roof.clips.forbidden) {
    const ring = section.measured.masses[c.mass].ring;
    const b = bbox(ring);
    const [px, pz] = c.probe;
    assert.ok(px >= b.x0 && px <= b.x1 && pz >= b.z0 && pz <= b.z1,
      `${c.id}: the probe is not even inside the ${c.mass} bounding box, so it proves nothing`);
    assert.ok(!inRing(px, pz, ring), `${c.id}: the probe is inside the ${c.mass} ring`);
    let near = Infinity;
    for (const it of items) {
      /* The parapet and its coping ARE the ring's boundary — they are placed
         ON the edge by definition and are always within a metre or two of any
         probe just outside it. The clip rule governs what is placed on the
         LID, and that is what this absence sweep looks at. */
      if (it.name === "pulse-parapet" || it.name === "pulse-coping") continue;
      if (Math.abs(it.y - decks[c.mass]) > 2.5) continue;
      near = Math.min(near, Math.hypot(it.x - px, it.z - pz));
    }
    assert.ok(near > section.roof.clips.probeClear,
      `${c.id}: a ${c.mass} item stands ${near.toFixed(2)} m from a clipped probe`);
    assert.ok(c.why && c.why.length > 40, `${c.id} does not say why it is clipped`);
  }
  assert.ok(Math.abs(section.roof.clips.probeClear - section.roof.vents.pitch / 2) < 1e-9,
    "the probe clearance is half the vent pitch — derive it, do not pick it");
  /* No PV geometry of any kind exists. */
  let pv = 0;
  group.traverse((o) => { if (/pv|panel-array|solar/i.test(o.name)) pv++; });
  assert.equal(pv, 0, "something PV-shaped got built");
});

/**
 * NOTHING INTERSECTS. This gate did not exist, and an audit found three real
 * interpenetrations behind it: a walk pad driven 0.82 m through a bulkhead, a
 * vent grown 0.36 m through a walk pad, and two coplanar pad runs overlapping
 * 0.57 m at the dog-leg corner. Every pair of roof and terrace placements is
 * swept, oriented, in plan and in height.
 */
test("no two roof or terrace items interpenetrate", () => {
  const { group } = build();
  group.updateMatrixWorld(true);
  const items = [];
  for (const g of ["pulse-roof", "pulse-terrace"]) {
    each(group.getObjectByName(g), (x, y, z, box, o, i) => {
      if (o.name === "pulse-membrane") return;
      items.push({ name: o.name, idx: i, ...box });
    });
  }
  assert.ok(items.length > 300, `only ${items.length} placements swept`);
  const tol = section.draw.skirtOffset;
  let worst = 0;
  let pair = null;
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      /* One small multi-stem tree is three crowns that deliberately merge
         into one canopy — that is the object, not a collision. */
      if (a.name === "pulse-tree-crown" && b.name === "pulse-tree-crown") continue;
      const dy = Math.min(a.hi, b.hi) - Math.max(a.lo, b.lo);
      if (dy <= tol) continue;
      const pen = Math.min(penetration(a.rect, b.rect), dy);
      /* Two runs of the same boundary band MITRE at a ring corner: that is
         one continuous parapet turning, and the most two boxed runs can share
         is the band's own thickness. Anything past that is a real collision,
         and every other pair in the sweep gets no allowance at all. */
      const mitre = a.name === b.name
        && (a.name === "pulse-parapet" || a.name === "pulse-coping");
      const allow = mitre
        ? section.roof.parapet.thickness + 2 * section.roof.parapet.copingOversail
        : tol;
      if (pen > allow) { worst = Math.max(worst, pen); pair = [a.name, b.name]; }
    }
  }
  assert.equal(worst, 0,
    `${pair?.[0]} and ${pair?.[1]} interpenetrate by ${worst.toFixed(3)} m`);
});

test("the terrace is CLIPPED to the drawn lid, not built at its sourced depth", () => {
  const { group } = build();
  group.updateMatrixWorld(true);
  const M = section.measured.masses.mid;
  const T = section.terrace;
  const half = T.paver / 2;
  const rot = (T.paverRotationDeg * Math.PI) / 180;
  let pavers = 0;
  let east = -Infinity;
  let minClear = Infinity;
  let size = 0;
  each(group.getObjectByName("pulse-terrace"), (x, y, z, box, o) => {
    if (o.name !== "pulse-paver") return;
    pavers++;
    east = Math.max(east, x);
    size = Math.max(size, Math.hypot(box.rect.ux, box.rect.uz) * 2);
    for (const [dx, dz] of [[half, half], [half, -half], [-half, half], [-half, -half]]) {
      const px = x + dx * Math.cos(rot) - dz * Math.sin(rot);
      const pz = z + dx * Math.sin(rot) + dz * Math.cos(rot);
      assert.ok(inRing(px, pz, M.ring), "a paver corner hangs off the drawn Mid lid");
      minClear = Math.min(minClear, edgeDistance(px, pz, M.ring));
    }
  });
  assert.ok(pavers > 150, `only ${pavers} pavers — the terrace did not build`);
  /* The paver that got BUILT is the 24-inch product the section derives, and
     the grid really is on the diagonal — both were ungated while the section
     merely stated them. */
  assert.ok(Math.abs(size - T.paver) < 1e-3, `the built paver is ${size.toFixed(4)} m`);
  assert.ok(Math.abs(Math.abs(Math.atan2(-1, 1) * 180 / Math.PI) - 45) < 1e-9);
  each(group.getObjectByName("pulse-terrace"), (x, y, z, box, o) => {
    if (o.name !== "pulse-paver") return;
    const deg = (Math.atan2(-box.rect.uz, box.rect.ux) * 180) / Math.PI;
    assert.ok(Math.abs(((deg % 90) + 90) % 90 - T.paverRotationDeg) < 0.01,
      `a paver is laid at ${deg.toFixed(2)} deg, not the declared ${T.paverRotationDeg}`);
  });
  assert.ok(east <= T.xEast + 0.01, "the terrace runs east of its declared extent");
  assert.ok(minClear >= T.edgeClear - 1e-6,
    `a paver corner comes within ${minClear.toFixed(3)} m of the ring edge, inside the parapet`);
  /* The clip is the POINT: the sourced depth does not fit the drawn lid. */
  assert.match(T.clipNote, /CLIPPED/);
  assert.ok(T.sourced.depth > 5.85, "the clip note only makes sense if the source overruns");
  /* And the sourced extent is not dead data: xEast is derived FROM it. */
  assert.ok(Math.abs(T.xEast - (M.ring[1][0] + T.sourced.uFrac * 48.7)) < 5e-4,
    "the terrace's east limit must be its own sourced fraction of the measured face");
  /* And the withheld long element really is withheld. */
  assert.equal(T.longElement.built, false);
  let longs = 0;
  group.traverse((o) => {
    if (!o.isInstancedMesh) return;
    if (/pergola|table|long/i.test(o.name)) longs++;
  });
  assert.equal(longs, 0, "the unresolved long element must not be built");
});

test("the ground storey seats on the surface, or on the structure that carries it", () => {
  for (const [label, g] of [["synthetic", sloped], ["the drawn terrain", drawn]]) {
    const { group } = build(g);
    group.updateMatrixWorld(true);
    const ffl = roofElevation(section.measured.masses.tower.ring,
      section.measured.masses.tower.h, g) - section.measured.masses.tower.h;
    const D = section.draw;
    /* Two seating rules, and which one applies is the point. The entry
       terrace and the flight MEET THE GROUND and must reach through it. The
       piers, the guard and the handrails stand ON the terrace, whose top is
       the L1 floor — an earlier revision seated the pickets on the terrain
       and floated them 0.51 m over nothing. */
    const onGround = new Set(["pulse-entry-terrace", "pulse-stair-solid"]);
    const onStructure = new Set(["pulse-pier", "pulse-guard-post", "pulse-guard-rail"]);
    let ground = 0;
    let structure = 0;
    /* The surface UNDER an item, not merely at its centre: a seated solid is
       carried past the lowest ground its own footprint covers, and on a
       rolling sampler the centre reading is not that. */
    const under = (box) => {
      const r = box.rect;
      let lo = Infinity;
      for (const [su, sv] of [[0, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const h = g(r.x + r.ux * su + r.vx * sv, r.z + r.uz * su + r.vz * sv);
        if (Number.isFinite(h) && h < lo) lo = h;
      }
      return lo;
    };
    each(group.getObjectByName("pulse-ground"), (x, y, z, box, o) => {
      const s = g(x, z);
      if (onGround.has(o.name)) {
        assert.ok(box.lo <= s + 0.02,
          `${label}: ${o.name} bottom ${box.lo.toFixed(2)} floats over the surface ${s.toFixed(2)}`);
        assert.ok(box.lo >= Math.min(under(box), ffl) - D.buryDepth - 0.02,
          `${label}: ${o.name} plunges to ${box.lo.toFixed(2)} — a runaway skirt`);
        ground++;
      }
      if (onStructure.has(o.name)) {
        assert.ok(box.lo >= ffl - D.seatEmbed - 1e-6,
          `${label}: ${o.name} bottom ${box.lo.toFixed(2)} hangs below the deck it stands on (${ffl.toFixed(2)})`);
        structure++;
      }
      assert.ok(y > Math.min(s, ffl) - 6 && y < Math.max(s, ffl) + 6,
        `${label}: ${o.name} at (${x.toFixed(1)}, ${z.toFixed(1)}) is ${(y - s).toFixed(1)} m off the ground`);
    });
    assert.ok(ground > 20, `${label}: only ${ground} ground-seated placements checked`);
    assert.ok(structure > 300, `${label}: only ${structure} structure-seated placements checked`);

    /* The entry terrace is a CLOSED raised deck: its top is the L1 floor
       everywhere and its underside reaches the drawn surface everywhere, so
       there is no gap under it and no lip above it. */
    let tops = [];
    each(group.getObjectByName("pulse-ground"), (x, y, z, box, o) => {
      if (o.name === "pulse-entry-terrace") tops.push(box.hi);
    });
    assert.ok(tops.length > 20, `${label}: the entry terrace did not build`);
    for (const t of tops) {
      assert.ok(Math.abs(t - ffl) < 1e-6,
        `${label}: an entry-terrace segment tops out at ${t.toFixed(3)}, not the L1 floor ${ffl.toFixed(3)}`);
    }

    /* The draped porch follows the terrain instead of seating flat. */
    let decks = 0;
    group.getObjectByName("pulse-ground").traverse((o) => {
      if (o.name !== "ground-decal") return;
      decks++;
      const p = o.geometry.attributes.position;
      let lo = Infinity;
      let hi = -Infinity;
      for (let i = 0; i < p.count; i++) {
        const d = (o.position.y + p.getY(i)) - g(o.position.x + p.getX(i), o.position.z + p.getZ(i));
        lo = Math.min(lo, d);
        hi = Math.max(hi, d);
      }
      assert.ok(lo > -0.02 && hi < 0.5,
        `${label}: the porch deck drifts ${lo.toFixed(2)}..${hi.toFixed(2)} m off the drawn terrain`);
    });
    assert.equal(decks, section.groundStorey.porch.faces.length,
      "one draped porch deck per declared face");
  }
});

/**
 * THE FLIGHT. Its every riser used to sit under the ground: the top tread was
 * put AT the drawn base and the six sourced risers descended from there, so
 * on flat terrain risers 1-5 were 0.15-0.75 m below grade and the handrails
 * floated over nothing. It is now solved against the drawn surface, and this
 * is the gate that says so — including on the terrain that ships, where the
 * flight has to be visible rather than merely legal.
 */
test("the exterior flight stands above the drawn surface, and its top is the L1 floor", () => {
  const ST = section.groundStorey.stair;
  const NT = section.groundStorey.northTerrace;
  for (const [label, g] of [["synthetic", sloped], ["the drawn terrain", drawn]]) {
    const { group, counts } = build(g);
    group.updateMatrixWorld(true);
    const T = section.measured.masses.tower;
    const ffl = roofElevation(T.ring, T.h, g) - T.h;
    const risers = [];
    each(group.getObjectByName("pulse-ground"), (x, y, z, box, o) => {
      if (o.name === "pulse-stair-solid") risers.push({ x, z, ...box });
    });
    assert.equal(risers.length, counts.stairRisersBuilt);
    assert.ok(risers.length <= ST.risersSourced,
      `${label}: ${risers.length} risers built, more than the ${ST.risersSourced} the photograph shows`);
    for (const r of risers) {
      const s = g(r.x, r.z);
      assert.ok(r.hi >= s - 0.02,
        `${label}: a riser tops out at ${r.hi.toFixed(2)}, BELOW the drawn surface ${s.toFixed(2)} — the whole flight is underground`);
      assert.ok(r.hi <= ffl - ST.rise + 1e-6,
        `${label}: a riser tops out above the L1 floor`);
      assert.ok(r.lo <= s + 0.02, `${label}: a riser hangs over the surface`);
    }
    if (risers.length) {
      const highest = Math.max(...risers.map((r) => r.hi));
      assert.ok(Math.abs(highest - (ffl - ST.rise)) < 1e-6,
        `${label}: the flight's top tread is not one riser below the L1 floor`);
      /* Handrails exist only where there is a flight, and they follow it. */
      assert.equal(counts.handrails, ST.handrails, `${label}: a flight without its handrails`);
      each(group.getObjectByName("pulse-ground"), (x, y, z, box, o) => {
        if (o.name !== "pulse-handrail") return;
        const s = g(x, z);
        assert.ok(box.lo > Math.min(s, ffl) - 0.1 && box.lo < ffl + ST.handrailHeight,
          `${label}: a handrail at ${box.lo.toFixed(2)} is not over its own flight`);
      });
    } else {
      assert.equal(counts.handrails, 0,
        `${label}: handrails were drawn over a flight that does not exist`);
    }
  }
  /* On the terrain that actually ships, the flight must genuinely be there —
     otherwise this gate is checking an empty set. */
  const shippedBuild = build(drawn);
  assert.ok(shippedBuild.counts.stairRisersBuilt >= 1,
    "the drawn terrain supports no riser at all — the whole flight system is invisible where it ships");
  assert.equal(shippedBuild.counts.handrails, ST.handrails);
  /* And the guard opens for it. */
  assert.ok(shippedBuild.counts.guardPickets > 0);
  assert.ok(shippedBuild.counts.guardPickets < Math.ceil(48.7 / NT.picketPitch) + 1,
    "the picket guard does not open over the flight");
  assert.match(ST.station, /SOLVED/, "the flight's station must declare that it is solved");
  assert.match(ST.risersNote, /EPOCH/i,
    "the difference between the sourced six risers and the built count is an epoch conflict and must say so");
});

test("the building has a door, and it is the only opening claimed", () => {
  const { group, counts } = build(drawn);
  group.updateMatrixWorld(true);
  const E = section.groundStorey.entrance;
  assert.equal(counts.entranceLeaves, E.leaves, "the colonnade entrance did not build");
  const ffl = roofElevation(section.measured.masses.tower.ring,
    section.measured.masses.tower.h, drawn) - section.measured.masses.tower.h;
  let seen = 0;
  each(group.getObjectByName("pulse-ground"), (x, y, z, box, o) => {
    if (o.name !== "pulse-entrance-leaf") return;
    seen++;
    assert.ok(Math.abs(box.lo - ffl) < 1e-6, "a door leaf does not stand on the L1 floor");
    assert.ok(Math.abs(box.hi - (ffl + E.height)) < 1e-6, "a door leaf is not its derived height");
  });
  assert.equal(seen, E.leaves);
  /* It is an [estimated] extension of the sourced storefront, and it says so. */
  assert.match(E.source, /\[estimated\]/);
  assert.ok(section.estimates["groundStorey.entrance.leafWidth"].extends.includes("panel"),
    "the leaf width must record that it extends the storefront's own module");
  /* Every other opening stays declared absent, by name. */
  assert.ok(section.absent.some((a) => /SERVICE DOOR/i.test(a)),
    "the photographed service door, whose face is unresolved, must stay declared");
});

test("nothing invented sits inside another measured building's footprint", () => {
  const { group } = build();
  group.updateMatrixWorld(true);
  /* Pulse's own OSM ring is excluded: the colonnade, the stair and the porch
     belong to this building and stand on and beside its own footprint. */
  const others = campus.buildings.filter((b) => b.p && b.p.length >= 3 && !/^Pulse$/i.test(b.n || ""));
  const pts = [];
  each(group.getObjectByName("pulse-ground"), (x, y, z) => pts.push([x, z]));
  group.getObjectByName("pulse-ground").traverse((o) => {
    if (o.name === "ground-decal") pts.push([o.position.x, o.position.z]);
  });
  for (const [x, z] of pts) {
    for (const b of others) {
      assert.ok(!inRing(x, z, [...b.p, b.p[0]]),
        `(${x.toFixed(1)}, ${z.toFixed(1)}) is inside ${b.n || "an unnamed mass"}`);
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
        ...Array.from(o.geometry.attributes.position.array)]);
    });
    return out;
  };
  assert.deepEqual(sig(a), sig(b));
});

test("the material library is on the surfaces, and only deterministic sources", () => {
  const src = readFileSync(join(root, "docs/js/campus-photo-pulse.js"), "utf8");
  assert.match(src, /createMaterialLibrary/, "surfaces come from campus-materials.js");
  assert.ok(!/Math\.random|Date\.now|new Date/.test(src), "no nondeterminism in the builder");
  /* Colours are DATA: no hex literal may appear in the module. */
  assert.ok(!/#[0-9a-fA-F]{6}\b/.test(src.replace(/^\s*\/\/.*$/gm, "")),
    "a colour literal leaked into the builder — colours are data");
  const { group } = build();
  let textured = 0;
  let glass = 0;
  group.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    if (o.material.map && o.material.roughnessMap) textured++;
    if (o.material.transparent && o.material.opacity < 1) glass++;
  });
  assert.ok(textured >= 25, `only ${textured} textured meshes — the library is not applied`);
  assert.ok(glass >= 3, "the glazing does not carry the library's glass");
  /* The colonnade recess and the breezeway are photographed VOIDS. */
  for (const name of ["pulse-recess", "pulse-breezeway"]) {
    let mesh = null;
    group.traverse((o) => { if (o.name === name) mesh = o; });
    assert.ok(mesh, `no ${name} mesh`);
    assert.ok(!mesh.material.transparent && mesh.material.roughness >= 0.9,
      `${name} must be a matte opaque void, not glazing`);
  }
  /* Instancing: these are ten- and nine-storey elevations. */
  let instances = 0;
  let meshes = 0;
  group.traverse((o) => {
    if (o.isInstancedMesh) instances += o.count;
    else if (o.isMesh) meshes++;
  });
  assert.ok(instances > 1500, `only ${instances} instances`);
  assert.ok(meshes < 60, `${meshes} individual meshes — repeats must be instanced`);
});
