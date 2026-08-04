// The sports-surface markings: the data parses, every line stays on its own
// facility, the widths are paint-like, and the full-size centre circles
// measure what a centre circle measures.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const data = JSON.parse(readFileSync(join(ROOT, "docs/data/campus-markings.json"), "utf8"));

const inRing = (pt, ring) => {
  let ins = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if (zi > pt[1] !== zj > pt[1] &&
        pt[0] < ((xj - xi) * (pt[1] - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
};

function markingPoints(mk) {
  if (mk.kind === "arc") {
    const pts = [];
    for (let i = 0; i <= 32; i++) {
      const a = mk.a0 + ((mk.a1 - mk.a0) * i) / 32;
      pts.push([mk.c[0] + Math.cos(a) * mk.r, mk.c[1] + Math.sin(a) * mk.r]);
    }
    return pts;
  }
  return mk.kind === "fill" ? mk.poly : mk.pts;
}

test("markings data parses and has real facilities", () => {
  assert.ok(Array.isArray(data.facilities) && data.facilities.length >= 8,
    "expected the campus's sports facilities to be present");
  for (const f of data.facilities) {
    assert.ok(f.id && f.name && f.kind, `${f.id || "?"}: id/name/kind`);
    assert.ok(Array.isArray(f.bounds) && f.bounds.length >= 3, `${f.id}: bounds polygon`);
    assert.ok(Array.isArray(f.markings) && f.markings.length > 0, `${f.id}: markings`);
  }
});

test("every marking stays inside its facility's bounds (+margin)", () => {
  for (const f of data.facilities) {
    /* bounds already carry a margin; allow a hair more for rounding. */
    const M = 0.5;
    const xs = f.bounds.map((p) => p[0]);
    const zs = f.bounds.map((p) => p[1]);
    const grown = [
      [Math.min(...xs) - M, Math.min(...zs) - M],
      [Math.max(...xs) + M, Math.min(...zs) - M],
      [Math.max(...xs) + M, Math.max(...zs) + M],
      [Math.min(...xs) - M, Math.max(...zs) + M],
    ];
    for (const mk of f.markings) {
      for (const pt of markingPoints(mk)) {
        assert.ok(inRing(pt, grown),
          `${f.id}: ${mk.kind} point ${pt} escapes bounds`);
      }
    }
  }
});

test("line widths are paint, not walls", () => {
  for (const f of data.facilities) {
    for (const mk of f.markings) {
      if (mk.kind === "fill") continue;
      assert.ok(mk.width_m >= 0.05 && mk.width_m <= 0.6,
        `${f.id}: width ${mk.width_m} m out of range`);
    }
  }
});

test("full-size pitches carry a regulation centre circle", () => {
  const pitches = data.facilities.filter((f) => f.kind === "pitch" && f.full);
  assert.ok(pitches.length >= 1, "at least one full-size pitch");
  for (const f of pitches) {
    /* The centre circle is the full circle whose radius is nearest 9.15. */
    const circles = f.markings.filter(
      (m) => m.kind === "arc" && Math.abs(m.a1 - m.a0) > 6.2 && m.r > 5);
    assert.ok(circles.length >= 1, `${f.id}: centre circle present`);
    const r = circles.map((c) => c.r).sort(
      (a, b) => Math.abs(a - 9.15) - Math.abs(b - 9.15))[0];
    assert.ok(Math.abs(r - 9.15) < 1.0,
      `${f.id}: centre circle r=${r} not ≈ 9.15 m`);
  }
});

test("every fitted facility sits within 0.5 m of the imagery's paint", () => {
  for (const f of data.facilities) {
    if (f.fitError_m === null || f.fitError_m === undefined) continue;
    assert.ok(f.fitError_m <= 0.5, `${f.id}: fitError ${f.fitError_m} m`);
  }
});

/* ------------------------------------------------------------ RIMAC Field
   RIMAC Field is FOUR pitches, two columns by two rows. The model once
   carried two, both in the WESTERN column, and the entire eastern column was
   missing — from a rebuild, not from an edit anyone would notice in a diff.
   These pin the layout so that cannot come back quietly. */

const rimacPitches = data.facilities.filter((f) => f.id.startsWith("rimac-") && f.kind === "pitch");
/** A pitch's centre is its 9.15 m centre circle; nothing else in the set is one. */
const centreOf = (f) => {
  const c = f.markings.find(
    (m) => m.kind === "arc" && Math.abs(m.a1 - m.a0) > 6.2 && Math.abs(m.r - 9.15) < 0.2);
  assert.ok(c, `${f.id}: no 9.15 m centre circle to take a centre from`);
  return c.c;
};

test("RIMAC Field is declared as four pitches, two columns by two rows", () => {
  /* Read the declarations, not the output: a pitch the coverage gate drops is
     absent from the data BY DESIGN, and the failure being guarded against is
     someone deleting the entry so a rebuild stops re-measuring it. */
  const src = readFileSync(join(ROOT, "scripts/build-campus-markings.mjs"), "utf8");
  for (const id of ["rimac-nw", "rimac-ne", "rimac-sw", "rimac-se"]) {
    assert.match(src, new RegExp(`pitch\\("${id}"`),
      `${id} is no longer declared — RIMAC Field has four pitches and the build must measure all four`);
  }
  assert.equal((src.match(/pitch\("rimac-/g) || []).length, 4,
    "RIMAC Field must be declared as exactly four pitches");
});

test("RIMAC's shipped pitches span both columns, not just the western one", () => {
  /* The reported defect, stated as a check. The columns meet at x ~141: the
     western column's east touchline and the eastern column's west touchline
     run 1.5 m apart there. */
  const SEAM = 141;
  const west = rimacPitches.filter((f) => centreOf(f)[0] < SEAM);
  const east = rimacPitches.filter((f) => centreOf(f)[0] > SEAM);
  assert.ok(west.length >= 1, "RIMAC's western column lost its pitches");
  assert.ok(east.length >= 1,
    "RIMAC's EASTERN column carries no pitch — this is exactly the defect that shipped once");
});

test("RIMAC's south row is a ROW: its two pitches are level with each other", () => {
  /* The east column holds a second complete painted generation 18.1 m north
     of the current south-east pitch, and it fits about as well. Modelling it
     instead would stagger the row — which is the one thing that tells the two
     apart, and the check that would catch the swap. */
  const sw = rimacPitches.find((f) => f.id === "rimac-sw");
  const se = rimacPitches.find((f) => f.id === "rimac-se");
  assert.ok(sw && se, "the south row lost a pitch");
  const gap = Math.abs(centreOf(sw)[1] - centreOf(se)[1]);
  assert.ok(gap < 8,
    `the south row's pitches are ${gap.toFixed(1)} m apart in z — the east one is off its row ` +
    `(the older generation it must not be fitted to sits 18.1 m north)`);
});

test("every RIMAC pitch is measured where the imagery says, or is not there", () => {
  /* Centres from the chunks, 2026-08-04: the north row's halfway lines and
     centre circles at z -1095.9, the south row's at -1010.5 / -1014.1, the
     columns at x 107.8 and 177.4. A metre of drift is a refit; ten is a
     different pitch. */
  const expected = {
    "rimac-nw": [107.75, -1095.85],
    "rimac-sw": [113.25, -1010.50],
    "rimac-se": [177.38, -1014.13],
  };
  for (const f of rimacPitches) {
    const want = expected[f.id];
    assert.ok(want, `${f.id} ships but has no measured centre on record here`);
    const [x, z] = centreOf(f);
    assert.ok(Math.hypot(x - want[0], z - want[1]) < 2.5,
      `${f.id} centres at (${x}, ${z}), not the measured (${want[0]}, ${want[1]})`);
  }
});

test("every RIMAC pitch that ships clears RIMAC's own tighter gate", () => {
  /* The north-west pitch shipped once at 0.53 coverage and was merged; the
     number was the fit saying it was wrong. RIMAC carries 0.75 / 0.35 m,
     tighter than the build's global 0.5 / 0.5 m, because this is where a
     loose fit got through. */
  assert.ok(rimacPitches.length >= 3, "RIMAC lost a pitch it could measure");
  for (const f of rimacPitches) {
    assert.ok(f.fitCoverage >= 0.75,
      `${f.id}: only ${(f.fitCoverage * 100).toFixed(0)}% of its line lies on paint (gate 75%)`);
    assert.ok(f.fitError_m <= 0.35,
      `${f.id}: mean offset ${f.fitError_m} m exceeds RIMAC's 0.35 m gate`);
  }
});

test("a pitch across the imagery's zoom seam is still scored on its own paint", () => {
  /* The chunk grid changes resolution at z = -1128 and the north-west pitch
     runs straight across it. Coverage used to resolve its resolution-scaled
     threshold once, at the facility CENTRE, so this pitch's northern half —
     real paint at half the pixel scale — was scored against a threshold its
     imagery cannot reach, and it measured 0.53 and shipped as a bad fit.
     Per sample it measures 0.78. Any facility crossing a seam had the fault,
     so this guards the class and not just the case. */
  const SEAM = -1128;
  const nw = rimacPitches.find((f) => f.id === "rimac-nw");
  assert.ok(nw, "the north-west pitch is gone — it is the one that crosses the seam");
  const zs = nw.bounds.map((p) => p[1]);
  assert.ok(Math.min(...zs) < SEAM && Math.max(...zs) > SEAM,
    "the north-west pitch no longer spans the zoom seam — this test has lost its subject");
  assert.ok(nw.fitCoverage >= 0.75,
    `the seam-crossing pitch is back down at ${nw.fitCoverage} — is the threshold per facility again?`);
});

test("the track has its nine lanes", () => {
  const track = data.facilities.find((f) => f.kind === "track");
  assert.ok(track, "track present");
  /* 10 lane lines x (2 straights + 2 arcs) = 40 line markings. */
  const lines = track.markings.filter((m) => m.kind !== "fill");
  assert.equal(lines.length, 40);
  const arcs = lines.filter((m) => m.kind === "arc");
  const radii = [...new Set(arcs.map((a) => a.r))].sort((a, b) => a - b);
  assert.equal(radii.length, 10, "10 distinct lane radii");
  const lane = radii[1] - radii[0];
  assert.ok(Math.abs(lane - 1.22) < 0.01, `lane width ${lane}`);
});

test("the track carries its modeled running surface and infield", () => {
  const track = data.facilities.find((f) => f.kind === "track");
  const fills = track.markings.filter((m) => m.kind === "fill" && m.surface);
  assert.equal(fills.length, 2, "ring + infield");
  const ring = fills.find((m) => m.holes?.length === 1);
  const infield = fills.find((m) => !m.holes?.length);
  assert.ok(ring, "annulus with its inner hole");
  assert.ok(infield, "infield fill");
  /* The ring is terracotta (red channel dominates), the infield green. */
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [rr, rg] = rgb(ring.colour);
  assert.ok(rr > rg, `ring ${ring.colour} reads terracotta`);
  const [ir, ig] = rgb(infield.colour);
  assert.ok(ig > ir, `infield ${infield.colour} reads green`);
  /* Surfaces sit UNDER the painted lines. */
  for (const f of fills) assert.ok(f.lift < 0.1, `surface lift ${f.lift} under the paint`);
});

test("renderer module imports clean outside a browser", async () => {
  const mod = await import("../docs/js/campus-markings.js");
  assert.equal(typeof mod.createMarkings, "function");
  assert.equal(typeof mod.markingToPolylines, "function");
  /* Its tessellation helper works without any DOM. */
  const [pts] = mod.markingToPolylines({ kind: "arc", c: [0, 0], r: 9.15, a0: 0, a1: Math.PI * 2 });
  assert.ok(pts.length > 30);
  const d = Math.hypot(pts[0][0], pts[0][1]);
  assert.ok(Math.abs(d - 9.15) < 1e-6);
});
