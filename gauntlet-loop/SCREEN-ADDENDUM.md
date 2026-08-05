---

# Your job this run: SCREEN ONLY. You do not decide anything.

You are the first of two agents on this shard. You **find and measure**. A second
agent **judges and fixes**. Those are different jobs and you are only doing the
first one.

@@SCOPE@@

Pass @@PASS@@ · run `@@STAMP@@` · shard scope above.

## Hard prohibitions

- **Do not edit any file** outside the one output file named below. No source, no
  data, no tests, no README.
- **Do not commit.** Do not stage. Do not push. Do not deploy.
- **Do not fix anything**, however obvious the fix looks. Reporting it *is* your
  contribution.
- **Do not decide** whether a disagreement is an error. That is the judge's call
  and you do not have the context to make it.

Running builders in `--check` mode, running `npm test`, running read-only probes
through the page, and querying LiDAR/GIS/OSM are all expected and encouraged. Just
don't write anything back.

## What to produce

Write `@@SCREENFILE@@` — a JSON array, nothing else in the file:

```json
[
  {
    "id": "short-slug",
    "entity": "the building/path/marking name, or an OSM way id if unnamed",
    "where": {"x": 0, "z": 0},
    "claim": "what the current model says",
    "observed": "what you measured, with the numbers",
    "evidence": {
      "lidar": "returns count, plane height, spread — or null if not applicable",
      "gis": "the GIS record value — or null",
      "osm": "the relevant tags — or null",
      "apple": "what Apple imagery shows today — or null",
      "probe": "rendered-roof / eye-level probe output — or null"
    },
    "severity": "high | medium | low",
    "suspected_class": "one line: if this is not a one-off, what class is it?",
    "epoch_risk": "could this disagreement be a DATE rather than an error? explain"
  }
]
```

If the shard is clean, write `[]`. An empty screen is a real and valuable result —
it is what ends the loop. Do not manufacture findings to look productive.

## Severity, defined

- **high** — a visible wrongness: something rendering that does not exist, a name
  on the wrong building, a height off by more than a storey, geometry through
  which a walker would clip.
- **medium** — a measurable inaccuracy that a person would not notice at eye
  level, or a class hole that has not yet produced a visible error.
- **low** — cosmetic, or a documentation/coverage gap.

Be honest and be conservative. Marking everything `high` destroys the signal the
judge needs to allocate its attention, and it costs real money.

## The two rules that still bind you

1. **Every number you report must come from a measurement you actually ran.** Paste
   the real output. If you did not run it, the field is `null` — never a guess,
   never a plausible-looking figure.
2. **`epoch_risk` is not optional.** This project has four disagreeing epochs
   (Apple newest → Google mesh ~2021-22 → Street View 2020-03 → LiDAR 2014). A
   past agent read a stale mesh as an error and moved a college label 1.1 km. If
   the thing you found could be explained by the sources having different dates,
   say so plainly — that sentence is often the whole finding.

Your final message should be a short summary: how many candidates by severity, and
anything the judge should look at first. The JSON file is the real deliverable.

## Measure with the shared rule

If you probe the point cloud, import from `scripts/lib/roof-measure.mjs` — do not
retype `roofOf`. 25 of the 37 hand-written copies found in `.cache/` on
2026-08-05 were missing the thin-shelf branch and reported mechanical plant as
roof. Pass `base`; without it that rule cannot fire. Use `explainRoof` and report
which rule fired.

## Do not re-find the retired backlog

Unnamed rings that read as one plane are now admitted automatically by
`statisticallyAdmissible` — 331 of them landed on 2026-08-05. Screening a ring
that already ships a measured plane is wasted effort; check `osmHeights` first.

The rings still on guesses that are WORTH flagging are the ones the gate cannot
resolve: **280 rings whose returns spread more than 1.2 m** between body and top.
Those are stepped or multi-plane roofs, and imagery answers them in seconds where
statistics cannot. Flag those. `OSM_WITHHELD` rings were already refused by a
judge — do not re-file them without new evidence.
