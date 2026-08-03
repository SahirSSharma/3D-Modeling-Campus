#!/usr/bin/env node
// Build docs/data/campus-colors.json — the campus's real colours, sampled from
// public-domain aerial imagery.
//
// WHY THIS EXISTS. Every colour the renderer used to show was a guess from a
// palette. The USDA's NAIP program photographs the whole country orthographically
// and places it in the public domain, which means the actual colour of every
// roof, lawn, plaza and canyon on campus is free to measure: Revelle Plaza's
// tan scored concrete, the terracotta of Center Hall, the chaparral brown of
// the canyons the campus is built between.
//
// WHAT IT MEASURES (source: imagery.nationalmap.gov USGSNAIPImagery, ~0.6 m):
//   terrain  a 6 m colour grid draped as vertex colours over the LiDAR ground
//   roofs    a colour per massing part / per OSM building (median of 5 samples)
//   ground   a colour per surveyed ground polygon (sampled inside the polygon)
//
// Pixels are read in a headless Chromium canvas because Node ships no image
// decoder; Playwright is already a dev dependency of the test suite.
//
// COUPLING. Roof colours key on the INDEX of the massing/building arrays and
// the ground array is parallel to campus-arcgis.json's — rebuild this file
// whenever campus-3d.json or campus-arcgis.json rebuild. --check asserts the
// lengths still line up.
//
// Usage:
//   node scripts/build-campus-colors.mjs           # fetch + sample + write
//   node scripts/build-campus-colors.mjs --check   # verify the shipped file
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CAMPUS = path.join(REPO_ROOT, "docs/data/campus-3d.json");
const ARCGIS = path.join(REPO_ROOT, "docs/data/campus-arcgis.json");
const LIDAR = path.join(REPO_ROOT, "docs/data/campus-lidar.json");
const OUT = path.join(REPO_ROOT, "docs/data/campus-colors.json");
const CHECK = process.argv.includes("--check");

const NAIP = "https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer/exportImage";
const COLOR_CELL = 6; // metres per terrain colour sample

function check() {
  const colors = JSON.parse(readFileSync(OUT, "utf8"));
  const arc = JSON.parse(readFileSync(ARCGIS, "utf8"));
  const campus = JSON.parse(readFileSync(CAMPUS, "utf8"));
  if (colors.ground.length !== arc.ground.length) {
    throw new Error(`ground colours ${colors.ground.length} != polygons ${arc.ground.length} — rebuild campus-colors`);
  }
  if (colors.massing.length !== arc.massing.length) {
    throw new Error(`massing colours ${colors.massing.length} != parts ${arc.massing.length} — rebuild campus-colors`);
  }
  if (colors.buildings.length !== campus.buildings.length) {
    throw new Error(`building colours ${colors.buildings.length} != buildings ${campus.buildings.length} — rebuild campus-colors`);
  }
  if (!colors.terrain?.idx?.length) throw new Error("terrain colour grid missing");
  console.log(`ok: ${colors.ground.length} ground, ${colors.massing.length} massing, ${colors.terrain.cols}x${colors.terrain.rows} terrain`);
}

