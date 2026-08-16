/* The scooter run's rules, driven headless.
 *
 * docs/js/scooter-ride.js imports no THREE and touches no DOM for exactly this
 * reason: the rules of the game — what a hop clears, what a hit costs, whether
 * a coin can be taken twice — are the part most likely to be quietly wrong,
 * and they are testable without a renderer. campus-explore.js set the
 * precedent; this follows it.
 *
 * Most of these run on a SYNTHETIC straight route rather than on the shipped
 * corridor. A test that only passes on real data cannot isolate anything: if a
 * bench at 40 m fails to clear, you want to know it is the hop arithmetic, not
 * that the route happened to bend there. The shipped corridor gets its own
 * test at the bottom — that a full run actually finishes.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const {
  createRide, positionAt,
  TOP_SPEED_MPS, START_SPEED_MPS, HIT_PENALTY_S, COIN_BONUS_S,
  HOP_HEIGHT_M, HOP_S, TRACK_HALF_W, RIDER_HALF_W, STEER_MPS,
} = await import(path.join(ROOT, "docs/js/scooter-ride.js"));

/* Where the rider's centre may go — the same clamp createRide applies. */
const SPAN = TRACK_HALF_W - RIDER_HALF_W;

/* A straight 200 m route heading due south (+z), sampled at 2 m — the same
   spacing the builder emits, so the index arithmetic under test is the real
   one. */
const straight = (metres = 200) => ({
  from: "A", to: "B", metres, spacing: 2,
  points: Array.from({ length: metres / 2 + 1 }, (_, i) => [0, i * 2]),
});

const game = (over = {}) => ({
  halfWidth: TRACK_HALF_W, startClear: 30, finishClear: 30,
  par: 40, obstacles: [], coins: [], ...over,
});

/** Run the ride at a fixed 60 fps until `stop` says so, or the route ends. */
function run(ride, { keysAt = () => new Set(), maxSeconds = 120 } = {}) {
  const dt = 1 / 60;
  let t = 0;
  while (!ride.finished && t < maxSeconds) {
    ride.update(dt, keysAt(ride.s, t));
    t += dt;
  }
  return t;
}

describe("the centreline", () => {
  test("arc length maps to the right point", () => {
    const r = straight();
    assert.deepEqual([positionAt(r, 0).x, positionAt(r, 0).z], [0, 0]);
    assert.ok(Math.abs(positionAt(r, 51).z - 51) < 1e-6, "51 m along is 51 m down the route");
    /* Past the end it clamps rather than running off the array. */
    assert.ok(Math.abs(positionAt(r, 5000).z - 200) < 1e-6);
  });

  test("a lateral offset sits to the rider's right", () => {
    const r = straight();
    /* Heading south, the rider's right is to the WEST. Getting this sign
       backwards mirrors the whole course and nothing else catches it. */
    const right = positionAt(r, 10, 1);
    assert.ok(right.x < 0, "positive offset is the rider's right");
    assert.ok(Math.abs(Math.abs(right.x) - 1) < 1e-6);
  });
});

describe("steering", () => {
  test("holding a key slides across and stops at the painted edge", () => {
    const ride = createRide({ route: straight(), game: game() });
    const held = new Set(["a"]);
    for (let i = 0; i < 120; i++) ride.update(1 / 60, held); // 2 s of holding A
    assert.ok(Math.abs(ride.laneX - -SPAN) < 1e-9,
      `2 s of holding A ended at ${ride.laneX} m, not clamped at the left edge`);
    for (let i = 0; i < 240; i++) ride.update(1 / 60, new Set(["d"]));
    assert.ok(Math.abs(ride.laneX - SPAN) < 1e-9, "did not clamp at the right edge");
  });

  test("steering takes time rather than teleporting", () => {
    const ride = createRide({ route: straight(), game: game() });
    ride.update(1 / 60, new Set(["d"]));
    assert.ok(Math.abs(ride.laneX - STEER_MPS / 60) < 1e-9,
      "one frame moved other than one frame's worth of steering");
  });

  test("left and right held together cancel", () => {
    const ride = createRide({ route: straight(), game: game() });
    for (let i = 0; i < 60; i++) ride.update(1 / 60, new Set(["a", "d"]));
    assert.equal(ride.laneX, 0, "opposed keys still moved the rider");
  });

  test("letting go stops the slide where it is", () => {
    const ride = createRide({ route: straight(), game: game() });
    for (let i = 0; i < 6; i++) ride.update(1 / 60, new Set(["d"]));
    const at = ride.laneX;
    for (let i = 0; i < 60; i++) ride.update(1 / 60, new Set());
    assert.equal(ride.laneX, at, "the rider drifted with no key held");
  });
});

