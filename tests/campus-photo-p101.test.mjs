/* Lot P101's photo-sourced detail section — the INVENTED class, at the ultra
 * standard.
 *
 * The Eighth audit proved that presence gates pass on wholesale fabricated
 * values, so almost nothing here merely checks that a key exists. Every drawn
 * figure is recomputed INDEPENDENTLY from the section's own readings and must
 * match; every drawn number must be covered by a derivation, a banded
 * estimate that names the pattern it extends, or a pinned read; the surveyed
 * ring must be byte-identical to the survey; the stall stations the module
 * BUILDS must land on the stations the section DERIVES; and the geometry is
 * re-built on flat ground, on an exaggerated slope and on the REAL drawn
 * LiDAR surface with nothing hovering and nothing sinking.
 *
 * The section-level claims this file exists to hold P101 to:
 *
 *   - THE COUNT OF RECORD WINS. Thirteen stalls, not the sixteen the
 *     measured frontage would take, and conflicts.stallCount is present.
 *   - EVERY ISLAND IS A RUN OF THE SURVEY RING. No island polygon is a shape
 *     of the module's own invention.
 *   - THE PAINT IS BLUE. No white stall, no numbered stall, no compact stall.
 *   - ONE REFERENCE ILLUMINANT. Five hexes come verbatim from pano a5Pc's two
 *     reprojections and the sunlit pano's rows are not shipped.
 *   - NOTHING TOUCHES THE ORTHO-AS-COLOUR-SOURCE RULING.
 *   - NO TREE IS DRAWN, because campus-world.js already draws both stems.
 *   - THE LEGENDS ARE RECORDED AND RENDERED NOWHERE.
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
  assertCoverage, assertEstimateBands, assertPins, assertRelations,
  assertTierSymmetry, assertAbsentEntries, assertExprs,
} from "./helpers/axiom-gate.mjs";
import { createPhotoP101 } from "../docs/js/campus-photo-p101.js";
import { makeSurfaceSampler } from "../docs/js/campus-terrain.js";
import { overlayLift, OVERLAY } from "../docs/js/campus-overlay.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(p, "utf8"));

/* PHOTO_DETAIL still lets a repair agent point the whole file at a candidate. */
const shippedDoc = read(join(root, "docs/data/campus-photo-detail.json"));
const section = process.env.PHOTO_DETAIL
  ? read(process.env.PHOTO_DETAIL).p101
  : shippedDoc.p101;

const lidar = read(join(root, "docs/data/campus-lidar.json"));
const arcgis = read(join(root, "docs/data/campus-arcgis.json"));
const campus = read(join(root, "docs/data/campus-3d.json"));
const drawnGround = makeSurfaceSampler(lidar.terrain);
const moduleSrc = readFileSync(join(root, "docs/js/campus-photo-p101.js"), "utf8");

/** The survey ring of record, recomputed from the survey rather than trusted. */
const SURVEY_RING = arcgis.ground[71].r[0].map(([x, z]) => [x / 10, z / 10]);

