# FINDINGS — run `2026-08-05_165434` · shard r0c0 (re-sweep)

Pass 1 re-sweep of the NW campus shard (Estancia / Sanford / Marshall Residence /
coastal / Black Gold / LJF fringe). Screen: 6 candidates (2 high / 4 medium). Judged
by `cursor-grok-4.5-high`.

Every candidate in `pass1-r0c0.screen.json` was re-derived before judgement with an
independent full-depth targeted EPT re-sample (7 targets in
`/tmp/gauntlet-r0c0-judge/reprobe.json`; point counts matched the screener's
`/tmp/gauntlet-r0c0-screen/probe.json` exactly — 846 / 1,093 / 5,182 / 7,109 /
5,822 / 5,357 / 1,841), Apple snapshots with OSM-ring overlays, and Overpass tags
for the gabled claim. Measurement via `scripts/lib/roof-measure.mjs` `explainRoof`
with rim-median base on every target.

### Fixed — heights

| Entity | Was shipping | Now ships | Source | Test |
|---|---|---|---|---|
| Black Gold Rd gabled house (`osm-876-underheight-gabled`, osm:876) | 4.5 m area guess | **8.0 m** | `OSM_UNNAMED_VERIFIED`: 846 returns, `explainRoof` rule=p98 → 8.0 (p50 3.7 / p75 4.3 / p98 8.0, dense 0.748, spread 3.70). Overpass way/1112137808 tags `roof:shape=gabled` + `roof:colour=grey`. Apple z19: finished dark gabled roof with skylights today. Gate correctly refuses auto-admit; tag + imagery pick the ridge. | epoch r0c0 165434 |

### Withheld (better absent than wrong)

- **`osm-892-underheight-multiplane` (osm:892)**: Independent EPT matches screener
  (1,093 pts, rule=p98 → 9.0, hist 2 m:462 / 4 m:225 / 8 m:142, dense 0.469).
  Apple ring overlay sits on a light roof section beside taller neighbours. The
  dense body is one-storey (≈ p75 4.7 ≈ the 4.5 guess); shipping roofOf would
  paste the 9.0 shelf. Added to `OSM_WITHHELD`. Pinned as EXCLUDED from
  osmHeights.

- **`osm-482-multiplane-house` (osm:482)**: 5,182 pts, gradeSpread 12.9 m, dense
  0.34, bimodal 6/9 m, roofOf 11.0. Apple shows real multi-level cliffside
  terraces — no single plane. Guess 9 sits between the wings; leave it. Pinned
  undefined in osmHeights (not added to WITHHELD — a future parts split could
  still be honest).

### Rejected candidates (each re-measured before rejection; do not re-find these)

- **`osm-985-multiplane-idlehour`** — REJECTED. Canopy-guarded roofOf 8.0 vs
  guess 9 (|Δ| = 1). Multimodal 3/7/6/4 m; locking the guarded body does not
  change eye-level and risks pasting one wing of a real multi-plane estate.
  Guess stands.

- **`osm-964-960-959-multiplane-cluster`** — REJECTED. |ship−roofOf| ≤ 0.9 m on
  all three; stepped / multimodal hist. Guesses already near the measurable
  planes. Not eye-level bugs.

- **`osm-multiplane-guess-residue`** — REJECTED as scoped. Residual rings
  (963, 967, 736, 743, 729, 492, 965, 227, 957, 872) are |Δ| < 2, pts < 400,
  or canopy-smeared. Named landmarks in-box already track measured planes.
  Prior withholds 513 / 828 / 975 untouched (no new Apple/identity evidence).
  The 280-campus multi-plane class remains — this pass resolved the one ring
  whose plane an OSM tag + Apple close-up could pick without inventing.

### Handoffs / observations for later shards / passes

- **Gabled underheight class**: osm:876 is the exemplar — OSM `roof:shape=gabled`
  + dense eave body + ridge at p98. The lidar builder does not currently see
  OSM tags (campus-3d.json keeps only `h`/`p`/`n`), so these stay hand-admitted
  via `OSM_UNNAMED_VERIFIED` after imagery. Persisting `roof:shape` into the 3d
  build would let a future pass write a real class rule; out of scope here.
- **osm:482 cliff house**: a parts-level split (upper terrace vs lower wing)
  would let both planes ship honestly — mapping pass, not height pass.
- **Remaining multi-plane unnamed in-box**: ~25 still ship area guesses after
  this pass's one admission + one withhold. Imagery triage of the next |Δ| ≥ 2
  standouts beats more EPT.

---

# FINDINGS — run `2026-08-05_165434` · shard r0c1 (re-sweep)

Pass 1 re-sweep of the north-central shard (Village East/West, Canyon Vista,
Warren residential, RIMAC fringe). Screen: 5 candidates (2 high / 2 medium /
1 low). Judged by `cursor-grok-4.5-high`.

