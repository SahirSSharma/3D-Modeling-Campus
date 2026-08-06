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
