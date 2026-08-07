// The region's measured colour: one hex per 6 m of ground, one per roof.
//
// WHAT CAN GO WRONG HERE, and why each of these tests exists.
//
// THE JOIN IS POSITIONAL AND SILENT. region-colors.json ships a byte per
// terrain cell, and the only thing making byte i mean the same 36 m² of ground
// as height i is that both files were cut on the same lattice. An offset of two
// cells produces a world that renders perfectly and has the road running
// through the field beside the road — no exception, no missing file, nothing to
// notice until you are standing in it. Same hazard on the roof sidecar, which
// is keyed by index into region-osm.json: one building inserted upstream slides
// every colour onto its neighbour with both files still individually valid.
// The grid assertions and the fingerprint are the whole defence.
//
// A UNIFORM FILE LOOKS FINE. If the sampler silently read the wrong pixels — a
// projection sign flipped, a stride wrong, tiles that all failed to decode —
// the most likely output is not a crash but a plausible flat wash. That is
// strictly worse than the inherited tan it replaced, because it is a wash
// wearing the word "measured". So the variety tests below refuse a file whose
// colours do not actually vary, and refuse one where a single palette entry
// swallows the region.
//
// THE STRONGEST TEST IS THE WATER ONE. Variety proves the sampler read
// something; it does not prove it read the RIGHT something. region-terrain.bin
// independently knows which cells are open water, from LiDAR, with no imagery
// involved. If the colours are correctly georeferenced then those cells must
// come out blue-green and the land must not — two files, two sources, one
// answer. A transposed or offset grid fails this immediately.
//
// SCOPE IS A CLAIM TOO. Cells inside the campus box must carry the reserved
// index and no colour: the campus has its own finer pipeline, and that pipeline
// deliberately rejects the Eighth College construction zone that today's
// imagery shows. A regional measurement leaking in there would overwrite a
// better answer with a worse one, quietly.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ZOOM, PALETTE_SIZE, NONE_INDEX, GAMUT, rgbToHsl,
} from "../scripts/build-region-colors.mjs";
import { footprintFingerprint } from "../scripts/build-region-heights.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(path.join(ROOT, p), "utf8"));

const COLORS_PATH = "docs/data/region-colors.json";
const shipped = existsSync(path.join(ROOT, COLORS_PATH));
const colors = shipped ? read(COLORS_PATH) : null;
const terrain = read("docs/data/region-terrain.json");
const osm = read("docs/data/region-osm.json");
const region = read("docs/data/region.json");

const heights = (() => {
  const b = readFileSync(path.join(ROOT, "docs/data/region-terrain.bin"));
  return new Int16Array(b.buffer, b.byteOffset, b.byteLength / 2);
})();

const idx = shipped ? Buffer.from(colors.terrain.idx, "base64") : null;
const rgbOf = (hex) => [
  parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16),
];

/* ------------------------------------------------------------- the join */

test("the colour grid is cut on region-terrain.json's own lattice", () => {
  assert.ok(shipped, `${COLORS_PATH} is missing — run scripts/build-region-colors.mjs`);
  const t = colors.terrain;
  for (const k of ["x0", "z0", "cell", "cols", "rows"]) {
    assert.equal(
      t[k], terrain[k],
      `colour grid ${k}=${t[k]} but region-terrain.json says ${terrain[k]} — ` +
      "the join is positional, so any disagreement offsets every ground colour in the region"
    );
  }
  assert.equal(idx.length, terrain.cols * terrain.rows,
    "one index per terrain cell, exactly");
  assert.equal(heights.length, idx.length,
    "the height grid and the colour grid must be the same length or they are not the same grid");
});

test("the roof sidecar is bound to the footprints it measured", () => {
  assert.equal(colors.footprints.count, osm.buildings.length,
    "sidecar covers a different number of footprints than region-osm.json ships");
  assert.equal(
    colors.footprints.fingerprint, footprintFingerprint(osm.buildings),
    "footprint fingerprint mismatch — region-osm.json was rebuilt and every roof colour " +
    "now describes a different building. Re-run scripts/build-region-colors.mjs."
  );
  for (const k of Object.keys(colors.roofs)) {
    assert.ok(osm.buildings[Number(k)], `roof colour at index ${k} indexes no building`);
  }
  for (const k of Object.keys(colors.suspect)) {
    assert.ok(osm.buildings[Number(k)], `suspect colour at index ${k} indexes no building`);
    assert.ok(!(k in colors.roofs),
      `building ${k} is both a confident roof and a construction suspect — it can only be one`);
  }
});

/* -------------------------------------------------------- palette integrity */

