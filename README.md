# 3D Modeling Campus

3D model of UCSD campus + surrounding La Jolla. Every building height, every
tree and every ground colour in the world is a measurement with a source.

**Live:** https://sahirssharma.github.io/3D-Modeling-Campus/

Runs in the browser on three.js. No account, no install, no build step to view it — the
site is static files served straight out of `docs/`.

---

## How it is built

Each data source is used only for the thing it is actually good at.

| Source | Supplies | Deliberately not used for |
|---|---|---|
| **OpenStreetMap** | footprint outlines, paths, plazas, names, campus boundary | anything vertical |
| **USGS 3DEP aerial LiDAR** (`CA_SanDiegoQL2_2014`) | every height, the ground surface, every tree | classifying what a thing *is* |
| **UC San Diego facilities GIS** | per-mass building geometry (towers, podiums, floors) | colour or terrain |
| **USDA NAIP / satellite imagery** | build-time colour measurement and painted sports markings | rendering — no photograph is ever draped on the world |

The LiDAR survey classifies ground and lumps everything else into "unassigned", so the
pipeline never asks it whether a point is a building. It asks whether a point stands
above ground *inside a footprint OSM already drew*. That division of labour is the core
design decision.

### Why not just use OSM heights

Only a small fraction of the footprints carried an OSM height tag at all, and the tagged
ones were not reliably right:

| Building | OSM / guessed | LiDAR measured |
|---|---|---|
| Argo Hall | 22.8 m | **18.4 m** |
| Blake Hall | 15.6 m | **12.4 m** |
| Mandeville Center | 15 m | **20.9 m** |
| McGill Hall | 12 m | **25.1 m** |
| Student Center | 12 m | **8.6 m** |
| Revelle Commons | 10 m | **7.5 m** |

A test fails if this table ever drifts from the shipped `docs/data/campus-lidar.json`.

Buildings raised after the 2014 survey are reconciled per mass against the facilities
GIS — the LiDAR is the referee for everything it saw and is overruled for everything
built after it flew.

### Scope

|  | campus | surrounding region |
|---|---|---|
| area | 8.4 km² | 30.0 km² (52.7 km² bbox) |
| terrain sampling | 3 m | 6 m |
| elevation range | — | 0.2 m at the waterline to 137.5 m on the mesas |
| terrain storage | JSON | `region-terrain.bin`, Int16 decimetres, 2.8 MB |

The regional grid is phase-aligned to the campus grid and carries the campus's own
heights verbatim inside the campus box, so the seam between the two is exact by
construction rather than within a tolerance.

---

## Quick start

```bash
npm install
npm run serve      # http://localhost:5170
npm test           # node --test — no network, no browser
npm run check      # validate the shipped data files without refetching
```

### Rebuilding the data

Needs the network and takes a few minutes. All builders write into `docs/data/`, so a
rebuild is a normal reviewable diff.

```bash
npm run build:osm         # Overpass — tag filters go before the bbox or it 406s
npm run build:lidar       # ~102 tiles, 3.3M points, decoded with laz-perf
npm run build:satellite   # boundary polygon + georeferenced imagery chunks
npm run build:truecolor   # per-polygon and per-roof colours measured from those chunks
npm run build:markings    # fits painted sports markings to the same pixels
npm run build:region      # terrain, massing, heights and colours past the campus
```

`build:satellite` builds only the chunks that touch the boundary polygon, caps itself at
3,500 requests per run, and caches raw imagery under `.cache/<source>/` so reruns refetch
nothing.

### Imagery source

The imagery provider (`scripts/lib/imagery.mjs`) is selected with `--source`:

| | zoom 19 | zoom 20 | credential |
|---|---|---|---|
| `google` (shipped) | 0.251 m/px | 0.125 m/px | `GOOGLE_MAPS_API_KEY` — Map Tiles API |
| `apple` | 0.125 m/px | 0.063 m/px | `APPLE_MAPKIT_TEAM_ID`, `APPLE_MAPKIT_KEY_ID`, `APPLE_MAPKIT_KEY_FILE` |

Before spending a full rebuild on a source swap, probe it — this checks georegistration
against the shipped chunks and measures resolved edge detail per metre of ground, which
is the number that matters rather than the advertised pixel scale:

```bash
node scripts/audit-imagery-source.mjs --facility=muir-tennis-west --probe=apple
```

A georegistration offset past ~0.6 m is a stop sign: a sharper source landing in the
wrong place is worse than a soft one landing in the right one.

---

## Three ways in

The site opens on a choice, and `?mode=` skips it.

