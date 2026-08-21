// The CAPTURE half of the visual audit harness. It flies free roam around a
// named building in a real browser and photographs it from every side.
// scripts/visual-audit-critic.mjs is the other half: it briefs a critic on one
// capture directory and collates the verdicts into a PASS/FAIL report.
//
// WHY THIS EXISTS. `npm test` and `npm run check` gate the geometry against the
// sources. Nothing gates what the thing LOOKS like, and every appearance fault
// found on this campus so far was found by a human staring at one lucky angle.
// Eight sides plus a roof, from a repeatable distance, is the difference
// between "I looked at it" and "it was looked at".
//
// WHAT IT DOES NOT DO, stated here rather than discovered by someone trusting a
// clean run:
//
//   - It judges nothing. A green exit means seventeen files landed, not that
//     the building is right. The images are the deliverable.
//   - The framing is derived from the MASSING, so a building whose detail is
//     built elsewhere (photo detail, athletics, Eighth) is framed by its
//     underlying mass. That is usually what you want and is occasionally too
//     tight; the manifest records every camera so a reframe is a re-run with
//     different numbers, not a re-derivation.
//   - Colour and tone under SwiftShader are not the colour and tone of a real
//     GPU. ACES tone mapping, GTAO and bloom all run, but a critic should judge
//     form, proportion, facade character and detail placement — not hue.
//   - A name that resolves to no mass is a FAILURE, not an empty capture. A
//     directory of correctly-rendered pictures of nothing is the worst possible
//     output here.
//
// Run: node scripts/visual-audit.mjs "Galbraith Hall" [more names...] \
//        [--out DIR] [--stamp 2026-08-17] [--mode campus] [--labels] [--headed]
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const { chromium } = createRequire(path.join(ROOT, "package.json"))("playwright-core");

/* ------------------------------------------------------------------- args */

const argv = process.argv.slice(2);
const names = [];
let outDir = null, stamp = "unstamped", mode = "campus", headed = false;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--out") outDir = argv[++i];
  else if (a === "--stamp") stamp = argv[++i];
  else if (a === "--mode") mode = argv[++i];
  else if (a === "--headed" || a === "--labels") { if (a === "--headed") headed = true; }
  else if (a.startsWith("--")) die(`unknown flag ${a}`);
  else names.push(a);
}
if (!names.length) die(`usage: node scripts/visual-audit.mjs "Building Name" [...] [--out DIR] [--stamp DATE]`);
outDir = path.resolve(outDir || path.join(ROOT, "audit"));

function die(msg) { console.error(`visual-audit: ${msg}`); process.exit(2); }

/* ---------------------------------------------------------------- framing */

/* The camera is PerspectiveCamera(68, ...) — 68 degrees VERTICAL. At 16:9 the
   horizontal half-angle is ~50 degrees against 34 vertical, so the vertical
   axis is what a building has to fit inside and every distance below is solved
   against 34. */
const HALF_V = (34 * Math.PI) / 180;
const HIGH_ELEV = (35 * Math.PI) / 180;
/* Azimuth is the COMPASS BEARING OF THE CAMERA from the building: az000 stands
   to the north and looks south at the north face. This campus's frame has north
   at DECREASING z (Galbraith's plaza/north elevation is its low-z face at
   z=428.9, the lawn is at z=491), so the camera's z offset is MINUS cos — the
   first version used plus and labelled every frame with the opposite compass
   point, which a critic caught by checking the entry canopy against the face
   the research file calls north. East is +x. */
const AZIMUTHS = [0, 45, 90, 135, 180, 225, 270, 315];
const LOW_EYE_M = 2;
const VIEW = { width: 1920, height: 1080 };

/* Where to stand for the two rings and the roof. `b` is the resolved building:
   centroid, plan radius (centroid to furthest footprint vertex), ground and
   roof heights in world metres. */
