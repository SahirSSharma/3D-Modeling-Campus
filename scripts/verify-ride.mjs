// Drives the scooter run in a real browser and presses real keys, because the
// four things this file gates are all invisible to `npm test` and three of them
// are invisible to a screenshot too.
//
//   1. Fly mode answers a key MORE THAN ONCE. The bug it replaces was not "fly
//      is broken" but "fly works exactly once": a keyup only queued a release,
//      and the queue was drained inside step(), which runs in chase mode only.
//      So the assertion that matters is not that W moves the camera — that
//      passed on the broken build — it is that the camera STOPS when W is let
//      go, and that a later W still does something.
//   2. The scooter sits ON the surface that is drawn, not under it and not
//      floating over it. Two-sided, deliberately.
//   3. No camera cut where the design promises a glide.
//   4. The lane markings belong to the player: absent for the whole opening
//      shot, fully up once control has passed — including the F-during-intro
//      path, which is the one hole a reveal driven from step() would leave.
//
// WHAT THIS CANNOT PROVE, stated here rather than discovered by someone
// trusting a green run:
//
//   - "It looks smooth" and "it drives like a scooter" are not headless
//     questions. Numeric continuity is necessary and nowhere near sufficient;
//     a camera can satisfy every threshold below and still read as wrong. That
//     part of the ask is a human on the live site, full stop.
//   - THE FRAME RATE BOUNDS WHAT (3) CAN SEE, but less than it first appears.
//     SwiftShader renders this scene at roughly 6-10 fps, so one WALL frame is
//     100-170 ms. The site's frame loop clamps dt to 0.05 s, though, so its own
//     clock advances at about 40% of wall time and a 1.1 s glide is ~21 sampled
//     frames rather than three. Every span here is therefore measured by
//     summing the recorded dt, not by timestamp. Measuring by timestamp is not
//     merely noisier — it is self-consistently WRONG: it spans a third of the
//     glide, finds a small distance, and solves the distance-derived duration
//     down to its 0.35 s floor, which is how this file once reported a 128 m
//     descent as "2.1 m over 0.35 s" and then skipped the test for having too
//     few samples.
//     A glide that still resolves to fewer than MIN_GLIDE_SAMPLES frames is
//     skipped with a printed note rather than asserted, because at that width a
//     hard cut and a correct ease are the same measurement; only the analytic
//     peak-speed test, which never false-alarms, still runs. Read a pass on a
//     skipped transition as "not contradicted", not as "verified".
//   - Z-fighting at the contact patch is NOT gated. SwiftShader's depth
//     behaviour does not reliably match a real GPU, so a pass here says
//     nothing about whether the lane paint flickers through the deck. Eyeball
//     it.
//   - Real pointer-capture loss (a look-drag that leaves the canvas) cannot be
//     synthesised through the CDP input queue; that one is verified by reading
//     the code.
//   - Colour and lighting are not asserted anywhere. ACES tone mapping and
//     SwiftShader both move the numbers.
//
// Run: npm run verify:ride -- [--headed]
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* Its own server on an ephemeral port rather than scripts/serve.mjs, which
   starts listening on import and on a fixed port. Same reason verify-boot.mjs
   carries its own. */
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