| Mode | What it is | Payload |
|---|---|---|
| **Free roam** (`?mode=campus`) | the whole campus, North Torrey Pines Road to I-5, fly anywhere | ~10 MB |
| **Eighth → Peterson** (`?mode=scooter`) | one ~1,000 m route on a scooter, steered freely across a marked track, against a clock | ~1.5 MB |
| **Eighth → Peterson** (`?mode=staging`) | the same clean ride, one build ahead, as a workbench | ~1.5 MB |

`staging` exists so there is somewhere to try things. Work in progress lands there
first, where it can be looked at on the live site without touching the run. It rides
the **same line** — a staging area on a different route would be staging for something
else. Since 2026-08-16 the run mirrors staging exactly — a clean ride, no obstacles
and no coins — so the two documents differ only in their stamp and their promise:
staging is allowed to be broken, the run is not. It is **not a lesser build**: same builder, same crop, same gates, and
the full test suite runs over both corridors. What it is allowed to be is broken, and it
says so on screen. The two are
different files, each stamped with the mode it was built for, and both the builder's
`--check` and `campus-scooter.js` refuse a file whose stamp does not match; the
documents are otherwise the same shape, so loading the wrong one would just quietly
be the other route.

Both scooter modes are a **crop, not a second survey**. `scripts/build-corridor.mjs` cuts
everything within 130 m of the route out of the same measured files the campus is built
from and writes `docs/data/corridor-eighth-peterson.json` — 68 buildings, 324 trees, 567
ground polygons, about 5% of the campus. Every ring, height and colour in it is copied
verbatim; the build fails if any of them is not. The runtime feeds those crops to the
same builders free roam uses — `campus-world.js`, `campus-massing.js`,
`campus-details.js`, `campus-eighth.js`, `campus-landmarks.js` — so the two modes cannot
disagree about what a measured building looks like.

The route starts dead centre on the Eighth College basketball court and leaves it
heading north-east. It used to leave heading *south*: the lead-in joined the path
network at the nearest graph node, which sits at the court's south-west corner while
the route runs north, so the ride opened by driving 12.6 m backwards and did not pass
its own start line again until 40 m in. The entry node is now the one that minimises
lead-in plus onward leg rather than the one that is closest — doubling back is longer
than not doubling back, so the hook cannot come back. The lead-in is weighted 1.5x in
that search because it is the one stretch of centreline that is not a surveyed path,
and it should not be spent freely: unweighted, the search bought 19 extra metres of
invented line to save one metre of walking.

The route runs east out of the courts, north up the corridor **between** the "fleet"
(Revelle's halls are all named after research ships — Atlantis, Galathea, Beagle, Meteor,
Challenger, Discovery, and Argo itself), east along Argo Hall's south face, north up its
east side, then east into Revelle Plaza and the long straight north to Peterson.

### The route is gated against a line drawn on a map

The shape above is not a preference, and it is not held in prose. It is held by
`DRAWN_REFERENCE` in `scripts/build-corridor.mjs`: the correct line, drawn by hand onto
an Apple Maps screenshot, extracted from the pixels and converted into this repo's metric
frame. `check` measures the shipped centreline against it and fails past 5 m mean or 12 m
worst, and separately fails if the line ever doubles back along it.

This exists because every other gate can pass on a route that is simply wrong. The
previous line started in the right place, ended in the right place, was the right length
and touched no building — and was **39 m** from where it was supposed to go, twice. "It
looks right on the site" is not a gate.

Two things made it wrong, and both are now impossible rather than fixed:

- **`64 Degrees` was a waypoint.** The dining hall is north-*west* of Argo, so routing
  through it dragged the line diagonally across the top of the plaza. Waypoints are now
  raw `{x, z}` points taken from the drawing. A building name routes to that building's
  *centroid*, and several hall-adjacent graph nodes are dead-end entrance spurs that turn
  a waypoint into a visible out-and-back — which is what the no-doubling-back gate exists
  to catch.
- **The survey has a hole.** OSM's footways here are drawn way by way and are not always
  noded where they meet: the north-south walk through the fleet ends at `(-90.0, 480.7)`
  and the east-west walk above it passes 8.8 m away at the same x. On the ground that is
  one continuous walkway; in the graph it was two, and A* answered a 28 m question with a
  148 m detour out west and back — the dogleg that put the route on the wrong side of
  Atlantis Hall. `campus-route.js` can now bridge a gap like that, but **only when asked**
  (`bridgeGaps`), only between a dangling tip and a walkway it stops short of, never
  through a building, and only where walking round costs more than five times the gap.
  Campus-wide at 10 m that is 244 inferred links — far too large a claim to make silently
  on free roam's behalf, so free roam does not use it. The corridor builder is the only
  caller, and every bridge the shipped line actually crosses is listed in
  `route.bridges`.

