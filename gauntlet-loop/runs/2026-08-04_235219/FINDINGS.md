# Gauntlet findings — 2026-08-04_235219 (judge re-audit)

## Pass 1, shard r2c1 (lat 32.864542..32.873467, lng −117.242934..−117.231752 — 400 buildings, 22 named)

`npm test`: **385/385 pass** (was 371; §15 of `campus-epoch.test.mjs` is new — 7 tests, and the
trees suite gained nothing but now holds by construction, see the rounding fix below).
`npm run check`: all five validators pass (287 measured heights, 503 massing parts, 10,681 trees).
Every candidate in `pass1-r2c1.screen.json` was re-derived before judgement: a fresh targeted EPT
re-sample replicating the build pipeline's own rules (same roofOf tree-guard, same rim-median
base, with height histograms for the canopy candidates), Apple snapshots for every site, crops of
the registered Google chunks, and Street View frames where a construction date or a storey count
mattered. Probe artifacts in `.cache/gauntlet-r2c1/` (probe.out, evidence/, shots/).

Eye-level verified through the real page (screenshots in `.cache/gauntlet-r2c1/shots/`): the Che
Café reads as the one-storey wooden venue under the grove with the HUD measuring 3.8; Laurel sits
level with its one-storey siblings; the Shank and the Forum stand as two labelled buildings with
James' Place between them and the Potiker complex behind; the Satellite Utility Plant is a single
clean block with no unnamed twin through it; the west-corridor admissions render at their planes.

### Fixed — heights (every value from a fresh EPT re-sample run this pass)

| Entity | Was shipping | Now ships | Source | Test |
|---|---|---|---|---|
| Che Café Collective (`che-cafe-canopy-bleed`) | 20.9 m — host canopy paste over a 4.3 m eave record | **3.8 m** | HAND_AUDITED: 48 % of returns in a dense 2–4 m band (hist 2 m: 1,186 · 3 m: 885 of 4,280 on the record trace), the rest up the crowns to 29.3 — p75 20.4 was pure canopy. SV shows trunks through its deck; the OSM mapper's own tag says 4.8; record eave 4.3/L1 | epoch §15 |
| Laurel (`laurel-canopy-bleed`) | 9.9 m — same paste at half the height | **4.2 m** | HAND_AUDITED: 70 % of returns in the 4 m bin alone (1,559 of 2,232), tail to 16.5 through the crowns over its east edge; unshaded siblings Laurel Extension 4.4, Magnolia 4.3, both clean planes | epoch §15 |
| Theodore and Adele Shank Theatre (`shank-forum-sliver-rename`) | suppressed under a union ring; name on a 3.2 m shed | **10.1 m, its own OSM ring** | LiDAR 2,123 returns, p98 10.1; the 56 m² record sliver that stole the name measures 2.7–3.2 (a real shed, now subsumed inside the theatre volume) | epoch §15 |
| Mandell Weiss Forum (same candidate) | one 1,987 m² union slab over two theatres | **10.5 m, its own OSM ring** | LiDAR 4,407 returns, p98 10.5, body tight; the union ring's own trace reads 10.4 — the Forum's plane, a lie about there being one building | epoch §15 |
| Grid-roof residential complex (`unnamed-93-overheight`, osm:93) | 16 m area guess | **11.8 m** | LiDAR 7,543 returns, p25 10.5 → p98 11.8, body tight; standing unchanged on today's Apple; SV shows 3–4 floors behind the ficus rows | epoch §15 |
| Commercial L-block, Villa La Jolla Dr (`unnamed-77-overheight`, osm:77) | 12 m OSM tag | **7.5 m** | one plane, p25 = p75 = 7.5 over 7,400 returns; the p98 tail to 28.1 is the ficus hugging its east edge, which the tree-guard discards | epoch §15 |
| La Jolla Village Square east strip (`unnamed-333-underheight`, osm:333) | 4.8 m OSM tag | **8.2 m** | the mapper under-tagged a tall retail shell: 6,216 returns, p98 8.2, max 8.5 | epoch §15 |
| La Jolla Village Square center pavilions (`unnamed-335-underheight`, osm:335) | 4.8 m OSM tag | **7.7 m** | same under-tag: 3,173 returns; targeted probe reads p98 7.8, the build's own tiling 7.7 — the shipped number is the pipeline's | epoch §15 |

### Fixed — geometry/render classes (the case was never the fix)

