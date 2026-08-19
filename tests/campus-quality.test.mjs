// The adaptive quality controller (campus-quality.js): hold 60 fps by walking a
// measured ladder, and never walk it while the audit is photographing.
//
// The ladder's ORDER is a measurement (perf-experiment, 2026-08-19), so the
// first thing pinned here is that the data still says what the measurement
// said: every step down must cost the look less, never more. The rest is the
// control loop — one decision per window, one rung when the machine is
// marginal and two when it is far under target, a cooldown so a machine that
// can almost hold a level does not strobe between two of them, and a lock that
// the screenshot audit can trust at 1–2 fps under SwiftShader.
//
// The collaborators are the smallest objects that satisfy the calls, because
// what is under test is the decision, not the renderer: a real WebGLRenderer
// cannot exist here and a fake one that records is a better witness anyway.
import test from "node:test";
import assert from "node:assert/strict";
import { createQuality, QUALITY_LEVELS } from "../docs/js/campus-quality.js";

/* apply() clamps the pixel ratio against the browser's devicePixelRatio, which
   is a bare global read — headless there is no window, so the environment has
   to stand one up before the module can be exercised at all. 2 is a retina
   Mac, i.e. above every ratio in the ladder, so unless a test says otherwise
   the clamp is not the thing under observation. */
globalThis.devicePixelRatio = 2;

/* The controller's own private constants (campus-quality.js), mirrored so the
   windows below close where the module thinks they do. DEEP is the "far under
   target, take two rungs at once" threshold. */
const LOW = 55, HIGH = 58, DEEP = LOW - 12, WINDOW_S = 2, COOLDOWN_S = 3;

/* Frame times for the four regimes the controller distinguishes. MARGINAL sits
   in the narrow band where the machine is under target but not by much, which
   is the only regime that steps a single rung. */
const MARGINAL_DT = 0.02, DEEP_DT = 0.5, FAST_DT = 1 / 128, BAND_DT = 1 / 56.5;

function fakes({ pixelRatio = 1.5, shadow = 2048 } = {}) {
  const log = { gtao: [], shadowSizes: [], pixelRatios: [], resizes: 0, disposed: 0 };
  const renderer = {
    getPixelRatio: () => pixelRatio,
    setPixelRatio(v) { pixelRatio = v; log.pixelRatios.push(v); },
  };
  const postfx = { setGtaoScale(v) { log.gtao.push(v); } };
  const sun = {
    shadow: {
      mapSize: { x: shadow, y: shadow, set(w, h) { this.x = w; this.y = h; log.shadowSizes.push(w); } },
      map: { dispose() { log.disposed++; } },
    },
  };
  const chunks = { config: {} };
  const resize = () => { log.resizes++; };
  return { renderer, postfx, sun, chunks, resize, log };
}

const make = (over) => {
  const f = fakes(over);
  return { q: createQuality(f), ...f };
};

/* One observation window at a fixed frame time, plus one frame — the window
   closes on accumulated seconds, and a dt that does not divide WINDOW_S
   exactly in binary floating point would otherwise leave it a frame short. */
function feedWindow(q, dt) {
  const frames = Math.ceil(WINDOW_S / dt) + 1;
  for (let i = 0; i < frames; i++) q.update(dt);
}

/* --------------------------------------------------------------- the ladder */

test("QUALITY_LEVELS never asks for MORE as the level gets worse", () => {
  /* The ordering is the whole claim of the file: level i+1 is a cheaper frame
     than level i in every dimension, so the controller can walk it one step at
     a time and know which way it is going. */
  for (let i = 1; i < QUALITY_LEVELS.length; i++) {
    const prev = QUALITY_LEVELS[i - 1], cur = QUALITY_LEVELS[i];
    assert.ok(cur.gtao <= prev.gtao, `level ${i} raises GTAO scale ${prev.gtao} -> ${cur.gtao}`);
    assert.ok(cur.pr <= prev.pr, `level ${i} raises pixel ratio ${prev.pr} -> ${cur.pr}`);
    assert.ok(cur.shadow <= prev.shadow, `level ${i} raises shadow map ${prev.shadow} -> ${cur.shadow}`);
    assert.ok(cur.lod <= prev.lod, `level ${i} raises the LOD radii ${prev.lod} -> ${cur.lod}`);
  }
  /* And the ladder degrades in the measured order: GTAO's internal resolution
     goes first (~10 ms), shadows second (~5 ms), pixel ratio only after both. */
  assert.ok(QUALITY_LEVELS[1].gtao < QUALITY_LEVELS[0].gtao, "the first step down must be GTAO's");
  assert.equal(QUALITY_LEVELS[1].shadow, QUALITY_LEVELS[0].shadow, "shadows must not move on the first step");
  assert.equal(QUALITY_LEVELS[1].pr, QUALITY_LEVELS[0].pr, "pixel ratio must not move on the first step");
  assert.equal(QUALITY_LEVELS[0].lod, 1, "level 0 must draw everything the tiers allow");
});

