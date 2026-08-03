#!/usr/bin/env node
/*
 * audit-accuracy.mjs — R2 accuracy audit: cross-reference the shipped data
 * (OSM footprints + 2014 USGS LiDAR) against current-epoch Google sources.
 *
 * READ-ONLY on shipped files. Writes ONLY scripts/reports/accuracy-<date>.json.
 * The Google Maps key is read from .env at run time and NEVER written anywhere.
 *
 * Checks:
 *   1. TERRAIN  — ~250-point grid over the LiDAR terrain sheet vs Google
 *                 Elevation API (batched, 3 requests).
 *   2. NAMES    — every uniquely named OSM building footprint vs Places Text
 *                 Search (New): displayName + location (<120 m).
 *   3. EPOCH    — footprints whose LiDAR height is missing/near-zero (post-2014
 *                 construction or no coverage); top candidates cross-checked
 *                 via Street View metadata (pano existence + date).
 *   4. HEIGHTS  — regression check of the 6 README-table buildings against the
 *                 shipped campus-lidar.json.
 *   5. STREETVIEW — metadata-only sweep along the walk route every ~50 m.
 *
 * Usage: node scripts/audit-accuracy.mjs [--out scripts/reports/accuracy-YYYY-MM-DD.json]
 * Budget guard: aborts if total requests would exceed 400.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildGraph, routeThrough } from "../docs/js/campus-route.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT =
  process.argv.includes("--out")
    ? path.resolve(ROOT, process.argv[process.argv.indexOf("--out") + 1])
    : path.join(ROOT, "scripts", "reports", "accuracy-2026-08-03.json");

/* ---------------------------------------------------------------- key + data */

function readKey() {
  const env = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
  const m = env.match(/^GOOGLE_MAPS_API_KEY=(.+)$/m);
  if (!m) throw new Error("GOOGLE_MAPS_API_KEY not found in .env");
  return m[1].trim();
}

const KEY = readKey();
const campus = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/data/campus-3d.json"), "utf8"));
const lidar = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/data/campus-lidar.json"), "utf8"));

const { lat: LAT0, lng: LNG0, mPerDegLat: MLAT, mPerDegLng: MLNG } = campus.origin;
const toLatLng = (x, z) => [LAT0 - z / MLAT, LNG0 + x / MLNG];

const T = lidar.terrain;
const DATUM = lidar.datum; // metres absolute; terrain.z = integer decimetres rel. to it

/* Bilinear ground sample, same maths as campus-world.js createTerrain(). */
function lidarGroundAbs(x, z) {
  const fx = (x - T.x0) / T.cell;
  const fz = (z - T.z0) / T.cell;
  const c = Math.floor(fx);
  const r = Math.floor(fz);
  if (c < 0 || c >= T.cols - 1 || r < 0 || r >= T.rows - 1) return null;
  const u = fx - c;
  const v = fz - r;
  const g = (rr, cc) => T.z[rr * T.cols + cc] / 10;
  const y =
    g(r, c) * (1 - u) * (1 - v) +
    g(r, c + 1) * u * (1 - v) +
    g(r + 1, c) * (1 - u) * v +
    g(r + 1, c + 1) * u * v;
  return DATUM + y;
}

const centroid = (ring) => {
  let sx = 0, sz = 0;
  for (const [x, z] of ring) { sx += x; sz += z; }
  return [sx / ring.length, sz / ring.length];
};

const ringArea = (ring) => {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, z1] = ring[i];
    const [x2, z2] = ring[(i + 1) % ring.length];
    a += x1 * z2 - x2 * z1;
  }
  return Math.abs(a) / 2;
};

