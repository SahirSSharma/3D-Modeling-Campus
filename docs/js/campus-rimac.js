// RIMAC Field: the softball field, the fences, the seating, the patchy turf.
//
// campus-markings.json carries the soccer pitches here as fitted line sets —
// the flats are TWO COLUMNS BY TWO ROWS (`rimac-nw`, `rimac-ne`, `rimac-sw`,
// `rimac-se`), of which the three the georeferenced imagery can answer for
// are painted and the north-east is not; that script states why at its own
// declaration. Everything else at this end of campus was missing: the
// complex's whole southern corner is a regulation softball field, its east
// edge is fenced against North Torrey Pines Road, its west edge carries a
// three-tier bleacher, and the turf is nowhere near one flat green.
//
// TWO SOURCES, EACH FOR THE ONE THING IT IS GOOD AT — the same division of
// labour the rest of this project runs on:
//
//   · EVERY POSITION AND DIMENSION comes from the georeferenced chunks under
//     docs/data/textures/ (chunk_4_1 / chunk_5_1, zoom 20, 0.125 m/px, which
//     cover all of this). The build that writes them registers them to the
//     site's metre frame, so a number read off them is a measurement; each one
//     below states its own fit residual.
//   · EVERY COLOUR comes from four Apple Maps captures, which are current
//     where the shipped chunks are not. They are UNREGISTERED screenshots —
//     scripts/register-reference.mjs refuses them at 0.34 coarse / 0.18 fine
//     against its 0.45 gate — so nothing here takes a position from them. A
//     colour needs no georeferencing, only correct identification of the
//     surface, so each was taken by selecting the pixels carrying a surface's
//     own signature (not a hand-placed rectangle) and taking the per-channel
//     median in linear light with shadow and glare rejected, exactly as
//     build-campus-truecolor.mjs does.
//
// WHAT IS NOT HERE, AND WHY. Nadir imagery measures plan, not elevation, and
// the 2014 LiDAR ships only ground, tree and per-building heights — no raw
// returns — so it cannot answer for a fence or a bleacher either. Every
// VERTICAL dimension below is a stated convention, flagged at its constant,
// never a measurement dressed up as one. And no backstop is modelled: at
// 0.125 m/px neither the chunks nor the closest capture resolves one behind
// home plate, and the imagery leaves only 2.6 m between the plate and the
// enclosure there. Better absent than wrong.
//
// NO PEOPLE. The captures show players on these fields. They are not
// features of the campus and nothing here models them.
import * as THREE from "../vendor/three/three.module.min.js";
import { OVERLAY, overlayLift, applyOverlayDepth, sceneTone } from "./campus-overlay.js";
import { fillPoly, ribbon, bandBetween, solids } from "./campus-drape.js";

/* Medians from the Apple captures. The px count is the size of the pool each
   median was taken over — a colour identified by its own signature across a
   whole capture, not a rectangle someone pointed at.

   WHITE BALANCE, checked not assumed: the captures' painted foul lines come
   back #ebdbd7, warm by 20 levels across r-b, which on its own would argue
   for a correction. But the road asphalt in the same capture — a genuinely
   neutral reference — comes back #a09d99, warm by only 7 of 160 (4%). The
   frame is very nearly neutral; the paint's warmth is the paint, weathered on
   a dirt-adjacent field. No correction is applied. */
