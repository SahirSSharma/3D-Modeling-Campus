/* Revelle's photo-sourced detail section.
 *
 * This is the INVENTED class, so the gates are about quarantine and about
 * not contradicting the measured world:
 *
 *   - it is labelled, epoch-stamped and sourced, and it says what it left out;
 *   - colours are data, and they are hex;
 *   - nothing it places sits inside a measured building footprint (the same
 *     rule corridor.test.mjs enforces for the route);
 *   - nothing solid it places sits within 3 m of the corridor-staging
 *     centreline, because the scooter run crosses Revelle Plaza;
 *   - the paving decals stay inside the MEASURED Revelle Plaza polygon;
 *   - every architectural system is anchored to a measured ring, not to a
 *     number somebody liked.
 *
 * The section lives under the `revelle` key of docs/data/campus-photo-detail.json.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as THREE from "../docs/vendor/three/three.module.min.js";
import { createPhotoRevelle } from "../docs/js/campus-photo-revelle.js";
import {
  assertCoverage, assertEstimateBands, assertPins, assertRelations,
  assertTierSymmetry, assertAbsentEntries, assertExprs, assertDispositions,
  at as pathAt,
} from "./helpers/axiom-gate.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));

const PHOTO_DOC = "docs/data/campus-photo-detail.json";
const merged = existsSync(join(root, PHOTO_DOC));
const section = merged ? read(PHOTO_DOC).revelle : null;
/* R2 item M1: `section` could resolve to null, and a suite whose contract is
   "a missing section is a quiet no-op" then passes VACUOUSLY. A vacuous pass
   is the same defect at file level that the axiom gate exists to stop
   everywhere else, so a section that cannot be resolved is a hard failure at
   load, before any test can be counted green. */
if (!section) {
  throw new Error(
    `campus-photo-revelle.test: no revelle section resolved from ${PHOTO_DOC} — ` +
      "refusing to run a suite that would pass on nothing"
  );
}

/* The sibling sections, read for the S2 cross-section walk below. Resolved the
   same way this section is — the staging merge directory first, then the
   merged document — so the walk survives main's merge, which deletes the
   staging directory. Missing in BOTH is a hard failure, never a skip: a
   cross-section gate that quietly does not run is the whole disease. */
const SIBLING_DIR = "Revelle-College-Sources/merge/r1";
const sibling = (name) => {
  const staged = join(root, `${SIBLING_DIR}/${name}.json`);
  if (existsSync(staged)) return read(`${SIBLING_DIR}/${name}.json`);
  const doc = merged ? read(PHOTO_DOC)[name] : null;
  if (!doc) {
    throw new Error(`campus-photo-revelle.test: successor section "${name}" is in neither ` +
      `${SIBLING_DIR}/ nor ${PHOTO_DOC} — the cross-section walk cannot check a transfer ` +
      "against a section that is not there");
  }
  return doc;
};

const campus = read("docs/data/campus-3d.json");
const staging = read("docs/data/corridor-staging.json");
const photoFor = () => ({ revelle: section });

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
  "benchesA", "benchesB", "kiosks", "lamps", "globes", "bins", "racks", "lavaWalls",
];
const solids = () => ITEM_GROUPS.flatMap((k) => section[k].items);

/* The built extent of each anchored system, sampled the way the renderer
   draws it, so these gates see the whole thing and not just its endpoints. */
function systemPoints() {
  /* York is no longer built by this module — campus-photo-york.js supersedes
     it and carries its own gates. The section's legacy yorkArcade/yorkFins
     keys may still be present until the merge deletes them; they are not
     sampled here because nothing renders them. */
  const s = section.systems;
  const out = [];
  const u = s.ureyCorner;
  for (let x = u.slabA[0]; x <= u.slabB[1]; x += 1) out.push([x, u.faceZ + u.standoff]);
  const b = s.breezeway;
  for (const x of [b.centreX - b.deckWidth / 2, b.centreX, b.centreX + b.deckWidth / 2]) {
    for (let z = b.z0; z <= b.z1; z += 2) out.push([x, z]);
  }
  return out;
}

/* Revelle's envelope, taken from the measured rings rather than typed in. */
function revelleBounds() {
  const names = [
    "York Hall", "Urey Hall", "Galbraith Hall", "Mayer Hall",
    "Argo Hall", "Blake Hall", "Bonner Hall", "Revelle Commons",
  ];
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  const eat = (p) => {
    for (const [x, z] of p) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      z0 = Math.min(z0, z); z1 = Math.max(z1, z);
    }
  };
  for (const b of campus.buildings) if (names.includes(b.n)) eat(b.p);
  eat(campus.surfaces.find((s) => s.n === "Revelle Plaza").p);
  return { x0: x0 - 15, z0: z0 - 15, x1: x1 + 15, z1: z1 + 15 };
}

test("the merged photo document carries a revelle section", () => {
  assert.ok(merged, `${PHOTO_DOC} is missing — the revelle section has nowhere to live`);
  assert.ok(section, `${PHOTO_DOC} has no "revelle" key`);
});

