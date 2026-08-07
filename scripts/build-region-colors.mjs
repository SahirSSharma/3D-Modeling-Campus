#!/usr/bin/env node
// Build docs/data/region-colors.json — the real colour of the 30 km² around
// the campus: the ground under every terrain cell, and the roof of every
// regional building.
//
// WHY THIS EXISTS. The region has had measured GROUND (6 m LiDAR grid) and
// measured HEIGHTS (2014 octree, per footprint) for a while, and it has never
// had a measured COLOUR. Every square kilometre of it renders in one inherited
// tan with white boxes on top, which is not a neutral placeholder — it is a
// claim, and the claim is wrong everywhere. Rose Canyon is not the colour of
// I-5, the Torrey Pines fairways are not the colour of the University City
// rooftops they run beside, and the beach is not the colour of the bluff above
// it. All of that is free to measure: the imagery is already licensed, already
// cached, and already used exactly this way on campus.
//
// WHAT IT MEASURES (source: Google 2D satellite tiles, zoom 19, 0.251 m/px):
//   terrain  one colour per region-terrain.json cell (6 m), palette-indexed
//   roofs    one colour per region-osm.json footprint, keyed BY INDEX
//
// THE IMAGERY IS A BUILD-TIME SOURCE AND NOTHING ELSE. No tile is shipped, no
// photograph is draped, nothing reaches the renderer but hex strings and a
// byte per cell. This is the same contract build-campus-truecolor.mjs works
// under and the reason the imagery source is swappable at all.
//
// ---------------------------------------------------------------- the joins
//
// TWO joins have to hold and both fail silently, so both are checked.
//
// 1. THE GRID. The colour grid is emitted on region-terrain.json's own lattice
//    (x0, z0, cell, cols, rows) so cell i means the same patch of ground in
//    both files by construction rather than by coincidence. docs/js/
//    campus-region.js refuses the whole file if any of the five disagree — a
//    colour grid offset by two cells looks like nothing at all until you
//    notice the road running through the field beside the road.
//
// 2. THE FOOTPRINTS. Roof colours are a SIDECAR keyed by index into
//    region-osm.json's buildings array, which is the same arrangement — and
//    the same hazard — as region-heights.json: one building added upstream
//    shifts every index after it and each colour lands on its neighbour, with
//    both files individually well-formed. So this carries the identical
//    `footprints.fingerprint` (build-region-heights.mjs's footprintFingerprint,
//    imported rather than re-implemented) and refuses a stale join loudly.
//
// ------------------------------------------------------------- the epoch rule
//
// Heights here are the 2014 flight; this imagery is current. For COLOUR that
// split is fine and intended — a 2019 house is still the colour it is today,
// and nothing in this file ever touches a height. Two consequences do need
// handling, and they are handled explicitly rather than hoped about:
//
// A. THE CAMPUS BOX IS EXCLUDED, entirely. Everything inside region.json's
//    `core` already has its own measured colour from its own finer pipeline
//    (campus-colors.json at 6 m, campus-truecolor.json per polygon from the
//    0.125 m chunks), and that pipeline knows things this one cannot — which
//    is why it matters: Google's current imagery of Eighth College is an
//    active construction site, and build-campus-truecolor.mjs names that zone
//    and skips it. Measuring the campus again from a coarser source would
//    quietly overwrite a better answer with a worse one AND re-import the
//    construction site the campus pipeline was careful to reject. So every
//    cell and every footprint inside `core` is left to the campus: cells get
//    the "no colour" index, footprints are not written at all.
//
// B. A REGIONAL BUILDING UNDER CONSTRUCTION TODAY MEASURES AS DIRT. There is
//    no name list for five thousand anonymous buildings, so this cannot be
//    enumerated the way the campus enumerates its three zones. The signature
//    that IS measurable is dispersion: a finished roof is one material, a
//    graded pad is a mess of dirt, stockpiles, formwork and plant, so its
//    pixels spread far wider. Colour alone would be useless (half of La Jolla
//    has a terracotta roof exactly the colour of dirt) and spread alone nearly
//    so (a solar array is heterogeneous too), so the flag is their conjunction,
//    with thresholds read off the measured distribution rather than guessed.
//
//    AND IT DOES NOT DETECT CONSTRUCTION — that was checked, and the check
//    failed. region-heights.json carries a completely independent statement
//    about which of these buildings postdate 2014: the ones whose footprint the
//    2014 flight could not measure, because it saw the lot rather than the
//    building. If this flag were finding building sites it would be enriched
//    for those. It is not: 16.5% of flagged roofs are unmeasurable in the 2014
//    LiDAR against 15.9% of confident ones, which is no signal at all.
//
//    So the flag is kept and its CLAIM is reduced to what it can support: NO
//    SINGLE HEX HONESTLY DESCRIBES THIS SURFACE. That is worth acting on by
//    itself — publishing one colour for a roof whose pixels disagree that
//    violently is a fabrication whatever caused the disagreement — and a
//    construction site is one of the things it catches, unquantifiably. Flagged
//    roofs move OUT of `roofs` into `suspect`, carrying their measurement and
//    the number that flagged them, so the renderer draws a confident colour or
//    none, never an unconfident colour dressed as confident. What this file
//    cannot do is tell you which regional buildings are building sites; nothing
//    here should be read as if it could.
//
// Usage:
//   node scripts/build-region-colors.mjs --plan    # tile count + cost, no fetch
//   node scripts/build-region-colors.mjs           # fetch + sample + write
//   node scripts/build-region-colors.mjs --check   # verify the shipped file
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

import {
  makeProvider, cacheDirFor, mercX, mercY, mercXToLng, mercYToLat, mPerMercPx,
} from "./lib/imagery.mjs";
import { footprintFingerprint } from "./build-region-heights.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REGION = path.join(REPO_ROOT, "docs/data/region.json");
const OSM = path.join(REPO_ROOT, "docs/data/region-osm.json");
const TERRAIN = path.join(REPO_ROOT, "docs/data/region-terrain.json");
const OUT = path.join(REPO_ROOT, "docs/data/region-colors.json");

