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
 * width at once, never inside the start or finish clearance, never two
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
    /* The route is described by landmarks — up the corridor through the fleet,
       east along Argo's south face, north up its east side, then into the
       plaza. Each of these is passed, which it must be; "never runs inside a
       building" above is what keeps "passes" from becoming "through". A router
       that took Ridge Walk on the far side of the halls would still be a valid
       Eighth->Peterson route and would no longer be THIS route.

       "64 Degrees" USED TO BE ON THIS LIST. It is the dining hall, not a
       compass bearing, and it sits north-WEST of Argo — the old route went
       through it and that was most of what made the line wrong. The current
       route passes 43 m away, and that is correct, so it is not asserted. */
    const order = ["Atlantis Hall", "Discovery Hall", "Argo Hall", "Revelle Plaza", "Peterson Hall"];
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

  test("never runs inside a building", () => {
    /* THE ONE THAT SHIPPED. The route drove 12 m through Argo Hall and 2 m
       through Challenger, and nothing on screen said so — you simply rode
       through a residence hall. Three causes, all fixed:

         1. "Argo Hall" was a waypoint, and a building waypoint routes to that
            building's CENTROID, which is inside it by definition.
         2. campus-route.js joins every plaza perimeter vertex to the plaza
            centre to make open squares crossable. That shortcut is invented,
            and four of the eighteen spokes of the courtyard plaza that wraps
            Argo were straight lines through the building.
         3. Chaikin smoothing rounds corners off the surveyed path, which is
            how a line that clears a wall as a polyline ends up inside it once
            smoothed — Challenger, by 1.2 m.

       This asserts the outcome rather than any one of the three, so it holds
       however the next one arrives. It runs on the SHIPPED points, after
       smoothing and resampling, because that is the line that is ridden. */
    const inRing = (x, z, ring) => {
      let inside = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, zi] = ring[i];
        const [xj, zj] = ring[j];
        if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
      }
      return inside;
    };
    /* Against the FULL campus, not the crop: a building just outside the
       corridor is still a building you would drive through.

       And against the track's EDGES, not just the centreline: the edge sits
       half the track width off the line, and it was the edge that ran 26 m
       along the inside of Argo Hall while a centreline-only version of this
       test stayed green. */
    const half = DOC.game.halfWidth;
    const pts = DOC.route.points;
    const hits = new Map();
    const hit = (x, z, what) => {
      for (const b of CAMPUS.buildings) {
        if (!b?.p || !inRing(x, z, b.p)) continue;
        const key = `${what} inside ${b.n || "an unnamed building"}`;
        hits.set(key, (hits.get(key) || 0) + 1);
      }
    };
    for (let i = 0; i < pts.length; i++) {
      const [x, z] = pts[i];
      hit(x, z, "the centreline runs");
      const [px, pz] = pts[Math.max(0, i - 1)];
      const [nx, nz] = pts[Math.min(pts.length - 1, i + 1)];
      const len = Math.hypot(nx - px, nz - pz) || 1;
      const ox = -(nz - pz) / len;
      const oz = (nx - px) / len;
      hit(x + ox * half, z + oz * half, "the track's edge runs");
      hit(x - ox * half, z - oz * half, "the track's edge runs");
    }
    assert.deepEqual([...hits], [],
      `${[...hits].map(([n, c]) => `${n} (${c * 2} m)`).join(", ")}`);
  });

  test("keeps the fleet halls on the sides they were drawn on", () => {
    /* THE INSTRUCTION, AS A NUMBER.
     *
     * "have meteor on the right and atlantis on the left go straight" — and
     * this is the assertion that means it. Deviation from the drawn line says
     * how far off the route is; it does not say which SIDE of a building it
     * went, and the route being on the wrong side of Atlantis Hall was the
     * whole defect: it used to swing west round the far side of the fleet.
     *
     * scooter-ride.js positionAt defines the rider's right as the heading
     * rotated a quarter turn, `(-dz, dx)`. Dotting that with the vector to the
     * hall is therefore positive on the right and negative on the left, and it
     * is computed here the same way rather than copied, so a change to the
     * frame convention breaks this loudly instead of silently inverting it.
     *
     * On the names: Sahir called the right-hand hall Meteor, which is what
     * Apple's map labels it; this repo's OSM data calls that same building
     * Galathea and puts Meteor 40 m further east. The route is fitted to the
     * drawn geometry precisely so that neither label has to be right — but the
     * disagreement is real and is recorded in README.md. */
    const side = (name) => {
      const q = CAMPUS.places[name];
      assert.ok(q, `${name} is not a known place`);
      let best = Infinity;
      let at = 0;
      DOC.route.points.forEach(([x, z], i) => {
        const d = dist(x, z, q.x, q.z);
        if (d < best) { best = d; at = i; }
      });
      const a = DOC.route.points[Math.max(0, at - 3)];
      const b = DOC.route.points[Math.min(DOC.route.points.length - 1, at + 3)];
      const hx = b[0] - a[0];
      const hz = b[1] - a[1];
      const len = Math.hypot(hx, hz) || 1;
      const [px, pz] = DOC.route.points[at];
      /* The rider's right, exactly as positionAt builds it. */
      return ((-hz / len) * (q.x - px) + (hx / len) * (q.z - pz));
    };

    for (const name of ["Atlantis Hall", "Challenger Hall"]) {
      assert.ok(side(name) < -5, `${name} should pass on the rider's LEFT, but sits ${side(name).toFixed(1)} m to the right`);
    }
    for (const name of ["Galathea Hall", "Discovery Hall"]) {
      assert.ok(side(name) > 5, `${name} should pass on the rider's RIGHT, but sits ${(-side(name)).toFixed(1)} m to the left`);
    }
  });

  test("turns the way the route was described", () => {
    /* Bearing 0 = north, 90 = east. Read the route as a sentence: out of the
       courts and east across Eighth, north up the corridor between the fleet
       halls, east along Argo's south face, north up its east side, east into
       Revelle Plaza, then the long straight north to Peterson.
     *
     * The lookahead is 10 points — 20 m — deliberately. At 40 m several of
     * these stations average across the next corner and report a diagonal that
     * describes neither leg. The stations themselves sit mid-straight for the
     * same reason: a probe placed on a corner measures the corner, and then
     * nudging the route by a metre rewrites the expected number. */
    const bearingAt = (metres) => {
      const i = Math.round(metres / DOC.route.spacing);
      const a = DOC.route.points[i];
      const b = DOC.route.points[Math.min(DOC.route.points.length - 1, i + 10)];
      return ((Math.atan2(b[0] - a[0], -(b[1] - a[1])) * 180) / Math.PI + 360) % 360;
    };
    const east = (deg) => deg > 60 && deg < 130;
    const north = (deg) => deg < 25 || deg > 335;

    assert.ok(north(bearingAt(110)),
      `at 110 m the route heads ${bearingAt(110).toFixed(0)}deg, not north (the corridor through the fleet)`);
    assert.ok(east(bearingAt(200)),
      `at 200 m the route heads ${bearingAt(200).toFixed(0)}deg, not east (along Argo's south face)`);
    assert.ok(north(bearingAt(250)),
      `at 250 m the route heads ${bearingAt(250).toFixed(0)}deg, not north (up Argo's east side)`);
    assert.ok(east(bearingAt(290)),
      `at 290 m the route heads ${bearingAt(290).toFixed(0)}deg, not east (the turn into the plaza)`);
    for (const m of [440, 520, 600]) {
      assert.ok(north(bearingAt(m)), `at ${m} m the route heads ${bearingAt(m).toFixed(0)}deg, not north`);
    }
  });

  test("matches the line that was drawn on the map", () => {
    /* The builder's own gate, asserted here too against the SHIPPED file, so a
       hand-edited corridor cannot slip past by never being rebuilt. See
       DRAWN_REFERENCE in scripts/build-corridor.mjs for where the reference
       comes from and why its tolerance is about 5 m rather than centimetres. */
    const ref = builder.DRAWN_REFERENCE;
    const end = ref[ref.length - 1];
    const devAt = (x, z) => {
      let best = Infinity;
      for (let i = 0; i < ref.length - 1; i++) {
        const [ax, az] = ref[i];
        const [bx, bz] = ref[i + 1];
        const vx = bx - ax;
        const vz = bz - az;
        const L = vx * vx + vz * vz;
        let t = L ? ((x - ax) * vx + (z - az) * vz) / L : 0;
        t = Math.max(0, Math.min(1, t));
        best = Math.min(best, Math.hypot(x - (ax + t * vx), z - (az + t * vz)));
      }
      return best;
    };
    let cut = 0;
    let cutMiss = Infinity;
    DOC.route.points.forEach(([x, z], i) => {
      const d = dist(x, z, end[0], end[1]);
      if (d < cutMiss) { cutMiss = d; cut = i; }
    });
    let sum = 0;
    let worst = 0;
    for (let i = 0; i <= cut; i++) {
      const d = devAt(DOC.route.points[i][0], DOC.route.points[i][1]);
      sum += d;
      worst = Math.max(worst, d);
    }
    assert.ok(cut * DOC.route.spacing > 250,
      `only ${cut * DOC.route.spacing} m of route lies against the drawn line — it should cover its whole 310 m`);
    assert.ok(sum / (cut + 1) <= 5, `route averages ${(sum / (cut + 1)).toFixed(1)} m from the drawn line`);
    assert.ok(worst <= 12, `route strays ${worst.toFixed(1)} m from the drawn line`);
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
     * joins come out short. What matters is that the error is bounded and does
     * not accumulate: a short segment displaces the rider by less than the
     * shortfall at that one index and the next segment is back on the grid.
     *
     * THE LAST SEGMENT IS EXEMPT, and not as a concession. It is the remainder
     * of the division — whatever is left of the route after the last whole
     * step — so it is uniformly distributed over (0, spacing] by construction
     * and carries no information about drift at all. Bounding it near `spacing`
     * asserts something the resampler never promised, and the assertion duly
     * fired the day a route change happened to leave 1.20 m at the end. Every
     * INTERIOR segment is still held to the tight bound. */
    const gaps = [];
    for (let i = 1; i < DOC.route.points.length; i++) {
      const [ax, az] = DOC.route.points[i - 1];
      const [bx, bz] = DOC.route.points[i];
      gaps.push(dist(ax, az, bx, bz));
    }
    const interior = gaps.slice(0, -1);
    for (const [i, g] of interior.entries()) {
      assert.ok(Math.abs(g - DOC.route.spacing) < 0.6,
        `segment ${i + 1} is ${g.toFixed(2)} m, too far off ${DOC.route.spacing}`);
    }
    const tail = gaps.at(-1);
    assert.ok(tail > 0 && tail <= DOC.route.spacing + 1e-6,
      `the final remainder is ${tail.toFixed(2)} m, which is not a remainder of ${DOC.route.spacing}`);
    const loose = interior.filter((g) => Math.abs(g - DOC.route.spacing) > 0.15).length;
    assert.ok(loose <= 6, `${loose} interior segments are off-grid — expected only the leg joins`);

    /* The arc length the ride believes in must match the polyline it rides. */
    const walked = gaps.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(walked - DOC.route.metres) < 3,
      `route says ${DOC.route.metres} m but its polyline walks ${walked.toFixed(1)} m`);
  });
});


