// A football goal — the frame AND the net.
//
// The model has had goals since Muir Field was built: two posts, a crossbar,
// two short back posts and a back rail, with a comment in the renderer that
// called the back frame "raked to the net". There was no net. Nothing in the
// repository drew one, so at eye level a goal read as bare scaffolding and
// from overhead it read as almost nothing — which is exactly what got
// noticed. The frame was only ever half of a goal.
//
// This module is the goal itself rather than Muir's goal: pure geometry in
// the goal's own metre frame, so any pitch in the data can stand one up.
// campus-muir-field.js is the first caller. RIMAC's two pitches
// (`kind: "pitch"` in campus-markings.json) carry no goals at all yet and
// are the second, once their reference imagery lands.
//
// THE GOAL'S OWN AXES. Origin at the middle of the goal line, on the ground.
// +x runs right along the mouth, +y is up, +z runs BACK, away from the field,
// the way the net rakes. Every number below is a metre in that frame and
// nothing here knows where on campus it is; goalWorld() is the one place a
// world coordinate appears, and it takes the facility's own footprint quad.
//
// goalSpec() is pure, so the tests measure the exact goal the renderer draws.
// A malformed set of dimensions returns null rather than throwing — the same
// quiet no-op every other module here answers bad data with.
import * as THREE from "../vendor/three/three.module.min.js";

/* IFAB Laws of the Game, Law 1 (The Field of Play). These are the three
   figures the Law actually fixes, and they are fixed in imperial: the posts
   stand 8 yd apart measured between their INNER edges (7.32 m), the lower
   edge of the crossbar is 8 ft above the ground (2.44 m), and neither posts
   nor crossbar may exceed 12 cm in width or depth. */
export const GOAL_REGULATION = { span_m: 7.32, height_m: 2.44, post_m: 0.12 };

/* The net's mesh gauge. The Law is silent on it — it says only that a net
   "must be properly supported and must not interfere with the goalkeeper" —
   so the size of the squares is a product standard, not a Law. Full-size
   goal nets are made in 100–120 mm square mesh; this takes the coarse end,
   and the choice is a rendering one as much as a fidelity one. At 100 mm the
   cords fall below one pixel of SPACING at ordinary viewing distances and
   the net stops resolving as netting and starts reading as the solid pale
   panel this whole exercise exists to avoid. */
export const NET_MESH_M = 0.12;

/* Net twine is 2–4 mm braided cord. That is why the net is drawn as LINES
   and not as modelled members: WebGL draws a line one pixel wide whatever
   its material asks for, and one pixel is ~13 mm of ground at 12 m and
   ~66 mm at 60 m, so a box cord of honest 3 mm thickness would simply
   disappear at every distance a walker ever sees a goal from, while a box
   cord thick enough to survive would be a lie about how thick twine is.
   Drawing a 1 px line is the smallest lie available; NET_OPACITY pays back
   the width that forced pixel over-states. Its value is a stated judgement,
   NOT a measurement: the physically exact sub-pixel coverage of a 3 mm cord
   is 0.23 at 12 m and 0.05 at 60 m, which would render the net invisible in
   the two views it most needs to be visible in. */
export const NET_OPACITY = 0.5;

const len2 = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
const finite = (...n) => n.every((v) => Number.isFinite(v) && v > 0);

/**
 * Cords of one flat net panel, as straight segments in the goal's frame.
 *
 * `quad` is [a, b, c, d] walking the panel's perimeter, with s running a→b
 * (and d→c) and t running a→d (and b→c). Under the bilinear map both
 * families come out STRAIGHT — hold either parameter and the other is linear
 * — so every cord is one segment, however skewed the panel is. The side
 * panels are trapezoids (2.44 m at the mouth, 0.9 m at the back rail), and
 * the count for each direction is taken from the MEAN of its two opposite
 * edges, so a trapezoid's mesh averages the stated gauge instead of holding
 * it on one edge and stretching it on the other. A real net stretches the
 * same way it is hung.
 */
