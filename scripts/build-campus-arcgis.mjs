#!/usr/bin/env node
// Build docs/data/campus-arcgis.json — the campus ground plane and building
// storeys, from UC San Diego's own public GIS services.
//
// WHY THIS EXISTS. campus-3d.json draws paths as fixed-width ribbons because
// OSM maps a path as a LINE — the ribbon is an honest guess at where the
// concrete is. UCSD's facilities GIS does not guess: it carries the actual
// POLYGONS of every sidewalk, lawn, road and fountain on campus, maintained by
// the people who pour the concrete. Where the university has measured its own
// ground, that measurement beats our reconstruction of it.
//
// The same server also knows how many FLOORS each building has. The renderer
// previously assumed every building had 3.6 m storeys; with the real floor
// count, a 21 m building with 4 floors gets 4 floor lines, not 6.
//
// THE SOURCES (all anonymously public, verified 2026-08-02; discovered from
// the official campus map at maps.ucsd.edu → experience.arcgis.com app):
//   ground   BaseData/Campus_Map_Vector/MapServer/21  (Ground Level Basemap)
//   storeys  Hosted/Building_Extrusions/FeatureServer/0 (building, levels, bldght ft)
//   Geisel   services9…/Geisel_Extrusion/FeatureServer/0 (absent from the layer above)
// The Trees layer (…/24) has a rich schema and a broken data source — every
// query 400s — so trees stay LiDAR-derived. No licence text is published on
// any of these items; this site already states it is unofficial, and the page
// credits the source.
//
// The file stores polygons nearly verbatim (clipped, decimetre integers);
// docs/js/campus-ground.js does the tiling/subdividing at load time. Baking
// that in here made the file 3 MB; storing the raw rings keeps it ~an eighth
// of that for identical rendered geometry.
//
// Usage:
//   node scripts/build-campus-arcgis.mjs           # fetch + write
//   node scripts/build-campus-arcgis.mjs --check   # verify the shipped file
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { ringArea, clipRect, MIN_AREA } = await import(
  path.join(REPO_ROOT, "docs/js/campus-ground.js")
);

const CAMPUS = path.join(REPO_ROOT, "docs/data/campus-3d.json");
const LIDAR = path.join(REPO_ROOT, "docs/data/campus-lidar.json");
const OUT = path.join(REPO_ROOT, "docs/data/campus-arcgis.json");
const CHECK = process.argv.includes("--check");

const ENTERPRISE = "https://admin-enterprise-gis.ucsd.edu/server/rest/services";
const HOSTED = "https://services9.arcgis.com/mXNwDpiENQiMIzRv/arcgis/rest/services";
const GROUND_URL = `${ENTERPRISE}/BaseData/Campus_Map_Vector/MapServer/21/query`;
const EXTRUSIONS_URL = `${ENTERPRISE}/Hosted/Building_Extrusions/FeatureServer/0/query`;
const GEISEL_URL = `${HOSTED}/Geisel_Extrusion/FeatureServer/0/query`;

/* Same box as the LiDAR pull — the ground plane is only useful where there is
   measured ground to drape it over. Full campus: NTP Rd / LJV Dr / Genesee / I-5. */
const AREA = { south: 32.8655, north: 32.8905, west: -117.2540, east: -117.2215 };

/* What the facilities data calls things -> what the renderer paints. Both
   fountain spellings are real: the Revelle Plaza fountain is typed
   'Pool/Fountain', the pools near Geisel 'Pool / Fountain'. */
const KINDS = {
  "Sidewalk": "walk", "Walking Path": "walk", "Bike Path": "walk",
  "Street": "road", "Service Road": "road", "Parking Lot": "road",
  "Grass": "green", "Planter": "green",
  "Pool / Fountain": "water", "Pool/Fountain": "water",
  "Hardcourt": "court", "Tennis Court Interior": "court",
  "Tennis Court Exterior": "court", "Soccer Field": "green",
};

