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
import { createBuildings } from "./campus-massing.js";
import { createLabels, createLandmarks } from "./campus-landmarks.js";
import {
  createExplore, scaleAtmosphere, EYE, sliderToSpeed, speedToSlider,
} from "./campus-explore.js";

const CAMPUS_URL = new URL("../data/campus-3d.json", import.meta.url);
const LIDAR_URL = new URL("../data/campus-lidar.json", import.meta.url);
const ARCGIS_URL = new URL("../data/campus-arcgis.json", import.meta.url);
const COLORS_URL = new URL("../data/campus-colors.json", import.meta.url);
const FACADES_URL = new URL("../data/campus-facades.json", import.meta.url);
const LANDMARKS_URL = new URL("../data/campus-landmarks.json", import.meta.url);

const EYE_HEIGHT = EYE;       // a person's eyes, not a drone's — until you climb
const WALK_SPEED = 1.45;      // m/s, an ordinary pace and the slider's default
const SHIFT_MULT = 2.9;       // holding shift, for getting back to a spot
const CHASE_BACK = 6.5;
const CHASE_HEIGHT = 3.4;
const SPACING = 2;            // metres between resampled route points

const state = {
  s: 0,                // metres along the route
  auto: true,          // walking by itself
  mode: "route",       // route — the guided walk | free — roam anywhere
  view: "eye",         // eye | chase
  yaw: 0,              // free look, radians off the route heading
  pitch: -0.03,
  speed: WALK_SPEED,   // m/s, from the velocity slider; both modes obey it
  lastTime: 0,
};

let scene, camera, renderer, route, campus, lidar, heightAt, walker, explore, landmarks = [];
let massInfo = new Map(); // building name -> { x, z, topY, h } from the massing
let labels = null;

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

/* A path's "place" is the centroid of every way sharing its name — for the
   1.7 km of Ridge Walk that is a meaningless spot mid-campus, and it sat
   close enough to the route's start that the first callout of the whole walk
   read "Ridge Walk" while you were standing at Argo's door. Buildings and
   plazas have honest centroids; paths do not. */
function isPathName(name) {
  return campus.paths.some((p) => p.n === name);
}

/** Everything named within sight of the route, with where along it you pass. */
function findLandmarks() {
  landmarks = [];
  for (const [name, place] of Object.entries(campus.places)) {
    if (isPathName(name)) continue;
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
        height: massInfo.get(name)?.h ?? lidar.heights[name] ?? null,
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
    if (e.key === "f" || e.key === "F") setMode(state.mode === "route" ? "free" : "route");
    if ((e.key === "l" || e.key === "L") && labels) labels.visible = !labels.visible;
    if (e.key === " ") {
      if (state.mode === "route") { state.auto = !state.auto; updateChrome(); }
      e.preventDefault();
    }
    if (e.key === "r" || e.key === "R") {
      if (state.mode === "free") setMode("route");
      state.s = 0; state.yaw = 0; state.auto = true; updateChrome();
    }
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown",
         "w", "s", "a", "d"].includes(e.key)) {
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
    const dYaw = (e.clientX - lastX) * 0.005;
    const dPitch = (e.clientY - lastY) * 0.004;
    /* The drag steers whichever pair of angles is live. In the guided walk the
       yaw is an offset from the route's own heading; roaming free it is the
       heading. */
    if (state.mode === "free") {
      explore.yaw -= dYaw;
      explore.pitch = Math.max(-1.35, Math.min(1.2, explore.pitch - dPitch));
    } else {
      state.yaw -= dYaw;
      state.pitch = Math.max(-0.9, Math.min(0.7, state.pitch - dPitch));
    }
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
  walker.visible = state.mode === "route" && view === "chase";
  updateChrome();
}

/** Nearest point on the route to a spot, as metres along it — how free roam
    hands you back to the guided walk wherever you wandered to. */
function nearestRouteS(x, z) {
  let bestS = 0;
  let bestD = Infinity;
  for (let i = 0; i < route.points.length; i++) {
    const p = route.points[i];
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bestD) { bestD = d; bestS = i * SPACING; }
  }
  return bestS;
}

