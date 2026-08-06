// The buildings, from the university's own massing.
//
// Sources, in the order they are trusted:
//
//   campus-arcgis.json massing   UCSD facilities' extrusion polygons — one per
//                                MASS, so Sankofa is a 64 m tower + a mid + a
//                                base, not one slab. Current epoch.
//   campus-arcgis.json geiselFloors  Geisel per-floor polygons: the drum that
//                                steps out and back in. The only public vector
//                                source of the shape.
//   campus-3d.json buildings     OSM footprints — everything the facilities
//                                inventory does not track (hotels, apartments,
//                                the county's buildings at the campus edge).
//   campus-lidar.json heights    2014 aerial survey. Referee for everything
//                                built BEFORE it; blind to everything after
//                                (it "measures" Sankofa at parking-lot height).
//   campus-colors.json           NAIP aerial imagery: every roof's real colour.
//   campus-facades.json          Researched facade colours for the buildings
//                                students recognise; a stable palette elsewhere.
//
// Height per mass is an EPOCH RECONCILIATION: LiDAR ≈ GIS -> LiDAR (it is a
// measurement); GIS far taller -> GIS (built after the survey); LiDAR far
// taller -> LiDAR (the GIS record is a generic 14 ft placeholder — Peterson).
import * as THREE from "../vendor/three/three.module.min.js";

const STOREY = 3.6;
const BAY = 3.2;
/* Unnamed buildings pick from this family. Footage-corrected cooler: the
   campus's anonymous mid-rises are grey-white concrete and stucco, not the
   warm beiges of the first guess. */
const WALL_PALETTE = ["#d6d3ca", "#cbc9c0", "#dedcd4", "#c2c0b6", "#d0cec6", "#b9b7ae"];
/* Nearly every flat roof the drone saw is white TPO membrane; the truecolor
   pipeline usually answers, but the fallback must be white-family, not tan. */
const ROOF_FALLBACK = "#d9dbd5";

const hash = (x, z) => Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;

/* Measured roof colour, sampled at build time from the georeferenced satellite
   chunks — finer than NAIP, edge-eroded so walls and their shadows stay out of
   the median. Keys are geometry hashes (`m:`/`b:` + outer-ring vertex-average
   centroid, rounded to the metre) recomputed here, so the lookup survives a
   data rebuild and simply misses — falling back to the NAIP colour, then the
   palette — when a footprint moved. Keep the key rule in sync with
   scripts/build-campus-truecolor.mjs. The fetch itself lives in
   campus-truecolor.js because campus-world.js wants the same file. */
import { TRUECOLOR } from "./campus-truecolor.js";

/* TASTE GUARD (defence in depth — the build already clamps): keep any
   measured roof inside the site's palette family so one bad sample can never
   ship a neon roof. Mirrors GAMUT in build-campus-truecolor.mjs. */
function guardRoof(hex) {
  if (!hex) return null;
  const c = new THREE.Color(hex);
  const hsl = c.getHSL({});
  c.setHSL(hsl.h, Math.min(hsl.s, 0.55), Math.min(0.85, Math.max(0.2, hsl.l)));
  return `#${c.getHexString()}`;
}

/** Facade tiles, one per STYLE. The old single tile (horizontal window band)
    was wrong for most of what the walk route actually passes — four analysis
    agents independently flagged "vertical fins, not horizontal bands" for the
    brutalist spine. Each tile is drawn white-on-grey and MULTIPLIES the wall
    colour, so one texture serves every building of its style; UVs land one
    bay per BAY and one band per STOREY as before. Styles come from
    campus-facades.json `styles`; unknown/absent styles get the classic band. */
function makeTile(draw) {
  const S = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, S, S);
  draw(ctx, S);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1 / BAY, 1 / STOREY);
  tex.anisotropy = 4;
  return tex;
}

function facadeTiles() {
  return {
    /* The classic: one window band per storey, mullioned. */
    band: makeTile((ctx, S) => {
      ctx.fillStyle = "#8d97a1";
      ctx.fillRect(4, 14, S - 8, 30);
      ctx.fillStyle = "#ffffff";
      for (let x = 4; x < S - 4; x += 14) ctx.fillRect(x, 14, 4, 30);
      ctx.fillStyle = "rgba(0,0,0,0.16)";
      ctx.fillRect(0, 44, S, 5);
    }),
    /* Vertical concrete fins over recessed dark glass — AP&M, Tioga, Tenaya,
       Mandler, Muir Biology's louver bands. */
    fins: makeTile((ctx, S) => {
      ctx.fillStyle = "#5a626b";
      ctx.fillRect(0, 4, S, S - 10);
      ctx.fillStyle = "#ffffff";
      for (let x = 0; x < S; x += 8) ctx.fillRect(x, 4, 5, S - 10);
      ctx.fillStyle = "rgba(0,0,0,0.14)";
      ctx.fillRect(0, S - 6, S, 6);
    }),
    /* Deep egg-crate grid, dark cells, strong self-shadow — McGill,
       Galbraith. Reads ~40% darker than its base colour, as the footage
       measures. */
    eggcrate: makeTile((ctx, S) => {
      ctx.fillStyle = "#4e555c";
      ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = "#ffffff";
      for (let x = 0; x < S; x += 16) ctx.fillRect(x, 0, 6, S);
      for (let y = 0; y < S; y += 16) ctx.fillRect(0, y, S, 6);
    }),
    /* Full curtain wall: glass field, thin mullions. The wall colour IS the
       glass tone here (Tata, Franklin Antonio). */
    glass: makeTile((ctx, S) => {
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      for (let x = 0; x < S; x += 10) ctx.fillRect(x, 0, 1.5, S);
      ctx.fillRect(0, 30, S, 2);
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.fillRect(0, 0, S, 3);
    }),
    /* Continuous dark ribbon glazing between spandrels — Mayer/Bonner lab
       wings, CSE's panel field: a horizontal ribbon with no vertical
       divisions, distinct from punched windows. */
    ribbon: makeTile((ctx, S) => {
      ctx.fillStyle = "#4d4a44";
      ctx.fillRect(0, 16, S, 26);
      ctx.fillStyle = "rgba(0,0,0,0.1)";
      ctx.fillRect(0, 46, S, 4);
    }),
    /* Open-air balcony void per floor in a white frame — Seventh and
       Marshall towers, Urey's end slots. */
    balcony: makeTile((ctx, S) => {
      ctx.fillStyle = "#2e2c30";
      ctx.fillRect(8, 12, S - 16, 34);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillRect(8, 40, S - 16, 4); // rail line across the void
    }),
    /* Horizontal reveal lines, few or no windows — Peterson's banded blank
       panels, Price Center's stripe read at distance, Warren Lecture Hall. */
    bands: makeTile((ctx, S) => {
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(0, 20, S, 3);
      ctx.fillRect(0, 44, S, 5);
      ctx.fillStyle = "rgba(0,0,0,0.07)";
      ctx.fillRect(0, 0, S, 8);
    }),
    /* Near-featureless: board-formed concrete and service walls. */
    blank: makeTile((ctx, S) => {
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.fillRect(0, 30, S, 2);
    }),
  };
}

