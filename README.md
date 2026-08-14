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
| **Eighth → Peterson** (`?mode=scooter`) | one 1,060 m route on a scooter, three lanes, against a clock | ~1.5 MB |
| **Argo → Peterson** (`?mode=staging`) | the same thing on the 732 m stretch, as a workbench | ~1.3 MB |

`staging` exists so there is somewhere to try things. Work in progress lands there
first, where it can be looked at on the live site without touching the run. It is
**not a lesser build**: same builder, same crop, same gates, and the full test suite
runs over both corridors — a subset violation on staging is the same lie it would be
on the run. What it is allowed to be is broken, and it says so on screen. The two are
different files, each stamped with the mode it was built for, and both the builder's
`--check` and `campus-scooter.js` refuse a file whose stamp does not match; the
documents are otherwise the same shape, so loading the wrong one would just quietly
be the other route.

Both scooter modes are a **crop, not a second survey**. `scripts/build-corridor.mjs` cuts
everything within 130 m of the route out of the same measured files the campus is built
from and writes `docs/data/corridor-eighth-peterson.json` — 69 buildings, 330 trees, 571
ground polygons, about 5% of the campus. Every ring, height and colour in it is copied
verbatim; the build fails if any of them is not. The runtime feeds those crops to the
same builders free roam uses — `campus-world.js`, `campus-massing.js`,
`campus-details.js`, `campus-eighth.js`, `campus-landmarks.js` — so the two modes cannot
disagree about what a measured building looks like.

The route starts dead centre on the Eighth College basketball court and is defined by
landmarks rather than coordinates: north through the "fleet" (Revelle's halls are all
named after research ships — Atlantis, Galathea, Beagle, Meteor, Challenger, Discovery,
and Argo itself), past the 64 Degrees dining hall, right at Argo, left through Revelle
Plaza, then the long straight north to Peterson.

`arcgis.ground` is cropped **in place**, with `null` for a dropped ring rather than a
compacted array, because `campus-eighth.js` addresses those rings by literal index —
including a hard-coded `1761` and every `arcgis.ground#NNNN` registration string in
`campus-eighth.json`. Renumbering them rebuilds Eighth College out of the wrong
polygons, silently. The builder and the test suite both gate on it.

**The obstacles, coins and lanes are invented.** They are the only invented entities in
this repository. They live under one `game` key that no measured consumer reads, they
are placed by a seeded PRNG so the run is identical on every build, and they are
labelled as invented in the data file, in the loading log and on screen. What they are
*not* is guessed measurement — nothing about the campus moved to make room for them.
They are held to their own gates instead: never all three lanes blocked at once, never
an obstacle wide enough to bleed into the lane beside it, never two groups closer than
12 m, and a headless test rides the whole route to prove a clean line beats par.

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

You leave the Eighth College courts already rolling and top out at 6.9 m/s — the real 25 km/h cap of the
Ninebot ES2 the scooter is modelled on. The clock counts up; a hit costs 3 s and all your
speed, a coin buys back 0.5 s.

| | |
|---|---|
The run opens on a seven-second orbit of the scooter parked on the court. The clock does
not start until it ends; any key or tap skips it.

| | |
|---|---|
| `A` `D` or `←` `→` | change lane |
| `space` / `W` | bunny hop — clears a bench or a cone, never a bollard |
| `F` | flythrough: detach the camera and inspect the map at 45 m/s. The ride and the clock pause. |
| `[` / `]` | in flythrough, scrub 60 m along the route |
| `L` | building labels on/off |
| `T` | sunset / noon |
| `Esc` | back to the menu |
| | *`?mode=staging` is the same run on Argo → Peterson, and says so on screen* |
| tap left / right | change lane, on a phone |
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
