// The scooter, built from primitives.
//
// A Ninebot KickScooter ES2, which is the machine in the reference photograph:
// folding stem with the clamp collar two-thirds up, narrow deck between an
// 8-inch front wheel and a 7.5-inch rear, both wheels behind their own
// fenders, the headlight set into the stem rather than clamped to the bars.
// Proportions are the real ones — 1,130 mm to the grips, ~1,020 mm nose to
// tail, 150 mm deck height, 430 mm bars — because a scooter drawn at the wrong
// proportions reads as a toy no matter how it is shaded.
//
// Geometry only, no image asset, the same way campus-goal.js draws a football
// goal. It is built facing +z so the yaw out of scooter-ride.js's positionAt()
// can be applied straight to the group.
import * as THREE from "../vendor/three/three.module.min.js";

/* The ES2 is a very dark grey that reads black in shade and gunmetal in sun,
   which is exactly what a low roughness on a near-black base does. */
const BODY = 0x2b2e33;
const DARK = 0x16181b;
const TYRE = 0x101114;
const RIM = 0x3d4148;
const ACCENT = 0xd8552f; // the reflector and the brake lever
const LIGHT = 0xfff2cf;

const R = {
  frontWheel: 0.1015, // 8 inch
  rearWheel: 0.095, //  7.5 inch
  deckY: 0.15,
  barY: 1.13,
  barW: 0.43,
  nose: 0.42,
  tail: -0.44,
};

const part = (geometry, color, opts = {}) =>
  new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color,
      roughness: opts.roughness ?? 0.55,
      metalness: opts.metalness ?? 0.25,
      emissive: opts.emissive ?? 0x000000,
      emissiveIntensity: opts.emissiveIntensity ?? 1,
    })
  );

function wheel(radius, width) {
  const group = new THREE.Group();
  const tyre = part(new THREE.CylinderGeometry(radius, radius, width, 20), TYRE, {
    roughness: 0.85, metalness: 0.05,
  });
  tyre.rotation.z = Math.PI / 2;
  group.add(tyre);

  /* The hub, and a single spoke bar across it — the ES2's wheels are solid
     discs with a shallow dish, and the bar is what makes the spin readable at
     speed. Without something off-axis the wheel looks stationary. */
  const hub = part(new THREE.CylinderGeometry(radius * 0.42, radius * 0.42, width * 1.08, 16), RIM, {
    roughness: 0.4, metalness: 0.6,
  });
  hub.rotation.z = Math.PI / 2;
  group.add(hub);

  const bar = part(new THREE.BoxGeometry(width * 1.1, radius * 1.5, radius * 0.16), RIM, {
    roughness: 0.4, metalness: 0.6,
  });
  group.add(bar);
  return group;
}

/**
 * Build the scooter.
 *
 * Returns the root group plus the two handles the ride needs each frame:
 * `spin(radians)` rolls the wheels, `bank(radians)` leans the whole machine
 * into a lane change. Both are on the returned object rather than left to the
 * caller to reach into the hierarchy for, so the rig can be rebuilt without
 * breaking campus-scooter.js.
 */
