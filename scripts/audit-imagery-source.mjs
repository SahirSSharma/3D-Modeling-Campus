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
//
//   # spend ONE request on a live source before spending five hundred
//   node scripts/audit-imagery-source.mjs --probe=apple
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { makeProvider, cacheDirFor, mercX, mercY, mPerMercPx } from "./lib/imagery.mjs";

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

/* ------------------------------------------------------------- live probe */

/* A full rebuild is several hundred signed requests and several minutes. This
   spends a handful over one facility and answers the three things that can
   each waste all of that:
     1. does the service still return the size we asked for — the scale
        semantics are load-bearing, and a silent change would misplace every
        pixel measured afterwards;
     2. does the imagery land where the survey says it should — a source that
        resolves beautifully half a metre east is worse than a blurry one;
     3. is it actually sharper than what we already ship.
   Sampling is nearest-neighbour ON PURPOSE: the question is how much detail
   the source has, and any interpolation here would blur the answer. */
async function probe(sourceId, facility, x0, z0, x1, z1, origin, shipped) {
  /* Zoom is a knob, not a constant, because the right one is a measurement.
     Apple's own Maps app renders this campus at ~0.047 m/px, which is finer
     than z20 at scale=2 delivers (0.063) — so asking only z20 would leave
     detail on the table that the imagery demonstrably has. Probe both. */
  const ZOOM = Number(arg("zoom", "20"));
  const provider = makeProvider(sourceId, {
    root: ROOT, cacheDir: cacheDirFor(ROOT, sourceId), cap: 24,
  });
  await provider.prepare();

  const toLat = (z) => origin.lat - z / origin.mPerDegLat;
  const toLng = (x) => origin.lng + x / origin.mPerDegLng;

  const mxA = mercX(toLng(x0), ZOOM), mxB = mercX(toLng(x1), ZOOM);
  const myA = mercY(toLat(z0), ZOOM), myB = mercY(toLat(z1), ZOOM);
  const patches = provider.patchesFor(ZOOM, mxA, mxB, myA, myB);
  console.log(`probing ${sourceId}: ${patches.length} patch(es) at z${ZOOM}, cap 24 requests`);

  const tiles = [];
  for (const p of patches) {
    const file = await provider.fetchPatch(ZOOM, p);
    const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    tiles.push({ p, data, info });
    console.log(`  patch ${p.gx},${p.gy} -> ${info.width}x${info.height}px`);
    /* The size contract: subPx image pixels per Mercator pixel, exactly. */
    const want = p.span * provider.subPx;
    if (info.width !== want || info.height !== want) {
      throw new Error(
        `${sourceId} patch is ${info.width}x${info.height}, contract says ${want}x${want} — ` +
        `the service changed its scale semantics and every georeference would be wrong`
      );
    }
  }

  /* Reproject onto the shipped crop's own grid, so the two are pixel-aligned
     and directly differenceable. */
  const ppm = 1 / shipped.mPerPx;
  const W = shipped.w, H = shipped.h;
  const out = Buffer.alloc(W * H * 3, 0);
  let covered = 0;
  for (let r = 0; r < H; r++) {
    const my = mercY(toLat(z0 + (r + 0.5) / ppm), ZOOM);
    for (let c = 0; c < W; c++) {
      const mx = mercX(toLng(x0 + (c + 0.5) / ppm), ZOOM);
      for (const t of tiles) {
        const px = Math.floor((mx - t.p.mx0) * provider.subPx);
        const py = Math.floor((my - t.p.my0) * provider.subPx);
        if (px < 0 || py < 0 || px >= t.info.width || py >= t.info.height) continue;
        const s = (py * t.info.width + px) * t.info.channels;
        const d = (r * W + c) * 3;
        out[d] = t.data[s]; out[d + 1] = t.data[s + 1]; out[d + 2] = t.data[s + 2];
        covered++;
        break;
      }
    }
  }
  const coverage = covered / (W * H);

  /* Georegistration: slide the probe against the shipped crop and find the
     offset of best normalised correlation. Anything past a pixel or two is a
     projection bug, not imagery. */
  const ya = luma(shipped.buf, W, H, 3);
  const yb = luma(out, W, H, 3);
  const R = Math.max(2, Math.round(1.5 / shipped.mPerPx));
  let best = { ncc: -2, dx: 0, dz: 0 };
  for (let dz = -R; dz <= R; dz++) {
    for (let dx = -R; dx <= R; dx++) {
      let sa = 0, sb = 0, n = 0;
      for (let r = R; r < H - R; r += 2) for (let c = R; c < W - R; c += 2) {
        sa += ya[r * W + c]; sb += yb[(r + dz) * W + (c + dx)]; n++;
      }
      const ma = sa / n, mb = sb / n;
      let num = 0, da = 0, db = 0;
      for (let r = R; r < H - R; r += 2) for (let c = R; c < W - R; c += 2) {
        const u = ya[r * W + c] - ma, v = yb[(r + dz) * W + (c + dx)] - mb;
        num += u * v; da += u * u; db += v * v;
      }
      const ncc = num / Math.sqrt(da * db || 1);
      if (ncc > best.ncc) best = { ncc, dx, dz };
    }
  }

  const png = path.join(OUT_DIR, `${facility.id}-${sourceId}-probe.png`);
  await sharp(out, { raw: { width: W, height: H, channels: 3 } }).png().toFile(png);

  return {
    png, coverage, best, requests: provider.requests,
    row: await measure(out, W, H, 3, shipped.mPerPx, `probe (${sourceId} z${ZOOM})`),
    offsetM: { x: best.dx * shipped.mPerPx, z: best.dz * shipped.mPerPx },
  };
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

  const probeSource = arg("probe");
  let probed = null;
  if (probeSource) {
    probed = await probe(probeSource, facility, x0, z0, x1, z1, o, shipped);
    rows.push(probed.row);
  }

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
  if (probed) {
    console.log(
      `\nprobe: ${probed.requests} request(s), ${(probed.coverage * 100).toFixed(0)}% of the rect covered, ` +
      `wrote ${path.relative(ROOT, probed.png)}`
    );
    console.log(
      `georegistration: best correlation ${probed.best.ncc.toFixed(3)} at ` +
      `${probed.offsetM.x.toFixed(2)} m east, ${probed.offsetM.z.toFixed(2)} m south`
    );
    if (Math.hypot(probed.offsetM.x, probed.offsetM.z) > 0.6) {
      console.log(
        "  WARNING: that is a real displacement, not rounding. Colours measured " +
        "from this source would be sampled off the neighbouring surface."
      );
    }
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
