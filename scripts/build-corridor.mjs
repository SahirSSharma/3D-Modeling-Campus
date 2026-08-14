#!/usr/bin/env node
// Build docs/data/corridor-argo-peterson.json — the Argo Hall -> Peterson Hall
// walk, cut out of the campus as a map of its own.
//
// WHY THIS EXISTS. The site ships one world: the whole campus, ~10 MB of
// survey, free roam from 110 m up. That is the right shape for "look at the
// measured campus" and the wrong shape for a game. A scooter run down one
// 785 m route needs the opposite of breadth — it needs the few hundred metres
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
//   arcgis  — campus-arcgis.json shape: surveyed ground + massing
//   colors  — campus-colors.json shape: terrain palette, roof + ground colour
//   route   — the centreline itself, resampled at a fixed spacing
//   game    — invented: lanes, obstacles, coins
//
// Usage:
//   node scripts/build-corridor.mjs            # crop + write
//   node scripts/build-corridor.mjs --check    # verify the shipped file only
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildGraph, routeBetween, smooth, resample } from "../docs/js/campus-route.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(REPO_ROOT, "docs/data");
const OUT = path.join(DATA, "corridor-argo-peterson.json");
const CHECK = process.argv.includes("--check");

const FROM = "Argo Hall";
const TO = "Peterson Hall";

/* How far from the centreline still counts as "what you can see walking it".
   Measured against the shipped campus: 100 m keeps 37 buildings, 200 paths,
   36 surfaces and 156 trees out of 1395 / 3878 / 662 / 10664 — about 3% of the
   campus, and every building that actually walls the route. Widening this is
   free in correctness and expensive in load time; it was chosen by looking at
   what falls in and out of it, not by rounding. */
const CORRIDOR_M = 100;

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

/* Clear ground at both ends: you get 30 m to find your feet leaving Argo and
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

function centreline(campus) {
  const graph = buildGraph(campus);
  const found = routeBetween(campus, graph, FROM, TO);
  if (!found) throw new Error(`no route from ${FROM} to ${TO}`);
  const points = resample(smooth(found.points), SAMPLE_M);
  return {
    from: FROM,
    to: TO,
    metres: round1((points.length - 1) * SAMPLE_M),
    routedMetres: round1(found.metres),
    spacing: SAMPLE_M,
    points: points.map((p) => [round1(p.x), round1(p.z)]),
  };
}

function build(sources) {
  const { campus, lidar, arcgis, colors, facades } = sources;
  const route = centreline(campus);
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
    if (name === FROM || name === TO || near.distance(p.x, p.z) <= CORRIDOR_M) {
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
  /* Decimetre integers in this file, hence the 0.1 scale on the distance
     test. colors.ground and colors.massing are index-parallel to these two
     arrays and are rebuilt through the same filter, for the same reason the
     buildings were. */
  const ground = [];
  const groundColors = [];
  (arcgis?.ground || []).forEach((g, i) => {
    if (!g.r?.[0] || !near.ringNear(g.r[0], CORRIDOR_M, 0.1)) return;
    ground.push(g);
    groundColors.push(colors?.ground?.[i] ?? null);
  });

  const massing = [];
  const massingColors = [];
  (arcgis?.massing || []).forEach((m, i) => {
    if (!m.r?.[0] || !near.ringNear(m.r[0], CORRIDOR_M, 0.1)) return;
    massing.push(m);
    massingColors.push(colors?.massing?.[i] ?? null);
  });

  /* ---- the skyline tier ---- */
  /* Outside the corridor, inside SKYLINE_M, and tall enough to be worth
     drawing: the horizon you actually see from the route. Carried as plain
     rings + a height, not as buildings — nothing walks to them. */
  const skyline = [];
  (arcgis?.massing || []).forEach((m, i) => {
    if (!m.r?.[0]) return;
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
    _: "Argo Hall -> Peterson Hall, cut out of the measured campus by "
      + "scripts/build-corridor.mjs. The world here is a CROP: every ring, height, tree "
      + "and colour is copied verbatim from campus-3d/lidar/arcgis/colors.json and nothing "
      + "is surveyed, moved or guessed. The `game` key is the exception and is invented — "
      + "see game.invented.",
    built: { from: FROM, to: TO, corridorM: CORRIDOR_M, skylineM: SKYLINE_M, seed: SEED },
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
  };
}

function summarize(doc) {
  return [
    `${doc.route.metres} m ${doc.route.from} -> ${doc.route.to}`,
    `${doc.campus.buildings.length} buildings`,
    `${doc.arcgis.massing.length} masses`,
    `${doc.arcgis.ground.length} ground polygons`,
    `${doc.lidar.trees.length} trees`,
    `${doc.skyline.length} skyline`,
    `${doc.game.obstacles.length} obstacles`,
    `${doc.game.coins.length} coins`,
  ].join(" · ");
}

/* -------------------------------------------------------------- the gates */

function check(doc, sources) {
  const fail = (msg) => { throw new Error(msg); };
  const { campus } = sources;

  /* The route is the whole premise: if it no longer starts at Argo or ends at
     Peterson, nothing else in the file means anything. */
  const a = campus.places[FROM];
  const b = campus.places[TO];
  const first = doc.route.points[0];
  const last = doc.route.points[doc.route.points.length - 1];
  const gap = (p, q) => Math.hypot(p[0] - q.x, p[1] - q.z);
  if (gap(first, a) > 25) fail(`route starts ${gap(first, a).toFixed(1)} m from ${FROM}`);
  if (gap(last, b) > 25) fail(`route ends ${gap(last, b).toFixed(1)} m from ${TO}`);
  if (doc.route.metres < 700 || doc.route.metres > 950) {
    fail(`route is ${doc.route.metres} m — expected 700-950 m`);
  }
  if (doc.route.spacing !== SAMPLE_M) fail("route spacing is not the fixed sample");

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
  outside("ground", doc.arcgis.ground.map((g) => g.r[0]), tol, 0.1);
  outside("massing", doc.arcgis.massing.map((m) => m.r[0]), tol, 0.1);
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
  };
}

async function main() {
  const sources = load();

  if (CHECK) {
    if (!existsSync(OUT)) throw new Error("corridor-argo-peterson.json is missing — build it first");
    const doc = JSON.parse(readFileSync(OUT, "utf8"));
    check(doc, sources);
    console.log(`corridor-argo-peterson.json OK — ${summarize(doc)}`);
    return;
  }

  const doc = build(sources);
  check(doc, sources);
  writeFileSync(OUT, JSON.stringify(doc));
  const kb = Math.round(statSync(OUT).size / 1024);
  console.log(`corridor-argo-peterson.json — ${summarize(doc)} · ${kb} KB`);
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
export { CORRIDOR_M, SKYLINE_M, SAMPLE_M, SEED, OBSTACLE_GAP_M, LANE_OFFSET_M, OUT };
