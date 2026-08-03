// The satellite ground layer's invariants.
//
// Everything here runs from the SHIPPED files — the boundary polygon, the
// texture manifest, the JPEGs on disk and the two data files — with no
// network and no browser, exactly like the rest of the suite. Each test is
// one way this layer can silently go wrong: a manifest that no longer tiles
// the terrain, a texture file that fell out of sync with its manifest entry,
// a boundary ring that stopped being a ring, or a building left standing
// past the edge of the ground.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  makeHeightSampler, chunkGrid, pointInRings, rectIntersectsRings, APRON_REACH,
} from "../docs/js/campus-terrain.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));

const campus = read("docs/data/campus-3d.json");
const lidar = read("docs/data/campus-lidar.json");
const boundary = read("docs/data/campus-boundary.json");
const manifest = read("docs/data/textures/manifest.json");
const TEX_DIR = path.join(ROOT, "docs/data/textures");

const terrain = lidar.terrain;
const T = {
  x0: terrain.x0,
  z0: terrain.z0,
  x1: terrain.x0 + (terrain.cols - 1) * terrain.cell,
  z1: terrain.z0 + (terrain.rows - 1) * terrain.cell,
};

/* --------------------------------------------------------------- boundary */

test("boundary: main ring is closed, sane, and sits on measured ground", () => {
  const pts = boundary.points;
  assert.ok(Array.isArray(pts) && pts.length >= 50, "a real campus edge has many vertices");
  assert.deepEqual(pts[0], pts[pts.length - 1], "ring must be closed (first == last)");
  for (const [x, z] of pts) {
    assert.ok(Math.abs(x) < 20000 && Math.abs(z) < 20000, `absurd coordinate ${x},${z}`);
  }
  /* The full-campus terrain sheet reaches PAST the boundary (that contrast —
     photo inside the line, stylized La Jolla outside it — is the point), so
     the containment runs the other way: the campus proper must be inside the
     ring, and the ring must have measured ground under nearly all of it. */
  for (const name of ["Argo Hall", "Geisel Library", "Peterson Hall"]) {
    const p = campus.places[name];
    assert.ok(p, `${name} missing from places`);
    assert.ok(pointInRings(p.x, p.z, boundary.rings), `${name} outside the campus boundary`);
  }
  const pad = 600; // the ring's far lobes may run a little past the sheet
  for (const [x, z] of pts) {
    assert.ok(
      x > T.x0 - pad && x < T.x1 + pad && z > T.z0 - pad && z < T.z1 + pad,
      `boundary point ${x},${z} far beyond the terrain sheet`
    );
  }
});

test("boundary: local frame matches campus-3d.json's origin", () => {
  assert.deepEqual(boundary.origin, campus.origin);
});

/* --------------------------------------------------------------- manifest */

test("manifest: chunks are exactly the boundary-touching subset of the grid", () => {
  /* Imagery exists precisely where the campus is: every grid chunk that
     touches the boundary polygon ships a texture, every chunk that misses it
     ships none (the renderer keeps its NAIP colours there), and every rect
     matches the live grid — the renderer refuses a manifest whose rects
     drifted, so this test failing means the SITE would show no imagery. */
  const expected = chunkGrid(terrain).filter((c) =>
    rectIntersectsRings(c.x0, c.z0, c.x1, c.z1, boundary.rings)
  );
  assert.ok(expected.length >= 10, `only ${expected.length} grid chunks touch the boundary`);
  assert.equal(manifest.chunks.length, expected.length);
  const seen = new Set();
  for (const want of expected) {
    const got = manifest.chunks.find((c) => c.ci === want.ci && c.ri === want.ri);
    assert.ok(got, `chunk ${want.ci},${want.ri} missing from manifest`);
    assert.ok(!seen.has(got.file), `duplicate manifest entry ${got.file}`);
    seen.add(got.file);
    for (const k of ["x0", "z0", "x1", "z1"]) {
      assert.equal(got[k], want[k], `chunk ${want.ci},${want.ri} rect ${k} drifted`);
    }
  }
});

test("manifest: every referenced file exists, every file present is referenced", () => {
  const referenced = new Set(manifest.chunks.map((c) => c.file));
  for (const c of manifest.chunks) {
    assert.ok(fs.existsSync(path.join(TEX_DIR, c.file)), `missing texture ${c.file}`);
    const ppm = c.w / (c.x1 - c.x0);
    assert.ok(ppm === 4 || ppm === 8, `chunk ${c.file}: unexpected scale ${ppm} px/m`);
    assert.equal(c.h / (c.z1 - c.z0), ppm, `chunk ${c.file}: anisotropic pixels`);
  }
  for (const f of fs.readdirSync(TEX_DIR)) {
    if (f === "manifest.json" || f.startsWith(".")) continue;
    assert.ok(referenced.has(f), `orphan file in textures/: ${f}`);
  }
  const bytes = manifest.chunks.reduce(
    (n, c) => n + fs.statSync(path.join(TEX_DIR, c.file)).size, 0
  );
  assert.ok(bytes <= 90 * 1048576, `texture budget blown: ${bytes} bytes`);
});

test("manifest: no API key, no session token in any shipped json", () => {
  for (const p of ["docs/data/textures/manifest.json", "docs/data/campus-boundary.json"]) {
    const text = fs.readFileSync(path.join(ROOT, p), "utf8");
    assert.ok(!/AIza|session|key=/i.test(text), `${p} leaks credentials`);
  }
});

