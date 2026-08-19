/* Azad Hall's photo-sourced detail section.
 *
 * INVENTED class, so the gates are about quarantine, about provenance, and
 * about not contradicting the measured world:
 *
 *   - it is labelled, epoch-stamped, sourced with DATED sources, it carries a
 *     per-role colour provenance block, and it says what it left out;
 *   - the anchor is the DRAWN mass: measured.mass.ring is campus-arcgis.json
 *     massing[452] byte for byte at /10, and measured.mass.h is the GIS 27.4 m
 *     — the height campus-massing.js actually extrudes. NO LiDAR massHeight is
 *     read, and the test proves none exists (the 2014 flight is blind here);
 *   - every facade hangs on two points ON that ring and its outward normal
 *     genuinely leaves the polygon;
 *   - the sourceless WEST end is [estimated] and names the sourced face it
 *     extends; the roof mechanical is [estimated] and names its pattern;
 *   - NOTHING HOVERS: every roof item's footprint is inside the ring, the
 *     clipped cross band is genuinely SHORTER than its bounding box would be
 *     (the clip is asserted by its consequence, not by its existence), no
 *     facade layer floats more than a metre proud, and ground objects seat on
 *     a ROLLING sampler;
 *   - and NOTHING INTERSECTS, which is the other half of the same rule and the
 *     half the first build had no gate for at all: every thing that stands on
 *     the ground is swept against every other one as an oriented box, and one
 *     centimetre of interpenetration fails. It found three real defects — the
 *     hedge through seven colonnade columns, the guardrail through a planter
 *     cube, the standpipe buried in its own hedge — none of which any other
 *     gate could see. Facade LAYERS are excluded on purpose: a mullion is meant
 *     to be coincident with the glass it holds. Things on the ground are not;
 *   - the module builds deterministically and wears the material library;
 *   - and the roof carries ZERO photovoltaics, with the absent entry naming the
 *     frame — the Keeling trap running the other way.
 *
 * The section lives under the `azad` key of campus-photo-detail.json.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as THREE from "../docs/vendor/three/three.module.min.js";
import { createPhotoAzad } from "../docs/js/campus-photo-azad.js";
import { assembleMasses, roofElevation } from "../docs/js/campus-massing.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(p, "utf8"));

const shipped = read(process.env.PHOTO_DETAIL || join(root, "docs/data/campus-photo-detail.json"));
const section = shipped.azad;

const campus = read(join(root, "docs/data/campus-3d.json"));
const lidarFile = read(join(root, "docs/data/campus-lidar.json"));
const arcgis = read(join(root, "docs/data/campus-arcgis.json"));
const staging = read(join(root, "docs/data/corridor-staging.json"));

const MASS_INDEX = 452;
const GIS = arcgis.massing[MASS_INDEX];
const RING_FULL = section?.measured?.mass?.ring ?? [];
const RING = (() => {
  const r = RING_FULL.slice();
  if (r.length > 1) {
    const a = r[0];
    const b = r[r.length - 1];
    if (a[0] === b[0] && a[1] === b[1]) r.pop();
  }
  return r;
})();

function inRing(x, z, r = RING) {
  let ins = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, zi] = r[i];
    const [xj, zj] = r[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
}

function toRingEdge(x, z, r = RING) {
  let best = Infinity;
  for (let i = 0; i < r.length; i++) {
    const [ax, az] = r[i];
    const [bx, bz] = r[(i + 1) % r.length];
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz;
    let t = len2 ? ((x - ax) * dx + (z - az) * dz) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
}

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
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
}

/* Every instance in this module is a box, a cylinder, a cone or a torus placed
   with a rotation about Y only, so an ORIENTED box is an exact description of
   the space it occupies — and an axis-aligned one is not: two tangent pieces of
   furniture sharing a 0.7-degree rotation have overlapping AABBs and touching
   OBBs. Reporting the AABB overlap would fail honest geometry, so the sweep
   below separates in 2D with SAT and in Y with an interval. */
function obbOf(mesh, matrix) {
  mesh.geometry.computeBoundingBox();
  const bb = mesh.geometry.boundingBox;
  const c = new THREE.Vector3();
  const he = new THREE.Vector3();
  bb.getCenter(c);
  bb.getSize(he).multiplyScalar(0.5);
  const pos = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const world = matrix.clone().premultiply(mesh.matrixWorld);
  world.decompose(pos, q, sc);
  const e = new THREE.Euler().setFromQuaternion(q, "YXZ");
  const hx = Math.abs(he.x * sc.x);
  const hy = Math.abs(he.y * sc.y);
  const hz = Math.abs(he.z * sc.z);
  const ca = Math.cos(e.y);
  const sa = Math.sin(e.y);
  /* the geometry's own centre, offset in the rotated frame */
  const ox = c.x * sc.x;
  const oz = c.z * sc.z;
  return {
    x: pos.x + ox * ca + oz * sa,
    y: pos.y + c.y * sc.y,
    z: pos.z - ox * sa + oz * ca,
    hx, hy, hz,
    ax: [ca, -sa],           // the box's local +X in world XZ
    az: [sa, ca],            // the box's local +Z in world XZ
  };
}

/** Penetration depth of two Y-rotated boxes; <= 0 means they are apart. */
function penetration(A, B) {
  const dy = Math.min(A.y + A.hy, B.y + B.hy) - Math.max(A.y - A.hy, B.y - B.hy);
  if (dy <= 0) return dy;
  const dx = B.x - A.x;
  const dz = B.z - A.z;
  let worst = Infinity;
  for (const ax of [A.ax, A.az, B.ax, B.az]) {
    const proj = (o, h1, h2) => Math.abs(o.ax[0] * ax[0] + o.ax[1] * ax[1]) * h1 +
      Math.abs(o.az[0] * ax[0] + o.az[1] * ax[1]) * h2;
    const reach = proj(A, A.hx, A.hz) + proj(B, B.hx, B.hz);
    const gap = reach - Math.abs(dx * ax[0] + dz * ax[1]);
    if (gap < worst) worst = gap;
    if (worst <= 0) return worst;
  }
  return Math.min(worst, dy);
}

const bounds = (pad) => {
  const xs = RING.map((p) => p[0]);
  const zs = RING.map((p) => p[1]);
  return {
    x0: Math.min(...xs) - pad, x1: Math.max(...xs) + pad,
    z0: Math.min(...zs) - pad, z1: Math.max(...zs) + pad,
  };
};

/* ---------------------------------------------------------------- gates */

test("the section exists and is reachable", () => {
  assert.ok(section, "no azad section in the merged document or the build-side file");
});

