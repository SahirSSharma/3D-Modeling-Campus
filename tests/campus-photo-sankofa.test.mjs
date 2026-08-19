/* Sankofa Hall's photo-sourced detail section (TDLLN Building 4, Eighth College).
 *
 * INVENTED class, so the gates are about quarantine and about not
 * contradicting the measured world — plus the three things that are specific
 * to Eighth and would be silent failures anywhere else:
 *
 *   - the 2014 LiDAR is BLIND to this building, so the section must anchor to
 *     the ArcGIS massing ring and its GIS h, and NO LiDAR massHeight may exist
 *     (or be read) for any of the three masses;
 *   - the tower ring is RE-ENTRANT at the north-east notch, so outward normals
 *     have to come from the winding and the roof must be genuinely EMPTY over
 *     the notch — the clip is asserted by the absence of built geometry, not by
 *     the presence of a clip declaration;
 *   - 74% of the plinth's north-east edge is buried under the tower, so the
 *     plinth's walls, canopy and roof must be clipped against the tower and the
 *     Mid rather than drawn through them.
 *
 * The section will live under the `sankofa` key of
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
import { createPhotoSankofa } from "../docs/js/campus-photo-sankofa.js";
import { assembleMasses } from "../docs/js/campus-massing.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(p, "utf8"));

const merged = read(process.env.PHOTO_DETAIL || join(root, "docs/data/campus-photo-detail.json"));
const section = merged.sankofa;

const campus = read(join(root, "docs/data/campus-3d.json"));
const lidar = read(join(root, "docs/data/campus-lidar.json"));
const arcgis = read(join(root, "docs/data/campus-arcgis.json"));
const staging = read(join(root, "docs/data/corridor-staging.json"));

/* What campus-massing actually extrudes — assembled ONCE; the full campus
   assembly is not cheap and three gates need it. */
const masses = assembleMasses({ campus, lidar, arcgis, colors: null });
const drawn = masses.filter((m) => m.name === "Sankofa" && m.src === "gis");
const otherRings = masses.filter((m) => m.name !== "Sankofa").flatMap((m) => m.rings);

const MASS_KEYS = ["tower", "mid", "base"];

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

/** The union bounding box of the three DRAWN rings, expanded by the section's
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
  createPhotoSankofa(null, { photo: { sankofa: section }, heightAt: () => G, surfaceAt: () => S });

/* ------------------------------------------------ absolute, unfakeable pins

   The round-one gates all read the section's own declaration and compared the
   build against it, so deleting the declaration deleted the gate: an audit
   gutted the building — 19 of 20 loggias, every rooftop unit, every bike rack
   — and still got 18/18 green. Everything below is a LITERAL, pinned to a
   named document or to arithmetic over the survey, and the section is then
   asserted to agree with it. Editing the section cannot move any of them. */

/* eighth.ucsd.edu sankofa-layout-info.pdf: 21 floors, L1 lobby, L2-L21
   residential. */
const LOGGIAS = 20;
/* phf17's counted 15 bays across the surveyed 53.08 m south-east face. */
const LONG_FACE_BAYS = 15;
/* The residential module's own tolerance, and the plinth's two families. The
   section declares all three and is checked AGAINST these, never the reverse. */
const BAY_BAND = [3.2, 3.8];
const BASE_BRICK_BAND = [3.2, 4.3];
const BASE_GLAZED_BAND = [1.7, 1.85];
/* Counted off the plinth edge in phf22 and stored on the facade record. */
const COLONNADE_COLUMNS = 11;
/* Six islands counted south-west to north-east in phf15, plus two penthouses. */
const ROOF_EQUIPMENT = 6;
const ROOF_PENTHOUSES = 2;
/* The two long walkway runs plus a cross-leg to every island, in 1 m strips
   over a 54 m roof: the pad cannot be a token gesture. */
const MIN_ROOF_PADS = 100;
/* One run of standard staple racks under the colonnade. */
const BIKE_HOOPS = 8;
/* base-north-ramble, base-se-storefront and base-ne-amazon each carry a canopy
   run, and the north-east end's is split by the tower burial. */
const MIN_CANOPY_RUNS = 4;
/* Exactly one corner in the drawn ring has a canopy arriving and a canopy
   leaving — base vertex 9. */
const CANOPY_GUSSETS = 1;
/* phf15 and Apple close-00-south: two to four units on the plinth roof, two or
   three on the Mid, plus the Mid's stair box. */
const PLINTH_ROOF_UNITS = 3;
const MID_ROOF_UNITS = 4;
/* Eleven non-shared ring edges carry the tower's and the Mid's roof: 6 + 6 − 1
   for the party wall. Every one of them is coped. */
const COPED_EDGES = 11;

/** Blocks whose every numeric leaf must carry a `figures` row. */
const FIGURE_BLOCKS = [
  "grid", "facadeSystem", "parapet", "loggia",
  "roof.frame", "roof.walkway", "roof.penthouses", "roof.equipment",
  "roof.curbs", "roof.clips", "midRoof",
  "plinth.roof", "plinth.storefront", "plinth.amazon", "plinth.brick",
  "plinth.canopy", "plinth.colonnade", "plinth.bikeRacks",
  "signage", "frontPorch",
];

const at = (obj, path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);

/** Every numeric leaf under `root`, as [normalisedPath, value]. Array indices
    collapse to `[]`, so one figures row covers a whole array. */