function panelCords(quad, mesh_m) {
  const [a, b, c, d] = quad;
  const at = (s, t) => {
    const p = [];
    for (let k = 0; k < 3; k++) {
      const lo = a[k] + (b[k] - a[k]) * s;
      const hi = d[k] + (c[k] - d[k]) * s;
      p.push(lo + (hi - lo) * t);
    }
    return p;
  };
  const nS = Math.max(1, Math.round((len2(a, b) + len2(d, c)) / 2 / mesh_m));
  const nT = Math.max(1, Math.round((len2(a, d) + len2(b, c)) / 2 / mesh_m));
  const cords = [];
  for (let i = 0; i <= nS; i++) cords.push([at(i / nS, 0), at(i / nS, 1)]);
  for (let j = 0; j <= nT; j++) cords.push([at(0, j / nT), at(1, j / nT)]);
  return { cords, across: nS, along: nT };
}

/**
 * One goal, frame and net, in the goal's own frame.
 *
 * `depth_m` and `backHeight_m` are the shape of the particular goal standing
 * on the particular field — a portable goal rakes back shallowly, a fixed
 * one deeply — so they have no regulation default and the caller states them
 * from whatever it measured. Span, height and post gauge default to Law 1.
 *
 * The net is NOT given a sag. A hung net does sag, but nothing available
 * here resolves how much: the aerial that gives the footprint is 0.098 m per
 * pixel looking straight down, which is the one direction a sag is invisible
 * from. So the net is drawn as the straight rake its own frame defines, and
 * the curve is left out rather than invented — the same call this repository
 * makes for the faded marking sets it refuses to paint.
 */
export function goalSpec({
  span_m = GOAL_REGULATION.span_m,
  height_m = GOAL_REGULATION.height_m,
  depth_m,
  backHeight_m,
  post_m = GOAL_REGULATION.post_m,
  backPost_m = 0.09,
  backRail_m = 0.08,
  mesh_m = NET_MESH_M,
} = {}) {
  if (!finite(span_m, height_m, depth_m, backHeight_m, post_m, mesh_m)) return null;
  if (backHeight_m > height_m) return null; // the rake would run uphill
  /* THE LAW MEASURES BETWEEN THE INNER EDGES, which is why there are two
     half-widths here and not one. `hx` is the inner face of a post — the
     mouth a ball passes through, and the line the facility's own footprint
     quad traces — while the post itself is centred half a gauge outboard of
     it at `px`. Placing the posts ON the mouth line, which is what the
     inline version this replaces did, narrows the real opening to 7.20 m:
     small, but it is exactly the kind of quiet 12 cm this repository exists
     to not have. Everything the net hangs off is at px; only the mouth
     itself is at hx. */
  const hx = span_m / 2;
  const px = hx + post_m / 2;

  /* Boxes, each sized (w along x, h up, d along z) and centred at `at`. */
  const frame = [
    { id: "post-left", role: "post", w: post_m, h: height_m, d: post_m,
      at: [-px, height_m / 2, 0] },
    { id: "post-right", role: "post", w: post_m, h: height_m, d: post_m,
      at: [px, height_m / 2, 0] },
    /* The crossbar runs outer face to outer face, so its ends close the two
       corners instead of leaving a square notch at each post top. */
    { id: "crossbar", role: "crossbar", w: span_m + 2 * post_m, h: post_m, d: post_m,
      at: [0, height_m, 0] },
    { id: "back-post-left", role: "back-post", w: backPost_m, h: backHeight_m, d: backPost_m,
      at: [-px, backHeight_m / 2, depth_m] },
    { id: "back-post-right", role: "back-post", w: backPost_m, h: backHeight_m, d: backPost_m,
      at: [px, backHeight_m / 2, depth_m] },
    { id: "back-rail", role: "back-rail", w: 2 * px + backPost_m, h: backRail_m, d: backRail_m,
      at: [0, backHeight_m, depth_m] },
  ];

  /* Four panels, and between them the whole hung surface: up the back, over
     the top from crossbar to back rail, and a triangle-ish trapezoid closing
     each side. The mouth is the one face left open, which is the only face a
     goal has. */
  const panels = [
    { id: "net-back", role: "back", quad: [
      [-px, 0, depth_m], [px, 0, depth_m], [px, backHeight_m, depth_m], [-px, backHeight_m, depth_m],
    ] },
    { id: "net-rake", role: "rake", quad: [
      [-px, height_m, 0], [px, height_m, 0], [px, backHeight_m, depth_m], [-px, backHeight_m, depth_m],
    ] },
    { id: "net-side-left", role: "side", side: "left", quad: [
      [-px, 0, 0], [-px, 0, depth_m], [-px, backHeight_m, depth_m], [-px, height_m, 0],
    ] },
    { id: "net-side-right", role: "side", side: "right", quad: [
      [px, 0, 0], [px, 0, depth_m], [px, backHeight_m, depth_m], [px, height_m, 0],
    ] },
  ];
  for (const p of panels) Object.assign(p, panelCords(p.quad, mesh_m));

  return { span_m, height_m, depth_m, backHeight_m, mesh_m, post_m, postCentre_m: px, frame, panels };
}

