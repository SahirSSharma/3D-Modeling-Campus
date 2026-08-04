# Is Apple's satellite imagery worth swapping to?

Asked 2026-08-03, because Apple Maps' satellite view *looks* clearly sharper over this campus
than what the chunks under `docs/data/textures/` were built from. This is the measurement.

No Apple credential existed at the time, so the Apple side is a capture of Apple Maps on the
web (`maps.apple.com/frame?map=satellite&z=20`) over John Muir's tennis block, and the Google
side is the shipped chunk for the same ground. Apple imagery is **not** committed to this repo;
only the numbers derived from it are.

> **A credential exists as of 2026-08-04 and the question is now settled against the licensed
> service, not against a screen capture. Skip to [The answer, measured through the real
> API](#the-answer-measured-through-the-real-api-2026-08-04) — every section between here and
> there measures a delivery channel this project cannot actually buy.**

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

## The web viewer was capped — the Maps app is not (2026-08-03, later)

A fourth capture, from the **Apple Maps application** rather than the web beta, over the same
court. Its calibration is the cleanest of the set:

| measured span | regulation | px |
|---|---|---|
| doubles sideline to doubles sideline | 10.97 m | 233 |
| singles sideline to singles sideline | 8.23 m | 176 |
| baseline to baseline | 23.77 m | 505 |

Singles/doubles comes out at 0.755 against a regulation 0.750, and baseline-to-width at
**2.167** against a regulation 2.167 — so the view is true nadir, with no 3D-mesh
foreshortening to correct for. **0.0471 m/px.**

Edge rise measured in PIXELS, which needs no calibration at all and so settles the
upsample question by itself:

| capture | m/px | edge rise (px) | resolved detail |
|---|---|---|---|
| Google, shipped chunks | 0.125 | 2 | 0.25 m |
| Apple, web beta at max zoom | 0.125 | 2 | 0.25 m |
| Apple, **Maps app** at max zoom | 0.047 | 3 | **0.14 m** |

The app carries 2.65x the pixel density and its edges widened only from 2 px to 3 px. A pure
upsample would have widened them to ~5 px. So the detail is real: **roughly 1.8x finer than
anything this project has measured from.**

**This reverses the verdict below.** The earlier conclusion was correct about the imagery it
was shown and wrong about Apple — the web beta serves a capped tier, and three captures of a
capped tier cannot speak for the source behind it. The lesson is specific and worth keeping:
*measuring a delivery channel is not measuring a data source.*

It also moves the zoom. At 0.047 m/px the imagery is finer than `z=20&scale=2` delivers
(0.063 m/px), so a swap should probe **z21** as well or it undersamples ground it was told is
there.

> **That z21 probe was run on 2026-08-04 and the service refused it.** The Maps app tier is real
> and it is also unreachable — see below. This section stands as measured; what it was wrong
> about is the assumption that what the app renders is what the API sells.

## The answer, measured through the real API (2026-08-04)

Sahir joined the Apple Developer Program and a MapKit JS key now exists
(`APPLE_MAPKIT_TEAM_ID` / `_KEY_ID` / `_KEY_FILE` in `.env`). Every number below comes from
signed requests to `snapshot.apple-mapkit.com` — the actual licensed source a swap would use,
not a screenshot of a viewer.

### The service caps at z20, silently

Four snapshots of the same centre, one per zoom, compared byte for byte:

| requested zoom | response | bytes | sha1 (first 16) |
|---|---|---|---|
| z19 | 200 | 2,311,519 | `c051c3738c1cc8f0` |
| z20 | 200 | 1,509,749 | `8f146b1081ea3102` |
| z21 | 200 | 1,509,749 | `8f146b1081ea3102` |
| z22 | 200 | 1,509,749 | `8f146b1081ea3102` |

z21 and z22 are **the same bytes as z20**. The service does not error, does not warn, and does
not return a different image — it clamps and answers 200. So `z=20&scale=2` at 0.063 m/px is
the ceiling of the Maps Web Snapshot service, and **the 0.047 m/px the Maps app renders cannot
be bought through the API.** The zoom test above asked exactly the right question; the answer
is that the finer tier is not for sale on this endpoint.

This has a sharp edge for the provider: `appleProvider` validates the returned image *size* and
a clamped z21 response passes that check, because it is the right size and the wrong ground.
The lattice then steps by z21's metres-per-pixel over z20's imagery, and the whole probe is
mis-georeferenced with nothing flagging it. **A zoom above 20 must be rejected before the
request, not after.** (See the georegistration line in the z21 row below — a 0.078 correlation
is the signature of this, not of a real offset.)

### The measurement

`audit-imagery-source.mjs --facility=muir-tennis-west --probe=apple`, over the same 58 x 53 m
of Muir tennis block as every capture above:

| source | m/px | grad/m | resolved edge detail | georegistration |
|---|---|---|---|---|
| Google (shipped chunks) | 0.125 | 82.6 | 0.25 m | — |
| Apple snapshot, z20 (4 requests) | 0.125 | 63.8 | **0.25 m** | **1.25 m off**, correlation 0.439 |
| ~~Apple snapshot, z21 (6 requests)~~ | — | ~~87.1~~ | ~~0.25 m~~ | ~~1.39 m off, correlation 0.078~~ |

The z21 row is struck through because it is not a measurement of z21 — it is z20 imagery
laid out on a z21 grid, per the clamp above. Its 1.05x detail figure should not be quoted.

**At the only zoom the service actually serves, Apple resolves 0.25 m of edge detail — the same
as Google — while carrying 0.77x the detail per metre.** Twice the stored pixels, identical
resolved ground.

### The georegistration, which decides it on its own

The z20 probe lands **1.25 m off** (1.00 m east, 0.75 m north) with a best correlation of only
0.439. The README's threshold is 0.6 m and it calls anything past it a stop sign rather than a
detail, for a good reason: `build-truecolor` samples one colour per surveyed polygon, so a
1.25 m displacement reads the neighbouring surface — path colour onto lawn, roof onto sky. A
sharper source landing in the wrong place is worse than a soft one landing in the right one,
and this source is not even sharper.

### Verdict, and this one is not superseded

**Do not swap.** Not because the imagery is bad, but because at the only tier the API sells it
is a dead heat on resolution, worse on detail per metre, and 1.25 m out of position. The
membership is bought and the credential works; neither of those is an argument for spending a
several-hundred-request rebuild on imagery that measures no better than what is shipped.

The 2026-08-03 conclusion was right, and it was right for a reason it could not see at the
time. It measured a capped web viewer and correctly called it a dead heat; the Maps app then
made that look like a channel artifact; and the API turns out to serve the capped tier too. The
lesson from that section survives intact and gains a second half: *measuring a delivery channel
is not measuring a data source — and the data source is only worth what its licensed channel
will actually deliver.*

What would change the answer, in order: the georegistration offset resolved (it may be a centre
convention in `appleSnapshotQuery`, or it may be Apple's ortho — untested either way), and a
tier above z20 becoming purchasable. Currency remains the one live argument for Apple and is
tracked separately below.

## Verdict (superseded — see above)

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

# against the live Apple service (needs the MapKit JS credential in .env)
node scripts/audit-imagery-source.mjs --facility=muir-tennis-west --probe=apple
```

Do not pass `--zoom=21` or higher to an Apple probe: the service clamps to z20 and answers 200,
so the run completes and reports numbers that mean nothing.