function numericLeaves(root, prefix) {
  const out = [];
  (function walk(v, p) {
    if (typeof v === "number") { out.push([p, v]); return; }
    if (Array.isArray(v)) { v.forEach((x) => walk(x, `${p}[]`)); return; }
    if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) walk(x, `${p}.${k}`);
    }
  })(at(section, prefix), prefix);
  return out;
}

/* ------------------------------------------------------------------ gates */

test("the section exists and is reachable", () => {
  assert.ok(section, "no sankofa section in the merged doc or the build-side file");
});

test("it says what it is, where it came from, and what it left out", () => {
  assert.match(section.label, /Sankofa/i);
  assert.match(section.label, /Eighth College/i);
  assert.ok(section.epoch, "no epoch stamp");
  assert.match(section.epoch, /LiDAR is BLIND|blind/i, "the epoch stamp must name the LiDAR blindness");
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

  assert.ok(Array.isArray(section.conflicts) && section.conflicts.length >= 4,
    "the declared source conflicts must stay on the record");

  /* The absent list is a promise, not a draft. It may grow; it may not shrink. */
  assert.ok(Array.isArray(section.absent) && section.absent.length >= 25,
    `absent has ${section.absent?.length} entries — better absent than wrong, and this list does not shrink`);
  for (const gap of section.absent) assert.equal(typeof gap, "string");
  assert.ok(section.absent.some((a) => /PHOTOVOLTAIC/i.test(a)),
    "the PV negative must stay in absent");
  assert.ok(section.absent.some((a) => /wordmark/i.test(a)),
    "the unrendered SANKOFA wordmark must stay in absent");
  assert.ok(section.absent.some((a) => /brick/i.test(a) && /FORMAT/i.test(a)),
    "the unresolved brick format must stay in absent");
  assert.ok(section.absent.some((a) => /membrane/i.test(a) && /HEX/i.test(a)),
    "the deliberately unsampled membrane hex must stay in absent");
  assert.ok(section.absent.some((a) => /REAL height/i.test(a)),
    "the 67.7 m vs 64.0 m height conflict must stay in absent");
  /* The four entrance classes are documented and none is built. Round one
     disclaimed only the residential doors and shipped 46 storefront bays, the
     Amazon frontage and the colonnade glazing with no leaf anywhere. */
  const doors = section.absent.find((a) => /ENTRANCE DOOR/i.test(a));
  assert.ok(doors, "the missing entrance doors must be declared absent, not merely missing");
  for (const kind of [/RESIDENTIAL/i, /RETAIL/i, /AMAZON/i, /COLONNADE/i]) {
    assert.match(doors, kind, "every documented entrance class must be named in the doors entry");
  }
  /* The two things round one built on numbers nobody had. */
  assert.ok(section.absent.some((a) => /GUARDRAIL/i.test(a) && /standoff/i.test(a)),
    "the plaza terrace guardrail's unresolved standoff must be declared, not invented");
  assert.ok(section.absent.some((a) => /POSITIONS/i.test(a) && /scatter/i.test(a)),
    "the unresolved roof-unit positions must be declared as a scatter, not typed");
  assert.ok(section.absent.some((a) => /PIER/i.test(a)),
    "the removed north-east pier must stay on the record");
});

