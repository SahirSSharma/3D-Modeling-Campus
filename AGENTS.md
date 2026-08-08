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

## Verification

`npm test` must pass, and the emulator suite needs:

```bash
export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"
npm test
node --test tests/data/*.test.mjs   # the no-emulator subset
```

An untested fix is not a fix. Paste the real output, including failures — never
report a result you did not actually run.

## Publishing

**Do not push and do not deploy.** This site is live at
`https://sahirssharma.github.io/3D-Modeling-Campus/`; shipping is Sahir's explicit
call, every time. Local commits are fine. During a gauntlet run a `pre-push`
hook is armed and will reject you — do not work around it or delete
`gauntlet-loop/.no-push`.
