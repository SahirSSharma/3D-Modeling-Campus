# Gauntlet routed run 2026-08-04_235219

- screen: `cursor-grok-4.5-high` (Cursor Models pool)
- judge:  `claude-fable-5-thinking-max` (Other Models pool, budget 85M)
- shards: 3 (r2c1 r2c0 r2c2)
- push/deploy: BLOCKED for the duration of this run

| pass | shard | tier | screen | high/med/low | judge | commit | duration |
|---|---|---|---|---|---|---|---|
| 1 | r2c1 | 1 | cursor-grok-4.5-high | 5/5/1 | claude-fable-5-thinking-max | 7c3872f | 83m53s |
| 1 | r2c0 | 1 | cursor-grok-4.5-high | 5/4/1 | claude-fable-5-thinking-max | 08482f5 | 118m34s |
| 1 | r2c2 | 3 | cursor-grok-4.5-high | 6/8/1 | cursor-grok-4.5-high | 744e49d | 24m18s |

**Pass 1 produced 4 commit(s). Fable spent ~80M, 6% of budget left.**


Run finished 03:39:05.

**1 shard(s) were judged without Fable — see `REAUDIT.md`.**
A clean pass here is weaker evidence than a clean pass at tier 1.