test("every number this section builds from is derived, and says how", () => {
  const figures = section.figures;
  assert.ok(figures && typeof figures === "object", "no `figures` derivation table");
  const seen = new Set();
  let missing = [];
  for (const block of FIGURE_BLOCKS) {
    assert.ok(at(section, block) != null, `FIGURE_BLOCKS names ${block}, which is not in the section`);
    for (const [path] of numericLeaves(section, block)) {
      if (figures[path]) { seen.add(path); continue; }
      missing.push(path);
    }
  }
  assert.deepEqual(missing, [],
    `these numbers get BUILT and carry no derivation — a round number nobody derived is a defect:\n  ${missing.join("\n  ")}`);

  /* And each row has to say something. */
  for (const [path, row] of Object.entries(figures)) {
    if (path === "_") continue;
    assert.ok(seen.has(path), `figures names ${path}, which is not a number this section builds from`);
    assert.ok(["measured", "[estimated]"].includes(row.tier),
      `${path} tier "${row.tier}" is not measured/[estimated]`);
    assert.ok(row.derivation && row.derivation.length > 40,
      `${path} has no real derivation — "${row.derivation}"`);
    if (row.tier === "[estimated]") {
      assert.ok(row.extends && row.extends.length > 3,
        `${path} is [estimated] and names no sourced thing it extends`);
    }
  }

  /* The Keeling bar itself: real product dimensions, named, not rounded.
     keeling.roofs.pv ships a 1.65 x 0.99 m module and a 0.5 x 0.06 x 0.38 m
     ballast tray. Sankofa's equivalents are the guard pipe, the bike rack, the
     storefront profile and the brick unit. */
  assert.equal(section.parapet.rail.bar, 0.048, "NPS 1-1/2 Sch 40 pipe is 48.3 mm OD");
  assert.equal(section.loggia.balustrade.bar, 0.048, "the loggia guard is the same pipe");
  assert.equal(section.plinth.bikeRacks.bar, 0.0603, "NPS 2 Sch 40 pipe is 60.3 mm OD");
  assert.equal(section.plinth.bikeRacks.height, 0.914, "36 in above grade, the standard staple rack");
  assert.equal(section.plinth.bikeRacks.width, 0.61, "24 in between the legs");
  assert.equal(section.plinth.storefront.mullion, 0.051, "the 2 in face of a 2 x 4-1/2 in storefront system");
  assert.equal(section.plinth.storefront.mullionDepth, 0.114, "and its 4-1/2 in depth");
  assert.equal(section.plinth.brick.courseHeight, 0.1016, "the 4 in course of a 4 x 4 x 12 in utility brick");
  assert.equal(section.plinth.brick.unitLength, 0.3048, "and its 12 in length");
  assert.ok(section.sources.some((s) => /astm/i.test(s.url) || /A53/.test(s.what)),
    "the pipe product step must cite its standard");
  assert.ok(section.sources.some((s) => /codes\.iccsafe|CBC|California Building Code/i.test(s.url + s.what)),
    "the code dimensions must cite the code");

  /* Guards are 42 in and the porch is the CBC's own single-run ramp. */
  const CBC_GUARD = 1.067;
  for (const h of [section.parapet.height, section.parapet.rail.height,
    section.loggia.balustrade.height]) {
    assert.equal(h, CBC_GUARD, "CBC 1015.2 is 42 in = 1.0668 m");
  }
  const F = section.frontPorch;
  assert.equal(F.lift, 0.762, "CBC 1012.3 caps a single ramp run at a 30 in rise");
  assert.equal(F.ramp.run, 12 * F.lift, "CBC 1012.2 caps the slope at 1:12");
  assert.ok(F.steps.rise <= 0.1778, `a ${F.steps.rise} m riser exceeds CBC 1011.5.2's 7 in maximum`);
  assert.ok(F.steps.going >= 0.279, `a ${F.steps.going} m going is under CBC 1011.5.2's 11 in minimum`);
  assert.ok(Math.abs(F.steps.count * F.steps.rise - F.lift) < 1e-9,
    "the flight must divide the lift exactly");
});

test("every [estimated] thing extends something MEASURED, not another estimate", () => {
  /* The ultra standard: an estimate extends the same building's SOURCED
     pattern. Round one had two chains that ended in another estimate. */
  const byId = new Map(section.facades.map((f) => [f.id, f]));
  for (const f of section.facades) {
    if (f.tier !== "[estimated]") continue;
    const named = [...byId.keys()].filter((id) => f.extendsPattern.includes(id));
    assert.ok(named.length, `${f.id} names no facade it extends`);
    for (const id of named) {
      assert.equal(byId.get(id).tier, "sourced",
        `${f.id} is [estimated] and extends ${id}, which is itself ${byId.get(id).tier}`);
    }
  }
  const roles = Object.keys(section.colors);
  for (const [k, cs] of Object.entries(section.colorSources)) {
    if (cs.tier !== "[estimated]") continue;
    for (const role of roles) {
      if (role === k) continue;
      /* Only a role named as the thing being EXTENDED counts. */
      if (!new RegExp(`(extends|toward)[^.]*\\b${role}\\b`).test(cs.source)) continue;
      assert.equal(section.colorSources[role].tier, "measured",
        `${k} is [estimated] and extends ${role}, which is itself ${section.colorSources[role].tier}`);
    }
  }
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
      assert.match(cs.source, /extends|derived|removed|NOT SAMPLED|ratio|relationship/i,
        `${k} is [estimated] but does not say what it extends`);
    }
  }
  for (const k of Object.keys(section.colorSources)) {
    assert.ok(section.colors[k], `colorSources names ${k}, which is not a colour`);
  }
  /* The canopy fascia's raw sample is sky-reflecting metal and the blue cast
     had to come out before it fed a material. */
  const f = section.colors.canopyFascia;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(f.slice(i, i + 2), 16));
  assert.ok(b - r <= 2, `canopyFascia ${f} still carries the sky's blue cast`);
});

test("the anchor is the DRAWN ArcGIS mass, verbatim, and no LiDAR height exists", () => {
  assert.equal(drawn.length, 3, "campus-massing must draw exactly three Sankofa masses");
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
    const hit = drawn.find((d) => d.h === m.h && d.rings[0].length === m.ring.length &&
      d.rings[0][0][0] === m.ring[0][0] && d.rings[0][0][1] === m.ring[0][1]);
    assert.ok(hit, `${key}: no drawn mass matches this ring and height`);
    assert.deepEqual(hit.rings[0], m.ring, `${key}: the drawn ring and the section's ring differ`);
  }

  /* The 2014 survey measures this site at parking-lot height: it carries NO
     per-mass roof plane anywhere inside any of the three footprints, so this
     section cannot be reading one. */
  const rings = MASS_KEYS.map((k) => vertsOf(section.measured.masses[k].ring));
  for (const key of Object.keys(lidar.massHeights || {})) {
    const m = /^m:(-?\d+),(-?\d+)$/.exec(key);
    if (!m) continue;
    const x = Number(m[1]);
    const z = Number(m[2]);
    for (const r of rings) {
      assert.ok(!inRing(x, z, r), `LiDAR massHeights ${key} lands inside a Sankofa footprint`);
    }
  }
  /* And the suppressed OSM ring's h = 37.2 must not appear as a datum here. */
  const osm = campus.buildings.find((b) => b.n === "Sankofa");
  assert.ok(osm, "the suppressed OSM Sankofa ring should still exist in campus-3d");
  /* Scan the DATA, not the prose — the anchor block rightly NAMES 37.2 as the
     read it refuses. No numeric datum in it may BE 37.2. */
  const nums = [];
  (function walk(v) {
    if (typeof v === "number") nums.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  })(section.measured.masses);
  assert.ok(!nums.includes(osm.h), `the suppressed OSM h=${osm.h} leaked into the anchor block`);
});

