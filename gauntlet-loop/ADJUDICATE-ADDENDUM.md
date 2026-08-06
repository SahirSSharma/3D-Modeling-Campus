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

## The handover gate now says NOT READY, and names why

`npm run readiness` (added 2026-08-05) is the check that decides whether this
campus is worth an hour of Sahir's attention. It counts, through the real render
path, how much of what a walker sees is measured. Run it before you finish.

**CORRECTION — an earlier version of this section listed EIGHT named buildings
on invented heights. That list was wrong, and the reason is worth reading.**

The census derived a mass's height by subtracting probed ground from probed
roof. The extruder was placing roofs at `centroid-ground + h` while the LiDAR
builder defines `h = roof − rimMedian`, so on any graded site the two bases
diverged and the census compared a drifted roof to a drifted base. Eckart
Building (15.6 m of grade across its own ring) came back at 11.7 m and matched
its 12 m OSM tag inside the 0.35 m slack — a GIS-surveyed 12.8 m building
reported as a guess. Price Center, rendered as several masses, returned a height
none of its masses had.

The r0c1 sweep fixed the extruder rather than the census — `roofElevation` in
`campus-massing.js` now anchors every mass at its rim median, exported so the
census and the epoch tests pin the same rule the extruder uses. Named buildings
recognised as measured went 214 → 249 on that change alone.

**Do not chase the old list of eight.** The real remainder is three:

```
osm:27   Hubbs Hall                           11.8 m
osm:76   Hyatt Regency La Jolla at Aventine   16.0 m
osm:167  International Center West             8.3 m
```

A label is a claim, so these outrank any unnamed ring: a person reading "Hubbs
Hall, 11.8 m" has been told a number that was invented. None is in
`POST_2014_SITES`. Re-derive each with `explainRoof` and a rim base — that list
is a claim like any other. A ring that genuinely cannot be measured goes in the
withheld table with its reason, and the gate's own count is never an argument
for shipping a guess. **Better absent than wrong outranks a green gate**: if the
honest answer is that three named buildings have no resolvable height, say so in
FINDINGS and leave the gate red.

**Also still open — 358 unnamed rings on guesses.** The 280 stepped roofs
described above are the bulk of these and remain the highest-value target.

**The buried mass is RESOLVED — do not re-open it.** `dfcbcf8` anchored every
mass at its rim median and floored it at the highest footprint ground; the
campus-wide buried count is now 0 of 1366. The floor was checked for scope
before being trusted: it engages on exactly ONE mass campus-wide (Eckart, lifted
~2 m), so it is a narrow trade for a bluff site the flat-slab model cannot
describe, not a silent re-elevation of the hillside campus.

Leave it alone unless you have new evidence. If you ever see that floor firing on
many masses at once, that is not a hillside — that is a footprint swallowing
terrain that is not its pad, and the ring is the bug.

The three named buildings above sit in `r1c1` (International Center West),
`r2c0` (Hubbs Hall) and `r2c2` (Hyatt Regency). Each is this pass's work for the
shard that owns it — do not reach outside your own bounds for them.

Do not edit the thresholds in `scripts/readiness.mjs`. They are pinned by
`tests/readiness-gates.test.mjs`, and moving one to turn the gate green is the
same offence as widening a fit tolerance.


## NEVER edit data to satisfy the readiness gate

`npm run readiness` appears in the driver log, which means its failures are
visible to you. That is useful and it is also a trap, and one shard already fell
into it.

`96c1f29` hand-pinned International Center West to 8.2 m, giving the reason
"Readiness named-guess cleared by matching the rendered plane." The underlying
observation was sound — the OSM host ring is oversized and its canopy-guard p75
of 6.7 is courtyard contamination — but the motivation was a number in an audit,
and the fix was an override added to the builder.

**The gate was wrong, not the data.** Its census compared the rendered height
against `heights[name]` and `osmHeights[i]` and never looked at `massHeights`.
Where the university's GIS massing covers a footprint the OSM ring is suppressed
and a GIS mass renders in its place, keyed by its own centroid — which is how 62
named buildings on this campus are drawn. International Center West renders from
mass `m:225,82` at a measured 8.2 m, four metres from the ring centroid. The
census could not see it, so it scored a measured building as an invented guess.

The census now reads `massHeights` too, and named buildings recognised as
measured went 249 → 280 on that change alone.

**What this means for you:**

- A readiness failure is a REPORT, never an instruction. If clearing it requires
  editing data rather than fixing a builder rule, the gate is probably wrong —
  say so in FINDINGS and leave it red. A red gate that is telling the truth is
  worth more than a green one that was argued into place.
- The ICW override now has no effect on the gate. It should stand or fall on the
  courtyard-contamination evidence alone. If that evidence holds, keep it and
  say so plainly without citing readiness; if it does not, withdraw it.
- Hand overrides went 3 → 1 earlier today because two of them were reversing the
  shared measurement rule. Adding them back to satisfy an audit undoes that.
