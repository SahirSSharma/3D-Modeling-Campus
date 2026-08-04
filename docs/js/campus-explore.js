// Free roam over the measured campus.
//
// The guided walk answers "is this what walking there looks like". This mode
// answers the follow-up: "let me check anywhere else". You can leave the route,
// walk any path at any speed, rise from eye level to a drone's view, and jump
// straight to any named place. The ground rules stay honest — the camera rides
// the measured terrain, so stairs are still stairs and Revelle still sits a
// step below the path — but nothing fences you onto the route.
//
// Deliberately DOM-light: campus-walk.js owns the frame loop and the camera;
// this module owns position, velocity and altitude, and the few controls that
// set them.

/* Eyes above the ground directly below. 1.65 m is a pedestrian; anything above
   that is the same world from higher up, which is the whole point of the
   control. The cap is generous because the terrain box is ~1 km across and a
   full overview needs real height. */
export const EYE = 1.65;
const HOVER_MAX = 900; // the whole 3 km campus fits in frame from up here

/* The velocity slider is logarithmic: human speeds (1–2 m/s) need fine
   control and drone speeds do not, and a linear slider spends 97% of its
   travel on speeds nobody can steer at. Full slider is MAX_SPEED_MPS exactly,
   and update() clamps to it too — no combination of slider and shift may
   move you faster. Crossing the whole 3 km campus takes ~3 s flat out. */
export const MAX_SPEED_MPS = 1000;
const SPEED_MIN = 0.6;
const SPEED_RATIO = MAX_SPEED_MPS / SPEED_MIN;
export const sliderToSpeed = (t) => SPEED_MIN * Math.pow(SPEED_RATIO, Math.max(0, Math.min(1, t)));
export const speedToSlider = (v) => Math.log(v / SPEED_MIN) / Math.log(SPEED_RATIO);

/* The arrow keys are the slider without the mouse, and they move ALONG it —
   in slider fractions per second, not metres per second per second. On a
   logarithmic axis that is the only rate that feels the same everywhere: a
   fixed m/s² would be imperceptible at 500 m/s and would blow straight past
   walking pace down at the bottom.

   Up/down is the coarse pair — a shade under three seconds from 0.6 m/s to
   the cap, for getting across campus. Left/right is the fine pair, ~1.45×
   per second, for settling on a speed you can actually steer at. */
export const SPEED_RATE_COARSE = 0.35;
export const SPEED_RATE_FINE = 0.05;

/* Shift doubles whatever the throttle currently says — one number, shared by
   both modes, so "shift" means the same thing on the rail and off it. It is
   still bounded by MAX_SPEED_MPS: at 500 m/s shift gets you the full 1000, and
   above that it gets you nothing extra. */
export const SHIFT_MULT = 2;

/** The velocity after one tick of arrow-key steering. Clamped to the slider's
    own range by sliderToSpeed, so it can never leave 0.6…MAX_SPEED_MPS. */
export function stepSpeed(speed, dt, held) {
  let d = 0;
  if (held.has("arrowup")) d += SPEED_RATE_COARSE;
  if (held.has("arrowdown")) d -= SPEED_RATE_COARSE;
  if (held.has("arrowright")) d += SPEED_RATE_FINE;
  if (held.has("arrowleft")) d -= SPEED_RATE_FINE;
  if (!d) return speed;
  return sliderToSpeed(speedToSlider(speed) + d * dt);
}

