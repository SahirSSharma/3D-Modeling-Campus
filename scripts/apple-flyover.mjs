/* Orbit a named building in Apple Maps 3D and photograph it.
 *
 * WHY THIS EXISTS
 * Apple's imagery of this campus is current — its nadir snapshots show Eighth
 * College landscaped and in use, where Google's 3D mesh still shows graded dirt
 * and construction staging around the same buildings. But the Snapshot API is
 * orthographic by contract (center/z/size/scale/t/poi and nothing else), so the
 * current source cannot show a facade and the source that can show a facade is
 * two or three years stale. The only place Apple's oblique 3D exists is inside
 * Maps.app.
 *
 * So this drives Maps.app: navigate by URL, tilt and rotate with synthesised
 * mouse gestures (scripts/mapctl.swift), and screenshot the window. It is
 * screen capture rather than an API, and it is the only route to a current
 * Apple facade.
 *
 * WHAT MAKES A FRAME TRUSTWORTHY
 * Two things are measured rather than assumed. The heading is read back off the
 * compass needle in each frame, so a caption states where the camera actually
 * was, not where a drag was supposed to put it — a rotate gesture is a physical
 * drag whose response varies with zoom and inertia, and open-loop step counting
 * drifts within a single orbit. And the frame is captured by window id with the
 * window's position re-read before every gesture, because Maps moves and
 * resizes its window on navigation — a rectangle read once and reused sends
 * drags onto the desktop and screenshots whatever app is behind.
 *
 * The building is identified by centring: Maps looks at the coordinate it was
 * given, so the target is the thing in the middle of the frame.
 *
 *   node scripts/apple-flyover.mjs --name Sankofa,Pulse [--steps 12]
 *        [--tilt 260] [--span 0.0022] [--outdir .cache/apple-flyover]
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const argv = process.argv.slice(2);
const argOf = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };

const NAMES = String(argOf("--name", "")).split(",").map(s => s.trim()).filter(Boolean);
const STEPS = Number(argOf("--steps", 12));
/* An area sweep wants a steeper opening angle than a building orbit: the first
   pass is there to see into the spaces, not along them. Explicit flags win. */
const TILT = Number(argOf("--tilt", argv.includes("--area") ? 110 : 260));  // px of option-drag; more = lower camera
const ZOOM = Number(argOf("--zoom", 0));       // extra "Zoom In" menu steps after centring
const SPAN = argOf("--span", argv.includes("--area") ? "0.0007" : "0.0011");  // degrees framed (~78 m / ~120 m)
const CLOSE = Number(argOf("--closeups", 2));  // extra zoom steps for a second, tighter orbit
const AREA = argv.includes("--area");          // sweep the whole block, not five centroids
const GRID = Number(argOf("--grid", 5));       // stations per side
const MARGIN = Number(argOf("--margin", 45));  // metres of context beyond the footprints
const ONLY = String(argOf("--passes", "")).split(",").map(s => s.trim()).filter(Boolean);
const SHEET_ONLY = argv.includes("--sheet-only");  // rebuild the gallery from manifest.json
const ROT_PX = Number(argOf("--rot", 170));    // px of command-drag per orbit step
const OUTDIR = path.resolve(ROOT, argOf("--outdir", ".cache/apple-flyover"));
const MAPCTL = path.join(ROOT, ".cache/mapctl");

const sh = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8" }).trim();
const osa = script => sh("osascript", ["-e", script]);
const ctl = (...a) => sh(MAPCTL, a.map(String));
const wait = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/* ---- where the map window is, in points ---- */
/* Ask the window server, every single time. Maps opens new windows at the
   system's default placement and resizes on navigation; a rectangle read once
   and reused sends drags onto the desktop and screenshots the apps behind. */
/* Quitting Maps is the stop button. This script takes over the screen for
   minutes at a time, so the person sitting in front of it needs a way to end a
   run that does not require finding the terminal — and closing the window they
   are watching is the obvious one. Never relaunch: coming back after being shut
   down turns a deliberate stop into a fight. */
