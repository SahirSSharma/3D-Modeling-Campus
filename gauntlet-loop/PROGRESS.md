# Gauntlet progress

_Generated 8/4/2026, 23:43:46 — refreshes every 30 min while the driver is up._

**Driver:** 🟢 running   ·   **Run:** `2026-08-04_204721`   ·   **HEAD:** `b48e9a6` (18 commits ahead of `origin/main`, unpushed)   ·   **Push guard:** 🔒 armed

## Pass 1 — every shard swept once

```
shards  ███████████████▌············  56%   5/9
work    ███████████·················  39%   551/1395 buildings
```

Remaining: `r1c2` (97), `r2c0` (182), `r2c1` (400), `r2c2` (165) — **6h09m** at the fitted rate.

## Now

```
pass 1  shard r1c2 (97 buildings)
elapsed ████████████████████████████  100%   1h46m of ~1h01m est
```

- phase: **judging (Fable, Other Models pool)** — 1h32m in this phase
- screen produced: 3 high · 10 medium · 4 low
- shard started 21:58:14

## Budget

```
Other Models  ███████████████████·········  68%   68% used, ~119M left of 373M
run budget    ██████████▍·················  37%   63% of the 190M run budget still available
```

- routing tier: **1 — full Fable judging**
- a Fable adjudication measures **~30–45M** (1 completed between readings, 45M spent) — the router was configured for **6M**, so its own odometer is low by roughly **7×**
- that miscount does **not** affect routing: the router prefers the `.quota` reading over its estimate, so tier decisions are made on real numbers
- ~**2** Fable adjudications left; tier 2 in **1**, tier 3 in **2**
- Grok screening bills the **Cursor Models** pool, which is effectively free at this scale — the bar above is only the expensive half.


Update it by writing the dashboard percentage into `gauntlet-loop/.quota`. A real reading always beats the router's own estimate.

## Remaining work

The driver runs the pass-1 tail, then `--until-clean --max-passes 3`. A clean sweep is one that changes nothing, so the true end is not knowable in advance — only bounded:

| outcome | what happens | remaining | done by |
|---|---|---|---|
| **best** | pass-1 tail, then one sweep changes nothing | 17h39m | Wed 17:22 |
| **likely** | pass-1 tail, one fixing sweep, one clean sweep | 29h10m | Thu 04:53 |
| **worst** | pass-1 tail, then all 3 passes, never converges | 40h40m | Thu 16:23 |

One full 9-shard sweep is **11h30m** at the fitted rate.

## What landed

18 commits ahead of `origin/main`, none pushed:

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
| `r0c0` | 103 | done · 161701 run | — | — | `claude-fable-5-thinking-max` | — | 53m | 1h02m |
| `r0c1` | 84 | done · 161701 run | — | — | `claude-fable-5-thinking-max` | — | 54m | 57m |
| `r0c2` | 62 | done · 161701 run | — | — | `claude-fable-5-thinking-max` | — | 51m | 51m |
| `r1c0` | 140 | done · 161701 run | — | — | `claude-fable-5-thinking-max` | — | 1h52m | 1h13m |
| `r1c1` | 162 | done | 1 | 3/8/1 | `claude-fable-5-thinking-max` | `1147a4a` | 1h11m | 1h19m |
| `r1c2` | 97 | **judge** (re-sweep) | — | — | — | — | — | 1h01m |
| `r2c0` | 182 | queued | — | — | — | — | — | 1h24m |
| `r2c1` | 400 | queued | — | — | — | — | — | 2h24m |
| `r2c2` | 165 | queued | — | — | — | — | — | 1h19m |

## How these numbers were made

Duration is fitted against building count, least squares over **6 finished shards** from all shards, mixed single-agent and routed:

```
minutes ≈ 33.9 + 0.276 × buildings
typical miss: ±18 min
```


Everything above is read from files the driver already writes — `STATUS.md`, `shards.json`, `route-driver.log`, prompt-file mtimes, `.quota`, and `git`. Nothing here is a claim the driver did not make. Where a value could not be derived it shows `—` rather than a guess.
