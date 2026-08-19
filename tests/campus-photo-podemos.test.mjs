/* Podemos Hall's photo-sourced detail section (TDLLN Building 5, Eighth College).
 *
 * INVENTED class, so the gates are about quarantine and about not
 * contradicting the measured world — plus the five things that are specific to
 * this building and would be silent failures anywhere else:
 *
 *   - the 2014 survey is BLIND to Eighth, so the section must anchor to the
 *     ArcGIS massing ring and its GIS h, and no massHeight may exist (or be
 *     read) inside either footprint;
 *   - the academic wing's drawn h = 6.1 m is CONTRADICTED by its own
 *     photographs at ~9.5 m. The drawn prism must win, the sourced figure must
 *     stay on the record, and nothing may be built at the sourced height;
 *   - 26 of the wing's 60 real ring segments are wholly INSIDE the drawn tower,
 *     so the wall, storefront, colonnade, canopy, sawtooth and roof must all be
 *     clipped against it rather than drawn through it;
 *   - the sawtooth parapet's absolute pitch is soft but its RATIOS are not, so
 *     the gate is on the ratios, re-derived here rather than trusted;
 *   - which of the three surveyed east door recesses carries the 9185 stair is
 *     decided by the rings, and the test re-runs that derivation instead of
 *     accepting the answer.
 *
 * The section will live under the `podemos` key of
 * docs/data/campus-photo-detail.json (top-level, like york/argo/blake — NOT
 * nested inside the `eighth` landscape key). Until the main session merges it,
 * it is read from the build-side file, so this test does not depend on the
 * merge having happened. The fallback goes away with the merge, exactly as
 * Keeling's did.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as THREE from "../docs/vendor/three/three.module.min.js";
import { createPhotoPodemos } from "../docs/js/campus-photo-podemos.js";
import { assembleMasses } from "../docs/js/campus-massing.js";
import { overlayLift } from "../docs/js/campus-overlay.js";

/* The ladder's rung names, so the roof-lift gate below asserts against
   campus-overlay.js's own numbers and never against a copy of them. */
const PAD_RUNG = "pad";
const CARPET_RUNG = "carpet";
const PAINT_RUNG = "paint";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(p, "utf8"));

const merged = read(process.env.PHOTO_DETAIL || join(root, "docs/data/campus-photo-detail.json"));
const section = merged.podemos;

const campus = read(join(root, "docs/data/campus-3d.json"));
const lidar = read(join(root, "docs/data/campus-lidar.json"));
const arcgis = read(join(root, "docs/data/campus-arcgis.json"));
const staging = read(join(root, "docs/data/corridor-staging.json"));

/* What campus-massing actually extrudes — assembled ONCE; the full campus
   assembly is not cheap and three gates need it. */
const masses = assembleMasses({ campus, lidar, arcgis, colors: null });
const MASS_KEYS = ["tower", "base"];

const inRing = (x, z, r) => {
  let ins = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, zi] = r[i];
    const [xj, zj] = r[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
};

const vertsOf = (ring) => {
  const v = ring.slice();
  const f = v[0];
  const l = v[v.length - 1];
  if (v.length > 1 && f[0] === l[0] && f[1] === l[1]) v.pop();
  return v;
};

function signedArea(verts) {
  let s = 0;
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

function outwardOf(verts, i, j) {
  const [ax, az] = verts[i];
  const [bx, bz] = verts[j];
  const len = Math.hypot(bx - ax, bz - az) || 1;
  const tx = (bx - ax) / len;
  const tz = (bz - az) / len;
  return signedArea(verts) < 0 ? [-tz, tx] : [tz, -tx];
}

function frameOf(a, b, out) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const tx = (b[0] - a[0]) / length;
  const tz = (b[1] - a[1]) / length;
  const [nx, nz] = out;
  return {
    length,
    at: (u, w) => ({ x: a[0] + tx * u + nx * w, z: a[1] + tz * u + nz * w }),
  };
}

const segLen = (v, i) => {
  const j = (i + 1) % v.length;
  return Math.hypot(v[j][0] - v[i][0], v[j][1] - v[i][1]);
};

/** How much of a face is buried inside a blocker ring, 0..1. */
function buriedFraction(verts, i, blockers, n = 40) {
  const j = (i + 1) % verts.length;
  const fr = frameOf(verts[i], verts[j], outwardOf(verts, i, j));
  let on = 0;
  for (let k = 0; k < n; k++) {
    const p = fr.at(((k + 0.5) * fr.length) / n, 0.6);
    if (blockers.some((r) => inRing(p.x, p.z, r))) on++;
  }
  return on / n;
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
    const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
    if (d < best) best = d;
  }
  return best;
}

/** The union bounding box of the two DRAWN rings, expanded by the section's
    own declared pad — not typed in. */
function envelope() {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const key of MASS_KEYS) {
    for (const [x, z] of section.measured.masses[key].ring) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      z0 = Math.min(z0, z); z1 = Math.max(z1, z);
    }
  }
  const p = section.envelope.pad;
  return { x0: x0 - p, x1: x1 + p, z0: z0 - p, z1: z1 + p };
}

/** The tower roof's (u, v) frame, rebuilt here from the section's own data. */
function roofUV() {
  const verts = vertsOf(section.measured.masses.tower.ring);
  const e = section.roof.frame.originFace;
  const a = verts[e];
  const b = verts[(e + 1) % verts.length];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const tx = (b[0] - a[0]) / len;
  const tz = (b[1] - a[1]) / len;
  const [ox, oz] = outwardOf(verts, e, (e + 1) % verts.length);
  return {
    verts,
    of: (x, z) => [(x - a[0]) * tx + (z - a[1]) * tz, (x - a[0]) * -ox + (z - a[1]) * -oz],
    at: (u, v) => [a[0] + tx * u - ox * v, a[1] + tz * u - oz * v],
  };
}

/** Every instanced transform under a named subgroup, as {x, y, z}. */
function instancesUnder(group, name) {
  const out = [];
  const node = group.getObjectByName(name);
  assert.ok(node, `no ${name} group in the built scene`);
  node.traverse((c) => {
    if (!c.isInstancedMesh) return;
    const m = c.instanceMatrix.array;
    for (let i = 0; i < c.count; i++) {
      out.push({ x: m[i * 16 + 12], y: m[i * 16 + 13], z: m[i * 16 + 14] });
    }
  });
  return out;
}

/** Every transform anywhere in the build — instanced or not. */
function allPoints(group) {
  const out = [];
  group.traverse((c) => {
    if (c.isInstancedMesh) {
      const m = c.instanceMatrix.array;
      for (let i = 0; i < c.count; i++) {
        out.push({ x: m[i * 16 + 12], y: m[i * 16 + 13], z: m[i * 16 + 14] });
      }
    } else if (c.isMesh) {
      out.push({ x: c.position.x, y: c.position.y, z: c.position.z });
    }
  });
  return out;
}

const G = 12.0;
const S = 12.2;
const build = () =>
  createPhotoPodemos(null, { photo: { podemos: section }, heightAt: () => G, surfaceAt: () => S });

/* ------------------------------------------------------------------ gates */

test("the section exists and is reachable", () => {
  assert.ok(section, "no podemos section in the merged doc or the build-side file");
});

