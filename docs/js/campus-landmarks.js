// The things a student actually navigates by: labels, and the landmarks.
//
// LABELS. Every named building gets a small floating name at its roofline.
// Deliberately quiet — white-on-dark tags that only exist within ~300 m of
// the camera and cap at the nearest forty, so the view is annotated without
// becoming a diagram. Toggled with L.
//
// LANDMARKS. Low-poly models of the campus sculptures everyone steers by,
// from researched positions and dimensions (docs/data/campus-landmarks.json).
// Colours are DATA, not literals in here: every hex comes from the `colors`
// block of the landmark it belongs to, because these were guessed once and
// the guesses were wrong — the Sun God was built as a red bird with a gold
// head on a white arch, which is the real statue almost exactly inverted.
// Fallen Star gets the full treatment — the blue cottage really does hang
// off a south-west corner of Jacobs Hall at a 10° tilt, and this file builds
// it plank by plank from the published numbers.
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

/* Outboard unit direction per corner tag, in the world's axes: +x east,
   +z south. `corner: "SW"` means the piece hangs west and south. */
export const CORNER_DIR = {
  NE: [1, -1], NW: [-1, -1], SE: [1, 1], SW: [-1, 1],
  N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0],
};

/* How far from the surveyed point we will look for a corner to hang off. */
const CORNER_SNAP_M = 15;

/**
 * The vertex of `ring` furthest in the corner's outboard direction, searched
 * only near the surveyed point.
 *
 * Two things this fixes over sweeping the whole ring for its most south-west
 * vertex. First, "south-west" was arithmetic in here while the JSON carried a
 * `corner` field that nothing read, so the data could disagree with the
 * renderer and no one would know. Second, an unbounded sweep will happily
 * move the house to the far end of whatever mass it is handed: it works today
 * because roofTopOf resolves "Jacobs Hall" to the 7-storey tower, whose SW
 * corner is also the vertex nearest the survey — hand it the 4-storey
 * footprint instead and the same code puts the cottage 30 m away, on a wing
 * the aerials (D:f0034–f0036) plainly show it is not on.
 */
function snapToCorner(ring, x, z, corner) {
  const [ex, ez] = CORNER_DIR[corner] || CORNER_DIR.SW;
  let best = null;
  let score = -Infinity;
  for (const [vx, vz] of ring) {
    if (Math.hypot(vx - x, vz - z) > CORNER_SNAP_M) continue;
    const s = vx * ex + vz * ez;
    if (s > score) { score = s; best = [vx, vz]; }
  }
  return best;
}

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

  /* Perch it: the tagged corner of the host TOWER's roof, cantilevered
     outboard, leaning ~10° with the low side over the drop. The surveyed
     point puts it on the right tower; the ring sharpens it to that tower's
     own corner. */
  const [ex, ez] = CORNER_DIR[fs.corner] || CORNER_DIR.SW;
  const host = roofTopOf(fs.host);
  let [x, z] = toLocal(fs.lat, fs.lng);
  const roofY = host?.topY ?? 30;
  const corner = host?.ring && snapToCorner(host.ring, x, z, fs.corner);
  if (corner) {
    x = corner[0] + ex * (fs.overhang - 1.2);
    z = corner[1] - ez * 1.6;
  }
  g.position.set(x, roofY, z);
  g.rotation.y = ((90 - fs.ridgeAzimuthDeg) * Math.PI) / 180;
  g.rotation.z = (-fs.tiltDeg * Math.PI) / 180;

  /* The garden fills the rest of the tower roof, inboard of the house —
     opposite whichever way the house hangs: lawn + the S-curve of bricks. */
  const lawn = new THREE.Mesh(
    new THREE.BoxGeometry(fs.garden.d, 0.12, fs.garden.w),
    lambert(fs.garden.color)
  );
  lawn.position.set(x - ex * 6.5, roofY + 0.06, z - ez * 5);
  lawn.rotation.y = ((90 - fs.ridgeAzimuthDeg) * Math.PI) / 180;

  const out = new THREE.Group();
  out.add(g, lawn);
  return out;
}

