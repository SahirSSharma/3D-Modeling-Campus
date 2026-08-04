// "Is there a building under me, and how high is its roof?"
//
// Nothing answered that at runtime. The renderer extrudes ~1,500 masses into a
// few dozen merged draw calls and then forgets where any of them are, so the
// flight controls had no way to tell two metres over Geisel's deck from eighty
// metres over its forecourt — which is the difference between a control you can
// park a camera with and one you cannot.
//
// The caller is the frame loop, so the cost is paid 60 times a second to answer
// a question about one point. Measured over the shipped massing (1,490
// footprints, 35,220 vertices), per query:
//
//   1,490 point-in-polygon tests          984 us   ~6% of a 60 Hz frame
//   the same, bbox-rejected first         6.25 us
//   this grid                             0.60 us  (7 ms to build, once)
//
// So the naive scan is genuinely unaffordable, and the honest note is that a
// bbox-prefiltered scan would in fact fit — at the price of 1,490 rejections
// per sample, a cost that grows with every building added and that stops
// fitting the moment anything wants more than one sample a frame (rate-limiting
// the clearance, or a second probe ahead of the camera, would both do that).
// The grid's cost does not depend on how big the campus gets, which is the
// property worth having.
//
// No DOM, no three.js: importable from Node, which is how the tests reach it.
import { pointInRings, ringBBox } from "./campus-terrain.js";

/* Cell size, measured rather than guessed. Footprint bounding boxes run
   3.7–269 m across, median 26 m, over a campus 3.1 km by 3.0 km. Sweeping the
   real data:

     cell    cells   entries   mean/cell   worst cell   us/query
       8    42,171    50,199       1.19         6         1.22
      16    12,760    16,862       1.32         6         0.61
      32     4,058     6,966       1.72         8         0.97
      64     1,290     3,587       2.78        13         0.67
     256       129     1,917      14.86        60         0.81

   Query time is flat from 16 m to 64 m — at any of those the candidate list is
   short enough that the cost is the Map lookup, not the scan — so the choice is
   really about index size, and 32 m sits in the middle of that plateau: one
   median footprint per cell, an index under 5x the footprint count, and a worst
   cell of 8. Below it the index multiplies to shorten a list already near 1;
   well above it the dense blocks bucket dozens deep and the query starts
   walking back toward the scan this exists to avoid. */
const CELL = 32;

/* A footprint whose bbox spans more cells than this on either axis is treated
   as unindexable rather than bucketed: one vertex that missed the /10 scaling
   step campus-massing.js applies to the GIS rings would otherwise ask for
   millions of buckets and hang the tab at construction. 64 cells is 2 km — no
   building on this campus is a fifth of that, and the widest thing in the data
   is 269 m. Such a footprint still answers queries, from a list scanned every
   time, so bad data costs speed and never correctness. */
const MAX_CELL_SPAN = 64;

const cellOf = (v) => Math.floor(v / CELL);
const keyOf = (cx, cz) => `${cx}:${cz}`;

/* A ring with one bad vertex is not a footprint we can trust the shape of, so
   the whole entry is dropped rather than repaired by dropping the vertex —
   silently reshaping a polygon would answer confidently and wrongly. This is
   also what keeps pointInRings safe: it destructures every vertex, so a ring
   of bare numbers would throw there if it got that far. */
const ringUsable = (ring) => {
  if (!Array.isArray(ring) || ring.length < 3) return false;
  for (const v of ring) {
    if (!Array.isArray(v) || !Number.isFinite(v[0]) || !Number.isFinite(v[1])) return false;
  }
  return true;
};

/* Whatever createBuildings hands over. It returns `info` as a Map today, but
   the sampler is not the place to care: anything iterable of entries, or a
   plain object, answers the same question. */
const valuesOf = (massInfo) => {
  if (!massInfo) return [];
  if (typeof massInfo.values === "function") return massInfo.values();
  if (Array.isArray(massInfo)) return massInfo;
  if (typeof massInfo === "object") return Object.values(massInfo);
  return [];
};

/**
 * A sampler over the built massing: (x, z) -> world Y of the roof above that
 * point, or null when nothing is built there.
 *
 * Takes the `info` map createBuildings() returns — name -> { x, z, topY, h,
 * ring } — and never throws for any of it. An empty map, an entry with no
 * `ring` (Geisel's is exactly that: its floors are stacked separately, so it
 * carries no outer ring), a ring of two points, non-finite coordinates: all of
 * them just mean "nothing built here" rather than an exception in the frame
 * loop.
 */
export function makeSolidSampler(massInfo) {
  const grid = new Map(); // "cx:cz" -> footprints, tallest first
  const unindexed = [];   // see MAX_CELL_SPAN

  for (const entry of valuesOf(massInfo)) {
    if (!Number.isFinite(entry?.topY) || !ringUsable(entry?.ring)) continue;
    const foot = { ring: entry.ring, topY: entry.topY, bbox: ringBBox(entry.ring) };
    const c0 = cellOf(foot.bbox.x0);
    const c1 = cellOf(foot.bbox.x1);
    const r0 = cellOf(foot.bbox.z0);
    const r1 = cellOf(foot.bbox.z1);
    if (c1 - c0 > MAX_CELL_SPAN || r1 - r0 > MAX_CELL_SPAN) {
      unindexed.push(foot);
      continue;
    }
    for (let cx = c0; cx <= c1; cx++) {
      for (let cz = r0; cz <= r1; cz++) {
        const key = keyOf(cx, cz);
        const bucket = grid.get(key);
        if (bucket) bucket.push(foot);
        else grid.set(key, [foot]);
      }
    }
  }

  /* Tallest first. Overlap is the normal case here, not an edge one — a tower
     wing stands on its own podium in this data — and the surface you would
     land on is the highest one, so the query wants the tall candidates first
     and can stop as soon as the rest cannot beat what it has. */
  for (const bucket of grid.values()) bucket.sort((a, b) => b.topY - a.topY);
  unindexed.sort((a, b) => b.topY - a.topY);

  return function solidAt(x, z) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
    let top = null;
    const consider = (list) => {
      for (const f of list) {
        if (top !== null && f.topY <= top) break; // sorted: nothing further can win
        /* bbox before ring: four comparisons reject most of a cell's
           candidates, where the ring test walks every vertex. */
        if (x < f.bbox.x0 || x > f.bbox.x1 || z < f.bbox.z0 || z > f.bbox.z1) continue;
        if (pointInRings(x, z, [f.ring])) top = f.topY;
      }
    };
    const bucket = grid.get(keyOf(cellOf(x), cellOf(z)));
    if (bucket) consider(bucket);
    if (unindexed.length) consider(unindexed);
    return top;
  };
}
