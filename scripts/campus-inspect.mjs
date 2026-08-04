/* Photograph the whole campus from a person's eye and from above, so the world
 * can be judged the way it is actually experienced rather than only in a
 * top-down data check.
 *
 * Every fix in the gauntlet loop is a number in a JSON file until someone stands
 * next to it. This drives the real page in a real browser through the same
 * manipulation seam the keys use (`__campusWalk.fly`), so what it photographs is
 * what a visitor sees — no second code path, no offline renderer that could be
 * right about geometry the site gets wrong.
 *
 * Two altitudes, because they fail differently:
 *   WALK     eye height, four yaws per station — catches buildings sunk into or
 *            floating over their ground, z-fighting, clipped trees, facades that
 *            read as impossible from the pavement.
 *   FLYOVER  high and pitched down — catches missing masses, wrong footprints,
 *            whole blocks that never got built.
 *
 * It also records `probe()` at every station, so a frame that looks fine but
 * sits on broken ground data is still caught.
 *
 *   node scripts/campus-inspect.mjs                    # whole campus
 *   node scripts/campus-inspect.mjs --shard r1c1       # one shard
 *   node scripts/campus-inspect.mjs --out <dir>
 */
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const DOCS = path.join(ROOT, "docs");

const argv = process.argv.slice(2);
const argOf = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const ONLY_SHARD = argOf("--shard", null);
const PER_AXIS = Number(argOf("--per-axis", 3));      // walk stations per shard axis
const OUT = path.resolve(argOf("--out", path.join(ROOT, ".cache/campus-inspect")));

const WALK_EYE = 1.7;          // metres — a person
const WALK_YAWS = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
const FLY_HOVER = 260;         // metres — the block reads whole
const FLY_PITCH = -0.62;

/* ------------------------------------------------------------------ stations */
const shards = JSON.parse(
  execFileSync("node", [path.join(ROOT, "scripts/gauntlet-shards.mjs"), "--json"], { encoding: "utf8" })
).filter((s) => !ONLY_SHARD || s.id === ONLY_SHARD);

if (!shards.length) { console.error(`no shard matched ${ONLY_SHARD}`); process.exit(2); }

const stations = [];
for (const s of shards) {
  const { x0, x1, z0, z1 } = s.localBox;
  /* Interior sample points — never the exact edge, which lands in a neighbour. */
  for (let i = 0; i < PER_AXIS; i++) {
    for (let j = 0; j < PER_AXIS; j++) {
      const fx = (i + 1) / (PER_AXIS + 1), fz = (j + 1) / (PER_AXIS + 1);
      stations.push({
        shard: s.id, kind: "walk", id: `${s.id}-w${i}${j}`,
        x: +(x0 + fx * (x1 - x0)).toFixed(1),
        z: +(z0 + fz * (z1 - z0)).toFixed(1),
      });
    }
  }
  stations.push({
    shard: s.id, kind: "flyover", id: `${s.id}-fly`,
    x: +((x0 + x1) / 2).toFixed(1), z: +((z0 + z1) / 2).toFixed(1),
  });
}

/* --------------------------------------------------------------------- serve */
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

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

await page.goto(base, { waitUntil: "load" });
await page.waitForFunction(() => document.body.classList.contains("walk-live"), null, { timeout: 180_000 });
await page.waitForFunction(() => !!window.__campusWalk?.fly, null, { timeout: 30_000 });

/* ------------------------------------------------------------------ capture */
const frames = [];
let i = 0;
for (const st of stations) {
  i++;
  const yaws = st.kind === "walk" ? WALK_YAWS : [0];
  const hover = st.kind === "walk" ? WALK_EYE : FLY_HOVER;
  const pitch = st.kind === "walk" ? -0.05 : FLY_PITCH;

  for (const yaw of yaws) {
    const probe = await page.evaluate(
      ({ x, z, hover, yaw, pitch }) => {
        window.__campusWalk.fly(x, z, hover, yaw, pitch);
        return window.__campusWalk.probe(x, z);
      },
      { x: st.x, z: st.z, hover, yaw, pitch },
    );
    /* Let the renderer settle — terrain and massing stream in per position. */
    await page.waitForTimeout(st.kind === "walk" ? 450 : 900);

    const name = `${st.id}${yaws.length > 1 ? `-y${Math.round((yaw * 180) / Math.PI)}` : ""}.png`;
    const file = path.join(OUT, name);
    await page.screenshot({ path: file });

    frames.push({
      file: name, shard: st.shard, kind: st.kind,
      x: st.x, z: st.z, yawDeg: Math.round((yaw * 180) / Math.PI),
      eyeAboveGround: st.kind === "walk" ? WALK_EYE : FLY_HOVER,
      ground: probe?.ground ?? null,
      roof: probe?.roof ?? null,
      /* A person standing INSIDE solid mass — the roof under the station is
         above the eye. Reported, not judged: an arcade or overhang is legitimate. */
      insideMass: probe?.roof != null && probe.roof > (probe.ground ?? 0) + WALK_EYE,
    });
  }
  if (i % 5 === 0 || i === stations.length) {
    console.log(`  ${i}/${stations.length} stations, ${frames.length} frames`);
  }
}

const manifest = {
  generated: new Date().toISOString(),
  shards: shards.map((s) => s.id),
  stations: stations.length,
  frames,
  pageErrors: errors,
  counts: {
    walk: frames.filter((f) => f.kind === "walk").length,
    flyover: frames.filter((f) => f.kind === "flyover").length,
    insideMass: frames.filter((f) => f.insideMass).length,
    nullGround: frames.filter((f) => f.ground == null).length,
  },
};
await writeFile(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));

await browser.close();
server.close();

console.log(`\n${frames.length} frames -> ${OUT}`);
console.log(`  walk ${manifest.counts.walk}, flyover ${manifest.counts.flyover}`);
console.log(`  stations inside mass: ${manifest.counts.insideMass}, null ground: ${manifest.counts.nullGround}`);
if (errors.length) {
  console.log(`  PAGE ERRORS (${errors.length}):`);
  for (const e of errors.slice(0, 5)) console.log(`    ${e.slice(0, 160)}`);
}
