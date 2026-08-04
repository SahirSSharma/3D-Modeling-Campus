#!/usr/bin/env node
// Turn a screen capture of somebody else's map into a MEASURABLE reference.
//
// A screenshot is not evidence. It has no projection, no origin and no scale,
// so anything read off it is an impression — and this project does not build
// from impressions. This script gives a capture the two things it lacks:
//
//   SCALE     from the Apple Maps scale bar drawn into the image itself. The
//             tick labels (0 / 13 / 26 / 39 ft) are located by their glyphs and
//             the mean tick spacing becomes metres per pixel. Ground truth, put
//             there by the renderer, not inferred by us.
//   POSITION  by correlating the capture against the georeferenced chunks
//             already shipped in docs/data/textures. Those carry the site's
//             local metre frame, so a match places the capture in it.
//
// The result is a ground rect in local metres, which is the frame every other
// data file in this repo speaks. Once a capture has one, a feature measured in
// its pixels can be stated in metres and checked against the survey — and a
// capture that does NOT register (low correlation) is reported as such rather
// than quietly trusted.
//
// The captures themselves are never committed: they are somebody else's
// imagery. Only the measurements derived from them are.
//
// Usage:
//   node scripts/register-reference.mjs --image=cap3.png --near=rimac-north
//   node scripts/register-reference.mjs --image=cap.png --near=rimac-north --m-per-px=0.0566
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEX = path.join(ROOT, "docs/data/textures");

const arg = (n, d = null) => {
  const hit = process.argv.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : d;
};

/* --------------------------------------------------------- the scale bar */

/** Read Apple Maps' own scale bar. Returns metres per pixel, or null.
 *  The bar's stroke is low contrast over pale ground, so the TICK LABELS are
 *  what get measured: their glyph clusters are unambiguous, and the spacing
 *  between successive label centres is a known number of feet. */
export function readScaleBar(lumAt, W, H, { feetPerTick = 13, ticks = 4 } = {}) {
  /* The bar sits in the top strip. Scanning the FULL width fails on a wide
     capture: sunlit concrete and road paint clear any brightness threshold,
     and the glyph clustering drowns. So slide a window about the width of the
     bar and require the tick labels to be evenly spaced INSIDE it — four
     equal gaps is a signature ground clutter does not produce. */
  const R1 = Math.min(H - 1, Math.round(H * 0.12));
  const WIN = 760, STEP = 60;
  let bestRun = null;

  for (let r = 0; r < R1 - 18; r += 2) {
    for (let w0 = 0; w0 + WIN <= W; w0 += STEP) {
      /* Glyphs are near-white AND much brighter than their surroundings, so
         the threshold is local — the map dims the strip behind its own chrome
         but the ground under it can be anything. */
      let sum = 0, n0 = 0;
      for (let rr = r; rr < r + 18; rr += 2) for (let c = w0; c < w0 + WIN; c += 4) { sum += lumAt(rr, c); n0++; }
      const T = Math.max(200, sum / n0 + 45);

      const occ = new Int32Array(WIN);
      let any = 0;
      for (let c = 0; c < WIN; c++) {
        let n = 0;
        for (let rr = r; rr < Math.min(R1, r + 18); rr++) if (lumAt(rr, w0 + c) > T) n++;
        occ[c] = n;
        if (n) any++;
      }
      if (any < 20 || any > WIN * 0.5) continue;

      const runs = [];
      let s = -1;
      for (let c = 0; c <= WIN; c++) {
        const on = c < WIN && occ[c] > 0;
        if (on && s < 0) s = c;
        if (!on && s >= 0) { if (c - s >= 3) runs.push([s, c - 1]); s = -1; }
      }
      if (runs.length < ticks) continue;

      /* Digits WITHIN one label sit 2-4 px apart; labels sit tens apart. Keep
         this gap tight: at 22 px the trailing unit ("ft") merges into the last
         number, dragging that tick right and failing the evenness test — which
         is exactly how this silently found nothing at all. */
      const labels = [];
      for (const [a, b] of runs) {
        const last = labels[labels.length - 1];
        if (last && a - last.b <= 6) last.b = b;
        else labels.push({ a, b });
      }
      if (labels.length < ticks) continue;

      /* Try every run of `ticks` consecutive labels; the trailing unit ("ft")
         is itself a label and must not be mistaken for a tick. */
      for (let i = 0; i + ticks <= labels.length; i++) {
        const mids = labels.slice(i, i + ticks).map((l) => {
          let s2 = 0, wt = 0;
          for (let c = l.a; c <= l.b; c++) { s2 += c * occ[c]; wt += occ[c]; }
          return s2 / wt;
        });
        const gaps = [];
        for (let k = 1; k < mids.length; k++) gaps.push(mids[k] - mids[k - 1]);
        const mean = gaps.reduce((x, y) => x + y, 0) / gaps.length;
        if (mean < 20) continue;
        const spread = Math.max(...gaps) - Math.min(...gaps);
        if (spread / mean > 0.06) continue; // evenly spaced, or it is not a scale bar

        /* EVEN SPACING IS NOT ENOUGH. A line of fence panels and a row of
           mown stripes are both evenly spaced and bright, and both were
           happily "detected" as scale bars over RIMAC Field until this check
           existed — one of them would have set the scale for the whole model.
           What a real bar has and a fence does not is a UNIT label: a final
           cluster ("ft") sitting much closer than one tick spacing after the
           last tick. A periodic ground feature just carries on at its period. */
        const after = labels[i + ticks];
        if (!after) continue;
        const tail = (after.a + after.b) / 2 - mids[mids.length - 1];
        if (tail < 0.15 * mean || tail > 0.6 * mean) continue;

        if (!bestRun || mean > bestRun.mean) {
          bestRun = {
            mean, gaps, tail, mids: mids.map((m) => m + w0),
            mPerPx: (feetPerTick * 0.3048) / mean,
          };
        }
      }
    }
  }
  return bestRun;
}

