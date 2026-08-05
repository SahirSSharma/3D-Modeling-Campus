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
 *  11. The r0c2 sweep's measurements hold: the verified unnamed east-campus
 *      rings ship their planes and the epoch withholds stay withheld (the
 *      post-2014 hospital wings, the stepped Scripps complex, the canopy-
 *      blind sheds), the hand-verified GIS records measure their own rings,
 *      Qualcomm AA ships its re-sampled roof, the Campus Point demolition
 *      site renders nothing, and the two east-campus site anchors stand.
 *  12. The r1c0 sweep's measurements hold: the verified La Jolla Farms
 *      rings ship their planes while the canopy-blind ones keep their
 *      guesses, the Extended Studies cottages measure past their uniform
 *      records, Tuolumne renders as nine measured houses instead of one
 *      17 m outline, the 2015 Spanos APC never wears the eucalyptus the
 *      flight saw on its site, rings poking past the survey box measure
 *      again (the disjoint-test regression), and the Muir west pad
 *      carries no tennis paint Apple shows repainted as pickleball.
 *  13. The r1c1 judge pass's measurements hold: SSC and CMRR render once
 *      (the exact-name twin carries the name, so the covered OSM copies
 *      yield), the Vela outline renders as parts instead of a 19 m slab,
 *      the two demolished pads render nothing, Black Hall wears its OSM
 *      name and 2014 plane, Solis Hall sheds the eucalyptus p75, the
 *      TES tank and VA plant ship their planes while the post-2014 VA
 *      garage keeps its declared guess, and the stepped Jacobs complex
 *      keeps the verified state a screener proposed to "fix".
 *  14. The r1c2 judge pass's measurements hold: duplicate OSM names never
 *      share one heights key (the SCI pair races no more — one plane per
 *      epoch, per ring), the host rename refuses to duplicate a name the
 *      record already gives a nearby building (the Dean's Residence keeps
 *      its house, PC1300 and the laundry keep their names) while pure
 *      swaps survive, Cala renders once as the mass wearing its OSM name,
 *      the Matthews houses ship their own planes under their full names,
 *      the health-campus records challenged by their own rings measure,
 *      the epoch withholds stay withheld, and Viterbi / the Bed Tower /
 *      VAF-B3 stay as judged.
 *  15. The r2c1 judge pass's measurements hold: Che Café and Laurel wear
 *      their audited roofs instead of the eucalyptus the flight saw over
 *      them, the Weiss Forum union splits so the Shank Theatre is its own
 *      measured building (and no sliver steals its name), the Satellite
 *      Utility Plant renders once at its post-2014 record with the
 *      predecessor's 2014 plane silenced, the verified west-corridor
 *      rings ship their planes, the post-2014 rings keep their declared
 *      guesses, and no unnamed ring renders while half-covered by the
 *      massing that already is the building.
 *  16. The r2c0 judge pass's measurements hold: the SIO buildings the
 *      survey box truncates ship their full-ring planes (and Ritter's
 *      clipped subset stops firing the newer heuristic), the Hubbs
 *      conference annex stops wearing the hall's record through the
 *      fuzzy match, the T-cottages wear their roofs while the grove-wide
 *      GIS rings ship no plane, Coastal Studies and MCF render their
 *      post-renovation records once each, the NOAA outline measures
 *      minus its contained core, Spiess Hall's record answers to its
 *      measured roof, the Birch union splits so Hillgarth is its own
 *      building, the verified shore rings ship their planes, and the
 *      withheld rings stay withheld.
 *  17. The r2c2 judge pass's measurements hold: the Hyatt's podium+tower
 *      union stops shipping a 45 m paste, the verified east-of-I-5
 *      unnamed rings ship their planes, the post-2014 trolley-corridor
 *      garage keeps its declared guess, and the stepped / canopy /
 *      multi-tier withholds stay withheld.
 *  18. The r0c0 re-sweep's measurements hold: six NW unnamed rings ship
 *      their planes, Marshall Residence Hall V ships its guarded 6.8,
 *      the contaminated coastal pad keeps its guess, and Sanford's
 *      lab-bar / pavilion split stands.
 *  19. The r0c1 re-sweep's measurements hold: Asante House Meeting Rooms
 *      sheds its thin 7.1 m shelf for the dense 4.0 m body (thin-shelf
 *      massHeights rule), Marshall Upper H/L keep the GIS body against
 *      canopy p98, the 2015 Spanos APC stays one storey with eucalyptus
 *      out, and Otterson / Copley keep their real upper volumes.
 *  20. The r0c2 re-sweep's measurements hold: CSC Building H sheds its
 *      thin 7.0 m shelf for the dense 4.8 m body (gap cut lowered from
 *      2.5 to 2 — half a storey), Transit Trailer keeps its 5.2 (gap
 *      0.9, noise), and the post-2014 / stepped hospital residuals stay
 *      on their documented guesses.
 *  21. The r1c0 re-sweep's measurements hold: Tenaya sheds the mechanical
 *      HAND_AUDITED paste for its dense L7 body, three LJF thin-shelf
 *      rings + the Geisel pavilion ship their planes, and the near-miss
 *      / multiplane / Tuolumne / pickleball residuals stay as judged.
 *  22. The r1c1 re-sweep's measurements hold: a third demolished pad and
 *      the Epstein / Mayer phantom rings render nothing, the Central
 *      Utilities cooling bays ship their planes, and the thin-shelf /
 *      stepped / host-bleed / VAF-3 / Tata residuals stay as judged.
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
  // r2c1 judge sweep: opened ~2018-19; the flight's tight 4.0-4.2 m plane is
  // the demolished predecessor on its site. (No OSM ring wears this name, so
  // the name-keyed checks are dormant — the per-ring guard on osm:718 and the
  // massHeights check below are the live ones.)
  "Satellite Utility Plant",
  // r2c0 judge sweep: two SIO buildings whose 2014 roofs were rebuilt —
  // Coastal Studies' upper floor in the 2019-20 renovation, MCF's whole
  // roofline in the 2021-23 conversion. The flight measured predecessors.
  "Center for Coastal Studies",
  "Marine Conservation Facility",
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
  test("Eighth College is Sankofa/Pulse/Podemos/Azad/Survivance, not Marshall's halls", () => {
    /* Corrected 2026-08-04 by Sahir, a student here, after a gauntlet pass
       moved the anchor onto Thurgood Marshall's Ridge Walk North halls.
       This test exists to stop that specific mistake recurring: the label
       must sit on Eighth's OWN five buildings. */
    const p = CAMPUS.places["Eighth College"];
    assert.ok(p, "Eighth College place missing");
    assert.ok(Math.abs(p.x - (-131.2)) < 20 && Math.abs(p.z - 593.6) < 20,
      `label at ${p.x},${p.z} — expected Eighth's own buildings near (-131.2, 593.6)`);

    /* The label must land among Eighth's buildings and nowhere near Marshall's. */
    const near = (n) => {
      const b = CAMPUS.buildings.find((b) => b.n === n);
      assert.ok(b, `${n} missing`);
      const cx = b.p.reduce((a, q) => a + q[0], 0) / b.p.length;
      const cz = b.p.reduce((a, q) => a + q[1], 0) / b.p.length;
      return Math.hypot(cx - p.x, cz - p.z);
    };
    for (const n of ["Sankofa", "Pulse", "Podemos", "Azad", "Survivance"]) {
      assert.ok(near(n) < 200, `${n} is ${near(n).toFixed(0)} m from the Eighth College label`);
    }
    for (const n of ["Alianza", "Umoja", "Coalition", "Malk Hall"]) {
      assert.ok(near(n) > 800, `${n} is Marshall's, but sits ${near(n).toFixed(0)} m from the Eighth College label`);
    }
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
    /* The wings share one OSM name, so the r1c2 collision fix keys their
       measurements per ring index — one shared heights entry was a
       last-writer-wins race (see §14). Same 19.6 plane, honest keys. */
    const wingIdx = CAMPUS.buildings.flatMap((b, i) => (b.n === SALK ? [i] : []));
    for (const i of wingIdx) assert.equal(LIDAR.osmHeights[String(i)], 19.6, `wing osm:${i}`);
    assert.equal(LIDAR.heights[SALK], undefined, "the collided name key is back");
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
       Values from the 2026-08-04 targeted EPT re-sample; a few carry the
       r1c0 rebuild's decimetre re-round of the same roof (the terrain
       fold's ground means land on a 0.05 m knife edge in a few cells and
       round differently across environments — same plane, same points). */
    const PLANES = {
      "m:-28,-982": [26.1, "Wells Fargo Hall — GIS said 22.6"],
      "m:665,-123": [11.9, "Visual Arts Facility Building 2 — GIS said 10.4"],
      "m:-89,-131": [14.8, "Mandler Hall — GIS said 13.4"],
      "m:99,201": [3.1, "Bonner Hall annex — GIS said 3.0, now measured"],
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
       name (Village East Building 4, One Miramar 3/4 all sample ≥0.85
       under masses named something else). The suppression orphans below
       are from before the sweeps and may only shrink (r0c1 resolved Earth
       Hall, Douglas Hall, both Canyon Vistas and Village East 5; r1c2's
       word-suffix rule resolved Spiess Hall, the greenhouses, and the
       Mesa Nueva / Nuevo West short names by renaming their masses, and
       carries the Matthews parcel letters on the full "Matthews
       Apartments X" labels).
       A name counts as carried when a mass wears it exactly OR as a word
       suffix — "Matthews Apartments E" carries "E", "Mesa Nueva - Cala"
       would carry "Cala" — the same identity rule the builder now uses.
       The two non-suppression entries render nothing BY RULE: Geisel draws
       from its own per-floor GIS layer, and the RIMAC Annex site is a
       demolished building whose rebuild no source resolves. */
    const KNOWN = new Set([
      "Black Hall", "Geisel Library",
      "64 Degrees", "64 North",
      "Print Labs", "Nigella Hillgarth Education Center",
      "RIMAC Annex",
    ]);
    const carried = new Set(MASSES.filter((m) => m.name).map((m) => m.name));
    const carriedAsSuffix = (n) =>
      [...carried].some((c) => c !== n && (c.endsWith(` - ${n}`) || c.endsWith(` ${n}`)));
    const orphans = [...new Set(CAMPUS.buildings.map((b) => b.n).filter(Boolean))]
      .filter((n) => !carried.has(n) && !carriedAsSuffix(n) && !KNOWN.has(n));
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
    /* 12.3 is the r1c0 rebuild's decimetre re-round of the same plane. */
    assert.equal(LIDAR.massHeights["m:-49,-1057"], 12.3, "SCE#5's own plane");
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
       plane 23.2) and Social Sciences (GIS 17.1, plane 21.0). ERC Admin
       North and Robinson 1 carry the r1c0 rebuild's decimetre re-round
       of the same planes. */
    const PLANES = {
      "m:78,-656": [21, "Social Sciences Building (1995) — GIS said 17.1"],
      "m:171,-705": [23.2, "SDSC East Expansion (2009) — GIS said 17.1"],
      "m:-91,-908": [4.7, "ERC Administration North (2004)"],
      "m:16,-730": [10.3, "Robinson Building 1 (1990)"],
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

describe("11. the east-campus shard sweep (r0c2, 2026-08-04)", () => {
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

  test("the verified unnamed east-campus rings each ship their measured plane", () => {
    /* Almost nothing east of Campus Point Drive is named in OSM, so every
       ring wore an area guess. Each index below is hand-verified standing
       unchanged on Apple (2026-08-04) and carries its targeted-EPT plane
       (probe: same roofOf/rimBase as the build). The worst guesses: the
       31.3 m Campus Point tower guessed at 12, the hospital's 34 m east
       tower at 22.8, and 9 m two-storey boxes for 4 m carports. */
    /* 55, 204, 501, 781, 932, 940 carry the r1c0 rebuild's decimetre
       re-round of the same roofs (rim medians land on rounding knife
       edges; the planes did not move). */
    const PLANES = {
      0: 31.3, 55: 12.5, 63: 22.8, 113: 9.3, 119: 19.1, 132: 9.4,
      186: 13.7, 204: 15.4, 453: 19.9, 501: 8.4, 502: 34, 504: 6.3,
      505: 10, 507: 11, 509: 10.9, 510: 6.5, 781: 12.4,
      931: 6.1, 932: 6.1, 933: 8.7, 934: 5.7, 935: 3.8, 936: 4.1,
      937: 3.9, 938: 4.1, 939: 6.8, 940: 7.5, 941: 4.7, 942: 6.2,
      943: 5.7,
    };
    for (const [bi, h] of Object.entries(PLANES)) {
      assert.equal(LIDAR.osmHeights?.[bi], h, `osmHeights[${bi}]`);
      const [cx, cz] = centroidOf(CAMPUS.buildings[bi].p);
      const m = rendersNear(cx, cz).find((m) => m.src === "osm");
      assert.ok(m, `osm:${bi} vanished`);
      assert.equal(m.h, h, `osm:${bi} renders ${m.h}, plane is ${h}`);
    }
  });

  test("Prebys measures because the flight saw its FINISHED structure", () => {
    /* Prebys Cardiovascular Institute (unnamed osm:506) topped out
       mid-2013 and opened March 2015: at the 2014 flight the structure
       and roof were complete, only interiors remained. 27,500 returns,
       p75 45.5 to p98 46.9 — one tight finished plane, not formwork
       scatter. The 2014 roof IS today's roof; OSM guessed 16 m. */
    assert.equal(LIDAR.osmHeights?.["506"], 46.9);
    assert.equal(LIDAR.partHeights?.["506/0"], 47.3, "its dormant part measurement");
  });

  test("post-2014 hospital construction stays unmeasured — the epoch rule", () => {
    /* 772 (Prebys north wing pad) and 835 (Anderson Medical Pavilion,
       opened 2016) were construction sites in 2014: their returns are
       slab and staging, not roofs (772: p50 0.8 m). 508 is a canopy the
       flight saw as bare ground (0.4 m). None may wear a 2014 number. */
    for (const bi of ["772", "835", "508"]) {
      assert.equal(LIDAR.osmHeights?.[bi], undefined, `osmHeights[${bi}] violates the epoch rule`);
    }
    assert.equal(LIDAR.partHeights?.["835/0"], undefined,
      "Anderson's 4.1 m construction-site return shipped as a part again");
  });

  test("the main Scripps complex keeps its guess — no single plane exists", () => {
    /* osm:503 is the stepped 1960s-2000s hospital chain: p75 9.5 under
       towers at 32 — roofOf would flatten it to 9.5, WORSE than the 20 m
       guess. Withheld from OSM_UNNAMED_VERIFIED, and its whole-ring part
       measurement is withheld with it (same no-single-plane reason). */
    assert.equal(LIDAR.osmHeights?.["503"], undefined);
    assert.equal(LIDAR.partHeights?.["503/0"], undefined);
    const [cx, cz] = centroidOf(CAMPUS.buildings[503].p);
    const m = rendersNear(cx, cz).find((m) => m.src === "osm");
    assert.ok(m, "the hospital vanished");
    assert.equal(m.h, 20, `renders ${m.h} — the documented guess`);
  });

  test("canopy-blind and return-starved rings keep their guesses", () => {
    /* 780: a shed under full eucalyptus crown — 67 returns, p50 10 m for
       a one-storey structure; the laser cannot see this roof. 944: eight
       returns, below the 25-return trust floor. Better a guess than a
       tree's height. */
    assert.equal(LIDAR.osmHeights?.["780"], undefined);
    assert.equal(LIDAR.osmHeights?.["944"], undefined);
  });

  test("the hand-verified east-campus GIS records measure their own planes", () => {
    /* PRE_2014_GIS_VERIFIED (r0c2): hostless rings whose build dates are
       documented pre-flight. The far misses: CSC shops at GIS 4.3 vs
       planes 6.5-6.9, the hostless Fleet Services row 4.3 vs 5.7, Preuss
       Building F 8.5 vs 11.4-11.7, and the substation control building
       8.5 vs 5.3 (the record's default two storeys, measured one). */
    /* Greenhouse 2, CSC C, Preuss C and Preuss F carry the r1c0 rebuild's
       decimetre re-round of the same planes. */
    const PLANES = {
      "m:1049,-830": [5, "BFS Greenhouse 1"],
      "m:1066,-830": [5, "BFS Greenhouse 2"],
      "m:1067,-852": [5.3, "BFS Greenhouse 3"],
      "m:1082,-802": [5, "BFS Frog House"],
      "m:1070,-561": [6.8, "CSC Building C — GIS said 4.3"],
      "m:1069,-637": [6.5, "CSC Building D — GIS said 4.3"],
      "m:1723,-573": [5.3, "East Campus Substation — GIS said 8.5"],
      "m:1137,-594": [5.7, "Fleet Services south row — GIS said 4.3"],
      "m:1825,-537": [9.2, "Preuss Building A"],
      "m:1823,-511": [9.2, "Preuss Building B"],
      "m:1808,-491": [9.1, "Preuss Building C"],
      "m:1786,-549": [11.8, "Preuss Building F — GIS said 8.5"],
      "m:1751,-510": [11.4, "Preuss Building F stage house — GIS said 8.5"],
    };
    for (const [key, [h, why]] of Object.entries(PLANES)) {
      assert.equal(LIDAR.massHeights[key], h, `${why} — massHeights[${key}]`);
    }
    /* The Preuss Fabrication Lab is NOT challenged: its returns are
       eucalyptus crown top to bottom (p50 12.4 over a one-storey shop).
       The 4.6 m GIS record stands because the laser cannot see the roof. */
    assert.equal(LIDAR.massHeights["m:1788,-607"], undefined);
  });

  test("Qualcomm AA — the building the survey box clips — ships its re-sampled roof", () => {
    /* Its footprint pokes past build-campus-lidar.mjs's AREA box, so the
       standard pipeline never measures it and the 20 m area guess stood.
       Targeted re-sample of the same EPT: 30,780 returns, p98 24.3, one
       plane. KNOWN_HEIGHTS carries it (the Tenaya precedent). */
    const qaa = CAMPUS.buildings.find((b) => b.n === "Qualcomm AA");
    assert.ok(qaa, "Qualcomm AA left the dataset");
    assert.equal(qaa.h, 24.3);
    assert.equal(tallest("Qualcomm AA"), 24.3, "renders its measured height");
  });

  test("the Campus Point demolition site renders nothing", () => {
    /* Apple (2026-08-04): the unnamed 1980s service building at
       (1416, -1299) has its roof torn open with excavators on the slab —
       mid-demolition for the Alexandria buildout. The ring stays in the
       data for the day something measurable stands; nothing extrudes.
       RIMAC Annex precedent, anchored by centroid because the ring has
       no name for skipOsm. */
    assert.equal(rendersNear(1416, -1299, 10).length, 0,
      "something extrudes on the demolition site");
    assert.equal(LIDAR.osmHeights?.["171"], undefined,
      "the demolished building's 2014 plane shipped");
  });

  test("the east-campus wayfinding anchors exist where their site ways put them", () => {
    /* Neither name lives on any building footprint — every hospital
       building is an unnamed ring, and Preuss is six lettered buildings —
       so neither survived the name pass. Seeded at the OSM site ways'
       centroids (way/26103742, way/159384334). */
    const h = CAMPUS.places["Scripps Memorial Hospital La Jolla"];
    assert.ok(h, "the hospital anchor is missing");
    assert.ok(Math.hypot(h.x - 1466.1, h.z - -713.5) < 1, `anchor at (${h.x}, ${h.z})`);
    const s = CAMPUS.places["The Preuss School"];
    assert.ok(s, "the school anchor is missing");
    assert.ok(Math.hypot(s.x - 1791.6, s.z - -480.3) < 1, `anchor at (${s.x}, ${s.z})`);
  });
});

describe("12. the west shard sweep (r1c0, 2026-08-04)", () => {
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

  test("the verified La Jolla Farms rings each ship their measured plane", () => {
    /* Nothing west of the campus proper is named in OSM, so every estate,
       townhouse and cottage wore an area guess. Each index below was
       re-sampled from the EPT, shipped only where the roof read as ONE
       plane, and checked standing on its 2014 footprint in an Apple
       closeup (2026-08-04). Guesses ran both directions: 9 m for
       one-storey ranch houses (319 measures 4.4, 906 3.7, 1009 3.4) and
       4.5 m for two-storey townhouses (725-727 measure 7.8-7.9). */
    const PLANES = {
      177: 4.5, 319: 4.4, 320: 4.4, 321: 4.4, 486: 2, 487: 7.2, 488: 8.8, 489: 6,
      490: 4.4, 491: 4.4, 721: 7.8, 722: 7.8, 723: 7.9, 725: 7.8, 726: 7.9, 727: 7.8,
      728: 8, 730: 8.3, 731: 8.4, 732: 7.8, 733: 8.7, 734: 7.3, 735: 8.8, 739: 8.1,
      740: 8.4, 741: 8.1, 742: 8.6, 748: 8.1, 749: 8.4, 750: 8.5, 751: 8.2, 752: 8.2,
      755: 8, 756: 8.6, 757: 8.1, 777: 3.3, 829: 7.6, 831: 8.1, 885: 9.1, 902: 4,
      905: 4.5, 906: 3.7, 908: 4.6, 911: 9, 912: 8.4, 913: 8.8, 914: 7.1, 915: 9.6,
      916: 4.3, 979: 4.2, 980: 4.8, 981: 4.9, 983: 8.6, 984: 3.7, 987: 8.2, 988: 5.2,
      989: 4.4, 990: 4.5, 991: 7.7, 992: 4.2, 993: 8.2, 994: 5.2, 995: 8.8, 998: 4.2,
      1000: 5.7, 1001: 8, 1003: 8.7, 1004: 7.6, 1005: 8.6, 1006: 8.6, 1009: 3.4, 1010: 8,
      1011: 7.4, 1012: 3.4, 1014: 3.8, 1015: 4.9, 1016: 4.5, 1018: 4.4, 1019: 7.5, 1020: 5.2,
      1021: 8.7, 1025: 3.4, 1026: 3.1, 1027: 4.5, 1029: 3.9, 1030: 3.4, 1031: 4.1, 1088: 8.8,
      1090: 7.9, 1091: 7.9, 1092: 6.1, 1095: 8.5, 1386: 5.3, 1387: 4.5, 1388: 8,
    };
    for (const [bi, h] of Object.entries(PLANES)) {
      assert.equal(LIDAR.osmHeights?.[bi], h, `osmHeights[${bi}]`);
    }
  });

  test("the canopy-blind and hidden La Jolla Farms rings keep their guesses", () => {
    /* Prior "no structure" withhold on 481 and the first-pass planeTight
       withholds on 903/1028/1094 moved to §21 — Apple + thin-shelf rule
       now admit them. The rest measured, but their spreads put p98 in a
       tree with bodies too loose to trust p75 (986: p50 3.7 under a p98
       of 8.9), or sit under the 85% dense cut (996 at 84%). The OSM
       guesses stand, stated as guesses. */
    for (const bi of [322, 480, 485, 832, 904, 907, 909, 910,
      982, 986, 996, 997, 999, 1002, 1007, 1008, 1013, 1017, 1022, 1023,
      1024, 1089]) {
      assert.equal(LIDAR.osmHeights?.[bi], undefined, `osmHeights[${bi}] shipped a plane no one trusts`);
    }
  });

  test("the Extended Studies cottages measure their planes; the crowned five keep the record", () => {
    /* Hostless GIS masses (no OSM rings at all) stood unchallenged at the
       record's uniform 4.3 m. Five roofs read as one-storey planes 0.4-1.1
       off that; five more sit under the eucalyptus rows (Building A: p50
       3.2 under a p75 of 8.2) where no percentile guard reaches the roof,
       so the record stands for them. */
    const PLANES = {
      "m:-201,-423": [3.2, "Building F"],
      "m:-217,-474": [3.5, "Building G"],
      "m:-223,-381": [3.9, "Building X"],
      "m:-206,-369": [3.4, "Building Z"],
      "m:-179,-443": [3.3, "Building E"],
    };
    for (const [key, [h, why]] of Object.entries(PLANES)) {
      assert.equal(LIDAR.massHeights[key], h, `${why} — massHeights[${key}]`);
    }
    for (const [key, why] of [
      ["m:-206,-395", "Building A"], ["m:-180,-416", "Building C"],
      ["m:-198,-468", "Building D"], ["m:-173,-478", "Building L"],
      ["m:-220,-436", "Building B"],
    ]) {
      assert.equal(LIDAR.massHeights[key], undefined, `${why} shipped its eucalyptus`);
    }
  });

  test("Tuolumne renders as its nine measured houses, not a 17 m outline", () => {
    /* The whole-complex OSM ring extruded at a whole-ring 17.3 m through
       nine facilities masses measuring 9.3-16.2 individually — the same
       outline problem as Alianza/Umoja, fixed the same way (skipOsm).
       T House North's centroid falls in a notch outside the concave
       complex ring, so host containment missed it and 12.2 m of record
       stood for a 13.0 m plane — PRE_2014_GIS_VERIFIED answers its epoch
       now (the complex is 2003). */
    assert.equal(MASSES.find((m) => m.src === "osm" && m.name === "Tuolumne Apartments"), undefined,
      "the whole-complex outline extrudes again");
    assert.equal(LIDAR.massHeights["m:-172,-33"], 13, "T House North's own plane");
    const tuolumne = MASSES.filter((m) => m.src === "gis" && /Tuolumne/.test(m.name || ""));
    assert.equal(tuolumne.length, 9, `nine Tuolumne masses, got ${tuolumne.length}`);
    const thn = rendersNear(-172, -33).find((m) => m.src === "gis");
    assert.ok(thn && thn.h === 13, `T House North renders ${thn?.h}, plane is 13`);
  });

  test("the 2015 Spanos APC never wears the eucalyptus; the 1988 building keeps its plane", () => {
    /* Two buildings share one OSM name. The Performance Center broke
       ground in June 2015 — after the flight — and the 11-16 m smear over
       its footprint is the eucalyptus row cleared for it. The 1988
       Training Facility south of it is a real 2014 plane (3,329 returns,
       p50 4.3). HAND_AUDITED ships the 1988 roof under the shared name
       and bars both GIS masses from adopting the crown; each renders at
       its own record (4.3 m, one level). */
    assert.equal(LIDAR.heights["Spanos Athletic Performance Center"], 4.4);
    assert.equal(LIDAR.massHeights["m:61,-1355"], undefined, "the APC shipped its eucalyptus");
    assert.equal(LIDAR.massHeights["m:65,-1308"], undefined, "the audited host's mass re-measured");
    for (const [x, z, what] of [[61, -1355, "Performance Center"], [65, -1308, "Training Facility"]]) {
      const m = rendersNear(x, z).find((m) => m.src === "gis");
      assert.ok(m, `the Spanos ${what} vanished`);
      assert.ok(m.h <= 4.4, `the Spanos ${what} renders ${m.h} — taller than its record`);
    }
  });

  test("rings that poke past the survey box still measure — the disjoint-test regression", () => {
    /* The box test rejected any ring POKING past the north edge instead
       of rings entirely beyond it (bb.maxy where bb.miny was meant), so
       Torrey Pines Center South — whose OSM ring reaches 22 m past
       AREA.north — silently lost its 12.2 m measurement on any rebuild
       after the 2026-08-04 Overpass refresh moved its ring, and Qualcomm
       AA needed a KNOWN_HEIGHTS workaround. TPCS measures from the
       returns inside the box (31,730 in the full ring, one plane at
       12.2); QAA's box-clipped ring measures a TRUNCATED footprint, so
       HAND_AUDITED carries its full-ring re-sample instead. */
    assert.equal(LIDAR.heights["Torrey Pines Center South"], 12.2);
    assert.equal(LIDAR.massHeights["m:-188,-1361"], 11.5, "TPCS's own mass plane");
    assert.equal(LIDAR.heights["Qualcomm AA"], 24.3, "the audited full-ring plane");
  });

  test("H1 spot-check: LiDAR and the shipped world agree where nothing changed", () => {
    /* Independent re-samples of the same EPT over the shard's named
       buildings, against the build's own OSM-ring measurements (their
       GIS masses render 0.2-0.4 different off their own slightly
       different rings — both are the same roof). Agreement within
       0.2 m on every clean plane is the epoch hypothesis doing its
       job. */
    const AGREE = {
      "Tioga Hall": 35.8,                        // re-sample 35.7
      "Keeling Apartments North Tower": 34.4,    // re-sample 34.4
      "Keeling Apartments West Bar": 18.2,       // re-sample 18.2
      "Keeling Apartments South Tower": 29.2,
      "Housing Dining and Hospitality Administration Building": 19.8, // re-sample 19.8
      "Audrey Geisel University House": 6.3,     // re-sample 6.4
    };
    for (const [n, h] of Object.entries(AGREE)) {
      assert.equal(LIDAR.heights[n], h, `heights[${n}]`);
    }
  });

  test("the Muir west pad carries no stale tennis paint", () => {
    /* Apple (2026-08-04) shows the red pad repainted as pickleball; the
       two tennis courts the registered chunks carry are the previous
       generation. The new lines cannot ship until an Apple registration
       passes gate — better absent than stale. The east pad's four courts
       still fit (0.23 m, 54%). */
    const MARKINGS = read("docs/data/campus-markings.json");
    assert.equal(MARKINGS.facilities.find((f) => f.id === "muir-tennis-west"), undefined,
      "the repainted pad still carries tennis lines");
    const east = MARKINGS.facilities.find((f) => f.id === "muir-tennis-east");
    assert.ok(east, "the east pad lost its courts");
  });
});

describe("13. the r1c1 judge pass (2026-08-04)", () => {
  const centroidOf = (ring) => {
    let x = 0, z = 0;
    for (const p of ring) { x += p[0]; z += p[1]; }
    return [x / ring.length, z / ring.length];
  };
  const rendersNear = (x, z, tol = 5) =>
    MASSES.filter((m) => {
      const [cx, cz] = centroidOf(m.rings[0]);
      return Math.hypot(cx - x, cz - z) < tol;
    });

  test("SSC and CMRR render exactly once — the exact-name twin carries the name", () => {
    /* Both facilities rings are drawn offset enough that their centroids
       miss the OSM rings, so the old name test failed, the ≥0.85 area
       test never ran, and each building rendered twice: the OSM copy
       extruded through massing that already IS the building and already
       SAYS its name (SSC samples 0.93 covered, CMRR 0.99). The twin rule
       — a mass wearing EXACTLY the OSM name within 150 m carries it —
       lets the area test see them. */
    for (const [n, h] of [
      ["Student Services Center", 22.7],
      ["Center for Memory and Recording Research", 12.9],
    ]) {
      const all = MASSES.filter((m) => m.name === n);
      assert.equal(all.length, 1, `${n} renders ${all.length} times`);
      assert.equal(all[0].src, "gis", `${n} renders from ${all[0].src}`);
      assert.equal(all[0].h, h, `${n} renders ${all[0].h}, plane is ${h}`);
    }
  });

  test("the twin rule never deletes an identity it cannot carry", () => {
    /* VAF Building 3's exact-name twin is within 150 m but covers NONE of
       the OSM ring (a position disagreement logged in FINDINGS, not fixed
       blind), so the ring must keep rendering — suppression without a name
       carrier deletes the only ring that knows what the building is called.
       Cala used to be this test's other case; the r1c2 word-suffix rule
       (§14) taught the carrier test that "Mesa Nueva - Cala" IS Cala, so
       the identity is carried now and the double render is gone — the mass
       renders once, wearing the OSM name. */
    assert.ok(MASSES.some((m) => m.src === "osm" && m.name === "Visual Arts Facility - Building 3"),
      "Visual Arts Facility - Building 3 vanished");
    assert.equal(MASSES.filter((m) => m.name === "Cala").length, 1, "Cala must render exactly once");
    const cala = MASSES.find((m) => m.name === "Cala");
    assert.equal(cala.src, "gis", "Cala's carrier is the university mass");
  });

  test("Vela renders as its university masses, never as a 19 m outline slab", () => {
    /* Vela is modelled in OSM as two building:parts, but only the tower
       box carries a height — so counting the FILTERED parts flipped the
       whole building onto the outline path: a 19 m slab through the
       paseo and both towers the PCW massing already renders. The gate
       reads the RAW part count now; the covered tower part yields to
       the 70.1 m / 23-level GIS mass under it. Buildings whose parts
       ALL dropped (Tapestry, Catalyst, Kaleidoscope) keep the outline —
       with nothing else to render, the hull is all there is. */
    assert.equal(MASSES.find((m) => m.src === "osm" && m.name === "Vela" &&
      Math.hypot(centroidOf(m.rings[0])[0] - 799.3, centroidOf(m.rings[0])[1] - 67.3) < 40), undefined,
      "the Vela outline extrudes again");
    const tower = rendersNear(809, 97).find((m) => m.src === "gis");
    assert.ok(tower && tower.h === 70.1, `the Vela tower renders ${tower?.h}, the record is 70.1`);
    for (const n of ["Tapestry", "Catalyst", "Kaleidoscope"]) {
      assert.ok(MASSES.some((m) => m.src === "osm" && m.name === n), `${n}'s outline fallback vanished`);
    }
  });

  test("the two demolished pads render nothing", () => {
    /* Two one-storey buildings the 2014 flight measured as clean planes
       (4.9 and 5.0 m) are gone: the Triton Center predecessor at
       (545.3, 48.3) — bare dirt on the registered chunk, a staging pad
       with trailers on Apple, the new frames rising beside it in Street
       View 2025-02 — and the pad at (374.4, -88.3), razed for the dig
       south of the Chancellor's Complex. Their OSM rings survive and
       wore 12 and 9 m area guesses. Better absent than wrong.
       r1c1 re-sweep extends the same class to (404.0, -65.6) — see §22. */
    for (const [x, z] of [[545.3, 48.3], [374.4, -88.3]]) {
      const there = rendersNear(x, z, 10);
      assert.equal(there.length, 0,
        `a demolished building renders at (${x},${z}): ${there.map((m) => m.name ?? "unnamed")}`);
    }
  });

  test("Black Hall wears its OSM name and its 2014 plane", () => {
    /* The inventory calls the mass "Black Apartments" and its centroid
       lands in its own courtyard, so no host was ever found: the 18.3 m
       record stood unchallenged while the suppressed OSM ring took the
       "Black Hall" name down with it — Douglas Apartments all over
       again, fixed by the same rename. Both the OSM ring and the GIS
       ring measure the same plane: 16.1 m (p98, no guard). */
    assert.equal(LIDAR.heights["Black Hall"], 16.1);
    assert.equal(LIDAR.massHeights["m:790,-451"], 16.1, "the mass measures its own ring");
    const rendered = MASSES.filter((m) => m.name === "Black Hall");
    assert.equal(rendered.length, 1, `Black Hall renders ${rendered.length} times`);
    assert.equal(rendered[0].h, 16.1, `Black Hall renders ${rendered[0].h}`);
    assert.equal(MASSES.find((m) => /Black Apartments/.test(m.name || "")), undefined,
      "the inventory name still renders somewhere");
  });

  test("Solis Hall sheds the eucalyptus and keeps its dense-band roof", () => {
    /* The lecture hall's east edge sits under the eucalyptus stand both
       epochs show pressed against it; 62% of its returns lie in a dense
       5-6.5 m band and the rest run up the crowns to 24.8, so the
       tree-guard's p75 (14.9) was still in canopy — the Stage Room
       failure — and the host-level reconcile smeared it onto the GIS
       mass too. The roof is the band's p50: 6.4 m (GIS eave 4.3, one
       level). */
    assert.equal(LIDAR.heights["Solis Hall"], 6.4);
    const rendered = MASSES.filter((m) => m.name === "Solis Hall");
    assert.equal(rendered.length, 1, `Solis renders ${rendered.length} times`);
    assert.equal(rendered[0].h, 6.4, `Solis renders ${rendered[0].h}, the audited roof is 6.4`);
  });

  test("the TES tank and the VA plant ship their planes; the VA garage keeps its guess", () => {
    /* Three unnamed rings, three different answers. 224 is the Central
       Utilities Plant's thermal storage tank — one plane, p50 26.4 to
       p98 27.0, standing identically in both epochs; its area guess was
       9 m, an 18 m miss. 826 is the white plant block at the VA — p50 6.3
       to max 6.5, the tightest plane in the batch. 438 is the VA parking
       structure: Apple shows a finished multi-deck garage, but the 2014
       returns read p50 2.4 m — a surface lot. It postdates the flight,
       so no 2014 number may ship and the stated 20 m guess stands. */
    assert.equal(LIDAR.osmHeights?.[224], 27, "the tank's plane");
    assert.equal(LIDAR.osmHeights?.[826], 6.4, "the VA plant's plane");
    assert.equal(LIDAR.osmHeights?.[438], undefined, "the garage shipped a 2014 number it cannot have");
    assert.equal(rendersNear(195.8, 483.3).find((m) => m.src === "osm")?.h, 27);
    assert.equal(rendersNear(832.9, 357.7).find((m) => m.src === "osm")?.h, 6.4);
    assert.equal(rendersNear(840.9, 452.2, 12).find((m) => m.src === "osm")?.h, 20);
  });

  test("the stepped complexes keep their verified state — rejected candidates stay rejected", () => {
    /* A screener proposed dropping Jacobs Hall to its p50 (20.8). The
       complex is genuinely stepped — 20 m wings under a 34-39 m cruciform
       core that extends past the tower's own GIS ring, so even the
       minus-tower re-sample has no single plane (p50 20.7, p75 25.3,
       p98 34.5). The Urey rule holds: the mass emits nothing and the
       host answers (33.2, the guarded p75); the tower mass measures its
       own 39.8. HSS is the same shape done right: tower 36.7, low wing
       at its 8.5 m record. */
    assert.equal(LIDAR.heights["Jacobs Hall"], 33.2);
    assert.equal(LIDAR.massHeights["m:553,-418"], 39.8, "the Jacobs tower's own plane");
    assert.equal(LIDAR.massHeights["m:-48,-34"], 36.7, "the HSS tower's own plane");
    const hssLow = rendersNear(-43, -56).find((m) => m.src === "gis" && m.h === 8.5);
    assert.ok(hssLow, "the HSS low wing left its record");
  });
});

describe("14. the r1c2 judge pass (2026-08-04)", () => {
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

  test("a duplicate OSM name never shares one heights key", () => {
    /* lidar.heights is keyed by name, and OSM names are not unique: nine
       names on this campus belong to two rings each, and a shared key is a
       last-writer-wins race — both Spinal Cord Injury Buildings shipped
       6.4 m because the ring the build visited second was a mostly-empty
       post-2014 site. Collided names emit per ring index now. The one
       deliberate exception is HAND_AUDITED's name-level answer (Spanos),
       written knowing both rings. */
    const count = new Map();
    for (const b of CAMPUS.buildings) if (b.n) count.set(b.n, (count.get(b.n) || 0) + 1);
    const collided = [...count].filter(([, c]) => c > 1).map(([n]) => n);
    assert.ok(collided.length >= 5, `the duplicate-name class vanished? ${collided}`);
    const leaked = collided.filter((n) => !(n in { "Spanos Athletic Performance Center": 1 }) &&
      LIDAR.heights[n] !== undefined);
    assert.deepEqual(leaked, [], `collided names back on the shared key: ${leaked}`);
  });

  test("the two Spinal Cord Injury Buildings are two buildings, one per epoch", () => {
    /* osm:223 is the 1990s center: 17,154 returns, p50 = p90 = 17.2, a
       plane the flight measured on a building Apple still shows standing
       (its 15.6 OSM tag was a floor-count guess). osm:954 is the VA's
       replacement hospital, built 2021-2026 — the 2014 returns under it
       (p50 1.2) are the lot it replaced, so no LiDAR number may ship and
       the OSM tag stands, stated as what it is. Both wore 6.4 m — the
       collision above pasted the southern site's plane onto both. */
    const old = rendersNear(940.7, 238.6, 10).find((m) => m.src === "osm");
    const nw = rendersNear(948.7, 320.8, 10).find((m) => m.src === "osm");
    assert.equal(old?.h, 17.2, `the 1990s SCI center ships ${old?.h}`);
    assert.equal(nw?.h, 15.6, `the 2021-2026 hospital ships ${nw?.h}`);
    const idx223 = CAMPUS.buildings.findIndex((b, i) => b.n === "Spinal Cord Injury Building" &&
      Math.hypot(...centroidOf(b.p).map((v, k) => v - [940.7, 238.6][k])) < 10);
    assert.equal(LIDAR.osmHeights[String(idx223)], 17.2, "the old center's per-ring plane");
  });

  test("the Pepper Canyon rename thefts are undone — one name, one building", () => {
    /* The OSM ring over the PC Apartments 1300 block is drawn wearing the
       Assistant Dean's Residence's name; the real residence is the small
       house 38 m west, its own GIS mass with the same name. The host
       rename hung the Dean's label on both and handed the apartments' name
       to the LAUNDRY through a second mis-drawn ring — which is also where
       the facades keyed "Pepper Canyon Apartments 1300" were landing. The
       guarded rename refuses a name the university's record already gives
       a different nearby building. */
    const deans = MASSES.filter((m) => m.name === "Pepper Canyon Assistant Dean's Residence");
    assert.equal(deans.length, 1, `the Dean's Residence renders ${deans.length} times`);
    assert.equal(deans[0].h, 6.1, "the residence keeps its record");
    const pc1300 = rendersNear(983.1, -8.2, 5).find((m) => m.src === "gis");
    assert.equal(pc1300?.name, "Pepper Canyon Apartments 1300", `the apartments wear "${pc1300?.name}"`);
    assert.equal(pc1300?.h, 11.5, "the apartments' own 2014 plane");
    const laundry = rendersNear(1003, 32.6, 5).find((m) => m.src === "gis");
    assert.equal(laundry?.name, "Pepper Canyon South Laundry", `the laundry wears "${laundry?.name}"`);
  });

  test("the guarded rename keeps the swaps and loses the thefts", () => {
    /* Meteor and Galathea Halls are a pure swap — each GIS mass stands in
       the other's OSM ring, no third party — and OSM is the name
       authority, so the swap must survive the guard. The Spanos pair is a
       theft: the OSM "Performance Center" ring reaches over the 1988
       TRAINING facility's mass and was pasting the shared name on both
       neighbours; each keeps its own university name now. James' Place
       had vanished under a second "Mandell Weiss Forum" the same way. */
    assert.ok(rendersNear(-41.7, 454.7, 6).some((m) => m.name === "Meteor Hall"), "the Meteor swap reverted");
    assert.ok(rendersNear(-69, 462.1, 6).some((m) => m.name === "Galathea Hall"), "the Galathea swap reverted");
    const atf = rendersNear(64.6, -1308.4, 6).find((m) => m.src === "gis");
    assert.equal(atf?.name, "Spanos Athletic Training Facility", `the 1988 building wears "${atf?.name}"`);
    const apc = rendersNear(60.7, -1355.2, 6).find((m) => m.src === "gis");
    assert.equal(apc?.name, "Spanos Athletic Performance Center", `the 2015 building wears "${apc?.name}"`);
    assert.equal(MASSES.filter((m) => m.name === "Mandell Weiss Forum").length, 1, "the Forum duplicated again");
    assert.ok(MASSES.some((m) => m.name === "James' Place"), "James' Place vanished again");
  });

  test("Cala renders once, as the university mass wearing the student name", () => {
    /* The OSM ring and the "Mesa Nueva - Cala" mass rendered twice at the
       same 24.4 m — the exact-name carrier test could not see through the
       facilities prefix, and the ring's own centroid falls in its
       courtyard. The word-suffix rule suppresses the ring, the mass takes
       the OSM name (name only — its ring may be partial, so no height
       flows through this path), and the researched facades keyed "Cala"
       land on the building again. Mesa Nueva is 2017: the height is the
       university's 8-level record, and no 2014 return may touch it. */
    const calas = MASSES.filter((m) => m.name === "Cala");
    assert.equal(calas.length, 1, `Cala renders ${calas.length} times`);
    assert.equal(calas[0].src, "gis");
    assert.equal(calas[0].h, 24.4, `Cala ships ${calas[0].h} — the post-2014 record is 24.4`);
  });

  test("Matthews Apartments render as five named, measured houses", () => {
    /* 1972 housing, still occupied — pre-2014 documented, unchanged on
       Apple. OSM tags the five parcels "A".."E"; the university records
       said 6.1 m (the two-storey default) while the 2014 planes read
       8.5-8.7. E's roof edge sits under canopy (p98 13.4), so its guarded
       plane lands at 7.8 — its own measurement, not a borrowed sibling's.
       The letter rings suppress under the full names, and no mass ships a
       bare parcel letter. */
    const want = { A: [916.4, -107.4, 8.6], B: [968.4, -91.8, 8.5], C: [1047, -57.8, 8.6],
      D: [970.3, -33.8, 8.7], E: [935.7, -47.3, 7.8] };
    for (const [letter, [x, z, h]] of Object.entries(want)) {
      const m = rendersNear(x, z, 6).find((o) => o.src === "gis");
      assert.equal(m?.name, `Matthews Apartments ${letter}`, `house ${letter} wears "${m?.name}"`);
      assert.equal(m?.h, h, `Matthews ${letter} ships ${m?.h}, its plane is ${h}`);
    }
    assert.equal(MASSES.find((m) => /^[A-E]$/.test(m.name || "")), undefined,
      "a bare parcel letter still renders");
  });

  test("the health-campus records challenged by their own 2014 planes", () => {
    /* Campus Point Parking Structure West stood complete in the flight —
       12,626 returns, p50 12.9 to p98 14.4, decks at a garage's ~2.9 m
       pitch — while its record carried five levels at the 4.27 m default
       (21.3). Its East sibling went up WITH Jacobs Medical Center and
       stays a post-2014 record (12.8), per r0c2. The utilities plant
       (~2000) measures 8.3 against a 4.3 one-level record; the 9435
       trailer banks measure 3.8... rounded through their rim to 3.7
       against an 8.5 two-storey default; the Stuart Collection shed
       (building 91) measures 4.4 against the same default. */
    assert.equal(rendersNear(1416.5, -151.7, 6)[0]?.h, 14.4, "CPP West's measured decks");
    assert.equal(rendersNear(1505.4, -226.3, 6)[0]?.h, 12.8, "CPP East's post-2014 record");
    assert.equal(rendersNear(1814.7, -258.1, 6)[0]?.h, 8.3, "the utilities plant's plane");
    assert.equal(rendersNear(1315.2, -7.6, 6)[0]?.h, 3.7, "the 9435 modulars' plane");
    assert.equal(rendersNear(1041.6, -430.2, 6)[0]?.h, 4.4, "the Stuart shed's plane");
  });

  test("the epoch withholds stay withheld — records stand where the laser cannot answer", () => {
    /* East Campus Utilities Plant EXPANSION: built 2016; the tight 7.5 m
       of 2014 returns under its footprint belong to its predecessor, and
       no admissible source resolves the finished structure — the record
       stands. Anne Ratner and its expansion: the center's roof steps
       (p50 4.6 under a 10.2 crown shared with Shiley's vault) and the
       expansion is building 817, too close to the 2015-16 Shiley
       expansion generation to admit a 2014 plane unverified — records
       stand. Mesa 9242/9240: the Mesa Nueva towers bleed through both
       rings (p50 20.3 over two-storey apartments) — records stand. The
       trolley platform structures and the Warren Field House are
       post-2014 (the fieldhouse site has ZERO 2014 returns — the
       temporary replacement went up ~2020 and stands on Apple and in
       Street View 2025) — records ship, the zero-plane never does. */
    assert.equal(rendersNear(1813.5, -287, 6)[0]?.h, 4.3, "the Expansion left its record");
    assert.equal(rendersNear(1670.8, -132.6, 6)[0]?.h, 4.3, "Anne Ratner left its record");
    assert.equal(rendersNear(1664.1, -148.7, 6)[0]?.h, 4.3, "the Ratner expansion left its record");
    assert.equal(rendersNear(1832.7, 434.6, 6)[0]?.h, 6.1, "Mesa 9242 adopted tower bleed");
    assert.equal(rendersNear(1119.1, -294.6, 6)[0]?.h, 4.6, "the Field House left its record");
    for (const [x, z] of [[1590.5, -452.8], [1596.4, -450.4], [1584.9, -455.4]]) {
      assert.equal(rendersNear(x, z, 4)[0]?.h, 4.6, `a trolley structure at (${x},${z}) left its record`);
    }
  });

  test("the unnamed VA-corridor rings: two planes ship, one guess stands, one garage is refused", () => {
    /* 764 is the VA plant building east of the hospital: p50 6.9 under a
       9.7 roof, against a 12 m area guess. 775 is the small modular by
       the 9435 banks: 3.8 against 4.5. 833 is the VA's 2023 garage — the
       flight saw a surface lot (p50 0), so the 16 m guess stands and no
       2014 number may ever ship (per-ring epoch, POST_2014_OSM_RINGS).
       762's returns are three-quarters neighbour bleed; its 4.5 guess
       agrees with the dense band and stands. */
    assert.equal(LIDAR.osmHeights?.[764], 9.7);
    assert.equal(LIDAR.osmHeights?.[775], 3.8);
    assert.equal(LIDAR.osmHeights?.[833], undefined, "the 2023 garage shipped a 2014 number");
    assert.equal(rendersNear(1023.5, 276.6, 8).find((m) => m.src === "osm")?.h, 9.7);
    assert.equal(rendersNear(917.3, 442.9, 10).find((m) => m.src === "osm")?.h, 16);
    assert.equal(rendersNear(1444, -86.7, 8).find((m) => m.src === "osm")?.h, 4.5);
  });

  test("the rejected candidates stay rejected — Viterbi, the Bed Tower, VAF-B3", () => {
    /* Viterbi (2024) ships its documented Street-View floor estimate of
       18 m; the flight saw its site at p50 0.1 and must stay silent. The
       Jacobs Bed Tower's 61.2 is the 2014 plane of a shell topped out by
       the flight — a screener proposed an Atkinson-style carve, but the
       minus-tower re-sample has no plane (p50 16.8 under a p75 of 51.4):
       the crown measurement stands. VAF Building 3's two rings each ship
       their OWN plane now (11.7 and 11.5) instead of racing for one key. */
    assert.equal(LIDAR.heights["Viterbi Family Vision Research Center"], undefined);
    assert.equal(rendersNear(1615.6, -136, 8).find((m) => m.src === "osm")?.h, 18);
    assert.equal(LIDAR.massHeights["m:1379,40"], 61.2, "the Bed Tower crown plane");
    assert.equal(LIDAR.massHeights["m:1387,44"], 65.9, "the JMC tower plane");
    const vafIdx = CAMPUS.buildings.flatMap((b, i) =>
      (b.n === "Visual Arts Facility - Building 3" ? [i] : []));
    const vafPlanes = vafIdx.map((i) => LIDAR.osmHeights[String(i)]).sort();
    assert.deepEqual(vafPlanes, [11.5, 11.7], `VAF-B3 per-ring planes: ${vafPlanes}`);
  });
});

describe("15. the r2c1 judge pass (2026-08-05)", () => {
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

  test("Che Café and Laurel wear their roofs, not the grove above them", () => {
    /* The Che Café sits INSIDE the eucalyptus grove — Street View shows
       trunks through its deck — and 48% of its returns land in a dense
       2-4 m band while the rest climb the crowns to 29. The tree-guard's
       p75 (20.4) was pure canopy, and the host-level reconcile pasted it
       onto the university's 4.3 m eave record: a one-storey wooden venue
       extruded at 20.9. Laurel is the same failure at half the height
       (70% of returns in the 4 m bin, p75 9.2 in the overhanging crowns,
       shipped 9.9). The audited roofs are the dense bands' p50s — 3.8
       and 4.2 — and the records (4.3 eave, one level each) agree. */
    const che = rendersNear(174.9, 572.3, 6).find((m) => m.src === "gis");
    assert.equal(che?.name, "Che Café Collective", `the Che Café wears "${che?.name}"`);
    assert.equal(che?.h, 3.8, `the Che Café ships ${che?.h} — the grove again?`);
    assert.equal(LIDAR.heights["Che Café Collective"], 3.8, "the audited roof");
    const laurel = rendersNear(584.2, 507.5, 6).find((m) => m.src === "gis");
    assert.equal(laurel?.name, "Laurel", `Laurel wears "${laurel?.name}"`);
    assert.equal(laurel?.h, 4.2, `Laurel ships ${laurel?.h} — the crowns again?`);
    assert.equal(LIDAR.heights["Laurel"], 4.2, "the audited roof");
    /* Its unshaded siblings measured clean and stay untouched. */
    assert.equal(rendersNear(580.8, 519.8, 4)[0]?.h, 4.3, "Laurel Extension's own plane");
    assert.equal(rendersNear(603.6, 507.7, 4)[0]?.h, 4.3, "Magnolia's own plane");
  });

  test("the Weiss Forum union splits — the Shank Theatre is its own building", () => {
    /* The facilities record traced the Forum AND most of the Shank
       Theatre as one 1,987 m² ring, so the Shank's OSM footprint
       suppressed under it — while a second 56 m² "Forum" sliver standing
       centroid-inside the Shank ring took the theatre's NAME through the
       host rename, hanging it on a 3.2 m shed. Both record rings are
       union outlines now: the OSM division renders, each theatre at its
       own 2014 plane (Forum 10.5, Shank 10.1 — the union ring's own
       trace read 10.4, the Forum's plane, wrong over the Shank). */
    assert.equal(MASSES.filter((m) => m.src === "gis" && m.name === "Mandell Weiss Forum").length,
      0, "a Forum record ring is back");
    const shank = MASSES.filter((m) => m.name === "Theodore and Adele Shank Theatre");
    assert.equal(shank.length, 1, `the Shank Theatre renders ${shank.length} times`);
    assert.equal(shank[0].src, "osm", "the Shank renders from its own OSM footprint");
    assert.equal(shank[0].h, 10.1, `the Shank ships ${shank[0].h}, its plane is 10.1`);
    const forum = MASSES.filter((m) => m.name === "Mandell Weiss Forum");
    assert.equal(forum.length, 1, `the Forum renders ${forum.length} times`);
    assert.equal(forum[0].h, 10.5, `the Forum ships ${forum[0].h}, its plane is 10.5`);
    assert.ok(shank[0].h > 5, "the name-steal sliver is back at 3.2 m");
  });

  test("the Satellite Utility Plant renders once, at its post-2014 record", () => {
    /* The plant opened ~2018-19; the flight's tight 4.0-4.2 m plane
       (416 returns) is the LOW predecessor demolished for it. A screener
       proposed "measuring" the plant at 4.2 — a date read as an error.
       Street View 2020-03 and today's Apple show the tall finished
       block: the 12.8 m / 3-level record ships unchallenged, and the
       unnamed OSM ring over its west half (osm:718, 0.78 area-covered)
       suppresses instead of z-fighting it at a 9 m guess. */
    const sup = MASSES.filter((m) => m.name === "Satellite Utility Plant");
    assert.equal(sup.length, 1, `the plant renders ${sup.length} times`);
    assert.equal(sup[0].src, "gis");
    assert.equal(sup[0].h, 12.8, `the plant ships ${sup[0].h} — the predecessor's plane?`);
    assert.equal(LIDAR.massHeights["m:419,523"], undefined, "the 2014 predecessor plane shipped");
    assert.equal(LIDAR.osmHeights?.[718], undefined, "osm:718 carries a 2014 number");
    assert.equal(rendersNear(414.4, 518.0, 3).filter((m) => m.src === "osm").length,
      0, "osm:718 renders through the plant's record again");
  });

  test("the post-2014 rings keep their declared guesses and the flight stays silent", () => {
    /* osm:1354, south of La Jolla Village Drive: 48 returns, max 1.7 m —
       a bare lot in 2014 and STILL bare in Street View 2018-05, while
       today's Apple shows the finished pitched-roof building. Built
       after mid-2018: no 2014 number may ship, and the ring keeps its
       stated area guess. */
    assert.equal(LIDAR.osmHeights?.[1354], undefined, "a 2014 number shipped for osm:1354");
    const m1354 = rendersNear(-11.1, 904.7, 4).find((m) => m.src === "osm");
    assert.equal(m1354?.h, 12, `osm:1354 ships ${m1354?.h} — its declared guess is 12`);
  });

  test("the verified west-corridor rings ship their planes", () => {
    /* Four unnamed rings standing unchanged on today's Apple, each with
       a clean 2014 plane: the grid-roof complex (93: 7,543 returns,
       plane 11.8 against a 16 guess), the L-shaped commercial block
       (77: one plane at 7.5, the 28 m tail is ficus the guard already
       discards; tagged 12), and the two La Jolla Village Square strips
       (333/335: planes 8.2 and 7.7 against a mapper's 4.8 under-tag). */
    for (const [i, h, x, z] of [
      [93, 11.8, 482.3, 783.2], [77, 7.5, 808.1, 791.6],
      [333, 8.2, 874.1, 941.9], [335, 7.7, 815.2, 948.7],
    ]) {
      assert.equal(LIDAR.osmHeights?.[i], h, `osm:${i}'s plane`);
      assert.equal(rendersNear(x, z, 4).find((m) => m.src === "osm")?.h, h,
        `osm:${i} renders at its plane`);
    }
  });

  test("no unnamed ring renders while half-covered by massing that is the building", () => {
    /* The class invariant behind the osm:718 fix, checked the way
       ringCoveredBy checks it (same grid, same floor): an unnamed ring
       has no identity to lose, so once the university's massing covers
       half its interior, rendering it only z-fights the real building.
       osm:359 — an unnamed re-trace of Mesa Apartments Central 9236 at
       0.52 coverage, 8.4 guess over the 6.1 record — fell to the same
       floor. */
    const gisRings = ARCGIS.massing.map((m) => m.r[0].map(([x, z]) => [x / 10, z / 10]));
    const boxes = gisRings.map((r) => {
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const [x, z] of r) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (z < z0) z0 = z; if (z > z1) z1 = z;
      }
      return [x0, x1, z0, z1];
    });
    const offenders = [];
    for (const m of MASSES) {
      if (m.src !== "osm" || m.name) continue;
      const ring = m.rings[0];
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const [x, z] of ring) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (z < z0) z0 = z; if (z > z1) z1 = z;
      }
      const near = gisRings.filter((_, i) =>
        boxes[i][0] <= x1 && boxes[i][1] >= x0 && boxes[i][2] <= z1 && boxes[i][3] >= z0);
      if (!near.length) continue;
      const step = Math.max(2, Math.min((x1 - x0) / 24, (z1 - z0) / 24));
      let interior = 0, covered = 0;
      for (let x = x0 + step / 2; x < x1; x += step) {
        for (let z = z0 + step / 2; z < z1; z += step) {
          if (!inRing([x, z], ring)) continue;
          interior++;
          if (near.some((r) => inRing([x, z], r))) covered++;
        }
      }
      if (interior >= 20 && covered / interior >= 0.5) {
        const [cx, cz] = centroidOf(ring);
        offenders.push(`(${cx.toFixed(0)},${cz.toFixed(0)}) ${(covered / interior).toFixed(2)}`);
      }
    }
    assert.deepEqual(offenders, [], `unnamed rings rendering through massing: ${offenders}`);
  });

  test("the rejected candidates stay rejected — the Potiker naming stands", () => {
    /* The GIS record calls both theatre-complex masses "Joan and Irwin
       Jacobs Center for La Jolla Playhouse"; OSM outlines the Potiker
       Theatre across them, so the host rename hands both the OSM name.
       Both are right — the Jacobs Center is the facility, the Potiker
       the venue inside it — and OSM is this project's name authority.
       Each mass still measures its OWN roof (13.5 the fly tower's
       plane, 9.4 the house's), which is the part that must never
       regress into one pasted number. */
    const potiker = MASSES.filter((m) => m.name === "Sheila and Hughes Potiker Theatre");
    assert.equal(potiker.length, 2, `the Potiker complex renders ${potiker.length} masses`);
    assert.deepEqual(potiker.map((m) => m.h).sort((a, b) => a - b), [9.4, 13.5],
      "each mass wears its own measured plane");
  });
});

