// Every painted line on every sports surface, measured off the satellite
// imagery and re-emitted as vectors.
//
// The georeferenced chunks under docs/data/textures/ are the SOURCE here, not
// a texture: for each facility this script fits the painted layout — centre,
// orientation, true extent — to the white paint actually visible in the
// imagery (template fit maximising line-paint response, refined by coordinate
// descent), then emits REGULATION marking geometry at the fitted frame:
// soccer touchlines, boxes and arcs; the full tennis line set; basketball
// keys and three-point arcs; the track's lane lines and curved ends.
//
// Fit quality is not taken on faith, twice over. For every facility the
// script measures the perpendicular offset between its emitted lines and the
// paint's local whiteness centroid (fitError_m) AND the fraction of the
// emitted line that actually lies ON paint (fitCoverage — the metric that
// catches a rotated misfit, which the offset metric structurally cannot; see
// the gate notes above `COVER_GATE`). --overlay renders the vectors onto the
// imagery crop so a human can see the lines sit on the paint. The build
// fails loudly past 0.5 m mean error, and DROPS any facility under its
// coverage gate rather than shipping a wrong fit.
//
// Output: docs/data/campus-markings.json, drawn by docs/js/campus-markings.js.
//
//   node scripts/build-campus-markings.mjs [--only=<id>] [--overlay[=dir]]
//
// Facility anchors below were measured from the chunks by hand once (rough
// centre + search box); everything finer is fitted from the paint itself.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const TEX = join(ROOT, "docs/data/textures");
const OUT = join(ROOT, "docs/data/campus-markings.json");

const manifest = JSON.parse(readFileSync(join(TEX, "manifest.json"), "utf8"));

/* The university's surveyed ground polygons — the tennis fitter masks its
   whiteness field to each court pad's interior so the bright pad kerbs and
   walkways cannot out-score the court's own paint. Optional by contract. */
let ARCGIS_GROUND = null;
try {
  ARCGIS_GROUND = JSON.parse(readFileSync(join(ROOT, "docs/data/campus-arcgis.json"), "utf8")).ground || null;
} catch { /* fits fall back to the unmasked field */ }

const args = process.argv.slice(2);
const only = args.find((a) => a.startsWith("--only="))?.slice(7) || null;
const overlayArg = args.find((a) => a === "--overlay" || a.startsWith("--overlay="));
const overlayDir = overlayArg
  ? (overlayArg.includes("=") ? overlayArg.split("=")[1] : join(tmpdir(), "campus-markings-overlays"))
  : null;

/* ----------------------------------------------------------- image sampling */

/** Lazy per-chunk raw pixel cache with a bilinear metre-space sampler. */
const chunkCache = new Map();
async function loadChunk(ch) {
  if (!chunkCache.has(ch.file)) {
    const { data, info } = await sharp(join(TEX, ch.file)).raw().toBuffer({ resolveWithObject: true });
    chunkCache.set(ch.file, { data, w: info.width, h: info.height, ch });
  }
  return chunkCache.get(ch.file);
}
function chunkAt(x, z) {
  for (const ch of manifest.chunks) {
    if (x >= ch.x0 && x < ch.x1 && z >= ch.z0 && z < ch.z1) return ch;
  }
  return null;
}
/** RGB at local-metre (x, z), bilinear, or null off-imagery. */
async function rgbAt(x, z) {
  const ch = chunkAt(x, z);
  if (!ch) return null;
  const { data, w, h } = await loadChunk(ch);
  const fx = ((x - ch.x0) / (ch.x1 - ch.x0)) * w - 0.5;
  const fy = ((z - ch.z0) / (ch.z1 - ch.z0)) * h - 0.5;
  const x0 = Math.max(0, Math.min(w - 2, Math.floor(fx)));
  const y0 = Math.max(0, Math.min(h - 2, Math.floor(fy)));
  const tx = Math.max(0, Math.min(1, fx - x0));
  const ty = Math.max(0, Math.min(1, fy - y0));
  const px = (xx, yy) => {
    const i = (yy * w + xx) * 3;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const a = px(x0, y0), b = px(x0 + 1, y0), c = px(x0, y0 + 1), d = px(x0 + 1, y0 + 1);
  const mix = (i) =>
    (a[i] * (1 - tx) + b[i] * tx) * (1 - ty) + (c[i] * (1 - tx) + d[i] * tx) * ty;
  return [mix(0), mix(1), mix(2)];
}

/**
 * Whiteness field over a rect: how much brighter and less saturated a spot is
 * than the surface it is painted on. Robust to grass vs acrylic because the
 * baseline is the region's own median.
 */
async function whitenessField(x0, z0, x1, z1, step = 0.125) {
  const cols = Math.ceil((x1 - x0) / step);
  const rows = Math.ceil((z1 - z0) / step);
  const lum = new Float32Array(cols * rows);
  const sat = new Float32Array(cols * rows);
  const seen = new Uint8Array(cols * rows); // imagery actually covers this cell
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const rgb = await rgbAt(x0 + (c + 0.5) * step, z0 + (r + 0.5) * step);
      if (!rgb) { lum[r * cols + c] = 0; sat[r * cols + c] = 1; continue; }
      seen[r * cols + c] = 1;
      const [R, G, B] = rgb;
      lum[r * cols + c] = 0.299 * R + 0.587 * G + 0.114 * B;
      const mx = Math.max(R, G, B);
      sat[r * cols + c] = mx ? (mx - Math.min(R, G, B)) / mx : 0;
    }
  }
  /* Paint is a LOCAL brightness excess: a white line reads bright against
     the two metres around it, whatever surface it is painted on. A global
     median failed here — sunlit lawn beside a dark turf out-scored the paint
     and dragged every fit toward the lawn. Separable box blur = local base. */
  const R = Math.max(2, Math.round(2 / step)); // ~2 m radius
  const blur = (src) => {
    const tmp = new Float32Array(src.length);
    const dst = new Float32Array(src.length);
    for (let r = 0; r < rows; r++) {
      let acc = 0;
      for (let c = -R; c <= R; c++) acc += src[r * cols + Math.max(0, Math.min(cols - 1, c))];
      for (let c = 0; c < cols; c++) {
        tmp[r * cols + c] = acc / (2 * R + 1);
        const add = Math.min(cols - 1, c + R + 1);
        const del = Math.max(0, c - R);
        acc += src[r * cols + add] - src[r * cols + del];
      }
    }
    for (let c = 0; c < cols; c++) {
      let acc = 0;
      for (let r = -R; r <= R; r++) acc += tmp[Math.max(0, Math.min(rows - 1, r)) * cols + c];
      for (let r = 0; r < rows; r++) {
        dst[r * cols + c] = acc / (2 * R + 1);
        const add = Math.min(rows - 1, r + R + 1);
        const del = Math.max(0, r - R);
        acc += tmp[add * cols + c] - tmp[del * cols + c];
      }
    }
    return dst;
  };
  const base = blur(lum);
  const field = new Float32Array(cols * rows);
  for (let i = 0; i < field.length; i++) {
    const wv = Math.max(0, Math.min(1, (lum[i] - base[i] - 5) / 25));
    field[i] = wv * Math.max(0, 1 - sat[i] * 1.6);
  }
  const at = (x, z) => {
    const c = Math.floor((x - x0) / step);
    const r = Math.floor((z - z0) / step);
    if (c < 0 || r < 0 || c >= cols || r >= rows) return 0;
    return field[r * cols + c];
  };
  /* "Was there imagery here at all?" — the track's north bend runs past the
     chunk grid; those samples must drop out of the metrics, not read as
     unpainted. Off-rect also counts as unseen. */
  const validAt = (x, z) => {
    const c = Math.floor((x - x0) / step);
    const r = Math.floor((z - z0) / step);
    if (c < 0 || r < 0 || c >= cols || r >= rows) return false;
    return !!seen[r * cols + c];
  };
  return { at, validAt, x0, z0, x1, z1, step, cols, rows, field };
}

/* -------------------------------------------------------- template fitting */

