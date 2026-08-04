# Gauntlet findings — 2026-08-04_141745

## Pass 1, shard r1c1 (x −162.1..883.3, z −485.6..501.3 — 163 buildings, 111 named)

`npm test`: **312/312 pass**. `npm run check`: all four validators pass (colors check newly
chained). Every fix below is pinned in `tests/campus-epoch.test.mjs` (54 tests, sections 7–8 new)
and eye-level verified through the real page (`__campusWalk.probe` rendered-roof checks: 10/10
match; screenshots in `.cache/gauntlet-r1c1/shots/`).

### Fixed — per-mass host bleed (class fix, `massHeights`)

Heights reconciled per HOST pasted the tallest volume's height onto every university massing ring
in its OSM footprint. `build-campus-lidar.mjs` now measures each GIS ring's own 2014 roof plane
(own rim grade, 25-return floor, single-plane coherence gate); `campus-massing.js` ships it.
Verified against a targeted EPT re-sample (103 tiles, per-ring percentiles):

| Entity | Was shipping | Now ships | Source | Test |
|---|---|---|---|---|
| Natatorium | 14.9 m (Main Gym's) | 8.5 m | LiDAR per-mass plane, p75 (tight body under gym edge-returns) | epoch §7 |
| Urey Hall Office Addition | 30.5 m (tower's) | 12.1 m | LiDAR per-mass plane, p98 | epoch §7 |
| Urey Hall main slab | 30.5 m | 30.5 m (unchanged, now deliberate) | stepped roof — p75 (25.4) matches no plane; mass withheld, host crown stands | epoch §7 |
| W. M. Keck Building annex | 24.1 m (Biomedical Sciences') | 6.4 m | LiDAR per-mass plane, p98 | epoch §7 |
| Powell Structural Components Lab | 21.9 m (SERF's) | 13.8 m | LiDAR per-mass plane, p98 | epoch §7 |
| Powell Structural Systems Lab | 18.7 m (GIS said 8.5) | 18.7 m (now measured, was max-wins luck) | LiDAR per-mass plane | epoch §7 |
| Medical Teaching Facility block | 29.9 m (stale GIS) | 19.7 m | LiDAR per-mass plane, p98 | epoch §7 |
| Medical Teaching Facility low wing | 29.9 m (stale GIS) | 8.3 m | LiDAR per-mass plane, p75 (body p75−p50 = 0.1) | epoch §7 |
| Tuolumne T House East | 17.3 m (complex median) | 9.3 m | LiDAR per-mass plane + own-rim grade | epoch §7 |
| Student Center Pub | 12.6 m (p75 in eucalyptus crown) | 4.6 m | HAND_AUDITED "Stage Room at the Pub" (p50 roof band, GIS agrees at 4.3) | epoch §7 |
| Mandeville Center masses | one 20.9 m slab | 20.9 fly volume (hand-audit held) | HAND_AUDITED | epoch §7 |
| Eckart Building (out-of-shard, SIO) | 3.7 m after first rebuild | 11.3 m | own-rim grade fix — host median sat 7.6 m upslope on the bluff | epoch §7 |

Base-grade rule: masses measure from their OWN rim (terrain grid is ground-class only, so a rim is
never rooftop); host-median grades smeared slopes (Eckart −7.6 m, Tuolumne +2.6 m).

Plane-coherence rule: when roofOf's canopy guard fires (p98−p75 > 5), p75 ships only if the body
is a real plane (p75−p50 ≤ 2 m) — keeps MTF's wing (0.1) and Natatorium (1.4), withholds Urey's
stepped slab (8.8) and 11 other stepped masses campus-wide. No gate was loosened.

### Fixed — epoch violations (POST_2014_SITES additions, all verified by web record + LiDAR signature)

| Entity | 2014 return was | Now ships | Evidence |
|---|---|---|---|
| Ola, Arena, Artesa, Cala, Cresta, Marea (Mesa Nueva, 2017) | old Mesa Apartments / ground (4.3–20.3 m canopy) | GIS massing (15.2–24.4 m) | opened 2017 |
| Viento, Brisa (Nuevo West, 2020) | 22.9 m predecessor/canopy | GIS 36.6 / 21.3 m | opened 2020 |
| Athena Parking Structure (2019) | 2.3 m surface lot | GIS 29.9 m, 7 levels | opened 2019 |
| Survivance (TDLLN, 2023) | 8.2 m old theatre district | GIS 33.5 m | siblings already tabled |
| Tata Hall for the Sciences (2018) | 19.5 m demolished USB | GIS 25.6 m | opened Nov 2018 |
| Altman CTRI (March 2016) | 28.6 m topped-out construction frame | GIS 29.9 m, 7 storeys | ucsd.edu, March 2016 |
| Campus Point Parking Structure | 8.2 m mid-construction | GIS 12.8/21.3 m (E/W) | Jacobs Medical Center buildout |
| Epstein Family Amphitheater (2022) | 17 m eucalyptus canopy | **unbuilt** (see below) | opened 2022 |

Pinned: epoch §1 (no heights, no partHeights, no massHeights inside post-2014 footprints —
the massHeights guard is a new test), §2 (minimum believable render heights, 8 new entries).

### Fixed — identity and placement

| Entity | What was wrong | Correction | Test |
|---|---|---|---|
| Epstein Family Amphitheater | OSM tags the bowl `building=no`; the importer's truthiness check shipped it as a solid 17 m slab of 2014 canopy | `build-campus-3d.mjs` honours `building=no`; bowl unbuilt (better absent than wrong — open-air venue, no massing source for the stage canopy); place anchor kept at ring centroid (743, −131.6); 4.6 m GIS kiosk still renders | epoch §8 |
| Eighth College label | hand-seeded at (−99.4, 608.5) — a canyon interchange 1.1 km south of the college | (122.5, −515.1), the mean of its four member buildings (Alianza, Umoja, Coalition, Malk Hall) per OSM 2026-08-04 | epoch §8 |
| campus-colors.json | 40-entry index drift vs campus-3d (buildings added 08-03, colors never rebuilt) — roof colours misassigned campus-wide past the insertion point; my Epstein splice would have widened it | full NAIP rebuild: 1395/1395 aligned; `build-campus-colors.mjs --check` now chained into `npm run check` so drift fails CI | `npm run check` |
| GIS massing tree-exclusion zones | `campus-species.js` passed the raw ring ARRAY (decimetres) as one ring — every massing zone was a silent no-op | outer ring, /10 scale; 13 in-mass trees pruned | covered by tree audit below |

### Audited clean (shard r1c1)

- **Trees**: 520 in shard; 0 inside building footprints, 0 over 32 m, 3 young trees at the
  amphitheater's landscaped edge confirmed by the imagery pass (pass 2 felled 3,379 campus-wide
  ghosts, 1,244 of them the >15 m grove under new construction).
- **Markings**: every `fitError_m` in `campus-markings.json` within gate (0.5 m / RIMAC 0.35 m);
  0 failures.
- **Terrain**: rebuild byte-stable except one 0.1 m cell (float summation order); Voigt Dr →
  Ridge Walk grade walks 24.3 → 17.5 m over 130 m corner-to-corner at eye level, no
  flat-planting (screenshot `voigt-ridgewalk-hill.png`).
- **Heights**: remaining shard masses agree with the re-sample within 0.2 m.

### Noted, not fixed (out of scope or unresolvable to gate)

- **Unnamed OSM buildings (18 in shard)** measure off area-guesses by up to 18 m (index 224:
  ships 9 m, clean 27.0 m plane, 3,104 returns). Not fixed: `POST_2014_SITES` is name-keyed, so
  no epoch guard can protect an unnamed footprint; auto-applying LiDAR would ship predecessor
  heights for any post-2014 unnamed structure. Needs an existence-check mechanism (truecolor
  roof-presence × OSM footprint × LiDAR plane agreement) before those heights are trustworthy.
- **Mesa Nueva / Nuevo West sub-masses** render under GIS facility names ("Mesa Nueva - Marea")
  rather than student names — the rename fires on centroid-in-OSM-ring and these concave rings
  put GIS centroids outside. Heights correct; labeling nuance only.
- **H1 (LiDAR↔Apple agreement)**: not built this pass — the per-mass work consumed the shard
  budget. The massHeights data is the LiDAR half of H1's comparison; the Apple registration fit
  (1.25 m offset) remains the open first-class objective.
- **r0c1 owns Eighth College's buildings** (Alianza etc., z < −485.6) — no shard in this run
  covers them; they remain absent from campus-3d/arcgis (post-08-03 OSM additions).
- **Solis Hall** ships 14.9 m (GIS/LiDAR reconciled); its GIS mass p50 measured 6.5 m but the
  building is a tall lecture box — plausible at eye level (screenshot), left standing.

### Files touched

`scripts/build-campus-lidar.mjs` (epoch table +14, HAND_AUDITED +1, massTargets/massHeights
emission), `scripts/build-campus-3d.mjs` (`building=no` filter, Eighth College + Epstein seeds),
`docs/js/campus-massing.js` (per-mass consume, parts lidarDone), `docs/js/campus-species.js`
(massing zone scale bug), `package.json` (colors check), `tests/campus-epoch.test.mjs` (sections
7–8, POST_2014 mirror, FLOORS), `README.md` (per-mass survey section), and rebuilt
`campus-lidar.json`, `campus-colors.json`, `campus-3d.json` (surgical: label + Epstein removal,
matching what the generators now produce).
