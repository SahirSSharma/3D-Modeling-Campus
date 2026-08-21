// Galbraith Hall, Revelle College, from photographs — the INVENTED class.
//
// Deems Lewis Martin, 1965; Kevin deFreitas Architects renovation, 2013. A
// 62 m square coffered concrete roof plate — the thing the survey ring
// traces — with the glazed enclosure standing well inside it and five pairs
// of leaning, flare-headed, splay-footed struts per face carrying its edge.
// This file draws the roof, the struts, the two glazed levels between them
// and the ground immediately around three of the four sides. It never
// touches the measured mass.
//
// Five things decided the shape of this file:
//
//   0. THE MEASURED RING IS THE ROOF EDGE, NOT THE WALL LINE. The repo's own
//      orthophoto measures this roof plate at 62.45 x 61.9 m against the
//      ring's 62.4 x 62.7 — the same size, offset by the top displacement a
//      nadir mosaic gives anything 16.6 m tall. So there is no collar outside
//      the ring, and the previous revision's 12.474 m one built an 87 m
//      building and then laid its own sourced east and west ground furniture
//      underneath it. What remains outboard is a REGISTRATION band and is
//      declared as one: campus-massing.js extrudes the same ring solid to
//      16.6 m, so nothing this file draws can stand where the real facade
//      stands, and `draw.registration` is the least it may stand outside it
//      and still be seen. The residual 12% plan oversize is in `absent`, and
//      the compressed colonnade depth is in `conflicts`. Both are errors that
//      are named rather than hidden.
//
//   1. The grid is not eyeballed, it is DERIVED — but from RATIOS, because
//      the architect's Second Floor Plan (KdA, 02.17.12) is on disk now and
//      its SCALE does not reproduce: THREE mutually inconsistent px-per-metre
//      scales can be read off the same raster and the outer two are 26%
//      apart (conflicts.gridScaleThree). What the sheet does give, needing no
//      scale at all, is gap-to-spacing — and re-measured at native resolution
//      in the R2 arbitration it gives 53.5/241.1 = 0.2219 in the rows and
//      53.7/241.0 = 0.2228 in the letters. ONE SQUARE GRID, BOTH WAYS, to
//      0.4%. The retired 0.3105 came from a 172.6 px interval that exists
//      nowhere on that sheet, and the waffle-slab story this comment used to
//      tell — "two genuinely different numbers because the beams are spaced
//      differently each way" — was invented afterwards to explain a gap only
//      a bad reading had opened. It is deleted, not softened.
//      Add the photograph's inset-to-spacing and the grid CLOSES on each
//      measured face: two insets, four steps and one gap span it exactly, and
//      the spacing falls out of that identity rather than being typed.
//
//   2. The heights had to be re-reconciled, and the ground survey won — but
//      only where it actually speaks. The 2014 drawn surface is flat at
//      23.5-23.9 m under the whole footprint and across the north apron
//      (sampled on a 2 m grid against makeSurfaceSampler), so there is no
//      storey-high step between the north plaza and the ground at the
//      building's own south edge, and LiDAR 16.6 is simply the roof above
//      grade at the ring: the eaves ride 0.35 m below the measured top, the
//      soffit 1.25 m, and the 16.6 divides into two 7.675 m glazed levels
//      plus the roof zone (section.levels). That flat pad is LOCAL, though:
//      the same sampler puts a ~26.8 m ridge eight metres west of the ring,
//      27.1 m within 25 m to the south and ~26.8 m under the east tree band —
//      which is why every ground field here is DRAPED over the drawn terrain
//      and every solid seated per-item on it (see 4), never hung on a 23.6
//      level line. The 3.8 m between ArcGIS 12.8 and LiDAR 16.6 belongs to
//      the roofscape the orthophoto later confirmed, and is expressed as
//      curb-scale relief on the measured box top (roof.datumNote), never
//      stacked on top of it.
//
//   3. The struts are the building. A straight box reads as a car park; the
//      real thing is thin at the waist, sweeps out below into a wide flat foot
//      and flares above into a broad bracket that meets the beam hard, and
//      each pair splays APART going up. That profile is a lathe, the lean is a
//      rotation about the face normal, and both come from the data.
//
//   4. What stands on the ground stands on `surfaceAt`, not on a level line.
//      The struts' feet, the lower colonnade and the fluted wall are each
//      seated per-item on the drawn terrain and run up to a floating datum, so
//      nothing floats and nothing sinks when the grade moves under it.
//
//   5. NO DIMENSION LIVES IN THIS FILE. Every metre this module draws with
//      comes out of the section: `derivations.figures` (with the arithmetic
//      that produces it), `estimates` (labelled, naming the sourced pattern
//      it extends), `reads` (a citation and its tolerance) or `draw` (render
//      offsets, which are declared as offsets and are not claims about the
//      building). The test fails on a bare number here.
//
// Colours are DATA — every hex comes from the `colors` block of the photo
// document's `galbraith` section, and every role carries its own provenance
// and tier in `colorSources`. Repeats are InstancedMesh: the coffers alone
// are ~5,000 pans and rib bosses in a handful of draws.
//
// What is NOT here is in the section's `absent` array. Two long-standing
// refusals CLOSED on 2026-08-17, when the repo's own Google orthophoto
// (docs/data/textures, a legitimate build-time measurement source) finally
// saw this roof and the east ground from directly above: the "barrel-vault
// monitors" turn out to be a 9x9 grid of white-capped skylights on a raised
// central block (buildRoof), and the east strip gets its shaded recess,
// unit-paver walk, DG tree band and SE lawn (buildEastGround). What replaced
// them in `absent` is every HEIGHT up on that roof — the roofscape is drawn
// as curb-scale relief on the measured box top rather than as guessed
// storeys — and the ground east of x ~90, which the current epoch shows as
// the Central Utilities Plant Expansion site, a NEIGHBOUR'S project and not
// work on this building.
//
// Two claims that stood here until 2026-08-20 are gone. The roof shadow is
// not absent: the dark band round the raised block runs along its north and
// west edges ONLY, which is a shadow cast by a south-east sun and not the
// symmetric reveal the section called it — so `buildRoof` draws it on two
// edges, and what is absent is the calculation that would turn its width
// into the block's height. And the roof monitors were never absent at all:
// they are 1965 fabric, retained through the 2013 interior renovation, and
// the mid-1960s archive aerial shows the same field on the same block.
import * as THREE from "../vendor/three/three.module.min.js";
import { applyOverlayDepth, OVERLAY, overlayLift } from "./campus-overlay.js";
import { ribbon } from "./campus-drape.js";
import { sharedMaterialLibrary } from "./campus-materials.js";
import { SPECIES, treeSpecies, treeTint, crownFor } from "./campus-species.js";

/* Ground decals ride the overlay ladder so they paint over the measured
   terrain in a fixed order instead of z-fighting it. */
const PAD = "pad";
const CARPET = "carpet";
const PAINT = "paint";

/* How many seeded draws a bed-planting point gets inside its ring's bounding
   box before it is given up. A LOOP BOUND, not a dimension: the three north
   rings fill better than 97% of their own boxes, so the first draw lands
   inside for all but a handful and no point has ever needed a second. */
const RING_SAMPLE_TRIES = 32;

/* Surfaces big enough to carry microstructure come from the procedural
   material library (campus-materials.js): smooth or board-formed concrete,
   unit pavers, decomposed granite, lava rock, glass with the environment
   reflection. The library's maps are seeded grey VARIATION that multiplies
   the sourced hexes below, so no class can move a colour off its sample.
   `makeMats` builds the per-call helpers; small painted metalwork keeps the
   plain materials — a 28 mm picket has no room for grain. */
function makeMats() {
  const lib = sharedMaterialLibrary(THREE);
  return {
    lib,
    /* Poured-and-floated concrete; `repeat` is the per-surface lever, tuned
       so one tile reads ~2.5 m of real wall or paving. */
    conc: (color, repeat = [4, 4]) => lib.get("smoothConcrete", { color, repeat }),
    /* The colonnade soffit is the one surface in every reference frame that
       is BRIGHTER than the sky-lit walls around it, because eleven metres of
       pale concrete bounces the plaza back up into it. Direct light never
       reaches it, so that bounce has to be carried by the material or the
       whole underside of the building goes grey. The soffit itself is
       SMOOTH-cast (the pans were formed on steel), hence smoothConcrete. */
    soff: (color, repeat = [24, 4]) =>
      lib.get("smoothConcrete", { color, repeat, emissive: color, emissiveIntensity: 0.3 }),
    /* Dark bronze curtain wall standing under the 3.67 m oversail band (0.949
       registration + 2.721 roofOut) is in permanent shade; the eleven metres
       this comment used to claim was the retired 12.474 m collar, which
       grid.oversail was deleted for. the library's glass carries the PMREM environment
       reflection, and a little self-light keeps it a surface, not a hole.
       `opts` is the per-surface lever: the library's default 0.35 opacity is
       right for a skylight pane but on the facade it let the measured massing
       box's punched-window texture read straight through the declared dark
       bronze — the curtain wall passes a near-opaque override instead. */
    glass: (color, opts = {}) =>
      lib.get("glass", { color, emissive: color, emissiveIntensity: 0.15, ...opts }),
    /* The 1965 fluted aggregate wall is board-formed; ~0.45 m per board at
       this repeat against the ~7.4 m panel height. */
    board: (color, repeat = [8, 2]) => lib.get("boardFormedConcrete", { color, repeat }),
    lava: (color) => lib.get("lavaRock", { color, repeat: [2, 2] }),
    /* The curtain wall's solid end panels: flat bronze sheet, so no standing
       seam and a duller specular than the library's mill-finish default. */
    panel: (color, repeat = [2, 6]) =>
      lib.get("metalPanel", { color, repeat, roughness: 0.55, metalness: 0.4 }),
    /* Tree bark. The library carries two classes and the species table five
       forms; pine takes the plated one, everything else the eucalyptus
       ribbons, which is the same mapping campus-photo-plaza uses. */
    bark: (species, color, repeat = [2, 8]) =>
      lib.get(species === "pine" ? "barkPine" : "barkEucalyptus", { color, repeat }),
    /* Leaf mass on a CLOSED lobe: the procedural foliage class without its
       alpha cut. That alpha is a leaf-clump silhouette meant for a flat card
       and on a solid body it only punches holes; the albedo mottle and normal
       relief are exactly what a leaf mass wants, so they stay. */
    leaf: (color) =>
      lib.get("foliage", { color, alphaTest: 0, side: THREE.FrontSide, repeat: [3, 2] }),
    /* Weathered painted standing-seam, not mill-finish: the library default
       (metalness 0.9, roughness 0.5) read as a mirror from the north and a
       specular hole from the east — a 1965 penthouse roof is matte. */
    seam: (color, repeat = [8, 8]) =>
      lib.get("metalPanel", { color, standingSeam: true, repeat, roughness: 0.72, metalness: 0.35 }),
  };
}
const painted = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.3 });
const metal = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.8 });
const rock = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 1.0, metalness: 0.0 });
const foliage = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0.0 });

function decal(color, rung) {
  return applyOverlayDepth(
    new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0.0 }),
    rung
  );
}