const rot = (t) => [Math.cos(t), Math.sin(t)];
/** Facility frame -> world: u along the long axis, v across it. */
const toWorld = (cx, cz, t) => {
  const [c, s] = rot(t);
  return (u, v) => [cx + u * c - v * s, cz + u * s + v * c];
};

/** Sample points every `ds` metres along a polyline (facility-frame pts). */
function samplesAlong(pts, ds = 0.4) {
  const out = [];
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1];
    const [bx, bz] = pts[i];
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(len / ds));
    for (let k = 0; k <= n; k++) {
      const tt = k / n;
      out.push([ax + (bx - ax) * tt, az + (bz - az) * tt, (bx - ax) / len, (bz - az) / len]);
    }
  }
  return out;
}

const arcPts = (cu, cv, r, a0, a1, n = 48) => {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([cu + Math.cos(a) * r, cv + Math.sin(a) * r]);
  }
  return pts;
};

/** Mean whiteness along a set of facility-frame polylines, in world. */
function scoreTemplate(field, lines, cx, cz, theta) {
  const W = toWorld(cx, cz, theta);
  let sum = 0;
  let n = 0;
  for (const line of lines) {
    for (const [u, v] of samplesAlong(line)) {
      const [x, z] = W(u, v);
      sum += field.at(x, z);
      n++;
    }
  }
  return n ? sum / n : 0;
}

/** Coordinate-descent maximiser over named params. `ranges` are HARD bounds
    about the measured anchor — weak paint must never let a fit walk off the
    facility it was anchored to (it did, before the clamp). */
function refine(params, ranges, evalFn, rounds = 4) {
  const anchor = { ...params };
  let best = { ...params };
  let bestScore = evalFn(best);
  for (let round = 0; round < rounds; round++) {
    for (const key of Object.keys(ranges)) {
      const step = ranges[key] / Math.pow(2, round);
      for (const dir of [-1, 1]) {
        let moved = true;
        while (moved) {
          const v = best[key] + dir * step;
          if (Math.abs(v - anchor[key]) > ranges[key] + 1e-9) break;
          const cand = { ...best, [key]: v };
          const s = evalFn(cand);
          if (s > bestScore + 1e-6) { best = cand; bestScore = s; } else moved = false;
        }
      }
    }
  }
  return { params: best, score: bestScore };
}

/** Coarse grid seed BEFORE coordinate descent. Descent alone cannot cross a
    scoring valley: a court rotated 15–20° off its anchor scores WORSE for the
    first few degrees of correction, so every descent step is refused and the
    fit stays axis-aligned while the paint runs diagonal — exactly what
    happened at Northview and Warren. The sweep evaluates the template on a
    hard grid over the given params (theta above all) and hands the best cell
    to `refine` as its new anchor. */
function seedSweep(params, sweeps, evalFn) {
  const keys = Object.keys(sweeps);
  let best = { ...params };
  let bestScore = evalFn(best);
  const walk = (i, cur) => {
    if (i === keys.length) {
      const s = evalFn(cur);
      if (s > bestScore + 1e-6) { best = { ...cur }; bestScore = s; }
      return;
    }
    const key = keys[i];
    const { span, step } = sweeps[key];
    for (let v = params[key] - span; v <= params[key] + span + 1e-9; v += step) {
      walk(i + 1, { ...cur, [key]: v });
    }
  };
  walk(0, { ...params });
  return { params: best, score: bestScore };
}

/**
 * The honesty check: perpendicular offset between each emitted line and the
 * whiteness centroid found within ±search metres of it. Mean of |offset| over
 * samples that actually see paint; NaN-safe when a line is fully faded.
 */
function fitError(field, worldLines, search = 1.0) {
  let acc = 0;
  let n = 0;
  for (const line of worldLines) {
    for (const [x, z, dx, dz] of samplesAlong(line, 1.2)) {
      const px = -dz, pz = dx; // unit perpendicular
      let wsum = 0, wpos = 0;
      for (let o = -search; o <= search; o += 0.125) {
        const w = field.at(x + px * o, z + pz * o);
        wsum += w;
        wpos += w * o;
      }
      if (wsum > 0.8) { acc += Math.abs(wpos / wsum); n++; }
    }
  }
  return n ? acc / n : NaN;
}

/**
 * The OTHER honesty check, the one the perpendicular-offset metric cannot do.
 * fitError asks "where is the nearest paint centroid?" — over a dense line
 * set (eight tennis courts side by side) there is always SOME paint within a
 * metre, so a whole court rotated 15° off its pad still scored 0.3 m and the
 * 0.5 m gate waved it through. Coverage asks the blunter question: what
 * fraction of the emitted line actually LIES ON paint (whiteness above
 * `thresh` within ±`reach`)? A rotated misfit crosses each real line once and
 * spends the rest of its length on bare acrylic — coverage collapses, and the
 * gate below catches what fitError structurally cannot. Samples with no
 * imagery under them (the track's clipped north bend) leave the denominator.
 */
/* Paint response scales with line-width ÷ pixel-size: a 8 cm line under a
   0.125 m/px (z20) chunk fills ~0.6 px and reads strongly; under 0.25 m/px
   (z19) it fills ~0.3 px and the local excess halves. The coverage threshold
   follows the source's own resolution so a true fit on a z19 chunk is not
   punished for the imagery's blur. */
function paintThreshAt(x, z) {
  const ch = chunkAt(x, z);
  return ch && ch.zoom >= 20 ? 0.18 : 0.09;
}

/* PER SAMPLE, not per facility. The threshold above was for years resolved
   ONCE, at the facility's centre, and applied to every sample — which is the
   right number only for a facility that lies inside one chunk. RIMAC's
   north-west pitch straddles the zoom seam at z = -1128: its centre sits in
   the z20 chunk, so its whole northern half — real paint, recorded at half
   the resolution — was scored against the z20 threshold it cannot reach, and
   the pitch measured 0.53 coverage and shipped as a bad fit. Resolved where
   each sample actually lands, the same fit measures 0.92. Any facility
   crossing a seam had the same fault. */
function paintCoverage(field, worldLines, reach = 0.45) {
  let hit = 0;
  let n = 0;
  for (const line of worldLines) {
    for (const [x, z, dx, dz] of samplesAlong(line, 1.0)) {
      const px = -dz, pz = dx;
      let seen = false, on = false;
      for (let o = -reach; o <= reach; o += 0.125) {
        const xx = x + px * o, zz = z + pz * o;
        if (!field.validAt(xx, zz)) continue;
        seen = true;
        if (field.at(xx, zz) >= paintThreshAt(xx, zz)) { on = true; break; }
      }
      if (!seen) continue;
      n++;
      if (on) hit++;
    }
  }
  return n ? hit / n : NaN;
}

/* ----------------------------------------------- regulation marking makers */

const WHITE = "#f4f4f0";
const seg = (colour, width_m, pts) => ({ kind: "line", colour, width_m, pts });
const arc = (colour, width_m, c, r, a0, a1) => ({ kind: "arc", colour, width_m, c, r, a0, a1 });

/** Full association-football line set, scaled below full size when the
    painted pitch measures smaller (k = the pitch's own scale factor).
    `elements` limits emission to what the imagery actually shows painted. */
