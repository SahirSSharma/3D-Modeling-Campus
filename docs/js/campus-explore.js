// Free roam over the measured campus — the only way you move.
//
// Walk any path at any speed, rise from eye level to a drone's view, and jump
// straight to any named place. The ground rules stay honest — the camera rides
// the measured terrain, so stairs are still stairs and Revelle still sits a
// step below the path — but nothing fences you anywhere.
//
// Deliberately DOM-light: campus-walk.js owns the frame loop and the camera;
// this module owns position, velocity and altitude, and the few controls that
// set them.

/* Eyes above the ground directly below. 1.65 m is a pedestrian; anything above
   that is the same world from higher up, which is the whole point of the
   control. */
export const EYE = 1.65;
/* Raised from 900 m when the world went from the campus box to the coastal
   region (2026-08-06).
   The old value was not a taste call — it was derived: "the measured world is
   ~3 km across and the whole of it already fits in frame from here." That
   premise expired the moment the measured world became 7.2 km across. At
   900 m the region is not merely hard to see, it is unreachable: the camera
   sees ~1.9 km of ground and the land now runs four times that.
   3,600 m is the altitude at which the region's full WIDTH fits the frame —
   at this camera (68 degrees vertical, ~94 horizontal at 16:10) the ground
   width in view is about 2.16x the height, and 2.16 x 3,600 = 7.8 km against
   a 7.25 km region. Fitting its full HEIGHT too would want ~5,400 m, which
   pushes the climb past the ten-second feel the flight tests pin and buys a
   frame that is mostly ocean and haze.
   The clearance-driven climb still holds: because the rate grows with height,
   EYE to here takes ~12 s rather than ~10. */
export const HOVER_MAX = 3600;

/* The velocity slider is logarithmic: human speeds (1–2 m/s) need fine
   control and drone speeds do not, and on a linear slider walking pace would
   land inside the first 0.1% of the travel. Full slider is MAX_SPEED_MPS
   exactly, and update() clamps to it too — no combination of slider and shift
   may move you faster. Crossing the whole 3 km campus takes ~1.5 s flat out. */
export const MAX_SPEED_MPS = 2000;
const SPEED_MIN = 0.6;
const SPEED_RATIO = MAX_SPEED_MPS / SPEED_MIN;
export const sliderToSpeed = (t) => SPEED_MIN * Math.pow(SPEED_RATIO, Math.max(0, Math.min(1, t)));
export const speedToSlider = (v) => Math.log(v / SPEED_MIN) / Math.log(SPEED_RATIO);

/* The arrow keys are the slider without the mouse, and they move ALONG it —
   in slider fractions per second, not metres per second per second. On a
   logarithmic axis that is the only rate that feels the same everywhere: a
   fixed m/s² would be imperceptible at 500 m/s and would blow straight past
   walking pace down at the bottom.

   These are fractions of the AXIS per second, so raising the cap does not
   change how long a sweep takes — only what a second of holding multiplies
   your speed by. Up/down is the coarse pair: a shade under three seconds from
   0.6 m/s to the cap (1 / 0.35), for getting across campus. Left/right is the
   fine pair, for settling on a speed you can actually steer at — and it got
   slightly coarser when the cap doubled, because a fifth of a longer axis is
   a bigger step: SPEED_RATIO^0.05 is ~1.50× per second at a 2000 m/s cap
   where it was ~1.45× at 1000. Still an order of magnitude under the coarse
   pair's ~17×, which is all the two rates have to be. */
export const SPEED_RATE_COARSE = 0.35;
export const SPEED_RATE_FINE = 0.05;

/* Shift doubles whatever the throttle currently says — one number, so "shift"
   means the same thing for travel as it does for climb. It is still bounded by
   MAX_SPEED_MPS: at 1000 m/s shift gets you the full 2000, and above that it
   gets you nothing extra. */
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

/* Q/E used to climb at your TRAVEL speed, which is the wrong variable: at the
   500 m/s spawn speed one tap of Q fell through the entire atmosphere, and at
   walking pace the 3 m/s floor made a 900 m descent take five minutes. The
   right variable is CLEARANCE — how far the camera is above the nearest solid
   below it, terrain or roof, whichever is higher — because what you want from
   the control is set entirely by how close you are to something: a metre at a
   time when you are parking two metres over a roof to look at it, hundreds of
   metres a second when you are dropping out of the drone view.

   So the rate is proportional to clearance, which makes altitude move
   GEOMETRICALLY — the same reasoning the velocity slider already runs on, and
   for the same reason: a fixed linear rate is useless at both ends of a range
   this wide. EYE to HOVER_MAX comes out at ~9.7 s either way.

   BASE is what you get hard against a surface. It has to be a pedestrian
   nudge (1.5 m/s is 2.5 cm per frame) so you can settle a couple of metres
   over a roof, and it has to be non-zero or clearance 0 would be a trap you
   could never climb out of. */