/** Deterministic 0..1 from any integer mix — a reload rebuilds the same wall. */
function hash(...ns) {
  let s = 0;
  for (let i = 0; i < ns.length; i++) s = s * 131.71 + ns[i] * 57.13 + 7.9;
  const v = Math.sin(s) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * One InstancedMesh from a list of placements. `place` returns
 * `{ x, y, z, rot?, rotX?, rotZ?, scale? }`. The Euler order is YXZ, so `rot`
 * (about Y, the face's own orientation) is applied LAST and `rotZ` therefore
 * leans the item within the face plane — which is the whole point: the struts
 * lean along the elevation, not out of it.
 */
function instanced(geo, mat, items, place, shadow = true) {
  const mesh = new THREE.InstancedMesh(geo, mat, items.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const tint = new THREE.Color();
  items.forEach((it, i) => {
    const p = place(it, i);
    e.set(p.rotX || 0, p.rot || 0, p.rotZ || 0, "YXZ");
    q.setFromEuler(e);
    s.set(p.scale?.[0] ?? 1, p.scale?.[1] ?? 1, p.scale?.[2] ?? 1);
    pos.set(p.x, p.y, p.z);
    m.compose(pos, q, s);
    mesh.setMatrixAt(i, m);
    /* Per-instance tone is a VALUE multiplier only, so a foliage lobe can be
       a lighter or darker version of its species tint but never another hue.
       The type check is not defensive padding: buildLavaWall has carried a
       STRING `tone` since it was written, as the key it splits its two rock
       materials on, and setScalar of a string writes NaN into the colour
       buffer — which NaNs the bounding sphere, kills the cull and paints a
       black wedge across half the frame from ninety metres away. */
    if (typeof p.tone === "number") mesh.setColorAt(i, tint.setScalar(p.tone));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  /* Sub-decimetre repeats — bird-spike wire, balustrade pickets, coffer
     fillets, paving joints, planting — are opted OUT of the shadow pass.
     Their shadows are smaller than a shadow-map texel at every distance you
     can stand from this building, and there are eight thousand of them: they
     cost real frame time and buy nothing you can see. The struts, decks and
     roof still cast, which is what actually shapes this facade. */
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  return mesh;
}

/** A flat XZ decal quad lying in the ground plane. */
function quad(w, d) {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  return g;
}

/**
 * A ground-field decal DRAPED over the drawn terrain. The ground around this
 * building is only flat under the footprint itself — the west court climbs
 * 3.3 m to a ridge, the south lawn rises 3.4 m and the east DG band rolls
 * through 4 m — and a single flat quad seated at the rect centre reads as a
 * hole where the ground rises through it and as a sheet in mid-air where it
 * falls away. So the quad is subdivided and every vertex is seated on
 * `ground` itself; the mesh origin stays at the rect centre so the overlay
 * lift still rides in `position.y`.
 */
function drapedQuad(r, ground, lift, seg) {
  const w = r.x1 - r.x0;
  const d = r.z1 - r.z0;
  const cx = (r.x0 + r.x1) / 2;
  const cz = (r.z0 + r.z1) / 2;
  /* One drape vertex every `draw.drapeSegment`: the drawn terrain is
     piecewise linear on a 6 m triangle grid, so 2 m sampling reproduces it
     to centimetres. */
  const geo = new THREE.PlaneGeometry(w, d,
    Math.max(1, Math.ceil(w / seg)), Math.max(1, Math.ceil(d / seg)));
  geo.rotateX(-Math.PI / 2);
  const base = ground(cx, cz);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, ground(cx + pos.getX(i), cz + pos.getZ(i)) - base);
  }
  geo.computeVertexNormals();
  const place = (mesh) => {
    mesh.position.set(cx, base + lift, cz);
    mesh.name = "ground-decal";
  };
  return { geo, place };
}

/**
 * The same drape for a SURVEYED QUADRILATERAL rather than an axis-aligned
 * rect. The three north beds are arcgis rings carried verbatim (they are half
 * a degree off square, like the building's own ring), so they cannot be
 * redrawn as rects without ceasing to be the survey's polygons. The quad is
 * subdivided bilinearly — which is exact on its four corners, so the survey
 * vertices are the mesh's vertices — and every vertex seats on the drawn
 * terrain exactly as drapedQuad's do.
 */
function drapedRing(ring, ground, lift, seg) {
  const q = ring.slice(0, 4);
  const nu = Math.max(1, Math.ceil(Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]) / seg));
  const nv = Math.max(1, Math.ceil(Math.hypot(q[3][0] - q[0][0], q[3][1] - q[0][1]) / seg));
  const cx = q.reduce((t, p) => t + p[0], 0) / 4;
  const cz = q.reduce((t, p) => t + p[1], 0) / 4;
  const base = ground(cx, cz);
  const P = (u, v) => {
    const ax = q[0][0] + (q[1][0] - q[0][0]) * u;
    const az = q[0][1] + (q[1][1] - q[0][1]) * u;
    const bx = q[3][0] + (q[2][0] - q[3][0]) * u;
    const bz = q[3][1] + (q[2][1] - q[3][1]) * u;
    const x = ax + (bx - ax) * v;
    const z = az + (bz - az) * v;
    return [x - cx, ground(x, z) - base, z - cz];
  };
  const verts = [];
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const a = P(i / nu, j / nv);
      const b = P((i + 1) / nu, j / nv);
      const c = P((i + 1) / nu, (j + 1) / nv);
      const d = P(i / nu, (j + 1) / nv);
      /* (a, b, c) and (a, c, d) in the SURVEY RING'S OWN vertex order, which
         for all three of these rings gives a +y face normal. A back-facing
         lit DoubleSide fill renders at ~0.42x its measured colour — the
         near-black-splat failure four other modules in this repo record — so
         tests/campus-photo-galbraith.test.mjs asserts normal.y > 0 here. */
      verts.push(...a, ...b, ...c, ...a, ...c, ...d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  const place = (mesh) => {
    mesh.position.set(cx, base + lift, cz);
    mesh.name = "ground-decal";
  };
  return { geo, place };
}

/* ------------------------------------------------------------ face frames */

/**
 * A facade's own coordinate frame, built from the two MEASURED ring vertices
 * the data names. `at(u, w, y)` is u metres along the face from its start, w
 * metres PROUD of it (so the building's interior is negative w), y in world
 * height. `rot` orients a box so its local +Z points out of the face and its
 * local +X runs along it.
 */
function frameOf(f) {
  /* The tangent is the MEASURED edge itself, not the cardinal direction the
     face is named after. Galbraith's ring is half a degree off square, and a
     frame built on (0, +/-1) walks half a metre off its own wall by the far
     corner — enough to stand the glazing outside the roof it hangs under. */
  let [sx, sz] = f.a;
  let [ex, ez] = f.b;
  const length = Math.hypot(ex - sx, ez - sz);
  let tx = (ex - sx) / length;
  let tz = (ez - sz) / length;
  /* Outward normal is the tangent turned a quarter, with `out` deciding which
     of the two quarters is outward. */
  let nx = tz;
  let nz = -tx;
  if (nx * f.out[0] + nz * f.out[1] < 0) {
    nx = -nx; nz = -nz;
    [sx, sz, ex, ez] = [ex, ez, sx, sz];
    tx = -tx; tz = -tz;
  }
  return {
    id: f.id,
    length,
    rot: Math.atan2(nx, nz),
    normal: [nx, nz],
    at: (u, w, y) => ({ x: sx + tx * u + nx * w, y, z: sz + tz * u + nz * w }),
  };
}

/**
 * The five strut pairs on a face: ten `u` positions with their lean sign.
 *
 * The gap INSIDE a pair is per-face, not per-building — but NOT because the
 * two axes differ. The sheet gives ONE SQUARE GRID both ways (53.5/241.1 in
 * the rows, 53.7/241.0 in the letters, agreeing to 0.4%; see the header). The
 * gap is per-face because the four faces have different MEASURED LENGTHS, and
 * the grid closes on each of them separately: two insets, four steps and one
 * gap span a face exactly, so `pairGap` falls out of that identity per face
 * rather than being one typed building-wide number.
 */
function columnLines(section, f, frame) {
  const out = [];
  for (const k of section.grid.pairIndices) {
    const centre = frame.length / 2 + k * f.pairSpacing;
    for (const s of [-1, 1]) {
      out.push({ u: centre + (s * f.pairGap) / 2, lean: s, pair: k });
    }
  }
  return out;
}

/* ------------------------------------------------------------ the struts */

/**
 * The strut profile as a lathe: half-width against height, four radial
 * segments turned 45 degrees so the section is a square standing on its
 * diagonal — which is what puts a flat face toward the plaza and an arris
 * toward the wall, the way ad01-entry-before.jpg and ucsdmap.jpg both show it.
 */
function strutGeometry(profile, height) {
  const pts = profile.map(([t, r]) => new THREE.Vector2(r, t * height));
  const g = new THREE.LatheGeometry(pts, 4);
  g.rotateY(Math.PI / 4);
  return g;
}

function collectStruts(section, f, frame, ctx, bins) {
  const C = section.column;
  /* `standoffBuilt`, not `standoff`. The photographs read 3.4 m of colonnade
     between the glass and the strut line; only `grid.roofOut` of band exists
     to hold it, and one bracket half-width of that is the bracket. So the
     strut centre stands where its head dies INTO the fascia — which is what
     oceanlight-21220, -21225 and -12848 all show — and the depth behind it is
     the sourced one times `draw.compression`. Both numbers ship; the section
     declares the difference in `conflicts.colonnadeDepth`. */
  /* THE LEAN IS OUT OF THE FACADE PLANE, NEVER IN IT. The retired revision
     splayed each pair APART along the elevation (`rotZ` about the face
     normal) — the "saggy noodle" defect. f061 of the 2024 tour, the only
     frontal of the north face in the repo, tracks a member within +-2 px over
     40 px of rise, and dc-bb4438071r_2.jpg holds a pair's two members
     parallel within ~1.5%: face-on these shafts are VERTICAL. What leans is
     the whole rank, out of the plane — foot inboard, head outboard by
     `splayHead` over the rise (~4.4 deg) — which is why wm-from-below, looking
     ALONG the facade, shows a leaning prism while f061, looking AT it, shows
     verticals. So the foot stands `splayHead` inboard of the strut station
     and the head dies at the station itself. */
  const wFoot = section.facade.wallStandoff + C.standoffBuilt - C.splayHead;
  const { soffitY } = ctx;

  for (const line of columnLines(section, f, frame)) {
    /* The foot stands on the DRAWN terrain, not on a level line, so a strut
       never floats over the grade or sinks under it. */
    const p = frame.at(line.u, wFoot, 0);
    const footY = ctx.ground(p.x, p.z);
    const height = soffitY - footY;
    if (!(height > 1)) continue;
    /* `rotX` about the face TANGENT, so the shaft's axis tilts toward the
       face's own outward normal and not along it. Euler order is YXZ, so this
       is applied before the face heading and stays out-of-plane whatever the
       heading is. `rotZ` — the retired in-plane lean — is gone entirely. */
    const tilt = Math.atan2(C.splayHead, height);
    bins.struts.push({
      x: p.x, y: footY, z: p.z, rot: frame.rot, rotX: tilt,
      height,
    });
    /* The head's real mass is a DEEP SECTION-PLANE BRACKET, not an along-face
       flare. Face-on at oceanlight-21220's optical-centre pair — where depth
       projects to nothing — the head reads 22 px, barely wider than the shaft;
       the oblique frames read 2.7x the waist only because the bracket's DEPTH
       projects into apparent width there (conflicts.headPlane). So it is
       narrow along the face and long through the band, spanning glazing plane
       to fascia, and it rides the leaning axis to stay square to its shaft. */
    const cap = C.headCap;
    const along = height - cap.bracketHeight / 2;
    const wHead = wFoot + along * Math.sin(tilt);
    const q = frame.at(line.u, wHead, 0);
    bins.brackets.push({
      x: q.x, y: footY + along * Math.cos(tilt), z: q.z,
      rot: frame.rot, rotX: tilt,
      scale: [cap.alongFace, cap.bracketHeight, cap.halfLength * 2],
    });
  }
}

/* -------------------------------------------------------- the roof edge */

function collectRoofEdge(section, f, frame, ctx, bins) {
  const R = section.roofEdge;
  const D = ctx.draw;
  const { eavesY, soffitY } = ctx;
  const wEdge = section.facade.wallStandoff + section.grid.roofOut;
  const L = f.roofLength;
  const u0 = -f.ext;
  const mid = u0 + L / 2;

  /* 1. the bright metal drip cap, 2. the smooth fascia band with no coffer
     expression, 3. the bird-spike comb on the outer soffit arris. All three
     are in crop-roofedge.jpg (2011) and still in wm-from-below.jpg (2026). */
  bins.dripCap.push({
    ...frame.at(mid, wEdge - R.dripCap.depth / 2 + D.edgeNudge, eavesY - R.dripCap.height / 2),
    rot: frame.rot,
    scale: [L, R.dripCap.height, R.dripCap.depth],
  });
  bins.fascia.push({
    ...frame.at(mid, wEdge - R.fascia.depth / 2, eavesY - R.dripCap.height - R.fascia.height / 2),
    rot: frame.rot,
    scale: [L, R.fascia.height, R.fascia.depth],
  });
  /* The slab itself: what closes the gap between the fascia band and the
     coffered soffit, and what the whole roof plane reads as edge-on. It stops
     at the BACK of the coffer recesses, not at the rib faces — a slab taken
     all the way down to the soffit plane encloses the entire coffer field and
     leaves a blank ceiling z-fighting against 2,000 buried rib bosses. */
  const back = soffitY + section.soffit.recess;
  bins.fascia.push({
    ...frame.at(mid, wEdge / 2, (back + eavesY) / 2),
    rot: frame.rot,
    scale: [L, eavesY - back, wEdge],
  });
  const spikeY = soffitY + R.birdSpike.height / 2;
  bins.birdSpike.push({
    ...frame.at(mid, wEdge - R.birdSpike.depth / 2 - D.edgeNudge, spikeY),
    rot: frame.rot,
    scale: [L, R.birdSpike.height, R.birdSpike.depth],
  });
  /* The fine wire needles that make the comb read as a dentil course rather
     than as a painted stripe. */
  for (let u = R.birdSpike.pitch / 2; u < L; u += R.birdSpike.pitch) {
    bins.needles.push({
      ...frame.at(u0 + u, wEdge - R.birdSpike.depth / 2,
        spikeY + R.birdSpike.height / 2 + R.birdSpike.needle / 2),
      rot: frame.rot,
      scale: [1, R.birdSpike.needle, 1],
    });
  }
}

/* ----------------------------------------------------- the coffered soffit */

function collectSoffit(section, f, frame, ctx, bins) {
  const S = section.soffit;
  const D = ctx.draw;
  const { soffitY } = ctx;
  const L = f.roofLength;
  const u0 = -f.ext;
  const cell = f.cofferPitch;
  const wEdge = section.facade.wallStandoff + section.grid.roofOut;
  /* The coffer field stops one module short of the OUTER edge — that last
     strip is the solid fascia band, and building it any other way puts a
     recess where every photograph shows smooth concrete. */
  const solid = section.roofEdge.solidStripModules * cell;
  const depth = wEdge - solid;
  const rows = Math.max(1, Math.round(depth / cell));
  const panY = soffitY + S.recess / 2;

  /* The recess back: one plate for the whole strip, sitting `recess` above
     the rib faces, so the ribs read as a pale grid standing off a darker
     field rather than as lines drawn on a flat ceiling. */
  bins.cofferPan.push({
    ...frame.at(u0 + L / 2, depth / 2, soffitY + S.recess + D.coplanarNudge),
    rot: frame.rot,
    scale: [L, D.panThickness, depth],
  });

  /* Ribs across the face and ribs running out of it, both on the module. */
  const cols = Math.max(1, Math.round(L / cell));
  for (let i = 0; i <= cols; i++) {
    bins.ribAcross.push({
      ...frame.at(u0 + (i * L) / cols, depth / 2, panY),
      rot: frame.rot,
      scale: [S.ribWidth, S.recess, depth],
    });
  }
  for (let r = 0; r <= rows; r++) {
    bins.ribAlong.push({
      ...frame.at(u0 + L / 2, (r * depth) / rows, panY),
      rot: frame.rot,
      scale: [L, S.recess, S.ribWidth],
    });
  }
  /* A round boss at every rib crossing is what gives each pan its rounded
     corner — the single most recognisable thing about this soffit in
     wm-from-below.jpg, and a plain square lattice loses it entirely. */
  for (let i = 0; i <= cols; i++) {
    for (let r = 0; r <= rows; r++) {
      bins.ribBoss.push({
        ...frame.at(u0 + (i * L) / cols, (r * depth) / rows, panY),
        rot: frame.rot,
        scale: [1, S.recess, 1],
      });
    }
  }
  /* The solid strip: one module at the edge with no pans behind it. */
  bins.solidStrip.push({
    ...frame.at(u0 + L / 2, wEdge - solid / 2, panY),
    rot: frame.rot,
    scale: [L, S.recess + D.panThickness, solid],
  });

  /* Cylindrical surface downlights on the colonnade line, every second
     coffer, exactly as ad01, flickr and wm-from-below all show them. */
  for (let i = 1; i < cols; i += S.lightPitchModules) {
    bins.downlight.push({
      ...frame.at(u0 + ((i + 0.5) * L) / cols,
        section.facade.wallStandoff + section.column.standoffBuilt, soffitY - S.lightHeight / 2),
      rot: frame.rot,
    });
  }
}

/* ------------------------------------- the glazed wall, level 1 and level 2 */

/**
 * How far this ONE face may reach inboard before it is inside the drawn mass.
 *
 * `facade.wallStandoff` is a single number for the whole building, pinned to
 * the WORST disagreement between the OSM ring and the university's massing —
 * and that worst case is the east elevation alone. Face by face the drawn
 * ring stands 0.13 m outside the OSM trace on the south, 0.14 on the west and
 * 0.36 on the north, against 0.80 on the east. Anything that wants to sit
 * BEHIND the glazing has to know which of those it is standing on, or it is
 * buried on the east and floating on the west.
 */
function drawnClearanceOf(section, f, frame) {
  const a = frame.at(0, 0, 0);
  const b = frame.at(frame.length, 0, 0);
  const tx = (b.x - a.x) / frame.length;
  const tz = (b.z - a.z) / frame.length;
  const o = frame.at(0, 1, 0);
  const nx = o.x - a.x;
  const nz = o.z - a.z;
  let worst = 0;
  for (const [px, pz] of section.drawnRing || []) {
    const du = (px - a.x) * tx + (pz - a.z) * tz;
    if (du < -1 || du > frame.length + 1) continue;
    worst = Math.max(worst, (px - a.x) * nx + (pz - a.z) * nz);
  }
  return worst;
}

/**
 * The opaque interior backing behind a glazing band.
 *
 * The curtain wall keeps the library's reflective glass, which is right — but
 * a reflective pane is transparent by construction, and at 0.94 the measured
 * massing box's punched-window texture still read through it as a grid of
 * pale grey squares on every elevation. Rather than take the reflection away
 * to win the argument, the glass gets something opaque to be transparent
 * AGAINST: a matte near-black plane a short way inboard, in the section's own
 * `glassLower` — the sample of this building's glazing in deep shade, which is
 * what an unlit interior behind bronze glass actually is. The pane keeps its
 * reflections, the massing stops showing, and the gap between the two reads as
 * shallow depth instead of as a sticker.
 *
 * The depth is `preferred`, PINCHED per face by what the two surveys leave:
 * the east elevation has 0.19 m between the drawn box and its glass and gets
 * exactly that less a hair, while the south and west have most of a metre and
 * get the full 0.45. A single depth would bury the east backing inside the
 * mass, which is the one face the read-through was worst on.
 */
function backingStandoff(section, f, frame, D) {
  const glassW = section.facade.wallStandoff + D.glassOffset;
  const clear = drawnClearanceOf(section, f, frame);
  /* A hair outboard of the drawn skin, the same one the standoff itself keeps,
     and never closer than `backingClear` to the glass or there is no depth. */
  return Math.min(glassW - D.backingClear,
    Math.max(clear + D.glassOffset, glassW - D.backingDepth));
}

function collectGlazing(section, f, frame, ctx, bins) {
  const F = section.facade;
  const D = ctx.draw;
  const { l1Y, l2Y, soffitY } = ctx;
  const L = frame.length;
  const wWall = section.facade.wallStandoff;
  const mid = L / 2;

  /* Level 1 is glazed on the north, south and east; on the west it is the
     fluted aggregate wall instead, which collectFlutedWall builds. */
  const bands = [];
  if (!f.flutedWall) {
    bands.push([l1Y + F.glassSillGap, l2Y - F.spandrel, "glass"]);
  }
  bands.push([l2Y + F.glassSillGap, soffitY - F.glassTopGap, "glass"]);

  const wBack = backingStandoff(section, f, frame, D);

  for (const [y0, y1, kind] of bands) {
    if (y1 <= y0) continue;
    /* The backing runs a little WIDER and TALLER than its pane, so the
       massing cannot show in the sliver the glass leaves at either end. */
    bins.backing.push({
      ...frame.at(mid, wBack, (y0 + y1) / 2),
      rot: frame.rot,
      scale: [L, y1 - y0 + D.paneMargin, 1],
    });
    bins.glass.push({
      ...frame.at(mid, wWall + D.glassOffset, (y0 + y1) / 2),
      rot: frame.rot,
      scale: [L - D.paneMargin, y1 - y0, 1],
      kind,
    });
    /* Mullions on their own pitch — deliberately finer than the coffer
       module, and never equal to it, or the facade turns into a grid. */
    for (let u = F.mullionPitch / 2; u < L; u += F.mullionPitch) {
      bins.mullion.push({
        ...frame.at(u, wWall + D.mullionOffset, (y0 + y1) / 2),
        rot: frame.rot,
        scale: [F.mullionWidth, y1 - y0, D.mullionDepth],
      });
    }
    for (const y of [y0, y1]) {
      bins.mullion.push({
        ...frame.at(mid, wWall + D.mullionOffset, y),
        rot: frame.rot,
        scale: [L - D.paneMargin, F.mullionWidth, D.mullionDepth],
      });
    }
  }

  /* The pale spandrel under the balcony floor line. */
  bins.spandrel.push({
    ...frame.at(mid, wWall - D.spandrelInset, l2Y - F.spandrel / 2),
    rot: frame.rot,
    scale: [L, F.spandrel, D.spandrelDepth],
  });
}

/* ------------------------------------------------------- the corner piers */

/**
 * The four solid end panels, one per corner of the ring.
 *
 * A glazing plane hangs `wallStandoff` proud of its own face and stops at that
 * face's ends, so between two adjacent planes the measured massing box's
 * corner is left bare — and campus-massing.js wears a generic punched-window
 * texture, which at eye level read as a dozen mini-storeys of small office
 * windows stacked up the corner of a two-storey building. The inventory says
 * no fenestrated pier is there to see: the curtain wall runs into SOLID END
 * PANELS. So each corner carries one panel-clad pier, square in plan, both of
 * its outward faces standing just proud of the glazing and the mullions they
 * meet, from below grade up to the back of the coffer recess.
 *
 * Its inward reach is not taste. It is `drawnClearance` — how far the
 * university's massing stands outside the OSM ring this section hangs on —
 * plus the same 0.15 m the standoff itself carries, which is the least that
 * covers the drawn corner from both of the faces that see it.
 */
function collectCornerPiers(section, frames, ctx, bins) {
  /* `pierProud` clears the mullions, whose outer faces sit at the mullion
     offset plus half their depth; anything shallower leaves a mullion
     standing out of the solid panel. */
  const D = ctx.draw;
  const out = section.facade.wallStandoff + D.pierProud;
  const inset = section.drawnClearance + D.clearanceMargin;
  const side = out + inset;
  const y1 = ctx.soffitY + section.soffit.recess;
  const faces = section.faces;

  for (let i = 0; i < faces.length; i++) {
    const f1 = faces[i];
    const f2 = faces[(i + 1) % faces.length];
    /* The faces are given in ring order, so f1 ends where f2 begins. */
    const [px, pz] = f1.b;
    const [n1x, n1z] = frames.get(f1.id).normal;
    const [n2x, n2z] = frames.get(f2.id).normal;
    /* Centre the square between -inset and +out on BOTH outward normals. The
       two are a quarter turn apart to within the ring's half-degree of skew,
       so one face's rotation squares the box to both. */
    const d = (out - inset) / 2;
    const x = px + (n1x + n2x) * d;
    const z = pz + (n1z + n2z) * d;
    const y0 = ctx.ground(x, z) - D.pierBury;
    bins.cornerPier.push({
      x, y: (y0 + y1) / 2, z,
      rot: frames.get(f1.id).rot,
      scale: [side, y1 - y0, side],
    });
  }
}

/* ---------------------------------- the balcony, the terrace and the rails */

/** Deck + picket rail along a face at height `y`, projecting `project` from
 *  the glass line. Both the mid-level balcony and the plaza-level terrace are
 *  this same assembly at two different heights. */
function collectDeck(section, f, frame, ctx, bins, spec, y, redBand) {
  const F = section.facade;
  const D = ctx.draw;
  const L = frame.length;
  const wWall = section.facade.wallStandoff;
  const wEdge = wWall + spec.project;
  const mid = L / 2;

  bins.deck.push({
    ...frame.at(mid, wWall + spec.project / 2, y - spec.deck / 2),
    rot: frame.rot,
    scale: [L, spec.deck, spec.project],
  });
  /* THE BALCONY'S OWN SOFFIT IS COFFERED. wm-from-below shows small waffle
     pans under this walkway band, the same family as the great roof soffit at
     half its module. One continuous strip per face, its underside carrying a
     recessed pan plane and a rib grid — never a separate planter box, which
     no frame in four epochs contains (facade.balcony.stripNote). Terrace decks
     have no coffering in any frame, so this is balcony-only. */
  const K = spec.soffitCoffer;
  if (K) {
    const under = y - spec.deck;
    const panDepth = spec.project - 2 * K.rib;
    bins.balconyPan.push({
      ...frame.at(mid, wWall + spec.project / 2, under - K.recess / 2),
      rot: frame.rot,
      scale: [L, K.recess, panDepth],
    });
    /* Ribs across the strip, ONE PER COFFER CELL on the balcony's own pitch —
       the cell count is solved against the measured face the same way the
       roof's coffers are, so the grid stays regular right to both ends
       instead of leaving a part cell at one — plus the two edge ribs that
       close the grid along its length. */
    const cells = Math.max(1, Math.round(L / K.pitch));
    for (let i = 0; i < cells; i++) {
      bins.balconyRib.push({
        ...frame.at(((i + 0.5) * L) / cells, wWall + spec.project / 2, under - K.recess / 2),
        rot: frame.rot,
        scale: [K.rib, K.recess, spec.project],
      });
    }
    for (const w of [wWall + K.rib / 2, wWall + spec.project - K.rib / 2]) {
      bins.balconyRib.push({
        ...frame.at(mid, w, under - K.recess / 2),
        rot: frame.rot,
        scale: [L, K.recess, K.rib],
      });
    }
  }
  if (redBand) {
    bins.redBand.push({
      ...frame.at(mid, wEdge + D.bandOffset, y - spec.deck / 2),
      rot: frame.rot,
      scale: [L, redBand, D.bandDepth],
    });
  }

  const B = F.balcony;
  const h = spec.railHeight ?? B.railHeight;
  for (let u = B.picketPitch / 2; u < L; u += B.picketPitch) {
    bins.picket.push({
      ...frame.at(u, wEdge - D.railInset, y + h / 2),
      rot: frame.rot,
      scale: [B.picketSize, h, B.picketSize],
    });
  }
  bins.railCap.push({
    ...frame.at(mid, wEdge - D.railInset, y + h),
    rot: frame.rot,
    scale: [L, B.railCap, B.railCap * D.capAspect],
  });
  bins.railCap.push({
    ...frame.at(mid, wEdge - D.railInset, y + h * D.midRailFrac),
    rot: frame.rot,
    scale: [L, B.midRail, B.midRail * D.midRailAspect],
  });
}

/* --------------------------------------- the lower colonnade, south and west */

function collectLowerColonnade(section, f, frame, ctx, bins) {
  const C = section.facade.lowerColonnade;
  const T = section.facade.terrace;
  const D = ctx.draw;
  const { l2Y } = ctx;
  const L = frame.length;
  const wWall = section.facade.wallStandoff;
  const wCol = wWall + T.project - C.columnSize;
  const topY = l2Y - T.deck;

  /* Slender plain square columns — a DISTINCT system, never a continuation of
     the flared struts above, which is the thing oceanlight-21220.jpg is
     clearest about. Each one is seated on the drawn terrain. */
  const n = Math.max(2, Math.round(L / C.pitch));
  for (let i = 0; i <= n; i++) {
    const u = (L * i) / n;
    const p = frame.at(u, wCol, 0);
    const g = ctx.ground(p.x, p.z);
    if (topY - g < 1) continue;
    bins.lowerColumn.push({
      x: p.x, y: (g + topY) / 2, z: p.z, rot: frame.rot,
      scale: [C.columnSize, topY - g, C.columnSize],
    });
  }

  /* The set-back dark glazing behind them, on its own opaque backing. */
  if (f.flutedWall) return;
  const p = frame.at(L / 2, wWall, 0);
  const g = ctx.ground(p.x, p.z);
  const midY = (g + D.lowerGlassSill + topY - D.lowerGlassHead) / 2;
  const h = Math.max(D.lowerGlassMin, topY - D.lowerGlassFoot - g);
  bins.backing.push({
    ...frame.at(L / 2, backingStandoff(section, f, frame, D), midY),
    rot: frame.rot,
    scale: [L, h + D.paneMargin, 1],
  });
  bins.lowerGlass.push({
    ...frame.at(L / 2, wWall + D.glassOffset, midY),
    rot: frame.rot,
    scale: [L - 2 * D.paneMargin, h, 1],
  });
}

/* ------------------------------------- the fluted aggregate wall, west only */

function collectFlutedWall(section, f, frame, ctx, bins) {
  const W = section.facade.flutedWall;
  const T = section.facade.terrace;
  const D = ctx.draw;
  const { l2Y } = ctx;
  const L = frame.length;
  const wWall = section.facade.wallStandoff;
  const topY = l2Y - T.deck;
  const doorU0 = L / 2 - W.doorWidth / 2;
  const doorU1 = L / 2 + W.doorWidth / 2;

  for (const [u0, u1] of [[D.wallEndMargin, doorU0], [doorU1, L - D.wallEndMargin]]) {
    const p = frame.at((u0 + u1) / 2, wWall, 0);
    const g = ctx.ground(p.x, p.z);
    bins.flutedWall.push({
      ...frame.at((u0 + u1) / 2, wWall + W.thickness / 2, (g + topY) / 2),
      rot: frame.rot,
      scale: [u1 - u0, topY - g, W.thickness],
    });
    /* The vertical flutes: strips on 0.4 m centres standing proud of the
       panel, which is what makes a board-formed aggregate wall read as one. */
    for (let u = u0 + W.flutePitch / 2; u < u1; u += W.flutePitch) {
      bins.flute.push({
        ...frame.at(u, wWall + W.thickness + W.fluteDepth / 2, (g + topY) / 2),
        rot: frame.rot,
        scale: [W.fluteWidth, topY - g, W.fluteDepth],
      });
    }
  }
  /* The dark timber-toned double doors in the middle of it. */
  const p = frame.at(L / 2, wWall, 0);
  const g = ctx.ground(p.x, p.z);
  bins.doorBronze.push({
    ...frame.at(L / 2, wWall + W.thickness, g + W.doorHeight / 2),
    rot: frame.rot,
    scale: [W.doorWidth, W.doorHeight, D.doorThickness],
  });
}

/* ------------------------------------------------- the entry, north face */

function buildEntry(section, group, frame, f, ctx) {
  const E = section.entry;
  const D = ctx.draw;
  const { colors } = section;
  const { l1Y, soffitY, eavesY } = ctx;
  const L = frame.length;
  const wWall = section.facade.wallStandoff;
  const C = section.column;

  /* The two beams. They ride the MIDDLE pair's column lines, taken at the
     head where the pair has already splayed, and they run out to the FASCIA
     AND STOP — the deepest, whitest thing on this elevation and the blades
     the building's name is painted on. The retired revision ran them 2.6 m
     past the fascia; nothing projects north of the roof plate in the
     orthophoto, so `entry.beam.project` is now `grid.roofOut` itself. */
  const beamH = eavesY - (soffitY - E.beam.dropBelowSoffit);
  const shape = new THREE.Shape();
  const inner = 0;
  const outer = wWall + E.beam.project;
  const ch = E.beam.chamfer;
  shape.moveTo(inner, 0);
  shape.lineTo(outer, 0);
  shape.lineTo(outer, -(beamH - ch));
  shape.lineTo(outer - ch, -beamH);   // the chamfered tip
  shape.lineTo(inner, -beamH);
  shape.closePath();
  const beamGeo = new THREE.ExtrudeGeometry(shape, {
    depth: E.beam.width, bevelEnabled: false,
  });
  /* The shape is drawn in (w, y); rotate it so +x becomes the outward normal
     and the extrusion runs along the face. */
  /* The shape is drawn in (w, y) and extruded along +z; rotate it so shape-x
     becomes the face's outward normal. The extrusion then runs along -u, so
     each beam is placed half a width further along to sit on its strut. */
  beamGeo.rotateY(-Math.PI / 2);

  /* No `splayHead` term in the station any more: the lean is out-of-plane, so
     a head does not displace ALONG the face and the beams ride their pair's
     column lines exactly. That offset was a knock-on of the retired in-plane
     splay (see collectStruts). */
  for (const s of [-1, 1]) {
    const u = L / 2 + (s * f.pairGap) / 2 + E.beam.width / 2;
    const p = frame.at(u, 0, 0);
    const mesh = new THREE.Mesh(beamGeo, ctx.mats.conc(colors.entryBeam, [6, 2]));
    mesh.position.set(p.x, eavesY, p.z);
    mesh.rotation.y = frame.rot;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  /* The 2013 canopy: a flat red-orange blade over the doors with two exposed
     linear luminaires under it. It sits beside the entry pair, not on it. */
  const K = E.canopy;
  const uCan = L / 2 - K.width / 2 - f.pairGap / 2 - K.gap;
  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(K.width, K.depth, K.project), painted(colors.canopyRed)
  );
  const cp = frame.at(uCan, wWall + K.project / 2, 0);
  canopy.position.set(cp.x, l1Y + K.height, cp.z);
  canopy.rotation.y = frame.rot;
  canopy.castShadow = true;
  group.add(canopy);

  const lum = E.luminaire;
  for (let i = 0; i < lum.count; i++) {
    const w = wWall + lum.inset + (i * (K.project - 2 * lum.inset)) / Math.max(1, lum.count - 1);
    const lp = frame.at(uCan, w, 0);
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(lum.length, lum.size, lum.size),
      new THREE.MeshStandardMaterial({ color: colors.luminaireLens, roughness: 0.4, emissive: colors.luminaireLens, emissiveIntensity: 0.35 })
    );
    bar.position.set(lp.x, l1Y + K.height - K.depth / 2 - lum.size, lp.z);
    bar.rotation.y = frame.rot;
    group.add(bar);
  }

  /* Light-anodised glazed door leaves under it — the 2013 contrast against
     the bronze the rest of the building wears. */
  const DR = E.doors;
  const leaves = [];
  for (let i = 0; i < DR.leaves; i++) {
    leaves.push(uCan + (i - (DR.leaves - 1) / 2) * (DR.width + D.doorGap));
  }
  group.add(instanced(
    new THREE.BoxGeometry(DR.width, DR.height, D.doorThickness), painted(section.colors.doorAnodised),
    leaves, (u) => ({ ...frame.at(u, wWall + D.doorGap, l1Y + DR.height / 2), rot: frame.rot })
  ));

  /* The 'Theatre & Dance Department' hanging blade on its two rods. The
     lettering is absent; the blade is not. */
  const S = E.sign;
  const uSign = L / 2 + S.uFromCentre;
  const sp = frame.at(uSign, wWall + S.standoff, 0);
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(S.width, S.height, S.thickness), painted(colors.signBlade)
  );
  blade.position.set(sp.x, l1Y + S.height_above, sp.z);
  blade.rotation.y = frame.rot;
  group.add(blade);
  group.add(instanced(
    new THREE.CylinderGeometry(S.rodRadius, S.rodRadius, S.rodLength, 5), metal(colors.stairSteel),
    [-1, 1], (s) => ({
      ...frame.at(uSign + s * S.width * D.rodSpread, wWall + S.standoff,
        l1Y + S.height_above + S.height / 2 + S.rodLength / 2),
      rot: frame.rot,
    })
  ));
}

