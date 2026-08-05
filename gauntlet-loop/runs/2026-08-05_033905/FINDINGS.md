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

---

# FINDINGS — run `2026-08-05_033905` · shard r1c2 (re-sweep)

Pass 1 re-sweep of the health-campus / Pepper Canyon / One Miramar east shard.
Screen: 13 candidates (4 high / 6 medium / 3 low). Judged by `cursor-grok-4.5-high`.

Every candidate in `pass1-r1c2.screen.json` was re-derived before judgement
against the screener's full-depth EPT (`/tmp/gauntlet-r1c2b/probe.json` — 59
targets; point counts taken as the re-measurement for this pass), Apple
snapshots in `/tmp/gauntlet-r1c2b/apple/`, thin-shelf arithmetic re-computed
per sample, and OM3/OM4 area-coverage re-derived from the shipped rings
(0.851 / 0.855 under their GIS twins).

### Fixed — heights / phantoms / doubles (class rule, not a one-row patch)

| Entity | Was shipping | Now ships | Source | Test |
|---|---|---|---|---|
| One Miramar building 3 / 4 (`om3/om4-case-twin-double`) | OSM 13.1 **and** GIS 15.2 | **13.1 / 13.2 once each (GIS)** | Case-insensitive exact-name twin in `campus-massing.js` + the same twin path in `build-campus-lidar.mjs` so massHeights keys. Re-sample: 16,030 / 6,978 pts, roofOf 13.1 / 13.2. | epoch §23 |
| Outpatient Pavilion (`outpatient-koman-missing-post2014`) | 17.1 over 2014 empty lot | **17.1, POST_2014** | Opened 2018-03-12; 11,304 pts roofOf 0.8. Joins Altman / Athena. | epoch §23 |
| Piedra / Tierra (`piedra-` / `tierra-nuevo-east`) | lidar.heights 19.4 / 17.8 | **36.6 / 15.2** | Nuevo East (HDH July 2020) added to `POST_2014_SITES`. Predecessor Mesa fabric barred; Piedra keeps fac.newer, Tierra takes facilities L5. | epoch §23 |
| Hamilton (`hamilton-thin-shelf`) | 12.7 massHeights p98 | **9.4** | Thin-shelf rule (already in builder): dense 86.3% @9–10, gap 3.3 → p75. File was stale vs the rule. | epoch §23 |
| osm:776 / 766 (`osm-776-modular-plane` / `osm-766-va-pad`) | 4.5 / 4.5 guesses | **4.0 / 6.2** | `OSM_UNNAMED_VERIFIED`: clean one-storey planes, Apple standing. | epoch §23 |
| Foodworx Dining Room (`foodworx-dining-grade`) | 4.3 GIS L1 box | **removed** | `NO_SOLID_ROOF` in `build-campus-arcgis.mjs`: 93% at grade; Apple outdoor seating. | epoch §23 |

### Rejected candidates (each re-measured before rejection; do not re-find these)

- **`pc1200-dual-plane` / `pc1800-dual-plane`** — REJECTED. Dense bands 54.4% /
  54.2% — under the 85% cut. Real dual-plane residential (Sanford /
  Otterson). roofOf 14.7 / 14.2 stand. Pinned in §23.
- **`perlman-near-shelf`** — REJECTED. Dense 82.8% — under the cut (osm:996 /
  McGill family). roofOf 13.3 stands. Pinned in §23.
- **`pepper-canyon-courts-unmarked`** — REJECTED as in-scope fix; RE-LOGGED as
  handoff. Apple shows tennis + four blue pickleball courts north of
  Foodworx; no registered fit. Better absent than wrong — same posture as
  Muir west pickleball / Preuss pitch. Apple pixels barred without per-site
  registration residual ≤ 0.6 m.

### Withheld (better absent than wrong)

- **Foodworx Dining Room**: removed from massing (no solid roof), not given a
  height.
- **Pepper Canyon / Foodworx courts**: painted on Apple, unfitted until
  registration passes gate.

### Handoffs / observations

- **Pepper Canyon tennis + pickleball**: needs a template + per-sample fit on
  registered imagery (Apple pixels barred without per-site registration).
  Do not invent paint from an unregistered Apple snapshot.
- **Case-insensitive twin**: next full `build:lidar` applies the same twin
  path campus-wide. This pass spliced the two in-shard massHeights hits
  (OM3/OM4) after re-deriving them; OM1/OM2 already answered through
  containment.
- **Nuevo East complete**: Piedra + Tierra were the only OSM-named Nuevo
  East towers missing from `POST_2014_SITES` (Cala / Artesa already listed
  under Mesa Nueva).

---

# FINDINGS — run `2026-08-05_033905` · shard r2c0 (re-sweep)

Pass 1 re-sweep of the Scripps / La Jolla Shores shard (pier to Discovery Way /
Shores residential). Screen: 11 candidates (3 high / 8 medium). Judged by
`cursor-grok-4.5-high`.

Every candidate in `pass1-r2c0.screen.json` was re-derived before judgement with
an independent full-depth targeted EPT re-sample (10 targets in
`.cache/gauntlet-r2c0b/judge/reprobe.json`; point counts matched the screener's
`/tmp/gauntlet-r2c0b/probe.json` exactly — 3,113 / 2,192 / 2,873 / 1,169 /
1,155 / 3,521 / 599 / 1,191 / 775 / 883), Apple snapshots from the screener's
`/tmp/gauntlet-r2c0b/apple/`, and thin-shelf arithmetic re-computed per sample
from each mass's histogram (builder `denseBandFraction`).

