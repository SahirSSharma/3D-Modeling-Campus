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
//                                    (docs/js/campus-terrain.js is the single
//                                    source of that rule).
//
//   docs/data/textures/manifest.json each chunk's exact local-space rect.
//
// WHICH IMAGERY. The source is a provider (scripts/lib/imagery.mjs), chosen
// with --source. `google` is the Map Tiles API's 2D satellite session: 256 px
// Web Mercator tiles, one image pixel per Mercator pixel. `apple` is the Maps
// Web Snapshot service, requested at scale=2 — the same Mercator grid at TWICE
// the linear resolution, which is the only reason to prefer it. Everything
// downstream of this script is source-agnostic: the chunks and the manifest
// have the same shape either way, and only the manifest's provenance changes.
//
// Pixels outside the campus boundary polygon are painted the site's stylized
// ground colour at build time, so the renderer needs no per-pixel clipping:
// inside the boundary you see the real ground, outside it the stylized campus,
// exactly at the surveyed line.
//
// Credentials are read from .env at build time and appear in no output file.
// Raw patches are cached under .cache/<source>/ (gitignored) so a rerun
// refetches nothing, and each source caches separately so switching back and
// forth costs no requests.
//
// Usage:
//   node scripts/build-campus-satellite.mjs                  # fetch + write
//   node scripts/build-campus-satellite.mjs --source=apple   # Apple imagery
//   node scripts/build-campus-satellite.mjs --check          # verify shipped files, no network
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  chunkGrid, pointInRings, rectIntersectsRings,
} from "../docs/js/campus-terrain.js";
import {
  makeProvider, PROVIDERS, mercX, mercY, mercXToLng, mercYToLat, mPerMercPx,
} from "./lib/imagery.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BOUNDARY_OUT = path.join(ROOT, "docs/data/campus-boundary.json");
const TEX_DIR = path.join(ROOT, "docs/data/textures");
const CHECK = process.argv.includes("--check");
const SOURCE = (process.argv.find((a) => a.startsWith("--source=")) || "--source=google").slice(9);
const CACHE = path.join(ROOT, ".cache", SOURCE === "google" ? "satellite" : SOURCE);

const CAMPUS = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/data/campus-3d.json"), "utf8"));
const LIDAR = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/data/campus-lidar.json"), "utf8"));
/* Optional: the NAIP colour grid. Outside the boundary the chunk pixels are
   painted with it, so a chunk that straddles the boundary blends into the
   NAIP-coloured terrain around it instead of ringing the campus in flat
   invented green. Absent, the flat colour is the fallback. */
let NAIP = null;
try {
  const colors = JSON.parse(
    fs.readFileSync(path.join(ROOT, "docs/data/campus-colors.json"), "utf8")
  );
  if (colors?.terrain?.idx) {
    const ct = colors.terrain;
    NAIP = {
      ...ct,
      idx: Uint8Array.from(Buffer.from(ct.idx, "base64")),
      rgb: ct.palette.map((hex) => [
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16),
      ]),
    };
  }
} catch { /* no colour grid in this checkout */ }

function outsideFill(x, z) {
  if (!NAIP) return GROUND_RGB;
  const cc = Math.max(0, Math.min(NAIP.cols - 1, Math.round((x - NAIP.x0) / NAIP.cell)));
  const rr = Math.max(0, Math.min(NAIP.rows - 1, Math.round((z - NAIP.z0) / NAIP.cell)));
  const k = NAIP.idx[rr * NAIP.cols + cc];
  return k === 255 ? GROUND_RGB : NAIP.rgb[k] || GROUND_RGB;
}
const { lat: LAT0, lng: LNG0, mPerDegLat: M_LAT, mPerDegLng: M_LNG } = CAMPUS.origin;

/* Local metres <-> WGS84, the same flat projection the data was built with. */
const toLocal = (lat, lng) => [(lng - LNG0) * M_LNG, -(lat - LAT0) * M_LAT];
const toLat = (z) => LAT0 - z / M_LAT;
const toLng = (x) => LNG0 + x / M_LNG;
const round1 = (n) => Math.round(n * 10) / 10;

