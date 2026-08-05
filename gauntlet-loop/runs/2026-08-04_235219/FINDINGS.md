# Gauntlet findings — 2026-08-04_235219 (judge re-audit)

## Pass 1, shard r2c1 (lat 32.864542..32.873467, lng −117.242934..−117.231752 — 400 buildings, 22 named)

`npm test`: **385/385 pass** (was 371; §15 of `campus-epoch.test.mjs` is new — 7 tests, and the
trees suite gained nothing but now holds by construction, see the rounding fix below).
`npm run check`: all five validators pass (287 measured heights, 503 massing parts, 10,681 trees).
Every candidate in `pass1-r2c1.screen.json` was re-derived before judgement: a fresh targeted EPT
re-sample replicating the build pipeline's own rules (same roofOf tree-guard, same rim-median
base, with height histograms for the canopy candidates), Apple snapshots for every site, crops of
the registered Google chunks, and Street View frames where a construction date or a storey count
mattered. Probe artifacts in `.cache/gauntlet-r2c1/` (probe.out, evidence/, shots/).

Eye-level verified through the real page (screenshots in `.cache/gauntlet-r2c1/shots/`): the Che
Café reads as the one-storey wooden venue under the grove with the HUD measuring 3.8; Laurel sits
level with its one-storey siblings; the Shank and the Forum stand as two labelled buildings with
James' Place between them and the Potiker complex behind; the Satellite Utility Plant is a single
clean block with no unnamed twin through it; the west-corridor admissions render at their planes.

### Fixed — heights (every value from a fresh EPT re-sample run this pass)

| Entity | Was shipping | Now ships | Source | Test |
|---|---|---|---|---|
| Che Café Collective (`che-cafe-canopy-bleed`) | 20.9 m — host canopy paste over a 4.3 m eave record | **3.8 m** | HAND_AUDITED: 48 % of returns in a dense 2–4 m band (hist 2 m: 1,186 · 3 m: 885 of 4,280 on the record trace), the rest up the crowns to 29.3 — p75 20.4 was pure canopy. SV shows trunks through its deck; the OSM mapper's own tag says 4.8; record eave 4.3/L1 | epoch §15 |
| Laurel (`laurel-canopy-bleed`) | 9.9 m — same paste at half the height | **4.2 m** | HAND_AUDITED: 70 % of returns in the 4 m bin alone (1,559 of 2,232), tail to 16.5 through the crowns over its east edge; unshaded siblings Laurel Extension 4.4, Magnolia 4.3, both clean planes | epoch §15 |
| Theodore and Adele Shank Theatre (`shank-forum-sliver-rename`) | suppressed under a union ring; name on a 3.2 m shed | **10.1 m, its own OSM ring** | LiDAR 2,123 returns, p98 10.1; the 56 m² record sliver that stole the name measures 2.7–3.2 (a real shed, now subsumed inside the theatre volume) | epoch §15 |
| Mandell Weiss Forum (same candidate) | one 1,987 m² union slab over two theatres | **10.5 m, its own OSM ring** | LiDAR 4,407 returns, p98 10.5, body tight; the union ring's own trace reads 10.4 — the Forum's plane, a lie about there being one building | epoch §15 |
| Grid-roof residential complex (`unnamed-93-overheight`, osm:93) | 16 m area guess | **11.8 m** | LiDAR 7,543 returns, p25 10.5 → p98 11.8, body tight; standing unchanged on today's Apple; SV shows 3–4 floors behind the ficus rows | epoch §15 |
| Commercial L-block, Villa La Jolla Dr (`unnamed-77-overheight`, osm:77) | 12 m OSM tag | **7.5 m** | one plane, p25 = p75 = 7.5 over 7,400 returns; the p98 tail to 28.1 is the ficus hugging its east edge, which the tree-guard discards | epoch §15 |
| La Jolla Village Square east strip (`unnamed-333-underheight`, osm:333) | 4.8 m OSM tag | **8.2 m** | the mapper under-tagged a tall retail shell: 6,216 returns, p98 8.2, max 8.5 | epoch §15 |
| La Jolla Village Square center pavilions (`unnamed-335-underheight`, osm:335) | 4.8 m OSM tag | **7.7 m** | same under-tag: 3,173 returns; targeted probe reads p98 7.8, the build's own tiling 7.7 — the shipped number is the pipeline's | epoch §15 |