export const RIMAC_COLORS = {
  turf: "#516d3f",       // softball outfield, 1,033,382 px
  dirt: "#e3b68f",       // the skinned infield, 384,266 px
  track: "#c7745f",      // the warning track's terracotta, 138,134 px
  paint: "#ebdbd7",      // the painted foul lines, 29,051 px
  windscreen: "#272822", // the outfield fence's dark fabric, 7,293 px
  /* Chain link has no colour of its own in plan — it reads as whatever is
     behind it. campus-muir-field.js settled this class already: in elevation
     a chain-link boundary reads as dark structure, so posts and rails take a
     muted dark grey rather than the line's mixed sample. Same value, on
     purpose, so the two fences on this campus agree. */
  fence: "#5a625d",
  bleacherSeat: "#acacae", // from the overview capture, the only one that has them
  bleacherDeck: "#dfdcdf",
  /* The pitches' turf, as three terciles of 770 cells sampled across both
     pitches in the closest capture. The spread is the point: p2 of that
     distribution is #2d5433 and p98 is #999577. */
  turfWet: "#546d46",
  turfMid: "#717c5a",
  turfDry: "#8a8a6a",
};

/* ------------------------------------------------------- the softball field
   Unlike Muir Field, this facility has no fitted entry in campus-markings.json
   to hang off, so its frame is the one measured here.

   THE DIAMOND IS ROTATED; THE ENCLOSURE IS NOT. Both painted foul lines were
   least-squares fitted to the chunk pixels and come back at 2.75 deg and 92.44
   deg north of east (rms 0.050 m over 225 samples and 0.054 m over 241) —
   89.69 deg apart, i.e. the right angle the rules require, to within a third
   of a degree. Their bisector is 47.61 deg, so the diamond is stated below as
   a true 90 deg corner on that bisector: the first-base line at 2.61 deg, the
   third-base line at 92.61 deg, 0.14 and 0.17 deg from their own fits.

   The FENCE legs, fitted the same way, come back at 0.42 deg (north) and 1.09
   deg (west) off the campus grid — under their own fits' confidence — so the
   enclosure is modelled axis-aligned, which is what the pixels say. A diamond
   rotated a couple of degrees inside a grid-aligned enclosure is exactly what
   the survey's own ground polygons here do too. */
export const SOFTBALL = {
  home: [89.47, -875.62],   // the two foul lines' intersection
  heading_deg: 2.61,        // the first-base line, north of east
  /* The pitching circle, found twice and independently: it is the centre of
     the circle fitted to the skinned infield's outfield-side arc (rms 0.328 m,
     max 2.73, n=601) at [98.04, -885.17], and it is the centroid of the dark
     object parked on the plate in the chunks at [98.09, -885.30] — 0.14 m
     apart. It sits 12.83 m (42.1 ft) from home and 0.48 deg off the diamond's
     axis; NCAA softball pitches from 43 ft (13.11 m), and 0.27 m is inside
     this imagery's ~0.25 m of resolved edge detail. */
  circle: [98.04, -885.17],
  /* The skinned infield's arc: 18.374 m = 60.3 ft about that circle, which is
     the 60 ft grass-line radius the rulebook draws from the pitching plate.
     The two numbers were measured independently and agree; that agreement is
     the reason this field can be stated as a regulation layout at all. */
  skinArc_m: 18.374,
  /* The infield skin's straight north-west edge, where it stops short of the
     arc (a real step in the paint, not a fit artefact): z, sd 0.248, n=65. */
  skinNorthWest_z: -900.85,
  /* The enclosure, inner loop = the grass line, outer loop = the fence.
     Every straight is a least-squares fit to the terracotta band's own edge;
     sd is over the samples named. */
  grass: { west: 81.724, north: -933.554, south: -873.033, east: 146.911 },
  fence: { west: 78.676, north: -936.848, south: -869.789, east: 149.242 },
  /* Band widths, west/north/south/east: 3.05, 3.29, 3.24, 2.33 m. The east
     band really is the narrow one — sd 0.10 and 0.07 on its two edges. */

  /* The outfield arc. The free circle fit lands at [100.01, -889.58] r 46.41
     (rms 0.192, max 0.75, n=400) but stops 0.49 m short of the fitted east
     straight, which would leave a step in the outline. Re-fitting with the
     tangency to that straight imposed costs almost nothing — rms 0.270, max
     0.71 — and closes the loop exactly, so that is the one used. */
  arc: { c: [96.931, -887.600], grass_r: 49.980, band_m: 3.16 },

  /* What that geometry then implies, home to the grass line: 190 ft down both
     foul lines and 209 ft to dead centre, so the fence stands at about 200 and
     220 ft. A textbook NCAA softball outfield, and nothing was fitted to it. */

  /* NOT MEASURED — nadir imagery cannot see a height. 1.22 m is the standard
     4 ft outfield fence; the posts are placed at the 6.63 m pitch at which the
     fence's dark dashes actually resolve along the north straight (probably
     every other line post, so this models the ones the imagery can see). */
  fenceHeight_m: 1.22,
  postPitch_m: 6.63,
};