**A note on the hall names.** The drawing labels the hall on the right of the northbound
straight *Meteor*; this repo's OSM data calls that same building *Galathea* and puts
Meteor 40 m further east. One screenshot is not enough to re-label survey data, so
nothing has been renamed — and it does not matter, because the route is fitted to
geometry and gated against geometry. Neither label has to be right for the line to be.

It goes **past** Argo Hall, not through it. It used to go through it — 12 m of centreline
inside the walls — for two compounding reasons. Naming a building as a waypoint routes to
that building's centroid, which is inside it by definition; and `campus-route.js` joins
every plaza perimeter vertex to the plaza centre to make open squares crossable, which is
an invented shortcut, and four of the eighteen spokes of the courtyard plaza that wraps
Argo were straight lines through the building. Both are fixed — spokes are now tested
against footprints, corner-smoothing will not round into a wall, and the finished line is
pushed 1.2 m clear of any facade it still touches — and `--check` now walks the shipped
centreline against every footprint in the crop, so it cannot come back quietly.

`arcgis.ground` is cropped **in place**, with `null` for a dropped ring rather than a
compacted array, because `campus-eighth.js` addresses those rings by literal index —
including a hard-coded `1761` and every `arcgis.ground#NNNN` registration string in
`campus-eighth.json`. Renumbering them rebuilds Eighth College out of the wrong
polygons, silently. The builder and the test suite both gate on it.

The track is **markings on the measured ground, not a road**. An opaque
surface the width of the route reads as a highway dropped on the campus, and hides
the measured colour and the painted markings already there — which is the one thing
the corridor exists to show. Two continuous edge stripes bound the rideable width —
the way a real carriageway marks an edge you should not cross — and the rider steers
freely between them; there are no lanes to divide.

**The obstacles, coins and track are invented.** They live under one `game` key that
no measured consumer reads, they are placed by a seeded PRNG so the run is identical
on every build, and they are labelled as invented in the data file. What they are
*not* is guessed measurement — nothing about the campus moved to make room for them.
Since 2026-08-16 both corridors ship the arrays **empty** (the run is a clean ride),
but the placer and its gates stay live: every obstacle group it would place must
leave a free gap the rider fits through — re-derived from the placed widths, not
assumed — never two groups closer than 12 m, and a headless test rides the generated
course to prove a clean line beats par. Flipping props back on is one flag in
`ROUTES`, already gated.

**Photo-sourced detail is the second declared invented class.** Small-scale detail —
courtyard furniture, garden beds, staircases, facade character in Eighth and Revelle —
is modeled off dated web photographs, which are the *newest* epoch this project has:
photos decide what exists and what it looks like; LiDAR and OSM keep deciding scale
and position wherever they cover the same thing. Everything in this class lives in
`campus-photo-detail.json`, labelled with its sources and epoch; the corridor builder
carries it **verbatim** (its `--check` fails on a single changed byte), and nothing
measured may ever read from it. Where no photo resolves an item, it stays unbuilt —
better absent than wrong still applies to invented content.

**The lit look is art direction, everywhere.** ACES tone mapping, soft shadows,
ambient occlusion, bloom and a neutral image-based light now run in every mode
(free roam included, as of 2026-08-16). None of it moves, sizes or recolours an
entity; the measured colours still feed the materials — what changed is how they
resolve to pixels.

### The machine sits on the surface you can see

The scooter used to render below the ground, and it took two independent mistakes to do
it. `heightAt` interpolates the full 3 m LiDAR grid, but the terrain that is *drawn* uses
every second sample — so wherever a skipped sample was a local low, the visible triangles
bow above the sampled height and anything placed at `heightAt` is genuinely underneath
them. `campus-terrain.js` now also exposes `surfaceAt`, the height of the drawn triangle,
built from the same `STEP` and the same diagonal as the mesh itself rather than a second
copy of that arithmetic.

The second mistake was the datum. Everything you read as ground here is a lifted decal:
plazas, walks and roads are drawn on the `ground` rung of `campus-overlay.js`'s ladder and
the Eighth basketball court sits on `pad`. A machine at raw terrain height therefore had
5–9 cm of drawn pavement over its wheels — and the run's own lane paint (`paint`, 0.17)
floated 2 cm *above* the deck at 0.15, so the markings were literally drawn over the
scooter. The scooter, its obstacles, its coins and its finish bar now share one ride plane
on the `pad` rung, which is never more than 4 cm from either surface the route crosses.
Obstacles matter as much as the scooter here, and not cosmetically: `scooter-ride.js`
decides a hop cleared an obstacle with `ride.y > o.h`, so two different datums make that
comparison lie about clearance.

