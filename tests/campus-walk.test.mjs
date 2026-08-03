/* Campus Walk — is the campus it draws the campus that is there?
 *
 * The whole claim of this feature is accuracy, and accuracy is the easiest
 * thing in the world to lose silently. A wrong building height renders
 * beautifully. A route that skirts Revelle Plaza instead of crossing it looks
 * like a route. A terrain grid full of holes looks like a lawn until you fall
 * through it. None of that throws.
 *
 * So these assert the specific ways this has ALREADY been wrong:
 *
 *   1. Heights come from LiDAR, not from OpenStreetMap. OSM had Argo Hall
 *      4.5 m too tall and Blake Hall 3 m too tall — the two buildings you
 *      stand between at the start of the walk — and had nothing at all to say
 *      about most of the rest.
 *   2. The walk crosses the plaza. Routed on OSM lines alone, Argo Hall to the
 *      middle of Revelle Plaza came out at 390 m, around a square you can see
 *      across. It is 55 m.
 *   3. The terrain is a surface, not a sheet with holes in it.
 *   4. THE GUARD: the geometry still agrees with what the rest of the site
 *      ships, so the Campus Map and the walk cannot disagree about where a
 *      building is.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CAMPUS = JSON.parse(readFileSync(path.join(ROOT, "docs/data/campus-3d.json"), "utf8"));
const LIDAR = JSON.parse(readFileSync(path.join(ROOT, "docs/data/campus-lidar.json"), "utf8"));
const BUILDINGS = JSON.parse(readFileSync(path.join(ROOT, "tests/fixtures/buildings.json"), "utf8"));

const { buildGraph, routeThrough, routeBetween } = await import(
  path.join(ROOT, "docs/js/campus-route.js")
);

const GRAPH = buildGraph(CAMPUS);

/* The walk, as described: out of Argo, across the plaza, onto Ridge Walk. */
const START = "Argo Hall";
const VIA = "Revelle Plaza";

function ridgeWalkDestination() {
  const plaza = CAMPUS.places[VIA];
  const ridge = CAMPUS.paths.filter((p) => p.n === "Ridge Walk").flatMap((p) => p.p);
  const target = { x: plaza.x, z: plaza.z - 300 };
  let best = null;
  let bestD = Infinity;
  for (const [x, z] of ridge) {
    const d = Math.hypot(x - target.x, z - target.z);
    if (d < bestD) { bestD = d; best = { x, z, name: "Ridge Walk" }; }
  }
  return best;
}