/* --------------------------------------------- the east perimeter fence
   The dark line between the complex and North Torrey Pines Road, tracked as
   the darkest column in a moving window row by row, then fitted with two-sigma
   rejection: rms 0.246 m over 428 rows. It resolves continuously across the
   whole span scanned, which is the length used. Height is the usual 2.4 m
   campus boundary run — NOT measured. */
export const EAST_FENCE = {
  x_at_z: (z) => 281.639 + 0.06103 * z, // 3.49 deg off the campus grid
  z0: -1200, z1: -851,
  height_m: 2.4,
  postPitch_m: 3.0,
};

/* ------------------------------------------------------- the west bleacher
   Three seat blocks in one run along the walk on the complex's west edge,
   found by their own colour (dark, cool, unsaturated) and kept only where that
   colour is DENSE, so a tree shadow cannot pass for a seat block. The deck's
   cross-field extent is the luminance profile across it, which drops from ~200
   on the concrete either side to ~120 between x 48.4 and 57.9.

   The seat rows themselves do not resolve — at 0.25 m of real edge detail a
   0.76 m row pitch has no periodicity to find — so the row count is the deck
   depth over a standard 0.76 m row and the rise is the standard 0.40 m. Both
   DERIVED, not measured. */
export const BLEACHER = {
  x0: 48.4, x1: 57.9,          // 9.5 m deep, rising away from the field
  blocks: [                     // z ranges, two cross-aisles between them
    [-1097.5, -1089.5],
    [-1086.5, -1074.5],
    [-1071.5, -1065.5],
  ],
  row_m: 0.76, rise_m: 0.40,
};

/* ------------------------------------------------------- the patchy turf
   The flats are not one green. Sampled on ONE quad spanning all four pitches
   in the georeferenced chunks — 39 cells across, 3.54 m a cell, each cell the
   median of 16 sub-samples — and split at the whole quad's own terciles
   (luminance 119.8 and 134.5):

     '.' irrigated   '-' middle   '#' dry

   The quad is measured, not chosen: its edges are the outermost painted lines
   of the four pitches themselves — the north-west pitch's north goal line
   (z -1148.0) and west touchline (x 74.9), the south-east pitch's east
   touchline (x 207.8) and the south-west pitch's south goal line (z -967.6) —
   taken out to the pitches' rotated corners. It stops 29 m short of the
   softball field's fence.

   IT NO LONGER HANGS OFF campus-markings.json. Keying each map to a fitted
   pitch's bounds tied the ground's appearance to whether that pitch's PAINT
   happened to clear a coverage gate, so the unpainted north-east quadrant
   would have rendered as flat green beside three patchy ones. Turf patchiness
   is a property of the ground; the paint is a separate question.

   THE MAP IS FROM THE CHUNKS AND THE COLOURS ARE FROM THE CAPTURES, and that
   is deliberate: where the dry ground is has to come from the one source that
   is registered, what dry ground looks like today from the one that is
   current. Row 0 is the quad's north edge and column 0 its west edge. */
