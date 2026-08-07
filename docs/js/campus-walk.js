// Campus Walk — the whole campus, roamed free.
//
// This is a look at the campus, not a game. There is no clock, nothing to dodge
// and no score; the only question it answers is "is this what it actually looks
// like there". Everything it draws is measured — see campus-world.js for which
// source is trusted for what, and why OSM is not trusted for height.
//
// There used to be a second mode: a guided walk on a rail from Argo Hall across
// Revelle Plaza to Peterson Hall, with a walking figure, a progress bar and an
// over-the-shoulder camera. It was the original product, and the campus outgrew
// it — 3 km of measured ground reachable in any direction made a 740 m rail the
// least interesting thing on offer, and every control it needed (pause, restart,
// view toggle, its gold line across the minimap) was chrome explaining a
// feature nobody chose. Free roam is now the only mode. campus-route.js still
// holds the A* over the footpath graph; scripts/audit-accuracy.mjs uses it to
// check our footpaths against a real pedestrian router, which is what it was
// always best at.
//
// You spawn hanging 110 m over Argo Hall — high enough that the whole campus
// and its surveyed boundary read at a glance — and go wherever you like. A
// click on the minimap teleports you to that exact spot on the ground below it.
import * as world from "./campus-world.js";
import { THREE } from "./campus-world.js";
import { createBuildings } from "./campus-massing.js";
import { createMarkings } from "./campus-markings.js";
import { createLabels, createLandmarks } from "./campus-landmarks.js";
import { createDetails } from "./campus-details.js";
import { createAthletics } from "./campus-athletics.js";
import { createRecreation } from "./campus-recreation.js";
import { createEighth } from "./campus-eighth.js";
import { createEighthFurniture } from "./campus-eighth-furniture.js";
import { createRegionMassing } from "./campus-region-massing.js";
import { createMuirField } from "./campus-muir-field.js";
import { createRimac } from "./campus-rimac.js";
import { createMinimap } from "./campus-minimap.js";
import { makeSolidSampler } from "./campus-clearance.js";
import { nullReporter } from "./campus-boot.js";
import { surveyFacts, geometryFacts, sourceLines } from "./campus-facts.js";
import {
  createExplore, scaleAtmosphere, stepSpeed, EYE, sliderToSpeed, speedToSlider,
  MAX_SPEED_MPS,
} from "./campus-explore.js";

/* Everything the runtime downloads, in one list, because the loading screen
   quotes the byte count and a file fetched from somewhere else is a file the
   count is wrong about. `required` files take the walk down when they fail;
   the rest are upgrades — the campus still stands on OSM + LiDAR alone. */
const DATA = [
  { key: "campus", file: "campus-3d.json", required: true, what: "footprints and footpaths" },
  { key: "lidar", file: "campus-lidar.json", required: true, what: "terrain and heights" },
  { key: "arcgis", file: "campus-arcgis.json", required: false, what: "surveyed ground" },
  { key: "colors", file: "campus-colors.json", required: false, what: "aerial colour" },
  { key: "facades", file: "campus-facades.json", required: false, what: "facade tones" },
  { key: "landmarks", file: "campus-landmarks.json", required: false, what: "landmarks" },
  { key: "boundary", file: "campus-boundary.json", required: false, what: "campus boundary" },
  { key: "markings", file: "campus-markings.json", required: false, what: "sports markings" },
  { key: "eighth", file: "campus-eighth.json", required: false, what: "Eighth College survey" },
  { key: "region", file: "region.json", required: false, what: "region outline" },
  { key: "regionTerrain", file: "region-terrain.json", required: false, what: "regional terrain" },
  /* The regional heights are 1.5 million samples. As JSON that is ~30 MB of
     text to parse on the main thread; as Int16 it is a 2.8 MB buffer the
     renderer can read straight through. Everything else here stays JSON
     because everything else here is small enough for that to be free. */
  { key: "regionHeights", file: "region-terrain.bin", required: false, binary: true,
    what: "regional heights" },
  /* The region's buildings, roads and water. Optional like everything else out
     there: absent, the regional terrain still renders and the campus is
     untouched — it just stands in an unbuilt landscape, which is exactly what
     it did before this file existed. */
  { key: "regionOsm", file: "region-osm.json", required: false, what: "regional buildings and roads" },
  /* Measured regional roofs, as a SIDECAR keyed by index into region-osm.json.
     Separate for the same reason campus-lidar.json is separate from
     campus-3d.json: a fresh Overpass pull regenerates the footprints, and
     folding measurements into that file would erase them — or, worse, keep
     them attached to the wrong buildings. The join is checked before use. */
  { key: "regionRoofs", file: "region-heights.json", required: false, what: "measured regional roofs" },
];
const urlOf = (file) => new URL(`../data/${file}`, import.meta.url);

