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
 * merged 2026-08-17. Until the main session merges the 2026-08-17 gap-closure
 * rebuild, it is read from the build-side file the Keeling agent wrote, so
 * this test does not depend on the merge having happened; the fallback goes
 * away with the merge, exactly as ERC's did.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(p, "utf8"));

const section = read(join(root, "docs/data/campus-photo-detail.json")).keeling;
const campus = read(join(root, "docs/data/campus-3d.json"));
const lidar = read(join(root, "docs/data/campus-lidar.json"));
const arcgis = read(join(root, "docs/data/campus-arcgis.json"));
const colors = read(join(root, "docs/data/campus-colors.json"));
const staging = read(join(root, "docs/data/corridor-staging.json"));
const { assembleMasses } = await import(join(root, "docs/js/campus-massing.js"));

const RINGS = {
  north: "Keeling Apartments North Tower",
  south: "Keeling Apartments South Tower",
  bar: "Keeling Apartments West Bar",
};
const ringOf = (name) => campus.buildings.find((b) => b.n === name).p;

/* The DRAWN masses — exactly what campus-massing extrudes on screen. The
   measured blocks and the facade endpoints must match THESE, not the
   suppressed OSM copies in campus-3d.json (which are simplified to 6-9
   points and sit up to 4.5 m off the drawn wall — the audited full-height
   corner slots of raw massing) and not the raw campus-lidar lookup (2.2 m
   over the South Tower's reconciled extrusion). */
const drawn = {};
for (const m of assembleMasses({ campus, lidar, arcgis, colors })) {
  if (/^Keeling Apartments/.test(m.name || "")) {
    const ring = m.rings[0].slice();
    const [f, l] = [ring[0], ring[ring.length - 1]];
    if (f[0] === l[0] && f[1] === l[1]) ring.pop();
    drawn[m.name] = { ring, h: m.h };
  }
}
const drawnRingOf = (name) => drawn[name].ring;

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
  const rects = [
    ...C.paving, ...C.swales, ...section.southSide.apron, ...section.west.slope,
    ...(section.southSide.courts || []),
    ...(section.southSide.surround ? [section.southSide.surround] : []),
  ];
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
  assert.ok(section, "no keeling key in docs/data/campus-photo-detail.json");
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
    const ring = drawnRingOf(f.ring);
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
    B.standoff + B.rainScreen.proud + B.panel.thickness,
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
  /* PV on both towers, per every aerial in the set — and NEVER on the bar,
     whose roof is the vegetated one. */
  const roofs = new Set(section.roofs.pv.banks.map((b) => b.roof));
  assert.ok(roofs.has("north") && roofs.has("south"), "both towers carry PV");
  assert.ok(!roofs.has("bar"), "the West Bar roof carries NO PV");
  /* Two penthouses per tower: a ~3 m stair overrun and a ~2.5 m plant box. */
  for (const key of ["north", "south"]) {
    const kinds = section.roofs.penthouses.filter((p) => p.roof === key).map((p) => p.kind).sort();
    assert.deepEqual(kinds, ["plant", "stair"], `${key} roof penthouses`);
  }
});

test("the PV canopy is gone: low ballasted racks on the membrane", () => {
  /* Gap-closure 2026-08-17: there is no canopy, no columns, nothing to walk
     under — four independent images agree. What is there is low ballasted
     tilt racking directly on the tower membranes. */
  const P = section.roofs.pv;
  assert.ok(!("postHeight" in P), "the canopy-era rack schema is gone");
  assert.ok(P.panel[0] > P.panel[1], "single-module rows are LANDSCAPE");
  assert.ok(P.tilt <= 0.175 && P.tilt > 0.05, `tilt ${P.tilt} rad is not the sourced 5-10 deg`);
  assert.ok(P.lowEdge >= 0.15 && P.lowEdge <= 0.25, `low edge ${P.lowEdge} off the sourced 0.15-0.25 m`);
  assert.ok(P.rowPitch >= 2.0 && P.rowPitch <= 2.3, `row pitch ${P.rowPitch} off the measured 2.0-2.3 m`);
  assert.ok(P.inset >= 1.5 && P.inset <= 2.5, `parapet inset ${P.inset} off the sourced 1.5-2.5 m`);
  assert.ok(Array.isArray(P.ballastTray), "the racks stand on ballast trays");
  for (const b of P.banks) {
    assert.ok(b.rows >= 5 && b.rows <= 7, `${b.roof}: ${b.rows} rows off the sourced 5-7`);
    /* The clips that keep hardware off each tower's notch must stay. */
    assert.ok(Array.isArray(b.clips) && b.clips.length >= 1, `${b.roof} bank has no notch clip`);
  }
  assert.match(P.note, /DELETED/i, "the deletion of the invented canopy must stay on the record");
});

