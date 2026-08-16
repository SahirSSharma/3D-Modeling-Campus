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

/* Two looks, because the two modes read labels from completely different
 * distances and speeds.
 *
 *   plate — free roam's original. A hard-edged panel with a gold left rule,
 *           sized in WORLD metres, so it shrinks with distance the way a sign
 *           bolted to the roof would. Correct for a surveyor 110 m up.
 *   ride  — the scooter run's. A rounded pill at a CONSTANT SCREEN size, fading
 *           in as it comes into range and out again at the edge. At 6.9 m/s at
 *           eye level a world-scaled label is unreadable until you are already
 *           past the building, which is the wrong half of the ride to read it.
 */
const LABEL_STYLES = {
  plate: {
    range: LABEL_RANGE, max: LABEL_MAX, stride: 20, screenSpace: false, fade: 0,
    /* Four metres clear of the roofline — read from above, where free roam is. */
    anchor: (at) => at.topY + 4,
  },
  ride: {
    range: 190, max: 16, stride: 5, screenSpace: true, fade: 70,
    /* Just clear of the roofline — and it HAS to be clear of it.
     *
     * The obvious idea at eye level is to drop labels to about head height so
     * they sit in the forward view. That fails, and fails invisibly: the
     * anchor is the mass CENTROID, so a label nine metres up is nine metres up
     * inside the building, and depth testing correctly hides it behind the
     * facade it is buried in. Sixteen labels rendered, positioned and faded
     * exactly as intended, and the building's own wall ate them.
     *
     * Two metres over the roof is outside the mass from every angle. It is
     * also perfectly visible from a deck: a 25 m building 100 m down the
     * walkway puts its label 13 degrees above the centre of a 70 degree view.
     * Lower than the plate style's +4 only because there is no reason to
     * shout when the camera is not 110 m up. */
    anchor: (at) => at.topY + 2,
  },
};

/* Rounded rectangle, because CanvasRenderingContext2D.roundRect is not in
   every browser this has to run in. */
