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
| **Satellite imagery** (Google today, Apple selectable) | a build-time SOURCE only: per-polygon measured colours, the painted sports markings, the accuracy cross-checks | rendering — no photograph ever drapes the world |

OSM is very good in plan and close to useless in elevation. Of ~320 buildings in this area, 38
carried a height tag, and the tagged ones were not reliably right either. Checked afterwards against
LiDAR:

| Building | OSM / guessed | LiDAR measured |
|---|---|---|
| Argo Hall | 22.8 m | **18.4 m** |
| Blake Hall | 15.6 m | **12.4 m** |
| Mandeville Center | 15 m | **20.9 m** |
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

### The measured ground

The world stays MODELED — crisp vector geometry in true measured colours; no photograph is ever
pasted on the terrain. The satellite imagery works upstream instead: 87 georeferenced chunks
(0.125–0.25 m/px, reprojected from Web Mercator onto the site's local metre grid,
`docs/data/textures/`) are read at BUILD TIME as a measurement source. `build-campus-truecolor.mjs`
samples every surveyed ground polygon and every roof from them into `campus-truecolor.json`;
`build-campus-markings.mjs` fits the painted sports markings off the same pixels; the accuracy
audits cross-check against them. In the renderer the terrain carries NAIP vertex colours — the
real patchwork of chaparral, lawns and lots — refined polygon-by-polygon with the measured
colours wherever the fine imagery could answer. The official campus boundary is drawn in-world
and on the minimap as a dashed dark-navy line, so the surveyed edge of campus is visible, not
implied.

### The painted lines, as geometry

Every sports surface carries its real markings, drawn as vectors, not photographed:
`scripts/build-campus-markings.mjs` fits each facility's painted layout — centre, orientation,
true extent — to the white paint in the georeferenced chunks (template fit on a local-contrast
whiteness field, hard-bounded coordinate descent), then emits regulation line sets at the fitted
frame into `docs/data/campus-markings.json`: soccer touchlines, boxes, arcs and 9.15 m centre
circles; full tennis and basketball line sets; the track's nine 1.22 m lanes (its north bend
runs past the imagery's edge, so the oval is closed with the 400 m identity) plus its modeled
running surface — a terracotta annulus and green infield, both colours measured off the chunks.
The Muir Field trident is traced straight off the turf as a simplified silhouette polygon. The
Northview tennis banks tilt ~2.5° off the campus grid and their courts stagger, so each court
is fitted individually from the university survey's own pad polygons. Each facility records
`fitError_m` (mean perpendicular offset to the paint) and `fitCoverage` (the fraction of the
emitted line actually lying ON paint — the metric that catches a rotated misfit the offset
metric cannot); the build refuses fits past 0.5 m or under the coverage gate, and a facility
may carry a tighter pair of its own. `docs/js/campus-markings.js`
drapes the result as merged meshes. The heavily faded ghost sets, a few unfittable one-offs,
and Warren Field — whose overlapping painted generations disagree with each other by metres, so
no single regulation set can lie on all of them — are deliberately left unpainted: better
absent than wrong.

**Coverage is resolved per sample, not per facility.** A 10 cm line fills about half a pixel at
0.125 m/px and a quarter at 0.25, so the threshold that decides "is this on paint" has to follow
the source's own resolution — and it did, but it was resolved ONCE, at the facility's centre.
That is the right number only for a facility inside a single chunk. RIMAC's north-west pitch
runs straight across the zoom seam at z = -1128: its centre sits in the fine chunk, so its whole
northern half — real paint, recorded at half the pixel scale — was scored against a threshold
its imagery cannot reach. The pitch measured **0.53** coverage and shipped anyway. Resolved
where each sample actually lands it measures **0.78**, and the fit itself never moved.

**Epochs do not match, on purpose.** The source imagery is current; every height and the ground
surface are the 2014 LiDAR survey (reconciled per mass against the university GIS for what was
built after the survey flew). Where campus changed since 2014, the measured colours and
markings show today and the geometry shows the survey — except where the imagery caught
2023–24 construction, where the colour pipeline skips it and the model keeps its palette.
Nothing here blends the two: heights are never read off the imagery.

