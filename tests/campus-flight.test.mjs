/* Campus Walk — the flight model: how fast you may travel, how fast you climb,
 * and what the climb is measured against.
 *
 * Two promises live here that nothing else asserts:
 *
 *   1. The velocity axis. Full slider IS the cap (2000 m/s), and no
 *      combination of slider and shift may exceed it. Pinned because the cap
 *      is the one number the whole logarithmic axis is derived from.
 *   2. The Q/E climb is governed by CLEARANCE, not travel speed, and the curve
 *      is the shape that was asked for: pedestrian-fine against a surface,
 *      geometric with height. The integration test at the bottom is the one
 *      that matters — the tempting "simplification" here is to flatten the
 *      rate back to a constant, and a constant can still land inside a
 *      plausible total climb time. Only the SHAPE catches it, so the shape is
 *      what gets asserted.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  createExplore, climbRate, sliderToSpeed, speedToSlider,
  EYE, HOVER_MAX, MAX_SPEED_MPS, SHIFT_MULT, CLIMB_BASE_MPS, CLIMB_GAIN,
} from "../docs/js/campus-explore.js";
import { makeSolidSampler } from "../docs/js/campus-clearance.js";
import { pointInRings } from "../docs/js/campus-terrain.js";

/* The smallest terrain the constructor accepts, flat at y = 0, so `hover` and
   clearance are the same number and the arithmetic under test is visible. */
const FLAT = { x0: -5000, z0: -5000, cell: 10, cols: 1001, rows: 1001 };
const flatExplore = (solidAt) => createExplore({
  campus: { places: {} }, lidar: { terrain: FLAT }, heightAt: () => 0, solidAt,
});

const FRAME = 1 / 60;

/** Hold `keys` until `done(ex)`, in FRAME steps. Returns seconds elapsed. */
const holdUntil = (ex, keys, done, limit = 120) => {
  const held = new Set(keys);
  let t = 0;
  while (!done(ex) && t < limit) {
    ex.update(FRAME, held);
    t += FRAME;
  }
  return t;
};

/* --------------------------------------------------- 1. the velocity axis */

describe("the velocity axis tops out at 2000 m/s, exactly and hard", () => {
  test("the cap is 2000 and the full slider reaches it", () => {
    assert.equal(MAX_SPEED_MPS, 2000);
    assert.ok(Math.abs(sliderToSpeed(1) - MAX_SPEED_MPS) < 1e-9,
      `full slider gives ${sliderToSpeed(1)} m/s, not ${MAX_SPEED_MPS}`);
    assert.ok(Math.abs(speedToSlider(MAX_SPEED_MPS) - 1) < 1e-12,
      "the cap must sit at the very top of the slider");
  });

  test("slider x shift never passes the cap", () => {
    const ex = flatExplore();
    ex.enterAt(0, 0, 0);
    ex.speed = sliderToSpeed(1);
    let travelled = 0;
    for (let i = 0; i < 100; i++) {
      const [x0, z0] = [ex.x, ex.z];
      ex.update(0.01, new Set(["w", "shift"]));
      travelled += Math.hypot(ex.x - x0, ex.z - z0);
    }
    assert.ok(travelled <= MAX_SPEED_MPS + 1e-6,
      `shift at full slider covered ${travelled.toFixed(1)} m in 1 s — the cap leaks`);
    assert.ok(travelled > MAX_SPEED_MPS * 0.99,
      `full slider covered only ${travelled.toFixed(1)} m in 1 s — ${MAX_SPEED_MPS} is not reachable`);
  });

  test("the shipped slider default of 829/1000 is the 500 m/s spawn speed", () => {
    /* index.html seeds the range input with an integer out of 1000, so the
       constant and the markup have to agree on where 500 m/s lands on the new
       axis: ln(500 / 0.6) / ln(2000 / 0.6) = 6.7254 / 8.1117 = 0.8291. */
    assert.equal(Math.round(speedToSlider(500) * 1000), 829);
  });
});

/* --------------------------------------------- 2. the climb rate's shape */

