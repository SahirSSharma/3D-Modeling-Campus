// The generic geometry every draped facility ends up needing.
//
// campus-muir-field.js and campus-recreation.js each grew their own private
// copy of these — the same triangulate-onto-the-terrain, the same ribbon of
// quads along a polyline, the same collector for the standing boxes. Rather
// than write a third copy for RIMAC Field, they live here. The two older
// modules keep theirs (rewriting working, tested draping code to route
// through a new module buys nothing and risks the chevron field all over
// again); ANYTHING NEW comes from here.
//
// No lifts, no polygon offsets, no render orders: every rung of the decal
// stack is campus-overlay.js's business and callers pass the lift in. No DOM.
import * as THREE from "../vendor/three/three.module.min.js";

/* A drape spanning more than this in one triangle can bridge a dip in the
   terrain, so long runs are cut into segments that have a vertex to bend at. */
const MAX_SEG = 6;

/**
 * Triangulate a world-space polygon onto the ground, appending vertices to
 * `out`. A degenerate ring is a quiet no-op — one bad overlay must not cost
 * the walk.
 */
export function fillPoly(out, poly, heightAt, lift) {
  const contour = poly.map(([x, z]) => new THREE.Vector2(x, -z));
  let tris;
  try {
    tris = THREE.ShapeUtils.triangulateShape(contour, []);
  } catch {
    return;
  }
  for (const tri of tris) {
    /* UP-FACING, and measured rather than assumed. THREE.ShapeUtils.
       triangulateShape normalises the contour, so the caller's ring order does
       NOT decide the winding: with the (x, -z) flip above, emitting the
       triangulator's own vertex order [0,1,2] gives every triangle a +y face
       normal, and [0,2,1] gives every triangle a -y one. This function used to
       emit [0,2,1] under a comment claiming the opposite, so every fill it
       produced was back-facing.
       Nobody noticed for three modules because they all draw UNLIT
       (MeshBasicMaterial, DoubleSide), where no normal is ever read; a LIT
       DoubleSide fill does read it — the shader flips the supplied +y normal on
       a back face, so the surface is lit only by the hemisphere's GROUND term
       and renders at ~0.42x its measured colour. That is the near-black-splat
       failure campus-markings.js, campus-muir-field.js and campus-rimac.js each
       record, and campus-eighth.js worked around a fourth time by re-ordering
       the output here. Fixed at the source instead; the guard is
       tests/campus-drape.test.mjs, which asserts normal.y > 0 for every
       triangle this emits. */
    for (const vi of [tri[0], tri[1], tri[2]]) {
      const x = contour[vi].x, z = -contour[vi].y;
      out.push(x, heightAt(x, z) + lift, z);
    }
  }
}

/** A ribbon of quads `2 * half` metres wide along a world-space polyline. */
export function ribbon(out, pts, half, heightAt, lift) {
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 1e-4) continue;
    const n = Math.max(1, Math.ceil(len / MAX_SEG));
    const ux = (bx - ax) / len, uz = (bz - az) / len;
    const px = -uz * half, pz = ux * half;
    for (let k = 0; k < n; k++) {
      const sx = ax + ux * len * (k / n), sz = az + uz * len * (k / n);
      const ex = ax + ux * len * ((k + 1) / n), ez = az + uz * len * ((k + 1) / n);
      const q = [[sx + px, sz + pz], [sx - px, sz - pz], [ex + px, ez + pz], [ex - px, ez - pz]]
        .map(([x, z]) => [x, heightAt(x, z) + lift, z]);
      out.push(...q[0], ...q[2], ...q[1], ...q[1], ...q[2], ...q[3]);
    }
  }
}

/**
 * The band between two loops, paired index for index. The caller owes it two
 * loops of the SAME structure — same point count, corresponding corners — or
 * the quads shear. That is why callers with an arc in the loop sample it into
 * a fixed number of points whatever its radius.
 *
 * FACING, unlike fillPoly's, is the CALLER's: there is no contour to
 * normalise, so the band faces whichever way the two loops are ordered, and
 * swapping them flips it. One call is always uniformly wound. Today's only
 * consumer (campus-rimac.js) draws unlit and cannot see it; a LIT consumer
 * must pick the order that gives it +y and assert it.
 */
export function bandBetween(out, outer, inner, heightAt, lift) {
  const n = Math.min(outer.length, inner.length);
  for (let i = 1; i < n; i++) {
    const q = [outer[i - 1], inner[i - 1], outer[i], inner[i]]
      .map(([x, z]) => [x, heightAt(x, z) + lift, z]);
    out.push(...q[0], ...q[2], ...q[1], ...q[1], ...q[2], ...q[3]);
  }
}

/* The eight corners of a unit box, and the twelve triangles over them. */
const BOX_CORNERS = [
  [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
  [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
];
const BOX_TRIS = [
  0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4,
  3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5,
];

/**
 * A collector for standing boxes that MERGES per colour rather than
 * instancing. Instancing is the right answer when the boxes repeat — a row of
 * identical fence posts sharing one rotation, as campus-muir-field.js has —
 * and the wrong one when they do not: posts following a curve each carry
 * their own heading and bleacher risers each their own height, so an
 * instanced build degenerates to one draw call per object. Merged, a few
 * thousand triangles of that kind cost one or two.
 */
export function solids() {
  const byColour = new Map();
  return {
    box(w, h, d, colour, x, y, z, rot) {
      if (!byColour.has(colour)) byColour.set(colour, []);
      const out = byColour.get(colour);
      const c = Math.cos(rot), s = Math.sin(rot);
      const v = BOX_CORNERS.map(([sx, sy, sz]) => {
        const lx = (sx * w) / 2, ly = (sy * h) / 2, lz = (sz * d) / 2;
        /* A box's local +X lands on world (cos rot, -sin rot) — the same
           convention campus-details.js's banner arms use. */
        return [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
      });
      for (const i of BOX_TRIS) out.push(...v[i]);
    },
    build(group) {
      for (const [colour, positions] of byColour) {
        if (!positions.length) continue;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        geo.computeVertexNormals();
        group.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: colour })));
      }
    },
  };
}
