/* Campus Walk — gameplay invariants: the removed footway, the spawn, the
 * speed cap, and the minimap's arithmetic.
 *
 * Each of these is a promise the runtime makes that nothing else asserts:
 *
 *   1. The direct Argo Hall ↔ Peterson Hall footway (OSM way 1025633000) was
 *      removed ON PURPOSE — from the shipped data, and from the build script
 *      so a rebuild cannot quietly resurrect it. Routing between the two
 *      buildings must still succeed, the long way round.
 *   2. The spawn hangs exactly 110 m over Argo Hall and the fly speed caps at
 *      exactly 250 m/s. Both are exported constants precisely so this file
 *      can pin them.
 *   3. The minimap's world↔pixel transform round-trips, because the click
 *      that teleports you and the dot that shows you use the same numbers.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CAMPUS = JSON.parse(readFileSync(path.join(ROOT, "docs/data/campus-3d.json"), "utf8"));

const { buildGraph, routeBetween, routeThrough, makeMapTransform } = await import(
  path.join(ROOT, "docs/js/campus-route.js")
);
/* campus-walk.js touches no DOM at import time — boot() does — so Node can
   import it to read the constants the runtime actually uses. */
const { SPAWN_ALTITUDE_M, MAX_SPEED_MPS } = await import(
  path.join(ROOT, "docs/js/campus-walk.js")
);

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

  test("the shipped walk still routes start to end", () => {
    const plaza = CAMPUS.places["Revelle Plaza"];
    const ridge = CAMPUS.paths.filter((p) => p.n === "Ridge Walk").flatMap((p) => p.p);
    const target = { x: plaza.x, z: plaza.z - 300 };
    let end = null;
    let bestD = Infinity;
    for (const [x, z] of ridge) {
      const d = Math.hypot(x - target.x, z - target.z);
      if (d < bestD) { bestD = d; end = { x, z, name: "Ridge Walk" }; }
    }
    const walk = routeThrough(CAMPUS, GRAPH, ["Argo Hall", "Revelle Plaza", end]);
    assert.ok(walk.metres > 200 && walk.metres < 900,
      `the walk is ${walk.metres} m — it should be ~371 m`);
  });
});

/* --------------------------------------- 2. spawn and speed cap (R6, R7) */

describe("spawn altitude and speed cap are the promised numbers", () => {
  test("the spawn hangs 110 m over Argo Hall", () => {
    assert.equal(SPAWN_ALTITUDE_M, 110);
    assert.ok(CAMPUS.places["Argo Hall"], "Argo Hall must exist to spawn over");
    /* The runtime must actually use the constant against ground height —
       pinned to the source so a hardcoded copy cannot drift. */
    const src = readFileSync(path.join(ROOT, "docs/js/campus-walk.js"), "utf8");
    assert.match(src, /heightAt\(argo\.x,\s*argo\.z\)\s*\+\s*SPAWN_ALTITUDE_M/,
      "spawn y must be ground at Argo + SPAWN_ALTITUDE_M");
  });

  test("top speed is exactly 250 m/s and the curve is capped by it", () => {
    assert.equal(MAX_SPEED_MPS, 250);
    const src = readFileSync(path.join(ROOT, "docs/js/campus-walk.js"), "utf8");
    const uses = src.match(/MAX_SPEED_MPS/g) || [];
    assert.ok(uses.length >= 2, "MAX_SPEED_MPS must be used, not just exported");
  });

  test("walking pace on the ground is untouched", () => {
    const src = readFileSync(path.join(ROOT, "docs/js/campus-walk.js"), "utf8");
    assert.match(src, /WALK_SPEED = 1\.45/);
    assert.match(src, /FAST_SPEED = 4\.2/);
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
