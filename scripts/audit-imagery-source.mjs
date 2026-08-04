#!/usr/bin/env node
// Is one imagery source actually sharper than another over THIS campus?
//
// The claim that motivates a source swap — "Apple's satellite view is clearer"
// — is an impression until something measures it, and impressions are exactly
// what this project replaces with numbers everywhere else. So: crop the same
// ground from each source and measure how much real detail is in the pixels.
//
// WHAT IS MEASURED, and why these two:
//
//   gradPerM   mean gradient magnitude per metre of ground. Blur destroys
//              gradient; upsampling from a coarser original adds pixels but no
//              gradient. A source that merely SCALES UP scores the same as the
//              coarse original, which is the whole trap this catches.
//   edgeRiseM  the 10-90% rise distance, in METRES, across the strongest edges
//              found. This is effective ground resolution stated in the units
//              the rest of the project uses: a painted line or a kerb either
//              resolves in 0.1 m or it does not. Lower is sharper.
//
// Both are reported per metre, never per pixel, so images at different pixel
// scales compare honestly — a 2x upsample of the same photograph scores the
// same as the original, which is the point.
//
// Usage:
//   # crop a facility out of the shipped chunks and measure it
//   node scripts/audit-imagery-source.mjs --facility=muir-tennis-west
//
//   # measure an external image of the same ground (e.g. an Apple Maps
//   # screenshot). Its scale is unknown, so it is RULED by the facility's own
//   # regulation dimensions: --width-m is the real ground width the image spans.
//   node scripts/audit-imagery-source.mjs --facility=muir-tennis-west \
//        --compare=/path/apple.png --width-m=120
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEX = path.join(ROOT, "docs/data/textures");
const OUT_DIR = path.join(ROOT, "scripts/reports/imagery");

const arg = (name, dflt = null) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};

/* ------------------------------------------------------------- the metrics */

/** Luminance plane of an RGB buffer, as Float64 in 0..255. */
function luma(rgb, w, h, channels) {
  const y = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const o = i * channels;
    y[i] = 0.2126 * rgb[o] + 0.7152 * rgb[o + 1] + 0.0722 * rgb[o + 2];
  }
  return y;
}

/** Mean Sobel gradient magnitude, expressed per METRE of ground so that two
 *  images at different pixel scales are directly comparable. */
function gradPerM(y, w, h, mPerPx) {
  let sum = 0, n = 0;
  for (let r = 1; r < h - 1; r++) {
    for (let c = 1; c < w - 1; c++) {
      const i = r * w + c;
      const gx =
        -y[i - w - 1] - 2 * y[i - 1] - y[i + w - 1] +
        y[i - w + 1] + 2 * y[i + 1] + y[i + w + 1];
      const gz =
        -y[i - w - 1] - 2 * y[i - w] - y[i - w + 1] +
        y[i + w - 1] + 2 * y[i + w] + y[i + w + 1];
      sum += Math.hypot(gx, gz) / 8; // per pixel
      n++;
    }
  }
  /* per pixel -> per metre: a gradient of g levels per pixel is g/mPerPx
     levels per metre. */
  return n ? (sum / n) / mPerPx : 0;
}

/** The 10-90% rise distance across the strongest horizontal edges, in metres.
 *  Scans each row for large steps, walks out to the local plateaus either
 *  side, and measures how far the signal takes to cross from 10% to 90% of
 *  that step. Blur widens the rise; real resolution keeps it short. */
function edgeRiseM(y, w, h, mPerPx) {
  const rises = [];
  const MAXW = Math.max(4, Math.ceil(1.5 / mPerPx)); // never look past 1.5 m
  for (let r = 2; r < h - 2; r += 2) {
    for (let c = MAXW; c < w - MAXW; c++) {
      const i = r * w + c;
      const step = y[i + 1] - y[i - 1];
      if (Math.abs(step) < 40) continue; // only unambiguous edges

      /* Plateaus: walk out until the signal stops moving the same way. */
      const dir = Math.sign(step);
      let lo = y[i - 1], hi = y[i + 1];
      let a = c - 1, b = c + 1;
      while (a > c - MAXW && dir * (y[r * w + a - 1] - lo) < 0) { a--; lo = y[r * w + a]; }
      while (b < c + MAXW && dir * (y[r * w + b + 1] - hi) > 0) { b++; hi = y[r * w + b]; }
      const amp = hi - lo;
      if (Math.abs(amp) < 50) continue;

      const t10 = lo + 0.1 * amp, t90 = lo + 0.9 * amp;
      let p10 = null, p90 = null;
      for (let x = a; x <= b; x++) {
        const v = y[r * w + x];
        if (p10 === null && dir * (v - t10) >= 0) p10 = x;
        if (p10 !== null && dir * (v - t90) >= 0) { p90 = x; break; }
      }
      if (p10 === null || p90 === null) continue;
      const width = Math.abs(p90 - p10) + 1;
      if (width > MAXW) continue;
      rises.push(width * mPerPx);
      c = b; // don't re-measure the same edge
    }
  }
  if (!rises.length) return { edgeRiseM: null, edges: 0 };
  rises.sort((p, q) => p - q);
  return { edgeRiseM: rises[Math.floor(rises.length / 2)], edges: rises.length };
}

async function measure(buf, w, h, channels, mPerPx, label) {
  const y = luma(buf, w, h, channels);
  const g = gradPerM(y, w, h, mPerPx);
  const { edgeRiseM: rise, edges } = edgeRiseM(y, w, h, mPerPx);
  return {
    label, w, h,
    mPerPx: Number(mPerPx.toFixed(4)),
    gradPerM: Number(g.toFixed(1)),
    edgeRiseM: rise === null ? null : Number(rise.toFixed(3)),
    edges,
  };
}