function mapWindow() {
  try {
    const [id, x, y, w, h] = ctl("window", "Maps").split(/\s+/).map(Number);
    if (w > 400 && h > 400) return { id, x, y, w, h };
  } catch { /* mapctl exits non-zero when Maps has no on-screen window */ }
  console.log("\nMaps was quit — stopping here, as instructed. Frames already written are kept.");
  writeSheetSoFar();
  process.exit(0);
}

/* The compass is a dark disc carrying an "N" and a small red tick at its rim;
   the tick points true north, and its angle around the disc centre is the map's
   rotation. The disc is anchored to the window's bottom-right control stack, so
   these insets are only meaningful for a window forced to WIN_W x WIN_H — which
   is why setWindow() runs before any capture and why calibrate() refuses to
   proceed if a known-north view does not read as north. */
const WIN_W = 1400, WIN_H = 900;
const COMPASS_INSET_X = 25.5, COMPASS_INSET_Y = 354, COMPASS_R = 24;

async function readHeading(pngPath, win, scale = 2) {
  const cx = (win.w - COMPASS_INSET_X) * scale, cy = COMPASS_INSET_Y * scale, r = COMPASS_R * scale;
  const box = { left: Math.round(cx - r), top: Math.round(cy - r), width: r * 2, height: r * 2 };
  const { data, info } = await sharp(pngPath).extract(box).raw().toBuffer({ resolveWithObject: true });
  let sx = 0, sy = 0, n = 0;
  for (let i = 0; i < info.width * info.height; i++) {
    const R = data[i * info.channels], G = data[i * info.channels + 1], B = data[i * info.channels + 2];
    /* The needle is the only saturated red in the button; the rest is grey. */
    if (R > 120 && R - G > 55 && R - B > 55) {
      const px = i % info.width, py = Math.floor(i / info.width);
      sx += px - info.width / 2; sy += py - info.height / 2; n++;
    }
  }
  if (n < 12) return null;
  /* Screen y grows downward, so -sy is "up" = the direction north is drawn in.
     Clockwise-from-up of that vector is how far the map is rotated; the camera
     therefore looks along the negative of it. */
  const northOnScreen = (Math.atan2(sx / n, -(sy / n)) * 180 / Math.PI + 360) % 360;
  const look = (360 - northOnScreen) % 360;
  return { look, side: (look + 180) % 360, pixels: n };
}

const COMPASS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
const word = deg => COMPASS[Math.round(deg / 45) % 8];

/* ---- targets ---- */
const campus = JSON.parse(readFileSync(path.join(ROOT, "docs/data/campus-3d.json"), "utf8"));
const { lat: LAT0, lng: LNG0, mPerDegLat, mPerDegLng } = campus.origin;
const toLatLng = (x, z) => ({ lat: LAT0 - z / mPerDegLat, lng: LNG0 + x / mPerDegLng });

/* Area sweep: the interesting half of this neighbourhood is not the buildings,
   it is what sits between them — the court, the stepped terraces, the stairs
   and the walkways. Orbiting five centroids photographs five objects and skips
   the spaces; a grid over the whole block photographs the block. Each station
   gets a steep pass, which looks down into courtyards and reads ground surface,
   and an oblique pass, which reads the facades enclosing them. */
function areaTargets() {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const b of campus.buildings) {
    if (!b.n || !NAMES.some(n => n.toLowerCase() === b.n.toLowerCase())) continue;
    for (const [x, z] of b.p) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
    }
  }
  if (!Number.isFinite(x0)) throw new Error("no footprints matched --name for the area sweep");
  x0 -= MARGIN; x1 += MARGIN; z0 -= MARGIN; z1 += MARGIN;
  const out = [];
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const x = x0 + (x1 - x0) * (GRID === 1 ? 0.5 : c / (GRID - 1));
      const z = z0 + (z1 - z0) * (GRID === 1 ? 0.5 : r / (GRID - 1));
      const ll = toLatLng(x, z);
      out.push({ name: `r${r}c${c}`, lat: ll.lat, lng: ll.lng, h: 0 });
    }
  }
  console.log(`area sweep: ${(x1 - x0).toFixed(0)} x ${(z1 - z0).toFixed(0)} m, ` +
    `${GRID}x${GRID} stations ~${((x1 - x0) / (GRID - 1)).toFixed(0)} m apart`);
  return out;
}

