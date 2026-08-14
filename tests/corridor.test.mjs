/* The Argo -> Peterson corridor: that it is a CROP, and that the invented
 * props obey their own rules.
 *
 * Two different worries, one file.
 *
 * The first is that the corridor stops being a subset. Everything in
 * corridor-argo-peterson.json is supposed to be copied verbatim out of the
 * measured campus files — so every ring in it must exist, identically, in its
 * parent, and every colour and height must still be attached to the thing it
 * was measured on. The index remaps are where that breaks: colors.buildings,
 * lidar.osmHeights and lidar.partHeights are all keyed by the ORIGINAL
 * building index, and a filter that forgets to remap them produces a file that
 * looks perfect and gives every building in the corridor another building's
 * roof. Nothing on screen would say so.
 *
 * The second is that the game props stay fair. They are invented, which is
 * exactly why they need assertions the measured world does not: never all
 * three lanes at once, never inside the start or finish clearance, never two
 * groups too close to react to, and identical on every rebuild.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(path.join(ROOT, p), "utf8"));

const DOC = read("docs/data/corridor-argo-peterson.json");
const CAMPUS = read("docs/data/campus-3d.json");
const LIDAR = read("docs/data/campus-lidar.json");
const COLORS = read("docs/data/campus-colors.json");

/* build() and check() are importable because build-corridor.mjs only runs
   main() when it is the process entry point. Importing it here must not
   rewrite the shipped file — that is half of what the determinism test is
   proving. */
const builder = await import(path.join(ROOT, "scripts/build-corridor.mjs"));
/* Read from the runtime rather than copied here: the width rule below is a
   relationship between what the builder places and what the ride collides
   with, and a hand-copied constant is how the two drift apart. */
const { RIDER_HALF_W } = await import(path.join(ROOT, "docs/js/scooter-ride.js"));

const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const toCentreline = (x, z) => {
  let best = Infinity;
  for (const [px, pz] of DOC.route.points) {
    const d = dist(x, z, px, pz);
    if (d < best) best = d;
  }
  return best;
};

describe("the route", () => {
  test("runs from Argo Hall to Peterson Hall", () => {
    const a = CAMPUS.places["Argo Hall"];
    const b = CAMPUS.places["Peterson Hall"];
    const first = DOC.route.points[0];
    const last = DOC.route.points.at(-1);
    assert.ok(dist(first[0], first[1], a.x, a.z) <= 25, "starts at Argo Hall");
    assert.ok(dist(last[0], last[1], b.x, b.z) <= 25, "ends at Peterson Hall");
    assert.equal(DOC.route.from, "Argo Hall");
    assert.equal(DOC.route.to, "Peterson Hall");
  });

  test("is the long way round, and evenly sampled", () => {
    /* The direct footway between the two was removed on purpose (see
       campus-gameplay.test.mjs); anything under 700 m means it came back. */
    assert.ok(DOC.route.metres > 700 && DOC.route.metres < 950,
      `route is ${DOC.route.metres} m`);
    /* Fixed spacing is what lets the ride index the centreline by division
       instead of searching it. */
    for (let i = 1; i < DOC.route.points.length; i++) {
      const [ax, az] = DOC.route.points[i - 1];
      const [bx, bz] = DOC.route.points[i];
      assert.ok(Math.abs(dist(ax, az, bx, bz) - DOC.route.spacing) < 0.15,
        `segment ${i} is ${dist(ax, az, bx, bz).toFixed(2)} m, not ${DOC.route.spacing}`);
    }
  });
});