function setMode(mode) {
  if (mode === state.mode) return;
  state.mode = mode;
  if (mode === "free") {
    /* Step off the route exactly where you are standing, looking where you
       were looking. */
    const pos = sampleRoute(state.s);
    explore.enterAt(pos.x, pos.z, pos.heading + state.yaw);
    explore.pitch = state.pitch;
    explore.hover = EYE;
    state.auto = false;
    walker.visible = false;
  } else {
    /* Rejoin the walk at the nearest point to wherever you roamed. */
    state.s = nearestRouteS(explore.x, explore.z);
    state.yaw = 0;
    state.pitch = -0.03;
    scaleAtmosphere(scene, camera, EYE);
    walker.visible = state.view === "chase";
  }
  lastCalled = undefined; // force the callout to re-evaluate in the new mode
  updateChrome();
}

/* ------------------------------------------------------------------ update */

function update(dt) {
  const held = state.held;

  if (state.mode === "free") {
    const pose = explore.update(dt, held);
    camera.position.set(pose.x, pose.y, pose.z);
    /* Spherical, not cylindrical: the horizontal reach shrinks by cos(pitch)
       as the view tips. Without it, "straight down" bottomed out at 45° —
       every overhead shot came back oblique no matter the pitch. */
    const flat = Math.cos(explore.pitch) * 14;
    camera.lookAt(
      pose.x + Math.sin(pose.yaw) * flat,
      pose.y + Math.sin(explore.pitch) * 14,
      pose.z + Math.cos(pose.yaw) * flat
    );
    scaleAtmosphere(scene, camera, explore.hover);
    updateHud();
    return;
  }

  const fast = held.has("shift");
  const speed = (fast ? state.speed * SHIFT_MULT : state.speed) * dt;

  /* W walks where you are LOOKING. On the rail that means: dragged around to
     face back down the route, W walks back down the route. Keying it to the
     route's own forward regardless of view made W read as S the moment
     anyone turned to look at a building behind them. Sideways looks keep
     the route's direction — there is no sideways on a rail. */
  const facing = Math.cos(state.yaw) < -0.25 ? -1 : 1;
  let moved = 0;
  if (held.has("w") || held.has("arrowup")) { moved += speed * facing; state.auto = false; }
  if (held.has("s") || held.has("arrowdown")) { moved -= speed * facing; state.auto = false; }
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
    /* Lerp smooths walking; it must not smooth TELEPORTING — engage chase
       after a jump and the camera would spend seconds flying across campus
       with the walker nowhere in frame. Far from target means snap. */
    if (camera.position.distanceTo(target) > 30) camera.position.copy(target);
    else camera.position.lerp(target, Math.min(1, dt * 6));
  }

  const aim = state.view === "eye" ? 14 : 18;
  const flat = Math.cos(state.pitch) * aim; // spherical — see the free-roam note
  camera.lookAt(
    camera.position.x + Math.sin(look) * flat,
    camera.position.y + Math.sin(state.pitch) * aim,
    camera.position.z + Math.cos(look) * flat
  );

  updateHud();
}

/* -------------------------------------------------------------------- HUD */

