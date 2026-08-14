// The scooter run: the Eighth College courts to Peterson Hall, as its own world.
//
// WHY THIS IS NOT campus-walk.js WITH A FLAG. Free roam boots ~10 MB and hands
// you the whole campus at 110 m. This boots one 1.5 MB crop
// (corridor-eighth-peterson.json) and puts you on a deck at eye level, on one
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
// that is the game, and a detached flythrough for looking at the map fast. The
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
import { createLabels, createLandmarks } from "./campus-landmarks.js";
import { createEighth } from "./campus-eighth.js";
import { createEighthFurniture } from "./campus-eighth-furniture.js";
import { OVERLAY, overlayLift, applyOverlayDepth } from "./campus-overlay.js";
import { nullReporter } from "./campus-boot.js";
import { createRide, positionAt, laneCentre } from "./scooter-ride.js";
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
  staging: { file: "corridor-argo-peterson.json", staging: true },
};

/* The chase camera. Far enough back that the next obstacle group is on screen
   with time to pick a lane at the ES2's 6.9 m/s, close enough that the scooter
   is a machine rather than a dot. */
const CHASE_BACK_M = 3.8;
const CHASE_UP_M = 1.75;
const CHASE_LOOK_AHEAD_M = 11;
/* Seconds for the camera to cover the distance to where it should be. A hard
   follow makes every lane change a jolt; too soft and the scooter swims. */
const CHASE_LAG_S = 0.16;

/* Lean into a lane change, up to this at full lateral speed. */
const MAX_BANK_RAD = 0.26;

const RIBBON_MARGIN_M = 0.55; // painted strip past the outer lanes

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

