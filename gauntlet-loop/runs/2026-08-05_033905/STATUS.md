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
| 1 | r0c1 | 1 | cursor-grok-4.5-high | 1/4/2 | cursor-grok-4.5-high | 3166d5c | 22m22s |
| 1 | r0c2 | 1 | cursor-grok-4.5-high | 0/6/3 | cursor-grok-4.5-high | 7c2c046 | 15m21s |
| 1 | r1c0 | 1 | cursor-grok-4.5-high | 3/6/1 | cursor-grok-4.5-high | b75034f | 20m47s |
| 1 | r1c1 | 1 | cursor-grok-4.5-high | 3/15/1 | cursor-grok-4.5-high | 0c5cc0c | 20m23s |
| 1 | r1c2 | 1 | cursor-grok-4.5-high | 4/6/3 | cursor-grok-4.5-high | e401a1e | 22m13s |
| 1 | r2c0 | 1 | cursor-grok-4.5-high | 3/8/0 | cursor-grok-4.5-high | 05f2c37 | 22m49s |
| 1 | r2c1 | 1 | cursor-grok-4.5-high | 3/5/1 | cursor-grok-4.5-high | 4c9bccf | 13m33s |
| 1 | r2c2 | 1 | cursor-grok-4.5-high | 6/9/1 | cursor-grok-4.5-high | 9eaf041 | 13m56s |

**Pass 1 produced 11 commit(s). Fable spent ~54M, 72% of budget left.**

| 2 | r0c0 | 1 | cursor-grok-4.5-high | 4/6/0 | cursor-grok-4.5-high | 04fb830 | 14m19s |
| 2 | r0c1 | 1 | cursor-grok-4.5-high | 0/5/0 | cursor-grok-4.5-high | 1fb6b59 | 16m40s |
| 2 | r0c2 | 1 | cursor-grok-4.5-high | 0/4/1 | cursor-grok-4.5-high | f263f6e | 11m42s |
| 2 | r1c0 | 1 | cursor-grok-4.5-high | 1/4/2 | cursor-grok-4.5-high | 140d832 | 16m34s |
| 2 | r1c1 | 1 | cursor-grok-4.5-high | 2/6/1 | cursor-grok-4.5-high | 495f5ea | 22m01s |
| 2 | r1c2 | 1 | cursor-grok-4.5-high | 1/5/4 | cursor-grok-4.5-high | 85ba663 | 16m18s |
| 2 | r2c0 | 1 | cursor-grok-4.5-high | 3/6/1 | cursor-grok-4.5-high | 765623a | 19m22s |
| 2 | r2c1 | 1 | cursor-grok-4.5-high | 5/7/1 | cursor-grok-4.5-high | 6df4b76 | 16m38s |
| 2 | r2c2 | 1 | cursor-grok-4.5-high | 7/3/1 | cursor-grok-4.5-high | 1bd0b61 | 21m44s |

**Pass 2 produced 9 commit(s). Fable spent ~108M, 43% of budget left.**

| 3 | r0c0 | 1 | cursor-grok-4.5-high | 2/3/0 | cursor-grok-4.5-high | 0835f05 | 10m35s |
| 3 | r0c1 | 1 | cursor-grok-4.5-high | 1/0/0 | cursor-grok-4.5-high | 221a675 | 20m16s |
| 3 | r0c2 | 2 | cursor-grok-4.5-high | 1/0/0 | cursor-grok-4.5-high | 350b5cc | 17m36s |
| 3 | r1c0 | 2 | cursor-grok-4.5-high | 0/0/0 | cursor-grok-4.5-high | none | 8m55s |
| 3 | r1c1 | 2 | cursor-grok-4.5-high | 1/1/0 | cursor-grok-4.5-high | 8ab78c5 | 19m45s |
| 3 | r1c2 | 2 | cursor-grok-4.5-high | 0/3/2 | cursor-grok-4.5-high | a4bbe20 | 19m33s |
| 3 | r2c0 | 2 | cursor-grok-4.5-high | 1/2/0 | cursor-grok-4.5-high | 400d2b1 | 15m43s |
| 3 | r2c1 | 2 | cursor-grok-4.5-high | 7/2/0 | cursor-grok-4.5-high | 1e2339d | 20m23s |
| 3 | r2c2 | 2 | cursor-grok-4.5-high | 8/1/1 | cursor-grok-4.5-high | c650d53 | 18m42s |

**Pass 3 produced 9 commit(s). Fable spent ~156M, 22% of budget left.**


Run finished 11:39:37.

**26 shard(s) were judged without Fable — see `REAUDIT.md`.**
A clean pass here is weaker evidence than a clean pass at tier 1.
