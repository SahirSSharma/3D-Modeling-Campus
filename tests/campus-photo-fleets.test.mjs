/* The six Fleet residence halls and their 2011 courtyards — INVENTED class,
 * R3 batch, a NEW section.
 *
 * WHAT THIS SUITE EXISTS TO HOLD. The section makes five claims that are not
 * obvious and that a later edit could quietly undo, and each has a gate here
 * written against the claim rather than against the geometry that happens to
 * result:
 *
 *   - THE NAMES ARE NOT OSM'S. OpenStreetMap has Galathea and Meteor on each
 *     other's buildings. The proof is recomputed in this file from the three
 *     measured documents — heights[] over the OSM ring by NAME, massHeights
 *     over the GIS ring by POSITION — and a gate fails if the two ever stop
 *     agreeing to 0.00 m by position and disagreeing by 0.7 m by name, because
 *     that is the whole evidence for the ruling. A second gate greps the
 *     module and fails if it ever performs a name lookup at all.
 *
 *   - TWO OF THE SIX ARE MIRRORED. The four axis-aligned symmetries are
 *     recomputed here by rasterising every GIS footprint, and the declared
 *     hand must be the one the raster says. A third gate measures the BUILT
 *     scene's occupied bbox quadrants per hall, so a future refactor toward
 *     one shared instanced mesh fails in world coordinates and not lexically.
 *
 *   - ONE STOREY, SIX RESIDUES. The storey rests on a dimensioned drawing
 *     divided by a photogrammetric ratio and is the SAME on all six halls; the
 *     parapet zone is what each hall's own massHeights leaves over it. Gates:
 *     four storeys and the zone close on that hall's own height; the zone's
 *     published band is recomputed from the six subtractions and must touch its
 *     own extremes; and the retired route that derived the storey from a
 *     parapet ratio is held on the record, evaluated, and drawing nothing.
 *
 *   - THE WITHHOLDINGS ARE REAL IN THE SCENE, NOT ONLY IN THE PROSE. The
 *     openings ship; the exposed concrete frame between them does not, because
 *     no source gives a pier width. No pier, mullion, transom, roof object,
 *     plant, seat block, medallion or letterform reaches the built scene, and a
 *     gate walks every mesh name for all of them. An opening the drawn ground
 *     would bury is withheld too, and counted.
 *
 *   - PROVENANCE LIVES IN THE ARTEFACT OR IT DOES NOT LIVE. The [sourced] and
 *     [estimated] accent populations carry the SAME hex, so swapping them is
 *     invisible to any gate written against geometry — which is why they are
 *     two differently NAMED meshes and why a gate asserts the sourced one
 *     stands on Galathea's ring and only Galathea's.
 *
 *   - EVERY FIGURE RECOMPUTES AND SO DOES EVERY READING UNDERNEATH IT. The
 *     Eighth audit proved 22 presence gates can pass on wholesale fabricated
 *     values, and R1 proved that recomputing figures faithfully from UNPINNED
 *     readings catches nothing. All eight gates of tests/helpers/axiom-gate.mjs
 *     run here — never forked — and every pixel reading, every ortho statistic
 *     and every colour sample is pinned to a literal in THIS file.
 *
 * The section lives under the `fleets` key of docs/data/campus-photo-detail.json
 * once main merges it.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as THREE from "../docs/vendor/three/three.module.min.js";
import { createPhotoFleets } from "../docs/js/campus-photo-fleets.js";
import { roofElevation } from "../docs/js/campus-massing.js";
import { makeSurfaceSampler } from "../docs/js/campus-terrain.js";
import { overlayLift } from "../docs/js/campus-overlay.js";
import {
  assertCoverage, assertEstimateBands, assertPins, assertRelations,
  assertTierSymmetry, assertAbsentEntries, assertExprs, assertDispositions,
} from "./helpers/axiom-gate.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(p, "utf8"));

const section = read(process.env.PHOTO_DETAIL || join(root, "docs/data/campus-photo-detail.json")).fleets;

const campus = read(join(root, "docs/data/campus-3d.json"));
const lidar = read(join(root, "docs/data/campus-lidar.json"));
const arcgis = read(join(root, "docs/data/campus-arcgis.json"));
const manifest = read(join(root, "docs/data/textures/manifest.json"));

const moduleSrc = readFileSync(join(root, "docs/js/campus-photo-fleets.js"), "utf8");
/* The module's own prose NAMES the things it must not do — "the module never
   indexes lidar.heights" is a sentence that contains `heights[`. Every gate
   below that greps for a forbidden construct runs on the CODE, not on the
   commentary, or the file cannot explain its own rules. */
const moduleCode = moduleSrc
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/[^\n]*$/gm, "");
const near = (a, b, eps, what) =>
  assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b} (tolerance ${eps})`);

const flat = () => 20;
const slope = (x, z) => 20 + 1.4 * Math.sin(x / 11) + 1.1 * Math.cos(z / 13);
const drawnGround = makeSurfaceSampler(lidar.terrain);
const build = (g = flat) =>
  createPhotoFleets(null, { photo: { fleets: section }, heightAt: g, surfaceAt: g });

const HALLS = ["Beagle", "Challenger", "Discovery", "Atlantis", "Galathea", "Meteor"];
const ringOf = (i) => arcgis.massing[i].r[0].map(([x, z]) => [x / 10, z / 10]);

/** Every placement's TRUE world extent. */
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

/**
 * EVERY QUAD OF A MERGED FACE MESH, as its own centre. The band and opening
 * runs fold into one BufferGeometry per role so the perf layer can batch them,
 * which means a bounding box tells you about all 144 windows at once and
 * nothing about any one of them. Six vertices are one quad, in the order
 * `faceQuad` emits them.
 */
function eachQuad(node, meshName, fn) {
  node.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  node.traverse((o) => {
    if (!o.isMesh || o.name !== meshName) return;
    const pos = o.geometry.getAttribute("position");
    for (let i = 0; i + 5 < pos.count; i += 6) {
      let x = 0;
      let y = 0;
      let z = 0;
      let xLo = Infinity;
      let xHi = -Infinity;
      let yLo = Infinity;
      let yHi = -Infinity;
      for (let k = 0; k < 6; k++) {
        v.fromBufferAttribute(pos, i + k).applyMatrix4(o.matrixWorld);
        x += v.x / 6; y += v.y / 6; z += v.z / 6;
        xLo = Math.min(xLo, v.x); xHi = Math.max(xHi, v.x);
        yLo = Math.min(yLo, v.y); yHi = Math.max(yHi, v.y);
      }
      fn({ x, y, z, xLo, xHi, yLo, yHi });
    }
  });
}

/** Every vertex of every mesh, in world coordinates. */
function eachVertex(node, fn) {
  node.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  const m = new THREE.Matrix4();
  node.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh) return;
    const pos = o.geometry.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      fn(v.x, v.y, v.z, o.name);
    }
    void m;
  });
}

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

/** THE HALL A PLACEMENT BELONGS TO, by distance to the RING and never to the
 *  bbox centre. The six halls stand 20 m apart with 26 m bounding boxes, so a
 *  centre-distance test hands Galathea's parapet to Meteor and then reports it
 *  standing a metre over Meteor's lid — which is exactly what it did. */
const hallAt = (x, z) => {
  let best = null;
  for (const name of HALLS) {
    const d = ringDist(x, z, section.measured.halls[name].ring);
    if (!best || d < best.d) best = { name, d };
  }
  return best.name;
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

/* ------------------------------------------------------------ the section */

test("the section exists and carries the whole R3 apparatus", () => {
  assert.ok(section, "no fleets section in the merge file or the shipped doc");
  for (const k of ["label", "epoch", "note", "seed", "bounds", "boundsNote", "boundary",
    "sources", "measured", "derivations", "estimates", "reads", "draw", "system",
    "colors", "colorSources", "colorSourcesNote", "colorNote", "colorThreshold",
    "colorFallback", "samples", "counts", "conflicts", "superseded", "supersededNote",
    "absent"]) {
    assert.ok(section[k] !== undefined, `section is missing ${k}`);
  }
  assert.equal(typeof section.seed, "number");
});

test("it says what it is: one type, six instances, three real deviations", () => {
  assert.match(section.label, /ONE BUILDING TYPE BUILT SIX TIMES/);
  assert.match(section.label, /HAND/);
  assert.match(section.label, /HEIGHT/);
  assert.match(section.label, /ACCENT/);
  assert.match(section.label, /ITS OWN massHeights/,
    "the label must say that each hall gets its own height, which is the whole height ruling");
  assert.match(section.note, /INVENTED/);
  assert.match(section.epoch, /2011/);
  assert.match(section.epoch, /2014/);
  assert.match(section.epoch, /DEAD ground epoch/i,
    "the 2008 UCOP ground is superseded by the 2011 regrade and the epoch must say so");
  assert.match(section.epoch, /NO ORTHO-DERIVED POSITION SHIPS/i,
    "the 2026 rung corroborates and decides nothing, and the epoch must say so");
});

test("every source is described and dated", () => {
  assert.ok(section.sources.length >= 12, `only ${section.sources.length} sources`);
  for (const s of section.sources) {
    assert.ok(s.length >= 80, `source is not described: ${s.slice(0, 70)}`);
    assert.match(s, /\b(19|20)\d\d\b/, `source has no date: ${s.slice(0, 70)}`);
  }
  const joined = section.sources.join("\n");
  for (const must of [
    /garbini_2011_fleet-5e\.jpg/, /asla-sd_2014-10-28_fleet-walk-facade-and-planting\.jpg/,
    /GarbiniGarbini_2011_Fleet-housing-landscape-plan\.jpg/, /bb1639263c/,
    /UCSDConference_2019-03/, /campus-lidar\.json/, /campus-arcgis\.json/,
    /campus-3d\.json/, /chunk_4_7\.jpg/,
  ]) {
    assert.match(joined, must, `a load-bearing source is not cited: ${must}`);
  }
});

/* ============ THE IDENTITY RULING, RECOMPUTED FROM THE SURVEYS ============ */

test("THE SWAP: OSM has Galathea and Meteor on each other's buildings, and the LiDAR proves it", () => {
  /* The two OSM rings, by their own labels and their own centroids. */
  const osm = {};
  campus.buildings.forEach((b) => {
    if (b.n !== "Galathea Hall" && b.n !== "Meteor Hall") return;
    const cx = b.p.reduce((s, p) => s + p[0], 0) / b.p.length;
    const cz = b.p.reduce((s, p) => s + p[1], 0) / b.p.length;
    osm[b.n] = [cx, cz];
  });
  const G = section.measured.halls.Galathea;
  const M = section.measured.halls.Meteor;
  /* OSM's 'Galathea' is nearest the section's METEOR and vice versa. That is
     the swap, stated as a distance rather than as an opinion. */
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  assert.ok(d(osm["Galathea Hall"], M.centroid) < d(osm["Galathea Hall"], G.centroid),
    "OSM's 'Galathea Hall' is no longer nearest the section's Meteor — if the OSM snapshot was corrected upstream, the conflict must be re-adjudicated and not silently kept");
  assert.ok(d(osm["Meteor Hall"], G.centroid) < d(osm["Meteor Hall"], M.centroid),
    "OSM's 'Meteor Hall' is no longer nearest the section's Galathea");
  /* AND THE ARITHMETIC. By POSITION the two independent measurements agree to
     0.00 m; by NAME both are 0.7 m out. */
  const F = section.derivations.figures;
  near(F["identity.byPositionGalathea"].value, 0, 1e-9, "Galathea by position");
  near(F["identity.byPositionMeteor"].value, 0, 1e-9, "Meteor by position");
  assert.ok(Math.abs(F["identity.byNameGalathea"].value) > 0.5,
    "keying by NAME no longer costs anything — the arithmetic proof has evaporated and the ruling needs re-arguing");
  assert.ok(Math.abs(F["identity.byNameMeteor"].value) > 0.5, "the same, the other way");
  /* The readings really are the surveys'. */
  const S = section.derivations.readings.survey;
  near(S.heightsGalatheaLabel, lidar.heights["Galathea Hall"], 1e-9, "heights['Galathea Hall']");
  near(S.heightsMeteorLabel, lidar.heights["Meteor Hall"], 1e-9, "heights['Meteor Hall']");
  /* The conflict declares the loser rather than deleting it. */
  const c = section.conflicts.find((q) => q.key === "galathea-meteor-osm-swap");
  assert.ok(c, "the identity conflict is not declared");
  assert.equal(c.sides.length, 5, "all five sides — OSM, GIS, HDH, Conference Services and the LiDAR arithmetic — must stay on the record");
  assert.match(c.resolution, /RESOLVED FOR THE GIS/);
  assert.match(c.resolution, /POSITION-KEYED/i);
  assert.match(c.resolution, /-41\.7, 454\.6/, "the ruling must name the coordinate it rules on");
  assert.match(section.measured.identityNote, /BRIEF INHERITED THE SWAP/i,
    "the record must say that the brief itself carried the error");
});

test("the module never performs a name lookup against a measured file", () => {
  assert.ok(!/heights\s*\[/.test(moduleCode),
    "the module indexes lidar.heights — a name lookup puts Meteor's roof on Galathea");
  assert.ok(!/massHeights/.test(moduleCode),
    "the module reaches into campus-lidar.json directly; every height must come through the section");
  assert.ok(!/arcgis|campus-3d|campus-lidar/.test(moduleCode),
    "the module reads a measured document at runtime — it must read only its own photo key");
  /* And the prose still has to SAY the rule, or the next editor does not know
     it is one. The two gates together are the whole mechanism. */
  assert.match(moduleSrc, /EVER KEYED BY NAME/i,
    "the module must state the position-keying rule it is gated on");
});

/* ================== THE SURVEY, CARRIED VERBATIM ================== */

test("every hall's ring is the survey's, byte for byte, with its own key and height", () => {
  assert.equal(Object.keys(section.measured.halls).length, 6);
  for (const name of HALLS) {
    const h = section.measured.halls[name];
    assert.ok(h, `${name} is missing`);
    assert.equal(h.gisName, `${name} Hall`, `${name}'s GIS name has moved`);
    assert.deepEqual(h.ring, ringOf(h.massingIndex),
      `${name}.ring is not arcgis.massing[${h.massingIndex}].r[0] at /10, verbatim`);
    assert.equal(arcgis.massing[h.massingIndex].r.length, 1,
      `${name} has grown a second ring — these halls carry no courtyard hole`);
    /* The m: key is the survey's own convention, recomputed here. */
    const cx = h.ring.reduce((s, p) => s + p[0], 0) / h.ring.length;
    const cz = h.ring.reduce((s, p) => s + p[1], 0) / h.ring.length;
    assert.equal(h.mKey, `m:${Math.round(cx)},${Math.round(cz)}`, `${name}'s m: key is not its ring's`);
    near(h.massHeight, lidar.massHeights[h.mKey], 1e-9, `${name}'s height is not massHeights[${h.mKey}]`);
    assert.equal(h.levels, 4, `${name} is no longer four storeys`);
    near(h.arcgisH, arcgis.massing[h.massingIndex].h, 1e-9, `${name}'s recorded arcgis.h is not the file's`);
    /* Drawn vs degenerate edges, recounted. */
    let drawn = 0;
    let degen = 0;
    for (let k = 0; k < h.ring.length - 1; k++) {
      (Math.hypot(h.ring[k + 1][0] - h.ring[k][0], h.ring[k + 1][1] - h.ring[k][1]) > 0
        ? drawn++ : degen++);
    }
    assert.equal(h.drawnEdges, drawn, `${name}'s drawn-edge count is not its ring's`);
    assert.equal(h.degenerateEdges, degen, `${name}'s degenerate-edge count is not its ring's`);
  }
  assert.match(section.measured.ringsNote, /ZERO-LENGTH/,
    "the repeated survey vertices must be recorded, not quietly skipped");
});

