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
const WALL_PALETTE = ["#d9d2c5", "#cfc6b6", "#e0dad0", "#c6bcab", "#d2cabb", "#bfb5a4"];
const ROOF_FALLBACK = "#a8a094";

const hash = (x, z) => Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;

/* Measured roof colour, sampled at build time from the georeferenced
   satellite chunks — finer than NAIP, edge-eroded so walls and their shadows
   stay out of the median. Keys are geometry hashes (`m:`/`b:` + outer-ring
   vertex-average centroid, rounded to the metre) recomputed here, so the
   lookup survives a data rebuild and simply misses — falling back to the
   NAIP colour, then the palette — when a footprint moved. May be absent, and
   fetch() has no file:// under Node tests: both degrade to null. Keep the
   key rule in sync with scripts/build-campus-truecolor.mjs. */
const TRUECOLOR = await (async () => {
  try {
    const r = await fetch(new URL("../data/campus-truecolor.json", import.meta.url));
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
})();

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

/** One facade tile shared by every wall — see the original note in
    campus-world.js: generated so ExtrudeGeometry's world-unit UVs land one
    window bay per BAY and one band per STOREY. */
function facadeTexture() {
  const S = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = "#8d97a1";
  ctx.fillRect(4, 14, S - 8, 30);
  ctx.fillStyle = "#ffffff";
  for (let x = 4; x < S - 4; x += 14) ctx.fillRect(x, 14, 4, 30);
  ctx.fillStyle = "rgba(0,0,0,0.16)";
  ctx.fillRect(0, 44, S, 5);
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
 * buckets and merge — ~1,400 masses render as a few dozen draw calls, not
 * three thousand.
 *
 * Returns { group, info } where info maps building name -> { x, z, topY, h }
 * for labels and callouts.
 */
export function createBuildings(scene, { campus, lidar, arcgis, colors, facades, heightAt }) {
  const masses = assembleMasses({ campus, lidar, arcgis, colors });

  /* Geisel's floor stack renders separately below. */
  const geisel = arcgis?.geiselFloors || [];
  const geiselPlace = campus.places["Geisel Library"];

  /* -------- extrude into merged material buckets -------- */
  const facade = facadeTexture();
  const wallMats = new Map();
  const buckets = new Map(); // wallHex|roofHex -> { lids: [], walls: [] }
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
    const roofHex = q(trueRoof || m.roof);
    let wallHex = facades?.[m.name] || WALL_PALETTE[Math.floor(hash(outer[0][0], outer[0][1]) * WALL_PALETTE.length)];
    if (trueRoof && !facades?.[m.name]) {
      wallHex = `#${new THREE.Color(wallHex).lerp(new THREE.Color(roofHex), 0.12).getHexString()}`;
    }
    /* Chunked by 500 m so buildings behind the camera or past the fog can be
       culled — one campus-wide merge drew every building every frame. */
    const key = `${wallHex}|${roofHex}|${Math.floor(cx / 500)}:${Math.floor(cz / 500)}`;
    if (!buckets.has(key)) buckets.set(key, { lids: [], walls: [] });
    splitIntoBucket(geo, buckets.get(key));
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

  /* Geisel: stack the real floors on the real forecourt grade. */
  if (geisel.length && geiselPlace) {
    const base = heightAt(geiselPlace.x, geiselPlace.z);
    const bucketKey = `${facades?.["Geisel Library"] || "#cfc9bd"}|#8f8a82`;
    if (!buckets.has(bucketKey)) buckets.set(bucketKey, { lids: [], walls: [] });
    const bucket = buckets.get(bucketKey);
    let top = base;
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
      top = Math.max(top, base + floor.from + floor.h);
    }
    info.set("Geisel Library", { x: geiselPlace.x, z: geiselPlace.z, topY: top, h: Math.round((top - base) * 10) / 10 });
    built++;
  }

  const group = new THREE.Group();
  const roofMats = new Map();
  for (const [key, bucket] of buckets) {
    const [wallHex, roofHex] = key.split("|");  // third segment is the spatial chunk
    if (!wallMats.has(wallHex)) {
      wallMats.set(wallHex, new THREE.MeshLambertMaterial({ color: new THREE.Color(wallHex), map: facade }));
    }
    if (!roofMats.has(roofHex)) {
      roofMats.set(roofHex, new THREE.MeshLambertMaterial({ color: new THREE.Color(roofHex) }));
    }
    const geo = mergeBucket(bucket);
    if (geo) group.add(new THREE.Mesh(geo, [roofMats.get(roofHex), wallMats.get(wallHex)]));
  }
  scene.add(group);
  return { group, info, masses: built, drawCalls: buckets.size };
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
