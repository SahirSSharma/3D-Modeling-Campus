#!/usr/bin/env node
// Build app/data/campus-3d.json — the geometry behind Campus Rush.
//
// WHY THIS EXISTS. The Campus Map tool already ships app/data/campus-map.json,
// but everything in it is either a *point* (204 pinned places) or a big
// neighbourhood *outline* (the campus edge, the seven colleges). You cannot
// ride through a point. A game with a camera sitting six metres behind a
// scooter needs the thing a map never needed: the actual shape of each
// building, and the actual walkways between them.
//
// So this is a second, heavier pull from the same source — OpenStreetMap via
// Overpass, ODbL. Same source is deliberate, exactly as it was for the map: a
// building extruded from here stands on precisely the footprint the Campus Map
// draws its pin on, so the two tools can never quietly disagree about where
// Peterson Hall is.
//
// What it emits, in local metres rather than degrees, because the renderer
// wants metres and doing the projection once at build time is cheaper than
// doing it every frame:
//
//   buildings — footprint rings + an extrusion height
//   paths     — the pedestrian network, as polylines that share endpoints so
//               the runtime can walk them as a graph and route Argo -> Peterson
//   places    — the handful of named anchors a route can start or end at
//
// Usage:
//   node scripts/build-campus-3d.mjs            # fetch + write
//   node scripts/build-campus-3d.mjs --check    # verify the shipped file only
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(REPO_ROOT, "docs/data/campus-3d.json");
const CHECK = process.argv.includes("--check");
/* Overpass is a free, shared, heavily-loaded service. A single-endpoint fetch
   here failed with a 504 on the second run of the day having succeeded on the
   first, which is normal for it and no reason to hand a build failure to
   whoever runs this next. Mirrors run the same software over the same planet
   file, so any of them can answer. */
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

/* The academic spine, not the whole campus. This box runs from Revelle's
   residence halls in the south up past Muir and the Price Center to Marshall,
   which is where the classes and the dorms that feed them actually are. The
   full campus box that build-campus-map.mjs uses reaches down to Scripps and
   out to the medical campus; pulling building geometry for all of that would
   roughly triple the payload to render coastline nobody rides through. */
const BBOX = "32.8715,-117.2465,32.8845,-117.2360";

/* Metres per degree at this latitude. Campus is ~1.5 km across, so a local
   flat projection is accurate to well under a metre here — far below the
   precision anyone can perceive at scooter speed, and it avoids shipping a
   projection library to the browser. */
const LAT0 = 32.878;
const LNG0 = -117.2412;
const M_PER_DEG_LAT = 110574;
const M_PER_DEG_LNG = 111320 * Math.cos((LAT0 * Math.PI) / 180);

/* Three.js convention: +x east, -z north. The camera looks down -z, so a rider
   heading north is heading "into" the screen, which is the direction a chase
   camera wants to point. */
const project = (lat, lng) => [
  round1((lng - LNG0) * M_PER_DEG_LNG),
  round1(-(lat - LAT0) * M_PER_DEG_LAT),
];
const round1 = (n) => Math.round(n * 10) / 10;

/* Ways we let a scooter travel. Steps are included on purpose — campus is
   built on a mesa and the stairs are unavoidable on some routes; the game
   treats them as an obstacle rather than pretending they are not there. */
const PATH_KINDS = new Set([
  "footway", "path", "pedestrian", "steps", "cycleway", "living_street", "service",
]);

/* Buildings this small are bike sheds, trash enclosures and electrical huts.
   They add polygons and nothing to ride past. */
const MIN_FOOTPRINT_M2 = 60;

/* Tag filters go before the bounding box. Overpass answers 406 rather than a
   syntax error if you interleave them the other way, which is a memorable
   twenty minutes to lose. */
