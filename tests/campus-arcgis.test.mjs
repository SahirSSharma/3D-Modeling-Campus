/* campus-arcgis.json — is the university's ground plane still the ground?
 *
 * This file is a pull from UCSD's own facilities GIS (see the build script's
 * header for the endpoints). Three ways it has already gone or nearly gone
 * wrong, each asserted here:
 *
 *   1. Fuzzy name matching once handed "Biology" the floor count of a
 *      greenhouse at the Biology Field Station. Every storey entry must
 *      therefore imply a PLAUSIBLE storey height against the LiDAR-measured
 *      building, and the buildings the walk actually passes must be present.
 *   2. The ground polygons must lie inside the terrain grid — a polygon over
 *      unmeasured ground drapes onto nothing and renders as a hole in space.
 *   3. The Revelle Plaza fountain is the thing you steer by leaving Argo; the
 *      surveyed water polygons must include it.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ARCGIS = JSON.parse(readFileSync(path.join(ROOT, "docs/data/campus-arcgis.json"), "utf8"));
const LIDAR = JSON.parse(readFileSync(path.join(ROOT, "docs/data/campus-lidar.json"), "utf8"));
const CAMPUS = JSON.parse(readFileSync(path.join(ROOT, "docs/data/campus-3d.json"), "utf8"));

const { prepareGround, ringArea } = await import(path.join(ROOT, "docs/js/campus-ground.js"));
const { buildGraph, routeThrough } = await import(path.join(ROOT, "docs/js/campus-route.js"));

describe("the surveyed ground plane", () => {
  const KINDS = new Set(["walk", "road", "green", "water", "court"]);

  test("has real coverage and only known kinds", () => {
    assert.ok(ARCGIS.ground.length > 300, `only ${ARCGIS.ground.length} ground polygons`);
    for (const g of ARCGIS.ground) {
      assert.ok(KINDS.has(g.k), `unknown ground kind ${g.k}`);
      assert.ok(g.r.length >= 1 && g.r[0].length >= 3, "a polygon without an outer ring");
    }
  });

  test("every vertex sits inside the terrain grid", () => {
    const t = LIDAR.terrain;
    const x1 = t.x0 + (t.cols - 1) * t.cell;
    const z1 = t.z0 + (t.rows - 1) * t.cell;
    let out = 0;
    for (const g of ARCGIS.ground) {
      for (const ring of g.r) {
        for (const [dx, dz] of ring) {
          const x = dx / 10;
          const z = dz / 10;
          if (x < t.x0 - 1 || x > x1 + 1 || z < t.z0 - 1 || z > z1 + 1) out++;
        }
      }
    }
    assert.equal(out, 0, `${out} ground vertices outside the terrain grid`);
  });

  test("load-time expansion yields drapeable pieces, nothing degenerate", () => {
    const pieces = prepareGround(ARCGIS);
    assert.ok(pieces.length >= ARCGIS.ground.length, "tiling lost polygons");
    for (const p of pieces) {
      const span = (ring) => {
        let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity;
        for (const [x, z] of ring) {
          if (x < minx) minx = x;
          if (x > maxx) maxx = x;
          if (z < minz) minz = z;
          if (z > maxz) maxz = z;
        }
        return Math.max(maxx - minx, maxz - minz);
      };
      /* The whole point of tiling: no draped piece may span more ground than
         one tile, or it bridges dips in the terrain. */
      assert.ok(span(p.rings[0]) <= 29, `a ground piece spans ${span(p.rings[0]).toFixed(0)} m`);
      assert.ok(Math.abs(ringArea(p.rings[0])) > 0.5, "a degenerate sliver survived tiling");
    }
  });

  test("the walk is paved: the whole route lies on surveyed pavement", () => {
    /* When this was written, 371 of 371 route points sat on the university's
       own sidewalk/road polygons — the real walk really is paved the whole
       way. The threshold leaves room for survey updates, not for the route
       drifting onto lawns. */
    const walk = routeThrough(CAMPUS, buildGraph(CAMPUS), ["Argo Hall", "Revelle Plaza", "Peterson Hall"]);
    const paved = prepareGround(ARCGIS).filter((p) => ["walk", "road", "court"].includes(p.kind));
    const inside = (pt, ring) => {
      let ins = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, zi] = ring[i];
        const [xj, zj] = ring[j];
        if (zi > pt.z !== zj > pt.z && pt.x < ((xj - xi) * (pt.z - zi)) / (zj - zi) + xi) ins = !ins;
      }
      return ins;
    };
    const on = walk.points.filter((pt) => paved.some((p) => inside(pt, p.rings[0]))).length;
    const share = on / walk.points.length;
    assert.ok(
      share >= 0.85,
      `only ${(share * 100).toFixed(0)}% of route points sit on surveyed pavement`
    );
  });

  test("the Revelle Plaza fountain made it through as water", () => {
    const fountain = CAMPUS.places["Revelle Plaza Fountain"];
    assert.ok(fountain, "fountain missing from campus places");
    const near = ARCGIS.ground.filter((g) => {
      if (g.k !== "water") return false;
      const [dx, dz] = g.r[0][0];
      return Math.hypot(dx / 10 - fountain.x, dz / 10 - fountain.z) < 40;
    });
    assert.ok(near.length >= 1, "no surveyed water within 40 m of the Revelle Plaza fountain");
  });
});