/* Geisel gets its own tile: the white fascia ribbon outlining every stepped
   tier over a sky-blue glass band over concrete — the single strongest
   modelling cue in the drone footage. Colours are baked (the material stays
   white) because no single wall colour can carry a three-tone facade. */
function geiselTexture(accents) {
  const S = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = accents?.glass || "#7e9fb1";
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = "rgba(20,24,28,0.25)";
  for (let x = 0; x < S; x += 9) ctx.fillRect(x, 8, 2, S - 16);
  ctx.fillStyle = accents?.trim || "#e8e9e2";
  ctx.fillRect(0, 0, S, 9); // the fascia ribbon at every tier edge
  ctx.fillStyle = "#b0aca2";
  ctx.fillRect(0, S - 7, S, 7); // concrete sill
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1 / BAY, 1 / STOREY);
  tex.anisotropy = 4;
  return tex;
}

const inRing = (x, z, ring) => {
  let ins = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
};

const centroidOf = (ring) => {
  let x = 0;
  let z = 0;
  for (const p of ring) { x += p[0]; z += p[1]; }
  return [x / ring.length, z / ring.length];
};

/** Absolute roof elevation for a mass: rim-median ground + measured height,
 *  never below the highest footprint ground. Exported so the readiness
 *  census and the epoch tests pin the same rule the extruder uses.
 *
 *  Why not centroid + h: the LiDAR builder defines h against the rim median,
 *  and on a grade those two bases diverge (Village West Building 2 sank
 *  3.0 m; Canyon Vista Administration rose 4.6 m; osm:893's high corner
 *  stood 0.6 m above its own roof).
 *
 *  Why the highest-ground floor: a FLAT extrusion cannot sit at the surveyed
 *  elevation when the uphill grade from the rim median exceeds h (Eckart's
 *  SIO bluff: 12.3 m of grade above the rim, 11.3 m of building). Lifting
 *  to the high corner keeps the mass out of its own hill — the forbidden
 *  failure mode outranks a one-metre absolute drift on a site the flat-slab
 *  model cannot describe. */
export function roofElevation(ring, h, heightAt) {
  let highest = -Infinity;
  const gs = [];
  for (const [x, z] of ring) {
    const g = heightAt(x, z);
    if (g != null && Number.isFinite(g)) {
      gs.push(g);
      if (g > highest) highest = g;
    }
  }
  let surveyed;
  if (gs.length) {
    gs.sort((a, b) => a - b);
    surveyed = gs[Math.floor(gs.length / 2)] + h;
  } else {
    const [cx, cz] = centroidOf(ring);
    surveyed = heightAt(cx, cz) + h;
  }
  if (highest > -Infinity && surveyed < highest) return highest;
  return surveyed;
}

/** Is this OSM ring already represented by the university's massing?
 *
 *  Centroid-in-one-ring alone is not enough: a courtyard building's centroid
 *  falls in the gap between the massing rings (Rya, Vela, Price Center all
 *  did), so its OSM copy rendered INSIDE the real massing. A ring counts as
 *  covered when its centroid sits in any massing ring OR a majority of its
 *  vertices do — the union test catches the courtyard cases without ever
 *  un-suppressing a building the centroid test already caught.
 *
 *  Both of those tests read POINTS, and a union outline defeats points: the
 *  SanGIS footprint for the Marshall Lower Apartments traces the shared
 *  edges of six massing rings, so its centroid lands in a breezeway and 82
 *  of its 166 vertices — 0.49, a coin flip on the exact boundary — resolve
 *  inside. It rendered as one 18 m monolith THROUGH the six residence halls
 *  it duplicates. So the third test reads AREA: sample the ring's interior
 *  on a grid, and if ≥85% of it is already massing, the massing already IS
 *  this building. The threshold is deliberately far above the courtyard
 *  cases (Student Center samples 0.69, Umoja 0.63 — both keep rendering);
 *  it exists to catch outlines that are nothing but other rings' union.
 *
 *  The area test also asks who keeps the NAME. Marshall's six massing rings
 *  stand centroid-inside the outline, so the host rename at the bottom of
 *  assembleMasses hands them its OSM name and suppression loses nothing.
 *  But seven named OSM buildings (Cala, Village East Building 4, One
 *  Miramar 3/4, ...) sample ≥0.85 under masses whose centroids fall
 *  OUTSIDE the ring — no mass inherits the name, and suppressing deletes
 *  the only ring that knows what the building is called. Identity comes
 *  from OSM and is not disposable, so the area test yields unless some
 *  covering mass will carry the name; the centroid and vertex-majority
 *  tests keep their existing behaviour. A mass also counts as carrying
 *  the name when it wears EXACTLY that name within 150 m (the LiDAR
 *  build's twin rule): the Student Services Center's facilities ring is
 *  drawn offset enough that its centroid misses the OSM ring, but it IS
 *  the building and says so — without this, SSC and CMRR each rendered
 *  twice. And a mass carries the name when it wears it as a word SUFFIX
 *  (r1c2 judge sweep, 2026-08-04): "Mesa Nueva - Cala" IS Cala and
 *  "Matthews Apartments E" IS E — the compound is the facilities record's
 *  spelling of the same identity. Cala rendered twice at the same 24.4 m
 *  (ring and mass, z-fighting), and Matthews D and E rendered once per
 *  source at two different heights, because the exact-name test could not
 *  see through the prefix. The ≥0.85 area test still has to pass, so a
 *  stray suffix match cannot suppress a building its masses don't cover.
 *
 *  An UNNAMED ring gets a lower area floor, 0.5 (r2c1 judge sweep,
 *  2026-08-05). The 0.85 bar is high because suppression can delete the
 *  only ring that knows a building's name — but an unnamed ring has no
 *  identity to lose, only geometry the massing already renders. osm:718
 *  sampled 0.78 under the Satellite Utility Plant's record ring and
 *  extruded through it wearing a 9 m area guess; osm:359 is an unnamed
 *  re-trace of Mesa Apartments Central 9236 sampling 0.52 over the
 *  university's own 6.1 m mass, z-fighting it at 8.4. Half-covered
 *  matches the vertex-majority bar the named path already uses. */
