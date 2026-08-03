#!/usr/bin/env node
// Build the photoreal ground layer:
//
//   docs/data/campus-boundary.json   the official campus boundary polygon,
//                                    from OSM's university area, in local
//                                    metres. Schema: { points: [[x,z],...] }
//                                    — the main outer ring, closed (first ==
//                                    last) — plus `rings` with every outer
//                                    ring for completeness.
//
//   docs/data/textures/chunk_C_R.jpg satellite imagery, reprojected from Web
//                                    Mercator tiles onto the site's local
//                                    metre grid, cut on the same chunk grid
//                                    the renderer cuts the terrain mesh on
//                                    (docs/js/campus-ground.js is the single
//                                    source of that rule).
//
//   docs/data/textures/manifest.json each chunk's exact local-space rect.
//
// Imagery comes from the Google Map Tiles API (2D satellite session). Pixels
// outside the campus boundary polygon are painted the site's stylized ground
// colour at build time, so the renderer needs no per-pixel clipping: inside
// the boundary you see the real ground, outside it the stylized campus,
// exactly at the surveyed line.
//
// The API key is read from .env at build time and appears in no output file.
// Raw tiles are cached under .cache/ (gitignored) so a rerun refetches nothing.
//
// Usage:
//   node scripts/build-campus-satellite.mjs            # fetch + write
//   node scripts/build-campus-satellite.mjs --check    # verify shipped files, no network
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  chunkGrid, pointInRings, rectIntersectsRings,
} from "../docs/js/campus-ground.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BOUNDARY_OUT = path.join(ROOT, "docs/data/campus-boundary.json");
const TEX_DIR = path.join(ROOT, "docs/data/textures");
const CACHE = path.join(ROOT, ".cache/satellite");
const CHECK = process.argv.includes("--check");

const CAMPUS = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/data/campus-3d.json"), "utf8"));
const LIDAR = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/data/campus-lidar.json"), "utf8"));
const { lat: LAT0, lng: LNG0, mPerDegLat: M_LAT, mPerDegLng: M_LNG } = CAMPUS.origin;

/* Local metres <-> WGS84, the same flat projection the data was built with. */
const toLocal = (lat, lng) => [(lng - LNG0) * M_LNG, -(lat - LAT0) * M_LAT];
const toLat = (z) => LAT0 - z / M_LAT;
const toLng = (x) => LNG0 + x / M_LNG;
const round1 = (n) => Math.round(n * 10) / 10;

/* WGS84 <-> Web Mercator pixels at zoom z (256 px tiles). */
const worldPx = (zoom) => 256 * 2 ** zoom;
const mercX = (lng, zoom) => ((lng + 180) / 360) * worldPx(zoom);
function mercY(lat, zoom) {
  const s = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * worldPx(zoom);
}
const mercYToLat = (my, zoom) =>
  (Math.atan(Math.sinh(Math.PI * (1 - (2 * my) / worldPx(zoom)))) * 180) / Math.PI;
const mercXToLng = (mx, zoom) => (mx / worldPx(zoom)) * 360 - 180;

/* Rendering constants shared with campus-world.js. */
const GROUND_RGB = [0x93, 0xa0, 0x6d]; // GROUND_COLOR, baked outside the boundary
const BASE_ZOOM = 19;                  // ~0.25 m/px here
const FINE_ZOOM = 20;                  // ~0.125 m/px, over fields and plazas
const PPM = { [BASE_ZOOM]: 4, [FINE_ZOOM]: 8 }; // output px per metre
const TILE_CAP = 3500;
const TILE_MARGIN_M = 40;              // fetch a little past the boundary; mask exactly

/* ------------------------------------------------------------- the boundary */

const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
/* Tag filters BEFORE the bbox, or Overpass answers 406. */
const BOUNDARY_QUERY = `[out:json][timeout:180];
(
  relation["amenity"="university"]["name"="University of California, San Diego"](32.83,-117.28,32.92,-117.19);
  way["amenity"="university"]["name"="University of California, San Diego"](32.83,-117.28,32.92,-117.19);
);
out geom;`;

