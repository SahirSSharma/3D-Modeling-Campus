// The furniture of the walk: what the footage shows between the buildings.
//
// In 340 frames of the real campus, no object appears more often than the
// black lamp post with its pair of vinyl banners — more than any building.
// After it: the perforated concrete bench blocks lining Library Walk, the
// royal-blue emergency towers, the chrome-yellow hydrants punctuating grey
// plazas. None of it existed in the model, and their absence is a lot of why
// a rendered walk read as a diagram and the footage reads as a place.
//
// Everything here is PLACED, not modelled from survey: deterministic spacing
// along the named major walks, pushed off the centreline, skipped where a
// building footprint already stands. placeDetails() is pure data in and data
// out, so the tests run the same rules in Node; createDetails() turns the
// result into a handful of instanced meshes.
import * as THREE from "../vendor/three/three.module.min.js";

/* The walks that carry lamp rows in the footage, with each zone's measured
   banner colour (W:f0148/f0183 azure, D:f0052 maroon, chartreuse Lyman,
   teal on the Muir stretch). */
const MAJOR_WALKS = {
  "Ridge Walk": "#2f7fc0",
  "Library Walk": "#2f7fc0",
  "Warren Mall": "#8a3a5c",
  "Lyman Lane": "#d8c94e",
  "Muir Lane": "#2ba0c1",
  "Rupertus Lane": "#2f7fc0",
  "Herbert York Lane": "#2f7fc0",
  "Innovation Lane": "#151e3b",
  "Mandeville Loop": "#d8c94e",
};

const LAMP_EVERY = 18; // m; the footage rhythm is 15–20 m
const BENCH_EVERY = 12;
const TOWER_EVERY = 275;
const HYDRANT_EVERY = 95;
const TRASH_EVERY = 60; // paired enclosures at plaza edges, ~every 50 m
const RACK_EVERY = 130; // a loaded rack row wherever paths meet buildings
const KIOSK_EVERY = 210; // navy wayfinding pylons at junction rhythm

/* Colours, all frame-measured (§6 of the correction plan). */
export const DETAIL_COLORS = {
  pole: "#2e2e2c",
  bench: "#9b9f9a",
  tower: "#1a4a8c",
  hydrant: "#d8c22a",
  trash: "#33363a",
  rack: "#2c2c2e",
  kiosk: "#1c2b4a",
};

/** Point-in-ring, with a bbox prefilter built once per building. */
const inRing = (x, z, ring) => {
  let ins = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
};

function buildingIndex(campus) {
  const items = [];
  for (const b of campus.buildings || []) {
    if (!b.p || b.p.length < 3) continue;
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const [x, z] of b.p) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (z < z0) z0 = z; if (z > z1) z1 = z;
    }
    items.push({ ring: b.p, x0: x0 - 0.8, z0: z0 - 0.8, x1: x1 + 0.8, z1: z1 + 0.8 });
  }
  return (x, z) => {
    for (const it of items) {
      if (x < it.x0 || x > it.x1 || z < it.z0 || z > it.z1) continue;
      if (inRing(x, z, it.ring)) return true;
    }
    return false;
  };
}

/**
 * Every placement, from the path data alone. Deterministic: the same data
 * places the same lamp in the same spot on every visit.
 */
