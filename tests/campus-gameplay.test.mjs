/* Campus Walk — gameplay invariants: the removed footway, the spawn, the
 * speed cap, and the minimap's arithmetic.
 *
 * Each of these is a promise the runtime makes that nothing else asserts:
 *
 *   1. The direct Argo Hall ↔ Peterson Hall footway (OSM way 1025633000) was
 *      removed ON PURPOSE — from the shipped data, and from the build script
 *      so a rebuild cannot quietly resurrect it. Routing between the two
 *      buildings must still succeed, the long way round.
 *   2. The spawn hangs exactly 110 m over Argo Hall at exactly 500 m/s, and
 *      the fly speed caps at exactly 2000 m/s. All three are exported
 *      constants precisely so this file can pin them, and the arrow keys —
 *      the throttle — must stay inside the cap at both rates.
 *   3. The minimap's world↔pixel transform round-trips, because the click
 *      that teleports you and the dot that shows you use the same numbers.
 *
 * The routing assertions used to protect a guided walk on a rail. That mode is
 * gone and free roam is the only way you move, but campus-route.js stayed: it
 * is what scripts/audit-accuracy.mjs routes our footpaths through to compare
 * them against a real pedestrian router. So the routes below are the audit's
 * fixture now, not a feature's itinerary — same arithmetic, different reader.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CAMPUS = JSON.parse(readFileSync(path.join(ROOT, "docs/data/campus-3d.json"), "utf8"));

const { buildGraph, routeBetween, routeThrough, makeMapTransform } = await import(
  path.join(ROOT, "docs/js/campus-route.js")
);
/* campus-walk.js touches no DOM at import time — boot() does — so Node can
   import it to read the constants the runtime actually uses. */
const { SPAWN_ALTITUDE_M, SPAWN_SPEED_MPS, MAX_SPEED_MPS } = await import(
  path.join(ROOT, "docs/js/campus-walk.js")
);
const {
  createExplore, sliderToSpeed, speedToSlider, stepSpeed,
  SPEED_RATE_COARSE, SPEED_RATE_FINE, SHIFT_MULT,
} = await import(path.join(ROOT, "docs/js/campus-explore.js"));

const GRAPH = buildGraph(CAMPUS);

/* The removed way, as shipped before removal: 13 vertices from Ridge Walk at
   (64.5,-119.8) north to (44.3,-31). The two ANCHORS are interior points far
   apart on it; a path is "the removed way" only if it passes within a metre
   of BOTH, so a path that merely crosses a former junction can never match.
   The INTERIOR vertices are the ones no other way shares — the endpoints and
   (61.4,-93.3) and (45,-40.1) are junctions other ways legitimately keep. */
const ANCHORS = [[64.5, -106.7], [45.0, -40.1]];
const INTERIOR = [
  [64.5, -106.7], [63.6, -100.1], [58.6, -87.2], [56, -83.3],
  [50.3, -77.2], [47.2, -72.5], [45.5, -68.4], [45, -63.3],
];

const segDist = (p, a, b) => {
  const vx = b[0] - a[0], vz = b[1] - a[1];
  const t = Math.max(0, Math.min(1,
    ((p[0] - a[0]) * vx + (p[1] - a[1]) * vz) / (vx * vx + vz * vz || 1)));
  return Math.hypot(p[0] - (a[0] + vx * t), p[1] - (a[1] + vz * t));
};
const spansBothAnchors = (pts) => ANCHORS.every((anchor) => {
  for (let i = 1; i < pts.length; i++) {
    if (segDist(anchor, pts[i - 1], pts[i]) < 1.0) return true;
  }
  return false;
});

/* ------------------------------------------- 1. the removed footway (R8) */

