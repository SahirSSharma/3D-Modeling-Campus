// The things a student actually navigates by: labels, and the landmarks.
//
// LABELS. Every named building gets a small floating name at its roofline.
// Deliberately quiet — white-on-dark tags that only exist within ~300 m of
// the camera and cap at the nearest forty, so the view is annotated without
// becoming a diagram. Toggled with L.
//
// LANDMARKS. Low-poly models of the campus sculptures everyone steers by,
// from researched positions and dimensions (app/data/campus-landmarks.json).
// Fallen Star gets the full treatment — the blue cottage really does hang
// off the SW corner of Jacobs Hall's roof at a 10° tilt, and this file
// builds it plank by plank from the published numbers.
import * as THREE from "../vendor/three/three.module.min.js";

/* ------------------------------------------------------------------ labels */

const LABEL_RANGE = 240;   // metres; beyond this a label is noise
const LABEL_MAX = 26;      // at most this many at once

function labelSprite(name) {
  const pad = 8;
  const font = "600 22px Arial, Helvetica, sans-serif";
  const probe = document.createElement("canvas").getContext("2d");
  probe.font = font;
  const w = Math.ceil(probe.measureText(name).width) + pad * 2;
  const h = 34;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgba(6, 56, 77, 0.82)";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#ffcd00";
  ctx.fillRect(0, 0, 3, h);
  ctx.font = font;
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  ctx.fillText(name, pad, h / 2 + 1);
  const tex = new THREE.CanvasTexture(canvas);
  /* Depth-tested: a label whose building is hidden behind a nearer facade is
     hidden with it. Undepthed labels sprayed the names of six Revelle dorms
     across the front of Urey Hall. */
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: true, transparent: true });
  const sprite = new THREE.Sprite(mat);
  /* World size from the text's own aspect so nothing stretches; ~2.6 m tall
     reads to about 250 m without shouting up close. */
  const worldH = 2.6;
  sprite.scale.set((w / h) * worldH, worldH, 1);
  return sprite;
}

/**
 * Build one sprite per named building (lazily) and keep only the nearest few
 * visible. `info` is the Map campus-massing returns: name -> {x, z, topY}.
 */
export function createLabels(scene, info) {
  const group = new THREE.Group();
  group.renderOrder = 10;
  /* One label per BUILDING, not per naming convention: the GIS says
     "Humanities and Social Sciences", OSM says "Humanities & Social
     Sciences", and both rendered. Normalised name keeps the taller entry. */
  const byNorm = new Map();
  for (const [name, at] of info.entries()) {
    const key = name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
    const prev = byNorm.get(key);
    if (!prev || at.topY > prev.at.topY) byNorm.set(key, { name, at });
  }
  const entries = [...byNorm.values()].map(({ name, at }) => ({
    name, x: at.x, z: at.z, y: at.topY + 4, sprite: null,
  }));
  scene.add(group);

  let frame = 0;
  return {
    group,
    set visible(v) { group.visible = v; },
    get visible() { return group.visible; },
    update(camera) {
      if (!group.visible || frame++ % 20) return; // every 20th frame is plenty
      for (const e of entries) {
        e.d2 = (e.x - camera.position.x) ** 2 + (e.z - camera.position.z) ** 2;
      }
      const near = entries.filter((e) => e.d2 < LABEL_RANGE * LABEL_RANGE)
        .sort((a, b) => a.d2 - b.d2).slice(0, LABEL_MAX);
      const keep = new Set(near);
      for (const e of entries) {
        if (keep.has(e)) {
          if (!e.sprite) {
            e.sprite = labelSprite(e.name);
            e.sprite.position.set(e.x, e.y, e.z);
            group.add(e.sprite);
          }
          e.sprite.visible = true;
        } else if (e.sprite) {
          e.sprite.visible = false;
        }
      }
    },
  };
}

/* --------------------------------------------------------------- landmarks */

const lambert = (color) => new THREE.MeshLambertMaterial({ color });

/**
 * Fallen Star: the 3/4-scale cottage on Jacobs Hall's roof. Dimensions,
 * corner, tilt, cantilever, ridge bearing and colours all from the research
 * record — the one thing scaled up is nothing.
 */