export function placeDetails(campus) {
  const inBuilding = buildingIndex(campus);
  const lamps = [];
  const benches = [];
  const towers = [];
  const hydrants = [];
  const trash = [];
  const racks = [];
  const kiosks = [];
  /* Two clearance rules. Same-kind spacing keeps the rhythm honest where
     the named majors arrive as many overlapping OSM ways (Ridge Walk is 21
     path entries); the small global guard only stops two DIFFERENT things
     sharing one square metre — a lamp beside a bench is the footage, a lamp
     inside a bench is a bug. */
  const placed = [];
  const nearSame = (list, x, z, r) => {
    for (const it of list) {
      if ((it.x - x) * (it.x - x) + (it.z - z) * (it.z - z) < r * r) return true;
    }
    return false;
  };
  const clear = (x, z) => {
    for (const [px, pz] of placed) {
      if ((px - x) * (px - x) + (pz - z) * (pz - z) < 1.6 * 1.6) return false;
    }
    return true;
  };

  /* Walk each major path, dropping items by CUMULATIVE distance so spacing
     survives the polyline's segment breaks. Lamps alternate sides; a banner
     rides every second lamp. */
  for (const path of campus.paths || []) {
    const banner = MAJOR_WALKS[path.n];
    if (!banner || !path.p || path.p.length < 2 || path.steps) continue;
    let along = 0;
    let nextLamp = LAMP_EVERY / 2;
    let nextBench = path.n === "Library Walk" ? BENCH_EVERY / 2 : Infinity;
    let nextTower = TOWER_EVERY / 2;
    let nextHydrant = HYDRANT_EVERY / 3;
    let nextTrash = TRASH_EVERY / 2;
    let nextRack = RACK_EVERY / 2;
    let nextKiosk = KIOSK_EVERY / 3;
    let flip = 1;
    for (let i = 0; i < path.p.length - 1; i++) {
      const [ax, az] = path.p[i];
      const [bx, bz] = path.p[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 0.01) continue;
      const ux = (bx - ax) / len;
      const uz = (bz - az) / len;
      const rot = Math.atan2(ux, uz);
      const drop = (at, offset) => [
        ax + ux * (at - along) - uz * offset,
        az + uz * (at - along) + ux * offset,
      ];
      while (nextLamp <= along + len) {
        const off = (path.n === "Ridge Walk" ? 4.0 : 2.6) * flip;
        const [x, z] = drop(nextLamp, off);
        if (!inBuilding(x, z) && clear(x, z) && !nearSame(lamps, x, z, 9)) {
          lamps.push({ x, z, rot, banner: lamps.length % 2 ? banner : null });
          placed.push([x, z]);
        }
        flip = -flip;
        nextLamp += LAMP_EVERY;
      }
      while (nextBench <= along + len) {
        for (const side of [-1, 1]) {
          const [x, z] = drop(nextBench, 3.4 * side);
          if (!inBuilding(x, z) && clear(x, z) && !nearSame(benches, x, z, 5)) {
            benches.push({ x, z, rot });
            placed.push([x, z]);
          }
        }
        nextBench += BENCH_EVERY;
      }
      while (nextTower <= along + len) {
        const [x, z] = drop(nextTower, 3.2);
        if (!inBuilding(x, z) && clear(x, z) && !nearSame(towers, x, z, 120)) {
          towers.push({ x, z, rot });
          placed.push([x, z]);
        }
        nextTower += TOWER_EVERY;
      }
      while (nextHydrant <= along + len) {
        const [x, z] = drop(nextHydrant, -3.0);
        if (!inBuilding(x, z) && clear(x, z) && !nearSame(hydrants, x, z, 45)) {
          hydrants.push({ x, z });
          placed.push([x, z]);
        }
        nextHydrant += HYDRANT_EVERY;
      }
      while (nextTrash <= along + len) {
        const [x, z] = drop(nextTrash, 3.1);
        if (!inBuilding(x, z) && clear(x, z) && !nearSame(trash, x, z, 30)) {
          trash.push({ x, z, rot });
          placed.push([x, z]);
        }
        nextTrash += TRASH_EVERY;
      }
      while (nextRack <= along + len) {
        const [x, z] = drop(nextRack, -4.4);
        if (!inBuilding(x, z) && clear(x, z) && !nearSame(racks, x, z, 70)) {
          racks.push({ x, z, rot });
          placed.push([x, z]);
        }
        nextRack += RACK_EVERY;
      }
      while (nextKiosk <= along + len) {
        const [x, z] = drop(nextKiosk, 2.2);
        if (!inBuilding(x, z) && clear(x, z) && !nearSame(kiosks, x, z, 120)) {
          kiosks.push({ x, z, rot });
          placed.push([x, z]);
        }
        nextKiosk += KIOSK_EVERY;
      }
      along += len;
    }
  }
  return { lamps, benches, towers, hydrants, trash, racks, kiosks };
}

/* ------------------------------------------------------------- rendering */

const lambert = (color) => new THREE.MeshLambertMaterial({ color });

