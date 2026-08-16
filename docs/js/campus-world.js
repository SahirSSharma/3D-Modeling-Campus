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
import { RoomEnvironment } from "../vendor/three/addons/environments/RoomEnvironment.js";
import { prepareGround } from "./campus-ground.js";
import {
  makeHeightSampler, makeSurfaceSampler, chunkGrid, STEP, axisSamples,
} from "./campus-terrain.js";
import {
  SPECIES, treeSpecies, treeTint, treeExclusionZones, solidZones, clearanceFor, crownFor,
} from "./campus-species.js";
import { OVERLAY, overlayLift, applyOverlayDepth } from "./campus-overlay.js";
import {
  regionSampler, buildRegionMesh, buildOcean, oceanEastLimit, regionColorLookup, SEA_LEVEL_M,
} from "./campus-region.js";

/* Campus on a clear November noon, as the 4K footage measures it: the big
   pavement family is neutral-to-cool light grey, NOT the beige the first
   palette guessed — six independent frame samples of Ridge Walk, Library Walk
   and Warren Mall converge on the greys below. GROUND_COLOR stays the baked
   satellite fallback (campus-textures.test.mjs pins it to the manifest); the
   walked world barely sees it. */
const GROUND_COLOR = 0x93a06d;
const PLAZA_COLOR = 0xb3b2a8;
const PATH_COLOR = 0xaaaea8;
const ASPHALT_COLOR = 0x8e8b86; // worn path asphalt, measured right 4×
const WATER_COLOR = 0x4a80a8; // real water reads deeper blue than a swatch

/* Draped surfaces sit on the "ground" rung of the shared decal-stack ladder
   (campus-overlay.js) — a small lift for eye-level parallax, plus
   renderOrder + depthWrite:false so a path never fights the ground it is
   painted on, at ANY altitude the depth buffer can resolve. */
const DRAPE = overlayLift("ground");
const drapeMaterial = (color) =>
  applyOverlayDepth(
    new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.95 }),
    "ground"
  );

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

/**
 * Hand in a boundary the caller has already downloaded, so this module does not
 * fetch it again. boot() reads the same file for the minimap, and the loading
 * screen's byte counter is the actual download — it cannot be, while one file
 * arrives twice under two different names.
 */
export function primeOverlay(boundary) {
  overlayPromise = Promise.resolve({ boundary: boundary || null });
}

/* Measured per-polygon colour, sampled at build time from the georeferenced
   satellite chunks (0.125–0.25 m/px — fine enough to see one sidewalk, not the
   lawn beside it). Keys are geometry hashes — `g:<kind>:<cx>,<cz>` /
   `s:<kind>:<cx>,<cz>`, centroid = outer-ring vertex average rounded to the
   metre — recomputed here so the lookup survives any data rebuild. Everything
   degrades to the NAIP/palette colours below when a key misses. Keep keyOf in
   sync with scripts/build-campus-truecolor.mjs and campus-massing.js. The fetch
   itself lives in campus-truecolor.js, which campus-massing.js shares. */
import { TRUECOLOR } from "./campus-truecolor.js";