test("it says what it is, where it came from, and what it left out", () => {
  assert.match(section.label, /Podemos/i);
  assert.match(section.label, /Eighth College/i);
  assert.ok(section.epoch, "no epoch stamp");
  assert.match(section.epoch, /BLIND|blind/i, "the epoch stamp must name the 2014 blindness");
  assert.match(section.epoch, /parking lot/i,
    "the epoch stamp must say why 'the survey is smooth here' is a void argument over Eighth");
  assert.match(section.note, /INVENTED/, "the note must declare the class");
  assert.ok(Number.isInteger(section.seed), "the seed must be pinned");

  assert.ok(Array.isArray(section.sources) && section.sources.length >= 12,
    `only ${section.sources?.length} sources`);
  for (const s of section.sources) {
    assert.match(s.url, /^(https:\/\/|file:\/\/)/, `source has no usable url: ${JSON.stringify(s)}`);
    assert.match(String(s.date), /^\d{4}(-\d{2})?(-\d{2})?$|^\d{4}-\d{4}$/,
      `source ${s.url} carries no date`);
    assert.ok(s.what && s.what.length > 20, `source ${s.url} does not say what it is for`);
  }

  assert.ok(Array.isArray(section.conflicts) && section.conflicts.length >= 8,
    "the declared source conflicts must stay on the record");
  assert.ok(section.conflicts.some((c) => /9\.5|10\.4/.test(c) && /6\.1/.test(c)),
    "the academic wing's height conflict must stay on the record");
  assert.ok(section.conflicts.some((c) => /eighthcourtyards/.test(c)),
    "the sibling section that builds the same 9185 flight must be named, not silently overruled");
  assert.ok(section.conflicts.some((c) => /PARAPET SCREEN|parapet SCREEN|parapet screen/i.test(c)),
    "the sawtooth roofline-vs-parapet correction must stay on the record");

  /* The absent list is a promise, not a draft. It may grow; it may not shrink. */
  assert.ok(Array.isArray(section.absent) && section.absent.length >= 20,
    `absent has ${section.absent?.length} entries — better absent than wrong, and this list does not shrink`);
  for (const gap of section.absent) assert.equal(typeof gap, "string");
  const has = (re) => section.absent.some((a) => re.test(a));
  assert.ok(has(/PHOTOVOLTAIC/i), "the PV negative must stay in absent");
  assert.ok(has(/9185/) && has(/NUMERALS/i), "the unrendered 9185 numerals must stay in absent");
  assert.ok(has(/WORDMARK/i), "the unfound PODEMOS wordmark must stay in absent");
  assert.ok(has(/REAL HEIGHT/i), "the 9.5 m vs 6.1 m height conflict must stay in absent");
  assert.ok(has(/WEST PROW/i), "the unphotographed west prow must stay in absent");
  assert.ok(has(/CYCLE PITCH/i), "the soft facade cycle pitch must stay in absent");
  assert.ok(has(/SAWTOOTH PITCH/i), "the soft sawtooth absolute must stay in absent");
  assert.ok(has(/CEQA/i), "the unmined CEQA record must stay in absent");
});

test("colours are data, they are hex, and every role carries its provenance", () => {
  const roles = Object.keys(section.colors);
  assert.ok(roles.length >= 28, `only ${roles.length} colours`);
  for (const [k, v] of Object.entries(section.colors)) {
    assert.match(v, /^#[0-9a-f]{6}$/, `${k} is not a lowercase 6-digit hex`);
    const cs = section.colorSources[k];
    assert.ok(cs, `${k} has no colorSources entry`);
    assert.ok(["measured", "[estimated]"].includes(cs.tier), `${k} tier "${cs.tier}" is not measured/[estimated]`);
    assert.ok(cs.source && cs.source.length > 20, `${k} has no real provenance`);
    assert.match(String(cs.date), /^\d{4}(-\d{2})?(-\d{2})?$|^\d{4}-\d{4}$/, `${k} provenance carries no date`);
    if (cs.tier === "[estimated]") {
      assert.match(cs.source, /extends|derived|removed|NOT SAMPLED|ratio|relationship|not sampled/i,
        `${k} is [estimated] but does not say what it extends`);
    }
  }
  for (const k of Object.keys(section.colorSources)) {
    assert.ok(section.colors[k], `colorSources names ${k}, which is not a colour`);
  }
  /* The two samples of the same precast are BOTH kept and neither is averaged
     — that is the whole point of conflicts[8]. */
  assert.notEqual(section.colors.precastPale, section.colors.precastWarm);
  assert.equal(section.colorSources.precastWarm.tier, "measured");
  assert.match(section.colorSources.precastWarm.source, /NOT PAINTED|not painted/,
    "the warmer sample must say it is recorded and not painted");
});

test("the anchor is the DRAWN ArcGIS mass, verbatim, and no 2014 height exists", () => {
  const drawn = masses.filter((m) => m.src === "gis" && /Podemos/i.test(m.name || ""));
  for (const key of MASS_KEYS) {
    const m = section.measured.masses[key];
    const gis = arcgis.massing[m.arcgisIndex];
    assert.equal(gis.n, m.arcgisName, `${key}: arcgisIndex ${m.arcgisIndex} is not ${m.arcgisName}`);
    assert.equal(gis.h, m.h, `${key}: h drifted from the GIS record`);
    assert.equal(gis.levels, m.levels, `${key}: levels drifted from the GIS record`);
    /* Ring verbatim — the file stores DECIMETRES, this section stores metres. */
    const expect = gis.r[0].map(([x, z]) => [x / 10, z / 10]);
    assert.equal(m.ring.length, expect.length, `${key}: ring length differs (closing vertex must be kept)`);
    m.ring.forEach((p, i) => {
      assert.ok(Math.abs(p[0] - expect[i][0]) < 1e-9 && Math.abs(p[1] - expect[i][1]) < 1e-9,
        `${key}: ring vertex ${i} ${JSON.stringify(p)} is not the survey's ${JSON.stringify(expect[i])}`);
    });
    /* And it is what assembleMasses actually extrudes. */
    const hit = drawn.find((d) => d.h === m.h && d.rings.some((r) =>
      r.length === m.ring.length && r[0][0] === m.ring[0][0] && r[0][1] === m.ring[0][1]));
    assert.ok(hit, `${key}: no drawn mass matches this ring and height`);
  }
  assert.ok(drawn.length >= 2, `campus-massing draws only ${drawn.length} Podemos masses`);

  /* The 2014 survey measures this site at parking-lot height: it carries NO
     per-mass roof plane anywhere inside either footprint. */
  const rings = MASS_KEYS.map((k) => vertsOf(section.measured.masses[k].ring));
  for (const key of Object.keys(lidar.massHeights || {})) {
    const m = /^m:(-?\d+),(-?\d+)$/.exec(key);
    if (!m) continue;
    const x = Number(m[1]);
    const z = Number(m[2]);
    for (const r of rings) {
      assert.ok(!inRing(x, z, r), `massHeights ${key} lands inside a Podemos footprint`);
    }
  }
});

test("the storey grid is the drawn prism read back, and the wing's real height stays a conflict", () => {
  for (const key of MASS_KEYS) {
    const m = section.measured.masses[key];
    const storey = m.h / m.levels;
    assert.ok(Math.abs(storey - section.grid.storey) < 1e-9,
      `${key}: drawn storey ${storey} is not the section's ${section.grid.storey}`);
  }
  /* Both masses wear the LRDP formula, and here it AGREES with the sourced
     3.048 m to 2 mm — which is why nothing about the TOWER's height is
     withheld and everything about the WING's is. */
  assert.ok(Math.abs(section.grid.storey - section.grid.floorToFloorSourced) < 0.01,
    "the drawn and sourced storeys agree on this building; say so rather than inventing a conflict");
  assert.equal(section.grid.academicLevels + section.grid.residentialLevels,
    section.measured.masses.tower.levels, "L1-L2 academic + L3-L16 residential must fill the prism");
  assert.equal(section.loggia.count, section.grid.residentialLevels,
    "one loggia per residential floor");

  /* The wing's sourced height is recorded, and NOTHING is built on it. */
  assert.equal(section.measured.masses.base.h, 6.1);
  assert.ok(/9\.5/.test(section.measured.masses.base.hNote), "the sourced 9.5 m must stay on the mass");
  const nums = [];
  (function walk(v) {
    if (typeof v === "number") nums.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) if (!/note|source|why|deriv|measured/i.test(k)) walk(x);
    }
  })({ a: section.academic, p: section.parapet, r: section.roof, e: section.entryStair });
  for (const n of nums) {
    assert.ok(Math.abs(n - 9.5) > 1e-9 && Math.abs(n - 10.4) > 1e-9,
      `the sourced base height ${n} leaked into something that gets built`);
  }
});