const at = (o, path) => path.split(".").reduce((v, k) => (v == null ? v : v[k]), o);
const near = (a, b, eps, what) =>
  assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b} (tolerance ${eps})`);

function dedupe(ring, tol) {
  const out = [ring[0]];
  for (const p of ring.slice(1)) {
    const q = out[out.length - 1];
    if (Math.abs(p[0] - q[0]) > tol || Math.abs(p[1] - q[1]) > tol) out.push(p);
  }
  return out;
}
const shoelace = (r) => {
  let a = 0;
  for (let i = 0; i < r.length; i++) {
    const j = (i + 1) % r.length;
    a += r[i][0] * r[j][1] - r[j][0] * r[i][1];
  }
  return a / 2;
};
const ringDist = (x, z, r) => {
  let best = Infinity;
  for (let i = 0; i < r.length; i++) {
    const [ax, az] = r[i];
    const [bx, bz] = r[(i + 1) % r.length];
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
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, zi] = r[i];
    const [xj, zj] = r[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
};

/* ---------------------------------------------- the external-truth pins */

/* Readings whose truth lives outside this repo — a code clause, a published
   count, a survey vertex, a standard product size. The literal lives HERE, so
   moving the reading in the section moves it away from the pin and fails. */
const READING_PINS = {
  "units.inch": { value: 0.0254, truth: "the inch is exactly 25.4 mm by international definition" },
  "units.foot": { value: 0.3048, truth: "the foot is exactly twelve inches, 304.8 mm, by international definition" },

  "ring.verts": { value: 128, truth: "arcgis.ground[71].r[0].length — the survey polygon's own vertex count, recomputed in this suite" },
  "ring.dedupedVerts": { value: 111, truth: "the same ring after collapsing consecutive duplicates at 0.05 m, recomputed in this suite from campus-arcgis.json" },
  "ring.area": { value: 1452.9, tol: 0.05, truth: "the shoelace area of the deduped arcgis.ground#71 ring, recomputed in this suite from campus-arcgis.json" },
  "ring.bboxX0": { value: -170.4, truth: "arcgis.ground#71's own western extreme, recomputed in this suite" },
  "ring.bboxX1": { value: -110.3, truth: "arcgis.ground#71's own eastern extreme, recomputed in this suite" },
  "ring.bboxZ0": { value: 243.8, truth: "arcgis.ground#71's own northern extreme, recomputed in this suite" },
  "ring.bboxZ1": { value: 281.3, truth: "arcgis.ground#71's own southern extreme, recomputed in this suite" },
  "ring.kerbN": { value: 250.2, tol: 0.25, truth: "the north kerb line of arcgis.ground#71, the z of its long northern run (vertices 103-110), checked against the ring in this suite" },
  "ring.aisleNz1": { value: 258.6, truth: "the ring vertex (-126.3, 258.6) — Row N's open edge, present verbatim in the survey" },
  "ring.rowNz1": { value: 264.1, truth: "the ring vertex (-126.3, 264.1) — Row N's head edge against the central walk, present verbatim in the survey" },
  "ring.walkZ1": { value: 266.1, truth: "the ring vertex (-126.2, 266.1) — Row S's head edge, present verbatim in the survey" },
  "ring.rowSz1": { value: 271.6, truth: "the ring vertex (-145.4, 271.6) — Row S's open edge, present verbatim in the survey" },
  "ring.southZ1": { value: 281.0, tol: 0.35, truth: "the ring's southern run against the Natural Sciences mass; the survey wobbles 280.4-281.3 along it and 281.0 is the value research-p101 §3.1 states" },
  "ring.segN1x0": { value: -160.9, truth: "the ring vertex (-160.9, 264.2) — the west island's base, present verbatim in the survey" },
  "ring.segN1x1": { value: -152.3, truth: "the ring vertex (-152.3, 265.6) — the middle island's west extreme, present verbatim in the survey" },
  "ring.segN2x0": { value: -145.4, truth: "the ring vertex (-145.4, 264.3) — the middle island's east edge, present verbatim in the survey" },
  "ring.segN2x1": { value: -126.3, truth: "the ring vertex (-126.3, 264.1) — the east island's north lobe west edge, present verbatim in the survey" },
  "ring.segN3x0": { value: -119.1, truth: "the ring vertex (-119.1, 264.0) — the east island's east edge, present verbatim in the survey" },
  "ring.segN3x1": { value: -110.6, truth: "the ring vertex (-110.6, 264.0) — the lot's east edge at the walk, present verbatim in the survey" },
  "ring.segS2x1": { value: -126.2, truth: "the ring vertex (-126.2, 266.1) — the east island's SOUTH lobe west edge, 0.1 m east of the north lobe's, present verbatim in the survey" },
  "ring.padX0": { value: -131.5, truth: "the ring vertex (-131.5, 267.6) — the utility pad's west edge, present verbatim in the survey" },
  "ring.padX1": { value: -130.2, truth: "the ring vertex (-130.2, 266.1) — the utility pad's east edge, present verbatim in the survey" },
  "ring.padZ0": { value: 266.1, truth: "the ring vertex (-130.2, 266.1) — the utility pad's north edge, present verbatim in the survey" },
  "ring.headWobble": { value: 0.3, truth: "the survey's OWN variation along the two head runs: Row N's head reads 264.1-264.3 (vertices -145.4, -134.6, -126.3) and Row S's reads 266.0-266.3 (vertices -145.4, -131.4, -126.2, -119.1). Recomputed against campus-arcgis.json in this suite" },
  "ring.padZ1": { value: 267.6, truth: "the ring vertex (-130.2, 267.6) — the utility pad's south edge, present verbatim in the survey" },
  "ring.islandWest.0": { value: 12, truth: "the deduped-ring index at which the west island's arc begins, verified against campus-arcgis.json in this suite" },
  "ring.islandWest.1": { value: 27, truth: "the deduped-ring index at which the west island's arc ends, verified against campus-arcgis.json in this suite" },
  "ring.islandMiddle.0": { value: 61, truth: "the deduped-ring index at which the middle island's oval begins, verified against campus-arcgis.json in this suite" },
  "ring.islandMiddle.1": { value: 84, truth: "the deduped-ring index at which the middle island's oval ends, verified against campus-arcgis.json in this suite" },
  "ring.islandEastNorth.0": { value: 86, truth: "the deduped-ring index at which the east island's north lobe begins, verified against campus-arcgis.json in this suite" },
  "ring.islandEastNorth.1": { value: 100, truth: "the deduped-ring index at which the east island's north lobe ends, verified against campus-arcgis.json in this suite" },
  "ring.islandEastSouth.0": { value: 41, truth: "the deduped-ring index at which the east island's south lobe begins, verified against campus-arcgis.json in this suite" },
  "ring.islandEastSouth.1": { value: 56, truth: "the deduped-ring index at which the east island's south lobe ends, verified against campus-arcgis.json in this suite" },
  "ring.padSlice.0": { value: 57, truth: "the deduped-ring index at which the utility pad's notch begins, verified against campus-arcgis.json in this suite" },
  "ring.padSlice.1": { value: 60, truth: "the deduped-ring index at which the utility pad's notch ends, verified against campus-arcgis.json in this suite" },

  "ucsd.reserved": { value: 1, truth: "UCSD's Concept3D map record for P101 and the independent Atlas CMS record: Reserved 1" },
  "ucsd.accessible": { value: 12, truth: "the same two independent UCSD map records: Accessible 12" },
  "ucsd.total": { value: 13, truth: "the same two independent UCSD map records: Total 13. The count of record; conflicts.stallCount holds the gap against the measured frontage" },

  "code.carStallFt": { value: 9, truth: "California Building Code 11B-502.2 — a car accessible space is at least 9 ft wide" },
  "code.vanStallFt": { value: 11, truth: "CBC 11B-502.2 — a van space is at least 11 ft wide, OR 9 ft where the access aisle is at least 8 ft" },
  "code.carAisleFt": { value: 5, truth: "CBC 11B-502.3 — an access aisle is at least 5 ft wide for the full stall length" },
  "code.vanAisleFt": { value: 8, truth: "CBC 11B-502.3 — a van access aisle is at least 8 ft wide" },
  "code.stallDepthFt": { value: 18, truth: "the 18 ft standard stall depth that the survey's own 5.5 m band reproduces to 14 mm" },
  "code.isaSymbolIn": { value: 36, truth: "CBC 11B-502.6.4.1 — the ISA pavement symbol is at least 36 in square" },
  "code.vanPerAccessible": { value: 6, truth: "CBC 11B-208.2.4 — at least one van space per six accessible spaces or fraction thereof" },
  "code.slopeMaxRatio": { value: 48, truth: "CBC 11B-502.4 — stall and aisle surface slope at most 1:48 in all directions. Recorded and NOT tested: absent[7] and conflicts.slopeUnmeasurable" },
  "code.r99cWidthIn": { value: 12, truth: "California MUTCD sign R99C (Accessible Parking), standard face 12 in wide" },
  "code.r99cHeightIn": { value: 18, truth: "California MUTCD sign R99C, standard face 18 in tall, portrait" },
  "code.r99bHeightIn": { value: 6, truth: "California MUTCD sign R99B (VAN ACCESSIBLE plate), standard face 12 x 6 in" },
  "code.wheelStopFt": { value: 6, truth: "the 6 ft precast wheel stop absent[2] names as the assumed standard" },
  "code.wheelStopIn": { value: 6, truth: "the 6 in height of the same assumed precast standard" },

  "sv.panosInsideRing": { value: 16, truth: "research-p101 §4.2 — sixteen Google Street View panoramas stand inside arcgis.ground#71, listed by pano id and world position" },
  "sv.hedgeDepthMin": { value: 2.0, truth: "research-p101 §0.6 / conflicts.southEdge — Street View shows roughly 2-2.5 m of planted hedge bed between the asphalt and the NatSci wall" },
  "sv.hedgeDepthMax": { value: 2.5, truth: "the upper end of the same 2-2.5 m Street View read" },
  "sv.natsciNorthFaceZ": { value: 280.0, truth: "the Natural Sciences GIS mass's north face, which the ring's south boundary runs 0.4-1.3 m inside — conflicts.southEdge" },

  "lidar.treeEastX": { value: -121.0, truth: "campus-lidar.json trees[] canopy maximum inside the east island's north lobe, recomputed against the shipped LiDAR in this suite" },
  "lidar.treeEastZ": { value: 261.3, truth: "the same campus-lidar.json tree row, recomputed against the shipped LiDAR in this suite" },
  "lidar.treeEastH": { value: 13.3, truth: "the same campus-lidar.json tree row's height, recomputed against the shipped LiDAR in this suite" },
  "lidar.treeEastR": { value: 6.6, truth: "the same campus-lidar.json tree row's crown radius, recomputed against the shipped LiDAR in this suite" },
  "lidar.treeMidX": { value: -142.8, truth: "campus-lidar.json trees[] canopy maximum for the middle island, 2.6 m east of the island ring — conflicts.treeTrunkOffset. Recomputed in this suite" },
  "lidar.treeMidZ": { value: 267.5, truth: "the same campus-lidar.json tree row, recomputed against the shipped LiDAR in this suite" },
  "lidar.treeMidH": { value: 14.5, truth: "the same campus-lidar.json tree row's height, recomputed against the shipped LiDAR in this suite" },
  "lidar.treeMidR": { value: 7.5, truth: "the same campus-lidar.json tree row's crown radius, recomputed against the shipped LiDAR in this suite" },
};

/* The `draw` block is pinned the same way and for the same reason: the
   coverage walk only asks that a number be ACCOUNTED FOR, so without a pin a
   render offset could be moved to any value and stay "covered". */
const DRAW_PINS = {
  dedupeTol: { value: 0.05, truth: "the tolerance research-p101 §2.1's own re-derivation script uses to collapse duplicate ring vertices; it is what produces 111 from 128" },
  drapeSeg: { value: 6, truth: "the longest triangle edge a draped surveyed ground polygon may span before it is split, in metres — the same order campus-photo-mayer.js uses" },
  drapeMaxDepth: { value: 4, truth: "the recursion cap on that split, so a pathological polygon cannot subdivide without bound" },
  footprintSamples: { value: 24, truth: "the number of points on a solid's own footprint circle the seat is taken over, so a rigid box or cylinder rests on the HIGHEST ground it covers rather than dipping into the hill on its uphill side" },
  kerbSegment: { value: 2, truth: "the spacing at which a straight kerb or walk edge is resampled so it follows the drawn terrain instead of spanning it, in metres" },
  paintStack: { value: 0.002, truth: "belt-and-braces millimetres inside the paint rung for eye-level parallax only — campus-overlay.js sets depthWrite:false, so this lift is not what orders the ISA outline/field/glyph; that is strictly ascending renderOrder on three meshes" },
  signThickness: { value: 0.02, truth: "the thickness of a sheet-metal sign face, a render dimension for a plate that is otherwise flat" },
  manholeThickness: { value: 0.02, truth: "the stand of a cast-iron cover proud of the asphalt around it, a render offset not a measurement" },
  glyphSegments: { value: 24, truth: "the tessellation of the ISA glyph's wheel annulus and head disc" },
  hedgeSegments: { value: 8, truth: "the tessellation of one clipped hedge shrub" },
  poleSegments: { value: 12, truth: "the tessellation of the light pole's base and tapered shaft" },
  hydrantSegments: { value: 10, truth: "the tessellation of the hydrant barrel and bonnet" },
  manholeSegments: { value: 16, truth: "the tessellation of the manhole cover disc" },
  "tiles.asphalt": { value: 6, truth: "metres of asphalt per texture tile — a material density, not a dimension" },
  "tiles.concrete": { value: 4, truth: "metres of concrete paving per texture tile" },
  "tiles.paint": { value: 2, truth: "metres of painted surface per texture tile" },
  "tiles.groundcover": { value: 3, truth: "metres of island groundcover per texture tile" },
  "tiles.mulch": { value: 3, truth: "metres of bark mulch per texture tile" },
  "tiles.kerb": { value: 2, truth: "metres of kerb face per texture tile" },
  "tiles.metal": { value: 1.5, truth: "metres of sheet metal per texture tile — posts, sign faces, the pole, the cabinet" },
  "glyph.wheelOuter": { value: 0.34, truth: "the ISA symbol's wheel outer radius as a fraction of its own field — the symbol's proportion, not a claim about the lot" },
  "glyph.wheelInner": { value: 0.27, truth: "the ISA symbol's wheel inner radius as a fraction of its own field" },
  "glyph.wheelOffsetX": { value: 0.06, truth: "the ISA symbol's wheel centre offset along x as a fraction of its own field" },
  "glyph.wheelOffsetZ": { value: -0.04, truth: "the ISA symbol's wheel centre offset along z as a fraction of its own field" },
  "glyph.headRadius": { value: 0.09, truth: "the ISA symbol's head disc radius as a fraction of its own field" },
  "glyph.headOffsetX": { value: -0.16, truth: "the ISA symbol's head offset along x as a fraction of its own field" },
  "glyph.headOffsetZ": { value: 0.3, truth: "the ISA symbol's head offset along z as a fraction of its own field" },
  "glyph.barWidth": { value: 0.1, truth: "the width of the ISA symbol's back and leg bars as a fraction of its own field" },
  "glyph.backOffsetX": { value: -0.06, truth: "the ISA symbol's back bar centre along x as a fraction of its own field" },
  "glyph.backOffsetZ": { value: 0.12, truth: "the ISA symbol's back bar centre along z as a fraction of its own field" },
  "glyph.backLength": { value: 0.38, truth: "the ISA symbol's back bar length as a fraction of its own field" },
  "glyph.backAngle": { value: 1.05, truth: "the ISA symbol's back bar angle in radians" },
  "glyph.legOffsetX": { value: 0.12, truth: "the ISA symbol's leg bar centre along x as a fraction of its own field" },
  "glyph.legOffsetZ": { value: -0.16, truth: "the ISA symbol's leg bar centre along z as a fraction of its own field" },
  "glyph.legLength": { value: 0.34, truth: "the ISA symbol's leg bar length as a fraction of its own field" },
  "glyph.legAngle": { value: 0.2, truth: "the ISA symbol's leg bar angle in radians" },
};

/* Every absent entry, held by a stable key and a probe that fails if the
   entry stops saying what it withholds. */
const ABSENT_PROBES = [
  [/^absent\[0\]/, /striping plan/i],
  [/^absent\[1\]/, /light-pole inventory/i],
  [/^absent\[2\]/, /Wheel-stop dimensions/i],
  [/^absent\[3\]/, /Sign mounting height/i],
  [/^absent\[4\]/, /second vehicular entrance/i],
  [/^absent\[5\]/, /west island is planted with a tree/i],
  [/^absent\[6\]/, /utility cabinet/i],
  [/^absent\[7\]/, /Stall surface slope/i],
  [/^absent\[8\]/, /2017-05 Street View epoch/i],
  [/^absent\[9\]/, /hatch pitch and stripe width/i],
  [/^absent\[10\]/, /west island's south \(base\) edge/i],
  [/^absent\[11\]/, /sign plate's own dimensions/i],
];
const absentKey = (e) => e.slice(0, e.indexOf("]") + 1);
const ABSENT = Object.fromEntries(
  section.absent.map((e, i) => [absentKey(e), ABSENT_PROBES[i] ? ABSENT_PROBES[i][1] : /.^/]),
);

/* The five colours that come verbatim from the reference illuminant, with the
   hex research-p101 §7 states as its result. A section that ships a different
   hex on any of these lines has not read its own source. */
const SOURCED_HEXES = {
  asphalt: "#6b6865",
  paintBlue: "#60718a",
  wheelStopYellow: "#bea273",
  fireLaneRed: "#a45d5a",
  hedgeGreen: "#333a2a",
};
/* And the two the dossier measured on the OTHER pano, which this section
   deliberately does not ship because it declared one reference illuminant. */
const OTHER_ILLUMINANT_HEXES = ["#93a9c7", "#b0aaa6"];

/* ------------------------------------------------------ the test harness */

const flat = () => 20;
const build = (g = flat) =>
  createPhotoP101(null, { photo: { p101: section }, heightAt: g, surfaceAt: g });

/** Every placement in a subtree, as (x, y, z, scaleY, node). */
function eachPlacement(node, fn) {
  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  node.traverse((o) => {
    if (o.isInstancedMesh) {
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m);
        m.decompose(pos, q, sc);
        fn(pos.x, pos.y, pos.z, sc.y, o, i);
      }
    } else if (o.isMesh) {
      fn(o.position.x, o.position.y, o.position.z, o.scale.y, o, -1);
    }
  });
}

/**
 * The seat this suite says a solid must take: the HIGHEST drawn ground over
 * the solid's own footprint circle, plus the lot's pad rung. Derived here
 * independently of the module, so a builder that quietly went back to a
 * centre sample fails.
 */
function seatMirror(ground, x, z, radius) {
  const n = radius > 0 ? section.draw.footprintSamples : 0;
  let hi = -Infinity;
  for (let i = 0; i <= n; i++) {
    const px = i === 0 ? x : x + Math.cos((2 * Math.PI * (i - 1)) / n) * radius;
    const pz = i === 0 ? z : z + Math.sin((2 * Math.PI * (i - 1)) / n) * radius;
    hi = Math.max(hi, ground(px, pz));
  }
  return hi + overlayLift(section.draw.solidRung);
}

/** Every VERTEX of every baked (non-instanced) mesh, in world coordinates. */
function eachVertex(node, fn) {
  node.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh) return;
    const a = o.geometry.attributes.position;
    for (let i = 0; i < a.count; i++) {
      fn(a.getX(i) + o.position.x, a.getY(i) + o.position.y, a.getZ(i) + o.position.z, o);
    }
  });
}

/**
 * The stall and aisle stations, derived INDEPENDENTLY here from the section's
 * derivations rather than trusted from the module. This is the mirror the
 * built placements are checked against.
 */
function stations() {
  const ST = section.stalls;
  const P = section.plan;
  const stalls = [];
  const aisles = [];
  for (const entry of ST.layout.pairs) {
    const seg = P.segments[entry.segment];
    const n = at(section, entry.count);
    const pad = at(section, entry.pad);
    const van = ST.layout.vanPairOrder.includes(entry.segment);
    for (let i = 0; i < n; i++) {
      const x0 = seg.x0 + pad * (i + 1) + ST.pairModule * i;
      stalls.push({ x0, x1: x0 + ST.width, row: seg.row, accessible: true, van: van && i === 0 });
      stalls.push({ x0: x0 + ST.width + ST.vanAisle, x1: x0 + ST.pairModule, row: seg.row, accessible: true, van: false });
      aisles.push({ x0: x0 + ST.width, x1: x0 + ST.width + ST.vanAisle, row: seg.row });
    }
  }
  const res = ST.layout.reserved;
  const seg = P.segments[res.segment];
  const n = at(section, res.count);
  const pad = at(section, res.pad);
  for (let i = 0; i < n; i++) {
    const x0 = seg.x0 + pad * (i + 1) + ST.width * i;
    stalls.push({ x0, x1: x0 + ST.width, row: seg.row, accessible: false, van: false });
  }
  return { stalls, aisles };
}

/**
 * Stall-band and hatch stations, derived the way the module derives them
 * from the section's own figures — the mirror painted vertices are held to.
 * A 0.125 m stripe-row slide or a 0.5 m hatch-phase slide leaves this
 * table unmoved and must fail the built-vs-derived check below.
 */
function paintStations() {
  const { stalls, aisles } = stations();
  const ST = section.stalls;
  const PT = section.paint;
  const headZ = (row) => (row === "N" ? ST.rowN.z1 : ST.rowS.z0);
  const openZ = (row) => (row === "N" ? ST.rowN.z0 : ST.rowS.z1);
  const bands = stalls.map((s) => {
    const hz = headZ(s.row);
    const oz = openZ(s.row);
    return {
      x0: s.x0, x1: s.x1, row: s.row,
      zLo: Math.min(hz, oz), zHi: Math.max(hz, oz),
      headZ: hz, openZ: oz,
    };
  });
  const c = Math.SQRT1_2;
  const hatches = aisles.map((a) => {
    const hz = headZ(a.row);
    const oz = openZ(a.row);
    const zLo = Math.min(hz, oz);
    const zHi = Math.max(hz, oz);
    const box = [[a.x0, zLo], [a.x1, zLo], [a.x1, zHi], [a.x0, zHi]];
    const proj = (p) => p[0] * c - p[1] * c;
    let pmin = Infinity;
    for (const p of box) pmin = Math.min(pmin, proj(p));
    const ts = [];
    for (let k = 0; k < PT.hatchPerAisle; k++) ts.push(pmin + PT.hatchPitch * (k + 0.5));
    return { x0: a.x0, x1: a.x1, zLo, zHi, ts, row: a.row };
  });
  return { bands, hatches, c };
}

/* ------------------------------------------------- identity and record */

test("the section exists and carries the whole ultra apparatus", () => {
  assert.ok(section, "no p101 section in the merge candidate or the shipped doc");
  for (const k of ["label", "epoch", "note", "confidence", "seed", "bounds", "ring",
    "wiring", "sources", "measured", "colors", "colorSources", "derivations",
    "estimates", "reads", "draw", "plan", "stalls", "paint", "furniture",
    "planting", "legends", "counts", "conflicts", "absent", "supersedes"]) {
    assert.ok(section[k] !== undefined, `section is missing ${k}`);
  }
  assert.equal(typeof section.seed, "number");
  assert.equal(section.ring, "arcgis.ground#71");
  assert.equal(section.measured.ringCitation, "arcgis.ground#71",
    "the section must register its ring as a CITATION STRING, never an index the crop could renumber");
});

test("it says what it is: an all-accessible UCSD lot, blue paint, one illuminant", () => {
  assert.match(section.label, /P101/);
  assert.match(section.label, /accessible/i);
  assert.match(section.note, /INVENTED class/);
  assert.match(section.note, /\[estimated\]/);
  assert.match(section.epoch, /2025-02/, "the newest epoch must be named");
  assert.match(section.epoch, /2020-03/, "the older Street View epoch that retires the re-striping question must be named");
  assert.match(section.epoch, /REGISTRATION ONLY/,
    "the ortho's role must be stated as registration, because §5.2 proves it cannot read this lot's paint");
  assert.match(section.confidence, /HIGH/);
  assert.match(section.confidence, /stallCount|13|16/,
    "the confidence line must acknowledge the count conflict it is confident in spite of");
});

test("every source is described and dated, and the ladder's rungs are all named", () => {
  assert.ok(section.sources.length >= 10, `only ${section.sources.length} sources`);
  for (const s of section.sources) {
    assert.equal(typeof s, "string");
    assert.ok(s.length > 60, `a source line says almost nothing: ${s.slice(0, 60)}`);
  }
  const all = section.sources.join("\n");
  for (const [what, re] of [
    ["the UCSD Concept3D record", /concept3d/i],
    ["the independent Atlas CMS record", /myatlascms|Atlas CMS/i],
    ["the UCSD department page", /physicalsciences\.ucsd\.edu/],
    ["the reference-illuminant pano", /a5PcHyPNwp7xpE-CavOLuw/],
    ["the second 2025-02 pano", /g97OSO0uHL61KLV9hPdP6Q/],
    ["the 2020-03 pano", /7kT9lb0dgFvJUMBfOimhBw/],
    ["the survey ring", /ground\[71\]/],
    ["the OSM verified negative", /Overpass/i],
    ["the ortho chunks", /chunk_4_6\.jpg/],
    ["the LiDAR", /campus-lidar\.json/],
    ["the code", /Chapter 11B/],
  ]) {
    assert.match(all, re, `sources never name ${what}`);
  }
  assert.match(all, /REFERENCE ILLUMINANT/,
    "one frame must be named as the reference illuminant — research-p101 §7 requires it");
});

/* ------------------------------------------- the survey, byte for byte */

test("the ring is the survey, byte for byte, and reproduces its own figures", () => {
  assert.deepEqual(section.measured.ring, SURVEY_RING,
    "the shipped ring is not arcgis.ground[71].r[0] / 10 — a section that redraws its own survey is not measured");
  assert.equal(section.measured.verts, SURVEY_RING.length);
  const R = section.derivations.readings.ring;
  const ded = dedupe(SURVEY_RING, section.draw.dedupeTol);
  assert.equal(ded.length, R.dedupedVerts, "the deduped vertex count is not the survey's");
  near(Math.abs(shoelace(ded)), R.area, 0.05, "the ring's own shoelace area");
  const xs = SURVEY_RING.map((p) => p[0]);
  const zs = SURVEY_RING.map((p) => p[1]);
  near(Math.min(...xs), R.bboxX0, 5e-6, "bbox x0");
  near(Math.max(...xs), R.bboxX1, 5e-6, "bbox x1");
  near(Math.min(...zs), R.bboxZ0, 5e-6, "bbox z0");
  near(Math.max(...zs), R.bboxZ1, 5e-6, "bbox z1");
  for (const k of ["x0", "x1", "z0", "z1"]) {
    const want = { x0: R.bboxX0, x1: R.bboxX1, z0: R.bboxZ0, z1: R.bboxZ1 }[k];
    near(section.bounds[k], want, 5e-6, `bounds.${k} is not the ring's own bbox`);
  }
});