describe("16. the r2c0 judge pass (2026-08-05)", () => {
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

  test("the survey-box stragglers ship their full-ring planes, and Ritter sheds the false newer flag", () => {
    /* AREA's south edge cuts the Scripps campus at z≈1382, so three
       pre-2014 SIO buildings measured a TRUNCATED footprint — the
       Qualcomm AA failure. Ritter Hall's in-box 12.5 sat 8.8 m under
       the university's 21.3 m record and tripped the newer heuristic:
       a 1931/1959 building rendered at a record height its own 2014
       roof contradicts. The full-ring re-samples: Ritter 14.6 (5,798
       returns), Vaughan 14.9 (13,623), Hillgarth 6.2 (1,884 — the
       5-7 m tail is pitched-pavilion ridges capping at 7.4, not
       crowns). */
    assert.equal(LIDAR.heights["Ritter Hall"], 14.6, "Ritter's audited full-ring plane");
    assert.equal(LIDAR.heights["Vaughan Hall"], 14.9, "Vaughan's audited full-ring plane");
    assert.equal(LIDAR.heights["Nigella Hillgarth Education Center"], 6.2, "Hillgarth's ridges");
    assert.equal(ARCGIS.buildings["Ritter Hall"]?.newer, undefined,
      "the clipped measurement is firing the newer heuristic again");
    assert.equal(tallest("Ritter Hall"), 14.6, `Ritter renders ${tallest("Ritter Hall")}`);
    assert.equal(tallest("Vaughan Hall"), 14.9, `Vaughan renders ${tallest("Vaughan Hall")}`);
  });

  test("the Hubbs conference annex stops wearing the hall's record", () => {
    /* "Hubbs Hall Confrence Center" (sic) startsWith-matched the "Hubbs
       Hall" record in the storeys map and wore the four-storey 17.1 —
       while its own returns (23% a tight 3-4 m band, the rest a 5-19 m
       smear off Hubbs Hall's block and the palms between) pushed roofOf
       to 17.9. Two fixes, both pinned: the exact-claim pass keeps the
       record with the hall, and the audit ships the dense band's p50. */
    assert.equal(LIDAR.heights["Hubbs Hall Confrence Center"], 4.0, "the audited roof");
    assert.equal(ARCGIS.buildings["Hubbs Hall Confrence Center"], undefined,
      "the annex fuzzy-matched its neighbour's record again");
    assert.ok(ARCGIS.buildings["Hubbs Hall"], "the hall keeps its own record");
    assert.equal(tallest("Hubbs Hall Confrence Center"), 4.0,
      `the annex renders ${tallest("Hubbs Hall Confrence Center")}`);
  });

  test("the T-cottages wear their roofs and the grove-wide GIS rings ship no plane", () => {
    /* The 1913-24 Scripps cottages measure clean on their own rings
       (T-25: 4.8 off 157 returns; T-30: the dense band's p98 5.0 — its
       raw p98 6.8 rides 27 crown returns), but the "T-25/T-30 Cottage"
       GIS rings are drawn wide into the eucalyptus and shipped mass
       planes of 9 and 10.7 — pure canopy wearing a roof's key. The
       audits pin the roofs and bar the masses. */
    assert.equal(LIDAR.heights["T-25"], 4.8);
    assert.equal(LIDAR.heights["T-30"], 5.0);
    assert.equal(LIDAR.massHeights["m:-1072,976"], undefined, "the T-25 Cottage canopy plane is back");
    assert.equal(LIDAR.massHeights["m:-1097,965"], undefined, "the T-30 Cottage canopy plane is back");
    assert.equal(tallest("T-25"), 4.8, `T-25 renders ${tallest("T-25")}`);
    assert.equal(tallest("T-30"), 5.0, `T-30 renders ${tallest("T-30")}`);
    /* The untouched sibling: T-31's own mass ring measures a clean 5.0
       (its OSM-ring read is 4.1 — the mass's plane wins per-mass), so it
       needed no audit and must not silently inherit one. */
    assert.equal(tallest("T-31"), 5.0, "the untouched sibling's own mass plane");
    assert.equal(LIDAR.heights["T-31"], 4.1, "T-31's OSM-ring read");
  });

  test("Coastal Studies and MCF render their post-renovation records, once each", () => {
    /* Both buildings' 2014 roofs no longer exist — Coastal's upper floor
       was rebuilt 2019-20, MCF's whole roofline in the 2021-23
       conversion — so no 2014 number may ship for either (the flight
       read Coastal's PRE-renovation 3-4 m band, and MCF's returns mix
       the old lab with pine canopy). The university's current records
       render instead: 12.8 and 17.1. */
    assert.equal(LIDAR.heights["Center for Coastal Studies"], undefined);
    assert.equal(LIDAR.heights["Marine Conservation Facility"], undefined);
    assert.equal(LIDAR.massHeights["m:-1194,1291"], undefined,
      "the pre-renovation Coastal plane shipped on the mass");
    const coastal = MASSES.filter((m) => m.name === "Center for Coastal Studies");
    assert.equal(coastal.length, 1, `Coastal renders ${coastal.length} times`);
    assert.equal(coastal[0].h, 12.8, `Coastal ships ${coastal[0].h} — the 2014 predecessor again?`);
    const mcf = MASSES.filter((m) => m.name === "Marine Conservation Facility");
    assert.equal(mcf.length, 1, `MCF renders ${mcf.length} times`);
    assert.equal(mcf[0].h, 17.1, `MCF ships ${mcf[0].h} — the canopy smear again?`);
  });

  test("the NOAA outline measures minus its contained core", () => {
    /* OSM traces the full fisheries complex; the university's ring is
       the tall centre block alone (98% inside the outline). Measured
       whole, the outline's p98 landed ON the core, extruding the low
       wings a metre above the core's own plane. Minus the contained
       mass the wings read 13.5 (12,697 returns) and the core keeps its
       13.8. */
    assert.equal(LIDAR.heights["NOAA - Southwest Fisheries Science Center Laboratory"], 13.5,
      "the wings' own plane, minus the core");
    assert.equal(LIDAR.massHeights["m:-908,838"], 13.8, "the core's own plane");
  });

  test("the Spiess Hall record answers to its measured roof through the rename", () => {
    /* OSM drops the honorific from "Fred N. Spiess Hall" and the mass
       centroid misses the offset OSM ring, so the 17.1 m record stood
       unchallenged over a 14.3 m measured plane. The rename gives the
       mass its OSM name; measurement does the rest. */
    assert.equal(LIDAR.massHeights["m:-918,990"], 14.3, "Spiess's measured plane");
    const spiess = MASSES.filter((m) => m.name === "Spiess Hall");
    assert.equal(spiess.length, 1, `Spiess renders ${spiess.length} times`);
    assert.equal(spiess[0].src, "gis", "the mass wears the OSM name");
    assert.equal(spiess[0].h, 14.3, `Spiess ships ${spiess[0].h}`);
  });

  test("the Birch Aquarium union splits — Hillgarth is its own building again", () => {
    /* The record ring wraps the aquarium AND the Hillgarth Center (97%
       of Hillgarth's ring inside it), so Hillgarth suppressed under the
       union and the complex extruded at one guarded 6.5. The OSM
       division renders: Birch at its own guarded 7.2 (the 10-12 m
       gallery hall is a stepped 24% no single plane can carry — logged,
       not invented), Hillgarth at its audited 6.2, and the Splash Cafe
       record ring keeps measuring itself. */
    assert.equal(MASSES.filter((m) => m.src === "gis" && m.name === "Birch Aquarium").length,
      0, "the union outline is back");
    const birch = MASSES.filter((m) => m.name === "Birch Aquarium");
    assert.equal(birch.length, 1, `Birch renders ${birch.length} times`);
    assert.equal(birch[0].src, "osm", "Birch renders from its own OSM footprint");
    assert.equal(birch[0].h, 7.2, `Birch ships ${birch[0].h}`);
    const hillgarth = MASSES.filter((m) => m.name === "Nigella Hillgarth Education Center");
    assert.equal(hillgarth.length, 1, `Hillgarth renders ${hillgarth.length} times`);
    assert.equal(hillgarth[0].h, 6.2, `Hillgarth ships ${hillgarth[0].h}`);
    assert.equal(LIDAR.massHeights["m:-833,1350"], 2.9, "Splash keeps its own plane");
  });

  test("the verified SIO-shore and Shores-edge rings ship their planes", () => {
    /* Each re-sampled full-depth and standing unchanged on today's
       Apple. 403 is the round seawater tank on the beach below the
       pier bluff — half its returns are the access deck, half one
       tight 9-10 m plane; the guess was 4.5. 1145 pokes past AREA's
       south edge, so the shipped 2.5 is the in-box read of its single
       95%-dense band (the full ring's 3.1 rides the band's upper
       tail). */
    for (const [i, h, x, z] of [
      [403, 9.9, -1015.6, 630.9], [1036, 6.2, -895.1, 594.0],
      [1048, 3.1, -770.9, 694.9], [1053, 4.8, -714.3, 595.9],
      [1073, 3.7, -475.7, 607.4], [1141, 5.3, -389.5, 1308.2],
      [1145, 2.5, -372.9, 1394.3],
    ]) {
      assert.equal(LIDAR.osmHeights?.[i], h, `osm:${i}'s plane`);
      assert.equal(rendersNear(x, z, 4).find((m) => m.src === "osm")?.h, h,
        `osm:${i} renders at its plane`);
    }
  });

  test("the withheld rings stay withheld and the Eighth pavilion keeps its guess", () => {
    /* 1345: the courtyard pavilion between the Eighth College blocks —
       built 2023; the flight read 549 returns, ALL below grade. Its
       POST_2014_OSM_RINGS entry means no 2014 number may ever ship;
       the stated 4.5 guess stands, which a one-storey pavilion
       supports (Apple z20, 2026-08-05).
       1033: the bluff-rim terrace NW of NOAA — not one return rises a
       metre above the rim grade; an extrusion cannot say a cliff-face
       compound honestly, so the guess stands and the gap is logged.
       1068: 73% eucalyptus over a one-storey band; the laser cannot
       see the roof.
       216: an unnamed re-trace 75% covered by the "9369 Discovery Way"
       mass — the r2c1 coverage floor suppresses it at render. */
    for (const i of [1345, 1033, 1068, 216]) {
      assert.equal(LIDAR.osmHeights?.[i], undefined, `a 2014 number shipped for osm:${i}`);
    }
    assert.equal(rendersNear(-178.0, 585.6, 4).find((m) => m.src === "osm")?.h, 4.5,
      "the Eighth pavilion keeps its declared guess");
    assert.equal(rendersNear(-573.3, 797.5, 4).filter((m) => m.src === "osm").length, 0,
      "osm:216 renders through the massing that is the building");
  });
});