export const TURF_QUAD = { x0: 72.0, x1: 210.2, z0: -1150.0, z1: -966.3 };
export const TURF_MAP = [
  "---##################------#-------....", "---###############-##-----##-------....", "############----#--##-----####-##--....", "##############----##-----########--...-",
  "#--###-#####-##-----------########-....", "#--#########--------#----#########--..-", "---##-######-.-------##############--.-", "----#-#######------#-##-##########-----",
  "----##-####---#------#-###########-----", "--------###----#--.----############----", "-------#########----#--############----", "--.------####----#-###-##########-----.",
  "-------######-####-###############----.", "#---#---##########################--.-.", "#---##############################--.-.", "-#--############-################-#-.-.",
  "----#-############################----.", "-----#############--#---##########----.", "-----########---#------##########---...", "-.----######-----#-#-----########---...",
  "-...--##########-##-----##########-....", "..-.--#####------.-.----##########...-.", "---.-#---##--.--.-----.-########---....", "--..-##--##------#-#-#-.-#######-......",
  "--.-#-------.----####----#######-.---..", "--------#---#--#######----#########-#-.", "----###---#-----##-###-###########----.", "----##-.--###-..-#-###---#########---..",
  "#--.---..-##---..--###--.-#####-#----..", "----....-----.....####-..-#-##---##----", "#---...--######-.--###-----####-##---#-", "---....---##---..--##-.----#####------#",
  "----.-.----#--..---#--.-------##-------", "-..-..-------....------....-..-#####--#", ".......--------.-------....----########", "...-------...---.----.-....#-#---######",
  ".......-......--....-.....-####---###--", ".............-............-----##--##-.", "......................-...----#######--", ".............-......-.....###--###--...",
  "...........--..............#-..-.......", "....................-......------......", "..................-.-........---.......", ".............................----......",
  "..........-.................--##-......", "..........-..................----....-.", ".........--.-.....-...........--.....-.", "..........-.....-.-....................",
  "...............-.......................", "..............................-........", "#...............................--....-", "#.................................-...-",
];

const PATCH_COLS = 39;
const PAINT_WIDTH = 0.12; // the paint gauge campus-markings.js uses
const D2R = Math.PI / 180;

/** The diamond's frame: metres along the first-base and third-base lines. */
function diamondFrame({ home, heading_deg } = SOFTBALL) {
  const t = heading_deg * D2R;
  const a = [Math.cos(t), -Math.sin(t)];        // toward first base
  const b = [-Math.sin(t), -Math.cos(t)];       // toward third base, a+90 deg
  return (p, q) => [home[0] + a[0] * p + b[0] * q, home[1] + a[1] * p + b[1] * q];
}

/* The outfield arc is always sampled into the same number of points, whichever
   loop it belongs to. That is what lets the warning-track band be built by
   pairing the two loops index for index: same structure, same length, corners
   matched. The band then correctly PINCHES toward the south-east, because the
   measured east gap (2.33 m) really is narrower than the rest. */
const ARC_STEPS = 48;

/** Sample an arc of a circle into ARC_STEPS + 1 points. */
function arcPoints(cx, cz, r, a0, a1) {
  const out = [];
  for (let i = 0; i <= ARC_STEPS; i++) {
    const a = a0 + ((a1 - a0) * i) / ARC_STEPS;
    out.push([cx + Math.cos(a) * r, cz - Math.sin(a) * r]);
  }
  return out;
}

/**
 * The enclosure loop at a given offset: `side` picks the grass line or the
 * fence line, and the arc takes the matching radius. Walks anticlockwise in
 * plan from the corner nearest home.
 */
