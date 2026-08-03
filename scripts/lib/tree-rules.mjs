// Which 2014 LiDAR trees are still believable on TODAY's campus.
//
// The tree list in campus-lidar.json is honest about 2014: every canopy the
// laser saw. But a decade of construction felled groves and put buildings,
// courts and quads where they stood, and the extraction only knew the
// footprints of ITS day. These rules are shared by build-campus-lidar.mjs
// (so a rebuild never re-plants a ghost), scripts/prune-trees.mjs (the
// surgical pass over shipped data) and the tests (so a violation can never
// ship silently). No DOM, no sharp — importable from anywhere.
import { pointInRings } from "../../docs/js/campus-terrain.js";

/* The tallest believable campus tree. The 2014 data holds maxima to 39.9 m —
   old-growth blue gums measured crown-tip to a canyon floor — but rendered as
   a solid crown beside a 37 m residence tower they read as absurd. 30 m is
   the tall end of what actually stands over the walkable campus. */
export const TREE_MAX_HEIGHT = 30;
export const TREE_MAX_CROWN_R = 7.5;

/* A trunk this close to a wall is IN the wall once the model is drawn. A crown
   OVERHANGING a facade is real life and stays. */
export const WALL_MARGIN = 0.75;
/* No trunk on a playing surface; sideline rows survive. */
export const PAD_MARGIN = 1.5;

const ringBBox = (ring, pad) => {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z] of ring) {
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  return { x0: x0 - pad, z0: z0 - pad, x1: x1 + pad, z1: z1 + pad };
};

const distToRing = (x, z, ring) => {
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
};

/**
 * Every zone a believable trunk cannot occupy, from the shipped data files:
 * today's building footprints (OSM + the university's own massing), every
 * fitted sports pad, every fountain. Pass whichever files exist; absent ones
 * contribute nothing.
 */
export function treeExclusionZones({ campus3d, arcgis, markings } = {}) {
  const zones = [];
  const add = (ring, kind, margin, name) => {
    if (!ring || ring.length < 3) return;
    zones.push({ ring, kind, margin, name: name || kind, bbox: ringBBox(ring, margin) });
  };
  for (const b of campus3d?.buildings || []) add(b.p, "building", WALL_MARGIN, b.n);
  for (const m of arcgis?.massing || []) add(m.r, "building", WALL_MARGIN, m.n);
  for (const f of markings?.facilities || []) add(f.bounds, "sports", PAD_MARGIN, f.name);
  for (const s of campus3d?.surfaces || []) {
    if ((s.kind ?? s.k) === "water") add(s.p, "water", 0, s.n);
  }
  return zones;
}

/** The zone a tree at (x, z) violates, or null if it stands clear. */
export function treeViolation(x, z, zones) {
  for (const zn of zones) {
    const { bbox } = zn;
    if (x < bbox.x0 || x > bbox.x1 || z < bbox.z0 || z > bbox.z1) continue;
    if (pointInRings(x, z, [zn.ring])) return zn;
    if (zn.margin > 0 && distToRing(x, z, zn.ring) < zn.margin) return zn;
  }
  return null;
}

/**
 * Apply the zone rules and the realism caps to a raw tree list
 * ([x, z, h, r] rows). Returns { kept, dropped } — dropped rows carry the
 * zone that claimed them so callers can log honestly.
 */
export function pruneTrees(trees, zones) {
  const kept = [];
  const dropped = [];
  for (const t of trees) {
    const [x, z, h, r] = t;
    const zn = treeViolation(x, z, zones);
    if (zn) {
      dropped.push({ tree: t, kind: zn.kind, name: zn.name });
      continue;
    }
    kept.push([
      x, z,
      Math.min(h, TREE_MAX_HEIGHT),
      Math.min(r, TREE_MAX_CROWN_R),
    ]);
  }
  return { kept, dropped };
}
