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
