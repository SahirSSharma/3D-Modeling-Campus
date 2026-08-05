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

---

# FINDINGS — run `2026-08-05_033905` · shard r0c2 (re-sweep)

Pass 1 re-sweep of the east-campus shard (hospital district / CSC yard / Preuss /
Qualcomm AA). Screen: 9 candidates (0 high / 6 medium / 3 low). Judged by
`cursor-grok-4.5-high`.

Every candidate in `pass1-r0c2.screen.json` was re-derived before judgement against
the screener's full-depth EPT (`/tmp/gauntlet-r0c2/probe.json` — 29 targets; point
counts taken as the re-measurement for this pass), Apple snapshots in
`/tmp/gauntlet-r0c2/apple/`, and thin-shelf arithmetic re-computed per sample from
each mass's histogram (dense 2 m band + gap).

### Fixed — heights (class rule, not a one-row patch)

| Entity | Was shipping | Now ships | Source | Test |
|---|---|---|---|---|
| Campus Services Complex - Building H (`csc-h-thin-shelf`) | 7.0 m massHeights p98 | **4.8 m** | Thin-shelf massHeights rule: gap cut lowered from 2.5 → 2 (half a storey). Re-sample: 743 pts, dense 2 m band 91.8% in 4–5 m, p50=4.7 p75=4.8 p98=7.0 (34 pts in 7 m bin, gap 2.2). GIS L1=4.3. Apple: finished low CSC shop pad today. | epoch §20 |

The same rule still catches Asante (gap 3.1). In-shard neighbours stay off it:
Transit gap 0.9, Electric 0.8, CSC Shops 0.8, EMF GIS 1.2, Fleet south 1.8 — all
under the cut or under the dense floor.

### Rejected candidates (each re-measured before rejection; do not re-find these)

- **`anderson-835-post2014-guess`** — REJECTED as a height fix. Epoch §11 correctly
  bars any 2014 plane (23,030 pts, p50 0.8, staging/slab). Apple shows the finished
  pavilion today; no Street-View floor count or GIS mass resolves a finished height.
  OSM area guess 16 m stands — VA-garage keep-guess family. Do not admit roofOf=4
  or p98=10.4.
- **`prebys-n-772-post2014-guess`** — REJECTED same family. Epoch bars the bare-pad
  returns (35,168 pts, 64% in −1..1 m). OSM levels=5 → 19.2 stands without a
  measured non-LiDAR height. Do not admit roofOf=1.8.
- **`scripps-503-stepped-residual`** — REJECTED / already withheld. No single plane
  (p75 9.5 under towers at 32); roofOf would flatten worse than the documented
  20 m guess. Needs per-wing rings — mapping pass, not height.
- **`qaa-terrain-apron`** — REJECTED as in-scope height bug; RE-LOGGED as handoff.
  Height 24.3 is correct (HAND_AUDITED). 27/34 footprint vertices sit south of
  terrain `z0=−1383` and clamp to the apron — survey-box coverage, same AREA-edge
  family as the original QAA miss. Expanding the terrain grid is a rebuild call.
- **`roof-anchor-502`** — REJECTED as in-scope fix; RE-LOGGED as handoff. Grade
  audit still finds osm:502 at Δ=−2.7 (centroid ground 101.7 vs rim-median 104.4).
  Bases per-vertex safe. Renderer change (`roofY = rimMedian + h`) is cross-shard
  — prior r0c1 / r0c2 FINDINGS unchanged.
- **`osm-508-post2014-canopy`** — REJECTED. Epoch bars the bare-ground plane
  (0.4 m); Apple shows a finished low canopy today. Keep the 4.5 m guess.
- **`preuss-pitch-absent`** — REJECTED / withheld. Apple shows painted lines; no
  registered fit was attempted. Better absent than wrong — same posture as prior
  r0c2 FINDINGS. Fitting needs a template + per-sample fit on registered imagery
  (Apple pixels barred without per-site registration).
- **`transit-p98-tail`** — REJECTED. Gap 0.9 over a 97.9%-dense 4 m body — under
  every thin-shelf cut. The +0.9 m p98 is noise; roofOf 5.2 stands. Pinned in §20
  so a future pass cannot silently "fix" it to GIS 4.3.

### Withheld (better absent than wrong)

None new this pass. The post-2014 hospital pads and the stepped Scripps ring
already withhold LiDAR; their guesses are the documented fallback, not an
invention of this pass.

### Handoffs / observations

- **Terrain apron at Qualcomm AA**: extend the terrain grid (or a local apron
  sample) past `z0=−1383` so per-vertex ground covers the full ring — height
  already correct.
- **Roof-anchor class**: osm:502 (−2.7) joins r0c1's four; still a dedicated
  renderer pass.
- **Thin-shelf rule campus-wide**: next full `build:lidar` applies gap > 2 to
  every mass. This pass spliced the one in-shard hit (`m:1092,-609`) after
  re-deriving it.