function enclosure(side) {
  const s = SOFTBALL[side];
  const [cx, cz] = SOFTBALL.arc.c;
  const r = SOFTBALL.arc.grass_r + (side === "fence" ? SOFTBALL.arc.band_m : 0);
  /* Where the arc leaves the north straight, and where it meets the east one.
     The grass arc is tangent to its east straight by construction; the fence
     arc, offset by the band's own measured width, crosses its own east
     straight a little short of the apex — so both are solved, not assumed. */
  const dxN = Math.sqrt(Math.max(0, r * r - (s.north - cz) ** 2));
  const dzE = Math.sqrt(Math.max(0, r * r - (s.east - cx) ** 2));
  const aN = Math.atan2(-(s.north - cz), cx + dxN - cx);
  const aE = Math.atan2(-(cz - dzE - cz), s.east - cx);
  return [
    [s.west, s.south], [s.west, s.north], [cx + dxN, s.north],
    ...arcPoints(cx, cz, r, aN, aE),
    [s.east, cz - dzE], [s.east, s.south],
  ];
}

/** The skinned infield, traced from its measured pieces. */
function skinOutline() {
  const g = SOFTBALL.grass;
  const [cx, cz] = SOFTBALL.circle;
  const R = SOFTBALL.skinArc_m;
  const zNW = SOFTBALL.skinNorthWest_z;
  const xNW = cx - Math.sqrt(Math.max(0, R * R - (zNW - cz) ** 2));
  const xS = cx + Math.sqrt(Math.max(0, R * R - (g.south - cz) ** 2));
  return [
    [g.west, g.south], [g.west, zNW], [xNW, zNW],
    ...arcPoints(cx, cz, R, Math.atan2(-(zNW - cz), xNW - cx),
      Math.atan2(-(g.south - cz), xS - cx)),
    [xS, g.south],
  ];
}

/** How far down a foul line the skinned infield reaches — where its arc cuts it. */
function skinReach() {
  const [hx, hz] = SOFTBALL.home;
  const [cx, cz] = SOFTBALL.circle;
  /* The pitching circle in the diamond's own frame: rotate its offset back by
     the heading. It lands within half a metre of the diamond's axis, so both
     foul lines are cut at the same distance and one number serves for both. */
  const t = SOFTBALL.heading_deg * D2R;
  const p = (cx - hx) * Math.cos(t) - (cz - hz) * Math.sin(t);
  const q = -(cx - hx) * Math.sin(t) - (cz - hz) * Math.cos(t);
  return p + Math.sqrt(Math.max(0, SOFTBALL.skinArc_m ** 2 - q * q));
}

/**
 * Everything this module places, as flat elements and standing runs in world
 * metres. Pure: same data in, same geometry out, so the tests walk exactly
 * what the renderer draws.
 */