/* --------------------------------------------------------- the west stair
 *
 * WITHDRAWN 2026-08-21. A 26-tread flight from the west court up to the
 * terrace used to be built here off `west.stair`. Its only citation was
 * ucsdmap.jpg, whose page is 404, and no cached live frame shows a flight
 * rising out of that paving — see `west.stairNote` and the `absent` entry,
 * which carry the retired geometry and the whole ladder. The visual round-2
 * audit also found the build broken (its stringers and rail caps were mirrored
 * about the flight), and a dead citation plus a broken build is a withdrawal
 * rather than a repair. Restore from `west.stairNote` when a frame appears. */

/* ------------------------------------------------------------- the ground */

function buildGround(section, group, ctx) {
  const { colors } = section;
  const D = ctx.draw;
  const ground = ctx.ground;

  /* Ground fields carry their material class from the library; the repeat is
     computed per rect from the class's real-world tile size, so a paver stays
     a paver whether the field is 12 m or 60 m across. `cls: null` keeps the
     plain decal for fields with no microstructure worth carrying. Every field
     is DRAPED (drapedQuad): the west court and the south lawn each carry
     metres of real relief, and a flat quad there is a hole or a hover. */
  const flat = (rects, color, rung, cls = "smoothConcrete", tile = D.tiles.concrete) => {
    for (const r of rects) {
      const w = r.x1 - r.x0;
      const d = r.z1 - r.z0;
      const mat = cls
        ? applyOverlayDepth(ctx.mats.lib.get(cls, {
            color,
            repeat: [Math.max(1, Math.round(w / tile)), Math.max(1, Math.round(d / tile))],
          }), rung)
        : decal(color, rung);
      const { geo, place } = drapedQuad(r, ground, overlayLift(rung), D.drapeSegment);
      const mesh = new THREE.Mesh(geo, mat);
      place(mesh);
      mesh.renderOrder = OVERLAY[rung].renderOrder;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  };

  /* Sawn-jointed cast-in-place paving on three sides, at two different
     scales: the big 2.4 m slabs of the entry plaza in ad01, and the finer
     1.35 m court grid in ucsdmap. Each joint is a ribbon draped over the
     drawn terrain (campus-drape.js), merged into one mesh per field — a
     56 m flat instance across the west court's 3.3 m of relief would bury
     its own ends. */
  const scored = (rects, pitch, width) => {
    const verts = [];
    for (const r of rects) {
      for (let x = Math.ceil(r.x0 / pitch) * pitch; x < r.x1; x += pitch) {
        ribbon(verts, [[x, r.z0], [x, r.z1]], width / 2, ground, overlayLift(CARPET));
      }
      for (let z = Math.ceil(r.z0 / pitch) * pitch; z < r.z1; z += pitch) {
        ribbon(verts, [[r.x0, z], [r.x1, z]], width / 2, ground, overlayLift(CARPET));
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, decal(colors.pavingJoint, CARPET));
    m.name = "ground-joints";
    m.renderOrder = OVERLAY[CARPET].renderOrder;
    m.receiveShadow = true;
    group.add(m);
  };

  const N = section.north;
  const W = section.west;
  const S = section.south;

  /* THE NORTH APRON IS SEVEN RECTANGLES, NOT ONE, and the three holes in it
     are not holes: they are arcgis.ground#1764, #1765 and #1766, surveyed
     PLANTED ground (`k: "green"`) that the campus paving multipolygon itself
     punches out, and which the retired single rect laid 194.9 m2 of jointed
     concrete deck over. The cut and the beds are one edit — an apron with
     three holes and nothing in them would be a hole in the world — so the
     beds are drawn here, from the survey rings verbatim, seated on the same
     drawn surface as every other ground field. See north.apronNote and
     north.bedSource. What SPECIES grow in them is still absent; that they are
     planted is not — see plantBeds below. */
  flat(N.apron, colors.pavingBuff, PAD);
  scored(N.apron, N.jointPitch, N.jointWidth);
  for (const bed of N.beds) {
    const { geo, place } = drapedRing(bed.ring, ground, overlayLift(PAD), D.drapeSegment);
    const mesh = new THREE.Mesh(geo, decal(colors.northBed, PAD));
    place(mesh);
    mesh.renderOrder = OVERLAY[PAD].renderOrder;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  flat(W.paving, colors.pavingBuff, PAD);
  scored(W.paving, W.jointPitch, W.jointWidth);
  flat(S.apron, colors.pavingBuff, PAD);
  scored(S.apron, N.jointPitch, N.jointWidth);

  /* The fine tan unit pavers on the north-west approach, laid in running
     bond — a different material from the court, not a different colour of
     the same one. */
  /* Running bond as JOINTS, not as one quad per paver. A quad per paver was
     1,600 instances in the same colour as the field beneath them — invisible,
     and the single most expensive thing this file drew. The library's unit
     tile is 6 pavers, so one tile is six of the measured 0.42 m pitch. */
  flat(W.pavers, colors.unitPaver, PAD, "pavingConcreteUnit", W.paverPitch * D.tiles.paverUnits);
  scored(W.pavers, W.paverPitch * 2, W.paverJointWidth);

  /* The lava-rock retaining wall along the measured grade break, and the
     groundcover spilling over it off the bank above. */
  buildLavaWall(section, group, ctx);
  flat(W.groundcover, colors.groundcover, CARPET, null);

  /* Dark picket railings along the court and ramp edges. */
  const posts = [];
  const caps = [];
  for (const r of W.railings) {
    const len = Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]);
    const ux = (r.b[0] - r.a[0]) / len;
    const uz = (r.b[1] - r.a[1]) / len;
    const rot = Math.atan2(-uz, ux);
    for (let t = W.railPicketPitch / 2; t < len; t += W.railPicketPitch) {
      posts.push({ x: r.a[0] + ux * t, z: r.a[1] + uz * t, rot });
    }
    caps.push({ x: (r.a[0] + r.b[0]) / 2, z: (r.a[1] + r.b[1]) / 2, rot, len });
  }
  const B0 = section.facade.balcony;
  group.add(instanced(new THREE.BoxGeometry(B0.picketSize, W.railHeight, B0.picketSize),
    painted(colors.picket),
    posts, (p) => ({ x: p.x, y: ground(p.x, p.z) + W.railHeight / 2, z: p.z, rot: p.rot }), false));
  group.add(instanced(new THREE.BoxGeometry(1, B0.railCap, D.bandDepth), painted(colors.picket),
    caps, (c) => ({ x: c.x, y: ground(c.x, c.z) + W.railHeight, z: c.z, rot: c.rot, scale: [c.len, 1, 1] })));

  /* South: the 1.8 m walk running perpendicular out of the lower colonnade
     into the lawn, with a continuous planting bed on either side of it. */
  flat(S.lawn, colors.lawn, CARPET, null);
  flat(S.beds, colors.dg, CARPET, "decomposedGranite", D.tiles.dg);
  flat([{ x0: S.walk.x - S.walk.width / 2, x1: S.walk.x + S.walk.width / 2, z0: S.walk.z0, z1: S.walk.z1 }],
    colors.pavingBuff, PAINT);

  const cl = S.clumps;
  const seed = section.seed;
  const tufts = [];
  for (let k = 0; k < cl.count; k++) {
    const bed = S.beds[k % S.beds.length];
    tufts.push({
      x: bed.x0 + hash(seed, k, 1) * (bed.x1 - bed.x0),
      z: bed.z0 + hash(seed, k, 2) * (bed.z1 - bed.z0),
      k,
    });
  }
  /* THE THREE NORTH BEDS ARE PLANTED TOO, into the same two draws. They
     shipped cut correctly out of the apron and then left as flat green
     rectangles (visual round-2 finding 5), which is inconsistent with this
     building's own west and south beds and with the frame those beds were
     read off. Only the COUNT is new and it is [estimated] — the south field's
     own density across the surveyed ring areas (north.plantingSource). Size,
     shape and shrub fraction stay `south`'s, so the extension cannot drift
     off the field it extends. The beds are surveyed RINGS, not rects, so each
     point is drawn in the ring's bounding box and rejected until it lands
     inside the ring — seeded, so it cannot put a shrub on the apron and two
     builds stay byte-identical. `k` continues past the south's field, which
     is what keeps the two scatters out of each other's hash stream. */
  for (let i = 0; i < N.clumps.count; i++) {
    const ring = N.beds[i % N.beds.length].ring;
    const xs = ring.map((p) => p[0]);
    const zs = ring.map((p) => p[1]);
    const x0 = Math.min(...xs); const x1 = Math.max(...xs);
    const z0 = Math.min(...zs); const z1 = Math.max(...zs);
    const k = cl.count + i;
    for (let j = 0; j < RING_SAMPLE_TRIES; j++) {
      const x = x0 + hash(seed, k, 1, j) * (x1 - x0);
      const z = z0 + hash(seed, k, 2, j) * (z1 - z0);
      if (pointInRing(ring, x, z)) { tufts.push({ x, z, k }); break; }
    }
  }
  group.add(instanced(new THREE.ConeGeometry(cl.radius, cl.height, 5), foliage(colors.grassClump),
    tufts.filter((t) => hash(seed, t.k, 7) >= S.shrubFraction),
    (t) => ({ x: t.x, y: ground(t.x, t.z) + cl.height / 2, z: t.z, rot: hash(seed, t.k, 8) * Math.PI }), false));
  group.add(instanced(new THREE.SphereGeometry(cl.radius * cl.shrubRatio, 6, 4),
    foliage(colors.shrubPink),
    tufts.filter((t) => hash(seed, t.k, 7) < S.shrubFraction),
    (t) => ({ x: t.x, y: ground(t.x, t.z) + cl.radius, z: t.z }), false));
  const northClumps = tufts.length - cl.count;

  /* The precast cylinder bins that stand either side of the entry doors. */
  const B = section.entry.bins;
  group.add(instanced(new THREE.CylinderGeometry(B.radius, B.radius * D.binTaper, B.height, 14),
    ctx.mats.conc(colors.bin, [2, 1]), N.bins,
    (b) => ({ x: b.x, y: ground(b.x, b.z) + B.height / 2, z: b.z })));
  group.add(instanced(new THREE.CylinderGeometry(B.radius + D.coplanarNudge,
    B.radius + D.coplanarNudge, B.bandHeight, 14),
    painted(colors.binBand), N.bins.filter((b) => b.recycling),
    (b) => ({ x: b.x, y: ground(b.x, b.z) + B.height - B.bandHeight, z: b.z })));

  return { northClumps };
}

/** The ~0.9 m mortared scoria retaining wall along the west court's grade
 *  break — CONTINUOUS coursed masonry under no coping, with lichen on some of
 *  it. The first pass scattered discrete tumbled blocks with random yaw and
 *  gaps between them, which read as rubble from ten metres; the wall in
 *  ucsdmap.jpg is one unbroken run. So now it is contiguous full-height
 *  segments, all on the wall's own axis, with the rock/mortar read carried by
 *  the library's lavaRock texture and the tone shifting segment to segment the
 *  way real scoria courses do — no gaps, no stray clumps. The top follows the
 *  drawn terrain per segment, exactly as a wall built on that bank would. */
function buildLavaWall(section, group, ctx) {
  const L = section.west.lavaWall;
  const { colors } = section;
  const ground = ctx.ground;
  const len = Math.hypot(L.b[0] - L.a[0], L.b[1] - L.a[1]);
  const ux = (L.b[0] - L.a[0]) / len;
  const uz = (L.b[1] - L.a[1]) / len;
  const rot = Math.atan2(-uz, ux);
  const D = ctx.draw;
  const seed = section.seed;
  const n = Math.max(1, Math.ceil(len / D.drapeSegment));
  const seg = len / n;
  const segs = [];
  const lichens = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) * seg;
    const x = L.a[0] + ux * t;
    const z = L.a[1] + uz * t;
    const j = hash(seed, i, 3);
    segs.push({
      x, y: ground(x, z) + L.height / 2, z, rot,
      /* `segOverlap` keeps the run visibly seamless where the terrain steps
         the neighbouring segments apart. */
      scale: [seg + D.segOverlap, L.height, L.thickness],
      tone: j < L.redFraction ? "lavaRockRed" : "westWallRock",
    });
    /* Lichen patches sit ON the face of the wall, west (outer) side. */
    if (hash(seed + 2, i, 5) < L.lichenFraction * 2) {
      const u = t + (hash(seed + 4, i, 1) - 0.5) * seg * D.lichenJitter;
      const px = L.a[0] + ux * u;
      const pz = L.a[1] + uz * u;
      const off = L.thickness / 2 + D.coplanarNudge;
      lichens.push({
        x: px - uz * off, z: pz + ux * off,
        y: ground(px, pz) + L.height * (D.lichenLow + hash(seed + 5, i, 2) * D.lichenSpan),
        rot,
      });
    }
  }
  const box = new THREE.BoxGeometry(1, 1, 1);
  for (const tone of ["westWallRock", "lavaRockRed"]) {
    group.add(instanced(box, ctx.mats.lava(colors[tone]), segs.filter((s) => s.tone === tone), (it) => it));
  }
  /* Yellow lichen as its own scatter of small patches, because a lichen-toned
     course reads as a different rock and a patched one reads as lichen. */
  group.add(instanced(new THREE.BoxGeometry(...L.lichenPatch), rock(colors.lichen),
    lichens, (it) => it, false));
}

