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

/* INHERITED, NOT MEASURED — and flagged as such because that distinction is
   the whole discipline of this repo.
   Every other colour in this world came off a frame with a stated provenance.
   There is no registered aerial of Rose Canyon or the Torrey Pines bluff here,
   so there is nothing to measure yet, and inventing a plausible sage-green
   would put an unsourced number next to a hundred sourced ones.
   So this borrows the one measurement that genuinely applies: the Eighth
   College survey's `dryLawn`, read off ref3 as the only clean unshaded sample
   of UNIRRIGATED ground in full sun — tan, never green. Coastal sage scrub in
   San Diego is the same dry tan for most of the year, and almost all of this
   region is that. It is a defensible stand-in, it is not a measurement of the
   region, and the moment a registered regional frame exists it should be
   replaced by one. */
export const REGION_GROUND_COLOR = 0xab9d83;
export const REGION_GROUND_PROVENANCE = {
  inherited: "EIGHTH_COLORS.dryLawn",
  source: "Eighth College ref3, unshaded unirrigated ground in full sun",
  measuredForRegion: false,
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
export function buildRegionMesh(header, heights, campusTerrain, color = REGION_GROUND_COLOR) {
  const s = regionSampler(header, heights);
  const inCampus = makeInCampus(campusTerrain);
  const coast = coastMask(header, heights);
  const { cols, rows, cell } = header;
  const CHUNK = 96; // samples per chunk edge

  const group = new THREE.Group();
  group.name = "region-terrain";
  const material = new THREE.MeshLambertMaterial({ color });
  let quads = 0;

  const nearCoast = (c, r) => coast[r * cols + c] !== 255;

  for (let r0 = 0; r0 < rows - 1; r0 += CHUNK) {
    for (let c0 = 0; c0 < cols - 1; c0 += CHUNK) {
      const position = [];
      const normal = [];
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
          quads++;
        }
        r += step;
      }

      if (!position.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
      geo.setAttribute("normal", new THREE.Float32BufferAttribute(normal, 3));
      geo.computeBoundingSphere();
      group.add(new THREE.Mesh(geo, material));
    }
  }

  return { group, quads, chunks: group.children.length };
}

/**
 * The sea.
 *
 * One plane at mean sea level, big enough to run past the region on every
 * side and out to the fog. It is drawn UNLIT: a Lambert surface at this size
 * takes the scene's single directional light and reads as one flat tone that
 * shifts as you turn, which looks like a mistake. Unlit at a measured colour
 * reads as water.
 */
export function buildOcean(datum, extentM = 9000) {
  const y = SEA_LEVEL_M - datum;
  const geo = new THREE.PlaneGeometry(extentM, extentM);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ color: OCEAN_COLOR })
  );
  mesh.position.set(0, y, 0);
  mesh.name = "ocean";
  /* Behind everything: the sea must never win a depth tie against a beach
     drawn at almost the same height. */
  mesh.renderOrder = -1;
  return mesh;
}
