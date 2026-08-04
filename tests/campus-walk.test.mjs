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
 *      4.5 m too tall and Blake Hall 3 m too tall — the pair you spawn over,
 *      and so the first heights anyone can check — and had nothing at all to
 *      say about most of the rest.
 *   2. The footpath graph crosses the plaza. Routed on OSM lines alone, Argo
 *      Hall to the middle of Revelle Plaza came out at 390 m, around a square
 *      you can see across. It is 55 m.
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

/* The reference errand: out of Argo, across the plaza, up Ridge Walk to
   Peterson Hall. A real dorm-to-lecture trip, so a real pedestrian router's
   distance for it is a number our footpath graph can be held to — which is what
   scripts/audit-accuracy.mjs does with it, and all it is for now that the
   guided walk that once rendered it has been deleted. */
const START = "Argo Hall";
const VIA = "Revelle Plaza";
const DEST = "Peterson Hall";

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
  test("campus-walk.js resolves every dataset it names to a file that exists", () => {
    /* The bug class: shipping a fetch to a path that 404s. A shipped feature
       spent a day silently doing it, because a missing optional file is
       indistinguishable from an optional file the browser declined to want.

       This reads the module's DATA TABLE rather than regexing URL literals, and
       that is deliberate — please do not "simplify" it back. campus-walk.js
       used to spell each download out as new URL("../data/x.json",
       import.meta.url), which a regex could enumerate; it now declares the
       whole download set once and builds every URL from one template, because
       the loading screen quotes the byte total and a file fetched from
       somewhere else is a file that total is wrong about. The literal-hunting
       version of this test still PASSED against that rewrite — it found zero
       URLs, and zero URLs resolving to missing files is zero failures. A test
       that silently stops looking is worse than no test, so this one asserts
       the table exists before it asserts anything about its contents.

       The stray-literal sweep stays anyway: a future fetch written the old way
       is exactly the thing the table is supposed to prevent, so it gets caught
       rather than ignored. */
    const src = readFileSync(path.join(ROOT, "docs/js/campus-walk.js"), "utf8");

    const table = src.match(/const DATA = \[([\s\S]*?)^\];/m);
    assert.ok(table, "campus-walk.js declares no `const DATA = [...]` table — this test has gone blind");
    const listed = [...table[1].matchAll(/file:\s*["']([^"']+)["']\s*,\s*required:\s*(true|false)/g)]
      .map(([, file, required]) => ({ file, required: required === "true" }));
    assert.ok(listed.length >= 2,
      `the DATA table parsed to ${listed.length} entries — the row shape changed under the regex`);

    /* Every listed file must exist, optional ones included. `required: false`
       is a promise about RESILIENCE — the campus still stands on OSM + LiDAR
       alone, so a failed download degrades instead of throwing — not a licence
       for the repo to be missing the file. campus-boundary.json was exempted
       here once, back when it came from a build pipeline that had not been run;
       all eight ship today, so plain existence is the stronger assertion and
       the exemption is gone. Put one back only when a file genuinely is not
       expected in the tree. */
    for (const { file } of listed) {
      assert.ok(existsSync(path.join(ROOT, "docs/data", file)),
        `campus-walk.js downloads ${file} — docs/data/ has no such file, so this 404s`);
    }

    /* The two the walk cannot stand without, still listed and still required.
       Everything else is an upgrade. */
    for (const name of ["campus-3d.json", "campus-lidar.json"]) {
      const entry = listed.find((d) => d.file === name);
      assert.ok(entry, `campus-walk.js no longer downloads ${name}`);
      assert.ok(entry.required, `${name} is marked optional — the campus cannot be built without it`);
    }

    /* Any URL still spelled out as a literal resolves against the module, not
       against whichever page loaded it, so it is resolved the same way. */
    for (const [, rel] of src.matchAll(/new URL\(\s*["']([^"']+)["']\s*,\s*import\.meta\.url\s*\)/g)) {
      const resolved = path.resolve(path.join(ROOT, "docs/js"), rel);
      assert.ok(existsSync(resolved), `campus-walk.js fetches ${rel} — resolves to a missing file`);
    }

    /* And the table is the ONLY place the module names a data file, so a fetch
       added anywhere else cannot escape the checks above. Cheap to assert
       because there is exactly one way to write a filename: any `<name>.json`
       in the source that the table does not list is either a second download
       route or a comment that has drifted from it, and both are worth reading.
       (`.json()` on a response does not match — the dot has no name in front
       of it.) */
    const named = new Set([...src.matchAll(/[\w-]+\.json/g)].map(([hit]) => hit));
    const inTable = new Set(listed.map((d) => d.file));
    const elsewhere = [...named].filter((n) => !inTable.has(n));
    assert.deepEqual(elsewhere, [],
      `campus-walk.js names ${elsewhere.join(", ")} outside the DATA table`);
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

  test("the README's measured-height table matches the shipped data", () => {
    /* The README published stale numbers once — the data was rebuilt after it
       was written and all six rows drifted (up to 1.6 m). On a site whose one
       idea is "measurements, not impressions", the table IS a claim, so it is
       pinned to the data it quotes. Rows look like:
       | Argo Hall | 22.8 m | **18.5 m** | */
    const readme = readFileSync(path.join(ROOT, "README.md"), "utf8");
    const rows = [...readme.matchAll(
      /^\|\s*([^|]+?)\s*\|\s*[\d.]+\s*m\s*\|\s*\*\*([\d.]+)\s*m\*\*\s*\|/gm
    )];
    assert.ok(rows.length >= 6, `only ${rows.length} height rows found in README`);
    const wrong = [];
    for (const [, name, quoted] of rows) {
      const measured = LIDAR.heights[name];
      assert.ok(measured !== undefined, `README quotes "${name}" but the data has no measurement`);
      if (Number(quoted) !== measured) wrong.push(`${name}: README ${quoted} vs data ${measured}`);
    }
    assert.deepEqual(wrong, [], `README height table drifted: ${wrong.join("; ")}`);
  });

  test("the tall buildings really are the tall ones", () => {
    /* A sanity check that each measurement is attached to the right
       footprint — direct pins, because at full-campus scale a rank order
       churns with every hospital and hotel at the boundary. */
    const bands = {
      "Urey Hall": [26, 34], "Tioga Hall": [32, 39],
      "Geisel Library": [32, 40], "Applied Physics and Mathematics": [29, 36],
    };
    for (const [name, [lo, hi]] of Object.entries(bands)) {
      const h = LIDAR.heights[name];
      assert.ok(h >= lo && h <= hi, `${name} measured ${h} m — expected ${lo}–${hi}`);
    }
  });
});

