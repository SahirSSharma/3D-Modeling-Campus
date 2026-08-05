# Gauntlet findings — 2026-08-04_204721 (judge re-audit)

## Pass 1, shard r1c1 (lat 32.873467..32.882391, lng −117.242934..−117.231752 — 162 buildings, 110 named)

`npm test`: **368/368 pass** (was 360; §13 of `campus-epoch.test.mjs` is new — 8 tests).
`npm run check`: all five validators pass (294 measured heights, 505 massing parts, 7,276 trees).
Every candidate in `pass1-r1c1.screen.json` was re-derived before judgement: a fresh targeted
EPT re-sample replicating the build pipeline's own rules (same roofOf tree-guard, same rim-median
base off the shipped terrain grid, same plane-coherence discipline, plus a minus-tower re-sample
for Jacobs), Apple snapshots for every site, crops of the registered Google chunks, and a Street
View 2025-02 frame where a construction date mattered. Probe artifacts in
`.cache/gauntlet-r1c1b/` (probe.json, evidence/, shots/).

Eye-level verified through the real page: 14 `__campusWalk.probe` rendered-roof checks, 13/14
exact after moving three probe points off courtyards and the Jacobs tower core (SSC and Black
are courtyard buildings whose centroids fall in their own voids — the same lesson r0c1 logged).
The one residual delta is understood and correct: the Jacobs west-wing probe reads 34.5 where
the extrusion is 33.2 because probe reports roof minus LOCAL ground and the wing's grade sits
1.3 m below the complex's rim median — the mass list ships 33.2 exactly. Screenshots in
`.cache/gauntlet-r1c1b/shots/`.

### Fixed — heights (every value from a fresh EPT re-sample run this pass)

| Entity | Was shipping | Now ships | Source | Test |
|---|---|---|---|---|
| Central Utilities thermal storage tank (osm:224) | 9 m area guess | **27.0 m** | LiDAR, 3,104 returns, one plane p50 26.4 → p98 27.0; standing identically on the registered chunk and today's Apple | epoch §13 |
| VA plant block (osm:826) | 9 m area guess | **6.4 m** | LiDAR, 1,061 returns, p50 6.3 → max 6.5 — the tightest plane in the batch; standing in both epochs | epoch §13 |
| Solis Hall | 14.9 m (host reconcile of a guarded p75) | **6.4 m** | HAND_AUDITED: 62 % of returns in a dense 5–6.5 m band, the rest up the eucalyptus crowns to 24.8 — p75 was still canopy (the Stage Room failure); GIS eave agrees at 4.3 / one level | epoch §13 |
| Black Hall (GIS "Black Apartments") | 18.3 m GIS record, unchallenged; "Black Hall" name lost | **16.1 m, named Black Hall** | MASS_RENAMES → the exact-name twin rule keys the challenge; 5,446 returns, p98 16.1, no guard — OSM ring measures the identical 16.1 | epoch §13 |

### Fixed — geometry/render classes (the case was never the fix)