test("every facade hangs off two vertices of the ring it names, facing outward", () => {
  const seen = new Set();
  for (const f of section.facades) {
    assert.ok(!seen.has(f.id), `duplicate facade id ${f.id}`);
    seen.add(f.id);
    const m = section.measured.masses[f.mass];
    assert.ok(m, `${f.id} names an unknown mass ${f.mass}`);
    const verts = vertsOf(m.ring);
    assert.ok(f.i >= 0 && f.i < verts.length, `${f.id}: i=${f.i} is not a ring vertex`);
    assert.equal(f.j, (f.i + 1) % verts.length, `${f.id}: j must be the next ring vertex`);
    assert.ok(segLen(verts, f.i) >= 0.3, `${f.id} is a sliver and must not be a facade`);
    /* The outward normal must point AWAY from the solid — checked by stepping
       0.25 m along it and landing OUTSIDE the ring. The wing's ring folds back
       on itself, so the centroid test would be wrong in several places. */
    const [nx, nz] = outwardOf(verts, f.i, f.j);
    const a = verts[f.i];
    const b = verts[f.j];
    const px = (a[0] + b[0]) / 2 + nx * 0.25;
    const pz = (a[1] + b[1]) / 2 + nz * 0.25;
    assert.ok(!inRing(px, pz, verts), `${f.id}'s outward normal points into the mass`);
    assert.ok(f.source && f.source.length > 15, `${f.id} has no source`);
    assert.ok(f.tier, `${f.id} has no tier`);
    if (f.tier === "[estimated]") {
      assert.ok(f.extendsPattern, `${f.id} is [estimated] but names no sourced pattern it extends`);
    }
  }
  /* EVERY ring segment of every mass is either skinned or a declared sliver.
     The wing's ring has 78 segments and 18 of them are survey noise, six of
     zero length from repeated vertices — the list is re-derived here so it
     cannot rot. */
  for (const key of MASS_KEYS) {
    const verts = vertsOf(section.measured.masses[key].ring);
    for (let i = 0; i < verts.length; i++) {
      if (segLen(verts, i) < 0.3) {
        assert.ok(key === "tower" || section.slivers.includes(i),
          `${key} segment ${i} is a ${segLen(verts, i).toFixed(2)} m sliver but is not declared`);
        continue;
      }
      assert.ok(section.facades.some((f) => f.mass === key && f.i === i),
        `${key} ring segment ${i} is skinned by nothing — raw massing would show`);
    }
  }
  const wing = vertsOf(section.measured.masses.base.ring);
  const real = wing.map((_, i) => i).filter((i) => segLen(wing, i) >= 0.3);
  assert.equal(real.length + section.slivers.length, wing.length,
    "the sliver list and the real segments must account for the whole ring");
  for (const i of section.slivers) {
    assert.ok(segLen(wing, i) < 0.3, `sliver ${i} is ${segLen(wing, i).toFixed(2)} m — not a sliver`);
  }
});

test("the interior segments are genuinely buried, and the skinned ones genuinely are not", () => {
  const wing = vertsOf(section.measured.masses.base.ring);
  const tower = vertsOf(section.measured.masses.tower.ring);
  let interior = 0;
  for (const f of section.facades.filter((x) => x.mass === "base")) {
    const frac = buriedFraction(wing, f.i, [tower]);
    if (f.system === "interior") {
      interior++;
      assert.ok(frac > 0.95,
        `${f.id} is declared interior but only ${(100 * frac).toFixed(0)}% of it is inside the tower`);
    } else {
      assert.ok(frac < 0.95,
        `${f.id} is skinned but ${(100 * frac).toFixed(0)}% of it is inside the tower — declare it interior`);
    }
  }
  assert.equal(interior, 26,
    "26 of the wing's ring segments are inside the drawn tower; the premise of every clip in this section");
  /* And the tower really does stand on the wing — 81.6% of its plate. */
  let on = 0;
  let tot = 0;
  for (let x = -92; x < -23; x += 0.5) {
    for (let z = 513; z < 548; z += 0.5) {
      if (!inRing(x, z, tower)) continue;
      tot++;
      if (inRing(x, z, wing)) on++;
    }
  }
  assert.ok(on / tot > 0.75,
    `only ${(100 * on / tot).toFixed(0)}% of the tower's plate stands on the wing — the clip's premise changed`);
});

test("the bay is a COUNT against the surveyed length, on the sourced module", () => {
  const band = section.grid.cycleBand;
  const north = section.facades.find((f) => f.id === "tower-north-long");
  assert.equal(north.cycles, section.grid.cycleCount,
    "the counted 20 cycles across the surveyed 33.50 m north face must survive");
  const verts = vertsOf(section.measured.masses.tower.ring);
  assert.ok(Math.abs(segLen(verts, north.i) / north.cycles - section.grid.cycle) < 1e-6,
    "the module must BE the surveyed length divided by the count");
  for (const f of section.facades.filter((x) => x.mass === "tower" && x.system === "field")) {
    const M = segLen(verts, f.i) / f.cycles;
    assert.ok(M >= band[0] && M <= band[1],
      `${f.id}: ${f.cycles} cycles over the surveyed face gives ${M.toFixed(3)} m, outside ${JSON.stringify(band)}`);
  }
  /* The cycle's three parts are proportions of ONE cycle and they close. */
  const p = section.grid.cycleParts;
  assert.ok(Math.abs(p.ribbed + p.flat + p.window - 1) < 1e-9, "the cycle decomposition must sum to 1");
  const FS = section.facadeSystem;
  assert.ok(Math.abs(FS.ribbed.width - p.ribbed * section.grid.cycle) < 1e-6);
  assert.ok(Math.abs(FS.flat.width - p.flat * section.grid.cycle) < 1e-6);
  assert.ok(Math.abs(FS.window.width - p.window * section.grid.cycle) < 1e-6);
  /* And the room module is two cycles, which is what closed the count. */
  assert.ok(Math.abs(section.grid.roomModule - 2 * section.grid.cycle) < 1e-9);
  /* The pop-out's depth is the sourced flat return, not a chosen number. */
  assert.ok(Math.abs(FS.popOut.depth - FS.flat.width) < 1e-9,
    "the pop-out depth must BE the sourced flat-return width");
  /* The published six degrees, in radians, on both masses. */
  assert.ok(Math.abs(FS.rotation - (6 * Math.PI) / 180) < 1e-4, "6 degrees is a published figure");
  assert.ok(Math.abs(section.academic.l2.fold - section.academic.l2.panelModule * Math.sin(FS.rotation)) < 1e-5,
    "the wing's panel fold must be the module turned through the same published six degrees");
});

test("the sawtooth's RATIOS are preserved exactly, and its heights are derived from them", () => {
  const T = section.academic.sawtooth;
  const storey = section.grid.storey;
  const lid = section.measured.masses.base.h;
  assert.ok(Math.abs(T.pitch / T.peakFromCanopyTop - T.pitchToBandRatio) < 1e-6,
    "pitch : band height must still be the sourced 0.249");
  assert.ok(Math.abs(T.amplitude - T.amplitudeRatio * T.pitch) < 1e-6,
    "amplitude must still be the sourced 0.70 of pitch");
  assert.ok(Math.abs(section.academic.l2.panelModule - T.pitch / 2) < 1e-9,
    "two panels per tooth is sourced; the module must BE half the pitch");
  assert.ok(Math.abs(T.peakAboveLid - (storey + T.peakFromCanopyTop - lid)) < 1e-6,
    "the peak must be derived from the canopy top and the ratio, on the DRAWN lid");
  assert.ok(Math.abs(T.valleyAboveLid - (T.peakAboveLid - T.amplitude)) < 1e-6);
  assert.ok(T.valleyAboveLid > 0.5 && T.peakAboveLid < 2.5,
    "the screen must read as a parapet on the drawn prism, not as a second storey");
  /* The pale : dark ratio is sourced at 2.1 : 1 and the two widths must close. */
  const L2 = section.academic.l2;
  assert.ok(Math.abs(L2.paleWidth + L2.darkWidth - L2.panelModule) < 1e-6);
  assert.ok(Math.abs(L2.paleWidth / L2.darkWidth - 2.1) < 1e-3, "the sourced 2.1 : 1 must survive");
  /* The slot window takes the pale panel's face at the sourced 1 : 3.5. */
  assert.ok(Math.abs(L2.slotWindow.width - L2.paleWidth) < 1e-9);
  assert.ok(Math.abs(L2.slotWindow.height / L2.slotWindow.width - 3.5) < 1e-5);
});

