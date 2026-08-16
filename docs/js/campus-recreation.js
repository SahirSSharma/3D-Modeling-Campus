// The Muir athletics zone, as the aerials show it.
//
// campus-markings.js already paints the LINES of the Muir tennis and
// basketball courts. What the walk still lacked was everything that stands
// up off those slabs — the nets, the hoop assemblies, the court light poles
// — and the four rec surfaces north and east of the basketball pad that the
// GIS knows only as one flat teal "court" tone: the sand volleyball pit,
// Triton Bar Park's rubber, the blue-purple rec terrace, and the two-block
// red/grey identity of the tennis pads themselves.
//
// Everything here is MEASURED off Sahir's four aerial references (colours by
// median sample, positions by pixel scan calibrated against the painted
// court rectangles that campus-markings.js renders). Two counts came back
// different from the brief and the aerial won both times: the tennis complex
// is SIX courts (two green on the red pad, four blue on the grey — scanned,
// not eyeballed), and the sand carries TWO nets on one centred row, not four
// (the pit is 33 m deep; a second row of 16 m courts does not fit, and the
// measured net line sits dead on the pit's centreline).
//
// placeRecreation() is pure data in, data out — the tests run the exact
// placement the renderer uses. Court-borne families (nets, hoops, lights)
// are derived from the marking geometry itself, so a net can never drift off
// the paint it belongs to; if the markings never load, they simply do not
// appear, exactly as the paint does not.
import * as THREE from "../vendor/three/three.module.min.js";
import { OVERLAY, overlayLift, applyOverlayDepth, sceneTone } from "./campus-overlay.js";

/* Every colour is the median of a rect sampled from the aerials. */
export const REC_COLORS = {
  tennisWestApron: "#c8675a", // the red-orange pad under the two green courts
  tennisWestCourt: "#84a389",
  tennisEastApron: "#5b7490", // the dark grey pad under the four blue courts
  tennisEastCourt: "#4470ad",
  basketballCourt: "#4779b6",
  concrete: "#d2cec7", // the pale apron ringing the basketball slab
  sand: "#ded5ca",
  curb: "#c9c5bd",
  barPark: "#42546a", // Triton Bar Park's near-black rubber
  terrace: "#6f89b0", // the blue-purple rec terrace
  terraceMat: "#b7a79c", // its tan mat grid
  tent: "#32539c", // the blue canopies and the turf lane
  steel: "#2e2e2c", // rigs, hoop poles, light poles
  backboard: "#dfe0da",
  ring: "#d4622a",
  net: "#23252a",
  tape: "#eceee8",
  table: "#8d8377",
};

/* Aprons sit on the "pad" rung and court surfaces on the "carpet" rung of
   the shared decal-stack ladder (campus-overlay.js — see padGroup below), so
   the painted lines campus-markings.js draws on top always win the depth
   fight, ordered by renderOrder rather than by how close the lifts sit. */
const MAX_SEG = 6; // pads are subdivided so they follow bending ground

/* Rects measured off "CleanShot 2026-08-03 at 12.55.08" (the courts/sand
   frame), calibrated on the painted basketball rectangle: 18.7 px/m across,
   19.0 px/m down. Cross-checked against the arcgis court polygons, which
   agree on x within 1.5 m and on z once their constant ~4.9 m southward
   offset from the fitted markings is removed. */
const SAND = { x0: -99.5, x1: -65.3, z0: -6.8, z1: 26.0 };
const BAR_PARK = { x0: -65.1, x1: -44.4, z0: 11.0, z1: 26.0 };
const TERRACE = { x0: -63.6, x1: -44.1, z0: 28.1, z1: 60.1 };
/* The two measured net lines, and the pit's low concrete edge. */
const VOLLEY_NETS = [
  { ax: -96.25, az: 9.15, bx: -85.02, bz: 9.15 },
  { ax: -81.46, az: 9.04, bx: -70.22, bz: 9.04 },
];

/* Triton Bar Park's rigs, as fractions of the pad: a west column of three
   frames, a centre row of four, a lower-left pair, a bottom pair, and the
   east column of parallel-bar stations along the rail. */
