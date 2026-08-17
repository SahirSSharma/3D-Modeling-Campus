/* The Revelle Plaza landscape's photo-sourced detail section.
 *
 * INVENTED class, so the gates are about quarantine, about the tree
 * re-skins never moving a measured trunk, and about not contradicting the
 * measured world:
 *
 *   - it is labelled, epoch-stamped, sourced, and it says what it left out;
 *   - colours are data, and they are hex;
 *   - every re-skinned tree copies its (x, z, h, r) VERBATIM from the
 *     measured LiDAR table, and the skip list main uses to suppress the blob
 *     rendering is exactly the set of re-skinned keys;
 *   - the coral tree is NOT in the LiDAR (planted at/after the 2014 epoch)
 *     and must never appear in the skip list;
 *   - NO PALMS, and the paving parameters that survived ground-truthing
 *     (pitch 6.4 / band 0.42 / radius 1.8) match the revelle section's;
 *   - everything stays inside Zone 1, nothing invented sits inside a
 *     measured building footprint, and no solid comes within 3 m of the
 *     corridor-staging centreline (the run crosses this exact plaza);
 *   - the module builds headless, twice, byte-identically, and everything
 *     it places rides surfaceAt.
 *
 * The section will live under the `plaza` key of
 * docs/data/campus-photo-detail.json; until the main session merges it, the
 * tests read the build-side copy in the scratchpad.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as THREE from "../docs/vendor/three/three.module.min.js";
import { createPhotoPlaza } from "../docs/js/campus-photo-plaza.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(p, "utf8"));

const MERGED = join(root, "docs/data/campus-photo-detail.json");
const SCRATCH = join(
  "/private/tmp/claude-501/-Users-sahir-Desktop-3D-Modeling-Campus",
  "9604bc97-5c58-40d0-9475-a0f493c88ee4/scratchpad/merge/plaza-section.json"
);
const photoDoc = read(MERGED);
const section = photoDoc.plaza || (existsSync(SCRATCH) ? read(SCRATCH) : null);

const campus = read(join(root, "docs/data/campus-3d.json"));
const lidar = read(join(root, "docs/data/campus-lidar.json"));
const staging = read(join(root, "docs/data/corridor-staging.json"));

/* Zone 1 bounds from the survey: x -210..155, z 295..505. */
const ZONE = { x0: -210, x1: 155, z0: 295, z1: 505 };

const inRing = (x, z, r) => {
  let ins = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, zi] = r[i];
    const [xj, zj] = r[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
};

function toRoute(x, z) {
  const line = staging.route.points;
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, az] = line[i];
    const [bx, bz] = line[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz;
    let t = len2 ? ((x - ax) * dx + (z - az) * dz) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
    if (d < best) best = d;
  }
  return best;
}

/** Every measured tree re-skin declared by the section. */
function reskins() {
  const T = section.treeOverrides;
  return [...T.pines.items, ...T.ficus.items, ...T.eucalyptus.items];
}