test("it says what it is, where it came from, and what it left out", () => {
  assert.match(section.label, /Revelle/i);
  assert.ok(section.epoch, "no epoch stamp");
  assert.match(section.note, /INVENTED/, "the note must declare the class");
  assert.ok(Array.isArray(section.sources) && section.sources.length >= 8);
  for (const url of section.sources) assert.match(url, /^https:\/\//);
  assert.ok(Array.isArray(section.absent) && section.absent.length >= 5,
    "better absent than wrong — the gaps have to be written down");
  for (const gap of section.absent) assert.equal(typeof gap, "string");
});

test("colours are data, and they are hex", () => {
  const keys = Object.keys(section.colors);
  const retired = Object.keys(section.colorsRetired || {});
  /* R4: six roles retired with their consumers (panel with paving->plaza; the
     urey, breezeway and rail roles with the systems transfers) — recorded, not deleted. */
  assert.ok(keys.length >= 19, `only ${keys.length} live colours`);
  assert.ok(keys.length + retired.length >= 25, "retired colours must stay on the record");
  for (const [k, v] of Object.entries(section.colors)) {
    assert.match(v, /^#[0-9a-f]{6}$/, `${k} is not a lowercase 6-digit hex`);
  }
  for (const [k, v] of Object.entries(section.colorsRetired || {})) {
    assert.ok(!(k in section.colors), `${k} is both live and retired`);
    assert.match(v.hex, /^#[0-9a-f]{6}$/, `retired ${k} lost its hex`);
    assert.match(v.retired, /2026-08-21/, `retired ${k} has no dated reason`);
  }
});

test("every group carries a source tag and some items", () => {
  for (const k of [...ITEM_GROUPS, "paving"]) {
    assert.ok(section[k], `missing group ${k}`);
    assert.match(section[k].source, /\d{4}/, `${k} has no dated source`);
  }
  for (const k of ITEM_GROUPS) {
    assert.ok(section[k].items.length > 0, `${k} is empty`);
    for (const it of section[k].items) {
      assert.equal(typeof it.x, "number");
      assert.equal(typeof it.z, "number");
      assert.ok(Number.isFinite(it.x) && Number.isFinite(it.z));
    }
  }
});

test("everything sits inside Revelle", () => {
  const b = revelleBounds();
  const pts = [
    ...solids().map((it) => [it.x, it.z]),
    ...section.paving.cells,
    ...section.paving.runner.map((z) => [section.paving.runnerX, z]),
    ...systemPoints(),
  ];
  for (const [x, z] of pts) {
    assert.ok(x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1,
      `(${x}, ${z}) is outside Revelle ${JSON.stringify(b)}`);
  }
});

test("nothing invented sits inside a measured building footprint", () => {
  const rings = campus.buildings.filter((b) => b.p && b.p.length >= 3);
  const pts = [
    ...solids().map((it) => [it.x, it.z]),
    ...section.paving.cells,
    ...section.paving.runner.map((z) => [section.paving.runnerX, z]),
    ...systemPoints(),
  ];
  for (const [x, z] of pts) {
    for (const b of rings) {
      assert.ok(!inRing(x, z, b.p), `(${x}, ${z}) is inside ${b.n || "an unnamed mass"}`);
    }
  }
});

test("no solid object crowds the scooter corridor", () => {
  /* The run crosses Revelle Plaza on its way to Peterson. Flat decals under
     the track are fine; anything you can hit is not. */
  let worst = Infinity;
  let at = null;
  for (const [x, z] of [...solids().map((it) => [it.x, it.z]), ...systemPoints()]) {
    const d = toRoute(x, z);
    if (d < worst) { worst = d; at = [x, z]; }
  }
  assert.ok(worst >= 3, `closest solid is ${worst.toFixed(2)} m from the centreline at ${at}`);
});

test("the paving decals stay inside the measured plaza polygon", () => {
  const plaza = campus.surfaces.find((s) => s.n === "Revelle Plaza" && s.kind === "plaza");
  for (const [x, z] of section.paving.cells) {
    assert.ok(inRing(x, z, plaza.p), `paving cell (${x}, ${z}) is off the measured plaza`);
  }
  for (const z of section.paving.runner) {
    assert.ok(inRing(section.paving.runnerX, z, plaza.p), `runner segment at z ${z} is off the plaza`);
  }
  assert.ok(section.paving.band > 0.3 && section.paving.band < 0.5, "narrow band is 0.35-0.45 m");
  assert.ok(section.paving.runnerWidth > section.paving.band * 2, "the central runner is the wide one");
});

test("every architectural system is anchored to a measured ring", () => {
  const ringOf = (name) => campus.buildings.find((b) => b.n === name).p;
  const minZ = (p) => Math.min(...p.map(([, z]) => z));
  const maxZ = (p) => Math.max(...p.map(([, z]) => z));
  const s = section.systems;

  /* York's arcade/fin assertions moved with the build to
     tests/campus-photo-york.test.mjs; this module no longer draws York. */
  assert.equal(s.ureyCorner.faceZ, maxZ(ringOf("Urey Hall")), "the stair towers must sit on Urey's measured plaza face");
  assert.equal(s.breezeway.z0, maxZ(ringOf("Bonner Hall")), "the breezeway must start at Bonner's measured face");

  /* The breezeway spans the gap; it may not land on either building. */
  assert.ok(s.breezeway.z1 > s.breezeway.z0, "the breezeway has to span forwards");
  assert.ok(s.breezeway.z1 <= minZ(ringOf("Mayer Hall")) + 35, "the breezeway overshoots Mayer");

  /* Photos read five breezeway levels; the lower measured roof only carries
     three at 3.6 m, and LiDAR decides height. Do not raise this to match a
     photograph. */
  const bonner = campus.buildings.find((b) => b.n === "Bonner Hall");
  assert.ok(s.breezeway.levels * s.breezeway.levelHeight <= bonner.h,
    "the breezeway is taller than the measured roof it is tucked under");
});

/* ------------------------------------------------------- the R1 apparatus
 *
 * Zone 3's R1 pass retired this section's claim on the plaza. These gates
 * exist because the Eighth audit proved 22 presence gates can pass on
 * wholesale fabricated values: each one below is pinned to a figure that a
 * self-consistent invention would get wrong.
 */

/** Every system that can carry per-item supersession flags. */
const SUP_SYSTEMS = ["benchesA", "lamps", "bins", "racks", "lavaWalls"];
const flagged = (name) => section[name].items.filter((it) => it.sup);

test("the record does not shrink — nothing was deleted, only retired", () => {
  /* The whole point of `superseded`: the successors cite these entries as the
     thing they improve on. A supersession that removed the item instead would
     pass every count gate and destroy the provenance trail. */
  assert.equal(section.benchesA.items.length, 27, "benchesA lost items instead of flagging them");
  assert.equal(section.lamps.items.length, 8, "lamps lost items instead of flagging them");
  assert.equal(section.bins.items.length, 8, "bins lost items instead of flagging them");
  assert.equal(section.racks.items.length, 27, "racks lost items instead of flagging them");
  assert.equal(section.lavaWalls.items.length, 45, "lavaWalls lost items instead of flagging them");
  assert.ok(section.paving?.cells?.length >= 70,
    "paving was retired, not deleted — its 76 cells stay described here");
  assert.equal(section.paving.runner.length, 12, "the runner's full 12-value list stays here");
});

test("supersession is declared per item and every flag names a real section", () => {
  const known = new Set(["plaza", "york", "argo", "blake"]);
  const declared = new Set(Object.keys(section.superseded));
  assert.match(section.supersededNote, /RETIRED FROM THE DRAW, KEPT IN THE RECORD/);
  assert.ok(declared.has("paving"), "the moved paving field must be declared");

  let flags = 0;
  for (const name of SUP_SYSTEMS) {
    const items = flagged(name);
    if (!items.length) continue;
    flags += items.length;
    const key = `${name}.items[sup]`;
    assert.ok(declared.has(key), `${name} has sup flags but ${key} is not in superseded`);
    for (const it of items) {
      assert.ok(known.has(it.sup), `${name} item at (${it.x}, ${it.z}) names an unknown successor "${it.sup}"`);
      assert.ok(section.superseded[key].includes(it.sup),
        `${key} does not list "${it.sup}" among its successors`);
      /* R2 item S2: `sup` alone reads as a transfer whichever happened. */
      assert.ok(it.disposition === "transferred" || it.disposition === "deleted-on-evidence",
        `${name} item at (${it.x}, ${it.z}) carries sup "${it.sup}" and no disposition`);
      const r = section.retirements[`${key}@${it.sup}`];
      assert.ok(r, `${key}@${it.sup} has no entry in \`retirements\``);
      assert.equal(it.disposition, r.disposition,
        `${name} item at (${it.x}, ${it.z}) says "${it.disposition}" and retirements says "${r.disposition}"`);
    }
    assert.ok(section.supersededDetail?.[key]?.length > 200,
      `${key} has no evidence recorded in supersededDetail`);
  }
  /* No system may carry a flag it never declared. */
  for (const name of SUP_SYSTEMS) {
    if (flagged(name).length) continue;
    assert.ok(!declared.has(`${name}.items[sup]`), `${name} declares flags it does not have`);
  }
  assert.equal(flags, 56, "56 items are retired: 7 benches, 5 lamps, 6 bins, 23 racks, 15 wall segments");
  assert.ok(section.supersededDetail.paving.length > 200, "the paving move has no evidence recorded");
});

/* ------------------------------------------ S2: the cross-section walk
 *
 * audit-plaza F4: mutation X1 deleted york.westGround.racks — the declared
 * successor to 16 retired hoops — and this suite passed all 23 tests. The
 * objects were protected only by the coincidence that york's own suite gates
 * its racks; for a retirement whose successor ships nothing there is nothing
 * to coincide with. This is the gate that makes the retirement mechanism able
 * to detect the failure it exists to prevent.
 */

/** The successor's reciprocal claim on a revelle key, whatever shape that
 *  section's `superseded` block is in — the six sections do not share one. */
function reciprocalIn(sec, wantKey) {
  const sup = sec.superseded;
  if (sup) {
    const entries = Array.isArray(sup) ? sup.map((v, i) => [String(i), v]) : Object.entries(sup);
    for (const [k, v] of entries) {
      if (!v || typeof v !== "object") continue;
      if (!k.startsWith(wantKey)) continue;
      return { key: k, rec: v };
    }
  }
  /* R4 successors declare claims as a `supersedes` array of records keyed by
     the full dotted path of what they absorb — same claim, newer shape. */
  for (const rec of sec.supersedes || []) {
    if (rec && typeof rec === "object" && typeof rec.key === "string" && rec.key.startsWith(wantKey)) {
      return { key: rec.key, rec };
    }
  }
  return null;
}

/** The paths a reciprocal names. Written to survive the shapes actually in
 *  use across the six R1 sections rather than to one of them: blake and plaza
 *  carry `by: [<dotted path>]`, york carries `supersededBy: "<dotted path> —
 *  <prose>"`. Anything else and there is no path, which is a failure below. */
function claimedPaths(rec) {
  if (rec.by) return [].concat(rec.by);
  const m = typeof rec.supersededBy === "string" && rec.supersededBy.match(/^[a-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)+/);
  if (m) return [m[0]];
  /* R4 shapes: bonner names its replacement as a dotted path in `replacedBy`;
     urey's record describes what it ships in prose (`ships`) — its replacement
     is the section's own measured mass, so the claim resolves at `measured`. */
  const r = typeof rec.replacedBy === "string" && rec.replacedBy.match(/^[a-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)+/);
  if (r) return [r[0]];
  if (typeof rec.ships === "string" && rec.ships.length > 100) return ["measured"];
  return [];
}

/** Does the path the reciprocal names resolve to something the successor
 *  actually ships? A claim on an empty or absent path is not a claim. */
function shipsAt(sec, name, dotted) {
  const p = dotted.startsWith(`${name}.`) ? dotted.slice(name.length + 1) : dotted;
  const v = pathAt(sec, p);
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v).length > 0;
  return true;
}

/* How many objects the successor ships for a transfer that changed count.
   Only declared where the section itself declares a count change. */
const SUCCESSOR_COUNT = {
  "racks.items[sup]@york": (sec) => sec.westGround.racks.reduce((n, r) => n + r.hoops, 0),
  /* Cells to cells: revelle's 76 and plaza's 44 are both cell counts, so the
     comparison is like for like. The runner's own 12 -> 9 reduction stands in
     the reciprocal's prose; it is a different population and is not folded in
     here, because a counter that sums two populations cannot say which moved. */
  "paving@plaza": (sec) => sec.paving.cells.length,
};

const RETIREMENTS = () =>
  Object.entries(section.retirements).filter(([k]) => k !== "note");

test("every retirement declares whether it is a transfer or a deletion", () => {
  const seen = { transferred: 0, "deleted-on-evidence": 0 };
  let items = 0;
  for (const [key, r] of RETIREMENTS()) {
    assert.match(key, /^[A-Za-z]+(\.[A-Za-z]+)?(\.items\[sup\])?@(plaza|york|argo|blake|urey|bonner)$/,
      `retirements key ${key} is not <system>[.items[sup]]@<successor>`);
    assert.equal(key.split("@")[1], r.sup, `${key} disagrees with its own \`sup\``);
    assert.ok(seen[r.disposition] !== undefined, `${key} has no legal disposition`);
    seen[r.disposition]++;
    assert.equal(typeof r.count, "number", `${key} does not say how many items it moves`);
    items += r.count;
    if (r.disposition === "deleted-on-evidence") {
      /* The prohibition, made mechanical: a deletion may not acquire a
         successor by growing a reciprocal field. */
      assert.equal(r.reciprocal, undefined,
        `${key} is a deletion on evidence and names a reciprocal — deletions do not get successors`);
    } else {
      assert.ok(r.reciprocal, `${key} is a transfer and names no reciprocal record`);
    }
  }
  /* And the other direction: nothing may be retired in `superseded` without
     declaring which of the two things it is. `paving` is the whole-system
     retirement and has no items to carry a per-item flag, so it would
     otherwise escape the per-item gate entirely. */
  for (const [k, sups] of Object.entries(section.superseded)) {
    for (const sup of [].concat(sups)) {
      assert.ok(section.retirements[`${k}@${sup}`],
        `superseded[${k}] names "${sup}" and \`retirements\` has no ${k}@${sup}`);
    }
  }
  /* 56 sup-carrying items; the whole-system retirements (the 76-cell paving
     field, and at R4 the ureyCorner and breezeway systems) are not among the 56. */
  const wholeSystems = ["paving@plaza", "systems.ureyCorner@urey", "systems.breezeway@bonner"];
  const wholeCount = wholeSystems.reduce((n, k) => n + section.retirements[k].count, 0);
  assert.equal(items - wholeCount, 56,
    "the retirements table does not account for exactly the 56 flagged items");
  assert.equal(seen.transferred, 7, "7 transfers: paving, benchesA and lamps to plaza, racks to york, lavaWalls to blake, ureyCorner to urey, breezeway to bonner");
  assert.equal(seen["deleted-on-evidence"], 2, "2 deletions on evidence: the bins to york and the seven hoops to argo");
});

test("a transfer's successor carries the reciprocal AND ships the object", () => {
  const reciprocals = {};
  const items = [];
  for (const [key, r] of RETIREMENTS()) {
    items.push({ key, disposition: r.disposition, sup: r.sup, detail: r.ground });
    const sec = sibling(r.sup);
    if (r.disposition !== "transferred") {
      /* The other half of the prohibition, checked across the file boundary:
         a successor may not quietly turn one of the 13 deletions into a
         transfer by growing an object for it. If it carries a record at all,
         that record must agree the object was deleted. */
      const claim = reciprocalIn(sec, `revelle.${r.system}`);
      if (claim && /deleted/.test(claim.rec.disposition || "")) continue;
      assert.ok(!claim || claim.rec.ships === false,
        `${r.sup} carries ${claim && claim.key} claiming ${key}, which this section deleted on evidence — ` +
          "the record must match the decision, not the other way round");
      continue;
    }
    const found = reciprocalIn(sec, r.reciprocal);
    assert.ok(found,
      `${r.sup} carries no reciprocal record starting "${r.reciprocal}" — a transfer the successor has not claimed ` +
        "is indistinguishable from a deletion, which is exactly audit-plaza F4");
    const by = claimedPaths(found.rec);
    assert.ok(by.length, `${r.sup}'s ${found.key} names no path to what it ships`);
    const ships = by.every((p) => shipsAt(sec, r.sup, p));
    assert.ok(ships,
      `${r.sup}'s ${found.key} claims ${key} but ${by.join(", ")} resolves to nothing it ships`);
    reciprocals[`${r.sup}:${key}`] = { ships, countChange: !!r.countChange };
    if (r.countChange) {
      const counter = SUCCESSOR_COUNT[key];
      assert.ok(counter, `${key} declares a count change and this suite has no counter for it`);
      const built = counter(sec);
      reciprocals[`${r.sup}:${key}`].count = built;
      assert.equal(built, r.successorCount,
        `${key} declares the successor ships ${r.successorCount} and ${r.sup} ships ${built}`);
      assert.ok(built < r.count, `${key} declares a count change that is not a reduction`);
    }
  }
  assert.equal(assertDispositions({ items, reciprocals, label: "revelle" }), 9);
});

test("the four acceptance cases of the x 79..82 runs are labelled correctly", () => {
  const R = section.retirements;
  /* 4 lamps at x 79 -> plaza: a TRUE TRANSFER, and the reciprocal is required. */
  assert.equal(R["lamps.items[sup]@plaza"].disposition, "transferred");
  assert.ok(R["lamps.items[sup]@plaza"].reciprocal);
  assert.equal(section.lamps.items.filter((it) => it.x === 79 && it.sup).length, 4);
  for (const it of section.lamps.items.filter((q) => q.x === 79 && q.sup))
    assert.equal(it.disposition, "transferred");

  /* 6 bins -> york: a DELETION ON EVIDENCE. york ships no bin and must not. */
  assert.equal(R["bins.items[sup]@york"].disposition, "deleted-on-evidence");
  assert.equal(R["bins.items[sup]@york"].count, 6);
  assert.equal(sibling("york").westGround?.bins, undefined,
    "york must not have grown a bin run to make revelle's deletion look like a transfer");

  /* 7 hoops -> argo: a DELETION ON EVIDENCE on research-argo 9.3. */
  assert.equal(R["racks.items[sup]@argo"].disposition, "deleted-on-evidence");
  assert.equal(R["racks.items[sup]@argo"].count, 7);
  assert.match(R["racks.items[sup]@argo"].ground, /9\.3/);
  assert.match(R["racks.items[sup]@argo"].ground, /November 2024|Nov 2024/);

  /* 16 hoops -> york: a TRANSFER WITH A COUNT CHANGE, declared as a NUMBER. */
  const yr = R["racks.items[sup]@york"];
  assert.equal(yr.disposition, "transferred");
  assert.equal(yr.countChange, true, "the reduction must be a machine-readable flag, not only prose");
  assert.equal(yr.count, 16);
  assert.equal(yr.successorCount, 10, "16 retired, 10 shipped as two five-hoop runs at x 83");
});

test("the retirements are pinned to the arithmetic that justified them", () => {
  /* A self-consistent fabrication would flag plausible items. These check the
     flags land on the exact objects the measurements condemned. */
  const at = (name, x, z) => section[name].items.find((it) => it.x === x && it.z === z);

  /* 1.9 — the visible defect: blake's wall is the same wall, 0.10 m away. */
  const lava = flagged("lavaWalls");
  assert.equal(lava.length, 15);
  for (const it of lava) {
    assert.equal(it.z, 357.5, "only the z 357.5 run is blake's; the x 32/x 45 runs are R4/R6's");
    assert.equal(it.sup, "blake");
    assert.ok(it.x >= -53 && it.x <= -25);
  }
  assert.ok(Math.abs(357.6 - 357.5) < section.lavaWalls.thickness,
    "the two walls are closer than one wall is thick, which is why one had to go");
  assert.match(section.derivations.figures.lavaWallHeightDelta, /0\.60 m/,
    "the 1.35 - 0.75 = 0.60 m height delta must be on the record");

  /* 1.3 — the bench row that overlapped plaza's at 1.46 m. */
  const benches = flagged("benchesA");
  assert.equal(benches.length, 7);
  for (const it of benches) assert.equal(it.z, 379.2, "only the z 379.2 row is superseded");
  assert.ok(section.benchesA.items.some((it) => it.z === 410.5 && !it.sup),
    "the z 410.5 row is still accurate and must keep drawing");
  assert.ok(section.benchesA.items.some((it) => it.x === 47.5 && !it.sup),
    "the x 47.5 column is still accurate and must keep drawing");
  assert.equal(Math.round(Math.hypot(0.4, 1.4) * 100) / 100, 1.46,
    "the 1.46 m pair separation the docket is built on");

  /* 1.6 — 5.00 m exactly, and the four belt poles. */
  assert.equal(at("lamps", -10, 365).sup, "plaza");
  assert.equal(Math.hypot(-10 - -6, 365 - 368), 5, "the west-walk pair is 5.00 m apart");
  assert.ok(!at("lamps", -10, 340).sup, "the (-10, 340) post is still accurate");
  assert.equal(flagged("lamps").filter((it) => it.x === 79).length, 4,
    "the four x 79 poles stand in plaza.dgBelt and transfer with it");
  for (const it of flagged("lamps").filter((q) => q.x === 79)) assert.equal(it.sup, "plaza");
  for (const z of [414]) {
    assert.ok(section.lamps.items.filter((it) => it.z === z).every((it) => !it.sup),
      "the Galbraith frontage poles are still accurate");
  }

  /* 1.12 + research-argo 9 — the conservative clip, not the relocation. */
  const racks = flagged("racks");
  const argoRacks = racks.filter((it) => it.sup === "argo");
  const yorkRacks = racks.filter((it) => it.sup === "york");
  assert.equal(yorkRacks.length, 16, "the sixteen x 81 hoops go to york");
  for (const it of yorkRacks) assert.equal(it.x, 81);
  assert.equal(argoRacks.length, 7, "the CONSERVATIVE clip retires seven hoops, not eleven");
  for (const it of argoRacks) {
    assert.equal(it.z, 362.5);
    assert.ok(it.x <= -39.8, `rack at x ${it.x} is east of the photographed frame and must be kept`);
  }
  const kept = section.racks.items.filter((it) => it.z === 362.5 && !it.sup);
  assert.equal(kept.length, 4, "the four eastern hoops are outside the boardwalk and stay");
  for (const it of kept) assert.ok(it.x >= -37.6);
  /* The hoop that sat inside argo's bench. */
  assert.ok(Math.abs(Math.hypot(-48.6 - -49.2, 362.5 - 362.2) - 0.67) < 0.005,
    "the 0.67 m bench overlap that condemned the run");

  /* 1.8 — the bins stand 0.30 m short of york's surveyed beds. */
  const bins = flagged("bins");
  assert.equal(bins.length, 6);
  for (const it of bins) { assert.equal(it.x, 81.5); assert.equal(it.sup, "york"); }
  assert.equal(Math.round((82.1 - (81.5 + section.bins.radius)) * 100) / 100, 0.3,
    "the 0.30 m gap to york.westGround.mulch");
});

test("the rejected rack relocation is on the record with its reason", () => {
  /* research-argo.md section 9.5 PREFERS a relocation this build refused. A
     losing read that is not written down is a decision nobody can audit. */
  const c = section.conflicts.find((q) => /RACK RUN/.test(q));
  assert.ok(c, "the rack arbitration must be a declared conflict");
  assert.match(c, /355\.5/, "the rejected z 355.5 row must be named");
  assert.match(c, /358\.0/, "the rejected z 358.0 row must be named");
  assert.match(c, /terrace/i, "the reason must name blake's raised terrace");
  assert.match(c, /lavaWall|retaining/i, "the reason must name blake's wall");
  assert.match(c, /362\.5/, "the losing 2012 read must be kept too");
});

test("what is held for a later batch says so, and says why it was not fixed", () => {
  /* benchesB/globes/lavaWalls#0-29 were relabelled R4 -> R6 at R4 arbitration
     C1 (2026-08-21): R4 shipped without absorbing them (bonner declined,
     urey/mayer silent), and a batch is not an owner. The two systems stay
     held for R4 until main applies the supersession flips. */
  for (const [path, owner] of [
    [section.benchesB, "R6"], [section.globes, "R6"], [section.lavaWalls, "R6"],
    [section.systems.ureyCorner, "urey"], [section.systems.breezeway, "bonner"],
  ]) {
    assert.equal(path.owner, owner);
    assert.ok(path.ownerNote.length > 80, "a hand-over with no reason is a shrug");
  }
  /* The two systems held through R1-R4 transferred at R4 (2026-08-21): the
     records stay, dated, naming the successor and why the hold ended; and the
     transfer must be the real mechanism, not a nudge — both keys retired via
     `superseded` with reciprocals in urey/bonner. */
  assert.match(section.systems.ureyCorner.ownerNote, /TRANSFERRED 2026-08-21/);
  assert.match(section.systems.breezeway.ownerNote, /TRANSFERRED 2026-08-21/);
  assert.ok(section.superseded["systems.ureyCorner"]?.includes("urey"));
  assert.ok(section.superseded["systems.breezeway"]?.includes("bonner"));
  const brz = section.conflicts.find((q) => /BREEZEWAY IS 16\.15 m/.test(q));
  assert.ok(brz, "the 16.15 m plan error must be declared, not silently carried");
  assert.match(brz, /osm:917/);
  assert.match(brz, /osm:918/);
  assert.equal(Math.round(((83.8 + 91.0) / 2 - 71.25) * 100) / 100, 16.15,
    "the 16.15 m is (83.8 + 91.0)/2 - 71.25 and must stay derivable");
});

/* S1(v): `absent` was gated by LIST LENGTH, which cannot tell a retirement
   from a deletion and cannot notice a substitution. Every entry is now held by
   key with a probe on what it withholds; an entry may leave only by being
   BUILT here or by being claimed in a sibling's own absent list. Same for
   `absentSuperseded`, which revelle has and the other sections do not. */
const ABSENT_EXPECTED = {
  "absent[0]": /May 1970 Peace Memorial.*no photograph found/,
  "absent[1]": /El Mac mural .An Enduring Spell. on Argo/,
  "absent[2]": /Fountain basin plan geometry.*circular vs straight-sided/,
  "absent[3]": /Six fleet halls .Atlantis, Beagle, Challenger, Discovery, Galathea, Meteor./,
  "absent[4]": /Revelle Commons \/ 64 Degrees frontage.*2014 re-clad/,
  "absent[5]": /Blake Hall facade style.*only an inference/,
  "absent[6]": /'Urey Hall' and 'Galbraith Hall' lettering.*no text mechanism/,
  "absent[7]": /Galbraith roof monitors.*2012 aerial/,
  "absent[8]": /bench type A rows' seat detail.*slat count/,
  "absent[9]": /lava walls' coping.*items 0-29 at x 32 and x 45/,
  "absent[10]": /plaza-deck seat-wall run visible in UCSD DC bb5393567s/,
  "absent[11]": /Urey Hall's balcony galleries.*six gallery levels/,
};
const ABSENT_SUPERSEDED_EXPECTED = {
  0: /plaza\.memorial/,
  2: /RESOLVED OUTRIGHT/,
  5: /the whole blake section/,
};

test("every absent entry is held by key, not by list length", () => {
  const entries = section.absent.map((what, i) => ({ key: `absent[${i}]`, what }));
  assert.equal(
    assertAbsentEntries({ absent: entries, expected: ABSENT_EXPECTED, label: "revelle" }),
    Object.keys(ABSENT_EXPECTED).length,
  );
  const sup = Object.entries(section.absentSuperseded).map(([key, v]) => ({ key, ...v }));
  assert.equal(
    assertAbsentEntries({ absent: sup, expected: ABSENT_SUPERSEDED_EXPECTED, label: "revelle.absentSuperseded" }),
    Object.keys(ABSENT_SUPERSEDED_EXPECTED).length,
  );
});

test("absent never shrinks, and the retired entries keep their evidence", () => {
  assert.ok(section.absent.length >= 8, "the original eight entries stay");
  for (const [i, expect] of [[0, /Peace Memorial/], [2, /Fountain basin/], [5, /Blake Hall facade/]]) {
    assert.match(section.absent[i], expect, `absent[${i}] was reordered or deleted`);
    const sup = section.absentSuperseded[i];
    assert.ok(sup, `absent[${i}] is retired but has no absentSuperseded record`);
    assert.equal(sup.entry, section.absent[i], "the record must quote the entry it retires");
    assert.ok(Array.isArray(sup.by) && sup.by.length);
    assert.ok(sup.note.length > 80, "a retirement with no evidence is a deletion with extra steps");
  }
  assert.match(section.absentSuperseded[2].residue, /RESOLVED OUTRIGHT/,
    "the fountain question is resolved, not merely moved");
});

test("every colour carries a provenance tier and every tier names a source", () => {
  const keys = Object.keys(section.colors);
  assert.deepEqual(
    Object.keys(section.colorSources).sort(), keys.slice().sort(),
    "colorSources must cover exactly the colors block — no hex without a tier, no tier without a hex"
  );
  /* S1(iv). The old branch here was one-directional AND vacuous: an
     [estimated] line only had to match /extends|invented look|estimate/i, and
     "[estimated]" itself matches /estimate/i, so it checked nothing; while a
     [measured] line only had to name a year, which every [estimated] line
     naming the parent it extends also does (audit-plaza F3's promotion path).
     assertTierSymmetry runs it both ways: a line that extends, borrows, has no
     per-hex sample record or names no artefact must be [estimated], whatever
     it calls itself. */
  const entries = [
    ...Object.entries(section.colorSources).map(([key, text]) => ({ key: `colorSources.${key}`, text })),
    ...Object.entries(section.derivations.estimates)
      .filter(([, e]) => e && typeof e === "object")
      .map(([key, e]) => ({ key: `estimates.${key}`, text: e.why })),
  ];
  assert.equal(assertTierSymmetry({ entries, label: "revelle" }), entries.length);
  for (const [k, line] of Object.entries(section.colorSources)) {
    assert.ok(line.length > 60, `${k}'s tier line says nothing about where it came from`);
  }
});

test("the R2 colour rulings are the shipped hexes", () => {
  /* TEST-BASELINE CHANGE (R2 colour arbitration): four hexes moved, so the
     values are pinned here rather than left to drift back. */
  const c = section.colors;
  /* lavaRockPale: plaza's #d8cfbd wins; revelle's #8e6b54 was part 1's value,
     which plaza's own source string records as too dark. */
  assert.equal(c.lavaRockPale, "#d8cfbd");
  /* bannerGold/bannerNavy: one artefact (brand.ucsd.edu's published banner
     artwork) read twice; plaza reads it directly, revelle read it through a
     2006 photograph's white balance, and revelle's banners retire INTO plaza. */
  assert.equal(c.bannerGold, "#f0c020");
  assert.equal(c.bannerNavy, "#1e3a70");
  /* brick: revelle.paving retires into plaza.paving, so plaza is the surviving
     consumer. NOT the 2026 ortho's #cead9b — conflicts[0] and the two-source
     rule both forbid a shipped hex sampled off the orthophoto. */
  assert.equal(c.brick, "#97837a");
  assert.notEqual(c.brick, "#cead9b", "the ortho may never be the source of a shipped hex");
  /* These three WIN and stay: argo imports benchWood, galbraith imports bin,
     and luminaire is the dark HOUSING (galbraith's near-white is the lens and
     is renamed there), so it was never a colour conflict. */
  assert.equal(c.benchWood, "#8e6b60");
  assert.equal(c.bin, "#bfbab0");
  assert.equal(c.luminaire, "#2e2e2c");
});

test("every source is a real citation with a date, not a bare link", () => {
  for (const src of section.sources) {
    assert.ok(src.length >= 80, `too thin to be a citation: ${src.slice(0, 60)}...`);
    assert.match(src, /\b(19|20)\d{2}\b/, `no 4-digit date: ${src.slice(0, 60)}...`);
  }
  assert.ok(section.sources.some((q) => /bb5393567s/.test(q)),
    "the new fountain/kiosk archive frame must be cited");
});

test("bounds is derived from the section's own items, not typed in", () => {
  const b = section.bounds;
  const pts = [...solids().map((it) => [it.x, it.z]), ...systemPoints()];
  for (const [x, z] of pts) {
    assert.ok(x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1,
      `(${x}, ${z}) is outside the section's own declared bounds`);
  }
  /* And it must be TIGHT — a box big enough to hold anything proves nothing. */
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  assert.ok(b.x0 >= Math.min(...xs) - 6 && b.x1 <= Math.max(...xs) + 11,
    "bounds is padded far beyond the items it describes");
  assert.ok(b.z0 >= Math.min(...zs) - 8 && b.z1 <= Math.max(...zs) + 6,
    "bounds is padded far beyond the items it describes");
});

/* ---------------------------------------------------------- the built group */

test("the module builds headless and draws each system exactly once", () => {
  const { group, counts } = createPhotoRevelle(null, { photo: photoFor(), surfaceAt: () => 0 });
  assert.ok(group.children.length > 10, "the group is nearly empty");
  for (const [k, want] of Object.entries(section.counts)) {
    if (k === "note") continue;
    assert.equal(counts[k], want, `counts.${k}: the section declares ${want}, the build made ${counts[k]}`);
  }
  /* The declared counts must be the LIVE ones, i.e. flags actually skip. */
  assert.equal(counts.benchesA, 20);
  assert.equal(counts.lamps, 3);
  assert.equal(counts.racks, 4);
  assert.equal(counts.lavaWalls, 30);
  assert.equal(counts.pavingCells, 0, "the paving moved to plaza and must not be drawn twice");
  assert.equal(counts.superseded, 59, "3 systems (paving, ureyCorner, breezeway) + 56 items");
});

test("a missing section is a HARD FAILURE, and a missing sampler throws", () => {
  /* TEST-BASELINE CHANGE (R2 item M1): this used to assert a missing section
     was a quiet no-op returning an empty group and `counts: {}`. That contract
     is what let the whole of Revelle vanish — a renamed key, a half-applied
     merge — with every consumer, including this suite, still green on nothing
     drawn. It now throws. */
  assert.throws(() => createPhotoRevelle(null, { photo: {}, surfaceAt: () => 0 }),
    /no `revelle` section/);
  assert.throws(() => createPhotoRevelle(null, { photo: photoFor() }), /surfaceAt/);
});

test("everything the module places rides surfaceAt", () => {
  const a = createPhotoRevelle(null, { photo: photoFor(), surfaceAt: () => 0 }).group;
  const b = createPhotoRevelle(null, { photo: photoFor(), surfaceAt: () => 7 }).group;
  assert.equal(a.children.length, b.children.length);
  for (let i = 0; i < a.children.length; i++) {
    const ma = a.children[i];
    const mb = b.children[i];
    if (ma.isInstancedMesh) {
      for (let k = 0; k < ma.count; k++) {
        const ya = ma.instanceMatrix.array[k * 16 + 13];
        const yb = mb.instanceMatrix.array[k * 16 + 13];
        assert.ok(Math.abs(yb - ya - 7) < 1e-4,
          `instanced child ${i} instance ${k} does not ride the ground (${ya} -> ${yb})`);
      }
    } else {
      assert.ok(Math.abs(mb.position.y - ma.position.y - 7) < 1e-4,
        `child ${i} (${ma.name || ma.type}) does not ride the ground`);
    }
  }
});

test("two builds are byte-identical", () => {
  const a = createPhotoRevelle(null, { photo: photoFor(), surfaceAt: () => 2 }).group;
  const b = createPhotoRevelle(null, { photo: photoFor(), surfaceAt: () => 2 }).group;
  assert.equal(a.children.length, b.children.length);
  for (let i = 0; i < a.children.length; i++) {
    if (!a.children[i].isInstancedMesh) continue;
    assert.equal(a.children[i].count, b.children[i].count, `child ${i} instance count changed`);
    assert.deepEqual(
      Array.from(a.children[i].instanceMatrix.array),
      Array.from(b.children[i].instanceMatrix.array),
      `child ${i} placed its instances differently on a rebuild`
    );
  }
});

test("every drawn item is SEATED — nothing hovers, nothing sinks, at any footing", () => {
  /* The flat-ground ride test above cannot see this: a whole system lifted a
     metre rides a constant ground perfectly. This one asks, per ITEM, whether
     anything the module drew actually reaches the surface under it, and it
     asks on the real drawn relief as well as on flat ground.
     Built three ways: flat, an exaggerated slope, and the LiDAR surface's own
     worst gradient across this section's envelope. */
  const items = ITEM_GROUPS.flatMap((k) =>
    section[k].items.filter((it) => !it.sup).map((it) => [it.x, it.z]));
  assert.ok(items.length >= 60, "too few live items for this gate to mean anything");

  for (const [name, g] of [
    ["flat", () => 0],
    ["exaggerated slope", (x, z) => 0.06 * x + 0.04 * z],
    ["a bowl", (x, z) => 0.004 * ((x + 20) ** 2 + (z - 350) ** 2) / 10],
  ]) {
    const { group } = createPhotoRevelle(null, { photo: photoFor(), surfaceAt: g });
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    /* Lowest point drawn within 2.5 m of each item, as an offset from the
       drawn ground directly under it. Instances further than that from any
       item belong to ureyCorner or the breezeway, which are wall-anchored. */
    const lowest = items.map(() => Infinity);
    for (const c of group.children) {
      if (!c.isInstancedMesh) continue;
      c.geometry.computeBoundingBox();
      const minY = c.geometry.boundingBox.min.y;
      for (let i = 0; i < c.count; i++) {
        c.getMatrixAt(i, m);
        m.decompose(p, q, sc);
        const foot = p.y + minY * sc.y - g(p.x, p.z);
        for (let k = 0; k < items.length; k++) {
          if (Math.hypot(p.x - items[k][0], p.z - items[k][1]) > 2.5) continue;
          if (foot < lowest[k]) lowest[k] = foot;
        }
      }
    }
    for (let k = 0; k < items.length; k++) {
      const off = lowest[k];
      assert.ok(Number.isFinite(off),
        `on ${name}: nothing at all is drawn at item (${items[k][0]}, ${items[k][1]})`);
      assert.ok(off > -0.06,
        `on ${name}: the item at (${items[k][0]}, ${items[k][1]}) is buried ${(-off).toFixed(2)} m under the drawn ground`);
      assert.ok(off < 0.3,
        `on ${name}: the item at (${items[k][0]}, ${items[k][1]}) hovers ${off.toFixed(2)} m above the drawn ground`);
    }
  }
});

/* ------------------------------------------------------- the axiom layer
 *
 * R2 arbitration item S1. R1's derivation engine checked the FIGURES and
 * nothing underneath them — the readings the figures derive from, the
 * estimates they inherit, and the `draw` block's numbers. Move a reading and
 * every figure downstream moves with it, consistently, and passes. Every gate
 * below is a TIGHTENING and shares ONE apparatus with the other five suites:
 * tests/helpers/axiom-gate.mjs.
 *
 * NOTE THIS SECTION'S SCHEMA. `derivations` carries `draw`, `estimates`,
 * `figures` and `reads` (not `readings`), and its `figures` values are PROSE
 * STRINGS with no {value, expr} — see the S1(vi) test at the bottom, which is
 * a recorded GAP and not a pass.
 */

/* S1(iii). The literal lives HERE, so moving the reading in the section moves
   it away from the pin and fails. Paths are relative to derivations.reads. */
const READ_PINS = {
  "ureyFaceZ.value": {
    value: 315.8, tol: 0,
    truth: "max z of the 'Urey Hall' ring in docs/data/campus-3d.json — an equality against the drawn world, asserted again by the anchor gate above",
  },
  "ureyFaceZ.gisZ": {
    value: 309.5, tol: 0,
    truth: "the facilities GIS mass for Urey Hall ends 6.3 m north of the drawn ring; the competing figure held for R4 in conflicts[3]",
  },
  "breezewayZ0.value": {
    value: 246.1, tol: 0,
    truth: "max z of the 'Bonner Hall' ring in docs/data/campus-3d.json — an equality against the drawn world, asserted again by the anchor gate above",
  },
  "breezewayLevels.roofHeight": {
    value: 12.0, tol: 0,
    truth: "the measured h of the 'Bonner Hall' ring in docs/data/campus-3d.json — LiDAR decides height, so this is the ceiling the breezeway must fit under",
  },
  "kioskType.value": {
    value: 2.35, tol: 0,
    truth: "the shipped kiosk height, inside the 2.2-2.5 m band UCSD DC bb5393567s gives against the adults in the same frame",
  },
  "kioskType.band.0": {
    value: 2.2, tol: 0,
    truth: "UCSD DC bb5393567s (cached 2026-08-20): the low end of the kiosk's height against the adults in frame",
  },
  "kioskType.band.1": {
    value: 2.5, tol: 0,
    truth: "UCSD DC bb5393567s (cached 2026-08-20): the high end of the kiosk's height against the adults in frame",
  },
};

/* S1(i). Every numeric leaf in the axiom layer is one of these. The sets are
   written out rather than pattern-matched so that a NEW number cannot classify
   itself; and `uncovered` is deliberately EMPTY — revelle has no number it
   cannot account for, and the allowlist is not a place to put ones it can. */
const BANDED = new Set([
  "derivations.reads.kioskType.band.0",
  "derivations.reads.kioskType.band.1",
  "derivations.estimates.rackTube.value",
  "derivations.estimates.rackTube.band.0",
  "derivations.estimates.rackTube.band.1",
]);
const IN_RELATION = new Set([
  "derivations.reads.breezewayLevels.levels",
  "derivations.reads.breezewayLevels.levelHeight",
  "derivations.reads.breezewayLevels.headroom",
]);
const AGAINST_BUILT = new Set(["derivations.draw.lavaWallBase.bed"]);
const UNCOVERED = {};

test("S1(i): no number in the axiom layer is a bare number", () => {
  const classify = (path) => {
    const rel = path.replace(/^derivations\.reads\./, "");
    if (Object.prototype.hasOwnProperty.call(READ_PINS, rel) && path.startsWith("derivations.reads.")) return "pinned";
    if (BANDED.has(path)) return "banded";
    if (IN_RELATION.has(path)) return "member of an asserted relation";
    if (AGAINST_BUILT.has(path)) return "asserted against the built group";
    return null;
  };
  const walked = assertCoverage({
    section,
    roots: { "derivations.reads": {}, "derivations.estimates": {}, "derivations.draw": {} },
    classify,
    uncovered: UNCOVERED,
    minimum: 14,
    label: "revelle",
  });
  /* The walk must actually see the whole layer, not a subset of it. */
  assert.equal(walked.length, 14, `the axiom walk found ${walked.length} numbers, not 14`);
});

test("S1(ii): every estimate carries a band and ships inside it", () => {
  /* `skip` names the two estimates that ship NO NUMBER — a hex and an invented
     flyer scatter. A band on a colour is not a band, and inventing an interval
     to make the gate run would be the fabrication the gate exists to catch.
     They are held by the assertions below instead, which is a narrower gate
     and is recorded as such in derivations.estimates.note. */
  const est = section.derivations.estimates;
  const look = Object.entries(est).filter(([k, e]) => k !== "note" && e.kind === "look");
  assert.equal(look.length, 2, "the look-only estimates are flyers and breezewayDeckColour");
  for (const [k, e] of look) {
    assert.ok(e.extends && e.extends.length > 25, `estimate ${k} does not say what it extends`);
    assert.match(e.why, /\[estimated\]/, `estimate ${k} is not labelled [estimated]`);
    assert.equal(e.value, undefined, `estimate ${k} claims kind "look" and ships a number after all`);
    assert.equal(e.band, undefined, `estimate ${k} claims kind "look" and carries a band after all`);
  }
  const valueAt = (key) => ({ rackTube: section.racks.tube }[key]);
  assert.equal(
    assertEstimateBands({ estimates: est, valueAt, skip: look.map(([k]) => k), label: "revelle" }),
    1,
  );
  /* The band is the estimate's own claim written as an interval, so it must
     bracket the shipped tube and nothing wider: 1.5 in to 2.375 in OD. */
  assert.deepEqual(est.rackTube.band, [0.019, 0.03]);
  assert.equal(section.racks.tube, 0.025);
});

test("S1(iii): every reading with an external truth is pinned to it", () => {
  assert.equal(
    assertPins({
      readings: section.derivations.reads,
      pins: READ_PINS,
      namespaces: ["ureyFaceZ", "breezewayZ0", "kioskType"],
      label: "revelle",
    }),
    Object.keys(READ_PINS).length,
  );
  /* And the pins are pinned to the ARTEFACT, not just to each other. */
  const ringOf = (n) => campus.buildings.find((b) => b.n === n);
  const r = section.derivations.reads;
  assert.equal(r.ureyFaceZ.value, Math.max(...ringOf("Urey Hall").p.map(([, z]) => z)));
  assert.equal(r.breezewayZ0.value, Math.max(...ringOf("Bonner Hall").p.map(([, z]) => z)));
  assert.equal(r.breezewayLevels.roofHeight, ringOf("Bonner Hall").h);
  /* The readings must be the numbers the section actually ships. */
  assert.equal(r.ureyFaceZ.value, section.systems.ureyCorner.faceZ);
  assert.equal(r.breezewayZ0.value, section.systems.breezeway.z0);
  assert.equal(r.breezewayLevels.levels, section.systems.breezeway.levels);
  assert.equal(r.breezewayLevels.levelHeight, section.systems.breezeway.levelHeight);
  assert.equal(r.kioskType.value, section.kiosks.height);
});

test("S1(iii): the relations this section states in prose are asserted", () => {
  const r = section.derivations.reads;
  const rel = [
    {
      /* B3's shape: the section states this in prose and nothing checked it,
         so any single member could move and the rest re-derive around it. */
      name: "breezeway levels x levelHeight + headroom = Bonner's measured roof",
      got: r.breezewayLevels.levels * r.breezewayLevels.levelHeight + r.breezewayLevels.headroom,
      want: r.breezewayLevels.roofHeight,
    },
    {
      name: "lavaWallHeightDelta: blake's 1.35 m less this section's shipped height is 0.60 m",
      got: 1.35 - section.lavaWalls.height,
      want: 0.6,
      tol: 5e-9,
    },
    {
      name: "binYorkSeparation: york's mulch at 82.1 less the bins' east face is 0.30 m",
      got: 82.1 - (81.5 + section.bins.radius),
      want: 0.3,
      tol: 5e-9,
    },
    {
      name: "the two lava walls' centrelines are closer than one wall is thick",
      got: Math.abs(357.6 - 357.5) < section.lavaWalls.thickness ? 1 : 0,
      want: 1,
    },
    {
      name: "kioskType: the shipped height sits inside its own published band",
      got: r.kioskType.value >= r.kioskType.band[0] && r.kioskType.value <= r.kioskType.band[1] ? 1 : 0,
      want: 1,
    },
  ];
  assert.equal(assertRelations({ relations: rel, label: "revelle" }), rel.length);
});

test("S1(i): the draw block's one constant is what the module actually draws", () => {
  /* derivations.draw.lavaWallBase.bed = 0.13 is carried straight to the
     geometry by campus-photo-revelle.js. Asserted against the BUILT group so
     the document and the module cannot drift apart. */
  const bed = section.derivations.draw.lavaWallBase.bed;
  const { group } = createPhotoRevelle(null, { photo: photoFor(), surfaceAt: () => 0 });
  const live = new Set(section.lavaWalls.items.filter((it) => !it.sup).map((it) => `${it.x},${it.z}`));
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  let lowest = Infinity;
  for (const c of group.children) {
    if (!c.isInstancedMesh || c.count !== live.size) continue;
    c.geometry.computeBoundingBox();
    const h = c.geometry.boundingBox.max.y - c.geometry.boundingBox.min.y;
    if (Math.abs(h - 0.26) > 1e-6) continue;   /* the lava-rock block */
    for (let i = 0; i < c.count; i++) {
      c.getMatrixAt(i, m);
      m.decompose(p, q, sc);
      lowest = Math.min(lowest, p.y);
    }
  }
  assert.ok(Number.isFinite(lowest), "no lava-rock instances were found to check the bed against");
  assert.ok(Math.abs(lowest - bed) < 1e-6,
    `the module beds the lowest rock tier at ${lowest} and the document says ${bed}`);
});

test("S1(vi): revelle's figures are PROSE ONLY — a recorded gap, not a pass", () => {
  /* THE GAP, stated so it cannot be mistaken for a clean bill. Every entry in
     derivations.figures is a prose string with no `expr`, so there is nothing
     for assertExprs to evaluate and NOTHING binds a figure to its inputs
     except the prose. Exprs were deliberately not invented for it — an
     invented derivation is the defect the gate exists to catch. What is gated
     here is that no figure can masquerade: it is prose, or it carries an
     `expr` that evaluates to its own value. Converting the table to
     {value, expr} over derivations.reads is owed work. */
  const figures = section.derivations.figures;
  const withExpr = Object.entries(figures).filter(([, v]) => v && typeof v === "object" && v.expr);
  if (withExpr.length) {
    assertExprs({
      figures: Object.fromEntries(withExpr),
      scope: { reads: section.derivations.reads },
      label: "revelle",
    });
  } else {
    for (const [k, v] of Object.entries(figures)) {
      assert.equal(typeof v, "string",
        `figure ${k} is no longer prose — run it through assertExprs instead of this branch`);
      assert.ok(v.length > 80, `figure ${k} is prose and says almost nothing`);
    }
    assert.match(section.derivations.figuresNote, /S1\(vi\) IS A NO-OP IN THIS SECTION/,
      "the prose-only gap must be recorded in the file, not only here");
  }
});