const RIG_LAYOUT = [
  ["frame", 0.14, 0.18], ["frame", 0.14, 0.38], ["frame", 0.14, 0.56],
  ["frame", 0.36, 0.42], ["frame", 0.50, 0.42], ["frame", 0.63, 0.42], ["frame", 0.74, 0.42],
  ["frame", 0.30, 0.72], ["frame", 0.36, 0.86],
  ["frame", 0.58, 0.82], ["frame", 0.68, 0.82],
  ["bars", 0.86, 0.10], ["bars", 0.86, 0.32], ["bars", 0.86, 0.46],
  ["bars", 0.86, 0.62], ["bars", 0.90, 0.24],
];

/* The tan mat grid on the terrace, and the two blue canopies — the long one
   over the north end of the turf lane, the square one against the east rail. */
const TERRACE_MATS = [
  [-60.44, 30.11], [-57.06, 30.11], [-50.81, 30.43],
  [-55.88, 34.32], [-51.71, 34.32], [-51.71, 39.15],
];
const MAT_SIZE = [2.14, 3.36];
const TENTS = [
  { x: -57.43, z: 39.84, w: 2.46, d: 6.2 },
  { x: -47.10, z: 43.40, w: 3.0, d: 6.2 },
];
const TURF_LANE = { x0: -58.66, x1: -56.20, z0: 42.94, z1: 54.40 };
const TERRACE_RIGS = [[-47.9, 35], [-47.9, 41], [-47.9, 47], [-47.9, 53]];
const PICNIC = [[-62.0, 50.0], [-62.0, 56.0], [-63.4, 13.5], [-63.4, 23.5]];

/* Gymnasium Lot (Scholars Lane), north-east of the Main Gym. The aisle runs
   north-south and the cars park along it, long axis with the aisle — which
   is what the few blobs the tree canopy leaves visible actually measure. */
const CAR_ROW = { x: -30.6, z0: 30.8, pitch: 4.7, n: 6 };
const CAR_COLORS = ["#e8e9e6", "#a9adb1", "#33363a", "#e8e9e6", "#2b3a55", "#a9adb1"];

const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** Closed 4-corner marking rectangles whose sides fall in the given ranges. */
function courtRects(facility, shortRange, longRange) {
  const out = [];
  for (const mk of facility?.markings || []) {
    if (mk.kind !== "line" || !mk.pts || mk.pts.length !== 5) continue;
    const p = mk.pts.slice(0, 4);
    const a = dist(p[0], p[1]);
    const b = dist(p[1], p[2]);
    const [s, l] = a < b ? [a, b] : [b, a];
    if (s < shortRange[0] || s > shortRange[1]) continue;
    if (l < longRange[0] || l > longRange[1]) continue;
    /* Order the corners so p0-p1 is always a LONG side. */
    out.push(a >= b ? p : [p[1], p[2], p[3], p[0]]);
  }
  return out;
}

const rectCentre = (p) => [
  (p[0][0] + p[1][0] + p[2][0] + p[3][0]) / 4,
  (p[0][1] + p[1][1] + p[2][1] + p[3][1]) / 4,
];

/**
 * Every recreation object, from the marking geometry and the measured rects.
 * Deterministic: the same data places the same hoop on every visit.
 */