test("the palette is well formed and every index resolves in it", () => {
  const p = colors.terrain.palette;
  assert.ok(p.length > 0, "empty palette");
  assert.ok(p.length <= PALETTE_SIZE, `${p.length} palette colours exceeds PALETTE_SIZE ${PALETTE_SIZE}`);
  assert.ok(p.length < NONE_INDEX,
    `palette must stay clear of the reserved index ${NONE_INDEX}`);
  for (const c of p) assert.match(c, /^#[0-9a-f]{6}$/, `bad palette colour ${c}`);
  assert.equal(new Set(p).size, p.length, "the palette contains duplicate colours");

  assert.equal(colors.terrain.none, NONE_INDEX,
    "the reserved index must be declared in the file — the renderer reads it rather than assuming");
  let bad = 0;
  for (const v of idx) if (v !== NONE_INDEX && v >= p.length) bad++;
  assert.equal(bad, 0, `${bad} cells point at a palette entry that does not exist`);
});

test("every shipped roof colour is a valid hex inside the site's gamut", () => {
  const all = [...Object.values(colors.roofs), ...Object.values(colors.suspect).map((s) => s.c)];
  assert.ok(all.length > 0, "no roof colours at all");
  for (const hex of all) {
    assert.match(hex, /^#[0-9a-f]{6}$/, `bad roof colour ${hex}`);
    const [r, g, b] = rgbOf(hex);
    const [, s, l] = rgbToHsl(r / 255, g / 255, b / 255);
    /* The taste guard, re-derived from the shipped values rather than trusted:
       one bad sample must never be able to put a neon building in the region.
       SLACK exists because the guard clamps in HSL and then re-encodes to 8-bit
       integers, and rounding three channels can push the recovered saturation a
       few thousandths back over the line. tests/campus-truecolor.test.mjs
       allows the same 0.02 for the same reason; a bigger number would start
       admitting colours the guard was supposed to have caught. */
    const SLACK = 0.02;
    assert.ok(s <= GAMUT.sMax + SLACK, `${hex} is saturated past the gamut (s=${s.toFixed(3)})`);
    assert.ok(l >= GAMUT.lMin - SLACK && l <= GAMUT.lMax + SLACK,
      `${hex} is outside the gamut's lightness band (l=${l.toFixed(3)})`);
  }
});

/* ------------------------------------------------------------ real variety */

test("the measured colours actually vary", () => {
  const used = new Map();
  let coloured = 0;
  for (const v of idx) {
    if (v === NONE_INDEX) continue;
    coloured++;
    used.set(v, (used.get(v) || 0) + 1);
  }
  assert.ok(coloured > 400_000,
    `only ${coloured} cells carry a colour — the region is 600k cells of scope`);

  /* A file where every cell is one colour would render as a flat wash and look
     entirely plausible. It is the failure mode a broken sampler produces, so it
     is the one that gets a hard floor. */
  assert.ok(used.size >= 64,
    `only ${used.size} distinct colours in use across 21.7 km² — that is a wash, not a measurement`);

  const biggest = Math.max(...used.values());
  assert.ok(biggest / coloured < 0.35,
    `one palette colour covers ${Math.round((biggest / coloured) * 100)}% of the region — ` +
    "a real 30 km² of coast, canyon, freeway and rooftop does not do that");

  /* Variety in COUNT is not variety in APPEARANCE: 200 near-identical greys
     would pass the test above. So the palette has to span real luminance and
     real hue as well. */
  const lum = colors.terrain.palette.map((h) => {
    const [r, g, b] = rgbOf(h);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  });
  assert.ok(Math.max(...lum) - Math.min(...lum) > 0.35,
    "the palette spans almost no luminance — dark canyon shadow and bright sand should both be in it");
  const hues = new Set(colors.terrain.palette.map((h) => {
    const [r, g, b] = rgbOf(h);
    const [hh, s] = rgbToHsl(r / 255, g / 255, b / 255);
    return s < 0.06 ? "grey" : Math.round(hh * 12); // 30° buckets
  }));
  assert.ok(hues.size >= 4,
    `the palette occupies only ${hues.size} hue families — vegetation, asphalt, sand and water are not the same hue`);
});

test("roof colours are not all the same colour either", () => {
  const distinct = new Set(Object.values(colors.roofs));
  assert.ok(Object.keys(colors.roofs).length > 3000,
    `only ${Object.keys(colors.roofs).length} roofs measured out of ${osm.buildings.length}`);
  assert.ok(distinct.size > 500,
    `${distinct.size} distinct roof colours across ${Object.keys(colors.roofs).length} roofs — too uniform to be measured`);
});

/* ---------------------------------------------------- correctly registered */

test("the cells LiDAR calls open water are the cells imagery sees as water", () => {
  /* Two independent files, two independent sources, one answer. region-terrain
     .bin marks a cell NODATA where the 2014 laser got no ground return and the
     land around the void stands at sea level — that is the Pacific, decided
     without a single pixel. If this colour grid is registered correctly, those
     cells must be the blue-green ones. If it is transposed, offset, or read
     from the wrong tiles, they will not be, and no amount of variety would have
     shown it. */
  const { cols } = terrain;
  const pal = colors.terrain.palette.map(rgbOf);
  const blueness = [];
  const landBlueness = [];
  for (let i = 0; i < idx.length; i++) {
    const k = idx[i];
    if (k === NONE_INDEX) continue;
    const [r, , b] = pal[k];
    (heights[i] === terrain.nodata ? blueness : landBlueness).push(b - r);
  }
  assert.ok(blueness.length > 5000, `only ${blueness.length} open-water cells carry a colour`);

  const med = (a) => { a.sort((x, y) => x - y); return a[a.length >> 1]; };
  const water = med(blueness);
  const land = med(landBlueness);
  assert.ok(water > 10,
    `open-water cells measure blue-minus-red ${water} — water should be plainly blue-green; ` +
    "the colour grid is probably offset from the height grid");
  assert.ok(water - land > 25,
    `open water (${water}) barely differs from land (${land}) in blue-minus-red — ` +
    "the two grids do not describe the same places");

  /* And the registration is TIGHT, not merely correlated at the scale of the
     coastline. Shifting the colour grid 60 m and re-reading has to break the
     agreement — but only where the shift actually leaves the water, which is
     the subtlety that makes this test mean anything: most of the Pacific is
     ocean 60 m further south as well, so a naive shift of every water cell
     re-reads ocean and "passes" while proving nothing. So the comparison runs
     only over water cells whose shifted counterpart the LiDAR calls LAND. If
     the grids are aligned those reads must come back land-coloured.

     SENSITIVITY, measured rather than assumed: sliding the shipped index array
     by n cells and re-running this gives a delta of 20 at n=0, 20 at n=1, 10 at
     n=2, 9 at n=5 and 0 at n=20. So the assertion below catches a 12 m
     misregistration and tolerates a 6 m one. That is the honest resolution of a
     6 m grid tested against a coastline, and it is stated here rather than
     implied — this test is not a claim of sub-cell registration. */
  const paired = { water: [], shifted: [] };
  for (let i = 0; i < idx.length; i++) {
    if (heights[i] !== terrain.nodata) continue;
    const j = i + 10 * cols;
    if (j >= idx.length || heights[j] === terrain.nodata) continue;
    if (idx[i] === NONE_INDEX || idx[j] === NONE_INDEX) continue;
    paired.water.push(pal[idx[i]][2] - pal[idx[i]][0]);
    paired.shifted.push(pal[idx[j]][2] - pal[idx[j]][0]);
  }
  assert.ok(paired.water.length > 1000,
    `only ${paired.water.length} water cells sit within 60 m of land — too few to test alignment on`);
  const here = med(paired.water);
  const there = med(paired.shifted);
  assert.ok(here - there > 10,
    `shifting the colour grid 60 m onto land barely changes the reading (${here} → ${there}) — ` +
    "the colours are not registered to the heights at cell precision");
});

/* ------------------------------------------------------------------ scope */

test("the campus box is left to the campus, and nothing outside the outline is claimed", () => {
  const O = region.origin;
  const c = region.core;
  const x0 = (c.west - O.lng) * O.mPerDegLng;
  const x1 = (c.east - O.lng) * O.mPerDegLng;
  const z0 = -(c.north - O.lat) * O.mPerDegLat;
  const z1 = -(c.south - O.lat) * O.mPerDegLat;

  let claimedInCore = 0;
  let coreCells = 0;
  for (let r = 0; r < terrain.rows; r++) {
    const z = terrain.z0 + r * terrain.cell;
    if (z < z0 || z > z1) continue;
    for (let cc = 0; cc < terrain.cols; cc++) {
      const x = terrain.x0 + cc * terrain.cell;
      if (x < x0 || x > x1) continue;
      coreCells++;
      if (idx[r * terrain.cols + cc] !== NONE_INDEX) claimedInCore++;
    }
  }
  assert.ok(coreCells > 100_000, "the campus box should cover ~230k cells of this grid");
  assert.equal(claimedInCore, 0,
    `${claimedInCore} cells inside the campus box carry a regional colour — the campus owns those, ` +
    "measured finer and with the Eighth College construction zone deliberately rejected");

  /* Roofs likewise: region-osm.json already drops footprints whose centroid
     falls in the core, and this asserts that upstream rule still holds rather
     than assuming it. */
  assert.equal(colors.stats.roofs.insideCampusBox, 0,
    "region-osm.json is supposed to have excluded campus footprints already");
});

/* ------------------------------------------------------------- provenance */

test("the file states where its colours came from", () => {
  assert.equal(colors.source.zoom, ZOOM);
  assert.ok(colors.source.attribution, "no attribution recorded for the imagery source");
  assert.ok(colors.source.mPerPx > 0.2 && colors.source.mPerPx < 0.3,
    `z${ZOOM} at this latitude is ~0.25 m/px, not ${colors.source.mPerPx}`);
  assert.ok(colors.epoch?.campusBox, "the epoch note must say what happens to the campus box");
  assert.ok(colors.epoch?.construction, "the epoch note must say how construction sites are handled");
  assert.match(colors._, /BUILD-TIME SOURCE/,
    "the header must state that the imagery is a build-time source and never a texture");
  /* The flag withholds colour; it does not identify building sites, and a
     cross-check against the 2014 LiDAR found no enrichment. The file has to say
     so, because `suspect` is exactly the kind of field a later reader would
     otherwise take as a construction list. */
  assert.match(colors.epoch.construction, /NOT as 'under construction'/,
    "the epoch note must not let `suspect` be read as a construction detector");
});