/* ------------------------------------------------ measured-tree re-skins */

/**
 * Photo-layer re-skin of the measured LiDAR trunks whose blob crowns would
 * pierce the oversail roof slab (section.treeOverrides). The tree at the NE
 * oversail corner is REAL — its trunk row is copied verbatim from
 * campus-lidar.json and the blob renderer is told to skip it via
 * `treeOverrides.skipMeasuredKeys` (the same contract plaza uses; campus-walk
 * unions the keys into createTrees' skip set) — but its measured 18.3 m top
 * stands above the soffit, and the blob renderer knows nothing about a roof
 * band that reaches 3.67 m past the footprint it checks clearance against. So
 * this draws the same species, same tint, same silhouette family as the
 * measured renderer would, with ONE invented change, declared in the section:
 * the canopy is pruned below the soffit plane, the way the real understorey
 * tree under that corner is. Nothing else may read from this.
 */
/**
 * The foliage body: a low sphere pushed around by a closed-form ripple, so a
 * clump is a lumpy mass rather than a billiard ball. One geometry for every
 * lobe — the variety is per-instance yaw, non-uniform scale and tone — and the
 * displacement is a pure function of the vertex, so duplicated seam and pole
 * vertices move together and the surface stays closed.
 *
 * This is campus-photo-plaza's lobe idiom. That module does not export it and
 * is not this agent's to edit, so the recipe is repeated here rather than
 * reached into; if the two ever need to differ, they are separate on purpose.
 */
