// The region: scope boundary and regional terrain.
//
// The load-bearing test here is the SEAM. The campus grid and the regional
// grid are built by different scripts at different samplings, and where they
// overlap they describe the same ground. If they ever stop agreeing, the world
// gets a step in it at the campus edge — the one place a seam would be most
// visible, because it is where everything already built lives.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createExplore } from "../docs/js/campus-explore.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(path.join(ROOT, p), "utf8"));

const region = read("docs/data/region.json");
const header = read("docs/data/region-terrain.json");
const campus = read("docs/data/campus-lidar.json");
const bin = readFileSync(path.join(ROOT, "docs/data/region-terrain.bin"));
const grid = new Int16Array(bin.buffer, bin.byteOffset, bin.byteLength / 2);

const campusAt = (x, z) => {
  const t = campus.terrain;
  const c = Math.round((x - t.x0) / t.cell);
  const r = Math.round((z - t.z0) / t.cell);
  if (c < 0 || c >= t.cols || r < 0 || r >= t.rows) return null;
  return t.z[r * t.cols + c] / 10;
};

const regionAt = (x, z) => {
  const c = Math.round((x - header.x0) / header.cell);
  const r = Math.round((z - header.z0) / header.cell);
  if (c < 0 || c >= header.cols || r < 0 || r >= header.rows) return null;
  const v = grid[r * header.cols + c];
  return v === header.nodata ? null : v / 10;
};

test("region.json is the outline Sahir drew, georeferenced within its stated error", () => {
  assert.ok(region.polygon.local.length >= 12, "outline should not be a rectangle");
  assert.equal(region.polygon.local.length, region.polygon.lnglat.length);
  /* The fit error is measured against a landmark NOT used to build the fit.
     The builder refuses to write above 400 m; this pins what shipped. */
  assert.ok(
    region.provenance.checkpoint.errorM < 400,
    `georeference error ${region.provenance.checkpoint.errorM} m is too large`
  );
  /* The outline must actually save work over its own bounding box, or the
     clipping is pure cost. */
  assert.ok(
    region.region.polygonAreaKm2 < region.region.bboxAreaKm2 * 0.8,
    "outline should be meaningfully tighter than its bbox"
  );
});

test("the region contains the campus it wraps", () => {
  const { bbox } = region.region;
  const core = region.core;
  assert.ok(bbox.west < core.west && bbox.east > core.east, "region must span the campus in x");
  assert.ok(bbox.south < core.south && bbox.north > core.north, "region must span the campus in z");
});

test("region-terrain.bin matches its header", () => {
  assert.equal(grid.length, header.cols * header.rows);
  assert.equal(header.nodata, -32768);
});

test("the regional grid shares the campus datum and phase", () => {
  /* A different datum is a uniform vertical offset between the two worlds —
     the most invisible-in-code, most visible-on-screen bug available here. */
  assert.equal(header.datum, campus.datum);
  /* Math.abs because a negative offset gives -0, which strict-equals 0 in
     arithmetic but not in assert.equal. */
  assert.equal(Math.abs((header.x0 - campus.terrain.x0) % header.cell), 0);
  assert.equal(Math.abs((header.z0 - campus.terrain.z0) % header.cell), 0);
  /* Phase alignment only means anything if the finer grid divides the coarser
     one exactly. */
  assert.equal(header.cell % campus.terrain.cell, 0);
});

test("the seam is exact: over the campus, the region carries the campus's own heights", () => {
  /* Not "agrees within a tolerance" — IS the same number.
     The regional pass and the campus pass are two independent surveys of the
     same ground at different densities, and where they were merely compared
     they disagreed on 0.12% of the overlap by up to 3.3 m, mostly on ground
     under a roof that neither laser could see. A tolerance would have hidden
     that behind a threshold someone would later have to defend. Instead the
     builder defers: inside the campus box the region takes the campus value
     outright, so a step is not unlikely, it is unrepresentable. */
  const t = campus.terrain;
  let compared = 0;
  let mismatch = null;

  for (let x = t.x0; x <= t.x0 + (t.cols - 1) * t.cell; x += header.cell) {
    for (let z = t.z0; z <= t.z0 + (t.rows - 1) * t.cell; z += header.cell) {
      const a = regionAt(x, z);
      const b = campusAt(x, z);
      if (a == null || b == null) continue;
      compared++;
      if (a !== b && !mismatch) mismatch = { x, z, region: a, campus: b };
    }
  }

  assert.ok(compared > 100_000, `expected a large overlap, got ${compared} samples`);
  assert.equal(mismatch, null, `seam is not exact: ${JSON.stringify(mismatch)}`);
});