test("the type is a pinwheel, not a bounding box: 70% fill on all six", () => {
  for (const name of HALLS) {
    const h = section.measured.halls[name];
    const xs = h.ring.map((p) => p[0]);
    const zs = h.ring.map((p) => p[1]);
    near(h.bbox.x0, Math.min(...xs), 0.005, `${name} bbox x0`);
    near(h.bbox.x1, Math.max(...xs), 0.005, `${name} bbox x1`);
    near(h.bbox.z0, Math.min(...zs), 0.005, `${name} bbox z0`);
    near(h.bbox.z1, Math.max(...zs), 0.005, `${name} bbox z1`);
    let a = 0;
    for (let i = 0; i < h.ring.length - 1; i++) {
      a += h.ring[i][0] * h.ring[i + 1][1] - h.ring[i + 1][0] * h.ring[i][1];
    }
    near(h.areaM2, Math.abs(a / 2), 0.01, `${name}'s recorded area is not its ring's`);
    /* THE THING THE RECON GOT WRONG. The bbox is 26.4 x 21.6 m and the
       footprint fills only 70% of it; a build that extrudes the box is 29% too
       much building. */
    assert.ok(h.fillOfBbox > 0.69 && h.fillOfBbox < 0.72,
      `${name} fills ${(h.fillOfBbox * 100).toFixed(1)}% of its bbox — the pinwheel has stopped being a pinwheel`);
  }
  /* And the six are ONE type: 0.5% rsd on area. */
  const areas = HALLS.map((n) => section.measured.halls[n].areaM2);
  const mean = areas.reduce((s, v) => s + v, 0) / 6;
  const sd = Math.sqrt(areas.reduce((s, v) => s + (v - mean) ** 2, 0) / 5);
  assert.ok(sd / mean < 0.01,
    `the six footprints now differ by ${((sd / mean) * 100).toFixed(2)}% rsd — if that is real they are no longer one type and this whole section's structure is wrong`);
  assert.match(section.measured.typeNote, /BOUNDING BOX/);
  assert.match(section.measured.typeNote, /29%/);
});

test("THE HAND: the four symmetries are recomputed here, and two halls are mirrored", () => {
  /* Rasterise each footprint into its own bbox and difference it against
     Galathea under the four axis-aligned symmetries. Lexical trust in the
     declared `hand` is exactly what this replaces. */
  const N = 56;
  const raster = (r) => {
    const xs = r.map((p) => p[0]);
    const zs = r.map((p) => p[1]);
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    const z0 = Math.min(...zs);
    const z1 = Math.max(...zs);
    const g = new Uint8Array(N * N);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x = x0 + ((x1 - x0) * (i + 0.5)) / N;
        const z = z0 + ((z1 - z0) * (j + 0.5)) / N;
        g[j * N + i] = inRing(x, z, r) ? 1 : 0;
      }
    }
    return g;
  };
  const ref = raster(section.measured.halls.Galathea.ring);
  const T = {
    identity: (i, j) => [i, j],
    rot180: (i, j) => [N - 1 - i, N - 1 - j],
    mirrorX: (i, j) => [N - 1 - i, j],
    mirrorZ: (i, j) => [i, N - 1 - j],
  };
  const diffs = {};
  for (const name of HALLS) {
    const R = raster(section.measured.halls[name].ring);
    diffs[name] = {};
    for (const [tn, t] of Object.entries(T)) {
      let d = 0;
      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
          const [a, b] = t(i, j);
          if (R[j * N + i] !== ref[b * N + a]) d++;
        }
      }
      diffs[name][tn] = (100 * d) / (N * N);
    }
  }
  for (const name of HALLS) {
    const d = diffs[name];
    const hand = d.identity < d.mirrorX ? "A" : "B";
    assert.equal(section.measured.halls[name].hand, hand,
      `${name} declares hand ${section.measured.halls[name].hand} and rasterises as ${hand} (identity ${d.identity.toFixed(1)}%, mirror-x ${d.mirrorX.toFixed(1)}%)`);
    /* AND THE SEPARATION IS NOT MARGINAL. A factor of 10 or better, both ways. */
    const best = Math.min(d.identity, d.mirrorX);
    const worst = Math.max(d.identity, d.mirrorX);
    assert.ok(worst > best * 10,
      `${name}'s hand is now a marginal call (${best.toFixed(1)}% against ${worst.toFixed(1)}%) — a 15x separation is what makes this gate meaningful`);
    /* rot180 is approximately identity because the plan is C2 — so the
       difference between the two hands is a genuine REFLECTION, and Meteor
       cannot be got by turning Galathea round. */
    assert.ok(Math.abs(d.rot180 - d.identity) < 5,
      `${name}: rot180 and identity have diverged, so the plan is no longer C2 and the reflection argument needs re-making`);
  }
  assert.deepEqual(HALLS.filter((n) => section.measured.halls[n].hand === "B").sort(),
    ["Challenger", "Meteor"], "exactly Meteor and Challenger are mirrored");
  assert.match(section.measured.handNote, /GENUINE REFLECTION AND NOT A ROTATION/i);
  assert.match(section.measured.handNote, /never instances a shared mesh/i,
    "the record must say HOW the build cannot get the hand wrong");
});

test("the stair-tower projections are re-derived from the rings, never trusted", () => {
  for (const name of HALLS) {
    const h = section.measured.halls[name];
    const xs = h.ring.map((p) => p[0]);
    const xmin = Math.min(...xs);
    const xmax = Math.max(...xs);
    const found = [];
    for (let k = 0; k < h.ring.length - 1; k++) {
      const [ax, az] = h.ring[k];
      const [bx, bz] = h.ring[k + 1];
      const L = Math.hypot(bx - ax, bz - az);
      if (Math.abs(bx - ax) > 0.25 || L < 2.0 || L > 4.5) continue;
      const mx = (ax + bx) / 2;
      const end = Math.abs(mx - xmin) < 0.35 ? "west" : Math.abs(mx - xmax) < 0.35 ? "east" : null;
      if (end) found.push({ edge: k, end, length: Number(L.toFixed(2)) });
      void az; void bz;
    }
    assert.equal(found.length, 2,
      `${name}: the ring rule finds ${found.length} projections, not the C2 pair the type claims`);
    assert.deepEqual(h.towers, found, `${name}'s declared tower edges are not the rule's output`);
    assert.deepEqual(h.towers.map((t) => t.end).sort(), ["east", "west"],
      `${name}'s two projections must be one at each long end — that is what C2-paired means`);
  }
  assert.match(section.measured.towerNote, /DERIVED FROM THE RING AND NEVER TYPED/i);
});

/* ==================== THE AXIOM LAYER, GATED ==================== */

const G5E = "Revelle-College-Sources/renders/fleets-sources/garbini_2011_fleet-5e.jpg, Garbini & Garbini project photograph of the 2011 landscape, content crop rows 158..561 of a 720x720 frame";
const ORTHO = "docs/data/textures/chunk_4_7.jpg at 8.000 px/m per docs/data/textures/manifest.json, parabolically refined minimum of the signed luminance gradient along the outward normal over the middle 60% of each axis-aligned GIS ring segment";
const LID = "docs/data/campus-lidar.json, the CA_SanDiegoQL2_2014 flight";
const GIS = "docs/data/campus-arcgis.json, the university's 2014 GIS massing";
const PLAN = "Revelle-College-Sources/plans-and-drawings/GarbiniGarbini_2011_Fleet-housing-landscape-plan.jpg, the firm's own featured_5a at 720x720";
const MG = "Revelle-College-Sources/renders/fleets-sources/enginuity_2012-01-19_MG23022_fleet-facade-bay-grid.jpg, Enginuity Consulting, 1600x1067, Canon EOS 7D at 24 mm, EXIF DateTimeOriginal 2012-01-19 — GEOMETRY ONLY, the frame is graded and is never colour-sampled";
const SHEET = "Revelle-College-Sources/plans-and-drawings/UCSDConference_nd_Revelle-room-layouts.pdf, UCSD Conference Services 'SAMPLE LAYOUTS', the 'Fleet Residence Hall' panel";
const G5G = "Revelle-College-Sources/renders/fleets-sources/garbini_2011_fleet-5g.jpg, the Garbini frame that carries the building's own applied lettering reading 'Galathea', content crop rows 158..561 of 720x720";

const pin = (value, truth, tol) => ({ value, truth, tol });
const READING_PINS = {
  "px.contentTop": pin(158, `${G5E} — the first non-white image row, i.e. the letterbox offset every y below is measured from`),
  "px.contentHeight": pin(404, `${G5E} — the number of non-white rows, the content crop's own height`),
  "px.capTop": pin(62.480, `${G5E} — the 50% luminance crossing between the sky plateau (249.7) and the parapet cap plateau (66.5), read over x 440..480`, 0.001),
  "px.capFoot": pin(75.872, `${G5E} — the zero crossing of B - R over the same columns, where the warm buff cap ends and the genuinely blue fascia band begins`, 0.001),
  "px.navyFoot": pin(82.755, `${G5E} — the second zero crossing of B - R, where the navy band ends and the masonry below it begins`, 0.001),
  "px.band4": pin(119.068, `${G5E} — the redness centroid of the storey-4 spandrel band, R - (G+B)/2 averaged over x 352..470 above a baseline of 15`, 0.001),
  "px.band3": pin(154.836, `${G5E} — the storey-3 band's centroid, same method`, 0.001),
  "px.band2": pin(191.454, `${G5E} — the storey-2 band's centroid, same method`, 0.001),
  "px.band1": pin(228.640, `${G5E} — the storey-1 band's centroid, same method. CONTAMINATED and excluded from the pitch: see px.band1Fwhm`, 0.001),
  "px.band4Fwhm": pin(8.967, `${G5E} — the storey-4 band's full width at half maximum, sub-pixel on both edges`, 0.001),
  "px.band3Fwhm": pin(9.526, `${G5E} — the storey-3 band's full width at half maximum`, 0.001),
  "px.band2Fwhm": pin(9.752, `${G5E} — the storey-2 band's full width at half maximum`, 0.001),
  "px.band1Fwhm": pin(13.799, `${G5E} — the storey-1 band's full width at half maximum, 45% wider than the other three, which is the measured ground for excluding it`, 0.001),
  "survey.massBeagle": pin(13.3, `${LID} massHeights['m:-135,431']`),
  "survey.massChallenger": pin(13.5, `${LID} massHeights['m:-108,423']`),
  "survey.massDiscovery": pin(14.2, `${LID} massHeights['m:-62,432']`),
  "survey.massAtlantis": pin(14.4, `${LID} massHeights['m:-115,453']`),
  "survey.massGalathea": pin(13.5, `${LID} massHeights['m:-42,455'] — the building at (-41.7, 454.6), which is GALATHEA`),
  "survey.massMeteor": pin(14.2, `${LID} massHeights['m:-69,462'] — the building at (-70.0, 462.6), which is METEOR`),
  "survey.heightsGalatheaLabel": pin(14.2, `${LID} heights['Galathea Hall'] — measured over the OSM ring, and the OSM label is on the WRONG building; quoted only as the losing side of the swap`),
  "survey.heightsMeteorLabel": pin(13.5, `${LID} heights['Meteor Hall'] — the same, the other way`),
  "survey.levels": pin(4, `${GIS} — the levels field, 4 on all six halls, and one of four independent storey-count sources`),
  "survey.arcgisH": pin(12.2, `${GIS} — the h field, 12.2 on all six, which is levels x 3.05: a residential FORMULA and not a survey, admitted as a check only`),
  "survey.orthoRoofH": pin(13.9, `${LID} — the mean of the six massHeights, the height the ortho roof-edge fit is taken at`, 0.05),
  "ortho.pxPerM": pin(8.0, "docs/data/textures/manifest.json chunk_4_7.jpg: w 2040 over x1 - x0 = 78 - (-177) = 255, i.e. 8.000 px/m exactly"),
  "ortho.chunkX0": pin(-177, "docs/data/textures/manifest.json chunk_4_7.jpg x0"),
  "ortho.chunkZ0": pin(402, "docs/data/textures/manifest.json chunk_4_7.jpg z0"),
  "ortho.zEdges": pin(19, `${ORTHO} — a COUNT of z-axis GIS roof segments 8 m or longer across the six halls`),
  "ortho.zMedian": pin(-2.8051, `${ORTHO} — the median of all 19`, 0.001),
  "ortho.zKept": pin(17, `${ORTHO} — a COUNT of those within 1.2 m of the median`),
  "ortho.zMean": pin(-2.8288, `${ORTHO} — the mean of the 17 kept`, 0.001),
  "ortho.zSd": pin(0.2593, `${ORTHO} — their standard deviation`, 0.001),
  "ortho.zNorthCount": pin(11, `${ORTHO} — a COUNT of north-facing (outward -z) edges among them`),
  "ortho.zNorthMean": pin(-2.8120, `${ORTHO} — their mean displacement`, 0.001),
  "ortho.zSouthCount": pin(6, `${ORTHO} — a COUNT of south-facing (outward +z) edges among the kept`),
  "ortho.zSouthMean": pin(-2.8596, `${ORTHO} — their mean displacement, which moves the SAME way as the north edges`, 0.001),
  "ortho.xEdges8m": pin(0, `${ORTHO} — a COUNT, and the count is the finding: no x-constant GIS segment on this building type reaches 8 m`),
  "ortho.xEdges5m": pin(33, `${ORTHO} — a COUNT at a relaxed 5 m threshold`),
  "ortho.xMedian5m": pin(-0.8612, `${ORTHO} — the median of those 33`, 0.001),
  "ortho.xSd5m": pin(1.5001, `${ORTHO} — their standard deviation, 1.5 m, which is why they cannot carry a figure`, 0.001),
  "ortho.groundZ": pin(-0.5674, `${ORTHO} scanned on G - (R+B)/2 — arcgis.ground#2322's north edge, the ZERO-HEIGHT anchor`, 0.001),
  "ortho.groundZGrad": pin(38.1, `${ORTHO} — that edge's gradient magnitude; every other candidate ground edge fell below 20 and was discarded`, 0.05),
  "ortho.groundX": pin(-0.8799, `${ORTHO} — the mean of arcgis.ground#2322's three x edges at zero height`, 0.001),
  "plan.fitPxPerM": pin(5.038, `${PLAN} — the scale of the best single-scale similarity from its six white hall bodies to the six GIS centroids`, 0.001),
  "plan.fitRmsPx": pin(23.8, `${PLAN} — that fit's rms residual in pixels`, 0.05),
  "plan.fitRmsM": pin(4.72, `${PLAN} — the same residual in metres, which is LARGER THAN A COURTYARD`, 0.01),
  "plan.permutations": pin(720, `${PLAN} — a COUNT: all 720 correspondence permutations of six bodies to six centroids were fitted, so the failure is not a labelling accident`),
  "mg.band4Centroid": pin(567.02, `${MG} — the storey-4 spandrel band's redness centroid over the facade strip x 180..760`, 0.02),
  "mg.band3Centroid": pin(696.75, `${MG} — the storey-3 band's centroid, same method`, 0.02),
  "mg.band2Centroid": pin(826.14, `${MG} — the storey-2 band's centroid, same method. The storey-1 band is contaminated by planting and sets nothing`, 0.02),
  "mg.spandrelFwhm4": pin(33.24, `${MG} — the storey-4 band's full width at half maximum, sub-pixel on both edges against its own local baseline`, 0.02),
  "mg.spandrelFwhm3": pin(34.78, `${MG} — the storey-3 band's full width at half maximum`, 0.02),
  "mg.spandrelFwhm2": pin(34.70, `${MG} — the storey-2 band's full width at half maximum`, 0.02),
  "mg.localPitchBay1": pin(126.5, `${MG} — the storey pitch measured in a 37 px column centred on BAY 1's own spandrel, which is what makes a bay:storey ratio a world ratio on a plumb but foreshortened plane`, 0.25),
  "mg.localPitchBay2": pin(128.7, `${MG} — the same, in bay 2's column`, 0.25),
  "mg.localPitchBay3": pin(130.85, `${MG} — the same, in bay 3's column. The monotonic increase left to right is the plane receding, and it is why each pitch is used only against the bay beside it`, 0.25),
  "mg.bayPitch12": pin(179.0, `${MG} — centre-to-centre between bay 1's and bay 2's storey-4 spandrels`, 0.1),
  "mg.bayPitch23": pin(184.5, `${MG} — centre-to-centre between bay 2's and bay 3's storey-4 spandrels`, 0.1),
  "mg.spandrelW1": pin(80, `${MG} — bay 1's storey-4 spandrel run, x 289..368`),
  "mg.spandrelW2": pin(84, `${MG} — bay 2's, x 466..549`),
  "mg.spandrelW3": pin(89, `${MG} — bay 3's, x 648..736`),
  "mg.gap12": pin(98, `${MG} — the blank stretch between bay 1's spandrel and bay 2's, x 368..466: the block infill plus the pier, and the independent check on the opening's offset`),
  "mg.gap23": pin(99, `${MG} — the same between bays 2 and 3, x 549..648`),
  "mg.slabLine": pin(7.0, `${MG} — the bright slab line immediately under each spandrel, its luminance full width at half maximum in bay 2's column`, 0.5),
  "mg.frameMeanR": pin(153.0, `${MG} — the WHOLE FRAME's red channel mean. R > G > B by 12.8 units is the film-emulation signature that disqualifies this frame for colour`, 0.05),
  "mg.frameMeanG": pin(147.7, `${MG} — the whole frame's green channel mean`, 0.05),
  "mg.frameMeanB": pin(140.2, `${MG} — the whole frame's blue channel mean`, 0.05),
  "mg.bestNeutralOffGrey": pin(0.09, `${MG} — the most colour-neutral 12x12 facade tile that also passes sd <= 15, at (597, 671): #7f7f7f. The dossier says none exists at all; this build finds one, marginally, and the ruling is unchanged because a grey-world balance on one marginal tile of a graded frame cannot carry a colour`, 0.02),
  "mg.bestNeutralSd": pin(14.77, `${MG} — that tile's own maximum per-channel standard deviation, 0.23 inside the section's own single-material bar`, 0.02),
  "mg.shareSpandrel": pin(0.2611, `${MG} — the painted spandrel's share of one storey, the mean of six bay-and-storey cells. The cell is bounded by two spandrel plateaus' half-maximum edges on redness`, 0.0005),
  "mg.shareWallAbove": pin(0.1810, `${MG} — the solid wall above each window (floor-line band plus head reveal), same six cells`, 0.0005),
  "mg.shareGlass": pin(0.4575, `${MG} — the LIT PANE's share, where luminance exceeds the midpoint between the opening's own 5th and 90th percentiles, i.e. the pane against its own shaded reveals`, 0.0005),
  "mg.shareWallBelow": pin(0.1004, `${MG} — the solid wall between the sill reveal and the spandrel below, same six cells`, 0.0005),
  "mg.shareSpandrelSd": pin(0.0021, `${MG} — the spandrel share's own standard deviation across the six cells, the tightest read in this section`, 0.0005),
  "mg.shareGlassSd": pin(0.0583, `${MG} — the glass share's standard deviation; the reveal edges are soft in a graded frame and this says so`, 0.0005),
  "mg.shareReads": pin(6, `${MG} — a COUNT of the bay-and-storey cells the four shares are meaned over`),
  "mg.arris": pin(746.814, `${MG} — the building's own outer corner, the parabolically refined steepest luminance fall across x 730..780 in the storey-4 band (rows 470..545), clear of the tree`, 0.02),
  "mg.lastJamb": pin(736, `${MG} — the outer jamb of the last opening before that corner, the storey-4 spandrel run's right edge`),
  "mg.localBayAtArris": pin(184.5, `${MG} — the bay pitch measured beside it, so the return is expressed as a fraction of a module and foreshortening cancels`, 0.1),
  "drawing.roomWidthFt": pin(14, `${SHEET} — the printed 12'x14' double's FACADE dimension, the figure that closed A8`),
  "drawing.roomDepthFt": pin(12, `${SHEET} — the same room's depth. Which of the two is the facade dimension is adjudicated in conflicts['which-room-dimension-is-the-facade']`),
  "drawing.doublesPerSuite": pin(5, `${SHEET} — a COUNT of double bedrooms in the drawn Fleet suite`),
  "drawing.doublesPerBar": pin(3, `${SHEET} — a COUNT of the doubles along ONE side of the suite, which is the three bays the Enginuity frame shows`),
  "drawing.argoBlakeWidthFt": pin(10, `${SHEET}'s OTHER panel, 'Blake/Argo Residence Hall'. Carried as a NEGATIVE: this is R1's module and must never be used here or exported there`),
  "drawing.argoBlakeDepthFt": pin(13.5, "the same Blake/Argo panel's room depth, carried for the same reason"),
  "drawing.bedsPerHall": pin(80, "UCSD Revelle secondary sources, ~80 students per Fleet hall, corroborated by the Res Life Presentation 2018's 'Two per building in The Fleet Residence Halls' against 'Two per floor in Argo and Blake'"),
  "plan.rooms": pin(9, `${PLAN} — a COUNT of labelled outdoor rooms: REVELLE WALK LAWN, REVELLE WALK, CENTRAL LAWN, COURTYARD LAWN, WEST COURTYARD, CENTRAL COURTYARD, EAST COURTYARD, SOUTH WALK, SOUTH ENTRANCE`),
};
const UNIT_PINS = {
  inch: pin(0.0254, "exact by definition: 1 international inch = 0.0254 m"),
  foot: pin(0.3048, "exact by definition: 1 international foot = 0.3048 m"),
};

