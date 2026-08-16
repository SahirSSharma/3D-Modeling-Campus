// The scooter run: the Eighth College courts to Peterson Hall, as its own world.
//
// WHY THIS IS NOT campus-walk.js WITH A FLAG. Free roam boots ~10 MB and hands
// you the whole campus at 110 m. This boots one 1.5 MB crop
// (corridor-*.json) and puts you on a deck at eye level, on one
// route, with a finish line. Almost nothing the two modes do at boot is the
// same thing, and threading a mode flag through 750 lines of the other file
// would have made both harder to read to save a file.
//
// What IS shared is everything that draws the world: campus-world.js,
// campus-massing.js, campus-details.js, campus-eighth.js, campus-landmarks.js
// and campus-markings.js all build here from cropped data that has the same
// shape as the campus-wide data, so there is exactly one implementation of "how
// a measured building looks" and this mode cannot drift from it.
//
// Three cameras, one at a time (camMode): the opening orbit, the chase camera
// that is the game, and free roam's own fly controls for looking at the map. The
// ride only advances in chase — the other two freeze it, so neither the intro
// nor an inspection flight can move the scooter or the clock.
//
// What is deliberately NOT shared is the look. The corridor is art-directed —
// shadows, tone mapping, a tighter sky — because it is a game and it is meant
// to look good, where free roam is meant to look like the measurement. That
// divergence is on purpose and is confined to tuneAtmosphere() below.
import * as THREE from "../vendor/three/three.module.min.js";
import * as world from "./campus-world.js";
import { createBuildings } from "./campus-massing.js";
import { createDetails } from "./campus-details.js";
import { createMarkings } from "./campus-markings.js";
import { createRecreation } from "./campus-recreation.js";
import { createLabels, createLandmarks } from "./campus-landmarks.js";
import { createEighth } from "./campus-eighth.js";
import { createEighthFurniture } from "./campus-eighth-furniture.js";
import { OVERLAY, overlayLift, applyOverlayDepth } from "./campus-overlay.js";
import { nullReporter } from "./campus-boot.js";
import {
  createRide, positionAt,
  ACCEL_MPS2, TOP_SPEED_MPS,
} from "./scooter-ride.js";
/* Fly mode is free roam's controller, imported rather than reimplemented — see
   the note above stepFly. SHIFT_MULT stays declared only in campus-explore.js,
   which tests/campus-gameplay.test.mjs asserts. */
import { createExplore, stepSpeed, EYE } from "./campus-explore.js";
import { makeSolidSampler } from "./campus-clearance.js";
import { createScooter, createObstacle, coinFactory } from "./scooter-model.js";

/* The corridors this module can boot, keyed by the ?mode= that asks for one.
   Same renderer, same ride, same everything — a different cut of the same
   measured campus. `staging` is the work zone: it exists so a change can be
   tried on a real route and looked at on the live site without touching the
   run people ride. Keep this table in step with ROUTES in
   scripts/build-corridor.mjs; the builder stamps its key into built.target and
   boot() refuses a file that does not match. */
const CORRIDORS = {
  scooter: { file: "corridor-eighth-peterson.json", staging: false },
  staging: { file: "corridor-staging.json", staging: true },
};

/* The chase camera. Far enough back that the next obstacle group is on screen
   with time to pick a line at the ES2's 6.9 m/s, close enough that the scooter
   is a machine rather than a dot. */
const CHASE_BACK_M = 3.8;
const CHASE_UP_M = 1.75;
const CHASE_LOOK_AHEAD_M = 11;
/* Seconds for the camera to cover the distance to where it should be. A hard
   follow makes every dodge a jolt; too soft and the scooter swims. */
const CHASE_LAG_S = 0.16;
/* The aim leads the body. See the note at its use in step(). */
const CHASE_AIM_LAG_S = 0.10;

/* Lean into a dodge, up to this at full lateral speed. */
const MAX_BANK_RAD = 0.26;

/* Two skies, toggled with T.
 *
 * "noon" is campus-world's own measured November light, pulled into a game
 * contrast range. "sunset" is not measured and does not pretend to be: it is
 * the same campus at the hour it is nicest to ride across, with the sun eight
 * degrees above the western horizon so everything on the route throws a
 * shadow the length of itself.
 *
 * Everything that has to move together to make a time of day read lives in
 * one entry here — sky gradient, fog, both lights, the sun's direction and
 * the exposure. Splitting them across the file is how you end up with a
 * sunset sky over noon shadows.
 */
const SKY = {
  noon: {
    label: "noon",
    zenith: 0x3a7cc8, mid: 0x7ea9d8, horizon: 0xb5d2e6,
    background: 0xa9cbe4,
    fog: 0xc6d9e6, fogNear: 90, fogFar: 420,
    sun: 0xfff3e0, sunIntensity: 2.9,
    /* Metres from the rider to the light. High and to the south-west. */
    sunOffset: [-110, 130, 74],
    hemiSky: 0xcfe4f8, hemiGround: 0x9aa0a0, hemiIntensity: 0.62,
    exposure: 1.18,
  },
  sunset: {
    label: "sunset",
    zenith: 0x24306b, mid: 0x9a5f83, horizon: 0xf0a05c,
    background: 0xe0906a,
    /* Warm, close fog: at this hour the far end of campus really does go
       amber and vague, and it hides the corridor's edge for free. */
    fog: 0xe09a68, fogNear: 55, fogFar: 300,
    sun: 0xffb066, sunIntensity: 3.4,
    /* Low and due west (-x is west in this frame), so shadows run long and
       east across the route. 8° above the horizon. */
    sunOffset: [-210, 30, 12],
    hemiSky: 0xffb98a, hemiGround: 0x40323e, hemiIntensity: 0.5,
    exposure: 1.32,
  },
};
let skyName = "noon";
let skyDome = null;
let hemi = null;

let renderer, scene, camera, heightAt, surfaceAt, ride, doc, scooter;
let labels = null;
let hud = null;
const held = new Set();
let last = 0;
let sun = null;
let sunTarget = null;
const camPos = new THREE.Vector3();
const camAim = new THREE.Vector3();
/* Reused per frame; a new Vector3 sixty times a second for the same two
   targets is the kind of garbage that shows up as a stutter, not a leak. */
const CHASE_POS = new THREE.Vector3();
const CHASE_AIM = new THREE.Vector3();
let started = false;

/* ------------------------------------------------------------------- look */

/**
 * The corridor's own atmosphere.
 *
 * createScene() is tuned for a surveyor 110 m up looking across 3 km. On a
 * deck at 1.4 m looking 200 m down a walkway, that fog starts too far out to
 * do anything and the sun casts nothing. This retunes both, and turns on the
 * one thing free roam cannot afford across a whole campus: a real shadow map,
 * small and centred on the rider, which is most of why this mode reads as
 * solid rather than as flat-shaded massing.
 */
function tuneAtmosphere() {
  scene.fog = new THREE.Fog(0xc6d9e6, 90, 420);

  /* Free roam's light is measured: a strong sky term because November noon
     really does fill the shade that much, read off the footage. It is the
     right answer for a survey and the wrong one for a game — at 1.35 the
     hemisphere floods every shadow the sun casts and the whole scene reads
     flat. Pulling it back and pushing the sun up is the single biggest
     legibility win available, and it is exactly the kind of divergence this
     mode is allowed. */
  for (const child of scene.children) {
    if (child.isHemisphereLight) hemi = child;
    if (child.isDirectionalLight && child.intensity > 1) sun = child;
    /* campus-world's sky dome: the one mesh drawn before everything, with
       its gradient baked into vertex colours. Identified by that contract
       rather than by name, because it has no name. */
    if (child.isMesh && child.renderOrder === -1 && child.material?.vertexColors) {
      skyDome = child;
    }
  }
  if (!sun) return;

  sunTarget = new THREE.Object3D();
  scene.add(sunTarget);
  sun.target = sunTarget;
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  /* A 90 m box around the rider. Everything that can cast a shadow you will
     actually look at is inside it; the campus beyond stays unshadowed and
     nobody has ever noticed. */
  const c = sun.shadow.camera;
  c.left = -45; c.right = 45; c.top = 45; c.bottom = -45;
  c.near = 1; c.far = 320;
  /* Required. An orthographic camera caches its projection matrix, so the box
     above does nothing until this is called — the light keeps the default ±5 m
     frustum, which from 190 m away covers a patch smaller than the scooter and
     reads on screen as "shadows are not working" rather than as a frustum the
     size of a dinner plate. */
  c.updateProjectionMatrix();
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.035;

  applySky("noon");
}

