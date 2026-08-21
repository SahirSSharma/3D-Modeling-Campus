/* Galbraith Hall's photo-sourced detail section.
 *
 * This is the INVENTED class, so the gates are about quarantine, about every
 * figure being derivable rather than typed, and about not contradicting the
 * measured world:
 *
 *   - it is labelled, epoch-stamped and sourced, and it says what it left out;
 *   - colours are data, they are hex, and EVERY hex carries a tier and a
 *     provenance line in `colorSources`;
 *   - the ring it hangs on is the MEASURED ring, byte for byte;
 *   - THE DERIVATION TABLE IS RECOMPUTED HERE, independently, from the section's
 *     own `readings` — the Eighth audit proved that twenty-two presence gates
 *     pass happily on wholesale fabricated values, so every drawn metre is
 *     pinned to the arithmetic that produces it and a self-consistent
 *     fabrication fails;
 *   - no drawn number is uncovered: derived, labelled [estimated] with the
 *     pattern it extends, or a cited read with a tolerance;
 *   - the module carries no dimension and no hex of its own;
 *   - the strut grid CLOSES on each measured face — two end insets, four
 *     pair-to-pair steps and one pair gap span it exactly — and the gap is
 *     per-face, because the architect's sheet gives two different ratios;
 *   - THE ROOF PLATE IS THE RING. Nothing may reach further past it than the
 *     declared registration band, which is the single largest correction this
 *     revision makes: the retired revision built a 12.474 m collar outside a
 *     ring the orthophoto measures the roof plate ON, and then laid its own
 *     sourced east and west ground furniture underneath it;
 *   - the roofscape sits inside the ring, solves on the coffer module, is
 *     corrected for the frame's own top displacement, and NEVER stacks its
 *     [estimated] block height on top of the LiDAR maximum;
 *   - the east ground stops at the construction line the orthophoto shows;
 *   - nothing it places sits inside a measured building footprint;
 *   - nothing solid sits within 3 m of the corridor-staging centreline;
 *   - it builds on flat ground, on an exaggerated slope AND on the real drawn
 *     LiDAR surface, and nothing hovers or sinks at any footing on any of them;
 *   - the absent list does not shrink, and every retirement is a `superseded`
 *     record naming what supersedes what.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as THREE from "../docs/vendor/three/three.module.min.js";
import { createPhotoGalbraith } from "../docs/js/campus-photo-galbraith.js";
import { SPECIES, treeSpecies } from "../docs/js/campus-species.js";
import { makeSurfaceSampler } from "../docs/js/campus-terrain.js";
/* R2 arbitration item S1 — THE AXIOM-LAYER GATE. One shared apparatus for all
   six R1 suites; do not fork it. Galbraith is the section that made the case
   for it: all four of its mutation-test survivors were READINGS, and
   `kda.rowPairToPair = 172.6` — an interval that appears nowhere on the sheet
   it cites — sat under sixty passing gates with an invented waffle-slab story
   built on top of it. Every function below is a tightening. */
import {
  assertCoverage, assertEstimateBands, assertPins, assertRelations,
  assertTierSymmetry, assertAbsentEntries, assertExprs, assertDispositions,
} from "./helpers/axiom-gate.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));

const PHOTO_DOC = "docs/data/campus-photo-detail.json";
const merged = existsSync(join(root, PHOTO_DOC));
const doc = read(PHOTO_DOC);
const section = doc.galbraith;
/* The module reads photo.galbraith; hand it the section under test. */
const photo = { ...doc, galbraith: section };

/* The lending sections, for the R2 colour imports. A colour galbraith says it
   imported is checked against the lender's own file, not against a word in
   galbraith's prose. */
const lender = (n) => {
  const p = `Revelle-College-Sources/merge/r1/${n}.json`;
  return existsSync(join(root, p)) ? read(p) : doc[n];
};

const campus = read("docs/data/campus-3d.json");
const arcgis = read("docs/data/campus-arcgis.json");
const lidar = read("docs/data/campus-lidar.json");
const staging = read("docs/data/corridor-staging.json");
const RING = campus.buildings.find((b) => b.n === "Galbraith Hall").p;

const D = section.draw;
const G = section.grid;
const REG = section.facade.wallStandoff;
const BAND = REG + G.roofOut;

/** Dotted path lookup, with `a.0` indexing an array. */
const at = (o, p) => p.split(".").reduce((v, k) => (v == null ? v : v[k]), o);

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

/** Distance from a point to the measured ring, negative inside. */
function toRing(x, z) {
  let best = Infinity;
  for (let i = 0; i < RING.length; i++) {
    const [ax, az] = RING[i];
    const [bx, bz] = RING[(i + 1) % RING.length];
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz;
    let t = len2 ? ((x - ax) * dx + (z - az) * dz) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return inRing(x, z, RING) ? -best : best;
}

/** The same face frame campus-photo-galbraith.js builds, so these gates see
 *  the geometry the renderer actually draws and not a restatement of it. */
function frameOf(f) {
  let [sx, sz] = f.a;
  let [ex, ez] = f.b;
  const length = Math.hypot(ex - sx, ez - sz);
  let tx = (ex - sx) / length;
  let tz = (ez - sz) / length;
  let nx = tz;
  let nz = -tx;
  if (nx * f.out[0] + nz * f.out[1] < 0) {
    nx = -nx; nz = -nz;
    [sx, sz, ex, ez] = [ex, ez, sx, sz];
    tx = -tx; tz = -tz;
  }
  return { length, at: (u, w) => [sx + tx * u + nx * w, sz + tz * u + nz * w] };
}

/** Every strut foot, as (x, z). Per-face pair gap, like the module. */
function strutFeet() {
  const out = [];
  for (const f of section.faces) {
    const frame = frameOf(f);
    for (const k of G.pairIndices) {
      const c = frame.length / 2 + k * f.pairSpacing;
      for (const s of [-1, 1]) {
        out.push(frame.at(c + (s * f.pairGap) / 2, REG + section.column.standoffBuilt));
      }
    }
  }
  return out;
}

/** Every facade layer, sampled along each face at its own standoff. */
function facadePoints() {
  const out = [];
  const F = section.facade;
  const standoffs = [
    REG,
    REG + F.balcony.project,
    REG + F.terrace.project,
    REG + section.column.standoffBuilt,
  ];
  for (const f of section.faces) {
    const frame = frameOf(f);
    for (const w of standoffs) {
      for (let u = 0; u <= frame.length; u += 4) out.push(frame.at(u, w));
    }
  }
  return out;
}

/** The outer corners of the roof, which reach further than anything else. */
function roofPoints() {
  const out = [];
  for (const f of section.faces) {
    const frame = frameOf(f);
    for (let u = -f.ext; u <= frame.length + f.ext; u += 4) out.push(frame.at(u, BAND));
  }
  return out;
}

/** Every solid object this section stands on the ground. */
function groundSolids() {
  const out = [...strutFeet()];
  const W = section.west;
  const L = W.lavaWall;
  const n = Math.ceil(Math.hypot(L.b[0] - L.a[0], L.b[1] - L.a[1]) / 2);
  for (let i = 0; i <= n; i++) {
    out.push([L.a[0] + ((L.b[0] - L.a[0]) * i) / n, L.a[1] + ((L.b[1] - L.a[1]) * i) / n]);
  }
  for (const r of W.railings) {
    const m = Math.ceil(Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]) / 2);
    for (let i = 0; i <= m; i++) {
      out.push([r.a[0] + ((r.b[0] - r.a[0]) * i) / m, r.a[1] + ((r.b[1] - r.a[1]) * i) / m]);
    }
  }
  for (const b of section.north.bins) out.push([b.x, b.z]);
  /* The north bed planting stands on the ground like everything else. Sampling
     the ring vertices is enough: a clump can only be placed inside the ring. */
  for (const bed of section.north.beds) for (const [x, z] of bed.ring) out.push([x, z]);
  return out;
}

const rectCorners = (r) => [[r.x0, r.z0], [r.x1, r.z1], [r.x0, r.z1], [r.x1, r.z0]];

/* What genuinely still has no source. The absent list may not shrink and it
   may not lose these: the block height is a measurement not yet made, the
   construction east of x ~90 is a neighbour's project in a different epoch,
   the east elevation is unphotographed, and the residual plan oversize is an
   error this section owns rather than hides. */
const MUST_STAY_ABSENT = [
  /HEIGHT of the raised skylight block/i,
  /CENTRAL UTILITIES PLANT EXPANSION/i,
  /EAST ELEVATION IS UNSOURCED/i,
  /RESIDUAL PLAN OVERSIZE/i,
  /CAP PROFILE/i,
];
const ABSENT_FLOOR = 19;

test("the merged photo document carries a galbraith section", () => {
  assert.ok(merged, `${PHOTO_DOC} is missing — the galbraith section has nowhere to live`);
  assert.ok(section, `no galbraith section found in ${PHOTO_DOC}`);
});

test("the other photo sections survived it", () => {
  for (const key of ["eighth", "revelle", "rady", "erc", "keeling"]) {
    assert.ok(doc[key], `the ${key} section went missing`);
  }
  assert.ok(!doc.revelle.systems.galbraith,
    "the first-pass Galbraith is retired — revelle.systems.galbraith must be gone");
  for (const dead of ["galbraithColumn", "galbraithSoffit", "galbraithGlass"]) {
    assert.ok(!(dead in doc.revelle.colors), `revelle.colors.${dead} is now unused`);
  }
});