const targets = AREA ? areaTargets() : NAMES.map(name => {
  const hits = campus.buildings.filter(b => b.n && b.n.toLowerCase() === name.toLowerCase());
  if (!hits.length) throw new Error(`no building named ${name} in campus-3d.json`);
  let sx = 0, sz = 0, n = 0, h = 0;
  for (const b of hits) { for (const [x, z] of b.p) { sx += x; sz += z; n++; } h = Math.max(h, b.h ?? 0); }
  const c = toLatLng(sx / n, sz / n);
  return { name, lat: c.lat, lng: c.lng, h };
});

mkdirSync(OUTDIR, { recursive: true });

/* ---- drive the app ---- */
function focusMaps() {
  osa(`tell application "Maps" to activate`);
  wait(700);
}

function menuItem(name) {
  try {
    osa(`tell application "System Events" to tell process "Maps" to click menu item "${name}" of menu 1 of menu bar item "View" of menu bar 1`);
    wait(500);
    return true;
  } catch { return false; }
}

function setWindow() {
  osa(`tell application "System Events" to tell process "Maps" to tell window 1
    set position to {0, 33}
    set size to {${WIN_W}, ${WIN_H}}
  end tell`);
  wait(600);
}

function goTo(t, span = SPAN) {
  /* ll= alone. Adding q= drops a labelled pin, which is tempting as an identity
     marker but opens a place card over a quarter of the window and plants a
     balloon on top of the very building being photographed. The camera looks at
     the centred coordinate, so the target is the thing in the middle of frame. */
  /* spn, not z: Apple honours an explicit span, so the framing is the same
     every run instead of whatever zoom the app last happened to be at. */
  sh("open", [`maps://?ll=${t.lat.toFixed(6)},${t.lng.toFixed(6)}&spn=${span},${span}&t=k`]);
  wait(3500);
  focusMaps();
  setWindow();
  menuItem("Hide Sidebar");
  osa(`tell application "System Events" to key code 53`); // Escape: dismiss any card
  wait(400);
  menuItem("Snap to North");
  wait(900);
}

/* Rotate until the compass says so.
 *
 * The gesture is an OPTION-drag, horizontal. Option is Maps' 3D camera
 * modifier: vertical tilts, horizontal rotates. A command-drag pans — which is
 * how an earlier version failed, and failed invisibly: ten "rotate" attempts
 * per frame walked the camera steadily east off the building while the compass
 * never moved and every frame came back labelled 183 degrees.
 *
 * DEG_PER_PX was measured, not assumed (200 px produced -54.5 degrees), but it
 * still only seeds the first correction: the response varies with zoom, so the
 * loop re-measures and closes on the target rather than trusting the constant.
 * Rotation pivots on the view centre, so the building stays framed.
 */
const DEG_PER_PX = 0.27;

async function rotateTo(targetLook, winIn, probe) {
  let win = winIn;
  for (let attempt = 0; attempt < 6; attempt++) {
    win = mapWindow();
    shoot(probe, win);
    const hd = await readHeading(probe, win);
    if (!hd) return null;
    const err = ((targetLook - hd.look + 540) % 360) - 180;   // signed, -180..180
    if (Math.abs(err) <= 5) return hd;
    /* Strictly horizontal: any vertical component in an option-drag tilts, and
       a few stray degrees of pitch per step compound across a full orbit. */
    const cx = win.x + win.w / 2, cy = win.y + win.h / 2;
    const dx = Math.max(25, Math.min(430, Math.abs(err) / DEG_PER_PX)) * (err > 0 ? -1 : 1);
    ctl("drag", cx, cy, cx + dx, cy, "option", 40);
    wait(1300);
  }
  return null;
}

/* By window id, not by rectangle: the frame is then the map window whatever the
   window has done since the last read, and nothing behind it can leak in. */
function shoot(file, win) {
  sh("screencapture", ["-x", "-o", "-l", String(win.id), file]);
}

/* Re-running one pass should not discard the other. Frames from passes this run
   is not touching are carried forward from the previous manifest, so a targeted
   redo of the obliques leaves one gallery rather than two half-galleries. */
const PREV = (() => {
  try { return JSON.parse(readFileSync(path.join(OUTDIR, "manifest.json"), "utf8")).manifest ?? []; }
  catch { return []; }
})();
const manifest = ONLY.length ? PREV.filter(m => !ONLY.includes(m.pass)) : [];