describe("17. the r2c2 judge pass (2026-08-05)", () => {
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

  test("the Hyatt stops pasting its tower onto the podium", () => {
    /* One OSM ring wraps the hotel tower AND the low podium / circular
       terracotta pavilion. 11,029 returns are bimodal — 49% in a dense
       4 m podium band, the rest a tower plane at 41-52 m — so roofOf's
       p75 landed ON the tower and shipped 45.1 across the whole 92×96 m
       footprint. Neither single extrusion is honest (no OSM parts);
       the audit emits nothing and the OSM tag of 16 stands as a stated
       guess until a parts-level source exists. */
    assert.equal(LIDAR.heights["Hyatt Regency La Jolla at Aventine"], undefined,
      "the tower paste is back on the Hyatt");
    const hyatt = MASSES.filter((m) => m.name === "Hyatt Regency La Jolla at Aventine");
    assert.equal(hyatt.length, 1, `Hyatt renders ${hyatt.length} times`);
    assert.equal(hyatt[0].h, 16, `Hyatt ships ${hyatt[0].h} — the 45 m paste again?`);
  });

  test("the verified east-of-I-5 rings ship their planes", () => {
    /* Each re-sampled full-depth and standing unchanged on today's
       Apple; every ring read as one plane. Numbers are the build's own
       tiling (targeted re-sample agreed within 0.1 m). */
    for (const [i, h, x, z] of [
      [95, 30.9, 1185.8, 1121.1], [198, 8.1, 898.1, 1399.3],
      [337, 3.5, 1187.7, 1183.1], [288, 4.6, 885.6, 793.7],
      [305, 9.6, 1481.2, 1006.9], [51, 16.9, 1273.4, 907.5],
      [62, 16.2, 1245.0, 965.4],
    ]) {
      assert.equal(LIDAR.osmHeights?.[i], h, `osm:${i}'s plane`);
      assert.equal(rendersNear(x, z, 4).find((m) => m.src === "osm")?.h, h,
        `osm:${i} renders at its plane`);
    }
  });

  test("the post-2014 trolley-corridor garage keeps its declared guess", () => {
    /* osm:785: today's Apple shows a finished multi-deck garage with
       cars on the top deck beside the Blue Line / I-5; the 2014 returns
       read one near-grade plane (p50 0.8 to p75 1.2) — a surface lot or
       low deck, not the structure standing today. The VA garage
       precedent: no 2014 number may ship. */
    assert.equal(LIDAR.osmHeights?.[785], undefined, "a 2014 number shipped for osm:785");
    assert.equal(rendersNear(961.6, 1320.4, 4).find((m) => m.src === "osm")?.h, 16,
      "the garage keeps its declared guess");
  });

  test("the stepped and canopy-mixed withholds stay withheld", () => {
    /* 83: helipad tower + lower wing in one ring (dense band 31 m,
       tower 52-63) — no single plane.
       497: Aventine wing stepped 14 m / 18 m — body not tight.
       289: Belmont-adjacent under canopy; body near 12-13 already
       matches the guess, roofOf rides crowns to 68.
       Temple and Belmont's named rings keep their existing answers
       (21.6 upper-terrace paste logged as unfixable without parts;
       9.1 is the short wing's own correct plane). */
    for (const i of [83, 497, 289]) {
      assert.equal(LIDAR.osmHeights?.[i], undefined, `a 2014 number shipped for osm:${i}`);
    }
    assert.equal(rendersNear(1305.1, 786.8, 4).find((m) => m.src === "osm")?.h, 16,
      "the helipad composite keeps its declared guess");
    assert.equal(rendersNear(1411.4, 776.8, 4).find((m) => m.src === "osm")?.h, 9,
      "the stepped Aventine wing keeps its declared guess");
    assert.equal(LIDAR.heights["San Diego California Temple"], 21.6,
      "the Temple's existing plane must not silently change");
    assert.equal(LIDAR.heights["Belmont Village Senior Living"], 9.1,
      "Belmont's short-wing plane must not silently change");
  });
});

