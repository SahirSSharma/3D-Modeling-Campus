// Campus Walk — the walk from Argo Hall, across Revelle Plaza, onto Ridge Walk.
//
// This is a look at the campus, not a game. There is no clock, nothing to dodge
// and no score; the only question it answers is "is this what it actually looks
// like walking there". Everything it draws is measured — see campus-world.js
// for which source is trusted for what, and why OSM is not trusted for height.
//
// Two viewpoints, because they check different things. Eye level at 1.65 m is
// the honest test: buildings are the right size or they are not, and you can
// tell instantly. The over-the-shoulder view is how the same world will be seen
// later, so it is worth knowing it holds up from there too.
import * as world from "./campus-world.js";
import { THREE } from "./campus-world.js";
import { buildGraph, routeThrough } from "./campus-route.js";

const CAMPUS_URL = new URL("../data/campus-3d.json", import.meta.url);
const LIDAR_URL = new URL("../data/campus-lidar.json", import.meta.url);

const EYE_HEIGHT = 1.65;      // a person's eyes, not a drone's
const WALK_SPEED = 1.45;      // m/s, an ordinary pace
const FAST_SPEED = 4.2;       // holding shift, for getting back to a spot
const CHASE_BACK = 6.5;
const CHASE_HEIGHT = 3.4;
const SPACING = 2;            // metres between resampled route points

const state = {
  s: 0,                // metres along the route
  auto: true,          // walking by itself
  view: "eye",         // eye | chase
  yaw: 0,              // free look, radians off the route heading
  pitch: -0.03,
  lastTime: 0,
};

let scene, camera, renderer, route, campus, lidar, heightAt, walker, landmarks = [];

/* --------------------------------------------------------------- geometry */

function sampleRoute(s) {
  const pts = route.points;
  const maxS = (pts.length - 1) * SPACING;
  const clamped = Math.max(0, Math.min(s, maxS));
  const i = Math.min(pts.length - 2, Math.floor(clamped / SPACING));
  const t = clamped / SPACING - i;
  const a = pts[i];
  const b = pts[i + 1];
  return {
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
    heading: Math.atan2(b.x - a.x, b.z - a.z),
  };
}

const routeLength = () => (route.points.length - 1) * SPACING;

/* ---------------------------------------------------------------- content */

/** Everything named within sight of the route, with where along it you pass. */
function findLandmarks() {
  const named = { ...campus.places };
  landmarks = [];
  for (const [name, place] of Object.entries(named)) {
    let bestS = -1;
    let bestD = Infinity;
    for (let i = 0; i < route.points.length; i += 2) {
      const p = route.points[i];
      const d = Math.hypot(p.x - place.x, p.z - place.z);
      if (d < bestD) { bestD = d; bestS = i * SPACING; }
    }
    if (bestD < 70) {
      landmarks.push({
        name, s: bestS, distance: Math.round(bestD),
        x: place.x, z: place.z,
        height: lidar.heights[name] ?? null,
      });
    }
  }
  landmarks.sort((a, b) => a.s - b.s);
}

/* ------------------------------------------------------------------ input */

function bindInput(canvas) {
  addEventListener("keydown", (e) => {
    if (e.key === "1") setView("eye");
    if (e.key === "2") setView("chase");
    if (e.key === " ") { state.auto = !state.auto; updateChrome(); e.preventDefault(); }
    if (e.key === "r" || e.key === "R") { state.s = 0; state.yaw = 0; }
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "s", "a", "d"].includes(e.key)) {
      e.preventDefault();
    }
  });

  const held = new Set();
  addEventListener("keydown", (e) => held.add(e.key.toLowerCase()));
  addEventListener("keyup", (e) => held.delete(e.key.toLowerCase()));
  state.held = held;

  /* Drag to look, exactly like Street View. Pointer events so a trackpad, a
     mouse and a finger all behave the same. */
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  canvas.addEventListener("pointerdown", (e) => {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    state.yaw -= (e.clientX - lastX) * 0.005;
    state.pitch = Math.max(-0.9, Math.min(0.7, state.pitch - (e.clientY - lastY) * 0.004));
    lastX = e.clientX; lastY = e.clientY;
  });
  const stop = (e) => {
    dragging = false;
    if (canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  };
  canvas.addEventListener("pointerup", stop);
  canvas.addEventListener("pointercancel", stop);
}