test("it says what it is, where it came from, and what it left out", () => {
  assert.match(section.label, /Azad/i);
  assert.match(section.label, /nine-storey|nine storey/i, "the storey count is the headline fact");
  assert.ok(section.epoch, "no epoch stamp");
  assert.match(section.epoch, /2023|2024/, "the current epoch is the built 2023-24 building");
  assert.match(section.epoch, /BLIND/i, "the LiDAR blindness must be stamped on the epoch");
  assert.match(section.note, /INVENTED/, "the note must declare the class");
  assert.ok(section.confidence && section.confidence.length > 80, "no confidence statement");

  assert.ok(Array.isArray(section.sources) && section.sources.length >= 8,
    `only ${section.sources?.length} sources`);
  for (const s of section.sources) {
    assert.match(s, /^https:\/\//, `source does not start with a URL: ${s.slice(0, 60)}`);
    assert.match(s, /\b(19|20)\d\d\b/, `source carries no date: ${s.slice(0, 90)}`);
  }
  assert.ok(Array.isArray(section.sourceFiles) && section.sourceFiles.length >= 4);
  for (const s of section.sourceFiles) assert.match(s, /\b(19|20)\d\d\b|massing\[452\]|buildings\[869\]|m:-182/);

  assert.ok(Array.isArray(section.absent) && section.absent.length >= 15,
    `absent has ${section.absent?.length} entries — this list does not shrink`);
  for (const gap of section.absent) assert.equal(typeof gap, "string");
  const has = (re) => section.absent.some((a) => re.test(a));
  assert.ok(has(/PHOTOVOLTAIC/i), "the absent PV must stay declared — this is the Keeling trap");
  assert.ok(has(/BALCON/i), "the absent balconies must stay declared");
  assert.ok(has(/FIN/i), "the absent facade fins must stay declared");
  assert.ok(has(/WORDMARK/i), "the absent wordmark must stay declared");
  assert.ok(has(/SUNSHADE/i), "the unresolved south-face sunshade text must stay on the record");
  assert.ok(has(/WEST EXTERIOR STAIR/i), "the withheld west stair must stay declared, with its reason");
  assert.ok(has(/NICHE/i), "the unknown niche contents must stay declared");
  assert.ok(has(/PRISM LENGTH/i), "the unbuilt missing length must stay declared");
});

test("the withheld stair is withheld for a LEGAL reason, not the void LiDAR argument", () => {
  const stair = section.absent.find((a) => /WEST EXTERIOR STAIR/i.test(a));
  assert.match(stair, /rise|grade change/i, "the reason must be the missing rise, not the terrain read");
  /* campus-eighth.js withholds every stair on 'the 2014 LiDAR is smooth here'.
     That describes a demolished parking lot and is VOID over Eighth. */
  const all = [section.note, section.confidence, ...section.absent].join(" ");
  assert.ok(!/smooth\s+(lidar|terrain)/i.test(all) || /VOID/i.test(all),
    "the 'smooth LiDAR therefore no steps' argument may not be used here");
  assert.match(section.note, /VOID/i, "the note must refuse that argument explicitly");
});

test("colours are data, hex, and every role carries its own provenance", () => {
  const keys = Object.keys(section.colors);
  assert.ok(keys.length >= 20, `only ${keys.length} colours`);
  for (const [k, v] of Object.entries(section.colors)) {
    assert.match(v, /^#[0-9a-f]{6}$/, `${k} is not a lowercase 6-digit hex`);
    const src = section.colorSources[k];
    assert.ok(src, `${k} has no colorSources entry`);
    assert.ok(["measured", "sourced", "estimated"].includes(src.tier), `${k} has no tier`);
    assert.ok(src.source && src.source.length > 40, `${k}'s provenance is a stub`);
  }
  for (const k of Object.keys(section.colorSources)) {
    assert.ok(section.colors[k], `colorSources has an orphan role ${k}`);
  }
  /* The one MEASURED value is the repo's own wall sample, and its missing
     provenance script stays on the record. */
  assert.equal(section.colors.wallPanel, "#d8d3d3");
  assert.equal(section.colorSources.wallPanel.tier, "measured");
  assert.match(section.colorSources.wallPanel.source, /tmp-sample\.mjs/,
    "the missing provenance script must stay recorded");
  /* The amber reveal is warm — r > g > b — and darker than the wall it sits on. */
  const ch = (h, i) => parseInt(h.slice(i, i + 2), 16);
  const a = section.colors.amberReveal;
  assert.ok(ch(a, 1) > ch(a, 3) && ch(a, 3) > ch(a, 5), "amberReveal is not a warm ochre");
  const luma = (h) => 0.299 * ch(h, 1) + 0.587 * ch(h, 3) + 0.114 * ch(h, 5);
  assert.ok(luma(section.colors.wallPanel) > luma(section.colors.amberReveal),
    "the pale panel must read brighter than the amber reveal");
  assert.ok(luma(section.colors.glazing) < luma(section.colors.amberReveal),
    "the glazing must read darker than the reveal, as it does in every frame");
  /* Every estimated colour says WHY it is estimated. */
  const est = Object.entries(section.colorSources).filter(([, v]) => v.tier === "estimated");
  assert.ok(est.length >= 15, "these are dusk/golden-hour photographs — most roles are ratio-derived");
});

test("the anchor is the DRAWN mass, verbatim, and no LiDAR height exists to read", () => {
  assert.equal(section.measured.building, "Azad Hall");
  const M = section.measured.mass;
  assert.equal(M.index, MASS_INDEX);
  assert.equal(M.name, GIS.n);
  assert.equal(M.h, GIS.h, "measured.mass.h drifted from the GIS height");
  assert.equal(M.levels, GIS.levels);
  assert.deepEqual(M.ring, GIS.r[0].map(([x, z]) => [x / 10, z / 10]),
    "measured.mass.ring must be campus-arcgis massing[452] at /10, byte for byte");

  /* The mass campus-massing.js actually draws must be the same ring and the
     same height — anything else and the dressing floats off the visible wall. */
  const drawn = assembleMasses({ campus, lidar: lidarFile, arcgis, colors: null })
    .find((m) => m.src === "gis" && m.rings[0].length === M.ring.length &&
      Math.abs(m.rings[0][0][0] - M.ring[0][0]) < 1e-9 &&
      Math.abs(m.rings[0][0][1] - M.ring[0][1]) < 1e-9);
  assert.ok(drawn, "no drawn gis mass carries this ring — the wall the dressing hangs on is gone");
  assert.equal(drawn.h, M.h, "the height campus-massing.js extrudes drifted from measured.mass.h");

  /* The 2014 flight is blind to a 2023 building: prove there is no massHeight
     to read anywhere near this mass, so nothing here can be a LiDAR figure. */
  const cx = RING.reduce((s, p) => s + p[0], 0) / RING.length;
  const cz = RING.reduce((s, p) => s + p[1], 0) / RING.length;
  const keys = Object.keys(lidarFile.massHeights || {});
  for (const k of keys) {
    const m = /^m:(-?\d+),(-?\d+)$/.exec(k);
    if (!m) continue;
    assert.ok(Math.hypot(+m[1] - cx, +m[2] - cz) > 8,
      `campus-lidar massHeights has ${k} on top of Azad — the blindness claim is wrong`);
  }
  assert.match(M.lidar, /NONE/, "the section must state that there is no LiDAR height");
  /* And OSM's h is never carried. */
  const osm = campus.buildings.find((b) => b.n === "Azad");
  assert.ok(osm, "no OSM 'Azad' to compare against");
  assert.notEqual(M.h, osm.h, "the OSM levels guess must never be the anchor");
});

test("the length conflict is carried, not resolved by re-cutting a measured mass", () => {
  const c = section.measured.conflicts.find((x) => /LENGTH/i.test(x.about));
  assert.ok(c, "the prism-length conflict must stay on the record");
  assert.match(c.others, /51\.1|53\.6/, "both disagreeing sources must be named");
  assert.match(c.resolution, /DRAWN prism wins|forbidden/i);
  const xs = RING.map((p) => p[0]);
  const len = Math.max(...xs) - Math.min(...xs);
  assert.ok(Math.abs(len - 39.7) < 0.2, `the shipped ring is ${len.toFixed(1)} m — it was re-cut`);
});

test("the storey grid is the drawn prism read back, and the parapet is dressed above it", () => {
  const g = section.grid;
  const M = section.measured.mass;
  assert.equal(g.storeys, M.levels, "the storey count is the drawn prism's");
  assert.ok(Math.abs(g.storeys * g.floorToFloor - M.h) < 1e-3,
    `${g.storeys} x ${g.floorToFloor} != the drawn prism ${M.h}`);
  /* The sourced 3.048 m and the drawn 3.0444 m agree — a corroboration. */
  assert.ok(Math.abs(g.floorToFloor - g.sourcedFloorToFloor) < 0.01,
    "the drawn and sourced floor-to-floor must agree, or the conflict text is wrong");
  const c = section.measured.conflicts.find((x) => /storey grid/i.test(x.about));
  assert.ok(c && /CORROBORATION/i.test(c.about), "the agreement must be recorded as such");
  assert.ok(g.parapet > 0.9 && g.parapet <= 1.2, "a 42-inch parapet, not a wall");
  assert.equal(g.residentialFloors, g.storeys - 1, "Level 1 is the colonnade and carries no bedroom bay");
});

test("the remeasured bay pitch supersedes the research read, and says why", () => {
  const c = section.measured.conflicts.find((x) => /bay pitch/i.test(x.about));
  assert.ok(c, "the bay-pitch conflict must stay on the record");
  assert.match(c.thirdRead, /REMEASURED/);
  assert.match(c.others, /2\.98/, "the superseded read must stay named");
  assert.ok(Math.abs(section.grid.bay - 3.74) < 0.001, "the shipped bay is the remeasured 3.74 m");
  /* One window per structural bay: the bay must match the independently
     measured colonnade column spacing to within the read. */
  assert.ok(Math.abs(section.grid.bay - section.colonnade.columnSpacing) < 0.4,
    "one window per structural bay is the whole reconciliation");
});

test("every facade hangs ON the drawn ring and faces out of the mass", () => {
  assert.ok(section.facades.length >= 18, `only ${section.facades.length} faces on a 22-edge ring`);
  let covered = 0;
  for (const f of section.facades) {
    for (const p of [f.a, f.b]) {
      assert.ok(toRingEdge(p[0], p[1]) < 0.06,
        `${f.id}: ${JSON.stringify(p)} is ${toRingEdge(p[0], p[1]).toFixed(3)} m off the drawn ring`);
    }
    assert.notDeepEqual(f.a, f.b, `${f.id} is a zero-length face`);
    assert.ok(Math.abs(Math.hypot(f.out[0], f.out[1]) - 1) < 0.01, `${f.id}'s normal is not unit`);
    const mx = (f.a[0] + f.b[0]) / 2;
    const mz = (f.a[1] + f.b[1]) / 2;
    assert.ok(!inRing(mx + f.out[0] * 0.3, mz + f.out[1] * 0.3),
      `${f.id}'s normal points into the building`);
    assert.ok(inRing(mx - f.out[0] * 0.3, mz - f.out[1] * 0.3),
      `${f.id} does not back onto the mass`);
    assert.ok(f.source && f.source.length > 40, `${f.id} has no source`);
    assert.ok(["longFace", "coreFace", "endFace", "return"].includes(f.system),
      `${f.id} has unknown system ${f.system}`);
    covered += Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]);
  }
  /* The faces tile the WHOLE drawn perimeter — a treated building is never
     partially detailed. */
  const perim = RING.reduce((s, p, i) => {
    const q = RING[(i + 1) % RING.length];
    return s + Math.hypot(q[0] - p[0], q[1] - p[1]);
  }, 0);
  assert.ok(Math.abs(covered - perim) < 0.3,
    `faces cover ${covered.toFixed(1)} m of a ${perim.toFixed(1)} m ring — a face is missing or doubled`);
});