describe("speed", () => {
  test("starts rolling and settles at the ES2's real top speed", () => {
    const ride = createRide({ route: straight(400), game: game() });
    assert.equal(ride.speed, START_SPEED_MPS);
    for (let i = 0; i < 600; i++) ride.update(1 / 60, new Set());
    assert.ok(Math.abs(ride.speed - TOP_SPEED_MPS) < 1e-6, `settled at ${ride.speed}`);
  });
});

describe("obstacles", () => {
  const bench = { s: 60, off: 0, kind: "bench", w: 1.7, h: 0.46, hop: true };
  const bollard = { s: 60, off: 0, kind: "bollard", w: 0.24, h: 0.95, hop: false };

  test("riding into one costs exactly the penalty, once", () => {
    const ride = createRide({ route: straight(), game: game({ obstacles: [bollard] }) });
    run(ride);
    assert.equal(ride.hits, 1, "the bollard was hit twice, or not at all");
    assert.ok(Math.abs(ride.clock() - (ride.status().clock)) < 1e-9);
  });

  test("a hop clears a bench and does not clear a bollard", () => {
    /* Hop early enough that the arc peaks over the obstacle. At ~6.9 m/s the
       hop covers ~3.8 m, so leaving the ground 2 m out lands the peak on it. */
    const hopNear = (target) => (s) => (s > target - 2.2 && s < target - 1.6 ? new Set([" "]) : new Set());

    const cleared = createRide({ route: straight(), game: game({ obstacles: [bench] }) });
    run(cleared, { keysAt: hopNear(60) });
    assert.equal(cleared.hits, 0, `the hop did not clear a ${bench.h} m bench`);

    const hit = createRide({ route: straight(), game: game({ obstacles: [bollard] }) });
    run(hit, { keysAt: hopNear(60) });
    assert.equal(hit.hits, 1, `the hop cleared a ${bollard.h} m bollard — it is taller than the hop`);
  });

  test("the hop arc peaks at the declared height and ends", () => {
    const ride = createRide({ route: straight(), game: game() });
    let peak = 0;
    ride.update(1 / 60, new Set([" "]));
    for (let i = 0; i < Math.ceil(HOP_S * 60) + 6; i++) {
      ride.update(1 / 60, new Set([" "]));
      peak = Math.max(peak, ride.y);
    }
    assert.ok(Math.abs(peak - HOP_HEIGHT_M) < 0.02, `hop peaked at ${peak.toFixed(3)} m`);
    assert.equal(ride.y, 0, "the rider never came down");
    assert.equal(ride.airborne, false);
  });

  test("an obstacle off to the side goes past untouched", () => {
    /* 1.15 m away is clear of a 0.24 m bollard plus the rider's 0.32 m. */
    const ride = createRide({ route: straight(), game: game({ obstacles: [{ ...bollard, off: -1.15 }] }) });
    run(ride);
    assert.equal(ride.hits, 0, "hit an obstacle well off the rider's line");
  });

  test("a hit is not skipped by a long frame", () => {
    /* The crossing test exists so a stutter cannot teleport the rider through
       a bollard. One 0.3 s frame covers 2 m — a proximity window would miss. */
    const ride = createRide({ route: straight(), game: game({ obstacles: [bollard] }) });
    while (ride.s < 80 && !ride.finished) ride.update(0.3, new Set());
    assert.equal(ride.hits, 1, "a long frame walked straight through a bollard");
  });
});

describe("coins", () => {
  test("a low coin on the rider's line is taken once", () => {
    const coins = [{ s: 50, off: 0, y: 0.9 }];
    const ride = createRide({ route: straight(), game: game({ coins }) });
    run(ride);
    assert.equal(ride.coins, 1);
  });

  test("a high coin needs the hop", () => {
    const coins = [{ s: 50, off: 0, y: 1.45 }];
    const missed = createRide({ route: straight(), game: game({ coins }) });
    run(missed);
    assert.equal(missed.coins, 0, "an out-of-reach coin was taken from the deck");

    const taken = createRide({ route: straight(), game: game({ coins }) });
    run(taken, { keysAt: (s) => (s > 47.8 && s < 48.4 ? new Set([" "]) : new Set()) });
    assert.equal(taken.coins, 1, "the hop did not reach a coin at 1.45 m");
  });

  test("collecting does not consume the loaded data", () => {
    /* The ride copies the coin objects. Without that, the second run of a
       session would start with every coin already taken. */
    const g = game({ coins: [{ s: 50, off: 0, y: 0.9 }] });
    const first = createRide({ route: straight(), game: g });
    run(first);
    const second = createRide({ route: straight(), game: g });
    run(second);
    assert.equal(second.coins, 1, "the second run found the coin already gone");
    assert.equal(g.coins[0].taken, undefined, "the loaded data was mutated");
  });
});

