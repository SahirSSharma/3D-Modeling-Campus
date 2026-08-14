#!/usr/bin/env node
// Build the corridor worlds — one route each, cut out of the campus as a map
// of its own. There are two, and they are the same cut over different lines:
//
//   scooter → corridor-eighth-peterson.json — the shipped run, Eighth College
//             courts to Peterson Hall
//   staging → corridor-argo-peterson.json   — Argo Hall to Peterson Hall, the
//             work zone. Same builder, same gates, its own file, so a change
//             being tried out on it cannot reach the run people ride.
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
// coins and lanes of the scooter run. Those ARE invented. They are seeded from
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
//   game    — invented: lanes, obstacles, coins
//
// Usage:
//   node scripts/build-corridor.mjs                    # crop + write both
//   node scripts/build-corridor.mjs --check            # verify the shipped files
//   node scripts/build-corridor.mjs --target=staging   # just the one
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildGraph, routeThrough, smooth, resample } from "../docs/js/campus-route.js";

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
 * 64 Degrees dining hall, right at Argo, left through Revelle Plaza, then the
 * long straight north that was the original corridor.
 *
 * 64 Degrees is a BUILDING, not a bearing. Read as a compass heading it aims at
 * Pepper Canyon, 1.2 km the wrong way; the waypoint is what keeps the route on
 * the west side of Ridge Walk and actually among the halls.
 *
 * `staging` is that last stretch on its own: Argo Hall to Peterson, the 732 m
 * the run was before it was extended. It exists so there is somewhere to try
 * things. It is not a lesser build — it goes through the same crop, the same
 * gates and the same test suite; it is simply a second file, so work in
 * progress cannot land in the world people ride. Nothing here is route-specific
 * except this table.
 *
 *   startAt  a point the route must BEGIN on exactly, when the pedestrian graph
 *            has no node there (the middle of a court is not a path junction).
 *            null means "start wherever the router starts", which is what a
 *            route between two buildings wants.
 *   eighth   whether to carry the Eighth College survey. Only the route that
 *            passes through it does; carrying it otherwise would paint a
 *            basketball court half a kilometre off the line, and would drag in
 *            the index exemptions that exist to protect it.
 *   metres   the range the finished route must land in. A window, not a
 *            number — the router is allowed to re-route around a retagged
 *            path — but narrow enough that a route through the wrong campus
 *            fails rather than silently ships.
 */
const COURT_CENTRE = { x: -174.55, z: 525.2, name: "Eighth College courts" };