/* Written at the end of a full run and again on an interrupted one, so a sweep
   that was stopped halfway still leaves something reviewable behind. */
function writeSheetSoFar() {
  if (!manifest.length) return;
  writeFileSync(path.join(OUTDIR, "manifest.json"), JSON.stringify({ targets, manifest }, null, 2));
  const sections = targets.map(t => {
    const mine = manifest.filter(m => m.name === t.name);
    if (!mine.length) return "";
    const cards = list => list.map(m => `<figure><a href="${path.basename(m.file)}"><img loading="lazy" src="${path.basename(m.file)}"></a>
      <figcaption>${m.side ? `seen from the ${m.side} · ${m.sideDeg.toFixed(0)}°` : "heading unreadable"}</figcaption></figure>`).join("");
    /* Pass names come from the frames themselves. Hard-coding them meant an
       area sweep — whose passes are "plan" and "oblique", not "orbit" and
       "close" — rendered every heading and not one image. */
    const tags = [...new Set(mine.map(m => m.pass))];
    const blocks = tags.map(tag => {
      const list = mine.filter(m => m.pass === tag).sort((a, b) => (a.sideDeg ?? 0) - (b.sideDeg ?? 0));
      return `<h3>${tag} · ${list.length} frames</h3><div class="grid">${cards(list)}</div>`;
    }).join("");
    return `<section><h2>${t.name}</h2>
      <p class="meta">${t.lat.toFixed(6)}, ${t.lng.toFixed(6)}${t.h ? ` · repo height guess ${t.h} m` : ""} · ${mine.length} frames</p>
      ${blocks}</section>`;
  }).join("");

  writeFileSync(path.join(OUTDIR, "index.html"), `<!doctype html><meta charset="utf-8">
<title>Eighth College — Apple Maps 3D orbit</title>
<style>body{margin:0;padding:32px;background:#0b0d10;color:#e8eaed;font:15px/1.5 -apple-system,system-ui,sans-serif}
h1{font-size:22px;margin:0 0 6px}h2{font-size:18px;margin:38px 0 4px;color:#fff}
h3{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#7d8792;margin:22px 0 8px}
.lede,.meta{color:#9aa3ad;font-size:13px;margin:0 0 10px}.lede{max-width:70ch;margin-bottom:26px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:14px}
figure{margin:0;background:#14181d;border:1px solid #232a31;border-radius:8px;overflow:hidden}
img{width:100%;display:block}figcaption{padding:8px 10px;font-size:12px;color:#9aa3ad}</style>
<h1>Eighth College, from Apple Maps 3D</h1>
<p class="lede">Captured from Maps.app — the only place Apple's oblique 3D exists, since the Snapshot API is top-down by contract. The building is the one centred in frame; the camera looks at the coordinate it was sent to. Each caption's compass word is read back off the compass in that same frame rather than counted from the rotate gestures. Imagery &copy; Apple.</p>
${sections}`);
}

if (SHEET_ONLY) {
  manifest.push(...PREV);
  writeSheetSoFar();
  console.log(`sheet rebuilt from ${PREV.length} frames -> ${path.relative(ROOT, path.join(OUTDIR, "index.html"))}`);
  process.exit(0);
}

focusMaps();