const ringCoveredBy = (ring, coveredRings, nameCarried = true, unnamed = false) => {
  const inAny = (x, z) => coveredRings.some((r) => inRing(x, z, r));
  const [cx, cz] = centroidOf(ring);
  if (inAny(cx, cz)) return true;
  let inside = 0;
  for (const [x, z] of ring) if (inAny(x, z)) inside++;
  if (inside / ring.length > 0.5) return true;
  if (!nameCarried) return false;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, z] of ring) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (z < z0) z0 = z;
    if (z > z1) z1 = z;
  }
  const step = Math.max(2, Math.min((x1 - x0) / 24, (z1 - z0) / 24));
  let interior = 0;
  let covered = 0;
  for (let x = x0 + step / 2; x < x1; x += step) {
    for (let z = z0 + step / 2; z < z1; z += step) {
      if (!inRing(x, z, ring)) continue;
      interior++;
      if (inAny(x, z)) covered++;
    }
  }
  return interior >= 20 && covered / interior >= (unnamed ? 0.5 : 0.85);
};

/* LiDAR ≈ GIS -> the measurement wins; either far taller -> see header. */
function reconcile(gisH, lidarH) {
  if (!lidarH) return gisH;
  if (!gisH) return lidarH;
  const gap = Math.max(8, 0.45 * Math.min(gisH, lidarH));
  if (Math.abs(gisH - lidarH) <= gap) return lidarH;
  return Math.max(gisH, lidarH) === gisH ? gisH : lidarH;
}

/**
 * Assemble the full mass list — the university's massing first, then every
 * OSM building (or building part) the massing does not already represent.
 * Pure data, no THREE: the tests run this in Node against the shipped files.
 */