export function createExplore({ campus, lidar, heightAt }) {
  const t = lidar.terrain;
  const bounds = {
    x0: t.x0 + t.cell, x1: t.x0 + (t.cols - 2) * t.cell,
    z0: t.z0 + t.cell, z1: t.z0 + (t.rows - 2) * t.cell,
  };

  const self = {
    x: 0,
    z: 0,
    hover: EYE,        // eyes above local ground, metres
    speed: 1.45,       // m/s, set by the shared velocity slider
    yaw: 0,
    pitch: -0.03,

    /** Drop into free roam at a point, facing a heading. */
    enterAt(x, z, yaw) {
      self.x = x;
      self.z = z;
      self.yaw = yaw;
    },

    /** Jump to a named place. Lands 22 m south of it at eye level looking at
        it, because materialising INSIDE Geisel Library shows you the inside of
        a grey box and reads as a bug even when it is not one. */
    teleport(name) {
      const place = campus.places[name];
      if (!place) return false;
      const back = 22;
      self.x = place.x;
      self.z = place.z + back;
      self.hover = Math.max(self.hover, EYE);
      self.yaw = Math.atan2(place.x - self.x, place.z - self.z); // due north, at it
      self.pitch = -0.03;
      clamp();
      return true;
    },

    /**
     * One tick of movement. Reads held keys, returns the camera pose.
     * Forward is where you are looking (horizontally); strafing is sideways;
     * Q/E sink and climb. Shift multiplies, exactly like the guided walk.
     * The arrow keys are not here: they set the velocity (see stepSpeed), and
     * looking is the drag.
     */
    update(dt, held) {
      /* The cap is the cap: shift on top of a high slider still tops out at
         MAX_SPEED_MPS, never multiplies past it. */
      const v = Math.min(self.speed * (held.has("shift") ? SHIFT_MULT : 1), MAX_SPEED_MPS) * dt;
      const sin = Math.sin(self.yaw);
      const cos = Math.cos(self.yaw);

      if (held.has("w")) { self.x += sin * v; self.z += cos * v; }
      if (held.has("s")) { self.x -= sin * v; self.z -= cos * v; }
      /* Left is left. The look vector is (sin, cos); the LEFT-hand vector in
         this frame (x east, z south, y up) is (cos, -sin) — face north
         (yaw π) and your left is west, face east (yaw π/2) and it is north.
         The first release had the signs the other way round, so A strafed
         right and D strafed left the entire time. */
      if (held.has("a")) { self.x += cos * v; self.z -= sin * v; }
      if (held.has("d")) { self.x -= cos * v; self.z += sin * v; }

      /* Climb rate follows travel speed, floored so the first metres of lift
         do not crawl when the slider sits at walking pace — and capped like
         the travel speed is. */
      const climb =
        Math.min(Math.max(3, self.speed) * (held.has("shift") ? SHIFT_MULT : 1), MAX_SPEED_MPS) * dt;
      if (held.has("e") || held.has("pageup")) self.hover += climb;
      if (held.has("q") || held.has("pagedown")) self.hover -= climb;
      self.hover = Math.max(EYE, Math.min(HOVER_MAX, self.hover));

      clamp();
      const ground = heightAt(self.x, self.z);
      return { x: self.x, y: ground + self.hover, z: self.z, yaw: self.yaw, ground };
    },

    /** The nearest named place, for the "where am I" callout off the route. */
    nearestPlace() {
      let best = null;
      let bestD = Infinity;
      for (const [name, p] of Object.entries(campus.places)) {
        const d = Math.hypot(p.x - self.x, p.z - self.z);
        if (d < bestD) { bestD = d; best = name; }
      }
      return bestD < 60 ? { name: best, distance: Math.round(bestD) } : null;
    },
  };

  /* The world ends where the measurements end. Walking past the edge of the
     LiDAR grid puts the camera over unmeasured void that heightAt reports as
     0 m — a cliff that exists in the data, not in La Jolla — so the edge is a
     wall rather than a lie. */
  function clamp() {
    self.x = Math.max(bounds.x0, Math.min(bounds.x1, self.x));
    self.z = Math.max(bounds.z0, Math.min(bounds.z1, self.z));
  }

  return self;
}

/**
 * Fog and draw distance, scaled to altitude. The walk's fog sits close because
 * at eye level it hides the cut edge of the data; from 150 m up the same fog
 * hides the entire campus, which turns the drone view into a rectangle of
 * haze. Pushing it out with height keeps both honest.
 */
export function scaleAtmosphere(scene, camera, hover) {
  const lift = Math.max(0, hover - EYE);
  scene.fog.near = 170 + lift * 4;
  /* The world is now ~3 km across; from full height the whole of it must
     clear the haze, so the far plane grows faster than it did when the data
     ended a few hundred metres out. */
  scene.fog.far = 640 + lift * 11;
  const far = 1100 + lift * 14;
  if (Math.abs(camera.far - far) > 1) {
    camera.far = far;
    camera.updateProjectionMatrix();
  }
}
