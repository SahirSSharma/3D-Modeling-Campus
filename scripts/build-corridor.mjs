#!/usr/bin/env node
// Build the corridor worlds — one route each, cut out of the campus as a map
// of its own. There are two, and they are the same cut over different lines:
//
//   scooter → corridor-eighth-peterson.json — the shipped run, Eighth College
//             courts to Peterson Hall
//   staging → corridor-staging.json         — the SAME route, with no obstacles
//             and no coins. The work zone: same builder, same gates, its own
//             file, so a change tried out on it cannot reach the run people
//             ride, and nothing invented stands between you and the map.
//
// WHY THIS EXISTS. The site ships one world: the whole campus, ~10 MB of
// survey, free roam from 110 m up. That is the right shape for "look at the
// measured campus" and the wrong shape for a game. A scooter run down one
// 1 km route needs the opposite of breadth — it needs the few hundred metres
// either side of that route and nothing else, so it loads in a blink and every
// frame of attention lands on the part you are actually riding through.
//
// So this crops. It does not survey. Every ring, height, tree and colour in
// the output is copied verbatim from the files the measured builders already
// wrote; this script only decides what to keep. If it ever invents a piece of
// world geometry, it is broken.
//
// The one exception is deliberate and quarantined: `game` holds the obstacles,
// coins and track of the scooter run. Those ARE invented. They are seeded from
// a constant so the run is the same every time, they live under one key no
// measured consumer reads, and they are labelled as invented in the file, in
// the README and on screen. Nothing else in this file is a guess.
//
// What it emits — three cropped sub-documents that are drop-in replacements
// for their parents, so the runtime feeds them to the existing world builders
// unchanged:
//
//   campus  — campus-3d.json shape:    buildings, paths, surfaces, places
//   lidar   — campus-lidar.json shape: terrain grid, heights, trees
//   arcgis  — campus-arcgis.json shape: surveyed ground + massing, CROPPED IN
//             PLACE (dropped slots are null) because campus-eighth.js addresses
//             those arrays by index — see the note on the crop itself
//   colors  — campus-colors.json shape: terrain palette, roof + ground colour
//   eighth / markings / landmarks — carried whole; small, and keyed by name
//   route   — the centreline itself, resampled at a fixed spacing
//   game    — invented: the track width, obstacles, coins
//
// Usage:
//   node scripts/build-corridor.mjs                    # crop + write both
//   node scripts/build-corridor.mjs --check            # verify the shipped files
//   node scripts/build-corridor.mjs --target=staging   # just the one
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildGraph, routeThrough, smooth, resample, pushOutside, nearestNode, findRoute,
  nearestOnRing,
} from "../docs/js/campus-route.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(REPO_ROOT, "docs/data");
const CHECK = process.argv.includes("--check");

/* THE ROUTES, as lists of waypoints rather than pairs of endpoints.
 *
 * `scooter` starts dead centre on the Eighth College basketball court and works
 * north through Revelle to Peterson. Each waypoint is there because the route
 * is described by landmarks, not by coordinates: north out of the court into
 * the "fleet" — Revelle's halls are all named after research ships (Atlantis,
 * Galathea, Beagle, Meteor, Challenger, Discovery, and Argo itself) — past the
 * 64 Degrees dining hall, then east into Revelle Plaza and the long straight
 * north. It goes PAST Argo, not through it; see the note under WAYPOINTS.
 *
 * 64 Degrees is a BUILDING, not a bearing. Read as a compass heading it aims at
 * Pepper Canyon, 1.2 km the wrong way; the waypoint is what keeps the route on
 * the west side of Ridge Walk and actually among the halls.
 *
 * `staging` rides the SAME line. It exists so there is somewhere to try things,
 * not somewhere lesser — it goes through the same crop, the same gates and the
 * same test suite, and differs only in carrying no invented props. It was
 * briefly a shorter Argo->Peterson route, which made it a staging area that was
 * behind the thing it was staging for. Nothing here is route-specific except
 * this table.
 *
 *   startAt  a point the route must BEGIN on exactly, when the pedestrian graph
 *            has no node there (the middle of a court is not a path junction).
 *            null means "start wherever the router starts", which is what a
 *            route between two buildings wants.
 *   eighth   whether to carry the Eighth College survey. Only a route that
 *            passes through it should; carrying it otherwise would paint a
 *            basketball court half a kilometre off the line, and would drag in
 *            the index exemptions that exist to protect it.
 *   props    whether to place obstacles and coins at all. False is a deliberate
 *            empty, and check() holds the file and the spec to agreeing on it.
 *   metres   the range the finished route must land in. A window, not a
 *            number — the router is allowed to re-route around a retagged
 *            path — but narrow enough that a route through the wrong campus
 *            fails rather than silently ships.
 */
const COURT_CENTRE = { x: -174.55, z: 525.2, name: "Eighth College courts" };

/* THE DRAWN REFERENCE — the shape the run is supposed to have, and the only
 * thing that says so.
 *
 * Sahir has twice drawn the correct line onto an Apple Maps screenshot, and the
 * second time added: "just follow the image I attached... I may have mistyped
 * the exact building names." So the specification is a picture, not a list of
 * halls, and it is worth saying why that is the better instruction: the two
 * sources disagree about which hall is which. The building on the right of the
 * northbound straight is Galathea Hall in this repo's OSM data and Meteor Hall
 * on Apple's map. Routing on geometry needs neither label to be right.
 *
 * Derived, not eyeballed. The stroke is a distinct colour, so it was extracted
 * from the pixels: threshold for it, keep the largest connected component
 * (11,563 px — the rest are label fragments), take the geodesic path between
 * its two tips and re-centre each point on the local stroke centroid.
 *
 * The screenshot is north-up, so image to world is a scale and an offset. It
 * was fitted on two anchors — the Eighth courts centre (-174.55, 525.2 <-> px
 * 248, 828) and Argo Hall's footprint (x -58.6..-19.7, z 365.1..404.1 <-> px x
 * 785..965, y 87..267) — giving
 *
 *     x = -174.55 + (px - 248) * 0.216      z = 525.2 + (py - 828) * 0.216
 *
 * The two anchors agree on the scale to within 1% (0.2158 vs 0.2166 m/px),
 * which is the check that the fit is real and not two free parameters soaking
 * up error. It was then verified against geometry it was NOT fitted on: Argo's
 * footprint corners land within ~5 m, and so do 64 Degrees and Beagle Hall.
 *
 * Simplified to 0.6 m of the full 78-vertex trace. Total length 310 m.
 *
 * THIS IS A GATE, NOT GEOMETRY. Not one metre of it is shipped. The centreline
 * is still routed entirely over surveyed OSM footways; this only measures the
 * result, in `check`. Its own uncertainty is around 5 m — pixel reading plus
 * the width of the drawn stroke — which is why the tolerances below are what
 * they are and should not be tightened to flatter numbers. */
const DRAWN_REFERENCE = [
  [-181.5, 528.3], [-181.2, 532.3], [-178.3, 534.6], [-170.0, 534.5],
  [-168.1, 530.9], [-166.8, 514.8], [-162.8, 507.5], [-159.3, 505.4],
  [-155.4, 504.2], [-143.0, 504.0], [-135.1, 502.8], [-120.4, 496.1],
  [-112.3, 494.9], [-104.2, 495.5], [-96.5, 492.7], [-94.0, 489.8],
  [-95.7, 477.8], [-94.7, 453.2], [-90.2, 437.7], [-83.1, 427.8],
  [-78.1, 416.7], [-77.6, 408.6], [-75.8, 405.1], [-60.1, 402.2],
  [-35.7, 402.0], [-23.4, 403.3], [-19.5, 402.6], [-17.2, 399.7],
  [-17.4, 357.2],
];

/* Fidelity gates. The fitted route scores mean 2.9 m / worst 6.8 m, and the
   worst point is s = 0 — the court centre, where the drawn stroke's own start
   sits 7 m off the pinned start. These allow a little room above that and no
   more; they are not to be relaxed to admit a route that wanders. */
const DRAWN_MEAN_M = 5;
const DRAWN_WORST_M = 12;

