# Gauntlet progress

_Generated 8/4/2026, 21:34:08 — refreshes every 30 min while the driver is up._

**Driver:** 🟢 running   ·   **Run:** `2026-08-04_204721`   ·   **HEAD:** `35e249b` (14 commits ahead of `origin/main`, unpushed)   ·   **Push guard:** 🔒 armed

## Pass 1 — every shard swept once

```
shards  ████████████▍···············  44%   4/9
work    ███████▊····················  28%   389/1395 buildings
```

Remaining: `r1c1` (162), `r1c2` (97), `r2c0` (182), `r2c1` (400), `r2c2` (165) — **8h03m** at the fitted rate.

## Now

```
pass 1  shard r1c1 (162 buildings)
elapsed ███████████████▋············  56%   47m of ~1h23m est
```

- phase: **judging (Fable, Other Models pool)** — 32m in this phase
- screen produced: 3 high · 8 medium · 1 low
- shard started 20:47:21

## Budget

```
Other Models  ███████████████▋············  56%   56% used, ~164M left of 373M
run budget    ███▊························  14%   86% of the 190M run budget still available
```

- routing tier: **1 — full Fable judging**
- ~**27** Fable adjudications left at the ~6M estimate
- Grok screening bills the **Cursor Models** pool, which is effectively free at this scale — the bar above is only the expensive half.

Update it by writing the dashboard percentage into `gauntlet-loop/.quota`. A real reading always beats the router's own estimate.

## Remaining work

The driver runs the pass-1 tail, then `--until-clean --max-passes 3`. A clean sweep is one that changes nothing, so the true end is not knowable in advance — only bounded:

| outcome | what happens | remaining | done by |
|---|---|---|---|
| **best** | pass-1 tail, then one sweep changes nothing | 20h12m | Wed 17:45 |
| **likely** | pass-1 tail, one fixing sweep, one clean sweep | 32h20m | Thu 05:54 |
| **worst** | pass-1 tail, then all 3 passes, never converges | 44h29m | Thu 18:03 |

One full 9-shard sweep is **12h09m** at the fitted rate.

## Per-shard

| shard | buildings | pass 1 | tier | screen h/m/l | judge | commit | actual | fitted |
|---|---:|---|---|---|---|---|---:|---:|
| `r0c0` | 103 | done · 161701 run | — | — | `claude-fable-5-thinking-max` | — | 53m | 1h03m |
| `r0c1` | 84 | done · 161701 run | — | — | `claude-fable-5-thinking-max` | — | 54m | 57m |
| `r0c2` | 62 | done · 161701 run | — | — | `claude-fable-5-thinking-max` | — | 51m | 50m |
| `r1c0` | 140 | done · 161701 run | — | — | `claude-fable-5-thinking-max` | — | 1h52m | 1h16m |
| `r1c1` | 162 | **judge** (re-sweep) | — | — | `claude-fable-5-thinking-max` | — | 1h01m | 1h23m |
| `r1c2` | 97 | queued | — | — | — | — | — | 1h01m |
| `r2c0` | 182 | queued | — | — | — | — | — | 1h30m |
| `r2c1` | 400 | queued | — | — | — | — | — | 2h44m |
| `r2c2` | 165 | queued | — | — | — | — | — | 1h24m |

## How these numbers were made

Duration is fitted against building count, least squares over **5 finished shards** from all shards, mixed single-agent and routed:

```
minutes ≈ 28.7 + 0.337 × buildings
typical miss: ±20 min
```

⚠️ 5 samples is a thin fit. Treat the ETAs as an order of magnitude, not a schedule — they tighten with every shard that lands.

Everything above is read from files the driver already writes — `STATUS.md`, `shards.json`, `route-driver.log`, prompt-file mtimes, `.quota`, and `git`. Nothing here is a claim the driver did not make. Where a value could not be derived it shows `—` rather than a guess.