async function fetchOverpass(query) {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const endpoint of OVERPASS) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "User-Agent": "campus-walk satellite build (github.com/SahirSSharma)" },
          body: new URLSearchParams({ data: query }),
        });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const json = await res.json();
        if (!json.elements?.length) throw new Error("no elements");
        console.log(`  boundary via ${new URL(endpoint).host}`);
        return json.elements;
      } catch (err) {
        lastErr = err;
        console.log(`  ${new URL(endpoint).host}: ${err.message}`);
        await new Promise((r) => setTimeout(r, 3000 + attempt * 10000));
      }
    }
  }
  throw new Error(`every Overpass mirror failed — last: ${lastErr.message}`);
}

/* Stitch a relation's outer ways into closed rings by matching endpoints.
   Shared nodes arrive with bit-identical coordinates, so string keys work. */
function assembleRings(elements) {
  const rings = [];
  const pieces = [];
  for (const el of elements) {
    if (el.type === "way" && el.geometry?.length >= 4) {
      const pts = el.geometry.map((g) => [g.lat, g.lon]);
      const k = (p) => `${p[0]},${p[1]}`;
      if (k(pts[0]) === k(pts[pts.length - 1])) rings.push(pts);
      else pieces.push(pts);
    } else if (el.type === "relation") {
      for (const m of el.members || []) {
        if (m.type !== "way" || !m.geometry?.length) continue;
        if (m.role && m.role !== "outer") continue; // holes are not the campus edge
        pieces.push(m.geometry.map((g) => [g.lat, g.lon]));
      }
    }
  }
  const key = (p) => `${p[0].toFixed(7)},${p[1].toFixed(7)}`;
  while (pieces.length) {
    const ring = pieces.shift().slice();
    let grew = true;
    while (grew && key(ring[0]) !== key(ring[ring.length - 1])) {
      grew = false;
      const tail = key(ring[ring.length - 1]);
      for (let i = 0; i < pieces.length; i++) {
        const p = pieces[i];
        if (key(p[0]) === tail) { ring.push(...p.slice(1)); pieces.splice(i, 1); grew = true; break; }
        if (key(p[p.length - 1]) === tail) {
          ring.push(...p.slice(0, -1).reverse()); pieces.splice(i, 1); grew = true; break;
        }
      }
    }
    if (key(ring[0]) === key(ring[ring.length - 1]) && ring.length >= 4) rings.push(ring);
  }
  return rings;
}

const ringArea = (ring) => {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return Math.abs(a / 2);
};

async function buildBoundary() {
  console.log("fetching the campus boundary from Overpass…");
  const elements = await fetchOverpass(BOUNDARY_QUERY);
  const latLngRings = assembleRings(elements);
  const localRings = latLngRings
    .map((ring) => ring.map(([lat, lng]) => toLocal(lat, lng).map(round1)))
    .filter((ring) => ringArea(ring) > 50000); // drop slivers; campus rings are km²-scale
  if (!localRings.length) throw new Error("no closed boundary ring found in Overpass answer");
  localRings.sort((a, b) => ringArea(b) - ringArea(a));
  for (const ring of localRings) {
    const [fx, fz] = ring[0];
    const [lx, lz] = ring[ring.length - 1];
    if (fx !== lx || fz !== lz) ring.push([fx, fz]); // closed, first === last
  }
  const data = {
    _: "Generated by scripts/build-campus-satellite.mjs from OpenStreetMap (ODbL). Do not hand-edit.",
    schema:
      "points: the main campus outer ring, closed (first == last), local metres [x, z] " +
      "(+x east, +z south, same frame as campus-3d.json). rings: every outer ring, same format.",
    origin: CAMPUS.origin,
    points: localRings[0],
    rings: localRings,
  };
  fs.writeFileSync(BOUNDARY_OUT, JSON.stringify(data));
  console.log(
    `wrote ${BOUNDARY_OUT} — ${localRings.length} ring(s), main ring ${localRings[0].length} points, ` +
    `${Math.round(ringArea(localRings[0]) / 1e4) / 100} km²`
  );
  return data;
}