const browser = await chromium.launch({
  headless: !process.argv.includes("--headed"),
  /* This mode draws shadows, a tone-mapped sky and a few thousand extrusions.
     Headless chromium with no GPU falls back to a software rasteriser that
     refuses WebGL2 outright unless it is told to; without these the page boots
     into the error card and every assertion below fails for the wrong reason. */
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

const failures = [];
const fail = (mode, msg) => { failures.push(`[${mode}] ${msg}`); console.log(`  FAIL  ${msg}`); };
const ok = (msg) => console.log(`  ok    ${msg}`);

/* ------------------------------------------------------- the in-page probe */

/* One row per ANIMATION FRAME, written from inside the page. Polling status()
   from node runs at about 10 Hz over CDP, and every discontinuity this file
   hunts lives inside a single 16 ms frame — a poll would step straight over
   the one sample that proves the cut. The ring is a preallocated Float32Array
   for the same reason the site's own hot paths are: allocating a row per frame
   in the thing measuring frame timing changes the thing being measured. */
const COLS = 10;
const T = 0, DT = 1, CX = 2, CY = 3, CZ = 4, CONTACT = 5, RIDEY = 6, HOVER = 7, SDIST = 8, MODE = 9;
const MODE_NAME = ["intro", "chase", "fly"];

function installProbe() {
  const CAP = 20000;
  const COLS_ = 10;
  const CODE = { intro: 0, chase: 1, fly: 2 };
  const buf = new Float32Array(COLS_ * CAP);
  let w = 0, r = 0, on = false, last = performance.now(), ticks = 0;
  function tick(now) {
    requestAnimationFrame(tick);
    ticks++;
    if (!on) { last = now; return; }
    /* THE SITE'S CLOCK, NOT THE WALL CLOCK. campus-scooter.js's frame loop
       does `Math.min(0.05, ...)`, and under SwiftShader a real frame is
       100-170 ms — so the site's time advances at roughly 40% of wall clock
       and every duration derived from `now` is wrong by that factor. Measuring
       a 1.1 s glide by timestamp spanned a third of it, found a small
       distance, and solved down to the 0.35 s floor: it reported a 100 m
       descent as "2.1 m over 0.35 s". Mirrored here rather than exposed,
       matching how this file already mirrors the glide constants below — if
       that clamp moves, this must move with it. */
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const S = window.__campusScooter;
    const st = window.campusWalk.status();
    const c = S.camera.position;
    const i = (w % CAP) * COLS_;
    buf[i] = now / 1000; buf[i + 1] = dt;
    buf[i + 2] = c.x; buf[i + 3] = c.y; buf[i + 4] = c.z;
    buf[i + 5] = st.contact; buf[i + 6] = st.rideY; buf[i + 7] = st.hover;
    buf[i + 8] = st.ride?.s ?? 0; buf[i + 9] = CODE[S.mode] ?? -1;
    w++;
  }
  requestAnimationFrame(tick);
  window.__rideProbe = {
    /* Counted whether or not the probe is recording, because every wait in
       this harness is denominated in FRAMES rather than milliseconds. */
    frames() { return ticks; },
    start() { on = true; last = performance.now(); },
    stop() { on = false; },
    /* Drained from node every couple of seconds. The ring only overruns if a
       phase runs longer than CAP frames, and the reader says so by moving the
       read cursor rather than silently interleaving old and new rows. */
    drain() {
      if (w - r > CAP) r = w - CAP;
      const out = [];
      for (; r < w; r++) {
        const i = (r % CAP) * COLS_;
        out.push(Array.from(buf.subarray(i, i + COLS_)));
      }
      return out;
    },
  };
}

/* ------------------------------------------------------------ page helpers */

async function open(mode) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(`${base}?mode=${mode}`, { waitUntil: "load" });
  await page.waitForFunction(() => document.body.classList.contains("walk-live"), null, { timeout: 180_000 });
  /* BOTH, and in this order. `walk-live` goes on as the boot promise resolves,
     but index.html assigns window.campusWalk from that promise's value — so a
     harness that waited on __campusScooter alone would race the assignment and
     read campusWalk as undefined on a fast machine and defined on a slow one. */
  await page.waitForFunction(() => !!(window.campusWalk && window.__campusScooter), null, { timeout: 60_000 });
  await page.evaluate(installProbe);
  page.__errors = errors;
  return page;
}

const camAt = (page) => page.evaluate(() => {
  const p = window.__campusScooter.camera.position;
  return { x: p.x, y: p.y, z: p.z };
});
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/* EVERY WAIT IN THIS FILE IS COUNTED IN FRAMES, NOT MILLISECONDS.
 *
 * The site only reads input, moves anything or samples anything inside its
 * rAF loop, so wall-clock waits assume a frame rate this environment does not
 * have. SwiftShader renders the scooter corridor at roughly 10 fps and drops
 * to about 2 fps under load, and the first measured version of this harness
 * duly reported "W does not move the camera" and "E climbs 0.32 m" — both of
 * which were the browser having rendered ONE frame inside a 400 ms hold, not
 * the site ignoring a key. Waiting on the frame counter makes every number
 * below a statement about the site instead of about the host. */
async function waitFrames(page, n, capMs = 120_000) {
  const at = await page.evaluate(() => window.__rideProbe.frames());
  await page.waitForFunction((want) => window.__rideProbe.frames() >= want, at + n, { timeout: capMs, polling: "raf" });
}

/* A press with a real hold. keyboard.press() is down+up inside one CDP round
   trip, which the deferred-release set is explicitly designed to survive as a
   single-frame tap — useful for lane changes, useless for asking whether a
   held key keeps moving the camera.
   The two frames after the keyup are part of the press: the release is
   deferred by one update on purpose, so the drain has not happened yet when
   the key comes up and the camera is still legitimately moving. */
async function hold(page, key, frames = 12) {
  await page.keyboard.down(key);
  await waitFrames(page, frames);
  await page.keyboard.up(key);
  await waitFrames(page, 2);
}

/* --------------------------------------------------- camera discontinuity */

/* Scale-free on purpose. An absolute metres-per-frame threshold is meaningless
   in a mode that legitimately travels at 45 m/s and also legitimately sits
   still: the question is not how far the camera went, it is whether ONE frame
   carried the move. A hard cut puts ~100% of a window's travel in one frame;
   an eased glide sampled at a decent rate peaks near 9%.
   Speeds, not displacements, because a headless frame can run 50 ms next to a
   16 ms neighbour and the long frame would look like a jump on distance alone.

   THE WINDOW HAS TO CONTAIN THE RESPONSE, not just the moment of the change.
   The first version of this scored every 30-frame window overlapping the
   transition, including the one that ENDS on it — twenty-nine frames of a
   parked fly camera plus the first step of the glide. A damped glide's first
   step is its largest by construction, so that window reads 86% for a
   perfectly eased hand-over and about 100% for a hard cut: it cannot tell them
   apart, which is the one thing it is for. Windows are therefore placed with
   the change in their first third, so the tail of whatever the camera does
   next is inside the same window. A cut is still caught — after a cut the
   following frames only carry ordinary chase tracking, so the cut frame keeps
   the lion's share. */
function worstFrameShare(rows, at, win = 30, lead = 9) {
  let worst = null;
  let windows = 0;
  const first = Math.max(1, at - lead);
  for (let s = first; s + win <= rows.length && s <= at; s++) {
    windows++;
    const v = [];
    for (let i = s; i < s + win; i++) {
      const d = Math.hypot(rows[i][CX] - rows[i - 1][CX], rows[i][CY] - rows[i - 1][CY], rows[i][CZ] - rows[i - 1][CZ]);
      v.push({ i, v: rows[i][DT] > 0 ? d / rows[i][DT] : 0, d });
    }
    const total = v.reduce((a, b) => a + b.v, 0);
    const travel = v.reduce((a, b) => a + b.d, 0);
    /* A window in which nothing moved has no share to speak of — 0/0, or one
       frame of float noise reading as 100%. Skipping those cannot hide a cut,
       because a cut is by definition a large displacement. */
    if (travel < 0.25 || total <= 0) continue;
    const top = v.reduce((a, b) => (b.v > a.v ? b : a));
    const share = top.v / total;
    if (!worst || share > worst.share) worst = { share, frame: top.i, metres: top.d, travel };
  }
  /* No window at all means the recording stopped too soon after the change —
     a missing measurement, which must never read as a pass. */
  return windows ? worst : "unsampled";
}

function modeChanges(rows) {
  const out = [];
  for (let i = 1; i < rows.length; i++) if (rows[i][MODE] !== rows[i - 1][MODE]) out.push(i);
  return out;
}

const SHARE_LIMIT = 0.25;

/* campus-scooter.js's own glide constants, mirrored so the peak speed below is
   derived rather than guessed: beginCamGlide sets
   blendDur = clamp(distanceToTarget / 70, 0.35, 1.1). If those move, these
   must move with them — this file is reading the site's arithmetic, not
   inventing its own. */
const CAM_GLIDE_MPS = 70;
const CAM_GLIDE_MIN_S = 0.35;
const CAM_GLIDE_MAX_S = 1.1;
/* Below this many samples inside the glide, the share-of-window test is
   measuring the sample rate rather than the camera. See scoreTransition. */
const MIN_GLIDE_SAMPLES = 5;

/* Score one mode change.
 *
 * TWO TESTS, BECAUSE ONE OF THEM CANNOT ALWAYS RUN.
 *
 * (a) ANALYTIC PEAK SPEED, always. The glide is an easeInOut from a frozen
 *     source to the live chase pose, so covering d in T peaks at 2d/T by
 *     construction. The site chooses T from d itself, which is why the span is
 *     solved against the same clamp the site uses rather than assumed. A
 *     genuine cut delivers d in one frame — at any T this reads as a multiple
 *     of the analytic peak, so 3x is a wide margin that still catches it. Wide
 *     on purpose: this test must never cry wolf, because it is the only one
 *     that runs everywhere.
 *
 * (b) SHARE OF WINDOW, only when the glide is actually resolved. Headless
 *     SwiftShader renders this scene at roughly 6-10 fps, so a frame is
 *     100-170 ms and the SHORT glide — fly -> chase, usually 10-25 m, so the
 *     0.35 s floor — is two or three samples. Half its distance then lands in
 *     one sample BY CONSTRUCTION, and a real cut and a real ease are literally
 *     the same measurement. Asserting 25% there would be asserting something
 *     the sampling cannot see, so it is SKIPPED and SAID to be skipped. A
 *     silent pass on an unresolvable check is worse than no check.
 *
 * intro -> chase is the one that must not be skipped: it is the long glide
 * (the skip path can start 90 m up, so T pins to 1.1 s and resolves even at
 * 6 fps), and it is the transition that was actually broken — endIntro used to
 * hard-copy the chase pose in while the camera was still overhead. If that one
 * ever fails to resolve, this reports a failure rather than a skip. */
function scoreTransition(mode, rows, i, from, to, strict) {
  const pos = (j) => ({ x: rows[j][CX], y: rows[j][CY], z: rows[j][CZ] });
  /* The source pose is frozen in the key handler, i.e. at the last frame that
     still ran the old mode. */
  const t0 = rows[i - 1][T];
  const p0 = pos(i - 1);

  /* MEASURE IN THE SITE'S CLOCK, NOT THE WALL CLOCK.
   *
   * campus-scooter.js's frame loop clamps dt to 0.05 s. Under SwiftShader a
   * frame really takes 100-170 ms, so the site's own time advances at roughly
   * 40% of wall clock and a 1.1 s glide occupies nearly 3 s of real time.
   * Spanning the window by timestamp therefore measured a fraction of the
   * glide, found a small distance, and solved down to the 0.35 s floor — a
   * self-consistent fixed point that was wrong, and that reported a 100 m
   * descent as "2.1 m over 0.35 s". Summing the recorded dt is the same clock
   * the glide itself is advanced on, so the span is the glide. */
  const gameSince = (j) => {
    let s = 0;
    for (let k = i; k <= j; k++) s += rows[k][DT];
    return s;
  };

  /* Solve the span against the site's own clamp: the duration comes from the
     distance, and the distance is only known once the span is. Three passes is
     plenty — the clamp saturates at both ends for every transition here. */
  let dur = CAM_GLIDE_MAX_S, end = i, d = 0;
  for (let pass = 0; pass < 4; pass++) {
    end = i;
    while (end + 1 < rows.length && gameSince(end + 1) <= dur) end++;
    d = dist(p0, pos(end));
    dur = Math.max(CAM_GLIDE_MIN_S, Math.min(CAM_GLIDE_MAX_S, d / CAM_GLIDE_MPS));
  }
  const samples = end - i + 1;
  const secs = gameSince(end);
  const wall = rows[end][T] - t0;
  const fps = samples / Math.max(1e-6, wall);

  if (d < 0.5) {
    const note = `${from} -> ${to} at frame ${i}: camera moved ${d.toFixed(2)} m, nothing to score`;
    if (strict) fail(mode, note);
    else console.log(`  ${note}`);
    return;
  }

  let peak = 0, peakAt = i;
  for (let j = i; j <= end; j++) {
    const v = rows[j][DT] > 0 ? dist(pos(j - 1), pos(j)) / rows[j][DT] : 0;
    if (v > peak) { peak = v; peakAt = j; }
  }
  const analytic = (2 * d) / dur;
  console.log(`  ${from} -> ${to} at frame ${i}: ${d.toFixed(1)} m over ${dur.toFixed(2)} s, ${samples} samples (${fps.toFixed(1)} fps)`);
  console.log(`      peak ${peak.toFixed(1)} m/s against an eased peak of ${analytic.toFixed(1)} m/s (${(peak / analytic).toFixed(2)}x, limit 3x)`);
  if (peak > 3 * analytic) fail(mode, `${from} -> ${to} peaks at ${peak.toFixed(1)} m/s, ${(peak / analytic).toFixed(1)}x the eased peak — that is a cut`);

  if (samples < MIN_GLIDE_SAMPLES) {
    const note = `share-of-window SKIPPED: ${samples} samples inside a ${dur.toFixed(2)} s glide cannot resolve a cut from an ease at ${fps.toFixed(1)} fps`;
    if (strict) fail(mode, `${from} -> ${to}: ${note}`);
    else console.log(`      ${note}`);
    return;
  }
  const worst = worstFrameShare(rows, i);
  if (worst === "unsampled") { fail(mode, `${from} -> ${to}: not enough frames recorded after the change to score it`); return; }
  if (!worst) { console.log(`      share-of-window: window too still to score`); return; }
  console.log(`      worst single frame is ${(worst.share * 100).toFixed(1)}% of its 30-frame window (${worst.metres.toFixed(2)} m of ${worst.travel.toFixed(2)} m)`);
  if (worst.share > SHARE_LIMIT) fail(mode, `${from} -> ${to} jumps: one frame carries ${(worst.share * 100).toFixed(1)}% of the window`);
}

/* ============================================================== the phases */

/* Phase 1 — fly mode answers keys repeatedly.
   Every assertion here is written against the SYMPTOM of the stuck-key bug,
   not against its fix, so it would still fire if the release drain moved back
   inside step() or into a single mode. */
async function phaseFly(mode) {
  console.log(`\n--- ${mode}: fly mode responds repeatedly`);
  const page = await open(mode);
  await page.keyboard.press("f");
  await page.waitForFunction(() => window.__campusScooter.mode === "fly", null, { timeout: 15_000 });
  /* LET THE ENTRY TELEPORT LAND BEFORE MEASURING ANYTHING.
   *
   * `mode === "fly"` is true the instant toggleFly flips it, but toggleFly then
   * calls flyTo(), which drops the camera out of the intro's ~100 m onto the
   * route. Sampling the "before" pose at that moment folded a 110 m teleport
   * into the first W measurement, and the harness printed 141 m for a 400 ms
   * keypress — a number that is impossible at 45 m/s and that nobody reading
   * the output could tell was not W. Wait until two consecutive frames agree to
   * within a centimetre, so the first cycle measures the same thing the other
   * two do. */
  for (let settle = 0; settle < 40; settle++) {
    const a = await camAt(page);
    await waitFrames(page, 1);
    if (dist(a, await camAt(page)) < 0.01) break;
  }

  const moved = [], coasted = [];
  for (let n = 0; n < 3; n++) {
    const a = await camAt(page);
    await hold(page, "w");
    const b = await camAt(page);
    await waitFrames(page, 12);
    const c = await camAt(page);
    moved.push(dist(a, b));
    coasted.push(dist(b, c));
  }
  console.log(`  W held (m):     ${moved.map((d) => d.toFixed(2)).join("  ")}`);
  console.log(`  W released (m): ${coasted.map((d) => d.toFixed(2)).join("  ")}`);
  moved.forEach((d, i) => { if (d <= 4) fail(mode, `W press ${i + 1} moved only ${d.toFixed(2)} m`); });
  /* THE ONE THAT FAILS ON THE PRE-FIX BUILD. There, a keyup only queued a
     release that nothing in fly mode ever drained, so W stayed held and the
     camera kept flying until campus-explore's clamp caught it. Not asserted as
     exactly zero: the deferred-release design guarantees one more update after
     the keyup, by construction, so a few centimetres is correct behaviour. */
  coasted.forEach((d, i) => { if (d >= 1.0) fail(mode, `camera still moving ${d.toFixed(2)} m after W release ${i + 1}`); });
  if (moved.every((d) => d > 4) && coasted.every((d) => d < 1.0)) ok("W moves while held and stops on release, three times");

  /* W, S, W. On the pre-fix build the first two stick and cancel each other
     EXACTLY — equal and opposite — so the third press is not slow, it is dead. */
  const wsw = [];
  for (const k of ["w", "s", "w"]) {
    const a = await camAt(page);
    await hold(page, k);
    wsw.push(dist(a, await camAt(page)));
  }
  console.log(`  W/S/W (m):      ${wsw.map((d) => d.toFixed(2)).join("  ")}`);
  if (wsw[2] <= 4) fail(mode, `third press after W/S moved only ${wsw[2].toFixed(2)} m`);
  else ok("W after S still moves");

  /* E, Q, E — in that order, because the order is the test. A stuck "q"
     subtracts precisely the climb a live "e" adds, so the pre-fix build passes
     the first two steps and can never pass the third. */
  const climb = [await page.evaluate(() => window.__campusScooter.hover)];
  for (const k of ["e", "q", "e"]) {
    /* Held longer than the W presses: the climb rate is set by clearance, and
       at the 9 m flyTo seats you at, twelve frames clears the 0.8 m gate by
       only a fifth. More input, same gate — the threshold is not the thing to
       move. */
    await hold(page, k, 18);
    climb.push(await page.evaluate(() => window.__campusScooter.hover));
  }
  console.log(`  hover E,Q,E:    ${climb.map((h) => h.toFixed(2)).join(" -> ")}`);
  const want = [+1, -1, +1];
  want.forEach((sgn, i) => {
    const d = (climb[i + 1] - climb[i]) * sgn;
    if (d <= 0.8) fail(mode, `${["E", "Q", "E"][i]} moved hover ${(climb[i + 1] - climb[i]).toFixed(2)} m (wanted ${sgn > 0 ? "up" : "down"} > 0.8)`);
  });
  if (want.every((sgn, i) => (climb[i + 1] - climb[i]) * sgn > 0.8)) ok("E/Q/E each climbs the right way");

  const spd0 = await page.evaluate(() => window.__campusScooter.flySpeed);
  await hold(page, "ArrowUp");
  const spd1 = await page.evaluate(() => window.__campusScooter.flySpeed);
  console.log(`  fly speed:      ${spd0.toFixed(1)} -> ${spd1.toFixed(1)} m/s`);
  if (!(spd1 > spd0 + 1)) fail(mode, `ArrowUp did not raise fly speed (${spd0.toFixed(1)} -> ${spd1.toFixed(1)})`);
  else ok("ArrowUp raises fly speed");

  /* fly -> chase, with the probe running, for the continuity check. Entering
     fly on the way in is a KEPT snap and is exempt below. */
  await page.evaluate(() => window.__rideProbe.start());
  /* Enough frames either side of the change that a 30-frame window spanning it
     exists at all — the share metric needs 30 samples, and at 10 fps a
     "1.5 second" wall-clock settle is fifteen. */
  await waitFrames(page, 32);
  await page.keyboard.press("f");
  await page.waitForFunction(() => window.__campusScooter.mode === "chase", null, { timeout: 15_000 });
  await waitFrames(page, 40);
  const rows = await page.evaluate(() => { window.__rideProbe.stop(); return window.__rideProbe.drain(); });
  checkContinuity(mode, rows, "fly -> chase");

  reportErrors(mode, page, "fly");
  await page.close();
}

function checkContinuity(mode, rows, label) {
  if (rows.length < 40) { fail(mode, `${label}: probe returned only ${rows.length} frames`); return; }
  const changes = modeChanges(rows);
  let checked = 0;
  for (const i of changes) {
    const from = MODE_NAME[rows[i - 1][MODE]], to = MODE_NAME[rows[i][MODE]];
    /* EXEMPT BY DESIGN, and named in campus-scooter.js's toggleFly: entering
       fly is a deliberate cut, as are the [ and ] scrubs. Fly is a workbench —
       instant relocation is the feature, and animating 60 m per bracket press
       would make scrubbing slower for nothing. Cuts mean "tool", glides mean
       "game". So nothing is asserted about them here, in either direction. */
    if (to === "fly") { console.log(`  ${from} -> ${to} at frame ${i}: exempt, a deliberate snap`); continue; }
    checked++;
    /* intro -> chase is asserted strictly: it is the long glide and the one
       that was actually broken, so an unresolvable measurement there is a
       failed run, not a skipped check. */
    scoreTransition(mode, rows, i, from, to, from === "intro" && to === "chase");
  }
  if (!checked) fail(mode, `${label}: no non-exempt mode change was sampled`);
}

/* Phase 2 — the ribbon, the intro hand-over, and the contact patch. One page,
   because they are one continuous shot: the markings must be down for the
   whole of it, up the moment control passes, and the machine must be on the
   surface from the first metre to the hundredth. */
async function phaseRide(mode) {
  console.log(`\n--- ${mode}: ribbon, hand-over, contact patch`);
  const page = await open(mode);
  const readRibbon = () => page.evaluate(() => {
    const g = window.campusWalk.layers.route;
    return {
      n: g ? g.children.length : -1,
      parts: g ? g.children.map((m) => ({ visible: m.visible, opacity: m.material.opacity })) : [],
      mode: window.__campusScooter.mode,
      reveal: window.__campusScooter.reveal,
    };
  });

  /* Child count FIRST. Read the materials of an empty group and every "no
     stripe is visible" assertion passes vacuously — a route that failed to
     build would look exactly like a route correctly hidden. */
  const during = await readRibbon();
  console.log(`  route children: ${during.n}`);
  if (during.n < 2) { fail(mode, `route group has ${during.n} children, expected the stripes and the finish bar`); }
  else if (during.mode !== "intro") fail(mode, `intro was already over (${during.mode}) before the ribbon could be read`);
  else if (during.parts.some((p) => p.visible)) fail(mode, `lane markings visible during the intro: ${JSON.stringify(during.parts)}`);
  else ok(`ribbon hidden through the intro (${JSON.stringify(during.parts)})`);

  /* Probe on BEFORE the skip, so the hand-over frame itself is in the ring.
     endIntro() mid-shot is the CUT-SHORT path — the one that used to copy the
     chase pose in and jump; a shot allowed to run to completion arrives at the
     same pose anyway and would never have shown the bug. */
  await page.evaluate(() => window.__rideProbe.start());
  /* About 1.5 s in — early, so this is the CUT-SHORT path with the camera
     still high, which is where the glide has the furthest to travel and where
     the old pose-copy was most obviously a cut. Plus a few frames, because at
     6 fps "1.5 seconds" is only nine of them and the window needs a before. */
  await page.waitForTimeout(1500);
  await waitFrames(page, 4);
  await page.evaluate(() => window.__campusScooter.endIntro());
  await page.waitForFunction(() => window.__campusScooter.reveal >= 1, null, { timeout: 15_000 });
  const after = await readRibbon();
  console.log(`  after hand-over: ${JSON.stringify(after.parts)}`);
  /* The SHIPPED numbers, read off the materials rather than off the `reveal`
     counter we drive them with: 0.82 is a deliberate art call for the stripes
     and the bar is opaque. Reading the counter would only prove the counter. */
  const wantOpacity = [0.82, 1];
  wantOpacity.forEach((v, i) => {
    const p = after.parts[i];
    if (!p) return;
    if (!p.visible || Math.abs(p.opacity - v) > 0.01) fail(mode, `route child ${i} is ${JSON.stringify(p)} after reveal, wanted visible at ${v}`);
  });
  if (wantOpacity.every((v, i) => after.parts[i] && after.parts[i].visible && Math.abs(after.parts[i].opacity - v) < 0.01)) ok("ribbon fully revealed at its shipped opacities");

  /* Ride. 100 m is enough to cross the court-to-pavement grade break, which is
     exactly where the intro hands over and exactly where a level machine on a
     0.86 m wheelbase buries a wheel. */
  const startS = await page.evaluate(() => window.campusWalk.status().ride.s);
  const rows = [];
  const deadline = Date.now() + 90_000;
  for (;;) {
    await page.waitForTimeout(2000);
    rows.push(...await page.evaluate(() => window.__rideProbe.drain()));
    const s = await page.evaluate(() => window.campusWalk.status().ride.s);
    if (s - startS >= 100 || Date.now() > deadline) { console.log(`  rode ${(s - startS).toFixed(0)} m`); if (s - startS < 100) fail(mode, `only rode ${(s - startS).toFixed(0)} m in 90 s`); break; }
  }
  await page.evaluate(() => window.__rideProbe.stop());
  rows.push(...await page.evaluate(() => window.__rideProbe.drain()));

  checkContinuity(mode, rows, "intro -> chase");

  /* THE CONTACT PATCH, against the surface that is actually DRAWN.
     `contact` is the group's height above the ride datum and `rideY` is the
     plane it is meant to be on, so their difference is the error and zero is
     the target — but the band is two-sided and it is not zero-width, for a
     reason that is geometry rather than slop: the group's height is the MEAN
     of the front and rear contact-patch samples, so over a curved surface it
     differs from the centre sample by the sagitta across the 0.86 m wheelbase.
     Measured spread is about +/-0.018 m; 0.05 m leaves room for a steeper
     grade without leaving room for a bug.
     Two-sided is the whole point. A "fix" that hoists the machine clear of the
     ground would satisfy any "never below" test ever written, and must fail
     this one. */
  const chase = rows.filter((r) => MODE_NAME[r[MODE]] === "chase");
  if (chase.length < 100) fail(mode, `only ${chase.length} chase frames sampled — a probe that sampled nothing is a broken probe, not a pass`);
  else {
    const err = chase.map((r) => r[CONTACT] - r[RIDEY]);
    const lo = Math.min(...err), hi = Math.max(...err);
    console.log(`  contact patch over ${chase.length} frames: ${lo.toFixed(4)} .. ${hi.toFixed(4)} m off the drawn ride plane`);
    if (lo < -0.05 || hi > 0.05) fail(mode, `scooter leaves the +/-0.05 m band: ${lo.toFixed(4)} .. ${hi.toFixed(4)} m`);
    else ok("scooter stays on the drawn surface, neither sunk nor floating");
  }

  reportErrors(mode, page, "ride");
  await page.close();
}

/* Phase 3 — F during the intro, on its own page load.
   intro -> fly skips chase entirely, so step() never runs again. A reveal
   ticked from step() instead of frame() fails exactly this case and passes
   every other assertion in this file. It gets its own load because there is no
   way back into an un-revealed intro. */
async function phaseFlyDuringIntro(mode) {
  console.log(`\n--- ${mode}: F during the intro still reveals the ribbon`);
  const page = await open(mode);
  await waitFrames(page, 12);
  /* Vacuous if the shot has already ended — the hole being probed is the exit
     from an intro that is still running. */
  if (await page.evaluate(() => window.__campusScooter.mode) !== "intro") fail(mode, "intro was over before F could be pressed");
  await page.keyboard.press("f");
  await page.waitForFunction(() => window.__campusScooter.mode === "fly", null, { timeout: 15_000 });
  let done = true;
  await page.waitForFunction(() => window.__campusScooter.reveal >= 1, null, { timeout: 10_000 })
    .catch(() => { done = false; });
  const parts = await page.evaluate(() => window.campusWalk.layers.route.children.map((m) => ({ visible: m.visible, opacity: m.material.opacity })));
  console.log(`  mode ${await page.evaluate(() => window.__campusScooter.mode)}, ribbon ${JSON.stringify(parts)}`);
  if (!done) fail(mode, "ribbon never reached full reveal after F during the intro");
  else if (!(parts[0]?.visible && Math.abs(parts[0].opacity - 0.82) < 0.01 && parts[1]?.visible && Math.abs(parts[1].opacity - 1) < 0.01)) {
    fail(mode, `ribbon wrong after F during the intro: ${JSON.stringify(parts)}`);
  } else ok("ribbon reveals even when the intro exits straight to fly");

  reportErrors(mode, page, "f-during-intro");
  await page.close();
}

/* Printed, not asserted. A console error here would almost certainly have
   broken an assertion above already, and failing on one would let an unrelated
   pre-existing warning mask what this file is actually for. */
function reportErrors(mode, page, phase) {
  if (page.__errors.length) {
    console.log(`  console errors during ${phase}: ${page.__errors.length}`);
    for (const e of page.__errors.slice(0, 5)) console.log(`    ${e}`);
  }
}

/* ================================================================== the run */

for (const mode of ["staging", "scooter"]) {
  await phaseFly(mode);
  await phaseRide(mode);
  await phaseFlyDuringIntro(mode);
}

await browser.close();
server.close();

if (failures.length) {
  console.error(`\nFAIL: ${failures.length} assertion(s)`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log("\nPASS");
