// What the campus measures, counted from the files that measure it.
//
// The loading screen quotes numbers at you while it builds, and the previous
// one quoted them from a hand-written sentence in index.html. That sentence
// drifted: it claimed 12,659 trees long after the prune left 7,331, and
// "1,800+ building masses" for a dataset that carries 1,396 footprints. A
// number on screen that nobody recomputes is a number that will be wrong.
//
// So every fact here is derived from the data actually loaded, in the browser,
// at the moment it loads. If the survey changes, the screen changes with it,
// and if a fact cannot be derived it does not get shown.
//
// No DOM and no three.js beyond duck-typed traversal, so the arithmetic is
// testable on its own.

/** Shoelace area of one [[x, z], ...] ring, unsigned. */
export function ringArea(ring) {
  if (!Array.isArray(ring) || ring.length < 3) return 0;
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j];
    const b = ring[i];
    if (!a || !b) return 0;
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(sum) / 2;
}

/** Outer ring minus its holes, for the [outer, ...holes] shape the GIS uses. */
export function polygonArea(rings) {
  if (!Array.isArray(rings) || !rings.length) return 0;
  let area = ringArea(rings[0]);
  for (let i = 1; i < rings.length; i++) area -= ringArea(rings[i]);
  return Math.max(0, area);
}

/** Total length of a [[x, z], ...] polyline, in metres. */
export function lineLength(points) {
  if (!Array.isArray(points)) return 0;
  let m = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b) continue;
    m += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return m;
}

/* Duck-typed rather than instanceof-checked: these run over three.js objects,
   but nothing here should force a WebGL import into a module the tests want to
   run in bare node. */

/** Vertices in every geometry under an object, including the object itself. */
export function countVertices(root) {
  let n = 0;
  root?.traverse?.((o) => {
    const p = o.geometry?.attributes?.position;
    if (p) n += p.count * (o.count || 1); // instanced meshes carry a count
  });
  return n;
}

/** Drawable geometries under an object — the honest draw-call order of magnitude. */
export function countMeshes(root) {
  let n = 0;
  root?.traverse?.((o) => { if (o.geometry) n++; });
  return n;
}

const round = (v, dp = 0) => {
  const p = 10 ** dp;
  return Math.round(v * p) / p;
};

/**
 * Facts knowable from the survey files alone, as soon as they have downloaded.
 * Every entry is `{ key, label, value, unit }`; a missing optional file simply
 * contributes nothing rather than a zero, because "0 landmarks" reads as a
 * fault and "no entry" reads as what it is.
 */