for (const t of targets) {
  goTo(t);
  let win = mapWindow();
  const cx = win.x + win.w / 2, cy = win.y + win.h / 2;

  /* Menu zoom rather than scroll notches: the same repeatable step every run. */
  for (let i = 0; i < ZOOM; i++) { menuItem("Zoom In"); wait(450); }
  /* Tilt from the right-hand third — a drag through the middle grabs the
     building and pans instead. */
  if (TILT) {
    const tx = win.x + win.w * 0.78;
    ctl("drag", tx, cy + TILT / 2, tx, cy - TILT / 2, "option", 45);
    wait(1600);
  }

  /* Calibrate only now: Maps hides the compass while the map is north-up and
     flat, so it does not exist to be read until after the tilt. The view is
     still north-up at this point, which gives the reader a known answer. A miss
     means the disc is not where the insets say, and every heading after this
     would be fiction — so stop rather than caption guesses. */
  win = mapWindow();
  const probe0 = path.join(OUTDIR, "_calib.png");
  shoot(probe0, win);
  const zero = await readHeading(probe0, win);
  if (!zero || Math.min(zero.look, 360 - zero.look) > 8) {
    throw new Error(`compass calibration failed for ${t.name}: a known-north view read as ` +
      `${zero ? zero.look.toFixed(0) + "°" : "unreadable"} (window ${win.w}x${win.h}). ` +
      `Check COMPASS_INSET_* against ${path.relative(ROOT, probe0)}.`);
  }
  console.log(`${t.name}: compass calibrated — north reads ${zero.look.toFixed(1)}°`);

  /* Passes share one arrival. Navigating again between passes would put the
     camera back to wide top-down, which is what made an earlier version look
     like a repeating fly-out instead of an orbit — so the URL is issued once
     per station and everything after it is tilt, rotation and zoom.
     `tilt` is an additional option-drag applied on top of the previous pass,
     because the gesture is relative. */
  const probe = path.join(OUTDIR, `_probe-${t.name.toLowerCase()}.png`);
  const passes = AREA
    ? [{ tag: "plan", zoom: 0, tilt: 0, steps: 2 },        // steep: courts, walkways, stairs
       { tag: "oblique", zoom: 2, tilt: 110, steps: 4, span: "0.00038" }]  // low + close: the facades
    : [{ tag: "orbit", zoom: 0, tilt: 0, steps: STEPS },
       ...(CLOSE ? [{ tag: "close", zoom: CLOSE, tilt: 90, steps: STEPS }] : [])];

  for (const pass of passes) {
    if (ONLY.length && !ONLY.includes(pass.tag)) continue;

    /* Closeness comes from the URL span, not from zoom gestures. Measured on
       one station, all at the same place:
         plan tilt, no zoom .................  75 ft
         + oblique tilt ..................... 150 ft   (tilting doubles it)
         + 4x "Zoom In" ..................... 125 ft   (menu zoom is nearly clamped down here)
         + scroll notches ................... 250 ft, then 375 ft — scroll zooms OUT, both signs
       So a pass that needs to be closer re-arrives with a tighter span, which
       Apple honours exactly, and then tilts. Re-navigating per PASS is safe;
       what caused the fly-out loop earlier was re-navigating mid-orbit. */
    if (pass.span) {
      goTo(t, pass.span);
      win = mapWindow();
      const tx0 = win.x + win.w * 0.78;
      ctl("drag", tx0, win.y + win.h / 2 + TILT / 2, tx0, win.y + win.h / 2 - TILT / 2, "option", 45);
      wait(1600);
    }
    if (pass.tilt) {
      win = mapWindow();
      const tx = win.x + win.w * 0.78;
      ctl("drag", tx, win.y + win.h / 2 + pass.tilt / 2, tx, win.y + win.h / 2 - pass.tilt / 2, "option", 35);
      wait(1400);
    }
    for (let i = 0; i < pass.zoom; i++) { menuItem("Zoom In"); wait(650); }
    for (let i = 0; i < pass.steps; i++) {
      const targetLook = Math.round((360 / pass.steps) * i);
      win = mapWindow();
      const hd = await rotateTo(targetLook, win, probe);
      win = mapWindow();
      const file = path.join(OUTDIR,
        `${t.name.toLowerCase()}-${pass.tag}-${String(i).padStart(2, "0")}${hd ? "-" + word(hd.side) : ""}.png`);
      shoot(file, win);
      const final = await readHeading(file, win);
      manifest.push({ name: t.name, pass: pass.tag, step: i, targetLook, file: path.relative(ROOT, file),
        look: final?.look ?? null, side: final ? word(final.side) : null, sideDeg: final?.side ?? null,
        converged: !!hd });
      console.log(`${path.relative(ROOT, file)}  ${final ? `from the ${word(final.side)} (${final.side.toFixed(0)}°)` : "HEADING UNREADABLE"}${hd ? "" : "  [did not converge]"}`);
    }
  }
}

writeSheetSoFar();
console.log(`\n${manifest.length} frames -> ${path.relative(ROOT, OUTDIR)}`);
