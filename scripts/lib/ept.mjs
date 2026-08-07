// Reading USGS 3DEP LiDAR out of an Entwine Point Tile octree.
//
// WHY THIS FILE EXISTS. This machinery was written inside
// scripts/build-campus-lidar.mjs, which is correct: it was the only thing that
// needed it. The world is now being widened past the campus box, and the
// regional terrain builder needs exactly the same octree walk, the same LAS
// header parse and the same laz-perf decode over a different bounding box.
//
// Copying it would have been the cheap move and the wrong one. Two copies of a
// point-cloud decoder drift, and when they drift the campus and the land
// around it stop agreeing about where the ground is — at the seam, which is
// precisely where anyone would notice. So it lives here once, parameterised by
// the box, and both builders import it.
//
// No DOM, no three.js. Node only.

const R = 6378137;

/** Web Mercator, the frame the LiDAR arrives in. */
export const merc = {
  x: (lng) => (lng * Math.PI * R) / 180,
  y: (lat) => R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)),
  lat: (y) => (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * (180 / Math.PI),
  lng: (x) => (x / R) * (180 / Math.PI),
};

/** Ground returns. The 2014 coastal survey classifies these and dumps
 *  everything else — buildings, trees, lamp posts — into "unassigned". */
export const GROUND = 2;

/**
 * An EPT source, bound to one dataset URL and one lat/lng box.
 *
 * `area` is {south, north, west, east} in degrees.
 */
export function eptSource(url, area) {
  const box = {
    minx: merc.x(area.west), maxx: merc.x(area.east),
    miny: merc.y(area.south), maxy: merc.y(area.north),
  };

  const hierCache = new Map();
  async function hierarchy(key) {
    if (hierCache.has(key)) return hierCache.get(key);
    const res = await fetch(`${url}/ept-hierarchy/${key}.json`);
    if (!res.ok) throw new Error(`hierarchy ${key}: ${res.status}`);
    const json = await res.json();
    hierCache.set(key, json);
    return json;
  }

  /**
   * Every populated octree node whose cube overlaps the box.
   *
   * `maxDepth` caps how deep the walk goes. The campus builder wants every
   * depth — it is measuring individual roof planes and cannot afford to throw
   * returns away. A 30 km² terrain grid at 6 m cells cannot use that density
   * and should not pay to download it: each extra depth is ~4x the bytes for
   * detail that averages straight back out inside one cell. Omit it for
   * everything (the original behaviour); pass a number to stop early.
   */
  async function findTiles(bounds, maxDepth = Infinity) {
    const size = bounds[3] - bounds[0];
    const nodeBox = (d, x, y) => {
      const s = size / 2 ** d;
      return {
        minx: bounds[0] + x * s, maxx: bounds[0] + (x + 1) * s,
        miny: bounds[1] + y * s, maxy: bounds[1] + (y + 1) * s,
      };
    };
    const overlaps = (a) =>
      !(a.maxx < box.minx || a.minx > box.maxx || a.maxy < box.miny || a.miny > box.maxy);

    const found = [];
    const walk = async (rootKey) => {
      const node = await hierarchy(rootKey);
      for (const [key, count] of Object.entries(node)) {
        const [d, x, y] = key.split("-").map(Number);
        if (!overlaps(nodeBox(d, x, y))) continue;
        /* A node deeper than the cap is skipped outright — but only once its
           own depth exceeds the cap, so the cap keeps the SHALLOWEST complete
           covering rather than punching holes in it. */
        if (d > maxDepth) continue;
        // -1 means "this subtree continues in its own hierarchy file".
        if (count === -1) {
          if (d < maxDepth) await walk(key);
        } else if (count > 0) found.push(key);
      }
    };
    await walk("0-0-0-0");
    return found;
  }

  /* The LAS public header block. laz-perf decodes point RECORDS but hands back
     raw scaled integers, so the scale and offset that turn them into real
     coordinates have to be read out of the header here. Offsets per the LAS
     1.2+ spec; classification moved from byte 15 to byte 16 in point formats
     6+. */
  function lasHeader(view) {
    return {
      format: view.getUint8(104),
      scale: [view.getFloat64(131, true), view.getFloat64(139, true), view.getFloat64(147, true)],
      offset: [view.getFloat64(155, true), view.getFloat64(163, true), view.getFloat64(171, true)],
    };
  }

  /**
   * Decode one tile, keeping only the returns inside the box.
   *
   * Returns an array of [x, y, z, classification] in Web Mercator metres.
   * `onPoint`, if given, is called with each point instead and nothing is
   * accumulated — the regional grid folds 60 million returns into cells and
   * must never hold them all at once.
   */
  async function readTile(laz, key, onPoint) {
    const res = await fetch(`${url}/ept-data/${key}.laz`);
    if (!res.ok) throw new Error(`tile ${key}: ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const head = lasHeader(new DataView(bytes.buffer));

    const filePtr = laz._malloc(bytes.byteLength);
    laz.HEAPU8.set(bytes, filePtr);
    const reader = new laz.LASZip();
    reader.open(filePtr, bytes.byteLength);

    const count = reader.getCount();
    const pointLength = reader.getPointLength();
    const classOffset = reader.getPointFormat() >= 6 ? 16 : 15;
    const pointPtr = laz._malloc(pointLength);

    const out = onPoint ? null : [];
    for (let i = 0; i < count; i++) {
      reader.getPoint(pointPtr);
      const p = new DataView(laz.HEAPU8.buffer, pointPtr, pointLength);
      const x = p.getInt32(0, true) * head.scale[0] + head.offset[0];
      const y = p.getInt32(4, true) * head.scale[1] + head.offset[1];
      if (x < box.minx || x > box.maxx || y < box.miny || y > box.maxy) continue;
      const z = p.getInt32(8, true) * head.scale[2] + head.offset[2];
      let cls = p.getUint8(classOffset);
      if (head.format < 6) cls &= 0x1f; // pre-1.4 packs flags into the top bits
      if (onPoint) onPoint(x, y, z, cls);
      else out.push([x, y, z, cls]);
    }

    reader.delete();
    laz._free(filePtr);
    laz._free(pointPtr);
    return out;
  }

  return { box, hierarchy, findTiles, readTile };
}