test("the white band is the 1.20 m parapet, with the rail, on all faces", () => {
  const PB = section.roofs.parapet;
  assert.equal(PB.height, section.grid.parapet,
    "the parapet band IS the derived 1.20 m parapet, not a new number");
  assert.ok(PB.revealHeight > 0 && PB.revealHeight < 0.2, "thin shadow reveal at the base");
  assert.ok(PB.rail.height >= 1.0 && PB.rail.height <= 1.2, "the inboard rail is ~1.1 m");
  assert.ok(PB.rail.inset > 0, "the rail stands INBOARD of the coping");
  /* Brighter and smoother than the precast field (a7_topband). */
  const luma = (hex) =>
    0.299 * parseInt(hex.slice(1, 3), 16) + 0.587 * parseInt(hex.slice(3, 5), 16) + 0.114 * parseInt(hex.slice(5, 7), 16);
  assert.ok(luma(section.colors.parapetWhite) > luma(section.colors.precastPanel),
    "parapetWhite must read brighter than the precast field");
});

test("the north faces are System B rain-screen, and the estimate is declared", () => {
  const B = section.systemB;
  assert.ok(B.rainScreen.proud >= 0.15 && B.rainScreen.proud <= 0.25,
    `rain-screen proud ${B.rainScreen.proud} off the sourced 0.15-0.25 m`);
  const nn = section.facades.find((f) => f.id === "north-north");
  const sn = section.facades.find((f) => f.id === "south-north");
  assert.equal(nn.system, "B");
  assert.equal(sn.system, "B");
  /* South Tower's north face is photographed; the North Tower's extends it
     and must SAY so. */
  assert.match(sn.source, /a7_northface|ls_007/, "south-north must cite its head-on photograph");
  assert.equal(nn.estimated, true, "north-north's arrangement is [estimated] and must be declared");
  assert.equal(nn.patternRef, "south-north", "the estimate must name the pattern it extends");
  assert.match(nn.source, /estimated/i);
  assert.match(section.systemOrientation.estimated, /\[estimated\]/);
});

test("the terrace pergolas stand on the bar roof, inside the bar", () => {
  const T = section.roofs.terrace;
  assert.equal(T.roof, "bar", "the pergola terrace is the West Bar's");
  const ring = ringOf(RINGS.bar);
  const z0 = Math.min(...ring.map((p) => p[1]));
  const z1 = Math.max(...ring.map((p) => p[1]));
  for (const d of [...T.decks, ...T.pergolas.map((p) => ({ z0: p.z - T.pergola.d / 2, z1: p.z + T.pergola.d / 2 }))]) {
    assert.ok(d.z0 >= z0 && d.z1 <= z1, `terrace piece ${d.z0}-${d.z1} runs off the measured bar`);
  }
});

test("the courts are the CURRENT epoch: blue, flat, and honest about it", () => {
  /* The declared epoch conflict: dark green in every 2013 aerial, resurfaced
     BLUE in the gap-closure reading of the current orthophoto. Newest reading
     wins on appearance. And because the staging route crosses their NE
     corner, the courts are DECALS — nothing above the surface. */
  const S = section.southSide;
  assert.equal(S.courts.length, 2, "two courts, per every source that shows them");
  const hex = (h, i) => parseInt(h.slice(i, i + 2), 16);
  const blue = section.colors.courtBlue;
  assert.ok(hex(blue, 5) > hex(blue, 1) && hex(blue, 5) > hex(blue, 3),
    `courtBlue ${blue} is not blue — the 2013 green is a dead epoch`);
  assert.match(S.note, /epoch/i, "the epoch conflict must stay on the record");
  assert.match(S.note, /estimated/i, "the unsampled court hex must be declared estimated");
  for (const c of S.courts) {
    assert.deepEqual(Object.keys(c).sort(), ["x0", "x1", "z0", "z1"],
      "a court is a flat rect — no height, no furniture");
  }
  /* Scan the DATA, not the prose — the note rightly names what is absent. */
  const { note: _n, source: _s, ...builtSouth } = S;
  const built = JSON.stringify([section.courtyard, builtSouth, section.west]);
  assert.ok(!/backboard|chain-?link|\bfence\b|\bstall\b|\bpole\b.{0,20}court/i.test(built),
    "nothing may stand above the court surface — the route crosses it");
  assert.ok(section.absent.some((a) => /hoops|backboard/i.test(a)),
    "the unbuilt court furniture must be declared absent");
});

