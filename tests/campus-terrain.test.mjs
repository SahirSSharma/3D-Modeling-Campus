// The drawn surface is not the sampled surface, and the difference is a bug.
//
// WHY THIS FILE EXISTS. campus-world.js builds the terrain mesh from every
// STEP-th LiDAR sample, so the triangles you can see span 6 m on a 3 m grid.
// makeHeightSampler interpolates the full 3 m grid. Wherever a skipped sample
// is a local low, the drawn triangles bow ABOVE the sampled height and anything
// placed at heightAt is underneath the visible ground — which is how the
// scooter came to ride below the ground it is supposed to be on.
//
// makeSurfaceSampler answers for the drawn triangles instead. So this pins it
// against the mesh construction itself: the triangles are rebuilt here by brute
// force from the same chunkGrid/axisSamples walk campus-world.js uses, and
// every query is checked against the actual triangle it lands in. If the
// sampler ever picks the wrong triangle — or the mesh's diagonal ever flips —
// this fails rather than the scooter quietly sinking again.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  makeHeightSampler, makeSurfaceSampler, chunkGrid, axisSamples, STEP, CHUNK_CELLS,
} from "../docs/js/campus-terrain.js";

/* A pinned LCG, not Math.random: a probe that fails only on some runs is a
   probe nobody can act on. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/* 120 x 120 crosses one chunk boundary at sample 85, so the short trailing
   cells axisSamples leaves at a chunk edge are exercised, not just the regular
   6 m ones. Heights are decimetre integers, as campus-lidar.json's are, and
   rough at the 3 m scale so decimation actually loses something. */
function synthTerrain(seed = 20260815) {
  const cols = 120, rows = 120, cell = 3;
  const rand = rng(seed);
  const z = new Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const smooth = 40 * Math.sin(c / 11) + 30 * Math.cos(r / 9) + 0.8 * c;
      z[r * cols + c] = Math.round(smooth + (rand() - 0.5) * 60);
    }
  }
  return { x0: -100, z0: 250, cell, cols, rows, z };
}

/* The drawn mesh, rebuilt exactly as campus-world.js rebuilds it: same chunk
   walk, same axisSamples, same clamped decimetre read, same index order. */
function drawnTriangles(terrain) {
  const { x0, z0, cell, cols, rows, z: heights } = terrain;
  const clampIdx = (v, hi) => (v < 0 ? 0 : v > hi ? hi : v);
  const h = (r, c) => heights[clampIdx(r, rows - 1) * cols + clampIdx(c, cols - 1)] / 10;
  const tris = [];
  for (const chunk of chunkGrid(terrain)) {
    const rsm = axisSamples(chunk.r0, chunk.r1);
    const csm = axisSamples(chunk.c0, chunk.c1);
    const position = [];
    for (const r of rsm) {
      for (const c of csm) position.push([x0 + c * cell, h(r, c), z0 + r * cell]);
    }
    const stride = csm.length;
    for (let r = 0; r < rsm.length - 1; r++) {
      for (let c = 0; c < stride - 1; c++) {
        const a = r * stride + c;
        const idx = [a, a + stride, a + 1, a + 1, a + stride, a + stride + 1];
        for (let i = 0; i < 6; i += 3) {
          tris.push([position[idx[i]], position[idx[i + 1]], position[idx[i + 2]]]);
        }
      }
    }
  }
  return tris;
}

/* Barycentric height of (x,z) in one triangle, plus how far inside it is. A
   query on a shared edge is inside two triangles that agree there, so taking
   the most-inside one is unambiguous. */
function bary(tri, x, z) {
  const [A, B, C] = tri;
  const d = (B[2] - C[2]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[2] - C[2]);
  if (Math.abs(d) < 1e-12) return null;
  const wa = ((B[2] - C[2]) * (x - C[0]) + (C[0] - B[0]) * (z - C[2])) / d;
  const wb = ((C[2] - A[2]) * (x - C[0]) + (A[0] - C[0]) * (z - C[2])) / d;
  const wc = 1 - wa - wb;
  return { y: wa * A[1] + wb * B[1] + wc * C[1], inside: Math.min(wa, wb, wc) };
}

