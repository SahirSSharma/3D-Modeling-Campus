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
- **Work in progress goes to `?mode=staging`, not to the run.** There are two
  corridors and `scripts/build-corridor.mjs` builds both from one `ROUTES`
  table: `corridor-eighth-peterson.json` is the run people ride, and
  `corridor-argo-peterson.json` is the workbench. Try things on staging. It is
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

**Do not push and do not deploy.** This site is live at
`https://sahirssharma.github.io/3D-Modeling-Campus/`; shipping is Sahir's explicit
call, every time. Local commits are fine. During a gauntlet run a `pre-push`
hook is armed and will reject you — do not work around it or delete
`gauntlet-loop/.no-push`.