test("every band edge and segment edge is a vertex the survey actually carries", () => {
  const R = section.derivations.readings.ring;
  const ded = dedupe(SURVEY_RING, section.draw.dedupeTol);
  const hasZ = (z) => ded.some((p) => Math.abs(p[1] - z) < 1e-9);
  const hasX = (x) => ded.some((p) => Math.abs(p[0] - x) < 1e-9);
  for (const key of ["aisleNz1", "rowNz1", "walkZ1", "rowSz1", "padZ0", "padZ1"]) {
    assert.ok(hasZ(R[key]), `reading ring.${key} = ${R[key]} is not a z the survey ring carries`);
  }
  for (const key of ["segN1x0", "segN1x1", "segN2x0", "segN2x1", "segN3x0", "segN3x1", "segS2x1", "padX0", "padX1", "bboxX0", "bboxX1"]) {
    assert.ok(hasX(R[key]), `reading ring.${key} = ${R[key]} is not an x the survey ring carries`);
  }
  /* The north kerb and the south edge are RUNS, not single vertices, so they
     are held to the run they name rather than to one point. */
  const north = ded.filter((p) => p[1] < R.kerbN + 0.3 && p[1] > R.kerbN - 0.4 && p[0] > -162);
  assert.ok(north.length >= 6, `only ${north.length} vertices lie on the north kerb run at z ~${R.kerbN}`);
  const south = ded.filter((p) => Math.abs(p[1] - R.southZ1) <= 0.35);
  assert.ok(south.length >= 4, `only ${south.length} vertices lie on the south run at z ~${R.southZ1}`);
});