test("no facade layer floats more than 2.2 m off its measured face", () => {
  const FS = section.facadeSystem;
  const reaches = [
    FS.standoff + section.grid.shingleStep + FS.popOut.depth,
    section.loggia.depth,
    section.academic.l1.colonnade.recess,
    section.academic.l1.canopy.projection,
    section.academic.sawtooth.thickness,
  ];
  for (const r of reaches) {
    assert.ok(r <= 2.2, `a facade layer reaches ${r.toFixed(2)} m off the measured wall`);
  }
  /* The colonnade recess is DERIVED from two sourced dimensions, not chosen. */
  const L1 = section.academic.l1;
  assert.ok(Math.abs(L1.colonnade.recess - (L1.canopy.projection + L1.colonnade.columnSize)) < 1e-9,
    "the colonnade setback must BE the sourced canopy projection plus the sourced column face");
});

test("the PV negative is absolute: nothing is built, on either roof", () => {
  assert.equal(section.roof.pv.panels, 0);
  assert.equal(section.roof.pv.racks, 0);
  assert.equal(section.roof.pv.ballastTrays, 0);
  assert.equal(section.academic.roof.pv.panels, 0);
  assert.match(section.roof.pv.note, /ABSENT/);
  assert.match(section.roof.pv.note, /Keeling/, "the positive control that makes the negative credible must be named");
  assert.match(section.roof.pv.note, /2021/, "the superseded design-epoch source must be named");
  /* Scan the DATA, not the prose — the notes rightly say "no PV", and that
     sentence is the finding, not a fixture. Prose keys are stripped and what is
     left is what actually gets built. */
  const PROSE = new Set(["note", "source", "sources", "extendsPattern", "why", "hNote", "ringNote",
    "equipmentSource", "equipmentNote", "membraneNote", "measured", "countSource", "cycleSource",
    "storeyNote", "floorToFloorNote", "levelsNote", "cyclePartsNote", "revealNote", "shingleNote",
    "planTier", "heightDerivation", "riseDerivation", "recessNote", "balustradeNote", "foldNote",
    "ratioNote", "panelModuleNote", "runsWithSlotsNote", "depthNote", "positionRule",
    "rotationSource", "baySource"]);
  const strip = (v) => {
    if (Array.isArray(v)) return v.map(strip);
    if (v && typeof v === "object") {
      return Object.fromEntries(Object.entries(v)
        .filter(([k]) => !PROSE.has(k) && k !== "pv")
        .map(([k, x]) => [k, strip(x)]));
    }
    return v;
  };
  const built = JSON.stringify(strip([section.roof, section.academic, section.parapet]));
  assert.ok(!/photovolta|"pv|ballast|solar|panelRow/i.test(built),
    "no PV hardware may appear in anything this section builds");
  const r = build();
  assert.equal(r.counts.pv, 0);
  assert.equal(r.counts.pvRacks, 0);
  assert.equal(r.counts.pvBallastTrays, 0);
  assert.equal(r.counts.baseRoofPv, 0);
});

test("the 9185 stair's rise is derived, and its recess is the only one that fits", () => {
  const E = section.entryStair;
  assert.ok(Math.abs(E.rise - section.grid.storey / E.risers) < 1e-9,
    "the riser height must BE the drawn storey divided by the sourced count");
  assert.ok(Math.abs(E.totalRise - section.grid.storey) < 1e-9,
    "the flight must climb exactly one drawn storey to the door it serves");
  assert.ok(E.rise <= 0.178, `riser ${E.rise} exceeds the CBC 1011.5.2 maximum`);
  assert.ok(E.tread >= 0.279, `tread ${E.tread} is under the CBC 1011.5.2 minimum`);
  assert.ok(Math.abs(E.rise - 0.155) < 0.02, "the derived riser must sit inside the sourced 0.155 m band");
  assert.ok(Math.abs(E.run - E.risers * E.tread) < 1e-9);
  /* The terrace depth is two stated terms, neither of them chosen. */
  assert.ok(Math.abs(E.terrace.depth - (section.academic.l1.colonnade.recess + 1.525)) < 1e-6,
    "the terrace depth must BE the sourced colonnade recess plus the CBC clear landing");

  /* Re-run the position derivation against the rings rather than trusting it.
     Exactly one of the three surveyed recesses can carry a 9.0 m terrace and an
     8.0 m flight clear of the drawn tower. */
  const wing = vertsOf(section.measured.masses.base.ring);
  const tower = vertsOf(section.measured.masses.tower.ring);
  const reach = E.terrace.depth + E.run + E.door.recessDepth;
  const clear = [];
  assert.equal(section.recesses.length, 3, "the survey draws three east door recesses");
  for (const rc of section.recesses) {
    assert.ok(segLen(wing, rc.back) > 1.5 && segLen(wing, rc.back) < 2.0,
      `${rc.id}: the recess back is not the surveyed 1.7-1.8 m`);
    const fr = frameOf(wing[rc.back], wing[(rc.back + 1) % wing.length],
      outwardOf(wing, rc.back, (rc.back + 1) % wing.length));
    let ok = true;
    for (let i = 0; i <= 12 && ok; i++) {
      for (let j = 0; j <= 12 && ok; j++) {
        const p = fr.at(fr.length / 2 + (i / 12 - 0.5) * E.width, (j / 12) * reach);
        if (inRing(p.x, p.z, tower)) ok = false;
      }
    }
    if (ok) clear.push(rc.id);
  }
  assert.equal(clear.length, 1,
    `${clear.length} recesses clear the drawn tower — the derivation no longer gives one answer`);
  assert.equal(build().counts.stairRecess, clear[0],
    "the built flight must stand at the recess the survey chooses");
});

test("the 9185 numerals are recorded and NOT rendered", () => {
  const s = section.signage;
  assert.equal(s.text, "9185");
  assert.equal(s.built, false);
  assert.equal(section.entryStair.address.built, false);
  assert.ok(section.colors.addressNavy, "the sampled ink colour stays on the record");
  const r = build();
  assert.equal(r.counts.addressBuilt, 0);
  assert.equal(r.counts.wordmarkBuilt, 0);
});