const QUERY = `[out:json][timeout:180];
(
  way["building"](${BBOX});
  way["highway"~"^(footway|path|pedestrian|steps|cycleway|living_street|service)$"](${BBOX});
  way["amenity"="fountain"](${BBOX});
  way["natural"="water"](${BBOX});
  way["leisure"~"^(garden|pitch|park)$"](${BBOX});
);
out geom;`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchOverpass() {
  let lastErr;
  // Two passes over the mirror list: a mirror that is merely busy right now is
  // often fine thirty seconds later, so give the whole set a second chance
  // before giving up.
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const endpoint of ENDPOINTS) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "User-Agent": "TritonPlan campus-3d build (github.com/SahirSSharma)" },
          body: new URLSearchParams({ data: QUERY }),
        });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const json = await res.json();
        if (!json.elements?.length) throw new Error("no elements");
        console.log(`  via ${new URL(endpoint).host}`);
        return json.elements;
      } catch (err) {
        lastErr = err;
        console.log(`  ${new URL(endpoint).host}: ${err.message}`);
        await sleep(3000 + attempt * 12000);
      }
    }
  }
  throw new Error(`every Overpass mirror failed — last: ${lastErr.message}`);
}

/* Shoelace, in metres, on the already-projected ring. */
function areaOf(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return Math.abs(a / 2);
}

/* Approximate real heights, in metres, for buildings OpenStreetMap gets wrong
 * or does not describe at all.
 *
 * THIS TABLE EXISTS BECAUSE THE TAGS FAILED EXACTLY WHERE IT MATTERS MOST.
 * Only 38 of the ~320 buildings in this box carry building:levels, and the ones
 * that go untagged are not a random sample — they are the old landmark
 * buildings that have been on the map longest. Geisel and Urey both arrive with
 * no height information whatsoever and fell to the area guess at 14 m, which
 * put the most recognisable building in San Diego at the height of a lecture
 * hall. Worse, Peterson Hall is tagged `building:levels = 1`, which is simply
 * incorrect, and produced a 4.8 m pancake — the destination of the first route
 * anyone rides.
 *
 * No footprint-area heuristic can fix that, because the information is not in
 * the footprint. So this is the one place a wrong height gets corrected, and
 * anything added here beats both the tags and the guess. Values are eyeballed
 * building heights for rendering, not surveyed figures and not floor counts —
 * a lecture hall's single storey is far taller than a dorm's. */
const KNOWN_HEIGHTS = {
  "Geisel Library": 33,       // 8 storeys on the raised brutalist pedestal
  "Urey Hall": 30,            // 7-storey chemistry tower
  "York Hall": 20,
  "Peterson Hall": 12,        // OSM says 1 level; the lecture halls alone are double height
  "Mandeville Center": 15,
  "Galbraith Hall": 12,
  "Revelle Commons": 10,
  "Center Hall": 14,
  "Price Center": 16,
  "Pacific Hall": 18,
  "Mayer Hall": 20,
  "Applied Physics and Mathematics": 24,
  /* Tenaya is the twin of Tioga Hall — both ten-storey Muir residence towers.
     Tioga happens to carry building:levels=10 and arrived at 37 m; Tenaya
     carries nothing and arrived at 7 m, a bungalow where a high-rise stands. */
  "Tenaya Hall": 34,
  "Solis Hall": 10,
  "Theodore and Adele Shank Theatre": 14,
};

/* Height, in the order we actually trust the evidence: a value we have checked
   by eye beats a tag, a tag beats a guess, and the guess scales with footprint
   area because big-plan buildings here do tend to be the tall ones. Clamped at
   60 m so one bad tag cannot put a skyscraper on Library Walk. */
function heightOf(tags, area) {
  const known = KNOWN_HEIGHTS[tags.name];
  if (known) return known;
  const explicit = parseFloat(tags.height);
  if (Number.isFinite(explicit) && explicit > 0) return round1(Math.min(explicit, 60));
  const levels = parseFloat(tags["building:levels"]);
  if (Number.isFinite(levels) && levels > 0) return round1(Math.min(levels * 3.6 + 1.2, 60));
  /* Calibrated against the buildings that DO carry tags, then corrected once:
     the first cut put everything in the 400-1200 m² band at 7 m and produced a
     campus of bungalows — Solis Hall, 64 Degrees and the Chancellor's Complex
     are all two storeys or better. Above roughly 400 m² this campus has
     essentially no single-storey buildings, so the floor of that band is a
     two-storey building, not a shed. */
  if (area > 6000) return 20;
  if (area > 3000) return 16;
  if (area > 1200) return 12;
  if (area > 400) return 9;
  return 4.5;
}

