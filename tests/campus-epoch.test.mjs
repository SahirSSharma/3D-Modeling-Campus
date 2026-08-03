/* Campus Walk — the epoch rules, as tests.
 *
 * The LiDAR flight is from 2014 and campus kept building. Every class of
 * mistake that survey's age produced — and that the 2026-08-03 zone audit
 * caught — is pinned here so a rebuild cannot quietly reintroduce it:
 *
 *   1. LiDAR must never claim to have measured a building that did not exist
 *      in 2014 (NTPLLN shipped as bungalows; The Jeannie shipped at the
 *      height of the trees it replaced).
 *   2. Post-2014 buildings must render at their documented estimated or
 *      GIS heights, not at the 2014 ground return.
 *   3. Underground structures must not extrude (Scholars Parking rendered as
 *      a 5.9 m slab across the whole Sixth College green).
 *   4. Phantom and demolished footprints stay gone (the P206 lot boxes,
 *      Friend's Thrift Shop), and the Triton Center site renders its current
 *      build state, not the finished project.
 *   5. Relation-mapped buildings exist (a ways-only Overpass pull shipped a
 *      campus with no Faculty Club and no Rady School).
 *   6. The routing graph still connects the walk's anchor buildings.
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
const ARCGIS = read("docs/data/campus-arcgis.json");
const COLORS = read("docs/data/campus-colors.json");

const { assembleMasses } = await import(path.join(ROOT, "docs/js/campus-massing.js"));
const MASSES = assembleMasses({ campus: CAMPUS, lidar: LIDAR, arcgis: ARCGIS, colors: COLORS });
const tallest = (n) => Math.max(...MASSES.filter((m) => m.name === n).map((m) => m.h), 0);

const inRing = (pt, ring) => {
  let ins = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if (zi > pt[1] !== zj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
};

/* Built after the 2014 flight (or its 2014 predecessor demolished since).
   Mirrors POST_2014_SITES in scripts/build-campus-lidar.mjs. */
const POST_2014 = [
  "Mosaic", "Tapestry", "Catalyst", "The Jeannie", "Kaleidoscope",
  "Social Sciences Public Engagement Building", "Arts and Humanities",
  "Design & Innovation Building", "Franklin Antonio Hall",
  "Pulse", "Sankofa", "Podemos", "Azad",
  "Rya", "Vela",
  "Alianza", "Umoja", "Coalition", "Malk Hall",
  "Viterbi Family Vision Research Center",
  "The Strauss", "Student Success Building",
  "Student Health and Well-Being Building", "Triton Alumni and Welcome Center",
];

describe("1. LiDAR never claims a measurement of a post-2014 building", () => {
  test("no post-2014 site carries a shipped LiDAR height", () => {
    const liars = POST_2014.filter((n) => LIDAR.heights[n] !== undefined);
    assert.deepEqual(liars, [], `2014 LiDAR "measured" buildings that did not exist: ${liars}`);
  });
  test("no post-2014 site carries shipped LiDAR part heights", () => {
    const idx = new Set(
      CAMPUS.buildings.map((b, i) => (b.n && POST_2014.includes(b.n) ? i : -1)).filter((i) => i >= 0),
    );
    const liars = Object.keys(LIDAR.partHeights).filter((k) => idx.has(Number(k.split("/")[0])));
    assert.deepEqual(liars, [], `stale 2014 part returns on post-2014 buildings: ${liars}`);
  });
  test("every LiDAR height still names a shipped footprint", () => {
    const names = new Set(CAMPUS.buildings.map((b) => b.n).filter(Boolean));
    const orphans = Object.keys(LIDAR.heights).filter((n) => !names.has(n));
    assert.deepEqual(orphans, [], `LiDAR heights for buildings not on the map: ${orphans}`);
  });
});

describe("2. post-2014 buildings render at their documented heights", () => {
  /* name -> minimum believable render height, from the audit's Street View
     floor counts. A regression to any 2014 ground return fails these. */
  const FLOORS = {
    "Mosaic": 24, // ~8 residential floors
    "Tapestry": 20, // 6 floors
    "Catalyst": 30, // 10-floor tower
    "Kaleidoscope": 18, // 6-7 floors
    "Design & Innovation Building": 16, // 4 floors (GIS 17.1, newer:true class)
    "Alianza": 50, // 18 levels (GIS 59.2)
    "Umoja": 45, // 16 levels (GIS 51.9)
    "Sankofa": 55, // 21-level tower (GIS 64)
  };
  for (const [n, min] of Object.entries(FLOORS)) {
    test(`${n} stands at least ${min} m`, () => {
      assert.ok(tallest(n) >= min, `${n} renders ${tallest(n)} m — flattened to a 2014 return?`);
    });
  }
  test("The Jeannie is a low pavilion again, not the trees that preceded it", () => {
    const h = tallest("The Jeannie");
    assert.ok(h > 0 && h <= 12, `The Jeannie renders ${h} m (2014 tree canopy was 18.2 m)`);
  });
});

