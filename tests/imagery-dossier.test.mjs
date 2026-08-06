/* The local-metre → lat/lng conversion, pinned against a second source.
 *
 * The imagery work-list exists so a person can open a building and look at it.
 * If its coordinates are wrong the work-list is worse than useless: every row
 * sends someone to photograph the wrong building, and the resulting "evidence"
 * would be filed against a ring it never described.
 *
 * The first version of the converter added z to latitude instead of
 * subtracting it. That mirrors the campus about its own origin — Geisel came
 * out 687 m south, in Revelle; RIMAC missed by 1.7 km. Nothing in the output
 * looks wrong; the JSON is well-formed and the links open on real buildings.
 * Only a cross-check catches it, so there is one.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const ROOT = new URL("../", import.meta.url);
const campus = JSON.parse(readFileSync(new URL("docs/data/campus-3d.json", ROOT), "utf8"));
const { lat: LAT0, lng: LNG0, mPerDegLat, mPerDegLng } = campus.origin;

/* The same conversion the dossier uses, stated once here so a change to it
   fails this test rather than silently relocating the campus. */
const toLatLng = (x, z) => ({ lat: LAT0 - z / mPerDegLat, lng: LNG0 + x / mPerDegLng });

describe("local metres to lat/lng", () => {
  test("agrees with the shard generator, which publishes both frames", () => {
    /* gauntlet-shards.mjs emits every shard as BOTH a lat/lng bbox and a local
       metre box. Those are two independent expressions of one boundary, which
       makes them the ideal cross-check — if the converter disagrees with them,
       one of the two is wrong and it matters which. */
    const shards = JSON.parse(
      execFileSync("node", [new URL("scripts/gauntlet-shards.mjs", ROOT).pathname, "--json"], { encoding: "utf8" })
    );
    assert.ok(shards.length >= 4, "no shards to check against");
    for (const s of shards) {
      const nw = toLatLng(s.localBox.x0, s.localBox.z0);
      const se = toLatLng(s.localBox.x1, s.localBox.z1);
      /* Within a metre, expressed in degrees. Anything looser would let the
         sign error through on a small shard. */
      assert.ok(Math.abs(nw.lat - s.bbox.north) * mPerDegLat < 1,
        `${s.id}: z0 maps to ${nw.lat}, shard says north is ${s.bbox.north}`);
      assert.ok(Math.abs(se.lat - s.bbox.south) * mPerDegLat < 1,
        `${s.id}: z1 maps to ${se.lat}, shard says south is ${s.bbox.south}`);
      assert.ok(Math.abs(nw.lng - s.bbox.west) * mPerDegLng < 1, `${s.id}: west edge`);
      assert.ok(Math.abs(se.lng - s.bbox.east) * mPerDegLng < 1, `${s.id}: east edge`);
    }
  });

  test("puts Geisel Library where Geisel Library is", () => {
    /* A named landmark at a coordinate anyone can check. 150 m of tolerance
       because a place entry is a mass centroid rather than a survey pin — wide
       enough not to be brittle, far tighter than the 687 m the bug produced. */
    const p = campus.places["Geisel Library"];
    assert.ok(p, "Geisel Library is not in the places table");
    const { lat, lng } = toLatLng(p.x, p.z);
    const miss = Math.hypot((lat - 32.8811) * mPerDegLat, (lng + 117.2374) * mPerDegLng);
    assert.ok(miss < 150, `Geisel resolved ${miss.toFixed(0)} m from its real position`);
  });

  test("north of the origin really is north", () => {
    /* The bare directional claim, so the reason survives even if both
       cross-checks above are ever rewritten: negative z is north. */
    assert.ok(toLatLng(0, -500).lat > toLatLng(0, 500).lat);
  });
});