### Fixed — geometry/render classes (the case was never the fix)

| Class | Members found | Root cause | Fix | Test |
|---|---|---|---|---|
| Union outline, theatre form | the two record rings named "Mandell Weiss Forum" (1,987 m² union + 56 m² sliver, centroids 39.7 m apart — one entry catches both) | the record traces Forum + Shank as one extrusion; the Shank's OSM ring suppressed under it, and the sliver standing centroid-inside the Shank ring took the theatre's NAME through the host rename | `UNION_OUTLINES` in `build-campus-arcgis.mjs` (the Earth Hall fix); the OSM division renders, each theatre at its own plane. This was pre-registered by r0c1 as "same class, out of this shard's scope" — it is now in scope and done | epoch §15 |
| Host rename into a RENDERING ring | James' Place — with the Forum union rings dropped, the record's "James' Place" (centroid-inside the now-rendering OSM Forum ring) took the ring's name and the Forum rendered twice | the rename never asked whether the host ring itself stands in the world; its purpose is that SUPPRESSION loses nothing, and an un-suppressed ring needs no heir | the rename fires only into a suppressed ring (`renderedOsm` set in `campus-massing.js`); height reconcile through the host untouched, names only. §14's James'-Place assertion holds again | epoch §14 (existing) |
| Unnamed double-render through massing | osm:718 (9 m guess, 0.775 covered by the Satellite Utility Plant record) and osm:359 (8.4 m re-trace of Mesa Apartments Central 9236, 0.52 covered — r2c2's box, fixed from here) — campus-wide, the only two flips | the ≥0.85 area floor exists to protect a NAME suppression could delete; an unnamed ring has no name to lose, only geometry the massing already renders | unnamed rings take a 0.5 area floor in `ringCoveredBy`, the same bar the vertex-majority test already uses | epoch §15 (class invariant re-checks every unnamed mass) |
| Prune-then-round tree ghosts | 13 trunks standing "inside" buildings after this pass's rebuild — every one within 5 cm of its wall, campus-wide (York Hall, Latin America Hall, MESOM, One Miramar ×2, Mesa Nueva - Marea, Seventh West #3, Tuolumne T-South, five unnamed) | `build-campus-lidar.mjs` pruned full-precision trunk positions, then rounded to 0.1 m for the file — rounding carried wall-huggers across footprint edges the prune had cleared. The committed file had simply won this lottery; every rebuild re-rolled it | round first, then prune: what the prune clears is exactly what the file says | `campus-trees.test.mjs` (existing — it is what caught it) |

### Epoch verdicts (dates, not errors)

- **`satellite-util-unchallenged`** — the screen's implied fix ("massHeights would read 4.2") is
  REJECTED as an epoch mistake; the bookkeeping fix is REAL and done. The plant opened ~2018-19
  (SV 2020-03 shows it standing; today's Apple confirms); the flight's tight 4.0–4.2 m plane
  (416 returns, p98 4.2) is the demolished predecessor. "Satellite Utility Plant" joins
  `POST_2014_SITES`, osm:718 joins `POST_2014_OSM_RINGS` (same site, per-ring form), and the
  12.8 m / L3 record ships unchallenged. Pinned: no massHeights key may ever appear at m:419,523.
- **`unnamed-1354-sparse-lot`** — POST_2014, verified three ways: the flight saw 48 returns,
  max 1.7 m (a bare lot); Street View 2018-05 still shows empty ground; today's Apple shows the
  finished pitched-roof building with solar carports. Built after mid-2018 → `POST_2014_OSM_RINGS`,
  keeps its declared 12 m area guess stated as a guess. The registered Google chunk over this
  block is censored — Apple is the only current nadir view, the VA-garage situation again.

### Rejected candidates (each re-measured before rejection; do not re-find these)

- **`potiker-jacobs-rename`** — REJECTED, working as designed. The record calls both
  theatre-complex masses "Joan and Irwin Jacobs Center for La Jolla Playhouse"; OSM outlines the
  Potiker Theatre across them; both are right — the Jacobs Center is the facility, the Potiker
  the venue inside it, and OSM is this project's name authority. The part that must never
  regress is measurement, and it holds: each mass ships its OWN plane (13.5 the fly tower, 9.4
  the house), not one pasted number. Pinned in §15.
- **`unnamed-guess-class-hole`** — REJECTED as scoped, with the honest part kept. The probed Mesa
  housing pads (osm:516/517/521/523/527/533/535/547/551/552) read planes 9.0–10.0 against their
  uniform 9 m guesses — agreement within ~1 m, no lie to fix. The verification MECHANISM the
  screen wanted exists (`OSM_UNNAMED_VERIFIED`, per-index), and this pass used it for the four
  outliers above. Admitting all 377 in-shard unnamed rings needs a per-ring Apple currency check
  each — that is a shard-scale batch job, handed off below, not a reason to ship 373 unverified
  numbers now.

### Handoffs / observations for later shards

- **Mesa pads batch verification** (r2c2 shares the row): the probed sample agrees with the
  guesses; a dedicated pass could admit the row wholesale with per-ring Apple checks.
- **Wagner Dance Building**: not a screen candidate, but the probe read p50 7.3 / roofOf 7.9
  (guard=true) against a 4.3 m / L1 record. The returns are canopy-mixed (guard fired) and
  nothing ships wrong today (record stands), but a future pass should histogram it — the dense
  band may sit near 7, which would make the record the under-reader.
- **osm:359 / Mesa 9236** was fixed from this shard by the unnamed-floor class fix; r2c2's
  screener should not re-find it.
- **James' Place geometry**: the record volume (5.1 m plane) stands inside the OSM Forum ring's
  10.5 m extrusion — identity correct, geometry partially interior. If OSM ever splits James'
  Place out of the Forum ring, both will render cleanly with no change here.

### The far-taller-LiDAR paste class, after this pass

The reconcile branch that pasted the grove onto the Che Café survives exactly one place
campus-wide: Jacobs Hall, whose 33.2 m host plane over a 17.1 m / L4 record is the cruciform
core being genuinely taller than the record — the r1c1 verdict, re-confirmed and unchanged.
Every other paste is a HAND_AUDITED value or a measured plane replacing a default record.

## Pass 1, shard r2c0 (lat 32.864542..32.873467, lng −117.254117..−117.242934 — 182 buildings, 43 named)

`npm test`: **394/394 pass** (was 385; §16 of `campus-epoch.test.mjs` is new — 9 tests).
`npm run check`: all five validators pass (285 measured heights — two fewer than r2c1 left it,
because Coastal Studies and MCF are now epoch withholds; 502 massing parts — one fewer, the
Birch union ring; campus-colors rebuilt to match). Every candidate in `pass1-r2c0.screen.json`
was re-derived before judgement with a full-depth targeted EPT re-sample (33 targets, cross-
checked against the screener's counts after an octree-pruning typo in the first grid probe was
found and fixed — its numbers were undersampled and NONE were used), Apple snapshots for every
site including a z20 closeup where a structure's existence was the question, crops of the
registered Google chunks, and Street View metadata (pano dates re-derived, not remembered).
Probe artifacts in `.cache/gauntlet-r2c0/judge/` (miniprobe.out, evidence/, eyelevel/).

Eye-level verified through the real page (screenshots in `.cache/gauntlet-r2c0/judge/eyelevel/`):
Ritter and Vaughan stand on their grade with the HUD measuring 14.6/14.9; the Hubbs conference
annex reads as the low slab in front of the four-storey hall; the T-cottages sit one-storey
among the labs; the NOAA wings and core step without z-fighting; Spiess reads four storeys at
14.3; Birch and Hillgarth stand as two labelled low buildings with the gap between them; the
beach tank rises against the bluff toe; the Eighth courtyard pavilion is a one-storey box among
the towers; the Shores houses sit on their lawns.

### Fixed — heights (every value from this pass's full-depth re-sample or the build's own tiling)

| Entity | Was shipping | Now ships | Source | Test |
|---|---|---|---|---|
| Ritter Hall (`ritter-newer-overheight`) | 21.3 m — the record height through a false `newer` flag | **14.6 m** | HAND_AUDITED full-ring re-sample (5,798 returns, p98 14.6, no guard, body tight). AREA's south edge truncated the in-box measurement to 12.5, which sat 8.8 m under the 21.3 m / L5 record and tripped `gisTaller` — a 1931/1959 building "newer" than the flight. The Qualcomm AA failure: a clipped footprint is a different quantity | epoch §16 |
| Vaughan Hall (same class, found by the class check) | 14.4 m (in-box, 87 % of the ring) | **14.9 m** | HAND_AUDITED full-ring re-sample, 13,623 returns, 49 % in one 13 m band | epoch §16 |
| Nigella Hillgarth Education Center (same class) | 4.7 m (in-box, 81 %) | **6.2 m** | HAND_AUDITED full-ring p98 — the 5–7 m tail is the pitched-pavilion ridges capping at 7.4, far too low to be crowns; Apple shows the trees only at the ring's edge | epoch §16 |
| Hubbs Hall Confrence Center (`hubbs-conf-canopy-bleed`) | 17.9 m, wearing the hall's L4 record | **4.0 m** | HAND_AUDITED dense band p50 (803 of 3,426 returns in the 3 m bin; the 5–19 m smear is Hubbs Hall's block and the palms). The name theft is a class fix, below | epoch §16 |
| T-25 / T-30 (`t25-t30-cottage-canopy`) | masses at 9.0 / 10.7 m (grove-wide GIS rings) | **4.8 / 5.0 m** | HAND_AUDITED: T-25's own ring is clean (157 returns, roofOf 4.8); T-30's dense band p98 is 5.0 (its raw p98 6.8 rides 27 crown returns; siblings T-29 3.8, T-31 4.1/5.0, record eave 4.3). The audits also bar both cottage masses from shipping canopy planes | epoch §16 |
| NOAA outline (`noaa-name-mismatch-double`) | 14.7 m over the whole complex, z-fighting the 13.8 core | **13.5 m wings + 13.8 m core** | MEASURE_MINUS_CONTAINED_HOSTS: the record ring is the centre block alone (98 % inside the outline); minus it, the wings read one plane (12,697 returns, p98 13.5, body tight) and the core keeps its own | epoch §16 |
| Fred N. Spiess Hall (`spiess-hostless-unchallenged`) | 17.1 m record, unchallenged | **14.3 m** | MASS_RENAMES to OSM's "Spiess Hall" (honorific drop; centroid misses the offset OSM ring so no host path ever fired); the renamed mass measures 6,133 returns, p98 14.3 | epoch §16 |
| Birch Aquarium / Hillgarth (`birch-aquarium-step`) | one union mass at 6.5 m; Hillgarth suppressed | **7.2 m Birch + 6.2 m Hillgarth, own rings** | UNION_OUTLINES (pre-registered by r0c1 as out-of-scope, now done): the record ring wraps both buildings — Hillgarth 97 % inside it. Birch's 7.2 is its own guarded p75; the 10–12 m gallery hall is a stepped 24 % no single plane can carry (logged below) | epoch §16 |
| Seawater tank, Scripps beach (`osm403-underheight`, osm:403) | 4.5 m area guess | **9.9 m** | OSM_UNNAMED_VERIFIED: 381 returns split deck / one tight 9–10 m plane (re-sample p98 9.8, the build's tiling 9.9 — the shipped number is the pipeline's); standing lettered on today's Apple | epoch §16 |
| Shores/Farms houses (from `unnamed-guess-class-hole`): osm:1036, 1048, 1053, 1073, 1141, 1145 | 9 m guesses | **6.2 / 3.1 / 4.8 / 3.7 / 5.3 / 2.5 m** | OSM_UNNAMED_VERIFIED, each with a dense single band (77–95 %) and an Apple check. 1145 pokes past AREA's south edge; its 2.5 is the in-box read of a 95 %-dense single band (full ring 3.1 rides the band's tail) — same plane, stated | epoch §16 |

