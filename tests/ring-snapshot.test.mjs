/* The overlay projection, pinned without touching the network.
 *
 * `ring-snapshot.mjs` draws a footprint on a satellite image so a person can
 * tell WHICH building a ring describes. Its whole value is that the outline is
 * a geometric statement rather than an eyeballed one — and a wrong projection
 * still produces a confident magenta polygon sitting neatly on the wrong roof.
 * Nothing about the picture would look broken.
 *
 * The failure with teeth is the scale factor. Apple renders the snapshot at
 * scale 2, so Mercator pixels must be doubled; forgetting it draws the polygon
 * at half size, still plausibly on a building, just not the right one. So the
 * test is a scale test: project a ring and check the enclosed pixel area agrees
 * with the ring's own area in square metres.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mercX, mercY, mPerMercPx } from "../scripts/lib/imagery.mjs";

const campus = JSON.parse(readFileSync(new URL("../docs/data/campus-3d.json", import.meta.url), "utf8"));
const { lat: LAT0, lng: LNG0, mPerDegLat, mPerDegLng } = campus.origin;
const toLatLng = (x, z) => ({ lat: LAT0 - z / mPerDegLat, lng: LNG0 + x / mPerDegLng });

const ZOOM = 20, SCALE = 2, IMG = 640 * SCALE;

const shoelace = (pts) => {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    a += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
  }
  return Math.abs(a / 2);
};

/* The same projection ring-snapshot.mjs performs, to image pixels. */
function project(ring) {
  let sx = 0, sz = 0;
  for (const [x, z] of ring) { sx += x; sz += z; }
  const centre = toLatLng(sx / ring.length, sz / ring.length);
  const cx = mercX(centre.lng, ZOOM) * SCALE;
  const cy = mercY(centre.lat, ZOOM) * SCALE;
  return {
    centre,
    px: ring.map(([x, z]) => {
      const { lat, lng } = toLatLng(x, z);
      return [mercX(lng, ZOOM) * SCALE - cx + IMG / 2, mercY(lat, ZOOM) * SCALE - cy + IMG / 2];
    }),
  };
}

describe("ring overlay projection", () => {
  /* Rings that have actually been adjudicated from imagery, so a regression
     here breaks work someone already relied on. */
  const CASES = [899, 17, 131, 140];

  test("a projected footprint encloses the area the footprint has", () => {
    for (const bi of CASES) {
      const ring = campus.buildings[bi]?.p;
      assert.ok(ring?.length >= 3, `osm:${bi} has no footprint`);
      const { centre, px } = project(ring);
      /* Mercator pixels are not metres — the scale depends on latitude, and at
         scale 2 each image pixel is half a Mercator pixel. */
      const mPerPx = mPerMercPx(ZOOM, centre.lat) / SCALE;
      const areaFromPixels = shoelace(px) * mPerPx * mPerPx;
      const areaFromMetres = shoelace(ring);
      const ratio = areaFromPixels / areaFromMetres;
      assert.ok(ratio > 0.9 && ratio < 1.1,
        `osm:${bi}: overlay encloses ${areaFromPixels.toFixed(0)} m² for a ${areaFromMetres.toFixed(0)} m² ring (ratio ${ratio.toFixed(2)}) — check the scale factor`);
    }
  });

  test("the footprint lands inside the image, not off its edge", () => {
    /* Centred on its own centroid, a campus building must fit a 1280 px frame
       at z20 — about 76 m across. A ring that spills out is a sign the centre
       or the projection disagree, which is the other way this goes wrong. */
    for (const bi of CASES) {
      const { px } = project(campus.buildings[bi].p);
      for (const [x, y] of px) {
        assert.ok(x >= 0 && x <= IMG && y >= 0 && y <= IMG,
          `osm:${bi}: vertex projects to ${x.toFixed(0)},${y.toFixed(0)} outside the ${IMG}px frame`);
      }
    }
  });

  test("halving the scale would be caught", () => {
    /* The bug this file exists for, demonstrated: at scale 1 the polygon covers
       a quarter of the area and the test above must reject it. */
    const ring = campus.buildings[899].p;
    let sx = 0, sz = 0;
    for (const [x, z] of ring) { sx += x; sz += z; }
    const centre = toLatLng(sx / ring.length, sz / ring.length);
    const cx = mercX(centre.lng, ZOOM), cy = mercY(centre.lat, ZOOM);
    const wrong = ring.map(([x, z]) => {
      const { lat, lng } = toLatLng(x, z);
      return [mercX(lng, ZOOM) - cx + IMG / 2, mercY(lat, ZOOM) - cy + IMG / 2];
    });
    const mPerPx = mPerMercPx(ZOOM, centre.lat) / SCALE;
    const ratio = (shoelace(wrong) * mPerPx * mPerPx) / shoelace(ring);
    assert.ok(ratio < 0.5, `an unscaled projection should be visibly small, got ratio ${ratio.toFixed(2)}`);
  });
});