/* ------------------------------------------------- crop from shipped chunks */

/** Cut the ground rect [x0,z0,x1,z1] (local metres) out of the shipped chunk
 *  mosaic. Chunks tile the plane, so a rect can straddle several. */
async function cropShipped(manifest, x0, z0, x1, z1) {
  const hits = manifest.chunks.filter(
    (c) => c.x0 < x1 && c.x1 > x0 && c.z0 < z1 && c.z1 > z0
  );
  if (!hits.length) throw new Error("no shipped chunk covers that ground");
  /* All hit chunks must share a resolution for a single crop to be coherent;
     if they differ, take the finest and report it. */
  const ppm = Math.max(...hits.map((c) => c.w / (c.x1 - c.x0)));
  const W = Math.round((x1 - x0) * ppm);
  const H = Math.round((z1 - z0) * ppm);
  const out = Buffer.alloc(W * H * 3, 0);

  for (const c of hits) {
    const { data, info } = await sharp(path.join(TEX, c.file)).raw().toBuffer({ resolveWithObject: true });
    const cppm = c.w / (c.x1 - c.x0);
    for (let r = 0; r < H; r++) {
      const z = z0 + (r + 0.5) / ppm;
      if (z < c.z0 || z >= c.z1) continue;
      const sr = Math.min(info.height - 1, Math.floor((z - c.z0) * cppm));
      for (let col = 0; col < W; col++) {
        const x = x0 + (col + 0.5) / ppm;
        if (x < c.x0 || x >= c.x1) continue;
        const sc = Math.min(info.width - 1, Math.floor((x - c.x0) * cppm));
        const s = (sr * info.width + sc) * info.channels;
        const d = (r * W + col) * 3;
        out[d] = data[s]; out[d + 1] = data[s + 1]; out[d + 2] = data[s + 2];
      }
    }
  }
  return { buf: out, w: W, h: H, mPerPx: 1 / ppm };
}

/* -------------------------------------------------------------------- main */

async function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(TEX, "manifest.json"), "utf8"));
  const markings = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/data/campus-markings.json"), "utf8"));
  const facilityId = arg("facility", "muir-tennis-west");
  const facility = markings.facilities.find((f) => f.id === facilityId);
  if (!facility) {
    throw new Error(
      `unknown facility "${facilityId}" — have: ${markings.facilities.map((f) => f.id).join(", ")}`
    );
  }

  const xs = facility.bounds.map((p) => p[0]);
  const zs = facility.bounds.map((p) => p[1]);
  const pad = Number(arg("pad-m", "12"));
  const x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad;
  const z0 = Math.min(...zs) - pad, z1 = Math.max(...zs) + pad;

  const o = markings.origin;
  const lat = o.lat - ((z0 + z1) / 2) / o.mPerDegLat;
  const lng = o.lng + ((x0 + x1) / 2) / o.mPerDegLng;

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const rows = [];

  const shipped = await cropShipped(manifest, x0, z0, x1, z1);
  const shippedPng = path.join(OUT_DIR, `${facilityId}-${manifest.source || "google"}.png`);
  await sharp(shipped.buf, { raw: { width: shipped.w, height: shipped.h, channels: 3 } })
    .png().toFile(shippedPng);
  rows.push(await measure(
    shipped.buf, shipped.w, shipped.h, 3, shipped.mPerPx,
    `shipped (${manifest.source || "google"})`
  ));

  const comparePath = arg("compare");
  if (comparePath) {
    const widthM = Number(arg("width-m", String(x1 - x0)));
    const { data, info } = await sharp(comparePath).removeAlpha().raw()
      .toBuffer({ resolveWithObject: true });
    rows.push(await measure(
      data, info.width, info.height, info.channels, widthM / info.width,
      `compare (${path.basename(comparePath)})`
    ));
  }

  console.log(`\nfacility ${facilityId} — ${facility.kind}, fitError ${facility.fitError_m} m, coverage ${facility.fitCoverage}`);
  console.log(`ground rect ${Math.round(x1 - x0)} x ${Math.round(z1 - z0)} m, centre ${lat.toFixed(6)},${lng.toFixed(6)}`);
  console.log(`wrote ${path.relative(ROOT, shippedPng)}\n`);
  console.log(
    ["source".padEnd(34), "px".padEnd(12), "m/px".padEnd(8), "grad/m".padEnd(9), "edgeRise m", "edges"].join(" ")
  );
  for (const r of rows) {
    console.log([
      r.label.padEnd(34),
      `${r.w}x${r.h}`.padEnd(12),
      String(r.mPerPx).padEnd(8),
      String(r.gradPerM).padEnd(9),
      String(r.edgeRiseM ?? "-").padEnd(10),
      String(r.edges),
    ].join(" "));
  }
  if (rows.length === 2) {
    const [a, b] = rows;
    const sharper = b.edgeRiseM !== null && a.edgeRiseM !== null
      ? (a.edgeRiseM / b.edgeRiseM)
      : null;
    console.log(
      `\nverdict: compare resolves ${sharper ? sharper.toFixed(2) + "x" : "?"} finer edges ` +
      `and carries ${(b.gradPerM / a.gradPerM).toFixed(2)}x the detail per metre.\n` +
      `(a swap is only worth it if BOTH are meaningfully above 1.0 — more pixels ` +
      `alone would move neither.)`
    );
  }
  console.log("");
}

main().catch((err) => { console.error(err.message); process.exit(1); });