### Fixed — classes (the case was never the fix)

| Class | Members found | Root cause | Fix | Test |
|---|---|---|---|---|
| Fuzzy name match stealing a claimed record | "Hubbs Hall Confrence Center" wearing "Hubbs Hall"'s L4/17.1 record. Campus-wide rebuild diff shows exactly the intended drops plus two GAINS the old order missed (T-30 and Laurel now match their own agreeing L1 records) | `matchName`'s prefix/suffix rules exist for honorific drift, but they also let a name that merely CONTAINS a real building's name take that building's record | two passes in `build-campus-arcgis.mjs`: every EXACT claim registers first; fuzzy skips claimed records | epoch §16 |
| Survey-box truncation firing `gisTaller` | Ritter (fired, rendered 21.3), Vaughan and Hillgarth (same truncation, undershipped without firing) | AREA's south edge cuts the SIO shore; an in-box measurement of a straddling ring is a different quantity, and the reconcile heuristics consumed it as THE height | the three full-ring HAND_AUDITED entries above (the established Qualcomm AA remedy). The AREA box itself stands — widening it re-fetches the whole survey and is not this pass's call; noted as a standing hazard for any shard the box edge crosses | epoch §16 |
| MEASURE_MINUS_CONTAINED, OSM-host form | NOAA (the only member found) | the existing map keys GIS mass names; NOAA's containment runs the other way (record ring inside OSM outline). A separate map because the namespaces collide — an "Atkinson Hall" host entry would silently change what that host's number means | `MEASURE_MINUS_CONTAINED_HOSTS` in `build-campus-lidar.mjs`, applied to host targets through the same generic exclude the fold already tests | epoch §16 |