test("no key-shaped string anywhere in the shipped site", () => {
  /* The two build outputs above get the strict scan; this walks EVERYTHING
     the site ships (docs/ text files, vendor included) for anything shaped
     like a Google API key. The pattern below is a scan pattern, not a key. */
  const KEY = /AIza[0-9A-Za-z_-]{30}/;
  const TEXT = new Set([".js", ".mjs", ".json", ".html", ".css", ".md", ".svg", ".txt"]);
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(p); continue; }
      if (!TEXT.has(path.extname(entry.name))) continue;
      const text = fs.readFileSync(p, "utf8");
      assert.ok(!KEY.test(text), `${path.relative(ROOT, p)} contains a key-shaped string`);
    }
  };
  walk(path.join(ROOT, "docs"));
});

test("manifest: baked ground colour matches the renderer's GROUND_COLOR", () => {
  const world = fs.readFileSync(path.join(ROOT, "docs/js/campus-world.js"), "utf8");
  const hex = world.match(/GROUND_COLOR = 0x([0-9a-f]{6})/)[1];
  assert.equal(manifest.groundColor, `#${hex}`);
});

/* ----------------------------------------------- a landmark, in its place */

test("Muir field lands in the right chunk at the right pixel", () => {
  /* Independent pin (not read from the data): the recreation field west of
     Ridge Walk below Muir College. */
  const PIN = { lat: 32.87694, lng: -117.24281 };
  const { lat: LAT0, lng: LNG0, mPerDegLat, mPerDegLng } = campus.origin;
  const x = (PIN.lng - LNG0) * mPerDegLng;
  const z = -(PIN.lat - LAT0) * mPerDegLat;

  /* The data must agree with the pin: the nearest big green's centroid. */
  let best = null;
  for (const s of campus.surfaces) {
    if (s.kind !== "green") continue;
    let a = 0, cx = 0, cz = 0;
    for (let i = 0, j = s.p.length - 1; i < s.p.length; j = i++) {
      a += s.p[j][0] * s.p[i][1] - s.p[i][0] * s.p[j][1];
      cx += s.p[i][0]; cz += s.p[i][1];
    }
    if (Math.abs(a / 2) < 5000) continue;
    cx /= s.p.length; cz /= s.p.length;
    const d = Math.hypot(cx - x, cz - z);
    if (!best || d < best.d) best = { d, cx, cz };
  }
  assert.ok(best && best.d < 15, `nearest big field is ${best?.d?.toFixed(1)} m from the pin`);

  /* It must fall inside exactly one chunk, at the expected UV. */
  const owners = manifest.chunks.filter(
    (c) => x >= c.x0 && x < c.x1 && z >= c.z0 && z < c.z1
  );
  assert.equal(owners.length, 1, "point must belong to exactly one chunk");
  const c = owners[0];
  assert.ok(fs.existsSync(path.join(TEX_DIR, c.file)));
  const u = (x - c.x0) / (c.x1 - c.x0);
  const v = (z - c.z0) / (c.z1 - c.z0);
  assert.ok(u > 0 && u < 1 && v > 0 && v < 1);
  /* Round-trip: the pixel the UV names must map back to the point within
     2 m — catches a flipped axis or an off-by-one-chunk rect immediately. */
  const px = u * c.w;
  const py = v * c.h;
  const ppm = c.w / (c.x1 - c.x0);
  assert.ok(Math.abs(c.x0 + px / ppm - x) < 2);
  assert.ok(Math.abs(c.z0 + py / ppm - z) < 2);
  /* And this field earned zoom 20 — the surface markings are the point. */
  assert.equal(c.zoom, 20, "a recreation field must be a fine-zoom chunk");
});

/* --------------------------------------------------- R3: nothing floating */

test("height sampler clamps to the edge instead of answering datum 0", () => {
  const g = makeHeightSampler(terrain);
  const zMid = (T.z0 + T.z1) / 2;
  const edgeW = g.heightAt(T.x0, zMid);
  assert.equal(g.heightAt(T.x0 - 500, zMid), edgeW, "west overshoot must clamp to west edge");
  assert.equal(g.heightAt(T.x1 + 500, zMid), g.heightAt(T.x1, zMid));
  assert.equal(g.heightAt((T.x0 + T.x1) / 2, T.z1 + 999), g.heightAt((T.x0 + T.x1) / 2, T.z1));
  /* The old bug: outside the grid the sampler said 0 (datum) even where the
     real edge is many metres away from datum. */
  const swCorner = g.heightAt(T.x0 - 100, T.z1 + 100);
  assert.equal(swCorner, g.heightAt(T.x0, T.z1));
  assert.notEqual(swCorner, 0, "south-west corner really is far from the datum");
});

test("every building stands on covered ground (grid + apron)", () => {
  const g = makeHeightSampler(terrain);
  for (const [i, b] of campus.buildings.entries()) {
    let cx = 0, cz = 0;
    for (const [x, z] of b.p) { cx += x; cz += z; }
    cx /= b.p.length; cz /= b.p.length;
    assert.ok(
      cx >= g.coverage.x0 && cx <= g.coverage.x1 &&
      cz >= g.coverage.z0 && cz <= g.coverage.z1,
      `building ${i} (${b.n || "unnamed"}) centre ${cx.toFixed(0)},${cz.toFixed(0)} ` +
      `outside ground coverage — widen APRON_REACH (${APRON_REACH})`
    );
    for (const [x, z] of b.p) {
      assert.ok(
        x >= g.coverage.x0 && x <= g.coverage.x1 &&
        z >= g.coverage.z0 && z <= g.coverage.z1,
        `building ${i} (${b.n || "unnamed"}) vertex ${x},${z} hangs past the apron`
      );
    }
  }
});