describe("the crop is a subset, not a survey", () => {
  test("every kept building is a verbatim campus-3d building", () => {
    const parent = new Set(CAMPUS.buildings.map((b) => JSON.stringify(b)));
    for (const b of DOC.campus.buildings) {
      assert.ok(parent.has(JSON.stringify(b)), "a corridor building is not in campus-3d.json");
    }
  });

  test("every kept tree is a verbatim campus-lidar tree", () => {
    const parent = new Set(LIDAR.trees.map((t) => JSON.stringify(t)));
    for (const t of DOC.lidar.trees) {
      assert.ok(parent.has(JSON.stringify(t)), "a corridor tree is not in campus-lidar.json");
    }
  });

  test("nothing kept is outside the corridor", () => {
    const limit = DOC.built.corridorM + 1;
    const inside = (ring, scale = 1) =>
      ring.some(([x, z]) => toCentreline(x * scale, z * scale) <= limit);
    for (const b of DOC.campus.buildings) assert.ok(inside(b.p), "building outside the corridor");
    for (const p of DOC.campus.paths) assert.ok(inside(p.p), "path outside the corridor");
    for (const s of DOC.campus.surfaces) assert.ok(inside(s.p), "surface outside the corridor");
    for (const g of DOC.arcgis.ground) assert.ok(inside(g.r[0], 0.1), "ground outside the corridor");
    for (const t of DOC.lidar.trees) {
      assert.ok(toCentreline(t[0], t[1]) <= limit, "tree outside the corridor");
    }
  });

  test("the skyline tier is outside the corridor and tall", () => {
    const limit = DOC.built.corridorM;
    for (const s of DOC.skyline) {
      assert.ok(s.h >= 18, `skyline building ${s.n} is only ${s.h} m`);
      assert.ok(s.r.every(([x, z]) => toCentreline(x, z) > limit),
        `skyline building ${s.n} is inside the corridor and would render twice`);
    }
  });
});

describe("the index remaps", () => {
  /* This is the one that matters. Each of these three tables is keyed by the
     original building index; the crop renumbers the buildings; and being wrong
     here is completely invisible on screen. */
  const originalIndexOf = new Map();
  CAMPUS.buildings.forEach((b, i) => {
    const key = JSON.stringify(b);
    if (!originalIndexOf.has(key)) originalIndexOf.set(key, i);
  });
  const backTo = DOC.campus.buildings.map((b) => originalIndexOf.get(JSON.stringify(b)));

  test("every corridor building maps back to a campus-3d building", () => {
    assert.ok(backTo.every((i) => i != null), "a corridor building has no original");
  });

  test("roof colours still belong to their own building", () => {
    assert.equal(DOC.colors.buildings.length, DOC.campus.buildings.length);
    DOC.colors.buildings.forEach((hex, i) => {
      assert.equal(hex, COLORS.buildings[backTo[i]] ?? null,
        `building ${i} wears the wrong roof colour`);
    });
  });

  test("osmHeights still belong to their own building", () => {
    for (const [key, value] of Object.entries(DOC.lidar.osmHeights)) {
      const i = Number(key);
      assert.ok(i < DOC.campus.buildings.length, `osmHeights key ${key} is out of range`);
      assert.equal(value, LIDAR.osmHeights[backTo[i]], `building ${i} wears the wrong height`);
    }
  });

  test("partHeights still belong to their own building", () => {
    for (const [key, value] of Object.entries(DOC.lidar.partHeights)) {
      const [i, part] = key.split("/");
      assert.ok(Number(i) < DOC.campus.buildings.length, `partHeights key ${key} is out of range`);
      assert.equal(value, LIDAR.partHeights[`${backTo[Number(i)]}/${part}`],
        `part ${key} wears the wrong height`);
    }
  });

  test("ground and massing colours stay index-parallel", () => {
    assert.equal(DOC.colors.ground.length, DOC.arcgis.ground.length);
    assert.equal(DOC.colors.massing.length, DOC.arcgis.massing.length);
  });
});

describe("the cropped grids", () => {
  test("the terrain covers the whole route with its margin", () => {
    const g = DOC.lidar.terrain;
    assert.equal(g.z.length, g.cols * g.rows, "terrain grid does not match its header");
    const x1 = g.x0 + (g.cols - 1) * g.cell;
    const z1 = g.z0 + (g.rows - 1) * g.cell;
    for (const [x, z] of DOC.route.points) {
      assert.ok(x > g.x0 + 39 && x < x1 - 39 && z > g.z0 + 39 && z < z1 - 39,
        `the rider reaches ${x},${z}, within 40 m of the terrain edge`);
    }
  });

  test("the terrain samples are the parent's own samples", () => {
    const g = DOC.lidar.terrain;
    const p = LIDAR.terrain;
    assert.equal(g.cell, p.cell, "the crop resampled the grid instead of cutting it");
    const c0 = Math.round((g.x0 - p.x0) / p.cell);
    const r0 = Math.round((g.z0 - p.z0) / p.cell);
    for (const [r, c] of [[0, 0], [1, 3], [g.rows - 1, g.cols - 1]]) {
      assert.equal(g.z[r * g.cols + c], p.z[(r0 + r) * p.cols + (c0 + c)],
        `terrain sample ${r},${c} does not match the parent grid`);
    }
  });

  test("the colour grid matches its header", () => {
    const c = DOC.colors.terrain;
    assert.equal(Buffer.from(c.idx, "base64").length, c.cols * c.rows);
    assert.deepEqual(c.palette, COLORS.terrain.palette, "the palette was rewritten");
  });
});