/* ------------------------------------------------------------ correlation */

function luma(rgb, w, h, C) {
  const y = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const o = i * C;
    y[i] = 0.2126 * rgb[o] + 0.7152 * rgb[o + 1] + 0.0722 * rgb[o + 2];
  }
  return y;
}

/** Gradient magnitude — what two epochs of the same ground still agree on.
 *  Matching raw brightness across sources fails on turf: mowing direction,
 *  wear patches, season and sun angle all rewrite a field's tone completely,
 *  and a lawn correlated against the same lawn a year later scores near zero.
 *  Painted lines, kerbs, fences and pavement edges do not move, so matching
 *  where the image CHANGES rather than how bright it is compares the geometry
 *  the two sources share instead of the tone they do not. */
function edges(y, w, h) {
  const g = new Float64Array(w * h);
  for (let r = 1; r < h - 1; r++) {
    for (let c = 1; c < w - 1; c++) {
      const i = r * w + c;
      const gx = -y[i - w - 1] - 2 * y[i - 1] - y[i + w - 1] + y[i - w + 1] + 2 * y[i + 1] + y[i + w + 1];
      const gz = -y[i - w - 1] - 2 * y[i - w] - y[i - w + 1] + y[i + w - 1] + 2 * y[i + w] + y[i + w + 1];
      g[i] = Math.hypot(gx, gz) / 8;
    }
  }
  return g;
}

/** Normalised cross-correlation of `tpl` (tw x th) placed at (ox, oy) in `img`. */
function ncc(img, iw, ih, tpl, tw, th, ox, oy, step) {
  let sa = 0, sb = 0, n = 0;
  for (let r = 0; r < th; r += step) {
    const ir = oy + r;
    if (ir < 0 || ir >= ih) return -2;
    for (let c = 0; c < tw; c += step) {
      const ic = ox + c;
      if (ic < 0 || ic >= iw) return -2;
      sa += img[ir * iw + ic]; sb += tpl[r * tw + c]; n++;
    }
  }
  if (!n) return -2;
  const ma = sa / n, mb = sb / n;
  let num = 0, da = 0, db = 0;
  for (let r = 0; r < th; r += step) {
    const ir = oy + r;
    for (let c = 0; c < tw; c += step) {
      const u = img[ir * iw + (ox + c)] - ma, v = tpl[r * tw + c] - mb;
      num += u * v; da += u * u; db += v * v;
    }
  }
  return num / Math.sqrt(da * db || 1);
}

/* ------------------------------------------------- the shipped chunk mosaic */