test("the sourceless west end is [estimated] and names the sourced face it extends", () => {
  const west = section.facades.filter((f) => f.system === "endFace");
  assert.equal(west.length, 2, "the west end is two coplanar strips with a 0.7 m step");
  for (const f of west) {
    assert.equal(f.estimated, true, `${f.id} must be declared [estimated]`);
    assert.match(f.source, /\[estimated\]/);
    assert.match(f.source, /NO rung/i, "it must say the ladder was climbed and failed");
    const ref = section.facades.find((x) => x.id === f.patternRef);
    assert.ok(ref, `${f.id}'s patternRef names unknown face ${f.patternRef}`);
    assert.ok(!ref.estimated, `${f.id} extends ${ref.id}, which must itself be sourced`);
    assert.equal(ref.facing, "north", "the pattern comes from the sourced north elevation");
  }
  assert.equal(section.westEnd.tier, "estimated");
  assert.match(section.westEnd.extendsPattern, /NORTH elevation/i);
  /* Pulse's west end is named as precedent and explicitly NOT as a source. */
  assert.match(section.westEnd.source, /DIFFERENT BUILDING/i);
  /* Nothing else on the building is [estimated] at the face level. */
  const otherEst = section.facades.filter((f) => f.estimated && f.system !== "endFace");
  assert.equal(otherEst.length, 0, "only the west end lacks a source");
});

test("the estimated roof mechanical names the sourced pattern it extends", () => {
  const M = section.roof.mechanical;
  assert.equal(M.tier, "estimated");
  assert.match(M.extendsPattern, /own sourced roof composition/i);
  assert.ok(M.units.length >= 4 && M.units.length <= 6,
    "the frame resolves 4-6 clusters; do not ship more than the mesh shows");
  assert.equal(section.roof.drains.tier, "estimated");
  assert.match(section.roof.drains.extendsPattern, /walkway/i);
  /* The parapet HEIGHT is the declared estimate; its plan thickness is not. */
  assert.equal(section.roof.parapet.dimensionTier, "estimated");
  assert.match(section.roof.parapet.source, /not resolvable/i);
});

test("the roof carries zero photovoltaics, and the absent entry names the frame", () => {
  const pv = section.absent.find((a) => /PHOTOVOLTAIC/i.test(a));
  assert.match(pv, /r2c1-plan-00-south\.png/, "the built-epoch frame must be named");
  assert.match(pv, /tdlln\.pdf|rendering/i, "the superseded rendering must be named");
  assert.ok(!JSON.stringify(section.roof).match(/\bpv\b/i), "no PV anywhere in the roof block");
});

