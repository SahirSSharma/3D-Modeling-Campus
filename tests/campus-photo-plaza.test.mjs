/* The Revelle Plaza landscape's photo-sourced detail section.
 *
 * INVENTED class, so the gates are about quarantine, about the tree
 * re-skins never moving a measured trunk, and about not contradicting the
 * measured world:
 *
 *   - it is labelled, epoch-stamped, sourced, and it says what it left out;
 *   - colours are data, and they are hex;
 *   - every re-skinned tree copies its (x, z, h, r) VERBATIM from the
 *     measured LiDAR table, and the skip list main uses to suppress the blob
 *     rendering is exactly the set of re-skinned keys;
 *   - the coral tree is NOT in the LiDAR (planted at/after the 2014 epoch)
 *     and must never appear in the skip list;
 *   - NO PALMS, and the paving parameters that survived ground-truthing
 *     (pitch 6.4 / band 0.42 / radius 1.8) match the revelle section's;
 *   - everything stays inside Zone 1, nothing invented sits inside a
 *     measured building footprint, and no solid comes within 3 m of the
 *     corridor-staging centreline (the run crosses this exact plaza);
 *   - the module builds headless, twice, byte-identically, and everything
 *     it places rides surfaceAt.
 *
 * The section will live under the `plaza` key of
 * docs/data/campus-photo-detail.json; until the main session merges it, the
 * tests read the build-side copy in the scratchpad.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as THREE from "../docs/vendor/three/three.module.min.js";
import { createPhotoPlaza } from "../docs/js/campus-photo-plaza.js";
import {
  assertCoverage, assertEstimateBands, assertPins, assertRelations,
  assertTierSymmetry, assertAbsentEntries, assertExprs, assertDispositions,
} from "./helpers/axiom-gate.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(p, "utf8"));

const MERGED = join(root, "docs/data/campus-photo-detail.json");
const photoDoc = read(MERGED);
const section = photoDoc.plaza;

const campus = read(join(root, "docs/data/campus-3d.json"));
const arcgis = read(join(root, "docs/data/campus-arcgis.json"));
const lidar = read(join(root, "docs/data/campus-lidar.json"));
const staging = read(join(root, "docs/data/corridor-staging.json"));

/** A ring from campus-arcgis.json, in world metres (the file stores decimetres). */
const arcRing = (i) => arcgis.ground[i].r[0].map(([x, z]) => [x / 10, z / 10]);
const bboxOf = (ring) => ({
  x0: Math.min(...ring.map((p) => p[0])), x1: Math.max(...ring.map((p) => p[0])),
  z0: Math.min(...ring.map((p) => p[1])), z1: Math.max(...ring.map((p) => p[1])),
});

/* Zone 1 bounds from the survey: x -210..155, z 295..505. */
const ZONE = { x0: -210, x1: 155, z0: 295, z1: 505 };

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

/** Every measured tree re-skin declared by the section. */
function reskins() {
  const T = section.treeOverrides;
  return [...T.pines.items, ...T.ficus.items, ...T.eucalyptus.items];
}

