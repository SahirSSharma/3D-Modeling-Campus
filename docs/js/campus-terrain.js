// Ground geometry rules shared by the renderer, the satellite build script and
// the tests. No DOM, no three.js — this file must stay importable from Node.
//
// Three things live here because three different callers must agree on them
// exactly:
//
//   makeHeightSampler  the ONE way ground height is read. The old sampler in
//                      campus-world.js answered 0 (datum level, 123.9 m
//                      absolute) for any query outside the LiDAR grid, which
//                      is how 261 of 323 buildings came to hang in mid-air at
//                      the data edge. Outside the grid the honest answer is
//                      "the same as the nearest measured edge", so that is
//                      what this returns.
//
//   chunkGrid          how the terrain splits into texture chunks. The build
//                      script cuts the imagery on this grid and the renderer
//                      cuts the mesh on it; if the two ever computed it
//                      separately they would drift.
//
//   pointInRings       whether a point is inside the campus boundary polygon.
//                      Decides which pixels get imagery at build time and
//                      which stylized overlays are hidden at run time.

/** Terrain-sample blocks per texture chunk edge. 85 cells x 3 m = 255 m. */
export const CHUNK_CELLS = 85;

/** How far, in metres, the flat ground apron extends past the LiDAR grid.
 *  Chosen to reach beyond every OSM footprint in campus-3d.json (the farthest
 *  building vertex sits ~447 m outside the grid, north of it), so everything
 *  rendered has ground under it — and the test suite fails the moment a data
 *  rebuild brings in a footprint past the apron. */
export const APRON_REACH = 520;

/**
 * Bilinear height sampler over the LiDAR grid, clamped to the nearest edge
 * sample outside it. `terrain` is campus-lidar.json's `terrain` object:
 * { x0, z0, cell, cols, rows, z: [decimetres...] }.
 */
export function makeHeightSampler(terrain) {
  const { x0, z0, cell, cols, rows, z: heights } = terrain;
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

  const heightAt = (x, zz) => {
    /* Clamp into the last valid bilinear cell rather than bailing out. A query
       past the edge lands ON the edge, so ground continues flat outward
       instead of snapping to datum level. */
    const fx = clamp((x - x0) / cell, 0, cols - 1);
    const fz = clamp((zz - z0) / cell, 0, rows - 1);
    const c = Math.min(cols - 2, Math.floor(fx));
    const r = Math.min(rows - 2, Math.floor(fz));
    const tx = fx - c;
    const tz = fz - r;
    const h = (rr, cc) => heights[rr * cols + cc] / 10; // decimetres -> metres
    const top = h(r, c) * (1 - tx) + h(r, c + 1) * tx;
    const bottom = h(r + 1, c) * (1 - tx) + h(r + 1, c + 1) * tx;
    return top * (1 - tz) + bottom * tz;
  };

  const bounds = {
    x0,
    z0,
    x1: x0 + (cols - 1) * cell,
    z1: z0 + (rows - 1) * cell,
  };
  const coverage = {
    x0: bounds.x0 - APRON_REACH,
    z0: bounds.z0 - APRON_REACH,
    x1: bounds.x1 + APRON_REACH,
    z1: bounds.z1 + APRON_REACH,
  };
  const inGrid = (x, zz) =>
    x >= bounds.x0 && x <= bounds.x1 && zz >= bounds.z0 && zz <= bounds.z1;

  return { heightAt, bounds, coverage, inGrid };
}

/** Decimation of the LiDAR grid into the DRAWN mesh: every STEP-th sample, so
 *  the visible triangles span 2 x 3 m = 6 m. */
export const STEP = 2;

/**
 * Sample indices for one chunk edge at the decimation step: every STEP-th
 * sample from the chunk's first row/col, plus its exact last one, so
 * neighbouring chunks share their edge samples and no seam can open.
 *
 * This lives here, next to makeSurfaceSampler, because it IS the definition of
 * the drawn surface. campus-world.js builds the mesh from it and the sampler
 * answers questions about that mesh; a second copy of this arithmetic would
 * reintroduce exactly the bug the sampler exists to fix.
 */