describe("the invented props", () => {
  const { game, route } = DOC;

  test("say they are invented", () => {
    assert.match(game.invented, /not surveyed/i);
    assert.match(DOC._, /invented/i);
  });

  test("leave the start and the finish clear", () => {
    for (const o of game.obstacles) {
      assert.ok(o.s >= game.startClear, `obstacle at ${o.s} m is in the start clearance`);
      assert.ok(o.s <= route.metres - game.finishClear,
        `obstacle at ${o.s} m is in the finish clearance`);
    }
  });

  test("never block every lane at once", () => {
    const byS = new Map();
    for (const o of game.obstacles) {
      if (!byS.has(o.s)) byS.set(o.s, new Set());
      byS.get(o.s).add(o.lane);
    }
    for (const [s, lanes] of byS) {
      assert.ok(lanes.size < game.lanes, `every lane is blocked at ${s} m — the run is impassable`);
    }
  });

  test("are narrow enough to leave the next lane usable", () => {
    /* Counting blocked lanes is not enough. Collision is metric, so an
       obstacle wider than the gap to the next lane blocks that lane too — a
       group that reads as "one lane blocked" becomes a wall, every lane-count
       assertion still passes, and the run is quietly unfinishable. The first
       build had a 1.7 m bench in a 1.15 m lane and a perfect line took 28
       hits. This is the assertion that would have caught it. */
    for (const o of game.obstacles) {
      const reach = RIDER_HALF_W + o.w / 2;
      assert.ok(reach < game.laneOffset,
        `a ${o.kind} is ${o.w} m wide and reaches ${reach.toFixed(2)} m into the `
        + `${game.laneOffset} m gap to the next lane`);
    }
  });

  test("leave time to react between groups", () => {
    const stops = [...new Set(game.obstacles.map((o) => o.s))].sort((a, b) => a - b);
    for (let i = 1; i < stops.length; i++) {
      assert.ok(stops[i] - stops[i - 1] >= builder.OBSTACLE_GAP_M,
        `groups at ${stops[i - 1]} m and ${stops[i]} m are ${(stops[i] - stops[i - 1]).toFixed(1)} m apart`);
    }
  });

  test("sit in real lanes, on the route", () => {
    for (const c of game.coins) {
      assert.ok(c.lane >= 0 && c.lane < game.lanes, `coin lane ${c.lane}`);
      assert.ok(c.s >= 0 && c.s <= route.metres, `coin at ${c.s} m is off the route`);
      assert.ok(c.y > 0, "a coin is buried in the pavement");
    }
    for (const o of game.obstacles) {
      assert.ok(o.lane >= 0 && o.lane < game.lanes, `obstacle lane ${o.lane}`);
      assert.equal(typeof o.hop, "boolean", "an obstacle does not say whether it can be hopped");
      assert.ok(o.h > 0, "an obstacle has no height");
    }
    assert.ok(game.obstacles.length > 20, "too few obstacles for a 700 m run");
    assert.ok(game.coins.length > 50, "too few coins for a 700 m run");
  });

  test("include obstacles a hop cannot clear", () => {
    /* If everything were hoppable the lanes would be decoration. */
    const solid = game.obstacles.filter((o) => !o.hop);
    assert.ok(solid.length > 5, "nothing on the route actually requires a lane change");
  });
});

describe("reproducibility", () => {
  test("a fresh build is byte-identical to the shipped file", () => {
    /* The same guarantee npm run verify:reproducible holds the LiDAR build to.
       A seeded PRNG is only worth having if this passes. */
    const rebuilt = builder.build(builder.load());
    assert.equal(JSON.stringify(rebuilt), JSON.stringify(DOC),
      "rebuilding the corridor produced a different file");
  });

  test("the shipped file passes the builder's own check", () => {
    assert.doesNotThrow(() => builder.check(DOC, builder.load()));
  });
});