function soccerMarkings(L, W, lw = 0.12, elements = null, fullBoxes = false) {
  const has = (e) => !elements || elements.includes(e);
  /* The rec fields paint FULL-SIZE penalty geometry even on short pitches —
     the RIMAC south overlay shows regulation 40.32 m penalty areas on an
     85 m pitch — so `fullBoxes` pins k at 1 where the imagery says so. */
  const k = fullBoxes ? 1 : Math.min(1, L / 105, W / 68);
  const box = (dir) => {
    // dir = +1 right goal, -1 left goal
    const pa = 16.5 * k, paw = 40.32 * k; // penalty area
    const ga = 5.5 * k, gaw = 18.32 * k;  // goal area
    const spot = 11 * k, r = 9.15 * k;
    const gx = (L / 2) * dir;
    const m = [
      seg(WHITE, lw, [[gx, -paw / 2], [gx - pa * dir, -paw / 2], [gx - pa * dir, paw / 2], [gx, paw / 2]]),
      seg(WHITE, lw, [[gx, -gaw / 2], [gx - ga * dir, -gaw / 2], [gx - ga * dir, gaw / 2], [gx, gaw / 2]]),
    ];
    // penalty arc: the part of the 9.15 m circle outside the penalty area
    const sx = gx - spot * dir;
    const edge = gx - pa * dir;
    const cosA = Math.max(-1, Math.min(1, (edge - sx) / (r * dir)));
    const a = Math.acos(cosA);
    m.push(dir > 0
      ? arc(WHITE, lw, [sx, 0], r, Math.PI - a, Math.PI + a)
      : arc(WHITE, lw, [sx, 0], r, -a, a));
    return m;
  };
  return [
    seg(WHITE, lw, [[-L / 2, -W / 2], [L / 2, -W / 2], [L / 2, W / 2], [-L / 2, W / 2], [-L / 2, -W / 2]]),
    seg(WHITE, lw, [[0, -W / 2], [0, W / 2]]),
    /* Centre circle: the rec fields paint the full 9.15 m circle even on
       short pitches — the imagery says so — so only the boxes scale. */
    arc(WHITE, lw, [0, 0], 9.15, 0, Math.PI * 2),
    ...(has("boxes") ? [...box(1), ...box(-1)] : []),
    ...(has("corners") ? [
      arc(WHITE, lw, [-L / 2, -W / 2], 1, 0, Math.PI / 2),
      arc(WHITE, lw, [L / 2, -W / 2], 1, Math.PI / 2, Math.PI),
      arc(WHITE, lw, [L / 2, W / 2], 1, Math.PI, Math.PI * 1.5),
      arc(WHITE, lw, [-L / 2, W / 2], 1, Math.PI * 1.5, Math.PI * 2),
    ] : []),
  ];
}

/** Full tennis line set. u runs along the court length (baseline to baseline). */
function tennisMarkings(colour = WHITE, lw = 0.08) {
  const L = 23.77 / 2, Wd = 10.97 / 2, Ws = 8.23 / 2, S = 6.4;
  return [
    seg(colour, lw, [[-L, -Wd], [L, -Wd], [L, Wd], [-L, Wd], [-L, -Wd]]), // doubles + baselines
    seg(colour, lw, [[-L, -Ws], [L, -Ws]]), // singles sidelines
    seg(colour, lw, [[-L, Ws], [L, Ws]]),
    seg(colour, lw, [[-S, -Ws], [-S, Ws]]), // service lines
    seg(colour, lw, [[S, -Ws], [S, Ws]]),
    seg(colour, lw, [[-S, 0], [S, 0]]), // centre service line
    seg(colour, lw, [[-L, 0], [-L + 0.3, 0]]), // centre marks
    seg(colour, lw, [[L - 0.3, 0], [L, 0]]),
  ];
}

/** Basketball court lines: boundary, halfway, centre circle, keys, FT circles,
    three-point arcs. Scaled when the painted court measures below 28.65 m. */
function basketballMarkings(L, W, colour = WHITE, lw = 0.08) {
  const k = Math.min(1, L / 28.65, W / 15.24);
  const keyW = 3.66 * k, ftDist = 5.79 * k, ftR = 1.83 * k, r3 = 6.75 * k;
  const m = [
    seg(colour, lw, [[-L / 2, -W / 2], [L / 2, -W / 2], [L / 2, W / 2], [-L / 2, W / 2], [-L / 2, -W / 2]]),
    seg(colour, lw, [[0, -W / 2], [0, W / 2]]),
    arc(colour, lw, [0, 0], 1.83 * k, 0, Math.PI * 2),
  ];
  for (const dir of [1, -1]) {
    const bx = (L / 2) * dir;
    const ftx = bx - ftDist * dir;
    m.push(seg(colour, lw, [[bx, -keyW / 2], [ftx, -keyW / 2], [ftx, keyW / 2], [bx, keyW / 2]]));
    m.push(arc(colour, lw, [ftx, 0], ftR, dir > 0 ? Math.PI / 2 : -Math.PI / 2, dir > 0 ? Math.PI * 1.5 : Math.PI / 2));
    // three-point arc around the hoop (1.575 m in from the baseline)
    const hx = bx - 1.575 * k * dir;
    const a = Math.acos(Math.min(1, (W / 2 - 0.9 * k) / r3));
    m.push(dir > 0
      ? arc(colour, lw, [hx, 0], r3, Math.PI / 2 + a, Math.PI * 1.5 - a)
      : arc(colour, lw, [hx, 0], r3, -Math.PI / 2 + a, Math.PI / 2 - a));
  }
  return m;
}

/** Track: lane lines as two straights + semicircular ends. */
function trackMarkings(straightHalf, r0, lanes, laneW = 1.22, colour = WHITE, lw = 0.1) {
  const m = [];
  for (let i = 0; i <= lanes; i++) {
    const r = r0 + i * laneW;
    m.push(seg(colour, lw, [[-straightHalf, -r], [straightHalf, -r]]));
    m.push(seg(colour, lw, [[-straightHalf, r], [straightHalf, r]]));
    m.push(arc(colour, lw, [straightHalf, 0], r, -Math.PI / 2, Math.PI / 2));
    m.push(arc(colour, lw, [-straightHalf, 0], r, Math.PI / 2, Math.PI * 1.5));
  }
  return m;
}

/* ------------------------------------------------ measured surface colours */

/** Closed stadium-oval polygon in the facility frame: two straights at ±r
    joined by semicircular ends. Used for the track's modeled running surface
    and its infield. */