export function axisSamples(a0, a1) {
  const out = [];
  for (let v = a0; v < a1; v += STEP) out.push(v);
  out.push(a1);
  return out;
}

/**
 * Height of the DRAWN triangle under (x,z) — not the bilinear height.
 *
 * WHY THIS EXISTS. makeHeightSampler interpolates the full 3 m LiDAR grid, but
 * the mesh you can actually see is built from every STEP-th sample. Wherever a
 * skipped sample is a local low, the drawn triangles bow ABOVE the sampled
 * height, and anything placed at heightAt is genuinely underneath the visible
 * ground — which is how the scooter came to ride below the surface it is
 * supposed to be on.
 *
 * Outside the grid there are no drawn triangles here (the apron and the
 * regional mesh take over), so the bilinear height is the honest answer.
 */
export function makeSurfaceSampler(terrain) {
  const { x0, z0, cell, cols, rows, z: heights } = terrain;
  const { heightAt, inGrid } = makeHeightSampler(terrain);

  /* The drawn sample indices per axis, taken from the same chunk walk and the
     same axisSamples() the mesh builder uses, so the SHORT cells axisSamples
     leaves at each chunk edge (its trailing out.push(a1)) are reproduced by
     construction rather than re-derived. */
  const drawn = (n, pick) => {
    const seen = new Set();
    for (const chunk of chunkGrid(terrain)) for (const v of axisSamples(...pick(chunk))) seen.add(v);
    const list = [...seen].sort((a, b) => a - b);
    /* index -> the drawn sample that starts the cell containing it. */
    const start = new Int32Array(n);
    for (let k = 0, i = 0; k < list.length - 1; k++) {
      for (; i < list[k + 1]; i++) start[i] = k;
    }
    start[n - 1] = list.length - 2; // the last index closes the last cell
    return { list, start };
  };
  const colsDrawn = drawn(cols, (ch) => [ch.c0, ch.c1]);
  const rowsDrawn = drawn(rows, (ch) => [ch.r0, ch.r1]);

  /* Read heights exactly as campus-world.js's mesh builder does: clamped
     index, decimetres -> metres. */
  const clampIdx = (v, hi) => (v < 0 ? 0 : v > hi ? hi : v);
  const h = (r, c) => heights[clampIdx(r, rows - 1) * cols + clampIdx(c, cols - 1)] / 10;

  return (x, zz) => {
    if (!inGrid(x, zz)) return heightAt(x, zz);
    const fx = (x - x0) / cell;
    const fz = (zz - z0) / cell;
    const k = colsDrawn.start[clampIdx(Math.floor(fx), cols - 1)];
    const m = rowsDrawn.start[clampIdx(Math.floor(fz), rows - 1)];
    const cA = colsDrawn.list[k], cB = colsDrawn.list[k + 1];
    const rA = rowsDrawn.list[m], rB = rowsDrawn.list[m + 1];
    const u = (fx - cA) / (cB - cA);
    const v = (fz - rA) / (rB - rA);
    const h00 = h(rA, cA), h01 = h(rA, cB), h10 = h(rB, cA), h11 = h(rB, cB);
    /* The mesh's two triangles per cell are {(r,c),(r+1,c),(r,c+1)} and
       {(r,c+1),(r+1,c),(r+1,c+1)} (campus-world.js's index order). Their shared
       edge is the ANTI-diagonal, so u + v <= 1 picks the first. */
    return u + v <= 1
      ? h00 + (h01 - h00) * u + (h10 - h00) * v
      : h11 + (h10 - h11) * (1 - u) + (h01 - h11) * (1 - v);
  };
}

/**
 * The texture-chunk grid: blocks of CHUNK_CELLS x CHUNK_CELLS terrain cells
 * (the trailing blocks are smaller when the grid does not divide evenly).
 * c0/r0..c1/r1 are SAMPLE indices, inclusive, so neighbouring chunks share
 * their edge samples and the meshes cannot open a seam.
 */
