# Campus Walk

A walk across a real campus, in 3D, built from measurements rather than impressions.

**Live:** https://sahirssharma.github.io/campus-walk/

You spawn hanging **110 m over Argo Hall**, looking north across the whole of it, and go wherever
you like — ~3 km of surveyed ground, from eye level to 900 m up, at anything between a walking pace
and 2000 m/s. Every building names its measured height as you pass it.

There used to be a second mode: a guided walk on a rail out of Argo Hall, across Revelle Plaza and
up Ridge Walk to Peterson Hall — 371 m, with a walking figure, a progress bar and an
over-the-shoulder camera. It was the original product and the campus outgrew it: once 3 km of
measured ground was reachable in any direction, a 740 m rail was the least interesting thing on
offer, and every control it needed was chrome explaining a feature nobody chose. Free roam is the
only mode now.

---

## The one idea

Two sources, each used only for the thing it is actually good at.

| Source | Used for | Not used for |
|---|---|---|
| **OpenStreetMap** | footprint outlines, paths, plazas, names, the campus boundary | anything vertical |
| **USGS 3DEP aerial LiDAR** | every height, the ground surface, every tree | anything about what a thing *is* |
| **Satellite imagery** (Google today, Apple selectable) | a build-time SOURCE only: per-polygon measured colours, the painted sports markings, the accuracy cross-checks | rendering — no photograph ever drapes the world |

OSM is very good in plan and close to useless in elevation. Of ~320 buildings in this area, 38
carried a height tag, and the tagged ones were not reliably right either. Checked afterwards against
LiDAR:

| Building | OSM / guessed | LiDAR measured |
|---|---|---|
| Argo Hall | 22.8 m | **18.4 m** |
| Blake Hall | 15.6 m | **12.4 m** |
| Mandeville Center | 15 m | **20.9 m** |
| McGill Hall | 12 m | **25.1 m** |
| Student Center | 12 m | **8.6 m** |
| Revelle Commons | 10 m | **7.5 m** |

(The measured column is read from the shipped `docs/data/campus-lidar.json`; a test fails if this
table ever drifts from the data again.)

Argo is the building you spawn over and Blake stands beside it, so they are the first two heights
anyone can check. Both were wrong.

The LiDAR survey (`CA_SanDiegoQL2_2014`) classifies ground and lumps everything else into
"unassigned" — there is no building class. So nothing here asks the data *"is this a building?"*.
It asks *"is this point above ground, and does it stand inside a footprint OSM already drew?"*
That division of labour is the whole design.

### The measured ground

The world stays MODELED — crisp vector geometry in true measured colours; no photograph is ever
pasted on the terrain. The satellite imagery works upstream instead: 87 georeferenced chunks
(0.125–0.25 m/px, reprojected from Web Mercator onto the site's local metre grid,
`docs/data/textures/`) are read at BUILD TIME as a measurement source. `build-campus-truecolor.mjs`
samples every surveyed ground polygon and every roof from them into `campus-truecolor.json`;
`build-campus-markings.mjs` fits the painted sports markings off the same pixels; the accuracy
audits cross-check against them. In the renderer the terrain carries NAIP vertex colours — the
real patchwork of chaparral, lawns and lots — refined polygon-by-polygon with the measured
colours wherever the fine imagery could answer. The official campus boundary is drawn in-world
and on the minimap as a dashed dark-navy line, so the surveyed edge of campus is visible, not
implied.

### The painted lines, as geometry

Every sports surface carries its real markings, drawn as vectors, not photographed:
`scripts/build-campus-markings.mjs` fits each facility's painted layout — centre, orientation,
true extent — to the white paint in the georeferenced chunks (template fit on a local-contrast
whiteness field, hard-bounded coordinate descent), then emits regulation line sets at the fitted
frame into `docs/data/campus-markings.json`: soccer touchlines, boxes, arcs and 9.15 m centre
circles; full tennis and basketball line sets; the track's nine 1.22 m lanes (its north bend
runs past the imagery's edge, so the oval is closed with the 400 m identity) plus its modeled
running surface — a terracotta annulus and green infield, both colours measured off the chunks.
The Muir Field trident is traced straight off the turf as a simplified silhouette polygon. The
Northview tennis banks tilt ~2.5° off the campus grid and their courts stagger, so each court
is fitted individually from the university survey's own pad polygons. Each facility records
`fitError_m` (mean perpendicular offset to the paint) and `fitCoverage` (the fraction of the
emitted line actually lying ON paint — the metric that catches a rotated misfit the offset
metric cannot); the build refuses fits past 0.5 m or under the coverage gate, and a facility
may carry a tighter pair of its own. `docs/js/campus-markings.js`
drapes the result as merged meshes. The heavily faded ghost sets, a few unfittable one-offs,
and Warren Field — whose overlapping painted generations disagree with each other by metres, so
no single regulation set can lie on all of them — are deliberately left unpainted: better
absent than wrong.

**Coverage is resolved per sample, not per facility.** A 10 cm line fills about half a pixel at
0.125 m/px and a quarter at 0.25, so the threshold that decides "is this on paint" has to follow
the source's own resolution — and it did, but it was resolved ONCE, at the facility's centre.
That is the right number only for a facility inside a single chunk. RIMAC's north-west pitch
runs straight across the zoom seam at z = -1128: its centre sits in the fine chunk, so its whole
northern half — real paint, recorded at half the pixel scale — was scored against a threshold
its imagery cannot reach. The pitch measured **0.53** coverage and shipped anyway. Resolved
where each sample actually lands it measures **0.78**, and the fit itself never moved.

**Epochs do not match, on purpose.** The source imagery is current; every height and the ground
surface are the 2014 LiDAR survey (reconciled per mass against the university GIS for what was
built after the survey flew). Where campus changed since 2014, the measured colours and
markings show today and the geometry shows the survey — except where the imagery caught
2023–24 construction, where the colour pipeline skips it and the model keeps its palette.
Nothing here blends the two: heights are never read off the imagery.

**The epoch rule, enforced (2026-08-03).** The 2014 flight predates a decade of construction,
and its returns off the trees, lots and demolished predecessors that occupied those sites are
not measurements — they shipped NTPLLN as bungalows and The Jeannie at tree-canopy height. So:

- `scripts/build-campus-lidar.mjs` keeps a `POST_2014_SITES` list; those names emit **no**
  LiDAR height and no part heights, ever. (No newer public survey exists: the only USGS 3DEP
  datasets over campus are the 2014 QL2, the 2002-05 Scripps strips, and the 2016 coastal
  El Niño flight — all pre-construction for every affected building.)
- Post-2014 buildings take the university GIS massing where it exists, their own OSM tags where
  those match Street View floor counts, and otherwise an entry in `ESTIMATED_POST_2014` in
  `scripts/build-campus-3d.mjs` — floors × storey from 2025 Street View, declared in the build
  script, never silently in the data.
