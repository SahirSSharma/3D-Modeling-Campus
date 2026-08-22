/* Pacific Hall — INVENTED class, R5 batch, a NEW section.
 *
 * WHAT THIS SUITE EXISTS TO HOLD. The section makes six claims a later edit
 * could quietly undo, and each has a gate written against the claim rather
 * than against the number:
 *
 *   - THE FACADE CLOSES AT THE PARAPET AND NOWHERE ELSE. Every published
 *     height on this building (massHeights 33.2, heights 33.9) measures the
 *     rooftop mechanical penthouse; the real coping is 3.94 m lower. The
 *     reconciliation is recomputed here from the shipped ring and the shipped
 *     terrain grid — rim median, p98, the stepped-slab guard — and then the
 *     BUILD is checked: nothing but the penthouse may have a vertex above
 *     51.26, and nothing at all may reach the drawn prism's 55.2 lid.
 *
 *   - PACIFIC IS TWO PLATES, NOT ONE PRISM. The wing probe box must
 *     PARTITION the surveyed ring: main + wing area equals ring area, no
 *     roof is drawn twice and none is drawn at neither height, and the clip
 *     line carries the 8.82 m step wall.
 *
 *   - THERE IS ONE BAY DIMENSION AND IT IS MEASURED. The bay rule is
 *     re-run here per run off the shipped ring: ten bays of 6.48 m on the
 *     surveyed south face, every other run's module inside the band its own
 *     bay count implies, and exactly one opening per measured half-module
 *     everywhere.
 *
 *   - THE RUN TABLE TILES THE WHOLE RING. Contiguously, with no gap and no
 *     overlap, so no surveyed face can quietly stop being treated — which is
 *     the ultra standard's own rule in machine-readable form.
 *
 *   - EVERY FIGURE RECOMPUTES AND EVERY READING UNDER IT IS PINNED. The
 *     axiom-gate apparatus (tests/helpers/axiom-gate.mjs) runs here, never
 *     forked; the repo reads are RE-READ from the shipped files, the ring
 *     reads are RECOMPUTED from the shipped ring (both circle fits included),
 *     and every EPT and pixel literal is pinned in THIS file.
 *
 *   - PROVENANCE LIVES IN THE MESH NAMES. The two arcs and the straight
 *     south face are -sourced; the north, east and wing faces are
 *     -estimated because no photograph of them exists on any rung; the
 *     laser's planes are -measured. Every one of those distinctions is a
 *     suffix a render alone can show.
 *
 * The section ships under the `pacific` key of docs/data/campus-photo-detail.json
 * once main merges Revelle-College-Sources/merge/r5/pacific.json.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as THREE from "../docs/vendor/three/three.module.min.js";
import { createPhotoPacific } from "../docs/js/campus-photo-pacific.js";
import { makeSurfaceSampler } from "../docs/js/campus-terrain.js";
import { OVERLAY, overlayLift } from "../docs/js/campus-overlay.js";
import {
  assertCoverage, assertEstimateBands, assertPins, assertRelations,
  assertTierSymmetry, assertAbsentEntries, assertExprs,
} from "./helpers/axiom-gate.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(p, "utf8"));

const shipped = read(process.env.PHOTO_DETAIL || join(root, "docs/data/campus-photo-detail.json"));
const section = shipped.pacific;
const t = test;

const campus = read(join(root, "docs/data/campus-3d.json"));
const lidar = read(join(root, "docs/data/campus-lidar.json"));
const arcgis = read(join(root, "docs/data/campus-arcgis.json"));
const campusColors = read(join(root, "docs/data/campus-colors.json"));
const truecolor = read(join(root, "docs/data/campus-truecolor.json"));
const manifest = read(join(root, "docs/data/textures/manifest.json"));

const moduleSrc = readFileSync(join(root, "docs/js/campus-photo-pacific.js"), "utf8");
/* Gates that grep for forbidden constructs run on the CODE, not the prose. */
const moduleCode = moduleSrc
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/[^\n]*$/gm, "");

const near = (a, b, eps, what) =>
  assert.ok(typeof a === "number" && Math.abs(a - b) <= eps,
    `${what}: ${a} vs ${b} (tolerance ${eps})`);

const MASS = 446;
const MKEY = "m:-92,234";
const OSM = 78;

const flat = () => 20;
const slope = (x, z) => 20 + 1.9 * Math.sin(x / 9) + 1.5 * Math.cos(z / 12);
const drawn = makeSurfaceSampler(lidar.terrain);
const build = (g = drawn) =>
  createPhotoPacific(null, { photo: { pacific: section }, heightAt: g, surfaceAt: g });

const div10 = (r) => r.map(([x, z]) => [x / 10, z / 10]);
const closedRing = section ? section.measured.building.ring : [];
const ring = closedRing.slice(0, -1);

const ringArea = (r) => {
  let a = 0;
  for (let i = 0; i < r.length; i++) {
    const b = r[(i + 1) % r.length];
    a += r[i][0] * b[1] - b[0] * r[i][1];
  }
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
const segLen = (i) => Math.hypot(ring[(i + 1) % ring.length][0] - ring[i][0],
  ring[(i + 1) % ring.length][1] - ring[i][1]);
const runLen = (v0, v1) => { let s = 0; for (let i = v0; i < v1; i++) s += segLen(i); return s; };

/** Kasa least-squares circle, re-run here so the fit is never taken on trust. */
function kasa(pts) {
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p[0], 0) / n;
  const mz = pts.reduce((s, p) => s + p[1], 0) / n;
  let Suu = 0, Suv = 0, Svv = 0, Suuu = 0, Svvv = 0, Suvv = 0, Svuu = 0;
  for (const [x, z] of pts) {
    const u = x - mx, v = z - mz;
    Suu += u * u; Suv += u * v; Svv += v * v;
    Suuu += u * u * u; Svvv += v * v * v; Suvv += u * v * v; Svuu += v * u * u;
  }
  const det = Suu * Svv - Suv * Suv;
  const cx = (((Suuu + Suvv) / 2) * Svv - Suv * ((Svvv + Svuu) / 2)) / det + mx;
  const cz = (Suu * ((Svvv + Svuu) / 2) - ((Suuu + Suvv) / 2) * Suv) / det + mz;
  const r = pts.reduce((s, p) => s + Math.hypot(p[0] - cx, p[1] - cz), 0) / n;
  const rms = Math.sqrt(pts.reduce((s, p) => s + (Math.hypot(p[0] - cx, p[1] - cz) - r) ** 2, 0) / n);
  return { cx, cz, r, rms };
}

/** Every mesh's world bbox, with instanced meshes expanded per instance. */
function eachPlacement(node, fn) {
  node.updateMatrixWorld(true);
  const m = new THREE.Matrix4();
  node.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.computeBoundingBox();
    const base = o.geometry.boundingBox;
    const mats = o.isInstancedMesh
      ? Array.from({ length: o.count }, (_, i) => {
        o.getMatrixAt(i, m);
        return o.matrixWorld.clone().multiply(m.clone());
      })
      : [o.matrixWorld];
    for (const mat of mats) {
      const bb = base.clone().applyMatrix4(mat);
      fn({
        name: o.name, mesh: o,
        xLo: bb.min.x, xHi: bb.max.x, yLo: bb.min.y, yHi: bb.max.y,
        zLo: bb.min.z, zHi: bb.max.z,
        x: (bb.min.x + bb.max.x) / 2, z: (bb.min.z + bb.max.z) / 2,
      });
    }
  });
}

/** Every vertex of every mesh, in world coordinates, instances expanded. */
function eachVertex(node, fn) {
  node.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  const m = new THREE.Matrix4();
  node.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry.getAttribute("position");
    const mats = o.isInstancedMesh
      ? Array.from({ length: o.count }, (_, i) => {
        o.getMatrixAt(i, m);
        return o.matrixWorld.clone().multiply(m.clone());
      })
      : [o.matrixWorld];
    for (const mat of mats) {
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(mat);
        fn(v.x, v.y, v.z, o.name);
      }
    }
  });
}

/** Instance origins, decomposed from each InstancedMesh matrix. */
function eachInstance(node, fn) {
  node.updateMatrixWorld(true);
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  node.traverse((o) => {
    if (!o.isInstancedMesh) return;
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m);
      m.decompose(p, q, s);
      fn(p.x, p.y, p.z, o.name, i);
    }
  });
}

/**
 * A run's own frame, derived here from the section's ring and run table so
 * the station gate does not take the module's `at()` on trust. Same walk
 * the builder uses: u along the shipped polyline, w proud along the run's
 * own per-edge outward normal.
 */
function stationFrame(open, v0, v1, ccw) {
  const n = open.length;
  const edges = [];
  let u = 0;
  for (let i = v0; i < v1; i++) {
    const a = open[i % n];
    const b = open[(i + 1) % n];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!(L > 0)) continue;
    const tx = (b[0] - a[0]) / L;
    const tz = (b[1] - a[1]) / L;
    const sgn = ccw ? 1 : -1;
    edges.push({
      u0: u, u1: u + L, L, ax: a[0], az: a[1],
      tx, tz, nx: sgn * tz, nz: -sgn * tx,
    });
    u += L;
  }
  const edgeAt = (uu) => {
    for (const e of edges) if (uu <= e.u1 + 1e-9) return e;
    return edges[edges.length - 1];
  };
  return {
    edges, length: u, edgeAt,
    at(uu, w) {
      const e = edgeAt(uu);
      const d = uu - e.u0;
      return { x: e.ax + e.tx * d + e.nx * w, z: e.az + e.tz * d + e.nz * w };
    },
  };
}

/**
 * Built-placement stations, derived INDEPENDENTLY from the section's own
 * figures. Audit F1 / p101 Gate 1: a 0.5 m planar slide that keeps counts
 * and containment must still fail.
 */
function stations() {
  const P = section.system.penthouse;
  const D = section.draw;
  const S = section.system;
  const BAY = S.bay;
  const FA = S.facade;
  const proj = S.awning.projection;
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const b = ring[(i + 1) % ring.length];
    area += ring[i][0] * b[1] - b[0] * ring[i][1];
  }
  const ccw = area > 0;
  const stacks = [];
  for (let i = 0; i < P.stackCount; i++) {
    stacks.push({
      x: P.x0 + ((i + 0.5) * (P.x1 - P.x0)) / P.stackCount,
      z: (P.z0 + P.z1) * 0.5,
    });
  }
  const awnings = [];
  for (const run of S.runs) {
    const frame = stationFrame(ring, run.v0, run.v1, ccw);
    if (!frame.edges.length) continue;
    const bays = run.kind === "return" || frame.length < BAY.module
      ? 0
      : Math.max(1, Math.round(frame.length / BAY.module));
    if (!bays) continue;
    const module = frame.length / bays;
    const perBay = Math.max(1, Math.round(module / BAY.halfModule));
    const slot = module / perBay;
    for (let k = 0; k < bays * perBay; k++) {
      const here = run.tier === "sourced" && (run.kind === "arc"
        || Math.floor(k / perBay) < FA.awningExtraBays
        || Math.floor(k / perBay) >= bays - FA.awningExtraBays);
      if (!here) continue;
      const p = frame.at((k + 0.5) * slot, D.wallOffset + proj / 2);
      awnings.push({ x: p.x, z: p.z });
    }
  }
  return { stacks, awnings, wallOffset: D.wallOffset, ccw };
}

/* ------------------------------------------------------------ the section */