/**
 * Repaint the sky, the fog, both lights and the exposure to one time of day.
 *
 * The dome's gradient is baked into vertex colours by campus-world, so this
 * rewrites that attribute in place rather than building a second dome — one
 * dome that changes colour, not two that have to be kept in sync about
 * radius, render order and the onBeforeRender that keeps it centred.
 */
function applySky(name) {
  const s = SKY[name] || SKY.noon;
  skyName = SKY[name] ? name : "noon";

  scene.background = new THREE.Color(s.background);
  scene.fog.color.set(s.fog);
  scene.fog.near = s.fogNear;
  scene.fog.far = s.fogFar;
  /* Re-apply the altitude push on the same frame, or pressing T at 300 m shows
     one frame of the fog written for a deck at 1.4 m. All three modes re-drive
     it next frame anyway; this is only to avoid the flash. */
  if (camMode === "fly" && explore) scaleRideAtmosphere(explore.hover);

  if (sun) {
    sun.color.set(s.sun);
    sun.intensity = s.sunIntensity;
  }
  if (hemi) {
    hemi.color.set(s.hemiSky);
    hemi.groundColor.set(s.hemiGround);
    hemi.intensity = s.hemiIntensity;
  }
  if (renderer) renderer.toneMappingExposure = s.exposure;

  if (skyDome) {
    const pos = skyDome.geometry.attributes.position;
    const col = skyDome.geometry.attributes.color;
    /* The dome's own radius, read off its geometry rather than assumed — a
       hard-coded 1000 here would silently wash the gradient flat the day
       campus-world changed it. */
    let radius = 0;
    for (let i = 0; i < pos.count; i++) radius = Math.max(radius, Math.abs(pos.getY(i)));
    const zenith = new THREE.Color(s.zenith);
    const mid = new THREE.Color(s.mid);
    const horizon = new THREE.Color(s.horizon);
    const c = new THREE.Color();
    /* Three stops, not two. A sunset is a warm band low down under a cold
       vault, and a straight horizon-to-zenith lerp turns that into mud. */
    const BAND = 0.32;
    for (let i = 0; i < pos.count; i++) {
      const t = Math.max(0, pos.getY(i) / radius);
      if (t < BAND) c.copy(horizon).lerp(mid, Math.pow(t / BAND, 0.7));
      else c.copy(mid).lerp(zenith, Math.pow((t - BAND) / (1 - BAND), 0.85));
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
  }
}

function toggleSky() {
  applySky(skyName === "noon" ? "sunset" : "noon");
  const btn = document.getElementById("ride-sky");
  if (btn) {
    btn.textContent = skyName === "noon" ? "sunset" : "noon";
    btn.classList.toggle("on", skyName === "sunset");
  }
}

/** Keep the shadow box on the rider — a fixed box would only work at Argo. */
/* The shadow box has to cover what is on screen, and what is on screen depends
   on how high the camera is. At deck height a 90 m box round the rider is
   generous; from 165 m up during the opening descent — or from anywhere in fly
   mode — its edge crosses the middle of the frame as a hard diagonal seam with
   shadows on one side and none on the other, which reads as a rendering fault
   because it is one. So scale the box with altitude. Wider means each shadow
   texel covers more ground, but at the altitude where it widens you cannot
   resolve a texel anyway, and a soft shadow beats a visible boundary. */
const SHADOW_HALF_MIN = 45;
const SHADOW_HALF_MAX = 300;
let shadowHalf = 0;

function trackSun(x, y, z) {
  if (!sun || !sunTarget) return;
  sunTarget.position.set(x, y, z);
  sunTarget.updateMatrixWorld();
  const [dx, dy, dz] = SKY[skyName].sunOffset;
  sun.position.set(x + dx, y + dy, z + dz);
  sun.updateMatrixWorld();

  const altitude = Math.max(0, camera.position.y - y);
  const want = Math.min(SHADOW_HALF_MAX, SHADOW_HALF_MIN + altitude * 1.15);
  /* Only when it has actually moved: an ortho camera caches its projection and
     rebuilding it every frame is pure waste. */
  if (Math.abs(want - shadowHalf) > 4) {
    shadowHalf = want;
    const c = sun.shadow.camera;
    c.left = -want; c.right = want; c.top = want; c.bottom = -want;
    c.far = Math.max(320, want * 3.2);
    c.updateProjectionMatrix();
  }
}

/* ---------------------------------------------------------------- the path */

/**
 * The painted lane ribbon.
 *
 * Draped on the "carpet" rung of the shared decal ladder and the dashes on
 * "paint" above it (campus-overlay.js). Both lifts come from that module
 * rather than being chosen here — tests/campus-overlay.test.mjs greps every
 * file in docs/js for a locally-declared lift, and it is right to: two modules
 * picking their own numbers is exactly how a z-fighting bug gets shipped.
 *
 * The ladder has TWO halves and both are required. applyOverlayDepth sets the
 * material's polygon offset and turns depth writing off; the rung's
 * renderOrder has to be set on the MESH, because Three.js has no per-material
 * draw order. Setting only the first half is not a subtle bug: the ribbon
 * renders, is correctly positioned, writes no depth, sorts front-to-back
 * ahead of the plaza it sits on, and is then painted over by it — invisible,
 * with nothing in the scene graph to say so.
 */
const drape = (mesh, rung) => {
  mesh.renderOrder = OVERLAY[rung].renderOrder;
  /* The track is the surface the rider looks at for the whole run, so it is
     the one that most needs the scooter's own shadow on it. */
  mesh.receiveShadow = true;
  return mesh;
};
/**
 * The track, as markings on the measured ground.
 *
 * NOT a road surface. This used to lay an opaque grey carpet the full width of
 * the route and paint dashes on it — which read as a highway dropped on the
 * campus, and hid the one thing the corridor exists to show: the measured
 * ground, its surveyed colour, and the painted markings already on it. The
 * track is gameplay information, so it is drawn the way information is
 * drawn — as lines over what is there, not as a thing that replaces it.
 *
 * Two continuous edge stripes and nothing between them: the rider steers
 * freely across the width, so there are no lanes to divide. A continuous
 * line is how a real carriageway marks an edge you should not cross, so it
 * needs no explaining.
 *
 * Both sit on the "paint" rung of the shared decal ladder
 * (campus-overlay.js) rather than choosing their own lift —
 * tests/campus-overlay.test.mjs greps every file in docs/js for a locally
 * declared lift, and it is right to: two modules picking their own numbers is
 * exactly how a z-fighting bug ships.
 */
function createRibbon(group, route, game) {
  const paint = overlayLift("paint");
  const edgeOff = game.halfWidth;   // the painted edges of the track

  /* One stripe: a quad strip at a constant lateral offset, either continuous or
     broken. Built as flat triangles that follow the terrain, because a single
     long quad would sink into every rise the route climbs. */
  const stripe = (off, { width, dash = 0, gap = 0 }) => {
    const out = [];
    const step = dash || 2;
    const stride = dash ? dash + gap : step;
    for (let s = 0; s + step <= route.metres; s += stride) {
      const a = positionAt(route, s, off);
      const b = positionAt(route, s + step, off);
      const quad = [
        [a.x + a.normal.x * -width, a.z + a.normal.z * -width],
        [a.x + a.normal.x * width, a.z + a.normal.z * width],
        [b.x + b.normal.x * -width, b.z + b.normal.z * -width],
        [b.x + b.normal.x * width, b.z + b.normal.z * width],
      ].map(([x, z]) => [x, surfaceAt(x, z) + paint, z]);
      out.push(...quad[0], ...quad[2], ...quad[1], ...quad[1], ...quad[2], ...quad[3]);
    }
    return out;
  };

  const position = [
    ...stripe(-edgeOff, { width: 0.09 }),
    ...stripe(edgeOff, { width: 0.09 }),
  ];

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
  geo.computeVertexNormals();
  /* Slightly translucent: at full opacity the paint is the brightest thing in
     frame and pulls the eye off the campus, which is the opposite of the
     point. It still reads clearly against grass, plaza and asphalt alike. */
  const stripes = drape(new THREE.Mesh(geo, applyOverlayDepth(
    new THREE.MeshLambertMaterial({
      color: 0xf6f4ea, side: THREE.DoubleSide, transparent: true, opacity: 0.82,
    }), "paint"
  )), "paint");
  group.add(stripes);

  /* A finish line at Peterson, because a route with no visible end is a route
     you do not know you are winning. */
  const fin = positionAt(route, route.metres - 2, 0);
  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(edgeOff * 2, 0.06, 0.5),
    /* transparent so it can fade in with the stripes. Without the flag,
       setting opacity does nothing and the bar pops in at full strength one
       frame after the fade starts. It already has depthWrite:false and an
       explicit renderOrder from applyOverlayDepth/drape, so joining the
       transparent pass does not change what it draws over. */
    applyOverlayDepth(new THREE.MeshLambertMaterial({
      color: 0xf2f0e6, transparent: true,
    }), "logo")
  );
  bar.position.set(fin.x, surfaceAt(fin.x, fin.z) + overlayLift("logo") + 0.03, fin.z);
  bar.rotation.y = fin.heading;
  group.add(drape(bar, "logo"));

  /* THE MARKINGS BELONG TO THE PLAYER, NOT TO THE SHOT.
   *
   * During the opening reveal there is nothing to steer, so painted edges
   * are answering a question nobody has asked yet — and they were the most
   * eye-catching thing in a frame whose subject is Eighth College. They arrive
   * when control does, which is `endIntro`, and every way out of the intro goes
   * through it.
   *
   * Hidden at CREATION rather than at the start of the shot, so a slow load
   * cannot flash them before the first frame. `visible` as well as opacity
   * because zero-opacity geometry is still submitted, and because it is the
   * honest state: the track is not there yet. */
  const parts = [{ mesh: stripes, base: 0.82 }, { mesh: bar, base: 1 }];
  const setReveal = (a) => {
    for (const { mesh, base } of parts) {
      mesh.visible = a > 0.001;
      mesh.material.opacity = base * a;
    }
  };
  setReveal(0);
  return { setReveal };
}