test("the storey grid is the drawn prism read back, and the real height stays a conflict", () => {
  for (const key of MASS_KEYS) {
    const m = section.measured.masses[key];
    const storey = m.h / m.levels;
    assert.ok(storey > 2.8 && storey < 4.4, `${key}: drawn storey ${storey} is not a storey`);
  }
  const tower = section.measured.masses.tower;
  assert.equal(tower.levels, 21);
  assert.ok(Math.abs(tower.h - tower.levels * 3.048) < 0.02,
    "the drawn 64.0 m must be recognised as the 21 x 10 ft formula");
  /* The sourced floor-to-floor is recorded and is NOT what gets extruded. */
  assert.equal(section.grid.floorToFloorSourced, 3.2004);
  assert.ok(Math.abs(tower.h / tower.levels - section.grid.floorToFloorSourced) > 0.1,
    "the sourced and drawn storeys must actually differ — that is the conflict");
  assert.ok(section.conflicts.some((c) => /67\.6|67\.2/.test(c)),
    "the 67.2-67.7 m sourced height must stay on the record");
  assert.ok(section.conflicts.some((c) => /transposed|winding/i.test(c)),
    "the transposed cheek bearings must stay on the record");
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
    const a = verts[f.i];
    const b = verts[f.j];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    assert.ok(len > 0.5, `${f.id} is a ${len.toFixed(2)} m sliver`);
    /* The outward normal must point AWAY from the solid — checked by stepping
       0.4 m along it and landing OUTSIDE the ring. This is the gate that the
       centroid test would fail at the re-entrant notch. */
    const [nx, nz] = outwardOf(verts, f.i, f.j);
    const px = (a[0] + b[0]) / 2 + nx * 0.4;
    const pz = (a[1] + b[1]) / 2 + nz * 0.4;
    assert.ok(!inRing(px, pz, verts), `${f.id}'s outward normal points into the mass`);
    assert.ok(f.source && f.source.length > 15, `${f.id} has no source`);
    assert.ok(f.tier, `${f.id} has no tier`);
    if (f.tier === "[estimated]") {
      assert.ok(f.extendsPattern, `${f.id} is [estimated] but names no sourced pattern it extends`);
    }
    assert.ok(["grade", "plinthRoof", "midRoof"].includes(f.startsAt), `${f.id}: bad startsAt`);
  }
  /* Every ring segment of every mass is either skinned or explicitly shared. */
  for (const key of MASS_KEYS) {
    const verts = vertsOf(section.measured.masses[key].ring);
    for (let i = 0; i < verts.length; i++) {
      assert.ok(section.facades.some((f) => f.mass === key && f.i === i),
        `${key} ring segment ${i} is skinned by nothing — raw massing would show`);
    }
  }
  /* The shared party wall is declared once and skinned by neither mass. */
  const shared = section.facades.filter((f) => f.system === "shared");
  assert.equal(shared.length, 1, "exactly one shared party wall");
  assert.equal(shared[0].mass, "mid");
});

test("the bay is a COUNT against the surveyed length, on the sourced module", () => {
  /* The bands are LITERALS here and the section is checked against them.
     Round one read section.grid.bayBand — the tolerance the gate exists to
     enforce — straight out of the file it was testing, and skipped every base
     face outright. */
  assert.deepEqual(section.grid.bayBand, BAY_BAND);
  assert.deepEqual(section.grid.baseBrickBand, BASE_BRICK_BAND);
  assert.deepEqual(section.grid.baseGlazedBand, BASE_GLAZED_BAND);
  const GLAZED = new Set(["storefront", "brickGlazed", "amazon"]);
  const long = ["tower-se-long", "tower-nw-long"];
  for (const id of long) {
    const f = section.facades.find((x) => x.id === id);
    assert.equal(f.bays, LONG_FACE_BAYS, `${id}: the counted 15 bays off phf17 must survive`);
  }
  for (const f of section.facades) {
    if (!f.bays) continue;
    const band = f.mass !== "base" ? BAY_BAND
      : GLAZED.has(f.system) ? BASE_GLAZED_BAND
      : BASE_BRICK_BAND;
    const verts = vertsOf(section.measured.masses[f.mass].ring);
    const a = verts[f.i];
    const b = verts[f.j];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (f.bays < 2) {
      /* A one-bay face is a surveyed plan JOG (a notch cheek, a step return),
         not a rhythm — but it may not be long enough to be hiding a real
         elevation behind a count of one. */
      assert.ok(len <= 2 * band[1],
        `${f.id} is ${len.toFixed(2)} m on a single bay — too long to be a plan jog`);
      continue;
    }
    const M = len / f.bays;
    assert.ok(M >= band[0] && M <= band[1],
      `${f.id}: ${f.bays} bays over the surveyed face gives ${M.toFixed(3)} m, outside ${JSON.stringify(band)}`);
  }
  /* The storefront mullion is half the tower bay, per the section. */
  const sf = section.facades.find((f) => f.id === "base-se-storefront");
  const verts = vertsOf(section.measured.masses.base.ring);
  const len = Math.hypot(verts[sf.j][0] - verts[sf.i][0], verts[sf.j][1] - verts[sf.i][1]);
  const mull = len / sf.bays;
  assert.ok(Math.abs(mull - section.grid.sourcedBay / 2) < 0.12,
    `storefront mullion ${mull.toFixed(3)} is not half the sourced ${section.grid.sourcedBay} m bay`);

  /* The north-east end's composition is a count over the SAME survey, which is
     what replaced three typed widths that nothing derived. */
  const ne = section.facades.find((f) => f.id === "tower-ne-end");
  const L = section.loggia;
  assert.equal(L.loggiaBays + L.curtainBays + L.pierBays, ne.bays,
    "the loggia, the curtain wall and the pier must partition the counted face exactly");
  assert.equal(L.pierBays, 0, "Apple close-08/orbit-08 read no pier at the north-west corner");
});