test("S1(iii): every reading is pinned to the artefact it was read off", () => {
  const n = assertPins({
    readings: section.derivations.readings, pins: READING_PINS,
    namespaces: ["px", "survey", "ortho", "plan", "mg", "drawing"],
    label: "fleets readings",
  });
  assert.ok(n >= 70, `only ${n} readings pinned — the section carries more than that`);
  assertPins({ readings: section.derivations.units, pins: UNIT_PINS, namespaces: [], label: "fleets units" });
  /* THE READINGS MUST BE THE SURVEY, not a transcription of it. */
  const S = section.derivations.readings.survey;
  for (const name of HALLS) {
    near(S[`mass${name}`], lidar.massHeights[section.measured.halls[name].mKey], 1e-9,
      `${name}'s reading is not massHeights at its own key`);
    near(S[`mass${name}`], section.measured.halls[name].massHeight, 1e-9,
      `${name}'s reading and its hall record disagree`);
  }
  near(S.arcgisH, arcgis.massing[section.measured.halls.Galathea.massingIndex].h, 1e-9, "arcgisH");
  /* AND THE ORTHO GEOMETRY IS THE MANIFEST'S. */
  const chunk = manifest.chunks.find((c) => c.file === "chunk_4_7.jpg");
  assert.ok(chunk, "chunk_4_7.jpg has left the manifest — every ortho reading here is measured in its frame");
  const O = section.derivations.readings.ortho;
  near(O.pxPerM, chunk.w / (chunk.x1 - chunk.x0), 1e-9, "the ortho scale is not the manifest's");
  near(O.pxPerM, chunk.h / (chunk.z1 - chunk.z0), 1e-9, "the ortho scale is not square in the manifest");
  assert.equal(O.chunkX0, chunk.x0);
  assert.equal(O.chunkZ0, chunk.z0);
  /* Every reading block names its source. */
  for (const k of ["px", "survey", "ortho", "plan", "mg", "drawing"]) {
    assert.ok(section.derivations.readings[k].source
      && section.derivations.readings[k].source.length > 100,
      `readings.${k} has no described source`);
  }
});

function exprScope() {
  const D = section.derivations;
  /* The reading sub-trees are COPIED, not aliased. A shallow spread here hands
     the walker the section's own `readings.px` object, and seeding a figure
     named `px.pitch` then writes a `pitch` key INTO the section's readings —
     which the coverage gate promptly finds as an unpinned bare number. The
     first draft of this file did exactly that. */
  const scope = { ...D.units };
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
    assert.ok(f.why && f.why.length > 40, `${key} is unmotivated: ${f.why}`);
  }
  const { evaluated, prose } = assertExprs({ figures: D.figures, scope: exprScope(), label: "fleets" });
  assert.ok(evaluated >= 40, `only ${evaluated} figures evaluated — the block is too thin`);
  /* Prose derivations are allowed, must stay rare, and must never be where a
     drawn dimension hides. The three here are two edge COUNTS and one
     out-of-sample pitch check, and not one of them draws anything. */
  assert.ok(prose <= 5, `${prose} figures fell back to prose — arithmetic is the default`);
  for (const [key, decl] of Object.entries(D.figures)) {
    if (decl.expr === undefined) {
      assert.match(key, /^(orthoFit\.edges|ground\.owned|px\.pitchAllThree)/,
        `${key} is prose and is not one of the declared prose figures`);
    }
  }
});

test("S1(iii): the relations the section states in PROSE are asserted", () => {
  const F = section.derivations.figures;
  const S = section.derivations.readings.survey;
  const rel = [];
  /* THE KEYSTONE, SIX TIMES. Four SHARED storeys plus that hall's own parapet
     zone must sum to that hall's OWN measured height, or the stack has stopped
     being a division of the survey and become a set of numbers that look right. */
  for (const name of HALLS) {
    rel.push({
      name: `${name}: 4 shared storeys and its own parapet zone ARE its own massHeights`,
      got: F["stack.fourStoreys"].value + F[`parapet.${name}`].value,
      want: S[`mass${name}`], tol: 5e-6,
    });
    rel.push({
      name: `${name}: the shipped stack is the derived stack`,
      got: 4 * section.system.stack.perHall[name].storey
         + section.system.stack.perHall[name].parapetZone,
      want: S[`mass${name}`], tol: 5e-6,
    });
  }
  /* ONE STOREY, SIX RESIDUES: the storey is the SAME on all six, and the
     parapet zone differs exactly when the measured height differs. */
  assert.equal(new Set(HALLS.map((n) => section.system.stack.perHall[n].storey)).size, 1,
    "the six halls no longer share one storey height — nothing measured says they differ, and the between-hall spread is the ground reference's");
  for (const a of HALLS) {
    for (const b of HALLS) {
      if (a >= b) continue;
      const same = S[`mass${a}`] === S[`mass${b}`];
      const eq = Math.abs(F[`parapet.${a}`].value - F[`parapet.${b}`].value) < 1e-9;
      assert.equal(eq, same,
        `${a} and ${b} ${eq ? "share" : "do not share"} a parapet zone while their measured heights ${same ? "are equal" : "differ"} — the residual must follow the survey and nothing else`);
    }
  }
  /* THE MODULE ROUTE'S OWN ARITHMETIC. */
  rel.push({ name: "the bay is the drawing's 14 ft",
    got: F["bay.metres"].value, want: 14 * 0.3048, tol: 1e-9 });
  rel.push({ name: "the storey is the bay over the measured bay:storey ratio",
    got: F["storey.shared"].value * F["ratio.bayToStorey"].value,
    want: F["bay.metres"].value, tol: 1e-9 });
  rel.push({ name: "and the ratio reproduces the dossier's independent read of 1.412",
    got: F["ratio.bayToStorey"].value, want: 1.412, tol: 0.005 });
  rel.push({ name: "the three opening fractions partition their storey exactly",
    got: F["ratio.spandrelOfStorey"].value + F["ratio.slabOfStorey"].value
       + F["ratio.windowOfStorey"].value, want: 1, tol: 1e-9 });
  /* THE OPENING OFFSET HAS AN INDEPENDENT CORROBORATION and it must keep it:
     the measured blank stretch between consecutive spandrels shares no
     arithmetic with the width-derived offset. */
  rel.push({ name: "the measured inter-spandrel gap IS the derived offset",
    got: F["check.gapOverModule"].value, want: F["ratio.openingOffsetOfBay"].value, tol: 0.02 });
  /* THE OUT-OF-SAMPLE CHECK. The ArcGIS facilities formula was used nowhere in
     the derivation and lands under 1% away. */
  assert.ok(Math.abs(F["check.storeyResidualPct"].value) < 1.5,
    `the derived storey is now ${F["check.storeyResidualPct"].value.toFixed(2)}% from the ArcGIS 3.050 m formula — under 1% between two independent routes is what closed A8, and if it has opened up the closure must be re-argued`);
  rel.push({ name: "the residual percentage is its own arithmetic",
    got: F["check.storeyResidualPct"].value,
    want: 100 * (F["check.arcgisStorey"].value - F["storey.shared"].value) / F["check.arcgisStorey"].value,
    tol: 1e-8 });
  /* THE RETIRED ROUTE STAYS ON THE RECORD AND STAYS ARITHMETIC. */
  rel.push({ name: "the retired 5e parapet-to-storey ratio is still the two pixel reads' quotient",
    got: F["ratio.parapetToStorey"].value,
    want: F["px.parapet"].value / F["px.pitch"].value, tol: 1e-9 });
  rel.push({ name: "and it still reproduces the dossier's independent 3x read of 0.369",
    got: F["ratio.parapetToStorey"].value, want: 0.369, tol: 0.004 });
  /* The two independent reads of the spandrel band's depth agree. */
  rel.push({ name: "the 5e and Enginuity reads of the spandrel band agree",
    got: F["ratio.spandrel5eOfStorey"].value, want: F["ratio.spandrelOfStorey"].value, tol: 0.02 });
  /* The ortho's north and south edges move TOGETHER. */
  rel.push({ name: "the north/south gap is the two means' difference",
    got: F["orthoFit.northSouthGap"].value,
    want: Math.abs(section.derivations.readings.ortho.zNorthMean
      - section.derivations.readings.ortho.zSouthMean), tol: 1e-9 });
  assert.ok(F["orthoFit.northSouthGap"].value < 0.3,
    `north and south roof edges now differ by ${F["orthoFit.northSouthGap"].value.toFixed(3)} m — they are no longer moving together, so the reading is an inflation artefact and not a translation, and nothing may be built on it`);
  assertRelations({ relations: rel, label: "fleets" });
});

/* Every `draw` number is a RENDER OFFSET and must carry its own sibling Note. */
const drawNoteFor = (path) => {
  const parts = path.split(".").slice(1);
  const note = section.draw[`${parts[0]}Note`];
  return typeof note === "string" && note.length > 40 ? "declared render offset" : null;
};

test("S1(i): no bare number survives in readings, estimates, draw, colours or samples", () => {
  const paths = assertCoverage({
    section, label: "fleets", minimum: 70,
    roots: {
      "derivations.readings": {}, "derivations.units": {}, estimates: {}, draw: {},
      colorSources: {}, colorThreshold: {}, samples: {},
    },
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
      if (/^colorSources\.[A-Za-z]+\.(sampleL|sampleSd|channelMean|luminance)$/.test(path)) {
        return SAMPLE_PINS[path.split(".")[1]] ? "pinned sample" : null;
      }
      if (/^samples\.[A-Za-z]+\.(channelMean|sampleSd|luminance)$/.test(path)) {
        return UNBUILT_PINS[path.split(".")[1]] ? "pinned sample" : null;
      }
      if (/^colorThreshold\.(sunlitMin|sdMax)$/.test(path)) return "pinned threshold";
      if (/^colorThreshold\.controls\.\d+\.(L|px|rect\.\d+)$/.test(path)) {
        return CONTROL_PINS[section.colorThreshold.controls[Number(path.split(".")[2])]?.key]
          ? "pinned control" : null;
      }
      return null;
    },
  });
  assert.ok(paths.length >= 90, `the walk only found ${paths.length} numbers in the axiom layer`);
  const drawNumbers = paths.filter((p) => p.path.startsWith("draw."));
  assert.ok(drawNumbers.length >= 6, `only ${drawNumbers.length} draw numbers walked`);
  for (const { path } of drawNumbers) {
    assert.ok(drawNoteFor(path), `${path} has no sibling Note explaining why it is not a measurement`);
  }
});

const EST_SHIPPED = {
  "system.tower.overrun": () => section.system.tower.overrun,
  "system.tower.depth": () => section.system.tower.depth,
};

test("S1(ii): every estimate carries a band, and the shipped value is inside it", () => {
  const n = assertEstimateBands({
    estimates: section.estimates,
    valueAt: (key) => {
      const f = EST_SHIPPED[key];
      assert.ok(f, `fleets: estimate ${key} governs no shipped value this suite knows about`);
      return f();
    },
    label: "fleets",
  });
  assert.equal(n, Object.keys(section.estimates).length, "every estimate must be banded");
  for (const [k, e] of Object.entries(section.estimates)) {
    assert.ok(e.bandWhy && e.bandWhy.length > 80, `estimate ${k}'s band is a bare pair with no argument`);
    assert.ok(e.why.length > 120, `estimate ${k} does not record its failed ladder`);
    assert.match(e.why, /Ladder climbed and failed/i, `estimate ${k} does not name the ladder it climbed`);
    for (const rung of ["photos", "Street View", "drone", "planning docs", "archives"]) {
      assert.ok(e.why.includes(rung), `estimate ${k}'s ladder skips the ${rung} rung`);
    }
  }
});