test("the module builds: structure, counts, determinism", () => {
  const a = build();
  assert.ok(a.group instanceof THREE.Group);
  assert.equal(a.group.name, "photo-podemos");
  assert.equal(a.counts.facades, section.facades.length);
  assert.equal(a.counts.loggias, section.loggia.count);
  assert.equal(a.counts.loggiaSlabs, section.loggia.count + 1,
    "a slab under every loggia plus the soffit that closes the top one");
  assert.equal(a.counts.interiorFacades, 26);
  assert.equal(a.counts.roofPenthouses, section.roof.penthouses.length);
  assert.equal(a.counts.roofPenthousesClipped, 0, "every declared penthouse must fit on the drawn roof");
  assert.equal(a.counts.roofEquipment, section.roof.equipment.length);
  assert.equal(a.counts.roofEquipmentClipped, 0, "every declared equipment island must fit on the drawn roof");
  assert.equal(a.counts.stairRisers, section.entryStair.risers);
  assert.equal(a.counts.stairTreadInserts,
    section.entryStair.risers * section.entryStair.treadInsert.perTread);
  assert.equal(a.counts.stairHandrailRuns, section.entryStair.handrail.runs);
  assert.equal(a.counts.porchColumns, section.frontPorch.columns);
  assert.ok(a.counts.ribbedPanels > 900, `only ${a.counts.ribbedPanels} ribbed panels`);
  assert.equal(a.counts.flatReturns, a.counts.ribbedPanels, "one canted return per cycle");
  assert.equal(a.counts.windows, a.counts.ribbedPanels, "one window per cycle");
  assert.equal(a.counts.ventLeaves, a.counts.windows, "one operable leaf per window");
  assert.ok(a.counts.slabReveals >= 14 * 10, "a slab-edge reveal at every floor line of every tower face");
  assert.ok(a.counts.sawtoothSlices > 600, `only ${a.counts.sawtoothSlices} sawtooth slices`);
  assert.ok(a.counts.sawteeth > 100, `only ${a.counts.sawteeth} teeth over the wing's exposed ring`);
  assert.equal(a.counts.screenRuns, a.counts.copingBands,
    "the coping-fascia band runs behind every screen run — it is read through every notch");
  assert.ok(a.counts.parapetSegments > 0 && a.counts.copings === a.counts.parapetSegments,
    "every parapet segment is coped — no roof edge left raw");
  assert.ok(a.counts.formTies > 3000, "the form-tie grid is what identifies the panels as precast");
  assert.ok(a.counts.terraceCoveredRuns >= 1,
    "the wall behind the 9185 terrace must lose its L1 storey — otherwise a storefront is inside a solid");
  assert.ok(a.counts.draws < 90, `${a.counts.draws} draws — instance harder`);

  /* Determinism: a second build is transform-for-transform identical. */
  const b = build();
  assert.deepEqual(a.counts, b.counts);
  const mats = (r) => {
    const out = [];
    r.group.traverse((c) => { if (c.isInstancedMesh) out.push(Array.from(c.instanceMatrix.array)); });
    return out;
  };
  assert.deepEqual(mats(a), mats(b), "two builds must be byte-identical");
});

test("nothing hovers and nothing sinks", () => {
  const r = build();
  const tower = section.measured.masses.tower;
  const roofY = G + tower.h;
  const tallest = Math.max(...section.roof.penthouses.map((p) => p.size[1] + (p.hatch ? p.hatch[1] : 0)));
  for (const p of allPoints(r.group)) {
    assert.ok(p.y > S - 1.5, `something sits at y=${p.y.toFixed(2)}, under the drawn ground ${S}`);
    assert.ok(p.y < roofY + tallest + 1.0,
      `something floats at y=${p.y.toFixed(2)}, above the lid ${roofY} plus its tallest penthouse`);
  }
  /* The wing's roofscape sits on the WING's lid, not the tower's — and the
     sawtooth screen and its warning line are the only things on it. */
  const wingY = G + section.measured.masses.base.h;
  for (const p of instancesUnder(r.group, "podemos-base-roof")) {
    assert.ok(p.y > wingY - 0.1 && p.y < wingY + 0.5,
      `a wing roof item sits at y=${p.y.toFixed(2)}, off the wing lid ${wingY}`);
  }
  /* The tower's roofscape sits on the TOWER's lid. */
  for (const p of instancesUnder(r.group, "podemos-tower-roof")) {
    assert.ok(p.y > roofY - 0.1 && p.y < roofY + tallest + 1.0,
      `a tower roof item sits at y=${p.y.toFixed(2)}, off the tower lid ${roofY}`);
  }
  /* The 9185 terrace is exactly one drawn storey above the wing's datum — the
     door it serves is at the L1/L2 line and nothing about it is a guess. */
  assert.ok(Math.abs(section.entryStair.totalRise - section.grid.storey) < 1e-9);
});

test("the east bay's two surveyed steps are genuinely EMPTY — the clip is asserted by absence", () => {
  const r = build();
  const uv = roofUV();
  const clips = section.roof.clips;
  assert.ok(clips.length >= 2, "both surveyed steps at the east bay must be declared");

  const items = instancesUnder(r.group, "podemos-tower-roof");
  assert.ok(items.length > 400, `only ${items.length} tower-roof items`);
  for (const p of items) {
    assert.ok(inRing(p.x, p.z, uv.verts),
      `a tower-roof item at (${p.x.toFixed(1)}, ${p.z.toFixed(1)}) is off the drawn ring`);
    const [u, v] = uv.of(p.x, p.z);
    for (const c of clips) {
      assert.ok(!(u > c.u0 && u < c.u1 && v > c.v0 && v < c.v1),
        `a tower-roof item stands in clip ${c.id} at (u ${u.toFixed(2)}, v ${v.toFixed(2)})`);
    }
  }
  /* The clips do real work: the walk-pad run is genuinely cut short and the
     seeded curb scatter genuinely loses candidates. */
  assert.ok(r.counts.roofPadsClipped >= 1,
    "the walk-pad run must be clipped where the plate steps — otherwise it cantilevers over open air");
  assert.ok(r.counts.roofCurbsClipped >= 1,
    "the seeded curb scatter must lose candidates to the ring/clip test");
  assert.equal(r.counts.roofCurbs + r.counts.roofCurbsClipped, section.roof.curbs.candidates);
  /* And each clip really is over open air: its centre is outside the mass. */
  for (const c of clips) {
    const [x, z] = uv.at((c.u0 + c.u1) / 2, (Math.max(0, c.v0) + c.v1) / 2);
    assert.ok(!inRing(x, z, uv.verts), `clip ${c.id} is over solid roof, not over a step`);
  }
});

test("the wing is clipped against the tower, not drawn through it", () => {
  const r = build();
  const tower = vertsOf(section.measured.masses.tower.ring);
  for (const p of instancesUnder(r.group, "podemos-base-roof")) {
    assert.ok(!inRing(p.x, p.z, tower),
      `wing roof drawn inside the tower at (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`);
  }
  assert.ok(r.counts.baseRoofClipped > 100,
    "the wing roof must lose a large share of its strips to the tower and the ring");
  /* The finding that forced all of this, recomputed so the number cannot rot:
     the tower's east common-space bay reaches EAST of the wing's own east wall,
     which is why the wing's east elevation is interior over 12 m of z. */
  const wing = vertsOf(section.measured.masses.base.ring);
  const bay = section.facades.find((f) => f.id === "tower-east-loggia-bay");
  const eastMostTower = Math.max(...tower.map((p) => p[0]));
  const eastMostWing = Math.max(...wing.map((p) => p[0]));
  assert.ok(eastMostTower > eastMostWing,
    "the tower's east bay must stand proud of the wing's east wall — the premise of conflicts[3]");
  assert.ok(bay, "the east common-space bay must still be a facade");
});

test("everything stays inside Podemos's declared envelope", () => {
  const e = envelope();
  const r = build();
  for (const p of allPoints(r.group)) {
    assert.ok(p.x >= e.x0 && p.x <= e.x1 && p.z >= e.z0 && p.z <= e.z1,
      `(${p.x.toFixed(1)}, ${p.z.toFixed(1)}) escapes ${JSON.stringify(e)}`);
  }
});