test("no facade layer floats more than 1.8 m off its measured face", () => {
  const FS = section.facadeSystem;
  const L = section.loggia;
  const P = section.plinth;
  const reaches = [
    FS.standoff + FS.pleat.foldDepth + FS.panel.thickness,
    FS.standoff + FS.pleat.foldDepth + FS.fin.projection,
    L.slabProjection,
    P.colonnade.recess,
  ];
  for (const r of reaches) {
    assert.ok(r <= 1.8, `a facade layer reaches ${r.toFixed(2)} m off the measured wall`);
  }
  /* The canopy is the one thing allowed further out, and it is a canopy. */
  assert.ok(P.canopy.projection <= 5, `the canopy reaches ${P.canopy.projection} m`);
});

test("the PV negative is absolute: nothing is built, on any roof", () => {
  assert.equal(section.roof.pv.panels, 0);
  assert.equal(section.roof.pv.racks, 0);
  assert.equal(section.roof.pv.ballastTrays, 0);
  assert.equal(section.midRoof.pv.panels, 0);
  assert.match(section.roof.pv.note, /ABSENT/);
  assert.match(section.roof.pv.note, /Keeling/, "the positive control that makes the negative credible must be named");
  assert.match(section.roof.pv.note, /2021/, "the superseded design-epoch source must be named");
  /* And nothing in the built data may name a panel, rack or ballast tray. */
  /* Scan the DATA, not the prose — the notes rightly say "No PV", and that
     sentence is the finding, not a fixture. Prose keys are stripped and what
     is left is what actually gets built. */
  const PROSE = new Set(["note", "source", "sources", "extendsPattern", "why",
    "equipmentSource", "equipmentNote", "membraneNote", "measured", "hNote",
    "countSource", "baySource", "floorToFloorNote", "planTier"]);
  const strip = (v) => {
    if (Array.isArray(v)) return v.map(strip);
    if (v && typeof v === "object") {
      return Object.fromEntries(Object.entries(v)
        .filter(([k]) => !PROSE.has(k) && k !== "pv")
        .map(([k, x]) => [k, strip(x)]));
    }
    return v;
  };
  const built = JSON.stringify(strip([section.roof, section.midRoof, section.plinth]));
  assert.ok(!/photovolta|"pv|ballast|solar|panelRow/i.test(built),
    "no PV hardware may appear in anything this section builds");
  const r = build();
  assert.equal(r.counts.pv, 0);
  assert.equal(r.counts.pvRacks, 0);
  assert.equal(r.counts.pvBallastTrays, 0);
  assert.equal(r.counts.midRoofPv, 0);
});

test("the wordmark is recorded and NOT rendered, on the argo/blake standard", () => {
  const s = section.signage;
  assert.equal(s.text, "SANKOFA");
  assert.equal(s.built, false);
  assert.ok(s.measured.includes("205 px"), "the measured letterform ratios must stay");
  assert.ok(section.colors.wordmarkInk, "the sampled ink colour stays on the record");
  assert.equal(build().counts.wordmarkBuilt, 0);
});

