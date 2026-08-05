#!/usr/bin/env node
// Build docs/data/campus-lidar.json — measured campus geometry from aerial LiDAR.
//
// WHY THIS EXISTS. campus-3d.json gets footprint OUTLINES from OpenStreetMap,
// and OSM is genuinely good at those. It is not good at anything in the third
// dimension. Of the ~320 buildings in that file, 38 carried a height tag; the
// rest fell to a guess based on footprint area, and the tagged ones were not
// reliably right either. Checked against LiDAR afterwards, the guesses were off
// by more than half in both directions:
//
//   Mandeville Center   guessed 15 m    measured 25.2 m
//   McGill Hall         guessed 12 m    measured 25.5 m
//   Student Center      guessed 12 m    measured 23.3 m
//   Argo Hall           OSM says 22.8 m measured 18.3 m
//   Revelle Commons     guessed 10 m    measured  7.5 m
//
// Argo and Blake are the two buildings you stand between at the start of the
// walk this whole thing exists to show, and both were wrong. A campus you have
// to hand-correct one building at a time is not accurate, it is decorated. So
// the heights are measured instead.
//
// THE SOURCE. USGS 3DEP, dataset CA_SanDiegoQL2_2014, served as a public
// Entwine Point Tile octree from s3://usgs-lidar-public. No key, no account,
// ~2.6 million points over this corridor. Points arrive in EPSG:3857 with a
// classification byte per return.
//
// A CAVEAT WORTH KNOWING. This is a coastal survey. It classifies GROUND
// (class 2) properly and then puts everything else — buildings, trees, lamp
// posts — in "unassigned" (class 1). There is no class 6. So nothing here can
// ask the data "is this a building?"; it asks "is this point above ground, and
// does it stand inside a footprint OSM already drew?" instead. That division of
// labour is the whole design: OSM says where the walls are, LiDAR says how high
// everything is and where the ground sits.
//
// Usage:
//   node scripts/build-campus-lidar.mjs            # fetch + write
//   node scripts/build-campus-lidar.mjs --check    # verify the shipped file
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { treeExclusionZones, pruneTrees } from "./lib/tree-rules.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IN = path.join(REPO_ROOT, "docs/data/campus-3d.json");
const OUT = path.join(REPO_ROOT, "docs/data/campus-lidar.json");
const CHECK = process.argv.includes("--check");
/* --verify rebuilds everything and compares against the shipped file instead of
   writing it. It exists because for most of this project's life the two could
   drift apart in silence: `--check` validates SHAPE (counts, ranges), so a
   height that no builder produces still passed it. Thirty-one values had
   diverged by 2026-08-05 — up to 3.8 m, one of them a whole storey of mechanical
   shelf counted as building — and every gate stayed green the entire time.
   A measured campus that cannot be re-measured is just a campus of assertions. */
const VERIFY = process.argv.includes("--verify");

const require = createRequire(path.join(REPO_ROOT, "package.json"));

const EPT = "https://s3-us-west-2.amazonaws.com/usgs-lidar-public/CA_SanDiegoQL2_2014";

/* The whole main campus, bounded by the roads that bound it: North Torrey
   Pines Road west, La Jolla Village Drive south, Genesee Avenue north-east,
   I-5 east. Same box as build-campus-3d.mjs — the terrain must exist under
   every footprint OSM delivers. ~50 million returns; the build streams them
   (see the fold() note) precisely because this box is 9x the old corridor. */
const AREA = { south: 32.8655, north: 32.8905, west: -117.2540, east: -117.2215 };

/* Terrain sample spacing, metres. The ground here moves by about 7 m over the
   whole walk, so this is not about hills — it is about the plaza sitting a step
   below the path beside it, which 3 m resolves and 10 m erases. */
const TERRAIN_CELL = 3;

/* A return this far above local ground, standing outside every footprint, is
   vegetation rather than a kerb or a parked car. */
const TREE_MIN_HEIGHT = 3.5;

/* THE EPOCH RULE, ENFORCED. The flight is from 2014; a footprint whose
   building went up after it still collects returns — from the trees, lots and
   older structures that stood there — and those "measurements" shipped whole
   neighbourhoods at bungalow height (NTPLLN, 2020, "measured" 6-10 m) or
   inflated a low pavilion to the height of the trees it replaced (The
   Jeannie, "18.2 m"). LiDAR must never claim to have measured a building
   that did not exist, so these names emit NO height and NO part heights;
   the renderer falls through to the OSM/GIS value. */
const POST_2014_SITES = new Set([
  // NTPLLN (2020) + neighbours
  "Mosaic", "Tapestry", "Catalyst", "The Jeannie", "Kaleidoscope",
  "Social Sciences Public Engagement Building", "Arts and Humanities",
  "Design & Innovation Building", "Franklin Antonio Hall",
  // Theatre District LLN (2023)
  "Pulse", "Sankofa", "Podemos", "Azad",
  // Pepper Canyon West (2023)
  "Rya", "Vela",
  // Ridge Walk North LLN / Eighth College (2023)
  "Alianza", "Umoja", "Coalition", "Malk Hall",
  // East Campus (2024)
  "Viterbi Family Vision Research Center",
  // Triton Center (still under construction 2026): the 2014 returns here are
  // off the DEMOLISHED predecessor block, which is the same lie twice over.
  "The Strauss", "Student Success Building",
  "Student Health and Well-Being Building", "Triton Alumni and Welcome Center",
  // Found by the 2026-08-04 gauntlet sweep: every name below shipped a 2014
  // "measurement" of the lot, predecessor or canopy that stood on its site.
  // Mesa Nueva graduate housing (opened 2017) — the flight saw the old Mesa
  // Residential Apartments block it replaced.
  "Ola", "Arena", "Artesa", "Cala", "Cresta", "Marea",
  // Nuevo West graduate housing (opened 2020) — Viento "measured" 22.9 m of
  // predecessor/canopy against the university's 36.6 m, 12-storey record.
  "Viento", "Brisa",
  // Athena Parking Structure (East Campus, opened 2019) — LiDAR 2.3 m is the
  // surface lot it replaced; the GIS carries the 7-level structure at 29.9 m.
  "Athena Parking Structure",
  // TDLLN's fifth building (2023) — its four siblings were already listed.
  "Survivance",
  // Tata Hall for the Sciences (opened 2018) — 19.5 m of pre-construction
  // returns are not a measurement of it.
  "Tata Hall for the Sciences",
  // Epstein Family Amphitheater (opened 2022) — the 17 m the laser saw is the
  // eucalyptus canopy cleared for it. (OSM tags the bowl building=no, so the
  // footprint itself no longer imports as a building either.)
  "Epstein Family Amphitheater",
  // The East Campus health buildout the flight caught mid-construction:
  // ACTRI (opened March 2016; the 28.6 m of 2014 returns are its topped-out
  // frame, not the building) and the Campus Point garage that went up with
  // the Jacobs Medical Center project.
  "Altman Clinical and Translational Research Institute",
  "Campus Point Parking Structure",
  // Found by the r0c1 sweep (2026-08-04): the 2014 annex west of RIMAC has
  // been demolished for a rebuild Apple shows as a tower crane over open
  // concrete decks. The 10.6 m the laser measured is a building that no
  // longer stands, and no source resolves the rising frame's height — the
  // site renders unbuilt (massing excluded in build-campus-arcgis.mjs, the
  // OSM ring skipped in campus-massing.js) until one can.
  "RIMAC Annex",
  // Found by the r2c1 judge sweep (2026-08-05): the plant east of Rita
  // Atkinson opened ~2018-19 with the Voigt Dr utility buildout. The 2014
  // flight reads a tight 4.0-4.2 m plane over its site (416 returns, p98
  // 4.2) — the LOW predecessor structure demolished for it, not the plant.
  // Street View 2020-03 and today's Apple both show the tall finished
  // block, so the university's 12.8 m / 3-level record ships unchallenged
  // and no 2014 number may ever touch it. (A screener proposed "measuring"
  // it at 4.2 — the exact epoch mistake this list exists to forbid.)
  "Satellite Utility Plant",
  // Found by the r2c0 judge sweep (2026-08-05). Two SIO buildings whose 2014
  // roofs no longer exist:
  // Center for Coastal Studies — 1963 seawater tank + 1973 labs at the pier
  // base, renovated 2019-20 (Miller Hull) with the upper floor rebuilt. The
  // flight reads one tight 3-4 m band over the footprint (osm ring: 1,826
  // returns, 83% in the 3 m bin, roofOf 4.6; GIS ring: 2,231 returns, same
  // band) — the PRE-renovation low roof, which shipped as today's building
  // at 3.8 m. Street View 2025-02 shows the finished multi-level block
  // stepping down the bluff; the university's 12.8 m / 3-level record
  // ships unchallenged.
  "Center for Coastal Studies",
  // Marine Conservation Facility — the 1963-64 NOAA fisheries lab, converted
  // 2021-23 (Miller Hull) into the Marine Conservation and Technology
  // Facility: new top-level pavilion and winged roof canopy on the old
  // concrete frame. The 2014 returns (osm ring: 4,339 pts, p50 11.0 under a
  // p75 of 18.9 — guard fires, body loose; the mass's own trace failed
  // massOk the same way) mix the old lab's roof with the pine canopy, and
  // the host-level reconcile pasted that 18.9 onto the mass. No 2014 number
  // describes today's roofline; the university's current 17.1 m / 4-level
  // record ships unchallenged, and Street View 2025-02 (the MCTF sign is on
  // the building) supports a 4-level block stepping down the bluff.
  "Marine Conservation Facility",
  // r1c2 re-sweep (2026-08-05). Three more sites the flight never saw as
  // today's building:
  // Outpatient Pavilion (Koman Family Outpatient Pavilion) — opened to
  // patients 2018-03-12 (UCSD Today; construction from 2015). 11,304
  // returns over the GIS ring read near-grade (roofOf 0.8, 76% in −1..0)
  // — the empty lot. Apple shows the finished four-storey pavilion; the
  // university's 17.1 m / L4 record ships unchallenged (Altman / Athena
  // class). Sibling Altman / Athena / Viterbi in the same corridor were
  // already listed; this name was the miss.
  "Outpatient Pavilion",
  // Nuevo East graduate housing (opened July 2020, HDH) — Piedra and
  // Tierra. Mesa Nueva (Cala/Arena/…) and Nuevo West (Viento/Brisa) are
  // already listed; Nuevo East was not. Piedra's lidar.heights 19.4 and
  // Tierra's 17.8 are predecessor Mesa fabric (bodyTight=false, dense
  // bands 38–40%), not the towers standing on today's Apple. Piedra
  // already wears fac.newer → 36.6; Tierra falls back to the facilities
  // 15.2 / L5 record once the 2014 smear is barred.
  "Piedra", "Tierra",
  // r1c2 pass-2 (2026-08-05). Triton Ballpark renovation — ground broken
  // 2014-09-25, permanent grandstand + Marye Anne Fox Clubhouse opened
  // for the 2015 season (UCSD Tritons / Turner / Wikipedia). The flight
  // predates both: Triton Stadium's GIS ring (≈397 m² on the home-plate
  // side) reads 80% at grade (224 pts, roofOf 5.3 is 27 returns on a 5 m
  // shelf); Triton Clubhouse has 27 pts. Apple shows the finished
  // ballpark today. Same posture as Warren Field House — the university
  // L1 records (4.3) ship unchallenged; no 2014 plane may ever answer.
  "Triton Stadium", "Triton Clubhouse",
  // r1c2 pass-3 (2026-08-05). Two more names the Set still omitted while
  // their siblings already barred 2014 admits:
  // Street Corner Urban Market — Nuevo West amenity (opened 2020 with
  // Viento/Brisa). GIS ring is "Nuevo West - Marketplace"; assembleMasses
  // host-renames it to the OSM name. 1,533 returns over the ring are
  // near-grade / predecessor / tower bleed (53% in −1..0, bodyTight=false,
  // massOk=false, guarded p98 20.9). The GIS 3 m L1 record ships; no 2014
  // number may ever answer. accuracy-2026-08-03 already flagged it.
  "Street Corner Urban Market",
  // Warren FIeld House — GIS typo spelling (capital I). Zero 2014 returns
  // over the ring; Apple shows the finished ~2020 temporary fieldhouse
  // beside Warren Field today. Epoch §14 / pass-2 prose already treat it
  // as the Stadium/Clubhouse class sibling; the Set now names the typo
  // so a future PRE_2014 admit cannot invent a plane from an empty lot.
  "Warren FIeld House",
]);

/* Post-2014 sites keyed by OSM ring INDEX — for what a name cannot say.
   POST_2014_SITES is a set of NAMES, and two of this campus's post-2014
   buildings cannot be named without also naming something older: one shares
   its OSM name with a pre-2014 twin, the other has no name at all. Index
   entries ride the same campus-3d.json coupling that OSM_UNNAMED_VERIFIED
   and partHeights already do. Each entry cites what it is (r1c2 judge
   sweep, 2026-08-04):
   954: the second "Spinal Cord Injury Building" ring — the VA's replacement
        SCI/CLC hospital, built 2021-2026 (accepted from the builder July
        2026), standing finished on today's Apple. The 2014 returns under it
        (p50 1.2, p90 10.6) are the lot and the low predecessor structures
        it replaced. Its 1990s namesake at osm:223 is a real 2014 building
        and measures separately through the per-index path below.
   833: the unnamed multi-deck garage south of the VA hospital, opened 2023
        with the SCI project. The flight read p50 0 — a surface lot — so the
        ring keeps its stated area guess of 16. (osm:438 beside it was once
        kept as a sibling "garage" guess; r1c1 pass-2 found it is a surface
        parking amenity and removed it.)
   r2c1 judge sweep (2026-08-05), two more rings a name cannot answer for:
   718: the unnamed ring over the Satellite Utility Plant's west half. Its
        tight 3.9-4.1 m plane (450 returns) is the demolished predecessor
        the plant's own POST_2014_SITES entry documents — same site, same
        epoch answer, per-ring form.
   1354: the unnamed block south of La Jolla Village Drive at Gilman. The
        flight saw 48 returns, max 1.7 m — a bare lot — and Street View
        2018-05 still shows empty ground; today's Apple shows the finished
        pitched-roof building with its solar carports. Built after mid-2018,
        so the ring keeps its stated area guess of 12. (The registered
        Google chunk over this block is censored — Apple is the only
        current nadir view of it, the VA-garage situation again.)
   r2c0 judge sweep (2026-08-05):
   1345: the unnamed courtyard pavilion between the Eighth College
        residential blocks — an Apple z20 closeup shows the one-storey
        dining pavilion (dark pitched roof, three round vents) standing on
        a terrace the university's massing does not model (0.00 coverage).
        Built with the 2023 neighbourhood: the flight read 549 returns, ALL
        below grade (max -0.1 m) — the bare site. No 2014 number may ever
        ship for it; the ring keeps its stated guess of 4.5, which a
        one-storey pavilion supports.
   785: the multi-deck parking structure west of I-5 / the Blue Line
        trolley (r2c2 judge sweep, 2026-08-05). Today's Apple shows cars
        on the top deck of a finished multi-level garage; the 2014
        returns read one near-grade plane (13,396 returns, p50 0.8 to
        p75 1.2) — a surface lot or low deck, not the structure standing
        today. The VA garage precedent (438 / 833) again: no 2014 number
        may ship, and the ring keeps its stated area guess of 16. */