describe("the Argo ↔ Peterson footway is removed, and stays removed", () => {
  test("no shipped path spans the removed way", () => {
    const matches = CAMPUS.paths.filter((p) => spansBothAnchors(p.p));
    assert.equal(matches.length, 0,
      `${matches.length} path(s) still trace the removed Argo–Peterson footway`);
  });

  test("no graph node sits on the removed way's interior", () => {
    /* Connectivity comes purely from coincident vertices, so if none of the
       way's unshared vertices exist as nodes, no route can travel it. */
    const offenders = [];
    for (const n of GRAPH.nodes) {
      for (const [x, z] of INTERIOR) {
        if (Math.hypot(n.x - x, n.z - z) < 0.3) offenders.push(`(${x},${z})`);
      }
    }
    assert.deepEqual(offenders, [], `graph still knows: ${offenders.join(", ")}`);
  });

  test("the build script blacklists the way, so a rebuild keeps it out", () => {
    const src = readFileSync(path.join(ROOT, "scripts/build-campus-3d.mjs"), "utf8");
    assert.match(src, /EXCLUDED_WAYS\s*=\s*new Set\(\[\s*1025633000/,
      "EXCLUDED_WAYS must carry OSM way 1025633000");
    assert.match(src, /EXCLUDED_WAYS\.has\(el\.id\)/,
      "the build loop must consult EXCLUDED_WAYS");
    assert.match(src, /matchesExcludedAnchors/,
      "the geometric belt-and-braces check must exist for way-id churn");
  });

  test("Argo Hall → Peterson Hall still routes, the long way round", () => {
    const r = routeBetween(CAMPUS, GRAPH, "Argo Hall", "Peterson Hall");
    assert.ok(r.points.length > 50, "route came back suspiciously short");
    assert.ok(r.metres > 700 && r.metres < 950,
      `Argo → Peterson is ${r.metres} m — expected ~785 m via the eastern walkway`);
    /* And it never rides the ghost of the removed way: no route point may lie
       on the old centreline — except near the junctions other surviving ways
       legitimately keep ((61.4,-93.3) is where the eastern walkway diverges,
       and it sits ON the old line; crossing a junction is not travelling the
       way). */
    const JUNCTIONS = [[64.5, -119.8], [44.3, -31], [61.4, -93.3], [45, -40.1]];
    const removedLine = [[64.5, -119.8], ...INTERIOR, [45, -40.1], [44.3, -31]];
    const offenders = r.points.filter((pt) => {
      if (JUNCTIONS.some(([jx, jz]) => Math.hypot(pt.x - jx, pt.z - jz) < 8)) return false;
      for (let i = 1; i < removedLine.length; i++) {
        if (segDist([pt.x, pt.z], removedLine[i - 1], removedLine[i]) < 1.5) return true;
      }
      return false;
    });
    assert.equal(offenders.length, 0,
      `${offenders.length} route points still travel the removed footway`);
  });

  test("the accuracy audit's reference route still chains its three legs", () => {
    /* Argo Hall → Revelle Plaza → a point 300 m north of it up Ridge Walk,
       built here exactly as scripts/audit-accuracy.mjs builds it — the middle
       leg is a named place and the last is a bare coordinate snapped onto the
       path, which is a different code path through routeThrough than a pair of
       names. It was the guided walk's itinerary before the walk was deleted;
       the audit inherited it, so a break here breaks `audit:accuracy` rather
       than a rendered route. */
    const plaza = CAMPUS.places["Revelle Plaza"];
    const ridge = CAMPUS.paths.filter((p) => p.n === "Ridge Walk").flatMap((p) => p.p);
    const target = { x: plaza.x, z: plaza.z - 300 };
    let end = null;
    let bestD = Infinity;
    for (const [x, z] of ridge) {
      const d = Math.hypot(x - target.x, z - target.z);
      if (d < bestD) { bestD = d; end = { x, z, name: "Ridge Walk" }; }
    }
    const route = routeThrough(CAMPUS, GRAPH, ["Argo Hall", "Revelle Plaza", end]);
    assert.ok(route.metres > 200 && route.metres < 900,
      `the reference route is ${route.metres} m — it should be ~371 m`);
  });
});

/* --------------------------------------- 2. spawn and speed cap (R6, R7) */

describe("spawn altitude and speed cap are the promised numbers", () => {
  test("the spawn hangs 110 m over Argo Hall", () => {
    assert.equal(SPAWN_ALTITUDE_M, 110);
    assert.ok(CAMPUS.places["Argo Hall"], "Argo Hall must exist to spawn over");
    /* Free roam holds `hover` metres over the ground beneath you, so the
       spawn IS ground-at-Argo + SPAWN_ALTITUDE_M. Pinned to the source so a
       hardcoded copy cannot drift: boot must enter at Argo and set the hover
       from the constant. */
    const src = readFileSync(path.join(ROOT, "docs/js/campus-walk.js"), "utf8");
    /* Since the game pause (2026-08-17) the spawn point is per-mode, but the
       default — free roam — must still fall through to Argo Hall. */
    assert.match(src, /const at = SPAWNS\[mode\] \|\| argo/,
      "free roam must fall through to the Argo Hall spawn");
    assert.match(src, /explore\.enterAt\(at\.x,\s*at\.z/,
      "boot must spawn at the mode's spawn point");
    assert.match(src, /explore\.hover\s*=\s*SPAWN_ALTITUDE_M/,
      "spawn height must come from SPAWN_ALTITUDE_M, not a copy of it");
  });

  test("top speed is exactly 2000 m/s, reachable, and a hard cap", () => {
    assert.equal(MAX_SPEED_MPS, 2000);
    /* Reachable: the slider's top IS the cap. */
    assert.ok(Math.abs(sliderToSpeed(1) - MAX_SPEED_MPS) < 1e-9,
      `full slider gives ${sliderToSpeed(1)} m/s, not ${MAX_SPEED_MPS}`);
    /* A cap: shift on top of the full slider must not pass it. One second of
       simulated movement may cover at most MAX_SPEED_MPS metres. */
    const flat = { x0: -5000, z0: -5000, cell: 10, cols: 1001, rows: 1001 };
    const ex = createExplore({
      campus: { places: {} },
      lidar: { terrain: flat },
      heightAt: () => 0,
    });
    ex.enterAt(0, 0, 0);
    ex.speed = sliderToSpeed(1);
    const held = new Set(["w", "shift"]);
    let travelled = 0;
    for (let i = 0; i < 100; i++) {
      const before = { x: ex.x, z: ex.z };
      ex.update(0.01, held);
      travelled += Math.hypot(ex.x - before.x, ex.z - before.z);
    }
    assert.ok(travelled <= MAX_SPEED_MPS + 1e-6,
      `shift at full slider covered ${travelled.toFixed(1)} m in 1 s — the cap leaks`);
    assert.ok(travelled > MAX_SPEED_MPS * 0.99,
      `full slider only covered ${travelled.toFixed(1)} m in 1 s — ${MAX_SPEED_MPS} is not reachable`);
  });

  test("shift doubles the current speed, under the cap", () => {
    assert.equal(SHIFT_MULT, 2);
    const flat = { x0: -5000, z0: -5000, cell: 10, cols: 1001, rows: 1001 };
    const ex = createExplore({
      campus: { places: {} }, lidar: { terrain: flat }, heightAt: () => 0,
    });
    const run = (keys, speed) => {
      ex.enterAt(0, 0, 0);
      ex.speed = speed;
      let travelled = 0;
      for (let i = 0; i < 100; i++) {
        const before = { x: ex.x, z: ex.z };
        ex.update(0.01, new Set(keys));
        travelled += Math.hypot(ex.x - before.x, ex.z - before.z);
      }
      return travelled;
    };

    /* From the spawn speed, one second of shift must cover exactly twice the
       metres one second without it does — and in every direction you can
       travel, because the multiplier is applied ONCE to a scalar velocity and
       a per-key copy of it is exactly the drift that would go unnoticed:
       sprinting forward and strolling sideways still looks like movement. */
    for (const dir of ["w", "s", "a", "d"]) {
      const plain = run([dir], SPAWN_SPEED_MPS);
      const shifted = run([dir, "shift"], SPAWN_SPEED_MPS);
      assert.ok(Math.abs(plain - SPAWN_SPEED_MPS) < 1e-6,
        `a second of ${dir} at the spawn speed covered ${plain.toFixed(1)} m, not ${SPAWN_SPEED_MPS}`);
      assert.ok(Math.abs(shifted - plain * SHIFT_MULT) < 1e-6,
        `${dir} + shift turned ${plain.toFixed(1)} m into ${shifted.toFixed(1)} m, not double`);
    }

    /* Shift is a multiplier under a ceiling, and the ceiling is what it once
       lacked: the deleted guided walk carried a 2.9 of its own and no cap at
       all, so the rail outran the flight. From three-quarters of the cap,
       doubling must land ON MAX_SPEED_MPS and not 1.5× past it. */
    const capped = run(["w", "shift"], MAX_SPEED_MPS * 0.75);
    assert.ok(Math.abs(capped - MAX_SPEED_MPS) < 1e-6,
      `shift at ${MAX_SPEED_MPS * 0.75} m/s covered ${capped.toFixed(1)} m in 1 s — the cap leaks`);

    /* One multiplier, one declaration. There is a single mode now, so nothing
       CAN disagree about what shift means — but that is a fact about today's
       module list, and this is the invariant that outlived the mode it was
       written for: whatever imports SHIFT_MULT, campus-explore.js is the only
       file allowed to say what it is. Asserted across the whole of docs/js
       rather than against one file, because the failure was never "campus-walk
       declared one" — it was "two modules each declared one". */
    const declaring = readdirSync(path.join(ROOT, "docs/js"))
      .filter((f) => f.endsWith(".js"))
      .filter((f) => /SHIFT_MULT\s*=/.test(readFileSync(path.join(ROOT, "docs/js", f), "utf8")));
    assert.deepEqual(declaring, ["campus-explore.js"],
      `SHIFT_MULT is declared in ${declaring.join(", ") || "nothing"} — it belongs to campus-explore.js alone`);
  });

  test("you spawn at 500 m/s, and the state starts there", () => {
    assert.equal(SPAWN_SPEED_MPS, 500);
    assert.ok(SPAWN_SPEED_MPS < MAX_SPEED_MPS, "the spawn speed must leave room to climb");
    /* Pinned to the source so a hardcoded copy cannot drift: the velocity the
       slider and the arrow keys share must be seeded FROM the constant. */
    const src = readFileSync(path.join(ROOT, "docs/js/campus-walk.js"), "utf8");
    assert.match(src, /speed:\s*SPAWN_SPEED_MPS/,
      "state.speed must come from SPAWN_SPEED_MPS, not a copy of it");
  });

  test("the arrow keys steer the velocity — coarse up/down, fine left/right", () => {
    const s0 = SPAWN_SPEED_MPS;
    const up = stepSpeed(s0, 1, new Set(["arrowup"]));
    const down = stepSpeed(s0, 1, new Set(["arrowdown"]));
    const right = stepSpeed(s0, 1, new Set(["arrowright"]));
    const left = stepSpeed(s0, 1, new Set(["arrowleft"]));

    assert.ok(up > s0 && right > s0, "up and right must speed you up");
    assert.ok(down < s0 && left < s0, "down and left must slow you down");
    /* "High rate" and "low rate" is the whole point of having two pairs:
       one second of up/down must move the throttle further than one second
       of left/right, in both directions. */
    assert.ok(up - s0 > right - s0, "up/down is not the coarser pair");
    assert.ok(s0 - down > s0 - left, "up/down is not the coarser pair downwards");
    assert.ok(SPEED_RATE_COARSE > SPEED_RATE_FINE * 3,
      "the two rates are too close to feel like different controls");

    /* Rates are in slider fractions per second, so a full sweep of the
       logarithmic axis is 1 / rate seconds. */
    const sweep = (rate) => 1 / rate;
    assert.ok(sweep(SPEED_RATE_COARSE) < 5,
      `coarse takes ${sweep(SPEED_RATE_COARSE).toFixed(1)} s end to end — not a high rate`);
    assert.ok(sweep(SPEED_RATE_FINE) > 10,
      `fine takes ${sweep(SPEED_RATE_FINE).toFixed(1)} s end to end — not a low rate`);

    /* Neither pair may steer out of the slider's range, however long it is
       held: the cap is the cap and the floor is a walking pace. */
    let held = SPAWN_SPEED_MPS;
    for (let i = 0; i < 600; i++) held = stepSpeed(held, 0.05, new Set(["arrowup", "arrowright"]));
    assert.ok(Math.abs(held - MAX_SPEED_MPS) < 1e-6,
      `holding up for 30 s reached ${held}, not the ${MAX_SPEED_MPS} cap`);
    for (let i = 0; i < 600; i++) held = stepSpeed(held, 0.05, new Set(["arrowdown", "arrowleft"]));
    assert.ok(Math.abs(speedToSlider(held)) < 1e-9,
      `holding down for 30 s reached ${held}, past the bottom of the slider`);
  });

  test("the arrow keys no longer move or turn free roam", () => {
    /* They are the throttle now. A stale alias would make one key do two
       jobs at once — fly forward AND wind the speed up while doing it. */
    const flat = { x0: -5000, z0: -5000, cell: 10, cols: 1001, rows: 1001 };
    const ex = createExplore({
      campus: { places: {} }, lidar: { terrain: flat }, heightAt: () => 0,
    });
    ex.speed = SPAWN_SPEED_MPS;
    for (const key of ["arrowup", "arrowdown", "arrowleft", "arrowright"]) {
      ex.enterAt(0, 0, 0);
      ex.hover = 50;
      ex.update(0.5, new Set([key]));
      assert.equal(ex.x, 0, `${key} still moves free roam in x`);
      assert.equal(ex.z, 0, `${key} still moves free roam in z`);
      assert.equal(ex.yaw, 0, `${key} still turns free roam`);
      assert.equal(ex.hover, 50, `${key} still changes altitude`);
    }
  });
});

/* ------------------------------------------- 3. the minimap's arithmetic */

describe("minimap transform: clicks land where the dot says", () => {
  /* Same bounds recipe the runtime uses: everything drawable, padded. */
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of CAMPUS.paths) {
    for (const [x, z] of p.p) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
  }
  const bounds = { minX: minX - 60, maxX: maxX + 60, minZ: minZ - 60, maxZ: maxZ + 60 };
  const W = 760, H = 1100;
  const tf = makeMapTransform(bounds, W, H);

  test("pixel → world → pixel round-trips within a pixel", () => {
    for (const [mx, my] of [[0, 0], [W, H], [W / 2, H / 2], [123.4, 987.6], [W, 0]]) {
      const [x, z] = tf.toWorld(mx, my);
      const [mx2, my2] = tf.toMap(x, z);
      assert.ok(Math.hypot(mx2 - mx, my2 - my) < 1,
        `(${mx},${my}) round-tripped to (${mx2},${my2})`);
    }
  });

  test("world → pixel → world round-trips within a tenth of a metre", () => {
    const argo = CAMPUS.places["Argo Hall"];
    const peterson = CAMPUS.places["Peterson Hall"];
    for (const p of [argo, peterson, { x: bounds.minX, z: bounds.minZ }]) {
      const [mx, my] = tf.toMap(p.x, p.z);
      const [x2, z2] = tf.toWorld(mx, my);
      assert.ok(Math.hypot(x2 - p.x, z2 - p.z) < 0.1,
        `(${p.x},${p.z}) round-tripped to (${x2},${z2})`);
    }
  });

  test("the map is north-up and everything fits on the canvas", () => {
    /* +z is SOUTH, so a more northern point (smaller z) must land HIGHER on
       the map (smaller pixel y) — the convention every map reader assumes. */
    const [, southY] = tf.toMap(0, 100);
    const [, northY] = tf.toMap(0, -100);
    assert.ok(northY < southY, "north is not up");
    for (const p of CAMPUS.paths) {
      for (const [x, z] of p.p) {
        const [mx, my] = tf.toMap(x, z);
        assert.ok(mx >= -0.5 && mx <= W + 0.5 && my >= -0.5 && my <= H + 0.5,
          `(${x},${z}) maps off-canvas at (${mx},${my})`);
      }
    }
  });
});

/* ------------------------------------------------ 4. the boundary contract */

describe("campus boundary file, when present, honours the contract", () => {
  /* The boundary is generated by a separate pipeline and is OPTIONAL at
     runtime — the minimap draws it if it exists and carries on if not. When
     the file IS shipped it must be the shape the drawing code expects. */
  const file = path.join(ROOT, "docs/data/campus-boundary.json");
  test("points are finite [x,z] pairs in local metres", (t) => {
    if (!existsSync(file)) {
      t.skip("campus-boundary.json not generated yet — runtime falls back gracefully");
      return;
    }
    const b = JSON.parse(readFileSync(file, "utf8"));
    assert.ok(Array.isArray(b.points), "boundary must carry a points array");
    assert.ok(b.points.length >= 3, `only ${b.points?.length} boundary points`);
    for (const pt of b.points) {
      assert.ok(Array.isArray(pt) && pt.length >= 2, "each point must be [x, z]");
      assert.ok(Number.isFinite(pt[0]) && Number.isFinite(pt[1]), "boundary point is not finite");
      assert.ok(Math.abs(pt[0]) < 20000 && Math.abs(pt[1]) < 20000,
        `boundary point (${pt[0]}, ${pt[1]}) is not in local metres`);
    }
  });
});