describe("climbRate is set by clearance, and grows with it", () => {
  test("it floors at a pedestrian nudge hard against a surface", () => {
    assert.equal(climbRate(0), CLIMB_BASE_MPS);
    assert.ok(climbRate(0) > 1 && climbRate(0) < 2,
      `${climbRate(0)} m/s against a surface is not a nudge`);
    /* Never zero at either clamp, or you would be trapped: hover pins to EYE
       at the bottom and HOVER_MAX at the top, and both must still be
       escapable. */
    assert.ok(climbRate(EYE) > 0 && climbRate(HOVER_MAX) > 0);
    /* Nonsense in, floor out — update() must never hand NaN to `hover`. */
    for (const bad of [NaN, undefined, -5, -Infinity]) {
      assert.equal(climbRate(bad), CLIMB_BASE_MPS, `climbRate(${bad}) must floor`);
    }
  });

  test("it is monotonically increasing in clearance", () => {
    let prev = -Infinity;
    for (let c = 0; c <= 1200; c += 3) {
      const r = climbRate(c);
      assert.ok(r > prev, `rate stalled or fell at ${c} m of clearance`);
      prev = r;
    }
  });

  test("the curve hits the numbers it was specified with", () => {
    /* Literal clearances, deliberately. This table used to key its last row on
       HOVER_MAX, which quietly tied the shape of the climb CURVE to the height
       of the CEILING — two independent things. Raising the ceiling for the
       coastal region then failed this test even though the curve was untouched.
       The curve is specified at fixed clearances; the ceiling is checked on its
       own, below. */
    for (const [clearance, expected] of [
      [2, 2.6], [10, 7], [50, 29], [110, 62], [900, 496.5],
    ]) {
      assert.ok(Math.abs(climbRate(clearance) - expected) < 0.05,
        `${clearance} m of clearance gives ${climbRate(clearance)} m/s, not ~${expected}`);
    }
    assert.equal(CLIMB_GAIN, 0.55);
  });

  test("the ceiling stays inside the speed cap the curve is clamped by", () => {
    /* At the ceiling the climb rate must still be a rate and not the clamp —
       if CLIMB_BASE + GAIN x HOVER_MAX ever reaches MAX_SPEED_MPS, the last
       stretch of the climb goes constant-velocity and the "rate grows with
       height" property the controls are built on stops holding at the top. */
    const atCeiling = CLIMB_BASE_MPS + CLIMB_GAIN * HOVER_MAX;
    assert.ok(
      atCeiling < MAX_SPEED_MPS,
      `climb at the ceiling (${atCeiling} m/s) has hit the ${MAX_SPEED_MPS} m/s clamp`
    );
    assert.ok(Math.abs(climbRate(HOVER_MAX) - atCeiling) < 1e-6);
  });

  test("shift doubles it, under the same cap travel obeys", () => {
    for (const c of [0, 2, 110, 900]) {
      assert.ok(Math.abs(climbRate(c, true) - climbRate(c) * SHIFT_MULT) < 1e-9,
        `shift at ${c} m of clearance is not x${SHIFT_MULT}`);
    }
    /* Far past HOVER_MAX is unreachable in practice, but the clamp is what
       makes "shift" mean one thing everywhere, so it gets pinned. */
    assert.equal(climbRate(1e9, true), MAX_SPEED_MPS);
    assert.equal(climbRate(1e9), MAX_SPEED_MPS);
  });

  test("low down it is controllable: a frame moves under 10 cm", () => {
    /* The whole point of the change. At 2 m over a roof one 60 Hz frame must
       move the camera centimetres, not metres — this is what the old
       speed-keyed climb could not do at any slider setting above walking
       pace, and it is the assertion that fails if BASE or GAIN grows. */
    const step = climbRate(2) * FRAME;
    assert.ok(step < 0.1, `2 m up, one frame moves ${(step * 100).toFixed(1)} cm`);
    assert.ok(step > 0.01, `2 m up, one frame moves ${(step * 1000).toFixed(1)} mm — too slow to use`);
  });
});

/* ------------------------------- 3. the integrated climb: the real shape */