function planShots(b) {
  const H = Math.max(3, b.topY - b.groundY);
  const shots = [];

  /* THE WHOLE BUILDING, from 35 degrees up. Framed against the bounding
     SPHERE rather than the plan radius: a tower framed on its plan alone is
     photographed with its top cut off, which is exactly the fault an audit is
     supposed to see. 1.12 is margin — a building that touches the frame edge
     reads as cropped even when it is not, and one framed loosely enough to be
     safe is a photograph of the campus with the subject somewhere in it. */
  const sphere = Math.hypot(b.radius, H / 2);
  const D = Math.max(30, (1.12 * sphere) / Math.sin(HALF_V));
  const midY = b.groundY + H / 2;
  for (const az of AZIMUTHS) {
    const a = (az * Math.PI) / 180;
    shots.push({
      kind: "high", az, selfRadius: b.radius * 1.05,
      cam: {
        x: b.cx + Math.sin(a) * D * Math.cos(HIGH_ELEV),
        z: b.cz - Math.cos(a) * D * Math.cos(HIGH_ELEV),
        y: midY + D * Math.sin(HIGH_ELEV),
      },
      target: { x: b.cx, y: midY, z: b.cz },
    });
  }

  /* NEAR EYE LEVEL, at the distance a person would actually stand at: clear of
     the footprint, then far enough back that the facade fits. Deliberately not
     solved to fill the frame edge-to-edge — a facade shot that fills the frame
     shows no context, and half the faults worth catching (a wall that stops
     short of the ground, a roofline that does not meet its neighbour) live at
     the edges. */
  const d = b.radius + Math.max(14, H * 0.95);
  for (const az of AZIMUTHS) {
    const a = (az * Math.PI) / 180;
    shots.push({
      kind: "low", az, selfRadius: b.radius * 1.05,
      cam: { x: b.cx + Math.sin(a) * d, z: b.cz - Math.cos(a) * d, y: b.groundY + LOW_EYE_M },
      target: { x: b.cx, y: b.groundY + H * 0.45, z: b.cz },
    });
  }

  /* Straight down. Height solved off the plan radius alone — from overhead the
     building's height is depth, not extent. */
  const up = Math.max(45, (1.3 * b.radius) / Math.sin(HALF_V));
  shots.push({
    kind: "roof", az: null, selfRadius: b.radius * 1.05,
    cam: { x: b.cx, z: b.cz, y: b.topY + up },
    target: { x: b.cx, y: b.topY, z: b.cz },
  });
  return shots;
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "building";

/* -------------------------------------------------------------- in-page */

/* One rAF counter, because every wait here is denominated in FRAMES. Under
   SwiftShader this scene renders at 1-2 fps, so a wall-clock "wait 500 ms for
   the camera to settle" screenshots the frame BEFORE the move — a black or
   stale picture that looks like a rendering fault and is not one. */
function installFrameCounter() {
  let n = 0;
  const tick = () => { n++; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  window.__auditFrames = () => n;
}

/* Resolve a query to the union of every named mass it matches.
   Exact name first, then substring — so "Keeling" frames Charles David Keeling
   Apartments 1, 2 and 3 together, while "Galbraith Hall" frames only itself. */
function resolveBuilding(query) {
  const mi = window.__campusWalk.massInfo();
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const q = norm(query);
  /* Buildings whose GIS prism is a declared skipGis retirement render only
     through their photo module, so massInfo cannot frame them. Their surveyed
     footprint and measured top are pinned here instead — Urey Hall: GIS mass
     22 bbox, crown 30.45 over rim base y 23.88 (R4, 2026-08-21). */
  const PHOTO_CARRIED = {
    "urey hall": { minX: -51.3, maxX: 28.3, minZ: 229.1, maxZ: 309.5, topY: 54.4 },
    /* Bonner: GIS mass 206 bbox; bar plate repo 35.71 + spine crest ≈ 38.5. */
    "bonner hall": { minX: 51.8, maxX: 95.3, minZ: 164.7, maxZ: 248.2, topY: 38.6 },
  };
  if (PHOTO_CARRIED[q]) {
    const b = PHOTO_CARRIED[q];
    const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    let groundY = Infinity;
    const verts = [[b.minX, b.minZ], [b.maxX, b.minZ], [b.maxX, b.maxZ], [b.minX, b.maxZ]];
    for (const [x, z] of verts) groundY = Math.min(groundY, window.__campusWalk.probe(x, z).ground);
    let radius = 0;
    for (const [x, z] of verts) radius = Math.max(radius, Math.hypot(x - cx, z - cz));
    return { ok: true, names: [query], cx, cz, radius, topY: b.topY, groundY,
      bbox: { minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ } };
  }
  const all = [...mi.keys()];
  let hits = all.filter((n) => norm(n) === q);
  if (!hits.length) hits = all.filter((n) => norm(n).includes(q));
  if (!hits.length) hits = all.filter((n) => q.includes(norm(n)) && norm(n).length > 3);
  if (!hits.length) {
    /* The near misses go back with the failure. A name this campus spells
       differently ("Galbraith Hall" vs "Galbraith") is the common case and
       guessing is worse than saying what was there. */
    const head = q.split(" ")[0];
    return { ok: false, tried: query, near: all.filter((n) => norm(n).includes(head)).slice(0, 12) };
  }
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  let topY = -Infinity, groundY = Infinity;
  const verts = [];
  for (const n of hits) {
    const e = mi.get(n);
    topY = Math.max(topY, e.topY);
    for (const [x, z] of e.ring || []) {
      verts.push([x, z]);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
      groundY = Math.min(groundY, window.__campusWalk.probe(x, z).ground);
    }
  }
  if (!verts.length) return { ok: false, tried: query, near: hits };
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  let radius = 0;
  for (const [x, z] of verts) radius = Math.max(radius, Math.hypot(x - cx, z - cz));
  return { ok: true, names: hits, cx, cz, radius, topY, groundY, bbox: { minX, maxX, minZ, maxZ } };
}

/* Point the camera. `fly` takes HOVER — height over the local ground — so the
   absolute height a shot asks for has to be resolved against the ground under
   the CAMERA, not under the building, and free roam clamps hover at eye height
   besides. The pose is therefore recomputed from where the camera actually
   ended up and returned, so the manifest records what was photographed rather
   than what was requested. */
function aimCamera(shot) {
  const w = window.__campusWalk;

  /* STAND SOMEWHERE THERE IS NOT ALREADY A BUILDING.
   *
   * The rings are placed at a fixed radius from the subject's centroid, and on
   * a dense campus that lands the eye-level camera INSIDE a neighbour often
   * enough to matter — the first run put the Keeling south shot two metres from
   * the wall of the building behind it and photographed a flat grey plane. That
   * frame is the exact thing a critic is looking for ("blank face"), so a
   * silent obstruction does not merely waste a shot, it MANUFACTURES the
   * finding the audit exists to detect.
   *
   * `probe().roof` is the solid sampler: a roof above local ground means there
   * is a mass at that x/z, and a camera below that roof is inside it. Back
   * straight out along the view axis until the eye is in open air, and record
   * how far it had to go. If nothing clears, the shot is marked obstructed and
   * the critic is told to disregard it rather than score it. */
  const dirX = shot.cam.x - shot.target.x, dirZ = shot.cam.z - shot.target.z;
  const dirLen = Math.hypot(dirX, dirZ) || 1;
  const ux = dirX / dirLen, uz = dirZ / dirLen;
  const inside = (x, z, y) => { const p = w.probe(x, z); return p.roof > p.ground + 0.5 && y < p.roof + 0.5; };

  /* Standing in clear air is NOT the same as being able to see the subject, and
     the first version of this guard confused the two. It only asked whether the
     camera POINT was inside a mass, so a camera two metres in front of a
     neighbour's wall passed — and three of Keeling's eight eye-level frames came
     back as pictures of somebody else's facade with Keeling nowhere in shot.
     March the actual sight line and ask whether anything stands in it. */
  const blocked = (cx, cz, cy) => {
    const dx = shot.target.x - cx, dz = shot.target.z - cz;
    const span = Math.hypot(dx, dz);
    if (span < 0.01) return false;
    const steps = Math.max(2, Math.ceil(span / 3));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const px = cx + dx * t, pz = cz + dz * t;
      const p = w.probe(px, pz);
      if (p.roof <= p.ground + 0.5) continue;          // nothing standing here
      const rayY = cy + (shot.target.y - cy) * t;
      /* The subject itself is allowed to occlude its own far side. Anything
         within its own footprint radius of the target is the building being
         photographed, not an obstruction. */
      if (Math.hypot(px - shot.target.x, pz - shot.target.z) < shot.selfRadius) continue;
      if (rayY < p.roof) return true;
    }
    return false;
  };

  let x = shot.cam.x, z = shot.cam.z, backedOff = 0, lifted = 0, obstructed = false;
  if (dirLen > 0.01) {
    /* First get the eye out of any solid it is buried in. */
    while (inside(x, z, w.probe(x, z).ground + Math.max(1.65, shot.cam.y - w.probe(x, z).ground))) {
      if (backedOff >= 120) { obstructed = true; break; }
      backedOff += 6;
      x = shot.cam.x + ux * backedOff;
      z = shot.cam.z + uz * backedOff;
    }
    /* Then lift it until it can see over whatever is in the way. Lifting rather
       than backing further off, because on a dense campus backing away from one
       neighbour usually puts another one behind it, and a shot from six metres
       up still shows the facade this audit is about. A shot that cannot clear
       is declared, never quietly kept. */
    while (!obstructed && blocked(x, z, w.probe(x, z).ground + Math.max(1.65, shot.cam.y + lifted - w.probe(x, z).ground))) {
      if (lifted >= 40) { obstructed = true; break; }
      lifted += 4;
    }
  }

  const g = w.probe(x, z).ground;
  const hover = Math.max(1.65, shot.cam.y + lifted - g);
  const y = g + hover;
  const dx = shot.target.x - x, dz = shot.target.z - z;
  const flat = Math.hypot(dx, dz);
  const yaw = flat < 0.01 ? 0 : Math.atan2(dx, dz);
  const pitch = flat < 0.01 ? -Math.PI / 2 : Math.atan2(shot.target.y - y, flat);
  w.fly(x, z, hover, yaw, pitch);
  return { x, y, z, yaw, pitch, hover, groundUnderCamera: g, backedOff, lifted, obstructed };
}

/* ----------------------------------------------------------------- server */

const PORT = 5170;
const listening = await new Promise((r) => {
  const s = net.connect(PORT, "127.0.0.1");
  s.on("connect", () => { s.destroy(); r(true); });
  s.on("error", () => r(false));
});
let child = null;
if (listening) console.log(`using the server already on :${PORT}`);
else {
  console.log(`starting scripts/serve.mjs on :${PORT}`);
  child = spawn(process.execPath, [path.join(ROOT, "scripts/serve.mjs")], { stdio: "ignore" });
  for (let i = 0; i < 60; i++) {
    const up = await new Promise((r) => {
      const s = net.connect(PORT, "127.0.0.1");
      s.on("connect", () => { s.destroy(); r(true); });
      s.on("error", () => r(false));
    });
    if (up) break;
    await new Promise((r) => setTimeout(r, 250));
  }
}
const stopServer = () => { if (child && !child.killed) child.kill(); };
process.on("exit", stopServer);

/* -------------------------------------------------------------- the run */

const browser = await chromium.launch({
  headless: !headed,
  /* Headless: the same flags as verify-ride.mjs. Without them headless chromium
     refuses WebGL2 and the page boots into its error card, which photographs as
     a perfectly sharp picture of a failure message.

     Headed: use the REAL GPU. swiftshader is a software rasteriser, and once
     Zone 2 landed it could no longer finish a 1920x1080 frame inside
     page.screenshot's 30 s limit — every capture died on a timeout that looked
     like a scene fault and was not one. Measured on the same frame: 4019 ms
     under swiftshader against 28 ms on Metal. Passing --headed now means what
     it says, which is "show me what the machine actually draws". */
  args: headed
    ? ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"]
    : ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: VIEW });
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));

