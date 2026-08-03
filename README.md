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
| **OpenStreetMap** | footprint outlines, paths, plazas, names | anything vertical |
| **USGS 3DEP aerial LiDAR** | every height, the ground surface, every tree | anything about what a thing *is* |

OSM is very good in plan and close to useless in elevation. Of ~320 buildings in this area, 38
carried a height tag, and the tagged ones were not reliably right either. Checked afterwards against
LiDAR:

| Building | OSM / guessed | LiDAR measured |
|---|---|---|
| Argo Hall | 22.8 m | **18.3 m** |
| Blake Hall | 15.6 m | **12.4 m** |
| Mandeville Center | 15 m | **25.2 m** |
| McGill Hall | 12 m | **25.5 m** |
| Student Center | 12 m | **23.3 m** |
| Revelle Commons | 10 m | **7.5 m** |

Argo and Blake are the two buildings you stand between at the start of the walk. Both were wrong.

The LiDAR survey (`CA_SanDiegoQL2_2014`) classifies ground and lumps everything else into
"unassigned" — there is no building class. So nothing here asks the data *"is this a building?"*.
It asks *"is this point above ground, and does it stand inside a footprint OSM already drew?"*
That division of labour is the whole design.

---

## Layout

```
docs/            the site — GitHub Pages serves this directly, no build step
  index.html     standalone page + development panel
  js/
    campus-walk.js    the walk: movement, cameras, HUD
    campus-world.js   the world: terrain, massing, surfaces, paths, trees
    campus-route.js   A* over the real footpath graph (no DOM, no three.js)
  data/
    campus-3d.json    OSM footprints, paths, plazas          (~243 KB)
    campus-lidar.json measured heights, terrain grid, trees  (~205 KB)
  vendor/three/  three.js r169, vendored
scripts/
  build-campus-3d.mjs      Overpass -> docs/data/campus-3d.json
  build-campus-lidar.mjs   USGS LiDAR -> docs/data/campus-lidar.json
  serve.mjs                static server for docs/
tests/
  campus-walk.test.mjs     the invariants that have actually broken
```

## Running it

```bash
npm install
npm run serve      # http://localhost:5170
npm test           # 17 tests, no network, no browser
npm run check      # verify the shipped data files without refetching
```

Rebuilding the data needs the network and takes a few minutes:

```bash
npm run build:osm     # Overpass. Tag filters go BEFORE the bbox or it 406s.
npm run build:lidar   # ~102 tiles, 3.3M points, decoded with laz-perf
```

Both write into `docs/data/`, so a rebuild is a normal reviewable diff.

## Controls

| | |
|---|---|
| drag | look around |
| `W` / `S` | move along the walk (`shift` to run) |
| `1` / `2` | eye level / over the shoulder |
| `R` | back to the start |
| `H` | show or hide the development panel |

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

- Building outlines, paths and plazas: © OpenStreetMap contributors, **ODbL**.
- Heights, terrain and trees: **USGS 3DEP** LiDAR (`CA_SanDiegoQL2_2014`), public domain.
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
