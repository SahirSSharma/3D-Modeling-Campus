# 3D Modeling Campus — instructions for any agent working in this repo

Cursor reads this file; Claude Code reads it too. It exists so a headless agent
inherits this project's gates instead of only the global operating model in
`~/.cursor/AGENTS.md` → `~/.claude/CLAUDE.md`.

## Read before you touch anything

1. `README.md` — the two-source rule and the epoch rule. These are not style
   preferences; they are what the project claims to be. Violating them makes the
   whole thing false.
2. `.claude/skills/sahir-rules/SKILL.md` — Sahir's approval gates, verification
   methodology, and definition of done. **These override any workflow's
   defaults**, including a workflow that wants to auto-commit or auto-deploy.
3. `gauntlet-loop/PROMPT.md` — the accuracy mandate, the fit-error gates, the
   named failure modes, and Hypothesis H1.

## The rules most likely to be broken by an agent in a hurry

- **Two sources, each for what it is good at.** OSM → footprints, paths, names,
  never height. LiDAR (2014) → every height and the ground surface, never
  identity. Satellite imagery → a BUILD-TIME measurement source only; it is
  never draped on the world and never used to infer height.
- **Apple decides what exists today; LiDAR decides how tall.** Apple Maps
  satellite is the authority on existence, identity and appearance. It is not
  yet the authority on position — a measured 1.25 m georegistration offset is
  unresolved, so colour sampling stays off raw Apple pixels until a fitted
  registration passes gate.
- **Epochs disagree and that is normal.** Apple (newest) → Google 3D mesh →
  Street View → LiDAR 2014 (oldest). Before "fixing" a source conflict, work out
  which year each side is describing. Most surprising conflicts on this campus
  are two sources each correct about a different year.
- **Better absent than wrong.** If no source resolves an entity to gate
  tolerance, leave it unbuilt and say so. Do not fill the gap with a plausible
  guess.
- **Never loosen a gate to make a fix pass.**
- **A route must never run through a building.** `check` in
  `scripts/build-corridor.mjs` walks the shipped centreline against every
  footprint and fails on any intrusion; `tests/corridor.test.mjs` does the same
  against the FULL campus. It fired for real: the run drove 12 m through Argo
  Hall. Three causes, all now guarded — a building named as a waypoint routes to
  its centroid; `campus-route.js` plaza centre-spokes are an invented shortcut
  and were crossing footprints; and Chaikin smoothing rounds corners off the
  surveyed path and into walls. Do not "fix" a future instance by relaxing that
  gate.
- **The scooter route's shape is gated against a drawn line, not against taste.**
  `DRAWN_REFERENCE` in `scripts/build-corridor.mjs` is the correct route traced
  off a map Sahir drew on, converted into this repo's frame. `check` fails past
  5 m mean / 12 m worst, and fails separately if the line ever doubles back
  along it. It exists because every other gate passed on a route that was 39 m
  wrong, twice. **Waypoints are raw `{x, z}` points, never building names** — a
  name routes to the building's centroid, and hall-adjacent graph nodes are
  often dead-end spurs that produce an out-and-back. Do not widen these
  tolerances; if a change cannot meet them, the change is wrong.
- **Bridging a gap in the OSM footway survey is opt-in, and free roam does not
  opt in.** `buildGraph(data, { bridgeGaps })` in `campus-route.js` joins a
  dangling footway tip to the walkway it stops short of — never through a
  building, and only where walking round costs more than five times the gap.
  Campus-wide at 10 m that is 244 inferred links, which is far too large a claim
  to make on free roam's behalf. The corridor builder is the only caller, and
  every bridge the shipped line crosses is declared in `route.bridges` and
  re-checked. Do not turn it on by default.
