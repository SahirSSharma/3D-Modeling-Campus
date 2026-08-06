/* Orbit a named building in Google Photorealistic 3D Tiles and photograph it.
 *
 * WHY THIS EXISTS
 * Both imagery connectors in scripts/lib/imagery.mjs are strictly nadir by API
 * contract — Google 2D tiles and the Apple Snapshot endpoint have no pitch or
 * heading parameter. That makes every facade question in this project
 * unanswerable from imagery: a roof outline cannot say how many storeys a ring
 * is, what its walls look like, or whether the mesh even has the building.
 *
 * tile.googleapis.com/v1/3dtiles answers on the SAME key and returns real
 * textured glTF, which is renderable from any angle. This script drives a
 * headless CesiumJS over that tileset, points the camera at a footprint
 * centroid taken from campus-3d.json, and writes one PNG per (heading, pitch).
 * The label is burned into the frame so a picture cannot drift from its angle.
 *
 * WHAT IT PROVES AND WHAT IT DOES NOT
 * It shows what the Google mesh contains at that spot, from that angle. It does
 * NOT date the mesh: an absent building is a vintage statement, not a missing
 * label (see the 2026-08-04 Eighth College correction). Compare against a
 * current nadir source before concluding anything about the campus itself.
 *
 *   node scripts/tiles-orbit.mjs --name Sankofa,Pulse [--headings 8]
 *        [--pitches -30,-10] [--range 110] [--outdir .cache/tiles-orbit]
 *
 * --range is a floor; the actual orbit radius is max(range, 2.6 x footprint
 * radius), and the compass word in each caption is measured from where the
 * camera actually ended up, not from the heading that was asked for.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const argv = process.argv.slice(2);
const argOf = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };

const NAMES = String(argOf("--name", "")).split(",").map(s => s.trim()).filter(Boolean);
const HEADINGS = Number(argOf("--headings", 8));
const PITCHES = String(argOf("--pitches", "-30,-10")).split(",").map(Number);
const RANGE = Number(argOf("--range", 110));
const NADIR = !argv.includes("--no-nadir");
const OUTDIR = path.resolve(ROOT, argOf("--outdir", ".cache/tiles-orbit"));
const WIDTH = Number(argOf("--width", 1600));
const HEIGHT = Number(argOf("--height", 1000));

if (!NAMES.length) {
  console.error("usage: node scripts/tiles-orbit.mjs --name <Building>[,<Building>...]");
  process.exit(1);
}

/* The key is the same one the 2D connectors already use. Read it the way the
   rest of the repo does rather than requiring an exported env. */
const KEY = (readFileSync(path.join(ROOT, ".env"), "utf8")
  .match(/^GOOGLE_MAPS_API_KEY=(.+)$/m) || [])[1]?.trim();
if (!KEY) { console.error("no GOOGLE_MAPS_API_KEY in .env"); process.exit(1); }

const campus = JSON.parse(readFileSync(path.join(ROOT, "docs/data/campus-3d.json"), "utf8"));
const { lat: LAT0, lng: LNG0, mPerDegLat, mPerDegLng } = campus.origin;
/* +z is SOUTH in this project's frame — same convention as ring-snapshot.mjs. */
const toLatLng = (x, z) => ({ lat: LAT0 - z / mPerDegLat, lng: LNG0 + x / mPerDegLng });

const targets = [];
for (const name of NAMES) {
  const hits = campus.buildings.filter(b => b.n && b.n.toLowerCase() === name.toLowerCase());
  if (!hits.length) { console.error(`no building named ${name} in campus-3d.json`); process.exit(1); }
  /* A name can carry several rings; orbit the union centroid so a wing does not
     pull the camera off the building. */
  let sx = 0, sz = 0, n = 0, h = 0;
  for (const b of hits) {
    for (const [x, z] of b.p) { sx += x; sz += z; n++; }
    h = Math.max(h, b.h ?? 0);
  }
  const c = toLatLng(sx / n, sz / n);
  /* Footprint radius drives the range, so a 40 m wing and a 200 m block are
     both framed as a building rather than as a neighbourhood. */
  let r2 = 0;
  const outlines = hits.map(b => b.p.map(([x, z]) => {
    r2 = Math.max(r2, (x - sx / n) ** 2 + (z - sz / n) ** 2);
    const ll = toLatLng(x, z);
    return [ll.lng, ll.lat];
  }));
  targets.push({ name, lat: c.lat, lng: c.lng, h, rings: hits.length, radius: Math.sqrt(r2), outlines });
  console.log(`${name}: ${c.lat.toFixed(6)},${c.lng.toFixed(6)}  rings=${hits.length}  h=${h}m  r=${Math.sqrt(r2).toFixed(0)}m`);
}