t("the section exists and carries the whole ultra apparatus", () => {
  for (const k of ["label", "epoch", "note", "seedNote", "bounds", "boundsNote", "sources",
    "measured", "derivations", "estimates", "reads", "draw", "system", "colors",
    "colorSources", "colorSourcesNote", "colorNote", "samples", "counts", "conflicts",
    "supersedes", "supersededNote", "superseded", "absent"]) {
    assert.ok(section[k] !== undefined, `section is missing ${k}`);
  }
  /* No seed: nothing here is irregular, so a seed would be a declared input
     nothing consumes — the inert-apparatus finding from the R4 audit. */
  assert.equal(section.seed, undefined,
    "a seed has appeared; if anything is now irregular it must be consumed and gated, and if not it is inert apparatus");
  assert.match(section.seedNote, /byte-identical/i);
});

t("it says what it is: the parapet, the two plates, and the object that owns the 33.2", () => {
  assert.match(section.label, /MEASURED PARAPET repo 51\.26/);
  assert.match(section.label, /4-STOREY NORTH WING/);
  assert.match(section.label, /TRUE CIRCULAR SOUTH ARCS/);
  assert.match(section.label, /rooftop mechanical spine/i);
  assert.match(section.note, /INVENTED/);
  assert.match(section.epoch, /2014 LiDAR|2014 laser/);
  assert.match(section.epoch, /NO ORTHO-DERIVED HEIGHT SHIPS/i);
  assert.match(section.epoch, /CONSTRUCTION DATE AND ARCHITECT ARE UNKNOWN/i,
    "the one thing the whole ladder failed to find must be in the epoch line, not only in absent[]");
  assert.match(section.boundsNote, /\+z is SOUTH/);
});

t("every source is described and dated, and the load-bearing ones are cited", () => {
  assert.ok(section.sources.length >= 12, `only ${section.sources.length} sources`);
  for (const s of section.sources) {
    assert.ok(s.length >= 80, `source is not described: ${s.slice(0, 70)}`);
    assert.match(s, /\b(19|20)\d\d\b/, `source has no date: ${s.slice(0, 70)}`);
  }
  const joined = section.sources.join("\n");
  for (const must of [
    /campus-arcgis\.json/, /campus-lidar\.json/, /campus-3d\.json/,
    /campus-truecolor\.json/, /campus-colors\.json/,
    /chunk_4_6\.jpg/, /CA_SanDiegoQL2_2014/,
    /flickr-4660991701/, /sailorgroup\.ucsd\.edu/,
    /UCRegents_2015-07-21_GB7/, /plandesignbuild\.ucsd\.edu/,
    /oceanlight/, /6oSGgcyjj7IxrkKs3epyHw/, /g97OSO0uHL61KLV9hPdP6Q/,
  ]) {
    assert.match(joined, must, `the source list no longer cites ${must}`);
  }
  /* The verified negatives are a climbed rung and are part of the record. */
  assert.match(joined, /VERIFIED NEGATIVES?/i);
  assert.match(joined, /Muir Biology.*Pacific Hall.*FALSE/is,
    "the rename hypothesis was disproved and the disproof must not be lost");
});

/* -------------------------------------------------------- the survey data */

t("Pacific's ring is arcgis.massing[446], byte for byte, with its own keys", () => {
  const m = arcgis.massing[MASS];
  assert.equal(m.n, "Pacific Hall");
  const survey = div10(m.r[0]);
  assert.deepEqual(closedRing, survey,
    "the carried ring is not arcgis.massing[446].r[0] at /10 — the plan is the survey's and is carried verbatim");
  assert.equal(closedRing.length, 104);
  assert.deepEqual(closedRing[0], closedRing[closedRing.length - 1], "the ring must close");

  /* The m: key campus-massing.js addresses this mass by, recomputed. */
  /* campus-massing.js's centroidOf is the vertex MEAN over r[0] exactly as
     shipped — closing duplicate included. Dropping that vertex moves the key
     to m:-93,234 and the mass loses its LiDAR height silently. */
  const cx = closedRing.reduce((s, p) => s + p[0], 0) / closedRing.length;
  const cz = closedRing.reduce((s, p) => s + p[1], 0) / closedRing.length;
  assert.equal(section.measured.building.mKey, MKEY);
  assert.equal(`m:${Math.round(cx)},${Math.round(cz)}`, MKEY,
    "the mKey no longer recomputes from the ring's own vertex mean");

  near(section.measured.building.areaM2, ringArea(ring), 5e-3, "the declared shoelace area");
  const B = section.measured.building.bbox;
  near(B.x0, Math.min(...ring.map((p) => p[0])), 5e-3, "bbox x0");
  near(B.x1, Math.max(...ring.map((p) => p[0])), 5e-3, "bbox x1");
  near(B.z0, Math.min(...ring.map((p) => p[1])), 5e-3, "bbox z0");
  near(B.z1, Math.max(...ring.map((p) => p[1])), 5e-3, "bbox z1");

  assert.equal(section.measured.building.massHeight, lidar.massHeights[MKEY]);
  assert.equal(section.measured.building.heightsLabel, lidar.heights["Pacific Hall"]);
  assert.equal(section.measured.building.arcgisH, m.h);
  assert.equal(section.measured.building.levels, m.levels);
  assert.equal(section.measured.building.osmH, campus.buildings[OSM].h);
});

t("every owned ground ring is the survey's, verbatim, by literal index", () => {
  const owned = section.measured.groundRings.owned;
  assert.ok(owned.length >= 3, "the owned ground list has shrunk");
  for (const r of owned) {
    const src = arcgis.ground[r.index];
    assert.ok(src, `arcgis.ground#${r.index} does not exist — an index was renumbered`);
    assert.equal(r.kind, src.k, `#${r.index} kind`);
    assert.deepEqual(r.rings, src.r.map(div10),
      `#${r.index} is not the survey's ring at /10 — ground rings are carried verbatim`);
    /* No owned ground ring may intrude into the building's own footprint. */
    const R0 = r.rings[0];
    const X = R0.map((p) => p[0]);
    const Z = R0.map((p) => p[1]);
    for (let x = Math.min(...X); x <= Math.max(...X); x += 1) {
      for (let z = Math.min(...Z); z <= Math.max(...Z); z += 1) {
        if (!inRing(x, z, R0)) continue;
        assert.equal(inRing(x, z, ring), false,
          `ground ring #${r.index} covers (${x}, ${z}), which is inside Pacific's own footprint`);
      }
    }
  }
  /* And the boundary declaration is what stops an R5 sibling colliding. */
  const notMine = section.measured.groundRings.notMine.map((e) => e.index);
  for (const i of [1172, 71, 3072, 528, 97, 1773, 1774, 1775, 2159, 2157]) {
    assert.ok(notMine.includes(i), `ring #${i} has left the boundary declaration`);
  }
  for (const e of section.measured.groundRings.notMine) {
    assert.ok(e.why && e.why.length > 40, `#${e.index} is declared not-mine with no reason`);
  }
  const claims = section.measured.boundaryClaims.map((c) => c.owner);
  assert.ok(claims.includes("tata"),
    "the Level-5 bridge claim must still name tata");
  assert.ok(claims.includes("ureygreen (R6)"),
    "Urey Green / the 2018 science quadrangle is ureygreen (R6), not tata — tata's own declination");
  assert.ok(claims.includes("p101"),
    "Lot P101 is owned by the p101 section, not natsci — the recon ERRATA predates it");
  assert.equal(claims.includes("natsci"), false,
    "Lot P101 must not still point at natsci");
});

/* ------------------------------------------------ the axiom-layer gates */

const RD = section ? section.derivations.readings : {};

t("S1(vi): every expr is arithmetic, is EVALUATED, and reproduces its own value", () => {
  const scope = { ...RD };
  for (const [k, v] of Object.entries(section.derivations.figures)) {
    if (v && typeof v.value === "number") scope[k] = v.value;
  }
  const { evaluated, prose } = assertExprs({
    figures: section.derivations.figures, scope, label: "pacific",
  });
  assert.ok(evaluated >= 40, `only ${evaluated} exprs evaluated`);
  assert.ok(prose >= 4, `only ${prose} prose derivations — the Kasa fits and the rim median are prose by nature`);
  for (const [key, decl] of Object.entries(section.derivations.figures)) {
    assert.ok(decl.why && decl.why.length > 20, `figure ${key} lost the prose behind it`);
    assert.match(decl.why, /\[(measured|sourced|estimated|conflicted)[\],]/,
      `figure ${key} carries no tier label`);
  }
});