/* ----------------------------------------------- the module, run for real */

test("the module builds the section: structure, seating, determinism", async () => {
  const THREE = await import("../docs/vendor/three/three.module.min.js");
  const { createPhotoKeeling } = await import("../docs/js/campus-photo-keeling.js");
  const photo = { keeling: section };
  const ground = () => 12.4;
  const build = () =>
    createPhotoKeeling(null, { photo, heightAt: () => 12.2, surfaceAt: ground });

  const a = build();
  assert.ok(a.group instanceof THREE.Group);
  assert.equal(a.counts.facades, section.facades.length);
  assert.equal(a.counts.courts, 2);
  assert.equal(a.counts.pergolas, section.roofs.terrace.pergolas.length);
  assert.ok(a.counts.parapetRail > 0, "the fall-protection rail is built");
  assert.ok(a.counts.pv > 100, "the PV rows are built");
  assert.ok(a.counts.panels > 0 && a.counts.windows > 0);

  /* Determinism: an identical second build produces identical instance
     transforms — no Math.random, no Date.now, anywhere in the chain. */
  const b = build();
  assert.deepEqual(a.counts, b.counts);
  const mats = (r) =>
    r.group.children
      .filter((c) => c.isInstancedMesh)
      .map((c) => Array.from(c.instanceMatrix.array));
  assert.deepEqual(mats(a), mats(b), "two builds must be byte-identical");

  /* Seating: every instanced transform stays above the surface it stands on
     minus a burial allowance — nothing floats below the world, and nothing
     roof-mounted floats above the parapet plane plus its own declared height. */
  const maxRoof = Math.max(...Object.values(section.buildings).map((x) => x.height));
  for (const c of a.group.children.filter((x) => x.isInstancedMesh)) {
    const m = c.instanceMatrix.array;
    for (let i = 0; i < c.count; i++) {
      const y = m[i * 16 + 13];
      assert.ok(y > 12.4 - 2, `an instance sits at y=${y}, under the ground`);
      assert.ok(y < 12.2 + maxRoof + 4, `an instance floats at y=${y}, above the roofscape`);
    }
  }
});

test("the skin seats on the DRAWN box: racks behind the parapet, roofscape on the lid", async () => {
  /* The visual-audit failure of 2026-08-17: the section's photogrammetric
     heights (campus-3d's OSM side, 37.2/30.0/22.8) are 2.8-4.6 m taller than
     the 2014 LiDAR heights campus-massing actually extrudes (34.4/29.2/18.2).
     Anchored to the taller claim, the parapet, the PV racks and the whole
     green roof floated above the drawn lid, with a phantom top storey you
     could see straight through. The module now anchors to
     `buildings.*.measured` — this test attaches those blocks from the same
     repo files the merge copies them from, so it pins the rule whether or
     not the data merge has landed yet. */
  const { createPhotoKeeling } = await import("../docs/js/campus-photo-keeling.js");
  const sectionM = structuredClone(section);
  for (const [key, name] of Object.entries(RINGS)) {
    sectionM.buildings[key].measured = {
      ring: drawn[name].ring,
      drawnHeight: drawn[name].h,
      source: "test-attached, verbatim from assembleMasses over the shipped files",
    };
  }
  const G = 12.2;
  const r = createPhotoKeeling(null, { photo: { keeling: sectionM }, heightAt: () => G, surfaceAt: () => G + 0.2 });

  /* On flat ground the drawn lid is G + the reconciled extruded height. */
  const deck = {};
  for (const [key, name] of Object.entries(RINGS)) deck[key] = G + drawn[name].h;
  const PB = sectionM.roofs.parapet.height;

  /* The PV panels: every module sits ON a tower lid and UNDER that lid's
     parapet top — never in the storey below, never proud of the band. */
  const pvMesh = r.group.children.find(
    (c) => c.isInstancedMesh && c.geometry?.parameters?.width === sectionM.roofs.pv.panel[0]
  );
  assert.ok(pvMesh, "no PV panel mesh");
  for (let i = 0; i < pvMesh.count; i++) {
    const y = pvMesh.instanceMatrix.array[i * 16 + 13];
    const seated = ["north", "south"].some((k) => y > deck[k] && y < deck[k] + PB);
    assert.ok(seated, `a PV module floats at y=${y} (lids ${deck.north}, ${deck.south})`);
  }

  /* The green-roof clumps (agave cones) stand on the BAR lid, not in the air. */
  const agave = r.group.children.find(
    (c) => c.isInstancedMesh && c.geometry?.type === "ConeGeometry" && c.geometry.parameters.radius === 0.42
  );
  assert.ok(agave, "no agave clump mesh");
  for (let i = 0; i < agave.count; i++) {
    const y = agave.instanceMatrix.array[i * 16 + 13];
    assert.ok(y > deck.bar && y < deck.bar + 1.5, `a green-roof clump floats at y=${y} (bar lid ${deck.bar})`);
  }

  /* Nothing anywhere stands above lid + parapet except the penthouses (3 m). */
  for (const c of r.group.children.filter((x) => x.isInstancedMesh)) {
    for (let i = 0; i < c.count; i++) {
      const y = c.instanceMatrix.array[i * 16 + 13];
      assert.ok(y < deck.north + 3.2, `an instance floats at y=${y}, above lid+penthouse`);
    }
  }

  /* The notch-coverage count has its own test above, against the exact rings. */
  assert.ok(r.counts.notchFaces > 0, "the uncovered ring segments must be skinned");
});