function pill(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function labelSprite(name, style) {
  const ride = style.screenSpace;
  const pad = ride ? 14 : 8;
  const font = ride
    ? "600 24px ui-sans-serif, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"
    : "600 22px Arial, Helvetica, sans-serif";
  const probe = document.createElement("canvas").getContext("2d");
  probe.font = font;
  const w = Math.ceil(probe.measureText(name).width) + pad * 2;
  const h = ride ? 40 : 34;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");

  if (ride) {
    /* Glass pill: a soft dark ground with a hairline edge and the accent as a
       dot rather than a bar, so a row of them down a walkway reads as a set of
       tags instead of a fence. */
    pill(ctx, 1, 1, w - 2, h - 2, (h - 2) / 2);
    ctx.fillStyle = "rgba(8, 26, 34, 0.72)";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(pad - 3, h / 2, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = "#ffc63d";
    ctx.fill();
    ctx.font = font;
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "middle";
    ctx.fillText(name, pad + 6, h / 2 + 1);
  } else {
    ctx.fillStyle = "rgba(6, 56, 77, 0.82)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#ffcd00";
    ctx.fillRect(0, 0, 3, h);
    ctx.font = font;
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "middle";
    ctx.fillText(name, pad, h / 2 + 1);
  }

  const tex = new THREE.CanvasTexture(canvas);
  /* Depth-tested: a label whose building is hidden behind a nearer facade is
     hidden with it. Undepthed labels sprayed the names of six Revelle dorms
     across the front of Urey Hall. */
  const mat = new THREE.SpriteMaterial({
    map: tex, depthTest: true, transparent: true,
    /* Screen-space in ride style: the sprite scale becomes a fraction of the
       viewport instead of a size in metres, so a label 180 m down the walkway
       is exactly as legible as one beside you. */
    sizeAttenuation: !ride,
  });
  const sprite = new THREE.Sprite(mat);
  if (ride) {
    const screenH = 0.05; // ~5% of viewport height
    sprite.scale.set((w / h) * screenH, screenH, 1);
  } else {
    /* World size from the text's own aspect so nothing stretches; ~2.6 m tall
       reads to about 250 m without shouting up close. */
    const worldH = 2.6;
    sprite.scale.set((w / h) * worldH, worldH, 1);
  }
  return sprite;
}

/**
 * Build one sprite per named building (lazily) and keep only the nearest few
 * visible. `info` is the Map campus-massing returns: name -> {x, z, topY}.
 *
 * `opts.style` picks the look — "plate" (default, free roam, unchanged) or
 * "ride" (the scooter run's constant-screen-size pill). `opts.range`,
 * `opts.max` and `opts.stride` override the style's own numbers. Defaulting
 * everything keeps free roam's call site a two-argument call.
 */
export function createLabels(scene, info, opts = {}) {
  const style = { ...(LABEL_STYLES[opts.style] || LABEL_STYLES.plate), ...opts };
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
    name, x: at.x, z: at.z, y: style.anchor(at), sprite: null,
  }));
  scene.add(group);

  let frame = 0;
  return {
    group,
    set visible(v) { group.visible = v; },
    get visible() { return group.visible; },
    update(camera) {
      if (!group.visible || frame++ % style.stride) return;
      for (const e of entries) {
        e.d2 = (e.x - camera.position.x) ** 2 + (e.z - camera.position.z) ** 2;
      }
      const near = entries.filter((e) => e.d2 < style.range * style.range)
        .sort((a, b) => a.d2 - b.d2).slice(0, style.max);
      const keep = new Set(near);
      for (const e of entries) {
        if (keep.has(e)) {
          if (!e.sprite) {
            e.sprite = labelSprite(e.name, style);
            e.sprite.position.set(e.x, e.y, e.z);
            group.add(e.sprite);
          }
          e.sprite.visible = true;
          /* Fade the last stretch of range in and out. Without it a label
             springs into existence at full strength exactly `range` metres
             away, which at riding speed is a flicker down the whole walkway. */
          if (style.fade > 0) {
            const d = Math.sqrt(e.d2);
            e.sprite.material.opacity = Math.max(0, Math.min(1, (style.range - d) / style.fade));
          }
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

/* ------------------------------------------------- shared low-poly plumbing */

/**
 * Concatenate a few boxes into one geometry. Not a general merge — position
 * and normal only, non-indexed — which is all a Lambert box needs, and it
 * turns a bench (seat, back, two legs) into a single instanced draw.
 */
function weld(...geos) {
  const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const out = new THREE.BufferGeometry();
  for (const name of ["position", "normal"]) {
    const total = parts.reduce((n, p) => n + p.attributes[name].array.length, 0);
    const arr = new Float32Array(total);
    let at = 0;
    for (const p of parts) { arr.set(p.attributes[name].array, at); at += p.attributes[name].array.length; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, 3));
  }
  return out;
}

/**
 * One instanced copy of `geo` per `[x, y, z, yaw, scaleY]`.
 *
 * These pieces are on screen from most of the walk and have no distance
 * culling of their own, so everything that repeats — a trellis slat, a folded
 * plate, an arcade column — is one draw call rather than sixty.
 */
function instanced(geo, mat, transforms) {
  const mesh = new THREE.InstancedMesh(geo, mat, transforms.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  transforms.forEach(([x, y, z, yaw = 0, scaleY = 1], i) => {
    p.set(x, y, z);
    q.setFromEuler(e.set(0, yaw, 0));
    s.set(1, scaleY, 1);
    mesh.setMatrixAt(i, m.compose(p, q, s));
  });
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

const box = (w, h, d, x = 0, y = 0, z = 0) => {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
};

/* A bearing in compass degrees, as the yaw that puts local +X along it.
   Local +X maps to (cos y, 0, -sin y), and bearing B points at
   (sin B, 0, -cos B), so y = 90° - B — the same convention Fallen Star's
   ridge azimuth already uses. */
const yawForBearing = (deg) => ((90 - deg) * Math.PI) / 180;

/* The standing wave the flag is bent onto: sideways displacement as a
   fraction of the way along the fly, ramping from nothing at the hoist —
   where the cloth is pinned — to full at the free edge. Every stripe and the
   union share this one curve, which is what keeps them reading as one cloth
   rather than thirteen slats. SPEC: a flag's shape is not something W:f0035
   resolves at 15 m, and nothing measured depends on it. */
const FLAG_WAVE = { cycles: 1.15, amp_m: 0.16, perFly: 10, thick_m: 0.035 };
const flagWave = (t) => FLAG_WAVE.amp_m * t * Math.sin(FLAG_WAVE.cycles * 2 * Math.PI * t);

/**
 * One stripe of the flag: a ribbon of `hoist` height running from `t0` to
 * `t1` along a fly of `fly` metres, bent onto the wave.
 *
 * Welded into ONE geometry per stripe shape, because there are only two
 * shapes — a full-width stripe and the short one that starts outboard of the
 * union — and the thirteen stripes are then four instanced draws rather than
 * thirteen meshes on a plaza the ride crosses at speed.
 *
 * Segmented on ONE grid across the whole fly (`perFly` facets end to end),
 * not `n` facets per ribbon. The union ends two tenths of the way along, so a
 * per-ribbon split put the short stripes' facet edges between the full
 * stripes', and the top and bottom halves of the flag caught the light as two
 * separate sheets with a crease down the middle of the cloth.
 */
function flagRibbon(fly, hoist, t0, t1) {
  const parts = [];
  const n = Math.max(1, Math.round((t1 - t0) * FLAG_WAVE.perFly));
  for (let i = 0; i < n; i++) {
    const a = t0 + ((t1 - t0) * i) / n;
    const b = t0 + ((t1 - t0) * (i + 1)) / n;
    const dz = (b - a) * fly;
    const dx = flagWave(b) - flagWave(a);
    /* 6% long so the chord segments overlap at the joints instead of opening
       a slot of daylight on the inside of every bend. */
    const seg = new THREE.BoxGeometry(FLAG_WAVE.thick_m, hoist, Math.hypot(dx, dz) * 1.06);
    seg.rotateY(Math.atan2(dx, dz));
    seg.translate((flagWave(a) + flagWave(b)) / 2, 0, ((a + b) / 2) * fly);
    parts.push(seg);
  }
  return weld(...parts);
}

/**
 * Revelle Plaza's ring fountain, and the flagpole beside it.
 *
 * The plaza is the first thing the walk crosses and this is the only object
 * in it, so it carries more than its size: an 8 m charcoal ring with one
 * aerating jet. The basin measures very nearly black in W:f0035 — the darkest
 * thing on a plaza of pale concrete — and the JSON entry carries the daylight
 * lift of that reading, with the raw sample written down beside it.
 */
function buildFountain(lm, toLocal, heightAt) {
  const c = lm.colors || {};
  const f = lm.fountain || {};
  const g = new THREE.Group();
  const [x, z] = toLocal(lm.lat, lm.lng);
  const y = heightAt(x, z);
  const r = (f.diameter_m || 8) / 2;
  const rim = f.rimHeight_m || 0.55;

  const basin = new THREE.Mesh(new THREE.CylinderGeometry(r, r, rim, 28), lambert(c.basin));
  basin.position.set(x, y + rim / 2, z);
  g.add(basin);

  /* Water a hand's width down from the rim, so the ring reads as a lip you
     could sit on rather than a disc painted on the plaza. */
  const water = new THREE.Mesh(new THREE.CircleGeometry(r - 0.4, 24), lambert(c.water));
  water.rotation.x = -Math.PI / 2;
  water.position.set(x, y + rim - 0.09, z);
  g.add(water);

  /* ONE jet, aerated: a foam plume that flares as it rises, with the ball of
     spray at its top. W:f0034 and W:f0035 both show a single stalk — this is
     not a fan of nozzles and should never grow into one. Scaled off the basin
     in W:f0035, where the plume is about a quarter of the 8 m basin across at
     the top: a narrow pencil of water is the wrong picture. */
  const jetH = f.jetHeight_m || 2.2;
  const flare = r * 0.21;
  const foam = lambert(c.foam);
  const jet = new THREE.Mesh(new THREE.CylinderGeometry(flare, 0.12, jetH, 10), foam);
  jet.position.set(x, y + rim + jetH / 2, z);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(flare * 1.1, 9, 6), foam);
  crown.position.set(x, y + rim + jetH, z);
  crown.scale.y = 0.42;
  g.add(jet, crown);

  const fp = lm.flagpole || {};
  const poleH = fp.height_m || 15;
  const fz = z - (fp.north_m || 12);
  const fy = heightAt(x, fz);
  const metal = lambert(c.pole);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.15, poleH, 8), metal);
  pole.position.set(x, fy + poleH / 2, fz);
  g.add(pole);

  /* Truck and gold ball at the top, halyard down the back of the pole to a
     cleat at chest height. SPEC, all of it: what a source settles here is
     that the pole is there and that it flies the US flag (Revelle's own page
     lists the Plaza as hosting the May 1970 Peace Memorial and the U.S.
     Flag; W:f0034–f0036 place it). No frame resolves the hardware at 15 m,
     so this is the standard article for a ground-set pole of that height and
     the JSON says so. */
  const truck = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.09, 8), metal);
  truck.position.set(x, fy + poleH + 0.045, fz);
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), lambert(c.flagGold));
  finial.position.set(x, fy + poleH + 0.26, fz);
  g.add(truck, finial);

  /* The halyard stands a little further off the pole at the bottom than at
     the top, because the pole tapers — run it parallel and the rope
     disappears inside the base. */
  const cleatY = 1.35;
  const rise = poleH - 0.08 - cleatY;
  const lean = 0.10;
  const rope = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, Math.hypot(rise, lean), 4), lambert(c.halyard)
  );
  rope.position.set(x, fy + cleatY + rise / 2, fz - 0.15);
  rope.rotation.x = Math.atan2(lean, rise);
  const cleat = lambert(c.cleat);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.05), cleat);
  bar.position.set(x, fy + cleatY, fz - 0.24);
  const stub = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.13), cleat);
  stub.position.set(x, fy + cleatY, fz - 0.18);
  g.add(rope, bar, stub);

  /* The flag to the published proportions: hoist A, fly 1.9 A, thirteen
     equal stripes with red top and bottom (seven red, six white), and a
     union 7/13 A tall by 0.76 A wide over the top seven. The seven stripes
     behind the union are BUILT SHORT rather than run under it — same
     thickness, same wave, so a full stripe and the union would z-fight along
     the whole of the hoist.
     A is 1.52 m, the conventional flag for a 15 m pole, and the +z fly
     direction is inherited from the old three-slab flag. Both are spec. */
  const A = 1.52;
  const B = A * 1.9;
  const band = A / 13;
  const unionT = 0.76 / 1.9;              // the union ends 40% along the fly
  const flag = new THREE.Group();
  /* The hoist starts at the pole's SURFACE, not on its axis — the ribbon runs
     from local z = 0, so hanging the group on the centreline buries the first
     segment of every stripe inside the mast. */
  flag.position.set(x, fy + poleH - 0.18 - A / 2, fz + 0.07);

  const rows = { redFull: [], whiteFull: [], redShort: [], whiteShort: [] };
  for (let i = 0; i < 13; i++) {
    const y = (i + 0.5) * band - A / 2;
    const red = i % 2 === 0;              // stripe 0 is the bottom one, and red
    const behind = i >= 6;                // the union covers the top seven
    rows[`${red ? "red" : "white"}${behind ? "Short" : "Full"}`].push([0, y, 0]);
  }
  const full = flagRibbon(B, band, 0, 1);
  const short = flagRibbon(B, band, unionT, 1);
  const red = lambert(c.flagRed);
  const white = lambert(c.flagWhite);
  flag.add(
    instanced(full, red, rows.redFull),
    instanced(full, white, rows.whiteFull),
    instanced(short, red, rows.redShort),
    instanced(short, white, rows.whiteShort)
  );

  const unionH = band * 7;
  const union = new THREE.Mesh(flagRibbon(B, unionH, 0, unionT), lambert(c.flagBlue));
  union.position.y = A / 2 - unionH / 2;
  flag.add(union);

  /* Fifty stars in the real 6/5 nine-row grid, on BOTH faces — the flag is a
     slab you can stand either side of. Each one is set on the wave and yawed
     onto the local tangent, because the cloth bends more across the union
     than a star is thick, and a star laid on a flat plane would sink into
     the blue for half its span. One instanced draw for all hundred. */
  const stars = [];
  const halfT = FLAG_WAVE.thick_m / 2 + 0.006;
  for (let r = 1; r <= 9; r++) {
    const y = A / 2 - (unionH * r) / 10;
    for (let col = r % 2 ? 1 : 2; col <= 11; col += 2) {
      const t = (unionT * col) / 12;
      const yaw = Math.atan2(flagWave(t + 0.004) - flagWave(t - 0.004), 0.008 * B);
      for (const face of [-1, 1]) {
        stars.push([
          flagWave(t) + face * halfT * Math.cos(yaw),
          y,
          t * B - face * halfT * Math.sin(yaw),
          yaw,
        ]);
      }
    }
  }
  flag.add(instanced(box(0.01, 0.088, 0.088), white, stars));
  g.add(flag);
  return g;
}