export function assembleMasses({ campus, lidar, arcgis, colors }) {
  const masses = [];
  const covered = []; // massing rings, to suppress the OSM copy underneath

  /* -------- 1. facilities massing parts (primary) -------- */
  const gis = arcgis?.massing || [];
  gis.forEach((m, i) => {
    const rings = m.r.map((ring) => ring.map(([x, z]) => [x / 10, z / 10]));
    covered.push(rings[0]);
    masses.push({
      rings,
      name: m.n,
      gisH: m.h,
      levels: m.levels,
      roof: colors?.massing?.[i] || null,
      src: "gis",
    });
  });

  /* -------- 2. OSM buildings the inventory does not cover -------- */
  /* Geisel renders from its own per-floor GIS layer. Alianza and Umoja are
     OSM outer OUTLINES around whole residential quads — courtyards, stairs
     and gaps included — while the facilities masses trace the individual
     wings; extruding the outline through its own courtyards would be a
     solid block no one measured, so the wings render and the outline does
     not. The RIMAC Annex ring outlines the 2014 building demolished for a
     rebuild Apple shows as bare decks and a tower crane (2026-08-04) — no
     source resolves the rising frame, so the site stays unbuilt.
     Tuolumne Apartments is the same outline problem as Alianza/Umoja
     (r1c0 sweep, 2026-08-04): one concave OSM ring around the whole 2003
     complex, extruded at a whole-ring 17.3 m through nine facilities
     masses that measure 9.3-16.2 individually — the T-house wings rendered
     twice, once at their own plane and once inside a block 4 m taller.
     The masses render; the outline does not.

     WING-PREFIX OUTLINES (r0c1 pass-3, 2026-08-05). ringCoveredBy's ≥0.85
     area floor is deliberately above courtyard cases so a ring whose
     covering masses do not carry its name is not deleted — but when the
     facilities inventory already traces the wings under compound names
     that START WITH the OSM name ("Geneva Hall West"/"East", "Student
     Center A - Building C", "Mesa Verde Hall North"/"South"), the outline
     is the same Alianza/Umoja hull: nameCarried is true (wing centroids
     sit inside), coverage lands ~0.69–0.77 under the courtyard, and the
     outline extrudes solid air Apple shows as plaza/planting. Detect that
     class by counting ≥2 GIS wing centroids inside the ring whose names
     are the OSM name plus a space/" - " suffix — no hand list of halls.
     Alianza/Umoja stay in skipOsm: their GIS names are "RWNLLN …", not
     a prefix of the OSM name, so the detector cannot see them. */
  const skipOsm = new Set([
    "Geisel Library", "Alianza", "Umoja", "RIMAC Annex",
    "Tuolumne Apartments",
  ]);
  const isWingPrefix = (gisName, osmName) => {
    const g = gisName.toLowerCase();
    const o = osmName.toLowerCase();
    return g.startsWith(`${o} `) || g.startsWith(`${o} - `) || g.startsWith(`${o}-`);
  };
  /* Demolition sites whose OSM ring has NO name to key skipOsm skip by
     footprint anchor instead, the same convention the build scripts use
     for phantom rings. (1416, -1299): the Campus Point service building
     Apple shows mid-demolition — roof torn open, excavators on the slab
     (r0c2 sweep, 2026-08-04). The 2014 building is going; nothing about
     its replacement resolves to gate. Better absent than wrong.
     (545.3, 48.3) and (374.4, -88.3) (r1c1 judge sweep, 2026-08-04): two
     one-storey buildings the 2014 flight measured as clean planes (4.9
     and 5.0 m) that are simply gone. The first is a Triton Center
     predecessor — bare graded dirt on the registered chunk, a staging
     pad with trailers on today's Apple, the new frames rising beside it
     in Street View 2025-02. The second razed for the dig south of the
     Chancellor's Complex — staging on the chunk, a flat pad on Apple.
     Their rings survive in OSM and wore 12 and 9 m area guesses; a ring
     whose building was demolished renders nothing, whatever OSM says.
     r1c1 re-sweep (2026-08-05), three more unnamed phantoms:
     (404.0, -65.6) — osm:759, a third demolished pad in the same
     Chancellor's / Powell dig (Apple: bare graded dirt, staging
     trailers immediately south; 2014 had a tight 6–7 m plane).
     (734.5, -100.4) — osm:840 (+ osm:898 within 12 m), unnamed rings
     over the Epstein Family Amphitheater / PCW plaza fringe. Epstein
     is POST_2014 (opened 2022); the 2014 returns are grove/scatter
     (massOk=false). Extruding a 9 m guess invents a hall on a bowl.
     (87.6, 265.4) — osm:917 (+ osm:918 within 12 m), Mayer Hall's
     six-hexagon elevated pedestrian connector. Apple and 2014 both
     see the deck (~15 m), but a solid extrusion fills the air under
     the hex modules. Better absent than a filled bridge.
     r1c1 pass-2 (2026-08-05), two more unnamed false buildings:
     (840.9, 452.2) — osm:438, a 7,240 m² ring wearing a 20 m area
     guess over the Villa La Jolla Drive parking amenity. Fresh EPT:
     14,113 returns, mode at grade, guarded roofOf 4.0; Apple centre
     is grey pavement (Nominatim class=parking). Not a hall.
     (−106.8, 475.2) — osm:1127, a 63 m² SanGIS building=yes ring on
     Revelle Plaza where Nominatim / Apple place the Revelle Anchor
     outdoor sculpture. Better absent than a solid box on the plaza.
     r1c2 pass-2 (2026-08-05): (1002.8, −112.3) — osm:834, the OSM
     twin of the GIS "Foodworx Dining Room" already dropped by
     NO_SOLID_ROOF. Fresh EPT: 1,055 returns, 90.7% in −1..0 m; Apple
     shows the west patio umbrellas, not a dining-room box. The GIS
     removal left this 4.5 m area-guess extrusion standing 3.4 m from
     the withheld pad. Better absent than the same patio twice. */
  const skipOsmAnchors = [
    [1416, -1299], [545.3, 48.3], [374.4, -88.3],
    [404.0, -65.6], [734.5, -100.4], [87.6, 265.4],
    [840.9, 452.2], [-106.8, 475.2],
    [1002.8, -112.3],
  ];
  /* Building indices whose ring (or any part) stands in the world — the
     host rename below must know, because a name may only move onto the
     massing when its own ring does NOT render (r2c1 judge sweep). */
  const renderedOsm = new Set();
  const gisCentroids = covered.map((r) => centroidOf(r));
  /* Case-folded twin index (r1c2 re-sweep, 2026-08-05): OSM and the
     facilities inventory disagree on capitalisation for the same identity
     ("One Miramar Street, building 3" vs "Building 3"). An exact-string
     map missed those twins, the ≥0.85 area test never ran, and both
     sources extruded the same pad. Matching ignores case; the rename
     below still prefers OSM's spelling as the name a student uses. */
  const namesEqual = (a, b) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
  const gisNameCentroids = new Map();
  gis.forEach((m, i) => {
    if (!m.n) return;
    const key = m.n.toLowerCase();
    if (!gisNameCentroids.has(key)) gisNameCentroids.set(key, []);
    gisNameCentroids.get(key).push(gisCentroids[i]);
  });
  campus.buildings.forEach((b, i) => {
    if (b.n && skipOsm.has(b.n)) return;
    /* Wing-prefix outline: ≥2 facilities masses whose names are the OSM
       name plus a directional/compound suffix already stand inside this
       ring — the outline is their hull, not a building. Geneva Hall's
       West/East pair and the Student Center A wings are the exemplars;
       ringCoveredBy leaves them alone because the courtyard keeps area
       coverage under 0.85. */
    if (b.n) {
      let wings = 0;
      for (let gi = 0; gi < gis.length; gi++) {
        const gn = gis[gi].n;
        if (!gn || !isWingPrefix(gn, b.n)) continue;
        if (inRing(gisCentroids[gi][0], gisCentroids[gi][1], b.p)) wings++;
        if (wings >= 2) break;
      }
      if (wings >= 2) return;
    }
    if (!b.n) {
      const [cx, cz] = centroidOf(b.p);
      if (skipOsmAnchors.some(([ax, az]) => Math.hypot(cx - ax, cz - az) < 12)) return;
    }
    /* A name is carried when a mass centroid stands inside the ring — or
       when a mass wearing EXACTLY this name stands within 150 m, the same
       twin rule the LiDAR build uses to key epoch guards. The facilities
       ring for the Student Services Center is drawn offset enough that
       its centroid misses the OSM ring (CMRR too), so the name test
       failed, the ≥0.85 area test never ran, and both rendered twice —
       the OSM copy extruded through the massing that already IS the
       building and already SAYS its name. Case is not identity: One
       Miramar 3/4 failed the exact-string form of this test while
       sampling ≥0.85 under their GIS twins. */
    const [bcx, bcz] = centroidOf(b.p);
    const nameCarried = !b.n ||
      gisCentroids.some(([x, z]) => inRing(x, z, b.p)) ||
      (gisNameCentroids.get(b.n.toLowerCase()) || []).some(([x, z]) => Math.hypot(x - bcx, z - bcz) < 150) ||
      gis.some((m, gi) => m.n && !namesEqual(m.n, b.n) &&
        (m.n.toLowerCase().endsWith(` - ${b.n.toLowerCase()}`) ||
          m.n.toLowerCase().endsWith(` ${b.n.toLowerCase()}`)) &&
        Math.hypot(gisCentroids[gi][0] - bcx, gisCentroids[gi][1] - bcz) < 150);
    const fac = arcgis?.buildings?.[b.n];
    /* The per-index measurement outranks the name key: a duplicate OSM name
       (two "Spinal Cord Injury Building" rings, both Earth Halls, both Salk
       wings) shares one lidar.heights slot, so the build emits collided
       names per ring index — each footprint wears its own roof plane.
       Unnamed rings were always index-keyed (partHeights' own coupling). */
    const lidarH = lidar.osmHeights?.[i] ?? (b.n ? lidar.heights[b.n] : null);
    /* Parts keep their ORIGINAL index: lidar.partHeights is keyed by it, and
       filtering first shifted every part after a dropped one onto the wrong
       measured height (Tapestry's second part resolved undefined). */
    const parts = (b.parts || [])
      .map((part, pi) => ({ part, pi }))
      .filter(({ part, pi }) => lidar.partHeights?.[`${i}/${pi}`] || part.h);
    if ((b.parts || []).length >= 2 && parts.length >= 1) {
      /* Suppression is per PART here — the parts are what renders. Rya and
         Vela's outer-ring centroids fall in the paseo between the towers, but
         every part-box sits ON the university's PCW massing and must yield.
         lidarDone: a part's height IS its own measurement (or its own OSM
         tag) — reconciling it against the whole building's number pasted the
         VA Medical Center tower's 33.7 m onto all five of its low pavilions
         (measured 6.6-27.4 m). Steps have to step.
         The gate reads the RAW part count (r1c1 judge sweep, 2026-08-04):
         Vela is modelled as two parts, but only the tower box carries a
         height — the podium part is untagged and, being post-2014, has no
         partHeights entry — and counting the FILTERED list flipped the
         whole building onto the outline path: a 19 m slab through the
         paseo and both towers the PCW massing already renders. A
         part-modelled building renders as parts; its outline is a hull,
         not a building. Only when NO part survives (Tapestry, Catalyst,
         Kaleidoscope — post-2014, nothing tagged) does the outline remain
         the sole geometry there is, and the fallback below keeps it. */
      for (const { part, pi } of parts) {
        if (ringCoveredBy(part.p, covered, nameCarried, !b.n)) continue;
        renderedOsm.add(i);
        masses.push({
          rings: [part.p],
          name: b.n || null,
          gisH: lidar.partHeights?.[`${i}/${pi}`] ?? part.h,
          lidarDone: true,
          levels: null,
          roof: colors?.buildings?.[i] || null,
          src: "osm",
        });
      }
      return;
    }
    if (ringCoveredBy(b.p, covered, nameCarried, !b.n)) return;
    renderedOsm.add(i);
    masses.push({
      rings: [b.p],
      name: b.n || null,
      gisH: fac?.newer ? fac.height : (lidarH ?? fac?.height ?? b.h),
      lidarDone: true, // height above is already reconciled for OSM entries
      levels: fac?.levels ?? null,
      roof: colors?.buildings?.[i] || null,
      src: "osm",
    });
  });

  /* Reconcile massing-part heights against the LiDAR, and label each mass by
     the name a STUDENT uses: the OSM building it stands inside ("Sankofa",
     "Vela"), not the facilities code ("TDLLN - Sankofa Tower").

     The measurement is per MASS where the survey could answer per mass:
     lidar.massHeights carries each massing ring's own 2014 roof plane, keyed
     by the same geometry hash the truecolor lookup uses, and epoch-guarded at
     build time (a post-2014 host emits nothing). Where it exists it IS the
     height — reconciling per host pasted Urey Hall's 30.5 m tower onto its
     12.2 m office addition and the Main Gym's 14.9 onto the 8.4 m Natatorium.
     Where it does not (sliver masses, unnamed hosts, post-2014 sites), the
     host-level reconcile stands as before. */
  const namedRings = campus.buildings
    .map((b, i) => ({ n: b.n, p: b.p, i }))
    .filter((b) => b.n);
  /* The rename is guarded (r1c2 judge sweep, 2026-08-04). Handing a mass its
     host ring's OSM name is right almost everywhere — including when one
     union outline hands its name to six wings at once (Marshall Lower
     Apartments), which must keep working. But the OSM ring over the Pepper
     Canyon Apartments 1300 block is drawn wearing the Assistant Dean's
     Residence's name, while the REAL residence, a small house 38 m west, is
     its own GIS mass already wearing that name in the university's record.
     The rename put the Dean's label on two buildings at once and orphaned
     the apartments' name — which then landed on the LAUNDRY through a
     second mis-drawn ring, taking the facades keyed by it along. So: a
     rename is refused when the university's record says the target name is
     a DIFFERENT nearby building — another mass within 150 m whose own GIS
     name is exactly the wanted name and which is not itself renamed away.
     "Renamed away" iterates to a fixpoint (the apartments must keep their
     name before the laundry's claim on it can be judged), and the carrier
     set only grows, so the fixpoint is order-independent. A symmetric swap
     like Meteor/Galathea — each GIS mass standing in the other's OSM ring,
     no third party — still swaps: each name's GIS carrier is renamed away
     by the opposite ring, OSM being the name authority. An identity rename
     (the real Spanos Athletic Performance Center standing in its own ring)
     never cancels, and is exactly what blocks the neighbouring training
     facility from taking the same name.

     And the rename only fires INTO a suppressed ring (r2c1 judge sweep,
     2026-08-05). Its whole purpose is that suppression must lose nothing:
     a covered ring's name moves onto the massing that renders in its
     place. When the host ring RENDERS — the OSM Forum ring stands as its
     own mass now that the record's union rings are dropped — handing its
     name to a record mass inside it says the building exists twice. The
     university's "James' Place" sits centroid-inside that Forum ring and
     must keep saying so; the height reconcile through the host is
     untouched, names only. */
  for (const m of masses) {
    if (m.lidarDone) continue;
    const [cx, cz] = centroidOf(m.rings[0]);
    m._c = [cx, cz];
    m._host = namedRings.find((b) => inRing(cx, cz, b.p)) ?? null;
    /* A mass wearing a ring's name as its word suffix hosts that ring's
       IDENTITY even when the ring's centroid misses: the suffix rule above
       suppresses OSM's "Cala" under "Mesa Nueva - Cala", and the mass must
       then say "Cala" — the name a student uses, and the key the researched
       facades ride — or the suppression orphans both. Name ONLY: the ring
       may trace just part of the mass's footprint (Spiess Hall's ring under
       the Fred N. Spiess Hall mass), so its plane must not smear onto the
       whole mass through the host reconcile. Bare letters stay letters-out:
       "Matthews Apartments E" does not become "E". Proximity is the same
       150 m twin rule the exact-name tests ride — containment cannot work
       here, because a courtyard ring's centroid falls in its own courtyard
       (Cala's does, the same trick Rya and Vela play on the centroid test
       above). */
    if (!m._host && m.name) {
      /* Case-insensitive exact twin: GIS "Building 3" IS OSM "building 3"
         within 150 m. Take the OSM spelling so suppression does not orphan
         the name the student (and the orphan test) look for. */
      const caseTwin = namedRings.find((b) => {
        if (!namesEqual(b.n, m.name) || b.n === m.name) return false;
        const [rcx, rcz] = centroidOf(b.p);
        return Math.hypot(rcx - m._c[0], rcz - m._c[1]) < 150;
      });
      if (caseTwin) { m._host = caseTwin; m._hostNameOnly = true; }
      else {
        const nameHost = namedRings.find((b) => {
          if (b.n.length < 3 || namesEqual(b.n, m.name)) return false;
          const ml = m.name.toLowerCase();
          const bl = b.n.toLowerCase();
          if (!ml.endsWith(` - ${bl}`) && !ml.endsWith(` ${bl}`)) return false;
          const [rcx, rcz] = centroidOf(b.p);
          return Math.hypot(rcx - m._c[0], rcz - m._c[1]) < 150;
        });
        if (nameHost) { m._host = nameHost; m._hostNameOnly = true; }
      }
    }
  }
  for (let settled = false; !settled;) {
    settled = true;
    for (const m of masses) {
      if (m.lidarDone || !m._host || m._host.n === m.name) continue;
      const wanted = m._host.n;
      const dup = masses.some((o) => o !== m && !o.lidarDone &&
        o.name === wanted && (!o._host || o._host.n === wanted) &&
        Math.hypot(o._c[0] - m._c[0], o._c[1] - m._c[1]) < 150);
      if (dup) { m._host = null; settled = false; }
    }
  }
  for (const m of masses) {
    if (m.lidarDone) continue;
    const host = m._host;
    const heightHost = host && !m._hostNameOnly ? host : null;
    const own = m.src === "gis" ? lidar.massHeights?.[`m:${Math.round(m._c[0])},${Math.round(m._c[1])}`] : undefined;
    m.h = own ?? reconcile(m.gisH, heightHost ? lidar.heights[heightHost.n] ?? lidar.osmHeights?.[heightHost.i] ?? null : null);
    /* A one- or two-character host name whose fuller form the mass already
       wears stays with the mass: "Matthews Apartments A" must not flatten
       to OSM's bare parcel letter "A". */
    const letter = host && m.name && host.n.length <= 2 &&
      (m.name.endsWith(` ${host.n}`) || m.name.endsWith(` - ${host.n}`));
    if (host && !letter && !renderedOsm.has(host.i)) m.name = host.n;
    delete m._c;
    delete m._host;
    delete m._hostNameOnly;
  }
  for (const m of masses) if (m.h === undefined) m.h = m.gisH;

  /* Wayfinding pins are published from OSM building centroids in
     build-campus-3d.mjs — before this function knows which rings will
     actually render. An oversized OSM union outline (Environmental
     Management Facility, Electric Shop) has its centroid inside a
     neighbour's GIS pad; ringCoveredBy suppresses the outline, the GIS
     mass that already wears the name renders 40–80 m away, and
     nearestPlace / teleport / search still name the neighbour. When the
     OSM ring for a name did not render but a mass now carries that name,
     the place pin moves onto the (tallest) mass. Pure swaps
     (Meteor/Galathea) land on the post-rename mass, which is the same
     footprint the OSM centroid already marked — a no-op to the metre.
     Seeded / surface / path anchors are untouched: they have no OSM
     building ring to suppress. */
  reanchorPlacesToMasses(campus, masses);
  return masses;
}

