#!/usr/bin/env node
// Build docs/data/campus-3d.json — the geometry behind Campus Rush.
//
// WHY THIS EXISTS. The Campus Map tool already ships docs/data/campus-map.json,
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

/* The whole main campus, as bounded by the roads that bound it: North Torrey
   Pines Road on the west, La Jolla Village Drive on the south, Genesee Avenue
   across the north-east, and I-5 on the east. Everything a student walks —
   all seven colleges, Eighth at Pepper Canyon, University Center, the Geisel
   forecourt — lives inside this box. It is ~9x the old Argo–Peterson corridor
   and the payload grows with it; that is the point now. */
const BBOX = "32.8655,-117.2540,32.8905,-117.2215";

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
/* Relations included since 2026-08-03: OSM maps a building as a multipolygon
   RELATION whenever it has a courtyard or was drawn from several ways, and
   this box turned out to hold 27 of them — the Faculty Club, the whole Rady
   School cluster, the Supercomputer Center, EBU2, Pepper Canyon Hall, the
   Conrad Prebys Music Center. A ways-only pull shipped a campus where every
   one of those was an empty lawn. */
const QUERY = `[out:json][timeout:180];
(
  way["building"](${BBOX});
  relation["building"](${BBOX});
  way["building:part"](${BBOX});
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
          headers: { "User-Agent": "3d-modeling-campus campus-3d build (github.com/SahirSSharma)" },
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
  /* Dense L7 roof plane (r1c0 re-sweep 2026-08-05): 22.4 m — the earlier
     28 / HAND_AUDITED 27.6 mistook rooftop mechanical for a taller tower.
     Fallback only; lidar.heights carries the live number. */
  "Tenaya Hall": 22.4,
  "Solis Hall": 10,
  "Theodore and Adele Shank Theatre": 14,
  /* Gabled single-storey club; targeted LiDAR puts the dining-hall ridge at
     ~6.5 m (p98 lands in the overhanging eucalyptus, so the tag-free area
     guess of 16 m was more than double the real building). */
  "Ida and Cecil Green Faculty Club": 7,
  /* The one building whose footprint pokes past build-campus-lidar.mjs's
     survey box, so the standard pipeline never measures it and the area
     guess (20 m) stood. A targeted re-sample of the same 2014 EPT
     (r0c2 sweep, 2026-08-04: 30,780 returns, p75 21.6, p98 24.3 — one
     plane, no canopy) puts the roof at 24.3 m. Apple confirms the
     building stands unchanged on its 2014 footprint. */
  "Qualcomm AA": 24.3,
};

/* THE ESTIMATED TABLE — post-2014 buildings with no measurable height.
   The 2014 flight predates every one of these, no facilities massing covers
   their parcel, and the newer-EPT probe came back empty (2026-08-03: the only
   USGS 3DEP datasets over this campus are CA_SanDiegoQL2_2014, the 2002-05
   Scripps strips, and the 2016 coastal El Niño survey — all pre-construction).
   So each height is floors x storey from Street View floor counts (2025-02
   panos, .cache/qa evidence), declared HERE and never silently in the data.
   Buildings whose OSM tag already agrees with the SV floor count (Mosaic 26.4,
   The Jeannie 8.4, SSPEB, Arts and Humanities) need no entry. */
const ESTIMATED_POST_2014 = {
  "Tapestry": 23,             // 6 residential floors (sv_tapestry.jpg)
  "Catalyst": 37,             // 10-floor tower on pilotis (sv_catalyst.jpg)
  "Kaleidoscope": 21,         // 6-7 residential floors (sv_kaleidoscope.jpg); OSM's 16 was an area guess
  "Viterbi Family Vision Research Center": 18, // 4 clinic/lab floors (sv/viterbi_site.jpg); OSM's 27.5 was a guess ~30% tall
};

/* THE UNDER-CONSTRUCTION TABLE — sites where what stands TODAY is a partial
   frame, not the finished building. The Triton Center block south of Price
   Center: the 2014 LiDAR "heights" there were returns off the DEMOLISHED
   predecessor buildings (old International Center block), and the OSM
   footprints describe the finished project. 2025 Street View
   (.cache/qa/core/sv-triton-center.jpg, McCarthy fencing, steel frames) is
   the source for the current build state. Refresh when the site tops out. */
const UNDER_CONSTRUCTION = {
  "The Strauss": 19,                              // ~6 erected frame decks
  "Student Success Building": 16,                 // ~5 levels, partially clad
  "Student Health and Well-Being Building": 13,   // ~4 frame levels
  "Triton Alumni and Welcome Center": 10,         // ~3 frame levels
};

/* Demolished with the old International Center to clear the Triton Center
   site (2025 Street View: .cache/qa/core/sv-thrift-site.jpg shows the fenced
   pit where the cottage stood). OSM still maps it; the world must not. */
const DEMOLISHED = new Set(["Friend's Thrift Shop"]);

/* Height, in the order we actually trust the evidence: a value we have checked
   by eye beats a tag, a tag beats a guess, and the guess scales with footprint
   area because big-plan buildings here do tend to be the tall ones. Clamped at
   60 m so one bad tag cannot put a skyscraper on Library Walk. */
function heightOf(tags, area) {
  const uc = UNDER_CONSTRUCTION[tags.name];
  if (uc) return uc; // current build state beats the finished-project tags
  const known = KNOWN_HEIGHTS[tags.name] ?? ESTIMATED_POST_2014[tags.name];
  if (known) return known;
  const explicit = parseFloat(tags.height);
  /* Clamp raised from 60 m: the Eighth College tower (Sankofa) really is the
     tallest building on campus at ~80 m, and the old clamp flattened it. */
  if (Number.isFinite(explicit) && explicit > 0) return round1(Math.min(explicit, 90));
  const levels = parseFloat(tags["building:levels"]);
  if (Number.isFinite(levels) && levels > 0) return round1(Math.min(levels * 3.6 + 1.2, 90));
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

/* Names corrected at intake, because the label a student reads comes from the
   OSM name and these are the ones OSM gets wrong (zone audit 2026-08-03):
   - "Pangea" is the parking structure; the buildings under this label are the
     Marshall lower apartments, which no student has ever called Pangea.
   - "64 North" is the venue's own signage; "Sixty Four North" is nobody's.
   - CMRR was renamed by the university (Memory, not Magnetic — the facilities
     data in this repo already carries the current name).
   - Thornton has been "Jacobs Medical Center — Thornton Pavilion" since 2016.
   - "Lodge" gets the GIS name; a bare "Lodge" is ambiguous campus-wide.
   - "Otterson Hall Rady School of Management" / "Engineering II" become the
     names students actually search for. */
const RENAMES = {
  "Pangea Residence Halls": "Marshall Lower Apartments",
  "Sixty Four North": "64 North",
  "Center for Magnetic Recording Research": "Center for Memory and Recording Research",
  "The John M and Sally B Thornton Hospital": "Thornton Pavilion",
  "Lodge": "Pepper Canyon Apartments Lodge",
  "Otterson Hall Rady School of Management": "Otterson Hall",
  "Engineering II": "Engineering Building Unit 2 (EBU2)",
};

/* Names carried by an OSM SITE rather than by the building ways themselves.
   Louis Kahn's Salk Institute — the most recognised architecture on this
   stretch of Torrey Pines Road — is mapped in OSM as two UNNAMED concrete
   ways (31839360 south, 31844744 north, both wikidata Q128635401) standing
   inside the named amenity=research_institute area (way 60735906, "Salk
   Institute for Biological Studies", wikidata Q1351061). The importer only
   reads names off building elements, so the twin laboratory wings shipped
   anonymous — and an unnamed footprint can never be keyed to its LiDAR
   measurement, so both wore their OSM levels guess (22.8 m) instead of the
   2014 roof plane both wings share (19.6 m). The name is OSM's own, applied
   by way id; the site's two low EAST buildings (31842306, 31844209, same
   wikidata) stay unnamed — their OSM height=10 tags agree with the LiDAR
   (10.3 / 9.7 m) and two more rings under one name would smear one roof
   plane across four different buildings. */
const WAY_NAMES = {
  31839360: "Salk Institute for Biological Studies",
  31844744: "Salk Institute for Biological Studies",
};

/* The Pepper Canyon apartment blocks are OSM-named as bare numbers ("400",
   "1800"). A student says "Pepper Canyon 400", and the university GIS name is
   a superstring of the number — so the prefix goes on at build time. Scoped
   to the Pepper Canyon parcel so a numeric name elsewhere is left alone. */
const PC_APARTMENTS = { x0: 940, x1: 1110, z0: -150, z1: 100 };
function fixName(name, ring) {
  if (!name) return name;
  if (RENAMES[name]) return RENAMES[name];
  if (/^\d+$/.test(name) && ring) {
    const c = centroid(ring);
    if (c[0] > PC_APARTMENTS.x0 && c[0] < PC_APARTMENTS.x1 &&
        c[1] > PC_APARTMENTS.z0 && c[1] < PC_APARTMENTS.z1) {
      return `Pepper Canyon Apartments ${name}`;
    }
  }
  return name;
}

/* A structure that is entirely below grade must not extrude. The Scholars
   Parking Structure is the canonical case: OSM tags it building=parking +
   location=underground + layer=-1, the 2014 LiDAR "measures" 5.9 m of the old
   Camp Matthews surface, and the result was a solid slab across the whole
   Sixth College lawn — the open green half the college hangs out on. */
const isUnderground = (tags) =>
  tags.location === "underground" ||
  tags.parking === "underground" ||
  (tags.building === "parking" && parseFloat(tags.layer) < 0);

/* Footprints removed ON PURPOSE, keyed by centroid because they are unnamed
   (so no LiDAR referee ever applies) and way ids churn. Two 4-vertex OSM
   "buildings" stand in the open P206 parking lot east of Mandeville; the 2025
   satellite chunk and Street View both show bare striped stalls — likely
   pre-mapping of planned solar canopies. Verified 2026-08-03. */
const EXCLUDED_BUILDING_ANCHORS = [
  [273.0, 23.1],
  [293.6, 22.9],
];
const isExcludedBuilding = (ring) => {
  const c = centroid(ring);
  return EXCLUDED_BUILDING_ANCHORS.some((a) => Math.hypot(c[0] - a[0], c[1] - a[1]) < 12);
};

/* Anchors a student navigates by that no single OSM footprint carries: the
   college-level names (anchored on member buildings), the trolley station
   platform (no building to hang a name on), the underground Scholars garage
   whose footprint is deliberately not extruded above, and the Epstein bowl
   whose footprint is building=no (the label survives the exclusion). */
const SEEDED_PLACES = {
  "Thurgood Marshall College": { x: -160, z: -590 },
  "Eleanor Roosevelt College": { x: -69.5, z: -655.3 },
  "International House": { x: -75.6, z: -688 },
  /* CORRECTED 2026-08-04 by Sahir, who attends this university: Eighth
     College is Sankofa, Pulse, Podemos, Azad and Survivance — NOT Alianza,
     Umoja, Coalition and Malk Hall, which belong to Thurgood Marshall.
     A gauntlet pass had moved this anchor 1.1 km north to Marshall's new
     Ridge Walk North halls, on the strength of an OSM neighbourhood name.
     The original seed was right all along; it only looked wrong because the
     Google 3D mesh over that spot predates 2023 and still shows the bare
     construction site — the epoch trap this project exists to avoid.
     Anchor is the mean of the five member buildings' footprints. */
  "Eighth College": { x: -131.2, z: 593.6 },
  "UC San Diego Central Campus Trolley Station": { x: 875, z: -75 },
  "Scholars Parking Structure": { x: -36.1, z: -259.4 },
  /* Its ring's centroid, kept as a place after building=no dropped the ring:
     the venue is real even though the slab was not. */
  "Epstein Family Amphitheater": { x: 743, z: -131.6 },
  /* r0c2 sweep (2026-08-04): the two east-campus anchors everyone actually
     navigates by. Both names live on OSM SITE ways (amenity areas), not on
     any building footprint — every hospital building is an unnamed ring —
     so neither survived the buildings/paths name pass. Coordinates are the
     site ways' centroids (way/26103742, way/159384334). */
  "Scripps Memorial Hospital La Jolla": { x: 1466.1, z: -713.5 },
  "The Preuss School": { x: 1791.6, z: -480.3 },
};

/** Stitch a multipolygon relation's outer members into closed rings (already
    projected). Members arrive as open or closed polylines; joining shared
    endpoints rebuilds each outer loop. Inner rings (courtyards) are dropped —
    buildings ship as single rings, same as every way-sourced footprint. */
function stitchOuters(members) {
  const segs = members
    .filter((m) => m.role === "outer" && m.geometry?.length >= 2)
    .map((m) => m.geometry.map((g) => project(g.lat, g.lon)));
  const rings = [];
  while (segs.length) {
    let ring = segs.shift();
    let guard = 0;
    while (keyOf(ring[0]) !== keyOf(ring[ring.length - 1]) && guard++ < 400) {
      const end = keyOf(ring[ring.length - 1]);
      const idx = segs.findIndex((s) => keyOf(s[0]) === end || keyOf(s[s.length - 1]) === end);
      if (idx === -1) break;
      const s = segs.splice(idx, 1)[0];
      ring = ring.concat((keyOf(s[0]) === end ? s : s.slice().reverse()).slice(1));
    }
    if (keyOf(ring[0]) === keyOf(ring[ring.length - 1]) && ring.length >= 4) rings.push(ring.slice(0, -1));
  }
  return rings;
}

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
  const looseParts = [];
  const relations = [];

  for (const el of elements) {
    if (el.type === "relation" && el.tags?.building && el.members?.length) {
      relations.push(el); // processed after ways, so nesting can be checked
      continue;
    }
    if (el.type !== "way" || !el.geometry?.length) continue;
    if (EXCLUDED_WAYS.has(el.id)) continue;
    const tags = el.tags || {};
    const pts = el.geometry.map((g) => project(g.lat, g.lon));
    if (tags.highway && matchesExcludedAnchors(pts)) continue;

    if (tags["building:part"] && tags["building:part"] !== "no") {
      /* A part is one mass of a multi-mass building — the handful of places
         OSM mappers modelled a complex shape properly. Collected first, then
         attached to whichever footprint contains them; the LiDAR pass
         measures each part's own roof so a stepped building steps. */
      const ring = pts.slice(0, -1);
      if (ring.length >= 3 && areaOf(ring) >= 15) {
        const part = { p: ring };
        const h = parseFloat(tags.height);
        if (Number.isFinite(h) && h > 0) part.h = round1(Math.min(h, 90));
        looseParts.push(part);
      }
      continue;
    }

    if (tags.building && tags.building !== "no") {
      /* building=no is OSM saying "this closed way is NOT a building" — the
         Epstein Family Amphitheater's bowl (amenity=theatre, building=no)
         imported as a truthy string and shipped as a 17 m slab over an
         open-air venue. The parts filter two branches up already knew this;
         this one did not. */
      if (isUnderground(tags)) continue; // below grade — nothing to extrude
      if (DEMOLISHED.has(tags.name)) continue; // stood in 2014, gone today
      // Closed ring; drop the duplicated last vertex OSM uses to close it.
      const ring = pts.slice(0, -1);
      if (ring.length < 3) continue;
      if (isExcludedBuilding(ring)) continue;
      const area = areaOf(ring);
      if (area < MIN_FOOTPRINT_M2) continue;
      const b = { h: heightOf(tags, area), p: ring };
      const name = fixName(tags.name, ring) || WAY_NAMES[el.id];
      if (name) b.n = name;
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

  /* Attach each part to the building whose footprint holds its centroid.
     A building with two or more parts is a genuinely multi-mass shape; the
     renderer draws the parts instead of the single slab. */
  const inRing = (pt, ring) => {
    let ins = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, zi] = ring[i];
      const [xj, zj] = ring[j];
      if (zi > pt[1] !== zj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - zi)) / (zj - zi) + xi) ins = !ins;
    }
    return ins;
  };

  /* Relation-mapped buildings, after every way so nesting can be checked.
     Per relation: the largest outer ring carries the name (one place anchor
     per name, and the LiDAR pass measures the named ring), smaller outers
     ship unnamed. A ring whose centroid already sits inside a shipped
     footprint is nested mapping (roof furniture on a garage) and is dropped. */
  let relRings = 0;
  for (const el of relations) {
    const tags = el.tags || {};
    if (isUnderground(tags)) continue;
    if (DEMOLISHED.has(tags.name)) continue;
    const rings = stitchOuters(el.members)
      .filter((r) => areaOf(r) >= MIN_FOOTPRINT_M2 && !isExcludedBuilding(r))
      .sort((a, b) => areaOf(b) - areaOf(a));
    rings.forEach((ring, i) => {
      const c = centroid(ring);
      if (buildings.some((b) => inRing(c, b.p))) return;
      const b = { h: heightOf(tags, areaOf(ring)), p: ring };
      const name = i === 0 ? fixName(tags.name, ring) : null;
      if (name) b.n = name;
      buildings.push(b);
      relRings++;
    });
  }
  if (relations.length) console.log(`  ${relRings} rings from ${relations.length} building relations`);

  let attached = 0;
  for (const part of looseParts) {
    const c = centroid(part.p);
    const host = buildings.find((b) => inRing(c, b.p));
    if (!host) continue;
    (host.parts ??= []).push(part);
    attached++;
  }
  if (looseParts.length) console.log(`  ${attached}/${looseParts.length} building parts attached`);

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

  /* Hand-seeded anchors last, and only where no real footprint claimed the
     name — these fill wayfinding gaps, they never override the map. */
  for (const [n, pt] of Object.entries(SEEDED_PLACES)) {
    if (!places[n]) places[n] = { x: pt.x, z: pt.z };
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
    /* Otterson and the Faculty Club are relation-mapped in OSM — if either
       vanishes, the relation pull regressed to the ways-only extraction that
       shipped a campus with no Rady School. */
    const need = ["Argo Hall", "Peterson Hall", "Otterson Hall", "Ida and Cecil Green Faculty Club"];
    const missing = need.filter((n) => !data.places[n]);
    if (missing.length) { console.error("missing anchors:", missing.join(", ")); process.exit(1); }
    /* The verified phantoms must stay gone: the underground Scholars garage
       (Sixth College lawn) and the two boxes in the open P206 lot. */
    const inRingChk = (pt, ring) => {
      let ins = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, zi] = ring[i];
        const [xj, zj] = ring[j];
        if (zi > pt[1] !== zj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - zi)) / (zj - zi) + xi) ins = !ins;
      }
      return ins;
    };
    for (const spot of [[-36.1, -259.4], ...EXCLUDED_BUILDING_ANCHORS]) {
      const hit = data.buildings.find((b) => inRingChk(spot, b.p));
      if (hit) {
        console.error(`phantom footprint back at (${spot}): ${hit.n || "unnamed"} h=${hit.h}`);
        process.exit(1);
      }
    }
    /* Demolished buildings must stay demolished, and an under-construction
       site must never quietly revert to its finished-project height. */
    for (const n of DEMOLISHED) {
      if (data.buildings.some((b) => b.n === n)) {
        console.error(`demolished building back on the map: ${n}`);
        process.exit(1);
      }
    }
    for (const [n, h] of Object.entries(UNDER_CONSTRUCTION)) {
      const b = data.buildings.find((x) => x.n === n);
      if (b && b.h !== h) {
        console.error(`${n} shipped at ${b.h} m; the documented build state is ${h} m`);
        process.exit(1);
      }
    }
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
