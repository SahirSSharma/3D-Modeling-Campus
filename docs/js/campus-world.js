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
// Nothing here knows anything about walking or gameplay. It makes the world and
// hands back a height field; campus-walk.js moves through it.
import * as THREE from "../vendor/three/three.module.min.js";

/* Campus on a clear morning: bleached concrete, tan and off-white stucco,
   eucalyptus. Buildings pick from the palette by a hash of position so a given
   building is the same colour on every visit — a skyline that reshuffles itself
   reads as broken even when nobody can say why. */
const BUILDING_COLORS = [0xd9d2c5, 0xcfc6b6, 0xe0dad0, 0xc6bcab, 0xd2cabb, 0xbfb5a4];
const ROOF_COLOR = 0xa8a094;
const GROUND_COLOR = 0x93a06d;
const PLAZA_COLOR = 0xcac4b6;
const PATH_COLOR = 0xc9c4b8;
const ASPHALT_COLOR = 0x8e8b86;
const WATER_COLOR = 0x6f9fb5;

const hash = (x, z) => Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;

/* Storey height and window bay width, in metres. Everything about how big a
   building LOOKS comes from these: a blank wall gives the eye nothing to
   measure against, so a 12 m building and a 30 m building are the same object
   at different distances. Floor lines are what makes a massing model readable. */
const STOREY = 3.6;
const BAY = 3.2;

/**
 * A facade, drawn once into a canvas and tiled across every wall.
 *
 * Procedural rather than an image file for two reasons: nothing external can
 * be fetched under the site's CSP, and a tile generated here is guaranteed to
 * line up with the STOREY and BAY constants that the rest of the massing
 * assumes. ExtrudeGeometry's default UV generator emits side-wall UVs in world
 * units, so setting repeat to 1/BAY and 1/STOREY lands exactly one window bay
 * per bay and one band per storey, at any building size, with no per-building
 * UV work.
 */
function facadeTexture() {
  const S = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d");

  // Concrete field. The material colour tints this, so it is deliberately pale.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, S, S);

  // The window band: one horizontal run per storey, inset from the floor line.
  ctx.fillStyle = "#8d97a1";
  ctx.fillRect(4, 14, S - 8, 30);

  // Mullions, splitting the band into panes.
  ctx.fillStyle = "#ffffff";
  for (let x = 4; x < S - 4; x += 14) ctx.fillRect(x, 14, 4, 30);

  // Spandrel shadow under each band, which is what actually reads as a floor
  // line from across a plaza.
  ctx.fillStyle = "rgba(0,0,0,0.16)";
  ctx.fillRect(0, 44, S, 5);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1 / BAY, 1 / STOREY);
  tex.anisotropy = 4;
  return tex;
}

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
export function createTerrain(scene, lidar) {
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

  const geo = new THREE.PlaneGeometry(
    (cols - 1) * cell, (rows - 1) * cell, cols - 1, rows - 1
  );
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    /* PlaneGeometry lays vertices out row-major from -w/2,-h/2; after the
       rotation that is +x east and +z south, which is the same frame the data
       is in, so the index maps straight across. */
    const c = i % cols;
    const r = Math.floor(i / cols);
    pos.setY(i, heights[r * cols + c] / 10);
  }
  geo.computeVertexNormals();
  geo.translate(x0 + ((cols - 1) * cell) / 2, 0, z0 + ((rows - 1) * cell) / 2);

  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: GROUND_COLOR }));
  scene.add(mesh);
  return { mesh, heightAt };
}

/* ---------------------------------------------------------------- lighting */

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbcd8ea);
  /* The data stops at the edge of the LiDAR box; haze hides the cut. */
  scene.fog = new THREE.Fog(0xc4dcec, 140, 460);

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

/**
 * Extrude each OSM footprint to its MEASURED height.
 *
 * Buildings are sunk to the lowest ground under their own footprint and raised
 * to their measured roof. On a slope that means a wall face taller than the
 * quoted height, which is correct — the quoted height is roof above grade at
 * the centre, and a building on a hill really is taller on its downhill side.
 */