mkdirSync(OUTDIR, { recursive: true });

/* 85 PNGs in a folder is not a reviewable artefact. The sheet groups them by
   building and orders the orbit N->NW so a facade can be compared against its
   neighbour without hunting filenames. Rebuild it alone with --sheet-only. */
function writeSheet(tgts, frames) {
  const order = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
  const rank = f => f.pitch === -90 ? 99 : order.indexOf(f.side ?? "") + (f.pitch <= -20 ? 0 : 10);
  const sections = tgts.map(t => {
    const mine = frames.filter(f => f.name === t.name).sort((a, b) => rank(a) - rank(b));
    const cards = mine.map(f => `<figure><a href="${path.basename(f.file)}"><img loading="lazy" src="${path.basename(f.file)}"></a>
      <figcaption>${f.pitch === -90 ? "top-down" : `from the ${f.side} · pitch ${f.pitch}°`}${f.settled ? "" : " · <b>LOD not settled</b>"}</figcaption></figure>`).join("");
    return `<section><h2>${t.name}</h2>
      <p class="meta">${t.lat.toFixed(6)}, ${t.lng.toFixed(6)} · ${t.rings} footprint ring${t.rings > 1 ? "s" : ""} in campus-3d.json · repo height guess ${t.h} m · ${mine.length} frames</p>
      <div class="grid">${cards}</div></section>`;
  }).join("");
  writeFileSync(path.join(OUTDIR, "index.html"), `<!doctype html><meta charset="utf-8">
<title>Eighth College — Google Photorealistic 3D Tiles orbit</title>
<style>
  body{margin:0;padding:32px;background:#0b0d10;color:#e8eaed;font:15px/1.5 -apple-system,system-ui,sans-serif}
  h1{font-size:22px;margin:0 0 6px} h2{font-size:18px;margin:38px 0 4px;color:#fff}
  .lede,.meta{color:#9aa3ad;font-size:13px;margin:0 0 10px} .lede{max-width:70ch;margin-bottom:26px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px}
  figure{margin:0;background:#14181d;border:1px solid #232a31;border-radius:8px;overflow:hidden}
  img{width:100%;display:block} figcaption{padding:8px 10px;font-size:12px;color:#9aa3ad}
  b{color:#ffb4b4}
</style>
<h1>Eighth College, seen from every side</h1>
<p class="lede">Rendered from <b style="color:#e8eaed">tile.googleapis.com/v1/3dtiles</b> on the key already in this repo's .env — the same key the flat 2D connectors use. Magenta is the footprint from campus-3d.json, projected into each frame, so every picture names which building it is. The compass word is measured from where the camera ended up, not from the heading requested. Imagery &copy; Google.</p>
${sections}`);
  console.log(`sheet -> ${path.relative(ROOT, path.join(OUTDIR, "index.html"))}`);
}

if (argv.includes("--sheet-only")) {
  const m = JSON.parse(readFileSync(path.join(OUTDIR, "manifest.json"), "utf8"));
  writeSheet(m.targets, m.manifest);
  process.exit(0);
}

const page = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/cesium@1.121.0/Build/Cesium/Widgets/widgets.css">
<style>
  html,body,#c{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#000}
  #label{position:absolute;left:0;bottom:0;z-index:9;font:16px ui-monospace,Menlo,monospace;
    color:#fff;background:rgba(0,0,0,.72);padding:8px 14px;letter-spacing:.02em}
  .cesium-widget-credits{font-size:11px !important}