test("the walkway clip is declared where the ring steps back", () => {
  const band = section.roof.walkway.crossBands.find((b) => b.clip);
  assert.ok(band, "the cross band over the niches must declare its clip");
  assert.match(band.note, /CLIP/);
  assert.match(band.note, /hover/i, "nothing may hover — say so");
  /* The declared clip must be the RING's own span, not a typed number. */
  const spanAtX = (x) => {
    let z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < RING.length; i++) {
      const [ax, az] = RING[i];
      const [bx, bz] = RING[(i + 1) % RING.length];
      if (ax === bx) continue;
      const t = (x - ax) / (bx - ax);
      if (t < 0 || t > 1) continue;
      const z = az + (bz - az) * t;
      z0 = Math.min(z0, z);
      z1 = Math.max(z1, z);
    }
    return [z0, z1];
  };
  const [z0, z1] = spanAtX(band.x);
  assert.ok(Math.abs(z0 - band.clip.z0) < 0.05 && Math.abs(z1 - band.clip.z1) < 0.05,
    `the declared clip ${JSON.stringify(band.clip)} is not the ring's span ${[z0, z1]}`);
  /* and it must genuinely be tighter than the bounding box */
  const zs = RING.map((p) => p[1]);
  assert.ok(z0 > Math.min(...zs) + 0.5 && z1 < Math.max(...zs) - 0.5,
    "the clip must be strictly inside the bounding box, or there is nothing to clip");
});

test("the counts the section declares are the counts of the drawn ring", () => {
  const e = section.expect;
  const bays = (f) => Math.max(1, Math.round(f.length / section.grid.bay));
  const F = section.grid.residentialFloors;
  const longs = section.facades.filter((f) => f.system === "longFace");
  assert.equal(e.facades, section.facades.length);
  assert.equal(e.longFaces, longs.length);
  assert.equal(e.popoutNorth, longs.filter((f) => f.facing === "north").reduce((s, f) => s + bays(f) * F, 0));
  assert.equal(e.popoutSouth, longs.filter((f) => f.facing === "south").reduce((s, f) => s + bays(f) * F, 0));
  assert.ok(e.popoutWindows > 140, "the window is the building — this cannot be a token count");
});

/* ----------------------------------------------- the module, run for real */

const flatGround = () => 96.0;
const build = (g = flatGround) =>
  createPhotoAzad(null, { photo: { azad: section }, heightAt: g, surfaceAt: g });

test("the module builds the section, and its counts match what the document declares", () => {
  const a = build();
  assert.ok(a.group instanceof THREE.Group);
  const e = section.expect;
  for (const k of ["facades", "longFaces", "coreFaces", "endFaces", "returns",
    "popoutWindows", "loungeWindows", "corridorWindows", "stairSlots",
    "panelFields", "roofMechanical", "planterCubes", "bikeHoops", "porchColumns",
    "penthouses", "standpipes"]) {
    assert.equal(a.counts[k], e[k], `counts.${k} = ${a.counts[k]}, the document declares ${e[k]}`);
  }
  assert.equal(a.counts.pv, 0, "Azad has no rooftop PV");
  /* Six amber/frame/glass pieces per pop-out box; the amber bin also carries
     the flat lounge window's head and sill. */
  assert.equal(a.counts.amberPieces, 3 * e.popoutWindows + 2 * e.loungeWindows);
  assert.equal(a.counts.glassPanes,
    e.popoutWindows + e.loungeWindows + e.corridorWindows + e.stairSlots);
  assert.ok(a.counts.colonnadeColumns >= 15, `only ${a.counts.colonnadeColumns} colonnade columns`);
  assert.equal(a.counts.baseWalls, section.facades.length, "every face skirts to the ground");
  assert.equal(a.counts.parapetRuns, section.facades.length, "the parapet mitres round every notch");
  assert.equal(a.counts.crossBands, section.roof.walkway.crossBands.length);
  assert.ok(a.counts.drains >= 8 && a.counts.drains <= 20, `${a.counts.drains} drains`);
  assert.ok(a.counts.guardrailPickets > 100, "a picket guardrail is pickets, not a fence texture");
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
  const src = readFileSync(join(root, "docs/js/campus-photo-azad.js"), "utf8");
  assert.ok(!/Math\.random|Date\.now|new Date/.test(src), "no nondeterminism in the builder");
});

test("NOTHING HOVERS: every roof item's footprint is inside the drawn ring", () => {
  const { group } = build();
  const roof = group.children.find((c) => c.name === "azad-roof");
  assert.ok(roof, "no azad-roof group");
  const base = flatGround();
  const roofY = base + section.measured.mass.h;

  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  let checked = 0;
  roof.traverse((o) => {
    if (o.isInstancedMesh) {
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m);
        m.decompose(pos, q, sc);
        /* Parapet and coping SIT ON the ring line by design; everything else
           must be inside it. */
        const onRing = toRingEdge(pos.x, pos.z) < 0.3;
        assert.ok(inRing(pos.x, pos.z) || onRing,
          `a roof instance at (${pos.x.toFixed(2)}, ${pos.z.toFixed(2)}) is outside the drawn plate`);
        assert.ok(pos.y >= roofY - 0.05,
          `a roof instance sits at y=${pos.y.toFixed(2)}, below the roof deck ${roofY}`);
        checked++;
      }
    } else if (o.isMesh) {
      o.getWorldPosition(pos);
      assert.ok(pos.y >= roofY - 0.05 || o.name === "roof-membrane",
        `${o.name} sits below the roof deck`);
      checked++;
    }
  });
  assert.ok(checked > 80, `only ${checked} roof items checked`);

  /* The membrane itself follows the RING, not a bounding box: every vertex is
     inside or on the polygon, so it cannot overhang a notch. */
  const memb = roof.children.find((c) => c.name === "roof-membrane");
  assert.ok(memb, "no roof membrane");
  memb.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  const p = memb.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).applyMatrix4(memb.matrixWorld);
    assert.ok(inRing(v.x, v.z) || toRingEdge(v.x, v.z) < 0.05,
      `membrane vertex at (${v.x.toFixed(2)}, ${v.z.toFixed(2)}) hangs off the drawn plate`);
  }
});

test("the clip is proven by CONSEQUENCE: the clipped band is genuinely absent from the notch", () => {
  const { group } = build();
  const roof = group.children.find((c) => c.name === "azad-roof");
  const band = section.roof.walkway.crossBands.find((b) => b.clip);
  const zs = RING.map((pt) => pt[1]);
  const bboxZ0 = Math.min(...zs);
  const bboxZ1 = Math.max(...zs);

  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  let found = null;
  roof.traverse((o) => {
    if (!o.isInstancedMesh) return;
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m);
      m.decompose(pos, q, sc);
      /* the cross band: a north-south strip at the declared x */
      if (Math.abs(pos.x - band.x) < 0.2 && sc.z > 4 && sc.x < 2) {
        found = { z0: pos.z - sc.z / 2, z1: pos.z + sc.z / 2, len: sc.z };
      }
    }
  });
  assert.ok(found, `no cross band built at x=${band.x}`);
  /* It must be shorter than the bounding box by MORE than the notch depth, and
     it must not reach into either notch. */
  assert.ok(found.z0 > band.clip.z0 - 0.01,
    `the band reaches z=${found.z0.toFixed(2)}, past the ring's ${band.clip.z0} — it hovers`);
  assert.ok(found.z1 < band.clip.z1 + 0.01,
    `the band reaches z=${found.z1.toFixed(2)}, past the ring's ${band.clip.z1} — it hovers`);
  assert.ok(found.len < bboxZ1 - bboxZ0 - 1.5,
    `the band is ${found.len.toFixed(2)} m — a bounding-box band would be ${(bboxZ1 - bboxZ0).toFixed(2)} m; the clip did nothing`);
  /* And there is genuinely no roof under the bbox extremes at that x. */
  assert.ok(!inRing(band.x, bboxZ0 + 0.2), "the north notch must really be a hole at this x");
  assert.ok(!inRing(band.x, bboxZ1 - 0.2), "the south notch must really be a hole at this x");
});