function lobeGeometry() {
  const geo = new THREE.SphereGeometry(1, 10, 7);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n =
      Math.sin(v.x * 3.1 + 1.7) * Math.sin(v.y * 2.6 + 0.4) * Math.sin(v.z * 3.7 + 2.2) +
      0.5 * Math.sin(v.x * 6.3 + 0.9) * Math.sin(v.z * 5.5 + 1.3);
    v.multiplyScalar(1 + n * 0.15);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * campus-species' `treeTint` returns hexToRgb of a hex string — plain sRGB
 * byte fractions, NOT linear. Handing those straight to `new THREE.Color(r,g,b)`
 * stores them as the working (linear) colour, which renders #b0a48e at 0.690
 * instead of 0.434: about 60% too bright on the bark and nearly three times
 * too bright on the leaf. That is what made this canopy read as pale sage
 * against the plaza's trees, which reach the SAME hexes — species trunk
 * #b0a48e is plaza's eucTrunk, byte for byte — through THREE's hex parser and
 * therefore through the sRGB conversion. Naming the colour space puts this
 * file on the plaza's path. Same source hex, no new colour.
 */
function speciesColor(rgb) {
  return new THREE.Color().setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace);
}

/**
 * Signed distance from a point to the measured ring, negative inside, with the
 * unit direction that points OUT of the building. Used to keep foliage off the
 * facade: a crown radius is metres, the trunk stands 0.7 m off the glass, and
 * "lean the clumps outward" is not the same as "no clump crosses the wall".
 */