function ovalPoly(straight, r, n = 40) {
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push([-straight + (2 * straight * i) / n, -r]);
  for (let i = 1; i <= n; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / n;
    pts.push([straight + Math.cos(a) * r, Math.sin(a) * r]);
  }
  for (let i = 1; i <= n; i++) pts.push([straight - (2 * straight * i) / n, r]);
  for (let i = 1; i < n; i++) {
    const a = Math.PI / 2 + (Math.PI * i) / n;
    pts.push([-straight + Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}

/** Shadow-rejected per-channel median of the imagery over the given world
    points — same doctrine as build-campus-truecolor.mjs, at facility scale.
    Null when the imagery cannot answer (too few pixels under coverage). */
async function measuredColour(points) {
  const px = [];
  for (const [x, z] of points) {
    const rgb = await rgbAt(x, z);
    if (rgb) px.push(rgb);
  }
  if (px.length < 60) return null;
  const lumOf = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;
  const lums = px.map(lumOf).sort((a, b) => a - b);
  const lo = lums[Math.floor(lums.length * 0.30)]; // shadows and dark blotches out
  const hi = lums[Math.floor(lums.length * 0.92)]; // painted lines and glare out
  const keep = px.filter((p) => lumOf(p) >= lo && lumOf(p) <= hi);
  const med = (i) => {
    const v = keep.map((p) => p[i]).sort((a, b) => a - b);
    return Math.round(v[Math.floor(v.length / 2)]);
  };
  return `#${[med(0), med(1), med(2)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/* -------------------------------------------------------- logo silhouettes */

/**
 * Trace a painted logo straight off the imagery: classify pixels over a box,
 * keep the largest connected blob, walk its boundary (Moore neighbourhood),
 * then simplify with Douglas–Peucker. "Simplified vector polygon of its
 * silhouette", exactly as measured.
 */
async function traceLogo(x0, z0, x1, z1, classify, tol = 0.3) {
  const step = 0.125;
  const cols = Math.ceil((x1 - x0) / step);
  const rows = Math.ceil((z1 - z0) / step);
  const mask = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const rgb = await rgbAt(x0 + (c + 0.5) * step, z0 + (r + 0.5) * step);
      if (rgb && classify(rgb)) mask[r * cols + c] = 1;
    }
  }
  /* Close the mask (one dilation): at 12.5 cm the glyph's thin joins
     drop out and the logo shatters into pieces; a single dilation heals
     the joins and the silhouette traces as one blob. */
  const dilated = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!mask[r * cols + c]) continue;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr, cc = c + dc;
          if (rr >= 0 && cc >= 0 && rr < rows && cc < cols) dilated[rr * cols + cc] = 1;
        }
      }
    }
  }
  mask.set(dilated);
  // largest connected component (4-neighbour flood fill)
  const label = new Int32Array(cols * rows).fill(-1);
  let bestLabel = -1, bestSize = 0, next = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || label[i] >= 0) continue;
    const stack = [i];
    label[i] = next;
    let size = 0;
    while (stack.length) {
      const j = stack.pop();
      size++;
      const r = Math.floor(j / cols), c = j % cols;
      for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
        const k = rr * cols + cc;
        if (mask[k] && label[k] < 0) { label[k] = next; stack.push(k); }
      }
    }
    if (size > bestSize) { bestSize = size; bestLabel = next; }
    next++;
  }
  if (bestLabel < 0) return null;
  const inBlob = (r, c) =>
    r >= 0 && c >= 0 && r < rows && c < cols && label[r * cols + c] === bestLabel;
  /* Marching squares over the blob: emit one segment per boundary crossing,
     keyed by endpoint, then chain the longest closed loop. Deterministic,
     unlike the Moore walk this replaced, which oscillated in notches. */
  const segs = new Map(); // "x,y" -> [x2, y2]
  const K = (x, y) => `${x},${y}`;
  const addSeg = (x1, y1, x2, y2) => segs.set(K(x1, y1), [x2, y2]);
  for (let r = -1; r < rows; r++) {
    for (let c = -1; c < cols; c++) {
      const tl = inBlob(r, c) ? 1 : 0;
      const tr = inBlob(r, c + 1) ? 1 : 0;
      const bl = inBlob(r + 1, c) ? 1 : 0;
      const br = inBlob(r + 1, c + 1) ? 1 : 0;
      const idx = tl * 8 + tr * 4 + br * 2 + bl;
      if (idx === 0 || idx === 15) continue;
      /* Edge midpoints of the 2x2 block, in (col, row) half-steps. Segments
         are wound so the blob stays on the LEFT; that keeps every chain a
         single consistent loop. */
      const T = [c + 1, r + 0.5], Rr = [c + 1.5, r + 1], B = [c + 1, r + 1.5], L = [c + 0.5, r + 1];
      const put = (a, b) => addSeg(a[0], a[1], b[0], b[1]);
      switch (idx) {
        case 1: put(B, L); break;
        case 2: put(Rr, B); break;
        case 3: put(Rr, L); break;
        case 4: put(T, Rr); break;
        case 5: put(T, Rr); put(B, L); break;
        case 6: put(T, B); break;
        case 7: put(T, L); break;
        case 8: put(L, T); break;
        case 9: put(B, T); break;
        case 10: put(L, T); put(Rr, B); break;
        case 11: put(Rr, T); break;
        case 12: put(L, Rr); break;
        case 13: put(B, Rr); break;
        case 14: put(L, B); break;
      }
    }
  }
  let ring = [];
  const used = new Set();
  for (const startKey of segs.keys()) {
    if (used.has(startKey)) continue;
    const loop = [];
    let key = startKey;
    while (segs.has(key) && !used.has(key)) {
      used.add(key);
      const [x, y] = key.split(",").map(Number);
      loop.push([x, y]);
      const nxt = segs.get(key);
      key = K(nxt[0], nxt[1]);
    }
    if (loop.length > ring.length) ring = loop;
  }
  if (ring.length < 3) return null;
  // Douglas–Peucker in metres
  const pts = ring.map(([cc, rr]) => [x0 + (cc + 0.5) * step, z0 + (rr + 0.5) * step]);
  const simplify = (list) => {
    if (list.length < 3) return list;
    const keep = new Uint8Array(list.length);
    keep[0] = keep[list.length - 1] = 1;
    const stack = [[0, list.length - 1]];
    while (stack.length) {
      const [a, b] = stack.pop();
      let worst = 0, wi = -1;
      const [ax, az] = list[a], [bx, bz] = list[b];
      const len = Math.hypot(bx - ax, bz - az) || 1;
      for (let i = a + 1; i < b; i++) {
        const d = Math.abs((bx - ax) * (az - list[i][1]) - (ax - list[i][0]) * (bz - az)) / len;
        if (d > worst) { worst = d; wi = i; }
      }
      if (worst > tol && wi > 0) { keep[wi] = 1; stack.push([a, wi], [wi, b]); }
    }
    return list.filter((_, i) => keep[i]);
  };
  const poly = simplify(pts).map(([x, z]) => [Math.round(x * 100) / 100, Math.round(z * 100) / 100]);
  return poly.length >= 3 ? poly : null;
}

/* ------------------------------------------------- facility frame plumbing */

/** Transform facility-frame markings to world coordinates. */
function placeMarkings(markings, cx, cz, theta) {
  const W = toWorld(cx, cz, theta);
  const r2 = (v) => Math.round(v * 100) / 100;
  return markings.map((mk) => {
    if (mk.kind === "arc") {
      const [x, z] = W(mk.c[0], mk.c[1]);
      return { ...mk, c: [r2(x), r2(z)], r: r2(mk.r), a0: r2(mk.a0 + theta), a1: r2(mk.a1 + theta) };
    }
    return { ...mk, pts: mk.pts.map(([u, v]) => W(u, v).map(r2)) };
  });
}

/** Marking (world coords) -> world polyline(s), for scoring and bounds. */
function markingToLines(mk) {
  if (mk.kind === "arc") {
    return [arcPts(mk.c[0], mk.c[1], mk.r, mk.a0, mk.a1, Math.max(16, Math.round(mk.r * 6)))];
  }
  if (mk.kind === "fill") return [mk.poly.concat([mk.poly[0]])];
  return [mk.pts];
}

function boundsOf(markings, margin = 2.5) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const mk of markings) {
    for (const line of markingToLines(mk)) {
      for (const [x, z] of line) {
        x0 = Math.min(x0, x); x1 = Math.max(x1, x);
        z0 = Math.min(z0, z); z1 = Math.max(z1, z);
      }
    }
  }
  const r2 = (v) => Math.round(v * 100) / 100;
  return [[x0 - margin, z0 - margin], [x1 + margin, z0 - margin],
          [x1 + margin, z1 + margin], [x0 - margin, z1 + margin]].map((p) => p.map(r2));
}

/* ------------------------------------------------------- overlay rendering */

async function renderOverlay(id, field, markings) {
  if (!overlayDir) return;
  mkdirSync(overlayDir, { recursive: true });
  const { x0, z0, step, cols, rows } = field;
  const scale = step <= 0.126 ? 1 : 2;
  const W = cols * scale, H = rows * scale;
  const png = Buffer.alloc(W * H * 3);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const rgb = (await rgbAt(x0 + (c + 0.5) * step, z0 + (r + 0.5) * step)) || [30, 30, 30];
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          const i = ((r * scale + sy) * W + c * scale + sx) * 3;
          png[i] = rgb[0]; png[i + 1] = rgb[1]; png[i + 2] = rgb[2];
        }
      }
    }
  }
  const put = (x, z) => {
    const c = Math.round(((x - x0) / step) * 1) * scale;
    const r = Math.round(((z - z0) / step) * 1) * scale;
    if (c < 0 || r < 0 || c >= W || r >= H) return;
    const i = (r * W + c) * 3;
    png[i] = 255; png[i + 1] = 40; png[i + 2] = 40;
  };
  for (const mk of markings) {
    for (const line of markingToLines(mk)) {
      for (const [x, z, ] of samplesAlong(line, step / 2)) put(x, z);
    }
  }
  const out = join(overlayDir, `${id}.png`);
  await sharp(png, { raw: { width: W, height: H, channels: 3 } }).png().toFile(out);
  console.log(`  overlay -> ${out}`);
}

/* ---------------------------------------------------------- the facilities */
/* Anchors: rough centre/orientation/extent read off the chunks once; the fit
   owns everything finer. theta is radians from +x (east), v across. */

const FACILITIES = [];

/** A painted grass/turf soccer pitch. */
function pitch(id, name, init, opts = {}) {
  FACILITIES.push({
    id, name, kind: "pitch", minCover: opts.minCover, maxError: opts.maxError,
    async build() {
      const pad = Math.max(init.L, init.W) / 2 + 15;
      const field = await whitenessField(init.cx - pad, init.cz - pad, init.cx + pad, init.cz + pad);
      /* What the fit is allowed to see. The boundary, the halfway line and the
         centre circle always; the penalty geometry too where the facility is
         known to carry it full size. Leaving the boxes out meant the fit and
         the coverage metric that judges it were reading different evidence —
         at RIMAC the score would settle a fit the coverage then marked down,
         because four fifths of the emitted line is box and arc. */
      const template = (p) => {
        const lines = [
          [[-p.L / 2, -p.W / 2], [p.L / 2, -p.W / 2], [p.L / 2, p.W / 2], [-p.L / 2, p.W / 2], [-p.L / 2, -p.W / 2]],
          [[0, -p.W / 2], [0, p.W / 2]],
          arcPts(0, 0, 9.15, 0, Math.PI * 2),
        ];
        if (opts.fullBoxes) {
          for (const dir of [1, -1]) {
            const gx = (p.L / 2) * dir;
            lines.push([[gx, -20.16], [gx - 16.5 * dir, -20.16], [gx - 16.5 * dir, 20.16], [gx, 20.16]]);
            lines.push([[gx, -9.16], [gx - 5.5 * dir, -9.16], [gx - 5.5 * dir, 9.16], [gx, 9.16]]);
          }
        }
        return lines;
      };
      const evalFn = (p) => scoreTemplate(field, template(p), p.cx, p.cz, p.theta);
      let seed = { cx: init.cx, cz: init.cz, theta: init.theta, L: init.L, W: init.W };
      if (opts.sweep) ({ params: seed } = seedSweep(seed, opts.sweep, evalFn));
      const { params, score } = refine(seed, opts.ranges ?? { cx: 6, cz: 6, theta: 0.04, L: 4, W: 4 }, evalFn);
      const markings = placeMarkings(
        soccerMarkings(params.L, params.W, opts.lw ?? 0.12, opts.elements ?? null, opts.fullBoxes ?? false),
        params.cx, params.cz, params.theta);
      const lines = markings.filter((m) => m.kind !== "fill").flatMap(markingToLines);
      const err = fitError(field, lines);
      const cover = paintCoverage(field, lines, 0.45);
      if (opts.logo) {
        const logo = await opts.logo(params);
        if (logo) markings.push(...logo);
      }
      return { markings, field, err, cover, score, full: params.L >= 90, fitted: params };
    },
  });
}

/** A row of identical tennis courts sharing one orientation. */
function tennisRow(id, name, init) {
  FACILITIES.push({
    id, name, kind: "tennis", minCover: init.minCover,
    async build() {
      const halfSpan = (init.count * init.spacing) / 2 + 8;
      const cs = [];
      for (let i = 0; i < init.count; i++) cs.push((i - (init.count - 1) / 2) * init.spacing);
      /* All FOUR corners of the rotated row — for EVERY theta the sweep may
         visit, not just the anchor's. Two opposite corners alone cropped a
         tilted row down to a sliver and the fit saw no court. */
      const thetas = [init.theta];
      if (init.sweep?.theta) {
        thetas.push(init.theta - init.sweep.theta.span, init.theta + init.sweep.theta.span);
      }
      const corners = [];
      for (const t of thetas) {
        const W = toWorld(init.cx, init.cz, t);
        corners.push(W(-halfSpan, -16), W(halfSpan, -16), W(-halfSpan, 16), W(halfSpan, 16));
      }
      const xs = corners.map((c) => c[0]), zs = corners.map((c) => c[1]);
      const field = await whitenessField(
        Math.min(...xs) - 4, Math.min(...zs) - 4, Math.max(...xs) + 4, Math.max(...zs) + 4);
      /* Courts play ACROSS the row: court u axis = row v axis. One court's
         line set, replicated at each centre along the row. */
      const courtLines = tennisMarkings().flatMap(markingToLines);
      const template = (p) => {
        const out = [];
        for (let i = 0; i < init.count; i++) {
          const cu = p.u0 + i * p.spacing;
          for (const line of courtLines) out.push(line.map(([u, v]) => [cu + v, p.v0 + u]));
        }
        return out;
      };
      const evalFn = (p) => scoreTemplate(field, template(p), p.cx, p.cz, p.theta);
      let seed = { u0: cs[0], v0: 0, spacing: init.spacing, theta: init.theta, cx: init.cx, cz: init.cz };
      if (init.sweep) ({ params: seed } = seedSweep(seed, init.sweep, evalFn));
      const { params, score } = refine(
        seed,
        { u0: 3, v0: 3, spacing: 1, theta: init.sweep?.theta ? 0.03 : 0.02, cx: 2, cz: 2 },
        evalFn
      );
      const markings = [];
      for (let i = 0; i < init.count; i++) {
        const cu = params.u0 + i * params.spacing;
        const WW = toWorld(params.cx, params.cz, params.theta);
        const [ccx, ccz] = WW(cu, params.v0);
        markings.push(...placeMarkings(tennisMarkings(), ccx, ccz, params.theta + Math.PI / 2));
      }
      const lines = markings.flatMap(markingToLines);
      const err = fitError(field, lines);
      const cover = paintCoverage(field, lines, 0.45);
      return { markings, field, err, cover, score, fitted: params };
    },
  });
}

/** The surveyed court-pad polygon containing (x, z), in metres, or null. */
function courtPadAt(x, z) {
  if (!ARCGIS_GROUND) return null;
  for (const g of ARCGIS_GROUND) {
    if (g.k !== "court") continue;
    const ring = g.r[0].map(([px, pz]) => [px / 10, pz / 10]);
    let ins = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, zi] = ring[i];
      const [xj, zj] = ring[j];
      if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
    }
    if (ins) return ring;
  }
  return null;
}

/** Wrap a whiteness field so everything outside `ring` eroded by `inset`
    metres reads as zero — the pad kerb line dies, the court paint stays. */
function maskFieldToPad(field, ring, inset = 1.2) {
  const inside = (x, z) => {
    let ins = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, zi] = ring[i];
      const [xj, zj] = ring[j];
      if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
    }
    if (!ins) return false;
    for (let i = 0; i < ring.length; i++) {
      const [ax, az] = ring[i];
      const [bx, bz] = ring[(i + 1) % ring.length];
      const dx = bx - ax, dz = bz - az;
      const L2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
      if (Math.hypot(x - (ax + dx * t), z - (az + dz * t)) < inset) return false;
    }
    return true;
  };
  return { ...field, at: (x, z) => (inside(x, z) ? field.at(x, z) : 0) };
}

/**
 * Tennis courts fitted ONE BY ONE from surveyed pad anchors. The Northview
 * banks defeated the rigid-row model twice over: the pads tilt ~2.5° off the
 * campus grid AND their centres stagger by over a metre — the university's
 * own ground survey (campus-arcgis.json court polygons, which trace the
 * imagery pads exactly) says so. Each pad centre + long-edge angle below is
 * read from that survey; each court then refines independently against its
 * own paint, and each court passes or fails the coverage gate on its own.
 */
function tennisCourts(id, name, pads) {
  FACILITIES.push({
    id, name, kind: "tennis",
    async build() {
      /* One field over the whole bank, so the --overlay render shows every
         court against its paint in a single image. */
      const xs = pads.map((p) => p.cx), zs = pads.map((p) => p.cz);
      const field = await whitenessField(
        Math.min(...xs) - 16, Math.min(...zs) - 16, Math.max(...xs) + 16, Math.max(...zs) + 16);
      const markings = [];
      const allPlaced = []; // dropped courts too — the overlay must show them
      const errs = [];
      const covers = [];
      let dropped = 0;
      for (const pad of pads) {
        /* The pad's own surveyed polygon masks the field: paint inside the
           pad is COURT paint; the bright kerbs and walkways outside it kept
           out-scoring the lines and dragging fits metres off. */
        const ring = courtPadAt(pad.cx, pad.cz);
        const f = ring ? maskFieldToPad(field, ring) : field;
        const courtLines = tennisMarkings().flatMap(markingToLines);
        const template = () => courtLines;
        const evalFn = (p) => scoreTemplate(f, template(), p.cx, p.cz, p.theta);
        /* Two candidate fits — one leashed to the hand-measured anchor, one
           free to roam the masked pad — and COVERAGE, the honest metric,
           picks between them. The tight fit wins where the anchor was read
           true and the roaming fit chases a shadow; the loose fit wins where
           the anchor was read a metre or two off. Neither judgment is
           trusted blind: the gate below still applies to the winner. */
        const candidate = (span, leash) => {
          const { params: seed } = seedSweep(
            { cx: pad.cx, cz: pad.cz, theta: pad.theta },
            { cx: { span, step: 0.25 }, cz: { span, step: 0.25 }, theta: { span: 0.02, step: 0.005 } },
            evalFn);
          const { params } = refine(seed, { cx: leash, cz: leash, theta: 0.008 }, evalFn);
          const placed = placeMarkings(tennisMarkings(), params.cx, params.cz, params.theta);
          const lines = placed.flatMap(markingToLines);
          return {
            params, placed, lines,
            cover: paintCoverage(f, lines, 0.45),
          };
        };
        const tight = candidate(1, 0.4);
        const loose = candidate(2.5, 0.5);
        const pick = (loose.cover || 0) > (tight.cover || 0) ? loose : tight;
        const { params, placed, lines, cover } = pick;
        allPlaced.push(...placed);
        const err = fitError(f, lines);
        if (!Number.isNaN(cover) && cover < COVER_GATE) {
          dropped++;
          console.warn(`\n  dropped one ${id} court at (${params.cx.toFixed(1)}, ${params.cz.toFixed(1)}): ` +
            `coverage ${(cover * 100).toFixed(0)}%`);
          continue;
        }
        markings.push(...placed);
        if (!Number.isNaN(err)) errs.push(err);
        if (!Number.isNaN(cover)) covers.push(cover);
      }
      const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
      return {
        markings, field, overlayMarkings: allPlaced,
        err: mean(errs), cover: mean(covers),
        score: mean(covers),
        fitted: { courts: pads.length - dropped, of: pads.length },
      };
    },
  });
}

/** One or more basketball courts sharing an orientation. */
function basketball(id, name, init) {
  FACILITIES.push({
    id, name, kind: "basketball", minCover: init.minCover,
    async build() {
      const pad = Math.max(init.L, init.W * (init.centres?.length || 1)) / 2 + 10;
      const field = await whitenessField(init.cx - pad, init.cz - pad, init.cx + pad, init.cz + pad);
      const centres = init.centres || [[0, 0]];
      const courtLines = (L, Wc) => basketballMarkings(L, Wc).flatMap(markingToLines);
      const template = (p) => {
        const out = [];
        for (const [du, dv] of centres) {
          for (const line of courtLines(p.L, p.W)) out.push(line.map(([u, v]) => [u + du, v + dv]));
        }
        return out;
      };
      const evalFn = (p) => scoreTemplate(field, template(p), p.cx, p.cz, p.theta);
      let seed = { cx: init.cx, cz: init.cz, theta: init.theta, L: init.L, W: init.W };
      if (init.sweep) ({ params: seed } = seedSweep(seed, init.sweep, evalFn));
      const { params, score } = refine(seed, { cx: 3, cz: 3, theta: 0.03, L: 2, W: 1.5 }, evalFn);
      const markings = [];
      const WW = toWorld(params.cx, params.cz, params.theta);
      for (const [du, dv] of centres) {
        const [ccx, ccz] = WW(du, dv);
        markings.push(...placeMarkings(basketballMarkings(params.L, params.W), ccx, ccz, params.theta));
      }
      const lines = markings.flatMap(markingToLines);
      const err = fitError(field, lines);
      const cover = paintCoverage(field, lines, 0.45);
      return { markings, field, err, cover, score, fitted: params };
    },
  });
}

/* ============================ THE CAMPUS ================================= */
// Anchor values: measured off the georeferenced chunks (gridded crops + line
// probes; see header). The fits refine them against the paint itself.

// Triton Track — 9 lanes. Terracotta-mask regression over the straights gave
// centre x 148.05 (at z -1307.5), tilt dx/dz +0.0419, inner radius 29.44 m,
// south outer apex z -1214.75. The NORTH arc lies past the imagery's edge
// (the chunk grid stops at z = -1383), so the oval is closed with the 400 m
// identity: straight = (400 - 2*pi*(r_in + 0.3)) / 2. The model completes
// what the photograph clips.
FACILITIES.push({
  /* Thin 10 cm lanes on terracotta read faint (29% baseline, overlay-verified
     ON the paint); floor = 0.75 x baseline. */
  id: "triton-track", name: "Triton Track", kind: "track", minCover: 0.22,
  async build() {
    const LANES = 9, LANE_W = 1.22;
    const init = { cx: 147.98, cz: -1309.05, theta: 1.5289, straight: 53.29, r0: 29.44 };
    const field = await whitenessField(init.cx - 55, init.cz - 100, init.cx + 55, init.cz + 100, 0.25);
    const template = (p) => {
      const lines = [];
      for (const i of [0, 4, LANES]) {
        const r = p.r0 + i * LANE_W;
        lines.push([[-p.straight, -r], [p.straight, -r]]);
        lines.push([[-p.straight, r], [p.straight, r]]);
        lines.push(arcPts(p.straight, 0, r, -Math.PI / 2, Math.PI / 2));
      }
      return lines;
    };
    const { params, score } = refine(
      init,
      { cx: 0.6, cz: 1.2, theta: 0.004, straight: 1, r0: 0.5 },
      (p) => scoreTemplate(field, template(p), p.cx, p.cz, p.theta)
    );
    const markings = placeMarkings(
      trackMarkings(params.straight, params.r0, LANES, LANE_W), params.cx, params.cz, params.theta);
    const lines = markings.flatMap(markingToLines);
    const err = fitError(field, lines, 0.8);
    const cover = paintCoverage(field, lines, 0.45);

    /* The RUNNING SURFACE, modeled. The ring's terracotta and the infield's
       green are measured off the chunks (shadow-rejected medians along the
       lane centres / over the infield) and emitted as filled polygons under
       the lane lines, so the marquee facility carries a modeled surface
       instead of blurred NAIP smear and its baked shadow blotches. The north
       bend's colour comes from wherever the imagery reaches; the geometry is
       the same fitted oval the lanes already trust. */
    const W = toWorld(params.cx, params.cz, params.theta);
    const place = (poly) => poly.map(([u, v]) => W(u, v).map((n) => Math.round(n * 100) / 100));
    const ringSamples = [];
    /* Sample at LANE CENTRES (r0 + (i+0.5)*1.22): the first pass sampled
       within a third of a metre of the painted lines and their bilinear
       bleed lightened the median from brick terracotta to salmon. */
    for (const rr of [params.r0 + 1.5 * LANE_W, params.r0 + 4.5 * LANE_W, params.r0 + 7.5 * LANE_W]) {
      for (const [u, v] of samplesAlong(ovalPoly(params.straight, rr).concat([[ -params.straight, -rr ]]), 2)) {
        ringSamples.push(W(u, v));
      }
    }
    const infieldSamples = [];
    for (let u = -params.straight - params.r0 + 2; u <= params.straight + params.r0 - 2; u += 2.5) {
      for (let v = -params.r0 + 2; v <= params.r0 - 2; v += 2.5) {
        const du = Math.abs(u) <= params.straight ? 0 : Math.abs(u) - params.straight;
        if (Math.hypot(du, v) <= params.r0 - 2) infieldSamples.push(W(u, v));
      }
    }
    const terracotta = (await measuredColour(ringSamples)) || "#b96a4e";
    /* The infield joins the world's LAWNS, and the renderer presents every
       lawn through a daylight blend (campus-world.js addSurface) that lifts
       the measured colour toward the site's green. The infield fill renders
       unlit at exactly this hex, so the same blend is applied here — without
       it the measured forest green sat as a dark ring around the brighter
       surveyed pitch polygon inside it. The ring keeps its measured
       terracotta untouched: vivid is what the imagery says it is. */
    const daylight = (hex, base, k) => {
      const c = hex.match(/[0-9a-f]{2}/g).map((v) => parseInt(v, 16));
      const b = base.match(/[0-9a-f]{2}/g).map((v) => parseInt(v, 16));
      return `#${c.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, "0")).join("")}`;
    };
    const infieldMeasured = (await measuredColour(infieldSamples)) || "#7d9457";
    const infield = daylight(infieldMeasured, "#8faa63", 0.45);
    const outer = place(ovalPoly(params.straight, params.r0 + LANES * LANE_W + 0.55));
    const inner = place(ovalPoly(params.straight, params.r0 - 0.45));
    markings.unshift(
      { kind: "fill", colour: terracotta, surface: true, lift: 0.045, poly: outer, holes: [inner] },
      { kind: "fill", colour: infield, surface: true, lift: 0.035, poly: inner },
    );
    return { markings, field, err, cover, score, fitted: params };
  },
});