const PLAN = process.argv.includes("--plan");
const CHECK = process.argv.includes("--check");

/* ---------------------------------------------------------------- constants */

/* ZOOM 19, which is 0.251 m/px at this latitude on Google's plain 256 px tiles.
   The campus builds its fine chunks at z20 (0.125 m/px) because it measures
   individual polygons — a 3 m-wide path needs pixels that fit inside a path.
   Out here the finest thing measured is a 6 m terrain cell and the smallest
   footprint is a ~150 m² house, and z20 would cost four times the tiles for
   detail that is averaged away in the same breath. z19 puts 24x24 pixels in a
   terrain cell and ~2,400 inside the median 288 m² roof, which is far past
   what a median needs. */
export const ZOOM = 19;

/* Palette size. campus-colors.json keeps 47 colours over 8.4 km² of campus;
   this covers 30 km² of ocean, beach, bluff, chaparral, canyon, fairway,
   freeway, tile roof and parking lot, so it gets more room. 200 leaves the
   255 sentinel and 54 spare indices free. */
export const PALETTE_SIZE = 200;

/* The reserved index. Identical to campus-colors.json's, and the renderer's
   `g.none ?? 255` reads it out of the file rather than assuming. */
export const NONE_INDEX = 255;

/* Colours are clustered by snapping to this lattice before counting. 10 units
   is under a JND at these luminances and it is what makes "the most common
   colours" a meaningful question at all — without it every cell is its own
   unique 24-bit colour and the top 200 are noise. */
const SNAP = 10;

/* Terrain sampling. Every 6th pixel of every tile is read, which lands 4x4 = 16
   samples in each 6 m cell — enough for a median that a white car, a lane
   marking or one glinting skylight cannot move, and 36x cheaper than reading
   all 576. */
const PIXEL_STRIDE = 6;
const RESERVOIR = 16;

/* Roof sampling. A roof needs at least this many surviving samples before a
   median means anything; below it the footprint is too small once eroded, or
   the tiles did not cover it. */
const MIN_ROOF_SAMPLES = 24;

/* THE CONSTRUCTION FLAG, calibrated against the measured population — see the
 * epoch note in the header. `spread` is the interquartile range of a roof's
 * linear luminance over its median: a dimensionless "how much does this surface
 * disagree with itself".
 *
 * MEASURED over all 5,551 regional roofs, at z19:
 *     spread   p50 0.332   p75 0.573   p90 0.905   p95 1.184   p99 1.687
 *
 * The first cut of this file guessed 0.53 / 0.80 for these two constants,
 * having never seen the distribution. Those land at roughly p73 and p88, and
 * the run flagged 832 buildings — fifteen per cent of the region — as
 * construction. That is not a detector, it is a rate, and the number itself is
 * the disproof: fifteen per cent of University City is not a building site.
 * The constants below are read off the distribution above instead.
 *
 * BE CLEAR ABOUT WHAT THIS IS. Spread is a WEAK discriminator, on two separate
 * pieces of evidence. The distribution has no shoulder and no second mode —
 * nothing that looks like a population of building sites sitting apart from a
 * population of roofs — which is unsurprising, because at 0.25 m/px an entirely
 * ordinary pitched roof disperses too: two slopes at different angles to the
 * sun, a ridge, gutters, a tree over one corner. And when the flag was checked
 * against region-heights.json's independent 2014-epoch signal it showed no
 * enrichment whatever (header note B). So it does not claim "under
 * construction"; it claims NO SINGLE HEX HONESTLY DESCRIBES THIS SURFACE, which
 * is exactly what the withholding is for.
 *
 * SPREAD_SUSPECT is p90 and only ever fires in conjunction with earth colour;
 * on its own it would be meaningless. SPREAD_ALONE is p99, the far tail where a
 * surface disagrees with itself so violently that its median is not a
 * description of anything, whatever its hue.
 */
const SPREAD_SUSPECT = 0.905;
const SPREAD_ALONE = 1.687;

/* Bare earth, as HSL bounds. Graded dirt in this county runs from a pale grey
   sand through to a red-brown fill; the band is hue 20°-55°, moderately
   unsaturated, mid-light. Terracotta tile sits inside this band too — which is
   the entire reason this test is never used alone. */
const EARTH = { hMin: 20 / 360, hMax: 55 / 360, sMin: 0.08, sMax: 0.50, lMin: 0.30, lMax: 0.80 };

/* THE TASTE GUARD, the same one build-campus-truecolor.mjs applies to campus
   roofs and for the same reason: one bad sample must never be able to ship a
   neon building. Bounds are identical so the two halves of the world cannot
   drift into different colour families at the campus edge.
   These four functions are DUPLICATED from build-campus-truecolor.mjs rather
   than imported, and that is not an oversight: that module runs its build at
   import time (no INVOKED guard), so importing it would start a campus rebuild
   as a side effect of loading this file. */
export const GAMUT = { sMax: 0.55, lMin: 0.2, lMax: 0.85 };

/* Concurrency for the tile fetch. Politeness and throughput both; the cache is
   on disk so a re-run costs nothing. */
const FETCH_CONCURRENCY = 12;

/* --------------------------------------------------------- colour utilities */

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

export function clampToGamut(r, g, b) {
  const [h, s0, l0] = rgbToHsl(r / 255, g / 255, b / 255);
  const s = Math.min(s0, GAMUT.sMax);
  const l = Math.min(GAMUT.lMax, Math.max(GAMUT.lMin, l0));
  const [rr, gg, bb] = hslToRgb(h, s, l);
  return [Math.round(rr * 255), Math.round(gg * 255), Math.round(bb * 255)];
}

