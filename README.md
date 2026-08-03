# Campus Walk

A walk across a real campus, in 3D, built from measurements rather than impressions.

**Live:** https://sahirssharma.github.io/campus-walk/

Out of **Argo Hall**, across **Revelle Plaza**, onto **Ridge Walk** — 371 m, of which 72 m is
plaza. Walk it at eye level like Street View, or from over your own shoulder. Every building names
its measured height as you pass it.

---

## The one idea

Two sources, each used only for the thing it is actually good at.

| Source | Used for | Not used for |
|---|---|---|
| **OpenStreetMap** | footprint outlines, paths, plazas, names, the campus boundary | anything vertical |
| **USGS 3DEP aerial LiDAR** | every height, the ground surface, every tree | anything about what a thing *is* |
| **Google satellite imagery** | what the ground *looks like* inside the campus boundary | geometry — nothing is measured off it |

OSM is very good in plan and close to useless in elevation. Of ~320 buildings in this area, 38
carried a height tag, and the tagged ones were not reliably right either. Checked afterwards against
LiDAR:

| Building | OSM / guessed | LiDAR measured |
|---|---|---|
| Argo Hall | 22.8 m | **18.5 m** |
| Blake Hall | 15.6 m | **12.7 m** |
| Mandeville Center | 15 m | **23.6 m** |
| McGill Hall | 12 m | **25.1 m** |
| Student Center | 12 m | **23.5 m** |
| Revelle Commons | 10 m | **7.4 m** |

(The measured column is read from the shipped `docs/data/campus-lidar.json`; a test fails if this
table ever drifts from the data again.)

Argo and Blake are the two buildings you stand between at the start of the walk. Both were wrong.

The LiDAR survey (`CA_SanDiegoQL2_2014`) classifies ground and lumps everything else into
"unassigned" — there is no building class. So nothing here asks the data *"is this a building?"*.
It asks *"is this point above ground, and does it stand inside a footprint OSM already drew?"*
That division of labour is the whole design.

### The photoreal ground

Inside the official campus boundary — the dashed polygon OSM draws around the university — the
terrain wears current Google satellite imagery, reprojected from Web Mercator tiles onto the
site's local metre grid and cut into chunks that match the terrain mesh exactly
(`docs/js/campus-ground.js` is the single source of that chunk rule). Field markings, plaza
paving and crosswalks are all legible; sports fields and the big plazas get zoom 20, everything
else zoom 19. Outside the boundary the campus keeps its stylized look — the contrast is the
point, and the boundary itself is drawn in-world and on the minimap as a dashed dark-navy line.

**Epochs do not match, on purpose.** The imagery is current; every height and the ground surface
are the 2014 LiDAR survey. Where campus changed since 2014 — construction sites are plainly
visible in the imagery around Revelle — the picture shows today and the geometry shows the
survey. Nothing here blends the two: heights are never read off the imagery.

Two honest caveats about what you will actually see:

- **The visible photo→stylized cut is the LiDAR sheet edge, not the boundary.** The whole LiDAR
  terrain sheet lies inside the campus boundary ring, so every terrain pixel wears imagery and the
  transition to the stylized look happens where the measured terrain ends. Pushing imagery out to
  the true boundary needs a wider LiDAR download (`AREA` in `scripts/build-campus-lidar.mjs`) —
  until then, the dashed navy line (in-world and on the minimap) is what marks the boundary.
- **A faint tiled "© Google" watermark is burned into the tiles themselves.** That is inherent to
  the Map Tiles 2D product at these zooms and is left as-is; the on-screen attribution is the
  separate "Imagery © Google" credit, shown whenever the imagery is.

---

## Layout

```
docs/            the site — GitHub Pages serves this directly, no build step
  index.html     standalone page + development panel
  js/
    campus-walk.js    the walk: movement, cameras, HUD, minimap
    campus-world.js   the world: terrain, massing, surfaces, paths, trees
    campus-route.js   A* over the real footpath graph (no DOM, no three.js)
    campus-ground.js  ground rules shared by renderer, build and tests (no DOM)
  data/
    campus-3d.json         OSM footprints, paths, plazas          (~243 KB)
    campus-lidar.json      measured heights, terrain grid, trees  (~205 KB)
    campus-boundary.json   the campus boundary polygon, local metres
    textures/              satellite ground chunks + manifest.json (~4 MB)
  vendor/three/  three.js r169, vendored
scripts/
  build-campus-3d.mjs        Overpass -> docs/data/campus-3d.json
  build-campus-lidar.mjs     USGS LiDAR -> docs/data/campus-lidar.json
  build-campus-satellite.mjs boundary + Google tiles -> boundary json, textures/
  serve.mjs                  static server for docs/
tests/
  campus-walk.test.mjs     the invariants that have actually broken
  campus-gameplay.test.mjs the removed footway, spawn, speed cap, minimap arithmetic
  campus-textures.test.mjs the satellite layer: manifest tiling, boundary ring, ground coverage
```

## Running it