t("S1(iii): every reading with an external truth is pinned to that truth", () => {
  const pins = {
    /* The repo reads — pinned here AND re-read from the shipped files below. */
    "units.datum": { value: 102.4, tol: 0, truth: "docs/data/campus-lidar.json .datum" },
    "survey.massHeight": { value: 33.2, tol: 0, truth: "docs/data/campus-lidar.json massHeights['m:-92,234']" },
    "survey.heightsLabel": { value: 33.9, tol: 0, truth: "docs/data/campus-lidar.json heights['Pacific Hall']" },
    "survey.arcgisH": { value: 25.6, tol: 0, truth: "docs/data/campus-arcgis.json massing[446].h" },
    "survey.levels": { value: 6, tol: 0, truth: "docs/data/campus-arcgis.json massing[446].levels" },
    "survey.osmH": { value: 18, tol: 0, truth: "docs/data/campus-3d.json buildings[78].h" },
    "survey.osmVerts": { value: 17, tol: 0, truth: "docs/data/campus-3d.json buildings[78].p.length" },
    "survey.massingIndex": { value: 446, tol: 0, truth: "the GIS massing index this section is of" },
    "survey.osmIndex": { value: 78, tol: 0, truth: "the OSM buildings index this section records as the loser" },
    "survey.ringVerts": { value: 104, tol: 0, truth: "the vertex count of arcgis.massing[446].r[0]" },
    "survey.ringAreaM2": { value: 2630.535, tol: 5e-3, truth: "the shoelace area of that ring at /10" },
    "survey.ringX0": { value: -141.0, tol: 5e-3, truth: "the bbox of arcgis.massing[446].r[0] at /10" },
    "survey.ringX1": { value: -50.2, tol: 5e-3, truth: "the bbox of arcgis.massing[446].r[0] at /10" },
    "survey.ringZ0": { value: 193.8, tol: 5e-3, truth: "the bbox of arcgis.massing[446].r[0] at /10" },
    "survey.ringZ1": { value: 244.2, tol: 5e-3, truth: "the bbox of arcgis.massing[446].r[0] at /10" },
    "survey.osmX0": { value: -148.1, tol: 5e-3, truth: "the bbox of campus-3d.json buildings[78].p" },
    "survey.osmX1": { value: -51.6, tol: 5e-3, truth: "the bbox of campus-3d.json buildings[78].p" },
    "survey.osmZ0": { value: 193.3, tol: 5e-3, truth: "the bbox of campus-3d.json buildings[78].p" },
    "survey.osmZ1": { value: 245.6, tol: 5e-3, truth: "the bbox of campus-3d.json buildings[78].p" },
    "survey.rimMedian": { value: 22.0, tol: 5e-3, truth: "the median of campus-lidar terrain at the ring's 104 vertices, as build-campus-lidar.mjs computes rimBase" },
    "survey.rimMin": { value: 18.1, tol: 5e-3, truth: "the same 104-sample rim, minimum" },
    "survey.rimMax": { value: 23.1, tol: 5e-3, truth: "the same 104-sample rim, maximum" },
    "survey.rimN": { value: 104, tol: 0, truth: "one rim sample per ring vertex" },

    /* The ring runs — pinned here AND recomputed from the shipped ring below. */
    "ring.seg56": { value: 42.802, tol: 5e-3, truth: "the length of ring segment 56, x -125.7 to -82.9" },
    "ring.seg57": { value: 22.0, tol: 5e-3, truth: "the length of ring segment 57, x -82.9 to -60.9" },
    "ring.eastFaceLen": { value: 27.202, tol: 5e-3, truth: "ring vertices 1..2, the wing's east elevation" },
    "ring.wingNorthLen": { value: 7.001, tol: 5e-3, truth: "ring vertices 2..3, the wing's north end" },
    "ring.wingWestLen": { value: 16.8, tol: 5e-3, truth: "ring vertices 3..4, the wing's west elevation" },
    "ring.northBarLen": { value: 62.308, tol: 5e-3, truth: "ring vertices 5..8, the bar's north face including its V" },
    "ring.westBarLen": { value: 14.6, tol: 5e-3, truth: "ring vertices 8..10, the bar's west retaining wall" },
    "ring.westStepLen": { value: 16.503, tol: 5e-3, truth: "ring vertices 10..14, the west step" },
    "ring.westReturnLen": { value: 6.601, tol: 5e-3, truth: "ring vertices 14..15, the west return" },
    "ring.swArcChordLen": { value: 20.498, tol: 5e-3, truth: "the chord-sum of ring vertices 18..52, the SW arc" },
    "ring.seArcChordLen": { value: 16.289, tol: 5e-3, truth: "the chord-sum of ring vertices 63..90, the SE arc" },
    "ring.swArcRadius": { value: 16.0422, tol: 1e-3, truth: "Kasa least-squares circle over ring vertices 18..51" },
    "ring.swArcCx": { value: -125.2538, tol: 1e-3, truth: "the centre of that same Kasa least-squares fit" },
    "ring.swArcCz": { value: 228.2318, tol: 1e-3, truth: "the centre of that same Kasa least-squares fit" },
    "ring.swArcRms": { value: 0.02556, tol: 1e-4, truth: "the radial RMS residual of that same Kasa fit" },
    "ring.swArcPts": { value: 34, tol: 0, truth: "the number of surveyed vertices the SW fit runs over" },
    "ring.seArcRadius": { value: 11.396, tol: 1e-3, truth: "Kasa least-squares circle over ring vertices 63..89" },
    "ring.seArcCx": { value: -61.6526, tol: 1e-3, truth: "the centre of that same Kasa least-squares fit" },
    "ring.seArcCz": { value: 232.3369, tol: 1e-3, truth: "the centre of that same Kasa least-squares fit" },
    "ring.seArcRms": { value: 0.0186, tol: 1e-4, truth: "the radial RMS residual of that same Kasa fit" },
    "ring.seArcPts": { value: 27, tol: 0, truth: "the number of surveyed vertices the SE fit runs over" },

    /* The EPT probe — the section's external truth, not re-derivable here. */
    "ept.roofP50": { value: 50.38, tol: 0, truth: "research-pacific.md SS0.1, full-depth EPT p50 over the GIS ring" },
    "ept.roofP75": { value: 51.30, tol: 0, truth: "research-pacific.md SS0.1, p75 of the same 15,349 returns" },
    "ept.roofP98": { value: 55.28, tol: 0, truth: "research-pacific.md SS0.1, p98 — what build-campus-lidar.mjs calls the roof" },
    "ept.roofN": { value: 15349, tol: 0, truth: "the non-ground return count inside the ring" },
    "ept.plateNorthP25": { value: 50.33, tol: 0, truth: "research-pacific.md SS2.3, main plate north band" },
    "ept.plateNorthP50": { value: 50.37, tol: 0, truth: "research-pacific.md SS2.3, main plate north band" },
    "ept.plateNorthP75": { value: 50.43, tol: 0, truth: "research-pacific.md SS2.3, main plate north band" },
    "ept.plateNorthN": { value: 3104, tol: 0, truth: "returns in the north plate band" },
    "ept.plateSouthP25": { value: 50.31, tol: 0, truth: "research-pacific.md SS2.3, main plate south band" },
    "ept.plateSouthP50": { value: 50.34, tol: 0, truth: "research-pacific.md SS2.3, main plate south band" },
    "ept.plateSouthP75": { value: 50.38, tol: 0, truth: "research-pacific.md SS2.3, main plate south band" },
    "ept.plateSouthN": { value: 3758, tol: 0, truth: "returns in the south plate band" },
    "ept.copingP50": { value: 51.26, tol: 0, truth: "research-pacific.md SS2.3, returns above repo 50.8 — THE PARAPET" },
    "ept.copingP90": { value: 51.27, tol: 0, truth: "research-pacific.md SS2.3, the same 159-return coping population" },
    "ept.copingN": { value: 159, tol: 0, truth: "the coping return count" },
    "ept.wingPlateP25": { value: 41.50, tol: 0, truth: "research-pacific.md SS2.3, the low wing plate" },
    "ept.wingPlateP50": { value: 41.53, tol: 0, truth: "research-pacific.md SS2.3, the low wing plate" },
    "ept.wingPlateP75": { value: 41.58, tol: 0, truth: "research-pacific.md SS2.3, the low wing plate" },
    "ept.wingPlateN": { value: 227, tol: 0, truth: "returns on the low wing plate" },
    "ept.wingParapetP50": { value: 42.40, tol: 0, truth: "research-pacific.md SS2.3, the wing's own coping" },
    "ept.wingParapetN": { value: 7, tol: 0, truth: "the wing coping return count — small, and stated as such" },
    "ept.wingX0": { value: -58.0, tol: 0, truth: "research-pacific.md SS2.3 / SS0.3, the wing probe box" },
    "ept.wingX1": { value: -50.5, tol: 0, truth: "research-pacific.md SS2.3, the same low-wing probe box" },
    "ept.wingZ0": { value: 193.5, tol: 0, truth: "research-pacific.md SS2.3, the same low-wing probe box" },
    "ept.wingZ1": { value: 221.0, tol: 0, truth: "research-pacific.md SS2.3, the same low-wing probe box" },
    "ept.penthouseX0": { value: -136.0, tol: 0, truth: "research-pacific.md SS2.5, 1 m-bin counts of returns above repo 52" },
    "ept.penthouseX1": { value: -50.3, tol: 0, truth: "research-pacific.md SS2.5, the same 1 m-bin scan" },
    "ept.penthouseZ0": { value: 223.9, tol: 0, truth: "research-pacific.md SS2.5, the same 1 m-bin scan" },
    "ept.penthouseZ1": { value: 231.9, tol: 0, truth: "research-pacific.md SS2.5, the same 1 m-bin scan" },
    "ept.penthouseEnclosureP50Lo": { value: 53.1, tol: 0, truth: "research-pacific.md SS2.5, lowest 2 m-cell p50 in the band" },
    "ept.penthouseEnclosureP50Hi": { value: 54.3, tol: 0, truth: "research-pacific.md SS2.5, highest 2 m-cell p50 in the band" },
    "ept.penthouseScreenP95": { value: 55.2, tol: 0, truth: "research-pacific.md SS2.5, the flat p95 across the band — THE 33.2" },
    "ept.penthouseStackLo": { value: 56.2, tol: 0, truth: "research-pacific.md SS2.5, stack spike" },
    "ept.penthouseStackMid": { value: 56.4, tol: 0, truth: "research-pacific.md SS2.5, stack spike" },
    "ept.penthouseStackHi": { value: 57.15, tol: 0, truth: "research-pacific.md SS2.5, tallest stack spike" },
    "ept.gradeSouthApronWest": { value: 21.43, tol: 0, truth: "research-pacific.md SS2.6 grade station" },
    "ept.gradeSouthApronWestN": { value: 174, tol: 0, truth: "the class-2 return count at that grade station" },
    "ept.gradeSouthApronMid": { value: 21.83, tol: 0, truth: "research-pacific.md SS2.6 — the grade the storey solve is against" },
    "ept.gradeSouthApronMidN": { value: 180, tol: 0, truth: "the class-2 return count at that grade station" },
    "ept.gradeSouthApronEast": { value: 22.10, tol: 0, truth: "research-pacific.md SS2.6 grade station" },
    "ept.gradeSouthApronEastN": { value: 191, tol: 0, truth: "the class-2 return count at that grade station" },
    "ept.gradeWestOfSwArc": { value: 21.04, tol: 0, truth: "research-pacific.md SS2.6 grade station" },
    "ept.gradeWestOfSwArcN": { value: 134, tol: 0, truth: "the class-2 return count at that grade station" },
    "ept.gradeEastOfSeArc": { value: 23.05, tol: 0, truth: "research-pacific.md SS2.6 grade station" },
    "ept.gradeEastOfSeArcN": { value: 148, tol: 0, truth: "the class-2 return count at that grade station" },
    "ept.gradeNorthCourtWest": { value: 20.76, tol: 0, truth: "research-pacific.md SS2.6 grade station" },
    "ept.gradeNorthCourtWestN": { value: 161, tol: 0, truth: "the class-2 return count at that grade station" },
    "ept.gradeNorthCourtEast": { value: 23.09, tol: 0, truth: "research-pacific.md SS2.6 grade station" },
    "ept.gradeNorthCourtEastN": { value: 317, tol: 0, truth: "the class-2 return count at that grade station" },
    "ept.gradeWingNorth": { value: 21.20, tol: 0, truth: "research-pacific.md SS2.6 grade station" },
    "ept.gradeWingNorthN": { value: 64, tol: 0, truth: "the class-2 return count at that grade station" },
    "ept.gradeNeTerrace": { value: 23.12, tol: 0, truth: "research-pacific.md SS2.6/SS4.3 — a paved podium deck, declared to tata" },
    "ept.gradeNeTerraceN": { value: 77, tol: 0, truth: "the class-2 return count at that grade station" },
    "ept.gradeNwYard": { value: 18.2, tol: 0, truth: "research-pacific.md SS4.2, the sunken service yard floor" },

    /* The ortho — the file, its scale, and the reads taken off it. */
    "ortho.pxPerM": { value: 8, tol: 0, truth: "docs/data/textures/manifest.json chunk_4_6 at zoom 20, 2040 px over 255 m" },
    "ortho.x0": { value: -177, tol: 0, truth: "the same manifest entry's world x0" },
    "ortho.z0": { value: 147, tol: 0, truth: "the same manifest entry's world z0" },
    "ortho.bayJoint1": { value: -111.2, tol: 0, truth: "research-pacific.md SS3.3, panel-joint trough in a contrast-stretched crop" },
    "ortho.bayJoint2": { value: -104.8, tol: 0, truth: "research-pacific.md SS3.3, the same panel-joint trough scan" },
    "ortho.bayJoint3": { value: -98.4, tol: 0, truth: "research-pacific.md SS3.3, the same panel-joint trough scan" },
    "ortho.bayJoint4": { value: -92.2, tol: 0, truth: "research-pacific.md SS3.3, the same panel-joint trough scan" },
    "ortho.bayJoint5": { value: -85.7, tol: 0, truth: "research-pacific.md SS3.3, the same panel-joint trough scan" },
    "ortho.bayJointTolerance": { value: 0.13, tol: 0, truth: "the spread of the four spacings that scan gives, 6.2 to 6.5 m" },
    "ortho.topDispPerMX": { value: -0.060, tol: 0, truth: "revelle-recon.md Rung-5, Argo -1.1 m over 18.4 m of height" },
    "ortho.topDispPerMZ": { value: -0.196, tol: 0, truth: "revelle-recon.md Rung-5, Argo -3.6 m over 18.4 m of height" },
    "ortho.northEdgeApparentZ": { value: 204.4, tol: 0, truth: "research-pacific.md SS5, the ortho's apparent north roof edge" },
    "ortho.penthouseApparentZ0": { value: 216.3, tol: 0, truth: "research-pacific.md SS5, the ortho's apparent penthouse band edge" },
    "ortho.penthouseApparentZ1": { value: 225.0, tol: 0, truth: "research-pacific.md SS5, the ortho's apparent penthouse band edge" },

    /* Colour channels. */
    "px.precast2010aR": { value: 154, tol: 0, truth: "flickr-4660991701 rect (330,540,560,600)" },
    "px.precast2010aG": { value: 134, tol: 0, truth: "the same pinned rectangle on the same cached frame" },
    "px.precast2010aB": { value: 121, tol: 0, truth: "the same pinned rectangle on the same cached frame" },
    "px.precast2010bR": { value: 152, tol: 0, truth: "flickr-4660991701 rect (110,300,300,340)" },
    "px.precast2010bG": { value: 131, tol: 0, truth: "the same pinned rectangle on the same cached frame" },
    "px.precast2010bB": { value: 118, tol: 0, truth: "the same pinned rectangle on the same cached frame" },
    "px.precast2022eR": { value: 158, tol: 0, truth: "sv-south-east_2022-07_h45_p30.jpg, lit 55-90 %ile of (0,60,280,500)" },
    "px.precast2022eG": { value: 152, tol: 0, truth: "the same pinned rectangle on the same cached frame" },
    "px.precast2022eB": { value: 143, tol: 0, truth: "the same pinned rectangle on the same cached frame" },
    "px.precast2022mR": { value: 148, tol: 0, truth: "sv-south-mid-w_2022-07_h1_p25_f100.jpg, same method over (0,60,640,520)" },
    "px.precast2022mG": { value: 140, tol: 0, truth: "the same pinned rectangle on the same cached frame" },
    "px.precast2022mB": { value: 136, tol: 0, truth: "the same pinned rectangle on the same cached frame" },
    "px.glazingR": { value: 61, tol: 0, truth: "sv-south-mid-w_2022-07 rect (380,380,470,410)" },
    "px.glazingG": { value: 72, tol: 0, truth: "the same pinned rectangle on the same cached frame" },
    "px.glazingB": { value: 57, tol: 0, truth: "the same pinned rectangle on the same cached frame" },
    "px.glazingCoolR": { value: 66, tol: 0, truth: "sv-south-mid_2022-07_h346_p30.jpg rect (380,320,470,345)" },
    "px.glazingCoolG": { value: 102, tol: 0, truth: "the same pinned rectangle on the same cached frame" },
    "px.glazingCoolB": { value: 123, tol: 0, truth: "the same pinned rectangle on the same cached frame" },
    "px.awningR": { value: 176, tol: 0, truth: "chunk_4_6.jpg rect (312,712,360,744) = world x -138..-132, z 236..240" },
    "px.awningG": { value: 199, tol: 0, truth: "the same pinned rectangle on the same cached frame" },
    "px.awningB": { value: 231, tol: 0, truth: "the same pinned rectangle on the same cached frame" },
    "px.awningShadedR": { value: 6, tol: 0, truth: "flickr-4660991701 rect (660,195,700,215), the shaded shell flank" },
    "px.awningShadedG": { value: 45, tol: 0, truth: "the same pinned rectangle on the same cached frame" },
    "px.awningShadedB": { value: 84, tol: 0, truth: "the same pinned rectangle on the same cached frame" },
    "px.membraneR": { value: 171, tol: 0, truth: "chunk_4_6.jpg over world x -115..-100, z 233..236" },
    "px.membraneG": { value: 174, tol: 0, truth: "the same pinned rectangle on the same cached frame" },
    "px.membraneB": { value: 176, tol: 0, truth: "the same pinned rectangle on the same cached frame" },
    "px.screenR": { value: 172, tol: 0, truth: "chunk_4_6.jpg over world x -118..-104, z 225..230" },
    "px.screenG": { value: 173, tol: 0, truth: "the same pinned rectangle on the same cached frame" },
    "px.screenB": { value: 174, tol: 0, truth: "the same pinned rectangle on the same cached frame" },
    "px.wingRoofR": { value: 181, tol: 0, truth: "chunk_4_6.jpg over world x -56..-52, z 200..208" },
    "px.wingRoofG": { value: 180, tol: 0, truth: "the same pinned rectangle on the same cached frame" },
    "px.wingRoofB": { value: 175, tol: 0, truth: "the same pinned rectangle on the same cached frame" },
    "px.apronR": { value: 181, tol: 0, truth: "chunk_4_6.jpg over world x -110..-96, z 246..250" },
    "px.apronG": { value: 172, tol: 0, truth: "the same pinned rectangle on the same cached frame" },
    "px.apronB": { value: 159, tol: 0, truth: "the same pinned rectangle on the same cached frame" },
    "pxOwn.serviceRoadR": { value: 110.0, tol: 0.05, truth: "chunk_4_6.jpg masked to arcgis.ground#131, lit 55-90 %ile of 29,316 ring pixels" },
    "pxOwn.serviceRoadG": { value: 115.7, tol: 0.05, truth: "the same masked lit-percentile ring read" },
    "pxOwn.serviceRoadB": { value: 121.3, tol: 0.05, truth: "the same masked lit-percentile ring read" },
    "pxOwn.serviceRoadN": { value: 29316, tol: 0, truth: "ortho pixels whose centres fall inside arcgis.ground#131" },
    "pxOwn.plantingBedR": { value: 135.4, tol: 0.05, truth: "chunk_4_6.jpg masked to arcgis.ground#2102, same method over 80,689 pixels" },
    "pxOwn.plantingBedG": { value: 124.3, tol: 0.05, truth: "the same masked lit-percentile ring read" },
    "pxOwn.plantingBedB": { value: 112.1, tol: 0.05, truth: "the same masked lit-percentile ring read" },
    "pxOwn.plantingBedN": { value: 80689, tol: 0, truth: "ortho pixels whose centres fall inside arcgis.ground#2102" },
    "orthoRecheck.membraneR": { value: 171.7, tol: 0.05, truth: "independent re-read of the same membrane rect, sharp 2026-08-21" },
    "orthoRecheck.membraneG": { value: 174.3, tol: 0.05, truth: "the same independent 2026-08-21 re-read" },
    "orthoRecheck.membraneB": { value: 176.3, tol: 0.05, truth: "the same independent 2026-08-21 re-read" },
    "orthoRecheck.screenR": { value: 173.0, tol: 0.05, truth: "independent re-read of the same screen rect" },
    "orthoRecheck.screenG": { value: 173.7, tol: 0.05, truth: "the same independent 2026-08-21 re-read" },
    "orthoRecheck.screenB": { value: 174.6, tol: 0.05, truth: "the same independent 2026-08-21 re-read" },
    "orthoRecheck.wingRoofR": { value: 181.3, tol: 0.05, truth: "independent re-read of the same wing-roof rect" },
    "orthoRecheck.wingRoofG": { value: 180.8, tol: 0.05, truth: "the same independent 2026-08-21 re-read" },
    "orthoRecheck.wingRoofB": { value: 175.4, tol: 0.05, truth: "the same independent 2026-08-21 re-read" },
    "orthoRecheck.apronR": { value: 181.3, tol: 0.05, truth: "independent re-read of the same apron rect" },
    "orthoRecheck.apronG": { value: 172.2, tol: 0.05, truth: "the same independent 2026-08-21 re-read" },
    "orthoRecheck.apronB": { value: 159.5, tol: 0.05, truth: "the same independent 2026-08-21 re-read" },
    "orthoRecheck.awningR": { value: 176.1, tol: 0.05, truth: "independent re-read of the same awning rect" },
    "orthoRecheck.awningG": { value: 199.8, tol: 0.05, truth: "the same independent 2026-08-21 re-read" },
    "orthoRecheck.awningB": { value: 231.9, tol: 0.05, truth: "the same independent 2026-08-21 re-read" },
    "repoColors.truecolorRoofR": { value: 0xab, tol: 0, truth: "docs/data/campus-truecolor.json roofs['m:-92,234']" },
    "repoColors.truecolorRoofG": { value: 0xac, tol: 0, truth: "the same shipped build-time colour file" },
    "repoColors.truecolorRoofB": { value: 0xad, tol: 0, truth: "the same shipped build-time colour file" },
    "repoColors.massingColorR": { value: 0x72, tol: 0, truth: "docs/data/campus-colors.json massing[446]" },
    "repoColors.massingColorG": { value: 0x66, tol: 0, truth: "the same shipped build-time colour file" },
    "repoColors.massingColorB": { value: 0x58, tol: 0, truth: "the same shipped build-time colour file" },
    "published.storeys": { value: 6, tol: 0, truth: "the Sailor Research Group directions page, 'a 6-story building with blue window awnings'" },
    "published.mapBuildingNumber": { value: 111, tol: 0, truth: "the Sailor Research Group page, 'building 111 on the UCSD map'" },
  };
  const n = assertPins({
    readings: RD, pins,
    namespaces: ["units", "survey", "ring", "ept", "ortho", "px", "pxOwn", "orthoRecheck", "repoColors", "published"],
    label: "pacific",
  });
  assert.ok(n >= 130, `only ${n} readings pinned`);
});