- **`heightAt` is not the surface you can see.** The terrain mesh is drawn from
  every second LiDAR sample; `heightAt` interpolates all of them. Anything
  PLACED on the ground must use `surfaceAt` (`campus-terrain.js`), which is the
  height of the drawn triangle, or it will sit under the visible ground.
  Anything the scooter run puts on the route — the machine, obstacles, coins,
  the finish bar — additionally sits on one ride plane, `surfaceAt +
  overlayLift("pad")`, because what reads as ground is a lifted decal. Obstacles
  are not cosmetic here: `scooter-ride.js` clears a hop with `ride.y > o.h`, so
  a second datum makes that comparison lie.
- **Work in progress goes to `?mode=staging`, not to the run.** There are two
  corridors and `scripts/build-corridor.mjs` builds both from one `ROUTES`
  table: `corridor-eighth-peterson.json` is the run people ride, and
  `corridor-staging.json` is the workbench — the SAME route with no obstacles or coins. Try things on staging. It is
  allowed to be broken; the run is not. Staging is **not** exempt from any gate
  — the same `--check` and the whole of `tests/corridor.test.mjs` run over both
  — it is exempt only from being finished. Each file is stamped with
  `built.target` and both the builder and `campus-scooter.js` refuse a mismatch,
  because the two documents are otherwise identical in shape and loading the
  wrong one is silent.
- **The scooter run's props are the only invented entities, and they stay
  quarantined.** Both corridor files are a CROP of the measured files — if
  `scripts/build-corridor.mjs` ever emits a ring, height, tree or colour that is
  not copied verbatim from its parent, it is broken, and its `--check` fails on
  exactly that. **Never compact `arcgis.ground` or
  `arcgis.massing` in that crop.** `campus-eighth.js` addresses those arrays by
  literal index (a hard-coded `1761`, plus every `arcgis.ground#NNNN`
  registration in `campus-eighth.json`), so a renumbering rebuilds Eighth
  College out of the wrong polygons with nothing on screen to say so. Dropped
  slots are `null`; consumers guard for the hole. Its obstacles and coins are invented and
  live under the single `game` key: seeded from a pinned constant, never read by
  a measured consumer, and labelled as invented in the file, the README and the
  on-screen HUD. Do not widen that key's reach, and do not let anything under it
  become a source for anything else. Scooter mode's *look* (shadows, tone
  mapping, the sunset sky) is art direction and is deliberately allowed to
  diverge from free roam; its *geometry* is not.

## Verification

`npm test` must pass. No emulators and no Java are involved in this repo.

```bash
npm test                  # node --test tests/*.test.mjs
npm run check             # every builder's --check + the reproducibility verify
npm run verify:boot       # the site actually boots
                          # NOTE: this already fails on main — "roof coverage only 97.9%"
                          # against a 0.98 threshold. Pre-existing. Do not fix it by
                          # lowering the threshold and do not report it as passing.
npm run verify:ride       # drives the scooter run in a real browser: fly-mode keys,
                          # the contact patch against the drawn surface, camera
                          # continuity, and the track-marking reveal
npm run verify:reproducible   # LiDAR build is byte-identical on a rerun
npm run readiness         # gate status
npm run progress          # gauntlet progress
npm run serve             # local server to look at it
```

`npm run check` is the real gate — it runs `--check` on the OSM, LiDAR, satellite,
colors, and colleges builders plus the reproducibility verify. Run it before
claiming a build change is safe.

An untested fix is not a fix. Paste the real output, including failures — never
report a result you did not actually run.

## Publishing

This site is live at `https://sahirssharma.github.io/3D-Modeling-Campus/`.
**Commit and push once every gate has passed** (`npm test`, `npm run check`,
`npm run verify:ride`) — the workbench, `?mode=staging`, is where Sahir
reviews, and he can only review on the website, so finished work always goes
live to it; Sahir set this rule on 2026-08-16. Never push failing gates.
During a gauntlet run a `pre-push` hook is armed and will reject you — do
not work around it or delete `gauntlet-loop/.no-push`.