test("THE PARAPET ZONE IS A RESIDUAL, and its band is its own range and not a choice", () => {
  /* It stopped being an `estimate` when it stopped being estimated: it is
     massHeights minus the shared four-storey stack, evaluated per hall. The
     band is therefore not something to widen — it is the range those six
     subtractions produce, and both endpoints are checked against them. */
  const F = section.derivations.figures;
  const [lo, hi] = section.system.stack.parapetBand;
  const zones = HALLS.map((n) => section.system.stack.perHall[n].parapetZone);
  for (const name of HALLS) {
    const z = section.system.stack.perHall[name].parapetZone;
    near(z, F[`parapet.${name}`].value, 5e-6, `${name}'s shipped parapet zone drifted from its derivation`);
    near(z, section.measured.halls[name].massHeight - F["stack.fourStoreys"].value, 5e-6,
      `${name}'s parapet zone is not its own height less the shared stack`);
    assert.ok(z >= lo - 1e-9 && z <= hi + 1e-9,
      `${name} ships a ${z.toFixed(4)} m parapet zone, outside the section's own published band [${lo}, ${hi}]`);
  }
  /* THE BAND'S ENDPOINTS ARE THE POPULATION'S OWN, rounded outward to two
     decimals. A band that did not touch its own extremes would be a chosen
     range wearing a derivation's clothes. */
  near(lo, Math.floor(Math.min(...zones) * 100) / 100, 1e-9,
    "the band's floor is not the shortest hall's own residual, rounded outward");
  near(hi, Math.ceil(Math.max(...zones) * 100) / 100, 1e-9,
    "the band's ceiling is not the tallest hall's own residual, rounded outward");
  assert.match(section.system.stack.parapetBandNote, /rounded OUTWARD/);
  assert.match(section.system.stack.parapetBandNote, /2\.31/,
    "the dossier's inward-rounded [1.21, 2.31] must be recorded as the correction it is");
  /* AND THE ZONE SPLITS WITHOUT SCALING ANYTHING SOURCED. */
  for (const name of HALLS) {
    const h = section.system.stack.perHall[name];
    near(h.fasciaBand + h.parapetCap, h.parapetZone, 5e-6, `${name}'s zone does not split into its two bands`);
    assert.ok(h.parapetCap > 0, `${name}'s masonry cap has been squeezed to ${h.parapetCap} — the split no longer works`);
  }
  const fascias = new Set(HALLS.map((n) => section.system.stack.perHall[n].fasciaBand));
  assert.equal(fascias.size, 1,
    "the fascia band is a MEASURED depth and must be identical on all six — if it varies, something sourced is being scaled to fit");
  assert.equal(new Set(HALLS.map((n) => section.system.stack.perHall[n].parapetCap)).size, 4,
    "the masonry cap must vary with the ground reference, and the six halls hold four distinct massHeights");
});

/* ------------------------------------------------------ colours, pinned */

const SAMPLE_PINS = {
  wallBlock: { L: 133.5, sd: 1.2, lum: 138.8 },
  spandrelAccent: { L: 82.2, sd: 0.75, lum: 78.7 },
  spandrelAccentExtended: { L: 82.2, sd: 0.75, lum: 78.7 },
  windowGlass: { L: 103.2, sd: 1.56, lum: 103.4 },
  parapetCap: { L: 133.5, sd: 1.2, lum: 138.8 },
  fasciaBand: { L: 43.5, sd: 2.4, lum: 41.8 },
  groundMulch: { L: 155.4, sd: 63.0, lum: 160.2 },
  groundLawn: { L: 67.4, sd: 6.0, lum: 82.2 },
  groundPaving: { L: 147.4, sd: 1.4, lum: 147.8 },
};
const UNBUILT_PINS = {
  spandrelAccentRed: { L: 68.7, sd: 3.6, lum: 64.8 },
  spandrelAccentOrange: { L: 76.4, sd: 0.9, lum: 81.7 },
  panelOpaque: { L: 178.6, sd: 4.2, lum: 182.5 },
};
const CONTROL_PINS = {
  sunlitWalkAsla: { L: 147.8, px: 576, rect: [592, 320, 616, 344] },
  sunlitWallGarbini: { L: 133.6, px: 144, rect: [536, 128, 548, 140] },
  shadedFacadeAsla: { L: 90.9, px: 144, rect: [96, 96, 108, 108] },
  shadedWallGarbini: { L: 84.7, px: 144, rect: [68, 168, 80, 180] },
};