const ROUTES = {
  scooter: {
    target: "scooter",
    file: "corridor-eighth-peterson.json",
    label: "Eighth → Peterson",
    waypoints: [COURT_CENTRE, "64 Degrees", "Argo Hall", "Revelle Plaza", "Peterson Hall"],
    from: "Eighth College courts",
    to: "Peterson Hall",
    startAt: COURT_CENTRE,
    eighth: true,
    metres: [950, 1200],
  },
  staging: {
    target: "staging",
    file: "corridor-argo-peterson.json",
    label: "Argo → Peterson (staging)",
    waypoints: ["Argo Hall", "Peterson Hall"],
    from: "Argo Hall",
    to: "Peterson Hall",
    startAt: null,
    eighth: false,
    metres: [600, 900],
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

   EVERY WIDTH HERE MUST FIT ITS LANE. An obstacle wide enough to reach into
   the neighbouring lane makes the lane beside it unusable, and a group that
   blocks two lanes that way is a group that blocks all three — the run stops
   being finishable while every "never block all three lanes" assertion still
   passes, because on paper it does not. The first build of this file had a
   1.7 m bench in a 1.15 m lane and a perfect line still took 28 hits. The
   arithmetic is asserted in check(); these numbers are what satisfies it, and
   scooter-model.js draws each kind at exactly the width declared here. */
const OBSTACLE_KINDS = [
  { kind: "bench", w: 1.3, h: 0.46, hop: true },
  { kind: "cone", w: 0.4, h: 0.5, hop: true },
  { kind: "puddle", w: 1.2, h: 0.02, hop: true },
  { kind: "bollard", w: 0.24, h: 0.95, hop: false },
  { kind: "planter", w: 1.1, h: 0.8, hop: false },
  { kind: "sign", w: 0.9, h: 1.15, hop: false },
];

/* The rider's own half-width, mirrored from scooter-ride.js's RIDER_HALF_W.
   Only used here to prove the widths above leave the next lane clear. */
const RIDER_HALF_W = 0.32;

/* Three lanes, 1.15 m apart. The walkways on this route run roughly 3.5 m of
   pavement, so the outer lanes sit near the edge and the scooter (0.5 m across
   the deck) stays on it. */
const LANE_OFFSET_M = 1.15;
const LANES = 3;

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
 * tests/corridor.test.mjs: nothing in the first or last stretch, never all
 * three lanes blocked at once, never two groups closer than OBSTACLE_GAP_M.
 */
function placeGame(route, rng) {
  const obstacles = [];
  const coins = [];
  const end = route.metres - FINISH_CLEAR_M;

  let s = START_CLEAR_M;
  while (s < end) {
    s += OBSTACLE_GAP_M + rng() * 10;
    if (s >= end) break;

    /* One or two lanes, never three: there is always a way through. Two-lane
       groups get rarer nowhere — the route is short enough that a flat 35%
       reads as a rhythm rather than a difficulty curve, and a curve over
       785 m would just be the last third being unfair. */
    const blocked = rng() < 0.35 ? 2 : 1;
    const lanes = [0, 1, 2];
    /* Fisher-Yates off the seeded stream, so the choice is reproducible. */
    for (let i = lanes.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
    }
    const chosen = lanes.slice(0, blocked).sort((a, b) => a - b);
    const open = lanes.slice(blocked).sort((a, b) => a - b);

    for (const lane of chosen) {
      const spec = OBSTACLE_KINDS[Math.floor(rng() * OBSTACLE_KINDS.length)];
      obstacles.push({
        s: round1(s),
        lane,
        kind: spec.kind,
        w: spec.w,
        h: spec.h,
        hop: spec.hop,
        /* A little yaw so a row of three benches is not three copies of one
           bench. Rendering only; collision uses the lane, not the angle. */
        spin: round2((rng() - 0.5) * 0.5),
      });
      /* A hoppable obstacle gets an arc of coins over it — the reward for
         taking the hard lane instead of going round. */
      if (spec.hop && rng() < 0.7) {
        for (let k = -1; k <= 1; k++) {
          coins.push({ s: round1(s + k * 1.6), lane, y: round2(0.9 + (k === 0 ? 0.55 : 0.2)) });
        }
      }
    }

    /* A run of coins down one of the lanes that IS open, starting a little
       past the group so it pulls you out the far side rather than into it. */
    if (rng() < 0.75) {
      const lane = open[Math.floor(rng() * open.length)];
      const runLen = 4 + Math.floor(rng() * 4);
      for (let k = 0; k < runLen; k++) {
        const cs = s + 5 + k * 2.5;
        if (cs > end) break;
        coins.push({ s: round1(cs), lane, y: 0.9 });
      }
    }
  }

  coins.sort((a, b) => a.s - b.s || a.lane - b.lane || a.y - b.y);
  obstacles.sort((a, b) => a.s - b.s || a.lane - b.lane);

  return {
    invented: "Obstacles, coins and lanes are placed by this builder, not surveyed. "
      + "The campus they sit in is measured; these are not.",
    seed: SEED,
    lanes: LANES,
    laneOffset: LANE_OFFSET_M,
    startClear: START_CLEAR_M,
    finishClear: FINISH_CLEAR_M,
    /* Par: the route at the ES2's real top speed, plus 15% for the lane
       changes and hops you cannot take at full tilt. */
    par: round1((route.metres / 6.9) * 1.15),
    obstacles,
    coins,
  };
}

/* ---------------------------------------------------------------- the cut */

function centreline(campus, spec) {
  const graph = buildGraph(campus);
  const found = routeThrough(campus, graph, spec.waypoints);
  if (!found) throw new Error(`no route through ${spec.waypoints.length} waypoints`);

  /* THE LEAD-IN. routeThrough starts at the nearest node of the pedestrian
     graph, and the nearest node to the middle of the basketball court is 12.7 m
     away at its north-west corner — so without this the ride would begin off
     the court, which is not what "start in the exact middle of the courts" says.
     Prepend the straight line from the true centre out to that first node.

     This is the one segment of centreline that is not a surveyed path, and it
     is a straight line across the middle of a paved court that the survey
     already draws. It invents no geometry; it only says the ride begins in the
     middle of a slab rather than at its edge.

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
  const points = resample(smooth([...lead, ...found.points]), SAMPLE_M);

  /* Chaikin pulls the very first point off the exact centre. Put it back: the
     promise "s = 0 is the middle of the court" is the whole reason for the
     lead-in, and tests/corridor.test.mjs holds it to 0.1 m. */
  if (spec.startAt) points[0] = { x: spec.startAt.x, z: spec.startAt.z };

  return {
    from: spec.from,
    to: spec.to,
    via: spec.waypoints.map((w) => (typeof w === "string" ? w : w.name)),
    metres: round1((points.length - 1) * SAMPLE_M),
    routedMetres: round1(found.metres),
    leadInM: round1(gap),
    spacing: SAMPLE_M,
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

  const game = placeGame(route, mulberry32(SEED));

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
  const byS = new Map();
  for (const o of game.obstacles) {
    if (o.s < game.startClear) fail(`obstacle at ${o.s} m is inside the start clearance`);
    if (o.s > route.metres - game.finishClear) fail(`obstacle at ${o.s} m is inside the finish clearance`);
    if (o.lane < 0 || o.lane >= game.lanes) fail(`obstacle lane ${o.lane} is out of range`);
    const at = byS.get(o.s) || new Set();
    at.add(o.lane);
    byS.set(o.s, at);
  }
  for (const [s, lanes] of byS) {
    if (lanes.size >= game.lanes) fail(`every lane is blocked at ${s} m — the route is impassable`);
  }
  /* An obstacle wider than its lane blocks the lane NEXT to it too, which is
     how a group that reads as "one lane blocked" becomes a wall. Counting
     lanes is not enough on its own; the width has to be checked against the
     spacing that separates them. */
  for (const o of game.obstacles) {
    const reach = RIDER_HALF_W + o.w / 2;
    if (reach >= game.laneOffset) {
      fail(`a ${o.kind} is ${o.w} m wide: it reaches ${reach.toFixed(2)} m, `
        + `past the ${game.laneOffset} m to the next lane, so the lane beside it is unusable`);
    }
  }
  const stops = [...byS.keys()].sort((x, y) => x - y);
  for (let i = 1; i < stops.length; i++) {
    if (stops[i] - stops[i - 1] < OBSTACLE_GAP_M) {
      fail(`obstacle groups at ${stops[i - 1]} m and ${stops[i]} m are closer than ${OBSTACLE_GAP_M} m`);
    }
  }
  for (const c of game.coins) {
    if (c.lane < 0 || c.lane >= game.lanes) fail(`coin lane ${c.lane} is out of range`);
    if (c.s < 0 || c.s > route.metres) fail(`coin at ${c.s} m is off the route`);
  }
  if (!game.obstacles.length || !game.coins.length) fail("the run has no props at all");
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
export { CORRIDOR_M, SKYLINE_M, SAMPLE_M, SEED, OBSTACLE_GAP_M, LANE_OFFSET_M };
export { ROUTES, TARGETS, DATA };