/* ------------------------------------------------------------ RIMAC Field
   FOUR pitches, two columns by two rows. The model carried two, both in the
   WESTERN column, and the whole eastern column was missing — the defect this
   block exists to correct. Every number below is measured off the chunks.

   THE COLUMNS, from the touchlines' own projection peaks (whiteness projected
   onto the pitches' cross-axis over the north band, z -1140..-1052):

     west column   x  74.93 .. 140.58   (65.65 m)
     east column   x 142.06 .. 202.90   (60.84 m)

   — two long lines 1.5 m apart at the seam between them, which is what a pair
   of adjacent pitches looks like and what settles that this is two columns
   and not one wide field.

   THE ROWS, from the regulation scan (score the WHOLE rulebook at once — two
   goal lines at +-L/2, halfway at 0, penalty areas at +-(L/2 - 16.5), goal
   areas at +-(L/2 - 5.5) — so a ghost line or a kerb cannot pass for a pitch
   by producing one peak):

     north row   goal lines z -1148.0 and -1043.7, penalty areas -1131.8 and
                 -1060.1, goal areas -1142.5 and -1049.2   -> L 104.3
     south row   goal lines z -1053.0 and  -967.6, penalty areas -1036.7 and
                 -984.0                                    -> L  85.4

   Centre circles at exactly 9.15 m — a ruler nothing else in the frame shares
   — land on the halfway lines that scan implies: (107.5, -1095.6) north-west,
   (113.0, -1010.5) south-west, (177.25, -1014.0) south-east.

   WHY THE NORTH-WEST PITCH USED TO MEASURE 0.53. Not two painted generations
   and not missing paint: the seam between the z20 and z19 chunks runs at
   z = -1128, straight across this pitch, and paintCoverage resolved its
   resolution-scaled threshold once at the facility CENTRE (see the note
   there). The northern half was scored against a threshold its imagery
   cannot reach. Per sample, the same fit measures 0.92.

   WHAT IS DELIBERATELY NOT HERE. The east column carries a second complete
   generation 18.1 m north of the south-east pitch — centre (176.0, -1032.1),
   its own full rulebook, coverage 0.90 — from a layout that has since been
   repainted. Two pitches cannot occupy one strip, and the current capture
   shows the south-east pitch level with its western partner, so the older set
   is left unpainted. The north-east pitch has its two touchlines in the
   chunks and nothing else — no circle, no halfway, no goal line, no boxes —
   so it cannot be fitted from the registered source at all; its entry stays
   below so a future imagery refresh re-measures it, and the coverage gate is
   EXPECTED to drop it. Better absent than wrong. */