- **Scripps main / Anderson / Prebys north**: still need per-wing OSM rings or
  Street-View floor counts before any height can replace the guesses.

---

# FINDINGS — run `2026-08-05_033905` · shard r1c0 (re-sweep)

Pass 1 re-sweep of the Muir / La Jolla Farms / Geisel House west shard.
Screen: 10 candidates (3 high / 6 medium / 1 low). Judged by `cursor-grok-4.5-high`.

Every candidate in `pass1-r1c0.screen.json` was re-derived before judgement
against the screener's full-depth EPT (`/tmp/gauntlet-r1c0b/probe.json` — 66
targets; point counts taken as the re-measurement for this pass), Apple
snapshots in `/tmp/gauntlet-r1c0b/apple/`, and thin-shelf arithmetic
re-computed per sample from each ring's histogram (dense 2 m band + gap).

### Fixed — heights (class rule, not a one-row patch)

| Entity | Was shipping | Now ships | Source | Test |
|---|---|---|---|---|
| Tenaya Hall (`tenaya-hand-audited-vs-dense-wing`) | 27.6 m HAND_AUDITED | **22.4 m** | Removed from HAND_AUDITED — canopy guard already preferred p75 over the 9% HVAC shelf; GIS L7=21.3 agrees. Apple: flat H-plan + mechanical, not a taller wing. | epoch §21 |
| osm:903 (`osm-903-thin-shelf-withhold`) | 9 m area guess | **2.8 m** | Thin-shelf host rule (same cut as massHeights): 925 pts, dense 95% @2–3, gap 4.0 → p75. | epoch §21 |
| osm:1028 (`osm-1028-thin-shelf-withhold`) | 9 m area guess | **3.2 m** | Same rule: 3,002 pts, dense 86% @3–4, gap 3.8 → p75. | epoch §21 |
| osm:1094 (from `ljf-withhold-thin-shelf-class`) | 4.5 m area guess | **3.4 m** | Same rule: 470 pts, dense 87% @2–3, gap 4.2 → p75. | epoch §21 |
| osm:481 (`osm-481-pavilion-vs-withhold`) | 4.5 m guess (prior "no structure") | **6.2 m** | Apple shows the Geisel grounds pyramid pavilion; 542 pts, gap 0.5, roofOf 6.2. | epoch §21 |

Class change: `roofOf(roofs, base)` now applies the thin-shelf cut on the **host**
path too (not only massHeights). Admitting 903/1028/1094 under plain roofOf
would still have shipped crown p98 (6.8 / 7.0 / 7.6) — that was the hole.

### Rejected candidates (each re-measured before rejection; do not re-find these)

- **`osm-996-near-thin-shelf`** — REJECTED. Dense band 84% — 1 point under the
  85% cut. Same family as 903/1028, not admitted. Guess 9 m stands. Pinned in §21.
- **`tuol-s-north-shelf` / `tuol-s-east-shelf`** — REJECTED. Dense mid-deck under
  plant shelf, but dense band only 81% — Otterson / Copley family. Ships roofOf
  15.6 / 16.2. Do not paste the dense body the other way. Pinned in §21.
- **`osm-480-multiplane-guess`** — REJECTED / withheld. Multimodal hist on 7.3 m
  of grade; no single plane (Scripps / Hyatt class). Documented 12 m guess stays
  until parts exist.
- **`ljf-withhold-thin-shelf-class`** — REJECTED as a blanket admit. Exactly three
  of the 26 prior withholds clear the thin-shelf cut (903 / 1028 / 1094 — fixed
  above). The other 22 stay genuinely mixed/crowned; named Muir landmarks
  (Tioga / Keeling / HDH / Geisel) already track measured planes ≤0.2 m.
- **`muir-pickleball-still-absent`** — REJECTED as in-scope fix; RE-LOGGED as
  handoff. Apple shows the blue west pad today; no registered fit. Better absent
  than stale Google tennis paint — same posture as Preuss pitch / prior r1c0.

### Withheld (better absent than wrong)

- **osm:480**: no honest single plane across the multi-wing estate.
- **osm:996**: near-miss thin-shelf; cut stands at 85%.
- **Muir west pickleball**: painted on Apple, unfitted until Apple registration
  residual passes the 0.6 m gate.

### Handoffs / observations

- **Muir west pickleball**: needs a template + per-sample fit on registered
  imagery (Apple pixels barred without per-site registration). Do not restore
  `muir-tennis-west` from Google chunks.
- **Thin-shelf on hosts**: next full `build:lidar` applies the shared
  `roofOf(roofs, base)` cut to every verified unnamed host. This pass spliced
  the three in-shard hits after re-deriving them.
- **Remaining LJF withholds** (~22): still need per-ring Apple + EPT; do not
  blanket-admit from roofOf.

---

# FINDINGS — run `2026-08-05_033905` · shard r1c1 (re-sweep)

Pass 1 re-sweep of the academic-core shard (Warren Mall / VA fringe / Central
Utilities / Mayer / Epstein). Screen: 19 candidates (3 high / 15 medium / 1 low).
Judged by `cursor-grok-4.5-high`.