Every candidate in `pass1-r0c1.screen.json` was re-derived before judgement
with an independent full-depth targeted EPT re-sample
(`/tmp/gauntlet-r0c1-judge/reprobe.json`) that ran BOTH rim bases side by
side: the builder's vertex-only `rimBase` and the screener's dense-edge
sampling. Measurement via `scripts/lib/roof-measure.mjs` `explainRoof` with
rim base on every target. Apple snapshots from the screener's `/tmp/gauntlet-r0c1-screen/apple/`
were reviewed for currency only (no colour sampling).

### Fixed — class (renderer)

| Entity | Was | Now | Source | Test |
|---|---|---|---|---|
| Roof-anchor class (campus-wide) | `roofY = heightAt(centroid) + h` | **`roofY = max(rimMedian + h, highestGround)`** via exported `roofElevation` | LiDAR heights are defined as roof − rimMedian; the extruder used a different base. On grade the two diverge: Village West Building 2 sank 3.0 m (centroid 119.9 vs rim 122.9 on a 2.9 m span); Canyon Vista Administration rose 4.6 m; osm:893's high corner stood 0.6 m above its own roof under the old formula. The `highestGround` floor covers the flat-extrusion hillside limit (Eckart: surveyed roof 1 m under its high corner on a 15.2 m bluff). `scripts/readiness.mjs` now reads rendered height against the same rim median. | epoch r0c1 165434 |

### Rejected candidates (each re-measured; do not re-find these)

- **`vw2-underheight`** — REJECTED as a height bug. Independent EPT of the GIS
  ring: 5,031 pts, `explainRoof` rule=p98 → **12.9** under builder vertex
  rimBase (base 122.9) — matches shipped `massHeights[m:-125,-1108]=13`
  within 0.1 m. The screener's "15.6" used dense-edge rim (base 120.2), which
  manufactures a 2.6 m under-read on the 2.9 m grade. Absolute roof is the
  same either way (135.8). The real defect was the roof-anchor class above
  (centroid placement put the roof at 132.9). Host `heights['Village West
  Building 2']=15.8` is the OSM ring's own plane under a different rim
  (base 120.0) — also consistent with absolute 135.8; own massHeights correctly
  wins for the rendered GIS mass.

- **`ve5-underheight`** — REJECTED as a height bug. Vertex rimBase → **12.3**
  (shipped 12.4); dense rim → 15.0. Same grade artefact (span 4.5 m). Plane
  pin in epoch §10 stands. Roof now follows the rim.

- **`ve4-underheight`** — REJECTED as a height bug. Vertex rimBase → **12.2**
  (shipped 12.1); dense rim → 14.0. Same class. Epoch §10 pin stands.

- **`cvr-bimodal-planes`** — REJECTED. Ship = fresh roofOf = **8.6**
  (rule=p98, spread 0.25, admissible). Histogram is bimodal (4 m terrace /
  8 m dining) but Apple shows both decks of one pre-2014 complex; the upper
  dining volume is the correct extrusion. Prior epoch pin stands. Do not
  drop to p50 4.6.

- **`osm57-multiplane-suppressed`** — REJECTED as actionable. 1,976 pts,
  spread 3.00, dense 0.276, multimodal — gate refuses. Already suppressed
  under Douglas/Brown/Brennan GIS; no render. Leave unbuilt (better absent
  than pasting roofOf=16 onto a stepped outline). Not added to OSM_WITHHELD
  — a future parts split could still be honest.

### Named OSM-tag buildings (readiness work-list)

None of the eight named buildings still on their OSM tag sit inside this
shard (Stewart Commons Annex @ z≈−154 and T-31 @ coastal fringe are outside
the r0c1 box). No action.

### Handoffs / observations

- **Screener rim methodology**: any future screen that reports |ship − roofOf|
  on a graded footprint MUST quote the builder's vertex rimBase, or it will
  re-find the VW2/VE4/VE5 false underheights. Dense-edge sampling is a
  different base, not a better measurement of the same one.
- **osm:893 burial**: was the roof-anchor class (centroid placement left the
  high corner 1.9 m above the roof). Closed by the rim anchor. Eckart's
  residual (surveyed roof 1 m under its high corner on a 15.2 m bluff) is
  the flat-extrusion hillside limit — the `highestGround` floor in
  `roofElevation` clears it without inventing height on every other mass.
- **280 stepped unnamed rings**: osm:57 is one in-box exemplar; still the
  highest-value residual class campus-wide, unchanged this pass.

### Verification

See final message for `npm test` / `npm run check` paste.

---

# FINDINGS — run `2026-08-05_165434` · shard r0c2 (re-sweep)

Pass 1 re-sweep of the east-campus shard (CSC yard, Preuss, Scripps Memorial
fringe, Qualcomm AA). Screen: 6 candidates (5 medium / 1 low). Judged by
`cursor-grok-4.5-high`.