const POST_2014_OSM_RINGS = new Set([954, 833, 718, 1354, 1345, 785]);

/* GIS masses verified PRE-2014 by hand (r0c1 sweep, 2026-08-04) whose ring
   has neither a named-OSM host nor an exact OSM name twin — the two paths
   the epoch guard normally answers through. For each name below the build
   date is documented in the university's own record and Apple confirms the
   standing building matches the 2014 footprint, so the 2014 returns are a
   measurement of THIS building and its GIS record can be challenged like
   any other. Without this the records stood unchallenged and two were far
   off their measured planes (SDSC East Expansion: GIS 17.1 m, 2014 roof
   plane 23.2 m; Social Sciences Building: GIS 17.1 m, plane 21.0 m).
   Names must stay EXACT — a rename on the service side must fall back to
   unchallenged rather than smuggle the wrong site in. */
const PRE_2014_GIS_VERIFIED = new Set([
  "Social Sciences Building",              // 1995
  "San Diego Supercomputer East Expansion", // 2009
  "Seventh College East #5",               // The Village East, 2008-11
  "Seventh College East #6",               // The Village East, 2008-11
  "ERC Administration North",              // 2004
  "Robinson Building 1 - Administration",  // 1990 (GPS school complex)
  "Robinson Building 3 - Library",         // 1990 (GPS school complex)
  "Outback Adventures",                    // 1990s surf shack, standing today
  /* r0c2 sweep (2026-08-04). East-campus service and school sites whose GIS
     rings have neither a named-OSM host nor an exact name twin. Build dates
     from the university's own record; Apple (2026-08-04) confirms each
     stands on its 2014 footprint. The GIS greenhouse rings span what OSM
     maps as PAIRS of houses, so their centroids fall in the gap between the
     named rings — host containment can't see them. Far misses: the CSC
     shops (GIS 4.3 m, planes 6.5-6.9), the hostless Fleet Services row
     (4.3, plane 5.7), Preuss Building F (8.5, planes 11.4-11.7), and the
     East Campus Substation control building (8.5, plane 5.3 — the record's
     default two storeys for a one-storey switchyard building). NOT added,
     each verified and left unchallenged: Jerboa (Δ0.5 at the noise line,
     153 returns), EMF 2 (Δ0.3), both Preuss modulars (Δ≤0.3), and the
     Preuss Fabrication Lab, whose returns are eucalyptus crown top to
     bottom (p50 12.4 over a one-storey shop) — its 4.6 m record stands
     because the laser cannot see the roof. */
  "Biology Field Station - Greenhouse 1",  // field station stock, pre-2014
  "Biology Field Station - Greenhouse 2",
  "Biology Field Station - Greenhouse 3",
  "Biology Field Station - Frog House",
  "Campus Services Complex - Building C",  // CSC yard, 1980s
  "Campus Services Complex - Building D",
  "Fleet Services",                        // the hostless south row; the north row answers through its OSM host
  "East Campus Substation",                // 2010, serves the hospital district
  "Preuss School - Building A",            // charter school, opened 2001
  "Preuss School - Building B",
  "Preuss School - Building C",
  "Preuss School - Building F",            // both F rings: gym hall and stage house
  /* r1c2 pass-3 (2026-08-05). Preuss D/E were left off the 2001 classroom
     batch above while A/B/C already ship the matching ~9.2 plane. Fresh
     EPT: D 893 pts / E 872 pts, both roofOf 9.2 (p50 8.2–8.3, p75 8.9,
     gap 0.3, bodyTight). Apple shows finished Preuss classroom roofs
     beside the soccer pitch and Mid-Coast trolley today — same footprint
     generation, not a rebuild. */
  "Preuss School - Building D",
  "Preuss School - Building E",
  /* r1c0 sweep (2026-08-04). The Extended Studies cottage rows off North
     Torrey Pines have no OSM rings at all, so every mass stood unchallenged
     at the record's uniform 4.3 m. The 2014 flight sees each roof as a
     one-storey plane 0.4-1.1 m off that default (F 3.2, G 3.5, X 3.9,
     Z 3.3, E 3.3 — bodies tight to 0.1 m), and Apple (2026-08-04) shows
     the same cottages standing on the same footprints. NOT added, each
     probed and left unchallenged: Buildings A, B, C, D and L, whose returns
     are eucalyptus crown over the roof (Building A: p50 3.2 under a p75 of
     8.2 — the discriminator would ship the tree). The laser cannot see
     those five roofs; the record's 4.3 stands. */
  "Extended Studies and Public Programs - Building F",
  "Extended Studies and Public Programs - Building G",
  "Extended Studies and Public Programs - Building X",
  "Extended Studies and Public Programs - Building Z",
  "Extended Studies and Public Programs - Building E",
  /* Tuolumne's ninth mass (2003 complex): its centroid falls in the notch
     outside the complex's concave OSM ring, so host containment misses it
     and 12.2 m of GIS record stood for a 13.0 m measured plane (1,947
     returns, p75 11.8 to p98 13.0). T House East answers through its own
     ring; this one has none. */
  "Tuolumne Apartments - T House North",
  /* r1c2 judge sweep (2026-08-04). Hostless records on the Matthews /
     health-campus shard wearing the levels-derived default (4.27 m a
     storey) while the flight reads a clean plane off each roof. Build
     dates documented; Apple (2026-08-04) shows each standing unchanged
     on its 2014 footprint.
     Matthews Apartments B/D/E: 1972 student housing, still occupied.
     Their OSM letter-rings ("B", "D", "E") are drawn offset enough that
     no centroid answers, so the records stood at 6.1 while the planes
     read 8.5-8.7 (A and C already measure through their letter-ring
     hosts at 8.6 each).
     Campus Point Parking Structure West: complete in the 2014 flight —
     12,626 returns, p50 12.9 to p98 14.4, a finished deck stack — unlike
     its East sibling, which went up with Jacobs Medical Center and stays
     in POST_2014_SITES. The 21.3 record is five levels at the 4.27
     default; a garage's decks pitch ~2.9 m and the measured stack is
     14.4.
     East Campus Utilities Plant: the ~2000 plant block (record 4.3,
     plane 8.2). Its 2016 Expansion is a separate post-2014 mass and is
     deliberately NOT here: the 7.5 m of 2014 returns under the Expansion
     footprint are its predecessor, not it, and no admissible source
     resolves the finished structure — the record stands, stated as a
     record.
     9435 Modular Offices: the trailer banks north of Sulpizio, on their
     2014 footprint today. Record 8.5 — two "storeys" for single-storey
     trailers; the plane is 3.8.
     Stuart Collection Storage: the campus-services shed (university
     building 91, in the CSC yard's generation). Record 8.5, plane 4.3.
   r0c0 re-sweep (2026-08-05). Marshall Residence Hall V: 1960s Marshall
     College housing, still occupied on today's Apple. No OSM way carries
     this letter-name, so the L3 record (9.1) stood unchallenged while the
     flight reads one tight 6–7 m plane (3,317 returns, mode 6 m at 74%,
     guarded p75 6.8 — the p98 tail to 14.8 is neighbour canopy). Sibling
     T already ships 6.1 matching its dense band; U is stepped
     (bodyTight=false) and stays with its record. */
  "Matthews Apartments B",
  "Matthews Apartments D",
  "Matthews Apartments E",
  "Campus Point Parking Structure West",
  "East Campus Utilities Plant",
  "9435 Modular Offices",
  "Stuart Collection Storage",
  "Marshall Residence Hall V",
  /* r1c2 pass-2 (2026-08-05). Two more hostless health-campus service
     pads whose L1 storey defaults stand against clean 2014 planes, and
     Apple (2026-08-05) shows each finished on its 2014 footprint:
     Thornton Supplemental Storage — low service shed north of Medical
     Center Drive (342 pts, p50 2.2 / p75 2.3 / p98 2.6, gap 0.3,
     bodyTight); record 4.3 is ~1.7 m high.
     Medical Center Switching Station — light utility roof (1,629 pts,
     p50 5.2 / p75 5.3 / p98 5.4, gap 0.1, bodyTight); record 4.3 is
     ~1.0 m low. Sibling of Stuart Collection Storage / East Campus
     Substation in the same PRE_2014 hostless class. */
  "Thornton Supplemental Storage",
  "Medical Center Switching Station",
]);

/* A facilities record that models a building as a whole-footprint ring PLUS
   a contained tower ring measures wrong either way: the whole ring's returns
   mix the tower plane into the low wings (Atkinson Hall: p50 13.9 under a
   p75 of 28.2), so the stepped-slab guard rightly withholds it — and the
   host fallback then pastes the 27.2 m OSM-ring measurement over the 14 m
   west pavilion. Measuring the ring MINUS its contained mass gives the low
   portion its own clean plane (p98 14.5, 16,642 returns) while the tower
   ring keeps measuring itself. Keyed by exact GIS mass names. */
const MEASURE_MINUS_CONTAINED = {
  "Atkinson Hall": ["Atkinson Hall Tower"],
};

/* The OSM-HOST form of the same correction (r2c0 judge sweep, 2026-08-05),
   in its own map because the two keys live in different namespaces — an
   "Atkinson Hall" here would subtract the tower from the OSM ring too and
   silently change what that host's number means. NOAA is the mirror image
   of Atkinson: OSM traces the full fisheries complex (centre block plus
   both low lab wings) while the university's ring is the tall centre block
   alone — 98% of the record ring sits inside the OSM outline, covering 47%
   of it. Measured whole, the outline's p98 (14.7) lands ON the centre
   block, so the wings extruded a metre ABOVE the core's own measured plane
   (13.8, 13,997 returns) and the two prisms z-fought where they overlap.
   Minus the contained mass, the wings read their own p98 of 13.5 (12,697
   returns, no guard, body tight) and the core keeps measuring itself. */
const MEASURE_MINUS_CONTAINED_HOSTS = {
  "NOAA - Southwest Fisheries Science Center Laboratory": ["NOAA Southwest Fisheries Science Center"],
};