/**
 * Move campus.places[N] onto the rendered mass named N whenever the OSM
 * ring that originally published the pin was suppressed. Mutates
 * campus.places in place; safe to call more than once.
 */
export function reanchorPlacesToMasses(campus, masses) {
  if (!campus?.places || !masses?.length) return;
  const byName = new Map();
  for (const m of masses) {
    if (!m.name || !m.rings?.[0]) continue;
    const [cx, cz] = centroidOf(m.rings[0]);
    const prev = byName.get(m.name);
    if (!prev || (m.h ?? 0) > prev.h) byName.set(m.name, { x: cx, z: cz, h: m.h ?? 0 });
  }
  const osmRenders = new Set();
  for (const m of masses) {
    if (m.src === "osm" && m.name) osmRenders.add(m.name);
  }
  const round1 = (v) => Math.round(v * 10) / 10;
  for (const b of campus.buildings) {
    if (!b.n || !campus.places[b.n]) continue;
    if (osmRenders.has(b.n)) continue;
    const hit = byName.get(b.n);
    if (!hit) continue;
    campus.places[b.n] = { x: round1(hit.x), z: round1(hit.z) };
  }
}

/**
 * Assemble the full mass list, then extrude every mass into per-material
 * buckets and merge — ~1,500 masses render as ~1,080 draw calls rather than one
 * per mass. (This comment said "a few dozen" for a long time. That was true
 * before the merge was chunked by 500 m for frustum culling, which multiplies
 * the bucket count by the number of occupied chunks; the trade was worth it,
 * but the number in the docstring was not re-measured.)
 *
 * Returns { group, info, roofs, masses, drawCalls }:
 *   info   building name -> { x, z, topY, h, ring }, for labels and callouts.
 *          Keyed by NAME, so it holds only the tallest mass per name.
 *   roofs  EVERY mass that got built, as { topY, ring } — see below.
 */