t("the repo readings are RE-READ from the shipped files, not taken on trust", () => {
  assert.equal(RD.units.datum, lidar.datum);
  assert.equal(RD.survey.massHeight, lidar.massHeights[MKEY]);
  assert.equal(RD.survey.heightsLabel, lidar.heights["Pacific Hall"]);
  assert.equal(RD.survey.arcgisH, arcgis.massing[MASS].h);
  assert.equal(RD.survey.levels, arcgis.massing[MASS].levels);
  assert.equal(RD.survey.osmH, campus.buildings[OSM].h);
  assert.equal(RD.survey.osmVerts, campus.buildings[OSM].p.length);
  assert.equal(RD.survey.ringVerts, arcgis.massing[MASS].r[0].length);

  const hexBytes = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [tr, tg, tb] = hexBytes(truecolor.roofs[MKEY]);
  assert.equal(RD.repoColors.truecolorRoofR, tr);
  assert.equal(RD.repoColors.truecolorRoofG, tg);
  assert.equal(RD.repoColors.truecolorRoofB, tb);
  const [mr, mg, mb] = hexBytes(campusColors.massing[MASS]);
  assert.equal(RD.repoColors.massingColorR, mr);
  assert.equal(RD.repoColors.massingColorG, mg);
  assert.equal(RD.repoColors.massingColorB, mb);

  const chunk = manifest.chunks.find((c) => c.file === "chunk_4_6.jpg");
  assert.ok(chunk, "chunk_4_6.jpg has left the texture manifest");
  assert.equal(RD.ortho.x0, chunk.x0);
  assert.equal(RD.ortho.z0, chunk.z0);
  assert.equal(RD.ortho.pxPerM, chunk.w / (chunk.x1 - chunk.x0));
});