test("surfaceAt returns the height of the triangle the mesh actually draws", () => {
  const terrain = synthTerrain();
  const surfaceAt = makeSurfaceSampler(terrain);
  const tris = drawnTriangles(terrain);
  const { x0, z0, cell, cols, rows } = terrain;
  const x1 = x0 + (cols - 1) * cell, z1 = z0 + (rows - 1) * cell;

  const rand = rng(7717);
  let worst = 0;
  for (let n = 0; n < 20000; n++) {
    const x = x0 + rand() * (x1 - x0);
    const z = z0 + rand() * (z1 - z0);
    let best = null;
    for (const tri of tris) {
      /* Bounding-box reject only — the containment decision is still the full
         barycentric test against every candidate triangle. */
      const [A, B, C] = tri;
      if (x < Math.min(A[0], B[0], C[0]) || x > Math.max(A[0], B[0], C[0])) continue;
      if (z < Math.min(A[2], B[2], C[2]) || z > Math.max(A[2], B[2], C[2])) continue;
      const b = bary(tri, x, z);
      if (b && (!best || b.inside > best.inside)) best = b;
    }
    assert.ok(best && best.inside > -1e-9, `no drawn triangle contains (${x}, ${z})`);
    const err = Math.abs(surfaceAt(x, z) - best.y);
    if (err > worst) worst = err;
    assert.ok(err <= 1e-9, `(${x}, ${z}): surfaceAt ${surfaceAt(x, z)} vs drawn ${best.y}`);
  }
  assert.ok(worst <= 1e-9, `worst disagreement ${worst}`);
});

test("neighbouring chunks share their edge sample, so no seam can open", () => {
  const a = axisSamples(0, CHUNK_CELLS);
  const b = axisSamples(CHUNK_CELLS, 2 * CHUNK_CELLS);
  assert.equal(a.at(-1), CHUNK_CELLS);
  assert.equal(b[0], CHUNK_CELLS);
  /* The trailing push is what guarantees it: 85 is not a multiple of STEP, so
     the stepped walk would otherwise stop at 84 and leave a crack. */
  assert.equal(CHUNK_CELLS % STEP, 1);
  assert.equal(a.at(-2), CHUNK_CELLS - 1);
});

test("the sampled height sinks below the drawn ground — the bug this exists for", () => {
  const terrain = synthTerrain();
  const { heightAt } = makeHeightSampler(terrain);
  const surfaceAt = makeSurfaceSampler(terrain);
  const { x0, z0, cell, cols, rows } = terrain;

  /* Sweep the grid for the phenomenon rather than hard-coding a point, so a
     reseed of the synthetic terrain cannot silently make this vacuous. */
  let worst = null;
  for (let r = 0; r < rows - 1; r += 1) {
    for (let c = 0; c < cols - 1; c += 1) {
      const x = x0 + (c + 0.5) * cell;
      const z = z0 + (r + 0.5) * cell;
      const gap = surfaceAt(x, z) - heightAt(x, z);
      if (!worst || gap > worst.gap) worst = { x, z, gap };
    }
  }
  assert.ok(worst.gap > 0.5,
    `expected the drawn surface to bow well above the sampled height somewhere; ` +
    `worst gap was only ${worst.gap} m`);
  assert.ok(heightAt(worst.x, worst.z) < surfaceAt(worst.x, worst.z));
});

test("outside the grid the drawn ground is somebody else's, so the sampler defers", () => {
  const terrain = synthTerrain();
  const { heightAt } = makeHeightSampler(terrain);
  const surfaceAt = makeSurfaceSampler(terrain);
  for (const [x, z] of [[-500, 100], [900, 900], [terrain.x0 - 1, terrain.z0 + 30]]) {
    assert.equal(surfaceAt(x, z), heightAt(x, z));
  }
});