const keyOf = (ring) => {
  let sx = 0, sz = 0;
  for (const p of ring) { sx += p[0]; sz += p[1]; }
  return `${Math.round(sx / ring.length)},${Math.round(sz / ring.length)}`;
};

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
export function createTerrain(scene, lidar, colors, region) {
  const terrain = lidar.terrain;
  ground = makeHeightSampler(terrain);
  const campusHeightAt = ground.heightAt;

  /* The regional grid, when it is there. Int16 decimetres relative to the same
     datum, read straight out of the downloaded buffer — no copy, no parse. */
  let regionMesh = null;
  let regionSample = null;
  if (region) {
    const h = region.header;
    const bytes = region.heights;
    const heights = new Int16Array(
      bytes.buffer,
      bytes.byteOffset,
      Math.floor(bytes.byteLength / 2)
    );
    if (heights.length >= h.cols * h.rows) {
      regionSample = regionSampler(h, heights);
      regionMesh = {
        header: h, heights,
        outline: region.outline?.polygon?.local || null,
        colors: region.colors || null,
      };
    }
  }

  /* Height, resolved by who actually measured the ground under the query.
     Inside the campus grid the 3 m sampler answers, exactly as before —
     nothing about the walk changes. Outside it, the regional grid answers
     where it has land. Past both, the campus sampler's edge-clamp still
     answers, so there is never a null and never a hole to fall through.

     Over open water the regional grid says "no land", and the honest height
     there is the sea, not the nearest cliff top. */
  const seaY = region ? SEA_LEVEL_M - lidar.datum : 0;
  const heightAt = !regionSample
    ? campusHeightAt
    : (x, z) => {
        const b = ground.bounds;
        if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) return campusHeightAt(x, z);
        const rb = regionSample.bounds;
        if (x >= rb.x0 && x <= rb.x1 && z >= rb.z0 && z <= rb.z1) {
          const v = regionSample.heightAt(x, z);
          if (v != null) return v;
          /* In the region and not land: this is the ocean. */
          return seaY;
        }
        return campusHeightAt(x, z);
      };
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
      ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })
      : new THREE.MeshStandardMaterial({ color: GROUND_COLOR, roughness: 0.95 });
    const mesh = new THREE.Mesh(geo, material);
    mesh.userData.chunk = chunk;
    chunkMeshes.push(mesh);
    group.add(mesh);
  }

  /* The apron is a flat skirt at the clamped edge height. It exists for one
     reason: past the campus grid there was no measurement, and a skirt is a
     more honest end to the world than a cliff into the void.
     Where the region IS measured, that reason is gone — and the skirt is now
     actively wrong, because it would hang a flat plate at mesa height straight
     across the Torrey Pines bluff, hiding the single biggest landform the
     expansion exists to show. So the apron retires wherever real land
     replaces it, and survives only where the region is absent. */
  let regionInfo = null;
  if (regionMesh) {
    /* Measured ground colour when it is there and it lines up; the inherited
       tan when it is not. regionColorLookup refuses a grid that does not match
       the height grid exactly, so a stale colour file degrades to flat rather
       than to a world whose ground colours are offset from its ground. */
    const colorAt = regionColorLookup(regionMesh.colors, regionMesh.header);
    const built = buildRegionMesh(regionMesh.header, regionMesh.heights, terrain, { colorAt });
    group.add(built.group);
    /* The sea stops where the water does. See oceanEastLimit: an unbounded
       plane sits below every piece of land and is still wrong, because the
       43% of the grid outside the outline is not land AND not water. */
    const eastX = oceanEastLimit(regionMesh.header, regionMesh.heights, regionMesh.outline);
    const ocean = buildOcean(lidar.datum, { eastX });
    if (ocean) group.add(ocean);
    regionInfo = {
      chunks: built.chunks, quads: built.quads, seaY, oceanEastX: eastX,
      groundColour: colorAt ? "measured" : "inherited",
    };
  } else {
    group.add(buildApron(terrain, h));
  }

  scene.add(group);

  addBoundaryLine(scene, heightAt);

  /* `coverage` is the rect that actually has ground mesh under it. With the
     region present that is the region's own extent, which is what free roam
     must clamp to — otherwise the walk still stops at the old campus wall
     with measured land visibly continuing past it. */
  const coverage = regionSample
    ? { ...regionSample.bounds }
    : ground.coverage;

  /* The height of the DRAWN triangles, for anything that must sit ON the mesh
     rather than on the 3 m samples the mesh decimates away (see
     makeSurfaceSampler). Free roam deliberately keeps riding `heightAt`. Past
     the campus grid the drawn ground is the apron or the regional mesh, so the
     region-aware heightAt is the right answer there. */
  const drawnSurfaceAt = makeSurfaceSampler(terrain);
  const surfaceAt = (x, z) => (ground.inGrid(x, z) ? drawnSurfaceAt(x, z) : heightAt(x, z));

  return { mesh: group, heightAt, surfaceAt, coverage, region: regionInfo };
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
    new THREE.MeshStandardMaterial({ color: GROUND_COLOR, side: THREE.DoubleSide, roughness: 0.95 })
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
  /* A dashed line drawn on the ground is exactly what the "paint" rung is
     for — the SPEC's own preference for crosswalk-style dashes. */
  const DASH = 7, GAP = 5, STEP = 1.75, HALF = 0.7, LIFT = overlayLift("paint");
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
  const mat = applyOverlayDepth(
    new THREE.MeshBasicMaterial({ color: 0x1e2f6e, side: THREE.DoubleSide }),
    "paint"
  );
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = OVERLAY.paint.renderOrder;
  scene.add(mesh);
}

/* ---------------------------------------------------------------- lighting */

