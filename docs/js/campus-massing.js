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

/** Is this OSM ring already represented by the university's massing?
 *
 *  Centroid-in-one-ring alone is not enough: a courtyard building's centroid
 *  falls in the gap between the massing rings (Rya, Vela, Price Center all
 *  did), so its OSM copy rendered INSIDE the real massing. A ring counts as
 *  covered when its centroid sits in any massing ring OR a majority of its
 *  vertices do — the union test catches the courtyard cases without ever
 *  un-suppressing a building the centroid test already caught. */
const ringCoveredBy = (ring, coveredRings) => {
  const inAny = (x, z) => coveredRings.some((r) => inRing(x, z, r));
  const [cx, cz] = centroidOf(ring);
  if (inAny(cx, cz)) return true;
  let inside = 0;
  for (const [x, z] of ring) if (inAny(x, z)) inside++;
  return inside / ring.length > 0.5;
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
  const skipOsm = new Set(["Geisel Library"]);
  campus.buildings.forEach((b, i) => {
    if (b.n && skipOsm.has(b.n)) return;
    const fac = arcgis?.buildings?.[b.n];
    const lidarH = b.n ? lidar.heights[b.n] : null;
    /* Parts keep their ORIGINAL index: lidar.partHeights is keyed by it, and
       filtering first shifted every part after a dropped one onto the wrong
       measured height (Tapestry's second part resolved undefined). */
    const parts = (b.parts || [])
      .map((part, pi) => ({ part, pi }))
      .filter(({ part, pi }) => lidar.partHeights?.[`${i}/${pi}`] || part.h);
    if (parts.length >= 2) {
      /* Suppression is per PART here — the parts are what renders. Rya and
         Vela's outer-ring centroids fall in the paseo between the towers, but
         every part-box sits ON the university's PCW massing and must yield. */
      for (const { part, pi } of parts) {
        if (ringCoveredBy(part.p, covered)) continue;
        masses.push({
          rings: [part.p],
          name: b.n || null,
          gisH: lidar.partHeights?.[`${i}/${pi}`] ?? part.h,
          levels: null,
          roof: colors?.buildings?.[i] || null,
          src: "osm",
        });
      }
      return;
    }
    if (ringCoveredBy(b.p, covered)) return;
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

  /* Reconcile massing-part heights against the LiDAR building they stand in,
     and label each mass by the name a STUDENT uses: the OSM building it
     stands inside ("Sankofa", "Vela"), not the facilities code
     ("TDLLN - Sankofa Tower"). */
  const namedRings = campus.buildings.filter((b) => b.n).map((b) => ({ n: b.n, p: b.p }));
  for (const m of masses) {
    if (m.lidarDone) continue;
    const [cx, cz] = centroidOf(m.rings[0]);
    const host = namedRings.find((b) => inRing(cx, cz, b.p));
    m.h = reconcile(m.gisH, host ? lidar.heights[host.n] : null);
    if (host) m.name = host.n;
  }
  for (const m of masses) if (m.h === undefined) m.h = m.gisH;
  return masses;
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
    const roofY = heightAt(cx, cz) + m.h;
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