describe("campus epoch — r0c0 re-sweep (2026-08-05)", () => {
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

  test("the verified NW unnamed rings ship their planes", () => {
    /* Each re-sampled full-depth and standing unchanged on today's
       Apple; every ring read as one plane. Numbers are the build's own
       tiling (targeted re-sample agreed within 0.1 m — 974's probe
       read 3.8, tiling 3.7). */
    for (const [i, h, x, z] of [
      [331, 5.3, -394.4, -652.7], [149, 5.6, -582.6, -1098.0],
      [974, 3.7, -453.8, -668.8], [1372, 7.3, -840.9, -763.5],
      [878, 5.9, -284.2, -942.4], [483, 8.3, -948.6, -639.1],
    ]) {
      assert.equal(LIDAR.osmHeights?.[i], h, `osm:${i}'s plane`);
      assert.equal(rendersNear(x, z, 4).find((m) => m.src === "osm")?.h, h,
        `osm:${i} renders at its plane`);
    }
  });

  test("the contaminated coastal pad keeps its declared guess", () => {
    /* osm:513: Apple shows a finished low pad in the coastal-scrub fringe,
       but the 2014 returns mix near-ground / deck (p50 0.2, hist peaks at
       0 m and 3 m; bodyTight=false). No clean body plane; the 9 m guess
       stands. */
    assert.equal(LIDAR.osmHeights?.[513], undefined, "a 2014 number shipped for osm:513");
    assert.equal(rendersNear(-768.4, -877.3, 4).find((m) => m.src === "osm")?.h, 9,
      "the contaminated pad keeps its declared guess");
  });

  test("Marshall Residence Hall V ships its guarded 6.8 m plane", () => {
    /* Hostless L3 record (9.1) stood unchallenged — no OSM way carries the
       letter-name. PRE_2014_GIS_VERIFIED lets the 1960s Marshall housing
       answer the epoch question: 3,317 returns, mode 6 m at 74%, guarded
       p75 6.8. Sibling U stays stepped/withheld; T already matched at 6.1. */
    assert.equal(LIDAR.massHeights["m:-183,-549"], 6.8);
    assert.equal(LIDAR.massHeights["m:-202,-554"], undefined,
      "U's stepped returns must not ship a plane");
    const v = MASSES.find((m) => m.name === "Marshall Residence Hall V" && m.src === "gis");
    assert.ok(v, "Marshall Residence Hall V vanished");
    assert.equal(v.h, 6.8, `Marshall Res V ships ${v.h}`);
  });

  test("Sanford's lab bar keeps 24.5 and the pavilion keeps 6.2", () => {
    /* Re-sweep candidate sanford-mechanical-overheight rejected: the
       dense 19 m deck and the 22–24 m mechanical well are both real
       (Apple shows the deep central plant). Without a parts split,
       roofOf's p98 of 24.5 is the standing pipeline answer — trading it
       for the deck would paste the other way. Prior §9 pin stands. */
    assert.equal(LIDAR.massHeights["m:-267,-1272"], 24.5);
    assert.equal(LIDAR.massHeights["m:-232,-1258"], 6.2);
    assert.equal(LIDAR.heights["Sanford Consortium for Regenerative Medicine"], 24.5);
    const sanford = MASSES.filter((m) => m.name === "Sanford Consortium for Regenerative Medicine" && m.src === "gis")
      .map((m) => m.h).sort((a, b) => a - b);
    assert.deepEqual(sanford, [6.2, 24.5], `Sanford ships ${sanford}`);
  });
});