/** Every solid ground point the section stands up (trunks, furniture). */
function solids() {
  const out = [];
  const F = section.furniture;
  for (const it of F.lamp.items) out.push([it.x, it.z, "lamp"]);
  for (const it of F.benches.items) {
    for (const side of [-1, 1]) {
      out.push([
        it.x + Math.cos(it.rot) * side * (F.benches.length / 2),
        it.z - Math.sin(it.rot) * side * (F.benches.length / 2),
        "bench",
      ]);
    }
  }
  for (const it of F.binPairs.items) {
    out.push([it.x, it.z, "bin"]);
    out.push([it.x + Math.cos(it.rot) * F.binPairs.gap, it.z - Math.sin(it.rot) * F.binPairs.gap, "bin"]);
  }
  for (const it of F.terraces.items) {
    for (const [ox, oz] of [[0, 0], [-1.25, 0], [1.25, 0], [0, -1.25], [0, 1.25]]) {
      out.push([it.x + ox, it.z + oz, "umbrella"]);
    }
  }
  out.push([F.bikes.x0, F.bikes.z, "bike"], [F.bikes.x1, F.bikes.z, "bike"]);
  const Fo = section.fountain;
  const half = Fo.plinth / 2;
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const lx = sx * half;
    const lz = sz * half;
    out.push([
      Fo.cx + lx * Math.cos(Fo.rot) + lz * Math.sin(Fo.rot),
      Fo.cz - lx * Math.sin(Fo.rot) + lz * Math.cos(Fo.rot),
      "fountain",
    ]);
  }
  const B = section.memorial.bench;
  const span = B.arcLength / B.radius;
  for (let i = 0; i <= 4; i++) {
    const a = (i / 4 - 0.5) * span;
    out.push([
      section.memorial.cx + Math.sin(a) * (B.radius + B.depth / 2),
      section.memorial.cz + Math.cos(a) * (B.radius + B.depth / 2),
      "memorial-bench",
    ]);
  }
  /* Trunks — measured positions plus the multi-stem spread of ficus/coral. */
  for (const t of reskins()) out.push([t.x, t.z, "trunk"]);
  const spreadOf = { ficus: 1.6, coral: 2.0 };
  for (const kind of ["ficus"]) {
    for (const t of section.treeOverrides[kind].items) {
      for (const [ox, oz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        out.push([t.x + ox * spreadOf[kind], t.z + oz * spreadOf[kind], "stem"]);
      }
    }
  }
  const c = section.treeOverrides.coral;
  for (const [ox, oz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    out.push([c.x + ox * spreadOf.coral, c.z + oz * spreadOf.coral, "coral"]);
  }
  return out;
}

/* ------------------------------------------------------------------ gates */

test("the section exists and is reachable", () => {
  assert.ok(section, `no plaza key in ${MERGED} and no scratch copy at ${SCRATCH}`);
});

test("it says what it is, where it came from, and what it left out", () => {
  assert.match(section.label, /Revelle Plaza/i);
  assert.ok(section.epoch, "no epoch stamp");
  assert.match(section.note, /INVENTED/, "the note must declare the class");
  assert.ok(Array.isArray(section.sources) && section.sources.length >= 6);
  for (const url of section.sources) assert.match(url, /^https:\/\//);
  assert.ok(Array.isArray(section.absent) && section.absent.length >= 12,
    `absent has ${section.absent?.length} entries — better absent than wrong, and this list does not shrink`);
  /* The gaps the survey named must stay named. */
  for (const re of [/palm/i, /salmon/i, /drinking fountain/i, /el mac/i, /erythrina/i]) {
    assert.ok(section.absent.some((a) => re.test(a)), `absent must keep the ${re} entry`);
  }
});

test("colours are data, and they are hex", () => {
  const keys = Object.keys(section.colors);
  assert.ok(keys.length >= 25, `only ${keys.length} colours`);
  for (const [k, v] of Object.entries(section.colors)) {
    assert.match(v, /^#[0-9a-f]{6}$/, `${k} is not a lowercase 6-digit hex`);
  }
  /* The banner is gold-dominant; a mostly-navy banner would be wrong. */
  const gold = section.colors.bannerGold;
  const r = parseInt(gold.slice(1, 3), 16);
  const b = parseInt(gold.slice(5, 7), 16);
  assert.ok(r > 200 && r > b * 2, `bannerGold ${gold} is not a saturated gold`);
  /* The pale lava flecks are genuinely pale — part 1's value was too dark. */
  assert.ok(parseInt(section.colors.lavaRockPale.slice(1, 3), 16) > 0xb0,
    "lavaRockPale must read as the cream flecks, not another brown");
});

test("no palms, anywhere in the section", () => {
  const body = JSON.stringify({ ...section, absent: [], note: "" });
  assert.ok(!/palm/i.test(body), "a palm crept into the plaza");
});

test("every re-skinned tree copies a measured LiDAR trunk verbatim", () => {
  const table = new Map(lidar.trees.map((t) => [`${t[0]},${t[1]}`, t]));
  for (const it of reskins()) {
    const key = `${it.x},${it.z}`;
    const t = table.get(key);
    assert.ok(t, `${key} is not in the measured tree table`);
    assert.equal(it.h, t[2], `${key} height drifted from the survey`);
    assert.equal(it.r, t[3], `${key} crown radius drifted from the survey`);
  }
});

test("the skip list is exactly the re-skinned keys, and the coral tree is not in it", () => {
  const keys = reskins().map((it) => `${it.x},${it.z}`).sort();
  const skip = [...section.treeOverrides.skipMeasuredKeys].sort();
  assert.deepEqual(skip, keys, "skipMeasuredKeys must match the re-skinned trunks one for one");
  const c = section.treeOverrides.coral;
  assert.ok(!skip.includes(`${c.x},${c.z}`), "the coral tree has no measured trunk to skip");
  assert.ok(!lidar.trees.some((t) => t[0] === c.x && t[1] === c.z),
    "the coral tree must not shadow a measured trunk");
  assert.match(c.tag, /\[estimated\]/, "the coral tree's grown size is an estimate and must say so");
});

test("the York belt is the survey's twelve Torrey pines", () => {
  const P = section.treeOverrides.pines.items;
  assert.equal(P.length, 12);
  for (const it of P) {
    assert.ok(it.x >= 70 && it.x <= 89 && it.z >= 336 && it.z <= 467,
      `pine at (${it.x}, ${it.z}) is outside the York belt`);
  }
});

test("eucalyptus lives only east of York and on the Keeling west road", () => {
  for (const it of section.treeOverrides.eucalyptus.items) {
    const eastOfYork = it.x >= 95;
    const keelingRoad = it.x <= -110;
    assert.ok(eastOfYork || keelingRoad,
      `eucalyptus at (${it.x}, ${it.z}) is inside the plaza, where the photos show pine and ficus`);
  }
});

test("the ground-truthed paving parameters match the revelle section", () => {
  const rp = photoDoc.revelle?.paving;
  assert.ok(rp, "the revelle paving block the arcs derive from is missing");
  assert.equal(section.arcs.pitch, rp.pitch, "pitch 6.4 survives ground-truthing");
  assert.equal(section.arcs.band, rp.band, "band 0.42 survives ground-truthing");
  assert.equal(section.arcs.radius, rp.radius, "radius 1.8 survives ground-truthing");
});

test("everything stays inside Zone 1", () => {
  for (const [x, z, what] of solids()) {
    assert.ok(x >= ZONE.x0 && x <= ZONE.x1 && z >= ZONE.z0 && z <= ZONE.z1,
      `${what} at (${x}, ${z}) is outside Zone 1`);
  }
  for (const p of [...section.lawns.panels, section.lawns.crossWalk, section.dgBelt]) {
    for (const x of [p.x0, p.x1]) for (const z of [p.z0, p.z1]) {
      assert.ok(x >= ZONE.x0 && x <= ZONE.x1 && z >= ZONE.z0 && z <= ZONE.z1,
        `a ground rect corner (${x}, ${z}) is outside Zone 1`);
    }
  }
});

test("nothing invented sits inside a measured building footprint", () => {
  const rings = campus.buildings.filter((b) => b.p && b.p.length >= 3);
  for (const [x, z, what] of solids()) {
    for (const b of rings) {
      assert.ok(!inRing(x, z, b.p), `${what} at (${x}, ${z}) is inside ${b.n || "an unnamed mass"}`);
    }
  }
});

test("no solid object crowds the scooter corridor", () => {
  /* The staging run crosses this exact plaza — first along Argo's south face,
     then diagonally over the paving to the north approach. Flat decals under
     the track are fine; anything you can hit is not. */
  let worst = Infinity;
  let at = null;
  for (const [x, z, what] of solids()) {
    const d = toRoute(x, z);
    if (d < worst) { worst = d; at = [x, z, what]; }
  }
  assert.ok(worst >= 3, `closest solid is ${worst.toFixed(2)} m from the centreline at ${JSON.stringify(at)}`);
});

test("the lamp standard and its banners land on the measured brackets", () => {
  const L = section.furniture.lamp;
  assert.ok(L.height >= 5.5 && L.height <= 6.0, `pole ${L.height} m is outside the measured 5.5-6.0`);
  assert.ok(L.bannerBottomY >= 2.8 && L.bannerBottomY <= 3.1, "banner bottom bracket 2.8-3.1 m");
  const top = L.bannerBottomY + L.bannerSize[1];
  assert.ok(top >= 4.2 && top <= 4.5, `banner top ${top.toFixed(2)} m is outside the measured 4.2-4.5`);
  assert.deepEqual(L.bannerSize, [0.51, 1.37], "banners are the published 20x54-inch size");
});

test("the fountain is the resolved square-plinth-with-recessed-ring form", () => {
  const F = section.fountain;
  assert.ok(F.plinth >= 8.5 && F.plinth <= 9.0, "square plinth 8.5-9.0 m");
  assert.ok(Math.abs(F.basinRadius * 2 - 6.0) <= 0.2, "circular basin ~6 m across");
  assert.ok(F.plinthHeight >= 0.45 && F.plinthHeight <= 0.5, "the sit-on edge is 0.45-0.5 m");
  assert.ok(Math.abs(F.cx - 39) <= 1 && Math.abs(F.cz - 369) <= 1, "centre at the measured x~39, z~369");
});

test("the fountain replaces the landmark ring fountain instead of joining it", () => {
  /* campus-landmarks' 'Revelle Plaza Fountain' draws an 8 m basin and jet at
     the same surveyed OSM point. The section must (a) sit ON that point —
     position from OSM wins over the photo/satellite read — and (b) carry the
     wiring declaration main uses to suppress the landmark basin/jet, or the
     merged world shows two interpenetrating fountains. */
  const F = section.fountain;
  assert.equal(F.replacesLandmark, "Revelle Plaza Fountain",
    "the section must name the landmark fountain it supersedes");
  assert.match(F.replacesNote, /SUPPRESS/i, "the wiring instruction must be explicit");
  assert.match(F.replacesNote, /flagpole/i, "the landmark's flagpole must be declared KEPT");
  assert.ok(Math.abs(F.cx - 38.6) <= 0.05 && Math.abs(F.cz - 369.8) <= 0.05,
    "the fountain centre is the landmark's surveyed OSM point (38.6, 369.8)");
});

test("the memorial is flush, starred, and benched on lava rock", () => {
  const M = section.memorial;
  assert.ok(M.slabRadius >= 3.5 && M.slabRadius <= 4.0, "half-disc radius 3.5-4.0 m");
  assert.ok(M.lenses.length >= 14 && M.lenses.length <= 16, "~14-16 flush lenses");
  for (const [lx, lv] of M.lenses) {
    assert.ok(Math.hypot(lx, lv) <= M.slabRadius && lv >= 0,
      `lens (${lx}, ${lv}) is off the half-disc slab`);
  }
  assert.match(M.lensNote, /\[estimated\]/, "the star layout is an estimate and must say so");
  assert.ok(M.bench.arcLength >= 3.5 && M.bench.arcLength <= 4.0, "bench arc 3.5-4.0 m");
});

test("the two lawn panels carry the surveyed dimensions", () => {
  const [n, s] = section.lawns.panels;
  assert.ok(Math.abs((n.x1 - n.x0) - 46) <= 1 && Math.abs((n.z1 - n.z0) - 21) <= 1, "north panel ~46x21");
  assert.ok(Math.abs((s.x1 - s.x0) - 45) <= 1 && Math.abs((s.z1 - s.z0) - 10) <= 1, "south panel ~45x10");
  const w = section.lawns.crossWalk;
  assert.ok(Math.abs((w.z1 - w.z0) - 6) <= 0.5, "the paved cross-walk is ~6 m");
});

/* ------------------------------------------------------- headless builds */

const photoFor = (g) => ({ plaza: section, revelle: photoDoc.revelle });

test("the module builds headless and reports its inventory", () => {
  const ground = () => 0;
  const { group, counts } = createPhotoPlaza(null, { photo: photoFor(), surfaceAt: ground });
  assert.ok(group.children.length > 10, "the group is nearly empty");
  assert.equal(counts.pines, 12);
  assert.equal(counts.ficus, section.treeOverrides.ficus.items.length);
  assert.equal(counts.eucalyptus, section.treeOverrides.eucalyptus.items.length);
  assert.equal(counts.coral, 1);
  assert.equal(counts.lamps, section.furniture.lamp.items.length);
  assert.equal(counts.benches, section.furniture.benches.items.length);
  assert.equal(counts.binPairs, section.furniture.binPairs.items.length);
  assert.equal(counts.umbrellas, section.furniture.terraces.items.length);
  assert.ok(counts.brickArcCrossings > 20, `only ${counts.brickArcCrossings} band crossings found`);
  assert.ok(counts.foliageLobes > 250, `only ${counts.foliageLobes} canopy lobes across 41 trees`);
  assert.equal(counts.foliageCards, 0, "no canopy may be a flat card");
  assert.equal(counts.draws, group.children.length);
});

test("a missing section is a quiet no-op", () => {
  const { group, counts } = createPhotoPlaza(null, { photo: {}, surfaceAt: () => 0 });
  assert.equal(group.children.length, 0);
  assert.deepEqual(counts, {});
});

test("everything the module places rides surfaceAt", () => {
  /* Build on two flat grounds 7 m apart: every instance and every placed
     mesh must move up by exactly 7 — anything that does not is either
     floating on a constant or buried under the drawn terrain. */
  const a = createPhotoPlaza(null, { photo: photoFor(), surfaceAt: () => 0 }).group;
  const b = createPhotoPlaza(null, { photo: photoFor(), surfaceAt: () => 7 }).group;
  assert.equal(a.children.length, b.children.length);
  for (let i = 0; i < a.children.length; i++) {
    const ma = a.children[i];
    const mb = b.children[i];
    if (ma.isInstancedMesh) {
      for (let k = 0; k < ma.count; k++) {
        const ya = ma.instanceMatrix.array[k * 16 + 13];
        const yb = mb.instanceMatrix.array[k * 16 + 13];
        assert.ok(Math.abs(yb - ya - 7) < 1e-4,
          `${ma.name || "instanced child " + i} instance ${k} does not ride the ground (${ya} -> ${yb})`);
      }
    } else {
      assert.ok(Math.abs(mb.position.y - ma.position.y - 7) < 1e-4,
        `child ${i} (${ma.name || ma.type}) does not ride the ground`);
    }
  }
});

test("the big ground sheets conform to sloped terrain, not one centre sample", () => {
  /* The flat-ground ride test above cannot see this failure mode: a single
     quad at one centre sample rides a constant ground perfectly, yet under
     the real LiDAR relief (4.07 m across the DG belt) it buries at one end
     and floats at the other. Build on a sloped plane and demand every
     vertex of every large sheet sits its overlay lift above the ground. */
  const slope = (x, z) => 0.03 * x + 0.02 * z;
  const { group } = createPhotoPlaza(null, { photo: photoFor(), surfaceAt: slope });
  for (const name of ["dg-belt", "cross-walk", "lawn-panel-0", "lawn-panel-1"]) {
    const mesh = group.getObjectByName(name);
    assert.ok(mesh, `${name} not found in the group`);
    const pos = mesh.geometry.attributes.position;
    assert.ok(pos.count > 4, `${name} is a single flat quad and cannot follow relief`);
    for (let i = 0; i < pos.count; i++) {
      const off =
        mesh.position.y + pos.getY(i) -
        slope(mesh.position.x + pos.getX(i), mesh.position.z + pos.getZ(i));
      assert.ok(off > 0.04 && off < 0.25,
        `${name} vertex ${i} is ${off.toFixed(3)} m off the drawn ground (buried or floating)`);
    }
  }
});

test("two builds are identical — the plaza is deterministic", () => {
  const a = createPhotoPlaza(null, { photo: photoFor(), surfaceAt: () => 2 }).group;
  const b = createPhotoPlaza(null, { photo: photoFor(), surfaceAt: () => 2 }).group;
  assert.equal(a.children.length, b.children.length);
  for (let i = 0; i < a.children.length; i++) {
    const ma = a.children[i];
    const mb = b.children[i];
    if (!ma.isInstancedMesh) continue;
    assert.equal(ma.count, mb.count, `child ${i} instance count changed between builds`);
    assert.deepEqual(Array.from(ma.instanceMatrix.array), Array.from(mb.instanceMatrix.array),
      `child ${i} placed its instances differently on a rebuild`);
  }
});

test("tree canopies stay on their measured trunks", () => {
  /* Every pine trunk instance must stand at exactly its LiDAR (x, z), at
     half its bole height — the re-skin never moves the measured tree. */
  const { group } = createPhotoPlaza(null, { photo: photoFor(), surfaceAt: () => 0 });
  const pineTrunks = group.getObjectByName("pine-trunks");
  assert.ok(pineTrunks?.isInstancedMesh && pineTrunks.count === 12, "no 12-instance pine trunk mesh found");
  const P = section.treeOverrides.pines;
  for (let k = 0; k < 12; k++) {
    const e = pineTrunks.instanceMatrix.array;
    const [x, y, z] = [e[k * 16 + 12], e[k * 16 + 13], e[k * 16 + 14]];
    const it = P.items[k];
    /* instanceMatrix stores Float32 — compare at that precision. */
    assert.ok(Math.abs(x - it.x) < 1e-3 && Math.abs(z - it.z) < 1e-3,
      `pine ${k} moved off its measured trunk`);
    assert.ok(Math.abs(y - (it.h * P.boleFrac) / 2) < 1e-3, `pine ${k} bole is not seated`);
  }
});

/* --------------------------------------------------- the canopies are solid
 *
 * The gates above all passed on a canopy built from crossed alpha-cutout
 * cards, which on screen was a bare pole holding a few moth-eaten sheets:
 * invisible edge-on, absent from above. Counting instances cannot see that.
 * These four gates check the SHAPE instead — that every canopy is a set of
 * three-dimensional lobes, that the lobes actually fill the measured crown,
 * that they surround the trunk so the tree has a silhouette from any bearing,
 * and that no structural limb ends in open air.
 */

const CANOPIES = ["canopy-pine-sun", "canopy-pine-shade", "canopy-eucalyptus", "canopy-ficus", "canopy-coral"];

/** Every canopy instance as {x, y, z, sx, sy, sz}, decomposed from the matrix. */
function lobesOf(group) {
  const out = [];
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  for (const name of CANOPIES) {
    const mesh = group.getObjectByName(name);
    assert.ok(mesh?.isInstancedMesh, `${name} is missing — a species lost its canopy`);
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, m);
      m.decompose(p, q, s);
      out.push({ x: p.x, y: p.y, z: p.z, sx: s.x, sy: s.y, sz: s.z, name });
    }
  }
  return out;
}

test("no canopy is a flat card — every lobe is a three-dimensional volume", () => {
  const { group } = createPhotoPlaza(null, { photo: photoFor(), surfaceAt: () => 0 });
  for (const name of CANOPIES) {
    const mesh = group.getObjectByName(name);
    /* A PlaneGeometry has no depth attribute to check, so check the source:
       the canopy geometry must be closed, and closed means its own bounding
       box has extent on all three axes before any instance scale. */
    mesh.geometry.computeBoundingBox();
    const b = mesh.geometry.boundingBox;
    for (const [axis, e] of [["x", b.max.x - b.min.x], ["y", b.max.y - b.min.y], ["z", b.max.z - b.min.z]]) {
      assert.ok(e > 0.5, `${name} geometry is flat in ${axis} (${e.toFixed(3)}) — that is a card, not a canopy`);
    }
  }
  for (const l of lobesOf(group)) {
    const min = Math.min(l.sx, l.sy, l.sz);
    const max = Math.max(l.sx, l.sy, l.sz);
    assert.ok(min > 0.25, `a ${l.name} lobe is scaled to ${min.toFixed(3)} on an axis — squashed to a sheet`);
    assert.ok(max / min < 4, `a ${l.name} lobe has aspect ${(max / min).toFixed(1)} — that reads as a plane`);
  }
});

test("every canopy fills its measured crown from every bearing", () => {
  /* For each measured tree: gather the lobes over it, and demand they (a) are
     numerous enough to overlap into a mass, (b) reach out toward the surveyed
     crown radius rather than huddling on the trunk, and (c) occupy at least
     six of the eight compass sectors, so the tree still has a silhouette when
     you walk round it. A ring of cards fails (c) hard. */
  const { group } = createPhotoPlaza(null, { photo: photoFor(), surfaceAt: () => 0 });
  const lobes = lobesOf(group);
  const T = section.treeOverrides;
  const trees = [
    ...T.pines.items.map((t) => ({ ...t, kind: "pine", crown: t.r })),
    ...T.eucalyptus.items.map((t) => ({ ...t, kind: "eucalyptus", crown: t.r })),
    ...T.ficus.items.map((t) => ({ ...t, kind: "ficus", crown: t.r })),
    { ...T.coral, kind: "coral", crown: T.coral.spread / 2 },
  ];
  /* Eucalyptus is airy by species and its clumps are small — the survey's
     crown radius is the outer limit, not a shell it has to reach. */
  const minLobes = { pine: 9, eucalyptus: 5, ficus: 12, coral: 6 };
  const minSectors = { pine: 6, eucalyptus: 4, ficus: 6, coral: 5 };
  for (const t of trees) {
    const mine = lobes.filter((l) =>
      Math.hypot(l.x - t.x, l.z - t.z) <= t.crown * 1.35 && l.y > t.h * 0.35 && l.y < t.h * 1.15);
    assert.ok(mine.length >= minLobes[t.kind],
      `${t.kind} at (${t.x}, ${t.z}) has ${mine.length} lobes over it — too few to read as a mass`);
    const reach = Math.max(...mine.map((l) => Math.hypot(l.x - t.x, l.z - t.z) + Math.max(l.sx, l.sz)));
    assert.ok(reach >= t.crown * 0.6,
      `${t.kind} at (${t.x}, ${t.z}) reaches only ${reach.toFixed(1)} m of its ${t.crown} m crown`);
    const sectors = new Set(mine
      .filter((l) => Math.hypot(l.x - t.x, l.z - t.z) > t.crown * 0.15)
      .map((l) => Math.floor(((Math.atan2(l.x - t.x, l.z - t.z) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4))));
    assert.ok(sectors.size >= minSectors[t.kind],
      `${t.kind} at (${t.x}, ${t.z}) occupies only ${sectors.size}/8 bearings — it disappears from some angles`);
  }
});

test("no structural limb ends in open air", () => {
  /* The old canopy hung cards off limb tips; when a card turned edge-on the
     limb was a bare stick. Every limb tip must now land inside a lobe. */
  const { group } = createPhotoPlaza(null, { photo: photoFor(), surfaceAt: () => 0 });
  const lobes = lobesOf(group);
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const tip = new THREE.Vector3();
  for (const name of ["pine-limbs", "euc-limbs"]) {
    const mesh = group.getObjectByName(name);
    assert.ok(mesh?.isInstancedMesh, `${name} is missing`);
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, m);
      m.decompose(p, q, s);
      tip.set(0, s.y / 2, 0).applyQuaternion(q).add(p);
      const inside = lobes.some((l) =>
        (tip.x - l.x) ** 2 / l.sx ** 2 + (tip.y - l.y) ** 2 / l.sy ** 2 + (tip.z - l.z) ** 2 / l.sz ** 2 <= 1);
      assert.ok(inside, `${name} instance ${i} ends at (${tip.x.toFixed(1)}, ${tip.y.toFixed(1)}, ${tip.z.toFixed(1)}), outside every lobe`);
    }
  }
});

test("the canopies stay inside a sane triangle budget", () => {
  const { group } = createPhotoPlaza(null, { photo: photoFor(), surfaceAt: () => 0 });
  let tris = 0;
  for (const c of group.children) {
    if (!c.isInstancedMesh) continue;
    if (!/^(canopy-|pine-|euc-|ficus-|coral-)/.test(c.name)) continue;
    const idx = c.geometry.index;
    tris += ((idx ? idx.count : c.geometry.attributes.position.count) / 3) * c.count;
  }
  assert.ok(tris < 150000, `the 41 trees cost ${Math.round(tris)} triangles`);
});