### Fixed — heights (class admission, not a one-row patch)

| Entity | Was shipping | Now ships | Source | Test |
|---|---|---|---|---|
| osm:1039 (`osm-1039-overheight`) | 9 m area guess | **2.8** | `OSM_UNNAMED_VERIFIED`: 3,113 pts, guarded p75 2.8, bodyTight; Apple finished low pads | epoch §24 |
| osm:1079 (`osm-1079-overheight`) | 9 m area guess | **3.3** | `OSM_UNNAMED_VERIFIED`: 2,192 pts, guarded p75 3.3, bodyTight | epoch §24 |
| osm:1143 (`osm-1143-overheight`) | 9 m area guess | **5.1** | `OSM_UNNAMED_VERIFIED`: 2,873 pts, clean p98 5.1 (sibling of 1141 @ 5.3) | epoch §24 |
| osm:1055 (`osm-1055-overheight`) | 9 m area guess | **4.8** | `OSM_UNNAMED_VERIFIED`: 1,169 pts, guarded p75 4.8, bodyTight | epoch §24 |
| osm:1059 (`osm-1059-dense-body-vs-roofof`) | 9 m area guess | **3.8** | Thin-shelf host rule: dense 90.6% @3–4, gap 4.3 → p75. Unguarded roofOf would paste 8.1. | epoch §24 |

### Withheld (better absent than wrong)

- **osm:1075 (`osm-1075-canopy-smear`)**: bodyTight=false (p50 3.2 / p75 10.4 /
  p98 14.3). Same eucalyptus paste class as documented 1068. Keep the 9 m guess.
- **osm:825 (`osm-825-canopy-or-structure`)**: 599 pts under Geodesic Dome
  corridor crowns, bodyTight=false. Keep the 4.5 m guess.

### Rejected candidates (each re-measured before rejection; do not re-find these)

- **`igpp2000-upper-shelf`** — REJECTED. Dense 84.9% under the 85% thin-shelf
  cut (Perlman / McGill near-miss). Apple shows mechanical plant / solar on the
  finished IGPP 2000 roof; pasting the dense 7.4 deck flattens a real upper
  volume. massHeights 11.3 stands. Pinned in §24.
- **`coast-apts-canopy-adjacent`** — REJECTED as an immediate height bug.
  Hostless L2=6.1 already matches the dense ~5.6 body (9321 clean roofOf 5.8);
  canopy neighbours (9369 / 9383, roofOf 17) stay massOk=false so massHeights
  never emits. Class hole noted: a future roofOf auto-admit on hostless GIS
  would paste eucalyptus — the massOk=false gate is the guard. Pinned.
- **`unnamed-guess-class-hole`** — REJECTED as scoped. The mechanism exists and
  this pass used it for five admissions and two explicit withholds; remaining
  in-shard unnamed guesses need per-ring Apple + EPT, not a blanket admit.
- **`noaa-outline-core-overlap`** — REJECTED as a height bug. Prior r2c0 judge
  already fixed the paste via `MEASURE_MINUS_CONTAINED_HOSTS` (wings 13.5 +
  core 13.8). Dual render is intentional: OSM has the lab wings GIS does not.
  The ~0.3 m z-fight where the solid outline fills the core is a geometry
  handoff (OSM hole), not a height error. Both prisms re-pinned in §24.

### Handoffs / observations for later shards / passes

- **NOAA OSM outline hole**: adding a courtyard/core hole matching the GIS
  centre block would remove the residual overlap without losing the wings.
  Mapping pass, not a height pass.
- **Remaining unnamed guesses in-box**: still ~110+ after this pass's five
  admissions. Batch Apple+EPT verification remains the right shape; do not
  blanket-admit.
- **IGPP 2000 near-miss**: dense 84.9% — 0.1 pp under the cut. Do not lower
  the floor; a parts split for the plant shelf would let both planes ship.

---

# FINDINGS — run `2026-08-05_033905` · shard r2c1 (re-sweep)

Pass 1 re-sweep of the theatre-district / Village Square / Villa La Jolla shard.
Screen: 9 candidates (3 high / 5 medium / 1 low). Judged by `cursor-grok-4.5-high`.

Every candidate in `pass1-r2c1.screen.json` was re-derived before judgement with an
independent full-depth targeted EPT re-sample (8 targets in
`.cache/gauntlet-r2c1b/judge/reprobe.json`; point counts matched the screener's
`/tmp/gauntlet-r2c1b/probe.json` exactly — 588 / 726 / 1,373 / 1,757 / 1,362 /
2,134 / 391 / 583), Apple snapshots from the screener's `/tmp/gauntlet-r2c1b/apple/`,
and thin-shelf arithmetic re-computed per sample from each mass's histogram
(builder `denseBandFraction`).

### Fixed — heights (class admission, not a one-row patch)

