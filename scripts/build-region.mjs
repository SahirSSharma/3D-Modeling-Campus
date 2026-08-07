#!/usr/bin/env node
// Build docs/data/region.json — the scope boundary of the world.
//
// WHY THIS EXISTS. Every builder in this repo has, until now, hard-coded the
// same campus box: 32.8655,-117.2540 to 32.8905,-117.2215. That box was chosen
// because it is what a student walks. The world is being widened to the
// coastal strip around it — Torrey Pines down to the Village of La Jolla,
// I-805 on the east — and a widened world with the old box copied into six
// scripts is a world that will silently disagree with itself the first time
// one of them is edited. So the boundary becomes a FILE, and the scripts read
// it.
//
// WHERE THE POLYGON COMES FROM. Sahir drew it by hand on a Google Maps
// screenshot (2026-08-06). That is an honest provenance and it is recorded
// honestly: the pixel trace below is the actual outline he drew, and the two
// control points that georeference it are landmarks visible in the same
// screenshot with independently known coordinates.
//
// The fit was checked against a THIRD landmark not used to build it — the
// I-5/I-805 merge, which the screenshot puts at (770,430) and which really
// sits at 32.8925,-117.2135. The fit places it within ~200 m. That is the
// accuracy of this boundary, and it is enough: this polygon decides WHICH
// SQUARE KILOMETRES GET BUILT. It is not geometry anyone ever sees. Every
// surface inside it is measured from LiDAR and GIS to the usual standard.
//
// Usage:
//   node scripts/build-region.mjs           # write
//   node scripts/build-region.mjs --check   # verify the shipped file
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CAMPUS = path.join(REPO_ROOT, "docs/data/campus-3d.json");
const OUT = path.join(REPO_ROOT, "docs/data/region.json");
const CHECK = process.argv.includes("--check");

/* ------------------------------------------------------- georeferencing */

/* Two landmarks in the screenshot whose real coordinates are known
   independently of it. UCSD is the map pin Google draws for the university;
   La Jolla Cove is the labelled pin at the bottom-left. */
const CONTROL = [
  { px: 567, py: 578, lat: 32.8801, lng: -117.2340, what: "UC San Diego pin" },
  { px: 155, py: 970, lat: 32.8508, lng: -117.2713, what: "La Jolla Cove pin" },
];

/* An independent third point, used ONLY to measure the error of the fit above.
   If this check ever fails, the trace was misread and the boundary is wrong. */
const CHECKPOINT = { px: 770, py: 430, lat: 32.8925, lng: -117.2135, what: "I-5 / I-805 merge" };

/* Google's web map is Mercator, and over 8 km at this latitude the projection
   is linear to well under the accuracy of a hand-drawn line, so a two-point
   affine fit is the right amount of machinery. */
function fitFromControl() {
  const [a, b] = CONTROL;
  const degPerPxLng = (a.lng - b.lng) / (a.px - b.px);
  const degPerPxLat = (a.lat - b.lat) / (b.py - a.py); // y grows southward
  return {
    degPerPxLng,
    degPerPxLat,
    toLngLat: (px, py) => [
      a.lng + (px - a.px) * degPerPxLng,
      a.lat - (py - a.py) * degPerPxLat,
    ],
  };
}

/* THE OUTLINE, as drawn. Pixel coordinates traced off the screenshot,
   clockwise from the north-west corner where the line meets the coast.
   The line follows real features for most of its length — the shoreline on
   the west, I-805 on the east — but it is a freehand line and is stored as
   one, not dressed up as a survey. */
const TRACE_PX = [
  [325, 182], [430, 176], [520, 178], [600, 190], [665, 250], [700, 330],
  [760, 400], [800, 442], [822, 520], [880, 600], [930, 680], [965, 742],
  [975, 790], [940, 850], [890, 900], [830, 930], [700, 960], [580, 975],
  [430, 978], [380, 990], [300, 1012], [200, 1040], [160, 1057], [120, 1032],
  [128, 985], [140, 940], [200, 900], [268, 838], [312, 742], [330, 640],
  [332, 520], [326, 400], [320, 280],
];

/* ------------------------------------------------------------ tiers */