describe("campus epoch — r0c1 re-sweep (2026-08-05)", () => {
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

  test("Asante House Meeting Rooms sheds its thin 7.1 m shelf", () => {
    /* 1,854 returns, 88% in a 3–4 m band matching the L1 record (4.3);
       p98 7.1 rides 43 points in the 7 m bin — gap 3.1 under the canopy
       guard's 5 m threshold. The thin-shelf massHeights rule (body tight,
       gap > 2, dense 2 m band ≥85%) takes p75 = 4.0. Apple shows the
       finished low pad among the Asante / Great Hall cluster today. */
    assert.equal(LIDAR.massHeights["m:-85,-666"], 4.0);
    const meet = rendersNear(-84.6, -666.0, 3).find((m) => m.src === "gis");
    assert.ok(meet, "Asante meeting-rooms mass vanished");
    assert.equal(meet.h, 4.0, `meeting rooms ship ${meet.h}`);
  });

  test("Marshall Upper H and L keep the GIS body, not the canopy p98", () => {
    /* Eucalyptus tails: H roofOf 10.3 / L 10.2 over dense 6.0–6.1 bodies
       that already match the L2 record. Neither ships a massHeights entry
       today; the thin-shelf rule would take p75 if one were ever admitted.
       Pin the rendered bodies so a future auto-admit cannot paste the tree. */
    assert.equal(LIDAR.massHeights["m:27,-566"], undefined,
      "Marshall Upper H must not auto-admit canopy");
    assert.equal(LIDAR.massHeights["m:-70,-589"], undefined,
      "Marshall Upper L must not auto-admit canopy");
    const h = MASSES.find((m) => m.name === "Marshall Upper Apartments H" && m.src === "gis");
    const l = MASSES.find((m) => m.name === "Marshall Upper Apartments L" && m.src === "gis");
    assert.equal(h?.h, 6.1, `Marshall Upper H ships ${h?.h}`);
    assert.equal(l?.h, 6.1, `Marshall Upper L ships ${l?.h}`);
  });

  test("the 2015 Spanos APC stays one storey; LiDAR eucalyptus stays out", () => {
    /* Screen claimed a multi-storey finished building needing ESTIMATED_POST_2014.
       TCA project profile (tilt-up.org #6097): Number of Floors 1, tallest
       panel 24 ft 6 in, 6,740 sq ft — a high-bay one-storey. The 11–16 m
       2014 smear remains the eucalyptus cleared for it. Do not re-admit. */
    assert.equal(LIDAR.heights["Spanos Athletic Performance Center"], 4.4);
    assert.equal(LIDAR.massHeights["m:61,-1355"], undefined,
      "APC must not ship the 2014 eucalyptus plane");
    const apc = MASSES.find((m) => m.name === "Spanos Athletic Performance Center" && m.src === "gis");
    assert.ok(apc, "Spanos APC vanished");
    assert.ok(apc.h <= 4.4, `Spanos APC renders ${apc.h}`);
  });

  test("Otterson and Copley keep their roofOf upper volumes", () => {
    /* Otterson: 71% on a 15 m deck, ~21% on a 17–18 m plant/solar shelf —
       dense band only 74%, under the 85% thin-shelf cut. Copley: stepped
       conference volume, dense band 79%. Both stay on roofOf; Sanford-class
       (real upper volume, not a 2% tail). */
    assert.equal(LIDAR.massHeights["m:7,-940"], 18.9);
    assert.equal(LIDAR.massHeights["m:-13,-774"], 10.6);
    const otter = rendersNear(6.9, -939.9, 3).find((m) => m.src === "gis");
    const copley = rendersNear(-13.3, -773.8, 3).find((m) => m.src === "gis");
    assert.equal(otter?.h, 18.9, `Otterson ships ${otter?.h}`);
    assert.equal(copley?.h, 10.6, `Copley ships ${copley?.h}`);
  });
});