test("the campus box is fully carried by the region grid", () => {
  /* Deferral is only a guarantee if it covered everything. A cell the campus
     measured but the region left as nodata would be a hole punched in the
     middle of the world. */
  const t = campus.terrain;
  let missing = 0;
  for (let x = t.x0; x <= t.x0 + (t.cols - 1) * t.cell; x += header.cell) {
    for (let z = t.z0; z <= t.z0 + (t.rows - 1) * t.cell; z += header.cell) {
      if (campusAt(x, z) != null && regionAt(x, z) == null) missing++;
    }
  }
  assert.equal(missing, 0, `${missing} campus cells are nodata in the region grid`);
});

test("every DATA key is unique — a collision silently deletes a layer", () => {
  /* THE BUG THIS PINS, which cost three screenshots to find.
     The loader builds its result as `out[d.key] = parsed[i]`, so two entries
     sharing a key means the second quietly overwrites the first. Adding the
     measured-roofs sidecar under the key `regionHeights` — already taken by
     region-terrain.bin — replaced a 2.8 MB Int16 buffer with a JSON object.
     Nothing threw. `new Int16Array(someObject)` is a zero-length array, not an
     error, so the terrain sampler simply went null, the world fell back to the
     campus apron it had before the region existed, and it all still rendered:
     green ground, blue sky, no console errors, no failing test.
     That is the failure mode worth a test — not the crash, the plausible
     picture of the wrong world. */
  const src = readFileSync(path.join(ROOT, "docs/js/campus-walk.js"), "utf8");
  const table = src.slice(src.indexOf("const DATA = ["), src.indexOf("const urlOf"));
  const keys = [...table.matchAll(/key:\s*"([^"]+)"/g)].map((m) => m[1]);
  const files = [...table.matchAll(/file:\s*"([^"]+)"/g)].map((m) => m[1]);

  assert.ok(keys.length >= 10, `only found ${keys.length} DATA keys — the parse is wrong`);
  assert.equal(keys.length, files.length, "every entry needs both a key and a file");

  const dupKeys = keys.filter((k, i) => keys.indexOf(k) !== i);
  assert.deepEqual(dupKeys, [], `duplicate DATA keys: ${dupKeys.join(", ")}`);
  const dupFiles = files.filter((f, i) => files.indexOf(f) !== i);
  assert.deepEqual(dupFiles, [], `the same file is downloaded twice: ${dupFiles.join(", ")}`);
});

test("free roam can actually reach the region, not just see it", () => {
  /* The wall has to move with the measurements. Until the region existed,
     createExplore derived its clamp from the campus grid alone; leaving it
     that way would have rendered 30 km² of coast that you bounce off an
     invisible wall two kilometres short of. */
  const campusOnly = createExplore({
    campus: { places: {} },
    lidar: { terrain: campus.terrain },
    heightAt: () => 0,
  });
  const withRegion = createExplore({
    campus: { places: {} },
    lidar: { terrain: campus.terrain },
    heightAt: () => 0,
    coverage: { x0: header.x0, z0: header.z0,
                x1: header.x0 + (header.cols - 1) * header.cell,
                z1: header.z0 + (header.rows - 1) * header.cell },
  });

  /* Walk hard west in both and see where each is stopped. */
  const westEdge = (ex) => { ex.enterAt(0, 0, 0); ex.x = -1e6; ex.update(0, new Set()); return ex.x; };
  const campusStop = westEdge(campusOnly);
  const regionStop = westEdge(withRegion);

  assert.ok(
    regionStop < campusStop - 500,
    `region clamp (${regionStop.toFixed(0)}) should reach well past the campus clamp (${campusStop.toFixed(0)})`
  );
  /* And it must still be a wall — inside the measured grid, not past it. */
  assert.ok(regionStop >= header.x0, "clamp escaped the measured grid");
});

test("the region reaches the sea and the mesa tops", () => {
  /* The point of the expansion: the world used to stop at a rectangle on the
     mesa. It now runs down the bluff to the water. */
  assert.ok(header.stats.minM < 2, `lowest measured ground is ${header.stats.minM} m — no beach`);
  assert.ok(header.stats.maxM > 120, `highest measured ground is ${header.stats.maxM} m`);
});

test("open water is left unmeasured rather than invented", () => {
  /* Hole-filling across the coastline would grow a shelf of land out to sea.
     The builder leaves open only the voids whose surrounding land stands at
     sea level, so the ocean must survive the build as one large void. */
  assert.ok(
    header.stats.holes.largestOpen > 10_000,
    "the ocean should remain one large unmeasured void"
  );
  assert.ok(header.stats.openWater > 10_000, "expected meaningful open water in scope");
  /* And out-of-scope cells must not be counted as survey gaps. */
  assert.ok(header.stats.outOfScope > 0);
  assert.equal(header.stats.inScope + header.stats.outOfScope, header.stats.cells);
  assert.equal(header.stats.withHeight + header.stats.openWater, header.stats.inScope);
});

