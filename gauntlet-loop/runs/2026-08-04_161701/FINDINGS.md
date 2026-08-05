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