describe("campus epoch — r0c2 re-sweep (2026-08-05)", () => {
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

  test("CSC Building H sheds its thin 7.0 m shelf", () => {
    /* 743 returns, 92% in a 4–5 m band (GIS L1 = 4.3); p98 7.0 rides 34
       points in the 7 m bin — gap 2.2, under the original 2.5 cut by
       0.3 m. Thin-shelf rule now uses gap > 2 (half a storey) and takes
       p75 = 4.8. Apple shows the finished low CSC shop pad today. */
    assert.equal(LIDAR.massHeights["m:1092,-609"], 4.8);
    const h = rendersNear(1091.8, -608.9, 3).find((m) => m.src === "gis");
    assert.ok(h, "CSC Building H vanished");
    assert.equal(h.h, 4.8, `CSC Building H ships ${h.h}`);
  });

  test("Transit Operations Trailer keeps its mild p98 tail", () => {
    /* 850 returns, 98% in the 4 m bin, gap only 0.9 — under every
       thin-shelf cut. The +0.9 m p98 is noise, not a shelf; roofOf 5.2
       stands. Do not "fix" it down to the GIS 4.3. */
    assert.equal(LIDAR.massHeights["m:1083,-717"], 5.2);
    const t = MASSES.find((m) => m.name === "Transit Operations Trailer" && m.src === "gis");
    assert.ok(t, "Transit Trailer vanished");
    assert.equal(t.h, 5.2, `Transit Trailer ships ${t.h}`);
  });

  test("post-2014 hospital pads keep their guesses — epoch still bars LiDAR", () => {
    /* Anderson (835, opened 2016) and Prebys north (772) were bare /
       staging in 2014; 508 is a canopy the flight saw as bare ground.
       No Street-View floor count or GIS mass resolves a finished height,
       so the OSM guesses stand — VA-garage keep-guess family. */
    for (const bi of ["772", "835", "508"]) {
      assert.equal(LIDAR.osmHeights?.[bi], undefined, `osmHeights[${bi}] leaked`);
    }
    const anderson = rendersNear(1584.8, -850.0).find((m) => m.src === "osm");
    const prebysN = rendersNear(1605.3, -581.9).find((m) => m.src === "osm");
    const canopy = rendersNear(1621.1, -680.8).find((m) => m.src === "osm");
    assert.equal(anderson?.h, 16, `Anderson ships ${anderson?.h}`);
    assert.equal(prebysN?.h, 19.2, `Prebys north ships ${prebysN?.h}`);
    assert.equal(canopy?.h, 4.5, `canopy 508 ships ${canopy?.h}`);
  });

  test("main Scripps complex still has no single plane to admit", () => {
    /* Reconfirm §11: stepped 1960s–2000s chain, roofOf would flatten
       towers to 9.5 — worse than the documented 20 m guess. */
    assert.equal(LIDAR.osmHeights?.["503"], undefined);
    const m = rendersNear(1486.1, -786.5).find((x) => x.src === "osm");
    assert.ok(m, "Scripps main vanished");
    assert.equal(m.h, 20, `Scripps main ships ${m.h}`);
  });

  test("Qualcomm AA still ships its audited roof; terrain apron is a handoff", () => {
    /* Height itself is correct (24.3). Most footprint vertices sit south
       of terrain z0=−1383 and clamp to the apron — a survey-box coverage
       hole, not a height bug. Pin the height so a terrain pass cannot
       silently drop the HAND_AUDITED plane while "fixing" planting. */
    assert.equal(LIDAR.heights["Qualcomm AA"], 24.3);
    const qaa = CAMPUS.buildings.find((b) => b.n === "Qualcomm AA");
    assert.ok(qaa, "Qualcomm AA left the dataset");
    const m = rendersNear(1712.0, -1408.4).find((x) => x.src === "osm");
    assert.equal(m?.h, 24.3, `QAA ships ${m?.h}`);
  });
});