test("the module builds: structure, counts, determinism", () => {
  const a = build();
  assert.ok(a.group instanceof THREE.Group);
  assert.equal(a.group.name, "photo-sankofa");
  assert.equal(a.counts.facades, section.facades.length);

  /* ABSOLUTE counts, pinned to documents and to the survey. A gutted section
     cannot satisfy these, which is the whole point: round one asserted the
     build against the section, so `count: 1` passed three gates at once. */
  assert.equal(section.loggia.count, LOGGIAS, "the layout PDF closes the loggia count at 20");
  assert.match(section.loggia.countSource, /sankofa-layout-info\.pdf/,
    "the count must name the university document that closes it");
  assert.match(section.loggia.countSource, /21 FLOORS/,
    "and quote what that document actually says");
  assert.equal(a.counts.loggias, LOGGIAS);
  assert.equal(a.counts.loggiaDownlights, LOGGIAS,
    "one downlight per loggia — the vertical run is the building's night identity");
  assert.equal(a.counts.loggiaSlabs, 2 * (LOGGIAS + 1),
    "a slab under every loggia on BOTH runs — the north-east end and the notch cheek it wraps onto — plus each run's top soffit");
  assert.equal(a.counts.roofPenthouses, ROOF_PENTHOUSES);
  assert.equal(a.counts.roofEquipment, ROOF_EQUIPMENT,
    "six islands are counted in phf15 and six must be built");
  assert.equal(a.counts.roofEquipmentClipped, 0, "every declared equipment island must fit on the drawn roof");
  assert.ok(a.counts.roofPads > MIN_ROOF_PADS,
    `only ${a.counts.roofPads} walkway strips — the pads run the full roof length in both directions`);
  assert.equal(a.counts.colonnadeColumns, COLONNADE_COLUMNS);
  assert.equal(a.counts.bikeHoops, BIKE_HOOPS, "one run of staple racks under the colonnade");
  assert.equal(a.counts.bikeLegs, 2 * BIKE_HOOPS,
    "each hoop stands on two legs — a bare half-torus is 0.305 m tall, not a bike rack");
  assert.ok(a.counts.canopyRuns >= MIN_CANOPY_RUNS, `only ${a.counts.canopyRuns} canopy runs`);
  assert.equal(a.counts.canopyGussets, CANOPY_GUSSETS,
    "the declared gusset must exist — round one declared gussetLength and built nothing");
  assert.equal(a.counts.plinthRoofUnits, PLINTH_ROOF_UNITS,
    "the plinth roof units must land on plinth roof that exists");
  assert.equal(a.counts.midRoofUnits, MID_ROOF_UNITS, "the Mid's stair box plus its three small units");
  assert.ok(a.counts.membranePanels > 800, `only ${a.counts.membranePanels} membrane panels`);
  assert.ok(a.counts.fins > 900, `only ${a.counts.fins} fins`);
  assert.ok(a.counts.windows > 700, `only ${a.counts.windows} slot windows`);
  assert.equal(a.counts.copings, COPED_EDGES,
    "every non-shared roof edge is coped — including the stepped ones, where the solid parapet is gone entirely");
  assert.ok(a.counts.parapetSegments > 0 && a.counts.parapetSegments <= a.counts.copings,
    "a parapet cannot outnumber the edges it caps");
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
  /* The tallest thing above the lid is the sourced 4.38 m penthouse. */
  const tallest = Math.max(...section.roof.penthouses.map((p) => p.size[1] + (p.hatch ? p.hatch[1] : 0)));
  for (const p of allPoints(r.group)) {
    assert.ok(p.y > S - 1.5, `something sits at y=${p.y.toFixed(2)}, under the drawn ground ${S}`);
    assert.ok(p.y < roofY + tallest + 0.6,
      `something floats at y=${p.y.toFixed(2)}, above the lid ${roofY} plus its tallest penthouse`);
  }
  /* No face is skinned DOWN THROUGH the mass that carries it. The south-west
     end starts at the Mid's parapet 30.5 m up, and an unconditional skirt
     drove a 31 m wall from there straight down through the Mid — caught here,
     not by the y-bounds, because it is an intersection and not a hover. */
  assert.ok(r.counts.deepestSkirt <= 8,
    `a face is skirted ${r.counts.deepestSkirt.toFixed(1)} m below its lowest band — that is a wall through its own carrier`);
  const sw = section.facades.find((f) => f.id === "tower-sw-end");
  assert.equal(sw.startsAt, "midRoof",
    "the south-west end is the shared party wall: only the metres above the Mid's parapet are exposed");

  /* The Mid's roofscape sits on the MID's lid, not the tower's. */
  const midRoofY = G + section.measured.masses.mid.h;
  for (const p of instancesUnder(r.group, "sankofa-mid-roof")) {
    assert.ok(p.y > midRoofY - 0.1 && p.y < midRoofY + 4,
      `a Mid roof item sits at y=${p.y.toFixed(2)}, off the Mid lid ${midRoofY}`);
  }
  /* The plinth's roofscape sits on the PLINTH's lid. */
  const plinthY = G + section.measured.masses.base.h;
  for (const p of instancesUnder(r.group, "sankofa-plinth-roof")) {
    assert.ok(p.y > plinthY - 0.1 && p.y < plinthY + 2,
      `a plinth roof item sits at y=${p.y.toFixed(2)}, off the plinth lid ${plinthY}`);
  }
});