/* WAYPOINTS ARE POINTS, NOT BUILDINGS.
 *
 * Naming a hall asks the router to reach its CENTROID, which is inside the
 * walls, and several hall-adjacent graph nodes are degree-1 entrance spurs
 * that turn a waypoint into an out-and-back. Both of those have already cost
 * this route once. A raw {x,z} is legal anywhere in the list, snaps to the
 * nearest node, and says exactly what the drawing says.
 *
 * Only two are needed, because the graph does the rest once the survey gap at
 * (-90.0, 480.7) is bridged (see BRIDGE_GAP_M): the corner where the line
 * stops going north and turns east below Argo, and the point up Argo's east
 * side where it turns for the plaza. Adding a third in the fleet corridor
 * changes nothing — measured, not assumed — so it is not there.
 *
 * "64 Degrees" USED TO BE HERE AND IS WRONG. It sits north-WEST of Argo, and
 * routing through it sent the line diagonally across the top of the plaza. The
 * drawing runs along Argo's south face and up its east side. That single
 * waypoint was most of the 39 m error. */
const WAYPOINTS = [
  COURT_CENTRE,
  { x: -76.7, z: 404.1, name: "below Argo, where the line turns east" },
  { x: -17.7, z: 373.6, name: "east of Argo, where it turns for the plaza" },
  "Revelle Plaza",
  "Peterson Hall",
];

/* ARGO HALL IS NOT A WAYPOINT, AND MUST NOT BECOME ONE AGAIN.
 *
 * It was, and the route drove 12 m through the building. Naming a building as a
 * waypoint asks the router to reach that building's CENTROID, which is inside
 * the walls by definition; the correct instruction is a pair of points on the
 * walkways that go round it, which is what WAYPOINTS now carries. The route
 * runs along Argo's south face and up its east side — it passes the building
 * rather than through it, and `check` walks the finished line against every
 * footprint to keep it that way.
 *
 * That was only half the fault. The other half was in campus-route.js: plaza
 * centre-spokes are an invented shortcut and four of the courtyard plaza's
 * eighteen ran straight through Argo. Both are fixed, and `check` now walks the
 * finished centreline against every footprint in the crop, so neither can come
 * back quietly. */
const ROUTES = {
  scooter: {
    target: "scooter",
    file: "corridor-eighth-peterson.json",
    label: "Eighth → Peterson",
    waypoints: WAYPOINTS,
    from: "Eighth College courts",
    to: "Peterson Hall",
    startAt: COURT_CENTRE,
    eighth: true,
    props: true,
    metres: [950, 1200],
  },
  /* THE BENCH. Same route, same crop, same gates — the difference is that it
     carries no obstacles and no coins, because what is being worked on is the
     map and the ride, and invented props are in the way of looking at either.
     It was briefly the old 732 m Argo->Peterson stretch, which made it a
     staging area that was behind what it was staging for. */
  staging: {
    target: "staging",
    file: "corridor-staging.json",
    label: "Eighth → Peterson (staging)",
    waypoints: WAYPOINTS,
    from: "Eighth College courts",
    to: "Peterson Hall",
    startAt: COURT_CENTRE,
    eighth: true,
    props: false,
    metres: [950, 1200],
  },
};

const TARGETS = Object.keys(ROUTES);

/* How far from the centreline still counts as "what you can see walking it".
   At 130 m the 1,048 m route keeps 68 buildings, 323 paths, 47 surfaces and
   331 trees out of 1395 / 3878 / 662 / 10664. It was 100 m when the route was
   the 732 m Argo->Peterson stretch; widening it is what puts the far side of
   Revelle Plaza and the fleet halls on screen instead of a wall of fog. Chosen
   by looking at what falls in and out of it, not by rounding. */
const CORRIDOR_M = 130;

/* Second tier. Beyond the corridor you can still SEE things, and a corridor
   that ends in bare terrain reads as a diorama on a table. Buildings out to
   here, tall enough to break the horizon, come along as plain massing so the
   route has a skyline. They are never walked to and carry no detail. */
const SKYLINE_M = 520;
const SKYLINE_MIN_H = 18;

/* Centreline resample spacing. Fixed, because the ride indexes the centreline
   by arc length — points[floor(s / SAMPLE_M)] is a lookup rather than a
   search, which is the whole reason to pay for a resample at build time. */
const SAMPLE_M = 2;

/* Terrain crop margin. The ground must not end anywhere the rider can see it
   end; 40 m past the corridor puts the seam well outside the chase camera's
   useful range. */
const TERRAIN_PAD_M = 40;

/* How far the centreline is kept off a wall. This must clear the whole TRACK,
   not just the rider: the painted edge sits half the track width off the line
   (1.725 m) and the stripe itself is 0.18 m wide, so anything under 1.815 m
   lets the visible edge of the track run inside a facade — which it did, for
   26 m along Argo Hall, while the centreline-only gate stayed green. 1.9 m is
   that geometry plus margin. Where a path genuinely runs tight to a facade,
   the line hugs it at this distance rather than being dragged off the path,
   because the path is the measured thing and this is a correction, not a
   re-survey. check() walks both track edges against every footprint, so a
   clearance that stops covering the width fails the build rather than
   shipping. */
const WALL_CLEARANCE_M = 1.9;

/* How far from a startAt point to look for a way onto the path network. The
   court's own nearest node is 12.7 m away at its SOUTH-WEST corner while the
   route heads north, so "nearest" sent the ride 12.6 m backwards and made it
   40 m before it was level with its own start line. 70 m is wide enough to
   reach the walkway on the far side of the court. */
const ENTRY_SEARCH_M = 70;
const ENTRY_CANDIDATES = 25;

/* THE LEAD-IN HAS TO EARN ITS LENGTH. It is the one stretch of centreline that
   is not a surveyed path, so a metre of it is worth less than a metre of real
   walkway and the search must not spend it freely. Unweighted, the totals come
   out flat — 18 m of lead-in scores 266 and 38 m scores 263 — and the search
   bought 19 extra metres of invention to save one metre of walking. At 1.5 the
   18 m entry wins comfortably, and it also wins at 2.0, so the choice is not
   balanced on the weight. */
const LEAD_IN_WEIGHT = 1.5;

/* How much of a break in the OSM footway survey to treat as a survey gap
   rather than a wall. See campus-route.js `bridgeSurveyGaps` for the rule and
   why it is opt-in; this is the only caller that turns it on.

   10 m is not a round number chosen for comfort — it is the smallest threshold
   that closes the break this route actually falls into. The north-south walk
   through the fleet ends at (-90.0, 480.7); the east-west walk above it passes
   8.8 m away at the same x. At 8 m the gap stays open and A* answers a 28 m
   question with a 148 m detour out west and back, which is the dogleg the
   drawn reference does not have. At 10 m the leg is 33.4 m against a 28.2 m
   straight line. Every bridge laid along the shipped line is recorded in
   `route.bridges` and re-checked by `check`. */
const BRIDGE_GAP_M = 10;

/* ------------------------------------------------------ the invented part */

/* One constant, so the run is the same run every time it is built. Change it
   and every obstacle on the route moves — which is exactly why it is pinned
   here rather than left to Math.random. */
const SEED = 0x5c007e2;

/* Clear ground at both ends: you get 30 m to roll off the basketball court and
   30 m to coast into Peterson. Nothing is placed inside either. */
const START_CLEAR_M = 30;
const FINISH_CLEAR_M = 30;

/* Minimum gap between obstacle groups. At the ES2's real 25 km/h cap (6.9 m/s)
   12 m is 1.7 seconds — enough to see the next group and pick a lane, which is
   the difference between a game and a coin flip. */
const OBSTACLE_GAP_M = 12;

/* What is actually in the way on a campus path. Kinds, not models: the runtime
   draws each one, this file only says which and where. `hop` is whether a
   bunny hop clears it — a bench yes, a bollard no.

   EVERY GROUP MUST LEAVE A WAY THROUGH. The rider steers freely across the
   track, so the guarantee is not "a lane stays open" but "a gap wide enough
   to ride stays open" — placeGame reserves the gap FIRST and fits obstacles
   into what is left, and check() re-derives the free interval from the placed
   widths rather than trusting that this happened. The first build of this
   file had a 1.7 m bench that read as one blocked slot and actually blocked
   two — a perfect line still took 28 hits — which is why the arithmetic is
   asserted rather than assumed. scooter-model.js draws each kind at exactly
   the width declared here. */
