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
| Argo Hall | 22.8 m | **18.4 m** |
| Blake Hall | 15.6 m | **12.4 m** |
| Mandeville Center | 15 m | **10.7 m** |
| McGill Hall | 12 m | **25.1 m** |
| Student Center | 12 m | **8.6 m** |
| Revelle Commons | 10 m | **7.5 m** |

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
(`docs/js/campus-terrain.js` is the single source of that chunk rule). Field markings, plaza
paving and crosswalks are all legible; sports fields and the big plazas get zoom 20, everything
else zoom 19. Outside the boundary — the terrain sheet runs well past it into the rest of
La Jolla — the ground keeps its stylized NAIP-coloured look, so the photo→stylized cut IS the
surveyed campus edge, pixel-exact, and the boundary itself is drawn in-world and on the minimap
as a dashed dark-navy line. Stylized ground polygons and path ribbons come OFF wherever the
photograph is coming, so the imagery's own paving and crosswalks stay visible.

**Epochs do not match, on purpose.** The imagery is current; every height and the ground surface
are the 2014 LiDAR survey (reconciled per mass against the university GIS for what was built
after the survey flew). Where campus changed since 2014, the picture shows today and the
geometry shows the survey. Nothing here blends the two: heights are never read off the imagery.

One honest caveat about what you will actually see: **a faint tiled "© Google" watermark is
burned into the tiles themselves.** That is inherent to the Map Tiles 2D product at these zooms
and is left as-is; the on-screen attribution is the separate "Imagery © Google" credit, shown
whenever the imagery is.

---

## Layout

```
docs/            the site — GitHub Pages serves this directly, no build step
  index.html     standalone page + development panel
  js/
    campus-walk.js      the walk: movement, cameras, HUD, boot
    campus-world.js     the world: terrain + satellite drape, surfaces, paths, trees, boundary
    campus-massing.js   buildings: the university GIS's per-mass extrusions
    campus-explore.js   free roam: position, hover, the velocity model (no DOM)
    campus-minimap.js   the minimap: aerial underlay, boundary ring, click-to-teleport
    campus-landmarks.js labels + placed landmarks (Fallen Star, Sun God…)
    campus-route.js     A* over the real footpath graph (no DOM, no three.js)
    campus-ground.js    the surveyed ground polygons: clip + tile at load (no DOM)
    campus-terrain.js   height sampler, chunk grid, boundary rings (no DOM)
  data/
    campus-3d.json         OSM footprints, paths, plazas
    campus-lidar.json      measured heights, terrain grid, trees
    campus-arcgis.json     the university GIS: masses + ground polygons
    campus-colors.json     NAIP aerial colours: terrain grid, roofs, ground
    campus-facades.json    facade palettes
    campus-landmarks.json  placed landmarks
    campus-boundary.json   the campus boundary polygon, local metres
    textures/              satellite ground chunks + manifest.json
  vendor/three/  three.js r169, vendored
scripts/
  build-campus-3d.mjs        Overpass -> docs/data/campus-3d.json
  build-campus-lidar.mjs     USGS LiDAR -> docs/data/campus-lidar.json
  build-campus-arcgis.mjs    university GIS -> docs/data/campus-arcgis.json
  build-campus-colors.mjs    NAIP -> docs/data/campus-colors.json
  build-campus-satellite.mjs boundary + Google tiles -> boundary json, textures/
  audit-accuracy.mjs         R2 cross-source audit -> scripts/reports/
  serve.mjs                  static server for docs/
tests/
  campus-walk.test.mjs     the invariants that have actually broken
  campus-arcgis.test.mjs   the survey layer: masses, ground polygons, colours
  campus-gameplay.test.mjs the removed footway, spawn, speed cap, minimap arithmetic
  campus-textures.test.mjs the satellite layer: manifest vs grid vs boundary, ground coverage
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
any output) and uses the Map Tiles API's 2D satellite session. It builds only the terrain
chunks that touch the boundary polygon (87 of 132 over the full campus), fetches only tiles
that touch it too, hard-caps itself at 3,500 tile requests per run (a full rebuild uses
~2,600), and caches raw tiles under `.cache/` so a rerun refetches nothing. Pixels outside the
boundary are baked to the surrounding NAIP aerial colours at build time, which is how the
renderer gets a pixel-exact boundary with no per-frame clipping.

## Controls

You spawn in free roam, hanging **110 m above Argo Hall** and holding that height over the
ground — nothing moves until you do. The guided walk (Argo → Revelle Plaza → Peterson) is one
press of `F` away.

| | |
|---|---|
| drag | look around |
| `W`/`A`/`S`/`D` | move where you are looking (strafe in free roam) |
| `Q` / `E` | (free roam) sink / climb — eye level to 900 m up |
| velocity slider | both modes pace themselves by it — logarithmic, 0.6 up to **250 m/s** |
| `shift` | faster, but never past the 250 m/s cap |
| `F` | toggle free roam ↔ the guided walk (rejoins at the nearest point) |
| `1` / `2` | (guided walk) eye level / over the shoulder |
| minimap click/tap | teleport there — same heading, same height over the ground |
| teleport menu | jump to any of 360+ named places |
| `L` | building labels on/off |
| `R` | back to the start of the walk, on foot |
| `space` | pause / resume the auto-walk (on the ground) |
| `H` | show or hide the development panel |

The minimap (top right) is the NAIP aerial itself, with the guided walk in gold, you as the
white dot with a view wedge, and — when `docs/data/campus-boundary.json` has been generated —
the official campus boundary as a dashed dark-navy ring over the surrounding La Jolla ground.
The file is optional by contract: without it the map simply has no boundary line and clicks
still teleport.

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

FULL CAMPUS (2026-08-03). The corridor became the campus: everything the
roads bound — North Torrey Pines Road, La Jolla Village Drive, Genesee,
I-5. A third and fourth source joined, each again used only for what it
is good at. UC San Diego's own facilities GIS supplies the massing —
one polygon per MASS, so Sankofa is a 64 m tower plus a mid and a base,
Geisel is built from its real per-floor polygons, and the Pepper Canyon
West towers stand at 70 and 67 m as the tallest things on campus. USDA
NAIP aerial imagery (public domain) supplies the colours: a 6 m terrain
colour grid, every roof, every surveyed ground polygon.

The 2014 LiDAR remains the referee for everything it saw and is
overruled for everything built after it flew — it "measured" Sankofa at
8.4 m, the parking lot the tower replaced. Heights reconcile per mass.

Free roam (F) goes anywhere from eye level to 900 m up, with a
logarithmic velocity slider and teleport to any of 360+ named places.
Labels (L) name every building in view, depth-tested so a hidden
building keeps its name to itself. Fallen Star hangs off the Jacobs
Hall tower corner at its published 10 degrees, baby blue with a brick
chimney; the Sun God and the Warren Bear stand where they stand.
