// The quarantine gates on Eighth's photo-sourced detail.
//
// docs/data/campus-photo-detail.json is INVENTED content — architectural
// photography and a 2021 design plan, not OSM, not LiDAR, not the ArcGIS
// survey. That is allowed, on exactly the terms the scooter run's props are
// allowed: it must SAY it is invented, it must stay inside Eighth, it must
// carry a source tag per item, and it must never become a source for anything
// measured. These tests are what stops the class from quietly widening.
//
// The two that would actually bite in the world:
//
//  * ROUTE CLEARANCE. The scooter run leaves the basketball court heading
//    north through the same ground the BBQ terrace and the amphitheatre tiers
//    sit beside. Nothing invented may come within 3 m of the shipped
//    centreline — an obstacle the ride does not know about is worse than an
//    empty lawn. Checked against every ROTATED footprint corner, not against
//    centres, because a 17 m seating tier's centre can be 8 m clear while its
//    end is not.
//  * ANCHORS ARE REAL. Every item declares an area, and every area declares
//    the surveyed polygon its position was inferred from. A spot check
//    re-derives that containment from campus-eighth.json, so an item that
//    drifts off its anchor fails here rather than floating in a photograph's
//    imagination.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PHOTO_ITEM_TYPES } from "../docs/js/campus-photo-eighth.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => JSON.parse(readFileSync(path.join(ROOT, rel)));
const doc = read("docs/data/campus-photo-detail.json");
const eighth = read("docs/data/campus-eighth.json");
const corridor = read("docs/data/corridor-staging.json");
const E = doc.eighth;

/** The bounds of the Eighth area this module is allowed to touch. */
const BOUNDS = { x0: -220, x1: -40, z0: 500, z1: 640 };
/** Nothing invented may come closer than this to the shipped centreline. */
const ROUTE_CLEARANCE_M = 3;

const inRing = (pts, x, z) => {
  let ins = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i];
    const [xj, zj] = pts[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
};

const yaw = (lx, lz, r) => [lx * Math.cos(r) + lz * Math.sin(r), -lx * Math.sin(r) + lz * Math.cos(r)];

/**
 * Every world point an item occupies in plan: a rotated footprint's four
 * corners, a rect's four corners, a run's two ends, a cluster's rim.
 */
function footprint(it) {
  if (it.rect) {
    const { x0, x1, z0, z1 } = it.rect;
    return [[x0, z0], [x1, z0], [x0, z1], [x1, z1]];
  }
  if (it.x0 !== undefined) return [[it.x0, it.z0], [it.x1, it.z1]];
  const cx = it.x !== undefined ? it.x : it.cx;
  const cz = it.z !== undefined ? it.z : it.cz;
  const out = [[cx, cz]];
  const rot = it.rotY || 0;
  if (it.count !== undefined && it.spacing !== undefined) {
    const [dx, dz] = yaw((it.count - 1) * it.spacing, 0, rot);
    out.push([cx + dx, cz + dz]);
  }
  if (it.r !== undefined && it.count !== undefined) {
    for (const [ox, oz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      out.push([cx + ox * it.r, cz + oz * it.r]);
    }
  }
  const w = it.w !== undefined ? it.w : it.span;
  const d = it.d !== undefined ? it.d : it.width;
  if (w !== undefined && d !== undefined) {
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const [dx, dz] = yaw((sx * w) / 2, (sz * d) / 2, rot);
      out.push([cx + dx, cz + dz]);
    }
  }
  return out;
}

function distToRoute(x, z) {
  const pts = corridor.route.points;
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1];
    const [bx, bz] = pts[i];
    const dx = bx - ax, dz = bz - az;
    const len = dx * dx + dz * dz;
    let t = len ? ((x - ax) * dx + (z - az) * dz) / len : 0;
    t = Math.max(0, Math.min(1, t));
    best = Math.min(best, Math.hypot(x - (ax + t * dx), z - (az + t * dz)));
  }
  return best;
}