export function surveyFacts({ campus, lidar, arcgis, colors, facades, landmarks, boundary, markings }) {
  const out = [];
  const add = (key, label, value, unit = "") => {
    if (value == null || (typeof value === "number" && !Number.isFinite(value))) return;
    out.push({ key, label, value, unit });
  };

  const t = lidar?.terrain;
  if (t) {
    const width = (t.cols - 1) * t.cell;
    const depth = (t.rows - 1) * t.cell;
    add("terrain-samples", "Terrain samples", t.cols * t.rows);
    add("terrain-grid", "Elevation grid", `${t.cols} × ${t.rows}`);
    add("terrain-cell", "Grid spacing", t.cell, "m");
    add("surveyed-area", "Ground surveyed", round((width * depth) / 1e6, 2), "km²");
    add("extent", "Survey extent", `${round(width / 1000, 2)} × ${round(depth / 1000, 2)} km`);
  }

  if (Array.isArray(lidar?.trees)) {
    add("trees", "Trees placed", lidar.trees.length);
    /* trees are [x, z, height, radius] — the tallest is a fact about the
       canopy, where a mean radius would just be a fact about the algorithm. */
    let tallest = 0;
    for (const tr of lidar.trees) if (Number.isFinite(tr?.[2]) && tr[2] > tallest) tallest = tr[2];
    add("tree-tallest", "Tallest tree", round(tallest, 1), "m");
  }

  if (lidar?.heights) {
    const named = Object.entries(lidar.heights).filter(([, h]) => Number.isFinite(h));
    add("measured-heights", "Heights measured", named.length);
    let top = null;
    for (const [name, h] of named) if (!top || h > top[1]) top = [name, h];
    if (top) add("tallest", "Tallest building", round(top[1], 1), "m");
  }
  if (lidar?.datum != null) add("datum", "Vertical datum", round(lidar.datum, 1), "m");

  if (Array.isArray(campus?.buildings)) {
    add("footprints", "Building footprints", campus.buildings.length);
    let verts = 0;
    for (const b of campus.buildings) verts += b?.p?.length || 0;
    add("footprint-verts", "Footprint vertices", verts);
  }
  if (Array.isArray(campus?.paths)) {
    /* "Paths", not "footpaths": the OSM pull keeps every way you could walk
       along, which includes the asphalt of North Torrey Pines Road as well as
       the concrete between the colleges. Calling the total a footpath network
       would be claiming 230 km of sidewalk the campus does not have. */
    add("paths", "Paths mapped", campus.paths.length);
    let metres = 0;
    for (const p of campus.paths) metres += lineLength(p?.p);
    add("path-network", "Path network", round(metres / 1000, 1), "km");
  }
  if (Array.isArray(campus?.surfaces)) add("surfaces", "Plazas and lots", campus.surfaces.length);
  if (campus?.places) add("places", "Named places", Object.keys(campus.places).length);

  if (Array.isArray(arcgis?.ground)) {
    add("ground-polys", "Surveyed polygons", arcgis.ground.length);
    let verts = 0;
    let area = 0;
    for (const g of arcgis.ground) {
      for (const ring of g?.r || []) verts += ring?.length || 0;
      area += polygonArea(g?.r);
    }
    add("ground-verts", "Polygon vertices", verts);
    /* The GIS rings are DECIMETRES — campus-massing.js and campus-world.js both
       divide them by ten on the way into the world, and the first draft of this
       file did not, so the screen reported 341 km² of paving inside an 8.4 km²
       survey. Length scales by ten, area by a hundred. */
    add("ground-area", "Surveyed surface", round(area / 100 / 1e6, 2), "km²");
  }
  if (Array.isArray(arcgis?.massing)) add("gis-massing", "GIS massing", arcgis.massing.length);

  if (Array.isArray(colors?.terrain?.palette)) {
    add("palette", "Aerial tones", colors.terrain.palette.length);
  }
  if (facades?.walls) add("facades", "Facades measured", Object.keys(facades.walls).length);
  if (Array.isArray(landmarks?.landmarks)) add("landmarks", "Landmarks", landmarks.landmarks.length);

  if (Array.isArray(boundary?.rings?.[0])) {
    const ring = boundary.rings[0];
    add("boundary-verts", "Boundary vertices", ring.length);
    add("boundary-area", "Campus enclosed", round(ringArea(ring) / 1e6, 2), "km²");
    add("boundary-perimeter", "Boundary length", round(lineLength(ring) / 1000, 1), "km");
  }

  if (Array.isArray(markings?.facilities)) {
    let painted = 0;
    for (const f of markings.facilities) painted += f?.markings?.length || 0;
    add("facilities", "Sports surfaces", markings.facilities.length);
    add("markings", "Painted markings", painted);
  }

  return out;
}

/**
 * Facts only the built scene knows: what the geometry actually came to. Kept
 * separate from surveyFacts because these arrive one phase at a time, and the
 * loading screen shows each the moment its phase finishes rather than saving
 * them all for a summary nobody stays to read.
 */
export function geometryFacts({ terrain, buildings, trees, scene }) {
  const out = [];
  const add = (key, label, value, unit = "") => {
    if (!Number.isFinite(value)) return;
    out.push({ key, label, value, unit });
  };
  if (terrain) {
    add("terrain-verts", "Terrain vertices", countVertices(terrain));
    add("terrain-chunks", "Terrain chunks", countMeshes(terrain));
  }
  if (buildings) {
    add("mass-verts", "Building vertices", countVertices(buildings));
  }
  if (trees) add("tree-verts", "Foliage vertices", countVertices(trees));
  if (scene) {
    add("scene-verts", "Vertices in frame", countVertices(scene));
    add("scene-meshes", "Meshes in frame", countMeshes(scene));
  }
  return out;
}

/**
 * Who measured what. Short credits, not the provenance strings verbatim — the
 * `_` field in each file also names the generator script and warns against
 * hand-editing, which is a note to whoever maintains the data, not to whoever
 * is looking at the campus.
 */
export function sourceLines({ campus, lidar, arcgis, colors }) {
  const lines = [];
  if (campus) lines.push("OpenStreetMap — footprints, footpaths, plazas");
  if (lidar) lines.push("USGS 3DEP LiDAR, CA_SanDiegoQL2_2014 — terrain and heights");
  if (arcgis) lines.push("UC San Diego campus GIS — surveyed ground and massing");
  if (colors) lines.push("USDA NAIP aerial imagery — ground and roof colour");
  return lines;
}