export function rimacSpec() {
  const elements = [];
  const add = (e) => { elements.push(e); return e; };
  const at = diamondFrame();

  /* --------------------------------------------- the softball field, ground */
  add({ id: "softball-turf", type: "carpet", colour: RIMAC_COLORS.turf,
    poly: enclosure("grass") });
  add({ id: "softball-track", type: "band", colour: RIMAC_COLORS.track,
    outer: enclosure("fence"), inner: enclosure("grass") });
  add({ id: "softball-skin", type: "carpet", colour: RIMAC_COLORS.dirt,
    poly: skinOutline() });

  /* The painted foul lines, from the skin's edge out to the fence. They stop
     at the skin because that is where the imagery stops seeing them: on dirt
     they are chalk, and chalk on tan at 0.125 m/px is nothing. The far ends
     are the enclosure's own measured straights. */
  const near = skinReach();
  const firstFar = SOFTBALL.grass.east - SOFTBALL.home[0];
  const thirdFar = SOFTBALL.home[1] - SOFTBALL.grass.north;
  add({ id: "softball-foul-first", type: "line", colour: RIMAC_COLORS.paint,
    width_m: PAINT_WIDTH, pts: [at(near, 0), at(firstFar, 0)] });
  add({ id: "softball-foul-third", type: "line", colour: RIMAC_COLORS.paint,
    width_m: PAINT_WIDTH, pts: [at(0, near), at(0, thirdFar)] });

  /* ------------------------------------------- the softball field, standing */
  const loop = enclosure("fence");
  add({ id: "softball-fence", type: "fence", colour: RIMAC_COLORS.fence,
    panel: RIMAC_COLORS.windscreen, pts: loop,
    height_m: SOFTBALL.fenceHeight_m, postPitch_m: SOFTBALL.postPitch_m });

  /* ------------------------------------------------ the east perimeter fence */
  const east = [];
  for (let z = EAST_FENCE.z0; z <= EAST_FENCE.z1; z += 8)
    east.push([EAST_FENCE.x_at_z(z), z]);
  east.push([EAST_FENCE.x_at_z(EAST_FENCE.z1), EAST_FENCE.z1]);
  add({ id: "east-perimeter-fence", type: "fence", colour: RIMAC_COLORS.fence,
    panel: null, pts: east, height_m: EAST_FENCE.height_m,
    postPitch_m: EAST_FENCE.postPitch_m });

  /* ------------------------------------------------------- the west bleacher */
  const rows = Math.round((BLEACHER.x1 - BLEACHER.x0) / BLEACHER.row_m);
  BLEACHER.blocks.forEach(([z0, z1], i) => {
    add({ id: `bleacher-deck-${i}`, type: "carpet", colour: RIMAC_COLORS.bleacherDeck,
      poly: [[BLEACHER.x0, z0], [BLEACHER.x1, z0], [BLEACHER.x1, z1], [BLEACHER.x0, z1]] });
    for (let r = 0; r < rows; r++) {
      /* Row 0 sits at the field edge; the deck climbs away from the field. */
      const x = BLEACHER.x0 + (r + 0.5) * BLEACHER.row_m;
      add({
        id: `bleacher-row-${i}-${r}`, type: "riser", colour: RIMAC_COLORS.bleacherSeat,
        x, z0, z1, depth_m: BLEACHER.row_m, height_m: (r + 1) * BLEACHER.rise_m,
      });
    }
  });

  /* ------------------------------------------------------------ the turf map */
  const q = TURF_QUAD;
  const patchRows = TURF_MAP.length;
  const uv = (u, v) => [q.x0 + (q.x1 - q.x0) * u, q.z0 + (q.z1 - q.z0) * v];
  TURF_MAP.forEach((row, r) => {
    for (let c = 0; c < PATCH_COLS; c++) {
      const colour = { ".": RIMAC_COLORS.turfWet, "-": RIMAC_COLORS.turfMid,
        "#": RIMAC_COLORS.turfDry }[row[c]];
      if (!colour) continue;
      add({
        id: `turf-${r}-${c}`, type: "patch", colour,
        poly: [uv(c / PATCH_COLS, r / patchRows), uv((c + 1) / PATCH_COLS, r / patchRows),
          uv((c + 1) / PATCH_COLS, (r + 1) / patchRows), uv(c / PATCH_COLS, (r + 1) / patchRows)],
      });
    }
  });

  return { elements };
}

/* ------------------------------------------------------------- rendering */

const PAD_LIFT = overlayLift("pad");
const DRAPE_LIFT = overlayLift("carpet");
const PAINT_LIFT = overlayLift("paint");
/**
 * Posts and a panel wall along a polyline, posts at a measured pitch measured
 * along the WHOLE run rather than restarted at every vertex — otherwise the
 * arc, which arrives here as fifty short segments, would grow a post at each
 * of them and the straights would not.
 */
