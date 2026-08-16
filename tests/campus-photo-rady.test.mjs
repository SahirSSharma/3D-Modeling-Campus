/* The Rady School's photo-sourced detail section.
 *
 * This is the INVENTED class, so the gates are the same ones Eighth and
 * Revelle answer to — quarantine, and not contradicting the measured world:
 *
 *   - it is labelled, epoch-stamped and sourced, and it says what it left out;
 *   - colours are data, and they are hex;
 *   - nothing it places sits inside a measured building footprint;
 *   - nothing solid sits within 3 m of the corridor-staging centreline (the
 *     scooter run is nowhere near Rady, so this passes with a huge margin —
 *     it is kept because the day someone extends the route past the Village
 *     is the day it needs to be here already);
 *   - the courtyard paving stays inside the MEASURED plaza polygons between
 *     the halls, and the circular bed under the first palm is the SURVEYED
 *     circle, not an invented one;
 *   - every architectural system hangs off a face whose two ends are real
 *     vertices of the real Otterson or Wells Fargo ring;
 *   - and nothing overtops the LiDAR roof of the hall it hangs on. The
 *     photographs read five glazed storeys at Wells Fargo; the 2014 survey
 *     says 28.4 m, and LiDAR decides height.
 *
 * WHERE THE SECTION LIVES. Under the `rady` key of
 * docs/data/campus-photo-detail.json, merged 2026-08-16.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(p.startsWith("/") ? p : join(root, p), "utf8"));

const PHOTO_DOC = "docs/data/campus-photo-detail.json";
const section = read(PHOTO_DOC).rady;

const campus = read("docs/data/campus-3d.json");
const lidar = read("docs/data/campus-lidar.json");
const staging = read("docs/data/corridor-staging.json");

const OTT = campus.buildings.find((b) => b.n === "Otterson Hall").p;
const WFH = campus.buildings.find((b) => b.n === "Wells Fargo Hall").p;

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

/* Every discrete object the section places. */
const ITEM_GROUPS = [
  "palms", "treeWells", "steps", "handrails", "loungers", "cafeTables",
  "lamps", "bollards", "shrubs", "unda",
];
const solids = () => ITEM_GROUPS.flatMap((k) => section[k].items);

/** Which of the two measured rings a face's endpoints belong to. */
function ringOfFace(f) {
  const isVertex = (ring, p) =>
    ring.some(([x, z]) => Math.abs(x - p[0]) < 0.06 && Math.abs(z - p[1]) < 0.06);
  if (isVertex(OTT, f.a) && isVertex(OTT, f.b)) return "Otterson Hall";
  if (isVertex(WFH, f.a) && isVertex(WFH, f.b)) return "Wells Fargo Hall";
  return null;
}

/** Every face the section carries, with the system that owns it. */
function faces() {
  const out = [];
  const eat = (name, f) => {
    if (f && Array.isArray(f.a) && Array.isArray(f.b)) out.push([name, f]);
  };
  for (const [name, sys] of Object.entries(section.systems)) {
    eat(name, sys.face);
    for (const f of sys.facets || []) eat(name, f);
  }
  eat("unda anchor", section.unda.anchor?.face);
  return out;
}

/**
 * The plan extent of every anchored system, sampled the way the renderer
 * draws it — including the pieces that deliberately run PAST the face: the
 * brise-soleil spikes overshoot the prow's tip and the wing roof runs to a
 * point beyond Otterson's corner, and both have to clear the footprints too.
 */