function pointInRing(x, z, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/* Is (x,z) inside or within `pad` metres of any building's bbox+footprint? */
function nearBuilding(x, z, pad = 6) {
  for (const b of campus.buildings) {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [px, pz] of b.p) {
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (pz < minZ) minZ = pz;
      if (pz > maxZ) maxZ = pz;
    }
    if (x < minX - pad || x > maxX + pad || z < minZ - pad || z > maxZ + pad) continue;
    if (pointInRing(x, z, b.p)) return b.n || "(unnamed)";
    // within pad of bbox and not inside: close enough to be smoothed by it
    return (b.n || "(unnamed)") + " (adjacent)";
  }
  return null;
}

/* ------------------------------------------------------------- request budget */

const BUDGET = 400;
const requestCounts = { elevation: 0, placesTextSearch: 0, streetViewMetadata: 0 };
const totalRequests = () => Object.values(requestCounts).reduce((a, b) => a + b, 0);

function spend(api, n = 1) {
  if (totalRequests() + n > BUDGET) throw new Error(`request budget ${BUDGET} exceeded at ${api}`);
  requestCounts[api] += n;
}

async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url.replace(KEY, "REDACTED")}`);
  return r.json();
}

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

/* ------------------------------------------------------------------ 1 TERRAIN */

async function auditTerrain() {
  // ~250 interior points (16 x 16), one cell in from every edge so the
  // bilinear sample is always valid.
  const N = 16;
  const xMin = T.x0 + T.cell;
  const xMax = T.x0 + (T.cols - 2) * T.cell;
  const zMin = T.z0 + T.cell;
  const zMax = T.z0 + (T.rows - 2) * T.cell;
  const pts = [];
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const x = xMin + ((xMax - xMin) * i) / (N - 1);
      const z = zMin + ((zMax - zMin) * j) / (N - 1);
      const ref = lidarGroundAbs(x, z);
      if (ref == null) continue;
      const [lat, lng] = toLatLng(x, z);
      pts.push({ x: +x.toFixed(1), z: +z.toFixed(1), lat: +lat.toFixed(6), lng: +lng.toFixed(6), lidar: +ref.toFixed(2) });
    }
  }

  for (let i = 0; i < pts.length; i += 100) {
    const batch = pts.slice(i, i + 100);
    const locs = batch.map((p) => `${p.lat},${p.lng}`).join("|");
    spend("elevation");
    const j = await getJson(`https://maps.googleapis.com/maps/api/elevation/json?locations=${locs}&key=${KEY}`);
    if (j.status !== "OK") throw new Error(`Elevation API: ${j.status}`);
    j.results.forEach((r, k) => {
      batch[k].google = +r.elevation.toFixed(2);
      batch[k].resolution = +r.resolution.toFixed(1);
    });
  }

  for (const p of pts) p.diff = +(p.google - p.lidar).toFixed(2);
  const mean = pts.reduce((a, p) => a + p.diff, 0) / pts.length;
  const rms = Math.sqrt(pts.reduce((a, p) => a + p.diff * p.diff, 0) / pts.length);
  for (const p of pts) p.residual = +(p.diff - mean).toFixed(2);
  const rmsDetrended = Math.sqrt(pts.reduce((a, p) => a + p.residual * p.residual, 0) / pts.length);

  const worst = [...pts]
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    .slice(0, 10)
    .map((p) => {
      const nb = nearBuilding(p.x, p.z);
      let cls;
      if (Math.abs(p.residual) <= 1.2)
        cls = Math.abs(mean) > 0.5 ? "datum-shift + resolution noise" : "resolution noise (sources agree)";
      else if (nb) cls = "surface obstruction near building (Elevation smooths structures; likely not real ground change)";
      else if (Math.abs(p.residual) > 3) cls = "possible real change since 2014 (verify against imagery)";
      else cls = "resolution noise (~" + p.resolution + " m posting)";
      return { ...p, nearBuilding: nb, classification: cls };
    });

  return {
    samples: pts.length,
    rms: +rms.toFixed(2),
    mean: +mean.toFixed(2),
    rmsAfterMeanRemoval: +rmsDetrended.toFixed(2),
    elevationResolutionM: pts[0]?.resolution ?? null,
    datumNote:
      Math.abs(mean) > 0.5
        ? `mean offset (Google EGM96 minus LiDAR-derived, site datum ${DATUM} m) is a vertical-datum/geoid ` +
          `difference, not an error in either source; residuals after removing it are the real disagreement`
        : `mean offset is negligible (${mean.toFixed(2)} m) — Google Elevation and the site's 2014 LiDAR ` +
          `(datum ${DATUM} m) share the same vertical reference here; no datum correction needed`,
    worst,
  };
}