export const CLIMB_BASE_MPS = 1.5;
export const CLIMB_GAIN = 0.55;

/** Metres per second of climb at a given clearance above the solid below. */
export function climbRate(clearance, shift = false) {
  const c = Number.isFinite(clearance) ? Math.max(0, clearance) : 0;
  return Math.min((CLIMB_BASE_MPS + c * CLIMB_GAIN) * (shift ? SHIFT_MULT : 1), MAX_SPEED_MPS);
}

/**
 * @param {object}   deps
 * @param {function} deps.heightAt  terrain height at (x, z) — required.
 * @param {function} [deps.solidAt] world Y of the roof over (x, z), or
 *   null/undefined where nothing is built. Optional by design: the module has
 *   to stay usable without the massing (the Node tests build no buildings),
 *   and every caller that predates it keeps working unchanged.
 */
export function createExplore({ campus, lidar, heightAt, solidAt }) {
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
     * Q/E sink and climb at a rate set by clearance, not by travel speed.
     * Shift multiplies both. The arrow keys are not here: they set the
     * velocity (see stepSpeed), and looking is the drag.
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

      clamp();
      const ground = heightAt(self.x, self.z);

      /* Clearance is measured against the HIGHER of terrain and roof, so two
         metres over Geisel's deck is two metres of clearance and not the
         eighty-odd you are holding above the forecourt. solidAt is optional:
         without it clearance degrades to height above terrain, which is what
         the module did before buildings could answer, and is still right
         everywhere nothing is built.

         Drift off a roof edge and clearance jumps — 2 m over a 30 m roof
         becomes 32 m the instant you clear the parapet, so the rate goes from
         2.6 to 19 m/s in one frame. That discontinuity is DELIBERATELY left
         unsmoothed. It is physically truthful (there really is nothing under
         you now), it is invisible unless you are holding Q or E at the moment
         you cross the edge, and the alternative costs more than it buys:
         rate-limiting the clearance the controller sees would put lag into
         precisely the manoeuvre that needs precision — the slow descent onto
         a roof — and it would make the rate depend on how long you had been
         holding the key rather than on where you are, which is exactly the
         hidden state that made the old speed-keyed climb impossible to
         reason about or test.

         Note also that this is a rate governor, not a collision surface: hold
         Q over a roof and you still sink through it, slowly. Free roam has
         never had collision, and being stranded on a rooftop with no way down
         would be a worse bug than passing through one. */
      const roofY = solidAt?.(self.x, self.z);
      const surfaceY = roofY != null ? Math.max(ground, roofY) : ground;
      const clearance = Math.max(0, ground + self.hover - surfaceY);
      const climb = climbRate(clearance, held.has("shift")) * dt;
      if (held.has("e") || held.has("pageup")) self.hover += climb;
      if (held.has("q") || held.has("pagedown")) self.hover -= climb;
      /* Both clamps are escapable in both directions because climbRate never
         returns 0: at EYE the rate is still 2.4 m/s up, at HOVER_MAX it is
         496 m/s down. */
      self.hover = Math.max(EYE, Math.min(HOVER_MAX, self.hover));

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
  /* The world is now ~7.2 km across; from full height the whole of it must
     clear the haze, so the far plane grows faster than it did when the data
     ended a few hundred metres out. */
  scene.fog.far = 640 + lift * 11;
  const far = 1100 + lift * 14;
  /* The near plane has to rise with it, and this is why.
     Depth precision is governed by the RATIO far/near, not by far alone. At
     the old 900 m ceiling that ratio topped out around 34,000; carrying a
     0.4 m near plane to the new 3,600 m ceiling would take it past 128,000
     and start eating the decal-stack's ordering at exactly the altitude where
     whole neighbourhoods of coplanar ground are in frame at once.
     Nothing needs 40 cm of near clipping from three kilometres up, so the near
     plane follows the camera up and the ratio stays where it was. At eye level
     `lift` is 0 and the near plane is untouched, so the walk — the thing the
     ladder was tuned for — is bit-for-bit what it was. */
  const near = Math.max(0.4, lift / 1000);
  if (Math.abs(camera.far - far) > 1 || Math.abs(camera.near - near) > 0.05) {
    camera.far = far;
    camera.near = near;
    camera.updateProjectionMatrix();
  }
}