/** Every solid ground point the section stands up (trunks, furniture). */
function solids() {
  const out = [];
  const F = section.furniture;
  for (const it of F.lamp.items) out.push([it.x, it.z, "lamp"]);
  /* Held items are not drawn, so they are not solids the route can hit; the
     hold itself is gated separately, below. */
  for (const it of F.benches.items) {
    if (it.held) continue;
    for (const side of [-1, 1]) {
      out.push([
        it.x + Math.cos(it.rot) * side * (F.benches.length / 2),
        it.z - Math.sin(it.rot) * side * (F.benches.length / 2),
        "bench",
      ]);
    }
  }
  for (const it of F.binPairs.items) {
    out.push([it.x, it.z, "bin"]);
    out.push([it.x + Math.cos(it.rot) * F.binPairs.gap, it.z - Math.sin(it.rot) * F.binPairs.gap, "bin"]);
  }
  for (const it of F.terraces.items) {
    for (const [ox, oz] of [[0, 0], [-1.25, 0], [1.25, 0], [0, -1.25], [0, 1.25]]) {
      out.push([it.x + ox, it.z + oz, "umbrella"]);
    }
  }
  /* The bike run was RETIRED 2026-08-21 (R2 arbitration item R2) and draws
     nothing, so it is no longer a solid the route or a footprint can hit; the
     retirement itself is gated below, at `furniture.bikes.count === 0`. */
  if (F.bikes.count) out.push([F.bikes.x0, F.bikes.z, "bike"], [F.bikes.x1, F.bikes.z, "bike"]);
  const Fo = section.fountain;
  const half = Fo.plinth / 2;
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const lx = sx * half;
    const lz = sz * half;
    out.push([
      Fo.cx + lx * Math.cos(Fo.rot) + lz * Math.sin(Fo.rot),
      Fo.cz - lx * Math.sin(Fo.rot) + lz * Math.cos(Fo.rot),
      "fountain",
    ]);
  }
  const B = section.memorial.bench;
  const span = B.arcLength / B.radius;
  for (let i = 0; i <= 4; i++) {
    const a = (i / 4 - 0.5) * span;
    out.push([
      section.memorial.cx + Math.sin(a) * (B.radius + B.depth / 2),
      section.memorial.cz + Math.cos(a) * (B.radius + B.depth / 2),
      "memorial-bench",
    ]);
  }
  /* Trunks — measured positions plus the multi-stem spread of ficus/coral. */
  for (const t of reskins()) out.push([t.x, t.z, "trunk"]);
  const spreadOf = { ficus: 1.6, coral: 2.0 };
  for (const kind of ["ficus"]) {
    for (const t of section.treeOverrides[kind].items) {
      for (const [ox, oz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        out.push([t.x + ox * spreadOf[kind], t.z + oz * spreadOf[kind], "stem"]);
      }
    }
  }
  const c = section.treeOverrides.coral;
  for (const [ox, oz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    out.push([c.x + ox * spreadOf.coral, c.z + oz * spreadOf.coral, "coral"]);
  }
  return out;
}

/* ------------------------------------------------------------------ gates */

test("the section exists and is reachable", () => {
  assert.ok(section, `no plaza key in ${MERGED}`);
});

test("it says what it is, where it came from, and what it left out", () => {
  assert.match(section.label, /Revelle Plaza/i);
  assert.ok(section.epoch, "no epoch stamp");
  assert.match(section.note, /INVENTED/, "the note must declare the class");
  assert.ok(Array.isArray(section.sources) && section.sources.length >= 6);
  for (const url of section.sources) assert.match(url, /^https:\/\//);
  assert.ok(Array.isArray(section.absent) && section.absent.length >= 12,
    `absent has ${section.absent?.length} entries — better absent than wrong, and this list does not shrink`);
  /* The gaps the survey named must stay named. */
  for (const re of [/palm/i, /salmon/i, /drinking fountain/i, /el mac/i, /erythrina/i]) {
    assert.ok(section.absent.some((a) => re.test(a)), `absent must keep the ${re} entry`);
  }
});

test("colours are data, and they are hex", () => {
  const keys = Object.keys(section.colors);
  assert.ok(keys.length >= 25, `only ${keys.length} colours`);
  for (const [k, v] of Object.entries(section.colors)) {
    assert.match(v, /^#[0-9a-f]{6}$/, `${k} is not a lowercase 6-digit hex`);
  }
  /* The banner is gold-dominant; a mostly-navy banner would be wrong. */
  const gold = section.colors.bannerGold;
  const r = parseInt(gold.slice(1, 3), 16);
  const b = parseInt(gold.slice(5, 7), 16);
  assert.ok(r > 200 && r > b * 2, `bannerGold ${gold} is not a saturated gold`);
  /* The pale lava flecks are genuinely pale — part 1's value was too dark. */
  assert.ok(parseInt(section.colors.lavaRockPale.slice(1, 3), 16) > 0xb0,
    "lavaRockPale must read as the cream flecks, not another brown");
});

test("no palms, anywhere in the section", () => {
  const body = JSON.stringify({ ...section, absent: [], note: "" });
  assert.ok(!/palm/i.test(body), "a palm crept into the plaza");
});

test("every re-skinned tree copies a measured LiDAR trunk verbatim", () => {
  const table = new Map(lidar.trees.map((t) => [`${t[0]},${t[1]}`, t]));
  for (const it of reskins()) {
    const key = `${it.x},${it.z}`;
    const t = table.get(key);
    assert.ok(t, `${key} is not in the measured tree table`);
    assert.equal(it.h, t[2], `${key} height drifted from the survey`);
    assert.equal(it.r, t[3], `${key} crown radius drifted from the survey`);
  }
});

test("the skip list is exactly the re-skinned keys, and the coral tree is not in it", () => {
  const keys = reskins().map((it) => `${it.x},${it.z}`).sort();
  const skip = [...section.treeOverrides.skipMeasuredKeys].sort();
  assert.deepEqual(skip, keys, "skipMeasuredKeys must match the re-skinned trunks one for one");
  const c = section.treeOverrides.coral;
  assert.ok(!skip.includes(`${c.x},${c.z}`), "the coral tree has no measured trunk to skip");
  assert.ok(!lidar.trees.some((t) => t[0] === c.x && t[1] === c.z),
    "the coral tree must not shadow a measured trunk");
  assert.match(c.tag, /\[estimated\]/, "the coral tree's grown size is an estimate and must say so");
});

test("the York belt is the survey's twelve Torrey pines", () => {
  const P = section.treeOverrides.pines.items;
  assert.equal(P.length, 12);
  for (const it of P) {
    assert.ok(it.x >= 70 && it.x <= 89 && it.z >= 336 && it.z <= 467,
      `pine at (${it.x}, ${it.z}) is outside the York belt`);
  }
});

test("eucalyptus lives only east of York and on the Keeling west road", () => {
  for (const it of section.treeOverrides.eucalyptus.items) {
    const eastOfYork = it.x >= 95;
    const keelingRoad = it.x <= -110;
    assert.ok(eastOfYork || keelingRoad,
      `eucalyptus at (${it.x}, ${it.z}) is inside the plaza, where the photos show pine and ficus`);
  }
});

test("the paving field is this section's own, and the arcs derive from it", () => {
  /* RETIRES the gate that asserted these matched the revelle section's block.
     research-plaza.md 1.1 moves the field here so the plaza's ground can be
     audited as one thing; a cross-section read is exactly what stopped it
     being auditable. The old gate would now pass on a stale copy. */
  const p = section.paving;
  assert.ok(p?.cells?.length, "plaza.paving is missing — the deck has no owner");
  assert.equal(section.arcs.pitch, p.pitch, "the arcs must fan on the paving's own module");
  assert.equal(section.arcs.band, p.band);
  assert.equal(section.arcs.radius, p.radius);
  const src = readFileSync(join(root, "docs/js/campus-photo-plaza.js"), "utf8");
  assert.ok(!/photo\?\.revelle/.test(src),
    "the module still reaches into the revelle section for its paving");
});

test("the paving module is the measured one, and the cells regenerate from it", () => {
  /* THE GATE THAT FAILS ON A FABRICATION. The cells are not a list somebody
     typed: they are gridOrigin + pitch x (k + 0.5), filtered to the measured
     plaza polygon and off the surveyed lawn. Regenerate them here from the
     three declared numbers and demand the shipped array back, exactly. */
  const p = section.paving;
  assert.equal(p.pitch, 6.65, "the module is the joint fit's 6.65 m, not 6.4 and not a round 6.7");
  assert.equal(p.gridOrigin.x, -1.431, "the x phase is the least-squares intercept");
  assert.equal(p.gridOrigin.z, 350.072, "the z phase is the least-squares intercept");

  const plazaRing = campus.surfaces.find((q) => q.n === "Revelle Plaza" && q.kind === "plaza").p;
  /* Every planted polygon the section itself ships — a cell's whole footprint
     must clear each by more than one joint band, not merely its centre. */
  const planted = [
    bboxOf(arcRing(2323)),
    { x0: section.northBed.x0, x1: section.northBed.x1, z0: section.northBed.z0, z1: section.northBed.z1 },
    ...section.beds.items.map((b) => bboxOf(arcRing(Number(b.ring.split("#")[1])))),
  ];
  const h = p.pitch / 2;
  const clears = (x, z) => planted.every((q) =>
    Math.min(x + h, q.x1) - Math.max(x - h, q.x0) <= p.band ||
    Math.min(z + h, q.z1) - Math.max(z - h, q.z0) <= p.band);
  const want = [];
  for (let i = -4; i <= 12; i++) {
    for (let j = -4; j <= 12; j++) {
      const x = +(p.gridOrigin.x + p.pitch * (i + 0.5)).toFixed(3);
      const z = +(p.gridOrigin.z + p.pitch * (j + 0.5)).toFixed(3);
      if (z < p.gridOrigin.z - p.pitch) continue;
      if (!inRing(x, z, plazaRing)) continue;
      if (!clears(x, z)) continue;
      want.push([x, z]);
    }
  }
  assert.deepEqual(p.cells, want,
    "the cells are not what the declared grid generates — either a cell was hand-edited or the grid was");
  assert.equal(p.cells.length, 44, "the 9 x 5 deck, less the one cell that lies in bed #2160");

  /* And the module the joints give must be the module the OBJECTS on it give:
     both measured bench rows run on the same pitch, which is the single
     strongest check that 6.65 is the plaza's real module. */
  const north = section.furniture.benches.items.filter((it) => it.z < 350).map((it) => it.x);
  const gaps = north.slice(1).map((x, i) => x - north[i]);
  for (const g of gaps) {
    assert.ok(Math.abs(g - p.pitch) < 0.1,
      `a bench-row gap of ${g.toFixed(2)} m is off the ${p.pitch} m paving module`);
  }
});

test("no paving cell is laid on ground the survey says is planted", () => {
  /* The legacy field ran two rows across the surveyed north bed, and its
     lawn-flanking cells lay 1.78 m across the surveyed lawn. This gate checks
     the FOOTPRINT, because checking the centre is what let both through. */
  const p = section.paving;
  const h = p.pitch / 2;
  const planted = [
    ["the surveyed lawn", bboxOf(arcRing(2323))],
    ["the north bed", section.northBed],
    ...section.beds.items.map((b) => [b.ring, bboxOf(arcRing(Number(b.ring.split("#")[1])))]),
  ];
  for (const [x, z] of p.cells) {
    for (const [name, q] of planted) {
      const ox = Math.min(x + h, q.x1) - Math.max(x - h, q.x0);
      const oz = Math.min(z + h, q.z1) - Math.max(z - h, q.z0);
      assert.ok(ox <= p.band || oz <= p.band,
        `paving cell (${x}, ${z}) intrudes ${ox.toFixed(2)} x ${oz.toFixed(2)} m into ${name}`);
    }
    assert.ok(!inRing(x, z, arcRing(2323)), `paving cell (${x}, ${z}) is centred on the surveyed lawn`);
  }
  for (const z of p.runner) {
    assert.ok(z >= section.northBed.z1, `runner segment at z ${z} runs into the north bed`);
  }
  /* And the walks the footprint rule removed are declared, not silently gone. */
  assert.ok(section.absent.some((a) => /lawn-flanking WALKS/.test(a)),
    "the six retired walk cells must leave a declared gap");
});

test("everything stays inside Zone 1", () => {
  for (const [x, z, what] of solids()) {
    assert.ok(x >= ZONE.x0 && x <= ZONE.x1 && z >= ZONE.z0 && z <= ZONE.z1,
      `${what} at (${x}, ${z}) is outside Zone 1`);
  }
  for (const p of [...section.lawns.panels, section.lawns.crossWalk, section.dgBelt]) {
    for (const x of [p.x0, p.x1]) for (const z of [p.z0, p.z1]) {
      assert.ok(x >= ZONE.x0 && x <= ZONE.x1 && z >= ZONE.z0 && z <= ZONE.z1,
        `a ground rect corner (${x}, ${z}) is outside Zone 1`);
    }
  }
});

test("nothing invented sits inside a measured building footprint", () => {
  const rings = campus.buildings.filter((b) => b.p && b.p.length >= 3);
  for (const [x, z, what] of solids()) {
    for (const b of rings) {
      assert.ok(!inRing(x, z, b.p), `${what} at (${x}, ${z}) is inside ${b.n || "an unnamed mass"}`);
    }
  }
});

test("no solid object crowds the scooter corridor", () => {
  /* The staging run crosses this exact plaza — first along Argo's south face,
     then diagonally over the paving to the north approach. Flat decals under
     the track are fine; anything you can hit is not. */
  let worst = Infinity;
  let at = null;
  for (const [x, z, what] of solids()) {
    const d = toRoute(x, z);
    if (d < worst) { worst = d; at = [x, z, what]; }
  }
  assert.ok(worst >= 3, `closest solid is ${worst.toFixed(2)} m from the centreline at ${JSON.stringify(at)}`);
});

test("the lamp standard and its banners land on the measured brackets", () => {
  const L = section.furniture.lamp;
  assert.ok(L.height >= 5.5 && L.height <= 6.0, `pole ${L.height} m is outside the measured 5.5-6.0`);
  assert.ok(L.bannerBottomY >= 2.8 && L.bannerBottomY <= 3.1, "banner bottom bracket 2.8-3.1 m");
  const top = L.bannerBottomY + L.bannerSize[1];
  assert.ok(top >= 4.2 && top <= 4.5, `banner top ${top.toFixed(2)} m is outside the measured 4.2-4.5`);
  assert.deepEqual(L.bannerSize, [0.51, 1.37], "banners are the published 20x54-inch size");
});

test("the fountain is a nested object, and every ring is pinned to its instrument", () => {
  /* RETIRES the 8.5-9.0 m plinth band: research-plaza.md 4.1/4.2 shows the
     three 'disagreeing' figures are three edges of one nested object, and the
     plinth measures 7.50 x 7.75. The old band would now pass only on the
     error it was written around. */
  const F = section.fountain;

  /* (a) the plinth, from its own measured edges */
  assert.equal(F.plinth, 7.63, "the plinth is the mean of a measured 7.50 x 7.75");
  assert.equal(Math.round(((7.50 + 7.75) / 2) * 100) / 100, 7.63, "and that mean must stay arithmetic");
  assert.ok(F.plinthBase < F.plinth, "the plinth is battered — its base is narrower than its deck");
  assert.equal(Math.round((F.plinth - 2 * F.plinthBatter) * 100) / 100, F.plinthBase,
    "plinthBase must be plinth - 2 x plinthBatter, or the batter is decorative");

  /* (b) the coping, against the survey it is measured from */
  const water = arcgis.ground[3770];
  assert.equal(water.k, "water", "arcgis.ground#3770 is the fountain's water polygon");
  const ring = arcRing(3770);
  let a2 = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a2 += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  const dia = 2 * Math.sqrt(Math.abs(a2 / 2) / Math.PI);
  assert.ok(Math.abs(F.basinRadius * 2 - dia) < 0.2,
    `basinRadius ${F.basinRadius} does not match arcgis.ground#3770's ${(dia / 2).toFixed(2)} m`);

  /* (c) the water surface, against the OSM polygon inside the coping */
  const surf = campus.surfaces[34];
  assert.match(surf.n, /Revelle Plaza Fountain/);
  const sw = Math.max(...surf.p.map((p) => p[0])) - Math.min(...surf.p.map((p) => p[0]));
  assert.ok(sw < F.basinRadius * 2, "the water surface must be INSIDE the coping, not outside it");
  assert.ok(sw < F.plinth, "and the coping inside the plinth — that is what 'nested' means");

  /* (d) the seating argument that now sources the plinth height */
  assert.ok(F.plinthHeight >= 0.42 && F.plinthHeight <= 0.50,
    "the deck is a seat-height ledge — bb5393567s photographs three adults sitting on it");
  assert.match(section.derivations.reads.plinthHeight, /bb5393567s/);
  assert.match(section.derivations.reads.plinthHeight, /sitting|SITTING/);

  /* (e) the centre stays the surveyed OSM point */
  assert.ok(Math.abs(F.cx - 38.6) <= 0.05 && Math.abs(F.cz - 369.8) <= 0.05,
    "the fountain centre is the landmark's surveyed OSM point");
});

test("the fountain is square to the paving, not turned 15 degrees", () => {
  const F = section.fountain;
  assert.equal(F.rot, 0, "three tests bound the skew below 0.5 degrees; the shipped 0.26 rad was 14.9");
  assert.match(section.derivations.figures.fountainRotation, /0\.42 degrees/,
    "the paving x-phase bound must stay on the record");
  assert.match(section.derivations.figures.fountainRotation, /0\.12 degrees/,
    "the paving z-phase bound must stay on the record");
  /* A 15 degree error on a 7.63 m square swings a corner by this much: */
  const half = (F.plinth / 2) * Math.SQRT2;
  assert.ok(half * 2 * Math.sin(0.26 / 2) > 1.3,
    "the arithmetic that condemned the old rotation must stay checkable");
});

test("the jet is a countable nozzle ring, not a smooth cone", () => {
  const J = section.fountain.jet;
  assert.ok(!("skirtRadius" in J), "the cone skirt is retired — bb5393567s shows discrete arcs");
  assert.equal(J.nozzles, 28, "counted at 7-8 separable arcs per visible quadrant");
  assert.ok(J.nozzleRadius < section.fountain.basinRadius,
    "the nozzles must sit INSIDE the coping they spring from");
  assert.ok(J.coreHeight > J.nozzleRise, "the central plume must out-throw the perimeter ring");
  /* The count is low-confidence and the disagreement must be declared. */
  assert.match(section.derivations.figures.nozzleCount, /LOW CONFIDENCE/);
  assert.ok(section.conflicts.some((c) => /NOZZLE/i.test(c)) ||
    /20-26/.test(section.derivations.figures.nozzleCount),
    "the competing 20-26 read must be on the record");
  assert.ok(section.absent.some((a) => /NOZZLE COUNT/i.test(a)),
    "an uncertified count keeps its gap declared");
});

test("the fountain replaces the landmark ring fountain instead of joining it", () => {
  /* campus-landmarks' 'Revelle Plaza Fountain' draws an 8 m basin and jet at
     the same surveyed OSM point. The section must (a) sit ON that point —
     position from OSM wins over the photo/satellite read — and (b) carry the
     wiring declaration main uses to suppress the landmark basin/jet, or the
     merged world shows two interpenetrating fountains. */
  const F = section.fountain;
  assert.equal(F.replacesLandmark, "Revelle Plaza Fountain",
    "the section must name the landmark fountain it supersedes");
  assert.match(F.replacesNote, /SUPPRESS/i, "the wiring instruction must be explicit");
  assert.match(F.replacesNote, /flagpole/i, "the landmark's flagpole must be declared KEPT");
  assert.ok(Math.abs(F.cx - 38.6) <= 0.05 && Math.abs(F.cz - 369.8) <= 0.05,
    "the fountain centre is the landmark's surveyed OSM point (38.6, 369.8)");
});

test("the memorial is flush, starred, and benched on lava rock", () => {
  const M = section.memorial;
  assert.ok(M.slabRadius >= 3.5 && M.slabRadius <= 4.0, "half-disc radius 3.5-4.0 m");
  assert.ok(M.lenses.length >= 14 && M.lenses.length <= 16, "~14-16 flush lenses");
  for (const [lx, lv] of M.lenses) {
    assert.ok(Math.hypot(lx, lv) <= M.slabRadius && lv >= 0,
      `lens (${lx}, ${lv}) is off the half-disc slab`);
  }
  assert.match(M.lensNote, /\[estimated\]/, "the star layout is an estimate and must say so");
  assert.ok(M.bench.arcLength >= 3.5 && M.bench.arcLength <= 4.0, "bench arc 3.5-4.0 m");
});

test("the lawn is the surveyed polygon, banded by a measured edging strip", () => {
  /* RETIRES the two-panel-and-a-6-m-cross-walk gate. research-plaza.md 5.3
     shows the south panel was 4.4 m out and the cross-walk does not exist;
     the old gate asserted both errors, and its area check passed because the
     shipped total (1427 m2) was close to the surveyed 1498 m2. */
  const L = section.lawns;
  assert.equal(L.ring, "arcgis.ground#2323", "the lawn must cite the ring it is taken from");
  const b = bboxOf(arcRing(2323));
  const outer = {
    x0: Math.min(...L.panels.map((p) => p.x0)), x1: Math.max(...L.panels.map((p) => p.x1)),
    z0: Math.min(...L.panels.map((p) => p.z0)), z1: Math.max(...L.panels.map((p) => p.z1)),
  };
  for (const k of ["x0", "x1", "z0", "z1"]) {
    assert.ok(Math.abs(outer[k] - b[k]) < 0.05,
      `the lawn's ${k} is ${outer[k]}, the survey's is ${b[k]} — the outline is not the ring's`);
  }
  /* The split is the MEASURED band, and it exactly fills the gap. */
  const e = L.edging;
  assert.equal(e.z0, L.panels[0].z1, "the edging band must start where the north panel ends");
  assert.equal(e.z1, L.panels[1].z0, "and end where the south panel begins — no gap, no overlap");
  const w = e.z1 - e.z0;
  assert.ok(Math.abs(w - 1.30) < 0.02, `the edging band is ${w.toFixed(2)} m, measured at 1.30`);
  assert.ok(w < 2, "it is a mow strip, not the 6 m walk the retired entry claimed");
  assert.match(section.derivations.figures.lawnEdging, /398\.36/);
  assert.match(section.derivations.figures.lawnEdging, /399\.66/);
  /* And the thing it replaced is retired, not deleted. */
  assert.ok(L.crossWalk, "the retired cross-walk stays described");
  assert.ok(section.superseded.crossWalk, "and it is declared in superseded");
  assert.match(section.superseded.crossWalk.why, /does not exist/i);
});

test("the north bed is built, on the two surveys' own outline", () => {
  /* The plaza's whole north third, unbuilt until R1. */
  const b = section.northBed;
  const gis = bboxOf(arcRing(2377));
  const osm = campus.surfaces[90];
  assert.equal(osm.kind, "green", "campus-3d surfaces[90] is the north bed's OSM polygon");
  const osmB = bboxOf(osm.p);
  for (const [k, v] of [["x0", "x0"], ["x1", "x1"], ["z0", "z0"], ["z1", "z1"]]) {
    const mean = Math.round(((gis[v] + osmB[v]) / 2) * 100) / 100;
    assert.ok(Math.abs(b[k] - mean) < 0.02,
      `northBed.${k} is ${b[k]}; the two surveys' mean is ${mean}`);
  }
  const area = (b.x1 - b.x0) * (b.z1 - b.z0);
  assert.ok(area > 490 && area < 530, `the bed is ${area.toFixed(0)} m2, between the surveyed 493 and 528`);
  assert.deepEqual(b.rings, ["campus-3d surfaces[90]", "arcgis.ground#2377"]);
  /* The epoch conflict must be declared, and the bed must NOT be lawn green. */
  assert.notEqual(section.colors.northBedTurf, section.colors.lawn,
    "repainting the dormant bed the lawn's green would be inventing irrigation");
  assert.match(b.epochNote, /EPOCH CONFLICT/i);
  assert.ok(section.conflicts.some((c) => /NORTH BED/i.test(c)));
  /* Both lamp pads are inside the bed they stand in. */
  assert.equal(b.lamps.length, 2);
  for (const l of b.lamps) {
    assert.ok(l.x > b.x0 && l.x < b.x1 && l.z > b.z0 && l.z < b.z1,
      `a north-bed lamp at (${l.x}, ${l.z}) is not in the bed`);
    assert.ok(section.furniture.lamp.items.some((it) => it.x === l.x && it.z === l.z && !it.banner),
      "each north-bed pad must carry an UNBANNERED lamp item — the banner is a separate claim");
  }
});

test("the five flanking beds are the surveyed rings, cited by index", () => {
  const want = [2151, 2160, 2161, 2697, 2698];
  assert.equal(section.beds.items.length, want.length);
  section.beds.items.forEach((bed, i) => {
    assert.equal(bed.ring, `arcgis.ground#${want[i]}`, "each bed must name the ring it is taken from");
    const b = bboxOf(arcRing(want[i]));
    for (const k of ["x0", "x1", "z0", "z1"]) {
      assert.ok(Math.abs(bed[k] - b[k]) < 0.06,
        `${bed.ring}'s ${k} is ${bed[k]}, the survey's is ${b[k]}`);
    }
    assert.ok(bed.area > 0, "the ring's own area is recorded so a renumbering is detectable");
  });
  /* And the shrubs on them are declared, not invented. */
  assert.ok(section.absent.some((a) => /flanking beds' SHRUBS/.test(a)));
});

test("the DG belt is clipped on Galbraith's measured ring, so nothing is built twice", () => {
  const g = campus.buildings.find((b) => b.n === "Galbraith Hall");
  const minZ = Math.min(...g.p.map((p) => p[1]));
  assert.equal(section.dgBelt.z1, minZ,
    "the belt's south edge must BE Galbraith's ring edge, not a round number near it");
  const gal = photoDoc.galbraith?.east?.dg?.[0];
  if (gal) {
    assert.ok(section.dgBelt.z1 <= gal.z0,
      `the belt still overlaps galbraith.east.dg, which starts at z ${gal.z0}`);
  }
  assert.equal(section.dgBelt.x1, section.bounds.x1,
    "the belt's east edge is the ownership line bounds declares");
});

/* ------------------------------------------------------- the R1 apparatus
 *
 * The Eighth audit proved 22 presence gates can pass on wholesale fabricated
 * values. Every gate below is pinned to the arithmetic behind a figure, so it
 * fails if a sourced number is replaced by a self-consistent invention.
 */

test("the measured bench rows are on the paving module, and the hold is earned", () => {
  /* Both rows are measured off the same frame as the paving joints, so they
     are the strongest independent check that 6.65 m is the plaza's module. */
  const B = section.furniture.benches;
  assert.equal(B.items.length, 7, "four north-row objects and three south-row");
  assert.equal(B.length, 3.9, "the mean of seven measured x extents");
  assert.equal(B.depth, 0.88, "the modal measured z extent");
  const north = B.items.filter((it) => it.z < 350);
  const south = B.items.filter((it) => it.z >= 350);
  assert.equal(north.length, 4);
  assert.equal(south.length, 3);
  for (const it of north) assert.ok(Math.abs(it.z - 344.6) < 0.15, "the north row is one line");
  for (const it of south) assert.ok(Math.abs(it.z - 375.15) < 0.15, "the south row is one line");
  for (const row of [north, south]) {
    for (let i = 1; i < row.length; i++) {
      const gap = row[i].x - row[i - 1].x;
      assert.ok(Math.abs(gap - section.paving.pitch) < 0.1,
        `a bench gap of ${gap.toFixed(2)} m is off the ${section.paving.pitch} m module`);
    }
  }

  /* THE HOLD MUST BE EXACTLY THE ITEMS THE CLEARANCE RULE CONDEMNS — no more,
     no fewer. A hold that is wider than its justification is a deletion with
     a nicer name; one that is narrower ships something on the route. */
  for (const it of B.items) {
    const worst = Math.min(...[-1, 1].map((side) =>
      toRoute(it.x + Math.cos(it.rot) * side * (B.length / 2),
        it.z - Math.sin(it.rot) * side * (B.length / 2))));
    if (it.held) {
      assert.equal(it.held, "corridor");
      assert.ok(worst < 3,
        `the bench at (${it.x}, ${it.z}) is held but clears the centreline by ${worst.toFixed(2)} m`);
    } else {
      assert.ok(worst >= 3,
        `the bench at (${it.x}, ${it.z}) is drawn but is ${worst.toFixed(2)} m from the centreline`);
    }
  }
  assert.equal(B.items.filter((it) => it.held).length, 2,
    "exactly the two objects the 3 m rule condemns — the third clears by 6.28 m and ships");
  assert.ok(B.heldNote.length > 200, "a hold with no reason is a deletion with extra steps");
  assert.match(B.heldNote, /HELD OUT OF THE DRAW, KEPT IN THE RECORD/);
  assert.ok(section.conflicts.some((c) => /HELD, NOT DELETED, NOT LOOSENED/.test(c)),
    "the corridor collision must be declared for arbitration");
  assert.ok(section.absent.some((a) => /HELD OUT OF THE DRAW/.test(a)),
    "and it must be visible in absent, where the gaps are read");
});

test("bounds is declared, and everything outside it is named and owned", () => {
  const b = section.bounds;
  assert.deepEqual(Object.keys(b).sort(), ["x0", "x1", "z0", "z1"]);
  /* The east and south edges are measured lines, not preferences. */
  const g = campus.buildings.find((q) => q.n === "Galbraith Hall");
  assert.equal(b.z1, Math.min(...g.p.map((p) => p[1])), "the south edge is Galbraith's ring");
  /* york's R1 mulch is a wall-chord object; its west edge is the declared
     dgBelt abutment. The truth is unchanged: plaza's x1 stops short of it. */
  const yorkMulch = photoDoc.york?.westGround?.mulch;
  if (yorkMulch) {
    assert.ok(b.x1 <= yorkMulch.xWest,
      "the east edge must stop short of york's own beds");
  }
  /* The plaza's own measured ground must all be inside. */
  const inside = (x, z) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1;
  for (const [x, z] of section.paving.cells) assert.ok(inside(x, z), `paving cell (${x}, ${z}) is outside bounds`);
  for (const r of [...section.lawns.panels, section.lawns.edging, section.northBed,
    ...section.beds.items, section.dgBelt]) {
    for (const x of [r.x0, r.x1]) {
      for (const z of [r.z0, r.z1]) {
        assert.ok(inside(x, z), `a ground rect corner (${x}, ${z}) is outside bounds`);
      }
    }
  }
  /* And what is NOT inside must be declared rather than quietly carried. */
  assert.ok(section.boundsExceptions.length >= 5, "bounds is a claim; its exceptions must be listed");
  const outside = section.furniture.lamp.items.filter((it) => !inside(it.x, it.z))
    .concat(section.furniture.benches.items.filter((it) => !inside(it.x, it.z)))
    .concat(section.furniture.terraces.items.filter((it) => !inside(it.x, it.z)));
  assert.ok(outside.length > 0, "if nothing is outside, the exception list is stale");
  for (const re of [/terraces/, /lamp/, /benches/, /bikes/, /treeOverrides/]) {
    assert.ok(section.boundsExceptions.some((e) => re.test(e)),
      `boundsExceptions must account for ${re}`);
  }
});

test("every colour carries a provenance tier, and no tier is a bare assertion", () => {
  assert.deepEqual(
    Object.keys(section.colorSources).sort(), Object.keys(section.colors).sort(),
    "colorSources must cover exactly the colors block"
  );
  for (const [k, line] of Object.entries(section.colorSources)) {
    assert.match(line, /^\[(measured|sourced|estimated)\]/, `${k}'s tier line has no tier`);
    assert.ok(line.length > 60, `${k}'s tier line says nothing about where it came from`);
    if (/^\[estimated\]/.test(line)) {
      assert.ok(/extends|invented look/i.test(line), `${k} is [estimated] but names no parent pattern`);
    }
  }
  /* TIGHTENED 2026-08-21 (S1(iv)): the other half of this branch — "a tier above
     [estimated] must cite a dated source" — moved to assertTierSymmetry below,
     which runs it in BOTH directions. The one-directional version let any
     [estimated] line that happened to name a year be promoted to [measured] for
     free, which is audit-plaza F3. */
  /* The one hex R1 re-derived must actually have moved, and toward the ortho. */
  assert.equal(section.colors.lawn, "#6f8054", "the lawn hex is the bb1741784h read");
  assert.notEqual(section.colors.lawn, "#61740c", "the retired chartreuse must be gone from the draw");
  const blue = parseInt(section.colors.lawn.slice(5, 7), 16);
  assert.ok(blue > 50, "no real turf has a blue channel of 12; that was the defect");
  assert.match(section.colorSources.lawn, /bb1741784h/);
  /* And the two R1 declined to re-derive must say why, in conflicts. */
  for (const re of [/PAVING FIELD'S HUE/, /WATER COLOUR/]) {
    assert.ok(section.conflicts.some((c) => re.test(c)), `${re} must be a declared conflict`);
  }
});

test("every figure R1 changed is derivable from its own recorded arithmetic", () => {
  const D = section.derivations;
  assert.ok(D.instrument.length > 200, "the instrument must be described before anything is measured from it");
  assert.match(D.instrument, /8 px\/m|0\.125 m\/px/);
  assert.match(D.instrument, /never a shipped colour|never a height/,
    "the instrument's own limits must be stated where it is declared");
  for (const k of ["pavingPitch", "pavingPhase", "pavingCells", "fountainNesting",
    "fountainRotation", "lawnEdging", "northBedOutline", "benchRows", "coralSpread"]) {
    const d = D.figures[k];
    assert.ok(d, `derivations.figures.${k} is missing`);
    assert.match(d, /^\[(measured|derived|survey)/, `${k} has no tier`);
    assert.ok(/\d/.test(d) && d.length > 120, `${k} has no arithmetic, only a claim`);
  }
  /* Spot-check that the arithmetic actually closes. */
  assert.equal(Math.round(((6.6685 + 6.6250) / 2) * 100) / 100, 6.65, "the pitch is the mean of two fits");
  assert.equal(Math.round(((7.9 + 7.3) / 2 + (7.3 + 7.05) / 2) / 2 * 10) / 10,
    section.treeOverrides.coral.spread, "the coral spread is the mean of two mean reads");
  assert.equal(Math.round(((1.3 + 1.56) / 2) * 10) / 10, section.northBed.lamps[0].x);
  assert.equal(Math.round(((21.2 + 21.19) / 2) * 10) / 10, section.northBed.lamps[1].x);
  /* RE-VALUED 2026-08-21 (S1(ii)): the estimates are objects with a value and a
     band now, not prose, so the prose regex moved into assertEstimateBands
     below — which checks the same "says what it extends" property AND that the
     shipped figure lies inside the band the section publishes for it. */
  for (const [k, e] of Object.entries(D.estimates)) {
    if (k === "why") continue;
    assert.ok(e && typeof e === "object",
      `derivations.estimates.${k} is bare prose — S1(ii) requires a machine-readable entry`);
  }
  /* Every read carries a citation and a tolerance. */
  for (const [k, r] of Object.entries(D.reads)) {
    assert.ok(/Tolerance|tolerance|UNCHANGED|within/.test(r), `derivations.reads.${k} declares no tolerance`);
  }
});

test("conflicts are declared, and none of them was quietly averaged away", () => {
  assert.ok(section.conflicts.length >= 6);
  for (const c of section.conflicts) assert.ok(c.length > 200, "a one-line conflict is a shrug");
  /* Each of these is a place R1 could have split a difference and did not. */
  const c = (re) => section.conflicts.find((q) => re.test(q));
  assert.match(c(/PAVING MODULE/).slice(0), /6\.7|22 ft|22 feet/, "the 22 ft hypothesis stays on the record");
  assert.match(c(/UMBRELLA DIAMETER/), /KEPT/, "the umbrella radius was kept, not averaged");
  assert.equal(section.furniture.terraces.umbrella.radius, 1.25, "and it really was kept");
  /* RE-VALUED 2026-08-21, NOT DELETED: R2 arbitration item R2 answered the
     question this gate handed up — the bikes are retired on the same November
     2024 photosphere that retired the racks under them — so the assertion now
     holds the retirement. Deleting it instead would remove the only thing
     standing between this row and a silent resurrection; it is what caught the
     audit's P9 mutation. */
  assert.match(c(/BICYCLES/), /RETIRED 2026-08-21/,
    "the bikes question was ruled on by R2 arbitration and the ruling must be on the record");
  assert.equal(section.furniture.bikes.count, 0, "and the bikes really were retired");
  assert.match(c(/YORK BELT'S SPECIES/), /NOT changed/,
    "the tree roster must not be edited on a building-context frame");
});

test("absent never shrinks, and the two unexhausted ladders were climbed", () => {
  /* REPLACED 2026-08-21 (S1(v)): the list-LENGTH gate that stood here could not
     tell a retirement from a substitution. Every entry is now matched by a
     stable key and held by its own probe in the S1(v) test above; the count
     below is kept only as a floor, and it is no longer what does the work. */
  assert.ok(section.absent.length >= 30, `absent has ${section.absent.length} entries and does not shrink`);
  /* The gaps the survey named must stay named. */
  for (const re of [/palm/i, /salmon/i, /drinking fountain/i, /el mac/i, /erythrina/i]) {
    assert.ok(section.absent.some((a) => re.test(a)), `absent must keep the ${re} entry`);
  }
  /* A1 and A8 were the two ladders the brief required climbing first. */
  const a1 = section.absent.find((a) => /\(A1\)/.test(a));
  assert.ok(a1, "the bench-identity gap must be declared");
  assert.match(a1, /VERIFIED NEGATIVE/, "A1's last unopened rung must be recorded as opened");
  assert.match(a1, /p6-p9/, "the UCOP pages must be named");
  assert.match(a1, /p11/);
  const a8 = section.absent.find((a) => /\(A8\)/.test(a));
  assert.ok(a8, "the four unre-skinned trunks must be declared");
  for (const key of ["(1, 329)", "(32.3, 326.5)", "(50.4, 325.2)", "(64.5, 329)"]) {
    assert.ok(a8.includes(key), `A8 must NAME the key ${key}, not gesture at a group`);
  }
  assert.match(a8, /bb91478709/, "A8's ladder must record the archive frame that was re-checked");
  /* Every named key really is an unre-skinned measured trunk. */
  const skinned = new Set(reskins().map((it) => `${it.x},${it.z}`));
  for (const [x, z] of [[1, 329], [32.3, 326.5], [50.4, 325.2], [64.5, 329]]) {
    assert.ok(lidar.trees.some((t) => t[0] === x && t[1] === z),
      `(${x}, ${z}) is not in the measured tree table`);
    assert.ok(!skinned.has(`${x},${z}`), `(${x}, ${z}) IS re-skinned — the absent entry is stale`);
  }
  /* The vague entry it replaced is retired in place, not deleted. */
  assert.ok(section.absent.some((a) => /SUPERSEDED IN PLACE/.test(a) && /Group E-north/.test(a)));
  /* And the entry R1 corrected keeps the three ring numbers it hands over. */
  const gal = section.absent.find((a) => /Galbraith frontage planting beds/.test(a));
  assert.match(gal, /#1764/);
  assert.match(gal, /#1765/);
  assert.match(gal, /#1766/);
  assert.match(gal, /412\.1-421\.9/, "the corrected z range must be the surveyed one");
});

test("every source is a real citation with a date, not a bare link", () => {
  assert.ok(section.sources.length >= 12);
  for (const src of section.sources) {
    assert.match(src, /^https:\/\//);
    assert.ok(src.length >= 80, `too thin to be a citation: ${src.slice(0, 60)}...`);
    assert.match(src, /\b(19|20)\d{2}\b/, `no 4-digit date: ${src.slice(0, 60)}...`);
  }
  for (const ark of ["bb5393567s", "bb1741784h", "bb91478709", "bb08202844", "bb1639263c"]) {
    assert.ok(section.sources.some((q) => q.includes(ark)), `the cached source ${ark} is not cited`);
  }
});

test("the surveyed rings this section registers are still what it says they are", () => {
  /* THE RENUMBERING GATE. campus-eighth.js addresses arcgis.ground by literal
     index; if that array is ever compacted, every citation here silently
     re-points at another polygon. Check each one's kind and area. */
  const areaOf = (i) => {
    const r = arcRing(i);
    let a2 = 0;
    for (let k = 0, j = r.length - 1; k < r.length; j = k++) a2 += r[j][0] * r[k][1] - r[k][0] * r[j][1];
    return Math.abs(a2 / 2);
  };
  assert.equal(arcgis.ground[2323].k, "green");
  assert.ok(Math.abs(areaOf(2323) - 1498) < 2, "arcgis.ground#2323 is no longer the 1498 m2 lawn");
  assert.equal(arcgis.ground[2377].k, "green");
  assert.ok(Math.abs(areaOf(2377) - 528) < 2, "arcgis.ground#2377 is no longer the 528 m2 north bed");
  assert.equal(arcgis.ground[3770].k, "water");
  for (const b of section.beds.items) {
    const i = Number(b.ring.split("#")[1]);
    assert.equal(arcgis.ground[i].k, "green", `${b.ring} is no longer a green polygon`);
    assert.ok(Math.abs(areaOf(i) - b.area) < 2, `${b.ring} is no longer ${b.area} m2`);
  }
});

/* ----------------------------------------------------------- the axiom layer
 *
 * R2 arbitration item S1, applied to this section 2026-08-21. Everything above
 * gates the FIGURES; nothing gated the layer underneath them — the readings the
 * figures are derived from, the estimates they inherit, and the `draw` blocks
 * that carry numbers straight to the geometry. Move a reading and every figure
 * downstream moves with it, consistently, and passes. All six subtasks use the
 * ONE shared apparatus in tests/helpers/axiom-gate.mjs; none is a local copy.
 *
 * TWO OF THE SIX REACH ALMOST NOTHING HERE, AND THAT IS RECORDED RATHER THAN
 * PAPERED OVER. This section's `derivations.reads` and `derivations.draw` are
 * PROSE STRINGS with no numeric leaves, so S1(i)'s walk over them finds nothing
 * and does its work over `estimates` alone; and its `figures` are prose strings
 * carrying no `expr`, so S1(vi) has nothing to evaluate. The gates below arm
 * themselves the moment either block gains structure.
 */

const D = section.derivations;
const hexDelta = (a, b) => Math.max(...[1, 3, 5].map((i) =>
  Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16))));

test("S1(i) — every number in the axiom layer is banded, pinned or allowed with a reason", () => {
  const found = assertCoverage({
    section,
    roots: { "derivations.reads": {}, "derivations.estimates": {}, "derivations.draw": {} },
    classify: (path) =>
      /\.value$/.test(path) ? "banded in this estimate"
        : /\.band\.[01]$/.test(path) ? "the band's own endpoint"
          : null,
    uncovered: {},
    minimum: 24,
    label: "plaza",
  });
  /* The walk must actually be reaching the estimates: eight numeric estimates,
     each contributing a value and two band endpoints. */
  assert.equal(found.length, 24, `the axiom walk found ${found.length} numbers, expected 24`);
  assert.ok(found.every((f) => f.path.startsWith("derivations.estimates.")),
    "reads and draw are prose in this section; if either grows a number this gate must be widened to cover it");
});

test("S1(ii) — every estimate carries a value inside a band the section publishes", () => {
  const MEASURED_LAMPS = [[21.9, 377.1], [1.4, 342.5], [21.2, 342.5]];
  const shipped = {
    nozzleRadius: () => section.fountain.jet.nozzleRadius,
    nozzleRise: () => section.fountain.jet.nozzleRise,
    nozzleReach: () => section.fountain.jet.nozzleReach,
    streamRadius: () => section.fountain.jet.streamRadius,
    plinthBatter: () => section.fountain.plinthBatter,
    /* A colour extension is checked against its PARENT, because a hex has no
       band: the shipped distance from the parent must stay inside the distance
       the evidence that picked that parent allows. */
    northBedTurfColour: () => hexDelta(section.colors.northBedTurf, section.colors.dg),
    bedMulchColour: () => hexDelta(section.colors.bedMulch, "#876f5d"),
    /* The count of lamp items whose position is a photo read, not a measurement. */
    lampPositions: () => section.furniture.lamp.items.filter((it) =>
      !MEASURED_LAMPS.some(([x, z]) => it.x === x && it.z === z)).length,
  };
  const checked = assertEstimateBands({
    estimates: D.estimates,
    valueAt: (k) => shipped[k](),
    /* benchType estimates an OBJECT'S IDENTITY and not a figure — every number
       those seven objects ship is measured and gated elsewhere — so it has no
       band and says so in `nonNumeric` instead. It is skipped here and held by
       its own assertion below rather than given an invented band. */
    skip: ["benchType"],
    label: "plaza",
  });
  assert.equal(checked, 8, `${checked} estimates were banded, expected 8`);
  const bt = D.estimates.benchType;
  assert.ok(bt.nonNumeric && bt.nonNumeric.length > 120,
    "benchType is skipped by the band gate and must say in the file why no band exists");
  assert.ok(bt.extends && bt.extends.length > 25, "benchType must still name the pattern it extends");
  assert.match(bt.why, /\[estimated\]/);
});

test("S1(iii) — every reading with an external truth is pinned to a literal", () => {
  const T = section.treeOverrides;
  const pinTarget = {
    ...section,
    roster: {
      pines: T.pines.items.length,
      ficus: T.ficus.items.length,
      eucalyptus: T.eucalyptus.items.length,
      skipKeys: T.skipMeasuredKeys.length,
    },
  };
  const ORTHO = "the 2026 Google orthophoto at 8 px/m (docs/data/textures/chunk_4_6.jpg + chunk_4_7.jpg, generated 2026-08-04)";
  const RING2323 = "arcgis.ground#2323, the facilities GIS 1498 m2 lawn polygon, x -0.6..46.9 by z 377.3..409.7";
  const pins = {
    /* the fountain */
    "fountain.cx": { value: 38.6, truth: "the Revelle Plaza Fountain landmark's surveyed OSM point — position from OSM wins over any photo or satellite read" },
    "fountain.cz": { value: 369.8, truth: "the Revelle Plaza Fountain landmark's surveyed OSM point, corroborated to 0.23 m by the ortho plinth-deck centre" },
    "fountain.rot": { value: 0, truth: `${ORTHO}: three independent tests bound the plinth's skew below 0.5 degrees` },
    "fountain.plinth": { value: 7.63, truth: `${ORTHO}: a west edge at x 35.00, east 42.50, north z 365.75, south 373.50 — 7.50 by 7.75 m` },
    "fountain.plinthBase": { value: 7.29, truth: "the measured plinth less twice the estimated batter, 7.63 - 2 x 0.17" },
    "fountain.plinthHeight": { value: 0.48, truth: "UCSD DC bb5393567s, which photographs three adults sitting on the deck with their legs over the outside edge — a seat-height ledge, 0.42-0.50 m" },
    "fountain.basinRadius": { value: 3, tol: 0.05, truth: "arcgis.ground#3770, a 28 m2 water polygon: 2 sqrt(28/pi) = 5.97 m of diameter, and 27.1 m2 read independently off the ortho" },
    "fountain.jet.nozzles": { value: 28, truth: "UCSD DC bb5393567s: 7-8 separable arc strands per visible quadrant, 4 x 7 at the low end" },
    /* the memorial */
    "memorial.cx": { value: 32.5, truth: "today.ucsd.edu memorial1/memorial2.jpg (February 2014), corroborated by the UCSD Emeriti historian's south-east corner and by the ortho's coral canopy centre" },
    "memorial.cz": { value: 379.5, truth: "today.ucsd.edu memorial1/memorial2.jpg (February 2014); 11.46 m from the surveyed fountain centre, which 2014 coverage calls adjacent" },
    "memorial.slabRadius": { value: 3.75, truth: "today.ucsd.edu memorial2.jpg (February 2014) — a 7.5 m half-disc; NOT corroborated from above, the coral canopy occludes it, see absent" },
    /* the lawn's outer edge */
    "lawns.panels.0.x0": { value: -0.6, truth: RING2323 },
    "lawns.panels.0.x1": { value: 46.9, truth: RING2323 },
    "lawns.panels.0.z0": { value: 377.3, truth: RING2323 },
    "lawns.panels.1.x0": { value: -0.6, truth: RING2323 },
    "lawns.panels.1.x1": { value: 46.9, truth: RING2323 },
    "lawns.panels.1.z1": { value: 409.7, truth: RING2323 },
    "lawns.edging.x0": { value: -0.6, truth: RING2323 },
    "lawns.edging.x1": { value: 46.9, truth: RING2323 },
    "lawns.panels.0.z1": { value: 398.36, truth: `${ORTHO}: the 50 per cent green-fraction crossing on the band's north side` },
    "lawns.edging.z0": { value: 398.36, truth: `${ORTHO}: the 50 per cent green-fraction crossing on the band's north side` },
    "lawns.edging.z1": { value: 399.66, truth: `${ORTHO}: the 50 per cent green-fraction crossing on the band's south side` },
    "lawns.panels.1.z0": { value: 399.66, truth: `${ORTHO}: the 50 per cent green-fraction crossing on the band's south side` },
    /* the north bed and its pads */
    "northBed.x0": { value: -12.95, truth: "mean of campus-3d surfaces[90] (-13.2) and arcgis.ground#2377 (-12.7)" },
    "northBed.x1": { value: 25.85, truth: "mean of campus-3d surfaces[90] (25.4) and arcgis.ground#2377 (26.3)" },
    "northBed.z0": { value: 330, truth: "campus-3d surfaces[90] and arcgis.ground#2377 both give 330.0, and the ortho's tan-turf mask fixes the same north edge" },
    "northBed.z1": { value: 343.55, truth: "mean of campus-3d surfaces[90] (343.1) and arcgis.ground#2377 (344.0)" },
    "northBed.lamps.0.x": { value: 1.4, truth: `${ORTHO}: a 1.38 m square pad at x 1.56, meaned with research-plaza.md section 6's 1.3` },
    "northBed.lamps.0.z": { value: 342.5, truth: `${ORTHO}: a 1.38 m square pad at z 342.81, meaned with research-plaza.md section 6's 342.2` },
    "northBed.lamps.1.x": { value: 21.2, truth: `${ORTHO}: a 1.38 m square pad at x 21.19, meaned with research-plaza.md section 6's 21.2` },
    "northBed.lamps.1.z": { value: 342.5, truth: `${ORTHO}: a 1.38 m square pad at z 342.69, meaned with research-plaza.md section 6's 342.2` },
    /* the paving module and the arcs that fan on it */
    "paving.pitch": { value: 6.65, truth: `${ORTHO}: the mean of two least-squares joint fits, 6.6685 in x over 8 joints and 6.6250 in z over 3` },
    "paving.gridOrigin.x": { value: -1.431, truth: `${ORTHO}: the intercept of the x least-squares joint fit, i.e. the first resolved joint` },
    "paving.gridOrigin.z": { value: 350.072, truth: `${ORTHO}: the intercept of the z least-squares joint fit, i.e. the first resolved joint` },
    "arcs.pitch": { value: 6.65, truth: "the paving field's own measured module — the arcs fan on the joints they are struck at" },
    "arcs.band": { value: 0.42, truth: `${ORTHO} at 64 px/m: the joint band measures about 28 px = 0.44 m, inside the instrument's own 0.125 m pixel` },
    "arcs.radius": { value: 1.8, truth: `${ORTHO} at 64 px/m: the struck panel corner measures about 110 px = 1.7 m, inside the instrument's own pixel` },
    /* the ownership lines, which are measured lines and not preferences */
    "dgBelt.x0": { value: 66, truth: "york.westGround.source cedes everything west of x 82 to this section; 66 is where the belt's tan ground starts under the pines" },
    "dgBelt.x1": { value: 82, truth: "york's own mulch beds begin at x 82.1, declared from both sides in york.boundary.dgBelt with a 0.1 m gap" },
    "dgBelt.z1": { value: 428.9, truth: "min z of the Galbraith Hall ring in campus-3d.json, which is also galbraith.east.dg's own z0" },
    "bounds.x0": { value: -19.9, truth: "the west edge of Argo's ring, taken over by R2 arbitration item P5/A6 so the section that owns the objects owns the walk" },
    "bounds.x1": { value: 82, truth: "york's own mulch beds begin at x 82.1; this section owns x 66..82 entire" },
    "bounds.z1": { value: 428.9, truth: "min z of the Galbraith Hall ring in campus-3d.json, where galbraith.east.dg begins" },
    /* the tree roster, whose external truth is the measured LiDAR table */
    "roster.pines": { value: 12, truth: "docs/data/campus-lidar.json — twelve York-belt trunks, every h and r byte-identical to the survey" },
    "roster.ficus": { value: 6, truth: "docs/data/campus-lidar.json — six plaza-core multi-stem trunks, copied verbatim" },
    "roster.eucalyptus": { value: 21, truth: "docs/data/campus-lidar.json — twenty-one trunks east of York and on the Keeling west road, copied verbatim" },
    "roster.skipKeys": { value: 39, truth: "docs/data/campus-lidar.json — the skip list main uses pairs 1:1 with the 39 re-skinned trunks in both directions" },
  };
  /* The escape hatch, and every entry says what it is instead of being pinned.
     A number here is NOT unchecked — it is checked somewhere the pin cannot
     reach — and none of them is a bare exemption. */
  const uncovered = {
    "fountain.basinDepth": "how far the coping wall is recessed below the plinth deck. No instrument in this section reaches it: the ortho is a plan instrument and bb5393567s has no scale at the basin's depth.",
    "fountain.plinthBatter": "banded in derivations.estimates.plinthBatter and gated arithmetically against plinthBase (plinth - 2 x batter) in the fountain test above.",
    "fountain.jet.nozzleRadius": "banded in derivations.estimates.nozzleRadius, between the retired skirt's 2.6 m and the measured 3.00 m coping.",
    "fountain.jet.nozzleRise": "banded in derivations.estimates.nozzleRise; a carry from the retired skirt's own height, not a measurement.",
    "fountain.jet.nozzleReach": "banded in derivations.estimates.nozzleReach, between the two figures the retired skirt's envelope carried.",
    "fountain.jet.streamRadius": "banded in derivations.estimates.streamRadius; an invented look figure, labelled as one, and nothing measures it.",
    "fountain.jet.coreHeight": "the central plume, carried UNCHANGED through R1 and corroborated only in colour by UCSD DC bb1741784h, which shows the fountain running. Declared in fountain.jetNote.",
    "fountain.jet.coreRadius": "the central plume's radius, carried UNCHANGED through R1 with coreHeight and corroborated only in colour. Declared in fountain.jetNote.",
    "memorial.rot": "the slab's bearing. The 7.4 m coral canopy occludes a 7.5 m half-disc completely from above, so the ortho confirms the tree and says nothing about the slab; see absent.",
    "memorial.trimWidth": "the brick soldier trim on the slab's straight edge, read as a band in memorial2.jpg (February 2014) and not scaled — the slab's own geometry is uncorroborated, see absent.",
    "memorial.lensRadius": "one flush light lens, below the resolution of both 2014 frames; the star layout it belongs to is labelled [estimated] in memorial.lensNote.",
    "memorial.node.0": "the star figure's off-centre node, part of the [estimated] lens layout declared in memorial.lensNote and gated for lying on the slab.",
    "memorial.node.1": "the star figure's off-centre node, part of the [estimated] lens layout declared in memorial.lensNote and gated for lying on the slab.",
    "memorial.bench.radius": "the curved bench's plan radius, read off memorial1.jpg (February 2014) as a curve and not scaled against anything in frame.",
    "memorial.bench.spanCentre": "the bench arc's bearing about the slab, read off the same 2014 frame; the slab's own geometry is uncorroborated and declared in absent.",
    "memorial.bench.arcLength": "the bench's arc length, read off memorial1.jpg (February 2014); gated for lying in 3.5-4.0 m in the memorial test above.",
    "memorial.bench.seatHeight": "a seat, at the height a seat is; nothing in either 2014 frame scales it.",
    "memorial.bench.slab": "the bench seat slab's thickness, below the resolution of both 2014 frames.",
    "memorial.bench.depth": "the bench seat's depth, below the resolution of both 2014 frames.",
    "memorial.bench.baseHeight": "the lava-rock rubble base's height, read as a proportion of the bench in memorial1.jpg and not scaled.",
    "memorial.bench.baseDepth": "the lava-rock rubble base's depth, read as a proportion of the bench in memorial1.jpg and not scaled.",
    "memorial.bench.segments": "a drawing subdivision, not a measurement: how many straight segments approximate the arc. Gated against counts.memorialBenchSegments.",
    "arcs.wedgesPerCorner": "a drawing device, not a measurement: the ortho resolves THAT the coursing fans at a struck corner, not how many bricks do it. Gated downstream, 31 x 4 x 8 = 992 wedges.",
    "arcs.wedgeSize.0": "one fan wedge's plan size, part of the same drawing device as wedgesPerCorner; the instrument cannot resolve a single brick at 0.125 m/px.",
    "arcs.wedgeSize.1": "one fan wedge's plan size, part of the same drawing device as wedgesPerCorner; the instrument cannot resolve a single brick at 0.125 m/px.",
    "dgBelt.z0": "the belt's north end. Its extent is tagged [estimated] in dgBelt.tag because the Torrey pine canopy occludes this ground completely from above; only the south edge is measured. Declared in absent.",
    "bounds.z0": "a declared ownership line, not a measurement: north of z 326 is arcgis.ground#1174's apron and then the science spine, which is R4's. Stated in boundsNote.",
    "lawns.crossWalk.x0": "the RETIRED cross-walk's own numbers, kept verbatim so superseded.crossWalk can be checked against what it replaced. Nothing draws them.",
    "lawns.crossWalk.x1": "the RETIRED cross-walk's own numbers, kept verbatim so superseded.crossWalk can be checked against what it replaced. Nothing draws them.",
    "lawns.crossWalk.z0": "the RETIRED cross-walk's own numbers, kept verbatim so superseded.crossWalk can be checked against what it replaced. Nothing draws them.",
    "lawns.crossWalk.z1": "the RETIRED cross-walk's own numbers, kept verbatim so superseded.crossWalk can be checked against what it replaced. Nothing draws them.",
  };
  /* The star figure's fifteen lens coordinates are ONE [estimated] decision, not
     thirty independent readings: memorial.lensNote labels the layout, the exact
     chart is not resolvable in either 2014 frame, and the memorial test above
     gates every lens for lying on the half-disc slab. They are allowed here
     under that one reason rather than pinned to an artefact that cannot see
     them. */
  section.memorial.lenses.forEach((_, i) => {
    for (const j of [0, 1]) {
      uncovered[`memorial.lenses.${i}.${j}`] =
        "one coordinate of the [estimated] star figure declared in memorial.lensNote — memorial1.jpg (February 2014) shows ~15 lenses radiating from an off-centre node but resolves no chart; every lens is gated for lying on the slab.";
    }
  });
  for (const [k, reason] of Object.entries(uncovered)) {
    assert.ok(reason.length > 40, `plaza: ${k} is unpinned with no real reason`);
  }
  const pinned = assertPins({
    readings: pinTarget,
    pins,
    /* EXHAUSTIVE over these blocks: a new number cannot join one of them
       without being pinned to its artefact or listed above with a reason. */
    namespaces: ["fountain", "memorial", "lawns", "northBed", "arcs", "dgBelt", "bounds",
      "paving.gridOrigin", "roster"],
    uncovered,
    label: "plaza",
  });
  assert.ok(pinned >= 45, `only ${pinned} readings pinned`);
});

test("S1(iii) — the relations this section states in prose are asserted", () => {
  const F = section.fountain;
  const L = section.lawns;
  const relations = [
    { name: "the paving module is the mean of its two least-squares joint fits",
      got: Math.round(((6.6685 + 6.625) / 2) * 100) / 100, want: section.paving.pitch },
    { name: "the plinth is the mean of its two measured edges",
      got: Math.round(((7.5 + 7.75) / 2) * 100) / 100, want: F.plinth },
    { name: "plinthBase is plinth less twice the batter, or the batter is decorative",
      got: Math.round((F.plinth - 2 * F.plinthBatter) * 100) / 100, want: F.plinthBase },
    { name: "the batter is the 19.5 degree rake the photograph reads",
      got: (Math.atan(F.plinthBatter / F.plinthHeight) * 180) / Math.PI, want: 19.5, tol: 0.1 },
    { name: "arcgis.ground#3770's 28 m2 gives the 5.97 m coping diameter the record claims",
      got: 2 * Math.sqrt(28 / Math.PI), want: 5.97, tol: 0.005 },
    { name: "campus-3d surfaces[34]'s 22 m2 gives the 5.29 m water surface the record claims",
      got: 2 * Math.sqrt(22 / Math.PI), want: 5.29, tol: 0.005 },
    { name: "the ortho's plinth-deck centre is the 0.23 m corroboration of the OSM fountain point",
      got: Math.hypot((35.0 + 42.5) / 2 - F.cx, (365.75 + 373.5) / 2 - F.cz), want: 0.23, tol: 0.005 },
    { name: "the memorial is the 11.46 m from the fountain that 2014 coverage calls adjacent",
      got: Math.hypot(F.cx - section.memorial.cx, F.cz - section.memorial.cz), want: 11.46, tol: 0.005 },
    { name: "the ortho's second coral-canopy centre is 1.70 m from the shipped memorial",
      got: Math.hypot(32.5 - section.memorial.cx, 377.8 - section.memorial.cz), want: 1.7, tol: 0.005 },
    { name: "the edging band is the 1.30 m the green-fraction crossings measure",
      got: L.edging.z1 - L.edging.z0, want: 1.3, tol: 0.005 },
    { name: "the two panels and the band tile the ring's z span with neither gap nor overlap",
      got: (L.panels[0].z1 - L.panels[0].z0) + (L.edging.z1 - L.edging.z0) + (L.panels[1].z1 - L.panels[1].z0),
      want: L.panels[1].z1 - L.panels[0].z0, tol: 1e-9 },
    { name: "the shipped lawn plus the band is the 1539 m2 the record derives",
      got: Math.round(47.5 * 31.1) + 62, want: 1539, tol: 0.5 },
    { name: "every crossing carries four struck corners of wedgesPerCorner wedges",
      got: section.counts.brickArcCrossings * 4 * section.arcs.wedgesPerCorner,
      want: section.counts.brickArcWedges },
    { name: "a full 9 x 5 deck less the cell that lies in bed #2160 is 44 cells",
      got: 9 * 5 - 1, want: section.counts.pavingCells },
    { name: "a full 8 x 4 crossing grid less the one that cell removes is 31",
      got: 8 * 4 - 1, want: section.counts.brickArcCrossings },
    { name: "the coral spread is the mean of two mean reads of the same frame",
      got: Math.round((((7.9 + 7.3) / 2 + (7.3 + 7.05) / 2) / 2) * 10) / 10,
      want: section.treeOverrides.coral.spread },
    { name: "the seven measured bench objects are five drawn and two held",
      got: section.counts.benches + section.counts.benchesHeld,
      want: section.furniture.benches.items.length },
  ];
  assert.equal(assertRelations({ relations, label: "plaza" }), relations.length);
});

test("S1(iv) — the tier gate runs in both directions, so a tier cannot be inflated", () => {
  const entries = [
    ...Object.entries(section.colorSources).map(([key, text]) => ({ key: `colorSources.${key}`, text })),
    ...Object.entries(D.estimates)
      .filter(([key]) => key !== "why")
      .map(([key, e]) => ({ key: `estimates.${key}`, text: e.why })),
  ];
  const walked = assertTierSymmetry({ entries, label: "plaza" });
  assert.equal(walked, Object.keys(section.colorSources).length + Object.keys(D.estimates).length - 1);

  /* THE ACCEPTANCE TEST — audit-plaza F3's promotion path. Mutation P7 flipped
     colorSources.brickRunner from [estimated] to [measured] and the old suite
     passed, because the line names a year (Revelle_Plaza.jpg, 2006) and the
     year branch stopped checking whether it extends anything. It must now fail
     on the word `extends`, whatever the line calls itself. */
  const promoted = section.colorSources.brickRunner.replace("[estimated]", "[measured]");
  assert.match(promoted, /\b(19|20)\d{2}\b/, "the acceptance test is only meaningful if the line names a year");
  assert.throws(
    () => assertTierSymmetry({ entries: [{ key: "colorSources.brickRunner", text: promoted }], label: "plaza" }),
    /hedges/,
    "an [estimated] line that cites the parent it extends must not be promotable to [measured]");
  /* And the direction R1 already had must still hold. */
  assert.throws(
    () => assertTierSymmetry({
      entries: [{ key: "colorSources.lawn", text: "[measured] a mid sage green, no frame recorded" }],
      label: "plaza",
    }),
    /names no artefact/);
});

test("S1(v) — every absent entry is held by its own probe, not by the list's length", () => {
  /* REPLACES the `absent.length >= 30` gate below, which could not tell a
     retirement from a substitution: any entry could be swapped for any other
     and the count would not move. Each entry is now matched by a stable key and
     probed for the thing it withholds. */
  const ABSENT = [
    ["palms", /^Palms —/, /twelve taxa/],
    ["jacarandas", /^Jacarandas/, /no evidence inside Zone 1/],
    ["salmon-lawn-tree", /salmon\/copper lawn tree/, /Koelreuteria/],
    ["coral-species", /Erythrina species/, /three candidates/],
    ["drinking-fountains", /^Drinking fountains/, /bollard/],
    ["marble-plaque", /marble plaque/, /unresolved/],
    ["inscription-lettering", /chiselled inscription/, /below geometry resolution/],
    ["el-mac-mural", /El Mac/, /Not invented/],
    ["nw-terrace-steps", /north-west terrace steps/, /riser\/tread/],
    ["curbs-and-ramps", /^Curbs and ramps/, /not resolved/],
    ["flagpole-ownership", /^The flagpole — built and kept/, /campus-landmarks/],
    ["blade-sign", /wayfinding blade sign/, /0\.35 x 0\.9/],
    ["information-panels", /information-panel types/, /plan positions unresolved/],
    ["bulletin-kiosk", /bulletin kiosk/, /Left unbuilt/],
    ["galbraith-frontage-beds", /Galbraith frontage planting beds/, /#1766/],
    ["group-e-north-superseded", /^SUPERSEDED IN PLACE/, /Group E-north/],
    ["bench-type-b-mayer", /Bench type B/, /Mayer/],
    ["lamppost-section", /Lamppost section round vs square/, /built square 0\.12/],
    ["A1-bench-identity", /\(A1\)/, /VERIFIED NEGATIVE/],
    ["A2-paving-colours", /\(A2\)/, /not cached in this repo/],
    ["A3-north-bed-planting", /\(A3\)/, /20-30 low shrubs/],
    ["north-bed-true-colour", /north bed's TRUE SURFACE COLOUR/, /\[estimated\] extension/],
    ["north-bed-kerb", /north bed's KERB/, /HEIGHT is not resolvable/],
    ["lawn-flanking-walks", /lawn-flanking WALKS/, /1\.78 m across the surveyed lawn/],
    ["A4-paved-court", /\(A4\)/, /5\.4-6\.1 m/],
    ["A5-white-pavilion", /white flat-roofed pavilion/, /Better absent than a guessed box/],
    ["A8-unreskinned-trunks", /\(A8\)/, /bb91478709/],
    ["A7-crown-clamped-trees", /\(A7\)/, /LiDAR clamp and a FLOOR/],
    ["A9-plinth-batter-and-height", /\(A9\)/, /bb5393567s/],
    ["A10-nozzle-count", /\(A10\)/, /7-8 per visible quadrant/],
    ["flanking-bed-shrubs", /flanking beds' SHRUBS/, /#2151/],
    ["lamp-positions", /^Five of the six lawn-edge lamp POSITIONS/, /\[estimated\]/],
    /* absent[32], the corridor hold — the entry R2 item R3 rewrote. Its probe is
       the PLAN INTERSECTION, because that is the fact the record used to
       understate as "0.48 m of clearance". */
    ["corridor-held-benches", /HELD OUT OF THE DRAW/, /vertex \(10\.0, 374\.9\) lies INSIDE/],
    ["dg-belt-surface", /DG belt's SURFACE/, /#5c5b4f/],
    ["flagpole-height", /flagpole is 18-22 m/, /9\.6 m and is WRONG/],
    /* The two grounds R2 item P5 assigned to this section on 2026-08-21. */
    ["R2-east-belt", /EAST BELT \(R2 P5\/A5/, /x 52\.\.66 over z 343\.\.428\.9/],
    ["R2-west-walk", /WEST WALK \(R2 P5\/A6\)/, /x -19\.9\.\.-16/],
  ];
  const keyed = section.absent.map((text) => {
    const hits = ABSENT.filter(([, sig]) => sig.test(text));
    assert.equal(hits.length, 1,
      `absent entry matched ${hits.length} signatures, not one: ${text.slice(0, 80)}`);
    return { key: hits[0][0], what: text };
  });
  assert.equal(new Set(keyed.map((e) => e.key)).size, keyed.length, "two absent entries share one key");
  const held = assertAbsentEntries({
    absent: keyed,
    expected: Object.fromEntries(ABSENT.map(([k, , probe]) => [k, probe])),
    built: {},
    elsewhere: new Set(),
    label: "plaza",
  });
  assert.equal(held, ABSENT.length, `${held} absent entries held, expected ${ABSENT.length}`);
});

test("S1(vi) — this section's figures are prose, so there is no expr to evaluate", () => {
  /* RECORDED, NOT PAPERED OVER. S1(vi) requires every `figures[*].expr` to be
     evaluated against the readings and to reproduce its own value. This section
     carries no expr at all: `derivations.figures` is a table of prose strings,
     each with its arithmetic written out and spot-checked above, and
     `derivations.reads` is prose too. So (vi) is a NO-OP here, which is a real
     gap in the batch and is reported as one — not a pass earned by having the
     field. The gate arms itself the moment a figure gains structure: an object
     figure must then carry an evaluable expr and reproduce its own value. */
  const structured = Object.fromEntries(
    Object.entries(D.figures).filter(([, v]) => v && typeof v === "object"));
  if (Object.keys(structured).length) {
    assertExprs({ figures: structured, scope: { ...section, reads: D.reads }, label: "plaza" });
  } else {
    for (const [k, v] of Object.entries(D.figures)) {
      assert.equal(typeof v, "string", `derivations.figures.${k} is neither prose nor an evaluable expr`);
    }
    assert.ok(Object.values(D.reads).every((r) => typeof r === "string"),
      "derivations.reads has grown a numeric leaf — S1(i)'s walk and S1(vi) must both be widened to cover it");
  }
});

test("S2 — every retirement declares its disposition, and every transfer has a reciprocal", () => {
  /* R2 arbitration item S2. `sup` meant two different things — a transfer to a
     named successor and a deletion on evidence — and only the prose could tell
     them apart, so a machine-readable field said the opposite of what happened
     for 13 of 56 retirements. Nothing could detect a declared successor that had
     stopped shipping the object (audit-plaza F4). This section is on the
     RECEIVING side of twelve of them, so its share is the reciprocal claim, in
     the shape blake.superseded['revelle.lavaWalls#30-44'] set. */
  const S = section.superseded;
  const own = Object.entries(S).filter(([, r]) => r.disposition === "deleted-on-evidence");
  assert.equal(own.length, 3, "crossWalk, absent[2] and furniture.bikes are this section's own retirements");
  assertDispositions({
    items: own.map(([key, r]) => ({ key, disposition: r.disposition, sup: [], detail: r.why })),
    label: "plaza",
  });

  const revelle = photoDoc.revelle;
  const toPlaza = {};
  for (const [block, node] of Object.entries(revelle)) {
    if (!node || typeof node !== "object" || !Array.isArray(node.items)) continue;
    node.items.forEach((it, i) => {
      if (it && it.sup && [].concat(it.sup).includes("plaza")) (toPlaza[block] ||= []).push(i);
    });
  }
  assert.deepEqual(toPlaza, { benchesA: [20, 21, 22, 23, 24, 25, 26], lamps: [0, 1, 2, 3, 5] },
    "the twelve revelle items flagged sup: 'plaza' are not the ones this section claims");

  const claims = {
    "revelle.benchesA#20-26": section.furniture.benches.items.length === 7,
    "revelle.lamps#0-3,5":
      [345, 370, 395, 420].every((z) =>
        section.furniture.lamp.items.some((it) => it.x === 79 && it.z === z)) &&
      section.furniture.lamp.items.some((it) => it.x === -6 && it.z === 368),
  };
  const reciprocals = {};
  const items = [];
  for (const key of Object.keys(claims)) {
    const rec = S[key];
    assert.ok(rec, `plaza does not carry a reciprocal claim for ${key} — a sup flag alone is not one`);
    assert.equal(rec.disposition, "transferred");
    assert.ok(rec.ships === true, `${key}'s reciprocal claims nothing`);
    assert.ok(rec.countChange === true && typeof rec.count === "number",
      `${key} transferred with a count change and the reduction is only in prose`);
    /* The reciprocal may only claim `ships` if this section really does ship it. */
    assert.ok(claims[key], `plaza claims ${key} and ships nothing for it`);
    reciprocals[`plaza:${key}`] = { ships: rec.ships && claims[key], countChange: rec.countChange, count: rec.count };
    items.push({ key, disposition: "transferred", sup: "plaza", detail: rec.why });
  }
  assert.equal(assertDispositions({ items, reciprocals, label: "revelle -> plaza" }), 2);

  /* The count changes are declared in numbers, and the numbers are the shipped
     ones: seven bench objects carried (five drawn, two held for the corridor)
     and four belt poles added, the fifth revelle post absorbed into an existing
     one 5.00 m away on the same west walk. */
  assert.equal(S["revelle.benchesA#20-26"].count, section.furniture.benches.items.length);
  assert.equal(S["revelle.lamps#0-3,5"].count, 4);
  assert.equal(section.counts.superseded, Object.keys(S).length);
});

/* ------------------------------------------------------- headless builds */

const photoFor = () => ({ plaza: section });

test("the module builds headless and matches every count the section declares", () => {
  const ground = () => 0;
  const { group, counts } = createPhotoPlaza(null, { photo: photoFor(), surfaceAt: ground });
  assert.ok(group.children.length > 10, "the group is nearly empty");
  for (const [k, want] of Object.entries(section.counts)) {
    if (k === "note") continue;
    assert.equal(counts[k], want, `counts.${k}: the section declares ${want}, the build made ${counts[k]}`);
  }
  assert.equal(counts.pines, 12);
  assert.equal(counts.coral, 1);
  assert.equal(counts.pavingCells, 44);
  assert.equal(counts.brickArcCrossings, 31,
    "a full 9 x 5 deck gives 8 x 4 = 32; the cell that lies in bed #2160 removes one");
  assert.ok(counts.foliageLobes > 250, `only ${counts.foliageLobes} canopy lobes across 41 trees`);
  assert.equal(counts.foliageCards, 0, "no canopy may be a flat card");
  assert.equal(counts.draws, group.children.length);
  /* Banners only where the section flags them. */
  assert.equal(counts.banners, section.furniture.lamp.items.filter((it) => it.banner).length * 2);
  assert.ok(counts.lamps > counts.banners / 2, "the two north-bed posts must be unbannered");
});

test("the module reads its own section and nothing else", () => {
  /* A module that reaches into another section cannot be audited alone, and
     that cross-read is what made the plaza's ground unauditable before R1. */
  const built = createPhotoPlaza(null, { photo: photoFor(), surfaceAt: () => 0 });
  const withOthers = createPhotoPlaza(null, {
    photo: { plaza: section, revelle: photoDoc.revelle, york: photoDoc.york },
    surfaceAt: () => 0,
  });
  assert.deepEqual(built.counts, withOthers.counts,
    "handing the module other sections changed what it built");
});

test("a missing section is a quiet no-op", () => {
  const { group, counts } = createPhotoPlaza(null, { photo: {}, surfaceAt: () => 0 });
  assert.equal(group.children.length, 0);
  assert.deepEqual(counts, {});
});

test("everything the module places rides surfaceAt", () => {
  /* Build on two flat grounds 7 m apart: every instance and every placed
     mesh must move up by exactly 7 — anything that does not is either
     floating on a constant or buried under the drawn terrain. */
  const a = createPhotoPlaza(null, { photo: photoFor(), surfaceAt: () => 0 }).group;
  const b = createPhotoPlaza(null, { photo: photoFor(), surfaceAt: () => 7 }).group;
  assert.equal(a.children.length, b.children.length);
  for (let i = 0; i < a.children.length; i++) {
    const ma = a.children[i];
    const mb = b.children[i];
    if (ma.isInstancedMesh) {
      for (let k = 0; k < ma.count; k++) {
        const ya = ma.instanceMatrix.array[k * 16 + 13];
        const yb = mb.instanceMatrix.array[k * 16 + 13];
        assert.ok(Math.abs(yb - ya - 7) < 1e-4,
          `${ma.name || "instanced child " + i} instance ${k} does not ride the ground (${ya} -> ${yb})`);
      }
    } else {
      assert.ok(Math.abs(mb.position.y - ma.position.y - 7) < 1e-4,
        `child ${i} (${ma.name || ma.type}) does not ride the ground`);
    }
  }
});

test("the big ground sheets conform to sloped terrain, not one centre sample", () => {
  /* The flat-ground ride test above cannot see this failure mode: a single
     quad at one centre sample rides a constant ground perfectly, yet under
     the real LiDAR relief (4.07 m across the DG belt) it buries at one end
     and floats at the other. Build on a sloped plane and demand every
     vertex of every large sheet sits its overlay lift above the ground. */
  const slope = (x, z) => 0.03 * x + 0.02 * z;
  const { group } = createPhotoPlaza(null, { photo: photoFor(), surfaceAt: slope });
  const sheets = ["dg-belt", "lawn-edging", "lawn-panel-0", "lawn-panel-1", "north-bed"];
  for (let i = 0; i < section.beds.items.length; i++) sheets.push(`bed-${i}`);
  for (const name of sheets) {
    const mesh = group.getObjectByName(name);
    assert.ok(mesh, `${name} not found in the group`);
    const pos = mesh.geometry.attributes.position;
    assert.ok(pos.count > 4, `${name} is a single flat quad and cannot follow relief`);
    for (let i = 0; i < pos.count; i++) {
      const off =
        mesh.position.y + pos.getY(i) -
        slope(mesh.position.x + pos.getX(i), mesh.position.z + pos.getZ(i));
      assert.ok(off > 0.04 && off < 0.25,
        `${name} vertex ${i} is ${off.toFixed(3)} m off the drawn ground (buried or floating)`);
    }
  }
});

test("two builds are identical — the plaza is deterministic", () => {
  const a = createPhotoPlaza(null, { photo: photoFor(), surfaceAt: () => 2 }).group;
  const b = createPhotoPlaza(null, { photo: photoFor(), surfaceAt: () => 2 }).group;
  assert.equal(a.children.length, b.children.length);
  for (let i = 0; i < a.children.length; i++) {
    const ma = a.children[i];
    const mb = b.children[i];
    if (!ma.isInstancedMesh) continue;
    assert.equal(ma.count, mb.count, `child ${i} instance count changed between builds`);
    assert.deepEqual(Array.from(ma.instanceMatrix.array), Array.from(mb.instanceMatrix.array),
      `child ${i} placed its instances differently on a rebuild`);
  }
});

test("tree canopies stay on their measured trunks", () => {
  /* Every pine trunk instance must stand at exactly its LiDAR (x, z), at
     half its bole height — the re-skin never moves the measured tree. */
  const { group } = createPhotoPlaza(null, { photo: photoFor(), surfaceAt: () => 0 });
  const pineTrunks = group.getObjectByName("pine-trunks");
  assert.ok(pineTrunks?.isInstancedMesh && pineTrunks.count === 12, "no 12-instance pine trunk mesh found");
  const P = section.treeOverrides.pines;
  for (let k = 0; k < 12; k++) {
    const e = pineTrunks.instanceMatrix.array;
    const [x, y, z] = [e[k * 16 + 12], e[k * 16 + 13], e[k * 16 + 14]];
    const it = P.items[k];
    /* instanceMatrix stores Float32 — compare at that precision. */
    assert.ok(Math.abs(x - it.x) < 1e-3 && Math.abs(z - it.z) < 1e-3,
      `pine ${k} moved off its measured trunk`);
    assert.ok(Math.abs(y - (it.h * P.boleFrac) / 2) < 1e-3, `pine ${k} bole is not seated`);
  }
});

/* --------------------------------------------------- the canopies are solid
 *
 * The gates above all passed on a canopy built from crossed alpha-cutout
 * cards, which on screen was a bare pole holding a few moth-eaten sheets:
 * invisible edge-on, absent from above. Counting instances cannot see that.
 * These four gates check the SHAPE instead — that every canopy is a set of
 * three-dimensional lobes, that the lobes actually fill the measured crown,
 * that they surround the trunk so the tree has a silhouette from any bearing,
 * and that no structural limb ends in open air.
 */

const CANOPIES = ["canopy-pine-sun", "canopy-pine-shade", "canopy-eucalyptus", "canopy-ficus", "canopy-coral"];

/** Every canopy instance as {x, y, z, sx, sy, sz}, decomposed from the matrix. */
function lobesOf(group) {
  const out = [];
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  for (const name of CANOPIES) {
    const mesh = group.getObjectByName(name);
    assert.ok(mesh?.isInstancedMesh, `${name} is missing — a species lost its canopy`);
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, m);
      m.decompose(p, q, s);
      out.push({ x: p.x, y: p.y, z: p.z, sx: s.x, sy: s.y, sz: s.z, name });
    }
  }
  return out;
}

test("no canopy is a flat card — every lobe is a three-dimensional volume", () => {
  const { group } = createPhotoPlaza(null, { photo: photoFor(), surfaceAt: () => 0 });
  for (const name of CANOPIES) {
    const mesh = group.getObjectByName(name);
    /* A PlaneGeometry has no depth attribute to check, so check the source:
       the canopy geometry must be closed, and closed means its own bounding
       box has extent on all three axes before any instance scale. */
    mesh.geometry.computeBoundingBox();
    const b = mesh.geometry.boundingBox;
    for (const [axis, e] of [["x", b.max.x - b.min.x], ["y", b.max.y - b.min.y], ["z", b.max.z - b.min.z]]) {
      assert.ok(e > 0.5, `${name} geometry is flat in ${axis} (${e.toFixed(3)}) — that is a card, not a canopy`);
    }
  }
  for (const l of lobesOf(group)) {
    const min = Math.min(l.sx, l.sy, l.sz);
    const max = Math.max(l.sx, l.sy, l.sz);
    assert.ok(min > 0.25, `a ${l.name} lobe is scaled to ${min.toFixed(3)} on an axis — squashed to a sheet`);
    assert.ok(max / min < 4, `a ${l.name} lobe has aspect ${(max / min).toFixed(1)} — that reads as a plane`);
  }
});

test("every canopy fills its measured crown from every bearing", () => {
  /* For each measured tree: gather the lobes over it, and demand they (a) are
     numerous enough to overlap into a mass, (b) reach out toward the surveyed
     crown radius rather than huddling on the trunk, and (c) occupy at least
     six of the eight compass sectors, so the tree still has a silhouette when
     you walk round it. A ring of cards fails (c) hard. */
  const { group } = createPhotoPlaza(null, { photo: photoFor(), surfaceAt: () => 0 });
  const lobes = lobesOf(group);
  const T = section.treeOverrides;
  const trees = [
    ...T.pines.items.map((t) => ({ ...t, kind: "pine", crown: t.r })),
    ...T.eucalyptus.items.map((t) => ({ ...t, kind: "eucalyptus", crown: t.r })),
    ...T.ficus.items.map((t) => ({ ...t, kind: "ficus", crown: t.r })),
    { ...T.coral, kind: "coral", crown: T.coral.spread / 2 },
  ];
  /* Eucalyptus is airy by species and its clumps are small — the survey's
     crown radius is the outer limit, not a shell it has to reach. */
  const minLobes = { pine: 9, eucalyptus: 5, ficus: 12, coral: 6 };
  const minSectors = { pine: 6, eucalyptus: 4, ficus: 6, coral: 5 };
  for (const t of trees) {
    const mine = lobes.filter((l) =>
      Math.hypot(l.x - t.x, l.z - t.z) <= t.crown * 1.35 && l.y > t.h * 0.35 && l.y < t.h * 1.15);
    assert.ok(mine.length >= minLobes[t.kind],
      `${t.kind} at (${t.x}, ${t.z}) has ${mine.length} lobes over it — too few to read as a mass`);
    const reach = Math.max(...mine.map((l) => Math.hypot(l.x - t.x, l.z - t.z) + Math.max(l.sx, l.sz)));
    assert.ok(reach >= t.crown * 0.6,
      `${t.kind} at (${t.x}, ${t.z}) reaches only ${reach.toFixed(1)} m of its ${t.crown} m crown`);
    const sectors = new Set(mine
      .filter((l) => Math.hypot(l.x - t.x, l.z - t.z) > t.crown * 0.15)
      .map((l) => Math.floor(((Math.atan2(l.x - t.x, l.z - t.z) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4))));
    assert.ok(sectors.size >= minSectors[t.kind],
      `${t.kind} at (${t.x}, ${t.z}) occupies only ${sectors.size}/8 bearings — it disappears from some angles`);
  }
});

test("no structural limb ends in open air", () => {
  /* The old canopy hung cards off limb tips; when a card turned edge-on the
     limb was a bare stick. Every limb tip must now land inside a lobe. */
  const { group } = createPhotoPlaza(null, { photo: photoFor(), surfaceAt: () => 0 });
  const lobes = lobesOf(group);
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const tip = new THREE.Vector3();
  for (const name of ["pine-limbs", "euc-limbs"]) {
    const mesh = group.getObjectByName(name);
    assert.ok(mesh?.isInstancedMesh, `${name} is missing`);
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, m);
      m.decompose(p, q, s);
      tip.set(0, s.y / 2, 0).applyQuaternion(q).add(p);
      const inside = lobes.some((l) =>
        (tip.x - l.x) ** 2 / l.sx ** 2 + (tip.y - l.y) ** 2 / l.sy ** 2 + (tip.z - l.z) ** 2 / l.sz ** 2 <= 1);
      assert.ok(inside, `${name} instance ${i} ends at (${tip.x.toFixed(1)}, ${tip.y.toFixed(1)}, ${tip.z.toFixed(1)}), outside every lobe`);
    }
  }
});

test("no structural member ends in open air, in ANY species", () => {
  /* The file's own canopy contract, stated at the top of its tree section:
     "The structural limbs still exist, but every one of them ENDS INSIDE a
     lobe." The existing gate above checks that for pine-limbs and euc-limbs
     only, and two species were quietly breaking it in a way no count could
     see. FICUS: the stems were raised blind to h * 0.5 while the dome hung at
     h * 0.7 with its depth capped by the CROWN RADIUS, so on a slender tree
     the two never met — at (4, 418.9), h 13.6 against r 4.9, the lowest lobe's
     underside sat 0.63 m above the highest stem tip and the canopy floated
     free; at (43.4, 416.2) the gap was 0.33 m and the tree read bare at
     distance. The four squat ficus hid it. CORAL: every limb sprang from the
     trunk AXIS while each leaning stem ended 0.8-1.4 m out to the side, so the
     three base stems dangled.

     This gate is species-agnostic and structural: a member is honest if its
     tip is inside a canopy lobe, or if it is CONTINUED — some other member
     that rises higher passes within a shaft's width of that tip. A trunk
     carrying limbs is continued; a stem-fan under a floating dome is not. It
     is checked on the real drawn relief as well as on flat ground, because a
     slope moves lobes and members by different amounts. */
  const segDist = (v, a, b) => {
    const ab = b.clone().sub(a);
    const av = v.clone().sub(a);
    const t = Math.max(0, Math.min(1, av.dot(ab) / (ab.lengthSq() || 1e-9)));
    return av.distanceTo(ab.multiplyScalar(t));
  };
  const SPECIES = [
    ["pine", ["pine-trunks", "pine-limbs"], ["canopy-pine-sun", "canopy-pine-shade"]],
    ["eucalyptus", ["euc-trunks", "euc-limbs"], ["canopy-eucalyptus"]],
    ["ficus", ["ficus-stems"], ["canopy-ficus"]],
    ["coral", ["coral-stems"], ["canopy-coral"]],
  ];
  for (const ground of [() => 0, (x, z) => 0.05 * x - 0.03 * z]) {
    const { group } = createPhotoPlaza(null, { photo: photoFor(), surfaceAt: ground });
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const members = (names) => {
      const out = [];
      for (const n of names) {
        const mesh = group.getObjectByName(n);
        assert.ok(mesh?.isInstancedMesh, `${n} is missing — a species lost its structure`);
        const shaft = mesh.geometry.parameters?.radiusBottom ?? 0.2;
        for (let i = 0; i < mesh.count; i++) {
          mesh.getMatrixAt(i, m);
          m.decompose(p, q, s);
          out.push({
            name: n,
            base: new THREE.Vector3(0, -s.y / 2, 0).applyQuaternion(q).add(p).clone(),
            tip: new THREE.Vector3(0, s.y / 2, 0).applyQuaternion(q).add(p).clone(),
            r: Math.max(s.x, s.z) * shaft,
          });
        }
      }
      return out;
    };
    for (const [species, structNames, lobeNames] of SPECIES) {
      const lobes = lobesOf(group).filter((l) => lobeNames.includes(l.name));
      const struct = members(structNames);
      assert.ok(struct.length, `${species} has no structural members at all`);
      for (const e of struct) {
        const inLobe = lobes.some((l) =>
          (e.tip.x - l.x) ** 2 / l.sx ** 2 + (e.tip.y - l.y) ** 2 / l.sy ** 2 +
          (e.tip.z - l.z) ** 2 / l.sz ** 2 <= 1);
        if (inLobe) continue;
        const continued = struct.some((o) =>
          o !== e && o.tip.y > e.tip.y + 0.05 &&
          segDist(e.tip, o.base, o.tip) < Math.max(0.45, e.r + o.r));
        assert.ok(continued,
          `${species}: a ${e.name} ends at (${e.tip.x.toFixed(1)}, ${e.tip.y.toFixed(1)}, ` +
            `${e.tip.z.toFixed(1)}) — outside every lobe and continued by nothing. That is a stick in open air.`);
      }
    }
  }
});

test("every ficus stem reaches its canopy whatever the tree's proportions", () => {
  /* The gate above would pass on a lucky proportion. This one pins the FIX:
     a ficus stem's tip must be inside a lobe BY CONSTRUCTION, which is what
     aiming it at a lobe centre buys — and it must hold hardest on the two
     slender trees that exposed the bug, h/r 2.78 and 2.43 against the squat
     ones at 1.11-1.53. A stem that merely grazes the dome on a squat tree is
     the state this replaced. */
  const { group } = createPhotoPlaza(null, { photo: photoFor(), surfaceAt: () => 0 });
  const lobes = lobesOf(group).filter((l) => l.name === "canopy-ficus");
  const mesh = group.getObjectByName("ficus-stems");
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const trees = section.treeOverrides.ficus.items;
  assert.ok(trees.some((t) => t.h / t.r > 2.4), "the slender ficus that exposed this are gone from the roster");
  const perTree = new Map(trees.map((t) => [`${t.x},${t.z}`, 0]));
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, m);
    m.decompose(p, q, s);
    const foot = new THREE.Vector3(0, -s.y / 2, 0).applyQuaternion(q).add(p);
    const tip = new THREE.Vector3(0, s.y / 2, 0).applyQuaternion(q).add(p);
    /* The foot still fuses at the ONE measured trunk — the fix may not buy
       its connection by walking the stem's base off the surveyed point. */
    const tree = trees.find((t) => Math.hypot(foot.x - t.x, foot.z - t.z) < 0.05);
    assert.ok(tree,
      `a ficus stem's foot at (${foot.x.toFixed(2)}, ${foot.z.toFixed(2)}) is off every measured trunk`);
    perTree.set(`${tree.x},${tree.z}`, perTree.get(`${tree.x},${tree.z}`) + 1);
    const inside = lobes.some((l) =>
      (tip.x - l.x) ** 2 / l.sx ** 2 + (tip.y - l.y) ** 2 / l.sy ** 2 +
      (tip.z - l.z) ** 2 / l.sz ** 2 <= 1);
    assert.ok(inside,
      `the ficus at (${tree.x}, ${tree.z}), h/r ${(tree.h / tree.r).toFixed(2)}, has a stem ending at ` +
        `y ${tip.y.toFixed(2)} outside every lobe — the dome is floating again`);
  }
  for (const [key, n] of perTree) {
    assert.ok(n >= 3 && n <= 5, `the ficus at ${key} has ${n} stems, outside the sourced 3-5`);
  }
});

test("every trunk has a root flare that reaches grade", () => {
  /* A bare cylinder cut off flat at the ground reads as a pole pushed into
     sand. Each species' flare must be WIDER than the trunk it sits under, and
     must start at or below the drawn surface — a flare that floats leaves the
     same daylight gap it was added to close. Built on a flat ground of 0, so
     "below grade" is simply a negative base. */
  const { group } = createPhotoPlaza(null, { photo: photoFor(), surfaceAt: () => 0 });
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const pairs = [
    ["pine-flares", "pine-trunks"],
    ["euc-flares", "euc-trunks"],
    ["ficus-flares", "ficus-stems"],
    ["coral-flares", "coral-stems"],
  ];
  for (const [flareName, trunkName] of pairs) {
    const fl = group.getObjectByName(flareName);
    const tr = group.getObjectByName(trunkName);
    assert.ok(fl?.isInstancedMesh, `${flareName} is missing — a species lost its root flare`);
    assert.ok(tr?.isInstancedMesh, `${trunkName} is missing`);
    assert.ok(fl.geometry.parameters.radiusBottom > tr.geometry.parameters.radiusBottom * 1.4,
      `${flareName} is no wider than ${trunkName} — that is not a flare`);
    for (let i = 0; i < fl.count; i++) {
      fl.getMatrixAt(i, m);
      m.decompose(p, q, s);
      const base = p.y - (fl.geometry.parameters.height * s.y) / 2;
      assert.ok(base < 0, `${flareName} instance ${i} starts ${base.toFixed(2)} m ABOVE grade`);
      assert.ok(base > -1, `${flareName} instance ${i} is buried ${(-base).toFixed(2)} m — that is not a flare`);
    }
  }
  /* One flare per trunk foot, including every stem of the multi-stem species. */
  const counts = createPhotoPlaza(null, { photo: photoFor(), surfaceAt: () => 0 }).counts;
  assert.equal(
    counts.rootFlares,
    group.getObjectByName("pine-flares").count + group.getObjectByName("euc-flares").count +
      group.getObjectByName("ficus-flares").count + group.getObjectByName("coral-flares").count
  );
  assert.equal(group.getObjectByName("pine-flares").count, group.getObjectByName("pine-trunks").count);
  /* Ficus and coral stems FUSE at the measured trunk, so those species get one
     flare per tree, not one per stem — and the flare must actually sit on the
     trunk the stems rise from. */
  assert.equal(group.getObjectByName("ficus-flares").count, section.treeOverrides.ficus.items.length);
  assert.equal(group.getObjectByName("coral-flares").count, 1);
});

test("multi-stem trunks fuse at the measured trunk they stand on", () => {
  /* Each ficus stem is offset from its own centre by half its length along the
     direction it leans, so its FOOT must land back on the measured (x, z).
     Offsetting by the negated pair (leaning one way, moving the other) put the
     feet up to 2.5 m out, splayed round a trunk that was not there. */
  const { group } = createPhotoPlaza(null, { photo: photoFor(), surfaceAt: () => 0 });
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const foot = new THREE.Vector3();
  const trunks = section.treeOverrides.ficus.items.map((t) => [t.x, t.z]);
  trunks.push([section.treeOverrides.coral.x, section.treeOverrides.coral.z]);
  for (const name of ["ficus-stems", "coral-stems"]) {
    const mesh = group.getObjectByName(name);
    assert.ok(mesh?.isInstancedMesh, `${name} is missing`);
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, m);
      m.decompose(p, q, s);
      /* Limbs share the coral bin; a limb does not stand on the ground. */
      foot.set(0, -s.y / 2, 0).applyQuaternion(q).add(p);
      if (foot.y > 0.5) continue;
      const near = Math.min(...trunks.map(([tx, tz]) => Math.hypot(foot.x - tx, foot.z - tz)));
      assert.ok(near < 0.35,
        `${name} instance ${i} has its foot ${near.toFixed(2)} m from any measured trunk`);
    }
  }
});

test("the canopies stay inside a sane triangle budget", () => {
  const { group } = createPhotoPlaza(null, { photo: photoFor(), surfaceAt: () => 0 });
  let tris = 0;
  for (const c of group.children) {
    if (!c.isInstancedMesh) continue;
    if (!/^(canopy-|pine-|euc-|ficus-|coral-)/.test(c.name)) continue;
    const idx = c.geometry.index;
    tris += ((idx ? idx.count : c.geometry.attributes.position.count) / 3) * c.count;
  }
  assert.ok(tris < 150000, `the 41 trees cost ${Math.round(tris)} triangles`);
});