/* -------------------------------------------------------------------- 2 NAMES */

const normName = (s) =>
  s
    .toLowerCase()
    .replace(/[&]/g, "and")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(hall|building|center|centre|the|ucsd|uc|san|diego)\b/g, " ")
    .split(/\s+/)
    .filter(Boolean);

function nameSimilarity(a, b) {
  const ta = new Set(normName(a));
  const tb = new Set(normName(b));
  if (!ta.size || !tb.size) {
    // names made only of generic words (e.g. "Center Hall") — compare raw
    const ra = a.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const rb = b.toLowerCase().replace(/[^a-z0-9]+/g, "");
    return ra.includes(rb) || rb.includes(ra) ? 1 : 0;
  }
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / Math.min(ta.size, tb.size);
}

async function auditNames() {
  // one query per unique building name (multi-part buildings share a name)
  const byName = new Map();
  for (const b of campus.buildings) {
    if (!b.n) continue;
    if (!byName.has(b.n)) byName.set(b.n, []);
    byName.get(b.n).push(b);
  }

  const checkedNames = [...byName.keys()].sort();
  const mismatches = [];
  let matched = 0;

  for (const name of checkedNames) {
    const rings = byName.get(name);
    // centroid of the largest footprint carrying the name
    const main = rings.reduce((a, b) => (ringArea(b.p) > ringArea(a.p) ? b : a));
    const [cx, cz] = centroid(main.p);
    const [lat, lng] = toLatLng(cx, cz);

    spend("placesTextSearch");
    const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": KEY,
        "X-Goog-FieldMask": "places.displayName,places.location,places.types",
      },
      body: JSON.stringify({
        textQuery: `${name}, UC San Diego`,
        locationBias: { circle: { center: { latitude: 32.8785, longitude: -117.2405 }, radius: 3000 } },
        maxResultCount: 1,
        languageCode: "en",
      }),
    });
    const j = await r.json();
    const place = j.places?.[0];

    if (!place) {
      mismatches.push({ osmName: name, reason: "no-result", osmLatLng: [+lat.toFixed(6), +lng.toFixed(6)] });
      await sleep(40);
      continue;
    }

    const gLat = place.location.latitude;
    const gLng = place.location.longitude;
    const distM = Math.round(
      Math.hypot((gLat - lat) * MLAT, (gLng - lng) * MLNG),
    );
    const gName = place.displayName?.text ?? "";
    const sim = nameSimilarity(name, gName);
    const locOk = distM < 120;
    const nameOk = sim >= 0.5;

    if (locOk && nameOk) {
      matched++;
    } else {
      mismatches.push({
        osmName: name,
        placesName: gName,
        distanceM: distM,
        nameSimilarity: +sim.toFixed(2),
        reason: !locOk && !nameOk ? "location+name" : !locOk ? "location>120m" : "name-mismatch",
        osmLatLng: [+lat.toFixed(6), +lng.toFixed(6)],
        placesLatLng: [+gLat.toFixed(6), +gLng.toFixed(6)],
      });
    }
    await sleep(40);
  }

  return { checked: checkedNames.length, matched, mismatches };
}

/* --------------------------------------------------------------- 3 EPOCH GAPS */