| Class | Members found | Root cause | Fix | Test |
|---|---|---|---|---|
| Exact-name double-render | Student Services Center (coverage 0.930), CMRR (0.991) — campus-wide sweep: these two are the ONLY flips | `nameCarried` required a GIS centroid INSIDE the OSM ring; both facilities rings are drawn offset enough to miss, so the ≥0.85 area test never ran and the OSM copy extruded through massing that already IS the building and already SAYS its name | a mass wearing EXACTLY the OSM name within 150 m carries the name — the same twin rule `build-campus-lidar.mjs` already uses to key epoch guards. Cala-class rings (covering masses can't carry the name) still render; verified | epoch §13 |
| Part-modelled outline slab | Vela (osm:949) — 19 m outline through the paseo and both PCW towers | the parts gate counted the FILTERED part list; Vela models two parts but only the tower box carries a height (podium untagged, post-2014 so no partHeights), and one survivor flipped the whole building onto the outline path | the gate reads the RAW part count; the covered tower part yields to the 70.1 m / 23-level PCW mass beneath it. Zero-survivor buildings (Tapestry, Catalyst, Kaleidoscope) keep the outline fallback — verified unchanged | epoch §13 |
| Demolished pads still extruding | osm:1351 (12 m phantom), osm:56 (9 m phantom) | OSM rings survive their buildings; unnamed, so `skipOsm` has no name to key | footprint anchors (the Campus Point convention): (545.3, 48.3) — bare dirt on the registered chunk, staging pad with trailers on Apple, Triton Center frames rising beside it in SV 2025-02; (374.4, −88.3) — razed for the dig south of the Chancellor's Complex | epoch §13 |

### Rejected candidates (each re-measured before rejection; do not re-find these)

- **`jacobs-main-host-bleed`** — REJECTED. The screener read the 33.2 m host value on the main
  GIS ring as bleed and implied its p50 (20.8) is the roof. The complex is genuinely stepped:
  histogram peaks at 20 m (L4 wings) AND 34–39 m (the cruciform core), and the core extends past
  the tower's own GIS ring — a minus-tower re-sample still has no plane (p50 20.7 / p75 25.3 /
  p98 34.5, bodyTight false). Urey rule: the mass emits nothing, the host answers (33.2 = guarded
  p75), the tower measures its own 39.8. Shipping 20.8 would flatten the core by two storeys to
  fix a wing that is over by one. Pinned in §13 so the state can't drift silently.
- **`hss-tower-vs-wing-identity`** — REJECTED. The "split" is the building: a 36.7 m tower
  (1,970 returns, massOk) and an 8.5 m wing at its GIS record (its own returns are
  tower-contaminated: p50 8.6 under p98 36.2, correctly ineligible). The OSM 4-vertex ring
  covers only the tower, so the tower carries the ampersand name and the wing keeps the
  inventory name — two labels for two volumes of one complex, each at a measured/recorded
  height. Nothing to fix; pinned.
- **`unnamed-438-va-deck`** (as a measurement) — REJECTED as any 2014 ship. Apple shows a
  finished multi-deck garage with cars on the top deck; the 2014 returns read p50 2.4 m — a
  surface lot with scattered tall objects. The garage postdates the flight: `roofOf`'s 4.0 m
  would render it at curb height and the 21.6 m p98 is scatter, not a deck. The stated 20 m
  area guess stands (in family with a five-deck garage), pinned as EXCLUDED from osmHeights.
  Note: the Google chunk over this footprint is censored (federal facility) — Apple is the
  only current view of it.

### Withheld

| Entity | Why |
|---|---|
| VA parking structure (osm:438) | post-2014; no source resolves the built garage's height to gate (GIS has no record here, floor count not verifiable from nadir). Declared 20 m guess stands, stated as a guess. |
| Jacobs Hall main ring (per-wing planes) | stepped complex with no GIS decomposition beyond the tower ring; per-wing measurement needs geometry no current source provides. Host value stands under the Urey rule. |

### Logged for a later pass, not fixed

- **VAF Building 3 position disagreement**: the OSM ring and the exact-name GIS mass stand
  within 150 m with ZERO footprint overlap (area coverage 0.000, n=48). Somebody is wrong about
  where "Visual Arts Facility - Building 3" is — likely the university's internal numbering vs
  OSM's. Both render today (the twin rule deliberately yields when coverage fails, so nothing
  was deleted); §13 pins that neither vanishes until a source resolves the position.
- **Roof-anchor grade class** (r0c1's cross-shard log): the Jacobs probe delta above is the same
  class — rendered-height-above-local-ground ≠ extrusion on graded sites. Still logged, still
  not smuggled in.

### Data rebuilds this pass

`build:arcgis` (505 massing rows, byte-stable except the one intended rename) and
`build:lidar` + `prune-trees` (diff confined to the four intended height keys; trees 7,271/7,276
identical as a set, five cluster-boundary trees drift ≤0.8 m; terrain 2 cells of 935,922 differ
by 1 dm — float-summation order in the concurrent tile fold, inherent to any rebuild).
`campus-colors.json` untouched: massing order verified stable, so the index-keyed colours stay
aligned.