test("the north-east notch is genuinely EMPTY — the clip is asserted by absence", () => {
  const r = build();
  const uv = roofUV();
  const clips = section.roof.clips;
  assert.ok(clips.length >= 1, "the notch clip must be declared");

  /* 1. Every single thing built on the tower roof is wholly inside the drawn
        ring and outside every clip. Not "the clip exists" — the items are
        absent from it. */
  const items = instancesUnder(r.group, "sankofa-tower-roof");
  assert.ok(items.length > 200, `only ${items.length} tower-roof items`);
  for (const p of items) {
    assert.ok(inRing(p.x, p.z, uv.verts),
      `a tower-roof item at (${p.x.toFixed(1)}, ${p.z.toFixed(1)}) is off the drawn ring`);
    const [u, v] = uv.of(p.x, p.z);
    for (const c of clips) {
      assert.ok(!(u > c.u0 && u < c.u1 && v > c.v0 && v < c.v1),
        `a tower-roof item stands in clip ${c.id} at (u ${u.toFixed(2)}, v ${v.toFixed(2)})`);
    }
  }

  /* 2. The clip is doing real work: the walkway pad that would run the length
        of the south-east parapet is genuinely cut short, and the seeded curb
        scatter genuinely loses candidates to it. */
  assert.ok(r.counts.roofPadsClipped >= 1,
    "the south-east walkway run must be clipped at the notch — otherwise it cantilevers over open air");
  assert.ok(r.counts.roofCurbsClipped >= 1,
    "the seeded curb scatter must lose candidates to the ring/clip test");
  assert.ok(r.counts.roofCurbs + r.counts.roofCurbsClipped === section.roof.curbs.candidates);

  /* 3. And the notch really is a hole in the drawn ring: the clip's own centre
        is outside the mass. */
  for (const c of clips) {
    const [x, z] = uv.at((c.u0 + c.u1) / 2, (Math.max(0, c.v0) + c.v1) / 2);
    assert.ok(!inRing(x, z, uv.verts), `clip ${c.id} is over solid roof, not over a notch`);
  }
});

test("the plinth is clipped against the tower and the Mid, not drawn through them", () => {
  const r = build();
  const base = vertsOf(section.measured.masses.base.ring);
  const tower = vertsOf(section.measured.masses.tower.ring);
  const mid = vertsOf(section.measured.masses.mid.ring);
  for (const p of instancesUnder(r.group, "sankofa-plinth-roof")) {
    assert.ok(!inRing(p.x, p.z, tower), `plinth roof drawn inside the tower at (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`);
    assert.ok(!inRing(p.x, p.z, mid), `plinth roof drawn inside the Mid at (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`);
  }
  /* The finding that forced this: 74% of the plinth's 26.93 m north-east edge
     is under the tower. Recomputed here so the number cannot rot. */
  const f = section.facades.find((x) => x.id === "base-ne-amazon");
  const a = base[f.i];
  const b = base[f.j];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const [nx, nz] = outwardOf(base, f.i, f.j);
  let buried = 0;
  const n = 60;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const x = a[0] + (b[0] - a[0]) * t + nx * 0.6;
    const z = a[1] + (b[1] - a[1]) * t + nz * 0.6;
    if (inRing(x, z, tower) || inRing(x, z, mid)) buried++;
  }
  assert.ok(buried / n > 0.6,
    `only ${(100 * buried / n).toFixed(0)}% of the plinth's north-east edge is buried — the clip's premise changed`);
  assert.ok(Math.abs(len - 26.93) < 0.05, "the plinth's north-east edge is the surveyed 26.93 m");
});

test("everything stays inside Sankofa's declared envelope — EXTENTS, not origins", () => {
  const e = envelope();
  const r = build();
  for (const p of allPoints(r.group)) {
    assert.ok(p.x >= e.x0 && p.x <= e.x1 && p.z >= e.z0 && p.z <= e.z1,
      `(${p.x.toFixed(1)}, ${p.z.toFixed(1)}) escapes ${JSON.stringify(e)}`);
  }
  /* The real gate. Round one tested instance ORIGINS only, and the Front Porch
     ramp — a 9 m box whose centre was comfortably inside — reached 1.49 m past
     the envelope's western edge with nothing to catch it. */
  const box = new THREE.Box3().setFromObject(r.group);
  assert.ok(box.min.x >= e.x0 && box.max.x <= e.x1,
    `the built bounding box spans x ${box.min.x.toFixed(2)}..${box.max.x.toFixed(2)}, outside ${e.x0}..${e.x1}`);
  assert.ok(box.min.z >= e.z0 && box.max.z <= e.z1,
    `the built bounding box spans z ${box.min.z.toFixed(2)}..${box.max.z.toFixed(2)}, outside ${e.z0}..${e.z1}`);
});

test("nothing Sankofa builds stands inside Sankofa's OWN drawn solid", () => {
  /* The gate the round-one build had no version of: its self-intersection test
     excluded Sankofa's own three rings, so it structurally could not see the
     19.83 m of Mid parapet and coping standing at y 43.1 INSIDE the tower, or
     the twenty fin returns buried at the re-entrant P3 corner.
     The roof and ground subgroups are excluded because they are SUPPOSED to be
     inside a ring — that is what a roof is. Everything else on the facade must
     be outside the tower it hangs on. */
  const r = build();
  const tower = vertsOf(section.measured.masses.tower.ring);
  const mid = vertsOf(section.measured.masses.mid.ring);
  const midLid = G + section.measured.masses.mid.h;
  const skip = new Set(["sankofa-tower-roof", "sankofa-mid-roof", "sankofa-plinth-roof", "sankofa-ground"]);
  let inTower = 0;
  let inMid = 0;
  const worst = [];
  (function walk(node, under) {
    const u = under || skip.has(node.name);
    if (node.isInstancedMesh && !u) {
      const m = node.instanceMatrix.array;
      for (let i = 0; i < node.count; i++) {
        const x = m[i * 16 + 12];
        const y = m[i * 16 + 13];
        const z = m[i * 16 + 14];
        if (inRing(x, z, tower)) { inTower++; if (worst.length < 5) worst.push([x, y, z]); }
        if (y < midLid && inRing(x, z, mid)) { inMid++; if (worst.length < 5) worst.push([x, y, z]); }
      }
    }
    for (const c of node.children) walk(c, u);
  })(r.group, false);
  assert.equal(inTower, 0, `${inTower} instances stand inside the tower's own drawn ring, e.g. ${JSON.stringify(worst)}`);
  assert.equal(inMid, 0, `${inMid} instances stand inside the Mid's own drawn ring below its lid`);
  /* And the exclusion is not hard-coded: it comes off the `shared` record. */
  const shared = section.facades.find((f) => f.system === "shared");
  assert.equal(shared.i, 4, "the Mid's party wall is ring edge 4, which is the index the parapet skips");
});