export function createBuildings(scene, { campus, lidar, arcgis, colors, facades, heightAt }) {
  /* assembleMasses also reanchors campus.places onto rendered masses when
     an OSM outline was suppressed — nearestPlace reads those pins. */
  const masses = assembleMasses({ campus, lidar, arcgis, colors });

  /* facades is the whole campus-facades.json object; older callers/tests may
     still hand in the flat walls map, which keeps working. */
  const walls = facades?.walls || facades || {};
  const styles = facades?.styles || {};
  const accents = facades?.accents || {};

  /* Geisel's floor stack renders separately below. */
  const geisel = arcgis?.geiselFloors || [];
  const geiselPlace = campus.places["Geisel Library"];

  /* -------- extrude into merged material buckets -------- */
  const tiles = facadeTiles();
  const wallMats = new Map(); // `${wallHex}|${style}` -> material
  const buckets = new Map(); // wallHex|roofHex|style|chunk -> { lids: [], walls: [] }
  const q = (hex) => { // quantise roofs so buckets stay few
    if (!hex) return ROOF_FALLBACK;
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 0xff;
    const g = (n >> 8) & 0xff;
    const b = n & 0xff;
    const s = (v) => Math.min(255, Math.round(v / 24) * 24);
    return `#${((s(r) << 16) | (s(g) << 8) | s(b)).toString(16).padStart(6, "0")}`;
  };

  const info = new Map();
  /* Every mass that gets built, roof height and footprint, for the clearance
     sampler that scales free roam's climb rate (campus-clearance.js).
     `info` cannot serve that: it is keyed by NAME and keeps only the tallest
     mass per name, which is 479 of the ~1,490 masses. Sampled through it, the
     camera two metres over an unnamed podium wing measured its clearance to the
     GROUND thirty metres below and climbed at thirty metres a second — fast
     exactly where the control has to be slow. Labels want one entry per name;
     a rate governor wants every roof. */
  const roofs = [];
  let built = 0;
  for (const m of masses) {
    const outer = m.rings[0];
    if (!outer || outer.length < 3) continue;
    let lowest = Infinity;
    for (const [x, z] of outer) lowest = Math.min(lowest, heightAt(x, z));
    const [cx, cz] = centroidOf(outer);
    /* Roof sits at rimMedian + h — matching how h was measured — never
       below the highest footprint ground. See roofElevation. */
    const roofY = roofElevation(outer, m.h, heightAt);
    const baseY = lowest - 1.5;
    const depth = Math.max(1, roofY - baseY);

    const shape = new THREE.Shape();
    shape.moveTo(outer[0][0], outer[0][1]);
    for (let i = 1; i < outer.length; i++) shape.lineTo(outer[i][0], outer[i][1]);
    shape.closePath();
    for (const holeRing of m.rings.slice(1)) {
      const hole = new THREE.Path();
      hole.moveTo(holeRing[0][0], holeRing[0][1]);
      for (let i = 1; i < holeRing.length; i++) hole.lineTo(holeRing[i][0], holeRing[i][1]);
      hole.closePath();
      shape.holes.push(hole);
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    geo.rotateX(Math.PI / 2);
    geo.translate(0, baseY + depth, 0);

    /* Floor lines at the real storey spacing where the university said how
       many floors this mass has. */
    if (m.levels) {
      const scaleV = STOREY / (m.h / m.levels);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * scaleV);
    }

    /* Roof: measured truecolor by geometry key first, NAIP second, palette
       last. Walls stay palette-derived — imagery cannot see a wall — but
       tint gently toward the measured roof so a mass reads as one building.
       The tint is a pure function of (wall pick, quantised roof), so the
       bucket count cannot grow. */
    const trueRoof = guardRoof(
      TRUECOLOR?.roofs?.[`${m.src === "gis" ? "m" : "b"}:${Math.round(cx)},${Math.round(cz)}`]
    );
    const roofHex = q(accents[m.name]?.roof || trueRoof || m.roof);
    let wallHex = walls[m.name] || WALL_PALETTE[Math.floor(hash(outer[0][0], outer[0][1]) * WALL_PALETTE.length)];
    if (trueRoof && !walls[m.name]) {
      wallHex = `#${new THREE.Color(wallHex).lerp(new THREE.Color(roofHex), 0.12).getHexString()}`;
    }
    const style = styles[m.name] || "band";
    /* Chunked by 500 m so buildings behind the camera or past the fog can be
       culled — one campus-wide merge drew every building every frame. */
    const key = `${wallHex}|${roofHex}|${style}|${Math.floor(cx / 500)}:${Math.floor(cz / 500)}`;
    if (!buckets.has(key)) buckets.set(key, { lids: [], walls: [] });
    splitIntoBucket(geo, buckets.get(key));
    roofs.push({ topY: roofY, ring: outer });
    built++;

    if (m.name) {
      const prev = info.get(m.name);
      if (!prev || roofY > prev.topY) {
        /* The ring rides along so roof-mounted landmarks (Fallen Star) can
           find an exact corner of the mass they perch on. */
        info.set(m.name, { x: cx, z: cz, topY: roofY, h: m.h, ring: outer });
      }
    }
  }

  /* Geisel: stack the real floors on the real forecourt grade. The walls ride
     the dedicated three-tone tile (white fascia / glass band / concrete), so
     the material colour stays white and the roof is the measured deck grey. */
  if (geisel.length && geiselPlace) {
    const base = heightAt(geiselPlace.x, geiselPlace.z);
    const bucketKey = `#ffffff|${q(accents["Geisel Library"]?.roof || "#9c9488")}|geisel|0:0`;
    if (!buckets.has(bucketKey)) buckets.set(bucketKey, { lids: [], walls: [] });
    const bucket = buckets.get(bucketKey);
    let top = base;
    let topRing = null;
    for (const floor of geisel) {
      const shape = new THREE.Shape();
      const ring = floor.rings[0].map(([x, z]) => [x / 10, z / 10]);
      shape.moveTo(ring[0][0], ring[0][1]);
      for (let i = 1; i < ring.length; i++) shape.lineTo(ring[i][0], ring[i][1]);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: floor.h, bevelEnabled: false });
      geo.rotateX(Math.PI / 2);
      geo.translate(0, base + floor.from + floor.h, 0);
      /* One band per floor slab: concrete lip over glass, which is what the
         drum actually reads as. */
      const uv = geo.attributes.uv;
      const scaleV = STOREY / floor.h;
      for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * scaleV);
      splitIntoBucket(geo, bucket);
      const floorTop = base + floor.from + floor.h;
      if (floorTop >= top) { top = floorTop; topRing = ring; }
    }
    info.set("Geisel Library", { x: geiselPlace.x, z: geiselPlace.z, topY: top, h: Math.round((top - base) * 10) / 10 });
    /* Geisel's info entry deliberately carries no ring — its floors are stacked
       separately, so there is no single outer footprint for a label to point at.
       The clearance sampler does need one, and the top floor's slab is the deck
       you would actually be hovering over. Without this, the one building on
       campus people most want to fly around was a hole in the roof map. */
    if (topRing) roofs.push({ topY: top, ring: topRing });
    built++;
  }

  const group = new THREE.Group();
  const roofMats = new Map();
  for (const [key, bucket] of buckets) {
    const [wallHex, roofHex, style] = key.split("|"); // fourth segment is the spatial chunk
    const matKey = `${wallHex}|${style}`;
    if (!wallMats.has(matKey)) {
      const map = style === "geisel"
        ? geiselTexture(accents["Geisel Library"])
        : tiles[style] || tiles.band;
      wallMats.set(matKey, new THREE.MeshLambertMaterial({ color: new THREE.Color(wallHex), map }));
    }
    if (!roofMats.has(roofHex)) {
      roofMats.set(roofHex, new THREE.MeshLambertMaterial({ color: new THREE.Color(roofHex) }));
    }
    const geo = mergeBucket(bucket);
    if (geo) group.add(new THREE.Mesh(geo, [roofMats.get(roofHex), wallMats.get(matKey)]));
  }
  scene.add(group);
  return { group, info, roofs, masses: built, drawCalls: buckets.size };
}