Every candidate in `pass1-r1c1.screen.json` was re-derived before judgement
against the screener's full-depth EPT (`/tmp/gauntlet-r1c1b/probe.json` — 81
targets; point counts taken as the re-measurement for this pass), Apple
snapshots in `/tmp/gauntlet-r1c1b/apple/`, and thin-shelf arithmetic
re-computed per sample from each mass's histogram (dense 2 m band + gap).

### Fixed — heights / phantoms (class rule, not a one-row patch)

| Entity | Was shipping | Now ships | Source | Test |
|---|---|---|---|---|
| osm:759 (`osm-759-razed-pad`) | 4.5 m area guess | **removed** | `skipOsmAnchors` (+ Campus Point / osm:56 / 1351 class). Apple: bare dirt + staging trailers; 2014 plane 6–7 m is gone. | epoch §22 |
| osm:840 + 898 (`osm-840-epstein-fringe` / `osm-898-epstein-neighbor`) | 9 / 4.5 m guesses | **removed** | Same anchors: Epstein POST_2014 amphitheater / PCW plaza fringe; 840 massOk=false grove/scatter. | epoch §22 |
| osm:917 + 918 (`osm-917-mayer-hex-connector`) | 8.4 / 4.8 m solid | **removed** | Elevated six-hex walkway; solid extrusion fills air under the deck. Better absent. | epoch §22 |
| osm:225 / 226 (`osm-225-cooling-bay` / `osm-226-cooling-bay`) | 9 / 4.5 m guesses | **8.1 / 8.4 m** | `OSM_UNNAMED_VERIFIED`: 3,208 / 1,193 pts, one plane each (gap 1.4 / 1.5), Apple fan enclosures standing today. Sibling of TES tank 224. | epoch §22 |

### Rejected candidates (each re-measured before rejection; do not re-find these)

- **`mcgill-thin-shelf` / `literature-thin-shelf` / `medteach-a-near-shelf`** — REJECTED.
  Dense bands 82.2% / 84.4% / 83.4% — under the 85% cut (osm:996 family). roofOf
  shelves (25.1 / 19.2 / 19.7) stand. Do not lower the cut.
- **`pacific-deck-vs-roofof` / `natsci-upper-shelf` / `brf2-stepped-vs-gis`** — REJECTED.
  Dense 68.7% / 66% / 54.6% — real stepped science volumes (Sanford / Otterson).
  Pasting the dense body flattens the other way. BRF II needs a parts split
  (mapping pass), not a height paste.
- **`gilman-garage-gis-vs-decks`** — REJECTED. massHeights 18 already tracks the
  measured top deck; GIS L6=25.6 is the overstatement. Already correct.
- **`south-park-host-of-ineligible`** — REJECTED. massOk=false withholds
  massHeights by design; host 19.2 answers (Urey / Jacobs rule). Deck stack has
  no single plane to prefer.
- **`faculty-club-host-vs-dense`** — REJECTED. HAND_AUDITED 6.5 is the gable
  ridge (p90); dense eave / guarded roofOf 4.9 would miss it. Opposite of Solis.
- **`tata-courtyard-unchallenged`** — REJECTED. Tata is `POST_2014_SITES`;
  courtyard-contaminated 2014 returns must never challenge GIS 25.6.
- **`osm-1352-triton-edge`** — REJECTED as a height admit. massOk=false on the
  Strauss fringe; keep the 9 m guess (VA-garage family). Do not ship a 2014 smear.
- **`osm-827-trolley-adjacent`** — REJECTED. 109 m² ring, bodyTight=false;
  Mid-Coast trolley opened 2021. Keep the 4.5 m guess.
- **`vaf3-position-double`** — REJECTED as in-scope fix; RE-LOGGED as handoff.
  GIS (660.9,−83.9) and OSM (679.3,−86.1) still both render — coverage 0 between
  footprints. Prior §13 / r1c1 FINDINGS: neither vanishes until a source
  resolves which footprint is Building 3.

### Withheld (better absent than wrong)

- **osm:759 / 840 / 898 / 917 / 918**: removed from the world (skip anchors), not
  given a height — Apple currency or typology forbids shipping either the 2014
  plane or the area guess.
- **osm:1352 / 827**: guesses stand; no clean measured plane that survives the
  epoch / bodyTight gates.

### Handoffs / observations

- **VAF-3 position**: still open — university numbering vs OSM, zero footprint
  overlap. Needs a source (Sahir / facilities map), not a coverage-threshold tweak.
- **BRF II / Pacific / NatSci parts**: stepped labs where a single massHeights
  value rides the upper shelf; per-wing rings would let both planes ship honestly.
- **Thin-shelf cut**: campus-wide rule stays at dense ≥85% / gap >2. Three
  in-shard near-misses (McGill / Literature / MedTeach-A) stay pinned so a
  future pass cannot silently lower the floor.