const FT = 0.3048;

/* ---------------------------------------------------------------- fetch */

async function query(url, params) {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const body = new URLSearchParams({
      ...params, f: "geojson", resultOffset: String(offset), resultRecordCount: "1000",
    });
    const res = await fetch(url, { method: "POST", body });
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    const json = await res.json();
    if (json.error) throw new Error(`${url}: ${JSON.stringify(json.error)}`);
    out.push(...(json.features || []));
    if (!json.features?.length || !(json.properties?.exceededTransferLimit ?? json.exceededTransferLimit)) break;
  }
  return out;
}

/* -------------------------------------------------------------- simplify */

/* Douglas–Peucker at 12 cm. The facilities polygons trace curves with
   vertices every few tens of centimetres; at walking scale nothing under a
   handspan is visible, and the shed vertices are a third of the file. */
const DP_TOL = 0.12;

function douglasPeucker(pts, first, last, keep) {
  let maxD = 0;
  let maxI = -1;
  const [ax, az] = pts[first];
  const [bx, bz] = pts[last];
  const len = Math.hypot(bx - ax, bz - az) || 1e-9;
  for (let i = first + 1; i < last; i++) {
    const d = Math.abs((bx - ax) * (az - pts[i][1]) - (ax - pts[i][0]) * (bz - az)) / len;
    if (d > maxD) { maxD = d; maxI = i; }
  }
  if (maxD > DP_TOL) {
    douglasPeucker(pts, first, maxI, keep);
    keep.add(maxI);
    douglasPeucker(pts, maxI, last, keep);
  }
}

function simplify(ring) {
  if (ring.length < 5) return ring;
  const keep = new Set([0, ring.length - 1]);
  douglasPeucker(ring, 0, ring.length - 1, keep);
  const out = ring.filter((_, i) => keep.has(i));
  return out.length >= 3 ? out : ring;
}

/* ----------------------------------------------------------------- names */

/** "Applied Physics & Mathematics" and "Applied Physics and Mathematics"
    are the same building; so are "McGill Hall" and "William J. McGill Hall".
    The manual entries are walk-adjacent buildings whose facilities name
    shares no usable stem with the OSM one. */
const ALIASES = {
  "Argo Hall": "Revelle Residence Hall - Argo",
  "Blake Hall": "Revelle Residence Hall - Blake",
  "Rec Gym": "Recreation Gymnasium",
  "Main Gym": "Main Gymnasium",
  "Biology": "Biology Building",
  "Communications": "Communication Building",
  "Applied Physics and Mathematics": "Applied Physics & Mathematics Building",
  "Price Center": "Price Center East",
  "Student Center": "Original Student Center",
};

const norm = (s) =>
  s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();

/* ------------------------------------------------- massing corrections */