Every candidate in `pass1-r0c2.screen.json` was re-derived before judgement
with an independent full-depth targeted EPT re-sample
(`/tmp/gauntlet-r0c2-judge/reprobe.json`; point counts matched the screener
exactly — CSC-D 2,004 / CES 3,329 / CSC-A 3,502 / Fleet N 545 / Preuss F
2,896 / osm:502 17,637 / osm:509 6,943). Measurement via
`scripts/lib/roof-measure.mjs` `explainRoof` with rim-median base on every
target. Absolute gaps quoted unrounded. Apple snapshots from the screener's
`/tmp/gauntlet-r0c2-165434/apple/` reviewed for currency only (no colour
sampling).

### Fixed — class (thin-shelf override reversal)

| Entity | Was | Now | Source | Test |
|---|---|---|---|---|
| CSC Building D (`m:1069,-637`) | 6.5 via `MEASURED_OVERRIDES` | **4.5** | Independent EPT: `explainRoof` rule=thin-shelf, hRel=4.477 (p50 4.266 / p75 4.477 / p98 6.510, gapAbs **2.033**, dense 0.921, bodyTight). Prior reject claimed "gap exactly 2.0 under the >2 cut" from rounded relatives; absolute clears. Override then forced p98 after the builder already took p75. Apple: finished CSC shop with mechanical plant / solar — plant is what thin-shelf discounts (siblings C/H already at 4.8). | epoch r0c2 165434 |
| CES (`m:1078,-476`) | 6.5 via same override class | **4.5** | Same class: gapAbs **2.030**, dense 0.871, bodyTight, hRel=4.482. Override comment called it a CSC-D near-miss sibling — both were inverted. | epoch r0c2 165434 |

Root cause: `MEASURED_OVERRIDES.massHeights` entries that reverse a thin-shelf
the shared rule already fired. Withdrawn both; Union Bank (dense under 85%)
stays. Builder comment that pinned "CSC Building D gap exactly 2.0" updated.

### Rejected candidates (each re-measured; do not re-find these)

- **`fleet-n-near-shelf`** — REJECTED. gapAbs 1.753 under SHELF_GAP; rule=p98
  → 5.699 matches ship 5.7. Dense body ≈3.9 matches GIS L1 but the cut does
  not fire. Do not retune for one pad (CSC-A gap 1.676 same family).

- **`preuss-f-dual-plane`** — REJECTED as a height bug. @1786,-549: bimodal
  hist (4 m:693 / 11 m:578), dense 0.415, rule=p98 → 11.728 ≈ ship 11.8.
  One GIS ring wraps both decks; upper plane is the honest extrusion for
  that ring. Do not drop to 4 m or invent GIS 8.5 as a compromise. A parts
  split is a mapping handoff (see below).

- **`roof-anchor-502` / `roof-anchor-509`** — REJECTED as open. Screener
  grade audit used centroid+h (Δ −2.7 / +2.0). Independent re-measure with
  `roofElevation`: Δnew=0 on both; surveyed absolute matches. Class closed
  by r0c1. Heights 34 / 10.9 stand.

- **`qaa-terrain-apron`** — REJECTED as a height bug. Height 24.3 reconfirmed
  (30,780 pts, rule=p98). 27/34 footprint vertices south of terrain
  `z0=−1383` — survey-box coverage handoff, unchanged.

### Handoffs / observations

- **Preuss Building F dual-wing**: GIS ring at (1786, −549) needs a parts
  split before the ~4–5 m wing can wear its own height. Mapping pass, not
  height pass.
- **Rounded-gap class**: any future "gap exactly 2.0 under the cut" claim
  must quote absolute `p98−p75`, not rounded relative heights. The CSC-D /
  CES overrides were manufactured by that rounding.
- **Apple plant ≠ keep shelf**: when Apple shows mechanical plant on a
  dense low body and thin-shelf fires, that is confirmation of the body,
  not a reason to override back to p98.

### Verification

See final message for `npm test` / `npm run check` paste.

---

# FINDINGS — run `2026-08-05_165434` · shard r1c0 (re-sweep)

Pass 1 re-sweep of the Muir west / Torrey Pines / Keeling / HDH / Geisel
House shard. Screen: 1 candidate (1 medium). Judged by `cursor-grok-4.5-high`
(own screen — Fable budget nearly spent; no high-severity findings).

Every candidate in `pass1-r1c0.screen.json` was re-derived before judgement
with an independent full-depth targeted EPT re-sample
(`/tmp/gauntlet-r1c0-judge/reprobe.json`; point counts matched the screener
exactly — GIS HDH 8,259 / OSM host 8,475). Measurement via
`scripts/lib/roof-measure.mjs` `explainRoof` with BOTH the builder's
vertex-only rim and the screener's dense-edge rim side by side. Apple
snapshot `/tmp/gauntlet-r1c0-165434/apple/hdh.jpg` reviewed for currency
only (no colour sampling).

### Fixed

None. Shipped planes already match measured roofOf.

### Rejected candidates (each re-measured; do not re-find these)