test("the Front Porch is on the edges it declares, and its ramp meets the deck", () => {
  const r = build();
  const F = section.frontPorch;
  assert.equal(F.steps.count, r.counts.porchSteps);
  assert.equal(r.counts.porchRamps, 1);
  /* The high end of the ramp's TOP FACE lands on the deck plane, not 0.09 m
     above it — the ramp is a route onto the deck, not a lip to trip on. */
  assert.ok(Math.abs(r.counts.porchRampTopY - r.counts.porchDeckY) < 0.005,
    `the ramp's top face is at ${r.counts.porchRampTopY} against a deck at ${r.counts.porchDeckY}`);
  /* And it is built on the SOUTH edge it declares. Round one declared south
     and built west. */
  assert.equal(F.ramp.edge, "south");
  const box = new THREE.Box3().setFromObject(r.group.getObjectByName("sankofa-ground"));
  assert.ok(box.max.z > F.rect.z1 + F.ramp.run * 0.8,
    `the ramp does not reach south of the deck: ground box max z ${box.max.z.toFixed(2)}`);
  assert.ok(box.min.x > F.rect.x0 - F.steps.count * F.steps.going - 0.5,
    `something on the porch runs west past the step flight: min x ${box.min.x.toFixed(2)}`);
});

test("nothing invented stands inside another building's drawn footprint", () => {
  /* Sankofa's own three rings are excluded: the colonnade, the bike racks and
     the plinth roof are SUPPOSED to be inside them. Everything else on this
     campus is not. The suppressed OSM Sankofa ring is excluded too — it is not
     what campus-massing extrudes. */
  const own = MASS_KEYS.map((k) => vertsOf(section.measured.masses[k].ring));
  const others = otherRings;
  const P = section.frontPorch.rect;
  const pts = [];
  for (const x of [P.x0, P.x1, (P.x0 + P.x1) / 2]) {
    for (const z of [P.z0, P.z1, (P.z0 + P.z1) / 2]) pts.push([x, z]);
  }
  /* Plus the colonnade columns, recomputed from the section's own data. */
  const base = vertsOf(section.measured.masses.base.ring);
  const f = section.facades.find((x) => x.id === "base-nw-colonnade");
  const a = base[f.i];
  const b = base[f.j];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  for (let i = 0; i < f.bays; i++) {
    const t = ((i + 0.5) * len) / f.bays / len;
    pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  for (const [x, z] of pts) {
    for (const ring of others) {
      assert.ok(!inRing(x, z, ring), `(${x}, ${z}) stands inside another drawn mass`);
    }
  }
  /* The Front Porch is new ground geometry and must clear Sankofa's own
     survey too — it lies outside every massing ring, which is the whole
     reason it had to be created rather than cropped. */
  for (const [x, z] of pts.slice(0, 9)) {
    for (const ring of own) {
      assert.ok(!inRing(x, z, ring), `the Front Porch overlaps a Sankofa massing ring at (${x}, ${z})`);
    }
  }
});

test("no solid crowds the scooter corridor", () => {
  let worst = Infinity;
  for (const key of MASS_KEYS) {
    for (const [x, z] of section.measured.masses[key].ring) worst = Math.min(worst, toRoute(x, z));
  }
  const P = section.frontPorch.rect;
  for (const x of [P.x0, P.x1]) for (const z of [P.z0, P.z1]) worst = Math.min(worst, toRoute(x, z));
  assert.ok(worst >= 3, `closest Sankofa geometry is ${worst.toFixed(2)} m from the staging centreline`);
});

test("the module uses the material library, and only deterministic sources", () => {
  const src = readFileSync(join(root, "docs/js/campus-photo-sankofa.js"), "utf8");
  assert.match(src, /(?:shared|create)MaterialLibrary/, "surfaces come from campus-materials.js");
  /* CALLED, not merely imported. The round-one module imported overlayLift and
     never called it, and the old alternation was satisfied by the dead import
     alone while the only ground decal sat at a raw y. */
  assert.match(src, /overlayLift\(/, "flat things ride the overlay ladder's LIFT, not just its depth state");
  assert.match(src, /applyOverlayDepth\(/, "and its depth state");
  assert.ok(!/Math\.random|Date\.now|new Date/.test(src), "no nondeterminism in the builder");
  /* Colours are DATA: no hex literal may appear in the module. */
  assert.ok(!/["'#]#[0-9a-fA-F]{6}\b/.test(src) && !/0x[0-9a-fA-F]{6}\b/.test(src),
    "a colour literal leaked into the module — colours are data");
  /* And no LiDAR height may be reachable from here. */
  assert.ok(!/massHeights\s*\[|[^-\w]lidar\s*[.[]/.test(src),
    "the module must never read a LiDAR height for a building the 2014 survey cannot see");
});
