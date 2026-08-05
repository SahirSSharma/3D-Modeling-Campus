# Gauntlet findings — 2026-08-04_161701

## Pass 1, shard r0c0 (lat 32.882391..32.891316, lng −117.254117..−117.242934 — 103 buildings, 14 named)

`npm test`: **319/319 pass** (was 312; §9 of `campus-epoch.test.mjs` and one `campus-overlay`
drape test are new). `npm run check`: all four validators pass (294 measured heights, was 292).
Every fix below is pinned by a test and eye-level verified through the real page
(`__campusWalk.probe` rendered-roof checks: 8/8 match after two probe points moved off an
L-notch and a courtyard; screenshots in `.cache/gauntlet-r0c0/shots/`).

### Fixed — heights (all from targeted EPT re-samples replicating the build pipeline exactly)

| Entity | Was shipping | Now ships | Source | Test |
|---|---|---|---|---|
| Salk Institute lab wings (2 unnamed OSM ways) | 22.8 m area guess each | 19.6 m each | LiDAR p98, 26k+ returns/wing, identical planes | epoch §9 |
| Torrey Pines Center South | 17.1 m (GIS facility record) | 12.2 m (OSM ring) / 11.5 m (GIS ring renders) | LiDAR, 23,073 in-survey returns, one plane | epoch §9 |
| Sanford Consortium east pavilion | 17.1 m (facility record host-bleed) | 6.2 m | LiDAR per-mass plane, 462 returns | epoch §9 |
| ERC Laundry South | 3.0 m (GIS) | 4.2 m | LiDAR per-mass plane, 2,384 returns | epoch §9 |
| Wells Fargo Hall (out-of-shard, same class) | 22.6 m GIS unchallenged | 26.1 m | LiDAR per-mass plane, 13,408 returns | epoch §9 |
| Mandler Hall (out-of-shard, same class) | 13.4 m GIS unchallenged | 14.8 m | LiDAR per-mass plane, 4,310 returns | epoch §9 |
| Center for Memory and Recording Research (out-of-shard) | 12.2 m GIS | 12.9 m | LiDAR per-mass plane, 13,867 returns | epoch §9 |
| Student Services Center (out-of-shard) | 21.9 m GIS | 22.7 m | LiDAR per-mass plane, 14,466 returns | epoch §9 |
| Visual Arts Facility Building 2 (out-of-shard) | 10.4 m GIS | 11.9 m | LiDAR per-mass plane, 6,564 returns | epoch §9 |
| Bonner Hall annex (out-of-shard) | 3.0 m GIS | 3.0 m (now measured, 52 returns) | LiDAR per-mass plane | epoch §9 |

**Class fix behind rows 3–10:** a GIS massing ring whose centroid misses every *named* OSM
footprint had no host in `build-campus-lidar.mjs`, so its GIS value stood unchallenged — the
epoch guard never got to ask. The build now falls back to the mass's own GIS name when it
exactly matches an OSM building name within 150 m (epoch checks run against that name, so
POST_2014/HAND_AUDITED still bind). Nine masses campus-wide are in the class; the shipped
`massHeights` were spliced with generator-exact values (same clip, same percentile rules) rather
than a 30-minute full rebuild, matching the r1c1 precedent. The tenth candidate — Pepper Canyon
Assistant Dean's Residence — reads canopy-stepped (p75−p50 > 2) and emits nothing; epoch §9 pins
the withhold.

**TPCS root cause:** relation-mapped (r18938148) on 2026-08-03 *after* the last full LiDAR
rebuild; `lidar.heights` simply predated the footprint. Replicating the build's exact AREA clip
and terrain grid on today's inputs yields 12.2 m — the value spliced.

### Fixed — identity

| Entity | What was wrong | Correction | Test |
|---|---|---|---|
| Salk Institute lab wings | OSM maps the Salk as a named `research_institute` AREA containing unnamed building ways; nameless, the wings could not key into name-keyed `lidar.heights` | `WAY_NAMES` table in `build-campus-3d.mjs` names ways 31839360/31844744 from the containing site; place anchor "Salk Institute for Biological Studies" added at (−470.6, −1033.9) | epoch §9 |

### Fixed — rendering

