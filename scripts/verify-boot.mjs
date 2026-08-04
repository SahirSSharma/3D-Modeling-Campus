// Loads the real page in a real browser and checks the things that only show up
// at runtime: that every dataset is downloaded exactly once, and that the roof
// map the flight controls sample actually covers the buildings.
//
// Both are invisible from a screenshot. A duplicated fetch just makes the load
// slower; a hole in the roof map looks like nothing at all until you hold Q over
// a building the sampler cannot see and shoot up at thirty metres a second. So
// they get asserted here rather than eyeballed.
//
// Run: npm run verify:boot -- [--headed]
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* Its own server on an ephemeral port rather than scripts/serve.mjs, which
   starts listening on import and on a fixed port. */
const DOCS = fileURLToPath(new URL("../docs/", import.meta.url));
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml" };

const server = createServer(async (req, res) => {
  const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html";
  const file = path.join(DOCS, rel);
  if (!file.startsWith(DOCS)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({ headless: !process.argv.includes("--headed") });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

/* Count by path, not by URL, so a cache-buster could not hide a duplicate. */
const hits = new Map();
page.on("request", (r) => {
  const u = new URL(r.url());
  if (u.origin !== new URL(base).origin) return;
  hits.set(u.pathname, (hits.get(u.pathname) || 0) + 1);
});
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

await page.goto(base, { waitUntil: "load" });
await page.waitForFunction(() => document.body.classList.contains("walk-live"), null, { timeout: 120_000 });
await page.waitForFunction(() => !!window.__campusWalk?.probe, null, { timeout: 30_000 });

/* ---- every dataset exactly once ---- */
const dupes = [...hits].filter(([p, n]) => p.startsWith("/data/") && n > 1);
console.log(`\ndata files fetched: ${[...hits].filter(([p]) => p.startsWith("/data/")).length}`);
for (const [p, n] of [...hits].filter(([p]) => p.startsWith("/data/")).sort()) {
  console.log(`  ${n > 1 ? "DUPLICATE" : "once     "}  ${n}x  ${p}`);
}

/* ---- does the roof map cover the buildings? ----
   Probe the centroid of every footprint in the source data. A building that got
   extruded should report a roof above its own ground. */
const coverage = await page.evaluate(async () => {
  const r = await fetch("data/campus-3d.json");
  const campus = await r.json();
  /* Needed to tell a hole in the roof map from a bad probe: the vertex-average
     "centroid" of an L- or U-shaped building lies OUTSIDE the building, so
     probing it correctly returns no roof. Those are the probe's fault and must
     not be counted against coverage. */
  const { pointInRings } = await import("./js/campus-terrain.js");
  /* A footprint in campus-3d.json is { h, p: [[x, z], ...] } — `p`, not
     `rings`. Reading the wrong key silently probes nothing and reports 0/0. */
  const foots = (campus.buildings || []).filter((b) => b?.p?.length >= 3);
  let hit = 0, miss = 0, outside = 0, sumRise = 0;
  const misses = [];
  for (const b of foots) {
    const ring = b.p;
    let sx = 0, sz = 0;
    for (const [x, z] of ring) { sx += x; sz += z; }
    const cx = sx / ring.length, cz = sz / ring.length;
    const p = window.__campusWalk.probe(cx, cz);
    if (p.roof !== null && p.roof > p.ground) { hit++; sumRise += p.roof - p.ground; continue; }
    if (!pointInRings(cx, cz, [ring])) { outside++; continue; }
    miss++;
    if (misses.length < 8) {
      /* Is the roof genuinely absent, or merely offset? assembleMasses prefers
         the university's own GIS survey over the OSM footprint where both
         describe one building, and the two do not agree vertex for vertex — so a
         roof a few metres away means the building IS in the map and this
         centroid just fell outside the surveyed outline. That is a different
         (and far less interesting) finding than a hole. */
      let nearest = null;
      for (let r = 4; r <= 40 && nearest === null; r += 4) {
        for (let a = 0; a < 8; a++) {
          const q = window.__campusWalk.probe(cx + r * Math.cos(a * Math.PI / 4), cz + r * Math.sin(a * Math.PI / 4));
          if (q.roof !== null) { nearest = r; break; }
        }
      }
      misses.push({ h: b.h ?? null, cx: Math.round(cx), cz: Math.round(cz), nearest, ...p });
    }
  }
  const g = window.__campusWalk.places()["Geisel Library"];
  return {
    footprints: foots.length, hit, miss, outside, misses,
    meanRise: Math.round((sumRise / Math.max(1, hit)) * 10) / 10,
    geisel: g ? window.__campusWalk.probe(g.x, g.z) : null,
  };
});

const probed = coverage.hit + coverage.miss;
const pct = ((coverage.hit / probed) * 100).toFixed(1);
console.log(`\nroof map coverage: ${coverage.hit}/${probed} probeable footprints (${pct}%)`);
console.log(`  ${coverage.outside} of ${coverage.footprints} skipped: vertex-average centroid falls outside its own concave footprint`);
console.log(`  mean roof rise above own ground: ${coverage.meanRise} m`);
if (coverage.geisel) {
  const g = coverage.geisel;
  console.log(`  Geisel Library: ground ${g.ground?.toFixed(1)} m, roof ${g.roof === null ? "NONE" : g.roof.toFixed(1) + " m"}`);
}
if (coverage.misses.length) {
  /* A footprint with no height in the source data is never extruded, so having
     no roof is correct, not a gap. */
  console.log("  misses:");
  for (const m of coverage.misses) {
    const near = m.nearest === null ? "no roof within 40 m — a real hole" : `roof found ${m.nearest} m away — offset footprint, not a hole`;
    console.log(`    ${m.cx},${m.cz} — source height ${m.h === null ? "absent" : m.h + " m"}, ground ${m.ground?.toFixed(1)}; ${near}`);
  }
}

/* ---- the climb rate that coverage buys ---- */
const feel = await page.evaluate(() => {
  const g = window.__campusWalk.places()["Geisel Library"];
  const p = window.__campusWalk.probe(g.x, g.z);
  const rate = (c) => 1.5 + 0.55 * c;
  return {
    twoOverGeiselRoof: rate(2),
    sameSpotIfRoofUnknown: rate(p.roof - p.ground + 2),
  };
});
console.log(`\ntwo metres over Geisel's deck: ${feel.twoOverGeiselRoof.toFixed(2)} m/s`);
console.log(`  had the roof been missing:    ${feel.sameSpotIfRoofUnknown.toFixed(2)} m/s`);

console.log(`\nconsole errors: ${errors.length}`);
for (const e of errors.slice(0, 10)) console.log(`  ${e}`);

await browser.close();
server.close();

const failures = [];
if (dupes.length) failures.push(`${dupes.length} dataset(s) fetched more than once`);
/* Explicitly: a probe that found nothing to probe is a broken probe, not a
   pass. NaN fails every comparison, so `< 0.95` alone would have let 0/0 through
   — and did, the first time this ran. */
if (!probed) failures.push("probed no footprints at all");
else if (coverage.hit / probed < 0.98) failures.push(`roof coverage only ${pct}%`);
if (coverage.geisel && coverage.geisel.roof === null) failures.push("Geisel Library has no roof in the sampler");
if (errors.length) failures.push(`${errors.length} console error(s)`);
if (failures.length) { console.error(`\nFAIL: ${failures.join("; ")}`); process.exit(1); }
console.log("\nPASS");