/** Even-odd point-in-polygon on a closed ring. Used to keep the north bed
 *  planting inside the SURVEYED rings rather than inside their bounding
 *  boxes, which would spill onto the apron at every skewed edge. */
function pointInRing(ring, x, z) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function ringClearance(ring, x, z) {
  let best = Infinity;
  let bx = 1;
  let bz = 0;
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i];
    const [cx, cz] = ring[(i + 1) % ring.length];
    const dx = cx - ax;
    const dz = cz - az;
    const len2 = dx * dx + dz * dz;
    let t = len2 ? ((x - ax) * dx + (z - az) * dz) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const px = ax + dx * t;
    const pz = az + dz * t;
    const d = Math.hypot(x - px, z - pz);
    if (d < best) { best = d; bx = x - px; bz = z - pz; }
  }
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  const n = Math.hypot(bx, bz) || 1;
  const s = inside ? -1 : 1;
  return { d: inside ? -best : best, nx: (s * bx) / n, nz: (s * bz) / n };
}

/** A limb as a unit cylinder stretched from `from` to `to`. The Euler is YXZ,
 *  so rotX tilts the +Y axis into ZY and rot then swings its bearing. */
function limbTo(from, to) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const len = Math.hypot(dx, dy, dz) || 1;
  return {
    x: (from[0] + to[0]) / 2, y: (from[1] + to[1]) / 2, z: (from[2] + to[2]) / 2,
    rot: Math.atan2(dx, dz),
    rotX: Math.acos(Math.max(-1, Math.min(1, dy / len))),
    scale: [1, len, 1],
  };
}

/** The plane a re-skinned trunk is pruned below. `ceiling: "balcony"` names
 *  the underside of the level-2 deck; anything else is the roof soffit, which
 *  is what the mechanism was built for and stays the default. */
function ceilingOf(section, ctx, item) {
  return item.ceiling === "balcony"
    ? ctx.l2Y - section.facade.balcony.deck
    : ctx.soffitY;
}

