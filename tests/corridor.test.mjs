/* The corridors: that each one is a CROP, and that the invented props obey
 * their own rules.
 *
 * Two different worries, one file.
 *
 * The first is that a corridor stops being a subset. Everything in
 * corridor-*.json is supposed to be copied verbatim out of the measured campus
 * files — so every ring in it must exist, identically, in its parent, and every
 * colour and height must still be attached to the thing it was measured on. The
 * index remaps are where that breaks: colors.buildings, lidar.osmHeights and
 * lidar.partHeights are all keyed by the ORIGINAL building index, and a filter
 * that forgets to remap them produces a file that looks perfect and gives every
 * building in the corridor another building's roof. Nothing on screen would say
 * so.
 *
 * The second is that the game props stay fair. They are invented, which is
 * exactly why they need assertions the measured world does not: never all
 * three lanes at once, never inside the start or finish clearance, never two
 * groups too close to react to, and identical on every rebuild.
 *
 * BOTH corridors are held to all of it. `staging` is a workbench, not a lesser
 * build — it ships from the same site, out of the same crop, and a subset
 * violation there is the same lie it would be on the run. The only assertions
 * that are not shared are the ones about where a particular route goes.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(path.join(ROOT, p), "utf8"));

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

const ARCGIS = read("docs/data/campus-arcgis.json");

/* Every shipped corridor, paired with the spec it was built from. The builder
   owns the list; reading it from there is what stops a third corridor being
   added one day with nothing checking it. */
const CORRIDORS = Object.values(builder.ROUTES).map((spec) => ({
  spec,
  doc: read(`docs/data/${spec.file}`),
}));

const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