| Entity | Was shipping | Now ships | Source | Test |
|---|---|---|---|---|
| osm:103 (`osm-103-underheight`) | 4.8 m OSM under-tag | **8.2** | `OSM_UNNAMED_VERIFIED`: 1,757 pts, clean p98 8.2, bodyTight; sibling of 333 @ 8.2; Apple finished Village Square white roofs | epoch §25 |
| osm:334 (`osm-334-underheight`) | 4.8 m OSM under-tag | **7.7** | `OSM_UNNAMED_VERIFIED`: 1,362 pts, clean p98 7.7; sibling of 335 @ 7.7 | epoch §25 |
| osm:129 (`osm-129-underheight`) | 9 m area guess | **11.3** | `OSM_UNNAMED_VERIFIED`: 2,134 pts, clean single plane (p50 11.0 / p75 11.1 / p98 11.3) | epoch §25 |

### Withheld (better absent than wrong)

- **osm:708 (`osm-708-underheight`)**: multimodal hist (dense only 29.7% in the
  5 m bin, bins spread 0–7). Apple shows finished commercial fabric north of the
  teal-arch strip, but the 2014 sample has no clean body plane to admit. Keep the
  4.8 m guess. Pinned as EXCLUDED from osmHeights.

### Rejected candidates (each re-measured before rejection; do not re-find these)

- **`osm-707-underheight`** — REJECTED. Dense body 5.2 ≈ the 4.8 area guess
  (Δ 0.4); roofOf 6.7 is a modest HVAC shelf (gap 1.5 under the 2 m thin-shelf
  cut). Not an underheight miss. Guess stands; pinned in §25.
- **`union-bank-thin-shelf`** — REJECTED. Dense 79.9% under the 85% thin-shelf
  cut (IGPP / Perlman near-miss family), gap 2.7. Apple shows HVAC on the
  finished Villa La Jolla strip roof; pasting the dense 5.3 body would flatten a
  real plant shelf. heights['Union Bank']=8 stands. Pinned in §25.
- **`uc-cyclery-thin-shelf`** — REJECTED. Gap 1.5 under the 2 m thin-shelf cut
  entirely; dense body 5.2 under roofOf 6.8 is plant noise on the same strip,
  not a thin shelf. heights['UC Cyclery']=6.8 stands. Pinned in §25.
- **`james-place-interior-forum`** — REJECTED as a height bug. James ships
  massHeights 5.1; Forum ships host 10.5 — both correct. Residual is the OSM
  Forum ring still containing James' Place (84% of interior samples) — a
  mapping / outline handoff, same class as NOAA's missing courtyard hole.
  Prior r2c1 pass already fixed the rename-into-rendering guard. Both planes
  re-pinned in §25.
- **`unnamed-guess-class-hole`** — REJECTED as scoped, same verdict as every
  other shard: the mechanism exists and this pass used it for three admissions
  and one explicit withhold; remaining in-shard unnamed guesses need per-ring
  Apple + EPT, not a blanket admit.

### Handoffs / observations for later shards / passes

- **James' Place / Mandell Weiss Forum OSM split**: adding a hole (or a
  separate way) for the cafe footprint inside the Forum ring would remove the
  coincident extrusion without losing either plane. Mapping pass, not a height
  pass — prior r2c1 FINDINGS already said this.
- **Remaining unnamed guesses in-box**: ~360+ after this pass's three
  admissions. Batch Apple+EPT verification remains the right shape; do not
  blanket-admit.
- **Union Bank near-miss**: dense 79.9% — 5.1 pp under the cut. Do not lower
  the floor; a parts split for the HVAC shelf would let both planes ship.

---

# FINDINGS — run `2026-08-05_033905` · shard r2c2 (re-sweep)

Pass 1 re-sweep of the east-of-I-5 / Sheraton-strip / Temple-corridor /
Aventine-south shard. Screen: 16 candidates (6 high / 9 medium / 1 low).
Judged by `cursor-grok-4.5-high`.

Every candidate in `pass1-r2c2.screen.json` was re-derived before judgement with
an independent full-depth targeted EPT re-sample (18 targets in
`.cache/gauntlet-r2c2b/judge/reprobe.json`; point counts matched the screener's
`/tmp/gauntlet-r2c2b/probe.json` exactly — 4,425 / 5,485 / 7,470 / 6,304 /
5,801 / 5,120 / 24,983 / 21,686 / …), Apple snapshots from the screener's
`/tmp/gauntlet-r2c2b/apple/`, and thin-shelf arithmetic re-computed per sample
from each mass's histogram (builder `denseBandFraction` + gap vs p75).

### Fixed — heights (class admission, not a one-row patch)

| Entity | Was shipping | Now ships | Source | Test |
|---|---|---|---|---|
| osm:1366 (`osm-1366-thin-shelf`) | 9 m area guess | **5.2** | Thin-shelf host rule: dense 91.9% @5–6, gap 4.6 → p75. Unguarded roofOf would paste 9.8. | epoch §26 |
| osm:1365 (`osm-1365-overheight`) | 9 m area guess | **5.1** | `OSM_UNNAMED_VERIFIED`: 5,485 pts, guarded p75 5.1, bodyTight | epoch §26 |
| osm:285 (`osm-285-dense-body-overheight`) | 12 m area guess | **8.4** | Thin-shelf host rule: dense 87.3%, gap 2.1 → p75 | epoch §26 |
| osm:81 (`osm-81-underheight`) | 4.8 m OSM under-tag | **7.7** | `OSM_UNNAMED_VERIFIED`: 6,304 pts, clean p98 7.7; Village Square sibling | epoch §26 |
| osm:287 (`osm-287-overheight`) | 12 m area guess | **8.4** | `OSM_UNNAMED_VERIFIED`: 5,801 pts, guarded p75 8.4 | epoch §26 |
| osm:286 (`osm-286-near-shelf-overheight`) | 12 m area guess | **10.1** | `OSM_UNNAMED_VERIFIED`: 5,120 pts, clean p98 10.1 (gap 1.6 under thin-shelf cut — plant noise) | epoch §26 |
| osm:1356 (`osm-1356-overheight`) | 16 m area guess | **13.2** | `OSM_UNNAMED_VERIFIED`: 24,983 pts, clean p98 13.2 | epoch §26 |
| osm:1355 (`osm-1355-overheight`) | 16 m area guess | **13.8** | `OSM_UNNAMED_VERIFIED`: 21,686 pts, clean p98 13.8 | epoch §26 |