test("every island polygon is a contiguous run of the survey ring, and its bbox is the survey's", () => {
  const ded = dedupe(SURVEY_RING, section.draw.dedupeTol);
  const R = section.derivations.readings.ring;
  const IS = section.measured.islandSlices;
  assert.deepEqual(IS.islands, ["west", "middle", "east"]);
  assert.deepEqual(IS.polygons, ["west", "middle", "eastNorth", "eastSouth"]);
  const RANGE = {
    west: R.islandWest, middle: R.islandMiddle,
    eastNorth: R.islandEastNorth, eastSouth: R.islandEastSouth, pad: R.padSlice,
  };
  for (const key of [...IS.polygons, "pad"]) {
    assert.deepEqual(IS[key].range, RANGE[key],
      `${key}'s slice in measured.islandSlices disagrees with the reading it derives from`);
    const [i0, i1] = IS[key].range;
    const poly = ded.slice(i0, i1 + 1);
    assert.ok(poly.length >= 4, `${key}'s slice is ${poly.length} vertices — that is not a polygon`);
    const xs = poly.map((p) => p[0]);
    const zs = poly.map((p) => p[1]);
    const bb = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
    for (let i = 0; i < 4; i++) {
      near(bb[i], IS[key].bbox[i], 0.05,
        `${key}'s declared bbox[${i}] is not what its own slice of the survey ring measures`);
    }
    assert.ok(typeof IS[key].closure === "string" && IS[key].closure.length > 20,
      `${key} does not say how its polygon is closed — a closure is either a surveyed edge or it is not`);
  }
  /* Only ONE closure in the whole lot is not a surveyed edge, and it is named
     in absent[10]. If a second one appears, absent has to grow with it. */
  const unsurveyed = [...IS.polygons, "pad"].filter((k) => /NOT SURVEYED/.test(IS[k].closure));
  assert.deepEqual(unsurveyed, ["west"],
    "the set of island closures that are not surveyed edges has changed and absent[10] has not");
  assert.match(section.absent[10], /west island's south \(base\) edge/i);
});

test("the two LiDAR trees are carried verbatim and NEITHER is drawn", () => {
  const R = section.derivations.readings.lidar;
  const rows = section.measured.trees.rows;
  assert.equal(rows.length, 2);
  const findTree = (x, z) => lidar.trees.find((t) => Math.abs(t[0] - x) < 1e-9 && Math.abs(t[1] - z) < 1e-9);
  for (const [row, px, pz, ph, pr] of [
    [rows[0], R.treeEastX, R.treeEastZ, R.treeEastH, R.treeEastR],
    [rows[1], R.treeMidX, R.treeMidZ, R.treeMidH, R.treeMidR],
  ]) {
    const t = findTree(px, pz);
    assert.ok(t, `no campus-lidar.json tree at (${px}, ${pz}) — the reading names a trunk the LiDAR does not carry`);
    near(t[2], ph, 5e-6, "the LiDAR tree's height");
    near(t[3], pr, 5e-6, "the LiDAR tree's crown radius");
    near(row.x, px, 5e-6, "the section's own tree row x");
    near(row.z, pz, 5e-6, "the section's own tree row z");
    assert.equal(row.key, `${t[0]},${t[1]}`,
      "the tree key must be the trunk key campus-world.js's skipKeys uses, exactly");
  }
  assert.equal(section.measured.trees.built, false);
  assert.equal(section.counts.trees, 0);
  assert.equal(section.treeOverrides, undefined,
    "this section draws no tree, so it must NOT declare skipMeasuredKeys — campus-world.js has to keep drawing both stems");
  assert.match(section.wiring, /NO tree wiring/i);
  /* And the 2.6 m canopy-maximum finding is preserved even though nothing
     acts on it. */
  const off = Math.abs(R.treeMidX - section.derivations.readings.ring.segN2x0);
  near(off, 2.6, 5e-6, "the middle island's canopy maximum is not 2.6 m off the island's east edge");
  assert.ok(section.conflicts.some((c) => /treeTrunkOffset/.test(c) && /2\.6 m/.test(c)),
    "conflicts must carry the canopy-maximum finding the build did not apply");
});

/* -------------------------------------------------------- the axiom layer */

test("S1(i): no number anywhere in the axiom layer is uncovered", () => {
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
      plan: {}, stalls: {}, paint: {}, furniture: {}, planting: {},
      "derivations.readings": {}, estimates: {}, draw: {},
    },
    classify,
    uncovered: {
      "stalls.layout.reserved.runEndX": "The x at which the reserved space's run stops is the utility pad's own west edge, derivations.readings.ring.padX0 = -131.5. It is repeated here as a layout literal so the module can read the run without a second lookup, and the equality is asserted by name in the layout test rather than by the coverage walk, which cannot express 'equals a reading'.",
      "plan.segments.N1.x0": "The segment table repeats the surveyed x reads so the module can iterate it. Every one of these twelve is asserted EQUAL to its own reading and to its own frontage figure in the segment-table test; the coverage walk cannot express that relation, so it is exempted here and gated harder there.",
      "plan.segments.N1.x1": "The middle island's west extreme, repeated from derivations.readings.ring.segN1x1; gated against that reading and against N1's own frontage figure in the segment-table test.",
      "plan.segments.N2.x0": "The middle island's east edge, repeated from derivations.readings.ring.segN2x0 so the module can iterate the segment table; gated against that reading and against N2's own frontage figure in the segment-table test.",
      "plan.segments.N2.x1": "The east island's north lobe west edge, repeated from derivations.readings.ring.segN2x1; gated against that reading and against N2's own frontage figure in the segment-table test.",
      "plan.segments.N3.x0": "The east island's east edge, repeated from derivations.readings.ring.segN3x0; gated against that reading and against N3's own frontage figure in the segment-table test.",
      "plan.segments.N3.x1": "The lot's east edge at the walk, repeated from derivations.readings.ring.segN3x1; gated against that reading and against N3's own frontage figure in the segment-table test.",
      "plan.segments.S1.x0": "The west island's base, repeated from derivations.readings.ring.segN1x0; gated against that reading and against S1's own frontage figure in the segment-table test.",
      "plan.segments.S1.x1": "The middle island's west extreme, repeated from derivations.readings.ring.segN1x1; gated against that reading and against S1's own frontage figure in the segment-table test.",
      "plan.segments.S2.x0": "The middle island's east edge, repeated from derivations.readings.ring.segN2x0; gated against that reading and against S2's own frontage figure in the segment-table test.",
      "plan.segments.S2.x1": "The east island's SOUTH lobe west edge, repeated from derivations.readings.ring.segS2x1; gated against that reading and against S2's own frontage figure in the segment-table test.",
      "plan.segments.S3.x0": "The east island's east edge, repeated from derivations.readings.ring.segN3x0; gated against that reading and against S3's own frontage figure in the segment-table test.",
      "plan.segments.S3.x1": "The lot's east edge at the walk, repeated from derivations.readings.ring.segN3x1; gated against that reading and against S3's own frontage figure in the segment-table test.",
    },
    minimum: 150,
    label: "p101",
  });
  assert.ok(paths.filter((p) => p.path.startsWith("draw.")).length >= 30,
    "the draw block is what this extension exists for and it did not get walked");
  assert.ok(paths.filter((p) => p.path.startsWith("derivations.readings.")).length >= 50,
    "the reading layer did not get walked");

  for (const [p, e] of Object.entries(est)) {
    if (p === "why") continue;
    assert.match(e.why, /\[estimated\]/, `${p} must carry the [estimated] label`);
    assert.ok(e.extends && e.extends.length > 25, `${p} must record which sourced pattern it extends`);
    near(at(section, p), e.value, 5e-6, `${p} ships a value its estimate does not state`);
  }
  for (const [p, rd] of Object.entries(reads)) {
    if (p === "why") continue;
    assert.ok(rd.source && rd.source.length > 40, `${p} must name the frame, survey or clause it is read off`);
    assert.equal(typeof rd.tolerance, "number", `${p} must carry the tolerance its source supports`);
    near(at(section, p), rd.value, 5e-6, `${p} ships a value its read does not state`);
  }
  /* One number, one provenance. */
  for (const p of Object.keys(est)) {
    if (p === "why") continue;
    assert.ok(!derived.has(p) && !reads[p], `${p} claims two provenances`);
  }
  for (const p of Object.keys(reads)) {
    if (p === "why") continue;
    assert.ok(!derived.has(p), `${p} claims two provenances`);
  }
});

test("S1(ii): every estimate carries a machine-readable band and ships inside it", () => {
  const n = assertEstimateBands({
    estimates: section.estimates,
    valueAt: (key) => at(section, key),
    skip: ["why"],
    label: "p101",
  });
  assert.equal(n, 43, "every estimate is banded and the count is declared here");
  /* Stall width is the estimate this whole section turns on. Its band is the
     CODE'S OWN two permitted widths, so a value outside 9-11 ft cannot be
     parked in it. */
  assert.deepEqual(section.estimates["stalls.width"].band, [2.7432, 3.3528]);
  for (const bad of [2.4384, 3.6576]) {
    assert.throws(
      () => assertEstimateBands({
        estimates: { "stalls.width": { ...section.estimates["stalls.width"], value: bad } },
        valueAt: () => bad,
        label: "p101",
      }),
      /outside its own published band/,
      `stalls.width can still reach ${bad} m`,
    );
  }
  /* The planter split is the section's other load-bearing estimate and its
     band is the PHOTOGRAPH'S own 2.0-2.5 m read. */
  assert.deepEqual(section.estimates["plan.bands.planter.depth"].band,
    [section.derivations.readings.sv.hedgeDepthMin, section.derivations.readings.sv.hedgeDepthMax],
    "the planter estimate's band must be the Street View read it cites, not a band of its own");
  /* And a band must never be a place to park a value the section does not ship. */
  assert.throws(
    () => assertEstimateBands({
      estimates: section.estimates,
      valueAt: (k) => (k === "furniture.pole.height" ? 7.9 : at(section, k)),
      skip: ["why"], label: "p101",
    }),
    /ships 7\.9 but states 8\.25/,
  );
});

test("S1(iii): every reading with an external truth is pinned to that truth", () => {
  const R = section.derivations.readings;
  assert.equal(
    assertPins({
      readings: R,
      pins: READING_PINS,
      namespaces: ["units", "ring", "ucsd", "code", "sv", "lidar"],
      label: "p101",
    }),
    Object.keys(READING_PINS).length,
  );
  assert.equal(
    assertPins({ readings: section.draw, pins: DRAW_PINS, namespaces: ["tiles", "glyph"], label: "p101 draw" }),
    Object.keys(DRAW_PINS).length,
  );
  /* The mutations this pin block exists to catch. */
  assert.throws(() => assertPins({
    readings: { ...R, ucsd: { ...R.ucsd, total: 16 } }, pins: READING_PINS, label: "p101",
  }), /ucsd\.total/, "the count of record could be quietly raised to the frontage's 16");
  assert.throws(() => assertPins({
    readings: { ...R, code: { ...R.code, vanAisleFt: 5 } }, pins: READING_PINS, label: "p101",
  }), /code\.vanAisleFt/, "the van aisle could go 8 ft -> 5 ft and every module figure re-derive around it");
  assert.throws(() => assertPins({
    readings: { ...R, ring: { ...R.ring, rowNz1: 265.1 } }, pins: READING_PINS, label: "p101",
  }), /ring\.rowNz1/, "a band edge could be moved a metre and the stall depth re-derive consistently");
  assert.throws(() => assertPins({
    readings: { ...section.draw, paintStack: 0.02 }, pins: DRAW_PINS, label: "p101 draw",
  }), /paintStack/, "a decal separation could be moved by a factor of ten");
  /* A new reading may not appear inside a pinned block unpinned. */
  assert.throws(() => assertPins({
    readings: { ...R, code: { ...R.code, curbRampSlopeRatio: 12 } }, pins: READING_PINS,
    namespaces: ["code"], label: "p101",
  }), /is not pinned/);

  /* Every relation the section states in PROSE about its own readings. */
  const ded = dedupe(SURVEY_RING, section.draw.dedupeTol);
  assertRelations({
    label: "p101",
    relations: [
      { name: "the foot is twelve inches", got: R.units.foot, want: 12 * R.units.inch },
      { name: "ucsd: reserved + accessible is the total of record", got: R.ucsd.reserved + R.ucsd.accessible, want: R.ucsd.total },
      { name: "§3.1: Row N and Row S are the SAME measured depth, which is what makes stall depth measured",
        got: (R.ring.rowNz1 - R.ring.aisleNz1) - (R.ring.rowSz1 - R.ring.walkZ1), want: 0 },
      { name: "§0.4: the 5.5 m band is 18 ft to 14 mm",
        got: (R.ring.rowNz1 - R.ring.aisleNz1) - R.code.stallDepthFt * R.units.foot, want: 0, tol: 0.015 },
      { name: "§3.2: the east island's two lobes plus the walk are the middle island's depth to 0.4 m — conflicts.middleIslandDepth",
        got: (R.ring.rowSz1 - R.ring.aisleNz1) - 12.6, want: 0.4, tol: 0.05 },
      { name: "conflicts.southEdge: the ring's south edge lies INSIDE the NatSci mass",
        got: Math.sign(R.ring.southZ1 - R.sv.natsciNorthFaceZ), want: 1 },
      { name: "§5.3: the 9 ft stall is permitted only where the aisle is at least 8 ft, so the shipped pair is 9 + 8 + 9",
        got: R.code.carStallFt * R.units.foot * 2 + R.code.vanAisleFt * R.units.foot,
        want: section.stalls.pairModule },
      { name: "the ring reading's own vertex count is the survey's", got: R.ring.verts, want: SURVEY_RING.length },
      { name: "the ring reading's own deduped count is the survey's", got: R.ring.dedupedVerts, want: ded.length },
      { name: "the ring reading's own area is the survey's", got: R.ring.area, want: Math.abs(shoelace(ded)), tol: 0.05 },
      { name: "§0.6: the hedge band the photograph reads brackets the [estimated] planter split",
        got: Math.sign((section.plan.bands.planter.depth - R.sv.hedgeDepthMin) * (R.sv.hedgeDepthMax - section.plan.bands.planter.depth)),
        want: 1 },
    ],
  });
});