### Epoch verdicts (dates, not errors)

- **`coastal-studies-low-plane`** — the screen read the 3.8 m mass plane as the error; the epoch
  is. The Center for Coastal Studies was renovated 2019-20 (Miller Hull; upper floor rebuilt):
  the flight's tight 3–4 m band (83 % of 1,826 returns) is the PRE-renovation roof, and Street
  View 2025-02 shows the finished multi-level block. "Center for Coastal Studies" joins
  `POST_2014_SITES`; the 12.8 m / L3 record ships unchallenged; the stale `newer` flag drops.
- **`mcf-host-bleed-guard`** — same shape. The 1963-64 fisheries lab was converted 2021-23
  (Miller Hull; new top pavilion and winged roof on the old frame), so the 18.9 m host paste
  (p75 of a returns mix: old roof at 10–11, pines to 27) described a roofline that no longer
  exists. "Marine Conservation Facility" joins `POST_2014_SITES`; the 17.1 m / L4 record ships
  unchallenged; Street View 2025-02 (the MCTF sign is up) supports it.
- **osm:1345** (from `unnamed-guess-class-hole`) — the unnamed ring in the Eighth College
  courtyard is a REAL one-storey dining pavilion (Apple z20: dark pitched roof, three vents, on
  a terrace the massing does not model — 0.00 coverage), built with the 2023 neighbourhood. The
  flight read 549 returns, all below grade. Joins `POST_2014_OSM_RINGS`; keeps its stated 4.5
  guess, which a one-storey pavilion supports.