const OBSTACLE_KINDS = [
  { kind: "bench", w: 1.3, h: 0.46, hop: true },
  { kind: "cone", w: 0.4, h: 0.5, hop: true },
  { kind: "puddle", w: 1.2, h: 0.02, hop: true },
  { kind: "bollard", w: 0.24, h: 0.95, hop: false },
  { kind: "planter", w: 1.1, h: 0.8, hop: false },
  { kind: "sign", w: 0.9, h: 1.15, hop: false },
];

/* The rider's own half-width, mirrored from scooter-ride.js's RIDER_HALF_W.
   Used to prove every obstacle group leaves a gap the rider fits through. */
const RIDER_HALF_W = 0.32;

/* Half the track's painted width: the continuous edge stripes sit this far
   either side of the centreline, and the rider steers freely between them.
   The walkways on this route run roughly 3.5 m of pavement, so the edges sit
   near its edge and the scooter (0.5 m across the deck) stays on it. It is
   this envelope — not the centreline — that must stay out of buildings. */
const TRACK_HALF_W = 1.725;

/* The free gap reserved past every obstacle group, measured in RIDER-CENTRE
   space (the rider's own width is already folded in via RIDER_HALF_W). 0.5 m
   of centre positions means a dodge has real margin rather than one exact
   pixel-perfect line. check() asserts at 0.4 so float noise in placement
   cannot flap the gate. */
const FREE_GAP_M = 0.5;
const FREE_GAP_MIN_M = 0.4;

/* ---------------------------------------------------------------- helpers */

const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;

/* Seeded PRNG. Small, well-distributed enough for scattering props, and — the
   only property that matters here — identical on every machine and every run,
   which plain Math.random is not. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Distance from a point to the centreline, as the minimum distance to any of
 * its sampled points.
 *
 * Point distance rather than segment distance, on purpose: the centreline is
 * resampled at SAMPLE_M = 2 m, so the two answers differ by at most 1 m, and
 * using the same cheap measure in build() and check() means the check can
 * never disagree with the build about what is inside the corridor. A segment
 * measure here and a point measure there would produce a file that fails its
 * own gate on a boundary tree.
 */
function makeCorridor(points) {
  /* Bucketed by 64 m column so a vertex only tests the stretch of route it
     could possibly be near — 200k vertices against 393 route points is 78M
     distance tests otherwise, which is slow enough to notice. */
  const CELL = 64;
  const buckets = new Map();
  const key = (cx, cz) => `${cx},${cz}`;
  points.forEach((p, i) => {
    const cx = Math.floor(p.x / CELL);
    const cz = Math.floor(p.z / CELL);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const k = key(cx + dx, cz + dz);
        let list = buckets.get(k);
        if (!list) buckets.set(k, (list = []));
        list.push(i);
      }
    }
  });

  const distance = (x, z) => {
    const list = buckets.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
    let best = Infinity;
    const scan = list || points.map((_, i) => i);
    for (const i of scan) {
      const p = points[i];
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  };

  return {
    distance,
    /* A ring is kept whole if ANY vertex is inside. Keeping it whole is the
       point: a building sliced at the corridor edge is a wall with no back. */
    ringNear: (ring, radius, scale = 1) =>
      ring.some(([x, z]) => distance(x * scale, z * scale) <= radius),
  };
}

/** Crop a row-major height/index grid to a world-space rectangle. */
function cropGrid(grid, x0, x1, z0, z1, values) {
  const c0 = Math.max(0, Math.floor((x0 - grid.x0) / grid.cell));
  const c1 = Math.min(grid.cols - 1, Math.ceil((x1 - grid.x0) / grid.cell));
  const r0 = Math.max(0, Math.floor((z0 - grid.z0) / grid.cell));
  const r1 = Math.min(grid.rows - 1, Math.ceil((z1 - grid.z0) / grid.cell));
  const cols = c1 - c0 + 1;
  const rows = r1 - r0 + 1;
  if (cols < 2 || rows < 2) throw new Error("terrain crop collapsed — bad bounds");

  const out = new Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out[r * cols + c] = values[(r0 + r) * grid.cols + (c0 + c)];
    }
  }
  return {
    header: { x0: round1(grid.x0 + c0 * grid.cell), z0: round1(grid.z0 + r0 * grid.cell), cell: grid.cell, cols, rows },
    values: out,
  };
}

/* --------------------------------------------------------------- the ride */

/**
 * Scatter obstacles and coins along the route. INVENTED — see the file header.
 *
 * The invariants are what make an invented set of props defensible here, so
 * they are enforced at placement AND asserted again in check() and in
 * tests/corridor.test.mjs: nothing in the first or last stretch, every group
 * leaves a free gap the rider fits through, never two groups closer than
 * OBSTACLE_GAP_M.
 *
 * The rider steers freely across the track, so placement is gap-first: pick
 * where the way through IS, then fit one or two obstacles into the space that
 * is left. Building the gap by construction beats placing obstacles and
 * hoping — and check() still re-derives the free interval from the placed
 * widths rather than trusting this comment.
 */
function placeGame(route, rng, props = true) {
  const obstacles = [];
  const coins = [];
  const end = route.metres - FINISH_CLEAR_M;
  /* Where the rider's CENTRE can be: the deck must stay on the track. */
  const span = TRACK_HALF_W - RIDER_HALF_W;

  /* props:false leaves both arrays empty and every other field intact. The
     track, the par and the clearances are still what they are; there is simply
     nothing invented standing on the route. That is what the staging corridor
     wants — you cannot judge the map through a slalom. */
  let s = props ? START_CLEAR_M : end;
  while (s < end) {
    s += OBSTACLE_GAP_M + rng() * 10;
    if (s >= end) break;

    /* The way through, first: a FREE_GAP_M window of rider-centre positions,
       anywhere it fits. Obstacles only ever go in what is left of the track
       either side of it. */
    const g = (rng() * 2 - 1) * (span - FREE_GAP_M / 2);

    /* One or two obstacles. A flat 35% chance of two reads as a rhythm rather
       than a difficulty curve — a curve over a route this short would just be
       the last third being unfair. */
    const count = rng() < 0.35 ? 2 : 1;
    const placed = [];
    for (let n = 0; n < count; n++) {
      const spec = OBSTACLE_KINDS[Math.floor(rng() * OBSTACLE_KINDS.length)];
      /* Where this obstacle's centre may go: fully on the track, and its
         swept width (its own plus the rider's) clear of the free window. */
      const lo = -TRACK_HALF_W + spec.w / 2;
      const hi = TRACK_HALF_W - spec.w / 2;
      const keep = FREE_GAP_M / 2 + RIDER_HALF_W + spec.w / 2;
      const left = [lo, Math.min(hi, g - keep)];
      const right = [Math.max(lo, g + keep), hi];
      const rooms = [left, right].filter(([a, b]) => b - a > 0);
      if (!rooms.length) continue;
      const room = rooms[Math.floor(rng() * rooms.length)];
      const off = round2(room[0] + rng() * (room[1] - room[0]));
      /* Two obstacles may share a side, but not each other's footprint — a
         bench drawn through a planter is the defect this whole pass exists
         to remove. */
      if (placed.some((p) => Math.abs(p.off - off) < (p.w + spec.w) / 2 + 0.1)) continue;
      placed.push({ off, w: spec.w });
      obstacles.push({
        s: round1(s),
        off,
        kind: spec.kind,
        w: spec.w,
        h: spec.h,
        hop: spec.hop,
        /* A little yaw so a row of benches is not copies of one bench.
           Rendering only; collision uses the offset, not the angle. */
        spin: round2((rng() - 0.5) * 0.5),
      });
      /* A hoppable obstacle gets an arc of coins over it — the reward for
         taking the hard line instead of going round. */
      if (spec.hop && rng() < 0.7) {
        for (let k = -1; k <= 1; k++) {
          coins.push({ s: round1(s + k * 1.6), off, y: round2(0.9 + (k === 0 ? 0.55 : 0.2)) });
        }
      }
    }

    /* A run of coins down the free window, starting a little past the group
       so it pulls you out the far side rather than into it. */
    if (rng() < 0.75) {
      const runLen = 4 + Math.floor(rng() * 4);
      for (let k = 0; k < runLen; k++) {
        const cs = s + 5 + k * 2.5;
        if (cs > end) break;
        coins.push({ s: round1(cs), off: round2(g), y: 0.9 });
      }
    }
  }

  coins.sort((a, b) => a.s - b.s || a.off - b.off || a.y - b.y);
  obstacles.sort((a, b) => a.s - b.s || a.off - b.off);

  return {
    invented: "Obstacles and coins are placed by this builder, not surveyed. "
      + "The campus they sit in is measured; these are not.",
    props,
    seed: SEED,
    halfWidth: TRACK_HALF_W,
    startClear: START_CLEAR_M,
    finishClear: FINISH_CLEAR_M,
    /* Par: the route at the ES2's real top speed, plus 15% for the dodges
       and hops you cannot take at full tilt. */
    par: round1((route.metres / 6.9) * 1.15),
    obstacles,
    coins,
  };
}