```bash
npm install
npm run serve      # http://localhost:5170
npm test           # node --test, no network, no browser
npm run check      # verify the shipped data files without refetching
```

Rebuilding the data needs the network and takes a few minutes:

```bash
npm run build:osm        # Overpass. Tag filters go BEFORE the bbox or it 406s.
npm run build:lidar      # ~102 tiles, 3.3M points, decoded with laz-perf
npm run build:satellite  # boundary polygon + satellite ground chunks
```

All three write into `docs/data/`, so a rebuild is a normal reviewable diff.

`build:satellite` reads `GOOGLE_MAPS_API_KEY` from `.env` (never committed, never written into
any output) and uses the Map Tiles API's 2D satellite session. It fetches only tiles that touch
the boundary polygon, hard-caps itself at 3,500 tile requests per run (a full rebuild uses
~365), and caches raw tiles under `.cache/` so a rerun refetches nothing. Pixels outside the
boundary are baked to the stylized ground colour at build time, which is how the renderer gets
a pixel-exact boundary with no per-frame clipping.

## Controls

You spawn **110 m above Argo Hall**, holding altitude — fly mode has no gravity, so nothing
moves until you do. `F` drops you onto the walking rail; `F` again lifts you back off it.

| | |
|---|---|
| drag | look around |
| `W` / `S` | move — along the walk on the ground, along your view direction in the air |
| `shift` | run on the ground; in the air, wind up to **250 m/s** |
| `Q` / `E` | (fly) straight up / down |
| `F` | toggle fly ↔ walk (landing snaps to the nearest point of the route) |
| `1` / `2` | eye level / over the shoulder |
| minimap click/tap | teleport there, standing at ground + eye height (clamped to where ground mesh exists) |
| `M` | enlarge the minimap into a campus overview (clicks still teleport) |
| `R` | back to the start of the walk, on foot |
| `space` | pause / resume the auto-walk (on the ground) |
| `H` | show or hide the development panel |

The minimap (bottom right) draws the footprints, paths, the walked route in blue and — when
`docs/data/campus-boundary.json` has been generated — the official campus boundary as a dashed
dark-navy ring. The file is optional by contract: without it the map simply has no boundary line.

One path is missing on purpose: the direct footway between Argo Hall and Peterson Hall was
removed from the shipped data **and** blacklisted in `scripts/build-campus-3d.mjs`
(`EXCLUDED_WAYS`, OSM way `1025633000`), so a rebuild keeps it out. Routing between the two
still works — A* goes round via the diverging walkway to the east (~785 m instead of ~795 m).

The development panel's **layer toggles** are the most useful thing in it. Nearly every rendering
fault found so far was invisible until whatever stood in front of it could be switched off — the
plaza drawn on the wrong side of the origin, the walls wearing the roof's colour, canopies
swallowing the camera.

---

## Things already learned the hard way

Kept because each one cost real time and none of them announced itself:

- **`ExtrudeGeometry` group 0 is the lids, group 1 is the side walls.** Passing `[wall, roof]`
  paints the roof colour onto every wall — the whole campus rendered as identical grey cardboard
  and no facade texture was ever visible.
- **A `Shape` rotated flat maps its second axis to *negative* world z.** Feeding it `(x, z)` mirrors
  the polygon across the origin. Revelle Plaza and its fountain were being drawn hundreds of metres
  away, so standing in the middle of the plaza put you on grass under a label reading
  "Revelle Plaza".
- **A plaza tagged `area=yes` is a surface, not a route.** Imported as a line it becomes a kerb
  tracing its own perimeter, and routing then refuses to cross it: Argo Hall to the middle of
  Revelle Plaza came out at 390 m, around a square you can see across. It is 55 m.
- **Flood-filling a canopy makes one tree out of a whole row.** A touching line of eucalyptus became
  a single tree with a 47 m crown. Trees are found as local maxima instead.
- **Crowns must clear head height** or the walk goes into a solid green wall.
- **Size the renderer from the canvas, not the window.** `setSize(innerWidth, innerHeight)` also
  writes that size as inline CSS, cropping the render and hiding whatever sits low in frame.
- **Overpass wants tag filters before the bounding box**, or it answers `406` rather than a syntax
  error.

## Provenance

Extracted from the TritonPlan repository, where it began as a tile on the dashboard. Originating
commits: `194be3c` (the scooter game this grew out of, now parked), `548dfc3` (the move to measured
geometry). It will fold back into TritonPlan once it stands up on its own.

## Data licences

- Building outlines, paths, plazas and the campus boundary: © OpenStreetMap contributors, **ODbL**.
- Heights, terrain and trees: **USGS 3DEP** LiDAR (`CA_SanDiegoQL2_2014`), public domain.
- Ground textures inside the boundary: **Imagery © Google** (Map Tiles API), current epoch —
  credited on screen whenever the imagery is. Heights remain 2014 LiDAR; see the epoch note above.
- three.js r169, MIT.

Unofficial and not affiliated with, endorsed by, or operated by any university. Not a navigation
aid.
