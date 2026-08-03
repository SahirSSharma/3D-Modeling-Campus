// The measured ground plane: shared geometry helpers.
//
// UCSD's facilities GIS ships the campus ground as polygons — sidewalks,
// lawns, roads, fountains — and scripts/build-campus-arcgis.mjs stores them
// nearly verbatim, clipped to the LiDAR box, as decimetre integers. Everything
// that INFLATES the data (cutting big polygons into tiles, adding vertices so
// a drape can bend) happens here at load time instead: the same 250 KB file
// would be 3 MB with this baked in, and the loop below runs in milliseconds.
//
// Used by the renderer in the browser and by the build/check scripts in Node,
// which is why there is no THREE and no DOM in this file.

/* Any draped triangle spanning more than TILE metres can bridge a dip in the
   terrain; any edge longer than EDGE has no vertex to bend at. Both bounded
   here. */
const TILE = 28;
const EDGE = 6;
export const MIN_AREA = 3; // m²; smaller fragments are clipping noise

export const ringArea = (ring) => {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return a / 2;
};

/** Sutherland–Hodgman clip of one ring against an axis-aligned rectangle. */
export function clipRect(ring, x0, z0, x1, z1) {
  const inside = [
    (p) => p[0] >= x0, (p) => p[0] <= x1,
    (p) => p[1] >= z0, (p) => p[1] <= z1,
  ];
  const cross = [
    (a, b) => [x0, a[1] + ((b[1] - a[1]) * (x0 - a[0])) / (b[0] - a[0])],
    (a, b) => [x1, a[1] + ((b[1] - a[1]) * (x1 - a[0])) / (b[0] - a[0])],
    (a, b) => [a[0] + ((b[0] - a[0]) * (z0 - a[1])) / (b[1] - a[1]), z0],
    (a, b) => [a[0] + ((b[0] - a[0]) * (z1 - a[1])) / (b[1] - a[1]), z1],
  ];
  let poly = ring;
  for (let e = 0; e < 4 && poly.length; e++) {
    const next = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const ain = inside[e](a);
      const bin = inside[e](b);
      if (ain) next.push(a);
      if (ain !== bin) next.push(cross[e](a, b));
    }
    poly = next;
  }
  return poly;
}

/** Split every edge longer than EDGE so the drape has vertices to bend at. */
export function subdivide(ring) {
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    out.push(a);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.floor(len / EDGE);
    for (let k = 1; k <= n; k++) {
      const t = k / (n + 1);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

/**
 * Cut a polygon (outer ring first, then holes) into TILE-sized cells.
 * Seams between cells are invisible — same material, same drape, coincident
 * edges — and every piece is small enough to follow the ground.
 */
export function tile(rings) {
  const outer = rings[0];
  let minx = Infinity;
  let maxx = -Infinity;
  let minz = Infinity;
  let maxz = -Infinity;
  for (const [x, z] of outer) {
    if (x < minx) minx = x;
    if (x > maxx) maxx = x;
    if (z < minz) minz = z;
    if (z > maxz) maxz = z;
  }
  if (maxx - minx <= TILE && maxz - minz <= TILE) return [rings];

  const pieces = [];
  for (let gx = Math.floor(minx / TILE) * TILE; gx < maxx; gx += TILE) {
    for (let gz = Math.floor(minz / TILE) * TILE; gz < maxz; gz += TILE) {
      const o = clipRect(outer, gx, gz, gx + TILE, gz + TILE);
      if (o.length < 3 || Math.abs(ringArea(o)) < MIN_AREA) continue;
      const piece = [o];
      for (const h of rings.slice(1)) {
        const hc = clipRect(h, gx, gz, gx + TILE, gz + TILE);
        if (hc.length >= 3 && Math.abs(ringArea(hc)) >= 0.5) piece.push(hc);
      }
      pieces.push(piece);
    }
  }
  return pieces;
}

/**
 * The whole load-time expansion: decimetre integers -> metres, tile, then
 * subdivide every ring. Returns [{ kind, rings }] ready for triangulation.
 */
export function prepareGround(data) {
  const out = [];
  (data.ground || []).forEach((g, src) => {
    const rings = g.r.map((ring) => ring.map(([x, z]) => [x / 10, z / 10]));
    for (const piece of tile(rings)) {
      /* src carries the polygon's index so a piece can find its sampled
         aerial colour in campus-colors.json, which is parallel to ground. */
      out.push({ kind: g.k, src, rings: piece.map(subdivide) });
    }
  });
  return out;
}
