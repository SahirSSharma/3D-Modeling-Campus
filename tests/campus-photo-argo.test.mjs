/* Argo Hall's photo-sourced detail section.
 *
 * INVENTED class, so the gates are about quarantine and about not
 * contradicting the measured world:
 *
 *   - it is labelled a Revelle residence hall (NOT a Fleet hall), epoch-
 *     stamped, sourced, and it says what it left out;
 *   - colours are data, hex, and WHITE — the pre-2014 tan is a dead epoch;
 *   - the storey grid is the LiDAR height read back with zero residual, and
 *     the assumed 3.05 m anchor is declared [estimated];
 *   - bays are COUNTS against the measured ring, never absolute metres;
 *   - every facade hangs off two vertices of the measured 'Argo Hall' ring,
 *     and floats at most half a metre proud of that face;
 *   - the west face is [estimated], extends a named sourced pattern, and
 *     invents NO door;
 *   - the shipped staging route passes 1.6-2.3 m off the east face, so
 *     nothing solid crowds it and the sourced east planter stays absent;
 *   - the absent list does not shrink.
 *
 * The section lives under the `argo` key of docs/data/campus-photo-detail.json;
 * until the main session merges it, it is read from the build-side file the
 * Argo agent wrote, so this test does not depend on the merge having happened.
 * The fallback goes away with the merge, exactly as Keeling's did.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as THREE from "../docs/vendor/three/three.module.min.js";
import { createPhotoArgo } from "../docs/js/campus-photo-argo.js";
import { assembleMasses, roofElevation } from "../docs/js/campus-massing.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(p, "utf8"));

/* PHOTO_DETAIL lets a repair agent (or the merge review) run this whole file
   against a candidate section BEFORE it lands in the shipped document; unset,
   it gates the shipped document as always. */
const section = read(process.env.PHOTO_DETAIL || join(root, "docs/data/campus-photo-detail.json")).argo;

const campus = read(join(root, "docs/data/campus-3d.json"));
const staging = read(join(root, "docs/data/corridor-staging.json"));
const ring = campus.buildings.find((b) => b.n === "Argo Hall").p;

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

/* The maximum plan reach any facade layer is allowed off the measured wall. */
function maxReach() {
  const S = section.system;
  return Math.max(
    S.cant.depth,
    S.awning.proud + S.awning.depth / 2,
    S.ground.columnProud + S.ground.columnSize,
    S.parapet.proud + S.parapet.thickness + 0.06,
    S.corner.nubProud + S.corner.nub[2] / 2,
    S.corner.proud + S.corner.thickness
  );
}

/** Facade sample points at the wall and at full reach. */
function facadePoints() {
  const out = [];
  const reach = maxReach();
  for (const f of section.facades) {
    const nl = Math.hypot(f.out[0], f.out[1]);
    const nx = f.out[0] / nl;
    const nz = f.out[1] / nl;
    const n = Math.ceil(Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]) / 2);
    for (let i = 0; i <= n; i++) {
      const x = f.a[0] + ((f.b[0] - f.a[0]) * i) / n;
      const z = f.a[1] + ((f.b[1] - f.a[1]) * i) / n;
      for (const w of [0.05, reach]) out.push([x + nx * w, z + nz * w]);
    }
  }
  return out;
}

/** Every solid the section stands on the ground, as (x, z). */
function solids() {
  const N = section.ground.north;
  const out = [[N.planter.x, N.planter.z], [N.bench.x, N.bench.z]];
  const B = N.boardwalk;
  for (const x of [B.x0, B.x1]) for (const z of [B.z0, B.z1]) out.push([x, z]);
  return out;
}

/* ------------------------------------------------------------------ gates */

test("the section exists and is reachable", () => {
  assert.ok(section, "no argo section in the merged doc or the build-side file");
});