let lastCalled = null;
function updateHud() {
  const distanceEl = document.getElementById("walk-distance");
  const el = document.getElementById("walk-here");

  /* What you are passing right now, and how tall it measured. Naming the
     height on screen is deliberate: it is the claim being made, so it should
     be checkable against the building in front of you. */
  let current = null;

  if (state.mode === "free") {
    /* Altitude only — the velocity slider two cells over already reads the
       speed out, and the same number twice in one bar looks like a bug. */
    distanceEl.textContent = `${Math.round(explore.hover)} m up`;
    document.getElementById("walk-progress").style.width = "0";
    const near = explore.nearestPlace();
    if (near) {
      /* Massing knows the height of everything it drew — including the
         towers the 2014 LiDAR predates. */
      const h = massInfo.get(near.name)?.h ?? lidar.heights[near.name];
      current = { name: near.name, height: h ?? null, key: near.name };
    }
  } else {
    const metres = Math.round(state.s);
    distanceEl.textContent = `${metres} m of ${route.metres} m`;
    document.getElementById("walk-progress").style.width =
      `${Math.min(100, (state.s / routeLength()) * 100)}%`;

    /* Whatever is nearest RIGHT NOW, not whatever anchors nearest along the
       route. The old ±25 m window around each landmark's anchor point left
       the whole Urey–Mayer stretch silently unlabelled, and at Peterson's own
       doors it named the farther Social Sciences Research Building because
       the two anchors tied at the endpoint. Distance from where you stand is
       the thing a passer-by actually means by "what is this". */
    const pos = sampleRoute(state.s);
    let best = 60; // metres; farther than this is not "passing" anything
    for (const l of landmarks) {
      const d = Math.hypot(l.x - pos.x, l.z - pos.z);
      if (d < best) { best = d; current = l; }
    }
  }

  /* Compare by name, not object identity: free roam rebuilds its callout every
     frame, and flashing the same label in and out 60 times a second reads as a
     glitch even when every frame of it is correct. */
  const key = current ? current.name : null;
  const lastKey = lastCalled ? lastCalled.name : lastCalled;
  if (key !== lastKey) {
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
  const free = state.mode === "free";
  const view = document.getElementById("walk-view");
  if (view) view.textContent = state.view === "eye" ? "Eye level" : "Over the shoulder";
  const play = document.getElementById("walk-play");
  if (play) {
    play.textContent = state.auto ? "Pause" : "Walk";
    play.hidden = free; // nothing to pause when nothing walks itself
  }
  const toggle = document.getElementById("walk-toggle");
  if (toggle) toggle.hidden = free; // over-the-shoulder follows the route only
  const mode = document.getElementById("walk-mode");
  if (mode) mode.textContent = free ? "Back to the walk" : "Free roam";
  const track = document.querySelector(".walk-progress-track");
  if (track) track.style.visibility = free ? "hidden" : "visible";
  const hint = document.getElementById("walk-hint");
  if (hint) {
    /* Non-breaking spaces INSIDE each key–label pair, so a narrow bar wraps
       between shortcuts, never between "F" and what F does. */
    hint.textContent = free
      ? "drag to look · W/A/S/D move · Q/E height · shift faster · L labels · F back to the walk"
      : "drag to look · W/S to move · 1 eye level · 2 over the shoulder · L labels · F free roam · R restart";
  }
}

/* ------------------------------------------------------------------- boot */

/* Adaptive resolution: if a machine cannot hold a walkable frame rate at the
   current render scale, trade pixels for motion until it can. A campus you
   cannot move through is worthless at any sharpness. */
let perfAcc = 0;
let perfN = 0;
function adapt(dt) {
  perfAcc += dt;
  perfN++;
  if (perfAcc < 2.5) return;
  const fps = perfN / perfAcc;
  perfAcc = 0;
  perfN = 0;
  const ratio = renderer.getPixelRatio();
  if (fps < 24 && ratio > 0.7) {
    renderer.setPixelRatio(Math.max(0.7, ratio - 0.25));
    resize();
  } else if (fps > 50 && ratio < Math.min(1.5, devicePixelRatio)) {
    renderer.setPixelRatio(Math.min(Math.min(1.5, devicePixelRatio), ratio + 0.25));
    resize();
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - state.lastTime) / 1000 || 0);
  state.lastTime = now;
  update(dt);
  labels?.update(camera);
  adapt(dt);
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
  const optional = (url) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  let arcgis, colors, facades, landmarkData;
  [campus, lidar, arcgis, colors, facades, landmarkData] = await Promise.all([
    fetch(CAMPUS_URL).then((r) => r.json()),
    fetch(LIDAR_URL).then((r) => r.json()),
    /* Everything below is an upgrade, not a dependency — the walk still
       stands on OSM + LiDAR alone if any of these files are missing. */
    optional(ARCGIS_URL),
    optional(COLORS_URL),
    optional(FACADES_URL),
    optional(LANDMARKS_URL),
  ]);

  const graph = buildGraph(campus);
  /* Dorm to lecture hall, the real errand: out of Argo, across Revelle Plaza,
     the length of Ridge Walk north, and up to Peterson Hall's doors. The
     plaza stays a named waypoint because a bare A* takes the shortest way OUT
     of Revelle, and the shortest way out is not the way through the middle of
     the plaza that everyone actually takes. */
  route = routeThrough(campus, graph, ["Argo Hall", "Revelle Plaza", "Peterson Hall"]);

  /* End at the doors, not in the lobby. The route runs to the graph node
     nearest each building's CENTROID, and OSM maps walkways right through
     both Argo's breezeway and Peterson's footprint — so the raw polyline's
     last few metres are inside the building, and the walk ended with the
     camera staring at the inside of a grey box. Trim every leading point
     inside the origin and every trailing point inside the destination. */
  const footprint = (name) => campus.buildings.find((b) => b.n === name)?.p;
  const inRing = (pt, ring) => {
    let ins = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, zi] = ring[i];
      const [xj, zj] = ring[j];
      if (zi > pt.z !== zj > pt.z && pt.x < ((xj - xi) * (pt.z - zi)) / (zj - zi) + xi) ins = !ins;
    }
    return ins;
  };
  const startRing = footprint("Argo Hall");
  const endRing = footprint("Peterson Hall");
  let first = 0;
  let last = route.points.length - 1;
  if (startRing) while (first < last && inRing(route.points[first], startRing)) first++;
  if (endRing) while (last > first && inRing(route.points[last], endRing)) last--;
  route.points = route.points.slice(first, last + 1);
  /* The total the HUD quotes must be the walk the camera can actually take —
     after trimming, "730 m of 795 m" at the very end read as a walk that
     never finishes. (740 m also sits closer to the 733 m the FOSSGIS
     pedestrian router reports door-to-door for this pair.) */
  route.metres = Math.round((route.points.length - 1) * SPACING);

  const canvas = document.getElementById("walk-canvas");
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(1.5, devicePixelRatio)); // full-viewport 2x on a 5K display is pure fill-rate pain

  scene = world.createScene();
  camera = new THREE.PerspectiveCamera(68, 1, 0.4, 900);

  const terrain = world.createTerrain(scene, lidar, colors);
  heightAt = terrain.heightAt;
  const built = createBuildings(scene, { campus, lidar, arcgis, colors, facades: facades?.walls, heightAt });
  massInfo = built.info;
  const surfaces = world.createSurfaces(scene, campus, heightAt, arcgis, colors);
  /* With the surveyed ground plane, the sidewalk POLYGONS are the paths;
     ribbons guessed from OSM centrelines would just z-fight them. They still
     draw when the GIS file is absent. */
  if (!arcgis?.ground?.length) world.createPaths(scene, campus, heightAt);
  const trees = world.createTrees(scene, lidar, heightAt);

  labels = createLabels(scene, massInfo);
  let landmarksGroup = null;
  if (landmarkData) {
    landmarksGroup = createLandmarks(scene, landmarkData, {
      origin: campus.origin,
      heightAt,
      /* "Jacobs Hall" must resolve to the tallest mass of the complex — the
         7-storey tower Fallen Star actually sits on — not the low wings. */
      roofTopOf: (name) => {
        let best = null;
        for (const [n, entry] of massInfo) {
          if (n.startsWith(name) && (!best || entry.topY > best.topY)) best = entry;
        }
        return best;
      },
    });
  }

  walker = world.createWalker();
  scene.add(walker);
  walker.visible = false;

  /* Free roam and teleport see buildings and plazas only — path centroids
     are not places (see isPathName). */
  const placeable = Object.fromEntries(
    Object.entries(campus.places).filter(([n]) => !isPathName(n))
  );
  explore = createExplore({ campus: { ...campus, places: placeable }, lidar, heightAt });
  explore.speed = state.speed;

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
  document.getElementById("walk-mode")?.addEventListener("click", () => {
    setMode(state.mode === "route" ? "free" : "route");
  });

  /* The velocity slider drives both modes: the guided walk paces itself by it
     and free roam moves at it. Logarithmic, so the walking range is not three
     pixels wide — see campus-explore.js. */
  const slider = document.getElementById("walk-speed");
  const speedVal = document.getElementById("walk-speed-val");
  const showSpeed = () => {
    if (speedVal) {
      speedVal.textContent =
        state.speed >= 10 ? `${Math.round(state.speed)} m/s` : `${state.speed.toFixed(1)} m/s`;
    }
  };
  if (slider) {
    slider.value = String(Math.round(speedToSlider(state.speed) * 1000));
    slider.addEventListener("input", () => {
      state.speed = sliderToSpeed(Number(slider.value) / 1000);
      explore.speed = state.speed;
      showSpeed();
    });
  }
  showSpeed();

  /* Teleport: pick any named place and stand in front of it. Arriving is
     always in free roam — the list is most of the campus and the route only
     passes a fraction of it. */
  const tp = document.getElementById("walk-teleport");
  if (tp) {
    for (const name of Object.keys(placeable).sort()) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      tp.append(opt);
    }
    tp.addEventListener("change", () => {
      if (!tp.value) return;
      if (state.mode !== "free") setMode("free");
      explore.teleport(tp.value);
      tp.value = "";
      tp.blur(); // arrow keys must go back to moving, not to the list
    });
  }
  updateChrome();

  /* The manipulation seam. Everything the buttons and keys can do, callable:
     scripts/campus-walk-shots.mjs steers the camera through this to
     photograph the world from exact spots for the realism checks, and it is
     equally usable from the console. Same machinery, no second code path. */
  window.__campusWalk = {
    state, explore, setMode, setView,
    get walker() { return walker; },
    get camera() { return camera; },
    routeLength,
    /* Stand at s metres along the walk, looking yaw off the route heading. */
    go(s, yaw = 0, pitch = -0.03) {
      if (state.mode !== "route") setMode("route");
      state.auto = false;
      state.s = Math.max(0, Math.min(routeLength(), s));
      state.yaw = yaw;
      state.pitch = pitch;
    },
    /* Hover anywhere: x/z in campus metres, eyes `hover` m above the ground. */
    fly(x, z, hover = EYE, yaw = 0, pitch = -0.05) {
      if (state.mode !== "free") setMode("free");
      explore.enterAt(x, z, yaw);
      explore.hover = hover;
      explore.pitch = pitch;
    },
    /* Where along the route a named place is nearest — the screenshot
       harness anchors its beats to places, not to odometer guesses that
       drift every time the route changes. */
    sNear(name) {
      const p = campus.places[name];
      if (!p) return 0;
      let bestS = 0;
      let bestD = Infinity;
      for (let i = 0; i < route.points.length; i++) {
        const d = Math.hypot(route.points[i].x - p.x, route.points[i].z - p.z);
        if (d < bestD) { bestD = d; bestS = i * SPACING; }
      }
      return bestS;
    },
    /* Turn, on the spot, to look straight at a named place. */
    face(name) {
      const p = campus.places[name];
      if (!p) return;
      const pos = sampleRoute(state.s);
      state.yaw = Math.atan2(p.x - pos.x, p.z - pos.z) - pos.heading;
    },
    places: () => campus.places,
  };

  state.lastTime = performance.now();
  frame(performance.now());

  return {
    metres: route.metres,
    masses: built.masses,
    drawCalls: built.drawCalls,
    ground: arcgis?.ground?.length || 0,
    trees: trees.count,
    landmarks: landmarks.length,
    /* The dev panel's whole toolkit: switch a layer off to see what stood
       behind it — nearly every rendering fault found so far was invisible
       until the thing in front of it could be. */
    layers: {
      terrain: terrain.mesh,
      buildings: built.group,
      ground: surfaces,
      trees: trees.group,
      labels: labels.group,
      ...(landmarksGroup ? { landmarks: landmarksGroup } : {}),
    },
    status() {
      const pos = state.mode === "free"
        ? { x: explore.x, z: explore.z, heading: explore.yaw }
        : (() => { const p = sampleRoute(state.s); return { ...p, heading: p.heading + state.yaw }; })();
      return {
        s: state.s,
        total: routeLength(),
        view: state.mode === "free" ? "free roam" : state.view,
        x: pos.x,
        z: pos.z,
        ground: heightAt(pos.x, pos.z),
        heading: (pos.heading * 180) / Math.PI,
        near: lastCalled ? { name: lastCalled.name, height: lastCalled.height ?? null } : null,
      };
    },
  };
}