/* The staging corridor. Same line as the run — that is the point of it — so
   what there is to assert is that it really is the same line, and that the one
   thing it drops is the invented props and not a piece of the world. */
describe("the staging corridor", () => {
  test("rides the same route as the run", () => {
    /* A workbench on a different route is a workbench for something else. This
       was the first version's mistake: staging was the OLD 732 m Argo->Peterson
       stretch, so it was staging for a route that no longer existed. */
    assert.equal(STAGING.route.from, DOC.route.from);
    assert.equal(STAGING.route.to, DOC.route.to);
    assert.equal(STAGING.route.metres, DOC.route.metres);
    assert.deepEqual(STAGING.route.points, DOC.route.points);
  });

  test("carries the same measured world", () => {
    /* Dropping props must not quietly drop scenery with them. */
    assert.equal(STAGING.campus.buildings.length, DOC.campus.buildings.length);
    assert.equal(STAGING.lidar.trees.length, DOC.lidar.trees.length);
    assert.equal(STAGING.arcgis.ground.length, DOC.arcgis.ground.length);
    assert.ok(STAGING.eighth, "staging runs through Eighth College and must carry its survey");
  });

  test("carries no obstacles and no coins, and says so", () => {
    assert.equal(STAGING.game.props, false);
    assert.equal(STAGING.game.obstacles.length, 0);
    assert.equal(STAGING.game.coins.length, 0);
    /* Since 2026-08-16 the run mirrors staging: a clean ride. Both corridors
       must SAY they are deliberately empty — an accidental empty and this
       decision look identical in the file. */
    assert.equal(DOC.game.props, false);
    assert.equal(DOC.game.obstacles.length + DOC.game.coins.length, 0);
  });
});