**The epoch rule, enforced (2026-08-03).** The 2014 flight predates a decade of construction,
and its returns off the trees, lots and demolished predecessors that occupied those sites are
not measurements — they shipped NTPLLN as bungalows and The Jeannie at tree-canopy height. So:

- `scripts/build-campus-lidar.mjs` keeps a `POST_2014_SITES` list; those names emit **no**
  LiDAR height and no part heights, ever. (No newer public survey exists: the only USGS 3DEP
  datasets over campus are the 2014 QL2, the 2002-05 Scripps strips, and the 2016 coastal
  El Niño flight — all pre-construction for every affected building.)
- Post-2014 buildings take the university GIS massing where it exists, their own OSM tags where
  those match Street View floor counts, and otherwise an entry in `ESTIMATED_POST_2014` in
  `scripts/build-campus-3d.mjs` — floors × storey from 2025 Street View, declared in the build
  script, never silently in the data.
- Sites still being built (the Triton Center block by Price Center) render their **current**
  build state from the `UNDER_CONSTRUCTION` table, not the finished project; demolished
  buildings (Friend's Thrift Shop) are excluded outright; fully underground structures
  (Scholars Parking, under the Sixth College green) never extrude.
- `tests/campus-epoch.test.mjs` pins every one of these classes so a rebuild cannot regress.

### The colours, measured off footage

Satellite imagery sees roofs and ground; it cannot see a wall, a tree trunk, or the sky. For
those, the measurement source is two 4K videos of the real campus — a 53-minute eye-level
walking tour (Nov 2023, clear noon) and a 10-minute drone tour (Nov 2022, marine layer) —
340 extracted frames, each colour below median-sampled from sunlit pixels, never eyeballed:

- **Facades** (`docs/data/campus-facades.json`): per-building wall colours corrected from the
  earlier web-research impressions to frame measurements, and the file grew `styles` (which
  facade tile a building wears — vertical fins, egg-crate, curtain glass, ribbon glazing,
  open balconies, blank bands) and `accents` (trim/glass/panel/roof tones for the multi-material
  buildings). Eye-level frames win facades; drone frames win roofs. `tests/campus-facades.test.mjs`
  keeps every entry keyed to a building the data actually ships.
- **Ground families** (`docs/js/campus-world.js`): the big pavement family is neutral-to-cool
  grey (`#aaaea8`), not beige — six independent frame samples of Ridge Walk, Library Walk and
  Warren Mall converge there. Roads split darker (`#5e6163`) from worn path asphalt. Lawns are
  three families, chosen per polygon from the aerial sample itself: dry turf, irrigated turf,
  and the tan bark duff under the eucalyptus groves — a grove floor is bark, not lawn.
- **Trees** (`docs/js/campus-species.js`): species from the LiDAR's own numbers — tall-and-narrow
  is a eucalyptus (pale bare trunk, small olive crown high up), short-and-broad is a torrey-pine
  umbrella, the middling round crowns split between the lawn species. Frame-sampled foliage and
  trunk hues per species, deterministic per tree, with the stressed near-brown canyon crowns the
  November footage shows. `tests/campus-species.test.mjs` pins the rules.
- **Sky and light**: the measured sky is a gradient (zenith `#3a7cc8` over horizon `#b5d2e6` —
  six frame-measured zeniths), carried by a camera-following dome; the sun sits at November's
  ~35°, the hemisphere ground bounce is pavement-grey instead of olive, and lit-vs-shade
  contrast matches the ~2× luminance drop the frames measure.
- **The furniture** (`docs/js/campus-details.js`): in 340 frames no object appears more often
  than the black lamp post with its banner pair, so the walks now carry them — placed
  deterministically along the named majors at the footage's 18 m rhythm, banner colours by
  zone, plus the perforated bench blocks lining Library Walk, the royal-blue emergency towers,
  and chrome-yellow hydrants. One-offs the route passes — the Revelle Plaza ring fountain and
  flagpole, the Ridge Walk pergola swing stations, the Mayer/Bonner folded-plate canopy — live
  in `campus-landmarks.json` with frame-measured colour blocks. `tests/campus-details.test.mjs`
  keeps every placement out of the buildings and on its rhythm. 

- **The Muir athletics zone** (`docs/js/campus-athletics.js`, `campus-recreation.js`,
  `campus-muir-field.js`, `campus-goal.js`): built 1:1 from seven aerial reference captures — the Main Gym's
  eleven pale barrel vaults with their transverse walkway seams, the Natatorium's white
  skylight grid with the lap-lane blues reading through the glass and the spa on its
  terracotta deck, both tennis pads in their real two-block identity (green-on-red west,
  blue-on-grey east) with nets and light poles, basketball hoops, the sand volleyball courts
  and their nets, Triton Bar Park's calisthenics rigs on black rubber, the rec terrace's mats
  and canopy tents, parked cars in Gymnasium Lot, and John Muir Field's dark turf with its
  softball fans, wordmark strips, goals and end netting. Every colour median-sampled from the
  captures; each module's placement rules are pinned by its own test file.

  A goal is frame **and** net. For as long as the model had goals it had only the frame —
  two posts, a crossbar and a shallow back rake, over a comment claiming the rake ran "to
  the net" for a net nothing in the repository drew — so from above, the one view that sees
  a whole pitch, the goals read as absent. `campus-goal.js` now builds both, and builds them
  for any pitch rather than for Muir's. **Law 1 measures the air, not the steel**, and that
  cost 12 cm one way and 6 cm the other before it was believed: the 7.32 m is between the
  posts' INNER edges, so the posts stand half a gauge outboard of the mouth line where the
  inline version centred them on it, and the 2.44 m is the crossbar's LOWER edge, so the bar
  rests on the posts where the first draft of this module centred it at the height instead
  and hung a 2.38 m mouth under a bar driven through the top of both posts. Every horizontal
  member now sits on its uprights, and a test asserts the derived edges rather than the
  centres that are easier to reach — the earlier one named the lower edge in its failure
  message while checking the centre, so it passed on the wrong geometry. The net is hung as
  real cords on a 0.12 m square mesh — the coarse end of
  the 100–120 mm full-size nets are made in — up the back, over the rake from crossbar to
  back rail and closing both sides, drawn as lines rather than modelled members because
  2–4 mm twine is far below a pixel at every distance a walker sees a goal from. It is given
  no sag: the nadir aerial is the one view a sag is invisible from, so the rake stays
  straight rather than curved by invention.

- **RIMAC Field** (`docs/js/campus-rimac.js`, plus its four pitches in `campus-markings.json`):
  the same two-source split, stated harder.

  **The flats are FOUR pitches, two columns by two rows** — and the model carried two, both in
  the *western* column, with the entire eastern column missing. The columns are the touchlines'
  own projection peaks (west x 74.9–140.6, east x 142.1–202.9, two lines 1.5 m apart at the seam
  between them); the rows come from scoring the whole rulebook at once — goal lines, halfway,
  penalty areas and goal areas at their fixed offsets — so a ghost line or a kerb cannot pass for
  a pitch by producing one peak. Three of the four are painted, at 0.78 / 0.91 / 0.84 coverage
  and 0.22–0.25 m offset. The north-east is **not**: the registered imagery holds its two
  touchlines and nothing else — no circle, no halfway line, no goal line, no boxes — so no
  regulation set can be fitted to it, its entry stays so a future imagery refresh re-measures
  it, and the coverage gate is expected to keep dropping it. The east column also carries a
  second complete generation 18.1 m north of the current south-east pitch, which fits *better*
  (0.90) than the pitch that is actually there; what separates them is that the south row is a
  **row**, and a test pins it. RIMAC's four run a tighter gate than the rest of the build —
  0.75 coverage and 0.35 m — because this is where a loose fit got through once.

  The complex's southern corner is a **regulation softball field**, and it is measured, not
  assumed: both painted foul lines least-squares fit the georeferenced chunks at 2.75° and
  92.44° north of east (rms 0.050 m / 0.054 m) — **89.69° apart**, so the diamond is modelled
  as a true right angle on their bisector, which then lands back on both fits to under 0.25 m
  over 58 m. Home plate is their intersection. The pitching circle is found twice over, as the
  centre of the circle fitted to the skinned infield's arc and as the object parked on the
  plate — 0.14 m apart, 42.1 ft from home where the rulebook says 43 — and that skin arc comes
  out at 60.3 ft, the rulebook's 60 ft grass line, a radius nothing was fitted to. The outfield
  then falls out at ~190 ft down both lines and 209 ft to centre, so the fence stands at about
  200 and 220. Also built: the warning track as a band of its four separately measured widths,
  the outfield fence with its dark windscreen, the east perimeter fence against North Torrey
  Pines Road (rms 0.246 m over 428 rows), the three-block west bleacher, and the flats'
  **patchy turf** — a 3.54 m tercile map sampled off the georeferenced chunks and painted in
  colours measured off the current Apple captures, because where the dry ground is has to come
  from the registered source and what it looks like today from the current one. That map is
  sampled on ONE quad spanning all four pitches, its edges the outermost painted lines the four
  of them own; it used to be keyed to each fitted pitch's own bounds, which tied how the
  *ground* looks to whether that pitch's *paint* cleared a gate. No backstop is
  modelled: nothing in either source resolves one. Every VERTICAL dimension here is a stated
  convention — nadir imagery cannot see a height and the 2014 LiDAR ships no raw returns.

```
docs/            the site — GitHub Pages serves this directly, no build step
  index.html     standalone page + development panel
  js/
    campus-walk.js      the walk: movement, cameras, HUD, boot
    campus-world.js     the world: terrain (NAIP vertex colours), surfaces, paths, trees, boundary
    campus-massing.js   buildings: the university GIS's per-mass extrusions
    campus-explore.js   free roam: position, hover, the velocity model (no DOM)
    campus-minimap.js   the minimap: aerial underlay, boundary ring, click-to-teleport
    campus-landmarks.js labels + placed landmarks (Fallen Star, Sun God…)
    campus-route.js     A* over the real footpath graph (no DOM, no three.js)
    campus-ground.js    the surveyed ground polygons: clip + tile at load (no DOM)
    campus-terrain.js   height sampler, chunk grid, boundary rings (no DOM)
    campus-rimac.js     RIMAC Field: softball field, fencing, bleacher, patchy turf
    campus-drape.js     shared draping geometry: fills, ribbons, bands, merged solids
  data/
    campus-3d.json         OSM footprints, paths, plazas
    campus-lidar.json      measured heights, terrain grid, trees
    campus-arcgis.json     the university GIS: masses + ground polygons
    campus-colors.json     NAIP aerial colours: terrain grid, roofs, ground
    campus-truecolor.json  measured colours from the Google chunks (see below)
    campus-facades.json    facade palettes
    campus-landmarks.json  placed landmarks
    campus-boundary.json   the campus boundary polygon, local metres
    campus-markings.json   sports-surface markings, fitted to the imagery
    textures/              satellite ground chunks + manifest.json
  vendor/three/  three.js r169, vendored
scripts/
  build-campus-3d.mjs        Overpass -> docs/data/campus-3d.json
  build-campus-lidar.mjs     USGS LiDAR -> docs/data/campus-lidar.json
  build-campus-arcgis.mjs    university GIS -> docs/data/campus-arcgis.json
  build-campus-colors.mjs    NAIP -> docs/data/campus-colors.json
  build-campus-truecolor.mjs textures/ chunks -> docs/data/campus-truecolor.json
  build-campus-satellite.mjs boundary + satellite source -> boundary json, textures/
  lib/imagery.mjs            the imagery providers: Google tiles, Apple snapshots
  audit-imagery-source.mjs   resolved detail per metre, source vs source
  build-campus-markings.mjs  textures/ chunks -> docs/data/campus-markings.json
  audit-accuracy.mjs         R2 cross-source audit -> scripts/reports/
  serve.mjs                  static server for docs/
tests/
  campus-walk.test.mjs     the invariants that have actually broken
  campus-arcgis.test.mjs   the survey layer: masses, ground polygons, colours
  campus-gameplay.test.mjs the removed footway, spawn, speed cap, minimap arithmetic
  campus-textures.test.mjs the satellite layer: manifest vs grid vs boundary, ground coverage
  campus-imagery.test.mjs  the source layer: patch georeferencing, the Apple signing scheme
  campus-truecolor.test.mjs the measured-colour layer: keys resolve, gamut holds, turf beats pavement
  campus-markings.test.mjs the painted lines: bounds, widths, 9.15 m circles, 9 lanes
  campus-rimac.test.mjs    RIMAC Field: the regulation cross-checks, the turf quad, the fences
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

`build:satellite` builds only the terrain chunks that touch the boundary polygon (87 of 132
over the full campus), fetches only source imagery that touches it too, hard-caps itself at
3,500 requests per run, and caches raw imagery under `.cache/<source>/` so a rerun refetches
nothing. The chunks it writes are the SOURCE imagery for the colour and markings pipelines
above — they never render in-world.

### Which satellite, and how you would know

The imagery source is a provider (`scripts/lib/imagery.mjs`), chosen with `--source`:

| | zoom 19 | zoom 20 | credential |
|---|---|---|---|
| `google` (shipped) | 0.251 m/px | 0.125 m/px | `GOOGLE_MAPS_API_KEY` — Map Tiles API 2D satellite session |
| `apple` | 0.125 m/px | **0.063 m/px** | `APPLE_MAPKIT_TEAM_ID`, `APPLE_MAPKIT_KEY_ID`, `APPLE_MAPKIT_KEY_FILE` — a MapKit JS key |

Apple serves no tile endpoint a third party may use; the licensed way in is the Maps Web
Snapshot service, where one signed request returns one rendered image of a stated centre,
zoom, size and scale — a georeferenced patch by another name, because a snapshot at zoom *z*
sits on exactly the Web Mercator grid a tile at zoom *z* does. `scale=2` is the entire point:
the same zoom at twice the linear resolution. Two things the service forces, both handled in
the provider: images cap at 640×640 points, so a 255 m chunk needs several; and every image
carries Apple's logo and legal line burned in. Those are not removed — each snapshot is
cropped to its middle and the lattice steps by the cropped span, so a branded margin is always
covered by a neighbour's clean centre and no branded pixel is ever measured.

**Stated resolution is not resolved detail, and only the second one matters.**
`scripts/audit-imagery-source.mjs` measures both, per metre of ground rather than per pixel,
so sources at different pixel scales compare honestly:

```bash
npm run audit:imagery -- --facility=muir-tennis-west
```

Run against the shipped Google chunks it reports **0.25 m** of resolved edge detail out of
imagery stored at 0.125 m/px — two stored pixels per edge, where a source resolving its own
pixel scale would give one. Some of that softness is ours (the build's bilinear reprojection
and JPEG q80), so the number is not a verdict on Google's sensor alone; what it does measure
honestly is the detail that actually reaches the colour and marking pipelines, and it is
roughly half what the pixel count advertises. That is the measured company `muir-tennis-west`
keeps at 0.43 coverage: a 5 cm painted line does not survive a quarter-metre edge.

Both sources pass through the identical pipeline, so the comparison stays fair even though
neither number isolates the sensor. A source swap is only worth making if the audit shows the
new source resolving finer edges — not merely storing more pixels.

### Switching the source

A full rebuild is several hundred signed requests, so spend one first. `--probe` fetches only
the patches over a single facility, checks that the service still returns the size the
georeferencing contract assumes, correlates the result against the shipped chunks to prove the
imagery lands where the survey says it should, and measures whether it is actually sharper:

```bash
# .env: APPLE_MAPKIT_TEAM_ID, APPLE_MAPKIT_KEY_ID, APPLE_MAPKIT_KEY_FILE
node scripts/audit-imagery-source.mjs --facility=muir-tennis-west --probe=apple
npm run build:satellite:apple     # only if the probe justifies it
npm run build:truecolor && npm run build:markings   # re-measure from the new pixels
npm test && npm run check
```

A georegistration offset past ~0.6 m is a stop sign, not a detail: colours would be sampled
off the neighbouring surface, and a sharper source landing in the wrong place is worse than a
soft one landing in the right one.

Because the chunk grid, output resolution and manifest shape are identical either way, the
swap changes one thing and the audit measures one variable. Rebuilding the shipped Google
chunks through the provider path reproduces all 87 files byte for byte; only the manifest
gains its `source` / `sourceMPerPx` provenance, which every downstream measurement inherits.
A denser source is spent on supersampling (`k` source pixels averaged per output pixel), not
on bigger files — extra resolution has to arrive as accuracy, not as aliasing.

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
- **A per-sample quantity resolved once, for the whole object, is a bug waiting on geometry.**
  The paint threshold correctly follows the imagery's resolution — and was read at the
  facility's centre and applied to every sample, which is right until a facility spans two
  chunks. RIMAC's north-west pitch crosses the zoom seam; half of it was judged against a
  threshold its own imagery cannot reach, it measured 0.53, and the 0.53 was read as "the paint
  isn't there" rather than "the metric is wrong here". Both halves of that sentence cost time.
- **A better fit can be the wrong object.** RIMAC's east column carries two complete painted
  generations 18.1 m apart. The older one fits at 0.90 coverage, the current one at 0.84, and
  no fit-quality metric will ever prefer the right one. What tells them apart is that the pitch
  has to line up with its own row — a fact about the layout, not about the paint.
- **A test that checks a different quantity from the one its message names is worse than no
  test.** `assert(bar.at[1] === 2.44, "the crossbar's lower edge is not at 2.44 m")` reads a box
  CENTRE, so it passed while the goal's mouth was 2.38 m tall and the bar ran through the top of
  both posts — and it would have gone on passing through exactly the change it existed to catch.
  Assert the derived edge, `at[1] - h/2`. The same shape of mistake hides anywhere a regulation
  is stated about a surface and the code stores a middle.

## Provenance

Extracted from the TritonPlan repository, where it began as a tile on the dashboard. Originating
commits: `194be3c` (the scooter game this grew out of, now parked), `548dfc3` (the move to measured
geometry). It will fold back into TritonPlan once it stands up on its own.

## Data licences

- Building outlines, paths, plazas and the campus boundary: © OpenStreetMap contributors, **ODbL**.
- Heights, terrain and trees: **USGS 3DEP** LiDAR (`CA_SanDiegoQL2_2014`), public domain.
- Measured colours and fitted markings derive at build time from the imagery source named in
  `docs/data/textures/manifest.json` — today **Imagery © Google** (Map Tiles API), current
  epoch; **Imagery © Apple** (Maps Web Snapshot) is the selectable alternative and carries its
  own credit line into the same field. No tile imagery renders in-world under either. Heights
  remain 2014 LiDAR; see the epoch note above.
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

Where the georeferenced satellite chunks under `docs/data/textures/`
reach (0.125–0.25 m/px against NAIP's ~0.6), the colours are re-measured
per polygon from them — the imagery stays a build-time SOURCE, never a
texture. `build-campus-truecolor.mjs` masks each surveyed surface and
each roof (edges eroded, harder with height, so walls and shadows stay
out), rejects shadow pixels, takes the per-channel median in linear
light, and clamps the result into the site's palette family so one bad
sample can never ship a neon roof. Keys are geometry hashes (outer-ring
centroid, not array index), so the file survives data rebuilds; a moved
footprint just falls back to the NAIP/palette colour. Chunks over the
flagged 2023–24 construction sites are skipped — the model there keeps
its palette rather than inheriting a dirt lot.

The 2014 LiDAR remains the referee for everything it saw and is
overruled for everything built after it flew — it "measured" Sankofa at
8.4 m, the parking lot the tower replaced. Heights reconcile per mass.

Free roam (F) goes anywhere from eye level to 900 m up, with a
logarithmic velocity slider and teleport to any of 360+ named places.
Labels (L) name every building in view, depth-tested so a hidden
building keeps its name to itself. Fallen Star hangs off the Jacobs
Hall tower corner at its published 10 degrees, baby blue with a brick
chimney; the Sun God and the Warren Bear stand where they stand.
