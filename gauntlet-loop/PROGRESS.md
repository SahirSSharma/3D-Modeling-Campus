# Gauntlet progress

_Generated 8/5/2026, 01:18:34 — refreshes every 30 min while the driver is up._

**Driver:** 🟢 running   ·   **Run:** `2026-08-04_235219`   ·   **HEAD:** `7c3872f` (21 commits ahead of `origin/main`, unpushed)   ·   **Push guard:** 🔒 armed

## Pass 1 — every shard swept once

```
shards  █████████████████████▊······  78%   7/9
work    █████████████████████·······  75%   1048/1395 buildings
```

Remaining: `r2c0` (182), `r2c2` (165) — **3h03m** at the fitted rate.

## Now

```
pass 1  shard r2c0 (182 buildings)
elapsed ▋···························  3%   2m of ~1h31m est
```

- phase: **screening (Grok, Cursor Models pool)** — 2m in this phase
- shard started 01:16:14

## Budget

```
Other Models  ███████████████████·········  68%   68% used AS OF THE LAST READING, ~119M left of 373M
run budget    ██████████▍·················  37%   63% of the 190M run budget still available
```

- routing tier: **1 — full Fable judging**
- a Fable adjudication measures **~30–45M** (1 completed between readings, 45M spent) — the router was configured for **6M**, so its own odometer is low by roughly **7×**
- the router is charging itself **40M** per adjudication, which is inside that measured range — so its cap is honest even though nobody is reading the dashboard
- the router is governing off its **odometer**, not the pool: 1 Fable adjudication made against a **85M** cap, ~45M of that cap left (53%)
- ~**1** Fable adjudication left; tier 2 in **0**, tier 3 in **0**
- Grok screening bills the **Cursor Models** pool, which is effectively free at this scale — the bar above is only the expensive half.

- ⚠️ **the reading above is stale and the router is NOT using it.** It is parked at `.quota.paused` so a number frozen overnight could not hold tier 1 while nobody was checking the dashboard. Routing is running off the odometer, hard-capped at ~2 Fable adjudications.

Hand control back to the dashboard by writing a fresh percentage into `gauntlet-loop/.quota` — a real reading beats the odometer, and the router picks it up on the next shard without a restart.

## Remaining work

The driver runs the pass-1 tail, then `--until-clean --max-passes 3`. A clean sweep is one that changes nothing, so the true end is not knowable in advance — only bounded:

| outcome | what happens | remaining | done by |
|---|---|---|---|
| **best** | pass-1 tail, then one sweep changes nothing | 16h57m | Wed 18:15 |
| **likely** | pass-1 tail, one fixing sweep, one clean sweep | 30h50m | Thu 08:08 |
| **worst** | pass-1 tail, then all 3 passes, never converges | 44h43m | Thu 22:01 |

One full 9-shard sweep is **13h53m** at the fitted rate.

## What landed

21 commits ahead of `origin/main`, none pushed:

- `7c3872f` 01:15 — Gauntlet r2c1 judged: the theatre district splits into its real buildings and two groves stop being architecture
- `550448f` 23:50 — Gauntlet r1c2 judged: duplicate names stop racing for one key, renames stop stealing, and the health campus gets measured
- `287d683` 23:44 — Make the overnight run safe to leave alone
- `b48e9a6` 23:39 — Put the 400-building shard in front of the remaining Fable budget
- `cd65656` 23:36 — Measure what a Fable adjudication costs instead of trusting the 6M guess
- `1147a4a` 21:57 — Gauntlet r1c1 judged: the tank gets its 27 metres, Solis sheds its eucalyptus, and twins stop rendering twice
- `6725db3` 21:34 — Show gauntlet progress in one file instead of four scattered ones
- `35e249b` 20:45 — Gauntlet r1c0: La Jolla Farms gets measured, and a survey-box typo stops eating measurements
- `7e30ebb` 20:24 — Route the gauntlet by job: Grok screens, Fable judges
- `d72a423` 18:53 — Gauntlet r0c2 addendum: the Preuss pitch is a logged absence, and the second screen found nothing else
- `03b21dc` 18:51 — Gauntlet r0c2: the nameless east campus gets measured, and Prebys gets its 47 metres
- `fc19dde` 18:28 — Add a sourced college affiliation layer
- `4bdea84` 18:10 — An affiliation ledger, and a gap left visible
- `665127c` 18:07 — Eighth College is Sankofa's five, not Marshall's four
- `1cb3258` 18:03 — Gauntlet r0c1: union outlines split into their measured buildings, and the demolished RIMAC Annex stops rendering
- `9ea8a59` 17:09 — Gauntlet r0c0: the Salk gets its name back, and GIS masses without hosts get measured
- `c622107` 16:31 — Judge the campus from a person's eye, on a panel that can disagree
- `5878277` 16:16 — Gauntlet driver: stop on a clean pass, not on a counter
- `87df990` 15:17 — Gauntlet r1c1: every mass measures its own roof, and the epoch table learns eight more names
- `5fd6586` 14:14 — Run the gauntlet on Cursor: shard the campus, ban the deploy
- `d3ba85b` 14:08 — Gauntlet loop: Apple decides what is there, LiDAR decides how tall

## Per-shard

| shard | buildings | pass 1 | tier | screen h/m/l | judge | commit | actual | fitted |
|---|---:|---|---|---|---|---|---:|---:|
| `r0c0` | 103 | done · 161701 run | — | — | `claude-fable-5-thinking-max` | — | 53m | 1h35m |
| `r0c1` | 84 | done · 161701 run | — | — | `claude-fable-5-thinking-max` | — | 54m | 1h36m |
| `r0c2` | 62 | done · 161701 run | — | — | `claude-fable-5-thinking-max` | — | 51m | 1h38m |
| `r1c0` | 140 | done · 161701 run | — | — | `claude-fable-5-thinking-max` | — | 1h52m | 1h33m |
| `r1c1` | 162 | done · 204721 run | 1 | 3/8/1 | `claude-fable-5-thinking-max` | `1147a4a` | 1h11m | 1h32m |
| `r1c2` | 97 | done · 204721 run | 1 | 3/10/4 | `claude-fable-5-thinking-max` | `550448f` | 1h53m | 1h36m |
| `r2c0` | 182 | **screen** (re-sweep) | — | — | — | — | — | 1h31m |
| `r2c1` | 400 | done | 1 | 5/5/1 | `claude-fable-5-thinking-max` | `7c3872f` | 1h24m | 1h19m |
| `r2c2` | 165 | queued | — | — | — | — | — | 1h32m |

## How these numbers were made

Duration is fitted against building count, least squares over **3 finished shards** from routed (screen+judge) shards:

```
minutes ≈ 101.0 + -0.054 × buildings
typical miss: ±16 min
```

⚠️ 3 samples is a thin fit. Treat the ETAs as an order of magnitude, not a schedule — they tighten with every shard that lands.

Everything above is read from files the driver already writes — `STATUS.md`, `shards.json`, `route-driver.log`, prompt-file mtimes, `.quota`, and `git`. Nothing here is a claim the driver did not make. Where a value could not be derived it shows `—` rather than a guess.
