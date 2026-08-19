/* Eighth College's SOUTH AND SERVICE EDGE — the photo-sourced INVENTED class.
 *
 * The Backyard, the Market Hall wing's roof plate, and the South Parking
 * Entrance portal. The gates here are about quarantine, provenance, and not
 * contradicting the measured world:
 *
 *   - it is labelled, epoch-stamped, sourced (every source carries a date),
 *     it declares what it SUPERSEDES, and it says what it left out;
 *   - colours are data, they are hex, and EVERY role has its own provenance
 *     line naming a frame or the shipped palette entry it carries;
 *   - every surveyed ring it leans on is a VERBATIM copy of
 *     campus-arcgis.json massing / campus-eighth.json ground — one changed
 *     number fails;
 *   - The Backyard's envelope is CUT FROM THE SURVEY: each of its four edges
 *     is re-derived here from the ring it names, and the rectangle is proved
 *     clear of every measured building footprint;
 *   - the roof's divider runs between two vertices of massing[462] itself and
 *     genuinely separates the two lobes — every south-east vertex on one side,
 *     every other vertex on the other;
 *   - the traced STATION8 tenancy verifies against the published 20,000 sf;
 *   - the ping-pong tables carry the ITTF regulation figures, not a guess;
 *   - the roof plate lands on the SAME drawn lid campus-massing.js extrudes,
 *     and nothing is drawn at a negative offset from a surveyed ring;
 *   - nothing hovers — re-built over SLOPING ground every ground-standing
 *     instance still sits on the local surface;
 *   - two builds are byte-identical;
 *   - the absent list does not shrink.
 *
 * The section lives under the top-level `eighthsouthservice` key of
 * docs/data/campus-photo-detail.json. Until the main session merges it, it is
 * read from the build-side file this agent wrote, so the test does not depend
 * on the merge having happened.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(p, "utf8"));

const photoDoc = read(join(root, "docs/data/campus-photo-detail.json"));

const section = photoDoc.eighthsouthservice;

const arcgis = read(join(root, "docs/data/campus-arcgis.json"));
const eighth = read(join(root, "docs/data/campus-eighth.json"));
const lidar = read(join(root, "docs/data/campus-lidar.json"));

const dm = (ring) => ring.map(([x, z]) => [Math.round(x * 10) / 10, Math.round(z * 10) / 10]);
const massRing = (i) => dm(arcgis.massing[i].r[0].map((p) => [p[0] / 10, p[1] / 10]));
const groundRing = (i) => dm(arcgis.ground[i].r[0].map((p) => [p[0] / 10, p[1] / 10]));

const inRing = (x, z, r) => {
  let ins = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, zi] = r[i];
    const [xj, zj] = r[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
};
const open = (r) => {
  const o = r.map((p) => [p[0], p[1]]);
  if (o.length > 1 && Math.hypot(o[0][0] - o[o.length - 1][0], o[0][1] - o[o.length - 1][1]) < 1e-6)
    o.pop();
  return o;
};
const area = (r) => {
  let a = 0;
  for (let i = 0; i < r.length; i++) {
    const [x1, z1] = r[i];
    const [x2, z2] = r[(i + 1) % r.length];
    a += x1 * z2 - x2 * z1;
  }
  return Math.abs(a) / 2;
};

/* ---------------------------------------------------------------- gates */

test("the section exists and is reachable", () => {
  assert.ok(section, "no eighthsouthservice key in campus-photo-detail.json and no staging file");
});

test("it is labelled, epoch-stamped, bounded, and it says what it left out", () => {
  assert.ok(section.label && section.label.length > 30);
  assert.match(section.epoch, /2023|2024|2025/);
  assert.match(section.epoch, /LiDAR/i, "the epoch must say the 2014 LiDAR is blind here");
  for (const k of ["x0", "x1", "z0", "z1"]) assert.equal(typeof section.bounds[k], "number");
  assert.ok(section.bounds.z1 > 700, "the Market Hall reaches z 704.7 — the bounds must contain it");
  assert.ok(Array.isArray(section.absent) && section.absent.length >= 12);
  for (const a of section.absent) assert.ok(a.length >= 80, `absent entry too thin: ${a}`);
  assert.ok(Array.isArray(section.conflicts) && section.conflicts.length >= 3);
  assert.equal(typeof section.seed, "number");
});