/**
 * A pergola swing-bench station: black steel trellis, pale slat roof, bench
 * swings hanging under it and fixed benches beside them.
 *
 * Built from the spec block rather than the name, so the second station — and
 * any station added later — needs data, not code. Both are authored along
 * local +X and yawed onto the walk they line, which is why the two entries
 * differ by one bearing and one length.
 */
function buildPergola(lm, toLocal, heightAt) {
  const c = lm.colors || {};
  const p = lm.pergola || {};
  const L = p.length_m || 24;
  const D = p.depth_m || 3.6;
  const H = p.height_m || 3.1;
  const [cx, cz] = toLocal(lm.lat, lm.lng);
  const g = new THREE.Group();
  g.position.set(cx, heightAt(cx, cz), cz);
  g.rotation.y = yawForBearing(p.bearingDeg || 0);

  const frame = lambert(c.frame);
  const roof = lambert(c.roof);
  const seat = lambert(c.bench);

  const bays = Math.max(2, Math.round(L / (p.postEvery_m || 4.2)));
  const posts = [];
  for (let i = 0; i <= bays; i++) {
    const px = -L / 2 + (L * i) / bays;
    posts.push([px, H / 2, -D / 2], [px, H / 2, D / 2]);
  }
  g.add(instanced(box(0.16, H, 0.16), frame, posts));
  for (const side of [-1, 1]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(L, 0.24, 0.18), frame);
    beam.position.set(0, H - 0.12, (side * D) / 2);
    g.add(beam);
  }

  /* Slats run across the depth, not along the run — it is the shadow they
     throw on the paving that identifies this thing at fifty metres. */
  const slats = [];
  for (let sx = -L / 2 + 0.2; sx <= L / 2 - 0.2; sx += 0.42) slats.push([sx, H + 0.06, 0]);
  g.add(instanced(box(0.09, 0.07, D + 0.5), roof, slats));

  /* One welded unit per swing (seat, back, two rods) and per bench (seat,
     back, two legs). Each swing also gets a steel cross-member to hang FROM,
     added below: the swings sit at the middle of the depth and the long
     beams run along the edges 1.8 m away, so without it every rod ended at
     beam height in open air — hanging from nothing, at eye level, on the
     closest landmark the route passes. The member spans the depth, lands on
     both beams (the 0.11 m of shared volume is the joint), and the rods run
     0.02 m up into it. */
  const rod = H - 0.24 - 0.55;   // beam underside down to a seat you can sit on
  const swingUnit = weld(
    box(1.7, 0.09, 0.52, 0, 0, 0),
    box(1.7, 0.44, 0.07, 0, 0.24, -0.26),
    box(0.05, rod + 0.02, 0.05, -0.8, (rod + 0.02) / 2, 0),
    box(0.05, rod + 0.02, 0.05, 0.8, (rod + 0.02) / 2, 0)
  );
  const swings = [];
  const nSwings = p.swings || 3;
  for (let i = 0; i < nSwings; i++) {
    swings.push([-L / 2 + (L * (i + 0.5)) / nSwings, 0.55, 0]);
  }
  g.add(instanced(swingUnit, seat, swings));
  /* The steel cross-members themselves, one over each swing, in the frame's
     own colour rather than the seat's. */
  g.add(instanced(box(0.12, 0.12, D + 0.18), frame,
    swings.map(([sx]) => [sx, 0.55 + rod + 0.05, 0])));

  const benchUnit = weld(
    box(2.0, 0.09, 0.5, 0, 0.45, 0),
    box(2.0, 0.42, 0.07, 0, 0.7, -0.22),
    box(0.1, 0.45, 0.44, -0.85, 0.22, 0),
    box(0.1, 0.45, 0.44, 0.85, 0.22, 0)
  );
  const benches = [];
  const nBench = p.benches || 2;
  for (let i = 0; i < nBench; i++) {
    benches.push([-L / 2 + (L * (i + 0.5)) / nBench, 0, D / 2 - 0.55]);
  }
  g.add(instanced(benchUnit, seat, benches));
  return g;
}