/* -------------------------------------------------- 2. the reference errand */

describe(`the reference errand: ${START} → ${VIA} → ${DEST}`, () => {
  const walk = routeThrough(CAMPUS, GRAPH, [START, VIA, DEST]);
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

  test("is the length a real pedestrian router gives, and ends at Peterson Hall", () => {
    /* Google-Maps-style walking distance for this pair is a bit over 700 m —
       about a ten-minute walk. A collapse below 600 m means the route found a
       shortcut through something; growth past 950 m means it is wandering. */
    assert.ok(walk.metres > 600, `walk is only ${walk.metres} m — it found a shortcut`);
    assert.ok(walk.metres < 950, `walk is ${walk.metres} m — it is wandering`);
    const dest = CAMPUS.places[DEST];
    const last = walk.points[walk.points.length - 1];
    assert.ok(
      Math.hypot(last.x - dest.x, last.z - dest.z) < 60,
      `the walk does not end at ${DEST}`
    );
  });

  test("rides Ridge Walk north, as a person would", () => {
    /* A person making this trip walks up Ridge Walk, so a router that agrees
       with people has to as well — and a total distance alone cannot tell you
       whether it did. Ridge Walk's vertices are known, so count how much of the
       route lies on them: if it ever reroutes through Muir's service paths for
       the same 700-odd metres, only this collapses. */
    const ridge = new Set();
    for (const p of CAMPUS.paths) {
      if (p.n !== "Ridge Walk") continue;
      for (const [x, z] of p.p) ridge.add(`${Math.round(x)}:${Math.round(z)}`);
    }
    const onRidge = walk.points.filter(
      (p) => ridge.has(`${Math.round(p.x)}:${Math.round(p.z)}`)
    ).length;
    assert.ok(onRidge >= 8, `only ${onRidge} route points touch Ridge Walk`);
  });

  test("the destination is measured, not guessed", () => {
    assert.ok(LIDAR.heights[DEST], `${DEST} has no LiDAR-measured height`);
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
    /* The full campus runs from the mesa top down the canyons to nearly sea
       level at the I-5 corner — a genuine ~135 m of relief. Near zero means
       the terrain silently flattened; past 160 the datum broke. */
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of z) { const m = v / 10; if (m < lo) lo = m; if (m > hi) hi = m; }
    assert.ok(hi - lo > 40, `terrain spans only ${(hi - lo).toFixed(1)} m — it has gone flat`);
    assert.ok(hi - lo < 160, `terrain spans ${(hi - lo).toFixed(1)} m — the datum is wrong`);
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
  test("class buildings sit where tests/fixtures/buildings.json says", () => {
    /* campus-3d.json and buildings.json come from different pulls. If they
       drift, the Campus Map pins a building somewhere the walk does not put
       it. Compared against footprint centroids, so tens of metres is expected
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

  test("the LiDAR area actually covers the walk and its skyline", () => {
    const { area } = LIDAR;
    /* Geisel and Center Hall are here because they are the skyline you steer
       by on Ridge Walk — both sat outside the first LiDAR box and rendered at
       sea level, invisible below the terrain. */
    for (const name of [VIA, DEST, "Geisel Library", "Center Hall"]) {
      const place = CAMPUS.places[name];
      assert.ok(place, `${name} missing from campus places`);
      const lat = CAMPUS.origin.lat - place.z / CAMPUS.origin.mPerDegLat;
      const lng = CAMPUS.origin.lng + place.x / CAMPUS.origin.mPerDegLng;
      assert.ok(
        lat > area.south && lat < area.north && lng > area.west && lng < area.east,
        `${name} falls outside the LiDAR area — heights there would be guesses`
      );
    }
  });
});