### Withheld (better absent than wrong)

- **Birch Aquarium's gallery hall** above the 7.2 m plane: a stepped mass with no OSM parts —
  extruding p98 12.4 would inflate the whole footprint. The Scripps Memorial verdict again;
  the hall stays unrendered above the main plane until a parts-level source exists.
- **osm:1033**, the bluff-rim terrace compound NW of NOAA: 1,000 returns and not one rises a
  metre above the rim grade — the "roof" IS the upper terrace and the real structures descend
  the cliff face below it. An extrusion cannot say this shape honestly in either direction;
  the 9 m guess stands, stated as a guess, and the limitation is logged here.
- **osm:1068**: 73 % of its returns are eucalyptus (p50 17.1 over a one-storey 2–3 m band at
  27 % — below every admission precedent). The laser cannot see this roof; the guess stands.

### Rejected candidates (each re-measured before rejection; do not re-find these)

- **Kaplan Lab clipping concern** (screener margin note) — REJECTED: the OSM ring and the GIS
  ring agree, 8.1/8.2, full agreement with the shipped value. Nothing to fix.
- **T-31** — untouched on purpose, and now pinned so it stays that way: its own mass ring
  measures a clean 5.0 (OSM-ring read 4.1); no audit, no inheritance from its audited siblings.