### Withheld (better absent than wrong)

- **osm:704 / 705 (`osm-704-underheight` / `osm-705-underheight`)**: stepped
  mid-rises (dense 2 m band 46.9% / 44.1%, hist spread across 11–15 m). Apple
  shows finished multi-storey fabric, but the 2014 sample has no single plane
  to admit. Keep the 9 m guesses. Pinned as EXCLUDED from osmHeights.

### Rejected candidates (each re-measured before rejection; do not re-find these)

- **`osm-1364-thin-shelf-near-miss`** — REJECTED. Dense 78.7% under the 85%
  thin-shelf cut (gap 3.9). Sheraton-strip near-miss sibling of 1366; admitting
  roofOf would paste the 9.3 shelf. Guess 9 stands. Do not lower the cut.
  Pinned in §26.
- **`osm-257-258-underheight-pair`** — REJECTED. Dense body ≈ the 12 m guess
  (bins peak at 12 / 13); roofOf 16.1 / 17.5 rides an upper wing (osm:707
  family). Not underheight misses. Guesses stand; pinned in §26.
- **`medical-thin-shelf-near-miss`** — REJECTED. Dense 85.8%, gap 1.9 under the
  2 m thin-shelf cut (Union Bank / UC Cyclery family). Apple shows HVAC on the
  finished Aventine strip roof; pasting the dense 8.8 body would flatten a real
  plant shelf. heights['La Jolla Medical & Surgical Center']=10.7 stands.
  Pinned in §26.
- **`osm-83-helipad-tower-still-open`** — REJECTED / already withheld.
  bodyTight=false, massOk=false (dense 31 m wing vs tower 52–63). No parts
  source. Keep the 16 m guess. Re-pinned in §26.
- **`hyatt-podium-tower-still-open`** — REJECTED / already withheld.
  HAND_AUDITED null stands (bimodal 49% @4 m vs tower 41–52). Ships stated
  OSM tag 16. Re-pinned in §26.
- **`unnamed-guess-class-hole-remaining`** — REJECTED as scoped, same verdict
  as every other shard: the mechanism exists and this pass used it for eight
  admissions and two explicit withholds; remaining in-shard unnamed guesses
  need per-ring Apple + EPT, not a blanket admit.

### Handoffs / observations for later shards / passes

- **Hyatt / osm:83 parts**: both still need an OSM (or GIS) parts-level source
  before either plane can ship honestly — mapping pass, not a height pass.
  Prior r2c2 FINDINGS already said this.
- **osm:1364 near-miss**: dense 78.7% — 6.3 pp under the cut. Do not lower
  the floor; a parts split for the HVAC shelf would let the dense body ship.
- **Remaining unnamed guesses in-box**: ~100+ after this pass's eight
  admissions. Batch Apple+EPT verification remains the right shape; do not
  blanket-admit.
- **osm:497 / 289**: prior stepped / canopy withholds re-confirmed
  (bodyTight=false); not re-opened this pass.

---

# FINDINGS — run `2026-08-05_033905` · shard r0c0 (pass 2)

Pass 2 of the NW campus shard (Estancia / Sanford / Marshall Residence /
La Jolla Farms / coastal fringe). Screen: 10 candidates (4 high / 6 medium).
Judged by `cursor-grok-4.5-high`.

Every candidate in `pass2-r0c0.screen.json` was re-derived before judgement
with an independent full-depth targeted EPT re-sample (11 targets in
`.cache/gauntlet-r0c0-p2/judge/reprobe.*`; point counts matched the
screener's `/tmp/gauntlet-r0c0-pass2/probe.json` exactly — 1,881 / 1,705 /
1,521 / 1,333 / 2,100 / 1,715 / 2,321 / 5,990 / 1,477 / 1,609 / 4,022),
Apple snapshots from the screener's `/tmp/gauntlet-r0c0-pass2/apple/`
(copied to `.cache/gauntlet-r0c0-p2/evidence/`), and the shipped data.

### Fixed — heights (every value from this pass's full-depth re-sample)

