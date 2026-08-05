# Gauntlet progress

_Generated 8/5/2026, 04:25:23 — refreshes every 30 min while the driver is up._

**Driver:** 🟢 running   ·   **Run:** `2026-08-05_033905`   ·   **HEAD:** `3166d5c` (27 commits ahead of `origin/main`, unpushed)   ·   **Push guard:** 🔒 armed

## Pass 1 — every shard swept once

```
shards  ████████████████████████████  100%   9/9
work    ████████████████████████████  100%   1395/1395 buildings
```

**Every shard swept.** The loop is now re-sweeping until a pass changes nothing — currently back on `r0c2`.

## Now

```
pass 1  shard r0c2 (62 buildings)
elapsed ▊···························  3%   2m of ~52m est
```

- phase: **screening (Grok, Cursor Models pool)** — 2m in this phase
- shard started 04:23:49

## Budget

```
Other Models  ███████████████████·········  68%   68% used AS OF THE LAST READING, ~119M left of 373M
run budget    ██████████▍·················  37%   63% of the 190M run budget still available
```

- 🟢 **this phase cannot spend the Other Models pool at all.** It runs with `cursor-grok-4.5-high` as the judge, so no Fable call is reachable at any tier — the sweeps are free. Its budget line still reads 190M; that number is inert.
- every shard judged this way is filed in `REAUDIT.md` automatically, because the router already treats judge==screener as degraded.
- a Fable adjudication measures **~30–45M** (1 completed between readings, 45M spent) — the router was configured for **6M**, so its own odometer is low by roughly **7×**
- Grok screening bills the **Cursor Models** pool, which is effectively free at this scale — the bar above is only the expensive half.

- ⚠️ **the reading above is stale.** It was parked at `.quota.paused` overnight so a frozen number could not hold tier 1 while nobody was checking the dashboard. The Fable cap has since been spent in full and the loop has moved to free sweeps, so nothing is drawing on the pool now.
- 🔴 **your real usage is well above 68%.** 3 Fable adjudications finished after that reading, charged at 40M each — putting you around **89–100%** of the Other Models pool. **Check the dashboard before running the 4-model panel**, which spends the same pool.

Hand control back to the dashboard by writing a fresh percentage into `gauntlet-loop/.quota` — a real reading beats the odometer, and the router picks it up on the next shard without a restart.

## Remaining work

The driver runs the pass-1 tail, then `--until-clean --max-passes 3`. A clean sweep is one that changes nothing, so the true end is not knowable in advance — only bounded:

| outcome | what happens | remaining | done by |
|---|---|---|---|
| **best** | pass-1 tail, then one sweep changes nothing | 9h29m | Wed 13:54 |
| **likely** | pass-1 tail, one fixing sweep, one clean sweep | 18h57m | Wed 23:22 |
| **worst** | pass-1 tail, then all 3 passes, never converges | 28h26m | Thu 08:51 |

One full 9-shard sweep is **9h29m** at the fitted rate.

## What landed

27 commits ahead of `origin/main`, none pushed:

- `3166d5c` 04:23 — Gauntlet r0c1 re-sweep: Asante's meeting rooms shed a thin shelf the 5 m guard missed
- `144e487` 04:00 — Gauntlet r0c0 re-sweep: six unnamed NW roofs get measured, and Marshall Res V sheds its L3 default
- `a604d6a` 03:42 — Report coverage, free sweeps, and quota drift honestly once pass 1 finished
- `744e49d` 03:38 — Gauntlet r2c2 judged: the Hyatt stops pasting its tower onto the podium, and seven east-of-I-5 roofs get measured
- `08482f5` 03:13 — Gauntlet r2c0 judged: buildings on the survey's west edge get whole-ring heights and the rebuilt Scripps shore leaves 2014
- `3bbaba1` 01:18 — Report the budget the router is actually using, not the pool it stopped reading
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

**2 shards judged without Fable** — these carry less judgement than the rest and should be re-audited first:

- pass 1 `r0c0` — judged by `cursor-grok-4.5-high` (tier 1, 4/5/0)
- pass 1 `r0c1` — judged by `cursor-grok-4.5-high` (tier 1, 1/4/2)

## ⚠️ Ledger integrity

**1 row not written by the driver.** The duration column does not match the driver's format, which means an agent edited the ledger it was told not to touch. Not parsed, not counted, not fed to the fit:

- `2026-08-05_033905` — `| 1 | r0c0 | 3 | cursor-grok-4.5-high | 4/5/0 | cursor-grok-4.5-high | dd7caa8 | ~25m |`

## Per-shard

| shard | buildings | pass 1 | tier | screen h/m/l | judge | commit | actual | fitted |
|---|---:|---|---|---|---|---|---:|---:|
| `r0c0` | 103 | done | 1 | 4/5/0 | `cursor-grok-4.5-high` | `144e487` | 22m | 57m |
| `r0c1` | 84 | done | 1 | 1/4/2 | `cursor-grok-4.5-high` | `3166d5c` | 22m | 55m |
| `r0c2` | 62 | **screen** (re-sweep) | — | — | `claude-fable-5-thinking-max` | — | 51m | 52m |
| `r1c0` | 140 | done · 161701 run | — | — | `claude-fable-5-thinking-max` | — | 1h52m | 1h01m |
| `r1c1` | 162 | done · 204721 run | 1 | 3/8/1 | `claude-fable-5-thinking-max` | `1147a4a` | 1h11m | 1h04m |
| `r1c2` | 97 | done · 204721 run | 1 | 3/10/4 | `claude-fable-5-thinking-max` | `550448f` | 1h53m | 56m |
| `r2c0` | 182 | done · 235219 run | 1 | 5/4/1 | `claude-fable-5-thinking-max` | `08482f5` | 1h59m | 1h06m |
| `r2c1` | 400 | done · 235219 run | 1 | 5/5/1 | `claude-fable-5-thinking-max` | `7c3872f` | 1h24m | 1h32m |
| `r2c2` | 165 | done · 235219 run | 3 | 6/8/1 | `cursor-grok-4.5-high` | `744e49d` | 24m | 1h04m |

## How these numbers were made

Fitted over **7 finished shards** from routed (screen+judge) shards:

```
minutes ≈ 45.1 + 0.117 × buildings
typical miss: ±38 min
```


Everything above is read from files the driver already writes — `STATUS.md`, `shards.json`, `route-driver.log`, prompt-file mtimes, `.quota`, and `git`. Nothing here is a claim the driver did not make. Where a value could not be derived it shows `—` rather than a guess.
