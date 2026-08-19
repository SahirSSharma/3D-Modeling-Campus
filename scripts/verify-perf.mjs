// The performance gate: the live site must hold 60 fps on the machine that
// reviews it.
//
// Real Chrome (channel), never Playwright's bundled Chromium and never
// headless — both can fall back to software rendering on macOS and then this
// gate measures the fallback, not the product. The harness asserts the
// unmasked renderer string and refuses to grade a software rasteriser.
//
// The adaptive controller (campus-quality.js) is part of what is being
// graded: each station gets a settle window first, so the measurement is the
// steady state a visitor actually reaches, not the first seconds of the
// controller walking its ladder.
//
// Run: npm run verify:perf          (headed Chrome window opens; ~2 min)
import { createRequire } from "node:module";
const { chromium } = createRequire(new URL("../package.json", import.meta.url))("@playwright/test");
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AVG_FLOOR = 55; // fps, per station, steady state — 60 minus vsync jitter
const P5_FLOOR = 38;  // fps, worst 5% of frames. Empirical, not derived:
                      // healthy steady-state runs on the review machine show
                      // p5 between 40 (a station where ~5% of frames slip to
                      // the 25.1 ms vsync step on a 120 Hz panel) and 59.
                      // 38 sits just under that observed floor, so it trips
                      // on sustained stutter (frames beyond the triple-vsync
                      // step) without failing on the healthy quantised case.
const MAX_LEVEL = 6;  // the controller may spend quality to hold 60, but not
                      // all of it: a change that only holds 60 at the ladder
                      // floor (level 7 — pr 0.7, lod halved) is a perf
                      // regression this gate exists to catch.

const DOCS = fileURLToPath(new URL("../docs/", import.meta.url));
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".bin": "application/octet-stream", ".png": "image/png", ".svg": "image/svg+xml" };
const server = createServer(async (req, res) => {
  const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html";
  const file = path.join(DOCS, rel);
  if (!file.startsWith(DOCS)) { res.writeHead(403).end(); return; }
  try { res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" }).end(await readFile(file)); }
  catch { res.writeHead(404).end("not found"); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({ headless: false, channel: "chrome", args: ["--window-size=1456,980"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

await page.goto(`${base}?mode=campus`, { waitUntil: "load" });
await page.waitForFunction(() => document.body.classList.contains("walk-live"), null, { timeout: 120_000 });
await page.waitForFunction(() => window.__campusWalk?.streamed === true, null, { timeout: 120_000 });

const gpu = await page.evaluate(() => {
  const gl = window.__campusWalk.renderer.getContext();
  const ext = gl.getExtension("WEBGL_debug_renderer_info");
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : String(gl.getParameter(gl.RENDERER));
});
console.log(`renderer: ${gpu}`);
if (/swiftshader|software/i.test(gpu)) {
  console.error("software rendering — this gate cannot be graded here");
  process.exit(1);
}

/* The hardest ground-level stand in the HD zone, the campus overview, and
   the region hover — the three loads that differ most. */
const STATIONS = [
  { name: "eighth-ground", x: -140, z: 580, hover: 1.7, yaw: 2.5, pitch: -0.05 },
  { name: "campus-mid", x: 0, z: 0, hover: 110, yaw: 0, pitch: -0.35 },
  { name: "region-high", x: 0, z: 0, hover: 900, yaw: 0, pitch: -0.9 },
];

let failed = false;
/* Settle = the controller's LEVEL holding still, not a fixed wait: the
   ladder legitimately probes upward after recovering (with growing backoff),
   and a fixed timer can land a measurement mid-probe and grade the wrong
   level. Wait for 8 quiet seconds, cap at 45 s. */
async function settle() {
  let last = await page.evaluate(() => window.__campusWalk.quality.level);
  let quiet = 0;
  for (let t = 0; t < 45 && quiet < 8; t++) {
    await page.waitForTimeout(1000);
    const now = await page.evaluate(() => window.__campusWalk.quality.level);
    quiet = now === last ? quiet + 1 : 0;
    last = now;
  }
  return last;
}

for (const s of STATIONS) {
  await page.evaluate((st) => window.__campusWalk.fly(st.x, st.z, st.hover, st.yaw, st.pitch), s);
  const measureOnce = () => page.evaluate(() => new Promise((resolve) => {
    const q = window.__campusWalk.quality;
    let start = 0; const ds = [];
    function tick(now) {
      if (!start) { start = now; requestAnimationFrame(tick); return; }
      ds.push(now - (tick.last ?? start)); tick.last = now;
      if (now - start < 5000) { requestAnimationFrame(tick); return; }
      ds.sort((a, b) => b - a);
      resolve({
        avg: 1000 / (ds.reduce((a, b) => a + b, 0) / ds.length),
        p5: 1000 / ds[Math.floor(ds.length * 0.05)],
        level: q.level,
      });
    }
    requestAnimationFrame(tick);
  }));
  let level = await settle();
  let m = await measureOnce();
  if (m.level !== level) {
    /* A probe fired inside the measurement window — the sample graded a
       level transition, not a steady state. One re-settle and re-measure. */
    level = await settle();
    m = await measureOnce();
  }
  const ok = m.avg >= AVG_FLOOR && m.p5 >= P5_FLOOR && m.level <= MAX_LEVEL;
  if (!ok) failed = true;
  console.log(`${ok ? "ok  " : "FAIL"} ${s.name.padEnd(14)} avg ${m.avg.toFixed(1)} fps · p5 ${m.p5.toFixed(1)} fps · quality level ${m.level}${m.level > MAX_LEVEL ? ` > max ${MAX_LEVEL}` : ""}`);
}
if (errors.length) { failed = true; console.error("console errors:", errors.slice(0, 10)); }

await browser.close();
server.close();
if (failed) { console.error(`\nverify:perf FAILED (floors: avg ${AVG_FLOOR}, p5 ${P5_FLOOR})`); process.exit(1); }
console.log(`\nverify:perf ok — every station holds avg ≥ ${AVG_FLOOR} fps, p5 ≥ ${P5_FLOOR} fps`);