| Entity | Was shipping | Now ships | Source | Test |
|---|---|---|---|---|
| Black Gold Rd house (`osm-976-overheight`, osm:976) | 9 m area guess | **4.6 m** | `OSM_UNNAMED_VERIFIED`: 1,881 pts, clean p98 4.6, bodyTight; Apple finished residential | epoch §27 |
| Estancia amenity (`osm-328-overheight`, osm:328) | 9 m area guess | **4.7 m** | `OSM_UNNAMED_VERIFIED`: 1,705 pts, canopy-guarded p75 4.7 (gap 5.0); Apple standing | epoch §27 |
| Estancia amenity (`osm-330-overheight`, osm:330) | 9 m area guess | **4.8 m** | `OSM_UNNAMED_VERIFIED`: 1,521 pts, canopy-guarded p75 4.8 (gap 7.5); sibling of 328/974 | epoch §27 |
| Black Gold Rd house (`osm-830-overheight`, osm:830) | 9 m area guess | **5.0 m** | `OSM_UNNAMED_VERIFIED`: 1,333 pts, clean p98 5.0, bodyTight | epoch §27 |
| Black Gold Rd building (`osm-871-overheight`, osm:871) | 9 m area guess | **6.1 m** | `OSM_UNNAMED_VERIFIED`: 2,100 pts, clean p98 6.1 (gap 0.3, dense 87%) | epoch §27 |
| Crown Crest Ln (`osm-972-overheight`, osm:972) | 9 m area guess | **6.1 m** | `OSM_UNNAMED_VERIFIED`: 1,715 pts, clean p98 6.1, bodyTight | epoch §27 |
| La Jolla Farms Rd (`osm-977-overheight`, osm:977) | 9 m area guess | **6.3 m** | `OSM_UNNAMED_VERIFIED`: 2,321 pts, clean p98 6.3, bodyTight | epoch §27 |
| La Jolla Farms Rd (`osm-493-overheight`, osm:493) | 9 m area guess | **6.3 m** | `OSM_UNNAMED_VERIFIED`: 5,990 pts, clean p98 6.3 (dense 84%, gap 2.0 under thin-shelf cut) | epoch §27 |
| LJF residual (`unnamed-guess-residual` sample, osm:969) | 9 m area guess | **6.3 m** | `OSM_UNNAMED_VERIFIED`: 1,609 pts, clean p98 6.3 (gap 0.4); same class as the mediums | epoch §27 |

### Withheld (better absent than wrong)

- **`osm-828-near-ground` (osm:828)**: 1,477 returns, p50 0.5 / hist mode 0 m
  (1,035/1,477), roofOf 1.7. Nominatim reverse → Salk Institute Road (service
  highway), no building address. Apple center darker/lower-entropy, consistent
  with pavement/scrub. Grade Δ centroid−rimMed = −3.1 m (roof-anchor class).
  Epoch-ambiguous — do not invent a 1.7 m building; the 4.5 m area guess
  stands. Pinned as EXCLUDED from osmHeights.
- **`osm:513`**: pass-1 coastal-scrub withhold re-confirmed (bodyTight=false;
  p50 0.2). Still undefined in osmHeights.

### Rejected candidates (each re-measured before rejection; do not re-find these)

- **`unnamed-guess-residual`** — REJECTED as scoped, same verdict as prior
  shards: the mechanism exists and this pass used it for nine admissions and
  one explicit refuse; admitting all ~64 remaining in-shard unnamed guesses
  needs a per-ring Apple currency check each. Named landmarks in-box (ERC
  halls, Village West #4–6, Salk wings, Estancia, Middle Earth, Marshall
  Lower Q/R/S, Marshall Res V) already track measured planes after
  assembleMasses.

### Handoffs / observations for later shards / passes

- **Remaining unnamed guesses in-box**: ~64 still ship area guesses after this
  pass's nine admissions. Batch Apple+EPT verification remains the right
  shape; do not blanket-admit.
- **Roof-anchor at osm:828** (grade Δ −3.1): same cross-shard renderer class
  already logged on other shards (Hopkins / Canyon Vista / Cuzco / VE4 /
  osm:502). Height withhold stands independently of the renderer fix.
- **Extended Studies H/J/K/M/N**: pass-1 handoff unchanged — Δ≤0.9 vs GIS
  records, under the Δ≥3 bar.

---

# FINDINGS — run `2026-08-05_033905` · shard r0c1 (pass 2)

Pass 2 of the North campus shard (Warren / Rady / Marshall / Village East /
RIMAC / ERC east). Screen: 5 candidates (0 high / 5 medium). Judged by
`cursor-grok-4.5-high`.

Every candidate in `pass2-r0c1.screen.json` was re-derived before judgement
against the screener's full-depth EPT (`/tmp/gauntlet-r0c1-pass2/probe.json` —
55 targets; point counts taken as the re-measurement: VE6 2,835 / LaundryE
1,278 / MarshResN 1,074 / Pangea 16,430), Apple snapshots in
`/tmp/gauntlet-r0c1-pass2/apple/` (copied to `.cache/gauntlet-r0c1-p2/evidence/`),
and thin-shelf arithmetic re-computed per sample from each mass's histogram.

### Fixed — heights (class rule already in builder; file was stale)

| Entity | Was shipping | Now ships | Source | Test |
|---|---|---|---|---|
| Seventh College East #6 (`ve6-thin-shelf`) | 10.7 m massHeights p98 | **8.4 m** | Thin-shelf massHeights rule (body tight + gap > 2 + dense ≥85% → p75). Re-sample: 2,835 pts, dense 88.1% in 8–9 m matching GIS L2=8.5; p98 10.7 rides the recessed central HVAC well Apple shows today (gap 2.3). | epoch §28 |

### Rejected candidates (each re-measured before rejection; do not re-find these)

