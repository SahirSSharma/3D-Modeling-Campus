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

function matchName(campusName, byNorm) {
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
      massing.push({
        n: p.building,
        h,
        levels: p.levels,
        r: rings.map((ring) => dm(ring.map(toLocal))).filter((ring) => ring.length >= 3),
      });
    }
  }
  console.log(`  ${massing.length} massing parts`);
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
  for (const b of campus.buildings) {
    if (!b.n) continue;
    const hit = matchName(b.n, byNorm);
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
