#!/usr/bin/env node
// Build docs/data/campus-truecolor.json — high-definition measured colour for
// every surveyed ground polygon and every building roof, sampled from the
// georeferenced Google satellite chunks in docs/data/textures/.
//
// WHY A SECOND COLOUR FILE. campus-colors.json measures from NAIP at ~0.6 m
// and keys by ARRAY INDEX, so it dies with every data rebuild and it blurs a
// sidewalk into the lawn beside it. The chunks under docs/data/textures are
// 0.125–0.25 m/px — fine enough that a polygon's colour can be measured from
// pixels that are actually INSIDE it, with shadows and edge pixels rejected.
// The imagery is a SOURCE here, never a texture: it is read at build time and
// only a hex per polygon ships.
//
// KEYING RULE (must survive a data rebuild — no raw array indices):
//   every key ends in the polygon's outer-ring VERTEX-AVERAGE CENTROID in
//   metres, rounded to the nearest metre — a geometry hash that holds as long
//   as the footprint itself does. Prefixes say which dataset to resolve in:
//     g:<kind>:<cx>,<cz>   campus-arcgis.json ground polygon (rings are
//                          decimetres in the file; centroid computed at /10)
//     s:<kind>:<cx>,<cz>   campus-3d.json OSM fallback surface (s.p, metres)
//     m:<cx>,<cz>          campus-arcgis.json massing part (rings at /10)
//     b:<cx>,<cz>          campus-3d.json OSM building footprint b.p, or a
//                          building part's part.p (metres)
//   The renderer recomputes the identical key from the same ring and looks it
//   up; a footprint that moves >0.5 m simply misses and falls back to the
//   existing palette — never a crash, never a wrong building's colour.
//   campus-world.js (surfaces) and campus-massing.js (roofs) duplicate the
//   tiny keyOf() below; keep all three in sync.
//
// ROBUST MEDIAN. Pixels are sampled on a sub-metre grid masked to the polygon
// (eroded so edges, walls and their shadows stay out; roofs erode further
// with height because tall buildings lean in off-nadir imagery), converted
// sRGB->linear, shadow/highlight pixels rejected around the median luminance,
// then the per-channel median is taken in linear light and re-encoded.
//
// TASTE GUARD. Every written colour is clamped into the site's palette family
// (HSL: s <= 0.55, 0.20 <= l <= 0.85) so one bad sample can never ship a neon
// roof. tests/campus-truecolor.test.mjs asserts the whole file is in gamut.
//
// CONSTRUCTION-ERA IMAGERY. The zone inspection flagged three areas where the
// chunks show 2023-24 construction (dirt, cranes, bare decks). Polygons whose
// centroid falls in those zones are skipped entirely and sample points inside
// them are rejected — the model there keeps its palette colour instead of
// inheriting a construction site's.
//
// Usage:
//   node scripts/build-campus-truecolor.mjs           # sample + write
//   node scripts/build-campus-truecolor.mjs --check   # verify the shipped file
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CAMPUS = JSON.parse(readFileSync(path.join(REPO_ROOT, "docs/data/campus-3d.json"), "utf8"));
const ARCGIS = JSON.parse(readFileSync(path.join(REPO_ROOT, "docs/data/campus-arcgis.json"), "utf8"));
const MANIFEST = JSON.parse(readFileSync(path.join(REPO_ROOT, "docs/data/textures/manifest.json"), "utf8"));
const TEX_DIR = path.join(REPO_ROOT, "docs/data/textures");
const OUT = path.join(REPO_ROOT, "docs/data/campus-truecolor.json");
const CHECK = process.argv.includes("--check");

/* Flagged by the zone inspection: imagery over these rects is construction-era
   (Eighth College towers; Pepper Canyon West; Viterbi Vision Research Center).
   Cross-checked visually in .cache/probe/*.jpg — all three show active sites. */
export const CONSTRUCTION_ZONES = [
  { name: "eighth-college-towers", x0: -20, z0: -640, x1: 240, z1: -370 },
  { name: "pepper-canyon-west", x0: 660, z0: -90, x1: 910, z1: 130 },
  { name: "viterbi-vrc", x0: 1490, z0: -280, x1: 1750, z1: -20 },
];
const inConstruction = (x, z) =>
  CONSTRUCTION_ZONES.some((c) => x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1);

/* ------------------------------------------------------------------ keying */

export const keyOf = (ring) => {
  let sx = 0, sz = 0;
  for (const p of ring) { sx += p[0]; sz += p[1]; }
  return `${Math.round(sx / ring.length)},${Math.round(sz / ring.length)}`;
};

