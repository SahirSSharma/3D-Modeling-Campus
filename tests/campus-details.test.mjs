// The furniture invariants: placed by rule, never inside a wall.
//
// placeDetails() is pure, so these run the exact placement the renderer
// uses. A lamp inside Geisel or a bench rendered into a hedge fails here,
// not on the site.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { placeDetails, DETAIL_COLORS } from "../docs/js/campus-details.js";

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs", "data");
const campus = JSON.parse(readFileSync(path.join(DATA, "campus-3d.json")));
const d = placeDetails(campus);

test("the lamp rows exist at the footage's rhythm, and nothing exploded", () => {
  /* The majors total a few kilometres; at ~18 m spacing that is a low
     hundreds of lamps. Zero means the path names drifted; thousands means
     the spacing rule broke. */
  assert.ok(d.lamps.length > 80, `only ${d.lamps.length} lamps`);
  assert.ok(d.lamps.length < 1200, `${d.lamps.length} lamps is a pileup`);
  assert.ok(d.benches.length > 4, `only ${d.benches.length} benches on Library Walk`);
  assert.ok(d.towers.length > 3, `only ${d.towers.length} emergency towers`);
  assert.ok(d.hydrants.length > 8, `only ${d.hydrants.length} hydrants`);
  assert.ok(d.trash.length > 8, `only ${d.trash.length} trash pairs`);
  assert.ok(d.racks.length > 4, `only ${d.racks.length} bike-rack rows`);
  assert.ok(d.kiosks.length > 3, `only ${d.kiosks.length} wayfinding kiosks`);
});

test("banners ride every second lamp and carry real zone colours", () => {
  const bannered = d.lamps.filter((l) => l.banner);
  assert.ok(bannered.length >= d.lamps.length / 3, "banner rhythm lost");
  for (const l of bannered) assert.match(l.banner, /^#[0-9a-f]{6}$/);
  for (const hex of Object.values(DETAIL_COLORS)) assert.match(hex, /^#[0-9a-f]{6}$/);
});

test("nothing stands inside a building footprint", () => {
  const inRing = (x, z, ring) => {
    let ins = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, zi] = ring[i];
      const [xj, zj] = ring[j];
      if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
    }
    return ins;
  };
  const offenders = [];
  const all = [...d.lamps, ...d.benches, ...d.towers, ...d.hydrants, ...d.trash, ...d.racks, ...d.kiosks];
  for (const { x, z } of all) {
    for (const b of campus.buildings) {
      if (b.p?.length >= 3 && inRing(x, z, b.p)) {
        offenders.push(`(${Math.round(x)}, ${Math.round(z)}) in ${b.n || "unnamed"}`);
        break;
      }
    }
  }
  assert.deepEqual(offenders.slice(0, 6), [], `${offenders.length} placements inside buildings`);
});

test("placement is deterministic", () => {
  const again = placeDetails(campus);
  assert.deepEqual(again.lamps.slice(0, 20), d.lamps.slice(0, 20));
  assert.equal(again.lamps.length, d.lamps.length);
});

test("no two placements pile onto the same spot", () => {
  const all = [...d.lamps, ...d.benches, ...d.towers, ...d.hydrants, ...d.trash, ...d.racks, ...d.kiosks];
  const close = [];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const dx = all[i].x - all[j].x;
      const dz = all[i].z - all[j].z;
      if (dx * dx + dz * dz < 1.5 * 1.5) close.push([i, j]);
    }
  }
  assert.deepEqual(close.slice(0, 4), [], `${close.length} placement pairs closer than 1.5 m`);
});