let renderer, scene, camera, heightAt, ride, doc, scooter;
let labels = null;
let hud = null;
const held = new Set();
let last = 0;
let sun = null;
let sunTarget = null;
const camPos = new THREE.Vector3();
const camAim = new THREE.Vector3();
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
function trackSun(x, y, z) {
  if (!sun || !sunTarget) return;
  sunTarget.position.set(x, y, z);
  sunTarget.updateMatrixWorld();
  const [dx, dy, dz] = SKY[skyName].sunOffset;
  sun.position.set(x + dx, y + dy, z + dz);
  sun.updateMatrixWorld();
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
function createRibbon(group, route, game) {
  const half = game.laneOffset * (game.lanes - 1) / 2 + game.laneOffset / 2 + RIBBON_MARGIN_M;
  const lift = overlayLift("carpet");
  const pts = route.points;

  const position = [];
  const push = (x, y, z) => position.push(x, y, z);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = positionAt(route, i * route.spacing, 0);
    const b = positionAt(route, (i + 1) * route.spacing, 0);
    const quad = [
      [a.x + a.normal.x * -half, a.z + a.normal.z * -half],
      [a.x + a.normal.x * half, a.z + a.normal.z * half],
      [b.x + b.normal.x * -half, b.z + b.normal.z * -half],
      [b.x + b.normal.x * half, b.z + b.normal.z * half],
    ].map(([x, z]) => [x, heightAt(x, z) + lift, z]);
    push(...quad[0]); push(...quad[2]); push(...quad[1]);
    push(...quad[1]); push(...quad[2]); push(...quad[3]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
  geo.computeVertexNormals();
  group.add(drape(new THREE.Mesh(geo, applyOverlayDepth(
    new THREE.MeshLambertMaterial({ color: 0x8d9391, side: THREE.DoubleSide }), "carpet"
  )), "carpet"));

  /* Two dashed lane dividers, drawn the way a real crosswalk is: on, off, on. */
  const paint = overlayLift("paint");
  const dash = [];
  const DASH_M = 1.6, GAP_M = 1.4, W = 0.07;
  for (const lane of [0.5, 1.5]) {
    const off = laneCentre(lane, game.laneOffset);
    for (let s = 0; s < route.metres - DASH_M; s += DASH_M + GAP_M) {
      const a = positionAt(route, s, off);
      const b = positionAt(route, s + DASH_M, off);
      const quad = [
        [a.x + a.normal.x * -W, a.z + a.normal.z * -W],
        [a.x + a.normal.x * W, a.z + a.normal.z * W],
        [b.x + b.normal.x * -W, b.z + b.normal.z * -W],
        [b.x + b.normal.x * W, b.z + b.normal.z * W],
      ].map(([x, z]) => [x, heightAt(x, z) + paint, z]);
      dash.push(...quad[0], ...quad[2], ...quad[1], ...quad[1], ...quad[2], ...quad[3]);
    }
  }
  const dashGeo = new THREE.BufferGeometry();
  dashGeo.setAttribute("position", new THREE.Float32BufferAttribute(dash, 3));
  dashGeo.computeVertexNormals();
  group.add(drape(new THREE.Mesh(dashGeo, applyOverlayDepth(
    new THREE.MeshLambertMaterial({ color: 0xf3f1e6, side: THREE.DoubleSide }), "paint"
  )), "paint"));

  /* A finish line at Peterson, because a route with no visible end is a route
     you do not know you are winning. */
  const fin = positionAt(route, route.metres - 2, 0);
  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(half * 2, 0.06, 0.5),
    applyOverlayDepth(new THREE.MeshLambertMaterial({ color: 0xf2f0e6 }), "logo")
  );
  bar.position.set(fin.x, heightAt(fin.x, fin.z) + 0.03, fin.z);
  bar.rotation.y = fin.heading;
  group.add(drape(bar, "logo"));
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
    const p = positionAt(route, o.s, laneCentre(o.lane, game.laneOffset));
    mesh.position.set(p.x, heightAt(p.x, p.z), p.z);
    mesh.rotation.y = p.heading + (o.spin || 0);
    group.add(mesh);
  }

  const coins = coinFactory();
  const coinMeshes = [];
  for (const c of ride.coinList) {
    const mesh = coins.make();
    const p = positionAt(route, c.s, laneCentre(c.lane, game.laneOffset));
    mesh.position.set(p.x, heightAt(p.x, p.z) + c.y, p.z);
    mesh.rotation.y = p.heading;
    group.add(mesh);
    coinMeshes.push({ mesh, coin: c });
  }

  scene.add(group);
  return { group, coinMeshes };
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
        node.fly.hidden = mode !== "flythrough";
        node.fly.textContent = `flythrough · ${Math.round(fly.s)} m · [ ] to scrub · F to ride`;
      }
    },
    update(now) {
      if (camMode === "flythrough") {
        node.fly.textContent = `flythrough · ${Math.round(fly.s)} m · [ ] to scrub · F to ride`;
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
    if (camMode === "flythrough" && (k === "[" || k === "]")) {
      flyTo(fly.s + (k === "]" ? 60 : -60));
    }
    /* Anything else skips the intro. Deliberately last, so the keys above keep
       their own meaning on the frame they also cut the orbit short. */
    if (camMode === "intro") endIntro();
  });
  addEventListener("keyup", (e) => releasing.add(e.key.toLowerCase()));
  addEventListener("blur", () => { held.clear(); releasing.clear(); });
  /* Tap the left or right half of the canvas to change lane, and the top
     third to hop, so this is playable on a phone without a keyboard. */
  canvas.addEventListener("pointerdown", (e) => {
    if (camMode === "intro") { endIntro(); return; } // a tap skips it too
    if (camMode === "flythrough") { drag.on = true; drag.x = e.clientX; drag.y = e.clientY; return; }
    if (e.clientY < canvas.clientHeight / 3) tap(" ");
    else tap(e.clientX < canvas.clientWidth / 2 ? "a" : "d");
  });

  /* Drag to look, in flythrough only — the chase camera aims itself. */
  canvas.addEventListener("pointermove", (e) => {
    if (!drag.on || camMode !== "flythrough") return;
    fly.yaw -= (e.clientX - drag.x) * 0.004;
    fly.pitch = Math.max(-1.4, Math.min(1.0, fly.pitch - (e.clientY - drag.y) * 0.003));
    drag.x = e.clientX;
    drag.y = e.clientY;
  });
  for (const ev of ["pointerup", "pointercancel", "pointerleave"]) {
    canvas.addEventListener(ev, () => { drag.on = false; });
  }
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

/* -------------------------------------------------------- the camera modes */

/* Three states, and only one of them is the game.
 *
 *   intro      the opening 360° around the scooter. The ride is frozen.
 *   chase      the run itself.
 *   flythrough map inspection. The ride is frozen — deliberately, so this can
 *              never be a way to move the scooter or the clock.
 *
 * Held here rather than as three booleans because they are mutually exclusive
 * and a pair of booleans is how you end up orbiting and flying at once. */
let camMode = "intro";

/* The opening shot. Seven seconds is long enough to read the court you are
   standing on and short enough that a second run does not resent it; the arc
   from 4.4 m down to 2.2 m ends near the chase camera's own height, so the
   hand-off is a settle rather than a cut. */
const INTRO_S = 7;
const INTRO_RADIUS_M = 9;
const INTRO_Y_FROM = 4.4;
const INTRO_Y_TO = 2.2;
let introT = 0;

/* Inspection speed. 45 m/s crosses the whole 1,060 m route in 24 s, which is
   the point — the ride takes nearly three minutes. */
const FLY_SPEED_MPS = 45;
/* Not SHIFT_MULT. campus-explore.js owns that name and
   tests/campus-gameplay.test.mjs asserts it is the only file that declares it;
   a second declaration here would fail that test for a good reason. */