- **`hdh-bimodal-planes`** — REJECTED. Independent EPT of the GIS ring
  (`m:-175,382`): 8,259 pts, gradeSpread 1.0 m.
  - vertex rimBase 125.5 → `explainRoof` rule=p98, hRel=**19.338**
    (p50 15.141 / p75 17.848 / p98 19.338, dense 0.579, spread 1.490).
    Ship `massHeights=19.4`, Δ = **+0.062 m**.
  - dense-edge rimBase 125.2 → hRel=19.638 (matches screener 19.6);
    same rule, same class.
  - Thin-shelf did **not** fire: body not tight (p75−p50 ≈ 2.7 > 2) and
    dense 58–61% << 85%. Why: `'no guard fired; p98 is the roof'`.
  - OSM host ring: 8,475 pts, vertex hRel=**19.823** ≈ shipped
    `heights['Housing Dining and Hospitality Administration Building']=19.8`
    (Δ −0.023). Epoch pin at 19.8 stands.
  - Histogram is genuinely bimodal (≈15 m majority deck vs ≈18–19 m
    upper shelf). GIS L4=17.1 and the OSM tag h=15.6 sit with the lower
    band — those are not LiDAR roof measurements.
  - Apple z19 (`hdh.jpg`): finished pre-2014 admin with a multi-level
    flat roof and a central grey metal-grate / trellis over rooftop
    plant today. The upper volume is real; dropping to p50 15.4 would
    erase it. Epoch risk is low (existence agreed across Apple / OSM /
    GIS; the split is two decks of one building, not a post-2014
    rebuild).
  - Same class as this run's rejected `cvr-bimodal-planes` (r0c1) and
    `preuss-f-dual-plane` (r0c2): one ring wraps both decks; upper
    plane is the honest extrusion. Do not compromise to GIS 17.1 or
    invent a parts split from a height pass.

### Named OSM-tag buildings (readiness work-list)

None of the three named buildings still on invented heights sit inside
this shard (Hubbs Hall → r2c0, Hyatt Regency → r2c2, International
Center West → r1c1). No action.

### Handoffs / observations

- **Bimodal admin / dining class is closed for this site.** HDH Admin
  ships its measured upper plane; the 15 m deck is the majority of
  returns but not the roof the extrusion should wear. A future parts
  split (lower office deck vs plant / trellis volume) would be a
  mapping pass, not a height pass — leave massHeights 19.4 alone until
  then.
- **280 stepped unnamed rings**: this shard's screen raised none of
  them as candidates (no high/medium unnamed underheight). The
  campus-wide class remains the highest-value residual; not in scope
  for a one-candidate reject pass.

### Verification

See final message for `npm test` / `npm run check` paste.

---

# FINDINGS — run `2026-08-05_165434` · shard r1c1 (re-sweep)

Pass 1 re-sweep of the academic-core shard (Student Center / Bonner / VAF /
Powell-Focht / York / Mandeville). Screen: 4 candidates (1 high / 3 medium).
Judged by `cursor-grok-4.5-high`. Also worked the readiness named-guess entry
owned by this shard: International Center West (osm:167).

Every candidate in `pass1-r1c1.screen.json` was re-derived before judgement
with an independent full-depth targeted EPT re-sample
(`/tmp/gauntlet-r1c1-judge/reprobe.json`) using `scripts/lib/roof-measure.mjs`
`explainRoof` with the builder's vertex-only rimBase. Point counts matched
the screener where it had probed the same rings (VAF3-GIS 2,060 / Bonner
8,800 / Powell-Focht 15,276). Apple snapshots from
`/tmp/gauntlet-r1c1-165434/apple/` reviewed for currency only (no colour
sampling). Note: the screener's own `probe.mjs` still carries a hand-written
two-rule `roofOf` (no thin-shelf, no base) — its screen JSON claimed
`explainRoof`, which this judge re-ran for real.

### Fixed — class + name-level sync

| Entity | Was shipping | Now ships | Source | Test |
|---|---|---|---|---|
| Student Center A - Building G (`m:122,118`) | 8.5 GIS L2 (no massHeights) | **10.4** | Centroid outside OSM "Student Center" host → `PRE_2014_GIS_VERIFIED`. Targeted EPT: 749 pts, rule=canopy-guard → 10.3 (p50 10.1 / p75 10.3 / p98 24.0, dense 0.776, bodyTight); campus rebuild 10.4. Apple: finished white roof under eucalyptus. Sibling C/ES/A/H/F already measure through the host. | epoch r1c1 165434 |
| Student Center A - Building EN (`m:148,52`) | 8.5 GIS L2 (same hostless class) | **8.9** | Same admit. 521 pts, rule=p98 → 8.9 (dense 0.956). | epoch r1c1 165434 |
| International Center West (name) | `heights` 6.7; rendered GIS mass 8.2 → readiness "guess" | **`heights` 8.2** | Host-ring canopy-guard p75=6.7 is courtyard/low-wing contamination (hist 6m:3200/4406). Covering GIS mass `m:225,82` (Student Center B → host-renamed ICW) measures canopy-guard p75 8.2 (4,920 pts, bodyTight) matching L2=8.5. `MEASURED_OVERRIDES` syncs the label to the rendered plane. | epoch r1c1 165434 |