/* UNNAMED OSM rings that render (no facilities mass covers them, no name to
   key lidar.heights) and are hand-verified UNCHANGED since the 2014 flight
   (Apple satellite, 2026-08-04) — so their 2014 roof plane may replace the
   OSM height guess. Keyed by index into campus-3d.json's buildings array,
   the same coupling partHeights already rides. Index-keyed rather than
   emitted wholesale because an unnamed ring has no name to look up in
   POST_2014_SITES: without a per-ring verification the laser could hand a
   post-2014 rebuild its predecessor's roof. Each entry cites what it is.
   786: The Village East community building (2008-11 buildout; OSM guessed
        9 m, the plane is 12.3). 893: the kiosk east of RIMAC's service
        court, standing on current Apple (OSM 4.5, plane 4.3).
   r0c2 sweep (2026-08-04) — east campus, where almost nothing is named in
   OSM and every ring wore an area-based guess. Apple confirms each stands
   on its 2014 footprint; the fixes below replace guesses that were up to
   19 m off. Verified and deliberately NOT here: 503 (the main Scripps
   Memorial complex — a stepped slab whose returns have no single plane:
   p75 9.5 under towers at 32; roofOf would flatten it to 9.5, worse than
   the 20 m guess it has), 772/835 (Prebys north wing, Anderson Pavilion —
   post-2014 finishes; the flight saw foundations), 780 (a shed under
   full eucalyptus crown, 67 returns, p50 10 for a one-storey structure),
   944 (8 returns — below the trust floor), 508 (a canopy the flight saw
   as bare ground, 0.4 m — post-2014).
     Campus Point offices: 0 (31.3; guessed 12), 63 (stepped — the guard
        takes the 22.8 main plane under a 27.9 core; guessed 12),
        113 (9.3), 119 (19.1), 132 (9.4), 186 (13.7), 204 (15.2).
     Scripps Memorial campus, all standing pre-2014: 453 (central plant,
        19.9), 501 (8.3 — crown at 33 over the wing, guard takes p75),
        502 (the east tower: 34.0; OSM guessed 22.8), 504 (6.3),
        505 (10.0), 507 (11.0), 509 (10.9), 510 (6.5).
     506: Prebys Cardiovascular Institute — topped out mid-2013, opened
        2015. The flight measured the COMPLETE structure: 27,500 returns,
        p75 45.5 to p98 46.9 is one tight finished plane, not formwork
        scatter. The 2014 roof is today's roof; OSM guessed 16.
     55: the XiMED annex block (12.4). 781: campus point office (12.1).
     931-943: the hospital-district carports and PV canopies — OSM
        guessed 4.5-9 m box heights for what measure 3.8-8.7.
   r1c0 sweep (2026-08-04) — La Jolla Farms, west of the campus proper,
   where no ring is named and every house wore an area-based guess. Every
   index below was re-sampled from the EPT and shipped only when its roof
   read as ONE plane (no-guard spread p98-p75 <= 2 m, or a guarded body
   tight to p75-p50 <= 2 m), then checked against an Apple closeup
   (2026-08-04) showing the structure standing on its 2014 footprint.
   Guesses ran both directions: one-storey ranch houses guessed at 9 m
   (319: plane 4.4; 906: 3.6; 979: 4.2; 1009: 3.5) and two-storey
   townhouses guessed at 4.5 (725-727: planes 7.7-7.9; 1088-1095:
   6.2-8.8; 913: 8.9).
     177, 777: the two unnamed sheds inside the Extended Studies rows
        (planes 4.6, 3.3).
     319-321: the Blackgold Rd estates (planes 4.3-4.4, all guessed 9).
     486-491: the bluff compounds over Blacks Beach (planes 2-8.8).
     721-757: the Blackhorse Farms townhouse rows (planes 7.4-8.8).
     829, 831, 885: mid-farms estates (7.6, 8.2, 9.1).
     902-916: La Jolla Farms Rd south houses (planes 3.6-9.6).
     979-1031: the main estate grid (planes 3.1-8.9).
     1088-1095: the south-edge cluster (planes 6.2-8.8).
     1386-1388: the estancia cottages by the tennis courts (4.5-7.9).
   Verified and deliberately NOT here: 481 (its ring sits under unbroken
   chaparral on the canyon rim — Apple cannot see a structure and the
   laser plane could be brush; no source resolves it, the guess stands),
   and 25 crown-smeared rings (322, 480, 485, 832, 903-904, 907, 909-910,
   982, 986, 996-997, 999, 1002, 1007-1008, 1013, 1017, 1022-1024, 1028,
   1089, 1094) whose spreads put p98 in a tree and whose bodies are too
   loose to trust p75 — their OSM guesses stand, stated as guesses.
   r1c1 judge sweep (2026-08-04) — two utility structures wearing area
   guesses, each standing identically on the registered chunk and on
   today's Apple:
     224: the Central Utilities Plant's thermal storage tank — the round
        white tank beside the cooling-tower rows. 3,104 returns read one
        plane, p50 26.4 to p98 27.0 (roofOf 27.0); the area guess was 9.
        An 18 m miss on an unchanged structure — the largest measured
        height error this shard has produced.
     826: the white plant block between the VA hospital and its garage;
        1,061 returns, p50 6.3 to max 6.5, the tightest plane in the
        batch (roofOf 6.4; guessed 9).
   Verified and deliberately NOT here: 438, the VA parking structure.
   Apple shows a finished multi-deck garage with cars on the top deck;
   the 2014 returns read p50 2.4 m — a surface lot with scattered tall
   objects. The garage postdates the flight, so no 2014 number may ship
   and the ring keeps its stated area guess of 20, in family with a
   five-deck garage. (The Google chunk over this footprint is censored —
   federal facility — so Apple is the only current view of it.)
   r1c2 judge sweep (2026-08-04) — two unnamed rings on the VA / health
   corridor, each standing identically on today's Apple:
     764: the VA campus plant building east of the hospital (a 19-vertex
        ring, 8,426 returns): p50 6.9 under a roofOf of 9.7, against a
        12 m area guess.
     775: the small modular beside the 9435 banks north of Sulpizio
        (650 returns, p50 3.8, roofOf 3.9; guessed 4.5).
   Verified and deliberately NOT here: 833 (the VA's 2023 garage — see
   POST_2014_OSM_RINGS), 762 (a 197 m² service structure between
   Sulpizio and the bed tower: three-quarters of its returns are
   neighbour bleed up to 24 m, and the dense band's p50 of 4.8 agrees
   with the 4.5 guess it already wears), and 365 (the ring beside the
   Mesa Nueva towers, the same bleed shape — p50 17.9 over what the
   record and Apple both read as low structures; the 8.4 guess stands
   because the laser cannot see past the towers).
   r2c1 judge sweep (2026-08-05) — four unnamed rings on the west
   commercial corridor, each standing unchanged on today's Apple:
     93: the grid-roof residential complex east of Villa La Jolla Dr
        (7,543 returns, p25 10.5 to p98 11.8, body tight): plane 11.8
        against a 16 m area guess.
     77: the white L-shaped commercial block on Villa La Jolla Dr
        (7,400 returns): the roof is one plane at 7.5 (p25 = p75); the
        p98 tail to 28.1 is the ficus rows hugging its east edge, which
        the tree-guard already discards. Tagged 12.
     333: the east retail strip of La Jolla Village Square (6,216
        returns, p98 8.2, max 8.5): plane 8.2 against an OSM tag of
        4.8 — the mapper under-tagged a tall single-storey shell.
     335: the center pavilion cluster of the same mall (3,173 returns,
        p98 7.8 on the targeted re-sample; the build's own tiling reads
        7.7): plane 7.7, same under-tagged 4.8.
   r2c0 judge sweep (2026-08-05) — the SIO shore and the La Jolla Shores
   edge, each ring re-sampled full-depth and standing unchanged on today's
   Apple:
     403: the round white seawater tank on the beach below the Scripps
        pier bluff — lettering on its top, standing today exactly as the
        flight saw it. 381 returns split between the access deck and one
        tight plane at 9-10 m (band p98 9.8 on the targeted re-sample;
        the build's own tiling reads 9.9); the area guess was 4.5. No
        facilities ring covers it.
     1036: the house on La Jolla Farms' east edge (4,169 returns, band
        4-5 m at 77%, roofOf 6.2; guessed 9).
     1048: a one-storey flat-roof house (2,522 returns, 77% in the 2 m
        bin alone, re-sample 3.2, the build's tiling 3.1; guessed 9).
     1053: a low ranch house (1,184 returns, band 3-4 at 86%, roofOf 4.8;
        guessed 9).
     1073: a flat pad house (2,007 returns, 91% in a 2-3 m band, roofOf
        3.7; guessed 9).
     1141: the shore-colony house north of the aquarium bluff (1,408
        returns, band 3-4 at 53% with a clean 5 m tail, roofOf 5.3;
        guessed 9).
     1145: its flat-roofed neighbour — 95% of its 903 returns in the 2 m
        bin alone, the tightest plane in the batch; guessed 9. Its ring
        pokes past AREA's south edge, so the build reads the in-box
        subset: p98 2.5, against the full ring's 3.1 — both sit on the
        SAME single band (the full read rides the band's 19-return
        upper tail), so the in-box number ships, unlike the stepped
        Ritter case where the box hid a different-height section.
   Verified and deliberately NOT admitted:
     216: an unnamed re-trace 75% covered by the university's "9369
        Discovery Way" mass, which already is the building — the r2c1
        coverage floor suppresses it at render, and its own trace is
        canopy-smeared anyway (p50 5.6 under a p75 of 17.4).
     1033: the bluff-rim terrace compound NW of NOAA. 1,000 returns and
        not one of them rises a metre above the rim grade — the "roof" IS
        the upper terrace, and the structures Apple shows descend the
        cliff face BELOW it. An extrusion cannot say this shape honestly
        in either direction; the ring keeps its guess and the limitation
        is logged, the Scripps Memorial verdict again.
     1068: a house whose returns are 73% eucalyptus (p50 17.1 over a
        one-storey band at 2-3 m). The dense band is only 27% — below
        every precedent this list has admitted — so the laser cannot see
        this roof and the guess stands.
   r2c2 judge sweep (2026-08-05) — east of I-5: the medical / Aventine /
   Village Square / Temple corridor. Each admission re-sampled full-depth
   and standing unchanged on today's Apple; every ring read as ONE plane
   (no-guard p98-p75 <= 2 m, or a guarded body tight to p75-p50 <= 2 m):
     95: white mid-rise west of I-5 / La Jolla Village Drive (5,723
        returns, p25 25.9 to p98 30.9, body tight): plane against a 12 m
        area guess — under by multiple storeys.
     198: the large low commercial / retail roof west of I-5 near the
        trolley corridor (96,121 returns, 86% in a 6-7 m band, roofOf
        8.1): plane against a 20 m guess. Rim ground only 16/51 verts
        (ring past AREA's south edge) — same in-box class as 1145; the
        dense band is the whole building.
     337: the low deck / pavilion north of the Temple lawns (6,748
        returns, 92% in a 1-2 m band, roofOf 3.5): plane against a 12 m
        guess.
     288: bright white L-shaped low commercial west of I-5 (8,470
        returns, 74% in the 4 m bin; guarded p75 4.5, the p98 tail is
        canopy): plane against a 12 m guess.
     305: mid commercial / residential east of I-5 (7,015 returns, 91%
        in the 8 m bin, roofOf 9.5; a single 940 m LiDAR glitch is
        discarded by p98): plane against a 16 m guess.
     51: multi-storey medical / Aventine-south strip (12,792 returns,
        69% in the 16 m bin, guarded roofOf 17.0): plane against a 12 m
        guess.
     62: neighbour of 51 (13,454 returns, 83% in the 16 m bin, roofOf
        16.2): plane against a 12 m guess.
   Verified and deliberately NOT admitted:
     83: the helipad medical tower + lower wing composite (17,693
        returns): dense band at 31-32 m (38%), tower plane at 52-63 with
        the red H pad on today's Apple — two buildings in one ring, the
        Hyatt shape. No single plane; the 16 m guess stands.
     497: Aventine wing west of the Hyatt courtyard — stepped, 59% at
        14 m and a second plane at 18 m (body not tight). roofOf would
        paste 18.9 across both; the 9 m guess stands.
     289: Belmont-adjacent residential under mature canopy — body band
        near 12-13 m already matches the 12 m guess; roofOf 22.6 rides
        the crowns to 68 m. No admission without a dense-band hand
        audit, and the guess already agrees with the body.
     785: post-2014 garage — see POST_2014_OSM_RINGS.
   r0c0 re-sweep (2026-08-05) — NW campus / Estancia / coastal fringe.
   Each admission re-sampled full-depth and standing unchanged on today's
   Apple; every ring read as ONE plane (no-guard p98-p75 <= 2 m, or a
   guarded body tight to p75-p50 <= 2 m):
     331: Estancia-adjacent low residential / hospitality pad (11,034
        returns, 79% in a 4–5 m band, guarded roofOf 5.3): plane against
        a 12 m area guess.
     149: light-grey flat-roof service / utility cluster west of the
        Sanford lawn (2,973 returns, 90% in a 4–5 m band, roofOf 5.6):
        plane against a 12 m guess.
     974: low pitched-roof amenity structure among Estancia landscaping
        (5,368 returns, 65% in the 3 m bin, guarded roofOf 3.8): plane
        against a 9 m guess.
     1372: coastal structure on a graded site west of North Torrey Pines
        (6,791 returns, 73% in a 3–6 m band, roofOf 7.3): plane against
        a 12 m guess.
     878: low pad west of the ERC halls (2,048 returns, 97% in the 5 m
        bin, roofOf 5.9): plane against a 9 m guess.
     483: coastal-fringe structure (2,771 returns, body tight, roofOf
        8.3): plane against a 12 m guess — from the class-hole sample.
   Verified and deliberately NOT admitted:
     513: coastal-scrub pad west of North Torrey Pines — returns mix
        near-ground / deck (p50 0.2, hist peaks at 0 m and 3 m;
        bodyTight=false). Apple shows a finished low pad today, but the
        2014 sample is not a clean body plane; the 9 m guess stands. */
