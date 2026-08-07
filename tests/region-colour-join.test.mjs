// The two colour joins, and the ways they are allowed to fail.
//
// Both are keyed POSITIONALLY — the ground colours by terrain-cell index, the
// roof colours by index into the building array — which makes them O(1) and
// makes them silently wrong if either file is rebuilt without the other. A
// stale ground grid offsets every colour in the world by some number of cells;
// a stale roof table paints one house's roof onto another. Neither throws,
// neither looks broken in code, and both would ship.
//
// So the contract these pin is: when the join does not line up, REFUSE it and
// fall back to the honest inherited colour. Never draw a colour that might
// belong to somewhere else.
import test from "node:test";
import assert from "node:assert/strict";
import { regionColorLookup } from "../docs/js/campus-region.js";
import { roofColorsFor } from "../docs/js/campus-region-massing.js";

const HEADER = { x0: -3111, z0: -3555, cell: 6, cols: 4, rows: 3, nodata: -32768 };
const b64 = (bytes) => Buffer.from(bytes).toString("base64");

const goodGrid = {
  terrain: {
    x0: -3111, z0: -3555, cell: 6, cols: 4, rows: 3,
    palette: ["#000000", "#ff0000", "#00ff00"],
    none: 255,
    idx: b64([0, 1, 2, 255, 1, 1, 2, 0, 255, 2, 0, 1]),
  },
};

test("a matching ground grid decodes to its measured colours", () => {
  const at = regionColorLookup(goodGrid, HEADER);
  assert.ok(at, "a well-formed matching grid must be accepted");
  const red = at(1, 0);
  assert.ok(red[0] > 0.9 && red[1] < 0.05 && red[2] < 0.05, `expected red, got ${red}`);
  const green = at(2, 0);
  assert.ok(green[1] > 0.9 && green[0] < 0.05, `expected green, got ${green}`);
});

test("the reserved index falls back rather than rendering as a colour", () => {
  const at = regionColorLookup(goodGrid, HEADER);
  /* Cell (3,0) is `none`. It must come back as the inherited tan, NOT as
     palette[255] (undefined) and emphatically not as black — an unsampled
     patch of ground rendering black would read as a hole in the world. */
  const c = at(3, 0);
  assert.ok(c.every((v) => v > 0.1), `unsampled cell should fall back, got ${c}`);
});

test("a ground grid that does not line up is refused entirely", () => {
  for (const [field, value] of [
    ["x0", -3105], ["z0", -3549], ["cell", 3], ["cols", 5], ["rows", 4],
  ]) {
    const bad = { terrain: { ...goodGrid.terrain, [field]: value } };
    assert.equal(
      regionColorLookup(bad, HEADER), null,
      `a grid with a different ${field} must be refused, not drawn offset`
    );
  }
  /* And an index array of the wrong length, which is the same disease. */
  const short = { terrain: { ...goodGrid.terrain, idx: b64([0, 1, 2]) } };
  assert.equal(regionColorLookup(short, HEADER), null);
});

test("absent colour data is not an error, it is the inherited tone", () => {
  assert.equal(regionColorLookup(null, HEADER), null);
  assert.equal(regionColorLookup({}, HEADER), null);
  assert.equal(regionColorLookup({ terrain: { idx: "", palette: [] } }, HEADER), null);
});

const osm = { buildings: [{ p: [[0, 0]] }, { p: [[1, 1]] }, { p: [[2, 2]] }] };

test("roof colours join by index when the count matches", () => {
  const colors = { footprints: { count: 3 }, roofs: { 0: "#804020", 2: "#ffffff" } };
  const out = roofColorsFor(osm, colors);
  assert.ok(Array.isArray(out) && out.length === 3);
  assert.ok(out[0][0] > out[0][2], "expected a warm roof at index 0");
  assert.equal(out[1], null, "an unsampled roof must stay null, not become black");
  assert.ok(out[2].every((v) => v > 0.9));
});

test("a roof table measured against a different pull is refused", () => {
  const stale = { footprints: { count: 4 }, roofs: { 0: "#804020" } };
  assert.equal(
    roofColorsFor(osm, stale), null,
    "a count mismatch means the indices mean different buildings — refuse"
  );
  assert.equal(roofColorsFor(osm, null), null);
  assert.equal(roofColorsFor(osm, { footprints: { count: 3 } }), null);
});

test("a roof index outside the pull is dropped, not written past the end", () => {
  const colors = { footprints: { count: 3 }, roofs: { 0: "#804020", 99: "#ff0000", x: "#00ff00" } };
  const out = roofColorsFor(osm, colors);
  assert.equal(out.length, 3);
  assert.ok(out[0], "the valid entry still lands");
});