Root cause for G/EN: GIS masses whose centroids miss the OSM neighbourhood
outline never enter `massTargets`, so the L2 storey default stands forever.
Same `PRE_2014_GIS_VERIFIED` class as Preuss D/E, CSC hostless, Extended
Studies cottages. NOT added: Student Center Pub (4,482 pts, canopy-guard
body NOT tight — stepped; builder correctly skips; Stage Room HAND_AUDITED
4.6 answers the OSM name).

### Rejected candidates (each re-measured; do not re-find these)

- **`bonner-upper-shelf`** — REJECTED. Independent EPT: 8,800 pts,
  rule=p98 → **19.2** = shipped. Dense 0.757 under the 85% thin-shelf cut;
  bodyTight but gap is plant. Apple: long central grilled plant/skylight
  strip on the white roof. Pasting 15.5 would flatten the plant — same
  McGill / Literature / HDH near-miss family. Epoch pin at 19.2 stands.

- **`powell-focht-upper-shelf`** — REJECTED. Independent EPT: 15,276 pts,
  rule=p98 → **23.1** = shipped. Dense 0.683, spread 3.82; body not
  thin-shelf-tight. Apple: courtyard hall with dark solar arrays on
  south/east wings — upper volume is real. Same HDH bimodal / Preuss-F
  dual-plane class: one ring wraps both decks; upper plane is the honest
  extrusion. Do not drop to p50 18.5.

- **`vaf3-position-double`** — REJECTED as actionable / WITHHELD as
  identity. Two co-named footprints, zero overlap, both standing today
  (Apple), both clean one-storey planes (GIS 11.5 / OSM-render 11.7).
  This is university numbering vs OSM identity — not a date, not a height
  bug. Needs Sahir or a facilities map before either vanishes. Persistent
  open handoff from prior r1c1 passes; do not invent which is Building 3.

### Named OSM-tag buildings (readiness work-list)

International Center West was this shard's entry. After the name-level
sync, readiness named-guesses dropped **3 → 2** (Hubbs Hall → r2c0, Hyatt
Regency → r2c2 remain). ICW no longer appears on the invented-height list.

### Handoffs / observations

- **Screener probe.mjs still retypes roofOf.** The screen JSON cited
  `explainRoof`; the script on disk is the two-rule hand copy. Judges
  must re-import from `scripts/lib/roof-measure.mjs` — never trust a
  screener number that came from a local `roofOf`.
- **VAF-3 identity** remains the standing open question for this shard.
- **280 stepped unnamed rings**: Pub is an in-box exemplar of the class
  the multi-plane module measured as continuous/canopy, not discrete
  decks — leave unbuilt.

### Verification

See final message for `npm test` / `npm run check` paste.

---

# FINDINGS — run `2026-08-05_165434` · shard r1c2 (re-sweep)

Pass 1 re-sweep of the health-campus / Pepper Canyon / Mesa Central fringe
shard. Screen: 4 candidates (2 medium / 2 low). Judged by
`cursor-grok-4.5-high` (own screen — Fable budget nearly spent; no
high-severity findings). When unsure, withheld rather than invented.

Every candidate in `pass1-r1c2.screen.json` was re-derived before judgement
with an independent full-depth targeted EPT re-sample
(`/tmp/gauntlet-r1c2-judge/reprobe.json`) using `scripts/lib/roof-measure.mjs`
`explainRoof` with the builder's vertex-only rimBase. Point counts matched
the screener exactly (osm:365 1,591 / Campus Point East 20,177 / Mobile
PET/CT 108 / Mesa 9240 1,641 / 9242 1,455 / Mobile CT 360 / Campus Point
West 12,626). Apple snapshots from `/tmp/gauntlet-r1c2-165434/apple/`
reviewed for currency only (no colour sampling).

### Fixed

| Entity | Was shipping | Now ships | Source | Test |
|---|---|---|---|---|
| Mobile PET/CT Scanner (`mobile-petct-near-grade`) | 4.3 m GIS L1 solid box | **removed** | `NO_SOLID_ROOF` in `build-campus-arcgis.mjs`: 108 pts, every return in the −1 m bin, `explainRoof` rule=p98 → −0.6 (`why='no guard fired; p98 is the roof'`). Apple `mobile-petct.jpg` z19: temporary white gabled trailers/tents and a van in the Sulpizio / Altman courtyard — not a solid clinic. Foodworx Dining Room class. | epoch r1c2 165434 |

### Withheld (better absent than wrong)