const OSM_UNNAMED_VERIFIED = new Set([
  786, 893,
  93, 77, 333, 335,
  0, 55, 63, 113, 119, 132, 186, 204, 453, 501, 502, 504, 505, 506, 507,
  509, 510, 781, 931, 932, 933, 934, 935, 936, 937, 938, 939, 940, 941,
  942, 943,
  177, 319, 320, 321, 486, 487, 488, 489, 490, 491, 721, 722, 723, 725,
  726, 727, 728, 730, 731, 732, 733, 734, 735, 739, 740, 741, 742, 748,
  749, 750, 751, 752, 755, 756, 757, 777, 829, 831, 885, 902, 905, 906,
  908, 911, 912, 913, 914, 915, 916, 979, 980, 981, 983, 984, 987, 988,
  989, 990, 991, 992, 993, 994, 995, 998, 1000, 1001, 1003, 1004, 1005,
  1006, 1009, 1010, 1011, 1012, 1014, 1015, 1016, 1018, 1019, 1020, 1021,
  1025, 1026, 1027, 1029, 1030, 1031, 1088, 1090, 1091, 1092, 1095, 1386,
  1387, 1388,
  224, 826,
  764, 775,
  403, 1036, 1048, 1053, 1073, 1141, 1145,
  95, 198, 337, 288, 305, 51, 62,
  331, 149, 974, 1372, 878, 483,
  /* r1c0 re-sweep 2026-08-05: three La Jolla Farms one-storey bodies the
     first decide pass withheld for planeTight (p98−p75≤2), now admitted
     under the thin-shelf host rule (dense ≥85%, gap >2, bodyTight → p75).
     481: Geisel House grounds pavilion — prior "no structure / brush"
     withhold contradicted by today's Apple (square pyramid roof beside
     the pond) and a tight 2014 plane (542 pts, gap 0.5, roofOf 6.2). */
  903, 1028, 1094, 481,
  /* r1c1 re-sweep 2026-08-05 — Central Utilities cooling-fan enclosures.
     Sibling of the TES tank (224 → 27.0). Each ring is one plane, standing
     unchanged on today's Apple (six circular fans on 225; southern fan
     array on 226); area guesses were 9 / 4.5:
       225: 3,208 returns, p50 = p75 = 6.7, roofOf 8.1, gap 1.4, bodyTight
       226: 1,193 returns, p50 6.6 / p75 6.9, roofOf 8.4, gap 1.5, bodyTight
     Deliberately NOT admitted this pass (epoch / typology / near-miss):
       759: demolished pad — Apple bare dirt; skipOsmAnchors, not a height.
       840 / 898: Epstein / PCW fringe — post-2014 amphitheater; skip.
       917 / 918: Mayer hex connector — elevated walkway, not a solid hall.
       1352: Strauss-edge fringe, massOk=false; keep the 9 m guess.
       827: trolley-adjacent 109 m² ring, bodyTight=false; keep 4.5 guess. */
  225, 226,
  /* r1c2 re-sweep 2026-08-05 — modular / VA-corridor pads beside the
     already-admitted 775 / 9435 banks and the west-edge VA strip:
       776: 630 returns, p50 3.8 / p75 3.9 / roofOf 4.0, dense 89% @2–3,
            bodyTight — clean one-storey plane (was 4.5 area guess).
       766: 641 returns, p50 4.6 / p75 5.4 / roofOf 6.2, gap 0.8,
            bodyTight — usable one plane (was 4.5). Sibling 765 is
            stepped (bodyTight=false) and stays out.
     Deliberately NOT admitted: PC1200/1800 dual-plane (dense ~54%),
     Perlman near-shelf (82.8%), Foodworx Dining Room (93% at grade —
     excluded from massing, not a height). */
  776, 766,
  /* r2c0 re-sweep 2026-08-05 — Shores / Discovery Way unnamed pads beside
     the already-admitted 403 / 1036 / 1048 / 1053 / 1073 / 1141 / 1145 set.
     Independent full-depth EPT (point counts matched the screener); Apple
     currency confirmed standing finished low fabric, no crane:
       1039: 3,113 returns, guarded roofOf 2.8 (p50 2.5 / p75 2.8, canopy
             tail to 17) — was 9 m area guess (~2 storeys over).
       1079: 2,192 returns, guarded roofOf 3.3 (p50 3.0 / p75 3.3) — was 9.
       1143: 2,873 returns, clean p98 5.1 (sibling of 1141 at 5.3) — was 9.
       1055: 1,169 returns, guarded roofOf 4.8 (p50 4.2 / p75 4.8) — was 9.
       1059: 1,155 returns, thin-shelf host rule → p75 3.8 (dense 90.6% in
             a 3–4 m band, gap 4.3 under the 5 m canopy guard; unguarded
             roofOf would have pasted the 8.1 shelf) — was 9.
     Deliberately NOT admitted this pass:
       1075: bodyTight=false canopy smear (p50 3.2 / p75 10.4 / p98 14.3);
             keep the 9 m guess (1068 eucalyptus family).
       825:  tiny U-loop ring under crowns (599 pts, bodyTight=false);
             keep the 4.5 m guess.
       IGPP 2000: dense 84.9% under the 85% thin-shelf cut — near-miss
             (Perlman / McGill family); massHeights 11.3 stands.
       Coast / Discovery hostless GIS pads: L2=6.1 already matches the
             dense ~5.6 body; canopy neighbours are massOk=false. */
  1039, 1079, 1143, 1055, 1059,
  /* r2c1 re-sweep 2026-08-05 — La Jolla Village Square / Villa La Jolla
     corridor unnamed pads beside the already-admitted 93 / 77 / 333 / 335
     set. Independent full-depth EPT (point counts matched the screener
     exactly); Apple currency confirmed finished white commercial /
     institutional roofs, no crane:
       103: 1,757 returns, clean p98 8.2 (p50 7.3 / p75 7.4, dense 55% in
            the 7 m bin) — was 4.8 under-tag (sibling of 333 @ 8.2).
       334: 1,362 returns, clean p98 7.7 (p50 7.3 / p75 7.4, dense 60.8%)
            — was 4.8 (sibling of 335 @ 7.7).
       129: 2,134 returns, clean p98 11.3 (p50 11.0 / p75 11.1, dense
            58.2% in the 11 m bin) — was 9 area guess.
     Deliberately NOT admitted this pass:
       707: dense body 5.2 ≈ the 4.8 guess (Δ 0.4); roofOf 6.7 is a modest
            HVAC shelf (gap 1.5 under the 2 m thin-shelf cut). Not a miss.
       708: multimodal (dense 29.7% @5, hist spread 0–7); no clean body
            plane — keep the 4.8 guess rather than invent 7.2.
       Union Bank / UC Cyclery (named hosts): thin-shelf near-misses —
            dense 79.9% / gap 2.7 and gap 1.5 under the cut; Apple shows
            HVAC on both finished strip roofs. Keep roofOf 8 / 6.8. */
  103, 334, 129,
  /* r2c2 re-sweep 2026-08-05 — Sheraton strip / Whole Foods pad / Temple
     corridor / Aventine-south courtyard blocks. Independent full-depth
     EPT (point counts matched the screener exactly); Apple currency
     confirmed finished commercial / residential roofs, no crane:
       1366: 4,425 returns, thin-shelf host rule → p75 5.2 (dense 91.9%
             in a 5–6 m band, gap 4.6; unguarded roofOf would paste 9.8)
             — was 9 area guess.
       1365: 5,485 returns, guarded roofOf 5.1 (p50 = p75 = 5.1 under a
             canopy/HVAC tail to 12.5) — was 9.
       285:  7,470 returns, thin-shelf host rule → p75 8.4 (dense 87.3%,
             gap 2.1; unguarded roofOf would paste 10.5) — was 12.
       81:   6,304 returns, clean p98 7.7 (p50 7.4 / p75 7.5; sibling of
             Village Square under-tags) — was 4.8 under-tag.
       287:  5,801 returns, guarded roofOf 8.4 (p50 8.3 / p75 8.4 under
             a canopy tail to 14.2) — was 12.
       286:  5,120 returns, clean p98 10.1 (dense 87.1% in 8–9 m, gap
             1.6 under the thin-shelf cut — plant noise on the same
             plane, not a shelf) — was 12.
       1356: 24,983 returns, clean p98 13.2 (p50 12.1 / p75 12.2) — was 16.
       1355: 21,686 returns, clean p98 13.8 (p50 12.9 / p75 13.0) — was 16.
     Deliberately NOT admitted this pass:
       1364: dense 78.7% under the 85% thin-shelf cut (gap 3.9) —
             Sheraton-strip near-miss sibling of 1366; admitting roofOf
             would paste the 9.3 shelf. Keep the 9 m guess.
       704 / 705: stepped mid-rises (dense 2 m band 47% / 44%); no
             single plane — keep the 9 m guesses.
       257 / 258: dense body ≈ the 12 m guess; roofOf 16 / 17 rides an
             upper wing (osm:707 family). Keep the guesses.
       Medical (named): dense 85.8%, gap 1.9 under the 2 m cut; HVAC
             shelf on a finished roof — keep roofOf 10.7.
       Hyatt / osm:83 / 497 / 289: prior composite / canopy withholds
             (HAND_AUDITED null / bodyTight=false). */
  1366, 1365, 285, 81, 287, 286, 1356, 1355,
  /* r0c0 pass-2 re-sweep 2026-08-05 — remaining La Jolla Farms / Estancia
     unnamed pads after pass-1's 331/149/974/1372/878/483 admissions.
     Independent full-depth EPT (point counts matched the screener
     exactly); Apple currency confirmed finished roofs, no crane:
       976: 1,881 returns, clean p98 4.6 (dense 75% in 2–3 m) — was 9.
       328: 1,705 returns, canopy-guarded p75 4.7 (dense 82% in 3–4 m,
            gap 5.0 to canopy at 9.7) — was 9. Estancia amenity pad.
       330: 1,521 returns, canopy-guarded p75 4.8 (gap 7.5) — was 9.
            Estancia amenity sibling of 328 / 974.
       830: 1,333 returns, clean p98 5.0 (dense 74% in 3–4 m) — was 9.
       871: 2,100 returns, clean p98 6.1 (gap 0.3, dense 87%) — was 9.
       972: 1,715 returns, clean p98 6.1 (bodyTight) — was 9.
       977: 2,321 returns, clean p98 6.3 (bodyTight) — was 9.
       493: 5,990 returns, clean p98 6.3 (dense 84%, gap 2.0 under the
            thin-shelf cut — plant noise on the same plane) — was 9.
       969: 1,609 returns, clean p98 6.3 (gap 0.4) — was 9. Residual
            sibling of the mediums, same class.
     Deliberately NOT admitted this pass:
       828: near-ground / deck returns (p50 0.5, hist mode 0 m at 70%;
            roofOf 1.7). Nominatim has no building address (Salk Institute
            Road fringe); Apple darker low-entropy center consistent with
            pavement/scrub. Epoch-ambiguous — do not invent a 1.7 m
            "building." Keep the 4.5 m guess.
       513: already withheld pass 1 (bodyTight=false coastal-scrub mix). */
  976, 328, 330, 830, 871, 972, 977, 493, 969,
  /* r2c0 pass-2 re-sweep 2026-08-05 — two more Shores / shore-colony
     unnamed pads after pass-1's 1039/1079/1143/1055/1059 admissions.
     Independent full-depth EPT (point counts matched the screener
     exactly); Apple currency confirmed finished roofs, no crane:
       1097: 441 returns, clean p98 7.6 (p50 7.4 / p75 7.5, dense 80.7%
             in the 7 m bin, gap 0.1) — was 4.5 under-guess at 9535
             Poole Street (Nominatim). Sibling of Village Square
             under-tags (103 / 334).
       1147: 960 returns, clean p98 6.5 (p50 5.4 / p75 6.0, dense ±1
             95.8% in 4–6 m, gap 0.5) — was 9 over-guess at 2715
             Bordeaux Avenue; sibling of already-admitted 1141 / 1143.
     Deliberately NOT admitted this pass:
       1062: multimodal (dense 31.5% @5, ±1 64.8%); body sits above the
             4.5 guess but no single dominant plane — keep the guess.
       Keck OAR 2 south: probe "overheight" is rimBase vs centroid on a
             4.3 m grade (rim 68.9 / cent 71.8) — massHeights 11.8 is
             the builder's own answer for absolute roof ≈80.7; north
             sibling ships 10 from the same absolute plane. Not a miss.
       Hubbs: dense 80.2% under the 85% thin-shelf cut (IGPP 2000 /
             Perlman near-miss); mechanical well on today's Apple.
             massHeights 12.3 stands.
       osm:1345: already POST_2014_OSM_RINGS; declared 4.5 guess stands
             (Eighth courtyard pavilion, §16).
       1144 / 1146 / 1160: centroids past terrain z_max=1386 (0 EPT pts
             via groundAt-null); Vaughan / Ritter apron class — expand
             the survey box before any admit.
       Vaughan / Ritter / Eckart: heights already measured; residuals
             are terrain-apron / roof-anchor renderer handoffs. */
  1097, 1147,
  /* r2c1 pass-2 (2026-08-05) — Boardwalk / Villa La Jolla apartment
     connectors + Residence Inn pads + Villas Mallorca / La Jolla Scenic
     fringe. Screener full-depth EPT re-derived (point counts matched);
     Apple currency confirmed finished multi-storey / hotel / residential
     roofs standing today, no crane:
       Mesa / Boardwalk under-tags (was 4.5 shed default under a shared
       ~8.5 m 2014 plane — Village Square 103/334 class, residential):
         518: thin-shelf → p75 8.5 (665 pts, dense 85.4% @8, gap 3.2;
              unguarded roofOf would paste the 11.8 HVAC shelf)
         519: clean p98 8.8 (653 pts, dense 86.8%, gap 0.2)
         522: clean p98 8.8 (841 pts, gap 0.4)
         524: clean p98 8.8 (656 pts, dense 84.1%, gap 0.2)
         526: clean p98 8.9 (677 pts, dense 80.4%, gap 0.4)
         530: canopy-guarded p75 8.6 (942 pts, dense 72.2% @8 under a
              23.7 canopy tail; gap 15.1 → tree guard)
         531: clean p98 8.9 (858 pts, dense 85%, gap 0.4)
         532: clean p98 8.5 (999 pts, dense 75.6%, gap 0.2)
         534: clean p98 8.7 (1040 pts, gap 0.4)
       Residence Inn connectors beside the already-measured host (10.5):
         548: clean p98 9.9 (623 pts, gap 1.9 under thin-shelf cut)
         549: clean p98 10.0 (606 pts, gap 2.0)
         550: clean p98 10.0 (628 pts, gap 1.7)
       South-fringe residential:
         657: clean p98 11.2 (1517 pts, Villas Mallorca / Villa La Jolla
              Driveway; sibling of OOB 656/658/661)
         1373: clean p98 9.3 (5567 pts; was 12 over-guess at 8745 La
               Jolla Scenic Drive North)
     Deliberately NOT admitted this pass:
       520: gap 4.5 / dense 69.5% under the 85% thin-shelf cut — roofOf
            would paste the 13.2 canopy shelf; keep the 4.5 guess.
       1218: dense body ~3.6 under a 6.2 shelf (dense 46.9% / gap 2.6
             under cut); do not paste either plane. Keep the 9 guess.
       1339: dense 28.7% (1062 multimodal family); keep the 4.5 guess.
       656 / 658 / 661: centroids past terrain z_max=1386 → 0 EPT pts
            (Vaughan / Ritter apron class); keep the 9 guesses.
       805 / 806: Mobil Mart strip — clean planes at 5.3 / 5.4 against
            a 4.5 guess (Δ 0.8–0.9, under the storey bar); host already
            ships 5.1. Not a miss.
       CRS (named GIS): shipped 17.5 within 0.8 of roofOf 18.3; residual
            is a 4.6 m grade span (Voigt / roof-anchor renderer class). */
  518, 519, 522, 524, 526, 530, 531, 532, 534,
  548, 549, 550,
  657, 1373,
  /* r2c2 pass-2 (2026-08-05) — La Jolla Village Drive / One Miramar terrace
     strip + Lebon / Nobel / Mahaila unnamed pads after pass-1's
     1366/1365/285/81/287/286/1356/1355 admissions. Independent full-depth
     EPT (point counts matched the screener exactly); Apple currency
     confirmed finished terracotta / white residential roofs, no crane.
     Heights cited below are the build's own rimBase tiling; the
     centroid-probe roofOf sat in the same band (± a few tenths, or more
     where the ring straddles the terrain box):
       LJVD / One Miramar terrace under-tags (was 4.5 shed default under a
       shared ~9–10 m 2014 plane — Village Square / Boardwalk class):
         469: 9.4 (702 pts)   471: 9.3 (912)   472: 10.2 (837)
         474: 9.7 (873)       475: 9.3 (882)   476: 10.7 (864)
         478: 10.6 (843)
         691: 9.7 (169)       692: 9.3 canopy-guarded (201, crown tail)
         693: 11.0 (203)      694: 9.8 (203)   696: 9.9 (222)
       East-fringe singles:
         310: 8.4 (806 pts; Nominatim 3525 Lebon Drive)
         336: 11.4 (391 pts; Nominatim 3950 Mahaila / Axiom)
         277: 9.9 (778 pts; Nobel / Miramar east)
       Lebon Colony residential strip (was 9 m area guess; dense body
       clearly above — distinct from rejected 257/258 dense≈guess):
         251: 13.0 (1856)  252: 11.5 (1814)  253: 13.0 (1565)
         254: 13.2 (1811)  255: 14.3 (1849)  256: 13.6 (1642)
       Mid-rise courtyard / Nobel rings (body clearly above the guess;
       distinct from withheld 704/705 where the dense body already sat
       near the 9 m guess):
         700: 12.3 (2406 pts; 14/36 verts past terrain box — in-box class)
         1358: 16.1 (6175 pts; Nominatim 3535 Lebon; targeted roofOf 17.1)
     Deliberately NOT admitted this pass:
       695: gap 2.9 / dense2 80.7% under the 85% thin-shelf cut — roofOf
            would paste the 11.7 shelf over an ~8.5 body (1364 / 520
            near-miss family). Keep the 4.5 guess.
       294: dense body ≈ the 4.5 guess (mode 4 @41.8%, ±1 81.1%); roofOf
            9.6 rides a thin shelf (gap 4.1 under cut). Keep the guess.
       42:  Truluck's / Aventine commercial — multimodal (dense 40.9%
            @4 / ±1 43.6%, p50 4.8 vs p98 9.6); no single plane. Keep
            the 12 m guess (Hyatt / helipad parts handoff).
       233 / 245 / 246 / 248: centroids past terrain z_max → 0 EPT pts
            (Vaughan / Ritter / 656 apron class); Apple shows finished
            Regents Road apartments today, but no 2014 plane resolves.
            Keep the 12 m guesses. Survey-box handoff. */
  469, 471, 472, 474, 475, 476, 478,
  691, 692, 693, 694, 696,
  310, 336, 277,
  251, 252, 253, 254, 255, 256,
  700, 1358,
  /* r0c0 pass-3 re-sweep 2026-08-05 — residual LJF / Estancia / Black Gold
     unnamed pads after pass-2's 976/328/330/830/871/972/977/493/969
     admissions. Independent full-depth EPT (point counts matched the
     screener exactly: 2,053 / 2,092 / 4,442 / 2,599); Apple currency
     confirmed finished roofs (or amenity for the withhold), no crane:
       496: 2,053 returns, clean p98 9.0 (dense 70% in 7–8 m, gap 1.1)
            — was 4.5 under-guess at 9832 La Jolla Farms Road
            (Nominatim house). Secondary 3 m hist bin is courtyard /
            garage within the ring, not a one-storey body.
       874: 2,092 returns, clean p98 4.6 (dense 77% in 3–4 m, gap 0.7)
            — was 9 over-guess at 9760 Black Gold Road.
       962: 4,442 returns, clean p98 6.3 (bodyTight; dense 60% in 3–4 m
            under the 85% thin-shelf cut, gap 2.3 — do not paste the
            denser ~4 m body over the upper shelf) — was 9 at 9805
            Black Gold Road (Estancia-adjacent).
     Deliberately NOT admitted this pass:
       975: multimodal + canopy-guarded (p50 5.2 / p75 6.8 / p98 12.7,
            dense 42%, gap 5.9). Nominatim reverse → Idlehour Lane
            leisure/pitch (no building address); Apple center is
            Estancia amenity (tennis / putting green / canopy), not a
            clear tall roof. Epoch / identity ambiguous — do not invent
            a 6.8 m plane; keep the 9 m guess.
       513: already withheld pass 1 (bodyTight=false coastal-scrub mix). */
  496, 874, 962,
  /* r2c0 pass-3 re-sweep 2026-08-05 — residual Poole Street unnamed pad
     after pass-2's 1097 / 1147 admissions. Independent full-depth EPT
     (point counts matched the screener exactly: 485 / 512 / 441 control);
     Apple currency confirmed finished Poole Street residential roofs,
     no crane:
       1105: 485 returns, clean p98 6.8 (p50 6.2 / p75 6.5, dense 62.9%
             in the 6 m bin, gap 0.4, bodyTight) — was 4.5 under-guess at
             9521 Poole Street (Nominatim). Strict one-plane filter
             (bodyTight + gap≤2 + dense≥50 + |Δ|≥2) PASSES. Sibling of
             already-admitted 1097 at 9535 Poole (7.6).
     Deliberately NOT admitted this pass:
       1120: body sits above the 4.5 guess (p50 6.7 / p75 7.3 / roofOf
             8.0) but dense only 36.9% in the 7 m bin (±1 69.5%) — no
             single dominant plane to admit (1062 multimodal family).
             Keep the guess rather than invent 8.0 from a 6/7 split.
       Remaining ~100 in-shard unnamed guesses: per-ring Apple+EPT
             handoff, not a blanket admit. */
  1105,
  /* r2c1 pass-3 re-sweep 2026-08-05 — Villa La Jolla east / Morning Way
     apartment connectors + Evening Way pads + Residence Inn residual +
     two La Jolla Scenic / Robinhood over-guesses. Independent full-depth
     EPT re-derived (Residence Inn / Evening Way / 1239 / 1305 / 639 /
     643 point counts matched the screener exactly; denser villa-east
     rings returned more leaf points than the screener's sample but the
     same ~9–10 m bodyTight plane). Apple currency confirmed finished
     multi-unit / hotel / residential roofs + pool/tennis fabric today,
     no crane. Heights below are the build's own rimBase tiling:
       Villa La Jolla east under-tags (was 4.5 shed under a shared ~9–10 m
       2014 plane — Boardwalk 518 / Village Square under-tag class):
         632 / 633 / 635 / 636 / 637 / 638 / 639 / 640 / 642 / 643 /
         645 / 646 / 647 / 648 / 649 / 650 / 651
         Strict one-plane exemplars 642 / 649 / 651 (Nominatim 8746 /
         8720 Villa La Jolla Drive); soft siblings same strip (gap ≤1.1,
         bodyTight) join under the same rule — do not require dense≥50
         single-bin when gap≤2 already returns clean p98.
       Evening Way periphery (was 4.5; Nominatim 3139 Evening Way):
         600 / 601 — clean p98 beside the Residence Inn strip.
       Residence Inn residual connectors beside already-admitted
       548 / 549 / 550 (host lidarH 10.5) — same stepped hist, gap ≤2
       under the thin-shelf cut, bodyTight:
         553 / 554 / 555 / 560 / 561 / 562
       Over-guess residential pads (was 9 area guess):
         1239: clean p98 ~4 (dense2 ≥90% in 2–3 m; Nominatim 8946 La
               Jolla Scenic Drive North). Epoch risk noted (Apple shows
               finished courtyard fabric today) but the 2014 sample is a
               single dominant low plane, not a courtyard-floor smear —
               bodyTight + dense2 ≥0.90. Admit the measured plane.
         1305: clean p98 ~5.3 (bimodal 3/5 ridge hist inside one epoch;
               Nominatim 8835 Robinhood Lane). Apple finished 1–2 storey
               houses with solar; 5.3 matches that reading better than 9.
     Deliberately NOT admitted this pass:
       Remaining ~300 in-shard unnamed guesses: per-ring Apple+EPT
             handoff, not a blanket admit (same scoped residual verdict
             as every prior pass). */
  632, 633, 635, 636, 637, 638, 639, 640, 642, 643,
  645, 646, 647, 648, 649, 650, 651,
  600, 601,
  553, 554, 555, 560, 561, 562,
  1239, 1305,
  /* r2c2 pass-3 re-sweep 2026-08-05 — University Center Lane / Nobel-Lebon
     residual / Lebon-south / Sheraton-strip sibling / Whole Foods pad after
     pass-2's LJVD terrace + Lebon 251–256 admissions. Independent full-depth
     EPT re-derived (point counts matched the screener exactly: 1,643 /
     1,783 / 1,481 / 1,659 / 2,313 / 2,051 / 1,845 / 2,086 / 1,963 / 1,861 /
     1,535 / 1,463 / 1,676 / 1,299 / 0 for OOB 479); Apple currency confirmed
     finished courtyard / residential / hospitality / retail roofs today, no
     crane. Heights below are the build's own rimBase tiling (centroid-probe
     sat the same band; rim vs centroid shifts absolute metres on grade):
       Strict one-plane courtyard (was 9 area guess):
         306: 12.5 (1643 pts; Nominatim University Center Lane /
              Aventine-south pad; centroid-probe roofOf 14.4, dense 86.4%
              @13, gap 0.7).
       Nobel Drive / Lebon Drive residual strip (was 9; dense body clearly
       above — same class as pass-2's 251–256, ≠ withheld 257/258):
         267: 13.5 (1783)  268: 13.0 (1481)  269: 12.8 (1659)
         270: 12.4 (2313)  271: 11.8 (2051)  272: 12.4 (1845)
         273: 12.4 (2086)
         Nominatim 3833 Nobel / 3425 Lebon / 3899 Nobel apartments.
       Lebon Colony south connectors (was 9; Nominatim 3425 Lebon):
         1390: 13.3 (1963)  1391: 13.2 (1861)
         1393: 13.9 (1535)  1394: 11.9 (1463)
       Sheraton-strip one-storey sibling of already-admitted 1365 / 1366:
         1367: 5.2 canopy-guarded (1676 pts, dense 81.9% @5, gap 6.8) —
              Nominatim 3299 Holiday Court; was 9.
       Whole Foods / CVS commercial pad beside already-admitted strip:
         457: 7.1 (1299 pts, dense ±1 95.4% in 5–6 m, gap 0.9) — was 9.
              Neighbours Chick-fil-A / CVS / Whole Foods / osm:81 ship ~7.
     Deliberately NOT admitted this pass:
       1392: gap 2.8 / dense2 63% under the 85% thin-shelf cut — roofOf
             would paste the 15.2 shelf over an ~12 m body (695 / 1364
             near-miss family). Keep the 9 m guess.
       479:  centroid past terrain x grid → 0 EPT pts / groundAt-null
             (Regents / Vaughan apron class). Apple shows finished One
             Miramar terracotta terraces today, but no 2014 plane
             resolves. Keep the 9 m guess. Survey-box handoff.
       Remaining ~40 in-shard unnamed guesses: per-ring Apple+EPT
             handoff, not a blanket admit. */
  306,
  267, 268, 269, 270, 271, 272, 273,
  1390, 1391, 1393, 1394,
  1367, 457,
]);