function buildFallenStar(fs, toLocal, roofTopOf) {
  const g = new THREE.Group();
  const walls = lambert(fs.walls);
  const trim = lambert(fs.trim);
  const roof = lambert(fs.roof);

  const W = fs.width;   // 4.57 gable side
  const D = fs.depth;   // 5.49 along the ridge
  const bodyH = fs.height * 0.62;

  const body = new THREE.Mesh(new THREE.BoxGeometry(D, bodyH, W), walls);
  body.position.y = bodyH / 2;
  g.add(body);

  /* A-gable roof: two pitched slabs meeting at the ridge (which runs along
     the local X axis; the whole group is yawed to the real ~60° azimuth). */
  const pitchH = fs.height - bodyH;
  const slope = Math.hypot(W / 2, pitchH);
  const pitch = Math.atan2(pitchH, W / 2);
  for (const side of [-1, 1]) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(D + 0.5, 0.14, slope + 0.3), roof);
    slab.position.set(0, bodyH + pitchH / 2, (side * W) / 4);
    slab.rotation.x = side * pitch;
    g.add(slab);
  }
  // gable ends
  for (const side of [-1, 1]) {
    const shape = new THREE.Shape();
    shape.moveTo(-W / 2, 0);
    shape.lineTo(W / 2, 0);
    shape.lineTo(0, pitchH);
    shape.closePath();
    const gable = new THREE.Mesh(new THREE.ShapeGeometry(shape), walls);
    gable.position.set((side * D) / 2, bodyH, 0);
    gable.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    g.add(gable);
  }
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.6, 0.5), lambert(fs.chimney));
  chimney.position.set(D / 4, fs.height - 0.4, 0);
  g.add(chimney);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.6, 0.8), trim);
  door.position.set(-D / 2 - 0.03, 0.8, 0);
  g.add(door);

  /* Perch it: the SW corner of the host TOWER's roof, cantilevered outboard,
     leaning ~10° with the low side over the drop. The corner comes from the
     rendered mass itself rather than the researched lat/lng — a georeferenced
     point can miss by a wing; the building's own corner cannot. */
  const host = roofTopOf(fs.host);
  let [x, z] = toLocal(fs.lat, fs.lng);
  const roofY = host?.topY ?? 30;
  if (host?.ring) {
    let best = -Infinity;
    for (const [vx, vz] of host.ring) {
      const sw = vz - vx; // south is +z, west is -x: maximise both
      if (sw > best) { best = sw; x = vx + 1.2 - fs.overhang; z = vz - 1.6; }
    }
  }
  g.position.set(x, roofY, z);
  g.rotation.y = ((90 - fs.ridgeAzimuthDeg) * Math.PI) / 180;
  g.rotation.z = (-fs.tiltDeg * Math.PI) / 180;

  /* The garden strip NE of the house: lawn + the S-curve of scaled bricks. */
  const lawn = new THREE.Mesh(
    new THREE.BoxGeometry(fs.garden.d, 0.12, fs.garden.w),
    lambert("#5f7a3f")
  );
  lawn.position.set(x + 6.5, roofY + 0.06, z - 5);
  lawn.rotation.y = ((90 - fs.ridgeAzimuthDeg) * Math.PI) / 180;

  const out = new THREE.Group();
  out.add(g, lawn);
  return out;
}

/** Sun God: the white arch with the great bird — a nod, not a replica. */
function buildSunGod(lm, toLocal, heightAt) {
  const g = new THREE.Group();
  const [x, z] = toLocal(lm.lat, lm.lng);
  const y = heightAt(x, z);
  const arch = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 4.4, 8), lambert("#e8e4da"));
  arch.position.set(x, y + 2.2, z);
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.5, 10, 8), lambert("#e8524a"));
  body.position.set(x, y + 5.6, z);
  body.scale.set(0.8, 1.15, 0.6);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.62, 8, 8), lambert("#f2b02f"));
  head.position.set(x, y + 7.3, z);
  const wingMat = lambert("#3f7fc1");
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.5, 0.28), wingMat);
    wing.position.set(x + side * 1.9, y + 6.1, z);
    wing.rotation.z = side * 0.5;
    g.add(wing);
  }
  g.add(arch, body, head);
  return g;
}

/** Warren Bear: eight granite boulders stacked into a teddy bear. */
function buildBear(lm, toLocal, heightAt) {
  const g = new THREE.Group();
  const [x, z] = toLocal(lm.lat, lm.lng);
  const y = heightAt(x, z);
  const stone = lambert("#b9b2a6");
  const put = (dx, dy, dz, r, squash = 1) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 7), stone);
    m.position.set(x + dx, y + dy, z + dz);
    m.scale.y = squash;
    g.add(m);
  };
  put(0, 1.5, 0, 1.9, 0.85);      // seated body
  put(0, 4.1, 0, 1.35);           // head
  put(-1.5, 4.9, 0, 0.55);        // ears
  put(1.5, 4.9, 0, 0.55);
  put(-2.0, 1.1, 0.4, 0.85);      // arms
  put(2.0, 1.1, 0.4, 0.85);
  put(-1.1, 0.55, 1.5, 0.95, 0.7); // legs forward
  put(1.1, 0.55, 1.5, 0.95, 0.7);
  return g;
}

/**
 * Place every landmark worth geometry. `roofTopOf(name)` lets roof-mounted
 * pieces (Fallen Star) sit on the measured building they belong to.
 */
export function createLandmarks(scene, data, { origin, heightAt, roofTopOf }) {
  const toLocal = (lat, lng) => [
    (lng - origin.lng) * origin.mPerDegLng,
    -(lat - origin.lat) * origin.mPerDegLat,
  ];
  const group = new THREE.Group();
  if (data.fallenStar) group.add(buildFallenStar(data.fallenStar, toLocal, roofTopOf));
  for (const lm of data.landmarks || []) {
    if (lm.name === "Sun God") group.add(buildSunGod(lm, toLocal, heightAt));
    else if (/Warren Bear/.test(lm.name)) group.add(buildBear(lm, toLocal, heightAt));
  }
  scene.add(group);
  return group;
}