describe("campus epoch — r1c0 re-sweep (2026-08-05)", () => {
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

  test("Tenaya Hall sheds the mechanical HAND_AUDITED paste for its L7 body", () => {
    /* 8,157 OSM / 6,457 GIS returns: dense 22 m body (49–66%), p98 27.5
       rides the rooftop HVAC shelf (9–14% of returns). Canopy guard already
       prefers p75 = 22.4; the 2026-08-03 HAND_AUDITED 27.6 overrode it.
       Apple: flat H-plan roof with mechanical plant, not a taller wing.
       GIS L7 = 21.3 agrees with the dense body. */
    assert.equal(LIDAR.heights["Tenaya Hall"], 22.4);
    const m = rendersNear(-169.8, -156.4).find((x) => x.src === "gis");
    assert.ok(m, "Tenaya Hall GIS mass vanished");
    assert.equal(m.h, 22.4, `Tenaya ships ${m.h}`);
  });

  test("three LJF thin-shelf rings ship their dense bodies, not crown p98", () => {
    /* First decide pass required planeTight (p98−p75≤2) and withheld these;
       the later thin-shelf host rule (bodyTight + gap >2 + dense ≥85% → p75)
       admits them. Admitting under plain roofOf would still ship the crown
       (6.8 / 7.0 / 7.6) — the class hole this pass closes. */
    for (const [i, h, x, z] of [
      [903, 2.8, -300.4, 170.4],
      [1028, 3.2, -419.4, 452.8],
      [1094, 3.4, -333.4, 475.5],
    ]) {
      assert.equal(LIDAR.osmHeights?.[i], h, `osm:${i}'s thin-shelf plane`);
      assert.equal(rendersNear(x, z, 4).find((m) => m.src === "osm")?.h, h,
        `osm:${i} renders at its plane`);
    }
  });

  test("Geisel House pavilion ships its tight 6.2 m plane", () => {
    /* Prior §12 withhold said Apple saw no structure under chaparral.
       Apple z20 shows a square pyramid-roof pavilion beside the pond on
       the Geisel grounds; 542 returns, gap 0.5, roofOf 6.2. */
    assert.equal(LIDAR.osmHeights?.[481], 6.2);
    assert.equal(rendersNear(-843.0, -198.9, 4).find((m) => m.src === "osm")?.h, 6.2,
      "pavilion renders at its plane");
  });

  test("near-miss thin-shelf and multiplane LJF rings keep their guesses", () => {
    /* 996: dense 84% — 1 point under the 85% cut; same family, not admitted.
       480: multimodal estate on 7.3 m of grade — no single plane (Scripps /
       Hyatt class). Guess stands until parts exist. */
    assert.equal(LIDAR.osmHeights?.[996], undefined, "996 near-miss must not ship");
    assert.equal(LIDAR.osmHeights?.[480], undefined, "480 multiplane must not ship");
    assert.equal(rendersNear(-711.4, -348.8, 4).find((m) => m.src === "osm")?.h, 9);
    assert.equal(rendersNear(-808.1, -131.8, 4).find((m) => m.src === "osm")?.h, 12);
  });

  test("Tuolumne S House North/East keep their roofOf upper shelves", () => {
    /* Dense mid-deck under a thin plant shelf, but dense band only 81% —
       under the 85% cut (Otterson / Copley family). Ships roofOf 15.6 /
       16.2; do not paste the dense body the other way. */
    assert.equal(LIDAR.massHeights["m:-192,-71"], 15.6);
    assert.equal(LIDAR.massHeights["m:-198,-51"], 16.2);
    const n = rendersNear(-192.4, -71.3).find((m) => m.src === "gis");
    const e = rendersNear(-197.6, -51.2).find((m) => m.src === "gis");
    assert.equal(n?.h, 15.6, `S House North ships ${n?.h}`);
    assert.equal(e?.h, 16.2, `S House East ships ${e?.h}`);
  });
});