describe("the clock", () => {
  test("hits add and coins subtract", () => {
    const base = createRide({ route: straight(60), game: game() });
    const plain = run(base);

    const hurt = createRide({
      route: straight(60),
      game: game({ obstacles: [{ s: 30, off: 0, kind: "bollard", w: 0.24, h: 0.95, hop: false }] }),
    });
    run(hurt);
    assert.ok(hurt.clock() > plain + HIT_PENALTY_S - 0.5,
      "a hit did not cost the penalty and the lost speed");

    const rich = createRide({ route: straight(60), game: game({ coins: [{ s: 30, off: 0, y: 0.9 }] }) });
    const richT = run(rich);
    assert.ok(Math.abs(rich.clock() - (richT - COIN_BONUS_S)) < 0.1,
      "a coin did not buy back its half second");
  });

  test("never runs negative, however many coins", () => {
    const coins = Array.from({ length: 200 }, (_, i) => ({ s: 20 + i * 0.5, off: 0, y: 0.9 }));
    const ride = createRide({ route: straight(160), game: game({ coins }) });
    run(ride);
    assert.ok(ride.clock() >= 0, `clock went to ${ride.clock()}`);
  });
});

describe("the shipped corridor", () => {
  const DOC = JSON.parse(
    readFileSync(path.join(ROOT, "docs/data/corridor-eighth-peterson.json"), "utf8")
  );

  /* The widest free window of rider-centre positions through a group — the
     same arithmetic the builder's check() runs, re-derived here so the test
     cannot inherit the builder's own mistake. */
  const freeCentre = (group) => {
    const span = DOC.game.halfWidth - RIDER_HALF_W;
    const blocked = group
      .map((o) => [o.off - o.w / 2 - RIDER_HALF_W, o.off + o.w / 2 + RIDER_HALF_W])
      .sort((a, b) => a[0] - b[0]);
    let cursor = -span;
    let best = { width: 0, centre: 0 };
    for (const [a, b] of blocked) {
      const width = Math.min(a, span) - cursor;
      if (width > best.width) best = { width, centre: cursor + width / 2 };
      cursor = Math.max(cursor, b);
    }
    if (span - cursor > best.width) best = { width: span - cursor, centre: cursor + (span - cursor) / 2 };
    return best;
  };

  test("a rider who never steers still reaches Peterson Hall", () => {
    /* The whole promise of "every group leaves a gap" is that the run is
       finishable. This is the end-to-end version of that assertion: it will
       cost hits, but it must terminate at the finish line. */
    const ride = createRide({ route: DOC.route, game: DOC.game });
    const seconds = run(ride, { maxSeconds: 600 });
    assert.equal(ride.finished, true, `the run did not finish in ${seconds.toFixed(0)} s`);
    assert.ok(Math.abs(ride.s - DOC.route.metres) < 0.01, "finished somewhere other than the end");
  });

  test("a rider who steers for the gaps can beat par", () => {
    /* Aim at the widest free window through each coming group. If a clean
       line cannot beat par, par is wrong and the game is unwinnable. The line
       is planned in full BEFORE the run: a greedy autopilot that re-reads
       "the next group" every frame abandons the group it is about to reach
       as soon as it passes into its own lookahead, and steers back into it —
       a bug in the driver, not the game, and the point of this test is the
       game. */
    const byS = new Map();
    for (const o of DOC.game.obstacles) {
      if (!byS.has(o.s)) byS.set(o.s, []);
      byS.get(o.s).push(o);
    }
    const groups = [...byS.keys()].sort((a, b) => a - b);
    const plan = new Map();
    for (const s of groups) {
      const gap = freeCentre(byS.get(s));
      assert.ok(gap.width > 0, `no way through the group at ${s} m`);
      plan.set(s, gap.centre);
    }

    const ride = createRide({ route: DOC.route, game: DOC.game });
    run(ride, {
      maxSeconds: 600,
      keysAt: (s) => {
        /* Aim at the next group not yet passed, and keep aiming at it. */
        const next = groups.find((g) => g > s - 1);
        const want = next == null ? ride.laneX : plan.get(next);
        if (Math.abs(ride.laneX - want) < 0.03) return new Set();
        return new Set([ride.laneX > want ? "a" : "d"]);
      },
    });
    assert.equal(ride.hits, 0, `a clean line still hit ${ride.hits} things`);
    assert.ok(ride.clock() <= DOC.game.par,
      `a clean run took ${ride.clock().toFixed(1)} s against a par of ${DOC.game.par} s`);
  });
});