test("it says what it is: a Revelle residence hall, white epoch, sourced, honest", () => {
  assert.match(section.label, /Argo/);
  assert.match(section.label, /Revelle/);
  assert.match(section.label, /NOT a Fleet hall/, "Argo must not be misattributed to the Fleet");
  assert.ok(section.epoch, "no epoch stamp");
  assert.match(section.epoch, /dead epoch/i, "the pre-2014 tan must be named a dead epoch");
  assert.match(section.note, /INVENTED/, "the note must declare the class");
  assert.ok(Array.isArray(section.sources) && section.sources.length >= 6);
  for (const url of section.sources) assert.match(url, /^https:\/\//);
  assert.ok(Array.isArray(section.absent) && section.absent.length >= 10,
    `absent has ${section.absent?.length} entries — better absent than wrong, and this list does not shrink`);
  for (const gap of section.absent) assert.equal(typeof gap, "string");
  assert.ok(section.absent.some((a) => /mural/i.test(a)), "the El Mac mural must stay declared");
  assert.ok(section.absent.some((a) => /planter/i.test(a) && /route/i.test(a)),
    "the east planter withheld for the route must stay on the record");
  assert.ok(section.absent.some((a) => /loading|trash|service/i.test(a)),
    "the unsourced service condition must stay declared");
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
  const spread = (hex) => {
    const c = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    return Math.max(...c) - Math.min(...c);
  };
  assert.ok(luma(section.colors.precast) > 170, "the 2015 repaint precast reads WHITE");
  assert.ok(spread(section.colors.precast) < 35, "the precast is near-neutral, not tan");
  assert.ok(luma(section.colors.groundRecess) < 60, "the colonnade recess reads near-black");
});

test("the storey grid is the LiDAR height read back, and the anchor is declared", () => {
  const g = section.grid;
  const mass = section.measured.mass;
  if (mass) {
    /* v3: the shell solves on the DRAWN mass — the exact arcgis ring + LiDAR
       massHeights pair campus-massing.js extrudes — so the parapet closes
       against the visible deck. campus-3d's 22.8 h for this ring is the OSM
       levels guess, not a measurement; solved on it, the whole top storey
       stood proud of the deck as a see-through screen (2026-08-17 audit). */
    const lidarFile = read(join(root, "docs/data/campus-lidar.json"));
    const arcgis = read(join(root, "docs/data/campus-arcgis.json"));
    const drawn = assembleMasses({ campus, lidar: lidarFile, arcgis, colors: null })
      .find((m) => m.name === "Argo Hall" && m.src === "gis");
    assert.ok(drawn, "no drawn 'Argo Hall' gis mass — the deck the shell must close against is gone");
    assert.equal(mass.h, drawn.h, "measured.mass.h drifted from the height campus-massing.js extrudes");
    assert.deepEqual(mass.ring, drawn.rings[0],
      "measured.mass.ring must be the drawn mass's outer ring, byte for byte");
    assert.equal(section.measured.lidarHeight, lidarFile.heights["Argo Hall"],
      "lidarHeight must be the LiDAR read of the survey ring, not campus-3d's OSM levels guess");
    assert.ok(Math.abs(g.storeys * g.floorToFloor + g.parapet - mass.h) < 1e-9,
      `${g.storeys} x ${g.floorToFloor} + ${g.parapet} != drawn-mass height ${mass.h}`);
    assert.ok(section.system.ground.glazingHeight <= g.floorToFloor - section.system.ground.soffitFascia,
      "the ground glazing must fit under the first floor's soffit");
  } else {
    /* pre-merge shape: the shipped document has not carried the mass block
       yet, and still solves on campus-3d's h. */
    const measured = campus.buildings.find((b) => b.n === "Argo Hall").h;
    assert.equal(section.measured.lidarHeight, measured, "the section's height drifted from the survey");
    assert.ok(Math.abs(g.storeys * g.floorToFloor + g.parapet - measured) < 1e-9,
      `${g.storeys} x ${g.floorToFloor} + ${g.parapet} != measured ${measured}`);
  }
  assert.equal(g.storeys, 6, "six levels: 5 fin storeys over the ground colonnade");
  assert.equal(g.finStoreys, 5);
  /* The assumed 3.05 m anchor stays on the record as [estimated] so a future
     drawing can correct it. */
  assert.match(g.anchorNote, /3\.05/, "the assumed anchor must be named");
  assert.match(g.anchorNote, /\[estimated\]/, "and declared estimated");
});

test("bays are counts against the measured ring, not absolute metres", () => {
  const g = section.grid;
  assert.equal(g.longFaceBays, 30, "~30 bays per elevation [measured, foreshortening-immune]");
  for (const f of section.facades) {
    const len = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]);
    const module = len / g.longFaceBays;
    assert.ok(module > 1.15 && module < 1.4,
      `${f.id}: module ${module.toFixed(3)} m is off the measured ~1.28 m read`);
  }
  const B = section.system.bands;
  assert.ok(Math.abs(B.spandrelFrac + B.awningFrac + B.windowFrac - 1) < 0.01,
    "the storey band fractions must fill the storey");
  assert.ok(section.system.window.widthFrac <= 0.7,
    "Argo's window is the NARROW one — 0.66 of the bay, not Blake's glazed panel");
});

