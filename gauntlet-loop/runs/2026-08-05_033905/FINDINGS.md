# FINDINGS — run `2026-08-05_033905` · shard r0c0 (re-sweep)

Pass 1 re-sweep of the NW campus shard (Estancia / Sanford / Marshall Residence / coastal
fringe). Screen: 9 candidates (4 high / 5 medium). Judged by `cursor-grok-4.5-high`.

Every candidate in `pass1-r0c0.screen.json` was re-derived before judgement with a full-depth
targeted EPT re-sample (13 targets; counts matched the screener's exactly — its probe was
already full-depth), Apple snapshots for every site, and the shipped data. Probe artifacts in
`.cache/gauntlet-r0c0b/judge/` (miniprobe.out, miniprobe.json) and evidence shots copied from
the screener's `/tmp/gauntlet-r0c0/apple/`.

### Fixed — heights (every value from this pass's full-depth re-sample or the build's own tiling)

| Entity | Was shipping | Now ships | Source | Test |
|---|---|---|---|---|
| Estancia-adjacent pad (`osm-331-overheight`, osm:331) | 12 m area guess | **5.3 m** | OSM_UNNAMED_VERIFIED: 11,034 returns, 79% in a 4–5 m band, guarded roofOf 5.3; standing on today's Apple | epoch §18 |
| Sanford-lawn service cluster (`osm-149-overheight`, osm:149) | 12 m area guess | **5.6 m** | OSM_UNNAMED_VERIFIED: 2,973 returns, 90% in a 4–5 m band | epoch §18 |
| Estancia amenity roof (`osm-974-overheight`, osm:974) | 9 m area guess | **3.7 m** | OSM_UNNAMED_VERIFIED: 5,368 returns, 65% in the 3 m bin, guarded (targeted 3.8, build tiling 3.7) | epoch §18 |
| Coastal graded structure (`osm-1372-overheight`, osm:1372) | 12 m area guess | **7.3 m** | OSM_UNNAMED_VERIFIED: 6,791 returns, 73% in a 3–6 m band on grade | epoch §18 |
| ERC-west low pad (`osm-878-overheight`, osm:878) | 9 m area guess | **5.9 m** | OSM_UNNAMED_VERIFIED: 2,048 returns, 97% in the 5 m bin | epoch §18 |
| Coastal-fringe structure (from `unnamed-guess-class-hole`, osm:483) | 12 m area guess | **8.3 m** | OSM_UNNAMED_VERIFIED: 2,771 returns, body tight | epoch §18 |
| Marshall Residence Hall V (`marshall-res-v-unchallenged`) | 9.1 m GIS L3 | **6.8 m** | PRE_2014_GIS_VERIFIED: 3,317 returns, mode 6 m at 74%, guarded p75 6.8; 1960s Marshall housing, standing on today's Apple | epoch §18 |

### Withheld (better absent than wrong)

- **`osm-513-overheight` (osm:513)**: Apple shows a finished low pad in the coastal-scrub fringe
  west of North Torrey Pines Rd, but the 2014 returns mix near-ground / deck (p50 0.2, hist
  peaks at 0 m:1540 and 3 m:1070; bodyTight=false). No clean body plane to admit; the 9 m guess
  stands. Pinned as EXCLUDED from osmHeights.

### Rejected candidates (each re-measured before rejection; do not re-find these)

- **`sanford-mechanical-overheight`** — REJECTED: dense deck ~19.8 and mechanical well 22–24 m
  are both real (Apple shows the deep central plant on the finished white lab bar). Prior §9
  already pinned pavilion 6.2 / lab bar 24.5. Without a parts-level split of the well from the
  deck, trading 24.5 for the deck pastes the other way across the whole footprint. The standing
  roofOf answer (p98, guard threshold 5 m, gap is 4.7) stands. Re-pinned in §18 so a future
  pass cannot silently "fix" it.
- **`unnamed-guess-class-hole`** — REJECTED as scoped, same verdict as prior shards: the
  mechanism exists and this pass used it for six admissions and one explicit refusal; admitting
  all 81 in-shard unnamed guesses needs a per-ring Apple currency check each, which stays a
  batch job. Named landmarks in-box (ERC halls, Village West #4–6, Salk wings, Estancia, Middle
  Earth, Marshall Lower Q/R/S) already track measured planes after assembleMasses.
- **Marshall Residence Hall U / T** — not screen candidates as primary claims, but probed as
  siblings of V: U is stepped (bodyTight=false, p50 6.1 / p75 9.2) and stays with its 9.1
  record; T already ships 6.1 matching its dense 6 m band — admitting it to
  PRE_2014_GIS_VERIFIED would replace that with roofOf's unguarded p98 of 10.3. Leave both.

### Handoffs / observations for later shards / passes

- **Sanford parts**: a separate GIS (or OSM) ring for the central mechanical well would let the
  deck ship ~19.9 and the plant ship ~24.5 honestly. Hand off to a mapping pass, not a height
  pass — same class as Hyatt / helipad / Temple.
- **Remaining unnamed guesses in-box**: ~75 still ship area guesses after this pass's six
  admissions. Batch Apple+EPT verification remains the right shape; do not blanket-admit.
- **Extended Studies H/J/K/M/N** in this shard: screener noted they lack massHeights. Spot
  check — Ext H/K/M read clean ~3.4–3.6 planes vs 4.3 records (Δ≤0.9, noise line); Ext J/N are
  canopy-stepped. Not height bugs at the Δ≥3 bar this pass used; leave for a quieter pass if
  needed.