async function build() {
  const campus = JSON.parse(readFileSync(CAMPUS, "utf8"));
  const arc = JSON.parse(readFileSync(ARCGIS, "utf8"));
  const lidar = JSON.parse(readFileSync(LIDAR, "utf8"));
  const O = campus.origin;
  const t = lidar.terrain;
  const X1 = t.x0 + (t.cols - 1) * t.cell;
  const Z1 = t.z0 + (t.rows - 1) * t.cell;

  /* One geographic-projection image of the whole box at ~1 m/px. */
  const north = O.lat - t.z0 / O.mPerDegLat;
  const south = O.lat - Z1 / O.mPerDegLat;
  const west = O.lng + t.x0 / O.mPerDegLng;
  const east = O.lng + X1 / O.mPerDegLng;
  const W = Math.min(3900, Math.round(X1 - t.x0));
  const H = Math.min(3900, Math.round(Z1 - t.z0));
  const url = `${NAIP}?f=image&format=jpgpng&bboxSR=4326&imageSR=4326` +
    `&bbox=${west},${south},${east},${north}&size=${W},${H}`;
  console.log(`fetching NAIP ${W}x${H}…`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`NAIP: HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  console.log(`  ${(bytes.length / 1048576).toFixed(1)} MB`);

  /* Sample jobs, all in local metres. */
  const jobs = {
    // terrain: raster order, one entry per 6 m cell
    terrain: { x0: t.x0, z0: t.z0, cell: COLOR_CELL,
      cols: Math.floor((X1 - t.x0) / COLOR_CELL) + 1,
      rows: Math.floor((Z1 - t.z0) / COLOR_CELL) + 1 },
    // per massing part: centroid + 4 inset points, median
    massing: arc.massing.map((m) => ringSamples(m.r[0].map(([x, z]) => [x / 10, z / 10]))),
    buildings: campus.buildings.map((b) => ringSamples(b.p)),
    ground: arc.ground.map((g) => ringSamples(g.r[0].map(([x, z]) => [x / 10, z / 10]), 1)),
  };

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const result = await page.evaluate(
      async ({ png, jobs, geo }) => {
        const img = new Image();
        img.src = "data:image/png;base64," + png;
        await img.decode();
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, img.width, img.height).data;

        const px = (x, z) => {
          // local metres -> lat/lng -> pixel
          const lat = geo.lat0 - z / geo.mLat;
          const lng = geo.lng0 + x / geo.mLng;
          const c = Math.round(((lng - geo.west) / (geo.east - geo.west)) * (img.width - 1));
          const r = Math.round(((geo.north - lat) / (geo.north - geo.south)) * (img.height - 1));
          if (c < 0 || c >= img.width || r < 0 || r >= img.height) return null;
          const i = (r * img.width + c) * 4;
          if (data[i + 3] < 200) return null; // outside imagery
          return [data[i], data[i + 1], data[i + 2]];
        };
        const median = (pts) => {
          const got = pts.map(([x, z]) => px(x, z)).filter(Boolean);
          if (!got.length) return null;
          const ch = (k) => got.map((g) => g[k]).sort((a, b) => a - b)[got.length >> 1];
          return [ch(0), ch(1), ch(2)];
        };
        const hex = (rgb) => rgb &&
          "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");

        const terrain = [];
        for (let r = 0; r < jobs.terrain.rows; r++) {
          for (let c = 0; c < jobs.terrain.cols; c++) {
            terrain.push(px(jobs.terrain.x0 + c * jobs.terrain.cell, jobs.terrain.z0 + r * jobs.terrain.cell));
          }
        }
        return {
          terrain,
          massing: jobs.massing.map((pts) => hex(median(pts))),
          buildings: jobs.buildings.map((pts) => hex(median(pts))),
          ground: jobs.ground.map((pts) => hex(median(pts))),
        };
      },
      {
        png: bytes.toString("base64"),
        jobs,
        geo: { lat0: O.lat, lng0: O.lng, mLat: O.mPerDegLat, mLng: O.mPerDegLng, north, south, west, east },
      }
    );

    /* Terrain to a small palette + base64 indexes: raw RGB per cell would be
       megabytes; 48 clustered colours are indistinguishable draped at 6 m. */
    const { palette, idx } = quantize(result.terrain);
    const out = {
      _: "Generated by scripts/build-campus-colors.mjs from USDA NAIP aerial imagery (public domain, via USGS). Parallel to campus-3d/campus-arcgis — rebuild together. Do not hand-edit.",
      fetched: new Date().toISOString().slice(0, 10),
      terrain: { ...jobs.terrain, palette, idx: Buffer.from(idx).toString("base64") },
      massing: result.massing,
      buildings: result.buildings,
      ground: result.ground,
    };
    writeFileSync(OUT, JSON.stringify(out));
    const kb = Math.round(readFileSync(OUT).length / 1024);
    console.log(`wrote ${OUT} — ${kb} KB`);
    console.log(`  ${palette.length} terrain colours over ${jobs.terrain.cols}x${jobs.terrain.rows} cells`);
    console.log(`  ${result.massing.filter(Boolean).length}/${result.massing.length} massing parts coloured, ` +
      `${result.ground.filter(Boolean).length}/${result.ground.length} ground polygons`);
  } finally {
    await browser.close();
  }
}

/** Centroid + 4 points pulled 35% toward it from the ring's extremes. */
function ringSamples(ring, extra = 4) {
  let cx = 0;
  let cz = 0;
  for (const [x, z] of ring) { cx += x; cz += z; }
  cx /= ring.length;
  cz /= ring.length;
  const pts = [[cx, cz]];
  if (extra >= 4) {
    let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity;
    for (const [x, z] of ring) {
      if (x < minx) minx = x;
      if (x > maxx) maxx = x;
      if (z < minz) minz = z;
      if (z > maxz) maxz = z;
    }
    for (const [ex, ez] of [[minx, cz], [maxx, cz], [cx, minz], [cx, maxz]]) {
      pts.push([ex + (cx - ex) * 0.35, ez + (cz - ez) * 0.35]);
    }
  }
  return pts;
}

/** Fixed-step RGB clustering: snap to a 5-bit-ish lattice, keep the most
    common colours, map the rest to their nearest kept colour. */
function quantize(cells) {
  const KEEP = 48;
  const counts = new Map();
  const snapped = cells.map((rgb) => {
    if (!rgb) return null;
    const key = rgb.map((v) => Math.round(v / 12) * 12).join(",");
    counts.set(key, (counts.get(key) || 0) + 1);
    return key;
  });
  const kept = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, KEEP - 1)
    .map(([k]) => k.split(",").map(Number));
  const paletteHex = kept.map((rgb) => "#" + rgb.map((v) => Math.min(255, v).toString(16).padStart(2, "0")).join(""));
  const nearest = (rgb) => {
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < kept.length; i++) {
      const d = (kept[i][0] - rgb[0]) ** 2 + (kept[i][1] - rgb[1]) ** 2 + (kept[i][2] - rgb[2]) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  };
  const cache = new Map();
  const idx = new Uint8Array(cells.length);
  cells.forEach((rgb, i) => {
    if (!rgb) { idx[i] = 255; return; } // 255 = no imagery, renderer keeps its default
    const key = snapped[i];
    if (!cache.has(key)) cache.set(key, nearest(key.split(",").map(Number)));
    idx[i] = cache.get(key);
  });
  return { palette: paletteHex, idx };
}

if (CHECK) check();
else await build();