export function placeRecreation(markings) {
  const byId = new Map((markings?.facilities || []).map((f) => [f.id, f]));
  const west = courtRects(byId.get("muir-tennis-west"), [10.0, 12.0], [23.0, 25.0]);
  const east = courtRects(byId.get("muir-tennis-east"), [10.0, 12.0], [23.0, 25.0]);
  const hoopCourts = courtRects(byId.get("muir-basketball"), [15.0, 18.0], [29.0, 32.5]);

  /* A tennis net spans the midpoints of the two sidelines, standing 0.914 m
     proud of each — the doubles net's 12.8 m between posts. */
  const tennisNets = [];
  for (const p of [...west, ...east]) {
    const a = mid(p[0], p[1]);
    const b = mid(p[2], p[3]);
    const len = dist(a, b);
    const ux = (b[0] - a[0]) / len;
    const uz = (b[1] - a[1]) / len;
    tennisNets.push({
      ax: a[0] - ux * 0.914, az: a[1] - uz * 0.914,
      bx: b[0] + ux * 0.914, bz: b[1] + uz * 0.914,
    });
  }

  /* Court surfaces, so the green pad and the blue pad read as two blocks
     rather than one GIS teal. Aprons come from the facility bounds for the
     west pad and from the measured pad edges for the east. */
  const tennisCourts = [
    ...west.map((p) => ({ poly: p, colour: REC_COLORS.tennisWestCourt })),
    ...east.map((p) => ({ poly: p, colour: REC_COLORS.tennisEastCourt })),
  ];
  const tennisPads = [];
  if (west.length) {
    const xs = west.flat().map((q) => q[0]);
    const zs = west.flat().map((q) => q[1]);
    tennisPads.push({
      x0: Math.min(...xs) - 2.3, x1: Math.max(...xs) + 3.3,
      z0: Math.min(...zs) - 7.2, z1: Math.max(...zs) + 4.5,
      colour: REC_COLORS.tennisWestApron,
    });
  }
  if (east.length) {
    const xs = east.flat().map((q) => q[0]);
    const zs = east.flat().map((q) => q[1]);
    tennisPads.push({
      x0: Math.min(...xs) - 2.5, x1: Math.max(...xs) + 2.5,
      z0: Math.min(...zs) - 7.2, z1: Math.max(...zs) + 4.5,
      colour: REC_COLORS.tennisEastApron,
    });
  }

  /* Eight hoops: one behind each baseline, and one at mid-length on each
     sideline for the cross-court games. The ring centres 1.575 m in from the
     line it hangs over — which lands them exactly on the fitted three-point
     arc centres, the check that says the derivation is right. */
  const hoops = [];
  const basketballCourts = [];
  for (const p of hoopCourts) {
    basketballCourts.push({ poly: p, colour: REC_COLORS.basketballCourt });
    const c = rectCentre(p);
    const L = dist(p[0], p[1]);
    const W = dist(p[1], p[2]);
    const ul = [(p[1][0] - p[0][0]) / L, (p[1][1] - p[0][1]) / L];
    const uw = [(p[2][0] - p[1][0]) / W, (p[2][1] - p[1][1]) / W];
    for (const [u, half] of [[ul, L / 2], [uw, W / 2]]) {
      for (const s of [-1, 1]) {
        const d = half - 1.575;
        hoops.push({
          x: c[0] + u[0] * d * s, z: c[1] + u[1] * d * s,
          /* Face back down the axis, toward the court's centre. */
          rot: Math.atan2(-u[0] * s, -u[1] * s),
        });
      }
    }
  }

  /* Six light poles, measured off the aerial at x -63.8 and z 30.8 / 55.3:
     just outside each outer sideline and on the divider between the courts,
     near each baseline. Derived from the court rectangles rather than the
     padded facility bounds, which run 2.5 m wide of the paint. */
  const courtLights = [];
  if (hoopCourts.length === 2) {
    const xs = hoopCourts.flat().map((q) => q[0]);
    const zs = hoopCourts.flat().map((q) => q[1]);
    const cx = hoopCourts.map((p) => rectCentre(p)[0]).sort((a, b) => a - b);
    const columns = [Math.min(...xs) - 1.3, (cx[0] + cx[1]) / 2, Math.max(...xs) + 1.3];
    const z0 = Math.min(...zs);
    const z1 = Math.max(...zs);
    for (const x of columns) {
      for (const t of [0.07, 0.87]) courtLights.push({ x, z: z0 + (z1 - z0) * t });
    }
  }

  /* The sand pit: its pad, its concrete edge curb, and the one centred row
     of two nets the aerial actually carries. */
  const volleyNets = VOLLEY_NETS.map((n) => ({ ...n }));

  const rigs = RIG_LAYOUT.map(([kind, u, v]) => ({
    kind,
    x: BAR_PARK.x0 + (BAR_PARK.x1 - BAR_PARK.x0) * u,
    z: BAR_PARK.z0 + (BAR_PARK.z1 - BAR_PARK.z0) * v,
  }));

  const terraceMats = TERRACE_MATS.map(([x, z]) => ({
    x0: x - MAT_SIZE[0] / 2, x1: x + MAT_SIZE[0] / 2,
    z0: z - MAT_SIZE[1] / 2, z1: z + MAT_SIZE[1] / 2,
    colour: REC_COLORS.terraceMat,
  }));

  const cars = [];
  for (let i = 0; i < CAR_ROW.n; i++) {
    cars.push({ x: CAR_ROW.x, z: CAR_ROW.z0 + i * CAR_ROW.pitch, colour: CAR_COLORS[i % CAR_COLORS.length] });
  }

  return {
    tennisPads, tennisCourts, tennisNets,
    basketballPads: hoopCourts.length
      ? [{ x0: -101.68, x1: -64.0, z0: 26.18, z1: 61.83, colour: REC_COLORS.concrete }]
      : [],
    basketballCourts, hoops, courtLights,
    sandPad: { ...SAND, colour: REC_COLORS.sand },
    volleyNets,
    barPad: { ...BAR_PARK, colour: REC_COLORS.barPark },
    rigs,
    terracePad: { ...TERRACE, colour: REC_COLORS.terrace },
    terraceMats,
    turfLane: { ...TURF_LANE, colour: REC_COLORS.tent },
    tents: TENTS.map((t) => ({ ...t })),
    terraceRigs: TERRACE_RIGS.map(([x, z]) => ({ kind: "bars", x, z })),
    picnicTables: PICNIC.map(([x, z]) => ({ x, z })),
    cars,
  };
}

