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

## RESOLVED: targeted EPT probe vs full campus build disagreed by metres (2026-08-05)

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

### Resolved same day — the probes were wrong, and the builder was right

Every agent wrote its own probe script rather than importing the measurement
rule. An audit of `.cache/` found **37 hand-written copies of `roofOf`, and 25 of
them implement only TWO of its three rules** — they carry the canopy guard and
omit the thin-shelf branch, the rule that recognises a narrow spike over a dense
flat roof as mechanical plant rather than building.

`osm:453` closes it exactly. Probe's own recorded stats: p50 16.1, p75 16.2,
p98 19.9.

- canopy guard wants a p98-p75 gap > 5 m and sees 3.7 — does not fire
- thin-shelf gate wants p75-p50 <= 2 (it is 0.1) and p98-p75 > 2 (it is 3.7) — **fires**
- probe, blind to that branch, returns p98 = **19.9**; builder returns p75 = **16.2**

3.7 m, with nothing left unexplained.

The bias has one direction: a two-rule probe reports the top of the mechanical
spike, so **every probe-verified height is too tall**. One probe file even opens
by claiming "same roofOf tree-guard as build-campus-lidar.mjs" — it is not, and
that false comment is what the nine osm overrides were pinned on.

**Actions taken:**
- Nine osm overrides (453, 518, 522, 526, 532, 534, 657, 1147, 1373) **withdrawn**;
  those rings now take the builder's measurement. `osm:453` drops 19.9 -> 16.2.
- Three overrides stand: `Union Bank`, `m:1069,-637` (CSC-D), `m:1078,-476` (CES).
  Each rests on Apple imagery showing real plant on a roof that sits just under
  the density cut — evidence the laser cannot supply and no probe rule affects.
- `scripts/lib/roof-measure.mjs` is now the single definition, imported by the
  builder. Byte-identical output confirms the extraction was faithful.
- `tests/roof-measure.test.mjs` pins all three branches, including a test that
  pins the failure mode itself: called without a base, the thin-shelf rule cannot
  fire and returns the shelf.

**Exposure is narrower than it first looked, and it is worth being precise.**
The probes never wrote heights into the campus. `OSM_UNNAMED_VERIFIED` is a set
of ring INDICES; the height itself is always computed by the builder at
`build-campus-lidar.mjs:1596` — `roofOf(t.roofs, base)`, all three rules. So all
286 shipped `osmHeights` are three-rule measurements today, and `npm run check`
proves it: the file reproduces with only the three Apple-evidence overrides.

What a two-rule probe could corrupt is the ADMISSION decision — an agent reading
a ring as "one clean plane, safe to admit" on two-rule reasoning, where the third
rule would have shown a thin shelf and argued for withholding. That ships a
building at its correct measured body height but inside a set it may not belong
in. Much less severe than a wrong height, and not visible on the campus.

**Still open:** the 25 stale probe copies in `.cache/` are scratch files from
finished shards, left as-is. Any future probe must import
`scripts/lib/roof-measure.mjs`.
