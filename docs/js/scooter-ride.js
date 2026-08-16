// The scooter run: everything about the ride that is not drawing.
//
// No THREE, no DOM — deliberately, and for the same reason campus-explore.js
// has neither: a game whose rules can only be exercised by opening a browser
// is a game whose rules are never tested. tests/scooter-ride.test.mjs drives
// this file in Node over a synthetic straight route and checks that a hop
// clears a bench, that a bollard costs exactly HIT_PENALTY_S, and that a coin
// can only be taken once. None of that needs a renderer.
//
// The shape of the thing: the rider's position is one number, `s`, the arc
// length travelled along the centreline. Lateral position is a second number,
// `laneX`, metres left or right of it — steered freely between the track's
// painted edges, not snapped to lanes. Everything else — world x/z, heading,
// what you just hit — falls out of those two and the route polyline.

/* The scooter in the photograph is a Ninebot KickScooter ES2, and its real
   published top speed is 25 km/h. Using the actual number rather than a
   made-up one costs nothing and means the ride is paced like the machine it
   is drawn as. */
export const TOP_SPEED_MPS = 6.9;

/* You leave Argo already rolling. A standing start at 0 spends the first two
   seconds of the game watching nothing happen. */
export const START_SPEED_MPS = 3.0;

/* Reaches top speed in ~2.8 s from the kick-off, ~5 s from a dead stop after
   a hit. Slow enough that a hit is felt, fast enough that it is not a
   punishment you sit through. */
export const ACCEL_MPS2 = 1.4;

/* Half the track's painted width — the continuous edge stripes sit this far
   either side of the centreline, and the rider steers freely between them.
   The value is mirrored in scripts/build-corridor.mjs, which places the props
   against it; the file the runtime loads carries it, and that copy wins. */
export const TRACK_HALF_W = 1.725;

/* How fast holding A or D slides the rider across the track. 3.5 m/s crosses
   the whole rideable width in ~0.8 s — fast enough to dodge something seen
   late, slow enough to read as a lean rather than a teleport. */
export const STEER_MPS = 3.5;

/* A bunny hop: 0.55 m at the peak, over in 0.55 s. That clears a bench
   (0.46 m) and a cone (0.5 m) and does NOT clear a bollard (0.95 m) — which
   is the whole reason obstacles carry their own height. */
export const HOP_HEIGHT_M = 0.55;
export const HOP_S = 0.55;

/* How high the rider can reach for a coin from the deck. A coin at 0.9 m is
   free; the arc over a hoppable obstacle peaks at 1.45 m and can only be taken
   in the air. */
export const REACH_M = 1.0;

/* Half-width of the rider for the collision test — a person on a deck is
   about 0.64 m across at the shoulders. Collision is metric on purpose: clip
   the edge of something mid-dodge and you hit it, which is what makes a late
   dodge feel late. scripts/build-corridor.mjs folds this same number into its
   "every group leaves a gap the rider fits through" assertion, so a placed
   set of obstacles can never wall the track. */
export const RIDER_HALF_W = 0.32;

/* A hit costs three seconds on the clock and all of your speed. Both, because
   either alone is shruggable. */
export const HIT_PENALTY_S = 3.0;

/* A coin buys back half a second. Twelve coins undo a hit — so the run is
   about lines through the obstacles, not about avoiding them at all costs. */
export const COIN_BONUS_S = 0.5;

const LEFT_KEYS = ["a", "arrowleft"];
const RIGHT_KEYS = ["d", "arrowright"];
const HOP_KEYS = [" ", "w", "arrowup", "spacebar"];

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * World position and heading at arc length `s`, offset `laneX` metres to the
 * side.
 *
 * The centreline was resampled to a fixed spacing at build time precisely so
 * this is an index and a lerp rather than a search: at 60 fps over a 730 m
 * route a search would run 44,000 times a second to answer a question that
 * division already answers.
 */
export function positionAt(route, s, laneX = 0) {
  const pts = route.points;
  const step = route.spacing;
  const t = clamp(s, 0, (pts.length - 1) * step) / step;
  const i = Math.min(pts.length - 2, Math.floor(t));
  const f = t - i;
  const [ax, az] = pts[i];
  const [bx, bz] = pts[i + 1];
  const x = ax + (bx - ax) * f;
  const z = az + (bz - az) * f;

  /* Heading from the segment. The normal is the heading rotated a quarter
     turn; +laneX is to the rider's right. */
  const dx = bx - ax;
  const dz = bz - az;
  const len = Math.hypot(dx, dz) || 1;
  const nx = -dz / len;
  const nz = dx / len;

  return {
    x: x + nx * laneX,
    z: z + nz * laneX,
    heading: Math.atan2(dx, dz),
    tangent: { x: dx / len, z: dz / len },
    normal: { x: nx, z: nz },
  };
}

/**
 * Create a run.
 *
 * `route` and `game` come straight out of corridor-eighth-peterson.json. Nothing
 * is mutated on them — the arrays are read through cursors, and what has been
 * taken is tracked here, so the same loaded file can start a second run.
 */