/**
 * Sun God: a white bird under a gold sunburst, on an arch buried in ivy.
 *
 * Built from D:f0101 (close aerial) and W:f0059 (eye level, sunlit). What
 * the footage settles, and what the model had backwards: the BODY is white
 * and the HEAD is scarlet, not the other way round; the colour on the body
 * is not confetti but four or five very large concentric discs; the crest is
 * a fan of gold spikes radiating from behind the head; and the arch is not
 * pale concrete at all — it is a green mass, grown over with ivy, showing
 * concrete only on the cap the bird stands on.
 */
function buildSunGod(lm, toLocal, heightAt) {
  const c = lm.colors || {};
  const g = new THREE.Group();
  const [x, z] = toLocal(lm.lat, lm.lng);
  const y = heightAt(x, z);

  /* The arch, ~4.5 m: two ivy piers under an ivy lintel, capped in concrete.
     The opening between the piers is the dark arch you walk under. */
  const ivy = lambert(c.arch);
  for (const side of [-1, 1]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(1.3, 3.4, 1.9), ivy);
    pier.position.set(x + side * 1.75, y + 1.7, z);
    g.add(pier);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.8, 1.9), ivy);
  lintel.position.set(x, y + 3.8, z);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.3, 2.1), lambert(c.archCap));
  cap.position.set(x, y + 4.35, z);
  g.add(lintel, cap);

  /* The bird, ~4.3 m from its feet to the tips of the crest. */
  const base = y + 4.5;
  const white = lambert(c.body);
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 8), white);
  body.position.set(x, base + 1.55, z);
  body.scale.set(0.85, 1.2, 0.62);
  g.add(body);

  /* Concentric rings as coaxial cylinders of increasing length: the inner
     rings poke out past the outer ones, so one stack reads as a target from
     either side of the statue — and the statue has no fixed front. */
  const disc = (dx, dy, dz, r, thick, rings) => {
    rings.forEach((color, i) => {
      const rr = r * (1 - i / rings.length);
      const ring = new THREE.Mesh(
        new THREE.CylinderGeometry(rr, rr, thick + i * 0.09, 12), lambert(color)
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x + dx, base + dy, z + dz);
      g.add(ring);
    });
  };
  const target = [c.discRed, c.discGreen, c.discGold, c.discBlue];

  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.15, 0.26), white);
    wing.position.set(x + side * 1.75, base + 1.85, z);
    wing.rotation.z = side * 0.28;
    g.add(wing);
    disc(side * 1.75, 1.85, 0, 0.46, 0.34, target);
  }
  // chest: red/blue rings around a gold sun-centre, on both faces
  for (const face of [-1, 1]) {
    disc(0, 1.6, face * 0.66, 0.52, 0.2, [c.discRed, c.discBlue, c.discGold]);
  }

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.62, 8, 8), lambert(c.head));
  head.position.set(x, base + 3.2, z);
  /* Nose-down, not straight out: a cone pointed at the viewer is a dot, and
     the beak is the second thing you recognise the bird by. */
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.05, 6), lambert(c.beak));
  beak.position.set(x, base + 2.95, z + 0.78);
  beak.rotation.x = Math.PI * 0.68;
  g.add(head, beak);

  /* The crest: gold spikes fanning up and out from behind the head, longest
     at the top, splaying to nearly horizontal at the ends. */
  const gold = lambert(c.crest);
  const SPIKES = 9;
  for (let i = 0; i < SPIKES; i++) {
    const a = -1.25 + (2.5 * i) / (SPIKES - 1);
    const len = 0.95 - 0.22 * Math.abs(a);
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.12, len, 5), gold);
    const r = 0.5 + len / 2;
    spike.position.set(x + Math.sin(a) * r, base + 3.2 + Math.cos(a) * r, z - 0.18);
    spike.rotation.z = -a;
    g.add(spike);
  }

  // feet: the painted claws gripping the cap
  const claws = [c.discRed, c.discBlue, c.discGreen, c.discGold];
  claws.forEach((color, i) => {
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.26, 6, 5), lambert(color));
    foot.position.set(x + (i - 1.5) * 0.42, base + 0.2, z + (i % 2 ? 0.3 : -0.3));
    g.add(foot);
  });
  return g;
}

/** Warren Bear: eight granite boulders stacked into a teddy bear. */
function buildBear(lm, toLocal, heightAt) {
  const g = new THREE.Group();
  const [x, z] = toLocal(lm.lat, lm.lng);
  const y = heightAt(x, z);
  const stone = lambert(lm.colors?.granite);
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