test("it says what it is, where it came from, and what it left out", () => {
  assert.match(section.label, /Galbraith/i);
  assert.ok(section.epoch, "no epoch stamp");
  assert.match(section.epoch, /orthophoto/i, "the roof/east orthophoto epoch must be stamped");
  assert.match(section.note, /INVENTED/, "the note must declare the class");
  assert.equal(typeof section.seed, "number", "the section must pin its own seed");

  assert.ok(Array.isArray(section.sources) && section.sources.length >= 12);
  for (const s of section.sources) {
    assert.match(s, /^https?:\/\//, "every source starts with its URL");
    assert.ok(s.length >= 80, `a source line is only ${s.length} chars: say what it is and when`);
    assert.match(s, /\b(19|20)\d{2}\b/, `a source line carries no 4-digit date: ${s.slice(0, 60)}`);
  }
  /* The three dead citations are gone and their replacements are in. Only the
     CITED url — the line's leading token — is checked, because naming a dead
     URL in the prose as the thing that was replaced is exactly right. */
  const cited = section.sources.map((s) => s.split(/\s/)[0]);
  for (const dead of ["act.ucsd.edu/campus-map", "defreitasarchitects.com/ucsd-galbraith-hall",
    "oceanlight.com/stock-photo/galbraith-hall-image-21220"]) {
    assert.ok(!cited.some((u) => u.includes(dead)),
      `${dead} 404s and may not ship as a citation`);
    assert.ok(section.sources.some((s) => s.includes(dead)) || dead.includes("stock-photo"),
      `${dead} was replaced — say which live URL replaced it`);
  }
  for (const live of ["oceanlight.com/spotlight.php?img=21220", "maps.ucsd.edu",
    "plandesignbuild.ucsd.edu", "library.ucsd.edu/dc/object/bb4438071r"]) {
    assert.ok(section.sources.some((s) => s.includes(live)), `${live} must be cited`);
  }
  /* maps.ucsd.edu replaces the MAP and not the photograph, and the section has
     to say so rather than swap it in silently. */
  const mapLine = section.sources.find((s) => s.includes("maps.ucsd.edu"));
  assert.match(mapLine, /not for the .{0,20}photograph|NOT for the/i,
    "maps.ucsd.edu must say it does not re-source ucsdmap.jpg");

  assert.ok(Array.isArray(section.absent) && section.absent.length >= ABSENT_FLOOR,
    `better absent than wrong — the absent list may not shrink below ${ABSENT_FLOOR}`);
  for (const gap of section.absent) {
    assert.equal(typeof gap, "string");
    assert.ok(gap.length > 40, "an absent entry has to say what is missing and why");
  }
  for (const must of MUST_STAY_ABSENT) {
    assert.ok(section.absent.some((a) => must.test(a)),
      `${must} must stay in the absent list — there is no source for it`);
  }
});

test("retirements are supersessions, and the list never simply shrinks", () => {
  assert.ok(Array.isArray(section.superseded) && section.superseded.length >= 4,
    "every claim this revision retired needs a superseded record");
  for (const s of section.superseded) {
    assert.ok(s.what && s.what.length > 25, "a supersession must name what it retires");
    assert.ok(s.by && s.by.length > 8, "a supersession must name what supersedes it");
    assert.ok(s.why && s.why.length > 60, "a supersession must say why the evidence changed");
    assert.match(s.when, /^\d{4}-\d{2}-\d{2}$/, "a supersession must be dated");
  }
  /* The four this revision actually made. */
  const all = JSON.stringify(section.superseded);
  for (const must of [/revelle\.absent\[7\]/, /12\.474/, /pairGap/, /revealNote/]) {
    assert.match(all, must, `${must} is a retirement that must be recorded, not deleted`);
  }
});

test("conflicts are declared and never averaged", () => {
  const C = section.conflicts;
  assert.ok(C, "a section with this many two-source disagreements needs a conflicts block");
  for (const [k, v] of Object.entries(C)) {
    if (k === "why") continue;
    assert.ok(typeof v === "string" && v.length > 80,
      `conflicts.${k} must say what each side describes and which one is drawn`);
  }
  for (const k of ["roofPlate", "colonnadeDepth", "gridScale", "cofferModule",
    "westCitation", "p11", "lectureSeats", "outerGridLines", "oversailCount"]) {
    assert.ok(C[k], `conflicts.${k} is missing`);
  }
  /* The two headline ones must carry BOTH numbers, so nobody can quietly
     average them later. */
  assert.match(C.colonnadeDepth, /3\.4/, "the sourced colonnade depth stays on the record");
  assert.match(C.colonnadeDepth, /1\.88/, "the built colonnade depth stays on the record");
  assert.match(C.lectureSeats, /420/);
  assert.match(C.lectureSeats, /417/);
  /* The recon's p11 misidentification must be contradicted in writing, or the
     next agent uses a mushroom arcade as a Galbraith source. */
  assert.match(C.p11, /NOT GALBRAITH/i);
});

test("colours are data, they are hex, and every one carries a tier", () => {
  const keys = Object.keys(section.colors);
  assert.ok(keys.length >= 25, `only ${keys.length} colours`);
  for (const [k, v] of Object.entries(section.colors)) {
    assert.match(v, /^#[0-9a-f]{6}$/, `${k} is not a lowercase 6-digit hex`);
  }
  assert.ok(section.colorNote, "the adjusted samples have to say they were adjusted");
  for (const k of ["skylightCap", "blockReveal", "penthouseTop", "penthouseMetal",
    "mechWall", "eastRecess", "eastWalk", "eastDg", "eastLawn", "footPad"]) {
    assert.ok(section.colors[k], `roof/east colour ${k} is missing`);
  }

  /* THE ULTRA BAR: a hex with no machine-readable provenance is not derivable,
     and sixty of them shipped that way. One entry per hex, no extras. */
  const cs = section.colorSources;
  assert.ok(cs && cs.why, "colorSources must say what its tiers mean");
  const covered = Object.keys(cs).filter((k) => k !== "why").sort();
  assert.deepEqual(covered, keys.slice().sort(),
    "colorSources and colors must name exactly the same roles");
  for (const k of covered) {
    const e = cs[k];
    assert.ok(["measured", "sourced", "estimated"].includes(e.tier),
      `${k} has tier ${e.tier}, which is not one of measured/sourced/estimated`);
    assert.ok(e.source && e.source.length > 60,
      `${k} must name the frame, the region and the lighting condition`);
    if (e.tier === "estimated") {
      assert.match(e.source, /\[estimated\]/, `${k} is estimated and must carry the label`);
    } else if (!IMPORTS[k]) {
      assert.match(e.source, /\.jpg|\.png|\.webp/i,
        `${k} claims tier ${e.tier} and must name the frame it was read off`);
    }
    /* An IMPORT names no frame of galbraith's own by definition; it is held
       instead by the loop below, which checks the hex and the provenance line
       against the LENDING SECTION'S OWN FILE. That is a harder gate than a
       filename regex, not an easier one. */
  }
  /* Nothing may claim `measured` without a sample record. There are now two
     shapes a sample record may take, and the second is checked HARDER than
     the first, not more softly: a median stated in the line, or an IMPORT
     whose hex and whose provenance line are verified against the lending
     section's own file. R2 colour ruling C0 found galbraith's whole shared
     palette was one boilerplate string, so it lost every contest and now
     borrows; a borrowed value that quietly drifted off its lender would be
     the same defect wearing a better sentence. */
  assert.equal(cs.fascia.tier, "measured");
  assert.match(cs.fascia.source, /#d5d8d0/, "the fascia's raw sample stays on the record");
  for (const k of covered) {
    if (cs[k].tier !== "measured") continue;
    if (IMPORTS[k]) continue;
    assert.match(cs[k].source, /median/i, `${k} claims measured but records no median`);
  }

  /* THE R2 COLOUR RULINGS, one assertion each. */
  for (const [k, [from, hex]] of Object.entries(IMPORTS)) {
    const src = lender(from);
    assert.equal(section.colors[k], hex, `${k} must import ${from}'s ${hex}`);
    assert.equal(src.colors[k] ?? src.colors[IMPORT_ALIAS[k] || k], hex,
      `${from} no longer ships ${hex} for ${k} — the import has drifted off its lender`);
    const line = typeof src.colorSources[k] === "string"
      ? src.colorSources[k] : src.colorSources[k].source;
    /* The lender's own opening sentence, verbatim. Sixty characters is enough
       to carry the frame and the year and short enough that a lender may add
       to its own record without breaking the borrower. */
    const quoted = line.replace(/^\[\w+\]\s*/, "").slice(0, 60);
    assert.ok(cs[k].source.includes(quoted),
      `${k} claims to import ${from}'s value and does not carry ${from}'s own provenance line`);
    assert.match(cs[k].source, /IMPORTED/, `${k} must say it is an import`);
    const lenderTier = /\[measured\]/.test(line) ? "measured"
      : /\[sourced\]/.test(line) ? "sourced" : "estimated";
    assert.equal(cs[k].tier, lenderTier,
      `${k} imports a [${lenderTier}] value and may not ship it at a better tier`);
  }
  /* Deleted outright by the rulings, with nothing to import. */
  for (const dead of ["spandrel", "doorBronze", "lavaRock", "luminaire"]) {
    assert.ok(!(dead in section.colors), `${dead} was deleted by the R2 colour arbitration`);
    assert.ok(!(dead in cs), `colorSources.${dead} outlived its colour`);
  }
  /* Renamed, because they are a different role from the shared name. */
  assert.equal(section.colors.luminaireLens, "#f0ece0");
  assert.equal(cs.luminaireLens.tier, "estimated", "a rename earns no tier");
  assert.match(cs.westWallRock.source, /west\.lavaWall|west court/i,
    "galbraith may keep its own rock tone only by saying WHICH WALL it means");
  /* The one colour this section actually sampled. */
  assert.equal(section.colors.column, "#a0a8aa");
  assert.equal(cs.column.tier, "measured");
  assert.match(cs.column.source, /oceanlight-21220-strut-band\.png/);
  assert.match(cs.column.source, /x 1032-1048, y 210-380/, "a median needs its region on the record");
  assert.match(cs.column.source, /2,720/, "a median needs its pixel count on the record");
  assert.ok(section.conflicts.columnTone,
    "sampling the shaft put it darker than columnShaded — declare that, do not tidy it");
  /* The bed ground the north apron used to pave over. */
  assert.equal(cs.northBed.tier, "measured");
  assert.match(cs.northBed.source, /median of 6,462/);
  assert.match(cs.northBed.source, /chunk_4_7/);
});

/* R2 colour rulings C-dg, C-lawn, C-bin, C-mullion: what galbraith imports and
   from whom. The tier is the LENDER's, checked against the lender's file. */
const IMPORTS = {
  dg: ["plaza", "#a98a68"],
  lawn: ["plaza", "#6f8054"],
  bin: ["revelle", "#bfbab0"],
  mullion: ["blake", "#2f3134"],
};
const IMPORT_ALIAS = {};

test("S1(iv) the tier gate runs BOTH ways over colours and estimates", () => {
  /* The R1 gate only forbade a [measured] line from reading like an estimate.
     This one also runs the other way: a line that extends a pattern, borrows,
     has no per-hex sample record or names no artefact at all MUST carry
     [estimated] whatever it calls itself. Galbraith's C0 boilerplate is
     exactly what it is for — nine entries carried the identical string and
     one of them, `lavaRock`, was a promotion waiting to happen. */
  const entries = [
    ...Object.entries(section.colorSources)
      .filter(([k]) => k !== "why")
      /* The tier lives in its own field in this section, so it is prefixed
         onto the text the gate reads: the gate's job is to check the CLAIMED
         tier against the hedges in the prose beside it. */
      .map(([key, e]) => ({ key: `colorSources.${key}`, text: `[${e.tier}] ${e.source}` })),
    ...Object.entries(section.estimates)
      .filter(([k]) => k !== "why")
      .map(([key, e]) => ({ key: `estimates.${key}`, text: e.why })),
  ];
  const n = assertTierSymmetry({ entries, label: "galbraith" });
  assert.ok(n > 60, `the tier gate walked only ${n} lines`);
  /* And the boilerplate itself: anything still carrying it is [estimated]. */
  for (const [k, e] of Object.entries(section.colorSources)) {
    if (k === "why") continue;
    if (/no per-hex sample record/.test(e.source)) {
      assert.equal(e.tier, "estimated",
        `${k} has no per-hex sample record and claims tier ${e.tier}`);
    }
  }
});

test("the ring it hangs on is the measured ring, unchanged", () => {
  assert.deepEqual(section.ring, RING,
    "the section's ring must be campus-3d's Galbraith ring, copied verbatim");
  assert.equal(section.measured.lidarHeight, 16.6, "the LiDAR height is not this section's to pick");
  assert.equal(section.measured.lidarHeight, lidar.massHeights["m:14,450"]);
  assert.equal(section.measured.lidarHeight, lidar.heights["Galbraith Hall"]);
  assert.equal(section.faces.length, 4);
  const ids = section.faces.map((f) => f.id).sort();
  assert.deepEqual(ids, ["east", "north", "south", "west"]);
  for (let i = 0; i < section.faces.length; i++) {
    const f = section.faces[i];
    assert.deepEqual(f.a, RING[i], `${f.id} face does not start on a measured vertex`);
    assert.deepEqual(f.b, RING[(i + 1) % RING.length], `${f.id} face does not end on one`);
  }
});

test("the drawn ring is the university's own, copied verbatim", () => {
  const m = arcgis.massing.find((r) => r.n === "Galbraith Hall");
  const want = m.r[0].map(([x, z]) => [x / 10, z / 10]);
  assert.deepEqual(section.drawnRing, want,
    "drawnRing must be campus-arcgis's Galbraith massing ring, decimetres converted to metres");
});

/* ------------------------------------------------- THE DERIVATION TABLE */

/**
 * Recompute every figure from `readings`, independently of the section's own
 * arithmetic, and fail if the stated value or the SHIPPED value drifts. This
 * is the gate that a self-consistent fabrication cannot pass: replacing a
 * sourced figure with a plausible number now has to survive being recomputed
 * from the pixel counts and orthophoto measurements it claims to come from.
 */
test("every figure recomputes from the section's own readings", () => {
  const R = section.derivations.readings;
  const { px, kda, ortho, sourcedDepths, ring } = R;
  const centroid = [ring.centroidX, ring.centroidZ];

  const moduleV = (ortho.skylightPitch / 2 + ring.meanFaceLength / px.coffersAcrossFace) / 2;
  const roofOut = 2 * moduleV;
  const registration = section.drawnClearance + D.clearanceMargin;
  const standoffBuilt = roofOut - section.column.headCap.halfWidth;
  const compression = standoffBuilt / sourcedDepths.colonnade;
  const insetRatio = px.endInset / px.pairSpacing;
  const gapNS = kda.rowPairGap / kda.rowPairToPair;
  const gapEW = kda.alPairGap / kda.alPairToPair;
  const eaves = section.levels.eavesBelowRoof;
  const slab = section.levels.roofSlab;
  const storey = (section.measured.lidarHeight - eaves - slab) / 2;
  const dispX = centroid[0] - ortho.skylightCentreX;
  const dispZ = centroid[1] - ortho.skylightCentreZ;

  const expect = {
    "grid.module": moduleV,
    "grid.roofOut": roofOut,
    "grid.insetRatio": insetRatio,
    "grid.gapRatio.northSouth": gapNS,
    "grid.gapRatio.eastWest": gapEW,
    "draw.registration": registration,
    "draw.compression": compression,
    "facade.wallStandoff": registration,
    "column.standoffBuilt": standoffBuilt,
    "facade.balcony.project": sourcedDepths.balcony * compression,
    "facade.terrace.project": sourcedDepths.terrace * compression,
    "entry.canopy.project": sourcedDepths.canopy * compression,
    "entry.beam.project": roofOut,
    "levels.storey": storey,
    "levels.l2BelowRoof": eaves + slab + storey,
    "levels.soffitBelowRoof": eaves + slab,
    "levels.l1BelowRoof": section.measured.lidarHeight,
    "measured.eavesBelowRoof": eaves,
    "measured.skylightPlaneHeight":
      Math.hypot(dispX, dispZ) / (ortho.argoPlateDisplacement / ortho.argoPlateHeight),
    "roof.displacement.x": dispX,
    "roof.displacement.z": dispZ,
    "roof.skylights.pitch": 2 * moduleV,
    "roof.skylights.centre.0": centroid[0],
    "roof.skylights.centre.1": centroid[1],
    /* audit-galbraith finding 7: the bin station was a typed coordinate and a
       typed "1.6 m north of the face". It is derived now, off the strut line
       plus one column foot plus one bin radius, compressed like every other
       outward projection inside the band. */
    "north.binStandoff": standoffBuilt +
      (section.reads["column.footHalfWidth"].value + section.entry.bins.radius) * compression,
  };
  /* audit-galbraith finding 7 again: `ortho.block` used to exist ONLY as a
     literal here, so the four figures deriving from it could not be run from
     the document at all and this "independent" check was supplying the
     document's missing inputs. The numbers are readings now and they are
     PINNED below; this test reads them from the document like everything
     else, and the pin is what stops them drifting. */
  const orthoBlock = ortho.block;
  for (const k of ["x0", "x1"]) expect[`roof.block.${k}`] = orthoBlock[k] + dispX;
  for (const k of ["z0", "z1"]) expect[`roof.block.${k}`] = orthoBlock[k] + dispZ;

  section.faces.forEach((f, i) => {
    const a = RING[i];
    const b = RING[(i + 1) % RING.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const gr = f.id === "north" || f.id === "south" ? gapNS : gapEW;
    const spacing = L / (2 * insetRatio + (kda.pairsPerFace - 1) + gr);
    const ext = f.id === "north" || f.id === "south" ? registration + roofOut : 0;
    const roofLength = L + 2 * ext;
    const coffers = Math.round(roofLength / moduleV);
    expect[`faces.${i}.length`] = L;
    expect[`faces.${i}.pairSpacing`] = spacing;
    expect[`faces.${i}.endInset`] = insetRatio * spacing;
    expect[`faces.${i}.pairGap`] = gr * spacing;
    expect[`faces.${i}.ext`] = ext;
    expect[`faces.${i}.roofLength`] = roofLength;
    expect[`faces.${i}.coffers`] = coffers;
    expect[`faces.${i}.cofferPitch`] = roofLength / coffers;
  });

  const figures = section.derivations.figures;
  assert.deepEqual(Object.keys(figures).sort(), Object.keys(expect).sort(),
    "the derivation table and this test's independent recomputation must cover the same figures");
  for (const [path, want] of Object.entries(expect)) {
    const decl = figures[path];
    /* S1(vi): `expr` now means an evaluable arithmetic formula and nothing
       else. A figure that is genuinely prose carries `derivation` instead —
       faces[1].ext and faces[3].ext are exactly zero by an argument, not by a
       calculation — and never prose under the name `expr`. */
    assert.ok(decl && (decl.expr || decl.derivation), `${path} has no stated derivation`);
    assert.ok(Math.abs(decl.value - want) < 5e-6,
      `${path}: the section states ${decl.value} but its own citations give ${want}`);
    const shipped = at(section, path);
    assert.equal(typeof shipped, "number", `${path} is not a number in the section`);
    assert.ok(Math.abs(shipped - want) < 5e-6,
      `${path}: the section SHIPS ${shipped} but derives ${want}`);
  }

  /* Spot-checks on the figures this revision exists to correct — a fabrication
     that satisfies the table above still has to land on these. */
  assert.ok(Math.abs(G.module - 1.3603) < 1e-3, "the coffer module is the re-chained 1.3603");
  assert.ok(Math.abs(G.roofOut - 2.7206) < 1e-3, "the roof band is two coffer bays");
  assert.ok(Math.abs(section.column.standoffBuilt - 1.8806) < 1e-3);
  /* BASELINE INVERTED IN THE R2 SURGERY (item G1), and the reason is the whole
     point of this batch: this line used to demand the two axes differ by more
     than 0.9 m, which is what the FABRICATED rowPairToPair = 172.6 produced.
     Re-measured at the sheet's native resolution the rows give 53.5/241.1 and
     the letters 53.7/241.0 — ONE SQUARE GRID to 0.4% — so the gate now demands
     they AGREE, and the waffle-slab story that explained the old difference is
     deleted from the document rather than softened. */
  const gapOf = (id) => section.faces.find((f) => f.id === id).pairGap;
  assert.ok(Math.abs(gapNS - gapEW) / gapNS < 0.006,
    `the two axes read ${gapNS} and ${gapEW}: one grid, both ways, to better than 0.6%`);
  assert.ok(Math.abs(gapOf("north") - gapOf("east")) < 0.05,
    "the per-face pair gaps differ only by the faces' own measured lengths");
  /* The STORY, not the word: Arch2O really does describe an exposed original
     concrete waffle slab and that fact is allowed to stand. What may not
     stand anywhere as a live claim is the story that the two axes differ
     BECAUSE of it. Every surviving mention has to sit in a string that also
     says it is retired. */
  /* Whitespace-tolerant: the module wraps this phrase across a comment line as
     `different beam\n * spacing`, and the R2 stage-7 re-audit demonstrated that
     the contiguous-phrase version of this regex could not see the one live
     instance in the repo. A comment wrap may not evade a gate. */
  const WS = "[-\\s*/]*";
  const STORY = new RegExp(
    `waffle${WS}slab[^.]{0,120}(different${WS}beam${WS}spacing|spaced${WS}differently)`,
    "i");
  const RETIRED = /DELETED|RETIRED|retired|used to (say|tell)|previous revision/;
  const live = [];
  const scan = (v, p) => {
    if (typeof v === "string") { if (STORY.test(v) && !RETIRED.test(v)) live.push(p); return; }
    if (v && typeof v === "object") for (const k of Object.keys(v)) scan(v[k], p ? `${p}.${k}` : k);
  };
  /* `superseded` is excluded on purpose: a retirement record's whole job is
     to quote the claim it retires, and its `when` stamp is what marks it. */
  for (const [k, v] of Object.entries(section)) if (k !== "superseded") scan(v, k);
  for (const r of section.superseded) {
    assert.match(r.when, /^\d{4}-\d{2}-\d{2}$/, "a retirement quoting the story must be dated");
  }
  /* The exemption is scoped to the MATCHED SENTENCE, not to the file. The R2
     stage-7 re-audit showed that one "deleted, not softened" anywhere in the
     header exempted every other line in the module, so the live story at
     columnLines was covered by the very sentence recording its deletion. A
     retirement note may only excuse the sentence it is part of. */
  const modSrc = readFileSync(join(root, "docs/js/campus-photo-galbraith.js"), "utf8");
  /* Flatten first: strip comment markers and collapse every whitespace run to
     one space, so a phrase wrapped across comment lines reads as one phrase and
     RETIRED's "used to tell" is contiguous however the source happens to wrap. */
  const flat = modSrc.replace(/^[ \t]*(\/\/+|\*+|\/\*+)[ \t]?/gm, " ").replace(/\s+/g, " ");
  /* A sentence end is a period that is NOT the decimal point of a number —
     this comment block is full of figures like 172.6 and 0.3105, and splitting
     on those truncates the sentence away from the word that retires it. */
  const isEnd = (i) =>
    flat[i] === "." && !(/\d/.test(flat[i - 1] || "") && /\d/.test(flat[i + 1] || ""));
  const STORY_G = new RegExp(STORY.source, "gi");
  for (const m of flat.matchAll(STORY_G)) {
    let from = m.index;
    while (from > 0 && !isEnd(from - 1)) from--;
    let to = m.index + m[0].length;
    while (to < flat.length && !isEnd(to)) to++;
    const sentence = flat.slice(from, Math.min(to + 1, flat.length));
    if (!RETIRED.test(sentence)) live.push(`the builder: ${sentence.trim().slice(0, 70)}`);
  }
  assert.deepEqual(live, [],
    "the waffle-slab story is DELETED, not softened — it may survive only inside a retirement record");
  assert.match(G.calibration, /WAFFLE-SLAB STORY IS DELETED/,
    "grid.calibration must say so in its own words");
  /* The retired numbers may not come back. */
  assert.ok(!("oversail" in G), "grid.oversail was the 12.474 m collar's arithmetic — retired");
  assert.ok(!("pairGap" in G), "pairGap is per-face now; a building-wide one is the retired claim");
  assert.ok(!("endInset" in G), "endInset is per-face now");
  assert.ok(Math.abs(section.measured.skylightPlaneHeight - 16.6) < 0.3,
    "the displacement ruler must land on the LiDAR maximum or the derivation is decoration");
});

test("no drawn number is uncovered: derivation, labelled estimate, or cited read", () => {
  /* The coverage line, argued for in derivations.why: scalars are walked;
     RECTANGLE and RING coordinates are positions read off a frame rather than
     dimensions, and are covered group-wise by a rectSource citation. */
  const skip = new Set(["grid.pairIndices", "column.profile", "roof.penthouses", "roof.mech",
    "roof.block.x0", "roof.block.x1", "roof.block.z0", "roof.block.z1",
    "roof.skylights.centre", "roof.displacement", "faces"]);
  const paths = [];
  const walk = (v, p) => {
    if (skip.has(p)) return;
    if (typeof v === "number") { paths.push(p); return; }
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, `${p}.${i}`)); return; }
    if (v && typeof v === "object") for (const k of Object.keys(v)) walk(v[k], p ? `${p}.${k}` : k);
  };
  for (const r of ["grid", "levels", "column", "roofEdge", "soffit", "facade", "entry"]) {
    walk(section[r], r);
  }
  for (const k of ["grid", "size", "curb", "glassInset", "pitch"]) {
    walk(section.roof.skylights[k], `roof.skylights.${k}`);
  }
  for (const k of ["height", "rim", "reveal"]) walk(section.roof.block[k], `roof.block.${k}`);
  walk(section.roof.penthouseExpression, "roof.penthouseExpression");
  walk(section.roof.mechExpression, "roof.mechExpression");
  walk(section.east.walkPitch, "east.walkPitch");
  walk(section.east.footPads, "east.footPads");
  for (const k of ["jointPitch", "jointWidth", "paverPitch", "paverJointWidth",
    "railPicketPitch", "railHeight"]) walk(section.west[k], `west.${k}`);
  /* Same rule for the lava wall's two endpoints. */
  skip.add("west.lavaWall.a");
  skip.add("west.lavaWall.b");
  walk(section.west.lavaWall, "west.lavaWall");
  for (const k of ["jointPitch", "jointWidth", "clumps"]) walk(section.north[k], `north.${k}`);
  walk(section.south.clumps, "south.clumps");
  walk(section.south.shrubFraction, "south.shrubFraction");
  walk(section.south.walk.width, "south.walk.width");
  walk(section.treeOverrides.clearBelowSoffit, "treeOverrides.clearBelowSoffit");

  assert.ok(paths.length > 80, `only ${paths.length} drawn numbers found — the walk did not run`);

  /* The lava wall's lichen patch is a three-number geometry; the canopy block
     is declared invented expression as a whole and says so. */
  const groupCovered = ["west.lavaWall.lichenPatch"];
  const derived = new Set(Object.keys(section.derivations.figures));
  const est = section.estimates;
  const reads = section.reads;
  for (const p of paths) {
    if (groupCovered.some((g) => p.startsWith(g))) continue;
    const where = derived.has(p) ? "derived" : est[p] ? "estimated" : reads[p] ? "read" : null;
    assert.ok(where,
      `${p} = ${at(section, p)} is a bare number: derive it, label it [estimated] with the pattern it extends, or cite the frame it is read off`);
  }
  for (const [p, e] of Object.entries(est)) {
    if (p === "why") continue;
    assert.match(e.why, /\[estimated\]/, `${p} must carry the [estimated] label`);
    assert.ok(e.extends && e.extends.length > 15,
      `${p} must record which sourced pattern it extends`);
    assert.ok(Math.abs(at(section, p) - e.value) < 5e-6,
      `${p} ships ${at(section, p)} but its estimate says ${e.value}`);
  }
  for (const [p, r] of Object.entries(reads)) {
    if (p === "why") continue;
    assert.ok(r.source && r.source.length > 40, `${p} must name the frame or plan it is read off`);
    assert.match(r.source, /\b(19|20)\d{2}\b|campus-(lidar|arcgis|3d)\.json/,
      `${p}'s citation carries no date and names no repo data file`);
    assert.equal(typeof r.tolerance, "number", `${p} must carry the tolerance its source supports`);
    assert.ok(Math.abs(at(section, p) - r.value) < 5e-6,
      `${p} ships ${at(section, p)} but its read says ${r.value}`);
  }
  /* One number, one provenance. */
  for (const p of Object.keys(est)) {
    if (p === "why") continue;
    assert.ok(!derived.has(p) && !reads[p], `${p} claims two provenances`);
  }
  /* Every rectangle group cites the frame its coordinates came off. */
  for (const [k, o] of [["west", section.west], ["north", section.north],
    ["south", section.south], ["east", section.east], ["roof", section.roof]]) {
    assert.ok(o.rectSource && o.rectSource.length > 40,
      `${k} rectangles are coordinates with no frame behind them`);
    assert.match(o.rectSource, /\b(19|20)\d{2}\b/, `${k}.rectSource carries no date`);
    assert.match(o.rectSource, /\+-|±/, `${k}.rectSource states no tolerance`);
  }
  /* The invented canopy block must say it is invented expression. */
  assert.match(section.treeOverrides.canopy.note, /INVENTED/);
});

test("the module carries no dimension and no hex of its own — geometry is data", () => {
  const src = readFileSync(join(root, "docs/js/campus-photo-galbraith.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.equal(src.match(/#[0-9a-fA-F]{6}\b/g), null,
    "a hex literal in the builder is a colour the section cannot move");
  const allowed = new Map([
    ["43758.5453", "hash constant"], ["131.71", "hash constant"],
    ["57.13", "hash constant"], ["7.9", "hash constant"],
    ["0.5", "a half"], ["0.0", "metalness zero"], ["1.0", "roughness one"],
    ["0.06", "material metalness"], ["0.12", "material roughness"],
    ["0.15", "material emissiveIntensity"], ["0.3", "material emissive/metalness"],
    ["0.35", "material emissiveIntensity"], ["0.4", "material roughness/metalness"],
    ["0.42", "material roughness"], ["0.45", "material normalScale"],
    ["0.55", "material roughness"], ["0.7", "material normalScale"],
    ["0.72", "material roughness"], ["0.78", "material roughness"],
    ["0.8", "material metalness"], ["0.9", "material metalness"],
    ["0.94", "curtain-wall opacity"], ["0.95", "material roughness"],
    ["0.97", "material roughness"], ["0.98", "material roughness"],
    /* The closed-form lobe ripple. Not dimensions: a pure function of the
       vertex that turns a sphere into a leaf mass, and the same recipe
       campus-photo-plaza uses. */
    ["3.1", "lobe ripple"], ["1.7", "lobe ripple"], ["2.6", "lobe ripple"],
    ["3.7", "lobe ripple"], ["2.2", "lobe ripple"], ["6.3", "lobe ripple"],
    ["5.5", "lobe ripple"], ["1.3", "lobe ripple"],
  ]);
  const found = new Set(src.match(/\b\d+\.\d+\b/g) || []);
  for (const n of found) {
    assert.ok(allowed.has(n),
      `${n} is a bare number in the builder — move it into the section's derivations, estimates, reads or draw block`);
  }
  /* And the module must actually be reading the data blocks. */
  for (const key of ["section.draw", "standoffBuilt", "f.pairGap", "treeOverrides"]) {
    assert.ok(src.includes(key), `the builder never reads ${key}`);
  }
});

/* --------------------------------------------------------------- geometry */

test("the strut grid closes on each measured face", () => {
  assert.equal(G.pairsPerFace, 5, "five pairs per face — counted on the plan and in the photos");
  assert.equal(G.pairIndices.length, 5);
  assert.ok(G.calibration && G.calibration.length > 400,
    "dropping the drawing's SCALE while keeping its RATIOS has to be written down in full");

  for (const f of section.faces) {
    const frame = frameOf(f);
    /* The identity the spacing is solved from: two insets, four steps, one gap. */
    const span = 2 * f.endInset + (G.pairsPerFace - 1) * f.pairSpacing + f.pairGap;
    assert.ok(Math.abs(span - frame.length) < 0.01,
      `${f.id} grid spans ${span.toFixed(3)} on a ${frame.length.toFixed(3)} m face`);

    const us = [];
    for (const k of G.pairIndices) {
      const c = frame.length / 2 + k * f.pairSpacing;
      for (const s of [-1, 1]) us.push(c + (s * f.pairGap) / 2);
    }
    us.sort((a, b) => a - b);
    assert.equal(us.length, 10, `${f.id} does not have ten struts`);
    assert.ok(Math.abs(us[0] - f.endInset) < 0.01,
      `${f.id} outer strut is ${us[0].toFixed(2)} from the end, not ${f.endInset}`);
    assert.ok(Math.abs(frame.length - us[9] - f.endInset) < 0.01,
      `${f.id} is not symmetric about its own centre`);
    for (let i = 0; i < 10; i += 2) {
      assert.ok(Math.abs(us[i + 1] - us[i] - f.pairGap) < 1e-6,
        `${f.id} pair ${i / 2} is not ${f.pairGap} m across`);
    }
    /* An outer strut whose head bracket hangs off its own corner is the read
       the retired 1.5 m inset produced; the photographed inset is 2.6 m. */
    assert.ok(f.endInset > section.column.headCap.halfWidth,
      `${f.id}'s outer bracket overhangs the corner`);
  }
});

test("the coffer module stays one module for the whole building", () => {
  assert.ok(Math.abs(G.roofOut - G.module * G.oversailModules) < 1e-6,
    "the roof band must be a whole number of coffers");
  assert.equal(G.oversailModules, 2);
  assert.ok(G.datumNote, "which plane these offsets are measured from has to be written down");
  const F = section.facade;
  assert.ok(F.terrace.project < section.column.standoffBuilt,
    "the terrace has to stop short of the columns that carry it");
  assert.ok(F.balcony.project < F.terrace.project, "the balcony is the narrower of the two decks");
  /* The sourced depths stay on the record beside the built ones. */
  assert.equal(F.balcony.projectSourced, 2.2);
  assert.equal(F.terrace.projectSourced, 3);
  assert.equal(section.column.standoff, 3.4);

  for (const f of section.faces) {
    const frame = frameOf(f);
    assert.ok(Math.abs(f.roofLength - (frame.length + 2 * f.ext)) < 0.01,
      `${f.id} roofLength is not its measured length plus its extensions`);
    assert.ok(Math.abs(f.cofferPitch - f.roofLength / f.coffers) < 0.01,
      `${f.id} coffer pitch does not divide its roof strip`);
    assert.ok(Math.abs(f.cofferPitch - G.module) < 0.02,
      `${f.id} coffer pitch ${f.cofferPitch} drifts off the ${G.module} module`);
  }
  /* North and south carry the corners; east and west butt into them. */
  const ext = Object.fromEntries(section.faces.map((f) => [f.id, f.ext]));
  assert.ok(ext.north > 0 && ext.south > 0, "north and south must carry the roof round");
  assert.equal(ext.east, 0);
  assert.equal(ext.west, 0);
});

test("the level lines add back up to the measured height", () => {
  const L = section.levels;
  const M = section.measured;
  assert.equal(L.l1BelowRoof, M.lidarHeight, "level 1 is grade, and grade is the measured base");
  assert.ok(Math.abs(L.l2BelowRoof - (L.eavesBelowRoof + L.roofSlab + L.storey)) < 1e-9,
    "the balcony line is one storey below the soffit");
  assert.ok(Math.abs(L.l1BelowRoof - (L.l2BelowRoof + L.storey)) < 1e-9,
    "the two levels have to be the same storey, with no residual");
  assert.ok(L.storey > 5 && L.storey < 9, `a ${L.storey} m storey is not a storey`);
  assert.ok(M.heightNote && M.conflict,
    "the ArcGIS/LiDAR height story has to be written down, resolved or not");
  /* The prose slip this revision fixes: the note may not describe a division
     the levels block does not ship. */
  assert.ok(!/about 7\.4 m/.test(M.heightNote),
    "heightNote described 7.4 m levels while the data shipped 7.675 — fix the prose to the data");
  assert.match(M.heightNote, /7\.675/, "heightNote must state the storey it actually ships");
  /* And the conflict this revision closes. */
  assert.match(M.conflict, /RESOLVED/);
  assert.match(M.conflict, /skylight block/i,
    "which object owns the 16.6 is now derivable and must be named");
});

test("THE ROOF PLATE IS THE RING: nothing reaches past the declared band", () => {
  /* The single largest correction in this revision. The orthophoto measures
     the plate ON the ring; everything outboard is the registration band that
     campus-massing's solid extrusion forces, and it is `wallStandoff +
     roofOut` and not one centimetre more. Straight out from a face the reach
     is the band; off a corner, where the north and south strips run past the
     end of their own wall, it is that band on both axes at once. */
  assert.ok(BAND < 4, `the outboard band is ${BAND.toFixed(2)} m — the retired collar was 12.474`);
  const reach = BAND * Math.SQRT2;
  for (const [x, z] of roofPoints()) {
    const d = toRing(x, z);
    assert.ok(d <= reach + 0.05,
      `the roof reaches ${d.toFixed(2)} m, past its own ${reach.toFixed(2)} m corner`);
  }
  /* And the band has to be declared as a render displacement, in writing, in
     three places — or a later agent reads it as an oversail and grows it. */
  assert.match(D.registrationNote, /REGISTRATION|registration/);
  assert.match(section.conflicts.roofPlate, /62\.4/, "the measured plate size stays on the record");
  assert.match(section.conflicts.roofPlate, /12\.474/, "the retired collar stays named");
  assert.ok(section.absent.some((a) => /OVERSIZE/.test(a)),
    "the residual oversize is an error this section owns");
});

test("the east and west ground furniture is not under the modelled roof", () => {
  /* The bug the retired revision could not see: it laid its own sourced walk,
     DG band, paving and lava wall inside its own 12.5 m roof. Everything
     except the shaded recess directly against the wall must now be clear of
     the roof band, which is what a 2.2 m recess and a walk beyond it means. */
  const eastEdge = Math.max(...RING.map(([x]) => x));
  const westEdge = Math.min(...RING.map(([x]) => x));
  const roofEast = eastEdge + BAND;
  const roofWest = westEdge - BAND;
  assert.ok(section.east.walk[0].x1 > roofEast,
    `the east walk ends at x ${section.east.walk[0].x1} and the roof reaches ${roofEast.toFixed(2)}`);
  for (const r of section.east.dg) {
    assert.ok(r.x0 >= roofEast - 0.01,
      `an east DG rect starts at x ${r.x0}, under the roof at ${roofEast.toFixed(2)}`);
  }
  for (const r of section.east.lawn) {
    assert.ok(r.x0 > roofEast, "the SE lawn must be clear of the roof");
  }
  assert.ok(section.west.lavaWall.a[0] < roofWest,
    `the lava wall stands at x ${section.west.lavaWall.a[0]}, under the roof at ${roofWest.toFixed(2)}`);
  for (const r of section.west.groundcover) {
    assert.ok(r.x1 <= roofWest + 0.01, "the west groundcover must be clear of the roof");
  }
  /* The recess is the one thing that IS under the eaves, and the section may
     no longer claim it is shaded BY them. */
  assert.match(section.east.recessNote, /CORRECTED/);
  assert.ok(!/permanently shaded/.test(section.east.recessNote),
    "a south-east sun cannot shade an east wall — that reading is retired");
});

test("every facade layer clears the ring the renderer actually extrudes", () => {
  let worst = 0;
  for (const f of section.faces) {
    const frame = frameOf(f);
    for (const p of section.drawnRing) {
      const [ax, az] = frame.at(0, 0);
      const [bx, bz] = frame.at(frame.length, 0);
      const tx = (bx - ax) / frame.length;
      const tz = (bz - az) / frame.length;
      const du = (p[0] - ax) * tx + (p[1] - az) * tz;
      if (du < -1 || du > frame.length + 1) continue;
      const [ox, oz] = frame.at(0, 1);
      worst = Math.max(worst, (p[0] - ax) * (ox - ax) + (p[1] - az) * (oz - az));
    }
  }
  assert.ok(Math.abs(section.drawnClearance - worst) < 0.02,
    `drawnClearance says ${section.drawnClearance}, the rings say ${worst.toFixed(3)}`);
  assert.ok(REG > worst,
    `the glazing at ${REG} m is inside the drawn mass, which reaches ${worst.toFixed(2)} m`);
  assert.ok(REG <= worst + 0.3,
    "the glazing hangs as close to the wall as the two surveys allow, and no further");
  assert.ok(section.facade.wallStandoffNote, "a standoff this large has to explain itself");

  for (const [x, z] of facadePoints()) {
    const d = toRing(x, z);
    assert.ok(d >= -0.01, `a facade layer at (${x.toFixed(1)}, ${z.toFixed(1)}) is inside the mass`);
    assert.ok(d <= REG + section.column.standoffBuilt + 0.05,
      `a facade layer stands ${d.toFixed(2)} m proud of the ring`);
  }
});

test("everything sits inside Galbraith's ring plus thirty metres", () => {
  const pts = [
    ...facadePoints(), ...roofPoints(), ...groundSolids(),
    ...["north", "west", "south"].flatMap((k) =>
      [...(section[k].apron || []), ...(section[k].paving || []), ...(section[k].pavers || []),
       ...(k === "south" ? section[k].beds || [] : []),
       ...(section[k].lawn || []), ...(section[k].groundcover || [])]
        .flatMap(rectCorners)),
    /* The three north beds are survey RINGS, not rects (G4). */
    ...section.north.beds.flatMap((b) => b.ring),
  ];
  for (const [x, z] of pts) {
    assert.ok(toRing(x, z) <= 30,
      `(${x.toFixed(1)}, ${z.toFixed(1)}) is ${toRing(x, z).toFixed(1)} m outside the ring`);
  }
  const E = section.east;
  for (const [x, z] of [...E.recess, ...E.walk, ...E.dg, ...E.lawn].flatMap(rectCorners)) {
    assert.ok(toRing(x, z) <= 35,
      `east ground at (${x.toFixed(1)}, ${z.toFixed(1)}) is ${toRing(x, z).toFixed(1)} m outside the ring`);
  }
  /* And the declared bounds must actually bound it. */
  const B = section.bounds;
  for (const [x, z] of [...pts, ...[...E.recess, ...E.walk, ...E.dg, ...E.lawn].flatMap(rectCorners)]) {
    assert.ok(x >= B.x0 - 0.01 && x <= B.x1 + 0.01 && z >= B.z0 - 0.01 && z <= B.z1 + 0.01,
      `(${x.toFixed(1)}, ${z.toFixed(1)}) falls outside the section's declared bounds`);
  }
});

test("nothing invented sits inside a measured building footprint", () => {
  const others = campus.buildings.filter((b) => b.p && b.p.length >= 3 && b.n !== "Galbraith Hall");
  const eastCorners = [...section.east.recess, ...section.east.walk,
    ...section.east.dg, ...section.east.lawn].flatMap(rectCorners);
  for (const [x, z] of [...groundSolids(), ...roofPoints(), ...eastCorners]) {
    for (const b of others) {
      assert.ok(!inRing(x, z, b.p), `(${x.toFixed(1)}, ${z.toFixed(1)}) is inside ${b.n || "an unnamed mass"}`);
    }
  }
  for (const [x, z] of strutFeet()) {
    assert.ok(!inRing(x, z, RING), `a strut at (${x.toFixed(1)}, ${z.toFixed(1)}) is inside the measured mass`);
  }
});

test("no solid object crowds the scooter corridor", () => {
  let worst = Infinity;
  let at2 = null;
  for (const [x, z] of [...groundSolids(), ...facadePoints()]) {
    const d = toRoute(x, z);
    if (d < worst) { worst = d; at2 = [x, z]; }
  }
  assert.ok(worst >= 3,
    `closest solid is ${worst.toFixed(2)} m from the centreline at ${at2.map((v) => v.toFixed(1))}`);
});

/* ------------------------------------------------------------ the roof */

test("the skylight grid solves on the coffer module, centred on the building", () => {
  const R = section.roof;
  assert.ok(R, "the roof block is missing");
  assert.match(R.source, /orthophoto|chunk_4_7/i, "the roof must name the orthophoto it was read off");

  const K = R.skylights;
  assert.equal(K.grid, 9, "9 x 9, counted on the orthophoto");
  assert.ok(Math.abs(K.pitch - 2 * G.module) < 1e-9,
    "the skylight pitch is DERIVED as two coffer modules, not typed");
  assert.ok(K.pitchNote, "the raw 2.7422 m measurement has to be recorded next to the derivation");
  assert.match(K.pitchNote, /2\.7422/);
  assert.ok(K.size >= 1.15 && K.size <= 1.25, `a ${K.size} m skylight is outside the measured 1.15-1.25`);

  /* CENTRED, and on the BUILDING — the retired 0.8/3.6 offset was the camera.
     The polygon centroid of the measured ring, not a number in the file. */
  let A2 = 0, cx = 0, cz = 0;
  for (let i = 0; i < RING.length; i++) {
    const [x1, z1] = RING[i];
    const [x2, z2] = RING[(i + 1) % RING.length];
    const f = x1 * z2 - x2 * z1;
    A2 += f; cx += (x1 + x2) * f; cz += (z1 + z2) * f;
  }
  A2 /= 2; cx /= 6 * A2; cz /= 6 * A2;
  assert.ok(Math.abs(K.centre[0] - cx) < 0.1, "the field is centred on the ring in x");
  assert.ok(Math.abs(K.centre[1] - cz) < 0.1, "the field is centred on the ring in z");
  assert.ok(!/not quite central/.test(K.pitchNote),
    "the invented asymmetry is retired — say so, do not restate it");
  assert.match(K.epochNote, /ORIGINAL|original/,
    "the 1965 fabric finding has to be recorded on the skylights themselves");

  const B = R.block;
  assert.ok(Math.abs(K.centre[0] - (B.x0 + B.x1) / 2) < 0.6, "field roughly centred on its block in x");
  assert.ok(Math.abs(K.centre[1] - (B.z0 + B.z1) / 2) < 0.6, "field roughly centred on its block in z");
  const half = ((K.grid - 1) / 2) * K.pitch + K.size / 2;
  assert.ok(K.centre[0] - half > B.x0 && K.centre[0] + half < B.x1,
    "the skylight field runs off its own block in x");
  assert.ok(K.centre[1] - half > B.z0 && K.centre[1] + half < B.z1,
    "the skylight field runs off its own block in z");
  for (const [x, z] of rectCorners(B)) {
    assert.ok(inRing(x, z, RING), `block corner (${x}, ${z}) is outside the measured ring`);
  }
  /* Every roof rect carries the SAME displacement correction, or the frame is
     being read two ways at once. */
  assert.ok(Math.abs(R.displacement.x) > 0.1 && Math.abs(R.displacement.z) > 1,
    "the top displacement is the whole reason these positions moved");
  assert.match(R.displacement.note, /displacement/i);
});

test("the roofscape never stacks its estimated heights on the LiDAR maximum", () => {
  const R = section.roof;
  assert.ok(R.block.height >= 1.5 && R.block.height <= 2.5,
    "the block height stays inside the declared [estimated] 1.5-2.5 m band");
  assert.match(R.block.heightNote, /\[estimated\]/, "the block height must say it is estimated");
  assert.match(R.datumNote, /MAXIMUM|maximum/,
    "the datum note must say LiDAR 16.6 is a maximum return");
  assert.match(R.datumNote, /double-count/i,
    "the datum note must name the double-counting this rule prevents");
  /* The shadow correction. The datum note may no longer claim no shadow is
     measurable, because one is. */
  assert.ok(!/casts no measurable shadow/.test(R.datumNote + R.block.revealNote),
    "the shadow exists — the retired claim that it does not may not survive anywhere");
  assert.match(R.block.revealNote, /north and west/i,
    "the band's real asymmetry has to be recorded");
  for (const [k, v] of [["skylight curb", R.skylights.curb],
    ["block rim", R.block.rim.curb],
    ["penthouse expression", R.penthouseExpression],
    ["mech expression", R.mechExpression]]) {
    assert.ok(v > 0 && v <= 0.5, `${k} at ${v} m is not curb-scale relief`);
  }
});

test("penthouses and mech units sit at their corrected positions, inside the ring", () => {
  const R = section.roof;
  assert.equal(R.penthouses.length, 3, "three penthouses, counted on the orthophoto");
  assert.equal(R.mech.length, 6, "six mech enclosures, counted on the orthophoto");
  for (const r of [...R.penthouses, ...R.mech]) {
    assert.ok(r.x1 > r.x0 && r.z1 > r.z0, "degenerate roof rect");
    for (const [x, z] of rectCorners(r)) {
      assert.ok(toRing(x, z) <= 0.9,
        `roof unit corner (${x}, ${z}) stands ${toRing(x, z).toFixed(1)} m off the roof it sits on`);
    }
    const B = R.block;
    const overlap = r.x0 < B.x1 && r.x1 > B.x0 && r.z0 < B.z1 && r.z1 > B.z0;
    assert.ok(!overlap, `a roof unit overlaps the skylight block`);
  }
  const south = R.penthouses.find((p) => p.top === "penthouseMetal");
  assert.ok(south && south.z0 > (R.block.z0 + R.block.z1) / 2,
    "the metal-roofed penthouse is the south one");
});

/* ------------------------------------------------------- the east ground */

test("the east ground is built to the construction line and not a metre past it", () => {
  const E = section.east;
  assert.ok(E, "the east ground block is missing");
  assert.match(E.source, /orthophoto|chunk_4_7/i, "the east ground must name the orthophoto");
  assert.match(E.source, /\d{4}/, "east ground has no dated source");
  assert.ok(E.constructionNote && /x ?~ ?90|x ?≈ ?90/.test(E.constructionNote),
    "the construction epoch limit at x ~90 has to be declared");
  assert.match(E.constructionNote, /CENTRAL UTILITIES PLANT/i,
    "the construction has a name, a date and an architect — use them");

  const recess = E.recess[0];
  const walk = E.walk[0];
  const dg = E.dg[0];
  for (const r of E.dg) {
    assert.ok(r.x1 <= 89.5, `a DG rect reaches x ${r.x1}, past the construction line`);
  }
  assert.ok(Math.abs((recess.x1 - recess.x0) - 2.2) < 0.25, "the shaded recess is ~2.2 m");
  assert.ok(Math.abs((walk.x1 - walk.x0) - 3.1) < 0.25, "the walk is ~3.1 m");
  assert.ok(Math.abs(recess.x0 - 54.7) < 0.15, "the recess starts at the measured east edge");
  assert.equal(walk.x0, recess.x1, "the walk butts the recess");
  assert.equal(dg.x0, walk.x1, "the DG band butts the walk");
  for (const r of [...E.recess, ...E.walk]) {
    assert.ok(r.z0 <= 429.4 && r.z1 >= 491.1, "recess and walk must run the full length");
  }
  for (const r of E.lawn) {
    assert.ok(r.x1 <= 89.5 && r.z1 <= 505.1, "the lawn stays inside its measured patch");
  }
  assert.ok(E.footPads && E.footPads.size >= 1.0 && E.footPads.size <= 1.4,
    "foot pads at the measured 1.0-1.4 m");
  assert.ok(E.footPadNote && /10\.83|11-12/.test(E.footPadNote),
    "the pad-spacing tension with the orthophoto has to be recorded");
});

test("the east elevation is unsourced, and it is LABELLED unsourced", () => {
  /* The ultra-standard breach the retired revision shipped silently: the face
     claimed a feature set with no frame behind it and no [estimated] label.
     The ladder was walked on 2026-08-20 and every rung failed, so the fix is
     to label it and record the ladder — not to invent a west-face terrace. */
  const east = section.faces.find((f) => f.id === "east");
  assert.equal(east.sourced, false, "there is still no photograph of the east elevation");
  assert.ok(east.sourcedNote && east.sourcedNote.length > 150,
    "an unsourced face must record which sourced pattern it extends");
  assert.match(east.sourcedNote, /\[estimated\]/);
  const ladder = section.absent.find((a) => /EAST ELEVATION IS UNSOURCED/.test(a));
  assert.ok(ladder, "the east elevation must be in absent");
  for (const rung of [/PHOTOGRAPH/i, /STREET VIEW/i, /DRONE/i, /PLANNING DOCS/i, /ARCHIVES/i]) {
    assert.match(ladder, rung, `the ultra ladder's ${rung} rung is not recorded`);
  }
  assert.match(ladder, /oceanlight-21219/,
    "the three previously unmined frames were mined; say what they turned out to be");

  /* The features themselves: north's pattern, and nothing invented on top. */
  assert.equal(east.entry, false);
  assert.equal(east.terrace, false);
  assert.equal(east.lowerColonnade, false);
  assert.equal(east.flutedWall, false);
  assert.equal(east.redBand, false);
  assert.equal(east.colonnade, true);
  /* The red stripe is a SOUTH-AND-WEST band, not a west-face one. Visual
     round-2 finding 3 was that it died at the south-west arris; oceanlight-
     21225.jpg and -12848.jpg photograph that arris and show one continuous
     band turning it, and -21220.jpg carries the same stripe along the whole
     south terrace edge. The north and east faces have no terrace to carry it
     and must still not have the band. */
  assert.deepEqual(section.faces.filter((f) => f.redBand).map((f) => f.id), ["south", "west"]);
  const southFace = section.faces.find((f) => f.id === "south");
  assert.ok(southFace.redBandSource && southFace.redBandSource.length > 200,
    "a face that gained a feature must name the frames that gave it");
  for (const frame of [/oceanlight-21225\.jpg/, /oceanlight-12848\.jpg/, /oceanlight-21220\.jpg/]) {
    assert.match(southFace.redBandSource, frame);
  }
  /* And the thing those same frames REFUSE: the buff panel infill does not
     turn the arris. Only the framing does. */
  assert.match(southFace.redBandSource, /flutedWall\) does NOT turn the arris/);
  assert.deepEqual(section.faces.filter((f) => f.flutedWall).map((f) => f.id), ["west"]);
});

test("every ground group names a dated source", () => {
  for (const k of ["north", "west", "south"]) {
    assert.match(section[k].source, /\d{4}/, `${k} ground has no dated source`);
  }
  assert.match(G.source, /\d{2}\.\d{2}\.\d{2}/, "the grid must name the plan sheet");
  /* The west's citation is dead and the section has to say so rather than
     quietly substitute a live URL for a frame it does not carry. */
  assert.match(section.west.source, /DEAD/);
});

/* ------------------------------------------- the module, actually running */

const flatGround = () => 10;
const build = (g = flatGround) =>
  createPhotoGalbraith(null, { photo, heightAt: g, surfaceAt: g });

test("the declared counts are what the module actually builds", () => {
  const { counts } = build();
  const declared = section.counts;
  assert.ok(declared, "a section at this bar declares its own counts");
  for (const [k, v] of Object.entries(declared)) {
    if (k === "note") continue;
    assert.equal(counts[k], v, `counts.${k} declares ${v} but the module builds ${counts[k]}`);
  }
  assert.equal(counts.skylights, section.roof.skylights.grid ** 2);
  assert.equal(counts.struts, 2 * G.pairsPerFace * section.faces.length);
  assert.equal(counts.eastPads, G.pairIndices.length);
  assert.equal(counts.absent, section.absent.length);
});

test("the module builds the roofscape and the east ground it declares", () => {
  const { group, counts } = build();
  assert.ok(counts.eastRects >= 4, "recess, walk, DG and lawn at minimum");
  assert.ok(group.children.find((c) => c.name === "galbraith-roof"), "no roof group");
  assert.ok(group.children.find((c) => c.name === "galbraith-east-ground"), "no east ground group");
});

test("a missing section is harmless, and a stale one is loud", () => {
  const empty = createPhotoGalbraith(null, { photo: {}, heightAt: flatGround });
  assert.deepEqual(empty.counts, {});
  assert.ok(empty.group);
  assert.throws(() => createPhotoGalbraith(null, { photo }), /surfaceAt|heightAt/);
  /* The module and its section are one unit: a pre-R1 document would not
     degrade, it would build a different building. It must say so, and it must
     name the file that fixes it. */
  const stale = { galbraith: { ...section, draw: undefined } };
  assert.throws(
    () => createPhotoGalbraith(null, { photo: stale, heightAt: flatGround, surfaceAt: flatGround }),
    /merge\/r1\/galbraith\.json/);
});

test("the roofscape seats on the drawn box top and stays curb-scale above it", () => {
  const { group } = build();
  const roofY = flatGround() + section.measured.lidarHeight;
  const roof = group.children.find((c) => c.name === "galbraith-roof");
  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const checkY = (y, h, what) => {
    assert.ok(y - h / 2 >= roofY - 0.01, `${what} dips ${(roofY - y + h / 2).toFixed(2)} m into the box`);
    assert.ok(y + h / 2 <= roofY + 0.5, `${what} stands ${(y + h / 2 - roofY).toFixed(2)} m over the LiDAR maximum`);
  };
  let seen = 0;
  roof.traverse((o) => {
    if (o.isInstancedMesh) {
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m);
        m.decompose(pos, q, sc);
        const h = o.geometry.type === "PlaneGeometry"
          ? 0
          : (o.geometry.parameters?.height ?? 1) * sc.y;
        checkY(pos.y, h, `roof instance of ${o.geometry.type}`);
        seen++;
      }
    } else if (o.isMesh) {
      const h = o.geometry.parameters?.height ?? 0;
      checkY(o.position.y, h, "a roof mesh");
      seen++;
    }
  });
  assert.ok(seen > 81, `only ${seen} roof objects sampled`);
});