/** Every arcgis.ground index the Eighth College survey addresses by number. */
function eighthRegistrations(doc) {
  /* A corridor that does not reach Eighth carries no survey of it and needs no
     exemptions — see the builder's own eighthNeeds. */
  if (!doc.eighth) return new Set();
  const out = new Set([1761, 1160]); // campus-eighth.js EXTRA, named nowhere in data
  for (const section of [doc.eighth?.ground, doc.eighth?.buildings]) {
    for (const entry of Object.values(section || {})) {
      for (const m of String(entry?.registration || "").matchAll(/arcgis\.ground#(\d+)/g)) {
        out.add(Number(m[1]));
      }
    }
  }
  return out;
}

const nearestOn = (doc) => (x, z) => {
  let best = Infinity;
  for (const [px, pz] of doc.route.points) {
    const d = dist(x, z, px, pz);
    if (d < best) best = d;
  }
  return best;
};

const DOC = CORRIDORS.find((c) => c.spec.target === "scooter").doc;
const STAGING = CORRIDORS.find((c) => c.spec.target === "staging").doc;

describe("the run's route", () => {
  /* The measured centre of the Eighth College basketball court —
     campus-eighth.json ground["basketball-court"], a 22.7 x 15.4 m rectangle. */
  const COURT = { x: -174.55, z: 525.2 };

  test("starts in the exact middle of the basketball court", () => {
    /* Not "near". The intro orbits this spot for seven seconds and the rider is
       told they are starting on it; the nearest node of the pedestrian graph is
       12.7 m away at the court's corner, which is what the builder's lead-in
       exists to close. */
    const first = DOC.route.points[0];
    const miss = dist(first[0], first[1], COURT.x, COURT.z);
    assert.ok(miss <= 0.1, `route starts ${miss.toFixed(2)} m off the court centre`);
    assert.ok(DOC.route.leadInM > 5, "the lead-in across the court is missing");
  });

  test("ends at Peterson Hall", () => {
    const b = CAMPUS.places["Peterson Hall"];
    const last = DOC.route.points.at(-1);
    assert.ok(dist(last[0], last[1], b.x, b.z) <= 25, "ends at Peterson Hall");
    assert.equal(DOC.route.to, "Peterson Hall");
  });

  test("passes every waypoint, in order", () => {
    /* The route is described by landmarks — north through the fleet, past 64
       Degrees, right at Argo, left in the plaza. A router that took Ridge Walk
       on the far side of the halls would still be a valid Eighth->Peterson
       route and would no longer be THIS route. Note "64 Degrees" is the dining
       hall, not a compass bearing. */
    const order = ["64 Degrees", "Argo Hall", "Revelle Plaza", "Peterson Hall"];
    let lastAt = -1;
    for (const name of order) {
      const p = CAMPUS.places[name];
      assert.ok(p, `${name} is not a known place`);
      let best = Infinity;
      let bestAt = -1;
      DOC.route.points.forEach(([x, z], i) => {
        const d = dist(x, z, p.x, p.z);
        if (d < best) { best = d; bestAt = i; }
      });
      assert.ok(best <= 40, `the route passes ${best.toFixed(0)} m from ${name}`);
      assert.ok(bestAt > lastAt, `${name} comes out of order along the route`);
      lastAt = bestAt;
    }
  });

  test("turns the way the route was described", () => {
    /* Bearing 0 = north, 90 = east. Right at Argo means the heading swings
       east; left in the plaza means it swings back to north and holds. */
    const bearingAt = (metres) => {
      const i = Math.round(metres / DOC.route.spacing);
      const a = DOC.route.points[i];
      const b = DOC.route.points[Math.min(DOC.route.points.length - 1, i + 20)];
      return ((Math.atan2(b[0] - a[0], -(b[1] - a[1])) * 180) / Math.PI + 360) % 360;
    };
    const east = (deg) => deg > 60 && deg < 130;
    const north = (deg) => deg < 25 || deg > 335;

    assert.ok(east(bearingAt(280)), `at 280 m the route heads ${bearingAt(280).toFixed(0)}deg, not east (the turn at Argo)`);
    for (const m of [440, 520, 600]) {
      assert.ok(north(bearingAt(m)), `at ${m} m the route heads ${bearingAt(m).toFixed(0)}deg, not north`);
    }
  });

  test("is the long way round, and evenly sampled", () => {
    /* The direct Argo-Peterson footway was removed on purpose (see
       campus-gameplay.test.mjs); a route this short again means it came back. */
    assert.ok(DOC.route.metres > 950 && DOC.route.metres < 1200,
      `route is ${DOC.route.metres} m`);
    /* Fixed spacing is what lets the ride index the centreline by division
       (positionAt: i = floor(s / spacing)) instead of searching it.
     *
     * Not every segment is exactly `spacing`, and it does not need to be.
     * routeThrough stitches one A* leg per waypoint pair and the resampler
     * restarts its remainder at each join, so the handful of segments AT those
     * joins — plus the lead-in join and the final remainder — come out short.
     * Three of them on this route. What matters is that the error is bounded
     * and does not accumulate: a short segment displaces the rider by less than
     * the shortfall at that one index and the next segment is back on the grid.
     * So: bound every segment, and hold the whole route to its stated length. */
    const gaps = [];
    for (let i = 1; i < DOC.route.points.length; i++) {
      const [ax, az] = DOC.route.points[i - 1];
      const [bx, bz] = DOC.route.points[i];
      gaps.push(dist(ax, az, bx, bz));
    }
    for (const [i, g] of gaps.entries()) {
      assert.ok(Math.abs(g - DOC.route.spacing) < 0.6,
        `segment ${i + 1} is ${g.toFixed(2)} m, too far off ${DOC.route.spacing}`);
    }
    const loose = gaps.filter((g) => Math.abs(g - DOC.route.spacing) > 0.15).length;
    assert.ok(loose <= 6, `${loose} segments are off-grid — expected only the leg joins`);

    /* The arc length the ride believes in must match the polyline it rides. */
    const walked = gaps.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(walked - DOC.route.metres) < 3,
      `route says ${DOC.route.metres} m but its polyline walks ${walked.toFixed(1)} m`);
  });
});


/* The staging corridor's own route. Short, direct, and deliberately the stretch
   the run ends on — so a change tried out here is a change tried on geometry
   the run actually contains. */