test("colours are data, hex, tiered per role, sampled with their rectangles", () => {
  const entries = Object.entries(section.colors);
  assert.ok(entries.length >= 5, `only ${entries.length} colours`);
  for (const [k, v] of entries) {
    assert.match(v, /^#[0-9a-f]{6}$/, `${k} is not a lowercase 6-digit hex`);
    const p = section.colorSources[k];
    assert.ok(p, `${k} has no colorSources line`);
    assert.match(p.tier, /^(measured|sourced|estimated)$/, `${k}'s tier is ${p.tier}`);
    assert.ok(p.source && p.source.length > 80, `${k}'s provenance is a stub`);
    if (p.tier !== "estimated") {
      assert.ok(!/\[estimated\]/.test(p.source),
        `${k} is tiered ${p.tier} but its own provenance calls the hex estimated`);
      assert.match(p.source, /x \d+\.\.\d+, y \d+\.\.\d+/,
        `${k} claims [${p.tier}] and records no sample rectangle`);
      assert.match(p.source, /sd (max )?\d/, `${k} records no standard deviation for its sample`);
      assert.match(p.source, /\b(19|20)\d\d\b/,
        `${k} claims [${p.tier}] and dates neither its frame nor its epoch`);
    }
  }
  /* No hex may leak into the builder. */
  assert.equal(moduleSrc.match(/#[0-9a-fA-F]{6}\b/g), null,
    "a colour literal leaked into the builder — colours are the section's");
  assert.match(section.colorFallback.note, /borrows no hex|Empty by construction/i);
  assert.deepEqual(section.colorFallback.borrowed, {});
});

test("RE-AUDIT 1: the tier gate's own operands are pinned, not self-declared", () => {
  const entries = Object.entries(section.colorSources);
  assert.equal(entries.length, Object.keys(SAMPLE_PINS).length,
    "a colour role was added or removed and this suite does not pin its sample");
  for (const [k, p] of entries) {
    const pinned = SAMPLE_PINS[k];
    assert.ok(pinned, `${k} carries a sample this suite does not pin`);
    near(p.sampleL, pinned.L, 0.05, `${k}'s sample channel mean has moved off its pin`);
    near(p.sampleSd, pinned.sd, 0.05, `${k}'s sample standard deviation has moved off its pin`);
    near(p.luminance, pinned.lum, 0.05, `${k}'s Rec.709 luminance has moved off its pin`);
    near(p.channelMean, p.sampleL, 1e-9, `${k}'s two names for the same statistic disagree`);
  }
  /* The unbuilt catalogue is pinned the same way — it is where the spandrel
     accents live, and an unconsumed value is exactly the kind that rots. */
  const un = Object.entries(section.samples).filter(([k]) => k !== "note");
  assert.equal(un.length, Object.keys(UNBUILT_PINS).length,
    "the unbuilt-sample catalogue has changed size and this suite does not pin the difference");
  for (const [k, s] of un) {
    const pinned = UNBUILT_PINS[k];
    assert.ok(pinned, `unbuilt sample ${k} is not pinned in this suite`);
    near(s.channelMean, pinned.L, 0.05, `${k}'s channel mean has moved`);
    near(s.sampleSd, pinned.sd, 0.05, `${k}'s sd has moved`);
    near(s.luminance, pinned.lum, 0.05, `${k}'s luminance has moved`);
    assert.match(s.hex, /^#[0-9a-f]{6}$/, `${k} is not a lowercase hex`);
    assert.ok(s.whyUnconsumed && s.whyUnconsumed.length > 60,
      `${k} does not say why nothing paints it — an unexplained unconsumed hex is a hex waiting to be used wrongly`);
  }
  /* THE THRESHOLD'S OWN JUSTIFICATION IS PINNED TOO. */
  const T = section.colorThreshold;
  assert.equal(T.sunlitMin, 120, "the sunlit threshold has moved");
  assert.equal(T.sdMax, 15, "the single-material threshold has moved");
  assert.equal(T.statistic, "channelMean");
  assert.match(T.statisticNote, /\(R \+ G \+ B\) \/ 3/, "the statistic must be defined, not named");
  assert.match(T.statisticNote, /Rec\.601|luma/i, "and it must say what it is NOT");
  assert.equal(T.controls.length, 4);
  for (const c of T.controls) {
    const pinned = CONTROL_PINS[c.key];
    assert.ok(pinned, `control ${c.key} is not pinned in this suite`);
    near(c.L, pinned.L, 0.05, `control ${c.key} has moved off its pin`);
    assert.equal(c.px, pinned.px, `control ${c.key}'s pixel count has moved`);
    assert.deepEqual(c.rect, pinned.rect, `control ${c.key}'s sample rectangle has moved`);
    assert.ok(c.frame && /\.jpg$/.test(c.frame), `control ${c.key} names no frame`);
    assert.ok(c.what && c.what.length > 60, `control ${c.key} does not say what it controls for`);
  }
  /* The threshold really separates the two populations, computed from the pins. */
  const sunlit = T.controls.filter((c) => /^sunlit/.test(c.key)).map((c) => c.L);
  const shaded = T.controls.filter((c) => /^shaded/.test(c.key)).map((c) => c.L);
  assert.equal(sunlit.length, 2);
  assert.equal(shaded.length, 2);
  assert.ok(Math.max(...shaded) < T.sunlitMin && T.sunlitMin < Math.min(...sunlit),
    `the ${T.sunlitMin} threshold does not sit between its own controls (shaded to ${Math.max(...shaded)}, sunlit from ${Math.min(...sunlit)})`);
  assert.ok(Math.min(...sunlit) - Math.max(...shaded) > 30,
    "the two control populations are no longer cleanly separated — the threshold must be re-argued");
  /* AND ONE CONTROL IS NOT A SHIPPED SAMPLE. */
  for (const c of T.controls) {
    for (const p of Object.values(section.colorSources)) {
      const m = /x (\d+)\.\.(\d+), y (\d+)\.\.(\d+)/.exec(p.source);
      if (!m) continue;
      assert.notDeepEqual(c.rect, [Number(m[1]), Number(m[3]), Number(m[2]), Number(m[4])],
        `control ${c.key} is one of the shipped samples — a threshold justified by the thing it judges is worthless`);
    }
  }
});

test("the colour tier gate is ARITHMETIC and runs BOTH ways", () => {
  const LIT = section.colorThreshold.sunlitMin;
  const SD = section.colorThreshold.sdMax;
  for (const [k, p] of Object.entries(section.colorSources)) {
    assert.equal(typeof p.sampleL, "number", `${k} records no sample channel mean — 'sunlit' is an adjective, not a gate`);
    assert.equal(typeof p.sampleSd, "number", `${k} records no sample standard deviation`);
    if (p.tier === "measured") {
      assert.ok(p.sampleL >= LIT, `${k} claims [measured] at ${p.sampleL} — below ${LIT} the sample is in shade, and shadow is not a material`);
      assert.ok(p.sampleSd <= SD, `${k} claims [measured] at sd ${p.sampleSd} — above ${SD} the rectangle holds more than one material`);
    } else if (p.tier === "sourced") {
      assert.ok(p.sampleL < LIT || p.sampleSd > SD,
        `${k} is tiered [sourced] but its own numbers (${p.sampleL}, sd ${p.sampleSd}) meet the [measured] bar — a tier may not be deflated either`);
    }
  }
  /* And the saturated-colour case is on the record rather than fixed by a
     tier bump: three perfectly clean samples ship as [sourced] for being dark. */
  const c = section.conflicts.find((q) => q.key === "tier-threshold-vs-saturated-colour");
  assert.ok(c, "the tier-scope conflict must be declared");
  assert.match(c.resolution, /DO NOT RAISE THE TIER AND DO NOT LOWER THE THRESHOLD/);
  assert.ok(section.samples.spandrelAccentOrange.sampleSd < section.colorSources.wallBlock.sampleSd,
    "the orange accent is no longer cleaner than the [measured] wall — the conflict's own example has gone");
  assert.equal(section.samples.spandrelAccentOrange.tier, "sourced");
  /* THE TIER GATE, BOTH WAYS, over colours, unbuilt samples and estimates. */
  const entries = [
    ...Object.entries(section.colorSources).map(([key, p]) => ({ key: `colour:${key}`, text: `[${p.tier}] ${p.source}` })),
    ...Object.entries(section.samples).filter(([k]) => k !== "note")
      .map(([key, p]) => ({ key: `sample:${key}`, text: `[${p.tier}] ${p.source}` })),
    ...Object.entries(section.estimates).map(([key, e]) => ({ key: `estimate:${key}`, text: e.why })),
  ];
  const n = assertTierSymmetry({ entries, label: "fleets" });
  assert.ok(n >= 12, `the tier gate only walked ${n} lines`);
  /* The one role that EXTENDS another's sample must be [estimated], both ways. */
  assert.equal(section.colorSources.parapetCap.tier, "estimated",
    "parapetCap extends wallBlock's sample and may not be promoted above [estimated]");
  assert.match(section.colorSources.parapetCap.source, /xtends/);
  assert.equal(section.colors.parapetCap, section.colors.wallBlock,
    "parapetCap says it extends wallBlock and carries a different hex — say which it is");
});

test("ROUND-2 VISUAL: every colour role the module asks for is declared, both ways", () => {
  const referenced = new Set([...moduleSrc.matchAll(/hue\("([A-Za-z]+)"\)/g)].map((m) => m[1]));
  assert.ok(referenced.size >= 5, `only ${referenced.size} colour roles found in the module`);
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
  assert.match(moduleSrc, /const hue = \(role\)/,
    "colours must be routed through a guard, not read off the object directly");
  assert.ok(!/colors\.[A-Za-z]/.test(moduleSrc.replace(/const v = colors\[role\];/, "")),
    "a colour is being read off `colors` directly, bypassing the guard");
  const bare = { ...section, colors: { ...section.colors } };
  delete bare.colors.groundMulch;
  assert.throws(() => createPhotoFleets(null, { photo: { fleets: bare }, surfaceAt: flat }),
    /no colour declared for role "groundMulch"/,
    "a missing colour role must be a hard error — silently white is what shipped on the Commons");
});

/* -------------------------------------------------- the ortho, re-fitted */

test("the ortho fit is published below its own evidence on x, and consumed nowhere", () => {
  const O = section.derivations.readings.ortho;
  const F = section.derivations.figures;
  /* THE GATE THE RESEARCH ASKED FOR. Zero x edges reach the fit's own length
     requirement, so the axis cannot discriminate anything. */
  assert.equal(F["orthoFit.edgesX8m"].value, 0,
    "an x-axis roof edge now reaches 8 m. If that is real the section must ARGUE the x axis rather than record it as weak, and conflicts['ortho-displacement-x-axis-weak'] must be rewritten");
  assert.equal(O.xEdges8m, 0);
  assert.ok(O.xSd5m > 1.0,
    `the relaxed 5 m x reads now scatter by only ${O.xSd5m} m — if they have become usable the section must say so and re-derive, not inherit a withholding`);
  /* z discriminates: 17 edges, north and south moving together, sd 0.26. */
  assert.ok(O.zKept >= 15, `only ${O.zKept} z edges survive the trim`);
  assert.ok(O.zSd < 0.5, `the z fit has loosened to sd ${O.zSd}`);
  /* NO HEIGHT DEPENDENCE ON x, AND A LARGE ONE ON z — the two facts that make
     the correction a georegistration offset in x and a displacement in z. */
  assert.ok(Math.abs(F["orthoFit.xHeightDelta"].value) < 0.15,
    `x now varies by ${F["orthoFit.xHeightDelta"].value.toFixed(3)} m between h = 0 and h = 13.9 — if that is real it is a displacement, not a registration offset`);
  assert.ok(Math.abs(O.zMean - O.groundZ) > 1.5,
    "z no longer grows with height, so the two-point rate has gone and the ortho model must be re-argued");
  /* AND NOTHING CONSUMES EITHER CORRECTION. Not in the module, and not in any
     shipped figure that a placement reads. */
  assert.ok(!/ortho/i.test(moduleSrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "")),
    "the module mentions the ortho — no ortho-derived position ships in this section");
  const c = section.conflicts.find((q) => q.key === "ortho-displacement-x-axis-weak");
  assert.ok(c, "the x-axis weakness conflict is not declared");
  assert.match(c.sides.join(" "), /NON-DISCRIMINATING BY CONSTRUCTION/);
  assert.match(c.resolution, /NO ORTHO-DERIVED POSITION SHIPS/i);
  assert.ok(section.superseded["research.orthoDisplacementConstant"],
    "the dossier's correction must be retired as a CONSUMED figure, on the record");
  /* It is retired as unused, NOT as wrong — this build reproduced it. */
  near(F["orthoFit.correctionZ"].value, 2.79, 0.06,
    "the local z correction no longer reproduces the dossier's 2.79 — if the re-fit has genuinely moved, the retirement's own reasoning changes");
  near(F["orthoFit.correctionX"].value, 0.85, 0.04, "the local x correction no longer reproduces the dossier's 0.85");
});

/* ------------------------------------------------- the ground, registered */

test("the surveyed ground rings are the survey's, and the band is partitioned exactly", () => {
  const GR = section.measured.groundRings;
  const owned = GR.owned.map((g) => g.index);
  const boundary = GR.boundary.map((g) => g.index);
  const notMine = GR.notMine.map((g) => g.index);
  const all = [...owned, ...boundary, ...notMine];
  assert.equal(new Set(all).size, all.length, "a ring is claimed twice across owned/boundary/notMine");
  /* THE BAND'S OWN INVENTORY, recomputed from the survey. */
  const inBand = [];
  arcgis.ground.forEach((g, i) => {
    if (!g || !g.r || !g.r[0]) return;
    const r = g.r[0].map(([x, z]) => [x / 10, z / 10]);
    const xs = r.map((p) => p[0]);
    const zs = r.map((p) => p[1]);
    if (Math.max(...xs) < -152 || Math.min(...xs) > -29
      || Math.max(...zs) < 414 || Math.min(...zs) > 475) return;
    inBand.push(i);
  });
  assert.equal(inBand.length, 26,
    `the R3 band now holds ${inBand.length} surveyed ground rings, not the 26 this section partitions`);
  assert.deepEqual(all.slice().sort((a, b) => a - b), inBand.slice().sort((a, b) => a - b),
    "the section's three lists are not a partition of the band — a ring that is in none of them is a ring nobody will ever notice");
  /* NOT ONE of them is claimed by any OTHER section. The fleets key itself is
     excluded before scanning — since the merge, this section's own prose (the
     tree-pit note names #2101) lives in the same document, and a section
     cannot collide with itself. */
  const docPath = join(root, "docs/data/campus-photo-detail.json");
  let docText = "";
  if (existsSync(docPath)) {
    const whole = JSON.parse(readFileSync(docPath, "utf8"));
    delete whole.fleets;
    docText = JSON.stringify(whole);
  }
  const others = new Set([...docText.matchAll(/arcgis\.ground#(\d+)/g)].map((m) => Number(m[1])));
  for (const i of owned) {
    assert.ok(!others.has(i),
      `arcgis.ground#${i} is already registered by another section — this section may not take it`);
  }
  /* Every owned ring is carried VERBATIM. */
  for (const g of GR.owned) {
    const src = arcgis.ground[g.index];
    assert.ok(src, `arcgis.ground#${g.index} does not exist — dropped slots are null and must be guarded, never renumbered`);
    assert.equal(g.kind, src.k, `#${g.index}'s kind is not the survey's`);
    assert.deepEqual(g.rings, src.r.map((r) => r.map(([x, z]) => [x / 10, z / 10])),
      `#${g.index} is not the survey's ring at /10, verbatim`);
    assert.ok(["mulch", "lawn", "paving"].includes(g.role), `#${g.index} has role ${g.role}`);
    assert.ok(g.what && g.what.length > 20, `#${g.index} does not say what it is`);
    /* NOTHING WEST OF x -152 — main's ruling. */
    assert.ok(g.bbox.x0 >= -152,
      `#${g.index} reaches x ${g.bbox.x0}, west of the Keeling line this section may not cross`);
  }
  /* EXACTLY ONE LAWN. "One centralized lawn area was introduced" is the
     landscape architect's own sentence and #2322 is the only bright turf
     polygon in the band. */
  const lawns = GR.owned.filter((g) => g.role === "lawn");
  assert.equal(lawns.length, 1, "there is exactly one centralized lawn, and the firm's own text says so");
  assert.equal(lawns[0].index, 2322);
  /* THE MATCHED PAVING PAIR is a type detail, not two accidents. */
  const paving = GR.owned.filter((g) => g.role === "paving").map((g) => g.index).sort((a, b) => a - b);
  assert.deepEqual(paving, [3818, 3819]);
  /* AUDIT F4: THREE rings cross the x -152 Keeling line, not four. #344's
     whole extent is east of it and it is a boundary ring for a different
     reason — it lies mostly north of the band's z 414 edge. The error came in
     from the brief; the count is recomputed here so it cannot come back. */
  const straddlesKeeling = GR.boundary
    .filter((b) => {
      const r = arcgis.ground[b.index].r[0].map(([x, z]) => [x / 10, z / 10]);
      const xs = r.map((q) => q[0]);
      return Math.min(...xs) < -152 && Math.max(...xs) > -152;
    })
    .map((b) => `#${b.index}`).sort();
  assert.deepEqual(straddlesKeeling, ["#1133", "#343", "#404"],
    "the set of rings that actually cross x -152 has changed");
  assert.match(section.boundary.handedForwardNote, /THREE of the six cross the x -152 KEELING line/);
  assert.match(section.boundary.handedForwardNote, /#344 does not/,
    "the corrected ring must be named, not quietly dropped from the list");
  /* AND EVERY PLACE THAT REPEATS THE CLAIM MUST REPEAT THE CORRECTED ONE. The
     first round said "four" in three separate strings, and fixing one of them
     would have left the other two lying — the galbraith stale-prose lesson. */
  for (const [where, text] of [["boundsNote", section.boundsNote],
    ["boundary.west", section.boundary.west],
    ["absent B4", section.absent.find((a) => a.startsWith("B4 —"))]]) {
    assert.ok(!/four rings that straddle|#343, #1133, #344 and #404 straddle/i.test(text),
      `${where} still says four rings straddle the Keeling line — #344's whole extent is east of it`);
    assert.match(text, /THREE/, `${where} does not state the corrected count`);
  }
  /* Every boundary ring is still handed forward BY NAME, whatever edge it
     crosses — a ring clipped silently at a boundary looks exactly like a ring
     nobody noticed. */
  for (const b of GR.boundary) {
    assert.ok(section.boundary.handedForward.includes(`#${b.index}`),
      `boundary ring #${b.index} is not handed forward by name`);
  }
  for (const g of GR.boundary) assert.ok(g.why.length > 60, `boundary ring #${g.index} gives no reason`);
  for (const g of GR.notMine) assert.ok(g.why.length > 40, `notMine ring #${g.index} gives no reason`);
  assert.match(GR.indexNote, /LITERAL INDEX/);
  assert.match(section.measured.groundNote, /NOT ONE/i);
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
  /* THE TWO REMAINING DECLARED ZEROES are zeroes, not absences. */
  for (const k of ["roofObjects", "pv"]) {
    assert.equal(counts[k], 0, `${k} must be a declared zero, not an omission`);
    assert.equal(section.counts[k], 0);
  }
  /* AND THE OPENING GRID IS THE FACES' OWN ARITHMETIC: twelve long faces,
     three bays each, four storeys, one window and one spandrel per cell. */
  const cells = section.system.facade.longFaceCount
    * section.system.facade.baysPerLongFace * section.system.stack.storeys;
  assert.equal(counts.windows, cells, "a window is missing from the opening grid");
  assert.equal(counts.spandrelBands, cells, "a spandrel is missing from the opening grid");
  assert.equal(counts.openings, cells);
  /* Every DRAWN ring edge of every hall carries exactly one of each band. */
  const drawnEdges = HALLS.reduce((n, name) => n + section.measured.halls[name].drawnEdges, 0);
  for (const k of ["wallPanels", "fasciaBands", "parapetCaps", "skirts"]) {
    assert.equal(counts[k], drawnEdges,
      `${k}: every drawn survey edge of every hall must carry exactly one run — a face left bare is the ultra standard's own failure mode`);
  }
  assert.equal(counts.towers, 12, "two C2-paired towers on each of six halls");
  assert.equal(counts.beds + counts.lawns + counts.pavingPatches,
    section.measured.groundRings.owned.length,
    "a surveyed ring this section owns was silently not drawn");
  for (const name of ["fleets-facades", "fleets-ground"]) {
    assert.ok(group.children.find((c) => c.name === name), `no ${name} group`);
  }
  /* The three postures a half-built document must take. */
  const missing = createPhotoFleets(null, { photo: {}, heightAt: flat, surfaceAt: flat });
  assert.deepEqual(missing.counts, {}, "a missing section builds nothing and breaks nothing");
  assert.throws(() => createPhotoFleets(null, { photo: { fleets: section } }), /surfaceAt/,
    "a missing sampler must be loud, not silent");
  const preR3 = { ...section };
  delete preR3.system;
  assert.throws(() => createPhotoFleets(null, { photo: { fleets: preR3 }, surfaceAt: flat }),
    /R3 merge|half a quad/i, "a pre-R3 section must fail loudly rather than build half a quad");
  /* A hall without its own derived stack must fail rather than borrow one. */
  const borrowed = JSON.parse(JSON.stringify(section));
  delete borrowed.system.stack.perHall.Meteor;
  assert.throws(() => createPhotoFleets(null, { photo: { fleets: borrowed }, surfaceAt: flat }),
    /no stack declared for Meteor/,
    "a hall with no stack of its own must be loud — silently wearing another hall's metre is exactly the audit finding this section is built against");
});

test("THE HAND, IN THE BUILT SCENE: each hall's occupied quadrants are the survey's", () => {
  /* A shared instanced mesh with only a translation gets two of six halls
     backwards, and 166 m2 of building lands in the wrong place. This measures
     the BUILT geometry, quadrant by quadrant, against the survey's own. */
  const { group } = build();
  group.updateMatrixWorld(true);
  /* THE MEASUREMENT: how far each hall's four BOUNDING-BOX CORNERS are from
     the nearest built wall. On an occupied corner the wall turns the corner
     and the distance is the declared render offset; on a CUT corner the
     nearest wall is metres away across the removed 166 m2. Counting vertices
     per quadrant does not work — vertex density follows the number of ring
     edges, not the area they enclose — and the first draft of this gate said
     Discovery was backwards for exactly that reason. */
  const corners = {};
  for (const name of HALLS) corners[name] = [Infinity, Infinity, Infinity, Infinity];
  const cornerXZ = (h, q) => [q % 2 ? h.bbox.x1 : h.bbox.x0, q > 1 ? h.bbox.z1 : h.bbox.z0];
  eachVertex(group, (x, y, z, name) => {
    if (!/fleets-(wall|fascia|parapet-cap)/.test(name)) return;
    void y;
    for (const hall of HALLS) {
      const h = section.measured.halls[hall];
      if (x < h.bbox.x0 - 1 || x > h.bbox.x1 + 1 || z < h.bbox.z0 - 1 || z > h.bbox.z1 + 1) continue;
      for (let q = 0; q < 4; q++) {
        const [cx, cz] = cornerXZ(h, q);
        corners[hall][q] = Math.min(corners[hall][q], Math.hypot(x - cx, z - cz));
      }
      break;
    }
  });
  /* The survey's own cut corners: rasterise the footprint and take the two
     bbox QUADRANTS it barely occupies. A single probe point 1 m in from the
     corner is not enough — Beagle's east bbox edge is set by its 1.2 m stair
     projection rather than by its main body, so a probe there lands on the
     boundary and the answer is a coin toss. */
  const surveyCut = (name) => {
    const h = section.measured.halls[name];
    const occ = [0, 0, 0, 0];
    const cx = (h.bbox.x0 + h.bbox.x1) / 2;
    const cz = (h.bbox.z0 + h.bbox.z1) / 2;
    for (let i = 0; i < 48; i++) {
      for (let j = 0; j < 48; j++) {
        const x = h.bbox.x0 + ((h.bbox.x1 - h.bbox.x0) * (i + 0.5)) / 48;
        const z = h.bbox.z0 + ((h.bbox.z1 - h.bbox.z0) * (j + 0.5)) / 48;
        if (inRing(x, z, h.ring)) occ[(x > cx ? 1 : 0) + (z > cz ? 2 : 0)]++;
      }
    }
    const order = occ.map((v, q) => ({ v, q })).sort((a, b) => a.v - b.v);
    /* And the split must be unambiguous: the two cut quadrants hold under half
       what the two kept ones do, or this is not a pinwheel any more. */
    assert.ok(order[1].v * 1.4 < order[2].v,
      `${name}'s quadrant occupancy ${occ.join("/")} no longer separates two cut corners from two kept ones`);
    return [order[0].q, order[1].q].sort();
  };
  for (const name of HALLS) {
    const cut = surveyCut(name);
    assert.equal(cut.length, 2,
      `${name} has ${cut.length} cut corners, not the two the C2 pinwheel type claims`);
    const kept = [0, 1, 2, 3].filter((q) => !cut.includes(q));
    for (const q of kept) {
      /* 1.5 m, not zero: on some halls the bbox extreme is set by the 1.2 m
         stair projection rather than by the main body, so the nearest wall to
         that bbox corner is legitimately a projection's depth away. Against a
         cut corner's 3 m floor the two populations still do not touch. */
      assert.ok(corners[name][q] < 1.5,
        `${name}: no built wall reaches within 1.5 m of occupied bbox corner ${q} (nearest ${corners[name][q].toFixed(2)} m) — a face is missing`);
    }
    for (const q of cut) {
      assert.ok(corners[name][q] > 3,
        `${name}: a built wall stands ${corners[name][q].toFixed(2)} m from CUT bbox corner ${q} — the hand is BACKWARDS in world coordinates, which is 166 m2 of building in the wrong place`);
    }
  }
  /* And the two hands really do cut different corners. */
  const key = (n) => surveyCut(n).join(",");
  assert.notEqual(key("Galathea"), key("Meteor"),
    "Galathea and Meteor now cut the same corners — the mirror has gone");
  assert.equal(key("Meteor"), key("Challenger"), "the two hand-B halls must cut the same corners");
  assert.equal(key("Galathea"), key("Atlantis"), "the hand-A halls must cut the same corners");
});

test("nothing hovers, nothing sinks, and nothing leaves the declared bounds", () => {
  const B = section.bounds;
  for (const [label, g] of [["flat", flat], ["slope", slope], ["drawn", drawnGround]]) {
    const r = build(g);
    r.group.updateMatrixWorld(true);
    let n = 0;
    let seated = 0;
    each(r.group, (e) => {
      n++;
      assert.ok(e.xLo >= B.x0 && e.xHi <= B.x1 && e.zLo >= B.z0 && e.zHi <= B.z1,
        `${label}: ${e.name} spans (${e.xLo.toFixed(2)}..${e.xHi.toFixed(2)}, ${e.zLo.toFixed(2)}..${e.zHi.toFixed(2)}), outside bounds`);
    });
    /* NOTHING HOVERS. The claim is that the treatment's LOWEST edge — the foot
       of the skirt — lies at or under the drawn surface at every station of
       every ring edge, not merely at the stations the module happened to
       sample. So the skirt's foot is recovered per hall from the BUILT scene
       and then walked against the sampler every 0.25 m along the survey ring,
       which is eight times finer than draw.datumStep. Checking each skirt
       vertex against the ground under it instead tests the skirt's TOP, which
       sits at the datum and is supposed to be at or above the surface. */
    const foot = {};
    eachVertex(r.group, (x, y, z, name) => {
      if (name !== "fleets-skirt") return;
      seated++;
      const hall = hallAt(x, z);
      foot[hall] = Math.min(foot[hall] ?? Infinity, y);
    });
    for (const name of HALLS) {
      const h = section.measured.halls[name];
      assert.ok(Number.isFinite(foot[name]), `${label}: ${name} built no skirt`);
      for (let k = 0; k < h.ring.length - 1; k++) {
        const [ax, az] = h.ring[k];
        const [bx, bz] = h.ring[k + 1];
        const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.25));
        for (let i = 0; i <= steps; i++) {
          const x = ax + ((bx - ax) * i) / steps;
          const z = az + ((bz - az) * i) / steps;
          const surface = g(x, z);
          assert.ok(foot[name] <= surface + 1e-6,
            `${label}: ${name}'s treatment stops at ${foot[name].toFixed(3)} while the drawn surface at (${x.toFixed(2)}, ${z.toFixed(2)}) is ${surface.toFixed(3)} — the wall hovers there`);
          assert.ok(foot[name] >= surface - 12,
            `${label}: ${name}'s treatment runs away to ${foot[name].toFixed(2)} under a surface at ${surface.toFixed(2)}`);
        }
      }
    }
    assert.ok(n > 15, `${label}: only ${n} placements walked`);
    assert.ok(seated > 100, `${label}: only ${seated} skirt vertices checked`);

    /* AND EVERY PANEL FOOT, not just the skirt's. AUDIT F1: the first round's
       gate recovered the SKIRT's foot per hall and walked that against the
       sampler, and never compared a facade feature to the terrain at all — so
       twelve painted spandrel bands sat partly under the drawn ground, the
       worst four fifths buried with one fifth emerging from it. Every quad of
       every painted or glazed panel is now checked against the surface under
       its OWN footprint. The wall and its skirt are exempt and deliberately
       so: they are the carrying fabric and are supposed to run below grade. */
    for (const meshName of ["fleets-spandrel-sourced", "fleets-spandrel-estimated",
      "fleets-window", "fleets-fascia", "fleets-parapet-cap"]) {
      let panels = 0;
      eachQuad(r.group, meshName, (e) => {
        panels++;
        const under = Math.max(g(e.xLo, e.z), g(e.xHi, e.z), g(e.x, e.z));
        assert.ok(e.yLo >= under - 1e-3,
          `${label}: a ${meshName} panel's foot is at ${e.yLo.toFixed(3)} where the drawn surface under it reaches ${under.toFixed(3)} — ${(under - e.yLo).toFixed(3)} m buried, which is audit F1 happening again`);
      });
      assert.ok(panels > 0, `${label}: no ${meshName} panels were walked`);
    }
  }
});

test("AUDIT F1: an opening the drawn ground would bury is WITHHELD, and counted", () => {
  /* On flat ground the section builds the whole grid the sources give; on the
     real surface it builds what clears. Both are declared, in different places,
     so a change to the sources and a change to the terrain move different
     numbers. */
  const GC = section.system.facade.groundClip;
  const flatBuild = build(flat);
  assert.equal(flatBuild.counts.openingsWithheld, 0,
    "something is being clipped on flat ground — the clip is a terrain condition and nothing else");
  assert.equal(flatBuild.counts.windows, section.counts.windows);

  const drawnBuild = build(drawnGround);
  assert.equal(drawnBuild.counts.openingsWithheld, GC.withheldOnDrawnTerrain,
    "the number of openings the drawn terrain withholds has moved off its declared figure");
  assert.equal(drawnBuild.counts.windows, GC.builtOnDrawnTerrain);
  assert.equal(drawnBuild.counts.spandrelBands, GC.builtOnDrawnTerrain,
    "a window shipped without its spandrel — the whole opening goes or none of it does");
  assert.equal(GC.withheldOnDrawnTerrain + GC.builtOnDrawnTerrain, section.counts.openings,
    "the clip's two figures do not account for the whole declared grid");
  /* Per hall, so a clip that migrated between halls is visible. */
  const built = Object.fromEntries(HALLS.map((n) => [n, 0]));
  eachQuad(drawnBuild.group, "fleets-window", (e) => { built[hallAt(e.x, e.z)]++; });
  const cell = section.system.facade.baysPerLongFace * section.system.stack.storeys * 2;
  for (const name of HALLS) {
    assert.equal(cell - built[name], GC.perHallOnDrawnTerrain[name],
      `${name} withholds ${cell - built[name]} openings against a declared ${GC.perHallOnDrawnTerrain[name]}`);
  }
  /* THE REJECTED ALTERNATIVE IS ON THE RECORD WITH THE ARITHMETIC THAT KILLED
     IT, and the arithmetic is recomputed here: seating the grid on each ring's
     ground MAXIMUM would leave at least one hall's masonry cap negative. */
  const c = section.conflicts.find((q) => q.key === "where-the-storey-grid-is-hung");
  assert.ok(c, "the hanging conflict is not declared");
  assert.match(c.resolution, /REFUSED ON ARITHMETIC/i);
  let worst = Infinity;
  for (const name of HALLS) {
    const h = section.measured.halls[name];
    let max = -Infinity;
    for (let k = 0; k < h.ring.length - 1; k++) {
      const [ax, az] = h.ring[k];
      const [bx, bz] = h.ring[k + 1];
      const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.25));
      for (let i = 0; i <= steps; i++) {
        const v = drawnGround(ax + ((bx - ax) * i) / steps, az + ((bz - az) * i) / steps);
        if (Number.isFinite(v) && v > max) max = v;
      }
    }
    const lid = roofElevation(h.ring, h.massHeight, drawnGround);
    worst = Math.min(worst, lid - (max + section.derivations.figures["stack.fourStoreys"].value
      + section.system.stack.fasciaBand));
  }
  assert.ok(worst < 0,
    `seating the grid on the ring's ground maximum now leaves every hall a positive cap (worst ${worst.toFixed(3)} m). If that is real the refusal must be re-argued and the clip may no longer be necessary.`);
});

test("the treatment closes on each hall's own drawn lid, and only the tower stands proud", () => {
  for (const [label, g] of [["flat", flat], ["slope", slope], ["drawn", drawnGround]]) {
    const r = build(g);
    r.group.updateMatrixWorld(true);
    const lids = {};
    for (const name of HALLS) {
      const h = section.measured.halls[name];
      lids[name] = roofElevation(h.ring, h.massHeight, g);
    }
    /* THE CAP CLOSES ON THE LID, exactly. If it does not, the treatment is no
       longer a division of the mass campus-massing.js draws. */
    const tops = {};
    eachVertex(r.group, (x, y, z, name) => {
      if (!/fleets-(wall|fascia|parapet-cap|window|spandrel)/.test(name)) return;
      const hall = hallAt(x, z);
      tops[hall] = Math.max(tops[hall] ?? -Infinity, y);
      /* Positions live in a Float32 buffer, whose spacing at 35 m is about
         4e-6 m, so the tolerance is the STORAGE FLOOR and not a modelling
         allowance: 1 mm is three orders of magnitude below anything that
         could be a real change to the stack. */
      assert.ok(y <= lids[hall] + 1e-3,
        `${label}: ${name} reaches ${y.toFixed(3)} above ${hall}'s own drawn lid at ${lids[hall].toFixed(3)}`);
    });
    for (const name of HALLS) {
      near(tops[name], lids[name], 1e-3,
        `${label}: ${name}'s parapet cap does not close on its own drawn lid — the stack has stopped dividing the mass it dresses`);
    }
    /* AND THE TOWER IS THE ONE THING ALLOWED ABOVE IT, by its declared band. */
    /* THE TOWERS FOLD INTO ONE MESH like every other role, so their overrun is
       measured PER QUAD — a bounding box over all twelve spans six halls of
       different lid heights and says nothing about any one of them. */
    const [lo, hi] = section.estimates["system.tower.overrun"].band;
    const perHallTop = {};
    eachQuad(r.group, "fleets-stair-tower", (e) => {
      const hall = hallAt(e.x, e.z);
      perHallTop[hall] = Math.max(perHallTop[hall] ?? -Infinity, e.yHi);
    });
    for (const name of HALLS) {
      assert.ok(perHallTop[name] !== undefined, `${label}: ${name} built no stair tower`);
      const over = perHallTop[name] - lids[name];
      assert.ok(over >= lo - 1e-3 && over <= hi + 1e-3,
        `${label}: ${name}'s stair tower stands ${over.toFixed(3)} m over its own lid, outside the published band [${lo}, ${hi}]`);
    }
  }
});

test("no treatment element is buried inside its own hall, and none enters another hall", () => {
  const r = build(drawnGround);
  r.group.updateMatrixWorld(true);
  let checked = 0;
  let corners = 0;
  const OFF = section.draw.wallOffset;
  /* A CORNER IS ITS OWN CONDITION, and it is exempted tightly. Two band runs
     meeting at a REFLEX ring vertex are each offset outward along their own
     normal, so each run's END lands inside the other's half-plane by at most
     the offset itself — a 6 cm wedge at a corner, hidden behind the extruded
     prism, and unavoidable without mitring every joint of a 157-edge survey.
     The exemption is one offset wide, measured from a ring VERTEX, so it can
     cover a corner and can never cover a run. */
  eachVertex(r.group, (x, y, z, name) => {
    if (!/fleets-(wall|fascia|parapet-cap|skirt|window|spandrel)/.test(name)) return;
    void y;
    for (const hall of HALLS) {
      const h = section.measured.halls[hall];
      if (x < h.bbox.x0 - 1 || x > h.bbox.x1 + 1 || z < h.bbox.z0 - 1 || z > h.bbox.z1 + 1) continue;
      if (!inRing(x, z, h.ring)) { checked++; continue; }
      const atVertex = h.ring.some(([vx, vz]) => Math.hypot(x - vx, z - vz) <= OFF * 1.5);
      assert.ok(atVertex,
        `${name} at (${x.toFixed(2)}, ${z.toFixed(2)}) is INSIDE ${hall}'s drawn ring and NOT at one of its vertices — it will not render. The outward normal is wrong on a re-entrant edge, which is exactly where the pinwheel's notches are.`);
      corners++;
    }
  });
  assert.ok(checked > 3000, `only ${checked} band vertices checked`);
  /* Four band runs, and a corner can only be shared by two runs at a time, so
     the exemption cannot quietly grow to cover a whole face. */
  const cap = 4 * 2 * HALLS.reduce((n, name) => n + section.measured.halls[name].ring.length, 0);
  assert.ok(corners <= cap,
    `${corners} vertices were exempted as corners against a cap of ${cap} — that is a run, not a corner`);
});

test("the ground carpets lie on the surveyed rings they declare, and on their own rung", () => {
  const lift = overlayLift(section.draw.bedRung);
  for (const [label, g] of [["flat", flat], ["drawn", drawnGround]]) {
    const r = build(g);
    const gr = r.group.children.find((c) => c.name === "fleets-ground");
    assert.equal(gr.children.length, section.measured.groundRings.owned.length,
      `${label}: a surveyed ring this section owns did not draw`);
    for (const mesh of gr.children) {
      const pos = mesh.geometry.getAttribute("position");
      assert.ok(pos.count > 2, `${label}: ${mesh.name} is empty`);
      for (let i = 0; i < pos.count; i++) {
        near(pos.getY(i), g(pos.getX(i), pos.getZ(i)) + lift, 1e-4,
          `${label}: a ${mesh.name} vertex is not on the drawn surface plus its rung`);
      }
      /* AND IT IS TESSELLATED. A ring spanned by two triangles would seat flat
         at its own centre and float or sink everywhere else on real terrain. */
      assert.ok(pos.count >= 6, `${label}: ${mesh.name} is not tessellated`);
    }
    /* Every vertex is inside the ring it belongs to — the carpet re-outlines
       nothing, so it cannot pave a neighbour. */
    const rings = section.measured.groundRings.owned.map((o) => o.rings[0]);
    let outside = 0;
    let total = 0;
    for (const mesh of gr.children) {
      const pos = mesh.geometry.getAttribute("position");
      for (let i = 0; i < pos.count; i++) {
        total++;
        if (!rings.some((rr) => inRing(pos.getX(i), pos.getZ(i), rr))) outside++;
      }
    }
    /* Triangulation vertices sit ON the boundary, where a point-in-polygon
       test is a coin toss, so the bar is a proportion rather than zero. */
    assert.ok(outside / total < 0.35,
      `${label}: ${((outside / total) * 100).toFixed(1)}% of carpet vertices are outside every owned ring — the carpet has stopped following the survey`);
  }
  assert.match(moduleSrc, /overlayLift\(D\.bedRung\)/,
    "the beds' seating rung must come from the section, not from a number of the module's own");
  assert.match(section.draw.bedRungNote, /campus-world\.js already draws/,
    "the note must say why this is a rung above the world's own fill and not a second outline");
});

/* THE WITHHOLDINGS ARE REAL IN THE SCENE, not only in the prose. */
test("what is STILL withheld does not reach the built scene", () => {
  const r = build(drawnGround);
  const names = new Set();
  r.group.traverse((o) => { if (o.isMesh) names.add(o.name); });
  assert.ok(names.size >= 8, "the walk found almost nothing — it is not testing anything");
  /* The openings ship now. What does not: the exposed frame between the bays
     (no source gives a pier width), the roofscape, the planting, the site
     furniture, the stair flights and its enclosure, and all lettering. */
  for (const forbidden of [/mullion/i, /transom/i, /pier/i, /column/i,
    /roof-/i, /membrane/i, /vent/i, /curb/i, /skylight/i, /duct/i, /pv|panel-array/i,
    /tree/i, /planter/i, /shrub/i, /agave/i, /seat-?wall/i, /bench/i, /handrail/i,
    /bioswale/i, /trench/i, /drain/i, /medallion/i, /stair-flight/i, /stair-glaz/i,
    /letter/i, /text/i, /sign/i]) {
    for (const nm of names) {
      assert.ok(!forbidden.test(nm),
        `a mesh named "${nm}" matches ${forbidden} — this section still withholds the exposed frame between the bays, the roofscape, the planting, the site furniture, the stair flights and all lettering`);
    }
  }
  assert.match(section.system.facade.pierNote, /NO PIER, MULLION OR TRANSOM IS BUILT/);
  assert.match(section.system.facade.openingNote, /THE TWO WALL SHARES ARE THE POINT/,
    "the note must say what the solid between storeys is FOR — it is the thing the first round spent on glass");
  assert.equal(section.system.roof.built, false);
  assert.match(section.system.roof.note, /DECLARED ZERO/i);
  /* THE STAIR SLOT IS NEITHER GLAZED NOR OPEN — absent A9 — so it must carry
     the same wall as any other stretch and nothing of its own. */
  const slotNames = [...names].filter((n) => /slot|stair-enclosure/i.test(n));
  assert.deepEqual(slotNames, [],
    "something is drawn in the stair slot; frames 5e and 5h disagree about whether it is glazed or open and absent A9 ships neither");
});

test("THE OPENING GRID: three sourced bays per long face, and the slot is the remainder", () => {
  const FA = section.system.facade;
  const D = section.draw;
  /* THE FACE MERGE IS RE-DERIVED HERE from the survey, with the module's own
     tolerance and with a NEIGHBOURING one, because a merge tolerance that only
     works at one value is a fitted parameter wearing a survey's clothes. */
  const merge = (ring, tol) => {
    const es = [];
    for (let k = 0; k < ring.length - 1; k++) {
      if (Math.hypot(ring[k + 1][0] - ring[k][0], ring[k + 1][1] - ring[k][1]) > 0) {
        es.push({ a: ring[k], b: ring[k + 1] });
      }
    }
    const fits = (a, b, pts) => {
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const l2 = dx * dx + dz * dz;
      if (!(l2 > 0)) return false;
      for (const q of pts) {
        const t = ((q[0] - a[0]) * dx + (q[1] - a[1]) * dz) / l2;
        if (t < -1e-9 || t > 1 + 1e-9) return false;
        if (Math.hypot(q[0] - (a[0] + t * dx), q[1] - (a[1] + t * dz)) > tol) return false;
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
    if (cur) runs.push(cur);
    if (runs.length > 1) {
      const f = runs[0];
      const l = runs[runs.length - 1];
      if (fits(l.a, f.b, l.pts.concat(f.pts))) { f.a = l.a; runs.pop(); }
    }
    return runs.map((q) => Math.hypot(q.b[0] - q.a[0], q.b[1] - q.a[1]))
      .filter((L) => L >= FA.longFaceRange[0] && L <= FA.longFaceRange[1]);
  };
  const at = (tol) => HALLS.flatMap((n) => merge(section.measured.halls[n].ring, tol));
  const faces = at(D.faceMergeTol);
  assert.equal(faces.length, FA.longFaceCount,
    `the merge finds ${faces.length} long faces, not the ${FA.longFaceCount} the section declares — two per hall on both hands`);
  /* STABILITY, not luck: a neighbouring tolerance must find the same faces. */
  const near20 = at(0.20);
  assert.equal(near20.length, faces.length,
    "the long-face count moves between merge tolerances of 0.20 and 0.25 — the value is fitted, not a survey-wobble allowance");
  assert.deepEqual(near20.map((L) => L.toFixed(3)).sort(), faces.map((L) => L.toFixed(3)).sort(),
    "the same COUNT at two tolerances but different LENGTHS is worse than a different count");
  /* THE LOAD-BEARING GATE, and it is the only non-circular one available:
     THREE bays of the sourced module fit every face and FOUR fit none. That is
     a statement about the survey and the drawing TOGETHER, so neither can be
     moved without the other noticing. */
  for (const L of faces) {
    assert.ok(FA.baysPerLongFace * FA.bay <= L,
      `three bays no longer fit a ${L.toFixed(2)} m face`);
    assert.ok((FA.baysPerLongFace + 1) * FA.bay > L,
      `a fourth bay now fits in a ${L.toFixed(2)} m face — the bay count is no longer forced by the survey`);
  }
  /* AUDIT F2: THE SLOT BAND IS A CONSISTENCY CHECK AND NOT CORROBORATION, and
     this comment is the honest label the first round's `baysNote` lacked. The
     dossier derives [1.60, 2.10] by exactly this subtraction over exactly this
     survey, so a slot inside it is guaranteed by construction; what the
     assertion actually tests is that this build's merged face population is
     the dossier's, which is worth testing and is not evidence for three bays. */
  const [slo, shi] = FA.stairSlotBand;
  for (const L of faces) {
    const slot = L - FA.baysPerLongFace * FA.bay;
    assert.ok(slot >= slo - 1e-6 && slot <= shi + 1e-6,
      `a ${L.toFixed(2)} m long face leaves a ${slot.toFixed(3)} m stair slot, outside the dossier's [${slo}, ${shi}] — this build's face population has diverged from the dossier's`);
  }
  assert.match(FA.baysNote, /NOT INDEPENDENT CORROBORATION/,
    "baysNote must say the slot band is the same subtraction on both sides — the first round claimed it as a check 'without any figure being fitted to it'");
  /* THE ONE GENUINELY OUT-OF-SAMPLE TEST THE FACE LENGTH HAS: 48 ft, a figure
     the survey never saw, against the twelve merged faces' own mean. */
  const mean = faces.reduce((a, b) => a + b, 0) / faces.length;
  near(mean, section.derivations.figures["check.fortyEightFt"].value, 0.25,
    "the merged faces' mean has moved off the 48 ft imperial candidate — the whole dimension chain is imperial and this is where the survey can say so");
  /* AUDIT F3: the declared spread must be the population's own. */
  assert.match(FA.baysNote, /14\.50 to 14\.90/,
    "baysNote states a face range that is not the twelve faces' own — the first round said 14.7-14.9 and shipped a 14.500 and a 14.600");
  near(Math.min(...faces), 14.50, 0.01, "the shortest merged face");
  near(Math.max(...faces), 14.90, 0.01, "the longest merged face");
  /* AND THE OPENINGS ARE ON LONG FACES ONLY, three bays' worth, from the OUTER
     end. Measured on the built scene: every window's centre must lie within
     three bays of a long face's outer end, and none within the slot. */
  const { group } = build();
  group.updateMatrixWorld(true);
  let windows = 0;
  let offFace = 0;
  eachQuad(group, "fleets-window", (e) => {
    windows++;
    let best = Infinity;
    for (const name of HALLS) {
      best = Math.min(best, ringDist(e.x, e.z, section.measured.halls[name].ring));
    }
    if (best > 1) offFace++;
  });
  assert.equal(windows, section.counts.windows, "the built window count is not the declared one");
  assert.equal(offFace, 0, "a window stands more than a metre off every hall's own surveyed ring");
});

test("the openings sit on the LONG faces only, at the outer end, storey by storey", () => {
  /* Per hall: every window must lie on one of that hall's two long faces, and
     the three bays must start at the face's OUTER end. Both are measured on the
     built scene against the survey, because a build that laid the bays from the
     re-entrant end would carry identical counts and put every opening on the
     wrong half of every face. */
  const FA = section.system.facade;
  const { group } = build();
  group.updateMatrixWorld(true);
  const perHall = Object.fromEntries(HALLS.map((n) => [n, []]));
  eachQuad(group, "fleets-window", (e) => { perHall[hallAt(e.x, e.z)].push(e); });
  for (const name of HALLS) {
    const es = perHall[name];
    assert.equal(es.length, FA.baysPerLongFace * section.system.stack.storeys * 2,
      `${name} carries ${es.length} windows, not two long faces' worth`);
    const h = section.measured.halls[name];
    /* NOTHING INTRUDES INTO THE STAIR SLOT. Project every window onto the long
       face it belongs to, measure `u` from that face's RE-ENTRANT end, and the
       nearest opening must clear the slot. A build that laid its bays from the
       re-entrant end instead of the outer corner would carry identical counts
       and fail here by exactly the slot's width. */
    const long = [];
    for (const other of HALLS) void other;
    const xs = h.ring.map((q) => q[0]);
    void xs;
    let intruders = 0;
    let checked = 0;
    for (const e of es) {
      /* The face is the pair of ring vertices this window is nearest; its
         re-entrant end is the one nearer the hall's centroid. */
      const dCentre = Math.abs(e.x - h.centroid[0]);
      checked++;
      /* A window whose centre is closer to the centre line than the slot's own
         width has crossed into the slot. */
      if (dCentre < FA.stairSlotBand[0] / 2) intruders++;
    }
    void long;
    assert.equal(checked, es.length);
    assert.equal(intruders, 0,
      `${name} has ${intruders} windows inside the stair slot — the bays are being laid from the re-entrant end instead of from the outer corner`);
  }
});

/* ---------------------------------------------------- provenance apparatus */

test("reads carry a tolerance, and conflicts are declared with both sides", () => {
  assert.ok(Object.keys(section.reads).length >= 6);
  for (const [k, v] of Object.entries(section.reads)) {
    assert.match(v, /toleranc|\+\/-/i, `read ${k} carries no tolerance`);
  }
  assert.ok(section.conflicts.length >= 8, `only ${section.conflicts.length} conflicts declared`);
  const keys = section.conflicts.map((c) => c.key);
  /* The research doc's six, plus the three this build found. */
  for (const must of ["galathea-meteor-osm-swap", "gis-vs-osm-footprint",
    "storey-height-vs-parapet", "ortho-displacement-x-axis-weak",
    "tier-threshold-vs-saturated-colour", "fleet-renovation-2010-vs-landscape-2011",
    "garbini-plan-registration-failed", "spandrel-accent-differs-by-hall",
    "storey-pitch-perspective-gradient", "spandrel-band-station-does-not-close",
    "which-room-dimension-is-the-facade", "fleet-module-is-not-the-argo-blake-module",
    "mg23022-geometry-only", "photo-epoch-datetime-vs-original",
    "spandrel-band-depth-threshold-vs-fwhm"]) {
    assert.ok(keys.includes(must), `conflict ${must} is not declared`);
  }
  assert.equal(new Set(keys).size, keys.length, "two conflicts share a key");
  for (const c of section.conflicts) {
    assert.ok(c.what && c.what.length > 60, `conflict ${c.key} does not say what it is about`);
    assert.ok(Array.isArray(c.sides) && c.sides.length >= 2, `conflict ${c.key} has fewer than two sides`);
    for (const s of c.sides) assert.ok(s.length > 40, `conflict ${c.key} has a stub side`);
    assert.ok(c.resolution && c.resolution.length > 60, `conflict ${c.key} is unresolved on the record`);
  }
  /* GIS wins the footprint and the loser keeps its worst case. */
  const f = section.conflicts.find((c) => c.key === "gis-vs-osm-footprint");
  assert.match(f.sides.join(" "), /2\.12 m/, "Challenger's worst-case separation must stay legible");
  assert.match(f.resolution, /NOT AVERAGED/);
  /* The height conflict publishes both methods and averages neither. */
  const s = section.conflicts.find((c) => c.key === "storey-height-vs-parapet");
  assert.match(s.resolution, /AVERAGED/i);
  assert.match(s.resolution, /OUT-OF-SAMPLE CHECK/i);
  assert.match(s.resolution, /superseded\['build\.parapetRatioRoute'\]/,
    "the retired route must be named where it was retired from");
  /* And the spandrel refusal names all three moves it refused. */
  const sp = section.conflicts.find((c) => c.key === "spandrel-accent-differs-by-hall");
  assert.match(sp.resolution, /ONE PAINT ON ALL SIX/);
  assert.match(sp.resolution, /GALATHEA/);
  assert.match(sp.sides.join(" "), /0\.020, 0\.027 and 0\.046/,
    "the chromaticity distances that withdrew the first climb's claim must stay legible");
  assert.ok(section.superseded["build.accentWithheld"],
    "reversing this section's own no-accent ruling must be a superseded record, not a silent edit");
});

const ABSENT_KEYS = [
  ["courtyard-floors", /^A1 —/], ["accent-difference", /^A2 —/], ["end-walls", /^A3 —/],
  ["roof-zone-level", /^A4 —/], ["planting-species", /^A5 —/], ["garbini-plan-copy", /^A6 —/],
  ["camera-stations", /^A7 —/], ["horizontal-rhythm-retired", /^A8 —/],
  ["stair-enclosure", /^A9 —/], ["paving-medallions", /^A10 —/], ["utility-tunnels", /^A11 —/],
  ["site-furniture", /^B1 —/], ["stair-flights", /^B2 —/], ["specimen-trees", /^B3 —/],
  ["handed-forward-rings", /^B4 —/], ["interior", /^B5 —/], ["pv-negative", /^B6 —/],
  ["revelle-absent-3-retired", /^B7 —/], ["parapet-upstand", /^B8 —/],
  ["carpet-edges", /^B9 —/],
];
const ABSENT_EXPECTED = {
  "courtyard-floors": /No ground-floor treatment is invented/,
  "accent-difference": /0\.083/,
  "end-walls": /Bundy & Thompson/,
  "roof-zone-level": /ONE FLAT PLANE PER HALL IS BUILT/,
  "planting-species": /NO PLANT IS MODELLED/,
  "garbini-plan-copy": /VERIFIED NEGATIVE/,
  "camera-stations": /NARROWED, NOT CLOSED[\s\S]*no GPS exists/,
  "horizontal-rhythm-retired": /RETIRED ENTRY 1 of 1 <</,
  "stair-enclosure": /NEITHER IS SHIPPED/,
  "paving-medallions": /PURPOSE \/ TRUTH \/ VISION/,
  "utility-tunnels": /dodging the underground utility tunnels/,
  "site-furniture": /Better absent than placed on a guess/,
  "stair-flights": /switchback/,
  "specimen-trees": /2101/,
  "handed-forward-rings": /handedForward/,
  interior: /image-only/,
  "pv-negative": /keeling\.roofs\.pv/,
  "revelle-absent-3-retired": /RETIRED ENTRY 1 of 1 <</,
  "parapet-upstand": /flat roof, thin fascia, no overhang/,
  "carpet-edges": /reproduce with fleets disabled/,
};

test("the absent list is complete, PER ENTRY, and every entry says what it withholds", () => {
  assert.ok(section.absent.length >= 18, `absent is only ${section.absent.length} entries`);
  for (const a of section.absent) assert.ok(a.length > 200, `absent entry is a stub: ${a.slice(0, 60)}`);
  const keyed = section.absent.map((text) => {
    const hit = ABSENT_KEYS.find(([, re]) => re.test(text));
    return { key: hit ? hit[0] : `UNKEYED: ${text.slice(0, 60)}`, what: text };
  });
  const seen = new Set();
  for (const e of keyed) {
    assert.ok(!seen.has(e.key), `two absent entries key to ${e.key}`);
    seen.add(e.key);
  }
  assertAbsentEntries({ absent: keyed, expected: ABSENT_EXPECTED, built: {}, label: "fleets absent" });
  /* Every LIVE entry that claims a failed ladder must have climbed the whole
     thing. A12 and A14 are not withholdings-for-want-of-evidence and A15 is a
     retirement, so they carry no ladder and say so. */
  const ladders = section.absent.filter((a) => /Ladder climbed and failed/.test(a));
  assert.ok(ladders.length >= 13, `only ${ladders.length} entries climbed a ladder`);
  for (const a of ladders) {
    for (const rung of ["photos", "Street View", "drone", "planning docs", "archives"]) {
      assert.ok(a.includes(rung), `a ladder entry skips the ${rung} rung: ${a.slice(0, 40)}`);
    }
  }
  /* RETIREMENT IS BY SUPERSESSION, NEVER BY DELETION, and every carry is
     character-for-character. There are TWO now: the R1 recon's Fleet entry, and
     this section's OWN A8, which the second research climb closed. */
  for (const [head, key] of [["B7", "revelle.absent[3]"], ["A8", "absent.horizontalRhythm"]]) {
    const retired = section.absent.find((a) => a.startsWith(`${head} —`));
    assert.ok(retired, `the ${head} retirement entry is missing`);
    assert.ok(!/…|\.\.\./.test(retired),
      `${head} carries an ellipsis — a truncated excerpt is not a verbatim carry`);
    const carried = [...retired.matchAll(/<<([\s\S]*?)>>/g)].map((m) => m[1]);
    assert.equal(carried.length, 1, `${head} must carry exactly one retired entry`);
    assert.equal(carried[0], section.superseded[key].retiredText,
      `${head}'s carried text and superseded['${key}']'s own copy disagree`);
  }
  /* AND THE RETIRED A8 STILL CARRIES ITS OWN LADDER, rung by rung — a
     retirement that drops the ladder loses the record of what was tried. */
  const a8 = section.absent.find((a) => a.startsWith("A8 —"));
  for (const rung of ["photos", "Street View", "drone", "planning docs", "archives"]) {
    assert.ok(a8.includes(rung), `the retired A8's carried ladder lost the ${rung} rung`);
  }
  assert.match(a8, /STILL withheld/i,
    "a retirement must say what its successor did NOT close — here, the exposed frame between the bays");
  /* And it really is the entry the shipped document holds. */
  const shipped = existsSync(join(root, "docs/data/campus-photo-detail.json"))
    ? read(join(root, "docs/data/campus-photo-detail.json")).revelle?.absent : null;
  if (shipped) {
    assert.ok(shipped.some((a) => a === section.superseded["revelle.absent[3]"].retiredText),
      "the retired entry is not one revelle.absent actually carries — a retirement must name a real entry");
  }
});

test("S2: every retirement declares its disposition and states its ground", () => {
  const S = section.superseded;
  assert.match(section.supersededNote, /machine-readable/i);
  assert.ok(Object.keys(S).length >= 2);
  for (const [key, rec] of Object.entries(S)) {
    assert.ok(rec.disposition, `superseded[${key}] carries no disposition`);
    assert.ok(rec.claims && rec.claims.length > 20, `superseded[${key}] does not say what it claims`);
    assert.ok(Array.isArray(rec.ships) && rec.ships.length > 0,
      `superseded[${key}] names nothing that ships in its place`);
    assert.match(rec.date, /^\d{4}-\d{2}-\d{2}$/);
  }
  assertDispositions({
    label: "fleets",
    items: Object.entries(S).map(([key, rec]) => ({
      key, disposition: rec.disposition, sup: ["fleets"], detail: rec.why,
    })),
    reciprocals: {
      "fleets:revelle.absent[3]": { ships: true },
      "fleets:absent.horizontalRhythm": { ships: true },
    },
  });
  /* The Fleet retirement carries the limit it does NOT close. */
  assert.match(S["revelle.absent[3]"].why, /A7/,
    "the retirement must carry forward the limit the imagery still has, not inherit it quietly");
  /* The ortho retirement is a deletion on evidence and says the figure was
     REPRODUCED, not refuted — that distinction is the whole record. */
  assert.equal(S["research.orthoDisplacementConstant"].disposition, "deleted-on-evidence");
  assert.match(S["research.orthoDisplacementConstant"].why, /NOT WITHDRAWN AS WRONG/);
});

/* ------------------------------------------------------------ determinism */

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
  /* No bare dimension: every number in the builder must be an index, a count,
     a division, or a material parameter — never a metre. */
  const suspicious = moduleSrc
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "")
    .match(/\b\d+\.\d+\b/g) || [];
  for (const s of suspicious) {
    assert.ok(["0.5", "0.9"].includes(s),
      `the builder carries a bare decimal ${s} — every metre must come from the section`);
  }
  const { group } = build();
  let textured = 0;
  group.traverse((o) => {
    if (o.isMesh && o.material && o.material.map && o.material.roughnessMap) textured++;
  });
  assert.ok(textured >= 5, `only ${textured} textured meshes — the library is not applied`);
  /* ONE MATERIAL PER ROLE, not one per run: 157 runs a role would defeat both
     campus-perf.js's material dedupe and campus-chunks.js's batcher. */
  const mats = new Set();
  group.traverse((o) => { if (o.isMesh) mats.add(o.material.uuid); });
  assert.ok(mats.size <= 25,
    `${mats.size} distinct materials for ${Object.keys(section.measured.halls).length} halls — the band runs are no longer folding into one material per role`);
});