test("S1(iv): the tier gate runs BOTH ways over colours and estimates", () => {
  const entries = [
    ...Object.entries(section.colorSources)
      .filter(([k]) => k !== "why")
      .map(([key, text]) => ({ key: `colorSources.${key}`, text })),
    ...Object.entries(section.estimates)
      .filter(([k]) => k !== "why")
      .map(([key, e]) => ({ key: `estimates.${key}`, text: e.why })),
  ];
  assertTierSymmetry({ entries, label: "p101" });
  /* Exactly five colours may claim [sourced], and they are the five rows of
     research-p101 §7 that come from the ONE reference illuminant. */
  const sourced = Object.entries(section.colorSources)
    .filter(([k, v]) => k !== "why" && /^\[sourced\]/.test(v))
    .map(([k]) => k)
    .sort();
  assert.deepEqual(sourced, Object.keys(SOURCED_HEXES).sort(),
    "the set of colours claiming [sourced] is not the set the reference illuminant actually measured");
  /* A promotion must fail: an [estimated] line relabelled [sourced] because
     it cites the parent it extends. */
  assert.throws(() => assertTierSymmetry({
    entries: [{ key: "colorSources.signBlue", text: section.colorSources.signBlue.replace("[estimated]", "[sourced]") }],
    label: "p101",
  }), /hedges/);
});

test("S1(v): every absent entry is held by a stable key and a probe", () => {
  const entries = section.absent.map((e) => ({ key: absentKey(e), what: e }));
  assert.equal(
    assertAbsentEntries({ absent: entries, expected: ABSENT, label: "p101" }),
    entries.length,
  );
  for (const [i, e] of section.absent.entries()) {
    const [keyRe, probe] = ABSENT_PROBES[i];
    assert.match(e, keyRe, `absent[${i}] has lost its stable key`);
    assert.match(e, probe, `absent[${i}] no longer says what it withholds`);
    assert.ok(e.length > 90, `absent[${i}] is a stub, not a withholding: ${e.slice(0, 60)}`);
  }
  /* The dossier's §9 list is ten entries; this section carries all ten plus
     two it found while building. The list does not shrink. */
  assert.ok(section.absent.length >= 12,
    `absent went to ${section.absent.length} — this list does not shrink below the dossier's ten plus the two the build added`);
  assert.match(section.absent[10], /9\.62/, "absent[10] must state the size of the unsurveyed closure it withholds");
  assert.match(section.absent[11], /R99C/, "absent[11] must name the standard the sign plate was taken from");
});

test("S1(vi): every expr is arithmetic, is EVALUATED, and reproduces its own value", () => {
  const scope = { r: section.derivations.readings, s: section };
  const { evaluated } = assertExprs({
    figures: section.derivations.figures, scope, label: "p101",
  });
  assert.ok(evaluated >= 65, `only ${evaluated} exprs evaluated — figures have gone to prose`);
  /* Every figure carries an evaluable expr; none may hide behind prose. */
  for (const [k, f] of Object.entries(section.derivations.figures)) {
    assert.ok(typeof f.expr === "string" && f.expr.length > 0,
      `figure ${k} has no expr — a derivation nobody runs is decoration`);
    assert.ok(f.derivation && f.derivation.length > 20, `figure ${k} states no prose derivation`);
  }
  /* And an expr that no longer reproduces its own value must fail. */
  assert.throws(() => assertExprs({
    figures: { bad: { value: 99, expr: "s.stalls.pairs", derivation: "a deliberately wrong figure" } },
    scope, label: "p101",
  }), /does not reproduce its own value/);
});

/* ---------------------------------------------- the figures, as shipped */

test("every drawn figure ships exactly where its own derivation puts it", () => {
  for (const [path, f] of Object.entries(section.derivations.figures)) {
    if (path.startsWith("counts.")) continue;
    const got = at(section, path);
    assert.equal(typeof got, "number", `figure ${path} derives a value the section never ships`);
    near(got, f.value, f.exprTol ?? 5e-6, `${path} ships a value its own derivation does not state`);
  }
});

test("the segment table is the survey, and each pair reproduces its own frontage", () => {
  const R = section.derivations.readings.ring;
  const S = section.plan.segments;
  assert.deepEqual(S.order, ["N1", "N2", "N3", "S1", "S2", "S3"]);
  const EXPECT = {
    N1: [R.segN1x0, R.segN1x1, "N"], N2: [R.segN2x0, R.segN2x1, "N"], N3: [R.segN3x0, R.segN3x1, "N"],
    S1: [R.segN1x0, R.segN1x1, "S"], S2: [R.segN2x0, R.segS2x1, "S"], S3: [R.segN3x0, R.segN3x1, "S"],
  };
  for (const key of S.order) {
    const [x0, x1, row] = EXPECT[key];
    near(S[key].x0, x0, 5e-6, `segment ${key}.x0 is not the surveyed read it claims`);
    near(S[key].x1, x1, 5e-6, `segment ${key}.x1 is not the surveyed read it claims`);
    assert.equal(S[key].row, row, `segment ${key} is in the wrong row`);
    near(S[key].x1 - S[key].x0, S[key].frontage, 5e-6,
      `segment ${key}'s own x pair does not reproduce its own frontage figure`);
  }
  near(section.stalls.layout.reserved.runEndX, R.padX0, 5e-6,
    "the reserved space's run stops at a value that is not the utility pad's surveyed west edge");
  /* The dossier's 71.2 m, recomputed from the table rather than trusted. */
  const total = S.order.reduce((a, k) => a + S[k].frontage, 0) - section.plan.pad.width;
  near(total, section.plan.totalFrontage, 5e-6, "the six segments do not sum to the shipped striped frontage");
  near(total, 71.2, 5e-6, "the striped frontage is no longer research-p101 §3.4's 71.2 m");
});

test("the counts subtract: thirteen stalls, six pairs, one reserved, and the frontage would take sixteen", () => {
  const ST = section.stalls;
  const R = section.derivations.readings;
  assert.equal(ST.total, R.ucsd.total);
  assert.equal(2 * ST.pairs + ST.reserved, ST.total);
  assert.equal(ST.pairs, R.ucsd.accessible / 2);
  assert.equal(ST.distribution.sum, ST.pairs,
    "the [estimated] per-segment distribution does not sum to the derived pair count — a stall has been invented or lost");
  assert.equal(section.counts.stalls, ST.total);
  assert.equal(section.counts.accessibleStalls, R.ucsd.accessible);
  assert.equal(section.counts.reservedStalls, R.ucsd.reserved);
  assert.equal(section.counts.isaStencils, R.ucsd.accessible,
    "the reserved space is not an accessible space and must not carry an ISA");
  /* THE CONFLICT, ASSERTED. The measured frontage really does admit sixteen,
     and the section really does build thirteen. If either side of that stops
     being true the conflict entry is stale and must be rewritten. */
  const admits = section.plan.segments.order
    .reduce((a, k) => a + Math.floor(section.plan.segments[k].frontage / ST.pairModule), 0) * 2;
  assert.equal(admits, 16, "the measured frontage no longer admits the sixteen stalls conflicts.stallCount is about");
  assert.ok(ST.total < admits, "the section is striping every stall the frontage would take");
  /* Every derived count recomputes. */
  for (const [path, f] of Object.entries(section.derivations.figures)) {
    if (!path.startsWith("counts.")) continue;
    assert.equal(at(section, path), f.value, `${path} ships a count its own derivation does not state`);
  }
});

/* ------------------------------------------------------------- colours */