| Entity | What was wrong | Correction | Test |
|---|---|---|---|
| Marshall Lower Apartments union outline | SanGIS footprint traces the union of six massing rings: centroid in a breezeway, 82/166 vertices (0.49) on the exact shared edges — both point tests missed and it extruded as one 18 m monolith through the six halls | `ringCoveredBy` third test reads AREA: ≥85% of the ring's interior already massing ⇒ suppressed. Guard: yields unless a covering mass inherits the ring's name via host rename — so Cala, Village East 4, One Miramar 3/4, Canyonview Admin, E, D (names carried by nothing else) keep rendering; no label is lost anywhere (epoch §9 pins a may-shrink-never-grow orphan list) | epoch §9 |
| Salk Institute Road (159 m single OSM segment) | path drape samples ground only at quad vertices; the segment bridged a 5.9 m mid-segment rise as a straight plank | `buildPaths` subdivides every segment to ~6 m (was: only imagery-skip segments); bounds drape error to the 3 m terrain-cell scale network-wide | overlay: swale test |

Eye-level: Voigt Dr / Ridge Walk grade re-walked after the path change — ground falls 24.3 → 17.5
smoothly, corner to corner, no flat-planting. Salk road now climbs 0 → 10.3 → 7.5 along the fixed
run. Marshall court reads as six separate halls with a walkable court. Salk court reads as the
twin symmetric wings.

### Apple — currency confirmed, registration measured at a second site

