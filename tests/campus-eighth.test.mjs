// Eighth College's ground plane: what the survey says, and where it may not go.
//
// campus-eighth.js repaints ~7,300 m² of Eighth off the construction-epoch tan
// using nothing but surveyed polygons. Three classes of failure are what this
// file exists to catch:
//
//  1. SILENT DROPOUT. Every feature is keyed in docs/data/campus-eighth.json,
//     so a refit of that dossier that loses a walkway or a bed would quietly
//     hand back a smaller campus and nothing would complain. Consumption is
//     pinned by KEY, not just by count, so a swap that keeps the total also
//     fails.
//  2. LADDER REGRESSION. Everything drawn on the ground has to climb
//     campus-overlay.js's decal ladder, in order, with no local lift constant.
//     The court in particular paints five rungs deep (navy pad, olive keys,
//     white paint, bone logo) and an out-of-order rung is invisible in a unit
//     test but eats the trident on screen.
//  3. A MASS INSIDE A BUILDING. The survey's beds and courtyards run STRAIGHT
//     UNDER the podiums — 12 of the painted features have their centroid
//     inside a massing footprint, which is right for a draped surface and
//     wrong for anything with a third dimension. Five boulders stood inside
//     Sankofa before this test existed. Drapes may go under a building; solids
//     may not.
//
// Plus the wiring bug that already shipped once: a builder whose geometry is
// parented to the scene rather than the zone renders fine and escapes the dev
// panel's layer toggle. That is run here the way boot() runs it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { THREE } from "../docs/js/campus-world.js";
import { OVERLAY, OVERLAY_RUNGS } from "../docs/js/campus-overlay.js";
import { placeEighth, createEighth, EIGHTH_COLORS } from "../docs/js/campus-eighth.js";
import { placeEighthCourt, tridentRings, orientedFrame, STROKE_M } from "../docs/js/campus-eighth-court.js";
import { placeEighthFurniture, createEighthFurniture, mergeOverlapping,
  FURNITURE_COLORS, FURNITURE_COLOR_PROVENANCE } from "../docs/js/campus-eighth-furniture.js";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const src = (rel) => readFileSync(join(ROOT, rel), "utf8");
const load = (f) => JSON.parse(readFileSync(join(ROOT, "docs/data", f), "utf8"));

const eighth = load("campus-eighth.json");
const arcgis = load("campus-arcgis.json");
const markings = load("campus-markings.json");
const heightAt = () => 20;

const p = placeEighth(eighth, arcgis);

const MODULES = ["docs/js/campus-eighth.js", "docs/js/campus-eighth-court.js",
  "docs/js/campus-eighth-furniture.js"];

/** Point in ring, the same even-odd rule the module uses. */
const inRing = (pts, x, z) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i];
    const [xj, zj] = pts[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
};

/** Distance from a point to the nearest edge of a ring. */
const distToRing = (pts, x, z) => {
  let best = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[(i + 1) % pts.length];
    const dx = bx - ax, dz = bz - az;
    const L2 = dx * dx + dz * dz;
    const t = L2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)) : 0;
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
};

/* Every massing footprint whose bounding box touches the Eighth zone, in
   metres (the survey stores decimetres). */
const ZONE = { x0: -260, x1: 10, z0: 450, z1: 720 };
const FOOTPRINTS = arcgis.massing
  .map((m) => m?.r?.[0])
  .filter((r) => Array.isArray(r) && r.length >= 3)
  .map((r) => r.map(([x, z]) => [x / 10, z / 10]))
  .filter((r) => {
    const xs = r.map((q) => q[0]);
    const zs = r.map((q) => q[1]);
    return Math.max(...xs) > ZONE.x0 && Math.min(...xs) < ZONE.x1 &&
      Math.max(...zs) > ZONE.z0 && Math.min(...zs) < ZONE.z1;
  });

/* ------------------------------------------------------- determinism */

test("placement is deterministic: the same survey gives byte-identical geometry", () => {
  assert.deepEqual(placeEighth(eighth, arcgis), p);
  /* And again from a fresh parse, so nothing is memoised off object identity. */
  assert.deepEqual(placeEighth(load("campus-eighth.json"), load("campus-arcgis.json")), p);
});

test("no module in the zone rolls a die", () => {
  /* Comments stripped first: both headers legitimately say the words
     "Math.random" while explaining that they do not call it. */
  const code = (rel) => src(rel).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const rel of MODULES) {
    assert.doesNotMatch(code(rel), /Math\s*\.\s*random/,
      `${rel}: Math.random — a stone would move between visits`);
    assert.match(code(rel), /\S/, `${rel}: comment stripper ate the whole file`);
  }
});

test("the zone no-ops quietly on missing data instead of throwing", () => {
  for (const args of [[null, null], [undefined, arcgis], [{}, arcgis], [{ ground: null }, arcgis]]) {
    const empty = placeEighth(...args);
    assert.equal(empty.surfaces.length, 0);
    assert.equal(empty.boulders.length, 0);
    assert.equal(empty.court, null);
  }
  /* And the renderer: no heightAt means no geometry, not an exception. */
  const made = createEighth(new THREE.Group(), { arcgis, eighth, markings });
  assert.ok(made.group.isObject3D);
  assert.equal(made.counts.surfaces, 0);
});

/* ------------------------------------------------- the overlay ladder */