test("the seat ring is the survey's FULL ring, copied verbatim", () => {
  /* The module seats on the rim median of measured.ring, exactly like
     campus-massing.js roofElevation. The 4 facade endpoints alone median
     0.25 m high on Argo's sloped site — which floated the colonnade and
     topped the parapet above the measured 22.8 m roof. */
  assert.deepEqual(section.measured.ring, ring,
    "measured.ring must be the full Argo Hall survey ring, byte for byte");
  assert.match(section.measured.ringNote, /campus-massing|roofElevation/,
    "the ring copy must say what seat it exists for");
});

test("every facade hangs off two vertices of the measured ring", () => {
  const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const cz = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  for (const f of section.facades) {
    for (const p of [f.a, f.b]) {
      assert.ok(ring.some(([x, z]) => x === p[0] && z === p[1]),
        `${f.id}: ${JSON.stringify(p)} is not a vertex of the Argo Hall ring`);
    }
    assert.notDeepEqual(f.a, f.b, `${f.id} is a zero-length face`);
    const mx = (f.a[0] + f.b[0]) / 2 - cx;
    const mz = (f.a[1] + f.b[1]) / 2 - cz;
    assert.ok(mx * f.out[0] + mz * f.out[1] > 0, `${f.id}'s normal points into the building`);
    assert.equal(f.finStoreys, section.grid.finStoreys, `${f.id} disagrees with the grid`);
    assert.match(f.source, /\w/, `${f.id} has no source`);
  }
  assert.equal(section.facades.length, 4, "a square doughnut wears four outer faces");
});

test("the west face is an honest estimate that invents no door", () => {
  const west = section.facades.find((f) => f.id === "west");
  assert.equal(west.estimated, true, "west is [estimated] and must say so");
  assert.ok(section.facades.some((f) => f.id === west.patternRef && !f.estimated),
    "the estimate must name a SOURCED face as its pattern");
  assert.match(west.source, /\[estimated\]/);
  assert.match(west.source, /NO (entrance or service )?door/i,
    "whether the west face has a door is unknown — none may be invented");
  for (const f of section.facades.filter((x) => x.id !== "west")) {
    assert.notEqual(f.estimated, true, `${f.id} is sourced, not estimated`);
  }
});

test("no facade layer floats more than half a metre off the measured wall", () => {
  assert.ok(maxReach() <= 0.6,
    `a facade layer reaches ${maxReach().toFixed(2)} m — the route passes 1.6 m off the east face`);
});