describe("altitude moves geometrically: measured, not asserted in the abstract", () => {
  test("EYE to HOVER_MAX takes ~10 s, and coming down takes the same", () => {
    /* Closed form for dh/dt = BASE + GAIN*h is
       ln((BASE + GAIN*HOVER_MAX) / (BASE + GAIN*EYE)) / GAIN = 9.69 s; forward
       Euler at 60 Hz measures 9.75 s up and 9.65 s down. The window is wide
       enough to survive a tweak to the constants and narrow enough that a
       flattened curve cannot sit inside it together with the shape assertion
       below. */
    const up = flatExplore();
    up.enterAt(0, 0, 0);
    up.hover = EYE;
    const climbS = holdUntil(up, ["e"], (ex) => ex.hover >= HOVER_MAX);
    assert.ok(climbS > 7 && climbS < 13,
      `EYE -> HOVER_MAX took ${climbS.toFixed(2)} s, outside the 7–13 s window`);

    const down = flatExplore();
    down.enterAt(0, 0, 0);
    down.hover = HOVER_MAX;
    const fallS = holdUntil(down, ["q"], (ex) => ex.hover <= EYE);
    assert.ok(Math.abs(fallS - climbS) < 1.5,
      `up took ${climbS.toFixed(2)} s but down took ${fallS.toFixed(2)} s — the control is asymmetric`);

    /* And both clamps hold, having been driven into. */
    assert.equal(up.hover, HOVER_MAX);
    assert.equal(down.hover, EYE);
  });

  test("the first 30 m cost a third of the whole ascent", () => {
    /* THE shape test. Geometric altitude spends its time low down: EYE -> 30 m
       is 3.7 s of a 9.7 s climb, 38%. Flatten the rate to any constant and the
       same 30 m becomes 3% of the total, whatever constant you pick — so this
       ratio is what catches a regression that the total time alone would let
       through. */
    const ex = flatExplore();
    ex.enterAt(0, 0, 0);
    ex.hover = EYE;
    const toThirty = holdUntil(ex, ["e"], (e) => e.hover >= 30);
    const rest = holdUntil(ex, ["e"], (e) => e.hover >= HOVER_MAX);
    const share = toThirty / (toThirty + rest);
    assert.ok(share > 0.25,
      `the first 30 m are only ${(share * 100).toFixed(1)}% of the ascent — the curve has been flattened`);
  });

  test("shift halves the time, and holding both keys goes nowhere", () => {
    const plain = flatExplore();
    plain.enterAt(0, 0, 0);
    plain.hover = EYE;
    const slow = holdUntil(plain, ["e"], (ex) => ex.hover >= HOVER_MAX);

    const fast = flatExplore();
    fast.enterAt(0, 0, 0);
    fast.hover = EYE;
    const quick = holdUntil(fast, ["e", "shift"], (ex) => ex.hover >= HOVER_MAX);
    assert.ok(Math.abs(quick - slow / SHIFT_MULT) < 0.6,
      `shift turned a ${slow.toFixed(2)} s climb into ${quick.toFixed(2)} s, not half`);

    const both = flatExplore();
    both.enterAt(0, 0, 0);
    both.hover = 200;
    for (let i = 0; i < 60; i++) both.update(FRAME, new Set(["q", "e"]));
    assert.ok(Math.abs(both.hover - 200) < 1e-9, "Q and E together must cancel");
  });
});

/* ------------------------------------------- 4. clearance from the massing */

/* A 40 m podium 20 m tall at the origin, with a 20 m tower wing 60 m tall
   sitting on its north-west quarter — the overlap case the sampler exists to
   resolve, in the shape createBuildings() reports it. */
const square = (cx, cz, half) => [
  [cx - half, cz - half], [cx + half, cz - half], [cx + half, cz + half], [cx - half, cz + half],
];
const MASSING = new Map([
  ["Podium", { x: 0, z: 0, topY: 20, h: 20, ring: square(0, 0, 20) }],
  ["Tower", { x: -10, z: -10, topY: 60, h: 60, ring: square(-10, -10, 10) }],
  ["Far Hall", { x: 900, z: -700, topY: 35, h: 35, ring: square(900, -700, 60) }],
]);