/* WGS84 <-> Web Mercator pixels live in scripts/lib/imagery.mjs, so the
   provider and the reprojection can never disagree about the grid. */

/* Rendering constants shared with campus-world.js. */
const GROUND_RGB = [0x93, 0xa0, 0x6d]; // GROUND_COLOR, baked outside the boundary
const BASE_ZOOM = 19;                  // ~0.25 m/px of Mercator grid here
const FINE_ZOOM = 20;                  // ~0.125 m/px, over fields and plazas
/* Output resolution per zoom, in chunk pixels per METRE. Deliberately NOT
   raised for a finer source: a source swap should change how good the pixels
   are, not how many, so the shipped geometry stays comparable and the audit
   measures one variable. A denser source is spent on supersampling instead. */
const PPM = { [BASE_ZOOM]: 4, [FINE_ZOOM]: 8 };
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

let provider = null;

/* Local-space rect of a patch of Mercator pixels (north edge = smaller z). */
function mercLocalRect(zoom, mx0, my0, span) {
  const x0 = toLocal(0, mercXToLng(mx0, zoom))[0];
  const x1 = toLocal(0, mercXToLng(mx0 + span, zoom))[0];
  const z0 = toLocal(mercYToLat(my0, zoom), 0)[1];
  const z1 = toLocal(mercYToLat(my0 + span, zoom), 0)[1];
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

async function buildChunk(sharp, chunk, zoom, rings) {
  const ppm = PPM[zoom];
  const subPx = provider.subPx;
  const w = Math.round((chunk.x1 - chunk.x0) * ppm);
  const h = Math.round((chunk.z1 - chunk.z0) * ppm);

  /* Which source patches this chunk needs. Skip patches that miss the boundary
     polygon (by more than the margin) — their pixels are masked to ground
     colour anyway, and not fetching them is most of what keeps a rebuild
     inside its request cap. */
  const mxA = mercX(toLng(chunk.x0), zoom) - 2;
  const mxB = mercX(toLng(chunk.x1), zoom) + 2;
  const myA = mercY(toLat(chunk.z0), zoom) - 2;
  const myB = mercY(toLat(chunk.z1), zoom) + 2;

  const patches = provider.patchesFor(zoom, mxA, mxB, myA, myB);
  /* The mosaic spans the whole patch lattice rect, skipped patches included —
     they simply stay ground colour, so offsets never shift under a skip. */
  let ox = Infinity, oy = Infinity, ex = -Infinity, ey = -Infinity;
  for (const p of patches) {
    ox = Math.min(ox, p.mx0); oy = Math.min(oy, p.my0);
    ex = Math.max(ex, p.mx0 + p.span); ey = Math.max(ey, p.my0 + p.span);
  }
  const mosaicW = Math.round((ex - ox) * subPx);
  const mosaicH = Math.round((ey - oy) * subPx);

  const layers = [];
  for (const p of patches) {
    const [rx0, rz0, rx1, rz1] = mercLocalRect(zoom, p.mx0, p.my0, p.span);
    const m = TILE_MARGIN_M;
    if (!rectIntersectsRings(rx0 - m, rz0 - m, rx1 + m, rz1 + m, rings)) continue;
    const file = await provider.fetchPatch(zoom, p);
    layers.push({
      input: file,
      left: Math.round((p.mx0 - ox) * subPx),
      top: Math.round((p.my0 - oy) * subPx),
    });
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

  /* SUPERSAMPLING. A source finer than the output has to be AVERAGED down, not
     point-sampled, or its extra resolution arrives as aliasing rather than as
     accuracy — a half-metre kerb would flicker in or out of a colour median
     depending on where the grid happened to land. k is how many source pixels
     span one output pixel: 1 for Google (its tiles already match this output
     scale, so the Google path stays exactly the arithmetic that shipped), 2
     for an Apple snapshot at scale=2. */
  const mPerSrcPx = mPerMercPx(zoom, LAT0) / subPx;
  const k = Math.max(1, Math.round(1 / ppm / mPerSrcPx));
  const kk = k * k;

  /* Reproject: the local frame is linear in lat/lng, so the source Mercator
     coordinate is separable — one my per (sub)row, one mx per (sub)column. */
  const sx = new Float64Array(w * k);
  for (let i = 0; i < w * k; i++) {
    sx[i] = (mercX(toLng(chunk.x0 + (i + 0.5) / (ppm * k)), zoom) - ox) * subPx - 0.5;
  }
  const sy = new Float64Array(k);
  const out = Buffer.allocUnsafe(w * h * 3);
  const acc = new Float64Array(w * 3);

  for (let py = 0; py < h; py++) {
    const z = chunk.z0 + (py + 0.5) / ppm; // row centre: masking and fill
    for (let j = 0; j < k; j++) {
      const zj = chunk.z0 + (py * k + j + 0.5) / (ppm * k);
      sy[j] = (mercY(toLat(zj), zoom) - oy) * subPx - 0.5;
    }

    /* Inside-the-boundary spans for this row, in output pixels. */
    const cuts = [];
    for (const ring of rings) {
      for (let i = 0, jj = ring.length - 1; i < ring.length; jj = i++) {
        const [ax, az] = ring[jj];
        const [bx, bz] = ring[i];
        if (az > z === bz > z) continue;
        cuts.push(ax + ((z - az) / (bz - az)) * (bx - ax));
      }
    }
    cuts.sort((a, b) => a - b);

    acc.fill(0);
    for (let j = 0; j < k; j++) {
      const syy = sy[j];
      const y0 = Math.max(0, Math.min(mosaicH - 1, Math.floor(syy)));
      const y1 = Math.min(mosaicH - 1, y0 + 1);
      const fy = Math.max(0, Math.min(1, syy - y0));
      for (let px = 0; px < w; px++) {
        for (let i = 0; i < k; i++) {
          const sxx = sx[px * k + i];
          const x0i = Math.max(0, Math.min(mosaicW - 1, Math.floor(sxx)));
          const x1i = Math.min(mosaicW - 1, x0i + 1);
          const fx = Math.max(0, Math.min(1, sxx - x0i));
          for (let ch = 0; ch < 3; ch++) {
            const tl = mosaic[(y0 * mosaicW + x0i) * MC + ch];
            const tr = mosaic[(y0 * mosaicW + x1i) * MC + ch];
            const bl = mosaic[(y1 * mosaicW + x0i) * MC + ch];
            const br = mosaic[(y1 * mosaicW + x1i) * MC + ch];
            acc[px * 3 + ch] +=
              tl * (1 - fx) * (1 - fy) + tr * fx * (1 - fy) + bl * (1 - fx) * fy + br * fx * fy;
          }
        }
      }
    }

    for (let px = 0; px < w; px++) {
      const o = (py * w + px) * 3;
      const x = chunk.x0 + (px + 0.5) / ppm;
      let inside = false;
      for (let i = 0; i < cuts.length && cuts[i] < x; i++) inside = !inside;
      if (!inside) {
        const [fr, fg, fb] = outsideFill(x, z);
        out[o] = fr; out[o + 1] = fg; out[o + 2] = fb;
        continue;
      }
      out[o] = Math.round(acc[px * 3] / kk);
      out[o + 1] = Math.round(acc[px * 3 + 1] / kk);
      out[o + 2] = Math.round(acc[px * 3 + 2] / kk);
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
  const { default: sharp } = await import("sharp");
  provider = makeProvider(SOURCE, { root: ROOT, cacheDir: CACHE, cap: TILE_CAP });
  await provider.prepare();
  console.log(
    `imagery source: ${provider.id} — ${provider.attribution}, ` +
    `${(mPerMercPx(BASE_ZOOM, LAT0) / provider.subPx).toFixed(3)} m/px at z${BASE_ZOOM}, ` +
    `${(mPerMercPx(FINE_ZOOM, LAT0) / provider.subPx).toFixed(3)} m/px at z${FINE_ZOOM}`
  );

  const boundary = await buildBoundary();
  const rings = boundary.rings;

  fs.mkdirSync(TEX_DIR, { recursive: true });
  /* Old chunk files from a previous grid must not survive as orphans. */
  for (const f of fs.readdirSync(TEX_DIR)) {
    if (f.startsWith("chunk_")) fs.unlinkSync(path.join(TEX_DIR, f));
  }
  const fine = fineAreas();
  const chunks = chunkGrid(LIDAR.terrain);
  const manifest = [];
  for (const chunk of chunks) {
    /* Chunks that never touch the boundary polygon get no imagery at all —
       the renderer keeps its NAIP-coloured terrain there. Only intersecting
       chunks are built and listed. */
    if (!rectIntersectsRings(chunk.x0, chunk.z0, chunk.x1, chunk.z1, rings)) continue;
    const rect = [chunk.x0, chunk.z0, chunk.x1, chunk.z1];
    const zoom = fine.some((a) => rectsTouch(a, rect)) ? FINE_ZOOM : BASE_ZOOM;
    const entry = await buildChunk(sharp, chunk, zoom, rings);
    manifest.push(entry);
    console.log(
      `  ${entry.file} z${zoom} ${entry.w}x${entry.h}px ` +
      `(${provider.requests} source requests so far)`
    );
  }

  const manifestData = {
    _: "Generated by scripts/build-campus-satellite.mjs. Do not hand-edit.",
    /* PROVENANCE. Every downstream measurement — campus-truecolor.json,
       campus-markings.json, the accuracy audits — inherits whichever imagery
       built these chunks, so the manifest names it and states how fine it
       was. Reading a colour file without knowing what it was measured from is
       how two epochs get blended by accident. */
    source: provider.id,
    attribution: provider.attribution,
    sourceMPerPx: {
      [BASE_ZOOM]: Number((mPerMercPx(BASE_ZOOM, LAT0) / provider.subPx).toFixed(4)),
      [FINE_ZOOM]: Number((mPerMercPx(FINE_ZOOM, LAT0) / provider.subPx).toFixed(4)),
    },
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
    `wrote ${manifest.length} chunks from ${provider.id}, ${(bytes / 1048576).toFixed(1)} MB of ` +
    `textures, ${provider.requests} source requests (cap ${TILE_CAP})`
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
  /* Provenance is not optional: everything measured from these chunks quotes
     it, and an unattributed chunk set cannot be credited or re-derived. */
  if (!manifest.attribution) throw new Error("manifest: no attribution");
  if (manifest.source && !(manifest.source in PROVIDERS)) {
    throw new Error(`manifest: unknown source "${manifest.source}"`);
  }
  const expected = chunkGrid(LIDAR.terrain).filter((c) =>
    rectIntersectsRings(c.x0, c.z0, c.x1, c.z1, boundary.rings)
  );
  if (manifest.chunks.length !== expected.length) {
    throw new Error(
      `manifest: ${manifest.chunks.length} chunks, terrain ∩ boundary wants ${expected.length}`
    );
  }
  for (const want of expected) {
    const got = manifest.chunks.find((c) => c.ci === want.ci && c.ri === want.ri);
    if (!got) throw new Error(`manifest: chunk ${want.ci},${want.ri} missing`);
    for (const k of ["x0", "z0", "x1", "z1"]) {
      if (got[k] !== want[k]) throw new Error(`manifest: chunk ${want.ci},${want.ri} ${k} drifted`);
    }
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
    `textures OK — ${manifest.chunks.length} chunks, ${(bytes / 1048576).toFixed(1)} MB, ` +
    `source ${manifest.source || "google (pre-provenance)"}`
  );
}

(CHECK ? Promise.resolve().then(check) : build()).catch((err) => {
  console.error(err.message);
  process.exit(1);
});