- **osm:216** (from `unnamed-guess-class-hole`) — no builder entry needed: it is an unnamed
  re-trace 75 % covered by the university's "9369 Discovery Way" mass, so the r2c1 unnamed-ring
  coverage floor already suppresses it at render, and its own trace is canopy-smeared anyway
  (p50 5.6 under a p75 of 17.4). Pinned as a render assertion in §16.
- **`unnamed-guess-class-hole`** as a wholesale demand — REJECTED as scoped, same verdict as
  r2c1: the mechanism exists and this pass used it for seven admissions and four explicit
  refusals; admitting every in-box unnamed ring needs a per-ring Apple currency check each,
  which stays a batch job, not a reason to ship unverified numbers.

### Handoffs / observations for later shards

- **Piedra / Tierra (Nuevo East)**: post-2014 towers whose partial LiDAR planes (~19.4/17.8 in
  the abandoned grid probe) were UNDERSAMPLED — the numbers are not trustworthy and were not
  used. A future east-shard judge should re-derive from a full-depth probe before touching them.
- **AREA's south edge** crosses the SIO shore strip (z≈1382): any building or ring straddling
  it measures a truncated footprint. Ritter/Vaughan/Hillgarth are audited; osm:1145 is admitted
  with the in-box read of its single band; anything else a screener flags on that line should
  be checked for the same class before its number is believed.
- **Splash Cafe / Blue Wave Bistro** (Birch's café): renders at its measured 2.9 m plane under
  the rename to OSM's current name. The record ring stood in 2014 (tight 84 % band at 2.8 —
  a same-footprint predecessor structure); if a future pass dates the current café fit-out as a
  full rebuild, the epoch entry goes in then — the present render is measured, not guessed.

## Pass 1, shard r2c2 (lat 32.864542..32.873467, lng −117.231752..−117.220569 — 165 buildings, 9 named)