const FLY_BOOST = 2.5;
const fly = { x: 0, y: 0, z: 0, yaw: 0, pitch: -0.1, s: 0 };

const easeInOut = (u) => (u < 0.5 ? 2 * u * u : 1 - ((-2 * u + 2) ** 2) / 2);

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
    pos: new THREE.Vector3(behind.x, heightAt(behind.x, behind.z) + CHASE_UP_M + ride.y * 0.4, behind.z),
    aim: new THREE.Vector3(ahead.x, heightAt(ahead.x, ahead.z) + 1.25, ahead.z),
  };
}

/**
 * The opening orbit.
 *
 * Circles the parked scooter once and hands over to the chase camera. The ride
 * is not running — `started` gates that — so the clock reads 0.0 throughout and
 * nobody loses time to the cinematography.
 */
function stepIntro(dt) {
  introT += dt;
  const u = Math.min(1, introT / INTRO_S);
  const p = ride.position();
  const gy = heightAt(p.x, p.z);

  /* Start behind the scooter and go all the way round, eased at both ends so
     it does not jerk into motion or stop dead on the hand-off. */
  const angle = p.heading + Math.PI + easeInOut(u) * Math.PI * 2;
  const y = INTRO_Y_FROM + (INTRO_Y_TO - INTRO_Y_FROM) * easeInOut(u);
  const orbit = new THREE.Vector3(
    p.x + Math.sin(angle) * INTRO_RADIUS_M,
    gy + y,
    p.z + Math.cos(angle) * INTRO_RADIUS_M
  );

  /* Over the last fifth, blend the orbit into the chase pose so the run opens
     already moving the way it will keep moving. */
  const hand = Math.max(0, (u - 0.8) / 0.2);
  const chase = chasePose(p);
  camPos.copy(orbit).lerp(chase.pos, easeInOut(hand));
  camAim.set(p.x, gy + 1.1, p.z).lerp(chase.aim, easeInOut(hand));
  camera.position.copy(camPos);
  camera.lookAt(camAim);
  trackSun(p.x, gy, p.z);
  /* Keep the panel honest during the orbit. It used to sit on whatever the
     static HTML said, which meant the intro announced the previous route's
     length for seven seconds before the first real frame corrected it. */
  hud?.update(performance.now());

  if (u >= 1) endIntro();
}

/** Skip or finish the intro: seat the chase camera and start the clock. */
function endIntro() {
  if (camMode !== "intro") return;
  camMode = "chase";
  const chase = chasePose(ride.position());
  camPos.copy(chase.pos);
  camAim.copy(chase.aim);
  started = true;
  hud?.setMode("chase");
}

/** Free camera for looking at the map. The ride is paused while it is up. */
function stepFly(dt) {
  const boost = held.has("shift") ? FLY_BOOST : 1;
  const v = FLY_SPEED_MPS * boost * dt;
  const fwd = { x: Math.sin(fly.yaw), z: Math.cos(fly.yaw) };
  const rgt = { x: Math.cos(fly.yaw), z: -Math.sin(fly.yaw) };
  if (held.has("w") || held.has("arrowup")) { fly.x += fwd.x * v; fly.z += fwd.z * v; }
  if (held.has("s") || held.has("arrowdown")) { fly.x -= fwd.x * v; fly.z -= fwd.z * v; }
  if (held.has("a") || held.has("arrowleft")) { fly.x -= rgt.x * v; fly.z -= rgt.z * v; }
  if (held.has("d") || held.has("arrowright")) { fly.x += rgt.x * v; fly.z += rgt.z * v; }
  if (held.has("e")) fly.y += v;
  if (held.has("q")) fly.y -= v;

  /* Never below the ground you are inspecting. */
  fly.y = Math.max(heightAt(fly.x, fly.z) + 1.5, fly.y);

  camera.position.set(fly.x, fly.y, fly.z);
  const flat = Math.cos(fly.pitch) * 14;
  camera.lookAt(
    fly.x + Math.sin(fly.yaw) * flat,
    fly.y + Math.sin(fly.pitch) * 14,
    fly.z + Math.cos(fly.yaw) * flat
  );
  trackSun(fly.x, heightAt(fly.x, fly.z), fly.z);
  hud?.update(performance.now());
}

/** Jump the free camera to a distance along the route. */
function flyTo(s) {
  fly.s = Math.max(0, Math.min(doc.route.metres, s));
  const p = positionAt(doc.route, fly.s, 0);
  fly.x = p.x - p.tangent.x * 14;
  fly.z = p.z - p.tangent.z * 14;
  fly.y = heightAt(fly.x, fly.z) + 8;
  fly.yaw = p.heading;
  fly.pitch = -0.18;
}

