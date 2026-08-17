/* The Keeling Apartments' photo-sourced detail section.
 *
 * INVENTED class, so the gates are about quarantine and about not
 * contradicting the measured world:
 *
 *   - it is labelled, epoch-stamped, sourced, and it says what it left out;
 *   - colours are data, and they are hex;
 *   - every facade layer hangs off two vertices of the MEASURED ring it names,
 *     and floats no more than a metre proud of that face;
 *   - nothing it places sits inside a measured building footprint;
 *   - nothing solid sits within 3 m of the corridor-staging centreline —
 *     Keeling is INSIDE the scooter corridor crop, so this one is live;
 *   - the whole section stays inside Keeling's own envelope;
 *   - the absent list does not shrink;
 *   - and every facade element lands on the declared module.
 *
 * The section lives under the `keeling` key of docs/data/campus-photo-detail.json,
 * merged 2026-08-17.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(p, "utf8"));

const MERGED = join(root, "docs/data/campus-photo-detail.json");
const loadSection = () => read(MERGED).keeling;

const section = loadSection();
const campus = read(join(root, "docs/data/campus-3d.json"));
const staging = read(join(root, "docs/data/corridor-staging.json"));

const RINGS = {
  north: "Keeling Apartments North Tower",
  south: "Keeling Apartments South Tower",
  bar: "Keeling Apartments West Bar",
};
const ringOf = (name) => campus.buildings.find((b) => b.n === name).p;

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

/* Keeling's envelope, taken from the three measured rings rather than typed in. */
function keelingBounds(pad = 40) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const name of Object.values(RINGS)) {
    for (const [x, z] of ringOf(name)) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      z0 = Math.min(z0, z); z1 = Math.max(z1, z);
    }
  }
  return { x0: x0 - pad, z0: z0 - pad, x1: x1 + pad, z1: z1 + pad };
}

/* --------------------------------------------------------- sampled points */

/** Every solid thing the section stands on the ground, as (x, z). */
function solids() {
  if (!section) return [];
  const C = section.courtyard;
  const W = section.west;
  const out = [];
  for (const g of [C.lamps, C.chaises, C.racks, C.seatWalls]) {
    for (const it of g) out.push([it.x, it.z]);
  }
  for (const b of W.boulders) out.push([b.x, b.z]);
  for (const w of W.lavaWalls) {
    const n = Math.ceil(Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]) / 2);
    for (let i = 0; i <= n; i++) {
      out.push([w.a[0] + ((w.b[0] - w.a[0]) * i) / n, w.a[1] + ((w.b[1] - w.a[1]) * i) / n]);
    }
  }
  for (const l of C.lawns) {
    for (const x of [l.x0, l.x1]) for (const z of [l.z0, l.z1]) out.push([x, z]);
  }
  return out;
}

/** Flat decals — allowed to cross the corridor, never allowed inside a wall. */
function decals() {
  if (!section) return [];
  const C = section.courtyard;
  const out = [];
  const rects = [...C.paving, ...C.swales, ...section.southSide.apron, ...section.west.slope];
  for (const r of rects) {
    for (const x of [r.x0, r.x1]) for (const z of [r.z0, r.z1]) out.push([x, z]);
  }
  for (const s of C.corten) out.push(s.a, s.b);
  out.push(C.arroyo.a, C.arroyo.b);
  return out;
}