function buildTreeReskins(section, group, ctx) {
  const T = section.treeOverrides;
  if (!T || !T.items?.length) return { reskinnedTrees: 0, canopyLobes: 0 };
  const CN = T.canopy;
  const D = ctx.draw;
  const seed = section.seed;
  const clear = T.clearBelowSoffit;
  const sub = new THREE.Group();
  sub.name = "galbraith-tree-reskins";

  /* One bin per material PER SPECIES, so the set is three draws per species
     however many stems it grows to. Per-species and not per-set, because the
     species table gives each one its own bark and leaf hue and `instanced`
     only carries a per-instance VALUE — a single set of bins takes whichever
     species the loop happened to end on and repaints every other stem with
     it. That was invisible while one stem was re-skinned and wrong the moment
     a second one of a different species arrived. */
  const bins = new Map();
  const binFor = (species) => {
    if (!bins.has(species)) bins.set(species, { boles: [], limbs: [], lobes: [] });
    return bins.get(species);
  };

  T.items.forEach((it, idx) => {
    const g = ctx.ground(it.x, it.z);
    const species = treeSpecies(it.x, it.z, it.h, it.r);
    const bin = binFor(species);
    const form = SPECIES[species].form;
    /* What the measured renderer would draw, before the slab exists... */
    let { crownR, crownV, centre } = crownFor([it.x, it.z, it.h, it.r], form);
    /* ...clamped so the canopy TOP stays `clear` below the plane it was
       piercing. WHICH plane is the item's own business and is named in the
       data, because the two re-skinned stems pierce different slabs: the
       NE-corner stem passes the roof soffit, and the mid-east stem passes the
       level-2 balcony deck eleven metres lower. The underside keeps the
       species walk-under clearance; the crown compresses between the two, and
       its spread follows the compression so the pruned tree keeps tree
       proportions instead of becoming a disc. */
    const ceilY = ceilingOf(section, ctx, it);
    const capTop = ceilY - clear - g;
    let under = CN.underMin;
    if (centre + crownV > capTop) {
      under = Math.max(CN.underMin, capTop - 2 * crownV);
      crownV = Math.max(CN.crownVMin, (capTop - under) / 2);
      centre = (capTop + under) / 2;
      crownR = Math.min(crownR, crownV * CN.crownRatio);
    }


    /* The pruning is ASYMMETRIC, and the direction is not a taste call: this
       stem stands under eleven metres of soffit with the building's own glass
       less than a metre off one side, so the crown it can actually carry is
       the one that grew AWAY from the wall, out toward the open corner. The
       bearing is the ring corner to the trunk, normalised — the same two
       measured points the pier at that corner is built from. */
    let bx = 1;
    let bz = 0;
    let best = Infinity;
    for (const [cx, cz] of section.ring) {
      const d = Math.hypot(it.x - cx, it.z - cz);
      if (d < best && d > 1e-6) { best = d; bx = (it.x - cx) / d; bz = (it.z - cz) / d; }
    }

    /* A pale pole carrying small high clumps — the eucalyptus silhouette the
       measured renderer gives this stem, kept, but with its top third cut off
       by the slab instead of the sky. The bole runs the FULL height from the
       ground to just under the canopy, one textured piece with nothing to
       leave a bare untextured stub at the bottom. */
    const boleH = Math.min(capTop * CN.boleFraction, centre + crownV * CN.boleCrownFraction);
    bin.boles.push({
      x: it.x, y: g + boleH / 2, z: it.z, rot: hash(seed, idx, 11) * Math.PI,
      scale: [1, boleH, 1],
    });

    const from = [it.x, g + boleH * D.boleFoot, it.z];
    const clumps = CN.clumps;
    const phase = hash(seed, idx, 12) * Math.PI * 2;
    for (let c = 0; c < clumps; c++) {
      const k = idx * 97 + c;
      /* Spaced round the pole rather than scattered: purely random bearings
         leave three clumps on one side and a hole you can see through. */
      const a = phase + (c / clumps) * Math.PI * 2 + (hash(seed, k, 1) - 0.5) * CN.jitter;
      const dirX = Math.sin(a);
      const dirZ = Math.cos(a);
      /* 1 out toward the open side, -1 back into the building. The inboard
         clumps keep barely a third of the reach, which is the prune. */
      const lean = dirX * bx + dirZ * bz;
      const reach = crownR * (CN.reachMin + hash(seed, k, 2) * CN.reachSpread)
        * (CN.leanFloor + CN.leanSpan * ((lean + 1) / 2));
      let rad = Math.min(crownR * CN.radiusOfCrown,
        CN.radiusMin + hash(seed, k, 3) * CN.radiusSpread);
      const squash = CN.squash;
      /* Clumps ride the top of what is left, and the ones reaching back under
         the deeper slab ride lower still. */
      let y = g + under + (capTop - under)
        * (CN.heightBase + hash(seed, k, 4) * CN.heightSpread - CN.heightLeanDrop * (1 - lean));
      /* The hard gate, applied per lobe and not per tree: nothing may reach
         the item's own ceiling. Drop the clump first, and only shrink it if
         dropping it would push it below the crown's own underside. */
      const top = ceilY - clear;
      if (y + rad * squash > top) {
        y = Math.min(y, top - rad * squash);
        if (y < g + under * CN.underFloor) {
          y = g + under * CN.underFloor;
          rad = Math.max(CN.radiusFloor, (top - y) / squash);
        }
      }
      let px = it.x + dirX * reach + bx * crownR * CN.offsetFraction;
      let pz = it.z + dirZ * reach + bz * crownR * CN.offsetFraction;
      /* THE PRUNE, as a clearance and not as a lean. Reducing the inboard
         reach still let clumps stand 1.5 m inside the measured ring and clean
         through the curtain wall, because a lobe is a BODY: what has to clear
         the facade is its surface, not its centre. So every lobe is pushed
         out along the ring's own outward normal until its horizontal radius
         clears the outermost thing on that wall — the corner pier's face at
         wallStandoff + 0.14 — with 0.15 m to spare. Two passes, because
         sliding along one edge can bring a lobe up against the next. */
      const faceOut = section.facade.wallStandoff + D.pierProud + CN.lobeClear;
      const radH = Math.max(rad, rad * (CN.aspectMin + hash(seed, k, 6) * CN.aspectSpread));
      for (let pass = 0; pass < 2; pass++) {
        const c = ringClearance(section.ring, px, pz);
        const over = faceOut + radH - c.d;
        if (over > 0) { px += c.nx * over; pz += c.nz * over; }
      }
      const p = [px, y, pz];
      bin.lobes.push({
        x: p[0], y: p[1], z: p[2],
        rot: hash(seed, k, 5) * Math.PI * 2,
        scale: [rad, rad * squash, rad * (CN.aspectMin + hash(seed, k, 6) * CN.aspectSpread)],
        tone: CN.toneBase + hash(seed, k, 7) * CN.toneSpread,
      });
      /* A couple of clumps are carried on a visible limb run into the mass, so
         the canopy hangs off the tree instead of floating beside it. */
      if (c < CN.limbClumps) bin.limbs.push(limbTo(from, p));
    }
  });

  /* The tint is taken at the species' FIRST stem, so a species' bark and leaf
     are one material however many stems share it. */
  const named = (name, mesh) => { mesh.name = name; sub.add(mesh); return mesh; };
  let canopyLobes = 0;
  for (const [species, bin] of bins) {
    const first = T.items.find((i) => treeSpecies(i.x, i.z, i.h, i.r) === species);
    const tint = treeTint(species, first.x, first.z);
    const leafRgb = speciesColor(tint.leaf);
    const trunkRgb = speciesColor(tint.trunk);
    named(`galbraith-tree-boles-${species}`, instanced(
      new THREE.CylinderGeometry(CN.boleTop, CN.boleBottom, 1, 7),
      ctx.mats.bark(species, trunkRgb, [2, 8]), bin.boles, (i) => i));
    named(`galbraith-tree-limbs-${species}`, instanced(
      new THREE.CylinderGeometry(CN.limbTop, CN.limbBottom, 1, 5),
      ctx.mats.bark(species, trunkRgb, [1, 3]), bin.limbs, (i) => i));
    named(`galbraith-canopy-lobes-${species}`, instanced(
      lobeGeometry(), ctx.mats.leaf(leafRgb), bin.lobes, (i) => i));
    canopyLobes += bin.lobes.length;
  }

  group.add(sub);
  return { reskinnedTrees: T.items.length, canopyLobes };
}

/* ---------------------------------------------------------- the roofscape */

/**
 * The 9x9 skylight grid, the block rim, the three penthouses and the six mech
 * enclosures — all read off the repo's own Google orthophoto (section.roof).
 *
 * DATUM, and the reason nothing here is tall: LiDAR 16.6 is a MAXIMUM return
 * and campus-massing.js extrudes the whole footprint to it, so the drawn box
 * top already stands at the highest real point of this roof. The true low
 * deck is buried inside that box. Everything here therefore seats ON the box
 * top (`ctx.roofY` — the structure it stands on) and rises only curb-scale
 * above it; stacking the [estimated] 2 m block on top of 16.6 would
 * double-count the very metres the block explains. See roof.datumNote.
 */
function buildRoof(section, group, ctx) {
  const R = section.roof;
  if (!R) return { skylights: 0, penthouses: 0, mechUnits: 0 };
  const { colors } = section;
  const D = ctx.draw;
  const y0 = ctx.roofY;
  const roof = new THREE.Group();
  roof.name = "galbraith-roof";

  /* The skylight field: white-capped curbs on every second coffer, with a
     pale glass pane set into each. From directly above the caps are the
     brightest thing on this roof, which is exactly how the orthophoto reads. */
  const K = R.skylights;
  const [cx, cz] = K.centre;
  const cells = [];
  for (let i = 0; i < K.grid; i++) {
    for (let j = 0; j < K.grid; j++) {
      cells.push({
        x: cx + (i - (K.grid - 1) / 2) * K.pitch,
        z: cz + (j - (K.grid - 1) / 2) * K.pitch,
      });
    }
  }
  roof.add(instanced(
    new THREE.BoxGeometry(K.size, K.curb, K.size), ctx.mats.conc(colors.skylightCap, [1, 1]),
    cells, (c) => ({ x: c.x, y: y0 + K.curb / 2, z: c.z })
  ));
  const paneMesh = instanced(
    quad(K.size - K.glassInset * 2, K.size - K.glassInset * 2),
    ctx.mats.glass(colors.skylightGlass),
    cells, (c) => ({ x: c.x, y: y0 + K.curb - D.paneSink, z: c.z }), false
  );
  roof.add(paneMesh);

  /* The block rim and its dark reveal, as curb-scale relief on the box top. */
  const B = R.block;
  const rim = [];
  const reveal = [];
  const w = B.rim.width;
  const midX = (B.x0 + B.x1) / 2;
  const midZ = (B.z0 + B.z1) / 2;
  const lenX = B.x1 - B.x0;
  const lenZ = B.z1 - B.z0;
  for (const [x, z, sx, sz] of [
    [midX, B.z0 + w / 2, lenX, w], [midX, B.z1 - w / 2, lenX, w],
    [B.x0 + w / 2, midZ, w, lenZ - 2 * w], [B.x1 - w / 2, midZ, w, lenZ - 2 * w],
  ]) {
    rim.push({ x, y: y0 + B.rim.curb / 2, z, scale: [sx, B.rim.curb, sz] });
  }
  /* NORTH AND WEST ONLY. The previous revision ringed the block on all four
     sides and called the band a symmetric reveal; it is not symmetric in the
     orthophoto, it runs along the north and west edges alone, and that is the
     signature of a shadow cast by a south-east sun (roof.block.revealNote).
     Drawn on the two edges the frame actually shows it on. */
  const rw = B.reveal.width;
  for (const [x, z, sx, sz] of [
    [midX, B.z0 - rw / 2, lenX + 2 * rw, rw],
    [B.x0 - rw / 2, midZ, rw, lenZ],
  ]) {
    reveal.push({ x, y: y0 + D.revealThickness / 2, z, scale: [sx, D.revealThickness, sz] });
  }
  const unit = new THREE.BoxGeometry(1, 1, 1);
  roof.add(instanced(unit, ctx.mats.conc(colors.fascia, [8, 1]), rim, (it) => it, false));
  roof.add(instanced(unit, decalFree(colors.blockReveal), reveal, (it) => it, false));

  /* Penthouses: plan-exact, expression height only. The south one wears the
     pale seamed metal roof the orthophoto shows; the north pair are cream. */
  const boxes = (rects, h, matOf) => {
    for (const r of rects) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(r.x1 - r.x0, h, r.z1 - r.z0), matOf(r)
      );
      mesh.position.set((r.x0 + r.x1) / 2, y0 + h / 2, (r.z0 + r.z1) / 2);
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      roof.add(mesh);
    }
  };
  boxes(R.penthouses, R.penthouseExpression, (r) =>
    r.top === "penthouseMetal"
      ? ctx.mats.seam(colors.penthouseMetal, [6, 6])
      : ctx.mats.conc(colors.penthouseTop, [4, 4]));

  /* Mech enclosures: dark walls, pale equipment standing slightly proud. */
  boxes(R.mech, R.mechExpression, () => ctx.mats.conc(colors.mechWall, [4, 4]));
  const equip = R.mech.map((r) => ({
    x: (r.x0 + r.x1) / 2, y: y0 + R.mechExpression + D.equipLift, z: (r.z0 + r.z1) / 2,
    scale: [(r.x1 - r.x0) * D.equipFraction, D.equipHeight, (r.z1 - r.z0) * D.equipFraction],
  }));
  roof.add(instanced(unit, ctx.mats.conc(colors.mechEquip, [2, 2]), equip, (it) => it, false));

  group.add(roof);
  return {
    skylights: cells.length,
    penthouses: R.penthouses.length,
    mechUnits: R.mech.length,
  };
}

/* A plain matte colour for roof-top relief that needs no microstructure. */
function decalFree(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.97, metalness: 0.0 });
}

/* -------------------------------------------------- the east ground plane */

/**
 * The east ground, from the same orthophoto (section.east): the shaded recess
 * under the oversail, the full-length tan unit-paver walk, the colonnade foot
 * pads, the decomposed-granite band under the tree canopies, and the SE lawn.
 * Everything is a decal draped over the drawn terrain — nothing solid, so
 * the corridor gate has nothing new to hit. It STOPS at x 89: beyond x ~90
 * the current epoch is active construction and stays unbuilt (declared).
 */