test("the east ground lies on the drawn terrain, and the corridor gains nothing solid", () => {
  const { group } = build();
  const east = group.children.find((c) => c.name === "galbraith-east-ground");
  east.traverse((o) => {
    if (o.isMesh && !o.isInstancedMesh) {
      assert.ok(Math.abs(o.position.y - flatGround()) < 0.5,
        `an east decal floats ${(o.position.y - flatGround()).toFixed(2)} m over the ground`);
      assert.equal(o.geometry.type, "PlaneGeometry", "east ground is decals only — nothing to hit");
    }
  });
});

/**
 * THE THREE SURFACES. Flat ground hides every draping bug; an exaggerated
 * slope catches the ones a gentle one does not; and the REAL drawn LiDAR
 * surface is the one the site actually stands on — the west court spans
 * 23.5-26.9 m across it and the south lawn 24.3-27.1.
 */
const drawnSurface = makeSurfaceSampler(lidar.terrain);
const surfaces = () => [
  ["flat", flatGround],
  ["exaggerated slope", (x, z) => 10 + 2 * Math.sin(x / 18) + 1.5 * Math.cos(z / 23)],
  ["drawn LiDAR surface", drawnSurface],
];

test("the real drawn surface under this site is not flat", () => {
  /* The gate that keeps the third surface honest: if the drawn ground under
     Galbraith were flat, running on it would prove nothing. */
  const ys = [];
  for (let x = -26; x <= 89; x += 4) for (let z = 415; z <= 516; z += 4) ys.push(drawnSurface(x, z));
  const span = Math.max(...ys) - Math.min(...ys);
  assert.ok(span > 3, `the drawn surface here spans only ${span.toFixed(2)} m — re-read this test`);
});

