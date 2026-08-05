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
 *   7. University massing rings measure their OWN 2014 roof plane — the
 *      host-level reconcile pasted the Main Gym's 14.9 m onto the 8.4 m
 *      Natatorium and Urey Hall's tower onto its low office addition.
 *   8. The Epstein bowl (OSM building=no) stays unbuilt, and the Eighth
 *      College label stands at Ridge Walk North where OSM puts it.
 *   9. The r0c0 sweep's measurements hold: the Salk wings are named and
 *      measured, TPCS and the Sanford pavilion drop to their 2014 planes,
 *      the GIS-name-fallback masses each measure their own ring, and the
 *      Marshall union outline stays suppressed without orphaning a name.
 *  10. The r0c1 sweep's measurements hold: the Earth Hall / Canyon Vista /
 *      Village East union outlines stay split into their measured pieces,
 *      Douglas Hall's mass carries its OSM name and 2014 plane, Atkinson's
 *      low pavilion measures without its tower, the hand-verified GIS-only
 *      and unnamed-OSM planes ship, and the demolished RIMAC Annex site
 *      renders nothing while its rebuild is a bare frame.
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
  // Found by the 2026-08-04 gauntlet sweep — each shipped a 2014 "measurement"
  // of the lot, predecessor block, canopy or construction frame on its site.
  "Ola", "Arena", "Artesa", "Cala", "Cresta", "Marea", // Mesa Nueva, 2017
  "Viento", "Brisa", // Nuevo West, 2020
  "Athena Parking Structure", // 2019 — 2.3 m was the surface lot
  "Survivance", // TDLLN's fifth building, 2023
  "Tata Hall for the Sciences", // 2018 — 19.5 m was the demolished USB site
  "Epstein Family Amphitheater", // 2022 — 17 m was the eucalyptus grove
  "Altman Clinical and Translational Research Institute", // opened 2016
  "Campus Point Parking Structure", // Jacobs Medical Center buildout
  // r0c1 sweep: the 2014 annex west of RIMAC is demolished; Apple (2026-08-04)
  // shows a tower crane over open decks. The 10.6 m plane was a dead building.
  "RIMAC Annex",
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
  test("no massing ring inside a post-2014 footprint carries a LiDAR height", () => {
    /* massHeights keys encode the mass centroid ("m:x,z"), so the epoch
       guard is checkable from the shipped file alone. */
    const rings = CAMPUS.buildings.filter((b) => b.n && POST_2014.includes(b.n));
    const liars = Object.keys(LIDAR.massHeights || {}).filter((k) => {
      const [x, z] = k.slice(2).split(",").map(Number);
      return rings.some((b) => inRing([x, z], b.p));
    });
    assert.deepEqual(liars, [], `2014 mass planes inside post-2014 buildings: ${liars}`);
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
    // 2026-08-04 sweep additions — GIS massing carries each now that the
    // stale 2014 return is gone.
    "Ola": 12, // GIS 15.2
    "Cala": 20, // GIS 24.4
    "Cresta": 18, // GIS 21.3
    "Viento": 30, // GIS 36.6, 12 storeys
    "Survivance": 30, // GIS 33.5
    "Tata Hall for the Sciences": 20, // GIS masses top at 25.6
    "Athena Parking Structure": 25, // GIS 29.9, 7 levels
    "Altman Clinical and Translational Research Institute": 25, // GIS 29.9, 7 storeys
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

describe("7. per-mass roof planes (the 2026-08-04 host-bleed fix)", () => {
  /* Reconciling per HOST pasted the tallest volume's height onto every
     university massing ring inside the OSM footprint: the Main Gym's 14.9 m
     onto the 8.4 m Natatorium, Urey Hall's 30.5 m tower onto its 12 m office
     addition, the Biomedical Sciences Building's 24.1 m onto the 6.4 m Keck
     annex. lidar.massHeights now carries each ring's own 2014 roof plane
     (verified against a targeted EPT re-sample, 2026-08-04), and
     assembleMasses ships it. Keyed by the mass centroid, value = what must
     render. */
  const massKey = (m) => {
    let x = 0, z = 0;
    for (const p of m.rings[0]) { x += p[0]; z += p[1]; }
    const n = m.rings[0].length;
    return `m:${Math.round(x / n)},${Math.round(z / n)}`;
  };
  const PLANES = {
    "m:585,-292": [18.7, "Powell Structural Systems Lab — GIS said 8.5"],
    "m:571,-207": [13.8, "Powell Components Lab — host bled 21.9"],
    "m:536,218": [19.7, "Medical Teaching Facility block — GIS said 29.9"],
    "m:540,264": [8.3, "MTF low wing — GIS said 29.9"],
    "m:-50,97": [8.5, "Natatorium — Main Gym bled 14.9"],
    "m:467,331": [6.4, "W. M. Keck Building — host bled 24.1"],
    "m:-153,-41": [9.3, "Tuolumne T House East — host bled 17.3"],
    "m:18,299": [12.1, "Urey Hall Office Addition — tower bled 30.5"],
    "m:-10,266": [30.5, "Urey Hall main slab — stepped roof, host crown stands"],
    "m:161,103": [4.6, "Student Center Pub — hand-audited under the grove"],
    "m:95,16": [20.9, "Mandeville Center — hand-audited fly volume"],
    "m:-1065,1189": [11.3, "Eckart Building — host-median grade sat 7.6 m high"],
  };
  const gisByKey = new Map(MASSES.filter((m) => m.src === "gis").map((m) => [massKey(m), m]));
  for (const [key, [h, why]] of Object.entries(PLANES)) {
    test(`${why} — ships ${h} m`, () => {
      const m = gisByKey.get(key);
      assert.ok(m, `no massing ring at ${key}`);
      assert.equal(m.h, h, `${key} ships ${m.h} m`);
    });
  }
  test("a stepped slab emits no per-mass plane (p75 is not a roof)", () => {
    /* Urey Hall's main mass: half its 2014 returns sit on ~16 m steps, the
       crown at 30.4 — the p75 fallback (25.4) matches no physical roof, so
       the build withholds the mass and host reconciliation answers. */
    assert.equal(LIDAR.massHeights["m:-10,266"], undefined);
  });
  test("the hand-audited Pub height survives the rebuild", () => {
    assert.equal(LIDAR.heights["Stage Room at the Pub"], 4.6);
  });
});

describe("8. the amphitheater is open air and the Eighth College label is home", () => {
  test("Epstein Family Amphitheater does not import as a building (OSM building=no)", () => {
    assert.ok(!CAMPUS.buildings.some((b) => b.n === "Epstein Family Amphitheater"),
      "the bowl is back as a solid 17 m slab");
    assert.equal(LIDAR.heights["Epstein Family Amphitheater"], undefined,
      "2014 canopy shipped as an amphitheater height");
  });
  test("Epstein keeps its place anchor for wayfinding", () => {
    const p = CAMPUS.places["Epstein Family Amphitheater"];
    assert.ok(p, "place anchor lost");
    assert.ok(Math.abs(p.x - 743) < 2 && Math.abs(p.z - (-131.6)) < 2, `anchor drifted to ${p.x},${p.z}`);
  });
  test("the Eighth College label sits at Ridge Walk North, not the canyon", () => {
    /* Mean of its four member buildings (Alianza, Umoja, Coalition, Malk
       Hall) from OSM, 2026-08-04. The old seed put it 1.1 km south in a
       canyon interchange. */
    const p = CAMPUS.places["Eighth College"];
    assert.ok(p, "Eighth College place missing");
    assert.ok(Math.abs(p.x - 122.5) < 2 && Math.abs(p.z - (-515.1)) < 2,
      `label at ${p.x},${p.z} — expected Ridge Walk North (122.5, -515.1)`);
  });
});

describe("9. the north-west shard sweep (r0c0, 2026-08-04)", () => {
  const SALK = "Salk Institute for Biological Studies";

  test("the Salk lab wings are named and measure 19.6 m, not the 22.8 m guess", () => {
    /* OSM maps the Salk as a research_institute AREA containing unnamed
       building ways, so the wings imported nameless and took the area-based
       height guess. WAY_NAMES in build-campus-3d.mjs now names ways
       31839360/31844744 from the containing site; both wings' 2014 roof
       plane re-samples at 19.6 m (p98, 26k+ returns each). */
    const wings = CAMPUS.buildings.filter((b) => b.n === SALK);
    assert.equal(wings.length, 2, `expected the twin wings, got ${wings.length}`);
    assert.equal(LIDAR.heights[SALK], 19.6);
    const rendered = MASSES.filter((m) => m.name === SALK);
    assert.equal(rendered.length, 2);
    for (const m of rendered) assert.equal(m.h, 19.6, `wing ships ${m.h} m`);
    const p = CAMPUS.places[SALK];
    assert.ok(p, "Salk place anchor missing");
    assert.ok(Math.abs(p.x - (-470.6)) < 2 && Math.abs(p.z - (-1033.9)) < 2,
      `anchor drifted to ${p.x},${p.z}`);
  });

  test("Torrey Pines Center South measures 12.2 m, not the 17.1 m GIS record", () => {
    /* Relation-mapped (r18938148) after the last full LiDAR rebuild, so the
       shipped heights file simply predated it. Re-sampled 2026-08-04 with
       the build's own survey clip: 23,073 returns, one plane, p98 12.2 m.
       The GIS mass ring re-samples at 11.5 m (its ring excludes the small
       stair crown the OSM footprint includes). */
    assert.equal(LIDAR.heights["Torrey Pines Center South"], 12.2);
    assert.equal(LIDAR.massHeights["m:-188,-1361"], 11.5);
    const m = MASSES.find((m) => m.name === "Torrey Pines Center South" && m.src === "gis");
    assert.ok(m, "TPCS massing ring missing");
    assert.equal(m.h, 11.5, `TPCS ships ${m.h} m`);
  });

  test("the Sanford Consortium pavilion is 6.2 m, the lab bar keeps 24.5 m", () => {
    /* The facility record's 17.1 m applied to BOTH rings; the east ring is
       the low auditorium pavilion (462 in-ring returns, p98 6.2 m). Its
       centroid misses the OSM footprint, so the GIS-name fallback in
       build-campus-lidar.mjs is what lets the 2014 plane challenge it. */
    assert.equal(LIDAR.massHeights["m:-232,-1258"], 6.2);
    const sanford = MASSES.filter((m) => m.name === "Sanford Consortium for Regenerative Medicine" && m.src === "gis")
      .map((m) => m.h).sort((a, b) => a - b);
    assert.deepEqual(sanford, [6.2, 24.5], `Sanford ships ${sanford}`);
  });

  test("the GIS-name-fallback masses each measure their own 2014 plane", () => {
    /* Masses whose centroid sits OUTSIDE their OSM footprint had no host,
       so their GIS facility value stood unchallenged campus-wide. The
       fallback keys the epoch guard off the identical OSM name instead.
       Values from the 2026-08-04 targeted EPT re-sample. */
    const PLANES = {
      "m:-28,-982": [26.1, "Wells Fargo Hall — GIS said 22.6"],
      "m:665,-123": [11.9, "Visual Arts Facility Building 2 — GIS said 10.4"],
      "m:-89,-131": [14.8, "Mandler Hall — GIS said 13.4"],
      "m:99,201": [3, "Bonner Hall annex — GIS said 3.0, now measured"],
      "m:538,-290": [12.9, "Center for Memory and Recording Research"],
      "m:-172,-727": [4.2, "ERC Laundry South — GIS said 3.0"],
      "m:517,-85": [22.7, "Student Services Center — GIS said 21.9"],
    };
    for (const [key, [h, why]] of Object.entries(PLANES)) {
      assert.equal(LIDAR.massHeights[key], h, `${why} — massHeights[${key}]`);
    }
    /* The one fallback candidate whose returns are canopy-stepped emits
       nothing: Pepper Canyon Assistant Dean's Residence (p75−p50 > 2 under
       eucalyptus). Better absent than wrong. */
    assert.equal(LIDAR.massHeights["m:946,-2"], undefined);
  });

  test("the Marshall Lower Apartments union outline no longer extrudes", () => {
    /* The SanGIS footprint traces the shared edges of six massing rings;
       centroid in a breezeway, 49% of vertices on the exact boundary — it
       rendered as one 18 m monolith through all six halls. The area test in
       ringCoveredBy suppresses it; the halls' own masses inherit the name
       via host rename, so the label survives. */
    const outline = MASSES.find((m) => m.src === "osm" && m.name === "Marshall Lower Apartments");
    assert.equal(outline, undefined, "the union outline is extruding again");
    const carriers = MASSES.filter((m) => m.src === "gis" && m.name === "Marshall Lower Apartments");
    assert.ok(carriers.length >= 6, `only ${carriers.length} masses carry the name`);
  });

  test("suppression never orphans a building's name", () => {
    /* The area test yields when no covering mass would inherit the ring's
       name (Cala, Village East Building 4, One Miramar 3/4 all sample
       ≥0.85 under masses named something else). The suppression orphans
       below are from before the sweeps and may only shrink (r0c1 resolved
       Earth Hall, Douglas Hall, both Canyon Vistas and Village East 5).
       The two non-suppression entries render nothing BY RULE: Geisel draws
       from its own per-floor GIS layer, and the RIMAC Annex site is a
       demolished building whose rebuild no source resolves. */
    const KNOWN = new Set([
      "Spiess Hall", "Black Hall", "Geisel Library",
      "64 Degrees", "64 North", "Greenhouse 3", "Greenhouse 2",
      "Greenhouse 1", "Artesa", "Marea", "Arena", "B", "Brisa",
      "Print Labs", "Nigella Hillgarth Education Center",
      "RIMAC Annex",
    ]);
    const carried = new Set(MASSES.filter((m) => m.name).map((m) => m.name));
    const orphans = [...new Set(CAMPUS.buildings.map((b) => b.n).filter(Boolean))]
      .filter((n) => !carried.has(n) && !KNOWN.has(n));
    assert.deepEqual(orphans, [], `newly orphaned names: ${orphans}`);
  });
});

describe("10. the north-central shard sweep (r0c1, 2026-08-04)", () => {
  const centroidOf = (ring) => {
    let x = 0, z = 0;
    for (const p of ring) { x += p[0]; z += p[1]; }
    return [x / ring.length, z / ring.length];
  };
  const rendersNear = (x, z, tol = 3) =>
    MASSES.filter((m) => {
      const [cx, cz] = centroidOf(m.rings[0]);
      return Math.hypot(cx - x, cz - z) < tol;
    });

  test("the Earth Hall union outline stays split into its three measured pieces", () => {
    /* The facilities record traced ERC's Earth Hall chain — Earth North,
       the Middle Earth Lounge, Earth South — as ONE 2,639 m² ring at 11.7 m,
       which flattened the 4.7 m lounge and pasted the lounge's name over
       the whole chain (its centroid lands there). UNION_OUTLINES in
       build-campus-arcgis.mjs drops the ring; each OSM footprint renders
       its own 2014 plane. */
    assert.equal(LIDAR.massHeights["m:-156,-806"], undefined, "the union plane is back");
    const halls = MASSES.filter((m) => m.name === "Earth Hall");
    assert.equal(halls.length, 2, `expected both Earth Halls, got ${halls.length}`);
    for (const m of halls) assert.equal(m.h, 11.6, `hall ships ${m.h} m`);
    const lounge = MASSES.find((m) => m.name === "Middle Earth Lounge");
    assert.ok(lounge, "the lounge vanished");
    assert.equal(lounge.h, 4.7, `lounge ships ${lounge.h} m — 2014 plane is 4.7`);
  });

  test("Canyon Vista renders as its two measured buildings, not one 12 m union", () => {
    /* One GIS ring spanned the admin lodge AND the restaurant across their
       shared courtyard; its centroid fell in the courtyard so it carried no
       name and suppressed both. LiDAR planes: lodge 12.0, restaurant 8.6. */
    const lodge = MASSES.find((m) => m.name === "Canyon Vista Administration building");
    const rest = MASSES.find((m) => m.name === "Canyon Vista Restaurant");
    assert.ok(lodge && rest, "a Canyon Vista building is missing");
    assert.equal(lodge.h, 12);
    assert.equal(rest.h, 8.6);
    assert.equal(MASSES.find((m) => m.name === "Canyon Vista"), undefined, "the union ring is back");
  });

  test("Village East 4 and 5 stand apart; the #4 union ring stays gone", () => {
    /* "Seventh College East #4" (GIS 15.2 m) traced VE4+VE5 as one ring:
       VE4 double-rendered through it and VE5 was suppressed by it. Their
       own 2014 planes: 12.1 and 12.4; the remaining SCE masses measure
       12.2 and 10.7 on their own rings. */
    const ve4 = MASSES.find((m) => m.name === "Village East Building 4");
    const ve5 = MASSES.find((m) => m.name === "Village East Building 5");
    assert.ok(ve4 && ve5, "a Village East building is missing");
    assert.equal(ve4.h, 12.1);
    assert.equal(ve5.h, 12.4);
    assert.equal(MASSES.find((m) => m.name === "Seventh College East #4"), undefined);
    assert.equal(LIDAR.massHeights["m:-49,-1057"], 12.2, "SCE#5's own plane");
    assert.equal(LIDAR.massHeights["m:-78,-1060"], 10.7, "SCE#6's own plane");
  });

  test("Douglas Hall's mass carries its OSM name and its 16.1 m plane", () => {
    /* The facilities inventory calls the ring "Douglas Apartments"; with no
       OSM twin under that name the mass had no host, its 18.3 m record
       stood unchallenged, and the OSM ring it covered was a name orphan.
       MASS_RENAMES maps it to Douglas Hall; its own ring re-samples 16.1 m
       (5,426 returns). */
    assert.equal(LIDAR.massHeights["m:769,-589"], 16.1);
    const douglas = MASSES.filter((m) => m.name === "Douglas Hall");
    assert.ok(douglas.length >= 1, "Douglas Hall lost its name again");
    assert.ok(douglas.some((m) => m.src === "gis" && m.h === 16.1), `ships ${douglas.map((m) => m.h)}`);
    assert.equal(MASSES.find((m) => m.name === "Douglas Apartments"), undefined);
  });

  test("Atkinson's low pavilion measures 14.5 m without its tower's returns", () => {
    /* The whole-footprint ring mixes the 29.8 m tower into the west
       pavilion; measured MINUS the contained tower ring (16,642 returns,
       p98) the pavilion's own plane is 14.5 m. MEASURE_MINUS_CONTAINED in
       build-campus-lidar.mjs pins the mechanism. */
    assert.equal(LIDAR.massHeights["m:601,-505"], 14.5);
    const atkinson = MASSES.filter((m) => m.name === "Atkinson Hall (Calit2)").map((m) => m.h).sort((a, b) => a - b);
    assert.deepEqual(atkinson, [14.5, 29.8], `Atkinson ships ${atkinson}`);
  });

  test("the hand-verified pre-2014 GIS-only masses each measure their own plane", () => {
    /* No named-OSM host and no OSM name twin — PRE_2014_GIS_VERIFIED lets
       the 2014 survey challenge these records because their build dates
       are documented pre-flight. Two were far off: SDSC East (GIS 17.1,
       plane 23.2) and Social Sciences (GIS 17.1, plane 21.0). */
    const PLANES = {
      "m:78,-656": [21, "Social Sciences Building (1995) — GIS said 17.1"],
      "m:171,-705": [23.2, "SDSC East Expansion (2009) — GIS said 17.1"],
      "m:-91,-908": [4.8, "ERC Administration North (2004)"],
      "m:16,-730": [10.4, "Robinson Building 1 (1990)"],
      "m:7,-669": [7.5, "Robinson Building 3 (1990) — stepped, p75"],
      "m:74,-1256": [2.5, "Outback Adventures surf shack"],
    };
    for (const [key, [h, why]] of Object.entries(PLANES)) {
      assert.equal(LIDAR.massHeights[key], h, `${why} — massHeights[${key}]`);
    }
  });

  test("hand-verified unnamed OSM rings ship their measured planes", () => {
    /* Unnamed rings have no name to key lidar.heights, so verified-
       unchanged ones ride lidar.osmHeights by building index (the coupling
       partHeights already uses). 786: Village East community building,
       OSM guessed 9 m, plane 12.3. 893: the RIMAC service-court kiosk. */
    assert.equal(LIDAR.osmHeights?.["786"], 12.3);
    assert.equal(LIDAR.osmHeights?.["893"], 4.3);
    const ve = rendersNear(54, -1080).find((m) => m.src === "osm");
    assert.ok(ve, "the community building vanished");
    assert.equal(ve.h, 12.3, `renders ${ve.h} m`);
  });

  test("the demolished RIMAC Annex renders nothing while its rebuild is a frame", () => {
    /* Apple satellite (2026-08-04): tower crane, open concrete decks. The
       2014 building is gone; no source resolves the rising frame to gate.
       Better absent than wrong — the OSM footprint stays in the data for
       the day one can, but nothing extrudes on the site. */
    assert.equal(LIDAR.heights["RIMAC Annex"], undefined, "a demolished building has a LiDAR height");
    assert.equal(LIDAR.massHeights["m:65,-867"], undefined);
    const annexRing = CAMPUS.buildings.find((b) => b.n === "RIMAC Annex");
    assert.ok(annexRing, "the footprint left the dataset entirely");
    const [ax, az] = centroidOf(annexRing.p);
    assert.equal(rendersNear(ax, az, 10).length, 0, "something extrudes on the construction site");
  });

  test("the Alianza and Umoja outer outlines yield to their measured wings", () => {
    /* The OSM rings are neighbourhood OUTLINES — courtyards included —
       while the university's masses trace the wings. Extruding an outline
       through its own courtyards is a solid block nobody measured. */
    const outlines = MASSES.filter((m) => m.src === "osm" && (m.name === "Alianza" || m.name === "Umoja"));
    assert.deepEqual(outlines, [], "an outer outline extrudes again");
    const alianza = MASSES.filter((m) => m.name === "Alianza");
    const umoja = MASSES.filter((m) => m.name === "Umoja");
    assert.ok(alianza.length >= 2, `Alianza wings: ${alianza.length}`);
    assert.ok(umoja.length >= 3, `Umoja wings: ${umoja.length}`);
  });
});