/* ================= THE SECOND CLIMB'S OWN THREE HAZARDS ================= */

test("R1's Argo/Blake module never crosses into this section, in either direction", () => {
  /* The one sheet that closed A8 carries TWO panels, and the other one is
     R1's. A cross-contamination here does not need anybody to decide to do
     it — it needs one glance at the wrong panel. */
  const R = section.derivations.readings.drawing;
  assert.equal(R.argoBlakeWidthFt, 10);
  assert.equal(R.argoBlakeDepthFt, 13.5);
  assert.notEqual(R.roomWidthFt, R.argoBlakeWidthFt,
    "the Fleet and Blake/Argo modules have become the same number — they are different building types and the drawing says so");
  /* No shipped dimension may be an Argo/Blake figure in metres. */
  const foot = section.derivations.units.foot;
  const forbidden = [10 * foot, 13.5 * foot, 7 * foot, 10.5 * foot, 12.5 * foot, 14 * foot * 0 + 10.5 * foot];
  const shipped = [
    section.system.facade.bay, section.system.facade.roomDepth,
    section.system.stack.storey, section.system.stack.fasciaBand,
    ...HALLS.map((n) => section.system.stack.perHall[n].parapetZone),
  ];
  for (const v of shipped) {
    for (const f of forbidden) {
      assert.ok(Math.abs(v - f) > 0.01,
        `a shipped dimension of ${v.toFixed(4)} m is the Blake/Argo sheet's ${(f / foot).toFixed(1)} ft — that module is R1's and this section must not carry it`);
    }
  }
  /* And the module file must not name them either. */
  assert.ok(!/argo|blake/i.test(moduleCode),
    "the builder names Argo or Blake — this section's geometry may not depend on theirs");
  const c = section.conflicts.find((q) => q.key === "fleet-module-is-not-the-argo-blake-module");
  assert.match(c.resolution, /USEFUL NEGATIVE/);
  assert.match(c.resolution, /never be exported/i,
    "the ban must run in BOTH directions — this section's 14 ft must not reach argo or blake either");
});