/** Render the shipped chunks over a ground rect at a chosen resolution. */
async function shippedAt(manifest, x0, z0, x1, z1, mPerPx) {
  const W = Math.round((x1 - x0) / mPerPx);
  const H = Math.round((z1 - z0) / mPerPx);
  const out = Buffer.alloc(W * H * 3, 0);
  const hits = manifest.chunks.filter((c) => c.x0 < x1 && c.x1 > x0 && c.z0 < z1 && c.z1 > z0);
  for (const c of hits) {
    const { data, info } = await sharp(path.join(TEX, c.file)).raw().toBuffer({ resolveWithObject: true });
    const cppm = c.w / (c.x1 - c.x0);
    for (let r = 0; r < H; r++) {
      const z = z0 + (r + 0.5) * mPerPx;
      if (z < c.z0 || z >= c.z1) continue;
      const sr = Math.min(info.height - 1, Math.floor((z - c.z0) * cppm));
      for (let col = 0; col < W; col++) {
        const x = x0 + (col + 0.5) * mPerPx;
        if (x < c.x0 || x >= c.x1) continue;
        const sc = Math.min(info.width - 1, Math.floor((x - c.x0) * cppm));
        const s = (sr * info.width + sc) * info.channels;
        const d = (r * W + col) * 3;
        out[d] = data[s]; out[d + 1] = data[s + 1]; out[d + 2] = data[s + 2];
      }
    }
  }
  return { buf: out, w: W, h: H };
}

/* -------------------------------------------------------------------- main */