export function createScooter() {
  const root = new THREE.Group();
  const body = new THREE.Group(); // everything that leans
  root.add(body);

  /* ---- deck ---- */
  const deck = part(new THREE.BoxGeometry(0.19, 0.045, 0.72), BODY, { roughness: 0.5 });
  deck.position.set(0, R.deckY, -0.04);
  body.add(deck);

  /* The grip tape: a thin lighter slab inset on top, which is most of what
     tells you which way up the deck is at a distance. */
  const grip = part(new THREE.BoxGeometry(0.16, 0.008, 0.6), DARK, { roughness: 0.95, metalness: 0 });
  grip.position.set(0, R.deckY + 0.027, -0.04);
  body.add(grip);

  /* Side skirts — the ES2's battery housing flares below the deck. */
  for (const side of [-1, 1]) {
    const skirt = part(new THREE.BoxGeometry(0.02, 0.055, 0.62), DARK, { roughness: 0.6 });
    skirt.position.set(side * 0.1, R.deckY - 0.03, -0.04);
    body.add(skirt);
  }

  /* ---- stem ---- */
  /* Raked back about 8 degrees, which is what the photograph shows and what
     stops the machine looking like a scooter drawn with a set square. */
  const rake = -0.14;
  const stem = part(new THREE.CylinderGeometry(0.028, 0.036, 0.98, 12), BODY, {
    roughness: 0.35, metalness: 0.5,
  });
  stem.position.set(0, R.deckY + 0.47, R.nose - 0.06);
  stem.rotation.x = rake;
  body.add(stem);

  /* The folding clamp, two-thirds up. Small, but it is the single detail that
     identifies the machine. */
  const clamp = part(new THREE.CylinderGeometry(0.045, 0.045, 0.075, 12), DARK, {
    roughness: 0.3, metalness: 0.7,
  });
  clamp.position.set(0, R.deckY + 0.2, R.nose - 0.015);
  clamp.rotation.x = rake;
  body.add(clamp);

  /* ---- handlebar ---- */
  const barZ = R.nose - 0.19;
  const bar = part(new THREE.CylinderGeometry(0.017, 0.017, R.barW, 10), DARK, {
    roughness: 0.4, metalness: 0.6,
  });
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, R.barY, barZ);
  body.add(bar);

  for (const side of [-1, 1]) {
    const handle = part(new THREE.CylinderGeometry(0.023, 0.023, 0.115, 10), DARK, {
      roughness: 0.95, metalness: 0,
    });
    handle.rotation.z = Math.PI / 2;
    handle.position.set(side * (R.barW / 2 - 0.055), R.barY, barZ);
    body.add(handle);
  }

  /* Brake lever on the left, angled down and forward. */
  const lever = part(new THREE.BoxGeometry(0.085, 0.012, 0.02), ACCENT, {
    roughness: 0.3, metalness: 0.6,
  });
  lever.position.set(-0.11, R.barY - 0.035, barZ + 0.035);
  lever.rotation.z = 0.22;
  body.add(lever);

  /* The little display between the grips. */
  const display = part(new THREE.BoxGeometry(0.062, 0.03, 0.042), DARK, {
    roughness: 0.2, metalness: 0.3, emissive: 0x1b3a52, emissiveIntensity: 0.6,
  });
  display.position.set(0, R.barY + 0.024, barZ);
  body.add(display);

  /* ---- fork, fenders, lights ---- */
  const fork = part(new THREE.BoxGeometry(0.05, 0.28, 0.05), BODY, {
    roughness: 0.35, metalness: 0.55,
  });
  fork.position.set(0, R.deckY - 0.01, R.nose + 0.015);
  fork.rotation.x = rake;
  body.add(fork);

  const frontFender = part(new THREE.CylinderGeometry(0.135, 0.135, 0.085, 14, 1, true, Math.PI * 0.15, Math.PI * 0.72), BODY, {
    roughness: 0.5, metalness: 0.3,
  });
  frontFender.rotation.z = Math.PI / 2;
  frontFender.position.set(0, R.frontWheel + 0.008, R.nose + 0.04);
  frontFender.material.side = THREE.DoubleSide;
  body.add(frontFender);

  const rearFender = part(new THREE.BoxGeometry(0.115, 0.03, 0.24), BODY, { roughness: 0.55 });
  rearFender.position.set(0, R.rearWheel + 0.085, R.tail + 0.06);
  rearFender.rotation.x = 0.12;
  body.add(rearFender);

  /* Headlight in the stem, and the red reflector under the rear fender. Both
     are emissive rather than actual lights: two more real lights per frame buys
     nothing at noon and costs a shader recompile. */
  const head = part(new THREE.CylinderGeometry(0.032, 0.032, 0.028, 14), LIGHT, {
    roughness: 0.2, metalness: 0.1, emissive: LIGHT, emissiveIntensity: 0.85,
  });
  head.rotation.x = Math.PI / 2 + rake;
  head.position.set(0, R.deckY + 0.63, R.nose + 0.02);
  body.add(head);

  const reflector = part(new THREE.BoxGeometry(0.06, 0.022, 0.012), ACCENT, {
    roughness: 0.25, metalness: 0.1, emissive: 0x7a1c08, emissiveIntensity: 0.7,
  });
  reflector.position.set(0, R.rearWheel + 0.07, R.tail - 0.05);
  body.add(reflector);

  /* ---- wheels ---- */
  const front = wheel(R.frontWheel, 0.05);
  front.position.set(0, R.frontWheel, R.nose + 0.045);
  body.add(front);

  const rear = wheel(R.rearWheel, 0.055);
  rear.position.set(0, R.rearWheel, R.tail);
  body.add(rear);

  root.traverse((o) => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; }
  });

  return {
    group: root,
    /* Roll both wheels. One angle for both is a lie of about 7% — the wheels
       are different diameters — and nobody has ever seen it. */
    spin(radians) {
      front.rotation.x = radians;
      rear.rotation.x = radians;
    },
    /* Lean into the turn. Applied to `body` rather than `root` so the lean
       pivots around the contact patch and the wheels stay on the ground. */
    bank(radians) {
      body.rotation.z = radians;
    },
  };
}

/**
 * The props the run scatters along the route. Invented, like the placement —
 * see scripts/build-corridor.mjs. Kept here beside the scooter because they
 * are the same kind of object: game furniture, not survey.
 *
 * EACH KIND IS DRAWN AT THE WIDTH ITS OBSTACLE_KINDS ENTRY DECLARES. They are
 * two halves of one number: the builder's width decides what you collide with
 * and this decides what you see, and a bench drawn wider than it hits is a
 * bench you swerve around for no reason.
 */