`npm test`: **398/398 pass** (was 394; §17 of `campus-epoch.test.mjs` is new — 4 tests).
`npm run check`: all five validators pass (284 measured heights — one fewer than r2c0 left it,
because the Hyatt's bimodal paste is now a null audit; 304 massing parts; 10,683 trees). Every
candidate in `pass1-r2c2.screen.json` was re-derived before judgement with a full-depth targeted
EPT re-sample (15 targets; counts matched the screener's exactly — its probe was already
full-depth), Apple snapshots for every site, and Street View metadata where a garage epoch
mattered. Probe artifacts in `.cache/gauntlet-r2c2/judge/` (miniprobe.out, miniprobe.json).

Judged by `cursor-grok-4.5-high` (Fable budget exhausted — see REAUDIT.md). Held the bar higher:
composites without parts and date/grade unresolved cases were withheld, not invented.

### Fixed — heights (every value from this pass's full-depth re-sample or the build's own tiling)

| Entity | Was shipping | Now ships | Source | Test |
|---|---|---|---|---|
| Hyatt Regency La Jolla at Aventine (`hyatt-podium-tower-union`) | 45.1 m tower paste over the whole ring | **16 m (OSM tag, stated guess)** | HAND_AUDITED null: 11,029 returns bimodal — 49% dense 4 m podium band, tower at 41–52; roofOf's p75 landed ON the tower. No OSM parts; neither extrusion is honest | epoch §17 |
| Mid-rise west of I-5 (`osm95-tower-underheight`, osm:95) | 12 m area guess | **30.9 m** | OSM_UNNAMED_VERIFIED: 5,723 returns, p25 25.9 → p98 30.9, body tight; standing on today's Apple | epoch §17 |
| Big-box retail (`osm198-bigbox-overheight`, osm:198) | 20 m area guess | **8.1 m** | OSM_UNNAMED_VERIFIED: 96,121 returns, 86% in a 6–7 m band; rim 16/51 (AREA south-edge clip — same in-box class as osm:1145, dense band is the whole building) | epoch §17 |
| Temple-north deck (`osm337-overheight`, osm:337) | 12 m area guess | **3.5 m** | OSM_UNNAMED_VERIFIED: 6,748 returns, 92% in a 1–2 m band | epoch §17 |
| L-block west of I-5 (`osm288-overheight`, osm:288) | 12 m area guess | **4.6 m** | OSM_UNNAMED_VERIFIED: 74% in the 4 m bin; guarded p75 (targeted 4.5, build tiling 4.6); p98 tail is canopy | epoch §17 |
| Mid commercial east of I-5 (`osm305-overheight`, osm:305) | 16 m area guess | **9.6 m** | OSM_UNNAMED_VERIFIED: 91% in the 8 m bin (targeted 9.5, build tiling 9.6); single 940 m glitch discarded by p98 | epoch §17 |
| Medical / Aventine-south (`osm51-underheight` / `osm62-underheight`) | 12 m guesses | **16.9 / 16.2 m** | OSM_UNNAMED_VERIFIED: tight guarded mid-rise planes (69% / 83% in the 16 m bin); build tiling | epoch §17 |

### Epoch verdicts (dates, not errors)

- **`osm785-garage-plane-vs-guess`** — POST_2014, the VA garage shape. Today's Apple shows a
  finished multi-deck garage with cars on the top deck beside the Blue Line / I-5; the 2014
  returns read one near-grade plane (13,396 returns, p50 0.8 to p75 1.2). Joins
  `POST_2014_OSM_RINGS`; keeps its stated 16 m area guess. Shipping 1.2 would have been the
  exact failure the screen warned against.

### Withheld (better absent than wrong)

- **Hyatt tower above the podium plane**: logged with the null audit above — no parts source.
- **`osm83-helipad-tower-underheight`**: helipad tower + lower wing in one ring (dense band 31 m
  at 38%, tower 52–63 with the red H on today's Apple). Two buildings, one ring; the 16 m guess
  stands.
- **`osm497-aventines-underheight`**: stepped 14 m / 18 m planes (body not tight). roofOf would
  paste 18.9 across both; the 9 m guess stands.
- **`osm289-canopy-mixed`**: body band near 12–13 already matches the 12 m guess; roofOf 22.6
  rides crowns to 68. No admission without a dense-band hand-audit the body does not need.
- **`temple-multilevel-spread`**: multi-tier sacred building + spire tail to 62 m inside one
  OSM ring. Keeps its existing 21.6 (upper-terrace via guard); inventing a single "better"
  number without parts would be the Birch gallery failure. Logged, not changed.

### Rejected candidates (each re-measured before rejection; do not re-find these)

- **`belmont-named-short-wing`** — REJECTED: the named ring's 9.1 is its own correct plane
  (6,947 returns, massOk). The taller complex rings (osm:1359 at 18.9, osm:289 canopy-mixed)
  are unnamed — an identity/label coverage question, not a height bug on this ring. OSM tag
  62.4 was already overridden by LiDAR.
- **`unnamed-guess-class-hole`** — REJECTED as scoped, same verdict as r2c1/r2c0: the mechanism
  exists and this pass used it for seven admissions and four explicit refusals; admitting all
  121 in-shard unnamed rings needs a per-ring Apple currency check each, which stays a batch
  job. Mesa GIS bodies probed at ~6 m agree with their 6.1 records — not height bugs.

### Handoffs / observations for later shards / passes

- **Hyatt / osm:83 parts**: both need an OSM (or GIS) parts-level source before either plane
  can ship honestly. Hand off to a mapping pass, not a height pass.
- **Temple parts**: same — lower terraces, upper mass, and spires cannot share one extrusion.
- **osm:1359** (Belmont's tall unnamed mass): clean plane 18.9 against a 20 m guess — agreement
  within ~1 m; not admitted this pass (no lie large enough to fix). A batch pass could take it.