- **`erc-laundry-e-near-ground`** — REJECTED as POST_2014. ERC opened 2003
  (Safdie; Guardian 2003-09-23); laundry was in the original program. The GIS
  ring's near-grade smear (roofOf 1.5, dense 79% in −1..0) is a measurement
  under-read, not a date. Host `lidar.heights` 2.6 is within 0.4 m of GIS
  L1=3. Do not admit roofOf=1.5 (below the 2 m floor), do not invent a height
  from Apple, and do not epoch-list a pre-2014 building. Pinned in §28.
- **`marsh-res-n-near-shelf`** — REJECTED. Dense 81.8% in 11–12 m — under the
  85% thin-shelf cut (Otterson / Copley / McGill / Perlman family). Apple shows
  finished Marshall residence roofs with mechanical vents; pasting the dense
  body flattens a real upper volume. massHeights 15.2 stands. Pinned in §28.
- **`pangea-open-deck-under`** — REJECTED. Open-deck multimodal (dense 60%,
  grade spread 12.6 m). roofOf 5.7 is what the laser resolves; GIS L2=8.5 and
  OSM 16 are not a single tight plane. Apple confirms the garage exists — not
  a height source. Do not invent. Pinned in §28.
- **`roof-anchor-class-expanded`** — REJECTED as in-scope fix; RE-LOGGED as
  handoff. Grade audit now finds seven in-shard masses past 2 m (prior four
  plus VW2 / Robinson Library / Otterson). Bases per-vertex safe. Renderer
  change (`roofY = rimMedian + h`) is cross-shard — prior FINDINGS unchanged.

### Withheld (better absent than wrong)

None new this pass. Pangea's open-deck under-read is already the measured
answer the laser can give; inventing GIS 8.5 from a photo would be the defect.

### Handoffs / observations

- **Roof-anchor class**: now seven in this shard (Hopkins Parking, Canyon Vista
  admin, Cuzco, VE4, VW2, Robinson Library, Otterson). Still a dedicated
  renderer pass.
- **Thin-shelf rule campus-wide**: next full `build:lidar` applies it to every
  mass. This pass spliced the one in-shard stale hit (`m:-78,-1060`) after
  re-deriving it; Asante / CSC H already matched.

---

# FINDINGS — run `2026-08-05_033905` · shard r0c2 (pass 2)

Pass 2 of the east-campus shard (hospital district / CSC yard / Preuss /
Qualcomm AA). Screen: 5 candidates (0 high / 4 medium / 1 low). Judged by
`cursor-grok-4.5-high`.

Every candidate in `pass2-r0c2.screen.json` was re-derived before judgement
against the screener's full-depth EPT (`/tmp/gauntlet-r0c2-pass2/probe.json` —
38 targets; point counts taken as the re-measurement: CSCC 2,025 / CSCD 2,004 /
XIMED 8,903 / QAA 30,780 / osm:502 17,637), Apple snapshots in
`/tmp/gauntlet-r0c2-pass2/apple/` (copied to `.cache/gauntlet-r0c2-p2/evidence/`),
and thin-shelf arithmetic re-computed per sample from each mass's histogram.

### Fixed — heights (class rule already in builder; file was stale)

| Entity | Was shipping | Now ships | Source | Test |
|---|---|---|---|---|
| Campus Services Complex - Building C (`csc-c-thin-shelf`) | 6.8 m massHeights p98 | **4.8 m** | Thin-shelf massHeights rule (body tight + gap > 2 + dense ≥85% → p75). Re-sample: 2,025 pts, dense 89.9% in 4–5 m matching GIS L1=4.3; p98 6.9 rides 98 pts in the 6 m bin (gap 2.1). | epoch §29 |

Sibling of Building H (pass-1 splice) and VE6 (pass-2 r0c1 splice) — same rule,
same stale-file root cause.

### Rejected candidates (each re-measured before rejection; do not re-find these)

- **`csc-d-near-shelf`** — REJECTED. Dense 92.1% in 4–5 m, bodyTight, but gap
  exactly 2.0 — under the >2 thin-shelf cut (Medical / Union Bank / UC Cyclery
  near-miss family). Do not retune the cut to ≥2 for one yard. roofOf 6.5
  stands. Pinned in §29.
- **`ximed-plant-shelf`** — REJECTED. Dense 68.0% in 37–38 m under a 41.3 p98
  (gap 3.9) — well under the 85% cut (Otterson / Copley / Sanford mechanical
  family). Apple shows rooftop HVAC on the finished multi-wing complex;
  pasting 37.4 would flatten a real upper volume. Host 41.3 stands. Pinned
  in §29.
- **`roof-anchor-502`** — REJECTED as in-scope fix; RE-LOGGED as handoff.
  Grade audit still finds osm:502 at Δ=−2.7 (centroid ground 101.7 vs
  rim-median 104.4). Bases per-vertex safe. Renderer change
  (`roofY = rimMedian + h`) is cross-shard — prior FINDINGS unchanged.
- **`qaa-terrain-apron`** — REJECTED as in-scope height bug; RE-LOGGED as
  handoff. Height 24.3 is correct (HAND_AUDITED; EPT reconfirm 30,780 pts).
  Grade audit: gCent=null (centroid south of z0=−1383), 27/34 verts clamp
  to the apron — survey-box coverage, same AREA-edge family. Expanding the
  terrain grid is a rebuild call.

### Withheld (better absent than wrong)