function setView(view) {
  state.view = view;
  walker.visible = view === "chase";
  updateChrome();
}

/* ------------------------------------------------------------------ update */

function update(dt) {
  const held = state.held;
  const fast = held.has("shift");
  const speed = (fast ? FAST_SPEED : WALK_SPEED) * dt;

  let moved = 0;
  if (held.has("w") || held.has("arrowup")) { moved += speed; state.auto = false; }
  if (held.has("s") || held.has("arrowdown")) { moved -= speed; state.auto = false; }
  if (held.has("a") || held.has("arrowleft")) state.yaw += dt * 1.1;
  if (held.has("d") || held.has("arrowright")) state.yaw -= dt * 1.1;
  if (state.auto) moved += speed;

  if (moved) {
    state.s = Math.max(0, Math.min(routeLength(), state.s + moved));
    if (state.s >= routeLength()) state.auto = false;
  }

  const pos = sampleRoute(state.s);
  const ground = heightAt(pos.x, pos.z);

  walker.position.set(pos.x, ground, pos.z);
  walker.rotation.y = pos.heading;
  /* A walk cycle, so the figure is not skating in the chase view. */
  const swing = Math.sin(state.s * 1.9) * 0.35;
  walker.userData.legs[0].rotation.x = swing;
  walker.userData.legs[1].rotation.x = -swing;

  const look = pos.heading + state.yaw;
  if (state.view === "eye") {
    camera.position.set(pos.x, ground + EYE_HEIGHT, pos.z);
  } else {
    const target = new THREE.Vector3(
      pos.x - Math.sin(look) * CHASE_BACK,
      ground + CHASE_HEIGHT,
      pos.z - Math.cos(look) * CHASE_BACK
    );
    target.y = Math.max(target.y, heightAt(target.x, target.z) + 1.6);
    camera.position.lerp(target, Math.min(1, dt * 6));
  }

  const aim = state.view === "eye" ? 14 : 18;
  camera.lookAt(
    camera.position.x + Math.sin(look) * aim,
    camera.position.y + Math.sin(state.pitch) * aim,
    camera.position.z + Math.cos(look) * aim
  );

  updateHud();
}

/* -------------------------------------------------------------------- HUD */

let lastCalled = null;
function updateHud() {
  /* routeLength(), not route.metres. The two differ — route.metres includes the
     walk from a building's centroid out to the nearest path at each end, which
     is real distance a person covers but is not part of the line being walked.
     Showing one against the other put "11 m of 371 m" beside a progress bar
     that was measuring against 346, so the numbers disagreed on screen. */
  const metres = Math.round(state.s);
  document.getElementById("walk-distance").textContent =
    `${metres} m of ${Math.round(routeLength())} m`;
  document.getElementById("walk-progress").style.width =
    `${Math.min(100, (state.s / routeLength()) * 100)}%`;

  /* What you are passing right now, and how tall it measured. Naming the
     height on screen is deliberate: it is the claim being made, so it should
     be checkable against the building in front of you. */
  let current = null;
  for (const l of landmarks) {
    if (state.s >= l.s - 26 && state.s <= l.s + 22) {
      if (!current || Math.abs(l.s - state.s) < Math.abs(current.s - state.s)) current = l;
    }
  }
  const el = document.getElementById("walk-here");
  if (current !== lastCalled) {
    lastCalled = current;
    if (current) {
      el.innerHTML = current.height
        ? `${current.name} <span class="walk-h">${current.height} m</span>`
        : current.name;
      el.classList.add("show");
    } else {
      el.classList.remove("show");
    }
  }
}