describe("campus epoch — r1c1 re-sweep (2026-08-05)", () => {
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

  test("third demolished pad and Epstein/Mayer phantoms render nothing", () => {
    /* Same skipOsmAnchors class as §13's (545.3, 48.3) / (374.4, -88.3):
       (404.0, -65.6) — osm:759, Apple bare dirt + staging trailers; 2014's
       tight 6–7 m plane is a building that is gone.
       (734.5, -100.4) — osm:840 (+898 within 12 m) over the Epstein
       amphitheater / PCW plaza fringe. Epstein is POST_2014; 2014 returns
       are grove/scatter (massOk=false). A 9 m guess invents a hall on a bowl.
       (87.6, 265.4) — osm:917 (+918 within 12 m), Mayer's six-hexagon
       elevated connector. Solid extrusion fills the air under the deck. */
    for (const [x, z, label] of [
      [404.0, -65.6, "Chancellor dig pad"],
      [734.5, -100.4, "Epstein fringe"],
      [738.8, -103.2, "Epstein fringe sibling"],
      [87.6, 265.4, "Mayer hex connector"],
      [87.2, 264.3, "Mayer hex sibling"],
    ]) {
      const there = rendersNear(x, z, 10);
      assert.equal(there.length, 0,
        `${label} still renders at (${x},${z}): ${there.map((m) => `${m.name ?? "unnamed"}@${m.h}`)}`);
    }
  });

  test("Central Utilities cooling bays ship their measured planes", () => {
    /* Sibling of the TES tank (224 → 27.0). Unnamed industrial enclosures
       with one clean 2014 plane each, standing on today's Apple:
       225: 3,208 pts, p50=p75=6.7, roofOf 8.1 (was 9 m area guess)
       226: 1,193 pts, p50 6.6 / p75 6.9, roofOf 8.4 (was 4.5 m guess) */
    assert.equal(LIDAR.osmHeights?.[225], 8.1, "north cooling bay plane");
    assert.equal(LIDAR.osmHeights?.[226], 8.4, "south cooling bay plane");
    assert.equal(rendersNear(160.9, 500.1, 4).find((m) => m.src === "osm")?.h, 8.1);
    assert.equal(rendersNear(161.0, 454.4, 4).find((m) => m.src === "osm")?.h, 8.4);
  });

  test("thin-shelf near-misses and stepped science halls keep their roofOf shelves", () => {
    /* McGill 82.2% / Literature 84.4% / MedTeach-A 83.4% — under the 85%
       dense cut (same family as osm:996). Pacific 68.7% / NatSci 66% /
       BRF II 54.6% — real upper volumes, Sanford / Otterson class. Do not
       paste the dense body the other way, and do not lower the cut. */
    assert.equal(LIDAR.massHeights["m:-80,-115"], 25.1, "McGill keeps roofOf");
    assert.equal(LIDAR.massHeights["m:693,-283"], 19.2, "Literature keeps roofOf");
    assert.equal(LIDAR.massHeights["m:536,218"], 19.7, "MedTeach-A keeps roofOf");
    assert.equal(LIDAR.massHeights["m:-92,234"], 33.2, "Pacific keeps roofOf");
    assert.equal(LIDAR.massHeights["m:-156,308"], 30.3, "NatSci keeps roofOf");
    assert.equal(LIDAR.massHeights["m:575,416"], 31.8, "BRF II keeps roofOf");
  });

  test("Gilman ships its deck; South Parking keeps the Urey host paste", () => {
    /* Gilman massHeights 18 tracks the measured top deck against a GIS
       L6=25.6 overstatement — already correct. South Parking is massOk=
       false (deck stack), so massHeights withholds and the host 19.2
       answers (Urey / Jacobs rule). Do not invent a single plane. */
    assert.equal(LIDAR.massHeights["m:692,45"], 18);
    assert.equal(LIDAR.massHeights["m:385,435"], undefined, "South Park massOk=false");
    assert.equal(LIDAR.heights["South Parking Structure"], 19.2);
    assert.equal(rendersNear(691.6, 44.7).find((m) => m.src === "gis")?.h, 18);
    assert.equal(rendersNear(385.1, 434.9).find((m) => m.src === "gis")?.h, 19.2);
  });

  test("Faculty Club keeps its gable HAND_AUDITED; Tata stays on its GIS record", () => {
    /* Faculty Club: HAND_AUDITED 6.5 is the gable ridge (p90); canopy
       guard's p75 / dense eave would miss it — Solis is the opposite
       failure mode. Tata is POST_2014_SITES; courtyard-contaminated
       2014 returns must never challenge the university's 25.6 record. */
    assert.equal(LIDAR.heights["Ida and Cecil Green Faculty Club"], 6.5);
    assert.equal(rendersNear(159.3, -127.8).find((m) => m.src === "gis")?.h, 6.5);
    assert.equal(LIDAR.massHeights["m:-55,171"], undefined, "Tata must not ship a 2014 plane");
    assert.equal(rendersNear(-55.4, 171.0).find((m) => /Tata/i.test(m.name || ""))?.h, 25.6);
  });

  test("Strauss-edge and trolley rings keep their guesses; VAF-3 double stays open", () => {
    /* 1352: massOk=false on the Strauss / University Center fringe —
       keep the 9 m guess (VA-garage family), do not admit a 2014 smear.
       827: 109 m² trolley-adjacent ring, bodyTight=false; Mid-Coast
       opened 2021 — keep 4.5. VAF-3: GIS at (660.9,−83.9) and OSM at
       (679.3,−86.1) still both render — coverage 0, prior §13 open. */
    assert.equal(LIDAR.osmHeights?.[1352], undefined);
    assert.equal(LIDAR.osmHeights?.[827], undefined);
    assert.equal(rendersNear(510.6, -2.5, 4).find((m) => m.src === "osm")?.h, 9);
    assert.equal(rendersNear(870.6, -87.7, 4).find((m) => m.src === "osm")?.h, 4.5);
    const vafGis = rendersNear(660.9, -83.9).find((m) => m.src === "gis");
    const vafOsm = rendersNear(679.3, -86.1).find((m) => m.src === "osm");
    assert.ok(vafGis, "VAF-3 GIS mass vanished");
    assert.ok(vafOsm, "VAF-3 OSM ring vanished — do not resolve the position without a source");
  });
});