</style></head><body>
<div id="c"></div><svg id="ov" style="position:absolute;left:0;top:0;width:100%;height:100%;z-index:8;pointer-events:none"></svg><div id="label"></div>
<script src="https://cdn.jsdelivr.net/npm/cesium@1.121.0/Build/Cesium/Cesium.js"></script>
<script>
window.__ready = (async () => {
  Cesium.GoogleMaps.defaultApiKey = ${JSON.stringify(KEY)};
  const viewer = new Cesium.Viewer("c", {
    globe: false, baseLayer: false, baseLayerPicker: false, geocoder: false,
    homeButton: false, sceneModePicker: false, navigationHelpButton: false,
    animation: false, timeline: false, fullscreenButton: false, infoBox: false,
    selectionIndicator: false, skyBox: false, skyAtmosphere: false,
    requestRenderMode: false, contextOptions: { webgl: { preserveDrawingBuffer: true } },
  });
  viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#0b1016");
  viewer.scene.screenSpaceCameraController.enableCollisionDetection = false;
  const tileset = await Cesium.createGooglePhotorealistic3DTileset();
  viewer.scene.primitives.add(tileset);
  window.__viewer = viewer; window.__tileset = tileset;
  return true;
})();

/* Hold until the tile queue has been empty for a few consecutive frames.
   Screenshotting on the first tilesLoaded catches the coarse LOD and quietly
   understates the mesh. */
const settle = () => new Promise(res => {
  const v = window.__viewer, t = window.__tileset;
  let stable = 0, frames = 0;
  const off = v.scene.postRender.addEventListener(() => {
    frames++;
    if (t.tilesLoaded) stable++; else stable = 0;
    if (stable >= 12 || frames > 900) { off(); res(stable >= 12); }
  });
});

/* Move to the building, let the mesh resolve, then drape its campus-3d.json
   footprint on the surface. Magenta because nothing on this campus is magenta —
   the outline can never be mistaken for something in the imagery, and it turns
   "here is a building" into "here is THAT building". */
window.__prepare = async (lat, lng, range, outlines) => {
  const v = window.__viewer;
  v.entities.removeAll();
  v.camera.lookAt(Cesium.Cartesian3.fromDegrees(lng, lat, 0),
    new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-90), range * 1.2));
  await settle();
  const clamp = async pts => {
    const cart = pts.map(([lo, la]) => Cesium.Cartesian3.fromDegrees(lo, la, 0));
    try {
      const r = await v.scene.clampToHeightMostDetailed(cart);
      return r.map((c, i) => c || cart[i]);
    } catch (e) { return cart; }
  };
  const centreH = (await clamp([[lng, lat]]))[0];
  const ground = Cesium.Cartographic.fromCartesian(centreH).height || 0;
  /* Keep the clamped ring in world space and re-project it per frame. Drawing
     it as a Cesium polyline puts it at the mercy of the tileset depth pass;
     projecting to window coordinates is the same statement ring-snapshot.mjs
     makes in Mercator, and it survives every camera angle. */
  window.__rings = [];
  for (const ring of outlines) window.__rings.push(await clamp(ring.concat([ring[0]])));
  return { ground, rings: window.__rings.length };
};

/* Magenta: nothing on this campus is magenta, so the outline can never be read
   as something in the imagery. It marks WHICH footprint the frame is of; it is
   an overlay, so it does not hide behind a nearer building. */
const paint = () => {
  const v = window.__viewer, svg = document.getElementById("ov");
  const parts = (window.__rings || []).map(ring => {
    const pts = [];
    for (const p of ring) {
      const w = Cesium.SceneTransforms.worldToWindowCoordinates(v.scene, p);
      if (!w) return "";
      pts.push(w.x.toFixed(1) + "," + w.y.toFixed(1));
    }
    return '<polygon points="' + pts.join(" ") + '" fill="#ff00ff" fill-opacity="0.05" stroke="#ff00ff" stroke-width="2.5"/>';
  });
  svg.innerHTML = parts.join("");
};