function toggleFly() {
  if (camMode === "intro") endIntro();
  if (camMode === "flythrough") {
    camMode = "chase";
    started = true;
    const chase = chasePose(ride.position());
    camPos.copy(chase.pos);
    camAim.copy(chase.aim);
  } else {
    camMode = "flythrough";
    started = false; // the run and its clock stop dead
    flyTo(ride.s);
  }
  hud?.setMode(camMode);
}

function step(dt, now) {
  const prevLaneX = ride.laneX;
  ride.update(dt, held);
  drainReleases();

  const p = ride.position();
  const gy = heightAt(p.x, p.z);
  scooter.group.position.set(p.x, gy + ride.y, p.z);
  scooter.group.rotation.y = p.heading;

  /* Wheels roll at the speed the ground is passing, and the machine leans by
     how fast it is actually moving sideways — both read from the ride rather
     than from the key that caused them, so they cannot disagree with it. */
  spin -= (ride.speed * dt) / 0.1;
  scooter.spin(spin);
  const lateral = dt > 0 ? (ride.laneX - prevLaneX) / dt : 0;
  bank += (Math.max(-1, Math.min(1, -lateral / 6)) * MAX_BANK_RAD - bank) * Math.min(1, dt * 12);
  scooter.bank(bank);

  trackSun(p.x, gy, p.z);

  /* Chase camera, damped. The aim point is ahead of the rider on the route,
     not on the rider, so the camera looks INTO the corner on a bend instead of
     at the back of a scooter that has already turned. */
  const behind = {
    x: p.x - p.tangent.x * CHASE_BACK_M,
    z: p.z - p.tangent.z * CHASE_BACK_M,
  };
  const targetY = heightAt(behind.x, behind.z) + CHASE_UP_M + ride.y * 0.4;
  const k = 1 - Math.exp(-dt / CHASE_LAG_S);
  camPos.lerp(new THREE.Vector3(behind.x, targetY, behind.z), k);
  camera.position.copy(camPos);

  const ahead = positionAt(doc.route, Math.min(doc.route.metres, ride.s + CHASE_LOOK_AHEAD_M), ride.laneX * 0.5);
  camAim.lerp(new THREE.Vector3(ahead.x, heightAt(ahead.x, ahead.z) + 1.25, ahead.z), k);
  camera.lookAt(camAim);

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
  else if (camMode === "flythrough") stepFly(dt);
  else if (started) step(dt, now);
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
  camera = new THREE.PerspectiveCamera(70, 1, 0.5, 1400);
  tuneAtmosphere();

  rep.phase("terrain");
  await rep.paint();
  const terrain = world.createTerrain(scene, doc.lidar, doc.colors, null);
  heightAt = terrain.heightAt;
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
  const details = createDetails(scene, doc.campus, heightAt);
  details.group?.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  /* Eighth College. NOT optional on the route that starts there: the ride
     begins dead centre on its basketball court and the intro orbits that spot
     for seven seconds, so without this the run opens on a blank grey slab.
     The staging corridor never reaches Eighth, and its crop carries no survey
     of it — `doc.eighth` is null and this builds nothing. */
  const eighthZone = new THREE.Group();
  for (const made of doc.eighth ? [
    createEighth(scene, { campus: doc.campus, arcgis: doc.arcgis, eighth: doc.eighth, markings: doc.markings, heightAt }),
    createEighthFurniture(scene, { arcgis: doc.arcgis, eighth: doc.eighth, heightAt }),
  ] : []) {
    /* Some builders hand back { group }, some the Object3D — the same
       both-shapes lesson campus-walk.js:531-538 records. */
    const obj = made?.group ?? (made?.isObject3D ? made : null);
    if (obj) eighthZone.add(obj);
  }
  scene.add(eighthZone);

  /* Measured painted markings, and the campus's own landmarks — the Sun God,
     the fountains, Snake Path. Both quiet no-ops when their file is missing. */
  createMarkings(scene, heightAt, doc.markings);
  let landmarksGroup = null;
  if (doc.landmarks) {
    landmarksGroup = createLandmarks(scene, doc.landmarks, {
      origin: doc.campus.origin,
      heightAt,
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

  ride = createRide({ route: doc.route, game: doc.game });
  const route = new THREE.Group();
  createRibbon(route, doc.route, doc.game);
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
  const sy = heightAt(start.x, start.z);
  scooter.group.position.set(start.x, sy, start.z);
  scooter.group.rotation.y = start.heading;
  trackSun(start.x, sy, start.z);

  /* Open on the orbit, parked in the middle of the basketball court, with the
     ride NOT running — `started` stays false until stepIntro hands over, so
     the clock reads 0.0 for the whole seven seconds. Seat the camera at the
     orbit's first frame rather than at the chase pose, or the intro begins
     with a jump cut from behind the scooter to beside it. */
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
        heading: (p.heading * 180) / Math.PI,
        near: null,
        ride: s,
        sky: skyName,
      };
    },
  };
}