test("nothing solid crowds the staging route that hugs the east face", () => {
  let worst = Infinity;
  let at = null;
  for (const [x, z] of [...facadePoints(), ...solids()]) {
    const d = toRoute(x, z);
    if (d < worst) { worst = d; at = [x, z]; }
  }
  assert.ok(worst >= 1.0,
    `closest solid is ${worst.toFixed(2)} m from the centreline at ${at} — the ride must clear Argo`);
});

test("nothing invented sits inside a measured building footprint", () => {
  const rings = campus.buildings.filter((b) => b.p && b.p.length >= 3);
  for (const [x, z] of solids()) {
    for (const b of rings) {
      assert.ok(!inRing(x, z, b.p), `(${x}, ${z}) is inside ${b.n || "an unnamed mass"}`);
    }
  }
});

test("the roof is a plan-measured, height-estimated read that stays on the roof", () => {
  const R = section.roof;
  assert.match(R.source, /\[estimated\]/i, "roof heights must be declared estimated");
  assert.equal(R.curbs.items.length, 10, "10 square mechanical curbs [measured plan, ortho]");
  const W = R.lightWell;
  assert.ok(Math.abs((W.x1 - W.x0) - 15.9) < 1 && Math.abs((W.z1 - W.z0) - 16.1) < 1,
    "the light-well inner opening is the measured ~15.9 x 16.1 m square");
  assert.ok(section.roof.core.x0 <= W.x0 + 0.1,
    "the core block sits HARD against the WEST side of the well [measured, ortho]");
  assert.ok(R.trellis.z1 - R.trellis.z0 < (W.z1 - W.z0) / 2,
    "the trellis is a strip along the north edge, not a span of the whole well");
  const inset = (x, z) => inRing(x, z, ring);
  for (const [x, z] of [[W.x0, W.z0], [W.x1, W.z1], [R.core.x0, R.core.z0], [R.core.x1, R.core.z1], [R.tree.x, R.tree.z]]) {
    assert.ok(inset(x, z), `roof feature at (${x}, ${z}) runs off the measured ring`);
  }
  for (const c of R.curbs.items) {
    assert.ok(inset(c.x, c.z), `curb at (${c.x}, ${c.z}) runs off the measured ring`);
  }
  assert.ok(R.curbs.height <= 0.8, "curb heights are estimated LOW — nothing gives them");
});

test("the signage is recorded, not rendered", () => {
  assert.equal(section.signage.built, false);
  assert.equal(section.signage.text, "ARGO HALL");
  assert.equal(section.signage.face, "east");
  assert.ok(section.signage.capHeight > 0.2 && section.signage.capHeight < 0.5);
});

/* ------------------------------------------- the module, actually running */

const flat = () => 20;
const build = (g = flat) => createPhotoArgo(null, { photo: { argo: section }, heightAt: g, surfaceAt: g });

test("the module builds the section: structure and counts", () => {
  const { group, counts } = build();
  assert.equal(counts.facades, 4);
  assert.equal(counts.bays, 30);
  assert.equal(counts.windows, 4 * 5 * 30, "a window in every bay of every fin storey of every face");
  assert.equal(counts.reveals, 2 * counts.windows, "two canted reveals per window — the sawtooth");
  assert.equal(counts.awnings, counts.windows, "a bottom-hinged sash under every window");
  assert.equal(counts.curbs, 10);
  assert.ok(counts.columns >= 4 * 8, "the ground colonnade rings the building");
  assert.ok(group.children.find((c) => c.name === "argo-facades"), "no facades group");
  assert.ok(group.children.find((c) => c.name === "argo-roof"), "no roof group");
  assert.ok(group.children.find((c) => c.name === "argo-ground"), "no ground group");
  const missing = createPhotoArgo(null, { photo: {}, heightAt: flat, surfaceAt: flat });
  assert.deepEqual(missing.counts, {}, "a missing section builds nothing and breaks nothing");
});