test("no facade layer floats more than a metre off its measured face", () => {
  const { group } = build();
  const facades = group.children.find((c) => c.name === "azad-facades");
  assert.ok(facades, "no azad-facades group");
  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  let worst = 0;
  let at = null;
  let seen = 0;
  facades.traverse((o) => {
    if (o.isInstancedMesh) {
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m);
        pos.setFromMatrixPosition(m);
        if (inRing(pos.x, pos.z)) { seen++; continue; }
        const d = toRingEdge(pos.x, pos.z);
        if (d > worst) { worst = d; at = [o.name, pos.x, pos.z]; }
        seen++;
      }
    } else if (o.isMesh) {
      o.getWorldPosition(pos);
      if (!inRing(pos.x, pos.z)) {
        const d = toRingEdge(pos.x, pos.z);
        if (d > worst) { worst = d; at = [o.name, pos.x, pos.z]; }
      }
      seen++;
    }
  });
  assert.ok(seen > 800, `only ${seen} facade items sampled`);
  assert.ok(worst <= 1.0, `a facade layer stands ${worst.toFixed(2)} m proud at ${JSON.stringify(at)}`);
});

test("everything sits inside Azad's envelope, and nothing invented is in another building", () => {
  const { group } = build();
  const b = bounds(12);
  const pos = new THREE.Vector3();
  const m = new THREE.Matrix4();
  const others = campus.buildings.filter((x) => x.p && x.p.length >= 3 && x.n !== "Azad");
  let checked = 0;
  group.traverse((o) => {
    const push = (x, z) => {
      assert.ok(x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1,
        `${o.name || "an item"} at (${x.toFixed(1)}, ${z.toFixed(1)}) is outside Azad ${JSON.stringify(b)}`);
      for (const bb of others) {
        assert.ok(!inRing(x, z, bb.p), `(${x.toFixed(1)}, ${z.toFixed(1)}) is inside ${bb.n || "an unnamed mass"}`);
      }
      checked++;
    };
    if (o.isInstancedMesh) {
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m);
        pos.setFromMatrixPosition(m);
        push(pos.x, pos.z);
      }
    } else if (o.isMesh) {
      /* Some geometries (the ring-shaped membrane, the draped decals) carry
         ABSOLUTE coordinates, so the object's own position is not where it is.
         Take the world centre of its bounding box instead. */
      o.geometry.computeBoundingBox();
      o.updateWorldMatrix(true, false);
      o.geometry.boundingBox.getCenter(pos).applyMatrix4(o.matrixWorld);
      push(pos.x, pos.z);
    }
  });
  assert.ok(checked > 1000, `only ${checked} items checked`);
});

test("no solid object crowds the scooter corridor", () => {
  const { group } = build();
  const pos = new THREE.Vector3();
  const m = new THREE.Matrix4();
  let worst = Infinity;
  group.traverse((o) => {
    if (o.isInstancedMesh) {
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m);
        pos.setFromMatrixPosition(m);
        worst = Math.min(worst, toRoute(pos.x, pos.z));
      }
    } else if (o.isMesh) {
      o.getWorldPosition(pos);
      worst = Math.min(worst, toRoute(pos.x, pos.z));
    }
  });
  assert.ok(worst >= 3, `closest item is ${worst.toFixed(2)} m from the staging centreline`);
});

test("ground objects seat on a ROLLING sampler — nothing floats, nothing buries", () => {
  /* A flat fake sampler cannot tell y = ground from y = 96. This terrain rolls
     +/- 3.5 m across Azad's extent, so a mis-seated object misses by metres. */
  const sloped = (x, z) => 96 + 2 * Math.sin(x / 17) + 1.5 * Math.cos(z / 21);
  const { group } = build(sloped);
  const gr = group.children.find((c) => c.name === "azad-ground");
  assert.ok(gr, "no azad-ground group");
  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  let seen = 0;
  gr.traverse((o) => {
    if (!o.isInstancedMesh) return;
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m);
      m.decompose(pos, q, sc);
      const dy = pos.y - sloped(pos.x, pos.z);
      assert.ok(dy > -0.6 && dy < 4.2,
        `a ground instance at (${pos.x.toFixed(1)}, ${pos.z.toFixed(1)}) sits ${dy.toFixed(2)} m off the rolling terrain`);
      seen++;
    }
  });
  assert.ok(seen > 150, `only ${seen} ground instances sampled`);

  /* Ground decals are DRAPED: every vertex hugs the rolling surface. */
  group.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  let decals = 0;
  let verts = 0;
  gr.traverse((o) => {
    if (!o.isMesh || o.name !== "ground-decal") return;
    decals++;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
      const dy = v.y - sloped(v.x, v.z);
      assert.ok(dy > -0.02 && dy < 0.45,
        `ground-decal vertex at (${v.x.toFixed(1)}, ${v.z.toFixed(1)}) sits ${dy.toFixed(2)} m off the terrain`);
      verts++;
    }
  });
  assert.equal(decals, 3, `${decals} ground decals — Azad drapes the porch floor and its two beds, nothing else`);
  /* Azad's only DRAPED ground surfaces are the porch floor and its two planting
     beds, and this walks EVERY vertex of them — not a sample. Rather than a
     floor on the count (the first build asserted "> 45" because its porch
     happened to be 17.7 m wide, so shrinking the porch to its true 8.2 m face
     broke the gate without anything being wrong), solve the population from the
     data: campus-photo-azad.js drapes at one vertex every DRAPE_SEG = 2 m, so a
     w x d decal carries (ceil(w/2)+1) x (ceil(d/2)+1) vertices. If the module
     ever stops draping, or a decal silently changes size, this fails. */
  const DRAPE_SEG = 2;
  const grid = (w, d) => (Math.ceil(w / DRAPE_SEG) + 1) * (Math.ceil(d / DRAPE_SEG) + 1);
  const pf = section.facades.find((f) => f.id === section.porch.face);
  const pw = Math.hypot(pf.b[0] - pf.a[0], pf.b[1] - pf.a[1]);
  const want = grid(pw, section.porch.depth) + 2 * grid(section.porch.bedDepth, section.porch.depth);
  assert.equal(verts, want,
    `${verts} draped vertices against the ${want} the porch's own dimensions require`);
});