function systemPoints() {
  const out = [];
  const sample = (f, out0, out1, t0 = 0, t1 = 1) => {
    const ux = (f.b[0] - f.a[0]) / f.length;
    const uz = (f.b[1] - f.a[1]) / f.length;
    for (let i = 0; i <= 10; i++) {
      const t = t0 + ((t1 - t0) * i) / 10;
      for (const o of [out0, out1]) {
        const d = f.standoff + o;
        out.push([f.a[0] + ux * f.length * t + f.n[0] * d, f.a[1] + uz * f.length * t + f.n[1] * d]);
      }
    }
  };
  const s = section.systems;
  const bl = s.blades;
  for (const facet of s.prow.facets) {
    const over = facet.bladeOvershoot ? bl.overshoot / facet.length : 0;
    sample(facet, 0, facet.blades ? bl.projection : 0, 0, 1 + over);
  }
  sample(s.rainscreen.face, 0, s.rainscreen.thickness);
  sample(s.podium.face, 0, s.podium.thickness);
  sample(s.stair.face, 0.6, 0.6 + 2 * s.stair.width);
  sample(s.entrance.face, 0, 0.4);
  sample(s.pylon.face, 0, s.pylon.width, s.pylon.t - 0.01, s.pylon.t + 0.01);
  sample(s.ottersonRoof.face, 0, s.ottersonRoof.overhang, -s.ottersonRoof.point / s.ottersonRoof.face.length, 1);
  sample(s.terraces.face, 0, s.terraces.projection);
  sample(s.cladding.face, 0, s.cladding.thickness);
  sample(s.arcade.face, s.arcade.standoffExtra, s.arcade.standoffExtra);
  for (const it of s.pilotis.items) out.push([it.x, it.z]);
  return out;
}

/** Rady's envelope, taken from the two measured rings rather than typed in. */
function radyBounds() {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z] of [...OTT, ...WFH]) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x);
    z0 = Math.min(z0, z); z1 = Math.max(z1, z);
  }
  return { x0: x0 - 30, z0: z0 - 30, x1: x1 + 30, z1: z1 + 30 };
}

/** The two MEASURED plaza polygons of the palm courtyard. */
function courtyardPlazas() {
  const cen = (p) => p.reduce((a, q) => [a[0] + q[0] / p.length, a[1] + q[1] / p.length], [0, 0]);
  return campus.surfaces.filter((s) => {
    const c = cen(s.p);
    return s.kind === "plaza" && c[0] > -70 && c[0] < -28 && c[1] > -986 && c[1] < -964;
  });
}

const allPoints = () => [
  ...solids().map((it) => [it.x, it.z]),
  ...section.paving.cells,
  ...systemPoints(),
];

test("the rady section exists in the photo document", () => {
  assert.ok(section, `no rady key in ${PHOTO_DOC}`);
});