export function createRide({ route, game, startSpeed = START_SPEED_MPS }) {
  /* Where the rider's centre may go: the deck stays on the track. */
  const span = (game.halfWidth ?? TRACK_HALF_W) - RIDER_HALF_W;

  /* Copied and sorted once. Copied per OBJECT, not just per array: collecting
     a coin tags it, and tagging the loaded file's own objects would mean the
     second run of a session started with every coin already taken. Sorted
     because the cursors below depend on it, and a run that quietly assumed
     the builder's order would break the first time someone hand-edited the
     file. */
  const obstacles = game.obstacles.map((o) => ({ ...o })).sort((a, b) => a.s - b.s);
  const coins = game.coins.map((c) => ({ ...c, taken: false })).sort((a, b) => a.s - b.s);

  const ride = {
    s: 0,
    laneX: 0,
    speed: startSpeed,
    y: 0, // metres above the deck's resting height
    hopT: null, // seconds into the current hop, or null on the ground
    time: 0,
    penalty: 0,
    coins: 0,
    hits: 0,
    finished: false,
    lastHit: null, // { kind, s } — the HUD flashes on this
  };

  /* Cursors, not filters: `s` only ever increases, so every obstacle and coin
     is considered exactly once, in order, for the whole run. */
  let oc = 0;
  let cc = 0;
  let prevHeld = new Set();

  const anyHeld = (held, keys) => keys.some((k) => held.has(k));

  /**
   * One tick.
   *
   * `counting` is what the opening shot rides on. The intro is not a still —
   * the scooter accelerates off the court and onto the pavement while the
   * camera comes down — and none of that should cost the rider a second. So the
   * physics run and the clock does not. It is a separate flag rather than
   * "rewind the clock afterwards" because the clock is what the run is scored
   * on, and a number that goes up and then back down is a number nobody can
   * trust while they are watching it.
   */
  function update(dt, held = new Set(), counting = true) {
    if (ride.finished || dt <= 0) return ride;
    if (counting) ride.time += dt;

    /* Steering is held, not tapped: A and D slide the rider across the track
       for as long as they are down, clamped at the painted edges. The hop
       stays edge-triggered — holding space is one hop, not a pogo stick. */
    const leftNow = anyHeld(held, LEFT_KEYS);
    const rightNow = anyHeld(held, RIGHT_KEYS);
    const hopNow = anyHeld(held, HOP_KEYS);
    if (hopNow && !anyHeld(prevHeld, HOP_KEYS) && ride.hopT == null) ride.hopT = 0;
    prevHeld = new Set(held);

    /* Lateral. Left and right cancel rather than fight. */
    const steer = (rightNow ? 1 : 0) - (leftNow ? 1 : 0);
    if (steer) ride.laneX = clamp(ride.laneX + steer * STEER_MPS * dt, -span, span);

    /* Vertical. */
    if (ride.hopT != null) {
      ride.hopT += dt;
      if (ride.hopT >= HOP_S) {
        ride.hopT = null;
        ride.y = 0;
      } else {
        ride.y = HOP_HEIGHT_M * Math.sin((Math.PI * ride.hopT) / HOP_S);
      }
    }

    /* Forward. */
    ride.speed = Math.min(TOP_SPEED_MPS, ride.speed + ACCEL_MPS2 * dt);
    const from = ride.s;
    ride.s = from + ride.speed * dt;

    /* Everything crossed this frame, in order. Crossing rather than a
       proximity window means an obstacle is tested exactly once however fast
       the rider is going and however long the frame was — no tuning, no
       double hits, nothing skipped on a stutter. */
    while (oc < obstacles.length && obstacles[oc].s <= ride.s) {
      const o = obstacles[oc++];
      if (o.s < from) continue; // already behind us at the start of the frame
      const sideways = Math.abs(ride.laneX - o.off);
      if (sideways > RIDER_HALF_W + o.w / 2) continue;
      if (ride.y > o.h) continue; // hopped it
      ride.hits++;
      ride.penalty += HIT_PENALTY_S;
      ride.speed = START_SPEED_MPS;
      ride.lastHit = { kind: o.kind, s: o.s, at: ride.time };
    }

    while (cc < coins.length && coins[cc].s <= ride.s) {
      const c = coins[cc++];
      if (c.s < from) continue;
      const sideways = Math.abs(ride.laneX - c.off);
      if (sideways > RIDER_HALF_W) continue;
      if (c.y > ride.y + REACH_M) continue; // out of reach without a hop
      c.taken = true;
      ride.coins++;
    }

    if (ride.s >= route.metres) {
      ride.s = route.metres;
      ride.finished = true;
    }
    return ride;
  }

  /** Elapsed clock: real seconds, plus what the hits cost, less what the coins bought. */
  const clock = () => Math.max(0, ride.time + ride.penalty - ride.coins * COIN_BONUS_S);

  return {
    get s() { return ride.s; },
    get laneX() { return ride.laneX; },
    get speed() { return ride.speed; },
    get y() { return ride.y; },
    get airborne() { return ride.hopT != null; },
    get coins() { return ride.coins; },
    get hits() { return ride.hits; },
    get finished() { return ride.finished; },
    get lastHit() { return ride.lastHit; },
    /* Which coins are gone, so the renderer can hide them. Same objects the
       caller passed in, tagged — cheaper than a parallel Set the renderer
       would have to look up per coin per frame. */
    coinList: coins,
    obstacleList: obstacles,
    update,
    clock,
    position: () => positionAt(route, ride.s, ride.laneX),
    status() {
      return {
        s: ride.s,
        remaining: Math.max(0, route.metres - ride.s),
        speed: ride.speed,
        laneX: ride.laneX,
        coins: ride.coins,
        hits: ride.hits,
        clock: clock(),
        par: game.par ?? null,
        finished: ride.finished,
      };
    },
  };
}
