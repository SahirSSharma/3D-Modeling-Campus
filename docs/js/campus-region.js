// The land around the campus — Torrey Pines to the Village of La Jolla.
//
// The campus is an 8.4 km² box on a mesa. Everything outside it used to be a
// flat apron and then a wall, because that is where the measurements stopped.
// This draws the other 30 km²: the bluff, the beach, Rose Canyon, the freeway
// embankments, and the ocean the bluff falls into.
//
// TWO SAMPLINGS, ONE SURFACE. The campus keeps its 3 m grid. This grid is 6 m,
// phase-aligned to it, and inside the campus box it carries the campus's own
// heights verbatim (see scripts/build-region-terrain.mjs) — so the two meshes
// meet on shared values, not on a tolerance. The region mesh simply does not
// draw over the campus box; there is nothing to blend.
//
// WHERE THERE IS NO LAND. Cells with no ground return and no small-hole fill
// are the Pacific. They get no triangles at all, and the sea plane shows
// through. That is deliberate: hole-filling across a coastline grows a shelf
// of invented land out to the horizon, so the builder refuses to, and the
// renderer draws water rather than pretending the gap is ground.
import * as THREE from "../vendor/three/three.module.min.js";

/* Mesh sampling for the region, as a multiple of the data's 6 m cell. The
   campus is 3 m because you walk it. Two cells — 12 m — is the right sampling
   for a canyon wall two kilometres away, and it is a quarter of the triangles.
   The coastline is the one place this shows, which is why COAST_STEP exists. */
export const REGION_STEP = 2;

/* The shoreline gets sampled at the full 6 m, because it is the silhouette the
   whole expansion exists to show and a 12 m staircase along it reads as a bug
   rather than as a coast. "Near the shore" means within this many metres of a
   cell that has no land in it. */
export const COAST_STEP = 1;
export const COAST_BAND_M = 180;

/* Sea level, in metres ABSOLUTE. The 2014 survey's lowest measured ground in
   this region is 0.2 m, which is wet sand at the waterline, so mean sea level
   sits essentially at zero and the datum conversion is the whole story. */
export const SEA_LEVEL_M = 0;

/* Measured, with a stated limitation. Three open-water patches sampled from
   the reference capture Sahir supplied (2026-08-06), well west of the surf
   line so no sand or whitewater is in the average:
       deep       rgb(77, 98, 155)   #4d629b
       mid        rgb(68, 84, 121)   #445479
       offshore   rgb(55, 83, 131)   #375383
   Mean rgb(67, 88, 136). THE LIMITATION: that is water seen from straight
   above. From the top of the bluff you see it at a grazing angle, where more
   of what reaches your eye is reflected sky and the water reads lighter and
   bluer. This value is uncorrected for that, so it is a measurement of the
   right water under the wrong geometry — better than a guess, and worth
   replacing with an eye-level read from the cliff when one exists. */
export const OCEAN_COLOR = 0x435888;
export const OCEAN_COLOR_PROVENANCE = {
  frames: ["CleanShot 2026-08-06 17.20.57 — Google Maps satellite, supplied by Sahir"],
  patches: { deep: "#4d629b", mid: "#445479", offshore: "#375383" },
  geometry: "top-down; not corrected for grazing-angle sky reflection",
};

/* THE FALLBACK, not the ground colour. region-colors.json now measures the
   ground per 6 m cell from Google satellite z19 (0.25 m/px), on this grid's own
   lattice, and buildRegionMesh paints those as vertex colours. This constant is
   what a cell gets when the sampler has nothing for it — and the mesh falls
   back to it rather than rendering black, because a hole in the world is worse
   than a flat colour.
   It stays inherited: EIGHTH_COLORS.dryLawn, read off Eighth College ref3 as
   the only clean unshaded sample of UNIRRIGATED ground in full sun.
   Worth recording that the measurement overturned the reasoning behind this
   value. The note here used to argue coastal sage scrub reads dry tan for most
   of the year, so a tan stand-in was safe. Sampled, the region's median cell is
   green — hue 120°, #76817a — because the imagery caught canyon chaparral and
   irrigated University City, not the dry lawn this was borrowed from. The
   stand-in was defensible and it was also wrong, which is the argument for
   measuring rather than reasoning about colour. */