/* ------------------------------------------------------------- taste guard */

/* The site's palette family, as HSL bounds. Turf greens sit near s=0.35; the
   loudest thing on the real campus (a blue court) is under 0.5 — anything
   hotter is a sampling artefact. */
export const GAMUT = { sMax: 0.55, lMin: 0.2, lMax: 0.85 };

export function clampToGamut(r, g, b) { // 0..255 in, 0..255 out
  let [h, s, l] = rgbToHsl(r / 255, g / 255, b / 255);
  s = Math.min(s, GAMUT.sMax);
  l = Math.min(GAMUT.lMax, Math.max(GAMUT.lMin, l));
  const [rr, gg, bb] = hslToRgb(h, s, l);
  return [Math.round(rr * 255), Math.round(gg * 255), Math.round(bb * 255)];
}

export function rgbToHsl(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

export function hslToRgb(h, s, l) {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
}

/* ------------------------------------------------------------ chunk raster */

/* Sorted so the finest imagery wins wherever chunks overlap. */
const CHUNKS = [...MANIFEST.chunks].sort((a, b) => b.zoom - a.zoom);
const rasterCache = new Map(); // file -> { data, w, h }

async function rasterFor(chunk) {
  if (!rasterCache.has(chunk.file)) {
    const { data, info } = await sharp(path.join(TEX_DIR, chunk.file))
      .raw().toBuffer({ resolveWithObject: true });
    rasterCache.set(chunk.file, { data, w: info.width, h: info.height, ch: info.channels });
  }
  return rasterCache.get(chunk.file);
}

function chunkAt(x, z) {
  for (const c of CHUNKS) if (x >= c.x0 && x < c.x1 && z >= c.z0 && z < c.z1) return c;
  return null;
}

/* --------------------------------------------------------------- geometry */

const inRing = (x, z, ring) => {
  let ins = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
};

const inPoly = (x, z, rings) => {
  if (!inRing(x, z, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) if (inRing(x, z, rings[i])) return false;
  return true;
};

const ringArea = (ring) => {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return Math.abs(a / 2);
};

/* -------------------------------------------------------------- sampling */

const srgbToLin = (v) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const linToSrgb = (v) =>
  Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055));

const median = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[s.length >> 1];
};

/**
 * The robust median colour of one polygon, or null when the imagery cannot
 * answer (off coverage, in a construction zone, or too small once eroded).
 */
