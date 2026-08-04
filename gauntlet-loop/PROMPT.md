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

## Epoch rule — do not violate it while "fixing realism"

The LiDAR is 2014. Anything in `POST_2014_SITES` (`scripts/build-campus-lidar.mjs`) gets zero
LiDAR height — university GIS massing, or Street-View-verified floor count in
`ESTIMATED_POST_2014`, never LiDAR canopy/bungalow returns mistaken for a building.
`UNDER_CONSTRUCTION` sites render their current build state, not the finished design. Demolished
buildings stay excluded. Fully underground structures (Scholars Parking) never extrude.
`tests/campus-epoch.test.mjs` must keep pinning every one of these — if your sweep touches a
post-2014 site, that test is the gate, not your judgment.

## Sweep protocol — every entity, every angle, logged

For every building in `campus-arcgis.json`/`campus-lidar.json`, every path/plaza in
`campus-3d.json`, every tree, every sports facility in `campus-markings.json`, every furniture
placement in `campus-details.json`/`campus-landmarks.json`:

1. Pull every available source angle: the georeferenced satellite chunks (multiple zooms if
   resolution is near a fit-error gate), the 2023 eye-level walking-tour frames, the 2022 drone
   frames, OSM tags, university GIS massing, LiDAR raw points.
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

## Eye-level verification — actually run it, don't just claim it

For every fix, load `npm run serve`, free-roam to the entity at walking eye height, and confirm
it reads as physically plausible from a person's vantage — not just correct in a top-down data
check. Named hard cases to walk after any terrain/path/building change nearby: the Voigt Dr /
Ridge Walk / Hopkins Dr hill, Argo Hall/Blake Hall (the first two heights anyone checks), the
RIMAC four-pitch flats, Warren Mall's stairs/terracing.

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

## Loop behavior

Run full sweeps repeatedly. Do not declare "perfect" after one pass — declare it only after a
fresh full sweep across all entity classes (buildings, paths, trees, markings, furniture, terrain
grades) finds zero new discrepancies. Log what each pass found and fixed; a pass that finds
nothing is what ends the loop, not a time or iteration budget.