/* Hand-audited stats where the automatic roofOf() percentile choice is
   demonstrably wrong for a PRE-2014 building (verified against a targeted
   re-sample of the same EPT, 2026-08-03):
   - Tenaya Hall: REMOVED r1c0 re-sweep 2026-08-05. The 2026-08-03 audit
     mistook the rooftop mechanical shelf (p98 27.5, 9% of returns) for a
     tower roof and overrode the tree-guard's p75 = 22.4. Apple shows a
     flat H-plan roof with HVAC plant, not a taller wing; GIS L7 = 21.3
     agrees with the dense 22 m body (49–66% of returns). Pipeline roofOf
     already answers — do not re-add.
   - Mandeville Center: auditorium fly volume p98 20.9; p75 = the gallery
     roofs shipped 10.7.
   - Faculty Club: gable ridge ~6.5 at p90; p98 12.4 is overhanging
     eucalyptus, and the tree-guard's p75 4.6 misses the ridge.
   - Stewart Commons Annex: null — the 16 m stat was LiDAR bleed from the
     Tenaya tower over a 1-storey service sliver.
   - Stage Room at the Pub: the wooden Student Center pub sits UNDER the
     eucalyptus grove; more than a quarter of its returns are crown, so the
     tree-guard's p75 (12.8) is still in the tree. The roof is the dense p50
     band at 4.6 m, and the university GIS agrees (4.3 m, one level).
   - Spanos Athletic Performance Center (r1c0 sweep, 2026-08-04): TWO
     buildings share this OSM name — the 1988 Alex G. Spanos Training
     Facility (south ring, a real 2014 plane: 3,329 returns, p50 4.3 to
     p75 4.4) and the Performance Center itself, which broke ground in
     JUNE 2015 (university record) — the flight predates it, and the
     11-16 m smear over its footprint is the eucalyptus row cleared for
     it, dense enough that no percentile guard can see through it. The
     audited 4.4 is the 1988 building's roof; both structures actually
     render from their own correctly-named GIS masses (4.3 m each), which
     this entry also bars from adopting the eucalyptus number.
   - Qualcomm AA (r1c0 sweep, 2026-08-04): its ring crosses the survey
     AREA's north edge, so the automatic path measures a TRUNCATED
     footprint (23.3 off the interior returns). The full-ring re-sample
     of the same EPT (r0c2, 30,780 returns, one plane) reads 24.3 —
     matching KNOWN_HEIGHTS in build-campus-3d.mjs. A clipped footprint
     is a different quantity, not a worse sample of the same one.
   - Solis Hall (r1c1 judge sweep, 2026-08-04): the lecture hall's east
     edge sits under the eucalyptus stand that both the registered chunk
     and today's Apple show pressed against it. Its returns split 62%
     into a dense 5-6.5 m band and the rest up the crowns to 24.8, so
     the tree-guard's p75 (14.9) is still in canopy — the Stage Room
     failure exactly, and it smeared onto the GIS mass through the
     host-level reconcile. The roof is the dense band's p50, 6.4 m, and
     the university GIS roughly agrees (4.3 m eave, one level).
   - Che Café Collective (r2c1 judge sweep, 2026-08-05): the 1980 wooden
     venue sits INSIDE the eucalyptus grove — Street View shows trunks
     rising through its deck, and today's Apple finds the roof only in
     fragments through the crowns. 48% of its returns sit in a dense
     2-4 m band and the rest climb the trees to 29, so the tree-guard's
     p75 (20.4 on the university's trace) is pure canopy — and it
     smeared onto the 4.3 m eave record through the host-level
     reconcile, extruding a one-storey venue at 20.9. The roof is the
     dense band's p50, 3.8 m; the OSM mapper's own tag says 4.8.
   - Laurel (r2c1 judge sweep, 2026-08-05): the one-storey pad west of
     Villa La Jolla Dr, its east edge under overhanging crowns (Apple,
     2026-08-05). 70% of its returns land in the 4 m bin alone; the
     tail climbs to 16.5, so p75 (9.2) is in the trees — the same
     failure at half the height. The roof is the dense band's p50,
     4.2 m: its unshaded siblings Laurel Extension and Magnolia measure
     4.4 and 4.3 clean, and the record's eave is 4.3.
   r2c0 judge sweep (2026-08-05), the SIO shore. AREA's south edge cuts
   through the Scripps campus at z≈1382, so three pre-2014 buildings
   straddling it measured a TRUNCATED footprint — the Qualcomm AA failure,
   which is a different quantity, not a worse sample. Each value below is
   the full-ring re-sample of the same EPT (2026-08-05):
   - Ritter Hall (1931/1959, unchanged): the in-box subset read 12.5,
     which sat 8.8 m under the university's 21.3 m record and tripped the
     newer heuristic — a 2014 building rendering at a record height its
     own roof contradicts. The full ring reads 14.6 (5,798 returns, p98,
     no guard, body tight); 21.3 over 5 recorded levels was never this
     building's roof.
   - Vaughan Hall: in-box 14.4 off 87% of the ring; the full ring reads
     14.9 (13,623 returns, 49% in one 13 m band).
   - Nigella Hillgarth Education Center (1992, Birch's south pavilions):
     in-box 4.7 off 81% of the ring reads the flat tops only; the full
     ring's p98 of 6.2 is the pitched-pavilion ridges (1,884 returns —
     the 5-7 m tail caps at 7.4, far too low to be the crowns Apple shows
     only at the ring's edge).
   Two more audits in this sweep are canopy/bleed failures, not clipping:
   - Hubbs Hall Confrence Center (sic, OSM's spelling — the low
     conference annex west of Hubbs Hall): its returns are 23% one tight
     3-4 m band (the roof) and the rest a continuous 5-19 m smear off
     Hubbs Hall's overhanging block and the palms between them, so
     roofOf's p98 read 17.9 — and the name ALSO fuzzy-matched the "Hubbs
     Hall" record (17.1 m, four levels) in the storeys map, wearing the
     hall's identity twice over. The roof is the dense band's p50, 4.0 m;
     the two-pass match in build-campus-arcgis.mjs now stops the record
     theft, and this entry stops the smear.
   - T-30 (the 1913-24 Scripps cottage rows): its own ring is clean to
     p90 but the p98 (6.8) rides 27 crown returns from the overhanging
     grove; the dense band's p98 is 5.0 — in family with its measured
     siblings T-29 (3.8), T-31 (4.1) and the record's one-storey 4.3
     eave. The audit also bars the "T-30 Cottage" GIS ring, drawn wide
     into the grove (p98 10.7 — pure canopy), from shipping a mass plane.
   - T-25: its OSM ring measures a clean 4.8 (157 returns, no canopy),
     but the "T-25 Cottage" GIS ring is drawn wide like T-30's and
     shipped a 9 m mass plane off the crowns. The audit pins the roof and
     bars the mass — same failure, one grove.
   - Hyatt Regency La Jolla at Aventine (r2c2 judge sweep, 2026-08-05):
     one OSM ring wraps the hotel tower AND the low podium / circular
     terracotta pavilion / courtyard-adjacent roofs. 11,029 returns are
     bimodal — 49% in a dense 4 m podium band, the rest a tower plane at
     41-52 m — so roofOf's p75 lands ON the tower and pastes 45.1 across
     the whole 92×96 m footprint, lifting the podium ~40 m. Neither
     single extrusion is honest (the Scripps Memorial / Birch gallery
     verdict: a stepped mass with no OSM parts). Null: emit nothing, the
     OSM tag of 16 stands as a stated guess until a parts-level source
     exists.
   A null here means "measured, but not trustworthy: emit nothing". */