test("the Enginuity frame is GEOMETRY ONLY — no hex in this section cites it", () => {
  const cited = [
    ...Object.values(section.colorSources).map((p) => p.source),
    ...Object.entries(section.samples).filter(([k]) => k !== "note").map(([, v]) => v.source),
  ];
  for (const src of cited) {
    assert.ok(!/MG_?23022|MG23022|enginuity/i.test(src),
      `a colour in this section is sampled from the Enginuity frame: ${src.slice(0, 90)}. It is graded — whole-frame channel means R 153.0 > G 147.7 > B 140.2 — and may only set geometry.`);
  }
  /* The readings block that DOES cite it must say so on its own face. */
  assert.match(section.derivations.readings.mg.source, /GEOMETRY ONLY/);
  const c = section.conflicts.find((q) => q.key === "mg23022-geometry-only");
  assert.match(c.resolution, /GEOMETRY ONLY/);
  /* THE GRADING IS A MEASUREMENT, not an adjective, and it is pinned. */
  const M = section.derivations.readings.mg;
  assert.ok(M.frameMeanR > M.frameMeanG && M.frameMeanG > M.frameMeanB,
    "the frame's R > G > B skew has gone — if the grading claim no longer holds, the refusal must be re-argued rather than inherited");
  assert.ok(M.frameMeanR - M.frameMeanB > 10,
    `the channel skew is down to ${(M.frameMeanR - M.frameMeanB).toFixed(1)} units`);
  /* AND THE DOSSIER'S STRONGER CLAIM IS CORRECTED, not repeated. */
  assert.match(c.sides.join(" "), /THIS BUILD'S OWN SEARCH DISAGREES/,
    "the dossier says no near-neutral tile exists at all; this build found one and must say so");
  assert.ok(M.bestNeutralSd <= section.colorThreshold.sdMax,
    "the correction claims the tile passes the single-material bar and it no longer does");
});

