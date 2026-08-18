/* Blake Hall's photo-sourced detail section.
 *
 * INVENTED class. Blake is Argo's sibling — same family language, a DIFFERENT
 * module — and the inventory is explicit that copying Argo's rhythm onto
 * Blake is wrong, so beyond the quarantine gates this file gates the
 * DIFFERENCE:
 *
 *   - the storey grid is the DRAWN mass's own 12.4 m LiDAR height read back
 *     with zero residual (4 x 2.8 + 1.2); the campus-3d builder's 15.6 m on
 *     the suppressed OSM ring is a losing read that stays on the record, and
 *     the assumed 3.05 m anchor is declared [estimated];
 *   - bays are COUNTS against the drawn ring — the photo-derived 58 m
 *     south elevation lost to the 37.5 m ring and the section says so;
 *   - Blake's bay carries a LARGE glazed panel (0.85) against Argo's narrow
 *     window (0.66), 2 fin storeys against Argo's 5, and a penthouse;
 *   - the east end is a glazed grid, not the fin field;
 *   - the 2013 west-end frames are geometry-only — pre-repaint colour is dead;
 *   - the set-back penthouse cannot be carved from the flat-topped extrusion
 *     and is DECLARED absent, not faked;
 *   - the north road's dumpsters belong to Machining & Additive Prototyping
 *     Services and stay off Blake's record.
 *
 * The section lives under the `blake` key of docs/data/campus-photo-detail.json;
 * until the main session merges it, it is read from the build-side file, so
 * this test does not depend on the merge. The fallback goes away with the
 * merge, exactly as Keeling's did.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as THREE from "../docs/vendor/three/three.module.min.js";
import { createPhotoBlake } from "../docs/js/campus-photo-blake.js";
import { roofElevation, assembleMasses } from "../docs/js/campus-massing.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(p, "utf8"));

/* PHOTO_DETAIL lets a repair agent (or the merge review) run this whole file
   against a candidate document before it is merged — same convention as
   Argo's test. */
const merged = read(process.env.PHOTO_DETAIL || join(root, "docs/data/campus-photo-detail.json"));
const section = merged.blake;
const argo = merged.argo;

/* v3 sections register to the DRAWN mass (arcgis ring + per-mass LiDAR
   height) and carry the drawn courtyard well; the pre-merge shipped shape
   still registers to the suppressed campus-3d ring and its 15.6 m. The
   dual shape goes away when the merge lands, exactly as Argo's did. */
const V3 = Boolean(section?.measured?.courtyardRing);

const campus = read(join(root, "docs/data/campus-3d.json"));
const staging = read(join(root, "docs/data/corridor-staging.json"));
const lidar = read(join(root, "docs/data/campus-lidar.json"));

/* The ring that RENDERS is the university's massing ring — campus-massing.js
   extrudes it (with its inner courtyard well) and suppresses the OSM ring
   underneath. The photo detail must register to the drawn mass, not to the
   suppressed ring: the audit caught the roofscape hovering 3.2 m over the
   drawn roof because the section was built on the OSM side's 15.6 m. */
const arcgis = read(join(root, "docs/data/campus-arcgis.json"));
const drawn = assembleMasses({ campus, lidar, arcgis, colors: null })
  .find((m) => m.name === "Blake Hall" && m.src === "gis");
const ring = V3 ? drawn.rings[0] : campus.buildings.find((b) => b.n === "Blake Hall").p;
const well = drawn.rings[1];

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

/** Every solid the section stands on the ground, as (x, z). */
function solids() {
  const S = section.ground.south;
  const out = [];
  const L = S.lavaWall;
  const n = Math.ceil(Math.hypot(L.b[0] - L.a[0], L.b[1] - L.a[1]) / 2);
  for (let i = 0; i <= n; i++) {
    out.push([L.a[0] + ((L.b[0] - L.a[0]) * i) / n, L.a[1] + ((L.b[1] - L.a[1]) * i) / n]);
  }
  return out;
}

/* ------------------------------------------------------------------ gates */

test("the section exists and is reachable", () => {
  assert.ok(section, "no blake section in the merged doc or the build-side file");
  assert.ok(argo, "the sibling gates need the argo section too");
});

