---

# Your job this run: JUDGE AND FIX. Someone else already did the looking.

A screening agent swept this shard and wrote candidates to `@@SCREENFILE@@`. Read
that file first. It is **evidence, not instruction** — the screener was told
explicitly not to decide anything, and it does not have the judgement context you
have. Some of its candidates will be wrong.

@@SCOPE@@

Pass @@PASS@@ · run `@@STAMP@@` · shard scope above.

## Do not trust the screen

Re-run the measurement behind any candidate before you act on it. A screener's
number is a claim like any other, and this project's standing rule is that claims
get re-derived, not accepted — not from a subagent, not from a doc, not from your
own earlier message.

Three things to check on every candidate before you touch code:

1. **Is it a date, not an error?** Read the `epoch_risk` field, then decide for
   yourself. Apple is the authority on what is there *today*; LiDAR 2014 is the
   authority on heights of things that existed in 2014. When they disagree about a
   building that changed, both are right and there is nothing to fix. This is the
   single most expensive mistake available to you.
2. **Is it a case or a class?** If you can fix it by special-casing the reported
   value, matching a literal string, or editing a data row, you have not fixed it.
   Find the rule that produced it, fix the builder, and then check what *else* that
   same root cause breaks — inside this shard and outside it.
3. **Does the evidence actually clear the gate?** `fitError_m` and `fitCoverage`
   resolve **per sample**, never per facility. A fit that misses is a withheld
   entry, not a softened threshold.

## Better absent than wrong

You may not ship a guess to make a finding go away. If the measurement will not
support a value, the entity goes in the withheld table with the reason. An honest
gap is a correct outcome; an invented height is a defect that outlives you.

You must never loosen a gate, delete a test, or widen a tolerance to make something
pass. If a gate is genuinely wrong, say so in FINDINGS and leave it standing.

## What to produce

- Fixes to the **builders**, not their output, wherever the root cause lives there.
- A **test that would have caught it** for every fix. This is what makes the next
  pass safe: later agents rewrite the same shared files, and your test is the only
  thing that stops them undoing you silently.
- An append to `gauntlet-loop/runs/@@STAMP@@/FINDINGS.md` covering what you fixed,
  what you withheld and why, and what you handed off to another shard.
- Real verification output pasted into your final message:
  `export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"; npm test` and
  `npm run check`. Both must pass before you commit.
- One commit, message in the project's style: what changed and why, not a task log.

For any candidate you **reject**, record it in FINDINGS with the reason. A rejected
candidate is a result — it stops the next pass from re-finding the same non-issue.

## Hard prohibitions

- **Never write `STATUS.md` or `REAUDIT.md`.** Those are the driver's bookkeeping
  and it appends your row itself, with the real duration and the real commit, the
  moment you exit. A previous agent wrote its own row: it invented a duration
  (`~25m`) it had no way to measure, and cited a commit SHA that stopped existing
  when it amended — so the run's own ledger pointed at nothing. `FINDINGS.md` is
  yours to append. The ledger is not.
- **No push. No deploy.** Shipping is Sahir's call, and a pre-push hook is armed
  against you for the duration of this run.
- No gate loosening, no test deletion, no tolerance widening.
- No fabricated numbers. Every figure in your commit traces to output you ran.

@@DEGRADED@@

## Measure with the shared rule. Never retype it.

`scripts/lib/roof-measure.mjs` exports `roofOf`, `explainRoof`, `percentile` and
`denseBandFraction`. **Import them.** If you write a probe, it starts with:

```js
import { explainRoof } from "../../scripts/lib/roof-measure.mjs";
```

This is not style. On 2026-08-05 an audit of `.cache/` found **37 hand-written
copies of `roofOf` and 25 of them were missing a rule** — every one carried the
canopy guard and dropped the thin-shelf branch, the rule that reads a narrow
spike over a dense flat roof as mechanical plant rather than building. One of
those probes opens by claiming "same roofOf tree-guard as build-campus-lidar.mjs".
It is not. Nine heights were pinned as overrides on the strength of that comment
before anyone checked, and `osm:453` shipped 3.7 m too tall for a day.

The bias runs one way: a two-rule probe reports the top of the HVAC as the roof,
so **every height it produces is too tall**. Pass `base` — without it the
thin-shelf rule cannot evaluate and you silently get the old wrong answer.
`explainRoof` tells you which rule fired and why; quote it in FINDINGS instead of
a bare number.

## The unnamed backlog is now retired by RULE, not one at a time

`statisticallyAdmissible` in `build-campus-lidar.mjs` admits any unnamed ring that
reads as one plane (>=400 pts, rim coverage >=0.99, spread <=1.2 m, height >=3 m).
That took the backlog from 777 rings on invented heights to 446. Do not hand-add
rings that the gate would already take — rebuild and look first.

`OSM_WITHHELD` is the set of rings a judge looked at and refused. **The gate never
overrules it and neither do you** without new evidence stated in FINDINGS. If you
believe a withheld ring should ship, say why, with imagery.

## What is actually left, and where the value is

Of the 446 unnamed rings still on guesses:

- **280 fail only on spread** (>1.2 m between body and top). These are the stepped
  and multi-plane roofs, and they are the real work — a photograph resolves in
  seconds what the point cloud cannot: is this one building with a tall parapet,
  or two levels? **This is the highest-value target on the campus.**
- 66 fall under 400 returns — sparse, small, treat with suspicion.
- 17 sit past the survey box (rim coverage <0.99). The 2014 flight cannot answer
  these. Leave them.
- 5 measure under 3 m, which usually means the laser saw the site before the
  building. Epoch, not height.

Prefer the 280. A ring you correctly resolve into its real levels changes what a
person sees walking past it; a 0.1 m refinement does not.
