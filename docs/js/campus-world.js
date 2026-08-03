// The campus, built from measurements.
//
// Sources, each used for the thing it is actually good at:
//
//   app/data/campus-3d.json     OpenStreetMap — where the walls, paths and
//                               plazas ARE. Outlines, in plan. OSM is very good
//                               at this and it is all that is asked of it here.
//
//   app/data/campus-lidar.json  USGS 3DEP aerial LiDAR — how high everything
//                               IS, and where the ground sits. Measured, not
//                               tagged and not guessed.
//
//   app/data/campus-arcgis.json UC San Diego's own facilities GIS — the actual
//                               POLYGONS of every sidewalk, lawn, road and
//                               fountain, and the real floor count per
//                               building. Where the university has surveyed
//                               its own ground, that beats our reconstruction;
//                               scripts/build-campus-arcgis.mjs is the pull.
//
//   app/data/campus-boundary.json   the official campus boundary polygon (OSM)
//
// Current-epoch satellite imagery is a SOURCE here, never a texture: it feeds
// the build-time pipelines (colours, markings, cross-checks) and the accuracy
// audits, but the world itself stays modeled. The boundary is drawn in-world
// as a dashed line, so the surveyed edge of campus is visible, not implied.
//
// The split matters because the first version of this file took heights from
// OSM too, and OSM was wrong about nearly every building on this walk. See the
// header of scripts/build-campus-lidar.mjs for the full reckoning.
//
// Nothing here knows anything about walking or gameplay. It makes the world and
// hands back a height field; campus-walk.js moves through it.
import * as THREE from "../vendor/three/three.module.min.js";
import { prepareGround } from "./campus-ground.js";
import { makeHeightSampler, chunkGrid } from "./campus-terrain.js";

/* Campus on a clear morning: bleached concrete, tan and off-white stucco,
   eucalyptus. Buildings pick from the palette by a hash of position so a given
   building is the same colour on every visit — a skyline that reshuffles itself
   reads as broken even when nobody can say why. */
const ROOF_COLOR = 0xa8a094;
const GROUND_COLOR = 0x93a06d;
const PLAZA_COLOR = 0xcac4b6;
const PATH_COLOR = 0xc9c4b8;
const ASPHALT_COLOR = 0x8e8b86;
const WATER_COLOR = 0x6f9fb5;

/* Draped surfaces are lifted this far off the terrain and biased in depth, so
   a path never fights the ground it is painted on. Both are needed: the offset
   handles the general case, the depth bias handles grazing angles. */
const DRAPE = 0.06;
const drapeMaterial = (color) =>
  new THREE.MeshLambertMaterial({
    color,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -8,
  });

/* ------------------------------------------------------------------ terrain */

/* The boundary polygon, fetched once and shared by everything that needs it.
   The file may legitimately be absent (a checkout that has not run
   build-campus-satellite.mjs); everything below degrades to no boundary line
   rather than failing. */
let overlayPromise = null;
function overlayData() {
  if (!overlayPromise) {
    overlayPromise = fetch(new URL("../data/campus-boundary.json", import.meta.url))
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((boundary) => ({ boundary }));
  }
  return overlayPromise;
}

/* Set by createTerrain; the boundary ribbon uses it to stay on real ground. */
let ground = null;

/**
 * The bare-earth height field, as measured.
 *
 * Returns a sampler as well as the mesh, because everything else in the world
 * has to sit ON this — buildings, trees, the walkway, the walker's own eyes.
 *
 * The SAMPLER comes from campus-terrain.js: full 3 m bilinear, CLAMPED to the
 * nearest edge sample outside the LiDAR grid — the old fallback answered 0
 * (datum level) out there, which left buildings past the grid hanging in
 * mid-air. The RENDER MESH halves the resolution: at full-campus scale a 3 m
 * mesh is 936,000 vertices pushed every frame, and that alone dragged the
 * whole site under 3 fps. At 6 m it is a quarter of the work and the
 * difference is invisible past the first metre of fog.
 *
 * The mesh is built in CHUNKS on the shared texture grid (campus-terrain.js),
 * so satellite imagery can drape chunk by chunk and the far side of campus
 * can frustum-cull away. Each chunk starts with NAIP vertex colours — the
 * real patchwork of chaparral, lawns and lots — and the chunks inside the
 * campus boundary swap to the real photograph as it loads.
 */
