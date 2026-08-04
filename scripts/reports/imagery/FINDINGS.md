# Is Apple's satellite imagery worth swapping to?

Asked 2026-08-03, because Apple Maps' satellite view *looks* clearly sharper over this campus
than what the chunks under `docs/data/textures/` were built from. This is the measurement.

No Apple credential existed at the time, so the Apple side is a capture of Apple Maps on the
web (`maps.apple.com/frame?map=satellite&z=20`) over John Muir's tennis block, and the Google
side is the shipped chunk for the same ground. Apple imagery is **not** committed to this repo;
only the numbers derived from it are.

## Calibration

The Apple capture's scale is not assumed — it is ruled by the court itself. Detected white-line
positions gave three independent readings that agree:

| measured span | regulation | m/px |
|---|---|---|
| doubles sideline to doubles sideline | 10.97 m | 0.1261 |
| singles sideline to singles sideline | 8.23 m | 0.1266 |
| singles sideline to centre service line | 4.115 m | 0.1247 |

Service lines fell exactly 6.40 m either side of the net midpoint, as they must. **0.126 m/px** —
which happens to be within 1% of the shipped Google chunks' 0.125 m/px, so the two compare
like for like with no rescaling of either.

## Result

Same 58 x 53 m of ground, both sides contrast-normalised so the metric measures geometry
rather than how punchy each renderer's tone curve is:

| source | m/px | grad/m | **resolved edge detail** |
|---|---|---|---|
| Google (shipped chunks) | 0.125 | 100.3 | **0.25 m** |
| Apple Maps web | 0.126 | 75.7 | **0.378 m** |

**Apple is softer over this ground, not sharper** — by half again. The impression that it looks
clearer is its rendering, not more resolved ground.

### The metric earns its verdict

Upsampling the Google crop 2x with Lanczos, to 0.0625 m/px, moved the edge measurement not at
all — still 0.25 m — while `grad/m` *rose* 1.28x on ringing alone. So `edgeRiseM` measures
detail that is really there and `gradPerM` is the softer of the two: quote the edge number.

## The finding that did survive: epoch, not resolution

The Muir west tennis block is **resurfaced blue with pickleball courts painted over it** in
Apple's imagery, and still **green-on-red** in the Google imagery this project measured its
colours from — imagery fetched 2026-08-03, so Google's current state, not a stale cache.
Courts do not get un-pickleballed, so Apple's capture is the newer of the two and
`campus-truecolor.json` is carrying a retired paint scheme for that block.

That is a real accuracy gap, and it is worth noting that it argues for Apple on **currency**
while the measurement argues against it on **resolution**. The two are separate questions and
this project has always treated them separately (see the epoch rule in the README).

## The zoom test, which settles it

A third capture, this time zoomed to a single court. Its scale is ruled the same way and the
two readings agree exactly: doubles sidelines 88 px for 10.97 m, baselines 190 px for 23.77 m
— **0.125 m/px**. That is the same scale as the wide capture. Apple's web viewer did not go
finer when asked to; the court simply fills more of the frame.

| source | m/px | grad/m | resolved edge detail |
|---|---|---|---|
| Google (shipped chunks) | 0.125 | 82.6 | 0.25 m |
| Apple, maximum zoom | 0.125 | 86.9 | **0.25 m** |

A dead heat — 1.00x the edge resolution, 1.05x the detail per metre.

## Verdict

Across three captures Apple never resolved more ground than Google once: equal on the clean
court, worse on the west block. Apple's imagery over this campus tops out where Google already
is, and the impression of clarity is its rendering. **A source swap buys no accuracy, and the
Apple Developer Program membership it would require does not pay for itself on sharpness.**

The provider layer stays regardless: it cost nothing to keep, it is the only reason this
question could be answered with numbers rather than opinion, and it makes the next candidate
source a flag rather than a rewrite.

## What is still open, and it is not resolution

`campus-truecolor.json` carries a retired paint scheme for the Muir west tennis block. Neither
source fixes that by being sharper — it needs a *current* capture of that block, which is an
epoch problem and belongs with the epoch rule in the README, not with this comparison.

Reproduce with:

```bash
npm run audit:imagery -- --facility=muir-tennis-west
npm run audit:imagery -- --facility=muir-tennis-west --compare=<image> --width-m=<ground width>
```