test("ground decals are draped over every surface, not seated at one centre height", () => {
  for (const [name, ground] of surfaces()) {
    const { group } = build(ground);
    group.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    let decals = 0;
    let verts = 0;
    group.traverse((o) => {
      if (!o.isMesh || (o.name !== "ground-decal" && o.name !== "ground-joints")) return;
      decals++;
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        const dy = v.y - ground(v.x, v.z);
        assert.ok(dy > -0.02 && dy < 0.3,
          `on the ${name}, ${o.name} vertex at (${v.x.toFixed(1)}, ${v.z.toFixed(1)}) sits ${dy.toFixed(2)} m off the terrain`);
        verts++;
      }
    });
    assert.ok(decals >= 15, `only ${decals} draped ground meshes on the ${name}`);
    assert.ok(verts > 2000, `only ${verts} draped vertices checked on the ${name}`);
  }
});

test("nothing hovers and nothing sinks at any footing, on any surface", () => {
  /* Every solid this section seats on the ground: strut feet, lower-colonnade
     columns, lava-wall segments, railing posts, bins, planting. Each one's
     BOTTOM must sit on the surface it was handed, not on a level line. */
  /* The re-skin meshes are now named per species, because the species table
     gives each one its own bark hue and one shared material repainted every
     stem with whichever species the build ended on. Match the ROLE prefix. */
  const isRole = (n, role) => typeof n === "string" && n.startsWith(`galbraith-${role}`);
  for (const [name, ground] of surfaces()) {
    const { group } = build(ground);
    group.updateMatrixWorld(true);
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    let checked = 0;
    group.traverse((o) => {
      if (!o.isInstancedMesh || !isRole(o.name, "tree-boles")) return;
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m);
        m.decompose(p, q, s);
        const foot = p.y - s.y / 2;
        const dy = foot - ground(p.x, p.z);
        assert.ok(Math.abs(dy) < 0.06,
          `on the ${name}, a ${o.name} instance stands ${dy.toFixed(2)} m off the ground`);
        checked++;
      }
    });
    assert.ok(checked > 0, `no seated instances found on the ${name}`);

    /* The struts are the load-bearing case: a lathe scaled from its own foot. */
    let struts = 0;
    group.traverse((o) => {
      if (!o.isInstancedMesh || o.geometry.type !== "LatheGeometry") return;
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m);
        m.decompose(p, q, s);
        const dy = p.y - ground(p.x, p.z);
        assert.ok(Math.abs(dy) < 0.06,
          `on the ${name}, a strut foot stands ${dy.toFixed(2)} m off the ground`);
        struts++;
      }
    });
    assert.equal(struts, section.counts.struts, `only ${struts} strut feet on the ${name}`);
  }
});