/* ------------------------------------------------------------- rendering */

/* Steel frames share this with concrete curbs, tent fabric and table tops, so
   it stays matte rather than making the non-metal callers metallic. */
const lambert = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.95 });

function instanced(geo, mat, items, place) {
  const mesh = new THREE.InstancedMesh(geo, mat, items.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const axis = new THREE.Vector3(0, 1, 0);
  const c = new THREE.Color();
  items.forEach((it, i) => {
    const p = place(it);
    q.setFromAxisAngle(axis, p.rot || 0);
    pos.set(p.x, p.y, p.z);
    scale.set(p.sx ?? 1, p.sy ?? 1, p.sz ?? 1);
    m.compose(pos, q, scale);
    mesh.setMatrixAt(i, m);
    if (p.color) mesh.setColorAt(i, c.set(p.color));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

/** Push one ground-hugging quad's triangles into `out`, subdivided so it
    follows the terrain the way campus-markings.js's paint does. */
function padQuad(out, corners, heightAt, lift) {
  const [a, b, c, d] = corners; // a-b one edge, d-c the opposite
  const nu = Math.max(1, Math.ceil(dist(a, b) / MAX_SEG));
  const nv = Math.max(1, Math.ceil(dist(a, d) / MAX_SEG));
  const at = (u, v) => {
    const x = a[0] + (b[0] - a[0]) * u + (d[0] - a[0]) * v + (a[0] - b[0] + c[0] - d[0]) * u * v;
    const z = a[1] + (b[1] - a[1]) * u + (d[1] - a[1]) * v + (a[1] - b[1] + c[1] - d[1]) * u * v;
    return [x, heightAt(x, z) + lift, z];
  };
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const p00 = at(i / nu, j / nv), p10 = at((i + 1) / nu, j / nv);
      const p01 = at(i / nu, (j + 1) / nv), p11 = at((i + 1) / nu, (j + 1) / nv);
      out.push(...p00, ...p11, ...p10, ...p00, ...p01, ...p11);
    }
  }
}

const rectCorners = (r) => [[r.x0, r.z0], [r.x1, r.z0], [r.x1, r.z1], [r.x0, r.z1]];

/* Rec.601 luma of a hex string — a DECISION helper (which raw measured
   fills are dark enough to sink), not a second tone formula; the one real
   colour transform is still campus-overlay.js's sceneTone. */
const luma601 = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
};
/* The lifted lawn beside this zone (campus-world.js's daylight blend,
   unrelated to this fix) renders at luma ~104 — measured 2026-08-03. A
   REC_COLORS fill already at or above that was never sinking (aprons,
   courts, concrete, sand: 111-214); only Bar Park's rubber (81.1) and the
   turf-lane/tent blue (81.5) sit below it and get the Muir turf's strength. */
const REC_ZONE_LAWN_LUMA = 104.3;
const REC_TONE_STRENGTH = 0.15;

/** One merged, decal-stacked mesh per pad colour, on the given ladder rung.
    Unlit fills darker than the lifted lawn beside them (REC_ZONE_LAWN_LUMA,
    the class the Muir turf sank under) route through sceneTone; anything at
    or above it keeps its true measured colour. */
function padGroup(pads, heightAt, rung) {
  const lift = overlayLift(rung);
  const buckets = new Map();
  for (const p of pads) {
    if (!buckets.has(p.colour)) buckets.set(p.colour, []);
    padQuad(buckets.get(p.colour), p.poly || rectCorners(p), heightAt, lift);
  }
  const group = new THREE.Group();
  for (const [colour, positions] of buckets) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const toned = luma601(colour) < REC_ZONE_LAWN_LUMA
      ? sceneTone(colour, REC_TONE_STRENGTH)
      : colour;
    const mat = applyOverlayDepth(
      new THREE.MeshBasicMaterial({ color: toned, side: THREE.DoubleSide }),
      rung
    );
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = OVERLAY[rung].renderOrder;
    group.add(mesh);
  }
  return group;
}