None new this pass. CSC D's near-miss residual is a measured plane under the
standing cut, not a gap to invent past.

### Handoffs / observations

- **Terrain apron at Qualcomm AA**: still needs the terrain grid (or a local
  apron sample) past `z0=−1383` so per-vertex ground covers the full ring —
  height already correct.
- **Roof-anchor class**: osm:502 (−2.7) still joins r0c1's list; dedicated
  renderer pass.
- **Thin-shelf rule campus-wide**: next full `build:lidar` applies it to every
  mass. This pass spliced the one in-shard stale hit (`m:1070,-561`) after
  re-deriving it; Asante / CSC H / VE6 already matched. CSC D (gap = 2.0)
  stays a near-miss under the cut — do not widen to ≥2.

---

# FINDINGS — run `2026-08-05_033905` · shard r1c0 (pass 2)

Pass 2 of the Muir / La Jolla Farms / Geisel House west shard.
Screen: 7 candidates (1 high / 4 medium / 2 low). Judged by `cursor-grok-4.5-high`.

Every candidate in `pass2-r1c0.screen.json` was re-derived before judgement
against the screener's full-depth EPT (`/tmp/gauntlet-r1c0-p2/probe.json` —
copied to `.cache/gauntlet-r1c0-p2/judge/`; point counts taken as the
re-measurement: osm:1013 2,359 / 1022 2,971 / 1023 2,142 / 322 1,136 /
982 198 / Tuol@-196,-34 281), Apple snapshots in
`/tmp/gauntlet-r1c0-p2/apple/` (copied to `.cache/gauntlet-r1c0-p2/evidence/`),
an independent grade audit of all in-box GIS masses, and thin-shelf
arithmetic re-computed per sample from each ring's histogram
(`.cache/gauntlet-r1c0-p2/judge/rejudge.json`).

### Fixed

None. Zero of the 21 residual LJF unnamed guesses clear the host thin-shelf
cut (dense ≥85% + gap >2 + bodyTight). Named Muir landmarks
(Tioga / Tenaya / Keeling N+W / HDH / Geisel House) already track their
shipped planes; Kaleidoscope / Tapestry correctly remain
`ESTIMATED_POST_2014`.

### Rejected candidates (each re-measured before rejection; do not re-find these)

- **`osm-1013-near-ground-apple-house`** — REJECTED as a height fix /
  WITHHELD. 2,359 pts, hist mode at grade (0 m:1,026 + (−1) m:497), thin
  2 m shelf, roofOf 4.3. Apple + Nominatim show a finished house at 9438
  La Jolla Farms Road today. Admitting roofOf would wear the 2014
  slab/near-grade as a finished height (inverted-eucalyptus class). No
  Street-View floor count resolves `ESTIMATED_POST_2014` for an unnamed
  ring; the 9 m area guess stands. Pinned in §30.
- **`osm-1022-underheight` / `osm-1023-underheight`** — REJECTED. Dense
  bodies ~6–7 m under 4.5 m guesses, but dense bands only 54% / 51% —
  under the 85% cut. Unguarded roofOf would ship crown p98 12.5 / 11.0
  (gap 4.8 / 3.9 under the 5 m canopy guard). Better the declared guess
  than a false crown paste. Pinned in §30.
- **`osm-322-overheight-body`** — REJECTED. Dense 76% in 2–3 m under a
  9 m guess — under 85%; admitting ships crown 6.9 not body ~3.6. Same
  §12 withhold family. Pinned in §30.
- **`osm-982-near-thin-shelf`** — REJECTED. Dense 83.3% (1.7 pts under
  85%), Δ guess−p75 only +1.3 m — not storey-class. Cut stands. Pinned
  in §30.
- **`tuol-m-196-roof-anchor`** — REJECTED as in-scope fix; RE-LOGGED as
  handoff. Independent grade audit: only in-box mass past 2 m is
  Tuolumne S House Laundry @ (−196,−34), Δ −2.9 m (gC 123.3 vs rimMed
  126.2, span 3.0). Height 15.8 tracks EPT roofOf. Bases per-vertex
  safe. Renderer change (`roofY = rimMedian + h`) is cross-shard —
  prior r0c1 / r0c2 FINDINGS unchanged. Pinned in §30.
- **`ljf-21-residual-guesses`** — REJECTED as a blanket admit. Exactly
  zero of 21 clear the thin-shelf cut (closest: 996 at 84.5%, 982 at
  83.3%, 1002 at 81.4%). Per-ring Apple+EPT only; §12 / §21 posture
  unchanged. Pinned in §30.

### Withheld (better absent than wrong)

- **osm:1013**: epoch-shaped near-grade under a standing Apple house —
  no honest non-LiDAR finished height without a floor count.
- **osm:1022 / 1023**: dense ~7 m body exists but auto-admit pastes
  crown; guesses stand until a single plane clears the cut.
- **The other 18 residual LJF rings**: crown / step mixes under every
  standing cut — same as pass-1.

### Handoffs / observations

- **Roof-anchor class**: Tuolumne S House Laundry (−2.9) joins Hopkins
  Parking / Canyon Vista admin / Cuzco / VE4 / osm:502 — still a
  dedicated renderer pass (`roofY = rimMedian + h`).
- **Muir west pickleball**: Apple shows the blue west pad today; still
  unfitted until Apple registration residual passes the 0.6 m gate
  (prior r1c0 handoff unchanged).