test("everything seats on a ROLLING surface — nothing floats, nothing buries", () => {
  /* Flat fake samplers hid real floaters before; this one rolls. */
  const sloped = (x, z) => 20 + 1.2 * Math.sin(x / 14) + 0.9 * Math.cos(z / 17);
  const { group } = build(sloped);
  group.updateMatrixWorld(true);

  /* The expected seat is NOT re-derived from the module's own maths: it is
     campus-massing.js roofElevation over the DRAWN mass's ring and height —
     the rule and the exact inputs the visible extrusion uses — falling back
     to the survey ring + lidarHeight for a pre-merge section shape. */
  const M = section.measured;
  const h = M.mass?.h ?? M.lidarHeight;
  const roofY = roofElevation(M.mass?.ring ?? M.ring, h, sloped);
  const baseY = roofY - h;

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
  each(group.children.find((c) => c.name === "argo-facades"), (x, y, z, sy, o) => {
    if (o.name === "ground-columns" || o.name === "ground-recess") {
      /* Ground-storey elements stand ON the terrain: their bottoms must be
         at or under the drawn surface at their own (x, z) — this is the
         check that catches a colonnade hanging 0.6 m in the air. */
      const bottom = y - sy / 2;
      const g = sloped(x, z);
      assert.ok(bottom <= g + 0.01,
        `${o.name} bottom ${bottom.toFixed(2)} floats over the drawn surface ${g.toFixed(2)} at (${x.toFixed(1)}, ${z.toFixed(1)})`);
      assert.ok(bottom >= baseY - 4, `${o.name} plunges to ${bottom.toFixed(2)} — a runaway skirt`);
      if (o.name === "ground-columns") columns++;
    } else {
      assert.ok(y >= baseY - 0.1, `a facade element sits at y=${y.toFixed(2)}, under the building base ${baseY.toFixed(2)}`);
    }
    assert.ok(y <= roofY + 0.1, `a facade element floats at y=${y.toFixed(2)}, over the measured top ${roofY.toFixed(2)}`);
    maxTop = Math.max(maxTop, y + sy / 2);
    checked++;
  });
  assert.ok(columns >= 4 * 8, `only ${columns} columns seated — the colonnade check did not run`);
  assert.ok(Math.abs(maxTop - roofY) <= 0.05,
    `the facade tops out at ${maxTop.toFixed(2)} against the massing's ${roofY.toFixed(2)} — the seat is not campus-massing's`);
  each(group.children.find((c) => c.name === "argo-roof"), (x, y) => {
    assert.ok(y >= roofY - 0.05, `a roof item dips to y=${y.toFixed(2)} into the massing`);
    assert.ok(y <= roofY + 4, `a roof item floats at y=${y.toFixed(2)} over the roofscape`);
    checked++;
  });
  each(group.children.find((c) => c.name === "argo-ground"), (x, y, z) => {
    const g = sloped(x, z);
    assert.ok(y >= g - 0.3, `a ground item at (${x.toFixed(1)}, ${z.toFixed(1)}) sits ${(g - y).toFixed(2)} m under the drawn surface`);
    assert.ok(y <= g + 2.5, `a ground item at (${x.toFixed(1)}, ${z.toFixed(1)}) floats ${(y - g).toFixed(2)} m over the drawn surface`);
    checked++;
  });
  assert.ok(checked > 2000, `only ${checked} placements checked — the facade loops did not run`);
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
  const src = readFileSync(join(root, "docs/js/campus-photo-argo.js"), "utf8");
  assert.match(src, /(?:shared|create)MaterialLibrary/, "surfaces come from campus-materials.js");
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
  /* The colonnade recess is the photographed near-black VOID: matte and
     opaque, so lighting cannot lift it into a pale glazed screen. */
  let recess = null;
  group.traverse((o) => { if (o.name === "ground-recess") recess = o; });
  assert.ok(recess, "no ground-recess mesh");
  assert.ok(!recess.material.transparent && recess.material.roughness >= 0.9,
    "the colonnade recess must be a matte opaque plane, not glazing");
});