test("it says what it is: a Revelle residence hall, white epoch, sourced, honest", () => {
  assert.match(section.label, /Blake/);
  assert.match(section.label, /Revelle/);
  assert.match(section.label, /NOT a Fleet hall/);
  assert.match(section.label, /DIFFERENT module/i, "the sibling distinction is the label's job too");
  assert.ok(section.epoch, "no epoch stamp");
  assert.match(section.epoch, /geometry only/i, "the 2013 pre-repaint frames are geometry-only");
  assert.match(section.note, /INVENTED/);
  assert.ok(Array.isArray(section.sources) && section.sources.length >= 6);
  for (const url of section.sources) assert.match(url, /^https:\/\//);
  assert.ok(Array.isArray(section.absent) && section.absent.length >= 9,
    `absent has ${section.absent?.length} entries — this list does not shrink`);
  assert.ok(section.absent.some((a) => /penthouse/i.test(a)),
    "the uncarvable penthouse must stay declared");
  assert.ok(section.absent.some((a) => /Machining/i.test(a)),
    "the dumpster misattribution guard must stay on the record");
  assert.ok(section.absent.some((a) => /umbrella/i.test(a)), "the movable umbrellas stay absent");
});

test("colours are data, hex, and the repaint whites — no dead-epoch tan", () => {
  const entries = Object.entries(section.colors);
  assert.ok(entries.length >= 15, `only ${entries.length} colours`);
  for (const [k, v] of entries) {
    assert.match(v, /^#[0-9a-f]{6}$/, `${k} is not a lowercase 6-digit hex`);
    assert.notEqual(v, "#c9bca0", `${k} is the pre-2014 tan — a dead epoch`);
  }
  const luma = (hex) =>
    0.299 * parseInt(hex.slice(1, 3), 16) + 0.587 * parseInt(hex.slice(3, 5), 16) + 0.114 * parseInt(hex.slice(5, 7), 16);
  assert.ok(luma(section.colors.precast) > 170, "the repaint precast reads WHITE");
  assert.equal(section.colors.precast, argo.colors.precast,
    "per the inventory, Blake's base white IS Argo's daylight precast value");
  /* The backlit Jul 2022 Street View samples are unusable and must not appear. */
  for (const dead of ["#5b595e", "#6d6863"]) {
    for (const [k, v] of entries) assert.notEqual(v, dead, `${k} is a backlit sample`);
  }
  assert.ok(luma(section.colors.lavaRock) < 120, "the lava rock is dark volcanic rubble");
});

test("the storey grid is the LiDAR height read back, and the seat is the drawn mass's", () => {
  const g = section.grid;
  if (V3) {
    /* The drawn mass's own height: the per-mass 2014 roof plane, which is
       also the per-name LiDAR height and the height campus-massing.js
       extrudes. The campus-3d builder's 15.6 m on the suppressed OSM ring is
       the LOSING read and must stay recorded, not built — solved on it, the
       whole roofscape hung 3.2 m over the drawn roof (2026-08-17 audit). */
    assert.equal(drawn.h, lidar.heights["Blake Hall"],
      "the drawn mass's height is no longer the per-name LiDAR read — rekey the section");
    assert.equal(section.measured.lidarHeight, drawn.h,
      "lidarHeight must be the height campus-massing.js extrudes");
    assert.match(section.measured.heightNote, /15\.6/,
      "the losing 15.6 m read stays on the record");
    assert.ok(section.system.ground.glazingHeight <= g.floorToFloor - section.system.ground.soffitFascia,
      "the ground glazing must fit under the first floor's soffit");
  } else {
    assert.equal(section.measured.lidarHeight, campus.buildings.find((b) => b.n === "Blake Hall").h);
  }
  assert.ok(Math.abs(g.storeys * g.floorToFloor + g.parapet - section.measured.lidarHeight) < 1e-9,
    `${g.storeys} x ${g.floorToFloor} + ${g.parapet} != measured ${section.measured.lidarHeight}`);
  assert.equal(g.storeys, 4, "four levels: colonnade, 2 fin storeys, penthouse");
  assert.equal(g.finStoreys, 2);
  assert.match(g.anchorNote, /3\.05/);
  assert.match(g.anchorNote, /\[estimated\]/);
  assert.match(g.penthouseNote, /absent/i, "the flat-top compromise must be written down");
});

test("bays are counts against the measured ring — the 58 m read lost to the ring", () => {
  const g = section.grid;
  assert.equal(g.longFaceBays, 30, "~30-31 bays [measured, near-orthographic]");
  assert.match(g.bayNote, V3 ? /37\.5/ : /37\.0|37 /, "the winning ring length must be named");
  assert.match(g.bayNote, /58/, "and the losing photo-derived one");
  for (const f of section.facades) {
    const len = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]);
    const module = len / g.longFaceBays;
    assert.ok(module > 1.1 && module < 1.35,
      `${f.id}: module ${module.toFixed(3)} m is off the ring/count read`);
  }
});