It also *rides* now. Both contact patches are sampled 0.86 m apart and the machine sits on
the plane they define and pitches to match, so on a grade both wheels touch instead of one
burying and one floating. `npm run verify:ride` drives the whole route in a real browser
and asserts the contact patch stays within 5 cm of that plane — **two-sided**, so a fix
that hoists the machine into the air fails just as loudly as one that sinks it.

Where the run departs from the measured world on purpose is the *look*: shadows, tone
mapping, tighter fog and a togglable sunset. Free roam does without all of it, because
there the point is the measurement.

---

## Controls

### Free roam

You spawn 110 m above Argo Hall at 500 m/s, holding height over the ground. Nothing
moves until you do.

| | |
|---|---|
| drag | look around |
| `W` `A` `S` `D` | move where you are looking (`A`/`D` strafe) |
| `Q` / `E` | sink / climb — eye level to 900 m, at a rate that follows your clearance |
| `↑` / `↓` | speed, coarse |
| `←` / `→` | speed, fine |
| `shift` | double the throttle, capped at 2000 m/s |
| minimap click | teleport there, same heading and height |
| teleport menu | jump to any of 360+ named places |
| `L` | building labels on/off |
| `H` | development panel (layer toggles) |

### Scooter run

You leave the Eighth College courts from a standstill and top out at 6.9 m/s — the real 25 km/h cap of the
Ninebot ES2 the scooter is modelled on. The clock counts up; a hit costs 3 s and all your
speed, a coin buys back 0.5 s.

| | |
|---|---|
The run opens 165 m over the Eighth College courts and falls onto the scooter as it
accelerates off the court and onto the pavement. The clock does not start until the
descent hands over; any key or tap skips it.

| | |
|---|---|
| `A` `D` or `←` `→` | steer — hold to slide, the painted edges are the limits |
| `space` / `W` | bunny hop — clears a bench or a cone, never a bollard |
| `F` | fly mode: free roam's own controls over the corridor — `W` `A` `S` `D`, `Q`/`E` height, `↑`/`↓` speed, `shift` doubles. The ride and the clock pause. |
| `[` / `]` | in fly mode, jump 60 m along the route |
| `L` | building labels on/off |
| `T` | sunset / noon |
| `Esc` | back to the menu |
| | *`?mode=staging` is the same run with the obstacles and coins removed, and says so on screen* |
| hold left / right | steer, on a phone |
| tap the top third | hop, on a phone |

---

## Repository layout

```
docs/            the deployed site — GitHub Pages serves this directory
  index.html
  js/            renderer modules (campus-walk.js is the entry point)
  data/          shipped survey data, ~48 MB
  vendor/        three.js r169
scripts/         data builders, audits and accuracy tooling
  lib/           shared point-cloud decoding and imagery providers
tests/           node --test suites, no network or browser required
gauntlet-loop/   automated visual-review harness
ENGINEERING.md   long-form design notes and post-mortems
```

## Testing

`npm test` runs the full suite offline. The tests are written against the *shipped data
files* as well as the source, so a data rebuild that changes a stated fact fails a test
rather than silently going stale.

## Provenance

Extracted from the TritonPlan repository, where it began as a dashboard tile.

## Licence

**Source-available, not open source.** Copyright © 2026 Sahir Sharma, all rights reserved —
you may read this code, you may not copy, modify, redistribute or reuse it without written
permission. See [LICENSE](LICENSE) for the exact terms and for the third-party components
that carry their own.

## Data licences

- Building outlines, paths, plazas and the campus boundary: © OpenStreetMap contributors, **ODbL**.
- Heights, terrain and trees: **USGS 3DEP** LiDAR (`CA_SanDiegoQL2_2014`), public domain.
- Aerial colour base: **USDA NAIP**, public domain.
- Measured colours and fitted markings derive at build time from the imagery source named
  in `docs/data/textures/manifest.json` — today **Imagery © Google** (Map Tiles API);
  **Imagery © Apple** (Maps Web Snapshot) is the selectable alternative. No tile imagery
  renders in-world under either.
- three.js r169, MIT.

Unofficial. Not affiliated with, endorsed by, or operated by any university. Not a
navigation aid.