/* UNION OUTLINES (r0c1 sweep, 2026-08-04). A few facilities records trace
   the union of several REAL buildings as one extrusion ring — the same lie
   the SanGIS Marshall outline told from the OSM side, mirrored. ERC's
   "Earth Hall" record is one 2,639 m² ring spanning Earth Hall North, the
   Middle Earth Lounge and Earth Hall South: LiDAR measures the halls at
   11.6 m and the lounge at 4.7 m, so the single 11.7 m slab is wrong over
   the lounge and its host rename pasted the LOUNGE's name over the whole
   chain. "Canyon Vista" spans the 12.0 m admin lodge and the 8.6 m
   restaurant; "Seventh College East #4" spans Village East Buildings 4 AND
   5 (12.1/12.4 m measured) at a 15.2 m GIS guess — VE4 double-rendered
   through it and VE5's suppressed ring was the only thing knowing its name.
   In each case the OSM division is finer and every piece carries its own
   LiDAR plane, so the union ring is dropped and the OSM footprints render.
   Keyed by name + centroid so a service-side fix simply stops matching.
   "Mandell Weiss Forum" (r2c1 judge sweep, 2026-08-05) is the theatre
   version of the same lie, twice: the 1,987 m² record ring spans the
   Forum AND most of the Shank Theatre, so the Shank's own OSM ring
   suppressed under it and the whole complex extruded at one height —
   while a second 56 m² "Forum" sliver whose centroid lands inside the
   Shank ring took the Shank's NAME through the host rename, hanging the
   theatre's label on a 3.2 m shed. LiDAR measures the two buildings
   apart (Forum 10.5, Shank 10.1 — the ring trace of the union reads
   10.4, the Forum's own plane), so both record rings drop and the OSM
   division renders. One entry catches both: the rings' centroids sit
   39.7 m apart, inside the 40 m match radius.
   "Birch Aquarium at Scripps" (r2c0 judge sweep, 2026-08-05): the record
   ring wraps the aquarium AND the Nigella Hillgarth Education Center —
   Hillgarth's OSM ring is 97% inside it, Birch's own 94% — so Hillgarth
   suppressed under the union and took its name down with it, while the
   whole complex extruded at the union trace's guarded 6.5. The OSM
   division measures the two buildings apart (Birch 7.2 — the guard's p75,
   the 10-12 m gallery hall being a stepped 24% no single plane can carry;
   Hillgarth 6.2, its audited full-ring ridge), so the union drops and each
   footprint renders its own plane. The Splash Cafe record ring is its own
   separate mass and keeps measuring itself (2.9).
   Same class, out of this shard's scope, left for their own sweeps:
   64 Degrees (covers Revelle Commons/64 North), Biomedical Sciences
   (covers WongAvery), Mandeville Center (covers Print Labs). */
const UNION_OUTLINES = [
  { n: "Earth Hall", near: [-156, -806] },
  { n: "Canyon Vista", near: [743, -669] },
  { n: "Seventh College East #4", near: [-42, -1099] },
  { n: "Mandell Weiss Forum", near: [29, 647] },
  { n: "Birch Aquarium at Scripps", near: [-886, 1339] },
];

/* Sites whose 2014 building has been demolished for a rebuild that has not
   topped out (Apple satellite, 2026-08-04: tower crane and open concrete
   decks over the RIMAC Annex footprint). The stale massing must not render
   the old building, and no source resolves the rising frame's height to
   gate — the site stays unbuilt until one can. Better absent than wrong. */
const UNDER_RECONSTRUCTION = [
  { n: "RIMAC Annex", near: [65, -867] },
];

/* GIS rings that name a "building" where Apple and the 2014 flight agree
   nothing solid stands — open-air dining, patio, canopy-over-grade,
   mobile-unit pads. Extruding the storey default invents a box. Better
   absent than wrong.
   r1c2 re-sweep (2026-08-05): Foodworx Dining Room — 1,077 returns, 93%
   in −1..0 m (near grade), roofOf 3.7 is a thin shelf over empty air;
   Apple shows umbrellas / outdoor seating south of the real Foodworx
   gable (which already ships its measured 7.8 m).
   r1c2 re-sweep 2026-08-05_165434: Mobile PET/CT Scanner — 108 returns,
   every one in the −1 m bin (explainRoof rule=p98 → −0.6); Apple shows
   temporary white gabled trailers/tents and a van in the Sulpizio /
   Altman courtyard, not a solid clinic. Sibling Mobile CT keeps its
   L1=3 for now (360 pts, half a real 2.1 m trailer plane).
   r1c1 pass-2 2026-08-05_165434: Amphitheater Kiosk — 17 non-ground
   returns inside the ring (explainRoof p98 → 2.0). Epstein Family
   Amphitheater is POST_2014 (opened 2022); Apple shows plaza furniture /
   umbrellas / amphitheater bowl / Mid-Coast trolley today, not a hall-
   scale roof. Extruding the L1=4.6 invents a box on a plaza. */