test("the document declares itself invented and names its sources", () => {
  assert.match(doc._, /INVENTED/);
  assert.match(doc._, /NEVER A SOURCE FOR ANY MEASURED CONSUMER/);
  assert.match(doc._, /2024-2025/, "the epoch of every usable photograph");
  assert.ok(Array.isArray(doc.sources) && doc.sources.length >= 4);
  for (const url of doc.sources) assert.match(url, /^https:\/\//);
  assert.ok(typeof E.label === "string" && E.label.length > 0);
  assert.equal(typeof E.seed, "number", "the scatter must be seeded, never random");
});

/* The document is SHARED — one photo-sourced file per campus, a section per
   college, so the invented class has exactly one home and one label rather
   than a file per agent that each has to re-declare the quarantine. These
   tests own the `eighth` section only; a sibling section is fine, an
   unlabelled top-level key is not. */
test("the document is sectioned by college under one shared quarantine label", () => {
  const keys = Object.keys(doc).sort();
  assert.ok(keys.includes("_") && keys.includes("sources") && keys.includes("eighth"));
  for (const k of keys) {
    if (k === "_" || k === "sources") continue;
    assert.match(k, /^[a-z][a-z0-9]*$/, `top-level key "${k}" is not a college section`);
    assert.equal(typeof doc[k], "object", `${k} is not a section`);
  }
});

test("every colour is a hex string, and every one carries a source tag", () => {
  const names = Object.keys(E.colors);
  assert.ok(names.length >= 20, `only ${names.length} colours`);
  for (const [name, hex] of Object.entries(E.colors)) {
    assert.equal(typeof hex, "string", `${name} is not a string`);
    assert.match(hex, /^#[0-9a-f]{6}$/, `${name} = ${hex} is not a 6-digit hex`);
    const src = E.colorSources[name];
    assert.ok(typeof src === "string" && src.length > 0, `${name} has no source`);
    assert.match(src, /^\[(measured|estimated)\]/, `${name}: source is not tagged`);
  }
});

test("no item type outside the sourced inventory list", () => {
  const known = new Set(PHOTO_ITEM_TYPES);
  for (const it of E.items) {
    assert.ok(known.has(it.type), `unknown item type "${it.type}" (${it.key})`);
  }
});

test("every item is keyed uniquely, tagged with a source, and colour-resolved", () => {
  const seen = new Set();
  for (const it of E.items) {
    assert.ok(it.key, `item of type ${it.type} has no key`);
    assert.ok(!seen.has(it.key), `duplicate key ${it.key}`);
    seen.add(it.key);
    assert.match(it.source, /\[(measured|estimated)\]/, `${it.key}: untagged source`);
    for (const field of ["color", "fascia", "postColor", "legColor", "railColor",
      "plinthColor", "benchColor", "shoeColor", "spikeColor"]) {
      if (it[field] === undefined) continue;
      assert.ok(E.colors[it[field]], `${it.key}.${field} = "${it[field]}" is not in colors`);
    }
  }
});

test("every item declares an area, and every area declares its surveyed anchor", () => {
  for (const it of E.items) {
    const area = E.areas[it.area];
    assert.ok(area, `${it.key}: area "${it.area}" is not declared`);
    assert.match(area.anchor, /arcgis\.ground#\d+/, `area ${it.area}: anchor is not a survey registration`);
    assert.ok(area.note.length > 40, `area ${it.area}: no note on how the position was inferred`);
    assert.match(area.note, /[Ii]nferred|fitted|Moved|estimated/,
      `area ${it.area}: the note must say the position is an inference`);
  }
});

test("every item lies inside the Eighth area bounds", () => {
  assert.deepEqual(E.bounds, BOUNDS);
  for (const it of E.items) {
    for (const [x, z] of footprint(it)) {
      assert.ok(x >= BOUNDS.x0 && x <= BOUNDS.x1 && z >= BOUNDS.z0 && z <= BOUNDS.z1,
        `${it.key}: (${x}, ${z}) is outside the Eighth bounds`);
    }
  }
});

test("nothing invented comes within 3 m of the scooter run's centreline", () => {
  let worst = Infinity;
  let worstKey = "";
  for (const it of E.items) {
    for (const [x, z] of footprint(it)) {
      const d = distToRoute(x, z);
      if (d < worst) { worst = d; worstKey = it.key; }
      assert.ok(d >= ROUTE_CLEARANCE_M,
        `${it.key}: (${x}, ${z}) is ${d.toFixed(2)} m from the route centreline`);
    }
  }
  assert.ok(worst >= ROUTE_CLEARANCE_M, `closest is ${worstKey} at ${worst.toFixed(2)} m`);
});

test("the anchors are real: each area's spokesman item sits on its surveyed polygon", () => {
  const ground = eighth.ground;
  const checks = [
    ["bbq-counter", "courtyard-2375"],
    ["bbq-enclosure", "courtyard-2375"],
    ["bbq-table-1", "courtyard-2375"],
    ["tea-house", "planting-bed-331"],
    ["fire-seat-wall", "courtyard-2369"],
    ["bike-rack-a", "walkway-3238"],
    ["bike-rack-b", "courtyard-2703"],
    ["ramble-bridge-1", "walkway-2990"],
    ["ramble-bridge-2", "walkway-4039"],
  ];
  for (const [key, ring] of checks) {
    const it = E.items.find((i) => i.key === key);
    assert.ok(it, `${key} is gone from the data`);
    assert.ok(ground[ring], `${ring} is gone from the survey`);
    assert.ok(inRing(ground[ring].points, it.x, it.z),
      `${key} at (${it.x}, ${it.z}) is no longer on ${ring}`);
  }
});

test("the meditation composition stays on the open spine, off both planted rings", () => {
  const ground = eighth.ground;
  const spine = E.items.filter((i) => i.area === "meditation");
  assert.ok(spine.length >= 8);
  for (const it of spine) {
    for (const [x, z] of footprint(it)) {
      for (const ring of ["courtyard-328", "courtyard-329"]) {
        assert.ok(!inRing(ground[ring].points, x, z),
          `${it.key}: (${x}, ${z}) overruns the measured ${ring}`);
      }
    }
  }
});

test("the amphitheatre tiers stay clear of the surveyed basketball court", () => {
  const court = eighth.ground["basketball-court"].points;
  const eastEdge = Math.max(...court.map((p) => p[0]));
  for (const it of E.items.filter((i) => i.type === "amphitheatre-tier")) {
    const west = it.x - it.w / 2;
    assert.ok(west - eastEdge >= 0.5,
      `${it.key}: only ${(west - eastEdge).toFixed(2)} m clear of the court paint`);
  }
});

test("exactly the two photographed grill bays are modelled, and no third", () => {
  const bays = E.items.filter((i) => i.type === "grill-bay");
  assert.equal(bays.length, 2, "the inventory photographs two bays and says not to invent a third");
});

test("what is deliberately absent is written down, not silently missing", () => {
  assert.ok(Array.isArray(E.absent) && E.absent.length >= 6);
  const joined = E.absent.join(" ");
  for (const gap of ["hoop", "Survivance", "species", "third grill"]) {
    assert.match(joined, new RegExp(gap, "i"), `the ${gap} gap is not declared`);
  }
  for (const banned of ["basketball-hoop", "backboard", "court-fence", "mural", "tree"]) {
    assert.ok(!E.items.some((i) => i.type === banned), `${banned} is modelled but unsourced`);
  }
});

test("the renderer's known types and the data's used types stay in step", () => {
  const used = new Set(E.items.map((i) => i.type));
  const declared = new Set(PHOTO_ITEM_TYPES);
  for (const t of used) assert.ok(declared.has(t), `${t} is in the data but not in the renderer`);
  assert.equal(declared.size, PHOTO_ITEM_TYPES.length, "PHOTO_ITEM_TYPES has a duplicate");
});
