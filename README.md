# 3D Modeling Campus

A browsable 3D model of a real university campus and the coastal region around it, built
from public survey data rather than hand-modelled by eye. Every building height, every
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

## Controls

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
