# Gauntlet routed run 2026-08-05_033905

- screen: `cursor-grok-4.5-high` (Cursor Models pool)
- judge:  `cursor-grok-4.5-high` (Other Models pool, budget 190M — Fable exhausted; free-sweep mode)
- shards: 9 (r0c0 r0c1 r0c2 r1c0 r1c1 r1c2 r2c0 r2c1 r2c2)
- push/deploy: BLOCKED for the duration of this run

| pass | shard | tier | screen | high/med/low | judge | commit | duration |
|---|---|---|---|---|---|---|---|
| 1 | r0c0 | 3 | cursor-grok-4.5-high | 4/5/0 | cursor-grok-4.5-high | dd7caa8 | ~25m |

**r0c0 re-sweep judged without Fable — see `REAUDIT.md`.**
| 1 | r0c0 | 1 | cursor-grok-4.5-high | 4/5/0 | cursor-grok-4.5-high | 144e487 | 22m22s |