const RIMAC_GATE = { minCover: 0.75, maxError: 0.35 };

pitch("rimac-nw", "RIMAC Field (north-west pitch)",
  { cx: 107.75, cz: -1095.85, theta: 1.515, L: 104.4, W: 66 },
  { fullBoxes: true, ...RIMAC_GATE,
    sweep: { cx: { span: 2, step: 0.5 }, cz: { span: 2, step: 0.5 }, theta: { span: 0.02, step: 0.005 } },
    ranges: { cx: 1.5, cz: 1.5, theta: 0.008, L: 2.5, W: 2.5 } });
/* Anchored on its own two touchlines for the cross-axis and on its measured
   western partner's row for the along-axis, because the imagery gives it
   nothing of its own to anchor to. Expected to be dropped. */
pitch("rimac-ne", "RIMAC Field (north-east pitch)",
  { cx: 172.48, cz: -1095.85, theta: 1.515, L: 104.4, W: 60.84 },
  { fullBoxes: true, ...RIMAC_GATE,
    sweep: { cx: { span: 4, step: 0.5 }, cz: { span: 12, step: 0.5 }, theta: { span: 0.03, step: 0.005 } },
    ranges: { cx: 2.5, cz: 4, theta: 0.012, L: 4, W: 3 } });
pitch("rimac-sw", "RIMAC Field (south-west pitch)",
  { cx: 113.25, cz: -1010.5, theta: 1.514, L: 85.5, W: 60.5 },
  { fullBoxes: true, ...RIMAC_GATE,
    sweep: { cx: { span: 2, step: 0.5 }, cz: { span: 2, step: 0.5 }, theta: { span: 0.02, step: 0.005 } },
    ranges: { cx: 1.5, cz: 1.5, theta: 0.008, L: 2.5, W: 2.5 } });