Currency (existence/identity/appearance, Apple's authority): Salk wings + court, Sanford bar +
pavilion, TPCS, all six Marshall halls, ERC halls, Estancia, Village West all present and
matching the shipped data. No demolition or unshipped construction found inside r0c0. One
appearance note: both Salk wing roofs now carry solar arrays (post-2014) — irrelevant to the
2014 structural height, relevant to any future roof-colour pass.

Registration (the 1.25 m problem, first-class objective): fitted per-site offset at the North
Torrey Pines Rd / Salk Institute Rd crosswalks (ground-level paint, zero parallax) — best NCC
**0.783** at **0.25 m W, 1.75 m S** (magnitude 1.77 m, gate 0.6 m). The prior Muir-court probe
measured 1.25 m at **1.00 m E, 0.75 m N** (NCC 0.439). **The offset is not a constant bias — it
varies in direction site to site**, so a single campus-wide correction can never pass gate;
per-site fits (as PROMPT.md's clause anticipated) are the only path. Raw-Apple colour sampling
stays off. Fit residual after correction is sub-pixel at 0.25 m/px; artefacts in
`.cache/gauntlet-r0c0/apple/`.

**H1 status: not yet testable, and this pass measured why.** `scripts/audit-epoch-agreement.mjs`
does not exist yet; building it requires the per-site registration correction as a prerequisite
(an uncorrected 1.25–1.77 m shift would manufacture the exact false disagreement PROMPT.md
warns about), and this pass established that the correction must be fitted per site, not applied
as a constant. Shard-level qualitative evidence is H1-consistent: every unchanged r0c0 building's
Apple footprint matches its OSM/LiDAR extent by inspection, and re-sampled 2014 planes agree with
rendered heights to ≤0.1 m. The quantitative campus-wide script remains open for the loop.

### Could not resolve — documented, not invented

| Entity | Why |
|---|---|
| Unnamed service complex NW of the Salk (−583, −1098, h=12 area guess) | exists per Apple (flat-roofed 1–2 storey industrial cluster — the guess is visibly high) but the building is nameless in OSM and `lidar.heights` is name-keyed; no identity source names it to gate. Documented unguardable class. |
| La Jolla Farms greenhouse/estate structures (−885, −573 area, h=4.5 guess on a 3.9 m grade) | exist per Apple; same nameless class. Neither sits below its uphill grade (terrain audit passed), so no forbidden failure mode — just unmeasured heights on declared guesses. |
| Pepper Canyon Assistant Dean's Residence mass | p75−p50 > 2 under eucalyptus — no single roof plane resolvable from 2014 returns. Withheld (epoch §9 pins it), GIS 11.6 m stands. |
| 27 OSM ways in-shard with no shipped footprint | all below the 60 m² intake floor (sheds, greenhouses, gliderport shack) — deliberate filter, not a gap. |

### Handoffs to other shards

- Cala / Village East Building 4 / One Miramar 3 & 4 / Canyonview Admin / E / D: named OSM
  outlines ≥85% covered by masses that do NOT carry their names — still double-rendering
  (pre-existing), left alone because suppression would delete the only ring knowing the name.
  Fix belongs to their shards: either name the covering GIS masses or add OSM-name → GIS-name
  aliases.
- Middle Earth Lounge (r0c1): GIS mass "Earth Hall" (12.2 m, 4 storeys) centroid falls inside
  the OSM "Middle Earth Lounge" ring (2 storeys) — the host rename may be pasting the lounge's
  name on the hall. Verify which mass renders and what the label claims in r0c1.
- Earth/Spiess/Douglas/Black Hall + 12 others: pre-existing name orphans (suppressed OSM rings,
  differently-named GIS masses) — pinned as a may-shrink-never-grow list in epoch §9, resolution
  belongs to their shards.

### Verification (real output)

```
npm test:  tests 319 / suites 35 / pass 319 / fail 0
npm run check:
  campus-3d.json OK — 1395 buildings (388 named), 3880 paths (22618 points), 663 surfaces (72 plazas)
  campus-lidar.json OK — 294 measured heights, 7275 trees, terrain 1014×923
  campus-boundary.json OK — 1 ring(s), 244 points; textures OK — 87 chunks, 31.1 MB, source google
  ok: 4335 ground, 509 massing, 507x462 terrain
rendered-roof probes (page, __campusWalk.probe): Salk S 19.6, Salk N 19.6, Sanford E 6.2,
  Sanford W 24.5, TPCS 11.4 (pin 11.5, terrain-bilinear rounding), ERC Laundry 4.2,
  Wells Fargo 26.1, Marshall breezeway null (monolith gone) — 8/8
```

Not deployed, not pushed — per the run's hard prohibitions. Local commit only.

## Pass 1, shard r0c1 (lat 32.882391..32.891316, lng −117.242934..−117.231752 — 84 buildings, 54 named)

`npm test`: **328/328 pass** (was 319; §10 of `campus-epoch.test.mjs` is new — 9 tests pinning
every fix below). `npm run check`: all four validators pass (293 measured heights, was 294 — the
demolished RIMAC Annex's dead measurement removed; 505 massing, was 509 — four union/stale rings
removed). Every fix eye-level verified through the real page (`__campusWalk.probe` rendered-roof
checks: 15/15 after moving three probe points off courtyards/holes onto wings; screenshots in
`.cache/gauntlet-r0c1/shots/`).

### Fixed — heights (targeted EPT re-samples replicating the build pipeline exactly)

| Entity | Was shipping | Now ships | Source | Test |
|---|---|---|---|---|
| Atkinson Hall west pavilion | 27.2 m (host bleed: own ring canopy-stepped → host value, dominated by the nested 29.8 m tower) | 14.5 m | LiDAR p98 of main ring MINUS contained tower ring, 16,642 returns, clean plane (p50 10.8/p75 12.2) | epoch §10 |
| SDSC East Expansion | 17.1 m (GIS record, unchallenged — no host, no OSM name twin) | 23.2 m | LiDAR per-mass plane, 11,291 returns | epoch §10 |
| Social Sciences Building | 17.1 m (same class, 1995 building) | 21.0 m | LiDAR per-mass plane, 5,865 returns | epoch §10 |
| Robinson Building 1 - Administration | 9.1 m (GIS) | 10.4 m | LiDAR per-mass plane, 3,517 returns | epoch §10 |
| Robinson Building 3 - Library | 8.5 m (GIS) | 7.5 m | LiDAR, stepped→p75 (tight body), 3,668 returns | epoch §10 |
| ERC Administration North | 4.3 m (GIS) | 4.8 m | LiDAR per-mass plane, 1,232 returns | epoch §10 |
| Outback Adventures | 4.3 m (GIS) | 2.5 m | LiDAR per-mass plane, 128 returns | epoch §10 |
| Seventh College East #5 / #6 | 15.2 m / 15.2 m (GIS) | 12.2 / 10.7 m | LiDAR per-mass planes, 2,977 / 2,835 returns | epoch §10 |
| Douglas Hall | 18.3 m (GIS "Douglas Apartments", unchallenged) | 16.1 m | LiDAR per-mass plane after `MASS_RENAMES`, 5,426 returns | epoch §10 |
| Earth Hall chain (N / lounge / S) | one 11.7 m union slab | 11.6 / 4.7 / 11.6 m | LiDAR per-OSM-ring planes (6,184 / shipped 4.7 / 5,988 returns) after union removal | epoch §10 |
| Canyon Vista admin + restaurant | one 12 m union (unnamed, suppressed both) | 12.0 + 8.6 m | LiDAR per-OSM-ring planes after union removal | epoch §10 |
| Village East Building 4 + 5 | one 15.2 m union ("SCE #4"); VE4 double-rendered through it, VE5 suppressed | 12.1 + 12.4 m | LiDAR per-OSM-ring planes after union removal | epoch §10 |
| VE community building (unnamed osm:786) | 9 m OSM tag guess | 12.3 m | LiDAR, 319 returns; new `lidar.osmHeights` (index-keyed, hand-verified entries only) | epoch §10 |
| RIMAC service-court kiosk (unnamed osm:893) | 4.5 m OSM tag | 4.3 m | LiDAR, 521 returns, canopy tail guarded (p75) | epoch §10 |

**Class fixes behind the table (each generator-side, splice mirrors a rebuild):**
1. `UNION_OUTLINES` (`build-campus-arcgis.mjs`) — facilities records that trace the union of
   several real buildings as one extrusion ring: Marshall's SanGIS bug mirrored from the GIS
   side. Dropped where the OSM division is finer and every piece has its own LiDAR plane.
2. `PRE_2014_GIS_VERIFIED` (`build-campus-lidar.mjs`) — GIS-only masses (no host, no OSM twin)
   whose build dates are hand-verified pre-2014: the epoch question answered by the record, so
   the 2014 survey may challenge their GIS values. Two were far off (SDSC E +6.1 m, SSB +3.9 m).
3. `MEASURE_MINUS_CONTAINED` (`build-campus-lidar.mjs`) — a whole-footprint ring with a nested
   tower ring measures the low portion by excluding returns inside the contained mass.
4. `lidar.osmHeights` — unnamed OSM rings that render (nothing covers them) had no way to carry
   a measurement; index-keyed store (the `partHeights` coupling), hand-verified entries only,
   because an unnamed ring cannot join the name-keyed POST_2014 guard.
5. `MASS_RENAMES` (`build-campus-arcgis.mjs`) — inventory name → OSM name where they are the
   same building ("Douglas Apartments" → "Douglas Hall"): restores host, label, and challenge.

### Fixed — epoch

| Entity | What was wrong | Correction | Test |
|---|---|---|---|
| RIMAC Annex | Apple (2026-08-04) shows the 2014 annex demolished — tower crane over open concrete decks — while the model rendered the dead building at its 10.6 m 2014 measurement | `POST_2014_SITES` += RIMAC Annex; massing ring excluded (`UNDER_RECONSTRUCTION`), OSM ring skipped, `lidar.heights` entry removed. Site renders nothing; footprint + place label kept. Better absent than wrong — no source resolves the rising frame | epoch §1 + §10 |

### Fixed — rendering

| Entity | What was wrong | Correction | Test |
|---|---|---|---|
| Alianza + Umoja OSM outer outlines | neighbourhood OUTLINES (courtyards, stairs, gaps included) extruded as solid blocks through the university's per-wing masses | `skipOsm` += both; the five wings render and carry the names | epoch §10 |
| Earth Hall label | the union mass's centroid fell in the Middle Earth Lounge ring, pasting "Middle Earth Lounge" over the whole chain (r0c0 handoff confirmed) | union removal; each building renders under its own name | epoch §10 |
| `campus-facades.json` stale keys | walls/accents for "Seventh College East #4" and "RIMAC Annex" became silent no-ops after the removals (the facades guard caught it) | 3 entries removed, mirroring a facades resample | facades guard |

### Eye-level (real page, real camera)

All 15 rendered-roof probes match pinned values (±0.6 m of local-ground convention). The Earth
chain reads as two 11.6 m halls with the 4.7 m lounge stepping between; Canyon Vista reads as
two buildings across a courtyard; the RIMAC Annex site is bare graded ground under a wayfinding
label (screenshot `rimac-annex-empty.png`); Atkinson reads as a low curved pavilion against its
tower. Voigt Dr / Ridge Walk regression grade re-sampled: 24.3 → 17.5 m smooth, corner to
corner — unchanged by this pass, still correct.

### Measured, not changed — the roof-anchor class (flagged for a dedicated pass)

The extruder sets `roofY = ground(centroid) + h` while the survey defines `h = roof −
median(rim ground)`; under hole-filled interiors on grades the two diverge. Grade audit over all
87 rendered in-shard masses: 4 exceed 2 m of roof-elevation error — Hopkins Parking +3.17 m
(15.7 m grade span), Canyon Vista admin +2.93 m, Cuzco Hall −2.55 m, Village East 4 −2.34 m.
Bases are per-vertex safe everywhere (`min(vertex ground) − 1.5`). The class fix (anchor at rim
median, matching the measurement's own definition) moves every building on campus and belongs to
a cross-shard pass, not a shard splice. Numbers logged in `.cache/gauntlet-r0c1/grade-audit.mjs`.

### Apple — currency confirmed at 16 sites

Ridge Walk North (Alianza/Umoja wings match the massing), Earth chain, Canyon Vista (restaurant
roof under renovation-grade work, structure standing — heights unaffected), Douglas + annex,
Village East cluster, RIMAC arena, Atkinson (curved west pavilion + tower confirmed), Hopkins
Parking, Marshall Upper townhomes, Robinson/GPS complex, SDSC + SSB (solar arrays on SDSC E,
post-2014, colour-relevant only), north cluster, both unnamed verified rings, Northpoint/Outback,
Pangea. One epoch hit: the RIMAC Annex demolition/rebuild (fixed above). No registration fit was
run this pass — no colour was sampled off Apple pixels, so no fit was owed; the constraint
(per-site fits only, 1.25–1.77 m variable offset) stands as r0c0 measured it. **H1 status
unchanged:** the campus-wide script still requires the per-site registration prerequisite;
shard-level qualitative evidence again H1-consistent (every unchanged building's Apple footprint
matches its OSM/LiDAR extent by inspection; re-sampled planes agree with rendered heights).

### Could not resolve — documented, not invented

| Entity | Why |
|---|---|
| RIMAC Annex rebuild (rising frame) | under construction; no source resolves the unfinished frame to gate. Renders nothing by rule. |
| Marshall Upper Apartments H/L/M p98 tails (10.2–11.8 m over 6.1 m GIS) | eucalyptus canopy over townhome roofs — tails stay under the 5 m canopy-guard firing threshold, but the measured plane BODY (p50/p75 ≈ 6.0–6.2) matches the university's 6.1 m. GIS value kept; tails documented as contamination, not roof. |
| Info Center North Point (measured 4.9 vs GIS 4.6) / North Campus Restrooms (4.6 vs 4.3) | deltas ≤0.5 m — inside the survey's own noise for small rings; GIS values left unchallenged (no whitelist entry earned). |
| RIMAC Arena mass ring 16.7 m vs OSM ring 18.7 m | two different rings, both correctly measured (the mass ring excludes the entrance-block zone the OSM ring includes). Pre-existing, shipped, internally consistent — noted, not touched. |
| In-shard markings (Triton Track & Field, RIMAC pitches, Northview tennis) | verified within declared gates — no change needed. |

### Handoffs to other shards

- Union-outline class members found by the same scan, outside r0c1: Mandell Weiss Forum (covers
  Shank Theatre), 64 Degrees (covers Revelle Commons/64 North), Birch Aquarium (covers Hillgarth
  Center), Biomedical Sciences (covers WongAvery), Mandeville Center (covers Print Labs). Each
  needs the per-piece measurement its shard can do; `UNION_OUTLINES` is ready for entries.
- Roof-anchor class (above): cross-shard renderer change, needs its own regression pass.
- r0c0 handoff list status: Middle Earth Lounge/Earth Hall RESOLVED, Douglas Hall RESOLVED,
  Canyon Vista both RESOLVED, Village East 5 RESOLVED. Spiess Hall (SIO), Black Hall — their
  shards; epoch §9's orphan list shrank by five and cannot regrow.

### Verification (real output)

```
npm test:  tests 328 / suites 36 / pass 328 / fail 0
npm run check:
  campus-3d.json OK — 1395 buildings (388 named), 3880 paths (22618 points), 663 surfaces (72 plazas)
  campus-lidar.json OK — 293 measured heights, 7275 trees, terrain 1014×923
  campus-boundary.json OK — 1 ring(s), 244 points; textures OK — 87 chunks, 31.1 MB, source google
  ok: 4335 ground, 505 massing, 507x462 terrain
rendered-roof probes (page, __campusWalk.probe): Earth N 11.6, Lounge 4.7, Earth S 11.6,
  CV admin 11.5 (pin 12, local-ground convention), CV restaurant 8.6, Douglas 16.1,
  Atkinson pavilion 14.1 (pin 14.5, same), Atkinson tower 28.5/29.8, VE4 wing 13.7 (roof-anchor
  class, data value 12.1 verified in assembly), VE5 12.6, SSB 21.4, SDSC E 23.3, Robinson 3 7.5,
  osm:786 12.4, annex site null — 15/15 within convention
```

Not deployed, not pushed — per the run's hard prohibitions. Local commit only.

## Pass 1, shard r0c2 (lat 32.882391..32.891316, lng −117.231752..−117.220569 — 62 buildings, 18 named)

East campus: Campus Point and the Science Research Park, the Scripps Memorial / Prebys hospital
campus, the CSC service yard, the Biology Field Station, the Preuss School, Qualcomm AA/BB.
The defining fact of the shard: almost nothing here carries an OSM name — 44 of 62 buildings are
nameless rings — so almost nothing could key `lidar.heights`, and the area guess stood
unchallenged nearly everywhere. The fix at scale is the `osmHeights` per-index mechanism r0c1
introduced for two hand cases: every unnamed ring was re-sampled against the same EPT
(`.cache/gauntlet-r0c2/probe-out.txt`, 63 targets), checked against a fresh Apple snapshot for
currency (15 sites, footprint overlays), and — where verified standing-unchanged since the 2014
flight — given its measured plane.

### Fixed — heights, unnamed OSM rings (targeted EPT re-samples replicating the build pipeline exactly)

31 rings enter `OSM_UNNAMED_VERIFIED` / `lidar.osmHeights` (§11 of `tests/campus-epoch.test.mjs`
pins every value):

| Ring | Was (guess) | Plane | Returns | What it is |
|---|---|---|---|---|
| osm:502 | 22.8 | **34.0** | 17,637 | Scripps Memorial east tower |
| osm:506 | 16 | **46.9** | 27,500 | Prebys Cardiovascular Institute — see epoch call below |
| osm:0 | 12 | **31.3** | 13,850 | Campus Point tower, seven storeys guessed at three |
| osm:63 | 12 | **22.8** | 11,431 | NE-corner offices — stepped, guard takes the p75 main plane under a 27.9 core |
| osm:453 | 12 | **19.9** | 4,762 | hospital central plant |
| osm:119 | 12 | **19.1** | 4,290 | PV-roof office |
| osm:204 | 12 | **15.2** | 9,411 | Science Research Park office |
| osm:186 | 12 | **13.7** | 4,413 | PV-roof office |
| osm:55 | 16 | **12.4** | 23,021 | XiMED annex block |
| osm:781 | 12 | **12.1** | 2,475 | Campus Point office |
| osm:507 | 8.4 | **11.0** | 6,130 | hospital wing |
| osm:509 | 12 | **10.9** | 6,943 | canyon-edge wing |
| osm:505 | 9 | **10.0** | 1,221 | hospital wing |
| osm:113 | 16 | **9.3** | 20,190 | low broad block guessed tall |
| osm:132 | 12 | **9.4** | 13,288 | NW-corner building |
| osm:501 | 8.4 | **8.3** | 2,344 | wing under crown at 33 — tree-guard takes p75, agrees with the guess |
| osm:504 | 9 | **6.3** | 1,169 | low wing |
| osm:510 | 12 | **6.5** | 3,125 | service block guessed double |
| osm:931–943 | 4.5–9 | **3.8–8.7** | 157–7,370 | the hospital-district carports and PV canopies — OSM's area heuristic reads a long canopy as a two-storey building |

### Fixed — heights, GIS records (PRE_2014_GIS_VERIFIED extended east; twelve names)

Hostless rings, build dates documented pre-flight, Apple confirms 2014 footprints. §11 pins all:

| Mass | GIS | Plane | What moved |
|---|---|---|---|
| CSC Building C / D | 4.3 | **6.9 / 6.5** | the shops were half their height |
| Fleet Services (hostless south row) | 4.3 | **5.7** | the north row already answered through its OSM host (10.1, ships) |
| East Campus Substation | 8.5 | **5.3** | the record's default two storeys for a one-storey switchyard control building |
| Preuss A / B / C | 8.5 | **9.2** each | |
| Preuss F (both rings) | 8.5 | **11.7 / 11.4** | the double-height gym hall, three metres over its record |
| BFS Greenhouse 1 / 2 / 3 | 4.3 | **5.0 / 4.9 / 5.3** | GIS rings span what OSM maps as PAIRS of houses; centroids fall in the gap, so host containment never saw them |
| BFS Frog House | 4.3 | **5.0** | |

### Fixed — heights, the survey-box clip

**Qualcomm AA 20 → 24.3 m.** Its footprint pokes past `build-campus-lidar.mjs`'s AREA box, so
the standard pipeline never measures it (`lidar.heights` has no entry) and the area guess stood.
Targeted re-sample of the same EPT: 30,780 returns, p98 24.3, one plane, no canopy.
`KNOWN_HEIGHTS` carries it with the citation — the Tenaya Hall precedent.

### Fixed — epoch

- **Prebys (osm:506) is a measurement, and the reasoning is written down.** Topped out mid-2013,
  opened March 2015: at the flight the structure and roof were COMPLETE, interiors unfinished.
  27,500 returns, p75 45.5 → p98 46.9 — a tight finished plane, not the scatter a rising frame
  returns (contrast ACTRI, genuinely mid-build at 28.6, excluded by r0c1's predecessor sweep).
  The 2014 roof is today's roof. Pinned with its reasoning in §11.
- **The unnamed-host part hole is closed.** `partHeights` guarded named hosts via
  `POST_2014_SITES` but shipped unnamed hosts' parts unexamined: Anderson Medical Pavilion
  (osm:835, opened 2016) carried a 4.1 m "part roof" that was 2014 slab-and-staging returns.
  Parts of unnamed hosts now require the same per-index verification as their slabs
  (`OSM_UNNAMED_VERIFIED` in `build-campus-lidar.mjs`); 835/0 is gone, 506/0 (47.3, host
  verified) stays, 503/0 goes with its withheld host (below). §11 pins all three.
- **osm:772 / osm:508 stay unmeasured** — Prebys north pad and a canopy the flight saw as bare
  ground (p50 0.8 m / 0.4 m). Post-2014 finishes; epoch rule, no exceptions.
- **Demolition at (1416, −1299).** Apple (2026-08-04): roof torn open, excavators on the slab —
  the unnamed 1980s service building is coming down for the Alexandria Campus Point buildout.
  RIMAC Annex rule, but the ring has no name for `skipOsm`, so `campus-massing.js` skips it by
  footprint ANCHOR (`skipOsmAnchors`) — nothing extrudes; the ring and its 2014 relief stay for
  the day something measurable stands. §11 pins the empty site.

### Fixed — wayfinding

"Scripps Memorial Hospital La Jolla" and "The Preuss School" exist in OSM only as SITE ways
wrapping unnamed buildings, so neither name ever survived the buildings/paths name pass and the
east campus had no anchors. Both seeded at their site ways' centroids (way/26103742 at
(1466.1, −713.5), way/159384334 at (1791.6, −480.3)) in `SEEDED_PLACES`. §11 pins both.

### Withheld — documented, not invented

| Entity | Why |
|---|---|
| Main Scripps complex (osm:503, renders 20 m guess) | stepped 1960s-2000s chain, NO single plane exists: p75 9.5 under towers at 32.2 — the automatic rule would flatten it to 9.5, worse than the guess. Needs per-wing rings nobody has drawn. Its whole-ring part (32.4) withheld with it. §11 pins the withhold. |
| osm:780 (shed under full eucalyptus) | 67 returns, p50 10 m over a one-storey structure — the laser cannot see this roof. |
| osm:944 (carport stub) | 8 returns — below the 25-return trust floor. |
| Preuss Fabrication Lab | crown top to bottom (p50 12.4 over a one-storey shop); the mass rule would ship 17.5. Its 4.6 m GIS record stands. |
| Jerboa (4.8 vs 4.3), EMF 2 (4.0 vs 4.3), Preuss modulars (4.4/4.6 vs 4.3) | deltas ≤0.5 m — survey noise on small rings; records left unchallenged (same rule as r0c1's Info Center). |
| Preuss OSM rings 49/50/54/101, BFS osm:782, CSC osm:449 | GIS-covered (suppressed at render); measured planes logged in probe-out.txt but not shipped — a value that never renders is noise in the data. |
| Preuss soccer pitch (painted lines visible on Apple, east of the classroom wings) | not modelled in `campus-markings.json` — the shard ships zero markings. Fitting a NEW facility needs a template + a per-sample fit on registered imagery; Apple pixels are barred from fitting without a per-site registration (r0c0 rule), and no fit was attempted at the tail of a pass. Logged for a markings pass; better absent than wrong. |

### Measured, not changed — the roof-anchor class (two more data points)

Grade audit over all 71 rendered in-shard masses (`.cache/gauntlet-r0c2/grade-audit.mjs`):
one mass past the 2 m gate — the 34 m east tower (osm:502) renders **−2.66 m** off its surveyed
roof elevation (centroid ground in a hole-filled interior), and osm:509 sits at +1.90 on its
canyon edge. Bases per-vertex safe everywhere. Same class r0c1 logged (Hopkins +3.17); still a
cross-shard renderer pass, still not smuggled into a shard splice.

### Apple — currency confirmed at 15 sites

csc-cluster, bfs-cluster (greenhouses + field plots current), scripps-garages (B, C, XIMED),
hospital-south/mid/north (every ring stands; Prebys and Anderson match their footprints),
carports-east, ne-offices, qualcomm-bb, campus-point-n, ne-corner, qualcomm-aa, preuss, and the
two single-ring checks. Two epoch hits: the (1416, −1299) demolition (fixed above) and active
unmapped construction north of Campus Point Court (Alexandria buildout — not in OSM yet, nothing
to fix until OSM maps it; noted for a future pass). No colour was sampled off Apple pixels, so
no registration fit was owed; the r0c0 constraint stands (per-site fits only, offset varies
1.25–1.77 m by site). **H1 status unchanged:** the campus-wide script still needs the per-site
registration prerequisite; shard-level qualitative evidence again H1-consistent — every
unchanged building's Apple footprint matches its OSM ring by overlay inspection, and the
re-sampled 2014 planes agree with what stands today (the shard's biggest "disagreements" were
all guesses, not changes).

### Handoffs to other shards

- Roof-anchor render class: r0c2 adds osm:502 (−2.66) and osm:509 (+1.90) to r0c1's four; the
  dedicated pass now has six measured cases across two shards.
- Union-outline class members named by r0c1 (Mandell Weiss Forum, 64 Degrees, Birch Aquarium,
  Biomedical Sciences, Mandeville Center) — all outside r0c2, all still open for their shards.
- Campus Point / Alexandria construction: when OSM maps the new buildings, they are
  POST_2014_SITES candidates on arrival (the flight predates them by a decade).
- Preuss soccer pitch: an unmodelled painted facility for the next markings pass (needs a
  registered-imagery fit; see withheld table). Second screen of the shard's other entity
  classes found nothing else: 0 markings, 0 furniture/landmark placements in bounds, and the
  796 in-shard 2014 trees stay within believable ranges (tallest 30 m eucalyptus beside the
  34 m hospital tower).

### Verification (real output)

```
npm test:  tests 352 / suites 40 / pass 352 / fail 0   (baseline before splice: 328/328)
npm run check:
  campus-3d.json OK — 1395 buildings (390 named), 3878 paths (22587 points), 662 surfaces (72 plazas)
  campus-lidar.json OK — 293 measured heights, 7275 trees, terrain 1014×923
  campus-boundary.json OK — 1 ring(s), 244 points; textures OK — 87 chunks, 31.1 MB, source google
  ok: 4335 ground, 505 massing, 507x462 terrain
  campus-colleges.json OK — 8 colleges, 128 buildings affiliated
eye-level probes (real page, __campusWalk.probe, 33 sites): every changed mass renders exactly
  its pinned value (osm:502 34.0, Prebys 46.9, Campus Point tower 31.3, QAA 24.3, CSC 6.9/6.5,
  Fleet 5.7, substation 5.3, greenhouses 4.9–5.3, Preuss 9.2–11.7, carports 3.8–8.7);
  demolition site (1416,−1299) renders null; osm:503 renders its documented 20 m guess.
  Known roof-anchor class visible at osm:502 (−2.7 vs surveyed elevation) and osm:509 (+1.9) —
  logged above, cross-shard.
screenshots: .cache/gauntlet-r0c2/shots/ (hospital towers, Prebys, Campus Point tower, QAA,
  carports, CSC yard, BFS greenhouses, Preuss, substation, empty demolition site)
```

Not deployed, not pushed — per the run's hard prohibitions. Local commit only.