const NO_SOLID_ROOF = [
  { n: "Foodworx Dining Room", near: [1001.5, -109.3] },
  { n: "Mobile PET/CT Scanner", near: [1351.4, -42.2] },
  { n: "Amphitheater Kiosk", near: [806.6, -110.8] },
];

/* NESTED PLAZA PADS (r1c1 pass-2, 2026-08-05). The facilities extrusion
   layer sometimes ships a levels=1 plaza / podium ring on the SAME
   footprint as a taller sibling of the same building name. Pepper Canyon
   West's seven "PCWest" L1=3 pads sat under the L22 Rya tower (67.1) and
   the L4–L6 midrise wings — host rename handed both the student name, so
   the world extruded a 3 m phantom pad co-located with the real mass.
   UC Regents Jan 2022 + SDBJ confirm Rya is the finished 22-storey north
   tower; the L1 is a records duplicate, not a second building. Drop when
   a levels=1 mass samples ≥0.85 under a taller same-name sibling.
   Campus-wide scan found this class only at PCWest today; the rule is
   name-agnostic so a future twin is caught without a hand list. */
const NESTED_PLAZA_COVERAGE = 0.85;

function dmInRing(x, z, ring) {
  /* ring vertices are decimetre integers; x/z are metres. */
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0] / 10, zi = ring[i][1] / 10;
    const xj = ring[j][0] / 10, zj = ring[j][1] / 10;
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function ringCoverage(a, b, step = 2) {
  let hit = 0, n = 0;
  let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity;
  for (const [x, z] of a) {
    const X = x / 10, Z = z / 10;
    if (X < minx) minx = X; if (X > maxx) maxx = X;
    if (Z < minz) minz = Z; if (Z > maxz) maxz = Z;
  }
  for (let x = minx; x <= maxx; x += step) {
    for (let z = minz; z <= maxz; z += step) {
      if (!dmInRing(x, z, a)) continue;
      n++;
      if (dmInRing(x, z, b)) hit++;
    }
  }
  return n ? hit / n : 0;
}

function dropNestedPlazaPads(massing) {
  const drop = new Set();
  for (let i = 0; i < massing.length; i++) {
    const low = massing[i];
    if (low.levels !== 1 || !low.r?.[0]) continue;
    for (let j = 0; j < massing.length; j++) {
      if (i === j) continue;
      const tall = massing[j];
      if (tall.n !== low.n || !tall.r?.[0]) continue;
      if (tall.levels <= 1 || tall.h <= low.h + 2) continue;
      if (ringCoverage(low.r[0], tall.r[0]) >= NESTED_PLAZA_COVERAGE) {
        drop.add(i);
        break;
      }
    }
  }
  if (!drop.size) return massing;
  return massing.filter((_, i) => !drop.has(i));
}

/* CO-NAMED MICRO-SLIVERS (r1c1 pass-3, 2026-08-05). Sibling of nested-
   plaza, but coverage=0 so that rule cannot fire: facilities ships a
   tiny GIS ring (<50 m²) co-named with a much larger sibling nearby,
   outside the parent footprint. Bonner Hall's 22 m² east fringe wore
   the L4=17.1 record on a 3 m pavement pad (Nominatim amenity/parking;
   Apple centre grey asphalt). Student Center B's 16 m² canopy sliver
   kept the facilities name after the 777 m² mass was host-renamed to
   International Center West (Nominatim highway/Mandeville Lane; Apple
   centre dark canopy). Campus-wide scan of same-name pairs with
   tiny <50 m² and macro ≥5× found only these two. Better absent as a
   named hall than a records smear on pavement / canopy. */
const MICRO_SLIVER_AREA_M2 = 50;
const MICRO_SLIVER_RATIO = 5;
const MICRO_SLIVER_NEAR_M = 40;

function dmRingAreaM2(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return Math.abs(a) / 2 / 100; /* dm² → m² */
}