test("nothing crosses a surveyed facade", () => {
  /* Every solid instance's plan footprint has to stay outboard of the measured
     ring: the mass is a solid extrusion of it and anything inside is buried,
     and anything that straddles the line cuts through the wall. Ground decals
     are exempt — they lie under it. */
  const { group } = build();
  group.updateMatrixWorld(true);
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  let checked = 0;
  group.traverse((o) => {
    if (!o.isInstancedMesh || o.geometry.type === "PlaneGeometry") return;
    if (typeof o.name === "string" && o.name.startsWith("galbraith-canopy-lobes")) return; // its own gate, below
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m);
      m.decompose(p, q, s);
      /* Roof-top relief lives above the box and inside the ring by design. */
      if (p.y > flatGround() + section.measured.lidarHeight - 0.5) continue;
      const d = toRing(p.x, p.z);
      assert.ok(d > -0.05,
        `a ${o.geometry.type} instance at (${p.x.toFixed(1)}, ${p.z.toFixed(1)}) is ${(-d).toFixed(2)} m inside the surveyed facade`);
      checked++;
    }
  });
  assert.ok(checked > 500, `only ${checked} solid instances checked`);
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
  const src = readFileSync(join(root, "docs/js/campus-photo-galbraith.js"), "utf8");
  for (const banned of ["Math.random", "Date.now", "performance.now", "TextureLoader"]) {
    assert.ok(!src.includes(banned), `${banned} has no place in a reproducible builder`);
  }
  /* Irregularity comes from the section's own pinned seed and nothing else. */
  assert.ok(src.includes("section.seed"), "the builder must hash from the section's pinned seed");
});

test("the curtain wall is a near-opaque dark surface, not a tint over the massing", () => {
  const { group } = build();
  let curtain = 0;
  group.traverse((o) => {
    if (o.isInstancedMesh && o.geometry.type === "PlaneGeometry" &&
        o.material.transparent && o.material.opacity >= 0.9) {
      assert.ok(o.material.depthWrite, "a near-opaque pane must write depth to occlude the massing");
      curtain += o.count;
    }
  });
  assert.ok(curtain >= 5, `only ${curtain} near-opaque curtain-wall panes — the massing shows through`);
});

test("tree re-skins carry measured rows verbatim and keep the canopy clear of the slab", () => {
  const T = section.treeOverrides;
  assert.ok(T, "the NE tree still stands under the roof band and still needs its re-skin");
  for (const it of T.items) {
    const row = lidar.trees.find((r) => `${r[0]},${r[1]}` === it.key);
    assert.ok(row, `treeOverrides item ${it.key} names no measured trunk`);
    assert.deepEqual([it.x, it.z, it.h, it.r], row,
      `treeOverrides item ${it.key} does not copy its measured row verbatim`);
    /* The reason has to be argued against the band this revision ships, not
       against the collar it retired — and it has to name the plane the crown
       is cut on, because that is now a per-item choice and an unstated one
       would silently take the roof soffit. */
    assert.ok(!/12\.5 m/.test(it.why), "the 12.5 m oversail no longer exists — re-derive the prune");
    assert.match(it.why, /soffit|balcony/i, `${it.key} does not say which plane prunes it`);
    if (it.ceiling !== undefined) {
      assert.equal(it.ceiling, "balcony", `${it.key} names a ceiling this module cannot resolve`);
      assert.match(it.why, /BALCONY soffit/,
        `${it.key} is cut on the balcony and must argue for that, not for the roof`);
    } else {
      assert.match(it.why, /RE-DERIVED/);
    }
  }
  /* The mid-east stem is the one visual round-2 finding 4 named. It is a
     MEASURED trunk, so the only admissible fix was a re-skin — nothing here
     may have moved it. */
  const mid = T.items.find((i) => i.key === "55.9,455.2");
  assert.ok(mid, "the mid-east trunk that stood inside the facade is not re-skinned");
  assert.equal(mid.ceiling, "balcony");
  assert.ok(T.skipMeasuredKeys.includes("55.9,455.2"),
    "a re-skinned stem the blob renderer still draws is the same tree twice");
  assert.deepEqual(
    [...T.skipMeasuredKeys].sort(), T.items.map((i) => i.key).sort(),
    "every skipped measured trunk must be re-skinned, and nothing else may be skipped");
  assert.match(T.note, /INVENTED/, "the canopy re-shape must declare its class");
  assert.ok(T.wiringNote, "the walk/scooter skip-set wiring dependency has to be written down");

  const { group, counts } = build();
  assert.equal(counts.reskinnedTrees, T.items.length);
  const roofY = flatGround() + section.measured.lidarHeight;
  const soffitY = roofY - section.levels.soffitBelowRoof;
  /* The ceiling is now PER ITEM, and the balcony one is eleven metres lower
     than the roof soffit: a single roof-soffit cap would pass a crown that
     sits inside the level-2 deck, which is exactly the defect the second
     re-skin was added to fix. */
  const capOf = (it) => (it.ceiling === "balcony"
    ? roofY - section.levels.l2BelowRoof - section.facade.balcony.deck
    : soffitY) - T.clearBelowSoffit;
  const cap = Math.max(...T.items.map(capOf));
  const sub = group.children.find((c) => c.name === "galbraith-tree-reskins");
  assert.ok(sub, "no re-skin group built");

  /* One mesh set PER SPECIES, gathered by role prefix. Two stems of different
     species may not share a bark or a leaf material: `instanced` carries only
     a per-instance VALUE, so one shared set repaints the other species. */
  const byRole = (role) => {
    const found = sub.children.filter((o) => o.name.startsWith(`galbraith-${role}`));
    assert.ok(found.length, `no galbraith-${role} mesh`);
    return found;
  };
  const speciesSeen = new Set(T.items.map((i) => treeSpecies(i.x, i.z, i.h, i.r)));
  for (const role of ["tree-boles", "tree-limbs", "canopy-lobes"]) {
    assert.equal(byRole(role).length, speciesSeen.size,
      `${role} must be one mesh per species, not one for the set`);
  }
  const lobeMeshes = byRole("canopy-lobes");
  const boleMeshes = byRole("tree-boles");
  /* A single facade for the gates below, which only ever read `count` and the
     instance matrices. */
  const merge = (meshes) => ({
    count: meshes.reduce((t, m) => t + m.count, 0),
    material: {
      map: meshes.every((m) => m.material.map) || null,
      normalMap: meshes.every((m) => m.material.normalMap) || null,
    },
    instanceColor: meshes.every((m) => m.instanceColor) ? true : null,
    getMatrixAt(i, out) {
      for (const m of meshes) {
        if (i < m.count) return m.getMatrixAt(i, out);
        i -= m.count;
      }
      throw new RangeError("index past the merged instance count");
    },
  });
  const lobes = merge(lobeMeshes);
  const boles = merge(boleMeshes);

  sub.traverse((o) => {
    assert.notEqual(o.geometry?.type, "IcosahedronGeometry",
      "a single flat-shaded dome is the placeholder this replaced");
  });
  assert.equal(counts.canopyLobes, lobes.count);
  assert.ok(lobes.count >= 6 * T.items.length,
    `${lobes.count} lobes for ${T.items.length} trees — that is a dome, not a canopy`);
  assert.ok(lobes.instanceColor, "lobes must carry per-instance tone or the mass reads flat");

  const rows = (mesh) => {
    const out = [];
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const m = new THREE.Matrix4();
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, m);
      m.decompose(p, q, s);
      out.push({ x: p.x, y: p.y, z: p.z, sx: s.x, sy: s.y, sz: s.z });
    }
    return out;
  };

  for (const l of rows(lobes)) {
    assert.ok(l.y + l.sy <= cap + 0.01,
      `a canopy lobe tops out at ${(l.y + l.sy).toFixed(2)}, into the soffit at ${soffitY.toFixed(2)}`);
  }

  assert.ok(boles.material.map && boles.material.normalMap, "the bole carries no bark texture");
  for (const b of rows(boles)) {
    assert.ok(Math.abs((b.y - b.sy / 2) - flatGround()) < 0.05,
      `a bole starts ${(b.y - b.sy / 2 - flatGround()).toFixed(2)} m off the ground`);
    assert.ok(b.sy > 3, "a bole that short is a stump, not a trunk");
  }

  for (const it of T.items) {
    let bx = 1;
    let bz = 0;
    let best = Infinity;
    for (const [cx, cz] of section.ring) {
      const d = Math.hypot(it.x - cx, it.z - cz);
      if (d < best && d > 1e-6) { best = d; bx = (it.x - cx) / d; bz = (it.z - cz) / d; }
    }
    const mine = rows(lobes).filter((l) => Math.hypot(l.x - it.x, l.z - it.z) < it.r * 3);
    const cx = mine.reduce((s, l) => s + l.x, 0) / mine.length;
    const cz = mine.reduce((s, l) => s + l.z, 0) / mine.length;
    assert.ok((cx - it.x) * bx + (cz - it.z) * bz > 0.2,
      "the canopy is centred on its trunk — the prune away from the slab is not expressed");
    /* And THIS stem's own ceiling, not the loosest of the two. */
    for (const l of mine) {
      assert.ok(l.y + l.sy <= capOf(it) + 0.01,
        `${it.key} tops out at ${(l.y + l.sy).toFixed(2)} against its own cap ${capOf(it).toFixed(2)}`);
    }
  }

  const faceOut = REG + D.pierProud;
  for (const l of rows(lobes)) {
    const reach = Math.max(l.sx, l.sz);
    const d = toRing(l.x, l.z);
    assert.ok(d - reach >= faceOut,
      `a canopy lobe's surface reaches to ${(d - reach).toFixed(2)} m off the ring, inside the facade at ${faceOut.toFixed(2)}`);
  }

  /* EVERY species wears ITS OWN hex. Checked per mesh and not once for the
     set: the set used to share one bark and one leaf material taken from
     whichever species the build loop ended on, which was invisible while one
     stem was re-skinned and repainted a broadleaf as a eucalyptus the moment
     a second arrived. */
  for (const [meshes, field, what] of [
    [boleMeshes, "trunk", "bark"],
    [lobeMeshes, "leaf", "leaf"],
  ]) {
    for (const mesh of meshes) {
      const species = mesh.name.slice(mesh.name.lastIndexOf("-") + 1);
      assert.ok(SPECIES[species], `${mesh.name} is named for no species in the table`);
      const hex = SPECIES[species][field];
      const want = new THREE.Color(hex);
      const got = mesh.material.color;
      for (const ch of ["r", "g", "b"]) {
        assert.ok(Math.abs(got[ch] - want[ch]) <= want[ch] * 0.25 + 0.02,
          `${species}'s ${what} is ${got[ch].toFixed(3)} against its own species hex ${hex} at ${want[ch].toFixed(3)}`);
      }
    }
  }
});

test("the material library is actually on the surfaces", () => {
  const { group } = build();
  let textured = 0;
  let glass = 0;
  group.traverse((o) => {
    if (o.isMesh && o.material) {
      if (o.material.map && o.material.normalMap && o.material.roughnessMap) textured++;
      if (o.material.transparent && o.material.opacity < 1 && o.material.envMapIntensity > 1) glass++;
    }
  });
  assert.ok(textured >= 20, `only ${textured} textured meshes — the library is not applied`);
  assert.ok(glass >= 2, "the glazing does not carry the library's reflective glass");
});