/* Exported so the tests can pin them: the spawn hangs exactly this far above
   the ground at Argo Hall and travels at exactly this speed. The speed cap
   itself lives in campus-explore.js, next to the code that enforces it.

   You spawn at a survey speed, not a walking one: the spawn is 110 m up over a
   3 km campus, and at 1.45 m/s the first minute of the product is spent
   drifting. 500 m/s crosses it in six seconds; the arrow keys wind it back down
   to a pace you can look at things from. */
export const SPAWN_ALTITUDE_M = 110;
export const SPAWN_SPEED_MPS = 500;
export { MAX_SPEED_MPS };

const state = {
  speed: SPAWN_SPEED_MPS, // m/s, from the slider or the arrow keys
  lastTime: 0,
  held: new Set(),
};

let scene, camera, renderer, campus, lidar, heightAt, explore;
let massInfo = new Map(); // building name -> { x, z, topY, h, ring } from the massing
let labels = null;
let minimap = { update() {} };
/* Set by boot: pushes state.speed back out to the slider and its readout, so
   the arrow keys and the slider are two handles on one number rather than two
   numbers that disagree. No-op before the bar exists. */
let showSpeed = () => {};

/* ---------------------------------------------------------------- content */

/* A path's "place" is the centroid of every way sharing its name — for the
   1.7 km of Ridge Walk that is a meaningless spot mid-campus. Buildings and
   plazas have honest centroids; paths do not, so they are not destinations. */
function isPathName(name) {
  return campus.paths.some((p) => p.n === name);
}

/* ------------------------------------------------------------------ input */

function bindInput(canvas) {
  addEventListener("keydown", (e) => {
    if ((e.key === "l" || e.key === "L") && labels) labels.visible = !labels.visible;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown",
         "w", "s", "a", "d"].includes(e.key)) {
      e.preventDefault();
    }
  });

  const held = state.held;
  addEventListener("keydown", (e) => held.add(e.key.toLowerCase()));
  addEventListener("keyup", (e) => held.delete(e.key.toLowerCase()));
  /* A tab-away leaves a key "held" forever — you come back still climbing. */
  addEventListener("blur", () => held.clear());

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
    explore.yaw -= (e.clientX - lastX) * 0.005;
    explore.pitch = Math.max(-1.35, Math.min(1.2, explore.pitch - (e.clientY - lastY) * 0.004));
    lastX = e.clientX; lastY = e.clientY;
  });
  const stop = (e) => {
    dragging = false;
    if (canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  };
  canvas.addEventListener("pointerup", stop);
  canvas.addEventListener("pointercancel", stop);
}

/* ------------------------------------------------------------------ update */

function update(dt) {
  const held = state.held;

  /* The arrow keys are the throttle: up/down coarse, left/right fine. They
     used to move and turn, which W/S and the drag already did — and left the
     velocity, the one control that changes constantly at these speeds,
     reachable only by aiming a mouse at a 110-pixel slider. */
  const steered = stepSpeed(state.speed, dt, held);
  if (steered !== state.speed) {
    state.speed = steered;
    explore.speed = steered;
    showSpeed();
  }

  const pose = explore.update(dt, held);
  camera.position.set(pose.x, pose.y, pose.z);
  /* Spherical, not cylindrical: the horizontal reach shrinks by cos(pitch) as
     the view tips. Without it, "straight down" bottomed out at 45° — every
     overhead shot came back oblique no matter the pitch. */
  const flat = Math.cos(explore.pitch) * 14;
  camera.lookAt(
    pose.x + Math.sin(pose.yaw) * flat,
    pose.y + Math.sin(explore.pitch) * 14,
    pose.z + Math.cos(pose.yaw) * flat
  );
  scaleAtmosphere(scene, camera, explore.hover);
  updateHud();
}