/* ------------------------------------------------------------------- tiles */

function readKey() {
  const env = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
  const m = env.match(/^GOOGLE_MAPS_API_KEY=(.+)$/m);
  if (!m) throw new Error("GOOGLE_MAPS_API_KEY missing from .env");
  return m[1].trim();
}

let tileRequests = 0;
let sessionToken = null;
let useStaticFallback = false;

async function getSession(key) {
  const cacheFile = path.join(CACHE, "session.json");
  try {
    const c = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
    if (Number(c.expiry) * 1000 > Date.now() + 600000) return c.session;
  } catch { /* no cached session */ }
  const res = await fetch(`https://tile.googleapis.com/v1/createSession?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mapType: "satellite", language: "en-US", region: "US" }),
  });
  if (!res.ok) throw new Error(`createSession ${res.status}: ${await res.text()}`);
  const json = await res.json();
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify(json));
  return json.session;
}

function tileUrl(zoom, x, y, key) {
  if (!useStaticFallback) {
    return `https://tile.googleapis.com/v1/2dtiles/${zoom}/${x}/${y}?session=${sessionToken}&key=${key}`;
  }
  /* Static Maps fallback: a 256 px map centred on the tile centre at integer
     zoom is pixel-identical to the tile (minus the burned-in attribution). */
  const lat = mercYToLat((y + 0.5) * 256, zoom);
  const lng = mercXToLng((x + 0.5) * 256, zoom);
  return (
    `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}` +
    `&zoom=${zoom}&size=256x256&maptype=satellite&key=${key}`
  );
}

async function fetchTile(zoom, x, y, key) {
  const file = path.join(CACHE, `z${zoom}`, `${x}_${y}.jpg`);
  if (fs.existsSync(file)) return file;
  if (tileRequests >= TILE_CAP) throw new Error(`tile cap of ${TILE_CAP} requests reached`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (let attempt = 0; ; attempt++) {
    tileRequests++;
    const res = await fetch(tileUrl(zoom, x, y, key));
    if (res.ok) {
      fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      return file;
    }
    if (attempt >= 2) throw new Error(`tile ${zoom}/${x}/${y}: ${res.status} ${res.statusText}`);
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
}

/* Local-space rect of a Mercator tile (north edge = smaller z). */
function tileLocalRect(zoom, x, y) {
  const x0 = toLocal(0, mercXToLng(x * 256, zoom))[0];
  const x1 = toLocal(0, mercXToLng((x + 1) * 256, zoom))[0];
  const z0 = toLocal(mercYToLat(y * 256, zoom), 0)[1];
  const z1 = toLocal(mercYToLat((y + 1) * 256, zoom), 0)[1];
  return [x0, z0, x1, z1];
}

/* ------------------------------------------------------- chunk construction */

/** Sports fields and major plazas earn zoom 20: big named plazas plus any
 *  green over 5000 m² (the recreation fields — surface markings are the whole
 *  point of the higher zoom). */
function fineAreas() {
  const areas = [];
  for (const s of CAMPUS.surfaces || []) {
    const isField = s.kind === "green" && ringArea(s.p) >= 5000;
    const isPlaza = s.kind === "plaza" && s.n;
    if (!isField && !isPlaza) continue;
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const [x, z] of s.p) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      z0 = Math.min(z0, z); z1 = Math.max(z1, z);
    }
    areas.push([x0, z0, x1, z1]);
  }
  return areas;
}