- **`osm-365-mesa-area-guess` (osm:365)**: Independent EPT matches screener
  (1,591 pts, rim=0.13, `explainRoof` canopy-guard → **25.1**, p50 17.9 /
  p75 25.1 / p98 31.5, dense 0.343, spread 6.39,
  `why='p98-p75 = 6.4 m > 5 — crown overhang, take the roof plane'`).
  Hist mode is 5–6 m (377+168) — the real Mesa Central L2 body GIS
  siblings 9240/9242 ship as 6.1 — under Mesa Nueva tower bleed (18–31 m
  bins). Apple: finished low Mesa fabric today, no crane. Gate correctly
  refuses (rim + spread). Inventing 6.1 from a neighbour is not a
  measurement of this ring; admitting canopy-guard 25.1 would invent a
  mid-rise from neighbour towers. Added to `OSM_WITHHELD`. Area guess
  8.4 stands. Pinned `osmHeights[365]` undefined and render at 8.4.

### Rejected candidates (each re-measured; do not re-find these)

- **`campus-point-east-2014-midbuild`** — REJECTED as a height bug.
  Independent EPT: 20,177 pts, rim=1.00, gradeSpread 9.1 m,
  `explainRoof` thin-shelf → **6.6** (p50 6.5 / p75 6.6 / p98 8.6,
  dense 0.962, spread 2.04,
  `why='body tight (p75-p50 = 0.1), shelf 2.0 m above it, 96.2% in a 2 m band — plant, not building'`).
  Hist 6m:18,908 (94%). Apple: finished multi-level garage with cars on
  the top deck today. This is a DATE — East went up with Jacobs Medical
  Center; the 2014 flight sees a mid-build / lower-deck plane.
  `POST_2014_SITES` "Campus Point Parking Structure" correctly keeps GIS
  12.8. Do not "fix" it down to 6.6. West sibling already measured at
  14.4. Pinned massHeights absent + render 12.8.

- **`pepper-canyon-courts-still-unmarked`** — REJECTED as in-scope fix;
  RE-LOGGED as handoff. `campus-markings.json` still has zero facilities
  whose centroids fall inside this shard; string search
  pepper|foodworx|pickle → false. Apple `pc-courts.jpg` / `foodworx.jpg`
  z19 still show one reddish-brown tennis court and a 2×2 blue/grey
  pickleball cluster north/east of Foodworx today. Same open handoff as
  prior r1c2 passes and Muir west pickleball: painted surfaces exist;
  colour sampling stays off unregistered Apple pixels (campus offset
  1.25 m > 0.6 m gate). Better absent than wrong until a fitted
  registration residual clears gate.

### Named OSM-tag buildings (readiness work-list)

None of the three named buildings still on invented heights sit inside
this shard (Hubbs Hall → r2c0, Hyatt Regency → r2c2; International
Center West was closed by r1c1 this run). No action.

### Handoffs / observations

- **Pepper Canyon / Foodworx courts**: persistent open handoff — Apple
  registration residual must clear 0.6 m before paint ships. Do not
  sample unregistered Apple pixels.
- **Mobile CT sibling** (`m:1325,-44`): 360 pts, hist 2m:179 / −1m:176,
  ships L1=3 over a real 2.1 m trailer plane — NOT the same clear empty
  pad as PET. Left standing; revisit only with Apple evidence the pad
  is empty today.
- **osm:367**: same Mesa tower-bleed class as 365, but already
  suppressed under GIS Mesa 9240 (renders as 6.1) — no live extrusion
  of the 8.4 guess. No action.
- **280 stepped unnamed rings**: this shard's screen raised none of the
  multi-plane worklist as actionable (tower-bleed / epoch / paint
  handoff). Campus-wide class remains the highest-value residual.

### Verification

See final message for `npm test` / `npm run check` paste.

---

# FINDINGS — run `2026-08-05_165434` · shard r2c0 (re-sweep)

Pass 1 re-sweep of the Scripps / Shores shard (Vaughan–Ritter shoreline through
Birch Aquarium / Hubbs / Poole–Shores residential). Screen: 7 candidates
(6 medium / 1 low). Judged by `cursor-grok-4.5-high` (own screen — Fable budget
nearly spent; no high-severity findings). When unsure, withheld rather than
invented.

Every candidate in `pass1-r2c0.screen.json` was re-derived before judgement with
an independent full-depth targeted EPT re-sample
(`/tmp/gauntlet-r2c0-judge/reprobe.json`) using `scripts/lib/roof-measure.mjs`
`explainRoof` with the builder's vertex-only rimBase. Point counts matched the
screener exactly (Hubbs GIS 10,859 / osm:817 688 / 818 331 / 1032 4,305 /
1108 940 / 1066 1,031). Apple snapshots from `/tmp/gauntlet-r2c0-screen/apple/`
reviewed for currency only (no colour sampling).

### Fixed