/**
 * Drop the vertices that only bend a footprint by a degree or two.
 *
 * Surveyed rings carry them everywhere, and they matter: Bonner Hall's west
 * wall is one 82 m plane in the world and four collinear segments in the
 * data, so a search for "the longest west edge" found a 39 m fragment and
 * hung a third of an arcade on it.
 */
function simplifyRing(ring, tolDeg = 6) {
  const n = ring.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = ring[(i - 1 + n) % n];
    const c = ring[i];
    const q = ring[(i + 1) % n];
    const a = Math.atan2(c[1] - p[1], c[0] - p[0]);
    const b = Math.atan2(q[1] - c[1], q[0] - c[0]);
    const turn = Math.abs((((b - a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
    if (turn > (tolDeg * Math.PI) / 180) out.push(c);
  }
  return out.length >= 3 ? out : ring;
}

/**
 * The longest wall of `ring` whose own outward normal points along `dir`.
 *
 * Wanted because the folded-plate canopy is not a position, it is a LINE: the
 * west arcade of two buildings. Storing that line as coordinates would let it
 * drift the first time the massing was rebuilt, so it is derived from the
 * host footprint every load instead.
 *
 * Scored on the WALL'S normal, not on where its midpoint sits. Mayer Hall's
 * south wall has a midpoint west of the building's centre, so a midpoint test
 * picked it over the real west face and laid the arcade across the end of the
 * building — pointing the right way and 90° wrong.
 */
function facingEdge(ring, dir) {
  const r = simplifyRing(ring);
  let cx = 0;
  let cz = 0;
  for (const [x, z] of r) { cx += x; cz += z; }
  cx /= r.length;
  cz /= r.length;
  let best = null;
  let score = 0;
  for (let i = 0; i < r.length; i++) {
    const a = r[i];
    const b = r[(i + 1) % r.length];
    const ex = b[0] - a[0];
    const ez = b[1] - a[1];
    const len = Math.hypot(ex, ez);
    if (len < 1) continue;
    let nx = -ez / len;
    let nz = ex / len;
    if (nx * ((a[0] + b[0]) / 2 - cx) + nz * ((a[1] + b[1]) / 2 - cz) < 0) { nx = -nx; nz = -nz; }
    const facing = nx * dir[0] + nz * dir[1];
    if (facing < 0.8) continue;              // within ~36° of square-on, or it is another wall
    if (len * facing > score) { score = len * facing; best = [a, b]; }
  }
  return best;
}

/**
 * Mayer and Bonner's folded-plate eave: a run of literal triangular concrete
 * prisms on slender round columns, along the west face of each host.
 *
 * The prisms are the point. Every other building on this walk can be a box
 * with a facade tile on it; this one cannot, because the shape IS the
 * landmark, and a flat cream band where the folds should be reads as a
 * different building.
 */
function buildFoldedPlate(lm, roofTopOf, heightAt) {
  const c = lm.colors || {};
  const k = lm.canopy || {};
  const dir = CORNER_DIR[lm.facing] || CORNER_DIR.W;
  const D = k.depth_m || 2.5;
  const H = k.height_m || 4.2;
  const pitch = k.pitch_m || 2.4;
  const rise = k.rise_m || 0.9;
  const out = new THREE.Group();

  const plate = lambert(c.plate);
  const soffit = lambert(c.soffit);
  const column = lambert(c.column);

  /* One prism, authored across local X with its ridge running out along +Z:
     the fold repeats ALONG the arcade, which is the way round the footage
     shows it. */
  const wedge = new THREE.Shape();
  wedge.moveTo(-pitch / 2, 0);
  wedge.lineTo(pitch / 2, 0);
  wedge.lineTo(0, rise);
  wedge.closePath();
  const prism = new THREE.ExtrudeGeometry(wedge, { depth: D, bevelEnabled: false });

  for (const name of lm.hosts || []) {
    const host = roofTopOf(name);
    const edge = host?.ring && facingEdge(host.ring, dir);
    if (!edge) continue;
    let [a, b] = edge;
    let ax = b[0] - a[0];
    let az = b[1] - a[1];
    const len = Math.hypot(ax, az);
    if (len < pitch * 2) continue;
    ax /= len;
    az /= len;
    /* Yawing local +X onto the edge forces local +Z to (-az, ax). Run the
       edge the other way when that would push the canopy into the building. */
    if (-az * dir[0] + ax * dir[1] < 0) { ax = -ax; az = -az; }
    const mx = (a[0] + b[0]) / 2;
    const mz = (a[1] + b[1]) / 2;
    const base = heightAt(mx, mz);

    const strip = new THREE.Group();
    strip.position.set(mx, base, mz);
    strip.rotation.y = Math.atan2(-az, ax);

    const folds = [];
    const n = Math.floor(len / pitch);
    for (let i = 0; i < n; i++) folds.push([-len / 2 + (i + 0.5) * pitch, H, 0]);
    strip.add(instanced(prism, plate, folds));

    const lid = new THREE.Mesh(new THREE.BoxGeometry(n * pitch, 0.14, D), soffit);
    lid.position.set(0, H - 0.07, D / 2);
    strip.add(lid);
    out.add(strip);

    /* Columns stand on the ground they actually meet, so the arcade follows
       the grade instead of floating where the mid-span happened to be. */
    const every = k.columnEvery_m || 4.8;
    const posts = [];
    for (let d = -len / 2 + every / 2; d < len / 2; d += every) {
      const px = mx + ax * d - az * (D - 0.4);
      const pz = mz + az * d + ax * (D - 0.4);
      const py = heightAt(px, pz);
      posts.push([px, py, pz, 0, base + H - 0.1 - py]);
    }
    const shaft = new THREE.CylinderGeometry(k.columnRadius_m || 0.16, k.columnRadius_m || 0.16, 1, 8);
    shaft.translate(0, 0.5, 0);
    out.add(instanced(shaft, column, posts));
  }
  return out;
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
  /* Sculptures dispatch on their name because each is one specific object.
     The built pieces dispatch on the SPEC BLOCK they carry instead, so a
     second pergola station — or a third — is a data edit, not a code edit. */
  for (const lm of data.landmarks || []) {
    if (lm.name === "Sun God") group.add(buildSunGod(lm, toLocal, heightAt));
    else if (/Warren Bear/.test(lm.name)) group.add(buildBear(lm, toLocal, heightAt));
    else if (lm.fountain) group.add(buildFountain(lm, toLocal, heightAt));
    else if (lm.pergola) group.add(buildPergola(lm, toLocal, heightAt));
    else if (lm.canopy) group.add(buildFoldedPlate(lm, roofTopOf, heightAt));
  }
  scene.add(group);
  return group;
}