test("the colonnade columns stand on their OWN drawn surface and reach the fascia", () => {
  const sloped = (x, z) => 96 + 2 * Math.sin(x / 17) + 1.5 * Math.cos(z / 21);
  const { group } = build(sloped);
  const facades = group.children.find((c) => c.name === "azad-facades");
  const col = facades.children.find((c) => c.name === "azad-colonnade");
  assert.ok(col && col.isInstancedMesh, "no colonnade");
  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  for (let i = 0; i < col.count; i++) {
    col.getMatrixAt(i, m);
    m.decompose(pos, q, sc);
    const foot = pos.y - sc.y / 2;
    const g = sloped(pos.x, pos.z);
    assert.ok(foot < g + 0.02 && foot > g - 0.6,
      `a column foot sits ${(foot - g).toFixed(2)} m off the drawn surface`);
    assert.ok(sc.y > 1.5, "a column that short cannot reach the fascia");
  }
  assert.ok(Math.abs(sc.x * 2 - section.colonnade.columnDiameter) < 1e-4,
    "the column radius is the sourced 0.61 m form");
});

test("the pop-out window really is a rotated box: one jamb proud, one flush", () => {
  const { group } = build();
  const facades = group.children.find((c) => c.name === "azad-facades");
  const amber = facades.children.find((c) => c.name === "azad-amber");
  assert.ok(amber && amber.isInstancedMesh, "no amber reveals");
  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const e = new THREE.Euler();
  let rotated = 0;
  let maxProud = 0;
  for (let i = 0; i < amber.count; i++) {
    amber.getMatrixAt(i, m);
    m.decompose(pos, q, sc);
    e.setFromQuaternion(q, "YXZ");
    /* Every pop-out piece is rotated off its face by the measured tilt. */
    const face = section.facades.find((f) => toRingEdge(pos.x, pos.z) < 1.2 &&
      Math.abs(Math.atan2(f.out[0], f.out[1]) - e.y) < section.window.tilt + 0.02);
    if (face) rotated++;
    if (!inRing(pos.x, pos.z)) maxProud = Math.max(maxProud, toRingEdge(pos.x, pos.z));
  }
  assert.ok(rotated > 300, `only ${rotated} amber pieces sit at the rotated angle`);
  /* The deep jamb reaches the geometric projection; nothing reaches a metre. */
  assert.ok(maxProud > 0.2 && maxProud < 0.6,
    `the box's deepest reach is ${maxProud.toFixed(2)} m — it should be about 0.29-0.39 m`);
  assert.equal(section.window.rotationMirrors, false,
    "the remeasured evidence says the rotation does not mirror; the flag stays explicit");
});

test("NOTHING INTERSECTS: no two things standing on the ground share space", () => {
  /* The other half of the ultra standard's companion rule, and the half nothing
     gated before. It runs on the ROLLING sampler, because two objects seated on
     their own drawn surfaces move relative to each other when the ground tilts.
     Scope: everything in `azad-ground` plus the colonnade columns, which are the
     population that stands ON the ground. Facade layers are excluded because a
     mullion, its glass and its recess backing are MEANT to be coincident. */
  const sloped = (x, z) => 96 + 2 * Math.sin(x / 17) + 1.5 * Math.cos(z / 21);
  for (const g of [flatGround, sloped]) {
    const { group } = build(g);
    group.updateMatrixWorld(true);
    const items = [];
    const m = new THREE.Matrix4();
    for (const name of ["azad-ground", "azad-facades"]) {
      const parent = group.children.find((c) => c.name === name);
      assert.ok(parent, `no ${name} group`);
      parent.traverse((o) => {
        if (!o.isInstancedMesh) return;
        if (name === "azad-facades" && o.name !== "azad-colonnade") return;
        assert.ok(o.name, "an instanced ground family ships unnamed — a failure here could not say what hit what");
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, m);
          items.push({ n: o.name, i, box: obbOf(o, m) });
        }
      });
    }
    assert.ok(items.length > 200, `only ${items.length} ground solids swept`);
    const families = new Set(items.map((it) => it.n));
    /* The three families the audit caught colliding must all really be here. */
    for (const need of ["azad-hedge", "azad-colonnade", "azad-guardrail",
      "azad-planter-cubes", "azad-standpipe"]) {
      assert.ok(families.has(need), `${need} is not in the sweep`);
    }
    let worst = 0;
    let at = null;
    for (let a = 0; a < items.length; a++) {
      for (let b = a + 1; b < items.length; b++) {
        /* Within ONE family, overlap is the design: guardrail posts, pickets
           and rails are one welded assembly, and hedge boxes butt end to end. */
        if (items[a].n === items[b].n) continue;
        const p = penetration(items[a].box, items[b].box);
        if (p > worst) {
          worst = p;
          at = `${items[a].n}[${items[a].i}] x ${items[b].n}[${items[b].i}]`;
        }
      }
    }
    assert.ok(worst <= 0.005,
      `${at} interpenetrate by ${worst.toFixed(3)} m on ${g === flatGround ? "flat" : "rolling"} ground`);
  }
});

test("the planting bed lies in the strip the colonnade leaves, and is broken where a fitting stands in it", () => {
  /* The audit's first defect, stated as a rule rather than as one number: the
     hedge occupies the band between the storefront glass line and the back of
     the column shafts, and it is DERIVED from those two, so it cannot drift
     back into the columns the way a typed 1.15 m offset did. */
  const C = section.colonnade;
  const H = section.ground.hedge;
  const glassLine = C.baseWallStandoff + 0.05;
  const columnBack = C.columnProud;
  assert.ok(H.offset - H.depth / 2 >= glassLine - 1e-9,
    `the bed's back is at ${(H.offset - H.depth / 2).toFixed(3)} m, inside the ${glassLine} m glass line`);
  assert.ok(H.offset + H.depth / 2 <= columnBack - 0.01,
    `the bed reaches ${(H.offset + H.depth / 2).toFixed(3)} m, into the column band that starts at ${columnBack} m`);
  assert.equal(H.heightTier, "measured", "the hedge height is a pixel read and must say so");
  assert.match(H.heightSource, /px/, "the height must name its pixel count");
  assert.equal(H.depthTier, "estimated", "a frontal photograph cannot give a plan depth");
  assert.match(H.depthRule, /clear strip|clearance/i);
  assert.match(H.interruptionRule, /INTERRUPTED/i);
  /* The standpipe stands against the wall where its source puts it, in the bed
     — so the bed must genuinely be short there. */
  const S = section.ground.standpipe;
  assert.ok(S.offset < columnBack, "the standpipe must be against the wall, not out among the columns");
  assert.ok(S.offset - S.radius < H.offset + H.depth / 2 &&
    S.offset + S.radius > H.offset - H.depth / 2,
    "if the standpipe were not in the bed there would be nothing for the interruption rule to do");
  const { group } = build();
  const gr = group.children.find((c) => c.name === "azad-ground");
  const hedge = gr.children.find((c) => c.name === "azad-hedge");
  assert.ok(hedge, "no hedge");
  assert.equal(hedge.count, section.expect.hedgeSegments);
  /* Bed segments run at one nominal length; a missing one is the interruption. */
  const face = section.facades.find((f) => f.id === S.face);
  const runs = section.ground.hedge.faces
    .map((id) => section.facades.find((f) => f.id === id).length);
  const nominal = runs.reduce((s, L) => s + Math.ceil(L / 0.8), 0);
  assert.ok(hedge.count < nominal,
    `the bed ships ${hedge.count} of ${nominal} segments — nothing was interrupted`);
  assert.ok(face, "the standpipe's face must be a drawn face");
});