/* ----------------------------------------------------------------- apply() */

test("apply pushes the level's values into the renderer, the post stack and the tiers", () => {
  const { q, chunks, log } = make();
  q.apply(4);
  assert.equal(q.level, 4);
  const l4 = QUALITY_LEVELS[4];
  assert.equal(log.gtao.at(-1), l4.gtao);
  assert.equal(log.shadowSizes.at(-1), l4.shadow);
  assert.equal(log.pixelRatios.at(-1), l4.pr);
  assert.equal(chunks.config.lodScale, l4.lod, "the LOD dial never reached the chunk world");
  assert.equal(log.disposed, 1, "resizing the shadow map must free the old one");
  assert.equal(log.resizes, 1, "changing the pixel ratio must re-lay the render targets");
});

test("apply clamps to the ends of the ladder instead of walking off it", () => {
  const { q, log } = make();
  q.apply(-5);
  assert.equal(q.level, 0);
  assert.equal(log.gtao.at(-1), QUALITY_LEVELS[0].gtao);
  q.apply(99);
  assert.equal(q.level, QUALITY_LEVELS.length - 1);
  assert.equal(log.gtao.at(-1), QUALITY_LEVELS.at(-1).gtao);
});

test("apply does not churn what is already set", () => {
  /* Re-allocating a 2048 shadow map or re-laying every render target because
     the controller re-stated the level it is already on is exactly the stall
     this controller exists to avoid. */
  const { q, log } = make({ pixelRatio: QUALITY_LEVELS[0].pr, shadow: QUALITY_LEVELS[0].shadow });
  q.apply(0);
  assert.deepEqual(log.shadowSizes, [], "the shadow map was rebuilt at the size it already had");
  assert.deepEqual(log.pixelRatios, [], "the pixel ratio was re-set to the value it already had");
  assert.equal(log.resizes, 0);
  assert.equal(log.disposed, 0);
});

test("the pixel ratio is clamped by the display, never raised above it", () => {
  const previous = globalThis.devicePixelRatio;
  globalThis.devicePixelRatio = 1; // a plain 1x panel
  try {
    const { q, log } = make({ pixelRatio: 3 });
    q.apply(0);
    assert.equal(QUALITY_LEVELS[0].pr, 1.5, "the level asks for more than this display has");
    assert.equal(log.pixelRatios.at(-1), 1, "supersampling past the panel's own ratio buys nothing");
  } finally {
    globalThis.devicePixelRatio = previous;
  }
});

/* -------------------------------------------------------- the control loop */

test("a marginally slow window steps down exactly one level and starts a cooldown", () => {
  const { q } = make();
  assert.ok(1 / MARGINAL_DT > DEEP && 1 / MARGINAL_DT < LOW,
    "this test's frame rate must be under target but not deeply so");
  assert.equal(q.level, 0);
  feedWindow(q, MARGINAL_DT);
  assert.equal(q.level, 1, "a marginal window must cost exactly one level");

  /* The cooldown exists because the level just applied has not had time to show
     up in the frame times yet, so the next window's verdict is about the OLD
     level. Judging on it is how a controller strobes. */
  assert.ok(WINDOW_S < COOLDOWN_S, "a cooldown shorter than a window could never suppress one");
  feedWindow(q, MARGINAL_DT);
  assert.equal(q.level, 1, "the controller stepped again inside its own cooldown");
  /* Two windows cover the 3 s cooldown, so this is the window allowed to act. */
  assert.ok(WINDOW_S * 2 >= COOLDOWN_S, "this test assumes two windows cover the cooldown");
  feedWindow(q, MARGINAL_DT);
  assert.equal(q.level, 2, "the cooldown expired and the controller still would not step");
});