describe("3. underground structures do not extrude", () => {
  const LAWN = [-36.1, -259.4]; // centre of the Sixth College green
  test("no footprint covers the Sixth College green", () => {
    const hit = CAMPUS.buildings.find((b) => inRing(LAWN, b.p));
    assert.equal(hit, undefined, `footprint over the green: ${hit?.n || "unnamed"} h=${hit?.h}`);
  });
  test("no mass renders over the Sixth College green", () => {
    const hit = MASSES.find((m) => inRing(LAWN, m.rings[0]));
    assert.equal(hit, undefined, `mass over the green: ${hit?.name || "unnamed"} h=${hit?.h}`);
  });
  test("the garage keeps its place anchor for wayfinding", () => {
    assert.ok(CAMPUS.places["Scholars Parking Structure"], "Scholars Parking place anchor lost");
  });
});

describe("4. phantoms, demolitions, and the Triton Center build state", () => {
  test("the two P206 parking-lot boxes stay gone", () => {
    for (const spot of [[273.0, 23.1], [293.6, 22.9]]) {
      const hit = CAMPUS.buildings.find((b) => inRing(spot, b.p));
      assert.equal(hit, undefined, `phantom box back at (${spot})`);
    }
  });
  test("Friend's Thrift Shop was demolished with the old International Center", () => {
    assert.ok(!CAMPUS.buildings.some((b) => b.n === "Friend's Thrift Shop"), "footprint back");
    assert.equal(CAMPUS.places["Friend's Thrift Shop"], undefined, "place anchor back");
    assert.equal(LIDAR.heights["Friend's Thrift Shop"], undefined, "lidar height back");
  });
  test("Triton Center renders its current build state, not the finished towers", () => {
    /* Documented in UNDER_CONSTRUCTION, scripts/build-campus-3d.mjs. */
    const STATE = {
      "The Strauss": 19,
      "Student Success Building": 16,
      "Student Health and Well-Being Building": 13,
      "Triton Alumni and Welcome Center": 10,
    };
    for (const [n, h] of Object.entries(STATE)) {
      const b = CAMPUS.buildings.find((x) => x.n === n);
      assert.ok(b, `${n} missing from the map`);
      assert.equal(b.h, h, `${n}: shipped ${b.h} m, documented build state ${h} m`);
    }
  });
});

describe("5. relation-mapped buildings exist (the ways-only extraction gap)", () => {
  const RELATION_BUILDINGS = [
    "Ida and Cecil Green Faculty Club",
    "Otterson Hall",
    "Wells Fargo Hall",
    "San Diego Supercomputer Center",
    "Engineering Building Unit 2 (EBU2)",
    "Pepper Canyon Hall",
    "Conrad Prebys Music Center",
  ];
  for (const n of RELATION_BUILDINGS) {
    test(`${n} is on the map with a place anchor`, () => {
      assert.ok(CAMPUS.buildings.some((b) => b.n === n), `${n} footprint missing`);
      assert.ok(CAMPUS.places[n], `${n} place anchor missing`);
    });
  }
  test("the stale names stay renamed", () => {
    for (const stale of [
      "Pangea Residence Halls", "Sixty Four North",
      "Center for Magnetic Recording Research", "The John M and Sally B Thornton Hospital",
    ]) {
      assert.ok(!CAMPUS.buildings.some((b) => b.n === stale), `stale name shipped: ${stale}`);
    }
    assert.ok(CAMPUS.buildings.some((b) => b.n === "Marshall Lower Apartments"));
    assert.ok(CAMPUS.buildings.some((b) => b.n === "64 North"));
  });
});

describe("6. the data still routes and stays aligned", () => {
  test("colors stay index-aligned with buildings", () => {
    assert.ok(
      COLORS.buildings.length <= CAMPUS.buildings.length,
      `colors for ${COLORS.buildings.length} buildings but only ${CAMPUS.buildings.length} shipped`,
    );
  });
  test("Argo Hall → Peterson Hall still routes", async () => {
    const { buildGraph, routeBetween } = await import(path.join(ROOT, "docs/js/campus-route.js"));
    const graph = buildGraph(CAMPUS);
    const r = routeBetween(CAMPUS, graph, "Argo Hall", "Peterson Hall");
    assert.ok(r.points.length > 50, "route came back suspiciously short");
  });
});
