// The campus, built from measurements.
//
// Two sources, each used for the thing it is actually good at:
//
//   app/data/campus-3d.json     OpenStreetMap — where the walls, paths and
//                               plazas ARE. Outlines, in plan. OSM is very good
//                               at this and it is all that is asked of it here.
//
//   app/data/campus-lidar.json  USGS 3DEP aerial LiDAR — how high everything
//                               IS, and where the ground sits. Measured, not
//                               tagged and not guessed.
//
// The split matters because the first version of this file took heights from
// OSM too, and OSM was wrong about nearly every building on this walk: Argo
// Hall 4.5 m too tall, Blake Hall 3 m too tall, Mandeville 10 m too short,
// McGill and Biology roughly half their real height. See the header of
// scripts/build-campus-lidar.mjs for the full reckoning.
//
// A third source joined later:
//
//   app/data/campus-arcgis.json UC San Diego's own facilities GIS — the actual
//                               POLYGONS of every sidewalk, lawn, road and
//                               fountain, and the real floor count per
//                               building. Where the university has surveyed
//                               its own ground, that beats our reconstruction;
//                               scripts/build-campus-arcgis.mjs is the pull.
//
// Nothing here knows anything about walking or gameplay. It makes the world and
// hands back a height field; campus-walk.js moves through it.
import * as THREE from "../vendor/three/three.module.min.js";
import { prepareGround } from "./campus-ground.js";

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

/**
 * The bare-earth height field, as measured.
 *
 * Returns a sampler as well as the mesh, because everything else in the world
 * has to sit ON this — buildings, trees, the walkway, the walker's own eyes.
 * Bilinear rather than nearest: at 3 m cells, nearest-neighbour sampling makes
 * a walker climb invisible 10 cm stairs the whole way across campus.
 */
export function createTerrain(scene, lidar, colors) {
  const { x0, z0, cell, cols, rows, z: heights } = lidar.terrain;

  const heightAt = (x, zz) => {
    const fx = (x - x0) / cell;
    const fz = (zz - z0) / cell;
    const c = Math.floor(fx);
    const r = Math.floor(fz);
    if (c < 0 || c >= cols - 1 || r < 0 || r >= rows - 1) return 0;
    const tx = fx - c;
    const tz = fz - r;
    const h = (rr, cc) => heights[rr * cols + cc] / 10; // decimetres -> metres
    const top = h(r, c) * (1 - tx) + h(r, c + 1) * tx;
    const bottom = h(r + 1, c) * (1 - tx) + h(r + 1, c + 1) * tx;
    return top * (1 - tz) + bottom * tz;
  };

  /* The SAMPLER stays at the full 3 m grid — stairs are still stairs under
     your feet. The RENDER MESH halves the resolution: at full-campus scale a
     3 m mesh is 936,000 vertices pushed every frame, and that alone dragged
     the whole site under 3 fps. At 6 m it is a quarter of the work and the
     difference is invisible past the first metre of fog. */
  const step = 2;
  const mCols = Math.floor((cols - 1) / step) + 1;
  const mRows = Math.floor((rows - 1) / step) + 1;
  const geo = new THREE.PlaneGeometry(
    (mCols - 1) * cell * step, (mRows - 1) * cell * step, mCols - 1, mRows - 1
  );
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const c = (i % mCols) * step;
    const r = Math.floor(i / mCols) * step;
    pos.setY(i, heights[r * cols + c] / 10);
  }
  geo.computeVertexNormals();
  geo.translate(x0 + ((mCols - 1) * cell * step) / 2, 0, z0 + ((mRows - 1) * cell * step) / 2);

  /* The ground wears its aerial photograph. campus-colors.json carries a 6 m
     palette-indexed colour grid sampled from NAIP imagery; painting it as
     vertex colours turns the terrain from one invented green into the real
     patchwork — chaparral canyons, lawns, lots — for one material and zero
     texture memory. Index 255 means "no imagery there": keep the old green. */
  let material;
  if (colors?.terrain?.idx) {
    const ct = colors.terrain;
    const idx = Uint8Array.from(atob(ct.idx), (ch) => ch.charCodeAt(0));
    const palette = ct.palette.map((hex) => new THREE.Color(hex));
    const fallback = new THREE.Color(GROUND_COLOR);
    const rgb = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const cc = Math.max(0, Math.min(ct.cols - 1, Math.round((x - ct.x0) / ct.cell)));
      const rr = Math.max(0, Math.min(ct.rows - 1, Math.round((z - ct.z0) / ct.cell)));
      const k = idx[rr * ct.cols + cc];
      const col = k === 255 ? fallback : palette[k] || fallback;
      rgb[i * 3] = col.r;
      rgb[i * 3 + 1] = col.g;
      rgb[i * 3 + 2] = col.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(rgb, 3));
    material = new THREE.MeshLambertMaterial({ vertexColors: true });
  } else {
    material = new THREE.MeshLambertMaterial({ color: GROUND_COLOR });
  }

  const mesh = new THREE.Mesh(geo, material);
  scene.add(mesh);
  return { mesh, heightAt };
}

/* ---------------------------------------------------------------- lighting */

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbcd8ea);
  /* The data stops at the edge of the LiDAR box; haze hides the cut. Far
     enough out that Geisel — 300 m from Sun God Lawn and the landmark the
     whole north half of the walk steers by — reads through it. */
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
  const DEFAULTS = {
    plaza: "#cac4b6", walk: "#c9c4b8", road: "#8e8b86",
    green: "#8faa63", court: "#5e8a7e", water: "#6f9fb5",
  };
  const buckets = new Map(); // kind -> { pos: [], col: [], uv: [] }

  const addSurface = (rings, kind, hex) => {
    const outer = rings[0];
    if (!outer || outer.length < 3) return;
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

  const scoring = scoringTexture();
  const matByKind = new Map();
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
  const buckets = new Map(); // colour -> positions[]

  for (const path of campus.paths || []) {
    const pts = path.p;
    if (!pts || pts.length < 2) continue;
    const asphalt = path.s === "asphalt";
    const color = asphalt ? ASPHALT_COLOR : PATH_COLOR;
    const half = (path.steps ? 2.0 : path.n === "Ridge Walk" ? 3.4 : 2.2);
    if (!buckets.has(color)) buckets.set(color, []);
    const out = buckets.get(color);

    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[i + 1];
      const dx = bx - ax;
      const dz = bz - az;
      const len = Math.hypot(dx, dz);
      if (len < 0.01) continue;
      const nx = (-dz / len) * half;
      const nz = (dx / len) * half;
      const quad = [
        [ax + nx, az + nz], [ax - nx, az - nz],
        [bx + nx, bz + nz], [bx - nx, bz - nz],
      ].map(([x, z]) => [x, heightAt(x, z) + DRAPE, z]);
      // two triangles, wound so the front face points at the sky
      out.push(...quad[0], ...quad[2], ...quad[1]);
      out.push(...quad[1], ...quad[2], ...quad[3]);
    }
  }

  const group = new THREE.Group();
  for (const [color, positions] of buckets) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const normals = new Float32Array(positions.length);
    for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
    geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    group.add(new THREE.Mesh(geo, drapeMaterial(color)));
  }
  scene.add(group);
  return group;
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