test("it says what it is, where it came from, and what it left out", () => {
  assert.match(section.label, /Rady/i);
  assert.ok(section.epoch, "no epoch stamp");
  assert.match(section.note, /INVENTED/, "the note must declare the class");
  assert.ok(Array.isArray(section.sources) && section.sources.length >= 8);
  for (const url of section.sources) assert.match(url, /^https:\/\//);
});

test("the deliberate gaps are written down, and the list does not shrink", () => {
  assert.ok(Array.isArray(section.absent) && section.absent.length >= 10,
    `better absent than wrong — only ${section.absent?.length} gaps recorded`);
  for (const gap of section.absent) assert.equal(typeof gap, "string");
  const all = section.absent.join(" ");
  /* The four that would be quietly filled in first if anyone were in a hurry. */
  assert.match(all, /lettering/i, "the sign and UNDA lettering gap must stay declared");
  assert.match(all, /species/i, "the palm species is not sourced and must stay unclaimed");
  assert.match(all, /Sullivan Square/, "Sullivan Square is named but unmapped");
  assert.match(all, /lawn/i, "there is no surveyed lawn polygon on Otterson's ocean slope");
});

test("colours are data, and they are hex", () => {
  const keys = Object.keys(section.colors);
  assert.ok(keys.length >= 20, `only ${keys.length} colours`);
  for (const [k, v] of Object.entries(section.colors)) {
    assert.match(v, /^#[0-9a-f]{6}$/, `${k} is not a lowercase 6-digit hex`);
  }
});

test("every group carries a dated source and some items", () => {
  for (const k of [...ITEM_GROUPS, "paving"]) {
    assert.ok(section[k], `missing group ${k}`);
    assert.match(section[k].source, /\d{4}/, `${k} has no dated source`);
  }
  for (const k of ITEM_GROUPS) {
    assert.ok(section[k].items.length > 0, `${k} is empty`);
    for (const it of section[k].items) {
      assert.ok(Number.isFinite(it.x) && Number.isFinite(it.z), `${k} has a non-finite position`);
    }
  }
  for (const sys of Object.values(section.systems)) {
    assert.match(sys.source, /\d{4}|Design Series/, "every architectural system needs a dated source");
  }
});

test("everything sits inside Rady", () => {
  const b = radyBounds();
  for (const [x, z] of allPoints()) {
    assert.ok(x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1,
      `(${x.toFixed(1)}, ${z.toFixed(1)}) is outside Rady ${JSON.stringify(b)}`);
  }
});

test("nothing invented sits inside a measured building footprint", () => {
  const rings = campus.buildings.filter((b) => b.p && b.p.length >= 3);
  for (const [x, z] of allPoints()) {
    for (const b of rings) {
      assert.ok(!inRing(x, z, b.p),
        `(${x.toFixed(1)}, ${z.toFixed(1)}) is inside ${b.n || "an unnamed mass"}`);
    }
  }
});

test("no solid object crowds the scooter corridor", () => {
  let worst = Infinity;
  let at = null;
  for (const [x, z] of [...solids().map((it) => [it.x, it.z]), ...systemPoints()]) {
    const d = toRoute(x, z);
    if (d < worst) { worst = d; at = [x, z]; }
  }
  assert.ok(worst >= 3, `closest solid is ${worst.toFixed(2)} m from the centreline at ${at}`);
});

test("every architectural system hangs off a measured ring", () => {
  const seen = faces();
  assert.ok(seen.length >= 10, `only ${seen.length} faces found`);
  for (const [name, f] of seen) {
    const ring = ringOfFace(f);
    assert.ok(ring, `${name}'s face ${JSON.stringify(f.a)}-${JSON.stringify(f.b)} is not a measured edge`);
    assert.ok(Math.abs(Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]) - f.length) < 0.02,
      `${name}'s stored length does not match its own endpoints`);
    assert.ok(Math.abs(Math.hypot(f.n[0], f.n[1]) - 1) < 0.02, `${name}'s normal is not a unit vector`);
    /* The normal has to point AWAY from the mass, or the standoff would push
       the cladding into the building instead of off it. */
    const mid = [(f.a[0] + f.b[0]) / 2, (f.a[1] + f.b[1]) / 2];
    const probe = [mid[0] + f.n[0] * (f.standoff + 0.5), mid[1] + f.n[1] * (f.standoff + 0.5)];
    assert.ok(!inRing(probe[0], probe[1], ring === "Otterson Hall" ? OTT : WFH),
      `${name}'s standoff lands inside ${ring}`);
  }
  assert.equal(ringOfFace(section.unda.anchor.face), "Otterson Hall",
    "UNDA is sited off Otterson's measured ocean face");
});

test("nothing overtops the LiDAR roof it hangs on", () => {
  const hOtt = lidar.heights["Otterson Hall"];
  const hWfh = lidar.heights["Wells Fargo Hall"];
  assert.equal(section.measured.ottersonRoofHeight, hOtt, "the recorded Otterson roof drifted from the survey");
  assert.equal(section.measured.wellsFargoRoofHeight, hWfh, "the recorded Wells Fargo roof drifted from the survey");

  const p = section.systems.prow;
  const prowTop = p.undercroft + p.storeys * p.storeyHeight + p.parapet;
  assert.ok(prowTop <= hWfh, `the prow tops out at ${prowTop} above the measured ${hWfh}`);
  assert.ok(section.systems.rainscreen.top <= hWfh, "the rainscreen overtops Wells Fargo");
  assert.ok(section.systems.entrance.baseHeight <= hWfh, "the entrance base overtops Wells Fargo");

  const r = section.systems.ottersonRoof;
  assert.ok(r.height + r.thickness <= hOtt, `the wing roof reaches ${r.height + r.thickness} over ${hOtt}`);
  const t = section.systems.terraces;
  assert.ok(t.base + t.levels * t.levelHeight <= hOtt, "the terraces overtop Otterson");
  assert.ok(section.systems.arcade.height <= hOtt, "the arcade overtops Otterson");
});