async function main() {
  const imgPath = arg("image");
  if (!imgPath) throw new Error("--image is required");
  const manifest = JSON.parse(fs.readFileSync(path.join(TEX, "manifest.json"), "utf8"));
  const markings = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/data/campus-markings.json"), "utf8"));

  const nearId = arg("near", "rimac-north");
  const near = markings.facilities.find((f) => f.id === nearId);
  if (!near) throw new Error(`unknown facility "${nearId}"`);
  const nx = near.bounds.reduce((s, p) => s + p[0], 0) / near.bounds.length;
  const nz = near.bounds.reduce((s, p) => s + p[1], 0) / near.bounds.length;

  const raw = await sharp(imgPath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: IW, height: IH, channels: IC } = raw.info;
  const iy = luma(raw.data, IW, IH, IC);
  const lumAt = (r, c) => iy[r * IW + c];

  let mPerPx = arg("m-per-px") ? Number(arg("m-per-px")) : null;
  let bar = null;
  if (!mPerPx) {
    bar = readScaleBar(lumAt, IW, IH);
    if (!bar) {
      throw new Error(
        "no scale bar found — pass --m-per-px, or recapture with the Maps scale bar visible. " +
        "Guessing the scale would make every measurement from this image wrong."
      );
    }
    /* CONFIRMATION IS MANDATORY, and the reason is a real false positive: over
       RIMAC Field a line of fence panels and a set of mown stripes were each
       detected as a scale bar — evenly spaced, bright, even carrying a
       plausible trailing cluster. No pixel heuristic reliably separates a
       ruler from a fence, and a wrong scale does not announce itself: it
       silently mis-sizes everything measured afterwards. So the bar gets
       written out to be LOOKED at, and nothing proceeds until someone says
       that is a scale bar and reads its tick value off it. */
    const x0 = Math.max(0, Math.round(bar.mids[0] - bar.mean));
    const x1 = Math.min(IW, Math.round(bar.mids[bar.mids.length - 1] + 2 * bar.mean));
    const crop = path.join(path.dirname(imgPath), `${path.basename(imgPath, path.extname(imgPath))}-bar.png`);
    await sharp(imgPath).extract({
      left: x0, top: 0, width: Math.max(40, x1 - x0), height: Math.min(IH, Math.round(IH * 0.12)),
    }).resize((Math.max(40, x1 - x0)) * 2, null, { kernel: "nearest" }).png().toFile(crop);

    const perTick = arg("ft-per-tick");
    if (!perTick) {
      console.log(`\ncandidate scale bar written to ${crop}`);
      console.log(
        `ticks are ${bar.gaps.map((g) => g.toFixed(1)).join(", ")} px apart. LOOK at that crop:\n` +
        `  - if it is not a scale bar, this image cannot be registered from it\n` +
        `  - if it is, read the tick interval off it and rerun with --ft-per-tick=<n>\n` +
        `Apple changes the tick value with zoom (13, 16, 33, 66 ft ...), so it must be read, not assumed.\n`
      );
      return;
    }
    mPerPx = (Number(perTick) * 0.3048) / bar.mean;
  }

  const groundW = IW * mPerPx, groundH = IH * mPerPx;
  console.log(`\n${path.basename(imgPath)} — ${IW}x${IH}px`);
  if (bar) {
    console.log(
      `scale bar: ticks ${bar.gaps.map((g) => g.toFixed(1)).join(", ")} px per 13 ft ` +
      `-> ${mPerPx.toFixed(5)} m/px`
    );
  } else {
    console.log(`scale: ${mPerPx.toFixed(5)} m/px (given)`);
  }
  console.log(`covers ${groundW.toFixed(1)} x ${groundH.toFixed(1)} m of ground`);

  /* Coarse pass at 1 m/px over a generous search box, then refine. Correlating
     at full resolution over +-200 m would be hundreds of millions of taps. */
  const SEARCH = Number(arg("search-m", "220"));
  /* The coarse pass exists to TELL the fine pass where to look. Centring both
     on the facility instead makes the second pass useless the moment the first
     one finds a match more than its own +-3 m away, which is most of the time
     — and it fails quietly, as a low score rather than an error. */
  let cx = nx, cz = nz;
  for (const [level, res, half] of [["coarse", 1.0, SEARCH], ["fine", 0.25, 4]]) {
    const sx0 = cx - groundW / 2 - half, sx1 = cx + groundW / 2 + half;
    const sz0 = cz - groundH / 2 - half, sz1 = cz + groundH / 2 + half;
    const ship = await shippedAt(manifest, sx0, sz0, sx1, sz1, res);
    const sy = edges(luma(ship.buf, ship.w, ship.h, 3), ship.w, ship.h);

    const tw = Math.max(8, Math.round(groundW / res));
    const th = Math.max(8, Math.round(groundH / res));
    const tpl = await sharp(raw.data, { raw: { width: IW, height: IH, channels: IC } })
      .resize(tw, th, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
    const ty = edges(luma(tpl.data, tw, th, tpl.info.channels), tw, th);

    let best = { ncc: -2, ox: 0, oy: 0 };
    const step = level === "coarse" ? 3 : 2;
    for (let oy = 0; oy + th < ship.h; oy++) {
      for (let ox = 0; ox + tw < ship.w; ox++) {
        const v = ncc(sy, ship.w, ship.h, ty, tw, th, ox, oy, step);
        if (v > best.ncc) best = { ncc: v, ox, oy };
      }
    }
    const gx0 = sx0 + best.ox * res, gz0 = sz0 + best.oy * res;
    console.log(
      `${level}: correlation ${best.ncc.toFixed(3)} -> ground rect ` +
      `x ${gx0.toFixed(1)} .. ${(gx0 + groundW).toFixed(1)} m, ` +
      `z ${gz0.toFixed(1)} .. ${(gz0 + groundH).toFixed(1)} m`
    );
    if (level === "coarse") { cx = gx0 + groundW / 2; cz = gz0 + groundH / 2; }
    if (level === "fine") {
      const o = markings.origin;
      console.log(
        `centre ${(o.lat - (gz0 + groundH / 2) / o.mPerDegLat).toFixed(6)},` +
        `${(o.lng + (gx0 + groundW / 2) / o.mPerDegLng).toFixed(6)}`
      );
      if (best.ncc < 0.45) {
        console.log(
          "\nWARNING: that correlation is too low to trust. The capture may cover " +
          "ground the shipped chunks do not, or the epochs may differ too much to " +
          "match. Do NOT measure positions from it until it registers."
        );
      } else {
        console.log(`\nregistered. Pixel (px,py) is ground x = ${gx0.toFixed(1)} + px*${mPerPx.toFixed(5)}, z = ${gz0.toFixed(1)} + py*${mPerPx.toFixed(5)}`);
      }
    }
  }
  console.log("");
}

if (process.argv[1] && process.argv[1].endsWith("register-reference.mjs")) {
  main().catch((err) => { console.error(err.message); process.exit(1); });
}
