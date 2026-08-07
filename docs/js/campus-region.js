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
 * The rectangle the campus mesh already draws, in local metres — or null when
 * there is no campus, in which case the region owns everything.
 */
export function campusRect(campusTerrain) {
  if (!campusTerrain) return null;
  const { x0, z0, cell, cols, rows } = campusTerrain;
  return { x0, z0, x1: x0 + (cols - 1) * cell, z1: z0 + (rows - 1) * cell };
}

/**
 * Trim a region quad back to the edge of the campus rectangle.
 *
 * WHY THIS EXISTS, because the obvious thing was wrong and shipped. The first
 * version simply skipped any quad with a corner inside the campus, on the
 * sound reasoning that two coincident triangles z-fight along the most
 * looked-at line in the world. But the region grid is 6 m and the campus
 * boundary does not land on a 6 m line, so "skip the whole quad" threw away up
 * to a full quad span of ground OUTSIDE the campus as well — an unbroken gap
 * around the entire campus perimeter, measured at ~2 m of open sky at the east
 * edge and up to 12 m at region step. A hole you can see the sky through, and
 * at eye level a chasm.
 *
 * Trimming keeps both properties: the region still never draws on ground the
 * campus owns, and the two meshes now meet exactly instead of nearly.
 *
 * Returns null when the quad is entirely inside the campus (skip it), the
 * quad unchanged when it does not touch the campus at all, or a trimmed
 * rectangle. Heights and colours at a moved corner are bilinearly interpolated
 * within the original quad, which is exact for the plane the quad already is.
 *
 * The one case this does not resolve exactly is a quad straddling a CORNER of
 * the campus rectangle, where the outside region is an L and no single
 * rectangle covers it. There we trim on both axes, which covers the diagonal
 * arm and leaves the two thin arms — four sub-quad gaps in the world instead
 * of a continuous perimeter one. Stated rather than hidden.
 */
export function trimQuadToCampus(q, rect) {
  if (!rect) return q;
  const { x0, z0, x1, z1 } = rect;
  /* No overlap at all: the common case, and it must stay cheap. */
  if (q.xe <= x0 || q.x >= x1 || q.ze <= z0 || q.z >= z1) return q;
  /* Entirely inside: the campus draws all of it. */
  if (q.x >= x0 && q.xe <= x1 && q.z >= z0 && q.ze <= z1) return null;

  let nx = q.x, nxe = q.xe, nz = q.z, nze = q.ze;
  const spansZ = z0 <= q.z && z1 >= q.ze;
  const spansX = x0 <= q.x && x1 >= q.xe;
  if (!spansZ || spansX) {
    /* Trim in z: the campus covers this quad's full width, or the corner case. */
    if (z0 <= q.z && z1 > q.z && z1 < q.ze) nz = z1;
    else if (z1 >= q.ze && z0 > q.z && z0 < q.ze) nze = z0;
  }
  if (!spansX || spansZ) {
    if (x0 <= q.x && x1 > q.x && x1 < q.xe) nx = x1;
    else if (x1 >= q.xe && x0 > q.x && x0 < q.xe) nxe = x0;
  }
  if (nxe - nx <= 0 || nze - nz <= 0) return null;
  if (nx === q.x && nxe === q.xe && nz === q.z && nze === q.ze) return q;
  return { x: nx, xe: nxe, z: nz, ze: nze };
}

/**
 * Bilinear value at (x, z) inside the quad the four corner values describe.
 * a = (x,z), b = (xe,z), d = (x,ze), e = (xe,ze) — the order buildRegionMesh
 * samples them in.
 */
export function bilinear(q, a, b, d, e, x, z) {
  const u = q.xe === q.x ? 0 : (x - q.x) / (q.xe - q.x);
  const v = q.ze === q.z ? 0 : (z - q.z) / (q.ze - q.z);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + d * (1 - u) * v + e * u * v;
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
  const rect = campusRect(campusTerrain);
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
          const full = { x: s.xOf(c), z: s.zOf(r), xe: s.xOf(cc), ze: s.zOf(rr) };

          const a = s.at(c, r);
          const b = s.at(cc, r);
          const d = s.at(c, rr);
          const e = s.at(cc, rr);
          /* All four corners must be land. A quad with one corner in the sea
             is the coastline, and the honest edge is the one that leaves it
             out. */
          if (a == null || b == null || d == null || e == null) continue;

          /* Give back whatever the campus owns, and keep the rest. Trimming
             rather than skipping is what makes the two meshes meet exactly;
             see trimQuadToCampus for the perimeter gap that taught us. */
          const q = trimQuadToCampus(full, rect);
          if (q === null) continue;
          const { x, z, xe, ze } = q;
          const trimmed = q !== full;
          const hA = trimmed ? bilinear(full, a, b, d, e, x, z) : a;
          const hB = trimmed ? bilinear(full, a, b, d, e, xe, z) : b;
          const hD = trimmed ? bilinear(full, a, b, d, e, x, ze) : d;
          const hE = trimmed ? bilinear(full, a, b, d, e, xe, ze) : e;

          const span = step * cell;
          const nA = [-(b - a) / span, 1, -(d - a) / span];
          const inv = 1 / Math.hypot(nA[0], 1, nA[2]);
          const nx = nA[0] * inv;
          const ny = inv;
          const nz = nA[2] * inv;

          position.push(x, hA, z, x, hD, ze, xe, hB, z);
          position.push(xe, hB, z, x, hD, ze, xe, hE, ze);
          for (let k = 0; k < 6; k++) normal.push(nx, ny, nz);
          if (colorAt) {
            /* One colour per CORNER, so a road crossing a cell reads as a
               gradient rather than snapping at the cell boundary. The two
               triangles share corners in the order pushed above. */
            const c00 = colorAt(c, r);
            const c10 = colorAt(cc, r);
            const c01 = colorAt(c, rr);
            const c11 = colorAt(cc, rr);
            /* A trimmed corner sits between grid samples, so its colour is
               interpolated for the same reason its height is. */
            const pick = (X, Z) => (trimmed
              ? [0, 1, 2].map((k) => bilinear(full, c00[k], c10[k], c01[k], c11[k], X, Z))
              : null);
            const cA = pick(x, z) ?? c00;
            const cB = pick(xe, z) ?? c10;
            const cD = pick(x, ze) ?? c01;
            const cE = pick(xe, ze) ?? c11;
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