async function auditEpochGaps() {
  const gridXMax = T.x0 + (T.cols - 1) * T.cell;
  const gridZMax = T.z0 + (T.rows - 1) * T.cell;
  const insideGrid = (x, z) => x >= T.x0 && x <= gridXMax && z >= T.z0 && z <= gridZMax;

  const seen = new Set();
  const gaps = [];
  for (const b of campus.buildings) {
    if (!b.n || seen.has(b.n)) continue;
    seen.add(b.n);
    const h = lidar.heights[b.n];
    if (h != null && h >= 3) continue; // has a real measured height
    const [cx, cz] = centroid(b.p);
    const inGrid = insideGrid(cx, cz);
    const [lat, lng] = toLatLng(cx, cz);
    gaps.push({
      name: b.n,
      lidarHeight: h ?? null,
      areaM2: Math.round(ringArea(b.p)),
      latLng: [+lat.toFixed(6), +lng.toFixed(6)],
      local: [+cx.toFixed(1), +cz.toFixed(1)],
      reason: inGrid
        ? h == null
          ? "inside LiDAR area but no 2014 return above ground — likely built after the 2014 flight"
          : "near-zero 2014 height — site was flat in 2014 (post-2014 construction or open lot)"
        : "outside the LiDAR download area — coverage gap, not an epoch statement",
      insideLidarArea: inGrid,
    });
  }

  gaps.sort((a, b) => (b.insideLidarArea - a.insideLidarArea) || (b.areaM2 - a.areaM2));

  // Street View metadata cross-check on the 5 most prominent candidates
  const toCheck = gaps.slice(0, 5);
  for (const g of toCheck) {
    spend("streetViewMetadata");
    const j = await getJson(
      `https://maps.googleapis.com/maps/api/streetview/metadata?location=${g.latLng[0]},${g.latLng[1]}&radius=80&source=outdoor&key=${KEY}`,
    );
    g.streetView = {
      status: j.status,
      panoDate: j.date ?? null,
      panoDistanceM:
        j.location != null
          ? Math.round(Math.hypot((j.location.lat - g.latLng[0]) * MLAT, (j.location.lng - g.latLng[1]) * MLNG))
          : null,
    };
    g.satelliteCheck =
      "manual: current satellite tile at this lat/lng (Map Tiles session) — not fetched by this audit";
    await sleep(40);
  }

  return gaps;
}

/* -------------------------------------------------------- 4 HEIGHT REGRESSION */

function auditHeightRegression() {
  /* The README "measured" column, parsed LIVE from README.md — a hardcoded
     copy here reported drift forever after the README itself was fixed.
     Rows look like: | Argo Hall | 22.8 m | **18.4 m** | */
  const readme = fs.readFileSync(new URL("../README.md", import.meta.url), "utf8");
  const readmeTable = {};
  for (const m of readme.matchAll(
    /^\|\s*([^|]+?)\s*\|\s*[\d.]+\s*m\s*\|\s*\*\*([\d.]+)\s*m\*\*\s*\|/gm
  )) {
    readmeTable[m[1]] = Number(m[2]);
  }
  const details = [];
  let allPresent = true;
  for (const [name, readmeVal] of Object.entries(readmeTable)) {
    const shipped = lidar.heights[name] ?? null;
    if (shipped == null || shipped <= 0) allPresent = false;
    details.push({
      name,
      readmeM: readmeVal,
      shippedM: shipped,
      driftM: shipped == null ? null : +(shipped - readmeVal).toFixed(1),
    });
  }
  const maxDrift = Math.max(...details.map((d) => Math.abs(d.driftM ?? 99)));
  return {
    pass: allPresent, // shipped data still carries a measured value for all 6
    readmeInSyncWithData: maxDrift <= 0.05,
    maxDriftM: +maxDrift.toFixed(1),
    note:
      "pass = campus-lidar.json still carries a measured height for every README-table building; " +
      "the README numbers themselves predate the last data rebuild and have drifted (see driftM)",
    details,
  };
}

/* ------------------------------------------------------------- 5 STREET VIEW */