describe("the two corridors are separate files", () => {
  test("each says which one it is", () => {
    /* The documents are the same shape AND now the same route, so a build
       written to the wrong path is otherwise completely silent.
       campus-scooter.js refuses to boot a file whose target does not match its
       mode; this is the same assertion at build time. */
    const targets = CORRIDORS.map((c) => c.doc.built.target);
    assert.deepEqual([...targets].sort(), ["scooter", "staging"]);
    for (const { spec, doc } of CORRIDORS) assert.equal(doc.built.target, spec.target);
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

    test("leave every group a gap the rider fits through", () => {
      /* The free-steering version of "never block every lane at once", and a
         stronger claim: it is re-derived from the placed widths in
         rider-centre space, because counting obstacles is not enough. The
         first build had a 1.7 m bench that read as one blocked slot and
         actually blocked two — a perfect line took 28 hits. This arithmetic
         is what would have caught it. */
      const byS = new Map();
      for (const o of game.obstacles) {
        if (!byS.has(o.s)) byS.set(o.s, []);
        byS.get(o.s).push(o);
      }
      const span = game.halfWidth - RIDER_HALF_W;
      for (const [s, group] of byS) {
        const blocked = group
          .map((o) => [o.off - o.w / 2 - RIDER_HALF_W, o.off + o.w / 2 + RIDER_HALF_W])
          .sort((a, b) => a[0] - b[0]);
        let cursor = -span;
        let widest = 0;
        for (const [a, b] of blocked) {
          widest = Math.max(widest, Math.min(a, span) - cursor);
          cursor = Math.max(cursor, b);
        }
        widest = Math.max(widest, span - cursor);
        assert.ok(widest >= builder.FREE_GAP_MIN_M,
          `the group at ${s} m leaves only a ${widest.toFixed(2)} m gap`);
        /* And no two of the group stand inside one another — a bench drawn
           through a planter is the defect the props pass exists to remove. */
        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++) {
            assert.ok(Math.abs(group[i].off - group[j].off) >= (group[i].w + group[j].w) / 2,
              `two obstacles at ${s} m interpenetrate`);
          }
        }
      }
    });

    test("leave time to react between groups", () => {
      const stops = [...new Set(game.obstacles.map((o) => o.s))].sort((a, b) => a - b);
      for (let i = 1; i < stops.length; i++) {
        assert.ok(stops[i] - stops[i - 1] >= builder.OBSTACLE_GAP_M,
          `groups at ${stops[i - 1]} m and ${stops[i]} m are ${(stops[i] - stops[i - 1]).toFixed(1)} m apart`);
      }
    });

    test("sit on the track, on the route", () => {
      if (!spec.props) {
        /* Nothing to place, and that is the corridor's whole job. Assert the
           empty is the DECLARED empty rather than skipping: an accidental
           empty and a deliberate one look identical from here. */
        assert.equal(game.props, false);
        assert.equal(game.obstacles.length + game.coins.length, 0);
        return;
      }
      for (const c of game.coins) {
        assert.ok(Math.abs(c.off) <= game.halfWidth, `coin offset ${c.off} m is off the track`);
        assert.ok(c.s >= 0 && c.s <= route.metres, `coin at ${c.s} m is off the route`);
        assert.ok(c.y > 0, "a coin is buried in the pavement");
      }
      for (const o of game.obstacles) {
        assert.ok(Math.abs(o.off) + o.w / 2 <= game.halfWidth + 0.01,
          `a ${o.kind} at offset ${o.off} m sticks out past the track's edge`);
        assert.equal(typeof o.hop, "boolean", "an obstacle does not say whether it can be hopped");
        assert.ok(o.h > 0, "an obstacle has no height");
      }
      assert.ok(game.obstacles.length > 20, "too few obstacles for a 1 km run");
      assert.ok(game.coins.length > 50, "too few coins for a 1 km run");
    });

    test("include obstacles a hop cannot clear", () => {
      if (!spec.props) return; // no props at all — covered by the test above
      /* If everything were hoppable the steering would be decoration. */
      const solid = game.obstacles.filter((o) => !o.hop);
      assert.ok(solid.length > 5, "nothing on the route actually requires a dodge");
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

describe("placeGame (the course the clean run no longer ships)", () => {
  /* Both shipped corridors are deliberately prop-free, but the placer and its
     guarantees stay load-bearing: switching props back on is one flag in
     ROUTES, and that flip must not resurrect a broken slalom. Generate the
     course the run WOULD carry and hold it to the bars the shipped file used
     to be held to. */
  const game = builder.placeGame(DOC.route, builder.mulberry32(DOC.game.seed), true);
  const span = game.halfWidth - RIDER_HALF_W;

  test("places a full course", () => {
    assert.ok(game.obstacles.length > 20, "too few obstacles for a 1 km run");
    assert.ok(game.coins.length > 50, "too few coins for a 1 km run");
    assert.ok(game.obstacles.filter((o) => !o.hop).length > 5,
      "nothing on the route actually requires a dodge");
  });

  test("keeps the clearances, stays on the track, and leaves every group a gap", () => {
    const byS = new Map();
    for (const o of game.obstacles) {
      assert.ok(o.s >= game.startClear && o.s <= DOC.route.metres - game.finishClear,
        `obstacle at ${o.s} m is in a clearance zone`);
      assert.ok(Math.abs(o.off) + o.w / 2 <= game.halfWidth + 0.01,
        `a ${o.kind} at offset ${o.off} m sticks out past the track's edge`);
      if (!byS.has(o.s)) byS.set(o.s, []);
      byS.get(o.s).push(o);
    }
    for (const [s, group] of byS) {
      const blocked = group
        .map((o) => [o.off - o.w / 2 - RIDER_HALF_W, o.off + o.w / 2 + RIDER_HALF_W])
        .sort((a, b) => a[0] - b[0]);
      let cursor = -span;
      let widest = 0;
      for (const [a, b] of blocked) {
        widest = Math.max(widest, Math.min(a, span) - cursor);
        cursor = Math.max(cursor, b);
      }
      widest = Math.max(widest, span - cursor);
      assert.ok(widest >= builder.FREE_GAP_MIN_M,
        `the group at ${s} m leaves only a ${widest.toFixed(2)} m gap`);
    }
    const stops = [...byS.keys()].sort((a, b) => a - b);
    for (let i = 1; i < stops.length; i++) {
      assert.ok(stops[i] - stops[i - 1] >= builder.OBSTACLE_GAP_M,
        `groups at ${stops[i - 1]} m and ${stops[i]} m are too close`);
    }
  });
});
