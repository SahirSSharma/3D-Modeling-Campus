# Gauntlet Loop Prompt

Hand this to the gauntletloop (Fable 5, multi-agent workflows/sub-agent teams) tasked with
driving Campus Walk to total measured accuracy — elevation, scale, color, placement — across
the whole surveyed campus. It is written in the project's own vocabulary (the two-source rule,
the epoch rule, fit-error/coverage gates, "better absent than wrong") so fixes stay consistent
with `README.md` instead of drifting into generic photorealism.

---

## Mandate

Campus Walk claims to be "built from measurements rather than impressions." Your job is to find
every place that claim is currently false and make it true — building by building, path by path,
tree by tree, sports surface by sports surface, across the full ~3 km surveyed area — until a
full sweep turns up nothing. Not "looks close." Not "plausible." Measured, cited, and pinned by a
test, the same way Argo Hall's height (OSM said 22.8 m, LiDAR says 18.4 m) and RIMAC's missing
fourth pitch were caught — by checking, not by assuming.

## The one rule you may not break chasing perfection

Two sources, each used only for the thing it's good at, per the README:

- **OpenStreetMap** → footprint outlines, paths, plazas, names, boundary. Never height.
- **USGS 3DEP LiDAR (`CA_SanDiegoQL2_2014`)** → every height, the ground surface, every tree.
  Never "what is this."
- **Satellite imagery** (`docs/data/textures/`, Google/Apple chunks) → a BUILD-TIME measurement
  source only: per-polygon colours, painted markings, accuracy cross-checks. It is never draped
  on the world and never used to infer height or identity.

If a fix requires reading a height off a photo, or reading identity off LiDAR's "unassigned"
class, it is wrong by construction — stop and find the correct source instead.

### Apple imagery is the authority on WHAT IS THERE TODAY

Ratified by Sahir 2026-08-04. **Apple Maps satellite is the ground truth for the present state of
campus** — what exists, what was demolished, what was repainted, what finished construction. When
Apple disagrees with any other source about *whether a thing is there or what it now looks like*,
Apple wins and the other source is stale.

This is measured, not assumed. At Ridge Walk North (Eighth College) on 2026-08-04:

| Source | What it shows at that site | Epoch |
|---|---|---|
| **Apple satellite** | the finished neighbourhood — completed roofs w/ mechanical plant, landscaped courtyards, mature planting | **newest** |
| Google Photorealistic 3D mesh | bare orange dirt, tower cranes, partially poured decks | ~2021–22 |
| Google Street View | panorama predates the buildings entirely | 2020-03 |
| USGS 3DEP LiDAR | nothing — site predates the survey | 2014 |
| `campus-3d.json` / `campus-arcgis.json` | nothing — no Alianza, Umoja, Coalition, Malk Hall | — |

Apple also carries the Muir pickleball repaint that Google's imagery predates. Currency is Apple's
real edge and it is decisive.

**The one thing Apple is NOT the authority on: exactly WHERE.** The 2026-08-04 credentialed probe
(`scripts/audit-imagery-source.mjs --probe=apple`) measured Apple's georegistration **off by
1.25 m** (1.00 m east, 0.75 m north, best correlation 0.439) — past this project's own 0.6 m
stop-sign threshold. Sampling a colour off unregistered Apple pixels reads the neighbouring
surface. So:

- Apple decides **existence, identity, appearance, currency**. Trust it.
- Apple does **not** decide **position** until its offset is solved and pinned by a test. Until
  then, per-polygon colour sampling stays on the registered Google chunks, or Apple gets used only
  after a fitted per-site offset correction whose residual is logged like any other `fitError_m`.

Solving that offset is a first-class objective of this loop, not a footnote. Once a fitted Apple
registration passes gate, Apple becomes the colour source too and this clause gets deleted.

## Epoch rule — do not violate it while "fixing realism"