async function auditStreetView() {
  // Reproduce the shipped walk exactly as campus-walk.js boot() builds it.
  const graph = buildGraph(campus);
  const plaza = campus.places["Revelle Plaza"];
  const ridge = campus.paths.filter((p) => p.n === "Ridge Walk").flatMap((p) => p.p);
  const target = { x: plaza.x, z: plaza.z - 300 };
  let end = null;
  let bestD = Infinity;
  for (const [x, z] of ridge) {
    const d = Math.hypot(x - target.x, z - target.z);
    if (d < bestD) { bestD = d; end = { x, z, name: "Ridge Walk" }; }
  }
  const route = routeThrough(campus, graph, ["Argo Hall", "Revelle Plaza", end]);

  // every ~50 m: route points are 2 m apart -> every 25th, plus the last point
  const samples = [];
  for (let i = 0; i < route.points.length; i += 25) samples.push(route.points[i]);
  const last = route.points[route.points.length - 1];
  if (samples[samples.length - 1] !== last) samples.push(last);

  const panos = [];
  for (const { x, z } of samples) {
    const [lat, lng] = toLatLng(x, z);
    spend("streetViewMetadata");
    const j = await getJson(
      `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat.toFixed(6)},${lng.toFixed(6)}&radius=50&source=outdoor&key=${KEY}`,
    );
    panos.push({
      local: [+x.toFixed(1), +z.toFixed(1)],
      latLng: [+lat.toFixed(6), +lng.toFixed(6)],
      status: j.status,
      date: j.date ?? null,
    });
    await sleep(40);
  }

  const ok = panos.filter((p) => p.status === "OK");
  const dates = ok.map((p) => p.date).filter(Boolean).sort();
  const medianDate = dates.length ? dates[Math.floor(dates.length / 2)] : null;
  return {
    routeMetres: route.metres,
    sampleEveryM: 50,
    samples: panos.length,
    covered: ok.length,
    coveragePct: +((100 * ok.length) / panos.length).toFixed(1),
    medianDate,
    dates: [...new Set(dates)],
    points: panos,
  };
}

/* ------------------------------------------------------------ recommendations */

function buildRecommendations(report) {
  const recs = [];

  if (!report.heightRegression.readmeInSyncWithData) {
    recs.push({
      confidence: "high",
      area: "README",
      action:
        "Update the README measured-height table to the shipped campus-lidar.json values " +
        `(max drift ${report.heightRegression.maxDriftM} m, e.g. Argo Hall ${report.heightRegression.details[0].shippedM} m); ` +
        "the data was rebuilt after the README was written.",
    });
  }

  const realGaps = report.epochGaps.filter((g) => g.insideLidarArea);
  if (realGaps.length) {
    recs.push({
      confidence: "high",
      area: "epoch",
      action:
        `Mark these footprints as post-2014/no-LiDAR in-app (honesty list) rather than silently using OSM height: ` +
        realGaps.map((g) => g.name).join(", ") +
        ". Street View metadata dates above confirm current existence.",
    });
  }

  if (Math.abs(report.terrain.mean) > 0.5) {
    recs.push({
      confidence: "high",
      area: "terrain",
      action:
        `Treat the ${report.terrain.mean} m mean Google-vs-LiDAR offset as a vertical-datum (EGM96 vs NAVD88) difference — ` +
        "do NOT re-shift the LiDAR terrain; residual RMS after removing it is " +
        `${report.terrain.rmsAfterMeanRemoval} m, within Elevation-API resolution noise unless flagged in worst[].`,
    });
  }

  const realChanges = report.terrain.worst.filter((w) => w.classification.startsWith("possible real change"));
  if (realChanges.length) {
    recs.push({
      confidence: "medium",
      area: "terrain",
      action:
        "Manually inspect current satellite imagery at these points for post-2014 regrading: " +
        realChanges.map((w) => `(${w.lat}, ${w.lng}) diff ${w.diff} m`).join("; "),
    });
  }

  const noResult = report.names.mismatches.filter((m) => m.reason === "no-result");
  if (noResult.length) {
    recs.push({
      confidence: "medium",
      area: "names",
      action:
        "Places has no result for these OSM names — likely informal/renamed; verify against campus map before renaming: " +
        noResult.map((m) => m.osmName).join(", "),
    });
  }
  const locBad = report.names.mismatches.filter((m) => m.reason && m.reason.startsWith("location"));
  if (locBad.length) {
    recs.push({
      confidence: "medium",
      area: "names",
      action:
        "Places puts these named buildings >120 m from the OSM footprint — check for OSM mislabels or Places pin drift: " +
        locBad.map((m) => `${m.osmName} (${m.distanceM} m)`).join(", "),
    });
  }
  const nameBad = report.names.mismatches.filter((m) => m.reason === "name-mismatch");
  if (nameBad.length) {
    recs.push({
      confidence: "low",
      area: "names",
      action:
        "Location agrees but Places calls these something else (often official vs colloquial name) — no action unless a label reads wrong in-app: " +
        nameBad.map((m) => `${m.osmName} -> ${m.placesName}`).join("; "),
    });
  }

  if (report.streetView.coveragePct < 100) {
    recs.push({
      confidence: "low",
      area: "street-view",
      action:
        `Street View covers ${report.streetView.coveragePct}% of the walk (median pano ${report.streetView.medianDate}); ` +
        "uncovered stretches cannot be cross-checked against ground-level current imagery.",
    });
  }

  return recs;
}