export function createBuildings(scene, campus, lidar, heightAt) {
  const facade = facadeTexture();
  const materials = BUILDING_COLORS.map(
    (color) => new THREE.MeshLambertMaterial({ color, map: facade })
  );
  const roofMaterial = new THREE.MeshLambertMaterial({ color: ROOF_COLOR });
  const group = new THREE.Group();
  let measured = 0;

  for (const b of campus.buildings) {
    const ring = b.p;
    let lowest = Infinity;
    let centreX = 0;
    let centreZ = 0;
    for (const [x, z] of ring) {
      lowest = Math.min(lowest, heightAt(x, z));
      centreX += x;
      centreZ += z;
    }
    centreX /= ring.length;
    centreZ /= ring.length;

    /* Measured beats tagged beats guessed. b.h is OSM's answer and stays only
       where LiDAR saw too few returns to be sure. */
    const lidarHeight = b.n ? lidar.heights[b.n] : undefined;
    if (lidarHeight !== undefined) measured++;
    const height = lidarHeight ?? b.h;
    const roofY = heightAt(centreX, centreZ) + height;
    const baseY = lowest - 1.5; // buried a little so no gap opens on a slope
    const extrude = Math.max(1, roofY - baseY);

    const shape = new THREE.Shape();
    shape.moveTo(ring[0][0], ring[0][1]);
    for (let i = 1; i < ring.length; i++) shape.lineTo(ring[i][0], ring[i][1]);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, { depth: extrude, bevelEnabled: false });
    geo.rotateX(Math.PI / 2);
    geo.translate(0, baseY + extrude, 0);

    const pick = Math.floor(hash(ring[0][0], ring[0][1]) * materials.length);
    /* ORDER MATTERS AND IS NOT THE OBVIOUS ONE. ExtrudeGeometry emits material
       group 0 for the LIDS (roof and underside) and group 1 for the SIDE WALLS.
       Passing [wall, roof] therefore paints the roof colour onto every wall —
       which is why the whole campus rendered as identical grey cardboard no
       matter what the per-building palette said, and why a facade texture put
       on the wall material was nowhere to be seen. */
    const mesh = new THREE.Mesh(geo, [roofMaterial, materials[pick]]);
    mesh.userData.name = b.n || null;
    mesh.userData.measured = lidarHeight !== undefined;
    group.add(mesh);
  }

  scene.add(group);
  return { group, measured, total: campus.buildings.length };
}

/* ---------------------------------------------------------------- surfaces */

/** Plazas, water and green space, draped over the terrain. */
export function createSurfaces(scene, campus, heightAt) {
  const group = new THREE.Group();
  const mats = {
    plaza: drapeMaterial(PLAZA_COLOR),
    green: drapeMaterial(0x8faa63),
    water: new THREE.MeshLambertMaterial({ color: WATER_COLOR, side: THREE.DoubleSide }),
  };

  for (const s of campus.surfaces || []) {
    const ring = s.p;
    if (!ring || ring.length < 3) continue;
    /* NOTE THE NEGATED Z.
     *
     * A Shape is drawn in the XY plane and rotateX(-90°) lays it flat, which
     * maps the shape's Y onto world -Z — so feeding it (x, z) directly mirrors
     * the polygon to the far side of the origin. Revelle Plaza and its fountain
     * were being drawn hundreds of metres away across campus, which is why
     * standing in the middle of the plaza put you on grass while the label
     * cheerfully announced "Revelle Plaza".
     *
     * Negating here rather than rotating the other way is deliberate: rotateX(+90°)
     * would place the polygon correctly but leave its normals pointing at the
     * ground, and a down-facing surface gets lit by the hemisphere light's
     * GROUND colour — the same mistake that once rendered campus concrete as
     * dark olive. */
    const shape = new THREE.Shape();
    shape.moveTo(ring[0][0], -ring[0][1]);
    for (let i = 1; i < ring.length; i++) shape.lineTo(ring[i][0], -ring[i][1]);
    shape.closePath();

    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    /* Drape: every vertex is pushed down onto the measured ground rather than
       left on a flat sheet, so a plaza follows the grade it was built on. */
    const pos = geo.attributes.position;
    const lift = s.kind === "water" ? DRAPE + 0.12 : DRAPE;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)) + lift);
    }
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, mats[s.kind] || mats.plaza);
    mesh.userData.name = s.n || null;
    group.add(mesh);
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
    const crownR = Math.max(1.2, Math.min(r, (h - CLEARANCE) / 2));
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
  /* Grouped rather than added loose, so the whole canopy can be hidden in one
     move — trees are the layer most often in the way when checking a building. */
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