test("nothing invented stands inside another building's drawn footprint", () => {
  /* Podemos's own two rings are excluded: the colonnade, the beds and the wing
     roof are SUPPOSED to be inside them. Everything else on this campus is not. */
  const own = MASS_KEYS.map((k) => vertsOf(section.measured.masses[k].ring));
  const others = masses.filter((m) => !/Podemos/i.test(m.name || "")).flatMap((m) => m.rings);
  const r = build();
  const pts = instancesUnder(r.group, "podemos-ground").concat(
    (() => {
      const out = [];
      const node = r.group.getObjectByName("podemos-ground");
      node.traverse((c) => { if (c.isMesh && !c.isInstancedMesh) out.push(c.position); });
      return out;
    })());
  assert.ok(pts.length > 50, "the ground works must actually have been built");
  for (const p of pts) {
    for (const ring of others) {
      assert.ok(!inRing(p.x, p.z, ring),
        `(${p.x.toFixed(1)}, ${p.z.toFixed(1)}) stands inside another drawn mass`);
    }
  }
  /* The Front Porch is new geometry built OUTWARD off the drawn flank, so its
     outer half must clear Podemos's own survey as well. */
  const porch = r.group.getObjectByName("podemos-front-porch");
  assert.ok(porch, "the Front Porch must be built — Podemos is the one hall that had no team for it");
  const pp = [];
  porch.traverse((c) => {
    if (c.isInstancedMesh) {
      const m = c.instanceMatrix.array;
      for (let i = 0; i < c.count; i++) pp.push({ x: m[i * 16 + 12], z: m[i * 16 + 14] });
    } else if (c.isMesh) pp.push({ x: c.position.x, z: c.position.z });
  });
  assert.ok(pp.length >= 3, "the porch must have a floor, columns and a soffit");
  for (const p of pp) {
    for (const ring of own) {
      assert.ok(!inRing(p.x, p.z, ring),
        `the Front Porch overlaps a Podemos massing ring at (${p.x.toFixed(1)}, ${p.z.toFixed(1)}) — the drawn prism cannot be notched`);
    }
  }
});

test("no solid crowds the scooter corridor", () => {
  let worst = Infinity;
  for (const key of MASS_KEYS) {
    for (const [x, z] of section.measured.masses[key].ring) worst = Math.min(worst, toRoute(x, z));
  }
  const r = build();
  for (const p of instancesUnder(r.group, "podemos-ground")) {
    worst = Math.min(worst, toRoute(p.x, p.z));
  }
  assert.ok(worst >= 3, `closest Podemos geometry is ${worst.toFixed(2)} m from the staging centreline`);
});