test("the corners are solid end panels, not the massing box's window grid", () => {
  const { group, counts } = build();
  const piers = group.children.find((c) => c.name === "galbraith-corner-piers");
  assert.ok(piers, "no corner piers built");
  assert.equal(counts.cornerPiers, section.faces.length, "one pier per ring corner");
  assert.equal(piers.count, section.faces.length);

  assert.ok(!piers.material.transparent, "an end PANEL is solid, not glazed");
  assert.equal(new THREE.Color(section.colors.glass).getHexString(),
    piers.material.color.getHexString(),
    "the pier must wear the curtain wall's own sampled bronze, not a new hex");

  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  const m = new THREE.Matrix4();
  const boxes = [];
  for (let i = 0; i < piers.count; i++) {
    piers.getMatrixAt(i, m);
    m.decompose(pos, quat, scl);
    const r = new THREE.Euler().setFromQuaternion(quat, "YXZ").y;
    const ex = [Math.cos(r), -Math.sin(r)];
    const ez = [Math.sin(r), Math.cos(r)];
    const c = [];
    for (const a of [-0.5, 0.5]) {
      for (const b of [-0.5, 0.5]) {
        c.push([pos.x + ex[0] * scl.x * a + ez[0] * scl.z * b,
                pos.z + ex[1] * scl.x * a + ez[1] * scl.z * b]);
      }
    }
    boxes.push({ corners: c, y0: pos.y - scl.y / 2, y1: pos.y + scl.y / 2 });
  }

  const covers = (b, x, z) => {
    const q = [b.corners[0], b.corners[1], b.corners[3], b.corners[2]];
    let sign = 0;
    for (let i = 0; i < 4; i++) {
      const [ax, az] = q[i];
      const [bx, bz] = q[(i + 1) % 4];
      const s = Math.sign((bx - ax) * (z - az) - (bz - az) * (x - ax));
      if (s === 0) continue;
      if (sign === 0) sign = s;
      else if (s !== sign) return false;
    }
    return true;
  };

  for (const [cx, cz] of RING) {
    const near = section.drawnRing.filter(([x, z]) => Math.hypot(x - cx, z - cz) <= 1.5);
    assert.ok(near.length, `no drawn vertex turns the corner at (${cx}, ${cz})`);
    for (const [x, z] of near) {
      assert.ok(boxes.some((b) => covers(b, x, z)),
        `the drawn massing corner (${x}, ${z}) is not covered by any pier`);
    }
  }

  const glassOut = REG + D.glassOffset;
  for (const f of section.faces) {
    const frame = frameOf(f);
    const [ox, oz] = frame.at(0, 0);
    const [nx, nz] = [frame.at(0, 1)[0] - ox, frame.at(0, 1)[1] - oz];
    for (const end of [0, frame.length]) {
      const [ex, ez] = frame.at(end, 0);
      const near = boxes
        .map((b) => ({ b, d: Math.min(...b.corners.map(([x, z]) => Math.hypot(x - ex, z - ez))) }))
        .sort((a, c) => a.d - c.d)[0].b;
      const reach = Math.max(...near.corners.map(([x, z]) => (x - ox) * nx + (z - oz) * nz));
      assert.ok(reach >= glassOut,
        `the ${f.id} face's pier reaches ${reach.toFixed(2)} m, inside its own glass at ${glassOut}`);
    }
  }

  const roofY = flatGround() + section.measured.lidarHeight;
  for (const b of boxes) {
    assert.ok(b.y0 <= flatGround(), `a pier starts ${b.y0.toFixed(2)} m above the ground`);
    assert.ok(b.y1 >= roofY - section.levels.soffitBelowRoof,
      `a pier tops out at ${b.y1.toFixed(2)}, short of the soffit`);
  }
});

/** How far the DRAWN mass stands outside this one face of the OSM ring. */
function drawnClearanceOf(f) {
  const frame = frameOf(f);
  const [ax, az] = frame.at(0, 0);
  const [bx, bz] = frame.at(frame.length, 0);
  const tx = (bx - ax) / frame.length;
  const tz = (bz - az) / frame.length;
  const [ox, oz] = frame.at(0, 1);
  let worst = 0;
  for (const [px, pz] of section.drawnRing) {
    const du = (px - ax) * tx + (pz - az) * tz;
    if (du < -1 || du > frame.length + 1) continue;
    worst = Math.max(worst, (px - ax) * (ox - ax) + (pz - az) * (oz - az));
  }
  return worst;
}

test("every glazing band has an opaque backing between it and the massing", () => {
  const { group, counts } = build();
  const back = group.children.find((c) => c.name === "galbraith-glass-backing");
  assert.ok(back, "no glazing backing built");

  const panes = [];
  group.traverse((o) => {
    if (o.isInstancedMesh && o.geometry.type === "PlaneGeometry" &&
        o.material.transparent && o.material.opacity >= 0.9) panes.push(o);
  });
  const paneCount = panes.reduce((n, o) => n + o.count, 0);
  assert.equal(counts.glassBackings, paneCount,
    `${paneCount} near-opaque panes but ${counts.glassBackings} backings`);
  assert.equal(back.count, paneCount);

  assert.ok(!back.material.transparent, "the backing is what the glass is seen against — it must be opaque");
  assert.equal(new THREE.Color(section.colors.glassLower).getHexString(),
    back.material.color.getHexString(),
    "the backing must use a tone the section already samples, not a new hex");

  const rows = (mesh) => {
    const out = [];
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const m = new THREE.Matrix4();
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, m);
      m.decompose(p, q, s);
      out.push({ x: p.x, y: p.y, z: p.z, w: s.x, h: s.y });
    }
    return out;
  };
  const backs = rows(back);
  const glass = panes.flatMap(rows);

  for (const f of section.faces) {
    const frame = frameOf(f);
    const [ox, oz] = frame.at(0, 0);
    const [nx, nz] = [frame.at(0, 1)[0] - ox, frame.at(0, 1)[1] - oz];
    const off = (r) => (r.x - ox) * nx + (r.z - oz) * nz;
    const along = (r) => {
      const [bx, bz] = frame.at(frame.length, 0);
      const u = ((r.x - ox) * (bx - ox) + (r.z - oz) * (bz - oz)) / frame.length;
      return u >= -1 && u <= frame.length + 1;
    };
    const clear = drawnClearanceOf(f);
    const mine = backs.filter((r) => along(r) && Math.abs(off(r) - (REG + D.glassOffset)) < 1);
    for (const b of mine) {
      const d = off(b);
      assert.ok(d > clear,
        `the ${f.id} backing sits at ${d.toFixed(2)} m, inside its own drawn mass at ${clear.toFixed(2)}`);
      assert.ok(d < REG + D.glassOffset,
        `the ${f.id} backing at ${d.toFixed(2)} m is not behind its glass`);
      const pane = glass.find((g) => along(g) && Math.abs(g.y - b.y) < 0.35 &&
        Math.abs(off(g) - (REG + D.glassOffset)) < 0.2);
      assert.ok(pane, `a ${f.id} backing at y ${b.y.toFixed(1)} covers no pane`);
      assert.ok(off(pane) > d, "the glass must stand outboard of its own backing");
      assert.ok(b.w >= pane.w - 0.01 && b.h >= pane.h - 0.01,
        `the ${f.id} backing is smaller than the pane it hides`);
    }
  }

  const east = section.faces.find((f) => f.id === "east");
  const west = section.faces.find((f) => f.id === "west");
  assert.ok(drawnClearanceOf(east) > drawnClearanceOf(west) + 0.4,
    "if the faces ever agree, the per-face depth stops being load-bearing — re-read this test");
});

/* ==================================================================== S1
 * THE AXIOM LAYER. R1 gated the FIGURES and every audit reproduced them by
 * hand — and the layer underneath went unchecked, so a reading could be moved
 * and every figure downstream re-derived consistently around the move. All
 * four of this section's mutation-test survivors were readings. These six
 * gates are the R2 arbitration's answer, and every one of them is a
 * TIGHTENING: if galbraith cannot pass, galbraith is wrong.
 * ================================================================== */

/** The measured ring's own arithmetic — the external truth the ring readings
 *  are pinned to. Computed here from campus-3d.json, never read from the
 *  section. */
const ringTruth = (() => {
  let A2 = 0, cx = 0, cz = 0, per = 0;
  for (let i = 0; i < RING.length; i++) {
    const [x1, z1] = RING[i];
    const [x2, z2] = RING[(i + 1) % RING.length];
    const f = x1 * z2 - x2 * z1;
    A2 += f; cx += (x1 + x2) * f; cz += (z1 + z2) * f;
    per += Math.hypot(x2 - x1, z2 - z1);
  }
  A2 /= 2;
  return { centroidX: cx / (6 * A2), centroidZ: cz / (6 * A2), meanFaceLength: per / 4 };
})();

/* S1(iii). Every reading pinned to a LITERAL in this file, against the
   artefact it claims to come from. The literal lives here so moving the
   reading in the document moves it away from its pin.

   THE ACCEPTANCE TEST FOR THIS WHOLE ITEM is `kda.rowPairToPair`. It shipped
   as 172.6 px — an interval that appears nowhere on KdA_4613_L2_OPTC.jpg,
   whose row bubbles contain only 53.5, 187.6 and 241.1 — and sixty gates
   passed on it. With this pin it cannot be 172.6 at all. */
const KDA = "KdA_4613_L2_OPTC.jpg, native 2000 x 1429, bubble centres re-measured in the R2 arbitration";
const OL = "oceanlight-21220.jpg / oceanlight-21220-strut-band.png, the near-orthographic south elevation";
const ORTHO = "docs/data/textures/chunk_4_7.jpg, the repo's own Google orthophoto at 0.125 m/px, generated 2026-08-04";
const RINGSRC = "docs/data/campus-3d.json buildings 'Galbraith Hall' p, the MEASURED OSM ring, recomputed in this test";
const PHOTOS = "oceanlight-21220/-21225/-12848 and dc-bb4438071r_2.jpg, read against the measured 16.6 m grade-to-roof";
const PINS = {
  "px.faceRun": { value: 1800, tol: 5, truth: OL },
  "px.pairSpacing": { value: 410, tol: 5, truth: OL },
  "px.endInset": { value: 80, tol: 3, truth: OL },
  "px.pairGapCentre": { value: 145, tol: 5, truth: `${OL} — HEAD height on a leaning pair, not a grid ratio` },
  "px.pairSpacingCentre": { value: 460, tol: 5, truth: `${OL} — HEAD height on a leaning pair, not a grid ratio` },
  "px.coffersAcrossFace": { value: 46, tol: 0, truth: OL },
  "kda.alPairGap": { value: 53.7, tol: 0.4, truth: `${KDA}: column pair gaps 53.0/53.5/54.0/54.0/54.0, mean 53.7` },
  "kda.alPairToPair": { value: 241.0, tol: 0.4, truth: `${KDA}: column pair-to-pair 241.0 x4` },
  "kda.rowPairGap": { value: 53.5, tol: 0.4, truth: `${KDA}: row pair gaps 53.5/53.0/54.0/53.5/53.5, mean 53.5` },
  "kda.rowPairToPair": { value: 241.1, tol: 0.4, truth: `${KDA}: row pair-to-pair 241.0/241.0/241.5/241.0, mean 241.1 — and NOT 172.6, which is no interval on this sheet` },
  "kda.pairsPerFace": { value: 5, tol: 0, truth: `${KDA}: five pairs in both margins` },
  "ortho.skylightGrid": { value: 9, tol: 0, truth: ORTHO },
  "ortho.skylightPitch": { value: 2.7422, tol: 0.005, truth: ORTHO },
  "ortho.skylightPitchSigma": { value: 0.06, tol: 0.005, truth: ORTHO },
  "ortho.skylightCentreX": { value: 22.84, tol: 0.05, truth: `${ORTHO}, apparent centre before the displacement correction` },
  "ortho.skylightCentreZ": { value: 456.91, tol: 0.05, truth: `${ORTHO}, apparent centre before the displacement correction` },
  "ortho.plateWest": { value: -8.7, tol: 0.5, truth: ORTHO },
  "ortho.plateEast": { value: 53.75, tol: 0.5, truth: ORTHO },
  "ortho.plateNorth": { value: 425.9, tol: 0.5, truth: ORTHO },
  "ortho.plateSouth": { value: 487.8, tol: 0.5, truth: ORTHO },
  "ortho.argoPlateDisplacement": { value: 3.76, tol: 0.2, truth: `${ORTHO}, Argo's roof plate in the same mosaic` },
  "ortho.argoPlateHeight": { value: 18.4, tol: 0.2, truth: `${ORTHO}, Argo's measured LiDAR height` },
  "ortho.block.x0": { value: 7.8, tol: 0.5, truth: `${ORTHO}, the raised block's apparent plan rect` },
  "ortho.block.x1": { value: 37.4, tol: 0.5, truth: `${ORTHO}, the raised block's apparent plan rect` },
  "ortho.block.z0": { value: 442.4, tol: 0.5, truth: `${ORTHO}, the raised block's apparent plan rect` },
  "ortho.block.z1": { value: 471.0, tol: 0.5, truth: `${ORTHO}, the raised block's apparent plan rect` },
  "sourcedDepths.colonnade": { value: 3.4, tol: 0.4, truth: PHOTOS },
  "sourcedDepths.balcony": { value: 2.2, tol: 0.3, truth: PHOTOS },
  "sourcedDepths.terrace": { value: 3, tol: 0.35, truth: PHOTOS },
  "sourcedDepths.canopy": { value: 2.6, tol: 0.3, truth: PHOTOS },
  "ring.meanFaceLength": { value: ringTruth.meanFaceLength, tol: 5e-9, truth: RINGSRC },
  "ring.centroidX": { value: ringTruth.centroidX, tol: 5e-9, truth: RINGSRC },
  "ring.centroidZ": { value: ringTruth.centroidZ, tol: 5e-9, truth: RINGSRC },
};
RING.forEach(([x, z], i) => {
  PINS[`ring.vertex${i}X`] = { value: x, tol: 0, truth: RINGSRC };
  PINS[`ring.vertex${i}Z`] = { value: z, tol: 0, truth: RINGSRC };
});

test("S1(iii) every reading is pinned to the artefact it claims to come from", () => {
  const n = assertPins({
    readings: section.derivations.readings,
    pins: PINS,
    namespaces: ["px", "kda", "ortho", "sourcedDepths", "ring"],
    label: "galbraith",
  });
  assert.ok(n >= 40, `only ${n} readings pinned`);

  /* The acceptance test, run as an acceptance test: the fabricated value is
     REJECTED by the pin, and so is any other interval on that sheet. */
  for (const bad of [172.6, 187.6, 53.5, 241.0 * 2]) {
    assert.throws(
      () => assertPins({
        readings: { ...section.derivations.readings,
          kda: { ...section.derivations.readings.kda, rowPairToPair: bad } },
        pins: { "kda.rowPairToPair": PINS["kda.rowPairToPair"] },
        label: "mutant",
      }),
      /rowPairToPair has moved off its external truth/,
      `a mutant rowPairToPair of ${bad} must not survive the pin`);
  }
});

test("S1(iii) the relations this section states in prose are asserted", () => {
  const R = section.derivations.readings;
  const gapNS = R.kda.rowPairGap / R.kda.rowPairToPair;
  const gapEW = R.kda.alPairGap / R.kda.alPairToPair;
  const L = section.levels;
  let per = 0;
  for (let i = 0; i < RING.length; i++) {
    const [x1, z1] = RING[i];
    const [x2, z2] = RING[(i + 1) % RING.length];
    per += Math.hypot(x2 - x1, z2 - z1);
  }
  assertRelations({
    label: "galbraith",
    relations: [
      { name: "ONE SQUARE GRID: the two axes' gap ratios agree", got: gapEW / gapNS, want: 1, tol: 0.006 },
      { name: "the head-height read is WIDER than the base read, which is the lean",
        got: Math.sign(R.px.pairSpacingCentre / R.px.pairSpacing - 1), want: 1, tol: 0 },
      { name: "the derived skylight pitch stays inside the orthophoto's own sigma band",
        got: Math.abs(R.ortho.skylightPitch - 2 * section.grid.module) < 3 * R.ortho.skylightPitchSigma ? 1 : 0,
        want: 1, tol: 0 },
      { name: "the level stack closes on the measured height with no residual",
        got: L.eavesBelowRoof + L.roofSlab + 2 * L.storey, want: section.measured.lidarHeight, tol: 1e-9 },
      { name: "meanFaceLength is the measured ring's own mean face", got: R.ring.meanFaceLength, want: per / 4, tol: 5e-9 },
    ],
  });
});

test("S1(i) the coverage walk reaches the readings, the estimates and the draw block", () => {
  /* The pre-R2 walk covered the DRAWN blocks only. Nothing looked at the
     numbers those blocks are computed FROM, or at the render offsets, which
     is where a dimension can hide. There is no `uncovered` allowlist here:
     every number in all three roots is pinned, banded or derived. */
  const classifyIn = (sec) => (path, value) => {
    if (path.startsWith("derivations.readings.")) {
      return PINS[path.slice("derivations.readings.".length)] ? "pinned" : null;
    }
    const est = path.match(/^estimates\.(.+)\.(value|band\.[01])$/);
    if (est) return est[2] === "value" ? "estimated" : "band";
    if (path.startsWith("draw.")) {
      const k = path.slice("draw.".length);
      if (sec.derivations.figures[`draw.${k}`]) return "derived";
      const b = sec.draw.bands[k];
      return Array.isArray(b) && value >= b[0] && value <= b[1] ? "banded" : null;
    }
    return null;
  };
  const paths = assertCoverage({
    section,
    roots: {
      "derivations.readings": {},
      estimates: {},
      /* `draw.bands` IS the band declaration; walking it would ask a band to
         carry a band. */
      draw: { "draw.bands": true },
    },
    classify: classifyIn(section),
    uncovered: {},
    minimum: 120,
    label: "galbraith",
  });
  assert.ok(paths.length >= 120, `the axiom walk found only ${paths.length} numbers`);

  /* And the gate has teeth: an unbanded render offset fails. */
  const stripped = { ...section, draw: { ...section.draw, bands: { ...section.draw.bands } } };
  delete stripped.draw.bands.pierBury;
  assert.throws(() => assertCoverage({
    section: stripped, roots: { draw: { "draw.bands": true } },
    classify: classifyIn(stripped), minimum: 1, label: "mutant",
  }), /draw\.pierBury/, "a draw offset with no band must fail the walk");
});