export function createScene() {
  const scene = new THREE.Scene();
  /* The footage sky is a GRADIENT — six frame-measured zeniths converge on
     #3a7cc8 over a #b5d2e6 horizon; the old flat 0xbcd8ea matched only the
     horizon, so looking up was looking at haze. The dome below carries the
     gradient; the background colour remains as the fallback behind it. */
  scene.background = new THREE.Color(0xa9cbe4);
  /* Initial values only — campus-explore.js's scaleAtmosphere retunes fog and
     draw distance with altitude every time the camera climbs. */
  scene.fog = new THREE.Fog(0xc0d6e4, 180, 640);
  scene.add(skyDome());

  /* November light, as measured: lit pavement #b0b4b1 against #525b5c in
     shade is a ~2× luminance drop with a BLUE shift — so the sun carries more
     of the scene and the ambient less, the hemisphere sky term leans blue,
     and the ground bounce is pavement-grey, not the old olive that tinted
     every shadow green. */
  scene.add(new THREE.HemisphereLight(0xcfe4f8, 0x9aa0a0, 1.35));

  /* The sun sits LOW — this is San Diego in November, ~35° at noon — so the
     south faces light up and the north faces genuinely fall into shade. */
  const sun = new THREE.DirectionalLight(0xfff3e0, 2.25);
  sun.position.set(-90, 76, 60);
  scene.add(sun);

  /* Weak fill from the opposite side. With one sun every face turned away from
     it falls back to the hemisphere term and campus reads as flat grey slabs.
     Weaker than it was: shaded faces should stay visibly cooler and darker. */
  const fill = new THREE.DirectionalLight(0xd8e6f2, 0.45);
  fill.position.set(110, 70, -80);
  scene.add(fill);

  return scene;
}

/* Image-based lighting for the PBR materials: a PMREM-filtered neutral studio
   environment, kept WEAK. The hemisphere + sun above carry the measured
   November light; the environment's job is only the specular life a
   MeshStandardMaterial cannot get from analytic lights — window glass, rails
   and wet-look pavement picking up a sky instead of rendering dead black.
   Look, not geometry, and deliberately not a photograph of anywhere. */
export function applyEnvironment(renderer, scene) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.22;
  pmrem.dispose();
}

/* The measured sky: zenith #3a7cc8 falling to #b5d2e6 at the horizon, with
   the last degrees below eye level held at the pale tone so hilltops never
   silhouette against a hard edge. A camera-following dome rather than a
   shader background so it works with the stock Lambert pipeline, ignores fog,
   and costs one draw call. Radius sits inside the eye-level far plane (1100);
   onBeforeRender re-centres it, so no matter how high the explore mode
   climbs, the sky never clips. */