/* -------------------------------------------------------------------- HUD */

let lastCalled = null;
function updateHud() {
  const distanceEl = document.getElementById("walk-distance");
  /* Altitude only — the velocity slider two cells over already reads the speed
     out, and the same number twice in one bar looks like a bug. */
  if (distanceEl) distanceEl.textContent = `${Math.round(explore.hover)} m up`;

  /* What you are passing right now, and how tall it measured. Naming the height
     on screen is deliberate: it is the claim being made, so it should be
     checkable against the building in front of you. */
  const near = explore.nearestPlace();
  let current = null;
  if (near) {
    /* Massing knows the height of everything it drew — including the towers
       the 2014 LiDAR predates. */
    const h = massInfo.get(near.name)?.h ?? lidar.heights[near.name];
    current = { name: near.name, height: h ?? null };
  }

  /* Compare by name, not object identity: the callout is rebuilt every frame,
     and flashing the same label in and out 60 times a second reads as a glitch
     even when every frame of it is correct. */
  const key = current ? current.name : null;
  const lastKey = lastCalled ? lastCalled.name : lastCalled;
  if (key === lastKey) return;
  lastCalled = current;
  const el = document.getElementById("walk-here");
  if (!el) return;
  if (current) {
    el.innerHTML = current.height
      ? `${current.name} <span class="walk-h">${current.height} m</span>`
      : current.name;
    el.classList.add("show");
  } else {
    el.classList.remove("show");
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
  minimap.update(explore.x, explore.z, explore.yaw);
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

/**
 * Download every survey file, reporting real bytes as they arrive.
 *
 * The old boot handed Promise.all a list of fetch().json() calls, which is one
 * opaque wait: the loading screen could say "building the campus" and nothing
 * else, for however long 10 MB takes. Reading the bodies as streams costs a
 * few lines and buys a percentage that is the actual download.
 */
async function download(rep) {
  const responses = await Promise.all(DATA.map((d) => fetch(urlOf(d.file)).catch(() => null)));
  const bytes = DATA.map(() => 0);
  const advertised = responses.map((r) => {
    const len = Number(r?.headers?.get?.("content-length"));
    return Number.isFinite(len) && len > 0 ? len : 0;
  });

  /* The denominator is the sum of the advertised lengths, revised UPWARD if a
     body turns out longer than its header claimed — which it does the moment a
     host serves the JSON gzipped, because Content-Length is then the compressed
     size while the stream we read is not. Growing the total can only slow the
     bar, never send it backwards, and it still lands on exactly 100%: by the
     last chunk the total is the bytes read. */
  const announce = () => {
    let loaded = 0;
    let total = 0;
    for (let i = 0; i < DATA.length; i++) {
      loaded += bytes[i];
      total += Math.max(advertised[i], bytes[i]);
    }
    rep.tick("data", total ? loaded / total : 0);
    /* Show the denominator, not just the running total. "4.1 MB" answers
       nothing on its own — the question anyone watching a loading bar is
       actually asking is how much is left, and the campus is 10.5 MB of survey
       data. The total lives in the unit slot so the number itself keeps its
       odometer animation.

       The label is "Survey data" rather than "Survey data read": the longer
       unit needs the width, and with both the label ellipsised to
       "Survey data re…" in the fact grid. */
    rep.fact({
      key: "bytes",
      label: "Survey data",
      value: Math.round(loaded / 1e5) / 10,
      unit: total ? `of ${(Math.round(total / 1e5) / 10).toFixed(1)} MB` : "MB",
    });
  };

  const read = async (r, i) => {
    if (!r?.ok) return null;
    /* No streams (an old Safari, or a test double): take it in one lump. The
       bar simply steps once per file instead of gliding. */
    if (!r.body?.getReader) {
      if (DATA[i].binary) {
        const buf = new Uint8Array(await r.arrayBuffer());
        bytes[i] = buf.length;
        announce();
        return buf;
      }
      const text = await r.text();
      bytes[i] = text.length;
      announce();
      return JSON.parse(text);
    }
    const reader = r.body.getReader();
    const chunks = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.length;
      bytes[i] += value.length;
      announce();
    }
    const buf = new Uint8Array(size);
    let at = 0;
    for (const c of chunks) { buf.set(c, at); at += c.length; }
    if (DATA[i].binary) return buf;
    return JSON.parse(new TextDecoder().decode(buf));
  };

  const parsed = await Promise.all(responses.map((r, i) => read(r, i).catch(() => null)));
  const out = {};
  for (let i = 0; i < DATA.length; i++) {
    const d = DATA[i];
    if (!parsed[i] && d.required) throw new Error(`the campus ${d.what} could not be downloaded`);
    out[d.key] = parsed[i];
    /* Each file's own size, so the log reads as a manifest of what the campus
       actually costs rather than a list of names. campus-lidar.json is 4 MB of
       terrain and heights and campus-3d.json is another 0.9 MB of footprints —
       that is the honest shape of the download, and it is the line that
       explains the wait. `bytes[i]` is what was read off the stream, so a
       gzipped host reports the real decompressed size rather than the
       compressed header. */
    const mb = bytes[i] ? `${(bytes[i] / 1e6).toFixed(bytes[i] < 1e6 ? 2 : 1)} MB` : null;
    rep.log(parsed[i]
      ? `${d.file} — ${d.what}${mb ? ` · ${mb}` : ""}`
      : `${d.file} — absent, going without`);
  }
  rep.tick("data", 1);
  return out;
}

export async function boot({ report } = {}) {
  const rep = report || nullReporter();

  /* ---------------------------------------------------------------- data */
  rep.phase("data");
  await rep.paint();
  const data = await download(rep);
  campus = data.campus;
  lidar = data.lidar;
  const { arcgis, colors, facades, markings } = data;
  const eighthData = data.eighth;
  const landmarkData = data.landmarks;
  /* A boundary of two points is not a boundary; the minimap and the ground
     ribbon both expect a closed ring or nothing at all. */
  const boundary = Array.isArray(data.boundary?.points) && data.boundary.points.length >= 3
    ? data.boundary
    : null;
  /* campus-world.js reads the same file for the ground ribbon. Hand it over
     rather than letting it fetch a second copy. */
  world.primeOverlay(boundary);

  for (const line of sourceLines(data)) rep.log(line);
  rep.facts(surveyFacts({ ...data, landmarks: landmarkData, boundary }));
  if (boundary) rep.outline(boundary.points.map(([x, z]) => ({ x, z })));
  await rep.paint();

  /* ------------------------------------------------------------------ gl */
  rep.phase("gl");
  await rep.paint();
  const canvas = document.getElementById("walk-canvas");
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(1.5, devicePixelRatio)); // full-viewport 2x on a 5K display is pure fill-rate pain
  scene = world.createScene();
  camera = new THREE.PerspectiveCamera(68, 1, 0.4, 900);
  rep.log(`WebGL ready · ${renderer.getPixelRatio().toFixed(2)}× pixel ratio`);

  /* ------------------------------------------------------------- terrain */
  rep.phase("terrain");
  await rep.paint();
  /* The region is all-or-nothing: a header without its heights, or heights
     without the outline, is not a partial region — it is a broken one, and
     drawing half of it would put a plane of sea over a campus with no coast
     to justify it. Any missing piece and the world falls back to exactly what
     it was before the expansion. */
  const regionData =
    data.region && data.regionTerrain && data.regionHeights
      ? { outline: data.region, header: data.regionTerrain, heights: data.regionHeights }
      : null;
  if (!regionData && (data.region || data.regionTerrain || data.regionHeights)) {
    rep.log("region — incomplete, going without");
  }
  const terrain = world.createTerrain(scene, lidar, colors, regionData);
  heightAt = terrain.heightAt;
  rep.facts(geometryFacts({ terrain: terrain.mesh }));
  if (terrain.region) {
    rep.log(
      `region — ${terrain.region.chunks} chunks, ` +
        `${terrain.region.quads.toLocaleString()} quads of land, sea at ${
          terrain.region.seaY.toFixed(1)} m`
    );
  }
  await rep.paint();

  /* ------------------------------------------------------------- massing */
  rep.phase("massing");
  await rep.paint();
  const built = createBuildings(scene, { campus, lidar, arcgis, colors, facades, heightAt });

  /* The REGION's buildings, roads and water — everything outside the campus
     box, which the campus's own sources say nothing about. Its own layer, like
     Eighth's: it is 5,551 footprints on inherited (never measured) colour,
     and being able to drop the whole lot is how you see what the regional
     terrain underneath actually looks like. Only built when the regional
     terrain is up — massing a town onto a world with no land under it would
     hang 10,000 buildings on the campus sampler's edge clamp. */
  const regionZone = new THREE.Group();
  if (regionData) {
    const regionBuilt = createRegionMassing(scene, {
      regionOsm: data.regionOsm, regionHeights: data.regionRoofs,
      heightAt, campusTerrain: lidar.terrain,
    });
    if (regionBuilt.counts.buildings || regionBuilt.counts.roads || regionBuilt.counts.water) {
      regionZone.add(regionBuilt.group);
      const c = regionBuilt.counts;
      rep.log(
        `region built — ${c.buildings.toLocaleString()} buildings, ` +
          `${c.roads.toLocaleString()} road runs, ${c.water} water bodies · ` +
          `${c.lidarRoofs.toLocaleString()} roofs measured · ` +
          `${c.triangles.toLocaleString()} triangles in ${c.drawCalls} draw calls`
      );
    }
  }
  scene.add(regionZone);
  massInfo = built.info;
  /* Which roof, if any, is under the camera. Free roam's climb rate is scaled
     by the clearance to it, so hovering over Geisel is as finely controllable
     as hovering over the lawn beside it.
     Fed from built.roofs — EVERY mass — not from built.info, which is keyed by
     name and so knows about barely a third of them. */
  const solidAt = makeSolidSampler(built.roofs);
  rep.facts([
    { key: "masses", label: "Masses raised", value: built.masses, unit: "" },
    { key: "drawcalls", label: "Draw calls", value: built.drawCalls, unit: "" },
    ...geometryFacts({ buildings: built.group }),
  ]);
  await rep.paint();

  /* -------------------------------------------------------------- ground */
  rep.phase("ground");
  await rep.paint();
  const surfaces = world.createSurfaces(scene, campus, heightAt, arcgis, colors);
  /* The painted lines of every sports surface — measured from imagery, drawn as
     geometry. Quiet no-op when the data file is absent. */
  createMarkings(scene, heightAt, markings);
  /* With the surveyed ground plane, the sidewalk POLYGONS are the paths;
     ribbons guessed from OSM centrelines would just z-fight them. They still
     draw when the GIS file is absent. */
  if (!arcgis?.ground?.length) world.createPaths(scene, campus, heightAt);
  await rep.paint();

  /* --------------------------------------------------------------- trees */
  rep.phase("trees");
  await rep.paint();
  /* Crown sizing needs the sports-pad facilities to compute clearance —
     optional, and createTrees degrades to no crown-intrusion cap without it. */
  const trees = world.createTrees(scene, lidar, heightAt, {
    campus3d: campus, arcgis, markings,
  });
  rep.facts(geometryFacts({ trees: trees.group }));
  await rep.paint();

  /* -------------------------------------------------------------- detail */
  rep.phase("detail");
  await rep.paint();
  const details = createDetails(scene, campus, heightAt);

  /* The athletics zone, 1:1 with the aerial references: at Muir, the Main Gym
     vault roof and Natatorium skylight, the courts' nets/hoops/rigs and Muir
     Field's overlays; at RIMAC, the softball field, the perimeter fencing, the
     west bleacher and the pitches' patchy turf. Every module no-ops quietly on
     missing data; one parent group so the dev panel can drop the whole zone at
     once. */
  const athleticsZone = new THREE.Group();
  for (const made of [
    createAthletics(scene, { campus, heightAt, massInfo }),
    createRecreation(scene, { campus, arcgis, markings, heightAt }),
    createMuirField(scene, { markings, heightAt }),
    createRimac(scene, { heightAt }),
  ]) {
    /* Some builders hand back { group }, some the Object3D itself. Taking only
       the former silently left Muir Field's overlays parented to the scene:
       they rendered, so nothing looked broken, but the layer toggle did not
       control them and no test noticed. Accept both shapes. */
    const obj = made?.group ?? (made?.isObject3D ? made : null);
    if (obj) athleticsZone.add(obj);
  }
  scene.add(athleticsZone);

  /* Eighth College's ground plane, on its OWN layer rather than inside the
     athletics zone: it is a colour correction over roughly 9,000 m² that the
     construction-epoch satellite tint leaves as bare dirt, and being able to
     drop it independently is how you see what it is covering. Same contract as
     every zone builder — it hands back { group }, it never adds itself to the
     scene, and it no-ops quietly when its survey file is absent. */
  const eighthZone = new THREE.Group();
  const eighth = createEighth(scene, { campus, arcgis, eighth: eighthData, markings, heightAt });
  if (eighth?.group) eighthZone.add(eighth.group);
  /* What STANDS on that ground, from the same survey plus the registered Apple
     frames. Its own builder, parented into the SAME zone so one toggle drops
     the college's ground and its furniture together. Kept out of
     campus-eighth.js so the two modules do not import each other. */
  const eighthProps = createEighthFurniture(scene, { arcgis, eighth: eighthData, heightAt });
  if (eighthProps?.group) eighthZone.add(eighthProps.group);
  scene.add(eighthZone);

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
  await rep.paint();

  /* -------------------------------------------------------------- chrome */
  rep.phase("chrome");
  await rep.paint();

  /* Free roam and teleport see buildings and plazas only — path centroids are
     not places (see isPathName). */
  const placeable = Object.fromEntries(
    Object.entries(campus.places).filter(([n]) => !isPathName(n))
  );
  explore = createExplore({
    campus: { ...campus, places: placeable }, lidar, heightAt, solidAt,
    /* With the region loaded this is the coastal extent, so free roam reaches
       the beach instead of stopping at the old campus wall. */
    coverage: terrain.coverage,
  });
  explore.speed = state.speed;

  /* A click on the minimap teleports you to that spot: same heading, same
     height over the ground. The minimap owns the pixel→metre arithmetic (the
     same transform its own dot is drawn with); this callback owns what "being
     there" means. */
  minimap = createMinimap(document.getElementById("walk-minimap"), {
    colors, lidar, boundary,
    onTeleport(x, z) { explore.enterAt(x, z, explore.yaw); },
  });

  bindInput(canvas);
  resize();
  addEventListener("resize", resize);

  /* The velocity slider is logarithmic, so the walking range is not three
     pixels wide — see campus-explore.js. The arrow keys drive the same number,
     so the slider has to follow them, not just lead. */
  const slider = document.getElementById("walk-speed");
  const speedVal = document.getElementById("walk-speed-val");
  showSpeed = () => {
    if (slider) slider.value = String(Math.round(speedToSlider(state.speed) * 1000));
    if (speedVal) {
      speedVal.textContent =
        state.speed >= 10 ? `${Math.round(state.speed)} m/s` : `${state.speed.toFixed(1)} m/s`;
    }
  };
  slider?.addEventListener("input", () => {
    state.speed = sliderToSpeed(Number(slider.value) / 1000);
    explore.speed = state.speed;
    showSpeed();
  });
  showSpeed();

  /* Teleport: pick any named place and stand in front of it. */
  const tp = document.getElementById("walk-teleport");
  if (tp) {
    /* NAMES only. The full-campus OSM pull brought in address-labelled
       buildings ("965 University Center", "3750 Convoy Street") that filled the
       menu with what read as random numbers. A teleport destination is a place
       a student can SAY. */
    const sayable = Object.keys(placeable)
      .filter((n) => /[a-zA-Z].*[a-zA-Z].*[a-zA-Z]/.test(n) && !/^\d/.test(n))
      .sort();
    for (const name of sayable) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      tp.append(opt);
    }
    tp.addEventListener("change", () => {
      if (!tp.value) return;
      explore.teleport(tp.value);
      tp.value = "";
      tp.blur(); // arrow keys must go back to the throttle, not to the list
    });
  }

  /* The manipulation seam. Everything the keys can do, callable: the screenshot
     harness steers the camera through this to photograph the world from exact
     spots for the realism checks, and it is equally usable from the console.
     Same machinery, no second code path. */
  window.__campusWalk = {
    state, explore,
    get camera() { return camera; },
    /* Hover anywhere: x/z in campus metres, eyes `hover` m above the ground. */
    fly(x, z, hover = EYE, yaw = 0, pitch = -0.05) {
      explore.enterAt(x, z, yaw);
      explore.hover = hover;
      explore.pitch = pitch;
    },
    /* Turn, on the spot, to look straight at a named place. */
    face(name) {
      const p = campus.places[name];
      if (!p) return;
      explore.yaw = Math.atan2(p.x - explore.x, p.z - explore.z);
    },
    /* The same jump a minimap click makes, so a teleport is scriptable end to
       end. */
    teleport(x, z) { explore.enterAt(x, z, explore.yaw); },
    places: () => campus.places,
    /* Ground height and roof height under any point. Exposed because a roof map
       is invisible from the screen — a gap in it looks like nothing at all until
       Q sends you up at thirty metres a second over a building the sampler could
       not see — so the coverage has to be checkable from the console. */
    probe: (x, z) => ({ ground: heightAt(x, z), roof: solidAt(x, z) }),
    /* What the region actually put in the scene, and where the world now ends.
       Exposed for the same reason `probe` is: from a screenshot you cannot
       tell a regional hillside from the campus grid's own west edge draped in
       satellite imagery, and "it looked right" is not a measurement. */
    region: () => (terrain.region
      ? {
          ...terrain.region,
          coverage: terrain.coverage,
          /* Is there land here, sea here, or nothing at all? */
          landAt: (x, z) => heightAt(x, z),
        }
      : null),
  };

  /* --------------------------------------------------------- first frame */
  rep.phase("frame");

  /* SPAWN: hanging SPAWN_ALTITUDE_M over Argo Hall, looking north across the
     whole campus. Free roam holds its height over the ground — nothing falls
     until you press a key — so the first frame is the surveyor's view. */
  const argo = campus.places["Argo Hall"];
  if (argo) {
    explore.enterAt(argo.x, argo.z, Math.PI);
    explore.hover = SPAWN_ALTITUDE_M;
    explore.pitch = -0.35;
  }

  /* Render once BEFORE handing back, so the campus is already behind the
     loading screen when it fades. Resolving on a blank canvas and fading to it
     reads as a crash for the half-second before the first rAF lands. */
  state.lastTime = performance.now();
  update(0);
  renderer.render(scene, camera);
  rep.facts(geometryFacts({ scene }));
  rep.log("standing 110 m over Argo Hall");
  await rep.paint();
  frame(performance.now());

  return {
    masses: built.masses,
    drawCalls: built.drawCalls,
    ground: arcgis?.ground?.length || 0,
    trees: trees.count,
    landmarks: landmarkData?.landmarks?.length || 0,
    /* The dev panel's whole toolkit: switch a layer off to see what stood
       behind it — nearly every rendering fault found so far was invisible
       until the thing in front of it could be. */
    layers: {
      terrain: terrain.mesh,
      buildings: built.group,
      ground: surfaces,
      trees: trees.group,
      details: details.group,
      athletics: athleticsZone,
      eighth: eighthZone,
      regionMassing: regionZone,
      labels: labels.group,
      ...(landmarksGroup ? { landmarks: landmarksGroup } : {}),
    },
    status() {
      return {
        view: "free roam",
        x: explore.x,
        z: explore.z,
        hover: explore.hover,
        ground: heightAt(explore.x, explore.z),
        heading: (explore.yaw * 180) / Math.PI,
        near: lastCalled ? { name: lastCalled.name, height: lastCalled.height ?? null } : null,
      };
    },
  };
}