t("S1(iii): the relations the section states in prose are asserted", () => {
  const T = lidar.terrain;
  const at = (x, z) => T.z[Math.round((z - T.z0) / T.cell) * T.cols + Math.round((x - T.x0) / T.cell)] / 10;
  /* Over the CLOSED ring, which is what build-campus-lidar.mjs samples. */
  const rim = closedRing.map(([x, z]) => at(x, z)).sort((a, b) => a - b);

  const sw = kasa(ring.slice(18, 52));
  const se = kasa(ring.slice(63, 90));
  const F = section.derivations.figures;
  const oB = campus.buildings[OSM].p;

  assertRelations({
    label: "pacific",
    relations: [
      { name: "the rim datum is the median of the shipped terrain at the shipped ring's 104 vertices", got: F["rim.base"].value, want: rim[Math.floor(rim.length / 2)] },
      { name: "rim minimum", got: RD.survey.rimMin, want: rim[0] },
      { name: "rim maximum", got: RD.survey.rimMax, want: rim[rim.length - 1] },
      { name: "the shoelace area", got: RD.survey.ringAreaM2, want: ringArea(ring), tol: 5e-3 },
      { name: "ring segment 56 recomputed", got: RD.ring.seg56, want: segLen(56), tol: 5e-4 },
      { name: "ring segment 57 recomputed", got: RD.ring.seg57, want: segLen(57), tol: 5e-4 },
      { name: "the east face run recomputed", got: RD.ring.eastFaceLen, want: runLen(1, 2), tol: 5e-4 },
      { name: "the north bar run recomputed", got: RD.ring.northBarLen, want: runLen(5, 8), tol: 5e-4 },
      { name: "the west step run recomputed", got: RD.ring.westStepLen, want: runLen(10, 14), tol: 5e-4 },
      { name: "the SW arc chord-sum recomputed", got: RD.ring.swArcChordLen, want: runLen(18, 52), tol: 5e-4 },
      { name: "the SE arc chord-sum recomputed", got: RD.ring.seArcChordLen, want: runLen(63, 90), tol: 5e-4 },
      { name: "the SW Kasa radius re-fitted from the shipped ring", got: RD.ring.swArcRadius, want: sw.r, tol: 5e-4 },
      { name: "the SW Kasa centre x", got: RD.ring.swArcCx, want: sw.cx, tol: 5e-4 },
      { name: "the SW Kasa centre z", got: RD.ring.swArcCz, want: sw.cz, tol: 5e-4 },
      { name: "the SW Kasa RMS residual", got: RD.ring.swArcRms, want: sw.rms, tol: 5e-5 },
      { name: "the SE Kasa radius re-fitted from the shipped ring", got: RD.ring.seArcRadius, want: se.r, tol: 5e-4 },
      { name: "the SE Kasa centre x", got: RD.ring.seArcCx, want: se.cx, tol: 5e-4 },
      { name: "the SE Kasa centre z", got: RD.ring.seArcCz, want: se.cz, tol: 5e-4 },
      { name: "the SE Kasa RMS residual", got: RD.ring.seArcRms, want: se.rms, tol: 5e-5 },
      { name: "the OSM bbox x0 recomputed", got: RD.survey.osmX0, want: Math.min(...oB.map((p) => p[0])), tol: 5e-3 },
      { name: "the OSM bbox x1 recomputed", got: RD.survey.osmX1, want: Math.max(...oB.map((p) => p[0])), tol: 5e-3 },
      { name: "the OSM bbox z0 recomputed", got: RD.survey.osmZ0, want: Math.min(...oB.map((p) => p[1])), tol: 5e-3 },
      { name: "the OSM bbox z1 recomputed", got: RD.survey.osmZ1, want: Math.max(...oB.map((p) => p[1])), tol: 5e-3 },
    ],
  });

  /* Both fits really are circles, which is the only reason the arcs are
     called arcs; a residual that has grown past a centimetre or two means
     the ring has changed under the claim. */
  assert.ok(sw.rms < 0.04, `the SW corner no longer fits a circle (RMS ${sw.rms})`);
  assert.ok(se.rms < 0.04, `the SE corner no longer fits a circle (RMS ${se.rms})`);

  /* And THE identification, recomputed end to end: the shipped massHeight is
     the penthouse screen plane over the rim median, to the last digit. */
  near(RD.ept.penthouseScreenP95 - rim[Math.floor(rim.length / 2)], lidar.massHeights[MKEY], 5e-3,
    "the shipped massHeight is no longer the penthouse screen over the rim datum");
  assert.ok(RD.ept.roofP98 - RD.ept.roofP75 < 5,
    "p98 - p75 has passed 5 m, so build-campus-lidar's stepped-slab guard would fire and the reconciliation in SS0.1 no longer holds");
});

t("S1(i): no number anywhere in the axiom layer is uncovered", () => {
  const pins = new Set();
  const walk = (o, p) => {
    if (typeof o === "number") { pins.add(p); return; }
    if (o && typeof o === "object") for (const k of Object.keys(o)) walk(o[k], p ? `${p}.${k}` : k);
  };
  walk(RD, "");
  const figures = section.derivations.figures;
  const estimateKeys = new Set(Object.keys(section.estimates));

  assertCoverage({
    section,
    roots: {
      "derivations.readings": {},
      estimates: {},
      draw: {},
      system: {},
      counts: {},
      samples: {},
      bounds: {},
    },
    classify(path, value) {
      /* A run's v0/v1 are vertex INDICES into the surveyed ring, not metres;
         the run table's tiling of the ring is gated whole, elsewhere. */
      if (/^system\.runs\.\d+\.(v0|v1)$/.test(path)) return "a vertex index into the surveyed ring";
      /* A reading is covered by being pinned (the gate above runs the pins
         exhaustively over every pinned namespace). */
      if (path.startsWith("derivations.readings.")) return "pinned reading";
      /* An estimate is covered by its band. */
      if (path.startsWith("estimates.")) return "banded estimate";
      /* A `draw` number is covered by a sibling *Note that says it is a
         render offset and not a dimension. */
      if (path.startsWith("draw.")) {
        const leaf = path.slice(5).split(".")[0];
        const note = section.draw[`${leaf}Note`];
        return note && note.length > 40 ? "render offset with a stated note" : null;
      }
      /* A `system` number is covered by mirroring a figure or an estimate,
         or by being a measured reading carried straight through. */
      if (path.startsWith("system.")) {
        const key = path.slice(7);
        for (const f of Object.values(figures)) if (typeof f.value === "number" && Math.abs(f.value - value) < 5e-6) return "mirrors a figure";
        for (const k of estimateKeys) if (Math.abs(section.estimates[k].value - value) < 5e-6) return "mirrors an estimate";
        for (const p of pins) {
          const v = p.split(".").reduce((o, kk) => (o == null ? o : o[kk]), RD);
          if (typeof v === "number" && Math.abs(v - value) < 5e-6) return "carries a pinned reading";
        }
        void key;
        return null;
      }
      /* A count is covered by being reproduced by the build (gated below). */
      if (path.startsWith("counts.")) return "declared == built";
      if (path.startsWith("samples.")) return "an unconsumed sample with its own provenance line";
      if (path.startsWith("bounds.")) return "the section's own extent";
      return null;
    },
    uncovered: {},
    minimum: 200,
    label: "pacific",
  });
});

t("S1(ii): every estimate carries a machine-readable band and ships inside it", () => {
  const n = assertEstimateBands({
    estimates: section.estimates,
    valueAt: (key) => key.split(".").reduce((o, k) => (o == null ? o : o[k]), section),
    label: "pacific",
  });
  assert.ok(n >= 8, `only ${n} estimates banded`);
  /* Every estimate must record the FAILED LADDER, not just a preference —
     the ultra standard's own condition for reaching the third tier. */
  for (const [key, e] of Object.entries(section.estimates)) {
    assert.match(e.why, /ladder climbed and failed/i,
      `estimate ${key} does not record the ladder it climbed`);
    assert.ok(e.bandWhy && e.bandWhy.length > 60, `estimate ${key} does not say what its band means`);
    /* And it must extend a pattern of THIS SAME BUILDING. */
    assert.match(e.extends, /flickr-4660991701|sv-south|chunk_4_6|research-pacific|MEASURED/,
      `estimate ${key} extends a pattern that is not Pacific's own`);
  }
});

const srcLine = (v) => (typeof v === "string" ? v : v.source);

t("S1(iv): the tier gate runs BOTH ways over reads and colours", () => {
  const entries = [
    ...Object.entries(section.reads).map(([key, text]) => ({ key: `reads.${key}`, text })),
    ...Object.entries(section.colorSources).filter(([key]) => key !== "why")
      .map(([key, v]) => ({ key: `colorSources.${key}`, text: srcLine(v) })),
  ];
  const n = assertTierSymmetry({ entries, label: "pacific" });
  assert.ok(n >= 20, `the tier gate only walked ${n} entries`);
  /* The two sourced faces and the unphotographed ones are labelled opposite
     ways round, which is the whole substance of gap g2. */
  assert.match(section.reads.facadeSystem, /^\[sourced\]/);
  assert.match(section.reads.awnings, /^\[sourced\]/);
  assert.match(section.reads.northAndEastFaces, /^\[estimated\]/);
  assert.match(section.reads.plate, /^\[measured\]/);
  assert.match(section.reads.penthouse, /^\[measured\]/);
  assert.match(section.reads.penthouseStacks, /^\[estimated\]/);
});

/* --------------------------------------------------------------- colours */