export function chunkGrid(terrain, chunkCells = CHUNK_CELLS) {
  const { x0, z0, cell, cols, rows } = terrain;
  const chunks = [];
  for (let r0 = 0, ri = 0; r0 < rows - 1; r0 += chunkCells, ri++) {
    const r1 = Math.min(r0 + chunkCells, rows - 1);
    for (let c0 = 0, ci = 0; c0 < cols - 1; c0 += chunkCells, ci++) {
      const c1 = Math.min(c0 + chunkCells, cols - 1);
      chunks.push({
        ci, ri, c0, c1, r0, r1,
        x0: x0 + c0 * cell,
        x1: x0 + c1 * cell,
        z0: z0 + r0 * cell,
        z1: z0 + r1 * cell,
      });
    }
  }
  return chunks;
}

/** Even-odd point-in-polygon over one or more rings ([[x,z],...] each). */
export function pointInRings(x, z, rings) {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, zi] = ring[i];
      const [xj, zj] = ring[j];
      if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) {
        inside = !inside;
      }
    }
  }
  return inside;
}

/** Axis-aligned bbox around a ring ([[x,z],...]), expanded by `pad` metres
 *  on every side. Shared by anything that needs a cheap early-rejection test
 *  before a per-vertex ring scan (exclusion zones, crown clearance). */
export function ringBBox(ring, pad = 0) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z] of ring) {
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  return { x0: x0 - pad, z0: z0 - pad, x1: x1 + pad, z1: z1 + pad };
}

/** Distance in metres from (x,z) to the nearest EDGE of a ring — 0 only if
 *  the point lands exactly on the boundary; use pointInRings for whether it
 *  is inside. */
export function distToRing(x, z, ring) {
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i];
    const [bx, bz] = ring[(i + 1) % ring.length];
    const dx = bx - ax, dz = bz - az;
    const L2 = dx * dx + dz * dz;
    const t = L2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)) : 0;
    const px = ax + t * dx - x, pz = az + t * dz - z;
    const d2 = px * px + pz * pz;
    if (d2 < best) best = d2;
  }
  return Math.sqrt(best);
}

/**
 * Clearance in metres from (x,z) to the nearest of a set of zones
 * ({ ring, bbox }), 0 when the point is inside any ring, Infinity when
 * `zones` is empty. `maxReach` bounds the bbox early-rejection window so a
 * caller comparing many points against many zones (7,331 trees x ~1,400
 * exclusion zones is the case this exists for) never pays for a full
 * per-vertex distToRing scan against a zone nowhere near — pass the largest
 * distance you will ever care about.
 */
export function nearestZoneClearance(x, z, zones, maxReach = Infinity) {
  let best = Infinity;
  for (const zn of zones) {
    const { bbox, ring } = zn;
    if (bbox && (x < bbox.x0 - maxReach || x > bbox.x1 + maxReach ||
                 z < bbox.z0 - maxReach || z > bbox.z1 + maxReach)) continue;
    if (pointInRings(x, z, [ring])) return 0;
    const d = distToRing(x, z, ring);
    if (d < best) best = d;
  }
  return best;
}

/** Does an axis-aligned rect [x0,z0]-[x1,z1] touch the polygon at all? */
export function rectIntersectsRings(x0, z0, x1, z1, rings) {
  // Any rect corner inside the polygon?
  if (
    pointInRings(x0, z0, rings) || pointInRings(x1, z0, rings) ||
    pointInRings(x0, z1, rings) || pointInRings(x1, z1, rings)
  ) return true;
  // Any ring vertex inside the rect, or any ring edge crossing a rect edge?
  const segs = [
    [x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0],
  ];
  const cross = (ax, az, bx, bz, cx, cz, dx, dz) => {
    const d1 = (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
    const d2 = (bx - ax) * (dz - az) - (bz - az) * (dx - ax);
    const d3 = (dx - cx) * (az - cz) - (dz - cz) * (ax - cx);
    const d4 = (dx - cx) * (bz - cz) - (dz - cz) * (bx - cx);
    return d1 * d2 < 0 && d3 * d4 < 0;
  };
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [ax, az] = ring[j];
      const [bx, bz] = ring[i];
      if (ax >= x0 && ax <= x1 && az >= z0 && az <= z1) return true;
      for (const [cx, cz, dx, dz] of segs) {
        if (cross(ax, az, bx, bz, cx, cz, dx, dz)) return true;
      }
    }
  }
  return false;
}