test("colours are data, hex, the reference illuminant's, and every role carries a tier", () => {
  const roles = Object.keys(section.colors);
  assert.ok(roles.length >= 15, `only ${roles.length} colour roles`);
  for (const [role, hex] of Object.entries(section.colors)) {
    assert.match(hex, /^#[0-9a-f]{6}$/, `colour ${role} is not a lower-case six-digit hex: ${hex}`);
    assert.ok(section.colorSources[role], `colour ${role} carries no provenance line`);
    assert.ok(section.colorSources[role].length > 80, `colour ${role}'s provenance says almost nothing`);
  }
  for (const role of Object.keys(section.colorSources)) {
    if (role === "why") continue;
    assert.ok(section.colors[role], `colorSources describes ${role}, which is not a colour this section ships`);
  }
  /* THE FIVE SOURCED HEXES ARE THE DOSSIER'S OWN STATED RESULTS. A line that
     says "= #xxxxxx" must ship exactly that hex. */
  for (const [role, hex] of Object.entries(SOURCED_HEXES)) {
    assert.equal(section.colors[role], hex,
      `${role} ships ${section.colors[role]} where its own source line states ${hex}`);
    const line = section.colorSources[role];
    assert.match(line, new RegExp(`= ${hex}`),
      `${role}'s provenance must state its result as "= ${hex}", so the hex and the citation cannot drift apart`);
    assert.match(line, /rect \(\d+, \d+, \d+, \d+\)/,
      `${role} claims [sourced] and pins no sample rect — a median with no rect is not reproducible`);
    assert.match(line, /a5PcHyPNwp7xpE-CavOLuw/,
      `${role} claims [sourced] off a frame that is not this section's declared reference illuminant`);
  }
  /* The OTHER pano's two medians are deliberately not shipped. */
  const allHex = Object.values(section.colors).join(" ");
  for (const hex of OTHER_ILLUMINANT_HEXES) {
    assert.ok(!allHex.includes(hex),
      `${hex} is a median off the SUNLIT pano; shipping it mixes two illuminants, which research-p101 §7 forbids`);
  }
  /* F2 / surgery: value-pin every role whose provenance STATES a result hex
     or names a parent role. Sourced lines already pin via `= #xxxxxx` above;
     [estimated] lines state the result as `[estimated] #xxxxxx` and must
     ship that exact value — an estimated hex may not drift while its
     provenance stands still. A line that names a parent role must ship
     the parent's hex. */
  let pinned = 0;
  for (const [role, line] of Object.entries(section.colorSources)) {
    if (role === "why") continue;
    const stated = /=\s*(#[0-9a-f]{6})\b/.exec(line)
      || /^\[estimated\]\s*(#[0-9a-f]{6})\b/.exec(line);
    if (stated) {
      assert.equal(section.colors[role], stated[1],
        `${role} ships ${section.colors[role]} where its own source line states ${stated[1]}`);
      pinned++;
    }
    const parent = /colors\.(\w+)/.exec(line)
      || /the same value as (\w+)/.exec(line)
      || /extending the (\w+) estimate/.exec(line);
    if (parent && section.colors[parent[1]]) {
      assert.equal(section.colors[role], section.colors[parent[1]],
        `${role} ships ${section.colors[role]} but names parent ${parent[1]} = ${section.colors[parent[1]]}`);
    }
  }
  assert.ok(pinned >= 17,
    `only ${pinned} colour roles have a stated result hex — sourced + estimated must both pin`);
});

test("nothing in this section rests on the unresolved ortho-as-colour-source ruling", () => {
  assert.match(section.colorSources.why, /ortho/i);
  assert.match(section.colorSources.why, /NOT used|not used/,
    "the colour block must say in as many words that the ortho-derived tone is not used");
  for (const [role, line] of Object.entries(section.colorSources)) {
    if (role === "why") continue;
    assert.ok(!/chunk_\d_\d\.jpg|ortho pixel|orthophoto pixel/i.test(line),
      `colour ${role} is sampled off orthophoto pixels, which is the ruling Sahir has not made`);
  }
  const flagged = section.conflicts.find((c) => /orthoColourRuling/.test(c));
  assert.ok(flagged, "the ortho-as-colour-source ruling must be carried as a declared conflict");
  assert.match(flagged, /NOT sampled|not sampled/);
});

/* -------------------------------------------------- conflicts and record */

test("conflicts are declared and never averaged", () => {
  assert.ok(section.conflicts.length >= 10, `only ${section.conflicts.length} conflicts`);
  for (const key of ["stallCount", "southEdge", "middleIslandDepth", "minimumFine",
    "illuminant", "orthoColourRuling", "treeDoubleDraw", "treeTrunkOffset",
    "osmAbstains", "worldOverdraw", "slopeUnmeasurable"]) {
    const c = section.conflicts.find((x) => x.includes(`conflicts.${key}`));
    assert.ok(c, `conflicts is missing ${key}`);
    assert.ok(c.length > 150, `conflicts.${key} is a headline, not a declaration`);
  }
  const stall = section.conflicts.find((c) => /stallCount/.test(c));
  assert.match(stall, /13/);
  assert.match(stall, /16/);
  assert.match(stall, /NOTHING RESOLVES IT|does not silently stripe/,
    "the count conflict must say it is unresolved, not pick a side");
});

test("the legends are recorded and rendered nowhere", () => {
  assert.equal(section.legends.built, false);
  assert.equal(section.counts.legends, 0);
  assert.match(section.legends.note, /no text mechanism/i);
  const texts = section.legends.items.map((i) => i.text);
  for (const t of ["NO PARKING", "PARKING ONLY", "MINIMUM FINE $450", "VAN ACCESSIBLE", "NO PARKING FIRE LANE"]) {
    assert.ok(texts.includes(t), `the legend "${t}" is not recorded`);
  }
  for (const item of section.legends.items) {
    assert.ok(item.source && item.source.length > 20, `legend "${item.text}" names no source`);
    assert.ok(item.where && item.where.length > 15, `legend "${item.text}" does not say where it is`);
  }
  const fine = section.legends.items.find((i) => /450/.test(i.text));
  assert.match(fine.source, /\$250/, "the $450/$250 conflict must be recorded on the legend that carries it");
});

test("every declared zero says why it is zero", () => {
  const zeroes = Object.entries(section.counts).filter(([k, v]) => v === 0 && typeof v === "number");
  assert.ok(zeroes.length >= 8, `only ${zeroes.length} declared zeroes`);
  for (const [k] of zeroes) {
    const why = section.counts.zeroesWhy[k];
    assert.ok(why && why.length > 60, `counts.${k} is zero and says nothing about why`);
  }
  assert.match(section.counts.zeroesWhy.payStations, /ParkMobile|§6\.7/,
    "the pay-station absence must cite the source that makes it deliberate");
  assert.match(section.counts.zeroesWhy.trees, /campus-world/,
    "the tree zero must name the renderer that is already drawing them");
});

test("supersedes records the CHECK, and claims nothing", () => {
  assert.deepEqual(section.supersedes.claims, [],
    "P101 is a new entity; if it starts superseding something, the claim needs its own reciprocal record");
  assert.ok(section.supersedes.checked.length >= 3);
  for (const c of section.supersedes.checked) assert.ok(c.length > 60, `a supersedes check says almost nothing: ${c}`);
  /* And the check is re-run here, so it cannot rot: no other shipped section
     may claim any of this lot. */
  for (const [key, other] of Object.entries(shippedDoc)) {
    if (key === "p101" || !other || typeof other !== "object" || !other.bounds) continue;
    const b = other.bounds;
    if (typeof b.x0 !== "number") continue;
    const overlaps = !(b.x1 < section.bounds.x0 || b.x0 > section.bounds.x1
      || b.z1 < section.bounds.z0 || b.z0 > section.bounds.z1);
    if (overlaps) {
      /* ARBITRATED 2026-08-22 (R5 merge): section bounds are OUTER ENVELOPES
         of drawn reach, not land claims — pacific's south facade (survey ring
         to z 244.2) and natsci's roof oversail both graze #71's bbox (z0
         243.8) while their drawn ground stays out of the lot. An overlap is
         licensed ONLY by the sibling's own explicit disclaimer naming this
         lot or its ring; a silent overlap still fails exactly as before. */
      const prose = JSON.stringify(other);
      assert.ok(/Lot P101|arcgis\.ground#71|ground#71/.test(prose),
        `section ${key} overlaps P101's bounds and never mentions the lot — supersedes has to grow or one of the two has to shrink`);
      assert.ok(/"owner":\s*"p101"|claims nothing beyond|NOT TAKEN|notMine/i.test(prose),
        `section ${key} names the lot but does not disclaim it — the overlap is a live claim`);
    }
  }
  /* ARBITRATED 2026-08-22 (R5 merge): the original form banned the STRING
     "arcgis.ground#71" anywhere in the doc — but the overlap clause above
     (and the batch critic) REQUIRE neighbouring sections to disclaim the lot
     by name, so a mention-ban and a disclaimer-requirement cannot coexist.
     The check now bans what the string ban was standing in for: another
     section structurally REGISTERING ring 71 (or the lot's islands) as its
     own. Prose disclaimers stay licensed; ownership stays exclusive. */
  const LOT_RINGS = new Set([71, 347, 2156, 2157, 1772]);
  for (const [key, other] of Object.entries(shippedDoc)) {
    if (key === "p101" || !other || typeof other !== "object") continue;
    const rings = other.ground?.rings;
    if (!Array.isArray(rings)) continue;
    for (const r of rings) {
      assert.ok(!LOT_RINGS.has(r?.index),
        `section ${key} has registered arcgis.ground#${r?.index} — the lot's ground is P101's alone`);
    }
  }
});

/* ---------------------------------------------------- the module contract */

test("the module carries no dimension and no colour of its own", () => {
  const src = moduleSrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.equal(src.match(/#[0-9a-fA-F]{6}|0x[0-9a-fA-F]{6}/), null,
    "the builder carries a hex literal — every colour comes from section.colors");
  const allowed = new Map([
    ["0.5", "a half: a box centre, a bar's half-length, a stripe's half-pitch"],
  ]);
  for (const n of new Set(src.match(/\b\d+\.\d+\b/g) || [])) {
    assert.ok(allowed.has(n),
      `${n} is a bare number in the builder — move it into the section's derivations, estimates, reads or draw block`);
  }
  /* Bare integers are loop bounds, indices and decal stack levels only. */
  for (const n of new Set(src.match(/(?<![\w.])\d+(?![\w.])/g) || [])) {
    assert.ok(Number(n) <= 4,
      `${n} is a bare integer in the builder — a dimension in disguise is still a dimension`);
  }
  for (const key of ["islandSlices", "pairModule", "hatchPerAisle", "isaField",
    "wheelStop", "fireLaneKerb", "glyph", "dedupeTol"]) {
    assert.ok(src.includes(key), `the builder never reads section.${key}`);
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
  assert.equal(moduleSrc.match(/lift\s*[:=]\s*0\.\d/), null,
    "the module defines a lift of its own — campus-overlay.js owns every rung");
  assert.equal(moduleSrc.match(/polygonOffset(?:Factor|Units)\s*[:=]/), null,
    "the module sets polygon offset itself instead of going through applyOverlayDepth");
  const keys = [...moduleSrc.matchAll(/photo\?\.(\w+)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(keys)], ["p101"], "the module reads a key that is not its own");
});

test("a missing or pre-merge section builds NOTHING and names what it waits for", () => {
  const empty = createPhotoP101(null, { photo: {}, surfaceAt: flat });
  assert.equal(empty.group.children.length, 0);
  assert.deepEqual(empty.counts, {});

  for (const key of ["measured", "plan", "stalls", "paint", "furniture", "planting", "draw", "counts"]) {
    const half = JSON.parse(JSON.stringify(section));
    delete half[key];
    const r = createPhotoP101(null, { photo: { p101: half }, surfaceAt: flat });
    assert.equal(r.group.children.length, 0, `a section without ${key} still drew something`);
    assert.match(r.counts.pendingMerge, new RegExp(key),
      `a section without ${key} does not say so`);
  }
  const noSlices = JSON.parse(JSON.stringify(section));
  delete noSlices.measured.islandSlices;
  assert.match(
    createPhotoP101(null, { photo: { p101: noSlices }, surfaceAt: flat }).counts.pendingMerge,
    /measured\.islandSlices/);
  const noLayout = JSON.parse(JSON.stringify(section));
  delete noLayout.stalls.layout;
  assert.match(
    createPhotoP101(null, { photo: { p101: noLayout }, surfaceAt: flat }).counts.pendingMerge,
    /stalls\.layout/);

  assert.throws(() => createPhotoP101(null, { photo: { p101: section } }),
    /needs surfaceAt/, "a builder with no ground sampler must refuse rather than place at zero");
  const noColour = JSON.parse(JSON.stringify(section));
  delete noColour.colors.paintBlue;
  assert.throws(() => createPhotoP101(null, { photo: { p101: noColour }, surfaceAt: flat }),
    /no colour declared for role "paintBlue"/,
    "an undeclared role must throw, not become opaque white in campus-materials.js");
});

/* ---------------------------------------------------------- the build */

test("the module builds every system, and the counts are the declared ones", () => {
  const { counts } = build();
  for (const [k, v] of Object.entries(section.counts)) {
    if (k === "note" || k === "zeroesWhy") continue;
    assert.equal(counts[k], v, `the module built ${counts[k]} ${k} where the section declares ${v}`);
  }
  for (const k of Object.keys(counts)) {
    assert.ok(section.counts[k] !== undefined, `the module counts ${k}, which the section never declares`);
  }
});

test("the group is added to a scene when there is one", () => {
  const added = [];
  const r = createPhotoP101({ add: (g) => added.push(g) }, { photo: { p101: section }, surfaceAt: flat });
  assert.deepEqual(added, [r.group]);
});

test("the built stalls, wheel stops and signs land on the DERIVED stations", () => {
  const { group } = build();
  const { stalls } = stations();
  assert.equal(stalls.length, section.stalls.total);
  const ST = section.stalls;
  const FU = section.furniture;
  const P = section.plan;

  /* Every stall the mirror derives is inside its own segment's frontage. */
  for (const s of stalls) {
    const seg = Object.values(P.segments).find((v) => v && v.x0 !== undefined
      && s.x0 >= v.x0 - 1e-9 && s.x1 <= v.x1 + 1e-9 && v.row === s.row);
    assert.ok(seg, `a derived stall at x ${s.x0.toFixed(3)}..${s.x1.toFixed(3)} (row ${s.row}) is in no segment`);
    near(s.x1 - s.x0, ST.width, 5e-6, "a derived stall is not the shipped stall width");
  }

  const wantWheel = stalls.map((s) => [(s.x0 + s.x1) / 2, s.row === "N" ? FU.wheelStop.rowNz : FU.wheelStop.rowSz])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const gotWheel = [];
  const wantPost = stalls.map((s) => [(s.x0 + s.x1) / 2,
    s.row === "N" ? ST.rowN.z1 + FU.sign.postSize / 2 : ST.rowS.z0 - FU.sign.postSize / 2])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const gotPost = [];
  eachPlacement(group, (x, y, z, sy, o) => {
    if (o.name === "p101-wheelstop-sourced") gotWheel.push([x, z]);
    if (o.name === "p101-sign-post-estimated") gotPost.push([x, z]);
  });
  gotWheel.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  gotPost.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  assert.equal(gotWheel.length, wantWheel.length);
  assert.equal(gotPost.length, wantPost.length);
  for (let i = 0; i < wantWheel.length; i++) {
    near(gotWheel[i][0], wantWheel[i][0], 2e-4, `wheel stop ${i} x`);
    near(gotWheel[i][1], wantWheel[i][1], 2e-4, `wheel stop ${i} z`);
    near(gotPost[i][0], wantPost[i][0], 2e-4, `sign post ${i} x`);
    near(gotPost[i][1], wantPost[i][1], 2e-4, `sign post ${i} z`);
  }
  /* The wheel stops sit BETWEEN the stall head and the walk, on both rows,
     which is the whole reason §6.2 gives for their being there. */
  near(FU.wheelStop.rowNz, ST.rowN.z1 - FU.wheelStop.setback, 5e-6, "the Row N wheel-stop line");
  near(FU.wheelStop.rowSz, ST.rowS.z0 + FU.wheelStop.setback, 5e-6, "the Row S wheel-stop line");
  assert.ok(FU.wheelStop.rowNz < ST.rowN.z1 && FU.wheelStop.rowNz > ST.rowN.z0,
    "the Row N wheel stops are not inside Row N");
  assert.ok(FU.wheelStop.rowSz > ST.rowS.z0 && FU.wheelStop.rowSz < ST.rowS.z1,
    "the Row S wheel stops are not inside Row S");
  /* Both rows' signs stand on ONE line along the walk, which is why the walk
     is where they go. */
  const zs = [...new Set(gotPost.map((p) => Number(p[1].toFixed(4))))].sort((a, b) => a - b);
  assert.equal(zs.length, 2, `sign posts stand on ${zs.length} lines, not two`);
  assert.ok(zs[0] > ST.rowN.z1 - 1e-6 && zs[1] < ST.rowS.z0 + 1e-6,
    "a sign post stands off the central walk");
  near(zs[1] - zs[0], P.bands.walk.depth - FU.sign.postSize, 1e-4,
    "the two sign lines are not the walk's own measured width apart");
});

test("the built stripe rows and hatch paint land on the DERIVED stations", () => {
  const { group } = build();
  const { bands, hatches, c } = paintStations();
  const PT = section.paint;
  const lw = PT.lineWidth;
  /* 0.05 m is tighter than the survey's own 0.3 m head wobble and catches
     the 0.125 m stripe-row slide the containment gate lets through; hatch
     vertices sit up to hatchWidth/2 off the phase station by construction. */
  const STATION = 0.05;

  const blue = [];
  eachVertex(group, (x, y, z, o) => {
    if (o.name === "p101-paint-blue-sourced") blue.push([x, z]);
  });
  assert.ok(blue.length > 200, `only ${blue.length} blue paint vertices`);
  assert.equal(bands.length, section.stalls.total);
  assert.equal(hatches.length, section.stalls.pairs);

  /* STRIPE ROWS. A flank vertex sits on a derived stall x-station; its z
     must stay inside the derived [openZ, headZ] band, and every band must
     actually be painted at both edges. */
  const flankTol = lw / 2 + 1e-3;
  let flanks = 0;
  for (const [x, z] of blue) {
    const band = bands.find((b) =>
      (Math.abs(x - b.x0) <= flankTol || Math.abs(x - b.x1) <= flankTol)
      && z >= b.zLo - 0.5 && z <= b.zHi + 0.5);
    if (!band) continue;
    flanks++;
    const off = Math.max(0, band.zLo - z, z - band.zHi);
    assert.ok(off <= STATION,
      `stripe-row paint at (${x.toFixed(3)}, ${z.toFixed(3)}) stands ${off.toFixed(3)} m ` +
      `off the derived band ${band.zLo}..${band.zHi} (tolerance ${STATION})`);
  }
  assert.ok(flanks > 50, `only ${flanks} flank vertices classified`);
  for (const b of bands) {
    const atLo = blue.some(([x, z]) =>
      (Math.abs(x - b.x0) <= flankTol || Math.abs(x - b.x1) <= flankTol)
      && Math.abs(z - b.zLo) <= STATION);
    const atHi = blue.some(([x, z]) =>
      (Math.abs(x - b.x0) <= flankTol || Math.abs(x - b.x1) <= flankTol)
      && Math.abs(z - b.zHi) <= STATION);
    assert.ok(atLo,
      `no stripe-row paint lands on derived station z=${b.zLo} of a ${b.row} stall at x ${b.x0.toFixed(3)}..${b.x1.toFixed(3)}`);
    assert.ok(atHi,
      `no stripe-row paint lands on derived station z=${b.zHi} of a ${b.row} stall at x ${b.x0.toFixed(3)}..${b.x1.toFixed(3)}`);
  }

  /* HATCH. A clipped stripe's vertices sit on the aisle BOX, not in its
     interior, so the classifier keeps the open and side edges and drops
     the head edge (that is the aisle's own head line). Every kept vertex
     must lie on a derived hatch-phase station, and every station must
     be painted. */
  const hatchTol = PT.hatchWidth / 2 + STATION;
  const onBox = 2e-3;
  let hatched = 0;
  for (const [x, z] of blue) {
    const h = hatches.find((a) =>
      x >= a.x0 - onBox && x <= a.x1 + onBox
      && z >= a.zLo - onBox && z <= a.zHi + onBox);
    if (!h) continue;
    const hz = h.row === "N" ? h.zHi : h.zLo;
    if (Math.abs(z - hz) <= lw + STATION) continue;
    /* A stall flank is a lw-wide rect centred on the stall x-station, so
       its inner half sits inside the aisle. Those corners are stripe-row
       paint, not hatch — drop anything offset from a stall x by ~lw/2.
       Hatch-on-the-aisle-edge sits ON the station (x = aisle.x0 / x1). */
    const onFlank = bands.some((b) => {
      const d = Math.min(Math.abs(x - b.x0), Math.abs(x - b.x1));
      return d > onBox && d <= lw / 2 + onBox;
    });
    if (onFlank) continue;
    const onAisleX = Math.abs(x - h.x0) <= onBox || Math.abs(x - h.x1) <= onBox;
    const oz = h.row === "N" ? h.zLo : h.zHi;
    const onOpen = Math.abs(z - oz) <= onBox;
    if (!onAisleX && !onOpen) continue;
    hatched++;
    const t = x * c - z * c;
    const dist = Math.min(...h.ts.map((tk) => Math.abs(t - tk)));
    assert.ok(dist <= hatchTol,
      `hatch paint at (${x.toFixed(3)}, ${z.toFixed(3)}) stands ${dist.toFixed(3)} m ` +
      `off every derived hatch station (tolerance ${hatchTol})`);
  }
  assert.ok(hatched > 50, `only ${hatched} hatch vertices classified`);
  for (const h of hatches) {
    for (const tk of h.ts) {
      const hit = blue.some(([x, z]) => {
        if (x < h.x0 - 1e-6 || x > h.x1 + 1e-6 || z < h.zLo - 1e-6 || z > h.zHi + 1e-6) return false;
        return Math.abs(x * c - z * c - tk) <= hatchTol;
      });
      assert.ok(hit, `no hatch paint lands on derived station t=${tk.toFixed(3)} in row ${h.row}`);
    }
  }
});

test("nothing built escapes the lot — every vertex and every instance is inside the survey bbox", () => {
  const { group } = build();
  const B = section.bounds;
  const tol = 1e-6;
  let checked = 0;
  eachVertex(group, (x, y, z, o) => {
    assert.ok(x >= B.x0 - tol && x <= B.x1 + tol && z >= B.z0 - tol && z <= B.z1 + tol,
      `${o.name} has a vertex at (${x.toFixed(2)}, ${z.toFixed(2)}), outside the survey's own bbox`);
    checked++;
  });
  eachPlacement(group, (x, y, z, sy, o) => {
    if (o.isInstancedMesh || o.geometry?.boundingBox === undefined) {
      assert.ok(x >= B.x0 - tol && x <= B.x1 + tol && z >= B.z0 - tol && z <= B.z1 + tol,
        `${o.name} places an instance at (${x.toFixed(2)}, ${z.toFixed(2)}), outside the survey's own bbox`);
      checked++;
    }
  });
  assert.ok(checked > 2000, `only ${checked} placements checked — the walk did not run`);
});

test("all the paint is inside the paved ring, within the survey's own head wobble", () => {
  const { group } = build();
  const ring = dedupe(SURVEY_RING, section.draw.dedupeTol);
  const wobble = section.derivations.readings.ring.headWobble;
  /* The survey's head runs are not straight: Row N's reads 264.1-264.3 and
     Row S's reads 266.0-266.3, and the section's band edges are single values
     off those runs. So a stall band drawn to the MEASURED edge can overhang
     the ring by up to that wobble at the far end of a run. That is the
     survey's own drafting noise, not paint escaping the lot, and the gate is
     the wobble the survey itself carries — recomputed here, never widened. */
  const heads = ring.filter((p) => (p[1] > 264.0 && p[1] < 264.4) || (p[1] > 265.9 && p[1] < 266.4));
  const spanN = heads.filter((p) => p[1] < 265);
  const spanS = heads.filter((p) => p[1] > 265);
  near(Math.max(...spanN.map((p) => p[1])) - Math.min(...spanN.map((p) => p[1])), 0.2, 1e-9,
    "Row N's head run no longer wobbles what the reading says it does");
  near(Math.max(...spanS.map((p) => p[1])) - Math.min(...spanS.map((p) => p[1])), wobble, 1e-9,
    "Row S's head run no longer wobbles what ring.headWobble says it does");

  let painted = 0;
  let worst = 0;
  let where = null;
  eachVertex(group, (x, y, z, o) => {
    if (!/^p101-paint-/.test(o.name)) return;
    painted++;
    if (inRing(x, z, ring)) return;
    const d = ringDist(x, z, ring);
    if (d > worst) { worst = d; where = [x, z, o.name]; }
  });
  assert.ok(painted > 500, `only ${painted} painted vertices checked`);
  assert.ok(worst <= wobble,
    `paint stands ${worst.toFixed(3)} m outside the ring at ${where} — past the survey's own ${wobble} m head wobble, so it is not drafting noise`);
  /* And the overhang is where it should be: on a head edge, never on a flank,
     an island or the verge. */
  if (where) {
    assert.ok(Math.abs(where[1] - section.stalls.rowS.z0) < wobble || Math.abs(where[1] - section.stalls.rowN.z1) < wobble,
      `the worst paint overhang is at z ${where[1].toFixed(2)}, which is not a head edge`);
  }
});

test("nothing invented sits inside a measured building footprint", () => {
  const rings = campus.buildings.filter((b) => b.p && b.p.length >= 3);
  const { group } = build();
  eachPlacement(group, (x, y, z, sy, o) => {
    if (!o.isInstancedMesh && !/solid|kerb|pole|cabinet|hydrant|manhole|hedge|sign|wheelstop/.test(o.name)) return;
    for (const b of rings) {
      assert.ok(!inRing(x, z, b.p),
        `${o.name} at (${x.toFixed(1)}, ${z.toFixed(1)}) is inside ${b.n || "an unnamed mass"}`);
    }
  });
});

test("nothing hovers and nothing sinks — flat, an exaggerated slope, and the DRAWN LiDAR surface", () => {
  const sloped = (x, z) => 20 + 1.2 * Math.sin(x / 14) + 0.9 * Math.cos(z / 17);
  const padLift = overlayLift(section.draw.surfaceRung);
  const paintLift = overlayLift(section.draw.paintRung);
  const carpetLift = overlayLift(section.draw.walkRung);
  const stackTop = section.draw.paintStack * 4;
  const tallest = section.furniture.pole.height + section.furniture.pole.headDepth;
  /* Baked positions are Float32BufferAttribute, so the comparison tolerance
     is the FORMAT'S, not the geometry's: at y ~20-28 m a float32 resolves to
     about 2e-6 m. Anything above that is a real hover or a real sink. */
  const F32 = 3e-5;

  for (const [label, ground] of [["flat", flat], ["slope", sloped], ["drawn", drawnGround]]) {
    const { group, counts } = build(ground);
    group.updateMatrixWorld(true);
    assert.equal(counts.stalls, section.counts.stalls, `${label}: the build changed with the ground`);

    let checked = 0;
    eachVertex(group, (x, y, z, o) => {
      const g = ground(x, z);
      assert.ok(Number.isFinite(g), `${label}: no drawn surface under ${o.name} at (${x}, ${z})`);
      /* NOTHING SINKS: no vertex may fall below the drawn surface at its own
         (x, z). The pad rung is the floor of this whole section. */
      assert.ok(y >= g + padLift - F32,
        `${label}: ${o.name} sinks to ${(y - g).toFixed(4)} m over the drawn surface at (${x.toFixed(1)}, ${z.toFixed(1)}) — below the pad rung at ${padLift}`);
      /* NOTHING HOVERS: the tallest thing in this lot is the light pole, and
         no draped or painted surface may float above its own rung. */
      if (/^p101-paint-/.test(o.name)) {
        assert.ok(y <= g + paintLift + stackTop + F32,
          `${label}: ${o.name} floats ${(y - g).toFixed(4)} m over the drawn surface — above its own paint rung`);
      }
      if (o.name === "p101-asphalt-sourced" || o.name === "p101-planter-mulch-estimated") {
        near(y, g + padLift, 1e-4, `${label}: ${o.name} is off the pad rung`);
      }
      if (o.name === "p101-walk-estimated") {
        near(y, g + carpetLift + section.plan.walk.thickness, 1e-4,
          `${label}: the central walk is off its own declared stand above the carpet rung`);
      }
      /* The light pole's arm and head reach 1.2 m out from the shaft, so the
         ground under their far end is not the ground they stand on. Every
         pole part is measured against the POLE'S OWN SEAT, which is what
         carries it; everything else against the surface beneath it. */
      const anchor = /^p101-pole-/.test(o.name)
        ? seatMirror(ground, section.furniture.pole.x, section.furniture.pole.z, section.furniture.pole.baseRadius)
        : g + padLift;
      assert.ok(y <= anchor + tallest + F32,
        `${label}: ${o.name} reaches ${(y - anchor).toFixed(2)} m over what carries it, above the light pole that is this lot's tallest object`);
      checked++;
    });

    eachPlacement(group, (x, y, z, sy, o) => {
      if (!o.isInstancedMesh) return;
      const g = ground(x, z);
      o.geometry.computeBoundingBox();
      const bottom = y + o.geometry.boundingBox.min.y * sy;
      const top = y + o.geometry.boundingBox.max.y * sy;
      /* A sign FACE and its VAN plate are carried by the post, not by the
         ground: they are gated against the post they hang on, and the post
         itself against the walk it stands on. Everything else seats on the
         lot's own pad datum. */
      const carried = /p101-sign-(face|vanplate)-estimated/.test(o.name);
      const onWalk = o.name === "p101-sign-post-estimated" || carried;
      const FOOT = {
        "p101-wheelstop-sourced": Math.hypot(section.furniture.wheelStop.length, section.furniture.wheelStop.width) / 2,
        "p101-sign-post-estimated": Math.hypot(section.furniture.sign.postSize, section.furniture.sign.postSize) / 2,
        "p101-sign-face-estimated": Math.hypot(section.furniture.sign.postSize, section.furniture.sign.postSize) / 2,
        "p101-sign-vanplate-estimated": Math.hypot(section.furniture.sign.postSize, section.furniture.sign.postSize) / 2,
        "p101-natsci-hedge-sourced": section.planting.hedge.radius,
      };
      assert.ok(FOOT[o.name] !== undefined, `${label}: ${o.name} is an instanced solid this gate does not know how to seat`);
      const datum = seatMirror(ground, x, z, FOOT[o.name])
        + (onWalk ? section.plan.walk.thickness : 0);
      if (carried) {
        assert.ok(bottom >= datum - F32,
          `${label}: ${o.name} at (${x.toFixed(1)}, ${z.toFixed(1)}) hangs below the walk its post stands on`);
        assert.ok(top <= datum + section.furniture.sign.topHeight + F32,
          `${label}: ${o.name} at (${x.toFixed(1)}, ${z.toFixed(1)}) rides above the top of its own post`);
      } else {
        near(bottom, datum, 0.02,
          `${label}: ${o.name} at (${x.toFixed(1)}, ${z.toFixed(1)}) does not seat on the lot's own datum`);
      }
      assert.ok(top <= g + tallest + 1e-3,
        `${label}: ${o.name} tops out at ${(top - g).toFixed(2)} m over the drawn surface`);
      checked++;
    });
    assert.ok(checked > 2000, `${label}: only ${checked} placements checked — the loops did not run`);
  }
});

test("the ladder is climbed in order: asphalt pad, walk carpet, paint on top", () => {
  const { group } = build();
  const D = section.draw;
  assert.ok(OVERLAY[D.surfaceRung].renderOrder < OVERLAY[D.walkRung].renderOrder);
  assert.ok(OVERLAY[D.walkRung].renderOrder < OVERLAY[D.paintRung].renderOrder);
  const seen = new Map();
  group.traverse((o) => { if (o.isMesh && !o.isInstancedMesh) seen.set(o.name, o); });
  const EXPECT = {
    "p101-asphalt-sourced": D.surfaceRung,
    "p101-planter-mulch-estimated": D.mulchRung,
    "p101-walk-estimated": D.walkRung,
    "p101-utility-pad-measured": D.walkRung,
    "p101-island-groundcover-estimated": D.plantingRung,
    "p101-paint-blue-sourced": D.paintRung,
  };
  for (const [name, rung] of Object.entries(EXPECT)) {
    const m = seen.get(name);
    assert.ok(m, `the build produced no ${name}`);
    assert.equal(m.renderOrder, OVERLAY[rung].renderOrder, `${name} is not on the ${rung} rung`);
    assert.equal(m.material.depthWrite, false, `${name} is a decal and must not write depth`);
    assert.equal(m.material.depthTest, true, `${name} must still test depth against terrain and buildings`);
    assert.equal(m.material.polygonOffsetFactor, OVERLAY[rung].polygonOffsetFactor);
  }
  /* Solids are NOT in the decal stack. */
  for (const name of ["p101-kerb-face-sourced", "p101-walk-edge-estimated"]) {
    const m = seen.get(name);
    assert.ok(m, `the build produced no ${name}`);
    assert.notEqual(m.material.depthWrite, false, `${name} is a solid and must write depth`);
  }
});

test("the ISA stencil's three paint layers have strictly ascending renderOrder", () => {
  /* V1: campus-overlay.js sets depthWrite:false on the paint rung, so the
     2 mm paintStack lift cannot order overlapping ISA sub-layers. A future
     regression that puts outline/field/glyph back on one renderOrder is the
     blank-white-square defect and must go red. */
  const { group, counts } = build();
  assert.equal(counts.isaStencils, 12, "the build lost an ISA stencil");
  const seen = new Map();
  group.traverse((o) => { if (o.isMesh) seen.set(o.name, o); });
  const names = [
    "p101-paint-isa-outline-estimated",
    "p101-paint-isa-field-sourced",
    "p101-paint-isa-glyph-estimated",
  ];
  const paint = OVERLAY[section.draw.paintRung];
  const layers = names.map((name) => {
    const m = seen.get(name);
    assert.ok(m, `the build produced no ${name}`);
    assert.equal(m.material.depthWrite, false, `${name} is a paint decal and must not write depth`);
    assert.equal(m.material.depthTest, true, `${name} must still test depth against terrain`);
    assert.equal(m.material.polygonOffsetFactor, paint.polygonOffsetFactor,
      `${name} left the paint rung's depth state`);
    return m;
  });
  const [outline, field, glyph] = layers;
  assert.ok(outline.renderOrder < field.renderOrder,
    `ISA outline renderOrder ${outline.renderOrder} is not below the blue field ${field.renderOrder} — equal orders are the white-square defect`);
  assert.ok(field.renderOrder < glyph.renderOrder,
    `ISA field renderOrder ${field.renderOrder} is not below the glyph ${glyph.renderOrder}`);
  assert.ok(outline.renderOrder >= paint.renderOrder,
    `ISA outline renderOrder ${outline.renderOrder} fell below the paint rung`);
});

test("the material library is on every surface, and the maps are code-generated", () => {
  assert.match(moduleSrc, /sharedMaterialLibrary/, "surfaces come from campus-materials.js");
  const { group } = build();
  let textured = 0;
  let total = 0;
  group.traverse((o) => {
    if (!o.isMesh && !o.isInstancedMesh) return;
    total++;
    if (o.material.map) textured++;
    assert.ok(o.material.color, `${o.name} has no colour at all`);
  });
  assert.ok(total >= 20, `only ${total} meshes`);
  assert.ok(textured >= total - 1, `${total - textured} meshes carry no generated map`);
});

test("two builds are byte-identical — no hidden randomness", () => {
  const a = build();
  const b = build();
  assert.deepEqual(a.counts, b.counts);
  const sig = (r) => {
    const out = [];
    r.group.traverse((o) => {
      if (o.isInstancedMesh) out.push(o.name, Array.from(o.instanceMatrix.array).slice(0, o.count * 16));
      else if (o.isMesh) out.push(o.name, Array.from(o.geometry.attributes.position.array));
    });
    return out;
  };
  assert.deepEqual(sig(a), sig(b));
  /* And identical on the real terrain too, where the sampler is doing work. */
  const c = build(drawnGround);
  const d = build(drawnGround);
  assert.deepEqual(sig(c), sig(d));
});