const failures = [];
try {
  await page.goto(`http://127.0.0.1:${PORT}/?mode=${mode}`, { waitUntil: "load" });
  await page.waitForFunction(() => !!(window.__campusWalk?.massInfo && window.campusWalk), null, { timeout: 300_000 });
  /* The streaming layer builds the photo zone and region AFTER the first
     frame (one module per frame-gap — slow under SwiftShader). Photographing
     before it finishes would judge a world with the photo detail missing. */
  await page.waitForFunction(() => window.__campusWalk.streamed === true, null, { timeout: 300_000 });
  await page.evaluate(installFrameCounter);

  /* The HUD is not the subject. Hidden at capture time from the harness rather
     than from the page, so nothing shipped changes and a --headed run of this
     script still shows the same world a visitor sees. */
  await page.evaluate((keepLabels) => {
    for (const el of document.body.children) if (el.id !== "walk-canvas") el.style.display = "none";
    /* The in-world name tags too, unless asked for. They are drawn at the roof
       of every mass in range, so on a close facade shot they sit ACROSS the
       thing being judged — and the file name already says which building this
       is. Through the layers seam the dev panel already owns, so nothing
       shipped changes. */
    if (!keepLabels && window.campusWalk?.layers?.labels) window.campusWalk.layers.labels.visible = false;
    /* Pin full quality: the adaptive controller (campus-quality.js) reads
       SwiftShader's 1-2 fps as a machine in trouble and would walk the
       ladder to the floor — and then these screenshots would judge the
       degraded tier instead of the product. */
    window.__campusWalk?.quality?.lock(0);
    /* Sweep tiers every frame here: the audit settles by counting FRAMES
       (SwiftShader runs ~1 fps), and the default 6-frame stride would let a
       screenshot capture the previous station's visibility state. */
    if (window.__campusWalk?.chunks) window.__campusWalk.chunks.config.stride = 1;
  }, argv.includes("--labels"));
  await waitFrames(8);

  for (const query of names) {
    const b = await page.evaluate(resolveBuilding, query);
    if (!b.ok) {
      failures.push(`"${query}" matched no named mass${b.near?.length ? ` (near: ${b.near.join(", ")})` : ""}`);
      console.error(`FAIL  ${query}: no mass`);
      continue;
    }
    const dir = path.join(outDir, slug(query));
    await mkdir(dir, { recursive: true });
    const H = b.topY - b.groundY;
    console.log(`\n${query} -> ${b.names.join(" + ")}`);
    console.log(`  centre (${b.cx.toFixed(1)}, ${b.cz.toFixed(1)})  plan radius ${b.radius.toFixed(1)} m  ground ${b.groundY.toFixed(1)} m  roof ${b.topY.toFixed(1)} m  height ${H.toFixed(1)} m`);

    const shots = planShots(b);
    const manifest = { query, stamp, mode, matched: b.names, building: b, viewport: VIEW, fovDeg: 68, shots: [] };
    for (const shot of shots) {
      const file = shot.kind === "roof" ? "roof.png" : `az${String(shot.az).padStart(3, "0")}-${shot.kind}.png`;
      const pose = await page.evaluate(aimCamera, shot);
      /* Four frames, not one. The first frame after a move is rendered from the
         pose the site had when the request landed; postfx (GTAO, bloom) is a
         further pass on top. At 1-2 fps this is the whole cost of the run and
         it is the difference between an audit and a slideshow of stale
         frames. */
      await waitFrames(4);
      await page.screenshot({ path: path.join(dir, file) });
      manifest.shots.push({ file, kind: shot.kind, azimuthDeg: shot.az, camera: pose, target: shot.target });
      const note = pose.obstructed ? "  OBSTRUCTED — no clear view of the subject, do not judge this frame"
        : [pose.backedOff ? `backed off ${pose.backedOff} m` : null, pose.lifted ? `lifted ${pose.lifted} m` : null]
            .filter(Boolean).join(" and ");
      console.log(`  ${file}  cam (${pose.x.toFixed(1)}, ${pose.y.toFixed(1)}, ${pose.z.toFixed(1)})  pitch ${(pose.pitch * 180 / Math.PI).toFixed(0)}deg${note ? `  ${note} to clear a neighbour` : ""}`);
    }
    await writeFile(path.join(dir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`  ${shots.length} images + manifest.json -> ${dir}`);
  }
} catch (e) {
  failures.push(`capture threw: ${e.message}`);
} finally {
  await browser.close();
  stopServer();
}

async function waitFrames(n) {
  const at = await page.evaluate(() => window.__auditFrames());
  await page.waitForFunction((want) => window.__auditFrames() >= want, at + n, { timeout: 180_000, polling: "raf" });
}

if (pageErrors.length) {
  console.log(`\npage errors during capture: ${pageErrors.length}`);
  for (const e of pageErrors.slice(0, 5)) console.log(`  ${e}`);
}
if (failures.length) {
  console.error(`\nFAIL: ${failures.length}`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`\nPASS: captured ${names.length} building(s) into ${outDir}`);