function skyDome() {
  const ZENITH = new THREE.Color(0x3a7cc8);
  const HORIZON = new THREE.Color(0xb5d2e6);
  const geo = new THREE.SphereGeometry(1000, 24, 12);
  const pos = geo.attributes.position;
  const rgb = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, pos.getY(i) / 1000); // 0 at/below horizon, 1 at zenith
    c.copy(HORIZON).lerp(ZENITH, Math.pow(t, 0.85));
    rgb[i * 3] = c.r;
    rgb[i * 3 + 1] = c.g;
    rgb[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(rgb, 3));
  const dome = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    })
  );
  dome.renderOrder = -1; // draw first; everything else paints over it
  dome.frustumCulled = false;
  dome.onBeforeRender = (renderer, sc, camera) => {
    dome.position.copy(camera.position);
    dome.updateMatrixWorld();
  };
  return dome;
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
    /* Footage-measured daylight families. Roads split darker from paths —
       streets measured #5a5a5c–#6b6f70, worn campus paths #807b72–#8f8e83.
       `green` is the DRY campus turf; the irrigated and bark-duff variants
       are chosen per polygon from the sampled colour below. */
    const DEFAULTS = {
      plaza: "#b3b2a8", walk: "#aaaea8", road: "#5e6163",
      green: "#75833f", court: "#5e8a7e", water: "#4a80a8",
    };
    const GREEN_BASES = {
      dry: new THREE.Color("#75833f"),
      irrigated: new THREE.Color("#6d8a35"),
      duff: new THREE.Color("#a68f76"), // eucalyptus-grove floors are bark, not lawn
    };
    const buckets = new Map(); // kind|cell -> { pos: [], col: [], uv: [] }

    const addSurface = (rings, kind, hex, measured) => {
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
         an aerial of a fountain basin mostly sees its concrete rim.

         MEASURED colours (campus-truecolor.json) went through shadow
         rejection and the taste-guard clamp at build time, so they are
         trusted harder — but a lawn fully under eucalyptus canopy still
         medians dark and still gets pulled toward daylight. */
      let base = new THREE.Color(DEFAULTS[kind] || DEFAULTS.plaza);
      /* Lawns are not one green. The footage shows three families — dry turf,
         irrigated turf, and the tan bark duff under the eucalyptus groves —
         and the aerial sample already knows which this is: a tan sample is
         duff (greenness ~0), a rich saturated sample is irrigated. Choosing
         the BASE per sample keeps the class fixed for every grove on campus,
         not just the ones someone noticed. */
      if (kind === "green" && hex) {
        const s = new THREE.Color(hex);
        const greenness = s.g - (s.r + s.b) / 2;
        base = greenness < 0.015 ? GREEN_BASES.duff
          : greenness > 0.06 ? GREEN_BASES.irrigated : GREEN_BASES.dry;
      }
      let color = base;
      if (hex && kind !== "water") {
        const sampled = new THREE.Color(hex);
        const lum = 0.299 * sampled.r + 0.587 * sampled.g + 0.114 * sampled.b;
        if (lum >= 0.13) {
          const keep = measured ? (lum < 0.3 ? 0.5 : 0.85) : lum < 0.3 ? 0.4 : 0.7;
          color = sampled.clone().lerp(base, 1 - keep);
        }
      } else if (hex && kind === "water") {
        /* Keep half the sample: a cobalt fountain and an aqua pool must not
           collapse into one municipal blue. */
        color = new THREE.Color(hex).lerp(base, 0.5);
      }
      /* Water is a raised basin, not a decal-stack rung — its own lift, kept
         clear of the ground ladder. Every other surface (including green,
         no special case any more) shares the ground rung's exact lift. */
      const lift = kind === "water" ? DRAPE + 0.12 : DRAPE;
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
      /* Per-polygon measured colour, resolved once by geometry key; the NAIP
         sample stays as the fallback where the imagery could not answer
         (construction zones, off coverage, all-shadow). */
      let trueGround = null;
      if (TRUECOLOR?.surfaces) {
        trueGround = arcgis.ground.map((g) => {
          if (!g?.r?.[0]) return null; // hole from an index-stable crop
          const outer = g.r[0].map(([x, z]) => [x / 10, z / 10]);
          return TRUECOLOR.surfaces[`g:${g.k}:${keyOf(outer)}`] || null;
        });
      }
      for (const piece of prepareGround(arcgis)) {
        const measured = trueGround?.[piece.src] || null;
        addSurface(piece.rings, piece.kind, measured || colors?.ground?.[piece.src], !!measured);
      }
    } else {
      for (const s of campus.surfaces || []) {
        if (!s.p || s.p.length < 3) continue;
        const measured = TRUECOLOR?.surfaces?.[`s:${s.kind}:${keyOf(s.p)}`] || null;
        addSurface([s.p], s.kind, measured, !!measured);
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
        const base = new THREE.MeshStandardMaterial({
          vertexColors: true,
          side: THREE.DoubleSide,
          roughness: 0.95,
          /* Only pavement is scored; lawns and water read as surfaces, not tiles. */
          ...(kind === "walk" || kind === "plaza" ? { map: scoring } : {}),
        });
        /* Water is a raised basin, genuinely 3D — it keeps depthWrite:true
           and stays OUT of the decal stack, at the terrain's own renderOrder
           0. Every other kind joins the "ground" rung. */
        matByKind.set(kind, kind === "water"
          ? Object.assign(base, {
              polygonOffset: true,
              polygonOffsetFactor: OVERLAY.ground.polygonOffsetFactor,
              polygonOffsetUnits: OVERLAY.ground.polygonOffsetUnits,
            })
          : applyOverlayDepth(base, "ground"));
      }
      const mesh = new THREE.Mesh(geo, matByKind.get(kind));
      if (kind !== "water") mesh.renderOrder = OVERLAY.ground.renderOrder;
      group.add(mesh);
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
      /* Every segment subdivides to ~6 m, skip or no skip. Two reasons share
         the interval:
         - the imagery decision is made every ~6 m rather than once per
           segment. A single midpoint test dropped whole 40 m segments that
           merely STARTED on the imagery (a bare strip with neither imagery
           nor overlay), and kept whole segments that merely ENDED off it (a
           beige quad over real paving).
         - the DRAPE samples the ground only where a quad has a vertex, so a
           long segment bridged whatever the terrain did in between. OSM maps
           Salk Institute Road's western run as one 159 m segment; the ground
           under it dips 6 m mid-segment, and the road hung across the swale
           as a straight plank. Terrain cells are 3 m; sampling every 6
           bounds the miss to the cell scale everywhere, which is what the
           Voigt Dr / Ridge Walk grade check expects of every draped path. */
      const n = Math.max(1, Math.ceil(len / 6));
      for (let k = 0; k < n; k++) {
        const t0 = k / n;
        const t1 = (k + 1) / n;
        if (skip && skip(ax + dx * (t0 + t1) / 2, az + dz * (t0 + t1) / 2)) continue;
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
    const mesh = new THREE.Mesh(geo, drapeMaterial(color));
    mesh.renderOrder = OVERLAY.ground.renderOrder;
    group.add(mesh);
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
 *
 * Crown sizing is delegated to `crownFor` (campus-species.js): a proportion
 * cap (no crown may read as wider than it is tall) and a crown-intrusion cap
 * (a crown may not overhang a building or a sports pad — the Muir zone fix,
 * RC2). `zoneSources` is whichever of { campus3d, arcgis, markings } the
 * caller has loaded; clearance is computed ONCE per tree here, never per
 * frame, using the same exclusion zones tree-rules.mjs prunes trunks with.
 */
export function createTrees(scene, lidar, heightAt, zoneSources = {}) {
  const trees = lidar.trees || [];
  if (!trees.length) return { count: 0 };

  /* Three silhouettes, coloured per instance from the species table
     (campus-species.js — every hue frame-sampled from the footage):
       tall     — bare pale pole, small high olive crown (eucalyptus)
       umbrella — short dark trunk, broad flattened near-black crown (pine)
       round    — the conventional lawn tree (sycamore, jacaranda, fig)
     The form is most of the recognition: a eucalyptus is a pole with a tuft,
     a torrey pine is a low table of shade, and no shared geometry can play
     both. Only the trunk taper is rendering-only and stays local; the crown
     proportions themselves live in CROWN_FORMS so crownFor and the renderer
     can never drift apart. */
  const TRUNK_TAPER = {
    tall: [0.16, 0.26], umbrella: [0.3, 0.44], round: [0.22, 0.34],
  };

  /* Bucket instances by form first — InstancedMesh needs its count up front. */
  const byForm = { tall: [], umbrella: [], round: [] };
  for (const t of trees) {
    const species = treeSpecies(t[0], t[1], t[2], t[3]);
    byForm[SPECIES[species].form].push({ t, species });
  }

  /* Clearance to the nearest building/sports-pad zone, once per tree — the
     same exclusion zones scripts/lib/tree-rules.mjs prunes trunks with, minus
     water (a crown may overhang a fountain). */
  const solid = solidZones(treeExclusionZones(zoneSources));

  const group = new THREE.Group();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const col = new THREE.Color();

  for (const [form, list] of Object.entries(byForm)) {
    if (!list.length) continue;
    const taper = TRUNK_TAPER[form];
    const trunkGeo = new THREE.CylinderGeometry(taper[0], taper[1], 1, 5);
    const leafGeo = new THREE.IcosahedronGeometry(1, form === "umbrella" ? 1 : 0);
    /* White base; the real colour rides per instance so one mesh can carry a
       stressed canyon eucalyptus and a lush lawn one. */
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, list.length);
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat, list.length);

    list.forEach(({ t: [x, z, h, r], species }, i) => {
      const ground = heightAt(x, z);
      const clearNeed = solid.length ? clearanceFor(x, z, solid) : Infinity;
      const { crownR, crownV, centre } = crownFor([x, z, h, r], form, clearNeed);
      const trunkH = centre; // trunk reaches into the crown; no gap can open

      const { leaf, trunk } = treeTint(species, x, z);
      scale.set(1, trunkH, 1);
      pos.set(x, ground + trunkH / 2, z);
      m.compose(pos, q, scale);
      trunks.setMatrixAt(i, m);
      col.setRGB(trunk[0], trunk[1], trunk[2]);
      trunks.setColorAt(i, col);

      scale.set(crownR, crownV, crownR);
      pos.set(x, ground + centre, z);
      m.compose(pos, q, scale);
      leaves.setMatrixAt(i, m);
      col.setRGB(leaf[0], leaf[1], leaf[2]);
      leaves.setColorAt(i, col);
    });

    trunks.instanceMatrix.needsUpdate = true;
    leaves.instanceMatrix.needsUpdate = true;
    if (trunks.instanceColor) trunks.instanceColor.needsUpdate = true;
    if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
    group.add(trunks, leaves);
  }

  scene.add(group);
  return { count: trees.length, group };
}

/* ------------------------------------------------------------------ walker */

/** A blocky student, for the over-the-shoulder view. */
export function createWalker() {
  const g = new THREE.Group();
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.66, 0.28),
    new THREE.MeshStandardMaterial({ color: 0xffcd00, roughness: 0.8 })
  );
  torso.position.y = 1.16;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.19, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xc98d63, roughness: 0.8 })
  );
  head.position.y = 1.62;
  const legMat = new THREE.MeshStandardMaterial({ color: 0x3b4a63, roughness: 0.8 });
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