/** Posts, net body and white top tape along one measured net line. */
function netRun(group, nets, heightAt, { height, postR }) {
  const line = nets.map((n) => {
    const len = Math.hypot(n.bx - n.ax, n.bz - n.az);
    const x = (n.ax + n.bx) / 2;
    const z = (n.az + n.bz) / 2;
    /* The body hangs between the posts, so it takes ITS ground from THEIR
       ground — the mean of the two post samples, not a third sample at the
       midpoint. On the sand pit the midpoint reads 0.10 m off the posts'
       mean, which floated the tape clean off one post and buried it in the
       other; the mean halves the worst residual and ties it to the steel the
       net is actually strung from. */
    const y = (heightAt(n.ax, n.az) + heightAt(n.bx, n.bz)) / 2;
    return { x, z, y, len, rot: Math.atan2(n.bx - n.ax, n.bz - n.az) };
  });
  group.add(instanced(new THREE.BoxGeometry(0.05, height, 1), lambert(REC_COLORS.net), line,
    (n) => ({ x: n.x, y: n.y + height / 2, z: n.z, rot: n.rot, sz: n.len })));
  group.add(instanced(new THREE.BoxGeometry(0.07, 0.07, 1), lambert(REC_COLORS.tape), line,
    (n) => ({ x: n.x, y: n.y + height + 0.02, z: n.z, rot: n.rot, sz: n.len })));
  const posts = nets.flatMap((n) => [{ x: n.ax, z: n.az }, { x: n.bx, z: n.bz }]);
  group.add(instanced(new THREE.CylinderGeometry(postR, postR, height + 0.12, 6),
    lambert(REC_COLORS.steel), posts,
    (p) => ({ x: p.x, y: heightAt(p.x, p.z) + (height + 0.12) / 2, z: p.z })));
}

/**
 * The Muir athletics furniture, as ~30 instanced or merged draws.
 */