test("the sibling difference survives: Blake is not Argo at another address", () => {
  assert.ok(section.system.panel.widthFrac >= 0.8,
    "Blake's bay carries a LARGE glazed panel filling most of the bay");
  assert.ok(argo.system.window.widthFrac <= 0.7,
    "Argo's bay carries a NARROW window");
  assert.ok(section.system.panel.widthFrac - argo.system.window.widthFrac >= 0.15,
    "the per-bay difference is the single most important distinction and must stay legible");
  assert.equal(section.grid.finStoreys, 2);
  assert.equal(argo.grid.finStoreys, 5);
  assert.ok(section.system.fin.proud > 0.15, "Blake's fins project — faceted, with a return");
  assert.ok(section.system.fin.returnWidth < section.system.fin.width,
    "the return is the NARROW facet");
});

test("the seat ring is the ring the massing DRAWS, copied verbatim, well included", () => {
  /* The module seats on the rim median of measured.ring, exactly like
     campus-massing.js roofElevation — over the SAME point list the extruder
     iterates (v3: closing vertex included), so the median is
     sample-for-sample the drawn roof plane's. */
  assert.deepEqual(section.measured.ring, ring,
    "measured.ring must be the ring the massing draws for Blake Hall, byte for byte");
  if (V3) {
    assert.deepEqual(section.measured.courtyardRing, well,
      "the drawn inner ring (the courtyard well) must be carried verbatim too");
  }
  assert.match(section.measured.ringNote, /campus-massing|roofElevation/,
    "the ring copy must say what seat it exists for");
});

test("the colonnade's reach beyond its sourced south face is declared", () => {
  /* Only the south face sources an OPEN colonnade; building it on the other
     three is a pattern extension and must say so, like Argo's west face. */
  assert.match(section.system.ground.note, /SOURCED only on the south/i,
    "the colonnade's single sourced face must be named");
  assert.match(section.system.ground.note, /\[estimated\]/,
    "the extension to the other faces must be declared estimated");
});

test("every facade hangs off two vertices of the measured ring", () => {
  const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const cz = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  for (const f of section.facades) {
    for (const p of [f.a, f.b]) {
      assert.ok(ring.some(([x, z]) => x === p[0] && z === p[1]),
        `${f.id}: ${JSON.stringify(p)} is not a vertex of the Blake Hall ring`);
    }
    assert.notDeepEqual(f.a, f.b, `${f.id} is a zero-length face`);
    const mx = (f.a[0] + f.b[0]) / 2 - cx;
    const mz = (f.a[1] + f.b[1]) / 2 - cz;
    assert.ok(mx * f.out[0] + mz * f.out[1] > 0, `${f.id}'s normal points into the building`);
    assert.match(f.source, /\w/, `${f.id} has no source`);
  }
  assert.equal(section.facades.length, 4);
  /* All four faces are sourced — Blake's ladder closed on every elevation. */
  for (const f of section.facades) assert.notEqual(f.estimated, true, `${f.id} is sourced`);
});

test("the east end is the glazed grid the photographs show, and the west is geometry-only", () => {
  const east = section.facades.find((f) => f.id === "east");
  assert.equal(east.kind, "glazedGrid", "the end wall is treated differently from the long faces");
  assert.match(east.source, /9259|photosphere/i, "the east source carries its own identification");
  const west = section.facades.find((f) => f.id === "west");
  assert.match(west.source, /geometry only, never colour|geometry only/i,
    "the 2013 pre-repaint frames may decide shape, never colour");
  for (const id of ["south", "north"]) {
    assert.equal(section.facades.find((f) => f.id === id).kind, "panel");
  }
});