test("the measured blocks are verbatim copies of the DRAWN massing", () => {
  /* The 2026-08-18 corner-slot repair (Sahir's shot 5): the measured rings
     used to be copied from campus-3d.json — the SUPPRESSED simplified OSM
     rings, off the wall campus-massing actually extrudes by up to 4.5 m, so
     the skins stopped short of every true corner and left full-height slots
     of raw massing. The blocks must equal what assembleMasses draws, exactly
     — every vertex (24 for the bar), and the reconciled extruded height. */
  for (const [key, name] of Object.entries(RINGS)) {
    const m = section.buildings[key].measured;
    assert.ok(m, `${key} has no measured block`);
    assert.deepEqual(m.ring, drawn[name].ring,
      `${key}.measured.ring is not the verbatim massing ring campus-massing extrudes`);
    assert.equal(m.drawnHeight, drawn[name].h,
      `${key}.measured.drawnHeight is not the reconciled height campus-massing extrudes`);
  }
});

test("every drawn ring segment is skinned: declared facade or notch wall", async () => {
  /* The notch loop's coverage test walked exact endpoint keys and skipped
     segments under 1.2 m; with the exact rings every segment either lies on
     a declared facade's chord or gets the blank notch skin — nothing may
     show raw massing. Recompute the expected count here, independently. */
  const eps = 0.25;
  const onChord = (q, f) => {
    const dx = f.b[0] - f.a[0];
    const dz = f.b[1] - f.a[1];
    const len2 = dx * dx + dz * dz;
    let t = len2 ? ((q[0] - f.a[0]) * dx + (q[1] - f.a[1]) * dz) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(q[0] - (f.a[0] + dx * t), q[1] - (f.a[1] + dz * t)) < eps;
  };
  let expected = 0;
  for (const [key, name] of Object.entries(RINGS)) {
    const ring = section.buildings[key].measured.ring;
    const fs = section.facades.filter((f) => f.id.startsWith(key === "bar" ? "bar" : key));
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const p = ring[(i + 1) % ring.length];
      const len = Math.hypot(p[0] - a[0], p[1] - a[1]);
      if (len < eps) continue;
      if (!fs.some((f) => onChord(a, f) && onChord(p, f))) expected++;
    }
  }
  assert.ok(expected > 0, "the notched rings must leave undeclared segments");
  const { createPhotoKeeling } = await import("../docs/js/campus-photo-keeling.js");
  const r = createPhotoKeeling(null, {
    photo: { keeling: section }, heightAt: () => 12.2, surfaceAt: () => 12.4,
  });
  assert.equal(r.counts.notchFaces, expected,
    `notchFaces ${r.counts.notchFaces} != ${expected} uncovered ring segments — a wall is missing or doubled`);
});

test("the module uses the material library, and only deterministic sources", () => {
  const src = readFileSync(join(root, "docs/js/campus-photo-keeling.js"), "utf8");
  assert.match(src, /createMaterialLibrary/, "surfaces come from campus-materials.js");
  assert.ok(!/Math\.random|Date\.now/.test(src), "no nondeterminism in the builder");
});