/** The outermost sampled line of every facade layer, at its standoff. */
function facadePoints() {
  if (!section) return [];
  const out = [];
  const reach = Math.max(
    section.systemA.balustrade.standoff + section.systemA.fins.depth,
    section.systemB.ground.recess + section.systemB.ground.columnSize
  );
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

/* ---------------------------------------------------------------- gates */

test("the section exists and is reachable", () => {
  assert.ok(section, `no keeling key in ${MERGED}`);
});

test("it says what it is, where it came from, and what it left out", () => {
  assert.match(section.label, /Keeling/i);
  assert.ok(section.epoch, "no epoch stamp");
  assert.match(section.note, /INVENTED/, "the note must declare the class");
  assert.ok(Array.isArray(section.sources) && section.sources.length >= 6);
  for (const url of section.sources) assert.match(url, /^https:\/\//);
  /* The absent list is a promise, not a draft. It may grow; it may not shrink. */
  assert.ok(Array.isArray(section.absent) && section.absent.length >= 12,
    `absent has ${section.absent?.length} entries — better absent than wrong, and this list does not shrink`);
  for (const gap of section.absent) assert.equal(typeof gap, "string");
  /* The two entries that record real epoch conflicts have to stay named. */
  assert.ok(section.absent.some((a) => /basketball court/i.test(a)),
    "the demolished basketball courts must stay in absent");
  assert.ok(section.absent.some((a) => /module/i.test(a)),
    "the unresolved horizontal module must stay in absent");
});

test("colours are data, and they are hex", () => {
  const keys = Object.keys(section.colors);
  assert.ok(keys.length >= 30, `only ${keys.length} colours`);
  for (const [k, v] of Object.entries(section.colors)) {
    assert.match(v, /^#[0-9a-f]{6}$/, `${k} is not a lowercase 6-digit hex`);
  }
  /* The grating is warm tan. An aggregate crop of it reads near-black, and
     painting the bars that colour turns the building into a brown box. */
  const bar = section.colors.gratingBar;
  const r = parseInt(bar.slice(1, 3), 16);
  const b = parseInt(bar.slice(5, 7), 16);
  assert.ok(r > 150 && r > b, `gratingBar ${bar} is not a light warm tan`);
});

test("the storey grid is the measured heights read back", () => {
  const g = section.grid;
  for (const [key, b] of Object.entries(section.buildings)) {
    const measured = campus.buildings.find((x) => x.n === RINGS[key]).h;
    assert.equal(b.height, measured, `${key} height drifted from the survey`);
    assert.ok(Math.abs(b.storeys * g.floorToFloor + g.parapet - measured) < 1e-6,
      `${key}: ${b.storeys} x ${g.floorToFloor} + ${g.parapet} != measured ${measured}`);
  }
  /* Floor-to-floor and the parapet are whole multiples of the bay. */
  assert.equal(Math.round(g.floorToFloor / g.module), g.floorToFloor / g.module);
  assert.equal(Math.round(g.parapet / g.module), g.parapet / g.module);
});

test("every facade hangs off two vertices of the ring it names", () => {
  const M = section.grid.module;
  for (const f of section.facades) {
    const ring = ringOf(f.ring);
    for (const p of [f.a, f.b]) {
      assert.ok(ring.some(([x, z]) => x === p[0] && z === p[1]),
        `${f.id}: ${JSON.stringify(p)} is not a vertex of ${f.ring}`);
    }
    assert.notDeepEqual(f.a, f.b, `${f.id} is a zero-length face`);
    assert.equal(Math.hypot(f.out[0], f.out[1]) > 0.9, true, `${f.id} has no outward normal`);
    /* The normal points AWAY from the ring's centroid — a facade layer facing
       inward would be built inside the mass and never seen. */
    const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
    const cz = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    const mx = (f.a[0] + f.b[0]) / 2 - cx;
    const mz = (f.a[1] + f.b[1]) / 2 - cz;
    assert.ok(mx * f.out[0] + mz * f.out[1] > 0, `${f.id}'s normal points into the building`);
    assert.ok(f.storeys === section.buildings[
      f.id.startsWith("north") ? "north" : f.id.startsWith("south") ? "south" : "bar"
    ].storeys, `${f.id} disagrees with its building's storey count`);
    assert.match(f.source, /\w/, `${f.id} has no source`);
  }
  /* Both faces of each single-loaded corridor, and both systems present. */
  const systems = new Set(section.facades.map((f) => f.system));
  for (const s of ["A", "B", "End"]) assert.ok(systems.has(s), `no ${s} facade`);
  assert.ok(section.systemOrientation.resolved.length > 40, "the orientation must be written down");
  assert.ok(section.systemOrientation.evidence.length >= 4, "and it must name its frames");
});

test("no facade layer floats more than a metre off its measured face", () => {
  const A = section.systemA;
  const B = section.systemB;
  const reaches = [
    A.standoff + A.slabBand.depth,
    A.balustrade.standoff + A.fins.depth,
    A.balustrade.standoff + A.tabPlate.width,
    B.standoff + B.panel.thickness,
    B.standoff + B.frameBand.depth,
    B.standoff + section.stairSlots.landing.depth,
    B.ground.recess + B.ground.columnSize,
  ];
  for (const r of reaches) {
    assert.ok(r <= 1.0, `a facade layer reaches ${r.toFixed(2)} m off the measured wall`);
  }
});

test("every facade element lands on the declared module", () => {
  const M = section.grid.module;
  const isMul = (v, of) => Math.abs(v / of - Math.round(v / of)) < 1e-9;
  const A = section.systemA;
  assert.ok(Number.isInteger(A.posts.spacingBays), "posts step whole bays");
  assert.ok(Number.isInteger(A.fins.spacingBays), "fins step whole bays");
  assert.ok(Number.isInteger(A.doors.spacingBays), "doors step whole bays");
  assert.ok(isMul(M, A.bars.pitch), `bar pitch ${A.bars.pitch} does not divide the ${M} m bay`);
  for (const w of section.systemB.panel.widthsBays) {
    assert.ok(isMul(w * M, M / 2), `panel width ${w} bays is off the half-module`);
  }
  for (const w of section.systemB.window.widthsBays) {
    assert.ok(isMul(w * M, M / 2), `window width ${w} bays is off the half-module`);
  }
  assert.ok(Number.isInteger(section.systemB.ground.columnSpacingBays));
  for (const s of section.stairSlots.items) {
    assert.ok(Number.isInteger(s.atBay), `stair slot on ${s.face} is not on a bay`);
    const f = section.facades.find((x) => x.id === s.face);
    assert.ok(f, `stair slot names an unknown face ${s.face}`);
    const bays = Math.floor(Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]) / M);
    assert.ok(s.atBay >= 0 && s.atBay + 5 < bays, `stair slot at bay ${s.atBay} runs off ${s.face}`);
  }
});

test("everything sits inside Keeling", () => {
  const b = keelingBounds();
  for (const [x, z] of [...solids(), ...decals(), ...facadePoints()]) {
    assert.ok(x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1,
      `(${x}, ${z}) is outside Keeling ${JSON.stringify(b)}`);
  }
});

test("nothing invented sits inside a measured building footprint", () => {
  const rings = campus.buildings.filter((b) => b.p && b.p.length >= 3);
  for (const [x, z] of [...solids(), ...decals()]) {
    for (const b of rings) {
      assert.ok(!inRing(x, z, b.p), `(${x}, ${z}) is inside ${b.n || "an unnamed mass"}`);
    }
  }
});

test("no solid object crowds the scooter corridor", () => {
  /* Keeling is inside the corridor crop, so this gate is live: the run passes
     south of the South Tower. Flat decals under the track are fine; anything
     you can hit is not. */
  let worst = Infinity;
  let at = null;
  for (const [x, z] of [...solids(), ...facadePoints()]) {
    const d = toRoute(x, z);
    if (d < worst) { worst = d; at = [x, z]; }
  }
  assert.ok(worst >= 3, `closest solid is ${worst.toFixed(2)} m from the centreline at ${at}`);
});

test("the green roof stays on the West Bar", () => {
  const ring = ringOf(RINGS.bar);
  const z0 = Math.min(...ring.map((p) => p[1]));
  const z1 = Math.max(...ring.map((p) => p[1]));
  const G = section.roofs.greenRoof;
  assert.equal(G.roof, "bar", "the vegetated roof is the bar's, not a tower's");
  for (const band of G.bands) {
    assert.ok(band.z0 >= z0 && band.z1 <= z1,
      `green roof band ${band.z0}-${band.z1} runs off the measured bar ${z0}-${z1}`);
    assert.ok(band.z1 > band.z0, "a band with no depth");
    assert.ok(section.colors[band.color], `band colour ${band.color} is not in the palette`);
  }
  const covered = G.bands.reduce((s, b) => s + (b.z1 - b.z0), 0);
  assert.ok(covered > (z1 - z0) * 0.8, "the bands leave most of the bar bare");
});

test("the roof furniture belongs to a roof that exists", () => {
  for (const p of [...section.roofs.pv.banks, ...section.roofs.penthouses]) {
    assert.ok(section.buildings[p.roof], `roof item names unknown building ${p.roof}`);
  }
  /* PV on both towers, per every aerial in the set. */
  const roofs = new Set(section.roofs.pv.banks.map((b) => b.roof));
  assert.ok(roofs.has("north") && roofs.has("south"), "both towers carry PV");
});

test("the demolished south side is not built", () => {
  /* The 2013 landscape aerials show two basketball courts and a parking lot
     below the South Tower. The satellite fetched 2026-08-04 shows a
     construction site on that ground. Newest source wins on what EXISTS, so
     the only thing this section may put there is paving. */
  assert.deepEqual(Object.keys(section.southSide).sort(), ["apron", "note", "source"]);
  assert.match(section.southSide.note, /demolished/i);
  const built = JSON.stringify([section.courtyard, section.southSide.apron, section.west]);
  assert.ok(!/\bcourts?\b|backboard|chain-?link|fence|chain-?link|parking|stall/i.test(built),
    "a court, a fence or a parking stall has been built on ground that no longer carries one");
});