The LiDAR is 2014. Anything in `POST_2014_SITES` (`scripts/build-campus-lidar.mjs`) gets zero
LiDAR height — university GIS massing, or Street-View-verified floor count in
`ESTIMATED_POST_2014`, never LiDAR canopy/bungalow returns mistaken for a building.
`UNDER_CONSTRUCTION` sites render their current build state, not the finished design. Demolished
buildings stay excluded. Fully underground structures (Scholars Parking) never extrude.
`tests/campus-epoch.test.mjs` must keep pinning every one of these — if your sweep touches a
post-2014 site, that test is the gate, not your judgment.

**There is no single "current" epoch — there are four, and they disagree.** Apple (newest) →
Google 3D mesh → Google Street View / nadir chunks → LiDAR 2014 (oldest). Never treat a newer
source as automatically authoritative about *height*, and never treat LiDAR as authoritative about
*existence*. Each answers only its own question, at its own date.

## Hypothesis H1 — LiDAR and Apple should agree where nothing changed

Sahir's stated prediction, 2026-08-04, and the loop's primary calibration instrument:

> For buildings that appear in **both** LiDAR (2014) and Apple (today) and are **unchanged**
> since 2014, LiDAR height/footprint and Apple's footprint should show **high correlation and
> agreement**.

Treat this as a falsifiable test, not a belief to protect. Build it as a real script
(`scripts/audit-epoch-agreement.mjs`) and run it every sweep:

1. Take the set of buildings present in OSM, extruded from LiDAR, and **not** in
   `POST_2014_SITES` / `UNDER_CONSTRUCTION` / demolished.
2. For each, compare its LiDAR-derived footprint extent and roof plane against the Apple image
   footprint (after the per-site registration correction above — an uncorrected 1.25 m offset
   will manufacture disagreement that isn't real, and misreading that as a change would be the
   worst failure this loop can make).
3. Log per-building agreement and the campus-wide distribution. Gate the same way everything else
   is gated — per sample, never per facility.

**Both outcomes are wins, and you must report which one you got:**

- **Agreement high** → H1 holds. That is positive evidence the two-source rule is sound and the
  2014 LiDAR is still trustworthy for the unchanged majority of campus. Pin it with a test so a
  future regression in either pipeline shows up as a correlation drop.
- **Agreement low for a specific building** → that building is a **change detector hit**, not a
  bug. Something was built, demolished, re-roofed or expanded after 2014 and the epoch bookkeeping
  missed it. Investigate it as a candidate `POST_2014_SITES` / `ESTIMATED_POST_2014` entry.

Do not tune thresholds until H1 passes. A hypothesis that cannot fail measures nothing. If the
campus-wide correlation comes back low, say so plainly and report the number — that is a real
finding about the data, and Sahir wants the honest result, not a confirmation.

## Sweep protocol — every entity, every angle, logged

For every building in `campus-arcgis.json`/`campus-lidar.json`, every path/plaza in
`campus-3d.json`, every tree, every sports facility in `campus-markings.json`, every furniture
placement in `campus-details.json`/`campus-landmarks.json`:

1. Pull every available source angle: **an Apple snapshot first** (the currency check — is this
   thing still there, and does it still look like that?), the georeferenced satellite chunks
   (multiple zooms if resolution is near a fit-error gate), the 2023 eye-level walking-tour
   frames, the 2022 drone frames, OSM tags, university GIS massing, LiDAR raw points.

   **You can now inspect any building's exterior from any angle.** Google Photorealistic 3D Tiles
   answers on the existing `GOOGLE_MAPS_API_KEY` (verified 2026-08-04: descends to
   `geometricError` 2.01 m, textured glTF, ~1 m triangle edge). A headless CesiumJS + Playwright
   harness renders any lat/lng at any heading/pitch/range to a PNG — Playwright, sharp and ffmpeg
   are already installed. Promote that harness into `scripts/` and use it to *see* a facade before
   ruling on it. Read the epoch warning below before you believe a single thing it shows you.
2. Where sources disagree (as Argo/Blake/Mandeville/McGill/Student Center/Revelle Commons all
   did), the more direct measurement wins — LiDAR over OSM height tags, fitted paint over
   eyeballed markings — and you record *why*, in the README's own voice, not just the new number.