function dmRingCentroidM(ring) {
  let x = 0, z = 0;
  for (const [X, Z] of ring) { x += X / 10; z += Z / 10; }
  return [x / ring.length, z / ring.length];
}

function dropCoNamedMicroSlivers(massing) {
  const drop = new Set();
  const meta = massing.map((m) => {
    if (!m.r?.[0]) return null;
    const [cx, cz] = dmRingCentroidM(m.r[0]);
    return { a: dmRingAreaM2(m.r[0]), cx, cz };
  });
  for (let i = 0; i < massing.length; i++) {
    const tiny = massing[i];
    const tm = meta[i];
    if (!tiny.n || !tm || tm.a >= MICRO_SLIVER_AREA_M2) continue;
    for (let j = 0; j < massing.length; j++) {
      if (i === j) continue;
      const macro = massing[j];
      const mm = meta[j];
      if (!macro.n || macro.n !== tiny.n || !mm) continue;
      if (mm.a < tm.a * MICRO_SLIVER_RATIO) continue;
      if (Math.hypot(tm.cx - mm.cx, tm.cz - mm.cz) > MICRO_SLIVER_NEAR_M) continue;
      drop.add(i);
      break;
    }
  }
  if (!drop.size) return massing;
  return massing.filter((_, i) => !drop.has(i));
}

/* What the facilities inventory calls a mass -> the OSM building it IS.
   "Douglas Apartments" is Warren's Douglas Hall (the ring spans the hall
   and its east annex — one complex, one height class); without the OSM
   name the mass had no host, so its 18.3 m GIS record stood unchallenged
   (its own 2014 roof plane: 16.1 m) and the "Douglas Hall" label was
   orphaned. Renaming lets the LiDAR build key the epoch guard and the
   measurement off the OSM name, and the label ride the mass.
   "Black Apartments" is the same failure two hundred metres north-west
   (r1c1 judge sweep, 2026-08-04): OSM calls the U-shaped block over
   Canyonview "Black Hall", the mass's centroid lands in its own
   courtyard so no host was ever found, and the 18.3 m record shipped
   against a measured 16.1 m plane (5,446 returns, p98 16.1) — while the
   OSM ring, suppressed by coverage, took the "Black Hall" name down
   with it.
   "Fred N. Spiess Hall" (r2c0 judge sweep, 2026-08-05): OSM drops the
   honorific — "Spiess Hall" — and the mass's centroid lands outside the
   offset OSM ring, so neither host containment nor the exact-name twin
   ever fired and the 17.1 m record stood unchallenged over a measured
   14.3 m roof plane (6,133 returns, p98, no guard). */
const MASS_RENAMES = [
  { n: "Douglas Apartments", near: [769, -589], to: "Douglas Hall" },
  { n: "Black Apartments", near: [790, -451], to: "Black Hall" },
  { n: "Fred N. Spiess Hall", near: [-918, 990], to: "Spiess Hall" },
];

const massCorrection = (list, name, cx, cz) =>
  list.find((u) => u.n === name && Math.hypot(u.near[0] - cx, u.near[1] - cz) < 40);

function matchName(campusName, byNorm, exactClaimed) {
  const candidates = [campusName, ALIASES[campusName]].filter(Boolean).map(norm);
  /* EVERY exact candidate before ANY fuzzy one. Interleaved, "Biology"'s
     fuzzy pass startsWith-matched "Biology Field Station - Greenhouse 2"
     and returned before the alias "Biology Building" was ever tried — the
     right record existed and lost to a greenhouse on ordering. */
  for (const n of candidates) {
    if (byNorm.has(n)) return byNorm.get(n);
  }
  for (const n of candidates) {
    for (const [k, v] of byNorm) {
      /* A record some OSM name claims EXACTLY is that building's record —
         fuzzy may not take it. The prefix/suffix rules exist for honorific
         drift ("Fred N. Spiess Hall" -> "Spiess Hall"), but they also let a
         name that merely CONTAINS a real building's name walk off with its
         neighbour's storeys: "Hubbs Hall Confrence Center" (sic — the low
         conference annex) startsWith-matched "Hubbs Hall" and wore the
         four-storey record of the hall next door (r2c0 judge sweep,
         2026-08-05). */
      if (exactClaimed?.has(v)) continue;
      if (k.endsWith(` ${n}`) || n.endsWith(` ${k}`)) return v; // dropped honorific
      if (k.startsWith(`${n} `) || n.startsWith(`${k} `)) return v; // dropped suffix
    }
  }
  return null;
}