/* Leashed hard: the older generation's centre circle is 18.1 m north and the
   sweep must not be allowed to walk onto it. */
pitch("rimac-se", "RIMAC Field (south-east pitch)",
  { cx: 177.38, cz: -1014.13, theta: 1.514, L: 85.5, W: 61 },
  { fullBoxes: true, ...RIMAC_GATE,
    sweep: { cx: { span: 2, step: 0.5 }, cz: { span: 2, step: 0.5 }, theta: { span: 0.02, step: 0.005 } },
    ranges: { cx: 1.5, cz: 1.5, theta: 0.008, L: 2.5, W: 2.5 } });

// Muir Field — the dark multi-sport turf: white soccer core (the lacrosse
// overlay is a different set of hues and stays un-modelled for now) plus the
// trident at centre, traced straight off the paint.
// Probed: goal lines z 66.7/167.0, touchlines x -178.4/-123.5, halfway 117.0.
pitch("muir-field", "Muir Field", { cx: -150.9, cz: 116.9, theta: 1.563, L: 100.3, W: 54.9 }, {
  elements: [],
  ranges: { cx: 0.8, cz: 0.8, theta: 0.006, L: 0.8, W: 0.8 },
  logo: async (p) => {
    /* Navy reads as blue-over-green; the blue-green turf never does. */
    const poly = await traceLogo(p.cx - 8, p.cz - 8, p.cx + 8, p.cz + 8,
      ([R, G, B]) => B > G + 6 && 0.299 * R + 0.587 * G + 0.114 * B < 115);
    return poly ? [{ kind: "fill", colour: "#28356b", poly }] : null;
  },
});