const HAND_AUDITED = {
  "Mandeville Center": 20.9,
  "Ida and Cecil Green Faculty Club": 6.5,
  "Stewart Commons Annex": null,
  "Stage Room at the Pub": 4.6,
  "Spanos Athletic Performance Center": 4.4,
  "Qualcomm AA": 24.3,
  "Solis Hall": 6.4,
  "Che Café Collective": 3.8,
  "Laurel": 4.2,
  "Ritter Hall": 14.6,
  "Vaughan Hall": 14.9,
  "Nigella Hillgarth Education Center": 6.2,
  "Hubbs Hall Confrence Center": 4.0,
  "T-30": 5.0,
  "T-25": 4.8,
  "Hyatt Regency La Jolla at Aventine": null,
};

const R = 6378137;
const toX = (lng) => (lng * Math.PI * R) / 180;
const toY = (lat) => R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const toLat = (y) => (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * (180 / Math.PI);
const toLng = (x) => (x / R) * (180 / Math.PI);

const BOX = {
  minx: toX(AREA.west), maxx: toX(AREA.east),
  miny: toY(AREA.south), maxy: toY(AREA.north),
};

/* ------------------------------------------------------------------ octree */

const hierCache = new Map();
async function hierarchy(key) {
  if (hierCache.has(key)) return hierCache.get(key);
  const res = await fetch(`${EPT}/ept-hierarchy/${key}.json`);
  if (!res.ok) throw new Error(`hierarchy ${key}: ${res.status}`);
  const json = await res.json();
  hierCache.set(key, json);
  return json;
}

/** Every populated octree node whose cube overlaps the area, at every depth. */
async function findTiles(bounds) {
  const size = bounds[3] - bounds[0];
  const nodeBox = (d, x, y) => {
    const s = size / 2 ** d;
    return {
      minx: bounds[0] + x * s, maxx: bounds[0] + (x + 1) * s,
      miny: bounds[1] + y * s, maxy: bounds[1] + (y + 1) * s,
    };
  };
  const overlaps = (a) =>
    !(a.maxx < BOX.minx || a.minx > BOX.maxx || a.maxy < BOX.miny || a.miny > BOX.maxy);

  const found = [];
  const walk = async (rootKey) => {
    const node = await hierarchy(rootKey);
    for (const [key, count] of Object.entries(node)) {
      const [d, x, y] = key.split("-").map(Number);
      if (!overlaps(nodeBox(d, x, y))) continue;
      // -1 means "this subtree continues in its own hierarchy file".
      if (count === -1) await walk(key);
      else if (count > 0) found.push(key);
    }
  };
  await walk("0-0-0-0");
  return found;
}

/* ------------------------------------------------------------------- LAZ */

/* The LAS public header block. laz-perf decodes point RECORDS but hands back
   raw scaled integers, so the scale and offset that turn them into real
   coordinates have to be read out of the header here. Offsets per the LAS 1.2+
   spec; classification moved from byte 15 to byte 16 in point formats 6+. */
function lasHeader(view) {
  return {
    format: view.getUint8(104),
    scale: [view.getFloat64(131, true), view.getFloat64(139, true), view.getFloat64(147, true)],
    offset: [view.getFloat64(155, true), view.getFloat64(163, true), view.getFloat64(171, true)],
  };
}

async function readTile(laz, key) {
  const res = await fetch(`${EPT}/ept-data/${key}.laz`);
  if (!res.ok) throw new Error(`tile ${key}: ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const head = lasHeader(new DataView(bytes.buffer));

  const filePtr = laz._malloc(bytes.byteLength);
  laz.HEAPU8.set(bytes, filePtr);
  const reader = new laz.LASZip();
  reader.open(filePtr, bytes.byteLength);

  const count = reader.getCount();
  const pointLength = reader.getPointLength();
  const classOffset = reader.getPointFormat() >= 6 ? 16 : 15;
  const pointPtr = laz._malloc(pointLength);

  const out = [];
  for (let i = 0; i < count; i++) {
    reader.getPoint(pointPtr);
    const p = new DataView(laz.HEAPU8.buffer, pointPtr, pointLength);
    const x = p.getInt32(0, true) * head.scale[0] + head.offset[0];
    const y = p.getInt32(4, true) * head.scale[1] + head.offset[1];
    if (x < BOX.minx || x > BOX.maxx || y < BOX.miny || y > BOX.maxy) continue;
    const z = p.getInt32(8, true) * head.scale[2] + head.offset[2];
    let cls = p.getUint8(classOffset);
    if (head.format < 6) cls &= 0x1f; // pre-1.4 packs flags into the top bits
    out.push([x, y, z, cls]);
  }

  reader.delete();
  laz._free(filePtr);
  laz._free(pointPtr);
  return out;
}

/* --------------------------------------------------------------- geometry */

const GROUND = 2;

function percentile(values, q) {
  if (!values.length) return null;
  const sorted = Float64Array.from(values).sort();
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
}

function pointInRing(px, py, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/* ------------------------------------------------------------------ build */

async function build() {
  const campus = JSON.parse(readFileSync(IN, "utf8"));
  const O = campus.origin;
  // local metres (the renderer's frame) <-> web mercator (the LiDAR's frame)
  const localToMerc = (x, z) => [toX(O.lng + x / O.mPerDegLng), toY(O.lat - z / O.mPerDegLat)];
  const mercToLocal = (mx, my) => [
    (toLng(mx) - O.lng) * O.mPerDegLng,
    -(toLat(my) - O.lat) * O.mPerDegLat,
  ];

  console.log("locating LiDAR tiles…");
  const ept = await (await fetch(`${EPT}/ept.json`)).json();
  const tiles = await findTiles(ept.bounds);
  console.log(`  ${tiles.length} tiles overlap the area`);

  const { createLazPerf } = require("laz-perf");
  const laz = await createLazPerf();

  /* ---- terrain frame first: every point STREAMS into it ----
     The full campus is ~50 million returns. The corridor-era version held
     every point in one array and filtered it twice; at this scale that is
     gigabytes of JS arrays and an OOM at the end of a half-hour download.
     Nothing here actually needs the points twice — ground returns fold into
     the grid, above-ground returns fold into per-footprint roof lists and a
     per-cell canopy maximum, and the point is forgotten. */
  const corners = [
    mercToLocal(BOX.minx, BOX.miny), mercToLocal(BOX.maxx, BOX.miny),
    mercToLocal(BOX.minx, BOX.maxy), mercToLocal(BOX.maxx, BOX.maxy),
  ];
  const x0 = Math.floor(Math.min(...corners.map((c) => c[0])));
  const x1 = Math.ceil(Math.max(...corners.map((c) => c[0])));
  const z0 = Math.floor(Math.min(...corners.map((c) => c[1])));
  const z1 = Math.ceil(Math.max(...corners.map((c) => c[1])));
  const cols = Math.ceil((x1 - x0) / TERRAIN_CELL) + 1;
  const rows = Math.ceil((z1 - z0) / TERRAIN_CELL) + 1;

  const sum = new Float64Array(cols * rows);
  const hits = new Uint32Array(cols * rows);

  /* Measurement targets — every footprint AND every part of a multi-mass
     building — spatially hashed so each return tests only nearby rings. */
  const targets = [];
  const hostByIndex = new Map();
  const addTarget = (ringLocal, key, name) => {
    const ring = ringLocal.map(([x, z]) => localToMerc(x, z));
    const xs = ring.map((p) => p[0]);
    const ys = ring.map((p) => p[1]);
    const bb = {
      minx: Math.min(...xs), maxx: Math.max(...xs),
      miny: Math.min(...ys), maxy: Math.max(...ys),
    };
    /* Disjoint test, all four sides. The north clause read `bb.maxy >
       BOX.maxy` from 2026-08-03 until the r1c0 sweep caught it — that
       rejects any ring POKING past the north edge instead of rings lying
       entirely beyond it, and it is why Torrey Pines Center South (whose
       OSM ring reaches 22 m past AREA.north) silently lost its 12.2 m
       measurement on every rebuild after the 2026-08-04 Overpass refresh
       moved its ring, and why Qualcomm AA needed a KNOWN_HEIGHTS
       workaround instead of measuring like everything else. A ring that
       overlaps the box measures from the returns inside it. */
    if (bb.maxx < BOX.minx || bb.minx > BOX.maxx || bb.maxy < BOX.miny || bb.miny > BOX.maxy) return null;
    const t = { key, name, ring, bb, roofs: [] };
    targets.push(t);
    return t;
  };
  campus.buildings.forEach((b, bi) => {
    const host = addTarget(b.p, `b${bi}`, b.n || null);
    if (host) { host.isHost = true; host.bi = bi; hostByIndex.set(bi, host); }
    (b.parts || []).forEach((part, pi) => {
      const t = addTarget(part.p, `${bi}/${pi}`, null);
      if (t) t.bi = bi;
    });
  });

  /* The university's massing parts are targets too, measured the way OSM
     parts are, so a mass inside a multi-height building ships ITS roof and
     not its host's. The Urey Hall Office Addition stood at the tower's
     30.5 m, the Natatorium at the Main Gym's 14.9, W. M. Keck at Biomedical
     Sciences' 24.1 — the same per-sample-quantity-resolved-once bug the
     RIMAC coverage metric had, this time over height. Keys are the geometry
     hashes campus-massing.js / build-campus-truecolor.mjs already use
     (`m:` + outer-ring vertex-average centroid, local metres, rounded), so
     the lookup survives an arcgis rebuild by falling back rather than
     mismatching. Epoch rule applies through the HOST: a mass standing in a
     POST_2014_SITES footprint gets nothing, ever; a hand-audited host keeps
     its audited value rather than a per-mass number the same misread would
     poison. */
  const arcgisData = (() => {
    try { return JSON.parse(readFileSync(path.join(REPO_ROOT, "docs/data/campus-arcgis.json"), "utf8")); } catch { return null; }
  })();
  const namedLocalRings = campus.buildings.filter((b) => b.n).map((b) => ({ n: b.n, p: b.p, bi: campus.buildings.indexOf(b) }));
  const inLocalRing = (x, z, ring) => {
    let ins = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, zi] = ring[i];
      const [xj, zj] = ring[j];
      if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
    }
    return ins;
  };
  /* A mass whose centroid falls OUTSIDE every named OSM ring still needs the
     epoch check answered before it can be measured — and for nine masses the
     GIS's own name answers it: it matches a shipped OSM building name
     exactly, so the same POST_2014/HAND_AUDITED guards key on it. Without
     this, the Sanford Consortium's low east pavilion wore the facility
     record's 17.1 m (its own 2014 roof plane: 6.2 m) purely because the GIS
     ring's centroid misses the OSM outline. The name must match EXACTLY and
     the OSM twin must stand within 150 m — a reused name across campus must
     never smuggle the wrong epoch verdict in. Masses with neither a host nor
     a matching name stay unchallenged, as before: with no name there is no
     way to know the site's build date, and a 2014 return off a newer
     building's predecessor is the exact lie the epoch rule exists to stop. */
  /* All rings per name, not a Map that keeps only the last: a duplicate OSM
     name must resolve to the NEARBY twin, not to whichever ring the loader
     happened to visit last (the same collision the heights emission fixes). */
  const namedByName = new Map();
  for (const b of namedLocalRings) {
    let x = 0, z = 0;
    for (const p of b.p) { x += p[0]; z += p[1]; }
    if (!namedByName.has(b.n)) namedByName.set(b.n, []);
    namedByName.get(b.n).push({ ...b, c: [x / b.p.length, z / b.p.length] });
  }
  const massTargets = [];
  for (const m of arcgisData?.massing || []) {
    const ring = m.r[0].map(([x, z]) => [x / 10, z / 10]);
    let cx = 0, cz = 0;
    for (const p of ring) { cx += p[0]; cz += p[1]; }
    cx /= ring.length; cz /= ring.length;
    const host = namedLocalRings.find((b) => inLocalRing(cx, cz, b.p));
    let hostName = host?.n ?? null;
    let hostBi = host?.bi ?? null;
    if (!hostName) {
      /* Exact twin first; then case-insensitive (r1c2 re-sweep, 2026-08-05).
         One Miramar Building 3/4 wear "Building N" in GIS and "building N"
         in OSM — the exact map missed them, massHeights never emitted, and
         the L5 storey default (15.2) shipped over a measured 13.1 plane. */
      let twin = (namedByName.get(m.n) || [])
        .find((b) => Math.hypot(b.c[0] - cx, b.c[1] - cz) < 150);
      if (!twin) {
        const want = m.n.toLowerCase();
        for (const [n, rings] of namedByName) {
          if (n.toLowerCase() !== want) continue;
          twin = rings.find((b) => Math.hypot(b.c[0] - cx, b.c[1] - cz) < 150);
          if (twin) break;
        }
      }
      if (twin) { hostName = twin.n; hostBi = twin.bi; }
    }
    /* epoch answered by the hand-verified build date instead of a host */
    if (!hostName && PRE_2014_GIS_VERIFIED.has(m.n)) hostName = m.n;
    if (!hostName) continue; // no named host: today's GIS value stands unchallenged
    if (POST_2014_SITES.has(hostName)) continue; // the flight predates the building
    if (hostBi !== null && POST_2014_OSM_RINGS.has(hostBi)) continue; // per-ring epoch answer
    if (hostName in HAND_AUDITED) continue; // the audited value already answers
    const t = addTarget(ring, `m:${Math.round(cx)},${Math.round(cz)}`, null);
    if (t) {
      t.isMass = true;
      t.bi = hostBi ?? -1;
      const minus = MEASURE_MINUS_CONTAINED[m.n];
      if (minus) {
        t.exclude = (arcgisData.massing || [])
          .filter((o) => o !== m && minus.includes(o.n))
          .map((o) => o.r[0].map(([x, z]) => localToMerc(x / 10, z / 10)));
      }
      massTargets.push(t);
    }
  }
  /* Host targets carrying a minus-contained correction: subtract the listed
     GIS rings from the OSM outline's returns so the outline measures the
     part of the building it alone describes (see the map's comment). The
     fold()'s generic exclude test does the rest. */
  for (const t of targets) {
    if (!t.isHost || !t.name || !(t.name in MEASURE_MINUS_CONTAINED_HOSTS)) continue;
    const minus = MEASURE_MINUS_CONTAINED_HOSTS[t.name];
    const rings = (arcgisData?.massing || [])
      .filter((m) => minus.includes(m.n))
      .map((m) => m.r[0].map(([x, z]) => localToMerc(x / 10, z / 10)));
    if (rings.length) t.exclude = rings;
  }
  const HCELL = 60; // mercator metres per hash cell
  const hcell = new Map();
  for (const t of targets) {
    for (let hx = Math.floor(t.bb.minx / HCELL); hx <= Math.floor(t.bb.maxx / HCELL); hx++) {
      for (let hy = Math.floor(t.bb.miny / HCELL); hy <= Math.floor(t.bb.maxy / HCELL); hy++) {
        const k = `${hx}:${hy}`;
        if (!hcell.has(k)) hcell.set(k, []);
        hcell.get(k).push(t);
      }
    }
  }

  /* Canopy: the highest above-ground return per 3 m cell, as ABSOLUTE
     elevation — ground is only knowable after the whole grid exists. */
  const canopyMax = new Map();

  let groundN = 0;
  let aboveN = 0;
  const fold = (pts) => {
    for (const p of pts) {
      if (p[3] === GROUND) {
        groundN++;
        const [lx, lz] = mercToLocal(p[0], p[1]);
        const c = Math.round((lx - x0) / TERRAIN_CELL);
        const r = Math.round((lz - z0) / TERRAIN_CELL);
        if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
        sum[r * cols + c] += p[2];
        hits[r * cols + c]++;
      } else {
        aboveN++;
        const bucket = hcell.get(`${Math.floor(p[0] / HCELL)}:${Math.floor(p[1] / HCELL)}`);
        if (bucket) {
          for (const t of bucket) {
            if (p[0] < t.bb.minx || p[0] > t.bb.maxx || p[1] < t.bb.miny || p[1] > t.bb.maxy) continue;
            if (!pointInRing(p[0], p[1], t.ring)) continue;
            if (t.exclude && t.exclude.some((r) => pointInRing(p[0], p[1], r))) continue;
            t.roofs.push(p[2]);
          }
        }
        const [lx, lz] = mercToLocal(p[0], p[1]);
        const k = `${Math.round(lx / TERRAIN_CELL)}:${Math.round(lz / TERRAIN_CELL)}`;
        const prev = canopyMax.get(k);
        if (!prev || p[2] > prev.zmax) canopyMax.set(k, { x: lx, z: lz, zmax: p[2] });
      }
    }
  };

  /* Six tiles in flight: the fetch dominates and parallelises; the decode is
     synchronous WASM with no await inside it, so decodes cannot interleave. */
  let cursor = 0;
  let done = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (cursor < tiles.length) {
      const key = tiles[cursor++];
      fold(await readTile(laz, key));
      if (++done % 25 === 0) process.stdout.write(`  ${done}/${tiles.length} tiles\r`);
    }
  }));
  console.log(`  ${groundN.toLocaleString()} ground, ${aboveN.toLocaleString()} above-ground          `);

  const grid = new Float64Array(cols * rows).fill(NaN);
  for (let i = 0; i < grid.length; i++) if (hits[i]) grid[i] = sum[i] / hits[i];
  fillHoles(grid, cols, rows);

  /* Datum: the median ground height, so the renderer works near y=0 rather
     than 130 m up, where float precision starts to matter. */
  const datum = Math.round(percentile([...grid].filter(Number.isFinite), 0.5) * 10) / 10;

  /* ---- heights: measured, per footprint and per part ---- */
  const groundAt = (lx, lz) => {
    const c = Math.round((lx - x0) / TERRAIN_CELL);
    const r = Math.round((lz - z0) / TERRAIN_CELL);
    if (c < 0 || c >= cols || r < 0 || r >= rows) return null;
    const v = grid[r * cols + c];
    return Number.isFinite(v) ? v : null;
  };

  /* Grade is read around the PERIMETER, never under the roof. The laser
     cannot see ground beneath a building, so the cell under the centroid is
     hole-fill — an average of whatever surrounds the footprint, which beside
     a canyon is the canyon. Geisel measured "40.3 m" exactly this way: its
     real roof minus a grade 14 m below its real forecourt, borrowed from the
     ravine to its north. */
  const rimBase = (ring) => {
    const rim = [];
    for (const [mx, my] of ring) {
      const [lx, lz] = mercToLocal(mx, my);
      const g = groundAt(lx, lz);
      if (g !== null) rim.push(g);
    }
    return rim.length ? percentile(rim, 0.5) : null;
  };

  /* 98th percentile, not max: a single bird should not add three metres.
     BUT a roof is a PLANE and a tree is a TAIL — when a eucalyptus overhangs
     a low building the returns split into a dense band at the real roof and
     a sparse tail up the crown, and the 98th lands in the tree (the
     one-storey wooden Student Center "measured" 23.5 m this way). When the
     75th and 98th disagree by more than a storey and a half, the roof plane
     is the honest answer.

     A third shape the 5 m guard misses (r0c1 / r0c2 / r1c0 re-sweeps): a
     tight dense body under a THIN upper shelf whose gap sits under the
     canopy threshold. Prefer p75 when the body is tight, the shelf is more
     than half a storey (~2 m) above it, AND a dense 2 m band holds ≥85% of
     returns. Shared by host heights (OSM unnamed thin-shelf admissions)
     and massHeights. */
  const denseBandFraction = (roofs, base) => {
    const hist = new Map();
    for (const z of roofs) {
      const bin = Math.floor(z - base);
      hist.set(bin, (hist.get(bin) || 0) + 1);
    }
    const keys = [...hist.keys()].sort((a, b) => a - b);
    let best = 0;
    for (let i = 0; i < keys.length; i++) {
      let n = 0;
      for (let j = i; j < keys.length && keys[j] - keys[i] <= 1; j++) {
        n += hist.get(keys[j]);
        if (n > best) best = n;
      }
    }
    return best / roofs.length;
  };
  const roofOf = (roofs, base = null) => {
    const p50 = percentile(roofs, 0.5);
    const p75 = percentile(roofs, 0.75);
    const p98 = percentile(roofs, 0.98);
    if (p98 - p75 > 5) return p75;
    if (
      base !== null &&
      p75 - p50 <= 2 &&
      p98 - p75 > 2 &&
      denseBandFraction(roofs, base) >= 0.85
    ) {
      return p75; // thin shelf over a dense body
    }
    return p98;
  };

  const heights = {};
  const partHeights = {};
  const osmHeights = {};
  const measured = [];
  const baseByBuilding = new Map();
  /* OSM names are not unique. Nine names on this campus belong to two rings
     each (both halves of Earth Hall and of the Salk Institute, paired
     greenhouses, the two Spinal Cord Injury Buildings…), and a name-keyed
     heights entry is then a last-writer-wins race: whichever ring the loop
     visits second overwrites the first. Both SCI footprints shipped the
     southern ring's 6.4 m — the plane of a mostly-empty post-2014 site —
     while the 1990s building at osm:223 measures 17.2 (r1c2 judge sweep,
     2026-08-04). A collided name emits per ring INDEX instead, and the
     renderer prefers the index. HAND_AUDITED stays name-level ON PURPOSE:
     its one collided entry (Spanos) is an audit of the shared name's whole
     situation, written knowing both rings. */
  const dupNames = new Map();
  for (const b of campus.buildings) if (b.n) dupNames.set(b.n, (dupNames.get(b.n) || 0) + 1);
  for (const t of targets) {
    if (!t.isHost) continue;
    /* Too few returns to trust — a narrow building under tree cover,
       usually. Left out entirely so the renderer keeps its OSM value rather
       than adopting a number derived from nine points. */
    if (t.roofs.length < 25) continue;
    const base = rimBase(t.ring);
    if (base === null) continue;
    baseByBuilding.set(t.bi, base);
    const h = Math.round((roofOf(t.roofs, base) - base) * 10) / 10;
    /* Cap raised from 70: Sankofa, the Eighth College tower, really is ~80 m
       and the old cap silently dropped the tallest building on campus. */
    if (h < 2 || h > 90) continue;
    measured.push({ n: t.name, h, pts: t.roofs.length });
    if (!t.name) {
      const bi = Number(t.key.slice(1));
      if (POST_2014_OSM_RINGS.has(bi)) continue; // the flight predates the building
      if (OSM_UNNAMED_VERIFIED.has(bi)) osmHeights[bi] = h;
      continue;
    }
    if (POST_2014_SITES.has(t.name)) continue; // building postdates the flight
    if (t.name in HAND_AUDITED) {
      if (HAND_AUDITED[t.name] !== null) heights[t.name] = HAND_AUDITED[t.name];
      continue;
    }
    if ((dupNames.get(t.name) || 0) > 1) {
      if (POST_2014_OSM_RINGS.has(t.bi)) continue; // per-ring epoch: the shared name cannot answer
      osmHeights[t.bi] = h;
      continue;
    }
    heights[t.name] = h;
  }
  /* Parts share their host's grade — a tower wing and its podium stand on
     the same ground even when the wing's own perimeter is all rooftop. */
  for (const t of targets) {
    if (t.isHost || t.isMass || t.roofs.length < 12) continue;
    const hostName = campus.buildings[t.bi]?.n;
    if (hostName && POST_2014_SITES.has(hostName)) continue; // same epoch rule
    if (POST_2014_OSM_RINGS.has(t.bi)) continue; // same rule, per-ring form
    /* An UNNAMED host has no name to look up in POST_2014_SITES, so its
       parts answer the epoch question the way its slab does: through the
       per-index verification. Without this, Anderson Medical Pavilion
       (unnamed osm:835, opened 2016) shipped a 4.1 m part — the 2014
       flight's return off a construction site, worn as a finished roof. */
    if (!hostName && !OSM_UNNAMED_VERIFIED.has(t.bi)) continue;
    const base = baseByBuilding.get(t.bi) ?? rimBase(t.ring);
    if (base === null) continue;
    const h = Math.round((roofOf(t.roofs, base) - base) * 10) / 10;
    if (h < 2 || h > 90) continue;
    partHeights[t.key] = h;
  }
  /* University massing parts, same treatment (epoch and hand-audit hosts were
     already excluded when the target was made). 25-return floor as for hosts:
     a mass sliver measured off nine points is a guess wearing a number.
     Base is the mass's OWN rim, not its host's: the terrain grid is ground
     returns only (hole-filled under roofs, never rooftop), so a mass rim is
     always a sane local grade — while a host-wide median smears a complex's
     slope onto every mass in it. Eckart Building drops 15.6 m across its SIO
     bluff site and its host median sits 7.6 m above the mass's own grade;
     Tuolumne's T House East gained 2.6 m the same way.

     Unlike hosts, a mass only gets a height when its roof reads as ONE plane.
     roofOf's canopy guard (p98−p75 > 5) fires on two very different shapes:
     a tight low roof under a tall neighbour's edge returns (Medical Teaching
     Facility's 8.3 m wing beside its 19.7 m block — p75 is the roof, keep it)
     and a genuinely stepped slab with no plane anywhere near p75 (Urey Hall's
     main mass: half its returns on ~16 m steps, crown at 30.4 — p75 lands at
     25.4 m, a roof that does not exist). The discriminator is the body: if
     p75−p50 ≤ 2 m the fallback sits on a real plane; if the body is smeared
     wider, emit nothing and let the host-level reconcile answer instead.

     Thin-shelf under the 5 m guard: same denseBandFraction / gap > 2 /
     bodyTight cut as host roofOf (Asante Meeting Rooms, CSC Building H,
     CSC Building C, Seventh College East #6 — dense ≥88% matching GIS,
     p98 rides a thin mechanical / shelf Apple shows today). Otterson (74%),
     Copley (79%), and Marshall Residence Hall N (82%) stay on p98 —
     real upper volumes / near-misses under the 85% floor. CSC Building D
     (gap exactly 2.0) and Transit Operations Trailer (gap 0.9) stay on
     p98 — under the >2 cut. */
  const massHeights = {};
  for (const t of massTargets) {
    if (t.roofs.length < 25) continue;
    const base = rimBase(t.ring);
    if (base === null) continue;
    const p50 = percentile(t.roofs, 0.5);
    const p75 = percentile(t.roofs, 0.75);
    const p98 = percentile(t.roofs, 0.98);
    let roof;
    if (p98 - p75 > 5) {
      if (p75 - p50 > 2) continue; // stepped slab: no single plane to report
      roof = p75;
    } else if (
      p75 - p50 <= 2 &&
      p98 - p75 > 2 &&
      denseBandFraction(t.roofs, base) >= 0.85
    ) {
      roof = p75; // thin shelf over a dense body — Stage Room class under 5 m
    } else {
      roof = p98;
    }
    const h = Math.round((roof - base) * 10) / 10;
    if (h < 2 || h > 90) continue;
    massHeights[t.key] = h;
  }

  /* ---- trees: canopy maxima that stand outside every footprint ---- */
  const canopy = [];
  for (const { x: lx, z: lz, zmax } of canopyMax.values()) {
    const g = groundAt(lx, lz);
    if (g === null) continue;
    const h = zmax - g;
    if (h < TREE_MIN_HEIGHT || h > 40) continue;
    const [mx, my] = localToMerc(lx, lz);
    const bucket = hcell.get(`${Math.floor(mx / HCELL)}:${Math.floor(my / HCELL)}`);
    if (bucket && bucket.some((t) => t.isHost && pointInRing(mx, my, t.ring))) continue;
    canopy.push({ x: lx, z: lz, h });
  }
  /* 2014 canopies pruned against TODAY's campus (shared rules with
     scripts/prune-trees.mjs and the tests): no trunk in a current footprint,
     on a sports pad or in a fountain, heights clamped to believable maxima.
     The imagery ghost-check (pass 2) needs sharp — run scripts/prune-trees.mjs
     after this build to apply it. */
  const loadData = (f) => {
    try { return JSON.parse(readFileSync(path.join(REPO_ROOT, "docs/data", f))); } catch { return null; }
  };
  const zones = treeExclusionZones({
    campus3d: loadData("campus-3d.json"),
    arcgis: loadData("campus-arcgis.json"),
    markings: loadData("campus-markings.json"),
  });
  /* Prune the coordinates we SHIP. The file rounds trunks to 0.1 m, and
     rounding after the prune used to carry a wall-hugging trunk across a
     footprint edge the full-precision prune had cleared — 13 trees stood
     "inside" buildings in the 2026-08-05 rebuild, every one within 5 cm
     of its wall. Round first; then what the prune clears is exactly what
     the file says. */
  const pruned = pruneTrees(
    clusterCanopy(canopy).map((t) => [
      Math.round(t.x * 10) / 10,
      Math.round(t.z * 10) / 10,
      t.h,
      t.r,
    ]),
    zones,
  );
  console.log(`  tree prune: ${pruned.dropped.length} dropped against today's zones`);
  const trees = pruned.kept.map(([x, z, h, r]) => ({ x, z, h, r }));

  /* ------------------------------------------------------- measured overrides
     The thin-shelf cut is a threshold, and a threshold cannot see a photograph.
     Several roofs sit close enough to the cut that whether it fires is decided
     by evidence the laser does not carry — whether Apple shows real HVAC plant
     up there, or bare roof with a survey artefact above it. Agents adjudicated
     those cases one at a time and were RIGHT to; the mistake was recording the
     verdict by hand-editing this builder's OUTPUT, so the shipped file drifted
     away from the code that claims to generate it and no gate could see the gap.
     Thirty-one values had diverged by 2026-08-05, up to 3.8 m.

     A judgement the measurement cannot make is legitimate. It just has to be
     DECLARED — here, with its evidence — so it survives a rebuild, shows up in
     review, and can be argued with. An override with no reason is a bug. */
  const MEASURED_OVERRIDES = {
    heights: {
      "Union Bank": [8, "79.9% of returns in the 5-6 m band sits UNDER the 85% thin-shelf cut, gap 2.7 — an IGPP/Perlman near-miss. Apple shows HVAC plant on the finished roof, so pasting the dense 5.3 body would flatten a real shelf. Judged r2c0 pass-3."],
    },
    massHeights: {
      "m:1069,-637": [6.5, "CSC Building D. GIS claims 4.3; the roofOf shelf is a near-miss the cut catches but Apple shows standing plant. Judged r0c1 pass-2."],
      "m:1078,-476": [6.5, "CES. Same near-miss class as CSC-D, same verdict — keeps its roofOf. Judged r0c2 pass-2."],
    },
    osmHeights: {
      453: [19.9, "Hand-verified standing unchanged on Apple (2026-08-04) with a TARGETED EPT probe returning 19.9. The full campus build resolves 16.2 for the same ring off the same LiDAR — a 3.7 m probe-vs-build disagreement that is NOT rounding and is NOT yet explained. Pinned to the probe because the probe looked at this roof specifically; flagged as the open question in gauntlet-loop/REAUDIT.md."],
      518: [8.5, "Boardwalk/Villa La Jolla connector, hand-verified on Apple 2026-08-04. Build resolves 9.2. Same probe-vs-build class as osm:453, smaller gap."],
      657: [11.2, "Hand-verified plane, 2026-08-04. Build resolves 10.9. Same class."],
      1147: [6.5, "Hand-verified plane, 2026-08-04. Build resolves 6.2. Same class."],
      /* The Boardwalk / Villa La Jolla connector strip (518-534) was verified as
         one event on 2026-08-04 — full-depth EPT re-derive, point counts matched,
         Apple confirming finished tan gabled roofs. The build disagrees with that
         probe on five of the nine. The split below is by SIZE, not by building:
         >=0.2 m is a genuine probe-vs-build disagreement and is declared here;
         0.1 m is a rim-median rounding knife edge (519, 530) where the plane did
         not move and the reproducible value wins. */
      526: [8.9, "Connector strip, hand-verified 2026-08-04. Build resolves 9.1."],
      532: [8.5, "Connector strip, hand-verified 2026-08-04. Build resolves 8.7."],
      534: [8.7, "Connector strip, hand-verified 2026-08-04. Build resolves 9.0."],
      522: [8.8, "Boardwalk/Villa La Jolla apartment connector, hand-verified on Apple 2026-08-04 with its siblings 518/519/524/526 on the same ~8.5 m connector plane. Build resolves 10.6 — the only one of the set the build pushes UP, which is why it reads as probe-vs-build rather than a real step."],
      1373: [9.3, "Villas Mallorca / La Jolla Scenic pad: 5,567 pts, clean p98 9.3 by targeted probe (replacing a 12 m guess). Build resolves 8.8. Same probe-vs-build class as osm:453/657."],
    },
  };

  const applied = [];
  for (const [table, entries] of Object.entries(MEASURED_OVERRIDES)) {
    const target = { heights, massHeights, osmHeights }[table];
    for (const [key, [value, reason]] of Object.entries(entries)) {
      if (!reason) throw new Error(`override ${table}[${key}] has no reason — refusing to ship a bare number`);
      const measured = target[key];
      if (measured === value) continue; // the rule caught up; the override is dead weight
      applied.push(`${table}[${key}] ${measured ?? "—"} -> ${value}`);
      target[key] = value;
    }
  }
  if (applied.length) console.log(`  ${applied.length} declared override(s): ${applied.join(", ")}`);

  const out = {
    _: "Generated by scripts/build-campus-lidar.mjs from USGS 3DEP LiDAR (CA_SanDiegoQL2_2014, public domain). Do not hand-edit.",
    area: AREA,
    datum,
    terrain: {
      x0, z0, cell: TERRAIN_CELL, cols, rows,
      // decimetres relative to the datum, as integers — a third the size of
      // the same numbers written as floats, and precise to 10 cm.
      z: Array.from(grid, (v) => (Number.isFinite(v) ? Math.round((v - datum) * 10) : 0)),
    },
    heights,
    partHeights,
    massHeights,
    osmHeights,
    trees: trees.map((t) => [
      Math.round(t.x * 10) / 10,
      Math.round(t.z * 10) / 10,
      Math.round(t.h * 10) / 10,
      Math.round(t.r * 10) / 10,
    ]),
  };

  if (VERIFY) return verifyAgainstShipped(out);

  writeFileSync(OUT, JSON.stringify(out));
  const kb = Math.round(readFileSync(OUT).length / 1024);
  measured.sort((a, b) => b.h - a.h);
  console.log(`\nwrote ${OUT} — ${kb} KB`);
  console.log(`  datum ${datum} m · terrain ${cols}×${rows} @ ${TERRAIN_CELL} m`);
  console.log(`  ${Object.keys(heights).length} named buildings measured, ${Object.keys(massHeights).length} massing parts, ${trees.length} trees`);
  console.log(`  tallest: ${measured.slice(0, 5).map((m) => `${m.n} ${m.h}m`).join(", ")}`);
}

/* Nearest-neighbour hole fill. Ground returns are missing under buildings and
   dense canopy, and a NaN in the terrain grid becomes a hole you fall through.
   Iterative dilation rather than a proper interpolation because the gaps are
   small and the surface is nearly flat across them. */
function fillHoles(grid, cols, rows) {
  for (let pass = 0; pass < 64; pass++) {
    let filled = 0;
    const copy = Float64Array.from(grid);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (Number.isFinite(copy[i])) continue;
        let total = 0;
        let n = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const rr = r + dr;
            const cc = c + dc;
            if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) continue;
            const v = copy[rr * cols + cc];
            if (Number.isFinite(v)) { total += v; n++; }
          }
        }
        if (n) { grid[i] = total / n; filled++; }
      }
    }
    if (!filled) break;
  }
  // Anything still empty sits outside every ground return; flatten it.
  const fallback = percentile([...grid].filter(Number.isFinite), 0.5) ?? 0;
  for (let i = 0; i < grid.length; i++) if (!Number.isFinite(grid[i])) grid[i] = fallback;
}