- Sites still being built (the Triton Center block by Price Center) render their **current**
  build state from the `UNDER_CONSTRUCTION` table, not the finished project; demolished
  buildings (Friend's Thrift Shop) are excluded outright; fully underground structures
  (Scholars Parking, under the Sixth College green) never extrude.
- `tests/campus-epoch.test.mjs` pins every one of these classes so a rebuild cannot regress.

**The per-mass survey (2026-08-04).** Heights were reconciled per HOST: every university massing
ring inside an OSM footprint took that footprint's one LiDAR number, so the tallest volume's
height pasted itself onto everything sharing its ring. Checked against a targeted re-sample of
the same EPT, per massing ring:

| Mass | Shipped (host's height) | Its own 2014 roof plane |
|---|---|---|
| Natatorium | 14.9 m (the Main Gym's) | **8.5 m** |
| Urey Hall Office Addition | 30.5 m (the tower's) | **12.1 m** |
| W. M. Keck Building annex | 24.1 m (Biomedical Sciences') | **6.4 m** |
| Powell Structural Components Lab | 21.9 m (SERF's) | **13.8 m** |
| Tuolumne T House East | 17.3 m (the complex's) | **9.3 m** |
| Medical Teaching Facility low wing | 29.9 m (a stale GIS record) | **8.3 m** |

`campus-lidar.json` now carries `massHeights` — each ring's own roof plane, measured from its
own rim grade (a host-wide median smears a complex's slope onto every mass in it: Eckart
Building drops 15.6 m across its SIO bluff and lost 7.6 m of height to its host's grade). A
mass only gets a number when its roof reads as ONE plane; Urey Hall's main slab (half its
returns on ~16 m steps, crown at 30.4 m) emits nothing and the host measurement stands. The
same sweep found eight more names shipping 2014 returns off their predecessors — Mesa Nueva
(2017), Nuevo West (2020), the Athena and Campus Point garages, Survivance, Tata Hall, ACTRI
(2016, caught mid-construction at 28.6 m) — all moved to `POST_2014_SITES`, all falling back to
their university GIS records. The Epstein Family Amphitheater (2022) is open air and tagged
`building=no` in OSM; the importer now honours that tag instead of extruding the 2014 eucalyptus
canopy as a 17 m slab, and the bowl stays unbuilt — better absent than wrong. And the "Eighth
College" label, hand-seeded a kilometre south into a canyon interchange, now stands at Ridge
Walk North where OSM puts its four member buildings.

**The north-west shard sweep (2026-08-04, r0c0).** The corner from the Salk to the ERC halls,
checked building by building against a targeted re-sample of the same EPT:

| Building | Shipped | Measured | Why it was wrong |
|---|---|---|---|
| Salk Institute lab wings (both) | 22.8 m (area guess) | **19.6 m** | OSM maps the Salk as a named *area* containing unnamed building ways; nameless, the wings could not key into the LiDAR table. `WAY_NAMES` in the importer now names them from the containing site. |
| Torrey Pines Center South | 17.1 m (GIS record) | **12.2 m** | relation-mapped after the last full LiDAR rebuild — the heights file simply predated the footprint. 23,073 in-survey returns, one plane. |
| Sanford Consortium east pavilion | 17.1 m (facility record) | **6.2 m** | the record's one height applied to both rings; the east ring is the low auditorium pavilion, not the lab bar. |
| ERC Laundry South | 3.0 m (GIS) | **4.2 m** | same class, opposite sign. |

The Sanford case exposed a hole the whole campus shared: a massing ring whose centroid misses
every named OSM footprint had no host, so its GIS value stood **unchallenged** — the epoch guard
could not even ask the question. `build-campus-lidar.mjs` now falls back to the mass's own GIS
name when it exactly matches an OSM building within 150 m; nine masses campus-wide are in that
class (Wells Fargo Hall 26.1, Mandler Hall 14.8, CMRR 12.9, Student Services Center 22.7, Visual
Arts Building 2 11.9, Bonner Hall's annex 3.0, plus the three above). The tenth — Pepper Canyon
Assistant Dean's Residence — reads canopy-stepped under its eucalyptus and emits nothing.

Two rendering fixes rode along. The SanGIS footprint for the Marshall Lower Apartments traces
the union of six massing rings — centroid in a breezeway, half its vertices on the exact shared
edges — and extruded as one 18 m monolith THROUGH the six halls; `ringCoveredBy` now samples a
ring's interior AREA (≥85% already massing ⇒ the massing already is the building) and yields
whenever no covering mass would inherit the ring's name. And the path drape sampled the ground
only at segment ends, so OSM's one 159 m segment of Salk Institute Road bridged a 5.9 m rise as
a straight plank; every segment now subdivides to ~6 m, which is what the 3 m terrain grid can
actually answer (`tests/campus-overlay.test.mjs` pins the swale case, §9 of
`tests/campus-epoch.test.mjs` pins every height above).

The same sweep measured Apple's georegistration at a second site — the ground-level crosswalk
paint at North Torrey Pines Rd / Salk Institute Rd: best correlation **0.783** at an offset of
**1.77 m** (0.25 m west, 1.75 m south). The first site (Muir's courts) had measured 1.25 m in a
*different direction* (1.00 m east, 0.75 m north). Apple's misregistration is therefore not a
constant bias to subtract — it varies site to site, so only fitted per-site corrections can ever
pass the 0.6 m gate, and colour sampling stays on the registered Google chunks everywhere a fit
has not been run. Apple remains what it is: the authority on what exists today (it confirmed
every r0c0 site current, including the two structures the height pipeline cannot reach — the
Salk's unnamed service complex and a La Jolla Farms greenhouse, which keep their declared area
guesses because a name-keyed survey cannot measure a nameless building — better documented than
invented).

**The north-central shard sweep (2026-08-04, r0c1).** RIMAC to Canyon Vista, the ERC halls to
The Village East, same protocol — every entity against a targeted re-sample of the same EPT,
every site against a fresh Apple snapshot:

| Building | Shipped | Measured | Why it was wrong |
|---|---|---|---|
| Atkinson Hall, west pavilion | 27.2 m (host bleed) | **14.5 m** | the facility ring spans the whole hall WITH its 29.8 m tower nested inside; measured whole it reads canopy-stepped and the guard withheld it, so the host-wide value — dominated by the tower — pasted onto the low wing. Measured MINUS the contained tower ring (16,642 returns) the pavilion has its own clean plane. `MEASURE_MINUS_CONTAINED` pins the mechanism. |
| SDSC East Expansion | 17.1 m (GIS record) | **23.2 m** | no OSM host, no OSM name twin — the record could not be challenged until `PRE_2014_GIS_VERIFIED` let its documented 2009 build date answer the epoch question. |
| Social Sciences Building | 17.1 m (GIS record) | **21.0 m** | same class (1995). Robinson 1 & 3, ERC Admin North, Outback Adventures, SCE #5/#6 measured with them (10.4 / 7.5 / 4.8 / 2.5 / 12.2 / 8.4). |
| Douglas Hall | 18.3 m (GIS, unchallenged) | **16.1 m** | the inventory calls the mass "Douglas Apartments", OSM calls the building "Douglas Hall" — no name match, no host (its centroid falls in a light-well), so the label orphaned AND the record stood. `MASS_RENAMES` maps inventory name to OSM name; the ring re-samples at 16.1. |
| Earth Hall chain (ERC) | one 11.7 m slab | **11.6 / 4.7 / 11.6 m** | the facility ring is the UNION of Earth North, the Middle Earth Lounge and Earth South; the single slab flattened the 4.7 m lounge and wore the lounge's name. The union ring is dropped; each OSM footprint renders its own plane. |
| Canyon Vista | one 12 m union | **12.0 + 8.6 m** | same class: one ring across the admin lodge and the restaurant, centroid in the shared courtyard, suppressing both named buildings. |
| Village East 4 + 5 | one 15.2 m union | **12.1 + 12.4 m** | "Seventh College East #4" traces VE4+VE5 as one ring at a 15.2 m guess; VE4 double-rendered through it, VE5 lost its name to it. |
| VE community building | 9 m (OSM guess) | **12.3 m** | unnamed ring — nothing to key `lidar.heights` — so the OSM tag rendered unchallenged. `lidar.osmHeights` now carries hand-verified unnamed rings by index, the coupling `partHeights` already uses. |

The union-outline class is the Marshall Lower Apartments bug mirrored: there the SanGIS
*footprint* traced the union of six real masses; here the facilities *extrusion* traces the
union of two or three real buildings, flattening measured differences and stealing names.
`UNION_OUTLINES` in `build-campus-arcgis.mjs` drops each union where the OSM division is finer
and every piece carries its own LiDAR plane. The same scan found the rest of the class outside
this shard — Mandell Weiss Forum over the Shank Theatre, 64 Degrees over Revelle Commons, Birch
Aquarium over the Hillgarth Center, Biomedical Sciences over WongAvery, Mandeville over the
Print Labs — each left for its own shard's sweep.

One epoch entry: the **RIMAC Annex** is gone. Apple (2026-08-04) shows a tower crane over open
concrete decks where the laser measured a 10.6 m building in 2014; the rebuild has not topped
out and no source resolves the rising frame to gate. The site renders nothing — footprint kept,
place label kept for wayfinding, `POST_2014_SITES` keeps the dead measurement out — better
absent than wrong. Alianza and Umoja also stopped extruding their OSM outer OUTLINES (courtyards
included) through their own quads; the university's per-wing masses, which the outlines merely
circumscribe, are what render.

The sweep also quantified a render-side class it did not change: the extruder anchors a roof at
*centroid* ground + measured height, while the measurement defines height against the footprint
*rim median* — under a hole-filled interior on a grade the two diverge, and four masses in this
shard render their roofs >2 m off the surveyed elevation (Hopkins Parking worst at +3.2 m on its
15.7 m grade span). Every base is per-vertex safe (`lowest − 1.5 m`); this is roof elevation
only. Re-anchoring at the rim median matches the measurement's own definition but moves every
building on campus, so it is logged for a dedicated cross-shard pass rather than smuggled into
this one. In-shard markings (Triton Track & Field, the RIMAC pitches, Northview tennis) verified
within their declared gates; Marshall Upper Apartments' townhomes keep the university's 6.1 m —
their p98s read eucalyptus tails (up to 10.3 m) that stay under the canopy guard's 5 m firing
threshold, and the GIS figure matches the measured plane's body.

**The east-campus shard sweep (2026-08-04, r0c2).** Campus Point, the Scripps Memorial /
Prebys hospital campus, the CSC service yard, the Biology Field Station and the Preuss School —
the corner of the survey where almost nothing carries an OSM name, which means almost nothing
could key `lidar.heights` and nearly every building wore its area guess unchallenged. The
`osmHeights` index mechanism r0c1 introduced for two hand cases is what this shard actually
needed at scale: 31 more unnamed rings verified standing-unchanged on Apple (2026-08-04) and
re-sampled against the same EPT:

| Building | Shipped | Measured | Why it was wrong |
|---|---|---|---|
| Scripps Memorial east tower (unnamed) | 22.8 m (area guess) | **34.0 m** | nameless, so the guess stood. 17,637 returns, one plane at p98. |
| Prebys Cardiovascular Institute (unnamed) | 16 m (area guess) | **46.9 m** | an epoch CALL, not just a lookup: Prebys topped out mid-2013 and opened March 2015, so the 2014 flight measured the complete structure — 27,500 returns, p75 45.5 to p98 46.9 is a finished plane, not formwork scatter (contrast ACTRI, caught genuinely mid-build at 28.6 and excluded). The tallest fix the gauntlet has made. |
| Campus Point tower (unnamed) | 12 m (area guess) | **31.3 m** | a seven-storey office guessed at three floors. Its neighbours moved with it: 22.8, 19.1, 15.2, 13.7, 12.1 m planes over guesses of 12. |
| Hospital-district carports (13 rings) | 4.5–9 m guesses | **3.8–8.7 m** | OSM's area heuristic reads a long PV canopy as a two-storey building. |
| Qualcomm AA | 20 m (area guess) | **24.3 m** | the one building whose footprint pokes past the LiDAR survey box, so the standard pipeline never measures it; a targeted re-sample of the same EPT (30,780 returns) feeds `KNOWN_HEIGHTS` — the Tenaya precedent. |
| CSC shops C/D, hostless Fleet row | 4.3 m (GIS records) | **6.9 / 6.5 / 5.7 m** | `PRE_2014_GIS_VERIFIED` extended east: twelve more hostless records with documented pre-flight build dates now answer the epoch question by date and get challenged like everything else. |
| Preuss School A/B/C/F | 8.5 m (GIS default) | **9.2 / 9.2 / 9.2 / 11.7 m** | same class; the double-height gym hall was three metres taller than its record. The East Campus Substation ran the other way — 8.5 m record, 5.3 m building. |
| BFS greenhouses + Frog House | 4.3 m (GIS) | **4.9–5.3 m** | the GIS greenhouse rings span what OSM maps as PAIRS of houses, so their centroids fall in the gap between the named rings and host containment could never see them. |

The sweep also closed an epoch hole in the PART pipeline: `partHeights` guarded named hosts
(`POST_2014_SITES`) but let an unnamed host's parts through unexamined, which is how the
Anderson Medical Pavilion — opened 2016, a construction site at the flight — shipped a 4.1 m
"roof" that was really slab-and-staging returns. Unnamed hosts' parts now answer through the
same per-index verification their slabs use, and Anderson ships nothing. The main Scripps
complex is the documented WITHHOLD of the shard: a stepped 1960s-2000s chain whose returns have
no single plane anywhere (p75 9.5 m under towers at 32), so the automatic rule would flatten it
to 9.5 — worse than its 20 m guess. It keeps the guess, stated as one, until someone measures it
per wing. Better a declared estimate than a false measurement.

One demolition: Apple shows the unnamed 1980s service building south of Campus Point Court with
its roof torn open and excavators on the slab — mid-demolition for the Alexandria buildout. The
RIMAC Annex rule applies, but the ring has no name for `skipOsm`, so the renderer skips it by
footprint anchor instead; nothing extrudes, the ring stays for the day something measurable
stands. And two wayfinding anchors nobody could navigate without — "Scripps Memorial Hospital
La Jolla" and "The Preuss School" — existed only as OSM *site* ways wrapping unnamed buildings,
so neither ever survived the name pass; both are now seeded at their site ways' centroids.
The roof-anchor render class r0c1 quantified gets two more data points here (the 34 m tower
renders 2.7 m below its surveyed elevation over a hole-filled interior; a canyon-edge wing
1.9 m above) — still logged for the dedicated cross-shard pass, still not smuggled in.

**The west shard sweep (2026-08-04, r1c0).** La Jolla Farms and Muir's residential edge — the
shard where 131 of 140 buildings are nameless private estates, and where rebuilding the heights
file exposed a one-character pipeline bug. The survey-box test in `build-campus-lidar.mjs` read
`bb.maxy > BOX.maxy` where `bb.miny` was meant, rejecting any footprint that *pokes past* the
north edge instead of footprints lying entirely beyond it. The committed data predated the
Overpass refresh that moved the affected rings, so the bug was latent: the next rebuild would
have silently dropped Torrey Pines Center South's 12.2 m measurement, and Qualcomm AA had
already needed a `KNOWN_HEIGHTS` workaround because of it. One character fixed, both measure —
and QAA's box-clipped automatic measurement (23.3 m, a truncated footprint) is superseded by its
audited full-ring re-sample:

| Building | Shipped | Measured | Why it was wrong |
|---|---|---|---|
| La Jolla Farms estates (95 unnamed rings) | 4.5–9 m (area guesses) | **3.1–9.6 m** | the guess ran BOTH directions: one-storey ranch houses guessed at 9 m (osm:319 measures 4.4), two-storey townhouse rows guessed at 4.5 (osm:721–727 measure 7.8–7.9). Each re-sampled from the EPT, shipped only where the roof reads as ONE plane, each checked standing on its 2014 footprint in an Apple closeup. 25 more rings measured but sit under crowns — their guesses stand, stated as guesses. |
| Extended Studies cottages F/G/X/Z/E | 4.3 m (GIS record) | **3.2–3.9 m** | hostless masses with no OSM rings at all, so nothing ever challenged the record. Five more (A–D, L) stay at 4.3: the eucalyptus rows over them defeat every percentile guard, and the record matches what the laser glimpses of the roof body. |
| Tuolumne Apartments | one 17.3 m outline | **nine houses, 9.3–16.2 m** | the whole-complex OSM ring extruded through its nine facility masses — the Marshall/Alianza union-outline class, suppressed the same way. T House North's centroid falls in a notch OUTSIDE the concave ring, so host containment had never measured it: 13.0 m vs 12.2 of record. |
| Spanos Athletic Performance Center | 15.8 m (the rebuild's LiDAR read) | **4.4 m** | an epoch trap: TWO buildings share the OSM name. The Performance Center broke ground June 2015 — the 11–16 m smear over its footprint is the eucalyptus row cleared for it, not a roof. The audited 4.4 is the 1988 Training Facility's plane; both render from their own GIS masses at 4.3. |
| Muir west tennis pad | two tennis courts | **removed** | Apple (2026-08-04) shows the pad repainted for pickleball; the registered Google chunks carry the previous paint generation. The new lines can't ship until an Apple registration passes gate — better absent than stale. The east pad's four courts still fit (0.23 m, 54 %). |

The H1 spot-check ran clean here: independent re-samples of the shard's named, unchanged
buildings agree with the build's own measurements within 0.2 m on every clean plane (Tioga
35.8/35.7, Keeling North 34.4/34.4, HDH Admin 19.8/19.8, Audrey Geisel 6.3/6.4) — the 2014
survey still describes today's campus wherever nothing changed, which is exactly the claim the
epoch rule stands on. A grade audit over all 146 rendered masses on the bluff found zero past
the 2 m roof-anchor gate. The documented withhold: osm:481, a ring under unbroken chaparral on
the canyon rim — Apple sees no structure and the sparse returns could be brush, so it ships
nothing rather than a guess dressed as a measurement.

**The academic-core judge pass (2026-08-04, r1c1).** Warren Mall to the VA hospital, the
shard a screening agent had already swept; every candidate was re-derived from the EPT and
the imagery before anything changed, and a third of them turned out to be dates or working
behaviour rather than errors. What was actually wrong:

| Building | Shipped | Measured | Why it was wrong |
|---|---|---|---|
| Central Utilities thermal storage tank (unnamed) | 9 m (area guess) | **27.0 m** | the round tank beside the cooling-tower rows, identical in both epochs; 3,104 returns, one plane p50 26.4 to p98 27.0. An 18 m miss — the shard's largest. |
| VA plant block (unnamed) | 9 m (area guess) | **6.4 m** | 1,061 returns, p50 6.3 to max 6.5 — the tightest plane in the batch. |
| Solis Hall | 14.9 m (LiDAR p75) | **6.4 m** | the Stage Room failure again: the eucalyptus stand over its east edge puts 38 % of returns in crown, so the tree-guard's p75 is still canopy — and the host-level reconcile smeared it onto the GIS mass. The roof is the dense band's p50; hand-audited like the Pub. |
| Black Hall | 18.3 m GIS record, name lost | **16.1 m, named** | the Douglas Apartments failure again: the inventory says "Black Apartments", the mass centroid lands in its own courtyard so no host ever challenged the record, and the suppressed OSM ring took the "Black Hall" name with it. One `MASS_RENAMES` entry restores host, label and challenge. |
| Student Services Center | rendered **twice** | once, 22.7 m | its facilities ring is drawn offset enough that no mass centroid lands in the OSM ring, so the name test failed and the ≥0.85 area test never ran — the OSM copy extruded through massing that already IS the building (0.93 covered). The name test now honours an exact-name mass within 150 m, the LiDAR build's own twin rule. |
| Center for Memory and Recording Research | rendered **twice** | once, 12.9 m | same class, 0.99 covered. Campus-wide sweep: SSC and CMRR are the only two flips. |
| Vela | 19 m outline slab through the towers | **parts only** | Vela is two OSM building:parts but only the tower box carries a height, and the parts gate counted the FILTERED list — one survivor flipped the building onto the whole-outline path. The gate reads the raw count now; the covered tower part yields to the 70.1 m PCW mass and the paseo stays open. Tapestry/Catalyst/Kaleidoscope (no surviving parts at all) keep their outline fallback. |
| Triton Center predecessor (unnamed, osm:1351) | 12 m phantom | **removed** | demolished: bare dirt on the registered chunk, a staging pad with trailers on Apple, the new frames rising beside it in Street View 2025-02. The 2014 flight measured a real 4.9 m building; that building is gone. |
| Pad south of the Chancellor's Complex (unnamed, osm:56) | 9 m phantom | **removed** | same demolition class — staging on the chunk, razed flat on Apple. Both skip by footprint anchor, the Campus Point convention. |

The rejections matter as much as the fixes. Jacobs Hall's 33.2 m stays: the screener proposed
its p50 (20.8), but the complex is genuinely stepped — 20 m wings under a 34–39 m cruciform
core that extends past the tower's own GIS ring, so even a minus-tower re-sample has no single
plane (p50 20.7 / p75 25.3 / p98 34.5) and the Urey rule holds (the mass emits nothing, the
host answers, the tower measures its own 39.8). HSS's "identity split" is reality — a 36.7 m
tower and an 8.5 m wing, each at its own plane. And the VA parking structure keeps its declared
20 m guess: Apple shows a finished multi-deck garage with cars on the top deck, but the 2014
returns read p50 2.4 m — a surface lot. The garage postdates the flight, so there is no 2014
number to ship, and the Google chunk over the footprint is censored (federal facility), so
Apple is the only current view of it. One position disagreement is logged rather than fixed:
the OSM ring and the exact-name GIS mass for Visual Arts Facility - Building 3 stand within
150 m of each other with zero footprint overlap — somebody is wrong about where Building 3 is,
and neither source resolves which yet.

**The east-campus judge pass (2026-08-04, r1c2).** Pepper Canyon to the Shiley/Jacobs health
campus. Three of the screen's sixteen candidates were classes wearing a case's name, and the
classes were the fix:

- **Names are not unique, and the heights table pretended they were.** `lidar.heights` is keyed
  by OSM name; nine campus names label two rings each, so the shared key was a last-writer-wins
  race. Both Spinal Cord Injury Buildings shipped 6.4 m — the second ring the build visited is
  the VA's 2021–26 replacement hospital site, mostly empty in 2014, and its non-answer
  overwrote the 1990s center's real plane. Collided names now emit per ring index, and
  `POST_2014_OSM_RINGS` gives the epoch rule a per-ring form for pairs that straddle the
  flight: the old center measures **17.2 m** (p50 = p90, 17,154 returns), the new hospital
  keeps its OSM tag stated as a tag, and the 2023 VA garage beside it keeps its declared guess
  over the surface lot the laser actually saw.
- **A host rename could steal a name the record already gave someone else.** The OSM ring
  wearing "Pepper Canyon Assistant Dean's Residence" is drawn over the Apartments 1300 block,
  38 m east of the actual house — the rename hung the Dean's label on the apartments and handed
  the apartments' name to the laundry, and the name-keyed facades followed the stolen labels.
  The rename is now refused when a different nearby GIS mass already carries the wanted name:
  the residence renders once at its 6.1 m record, the apartments and laundry get their names
  back, the Spanos ring stops relabelling the 1988 Training Facility, James' Place comes back
  from under a second "Mandell Weiss Forum", and Electric Shop / Environmental Management
  Facility stop labelling two and three buildings each. Pure swaps (Meteor/Galathea) survive —
  OSM is still the name authority where no third building's identity is taken.
- **"Mesa Nueva - Cala" IS Cala, and the twin rule couldn't see it.** The exact-name test let
  the OSM ring and the facilities mass extrude twice in the same courtyard at the same 24.4 m.
  A mass carrying the OSM name as a word suffix now carries the identity — name only, never
  height, because a partial OSM trace must not drag a measured record down (Spiess Hall's would
  have). Cala, Brisa, Arena, Marea, Artesa and the Matthews parcel letters all resolve; the
  researched facades keyed to the short names land on their buildings again.

| Building | Shipped | Measured | Why it was wrong |
|---|---|---|---|
| Spinal Cord Injury Building (1990s center) | 6.4 m (the collision race) | **17.2 m** | pinned per ring in epoch §14; Apple shows it standing unchanged |
| Matthews Apartments A–E (1972) | 6.1 m each (GIS record) | **8.5–8.7 m; E 7.8 m** | five two-storey defaults, never challenged because the letter rings hid the masses from the host path; E's own plane is guarded (its p98 13.4 is canopy) and ships its own 7.8, not a sibling's |
| Campus Point Parking Structure West | 21.3 m (GIS record) | **14.4 m** | five levels × the 4.27 m office default, but a garage's decks pitch ~2.9 m: 12,626 returns, p50 12.9 → p98 14.4. Its East sibling went up with Jacobs Medical Center and keeps the post-2014 record. |
| East Campus Utilities Plant | 4.3 m (GIS record) | **8.3 m** | an industrial hall on a one-level record; its 2016 Expansion keeps the record — the tight 7.5 m plane under that footprint belongs to the building it replaced |
| 9435 Modular Offices | 8.5 m (GIS record) | **3.7 m** | trailer banks on a two-storey default; p50 3.6 → p98 3.8 |
| Stuart Collection Storage | 8.5 m (GIS record) | **4.4 m** | a shed on the same default |
| VA plant building (unnamed) | 12 m (area guess) | **9.7 m** | p98 9.7 under one 33.6 flier |
| Modular by the 9435 banks (unnamed) | 4.5 m (area guess) | **3.8 m** | p50 3.8 = p98 3.9 |

The rejections: Viterbi's 18 m is a documented Street-View floor estimate, not a guess — the
flight saw its site empty and must stay silent. The Jacobs Bed Tower keeps 61.2 m: it topped
out in 2013, so that IS its 2014 plane, and the proposed Atkinson-style carve dies on the
re-sample (minus the tower there is no plane at all — the "wings" are the tower's own
setbacks). The trolley platforms and the Warren Field House are post-2014 records working as
designed; the fieldhouse site's zero returns are the epoch rule being right, not an empty
site. Withheld, better absent than wrong: the Utilities Expansion, Anne Ratner's stepped roof,
the Mesa 9242/9240 pair under Mesa Nueva tower bleed, and one small VA structure whose returns
are three-quarters neighbour. Eye-level verification photographed all 26 touched or judged
sites; every rendered roof probe matches its shipped height exactly.

**The theatre-district / west-corridor judge pass (2026-08-05, r2c1).** The Mandell Weiss
complex to La Jolla Village Square. Eleven screened candidates; eight were real, and the worst
two were the same failure the Stage Room and Solis Hall already named — a building that lives
under trees wearing the trees as its height:

| Building | Shipped | Measured | Why it was wrong |
|---|---|---|---|
| Che Café Collective (1980) | 20.9 m (host canopy paste) | **3.8 m** | the venue sits INSIDE the eucalyptus grove — Street View shows trunks through its deck. 48 % of returns sit in a dense 2–4 m band, the rest climb the crowns to 29; the tree-guard's p75 was still canopy, and the host reconcile smeared it over the 4.3 m eave record. Hand-audited at the dense band's p50; the OSM mapper's own tag says 4.8. |
| Laurel | 9.9 m (same paste) | **4.2 m** | 70 % of returns in the 4 m bin alone, tail to 16.5 through the crowns over its east edge. Its unshaded siblings Laurel Extension and Magnolia measure 4.4 and 4.3 clean — one-storey pads, all of them. |
| Theodore and Adele Shank Theatre | suppressed; its name on a 3.2 m shed | **10.1 m, its own ring** | the record traces Forum + Shank as one 1,987 m² union ring, so the Shank's footprint suppressed under it — while a 56 m² record sliver standing centroid-inside the Shank ring took the theatre's name through the host rename. Both record rings are union outlines now (the Earth Hall fix); the OSM division renders. |
| Mandell Weiss Forum | one union slab over two buildings | **10.5 m, its own ring** | the union's own trace reads 10.4 — the Forum's plane, wrong over neither theatre but a lie about there being one building. LiDAR measures them apart: 10.5 and 10.1. |
| Grid-roof residential complex (unnamed, osm:93) | 16 m (area guess) | **11.8 m** | 7,543 returns, p25 10.5 → p98 11.8, body tight; standing unchanged on today's Apple. |
| Commercial L-block, Villa La Jolla Dr (unnamed, osm:77) | 12 m (OSM tag) | **7.5 m** | one plane at p25 = p75 = 7.5; the p98 tail to 28.1 is the ficus rows hugging its east edge, which the tree-guard discards. |
| La Jolla Village Square, east strip (unnamed, osm:333) | 4.8 m (OSM tag) | **8.2 m** | the mapper under-tagged a tall single-storey retail shell; 6,216 returns, p98 8.2, max 8.5. |
| La Jolla Village Square, center pavilions (unnamed, osm:335) | 4.8 m (OSM tag) | **7.7 m** | same under-tag, same mall; 3,173 returns. |

Two double-renders fell to one class fix: an unnamed OSM ring that samples half-covered by the
university's massing is a duplicate tracing of a building the massing already renders, and it
has no name suppression could lose — the area floor for unnamed rings drops from 0.85 to 0.5,
the same bar the vertex-majority test already uses. That suppresses osm:718 (a 9 m guess
z-fighting through the Satellite Utility Plant's record) and osm:359 (an 8.4 m re-trace of Mesa
Apartments Central 9236 over the university's own 6.1 m mass). Campus-wide, those two are the
only flips.

Splitting the Forum union exposed a rename hole the r1c2 guard could not see: with the record's
"Mandell Weiss Forum" rings gone, the university's **James' Place** — standing centroid-inside
the now-rendering OSM Forum ring — took the ring's name, and the Forum rendered twice. The
rename exists so suppression loses nothing; it now fires only INTO a suppressed ring. When the
host ring stands in the world itself, the mass keeps its record name and James' Place keeps
saying James' Place.

The epoch work: the **Satellite Utility Plant** (opened ~2018-19) joins `POST_2014_SITES` — the
screener read the flight's tight 4.0–4.2 m plane under it as the plant's height, but that plane
is the demolished predecessor; Street View 2020-03 and today's Apple show the tall finished
block, and the 12.8 m record ships unchallenged. osm:718's carport plane is barred per-ring the
same way. And **osm:1354**, south of La Jolla Village Drive: 48 returns, max 1.7 m — a bare lot
the 2014 flight saw, still bare in Street View 2018-05, a finished pitched-roof building with
solar carports on today's Apple. Built after mid-2018, keeps its declared guess, and the
registered Google chunk over that block is censored — Apple is the only current nadir view of
it, the VA-garage situation again.

One build-order bug in the tree pipeline: the prune ran on full-precision trunk positions, and
the file then rounded them to 0.1 m — which carried 13 wall-hugging trunks across footprint
edges the prune had cleared, every one within 5 cm of its wall. The prune now runs on the
coordinates the file ships.

The rejections: the Potiker/Jacobs naming stands — the record calls both theatre-complex masses
"Joan and Irwin Jacobs Center for La Jolla Playhouse", OSM outlines the Potiker Theatre across
them, and both are right (the Center is the facility, the Potiker the venue inside it; OSM is
the name authority, and each mass still measures its own roof — 13.5 the fly tower, 9.4 the
house). The Mesa housing pads' 9 m area guesses were probed and agree with their planes to
within ~1 m (8.7–10.0 across the sampled row) — verifying all 37 rings one by one is real work
that stays on the list, but there is no lie to fix. And the far-taller-LiDAR reconcile branch
that pasted the grove onto the Che Café survives exactly one place campus-wide after these
fixes: Jacobs Hall, whose 33.2 m host plane over a 17.1 m four-level record is the cruciform
core being genuinely taller than the record — the r1c1 verdict, unchanged.

**The Scripps Oceanography judge pass (2026-08-05, r2c0).** The pier to La Jolla Shores. Ten
screened candidates; the two loudest were dates, not errors, and the strangest was the survey's
own box lying about a building that never changed:

| Building | Shipped | Measured | Why it was wrong |
|---|---|---|---|
| Ritter Hall (1931/1959) | 21.3 m (the record, through a false `newer` flag) | **14.6 m** | AREA's south edge cuts the SIO shore, so Ritter measured only its in-box subset — 12.5 m, which sat 8.8 m under the 21.3 m five-level record and tripped the built-after-the-flight heuristic. The full ring reads one tight plane at 14.6 (5,798 returns); 21.3 was never this building's roof. A clipped footprint is a different quantity — the Qualcomm AA lesson, now audited the same way. |
| Vaughan Hall | 14.4 m (in-box, 87 % of the ring) | **14.9 m** | same truncation, quieter failure: no flag fired, the number was just short. |
| Nigella Hillgarth Education Center | 4.7 m (in-box, 81 %) | **6.2 m** | the clipped read caught only the flat tops; the full ring's p98 is the pitched-pavilion ridges, capping at 7.4 — far too low to be the crowns Apple shows only at the ring's edge. |
| Hubbs Hall Confrence Center (sic) | 17.9 m, wearing Hubbs Hall's four-storey record | **4.0 m** | the low conference annex beside Hubbs Hall: 23 % of its returns are one tight 3–4 m band (the roof), the rest a 5–19 m smear off the hall's block and the palms between — and the fuzzy name match handed it the hall's 17.1 record on top. Hand-audited at the dense band's p50. |
| T-25 / T-30 cottages (1913-24) | 9.0 / 10.7 m (GIS rings drawn into the grove) | **4.8 / 5.0 m** | the cottages measure clean on their own rings; the record rings reach into the eucalyptus and shipped canopy as mass planes. T-30's own p98 (6.8) rides 27 crown returns — the dense band says 5.0, in family with T-29 (3.8) and T-31 (4.1/5.0). |
| NOAA Southwest Fisheries complex | outline 14.7 m z-fighting its 13.8 m core | **13.5 m wings + 13.8 m core** | OSM traces the whole complex, the university's ring is the tall centre block alone — measured whole, the outline's p98 lands ON the core and the low wings extrude a metre above their own roof. The outline now measures minus its contained mass (the Atkinson fix, host-side). |
| Fred N. Spiess Hall | 17.1 m record, unchallenged | **14.3 m** | OSM drops the honorific and the mass centroid misses the offset OSM ring, so no path ever challenged the record. Renamed to its OSM name; the mass measures 14.3 (6,133 returns). |
| Birch Aquarium / Hillgarth Center | one 6.5 m union mass; Hillgarth suppressed under it | **7.2 m + 6.2 m, own rings** | the record ring wraps both buildings (Hillgarth 97 % inside it) — the union drops (the Earth Hall fix, pre-registered by r0c1) and each renders its own plane. Birch's stepped gallery hall above 7.2 stays unrendered: a single plane cannot say it, better absent than wrong. |
| Seawater tank, Scripps beach (unnamed, osm:403) | 4.5 m (area guess) | **9.9 m** | the round white tank below the pier bluff, lettering on its top, standing on today's Apple exactly as the flight saw it: half deck returns, half one tight 9–10 m plane. |
| Six Shores/Farms houses (unnamed) | 9 m guesses | **2.5–6.2 m** | each with a dense single band (77–95 % of returns) and an Apple currency check; the flat-roof outlier ships 2.5 off a 95 %-dense band. |

The epoch work: **Center for Coastal Studies** (renovated 2019-20, upper floor rebuilt) and the
**Marine Conservation Facility** (the 1963-64 fisheries lab converted 2021-23, new pavilion and
winged roof on the old frame) both join `POST_2014_SITES` — the flight's tight planes under them
are the pre-renovation roofs, so the university's current records ship unchallenged (12.8 m/L3,
17.1 m/L4; Street View 2025-02 shows both finished). And the unnamed ring in the Eighth College
courtyard is a real 2023 dining pavilion the massing does not model (Apple z20: dark pitched
roof, three vents) — the flight saw bare ground, so it joins `POST_2014_OSM_RINGS` and keeps its
stated one-storey guess.

One name-matching class fell: the storeys map's fuzzy match exists for honorific drift ("Fred
N. Spiess Hall" → "Spiess Hall"), but it also let a name that merely CONTAINS a real building's
name walk off with that building's record — the Hubbs annex failure. Matching is two-pass now:
every exact claim registers first, and fuzzy may not take a claimed record. The campus-wide
rebuild diff shows exactly the intended drops, plus two buildings the old order had wrongly
starved (T-30 and Laurel now wear their own agreeing one-level records).

The withhelds, better absent than wrong: Birch's gallery hall (above), and two rings whose
guesses stand because no source resolves them — the bluff-rim terrace compound NW of NOAA
(1,000 returns, none a metre above the rim grade: the "roof" is the upper terrace and the real
structures descend the cliff below it — an extrusion cannot say that shape honestly) and a
Shores house under 73 % eucalyptus. The rejections: Kaplan Lab's two rings agree at 8.1/8.2,
nothing to fix; T-31 measures its own clean 5.0 and is pinned so its audited siblings' fixes
never leak onto it; and an unnamed re-trace 75 % covered by the university's "9369 Discovery
Way" mass needs no entry at all — the r2c1 unnamed-ring floor already suppresses it.

**The east-of-I-5 judge pass (2026-08-05, r2c2).** The medical / Aventine / Village Square /
Temple corridor. Fifteen screened candidates; eight were real fixes, and the rest were dates,
composites with no parts-level source, or numbers already correct. Every candidate was
re-derived from a full-depth targeted EPT re-sample before judgement.

| Entity | Was shipping | Now ships | Why |
|---|---|---|---|
| Hyatt Regency La Jolla at Aventine | 45.1 m (tower paste over the whole ring) | **16 m (OSM tag, stated guess)** | one OSM ring wraps the hotel tower AND the low podium / circular terracotta pavilion. 11,029 returns are bimodal — 49 % in a dense 4 m podium band, the rest a tower plane at 41–52 m — so roofOf's p75 landed ON the tower and lifted the podium ~40 m. Neither single extrusion is honest (no OSM parts); the audit emits nothing until a parts-level source exists. |
| Mid-rise west of I-5 (unnamed, osm:95) | 12 m (area guess) | **30.9 m** | clean mid-rise plane, 5,723 returns, p25 25.9 to p98 30.9; under by multiple storeys. |
| Big-box retail west of I-5 (unnamed, osm:198) | 20 m (area guess) | **8.1 m** | 96,121 returns, 86 % in a 6–7 m band — a one-storey commercial roof the guess made two storeys too tall. |
| Temple-north deck (unnamed, osm:337) | 12 m (area guess) | **3.5 m** | 92 % of 6,748 returns in a 1–2 m band; a low pavilion beside the temple lawns. |
| L-block west of I-5 (unnamed, osm:288) | 12 m (area guess) | **4.6 m** | 74 % in the 4 m bin; the p98 tail is canopy the guard discards. |
| Mid commercial east of I-5 (unnamed, osm:305) | 16 m (area guess) | **9.6 m** | 91 % in the 8 m bin; a single 940 m LiDAR glitch is discarded by p98. |
| Medical / Aventine-south strip (unnamed, osm:51 / 62) | 12 m guesses | **16.9 / 16.2 m** | tight guarded mid-rise planes (69 % / 83 % in the 16 m bin). |

The epoch work: the multi-deck parking structure west of I-5 / the Blue Line trolley (osm:785)
joins `POST_2014_OSM_RINGS` — today's Apple shows cars on a finished top deck, the 2014 returns
read a near-grade plane (p50 0.8 to p75 1.2), the VA garage precedent again. Its stated 16 m
guess stands.

The withhelds, better absent than wrong: the helipad medical tower + lower wing (osm:83 — dense
band at 31 m, tower at 52–63, two buildings in one ring), the stepped Aventine wing (osm:497 —
14 m and 18 m planes), the Belmont-adjacent canopy ring (osm:289 — body already matches the
12 m guess), and the Temple's multi-tier / spire mass (keeps its existing 21.6; no parts source
can carry the lower terraces and the spires in one extrusion). Belmont Village's named short
wing already measures correctly at 9.1 — the taller complex rings are unnamed, which is an
identity coverage question, not a height bug on this ring.

**The NW-campus re-sweep (2026-08-05, r0c0).** Estancia / Sanford / Marshall Residence / coastal
fringe — a second pass after the first r0c0 sweep closed the named-landmark holes. Residual
error mass was the unnamed area-guess set. Every candidate re-derived from a full-depth targeted
EPT re-sample before judgement.

| Entity | Was shipping | Now ships | Why |
|---|---|---|---|
| Estancia-adjacent pad (unnamed, osm:331) | 12 m (area guess) | **5.3 m** | 11,034 returns, 79 % in a 4–5 m band; guarded plane against a two-storey overguess. |
| Sanford-lawn service cluster (unnamed, osm:149) | 12 m (area guess) | **5.6 m** | 90 % of 2,973 returns in a 4–5 m band — one tight storey. |
| Estancia amenity roof (unnamed, osm:974) | 9 m (area guess) | **3.7 m** | 65 % in the 3 m bin; guarded. (Targeted probe 3.8; build tiling.) |
| Coastal graded structure (unnamed, osm:1372) | 12 m (area guess) | **7.3 m** | 73 % in a 3–6 m band on a sloped site. |
| ERC-west low pad (unnamed, osm:878) | 9 m (area guess) | **5.9 m** | 97 % in the 5 m bin. |
| Coastal-fringe structure (unnamed, osm:483) | 12 m (area guess) | **8.3 m** | body-tight plane from the class-hole sample. |
| Marshall Residence Hall V | 9.1 m (GIS L3, unchallenged) | **6.8 m** | hostless letter-name; `PRE_2014_GIS_VERIFIED` lets the 1960s housing answer — mode 6 m at 74 %, guarded p75. |

The withheld: osm:513's coastal-scrub pad — Apple shows a finished low structure today, but the
2014 returns mix near-ground / deck (p50 0.2, body not tight); the 9 m guess stands. Rejected:
Sanford's lab-bar "mechanical overheight" — the dense 19 m deck and the 22–24 m central plant
are both real on today's Apple; without a parts split, trading the pinned 24.5 for the deck
would paste the other way. Pavilion stays 6.2.

**The North-campus re-sweep (2026-08-05, r0c1).** Warren / Rady / Marshall Upper / Spanos /
Asante — a second pass after the first r0c1 sweep closed the union-outline holes. Every
candidate re-derived from a full-depth targeted EPT re-sample before judgement.

| Entity | Was shipping | Now ships | Why |
|---|---|---|---|
| Asante House Meeting Rooms | 7.1 m (`massHeights` p98) | **4.0 m** | 88 % of 1,854 returns in a 3–4 m band matching the L1 record; p98 rode 43 points in the 7 m bin (gap 3.1 under the 5 m canopy guard). Thin-shelf rule: body tight + gap > 2 + dense 2 m band ≥ 85 % → p75. |

Rejected, each re-measured: Spanos APC "needs a multi-storey estimate" — TCA project profile
says Number of Floors 1, tallest panel 24 ft 6 in; the 4.4 m audit (and the eucalyptus bar)
stands. Otterson / Copley "dense deck vs roofOf" — real upper volumes (plant/solar; stepped
conference), dense bands 74 % / 79 % under the 85 % cut. Marshall Upper H/L canopy tails —
bodies already match GIS 6.1; pinned against a future auto-admit. Stewart multi-modal —
stepped Warren residence, no single plane to prefer. Roof-anchor class — still the
cross-shard renderer handoff (Hopkins / Canyon Vista admin / Cuzco / VE4).

**The North-campus pass-2 (2026-08-05, r0c1).** Same shard, second decide pass. Every
candidate re-derived from the screener's full-depth EPT (point counts taken as the
re-measurement) and Apple snapshots before judgement.

| Entity | Was shipping | Now ships | Why |
|---|---|---|---|
| Seventh College East #6 | 10.7 m (`massHeights` p98) | **8.4 m** | 88 % of 2,835 returns in an 8–9 m band matching GIS L2=8.5; p98 rode the recessed central HVAC well Apple shows today (gap 2.3). Thin-shelf rule already in the builder — the shipped file still held the pre-splice p98. |

Rejected, each re-measured: ERC Laundry East "needs POST_2014" — ERC opened 2003; the
near-grade GIS ring is an under-read, and host 2.6 already matches GIS L1≈3. Marshall
Residence Hall N — dense 81.8 % under the 85 % cut (Otterson family); roofOf 15.2 stands.
Pangea Parking — open-deck multimodal (dense 60 %); laser's 5.7 stands, do not invent
from the photo. Roof-anchor class — membership grew (VW2 / Robinson Library / Otterson);
still the cross-shard renderer handoff.

**The east-campus re-sweep (2026-08-05, r0c2).** Hospital district / CSC yard / Preuss /
Qualcomm AA — a second pass after the first r0c2 sweep measured the nameless rings. Every
candidate re-derived from the screener's full-depth EPT (point counts matched) before
judgement; thin-shelf arithmetic re-checked per sample.

| Entity | Was shipping | Now ships | Why |
|---|---|---|---|
| Campus Services Complex - Building H | 7.0 m (`massHeights` p98) | **4.8 m** | 92 % of 743 returns in a 4–5 m band matching the L1 record (4.3); p98 rode 34 points in the 7 m bin (gap 2.2). The r0c1 cut at 2.5 missed it by 0.3 m — gap cut is now > 2 (half a storey). |

Rejected / withheld, each re-measured: Anderson 835 / Prebys north 772 / canopy 508 — epoch
still bars any 2014 plane (slab/staging/bare ground); OSM guesses stand without a Street-View
floor count (VA-garage family). Main Scripps 503 — no single plane (p75 9.5 under towers at
32); documented 20 m guess stays. Transit Trailer — gap 0.9 over a 98 %-dense body, noise not
a shelf. Qualcomm AA terrain apron — height 24.3 is correct; most vertices clamp south of
`z0=−1383`, a survey-box coverage handoff. Roof-anchor at osm:502 (−2.7) — same cross-shard
renderer class. Preuss pitch — painted on Apple, unfitted; better absent than wrong.

**The Muir / La Jolla Farms re-sweep (2026-08-05, r1c0).** West campus — Tenaya, Tuolumne,
Keeling, HDH, Geisel House, LJF estates. Every candidate re-derived from the screener's
full-depth EPT (point counts taken as the re-measurement); thin-shelf arithmetic and Apple
currency re-checked per sample.

| Entity | Was shipping | Now ships | Why |
|---|---|---|---|
| Tenaya Hall | 27.6 m (`HAND_AUDITED`) | **22.4 m** | Dense L7 body (49–66% in the 22 m bin) matching the GIS record (21.3); p98 27.5 is rooftop HVAC (9–14%). Canopy guard already preferred p75 — the 2026-08-03 audit overrode it. Apple: flat H-plan roof with mechanical plant, not a taller wing. |
| osm:903 / 1028 / 1094 (LJF) | 9 / 9 / 4.5 m area guesses | **2.8 / 3.2 / 3.4 m** | Thin-shelf host rule (same cut as massHeights): dense ≥85%, gap >2, bodyTight → p75. First decide pass required planeTight and withheld them; plain roofOf would still ship the crown. |
| osm:481 (Geisel pavilion) | 4.5 m guess (prior "no structure") | **6.2 m** | Apple z20 shows the square pyramid-roof pavilion beside the pond; 542 returns, gap 0.5, one plane. |

Rejected / withheld: Tuolumne S House North/East — dense 81%, under the 85% cut; roofOf
upper shelf stands (Otterson family). osm:996 — dense 84%, near-miss. osm:480 — multimodal
estate on 7.3 m of grade, no single plane. Muir west pickleball — painted on Apple, unfitted
until registration passes the 0.6 m gate; do not restore Google tennis paint.

**The academic-core re-sweep (2026-08-05, r1c1).** Same shard as the 2026-08-04 decide pass —
Warren Mall to the VA fringe — with a fresh screen of 19 candidates. Every height re-derived
from the screener's full-depth EPT; Apple currency re-checked per site.

| Entity | Was shipping | Now ships | Why |
|---|---|---|---|
| Pad east of Chancellor's dig (unnamed, osm:759) | 4.5 m phantom | **removed** | Same demolition class as osm:56 / 1351 — Apple bare graded dirt with staging trailers south; 2014's tight 6–7 m plane is gone. |
| Epstein / PCW fringe (unnamed, osm:840 + 898) | 9 / 4.5 m guesses | **removed** | Rings sit on the amphitheater plaza fringe; Epstein is POST_2014 and the 2014 returns are grove/scatter. A guess invents a hall on a bowl. |
| Mayer hex connector (unnamed, osm:917 + 918) | 8.4 / 4.8 m solid extrusions | **removed** | Apple shows the six-hexagon elevated walkway between Mayer Hall and its Addition; solid fill under the deck is wrong by construction. |
| Central Utilities cooling bays (unnamed, osm:225 / 226) | 9 / 4.5 m area guesses | **8.1 / 8.4 m** | Sibling of the TES tank: one plane each (3,208 / 1,193 returns), standing on today's Apple as the fan enclosures. |

Rejected / withheld, each re-measured: McGill / Literature / MedTeach-A — dense 82–84%, under
the 85% thin-shelf cut; roofOf shelves stand. Pacific / NatSci / BRF II — stepped science
labs, Sanford class. Gilman garage already ships its measured 18 m deck against a GIS L6
overstatement. South Parking — massOk=false deck stack, Urey host paste of 19.2 stands.
Faculty Club — HAND_AUDITED 6.5 is the gable ridge, not a Solis-class eave miss. Tata —
POST_2014, GIS 25.6 ships unchallenged. Strauss-edge osm:1352 and trolley osm:827 keep their
guesses. VAF-3 GIS/OSM position double remains open (coverage 0; no source resolves which
footprint is Building 3).

**The health-campus / Pepper Canyon re-sweep (2026-08-05, r1c2).** Fresh screen of 13
candidates (4 high / 6 medium / 3 low). Every height re-derived from the screener's
full-depth EPT (59 targets); Apple currency re-checked per site.

| Entity | Was shipping | Now ships | Why |
|---|---|---|---|
| One Miramar Street, building 3 / 4 | OSM 13.1 **and** GIS 15.2 (double) | **13.1 / 13.2 once each** | Case-insensitive exact-name twin: OSM lowercase vs GIS "Building N" broke the carrier test while area coverage sat at 0.85 / 0.86. Same twin path now keys massHeights so the L5 storey default no longer stands unchallenged. |
| Outpatient Pavilion (Koman) | 17.1 m GIS L4 over a 2014 empty lot | **17.1 m, epoch-listed** | Opened 2018-03-12; 11,304 returns read near-grade (roofOf 0.8). Joins Altman / Athena in `POST_2014_SITES` — the record ships, the lot plane never does. |
| Piedra / Tierra (Nuevo East) | LiDAR 19.4 / 17.8 (predecessor Mesa fabric) | **36.6 / 15.2** | HDH opened July 2020; Mesa Nueva and Nuevo West were already listed, Nuevo East was the miss. Piedra keeps `fac.newer`; Tierra falls back to the facilities L5 record. |
| Hamilton Glaucoma / Jacobs Retina | 12.7 m massHeights p98 | **9.4 m** | Thin-shelf rule: 86% in 9–10 m, gap 3.3 → p75. Mechanical plant was the shelf. |
| Unnamed modular pads (osm:776 / 766) | 4.5 / 4.5 m area guesses | **4.0 / 6.2 m** | Clean one-storey planes beside the already-admitted 775 / 9435 banks and on the VA corridor. Sibling 765 stays stepped-out. |
| Foodworx Dining Room | 4.3 m GIS L1 solid box | **removed** | 93% of returns at grade; Apple shows outdoor seating south of the real Foodworx gable (already 7.8). Better absent than a patio extruded as a room. |

Rejected / withheld, each re-measured: Pepper Canyon 1200 / 1800 — dense ~54%, real
dual-plane residential (Sanford class), roofOf stands. Perlman — dense 82.8%, under the
85% cut; shelf stays. Pepper Canyon / Foodworx tennis + pickleball courts — painted on
Apple, unfitted until registration passes the 0.6 m gate (Muir pickleball class).

**The Scripps / Shores re-sweep (2026-08-05, r2c0).** Fresh screen of 11 candidates
(3 high / 8 medium). Every height re-derived from an independent full-depth EPT
(point counts matched the screener's 3,113 / 2,192 / 2,873 / … exactly); Apple
currency re-checked per site.

| Entity | Was shipping | Now ships | Why |
|---|---|---|---|
| Shores-edge pad (unnamed, osm:1039) | 9 m area guess | **2.8 m** | Guarded dense body (3,113 returns, p50 2.5 / p75 2.8) under a canopy tail to 17 — ~2 storeys over. |
| Shores residential pad (unnamed, osm:1079) | 9 m area guess | **3.3 m** | Guarded one-storey plane (2,192 returns); Apple shows finished roofs / pools today. |
| Shore-colony house (unnamed, osm:1143) | 9 m area guess | **5.1 m** | Clean single plane (2,873 returns); sibling of already-admitted 1141 at 5.3. |
| Discovery Way west pad (unnamed, osm:1055) | 9 m area guess | **4.8 m** | Guarded body under a canopy tail (1,169 returns). |
| Shores pad, thin shelf (unnamed, osm:1059) | 9 m area guess | **3.8 m** | Thin-shelf host rule: dense 90.6% in 3–4 m, gap 4.3 → p75. Unguarded roofOf would have pasted the 8.1 shelf. |

Rejected / withheld, each re-measured: osm:1075 / 825 — bodyTight=false canopy smears
(1068 eucalyptus family); guesses stand. IGPP Revelle 2000 — dense 84.9% under the 85%
thin-shelf cut (Perlman / McGill near-miss); massHeights 11.3 stands. NOAA dual geometry
— heights already correct via `MEASURE_MINUS_CONTAINED` (wings 13.5 + core 13.8); the
~0.3 m overlap is intentional dual coverage, not a height bug. Coast / Discovery
hostless GIS pads — L2=6.1 already matches the dense ~5.6 body; canopy neighbours stay
`massOk=false` so roofOf 17 never auto-admits.

**The theatre-district / Village Square re-sweep (2026-08-05, r2c1).** Fresh screen of 9
candidates (3 high / 5 medium / 1 low). Every height re-derived from an independent
full-depth EPT (point counts matched the screener's 1,757 / 1,362 / 2,134 / … exactly);
Apple currency re-checked per site.

| Entity | Was shipping | Now ships | Why |
|---|---|---|---|
| Village Square commercial (unnamed, osm:103) | 4.8 m OSM under-tag | **8.2 m** | Clean single plane (1,757 returns, p50 7.3 / p75 7.4); sibling of already-admitted 333 at 8.2. |
| Village Square commercial (unnamed, osm:334) | 4.8 m OSM under-tag | **7.7 m** | Clean single plane (1,362 returns); sibling of already-admitted 335 at 7.7. |
| Pad south of La Jolla Village Dr (unnamed, osm:129) | 9 m area guess | **11.3 m** | Textbook single plane (2,134 returns, p50 11.0 / p75 11.1 / p98 11.3). |

Rejected / withheld, each re-measured: osm:707 — dense body already matches the 4.8 guess
(Δ 0.4); roofOf 6.7 is HVAC (gap 1.5 under the 2 m cut). osm:708 — multimodal (dense
29.7%), no clean body; guess stands. Union Bank / UC Cyclery — thin-shelf near-misses on
the same strip (dense 79.9% / gap 1.5 under cut); Apple shows HVAC on both finished roofs,
so roofOf 8 / 6.8 stands. James' Place inside the Forum ring — heights already correct
(5.1 / 10.5); residual is an OSM outline handoff, not a height bug. Class-hole rejected
as scoped.

**The east-of-I-5 / Sheraton-strip re-sweep (2026-08-05, r2c2).** Fresh screen of 16
candidates (6 high / 9 medium / 1 low). Every height re-derived from an independent
full-depth EPT (point counts matched the screener's 4,425 / 5,485 / 7,470 / … exactly);
Apple currency re-checked per site.

| Entity | Was shipping | Now ships | Why |
|---|---|---|---|
| Sheraton-strip pad (unnamed, osm:1366) | 9 m area guess | **5.2 m** | Thin-shelf host rule: dense 91.9% in 5–6 m, gap 4.6 → p75. Unguarded roofOf would paste the 9.8 shelf. |
| Sheraton wing (unnamed, osm:1365) | 9 m area guess | **5.1 m** | Guarded one-storey plane (5,485 returns, p50 = p75 = 5.1 under a canopy/HVAC tail to 12.5). |
| Temple-corridor courtyard (unnamed, osm:285) | 12 m area guess | **8.4 m** | Thin-shelf host rule: dense 87.3%, gap 2.1 → p75. |
| Whole Foods / CVS pad (unnamed, osm:81) | 4.8 m OSM under-tag | **7.7 m** | Clean single plane (6,304 returns); sibling of Village Square under-tags. |
| Courtyard block (unnamed, osm:287) | 12 m area guess | **8.4 m** | Guarded mid-rise plane (5,801 returns) under a canopy tail to 14.2. |
| Courtyard block (unnamed, osm:286) | 12 m area guess | **10.1 m** | Clean p98 (dense 87.1%, gap 1.6 under the thin-shelf cut — plant noise, not a shelf). |
| Large courtyard mid-rise (unnamed, osm:1356) | 16 m area guess | **13.2 m** | Clean single plane (24,983 returns, p50 12.1 / p75 12.2). |
| Large courtyard mid-rise (unnamed, osm:1355) | 16 m area guess | **13.8 m** | Clean single plane (21,686 returns); sibling of 1356. |

Rejected / withheld, each re-measured: osm:1364 — dense 78.7% under the 85% thin-shelf cut
(Sheraton near-miss); guess stands. osm:704 / 705 — stepped mid-rises (dense 2 m band
47% / 44%); no single plane. osm:257 / 258 — dense body ≈ the 12 m guess; roofOf rides an
upper wing. Medical — dense 85.8%, gap 1.9 under the 2 m cut; roofOf 10.7 stands. Hyatt /
helipad osm:83 — prior composite withholds (HAND_AUDITED null / bodyTight=false); no
parts source. Class-hole rejected as scoped.

**The NW-campus pass-2 re-sweep (2026-08-05, r0c0).** Same Estancia / Sanford / Marshall /
La Jolla Farms shard after pass 1 closed the first six unnamed admissions. Residual error
mass was still the unnamed area-guess set (73 rings). Every candidate re-derived from an
independent full-depth EPT (point counts matched the screener's 1,881 / 1,705 / 1,521 / …
exactly); Apple currency re-checked per site.

| Entity | Was shipping | Now ships | Why |
|---|---|---|---|
| Black Gold Rd house (unnamed, osm:976) | 9 m area guess | **4.6 m** | Clean one-storey plane (1,881 returns, dense 75% in 2–3 m). |
| Estancia amenity pad (unnamed, osm:328) | 9 m area guess | **4.7 m** | Canopy-guarded p75 (dense 82% in 3–4 m; gap 5.0 to canopy at 9.7). |
| Estancia amenity pad (unnamed, osm:330) | 9 m area guess | **4.8 m** | Canopy-guarded p75 (gap 7.5); sibling of 328 / 974. |
| Black Gold Rd house (unnamed, osm:830) | 9 m area guess | **5.0 m** | Clean one-storey plane (1,333 returns, dense 74% in 3–4 m). |
| Black Gold Rd building (unnamed, osm:871) | 9 m area guess | **6.1 m** | Tight single plane (gap 0.3, dense 87%). |
| Crown Crest Ln house (unnamed, osm:972) | 9 m area guess | **6.1 m** | Body-tight plane (1,715 returns). |
| La Jolla Farms Rd house (unnamed, osm:977) | 9 m area guess | **6.3 m** | Body-tight plane (2,321 returns). |
| La Jolla Farms Rd house (unnamed, osm:493) | 9 m area guess | **6.3 m** | Clean p98 (dense 84%, gap 2.0 under the thin-shelf cut — plant noise). |
| LJF residual sibling (unnamed, osm:969) | 9 m area guess | **6.3 m** | Clean single plane (gap 0.4); same class as the mediums. |

Withheld: osm:828 — near-ground / deck returns (p50 0.5, hist mode 0 m at 70%); Nominatim
has no building address on the Salk Institute Road fringe; Apple center reads pavement /
scrub. Do not invent a 1.7 m building; the 4.5 m guess stands. osm:513's coastal-scrub
withhold from pass 1 still stands. Class-hole rejected as scoped — remaining unnamed
guesses need per-ring Apple + EPT, not a blanket admit.

### The colours, measured off footage

Satellite imagery sees roofs and ground; it cannot see a wall, a tree trunk, or the sky. For
those, the measurement source is two 4K videos of the real campus — a 53-minute eye-level
walking tour (Nov 2023, clear noon) and a 10-minute drone tour (Nov 2022, marine layer) —
340 extracted frames, each colour below median-sampled from sunlit pixels, never eyeballed:

- **Facades** (`docs/data/campus-facades.json`): per-building wall colours corrected from the
  earlier web-research impressions to frame measurements, and the file grew `styles` (which
  facade tile a building wears — vertical fins, egg-crate, curtain glass, ribbon glazing,
  open balconies, blank bands) and `accents` (trim/glass/panel/roof tones for the multi-material
  buildings). Eye-level frames win facades; drone frames win roofs. `tests/campus-facades.test.mjs`
  keeps every entry keyed to a building the data actually ships.
- **Ground families** (`docs/js/campus-world.js`): the big pavement family is neutral-to-cool
  grey (`#aaaea8`), not beige — six independent frame samples of Ridge Walk, Library Walk and
  Warren Mall converge there. Roads split darker (`#5e6163`) from worn path asphalt. Lawns are
  three families, chosen per polygon from the aerial sample itself: dry turf, irrigated turf,
  and the tan bark duff under the eucalyptus groves — a grove floor is bark, not lawn.
- **Trees** (`docs/js/campus-species.js`): species from the LiDAR's own numbers — tall-and-narrow
  is a eucalyptus (pale bare trunk, small olive crown high up), short-and-broad is a torrey-pine
  umbrella, the middling round crowns split between the lawn species. Frame-sampled foliage and
  trunk hues per species, deterministic per tree, with the stressed near-brown canyon crowns the
  November footage shows. `tests/campus-species.test.mjs` pins the rules.
- **Sky and light**: the measured sky is a gradient (zenith `#3a7cc8` over horizon `#b5d2e6` —
  six frame-measured zeniths), carried by a camera-following dome; the sun sits at November's
  ~35°, the hemisphere ground bounce is pavement-grey instead of olive, and lit-vs-shade
  contrast matches the ~2× luminance drop the frames measure.
- **The furniture** (`docs/js/campus-details.js`): in 340 frames no object appears more often
  than the black lamp post with its banner pair, so the walks now carry them — placed
  deterministically along the named majors at the footage's 18 m rhythm, banner colours by
  zone, plus the perforated bench blocks lining Library Walk, the royal-blue emergency towers,
  and chrome-yellow hydrants. One-offs along the main walks — the Revelle Plaza ring fountain and
  flagpole, the Ridge Walk pergola swing stations, the Mayer/Bonner folded-plate canopy — live
  in `campus-landmarks.json` with frame-measured colour blocks. `tests/campus-details.test.mjs`
  keeps every placement out of the buildings and on its rhythm. 

- **The Muir athletics zone** (`docs/js/campus-athletics.js`, `campus-recreation.js`,
  `campus-muir-field.js`, `campus-goal.js`): built 1:1 from seven aerial reference captures — the Main Gym's
  eleven pale barrel vaults with their transverse walkway seams, the Natatorium's white
  skylight grid with the lap-lane blues reading through the glass and the spa on its
  terracotta deck, both tennis pads in their real two-block identity (green-on-red west,
  blue-on-grey east) with nets and light poles, basketball hoops, the sand volleyball courts
  and their nets, Triton Bar Park's calisthenics rigs on black rubber, the rec terrace's mats
  and canopy tents, parked cars in Gymnasium Lot, and John Muir Field's dark turf with its
  softball fans, wordmark strips, goals and end netting. Every colour median-sampled from the
  captures; each module's placement rules are pinned by its own test file.

  A goal is frame **and** net. For as long as the model had goals it had only the frame —
  two posts, a crossbar and a shallow back rake, over a comment claiming the rake ran "to
  the net" for a net nothing in the repository drew — so from above, the one view that sees
  a whole pitch, the goals read as absent. `campus-goal.js` now builds both, and builds them
  for any pitch rather than for Muir's. **Law 1 measures the air, not the steel**, and that
  cost 12 cm one way and 6 cm the other before it was believed: the 7.32 m is between the
  posts' INNER edges, so the posts stand half a gauge outboard of the mouth line where the
  inline version centred them on it, and the 2.44 m is the crossbar's LOWER edge, so the bar
  rests on the posts where the first draft of this module centred it at the height instead
  and hung a 2.38 m mouth under a bar driven through the top of both posts. Every horizontal
  member now sits on its uprights, and a test asserts the derived edges rather than the
  centres that are easier to reach — the earlier one named the lower edge in its failure
  message while checking the centre, so it passed on the wrong geometry. The net is hung as
  real cords on a 0.12 m square mesh — the coarse end of
  the 100–120 mm full-size nets are made in — up the back, over the rake from crossbar to
  back rail and closing both sides, drawn as lines rather than modelled members because
  2–4 mm twine is far below a pixel at every distance a walker sees a goal from. It is given
  no sag: the nadir aerial is the one view a sag is invisible from, so the rake stays
  straight rather than curved by invention.

- **RIMAC Field** (`docs/js/campus-rimac.js`, plus its four pitches in `campus-markings.json`):
  the same two-source split, stated harder.

  **The flats are FOUR pitches, two columns by two rows** — and the model carried two, both in
  the *western* column, with the entire eastern column missing. The columns are the touchlines'
  own projection peaks (west x 74.9–140.6, east x 142.1–202.9, two lines 1.5 m apart at the seam
  between them); the rows come from scoring the whole rulebook at once — goal lines, halfway,
  penalty areas and goal areas at their fixed offsets — so a ghost line or a kerb cannot pass for
  a pitch by producing one peak. Three of the four are painted, at 0.78 / 0.91 / 0.84 coverage
  and 0.22–0.25 m offset. The north-east is **not**: the registered imagery holds its two
  touchlines and nothing else — no circle, no halfway line, no goal line, no boxes — so no
  regulation set can be fitted to it, its entry stays so a future imagery refresh re-measures
  it, and the coverage gate is expected to keep dropping it. The east column also carries a
  second complete generation 18.1 m north of the current south-east pitch, which fits *better*
  (0.90) than the pitch that is actually there; what separates them is that the south row is a
  **row**, and a test pins it. RIMAC's four run a tighter gate than the rest of the build —
  0.75 coverage and 0.35 m — because this is where a loose fit got through once.

  The complex's southern corner is a **regulation softball field**, and it is measured, not
  assumed: both painted foul lines least-squares fit the georeferenced chunks at 2.75° and
  92.44° north of east (rms 0.050 m / 0.054 m) — **89.69° apart**, so the diamond is modelled
  as a true right angle on their bisector, which then lands back on both fits to under 0.25 m
  over 58 m. Home plate is their intersection. The pitching circle is found twice over, as the
  centre of the circle fitted to the skinned infield's arc and as the object parked on the
  plate — 0.14 m apart, 42.1 ft from home where the rulebook says 43 — and that skin arc comes
  out at 60.3 ft, the rulebook's 60 ft grass line, a radius nothing was fitted to. The outfield
  then falls out at ~190 ft down both lines and 209 ft to centre, so the fence stands at about
  200 and 220. Also built: the warning track as a band of its four separately measured widths,
  the outfield fence with its dark windscreen, the east perimeter fence against North Torrey
  Pines Road (rms 0.246 m over 428 rows), the three-block west bleacher, and the flats'
  **patchy turf** — a 3.54 m tercile map sampled off the georeferenced chunks and painted in
  colours measured off the current Apple captures, because where the dry ground is has to come
  from the registered source and what it looks like today from the current one. That map is
  sampled on ONE quad spanning all four pitches, its edges the outermost painted lines the four
  of them own; it used to be keyed to each fitted pitch's own bounds, which tied how the
  *ground* looks to whether that pitch's *paint* cleared a gate. No backstop is
  modelled: nothing in either source resolves one. Every VERTICAL dimension here is a stated
  convention — nadir imagery cannot see a height and the 2014 LiDAR ships no raw returns.

```
docs/            the site — GitHub Pages serves this directly, no build step
  index.html     standalone page + development panel
  js/
    campus-walk.js      the frame loop: the download table, the camera, the HUD, boot
    campus-boot.js      the loading screen: phase weights, the real-bytes bar, the overlay (no imports)
    campus-facts.js     the numbers that screen quotes, derived from the loaded data (no DOM)
    campus-world.js     the world: terrain (NAIP vertex colours), surfaces, paths, trees, boundary
    campus-massing.js   buildings: the university GIS's per-mass extrusions
    campus-explore.js   free roam: position, hover, the velocity and climb models (no DOM)
    campus-clearance.js how far the camera is above the nearest roof — what Q/E's rate follows (no DOM)
    campus-minimap.js   the minimap: aerial underlay, boundary ring, click-to-teleport
    campus-landmarks.js labels + placed landmarks (Fallen Star, Sun God…)
    campus-route.js     A* over the real footpath graph (no DOM, no three.js). An analysis
                        library, not runtime: nothing on the page routes any more, and
                        audit-accuracy.mjs checks our footpaths through it against a real
                        pedestrian router
    campus-ground.js    the surveyed ground polygons: clip + tile at load (no DOM)
    campus-terrain.js   height sampler, chunk grid, boundary rings (no DOM)
    campus-rimac.js     RIMAC Field: softball field, fencing, bleacher, patchy turf
    campus-drape.js     shared draping geometry: fills, ribbons, bands, merged solids
  data/
    campus-3d.json         OSM footprints, paths, plazas
    campus-lidar.json      measured heights, terrain grid, trees
    campus-arcgis.json     the university GIS: masses + ground polygons
    campus-colors.json     NAIP aerial colours: terrain grid, roofs, ground
    campus-truecolor.json  measured colours from the Google chunks (see below)
    campus-facades.json    facade palettes
    campus-landmarks.json  placed landmarks
    campus-boundary.json   the campus boundary polygon, local metres
    campus-markings.json   sports-surface markings, fitted to the imagery
    textures/              satellite ground chunks + manifest.json
  vendor/three/  three.js r169, vendored
scripts/
  build-campus-3d.mjs        Overpass -> docs/data/campus-3d.json
  build-campus-lidar.mjs     USGS LiDAR -> docs/data/campus-lidar.json
  build-campus-arcgis.mjs    university GIS -> docs/data/campus-arcgis.json
  build-campus-colors.mjs    NAIP -> docs/data/campus-colors.json
  build-campus-truecolor.mjs textures/ chunks -> docs/data/campus-truecolor.json
  build-campus-satellite.mjs boundary + satellite source -> boundary json, textures/
  lib/imagery.mjs            the imagery providers: Google tiles, Apple snapshots
  audit-imagery-source.mjs   resolved detail per metre, source vs source
  build-campus-markings.mjs  textures/ chunks -> docs/data/campus-markings.json
  audit-accuracy.mjs         R2 cross-source audit -> scripts/reports/
  serve.mjs                  static server for docs/
tests/
  campus-walk.test.mjs     the invariants that have actually broken
  campus-arcgis.test.mjs   the survey layer: masses, ground polygons, colours
  campus-gameplay.test.mjs the removed footway, spawn, speed cap, minimap arithmetic
  campus-flight.test.mjs   the flight model: the velocity axis, the clearance-driven climb
  campus-facts.test.mjs    the loading screen's arithmetic: areas, lengths, counts
  campus-textures.test.mjs the satellite layer: manifest vs grid vs boundary, ground coverage
  campus-imagery.test.mjs  the source layer: patch georeferencing, the Apple signing scheme
  campus-truecolor.test.mjs the measured-colour layer: keys resolve, gamut holds, turf beats pavement
  campus-markings.test.mjs the painted lines: bounds, widths, 9.15 m circles, 9 lanes
  campus-rimac.test.mjs    RIMAC Field: the regulation cross-checks, the turf quad, the fences
```

## Running it

```bash
npm install
npm run serve      # http://localhost:5170
npm test           # node --test, no network, no browser
npm run check      # verify the shipped data files without refetching
```

Rebuilding the data needs the network and takes a few minutes:

```bash
npm run build:osm        # Overpass. Tag filters go BEFORE the bbox or it 406s.
npm run build:lidar      # ~102 tiles, 3.3M points, decoded with laz-perf
npm run build:satellite  # boundary polygon + satellite ground chunks
```

All three write into `docs/data/`, so a rebuild is a normal reviewable diff.

`build:satellite` builds only the terrain chunks that touch the boundary polygon (87 of 132
over the full campus), fetches only source imagery that touches it too, hard-caps itself at
3,500 requests per run, and caches raw imagery under `.cache/<source>/` so a rerun refetches
nothing. The chunks it writes are the SOURCE imagery for the colour and markings pipelines
above — they never render in-world.

### Which satellite, and how you would know

The imagery source is a provider (`scripts/lib/imagery.mjs`), chosen with `--source`:

| | zoom 19 | zoom 20 | credential |
|---|---|---|---|
| `google` (shipped) | 0.251 m/px | 0.125 m/px | `GOOGLE_MAPS_API_KEY` — Map Tiles API 2D satellite session |
| `apple` | 0.125 m/px | **0.063 m/px** | `APPLE_MAPKIT_TEAM_ID`, `APPLE_MAPKIT_KEY_ID`, `APPLE_MAPKIT_KEY_FILE` — a MapKit JS key |

Apple serves no tile endpoint a third party may use; the licensed way in is the Maps Web
Snapshot service, where one signed request returns one rendered image of a stated centre,
zoom, size and scale — a georeferenced patch by another name, because a snapshot at zoom *z*
sits on exactly the Web Mercator grid a tile at zoom *z* does. `scale=2` is the entire point:
the same zoom at twice the linear resolution. Two things the service forces, both handled in
the provider: images cap at 640×640 points, so a 255 m chunk needs several; and every image
carries Apple's logo and legal line burned in. Those are not removed — each snapshot is
cropped to its middle and the lattice steps by the cropped span, so a branded margin is always
covered by a neighbour's clean centre and no branded pixel is ever measured.

**Stated resolution is not resolved detail, and only the second one matters.**
`scripts/audit-imagery-source.mjs` measures both, per metre of ground rather than per pixel,
so sources at different pixel scales compare honestly:

```bash
npm run audit:imagery -- --facility=muir-tennis-west
```

Run against the shipped Google chunks it reports **0.25 m** of resolved edge detail out of
imagery stored at 0.125 m/px — two stored pixels per edge, where a source resolving its own
pixel scale would give one. Some of that softness is ours (the build's bilinear reprojection
and JPEG q80), so the number is not a verdict on Google's sensor alone; what it does measure
honestly is the detail that actually reaches the colour and marking pipelines, and it is
roughly half what the pixel count advertises. That is the measured company `muir-tennis-west`
keeps at 0.43 coverage: a 5 cm painted line does not survive a quarter-metre edge.

Both sources pass through the identical pipeline, so the comparison stays fair even though
neither number isolates the sensor. A source swap is only worth making if the audit shows the
new source resolving finer edges — not merely storing more pixels.

### Switching the source

A full rebuild is several hundred signed requests, so spend one first. `--probe` fetches only
the patches over a single facility, checks that the service still returns the size the
georeferencing contract assumes, correlates the result against the shipped chunks to prove the
imagery lands where the survey says it should, and measures whether it is actually sharper:

```bash
# .env: APPLE_MAPKIT_TEAM_ID, APPLE_MAPKIT_KEY_ID, APPLE_MAPKIT_KEY_FILE
node scripts/audit-imagery-source.mjs --facility=muir-tennis-west --probe=apple
npm run build:satellite:apple     # only if the probe justifies it
npm run build:truecolor && npm run build:markings   # re-measure from the new pixels
npm test && npm run check
```

A georegistration offset past ~0.6 m is a stop sign, not a detail: colours would be sampled
off the neighbouring surface, and a sharper source landing in the wrong place is worse than a
soft one landing in the right one.

Because the chunk grid, output resolution and manifest shape are identical either way, the
swap changes one thing and the audit measures one variable. Rebuilding the shipped Google
chunks through the provider path reproduces all 87 files byte for byte; only the manifest
gains its `source` / `sourceMPerPx` provenance, which every downstream measurement inherits.
A denser source is spent on supersampling (`k` source pixels averaged per output pixel), not
on bigger files — extra resolution has to arrive as accuracy, not as aliasing.

## The loading screen

Ten megabytes of survey has to land before anything can be drawn, so the wait is spent accounting
for itself. The percentage is the **real download**: `campus-walk.js` reads each response body as a
stream and reports bytes as they arrive, rather than counting whole files finished — a cold load is
~10 MB and the bar tracks it, revising the denominator upward if a host serves the JSON gzipped and
a body outruns its `Content-Length`. Ten weighted phases carry the rest (download, WebGL, terrain,
massing, ground, trees, details, chrome, first frame), each logging the file or the source it just
used. `docs/js/campus-boot.js` owns the progress engine and the overlay, imports nothing, and does
every DOM write inside one `requestAnimationFrame` loop — the geometry stages are long synchronous
blocks, and an earlier version that wrote straight from the reporter had its paints queue behind
them, so the bar stood still and then jumped from 6% to 62% in a single frame.

Beside the bar, around 28 statistics, **every one computed from the data as it loads** by
`docs/js/campus-facts.js`: terrain samples, grid spacing and surveyed area; trees placed and the
tallest of them; heights measured and the tallest building; footprints and their vertices; the path
network in kilometres; named places; surveyed polygons, their vertices and their area; aerial tones;
facades measured; landmarks; sports surfaces and painted markings — then, as each phase finishes,
the vertex and mesh counts the geometry actually came to.

That is the whole point of the module. The screen used to quote a hand-written sentence in
`index.html`, and it went stale in the way a hardcoded number always does: it claimed 12,659 trees
long after the prune left 7,331, and "1,800+ building masses" for a dataset carrying 1,396
footprints. A number on screen that nobody recomputes is a number that will be wrong, so nothing
here is written down — a fact that cannot be derived from the file that shipped is not shown at all.

The downloads are declared once, as a table in `campus-walk.js`, because a byte total is only
honest if the boot knows about every file. Two of them used to be fetched twice, once by the boot
and again by the module that needed them: `campus-boundary.json` is now handed to
`world.primeOverlay()` and `campus-markings.json` to `createMarkings(scene, heightAt, preloaded)`,
so each is downloaded once and passed along.

## Controls

You spawn hanging **110 m above Argo Hall** at **500 m/s** and holding that height over the
ground — nothing moves until you do. That is a survey speed, not a walking one: the campus is
3 km across, which is 1.5 seconds flat out, and the arrow keys wind it back down to a pace you
can look at things from.

| | |
|---|---|
| drag | look around |
| `W`/`A`/`S`/`D` | move where you are looking (`A`/`D` strafe) |
| `Q` / `E` | sink / climb — eye level to 900 m up, at a rate that follows your clearance above the roof or ground beneath you, so the whole range is about ten seconds either way (below) |
| `↑` / `↓` | speed, coarse — the whole range in under three seconds |
| `←` / `→` | speed, fine — about 1.5× per second, for settling on a pace |
| velocity slider | the same number the arrows drive — logarithmic, 0.6 up to **2000 m/s** |
| `shift` | double whatever the throttle says (travel and climb alike), but never past the 2000 m/s cap |
| minimap click/tap | teleport there — same heading, same height over the ground |
| teleport menu | jump to any of 360+ named places |
| `L` | building labels on/off |
| `H` | show or hide the development panel |

That is the whole list. There is no pause, no restart and no view toggle, because there is nothing
to pause and only one view.

**Q/E is governed by clearance, not by how fast you are travelling**, and the difference is the
difference between a usable control and an unusable one. The rate is `1.5 + 0.55 × clearance` m/s,
where clearance is your height above the nearest solid *below* you — the terrain, or a building roof
via `docs/js/campus-clearance.js` — doubled by shift and capped like everything else at 2000 m/s.
So it is ~2.6 m/s when you are parked two metres over a roof, ~62 m/s at the 110 m spawn, and
~496 m/s at the 900 m ceiling: altitude moves geometrically, the same reasoning the velocity slider
runs on and for the same reason, and eye level to the ceiling takes about 9.7 s either way. It
replaced a rate keyed to your travel speed, which made the control useless at both ends — at the
500 m/s spawn speed one tap of Q fell through the entire atmosphere, so parking the camera just
above a rooftop to look at it was impossible, and down at walking pace a 900 m descent took five
minutes. Drift off a roof edge while holding a key and the rate jumps, because the clearance really
did; that discontinuity is deliberately left unsmoothed. Note also that the clearance governs the
rate and does not stop you: hold `Q` over a roof and you still sink through it, slowly. Free roam
has never had collision, and being stranded on a rooftop would be the worse bug.

The minimap (top right) is the NAIP aerial itself, with you as the white dot with a view wedge and —
when `docs/data/campus-boundary.json` has been generated — the official campus boundary as a dashed
dark-navy ring over the surrounding La Jolla ground. The file is optional by contract: without it
the map simply has no boundary line and clicks still teleport.

One path is missing on purpose: the direct footway between Argo Hall and Peterson Hall was
removed from the shipped data **and** blacklisted in `scripts/build-campus-3d.mjs`
(`EXCLUDED_WAYS`, OSM way `1025633000`), so a rebuild keeps it out. Routing between the two
still works — A* goes round via the diverging walkway to the east (~785 m instead of ~795 m).
Nothing on the page routes any more; that A* is `campus-route.js`, which `audit-accuracy.mjs`
and the tests use to hold our footpaths to what a real pedestrian router says.

The development panel's **layer toggles** are the most useful thing in it. Nearly every rendering
fault found so far was invisible until whatever stood in front of it could be switched off — the
plaza drawn on the wrong side of the origin, the walls wearing the roof's colour, canopies
swallowing the camera.

---

## Things already learned the hard way

Kept because each one cost real time and none of them announced itself:

- **`ExtrudeGeometry` group 0 is the lids, group 1 is the side walls.** Passing `[wall, roof]`
  paints the roof colour onto every wall — the whole campus rendered as identical grey cardboard
  and no facade texture was ever visible.
- **A `Shape` rotated flat maps its second axis to *negative* world z.** Feeding it `(x, z)` mirrors
  the polygon across the origin. Revelle Plaza and its fountain were being drawn hundreds of metres
  away, so standing in the middle of the plaza put you on grass under a label reading
  "Revelle Plaza".
- **A plaza tagged `area=yes` is a surface, not a route.** Imported as a line it becomes a kerb
  tracing its own perimeter, and routing then refuses to cross it: Argo Hall to the middle of
  Revelle Plaza came out at 390 m, around a square you can see across. It is 55 m.
- **Flood-filling a canopy makes one tree out of a whole row.** A touching line of eucalyptus became
  a single tree with a 47 m crown. Trees are found as local maxima instead.
- **Crowns must clear head height** or the walk goes into a solid green wall.
- **Size the renderer from the canvas, not the window.** `setSize(innerWidth, innerHeight)` also
  writes that size as inline CSS, cropping the render and hiding whatever sits low in frame.
- **Overpass wants tag filters before the bounding box**, or it answers `406` rather than a syntax
  error.
- **A per-sample quantity resolved once, for the whole object, is a bug waiting on geometry.**
  The paint threshold correctly follows the imagery's resolution — and was read at the
  facility's centre and applied to every sample, which is right until a facility spans two
  chunks. RIMAC's north-west pitch crosses the zoom seam; half of it was judged against a
  threshold its own imagery cannot reach, it measured 0.53, and the 0.53 was read as "the paint
  isn't there" rather than "the metric is wrong here". Both halves of that sentence cost time.
- **A better fit can be the wrong object.** RIMAC's east column carries two complete painted
  generations 18.1 m apart. The older one fits at 0.90 coverage, the current one at 0.84, and
  no fit-quality metric will ever prefer the right one. What tells them apart is that the pitch
  has to line up with its own row — a fact about the layout, not about the paint.
- **A test that checks a different quantity from the one its message names is worse than no
  test.** `assert(bar.at[1] === 2.44, "the crossbar's lower edge is not at 2.44 m")` reads a box
  CENTRE, so it passed while the goal's mouth was 2.38 m tall and the bar ran through the top of
  both posts — and it would have gone on passing through exactly the change it existed to catch.
  Assert the derived edge, `at[1] - h/2`. The same shape of mistake hides anywhere a regulation
  is stated about a surface and the code stores a middle.

## Provenance

Extracted from the TritonPlan repository, where it began as a tile on the dashboard. Originating
commits: `194be3c` (the scooter game this grew out of, now parked), `548dfc3` (the move to measured
geometry). It will fold back into TritonPlan once it stands up on its own.

## Data licences

- Building outlines, paths, plazas and the campus boundary: © OpenStreetMap contributors, **ODbL**.
- Heights, terrain and trees: **USGS 3DEP** LiDAR (`CA_SanDiegoQL2_2014`), public domain.
- Measured colours and fitted markings derive at build time from the imagery source named in
  `docs/data/textures/manifest.json` — today **Imagery © Google** (Map Tiles API), current
  epoch; **Imagery © Apple** (Maps Web Snapshot) is the selectable alternative and carries its
  own credit line into the same field. No tile imagery renders in-world under either. Heights
  remain 2014 LiDAR; see the epoch note above.
- three.js r169, MIT.

Unofficial and not affiliated with, endorsed by, or operated by any university. Not a navigation
aid.

FULL CAMPUS (2026-08-03). The corridor became the campus: everything the
roads bound — North Torrey Pines Road, La Jolla Village Drive, Genesee,
I-5. A third and fourth source joined, each again used only for what it
is good at. UC San Diego's own facilities GIS supplies the massing —
one polygon per MASS, so Sankofa is a 64 m tower plus a mid and a base,
Geisel is built from its real per-floor polygons, and the Pepper Canyon
West towers stand at 70 and 67 m as the tallest things on campus. USDA
NAIP aerial imagery (public domain) supplies the colours: a 6 m terrain
colour grid, every roof, every surveyed ground polygon.

Where the georeferenced satellite chunks under `docs/data/textures/`
reach (0.125–0.25 m/px against NAIP's ~0.6), the colours are re-measured
per polygon from them — the imagery stays a build-time SOURCE, never a
texture. `build-campus-truecolor.mjs` masks each surveyed surface and
each roof (edges eroded, harder with height, so walls and shadows stay
out), rejects shadow pixels, takes the per-channel median in linear
light, and clamps the result into the site's palette family so one bad
sample can never ship a neon roof. Keys are geometry hashes (outer-ring
centroid, not array index), so the file survives data rebuilds; a moved
footprint just falls back to the NAIP/palette colour. Chunks over the
flagged 2023–24 construction sites are skipped — the model there keeps
its palette rather than inheriting a dirt lot.

The 2014 LiDAR remains the referee for everything it saw and is
overruled for everything built after it flew — it "measured" Sankofa at
8.4 m, the parking lot the tower replaced. Heights reconcile per mass.

Free roam goes anywhere from eye level to 900 m up, with a
logarithmic velocity slider and teleport to any of 360+ named places.
Labels (L) name every building in view, depth-tested so a hidden
building keeps its name to itself. Fallen Star hangs off the Jacobs
Hall tower corner at its published 10 degrees, baby blue with a brick
chimney; the Sun God and the Warren Bear stand where they stand.