/**
 * Stand a goal on a world footprint.
 *
 * `quad` is the goal's plan outline in world metres — exactly the four
 * corners a facility spec already carries, [mouth-left, mouth-right,
 * back-right, back-left], each an [x, z] pair. The mouth line gives +x and
 * the near side's rake gives +z, so the goal inherits the facility's fitted
 * orientation and a refit carries it along; its SIZE, though, stays the
 * spec's, so a slightly-off footprint can never make the mouth unregulation.
 *
 * `groundY` is ONE terrain datum for the whole goal, sampled by the caller
 * at the mouth centre. A goal is a welded frame: it does not follow a bump.
 * Sampling per member instead — which the old inline version did — lets one
 * post stand taller than the other and shears every net cord with it.
 *
 * Returns boxes ready for an instanced build, and the net as a flat
 * [x,y,z, x,y,z, ...] vertex list in LineSegments pair order.
 */
export function goalWorld(spec, quad, groundY) {
  if (!spec || !Array.isArray(quad) || quad.length < 4 || !Number.isFinite(groundY)) return null;
  const [left, right, , backLeft] = quad;
  const mx = right[0] - left[0], mz = right[1] - left[1];
  const bx = backLeft[0] - left[0], bz = backLeft[1] - left[1];
  const mLen = Math.hypot(mx, mz), bLen = Math.hypot(bx, bz);
  if (!(mLen > 0.1) || !(bLen > 0.01)) return null;
  const m = [mx / mLen, mz / mLen];
  const b = [bx / bLen, bz / bLen];
  const cx = (left[0] + right[0]) / 2, cz = (left[1] + right[1]) / 2;
  const at = ([x, y, z]) => [cx + m[0] * x + b[0] * z, groundY + y, cz + m[1] * x + b[1] * z];

  /* A box's local +X lands on world (cos rot, -sin rot) — the convention
     campus-details.js's banner arms set and campus-muir-field.js's bounds
     frame repeats — so this is the rotation that points a crossbar along the
     mouth. Derived from the same quad the geometry is, so the two cannot
     drift apart. */
  const rot = Math.atan2(-m[1], m[0]);

  const boxes = spec.frame.map((f) => {
    const [x, y, z] = at(f.at);
    return { id: f.id, role: f.role, w: f.w, h: f.h, d: f.d, x, y, z, rot };
  });
  const cords = [];
  for (const p of spec.panels) {
    for (const [p0, p1] of p.cords) cords.push(...at(p0), ...at(p1));
  }
  return { boxes, cords, rot };
}

/**
 * The net as one LineSegments — every cord of every panel of every goal on a
 * facility in a single draw, so a net costs the frame rate nothing.
 *
 * Unlit on purpose: LineBasicMaterial has no lighting model, and a net wants
 * none. It hangs in front of, and behind, its own frame; `depthWrite: false`
 * stops the near cords from punching holes in the far ones, while depth
 * testing still lets terrain, buildings and trees occlude the whole thing.
 */
export function createGoalNet(cords, colour) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(cords, 3));
  const mat = new THREE.LineBasicMaterial({
    color: colour, transparent: true, opacity: NET_OPACITY, depthWrite: false, depthTest: true,
  });
  return new THREE.LineSegments(geo, mat);
}