/** Even-odd point-in-polygon, for asking whether the route is inside a wall. */
function pointInRing(x, z, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * The graph node to start the ride from: the one that minimises lead-in plus
 * onward leg, rather than the one that happens to be closest.
 *
 * @returns {{x:number,z:number,name:string}} a waypoint to hand routeThrough
 */
function bestEntry(campus, graph, spec) {
  const start = spec.startAt;
  const next = spec.waypoints[1];
  const goalPoint = typeof next === "string" ? campus.places[next] : next;
  if (!goalPoint) throw new Error(`the waypoint after ${start.name} is not a known place`);
  const goal = nearestNode(graph, goalPoint.x, goalPoint.z).index;

  const near = [];
  graph.nodes.forEach((n, i) => {
    const d = Math.hypot(n.x - start.x, n.z - start.z);
    if (d <= ENTRY_SEARCH_M) near.push({ i, d });
  });
  near.sort((a, b) => a.d - b.d);

  let best = null;
  for (const { i, d } of near.slice(0, ENTRY_CANDIDATES)) {
    const leg = findRoute(graph, i, goal);
    if (!leg) continue;
    const total = d * LEAD_IN_WEIGHT + leg.metres;
    if (!best || total < best.total) best = { total, i, d };
  }
  if (!best) throw new Error(`no way onto the path network within ${ENTRY_SEARCH_M} m of ${start.name}`);

  const n = graph.nodes[best.i];
  return { x: n.x, z: n.z, name: start.name };
}

/* How hard the line may turn in one 2 m step before relaxTurns works on it.
   20° per 2 m is a ~5.7 m turning radius — an easy lean on a scooter, and the
   difference between a corner and an elbow on screen. Corners beside a wall
   cannot always reach it: a move is only accepted at full WALL_CLEARANCE_M, so
   the Argo corner rounds as far as the clearance allows and no further. */
const MAX_TURN_DEG_PER_M = 10;
const RELAX_ROUNDS = 200;

/**
 * Spread sharp corners over more of the line, without ever giving back wall
 * clearance. Chaikin cannot do this: its cut spans one segment, so on a dense
 * polyline a 90° path intersection stays a 40°+ elbow however many passes run.
 * This instead nudges only the points that turn harder than the cap toward the
 * midpoint of their neighbours — classic Laplacian relaxation, but selective,
 * and a nudge that would land inside a footprint or closer to one than
 * `clearance` is simply not taken. Straight stretches never move at all, so
 * the drawn-line match is disturbed only where the corner itself is, and the
 * gates measure the result.
 */
function relaxTurns(points, rings, clearance, maxDegPerM = MAX_TURN_DEG_PER_M) {
  const pts = points.map((p) => ({ x: p.x, z: p.z }));
  const maxRadPerM = (maxDegPerM * Math.PI) / 180;
  const clear = (x, z) => {
    for (const ring of rings) {
      if (pointInRing(x, z, ring)) return false;
      if (nearestOnRing(x, z, ring).distance < clearance) return false;
    }
    return true;
  };
  for (let round = 0; round < RELAX_ROUNDS; round++) {
    let moved = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1], b = pts[i], c = pts[i + 1];
      const a1 = Math.atan2(b.z - a.z, b.x - a.x);
      const a2 = Math.atan2(c.z - b.z, c.x - b.x);
      let turn = Math.abs(a2 - a1);
      if (turn > Math.PI) turn = 2 * Math.PI - turn;
      /* Curvature, not raw angle: the same corner is many small turns on a
         dense polyline and one large one on a sparse one. Per metre of the
         two segments that meet here, it is the same number either way. */
      const metres = (Math.hypot(b.x - a.x, b.z - a.z) + Math.hypot(c.x - b.x, c.z - b.z)) / 2;
      if (turn <= maxRadPerM * Math.max(metres, 0.05)) continue;
      const nx = b.x * 0.5 + (a.x + c.x) * 0.25;
      const nz = b.z * 0.5 + (a.z + c.z) * 0.25;
      if (!clear(nx, nz)) continue;
      pts[i] = { x: nx, z: nz };
      moved++;
    }
    if (!moved) break;
  }
  return pts;
}

/* ---------------------------------------------------------------- the cut */

function centreline(campus, spec) {
  const graph = buildGraph(campus, { bridgeGaps: BRIDGE_GAP_M });

  /* WHERE THE RIDE JOINS THE PATH NETWORK.
   *
   * Not the nearest node. The nearest node to the middle of the basketball
   * court is 12.7 m away at its SOUTH-WEST corner, and the route from there
   * heads north — so the ride opened by driving 12.6 m backwards, turning
   * round, and passing its own start line again 40 m in. On the map that is a
   * hook on the front of the route; on the scooter it is the first thing you
   * see, and it is not what "out of the courts and north" means.
   *
   * So choose the entry that makes the whole journey shortest: the onward leg
   * plus the lead-in, the latter weighted because it is invented (see
   * LEAD_IN_WEIGHT). Doubling back is longer than not doubling back, so this
   * removes the hook by construction rather than by detecting it. Only the
   * FIRST leg is routed per candidate —
   * the choice of entry cannot affect anything past the first waypoint, and
   * routing the whole 1 km per candidate would cost 40x for no information.
   */
  const entry = spec.startAt ? bestEntry(campus, graph, spec) : null;
  const waypoints = entry ? [entry, ...spec.waypoints.slice(1)] : spec.waypoints;

  const found = routeThrough(campus, graph, waypoints);
  if (!found) throw new Error(`no route through ${waypoints.length} waypoints`);

  /* THE LEAD-IN: the straight line from the true centre of the court out to
     that entry node, so the ride genuinely begins in the middle of the slab
     rather than at its edge.

     This is the one segment of centreline that is not a surveyed path, and it
     is a straight line across the middle of a paved court that the survey
     already draws. It invents no geometry; it only says where the ride starts.

     Only for a route that names a startAt. A route that begins at a building
     begins where the router put it, which is already a real path node. */
  const first = found.points[0];
  const gap = spec.startAt
    ? Math.hypot(first.x - spec.startAt.x, first.z - spec.startAt.z)
    : 0;
  const lead = [];
  if (spec.startAt && gap > SAMPLE_M) {
    const steps = Math.ceil(gap / SAMPLE_M);
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      lead.push({
        x: spec.startAt.x + (first.x - spec.startAt.x) * t,
        z: spec.startAt.z + (first.z - spec.startAt.z) * t,
      });
    }
  }

  /* Smoothed BEFORE the resample so the corners are cut, then resampled to the
     fixed spacing the ride indexes by. The lead-in joins ahead of the smoothing
     so the turn off the court is rounded like every other corner. */
  /* Smoothed against the footprints, not blind to them — see smooth()'s own
     note. Only buildings within 60 m of the routed line can possibly be reached
     by a corner cut, and testing all 1,395 of them per corner per pass is the
     difference between instant and not. */
  const box = found.points.reduce((b, p) => ({
    x0: Math.min(b.x0, p.x - 60), x1: Math.max(b.x1, p.x + 60),
    z0: Math.min(b.z0, p.z - 60), z1: Math.max(b.z1, p.z + 60),
  }), { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity });
  const avoid = campus.buildings
    .filter((b) => b?.p?.length >= 3
      && b.p.some(([x, z]) => x >= box.x0 && x <= box.x1 && z >= box.z0 && z <= box.z1))
    .map((b) => b.p);

  /* Smooth, push off the walls — then DENSIFY and smooth again. The first
     smoothing works on the sparse graph polyline, where a corner beside a
     building cannot be cut at all: the cut chord lands inside the footprint,
     the avoid rule refuses it, and the corner ships as an elbow — beside Argo
     Hall it measured 122° over one 2 m step. Resampling to 2 m first makes
     every cut tiny, so rounding a corner never strays more than centimetres
     toward the wall and the turn spreads over several steps instead of one.
     A final push restores the clearance the fine rounding shaved off, and the
     gates judge the outcome: the drawn-line match and the edge-intrusion walk
     both run on what ships. */
  let line = smooth([...lead, ...found.points], 2, avoid);
  line = pushOutside(line, avoid, WALL_CLEARANCE_M);
  line = smooth(resample(line, SAMPLE_M), 3, avoid);
  line = pushOutside(line, avoid, WALL_CLEARANCE_M);
  line = relaxTurns(line, avoid, WALL_CLEARANCE_M);
  const points = resample(line, SAMPLE_M);

  /* Chaikin pulls the very first point off the exact centre. Put it back: the
     promise "s = 0 is the middle of the court" is the whole reason for the
     lead-in, and tests/corridor.test.mjs holds it to 0.1 m. */
  if (spec.startAt) points[0] = { x: spec.startAt.x, z: spec.startAt.z };

  /* Which inferred links the shipped line actually uses. The graph offers 208
     of them campus-wide; declaring only the ones this centreline crosses is the
     difference between "the router had a bridge available" and "you ride over
     one", and it is the latter a reader of this file needs to know. */
  const bridges = graph.bridges.filter(({ from, to }) => {
    const mx = (from[0] + to[0]) / 2, mz = (from[1] + to[1]) / 2;
    return points.some((p) => Math.hypot(p.x - mx, p.z - mz) <= BRIDGE_GAP_M);
  });

  return {
    from: spec.from,
    to: spec.to,
    via: spec.waypoints.map((w) => (typeof w === "string" ? w : w.name)),
    metres: round1((points.length - 1) * SAMPLE_M),
    routedMetres: round1(found.metres),
    leadInM: round1(gap),
    spacing: SAMPLE_M,
    bridges,
    points: points.map((p) => [round1(p.x), round1(p.z)]),
  };
}

