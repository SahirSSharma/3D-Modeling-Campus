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
  createRide, positionAt, laneCentre,
  TOP_SPEED_MPS, START_SPEED_MPS, HIT_PENALTY_S, COIN_BONUS_S,
  HOP_HEIGHT_M, HOP_S, LANE_OFFSET_M,
} = await import(path.join(ROOT, "docs/js/scooter-ride.js"));

/* A straight 200 m route heading due south (+z), sampled at 2 m — the same
   spacing the builder emits, so the index arithmetic under test is the real
   one. */
const straight = (metres = 200) => ({
  from: "A", to: "B", metres, spacing: 2,
  points: Array.from({ length: metres / 2 + 1 }, (_, i) => [0, i * 2]),
});

const game = (over = {}) => ({
  lanes: 3, laneOffset: LANE_OFFSET_M, startClear: 30, finishClear: 30,
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

  test("lanes sit either side of it", () => {
    const r = straight();
    assert.equal(laneCentre(1), 0, "the middle lane is on the centreline");
    assert.equal(laneCentre(0), -LANE_OFFSET_M);
    assert.equal(laneCentre(2), LANE_OFFSET_M);
    /* Heading south, the right-hand lane is to the WEST. Getting this sign
       backwards mirrors the whole course and nothing else catches it. */
    const right = positionAt(r, 10, LANE_OFFSET_M);
    assert.ok(right.x < 0, "positive lane offset is the rider's right");
    assert.ok(Math.abs(Math.abs(right.x) - LANE_OFFSET_M) < 1e-6);
  });
});

describe("steering", () => {
  test("a tap moves one lane, and holding does not slide across the path", () => {
    const ride = createRide({ route: straight(), game: game() });
    const held = new Set(["a"]);
    for (let i = 0; i < 120; i++) ride.update(1 / 60, held); // 2 s of holding A
    assert.equal(ride.lane, 0, "holding A moved more than one lane");
  });

  test("lane index clamps at both edges", () => {
    const ride = createRide({ route: straight(), game: game() });
    for (let i = 0; i < 6; i++) {
      ride.update(1 / 60, new Set(["a"]));
      ride.update(1 / 60, new Set());
    }
    assert.equal(ride.lane, 0, "steered off the left of the path");
    for (let i = 0; i < 9; i++) {
      ride.update(1 / 60, new Set(["d"]));
      ride.update(1 / 60, new Set());
    }
    assert.equal(ride.lane, 2, "steered off the right of the path");
  });

  test("the lean takes time rather than teleporting", () => {
    const ride = createRide({ route: straight(), game: game() });
    ride.update(1 / 60, new Set(["d"]));
    assert.ok(Math.abs(ride.laneX) < LANE_OFFSET_M * 0.5,
      "one frame moved the whole lane width");
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
  const bench = { s: 60, lane: 1, kind: "bench", w: 1.7, h: 0.46, hop: true };
  const bollard = { s: 60, lane: 1, kind: "bollard", w: 0.24, h: 0.95, hop: false };

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

  test("another lane goes past untouched", () => {
    const ride = createRide({ route: straight(), game: game({ obstacles: [{ ...bollard, lane: 0 }] }) });
    run(ride);
    assert.equal(ride.hits, 0, "hit an obstacle two lanes away");
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
  test("a low coin in the lane is taken once", () => {
    const coins = [{ s: 50, lane: 1, y: 0.9 }];
    const ride = createRide({ route: straight(), game: game({ coins }) });
    run(ride);
    assert.equal(ride.coins, 1);
  });

  test("a high coin needs the hop", () => {
    const coins = [{ s: 50, lane: 1, y: 1.45 }];
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
    const g = game({ coins: [{ s: 50, lane: 1, y: 0.9 }] });
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
      game: game({ obstacles: [{ s: 30, lane: 1, kind: "bollard", w: 0.24, h: 0.95, hop: false }] }),
    });
    run(hurt);
    assert.ok(hurt.clock() > plain + HIT_PENALTY_S - 0.5,
      "a hit did not cost the penalty and the lost speed");

    const rich = createRide({ route: straight(60), game: game({ coins: [{ s: 30, lane: 1, y: 0.9 }] }) });
    const richT = run(rich);
    assert.ok(Math.abs(rich.clock() - (richT - COIN_BONUS_S)) < 0.1,
      "a coin did not buy back its half second");
  });

  test("never runs negative, however many coins", () => {
    const coins = Array.from({ length: 200 }, (_, i) => ({ s: 20 + i * 0.5, lane: 1, y: 0.9 }));
    const ride = createRide({ route: straight(160), game: game({ coins }) });
    run(ride);
    assert.ok(ride.clock() >= 0, `clock went to ${ride.clock()}`);
  });
});

describe("the shipped corridor", () => {
  const DOC = JSON.parse(
    readFileSync(path.join(ROOT, "docs/data/corridor-eighth-peterson.json"), "utf8")
  );

  test("a rider who never steers still reaches Peterson Hall", () => {
    /* The whole promise of "never all three lanes at once" is that the run is
       finishable. This is the end-to-end version of that assertion: it will
       cost hits, but it must terminate at the finish line. */
    const ride = createRide({ route: DOC.route, game: DOC.game });
    const seconds = run(ride, { maxSeconds: 600 });
    assert.equal(ride.finished, true, `the run did not finish in ${seconds.toFixed(0)} s`);
    assert.ok(Math.abs(ride.s - DOC.route.metres) < 0.01, "finished somewhere other than the end");
  });

  test("a rider who takes the open lane can beat par", () => {
    /* Steer to whichever lane the next group leaves open. If a perfect line
       cannot beat par, par is wrong and the game is unwinnable. */
    /* The line is planned in full BEFORE the run rather than decided frame by
       frame. A greedy autopilot that re-reads "the next group" every frame
       abandons the group it is about to reach as soon as it is within its own
       lookahead, and steers back into it — which is a bug in the driver, not
       in the game, and the point of this test is the game. */
    const groups = [...new Set(DOC.game.obstacles.map((o) => o.s))].sort((a, b) => a - b);
    const blockedAt = new Map(groups.map((s) => [s, new Set()]));
    for (const o of DOC.game.obstacles) blockedAt.get(o.s).add(o.lane);

    let planned = 1;
    const plan = new Map();
    for (const s of groups) {
      const open = [0, 1, 2].filter((l) => !blockedAt.get(s).has(l));
      assert.ok(open.length, `no lane is open at ${s} m`);
      planned = open.reduce((a, b) => (Math.abs(a - planned) <= Math.abs(b - planned) ? a : b));
      plan.set(s, planned);
    }

    const ride = createRide({ route: DOC.route, game: DOC.game });
    /* Steering is edge-triggered, so the autopilot has to let go of the key
       between lanes — holding it down moves one lane and then nothing, which
       is the behaviour the "holding does not slide across the path" test
       above pins. Releasing on alternate frames is the cheapest way to tap. */
    let down = false;
    run(ride, {
      maxSeconds: 600,
      keysAt: (s) => {
        /* Aim at the next group not yet passed, and keep aiming at it. */
        const next = groups.find((g) => g > s - 1);
        const want = next == null ? ride.lane : plan.get(next);
        if (ride.lane === want) { down = false; return new Set(); }
        down = !down;
        return down ? new Set([ride.lane > want ? "a" : "d"]) : new Set();
      },
    });
    assert.equal(ride.hits, 0, `a perfect line still hit ${ride.hits} things`);
    assert.ok(ride.clock() <= DOC.game.par,
      `a clean run took ${ride.clock().toFixed(1)} s against a par of ${DOC.game.par} s`);
  });
});