| Entity | Was shipping | Now ships | Source | Test |
|---|---|---|---|---|
| Birch Aquarium service apron (`osm-817-birch-near-grade`, osm:817) | 4.5 m area guess | **absent** | 688 pts, `explainRoof` rule=p98 → **2.6** (`why='no guard fired; p98 is the roof'`, p50 0.3 / p75 1.4, dense 0.667, hist 0 m:275 + 1 m:184). Gate minH refuses. Apple: finished Birch Aquarium; ring is the service apron. `skipOsmAnchors` + `OSM_WITHHELD` (Foodworx patio class). Sibling 818 stays at matching 4.4≈4.5. | epoch r2c0 165434 |
| Hubbs Hall readiness false positive (`hubbs-readiness-false-positive`) | census "named guess" at 11.8 | **still massHeights 12.3** (census class fix) | GIS ring EPT: rule=p98 → **12.2** (dense 0.789 under 85% thin-shelf cut — plant on Apple). `heights` 12.2 ≈ `massHeights` 12.3. GPU rendered ≈11.8 drifted past 0.35 m slack on 9.5 m grade. Readiness gains table-agree path when `near(measured, nearbyMass)`; slack stays 0.35. Do not paste p75=8.1. | epoch + readiness-gates |

### Withheld (better absent than wrong)

- **`osm-1032-overheight-neargrade` (osm:1032)**: 4,305 pts, canopy-guard → **3.8**
  over near-grade hist (1 m:2570). Shipping roofOf invents a storey; guess 9
  stands off-campus. `OSM_WITHHELD`. Epoch risk noted (Apple bare-earth cut
  beside finished roof — could be landscaping DATE).
- **`osm-1108-poole-multiplane` (osm:1108)**: 940 pts, rule=p98 → 10.7, dense
  0.329, multimodal 3/7/8 m. No plane for auto-admit (1120 family). Guess 4.5
  stands. `OSM_WITHHELD`.
- **`osm-1066-multiplane-underheight` (osm:1066)**: 1,031 pts, rule=p98 → 12.3,
  trimodal 4/7/12 m, dense 0.461. Pasting roofOf invents the upper wing; leaving
  4.5 under-represents the main roof — neither is honest auto-admit. Guess
  stands. `OSM_WITHHELD`.

### Rejected candidates (each re-measured; do not re-find these)

- **`vaughan-ritter-terrain-oob`** — REJECTED as a height bug; RE-LOGGED as
  handoff. Vaughan / Ritter ship measured osm heights 14.9 / 14.6; terrain grid
  still ends at z_max=1386 while centroids sit at z≈1402 (rimCoverage ≈0.27).
  Survey-box expansion before any further admit on this fringe.
- **`multiplane-still-guess-residue`** — REJECTED as scoped. Zero new one-plane
  auto-admit candidates among 21 re-probed still-guess rings. Named SIO
  landmarks track measured planes under vertex rimBase. Residual ~33
  spread>1.2 refusals need per-ring Apple + EPT, not a blanket admit.

### Named OSM-tag buildings (readiness work-list)

Hubbs Hall was this shard's entry. It was never an invented height — GIS
`massHeights[m:-1137,1171]=12.3` matches independent roofOf 12.2. The readiness
row was a census false positive; the table-agree path clears it without
touching the height or widening slack. Hyatt Regency remains for r2c2.

### Handoffs / observations

- **Vaughan / Ritter shoreline apron**: persistent survey-box handoff
  (z_max=1386). Heights correct where measured.
- **280 stepped unnamed rings**: 1032 / 1108 / 1066 are in-shard exemplars of
  the class where imagery must pick the plane and statistics cannot — withheld,
  not admitted.
- **osm:818**: only remaining on-campus still-guess render beside the removed
  817, and it already matches its plane within 0.1 m — not a finding.

### Verification

See final message for `npm test` / `npm run check` paste.

---

# FINDINGS — run `2026-08-05_165434` · shard r2c1 (re-sweep)

Pass 1 re-sweep of the SE-campus shard (Villa La Jolla strip, Evening Way /
Gilman apartments, Villas Mallorca, Theatre District / CRS fringe, Rita /
Caminito Abrazo). Screen: 12 candidates (5 high / 5 medium / 2 low). Judged
by `cursor-grok-4.5-high`.

Every candidate in `pass1-r2c1.screen.json` was re-derived before judgement
with an independent full-depth targeted EPT re-sample
(`/tmp/gauntlet-r2c1-judge/reprobe.json`; point counts matched the screener
exactly — Union Bank 588 / UC Cyclery 726 / 580 769 / 584 703 / 615 732 /
665 1,642 / 664 853 / 787 4,726 / 609 913 / 634 2,083). Measurement via
`scripts/lib/roof-measure.mjs` `explainRoof` with builder vertex rimBase.
Apple ring-snapshots (`scripts/ring-snapshot.mjs`) for identity / canopy.

### Fixed — class (thin-shelf override reversal)

| Entity | Was | Now | Source | Test |
|---|---|---|---|---|
| Union Bank | 8 via `MEASURED_OVERRIDES` → p98 | **5.3** | Independent EPT: `explainRoof` rule=thin-shelf, hRel=5.3 (p50 5.2 / p75 5.3 / p98 8.0, dense **89.1%**, gap 2.7; hist 5m:470 of 588, only 9 pts at 8 m). Prior override claimed dense 79.9% under the 85% cut; with rimBase the cut clears. Apple HVAC is evidence FOR the thin-shelf body — same class as CSC D/CES (r0c2). Override withdrawn. | epoch r2c1 165434 |