export const REGION_GROUND_COLOR = 0xab9d83;
export const REGION_GROUND_PROVENANCE = {
  measuredForRegion: true,
  measured: "region-colors.json `terrain`, Google satellite z19, per 6 m cell, 601,874 cells",
  fallback: {
    inherited: "EIGHTH_COLORS.dryLawn",
    source: "Eighth College ref3, unshaded unirrigated ground in full sun",
    appliesTo: "cells with no sample, and every cell if the colour file is absent or fails its grid check",
  },
  limitation:
    "top-down colour, so it describes ground cover and not the side of anything; " +
    "and a 6 m cell is one colour for 36 m² of world, which blurs a kerb into its lawn",
};

/**
 * A sampler over the packed regional grid.
 *
 * Returns metres relative to the shared datum, or null where the region has no
 * land — which callers must handle rather than coerce, because "no land here"
 * and "land at 0 m" are different facts and conflating them is how an ocean
 * becomes a plateau.
 */
export function regionSampler(header, heights) {
  const { x0, z0, cell, cols, rows, nodata } = header;
  const at = (c, r) => {
    if (c < 0 || c >= cols || r < 0 || r >= rows) return null;
    const v = heights[r * cols + c];
    return v === nodata ? null : v / 10;
  };
  return {
    at,
    colOf: (x) => Math.round((x - x0) / cell),
    rowOf: (z) => Math.round((z - z0) / cell),
    xOf: (c) => x0 + c * cell,
    zOf: (r) => z0 + r * cell,
    /** Nearest-sample height at a world position, or null over water. */
    heightAt(x, z) {
      return at(Math.round((x - x0) / cell), Math.round((z - z0) / cell));
    },
    bounds: {
      x0, z0,
      x1: x0 + (cols - 1) * cell,
      z1: z0 + (rows - 1) * cell,
    },
  };
}

/**
 * Measured ground colour, as a lookup by terrain-grid cell.
 *
 * region-colors.json ships a quantised palette plus one index per cell —
 * exactly the shape campus-colors.json uses, because it is solving the same
 * problem: 1.47 million colours as text would be tens of megabytes to parse on
 * the main thread, and as a palette index it is one byte a cell.
 *
 * THE JOIN IS POSITIONAL, so it is checked. The colour grid and the height
 * grid are produced by different builders, and the only thing making index i
 * mean the same patch of ground in both is that they were cut on the same
 * lattice. If that ever stops being true the world gets its ground colours
 * offset by some number of cells — which looks like nothing at all until you
 * notice a road running through a field beside the road. So a mismatch refuses
 * the whole file and the region falls back to its honest inherited tan.
 *
 * Returns null when there is no usable colour, which callers must treat as
 * "use the flat colour" rather than as black.
 */
export function regionColorLookup(colors, header) {
  const g = colors?.terrain;
  if (!g || !g.idx || !Array.isArray(g.palette)) return null;
  if (g.x0 !== header.x0 || g.z0 !== header.z0 || g.cell !== header.cell ||
      g.cols !== header.cols || g.rows !== header.rows) {
    return null;
  }
  const idx = Uint8Array.from(atob(g.idx), (ch) => ch.charCodeAt(0));
  if (idx.length !== header.cols * header.rows) return null;

  /* Palette decoded once into linear float triples: doing the hex parse per
     vertex would run it a million times for a few dozen distinct answers. */
  const none = g.none ?? 255;
  const table = g.palette.map((hex) => {
    const c = new THREE.Color(hex);
    return [c.r, c.g, c.b];
  });
  const fallback = (() => {
    const c = new THREE.Color(REGION_GROUND_COLOR);
    return [c.r, c.g, c.b];
  })();

  const { cols, rows } = header;
  return (c, r) => {
    if (c < 0 || c >= cols || r < 0 || r >= rows) return fallback;
    const k = idx[r * cols + c];
    if (k === none) return fallback;
    return table[k] || fallback;
  };
}

/**
 * Which samples sit near open water, so the coast can be meshed finer.
 *
 * A flood outward from every landless cell, bounded by the band width. Doing
 * it by distance transform rather than by testing each candidate keeps this
 * linear in the grid rather than quadratic in the coastline.
 */
