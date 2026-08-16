/* ERC's photo-sourced detail section.
 *
 * This is the INVENTED class, so the gates are about quarantine and about not
 * contradicting the measured world:
 *
 *   - it is labelled, epoch-stamped and sourced, and it says what it left out;
 *   - colours are data, and they are hex;
 *   - every group carries a dated source tag;
 *   - nothing it places sits inside a measured building footprint — ERC's
 *     blocks touch each other, so this one caught real cases;
 *   - everything stays inside ERC's own envelope, derived from the measured
 *     rings rather than typed in;
 *   - every architectural system is anchored to a measured ring: the facade
 *     bands ride real ring edges, the Ventanas colonnade rides its measured
 *     curved face, the promenade sits in the real courtyard voids;
 *   - the `absent` list may not shrink. ERC's gaps are the point of the
 *     section as much as its contents are;
 *   - nothing solid crowds the corridor-staging centreline. ERC is 400 m north
 *     of the scooter run so this is trivially true today, and it is kept so
 *     that a future route extension cannot quietly drive through the terrace.
 *
 * The section lives under the `erc` key of docs/data/campus-photo-detail.json.
 * Until the main session merges it, it is read from the build-side file the
 * ERC agent wrote, so this test does not depend on the merge having happened.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(p, "utf8"));

/* The section lives under the `erc` key of the photo document, merged
   2026-08-16; the build-side staging fallback is gone with the merge. */
const MERGED = join(root, "docs/data/campus-photo-detail.json");
const section = read(MERGED).erc;
const campus = read(join(root, "docs/data/campus-3d.json"));
const staging = read(join(root, "docs/data/corridor-staging.json"));

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

/* Every group that carries a dated source tag. */
const TAGGED = [
  "residenceHalls", "apartments", "ventanas", "furniture",
  "middleEarth", "greatHall", "promenade", "ellies",
];

/* Every discrete placement the section makes, sampled the way the renderer
   draws it, so the gates see the whole thing and not just its endpoints. */
function allPoints() {
  const s = section;
  const out = [];
  const eat = (arr) => { for (const it of arr) out.push([it.x, it.z]); };
  eat(s.residenceHalls.bands);
  eat(s.residenceHalls.slots);
  eat(s.residenceHalls.loggias);
  eat(s.apartments.fins);
  eat(s.apartments.windows);
  eat(s.apartments.sconces);
  eat(s.ventanas.columns);
  eat(s.ventanas.soffitRun);
  eat(s.ventanas.glassRun);
  for (const arc of s.ventanas.amphitheatre.arcs) eat(arc.points);
  eat(s.ventanas.amphitheatre.lights);
  eat(s.ventanas.amphitheatre.rails);
  eat(s.furniture.tables);
  eat(s.furniture.umbrellas);
  eat(s.furniture.squareLamps);
  eat(s.furniture.globeLamps);
  eat(s.middleEarth.faces);
  eat(s.middleEarth.columns);
  eat(s.greatHall.columns);
  eat(s.greatHall.fasciaRun);
  eat(s.greatHall.bands);
  eat(s.promenade.scoreLines);
  eat(s.promenade.seats);
  eat(s.promenade.beds);
  eat(s.promenade.racks);
  eat(s.promenade.sconces);
  eat(s.ellies.poles);
  out.push([s.ellies.sign.x, s.ellies.sign.z]);
  out.push([s.ellies.bed.x, s.ellies.bed.z]);
  return out;
}

/* Solids — the things you could hit. Decals are excluded on purpose. */
function solidPoints() {
  const s = section;
  return [
    ...s.ventanas.columns, ...s.furniture.tables, ...s.furniture.squareLamps,
    ...s.furniture.globeLamps, ...s.greatHall.columns, ...s.promenade.seats,
    ...s.promenade.racks, ...s.middleEarth.columns, ...s.ellies.poles,
  ].map((it) => [it.x, it.z]);
}