- **osm:1013 rebuild dating**: if Sahir or Street View ever resolves a
  floor count for 9438 La Jolla Farms Road, it becomes an
  `ESTIMATED_POST_2014` / `POST_2014_OSM_RINGS` candidate — not a
  roofOf admit of 4.3.

---

# FINDINGS — run `2026-08-05_033905` · shard r1c1 (pass 2)

Pass 2 of the academic-core shard (Warren Mall / VA fringe / PCWest / Mandeville).
Screen: 9 candidates (2 high / 6 medium / 1 low). Judged by `cursor-grok-4.5-high`.

Every candidate in `pass2-r1c1.screen.json` was re-derived before judgement against
the screener's full-depth EPT (`/tmp/gauntlet-r1c1-p2/probe.json` — copied to
`.cache/gauntlet-r1c1-p2/judge/`; point counts taken as the re-measurement:
gis:Rya67 1,452 / osm:438 14,113 / gis:Rya18 593 / gis:Mandeville 17,909 /
osm:441 695 / osm:1127 333 / gis:VAF3 2,060 / osm:VAF3 473 / osm:39 394), Apple
snapshots in `/tmp/gauntlet-r1c1-p2/apple/` (copied to
`.cache/gauntlet-r1c1-p2/evidence/`), an independent campus-wide nested-plaza
coverage scan of every same-name L1-under-taller pair in `campus-arcgis.json`,
and Nominatim reverse at the four unnamed amenity centroids.

### Fixed — phantoms (class rule, not a one-row patch)

| Entity | Was shipping | Now ships | Source | Test |
|---|---|---|---|---|
| PCWest L1=3 plaza pads ×7 (`pcw-rya-l1-tower-duplicate` / `pcw-l1-midrise-stacks`) | 3 m GIS L1 co-extruded with Rya 67.1 / midrise 12–18 m | **removed** | Nested-plaza rule in `build-campus-arcgis.mjs`: levels=1 + coverage ≥0.85 under taller same-name sibling. Campus-wide scan: only PCWest. UC Regents / SDBJ: Rya is the finished 22-storey north tower. | epoch §31 |
| osm:438 (`osm-438-parking-extrusion`) | 20 m area guess over 7,240 m² | **removed** | `skipOsmAnchors`. EPT: grade mode, guarded roofOf 4.0; Nominatim parking; Apple grey pavement. Overturns the 2026-08-04 "VA garage" identity for this ring — the 2023 multi-deck garage is a different ring (osm:833). | epoch §13+§31 |
| osm:1127 (`osm-1127-artwork-as-building`) | 4.5 m solid on Revelle Plaza | **removed** | Same anchors. Nominatim tourism=artwork "Revelle Anchor"; SanGIS `building=yes` ring around an outdoor sculpture. | epoch §31 |

### Rejected candidates (each re-measured before rejection; do not re-find these)

- **`mandeville-host-vs-dense`** — REJECTED. Dense 57% in ~10.7 m under host
  lidar.heights 20.9 — well under the 85% thin-shelf cut (Sanford / Otterson
  stepped family). Pasting p75 flattens a real fly-loft / plant shelf. Host
  20.9 stands. Pinned in §31.
- **`vaf3-position-double`** — REJECTED as in-scope fix; RE-LOGGED as handoff.
  GIS (660.9,−83.9) and OSM (679.3,−86.1) still both render — coverage 0.
  Prior §13 / pass-1 r1c1 FINDINGS unchanged: needs a source, not a
  coverage-threshold tweak. Pinned in §31.
- **`roof-anchor-mandeville-cmme`** — REJECTED as in-scope fix; RE-LOGGED as
  handoff. Grade audit: Mandeville Δ −4.3 / CMME +4.2 (plus MedTeach / York /
  VA / South Parking past 2 m). Bases per-vertex safe. Renderer change
  (`roofY = rimMedian + h`) is cross-shard — prior FINDINGS unchanged.
- **`osm-441-bike-parking`** — REJECTED as a height / typology fix this pass.
  Clean one-storey plane (695 pts, dense 91%, gap 0.5) under a 4.5 m guess;
  Nominatim bicycle_parking. Δ under a storey; Apple shows a light pad that
  could be a roofed shelter. Not storey-class wrong. Pinned in §31.
- **`osm-39-cvs-pad`** — REJECTED. Dense 79% under a 4.5 m guess (Δ +0.9 vs
  p75 3.6) — under the 85% cut and under a storey. CVS storefront standing
  today. Guess stands. Pinned in §31.

### Withheld (better absent than wrong)

- **PCWest L1 pads / osm:438 / osm:1127**: removed from the world, not given
  a height — records duplicate, parking amenity, and plaza artwork each
  forbid shipping either the 2014 smear or the area guess.

### Handoffs / observations

- **VAF-3 position**: still open — university numbering vs OSM, zero
  footprint overlap. Needs Sahir / facilities map.
- **Roof-anchor class**: Mandeville (−4.3) / CMME (+4.2) join Hopkins
  Parking / Canyon Vista / Tuolumne Laundry / osm:502 — still a dedicated
  renderer pass.
- **Nested-plaza rule**: campus-wide only PCWest hit today; next full
  `build:arcgis` applies the filter to every mass. This pass spliced the
  seven in-file pads after re-deriving coverage per sample.