function build(sources, spec = ROUTES.scooter) {
  const { campus, lidar, arcgis, colors, facades, markings, landmarks } = sources;
  /* Only the route that runs through Eighth College carries its survey. */
  const eighth = spec.eighth ? sources.eighth : null;
  const route = centreline(campus, spec);
  const near = makeCorridor(route.points.map(([x, z]) => ({ x, z })));

  /* ---- campus-3d.json: buildings, paths, surfaces, places ---- */
  /* The index map is the whole trick and the easiest thing to get wrong:
     colors.buildings, lidar.osmHeights and lidar.partHeights are all keyed by
     the ORIGINAL building index. Filter the buildings without remapping those
     and every building in the corridor silently wears another building's
     height and colour. */
  const buildingMap = new Map(); // old index -> new index
  const buildings = [];
  campus.buildings.forEach((b, i) => {
    if (!near.ringNear(b.p, CORRIDOR_M)) return;
    buildingMap.set(i, buildings.length);
    buildings.push(b);
  });

  const paths = campus.paths.filter((p) => near.ringNear(p.p, CORRIDOR_M));
  const surfaces = campus.surfaces.filter((s) => near.ringNear(s.p, CORRIDOR_M));

  const places = {};
  for (const name of Object.keys(campus.places).sort()) {
    const p = campus.places[name];
    if (name === route.from || name === route.to || near.distance(p.x, p.z) <= CORRIDOR_M) {
      places[name] = p;
    }
  }

  /* ---- campus-lidar.json: heights, trees, terrain ---- */
  const osmHeights = {};
  for (const [old, next] of buildingMap) {
    const h = lidar.osmHeights?.[old];
    if (h != null) osmHeights[next] = h;
  }
  const partHeights = {};
  for (const [key, h] of Object.entries(lidar.partHeights || {})) {
    const [oldIdx, part] = key.split("/");
    const next = buildingMap.get(Number(oldIdx));
    if (next != null) partHeights[`${next}/${part}`] = h;
  }

  const trees = lidar.trees.filter((t) => near.distance(t[0], t[1]) <= CORRIDOR_M);

  const xs = route.points.map((p) => p[0]);
  const zs = route.points.map((p) => p[1]);
  const pad = CORRIDOR_M + TERRAIN_PAD_M;
  const bounds = {
    x0: Math.min(...xs) - pad, x1: Math.max(...xs) + pad,
    z0: Math.min(...zs) - pad, z1: Math.max(...zs) + pad,
  };

  const terrain = cropGrid(lidar.terrain, bounds.x0, bounds.x1, bounds.z0, bounds.z1, lidar.terrain.z);

  /* ---- campus-arcgis.json: surveyed ground + massing ---- */
  /* Decimetre integers in this file, hence the 0.1 scale on the distance test.
   *
   * CROPPED IN PLACE, NOT COMPACTED. These two arrays are addressed by INDEX
   * from outside themselves and a renumbering is silent:
   *
   *   campus-eighth.js:298  arcgisRing(arcgis, index) -> arcgis.ground[index]
   *   campus-eighth.js:509  arcgisRing(arcgis, 1761)          — hard-coded
   *   campus-eighth.js:421  painted.has(`arcgis.ground#${i}`) — matched against
   *                         the "registration" strings in campus-eighth.json,
   *                         e.g. the basketball court is arcgis.ground#3898
   *
   * Compact the array and Eighth College quietly rebuilds itself out of
   * whichever rings happen to land on those numbers — the court under the
   * ride's own start line. So a dropped slot becomes `null` and every surviving
   * ring keeps the index it was measured at. colors.ground / colors.massing
   * stay index-parallel for free, and the holes cost about 5 bytes each.
   *
   * campus-ground.js's prepareGround skips the nulls; every other consumer
   * reaches in by index and never sees them.
   */
  /* Rings Eighth College needs whatever the distance says. Most of its 74
     registered polygons sit under the start line and survive the corridor test
     anyway — but not all of them (#4074 is outside 130 m), and a missing one
     leaves a hole in the college the ride begins in. Derived from the survey's
     own `registration` strings rather than hand-listed, plus the two indices
     campus-eighth.js hard-codes in its EXTRA table (:205-208), which no data
     file mentions. */
  const eighthNeeds = new Set(eighth ? [1761, 1160] : []);
  for (const section of [eighth?.ground, eighth?.buildings]) {
    for (const entry of Object.values(section || {})) {
      for (const m of String(entry?.registration || "").matchAll(/arcgis\.ground#(\d+)/g)) {
        eighthNeeds.add(Number(m[1]));
      }
    }
  }

  const ground = (arcgis?.ground || []).map((g, i) => {
    if (!g?.r?.[0]) return null;
    if (eighthNeeds.has(i)) return g;
    return near.ringNear(g.r[0], CORRIDOR_M, 0.1) ? g : null;
  });
  const groundColors = ground.map((g, i) => (g ? colors?.ground?.[i] ?? null : null));

  const massing = (arcgis?.massing || []).map(
    (m) => (m?.r?.[0] && near.ringNear(m.r[0], CORRIDOR_M, 0.1) ? m : null)
  );
  const massingColors = massing.map((m, i) => (m ? colors?.massing?.[i] ?? null : null));

  /* ---- the skyline tier ---- */
  /* Outside the corridor, inside SKYLINE_M, and tall enough to be worth
     drawing: the horizon you actually see from the route. Carried as plain
     rings + a height, not as buildings — nothing walks to them. */
  const skyline = [];
  (arcgis?.massing || []).forEach((m, i) => {
    if (!m?.r?.[0]) return;
    if (near.ringNear(m.r[0], CORRIDOR_M, 0.1)) return; // already in the corridor
    if ((m.h ?? 0) < SKYLINE_MIN_H) return;
    if (!near.ringNear(m.r[0], SKYLINE_M, 0.1)) return;
    skyline.push({
      n: m.n,
      h: m.h,
      r: m.r[0].map(([x, z]) => [round1(x / 10), round1(z / 10)]),
      c: colors?.massing?.[i] ?? null,
    });
  });
  skyline.sort((a, b) => (a.n || "").localeCompare(b.n || "") || a.h - b.h);

  /* ---- campus-colors.json: terrain palette + roof colours ---- */
  const idx = Array.from(Buffer.from(colors.terrain.idx, "base64"));
  const colorGrid = cropGrid(colors.terrain, bounds.x0, bounds.x1, bounds.z0, bounds.z1, idx);
  const buildingColors = [];
  for (const [old] of [...buildingMap].sort((a, b) => a[1] - b[1])) {
    buildingColors.push(colors?.buildings?.[old] ?? null);
  }

  const game = placeGame(route, mulberry32(SEED), spec.props !== false);

  return {
    _: `${route.from} -> ${route.to}, cut out of the measured campus by `
      + "scripts/build-corridor.mjs. The world here is a CROP: every ring, height, tree "
      + "and colour is copied verbatim from campus-3d/lidar/arcgis/colors.json and nothing "
      + "is surveyed, moved or guessed. The `game` key is the exception and is invented — "
      + "see game.invented.",
    built: {
      target: spec.target,
      from: route.from,
      to: route.to,
      corridorM: CORRIDOR_M,
      skylineM: SKYLINE_M,
      seed: SEED,
    },
    route,
    game,
    campus: {
      origin: campus.origin,
      buildings,
      paths,
      surfaces,
      places,
    },
    lidar: {
      datum: lidar.datum,
      terrain: { ...terrain.header, z: terrain.values },
      heights: lidar.heights,
      partHeights,
      massHeights: lidar.massHeights,
      osmHeights,
      trees,
    },
    arcgis: {
      ground,
      buildings: arcgis?.buildings ?? {},
      massing,
      geiselFloors: [],
    },
    colors: {
      terrain: {
        ...colorGrid.header,
        palette: colors.terrain.palette,
        idx: Buffer.from(Uint8Array.from(colorGrid.values)).toString("base64"),
      },
      buildings: buildingColors,
      massing: massingColors,
      ground: groundColors,
    },
    skyline,
    facades,
    /* Carried WHOLE, not cropped. All three are small (139 / 31 / 18 KB), all
       three are addressed by name or by their own internal keys rather than by
       position, and cropping them would buy a few kilobytes in exchange for a
       second index-remapping problem. The Eighth survey in particular is what
       paints the basketball court the ride starts on. */
    eighth,
    markings,
    landmarks,
  };
}

function summarize(doc) {
  return [
    `${doc.route.metres} m ${doc.route.from} -> ${doc.route.to}`,
    `${doc.campus.buildings.length} buildings`,
    `${doc.arcgis.massing.filter(Boolean).length} masses`,
    `${doc.arcgis.ground.filter(Boolean).length} ground polygons`,
    `${doc.lidar.trees.length} trees`,
    `${doc.skyline.length} skyline`,
    `${doc.game.obstacles.length} obstacles`,
    `${doc.game.coins.length} coins`,
  ].join(" · ");
}

/* -------------------------------------------------------------- the gates */

function check(doc, sources, spec = ROUTES.scooter) {
  const fail = (msg) => { throw new Error(msg); };
  const { campus } = sources;

  /* The file has to be the one this spec describes. Cheap, and it is the
     assertion that catches the staging build being written over the shipped
     run — the two documents are the same shape, so nothing else would. */
  if (doc.built?.target !== spec.target) {
    fail(`this file says target "${doc.built?.target}", expected "${spec.target}"`);
  }
  if (doc.route.from !== spec.from || doc.route.to !== spec.to) {
    fail(`this file routes ${doc.route.from} -> ${doc.route.to}, expected ${spec.from} -> ${spec.to}`);
  }

  /* The route is the whole premise. Where the spec names a startAt it must
     begin on that exact spot — not near it, ON it, because that is where the
     intro orbit puts the camera and where the rider is told they start. */
  const first = doc.route.points[0];
  const last = doc.route.points[doc.route.points.length - 1];
  const gap = (p, q) => Math.hypot(p[0] - q.x, p[1] - q.z);
  if (spec.startAt) {
    const startMiss = gap(first, spec.startAt);
    if (startMiss > 0.1) fail(`route starts ${startMiss.toFixed(2)} m off ${spec.startAt.name}`);
  } else {
    const a = campus.places[spec.from];
    if (!a) fail(`${spec.from} is not a known place`);
    if (gap(first, a) > 40) fail(`route starts ${gap(first, a).toFixed(1)} m from ${spec.from}`);
  }
  const b = campus.places[spec.to];
  if (gap(last, b) > 25) fail(`route ends ${gap(last, b).toFixed(1)} m from ${spec.to}`);
  const [lo, hi] = spec.metres;
  if (doc.route.metres < lo || doc.route.metres > hi) {
    fail(`route is ${doc.route.metres} m — expected ${lo}-${hi} m`);
  }
  if (doc.route.spacing !== SAMPLE_M) fail("route spacing is not the fixed sample");

  /* THE ROUTE IS THE SHAPE THAT WAS DRAWN.
   *
   * Every gate above says the route is legal. None of them says it is the right
   * route — the old line started in the right place, ended in the right place,
   * was the right length and touched no building, and was still 39 m away from
   * where it was supposed to go. "Looks right on the site" is not a gate, and
   * asking Sahir to re-draw the line a third time is not a process.
   *
   * So the drawn line is the gate. Measured over the extent the drawing covers
   * — from the start to the route point nearest the drawing's last vertex,
   * because the drawing stops at the edge of its screenshot while the route
   * carries on another 700 m to Peterson, and beyond that edge there is nothing
   * to compare against. */
  {
    const ref = DRAWN_REFERENCE;
    const end = ref[ref.length - 1];
    const devAt = (x, z) => {
      let best = Infinity;
      for (let i = 0; i < ref.length - 1; i++) {
        const [ax, az] = ref[i];
        const [bx, bz] = ref[i + 1];
        const vx = bx - ax, vz = bz - az;
        const L = vx * vx + vz * vz;
        let t = L ? ((x - ax) * vx + (z - az) * vz) / L : 0;
        t = Math.max(0, Math.min(1, t));
        best = Math.min(best, Math.hypot(x - (ax + t * vx), z - (az + t * vz)));
      }
      return best;
    };

    let cut = 0, cutMiss = Infinity;
    doc.route.points.forEach(([x, z], i) => {
      const d = Math.hypot(x - end[0], z - end[1]);
      if (d < cutMiss) { cutMiss = d; cut = i; }
    });

    let sum = 0, worst = 0, worstAt = 0;
    for (let i = 0; i <= cut; i++) {
      const d = devAt(doc.route.points[i][0], doc.route.points[i][1]);
      sum += d;
      if (d > worst) { worst = d; worstAt = i * SAMPLE_M; }
    }
    const mean = sum / (cut + 1);
    if (mean > DRAWN_MEAN_M) {
      fail(`route averages ${mean.toFixed(1)} m from the drawn line over its first `
        + `${cut * SAMPLE_M} m — allowed ${DRAWN_MEAN_M} m`);
    }
    if (worst > DRAWN_WORST_M) {
      fail(`route is ${worst.toFixed(1)} m from the drawn line at ${worstAt} m `
        + `— allowed ${DRAWN_WORST_M} m`);
    }

    /* AND IT ONLY EVER GOES FORWARDS ALONG IT.
     *
     * Deviation alone cannot see a doubling-back: a route that runs 20 m up the
     * corridor, returns, and runs up again is never far from the drawn line and
     * is a hook you ride round. This is the same defect as the 12.6 m backwards
     * start that bestEntry exists to prevent, arriving mid-route instead —
     * every waypoint that snapped to a degree-1 entrance spur produced one. So
     * project onto the drawn line and require the projection never to retreat.
     *
     * The 2 m allowance is projection noise at the corners, where a point can
     * legitimately be nearest to either arm; it is far below the 12 m and 20 m
     * out-and-backs the spur waypoints actually produced. */
    const along = (x, z) => {
      let best = Infinity, at = 0, run = 0;
      for (let i = 0; i < ref.length - 1; i++) {
        const [ax, az] = ref[i];
        const [bx, bz] = ref[i + 1];
        const vx = bx - ax, vz = bz - az;
        const L = Math.hypot(vx, vz);
        let t = L ? ((x - ax) * vx + (z - az) * vz) / (L * L) : 0;
        t = Math.max(0, Math.min(1, t));
        const d = Math.hypot(x - (ax + t * vx), z - (az + t * vz));
        if (d < best) { best = d; at = run + t * L; }
        run += L;
      }
      return at;
    };
    let peak = 0, back = 0, backAt = 0;
    for (let i = 0; i <= cut; i++) {
      const s = along(doc.route.points[i][0], doc.route.points[i][1]);
      if (s < peak - back) { back = peak - s; backAt = i * SAMPLE_M; }
      peak = Math.max(peak, s);
    }
    if (back > 2) {
      fail(`route doubles back ${back.toFixed(1)} m along the drawn line at ${backAt} m`);
    }
  }

  /* THE INFERRED LINKS ARE DECLARED AND SMALL.
   *
   * Bridging a survey gap is the one place this builder adds connectivity that
   * OSM does not record, so the shipped file has to name every one the line
   * crosses and they have to stay the size of a gap rather than the size of a
   * shortcut. */
  for (const b of doc.route.bridges || []) {
    if (b.metres > BRIDGE_GAP_M) {
      fail(`the route crosses an inferred link of ${b.metres} m — the limit is ${BRIDGE_GAP_M} m`);
    }
    for (const f of doc.campus.buildings) {
      if (!f?.p) continue;
      if (pointInRing((b.from[0] + b.to[0]) / 2, (b.from[1] + b.to[1]) / 2, f.p)) {
        fail(`an inferred link runs inside ${f.n || "an unnamed building"}`);
      }
    }
  }

  /* THE ROUTE DOES NOT GO THROUGH BUILDINGS.
   *
   * The one that actually happened: the shipped run drove 12 m inside Argo Hall
   * and 2 m inside Challenger, because campus-route.js joins every plaza
   * perimeter vertex to the plaza centre and the courtyard plaza's ring wraps
   * Argo — four of its eighteen spokes were straight lines through a residence
   * hall. Naming "Argo Hall" as a waypoint made it worse, since a building
   * waypoint routes to the building's centroid.
   *
   * Both causes are fixed. This is the assertion that keeps them fixed: walk
   * the finished centreline, after smoothing, against every footprint the crop
   * carries. Smoothing matters — Chaikin cuts corners, so a route that clears a
   * building as a polyline can still clip it once rounded, and this runs on the
   * geometry that actually ships. */
  {
    const hits = new Map();
    const hit = (x, z, what) => {
      for (const b of doc.campus.buildings) {
        if (!b?.p || !pointInRing(x, z, b.p)) continue;
        const key = `${what} inside ${b.n || "an unnamed building"}`;
        hits.set(key, (hits.get(key) || 0) + 1);
      }
    };
    const pts = doc.route.points;
    for (let i = 0; i < pts.length; i++) {
      const [x, z] = pts[i];
      hit(x, z, "the centreline runs");
      /* The track is TRACK_HALF_W wide either side of the line, and it was the
         EDGE — never the centreline — that ran 26 m along the inside of Argo
         Hall while this gate stayed green. So walk both edges too, offset
         perpendicular to the local direction of travel. */
      const [px, pz] = pts[Math.max(0, i - 1)];
      const [nx, nz] = pts[Math.min(pts.length - 1, i + 1)];
      const len = Math.hypot(nx - px, nz - pz) || 1;
      const ox = -(nz - pz) / len;
      const oz = (nx - px) / len;
      hit(x + ox * TRACK_HALF_W, z + oz * TRACK_HALF_W, "the track's edge runs");
      hit(x - ox * TRACK_HALF_W, z - oz * TRACK_HALF_W, "the track's edge runs");
    }
    if (hits.size) {
      const worst = [...hits].map(([n, c]) => `${n} (${c * SAMPLE_M} m)`).join(", ");
      fail(`${worst} — the track must go round buildings, not through them`);
    }
  }

  /* The Eighth survey travels with exactly the route that runs through it. A
     corridor that carries it without passing it paints a basketball court half
     a kilometre off the line; one that passes it without carrying it starts the
     ride on bare terrain. Both are silent on screen, so assert it here. */
  if (spec.eighth && !doc.eighth) fail("this route runs through Eighth College but carries no survey of it");
  if (!spec.eighth && doc.eighth) fail("this route does not reach Eighth College but carries its survey");

  /* Every waypoint has to actually be on the route. This is what stops the
     router quietly taking Ridge Walk on the far side of the fleet the day a
     path is retagged — the shape would still be a valid Eighth->Peterson
     route, and it would no longer be the route that was asked for. */
  for (const w of spec.waypoints) {
    const p = typeof w === "string" ? campus.places[w] : w;
    if (!p) fail(`waypoint ${w} is not a known place`);
    let best = Infinity;
    for (const [x, z] of doc.route.points) best = Math.min(best, Math.hypot(x - p.x, z - p.z));
    if (best > 40) {
      fail(`the route passes ${best.toFixed(0)} m from ${typeof w === "string" ? w : w.name}`);
    }
  }

  const near = makeCorridor(doc.route.points.map(([x, z]) => ({ x, z })));
  const tol = CORRIDOR_M + 1;

  /* Everything kept must actually be in the corridor. This is the assertion
     that catches a filter accidentally inverted or a scale forgotten. */
  const outside = (label, rings, radius, scale = 1) => {
    for (const ring of rings) {
      if (!ring.some(([x, z]) => near.distance(x * scale, z * scale) <= radius)) {
        fail(`${label}: a kept ring is further than ${radius} m from the route`);
      }
      for (const [x, z] of ring) {
        if (!Number.isFinite(x) || !Number.isFinite(z)) fail(`${label}: non-finite coordinate`);
      }
    }
  };
  outside("buildings", doc.campus.buildings.map((x) => x.p), tol);
  outside("paths", doc.campus.paths.map((x) => x.p), tol);
  outside("surfaces", doc.campus.surfaces.map((x) => x.p), tol);
  /* Eighth College's own registered rings are kept regardless of distance —
     see the crop. Exempt them here or this assertion fires on the very rings
     the exemption exists to protect. */
  const exempt = new Set(doc.eighth ? [1761, 1160] : []);
  for (const section of [doc.eighth?.ground, doc.eighth?.buildings]) {
    for (const entry of Object.values(section || {})) {
      for (const m of String(entry?.registration || "").matchAll(/arcgis\.ground#(\d+)/g)) {
        exempt.add(Number(m[1]));
      }
    }
  }
  outside(
    "ground",
    doc.arcgis.ground.map((g, i) => (g && !exempt.has(i) ? g.r[0] : null)).filter(Boolean),
    tol, 0.1
  );
  outside("massing", doc.arcgis.massing.filter(Boolean).map((m) => m.r[0]), tol, 0.1);
  outside("skyline", doc.skyline.map((s) => s.r), SKYLINE_M + 1);
  for (const t of doc.lidar.trees) {
    if (near.distance(t[0], t[1]) > tol) fail("trees: a kept tree is outside the corridor");
  }

  /* Index-parallel colour arrays. Off by one here is invisible on screen —
     every building simply wears the wrong roof — so it has to be asserted. */
  if (doc.colors.buildings.length !== doc.campus.buildings.length) {
    fail("colors.buildings is not index-parallel to campus.buildings");
  }
  if (doc.colors.ground.length !== doc.arcgis.ground.length) {
    fail("colors.ground is not index-parallel to arcgis.ground");
  }
  if (doc.colors.massing.length !== doc.arcgis.massing.length) {
    fail("colors.massing is not index-parallel to arcgis.massing");
  }

  /* THE INDEX-STABILITY GATE.
   *
   * campus-eighth.js reaches into arcgis.ground by literal index — including
   * the hard-coded 1761, and every "arcgis.ground#NNNN" registration string in
   * campus-eighth.json. If this crop ever goes back to compacting the array,
   * those numbers land on different polygons and Eighth College is rebuilt out
   * of whatever is now at 3898 — including, specifically, the basketball court
   * this ride starts in the middle of. Nothing on screen would announce it.
   *
   * So: the arrays keep their FULL length, dropped slots are null, and every
   * ring that survives is byte-identical to the one at that index upstream. */
  const parent = sources.arcgis;
  if (parent?.ground) {
    if (doc.arcgis.ground.length !== parent.ground.length) {
      fail(`arcgis.ground is ${doc.arcgis.ground.length} long, parent is ${parent.ground.length}`
        + " — the crop compacted it and every index-keyed lookup now lies");
    }
    doc.arcgis.ground.forEach((g, i) => {
      if (g && JSON.stringify(g) !== JSON.stringify(parent.ground[i])) {
        fail(`arcgis.ground[${i}] is not the parent's own ring`);
      }
    });
    for (const key of Object.values(doc.eighth?.ground || {})) {
      const reg = key?.registration;
      const i = reg && /^arcgis\.ground#(\d+)$/.exec(reg)?.[1];
      if (i != null && !doc.arcgis.ground[Number(i)]) {
        fail(`${reg} was cropped away — Eighth College needs it`);
      }
    }
  }
  if (parent?.massing && doc.arcgis.massing.length !== parent.massing.length) {
    fail("arcgis.massing was compacted — see the ground note above");
  }
  for (const key of Object.keys(doc.lidar.osmHeights)) {
    if (Number(key) >= doc.campus.buildings.length) fail(`osmHeights key ${key} is out of range`);
  }
  for (const key of Object.keys(doc.lidar.partHeights)) {
    if (Number(key.split("/")[0]) >= doc.campus.buildings.length) {
      fail(`partHeights key ${key} is out of range`);
    }
  }

  /* The terrain must cover everywhere the rider can be, plus the pad. */
  const g = doc.lidar.terrain;
  const gx1 = g.x0 + (g.cols - 1) * g.cell;
  const gz1 = g.z0 + (g.rows - 1) * g.cell;
  for (const [x, z] of doc.route.points) {
    if (x < g.x0 + TERRAIN_PAD_M || x > gx1 - TERRAIN_PAD_M
      || z < g.z0 + TERRAIN_PAD_M || z > gz1 - TERRAIN_PAD_M) {
      fail("terrain crop does not cover the route with its margin");
    }
  }
  if (g.z.length !== g.cols * g.rows) fail("terrain grid length does not match its header");
  const ci = Buffer.from(doc.colors.terrain.idx, "base64");
  if (ci.length !== doc.colors.terrain.cols * doc.colors.terrain.rows) {
    fail("colour grid length does not match its header");
  }

  /* The invented props, held to the rules that make them defensible. */
  const { game, route } = doc;
  if (game.seed !== SEED) fail("game seed drifted from the pinned constant");
  if (!game.invented) fail("the game block must say it is invented");
  if (game.halfWidth !== TRACK_HALF_W) fail("game.halfWidth drifted from the track's painted half-width");
  const byS = new Map();
  for (const o of game.obstacles) {
    if (o.s < game.startClear) fail(`obstacle at ${o.s} m is inside the start clearance`);
    if (o.s > route.metres - game.finishClear) fail(`obstacle at ${o.s} m is inside the finish clearance`);
    if (Math.abs(o.off) + o.w / 2 > game.halfWidth + 0.01) {
      fail(`a ${o.kind} at offset ${o.off} m sticks out past the track's edge`);
    }
    const at = byS.get(o.s) || [];
    at.push(o);
    byS.set(o.s, at);
  }
  /* EVERY GROUP LEAVES A GAP THE RIDER FITS THROUGH. Re-derived from the
     placed widths, in rider-centre space: each obstacle blocks the interval
     its width plus the rider's sweeps, and what is left of the track must
     still contain a free window at least FREE_GAP_MIN_M wide. This is the
     free-steering version of "never block every lane at once", and it is a
     stronger claim — a group can pass a lane count and still be a wall. */
  for (const [s, group] of byS) {
    const spanC = game.halfWidth - RIDER_HALF_W;
    const blocked = group
      .map((o) => [o.off - o.w / 2 - RIDER_HALF_W, o.off + o.w / 2 + RIDER_HALF_W])
      .sort((a, b) => a[0] - b[0]);
    let cursor = -spanC;
    let widest = 0;
    for (const [a, b] of blocked) {
      widest = Math.max(widest, Math.min(a, spanC) - cursor);
      cursor = Math.max(cursor, b);
    }
    widest = Math.max(widest, spanC - cursor);
    if (widest < FREE_GAP_MIN_M) {
      fail(`the group at ${s} m leaves only a ${widest.toFixed(2)} m gap — the route is impassable`);
    }
    /* And the group's members do not stand inside one another. */
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (Math.abs(group[i].off - group[j].off) < (group[i].w + group[j].w) / 2) {
          fail(`two obstacles at ${s} m interpenetrate`);
        }
      }
    }
  }
  const stops = [...byS.keys()].sort((x, y) => x - y);
  for (let i = 1; i < stops.length; i++) {
    if (stops[i] - stops[i - 1] < OBSTACLE_GAP_M) {
      fail(`obstacle groups at ${stops[i - 1]} m and ${stops[i]} m are closer than ${OBSTACLE_GAP_M} m`);
    }
  }
  for (const c of game.coins) {
    if (Math.abs(c.off) > game.halfWidth) fail(`coin offset ${c.off} m is off the track`);
    if (c.s < 0 || c.s > route.metres) fail(`coin at ${c.s} m is off the route`);
  }
  /* A corridor either has props or declares that it deliberately has none.
     "Empty because that is the point" and "empty because the placer silently
     produced nothing" look identical in the file, so the spec has to say which
     and the two have to agree. */
  if (spec.props === false) {
    if (game.props !== false) fail("props are switched off for this corridor but the file does not say so");
    if (game.obstacles.length || game.coins.length) {
      fail(`props are switched off but ${game.obstacles.length} obstacles and ${game.coins.length} coins were placed`);
    }
  } else if (!game.obstacles.length || !game.coins.length) {
    fail("the run has no props at all");
  }
}