describe("storeys are the university's, sanity-checked against LiDAR", () => {
  test("the buildings framing the walk carry real floor counts", () => {
    for (const name of ["Argo Hall", "Blake Hall", "Urey Hall", "Mayer Hall", "Geisel Library"]) {
      assert.ok(ARCGIS.buildings[name]?.levels, `${name} has no floor count`);
    }
  });

  test("Argo Hall has six floors, as the university says", () => {
    assert.equal(ARCGIS.buildings["Argo Hall"].levels, 6);
  });

  test("every storey entry implies a believable storey height", () => {
    /* EPOCH RULE: the LiDAR flew in 2014. For buildings flagged `newer` —
       built after the survey — the GIS height is the truth and the LiDAR
       "height" is the ground that was there before (Sankofa: 8.4 m of
       parking lot under a 64 m tower). */
    const bad = [];
    for (const [name, info] of Object.entries(ARCGIS.buildings)) {
      const h = info.newer ? info.height : (LIDAR.heights[name] ?? info.height);
      const storey = h / info.levels;
      if (storey < 2.1 || storey > 6.6) bad.push(`${name}: ${info.levels} levels over ${h} m`);
    }
    assert.deepEqual(bad, [], bad.join("; "));
  });

  test("where both sources saw the SAME building, their heights agree", () => {
    /* Loose tolerance on purpose: facilities quotes architectural height,
       LiDAR sees rooftop plant. Wild disagreement means a mis-join — except
       for `newer` buildings, where the two sources measured different
       decades and disagreement is the whole point of the flag. */
    const wild = [];
    for (const [name, info] of Object.entries(ARCGIS.buildings)) {
      const lidarH = LIDAR.heights[name];
      if (!lidarH || !info.height || info.newer) continue;
      if (Math.abs(lidarH - info.height) > Math.max(8, lidarH * 0.45)) {
        wild.push(`${name}: GIS ${info.height} m vs LiDAR ${lidarH} m`);
      }
    }
    assert.deepEqual(wild, [], wild.join("; "));
  });

  test("the massing knows the real skyline: the PCW towers top the campus", () => {
    /* The user-facing claim of the full-campus build. The 2014 survey cannot
       see the new east-campus towers; the facilities massing must. */
    assert.ok(ARCGIS.massing.length > 300, `only ${ARCGIS.massing.length} massing parts`);
    const tallest = [...ARCGIS.massing].sort((a, b) => b.h - a.h)[0];
    assert.ok(
      /PCWest|Vela|Rya/.test(tallest.n) && tallest.h > 60,
      `tallest mass is ${tallest.n} at ${tallest.h} m — expected a Pepper Canyon West tower over 60 m`
    );
    const sankofa = ARCGIS.massing.find((m) => /Sankofa Tower/.test(m.n));
    assert.ok(sankofa && sankofa.h > 55, "Sankofa Tower missing or flattened");
  });

  test("Geisel ships as a floor stack, not a prism", () => {
    assert.ok(ARCGIS.geiselFloors?.length >= 6, "Geisel floor polygons missing");
    for (const f of ARCGIS.geiselFloors) {
      assert.ok(f.rings?.[0]?.length >= 3 && f.h > 2, `floor ${f.name} degenerate`);
    }
  });
});