/** The skyline tier: plain extrusions of the tall things past the corridor. */
function createSkyline(scene, skyline) {
  if (!skyline?.length) return null;
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x9aa3ab });
  for (const m of skyline) {
    const shape = new THREE.Shape(m.r.map(([x, z]) => new THREE.Vector2(x, z)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: m.h, bevelEnabled: false });
    geo.rotateX(Math.PI / 2);
    const mesh = new THREE.Mesh(geo, m.c ? new THREE.MeshLambertMaterial({ color: m.c }) : mat);
    /* Sat on the terrain at the ring's own centre — a skyline building is
       never walked to, so one sample is the right amount of precision. */
    let cx = 0, cz = 0;
    for (const [x, z] of m.r) { cx += x; cz += z; }
    mesh.position.y = heightAt(cx / m.r.length, cz / m.r.length);
    group.add(mesh);
  }
  scene.add(group);
  return group;
}

/* --------------------------------------------------------------- the props */

function createProps(scene, route, game) {
  const group = new THREE.Group();

  for (const o of game.obstacles) {
    const mesh = createObstacle(o.kind);
    const p = positionAt(route, o.s, o.off);
    /* THE SAME PLANE THE SCOOTER IS ON, and not merely so it looks right:
       scooter-ride.js decides a hop cleared an obstacle with `ride.y > o.h`,
       where ride.y is height above the deck's resting plane. Put the obstacle
       on a different datum and that comparison is quietly lying about
       clearance. */
    mesh.position.set(p.x, rideSurfaceAt(p.x, p.z), p.z);
    mesh.rotation.y = p.heading + (o.spin || 0);
    group.add(mesh);
  }

  const coins = coinFactory();
  const coinMeshes = [];
  for (const c of ride.coinList) {
    const mesh = coins.make();
    const p = positionAt(route, c.s, c.off);
    mesh.position.set(p.x, rideSurfaceAt(p.x, p.z) + c.y, p.z);
    mesh.rotation.y = p.heading;
    group.add(mesh);
    coinMeshes.push({ mesh, coin: c });
  }

  scene.add(group);
  return { group, coinMeshes };
}

/** What the fly-mode banner says. Its own function because the HUD writes it
    from two places and they must not drift. */
function flyLabel() {
  return `fly · ${Math.round(flyS)} m · ${Math.round(explore?.speed ?? 0)} m/s · `
    + `W A S D · Q E height · ↑↓ speed · [ ] along route · F to ride`;
}

/* ---------------------------------------------------------------- the HUD */

function bindHud(mode) {
  const el = (id) => document.getElementById(id);
  const node = {
    root: el("ride-hud"),
    clock: el("ride-clock"),
    coins: el("ride-coins"),
    left: el("ride-left"),
    speed: el("ride-speed"),
    flash: el("ride-flash"),
    finish: el("ride-finish"),
    finishBody: el("ride-finish-body"),
    fly: el("ride-fly"),
  };
  if (!node.root) return null;
  node.root.hidden = false;

  /* "Run it again" has to come back to the corridor you were actually on —
     the markup can only name one, and on staging that would quietly bounce
     you into the shipped run. */
  const again = document.getElementById("ride-again");
  if (again) again.href = `?mode=${mode}`;
  /* The staging badge. This corridor is reachable from the live site, so it
     says on screen that it is the work zone and not the run. */
  const badge = document.getElementById("ride-staging");
  if (badge) badge.hidden = mode !== "staging";

  /* The sky toggle is a button as well as a key. T is faster once you know
     it; the button is how you find out it exists. */
  el("ride-sky")?.addEventListener("click", toggleSky);

  let flashUntil = 0;
  let lastHitAt = -1;

  return {
    /* The HUD says which camera you are in, because a screenshot otherwise
       cannot tell a paused inspection flight from a run going badly. */
    setMode(mode) {
      node.root.dataset.mode = mode;
      if (node.fly) {
        node.fly.hidden = mode !== "fly";
        node.fly.textContent = flyLabel();
      }
    },
    update(now) {
      if (camMode === "fly") {
        node.fly.textContent = flyLabel();
        return;
      }
      const s = ride.status();
      node.clock.textContent = s.clock.toFixed(1);
      node.coins.textContent = String(s.coins);
      node.left.textContent = Math.round(s.remaining);
      node.speed.textContent = (s.speed * 3.6).toFixed(0);

      const hit = ride.lastHit;
      if (hit && hit.at !== lastHitAt) {
        lastHitAt = hit.at;
        flashUntil = now + 900;
        node.flash.textContent = `${hit.kind} · +3.0 s`;
      }
      node.flash.classList.toggle("show", now < flashUntil);

      if (s.finished && node.finish.hidden) {
        node.finish.hidden = false;
        const beat = s.par != null && s.clock <= s.par;
        node.finishBody.innerHTML = [
          `<span class="ride-h">${s.clock.toFixed(1)}</span> s`,
          s.par != null ? `par <span class="ride-h">${s.par.toFixed(1)}</span> s` : "",
          `<span class="ride-h">${s.coins}</span> coins`,
          `<span class="ride-h">${s.hits}</span> hits`,
        ].filter(Boolean).join(" &middot; ");
        node.finish.classList.toggle("beat", beat);
      }
    },
  };
}

/* Keys released since the last frame, held back until one update() has seen
   them.
 *
 * Lane changes and hops are edge-triggered off the held set, so a key that
 * arrives and leaves between two frames would never appear in one — and a
 * genuinely quick tap does exactly that. It is not hypothetical: the first
 * headless run of this mode pressed D for a lane change and the rider never
 * moved, because keydown and keyup both landed inside a single 16 ms frame.
 * Deferring the delete guarantees every press is visible to at least one
 * update, which is the difference between "responsive" and "sometimes
 * ignores you". */
const releasing = new Set();
const drag = { on: false, x: 0, y: 0 };
let touchSteer = null; // the held steering key while a finger is down

function drainReleases() {
  if (!releasing.size) return;
  for (const k of releasing) held.delete(k);
  releasing.clear();
}

function tap(key) {
  held.add(key);
  releasing.add(key);
}

