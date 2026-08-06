#!/usr/bin/env node
/* Side-by-side proof that the live Campus Walk render matches what Apple's
 * own camera saw — same ground position, same MEASURED compass heading.
 *
 * The manifest (.cache/eighth-area/manifest.json) records, per Apple capture
 * frame, the compass bearing `look` read directly off the on-screen compass
 * rose (see scripts/apple-flyover.mjs). That is the ground truth heading;
 * this script does not re-derive it, only converts it into this repo's yaw
 * convention (see HEADING → YAW CONVERSION below) and drives the real page
 * through the same `__campusWalk.fly` seam campus-inspect.mjs uses — no
 * second offline renderer that could be right about geometry the site gets
 * wrong.
 *
 *   node scripts/eighth-compare.mjs --frame r1c2-plan-00-south
 *   node scripts/eighth-compare.mjs --all [--out <dir>]
 */
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const DOCS = path.join(ROOT, "docs");
const MANIFEST_PATH = path.join(ROOT, ".cache/eighth-area/manifest.json");

const argv = process.argv.slice(2);
const argOf = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const has = (n) => argv.includes(n);
const FRAME = argOf("--frame", null);
const ALL = has("--all");
const OUT_BASE = path.resolve(argOf("--out", path.join(ROOT, ".cache/eighth-compare")));

if (!FRAME && !ALL) {
  console.error("usage: node scripts/eighth-compare.mjs --frame <name> [--out <dir>]");
  console.error("       node scripts/eighth-compare.mjs --all [--out <dir>]");
  process.exit(2);
}

/* ---------------------------------------------------------------- origin */
const campus3d = JSON.parse(await readFile(path.join(DOCS, "data/campus-3d.json"), "utf8"));
const origin = campus3d.origin; // {lat, lng, mPerDegLat, mPerDegLng}

function toLocal(lat, lng) {
  const x = (lng - origin.lng) * origin.mPerDegLng;
  const z = (origin.lat - lat) * origin.mPerDegLat;
  return { x, z };
}

/* look (0=N,90=E,180=S,270=W clockwise) -> this repo's yaw (0=south, +90=east) */
function lookToYawDeg(look) {
  return ((180 - look) % 360 + 540) % 360 - 180;
}

/* ------------------------------------------------------------ camera plan */
const PLAN_HOVER = 260;    // metres — matches campus-inspect.mjs FLY_HOVER, block reads whole
const PLAN_PITCH = -1.3;   // rad — steep near-vertical, short of -PI/2 to dodge gimbal issues
const OBLIQUE_HOVER = 90;  // metres — low/close so facades read
const OBLIQUE_PITCH = -0.25; // rad — shallow

function cameraForPass(pass) {
  if (pass === "plan") return { hover: PLAN_HOVER, pitch: PLAN_PITCH };
  if (pass === "oblique") return { hover: OBLIQUE_HOVER, pitch: OBLIQUE_PITCH };
  throw new Error(`unknown pass "${pass}" — expected "plan" or "oblique"`);
}

/* --------------------------------------------------------------- manifest */
let manifestRaw;
try {
  manifestRaw = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
} catch (e) {
  console.error(`cannot read manifest at ${MANIFEST_PATH}: ${e.message}`);
  process.exit(2);
}
const { targets, manifest } = manifestRaw;
const targetByName = new Map(targets.map((t) => [t.name, t]));

function frameNameOf(entry) {
  return path.basename(entry.file, path.extname(entry.file));
}

const entriesByFrameName = new Map(manifest.map((e) => [frameNameOf(e), e]));

function resolveFrame(name) {
  const entry = entriesByFrameName.get(name);
  if (!entry) return null;
  const target = targetByName.get(entry.name);
  if (!target) return null;
  return { entry, target };
}

if (FRAME) {
  const resolved = resolveFrame(FRAME);
  if (!resolved) {
    const names = [...entriesByFrameName.keys()];
    console.error(`unknown frame "${FRAME}"`);
    if (names.length <= 20) {
      console.error(`valid frame names (${names.length}):`);
      for (const n of names) console.error(`  ${n}`);
    } else {
      console.error(`${names.length} valid frame names, e.g. "${names[0]}"`);
    }
    process.exit(1);
  }
}