/* Individual trees, by local maxima of the canopy height.
 *
 * The obvious approach — flood-fill the connected canopy and call each blob a
 * tree — is wrong here, and wrong in a way that looks absurd rather than
 * subtle. Campus vegetation is mostly continuous: the eucalyptus along Ridge
 * Walk touch crowns the whole way, so flood fill returned ONE tree with a
 * 47 metre crown, a green sphere the size of a stadium sitting over the path.
 * A row of trees that touch is still a row of trees.
 *
 * So a treetop is a cell that is the highest thing within TREE_SEPARATION of
 * itself, which is how individual tree detection is normally done on a canopy
 * height model. The crown is then sized from the distance to its neighbours,
 * so trees in a dense row get tight crowns and a lone tree on the plaza gets a
 * broad one. */
const TREE_SEPARATION = 6;   // metres; closer than this and it is one canopy
const MAX_CROWN = 8;         // no crown on this campus is wider than ~16 m

function clusterCanopy(cells) {
  const byKey = new Map();
  const key = (x, z) => `${Math.round(x / TERRAIN_CELL)}:${Math.round(z / TERRAIN_CELL)}`;
  for (const c of cells) byKey.set(key(c.x, c.z), c);

  const reach = Math.ceil(TREE_SEPARATION / TERRAIN_CELL);
  const tops = [];
  for (const [k, cell] of byKey) {
    const [gx, gz] = k.split(":").map(Number);
    let isTop = true;
    let supporters = 0;
    for (let dx = -reach; dx <= reach && isTop; dx++) {
      for (let dz = -reach; dz <= reach; dz++) {
        if (!dx && !dz) continue;
        const other = byKey.get(`${gx + dx}:${gz + dz}`);
        if (!other) continue;
        supporters++;
        /* Ties broken by key order so two equal cells cannot both win and
           produce a double trunk. */
        if (other.h > cell.h || (other.h === cell.h && `${gx + dx}:${gz + dz}` < k)) {
          isTop = false;
          break;
        }
      }
    }
    // A lone cell with nothing around it is more often a lamp post or a sign.
    if (isTop && supporters >= 1) tops.push(cell);
  }

  /* Crown radius from the gap to the nearest other treetop — half of it, so
     neighbouring crowns meet rather than interpenetrate. */
  return tops.map((t) => {
    let nearest = Infinity;
    for (const o of tops) {
      if (o === t) continue;
      const d = Math.hypot(o.x - t.x, o.z - t.z);
      if (d < nearest) nearest = d;
    }
    const r = Number.isFinite(nearest)
      ? Math.max(1.5, Math.min(MAX_CROWN, nearest / 2))
      : Math.min(MAX_CROWN, Math.max(2, t.h * 0.35));
    return { x: t.x, z: t.z, h: t.h, r };
  });
}