test("both new modules climb the shared ladder and declare no lift of their own", () => {
  /* The same greps tests/campus-overlay.test.mjs runs over the older draping
     modules — its DRAPING_MODULES list does not yet name these two. */
  const IMPORT_RE = /import\s*\{[^}]*\}\s*from\s*["']\.\/campus-overlay\.js["']/;
  const LOCAL_LIFT_RE = /const\s+[A-Za-z_]*(?:LIFT|DRAPE)[A-Za-z_]*\s*=\s*-?\d/;
  const LOCAL_OFFSET_RE = /const\s+[A-Za-z_]*OFFSET[A-Za-z_]*\s*=\s*\{/;
  for (const rel of MODULES) {
    assert.match(src(rel), IMPORT_RE, `${rel}: no import from campus-overlay.js`);
    assert.match(src(rel), /overlayLift\(/, `${rel}: expected an overlayLift(...) call`);
    assert.doesNotMatch(src(rel), LOCAL_LIFT_RE, `${rel}: reintroduced a local lift constant`);
    assert.doesNotMatch(src(rel), LOCAL_OFFSET_RE, `${rel}: reintroduced a local polygonOffset constant`);
  }
});

test("every draped mesh sits on a real rung, and every solid stays off the ladder", () => {
  const { group } = createEighth(new THREE.Group(), { arcgis, eighth, markings, heightAt });
  const byOrder = new Map(OVERLAY_RUNGS.map((r) => [OVERLAY[r].renderOrder, r]));
  let draped = 0, solid = 0;
  group.traverse((o) => {
    if (!o.isMesh) return;
    if (!o.material.polygonOffset) {
      /* Boulders, hedges, hoop hardware: genuinely 3D, so they must stay at
         the default renderOrder and keep writing depth. */
      assert.equal(o.renderOrder, 0, "a solid mass claimed a decal-stack renderOrder");
      solid++;
      return;
    }
    const rung = byOrder.get(o.renderOrder);
    assert.ok(rung, `a draped mesh has renderOrder ${o.renderOrder}, which is on no rung`);
    assert.equal(o.material.polygonOffsetFactor, OVERLAY[rung].polygonOffsetFactor,
      `${rung}: polygonOffsetFactor does not match the ladder`);
    assert.equal(o.material.polygonOffsetUnits, OVERLAY[rung].polygonOffsetUnits);
    assert.equal(o.material.depthWrite, false, "a decal must not write depth");
    draped++;
  });
  assert.ok(draped >= 5, `only ${draped} draped meshes`);
  assert.ok(solid >= 2, `only ${solid} solid masses (boulders and hedges are missing)`);
});

test("the court paints in ladder order: navy under olive under white under the trident", () => {
  /* The court is added surface -> keys -> lane marks -> lines -> logo, so the
     child order of its draped meshes must be non-decreasing in renderOrder and
     must actually span four distinct rungs. An out-of-order rung eats the
     trident on screen and is invisible to a count assertion. */
  const { group } = createEighth(new THREE.Group(), { arcgis, eighth, markings, heightAt });
  const orders = [];
  group.traverse((o) => { if (o.isMesh && o.material.polygonOffset) orders.push(o.renderOrder); });
  const courtOrders = orders.slice(orders.indexOf(OVERLAY.carpet.renderOrder) - 1);
  for (let i = 1; i < courtOrders.length; i++) {
    assert.ok(courtOrders[i] >= courtOrders[i - 1],
      `court rung order went backwards: ${courtOrders.join(",")}`);
  }
  for (const rung of ["pad", "carpet", "paint", "logo"]) {
    assert.ok(orders.includes(OVERLAY[rung].renderOrder), `nothing drawn on the "${rung}" rung`);
  }
  assert.ok(OVERLAY.pad.renderOrder < OVERLAY.carpet.renderOrder);
  assert.ok(OVERLAY.carpet.renderOrder < OVERLAY.paint.renderOrder);
  assert.ok(OVERLAY.paint.renderOrder < OVERLAY.logo.renderOrder);
});

/* -------------------------------------- every surveyed polygon consumed */

/* The survey the zone was built against, pinned as LITERALS. Deriving these
   from campus-eighth.json would make the assertion self-fulfilling — deleting
   a walkway from the dossier would then still pass, which is the exact
   dropout this is here to catch (verified: it did, before these numbers were
   written down). Raise them deliberately when the dossier genuinely grows. */
const SURVEY = { total: 74, court: 1, walkway: 19, "planting-bed": 47, courtyard: 7 };
/* Two hedge strips are planting beds by kind and hedges by rôle. */
const HEDGE_BEDS = 2;
/* Rings the dossier never registered, added by the module: #1160 the big dry
   lawn, #1761 the north hedge strip. */
const EXTRA_RINGS = 2;
/* The 2.2 m north court walk, derived between two surveyed edges. */
const DERIVED_WALKS = 1;

test("the dossier still holds every feature the zone was measured against", () => {
  const kinds = {};
  for (const f of Object.values(eighth.ground)) kinds[f.kind] = (kinds[f.kind] || 0) + 1;
  assert.equal(Object.keys(eighth.ground).length, SURVEY.total,
    "campus-eighth.json gained or lost a feature — re-verify the zone, then update SURVEY");
  for (const kind of ["court", "walkway", "planting-bed", "courtyard"]) {
    assert.equal(kinds[kind], SURVEY[kind], `${kind}: ${kinds[kind]} in the dossier, ${SURVEY[kind]} expected`);
  }
});

test("every feature in the dossier is consumed — nothing drops out silently", () => {
  const drawn = new Set(p.surfaces.map((s) => s.key));
  const missing = Object.keys(eighth.ground)
    .filter((k) => k !== p.court?.key && !drawn.has(k));
  assert.deepEqual(missing, [],
    `${missing.length} surveyed features are in campus-eighth.json but never drawn`);
  assert.ok(p.court, "the basketball court fell out of the survey");
  /* Nothing drawn that the survey does not name, either. */
  const known = new Set([...Object.keys(eighth.ground), "hedge-1761", "dry-lawn-1160", "north-court-walk"]);
  const invented = [...drawn].filter((k) => !known.has(k));
  assert.deepEqual(invented, [], `${invented.length} surfaces are drawn from no surveyed ring`);
});

test("the counts are the survey's own, class by class", () => {
  const { counts } = createEighth(new THREE.Group(), { arcgis, eighth, markings, heightAt });
  assert.equal(counts.surfaces, SURVEY.total - SURVEY.court + EXTRA_RINGS + DERIVED_WALKS);
  assert.equal(counts.walkways, SURVEY.walkway + DERIVED_WALKS, "the derived north court walk is missing");
  assert.equal(counts.beds, SURVEY["planting-bed"] - HEDGE_BEDS + SURVEY.courtyard,
    "two planting beds are the named hedge strips and are counted as hedges");
  assert.equal(counts.lawns, 1, "the big dry lawn (arcgis #1160) is not being drawn");
  assert.equal(counts.hedges, HEDGE_BEDS + 1);
  assert.equal(counts.court, 1);
  assert.equal(counts.hoops, 2);
  assert.equal(counts.trident, 1, "the trident failed its own falsification gate");
  assert.ok(counts.boulders > 40, `only ${counts.boulders} boulders`);
});

test("the module states its own residual error instead of hiding it", () => {
  /* TWO bounded errors, both reported rather than discovered from a
     screenshot.
     1. INHERITED. Everything outside the core envelope that takes the cobble
        hex takes it on the strength of the core alone. The flag used to be set
        for `cobble-bed` ONLY, so the courtyards and hedge strips that take the
        SAME hex were silently reported as "measured" — the flag under-counted
        its own error. Every class that takes the hex must carry it.
     2. UNCORRECTED. Surveyed rings inside the Eighth envelope that nothing
        paints stay on the construction-epoch sample. The largest, #2374, is
        the pale slab immediately west of the basketball court and is in frame
        for the court's own close-up; no Apple frame gives it a colour, so it
        is named and measured, never guessed. */
  const { counts } = createEighth(new THREE.Group(), { arcgis, eighth, markings, heightAt });
  const cobble = new Set(p.surfaces.filter((s) => s.colour === EIGHTH_COLORS.cobbleBed)
    .map((s) => s.cls));
  assert.ok(cobble.size >= 3, `only ${cobble.size} classes take the cobble hex — has one been dropped?`);
  const flaggedCls = new Set(p.surfaces.filter((s) => s.material === "inherited-from-core")
    .map((s) => s.cls));
  for (const cls of cobble) {
    const peripheral = p.surfaces.filter((s) => s.cls === cls &&
      !(s.cx >= -160 && s.cx <= -75 && s.cz >= 545 && s.cz <= 650));
    if (!peripheral.length) continue;
    assert.ok(flaggedCls.has(cls),
      `${cls} takes the inherited cobble hex outside the core envelope and is never flagged`);
    for (const s of peripheral) {
      /* A peripheral bed may escape the inherited flag ONLY by carrying the
         ratio that measured it, and only on the dark side of the accept
         threshold — a bright read beside a podium is roof contamination, not
         a pale material, so `measured-ratio` with a ratio above 0.80 would be
         the module claiming the one thing the evidence cannot support. */
      if (s.material === "measured-ratio") {
        assert.equal(typeof s.ratio, "number", `${s.key}: measured-ratio without a ratio`);
        assert.ok(s.ratio <= 0.8,
          `${s.key}: measured-ratio at ${s.ratio} — above the 0.80 dark-read accept threshold`);
        continue;
      }
      assert.equal(s.material, "inherited-from-core", `${s.key}: peripheral but claims measured`);
      assert.equal(s.confidence, "low", `${s.key}: peripheral but claims better than low`);
    }
  }
  assert.equal(counts.inherited, p.surfaces.filter((s) => s.material === "inherited-from-core").length);
  assert.ok(counts.inherited > 20 && counts.inheritedM2 > 1000,
    `the inherited budget collapsed to ${counts.inherited} / ${counts.inheritedM2} m²`);

  assert.ok(Array.isArray(p.uncorrected), "placeEighth stopped reporting uncorrected rings");
  assert.equal(counts.uncorrected, p.uncorrected.length);
  /* Named, so a refit that quietly leaves MORE ground on construction tan
     fails here. #2374 is the one a viewer sees beside the court. */
  const idx = p.uncorrected.map((r) => r.index);
  assert.ok(idx.includes(2374), "#2374, the slab west of the court, fell out of the record");
  assert.ok(counts.uncorrected <= 9,
    `${counts.uncorrected} surveyed rings are uncorrected (was 9) — ${idx.join(",")}`);
  assert.ok(counts.uncorrectedM2 <= 1200, `${counts.uncorrectedM2} m² uncorrected (was 1,149)`);
  /* And nothing this module DOES paint may appear in the uncorrected list. */
  const painted = new Set(Object.values(eighth.ground).map((f) => f.registration));
  assert.deepEqual(idx.filter((i) => painted.has(`arcgis.ground#${i}`)), [],
    "a painted ring is being reported as uncorrected");
});

test("every surface carries a measured hex and a stated confidence", () => {
  for (const hex of Object.values(EIGHTH_COLORS)) assert.match(hex, /^#[0-9a-f]{6}$/);
  for (const s of p.surfaces) {
    assert.match(s.colour, /^#[0-9a-f]{6}$/, `${s.key}: colour "${s.colour}" is not a measured hex`);
    assert.ok(["low", "medium", "high"].includes(s.confidence), `${s.key}: no confidence`);
    assert.ok(s.area > 0, `${s.key}: zero area`);
  }
});

/* -------------------------------------------------- nothing in a building */

test("no boulder stands inside — or pokes through the wall of — a building", () => {
  assert.ok(FOOTPRINTS.length > 5, "no massing footprints found near Eighth; the test is blind");
  const bad = p.boulders.filter((b) =>
    FOOTPRINTS.some((f) => inRing(f, b.x, b.z) || distToRing(f, b.x, b.z) < b.d / 2));
  assert.deepEqual(bad.map((b) => [+b.x.toFixed(1), +b.z.toFixed(1)]), [],
    `${bad.length} boulders are inside a building footprint — the beds run under the podiums, the stones must not`);
});

test("no hedge mass runs through a building", () => {
  const bad = [];
  for (const h of p.hedges) {
    const m = h.mass;
    assert.ok(m, `${h.key}: hedge kept with no mass`);
    for (let i = 0; i <= 8; i++) {
      const t = (i / 8 - 0.5) * m.len;
      const x = m.x + m.ex[0] * t, z = m.z + m.ex[1] * t;
      if (FOOTPRINTS.some((f) => inRing(f, x, z) || distToRing(f, x, z) < m.w / 2)) {
        bad.push(h.key);
        break;
      }
    }
  }
  assert.deepEqual(bad, [], `${bad.length} hedge masses cut into a building`);
});

test("every boulder sits inside a bed, clear of its edge", () => {
  const beds = p.surfaces
    .filter((s) => s.cls === "cobble-bed" || s.cls === "courtyard-landscape")
    .map((s) => s.poly);
  const stray = p.boulders.filter((b) => !beds.some((r) => inRing(r, b.x, b.z) && distToRing(r, b.x, b.z) >= 0.6));
  assert.deepEqual(stray.map((b) => [+b.x.toFixed(1), +b.z.toFixed(1)]), [],
    `${stray.length} stones are off their bed or half over its edge`);
  /* And each is the declared 0.6-1.0 m diameter, never a boulder the size of a car. */
  for (const b of p.boulders) {
    assert.ok(b.d >= 0.6 && b.d <= 1.0, `boulder diameter ${b.d.toFixed(2)} m is outside the declared window`);
    assert.ok(b.h > 0 && b.h < b.d, "a stone taller than it is wide");
  }
});

test("no two boulders occupy the same spot", () => {
  const clashes = [];
  for (let i = 0; i < p.boulders.length; i++) {
    for (let j = i + 1; j < p.boulders.length; j++) {
      const a = p.boulders[i], b = p.boulders[j];
      if (Math.hypot(a.x - b.x, a.z - b.z) < 0.8) clashes.push([i, j]);
    }
  }
  assert.deepEqual(clashes, [], `${clashes.length} boulder pairs interpenetrate`);
});

test("nothing the zone places strays outside Eighth", () => {
  const pts = [...p.boulders, ...p.hedges.map((h) => h.mass), ...p.surfaces.map((s) => ({ x: s.cx, z: s.cz }))];
  const out = pts.filter((q) => q.x < ZONE.x0 || q.x > ZONE.x1 || q.z < ZONE.z0 || q.z > ZONE.z1);
  assert.deepEqual(out, [], `${out.length} placements are outside the Eighth College box`);
});

/* ------------------------------------------------------------- the court */

test("the court is the surveyed rectangle, and all its paint stays on it", () => {
  const c = placeEighthCourt(p.court.points);
  assert.ok(c, "the survey no longer reads as a court");
  const f = c.frame;
  assert.ok(Math.abs(f.length - 22.7) < 0.05, `court length ${f.length.toFixed(2)} m`);
  assert.ok(Math.abs(f.width - 15.4) < 0.05, `court width ${f.width.toFixed(2)} m`);
  /* Every line, block and key vertex inside the rectangle, allowing the paint
     its own half-stroke where a line rides the boundary. */
  const hl = f.length / 2 + STROKE_M, hw = f.width / 2 + STROKE_M;
  const all = [...c.lines.flatMap((l) => l.pts), ...c.blocks.flat(), ...c.keys.flat()];
  assert.ok(all.length > 300, `only ${all.length} paint vertices`);
  for (const [x, z] of all) {
    const u = (x - f.cx) * f.ex[0] + (z - f.cz) * f.ex[1];
    const v = (x - f.cx) * f.ez[0] + (z - f.cz) * f.ez[1];
    assert.ok(Math.abs(u) <= hl + 1e-6 && Math.abs(v) <= hw + 1e-6,
      `paint at (u ${u.toFixed(2)}, v ${v.toFixed(2)}) is off the court`);
  }
  /* Both hoops on the court's own long axis, one at each end. */
  assert.equal(c.hoops.length, 2);
  const us = c.hoops.map((h) => (h.x - f.cx) * f.ex[0] + (h.z - f.cz) * f.ex[1]).sort((a, b) => a - b);
  assert.ok(us[0] < 0 && us[1] > 0, "both hoops ended up at the same end");
  assert.ok(Math.abs(Math.abs(us[0]) - Math.abs(us[1])) < 1e-6, "the hoops are not symmetric");
});

/* ---------------------------------------------------------- the trident
 *
 * The centre logo is the most-looked-at object on the court, and the previous
 * build got it wrong by REUSING Muir Field's 32-vertex outline: at Eighth's
 * scale it rendered as an amorphous blob. It is now Eighth's own mark, measured
 * off ref9 through a homography fitted to the court's painted rectangle and
 * emitted parametrically from named dimensions by tridentRings(). These tests
 * are the falsification gate on that: they fail if the outline degenerates, if
 * a dimension drifts off its measurement, or if the mark stops being a trident
 * in the one way a polygon can be checked for it — a spearhead on the axis,
 * two outer tines that reach further ACROSS than the shaft does, a crossbar,
 * and a stem past the crossbar.
 */
test("the trident is built from its measurements, not from a frozen vertex list", () => {
  const rings = tridentRings();
  assert.equal(rings.length, 4, "spine + crossbar + two outer tines");
  for (const r of rings) {
    assert.ok(r.length >= 4, "a ring degenerated below a triangle");
    assert.ok(r.every(([b, a]) => Number.isFinite(a) && Number.isFinite(b)), "non-finite vertex");
    /* No repeated vertex: a duplicate is how a parametric edge collapses. */
    for (let i = 1; i < r.length; i++) {
      assert.ok(Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]) > 1e-6, "duplicate vertex");
    }
  }
  /* The spearhead side is SAMPLED from the taper law, so it carries many more
     vertices than the straight-edged rings. If someone replaces the law with a
     hand-typed outline this drops. */
  assert.ok(rings[0].length > 30, `spine ring has ${rings[0].length} vertices — the taper law is gone`);

  const all = rings.flat();
  const along = all.map(([, a]) => a), across = all.map(([b]) => b);
  const len = Math.max(...along) - Math.min(...along);
  const wid = Math.max(...across) - Math.min(...across);
  /* MEASURED EXTENTS: 4.06 m along the mark's own axis by 2.686 m across,
     read off ref9 rectified to plan at 0.005 m/px. The raster's own blur is
     ~0.02 m, so the windows are +-0.03 m — tight enough that a drifted
     dimension fails, loose enough not to fail on the measurement's own noise. */
  assert.ok(Math.abs(len - 4.06) < 0.03, `own-axis ${len.toFixed(3)} m, measured 4.06`);
  assert.ok(Math.abs(wid - 2.686) < 0.03, `cross-axis ${wid.toFixed(3)} m, measured 2.686`);
  /* Measured tip and stem end, about the mark's own centre. */
  assert.ok(Math.abs(Math.max(...along) - 2.12) < 0.03, "the spear tip moved off its measurement");
  assert.ok(Math.abs(Math.min(...along) + 1.94) < 0.03, "the stem end moved off its measurement");
  /* Left-right symmetric to the sampling precision — the mark is, and the
     symmetry fit that found its axis assumed nothing else. */
  assert.ok(Math.abs(Math.max(...across) + Math.min(...across)) < 1e-9, "the outline is not symmetric");
});

test("the trident still reads as a trident, not as a blob", () => {
  const [spine, bar, tineA, tineB] = tridentRings();
  const maxAbsB = (r) => Math.max(...r.map(([b]) => Math.abs(b)));
  const spanA = (r) => [Math.min(...r.map(([, a]) => a)), Math.max(...r.map(([, a]) => a))];

  /* 1. A SPEARHEAD on the axis: the centre tine's widest half-span is 0.575 m
        at a = +0.875, and it comes to a point 1.245 m further along. */
  const head = spine.filter(([, a]) => a > 0.8);
  assert.ok(Math.abs(maxAbsB(head) - 0.575) < 0.03, "the spearhead lost its measured shoulder");
  const tipRow = spine.filter(([, a]) => a > 2.09);
  assert.ok(tipRow.every(([b]) => Math.abs(b) < 0.05), "the spearhead has no point");

  /* 2. TWO OUTER TINES, each reaching further across than the shaft ever does
        and rising to within 1.4 m of the spear tip. A blob fails both. */
  const shaftHalf = maxAbsB(spine.filter(([, a]) => a > -1.0 && a < 0.6));
  for (const t of [tineA, tineB]) {
    assert.ok(maxAbsB(t) > shaftHalf * 3, "an outer tine does not stand clear of the shaft");
    assert.ok(spanA(t)[1] > 0.7, "an outer tine does not rise beside the spearhead");
  }
  assert.ok(tineA.some(([b]) => b > 0) && tineB.some(([b]) => b < 0), "both tines are on one side");

  /* 3. A CROSSBAR: wider than the shaft, well below the tine tips, and no
        taller than it is long is not enough — it must be a BAR. */
  const [barLo, barHi] = spanA(bar);
  assert.ok(barHi < 0, "the crossbar is not below the mark's centre");
  assert.ok(maxAbsB(bar) * 2 > (barHi - barLo) * 3, "the crossbar is not bar-shaped");

  /* 4. A STEM past the crossbar: the spine keeps going for over 0.9 m below the
        bar's underside, at a narrow, near-parallel width. */
  const stem = spine.filter(([, a]) => a < barLo);
  assert.ok(spanA(stem)[1] - spanA(stem)[0] > 0.7, "the stem below the crossbar is missing");
  assert.ok(maxAbsB(stem) < 0.3, "the stem is not a stem");
});

test("the trident is placed, centred, oriented and inside the court", () => {
  const made = placeEighthCourt(p.court.points);
  assert.ok(made.logo, "the trident was dropped — its own falsification gate rejected it");
  assert.equal(made.logo.polys.length, 4);
  assert.ok(Math.abs(made.logo.bearingDeg - 45.0) < 0.01,
    "the measured 45.0 deg bearing off the court's long axis has drifted");

  const f = made.frame;
  const world = made.logo.polys.flat();
  /* Back out of world space into the MARK's own frame — court frame, then the
     measured 45 deg — and check the four measured extents about the court
     centre. orientedFrame is the wrong tool here: it centres on the bounding
     box, and this mark is deliberately not centred on its own box (2.12 m of
     tines against 1.94 m of stem), so a bbox-centre test would fail a correct
     placement. */
  const rad = (Math.PI * 45) / 180;
  const T = [-Math.cos(rad), Math.sin(rad)], C = [-T[1], T[0]];
  const ab = world.map(([x, z]) => {
    const u = (x - f.cx) * f.ex[0] + (z - f.cz) * f.ex[1];
    const v = (x - f.cx) * f.ez[0] + (z - f.cz) * f.ez[1];
    return [u * T[0] + v * T[1], u * C[0] + v * C[1]];
  });
  const A = ab.map(([a]) => a), B = ab.map(([, b]) => b);
  assert.ok(Math.abs(Math.max(...A) - 2.12) < 0.03, "the spear tip is not 2.12 m from the court centre");
  assert.ok(Math.abs(Math.min(...A) + 1.94) < 0.03, "the stem end is not 1.94 m from the court centre");
  assert.ok(Math.abs(Math.max(...B) - 1.343) < 0.03 && Math.abs(Math.min(...B) + 1.343) < 0.03,
    "the mark is not centred across its own axis on the court centre");
  const g = orientedFrame(world);
  assert.ok(Math.abs(g.length - 4.06) < 0.03, `trident own-axis ${g.length.toFixed(3)} m, measured 4.06`);
  assert.ok(Math.abs(g.width - 2.686) < 0.05, `cross-axis ${g.width.toFixed(3)} m, measured 2.686`);

  /* WHICH DIAGONAL, in WORLD terms. A 45 deg mark has four candidate bearings
     and the first build of it took the wrong one — mirrored about the court's
     long axis — which no extent, centre or symmetry assertion above can see.
     ref9 registers to a top-down render under a 90 deg clockwise turn (north
     to the frame's right, proven by the concrete walk and hedge #1761, which
     campus-eighth.js derives on the court's minimum-z side); in that frame the
     tines point up-left, i.e. WEST and SOUTH. In this world that is -x, +z. */
  const tip = world.reduce((b, p) =>
    (Math.hypot(p[0] - f.cx, p[1] - f.cz) > b.d
      ? { d: Math.hypot(p[0] - f.cx, p[1] - f.cz), p } : b), { d: 0, p: null }).p;
  assert.ok(tip[0] - f.cx < -1.0, "the spear tip does not point WEST — the mark is mirrored or turned");
  assert.ok(tip[1] - f.cz > 1.0, "the spear tip does not point SOUTH — the mark is mirrored or turned");

  /* It OVERFLOWS the centre circle along its own axis — 2.12 m out against the
     circle's 1.83 m radius — which is what ref9 shows and what a mark scaled to
     fit inside the circle would not do. */
  const rMax = Math.max(...world.map(([x, z]) => Math.hypot(x - f.cx, z - f.cz)));
  assert.ok(rMax > 1.83, `the trident no longer overflows the centre circle (${rMax.toFixed(2)} m)`);

  for (const [x, z] of world) {
    const u = (x - f.cx) * f.ex[0] + (z - f.cz) * f.ex[1];
    const v = (x - f.cx) * f.ez[0] + (z - f.cz) * f.ez[1];
    assert.ok(Math.abs(u) <= f.length / 2 && Math.abs(v) <= f.width / 2, "the trident hangs off the court");
  }
});

test("placeEighthCourt refuses a polygon that is not court-shaped", () => {
  assert.equal(placeEighthCourt([[0, 0], [1, 0], [1, 1], [0, 1]]), null, "a 1 m square is not a court");
  assert.equal(placeEighthCourt([]), null);
  assert.equal(placeEighthCourt(null), null);
});

test("the north court walk is derived between two surveyed edges, never guessed", () => {
  assert.ok(p.northWalk, "the north court walk is missing");
  assert.ok(p.northWalk.width > 0.5 && p.northWalk.width < 6,
    `north walk ${p.northWalk.width.toFixed(2)} m wide`);
  const walk = p.surfaces.find((s) => s.key === "north-court-walk");
  assert.equal(walk.material, "derived");
  assert.equal(walk.confidence, "high");
  /* It abuts the court's north sideline, and does not overlap the paint. */
  const zCourt = Math.min(...p.court.pts.map((q) => q[1]));
  assert.ok(Math.max(...p.northWalk.poly.map((q) => q[1])) <= zCourt + 1e-6,
    "the walk overlaps the court surface");
});

/* ------------------------------------------------------------ zone wiring */

test("createEighth hands its geometry back and never parents it to the scene", () => {
  /* THE BUG THAT SHIPPED: a builder that adds itself to the scene renders, so
     screenshots look right, but the dev panel's layer toggle does not control
     it. boot() only ever adopts what the builder RETURNS. */
  const scene = new THREE.Group();
  const made = createEighth(scene, { arcgis, eighth, markings, heightAt });
  assert.ok(made?.group?.isObject3D, "createEighth returned nothing the zone could adopt");
  let orphans = 0;
  scene.traverse((o) => { if (o.isMesh) orphans++; });
  assert.equal(orphans, 0, `${orphans} meshes stayed under the scene, outside the layer`);
});

test("the eighth layer holds the whole zone, and is its own toggle", () => {
  /* Exactly what campus-walk.js boot() does: its own zone group, added to the
     scene, exposed as layers.eighth — separate from `athletics`. */
  const scene = new THREE.Group();
  const eighthZone = new THREE.Group();
  const made = createEighth(scene, { arcgis, eighth, markings, heightAt });
  if (made?.group) eighthZone.add(made.group);
  scene.add(eighthZone);
  const layers = { eighth: eighthZone };

  let meshes = 0;
  layers.eighth.traverse((o) => { if (o.isMesh) meshes++; });
  assert.ok(meshes >= 10, `only ${meshes} meshes under the eighth layer`);

  /* Geometry actually covers the college: the courtyard core and the court. */
  const BOXES = {
    "the basketball court": { x: [-186, -163], z: [517, 533] },
    "the courtyard core": { x: [-150, -80], z: [560, 640] },
  };
  const seen = Object.fromEntries(Object.keys(BOXES).map((k) => [k, 0]));
  layers.eighth.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    o.geometry.computeBoundingBox();
    const b = o.geometry.boundingBox;
    for (const [name, box] of Object.entries(BOXES)) {
      if (b.max.x > box.x[0] && b.min.x < box.x[1] && b.max.z > box.z[0] && b.min.z < box.z[1]) seen[name]++;
    }
  });
  for (const [name, n] of Object.entries(seen)) {
    assert.ok(n > 0, `no zone geometry over ${name}`);
  }

  layers.eighth.visible = false;
  assert.equal(layers.eighth.visible, false);
  assert.equal(made.group.visible, true, "the toggle must hide via the layer, not by mutating the builder");
});