function bindInput(canvas) {
  addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    held.add(k);
    releasing.delete(k); // a real hold cancels any pending release
    if ([" ", "w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
      e.preventDefault();
    }
    /* Escape goes back to the menu. A game you cannot leave without reloading
       is a game the second mode is hard to reach from. */
    if (k === "escape") location.search = "";
    if (k === "t") toggleSky();
    if (k === "l" && labels) labels.visible = !labels.visible;
    if (k === "f") toggleFly();
    /* Scrub the free camera along the route — the reason it exists is to get
       to the stretch you are working on without riding there. */
    if (camMode === "fly" && (k === "[" || k === "]")) {
      flyTo(flyS + (k === "]" ? FLY_SCRUB_M : -FLY_SCRUB_M));
    }
    /* Anything else skips the intro. Deliberately last, so the keys above keep
       their own meaning on the frame they also cut the orbit short. */
    if (camMode === "intro") endIntro();
  });
  addEventListener("keyup", (e) => releasing.add(e.key.toLowerCase()));
  addEventListener("blur", () => { held.clear(); releasing.clear(); });
  /* Hold the left or right half of the canvas to steer, and tap the top
     third to hop, so this is playable on a phone without a keyboard. */
  canvas.addEventListener("pointerdown", (e) => {
    if (camMode === "intro") { endIntro(); return; } // a tap skips it too
    if (camMode === "fly") {
      drag.on = true; drag.x = e.clientX; drag.y = e.clientY;
      /* Captured, like free roam. Without this a look-drag dies the moment the
         pointer crosses the edge of the canvas, which on a wide turn is most
         of them. */
      canvas.setPointerCapture?.(e.pointerId);
      return;
    }
    if (e.clientY < canvas.clientHeight / 3) tap(" ");
    else {
      /* Steering is a hold, not a tap: the finger stays down and the key stays
         held until it lifts, exactly like the keyboard. */
      touchSteer = e.clientX < canvas.clientWidth / 2 ? "a" : "d";
      held.add(touchSteer);
      releasing.delete(touchSteer);
    }
  });

  /* Drag to look, in fly mode only — the chase camera aims itself. The
     sensitivities and the pitch clamp are campus-walk.js's, to the digit: one
     mode, one feel. This used to keep a private `flyPitch` at 0.004/0.003 and
     -1.4..1.0, so the same gesture moved the view by a different amount
     depending on which mode you were in, for no reason anyone chose. */
  canvas.addEventListener("pointermove", (e) => {
    if (!drag.on || camMode !== "fly") return;
    explore.yaw -= (e.clientX - drag.x) * 0.005;
    explore.pitch = Math.max(-1.35, Math.min(1.2, explore.pitch - (e.clientY - drag.y) * 0.004));
    drag.x = e.clientX;
    drag.y = e.clientY;
  });
  const stopDrag = (e) => {
    drag.on = false;
    if (touchSteer) { releasing.add(touchSteer); touchSteer = null; }
    if (canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  };
  for (const ev of ["pointerup", "pointercancel"]) canvas.addEventListener(ev, stopDrag);
}

/* --------------------------------------------------------------- the frame */