test("the module uses the material library, and only deterministic sources", () => {
  const src = readFileSync(join(root, "docs/js/campus-photo-podemos.js"), "utf8");
  assert.match(src, /createMaterialLibrary/, "surfaces come from campus-materials.js");
  assert.match(src, /overlayLift|applyOverlayDepth/, "flat things ride the overlay ladder");
  assert.ok(!/Math\.random|Date\.now|new Date/.test(src), "no nondeterminism in the builder");
  /* Colours are DATA: no hex literal may appear in the module. */
  assert.ok(!/["'#]#[0-9a-fA-F]{6}\b/.test(src) && !/0x[0-9a-fA-F]{6}\b/.test(src),
    "a colour literal leaked into the module — colours are data");
  /* And no 2014 height may be reachable from here. */
  assert.ok(!/massHeights\s*\[|[^-\w]lidar\s*[.[]/.test(src),
    "the module must never read a 2014 height for a building that survey cannot see");
  /* The drawn prism is the only height source: the sourced 9.5 m must not
     appear as a literal anywhere in the builder. */
  assert.ok(!/\b9\.5\b|\b10\.4\b/.test(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")),
    "the sourced base height leaked into the builder as a literal");
});

/* --------------------------------------------------------------------------
 * GATES ADDED BY THE ROUND-THREE REPAIR. Every one of these is a thing the
 * suite above passed while the module was doing it wrong — the whole Ridge Walk
 * ground floor was built INSIDE arcgis.massing[252] and still shipped 21/21
 * green. A finding that was not gated is a finding that comes back.
 * ------------------------------------------------------------------------ */

/** Distance from (x, z) to a ring's boundary. */
function distToRing(x, z, v) {
  let best = Infinity;
  for (let i = 0; i < v.length; i++) {
    const a = v[i];
    const b = v[(i + 1) % v.length];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const L = dx * dx + dz * dz;
    let t = L ? ((x - a[0]) * dx + (z - a[1]) * dz) / L : 0;
    t = Math.max(0, Math.min(1, t));
    best = Math.min(best, Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t)));
  }
  return best;
}

/** Every transform in the build, tagged with the named subgroup it sits under. */
function taggedPoints(group) {
  const out = [];
  (function walk(n, tag) {
    const t = n.name && n.name.startsWith("podemos-") ? n.name : tag;
    /* `drape` is the decal-stack contract campus-overlay.js's applyOverlayDepth
       stamps on a material, so a draped surface can be told apart from a solid
       standing on the same roof without guessing from its height. */
    const drape = !!(n.material && n.material.depthWrite === false);
    if (n.isInstancedMesh) {
      const m = n.instanceMatrix.array;
      for (let i = 0; i < n.count; i++) {
        out.push({ t, drape, x: m[i * 16 + 12], y: m[i * 16 + 13], z: m[i * 16 + 14] });
      }
    } else if (n.isMesh) {
      out.push({ t, drape, x: n.position.x, y: n.position.y, z: n.position.z });
    }
    for (const c of n.children) walk(c, t);
  })(group, "facade");
  return out;
}

/** The Front Porch's own frame, rebuilt from the section rather than trusted. */
function porchFrame() {
  const v = vertsOf(section.measured.masses.base.ring);
  const P = section.frontPorch;
  const i = P.faceIndex;
  const j = (i + 1) % v.length;
  const a = v[i];
  const b = v[j];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const tx = (b[0] - a[0]) / len;
  const tz = (b[1] - a[1]) / len;
  const [nx, nz] = outwardOf(v, i, j);
  return {
    len,
    width: Math.min(P.width, len),
    uw: (x, z) => [(x - a[0]) * tx + (z - a[1]) * tz, (x - a[0]) * nx + (z - a[1]) * nz],
  };
}

test("no L1 layer is pushed INTO the drawn prism — the colonnade stands proud", () => {
  /* The defect this gate exists for: `standoff - recess` put the storefront at
     -1.69 m, the soffit at -0.85, the bed at -1.40 and the columns at -0.25 on
     19 of the 34 wing facades — the entire Ridge Walk elevation — where the
     solid massing swallowed all of it and the building shipped as a brick band
     under a floating precast band with nothing between. The drawn prism cannot
     be notched; a recessed ground floor is made by standing the colonnade OUT,
     which is what campus-photo-keeling.js:316 does. */
  const r = build();
  assert.ok(r.counts.l1ReachMin > 0,
    `an L1 layer sits ${r.counts.l1ReachMin} m BEHIND the drawn face — the massing is solid and it would render as nothing`);
  const L1 = section.academic.l1;
  assert.ok(r.counts.l1ReachMax + L1.colonnade.columnSize / 2 <= 2.2,
    `the outermost L1 layer reaches ${(r.counts.l1ReachMax + L1.colonnade.columnSize / 2).toFixed(2)} m off the measured wall`);
  /* The column occupies the band between the sourced canopy projection and the
     derived setback, so the covered walk under it IS the canopy's 1.2 m walk. */
  assert.ok(Math.abs(r.counts.l1ReachMax - (L1.colonnade.recess - L1.colonnade.columnSize / 2)) < 1e-9,
    "the colonnade column's centre must be the derived setback less half its own sourced face");

  /* And the same thing measured on the built scene rather than on the counter:
     no facade item may be buried deep inside the ring of the mass whose band it
     stands in. The residual is 0.36 m and it is the SURVEY, not a layer — the
     tower's NNW wing face stands a little inside the wing's own west wall where
     the two drawn rings overlap, so an item correctly 0.14 m proud of the tower
     lands just inside the wing. Everything the bug produced was 0.85-2.10 m. */
  const baseRing = vertsOf(section.measured.masses.base.ring);
  const towerRing = vertsOf(section.measured.masses.tower.ring);
  const lid = G + section.measured.masses.base.h;
  let worst = 0;
  let at = null;
  for (const p of taggedPoints(r.group)) {
    if (p.t !== "facade") continue;
    for (const [band, ring] of [[p.y <= lid + 0.05, baseRing], [p.y >= lid, towerRing]]) {
      if (!band || !inRing(p.x, p.z, ring)) continue;
      const d = distToRing(p.x, p.z, ring);
      if (d > worst) { worst = d; at = p; }
    }
  }
  assert.ok(worst < 0.5,
    `a facade item is ${worst.toFixed(2)} m inside its own mass ring at (${at?.x.toFixed(1)}, ${at?.y.toFixed(2)}, ${at?.z.toFixed(1)}) — it renders as nothing`);
});

test("L1 has ONE head datum, and the storefront is full height to it", () => {
  const L1 = section.academic.l1;
  assert.ok(L1.head > 0, "the L1 head line must be declared once, on l1");
  assert.equal(L1.headTier, "sourced");
  assert.ok(L1.headSource && /Learning-7/.test(L1.headSource), "the head line must carry its frame");
  /* The 2.7 m may not be carried twice and then stacked — that is what left a
     0.35 m "full-height glazed storefront" on 260 bays. */
  assert.equal(L1.brick.bandHeight, undefined,
    "brick.bandHeight is the head line under another name; there is one head datum and it lives on l1.head");
  assert.equal(L1.storefront.head, undefined,
    "storefront.head is the same datum again; it must reference l1.head, not restate it");
  assert.equal(L1.storefront.headRef, "academic.l1.head");
  /* The brick that remains is the spandrel, and it is DERIVED from the drawn
     storey and the sourced head — not a third measurement. */
  assert.ok(Math.abs(L1.brick.spandrelHeight - (section.grid.storey - L1.head)) < 1e-9,
    "the brick spandrel must BE the drawn storey less the sourced head");
  assert.equal(L1.brick.spandrelTier, "derived");
  /* And the sourced canopy fascia hangs in exactly that band — two independent
     sourced figures closing on the drawn prism, which is why the head is not
     re-keyed. */
  assert.ok(Math.abs(L1.canopy.fascia - L1.brick.spandrelHeight) < 1e-9,
    "the sourced canopy fascia depth and the derived spandrel band must close");

  /* Measured on the BUILT scene: the storefront is a storey, not a ribbon. */
  const r = build();
  const glass = [];
  r.group.traverse((c) => {
    if (!c.isInstancedMesh || c.geometry.type !== "PlaneGeometry") return;
    const m = c.instanceMatrix.array;
    for (let i = 0; i < c.count; i++) {
      const h = Math.hypot(m[i * 16 + 4], m[i * 16 + 5], m[i * 16 + 6]);
      const d = Math.hypot(m[i * 16 + 8], m[i * 16 + 9], m[i * 16 + 10]);
      const y = m[i * 16 + 13];
      /* Glazing is the module's [w, h, 1] convention; the draped planting beds
         in the same y band are [span, 1, bedWidth] and are not glass. */
      if (Math.abs(d - 1) > 1e-6) continue;
      if (y > S - 1 && y < G + section.grid.storey) glass.push(h);
    }
  });
  assert.ok(glass.length > 200, `only ${glass.length} L1 panes — the storefront must be the whole ground floor`);
  assert.ok(Math.min(...glass) > 2.5,
    `an L1 pane is only ${Math.min(...glass).toFixed(2)} m tall — "full-height glazed" is the source's own phrase`);
});

test("the Front Porch does not build a second eyebrow over its own door", () => {
  const r = build();
  const P = section.frontPorch;
  /* The porch covers exactly the face it declares, and that run is told so. */
  assert.equal(section.facades.find((f) => f.i === P.faceIndex)?.run, P.faceRun,
    "the porch's faceIndex must be a facade of the run it names");
  assert.ok(r.counts.porchCoveredRuns >= 1,
    "the run the porch covers must be split out — otherwise the canopy and the bed are built under the porch roof");
  /* Its roof is this building's own spandrel band, derived twice over. */
  assert.ok(Math.abs(P.clearHeight - section.academic.l1.head) < 1e-9,
    "the porch's clear height must BE the sourced L1 head line");
  assert.ok(Math.abs(P.soffit - section.academic.l1.brick.spandrelHeight) < 1e-9,
    "the porch soffit must BE the same spandrel band the canopy fascia occupies");
  assert.ok(Math.abs(P.depth - section.academic.l1.colonnade.spacing) < 1e-9,
    "the porch is one sourced colonnade bay deep");

  /* And nothing else stands in the room. The measured failure was 50 non-porch
     item centres inside the porch soffit: a canopy fascia, a storefront mullion
     and 48 L2 form ties, with the canopy's own blade hanging inside the clear
     height as a second eyebrow. The wall plane itself is excluded — the porch
     roof abuts the wall, as a porch roof does. */
  const fr = porchFrame();
  const yTop = G + P.clearHeight + P.soffit;
  const intruders = [];
  for (const p of taggedPoints(r.group)) {
    if (p.t === "podemos-front-porch") continue;
    const [u, w] = fr.uw(p.x, p.z);
    if (Math.abs(u - fr.len / 2) < fr.width / 2 && w > 0.25 && w < P.depth && p.y > S - 1 && p.y < yTop) {
      intruders.push(p);
    }
  }
  assert.equal(intruders.length, 0,
    `${intruders.length} non-porch items stand inside the Front Porch's covered room, e.g. ${JSON.stringify(intruders[0])}`);
});

test("every sourced leaf has a consumer, and every unconsumed one is declared", () => {
  const src = readFileSync(join(root, "docs/js/campus-photo-podemos.js"), "utf8");
  /* A sourced element is BUILT or it is in `absent`. `facetedEntry` was
     neither: sourced in phf01, referenced nowhere, declared nowhere. */
  assert.equal(section.academic.l1.facetedEntry, undefined,
    "facetedEntry is sourced and unbuilt; it belongs in absent, not in the data as a silent orphan");
  assert.ok(section.absent.some((a) => /FACETED/i.test(a)),
    "the faceted north-east entry must be declared absent, with its reason");
  /* The corner wedge plate WAS the other one, and it is now built. */
  assert.ok(section.facadeSystem.slabReveal.wedge > 0);
  assert.match(src, /slabReveal\.wedge/, "the sourced corner wedge plate must be read by the builder");
  assert.ok(build().counts.revealCornerWedges > 100,
    "the reveal terminates in a wedge plate at every plan corner of every residential floor");

  /* Colours are data AND they are used: every role is drawn, or it is on the
     declared recorded-and-not-painted list with a reason. Neither direction may
     drift — walkPaverGrey was drawn by nothing and declared nowhere. */
  const recorded = new Set(section.colorsRecordedNotPainted);
  assert.ok(recorded.size >= 3, "the recorded-not-painted list must exist");
  for (const k of Object.keys(section.colors)) {
    const used = new RegExp(`colors\\.${k}\\b`).test(src);
    if (recorded.has(k)) {
      assert.ok(!used, `${k} is declared recorded-and-not-painted but the builder paints it`);
    } else {
      assert.ok(used, `${k} is a colour nothing draws — paint it or declare it in colorsRecordedNotPainted`);
    }
  }
  for (const k of recorded) {
    assert.ok(section.colors[k], `colorsRecordedNotPainted names ${k}, which is not a colour`);
  }
  assert.ok(section.absent.some((a) => /RIDGE WALK PLAZA|paving/i.test(a)),
    "the withheld ground paving that walkPaverGrey belongs to must stay in absent");

  /* No orphan duplicate of the storey: grid.storey is the drawn prism read back
     and there is exactly one of it. */
  assert.equal(section.academic.storey, undefined,
    "academic.storey duplicated grid.storey with no source and no consumer");

  /* And no helper is declared and never used. */
  const decls = [...src.matchAll(/^(?:const|function)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
  for (const name of decls) {
    const hits = src.match(new RegExp(`\\b${name}\\b`, "g")).length;
    assert.ok(hits >= 2, `${name} is declared and never used — dead helper`);
  }
});

test("the roofs' frames, periods and lifts are read, never typed in", () => {
  const src = readFileSync(join(root, "docs/js/campus-photo-podemos.js"), "utf8");
  /* The wing roof's origin face was the literal 57. It is now declared, and the
     declaration is re-derived here: it is the LONGEST segment of the drawn ring,
     which is the only property of it that survives a re-derived ring. */
  const wing = vertsOf(section.measured.masses.base.ring);
  let argmax = 0;
  for (let i = 1; i < wing.length; i++) if (segLen(wing, i) > segLen(wing, argmax)) argmax = i;
  assert.equal(section.academic.roof.frame.originFace, argmax,
    "the wing roof's origin face must be the longest segment of the drawn ring");
  assert.ok(section.academic.roof.frame.note.length > 40, "and it must say why");
  assert.equal(section.roof.frame.originFace, 8, "the tower roof's origin face is the sourced north elevation");
  assert.ok(!/roofFrameOf\([A-Za-z_$][\w$]*,\s*\d/.test(src),
    "a bare ring index was passed to roofFrameOf — the frame is data");

  /* The slot window's period is the sourced everyTeeth, not a typed-in 4. */
  assert.match(src, /everyTeeth/, "the sourced slot-window period must be read");
  const wider = JSON.parse(JSON.stringify(section));
  wider.academic.l2.slotWindow.everyTeeth = 4;
  const sparse = createPhotoPodemos(null,
    { photo: { podemos: wider }, heightAt: () => G, surfaceAt: () => S });
  assert.ok(sparse.counts.slotWindows < build().counts.slotWindows,
    "doubling everyTeeth must halve the slot windows — otherwise the period is hard-coded");

  /* Every draped roof surface rides the ladder's own lift. They were literals
     (0.02 / 0.05 / 0.06), and the terrace deck had none at all — exactly
     coplanar with the terrace solid whose top it is. */
  assert.ok(!/\.\.\.rf\.at\([^\n]*y: roofY \+ 0\./.test(src) && !/terraceY, dc\.z/.test(src),
    "a draped roof strip's lift was written as a literal instead of overlayLift(rung)");
  const r = build();
  const wingY = G + section.measured.masses.base.h;
  /* The tower's two draped rungs, asserted the same way. Everything else on
     that roof is a solid standing on the membrane, not a decal. */
  const towerLifts = new Set(taggedPoints(r.group)
    .filter((p) => p.t === "podemos-tower-roof" && p.drape)
    .map((p) => Math.round((p.y - (G + section.measured.masses.tower.h)) * 1000) / 1000));
  assert.deepEqual([...towerLifts].sort((a, b) => a - b),
    [overlayLift(PAD_RUNG), overlayLift(CARPET_RUNG)],
    "the tower roof's membrane field and its blue-grey walk run must sit on the ladder's own rungs");
  const lifts = new Set(taggedPoints(r.group)
    .filter((p) => p.t === "podemos-base-roof" && p.drape)
    .map((p) => Math.round((p.y - wingY) * 1000) / 1000));
  assert.deepEqual([...lifts].sort((a, b) => a - b),
    [overlayLift(PAD_RUNG), overlayLift(PAINT_RUNG)],
    "the wing roof carries exactly two draped rungs — the membrane field and the painted warning line");
  /* The terrace deck is a CARPET decal above the terrace solid, not coplanar. */
  const deckY = G + section.entryStair.totalRise + overlayLift(CARPET_RUNG);
  const deck = taggedPoints(r.group).filter((p) =>
    p.t === "podemos-entry-stair" && p.drape && Math.abs(p.y - deckY) < 1e-6);
  assert.ok(deck.length >= 1, "the 9185 terrace deck must ride the carpet rung above its own solid");
});

test("the derivations the section states are the derivations it uses", () => {
  const g = section.grid;
  /* Stated as fractions of the storey, and only the fractions are sourced. */
  assert.ok(Math.abs(g.revealBand - Math.round(g.revealFraction * g.storey * 1000) / 1000) < 1e-9,
    "the slab reveal band must BE its sourced fraction of the drawn storey");
  assert.ok(Math.abs(g.shingleStep - Math.round(g.shingleStepFraction * g.storey * 1000) / 1000) < 1e-9,
    "the shingle step must BE its sourced fraction of the drawn storey");

  /* The roof walk run's width and inset are RATIOS of the surveyed slab depth,
     and the ratios are now stated rather than left to be reverse-engineered
     out of a round 1.6 and a round 1.2. */
  const W = section.roof.walkway;
  const slab = section.measured.masses.tower.slabDepth;
  assert.ok(W.widthRatio > 0 && W.insetRatio > 0, "the stated ratios must exist");
  assert.ok(Math.abs(W.width - Math.round(W.widthRatio * slab * 1e6) / 1e6) < 1e-9,
    "the walk run's width must BE its ratio times the surveyed slab depth");
  assert.ok(Math.abs(W.inset - Math.round(W.insetRatio * slab * 1e6) / 1e6) < 1e-9,
    "the walk run's inset must BE its ratio times the surveyed slab depth");
  assert.match(W.extendsPattern, /0\.079|0\.059/, "the ratios must be stated in the pattern it extends");
  /* The cross-legs are the penthouse u values, verbatim. */
  for (const u of W.crossLegs) {
    assert.ok(section.roof.penthouses.some((p) => Math.abs(p.u - u) < 1e-9),
      `cross-leg at u=${u} lands on no penthouse`);
  }

  /* The sawtooth's absolute pitch carries a declared +/- 0.20 m band, and the
     built teeth must stay inside it: `round(span / pitch)` on a short exposed
     run was laying teeth at 0.82 m and 1.80 m, both outside the source. */
  const r = build();
  const [lo, hi] = section.academic.sawtooth.pitchBand;
  assert.ok(r.counts.sawtoothPitchMin >= lo - 1e-9 && r.counts.sawtoothPitchMax <= hi + 1e-9,
    `built tooth pitches run ${r.counts.sawtoothPitchMin.toFixed(3)}-${r.counts.sawtoothPitchMax.toFixed(3)} m, outside the sourced ${JSON.stringify(section.academic.sawtooth.pitchBand)}`);

  /* The stair's four handrail lines are three free-standing plus one carried on
     the wall side — `freeStanding` is sourced and must be read, not ignored. */
  const H = section.entryStair.handrail;
  assert.ok(H.freeStanding < H.runs, "the sourced split is three of four");
  assert.equal(r.counts.stairFreeStandingRuns, H.freeStanding,
    "the sourced free-standing count must be what is built on stanchions");
  assert.ok(r.counts.stairRailBrackets > 0,
    "the wall-side run must be carried on brackets, not on a fourth line of stanchions");
  assert.ok(section.absent.some((a) => /BASE PLATES/i.test(a)),
    "the stanchion base plates are sourced and unresolved in size; they must be declared");

  /* The stair's run is its own count times its own tread. */
  const E = section.entryStair;
  assert.ok(Math.abs(E.run - E.risers * E.tread) < 1e-9);
  assert.ok(Math.abs(E.door.width - 2 * section.academic.l1.storefront.mullion) < 1e-9,
    "the door is two leaves at this building's own sourced mullion module");
});

test("the sibling that builds the same 9185 flight is superseded in writing", () => {
  /* One object, about to exist twice, 40 m apart. This section cannot edit its
     sibling — it owns three files — so it carries the retirement as a
     machine-readable instruction the merge must execute, and the gate is that
     the instruction is present, complete, and names both items. */
  const sup = section.entryStair.supersedes;
  assert.ok(sup, "the sibling claim must be superseded explicitly, not silently outvoted");
  assert.equal(sup.section, "eighthcourtyards");
  assert.ok(Array.isArray(sup.items) && sup.items.length >= 2,
    "both the sibling stair and its forecourt terrace must be named");
  assert.ok(sup.items.some((i) => /S1/.test(i)) && sup.items.some((i) => /forecourt/i.test(i)));
  assert.ok(sup.reason.length > 200 && /absent/i.test(sup.reason),
    "the instruction must say what the merge has to record, and where");
  assert.match(section.conflicts[sup.conflict], /eighthcourtyards/,
    "supersedes must point at the conflict that argues it");
});