test("campus-walk.js wires the zone the way this test assumes", () => {
  const walk = src("docs/js/campus-walk.js");
  assert.match(walk, /import\s*\{\s*createEighth\s*\}\s*from\s*["']\.\/campus-eighth\.js["']/);
  assert.match(walk, /file:\s*["']campus-eighth\.json["']/, "the survey is not in the DATA table");
  assert.match(walk, /eighthZone\.add\(/, "the builder's group is not adopted into a zone");
  assert.match(walk, /eighth:\s*eighthZone/, "layers.eighth is not exposed to the dev panel");
});

/* The zone's ground surfaces are the first LIT fillPoly consumers in the repo,
   so the winding actually matters here where it never did before: every
   earlier caller draws unlit and never reads a normal. With side:DoubleSide a
   lit Lambert flips the supplied +y normal on a back face, so a back-wound
   triangle is lit only by the hemisphere's GROUND term — measured at 0.42x,
   the whole college three stops down. The court's own fills are UNLIT basic
   material and are deliberately not included: their winding cannot be seen. */
test("every LIT ground surface faces up, and says so in its normals", () => {
  const { group } = createEighth(new THREE.Group(), { arcgis, eighth, markings, heightAt });
  let checked = 0;
  group.traverse((o) => {
    /* "Lit" was Lambert until the 2026-08-16 PBR migration; Standard is the
       same test for the same reason — an unlit Basic material has no normal
       to get wrong. */
    if (!o.isMesh || !o.material.polygonOffset) return;
    if (!o.material.isMeshLambertMaterial && !o.material.isMeshStandardMaterial) return;
    const pos = o.geometry.getAttribute("position");
    const nrm = o.geometry.getAttribute("normal");
    assert.ok(nrm, "a lit ground mesh ships without normals");
    for (let i = 0; i < nrm.count; i++) {
      assert.ok(nrm.getY(i) > 0.99, "a lit ground vertex normal does not point up");
    }
    if (!pos || pos.count < 3) return;
    for (let i = 0; i + 2 < pos.count; i += 3) {
      const ax = pos.getX(i), az = pos.getZ(i);
      const bx = pos.getX(i + 1), bz = pos.getZ(i + 1);
      const cx = pos.getX(i + 2), cz = pos.getZ(i + 2);
      /* Cross product's +y component, in the winding Three.js calls front. */
      const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
      /* Slivers from the triangulator have no meaningful facing; only
         triangles with real area can be face-down. */
      if (Math.abs(ny) < 1e-4) continue;
      assert.ok(ny > 0, `a ground triangle winds face-down (ny ${ny.toFixed(4)})`);
      checked++;
    }
  });
  assert.ok(checked > 100, `only ${checked} triangles checked`);
});

/* ----------------------------------------------- the furniture module

   campus-eighth-furniture.js is the first thing in this zone whose POSITIONS
   come from imagery rather than from the survey, so it is the first that can
   be wrong in a way the survey cannot catch. Four failure classes are what
   these tests exist for:

    1. A REGISTRATION DRIFT. Every measured object was read out of a rectified
       Apple frame tied to the SURVEYED court corners. If that tie ever moves —
       a refit of the court rectangle, a re-measure of the dossier — the
       objects move with it and nothing else would notice. So each object is
       pinned to a surveyed feature it must stay inside or beside: the turf
       panel inside its host ring, the enclosure and the plaza objects inside
       the college envelope.
    2. A MASS INSIDE A BUILDING. Same class campus-eighth.js's boulders taught:
       the imagery shows objects under overhangs and the survey continues its
       paving under the podiums, so an ungated placement stands inside a wall.
    3. A MASS ON THE COURT. New here — the court is the one surface in the
       college that must stay clear, and two of these objects sit within 10 m
       of its edge.
    4. HEIGHTS SMUGGLED IN AS MEASUREMENTS. No frame resolves a vertical at any
       of these objects. Every height must be declared an estimate in the
       placement, so a later reader cannot mistake one for survey. */

const f = placeEighthFurniture(eighth, arcgis);

test("furniture placement is deterministic and pure", () => {
  assert.deepEqual(placeEighthFurniture(eighth, arcgis), f);
  assert.deepEqual(placeEighthFurniture(load("campus-eighth.json"), load("campus-arcgis.json")), f);
  const code = src("docs/js/campus-eighth-furniture.js")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(code, /Math\s*\.\s*random/, "a plaza object would move between visits");
  /* The rungs come from campus-overlay.js. A local lift or polygon offset here
     is the regression the whole ladder exists to prevent. */
  assert.doesNotMatch(code, /polygonOffset\s*:/, "a local polygonOffset — use campus-overlay.js");
  assert.doesNotMatch(code, /const\s+LIFT/, "a local lift constant — use overlayLift()");
});

test("the furniture no-ops quietly on missing data", () => {
  for (const args of [[null, null], [undefined, arcgis], [{}, arcgis], [{ ground: null }, arcgis]]) {
    const empty = placeEighthFurniture(...args);
    assert.deepEqual(empty.turf, []);
    assert.deepEqual(empty.enclosures, []);
    assert.deepEqual(empty.plaza, []);
  }
  const { group, counts } = createEighthFurniture(new THREE.Group(), {});
  assert.equal(group.children.length, 0);
  assert.equal(counts.seats + counts.planters + counts.enclosures + counts.turf, 0);
});

test("the turf panel lies inside the surveyed ring it claims", () => {
  assert.ok(f.turf.length >= 1, "the measured turf panel vanished");
  for (const t of f.turf) {
    const host = eighth.ground[t.host];
    assert.ok(host, `${t.key}: host ${t.host} is not a surveyed feature`);
    for (const [x, z] of t.poly) {
      assert.ok(inRing(host.points, x, z),
        `${t.key}: a vertex at ${x},${z} escaped ${t.host} — the registration has drifted`);
    }
    assert.ok(t.area > 1 && t.area < host.points.length * 1000, `${t.key}: implausible area`);
    /* A second frame, or a MEASURED statement of what the second frame really
       says. The previous pass claimed two frames for an outline one frame gave
       and the other missed by 5.7 m; the claim is now the number. */
    if (t.frames.length < 2) {
      assert.ok(t.corroboration, `${t.key}: one frame and no corroboration record`);
      assert.match(t.corroboration.colour, /^#[0-9a-f]{6}$/);
      assert.equal(typeof t.corroboration.offsetM, "number",
        `${t.key}: corroboration without the offset it was measured at`);
    }
    assert.match(t.colour, /^#[0-9a-f]{6}$/);
  }
});

/* THE CLASS THIS FILE MISSED. Two detections of one bench, 0.4 m apart, are
   not two benches: they render as one fused L-shaped solid with a z-fighting
   seam. Five such pairs shipped, and every assertion in this file passed with
   them in place, because nothing ever compared one object against another.
   Footprint intersection is the test that scales with the object — a fixed
   radius large enough to catch two 0.9 m tables merges two real 2.6 m
   planters. */
test("no two furniture masses occupy the same ground", () => {
  const boxes = [
    ...f.plaza.map((o) => ({ x: o.x, z: o.z, w: o.w, d: o.d, what: `plaza ${o.kind}` })),
    ...f.enclosures.map((e) => ({ x: e.cx, z: e.cz, w: e.w, d: e.d, what: e.key })),
  ];
  const clashes = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.z - b.z) < (a.d + b.d) / 2) {
        clashes.push(`${a.what} at ${a.x},${a.z} fuses with ${b.what} at ${b.x},${b.z}`);
      }
    }
  }
  assert.deepEqual(clashes, [], `${clashes.length} furniture pairs interpenetrate`);
});

test("the overlap merge folds duplicates and leaves distinct objects alone", () => {
  /* Directly, on the failure that shipped: the real pair from the old table. */
  const dup = mergeOverlapping([
    { x: -61.24, z: 567.69, w: 0.92, d: 0.71 },
    { x: -61.29, z: 568.09, w: 0.88, d: 0.79 },
  ]);
  assert.equal(dup.length, 1, "two detections 0.40 m apart stayed two objects");
  assert.equal(dup[0].n, 2, "the merged object does not record how many detections it holds");
  /* A chain of three collapses to one, whichever order it arrives in. */
  const chain = [{ x: 0, z: 0, w: 1, d: 1 }, { x: 0.6, z: 0, w: 1, d: 1 }, { x: 1.2, z: 0, w: 1, d: 1 }];
  assert.equal(mergeOverlapping(chain).length, 1);
  assert.equal(mergeOverlapping([...chain].reverse()).length, 1);
  /* And two genuinely separate objects are NOT merged, which is the half a
     fixed-radius dedup gets wrong. */
  const apart = mergeOverlapping([{ x: 0, z: 0, w: 1, d: 1 }, { x: 1.4, z: 0, w: 1, d: 1 }]);
  assert.equal(apart.length, 2, "two objects 1.4 m apart were merged into one");
});

/* THE OTHER HOLE. Every gate here DROPS silently, and the floors in this file
   ("at least 20 objects") were loose enough to absorb six vanishing without a
   red test. Verified by mutation: moving a plaza object into the middle of the
   surveyed basketball court produced zero failures. An exact count plus an
   empty rejection list is the assertion that catches it. */
test("no gate rejected anything — the tables are what the pass emitted", () => {
  assert.deepEqual(f.rejected, [],
    "a measured object was silently dropped by a gate; regenerate the tables, do not widen the floor");
  assert.equal(f.plaza.length, 17, "the plaza table changed size — re-run --furniture and update this");
  assert.equal(f.enclosures.length, 1);
  assert.equal(f.turf.length, 1);
});

/* The tables are a script's output, and this is what makes that true rather
   than stated: scripts/reports/eighth/*.json is written by
   `register-eighth-refs.py --furniture --turf`, is tracked, and must equal what
   the module ships. The previous pass's table came from a detector that lived
   only on the build machine, and 17 of its 26 rows turned out to be
   unreproducible under the rule its own comment stated. */
test("every furniture constant equals the pipeline output it claims to be", () => {
  const rep = (n) => JSON.parse(readFileSync(join(ROOT, "scripts/reports/eighth", n), "utf8"));
  const plaza = rep("plaza-objects.json");
  assert.equal(plaza.objects.length, f.plaza.length,
    "the module ships a different number of plaza objects than the pass emitted");
  for (const [x, z, w, d] of plaza.objects) {
    const hit = f.plaza.find((o) => Math.abs(o.x - x) < 1e-9 && Math.abs(o.z - z) < 1e-9);
    assert.ok(hit, `the pass emitted an object at ${x},${z} that the module does not ship`);
    assert.ok(Math.abs(hit.w - w) < 1e-9 && Math.abs(hit.d - d) < 1e-9,
      `${x},${z}: plan size differs from the pass output`);
  }
  /* The detector's own rule, so a later edit of the table cannot quietly leave
     the stated window. */
  for (const o of f.plaza) {
    const a = o.w * o.d;
    assert.ok(a >= plaza.rule.area_m2[0] * 0.5 && a <= plaza.rule.area_m2[1],
      `${o.x},${o.z}: ${a.toFixed(2)} m² is outside the detector's area window`);
    assert.ok(Math.max(o.w, o.d) <= plaza.rule.max_dim_m);
  }
  const enc = rep("enclosure.json");
  const e = f.enclosures[0];
  assert.ok(Math.abs(e.cx - enc.cx) < 0.01 && Math.abs(e.cz - enc.cz) < 0.01,
    "the enclosure centre is not the fitted rectangle's");
  assert.ok(Math.abs(e.w - enc.w) < 0.01 && Math.abs(e.d - enc.d) < 0.01,
    "the enclosure plan size is not the fitted rectangle's");
  const turf = rep("turf-panel.json");
  assert.deepEqual(f.turf[0].poly.map(([x, z]) => [x, z]), turf.points,
    "the turf outline is not the traced contour");
  assert.equal(f.turf[0].colour, turf.colour_ref3);
  /* AREA IS DERIVED, NEVER TYPED. The previous comment carried three different
     areas for one polygon (39, 33, 38.7) and the polygon was 34.2. */
  const src2 = src("docs/js/campus-eighth-furniture.js");
  const stated = [...src2.matchAll(/([\d.]+)\s*m²/g)].map((m) => Number(m[1]));
  for (const v of stated) {
    assert.ok(v !== 38.7, "the unverified 38.7 m² turf area is back");
  }
  assert.ok(Math.abs(f.turf[0].area - 142.44) < 0.01,
    `turf area ${f.turf[0].area.toFixed(2)} m² — ringMetrics and the shipped polygon disagree`);
});

/* THE BLACK-SPLAT CLASS. A median taken in blue-cast shadow is an
   illumination, not an albedo; shipped raw as a lit material's colour it lands
   two stops under everything beside it. The enclosure shipped that way and
   rendered as a near-black slab. Every colour must now declare the light it
   was read in, and a shadow read must not be the shipped value. */
test("no colour ships raw out of shadow", () => {
  const luma = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  };
  for (const [key, hex] of Object.entries(FURNITURE_COLORS)) {
    const p = FURNITURE_COLOR_PROVENANCE[key];
    assert.ok(p, `${key}: a shipped colour with no provenance`);
    assert.match(p.raw, /^#[0-9a-f]{6}$/, `${key}: no raw median recorded`);
    assert.ok(["sun", "shade"].includes(p.state), `${key}: no illumination state`);
    assert.ok(p.frames.length >= 1, `${key}: no frame named`);
    if (p.state === "sun") {
      assert.equal(hex, p.raw, `${key}: a sunlit read must ship unaltered`);
    } else {
      assert.notEqual(hex, p.raw, `${key}: a shadow median is shipping raw — this is the black-splat bug`);
      assert.ok(luma(hex) > luma(p.raw) * 1.5,
        `${key}: shipped at luma ${luma(hex).toFixed(0)} against a shadow read of ${luma(p.raw).toFixed(0)} — not relit`);
    }
    /* And nothing on a LIT solid may be darker than the darkest thing the
       references show standing in daylight; below this it reads as a hole. */
    assert.ok(luma(hex) > 70, `${key}: luma ${luma(hex).toFixed(0)} renders as a black splat`);
  }
});

test("nothing the furniture stands up is inside a building", () => {
  const solidsOf = [
    ...f.plaza.map((o) => ({ x: o.x, z: o.z, r: Math.max(o.w, o.d) / 2, what: `plaza ${o.kind}` })),
    ...f.enclosures.map((e) => ({ x: e.cx, z: e.cz, r: Math.hypot(e.w, e.d) / 2, what: e.key })),
  ];
  assert.equal(solidsOf.length, 18, `${solidsOf.length} solids — the set changed size`);
  for (const s of solidsOf) {
    for (const ring of FOOTPRINTS) {
      assert.ok(!inRing(ring, s.x, s.z), `${s.what} at ${s.x},${s.z} stands inside a building`);
      assert.ok(distToRing(ring, s.x, s.z) >= s.r,
        `${s.what} at ${s.x},${s.z} pushes through a building wall`);
    }
  }
});

test("nothing overhangs the basketball court", () => {
  const court = eighth.ground["basketball-court"].points;
  const xs = court.map((q) => q[0]), zs = court.map((q) => q[1]);
  const box = { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
  for (const o of [...f.plaza.map((o) => ({ x: o.x, z: o.z, rx: o.w / 2, rz: o.d / 2 })),
                   ...f.enclosures.map((e) => ({ x: e.cx, z: e.cz, rx: e.w / 2, rz: e.d / 2 }))]) {
    const overlaps = o.x + o.rx > box.x0 && o.x - o.rx < box.x1 &&
      o.z + o.rz > box.z0 && o.z - o.rz < box.z1;
    assert.ok(!overlaps, `an object at ${o.x},${o.z} overhangs the court pad`);
  }
  assert.ok(f.enclosures.length >= 1, "the measured service enclosure fell out of the build");
});

test("every height is declared an estimate, and every plan a measurement", () => {
  for (const o of [...f.plaza, ...f.enclosures]) {
    assert.equal(o.plan, "measured", "a plan size that is not measured slipped in");
    assert.equal(o.height, "standard-size-estimate",
      "a height is claiming to be measured — no frame in the set resolves one");
    assert.ok(o.h > 0.2 && o.h < 4, `implausible height ${o.h}`);
  }
  for (const hex of Object.values(FURNITURE_COLORS)) assert.match(hex, /^#[0-9a-f]{6}$/);
});

test("the plaza objects split on the measured size bimodality, not on a guess", () => {
  assert.equal(f.plaza.length, 17, `${f.plaza.length} plaza objects survived the gates`);
  for (const o of f.plaza) {
    const span = Math.max(o.w, o.d);
    assert.equal(o.kind, span <= 1.7 ? "seat" : "planter", `${span} m classified as ${o.kind}`);
    assert.ok(span >= 0.5 && span <= 3.5, `${span} m is outside the detector's own size window`);
  }
  assert.ok(f.plaza.some((o) => o.kind === "seat") && f.plaza.some((o) => o.kind === "planter"),
    "one of the two measured clusters has disappeared");
});

test("the furniture is BUILT, on the ladder, and hands back its group", () => {
  const { group, counts } = createEighthFurniture(new THREE.Group(), { arcgis, eighth, heightAt });
  assert.ok(group.children.length > 0, "the furniture builds nothing");
  assert.equal(counts.turf, f.turf.length);
  assert.equal(counts.enclosures, f.enclosures.length);
  assert.equal(counts.seats + counts.planters, f.plaza.length);
  let drapes = 0, masses = 0;
  group.traverse((o) => {
    if (!o.isMesh) return;
    if (o.material.polygonOffset) {
      /* A drape: it must sit on a rung campus-overlay.js owns, not a local one. */
      drapes++;
      assert.equal(o.renderOrder, OVERLAY.pad.renderOrder, "the turf is off the pad rung");
      const nrm = o.geometry.getAttribute("normal");
      for (let i = 0; i < nrm.count; i++) {
        assert.ok(nrm.getY(i) > 0.99, "a lit turf vertex normal does not point up");
      }
    } else {
      masses++;
      const pos = o.geometry.getAttribute("position");
      for (let i = 0; i < pos.count; i++) {
        assert.ok(pos.getY(i) >= heightAt() - 0.01, "a mass sinks below the terrain");
      }
    }
  });
  assert.ok(drapes >= 1 && masses >= 1, `drapes ${drapes}, masses ${masses}`);
});

test("the zone builder parents the furniture, and boot() parents the zone", () => {
  /* The bug that already shipped once: geometry added to the scene rather than
     to the zone renders fine and escapes the dev panel's layer toggle. */
  const scene = new THREE.Group();
  const { group } = createEighthFurniture(scene, { arcgis, eighth, heightAt });
  assert.equal(scene.children.length, 0, "the furniture added itself to the scene");
  assert.ok(group.children.length > 0);
  const walk = src("docs/js/campus-walk.js");
  assert.match(walk, /eighthZone\.add\(eighthProps\.group\)/,
    "campus-walk.js no longer parents the furniture into the Eighth zone");
});