/* ----------------------------------------------------------------- build */

async function build() {
  const campus = JSON.parse(readFileSync(CAMPUS, "utf8"));
  const lidar = JSON.parse(readFileSync(LIDAR, "utf8"));
  const O = campus.origin;
  const toLocal = ([lng, lat]) => [
    (lng - O.lng) * O.mPerDegLng,
    -(lat - O.lat) * O.mPerDegLat,
  ];

  /* Clip to the terrain grid: an envelope INTERSECTS query returns all of
     Gilman Drive when it touches the corner of the box, and ground with no
     terrain under it drapes onto nothing. */
  const t = lidar.terrain;
  const box = {
    x0: t.x0, x1: t.x0 + (t.cols - 1) * t.cell,
    z0: t.z0, z1: t.z0 + (t.rows - 1) * t.cell,
  };

  console.log("fetching the ground plane…");
  const groundFeatures = await query(GROUND_URL, {
    where: `Type IN (${Object.keys(KINDS).map((k) => `'${k.replace(/'/g, "''")}'`).join(",")})`,
    geometry: `${AREA.west},${AREA.south},${AREA.east},${AREA.north}`,
    geometryType: "esriGeometryEnvelope", inSR: "4326",
    spatialRel: "esriSpatialRelIntersects", outFields: "Type",
  });
  console.log(`  ${groundFeatures.length} surface polygons`);

  const dm = (ring) => ring.map(([x, z]) => [Math.round(x * 10), Math.round(z * 10)]);
  const ground = [];
  for (const f of groundFeatures) {
    const kind = KINDS[f.properties?.Type];
    if (!kind || !f.geometry) continue;
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates]
      : f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [];
    for (const rings of polys) {
      const outer = simplify(clipRect(rings[0].map(toLocal), box.x0, box.z0, box.x1, box.z1));
      /* Sub-8 m² greenery is a kerbside sliver, not a planting bed. */
      const floor = kind === "green" ? 8 : MIN_AREA;
      if (outer.length < 3 || Math.abs(ringArea(outer)) < floor) continue;
      const piece = [dm(outer)];
      for (const h of rings.slice(1)) {
        const hc = simplify(clipRect(h.map(toLocal), box.x0, box.z0, box.x1, box.z1));
        if (hc.length >= 3 && Math.abs(ringArea(hc)) >= 0.5) piece.push(dm(hc));
      }
      ground.push({ k: kind, r: piece });
    }
  }

  console.log("fetching massing…");
  /* The extrusion layer is the university's CURRENT 3D massing: one polygon
     per MASS, not per building — "TDLLN - Sankofa Tower" (21 levels, 210 ft),
     "Sankofa Mid" and "Sankofa Base" are three records with three shapes.
     This matters twice over: it is the only source that gives multi-mass
     buildings their real form, and it is the only HEIGHT source with the
     right epoch — the LiDAR flew in 2014, before Sixth, Eighth, the Theatre
     District and North Torrey Pines existed, and "measures" Sankofa at the
     height of the parking lot it replaced. */
  const ext = await query(EXTRUSIONS_URL, { where: "1=1", outFields: "building,levels,bldght" });
  const massing = [];
  const byNorm = new Map();
  for (const f of ext) {
    const p = f.properties;
    if (!p?.building || !p.levels || !(p.bldght > 0) || !f.geometry) continue;
    const h = Math.round(p.bldght * FT * 10) / 10;
    const prev = byNorm.get(norm(p.building));
    /* The storeys map keys whole buildings; for a multi-mass complex keep
       the tallest mass — that is the building's height as anyone quotes it. */
    if (!prev || h > prev.height) {
      byNorm.set(norm(p.building), { levels: p.levels, height: h });
    }
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates]
      : f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [];
    for (const rings of polys) {
      const outer = rings[0].map(toLocal);
      if (Math.abs(ringArea(outer)) < 15) continue;
      const cx = outer.reduce((s, q) => s + q[0], 0) / outer.length;
      const cz = outer.reduce((s, q) => s + q[1], 0) / outer.length;
      if (cx < box.x0 || cx > box.x1 || cz < box.z0 || cz > box.z1) continue;
      if (massCorrection(UNION_OUTLINES, p.building, cx, cz)) continue;
      if (massCorrection(UNDER_RECONSTRUCTION, p.building, cx, cz)) continue;
      if (massCorrection(NO_SOLID_ROOF, p.building, cx, cz)) continue;
      const rename = massCorrection(MASS_RENAMES, p.building, cx, cz);
      massing.push({
        n: rename ? rename.to : p.building,
        h,
        levels: p.levels,
        r: rings.map((ring) => dm(ring.map(toLocal))).filter((ring) => ring.length >= 3),
      });
    }
  }
  const beforeFilter = massing.length;
  let filtered = dropNestedPlazaPads(massing);
  const afterNested = filtered.length;
  filtered = dropCoNamedMicroSlivers(filtered);
  massing.length = 0;
  massing.push(...filtered);
  const notes = [];
  if (beforeFilter > afterNested) {
    notes.push(`dropped ${beforeFilter - afterNested} nested L1 plaza pads`);
  }
  if (afterNested > filtered.length) {
    notes.push(`dropped ${afterNested - filtered.length} co-named micro-slivers`);
  }
  console.log(`  ${massing.length} massing parts` +
    (notes.length ? ` (${notes.join("; ")})` : ""));
  /* Geisel keeps its own per-floor layer — and unlike everything else, its
     GEOMETRY ships too. Geisel is not a prism: the drum steps out then back
     in as it rises, and the university's floor polygons are the only public
     vector source of that shape. The renderer stacks these instead of
     extruding the OSM footprint. */
  const geisel = await query(GEISEL_URL, { where: "1=1", outFields: "floorname,floor,height,absoluteheight" });
  let geiselFloors = [];
  if (geisel.length) {
    const top = Math.max(...geisel.map((f) => f.properties.absoluteheight + f.properties.height));
    byNorm.set(norm("Geisel Library"), {
      levels: new Set(geisel.map((f) => f.properties.floor)).size,
      height: Math.round(top * FT * 10) / 10,
    });
    geiselFloors = geisel
      .filter((f) => f.geometry?.type === "Polygon" || f.geometry?.type === "MultiPolygon")
      .map((f) => {
        const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
        return {
          name: f.properties.floorname,
          from: Math.round(f.properties.absoluteheight * FT * 10) / 10,
          h: Math.round(f.properties.height * FT * 10) / 10,
          rings: polys[0].map((ring) => dm(ring.map(toLocal))),
        };
      })
      .sort((a, b) => a.from - b.from);
  }

  const buildings = {};
  const unmatched = [];
  const rejected = [];
  /* Two passes over the names: register every EXACT claim first, so no
     fuzzy match can take a record whose building is on the map under the
     record's own name (see matchName). */
  const exactClaimed = new Set();
  for (const b of campus.buildings) {
    if (!b.n) continue;
    for (const cand of [b.n, ALIASES[b.n]].filter(Boolean).map(norm)) {
      const rec = byNorm.get(cand);
      if (rec) { exactClaimed.add(rec); break; }
    }
  }
  for (const b of campus.buildings) {
    if (!b.n) continue;
    const hit = matchName(b.n, byNorm, exactClaimed);
    if (!hit) { unmatched.push(b.n); continue; }
    /* A name match is a CLAIM, and LiDAR is the referee. Fuzzy matching once
       handed "Biology" the levels of a greenhouse at the Biology Field
       Station; and facilities lists several lecture halls at a generic
       14 ft. Either way, storeys that disagree with the measured height
       would paint floor lines on a building that does not have them — so a
       match only ships if the implied storey height is a storey. */
    const lidarH = lidar.heights[b.n];
    if (lidarH) {
      /* Three regimes, because the two sources have different EPOCHS:
         agreement -> both saw the same building, trust the pair; GIS far
         TALLER than LiDAR -> the building went up after the 2014 survey
         (Sankofa "measured" 8.4 m — the parking lot it replaced) and the
         university's current figure is the truth; LiDAR far taller than
         GIS -> a mis-join or canopy, reject. */
      const gisTaller = hit.height - lidarH > Math.max(8, 0.45 * lidarH);
      const lidarTaller = lidarH - hit.height > Math.max(8, 0.45 * lidarH);
      if (lidarTaller) {
        rejected.push(`${b.n} (GIS ${hit.height} m vs LiDAR ${lidarH} m)`);
        continue;
      }
      const checkH = gisTaller ? hit.height : lidarH;
      const storey = checkH / hit.levels;
      if (storey < 2.2 || storey > 6.5) { rejected.push(`${b.n} (${hit.levels} lv vs ${checkH} m)`); continue; }
      if (gisTaller) hit.newer = true; // renderer: use GIS height, not 2014 LiDAR
    } else if (hit.height && Math.abs(hit.height - (b.h ?? hit.height)) > Math.max(5, 0.4 * hit.height)) {
      rejected.push(`${b.n} (no LiDAR, OSM ${b.h} m vs GIS ${hit.height} m)`);
      continue;
    }
    buildings[b.n] = hit;
  }

  const out = {
    _: "Generated by scripts/build-campus-arcgis.mjs from UC San Diego's public campus GIS (admin-enterprise-gis.ucsd.edu + services9.arcgis.com). Unofficial use; do not hand-edit.",
    area: AREA,
    fetched: new Date().toISOString().slice(0, 10),
    ground,
    buildings,
    massing,
    geiselFloors,
  };
  writeFileSync(OUT, JSON.stringify(out));
  const kb = Math.round(readFileSync(OUT).length / 1024);
  console.log(`wrote ${OUT} — ${kb} KB`);
  console.log(`  ${ground.length} ground polygons, ${Object.keys(buildings).length}/${campus.buildings.filter((b) => b.n).length} named buildings with storeys`);
  console.log(`  unmatched: ${unmatched.slice(0, 12).join(", ")}${unmatched.length > 12 ? "…" : ""}`);
}

/* ----------------------------------------------------------------- check */

function check() {
  const data = JSON.parse(readFileSync(OUT, "utf8"));
  const kinds = new Set(Object.values(KINDS));
  let bad = 0;
  for (const g of data.ground) {
    if (!kinds.has(g.k) || !g.r?.length || g.r[0].length < 3) bad++;
    for (const ring of g.r) {
      for (const [x, z] of ring) {
        if (!Number.isInteger(x) || !Number.isInteger(z)) bad++;
      }
    }
  }
  if (bad) throw new Error(`${bad} malformed ground pieces`);
  if (data.ground.length < 300) throw new Error(`only ${data.ground.length} ground polygons`);
  if (Object.keys(data.buildings).length < 40) throw new Error("too few storey matches");
  console.log(`ok: ${data.ground.length} ground polygons, ${Object.keys(data.buildings).length} buildings with storeys`);
}

if (CHECK) check();
else await build();