/* ------------------------------------------------------------------------ main */

async function main() {
  const started = new Date().toISOString();
  const terrain = await auditTerrain();
  const names = await auditNames();
  const epochGaps = await auditEpochGaps();
  const heightRegression = auditHeightRegression();
  const streetView = await auditStreetView();

  const report = {
    _: "Campus Walk accuracy audit (R2). Generated by scripts/audit-accuracy.mjs — do not hand-edit.",
    generated: started,
    sources: {
      shipped: ["docs/data/campus-3d.json (OSM)", "docs/data/campus-lidar.json (USGS 2014 QL2 LiDAR)"],
      crossChecked: ["Google Elevation API", "Places Text Search (New)", "Street View metadata"],
      epochRule: "LiDAR = 2014 flight; Google = current. Disagreement can be time, not error.",
    },
    terrain,
    names,
    epochGaps,
    heightRegression,
    streetView,
    requestCounts: { ...requestCounts, total: totalRequests(), budget: BUDGET },
    recommendations: [],
  };
  report.recommendations = buildRecommendations(report);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const json = JSON.stringify(report, null, 2);
  if (json.includes(KEY)) throw new Error("refusing to write: API key leaked into report");
  fs.writeFileSync(OUT, json + "\n");

  console.log(`terrain: n=${terrain.samples} rms=${terrain.rms} m, mean=${terrain.mean} m, detrended rms=${terrain.rmsAfterMeanRemoval} m`);
  console.log(`names: ${names.matched}/${names.checked} matched, ${names.mismatches.length} flagged`);
  console.log(`epoch gaps: ${epochGaps.length} (${epochGaps.filter((g) => g.insideLidarArea).length} inside LiDAR area)`);
  console.log(`height regression: pass=${heightRegression.pass} readmeInSync=${heightRegression.readmeInSyncWithData}`);
  console.log(`street view: ${streetView.coveragePct}% of walk, median pano ${streetView.medianDate}`);
  console.log(`requests: ${JSON.stringify(requestCounts)} total=${totalRequests()}/${BUDGET}`);
  console.log(`report: ${path.relative(ROOT, OUT)}`);
}

main().catch((e) => {
  console.error(String(e?.stack || e).replaceAll(KEY, "REDACTED"));
  process.exit(1);
});