export function createTerrain(scene, lidar, colors) {
  const terrain = lidar.terrain;
  ground = makeHeightSampler(terrain);
  const { heightAt } = ground;
  const { x0, z0, cell, cols, rows, z: heights } = terrain;
  const clampIdx = (v, hi) => (v < 0 ? 0 : v > hi ? hi : v);
  const h = (r, c) => heights[clampIdx(r, rows - 1) * cols + clampIdx(c, cols - 1)] / 10;

  /* NAIP colour lookup, shared by every chunk. Index 255 = "no imagery":
     keep the old invented green. */
  let colorAt = null;
  if (colors?.terrain?.idx) {
    const ct = colors.terrain;
    const idx = Uint8Array.from(atob(ct.idx), (ch) => ch.charCodeAt(0));
    const palette = ct.palette.map((hex) => new THREE.Color(hex));
    const fallback = new THREE.Color(GROUND_COLOR);
    colorAt = (x, z) => {
      const cc = Math.max(0, Math.min(ct.cols - 1, Math.round((x - ct.x0) / ct.cell)));
      const rr = Math.max(0, Math.min(ct.rows - 1, Math.round((z - ct.z0) / ct.cell)));
      const k = idx[rr * ct.cols + cc];
      return k === 255 ? fallback : palette[k] || fallback;
    };
  }

  /* Sample indices for one chunk edge at the decimation step: every STEP-th
     sample from the chunk's first row/col, plus its exact last one, so
     neighbouring chunks share their edge samples and no seam can open. */
  const STEP = 2;
  const axisSamples = (a0, a1) => {
    const out = [];
    for (let v = a0; v < a1; v += STEP) out.push(v);
    out.push(a1);
    return out;
  };

  const group = new THREE.Group();
  const chunkMeshes = [];
  for (const chunk of chunkGrid(terrain)) {
    const rsm = axisSamples(chunk.r0, chunk.r1);
    const csm = axisSamples(chunk.c0, chunk.c1);
    const position = [];
    const normal = [];
    const uv = [];
    const rgb = [];
    for (const r of rsm) {
      for (const c of csm) {
        const x = x0 + c * cell;
        const z = z0 + r * cell;
        position.push(x, h(r, c), z);
        /* Central differences over the WHOLE grid, not per chunk, so lighting
           cannot crease along a chunk seam. */
        const nx = -(h(r, c + STEP) - h(r, c - STEP)) / (2 * STEP * cell);
        const nz = -(h(r + STEP, c) - h(r - STEP, c)) / (2 * STEP * cell);
        const inv = 1 / Math.hypot(nx, 1, nz);
        normal.push(nx * inv, inv, nz * inv);
        /* Texture row 0 is the chunk's north edge; with the loader's default
           flipY that is v = 1. */
        uv.push((c - chunk.c0) / (chunk.c1 - chunk.c0), 1 - (r - chunk.r0) / (chunk.r1 - chunk.r0));
        const col = colorAt ? colorAt(x, z) : null;
        if (col) rgb.push(col.r, col.g, col.b);
      }
    }
    const index = [];
    const stride = csm.length;
    for (let r = 0; r < rsm.length - 1; r++) {
      for (let c = 0; c < stride - 1; c++) {
        const a = r * stride + c;
        index.push(a, a + stride, a + 1, a + 1, a + stride, a + stride + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(normal, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    if (rgb.length === position.length) {
      geo.setAttribute("color", new THREE.Float32BufferAttribute(rgb, 3));
    }
    geo.setIndex(index);
    const material = colorAt && rgb.length === position.length
      ? new THREE.MeshLambertMaterial({ vertexColors: true })
      : new THREE.MeshLambertMaterial({ color: GROUND_COLOR });
    const mesh = new THREE.Mesh(geo, material);
    mesh.userData.chunk = chunk;
    chunkMeshes.push(mesh);
    group.add(mesh);
  }

  group.add(buildApron(terrain, h));
  scene.add(group);

  addBoundaryLine(scene, heightAt);

  /* `coverage` is the rect that actually has ground mesh under it (grid +
     apron); free roam clamps INSIDE the grid itself, tighter still. */
  return { mesh: group, heightAt, coverage: ground.coverage };
}

/**
 * Flat ground out past the LiDAR grid, at the clamped edge height. Inner
 * vertices reuse the exact edge samples, so no crack can open against the
 * terrain chunks; outward the height is constant, which is also exactly what
 * the clamped sampler answers out there — so anything placed on the apron and
 * the ground under it agree by construction.
 */
function buildApron(terrain, h) {
  const { x0, z0, cell, cols, rows } = terrain;
  const x1 = x0 + (cols - 1) * cell;
  const z1 = z0 + (rows - 1) * cell;
  const R = 520; // metres past the grid; campus-terrain.js APRON_REACH
  const position = [];
  const quad = (ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz) => {
    position.push(ax, ay, az, cx, cy, cz, bx, by, bz, bx, by, bz, cx, cy, cz, dx, dy, dz);
  };
  for (let c = 0; c < cols - 1; c++) {
    const xa = x0 + c * cell;
    const xb = xa + cell;
    quad(xa, h(0, c), z0 - R, xb, h(0, c + 1), z0 - R, xa, h(0, c), z0, xb, h(0, c + 1), z0);
    quad(xa, h(rows - 1, c), z1, xb, h(rows - 1, c + 1), z1,
         xa, h(rows - 1, c), z1 + R, xb, h(rows - 1, c + 1), z1 + R);
  }
  for (let r = 0; r < rows - 1; r++) {
    const za = z0 + r * cell;
    const zb = za + cell;
    quad(x0 - R, h(r, 0), za, x0, h(r, 0), za, x0 - R, h(r + 1, 0), zb, x0, h(r + 1, 0), zb);
    quad(x1, h(r, cols - 1), za, x1 + R, h(r, cols - 1), za,
         x1, h(r + 1, cols - 1), zb, x1 + R, h(r + 1, cols - 1), zb);
  }
  quad(x0 - R, h(0, 0), z0 - R, x0, h(0, 0), z0 - R, x0 - R, h(0, 0), z0, x0, h(0, 0), z0);
  quad(x1, h(0, cols - 1), z0 - R, x1 + R, h(0, cols - 1), z0 - R,
       x1, h(0, cols - 1), z0, x1 + R, h(0, cols - 1), z0);
  quad(x0 - R, h(rows - 1, 0), z1, x0, h(rows - 1, 0), z1,
       x0 - R, h(rows - 1, 0), z1 + R, x0, h(rows - 1, 0), z1 + R);
  quad(x1, h(rows - 1, cols - 1), z1, x1 + R, h(rows - 1, cols - 1), z1,
       x1, h(rows - 1, cols - 1), z1 + R, x1 + R, h(rows - 1, cols - 1), z1 + R);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
  const normals = new Float32Array(position.length);
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
  geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  return new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({ color: GROUND_COLOR, side: THREE.DoubleSide })
  );
}

/**
 * The campus boundary, drawn in-world as a dashed dark-navy ribbon a hand's
 * width above the ground — the same convention OSM's own map uses for the
 * dashed university edge, so the line reads as "the boundary" at a glance.
 */
async function addBoundaryLine(scene, heightAt) {
  const { boundary } = await overlayData();
  if (!boundary?.rings?.length) return;
  const DASH = 7, GAP = 5, STEP = 1.75, HALF = 0.7, LIFT = 0.15;
  /* Only where ground exists: a ribbon drawn past the apron would hang at
     edge-clamped height over nothing. The minimap draws the full ring
     regardless. */
  const cov = ground?.coverage;
  const onGround = (x, z) =>
    !cov || (x >= cov.x0 && x <= cov.x1 && z >= cov.z0 && z <= cov.z1);
  const position = [];
  for (const ring of boundary.rings) {
    /* Resample the ring at STEP, then keep only the dashed-on spans. */
    let carry = 0;
    for (let i = 1; i < ring.length; i++) {
      const [ax, az] = ring[i - 1];
      const [bx, bz] = ring[i];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 0.01) continue;
      const ux = (bx - ax) / len;
      const uz = (bz - az) / len;
      for (let s = 0; s < len; s += STEP) {
        const e = Math.min(len, s + STEP);
        if ((carry + s) % (DASH + GAP) >= DASH) continue;
        if (!onGround(ax + ux * s, az + uz * s) || !onGround(ax + ux * e, az + uz * e)) continue;
        const px = -uz * HALF;
        const pz = ux * HALF;
        const q = [
          [ax + ux * s + px, az + uz * s + pz], [ax + ux * s - px, az + uz * s - pz],
          [ax + ux * e + px, az + uz * e + pz], [ax + ux * e - px, az + uz * e - pz],
        ].map(([x, z]) => [x, heightAt(x, z) + LIFT, z]);
        position.push(...q[0], ...q[2], ...q[1], ...q[1], ...q[2], ...q[3]);
      }
      carry += len;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
  const normals = new Float32Array(position.length);
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
  geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  const mat = new THREE.MeshBasicMaterial({
    color: 0x1e2f6e,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -8,
  });
  scene.add(new THREE.Mesh(geo, mat));
}

/* ---------------------------------------------------------------- lighting */

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbcd8ea);
  /* Initial values only — campus-explore.js's scaleAtmosphere retunes fog and
     draw distance with altitude every time the camera climbs. */
  scene.fog = new THREE.Fog(0xc4dcec, 170, 640);

  scene.add(new THREE.HemisphereLight(0xdfefff, 0x7d8a63, 1.7));

  const sun = new THREE.DirectionalLight(0xfff3e0, 1.9);
  sun.position.set(-90, 140, 60);
  scene.add(sun);

  /* Weak fill from the opposite side. With one sun every face turned away from
     it falls back to the hemisphere term and campus reads as flat grey slabs. */
  const fill = new THREE.DirectionalLight(0xd8e6f2, 0.65);
  fill.position.set(110, 70, -80);
  scene.add(fill);

  return scene;
}

/* --------------------------------------------------------------- buildings */
/* Buildings moved to campus-massing.js: the university's own multi-mass
   extrusions + Geisel's floor stack + aerial roof colours outgrew the simple
   one-footprint extruder that used to live here. */

/* ---------------------------------------------------------------- surfaces */

/* The scored-concrete texture: faint expansion-joint lines every tile, the
   grid Revelle Plaza is recognised by from the air (and every real sidewalk
   carries at a smaller pitch). Applied in world units via the surface UVs. */
function scoringTexture() {
  const S = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = "rgba(0,0,0,0.16)";
  ctx.fillRect(0, 0, S, 2);
  ctx.fillRect(0, 0, 2, S);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/**
 * The ground cover: UCSD's surveyed polygons, each tinted with its own
 * colour sampled from NAIP aerial imagery, merged into ONE mesh per kind —
 * 4,000+ polygons over the full campus as six draw calls, not four thousand.
 * OSM's plazas and lawns remain the fallback when the survey is absent.
 */
export function createSurfaces(scene, campus, heightAt, arcgis, colors) {
  const group = new THREE.Group();
  const scoring = scoringTexture();
  const matByKind = new Map();

  const build = (skip) => {
    const DEFAULTS = {
      plaza: "#cac4b6", walk: "#c9c4b8", road: "#8e8b86",
      green: "#8faa63", court: "#5e8a7e", water: "#6f9fb5",
    };
    const buckets = new Map(); // kind|cell -> { pos: [], col: [], uv: [] }

    const addSurface = (rings, kind, hex) => {
      const outer = rings[0];
      if (!outer || outer.length < 3) return;
      if (skip) {
        /* KNOWN LIMIT: per-polygon by centroid — a piece straddling the
           boundary is kept or dropped whole. The survey's pieces are small
           (tiled at load), so the error is bounded to a few metres. */
        let cx = 0, cz = 0;
        for (const [x, z] of outer) { cx += x; cz += z; }
        if (skip(cx / outer.length, cz / outer.length)) return;
      }
      /* Triangulated by hand (ShapeUtils under the hood) so the vertices can
         carry the polygon's aerial tint and drape onto the terrain in one
         pass. Y is negated into shape space and back — see the old note about
         Revelle Plaza rendering across campus when this sign is dropped. */
      const contour = outer.map(([x, z]) => new THREE.Vector2(x, -z));
      const holes = rings.slice(1).filter((r) => r.length >= 3)
        .map((r) => r.map(([x, z]) => new THREE.Vector2(x, -z)));
      let tris;
      try {
        tris = THREE.ShapeUtils.triangulateShape(contour, holes);
      } catch {
        return; // one degenerate survey polygon must not cost the campus
      }
      const verts = contour.concat(...holes);
      /* COLOUR HYGIENE. The aerial photographs ground truthfully — including
         the tree shading ON it. A lawn sampled under a eucalyptus crown comes
         back near-black, and Revelle Plaza rendered as dark asphalt because
         its polygons were sampled in shadow. So the sample is blended toward
         the kind's daylight colour, harder the darker it is: a shadowed sample
         keeps its hue but not its gloom, and anything nearly black is treated
         as "the photo saw a tree, not the ground". Water always leans blue —
         an aerial of a fountain basin mostly sees its concrete rim. */
      const base = new THREE.Color(DEFAULTS[kind] || DEFAULTS.plaza);
      let color = base;
      if (hex && kind !== "water") {
        const sampled = new THREE.Color(hex);
        const lum = 0.299 * sampled.r + 0.587 * sampled.g + 0.114 * sampled.b;
        if (lum >= 0.13) {
          const keep = lum < 0.3 ? 0.4 : 0.7;
          color = sampled.clone().lerp(base, 1 - keep);
        }
      } else if (hex && kind === "water") {
        color = new THREE.Color(hex).lerp(base, 0.65);
      }
      const lift = kind === "water" ? DRAPE + 0.12 : kind === "green" ? DRAPE - 0.02 : DRAPE;
      /* Chunked by 500 m cell as well as kind: one campus-wide merged mesh can
         never be frustum-culled, so every frame drew every sidewalk on campus.
         Chunks let the far side of the mesa drop out at eye level. */
      const chunk = `${kind}|${Math.floor(outer[0][0] / 500)}:${Math.floor(outer[0][1] / 500)}`;
      if (!buckets.has(chunk)) buckets.set(chunk, { kind, pos: [], col: [], uv: [] });
      const b = buckets.get(chunk);
      /* A fountain is a BASIN, not a puddle: water rides 0.35 m up on a rim so
         it reads as the raised concrete basin it is. Everything else drapes. */
      const rim = kind === "water" ? 0.35 : 0;
      for (const tri of tris) {
        for (const vi of tri) {
          const x = verts[vi].x;
          const z = -verts[vi].y;
          b.pos.push(x, heightAt(x, z) + lift + rim, z);
          b.col.push(color.r, color.g, color.b);
          b.uv.push(x / 3, z / 3); // scoring joints every 3 m, world-aligned
        }
      }
      if (rim) {
        /* The basin wall: a quad strip from the raised water edge to the
           ground, concrete-coloured. */
        const wall = new THREE.Color("#b9b2a4");
        for (let i = 0; i < outer.length; i++) {
          const [ax, az] = outer[i];
          const [bx, bz] = outer[(i + 1) % outer.length];
          const ay = heightAt(ax, az);
          const by = heightAt(bx, bz);
          const quad = [
            [ax, ay + lift + rim, az], [bx, by + lift + rim, bz], [ax, ay - 0.2, az],
            [bx, by + lift + rim, bz], [bx, by - 0.2, bz], [ax, ay - 0.2, az],
          ];
          for (const [qx, qy, qz] of quad) {
            b.pos.push(qx, qy, qz);
            b.col.push(wall.r, wall.g, wall.b);
            b.uv.push(qx / 3, qz / 3);
          }
        }
      }
    };

    if (arcgis?.ground?.length) {
      for (const piece of prepareGround(arcgis)) {
        addSurface(piece.rings, piece.kind, colors?.ground?.[piece.src]);
      }
    } else {
      for (const s of campus.surfaces || []) {
        if (s.p && s.p.length >= 3) addSurface([s.p], s.kind, null);
      }
    }

    for (const b of buckets.values()) {
      const kind = b.kind;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(b.pos, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(b.col, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(b.uv, 2));
      const normals = new Float32Array(b.pos.length);
      for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
      geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
      if (!matByKind.has(kind)) {
        matByKind.set(kind, new THREE.MeshLambertMaterial({
          vertexColors: true,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -4,
          polygonOffsetUnits: -8,
          /* Only pavement is scored; lawns and water read as surfaces, not tiles. */
          ...(kind === "walk" || kind === "plaza" ? { map: scoring } : {}),
        }));
      }
      group.add(new THREE.Mesh(geo, matByKind.get(kind)));
    }
  };

  build(null);
  scene.add(group);
  return group;
}

/* ------------------------------------------------------------------- paths */

/**
 * The whole footpath network, not just the route.
 *
 * This is most of what makes the place legible. A single ribbon through empty
 * grass reads as a track laid across a field; the same ribbon among the paths
 * that really branch off it reads as campus. Widths and colours come from the
 * OSM `highway` and `surface` tags.
 */
export function createPaths(scene, campus, heightAt) {
  const group = new THREE.Group();
  buildPaths(group, campus, heightAt, null);
  scene.add(group);
  return group;
}

function buildPaths(group, campus, heightAt, skip) {
  const buckets = new Map(); // colour -> positions[]

  for (const path of campus.paths || []) {
    const pts = path.p;
    if (!pts || pts.length < 2) continue;
    const asphalt = path.s === "asphalt";
    const color = asphalt ? ASPHALT_COLOR : PATH_COLOR;
    const half = (path.steps ? 2.0 : path.n === "Ridge Walk" ? 3.4 : 2.2);
    if (!buckets.has(color)) buckets.set(color, []);
    const out = buckets.get(color);

    const emit = (ax, az, bx, bz) => {
      const dx = bx - ax;
      const dz = bz - az;
      const len = Math.hypot(dx, dz);
      if (len < 0.01) return;
      const nx = (-dz / len) * half;
      const nz = (dx / len) * half;
      const quad = [
        [ax + nx, az + nz], [ax - nx, az - nz],
        [bx + nx, bz + nz], [bx - nx, bz - nz],
      ].map(([x, z]) => [x, heightAt(x, z) + DRAPE, z]);
      // two triangles, wound so the front face points at the sky
      out.push(...quad[0], ...quad[2], ...quad[1]);
      out.push(...quad[1], ...quad[2], ...quad[3]);
    };

    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[i + 1];
      const dx = bx - ax;
      const dz = bz - az;
      const len = Math.hypot(dx, dz);
      if (len < 0.01) continue;
      if (!skip) { emit(ax, az, bx, bz); continue; }
      /* The imagery decision is made every ~6 m rather than once per segment.
         A single midpoint test dropped whole 40 m segments that merely
         STARTED on the imagery (a bare strip with neither imagery nor
         overlay), and kept whole segments that merely ENDED off it (a beige
         quad over real paving). Subdividing bounds the error at the imagery
         edge to a few metres either way. */
      const n = Math.max(1, Math.ceil(len / 6));
      for (let k = 0; k < n; k++) {
        const t0 = k / n;
        const t1 = (k + 1) / n;
        if (skip(ax + dx * (t0 + t1) / 2, az + dz * (t0 + t1) / 2)) continue;
        emit(ax + dx * t0, az + dz * t0, ax + dx * t1, az + dz * t1);
      }
    }
  }

  for (const [color, positions] of buckets) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const normals = new Float32Array(positions.length);
    for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
    geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    group.add(new THREE.Mesh(geo, drapeMaterial(color)));
  }
}

/* ------------------------------------------------------------------- trees */

/**
 * Real trees, where they really are.
 *
 * Each entry is a canopy the LiDAR actually saw: position, measured height,
 * measured spread. The first version of this scattered generic trees along the
 * route by a hash, which looked fine and told you nothing — the eucalyptus row
 * along Ridge Walk was invented, and the trees that really shade Revelle Plaza
 * were absent.
 */
export function createTrees(scene, lidar, heightAt) {
  const trees = lidar.trees || [];
  if (!trees.length) return { count: 0 };

  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 1, 5);
  const leafGeo = new THREE.IcosahedronGeometry(1, 0);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a7259 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x5f7a44 });

  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, trees.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const pos = new THREE.Vector3();

  /* You walk UNDER a tree, not through one. Crowns are sized so their underside
     always clears head height: a crown of radius r centred to put its top at
     the measured height h has its underside at h - 2r, so r is capped at
     (h - CLEARANCE) / 2. Without that cap a broad, short canopy reached the
     ground and the walk went straight into a solid green wall — which is
     exactly what it did on the first pass out of Argo Hall. */
  const CLEARANCE = 2.4;

  trees.forEach(([x, z, h, r], i) => {
    const ground = heightAt(x, z);
    /* The crown floor scales with height: a 25 m eucalyptus in a tight row
       gets a small measured spread, and rendering it with the same 1.2 m
       knob as a sapling made a bare pole ending in open sky. */
    const minCrown = Math.max(1.2, Math.min(2.8, h * 0.13));
    const crownR = Math.max(minCrown, Math.min(r, (h - CLEARANCE) / 2));
    const trunkH = Math.max(CLEARANCE, h - 2 * crownR);

    scale.set(1, trunkH, 1);
    pos.set(x, ground + trunkH / 2, z);
    m.compose(pos, q, scale);
    trunks.setMatrixAt(i, m);

    scale.set(crownR, crownR * 1.1, crownR);
    pos.set(x, ground + trunkH + crownR, z);
    m.compose(pos, q, scale);
    leaves.setMatrixAt(i, m);
  });

  trunks.instanceMatrix.needsUpdate = true;
  leaves.instanceMatrix.needsUpdate = true;
  const group = new THREE.Group();
  group.add(trunks, leaves);
  scene.add(group);
  return { count: trees.length, group };
}

/* ------------------------------------------------------------------ walker */

/** A blocky student, for the over-the-shoulder view. */
export function createWalker() {
  const g = new THREE.Group();
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.66, 0.28),
    new THREE.MeshLambertMaterial({ color: 0xffcd00 })
  );
  torso.position.y = 1.16;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.19, 12, 10),
    new THREE.MeshLambertMaterial({ color: 0xc98d63 })
  );
  head.position.y = 1.62;
  const legMat = new THREE.MeshLambertMaterial({ color: 0x3b4a63 });
  const legs = [];
  for (const dx of [-0.13, 0.13]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.8, 0.2), legMat);
    leg.position.set(dx, 0.42, 0);
    legs.push(leg);
    g.add(leg);
  }
  g.add(torso, head);
  g.userData.legs = legs;
  return g;
}

export { THREE };