/* ERC's envelope, taken from the measured rings rather than typed in. */
const ERC_BUILDINGS = [
  "North America Hall", "Latin America Hall", "Europe Hall", "Asia Hall", "Africa Hall",
  "Earth Hall", "Middle East Hall", "Oceania Hall", "Café Ventanas", "Middle Earth Lounge",
  "Kathmandu Hall", "Cuzco Hall", "Asante Hall", "Geneva Hall", "Great Hall",
];
function ercBounds() {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const b of campus.buildings) {
    if (!ERC_BUILDINGS.includes(b.n)) continue;
    for (const [x, z] of b.p) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      z0 = Math.min(z0, z); z1 = Math.max(z1, z);
    }
  }
  return { x0: x0 - 20, z0: z0 - 20, x1: x1 + 20, z1: z1 + 20 };
}

test("the photo document carries an erc section", () => {
  assert.ok(section, "no erc section — neither the merged photo document nor the build-side file has one");
});

test("it says what it is, where it came from, and what it left out", () => {
  assert.match(section.label, /Eleanor Roosevelt|ERC/i);
  assert.ok(section.epoch, "no epoch stamp");
  assert.match(section.note, /INVENTED/, "the note must declare the class");
  assert.ok(Array.isArray(section.sources) && section.sources.length >= 8,
    `only ${section.sources?.length} sources`);
  for (const url of section.sources) assert.match(url, /^https:\/\//);

  /* The two hues that are a visual read, not a sample, have to say so. */
  assert.ok(Array.isArray(section.confidence?.low) && section.confidence.low.length >= 2);
  assert.ok(section.confidence.low.some((s) => /glulam/i.test(s)), "the Ventanas glulam hue is a visual read and must be flagged");
  assert.ok(section.confidence.low.some((s) => /Great Hall/i.test(s)), "the Great Hall hues are low confidence and must be flagged");
});

test("the absent list is written down and does not shrink", () => {
  assert.ok(Array.isArray(section.absent) && section.absent.length >= 9,
    `better absent than wrong — only ${section.absent?.length} gaps recorded`);
  for (const gap of section.absent) assert.equal(typeof gap, "string");

  /* The specific things the research resolved as UNBUILDABLE. If one of these
     ever disappears from the list, something was built on a guess. */
  const text = section.absent.join(" | ");
  for (const must of [/entry|monument sign/i, /Hooper Schneider/i, /node/i, /Mesa Verde/i, /Pangea/i, /UNDA/i]) {
    assert.match(text, must, `a known ERC gap is no longer declared absent: ${must}`);
  }
});

test("colours are data, and they are hex", () => {
  const keys = Object.keys(section.colors);
  assert.ok(keys.length >= 20, `only ${keys.length} colours`);
  for (const [k, v] of Object.entries(section.colors)) {
    assert.match(v, /^#[0-9a-f]{6}$/, `${k} is not a lowercase 6-digit hex`);
  }
});

test("every group carries a dated source tag and some items", () => {
  for (const k of TAGGED) {
    assert.ok(section[k], `missing group ${k}`);
    assert.match(section[k].source, /\d{4}/, `${k} has no dated source`);
    assert.equal(typeof section[k].tag, "string", `${k} has no quarantine tag`);
  }
  for (const [x, z] of allPoints()) {
    assert.ok(Number.isFinite(x) && Number.isFinite(z), `non-finite placement (${x}, ${z})`);
  }
  assert.ok(allPoints().length > 400, "the section places suspiciously little");
});

test("everything sits inside ERC", () => {
  const b = ercBounds();
  for (const [x, z] of allPoints()) {
    assert.ok(x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1,
      `(${x}, ${z}) is outside ERC ${JSON.stringify(b)}`);
  }
});

test("nothing invented sits inside a measured building footprint", () => {
  /* ERC's blocks touch — Middle Earth Lounge overlaps the Earth Hall rings and
     the I-House legs meet their own bridges — so a facade strip really can end
     up buried. The generator drops those; this is the gate that says so. */
  const rings = campus.buildings.filter((b) => b.p && b.p.length >= 3);
  for (const [x, z] of allPoints()) {
    for (const b of rings) {
      assert.ok(!inRing(x, z, b.p), `(${x}, ${z}) is inside ${b.n || "an unnamed mass"}`);
    }
  }
});

test("no solid object crowds the scooter corridor", () => {
  let worst = Infinity;
  let at = null;
  for (const [x, z] of solidPoints()) {
    const d = toRoute(x, z);
    if (d < worst) { worst = d; at = [x, z]; }
  }
  assert.ok(worst >= 3, `closest solid is ${worst.toFixed(2)} m from the centreline at ${at}`);
});

test("the facade detail is anchored to the measured rings, not to taste", () => {
  const r = section.residenceHalls;
  const a = section.apartments;

  /* Four storeys of pinstripe have to fit inside the MEASURED roof. LiDAR
     decides height; the photograph only decides that there are four lines. */
  const halls = campus.buildings.filter((b) => r.halls.includes(b.n));
  assert.equal(halls.length, r.halls.length, "a named residence hall is missing from the survey");
  const lowestRoof = Math.min(...halls.map((b) => b.h));
  assert.ok(Math.max(...r.floorLines) < lowestRoof,
    `the top pinstripe at ${Math.max(...r.floorLines)} m is above the measured ${lowestRoof} m roof`);
  assert.equal(r.floorLines.length, 4, "the photographs read four storeys");
  assert.deepEqual(r.floorLines, a.floorLines, "both families share one floor-to-floor set");

  /* Each band strip is a real ring edge: its length has to match an edge of
     one of the halls to within the outboard offset. */
  const edgeLengths = new Set();
  for (const b of halls) {
    for (let i = 0; i < b.p.length; i++) {
      const p = b.p[i];
      const q = b.p[(i + 1) % b.p.length];
      edgeLengths.add(Math.round(Math.hypot(q[0] - p[0], q[1] - p[1]) * 100) / 100);
    }
  }
  for (const band of r.bands) {
    assert.ok([...edgeLengths].some((L) => Math.abs(L - band.len) < 0.02),
      `band of ${band.len} m matches no measured hall edge`);
  }

  /* One slot window per floor per hall, on the blank Green-facing end. */
  assert.equal(r.slots.length, r.halls.length * r.floorLines.length);
  const apartmentRings = campus.buildings.filter((b) => /Earth Hall|Middle East Hall|Oceania Hall/.test(b.n || ""));
  const eastmostHallX = Math.max(...halls.flatMap((b) => b.p.map(([x]) => x)));
  const westmostApartmentX = Math.min(...apartmentRings.flatMap((b) => b.p.map(([x]) => x)));
  for (const s of r.slots) {
    assert.ok(s.x > eastmostHallX - 4 && s.x < westmostApartmentX,
      `slot at x ${s.x} is not on a hall's Green-facing end`);
  }

  /* The apartment band is the heavier single one, and it projects. */
  assert.ok(a.finHeight > r.bandHeight * 2, "the apartment band is the heavier of the two families");
  assert.ok(a.finDepth >= 0.08, "the apartment band is a projecting ledge, not paint");
  assert.ok(r.bandGap > r.bandHeight, "the residence-hall pinstripes are a PAIR, not one thick line");
});

test("Ventanas rides its own measured curved face", () => {
  const ring = campus.buildings.find((b) => b.n === "Café Ventanas").p;
  const v = section.ventanas;
  /* Distance to the ring's EDGES, not to its vertices: the measured curve is
     a coarse polyline and a column 1.4 m off an edge can be 4 m from the
     nearest corner. */
  const near = (x, z) => {
    let best = Infinity;
    for (let i = 0; i < ring.length; i++) {
      const [ax, az] = ring[i];
      const [bx, bz] = ring[(i + 1) % ring.length];
      const dx = bx - ax;
      const dz = bz - az;
      const len2 = dx * dx + dz * dz;
      let t = len2 ? ((x - ax) * dx + (z - az) * dz) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
    }
    return best;
  };

  /* Colonnade just outboard of the wall; amphitheatre well beyond it, and on
     the Green side — that is, at less negative z than the face it came from. */
  for (const c of v.columns) assert.ok(near(c.x, c.z) < 4, `a colonnade column stands ${near(c.x, c.z).toFixed(1)} m off the measured face`);
  const risers = v.amphitheatre.arcs.flatMap((a) => a.points);
  assert.ok(risers.length > 40, "the amphitheatre is barely drawn");
  /* The terrace edge steps down to the lawn, so every nosing stands further
     out than every column and none of them wanders off into the Green. The
     ring is notched, which is why this is a comparison against the colonnade
     rather than a flat clearance number. */
  const colOutMax = Math.max(...v.columns.map((c) => near(c.x, c.z)));
  for (const p of risers) {
    const d = near(p.x, p.z);
    assert.ok(d > colOutMax && d < 26, `an amphitheatre nosing is ${d.toFixed(1)} m off the face`);
  }
  assert.ok(v.amphitheatre.arcs.length >= 5 && v.amphitheatre.arcs.length <= 6,
    "the photographs read five to six risers");
  assert.ok(v.column.height > v.glass.top - v.glass.base, "the columns stand outboard of the glass they carry");

  /* The soffit oversails: it stands further out than the columns. */
  const colOut = Math.min(...v.columns.map((c) => near(c.x, c.z)));
  const sofOut = Math.min(...v.soffitRun.map((p) => near(p.x, p.z)));
  assert.ok(sofOut > colOut, "the glulam roof must oversail the colonnade, not sit behind it");
});

test("the promenade sits in the real voids between the I-House legs", () => {
  const rings = campus.buildings.filter((b) => section.promenade.courts.includes(b.n));
  assert.equal(rings.length, section.promenade.courts.length);
  const items = [
    ...section.promenade.seats, ...section.promenade.beds, ...section.promenade.racks,
    ...section.promenade.scoreLines,
  ];
  for (const it of items) {
    /* inside one of the three blocks' bounding boxes, but outside its ring —
       which is exactly what "in the courtyard" means for a U-shaped plan. */
    const host = rings.find((b) => {
      const xs = b.p.map(([x]) => x);
      const zs = b.p.map(([, z]) => z);
      return it.x >= Math.min(...xs) && it.x <= Math.max(...xs)
        && it.z >= Math.min(...zs) && it.z <= Math.max(...zs);
    });
    assert.ok(host, `promenade item at (${it.x}, ${it.z}) is not in any I-House block's envelope`);
    assert.ok(!inRing(it.x, it.z, host.p), `promenade item at (${it.x}, ${it.z}) is inside ${host.n}`);
  }
});

test("the promenade's scored joints only mark ground the survey already paves", () => {
  /* The photograph shows the promenade paved wall to wall; the arcgis survey
     does not agree everywhere. Where the two disagree about what the GROUND
     is, the survey wins — a score line over measured lawn would be claiming
     paving that is not there. */
  const arcgis = read(join(root, "docs/data/campus-arcgis.json"));
  const paved = [];
  for (const g of arcgis.ground) {
    if (!g || (g.k !== "walk" && g.k !== "court")) continue;
    for (const ring of g.r) {
      const R = ring.map(([x, z]) => [x / 10, z / 10]);
      const xs = R.map((q) => q[0]);
      const zs = R.map((q) => q[1]);
      if (Math.max(...xs) < -110 || Math.min(...xs) > -40) continue;
      if (Math.max(...zs) < -800 || Math.min(...zs) > -650) continue;
      paved.push(R);
    }
  }
  assert.ok(paved.length > 0, "no measured paving found under the I-House promenade");
  for (const s of section.promenade.scoreLines) {
    assert.ok(paved.some((R) => inRing(s.x, s.z, R)),
      `score line at (${s.x}, ${s.z}) is not over measured paving`);
  }
});

test("the Green gets no invented paving", () => {
  /* The crossing paths are already in the MEASURED arcgis ground survey, so
     the section must not carry a path decal for them, and must say why. */
  assert.equal(section.green, undefined, "the Green has no invented ground layer and must not grow one");
  assert.match(section.absent.join(" | "), /arcgis ground survey/i,
    "the reason the Green is unpaved here has to be written down");
});