3. Compute and log `fitError_m` and `fitCoverage` (or the equivalent check) for anything
   spatially fitted, same as `build-campus-markings.mjs` already does. Anything past the existing
   gates (0.5 m / coverage floor, tighter 0.35 m / 0.75 coverage for RIMAC) fails, full stop — do
   not loosen a gate to make a fix pass.
4. If no source can resolve an entity to gate tolerance, leave it unbuilt and say so, the same
   way Warren Field's overlapping paint generations and RIMAC's north-east pitch were left
   unpainted. **Better absent than wrong** — this is a hard rule, not a fallback.

## Terrain & gradient protocol — Voigt Dr is the acceptance test

Voigt Dr's elevation at its intersection with Ridge Walk vs. Hopkins Dr is a real, sizeable hill.
Before any entity is placed near a slope like this:

- Sample the LiDAR ground surface at **every vertex of the entity's footprint**, not its
  centroid. A building or path spanning a grade must follow that grade at each corner, not sit
  flat at one averaged height.
- Treat Voigt Dr / Ridge Walk / Hopkins Dr as the named regression case: after any terrain or
  path change, walk it in `npm run serve` and confirm the slope reads correctly at eye level,
  corner to corner, with no flat-planting.
- Extend this same per-vertex sampling check to every other graded path on campus (Library Walk,
  Warren Mall's terracing, Snake Path) — Voigt/Ridge Walk/Hopkins is the proof case, not the only
  case.
- Any place two draped surfaces meet at the same elevation (path edge vs. lawn, road vs.
  pavement) gets the existing z-fighting-avoidance handling `campus-drape.js` already uses — do
  not introduce a new coincident-plane seam while fixing something else.

## Forbidden failure modes — named, checkable, test-pinned

- **Building below or above its sampled ground** — verify at all footprint vertices, not
  centroid only (the class of bug the epoch rule and per-mass reconciliation exist to prevent).
- **LiDAR "unassigned" returns misread as building mass** — canopy or demolished-structure
  returns must not extrude as buildings; this is exactly what `POST_2014_SITES` guards against —
  extend the guard, don't work around it.
- **Oversized or clipped trees** — species-derived height/crown from `campus-species.js` must
  stay in the LiDAR's own measured range per species; a tree taller than the building it stands
  beside needs its LiDAR number re-checked before it's accepted, not just rendered.
- **Z-fighting / flickering ground** — any new coincident-elevation surfaces must go through the
  same draping/offset handling as existing ones.
- **Coverage/fit checks resolved at the wrong granularity** — RIMAC's north-west pitch scored
  0.53 because coverage was resolved once at the facility centroid instead of per-sample across a
  zoom seam. Any new spatial fit must resolve its threshold **per sample**, not per facility, or
  it repeats that exact bug.
- **Vertical dimensions invented where no source resolves them** — nadir imagery and 2014 LiDAR
  do not see fences, nets, or backstops. If neither source resolves a vertical dimension, state
  the convention explicitly (as the goal/net and RIMAC sections already do) rather than guessing.
- **Treating the Google 3D mesh as current** — it is its own epoch and it is NOT today. At Ridge
  Walk North it shows tower cranes and unpoured decks. Use it to *look* at a building, never to
  date one, and never as a height source (it is photogrammetry, not survey — the two-source rule
  still binds).
- **Sampling Apple pixels without the registration correction** — 1.25 m of uncorrected offset
  samples the neighbouring surface. Every Apple-derived colour must cite a fitted offset and a
  logged residual, or it does not ship.
- **Reading a disagreement as an error when it is a date** — before "fixing" any source conflict,
  establish which epoch each side is from. Most surprising conflicts on this campus are two
  sources that are each correct about different years.

## Eye-level verification — actually run it, don't just claim it

For every fix, load `npm run serve`, free-roam to the entity at walking eye height, and confirm
it reads as physically plausible from a person's vantage — not just correct in a top-down data
check. Named hard cases to walk after any terrain/path/building change nearby: the Voigt Dr /
Ridge Walk / Hopkins Dr hill, Argo Hall/Blake Hall (the first two heights anyone checks), the
RIMAC four-pitch flats, Warren Mall's stairs/terracing.

## CORRECTED — the Eighth College mistake, and what it teaches

**Do not repeat this. Read it before touching any college affiliation.**

An earlier version of this file asserted that Eighth College is Alianza, Umoja, Coalition and Malk
Hall at Ridge Walk North, and told you to move the label there. **That was wrong.** Sahir, who
attends this university, corrected it 2026-08-04:

- **Eighth College is Sankofa, Pulse, Podemos, Azad and Survivance** — clustered near
  `x ≈ −131, z ≈ 594` (≈ 32.8727, −117.2425). The ORIGINAL seed `(-99.4, 608.5)` was correct.
- **Alianza, Umoja, Coalition and Malk Hall belong to Thurgood Marshall College.** They are real
  buildings and belong in the world — just never under Eighth's name.

Two failures produced that error, and both are already forbidden above:

1. **An OSM neighbourhood name was read as a college affiliation.** "Ridge Walk North Living and
   Learning Neighborhood" is a place name, not a statement about which college lives there. OSM is
   authoritative for footprints and names, and for NOTHING about institutional structure. There is
   no source in this repo for college affiliation — if you need one, ask Sahir. Do not infer it.
2. **An epoch was misread as a position error.** The original anchor "looked wrong" because the
   Google 3D mesh over that spot predates 2023 and still shows a bare construction site. An absent
   building in a stale mesh is a DATE, not a misplaced label — the exact failure mode listed under
   Forbidden failure modes. The check that would have caught it: an Apple snapshot, which shows all
   five buildings standing.

`tests/campus-epoch.test.mjs` §8 now pins the label to Eighth's own five buildings AND asserts
Marshall's four are far from it, so this specific mistake cannot recur silently.

**The standing rule this leaves behind:** when a claim about identity or affiliation comes from an
inference rather than a source, say so and leave it. Sahir is the authority on what belongs to
which college, and asking him costs a sentence.

## Definition of done — falsifiable, not aspirational

A region only counts as done when ALL of:

- `npm test` and `npm run check` pass with a new or updated test pinning every fix (following
  `campus-epoch.test.mjs` / `campus-facades.test.mjs` / `campus-rimac.test.mjs` as the pattern —
  an untested fix is not a fix).
- Every changed entity has a cited source and, where applicable, a logged
  `fitError_m`/`fitCoverage` within gate.
- No epoch-rule violation introduced (`tests/campus-epoch.test.mjs` still green).
- Eye-level walkthrough at the entity's location confirms plausibility.
- README updated in its existing voice (source, what was wrong, measured correction — matching
  the Argo/Blake table and RIMAC-section style), not a generic changelog line.
- Deployed and confirmed live at `https://sahirssharma.github.io/campus-walk/` before being
  reported as done.

## Running this on Cursor (single agent, no fan-out)

`cursor-agent` is ONE agent — it has no sub-agent teams, so the mandate above
cannot be handed to it whole. `scripts/gauntlet-cursor.sh` is the adapter: it
cuts campus into geographic shards (`scripts/gauntlet-shards.mjs`), feeds them
through one at a time, and appends a Cursor-mode addendum to this file at
invocation time — single-agent framing, the shard's bounds, and a hard
push/deploy prohibition backed by an armed `pre-push` hook.

Do not paste this file into Cursor by hand; you will get an agent that tries to
spawn teams it does not have and to deploy a site it must not touch.

## Loop behavior

Run full sweeps repeatedly. Do not declare "perfect" after one pass — declare it only after a
fresh full sweep across all entity classes (buildings, paths, trees, markings, furniture, terrain
grades) finds zero new discrepancies. Log what each pass found and fixed; a pass that finds
nothing is what ends the loop, not a time or iteration budget.