test("S1(ii) every estimate carries a machine-readable band and ships inside it", () => {
  const n = assertEstimateBands({
    estimates: section.estimates,
    valueAt: (key) => at(section, key),
    label: "galbraith",
  });
  assert.ok(n >= 28, `only ${n} estimates banded`);
  /* The refusal, in machine-readable form (R2 item G3): the oversail band's
     floor IS the shipped value, so nothing can shrink it without failing. */
  assert.equal(section.estimates["grid.oversailModules"].band[0], 2);
  assert.equal(section.grid.oversailModules, 2);
  /* And the gate has teeth. */
  const bad = JSON.parse(JSON.stringify(section));
  bad.estimates["soffit.recess"].value = 0.9;
  assert.throws(() => assertEstimateBands({
    estimates: bad.estimates, valueAt: (k) => at(bad, k), label: "mutant",
  }), /outside its own published band/);
});

test("S1(vi) every expr EVALUATES and reproduces its own value", () => {
  /* `expr` used to be prose that nothing ran, so the only thing binding a
     figure to its inputs was this test's hand-written parallel arithmetic —
     which means the document and the gate could drift apart silently, and the
     document is what ships. `expr` is arithmetic only now; where a derivation
     is genuinely an argument rather than a calculation it moves to
     `derivation` and keeps its prose. */
  const scope = {};
  const ident = (p) => p.split(".").map((k) => (/^\d+$/.test(k) ? `n${k}` : k)).join(".");
  const put = (p, v) => {
    const ks = ident(p).split(".");
    let o = scope;
    for (const k of ks.slice(0, -1)) o = (o[k] ??= {});
    o[ks.at(-1)] = v;
  };
  const seed = (node, prefix) => {
    for (const [k, v] of Object.entries(node)) {
      const p = prefix ? `${prefix}.${k}` : k;
      if (typeof v === "number") put(p, v);
      else if (v && typeof v === "object" && !Array.isArray(v)) seed(v, p);
    }
  };
  seed(section.derivations.readings, "");
  put("drawnClearance", section.drawnClearance);
  seed(section.draw, "draw");
  for (const [k, r] of Object.entries(section.reads)) if (k !== "why") put(k, r.value);
  for (const [k, e] of Object.entries(section.estimates)) if (k !== "why") put(k, e.value);
  for (const [k, f] of Object.entries(section.derivations.figures)) put(k, f.value);

  const { evaluated, prose } = assertExprs({
    figures: section.derivations.figures, scope, label: "galbraith",
  });
  assert.ok(evaluated >= 45, `only ${evaluated} exprs evaluated`);
  /* The two figures that are genuinely an argument, not a calculation. */
  assert.equal(prose, 2, "only faces[1].ext and faces[3].ext carry a prose derivation");
  for (const i of [1, 3]) {
    const d = section.derivations.figures[`faces.${i}.ext`];
    assert.equal(d.expr, undefined, "prose must never ship under the name `expr`");
    assert.ok(d.derivation.length > 60, "and the prose must not be lost");
  }
  /* No expr may reference a reading that does not exist. */
  const bad = JSON.parse(JSON.stringify(section.derivations.figures));
  bad["grid.module"].expr = "ortho.skylightPitchNope / 2";
  assert.throws(() => assertExprs({ figures: bad, scope, label: "mutant" }),
    /resolves to undefined|hard failure/);
});

/* S1(v). `absent` was gated by LIST LENGTH, which cannot tell a retirement
   from a deletion and cannot notice a substitution. Every entry now has a
   stable key HERE and a probe that holds what it withholds. */
const ABSENT_KEYS = [
  ["roofBlockHeight", /HEIGHT of the raised skylight block/],
  ["barrelVault", /barrel-vault ceiling geometry/],
  ["cupExpansion", /CENTRAL UTILITIES PLANT EXPANSION/],
  ["seLawnWall", /diagonally along the SE lawn/],
  ["siteFurniture", /Bike racks, light poles, bollards/],
  ["columnCollar", /dark collar at some column bases/],
  ["lettering", /lettering\. The blades and beams/],
  ["clicsSign", /CLICS teal sign/],
  ["picnicTable", /green metal picnic table/],
  ["laJollaBlocks", /La Jolla Project granite blocks/],
  ["interiorFitout", /Interior fitout of every level/],
  ["nwPiers", /NW solid stair\/service piers/],
  ["beamCanLights", /recessed can lights under the two entry beams/],
  ["eastElevation", /EAST ELEVATION IS UNSOURCED/],
  ["capProfile", /roof-monitor CAP PROFILE/],
  ["ewPairGap", /pair internal gap on the EAST and WEST faces/],
  ["eastBand", /2\.2 m dark band along the east wall/],
  ["planOversize", /RESIDUAL PLAN OVERSIZE/],
  ["outerGridLines", /two outer single grid lines the KdA sheet carries/],
  /* NARROWED, not deleted, when the beds were planted: the entry withheld the
     planting and now withholds only the species. The probe moves with it, and
     the supersession that authorises the move is checked below. */
  ["bedPlanting", /WHICH SPECIES GROW IN THE THREE NORTH BEDS/],
  ["spandrelHex", /PER-HEX SAMPLE OF THE SPANDREL BAND/],
  ["doorHex", /PER-HEX SAMPLE OF THE DARK DOORS/],
  ["westStair", /THE WEST COURT STAIR AND ITS RAILS/],
  ["eastBank", /WHETHER THE 3\.1 m EAST BANK IS GROUND/],
  ["reskinHeights", /HOW TALL THE TWO RE-SKINNED EAST TREES/],
];
const absentEntries = () => section.absent.map((what) => {
  const hit = ABSENT_KEYS.find(([, re]) => re.test(what));
  return { key: hit ? hit[0] : what, what };
});

test("S1(v) every absent entry is held by its own probe, not by the list length", () => {
  const expected = Object.fromEntries(ABSENT_KEYS);
  const n = assertAbsentEntries({
    absent: absentEntries(),
    expected,
    built: {},
    label: "galbraith",
  });
  assert.equal(n, section.absent.length, "two absent entries collapsed onto one key");
  assert.equal(n, ABSENT_KEYS.length);

  /* G3, held by a probe rather than by a count: absent[18] STANDS, and the
     R2 re-walk of the ladder is recorded on it. */
  const outer = section.absent.find((a) => /two outer single grid lines the KdA sheet carries/.test(a));
  assert.match(outer, /RE-WALKED IN R2/, "the outer singles' ladder was re-walked; say so on the entry");
  assert.match(outer, /occluded/, "and say why the frame still cannot settle them");
  assert.match(outer, /Not built|not built/);

  /* And the gate has teeth: a silent deletion fails. */
  assert.throws(() => assertAbsentEntries({
    absent: absentEntries().filter((e) => e.key !== "eastElevation"),
    expected, label: "mutant",
  }), /has disappeared/);
});

test("S2 the sup field, and the one retirement galbraith is on the receiving end of", () => {
  /* Galbraith carries NO `sup`-bearing item — 56 of them are spread across
     york, blake, plaza and argo and none is here — so S2's disposition work
     is a no-op for this section. The gate is standing rather than absent: the
     day one appears it needs a disposition, because a machine-readable field
     that reads as a transfer when the object was deleted says the opposite of
     what happened. */
  const items = [];
  const scan = (v, p) => {
    if (Array.isArray(v)) return v.forEach((x, i) => scan(x, `${p}.${i}`));
    if (!v || typeof v !== "object") return;
    if ("sup" in v) items.push({ key: p, disposition: v.disposition, sup: v.sup, detail: v.supersededDetail });
    for (const k of Object.keys(v)) scan(v[k], p ? `${p}.${k}` : k);
  };
  scan(section, "");
  if (items.length) assertDispositions({ items, label: "galbraith" });
  else assert.equal(items.length, 0, "galbraith carries no sup-bearing item");

  /* What galbraith IS: the successor in one retirement. revelle.absent[7]
     withheld the roof monitors and galbraith supersedes it — so galbraith has
     to actually ship them, which is the failure audit-plaza F4 says the
     revelle suite cannot detect on its own. */
  const claim = section.superseded.find((r) => /revelle\.absent\[7\]/.test(r.what));
  assert.ok(claim, "the roof-monitor supersession must stay on the record");
  assert.equal(section.roof.skylights.grid, 9, "galbraith claims the monitors and must ship them");
  const { counts } = build();
  assert.equal(counts.skylights, 81, "and the module must actually build all 81 of them");
});

/* ============================================== G4: the three planted beds */

test("G4 the north apron is CUT on the three surveyed beds, and the beds are built", () => {
  /* THE BLOCKING ITEM. arcgis.ground#1764, #1765 and #1766 carry the survey's
     own vegetation class and the campus paving multipolygon punches them out
     as its own holes. The retired apron laid 194.9 m2 of jointed concrete
     deck over them. Paving them is not defensible and no `absent` entry can
     rescue it, so this gate is about BOTH halves at once: the cut, and the
     beds that fill it. */
  const N = section.north;
  assert.equal(N.beds.length, 3, "three surveyed rings, three beds");

  /* VERBATIM, byte for byte, from the survey — not re-surveyed, not re-bboxed. */
  const ids = [1764, 1765, 1766];
  N.beds.forEach((bed, i) => {
    const g = arcgis.ground[ids[i]];
    assert.equal(g.k, "green", `arcgis.ground#${ids[i]} is not surveyed as planted`);
    assert.equal(bed.source, `arcgis.ground#${ids[i]}`);
    assert.deepEqual(bed.ring, g.r[0].map(([x, z]) => [x / 10, z / 10]),
      `bed ${ids[i]} is not its survey ring, decimetres over ten, verbatim`);
  });
  /* And the survey really does exclude them from its own paving. */
  const walkPoly = arcgis.ground[3632];
  assert.equal(walkPoly.k, "walk", "ground[3632] is the campus paving multipolygon");
  for (const bed of N.beds) {
    const dm = bed.ring.map(([x, z]) => [Math.round(x * 10), Math.round(z * 10)]);
    /* Same vertices, and the survey stores the hole reversed and rotated
       against the standalone ring — so this compares the vertex SET and the
       count, which is the match the R2 arbitration made. */
    const key = (r) => r.slice(0, -1).map((p) => p.join(",")).sort().join("|");
    assert.ok(walkPoly.r.slice(1).some((hole) =>
      hole.length === dm.length && key(hole) === key(dm)),
      `${bed.source} is not a hole in the campus paving polygon — re-read this gate before trusting it`);
  }

  /* THE CUT. No paving rect may overlap a bed, the paving must still tile the
     retired outline, and the areas must add up to it. */
  const box = (r) => ({
    x0: Math.min(...r.map((p) => p[0])), x1: Math.max(...r.map((p) => p[0])),
    z0: Math.min(...r.map((p) => p[1])), z1: Math.max(...r.map((p) => p[1])),
  });
  const bedBoxes = N.beds.map((b) => box(b.ring));
  const outline = { x0: -7, x1: 53.5, z0: 415, z1: 429.5 };
  let paved = 0;
  for (const r of N.apron) {
    assert.ok(r.x0 >= outline.x0 - 1e-9 && r.x1 <= outline.x1 + 1e-9 &&
      r.z0 >= outline.z0 - 1e-9 && r.z1 <= outline.z1 + 1e-9,
      "an apron rect left the retired apron's own outline");
    paved += (r.x1 - r.x0) * (r.z1 - r.z0);
    for (const b of bedBoxes) {
      assert.ok(!(r.x0 < b.x1 - 1e-9 && r.x1 > b.x0 + 1e-9 && r.z0 < b.z1 - 1e-9 && r.z1 > b.z0 + 1e-9),
        `apron rect (${r.x0}, ${r.z0})-(${r.x1}, ${r.z1}) still paves surveyed planted ground`);
    }
  }
  for (let i = 0; i < N.apron.length; i++) {
    for (let j = i + 1; j < N.apron.length; j++) {
      const a = N.apron[i], b = N.apron[j];
      assert.ok(!(a.x0 < b.x1 - 1e-9 && a.x1 > b.x0 + 1e-9 && a.z0 < b.z1 - 1e-9 && a.z1 > b.z0 + 1e-9),
        "two apron rects overlap — the cut double-counts its own paving");
    }
  }
  const cut = bedBoxes.reduce((t, b) =>
    t + (b.x1 - b.x0) * (Math.min(b.z1, outline.z1) - Math.max(b.z0, outline.z0)), 0);
  const whole = (outline.x1 - outline.x0) * (outline.z1 - outline.z0);
  assert.ok(Math.abs(cut - 194.9) < 1.0, `the cut removes ${cut.toFixed(1)} m2, not the arbitrated 194.9`);
  assert.ok(Math.abs(paved - (whole - cut)) < 0.01,
    `the seven rects pave ${paved.toFixed(2)} m2 against ${(whole - cut).toFixed(2)} — the cut lost or gained field`);

  /* THE WHOLE RING is bed, including the 2.9 m of each that lies north of the
     apron and was never paved. */
  for (const b of bedBoxes) {
    assert.ok(b.z0 < outline.z0 - 2.5, "the bed must run north past the apron, not stop at it");
  }
  for (const bed of section.north.beds) {
    assert.ok(Math.abs(bed.area - 90) < 1.5, `bed ${bed.source} is ${bed.area} m2`);
  }
  assert.ok(section.north.apronNote && section.north.apronNote.length > 400);
  assert.match(section.north.apronNote, /194\.9/, "the magnitude of the retired error stays on the record");
  assert.match(section.north.bedSource, /k: "green"/, "the survey's own class is the evidence — quote it");
  assert.match(section.north.bedSource, /VERBATIM/);
});

test("G4 the module builds all three beds, on the drawn surface, facing up", () => {
  for (const [name, ground] of surfaces()) {
    const { group, counts } = build(ground);
    assert.equal(counts.northBeds, 3, `the beds are not built on the ${name}`);
    group.updateMatrixWorld(true);
    /* One mesh per bed, seated on the terrain, with UP-facing normals — a
       back-facing lit DoubleSide fill renders at ~0.42x its own colour, which
       four other modules in this repo each had to learn separately. */
    const boxes = section.north.beds.map((b) => ({
      x: b.ring.reduce((t, p) => t + p[0], 0) / 5,
      z: b.ring.reduce((t, p) => t + p[1], 0) / 5,
    }));
    let found = 0;
    const v = new THREE.Vector3();
    const nrm = new THREE.Vector3();
    group.traverse((o) => {
      if (!o.isMesh || o.name !== "ground-decal") return;
      if (!boxes.some((b) => Math.hypot(o.position.x - b.x, o.position.z - b.z) < 6)) return;
      found++;
      const pos = o.geometry.attributes.position;
      const nor = o.geometry.attributes.normal;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        const dy = v.y - ground(v.x, v.z);
        assert.ok(dy > -0.02 && dy < 0.3,
          `on the ${name}, a bed vertex sits ${dy.toFixed(2)} m off the terrain`);
        nrm.fromBufferAttribute(nor, i);
        assert.ok(nrm.y > 0, "a bed fill is back-facing — it will render at 0.42x its measured colour");
      }
    });
    assert.ok(found >= 3, `only ${found} bed meshes found on the ${name}`);
  }
});

/* ================================== P4: the bins, and the four-face gate */

test("P4 the north bins are DERIVED from ad01, not typed", () => {
  const N = section.north;
  const f = section.faces.find((x) => x.id === "north");
  let [sx, sz] = f.a, [ex, ez] = f.b;
  const L = Math.hypot(ex - sx, ez - sz);
  let tx = (ex - sx) / L, tz = (ez - sz) / L;
  let nx = tz, nz = -tx;
  if (nx * f.out[0] + nz * f.out[1] < 0) {
    nx = -nx; nz = -nz; [sx, sz, ex, ez] = [ex, ez, sx, sz]; tx = -tx; tz = -tz;
  }
  const w = REG + N.binStandoff;
  [-1, 1].forEach((sgn, i) => {
    const u = L / 2 + (sgn * f.pairGap) / 2;
    assert.ok(Math.abs(N.bins[i].x - (sx + tx * u + nx * w)) < 1e-6 &&
      Math.abs(N.bins[i].z - (sz + tz * u + nz * w)) < 1e-6,
      "a bin is not on the middle pair's own strut line at the derived standoff");
  });
  /* The bins are IN the colonnade, where ad01 shows them: outboard of the
     glazing, and their bodies clear of the fascia they stand under. */
  const B = section.entry.bins;
  assert.ok(N.binStandoff > section.column.standoffBuilt,
    "ad01 puts the bins on the PLAZA side of the column feet, not behind them");
  assert.ok(REG + N.binStandoff + B.radius < REG + G.roofOut,
    "a bin body pokes out past the fascia it stands under");
  assert.equal(N.bins.filter((b) => b.recycling).length, 1, "one of the two carries the band");
  assert.match(N.binNote, /typing '1\.6 m north of the north face'/,
    "the typed offset is retired and the record has to say what it was");
  assert.ok(!/re-seated 1\.6 m north/.test(N.binNote),
    "and it may not still be asserted as the reason the bins are where they are");
  assert.match(N.binNote, /RE-DERIVED/);
  assert.match(N.binNote, /flickr-galbraith\.jpg/,
    "the 2013 frame shows this paving clear of them; that epoch tension is declared, not averaged");
});