/* -------------------------------------------------------- eighth bbox filter */
const BBOX = { x0: -200, x1: -40, z0: 510, z1: 690 };
function inEighthBbox(target) {
  const { x, z } = toLocal(target.lat, target.lng);
  return x >= BBOX.x0 && x <= BBOX.x1 && z >= BBOX.z0 && z <= BBOX.z1;
}

/* ------------------------------------------------------------------ serve */
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml" };
const server = createServer(async (req, res) => {
  const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html";
  const file = path.join(DOCS, rel);
  if (!file.startsWith(DOCS)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404).end("not found"); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
let page;

/* --------------------------------------------------------------- capture */
async function fileExists(p) {
  try { await access(p); return true; } catch { return false; }
}

/** Render one frame's comparison. Returns a result object, or null (and
 *  writes nothing) if the Apple capture is missing from disk. */
async function renderOne(frameName, outDir) {
  const resolved = resolveFrame(frameName);
  if (!resolved) throw new Error(`unknown frame "${frameName}"`);
  const { entry, target } = resolved;

  const applePath = path.join(ROOT, entry.file);
  if (!(await fileExists(applePath))) {
    console.error(`missing Apple capture for "${frameName}": ${applePath}`);
    return null;
  }

  const { x, z } = toLocal(target.lat, target.lng);
  const yawDeg = lookToYawDeg(entry.look);
  const yawRad = (yawDeg * Math.PI) / 180;
  const { hover, pitch } = cameraForPass(entry.pass);

  await page.evaluate(
    ({ x, z, hover, yaw, pitch }) => window.__campusWalk.fly(x, z, hover, yaw, pitch),
    { x, z, hover, yaw: yawRad, pitch },
  );
  await page.waitForTimeout(entry.pass === "plan" ? 900 : 600);

  await mkdir(outDir, { recursive: true });
  const renderPath = path.join(outDir, "render.png");
  await page.screenshot({ path: renderPath });

  const appleMeta = await sharp(applePath).metadata();
  const renderMeta = await sharp(renderPath).metadata();
  const gap = 4;
  const outW = appleMeta.width + renderMeta.width + gap;
  const outH = Math.max(appleMeta.height, renderMeta.height);

  const sidebySidePath = path.join(outDir, "side-by-side.png");
  await sharp({ create: { width: outW, height: outH, channels: 3, background: { r: 20, g: 20, b: 20 } } })
    .composite([
      { input: applePath, left: 0, top: 0 },
      { input: renderPath, left: appleMeta.width + gap, top: 0 },
    ])
    .png()
    .toFile(sidebySidePath);

  const compare = {
    frame: frameName,
    target: { name: target.name, lat: target.lat, lng: target.lng },
    pass: entry.pass,
    look: entry.look,
    yawDeg,
    yawRad,
    camera: { x, z, hover, pitch, altitude: hover },
    apple: { file: path.relative(ROOT, applePath), width: appleMeta.width, height: appleMeta.height },
    render: { file: path.relative(outDir, renderPath), width: renderMeta.width, height: renderMeta.height },
    sideBySide: path.relative(outDir, sidebySidePath),
  };
  await writeFile(path.join(outDir, "compare.json"), JSON.stringify(compare, null, 2));

  return compare;
}

let exitCode = 0;

try {
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(base, { waitUntil: "load" });
  await page.waitForFunction(() => document.body.classList.contains("walk-live"), null, { timeout: 180_000 });
  await page.waitForFunction(() => !!window.__campusWalk?.fly, null, { timeout: 30_000 });

  if (FRAME) {
    const outDir = path.join(OUT_BASE, FRAME);
    const result = await renderOne(FRAME, outDir);
    if (!result) {
      exitCode = 1;
    } else {
      console.log(`${FRAME} -> ${path.join(outDir, "side-by-side.png")}`);
    }
  } else {
    /* --all: every manifest entry whose TARGET falls inside the Eighth College bbox */
    const wanted = manifest.filter((entry) => {
      const target = targetByName.get(entry.name);
      return target && inEighthBbox(target);
    });
    console.log(`--all: ${wanted.length} frames in Eighth College bbox`);

    await mkdir(OUT_BASE, { recursive: true });
    const results = [];
    const skipped = [];
    const errors = [];
    let i = 0;
    for (const entry of wanted) {
      i++;
      const frameName = frameNameOf(entry);
      const outDir = path.join(OUT_BASE, frameName);
      let result;
      try {
        result = await renderOne(frameName, outDir);
      } catch (e) {
        console.error(`  ! ${frameName} failed: ${e.message}`);
        errors.push({ frame: frameName, error: e.message });
        result = null;
      }
      if (result) {
        results.push(result);
      } else if (!errors.some((e) => e.frame === frameName)) {
        skipped.push(frameName);
      }
      if (i % 10 === 0 || i === wanted.length) console.log(`  ${i}/${wanted.length}`);
    }

    const bySurvey = new Map();
    for (const r of results) {
      if (!bySurvey.has(r.target.name)) bySurvey.set(r.target.name, []);
      bySurvey.get(r.target.name).push(r);
    }

    const rows = [...bySurvey.entries()].map(([name, frames]) => {
      const t = targetByName.get(name);
      const cards = frames
        .map(
          (f) => `<figure><a href="${f.frame}/side-by-side.png"><img loading="lazy" src="${f.frame}/side-by-side.png"></a>
      <figcaption>${f.pass} · look ${Math.round(f.look)}° · yaw ${Math.round(f.yawDeg)}°</figcaption></figure>`,
        )
        .join("");
      return `<section><h2>${name}</h2>
      <p class="meta">${t.lat.toFixed(6)}, ${t.lng.toFixed(6)} · ${frames.length} frames</p>
      <div class="grid">${cards}</div></section>`;
    });

    const html = `<!doctype html><meta charset="utf-8">
<title>Eighth College — side-by-side (Apple Maps vs Campus Walk)</title>
<style>body{margin:0;padding:32px;background:#0b0d10;color:#e8eaed;font:15px/1.5 -apple-system,system-ui,sans-serif}
h1{font-size:22px;margin:0 0 6px}h2{font-size:18px;margin:38px 0 4px;color:#fff}
.lede,.meta{color:#9aa3ad;font-size:13px;margin:0 0 10px}.lede{max-width:70ch;margin-bottom:26px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(480px,1fr));gap:14px}
figure{margin:0;background:#14181d;border:1px solid #232a31;border-radius:8px;overflow:hidden}
img{width:100%;display:block}figcaption{padding:8px 10px;font-size:12px;color:#9aa3ad}</style>
<h1>Eighth College — Apple Maps vs Campus Walk</h1>
<p class="lede">Each pair is the same ground position and the same MEASURED compass heading: Apple's capture on the left, the live Campus Walk render on the right, driven through <code>window.__campusWalk.fly</code>.${
      skipped.length ? ` ${skipped.length} frame(s) skipped — missing Apple capture: ${skipped.join(", ")}.` : ""
    }${errors.length ? ` ${errors.length} frame(s) errored: ${errors.map((e) => e.frame).join(", ")}.` : ""}</p>
${rows.join("\n")}`;
    await writeFile(path.join(OUT_BASE, "index.html"), html);
    await writeFile(
      path.join(OUT_BASE, "compare-all.json"),
      JSON.stringify({ generated: new Date().toISOString(), results, skipped, errors }, null, 2),
    );

    console.log(`${results.length} rendered, ${skipped.length} skipped, ${errors.length} errored -> ${OUT_BASE}`);
    if (skipped.length) {
      console.log(`  skipped (missing Apple capture): ${skipped.join(", ")}`);
    }
    if (errors.length) {
      console.log(`  errored: ${errors.map((e) => e.frame).join(", ")}`);
      exitCode = 1;
    }
  }
} finally {
  try {
    await browser.close();
  } finally {
    server.close();
  }
}
process.exit(exitCode);
