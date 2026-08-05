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

## Pass 1, shard r1c2 (lat 32.873467..32.882391, lng −117.231752..−117.220569 — 97 buildings, 64 named)

Judge pass over `pass1-r1c2.screen.json` (16 candidates). Every number below was re-derived
from a fresh EPT re-sample (`.cache/gauntlet-r1c2b/probe.out`, 51 targets), the shipped data,
Apple/Street View evidence, and build-date research — the screen was treated as claims, not
findings. Three of its candidates turned out to be one *class* each; the classes are the fix.

### Fixed — builder classes (the case was never the fix)

| Class | Root cause | Fix | Test |
|---|---|---|---|
| Duplicate-name heights collision (from `sci-223-name-collision`) | `lidar.heights` is keyed by OSM name and OSM names are not unique — nine campus names label two rings each, so the shared key is a last-writer-wins race. Both Spinal Cord Injury Buildings shipped 6.4 m: the value belonged to whichever ring the tile fold visited second (the mostly-empty post-2014 hospital site). | Collided names emit **per ring index** (`osmHeights[bi]`), never the shared key; `POST_2014_OSM_RINGS` gives the epoch rule a per-ring form for the pairs that straddle the flight (osm:954, osm:833). Spanos stays the one deliberate name-level exception (HAND_AUDITED, written knowing both rings). Members re-measured: SCI 223 → 17.2 (p50 = p90 = 17.2, 17,154 returns); SCI 954 → OSM tag 15.6 stands (2021–26 VA hospital, flight saw its predecessor lot); VAF-B3 rings 12/157 → 11.7/11.5 each instead of racing; Salk wings, Earth Halls, Greenhouses unchanged in value, now collision-proof. | epoch §14 |
| Host-rename identity theft (from `dean-osm-swallows-pc1300`) | `assembleMasses` hands an OSM host ring's name to any GIS mass whose centroid it contains — even when the university record already gives that name to a DIFFERENT nearby building. The Dean's Residence ring (drawn over the PC1300 block, 38 m east of the actual house) renamed the apartments; the chain then handed "Pepper Canyon Apartments 1300" to the LAUNDRY, and the researched facades keyed by name followed the stolen labels. Same class campus-wide: the Spanos APC ring renamed the 1988 Training Facility, "Mandell Weiss Forum" swallowed James' Place, Electric Shop and Environmental Management Facility each labelled 2–3 masses. | A fixpoint rename guard: a rename is refused when the wanted name is already carried by a different GIS mass within 150 m (unless that carrier is itself renaming away). Pure swaps — Meteor/Galathea, where each mass stands in the other's ring — survive, because OSM stays the name authority where no third building's identity is taken. A 1–2 character host name never replaces a fuller GIS name (Matthews "A".."E" rings). | epoch §14 |
| Word-suffix twins double-render (from `cala-mesa-nueva-outline`) | The exact-name twin rule cannot see that "Mesa Nueva - Cala" IS Cala, so the OSM ring and the GIS mass both extruded at 24.4 m in the same courtyard — and the researched "Cala" facade named nothing. Same class: Brisa, Arena, Marea, Artesa, the Matthews letters, RWNLLN Coalition. | A mass carrying the OSM name as a word suffix (`… - Cala` / `… Cala`, host ≥ 3 chars, within 150 m) carries the identity: the ring suppresses, the mass adopts the OSM short name. Name only — a suffix host never passes height (Spiess Hall's partial ring would have dropped a 17.1 m record to 12.5). Facade keys migrated to the short names the masses now wear. | epoch §14 + facades guard |

### Fixed — heights (every value from the EPT re-sample + rebuilt builder output)

| Entity | Shipped | Now | Why |
|---|---|---|---|
| Spinal Cord Injury Building (osm:223, the 1990s center) | 6.4 m (collision race) | **17.2 m** | p50 = p90 = 17.2, 17,154 returns — one plane; Apple shows it standing unchanged |
| Matthews Apartments A–E (1972, pre-2014 documented) | 6.1 m (two-storey default) | **8.6 / 8.5 / 8.6 / 8.7 / 7.8 m** | own planes; E's p98 13.4 is canopy so its guarded plane (7.8) ships — its own measurement, not a sibling's |
| Campus Point Parking Structure West | 21.3 m (5 levels × 4.27 default) | **14.4 m** | 12,626 returns, p50 12.9 → p98 14.4, decks at a garage's ~2.9 m pitch; stood complete in the flight (East went up with JMC 2012–16 and keeps its post-2014 record 12.8) |
| East Campus Utilities Plant (~2000) | 4.3 m (one-level record) | **8.3 m** | p98 8.2/rim-based 8.3, bodyTight — an industrial hall, not offices |
| 9435 Modular Offices | 8.5 m (two-storey default) | **3.7 m** | trailer banks: p50 3.6 → p98 3.8, the tightest plane in the shard |
| Stuart Collection Storage (building 91) | 8.5 m (default) | **4.4 m** | 236 returns, p98 4.3 + rim, a shed |
| osm:764 (VA plant building) | 12 m (area guess) | **9.7 m** | p98 9.7 under a 33.6 max flier; verified standing on Apple |
| osm:775 (modular by the 9435 banks) | 4.5 m (area guess) | **3.8 m** | p50 3.8 = p98 3.9 |

### Renames restored by the guard (heights unchanged unless stated)

Dean's Residence ring → PC1300 keeps "Pepper Canyon Apartments 1300" (11.5 m, its own plane),
the laundry keeps "Pepper Canyon South Laundry", the residence renders once at its 6.1 record.
Spanos: Training Facility (1988) and Performance Center (2015) each wear their own university
name. James' Place returns. Electric Shop, Environmental Management Facility, Mayer Hall, Urey
Hall, Jacobs Hall tower, SDSC office addition, Weiss Theatre shop, CMM East (→ Palade), BSB
(→ Keck), SERF (→ Powell), Shiley expansion, Faculty Club expansion (reverts to its own 4.3
record with its name), Holly/Guava/Ivy each label one building. Suffix twins adopt their OSM
short names: Cala, Brisa, Arena, Marea, Artesa, Coalition, Greenhouses 1–3, Spiess Hall,
Matthews A–E. Campus-wide assemble diff: 48 changes, all accounted for
(`.cache/gauntlet-r1c2b/assemble-diff4.out`).

### Rejected candidates (each re-measured before rejection; do not re-find these)

- **`viterbi-osm-only-guess`** — REJECTED. The 18 m is not an area guess: Viterbi (2024) is in
  `ESTIMATED_POST_2014` with a documented Street View floor count. The flight saw its site at
  p50 0.1 and must stay silent; the estimate ships stated as what it is. Pinned in §14.
- **`jacobs-bed-tower-stepped`** — REJECTED as an Atkinson-style carve. The Bed Tower topped out
  in 2013, so 61.2 IS the 2014 plane of the finished shell; the minus-tower re-sample has no
  plane at all (p50 16.8 / p75 51.4 / p98 60.1, bodyTight false) because the "wings" are the
  tower's own setbacks. The crown measurement stands; the JMC tower measures its own 65.9.
- **`trolley-stations-zero-plane`** — REJECTED. The platform structures are 2021; the 0.0 m
  planes (56/52/45 returns) are the empty right-of-way before the build. POST_2014 handling is
  already correct: the GIS records (4.6) ship, the zero-plane never does. Pinned in §14.
- **`warren-field-house-empty`** — REJECTED. The site has ZERO 2014 returns, but Apple and
  Street View 2025 show the temporary fieldhouse (~2020) standing — a post-2014 record ships
  its 4.6, and "no returns" is the epoch working correctly, not an empty site.
- **`cpp-east-with-west`** — the screener's West half was right (measured above); East is
  REJECTED as a LiDAR ship: it went up with Jacobs Medical Center (2012–16), the flight caught
  it mid-build (p98 8.6 of a partial deck, one 876.6 atmospheric flier), and its post-2014
  record 12.8 stands.

### Withheld

| Entity | Why |
|---|---|
| East Campus Utilities Plant Expansion (2016) | the tight 7.5 m plane under its footprint is its PREDECESSOR's roof — post-2014 site, no admissible source for the built structure; the 4.3 record stands |
| Anne Ratner Children's Eye Center + expansion | stepped roof: p50 4.6 under a 10.2 crown shared with Shiley's vault — no single plane; the expansion (building 817) is too near the 2015–16 Shiley expansion generation to admit a 2014 plane unverified; records stand |
| Mesa Apartments Central 9242 / 9240 | Mesa Nueva's towers bleed through both rings (p50 20.3 over two-storey apartments, guard-tripped on 9240); records stand |
| osm:762 (small VA structure) | three-quarters of its 589 returns are neighbour bleed (p75 22.3 over p50 4.8); its 4.5 guess agrees with the dense low band and stands as a guess |
| osm:833 (VA parking garage, 2023) | flight saw the surface lot (p50 0); `POST_2014_OSM_RINGS` bars any 2014 ship; the declared 16 m guess stands, stated as a guess |

### Logged for a later pass, not fixed

- **OSM parcel letters as places**: `campus-3d.json` `places` carries "A".."E" at Matthews
  verbatim from OSM, so the walk HUD's "near …" callout can answer with a bare letter. OSM is
  the name authority and these are its names; left as-is. If Sahir wants the places table to
  prefer university full names where a suffix twin exists, that is a one-rule change in
  `build-campus-3d.mjs` — flagging, not doing.
- **H1 epoch-agreement audit** (`scripts/audit-epoch-agreement.mjs`): still not built — out of
  a judge pass's scope. The Apple 1.25 m registration offset also remains open; nothing in this
  pass sampled Apple pixels.
- **Pre-existing multi-mass university labels** (Tuolumne ×8, Vela ×7, Student Center ×5,
  Marshall Lower ×6…): the university record legitimately labels every structure of a complex
  with the complex's name. The rename guard neither created nor can fix these; they predate it.

### Data rebuilds this pass

`build:lidar` + `prune-trees`: heights diff confined to the intended keys (SCI shared key
retired to per-ring, Matthews/CPP-West/utilities/9435/Stuart/764/775 as tabled above); trees
identical as a set; terrain byte-identical. `campus-facades.json`: eight compound keys migrated
to the short names their masses now wear (researched values untouched). Eye-level verification:
26 sites photographed at eye height + 55 m hover (`.cache/gauntlet-r1c2b/eyelevel/`), every
rendered roof-above-ground probe matches its shipped height exactly (25/26; Cala's centroid
probes null because the 55-vertex ring is a courtyard donut — its west wing probes 24.6 above
local ground against a 24.4 record), zero page errors.