function insideRing(pt, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if (zi > pt.z !== zj > pt.z && pt.x < ((xj - xi) * (pt.z - zi)) / (zj - zi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function project(lat, lng) {
  const { mPerDegLat, mPerDegLng } = CAMPUS.origin;
  return { x: (lng - CAMPUS.origin.lng) * mPerDegLng, z: -(lat - CAMPUS.origin.lat) * mPerDegLat };
}

/* --------------------------------------------------------- 0. the fetches */

describe("the data paths the browser asks for", () => {
  test("campus-walk.js resolves both datasets to files that exist", () => {
    /* tests/data/client-data-paths.test.mjs pins every fetch("…") string
       literal to a real file, after a shipped feature spent a day silently
       404ing. It cannot see these: campus-walk.js builds its URLs with
       new URL(…, import.meta.url) so they resolve against the module rather
       than whichever page loaded it — the more robust spelling, and precisely
       why it needs its own assertion rather than none. */
    const src = readFileSync(path.join(ROOT, "docs/js/campus-walk.js"), "utf8");
    const urls = [...src.matchAll(/new URL\(\s*["']([^"']+)["']\s*,\s*import\.meta\.url\s*\)/g)];
    assert.ok(urls.length >= 2, "campus-walk.js should resolve both campus-3d and campus-lidar");
    for (const [, rel] of urls) {
      const resolved = path.resolve(path.join(ROOT, "docs/js"), rel);
      assert.ok(existsSync(resolved), `campus-walk.js fetches ${rel} — resolves to a missing file`);
    }
  });
});

/* --------------------------------------------- 1. heights are MEASURED */

describe("building heights come from LiDAR, not from tags", () => {
  test("the buildings the walk starts between are measured", () => {
    for (const name of [START, "Blake Hall"]) {
      assert.ok(LIDAR.heights[name], `${name} has no measured height`);
    }
  });

  test("a good share of the corridor is measured, not guessed", () => {
    const measured = Object.keys(LIDAR.heights).length;
    assert.ok(measured >= 40, `only ${measured} buildings carry a measured height`);
  });

  test("LiDAR overrides OSM where the two disagree", () => {
    /* The regression that matters. If the renderer ever stops preferring the
       measured value, Argo Hall silently returns to OSM's 22.8 m — the first
       building on the walk, and 4.5 m too tall. Asserted on the DATA rather
       than the renderer so it fails at build time. */
    const osm = new Map(CAMPUS.buildings.filter((b) => b.n).map((b) => [b.n, b.h]));
    const argoOsm = osm.get(START);
    const argoLidar = LIDAR.heights[START];
    assert.ok(argoOsm && argoLidar, "Argo Hall must appear in both datasets");
    assert.ok(
      Math.abs(argoOsm - argoLidar) > 2,
      `Argo Hall: OSM ${argoOsm} m vs LiDAR ${argoLidar} m — these were 4.5 m apart; ` +
      `if they now agree, check the LiDAR pipeline still ran`
    );
    assert.ok(argoLidar > 8 && argoLidar < 30, `Argo Hall measured ${argoLidar} m — implausible`);
  });

  test("no measured height is nonsense", () => {
    const bad = Object.entries(LIDAR.heights)
      .filter(([, h]) => !Number.isFinite(h) || h < 2 || h > 70)
      .map(([n, h]) => `${n} ${h}m`);
    assert.deepEqual(bad, [], `implausible measured heights: ${bad.join(", ")}`);
  });

  test("the tall buildings really are the tall ones", () => {
    /* A sanity check that each measurement is attached to the right footprint.
       If heights were ever mis-joined to buildings, this scrambles. */
    const tall = Object.entries(LIDAR.heights)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([n]) => n);
    const expected = ["Urey Hall", "Pacific Hall", "Applied Physics and Mathematics"];
    const found = expected.filter((n) => tall.includes(n));
    assert.ok(
      found.length >= 2,
      `expected the science towers among the tallest; got ${tall.slice(0, 6).join(", ")}`
    );
  });
});

/* ------------------------------------------------------------ 2. the walk */

describe(`the walk: ${START} → ${VIA} → Ridge Walk`, () => {
  const end = ridgeWalkDestination();
  const walk = routeThrough(CAMPUS, GRAPH, [START, VIA, end]);
  const plaza = CAMPUS.surfaces.find((s) => s.n === VIA);

  test("Revelle Plaza is mapped as a surface, with its fountain", () => {
    assert.ok(plaza, "Revelle Plaza missing from surfaces");
    assert.equal(plaza.kind, "plaza");
    assert.ok(plaza.p.length >= 8, `plaza has only ${plaza.p.length} vertices`);
    const fountain = CAMPUS.surfaces.find((s) => s.n === "Revelle Plaza Fountain");
    assert.ok(fountain, "the plaza fountain is missing — it is the thing you steer by");
  });

  test("you can cut across the plaza instead of walking round it", () => {
    /* Before plazas were made crossable this was 390 m — the router went the
       whole way around an open square. */
    const direct = routeBetween(CAMPUS, GRAPH, START, VIA);
    assert.ok(
      direct.metres < 140,
      `${START} → ${VIA} is ${direct.metres} m; it is ~55 m across. The plaza has ` +
      `stopped being crossable.`
    );
  });

  test("the route genuinely crosses the plaza", () => {
    const inside = walk.points.filter((p) => insideRing(p, plaza.p)).length;
    assert.ok(inside >= 10, `only ${inside} route points fall inside Revelle Plaza`);
  });

  test("is a plausible length and reaches Ridge Walk", () => {
    assert.ok(walk.metres > 200, `walk is only ${walk.metres} m`);
    assert.ok(walk.metres < 900, `walk is ${walk.metres} m — it is wandering`);
    const last = walk.points[walk.points.length - 1];
    assert.ok(
      Math.hypot(last.x - end.x, last.z - end.z) < 60,
      "the walk does not end on Ridge Walk"
    );
  });

  test("never walks through a building", () => {
    const offenders = new Set();
    for (const pt of walk.points) {
      for (const b of CAMPUS.buildings) if (insideRing(pt, b.p)) offenders.add(b.n || "unnamed");
    }
    assert.deepEqual([...offenders], [], `walks through: ${[...offenders].join(", ")}`);
  });
});

/* --------------------------------------------------------- 3. the terrain */

describe("the ground is a surface, not a sheet with holes", () => {
  const { cols, rows, z, cell } = LIDAR.terrain;

  test("the grid matches its declared dimensions", () => {
    assert.equal(z.length, cols * rows, "terrain grid length does not match cols × rows");
    assert.ok(cell > 0 && cell <= 5, `terrain cell ${cell} m is too coarse to show a plaza step`);
  });

  test("every cell is a real number", () => {
    /* A NaN here is a hole a walker falls through, and it renders as a spike
       rather than an error. The build script fills gaps under buildings and
       canopy for exactly this reason. */
    const bad = z.filter((v) => !Number.isFinite(v)).length;
    assert.equal(bad, 0, `${bad} terrain cells are not finite`);
  });

  test("the relief is real but not a mountain range", () => {
    /* Revelle to Ridge Walk climbs about 7 m. Near zero means the terrain
       silently flattened; huge means the datum broke. */
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of z) { const m = v / 10; if (m < lo) lo = m; if (m > hi) hi = m; }
    assert.ok(hi - lo > 3, `terrain spans only ${(hi - lo).toFixed(1)} m — it has gone flat`);
    assert.ok(hi - lo < 90, `terrain spans ${(hi - lo).toFixed(1)} m — the datum is wrong`);
  });

  test("trees are placed and measured", () => {
    assert.ok(LIDAR.trees.length > 40, `only ${LIDAR.trees.length} trees`);
    for (const [x, zz, h, r] of LIDAR.trees) {
      assert.ok(Number.isFinite(x) && Number.isFinite(zz), "a tree has a NaN position");
      assert.ok(h >= 3 && h <= 45, `a tree is ${h} m tall`);
      assert.ok(r > 0 && r < 25, `a tree has a ${r} m crown`);
    }
  });
});

/* ---------------------------------------------------------------- 4. guard */

describe("GUARD: the walk agrees with the rest of the site", () => {
  test("class buildings sit where app/webreg/data/buildings.json says", () => {
    /* buildings.json is an INDEPENDENT list of campus buildings with their
       own coordinates, carried over as a fixture precisely so this check has
       a second opinion to argue with. If the two drift, one of them is
       putting a building somewhere it is not. Compared against footprint centroids, so tens of metres is expected
       — a large building's centroid is legitimately far from its door. */
    const mismatches = [];
    let compared = 0;
    for (const [name, pin] of Object.entries(BUILDINGS)) {
      const here = CAMPUS.places[name];
      if (!here) continue;
      compared++;
      const want = project(pin.lat, pin.lng);
      const gap = Math.hypot(here.x - want.x, here.z - want.z);
      if (gap > 90) mismatches.push(`${name} off by ${gap.toFixed(0)} m`);
    }
    assert.ok(compared >= 20, `only ${compared} buildings overlapped — the box may have shrunk`);
    assert.deepEqual(mismatches, [], mismatches.join("; "));
  });

  test("the LiDAR area actually covers the walk", () => {
    const { area } = LIDAR;
    const plaza = CAMPUS.places[VIA];
    const lat = CAMPUS.origin.lat - plaza.z / CAMPUS.origin.mPerDegLat;
    const lng = CAMPUS.origin.lng + plaza.x / CAMPUS.origin.mPerDegLng;
    assert.ok(
      lat > area.south && lat < area.north && lng > area.west && lng < area.east,
      "Revelle Plaza falls outside the LiDAR area — heights there would be guesses"
    );
  });
});