/* Endpoint key for graph stitching. OSM ways that meet share a node, and a
   shared node has bit-identical coordinates, so rounding to 0.1 m and keying on
   the string is enough to rebuild connectivity without asking Overpass for node
   ids. Junctions mid-way matter too, so the runtime splits on any repeated
   vertex, not just the two ends. */
const keyOf = (pt) => `${pt[0]},${pt[1]}`;

/* Ways removed from the network ON PURPOSE. These are dropped at build time so
   a future rebuild cannot quietly resurrect them, and the router simply never
   sees them — A* finds its way around, which is the point.

   1025633000 — the direct footway between Argo Hall and Peterson Hall (the
   94 m concrete way running north from Ridge Walk at (64.5,-119.8) local to
   (44.3,-31)). Removed 2026-08-03 by request; the Argo → Peterson route now
   goes round via the diverging walkway east of it (~785 m instead of 795 m). */
const EXCLUDED_WAYS = new Set([1025633000]);

/* Belt and braces for the exclusion above: way ids can churn if an OSM editor
   splits or replaces the way, so the shipped file is ALSO checked
   geometrically. A path is the excluded Argo–Peterson footway if its polyline
   passes within tolerance of BOTH of these interior points (local metres) —
   two anchors far apart on the way, so a mere crossing path can never match. */
const EXCLUDED_PATH_ANCHORS = [
  [64.5, -106.7],
  [45.0, -40.1],
];

function matchesExcludedAnchors(pts, tol = 1.0) {
  const segDist = (p, a, b) => {
    const vx = b[0] - a[0], vz = b[1] - a[1];
    const t = Math.max(0, Math.min(1,
      ((p[0] - a[0]) * vx + (p[1] - a[1]) * vz) / (vx * vx + vz * vz || 1)));
    return Math.hypot(p[0] - (a[0] + vx * t), p[1] - (a[1] + vz * t));
  };
  return EXCLUDED_PATH_ANCHORS.every((anchor) => {
    for (let i = 1; i < pts.length; i++) {
      if (segDist(anchor, pts[i - 1], pts[i]) < tol) return true;
    }
    return false;
  });
}