| Class | Members found | Root cause | Fix | Test |
|---|---|---|---|---|
| Union outline, theatre form | the two record rings named "Mandell Weiss Forum" (1,987 m² union + 56 m² sliver, centroids 39.7 m apart — one entry catches both) | the record traces Forum + Shank as one extrusion; the Shank's OSM ring suppressed under it, and the sliver standing centroid-inside the Shank ring took the theatre's NAME through the host rename | `UNION_OUTLINES` in `build-campus-arcgis.mjs` (the Earth Hall fix); the OSM division renders, each theatre at its own plane. This was pre-registered by r0c1 as "same class, out of this shard's scope" — it is now in scope and done | epoch §15 |
| Host rename into a RENDERING ring | James' Place — with the Forum union rings dropped, the record's "James' Place" (centroid-inside the now-rendering OSM Forum ring) took the ring's name and the Forum rendered twice | the rename never asked whether the host ring itself stands in the world; its purpose is that SUPPRESSION loses nothing, and an un-suppressed ring needs no heir | the rename fires only into a suppressed ring (`renderedOsm` set in `campus-massing.js`); height reconcile through the host untouched, names only. §14's James'-Place assertion holds again | epoch §14 (existing) |
| Unnamed double-render through massing | osm:718 (9 m guess, 0.775 covered by the Satellite Utility Plant record) and osm:359 (8.4 m re-trace of Mesa Apartments Central 9236, 0.52 covered — r2c2's box, fixed from here) — campus-wide, the only two flips | the ≥0.85 area floor exists to protect a NAME suppression could delete; an unnamed ring has no name to lose, only geometry the massing already renders | unnamed rings take a 0.5 area floor in `ringCoveredBy`, the same bar the vertex-majority test already uses | epoch §15 (class invariant re-checks every unnamed mass) |
| Prune-then-round tree ghosts | 13 trunks standing "inside" buildings after this pass's rebuild — every one within 5 cm of its wall, campus-wide (York Hall, Latin America Hall, MESOM, One Miramar ×2, Mesa Nueva - Marea, Seventh West #3, Tuolumne T-South, five unnamed) | `build-campus-lidar.mjs` pruned full-precision trunk positions, then rounded to 0.1 m for the file — rounding carried wall-huggers across footprint edges the prune had cleared. The committed file had simply won this lottery; every rebuild re-rolled it | round first, then prune: what the prune clears is exactly what the file says | `campus-trees.test.mjs` (existing — it is what caught it) |

### Epoch verdicts (dates, not errors)

- **`satellite-util-unchallenged`** — the screen's implied fix ("massHeights would read 4.2") is
  REJECTED as an epoch mistake; the bookkeeping fix is REAL and done. The plant opened ~2018-19
  (SV 2020-03 shows it standing; today's Apple confirms); the flight's tight 4.0–4.2 m plane
  (416 returns, p98 4.2) is the demolished predecessor. "Satellite Utility Plant" joins
  `POST_2014_SITES`, osm:718 joins `POST_2014_OSM_RINGS` (same site, per-ring form), and the
  12.8 m / L3 record ships unchallenged. Pinned: no massHeights key may ever appear at m:419,523.
- **`unnamed-1354-sparse-lot`** — POST_2014, verified three ways: the flight saw 48 returns,
  max 1.7 m (a bare lot); Street View 2018-05 still shows empty ground; today's Apple shows the
  finished pitched-roof building with solar carports. Built after mid-2018 → `POST_2014_OSM_RINGS`,
  keeps its declared 12 m area guess stated as a guess. The registered Google chunk over this
  block is censored — Apple is the only current nadir view, the VA-garage situation again.

### Rejected candidates (each re-measured before rejection; do not re-find these)

- **`potiker-jacobs-rename`** — REJECTED, working as designed. The record calls both
  theatre-complex masses "Joan and Irwin Jacobs Center for La Jolla Playhouse"; OSM outlines the
  Potiker Theatre across them; both are right — the Jacobs Center is the facility, the Potiker
  the venue inside it, and OSM is this project's name authority. The part that must never
  regress is measurement, and it holds: each mass ships its OWN plane (13.5 the fly tower, 9.4
  the house), not one pasted number. Pinned in §15.
- **`unnamed-guess-class-hole`** — REJECTED as scoped, with the honest part kept. The probed Mesa
  housing pads (osm:516/517/521/523/527/533/535/547/551/552) read planes 9.0–10.0 against their
  uniform 9 m guesses — agreement within ~1 m, no lie to fix. The verification MECHANISM the
  screen wanted exists (`OSM_UNNAMED_VERIFIED`, per-index), and this pass used it for the four
  outliers above. Admitting all 377 in-shard unnamed rings needs a per-ring Apple currency check
  each — that is a shard-scale batch job, handed off below, not a reason to ship 373 unverified
  numbers now.

### Handoffs / observations for later shards

- **Mesa pads batch verification** (r2c2 shares the row): the probed sample agrees with the
  guesses; a dedicated pass could admit the row wholesale with per-ring Apple checks.
- **Wagner Dance Building**: not a screen candidate, but the probe read p50 7.3 / roofOf 7.9
  (guard=true) against a 4.3 m / L1 record. The returns are canopy-mixed (guard fired) and
  nothing ships wrong today (record stands), but a future pass should histogram it — the dense
  band may sit near 7, which would make the record the under-reader.
- **osm:359 / Mesa 9236** was fixed from this shard by the unnamed-floor class fix; r2c2's
  screener should not re-find it.
- **James' Place geometry**: the record volume (5.1 m plane) stands inside the OSM Forum ring's
  10.5 m extrusion — identity correct, geometry partially interior. If OSM ever splits James'
  Place out of the Forum ring, both will render cleanly with no change here.

### The far-taller-LiDAR paste class, after this pass

The reconcile branch that pasted the grove onto the Che Café survives exactly one place
campus-wide: Jacobs Hall, whose 33.2 m host plane over a 17.1 m / L4 record is the cruciform
core being genuinely taller than the record — the r1c1 verdict, re-confirmed and unchanged.
Every other paste is a HAND_AUDITED value or a measured plane replacing a default record.