// Warren Field at Canyonview — the crispest of its overlapping sets. The
// painted pitch runs DIAGONAL to the parcel (the QA overlay showed ~15–20°),
// so theta is seeded by a coarse sweep, not trusted from the anchor.
// The painted pitch runs ~25° diagonal to the parcel. Every anchor strategy
// was tried 2026-08-03 — theta sweeps, circle-probe re-centring, wider
// dimensions — and the overlays show WHY none can pass: the field carries
// overlapping painted generations whose circle and touchlines disagree by
// metres, so no single rigid regulation set lies on all of them. The entry
// stays so every rebuild re-measures it (a future repaint may fix it), and
// the coverage gate below is EXPECTED to drop it: better absent than wrong.
pitch("warren-field", "Warren Field", { cx: 950.25, cz: -198.75, theta: -0.44, L: 101, W: 57 },
  { fullBoxes: true,
    sweep: { cx: { span: 1, step: 0.25 }, cz: { span: 1, step: 0.25 }, theta: { span: 0.012, step: 0.004 } },
    ranges: { cx: 0.75, cz: 0.75, theta: 0.008, L: 3, W: 3 } });

// Northview tennis by the track: a bank of 3 (north) and a bank of 4 (south)
// — four, not the five the old rigid row invented. Anchors are the surveyed
// pad centroids + long-edge angles from campus-arcgis.json (the survey traces
// the imagery pads exactly; verified by overlay 2026-08-03). The pads tilt
// ~2.5° off the campus grid and stagger, so each court fits on its own.
// Court CENTRES are hand-measured off the painted doubles rectangles in the
// 0.125 m/px overlay crops (2026-08-03) — the courts sit up to ~5 m off
// their pad centroids, in different directions per court, and the score
// field alone kept sliding onto the bright pad kerbs. Orientation still
// comes from the surveyed pad long edges.
tennisCourts("northview-tennis-north", "Northview Tennis (north bank)", [
  { cx: -51.6, cz: -1353.7, theta: 1.525 },
  { cx: -33.75, cz: -1354.9, theta: 1.524 },
  { cx: -14.85, cz: -1355.6, theta: 1.528 },
]);
tennisCourts("northview-tennis-south", "Northview Tennis (south bank)", [
  { cx: -69.7, cz: -1315.8, theta: 1.535 },
  { cx: -52.2, cz: -1315.8, theta: 1.523 },
  { cx: -33.9, cz: -1316.1, theta: 1.523 },
  { cx: -14.1, cz: -1317.0, theta: 1.528 },
]);

// Muir courts, west of Main Gym: red pad (2 courts) + blue pad (4 courts).
// West pad paint reads faint on the red acrylic (43% baseline, overlay-
// verified on the paint); floor = 0.75 x baseline.
tennisRow("muir-tennis-west", "Muir Tennis (west pad)",
  { cx: -195.15, cz: 16, theta: 0, count: 2, spacing: 19.3, minCover: 0.32 });
tennisRow("muir-tennis-east", "Muir Tennis (east pad)",
  { cx: -140, cz: 16, theta: 0, count: 4, spacing: 17.7 });

// Basketball: the Muir pair, the NTPLL court, Warren's court at Canyonview.
// Both carry faint-paint floors (0.75 x their overlay-verified baselines of
// 39% and 35%): worn paint on acrylic, fits verified on the lines.
basketball("muir-basketball", "Muir basketball courts",
  { cx: -83.3, cz: 47, theta: Math.PI / 2, L: 28.65, W: 15.24, centres: [[0, -9.1], [0, 9.1]],
    minCover: 0.29 });
basketball("ntpll-basketball", "North Torrey Pines basketball court",
  { cx: -207.6, cz: -252.8, theta: 0, L: 28.65, W: 15.24, minCover: 0.26 });
basketball("warren-basketball", "Warren basketball court",
  { cx: 1031, cz: -170.4, theta: -0.30, L: 25, W: 14.7,
    sweep: { theta: { span: 0.45, step: 0.02 }, cx: { span: 3, step: 1 }, cz: { span: 3, step: 1 } } });

// Skipped, and knowingly: Warren's lone tennis court (the bright pad edge
// out-scores its faded lines and every fit slid off the paint), the
// Canyonview pickleball pads, the Muir turf's lacrosse overlay and lettering,
// the RIMAC softball diamond, the track's throw-sector lines, and the older
// painted generation in RIMAC's east column and the ghosts under Warren.
// Better absent than invented.

/* ------------------------------------------------------------------- main */

/* A fit ships only if BOTH honesty metrics pass: mean perpendicular offset
   under 0.5 m AND coverage — the fraction of the emitted line actually
   lying on paint — above the facility's gate. Coverage is what the old
   perpendicular metric could not be: a whole court rotated 15° off its pad
   still measured fitError 0.3 m (dense line sets always have SOME paint
   within a metre) but its coverage collapsed to 14–37%, while the same
   facilities re-fitted onto the paint measure 53–99%.

   One absolute threshold cannot serve every surface, though: worn chalk on
   grass and thin lanes on terracotta measure 22–43% coverage on fits the
   overlays show to be ON the paint — the paint itself is simply faint. So
   facilities whose paint the imagery records weakly carry a calibrated
   `minCover` floor: 0.75 × their overlay-verified 2026-08-03 baseline.
   A misfit of the flagged class measures about HALF a good fit's coverage
   at the same facility, so the floors still catch every regression the
   metric exists for — and anything under a floor is DROPPED, loudly:
   better absent than wrong. */
const COVER_GATE = 0.5; // default; faint-paint facilities carry their own floor

const facilities = [];
for (const f of FACILITIES) {
  if (only && f.id !== only) continue;
  process.stdout.write(`fitting ${f.id} ... `);
  const { markings, field, err, cover, score, full, fitted, overlayMarkings } = await f.build();
  console.log(`score ${score.toFixed(3)} fitError ${Number.isNaN(err) ? "n/a" : err.toFixed(2) + " m"}` +
    ` coverage ${Number.isNaN(cover) ? "n/a" : (cover * 100).toFixed(0) + "%"}`,
    JSON.stringify(fitted, (k, v) => (typeof v === "number" ? Math.round(v * 100) / 100 : v)));
  await renderOverlay(f.id, field, overlayMarkings || markings);
  if (!markings.length) {
    console.warn(`  DROPPED ${f.id}: no court survived its own coverage gate — better absent than wrong.`);
    continue;
  }
  const gate = f.minCover ?? COVER_GATE;
  if (!Number.isNaN(cover) && cover < gate) {
    console.warn(`  DROPPED ${f.id}: only ${(cover * 100).toFixed(0)}% of the emitted line lies on paint ` +
      `(< ${(gate * 100).toFixed(0)}%) — better absent than wrong.`);
    continue;
  }
  /* A facility may also carry a tighter offset gate than the build's global
     0.5 m. RIMAC's four do, because this is where a loose fit shipped once. */
  if (f.maxError !== undefined && !Number.isNaN(err) && err > f.maxError) {
    console.warn(`  DROPPED ${f.id}: mean offset ${err.toFixed(2)} m exceeds its own ` +
      `${f.maxError} m gate — better absent than wrong.`);
    continue;
  }
  facilities.push({
    id: f.id, name: f.name, kind: f.kind,
    ...(full !== undefined ? { full } : {}),
    fitError_m: Number.isNaN(err) ? null : Math.round(err * 100) / 100,
    fitCoverage: Number.isNaN(cover) ? null : Math.round(cover * 100) / 100,
    bounds: boundsOf(markings),
    markings,
  });
}

if (!only) {
  const bad = facilities.filter((f) => f.fitError_m !== null && f.fitError_m > 0.5);
  if (bad.length) {
    console.error(`FIT TOO LOOSE (>0.5 m): ${bad.map((f) => `${f.id}=${f.fitError_m}`).join(", ")}`);
    process.exit(1);
  }
  const out = {
    _: "Generated by scripts/build-campus-markings.mjs — sports-surface markings fitted to the georeferenced satellite chunks. Do not hand-edit.",
    origin: manifest.origin,
    generated: new Date().toISOString().slice(0, 10),
    facilities,
  };
  writeFileSync(OUT, JSON.stringify(out));
  console.log(`wrote ${OUT}: ${facilities.length} facilities, ` +
    `${facilities.reduce((a, f) => a + f.markings.length, 0)} markings`);
}