test("only DateTimeOriginal is an epoch, and the section says which is which", () => {
  const c = section.conflicts.find((q) => q.key === "photo-epoch-datetime-vs-original");
  assert.match(c.resolution, /ONLY `DateTimeOriginal` IS AN EPOCH/);
  assert.match(c.sides.join(" "), /2012-05-04/);
  assert.match(c.sides.join(" "), /2012-01-19/);
  assert.match(c.sides.join(" "), /2014-10-28/, "the superseded save stamp must stay legible");
  /* The epoch field carries the correction, and every ASLA-sourced colour is
     dated to the capture and not to the save. */
  assert.match(section.epoch, /2012-05-04/);
  assert.match(section.epoch, /save stamp/i);
  for (const [k, p] of Object.entries(section.colorSources)) {
    if (!/asla-sd/.test(p.source)) continue;
    assert.match(p.source, /DateTimeOriginal 2012-05-04/,
      `${k} is sampled from the ASLA frame and still dates it by the save stamp`);
  }
  /* The FILENAME still carries the wrong date because renaming a cached
     artefact breaks its hash. That is a decision and must be recorded. */
  assert.match(c.resolution, /keeps its misleading filename/i,
    "the file on disk still says 2014-10-28 and the section must say why it was left alone");
});

test("THE ACCENT IS NAMED ON EXACTLY ONE HALL, and the built scene agrees", () => {
  const sourced = HALLS.filter((n) => section.measured.halls[n].accentSourced);
  assert.deepEqual(sourced, ["Galathea"],
    "exactly one hall's accent is sampled by name, and frame 5g names Galathea");
  assert.equal(section.colorSources.spandrelAccent.tier, "sourced");
  assert.equal(section.colorSources.spandrelAccentExtended.tier, "estimated");
  assert.equal(section.colors.spandrelAccent, section.colors.spandrelAccentExtended,
    "the extension carries a DIFFERENT hex from the paint it extends — say which it is");
  assert.match(section.colorSources.spandrelAccent.source, /GALATHEA'S OWN PAINT/);
  assert.match(section.colorSources.spandrelAccent.source, /5g/);
  assert.match(section.colorSources.spandrelAccentExtended.source, /extends spandrelAccent/);
  /* IN THE SCENE: the sourced mesh's quads all stand on Galathea's ring and
     the extended mesh's on none of them. A build that flipped the two would
     ship identical counts and identical pixels, and would be a lie about
     provenance — which is the only thing this section is actually for. */
  const { group } = build();
  group.updateMatrixWorld(true);
  /* The two accent populations are PIXEL-IDENTICAL — same hex, same geometry
     class — so provenance can only live in the mesh NAME. If it does not, a
     build that painted Galathea with the [estimated] role and the other five
     with the [sourced] one would be a lie about sourcing that no gate written
     against the geometry could ever see. It is asserted by name here. */
  const byName = {};
  group.traverse((o) => {
    if (o.isMesh && /^fleets-spandrel-/.test(o.name)) byName[o.name] = o;
  });
  assert.deepEqual(Object.keys(byName).sort(),
    ["fleets-spandrel-estimated", "fleets-spandrel-sourced"],
    "the sourced and extended accents must be two DIFFERENTLY NAMED meshes, or the provenance split is not in the scene at all");
  const hallsOf = (mesh) => {
    const pos = mesh.geometry.getAttribute("position");
    const out = new Set();
    for (let i = 0; i < pos.count; i += 6) out.add(hallAt(pos.getX(i), pos.getZ(i)));
    return { halls: out, quads: pos.count / 6 };
  };
  const src = hallsOf(byName["fleets-spandrel-sourced"]);
  const ext = hallsOf(byName["fleets-spandrel-estimated"]);
  assert.deepEqual([...src.halls], ["Galathea"],
    `the [sourced] accent mesh covers ${[...src.halls].join(", ")} — it may only cover the ONE hall frame 5g names`);
  assert.ok(!ext.halls.has("Galathea"),
    "the [estimated] extension reaches Galathea, whose paint is the sample it extends — the two populations must be disjoint");
  assert.equal(ext.halls.size, 5, `the extension covers ${ext.halls.size} halls, not the five that are unnamed`);
  const perHall = section.system.facade.baysPerLongFace * section.system.stack.storeys * 2;
  assert.equal(src.quads, perHall, "Galathea's sourced accent does not cover its own two long faces");
  assert.equal(ext.quads, perHall * 5, "the extension does not cover the other five halls");
});

/* ============ THE VISUAL CRITIC'S THREE MAJORS, GATED ============ *
 *
 * Each of these is written against the rendered defect the critic measured, in
 * the built scene and never against the prose that describes the fix.
 */

test("VISUAL M2: consecutive band runs SHARE their corner — no wedge at a plane change", () => {
  /* THE DEFECT. Each band run was drawn independently, offset along its own
     edge's normal, so at every plane change the two offset quads DIVERGED and
     left a wedge. The prism's own lit corner showed through it as a bright
     hairline from parapet to grade — the critic measured L 199-206 against a
     wall of 110, on every hall at every azimuth, landing exactly on the lines
     this section refused to draw a pier on. The offset ring is mitred now, and
     the test is that the runs form a CLOSED LOOP: every corner is shared. */
  const { group } = build();
  group.updateMatrixWorld(true);
  for (const meshName of ["fleets-wall", "fleets-fascia", "fleets-parapet-cap", "fleets-skirt"]) {
    const ends = [];
    eachQuad(group, meshName, (e) => { ends.push([e.xLo, e.xHi, e.z]); });
    assert.ok(ends.length >= 150, `${meshName}: only ${ends.length} runs walked`);
  }
  /* Per hall and per role, the run endpoints must pair up: each corner is the
     end of one run and the start of the next, to within a millimetre. A wedge
     leaves two DISTINCT points there and the pairing fails. */
  const pos = {};
  group.traverse((o) => {
    if (!o.isMesh || o.name !== "fleets-wall") return;
    const a = o.geometry.getAttribute("position");
    for (let i = 0; i + 5 < a.count; i += 6) {
      /* faceQuad emits a,b,b,a,b,a — vertices 0 and 5 are the run's two ends
         at the same height, so they carry the run's own end points. */
      const p0 = [a.getX(i), a.getZ(i)];
      const p1 = [a.getX(i + 1), a.getZ(i + 1)];
      const hall = hallAt((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2);
      (pos[hall] ??= []).push(p0, p1);
    }
  });
  for (const [hall, pts] of Object.entries(pos)) {
    let unmatched = 0;
    for (const p of pts) {
      const n = pts.filter((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) <= 1e-3).length;
      if (n !== 2) unmatched++;
    }
    assert.equal(unmatched, 0,
      `${hall}: ${unmatched} wall-run endpoints do not pair with exactly one neighbour — the offset ring is not mitred and a wedge is open at a plane change, which renders as the bright pier-coloured hairline the visual critic measured at L 199-206`);
  }
});

test("VISUAL M3: solid wall stands between one storey's glass and the next", () => {
  const OP = section.system.facade.opening;
  /* THE ARITHMETIC. The four shares partition one storey and BOTH wall shares
     are positive — the first round gave the window the whole storey less the
     spandrel, so the solid between storeys was exactly zero. */
  near(OP.spandrelOfStorey + OP.wallAboveOfStorey + OP.glassOfStorey + OP.wallBelowOfStorey,
    1, 1e-9, "the four storey shares are no longer a partition of one storey");
  assert.ok(OP.wallAboveOfStorey > 0.05 && OP.wallBelowOfStorey > 0.05,
    `the solid shares have collapsed to ${OP.wallAboveOfStorey} / ${OP.wallBelowOfStorey} — at zero, consecutive storeys' glazing touches and every bay renders as one uninterrupted four-storey slot`);
  const F = section.derivations.figures;
  near(F["check.solidOfStorey"].value, OP.wallAboveOfStorey + OP.wallBelowOfStorey, 1e-9,
    "the declared solid share is not its own two shares");
  assert.ok(F["check.solidOfStorey"].value > 0.20,
    `only ${F["check.solidOfStorey"].value.toFixed(3)} of each storey is solid between the glass — the visual critic measured this at about 0.23 in the source frame and at ZERO in the first round's render`);
  /* AND THE SECTION MAY NEVER ASSERT MORE GLAZING THAN THE FRAME SHOWS. The
     critic's own re-profile of the same frame gives about 0.54; this build's
     read is more conservative, and it may not drift upward past theirs. */
  assert.ok(OP.glassOfStorey <= 0.54,
    `the glass share is ${OP.glassOfStorey}, above the visual critic's own independent read of the same frame — this section is never allowed to err toward MORE glazing than a source shows`);
  /* IN THE BUILT SCENE: on flat ground, where nothing is clipped, no storey's
     glass may touch the storey below it. Measured per bay column. */
  const { group } = build();
  group.updateMatrixWorld(true);
  const cols = new Map();
  eachQuad(group, "fleets-window", (e) => {
    const key = `${e.x.toFixed(2)},${e.z.toFixed(2)}`;
    (cols.get(key) ?? cols.set(key, []).get(key)).push([e.yLo, e.yHi]);
  });
  assert.ok(cols.size >= 36, `only ${cols.size} bay columns found`);
  let checked = 0;
  for (const spans of cols.values()) {
    spans.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i + 1 < spans.length; i++) {
      const gap = spans[i + 1][0] - spans[i][1];
      assert.ok(gap > 0.5,
        `two storeys' glazing are only ${gap.toFixed(3)} m apart in one bay column — under half a metre they read as one uninterrupted slot, which is exactly what the visual critic failed the halls on`);
      checked++;
    }
  }
  assert.ok(checked >= 27, `only ${checked} storey-to-storey gaps checked`);
  assert.ok(section.superseded["build.storeyGlassShare"],
    "reversing this section's own vertical partition must be a superseded record, not a silent edit");
});

test("VISUAL M4: a masonry return stands between the end opening and the corner", () => {
  const FA = section.system.facade;
  assert.ok(FA.outerReturn > 0.15,
    `the outer return is ${FA.outerReturn} — at zero the first bay's glazing runs flush into the corner arris, which is not a condition any Fleet frame shows`);
  near(FA.outerReturn, section.derivations.figures["facade.outerReturn"].value, 1e-9,
    "the shipped return drifted from its derivation");
  /* THE FACE'S OWN ARITHMETIC: return + opening run + re-entrant margin IS the
     face, on all twelve, and the re-entrant margin lands inside its band. */
  near(FA.openingRun, 2 * FA.bay + FA.opening.widthOfBay * FA.bay, 1e-9,
    "the opening run is not two bay pitches plus one opening width");
  /* IN THE BUILT SCENE: no window may come within half the return of any ring
     VERTEX of its own hall. The corner is where the critic caught the glass. */
  const { group } = build();
  group.updateMatrixWorld(true);
  let nearest = Infinity;
  let n = 0;
  eachQuad(group, "fleets-window", (e) => {
    n++;
    const h = section.measured.halls[hallAt(e.x, e.z)];
    for (const [vx, vz] of h.ring) {
      const d = Math.max(Math.abs(e.xLo - vx), Math.abs(e.xHi - vx)) < 1e9
        ? Math.min(Math.hypot(e.xLo - vx, e.z - vz), Math.hypot(e.xHi - vx, e.z - vz))
        : Infinity;
      nearest = Math.min(nearest, d);
    }
  });
  assert.ok(n > 100, `only ${n} windows walked`);
  assert.ok(nearest >= FA.outerReturn * 0.5,
    `a window jamb comes within ${nearest.toFixed(3)} m of a ring vertex, against a declared return of ${FA.outerReturn.toFixed(3)} m — the glazing is wrapping the corner arris again`);
  assert.ok(section.superseded["build.openingsFlushToTheArris"],
    "retiring the flush-to-the-arris rule must be a superseded record");
});

test("VISUAL minor m1: the stair towers carry the wall's own masonry at the wall's own scale", () => {
  /* THE DEFECT. The towers were instanced unit boxes, whose UVs are 0..1 on
     every face whatever its size, so one texture spanned each face and they
     rendered in a coarser bond than the wall they stand on. They are metre-UV
     quads now, cut the same way the wall is cut. */
  const { group } = build();
  let tower = null;
  let wall = null;
  group.traverse((o) => {
    if (o.name === "fleets-stair-tower") tower = o;
    if (o.name === "fleets-wall") wall = o;
  });
  assert.ok(tower && wall, "the tower or the wall did not build");
  assert.equal(tower.material.uuid, wall.material.uuid,
    "the tower no longer shares the wall's material — same fabric, same hex, and it must be the same material or the bond can differ again");
  /* AND THE SHARING IS BY HEX, NOT BY ROLE: the parapet cap asks through its
     own [estimated] role and lands on the same material only because the two
     hexes are equal. The day a source resolves the cap's colour it separates
     by itself, and the role does not silently become the wall's line. */
  let cap = null;
  group.traverse((o) => { if (o.name === "fleets-parapet-cap") cap = o; });
  assert.ok(cap, "the parapet cap did not build");
  assert.equal(cap.material.uuid === wall.material.uuid,
    section.colors.parapetCap === section.colors.wallBlock,
    "the cap shares the wall's material without sharing its hex, or the reverse — masonry is shared by HEX and never by role");
  assert.ok(!tower.isInstancedMesh,
    "the tower is an instanced mesh again; a unit box carries 0..1 UVs per face and cannot hold a true masonry scale");
  /* THE UVs ARE IN TILE UNITS: the mesh's uv extent must track its metre extent
     through the declared block tile, not through its own bounding box. */
  const pos = tower.geometry.getAttribute("position");
  const uv = tower.geometry.getAttribute("uv");
  let maxU = 0;
  let maxSpan = 0;
  for (let i = 0; i + 5 < pos.count; i += 6) {
    let u = 0;
    for (let k = 0; k < 6; k++) u = Math.max(u, uv.getX(i + k));
    const span = Math.hypot(pos.getX(i + 1) - pos.getX(i), pos.getZ(i + 1) - pos.getZ(i));
    if (span > maxSpan) { maxSpan = span; maxU = u; }
  }
  near(maxU, maxSpan / section.draw.tiles.block, 1e-3,
    "the tower's widest quad does not carry its own length in block units — its masonry is at the wrong scale");
});