describe("the staging route", () => {
  test("runs Argo Hall to Peterson Hall", () => {
    assert.equal(STAGING.route.from, "Argo Hall");
    assert.equal(STAGING.route.to, "Peterson Hall");
    const a = CAMPUS.places["Argo Hall"];
    const b = CAMPUS.places["Peterson Hall"];
    const first = STAGING.route.points[0];
    const last = STAGING.route.points.at(-1);
    assert.ok(dist(first[0], first[1], a.x, a.z) <= 40, "does not start at Argo Hall");
    assert.ok(dist(last[0], last[1], b.x, b.z) <= 25, "does not end at Peterson Hall");
  });

  test("is a real subsection of the run, not a second survey of it", () => {
    /* Staging exists to try things on the run's own geometry. If its centreline
       wandered somewhere the run never goes, work verified here would prove
       nothing about there. Every staging point has to lie on the run's line. */
    const onRun = nearestOn(DOC);
    let worst = 0;
    for (const [x, z] of STAGING.route.points) worst = Math.max(worst, onRun(x, z));
    assert.ok(worst < 12, `staging strays ${worst.toFixed(1)} m from the run's centreline`);
  });

  test("carries no Eighth College survey, because it never gets there", () => {
    assert.equal(STAGING.eighth, null);
  });
});

describe("the two corridors are separate files", () => {
  test("each says which one it is", () => {
    /* The documents are the same shape, so a build written to the wrong path is
       otherwise silent — you would simply get the other route. campus-scooter.js
       refuses to boot a file whose target does not match its mode; this is the
       same assertion at build time. */
    const targets = CORRIDORS.map((c) => c.doc.built.target);
    assert.deepEqual([...targets].sort(), ["scooter", "staging"]);
    for (const { spec, doc } of CORRIDORS) assert.equal(doc.built.target, spec.target);
  });

  test("they are different routes", () => {
    assert.notEqual(DOC.route.metres, STAGING.route.metres);
    assert.notEqual(DOC.route.from, STAGING.route.from);
  });
});

/* Everything below holds for EVERY corridor. Staging is not exempt from being
   a crop: it ships from the same site and a subset violation there is the same
   lie it would be on the run. */