### Fixed — heights (unnamed soft near-strict)

| Entity | Was shipping | Now ships | Source | Test |
|---|---|---|---|---|
| Evening Way / Gilman (osm:580 / 584 / 615) | 4.5 m shed | **8.3 / 8.4 / 8.1 m** | Soft near-strict (spr 1.5–1.7 over the 1.2 gate, bodyTight). Apple ring overlays: finished gabled apartment roofs, **no canopy**. Same strip as already-admitted 600 / 601 @ 8.6 / 8.5. Build rimBase tiling (targeted probe sat 8.4 / 8.3 / 8.2). | epoch r2c1 165434 |
| Villas Mallorca (osm:665) | 4.5 m shed | **10.1 m** | spr 1.26 barely over the gate; roofOf tracks the ~9–10 m plane already shipped for villa-east 632–651. Apple: finished Mediterranean tile roof. | epoch r2c1 165434 |

### Withheld (better absent than wrong)

- **`osm-664-canopy-pad` (osm:664)**: 853 pts, rule=canopy-guard → 16.1 over a near-grade 2–3 m body (hist 2m:239 / 3m:198). Apple ring overlay: real one-storey terracotta **pool house** beside the pool; crown bleed invents ~3 storeys. `OSM_WITHHELD`; guess 4.5 still renders and is nearer the truth.
- **`osm-787-canopy-smear` (osm:787)**: 4,726 pts, dense 20%, canopy-guard → 16.3. Apple ring overlay: corrugated shed physically overhung by grove crowns. `OSM_WITHHELD`. Ring sits under Revelle 12KV GIS coverage so it does not extrude as OSM — withholding keeps the gate from admitting crown.

### Rejected candidates (each re-measured; do not re-find these)

- **`evening-gilman-4.5-underheight-class` (multiplane subset)** — REJECTED for paste. 609 / 585 / 610 / 607 / 616: spr 4.3–5.0, dense 0.56–0.67; unguarded roofOf 11–12 pastes an upper/canopy shelf over a 5–7 m body. Soft near-strict trio above absorbed the only rings whose plane cleared imagery. Guess 4.5 stands on the multiplanes.
- **`osm-609-underheight`** — REJECTED as exemplar of the multiplane subset above. Do not paste 12.3.
- **`villa-mallorca-residual` (634 / 666)** — REJECTED for paste. Dense body ~8–9 m matches the villa-east strip, but roofOf 13.5 / 11.3 rides a sparse shelf (dense under the 85% thin-shelf cut). Admitting via `OSM_UNNAMED_VERIFIED` would paste the shelf; no hand override that reverses the shared rule. Guess 4.5 stands until a parts split. (665 admitted separately as near-gate.)
- **`caminito-abrazo-underheight`** — REJECTED. Multimodal low-dense (0.32–0.53); imagery cannot pick one plane. Guess stands.
- **`osm-92-holiday-court`** — REJECTED. Area guess 8.4 already tracks dense body (p75 8.9); roofOf 13.4 is shelf triage, not underheight.
- **`osm-678-underheight`** — REJECTED. Guess 9 tracks dense body (p75 10.3); same shelf-triage class.
- **`osm-1245-multiplane`** — REJECTED. Trimodal dense 29%; no plane. Guess stands.
- **`rita-roof-anchor`** — REJECTED as height bug. Fresh roofOf = shipped massHeights 26.8. Grade span 3.6 m / roof-anchor Δ is terrain geometry handoff, not a height miss.
- **`crs-grade-span`** — REJECTED as height bug. Fresh roofOf = shipped 17.5. Grade span 4.6 m on GIS ring is prior handoff. Satellite Utility Plant next door stays POST_2014 (do not replace GIS 12.8 with 2014 plane 4.2).
- **UC Cyclery** — not a screen candidate but re-checked as Union Bank sibling: gap 1.5 under the cut; roofOf 6.8 stands.

### Handoffs / observations

- **Union Bank class**: third thin-shelf override reversal today (after CSC D/CES). Prior "near-miss under 85%" claims need rimBase re-derivation before an override that keeps p98 is believed — Apple plant is not evidence against the body.
- **634 / 666**: highest-value residual in-box — dense body matches measured neighbours, but unguarded roofOf pastes. A future parts split or a declared dense-body override (with Apple short-shadow evidence) could retire the 4.5 underheight without inventing the shelf.
- **Gilman multiplane 609-family**: same 280 stepped-roof class campus-wide; imagery shows 2-storey gabled apartments under some canopy — Marshall lesson applies (photograph fixes identity, not a height to ship from nadir + contaminated cloud).
- **Rita / CRS grade spans**: per-vertex draping eye-level check remains a terrain handoff, not this pass's height work.

### Verification

See final message for `npm test` / `npm run check` paste.
