// Which 2014 LiDAR trees are still believable on TODAY's campus.
//
// The tree list in campus-lidar.json is honest about 2014: every canopy the
// laser saw. But a decade of construction felled groves and put buildings,
// courts and quads where they stood, and the extraction only knew the
// footprints of ITS day. These rules are shared by build-campus-lidar.mjs
// (so a rebuild never re-plants a ghost), scripts/prune-trees.mjs (the
// surgical pass over shipped data) and the tests (so a violation can never
// ship silently). No DOM, no sharp — importable from anywhere.
//
// The zone-building rules themselves (treeExclusionZones, treeViolation,
// WALL_MARGIN, PAD_MARGIN) live in docs/js/campus-species.js, not here:
// docs/ is the web root, so the RENDERER needs to reach them too (crown
// clearance, RC2 of the Muir zone fix), and scripts/lib is not web-servable.
// Re-exported below so every caller of this module keeps working unchanged.
export {
  treeExclusionZones, treeViolation, WALL_MARGIN, PAD_MARGIN,
} from "../../docs/js/campus-species.js";
import { treeViolation } from "../../docs/js/campus-species.js";

/* The tallest believable campus tree. The 2014 data holds maxima to 39.9 m —
   old-growth blue gums measured crown-tip to a canyon floor — but rendered as
   a solid crown beside a 37 m residence tower they read as absurd. 30 m is
   the tall end of what actually stands over the walkable campus. */
export const TREE_MAX_HEIGHT = 30;
export const TREE_MAX_CROWN_R = 7.5;

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