/* The campus box every existing builder already uses. Inside it, nothing
   changes: the 3 m terrain grid, the surveyed ArcGIS ground, the hand-checked
   building heights and the Eighth College dossier all stand exactly as they
   are. The region is built AROUND this, at a coarser sampling, because a
   canyon 4 km away does not need the sampling a courtyard does. */
const CORE = { south: 32.8655, north: 32.8905, west: -117.2540, east: -117.2215 };

/* Terrain sampling per tier, in metres. 3 m is what the campus has and what
   the walk is verified against. 6 m over the region is a deliberate trade: it
   is ~4x cheaper in every dimension and it still resolves the Torrey Pines
   cliff, Rose Canyon and the freeway embankments, which are the only landforms
   out there anyone will look at. */
const CELL = { core: 3, region: 6 };

function ringArea(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return Math.abs(a) / 2;
}

function build() {
  const fit = fitFromControl();

  /* Verify the fit before trusting anything built on it. */
  const [clng, clat] = fit.toLngLat(CHECKPOINT.px, CHECKPOINT.py);
  const errM = Math.hypot(
    (clng - CHECKPOINT.lng) * 93489.7,
    (clat - CHECKPOINT.lat) * 110574
  );
  if (errM > 400) {
    throw new Error(
      `georeference fit is off by ${errM.toFixed(0)} m at ${CHECKPOINT.what} — the trace is wrong`
    );
  }

  const { origin: O } = JSON.parse(readFileSync(CAMPUS, "utf8"));
  const toLocal = ([lng, lat]) => [
    Math.round((lng - O.lng) * O.mPerDegLng * 10) / 10,
    Math.round((O.lat - lat) * O.mPerDegLat * 10) / 10,
  ];

  const lnglat = TRACE_PX.map(([px, py]) => fit.toLngLat(px, py))
    .map(([lng, lat]) => [Math.round(lng * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5]);
  const local = lnglat.map(toLocal);

  const lats = lnglat.map(([, lat]) => lat);
  const lngs = lnglat.map(([lng]) => lng);
  const bbox = {
    south: Math.min(...lats), north: Math.max(...lats),
    west: Math.min(...lngs), east: Math.max(...lngs),
  };

  const spanX = (bbox.east - bbox.west) * O.mPerDegLng;
  const spanZ = (bbox.north - bbox.south) * O.mPerDegLat;

  return {
    _: "Generated by scripts/build-region.mjs. Do not hand-edit.",
    provenance: {
      drawn: "2026-08-06, freehand on a Google Maps screenshot",
      control: CONTROL.map((c) => c.what),
      checkpoint: { what: CHECKPOINT.what, errorM: Math.round(errM) },
      note:
        "Scope boundary only — it decides which square kilometres get built. " +
        "Everything inside is measured from LiDAR and GIS as usual.",
    },
    origin: O,
    core: { ...CORE, cell: CELL.core },
    region: {
      bbox,
      cell: CELL.region,
      spanM: { x: Math.round(spanX), z: Math.round(spanZ) },
      bboxAreaKm2: Math.round((spanX * spanZ) / 1e4) / 100,
      polygonAreaKm2: Math.round(ringArea(local) / 1e4) / 100,
    },
    polygon: { lnglat, local },
  };
}

const built = build();

if (CHECK) {
  const shipped = JSON.parse(readFileSync(OUT, "utf8"));
  const a = JSON.stringify(shipped.polygon);
  const b = JSON.stringify(built.polygon);
  if (a !== b) {
    console.error("FAIL: docs/data/region.json polygon does not match the trace");
    process.exit(1);
  }
  console.log(
    `region.json OK — ${built.polygon.local.length} vertices, ` +
      `${built.region.polygonAreaKm2} km2, fit error ` +
      `${built.provenance.checkpoint.errorM} m`
  );
} else {
  writeFileSync(OUT, `${JSON.stringify(built, null, 1)}\n`);
  console.log(
    `wrote ${path.relative(REPO_ROOT, OUT)} — ` +
      `${built.polygon.local.length} vertices, ` +
      `${built.region.polygonAreaKm2} km2 inside the outline ` +
      `(${built.region.bboxAreaKm2} km2 bbox), ` +
      `${built.region.spanM.x} x ${built.region.spanM.z} m, ` +
      `fit error ${built.provenance.checkpoint.errorM} m at ${CHECKPOINT.what}`
  );
}
