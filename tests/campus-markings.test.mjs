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