export function createRecreation(scene, { campus, arcgis, markings, heightAt } = {}) {
  const r = placeRecreation(markings);
  const group = new THREE.Group();

  /* --- surfaces, bottom up: aprons, then the courts painted on them. */
  group.add(padGroup([
    ...r.tennisPads, ...r.basketballPads,
    r.sandPad, r.barPad, r.terracePad,
  ], heightAt, "pad"));
  group.add(padGroup([
    ...r.tennisCourts, ...r.basketballCourts,
    ...r.terraceMats, r.turfLane,
  ], heightAt, "carpet"));

  /* --- the sand pit's low concrete edge. Subdivided the same way the pads
     are (MAX_SEG), because a 34 m side placed at one midpoint sample crossed
     half a metre of real grade — one end of the beam buried, the other
     floating in the air. Short segments follow the ground the way the pad
     under them does; the 0.02 m of shared length is the joint. */
  const s = r.sandPad;
  const curbs = [];
  const curbSide = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const segs = Math.max(1, Math.ceil(len / MAX_SEG));
    for (let i = 0; i < segs; i++) {
      const tm = (i + 0.5) / segs;
      curbs.push({
        x: x0 + (x1 - x0) * tm, z: z0 + (z1 - z0) * tm,
        len: len / segs + 0.02, rot: Math.atan2(x1 - x0, z1 - z0),
      });
    }
  };
  curbSide(s.x0, s.z0, s.x1, s.z0);
  curbSide(s.x0, s.z1, s.x1, s.z1);
  curbSide(s.x0, s.z0, s.x0, s.z1);
  curbSide(s.x1, s.z0, s.x1, s.z1);
  group.add(instanced(new THREE.BoxGeometry(0.35, 0.26, 1), lambert(REC_COLORS.curb), curbs,
    (c) => ({ x: c.x, y: heightAt(c.x, c.z) + 0.13, z: c.z, rot: c.rot, sz: c.len })));

  /* --- nets: tennis at 1.07 m, sand at 2.24 m to the tape. */
  netRun(group, r.tennisNets, heightAt, { height: 1.02, postR: 0.055 });
  netRun(group, r.volleyNets, heightAt, { height: 2.24, postR: 0.07 });

  /* --- hoop assemblies: pole set back behind the line, arm reaching in,
     pale backboard, orange ring. `rot` faces the court centre, so -sin/-cos
     of it is the outward direction the pole leans away along, and `d` below is
     metres OUTWARD from the ring axis.

     The assembly is spaced like a real one and must not interpenetrate. The
     board's front face sits 0.375 m out — the regulation rim overhang (0.15 m
     of daylight between board and ring) plus the 0.225 m ring radius — so the
     ring's rear arc, which reaches 0.247 m out, clears it. The 1.5 m arm runs
     from the pole axis at 1.9 m only as far as 0.40 m, dying 0.035 m inside
     the 0.06 m slab: enough to read as joined, not far enough to come out the
     front. Every piece takes its y from the RING's ground sample, not its own,
     or the assembly shears apart on a grade. */
  const out = (h, d) => ({ x: h.x - Math.sin(h.rot) * d, z: h.z - Math.cos(h.rot) * d });
  group.add(instanced(new THREE.CylinderGeometry(0.085, 0.11, 3.95, 6), lambert(REC_COLORS.steel), r.hoops,
    (h) => { const p = out(h, 1.9); return { x: p.x, y: heightAt(h.x, h.z) + 1.97, z: p.z, rot: h.rot }; }));
  group.add(instanced(new THREE.BoxGeometry(0.12, 0.12, 1.5), lambert(REC_COLORS.steel), r.hoops,
    (h) => { const p = out(h, 1.15); return { x: p.x, y: heightAt(h.x, h.z) + 3.5, z: p.z, rot: h.rot }; }));
  group.add(instanced(new THREE.BoxGeometry(1.83, 1.07, 0.06), lambert(REC_COLORS.backboard), r.hoops,
    (h) => { const p = out(h, 0.405); return { x: p.x, y: heightAt(h.x, h.z) + 3.4, z: p.z, rot: h.rot }; }));
  const ring = new THREE.TorusGeometry(0.225, 0.022, 5, 12);
  ring.rotateX(-Math.PI / 2);
  group.add(instanced(ring, lambert(REC_COLORS.ring), r.hoops,
    (h) => ({ x: h.x, y: heightAt(h.x, h.z) + 3.05, z: h.z })));

  /* --- court light poles: the tall black masts with their twin heads. */
  group.add(instanced(new THREE.CylinderGeometry(0.09, 0.14, 9.0, 6), lambert(REC_COLORS.steel), r.courtLights,
    (l) => ({ x: l.x, y: heightAt(l.x, l.z) + 4.5, z: l.z })));
  for (const side of [-0.45, 0.45]) {
    group.add(instanced(new THREE.BoxGeometry(0.62, 0.16, 0.34), lambert("#3a3a38"), r.courtLights,
      (l) => ({ x: l.x + side, y: heightAt(l.x, l.z) + 8.95, z: l.z })));
  }

  /* --- Triton Bar Park and the terrace rail: pull-up frames (two posts and
     a crossbar) and parallel-bar stations. */
  const rigs = [...r.rigs, ...r.terraceRigs];
  const frames = rigs.filter((g) => g.kind === "frame");
  const bars = rigs.filter((g) => g.kind === "bars");
  for (const side of [-0.8, 0.8]) {
    group.add(instanced(new THREE.CylinderGeometry(0.055, 0.055, 2.45, 6), lambert(REC_COLORS.steel), frames,
      (g) => ({ x: g.x + side, y: heightAt(g.x, g.z) + 1.22, z: g.z })));
  }
  group.add(instanced(new THREE.BoxGeometry(1.72, 0.07, 0.07), lambert(REC_COLORS.steel), frames,
    (g) => ({ x: g.x, y: heightAt(g.x, g.z) + 2.42, z: g.z })));
  for (const dx of [-1.15, 1.15]) {
    for (const dz of [-0.3, 0.3]) {
      group.add(instanced(new THREE.CylinderGeometry(0.045, 0.045, 1.32, 6), lambert(REC_COLORS.steel), bars,
        (g) => ({ x: g.x + dx, y: heightAt(g.x, g.z) + 0.66, z: g.z + dz })));
    }
  }
  for (const dz of [-0.3, 0.3]) {
    group.add(instanced(new THREE.BoxGeometry(2.4, 0.06, 0.06), lambert(REC_COLORS.steel), bars,
      (g) => ({ x: g.x, y: heightAt(g.x, g.z) + 1.34, z: g.z + dz })));
  }

  /* --- the two blue canopies: four legs and a shallow pyramid. */
  for (const t of r.tents) {
    const y = heightAt(t.x, t.z);
    for (const dx of [-1, 1]) {
      for (const dz of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 5), lambert(REC_COLORS.steel));
        leg.position.set(t.x + (dx * t.w) / 2, y + 1.2, t.z + (dz * t.d) / 2);
        group.add(leg);
      }
    }
    const top = new THREE.Mesh(new THREE.ConeGeometry(Math.SQRT1_2, 0.55, 4), lambert(REC_COLORS.tent));
    top.rotation.y = Math.PI / 4;
    top.scale.set(t.w, 1, t.d);
    top.position.set(t.x, y + 2.68, t.z);
    group.add(top);
  }

  /* --- picnic tables: a top and its two attached seats. */
  group.add(instanced(new THREE.BoxGeometry(1.7, 0.07, 0.78), lambert(REC_COLORS.table), r.picnicTables,
    (p) => ({ x: p.x, y: heightAt(p.x, p.z) + 0.74, z: p.z })));
  for (const dz of [-0.62, 0.62]) {
    group.add(instanced(new THREE.BoxGeometry(1.7, 0.06, 0.3), lambert(REC_COLORS.table), r.picnicTables,
      (p) => ({ x: p.x, y: heightAt(p.x, p.z) + 0.45, z: p.z + dz })));
  }
  for (const dx of [-0.6, 0.6]) {
    group.add(instanced(new THREE.BoxGeometry(0.08, 0.74, 1.5), lambert(REC_COLORS.steel), r.picnicTables,
      (p) => ({ x: p.x + dx, y: heightAt(p.x, p.z) + 0.37, z: p.z })));
  }

  /* --- the Gymnasium Lot's parked cars. */
  group.add(instanced(new THREE.BoxGeometry(1.8, 1.45, 4.4),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.6 }),
    r.cars, (c) => ({ x: c.x, y: heightAt(c.x, c.z) + 0.73, z: c.z, color: c.colour })));

  scene.add(group);
  return {
    group,
    counts: {
      tennisNets: r.tennisNets.length,
      hoops: r.hoops.length,
      courtLights: r.courtLights.length,
      volleyNets: r.volleyNets.length,
      rigs: rigs.length,
      terraceMats: r.terraceMats.length,
      tents: r.tents.length,
      picnicTables: r.picnicTables.length,
      cars: r.cars.length,
      pads: r.tennisPads.length + r.basketballPads.length + 3,
    },
  };
}