function build(elements) {
  const buildings = [];
  const paths = [];
  const surfaces = [];

  for (const el of elements) {
    if (el.type !== "way" || !el.geometry?.length) continue;
    if (EXCLUDED_WAYS.has(el.id)) continue;
    const tags = el.tags || {};
    const pts = el.geometry.map((g) => project(g.lat, g.lon));
    if (tags.highway && matchesExcludedAnchors(pts)) continue;

    if (tags.building) {
      // Closed ring; drop the duplicated last vertex OSM uses to close it.
      const ring = pts.slice(0, -1);
      if (ring.length < 3) continue;
      const area = areaOf(ring);
      if (area < MIN_FOOTPRINT_M2) continue;
      const b = { h: heightOf(tags, area), p: ring };
      if (tags.name) b.n = tags.name;
      buildings.push(b);
    } else if (tags.amenity === "fountain" || tags.natural === "water") {
      /* Revelle Plaza's fountain is the thing you actually steer by when you
         cross the plaza, and it is mapped as its own closed way. */
      const ring = pts.slice(0, -1);
      if (ring.length >= 3) {
        surfaces.push({ kind: "water", p: ring, ...(tags.name ? { n: tags.name } : {}) });
      }
    } else if (PATH_KINDS.has(tags.highway)) {
      /* An `area=yes` pedestrian way is a PLAZA, not a route through one.
         Treating it as a polyline — which is what the first version did —
         turns Revelle Plaza into a thin loop tracing its own perimeter, so the
         one open space on this walk was rendered as a kerb around nothing. */
      if (tags.area === "yes" && pts.length >= 4) {
        surfaces.push({
          kind: "plaza",
          p: pts.slice(0, -1),
          ...(tags.name ? { n: tags.name } : {}),
          ...(tags.surface ? { s: tags.surface } : {}),
        });
        continue;
      }
      if (pts.length < 2) continue;
      const p = { p: pts };
      if (tags.highway === "steps") p.steps = 1;
      /* Names carry the walk: "Ridge Walk" is a destination a student names,
         and surface decides whether it renders as concrete or asphalt. */
      if (tags.name) p.n = tags.name;
      if (tags.surface) p.s = tags.surface;
      paths.push(p);
    } else if (tags.leisure) {
      const ring = pts.slice(0, -1);
      if (ring.length >= 3) surfaces.push({ kind: "green", p: ring });
    }
  }

  /* Named anchors a run can start or finish at. The game asks a student for
     their dorm once and reads their classes off their schedule, and both of
     those arrive as building *names* — so the names have to survive into the
     shipped file, matched against the same strings the rest of the site
     already uses. */
  const places = {};
  for (const b of buildings) {
    if (!b.n) continue;
    const c = centroid(b.p);
    places[b.n] = { x: c[0], z: c[1] };
  }

  /* Named open spaces get an anchor too, so a route can be asked for "Revelle
     Plaza" or "Ridge Walk" by the name a student would actually use. */
  for (const s of surfaces) {
    if (s.n && !places[s.n]) {
      const c = centroid(s.p);
      places[s.n] = { x: c[0], z: c[1] };
    }
  }
  for (const p of paths) {
    if (!p.n || places[p.n]) continue;
    const c = centroid(p.p);
    places[p.n] = { x: c[0], z: c[1] };
  }

  return {
    _: "Generated by scripts/build-campus-3d.mjs from OpenStreetMap (ODbL). Do not hand-edit.",
    origin: { lat: LAT0, lng: LNG0, mPerDegLat: M_PER_DEG_LAT, mPerDegLng: round1(M_PER_DEG_LNG) },
    buildings,
    paths,
    surfaces,
    places,
  };
}

function centroid(ring) {
  let x = 0, z = 0;
  for (const p of ring) { x += p[0]; z += p[1]; }
  return [round1(x / ring.length), round1(z / ring.length)];
}

function summarize(data) {
  const named = Object.keys(data.places).length;
  const pathPts = data.paths.reduce((n, p) => n + p.p.length, 0);
  const plazas = (data.surfaces || []).filter((s) => s.kind === "plaza").length;
  return (
    `${data.buildings.length} buildings (${named} named), ${data.paths.length} paths ` +
    `(${pathPts} points), ${(data.surfaces || []).length} surfaces (${plazas} plazas)`
  );
}

async function main() {
  if (CHECK) {
    if (!existsSync(OUT)) { console.error("missing", OUT); process.exit(1); }
    const data = JSON.parse(readFileSync(OUT, "utf8"));
    const need = ["Argo Hall", "Peterson Hall"];
    const missing = need.filter((n) => !data.places[n]);
    if (missing.length) { console.error("missing anchors:", missing.join(", ")); process.exit(1); }
    const stray = data.paths.filter((p) => matchesExcludedAnchors(p.p));
    if (stray.length) {
      console.error(
        `${stray.length} shipped path(s) match the excluded Argo–Peterson footway — ` +
        "the way id may have churned in OSM; update EXCLUDED_WAYS in this script and rebuild"
      );
      process.exit(1);
    }
    console.log("campus-3d.json OK —", summarize(data));
    return;
  }

  console.log("fetching campus geometry from Overpass…");
  const elements = await fetchOverpass();
  console.log(`  ${elements.length} elements`);
  const data = build(elements);
  writeFileSync(OUT, JSON.stringify(data));
  const kb = Math.round(readFileSync(OUT).length / 1024);
  console.log(`wrote ${OUT} — ${summarize(data)}, ${kb} KB`);
}

main().catch((err) => { console.error(err.message); process.exit(1); });