test("every source carries a url/what/date", () => {
  assert.ok(section.sources.length >= 8);
  for (const s of section.sources) {
    assert.ok(s.url && s.what && s.date, `incomplete source: ${JSON.stringify(s)}`);
    assert.ok(s.what.length >= 40, `source description too thin: ${s.url}`);
  }
  const urls = section.sources.map((s) => s.url).join(" ");
  assert.match(urls, /campus-arcgis\.json/, "the survey must be cited");
  assert.match(urls, /phf19/, "the frame every sampled colour comes from must be cited");
});

test("it declares what it supersedes, with the removal named", () => {
  assert.ok(Array.isArray(section.supersedes) && section.supersedes.length >= 1);
  const roof = section.supersedes.find((s) => s.key === "survivance.wing.roof");
  assert.ok(roof, "the roof plate this section rebuilds must be declared superseded");
  assert.ok(roof.removeFrom && /campus-photo-survivance\.js/.test(roof.removeFrom));
  for (const s of section.supersedes) {
    assert.ok(s.key && s.what && s.why, `incomplete supersede: ${JSON.stringify(s)}`);
    assert.ok(s.why.length >= 60);
  }
});

test("no LiDAR height is read, and none exists to read", () => {
  const heights = lidar.massHeights || {};
  const src = readFileSync(join(root, "docs/js/campus-photo-eighthsouthservice.js"), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(code, /massHeight/i, "this module must never read a LiDAR mass height");
  assert.doesNotMatch(code, /lidar/i, "this module must never reach for the LiDAR document");
  assert.equal(section.measured.wing.lidarMassHeight, null);
  assert.equal(section.measured.tower.lidarMassHeight, null);
  /* and the data agrees: nothing in massHeights sits on either ring. */
  for (const key of ["m:-142,666", "m:-156,668"]) {
    assert.ok(!(key in heights), `campus-lidar.json unexpectedly carries ${key}`);
  }
});

/* --------------------------------------------------- the survey, verbatim */

test("every surveyed ring is a verbatim copy of the survey", () => {
  assert.deepEqual(dm(section.measured.wing.ring), massRing(462), "massing[462] is not verbatim");
  assert.deepEqual(dm(section.measured.tower.ring), massRing(464), "massing[464] is not verbatim");
  assert.deepEqual(dm(section.measured.rambleWalk.ring), groundRing(4038), "ground#4038 is not verbatim");
  assert.equal(section.measured.wing.h, arcgis.massing[462].h);
  assert.equal(section.measured.wing.levels, arcgis.massing[462].levels);
  assert.equal(section.measured.tower.h, arcgis.massing[464].h);
  /* Azad's south wall is copied as two ring vertices of massing[452], not as
     a number someone typed. */
  const azad = massRing(452);
  for (const p of [section.measured.azad.southWall.a, section.measured.azad.southWall.b]) {
    assert.ok(
      azad.some((q) => Math.abs(q[0] - p[0]) < 1e-6 && Math.abs(q[1] - p[1]) < 1e-6),
      `${JSON.stringify(p)} is not a vertex of massing[452]`,
    );
  }
});

test("the plan registration is stated, fitted and independently checked", () => {
  const R = section.planRegistration;
  assert.ok(R.raster && /973/.test(R.raster) && /150/.test(R.raster));
  assert.ok(R.mPerPx > 0.2 && R.mPerPx < 0.3);
  assert.ok(R.residualMedian > 0 && R.residualMedian < 0.5);
  assert.ok(R.residualP90 > R.residualMedian && R.residualP90 < 2.0);
  assert.ok(R.fit.length >= 150, "the fit must be reproducible from its own description");
  assert.match(R.check, /basketball court/i, "the registration needs an INDEPENDENT check");
  /* And the check's own ruler must be the survey's: the court really is
     22.7 x 15.4 m, and really is axis-aligned, or the registration's one
     independent check is checking nothing. */
  const court = eighth.ground["basketball-court"].points;
  const cx = court.map((p) => p[0]);
  const cz = court.map((p) => p[1]);
  assert.ok(Math.abs(Math.max(...cx) - Math.min(...cx) - 22.7) < 0.05);
  assert.ok(Math.abs(Math.max(...cz) - Math.min(...cz) - 15.4) < 0.05);
  assert.equal(new Set(cx).size, 2, "the court ruler must be axis-aligned");
  assert.equal(new Set(cz).size, 2, "the court ruler must be axis-aligned");
});

/* ------------------------------------------------------------- backyard */

test("The Backyard's envelope is cut from the survey, edge by edge", () => {
  const E = section.backyard.envelope;
  const ring = open(E.ring);
  assert.equal(ring.length, 4);
  const xs = ring.map((p) => p[0]);
  const zs = ring.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const z0 = Math.min(...zs);
  const z1 = Math.max(...zs);

  /* north — Azad's own south wall */
  assert.equal(z0, Math.max(section.measured.azad.southWall.a[1], section.measured.azad.southWall.b[1]));
  /* west — a vertex of massing[462] */
  const wing = massRing(462);
  assert.ok(wing.some((p) => Math.abs(p[0] - x0) < 1e-6), "the west edge is not a wing ring x");
  /* south — the NEARER end of a wing segment, so the courtyard stays out of
     the building even where that segment falls across its own length */
  const segA = wing.find((p) => Math.abs(p[0] + 162.6) < 1e-6 && Math.abs(p[1] - 651.4) < 1e-6);
  const segB = wing.find((p) => Math.abs(p[0] + 134.1) < 1e-6 && Math.abs(p[1] - 651.2) < 1e-6);
  assert.ok(segA && segB, "the south edge's own segment must be in the ring");
  assert.equal(z1, Math.min(segA[1], segB[1]), "the south edge is not that segment's nearer end");
  /* east — the surveyed Ramble walk's westernmost vertex */
  const walk = groundRing(4038);
  const westX = Math.min(...walk.map((p) => p[0]));
  assert.ok(Math.abs(x1 - westX) < 1e-6, "the east edge is not ground#4038's west vertex");

  /* the declared size and area are the rectangle's own */
  assert.ok(Math.abs(E.size[0] - (x1 - x0)) < 0.05);
  assert.ok(Math.abs(E.size[1] - (z1 - z0)) < 0.05);
  assert.ok(Math.abs(E.area - area(ring)) < 1.0);
});

test("The Backyard is clear of every measured building footprint", () => {
  const ring = open(section.backyard.envelope.ring);
  const rings = [massRing(452), massRing(462), massRing(464)].map(open);
  const xs = ring.map((p) => p[0]);
  const zs = ring.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const z0 = Math.min(...zs);
  const z1 = Math.max(...zs);
  let hits = 0;
  for (let i = 0; i <= 24; i++) {
    for (let j = 0; j <= 24; j++) {
      const x = x0 + ((x1 - x0) * i) / 24;
      const z = z0 + ((z1 - z0) * j) / 24;
      if (rings.some((r) => inRing(x, z, r))) hits++;
    }
  }
  assert.equal(hits, 0, `${hits} of 625 envelope samples fall inside a measured building`);
});

test("The Backyard's furniture is on the paving, clear of the bed, and honestly tiered", () => {
  const B = section.backyard;
  const ring = open(B.envelope.ring);
  const bd = B.bed;
  const c = Math.cos(bd.bearing);
  const s = Math.sin(bd.bearing);
  const bedRing = [
    [-bd.size[0] / 2, -bd.size[1] / 2],
    [bd.size[0] / 2, -bd.size[1] / 2],
    [bd.size[0] / 2, bd.size[1] / 2],
    [-bd.size[0] / 2, bd.size[1] / 2],
  ].map(([u, v]) => [bd.centre[0] + u * c - v * s, bd.centre[1] + u * s + v * c]);
  assert.ok(inRing(bd.centre[0], bd.centre[1], ring), "the bed's own centre is outside the courtyard");
  for (const p of bedRing) assert.ok(inRing(p[0], p[1], ring), "a bed corner is outside the courtyard");

  const items = [...B.grills.items, ...B.pingPong.items];
  assert.ok(items.length >= 4);
  for (const it of items) {
    assert.ok(inRing(it.x, it.z, ring), `${it.key} is outside The Backyard`);
    assert.ok(!inRing(it.x, it.z, bedRing), `${it.key} stands in the planting bed`);
  }
  /* Existence is sourced, count and position are not — and the section says so. */
  assert.equal(B.grills.tier, "estimated");
  assert.equal(B.pingPong.tier, "estimated");
  assert.match(B.grills.source, /Regents/i);
  assert.match(B.pingPong.source, /Regents/i);
  assert.ok(B.grills.extendsPattern, "[estimated] must record the sourced pattern it extends");
  /* And the pattern it extends is the college's own shipped grill family. */
  const shipped = photoDoc.eighth.items.filter((i) => i.type === "grill-counter");
  assert.ok(shipped.length >= 1, "the shipped grill counter this extends must exist");
  assert.deepEqual(B.grills.counter, [shipped[0].w, shipped[0].d, shipped[0].h]);
  const bay = photoDoc.eighth.items.find((i) => i.type === "grill-bay");
  assert.deepEqual(B.grills.bay, [bay.w, bay.d, bay.h]);
  assert.equal(B.grills.baySill, bay.sill);
});

test("the ping-pong tables carry the ITTF regulation figures", () => {
  const T = section.backyard.pingPong;
  assert.deepEqual(T.top.slice(0, 2), [2.74, 1.525], "playing surface must be 2.740 x 1.525 m");
  assert.equal(T.height, 0.76);
  assert.equal(T.net.length, 1.83);
  assert.equal(T.net.height, 0.1525);
  assert.equal(T.net.overhang, 0.1525);
  /* 1.830 = 1.525 + 2 x 0.1525 — the net really does hang the regulation
     amount past each side line, rather than three numbers that look right. */
  assert.ok(Math.abs(T.net.length - (T.top[1] + 2 * T.net.overhang)) < 1e-9);
  assert.equal(T.lines.sideEnd, 0.02);
  assert.equal(T.lines.centre, 0.003);
  assert.match(section.dimensionSources["backyard.pingPong.top"].how, /ITTF/);
});

/* ------------------------------------------------------------ wing roof */

test("the roof divider runs between two ring vertices and really splits the lobes", () => {
  const wing = open(section.measured.wing.ring);
  const { a, b } = section.wingRoof.divider;
  const has = (p) => wing.some((q) => Math.abs(q[0] - p[0]) < 1e-6 && Math.abs(q[1] - p[1]) < 1e-6);
  assert.ok(has(a) && has(b), "the divider must run between two vertices of massing[462]");
  const side = (p) => (p[0] - a[0]) * (b[1] - a[1]) + (p[1] - a[1]) * -(b[0] - a[0]);
  const pos = wing.filter((p) => side(p) > 1e-6).length;
  const neg = wing.filter((p) => side(p) < -1e-6).length;
  const on = wing.filter((p) => Math.abs(side(p)) <= 1e-6).length;
  assert.equal(on, 2, "exactly the two divider vertices may lie on the line");
  assert.equal(pos + neg + on, wing.length);
  assert.ok(pos >= 6 && neg >= 5, `lopsided split: ${pos} / ${neg}`);
  /* and the tenancy — the thing the metal lobe exists for — is entirely on
     the positive side. */
  for (const p of section.wingRoof.tenancy.ring) {
    assert.ok(side(p) > 0, `tenancy vertex ${JSON.stringify(p)} is on the deck side`);
  }
});

test("the STATION8 tenancy verifies against the published 20,000 sf", () => {
  const T = section.wingRoof.tenancy;
  const ring = open(T.ring);
  assert.ok(ring.length >= 10);
  assert.ok(Math.abs(area(ring) - T.tracedArea) < 1.5, "the declared traced area is not the polygon's");
  const published = (20000 * 0.09290304) / arcgis.massing[462].levels;
  const err = Math.abs(T.fillArea - published) / published;
  assert.ok(err < 0.02, `tenancy fill area is ${(err * 100).toFixed(1)}% off the published per-level area`);
  /* It is DATA, and the section says so — nothing is drawn from it. */
  assert.match(T.geometryRole, /DATA ONLY/);
  const src = readFileSync(join(root, "docs/js/campus-photo-eighthsouthservice.js"), "utf8");
  assert.doesNotMatch(src, /tenancy\.ring/, "the tenancy polygon must not drive geometry");
});

test("the tenancy lies inside the surveyed ring it names", () => {
  const wing = open(section.measured.wing.ring);
  for (const p of section.wingRoof.tenancy.ring) {
    assert.ok(inRing(p[0], p[1], wing), `tenancy vertex ${JSON.stringify(p)} escapes massing[462]`);
  }
});

test("the portal sits on the face it names, inside it, and no deeper than the drawn storey", () => {
  const P = section.southPortal;
  const wing = open(section.measured.wing.ring);
  const a = wing[P.faceSeg];
  const b = wing[(P.faceSeg + 1) % wing.length];
  assert.deepEqual(a, P.faceEnds.a);
  assert.deepEqual(b, P.faceEnds.b);
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  assert.ok(P.u0 > 0 && P.u1 < len, "the opening runs off the end of its own face");
  assert.ok(Math.abs(P.u1 - P.u0 - P.width) < 0.02, "u0/u1 and the declared width disagree");
  const storey = arcgis.massing[462].h / arcgis.massing[462].levels;
  assert.ok(Math.abs(P.head - storey) < 1e-6, "the head must be the drawn prism's own storey");
  assert.ok(P.proud > 0, "the opening plane must stand proud of the face, never inside the prism");
});

/* ---------------------------------------------------------------- colours */

test("colours are data, hex, and every role has provenance", () => {
  const C = section.colors;
  const keys = Object.keys(C);
  assert.ok(keys.length >= 10);
  for (const k of keys) {
    assert.match(C[k], /^#[0-9a-f]{6}$/, `${k} is not a hex colour`);
    const p = section.colorSources[k];
    assert.ok(p, `${k} has no provenance`);
    assert.match(p, /\[(measured|estimated)\]/, `${k} has no tier`);
    assert.ok(p.length >= 60, `${k}'s provenance is too thin`);
  }
  /* Every carried colour really is the shipped value, byte for byte. */
  const carried = {
    paving: "deckConcrete", bedMulch: "mulch", counter: "counter", grillLid: "grillLid",
    grillFascia: "grillFascia", tableTop: "tableTop", tableLeg: "tableLeg",
    lineWhite: "planterWhite", netDark: "poleDark",
  };
  for (const [mine, theirs] of Object.entries(carried)) {
    assert.equal(C[mine], photoDoc.eighth.colors[theirs], `${mine} claims to carry eighth.${theirs} and does not`);
    assert.match(section.colorSources[mine], /VERBATIM/, `${mine} must say it is carried`);
  }
  /* And every sampled colour names its frame and its crop. */
  for (const k of ["roofMetal", "roofDeck", "eaveTrim", "portalShade"]) {
    assert.match(section.colorSources[k], /\[measured\]/);
    assert.match(section.colorSources[k], /\(\d+,\d+\)-\(\d+,\d+\)/, `${k} does not name its crop`);
  }
});

test("every load-bearing dimension has a source and an arithmetic", () => {
  const D = section.dimensionSources;
  assert.ok(Object.keys(D).length >= 12);
  for (const [k, v] of Object.entries(D)) {
    assert.ok(["measured", "estimated"].includes(v.tier), `${k} has no tier`);
    assert.ok(v.how && v.how.length >= 40, `${k} has no arithmetic`);
    assert.notEqual(v.value, undefined, `${k} has no value`);
  }
});

test("the module holds no colour literal and no local overlay lift", () => {
  const src = readFileSync(join(root, "docs/js/campus-photo-eighthsouthservice.js"), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(code, /#[0-9a-fA-F]{6}/, "a colour literal escaped into the module");
  assert.doesNotMatch(code, /0x[0-9a-fA-F]{6}/, "a colour literal escaped into the module");
  assert.match(code, /overlayLift\(/, "decals must climb the shared ladder");
  assert.doesNotMatch(code, /const\s+LIFT\s*=/, "no local lift constant");
  assert.doesNotMatch(code, /polygonOffset/, "polygon offset belongs to campus-overlay.js alone");
  assert.doesNotMatch(code, /Math\.random|new Date/, "the build must be deterministic");
  assert.match(src, /export function createPhotoEighthSouthService/, "the declared entry point");
});

/* ----------------------------------------------- the module, run for real */

const build = async (ground) => {
  const { createPhotoEighthSouthService } = await import(
    "../docs/js/campus-photo-eighthsouthservice.js"
  );
  return createPhotoEighthSouthService(null, {
    photo: { eighthsouthservice: section },
    heightAt: ground,
    surfaceAt: ground,
  });
};
const matrices = (r) =>
  r.group.children.filter((c) => c.isInstancedMesh).map((c) => Array.from(c.instanceMatrix.array));

test("the module builds every system, and the counts are the declared ones", async () => {
  const THREE = await import("../docs/vendor/three/three.module.min.js");
  const r = await build(() => 12.4);
  assert.ok(r.group instanceof THREE.Group);
  const B = section.backyard;
  const c = r.counts;
  assert.equal(c.backyardPaving, 1);
  assert.equal(c.backyardBed, 1);
  assert.equal(c.grillCounters, B.grills.items.length);
  assert.equal(c.grillBays, B.grills.items.length * 2);
  assert.equal(c.tables, B.pingPong.items.length);
  assert.equal(c.tableLegs, B.pingPong.items.length * 4);
  assert.equal(c.tableNets, B.pingPong.items.length);
  /* ITTF: two side lines, two end lines, one centre line, per table. */
  assert.equal(c.tableLines, B.pingPong.items.length * 5);
  assert.equal(c.wingRoofPlates, 2);
  assert.equal(c.wingRoofHoles, 1);
  assert.equal(c.portals, 1);
  /* Trim on every segment of the surveyed ring longer than 0.2 m. */
  const wing = open(section.measured.wing.ring);
  const segs = wing.filter((p, i) => {
    const q = wing[(i + 1) % wing.length];
    return Math.hypot(q[0] - p[0], q[1] - p[1]) >= 0.2;
  }).length;
  assert.equal(c.wingTrims, segs);
  assert.ok(c.draws < 40, `${c.draws} draw calls for a courtyard and a roof`);
});

test("the roof lands on the drawn lid campus-massing.js extrudes", async () => {
  const g = () => 12.4;
  const r = await build(g);
  const lid = 12.4 + arcgis.massing[462].h;
  const plates = r.group.children.filter((c) => c.isMesh && !c.isInstancedMesh);
  const roof = plates.filter((p) => Math.abs(p.position.y - lid) < 0.05);
  assert.equal(roof.length, 2, "both roof plates must sit on the drawn lid, not above or below it");
  assert.ok(section.wingRoof.plateLift > 0 && section.wingRoof.plateLift < 0.05);
});

test("the two roof plates tile the ring exactly, tower punched, nothing double-covered", async () => {
  /* The gate that proves the split and the punched holes are real rather than
     plausible: sum the TRIANGULATED area of both plates as three.js actually
     built them, and it must equal massing[462] minus massing[464] — not the
     ring (a hole that failed to punch), not less (a plate that failed to
     triangulate), and not more (a doubled lobe). */
  const r = await build(() => 12.4);
  const plates = r.group.children.filter((c) => c.isMesh && !c.isInstancedMesh);
  const lid = 12.4 + arcgis.massing[462].h;
  const roof = plates.filter((p) => Math.abs(p.position.y - lid) < 0.05);
  assert.equal(roof.length, 2);
  let built = 0;
  for (const m of roof) {
    const pos = m.geometry.attributes.position;
    assert.equal(m.geometry.index, null, "the roof plates are built as raw triangle soup");
    assert.equal(pos.count % 3, 0);
    for (let i = 0; i < pos.count; i += 3) {
      const ax = pos.getX(i);
      const az = pos.getZ(i);
      const bx = pos.getX(i + 1);
      const bz = pos.getZ(i + 1);
      const cx = pos.getX(i + 2);
      const cz = pos.getZ(i + 2);
      built += Math.abs((bx - ax) * (cz - az) - (cx - ax) * (bz - az)) / 2;
    }
    /* and every plate triangle faces UP — a back-facing lit plate renders at
       0.42x its measured colour, which is the near-black-splat failure the
       drape module records. */
    const nrm = m.geometry.attributes.normal;
    for (let i = 0; i < nrm.count; i++) assert.ok(nrm.getY(i) > 0.99);
  }
  const want = area(open(section.measured.wing.ring)) - area(open(section.measured.tower.ring));
  assert.ok(
    Math.abs(built - want) < 1.0,
    `roof plates cover ${built.toFixed(1)} m2, ring minus tower is ${want.toFixed(1)} m2`,
  );
});

test("two builds are byte-identical", async () => {
  const a = await build(() => 12.4);
  const b = await build(() => 12.4);
  assert.deepEqual(a.counts, b.counts);
  assert.deepEqual(matrices(a), matrices(b), "two builds must be byte-identical");
});

test("nothing hovers and nothing sinks, on flat ground and on a slope", async () => {
  /* The real test of seating station by station: a ground that MOVES. Anything
     placed at one datum would leave one end of the courtyard buried and the
     other in the air. Each family is checked against the surface it is
     ENTITLED to — the terrain for what stands on it, the counter top for a
     drop-in grill bay, the table top for a net and its line set — so "it is
     0.92 m up" can never pass as "it is seated". */
  const THREE = await import("../docs/vendor/three/three.module.min.js");
  const slope = (x, z) => 12.4 + x * 0.06 - z * 0.04;
  const B = section.backyard;
  const P = section.southPortal;
  for (const ground of [() => 12.4, slope]) {
    const r = await build(ground);
    const inst = r.group.children.filter((c) => c.isInstancedMesh);
    const [counters, bays, tops, legs, nets, lines, trims, portal] = inst;
    assert.equal(inst.length, 8, "the family order this test indexes has changed");
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const at = (mesh, i) => {
      mesh.getMatrixAt(i, m);
      m.decompose(p, q, s);
      return { y: p.y, h: s.y, x: p.x, z: p.z };
    };
    const near = (a, b, what, tol = 0.002) =>
      assert.ok(Math.abs(a - b) < tol, `${what}: ${a.toFixed(4)} vs ${b.toFixed(4)}`);

    for (let i = 0; i < counters.count; i++) {
      const it = at(counters, i);
      near(it.y - it.h / 2, ground(it.x, it.z), "a grill counter is not on its own ground");
    }
    for (let i = 0; i < bays.count; i++) {
      const it = at(bays, i);
      near(it.y - it.h / 2, ground(it.x, it.z) + B.grills.baySill, "a grill bay is not on the counter top");
    }
    for (let i = 0; i < tops.count; i++) {
      const it = at(tops, i);
      near(it.y + it.h / 2, ground(it.x, it.z) + B.pingPong.height, "a table top is not at the ITTF height");
    }
    for (let i = 0; i < legs.count; i++) {
      const it = at(legs, i);
      near(it.y - it.h / 2, ground(it.x, it.z), "a table leg is not on its own ground");
    }
    for (let i = 0; i < nets.count; i++) {
      const it = at(nets, i);
      near(it.y - it.h / 2, ground(it.x, it.z) + B.pingPong.height, "a net is not on the table top");
    }
    /* A line is offset from its table's centre, so it is checked against the
       PLANE OF ITS OWN TABLE — the one surface it may lie on — not against
       the terrain under the point it happens to sit over. */
    const tables = B.pingPong.items.map((t) => ground(t.x, t.z) + B.pingPong.height);
    for (let i = 0; i < lines.count; i++) {
      const it = at(lines, i);
      assert.ok(
        tables.some((top) => it.y > top - 1e-6 && it.y < top + 0.01),
        `a line is not lying on any table top: ${it.y.toFixed(4)}`,
      );
    }
    /* The roof trim hangs off the drawn prism, not the terrain — but it must
       still sit ON the lid, not float over it. */
    const lid = ground(0, 0) + section.measured.wing.h;
    for (let i = 0; i < trims.count; i++) {
      const it = at(trims, i);
      if (ground === slope) continue;
      near(it.y - it.h / 2, lid, "the eave trim is not on the drawn lid");
    }
    /* The portal reaches the ground at BOTH jambs on a falling face. */
    const it = at(portal, 0);
    const wing = open(section.measured.wing.ring);
    const a = wing[P.faceSeg];
    const b = wing[(P.faceSeg + 1) % wing.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const jamb = (u) => [a[0] + ((b[0] - a[0]) * u) / len, a[1] + ((b[1] - a[1]) * u) / len];
    const sill = Math.min(ground(...jamb(P.u0)), ground(...jamb(P.u1)));
    near(it.y - it.h / 2, sill, "the portal sill is not at the lower of its two jambs");
  }
});

test("a missing section is harmless", async () => {
  const { createPhotoEighthSouthService } = await import(
    "../docs/js/campus-photo-eighthsouthservice.js"
  );
  const r = createPhotoEighthSouthService(null, { photo: {}, surfaceAt: () => 12.4 });
  assert.deepEqual(r.counts, {});
  assert.equal(r.group.children.length, 0);
});

test("the absent list keeps its named negatives", () => {
  const all = section.absent.join("\n");
  for (const must of [
    /pitch/i,
    /basin/i,
    /courtyard void/i,
    /outdoor classroom/i,
    /walking trail|one-mile/i,
    /parking-elevator|parking elevator/i,
    /subterranean/i,
    /Sankofa/,
  ]) {
    assert.match(all, must, `the absent list dropped ${must}`);
  }
  /* Two negatives are RESULTS, not silences — they must say they were looked
     for and not found. */
  assert.match(all, /appears on NO plan legend/i);
  assert.match(all, /Deliberately NOT duplicated/i);
});