test("the roof read stays on the roof, plan measured and height estimated", () => {
  const R = section.roof;
  assert.match(R.source, /\[estimated\]/i);
  const inset = (x, z) => inRing(x, z, ring);
  const W = R.courtyard;
  for (const [x, z] of [[W.x0, W.z0], [W.x1, W.z1]]) {
    assert.ok(inset(x, z), `courtyard corner (${x}, ${z}) runs off the measured ring`);
  }
  /* The decal must REGISTER to the drawn well in plan: its rect is exactly
     the bounding box of the drawn inner ring, so the cap (oversized by the
     kerb width in the module) leaves no sliver of the open well visible.
     The audit caught a rect 5 m south of the drawn opening. */
  if (V3) {
    const xs = well.map((p) => p[0]);
    const zs2 = well.map((p) => p[1]);
    assert.equal(W.x0, Math.min(...xs), "courtyard x0 is off the drawn well");
    assert.equal(W.x1, Math.max(...xs), "courtyard x1 is off the drawn well");
    assert.equal(W.z0, Math.min(...zs2), "courtyard z0 is off the drawn well");
    assert.equal(W.z1, Math.max(...zs2), "courtyard z1 is off the drawn well");
  }
  assert.match(W.note, /\[estimated\]/, "the courtyard read is an estimate from Argo's pattern");
  assert.match(W.note, /Argo/, "and must name the pattern it extends");
  for (const t of W.trees) assert.ok(inset(t.x, t.z), "a courtyard tree runs off the ring");
  const P = R.pv;
  for (const [x, z] of [[P.x0, P.z0], [P.x1, P.z1]]) {
    assert.ok(inset(x, z), `PV corner (${x}, ${z}) runs off the measured ring`);
  }
  const zs = ring.map((p) => p[1]);
  const zMid = (Math.min(...zs) + Math.max(...zs)) / 2;
  assert.ok(P.z1 < zMid, "the PV array is on the NORTH roof plate [measured, ortho]");
});

test("the lava-rock terrace wall is Blake's base, at its measured height, off the route", () => {
  const S = section.ground.south;
  assert.ok(S.lavaWall.height >= 1.2 && S.lavaWall.height <= 1.5,
    "the wall is the measured 1.2-1.5 m");
  assert.match(S.lavaWall.note, /no coping/i, "rough stone throughout — no coping");
  assert.match(S.terrace.note, /\[estimated\]/, "the terrace lift is declared estimated");
  const rings = campus.buildings.filter((b) => b.p && b.p.length >= 3);
  for (const [x, z] of solids()) {
    for (const b of rings) {
      assert.ok(!inRing(x, z, b.p), `(${x}, ${z}) is inside ${b.n || "an unnamed mass"}`);
    }
    assert.ok(toRoute(x, z) >= 3, "the wall stays clear of the staging route");
  }
});

test("the signage is recorded, not rendered", () => {
  assert.equal(section.signage.built, false);
  assert.equal(section.signage.text, "Blake Hall");
  assert.ok(section.signage.capHeight > argo.signage.capHeight,
    "Blake's lettering is the larger of the two [measured]");
});

/* ------------------------------------------- the module, actually running */

const flat = () => 20;
const build = (g = flat) => createPhotoBlake(null, { photo: { blake: section }, heightAt: g, surfaceAt: g });

test("the module builds the section: structure and counts", () => {
  const { group, counts } = build();
  assert.equal(counts.facades, 4);
  assert.equal(counts.bays, 30);
  assert.equal(counts.windows, 3 * 2 * 30 + 1,
    "a glazed panel per bay on the three panel faces, one grid field on the east");
  assert.equal(counts.awnings, 3 * 2 * 30, "a full-width sash under every panel");
  assert.equal(counts.fins, 3 * 2 * 31, "fins on every bay boundary of the panel faces");
  assert.ok(counts.mullions > 0, "the east grid has mullions");
  assert.ok(counts.pv >= 20, "the north-plate PV array is built");
  assert.equal(counts.courtyardTrees, section.roof.courtyard.trees.length);
  assert.ok(counts.lavaRocks > 100, "the rubble wall is built from rocks, not a slab");
  assert.ok(group.children.find((c) => c.name === "blake-facades"), "no facades group");
  assert.ok(group.children.find((c) => c.name === "blake-roof"), "no roof group");
  assert.ok(group.children.find((c) => c.name === "blake-ground"), "no ground group");
  const missing = createPhotoBlake(null, { photo: {}, heightAt: flat, surfaceAt: flat });
  assert.deepEqual(missing.counts, {}, "a missing section builds nothing and breaks nothing");
});