test("the porch backs onto ONE drawn face and its soffit is carried the whole way", () => {
  /* The audit's fourth defect. The first build took the porch's width from the
     ring's bounding box, shipped it at 17.7 m across the whole east elevation —
     twice the plan's roughly 9 m — and because the drawn east face STEPS 1.25 m
     at z = 613.2 the soffit stood clear of the wall, with daylight behind it,
     for 7.5 m. The width is now the drawn face's own length, and this asserts
     the consequence: every point of the soffit's inner edge sits on a wall. */
  const P = section.porch;
  const face = section.facades.find((f) => f.id === P.face);
  assert.ok(face, `porch.face ${P.face} is not a drawn face`);
  assert.equal(P.extentTier, "measured", "the width is the ring's, so it is not an estimate");
  assert.match(P.widthSource, /east-3|drawn length/i);
  assert.equal(P.dimensionTier, "estimated", "the furniture is off a RENDERING and must say so");

  const a = build();
  const faceLen = Math.hypot(face.b[0] - face.a[0], face.b[1] - face.a[1]);
  assert.ok(Math.abs(a.counts.porchWidth - faceLen) < 1e-6,
    `the porch is ${a.counts.porchWidth.toFixed(2)} m wide against a ${faceLen.toFixed(2)} m face`);
  /* And it is NOT the bounding box, which is what the first build shipped. */
  const zs = RING.map((p) => p[1]);
  assert.ok(a.counts.porchWidth < (Math.max(...zs) - Math.min(...zs)) - 5,
    "the porch is still the ring's bounding box");
  /* Roughly the plan's 9 m, inside the declared length conflict. */
  assert.ok(a.counts.porchWidth > 7 && a.counts.porchWidth < 11,
    `${a.counts.porchWidth.toFixed(1)} m is nowhere near the plan's 9 m notch`);

  const soffit = [];
  a.group.traverse((o) => { if (o.name === "porch-soffit") soffit.push(o); });
  assert.equal(soffit.length, 1, "one porch, one soffit");
  soffit[0].updateMatrixWorld(true);
  soffit[0].geometry.computeBoundingBox();
  const v = new THREE.Vector3();
  const pos = soffit[0].geometry.attributes.position;
  /* The inner edge is the half of the slab nearest the wall: every one of its
     vertices must be within a hair of the drawn ring. */
  const mid = new THREE.Vector3();
  soffit[0].geometry.boundingBox.getCenter(mid);
  let innerChecked = 0;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    if (v.z > mid.z) continue;                 // local -Z is toward the wall
    v.applyMatrix4(soffit[0].matrixWorld);
    assert.ok(toRingEdge(v.x, v.z) < 0.05,
      `the soffit's inner edge stands ${toRingEdge(v.x, v.z).toFixed(2)} m clear of the wall at (${v.x.toFixed(1)}, ${v.z.toFixed(1)})`);
    innerChecked++;
  }
  assert.ok(innerChecked >= 4, `only ${innerChecked} inner-edge vertices checked`);
});

test("the ground storey can be entered: a subdivided storefront with a door leaf", () => {
  /* The audit's fifth defect. One undivided matte box per bay is not a ground
     storey; az_base_47 resolves the real one and the module now builds it. */
  const S = section.storefront;
  assert.equal(S.tier, "sourced");
  assert.match(S.source, /px/, "the storefront must name its pixel reads");
  assert.match(S.doorSource, /pull|handle/i, "the door is proven by its pull, and the pull height pins the scale");
  assert.equal(S.cadenceTier, "estimated", "how often a door recurs is not resolved by any frame");
  /* The assembly must FIT the structural bay it sits in, and the window opening
     must fit the bedroom bay above it — the ungated relation the audit named. */
  const asm = S.lights * S.lightWidth;
  assert.ok(asm < section.colonnade.columnSpacing - 1.0,
    `a ${asm.toFixed(2)} m assembly in a ${section.colonnade.columnSpacing} m bay leaves no pier`);
  const W = section.window;
  const projected = W.openingWidth * Math.abs(Math.sin(W.tilt)) + W.openingWidth * Math.cos(W.tilt);
  assert.ok(projected + 2 * W.revealBoard < section.grid.bay,
    `a ${W.openingWidth} m opening rotated ${W.tilt} rad spans ${projected.toFixed(2)} m in a ${section.grid.bay} m bay — the boxes overlap`);
  /* The storefront must sit under the colonnade fascia, not through it. */
  assert.ok(S.headHeight < section.grid.floorToFloor - section.colonnade.soffitFascia,
    "the storefront head pushes through the colonnade soffit");
  assert.ok(S.railHeight > 0 && S.railHeight < S.headHeight);

  const a = build();
  assert.equal(a.counts.doors, section.expect.doors);
  assert.ok(a.counts.doors > 0, "the building cannot be entered");
  assert.equal(a.counts.doors, a.counts.longFaces,
    "the declared cadence is one door per drawn colonnade face");
  assert.equal(a.counts.storefrontPanes, section.expect.storefrontPanes);
  assert.equal(a.counts.storefrontPanes, a.counts.storefronts * S.lights * 2,
    "every light is split by the continuous rail into two panes");
  const { group } = build();
  const facades = group.children.find((c) => c.name === "azad-facades");
  for (const n of ["azad-storefront", "azad-storefront-glass", "azad-storefront-frame",
    "azad-door-pulls"]) {
    assert.ok(facades.children.find((c) => c.name === n), `no ${n}`);
  }
  const pulls = facades.children.find((c) => c.name === "azad-door-pulls");
  assert.equal(pulls.count, section.expect.doors);
});

test("the dressed roof datum is the height campus-massing.js actually extrudes", () => {
  /* Latent anchor drift: the module used to median over the ring with its
     closing duplicate REMOVED (22 vertices) while roofElevation medians over the
     ring as arcgis ships it (23). On flat ground the two agree exactly and
     nothing shows; on a rolling sampler they pick different ranks and the whole
     dressing slides off the wall. Compare them on BOTH. */
  const M = section.measured.mass;
  for (const g of [flatGround, (x, z) => 96 + 2 * Math.sin(x / 17) + 1.5 * Math.cos(z / 21)]) {
    const { group } = createPhotoAzad(null, { photo: { azad: section }, heightAt: g, surfaceAt: g });
    const roof = group.children.find((c) => c.name === "azad-roof");
    const memb = roof.children.find((c) => c.name === "roof-membrane");
    const built = memb.position.y - 0.02;
    const want = roofElevation(M.ring, M.h, g);
    assert.ok(Math.abs(built - want) < 1e-9,
      `the dressing hangs at ${built.toFixed(4)} where campus-massing.js draws the roof at ${want.toFixed(4)}`);
  }
});