function fenceRun(el, stand, heightAt) {
  let walked = 0;   // distance covered by the segments already consumed
  let nextPost = 0; // distance along the run at which the next post stands
  for (let i = 1; i < el.pts.length; i++) {
    const [ax, az] = el.pts[i - 1], [bx, bz] = el.pts[i];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 1e-4) continue;
    const rot = Math.atan2(-(bz - az), bx - ax);
    while (nextPost < walked + len) {
      const d = nextPost - walked;
      const x = ax + ((bx - ax) * d) / len, z = az + ((bz - az) * d) / len;
      stand.box(0.09, el.height_m, 0.09, el.colour,
        x, heightAt(x, z) + el.height_m / 2, z, rot);
      nextPost += el.postPitch_m;
    }
    walked += len;
    /* A run of wall between the posts: the dark windscreen where the captures
       show one, otherwise a thin top rail, so a bare chain-link run still
       reads as a line and not a row of unconnected sticks. */
    const cx = (ax + bx) / 2, cz = (az + bz) / 2;
    if (el.panel) {
      stand.box(len, el.height_m * 0.86, 0.05, el.panel,
        cx, heightAt(cx, cz) + el.height_m * 0.43, cz, rot);
    } else {
      stand.box(len, 0.05, 0.05, el.colour,
        cx, heightAt(cx, cz) + el.height_m, cz, rot);
    }
  }
}

/**
 * Build the RIMAC Field group. Everything it places is measured in this
 * module, so it needs no data file — only a ground sampler. Without one it
 * resolves to an empty group, quietly, as everywhere here.
 */
export function createRimac(scene, { heightAt } = {}) {
  const group = new THREE.Group();
  if (scene) scene.add(group);
  if (typeof heightAt !== "function") return group;

  const spec = rimacSpec();
  const flats = new Map(); // `${rung}|${colour}` -> positions[]
  const bucket = (rung, colour) => {
    const key = `${rung}|${colour}`;
    if (!flats.has(key)) flats.set(key, []);
    return flats.get(key);
  };
  const stand = solids();

  for (const el of spec.elements) {
    switch (el.type) {
      case "patch":
        fillPoly(bucket("pad", el.colour), el.poly, heightAt, PAD_LIFT);
        break;
      case "carpet":
        fillPoly(bucket("carpet", el.colour), el.poly, heightAt, DRAPE_LIFT);
        break;
      case "band":
        bandBetween(bucket("carpet", el.colour), el.outer, el.inner, heightAt, DRAPE_LIFT);
        break;
      case "line":
        ribbon(bucket("paint", el.colour), el.pts, el.width_m / 2, heightAt, PAINT_LIFT);
        break;
      case "fence":
        fenceRun(el, stand, heightAt);
        break;
      case "riser": {
        const len = Math.abs(el.z1 - el.z0), cz = (el.z0 + el.z1) / 2;
        stand.box(el.depth_m, el.height_m, len, el.colour,
          el.x, heightAt(el.x, cz) + el.height_m / 2, cz, 0);
        break;
      }
      default:
        break;
    }
  }
  stand.build(group);

  /* Tone routing (campus-overlay.js). The turf patches and the softball
     carpet sit on ground that campus-world.js lifts about a stop and a half,
     so an unlit fill of the raw measured colour sinks beside it — the exact
     failure campus-muir-field.js records for its own turf carpet. They take
     the same 0.15 that fixed it there. The dirt, the terracotta track and the
     paint whites are all already brighter than the lawn around them and were
     never sinking, so they are drawn raw at strength 0, which is the
     deliberate choice sceneTone's own doc describes. */
  const TONE = { pad: 0.15, carpet: 0.15, paint: 0 };
  const LIFTED = new Set([RIMAC_COLORS.turf, RIMAC_COLORS.turfWet,
    RIMAC_COLORS.turfMid, RIMAC_COLORS.turfDry]);
  for (const [key, positions] of flats) {
    if (!positions.length) continue;
    const [rung, colour] = key.split("|");
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    /* UNLIT, for the reason campus-markings.js records: a lit DoubleSide fill
       whose triangulation winds back-facing gets lit by the hemisphere's
       GROUND term and renders near-black. */
    const mat = applyOverlayDepth(
      new THREE.MeshBasicMaterial({
        color: sceneTone(colour, LIFTED.has(colour) ? TONE[rung] ?? 0 : 0),
        side: THREE.DoubleSide,
      }),
      rung
    );
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = OVERLAY[rung].renderOrder;
    group.add(mesh);
  }

  return group;
}