/* ExtrudeGeometry emits group 0 = lids, group 1 = side walls (an ordering
   that already burned this codebase once — see campus-world.js). Split each
   geometry's triangles into the bucket's lid and wall piles so the merge can
   emit exactly two material groups. */
function splitIntoBucket(geo, bucket) {
  const plain = geo.index ? geo.toNonIndexed() : geo;
  const pos = plain.attributes.position.array;
  const norm = plain.attributes.normal.array;
  const uv = plain.attributes.uv.array;
  for (const g of plain.groups.length ? plain.groups : [{ start: 0, count: pos.length / 3, materialIndex: 0 }]) {
    const dst = g.materialIndex === 0 ? bucket.lids : bucket.walls;
    dst.push({
      pos: pos.slice(g.start * 3, (g.start + g.count) * 3),
      norm: norm.slice(g.start * 3, (g.start + g.count) * 3),
      uv: uv.slice(g.start * 2, (g.start + g.count) * 2),
    });
  }
}

function mergeBucket(bucket) {
  const total = (list) => list.reduce((n, c) => n + c.pos.length, 0);
  const lidN = total(bucket.lids);
  const wallN = total(bucket.walls);
  if (!lidN && !wallN) return null;
  const pos = new Float32Array(lidN + wallN);
  const norm = new Float32Array(lidN + wallN);
  const uv = new Float32Array(((lidN + wallN) / 3) * 2);
  let o = 0;
  let ouv = 0;
  for (const list of [bucket.lids, bucket.walls]) {
    for (const c of list) {
      pos.set(c.pos, o);
      norm.set(c.norm, o);
      uv.set(c.uv, ouv);
      o += c.pos.length;
      ouv += c.uv.length;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(norm, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.addGroup(0, lidN / 3, 0);
  geo.addGroup(lidN / 3, wallN / 3, 1);
  return geo;
}