async function sampleColor(rings, { erode = 0.6, minSamples = 12 } = {}) {
  const outer = rings[0];
  if (!outer || outer.length < 3) return null;
  let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity;
  for (const [x, z] of outer) {
    if (x < minx) minx = x;
    if (x > maxx) maxx = x;
    if (z < minz) minz = z;
    if (z > maxz) maxz = z;
  }
  const area = ringArea(outer);
  if (area < 2) return null;
  const step = Math.min(3, Math.max(0.3, Math.sqrt(area / 2500)));
  const inside = (x, z) =>
    inPoly(x, z, rings) &&
    inPoly(x - erode, z, rings) && inPoly(x + erode, z, rings) &&
    inPoly(x, z - erode, rings) && inPoly(x, z + erode, rings);

  const lin = []; // [r,g,b] linear
  for (let z = minz + erode; z <= maxz - erode; z += step) {
    for (let x = minx + erode; x <= maxx - erode; x += step) {
      if (inConstruction(x, z)) continue;
      if (!inside(x, z)) continue;
      const c = chunkAt(x, z);
      if (!c) continue;
      const ras = await rasterFor(c);
      const px = Math.min(ras.w - 1, Math.max(0, Math.floor(((x - c.x0) / (c.x1 - c.x0)) * ras.w)));
      const pz = Math.min(ras.h - 1, Math.max(0, Math.floor(((z - c.z0) / (c.z1 - c.z0)) * ras.h)));
      const o = (pz * ras.w + px) * ras.ch;
      lin.push([srgbToLin(ras.data[o]), srgbToLin(ras.data[o + 1]), srgbToLin(ras.data[o + 2])]);
    }
  }
  if (lin.length < minSamples) return null;

  /* Reject shadow and glare pixels around the median luminance, then take the
     per-channel median of what survives. */
  const luma = lin.map(([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b);
  const med = median(luma);
  const kept = lin.filter((_, i) => luma[i] >= med * 0.5 && luma[i] <= med * 1.7);
  const pool = kept.length >= minSamples ? kept : lin;
  const [r, g, b] = clampToGamut(
    linToSrgb(median(pool.map((p) => p[0]))),
    linToSrgb(median(pool.map((p) => p[1]))),
    linToSrgb(median(pool.map((p) => p[2])))
  );
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/* Roofs lean in off-nadir imagery: erode harder the taller the mass, but
   never so hard a small footprint has nothing left. */
const roofErode = (ring, h) => {
  let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity;
  for (const [x, z] of ring) {
    if (x < minx) minx = x;
    if (x > maxx) maxx = x;
    if (z < minz) minz = z;
    if (z > maxz) maxz = z;
  }
  const span = Math.min(maxx - minx, maxz - minz);
  return Math.min(Math.max(1.5, (h || 8) * 0.12), Math.max(0.8, span / 5));
};

/* ------------------------------------------------------------------ build */

async function build() {
  const surfaces = {};
  const roofs = {};
  let skippedConstruction = 0;

  const centroidIn = (ring) => {
    let sx = 0, sz = 0;
    for (const p of ring) { sx += p[0]; sz += p[1]; }
    return inConstruction(sx / ring.length, sz / ring.length);
  };

  /* Surveyed ground polygons (primary surface source). */
  for (const g of ARCGIS.ground || []) {
    const rings = g.r.map((ring) => ring.map(([x, z]) => [x / 10, z / 10]));
    if (centroidIn(rings[0])) { skippedConstruction++; continue; }
    const hex = await sampleColor(rings, { erode: 0.6 });
    if (hex) surfaces[`g:${g.k}:${keyOf(rings[0])}`] = hex;
  }

  /* OSM fallback surfaces (render only when the survey is absent). */
  for (const s of CAMPUS.surfaces || []) {
    if (!s.p || s.p.length < 3 || centroidIn(s.p)) continue;
    const hex = await sampleColor([s.p], { erode: 0.6 });
    if (hex) surfaces[`s:${s.kind}:${keyOf(s.p)}`] = hex;
  }

  /* Massing-part roofs. */
  for (const m of ARCGIS.massing || []) {
    const rings = m.r.map((ring) => ring.map(([x, z]) => [x / 10, z / 10]));
    if (centroidIn(rings[0])) { skippedConstruction++; continue; }
    const hex = await sampleColor(rings, { erode: roofErode(rings[0], m.h), minSamples: 16 });
    if (hex) roofs[`m:${keyOf(rings[0])}`] = hex;
  }

  /* OSM building roofs — footprints and parts both, so whichever the massing
     assembly renders finds its colour. */
  for (const b of CAMPUS.buildings || []) {
    const tryRing = async (ring, h) => {
      if (!ring || ring.length < 3 || centroidIn(ring)) return;
      const hex = await sampleColor([ring], { erode: roofErode(ring, h), minSamples: 16 });
      if (hex) roofs[`b:${keyOf(ring)}`] = hex;
    };
    await tryRing(b.p, b.h);
    for (const part of b.parts || []) await tryRing(part.p, part.h || b.h);
  }

  const out = {
    _: "Generated by scripts/build-campus-truecolor.mjs from the georeferenced satellite chunks in docs/data/textures (imagery (c) Google, read as a build-time SOURCE only). Keys are geometry hashes — prefix g:/s:/m:/b: + kind + outer-ring vertex-average centroid in metres, rounded (see the script header) — so they survive data rebuilds. All colours are taste-guard clamped (HSL s<=0.55, 0.20<=l<=0.85). Do not hand-edit.",
    fetched: new Date().toISOString().slice(0, 10),
    gamut: GAMUT,
    surfaces,
    roofs,
  };
  writeFileSync(OUT, JSON.stringify(out));
  console.log(
    `wrote ${Object.keys(surfaces).length} surface colours, ${Object.keys(roofs).length} roof colours ` +
    `(${skippedConstruction} polygons skipped in construction zones)`
  );
}

function check() {
  const tc = JSON.parse(readFileSync(OUT, "utf8"));
  const n = Object.keys(tc.surfaces).length + Object.keys(tc.roofs).length;
  if (!n) throw new Error("campus-truecolor.json is empty — rebuild");
  for (const [k, v] of [...Object.entries(tc.surfaces), ...Object.entries(tc.roofs)]) {
    if (!/^#[0-9a-f]{6}$/.test(v)) throw new Error(`bad colour ${v} at ${k}`);
  }
  console.log(`ok: ${Object.keys(tc.surfaces).length} surfaces, ${Object.keys(tc.roofs).length} roofs`);
}

if (CHECK) check();
else await build();