function updateChrome() {
  const view = document.getElementById("walk-view");
  if (view) view.textContent = state.view === "eye" ? "Eye level" : "Over the shoulder";
  const play = document.getElementById("walk-play");
  if (play) play.textContent = state.auto ? "Pause" : "Walk";
}

/* ------------------------------------------------------------------- boot */

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - state.lastTime) / 1000 || 0);
  state.lastTime = now;
  update(dt);
  renderer.render(scene, camera);
}

function resize() {
  const canvas = renderer.domElement;
  const w = canvas.clientWidth || 1;
  const h = canvas.clientHeight || 1;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

export async function boot() {
  [campus, lidar] = await Promise.all([
    fetch(CAMPUS_URL).then((r) => r.json()),
    fetch(LIDAR_URL).then((r) => r.json()),
  ]);

  const graph = buildGraph(campus);
  /* The destination is a real point on Ridge Walk rather than the name's
     centroid: "Ridge Walk" is twenty separate ways spanning 1.7 km, so its
     centroid is a spot in the middle of campus that means nothing. This picks
     the Ridge Walk vertex nearest to 300 m north of the plaza. */
  const plaza = campus.places["Revelle Plaza"];
  const ridge = campus.paths.filter((p) => p.n === "Ridge Walk").flatMap((p) => p.p);
  const target = { x: plaza.x, z: plaza.z - 300 };
  let end = null;
  let bestD = Infinity;
  for (const [x, z] of ridge) {
    const d = Math.hypot(x - target.x, z - target.z);
    if (d < bestD) { bestD = d; end = { x, z, name: "Ridge Walk" }; }
  }
  route = routeThrough(campus, graph, ["Argo Hall", "Revelle Plaza", end]);

  const canvas = document.getElementById("walk-canvas");
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));

  scene = world.createScene();
  camera = new THREE.PerspectiveCamera(68, 1, 0.4, 900);

  const terrain = world.createTerrain(scene, lidar);
  heightAt = terrain.heightAt;
  const built = world.createBuildings(scene, campus, lidar, heightAt);
  const surfaces = world.createSurfaces(scene, campus, heightAt);
  const paths = world.createPaths(scene, campus, heightAt);
  const trees = world.createTrees(scene, lidar, heightAt);

  walker = world.createWalker();
  scene.add(walker);
  walker.visible = false;

  findLandmarks();
  bindInput(canvas);
  resize();
  addEventListener("resize", resize);
  document.getElementById("walk-play")?.addEventListener("click", () => {
    state.auto = !state.auto; updateChrome();
  });
  document.getElementById("walk-toggle")?.addEventListener("click", () => {
    setView(state.view === "eye" ? "chase" : "eye");
  });
  updateChrome();

  state.lastTime = performance.now();
  frame(performance.now());

  /* The layers are handed back so a development harness can switch them off
     one at a time. That is not a nicety — nearly every rendering bug found so
     far was invisible until something was hidden. The plaza drawn on the wrong
     side of the origin, the walls wearing the roof's colour, canopies
     swallowing the camera: each of those is obvious the moment you can turn
     off the thing in front of it, and nearly impossible to spot otherwise. */
  return {
    metres: route.metres,
    buildings: built.total,
    measured: built.measured,
    trees: trees.count,
    landmarks: landmarks.length,
    scene,
    camera,
    renderer,
    layers: {
      terrain: terrain.mesh,
      buildings: built.group,
      surfaces,
      paths,
      trees: trees.group,
    },
    /* Live read-out for the harness: where you are, what you are passing, and
       what it measured. */
    status: () => {
      const pos = sampleRoute(state.s);
      const near = landmarks.reduce(
        (best, l) => (Math.abs(l.s - state.s) < Math.abs((best?.s ?? 1e9) - state.s) ? l : best),
        null
      );
      return {
        s: state.s,
        total: routeLength(),
        view: state.view,
        auto: state.auto,
        x: pos.x, z: pos.z,
        ground: heightAt(pos.x, pos.z),
        heading: ((pos.heading + state.yaw) * 180) / Math.PI,
        near,
      };
    },
  };
}