/* ------------------------------------------------------------------ check */

function check() {
  if (!existsSync(OUT)) { console.error("missing", OUT); process.exit(1); }
  const d = JSON.parse(readFileSync(OUT, "utf8"));
  const need = ["Argo Hall", "Blake Hall"];
  const missing = need.filter((n) => !d.heights[n]);
  if (missing.length) { console.error("no measured height for:", missing.join(", ")); process.exit(1); }
  if (d.terrain.z.length !== d.terrain.cols * d.terrain.rows) {
    console.error("terrain grid length does not match its dimensions"); process.exit(1);
  }
  console.log(
    `campus-lidar.json OK — ${Object.keys(d.heights).length} measured heights, ` +
    `${d.trees.length} trees, terrain ${d.terrain.cols}×${d.terrain.rows}`
  );
}

/* Heights are compared with ZERO tolerance: they are the product, a declared
   override is the only legitimate way for one to differ from its measurement,
   and an override lives in the builder where review can see it.

   Terrain and trees carry a bounded allowance, and that is a real weakness
   stated plainly rather than hidden. Two of 935,922 terrain cells and six of
   10,683 trees move between consecutive runs of identical code — 0.1 m and
   sub-metre respectively, invisible on the campus but genuinely unexplained
   (a tie-break in the hole-fill dilation and the canopy clustering, most
   likely). The allowance is sized to that observed instability and no larger,
   so real drift still fails. Fixing the cause would let it go to zero. */
const VERIFY_TERRAIN_CELLS = 20;   // observed 2
const VERIFY_TREE_DELTA = 30;      // observed 6

function verifyAgainstShipped(fresh) {
  if (!existsSync(OUT)) { console.error(`verify: ${OUT} does not exist — nothing to compare`); process.exit(1); }
  const shipped = JSON.parse(readFileSync(OUT, "utf8"));
  const problems = [];

  for (const table of ["heights", "massHeights", "partHeights", "osmHeights"]) {
    const a = shipped[table] ?? {}, b = fresh[table] ?? {};
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    const diffs = [];
    for (const k of keys) {
      const va = Array.isArray(a[k]) ? a[k][0] : a[k];
      const vb = Array.isArray(b[k]) ? b[k][0] : b[k];
      if (va !== vb) diffs.push(`${k}: shipped ${va ?? "absent"} vs rebuild ${vb ?? "absent"}`);
    }
    if (diffs.length) {
      problems.push(`${table}: ${diffs.length} value(s) the builder does not produce`);
      for (const d of diffs.slice(0, 12)) problems.push(`    ${d}`);
      if (diffs.length > 12) problems.push(`    … and ${diffs.length - 12} more`);
    }
  }

  const tShip = shipped.terrain?.z ?? [], tFresh = fresh.terrain?.z ?? [];
  if (tShip.length !== tFresh.length) problems.push(`terrain grid resized: ${tShip.length} -> ${tFresh.length}`);
  else {
    let n = 0, worst = 0;
    for (let i = 0; i < tShip.length; i++) if (tShip[i] !== tFresh[i]) { n++; worst = Math.max(worst, Math.abs(tShip[i] - tFresh[i])); }
    if (n > VERIFY_TERRAIN_CELLS) problems.push(`terrain: ${n} cells differ (allowance ${VERIFY_TERRAIN_CELLS}), worst ${(worst / 10).toFixed(1)} m`);
    else if (n) console.log(`  terrain: ${n} cell(s) differ by ${(worst / 10).toFixed(1)} m — within the known-instability allowance`);
  }

  const dTrees = Math.abs((shipped.trees?.length ?? 0) - fresh.trees.length);
  const shipSet = new Set((shipped.trees ?? []).map((t) => t.join(",")));
  const moved = fresh.trees.filter((t) => !shipSet.has(t.join(","))).length;
  if (dTrees > VERIFY_TREE_DELTA || moved > VERIFY_TREE_DELTA) {
    problems.push(`trees: ${shipped.trees?.length} -> ${fresh.trees.length}, ${moved} moved (allowance ${VERIFY_TREE_DELTA})`);
  } else if (moved) console.log(`  trees: ${moved} moved sub-metre — within the known-instability allowance`);

  if (problems.length) {
    console.error(`\ncampus-lidar.json does NOT reproduce from this builder:\n`);
    for (const p of problems) console.error(`  ${p}`);
    console.error(`\nEither rebuild it (npm run build:lidar), or — if a value is a judgement the`);
    console.error(`measurement cannot make — declare it in MEASURED_OVERRIDES with its evidence.`);
    console.error(`Hand-editing the JSON is what let 31 values drift silently before 2026-08-05.\n`);
    process.exit(1);
  }
  console.log(`campus-lidar.json reproduces: ${Object.keys(fresh.heights).length} named, ${Object.keys(fresh.massHeights).length} massing, ${Object.keys(fresh.osmHeights).length} osm heights identical`);
}

if (CHECK) check();
else build().catch((err) => { console.error(err.message); process.exit(1); });