test("the figures the audit called underived now name a derivation or a standard", () => {
  /* The Keeling bar, swept. Every number below either has a pixel count behind
     it or names the published standard it is taken from — and the ones that are
     consequences of other numbers are no longer typed at all. */
  const src = readFileSync(join(root, "docs/js/campus-photo-azad.js"), "utf8");
  const L = section.roof.penthouse.ladder;
  assert.equal(L.tier, "estimated");
  assert.match(L.source, /OSHA|ANSI/, "the fixed-ladder figures must name their standard");
  assert.ok(Math.abs(L.railSpacing - 0.4064) < 1e-9, "16 in exactly");
  assert.ok(Math.abs(L.rungPitch - 0.3048) < 1e-9, "12 in exactly");
  assert.equal(L.rungs, undefined, "the rung COUNT is a consequence of the penthouse height, not a typed number");
  assert.equal(L.width, undefined, "superseded by railSpacing");
  assert.equal(L.cage, undefined, "superseded by cageStandoff");
  const built = build();
  const climb = section.roof.penthouse.size[1] - 2 * L.rungPitch;
  assert.equal(built.counts.ladderRungs, Math.max(2, Math.floor(climb / L.rungPitch) + 1),
    "the rung count must be solved from the height, not read from the data");

  const Wk = section.roof.walkway;
  assert.equal(Wk.trim, undefined, "the trim is the band's own width and is no longer typed beside it");
  assert.equal(Wk.minRun, undefined, "a face carries a band iff anything survives the trim");
  assert.match(Wk.trimRule, /width/);
  assert.equal(section.roof.drains.inset, undefined,
    "the drain inset is the walkway band's own centre line and is computed");
  assert.match(section.roof.drains.insetRule, /centre line/i);

  assert.ok(Math.abs(section.grid.parapet - 1.0668) < 1e-9, "42 in exactly, not a rounded 1.07");
  assert.ok(Math.abs(section.roof.parapet.height - 1.0668) < 1e-9);
  /* ARBITRATED 2026-08-19: the guard takes the one canonical Eighth value,
     1.067 m, owned by eighthsiteworks.systems.guardrail. It is the same 42 in
     code guard — 1.0668 rounded to the millimetre the rest of the college
     carries — so the parapets above keep their exact 1.0668. */
  assert.ok(Math.abs(section.ground.guardrail.height - 1.067) < 1e-9);
  assert.ok(Math.abs(section.roof.parapet.copingOverhang - 0.025) < 1e-9, "a 1 in coping drip");
  assert.match(section.roof.parapet.copingOverhangSource, /SMACNA|1 in/);

  const R = section.ground.guardrail;
  assert.equal(R.offset, undefined, "the rail's offset is derived from the colonnade band, not typed");
  /* Picket centres are no longer derived here from the sphere rule: they are
     the MEASURED canonical 0.1016 m, arbitrated across the college, and the
     module reads them out of the document. */
  assert.ok(Math.abs(R.picketSpacing - 0.1016) < 1e-9, "the canonical 4 in picket centres");
  assert.ok(R.picketSpacing - R.picket > 0 && R.picketSpacing - R.picket < 0.1016,
    "the clear opening must still pass the 102 mm sphere");
  assert.equal(R.specOwner, "eighthsiteworks.systems.guardrail",
    "one guard spec for the whole college, and this section must name its owner");
  assert.match(R.picketRule, /0\.1016|4 in/);
  assert.match(R.offsetRule, /columnProud/);
  assert.ok(!/SPHERE_RULE/.test(src.replace(/\/\*[\s\S]*?\*\//g, "")),
    "the picket spacing is now measured data, not a code constant computed in the module");

  const Sp = section.ground.standpipe;
  assert.ok(Math.abs(Sp.height - 0.91) < 1e-9, "36 in, an FDC inlet height — not a bare integer 1");
  assert.match(Sp.dimensionSource, /NFPA|DN150|6-inch/i);
  assert.ok(Math.abs(section.ground.uplights.radius - 0.0635) < 1e-9, "a 5-inch in-grade luminaire");
  assert.match(section.ground.uplights.radiusSource, /5-inch|in-grade/i);

  /* The crop's ruler is itself declared, with two independent reads. */
  const sc = section.scale;
  assert.ok(sc && sc.pxPerMetre > 0 && sc.pxPerMetreAlongWall > 0);
  assert.match(sc.source, /TWO INDEPENDENT RULERS/);
  assert.ok(Math.abs(sc.pxPerMetreAlongWall - sc.pxPerMetre * sc.foreshortening) < 2,
    "the along-wall scale must be the true scale times the declared foreshortening");
});

test("the counts the module produces are ALL declared, so none can drift unwatched", () => {
  const a = build();
  const e = section.expect;
  for (const k of ["doors", "storefrontPanes", "walkwayBands", "drains", "hedgeSegments",
    "uplights", "ladderRungs", "guardrailPickets", "porchSofas", "porchWalls"]) {
    assert.equal(a.counts[k], e[k], `counts.${k} = ${a.counts[k]}, the document declares ${e[k]}`);
  }
  assert.ok(Math.abs(a.counts.porchWidth - e.porchWidth) < 0.01);
  /* Anything the module counts and the document does not declare is a hole of
     exactly the kind that let five wrong numbers through the first build. */
  const undeclared = Object.keys(a.counts).filter((k) => !(k in e));
  assert.deepEqual(undeclared.sort(),
    ["amberPieces", "baseWalls", "colonnadeColumns", "crossBands", "draws", "glassPanes",
      "parapetRuns", "pv", "storefrontFrames", "storefronts"].sort(),
    "a module count appeared with no expect entry — declare it or drop it");
});

test("the material library is on the surfaces, and the textures are code-generated", () => {
  const { group } = build();
  let textured = 0;
  let glass = 0;
  group.traverse((o) => {
    if (o.isMesh && o.material) {
      if (o.material.map && o.material.normalMap && o.material.roughnessMap) textured++;
      if (o.material.transparent && o.material.opacity < 1 && o.material.envMapIntensity > 1) glass++;
    }
  });
  assert.ok(textured >= 25, `only ${textured} textured meshes — the library is not applied`);
  assert.ok(glass >= 1, "the windows do not carry the library's reflective glass");
  const src = readFileSync(join(root, "docs/js/campus-photo-azad.js"), "utf8");
  assert.match(src, /(?:shared|create)MaterialLibrary/, "surfaces come from campus-materials.js");
  assert.match(src, /get\("pavingConcreteUnit"/, "the rainscreen rides a joint-grid class, not flat colour");
  assert.match(src, /get\("brick"/, "the burnished block rides a coursed class");
  assert.match(src, /get\("roofMembrane"/, "the membrane rides the membrane class");
  /* Colours are DATA: no hex literal may appear in the module. */
  const body = src.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!/#[0-9a-fA-F]{6}\b/.test(body), "a colour literal escaped into the module");
});