const rectsTouch = (a, b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

async function buildChunk(sharp, chunk, zoom, rings, key) {
  const ppm = PPM[zoom];
  const w = Math.round((chunk.x1 - chunk.x0) * ppm);
  const h = Math.round((chunk.z1 - chunk.z0) * ppm);

  /* Which tiles this chunk needs. Skip tiles that miss the boundary polygon
     (by more than the margin) — their pixels are masked to ground colour. */
  const mxA = mercX(toLng(chunk.x0), zoom) - 2;
  const mxB = mercX(toLng(chunk.x1), zoom) + 2;
  const myA = mercY(toLat(chunk.z0), zoom) - 2;
  const myB = mercY(toLat(chunk.z1), zoom) + 2;
  const tx0 = Math.floor(mxA / 256), tx1 = Math.floor(mxB / 256);
  const ty0 = Math.floor(myA / 256), ty1 = Math.floor(myB / 256);

  const mosaicW = (tx1 - tx0 + 1) * 256;
  const mosaicH = (ty1 - ty0 + 1) * 256;
  const layers = [];
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const [rx0, rz0, rx1, rz1] = tileLocalRect(zoom, tx, ty);
      const m = TILE_MARGIN_M;
      if (!rectIntersectsRings(rx0 - m, rz0 - m, rx1 + m, rz1 + m, rings)) continue;
      const file = await fetchTile(zoom, tx, ty, key);
      layers.push({ input: file, left: (tx - tx0) * 256, top: (ty - ty0) * 256 });
    }
  }
  /* NOTE: composite() can promote the buffer to 4 channels regardless of the
     3-channel create() — read the real channel count back and use it as the
     pixel stride, or every sample lands one channel off and the imagery
     shreds into grey moiré (which is exactly what the first run produced). */
  const { data: mosaic, info: mosaicInfo } = await sharp({
    create: {
      width: mosaicW, height: mosaicH, channels: 3,
      background: { r: GROUND_RGB[0], g: GROUND_RGB[1], b: GROUND_RGB[2] },
    },
  }).composite(layers).raw().toBuffer({ resolveWithObject: true });
  const MC = mosaicInfo.channels;

  /* Reproject: the local frame is linear in lat/lng, so the source Mercator
     coordinate is separable — one my per output row, one mx per column. */
  const sx = new Float64Array(w);
  for (let px = 0; px < w; px++) {
    sx[px] = mercX(toLng(chunk.x0 + (px + 0.5) / ppm), zoom) - tx0 * 256 - 0.5;
  }
  const out = Buffer.allocUnsafe(w * h * 3);
  for (let py = 0; py < h; py++) {
    const z = chunk.z0 + (py + 0.5) / ppm;
    const sy = mercY(toLat(z), zoom) - ty0 * 256 - 0.5;
    const y0 = Math.max(0, Math.min(mosaicH - 1, Math.floor(sy)));
    const y1 = Math.min(mosaicH - 1, y0 + 1);
    const fy = Math.max(0, Math.min(1, sy - y0));

    /* Inside-the-boundary spans for this row, in output pixels. */
    const cuts = [];
    for (const ring of rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [ax, az] = ring[j];
        const [bx, bz] = ring[i];
        if (az > z === bz > z) continue;
        cuts.push(ax + ((z - az) / (bz - az)) * (bx - ax));
      }
    }
    cuts.sort((a, b) => a - b);

    for (let px = 0; px < w; px++) {
      const o = (py * w + px) * 3;
      const x = chunk.x0 + (px + 0.5) / ppm;
      let inside = false;
      for (let i = 0; i < cuts.length && cuts[i] < x; i++) inside = !inside;
      if (!inside) {
        out[o] = GROUND_RGB[0]; out[o + 1] = GROUND_RGB[1]; out[o + 2] = GROUND_RGB[2];
        continue;
      }
      const sxx = sx[px];
      const x0i = Math.max(0, Math.min(mosaicW - 1, Math.floor(sxx)));
      const x1i = Math.min(mosaicW - 1, x0i + 1);
      const fx = Math.max(0, Math.min(1, sxx - x0i));
      for (let ch = 0; ch < 3; ch++) {
        const tl = mosaic[(y0 * mosaicW + x0i) * MC + ch];
        const tr = mosaic[(y0 * mosaicW + x1i) * MC + ch];
        const bl = mosaic[(y1 * mosaicW + x0i) * MC + ch];
        const br = mosaic[(y1 * mosaicW + x1i) * MC + ch];
        out[o + ch] = Math.round(
          tl * (1 - fx) * (1 - fy) + tr * fx * (1 - fy) + bl * (1 - fx) * fy + br * fx * fy
        );
      }
    }
  }

  const file = `chunk_${chunk.ci}_${chunk.ri}.jpg`;
  await sharp(out, { raw: { width: w, height: h, channels: 3 } })
    .jpeg({ quality: 80, mozjpeg: true })
    .toFile(path.join(TEX_DIR, file));
  return {
    file, ci: chunk.ci, ri: chunk.ri, zoom, w, h,
    x0: chunk.x0, z0: chunk.z0, x1: chunk.x1, z1: chunk.z1,
  };
}