describe("makeSolidSampler answers the roof under a point", () => {
  test("null everywhere nothing is built", () => {
    const solidAt = makeSolidSampler(MASSING);
    for (const [x, z] of [[500, 500], [-2000, 0], [0, 200], [21, 21], [0, -1e6]]) {
      assert.equal(solidAt(x, z), null, `(${x}, ${z}) is not inside any footprint`);
    }
  });

  test("the roof height at a point inside a footprint", () => {
    const solidAt = makeSolidSampler(MASSING);
    assert.equal(solidAt(15, 15), 20, "south-east quarter of the podium");
    assert.equal(solidAt(900, -700), 35, "a footprint far from the origin, in a far grid cell");
    /* Bigger than one grid cell in both axes, so this only passes if a
       footprint is bucketed into every cell its bbox touches. */
    assert.equal(solidAt(955, -655), 35, "a corner of the 120 m footprint, cells away from its centre");
    assert.equal(solidAt(845, -745), 35, "the opposite corner");
  });

  test("overlapping footprints answer with the HIGHER roof", () => {
    const solidAt = makeSolidSampler(MASSING);
    assert.equal(solidAt(-10, -10), 60, "under the tower, which stands on the podium");
    assert.equal(solidAt(-1, -1), 60, "just inside the tower's edge");
    assert.equal(solidAt(1, 1), 20, "just outside it, back on the podium");
    /* Insertion order must not decide the answer. */
    const reversed = makeSolidSampler(new Map([...MASSING].reverse()));
    assert.equal(reversed(-10, -10), 60);
  });

  test("nothing throws, whatever the map contains", () => {
    for (const input of [
      undefined, null, new Map(), {}, [],
      new Map([["No ring", { x: 0, z: 0, topY: 12, h: 12 }]]),
      new Map([["Two points", { topY: 12, ring: [[0, 0], [1, 1]]}]]),
      new Map([["Bare numbers", { topY: 12, ring: [0, 1, 2] }]]),
      new Map([["Not finite", { topY: 12, ring: square(NaN, 0, 10) }]]),
      new Map([["No topY", { ring: square(0, 0, 10) }]]),
      new Map([["topY is text", { topY: "tall", ring: square(0, 0, 10) }]]),
      new Map([["Absurd", { topY: 12, ring: square(0, 0, 1e7) }]]),
    ]) {
      const solidAt = makeSolidSampler(input);
      for (const [x, z] of [[0, 0], [1e6, -1e6], [NaN, 0], [0, Infinity]]) {
        const y = solidAt(x, z);
        assert.ok(y === null || Number.isFinite(y),
          `sampler answered ${y} for (${x}, ${z})`);
      }
    }
    /* The one malformed case that must still ANSWER: a footprint too big to
       index is scanned instead of dropped, so bad data costs speed, never
       correctness. */
    const huge = makeSolidSampler(new Map([["Absurd", { topY: 12, ring: square(0, 0, 1e7) }]]));
    assert.equal(huge(0, 0), 12);
  });

  test("a campus-sized index agrees with brute force, far faster", () => {
    /* 1,400 footprints at the measured median size (26 m across, 16 vertices)
       spread over the real 3.1 km x 3.0 km extent.

       Timed against a brute-force scan built from the same footprints rather
       than against a wall-clock threshold: both sides scale together, so the
       ratio means the same thing on a slow CI box as on a laptop, and there is
       no number to re-tune later. Measured ~150x here; 8x is the floor, which a
       linear scan cannot reach and a working index cannot miss.

       The agreement half matters more than the timing half. Bucketing by
       bounding box is exactly the kind of optimisation that silently drops the
       candidate whose bbox straddles a cell edge, and a dropped candidate reads
       as "no building here" — the sampler would answer confidently and
       wrongly. So the fast path is checked against the slow one on every
       probe. */
    let seed = 1234567; // xorshift32, so the layout is identical on every run
    const rand = () => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return ((seed >>> 0) % 1e6) / 1e6;
    };
    const blob = (cx, cz) => {
      const ring = [];
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const r = 10 + rand() * 6;
        ring.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
      }
      return ring;
    };
    const many = new Map();
    const foots = [];
    for (let i = 0; i < 1400; i++) {
      const cx = rand() * 3137 - 1208;
      const cz = rand() * 2961 - 1472;
      const entry = { x: cx, z: cz, topY: 8 + rand() * 60, h: 20, ring: blob(cx, cz) };
      many.set(`m${i}`, entry);
      foots.push(entry);
    }
    const solidAt = makeSolidSampler(many);
    /* What this module replaces: every ring, every query. */
    const scan = (x, z) => {
      let top = null;
      for (const f of foots) {
        if (pointInRings(x, z, [f.ring]) && (top === null || f.topY > top)) top = f.topY;
      }
      return top;
    };

    /* 400 probes, not 4,000: the brute-force side costs ~0.6 ms per query, so
       the cross-check is what sets this test's runtime and 400 already covers
       every cell-edge case the layout produces. */
    const probes = [];
    for (let i = 0; i < 400; i++) probes.push([rand() * 3137 - 1208, rand() * 2961 - 1472]);
    let hits = 0;
    for (const [x, z] of probes) {
      const fast = solidAt(x, z);
      assert.equal(fast, scan(x, z), `the index disagrees with brute force at (${x}, ${z})`);
      if (fast !== null) hits++;
    }
    assert.ok(hits > 8, `only ${hits} of 400 probes landed on a building — the index is empty`);

    const timed = probes.slice(0, 120);
    const time = (fn) => {
      const t0 = process.hrtime.bigint();
      for (const [x, z] of timed) fn(x, z);
      return Number(process.hrtime.bigint() - t0) / 1e6;
    };
    time(solidAt); // warm both paths before either is measured
    time(scan);
    const indexed = time(solidAt);
    const scanned = time(scan);
    assert.ok(scanned / indexed > 8,
      `the index is only ${(scanned / indexed).toFixed(1)}x faster than scanning every ring ` +
      `(${indexed.toFixed(1)} ms vs ${scanned.toFixed(1)} ms) — the spatial index is not working`);
  });
});