test("no inland void is left for the sea to show through", () => {
  /* The bug this pins: voids were originally judged by SIZE, so any hole
     bigger than 9,000 m² stayed open — and a big-box roof in University City
     is bigger than that, which rendered the Pacific through a warehouse roof
     four kilometres inland. Voids are now judged by the elevation of the land
     around them, so every surviving void must genuinely sit at sea level. */
  const seaDm = Math.round((0 - header.datum) * 10);
  const allowedDm = seaDm + 5 * 10; // WATER_RIM_MAX_M
  let worst = null;

  /* Out-of-scope cells are empty too, and they sit directly against in-scope
     land all along the outline — so a scan that ignores the outline flags the
     boundary itself as a void on a mesa. Only cells the builder actually
     surveyed can be judged. */
  const ring = region.polygon.local;
  const inPoly = (px, pz) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, zi] = ring[i];
      const [xj, zj] = ring[j];
      if (zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
  };

  /* Judged per COMPONENT, the way the builder judges it — not per cell.
     A per-cell scan flags the real ocean wherever the coast is a cliff: at
     La Jolla Cove the water's immediate neighbours are 35 m bluff tops, which
     says nothing about whether the water is water. The property being checked
     is a property of the whole void. */
  const { cols, rows, nodata } = header;
  const seen = new Uint8Array(cols * rows);
  let voids = 0;

  for (let start = 0; start < grid.length; start++) {
    if (seen[start] || grid[start] !== nodata) continue;
    const sr = (start / cols) | 0;
    const sc = start % cols;
    if (!inPoly(header.x0 + sc * header.cell, header.z0 + sr * header.cell)) { seen[start] = 1; continue; }

    const stack = [start];
    const rim = [];
    let cells = 0;
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop();
      cells++;
      const r = (i / cols) | 0;
      const c = i % cols;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) continue;
        const j = rr * cols + cc;
        const v = grid[j];
        if (v !== nodata) { rim.push(v); continue; }
        if (seen[j]) continue;
        if (!inPoly(header.x0 + cc * header.cell, header.z0 + rr * header.cell)) { seen[j] = 1; continue; }
        seen[j] = 1;
        stack.push(j);
      }
    }
    if (!rim.length) continue;
    voids++;
    rim.sort((a, b) => a - b);
    const med = rim[rim.length >> 1];
    if (med > allowedDm && (!worst || med > worst.rimDm)) {
      worst = { x: header.x0 + sc * header.cell, z: header.z0 + sr * header.cell, cells,
                rimDm: med, rimM: Math.round((med / 10 + header.datum) * 10) / 10 };
    }
  }

  assert.ok(voids > 0, "expected at least one water void to judge");
  assert.equal(worst, null, `open void whose surrounding land is inland: ${JSON.stringify(worst)}`);
});

test("the header's own arithmetic holds", () => {
  /* These counts are how anyone later judges whether the region is measured or
     invented, so they have to add up to the file that shipped. */
  const s = header.stats;
  let withHeight = 0;
  for (const v of grid) if (v !== header.nodata) withHeight++;
  assert.equal(withHeight, s.withHeight, "header withHeight does not match the bin");
  assert.ok(s.deferredToCampus > 0, "nothing was deferred to the campus grid");
  assert.ok(
    s.regionalPass.measured > s.deferredToCampus,
    "most of the region should be measured out here, not inherited from campus"
  );
});

/* --------------------------------- the seam the campus and region share */

/* THE BUG THESE PIN. buildRegionMesh used to drop any quad with a corner
   inside the campus box. The campus boundary does not land on the region's 6 m
   lattice, so that threw away ground OUTSIDE the campus too — an unbroken gap
   around the whole perimeter, measured at ~2 m of open sky straight down over
   the east edge and up to a full 12 m quad span elsewhere. Every test here
   fails against that version. */

const { trimQuadToCampus, bilinear } = await import("../docs/js/campus-region.js");

/* The real campus box in local metres, from docs/data/region.json's core. */
const RECT = { x0: -1197, z0: -1382, x1: 1842, z1: 1382 };
const quad = (x, z, span) => ({ x, z, xe: x + span, ze: z + span });

test("a quad well outside the campus is handed back untouched", () => {
  const q = quad(2400, 0, 12);
  assert.equal(trimQuadToCampus(q, RECT), q, "an untouched quad must not even be copied");
});