/* -------------------------------------------------------------------- main */

async function build() {
  const key = readKey();
  const { default: sharp } = await import("sharp");
  const boundary = await buildBoundary();
  const rings = boundary.rings;

  try {
    sessionToken = await getSession(key);
  } catch (err) {
    console.log(`Map Tiles session failed (${err.message}); falling back to Static Maps`);
    useStaticFallback = true;
  }

  fs.mkdirSync(TEX_DIR, { recursive: true });
  const fine = fineAreas();
  const chunks = chunkGrid(LIDAR.terrain);
  const manifest = [];
  for (const chunk of chunks) {
    const rect = [chunk.x0, chunk.z0, chunk.x1, chunk.z1];
    const zoom = fine.some((a) => rectsTouch(a, rect)) ? FINE_ZOOM : BASE_ZOOM;
    const entry = await buildChunk(sharp, chunk, zoom, rings, key);
    manifest.push(entry);
    console.log(
      `  ${entry.file} z${zoom} ${entry.w}x${entry.h}px ` +
      `(${tileRequests} tile requests so far)`
    );
  }

  const manifestData = {
    _: "Generated by scripts/build-campus-satellite.mjs. Do not hand-edit.",
    attribution: "Imagery © Google",
    groundColor: "#93a06d",
    origin: CAMPUS.origin,
    generated: new Date().toISOString().slice(0, 10),
    chunks: manifest,
  };
  fs.writeFileSync(path.join(TEX_DIR, "manifest.json"), JSON.stringify(manifestData));

  const bytes = manifest.reduce(
    (n, c) => n + fs.statSync(path.join(TEX_DIR, c.file)).size, 0
  );
  console.log(
    `wrote ${manifest.length} chunks, ${(bytes / 1048576).toFixed(1)} MB of textures, ` +
    `${tileRequests} tile requests (cap ${TILE_CAP})`
  );
}

/* Verify the shipped files without touching the network. */
function check() {
  const boundary = JSON.parse(fs.readFileSync(BOUNDARY_OUT, "utf8"));
  const pts = boundary.points;
  if (!Array.isArray(pts) || pts.length < 4) throw new Error("boundary: too few points");
  const [f, l] = [pts[0], pts[pts.length - 1]];
  if (f[0] !== l[0] || f[1] !== l[1]) throw new Error("boundary: ring not closed");
  const manifest = JSON.parse(fs.readFileSync(path.join(TEX_DIR, "manifest.json"), "utf8"));
  const expected = chunkGrid(LIDAR.terrain);
  if (manifest.chunks.length !== expected.length) {
    throw new Error(`manifest: ${manifest.chunks.length} chunks, terrain wants ${expected.length}`);
  }
  let bytes = 0;
  for (const c of manifest.chunks) {
    const p = path.join(TEX_DIR, c.file);
    if (!fs.existsSync(p)) throw new Error(`manifest: missing ${c.file}`);
    bytes += fs.statSync(p).size;
  }
  if (bytes > 90 * 1048576) throw new Error(`textures over budget: ${bytes} bytes`);
  console.log(
    `campus-boundary.json OK — ${boundary.rings.length} ring(s), ${pts.length} points; ` +
    `textures OK — ${manifest.chunks.length} chunks, ${(bytes / 1048576).toFixed(1)} MB`
  );
}

(CHECK ? Promise.resolve().then(check) : build()).catch((err) => {
  console.error(err.message);
  process.exit(1);
});