---

# FINDINGS — run `2026-08-05_033905` · shard r0c1 (re-sweep)

Pass 1 re-sweep of the North campus shard (Warren / Rady / Marshall Upper / Spanos / Asante).
Screen: 7 candidates (1 high / 4 medium / 2 low). Judged by `cursor-grok-4.5-high`.

Every candidate in `pass1-r0c1.screen.json` was re-derived before judgement with an independent
full-depth targeted EPT re-sample (13 targets in `.cache/gauntlet-r0c1b/judge/reprobe.*`; point
counts matched the screener's `/tmp/gauntlet-r0c1/probe.out` exactly), Apple snapshots from the
screener's `/tmp/gauntlet-r0c1/apple/`, and a non-LiDAR source check for the Spanos APC claim.

### Fixed — heights (class rule, not a one-row patch)

| Entity | Was shipping | Now ships | Source | Test |
|---|---|---|---|---|
| Asante House Meeting Rooms (`asante-meet-overheight`) | 7.1 m massHeights p98 | **4.0 m** | Thin-shelf massHeights rule in `build-campus-lidar.mjs`: body tight + (p98−p75) > 2.5 + dense 2 m band ≥ 85% → p75. Re-sample: 1,854 pts, 88% in 3–4 m, p50=p75=4.0, p98=7.1 (43 pts in the 7 m bin). GIS L1=4.3. Apple: finished low pad among Asante / Great Hall today. | epoch §19 |

The same rule would take Marshall Upper H/L to their dense 6.1 bodies if a future pass ever
auto-admitted their canopy p98 (10.3 / 10.2) — those masses do not ship massHeights today; the
test pins the rendered GIS bodies so the next agent cannot paste the tree.

### Rejected candidates (each re-measured before rejection; do not re-find these)

- **`spanos-apc-gis-l1-vs-finished`** — REJECTED. Screen claimed Apple shows a multi-storey
  finished building needing `ESTIMATED_POST_2014`. Independent check: Tilt-Up Concrete
  Association project profile #6097 lists **Number of Floors: 1**, footprint 6,740 sq ft,
  tallest panel 24 ft 6 in (7.47 m) — a high-bay one-storey tilt-up opened Oct 2015. The
  11–16 m 2014 smear over the APC ring remains the eucalyptus cleared for it (prior r1c0 /
  README / epoch §12). `HAND_AUDITED` 4.4 and the massHeights bar stand. Do not re-admit
  roofOf=16.
- **`copley-dense-body-vs-roofof`** — REJECTED. Dense band 79% in 5–7 m (under the 85%
  thin-shelf cut); upper shelf is a real stepped conference volume, Sanford-class. Ships
  roofOf 10.6. GIS L1=4.3 understates both planes; pasting the dense body would flatten the
  high volume the other way.
- **`otterson-dense-deck-vs-roofof`** — REJECTED. Dense deck ~15.7 with ~21% of returns on a
  17–18 m plant/solar shelf (Apple shows solar on the SE roof). Dense band 74% — under the
  cut. Ships roofOf 18.9. Same Sanford mechanical verdict.
- **`roof-anchor-class`** — REJECTED as in-scope fix; RE-LOGGED as handoff. Grade audit still
  finds exactly four in-shard masses past 2 m (Hopkins Parking +3.17, Canyon Vista admin
  +2.93, Cuzco −2.55, VE4 −2.34). Bases per-vertex safe. Renderer change
  (`roofY = rimMedian + h`) is cross-shard and belongs to a dedicated pass — prior r0c1 /
  r0c2 FINDINGS unchanged.
- **`marshall-upper-hl-canopy-guard`** — REJECTED as a current height bug (bodies already
  ship GIS 6.1). Documented and pinned in §19 so a future `PRE_2014_GIS_VERIFIED` admission
  cannot silently take roofOf's unguarded p98. Prior r0c1 FINDINGS already said this.
- **`stewart-multimodal-step`** — REJECTED. Multi-modal hist (9 / 12 / 15 m peaks),
  bodyTight=false — a stepped Warren residence on grade, same pattern as Bates/Brown/Harlan.
  roofOf at the high wing is the measurable answer; no single plane to prefer.

### Withheld (better absent than wrong)

None this pass. The one fix had a clean dense body; every other candidate either already
ships the right answer or is a real upper volume / date / renderer-class question.

### Handoffs / observations

- **Roof-anchor class** (Hopkins Parking, Canyon Vista admin, Cuzco, VE4, plus r0c2's
  osm:502/−2.7 and osm:509/+1.9): still open for a cross-shard renderer pass.
- **Asante Hall rename**: the Meeting Rooms / West / East GIS masses all render under the
  OSM host name "Asante Hall". West/East are the residential wings; Meeting Rooms is a
  distinct university building whose centroid falls in the same outline. Height is fixed;
  identity is OSM-name-authority behaviour (same shape as other complex outlines), not a
  Spanos-style theft of a name another mass already wears. Leave unless Sahir wants the
  university meeting-rooms label kept.
- **Thin-shelf rule campus-wide**: next full `build:lidar` applies it to every mass. This
  pass spliced the one in-shard hit (`m:-85,-666`) after re-deriving it; Marshall H/L are
  protected by the test without shipping a plane today.