test("everything seats on a ROLLING surface — nothing floats, nothing buries", () => {
  /* Flat fake samplers hid real floaters before; this one rolls. */
  const sloped = (x, z) => 20 + 1.2 * Math.sin(x / 14) + 0.9 * Math.cos(z / 17);
  const { group } = build(sloped);
  group.updateMatrixWorld(true);

  /* The expected seat is NOT re-derived from the module's own maths: it is
     campus-massing.js roofElevation over the FULL measured ring. */
  const roofY = roofElevation(section.measured.ring, section.measured.lidarHeight, sloped);
  const baseY = roofY - section.measured.lidarHeight;

  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const each = (node, fn) => {
    node.traverse((o) => {
      if (o.isInstancedMesh) {
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, m);
          m.decompose(pos, q, sc);
          fn(pos.x, pos.y, pos.z, sc.y, o);
        }
      } else if (o.isMesh) {
        fn(o.position.x, o.position.y, o.position.z, o.scale.y, o);
      }
    });
  };

  let checked = 0;
  let maxTop = -Infinity;
  let columns = 0;
  each(group.children.find((c) => c.name === "blake-facades"), (x, y, z, sy, o) => {
    if (o.name === "ground-columns" || o.name === "ground-recess") {
      /* Ground-storey elements stand ON the terrain: their bottoms must be
         at or under the drawn surface at their own (x, z). */
      const bottom = y - sy / 2;
      const g = sloped(x, z);
      assert.ok(bottom <= g + 0.01,
        `${o.name} bottom ${bottom.toFixed(2)} floats over the drawn surface ${g.toFixed(2)} at (${x.toFixed(1)}, ${z.toFixed(1)})`);
      assert.ok(bottom >= baseY - 4, `${o.name} plunges to ${bottom.toFixed(2)} — a runaway skirt`);
      if (o.name === "ground-columns") columns++;
    } else {
      assert.ok(y >= baseY - 0.1, `a facade element sits at y=${y.toFixed(2)}, under the base ${baseY.toFixed(2)}`);
    }
    assert.ok(y <= roofY + 0.1, `a facade element floats at y=${y.toFixed(2)}, over the measured top ${roofY.toFixed(2)}`);
    maxTop = Math.max(maxTop, y + sy / 2);
    checked++;
  });
  assert.ok(columns >= 4 * 8, `only ${columns} columns seated — the colonnade check did not run`);
  assert.ok(Math.abs(maxTop - roofY) <= 0.05,
    `the facade tops out at ${maxTop.toFixed(2)} against the massing's ${roofY.toFixed(2)} — the seat is not campus-massing's`);
  each(group.children.find((c) => c.name === "blake-roof"), (x, y) => {
    assert.ok(y >= roofY - 0.05, `a roof item dips to y=${y.toFixed(2)} into the massing`);
    assert.ok(y <= roofY + 4, `a roof item floats at y=${y.toFixed(2)} over the roofscape`);
    checked++;
  });
  const T = section.ground.south.terrace;
  each(group.children.find((c) => c.name === "blake-ground"), (x, y, z, sy, o) => {
    const g = sloped(x, z);
    const lift = o.name === "terrace-lawn" ? T.lift : 0;
    assert.ok(y >= g - 0.3, `a ground item at (${x.toFixed(1)}, ${z.toFixed(1)}) sits under the drawn surface`);
    assert.ok(y <= g + lift + 2.0, `a ground item at (${x.toFixed(1)}, ${z.toFixed(1)}) floats over the drawn surface`);
    checked++;
  });
  assert.ok(checked > 800, `only ${checked} placements checked — the facade loops did not run`);
});

test("two builds are byte-identical — no hidden randomness", () => {
  const a = build();
  const b = build();
  assert.deepEqual(a.counts, b.counts);
  const sig = (r) => {
    const out = [];
    r.group.traverse((o) => {
      if (o.isInstancedMesh) out.push(Array.from(o.instanceMatrix.array));
      else if (o.isMesh) out.push([o.position.x, o.position.y, o.position.z]);
    });
    return out;
  };
  assert.deepEqual(sig(a), sig(b));
});

test("the material library is on the surfaces, and only deterministic sources", () => {
  const src = readFileSync(join(root, "docs/js/campus-photo-blake.js"), "utf8");
  assert.match(src, /createMaterialLibrary/, "surfaces come from campus-materials.js");
  assert.ok(!/Math\.random|Date\.now/.test(src), "no nondeterminism in the builder");
  const { group } = build();
  let textured = 0;
  let glass = 0;
  group.traverse((o) => {
    if (o.isMesh && o.material) {
      if (o.material.map && o.material.roughnessMap) textured++;
      if (o.material.transparent && o.material.opacity < 1) glass++;
    }
  });
  assert.ok(textured >= 10, `only ${textured} textured meshes — the library is not applied`);
  assert.ok(glass >= 2, "the glazing does not carry the library's glass");
});
