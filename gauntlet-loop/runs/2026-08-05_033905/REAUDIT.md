# Shards judged without Fable

These were adjudicated by `cursor-grok-4.5-high` because the Fable budget ran out.
Their commits carry less judgement than the rest and should be re-audited first.

- pass 1 `r0c0` — judged by `cursor-grok-4.5-high` (tier 1, 4/5/0)
- pass 1 `r0c1` — judged by `cursor-grok-4.5-high` (tier 1, 1/4/2)
- pass 1 `r0c2` — judged by `cursor-grok-4.5-high` (tier 1, 0/6/3)
- pass 1 `r1c0` — judged by `cursor-grok-4.5-high` (tier 1, 3/6/1)
- pass 1 `r1c1` — judged by `cursor-grok-4.5-high` (tier 1, 3/15/1)
- pass 1 `r1c2` — judged by `cursor-grok-4.5-high` (tier 1, 4/6/3)
- pass 1 `r2c0` — judged by `cursor-grok-4.5-high` (tier 1, 3/8/0)
- pass 1 `r2c1` — judged by `cursor-grok-4.5-high` (tier 1, 3/5/1)
- pass 1 `r2c2` — judged by `cursor-grok-4.5-high` (tier 1, 6/9/1)
- pass 2 `r0c0` — judged by `cursor-grok-4.5-high` (tier 1, 4/6/0)
- pass 2 `r0c1` — judged by `cursor-grok-4.5-high` (tier 1, 0/5/0)
- pass 2 `r0c2` — judged by `cursor-grok-4.5-high` (tier 1, 0/4/1)
- pass 2 `r1c0` — judged by `cursor-grok-4.5-high` (tier 1, 1/4/2)
- pass 2 `r1c1` — judged by `cursor-grok-4.5-high` (tier 1, 2/6/1)
- pass 2 `r1c2` — judged by `cursor-grok-4.5-high` (tier 1, 1/5/4)
- pass 2 `r2c0` — judged by `cursor-grok-4.5-high` (tier 1, 3/6/1)
- pass 2 `r2c1` — judged by `cursor-grok-4.5-high` (tier 1, 5/7/1)
- pass 2 `r2c2` — judged by `cursor-grok-4.5-high` (tier 1, 7/3/1)
- pass 3 `r0c0` — judged by `cursor-grok-4.5-high` (tier 1, 2/3/0)
- pass 3 `r0c1` — judged by `cursor-grok-4.5-high` (tier 1, 1/0/0)
- pass 3 `r0c2` — judged by `cursor-grok-4.5-high` (tier 2, 1/0/0)
- pass 3 `r1c1` — judged by `cursor-grok-4.5-high` (tier 2, 1/1/0)
- pass 3 `r1c2` — judged by `cursor-grok-4.5-high` (tier 2, 0/3/2)
- pass 3 `r2c0` — judged by `cursor-grok-4.5-high` (tier 2, 1/2/0)
- pass 3 `r2c1` — judged by `cursor-grok-4.5-high` (tier 2, 7/2/0)
- pass 3 `r2c2` — judged by `cursor-grok-4.5-high` (tier 2, 8/1/1)

---

## OPEN: targeted EPT probe vs full campus build disagree by metres (2026-08-05)

Agents verified individual roofs with a **targeted EPT probe** and pinned the
result. A full `npm run build:lidar` resolves a different plane for ten of those
same rings off the same 2014 LiDAR — `osm:453` by **3.7 m** (probe 19.9, build
16.2), `osm:522` by 1.8 m, the Boardwalk connector strip 518/526/532/534 by
0.2–0.7 m, plus `Union Bank`, `m:1069,-637` (CSC-D) and `m:1078,-476` (CES).

This is **not** rounding — a 0.1 m rim-median knife edge is a separate, understood
class and was re-pinned to the reproducible value. Metres apart means the probe
and the build are reading the point cloud differently: different leaf depth,
different ring containment, or a different ground reference. Nobody has diagnosed
which is right.

All ten are pinned to the probe in `MEASURED_OVERRIDES` in
`scripts/build-campus-lidar.mjs`, each with its evidence, because the probe
looked at that roof specifically. That is a holding position, not an answer.

**Why it matters:** if the probe is right, the full build under-measures rings
campus-wide and the unnamed backlog will be admitted at wrong heights as it is
retired. If the build is right, ten shipped heights are wrong today. Either way
one of the two instruments this project measures with is miscalibrated, and the
gauntlet cannot tell which — every agent that has looked used the probe.

Diagnose before the next bulk admission pass.