test("the courtyard paving stays on the measured plaza polygons", () => {
  const plazas = courtyardPlazas();
  assert.equal(plazas.length, 2, "the two measured courtyard plaza polygons moved");
  const well = section.treeWells.items[0];
  for (const [x, z] of section.paving.cells) {
    const onPlaza = plazas.some((s) => inRing(x, z, s.p));
    assert.ok(onPlaza, `paver (${x}, ${z}) is off the measured courtyard`);
    assert.ok(Math.hypot(x - well.x, z - well.z) >= well.r,
      `paver (${x}, ${z}) is paved over the surveyed planting bed`);
  }
  assert.ok(section.paving.cells.length > 200, "the courtyard is barely paved");
});

test("the first tree well is the SURVEYED circle, not an invented one", () => {
  const well = section.treeWells.items[0];
  assert.equal(well.measured, true, "well 0 must be the measured bed");
  const cen = (p) => p.reduce((a, q) => [a[0] + q[0] / p.length, a[1] + q[1] / p.length], [0, 0]);
  const circle = campus.surfaces.find((s) => {
    if (s.p.length < 12) return false;
    const c = cen(s.p);
    return Math.hypot(c[0] - well.x, c[1] - well.z) < 0.2;
  });
  assert.ok(circle, "no measured circular surface under the first palm");
  const c = cen(circle.p);
  const r = circle.p.reduce((m, [x, z]) => m + Math.hypot(x - c[0], z - c[1]), 0) / circle.p.length;
  assert.ok(Math.abs(r - well.r) < 0.05, `well radius ${well.r} is not the surveyed ${r.toFixed(2)}`);
  for (const w of section.treeWells.items.slice(1)) {
    assert.notEqual(w.measured, true, "only the surveyed bed may claim to be measured");
  }
  /* One palm per well, and the measured bed is the one the first palm uses. */
  assert.equal(section.palms.items.length, section.treeWells.items.length);
  assert.ok(Math.hypot(section.palms.items[0].x - well.x, section.palms.items[0].z - well.z) < 0.05);
});

test("UNDA keeps the one thing about it that is sourced", () => {
  const u = section.unda;
  assert.equal(u.items.length, 5, "UNDA is five stones");
  assert.match(u.source, /stuartcollection|Stuart Collection/i);
  assert.match(u.source, /1987/);
  /* The tops are one elevation — the renderer derives that from the terrain,
     so the DATA must not carry a per-stone Y that could contradict it. */
  for (const it of u.items) {
    assert.equal(it.y, undefined, "a per-stone height would break the one-horizon rule");
  }
  /* The row has to lie ALONG a contour, not across one. The renderer holds
     the tops at a single elevation by drawing each stone from its own ground
     up to a shared top, so a row laid down the bluff would come out as five
     stones of wildly different heights — which is not what the sculpture is.
     The recorded build-time fall is what stops that being moved by accident. */
  assert.ok(u.anchor.groundFallAtBuild < 0.5,
    `UNDA is laid across ${u.anchor.groundFallAtBuild} m of fall — re-run the bearing search`);

  /* A row, not a scatter: consecutive stones one spacing apart. */
  for (let i = 1; i < u.items.length; i++) {
    const d = Math.hypot(u.items[i].x - u.items[i - 1].x, u.items[i].z - u.items[i - 1].z);
    assert.ok(Math.abs(d - u.spacing) < 0.1, `stone ${i} is ${d.toFixed(2)} m from its neighbour`);
  }
});