function load() {
  const read = (file, required = true) => {
    const p = path.join(DATA, file);
    if (!existsSync(p)) {
      if (required) throw new Error(`missing ${file} — run its builder first`);
      return null;
    }
    return JSON.parse(readFileSync(p, "utf8"));
  };
  return {
    campus: read("campus-3d.json"),
    lidar: read("campus-lidar.json"),
    arcgis: read("campus-arcgis.json", false),
    colors: read("campus-colors.json"),
    facades: read("campus-facades.json", false),
    eighth: read("campus-eighth.json", false),
    markings: read("campus-markings.json", false),
    landmarks: read("campus-landmarks.json", false),
  };
}

/* Which targets this run touches. No --target means all of them: the two
   corridors are cut from the same sources by the same code, so building one
   without the other is how they drift. */
function requested() {
  const arg = process.argv.find((a) => a.startsWith("--target="));
  if (!arg) return TARGETS;
  const want = arg.slice("--target=".length);
  if (!ROUTES[want]) throw new Error(`unknown target "${want}" — expected ${TARGETS.join(" or ")}`);
  return [want];
}

async function main() {
  const sources = load();

  for (const target of requested()) {
    const spec = ROUTES[target];
    const out = path.join(DATA, spec.file);

    if (CHECK) {
      if (!existsSync(out)) throw new Error(`${spec.file} is missing — build it first`);
      const doc = JSON.parse(readFileSync(out, "utf8"));
      check(doc, sources, spec);
      console.log(`${spec.file} OK — ${summarize(doc)}`);
      continue;
    }

    const doc = build(sources, spec);
    check(doc, sources, spec);
    writeFileSync(out, JSON.stringify(doc));
    const kb = Math.round(statSync(out).size / 1024);
    console.log(`${spec.file} — ${summarize(doc)} · ${kb} KB`);
  }
}

/* Only when RUN. tests/corridor.test.mjs imports build() and check() to prove
   two fresh builds are identical, and an import that also rewrote the shipped
   file would make the test the thing that produced its own answer. */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

export { build, check, load, summarize, placeGame, mulberry32, centreline };
export { CORRIDOR_M, SKYLINE_M, SAMPLE_M, SEED, OBSTACLE_GAP_M, TRACK_HALF_W, FREE_GAP_MIN_M };
export { DRAWN_REFERENCE, DRAWN_MEAN_M, DRAWN_WORST_M, BRIDGE_GAP_M };
export { ROUTES, TARGETS, DATA };