test("P4 the ground-furniture gate covers ALL FOUR faces, not two", () => {
  /* audit-galbraith finding 6: the R1 gate looked at east and west only, so
     the north furniture was never checked against the roof it sits under and
     the north apron was never checked against anything at all. The rule is
     not "nothing may be under the eaves" — a plaza runs up to a wall, and the
     bins stand under the real soffit in ad01. The rule is that every ground
     object declares which side of the eave line it is on, and the ones this
     section says are OUTBOARD really are. */
  const eave = (f) => {
    const frame = frameOf(f);
    const [ox, oz] = frame.at(0, 0);
    const [nx, nz] = [frame.at(0, 1)[0] - ox, frame.at(0, 1)[1] - oz];
    return { ox, oz, nx, nz, off: (x, z) => (x - ox) * nx + (z - oz) * nz, reach: BAND };
  };
  /* Fields this section claims are FULLY outboard of the modelled eave. The
     east recess and the east walk are deliberately NOT here: the recess is
     against the wall by definition, and 1.4 m of the walk stands under the
     modelled roof — audit-galbraith finding 6's second bullet, which is that
     the R1 gate's NAME claimed more than its assertion checked. Both are
     declared in the section instead of being smuggled through a gate. */
  const OUTBOARD = {
    east: [...section.east.dg, ...section.east.lawn],
    west: [...section.west.groundcover],
    south: [...section.south.beds, ...section.south.lawn],
    north: section.north.beds.map((b) => ({
      x0: Math.min(...b.ring.map((p) => p[0])), x1: Math.max(...b.ring.map((p) => p[0])),
      z0: Math.min(...b.ring.map((p) => p[1])), z1: Math.max(...b.ring.map((p) => p[1])),
    })),
  };
  let checked = 0;
  for (const f of section.faces) {
    const e = eave(f);
    for (const r of OUTBOARD[f.id]) {
      for (const [x, z] of rectCorners(r)) {
        assert.ok(e.off(x, z) >= e.reach - 0.05,
          `${f.id}: a field this section calls outboard sits ${e.off(x, z).toFixed(2)} m out, under the ${e.reach.toFixed(2)} m roof`);
      }
      checked++;
    }
  }
  assert.ok(checked >= 8, `only ${checked} outboard fields checked across four faces`);

  /* And every SOLID this section stands on the ground, on every face, is
     outboard of the surveyed ring and clear of the drawn mass. */
  for (const [x, z] of groundSolids()) {
    assert.ok(toRing(x, z) >= -0.01,
      `a ground solid at (${x.toFixed(1)}, ${z.toFixed(1)}) stands inside the surveyed mass`);
  }
  /* The lava wall and the west groundcover, which the R1 gate did check. */
  const westEdge = Math.min(...RING.map(([x]) => x));
  assert.ok(section.west.lavaWall.a[0] < westEdge - BAND);
  /* The two north/east fields that ARE under the eave say so themselves. */
  assert.match(section.east.walkNote, /under the modelled roof/i,
    "1.4 m of the east walk stands under the modelled roof — the section has to say it");
  assert.match(section.north.apronNote, /apron/i);
  const eastEdge = Math.max(...RING.map(([x]) => x));
  assert.ok(section.east.walk[0].x1 > eastEdge + BAND,
    "the walk must at least RUN OUT past the eave, whatever its inner edge does");
});

/* ================================== G3: the refusals, held as assertions */

test("G3 the scale is NOT re-solved and the oversail is NOT shrunk", () => {
  assert.equal(G.oversailModules, 2, "audit findings 3 and 4 are frozen — do not action them");
  assert.ok(Math.abs(section.faces.find((f) => f.id === "west").pairSpacing - 13.48) < 0.05,
    "the 13.47 m spacing is not re-solved; it moves only with the corrected gap ratio");
  const C = section.conflicts;
  assert.ok(C.gridScaleThree, "the three-way scale contradiction must be on the record");
  for (const scale of [/19\.79/, /17\.89/, /14\.6/, /26%/]) {
    assert.match(C.gridScaleThree, scale, `${scale} is one of the three scales or their spread`);
  }
  assert.match(C.gridScaleThree, /circular/, "say why the coincidence is not evidence");
  assert.match(C.roofPlate, /12%/, "the roof-plate residual stays DECLARED and unrepaired");
  assert.match(G.calibration, /RATIOS TRAVEL; METRES DO NOT/);
  assert.match(G.calibration, /gridScaleThree/, "the calibration now rests on the scale contradiction");
  /* conflicts.outerGridLines' factual description, corrected. */
  assert.match(C.outerGridLines, /102\.5/);
  assert.match(C.outerGridLines, /1497/);
  assert.match(C.outerGridLines, /SHEET BORDER/i, "the x 47 bar is the sheet border, not a bubble");
});

test("F8 the three uncached frames are cached or the claims resting on them are downgraded", () => {
  const cached = (f) => existsSync(join(root, "Revelle-College-Sources/renders/galbraith-sources", f));
  assert.ok(cached("ad01-entry-before.jpg"), "the frame the bins fix rests on must be on disk");
  assert.ok(cached("flickr-galbraith.jpg"), "the 2013 canopy frame must be on disk");
  /* crop-roofedge.jpg was NOT found on any rung. Everything that rested on it
     alone is downgraded, following conflicts.westCitation's own pattern. */
  const dead = "crop-roofedge.jpg";
  assert.ok(!cached(dead), "if this frame is ever cached, promote the six estimates back");
  assert.ok(section.conflicts.roofEdgeCitation, "a dead citation needs its own conflicts entry");
  assert.match(section.conflicts.roofEdgeCitation, /EXISTS NOWHERE IN THIS REPO/);
  for (const k of ["roofEdge.dripCap.depth", "roofEdge.fascia.depth", "roofEdge.birdSpike.depth",
    "roofEdge.birdSpike.needle", "roofEdge.birdSpike.wire", "roofEdge.birdSpike.pitch"]) {
    assert.ok(!section.reads[k], `${k} may not still be a citation of an absent frame`);
    assert.ok(section.estimates[k], `${k} must have been downgraded, not deleted`);
    assert.match(section.estimates[k].why, /crop-roofedge\.jpg/, "name the dead citation");
  }
  /* Nothing anywhere may still cite the dead frame as if it were readable. */
  for (const [k, r] of Object.entries(section.reads)) {
    if (k === "why") continue;
    assert.ok(!new RegExp(`${dead}[^.]{0,40}\\)\\s*(and|,)?\\s*$`).test(r.source),
      `${k} still leans on ${dead}`);
  }
  /* And the frames that WERE found carry their resolved provenance. */
  assert.ok(section.sources.some((l) => /01-Galbraith_Entry_AB-Alt\.jpg/.test(l)),
    "say which gallery image ad01-entry-before.jpg turned out to be");
  assert.ok(section.sources.some((l) => /9407492514_5c0fbff62b_b\.jpg/.test(l)),
    "say which static image flickr-galbraith.jpg turned out to be");
  assert.ok(section.sources.some((l) => /2011-11-15/.test(l)),
    "ad01's EXIF date replaces the section's guessed '~2011'");
});

/* ---------------------------------------- VISUAL ROUND 2, one gate each */

test("V2-1 the west court stair is WITHDRAWN, not re-seated", () => {
  /* Its only citation is a 404 and the visual audit found the build broken.
     A dead citation plus a broken build is a withdrawal (better absent than
     wrong), and a withdrawal has to take its reads with it or ten tolerances
     go on standing on a frame that has no live home. */
  assert.ok(!("stair" in section.west), "west.stair is back — it rests on a dead citation");
  for (const k of Object.keys(section.reads)) {
    assert.ok(!k.startsWith("west.stair."), `${k} outlived the object it dimensioned`);
  }
  /* The geometry is RECORDED, so restoring it costs no re-derivation. */
  const note = section.west.stairNote;
  assert.ok(note && note.length > 400, "a withdrawal must carry the retired geometry verbatim");
  for (const figure of [/treads 26/, /width 1\.5/, /landing 2\.1/, /z0 452/, /z1 462/, /x -12\.6/]) {
    assert.match(note, figure, "the retired flight's own numbers are not on the record");
  }
  const entry = section.absent.find((a) => /THE WEST COURT STAIR AND ITS RAILS/.test(a));
  assert.ok(entry, "a withdrawn object must appear in absent");
  for (const rung of [/PHOTOGRAPHS/, /STREET VIEW/, /DRONE/, /PLANNING DOCS/, /ARCHIVES/]) {
    assert.match(entry, rung, `the ultra ladder's ${rung} rung is not recorded for the stair`);
  }
  /* All four cached frames were actually walked, and the entry says what the
     one live stair on this building turned out to be instead. */
  for (const frame of [/-?21219\.jpg/, /-?21220\.jpg/, /-?21225\.jpg/, /-?12848\.jpg/]) {
    assert.match(entry, frame);
  }
  assert.match(entry, /STEEL SWITCHBACK/, "say what the only live exterior stair actually is");

  /* And nothing rakes across the west court any more. A stair is the only
     thing this section ever built on a slope, so a lone raked instance there
     is the flight coming back by another name. */
  const { group } = build();
  group.updateMatrixWorld(true);
  const q = new THREE.Quaternion();
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const e = new THREE.Euler();
  group.traverse((o) => {
    if (!o.isMesh) return;
    const check = () => {
      e.setFromQuaternion(q, "YXZ");
      const raked = Math.abs(e.x) > 0.1;
      const inCourt = p.x > -20 && p.x < -8 && p.z > 430 && p.z < 486 && p.y > 11;
      assert.ok(!(raked && inCourt),
        `something raked still stands over the west court at ${p.x.toFixed(1)}, ${p.z.toFixed(1)}`);
    };
    if (o.isInstancedMesh) {
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m);
        m.premultiply(o.matrixWorld);
        m.decompose(p, q, s);
        check();
      }
    } else {
      o.matrixWorld.decompose(p, q, s);
      check();
    }
  });
});

test("V2-2 the east ground is draped per-vertex, and the bank it hides behind is DECLARED", () => {
  /* The finding was 'the east base is buried in a tan bank'. The answer is
     not to move anything: it is to prove the seating and then to say, in
     numbers taken off the survey itself, what the ground actually does. */
  const ground = drawnSurface;
  const { group } = build(ground);
  group.updateMatrixWorld(true);
  const east = group.children.find((c) => c.name === "galbraith-east-ground");
  assert.ok(east, "no east ground group built");
  const v = new THREE.Vector3();
  let checked = 0;
  east.traverse((o) => {
    /* The draped ground fields only, by the same name the campus-wide drape
       gate uses. The foot pads are flat quads placed by matrix, not draped. */
    if (!o.isMesh || (o.name !== "ground-decal" && o.name !== "ground-joints")) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      assert.ok(Math.abs(v.y - ground(v.x, v.z)) < 0.35,
        `an east ground vertex sits ${(v.y - ground(v.x, v.z)).toFixed(2)} m off the drawn surface`);
      checked++;
    }
  });
  assert.ok(checked > 200, `only ${checked} east ground vertices checked`);

  /* The declaration has to be TRUE of campus-lidar.json, not merely written.
     Re-sample the terrain the note quotes and hold the note to it. */
  const T = lidar.terrain;
  const at = (x, z) => T.z[Math.round((z - T.z0) / T.cell) * T.cols + Math.round((x - T.x0) / T.cell)] / 10;
  for (let z = 434; z <= 490; z += 2) {
    for (const x of [54.6, 56, 58]) {
      assert.ok(at(x, z) >= 23.5 && at(x, z) <= 23.9,
        `the note says the surface is flat at 23.5-23.9 m at x ${x}, and z ${z} reads ${at(x, z)}`);
    }
    assert.ok(at(64, z) >= 26.7 && at(64, z) <= 26.9,
      `the note says the plateau holds 26.7-26.9 m at x 64, and z ${z} reads ${at(64, z)}`);
  }
  const rise = at(64, 460) - at(56, 460);
  assert.ok(Math.abs(rise - 3.1) < 0.05, `the declared 3.1 m step measures ${rise.toFixed(2)} m`);

  const note = section.east.gradeNote;
  assert.ok(note && note.length > 600, "a burial this large has to be argued, not mentioned");
  assert.match(note, /draped|drapedQuad/, "say that the fields are draped rather than levelled");
  assert.match(note, /26\.35/, "the sightline arithmetic needs the camera's own eye height");
  const entry = section.absent.find((a) => /WHETHER THE 3\.1 m EAST BANK IS GROUND/.test(a));
  assert.ok(entry, "the unresolved bank must be in absent");
  assert.match(entry, /classifier/, "the bare-earth reading is one of the two and must be named");
  assert.match(entry, /retaining/, "and so is the one that would need a retaining condition built");
});

test("V2-5 the three north beds are planted, inside their own surveyed rings", () => {
  const N = section.north;
  assert.ok(N.clumps?.count, "the north beds are bare again");
  assert.equal(N.clumps.count, section.counts.northClumps);
  /* The count is the south field's own density across the SURVEYED areas —
     pinned to that arithmetic, so a self-consistent invented number fails. */
  const southArea = N === null ? 0 : section.south.beds
    .reduce((t, r) => t + (r.x1 - r.x0) * (r.z1 - r.z0), 0);
  const northArea = N.beds.reduce((t, b) => t + b.area, 0);
  assert.equal(N.clumps.count,
    Math.round((section.south.clumps.count / southArea) * northArea),
    "north.clumps.count is not the south field's density across the surveyed rings");
  assert.match(N.plantingSource, /\[estimated\]/, "an extension must carry the label");
  assert.match(N.plantingSource, /south\.clumps/, "and must name the pattern it extends");
  /* NOTHING is re-declared: the size, shape and shrub fraction stay south's,
     so the extension cannot drift off the field it extends. */
  for (const k of ["radius", "height", "shrubRatio"]) {
    assert.ok(!(k in N.clumps), `north.clumps.${k} forks the sourced field — read south's`);
  }

  for (const [name, ground] of surfaces()) {
    const { group, counts } = build(ground);
    assert.equal(counts.northClumps, N.clumps.count,
      `${counts.northClumps} clumps built on the ${name}, not ${N.clumps.count}`);
    group.updateMatrixWorld(true);
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    let inBeds = 0;
    group.traverse((o) => {
      if (!o.isInstancedMesh) return;
      const g = o.geometry.type;
      if (g !== "ConeGeometry" && g !== "SphereGeometry") return;
      /* The canopy lobes are spheres too, and two of them stand over the
         north-east corner inside this z window. */
      if (o.parent?.name === "galbraith-tree-reskins") return;
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m);
        m.decompose(p, q, s);
        if (p.z > 429) continue; // the south field, on its own gate above
        const bed = N.beds.find((b) => pointInRing(b.ring, p.x, p.z));
        assert.ok(bed,
          `a north clump stands at ${p.x.toFixed(2)}, ${p.z.toFixed(2)} — on the apron, not in a surveyed bed`);
        assert.ok(Math.abs(p.y - s.y / 2 - ground(p.x, p.z)) < 0.4,
          "a north clump is not seated on the drawn surface");
        inBeds++;
      }
    });
    assert.equal(inBeds, N.clumps.count, `${inBeds} clumps landed in the beds on the ${name}`);
  }

  /* The withholding NARROWED rather than vanished, and the supersession that
     authorises the move is on the record. */
  const entry = section.absent.find((a) => /WHICH SPECIES GROW IN THE THREE NORTH BEDS/.test(a));
  assert.ok(entry, "the species are still unsourced and the entry must say so");
  assert.match(entry, /NARROWED/);
  const sup = section.superseded.find((r) => /absent\[19\]/.test(r.what));
  assert.ok(sup, "narrowing an absent entry needs a superseded record");
  assert.match(sup.when, /^\d{4}-\d{2}-\d{2}$/);
});

/** Even-odd point-in-polygon, the module's own test of 'inside the bed'. */
function pointInRing(ring, x, z) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