test("a quad wholly inside the campus is dropped — the campus draws it", () => {
  assert.equal(trimQuadToCampus(quad(0, 0, 12), RECT), null);
});

test("with no campus at all the region keeps everything", () => {
  const q = quad(0, 0, 12);
  assert.equal(trimQuadToCampus(q, null), q);
});

test("a quad straddling an edge is TRIMMED to it, not thrown away", () => {
  /* Straddles the east edge: 4 m inside, 8 m outside. The 8 m outside is
     ground nobody else draws, and dropping it is the perimeter gap. */
  const q = quad(RECT.x1 - 4, 0, 12);
  const t = trimQuadToCampus(q, RECT);
  assert.notEqual(t, null, "the outside part was thrown away — this is the gap");
  assert.equal(t.x, RECT.x1, "the trimmed quad must start exactly on the campus edge");
  assert.equal(t.xe, q.xe, "the outside edge must not move");
  assert.equal(t.ze - t.z, 12, "an edge trim must not shrink the other axis");
});

test("every edge of the campus is trimmed, not just the one we looked at", () => {
  const cases = [
    ["east",  quad(RECT.x1 - 4, 0, 12), (t) => t.x === RECT.x1 && t.xe > RECT.x1],
    ["west",  quad(RECT.x0 - 8, 0, 12), (t) => t.xe === RECT.x0 && t.x < RECT.x0],
    ["south", quad(0, RECT.z1 - 4, 12), (t) => t.z === RECT.z1 && t.ze > RECT.z1],
    ["north", quad(0, RECT.z0 - 8, 12), (t) => t.ze === RECT.z0 && t.z < RECT.z0],
  ];
  for (const [name, q, ok] of cases) {
    const t = trimQuadToCampus(q, RECT);
    assert.notEqual(t, null, `the ${name} edge still drops its straddling quad`);
    assert.ok(ok(t), `the ${name} edge trimmed to the wrong side: ${JSON.stringify(t)}`);
  }
});

test("no trimmed quad ever reaches back inside the campus", () => {
  /* The other half of the contract. Trimming closed the gap; this is what
     stops the fix from re-introducing the coincident triangles the original
     skip existed to prevent. Swept along the whole east edge at sub-cell
     offsets so no phase of the lattice is special. */
  for (let off = 0; off < 12; off += 0.5) {
    for (let z = -1400; z <= 1400; z += 97) {
      const q = quad(RECT.x1 - off, z, 12);
      const t = trimQuadToCampus(q, RECT);
      if (t === null) continue;
      const inside = t.x < RECT.x1 && t.xe > RECT.x0 && t.z < RECT.z1 && t.ze > RECT.z0;
      assert.ok(!inside, `quad at off=${off} z=${z} overlaps the campus: ${JSON.stringify(t)}`);
    }
  }
});

test("the perimeter is left with no gap a quad wide", () => {
  /* The measurement that matters, stated as a property: sweep the east edge
     and confirm the region's ground reaches the campus edge exactly. Under the
     old skip rule the nearest region ground sat up to a full span away. */
  let worst = 0;
  for (let off = 0.5; off < 12; off += 0.5) {
    const t = trimQuadToCampus(quad(RECT.x1 - off, 0, 12), RECT);
    assert.notEqual(t, null, `off=${off} leaves nothing outside the campus`);
    worst = Math.max(worst, t.x - RECT.x1);
  }
  assert.equal(worst, 0, `region ground stops ${worst} m short of the campus edge`);
});

test("a moved corner takes the height the surface already had there", () => {
  /* Trimming moves a vertex, so its height must be resampled or the seam
     steps. Bilinear is exact for the bilinear patch the quad already is —
     which is what makes this a re-read of the surface and not an invention. */
  const q = quad(0, 0, 12);
  const [a, b, d, e] = [10, 22, 16, 28];
  assert.equal(bilinear(q, a, b, d, e, 0, 0), a);
  assert.equal(bilinear(q, a, b, d, e, 12, 0), b);
  assert.equal(bilinear(q, a, b, d, e, 0, 12), d);
  assert.equal(bilinear(q, a, b, d, e, 12, 12), e);
  assert.equal(bilinear(q, a, b, d, e, 6, 0), 16, "midpoint of a linear edge");
  assert.equal(bilinear(q, a, b, d, e, 6, 6), 19, "centre of the patch");
});

test("a degenerate quad interpolates rather than dividing by zero", () => {
  const q = { x: 5, xe: 5, z: 5, ze: 5 };
  assert.equal(bilinear(q, 1, 2, 3, 4, 5, 5), 1);
  assert.ok(Number.isFinite(bilinear(q, 1, 2, 3, 4, 9, 9)));
});