t("every hex is its own pinned channels, rounded, and every role is consumed", () => {
  const px = RD.px;
  const F = section.derivations.figures;
  const hex = (r, g, b) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

  const sourced = {
    precast: hex(F["colour.precastR"].value, F["colour.precastG"].value, F["colour.precastB"].value),
    glazing: hex(px.glazingR, px.glazingG, px.glazingB),
  };
  for (const [role, want] of Object.entries(sourced)) {
    assert.equal(section.colors[role], want,
      `colors.${role} is not its own pinned channels rounded to bytes`);
  }
  /* The precast base really is the mean of the four SUNLIT reads. */
  near(F["colour.precastR"].value,
    (px.precast2010aR + px.precast2010bR + px.precast2022eR + px.precast2022mR) / 4, 5e-6, "precast R");
  near(F["colour.precastB"].value, 129.5, 5e-6,
    "the precast blue channel is 129.5 — the one channel whose rounding is load-bearing, and #998b82 requires it to round UP");

  /* SHIPS-vs-DERIVES (R4b audit F1): every provenance line that states its
     result as `= #xxxxxx` must ship exactly that hex. */
  let stated = 0;
  for (const [role, raw] of Object.entries(section.colorSources)) {
    if (role === "why") continue;
    const statedHexes = [...srcLine(raw).matchAll(/= (#[0-9a-f]{6})\b/g)];
    if (!statedHexes.length) continue;
    stated += 1;
    const want = statedHexes.at(-1)[1];
    assert.equal(section.colors[role], want,
      `${role} ships ${section.colors[role]} but its own provenance line derives ${want}`);
  }
  assert.ok(stated >= 9, `only ${stated} provenance lines state their hex — all nine must`);

  for (const [role, raw] of Object.entries(section.colorSources)) {
    if (role === "why") continue;
    const src = srcLine(raw);
    assert.match(src, /channel[- ]mean|\(R\+G\+B\)\/3/, `${role} must state its statistic`);
    assert.equal(/luminance/i.test(src), false, `${role} says 'luminance' — the R4 addendum bans the word`);
    assert.match(src, /\b(19|20)\d\d\b/, `${role} must date its source`);
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

  /* Bidirectional role gate: every declared role reaches a material, and
     every role the module names is declared. */
  for (const role of Object.keys(section.colors)) {
    assert.ok(moduleSrc.includes(`hue("${role}")`),
      `colors.${role} is declared and no material consumes it — a role nobody draws is a claim nobody checks`);
  }
  for (const m of moduleCode.matchAll(/hue\("(\w+)"\)/g)) {
    assert.ok(section.colors[m[1]] !== undefined,
      `the module asks for colour role "${m[1]}" and the section does not declare it — campus-materials.js would ship opaque white`);
  }

  /* The overcast frame stays out of the average and its exclusion stays on
     the record — mixing epochs and lighting states is what washes a hue out. */
  assert.match(section.colorSourcesNote, /#c4c3c5/);
  assert.match(section.colorSourcesNote, /OVERCAST/i);
  assert.match(section.reads.colourEpochSeparation, /not averaged in/i);
});

t("nothing in this section rests on the unresolved ortho-as-colour-source ruling", () => {
  assert.match(section.colorSources.why, /ortho/i);
  assert.match(section.colorSources.why, /NOT used|not used/,
    "the colour block must say in as many words that the ortho-derived tone is not used");
  for (const [role, raw] of Object.entries(section.colorSources)) {
    if (role === "why") continue;
    const line = srcLine(raw);
    assert.ok(!/chunk_\d+_\d+\.jpg|ortho pixel|orthophoto pixel/i.test(line),
      `colour ${role} is sampled off orthophoto pixels, which is the ruling Sahir has not made`);
  }
  const flagged = section.conflicts.find((c) => c.key === "orthoColourRuling");
  assert.ok(flagged, "the ortho-as-colour-source ruling must be carried as a declared conflict");
  assert.match(flagged.resolution, /NOT sampled|not sampled/i);
  /* The dossier's seven candidate values stay on the record — quarantined, not dropped. */
  const record = JSON.stringify(flagged);
  for (const hex of ["#b0c7e7", "#abaeb0", "#acadae", "#b5b4af", "#b5ac9f", "#6e7479", "#877c70"]) {
    assert.ok(record.includes(hex), `conflicts.orthoColourRuling lost the dossier's ${hex}`);
  }
});

t("the unconsumed samples stay unconsumed, and say why", () => {
  for (const [key, s] of Object.entries(section.samples)) {
    if (key === "note") continue;
    assert.match(s.hex, /^#[0-9a-f]{6}$/, `sample ${key} has no hex`);
    assert.ok(s.whyUnconsumed && s.whyUnconsumed.length > 40, `sample ${key} does not say why it is unconsumed`);
    assert.equal(Object.values(section.colors).includes(s.hex), false,
      `sample ${key} (${s.hex}) has reached the drawn palette`);
    assert.equal(moduleSrc.includes(s.hex), false, `sample ${key} appears in the module`);
  }
  assert.ok(section.samples.awningShadedFlank, "the shaded-flank read must stay on the record");
  assert.match(section.samples.awningShadedFlank.whyUnconsumed, /Shade is the light's/);
});

/* ------------------------------------------------------ the module itself */

t("the module reads only its own photo key and no measured file", () => {
  const keys = [...new Set([...moduleCode.matchAll(/photo\??\.(\w+)/g)].map((m) => m[1]))];
  assert.deepEqual(keys, ["pacific"], `the module reads photo keys ${keys.join(", ")}`);
  for (const forbidden of [/campus-lidar/, /campus-arcgis/, /campus-3d/, /campus-colors/,
    /campus-truecolor/, /readFileSync/, /fetch\(/, /import\(/]) {
    assert.equal(forbidden.test(moduleCode), false,
      `the module reaches for ${forbidden} — a photo module reads its section and nothing else`);
  }
  assert.equal(/Math\.random|new Date|Date\.now|performance\.now|TextureLoader/.test(moduleCode), false,
    "the module is not deterministic or loads a texture from a file");
  assert.equal(/#[0-9a-fA-F]{6}\b/.test(moduleCode), false, "a hex literal has appeared in the module");
  assert.equal(/0x[0-9a-fA-F]{6}\b/.test(moduleCode), false, "a packed colour literal has appeared in the module");
});

t("the module carries no dimension of its own — geometry is data", () => {
  const allowed = new Map([
    ["0.5", "a half: the centre of a storey, the axis of a half-cylinder, a midpoint"],
  ]);
  const found = new Set(moduleCode.match(/\b\d+\.\d+\b/g) || []);
  for (const f of found) {
    assert.ok(allowed.has(f), `bare float ${f} in the module — every metre belongs in the section`);
  }
  /* Integers are counts and array strides, not metres; the only ones that
     could hide a dimension are large, so those are refused outright. */
  for (const i of moduleCode.match(/(?<![\w.])\d{2,}(?![\w.])/g) || []) {
    assert.ok(Number(i) < 100 || /e-?\d/.test(i),
      `bare integer ${i} in the module — a two-figure number is a dimension in disguise`);
  }
});

t("a missing section builds nothing; a pre-merge section names what it waits for", () => {
  const empty = createPhotoPacific(null, { photo: {}, surfaceAt: drawn });
  assert.equal(empty.group.children.length, 0);
  assert.deepEqual(empty.counts, {});

  /* A half-landed merge must be loud. Every apparatus key the builder needs
     is named back to the caller rather than crashing or drawing half a
     building off a half section. */
  for (const drop of ["system", "measured", "draw", "colors", "absent"]) {
    const half = JSON.parse(JSON.stringify(section));
    delete half[drop];
    const r = createPhotoPacific(null, { photo: { pacific: half }, surfaceAt: drawn });
    assert.equal(r.group.children.length, 0, `dropping ${drop} still drew something`);
    assert.match(r.counts.pendingMerge, new RegExp(drop), `dropping ${drop} did not name it`);
  }
  const noRuns = JSON.parse(JSON.stringify(section));
  delete noRuns.system.runs;
  const r = createPhotoPacific(null, { photo: { pacific: noRuns }, surfaceAt: drawn });
  assert.equal(r.group.children.length, 0);
  assert.match(r.counts.pendingMerge, /system\.runs/);

  assert.throws(() => createPhotoPacific(null, { photo: { pacific: section } }),
    /needs surfaceAt/, "a missing sampler must throw, not silently place at zero");
});

t("two builds are byte-identical — no hidden randomness", () => {
  const dump = () => {
    const out = [];
    eachVertex(build().group, (x, y, z, name) => out.push(`${name}|${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}`));
    return out.join("\n");
  };
  assert.equal(dump(), dump(), "two builds differ — something in the module is not deterministic");
});

t("the group is added to a scene when there is one", () => {
  const scene = new THREE.Group();
  const r = createPhotoPacific(scene, { photo: { pacific: section }, surfaceAt: drawn });
  assert.ok(scene.children.includes(r.group));
  assert.equal(r.group.name, "photo-pacific");
});

/* ------------------------------------------------------- the run table */

t("the run table tiles the ENTIRE surveyed ring, contiguously and once", () => {
  const runs = section.system.runs;
  const sorted = runs.slice().sort((a, b) => a.v0 - b.v0);
  assert.equal(sorted[0].v0, 0, "the tiling does not start at vertex 0");
  for (let i = 1; i < sorted.length; i++) {
    assert.equal(sorted[i].v0, sorted[i - 1].v1,
      `the run table has a ${sorted[i].v0 > sorted[i - 1].v1 ? "GAP" : "OVERLAP"} at vertex ${sorted[i - 1].v1} — a surveyed face has stopped being treated`);
  }
  /* The last edge (103 -> 0) is degenerate at 0.00 m and carries nothing;
     everything else is covered. */
  assert.equal(sorted[sorted.length - 1].v1, ring.length,
    "the run table stops short of the ring's closing edge — that edge is a real 3.0 m face, not a degeneracy");

  let covered = 0;
  for (const r of runs) {
    assert.ok(["face", "arc", "return"].includes(r.kind), `run ${r.id} has kind ${r.kind}`);
    assert.ok(["sourced", "estimated"].includes(r.tier), `run ${r.id} has tier ${r.tier}`);
    assert.ok(r.note && r.note.length > 40, `run ${r.id} does not say what it is`);
    covered += runLen(r.v0, r.v1);
  }
  let whole = 0;
  for (let i = 0; i < ring.length; i++) whole += segLen(i);
  near(covered, whole, 5e-3, "the run lengths do not sum to the ring's own perimeter");

  /* Only the two arcs and the straight south face may claim [sourced] — they
     are the only faces any photograph reaches (gap g2). */
  const sourced = runs.filter((r) => r.tier === "sourced").map((r) => r.id).sort();
  assert.deepEqual(sourced, ["seArc", "south", "swArc"]);
  assert.deepEqual(runs.filter((r) => r.kind === "arc").map((r) => r.id).sort(), ["seArc", "swArc"]);
  const south = runs.find((r) => r.id === "south");
  near(runLen(south.v0, south.v1), 64.8, 5e-3, "the straight south face's surveyed length");
});

t("the bay rule reproduces per run, and the south face is exactly ten of them", () => {
  const BAY = section.system.bay;
  near(BAY.module, (RD.ring.seg56 + RD.ring.seg57) / 10, 5e-6, "the bay module");
  near(BAY.halfModule, BAY.module / 2, 5e-6, "the half module");
  near(BAY.orthoPitch, (RD.ortho.bayJoint5 - RD.ortho.bayJoint1) / 4, 5e-6, "the ortho pitch");
  assert.ok(Math.abs(BAY.module - BAY.orthoPitch) <= RD.ortho.bayJointTolerance,
    `the surveyed module ${BAY.module} is outside the ortho's own +/-${RD.ortho.bayJointTolerance} m — the number that picked the bay count no longer supports it`);
  assert.match(BAY.rule, /max\(1, round\(runLength \/ bay\.module\)\)/);

  for (const r of section.system.runs) {
    const L = runLen(r.v0, r.v1);
    const bays = r.kind === "return" || L < BAY.module ? 0 : Math.max(1, Math.round(L / BAY.module));
    if (!bays) continue;
    const module = L / bays;
    /* The rule's own implied band: round(L/M) = n means L/M is in
       [n-0.5, n+0.5), so the run's module is in [M(n-0.5)/n, M(n+0.5)/n]. */
    const lo = (BAY.module * (bays - 0.5)) / bays;
    const hi = (BAY.module * (bays + 0.5)) / bays;
    assert.ok(module >= lo - 1e-9 && module <= hi + 1e-9,
      `run ${r.id}'s module ${module.toFixed(3)} is outside the band [${lo.toFixed(3)}, ${hi.toFixed(3)}] its own bay count implies`);
    /* ONE punched opening per measured half-module, everywhere. */
    assert.equal(Math.max(1, Math.round(module / BAY.halfModule)), 2,
      `run ${r.id} would carry ${Math.round(module / BAY.halfModule)} openings per bay — the section claims exactly one per measured half-module`);
  }
  const south = section.system.runs.find((r) => r.id === "south");
  assert.equal(Math.round(runLen(south.v0, south.v1) / BAY.module), BAY.countSouth);
  assert.equal(BAY.countSouth, 10);
  /* The readings the module derives from are stated to the millimetre, so
     the re-derivation off the raw ring is held to the millimetre — the claim
     is that ten bays fit the SURVEYED face, not that a decimetre grid is
     exact in binary. */
  near(runLen(south.v0, south.v1) / BAY.countSouth, BAY.module, 1e-3,
    "ten bays of the module must fit the surveyed south face — that is what makes 6.48 measured");
});

/* ------------------------------------------------------------- the build */

t("counts: declared == built on the real drawn LiDAR surface", () => {
  const { counts } = build();
  for (const [k, v] of Object.entries(section.counts)) {
    if (typeof v !== "number") continue;
    assert.ok(k in counts, `the section declares count ${k} and the build does not produce it`);
    near(counts[k], v, 5e-3, `count ${k}`);
  }
  for (const k of Object.keys(counts)) {
    assert.ok(k in section.counts, `the build produces count ${k} and the section does not declare it`);
  }
  /* The withholding pair is declared even at zero, so a terrain rebuild that
     starts burying openings shows up as a count change rather than silence. */
  assert.equal(counts.openingsBuilt + counts.openingsWithheldToGrade, counts.openingsPlanned);
  assert.ok(counts.draws <= 20,
    `${counts.draws} draw calls — the campus-mid perf margin is thin and this section is built to be cheap`);
});

t("every mesh name carries its provenance tier", () => {
  const names = [];
  build().group.traverse((o) => { if (o.isMesh) names.push(o.name); });
  assert.ok(names.length >= 15, `only ${names.length} meshes`);
  for (const n of names) {
    assert.match(n, /^pacific-/, `mesh "${n}" is not namespaced to this section`);
    assert.match(n, /-(sourced|estimated|measured)$/,
      `mesh "${n}" carries no provenance suffix — a render alone must be able to show the tier`);
  }
  /* The two arcs and the south face are the only -sourced facade; the wing,
     the north and the east are -estimated. Both must exist, or one of the
     two claims has quietly become the other. */
  assert.ok(names.includes("pacific-facade-precast-sourced"));
  assert.ok(names.includes("pacific-facade-precast-estimated"));
  assert.ok(names.includes("pacific-awning-shell-sourced"));
  assert.ok(names.includes("pacific-penthouse-stack-estimated"));
  assert.ok(names.includes("pacific-penthouse-screen-measured"));
  assert.ok(names.includes("pacific-wing-step-wall-measured"));
});

t("THE HEIGHT GATE: the facade closes at the parapet, and only the spine rises past it", () => {
  const g = build().group;
  const S = section.system;
  const coping = S.stack.copingRepo;
  const prismTop = RD.ept.penthouseScreenP95;
  near(coping, RD.ept.copingP50, 5e-6, "the section's own coping");
  near(S.stack.plateRepo, 50.35, 5e-3, "the section's own plate");

  let worst = -Infinity;
  let who = "";
  eachVertex(g, (x, y, z, name) => {
    if (/penthouse/.test(name)) return;
    if (y > worst) { worst = y; who = name; }
  });
  assert.ok(worst <= coping + 5e-3,
    `${who} reaches ${worst.toFixed(3)}, above the measured coping ${coping} — the facade must close at the parapet`);
  assert.ok(worst > coping - 0.05,
    "nothing reaches the coping at all — the parapet band has stopped being built");

  /* And NOTHING may reach the drawn prism's own lid, which is the penthouse
     screen and is 3.94 m above the real parapet. */
  let atPrism = 0;
  eachVertex(g, (x, y, z, name) => {
    if (/penthouse/.test(name)) return;
    if (y > prismTop - 0.5) atPrism++;
  });
  assert.equal(atPrism, 0,
    "something outside the penthouse reaches the drawn prism's 55.2 lid — that is the trap this whole section exists to avoid");

  /* The penthouse itself tops out at the measured stack heights and no higher. */
  let topAll = -Infinity;
  eachVertex(g, (x, y) => { if (y > topAll) topAll = y; });
  near(topAll, RD.ept.penthouseStackHi, 5e-3,
    "the tallest thing on Pacific is no longer the tallest measured stack");
});

t("the wing probe box PARTITIONS the ring: two plates, no double roof, no gap", () => {
  const { counts } = build();
  near(counts.plateAreaMain + counts.plateAreaWing, ringArea(ring), 5e-3,
    "the two plate areas no longer sum to the surveyed ring — either a strip of roof is drawn twice or a strip is drawn at neither height");
  assert.ok(counts.plateAreaWing > 150 && counts.plateAreaWing < 250,
    `the wing plate is ${counts.plateAreaWing.toFixed(1)} m2, which is not the measured 7.5 x 27 m limb`);
  assert.equal(counts.roofPlatesMain, 2, "the main plate is the ring less the wing, in two convex pieces");
  assert.equal(counts.roofPlatesWing, 1);
  assert.ok(counts.stepWallRuns >= 2, "the 8.82 m step wall between the plates has gone");

  /* Every wing-plate vertex is inside the measured probe box, and every main
     plate vertex is outside it. */
  /* The partition is the two lines x = box.x0 and z = box.z1; the probe
     box's other two bounds are where the LASER stopped looking, and the ring
     is entitled to run past them (it reaches x -50.4 against a probe x1 of
     -50.5). Every wing vertex is on the wing side of both lines and every
     main-plate vertex is on the other side of at least one. */
  const BOX = section.system.wing.box;
  const wingSide = (x, z) => x >= BOX.x0 - 5e-3 && z <= BOX.z1 + 5e-3;
  eachVertex(build().group, (x, y, z, name) => {
    if (name === "pacific-wing-plate-measured") {
      assert.ok(wingSide(x, z),
        `the wing plate reaches (${x.toFixed(1)}, ${z.toFixed(1)}), on the bar's side of the partition`);
      assert.ok(y <= section.system.wing.plateRepo + 5e-3);
    }
    if (name === "pacific-roof-plate-measured") {
      assert.ok(x <= BOX.x0 + 5e-3 || z >= BOX.z1 - 5e-3,
        `the main plate reaches (${x.toFixed(1)}, ${z.toFixed(1)}), on the wing's side of the partition`);
    }
  });
  /* The step wall spans exactly the two measured plates. */
  let lo = Infinity;
  let hi = -Infinity;
  eachVertex(build().group, (x, y, z, name) => {
    if (name !== "pacific-wing-step-wall-measured") return;
    lo = Math.min(lo, y); hi = Math.max(hi, y);
  });
  near(lo, section.system.wing.plateRepo, 5e-3, "the step wall's foot");
  near(hi, section.system.stack.plateRepo, 5e-3, "the step wall's head");
  near(hi - lo, section.derivations.figures["wing.dropBelowBar"].value, 5e-3, "the step wall's height");
});

t("the penthouse is clipped to the roof it stands on, and its stacks are the measured heights", () => {
  const g = build().group;
  const P = section.system.penthouse;
  /* Every screen and deck vertex is over the roof plate, never over one of
     the ring's east-end slots — the argo curb lesson, on a bigger object. */
  eachVertex(g, (x, y, z, name) => {
    if (!/penthouse-screen/.test(name)) return;
    assert.ok(inRing(x, z, ring) || Math.min(
      ...ring.map((p, i) => {
        const q = ring[(i + 1) % ring.length];
        const dx = q[0] - p[0];
        const dz = q[1] - p[1];
        const l2 = dx * dx + dz * dz;
        const tt = l2 ? Math.max(0, Math.min(1, ((x - p[0]) * dx + (z - p[1]) * dz) / l2)) : 0;
        return Math.hypot(x - (p[0] + tt * dx), z - (p[1] + tt * dz));
      })) < 0.05,
    `a penthouse vertex at (${x.toFixed(1)}, ${z.toFixed(1)}) is over a hole in the roof`);
    assert.ok(y >= section.system.stack.plateRepo - section.draw.penthouseWallThickness - 5e-3);
    assert.ok(y <= P.screenTopRepo + 5e-3, "the screen rises past its own measured top plane");
  });
  /* The stacks stand on the deck and top out at the three measured spikes. */
  const stacks = g.getObjectByName("pacific-penthouse-stack-estimated");
  assert.ok(stacks && stacks.count === P.stackCount);
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const tops = [];
  for (let i = 0; i < stacks.count; i++) {
    stacks.getMatrixAt(i, m);
    m.decompose(p, q, s);
    near(p.y - s.y / 2, P.screenTopRepo, 5e-3, "a stack does not stand on the measured deck");
    tops.push(Number((p.y + s.y / 2).toFixed(3)));
    assert.ok(inRing(p.x, p.z, ring), "a stack stands off the roof");
  }
  assert.deepEqual(tops.slice().sort((a, b) => a - b), P.stacksRepo.slice().sort((a, b) => a - b),
    "the stacks no longer top out at the three measured spike heights");
  /* The enclosures are measured and deliberately unbuilt: they are under the
     deck, so nothing may be drawn for them. */
  const names = [];
  g.traverse((o) => { if (o.isMesh) names.push(o.name); });
  assert.equal(names.some((n) => /enclosure/i.test(n)), false,
    "an enclosure has been drawn — the same probe puts a deck over all of them, and their plan is gap g7");
  assert.ok(P.enclosureHiRepo < P.screenTopRepo,
    "the enclosures are no longer under the deck, so the reason for not drawing them has gone");
});

t("the awnings ride the two sourced arcs and the bays the frames reach, six tiers deep", () => {
  const g = build().group;
  const aw = g.getObjectByName("pacific-awning-shell-sourced");
  assert.ok(aw, "the awnings are gone — they are the building's public signature");
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const tiers = new Set();
  for (let i = 0; i < aw.count; i++) {
    aw.getMatrixAt(i, m);
    m.decompose(p, q, s);
    tiers.add(p.y.toFixed(2));
    assert.equal(inRing(p.x, p.z, ring), false,
      `an awning at (${p.x.toFixed(1)}, ${p.z.toFixed(1)}) is inside the surveyed footprint`);
    assert.ok(p.y < section.system.stack.copingRepo, "an awning is above the parapet");
    /* Every shell is on a face the ARC or the SOUTH run owns: z is south of
       the building's own midline, which is where every panorama stands. */
    assert.ok(p.z > 225, `an awning at z ${p.z.toFixed(1)} is on a face no photograph reaches`);
  }
  assert.equal(tiers.size, section.published?.storeys ?? RD.published.storeys,
    "the awnings no longer stack in exactly six tiers — which is the storey count the arc panoramas give independently");
  assert.equal(aw.count, section.counts.awnings);
  near(section.system.awning.projection / 2, section.system.awning.projection * 0.5, 5e-6,
    "the shell's rise is half its projection — the half-cylinder's own geometry");
});

t("the built stacks, awnings and facade planes land on the DERIVED stations", () => {
  /* p101 Gate 1 / audit-pacific-r5 F1. Containment + count is not a station
     mirror: a 0.5 m slide along the spine, proud of the ring, or south of
     the awnings still shipped. Stations are re-derived here from the
     section's own figures; built instance XY and facade vertices must land
     on them. Tolerance is 0.1 m — inside the 0.5 m slide the audit used. */
  const STATION = 0.1;
  const { stacks, awnings, wallOffset, ccw } = stations();
  const g = build().group;

  const gotStack = [];
  const gotAwning = [];
  eachInstance(g, (x, y, z, name) => {
    if (name === "pacific-penthouse-stack-estimated") gotStack.push({ x, z });
    if (name === "pacific-awning-shell-sourced") gotAwning.push({ x, z });
  });
  assert.equal(gotStack.length, stacks.length,
    `built ${gotStack.length} stacks against ${stacks.length} derived stations`);
  assert.equal(gotAwning.length, section.counts.awnings,
    `built ${gotAwning.length} awnings against the declared count`);
  assert.ok(awnings.length >= section.counts.awnings / (RD.published.storeys),
    `only ${awnings.length} derived awning plan-stations — the walk did not run`);

  gotStack.sort((a, b) => a.x - b.x);
  stacks.sort((a, b) => a.x - b.x);
  for (let i = 0; i < stacks.length; i++) {
    near(gotStack[i].x, stacks[i].x, STATION, `penthouse stack ${i} x`);
    near(gotStack[i].z, stacks[i].z, STATION, `penthouse stack ${i} z`);
  }

  for (const a of gotAwning) {
    const dist = Math.min(...awnings.map((w) => Math.hypot(a.x - w.x, a.z - w.z)));
    assert.ok(dist <= STATION,
      `awning at (${a.x.toFixed(3)}, ${a.z.toFixed(3)}) stands ${dist.toFixed(3)} m ` +
      `off every derived station (tolerance ${STATION})`);
  }

  const sgn = ccw ? 1 : -1;
  const facadeOffset = (x, z) => {
    let best = Infinity;
    let signed = 0;
    for (let i = 0; i < ring.length; i++) {
      const ax = ring[i][0], az = ring[i][1];
      const bx = ring[(i + 1) % ring.length][0], bz = ring[(i + 1) % ring.length][1];
      const L = Math.hypot(bx - ax, bz - az);
      if (!(L > 0)) continue;
      const tx = (bx - ax) / L, tz = (bz - az) / L;
      const nx = sgn * tz, nz = -sgn * tx;
      const t = Math.max(0, Math.min(L, (x - ax) * tx + (z - az) * tz));
      const qx = ax + tx * t, qz = az + tz * t;
      const d = Math.hypot(x - qx, z - qz);
      if (d < best) {
        best = d;
        signed = (x - qx) * nx + (z - qz) * nz;
      }
    }
    return signed;
  };
  let facade = 0;
  eachVertex(g, (x, y, z, name) => {
    if (!/facade-precast/.test(name)) return;
    const off = Math.abs(facadeOffset(x, z));
    near(off, wallOffset, STATION,
      `facade vertex at (${x.toFixed(3)}, ${z.toFixed(3)}) on ${name}`);
    facade++;
  });
  assert.ok(facade > 200, `only ${facade} facade vertices classified — the walk did not run`);
});

t("nothing hovers and nothing sinks — flat, an exaggerated slope, and the DRAWN LiDAR surface", () => {
  for (const [label, g] of [["flat", flat], ["slope", slope], ["drawn", drawn]]) {
    const built = build(g);
    const lift = overlayLift(section.draw.bedRung);

    /* The ground drapes sit exactly one rung above the drawn surface. */
    eachVertex(built.group, (x, y, z, name) => {
      if (!/^pacific-ground-/.test(name)) return;
      near(y, g(x, z) + lift, 5e-3,
        `${label}: ${name} is ${(y - g(x, z)).toFixed(3)} m over the drawn surface, not the ${lift} m rung it declares`);
    });

    /* Every facade run's foot is BELOW the drawn ground under it, so no wall
       can float, and the skirt is what makes that true on a sloped site. */
    const nearestEdge = (x, z) => {
      let best = -1;
      let bd = Infinity;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        const dx = b[0] - a[0];
        const dz = b[1] - a[1];
        const l2 = dx * dx + dz * dz;
        const tt = l2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2)) : 0;
        const d = Math.hypot(x - (a[0] + tt * dx), z - (a[1] + tt * dz));
        if (d < bd) { bd = d; best = i; }
      }
      return best;
    };
    /* Bucketed by RUN, not by edge: on the arcs a vertex 0.06 m proud of a
       0.6 m chord is often nearest to that chord's neighbour, which is a
       bucketing artefact and not a gap in the cladding. Every run gets its
       own foot, and that foot is checked against the ground everywhere
       along the run, because the skirt is cut to the run's LOWEST grade. */
    const runOf = new Map();
    for (const r of section.system.runs) {
      for (let i = r.v0; i < r.v1; i++) runOf.set(i, r.id);
    }
    const feet = new Map();
    eachVertex(built.group, (x, y, z, name) => {
      if (!/facade-precast/.test(name)) return;
      const k = runOf.get(nearestEdge(x, z));
      if (k === undefined) return;
      if (!feet.has(k) || y < feet.get(k).y) feet.set(k, { x, y, z, name });
    });
    assert.equal(feet.size, section.system.runs.length,
      `${label}: only ${feet.size} of the ${section.system.runs.length} runs carry precast — a surveyed face has stopped being clad`);
    for (const r of section.system.runs) {
      const f = feet.get(r.id);
      for (let i = r.v0; i < r.v1; i++) {
        const a = ring[i % ring.length];
        const b = ring[(i + 1) % ring.length];
        for (const tt of [0, 0.5, 1]) {
          const px = a[0] + (b[0] - a[0]) * tt;
          const pz = a[1] + (b[1] - a[1]) * tt;
          assert.ok(f.y <= g(px, pz) + 1e-6,
            `${label}: run ${r.id} floats ${(f.y - g(px, pz)).toFixed(3)} m over the drawn ground at (${px.toFixed(1)}, ${pz.toFixed(1)})`);
        }
      }
    }

    /* And nothing that stands on the ROOF may sink into the plate. */
    eachVertex(built.group, (x, y, z, name) => {
      if (!/penthouse/.test(name)) return;
      assert.ok(y >= section.system.stack.plateRepo - section.draw.penthouseWallThickness - 5e-3,
        `${label}: ${name} sinks through the roof plate`);
    });
  }
});

t("the ground drapes ride the overlay rung, never the world's own fill", () => {
  const g = build().group;
  const rung = section.draw.bedRung;
  let n = 0;
  g.traverse((o) => {
    if (!o.isMesh || !/^pacific-ground-/.test(o.name)) return;
    n++;
    assert.equal(o.renderOrder, OVERLAY[rung].renderOrder, `${o.name} renderOrder`);
    assert.equal(o.material.polygonOffset, true, `${o.name} has no polygon offset`);
    assert.equal(o.material.depthWrite, false, `${o.name} writes depth on a decal rung`);
    assert.equal(o.castShadow, false, `${o.name} casts a shadow — a ground decal must not`);
  });
  assert.equal(n, section.counts.groundRingsDraped);
});

t("nothing invented sits inside the measured building footprint", () => {
  const g = build().group;
  /* A bbox centre says nothing here — the planting band WRAPS the building,
     so its own bounding box is centred inside it. The claim is per vertex. */
  /* The planting band and the walk SHARE vertices with the building ring —
     the survey drew them against the wall — so the test is strict INTERIOR:
     inside the ring and clear of its boundary. */
  const distToRing = (x, z) => {
    let best = Infinity;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const l2 = dx * dx + dz * dz;
      const tt = l2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2)) : 0;
      best = Math.min(best, Math.hypot(x - (a[0] + tt * dx), z - (a[1] + tt * dz)));
    }
    return best;
  };
  let checked = 0;
  eachVertex(g, (x, y, z, name) => {
    if (!/^pacific-ground-/.test(name)) return;
    checked++;
    assert.equal(inRing(x, z, ring) && distToRing(x, z) > 0.05, false,
      `${name} has a vertex at (${x.toFixed(1)}, ${z.toFixed(1)}), ${distToRing(x, z).toFixed(2)} m inside Pacific's own footprint`);
  });
  assert.ok(checked > 500, `only ${checked} ground vertices scanned`);
  /* And no awning, bracket or stack may be inside it either. */
  eachPlacement(g, (b) => {
    if (!/awning|stack/.test(b.name)) return;
    if (/stack/.test(b.name)) return; // stacks stand ON the roof, by design
    assert.equal(inRing(b.x, b.z, ring), false,
      `${b.name} has a placement inside the surveyed footprint`);
  });
});

/* ------------------------------------------------------ record integrity */

t("S1(v): the absent list is non-shrinking and each entry still says what it withholds", () => {
  const expected = {
    "g1-construction-date-and-architect": /Plan\/Design\/Build|seismic|verified negative|Know Your Campus/i,
    "g2-north-and-east-facade-photographs": /18 panoramas|exhaustively/i,
    "g3-sub-half-module-window-rhythm": /0\.53-0\.64|honest limit|mullion/i,
    "g4-awning-extent-on-the-straight-face": /arcs/i,
    "g5-east-end-slot-identity": /UNDRESSED|light wells/i,
    "g6-elevated-structure-on-the-wing-west-flank": /40\.9|Level 5/i,
    "g7-penthouse-box-plan": /NOT DRAWN|enclosure/i,
    "g8-building-lettering": /never rendered/i,
    "g9-level-5-tata-bridge-opening": /tata/i,
    "transom-division-height": /not resolvable|no transom/i,
    "window-frame-colour": /no frame/i,
    "se-corner-bollards-and-lamp-column": /Recorded, unbuilt|not resolvable/i,
    "south-frontage-shrub-massing": /no species|undimensioned|no dimension/i,
    "ground-ring-1172-shared-frontage": /1172|not claimable whole/i,
    "ground-sliver-and-spur-colours": /#97|1773|shadow/i,
  };
  const n = assertAbsentEntries({ absent: section.absent, expected, label: "pacific" });
  assert.ok(n >= 15, `only ${n} absent entries`);
  for (const e of section.absent) {
    assert.ok(e.what.length > 120, `absent entry ${e.key} is a stub, not a withholding`);
  }

  /* And the withheld objects appear in NO mesh name — an absent entry that
     is quietly built is worse than one that is quietly deleted. */
  const names = [];
  build().group.traverse((o) => { if (o.isMesh) names.push(o.name); });
  for (const forbidden of [/bollard/i, /lamp/i, /shrub/i, /transom/i, /lettering/i,
    /bridge/i, /enclosure/i, /slot/i, /frame/i]) {
    assert.equal(names.some((nm) => forbidden.test(nm)), false,
      `something matching ${forbidden} is in the scene and is declared absent`);
  }
});

t("the conflicts stay declared, with their losing sides on the record", () => {
  const keys = section.conflicts.map((c) => c.key);
  for (const k of ["pacific-height-p98-vs-parapet", "pacific-osm-ring-oversize",
    "pacific-arcgis-h-formula", "pacific-oceanlight-21215-siting", "pacific-wing-storeys"]) {
    assert.ok(keys.includes(k), `conflict ${k} has left the record`);
  }
  for (const c of section.conflicts) {
    assert.ok(c.sides.length >= 2, `conflict ${c.key} has fewer than two sides`);
    assert.ok(c.resolution.length > 120, `conflict ${c.key} does not resolve in substance`);
    for (const s of c.sides) assert.ok(s.length > 40, `conflict ${c.key} has a side that says nothing`);
  }
  const height = section.conflicts.find((c) => c.key === "pacific-height-p98-vs-parapet");
  assert.match(height.resolution, /DEFINITION DISAGREEMENT/i,
    "the two height reads are correct about different objects, and the record must say so rather than averaging them");
  assert.match(height.resolution, /skipGis/,
    "the drawn prism's retirement is the other half of this resolution and main needs it stated");
  /* No conflict may be resolved by splitting the difference. */
  for (const c of section.conflicts) {
    assert.equal(/average|split the difference|midpoint of the two/i.test(c.resolution), false,
      `conflict ${c.key} reads as an average — sources are chosen, never blended`);
  }
});

t("nothing was superseded, and the record says so by fact rather than by omission", () => {
  assert.deepEqual(section.supersedes, []);
  assert.deepEqual(section.superseded, []);
  assert.match(section.supersededNote, /no key, no ring, no height, no colour role/i);
  assert.match(section.supersededNote, /REPLACES_MEASURED/);
  /* And nothing shipped in the doc claims Pacific, which is what makes the
     empty list true. */
  for (const [key, v] of Object.entries(shipped)) {
    if (key === "pacific" || typeof v !== "object" || v === null) continue;
    const txt = JSON.stringify(v);
    assert.equal(txt.includes(MKEY), false,
      `section ${key} already addresses ${MKEY} — this section's empty supersedes list is wrong`);
  }
});