test("a deeply slow window takes two rungs at once", () => {
  /* A machine at 35 fps is not marginal and does not need three windows to
     prove it — under LOW - 12 the controller drops two levels in one step.
     Still one step and one cooldown, so the loop's shape is unchanged. */
  const { q } = make();
  assert.ok(1 / DEEP_DT < DEEP, "this test's frame rate must be under the two-rung threshold");
  feedWindow(q, DEEP_DT);
  assert.equal(q.level, 2, "a deep deficit must cost two levels, not one");
  feedWindow(q, DEEP_DT);
  assert.equal(q.level, 2, "the two-rung step must still respect the cooldown");
});

test("a partial window decides nothing", () => {
  const { q, log } = make();
  for (let i = 0; i < Math.floor(WINDOW_S / DEEP_DT) - 1; i++) q.update(DEEP_DT);
  assert.equal(q.level, 0, "the controller judged the frame rate before its window closed");
  assert.deepEqual(log.gtao, [], "nothing should have been applied yet");
});

test("a fast window steps back up", () => {
  const { q, chunks } = make();
  q.apply(4);
  feedWindow(q, FAST_DT); // 128 fps, over HIGH
  assert.equal(q.level, 3, "headroom must be given back, one level at a time");
  assert.equal(chunks.config.lodScale, QUALITY_LEVELS[3].lod);
  /* And the same asymmetry applies going up: not two levels in one cooldown. */
  feedWindow(q, FAST_DT);
  assert.equal(q.level, 3, "the controller climbed twice inside one cooldown");
});

test("a frame rate inside the band leaves the level alone", () => {
  /* Between LOW and HIGH the machine is holding the level it is on. Stepping
     here is what strobing looks like. */
  const { q } = make();
  q.apply(3);
  assert.ok(1 / BAND_DT > LOW && 1 / BAND_DT < HIGH, "this test's frame rate must sit inside the dead band");
  for (let i = 0; i < 6; i++) feedWindow(q, BAND_DT);
  assert.equal(q.level, 3, "the controller moved on a frame rate it should have accepted");
});

test("the floor and the ceiling of the ladder are not walked off", () => {
  const top = make();
  for (let i = 0; i < 8; i++) feedWindow(top.q, FAST_DT);
  assert.equal(top.q.level, 0, "a fast machine at level 0 has nowhere to climb to");

  const bottom = make();
  bottom.q.apply(QUALITY_LEVELS.length - 1);
  for (let i = 0; i < 8; i++) feedWindow(bottom.q, DEEP_DT);
  assert.equal(bottom.q.level, QUALITY_LEVELS.length - 1, "the controller stepped past the bottom of the ladder");
  /* The two-rung step must not overshoot the bottom either. */
  bottom.q.apply(QUALITY_LEVELS.length - 2);
  for (let i = 0; i < 8; i++) feedWindow(bottom.q, DEEP_DT);
  assert.equal(bottom.q.level, QUALITY_LEVELS.length - 1, "a two-rung step off the second-to-last level overshot");
});

/* ------------------------------------------------------------------- lock */

test("lock pins a level so the screenshot audit photographs the product, not the floor", () => {
  /* The audit renders under SwiftShader at 1–2 fps. An adapting controller
     would walk straight to the bottom of the ladder and every reference shot
     would be of the worst level this project ships. */
  const { q, log } = make();
  q.lock(2);
  assert.equal(q.level, 2, "lock must apply the level it pins");
  assert.equal(log.gtao.at(-1), QUALITY_LEVELS[2].gtao);
  for (let i = 0; i < 10; i++) feedWindow(q, DEEP_DT);
  assert.equal(q.level, 2, "a locked controller adapted anyway");
  const applied = log.gtao.length;

  q.unlock();
  feedWindow(q, MARGINAL_DT);
  assert.equal(q.level, 3, "unlock did not hand control back");
  assert.ok(log.gtao.length > applied, "the resumed step never reached the post stack");
});

test("lock() with no argument pins the best level", () => {
  const { q } = make();
  q.apply(5);
  q.lock();
  assert.equal(q.level, 0);
  for (let i = 0; i < 4; i++) feedWindow(q, DEEP_DT);
  assert.equal(q.level, 0);
});

test("the controller exposes the ladder it is walking", () => {
  const { q } = make();
  assert.equal(q.levels, QUALITY_LEVELS, "the dev panel and the URL read the levels through this");
});