export function coastMask(header, heights) {
  const { cols, rows, cell, nodata } = header;
  const band = Math.ceil(COAST_BAND_M / cell);
  const dist = new Uint8Array(cols * rows).fill(255);
  let queue = [];
  for (let i = 0; i < heights.length; i++) {
    if (heights[i] === nodata) { dist[i] = 0; queue.push(i); }
  }
  for (let d = 0; d < band && queue.length; d++) {
    const next = [];
    for (const i of queue) {
      const r = (i / cols) | 0;
      const c = i % cols;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) continue;
        const j = rr * cols + cc;
        if (dist[j] !== 255) continue;
        dist[j] = d + 1;
        next.push(j);
      }
    }
    queue = next;
  }
  return dist;
}

/**
 * Is this sample inside the campus box, where the campus mesh already draws?
 *
 * Inclusive of the boundary: the region must not draw ON the campus edge
 * either, or two coincident triangles z-fight along the most-looked-at line in
 * the world.
 */
function makeInCampus(campusTerrain) {
  if (!campusTerrain) return () => false;
  const { x0, z0, cell, cols, rows } = campusTerrain;
  const x1 = x0 + (cols - 1) * cell;
  const z1 = z0 + (rows - 1) * cell;
  return (x, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1;
}

/**
 * Build the regional terrain mesh.
 *
 * Emits a quad only where all four of its corners are land, so the coastline
 * falls out of the data instead of being drawn from a separate line. Chunked
 * so the renderer can frustum-cull: from the ground you can see a few hundred
 * metres of this, and paying to transform 30 km² of it every frame to look at
 * a courtyard is the kind of cost that makes a walk stutter.
 */
export function buildRegionMesh(
  header, heights, campusTerrain, { color = REGION_GROUND_COLOR, colorAt = null } = {}
) {
  const s = regionSampler(header, heights);
  const inCampus = makeInCampus(campusTerrain);
  const coast = coastMask(header, heights);
  const { cols, rows, cell } = header;
  const CHUNK = 96; // samples per chunk edge

  const group = new THREE.Group();
  group.name = "region-terrain";
  /* MEASURED colour when there is any, the inherited tan when there is not.
     Per-vertex rather than per-chunk, for the same reason the campus terrain
     carries NAIP vertex colours: the interesting thing about this ground is
     that it is NOT uniform — asphalt, chaparral, irrigated turf and parking
     lots all meet inside a single 500 m chunk, and a per-chunk colour would
     average exactly the variation worth showing.
     Note this is still a MEASUREMENT, not a texture: the imagery was sampled
     at build time into one colour per terrain cell and the photograph itself
     never reaches the browser. */
  const material = colorAt
    ? new THREE.MeshLambertMaterial({ vertexColors: true })
    : new THREE.MeshLambertMaterial({ color });
  let quads = 0;

  const nearCoast = (c, r) => coast[r * cols + c] !== 255;

  for (let r0 = 0; r0 < rows - 1; r0 += CHUNK) {
    for (let c0 = 0; c0 < cols - 1; c0 += CHUNK) {
      const position = [];
      const normal = [];
      const rgb = [];
      const r1 = Math.min(r0 + CHUNK, rows - 1);
      const c1 = Math.min(c0 + CHUNK, cols - 1);

      for (let r = r0; r < r1; ) {
        /* Step is chosen per ROW BAND rather than per quad: a quad whose
           corners were chosen at different steps would not share vertices with
           its neighbour and would crack. */
        let step = REGION_STEP;
        for (let c = c0; c < c1; c += 1) {
          if (nearCoast(c, r)) { step = COAST_STEP; break; }
        }
        for (let c = c0; c < c1; c += step) {
          const cc = Math.min(c + step, c1);
          const rr = Math.min(r + step, r1);
          if (cc === c || rr === r) continue;
          const x = s.xOf(c);
          const z = s.zOf(r);
          const xe = s.xOf(cc);
          const ze = s.zOf(rr);
          /* Skip anything the campus already draws — including the boundary,
             so no two triangles are ever coincident. */
          if (inCampus(x, z) || inCampus(xe, ze) || inCampus(x, ze) || inCampus(xe, z)) continue;

          const a = s.at(c, r);
          const b = s.at(cc, r);
          const d = s.at(c, rr);
          const e = s.at(cc, rr);
          /* All four corners must be land. A quad with one corner in the sea
             is the coastline, and the honest edge is the one that leaves it
             out. */
          if (a == null || b == null || d == null || e == null) continue;

          const span = step * cell;
          const nA = [-(b - a) / span, 1, -(d - a) / span];
          const inv = 1 / Math.hypot(nA[0], 1, nA[2]);
          const nx = nA[0] * inv;
          const ny = inv;
          const nz = nA[2] * inv;

          position.push(x, a, z, x, d, ze, xe, b, z);
          position.push(xe, b, z, x, d, ze, xe, e, ze);
          for (let k = 0; k < 6; k++) normal.push(nx, ny, nz);
          if (colorAt) {
            /* One colour per CORNER, so a road crossing a cell reads as a
               gradient rather than snapping at the cell boundary. The two
               triangles share corners in the order pushed above. */
            const cA = colorAt(c, r);
            const cB = colorAt(cc, r);
            const cD = colorAt(c, rr);
            const cE = colorAt(cc, rr);
            rgb.push(...cA, ...cD, ...cB);
            rgb.push(...cB, ...cD, ...cE);
          }
          quads++;
        }
        r += step;
      }

      if (!position.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
      geo.setAttribute("normal", new THREE.Float32BufferAttribute(normal, 3));
      if (rgb.length === position.length) {
        geo.setAttribute("color", new THREE.Float32BufferAttribute(rgb, 3));
      }
      geo.computeBoundingSphere();
      group.add(new THREE.Mesh(geo, material));
    }
  }

  return { group, quads, chunks: group.children.length };
}

/**
 * How far east the sea is allowed to reach, measured from the data.
 *
 * THE BUG THIS EXISTS TO FIX. The first sea was one 9 km plane centred on the
 * origin, on the reasoning that it sits below every piece of land so it can
 * only ever show through where there is no land. That reasoning is sound and
 * the conclusion was still wrong, because "no land" is not the same as "water":
 * roughly 43% of the terrain grid's bounding box lies OUTSIDE the region
 * outline and was never built. Standing in University City and looking south,
 * past the edge of the outline, you saw open ocean four kilometres inland.
 *
 * So the sea is bounded by where water actually is. Every unmeasured cell
 * INSIDE the outline is water (that is what the builder's elevation test
 * decided), and the easternmost of them is the true inland limit of the
 * Pacific in this region. Out-of-scope cells are excluded, which is the whole
 * point: they are not sea, they are not anything.
 */
export function oceanEastLimit(header, heights, outlineLocal) {
  const { x0, z0, cell, cols, rows, nodata } = header;
  if (!Array.isArray(outlineLocal) || outlineLocal.length < 3) return null;
  const ring = outlineLocal;
  const inPoly = (px, pz) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, zi] = ring[i];
      const [xj, zj] = ring[j];
      if (zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
  };
  /* Column-major from the EAST, breaking on the first column that holds any
     in-scope water: the answer is a maximum, so there is nothing to learn from
     the rest of the grid once one is found. In practice this touches a few
     percent of the cells rather than all 1.5 million. */
  for (let c = cols - 1; c >= 0; c--) {
    const x = x0 + c * cell;
    for (let r = 0; r < rows; r++) {
      if (heights[r * cols + c] !== nodata) continue;
      if (!inPoly(x, z0 + r * cell)) continue;
      return x + cell;
    }
  }
  return null;
}

/**
 * The sea.
 *
 * A single quad at mean sea level, running west from the measured inland limit
 * of the water and far enough in the other three directions to reach the fog.
 * It is drawn UNLIT: a Lambert surface at this size takes the scene's one
 * directional light and reads as a flat tone that shifts as you turn, which
 * looks like a mistake. Unlit at a measured colour reads as water.
 */
export function buildOcean(datum, { eastX = null, reachM = 9000 } = {}) {
  const y = SEA_LEVEL_M - datum;
  /* No measured limit means no way to say where the sea stops, and a sea of
     unknown extent is worse than none — it would be drawn under land the
     renderer simply has not got round to. */
  if (eastX == null) return null;

  const west = eastX - reachM;
  const geo = new THREE.PlaneGeometry(reachM, reachM * 2);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ color: OCEAN_COLOR })
  );
  mesh.position.set((west + eastX) / 2, y, 0);
  mesh.name = "ocean";
  mesh.userData.eastX = eastX;
  /* Behind everything: the sea must never win a depth tie against a beach
     drawn at almost the same height. */
  mesh.renderOrder = -1;
  return mesh;
}