function resize() {
  const canvas = renderer.domElement;
  const w = canvas.clientWidth || 1;
  const h = canvas.clientHeight || 1;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

let props = null;
let spin = 0;
let bank = 0;

/* The track markings and their reveal. 600 ms, eased out: the first dodge
   is seconds away, so the near-field information has to land in the
   first fifth of the ramp and the tail is free polish. It fades to the shipped
   0.82 rather than to 1 — that translucency is a deliberate art call (see
   createRibbon) and overshooting it would quietly undo it. */
const REVEAL_S = 0.6;
let ribbon = null;
let revealing = false;
let revealT = 0;

/* -------------------------------------------------------- the camera modes */

/* Three states, and only one of them is the game.
 *
 *   intro      the opening 360° around the scooter. The ride is frozen.
 *   chase      the run itself.
 *   fly        map inspection, on free roam's own controller. The ride is
 *              frozen — deliberately, so this can never be a way to move the
 *              scooter or the clock.
 *
 * Held here rather than as three booleans because they are mutually exclusive
 * and a pair of booleans is how you end up orbiting and flying at once. */
let camMode = "intro";

/* THE OPENING SHOT — a vertical reveal, not an orbit.
 *
 * It starts 165 m over the Eighth College courts, high enough that the college's
 * towers read as the tall things they are rather than as walls, and comes
 * straight down onto the scooter. An orbit at head height, which is what this
 * was, showed the court and nothing above it — on a campus whose newest college
 * is its tallest, that is the one thing worth opening on.
 *
 * The scooter is not parked through it. It holds for LAUNCH_S while the camera
 * falls, then accelerates off the court and onto the pavement, and the shot ends
 * where the rider takes over — INTRO_END_M along, which is the lead-in across
 * the court plus enough pavement to be up to speed. The clock does not run for
 * any of it; scooter-ride.js's `counting` flag is what buys that. */
const INTRO_Y_FROM = 108;
/* 120 m back, not 26. From directly overhead the camera looks straight DOWN,
   and a tower seen from straight down is a roof — the one shot that makes a
   tall building look like nothing. Pulling the start back puts the descent at
   about 40 degrees, which is the angle at which Eighth College's towers stand
   against the sky instead of lying flat on the ground. The move is still
   dominated by the drop (135 m down against 116 m in), so it reads as coming
   down rather than flying in. */
const INTRO_BACK_FROM = 86;
const INTRO_LAUNCH_S = 1.8;   // camera falls this long before the scooter moves
/* Only the fallback, for a route with no lead-in to derive from — see
   introFallS below, which is what the shot actually runs on. */
const INTRO_FALL_S = 5.4;
const INTRO_END_PAD_M = 10;   // pavement past the lead-in before the hand-over
const INTRO_MAX_S = 14;       // a hard stop, so a stalled ride cannot hold the shot
let introT = 0;
let introEndM = 0;            // set at boot from the route's own lead-in
/* How long the descent takes, DERIVED at boot rather than declared.
 *
 * INTRO_FALL_S was a hand-picked 5.4 s racing a hand-picked hand-over distance,
 * and whenever the ride won the race the camera was cut off mid-air. The time
 * for the scooter to cover introEndM from rest at its published acceleration is
 * closed-form, so the descent can simply be given that long: the two clocks
 * cannot disagree because there is only one answer. It also means the length of
 * the shot comes from the machine's real numbers, which is how the rest of this
 * project prefers to choose things. */
let introFallS = INTRO_FALL_S;

/** Seconds for the ride to cover `metres`, accelerating from 0 and capped. */
function launchSeconds(metres) {
  const toTop = TOP_SPEED_MPS / ACCEL_MPS2;
  const atTop = 0.5 * ACCEL_MPS2 * toTop * toTop;
  return metres <= atTop
    ? Math.sqrt((2 * metres) / ACCEL_MPS2)
    : toTop + (metres - atTop) / TOP_SPEED_MPS;
}

/* FLY MODE IS FREE ROAM'S CONTROLS, NOT A SECOND SET.
 *
 * This used to be a bespoke camera with its own speed constant and its own key
 * handling — which meant the site had two ways to fly that felt different, and
 * the one you had already learned was the one that did not apply here. It is
 * now literally campus-explore.js: the same W/A/S/D, the same Q/E climb that
 * scales with your clearance, the same arrow-key speed ladder, the same shift.
 * The only thing scooter mode adds is [ and ], which jump you along the route,
 * because on a corridor that is the axis you actually want to travel.
 *
 * createExplore clamps to the terrain it is given, and the terrain here is the
 * corridor crop — so fly mode cannot wander off the edge of the cut world. */
let explore = null;
let flyS = 0;               // where along the route the last jump put us
const FLY_START_SPEED_MPS = 45;   // the slider's starting notch, not a cap
const FLY_SCRUB_M = 60;

const easeInOut = (u) => (u < 0.5 ? 2 * u * u : 1 - ((-2 * u + 2) ** 2) / 2);

/* Fog and the far plane have to open up as you climb, or fly mode's whole
 * reason for existing — getting above the corridor to look at it — returns a
 * rectangle of haze. campus-explore.js has exactly this function and it is
 * deliberately NOT imported, for two reasons that would each be a bug:
 *
 *  - it writes free roam's fog numbers, which would overwrite this mode's sky
 *    table (sunset is 55/300, not 90/420) and never restore it on the way out;
 *  - it sets far = 1100 + lift*14, and at ground level 1100 is BELOW the 1400
 *    this mode's camera was given to clear campus-world's radius-1000 sky
 *    dome. Importing it would slice a wedge out of the sky, which is the exact
 *    artefact that 1400 was chosen to fix.
 *
 * The RATES are copied from campus-explore.js on purpose, so climbing feels the
 * same in both modes and only the ground-level base differs. That base
 * difference is art direction, which AGENTS.md allows this mode to keep. */
/* The corridor's skyline ring: SKYLINE_M in scripts/build-corridor.mjs. Past
   this radius the crop simply has no world in it. */
const FOG_FAR_CAP_M = 520;

function scaleRideAtmosphere(hover) {
  const s = SKY[skyName] || SKY.noon;
  const up = Math.max(0, hover - EYE);
  /* CAPPED AT THE EDGE OF THE CUT WORLD, which is the one thing free roam does
     not have to think about. This is a 130 m corridor with a 520 m skyline ring
     around it and nothing beyond; open the fog past that and the reveal shot
     stops showing Eighth College and starts showing where the crop was made —
     a smeared terrain apron and a hard boundary across the frame. The lift is
     for seeing the buildings, not for seeing the seam. */
  const fogFar = Math.min(FOG_FAR_CAP_M, s.fogFar + up * 11);
  scene.fog.near = Math.min(s.fogNear + up * 4, fogFar * (s.fogNear / s.fogFar));
  scene.fog.far = fogFar;

  /* The clip planes are NOT capped with the fog. Fog hides the seam; a near
     far-plane would clip the skyline ring itself out of frame, and 1400 is
     what keeps campus-world's radius-1000 sky dome intact. */
  const far = Math.max(1400, 1100 + up * 14);
  const near = Math.max(0.5, up / 1000);
  if (Math.abs(camera.far - far) > 1 || Math.abs(camera.near - near) > 0.05) {
    camera.far = far;
    camera.near = near;
    camera.updateProjectionMatrix();
  }
}

/* EVERY HAND-OVER IS A GLIDE, NOT A CUT.
 *
 * Four of them used to be a `copy()`: the end of the intro, both directions of
 * F, and every [ or ] press. A cut between two individually correct poses is
 * still a cut, and it was the one thing in this mode that read as a bug rather
 * than as a camera.
 *
 * The source pose is frozen at the moment of the switch; the target is re-read
 * every frame, because the chase camera's ideal pose is itself moving and a
 * blend towards a stale target lands wrong and then jumps. easeInOut has zero
 * derivative at both ends, so neither the departure nor the arrival has a
 * velocity step — which is what the continuity gate in scripts/verify-ride.mjs
 * measures.
 *
 * ONE SNAP IS KEPT ON PURPOSE: entering fly, and the [ / ] scrubs. Fly is a
 * workbench and instant relocation is the feature; animating 60 m per bracket
 * press would make scrubbing slower for nothing. Cuts mean "tool", glides mean
 * "game". */
/* The duration is derived from the distance, not fixed, and that is the whole
 * difference between a move and a whip-pan. A fixed 0.45 s covers three metres
 * and ninety metres in the same time — and ninety is real, because skipping the
 * intro on its first second leaves the camera 90 m up. At a fixed duration that
 * is a 200 m/s dive, which is a cut with extra steps.
 *
 * So: a rate, floored so a short hop is not instant and capped so a long one
 * does not become a cutscene of its own. 70 m/s is about the speed the intro's
 * own descent already moves at, so a skip reads as the same shot, hurried. */
const CAM_GLIDE_MPS = 70;
const CAM_GLIDE_MIN_S = 0.35;
const CAM_GLIDE_MAX_S = 1.1;
const blendFrom = new THREE.Vector3();
const blendAim = new THREE.Vector3();
let blendT = 0;
let blendDur = 0;

function beginCamGlide(target = null) {
  blendFrom.copy(camera.position);
  blendAim.copy(camAim);
  blendT = 0;
  const far = target ? camera.position.distanceTo(target) : 0;
  blendDur = Math.max(CAM_GLIDE_MIN_S, Math.min(CAM_GLIDE_MAX_S, far / CAM_GLIDE_MPS));
}

/** Place the camera at a target pose, easing through any glide still in flight. */
function applyCamera(dt, wantPos, wantAim) {
  if (blendDur > 0) {
    blendT += dt;
    const e = easeInOut(Math.min(1, blendT / blendDur));
    camera.position.lerpVectors(blendFrom, wantPos, e);
    camAim.lerpVectors(blendAim, wantAim, e);
    if (blendT >= blendDur) blendDur = 0;
  } else {
    camera.position.copy(wantPos);
    camAim.copy(wantAim);
  }
  camera.lookAt(camAim);
}

/** The chase camera's ideal pose for the rider's current position. */
function chasePose(p) {
  const behind = {
    x: p.x - p.tangent.x * CHASE_BACK_M,
    z: p.z - p.tangent.z * CHASE_BACK_M,
  };
  const ahead = positionAt(
    doc.route, Math.min(doc.route.metres, ride.s + CHASE_LOOK_AHEAD_M), ride.laneX * 0.5
  );
  return {
    pos: new THREE.Vector3(behind.x, rideSurfaceAt(behind.x, behind.z) + CHASE_UP_M + ride.y * 0.4, behind.z),
    aim: new THREE.Vector3(ahead.x, rideSurfaceAt(ahead.x, ahead.z) + 1.25, ahead.z),
  };
}

/**
 * The opening reveal.
 *
 * Falls from 165 m onto the scooter while the scooter launches off the court,
 * and hands over once it has reached the pavement. The ride's physics run
 * throughout — that is the point, the acceleration is the shot — but the clock
 * does not, because `ride.update` is called with counting = false. Nobody pays
 * for the cinematography.
 */
function stepIntro(dt) {
  introT += dt;

  /* The scooter holds still, then goes. Feeding the real ride rather than
     animating a fake one means the launch you watch is the launch you get. */
  const prevLaneX = ride.laneX;
  if (introT > INTRO_LAUNCH_S) ride.update(dt, new Set(), false);
  const { p, gy } = placeScooter(dt, prevLaneX);
  const chase = chasePose(p);

  /* ONE CLOCK FOR THE WHOLE SHOT.
   *
   * There used to be two. The descent ran on a timer while the hand-over fired
   * on distance, so whenever the rider reached introEndM before the timer
   * finished, `endIntro` copied the chase pose in while the camera was still
   * 40 m up — a jump cut, every time, and worse the faster the launch went.
   *
   * Now the descent, the pull-in and the aim all ride the same `u`, so at u = 1
   * the camera IS the chase pose in position, height and aim, and the hand-over
   * is a no-op rather than a cut. It is the max of the two terms because both
   * endings are real: the timer makes the descent read as a descent before
   * anything moves, and the distance term overtakes it when the ride is quick,
   * so the camera arrives exactly when the rider does. */
  const byDistance = introEndM > 0 ? ride.s / introEndM : 1;
  const byTime = introT / introFallS;
  const u = Math.max(0, Math.min(1, Math.max(byDistance, byTime)));

  const fall = easeInOut(u);
  const y = gy + INTRO_Y_FROM + (chase.pos.y - gy - INTRO_Y_FROM) * fall;

  /* Straight down the line behind the rider: the horizontal offset shrinks from
     26 m to the chase camera's own 3.8 m, so there is no swing — the whole
     move is vertical, which is what makes the towers pass the frame. */
  const back = INTRO_BACK_FROM + (CHASE_BACK_M - INTRO_BACK_FROM) * fall;
  camPos.set(p.x - p.tangent.x * back, y, p.z - p.tangent.z * back);

  /* Aim high on the college at the top of the shot and settle onto the chase
     camera's look-ahead by the end, so the opening frame is the buildings and
     the closing frame is the pose the run is played in. The lift decays with
     the fall — by the time the camera is low there is nothing above it to
     look at. */
  const lift = 34 * (1 - fall);
  const wantAim = new THREE.Vector3(p.x, gy + 1.1 + lift, p.z).lerp(chase.aim, fall);
  /* Through applyCamera like every other mode, so that pressing F during the
     shot has a source pose to glide out of rather than cutting from mid-air. */
  applyCamera(dt, camPos, wantAim);
  /* The shot's whole subject is Eighth College's towers, and at 108 m the fog
     written for a deck at 1.4 m turns them into a grey suggestion. */
  scaleRideAtmosphere(camera.position.y - gy);
  trackSun(p.x, gy, p.z);
  /* Keep the panel honest during the shot. It used to sit on whatever the
     static HTML said, which meant the intro announced the previous route's
     length for seven seconds before the first real frame corrected it. */
  hud?.update(performance.now());

  if (u >= 1 || introT >= INTRO_MAX_S) endIntro();
}

/** Skip or finish the intro: hand control over and let the chase camera settle. */
function endIntro() {
  if (camMode !== "intro") return;
  camMode = "chase";
  /* SEAT THE DAMPER, THEN GLIDE. The order matters and the reason is not
     obvious: beginCamGlide freezes where the camera IS, and camPos is the
     chase damper's own state, which step() then eases toward the ideal pose
     with a 0.16 s time constant. Leaving camPos up at the intro's altitude
     means that damper — not the glide — carries the descent, and 0.16 s to
     fall a hundred metres is a whip-pan with a smooth curve on it. Seating
     camPos at the chase pose puts the damper at rest so the only thing moving
     the camera is the glide, whose duration is derived from exactly that
     distance. */
  const chase = chasePose(ride.position());
  beginCamGlide(chase.pos);
  camPos.copy(chase.pos);
  camAim.copy(chase.aim);
  started = true;
  /* The track markings are gameplay information, so they arrive with control —
     not when the camera finishes settling. */
  revealing = true;
  hud?.setMode("chase");
}

/** Free roam's own controller, over the corridor. The ride is paused while it is up. */
function stepFly(dt) {
  /* Arrow keys drive the speed ladder here exactly as they do in free roam.
     They are the steering keys during the run; the mode decides which. */
  explore.speed = stepSpeed(explore.speed, dt, held);
  const pose = explore.update(dt, held);

  /* Spherical, not cylindrical — the horizontal reach shrinks by cos(pitch) as
     the view tips, exactly as campus-walk.js does it. Without that, "straight
     down" bottoms out at 45 degrees. */
  const flat = Math.cos(explore.pitch) * 14;
  applyCamera(
    dt,
    FLY_POS.set(pose.x, pose.y, pose.z),
    FLY_AIM.set(
      pose.x + Math.sin(pose.yaw) * flat,
      pose.y + Math.sin(explore.pitch) * 14,
      pose.z + Math.cos(pose.yaw) * flat
    )
  );
  /* Steady-state fly is undamped, like free roam — only the hand-over eases,
     and applyCamera is a straight copy once the glide has run out. */
  camPos.copy(camera.position);
  scaleRideAtmosphere(explore.hover);
  trackSun(pose.x, pose.ground, pose.z);
  hud?.update(performance.now());
}
const FLY_POS = new THREE.Vector3();
const FLY_AIM = new THREE.Vector3();

/** Jump the free camera to a distance along the route. */
function flyTo(s) {
  flyS = Math.max(0, Math.min(doc.route.metres, s));
  const p = positionAt(doc.route, flyS, 0);
  explore.enterAt(p.x - p.tangent.x * 14, p.z - p.tangent.z * 14, p.heading);
  explore.hover = 9;
  explore.pitch = -0.18;
}

function toggleFly() {
  if (camMode === "intro") endIntro();
  if (camMode === "fly") {
    camMode = "chase";
    started = true;
    /* Back into the play view, so it glides — the same principle as the intro:
       control returns immediately, the camera catches up. */
    /* Same order as endIntro, and for the same reason: seat the damper at the
       chase pose so the glide is the only thing travelling. */
    const chase = chasePose(ride.position());
    beginCamGlide(chase.pos);
    camPos.copy(chase.pos);
    camAim.copy(chase.aim);
    /* The fog needs no resetting here: step() drives it from the camera's own
       height every frame, so it unwinds along with the glide back down. */
  } else {
    camMode = "fly";
    started = false; // the run and its clock stop dead
    flyTo(ride.s);
    blendDur = 0;    // entering the workbench is the snap that is kept
    /* The workbench is not the game: no speed-linked lens on a camera whose
       speed is the slider's, not the rider's. */
    if (camera.fov !== BASE_FOV) { camera.fov = BASE_FOV; camera.updateProjectionMatrix(); }
  }
  hud?.setMode(camMode);
}

/* THE RIDE PLANE — where "on the ground" is, for everything this mode puts on
 * the route.
 *
 * Two separate mistakes used to add up to "the scooter is under the ground",
 * and both are fixed here rather than nudged:
 *
 *  1. THE WRONG SURFACE. `heightAt` interpolates the full 3 m LiDAR grid, but
 *     the terrain you can SEE is drawn from every second sample, so wherever a
 *     skipped sample was a local low the drawn triangles bow above the sampled
 *     height and the machine is genuinely beneath them. `surfaceAt` is the
 *     height of the drawn triangle, which is the only surface a viewer can
 *     compare the scooter against.
 *  2. THE WRONG DATUM. Everything you read as ground here is a lifted decal:
 *     campus-world drapes plazas, walks and roads on the `ground` rung and the
 *     Eighth basketball court sits on `pad`. A machine placed at raw terrain
 *     height therefore has 5-9 cm of drawn pavement over its wheels, and this
 *     mode's own lane paint (`paint`, 0.17) floated 2 cm ABOVE the deck at
 *     0.15 — the markings were literally over the scooter.
 *
 * The rung is `pad`, and it is a choice between two wrongs. The route crosses
 * exactly two drawn surfaces, `ground` (0.05) and the court's `pad` (0.09), so
 * `pad` is never more than 4 cm from either — well under the 10 cm wheel, so
 * invisible — while putting the deck at 0.24, a clear 7 cm above the lane
 * paint. Matching `paint` instead would make the contact patch coplanar with
 * the stripes, which sounds tidy and is physically backwards: you ride ON the
 * paint, not in it, and it would float the machine 12 cm over open pavement,
 * which is the entire wheel. */
const RIDE_RUNG = "pad";
const rideSurfaceAt = (x, z) => surfaceAt(x, z) + overlayLift(RIDE_RUNG);

/* Wheelbase, from scooter-model.js's own R.nose / R.tail. */
const NOSE_M = 0.42;
const TAIL_M = -0.44;
/* Pitch is filtered, height is not. Smoothing the height is what would put the
   wheels back under a crest; only the ANGLE needs settling, because
   surfaceAt is continuous but its gradient steps at every triangle edge — one
   step per second at 6.9 m/s across a 6 m mesh. 0.12 s is 0.8 m of travel:
   quick enough to follow the court-to-pavement grade break the intro hands
   over on, slow enough that an edge arrives as a settle rather than a snap. */
const PITCH_LAG_S = 0.12;
let ridePitch = 0;
/* About 3 degrees at full hop velocity. Enough to read as leaving the ground,
   far short of a stunt — this is a commuter scooter. */
const HOP_PITCH_RAD = 0.055;
let prevRideY = 0;

/**
 * Put the machine where the ride says it is, and animate it accordingly.
 *
 * Split out of step() because the intro moves the scooter too — it accelerates
 * off the court while the camera comes down — and a launch whose wheels do not
 * turn is worse than no launch at all.
 */
function placeScooter(dt, prevLaneX) {
  const p = ride.position();

  /* Both wheels touch. Sampling one point under the middle and holding the
     machine level buries the downhill wheel and floats the uphill one on any
     grade — the same complaint as sinking, arriving through a different door.
     So sample at the two contact patches, sit on the plane they define, and
     pitch to match it. */
  const fy = rideSurfaceAt(p.x + p.tangent.x * NOSE_M, p.z + p.tangent.z * NOSE_M);
  const ry = rideSurfaceAt(p.x + p.tangent.x * TAIL_M, p.z + p.tangent.z * TAIL_M);
  const gy = (fy + ry) / 2;
  /* Nose up off the kerb, nose down on the way in. Read from the sign of the
     hop's vertical velocity rather than from the key that started it, so a hop
     that gets cut short still lands nose-first and the two can never disagree.
     It is the only aerial move the game has and it costs one rotation. */
  const climb = dt > 0 ? (ride.y - prevRideY) / dt : 0;
  prevRideY = ride.y;
  const airborne = ride.y > 0.01;
  const wantPitch = Math.atan2(fy - ry, NOSE_M - TAIL_M)
    + (airborne ? Math.max(-1, Math.min(1, climb / 2)) * HOP_PITCH_RAD : 0);
  ridePitch += (wantPitch - ridePitch) * (1 - Math.exp(-dt / PITCH_LAG_S));

  /* YXZ, not the default XYZ: with XYZ the pitch is applied about the WORLD x
     axis, so a pitched scooter heading north would also visibly yaw. */
  scooter.group.rotation.order = "YXZ";
  scooter.group.position.set(p.x, gy + ride.y, p.z);
  scooter.group.rotation.y = p.heading;
  scooter.group.rotation.x = -ridePitch;

  /* Wheels roll at the speed the ground is passing, and the machine leans by
     how fast it is actually moving sideways — both read from the ride rather
     than from the key that caused them, so they cannot disagree with it. */
  spin -= (ride.speed * dt) / 0.1;
  scooter.spin(spin);
  const lateral = dt > 0 ? (ride.laneX - prevLaneX) / dt : 0;
  /* Proper exponential form. `min(1, dt * 12)` is a linear approximation to it
     that saturates on a long frame, so the lean was subtly frame-rate
     dependent — the same defect the chase damper above was already written to
     avoid. Same time constant, so the feel is unchanged. */
  bank += (Math.max(-1, Math.min(1, -lateral / 6)) * MAX_BANK_RAD - bank)
    * (1 - Math.exp(-dt * BANK_RATE_HZ));
  scooter.bank(bank);
  return { p, gy };
}
const BANK_RATE_HZ = 12;
const BASE_FOV = 70;
const FOV_GAIN_DEG = 4;
const FOV_LAG_S = 0.3;

function step(dt, now) {
  const prevLaneX = ride.laneX;
  ride.update(dt, held);

  const { p, gy } = placeScooter(dt, prevLaneX);

  trackSun(p.x, gy, p.z);

  /* Chase camera, damped. The aim point is ahead of the rider on the route,
     not on the rider, so the camera looks INTO the corner on a bend instead of
     at the back of a scooter that has already turned. */
  const behind = {
    x: p.x - p.tangent.x * CHASE_BACK_M,
    z: p.z - p.tangent.z * CHASE_BACK_M,
  };
  const targetY = rideSurfaceAt(behind.x, behind.z) + CHASE_UP_M + ride.y * 0.4;
  camPos.lerp(CHASE_POS.set(behind.x, targetY, behind.z), 1 - Math.exp(-dt / CHASE_LAG_S));

  /* The aim is damped HARDER than the body — 0.10 s against 0.16 s. They used
     to share one constant, and a laggy aim is what makes a corner feel mushy:
     the camera is still looking where the rider was while the rider is already
     round. Tightening only the aim keeps the body's trailing softness, which is
     the part that reads as speed. */
  const ahead = positionAt(doc.route, Math.min(doc.route.metres, ride.s + CHASE_LOOK_AHEAD_M), ride.laneX * 0.5);
  camAim.lerp(
    CHASE_AIM.set(ahead.x, rideSurfaceAt(ahead.x, ahead.z) + 1.25, ahead.z),
    1 - Math.exp(-dt / CHASE_AIM_LAG_S)
  );
  /* Damped first, then handed to applyCamera so a glide still in flight
     governs — the damper decides where the chase camera WANTS to be, the glide
     decides how fast we are still allowed to get there. */
  applyCamera(dt, camPos, camAim);
  /* ONE RULE FOR ALL THREE MODES: the fog follows the CAMERA's height above
     ground, not the rider's. Chase used to leave it wherever the last mode put
     it, so skipping the intro at 90 m stranded the ride inside the fog written
     for 90 m — visibility to the horizon, from a deck. Driving it here also
     means the glide down from a skip unwinds the fog as it lands, instead of
     snapping it back at the hand-over frame. */
  scaleRideAtmosphere(camera.position.y - gy);

  /* A few degrees of FOV as the speed comes up. It is worth the lines
     specifically because a hit drops you to START_SPEED_MPS: the climb back to
     top speed should be something you feel rather than something you read off
     the HUD. Squared, so it is nothing at walking pace and only opens near the
     top, and damped so a hit does not snap the lens. */
  const wantFov = BASE_FOV + FOV_GAIN_DEG * (ride.speed / TOP_SPEED_MPS) ** 2;
  const fov = camera.fov + (wantFov - camera.fov) * (1 - Math.exp(-dt / FOV_LAG_S));
  if (Math.abs(fov - camera.fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }

  /* Coins spin, and vanish the moment they are taken. */
  for (const { mesh, coin } of props.coinMeshes) {
    if (coin.taken) { mesh.visible = false; continue; }
    mesh.rotation.x = now * 0.0028;
  }

  hud?.update(now);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000 || 0);
  last = now;
  if (camMode === "intro") stepIntro(dt);
  else if (camMode === "fly") stepFly(dt);
  else if (started) step(dt, now);

  /* EVERY MODE DRAINS, AND IT HAPPENS HERE.
   *
   * This used to live inside step(), which meant it only ran in chase mode. In
   * fly mode a key entered `held` on keydown and NEVER LEFT: one press of W and
   * the camera flew forward at 45 m/s until campus-explore.js clamped it
   * against the edge of the corridor crop, after which W appeared dead because
   * it was already held. Press S to back off and that stuck too, and since the
   * two cancel exactly, the mode stopped responding at all. Q was the same bug
   * wearing a different hat: one press sank `hover` to its floor and stayed
   * there, and E could never win because a held Q subtracts the same climb E
   * adds. Two symptoms, one missing line.
   *
   * frame() is the right home rather than a second call inside stepFly: it is
   * the only place that runs exactly one update of exactly one mode per
   * animation frame, and it runs after that update in all three. So the
   * guarantee the deferred-release set exists for — that every keydown is seen
   * by at least one update before its keyup applies — is preserved exactly as
   * it was for chase, and extended to the two modes that never had it. */
  drainReleases();

  /* Ticked HERE rather than in step(), because pressing F during the intro goes
     intro -> chase -> fly in one handler and step() never runs again — a ramp
     driven from there would leave the markings permanently invisible in fly
     mode. One comparison per frame once it has finished. */
  if (revealing && revealT < REVEAL_S) {
    revealT = Math.min(REVEAL_S, revealT + dt);
    ribbon?.setReveal(easeInOut(revealT / REVEAL_S));
  }

  labels?.update(camera);
  renderer.render(scene, camera);
}

/* ---------------------------------------------------------------- the boot */

export async function boot({ report, mode = "scooter" } = {}) {
  const rep = report || nullReporter();
  const corridor = CORRIDORS[mode] || CORRIDORS.scooter;

  rep.phase("data");
  await rep.paint();
  const res = await fetch(new URL(`../data/${corridor.file}`, import.meta.url));
  if (!res.ok) throw new Error(`${corridor.file} is missing — run npm run build:corridor`);
  doc = await res.json();
  /* The two corridors are the same document shape, so loading the wrong one
     produces a world that is merely a different route rather than an error.
     The builder stamps which it is; say so out loud instead. */
  if (doc.built?.target && doc.built.target !== mode) {
    throw new Error(`${corridor.file} was built for ?mode=${doc.built.target}, not ${mode}`);
  }
  rep.log(`${doc.route.metres} m · ${doc.route.from} to ${doc.route.to}`);
  rep.log(`${doc.campus.buildings.length} buildings · ${doc.lidar.trees.length} trees`);
  rep.log(`${doc.game.obstacles.length} obstacles · ${doc.game.coins.length} coins (invented)`);
  rep.facts([
    { key: "route", label: "route", value: doc.route.metres, unit: "m" },
    { key: "corridor", label: "corridor", value: doc.built.corridorM, unit: "m" },
    { key: "buildings", label: "buildings", value: doc.campus.buildings.length },
    { key: "trees", label: "trees", value: doc.lidar.trees.length },
    { key: "obstacles", label: "obstacles", value: doc.game.obstacles.length },
    { key: "coins", label: "coins", value: doc.game.coins.length },
  ]);
  await rep.paint();

  rep.phase("gl");
  await rep.paint();
  const canvas = document.getElementById("walk-canvas");
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(1.75, devicePixelRatio));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  /* Tone mapping is the single biggest "looks like a game rather than a
     viewport" change available for free. Free roam does without it on purpose
     — it would sit between you and the measured colour. */
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;

  /* No campus boundary ribbon out here: the corridor is 780 m of a 3 km ring,
     and priming the overlay with null is how campus-world is told not to
     fetch and draw it. */
  world.primeOverlay(null);
  scene = world.createScene();
  /* The far plane must clear campus-world's sky dome, which has a radius of
     1000 and follows the camera. At 700 the dome was being sliced open and the
     scene background showed through the top corners as a pale wedge. Near is
     0.5 rather than 0.25 because the nearest thing to the camera is a scooter
     3.8 m away, and buying depth precision back is free here. */
  camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.5, 1400);
  tuneAtmosphere();

  rep.phase("terrain");
  await rep.paint();
  const terrain = world.createTerrain(scene, doc.lidar, doc.colors, null);
  heightAt = terrain.heightAt;
  surfaceAt = terrain.surfaceAt;
  terrain.mesh.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });

  rep.phase("massing");
  await rep.paint();
  const built = createBuildings(scene, {
    campus: doc.campus,
    lidar: doc.lidar,
    arcgis: doc.arcgis,
    colors: doc.colors,
    facades: doc.facades,
    heightAt,
  });
  built.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const skyline = createSkyline(scene, doc.skyline);

  rep.phase("ground");
  await rep.paint();
  const surfaces = world.createSurfaces(scene, doc.campus, heightAt, doc.arcgis, doc.colors);
  surfaces.traverse?.((o) => { if (o.isMesh) o.receiveShadow = true; });

  rep.phase("trees");
  await rep.paint();
  const trees = world.createTrees(scene, doc.lidar, heightAt, {
    campus3d: doc.campus, arcgis: doc.arcgis, markings: doc.markings,
  });
  trees.group?.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  rep.phase("detail");
  await rep.paint();

  /* THE MEASURED DETAIL. Free roam has built all of this since long before
     there was a scooter; this mode simply was not calling any of it, which is
     why the route read as empty pavement between massing blocks. Every builder
     below is unchanged, takes the cropped data, and no-ops quietly when its
     survey file is absent. Each gets its own dev-panel layer, because being
     able to switch one off is how the last pass's invisible lane ribbon was
     found. */
  /* EVERY PROP BUILDER BELOW GETS surfaceAt, NOT heightAt. The rule is
     campus-terrain.js's own: heightAt interpolates every LiDAR sample while
     the mesh draws every second one, so anything placed at heightAt is
     genuinely underneath the visible ground — measured on this corridor, a
     lamp 4 m off the route sat 8 cm under it. The ride already places the
     scooter and its props on surfaceAt; the campus's own furniture has to
     stand on the same floor. */
  const details = createDetails(scene, doc.campus, surfaceAt);
  details.group?.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  /* The Muir courts, standing up. The corridor crop carries the fitted court
     markings in full, so the ride already painted the basketball and tennis
     LINES — and then ran past slabs with nothing on them. This is free roam's
     own builder over the same cropped data: the nets, the hoop assemblies,
     the court lights. It no-ops quietly when the markings are absent. */
  const recreation = createRecreation(scene, {
    campus: doc.campus, arcgis: doc.arcgis, markings: doc.markings, heightAt: surfaceAt,
  });
  const recreationGroup = recreation?.group ?? (recreation?.isObject3D ? recreation : null);
  recreationGroup?.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  /* Eighth College. NOT optional on the route that starts there: the ride
     begins dead centre on its basketball court and the intro orbits that spot
     for seven seconds, so without this the run opens on a blank grey slab.
     The staging corridor never reaches Eighth, and its crop carries no survey
     of it — `doc.eighth` is null and this builds nothing. */
  const eighthZone = new THREE.Group();
  for (const made of doc.eighth ? [
    createEighth(scene, { campus: doc.campus, arcgis: doc.arcgis, eighth: doc.eighth, markings: doc.markings, heightAt: surfaceAt }),
    createEighthFurniture(scene, { arcgis: doc.arcgis, eighth: doc.eighth, heightAt: surfaceAt }),
  ] : []) {
    /* Some builders hand back { group }, some the Object3D — the same
       both-shapes lesson campus-walk.js:531-538 records. */
    const obj = made?.group ?? (made?.isObject3D ? made : null);
    if (obj) eighthZone.add(obj);
  }
  scene.add(eighthZone);

  /* Measured painted markings, and the campus's own landmarks — the Sun God,
     the fountains, Snake Path. Both quiet no-ops when their file is missing. */
  createMarkings(scene, surfaceAt, doc.markings);
  let landmarksGroup = null;
  if (doc.landmarks) {
    landmarksGroup = createLandmarks(scene, doc.landmarks, {
      origin: doc.campus.origin,
      heightAt: surfaceAt,
      roofTopOf: (name) => {
        let best = null;
        for (const [n, entry] of built.info) {
          if (n.startsWith(name) && (!best || entry.topY > best.topY)) best = entry;
        }
        return best;
      },
    });
  }

  /* Building names, in the ride style: constant-screen-size pills that fade in
     as they come into range, so you can read what you are passing at 25 km/h
     instead of squinting at a roof sign that only gets legible once it is
     behind you. `L` toggles them, same key as free roam. */
  labels = createLabels(scene, built.info, { style: "ride" });

  /* From a standstill. The opening shot IS the launch — the scooter is parked
     on the court and accelerates off it — so the run cannot begin already
     rolling at START_SPEED_MPS the way it did when the intro was a static
     orbit. By the hand-over it is up to speed on its own. */
  ride = createRide({ route: doc.route, game: doc.game, startSpeed: 0 });
  /* Where the opening shot ends: across the court on the lead-in, plus enough
     pavement to be moving. Read from the route rather than pinned, so a route
     whose lead-in changes still hands over on the pavement and not before it. */
  introEndM = Math.min(doc.route.metres * 0.25, (doc.route.leadInM || 0) + INTRO_END_PAD_M);
  /* The launch holds for INTRO_LAUNCH_S before it moves, so the descent has to
     cover that too if the two are to land together. */
  introFallS = INTRO_LAUNCH_S + launchSeconds(introEndM);

  /* Free roam's controller, over this crop. Its own terrain bounds keep fly
     mode inside the corridor, which is exactly the right wall here. */
  explore = createExplore({
    campus: doc.campus,
    lidar: doc.lidar,
    heightAt,
    /* The same roof sampler free roam flies with, so Q/E over a building here
       behaves the way it does there — clearance measured against the roof, not
       against the ground 30 m under it. */
    solidAt: makeSolidSampler(built.roofs),
  });
  explore.speed = FLY_START_SPEED_MPS;
  const route = new THREE.Group();
  ribbon = createRibbon(route, doc.route, doc.game);
  scene.add(route);
  props = createProps(scene, doc.route, doc.game);
  scooter = createScooter();
  scene.add(scooter.group);

  rep.phase("chrome");
  await rep.paint();
  hud = bindHud(mode);
  hud?.setMode("intro");
  bindInput(canvas);
  addEventListener("resize", resize);
  resize();

  rep.phase("frame");
  /* Seat the camera before the first frame rather than letting it lerp in
     from the origin — a camera that flies in from 0,0,0 on load reads as a
     bug even when it settles correctly half a second later. */
  const start = ride.position();
  /* Through the same placement the frame loop uses, or the very first
     rendered frame shows the machine on the old datum for one frame. */
  placeScooter(0, ride.laneX);
  trackSun(start.x, scooter.group.position.y, start.z);

  /* Open high over the court with the ride NOT counting — `started` stays
     false until stepIntro hands over, so the clock reads 0.0 for the whole
     descent even though the scooter is moving by the end of it. Seat the
     camera at the shot's first frame rather than at the chase pose, or the
     intro begins with a jump cut from the deck up to 165 m. */
  camMode = "intro";
  introT = 0;
  stepIntro(0);
  renderer.render(scene, camera);
  await rep.paint();

  last = performance.now();
  frame(last);

  /* The scripting seam, same idea as campus-walk.js's __campusWalk: the
     verification harnesses drive the mode through this rather than through a
     second code path that could be right about things the site gets wrong. */
  window.__campusScooter = {
    get camera() { return camera; },
    get mode() { return camMode; },
    get hover() { return explore?.hover ?? null; },
    get flySpeed() { return explore?.speed ?? null; },
    get reveal() { return revealing ? revealT / REVEAL_S : 0; },
    scene, ride, labels,
    flyTo, toggleFly, toggleSky, endIntro,
  };

  return {
    masses: built.masses,
    drawCalls: built.drawCalls,
    ground: doc.arcgis.ground.filter(Boolean).length,
    trees: trees.count ?? 0,
    landmarks: doc.landmarks?.landmarks?.length ?? 0,
    layers: {
      terrain: terrain.mesh,
      buildings: built.group,
      ground: surfaces,
      trees: trees.group,
      details: details.group,
      ...(recreationGroup ? { recreation: recreationGroup } : {}),
      eighth: eighthZone,
      route,
      props: props.group,
      scooter: scooter.group,
      ...(labels ? { labels: labels.group } : {}),
      ...(landmarksGroup ? { landmarks: landmarksGroup } : {}),
      ...(skyline ? { skyline } : {}),
    },
    status() {
      const s = ride.status();
      const p = ride.position();
      return {
        view: "scooter run",
        x: p.x,
        z: p.z,
        hover: ride.y,
        ground: heightAt(p.x, p.z),
        /* The surface you can SEE, and the plane the machine is placed on.
           `ground` is the bilinear sample and is NOT what the terrain mesh
           draws; keeping both is what lets scripts/verify-ride.mjs assert the
           contact patch against the right one. */
        surface: surfaceAt(p.x, p.z),
        rideY: rideSurfaceAt(p.x, p.z),
        contact: scooter.group.position.y - ride.y,
        pitch: ridePitch,
        heading: (p.heading * 180) / Math.PI,
        near: null,
        ride: s,
        sky: skyName,
      };
    },
  };
}