function buildEastGround(section, group, ctx, frames) {
  const E = section.east;
  if (!E) return { eastRects: 0, eastPads: 0 };
  const { colors } = section;
  const D = ctx.draw;
  const ground = ctx.ground;
  const east = new THREE.Group();
  east.name = "galbraith-east-ground";

  let rects = 0;
  /* DRAPED, like buildGround's fields: the DG band rolls through 4 m of real
     relief on its way out to the tree line, and a flat quad seated at its
     centre is buried at the ridge and airborne at the building edge. */
  const flat = (list, color, rung, cls, tile) => {
    for (const r of list) {
      const w = r.x1 - r.x0;
      const d = r.z1 - r.z0;
      const mat = cls
        ? applyOverlayDepth(ctx.mats.lib.get(cls, {
            color,
            repeat: [Math.max(1, Math.round(w / tile)), Math.max(1, Math.round(d / tile))],
          }), rung)
        : decal(color, rung);
      const { geo, place } = drapedQuad(r, ground, overlayLift(rung), D.drapeSegment);
      const mesh = new THREE.Mesh(geo, mat);
      place(mesh);
      mesh.renderOrder = OVERLAY[rung].renderOrder;
      mesh.receiveShadow = true;
      east.add(mesh);
      rects++;
    }
  };

  flat(E.recess, colors.eastRecess, PAD, null);
  /* One library tile is 6 pavers, so a tile is six of the banding pitch. */
  flat(E.walk, colors.eastWalk, PAD, "pavingConcreteUnit", E.walkPitch * D.tiles.paverUnits);
  flat(E.dg, colors.eastDg, CARPET, "decomposedGranite", D.tiles.dg);
  /* The lawn rides one rung above the DG band it partly overlaps. */
  flat(E.lawn, colors.eastLawn, PAINT, null);

  /* The colonnade foot pads, drawn under the BUILT east strut pairs — pads on
     the orthophoto's raw 11-12 m rhythm would miss their own columns (the
     tension is recorded in east.footPadNote, not resolved here). */
  const face = section.faces.find((f) => f.id === "east");
  const frame = frames.get("east");
  const pads = [];
  for (const k of section.grid.pairIndices) {
    const u = frame.length / 2 + k * face.pairSpacing;
    /* At the FOOT station, not the head station: the shafts lean out-of-plane,
       so what shows past the roof edge on the ground is where they land, which
       is `splayHead` inboard of the strut line (see collectStruts). */
    const p = frame.at(u, section.facade.wallStandoff
      + section.column.standoffBuilt - section.column.splayHead, 0);
    pads.push({ x: p.x, z: p.z, rot: frame.rot });
  }
  const padMesh = instanced(
    quad(E.footPads.size, E.footPads.size),
    applyOverlayDepth(ctx.mats.conc(colors.footPad, [1, 1]), PAINT),
    pads, (p) => ({ x: p.x, y: ground(p.x, p.z) + overlayLift(PAINT), z: p.z, rot: p.rot }), false
  );
  padMesh.renderOrder = OVERLAY[PAINT].renderOrder;
  east.add(padMesh);

  group.add(east);
  return { eastRects: rects, eastPads: pads.length };
}

/* ------------------------------------------------------------------- api */

/**
 * Build Galbraith Hall's photo-sourced detail.
 *
 * `photo` is the loaded photo-detail document; this reads only its `galbraith`
 * section and returns `{ group, counts }` (empty and harmless if the section
 * is missing, so a half-wired boot still runs). `surfaceAt` — the height of
 * the DRAWN terrain triangle — seats everything that stands on the ground;
 * `heightAt` sets the roof datum, because that is what campus-massing.js used
 * to put the measured mass there and the two must not diverge by so much as a
 * coffer.
 */
export function createPhotoGalbraith(scene, { photo, heightAt, surfaceAt } = {}) {
  const group = new THREE.Group();
  group.name = "photo-galbraith";
  const section = photo?.galbraith;
  if (!section) {
    scene?.add(group);
    return { group, counts: {} };
  }
  const ground = surfaceAt || heightAt;
  const base = heightAt || surfaceAt;
  if (typeof ground !== "function" || typeof base !== "function") {
    throw new Error("campus-photo-galbraith: needs surfaceAt (or heightAt) to place on the ground");
  }
  /* The module and its section are ONE unit. Every metre this file draws with
     comes out of `draw`, `derivations.figures`, `estimates` or `reads`, and a
     pre-R1 section has none of them — so a stale document would not degrade,
     it would silently build a different building. Fail loudly and name the
     file that fixes it instead. */
  if (!section.draw || !section.faces?.[0]?.pairGap || !section.column?.standoffBuilt) {
    throw new Error(
      "campus-photo-galbraith: this builder needs the R1 galbraith section " +
      "(draw, per-face pairGap, column.standoffBuilt). Merge " +
      "Revelle-College-Sources/merge/r1/galbraith.json into docs/data/campus-photo-detail.json.");
  }

  /* Match campus-massing.js exactly: the mass sits on the MEDIAN ground under
     its ring, lifted if that would bury a high corner. Any other datum and
     every facade layer slides off the wall it hangs on. */
  const gs = section.ring.map(([x, z]) => base(x, z)).filter(Number.isFinite).sort((a, b) => a - b);
  const median = gs.length ? gs[Math.floor(gs.length / 2)] : 0;
  const highest = gs.length ? gs[gs.length - 1] : 0;
  const roofY = Math.max(median + section.measured.lidarHeight, highest);

  const LV = section.levels;
  const mats = makeMats();
  const ctx = {
    ground,
    mats,
    draw: section.draw,
    roofY,
    eavesY: roofY - LV.eavesBelowRoof,
    soffitY: roofY - LV.soffitBelowRoof,
    l2Y: roofY - LV.l2BelowRoof,
    l1Y: roofY - LV.l1BelowRoof,
  };
  const bins = {
    struts: [], brackets: [],
    dripCap: [], fascia: [], birdSpike: [], needles: [],
    cofferPan: [], ribAcross: [], ribAlong: [], ribBoss: [], solidStrip: [], downlight: [],
    glass: [], backing: [], mullion: [], spandrel: [], cornerPier: [],
    deck: [], redBand: [], picket: [], railCap: [],
    balconyPan: [], balconyRib: [],
    lowerColumn: [], lowerGlass: [], flutedWall: [], flute: [], doorBronze: [],
  };

  const frames = new Map();
  for (const f of section.faces) {
    const frame = frameOf(f);
    frames.set(f.id, frame);
    collectRoofEdge(section, f, frame, ctx, bins);
    collectSoffit(section, f, frame, ctx, bins);
    if (f.colonnade) collectStruts(section, f, frame, ctx, bins);
    if (f.glazing) collectGlazing(section, f, frame, ctx, bins);
    if (f.balcony && !f.terrace) collectDeck(section, f, frame, ctx, bins, section.facade.balcony, ctx.l2Y, null);
    if (f.terrace) {
      collectDeck(section, f, frame, ctx, bins, section.facade.terrace, ctx.l2Y,
        f.redBand ? section.facade.terrace.redBand : null);
    }
    if (f.lowerColonnade) collectLowerColonnade(section, f, frame, ctx, bins);
    if (f.flutedWall) collectFlutedWall(section, f, frame, ctx, bins);
  }
  collectCornerPiers(section, frames, ctx, bins);

  const { colors } = section;
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const plane = new THREE.PlaneGeometry(1, 1);
  const add = (geo, mat, items, shadow = true) => {
    if (items.length) group.add(instanced(geo, mat, items, (it) => it, shadow));
  };

  /* The soffit, from the recess back downward, so the pale rib grid always
     wins the depth test against the darker pan field behind it. */
  add(unit, mats.soff(colors.cofferPan, [32, 6]), bins.cofferPan);
  add(unit, mats.soff(colors.soffitRib, [24, 1]), bins.ribAcross);
  add(unit, mats.soff(colors.soffitRib, [24, 1]), bins.ribAlong);
  add(new THREE.CylinderGeometry(section.soffit.ribWidth / 2 + section.soffit.fillet,
    section.soffit.ribWidth / 2 + section.soffit.fillet, 1, section.soffit.filletSegments),
    mats.soff(colors.soffitRib, [1, 1]), bins.ribBoss, false);
  add(unit, mats.soff(colors.soffitRib, [24, 1]), bins.solidStrip);
  add(unit, mats.conc(colors.fascia, [24, 2]), bins.fascia);
  add(unit, metal(colors.dripCap), bins.dripCap);
  add(unit, mats.conc(colors.birdSpike, [24, 1]), bins.birdSpike);
  const wire = section.roofEdge.birdSpike.wire;
  add(new THREE.BoxGeometry(wire, 1, wire), metal(colors.birdSpike), bins.needles, false);
  add(new THREE.CylinderGeometry(section.soffit.lightRadius, section.soffit.lightRadius,
    section.soffit.lightHeight, 10), painted(colors.downlight), bins.downlight, false);

  /* The struts. One lathe per distinct height would be one geometry per
     column, so they share a unit-height lathe and take their height from the
     instance scale — the profile is preserved because the scale is uniform in
     the two horizontal axes and only stretches the vertical. */
  const strutGeo = strutGeometry(section.column.profile, 1);
  if (bins.struts.length) {
    group.add(instanced(strutGeo, mats.conc(colors.column, [2, 5]), bins.struts,
      (it) => ({ ...it, scale: [1, it.height, 1] })));
  }
  add(unit, mats.conc(colors.columnHead, [1, 1]), bins.brackets);

  add(unit, mats.conc(colors.fascia, [24, 1]), bins.spandrel);
  /* The curtain wall is near-opaque: every dated photograph reads it as a
     dark bronze SURFACE, and at the library's default 0.35 the measured
     massing texture behind it dominated on all four faces. depthWrite stays
     on so the pane also occludes rather than merely tints. */
  const curtain = { opacity: 0.94, depthWrite: true, roughness: 0.12 };
  /* Behind the panes first, so the glass has something of its own to be
     transparent against instead of the measured massing's window grid. */
  if (bins.backing.length) {
    const back = instanced(plane, decalFree(colors.glassLower), bins.backing, (it) => it, false);
    back.name = "galbraith-glass-backing";
    group.add(back);
  }
  add(plane, mats.glass(colors.glass, curtain), bins.glass);
  /* The end panels wear the curtain wall's own sampled bronze, opaque — a
     solid panel is the same bronze as the glass beside it, not a new colour. */
  if (bins.cornerPier.length) {
    const piers = instanced(unit, mats.panel(colors.glass, [3, 8]), bins.cornerPier, (it) => it);
    piers.name = "galbraith-corner-piers";
    group.add(piers);
  }
  add(unit, painted(colors.mullion), bins.mullion);
  add(unit, mats.conc(colors.deck, [24, 1]), bins.deck);
  /* The balcony's coffered underside: the darker pan field first, then the
     pale rib grid over it, so the ribs win the depth test the same way the
     great roof soffit's do. */
  add(unit, mats.soff(colors.cofferPan, [24, 2]), bins.balconyPan, false);
  add(unit, mats.soff(colors.soffitRib, [24, 1]), bins.balconyRib, false);
  add(unit, painted(colors.terraceRed), bins.redBand);
  add(unit, painted(colors.picket), bins.picket, false);
  add(unit, painted(colors.picket), bins.railCap, false);
  add(unit, mats.conc(colors.lowerColumn, [1, 2]), bins.lowerColumn);
  add(plane, mats.glass(colors.glassLower, curtain), bins.lowerGlass);
  /* The 1965 aggregate wall is the one board-formed surface on the building. */
  add(unit, mats.board(colors.flutedPanel), bins.flutedWall);
  add(unit, mats.conc(colors.flutedPanel, [1, 2]), bins.flute, false);
  add(unit, painted(colors.glassLower), bins.doorBronze);

  const north = section.faces.find((f) => f.entry);
  if (north) buildEntry(section, group, frames.get(north.id), north, ctx);
  const groundCounts = buildGround(section, group, ctx);
  const roofCounts = buildRoof(section, group, ctx);
  const eastCounts = buildEastGround(section, group, ctx, frames);
  const reskinCounts = buildTreeReskins(section, group, ctx);

  scene?.add(group);
  return {
    group,
    counts: {
      faces: section.faces.length,
      struts: bins.struts.length,
      cornerPiers: bins.cornerPier.length,
      glassBackings: bins.backing.length,
      coffers: bins.ribBoss.length,
      downlights: bins.downlight.length,
      pickets: bins.picket.length,
      lowerColumns: bins.lowerColumn.length,
      balconyRibs: bins.balconyRib.length,
      balconyPans: bins.balconyPan.length,
      northBeds: section.north.beds.length,
      ...groundCounts,
      ...roofCounts,
      ...eastCounts,
      ...reskinCounts,
      absent: section.absent.length,
      draws: group.children.length,
    },
  };
}