export function createObstacle(kind) {
  const group = new THREE.Group();
  const add = (mesh) => { group.add(mesh); return mesh; };

  switch (kind) {
    case "bench": {
      const seat = add(part(new THREE.BoxGeometry(1.3, 0.07, 0.42), 0x8a6a45, { roughness: 0.85, metalness: 0 }));
      seat.position.y = 0.42;
      const back = add(part(new THREE.BoxGeometry(1.3, 0.3, 0.06), 0x8a6a45, { roughness: 0.85, metalness: 0 }));
      back.position.set(0, 0.6, -0.18);
      for (const side of [-0.5, 0.5]) {
        const leg = add(part(new THREE.BoxGeometry(0.07, 0.42, 0.36), 0x3f4348, { roughness: 0.5, metalness: 0.5 }));
        leg.position.set(side, 0.21, 0);
      }
      break;
    }
    case "cone": {
      const cone = add(part(new THREE.ConeGeometry(0.17, 0.5, 12), 0xe2572a, { roughness: 0.7, metalness: 0 }));
      cone.position.y = 0.25;
      const base = add(part(new THREE.BoxGeometry(0.4, 0.03, 0.4), 0x1f2124, { roughness: 0.8, metalness: 0 }));
      base.position.y = 0.015;
      const band = add(part(new THREE.CylinderGeometry(0.115, 0.135, 0.08, 12), 0xf2f2ef, { roughness: 0.6, metalness: 0 }));
      band.position.y = 0.28;
      break;
    }
    case "puddle": {
      const pool = add(part(new THREE.CircleGeometry(0.6, 20), 0x3e6f8e, {
        roughness: 0.08, metalness: 0.55,
      }));
      pool.rotation.x = -Math.PI / 2;
      pool.position.y = 0.02;
      pool.material.transparent = true;
      pool.material.opacity = 0.75;
      break;
    }
    case "bollard": {
      const post = add(part(new THREE.CylinderGeometry(0.075, 0.085, 0.95, 12), 0x4a4e52, { roughness: 0.5, metalness: 0.5 }));
      post.position.y = 0.475;
      const cap = add(part(new THREE.SphereGeometry(0.078, 12, 8), 0x33373a, { roughness: 0.35, metalness: 0.6 }));
      cap.position.y = 0.95;
      const stripe = add(part(new THREE.CylinderGeometry(0.079, 0.079, 0.08, 12), 0xd8d8d0, { roughness: 0.6, metalness: 0 }));
      stripe.position.y = 0.78;
      break;
    }
    case "planter": {
      const box = add(part(new THREE.CylinderGeometry(0.55, 0.45, 0.62, 10), 0x9a9287, { roughness: 0.9, metalness: 0 }));
      box.position.y = 0.31;
      const soil = add(part(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 10), 0x4a3a2c, { roughness: 1, metalness: 0 }));
      soil.position.y = 0.62;
      const bush = add(part(new THREE.IcosahedronGeometry(0.34, 0), 0x4d6b34, { roughness: 0.95, metalness: 0 }));
      bush.position.y = 0.85;
      bush.scale.y = 0.7;
      break;
    }
    default: { // "sign" — the A-frame every campus path has two of
      /* Leaned hard enough to read as an A. At the first pass the two panels
         sat 9 degrees off vertical and 0.24 m apart, which from behind is a
         yellow cube. The apex has to be visibly narrower than the feet or the
         silhouette says nothing. Top lands at 1.12 m, which is the 1.15 m the
         builder declares it collides at. */
      for (const lean of [-1, 1]) {
        const panel = add(part(new THREE.BoxGeometry(0.9, 1.0, 0.022), 0xf0c419, { roughness: 0.6, metalness: 0 }));
        panel.position.set(0, 0.55, lean * 0.2);
        panel.rotation.x = lean * 0.34;
        const stripe = add(part(new THREE.BoxGeometry(0.9, 0.11, 0.026), 0x24262a, { roughness: 0.7, metalness: 0 }));
        stripe.position.set(0, 0.93, lean * 0.075);
        stripe.rotation.x = lean * 0.34;
      }
      const foot = add(part(new THREE.BoxGeometry(0.92, 0.05, 0.62), 0x24262a, { roughness: 0.7, metalness: 0 }));
      foot.position.y = 0.025;
    }
  }

  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return group;
}

/**
 * One coin. Shared geometry and material across every coin on the route —
 * there are a couple of hundred of them and each wants to be a mesh so it can
 * spin, but none of them wants to be a separate draw call's worth of state.
 */
export function coinFactory() {
  const geometry = new THREE.CylinderGeometry(0.17, 0.17, 0.035, 18);
  const material = new THREE.MeshStandardMaterial({
    color: 0xf7c948,
    roughness: 0.22,
    metalness: 0.85,
    emissive: 0x5a3f05,
    emissiveIntensity: 0.7,
  });
  return {
    geometry,
    material,
    make() {
      const m = new THREE.Mesh(geometry, material);
      /* Stood on edge and facing across the path, so it reads as a disc from
         the chase camera rather than as a dot. */
      m.rotation.z = Math.PI / 2;
      return m;
    },
  };
}