const srgbToLin = (v) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const linToSrgb = (v) =>
  Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055));

const hex = (r, g, b) => `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;

/** Sorted-array percentile, linear-interpolation-free (the arrays here are big
 *  enough that the nearest rank is the same answer). */
const pct = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];

/* ------------------------------------------------------------------ frames */

function loadFrames() {
  const region = JSON.parse(readFileSync(REGION, "utf8"));
  const osm = JSON.parse(readFileSync(OSM, "utf8"));
  const th = JSON.parse(readFileSync(TERRAIN, "utf8"));
  const O = region.origin;

  /* Local metres -> lat/lng is the equirectangular frame every other builder in
     this repo shares (region.json's own origin block carries the two scale
     factors). Using anything else here would put the colours a few metres off
     the heights, which is the one thing the positional join exists to prevent. */
  const latOf = (z) => O.lat - z / O.mPerDegLat;
  const lngOf = (x) => O.lng + x / O.mPerDegLng;
  const xOf = (lng) => (lng - O.lng) * O.mPerDegLng;
  const zOf = (lat) => -(lat - O.lat) * O.mPerDegLat;

  /* The campus box, in local metres. Everything inside belongs to the campus
     pipeline — see the epoch note (A) in the header. */
  const c = region.core;
  const core = {
    x0: xOf(c.west), x1: xOf(c.east),
    z0: zOf(c.north), z1: zOf(c.south),
  };
  const inCore = (x, z) => x >= core.x0 && x <= core.x1 && z >= core.z0 && z <= core.z1;

  return { region, osm, th, O, latOf, lngOf, xOf, zOf, core, inCore };
}

/** Even-odd point-in-polygon on the region outline, in local metres. */
function makeInPolygon(ring) {
  const xs = ring.map(([x]) => x);
  const zs = ring.map(([, z]) => z);
  const bb = { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
  return (px, pz) => {
    if (px < bb.x0 || px > bb.x1 || pz < bb.z0 || pz > bb.z1) return false;
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, zi] = ring[i];
      const [xj, zj] = ring[j];
      if (zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
  };
}

const ringArea = (ring) => {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return Math.abs(a / 2);
};

const centroidOf = (ring) => {
  let x = 0, z = 0;
  for (const p of ring) { x += p[0]; z += p[1]; }
  return [x / ring.length, z / ring.length];
};

/* ------------------------------------------------------------------ scope */

/**
 * Which terrain cells this build owns, and which tiles cover them.
 *
 * "In scope" is the region outline MINUS the campus box. Both subtractions
 * matter and they mean different things: outside the outline nothing was ever
 * built, inside the campus box something better already exists.
 */
function planScope(f) {
  const { th } = f;
  const inPoly = makeInPolygon(f.region.polygon.local);
  const scope = new Uint8Array(th.cols * th.rows);
  let inScope = 0;
  let inCoreCells = 0;

  for (let r = 0; r < th.rows; r++) {
    const z = th.z0 + r * th.cell;
    for (let c = 0; c < th.cols; c++) {
      const x = th.x0 + c * th.cell;
      if (!inPoly(x, z)) continue;
      if (f.inCore(x, z)) { inCoreCells++; continue; }
      scope[r * th.cols + c] = 1;
      inScope++;
    }
  }

  /* The tiles are derived FROM the scope mask rather than from the bounding
     box. The bbox is 52.7 km² and 43% of it is outside the outline; fetching
     it would be ~9,000 tiles of which 3,800 are ocean and Sorrento Valley
     nobody asked for. Each cell contributes the tiles covering its full 6 m
     footprint, not just its centre, because the sampler reads the whole cell. */
  const tiles = new Set();
  const half = th.cell / 2;
  for (let r = 0; r < th.rows; r++) {
    const z = th.z0 + r * th.cell;
    for (let c = 0; c < th.cols; c++) {
      if (!scope[r * th.cols + c]) continue;
      const x = th.x0 + c * th.cell;
      addTiles(tiles, f, x - half, z - half, x + half, z + half);
    }
  }
  return { scope, inScope, inCoreCells, tiles };
}

/** Add every z19 tile overlapping a local-metre box to the set. */
function addTiles(set, f, xA, zA, xB, zB) {
  const mx0 = mercX(f.lngOf(xA), ZOOM);
  const mx1 = mercX(f.lngOf(xB), ZOOM);
  const my0 = mercY(f.latOf(zA), ZOOM);
  const my1 = mercY(f.latOf(zB), ZOOM);
  for (let gy = Math.floor(Math.min(my0, my1) / 256); gy <= Math.floor(Math.max(my0, my1) / 256); gy++) {
    for (let gx = Math.floor(Math.min(mx0, mx1) / 256); gx <= Math.floor(Math.max(mx0, mx1) / 256); gx++) {
      set.add(`${gx},${gy}`);
    }
  }
}

/** The buildings this build owns: inside the outline, outside the campus box. */
function planBuildings(f) {
  const inPoly = makeInPolygon(f.region.polygon.local);
  const mine = [];
  let outsideOutline = 0;
  let inCoreBuildings = 0;
  f.osm.buildings.forEach((b, i) => {
    const [cx, cz] = centroidOf(b.p);
    if (!inPoly(cx, cz)) { outsideOutline++; return; }
    if (f.inCore(cx, cz)) { inCoreBuildings++; return; }
    mine.push({ i, b, cx, cz });
  });
  return { mine, outsideOutline, inCoreBuildings };
}

/* ------------------------------------------------------------ tile rasters */

const tileKey = (gx, gy) => `${gx},${gy}`;

/** Decoded 3-channel raster for one tile, straight from the disk cache. */
async function readRaster(provider, gx, gy) {
  const file = await provider.fetchPatch(ZOOM, { gx, gy, mx0: gx * 256, my0: gy * 256, span: 256 });
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height, ch: info.channels };
}

/* ------------------------------------------------------------ terrain pass */

/**
 * One streaming pass over every tile, folding pixels into per-cell reservoirs.
 *
 * The loop is over TILES and not over cells on purpose. A cell-major loop needs
 * random access into whichever of ~5,000 tiles its pixels happen to live in,
 * which means either holding them all decoded (about a gigabyte) or an LRU that
 * re-decodes at every band boundary. Tile-major touches each tile exactly once
 * and never holds two.
 *
 * Each cell keeps up to RESERVOIR samples and drops the rest. Dropping is fine
 * and averaging would not be: the whole point of keeping samples is to take a
 * median at the end, and a median is what stops one white car on a road, or one
 * skylight on a warehouse, from becoming the colour of 36 m² of the world.
 */
async function terrainPass(f, provider, tiles) {
  const { th } = f;
  const n = th.cols * th.rows;
  const samples = new Uint8Array(n * RESERVOIR * 3);
  const counts = new Uint8Array(n);

  const keys = [...tiles].map((k) => k.split(",").map(Number));
  let done = 0;
  const t0 = Date.now();

  /* Serial decode, because the fetch already happened and sharp's own thread
     pool is what does the work. Concurrency here would just contend. */
  for (const [gx, gy] of keys) {
    let ras;
    try {
      ras = await readRaster(provider, gx, gy);
    } catch (err) {
      /* A tile that will not decode is a hole in the measurement, not a reason
         to lose the other 5,000. It shows up as `none` cells in the output and
         is counted in the header. */
      console.log(`  tile ${gx},${gy} unreadable: ${err.message}`);
      continue;
    }

    /* lat depends only on the pixel row and lng only on the column, so the two
       expensive projections run 43 times each per tile instead of 1,849. */
    const rows = [];
    for (let py = 0; py < ras.h; py += PIXEL_STRIDE) {
      const z = f.zOf(mercYToLat(gy * 256 + py + 0.5, ZOOM));
      rows.push([py, Math.round((z - th.z0) / th.cell)]);
    }
    const cols = [];
    for (let px = 0; px < ras.w; px += PIXEL_STRIDE) {
      const x = f.xOf(mercXToLng(gx * 256 + px + 0.5, ZOOM));
      cols.push([px, Math.round((x - th.x0) / th.cell)]);
    }

    for (const [py, r] of rows) {
      if (r < 0 || r >= th.rows) continue;
      const rowBase = py * ras.w * ras.ch;
      for (const [px, c] of cols) {
        if (c < 0 || c >= th.cols) continue;
        const cell = r * th.cols + c;
        const k = counts[cell];
        if (k >= RESERVOIR) continue;
        const o = rowBase + px * ras.ch;
        const s = (cell * RESERVOIR + k) * 3;
        samples[s] = ras.data[o];
        samples[s + 1] = ras.data[o + 1];
        samples[s + 2] = ras.data[o + 2];
        counts[cell] = k + 1;
      }
    }
    if (++done % 200 === 0) {
      process.stdout.write(`  sampled ${done}/${keys.length} tiles\r`);
    }
  }
  console.log(`  sampled ${done}/${keys.length} tiles in ${((Date.now() - t0) / 1000).toFixed(0)}s      `);
  return { samples, counts };
}

/**
 * Per-cell median, in linear light.
 *
 * sRGB is a display encoding; averaging or ordering in it biases every mixed
 * cell dark. Everything statistical in this file happens after srgbToLin and
 * is re-encoded once at the end, which is the same rule build-campus-truecolor
 * follows.
 */
function reduceCells(f, scope, samples, counts) {
  const { th } = f;
  const n = th.cols * th.rows;
  const cells = new Array(n).fill(null);
  let measured = 0;
  let noImagery = 0;
  const rs = [], gs = [], bs = [];

  for (let i = 0; i < n; i++) {
    if (!scope[i]) continue;
    const k = counts[i];
    if (!k) { noImagery++; continue; }
    rs.length = 0; gs.length = 0; bs.length = 0;
    for (let j = 0; j < k; j++) {
      const s = (i * RESERVOIR + j) * 3;
      rs.push(srgbToLin(samples[s]));
      gs.push(srgbToLin(samples[s + 1]));
      bs.push(srgbToLin(samples[s + 2]));
    }
    rs.sort((a, b) => a - b); gs.sort((a, b) => a - b); bs.sort((a, b) => a - b);
    const m = k >> 1;
    cells[i] = [linToSrgb(rs[m]), linToSrgb(gs[m]), linToSrgb(bs[m])];
    measured++;
  }
  return { cells, measured, noImagery };
}

/**
 * Quantise the cell colours to a palette plus one byte a cell.
 *
 * Same shape as campus-colors.json — the renderer already decodes it — with one
 * difference that is strictly an improvement: a palette entry is the MEAN of
 * the colours that snapped to its lattice point, not the lattice point itself.
 * The lattice exists to make "which colours are common" answerable; there is no
 * reason to then ship the grid coordinate instead of the thing it counted.
 */
function quantize(cells) {
  const counts = new Map(); // snapped key -> { n, r, g, b }
  const keys = new Array(cells.length).fill(null);
  for (let i = 0; i < cells.length; i++) {
    const rgb = cells[i];
    if (!rgb) continue;
    const key = `${Math.round(rgb[0] / SNAP)},${Math.round(rgb[1] / SNAP)},${Math.round(rgb[2] / SNAP)}`;
    keys[i] = key;
    let e = counts.get(key);
    if (!e) counts.set(key, (e = { n: 0, r: 0, g: 0, b: 0 }));
    e.n++; e.r += rgb[0]; e.g += rgb[1]; e.b += rgb[2];
  }

  const kept = [...counts.entries()]
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, PALETTE_SIZE);
  const keptRgb = kept.map(([, e]) => [
    Math.round(e.r / e.n), Math.round(e.g / e.n), Math.round(e.b / e.n),
  ]);
  const palette = keptRgb.map(([r, g, b]) => hex(r, g, b));
  const index = new Map(kept.map(([k], i) => [k, i]));

  /* Everything not in the top PALETTE_SIZE takes its nearest kept colour. The
     answer is cached per snapped key, so this runs a few thousand times rather
     than 1.5 million. */
  const nearest = new Map();
  const resolve = (key) => {
    let i = index.get(key);
    if (i !== undefined) return i;
    i = nearest.get(key);
    if (i !== undefined) return i;
    const [r, g, b] = key.split(",").map((v) => Number(v) * SNAP);
    let best = 0, bd = Infinity;
    for (let j = 0; j < keptRgb.length; j++) {
      const d = (keptRgb[j][0] - r) ** 2 + (keptRgb[j][1] - g) ** 2 + (keptRgb[j][2] - b) ** 2;
      if (d < bd) { bd = d; best = j; }
    }
    nearest.set(key, best);
    return best;
  };

  const idx = new Uint8Array(cells.length).fill(NONE_INDEX);
  let exact = 0;
  for (let i = 0; i < cells.length; i++) {
    if (!keys[i]) continue;
    const k = resolve(keys[i]);
    idx[i] = k;
    if (index.has(keys[i])) exact++;
  }
  return { palette, idx, distinctSnapped: counts.size, exact };
}

/* --------------------------------------------------------------- roof pass */

/**
 * How far inside its own outline a roof is sampled.
 *
 * The point is never to average a roof with the street beside it. Two things
 * push the sample inward: OSM footprints are traced off imagery and sit within
 * a metre or so of the wall, and a building LEANS in off-nadir imagery, by more
 * the taller it is. So the inset grows with height — build-campus-truecolor's
 * rule, unchanged — but is capped at a fifth of the footprint's narrow span so
 * a 6 m-wide townhouse is not eroded out of existence.
 */
function roofErode(ring, h) {
  let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity;
  for (const [x, z] of ring) {
    if (x < minx) minx = x;
    if (x > maxx) maxx = x;
    if (z < minz) minz = z;
    if (z > maxz) maxz = z;
  }
  const span = Math.min(maxx - minx, maxz - minz);
  return Math.min(Math.max(1.2, (h || 6) * 0.12), Math.max(0.5, span / 5));
}

const inRing = (x, z, ring) => {
  let ins = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
};

/**
 * Sample one roof.
 *
 * Points on a sub-metre lattice inside the eroded footprint, read from whatever
 * tiles cover them, converted to linear light. The shadow/glare band is then
 * rejected around the median luminance before the per-channel median is taken —
 * a roof half in the shadow of its own parapet is still one roof, and the lit
 * half is the one that describes its material.
 */
function sampleRoof(ring, erode, rasters, f) {
  let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity;
  for (const [x, z] of ring) {
    if (x < minx) minx = x;
    if (x > maxx) maxx = x;
    if (z < minz) minz = z;
    if (z > maxz) maxz = z;
  }
  const area = ringArea(ring);
  /* Aim for a few hundred samples whatever the size: a 150 m² house gets a
     0.35 m lattice, a 5,000 m² warehouse a 2 m one. Reading every 0.25 m pixel
     of a warehouse would be 80,000 samples to compute the same median. */
  const step = Math.min(2, Math.max(0.3, Math.sqrt(area / 600)));
  const inside = (x, z) =>
    inRing(x, z, ring) &&
    inRing(x - erode, z, ring) && inRing(x + erode, z, ring) &&
    inRing(x, z - erode, ring) && inRing(x, z + erode, ring);

  const lin = [];
  for (let z = minz + erode; z <= maxz - erode; z += step) {
    const my = mercY(f.latOf(z), ZOOM);
    const gy = Math.floor(my / 256);
    const py = Math.min(255, Math.max(0, Math.floor(my - gy * 256)));
    for (let x = minx + erode; x <= maxx - erode; x += step) {
      if (!inside(x, z)) continue;
      const mx = mercX(f.lngOf(x), ZOOM);
      const gx = Math.floor(mx / 256);
      const ras = rasters.get(tileKey(gx, gy));
      if (!ras) continue;
      const px = Math.min(255, Math.max(0, Math.floor(mx - gx * 256)));
      const o = (py * ras.w + px) * ras.ch;
      lin.push([srgbToLin(ras.data[o]), srgbToLin(ras.data[o + 1]), srgbToLin(ras.data[o + 2])]);
    }
  }
  if (lin.length < MIN_ROOF_SAMPLES) return { n: lin.length, hex: null };

  const luma = lin.map(([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b);
  const sortedLuma = [...luma].sort((a, b) => a - b);
  const med = pct(sortedLuma, 0.5);
  /* The dispersion that the construction flag reads, measured BEFORE the
     shadow/glare rejection — rejecting first would hide exactly the mess the
     flag is looking for. */
  const spread = med > 0 ? (pct(sortedLuma, 0.75) - pct(sortedLuma, 0.25)) / med : 0;

  const kept = lin.filter((_, i) => luma[i] >= med * 0.5 && luma[i] <= med * 1.7);
  const pool = kept.length >= MIN_ROOF_SAMPLES ? kept : lin;
  const chan = (k) => {
    const s = pool.map((p) => p[k]).sort((a, b) => a - b);
    return linToSrgb(s[s.length >> 1]);
  };
  const raw = [chan(0), chan(1), chan(2)];
  const [r, g, b] = clampToGamut(raw[0], raw[1], raw[2]);
  const [h, s, l] = rgbToHsl(r / 255, g / 255, b / 255);
  const earthLike =
    h >= EARTH.hMin && h <= EARTH.hMax &&
    s >= EARTH.sMin && s <= EARTH.sMax &&
    l >= EARTH.lMin && l <= EARTH.lMax;

  return { n: lin.length, hex: hex(r, g, b), spread, earthLike };
}

/**
 * Every roof this build owns, in tile order.
 *
 * Buildings are visited sorted by the tile their centroid falls in, so the
 * decoded-raster cache walks the region once instead of thrashing. The cache is
 * bounded: a footprint spans at most a handful of 64 m tiles, so a few hundred
 * held at a time covers every neighbour any building can reach.
 */
async function roofPass(f, provider, mine, heights) {
  const rasters = new Map();
  const RASTER_CAP = 300;
  const sampled = []; // { i, hex, spread, earthLike } — flagged after the sweep
  const stats = { measured: 0, tooSmall: 0, noTiles: 0, suspectEarth: 0, suspectSpread: 0 };

  const sorted = [...mine].sort((a, b) => {
    const ka = Math.floor(mercY(f.latOf(a.cz), ZOOM) / 256) - Math.floor(mercY(f.latOf(b.cz), ZOOM) / 256);
    if (ka) return ka;
    return mercX(f.lngOf(a.cx), ZOOM) - mercX(f.lngOf(b.cx), ZOOM);
  });

  let done = 0;
  const t0 = Date.now();
  for (const { i, b } of sorted) {
    /* The measured 2014 height where there is one, the OSM/ladder height
       otherwise. It is used for ONE thing — how far to inset the sample, since
       a taller building leans further in off-nadir imagery — and never appears
       in the output. No colour here is derived from a height. */
    const h = heights?.h?.[i] ?? b.h;
    const erode = roofErode(b.p, h);

    const need = new Set();
    addTiles(need, f, ...bboxOf(b.p));
    let missing = false;
    for (const key of need) {
      if (rasters.has(key)) continue;
      const [gx, gy] = key.split(",").map(Number);
      try {
        rasters.set(key, await readRaster(provider, gx, gy));
      } catch {
        missing = true;
      }
    }
    if (rasters.size > RASTER_CAP) {
      /* Insertion-ordered eviction. Tile order means the oldest entries are the
         furthest north and no longer reachable by anything still to come. */
      for (const key of rasters.keys()) {
        if (rasters.size <= RASTER_CAP) break;
        if (!need.has(key)) rasters.delete(key);
      }
    }

    const s = sampleRoof(b.p, erode, rasters, f);
    if (!s.hex) {
      if (missing) stats.noTiles++;
      else stats.tooSmall++;
      continue;
    }
    sampled.push({ i, ...s });
    if (++done % 500 === 0) process.stdout.write(`  ${done}/${sorted.length} roofs\r`);
  }
  console.log(`  ${sampled.length} roofs sampled in ${((Date.now() - t0) / 1000).toFixed(0)}s      `);

  /* THE FLAG IS APPLIED AFTER THE SWEEP, not during it, so the distribution the
     thresholds were read off can be re-printed from the same run that used
     them. A constant chosen from data nobody can see again is a constant nobody
     can check. */
  const spreads = sampled.map((s) => s.spread).sort((a, b) => a - b);
  const rank = (v) => spreads.filter((s) => s < v).length / spreads.length;
  console.log(
    `  spread distribution: p50 ${pct(spreads, 0.5).toFixed(3)} p75 ${pct(spreads, 0.75).toFixed(3)} ` +
    `p90 ${pct(spreads, 0.9).toFixed(3)} p95 ${pct(spreads, 0.95).toFixed(3)} p99 ${pct(spreads, 0.99).toFixed(3)}`
  );
  console.log(
    `  thresholds in use: SPREAD_SUSPECT ${SPREAD_SUSPECT} (p${Math.round(rank(SPREAD_SUSPECT) * 100)}), ` +
    `SPREAD_ALONE ${SPREAD_ALONE} (p${Math.round(rank(SPREAD_ALONE) * 100)}); ` +
    `${sampled.filter((s) => s.earthLike).length} roofs read as earth-coloured`
  );

  const roofs = {};
  const suspect = {};
  for (const s of sampled) {
    const reasons = [];
    if (s.earthLike && s.spread >= SPREAD_SUSPECT) reasons.push("earth-coloured and heterogeneous");
    if (s.spread >= SPREAD_ALONE) reasons.push("no single colour describes this surface");
    if (reasons.length) {
      if (s.earthLike) stats.suspectEarth++; else stats.suspectSpread++;
      suspect[s.i] = { c: s.hex, spread: Math.round(s.spread * 1000) / 1000, why: reasons.join("; ") };
      continue;
    }
    roofs[s.i] = s.hex;
    stats.measured++;
  }
  return { roofs, suspect, stats, spreads, thresholdRank: { suspect: rank(SPREAD_SUSPECT), alone: rank(SPREAD_ALONE) } };
}

function bboxOf(ring) {
  let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity;
  for (const [x, z] of ring) {
    if (x < minx) minx = x;
    if (x > maxx) maxx = x;
    if (z < minz) minz = z;
    if (z > maxz) maxz = z;
  }
  return [minx, minz, maxx, maxz];
}

/* ------------------------------------------------------------------- plan */

function planReport(f) {
  const { scope, inScope, inCoreCells, tiles } = planScope(f);
  const { mine, outsideOutline, inCoreBuildings } = planBuildings(f);
  const mPerPx = mPerMercPx(ZOOM, f.O.lat);
  const tileM = 256 * mPerPx;
  console.log(`zoom ${ZOOM}: ${mPerPx.toFixed(4)} m/px, ${tileM.toFixed(1)} m per tile`);
  console.log(
    `terrain grid ${f.th.cols}x${f.th.rows} @ ${f.th.cell} m — ` +
    `${inScope.toLocaleString()} cells in scope, ${inCoreCells.toLocaleString()} inside the campus box (left to the campus), ` +
    `${(f.th.cols * f.th.rows - inScope - inCoreCells).toLocaleString()} outside the outline`
  );
  console.log(
    `  ${(inScope * f.th.cell ** 2 / 1e6).toFixed(1)} km2 to measure → ${tiles.size.toLocaleString()} tiles at z${ZOOM}`
  );
  console.log(
    `buildings: ${mine.length.toLocaleString()} in scope, ${inCoreBuildings} inside the campus box, ` +
    `${outsideOutline} outside the outline (of ${f.osm.buildings.length.toLocaleString()})`
  );
  return { scope, inScope, inCoreCells, tiles, mine, outsideOutline, inCoreBuildings };
}

/* ------------------------------------------------------------------ build */

async function build() {
  const f = loadFrames();
  const plan = planReport(f);

  if (plan.tiles.size > 9000) {
    throw new Error(
      `${plan.tiles.size} tiles at z${ZOOM} is far past the ~8,000 this region should need — ` +
      "the scope mask or the projection is wrong; do not hammer the API to find out"
    );
  }

  const heightsPath = path.join(REPO_ROOT, "docs/data/region-heights.json");
  const heights = existsSync(heightsPath) ? JSON.parse(readFileSync(heightsPath, "utf8")) : null;

  const cacheDir = cacheDirFor(REPO_ROOT, "google");
  const provider = makeProvider("google", { root: REPO_ROOT, cacheDir, cap: 9000 });
  /* Without this the session token is never minted and every tile request comes
     back 400 "API key not valid" — which is a lie about the key. */
  await provider.prepare();

  console.log(`fetching ${plan.tiles.size.toLocaleString()} tiles (cache: ${path.relative(REPO_ROOT, cacheDir)}/z${ZOOM})…`);
  const t0 = Date.now();
  const queue = [...plan.tiles];
  let fetched = 0;
  let failed = 0;
  await Promise.all(
    Array.from({ length: FETCH_CONCURRENCY }, async () => {
      while (queue.length) {
        const [gx, gy] = queue.pop().split(",").map(Number);
        try {
          await provider.fetchPatch(ZOOM, { gx, gy, mx0: gx * 256, my0: gy * 256, span: 256 });
        } catch (err) {
          failed++;
          if (failed < 5) console.log(`  tile ${gx},${gy}: ${err.message}`);
        }
        if (++fetched % 250 === 0) process.stdout.write(`  ${fetched}/${plan.tiles.size} tiles\r`);
      }
    })
  );
  const fetchS = (Date.now() - t0) / 1000;
  console.log(
    `  ${plan.tiles.size.toLocaleString()} tiles ready in ${fetchS.toFixed(0)}s ` +
    `(${provider.requests.toLocaleString()} network requests, ${failed} failed)      `
  );

  console.log("sampling ground colour…");
  const { samples, counts } = await terrainPass(f, provider, plan.tiles);
  const { cells, measured, noImagery } = reduceCells(f, plan.scope, samples, counts);
  const { palette, idx, distinctSnapped, exact } = quantize(cells);

  console.log("sampling roofs…");
  const roofPassResult = await roofPass(f, provider, plan.mine, heights);
  const { roofs, suspect, stats: roofStats, spreads, thresholdRank } = roofPassResult;

  const spreadPct = spreads.length
    ? {
        p50: Math.round(pct(spreads, 0.5) * 1000) / 1000,
        p75: Math.round(pct(spreads, 0.75) * 1000) / 1000,
        p90: Math.round(pct(spreads, 0.9) * 1000) / 1000,
        p95: Math.round(pct(spreads, 0.95) * 1000) / 1000,
        p99: Math.round(pct(spreads, 0.99) * 1000) / 1000,
      }
    : null;

  const out = {
    _: "Generated by scripts/build-region-colors.mjs. Measured from Google 2D satellite tiles " +
       `at zoom ${ZOOM} (0.25 m/px), read as a BUILD-TIME SOURCE only — no imagery ships and no ` +
       "photograph is draped on the world. The terrain grid is emitted on region-terrain.json's " +
       "own lattice so the join is positional; `roofs` is a SIDECAR keyed by index into " +
       "region-osm.json's buildings array and is only valid while footprints.fingerprint matches " +
       "that file. The campus box (region.json core) is excluded — it has its own finer, " +
       "construction-aware colour pipeline. Do not hand-edit.",
    fetched: new Date().toISOString().slice(0, 10),
    source: {
      provider: provider.id,
      attribution: provider.attribution,
      zoom: ZOOM,
      mPerPx: Math.round(mPerMercPx(ZOOM, f.O.lat) * 10000) / 10000,
      tiles: plan.tiles.size,
    },
    epoch: {
      imagery: "current",
      heights: "2014 (USGS 3DEP CA_SanDiegoQL2_2014) — untouched by this file; no colour here is derived from a height",
      campusBox: "excluded: campus-colors.json / campus-truecolor.json own it, and they reject the Eighth College construction zone this imagery shows",
      construction:
        `regional roofs that read as bare earth AND disperse past ${SPREAD_SUSPECT} (p90 of the ` +
        `measured population), or past ${SPREAD_ALONE} (p99) whatever their hue, are held back in ` +
        "`suspect` rather than shipped as confident roof colours. READ THIS AS 'no single hex " +
        "describes this surface', NOT as 'under construction': checked against region-heights.json's " +
        "independent 2014-epoch signal, flagged roofs are no more likely to postdate the LiDAR flight " +
        "(16.5%) than confident ones (15.9%). A building site is one of the things this catches; " +
        "this file cannot tell you which ones",
    },
    gamut: GAMUT,
    terrain: {
      x0: f.th.x0, z0: f.th.z0, cell: f.th.cell, cols: f.th.cols, rows: f.th.rows,
      none: NONE_INDEX,
      palette,
      idx: Buffer.from(idx).toString("base64"),
    },
    footprints: { count: f.osm.buildings.length, fingerprint: footprintFingerprint(f.osm.buildings) },
    stats: {
      cells: {
        total: f.th.cols * f.th.rows,
        inScope: plan.inScope,
        measured,
        noImagery,
        insideCampusBox: plan.inCoreCells,
        outsideOutline: f.th.cols * f.th.rows - plan.inScope - plan.inCoreCells,
        distinctSnappedColours: distinctSnapped,
        exactPaletteHits: exact,
      },
      roofs: {
        inScope: plan.mine.length,
        ...roofStats,
        insideCampusBox: plan.inCoreBuildings,
        outsideOutline: plan.outsideOutline,
        spreadPercentiles: spreadPct,
        /* Where the two shipped thresholds actually sit in the population they
           were applied to, so the calibration is checkable from the file alone
           and not only from the console of the run that produced it. */
        spreadThresholds: {
          suspect: SPREAD_SUSPECT, suspectRank: Math.round(thresholdRank.suspect * 1000) / 1000,
          alone: SPREAD_ALONE, aloneRank: Math.round(thresholdRank.alone * 1000) / 1000,
        },
      },
    },
    roofs,
    suspect,
  };

  writeFileSync(OUT, JSON.stringify(out));
  const mb = readFileSync(OUT).length / 1048576;
  console.log(`wrote ${path.relative(REPO_ROOT, OUT)} — ${mb.toFixed(2)} MB`);
  console.log(
    `  ground: ${measured.toLocaleString()}/${plan.inScope.toLocaleString()} cells measured ` +
    `(${noImagery.toLocaleString()} with no imagery), ${palette.length} palette colours, ` +
    `${Math.round((exact / Math.max(1, measured)) * 100)}% of cells hit the palette exactly`
  );
  console.log(
    `  roofs: ${roofStats.measured.toLocaleString()}/${plan.mine.length.toLocaleString()} confident, ` +
    `${Object.keys(suspect).length} flagged (construction-suspect), ` +
    `${roofStats.tooSmall} too small once inset, ${roofStats.noTiles} without imagery`
  );
  if (spreadPct) console.log(`  roof spread: p50 ${spreadPct.p50}, p90 ${spreadPct.p90}, p95 ${spreadPct.p95}, p99 ${spreadPct.p99}`);
}

/* ------------------------------------------------------------------ check */

function check() {
  if (!existsSync(OUT)) { console.error(`FAIL: missing ${path.relative(REPO_ROOT, OUT)}`); process.exit(1); }
  const d = JSON.parse(readFileSync(OUT, "utf8"));
  const th = JSON.parse(readFileSync(TERRAIN, "utf8"));
  const osm = JSON.parse(readFileSync(OSM, "utf8"));

  const t = d.terrain;
  for (const k of ["x0", "z0", "cell", "cols", "rows"]) {
    if (t[k] !== th[k]) {
      console.error(`FAIL: colour grid ${k}=${t[k]} != region-terrain.json ${th[k]} — the positional join is broken`);
      process.exit(1);
    }
  }
  const idx = Buffer.from(t.idx, "base64");
  if (idx.length !== th.cols * th.rows) {
    console.error(`FAIL: ${idx.length} indices for ${th.cols * th.rows} cells`);
    process.exit(1);
  }
  if (!Array.isArray(t.palette) || !t.palette.length || t.palette.length > NONE_INDEX) {
    console.error(`FAIL: palette of ${t.palette?.length} colours`);
    process.exit(1);
  }
  for (const c of t.palette) {
    if (!/^#[0-9a-f]{6}$/.test(c)) { console.error(`FAIL: bad palette colour ${c}`); process.exit(1); }
  }
  let bad = 0;
  for (const v of idx) if (v !== t.none && v >= t.palette.length) bad++;
  if (bad) { console.error(`FAIL: ${bad} cell indices point outside the palette`); process.exit(1); }

  if (d.footprints.count !== osm.buildings.length) {
    console.error(`FAIL: sidecar covers ${d.footprints.count} footprints, region-osm.json ships ${osm.buildings.length}`);
    process.exit(1);
  }
  const fp = footprintFingerprint(osm.buildings);
  if (fp !== d.footprints.fingerprint) {
    console.error(
      `FAIL: footprint fingerprint ${fp} != sidecar's ${d.footprints.fingerprint} — ` +
      "region-osm.json was rebuilt and the roof colours no longer line up with it. " +
      "Re-run scripts/build-region-colors.mjs."
    );
    process.exit(1);
  }
  for (const [k, v] of Object.entries(d.roofs)) {
    if (!/^#[0-9a-f]{6}$/.test(v)) { console.error(`FAIL: bad roof colour ${v} at ${k}`); process.exit(1); }
    if (!osm.buildings[Number(k)]) { console.error(`FAIL: roof colour at index ${k} indexes nothing`); process.exit(1); }
  }
  const distinct = new Set(idx).size;
  console.log(
    `region-colors OK — ${t.cols}x${t.rows} @ ${t.cell} m, ${t.palette.length} palette colours, ` +
    `${distinct} distinct indices in use, ${Object.keys(d.roofs).length.toLocaleString()} roofs ` +
    `(+${Object.keys(d.suspect).length} suspect), fingerprint ${fp}`
  );
}

/* Invoked only, never on import — tests/region-colors.test.mjs imports the
   constants and the colour helpers to check the shipped file against the rules
   that produced it. build-campus-truecolor.mjs lacks this guard, which is why
   its gamut helpers are duplicated above instead of imported. */
const INVOKED = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (INVOKED) {
  if (PLAN) planReport(loadFrames());
  else if (CHECK) check();
  else await build();
}