function instanced(geo, mat, items, place) {
  const mesh = new THREE.InstancedMesh(geo, mat, items.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  const pos = new THREE.Vector3();
  const axis = new THREE.Vector3(0, 1, 0);
  items.forEach((it, i) => {
    const p = place(it);
    q.setFromAxisAngle(axis, p.rot || 0);
    pos.set(p.x, p.y, p.z);
    m.compose(pos, q, scale);
    mesh.setMatrixAt(i, m);
    if (p.color) mesh.setColorAt(i, p.color);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

/**
 * The lamp posts (with their banner pairs), benches, blue-light towers and
 * hydrants, as ~8 instanced draws for the whole campus.
 */
export function createDetails(scene, campus, heightAt) {
  const d = placeDetails(campus);
  const group = new THREE.Group();
  const c = new THREE.Color();

  /* Lamp: 7.2 m charcoal pole, flat LED head on a short arm. */
  group.add(instanced(
    new THREE.CylinderGeometry(0.06, 0.09, 7.2, 6), lambert(DETAIL_COLORS.pole), d.lamps,
    (l) => ({ x: l.x, y: heightAt(l.x, l.z) + 3.6, z: l.z, rot: l.rot })
  ));
  group.add(instanced(
    new THREE.BoxGeometry(0.2, 0.14, 0.62), lambert("#3a3a38"), d.lamps,
    (l) => ({ x: l.x, y: heightAt(l.x, l.z) + 7.15, z: l.z, rot: l.rot })
  ));
  /* Banner pair on every second pole: two vinyl rectangles on arms either
     side of the pole, faces toward the walker — wide across the path, thin
     along it. */
  const withBanners = d.lamps.filter((l) => l.banner);
  for (const side of [-0.42, 0.42]) {
    group.add(instanced(
      new THREE.BoxGeometry(0.6, 1.9, 0.05), new THREE.MeshLambertMaterial({ color: 0xffffff }),
      withBanners,
      (l) => ({
        x: l.x + Math.cos(l.rot) * side,
        y: heightAt(l.x, l.z) + 4.6,
        z: l.z - Math.sin(l.rot) * side,
        rot: l.rot,
        color: c.set(l.banner),
      })
    ));
  }

  /* Perforated precast bench blocks (the perforations stay a colour note at
     this poly budget; the block and its rhythm are what register). */
  group.add(instanced(
    new THREE.BoxGeometry(2.6, 0.5, 0.55), lambert(DETAIL_COLORS.bench), d.benches,
    (b) => ({ x: b.x, y: heightAt(b.x, b.z) + 0.25, z: b.z, rot: b.rot })
  ));

  /* Emergency towers: royal-blue pylon, pale head with the strobe. */
  group.add(instanced(
    new THREE.BoxGeometry(0.3, 2.9, 0.3), lambert(DETAIL_COLORS.tower), d.towers,
    (t) => ({ x: t.x, y: heightAt(t.x, t.z) + 1.45, z: t.z, rot: t.rot })
  ));
  group.add(instanced(
    new THREE.BoxGeometry(0.34, 0.22, 0.34), lambert("#dfe3e6"), d.towers,
    (t) => ({ x: t.x, y: heightAt(t.x, t.z) + 3.0, z: t.z, rot: t.rot })
  ));

  /* Hydrants: the small saturated pops on the grey. */
  group.add(instanced(
    new THREE.CylinderGeometry(0.13, 0.15, 0.55, 7), lambert(DETAIL_COLORS.hydrant), d.hydrants,
    (h) => ({ x: h.x, y: heightAt(h.x, h.z) + 0.28, z: h.z })
  ));

  /* Trash/recycle pairs: two charcoal sheet-metal boxes shoulder to
     shoulder, angled tops left to the imagination at this budget. */
  for (const side of [-0.55, 0.55]) {
    group.add(instanced(
      new THREE.BoxGeometry(0.72, 1.15, 0.72), lambert(DETAIL_COLORS.trash), d.trash,
      (t) => ({
        x: t.x + Math.cos(t.rot) * side,
        y: heightAt(t.x, t.z) + 0.57,
        z: t.z - Math.sin(t.rot) * side,
        rot: t.rot,
      })
    ));
  }

  /* Bike racks: a loaded row of inverted-U hoops reads, from eye level, as
     a run of thin dark slabs — six per station along the path direction. */
  for (let k = 0; k < 6; k++) {
    const at = (k - 2.5) * 0.9;
    group.add(instanced(
      new THREE.BoxGeometry(0.08, 0.78, 0.72), lambert(DETAIL_COLORS.rack), d.racks,
      (r) => ({
        x: r.x + Math.sin(r.rot) * at,
        y: heightAt(r.x, r.z) + 0.39,
        z: r.z + Math.cos(r.rot) * at,
        rot: r.rot,
      })
    ));
  }

  /* Wayfinding kiosks: the navy double-sided pylon with its pale map panel. */
  group.add(instanced(
    new THREE.BoxGeometry(1.1, 2.5, 0.18), lambert(DETAIL_COLORS.kiosk), d.kiosks,
    (k) => ({ x: k.x, y: heightAt(k.x, k.z) + 1.25, z: k.z, rot: k.rot })
  ));
  group.add(instanced(
    new THREE.BoxGeometry(0.8, 1.1, 0.2), lambert("#d8dbd4"), d.kiosks,
    (k) => ({ x: k.x, y: heightAt(k.x, k.z) + 1.35, z: k.z, rot: k.rot })
  ));

  scene.add(group);
  return { group, counts: {
    lamps: d.lamps.length, banners: withBanners.length * 2,
    benches: d.benches.length, towers: d.towers.length, hydrants: d.hydrants.length,
    trash: d.trash.length * 2, racks: d.racks.length * 6, kiosks: d.kiosks.length,
  } };
}