for (const { spec, doc } of CORRIDORS) {
  describe(spec.label, () => {
    const toCentreline = nearestOn(doc);
  describe("the crop is a subset, not a survey", () => {
    test("every kept building is a verbatim campus-3d building", () => {
      const parent = new Set(CAMPUS.buildings.map((b) => JSON.stringify(b)));
      for (const b of doc.campus.buildings) {
        assert.ok(parent.has(JSON.stringify(b)), "a corridor building is not in campus-3d.json");
      }
    });

    test("every kept tree is a verbatim campus-lidar tree", () => {
      const parent = new Set(LIDAR.trees.map((t) => JSON.stringify(t)));
      for (const t of doc.lidar.trees) {
        assert.ok(parent.has(JSON.stringify(t)), "a corridor tree is not in campus-lidar.json");
      }
    });

    test("nothing kept is outside the corridor", () => {
      const limit = doc.built.corridorM + 1;
      const inside = (ring, scale = 1) =>
        ring.some(([x, z]) => toCentreline(x * scale, z * scale) <= limit);
      for (const b of doc.campus.buildings) assert.ok(inside(b.p), "building outside the corridor");
      for (const p of doc.campus.paths) assert.ok(inside(p.p), "path outside the corridor");
      for (const s of doc.campus.surfaces) assert.ok(inside(s.p), "surface outside the corridor");
      /* Eighth College's own registered rings are kept whatever the distance —
         the college would otherwise have holes in it — so they are exempt here,
         and holes are skipped. */
      const exempt = eighthRegistrations(doc);
      doc.arcgis.ground.forEach((g, i) => {
        if (!g || exempt.has(i)) return;
        assert.ok(inside(g.r[0], 0.1), `ground ${i} outside the corridor`);
      });
      for (const t of doc.lidar.trees) {
        assert.ok(toCentreline(t[0], t[1]) <= limit, "tree outside the corridor");
      }
    });

    test("the skyline tier is outside the corridor and tall", () => {
      const limit = doc.built.corridorM;
      for (const s of doc.skyline) {
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
    const backTo = doc.campus.buildings.map((b) => originalIndexOf.get(JSON.stringify(b)));

    test("every corridor building maps back to a campus-3d building", () => {
      assert.ok(backTo.every((i) => i != null), "a corridor building has no original");
    });

    test("roof colours still belong to their own building", () => {
      assert.equal(doc.colors.buildings.length, doc.campus.buildings.length);
      doc.colors.buildings.forEach((hex, i) => {
        assert.equal(hex, COLORS.buildings[backTo[i]] ?? null,
          `building ${i} wears the wrong roof colour`);
      });
    });

    test("osmHeights still belong to their own building", () => {
      for (const [key, value] of Object.entries(doc.lidar.osmHeights)) {
        const i = Number(key);
        assert.ok(i < doc.campus.buildings.length, `osmHeights key ${key} is out of range`);
        assert.equal(value, LIDAR.osmHeights[backTo[i]], `building ${i} wears the wrong height`);
      }
    });

    test("partHeights still belong to their own building", () => {
      for (const [key, value] of Object.entries(doc.lidar.partHeights)) {
        const [i, part] = key.split("/");
        assert.ok(Number(i) < doc.campus.buildings.length, `partHeights key ${key} is out of range`);
        assert.equal(value, LIDAR.partHeights[`${backTo[Number(i)]}/${part}`],
          `part ${key} wears the wrong height`);
      }
    });

    test("ground and massing colours stay index-parallel", () => {
      assert.equal(doc.colors.ground.length, doc.arcgis.ground.length);
      assert.equal(doc.colors.massing.length, doc.arcgis.massing.length);
    });

    test("arcgis.ground keeps its ORIGINAL indices", () => {
      /* The load-bearing one. campus-eighth.js reads these rings by literal
         index — including a hard-coded 1761 and every "arcgis.ground#NNNN"
         registration string in campus-eighth.json. Compact this array and Eighth
         College rebuilds itself out of whatever now sits at those numbers,
         including the basketball court the ride starts in the middle of, and
         nothing on screen says so. Hence: full length, holes for dropped rings,
         and every survivor byte-identical to its parent. */
      assert.equal(doc.arcgis.ground.length, ARCGIS.ground.length,
        "the crop compacted arcgis.ground and every index-keyed lookup now lies");
      assert.equal(doc.arcgis.massing.length, ARCGIS.massing.length);
      doc.arcgis.ground.forEach((g, i) => {
        if (!g) return;
        assert.deepEqual(g, ARCGIS.ground[i], `arcgis.ground[${i}] is not the parent's ring`);
      });
    });

    test("every ring Eighth College registers survived the crop", () => {
      const needed = eighthRegistrations(doc);
      if (!spec.eighth) {
        /* The other half of the same rule: a corridor that never reaches Eighth
           must not be carrying its survey around, or it paints a basketball
           court half a kilometre off its own line. */
        assert.equal(doc.eighth, null, "this route does not reach Eighth College but carries its survey");
        assert.equal(needed.size, 0);
        return;
      }
      assert.ok(needed.size > 50, "the Eighth survey carries no registrations to check");
      for (const i of needed) {
        assert.ok(doc.arcgis.ground[i], `arcgis.ground#${i} was cropped away — Eighth College needs it`);
      }
      /* The court the ride starts on, specifically. */
      assert.ok(doc.arcgis.ground[3898], "the basketball court's own ring is missing");
    });
  });

  describe("the cropped grids", () => {
    test("the terrain covers the whole route with its margin", () => {
      const g = doc.lidar.terrain;
      assert.equal(g.z.length, g.cols * g.rows, "terrain grid does not match its header");
      const x1 = g.x0 + (g.cols - 1) * g.cell;
      const z1 = g.z0 + (g.rows - 1) * g.cell;
      for (const [x, z] of doc.route.points) {
        assert.ok(x > g.x0 + 39 && x < x1 - 39 && z > g.z0 + 39 && z < z1 - 39,
          `the rider reaches ${x},${z}, within 40 m of the terrain edge`);
      }
    });

    test("the terrain samples are the parent's own samples", () => {
      const g = doc.lidar.terrain;
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
      const c = doc.colors.terrain;
      assert.equal(Buffer.from(c.idx, "base64").length, c.cols * c.rows);
      assert.deepEqual(c.palette, COLORS.terrain.palette, "the palette was rewritten");
    });
  });

  describe("the invented props", () => {
    const { game, route } = doc;

    test("say they are invented", () => {
      assert.match(game.invented, /not surveyed/i);
      assert.match(doc._, /invented/i);
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
      const rebuilt = builder.build(builder.load(), spec);
      assert.equal(JSON.stringify(rebuilt), JSON.stringify(doc),
        "rebuilding the corridor produced a different file");
    });

    test("the shipped file passes the builder's own check", () => {
      assert.doesNotThrow(() => builder.check(doc, builder.load(), spec));
    });
  });

  });
}
