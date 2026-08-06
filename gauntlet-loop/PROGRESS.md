# Gauntlet progress

_Generated 8/5/2026, 20:30:03 — refreshes every 30 min while the driver is up._

**Driver:** 🟢 running   ·   **Run:** `2026-08-05_165434`   ·   **HEAD:** `cab3901` (75 commits ahead of `origin/main`, unpushed)   ·   **Push guard:** 🔒 armed

## Pass 1 — every shard swept once

```
shards  ████████████████████████████  100%   9/9
work    ████████████████████████████  100%   1395/1395 buildings
```

**Every shard swept.** The loop is now re-sweeping until a pass changes nothing — currently back on `r0c0`.

## Now

```
pass 2  shard r0c0 (103 buildings)
elapsed ████████████████▏···········  58%   14m of ~25m est
```

- phase: **judging (Fable, Other Models pool)** — 2m in this phase
- screen produced: 0 high · 4 medium · 1 low
- shard started 20:15:43

## Budget

```
Other Models  ████████████████████████▉···  89%   89% used, ~41M left of 373M
run budget    █████████████████████▉······  78%   22% of the 190M run budget still available
```

- 🟢 **this phase cannot spend the Other Models pool at all.** It runs with `cursor-grok-4.5-high` as the judge, so no Fable call is reachable at any tier — the sweeps are free. Its budget line still reads 190M; that number is inert.
- every shard judged this way is filed in `REAUDIT.md` automatically, because the router already treats judge==screener as degraded.
- a Fable adjudication measures **~27–31M** (4 completed between readings, 123M spent) — the router was configured for **6M**, so its own odometer is low by roughly **5×**
- that miscount does **not** affect routing: the router prefers the `.quota` reading over its estimate, so tier decisions are made on real numbers
- Grok screening bills the **Cursor Models** pool, which is effectively free at this scale — the bar above is only the expensive half.


Update it by writing the dashboard percentage into `gauntlet-loop/.quota`. A real reading always beats the router's own estimate.

## Remaining work

The driver runs the pass-1 tail, then `--until-clean --max-passes 3`. A clean sweep is one that changes nothing, so the true end is not knowable in advance — only bounded:

| outcome | what happens | remaining | done by |
|---|---|---|---|
| **best** | pass-1 tail, then one sweep changes nothing | 3h58m | Thu 00:28 |
| **likely** | pass-1 tail, one fixing sweep, one clean sweep | 7h56m | Thu 04:26 |
| **worst** | pass-1 tail, then all 3 passes, never converges | 11h54m | Thu 08:24 |

One full 9-shard sweep is **3h58m** at the fitted rate.

## What landed

75 commits ahead of `origin/main`, none pushed:

- `cab3901` 20:15 — Gauntlet r2c2 re-sweep: Sheraton osm:1364 takes its dense body; Mahaila 704/705 withheld.
- `5f3b415` 19:50 — Gauntlet r2c1 re-sweep: Union Bank sheds its thin shelf; Evening Way soft pads get measured
- `0bd0a09` 19:39 — A walk guide that names its own gaps
- `36a2c86` 19:30 — Bound the table-agree branch by what is actually on screen
- `f0f6ce6` 19:27 — Remove Birch Aquarium apron box; stop readiness inventing Hubbs as a guess.
- `3767653` 19:20 — Draw the footprint on the photograph, so a ring can actually be judged
- `cf1ae79` 19:07 — Look at the six Marshall rings, and withhold them on the evidence
- `516760c` 19:02 — Gauntlet r1c2 re-sweep: Mobile PET pad leaves the world, Mesa bleed stays withheld
- `0c435e6` 18:53 — The census could not see the masses that actually render
- `6187304` 18:45 — Redefine the walk gate around what a walker actually meets
- `96c1f29` 18:39 — Gauntlet r1c1 re-sweep: hostless Student Center wings + ICW name sync
- `8ce0818` 18:30 — Measure why 356 rings are still guesses, and list the ones a photo can settle
- `fb235db` 18:16 — Gauntlet r1c0 re-sweep: HDH Admin keeps its measured upper plane
- `f3be9d6` 18:01 — Gauntlet r0c2 re-sweep: CSC-D and CES shed thin shelves the override reversed
- `dfcbcf8` 17:42 — Gauntlet r0c1 re-sweep: roofs anchor at the rim, not the centroid
- `a500bf7` 17:24 — Put the handover gate on the road to ship, with an expiry
- `f30a596` 17:22 — Gate the handover on what a walker would actually see
- `229a032` 17:22 — Gauntlet r0c0 re-sweep: Black Gold gabled house sheds its 4.5 under-guess
- `e9d9fe8` 16:52 — Point the loop at the 280 stepped roofs, and require the shared measurement rule
- `e041e86` 16:49 — Retire 331 unnamed buildings from guesses to measurements, by rule
- `c841df2` 16:27 — One definition of how tall a roof is, and withdraw nine overrides pinned on a false premise
- `50a0b28` 12:48 — Make campus-lidar.json reproduce from its builder, and gate it so it stays that way
- `c650d53` 11:39 — Gauntlet r2c2 pass-3: Nobel/Lebon residual, Lebon-south, Sheraton-strip, UCL courtyard
- `1e2339d` 11:20 — Gauntlet r2c1 pass-3: Villa La Jolla east / Residence Inn residual / Scenic over-guesses
- `400d2b1` 11:00 — Gauntlet r2c0 pass-3: Poole Street osm:1105 sheds its 4.5 under-guess
- `a4bbe20` 10:44 — Gauntlet r1c2 pass-3: Preuss D/E join the measured classroom plane; pin Street Corner and Warren Field House as post-2014
- `8ab78c5` 10:25 — Gauntlet r1c1 pass-3: drop co-named GIS micro-slivers at Bonner and Student Center B
- `350b5cc` 09:56 — Gauntlet r0c2 pass-3: reanchor suppressed-outline place pins onto rendered masses
- `221a675` 09:38 — Gauntlet r0c1 pass-3: Geneva Hall outline yields to its measured wings
- `9fdf103` 09:37 — Allow a reduced panel, and make every artifact say it is one
- `0835f05` 09:18 — Gauntlet r0c0 pass-3: three LJF / Black Gold unnamed pads get measured
- `1bd0b61` 09:07 — Gauntlet r2c2 pass-2: LJVD terraces and Lebon pads shed their under-tags
- `6df4b76` 08:46 — Gauntlet r2c1 pass-2: Boardwalk / Villa La Jolla under-tags get measured
- `765623a` 08:29 — Gauntlet r2c0 pass-2: admit Poole Street and Bordeaux unnamed planes
- `85ba663` 08:10 — Gauntlet r1c2 pass-2: drop Foodworx patio twin, epoch-list Triton Ballpark, admit two hostless pads
- `495f5ea` 07:53 — Gauntlet r1c1 pass-2: drop PCWest nested L1 plaza pads and two false buildings
- `140d832` 07:31 — Gauntlet r1c0 pass-2: pin LJF residual withholds — none clear the thin-shelf cut
- `f263f6e` 07:15 — Gauntlet r0c2 pass-2: CSC Building C sheds the thin shelf the rule already caught
- `1fb6b59` 07:03 — Gauntlet r0c1 pass-2: Village East #6 sheds the thin shelf the rule already caught
- `04fb830` 06:47 — Gauntlet r0c0 pass-2: nine LJF / Estancia unnamed pads shed their 9 m guesses
- `9eaf041` 06:32 — Gauntlet r2c2 re-sweep: eight Sheraton-strip / Temple-corridor pads get measured
- `4c9bccf` 06:18 — Gauntlet r2c1 re-sweep: three Village Square pads shed their under-tags
- `05f2c37` 06:05 — Gauntlet r2c0 re-sweep: five Shores pads shed their 9 m area guesses
- `e401a1e` 05:42 — Gauntlet r1c2 re-sweep: case-twin One Miramar doubles collapse, and Nuevo East joins the epoch list
- `0c5cc0c` 05:20 — Gauntlet r1c1 re-sweep: three phantom pads leave the world, and two cooling bays get measured
- `b75034f` 04:59 — Gauntlet r1c0 re-sweep: Tenaya sheds its mechanical paste, and three LJF roofs get measured
- `7c2c046` 04:39 — Gauntlet r0c2 re-sweep: CSC Building H sheds a thin shelf the 2.5 m cut missed
- `c193be0` 04:25 — Stop agents writing the driver's ledger, and detect it when they do
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

**10 shards judged without Fable** — these carry less judgement than the rest and should be re-audited first:

- pass 1 `r0c0` — judged by `cursor-grok-4.5-high` (tier 2, 2/4/0)
- pass 1 `r0c1` — judged by `cursor-grok-4.5-high` (tier 2, 2/2/1)
- pass 1 `r0c2` — judged by `cursor-grok-4.5-high` (tier 2, 0/5/1)
- pass 1 `r1c0` — judged by `cursor-grok-4.5-high` (tier 2, 0/1/0)
- pass 1 `r1c1` — judged by `cursor-grok-4.5-high` (tier 2, 1/3/0)
- pass 1 `r1c2` — judged by `cursor-grok-4.5-high` (tier 2, 0/2/2)
- pass 1 `r2c0` — judged by `cursor-grok-4.5-high` (tier 2, 0/6/1)
- pass 1 `r2c1` — judged by `cursor-grok-4.5-high` (tier 2, 5/6/1)
- pass 1 `r2c2` — judged by `cursor-grok-4.5-high` (tier 2, 3/6/1)
- pass 2 `r0c0` — judged by `cursor-grok-4.5-high` (tier 2, 0/4/1)

## ⚠️ Ledger integrity

**1 row not written by the driver.** The duration column does not match the driver's format, which means an agent edited the ledger it was told not to touch. Not parsed, not counted, not fed to the fit:

- `2026-08-05_033905` — `| 1 | r0c0 | 3 | cursor-grok-4.5-high | 4/5/0 | cursor-grok-4.5-high | dd7caa8 | ~25m |`

## Road to ship

| | milestone | where it stands |
|---|---|---|
| ✅ | Data reproduces from its builders | `npm run check` rebuilds and compares; drift exits 1. Judgements the measurement cannot make live in `MEASURED_OVERRIDES` with their evidence. |
| ⬜ | Campus footprint measured, not guessed | **99.09% of the footprint inside the campus boundary is measured.** 27 unnamed ring(s) still render at a guess, 5,834 m² — mostly sheds and kiosks the 2014 flight cannot resolve (under canopy, too few returns, or past the survey edge), each refused for a recorded reason. Rings outside the boundary are city, not campus, and are excluded on purpose. Measured 0 min ago. |
| ⬜ | A gauntlet pass finds nothing | pass 1 closed with **55 finding(s)** across 9/9 shards. Two mechanisms guarantee a non-empty pass: the curated epoch name-lists and the unnamed backlog above are both retired one building at a time. |
| 🔸 | Independent panel passes (4 families) | not run |
| ⬜ | Readiness gate passes (handover to Sahir) | blocked on named buildings on a guess (1 of 322); ON-CAMPUS unnamed rings on a guess (27 (+323 off campus)) — measured 0 min ago |
| ⬜ | Sahir walks it on localhost and signs off | the campus is judged by eye, at eye level — no gate substitutes for this. `npm run serve` once the row above is ✅. |
| ⬜ | Ship to production | **his call alone.** Push guard armed; nothing is deployed without an explicit OK. |

**1 of 7 clear.** ✅ met · ⬜ not met · 🔸 could not be determined.

Ship requires **both** a clean pass and a panel pass — a clean loop with a failing panel is not a ship, and neither is the reverse.

## Per-shard

| shard | buildings | pass 1 | tier | screen h/m/l | judge | commit | actual | fitted |
|---|---:|---|---|---|---|---|---:|---:|
| `r0c0` | 103 | **judge** (re-sweep) | 2 | 2/4/0 | `cursor-grok-4.5-high` | `229a032` | 28m | 25m |
| `r0c1` | 84 | done | 2 | 2/2/1 | `cursor-grok-4.5-high` | `dfcbcf8` | 22m | 24m |
| `r0c2` | 62 | done | 2 | 0/5/1 | `cursor-grok-4.5-high` | `f3be9d6` | 17m | 23m |
| `r1c0` | 140 | done | 2 | 0/1/0 | `cursor-grok-4.5-high` | `fb235db` | 14m | 26m |
| `r1c1` | 162 | done | 2 | 1/3/0 | `cursor-grok-4.5-high` | `96c1f29` | 23m | 27m |
| `r1c2` | 97 | done | 2 | 0/2/2 | `cursor-grok-4.5-high` | `516760c` | 23m | 25m |
| `r2c0` | 182 | done | 2 | 0/6/1 | `cursor-grok-4.5-high` | `f0f6ce6` | 25m | 27m |
| `r2c1` | 400 | done | 2 | 5/6/1 | `cursor-grok-4.5-high` | `5f3b415` | 23m | 34m |
| `r2c2` | 165 | done | 2 | 3/6/1 | `cursor-grok-4.5-high` | `cab3901` | 25m | 27m |

## How these numbers were made

Fitted over **41 finished shards** from routed (screen+judge) shards:

```
minutes ≈ 21.5 + 0.032 × buildings
typical miss: ±24 min
```


Everything above is read from files the driver already writes — `STATUS.md`, `shards.json`, `route-driver.log`, prompt-file mtimes, `.quota`, and `git`. Nothing here is a claim the driver did not make. Where a value could not be derived it shows `—` rather than a guess.