window.__shoot = async (lat, lng, heading, pitch, range, ground, text) => {
  const v = window.__viewer;
  v.camera.lookAt(Cesium.Cartesian3.fromDegrees(lng, lat, ground + 12),
    new Cesium.HeadingPitchRange(Cesium.Math.toRadians(heading), Cesium.Math.toRadians(pitch), range));
  /* Which side the camera actually ended up on, measured from its own position
     rather than assumed from Cesium's heading convention — an orbit labelled by
     convention is one sign flip away from captioning every facade backwards. */
  const cam = Cesium.Cartographic.fromCartesian(v.camera.positionWC);
  const dLat = Cesium.Math.toDegrees(cam.latitude) - lat;
  const dLng = (Cesium.Math.toDegrees(cam.longitude) - lng) * Math.cos(Cesium.Math.toRadians(lat));
  const bearing = (Math.atan2(dLng, dLat) * 180 / Math.PI + 360) % 360;
  const side = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"][
    Math.round(bearing / 45) % 8];
  document.getElementById("label").textContent =
    pitch === -90 ? text : text.replace("{side}", side).replace("{alt}", (cam.height - ground).toFixed(0));
  const settled = await settle();
  let paintError = null;
  try { paint(); } catch (e) { paintError = String(e); }
  return { settled, paintError, side, bearing: Math.round(bearing), camAlt: cam.height - ground };
};
</script></body></html>`;

const htmlPath = path.join(OUTDIR, "_orbit.html");
writeFileSync(htmlPath, page);

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const ctx = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 2 });
const tab = await ctx.newPage();
const errors = [];
tab.on("pageerror", e => errors.push(String(e)));
tab.on("console", m => { if (m.type() === "error") errors.push(m.text()); });

await tab.goto("file://" + htmlPath);
await tab.waitForFunction("window.__ready !== undefined", null, { timeout: 60000 });
await tab.evaluate("window.__ready");

const manifest = [];
for (const t of targets) {
  /* --range is a floor, not a fixed value: a 200 m block photographed at the
     same range as a 40 m wing comes out as a neighbourhood shot. */
  const base = Math.max(RANGE, t.radius * 2.6);
  const shots = [];
  for (const pitch of PITCHES) {
    for (let i = 0; i < HEADINGS; i++) {
      const heading = Math.round((360 / HEADINGS) * i);
      shots.push({ heading, pitch, range: Math.round(base * (pitch >= -15 ? 0.85 : 1)) });
    }
  }
  if (NADIR) shots.push({ heading: 0, pitch: -90, range: Math.round(base * 1.15) });

  const prep = await tab.evaluate(
    ([lat, lng, range, outlines]) => window.__prepare(lat, lng, range, outlines),
    [t.lat, t.lng, base, t.outlines]);
  console.log(`${t.name}: ground ${prep.ground.toFixed(1)} m, range ${Math.round(base)} m, ${shots.length} frames`);

  for (const s of shots) {
    const tag = s.pitch === -90 ? "nadir" : `h${String(s.heading).padStart(3, "0")}-p${Math.abs(s.pitch)}`;
    const text = s.pitch === -90
      ? `${t.name} — top-down · Google Photorealistic 3D Tiles`
      : `${t.name} — seen from the {side}  ·  camera {alt} m above grade, ${Math.round(s.range)} m out, pitch ${s.pitch}°  ·  Google Photorealistic 3D Tiles`;
    const r = await tab.evaluate(
      ([lat, lng, heading, pitch, range, ground, label]) => window.__shoot(lat, lng, heading, pitch, range, ground, label),
      [t.lat, t.lng, s.heading, s.pitch, s.range, prep.ground, text]);
    const file = path.join(OUTDIR, `${t.name.toLowerCase()}-${tag}${s.pitch === -90 ? "" : "-" + r.side}.png`);
    await tab.screenshot({ path: file });
    manifest.push({ name: t.name, ...s, side: r.side, bearing: r.bearing, camAlt: r.camAlt,
      file: path.relative(ROOT, file), settled: r.settled, ground: prep.ground });
    console.log(`${path.relative(ROOT, file)}  ${JSON.stringify(r)}`);
  }
}

writeFileSync(path.join(OUTDIR, "manifest.json"),
  JSON.stringify({ targets: targets.map(({ outlines, ...t }) => t), manifest }, null, 2));
writeSheet(targets, manifest);
await browser.close();
if (errors.length) console.error("page errors:\n" + [...new Set(errors)].slice(0, 10).join("\n"));
console.log(`\n${manifest.length} frames -> ${path.relative(ROOT, OUTDIR)}`);
