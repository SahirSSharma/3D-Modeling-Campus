// The painted lines of every sports surface, drawn as geometry.
//
// docs/data/campus-markings.json carries the vectors that
// scripts/build-campus-markings.mjs fitted to the satellite imagery — the
// soccer touchlines and centre circles, the full tennis and basketball line
// sets, the track's nine lanes, the Muir trident. This module only DRAWS
// them: thin quads along each polyline, arcs tessellated to the same, filled
// silhouettes triangulated, everything draped on the terrain at a small lift
// with a polygon offset so the paint never fights the court it sits on.
//
// One merged mesh per colour — a dozen facilities and 200+ markings land in
// a handful of draw calls. The file being absent must never take the walk
// down: everything resolves to a quiet no-op.
import * as THREE from "../vendor/three/three.module.min.js";
import { OVERLAY, overlayLift, applyOverlayDepth, sceneTone } from "./campus-overlay.js";

const MARKINGS_URL = new URL("../data/campus-markings.json", import.meta.url);

/* Painted lines sit on the shared decal-stack ladder's "paint" rung
   (campus-overlay.js) — after every pad and carpet surface, ordered by
   renderOrder rather than by how close the lifts happen to sit. */
const LIFT = overlayLift("paint");
/* Ground can bend between samples; long line runs are subdivided so the
   paint follows it. Same idea as campus-ground.js's EDGE. */
const MAX_SEG = 6;

/** Tessellate one marking into flat polylines of [x, z] points. */
export function markingToPolylines(mk) {
  if (mk.kind === "arc") {
    const n = Math.max(16, Math.ceil((Math.abs(mk.a1 - mk.a0) * mk.r) / 0.6));
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = mk.a0 + ((mk.a1 - mk.a0) * i) / n;
      pts.push([mk.c[0] + Math.cos(a) * mk.r, mk.c[1] + Math.sin(a) * mk.r]);
    }
    return [pts];
  }
  if (mk.kind === "fill") return [mk.poly];
  return [mk.pts];
}

/** Push a ribbon of quads along a polyline into `out`. */
function ribbon(out, pts, half, heightAt) {
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1];
    const [bx, bz] = pts[i];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 1e-4) continue;
    const n = Math.max(1, Math.ceil(len / MAX_SEG));
    const ux = (bx - ax) / len;
    const uz = (bz - az) / len;
    const px = -uz * half;
    const pz = ux * half;
    for (let k = 0; k < n; k++) {
      const sx = ax + ux * (len * k) / n, sz = az + uz * (len * k) / n;
      const ex = ax + ux * (len * (k + 1)) / n, ez = az + uz * (len * (k + 1)) / n;
      const q = [
        [sx + px, sz + pz], [sx - px, sz - pz],
        [ex + px, ez + pz], [ex - px, ez - pz],
      ].map(([x, z]) => [x, heightAt(x, z) + LIFT, z]);
      out.push(...q[0], ...q[2], ...q[1], ...q[1], ...q[2], ...q[3]);
    }
  }
}

/** Triangulate a filled polygon (the trident, the track's surfaces) onto the
    ground, honouring holes (the track ring is an annulus) at the caller's
    chosen ladder-rung lift (surfaces sit UNDER the painted lines). */
function fill(out, poly, heightAt, holes = [], lift = overlayLift("logo")) {
  const contour = poly.map(([x, z]) => new THREE.Vector2(x, -z));
  const holeVecs = holes
    .filter((h) => h && h.length >= 3)
    .map((h) => h.map(([x, z]) => new THREE.Vector2(x, -z)));
  let tris;
  try {
    tris = THREE.ShapeUtils.triangulateShape(contour, holeVecs);
  } catch {
    return; // a degenerate logo must not cost the campus
  }
  const verts = contour.concat(...holeVecs);
  for (const tri of tris) {
    /* Wound for an upward face after the -z flip: reverse order. */
    for (const vi of [tri[0], tri[2], tri[1]]) {
      const x = verts[vi].x;
      const z = -verts[vi].y;
      out.push(x, heightAt(x, z) + lift, z);
    }
  }
}

/**
 * Painted LOGOS (the trident) get the FULL lift campus-overlay.js's
 * `sceneTone` offers — a logo fill left at its true measured value reads as
 * a black splat on the brightened turf, which is exactly what the Muir
 * trident did before this existed. A thin case of the shared function, not
 * a sibling formula: this module never rolls its own tone math.
 *
 * Painted SURFACES (the track ring, its infield) stay unrouted — measured
 * and re-verified 2026-08-03 at luma 149.3 (terracotta ring) and 135.0
 * (infield green), both already brighter than the lifted lawn (luma
 * 104.3) beside them, so they were never sinking and the lift would only
 * push them past it. The material colour picked below (`family === "logo"`)
 * still gates on family, unchanged from before this fix.
 */
export const sceneToneLogo = (hex) => sceneTone(hex, 1);

/**
 * Draw every facility's markings. Returns a group immediately and fills it
 * when the data arrives; missing data is a no-op, exactly like the boundary
 * line in campus-world.js.
 */
export function createMarkings(scene, heightAt) {
  const group = new THREE.Group();
  scene.add(group);

  fetch(MARKINGS_URL)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .then((data) => {
      if (!data?.facilities?.length) return;
      /* Three families, each merged per colour and pinned to its own rung of
         the shared decal-stack ladder (campus-overlay.js): SURFACES (the
         track ring and infield) on "pad", painted LINES on "paint", and
         LOGO fills (the trident) on "logo" — ordered by renderOrder, not by
         how close the lifts sit. A marking's per-record `lift` field from the
         data is no longer read as a world lift: every marking in a family
         shares that family's rung, which is what fixed the surface-fills-
         equal-ground collision (they defaulted to 0.04, exactly the old
         ground lift). */
      const FAMILY_RUNG = { surface: "pad", line: "paint", logo: "logo" };
      const buckets = new Map(); // `${family}|${colour}` -> positions[]
      const put = (family, colour) => {
        const key = `${family}|${colour}`;
        if (!buckets.has(key)) buckets.set(key, []);
        return buckets.get(key);
      };
      for (const facility of data.facilities) {
        for (const mk of facility.markings || []) {
          const colour = mk.colour || "#f4f4f0";
          if (mk.kind === "fill" && mk.surface) {
            fill(put("surface", colour), mk.poly, heightAt, mk.holes || [], overlayLift("pad"));
          } else if (mk.kind === "fill") {
            fill(put("logo", colour), mk.poly, heightAt, mk.holes || [], overlayLift("logo"));
          } else {
            const half = Math.max(0.025, (mk.width_m || 0.12) / 2);
            for (const line of markingToPolylines(mk)) {
              ribbon(put("line", colour), line, half, heightAt);
            }
          }
        }
      }
      for (const [key, positions] of buckets) {
        const [family, colour] = key.split("|");
        const rung = FAMILY_RUNG[family];
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        /* UNLIT, deliberately. Paint is flat presentation colour, and lit
           materials here have a trap: with DoubleSide, a fill whose
           triangulation happens to wind back-facing gets its normal flipped
           and is lit by the hemisphere's GROUND term — which is exactly how
           the navy trident rendered as a near-black splat. Basic material
           renders the stated colour, both faces, always. */
        const mat = applyOverlayDepth(
          new THREE.MeshBasicMaterial({
            color: family === "logo" ? sceneToneLogo(colour) : colour,
            side: THREE.DoubleSide,
          }),
          rung
        );
        const mesh = new THREE.Mesh(geo, mat);
        mesh.renderOrder = OVERLAY[rung].renderOrder;
        group.add(mesh);
      }
    });

  return group;
}