/* ---------------------------------- 5. the two together, through update() */

describe("update() drives Q/E from clearance, roof or ground", () => {
  test("without solidAt, clearance falls back to height above terrain", () => {
    /* The fallback is what keeps the module standalone, so it is pinned to the
       exact rate rather than to a range: one frame from 100 m must move
       climbRate(100) * dt, no roof lookup involved. */
    const ex = flatExplore();
    ex.enterAt(0, 0, 0);
    ex.hover = 100;
    ex.update(FRAME, new Set(["e"]));
    assert.ok(Math.abs(ex.hover - (100 + climbRate(100) * FRAME)) < 1e-9,
      `one frame from 100 m gave ${ex.hover}, not ${100 + climbRate(100) * FRAME}`);

    /* And an explicit "nothing built here" sampler must be indistinguishable
       from no sampler at all. */
    const nulled = flatExplore(() => null);
    nulled.enterAt(0, 0, 0);
    nulled.hover = 100;
    nulled.update(FRAME, new Set(["e"]));
    assert.equal(nulled.hover, ex.hover);
  });

  test("two metres over a roof is slow; the same altitude off it is fast", () => {
    const solidAt = makeSolidSampler(MASSING);
    const overRoof = flatExplore(solidAt);
    overRoof.enterAt(15, 15, 0); // on the 20 m podium
    overRoof.hover = 22;
    const beside = flatExplore(solidAt);
    beside.enterAt(300, 300, 0); // same altitude, nothing underneath
    beside.hover = 22;

    overRoof.update(FRAME, new Set(["e"]));
    beside.update(FRAME, new Set(["e"]));
    const roofGain = overRoof.hover - 22;
    const openGain = beside.hover - 22;
    assert.ok(roofGain < 0.05,
      `2 m over the roof, one frame lifted ${(roofGain * 100).toFixed(1)} cm`);
    /* Same altitude, same key, same frame: only the roof differs. 22 m of
       clearance is 13.6 m/s against 2 m's 2.6, so the open air must lift more
       than four times as far. */
    assert.ok(openGain > roofGain * 4,
      `off the roof only lifted ${(openGain / roofGain).toFixed(1)}x as fast — the roof is not being sampled`);

    /* The tower stands on the podium, so the same altitude over ITS roof is
       inside the building: clearance floors at 0 and the rate at BASE. */
    const inside = flatExplore(solidAt);
    inside.enterAt(-10, -10, 0);
    inside.hover = 22;
    inside.update(FRAME, new Set(["e"]));
    assert.ok(Math.abs(inside.hover - (22 + CLIMB_BASE_MPS * FRAME)) < 1e-9,
      "below a roof the rate must floor at BASE, not go negative or NaN");
  });

  test("a roof does not stop the camera, it only slows the control", () => {
    /* Deliberate: free roam has no collision, and a sampler that trapped you
       on a rooftop would be a worse bug than one you can sink through. */
    const ex = flatExplore(makeSolidSampler(MASSING));
    ex.enterAt(15, 15, 0);
    ex.hover = 22;
    holdUntil(ex, ["q"], (e) => e.hover <= EYE, 400);
    assert.equal(ex.hover, EYE, "Q must reach the ground through a 20 m roof");
  });
});
