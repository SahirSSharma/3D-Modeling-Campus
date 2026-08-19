/* Eighth College's SITEWORKS — the photo-sourced INVENTED class.
 *
 * Site lighting, guards, handrails, bike hoops, planters, applied signage,
 * bollards, waste, wayfinding and the two basketball standards. The gates here
 * are about quarantine, provenance and not contradicting the measured world:
 *
 *   - it is labelled, epoch-stamped, sourced (every source carries a date),
 *     and it says what it left out;
 *   - colours are data, they are hex, and EVERY role has its own provenance
 *     line naming a frame and a tier;
 *   - every surveyed ring it leans on is a VERBATIM copy of campus-eighth.json
 *     ground / campus-arcgis.json massing — one changed number fails;
 *   - every signage face hangs off two vertices of the measured massing ring
 *     it names, and its normal points out of the building;
 *   - nothing it stands on the ground sits inside a measured building
 *     footprint, and nothing escapes the section's own envelope;
 *   - the CLIPS genuinely bite: the section declares items inside them, and no
 *     instance survives there;
 *   - nothing hovers — re-built over SLOPING ground, every instance still sits
 *     on the local surface, which is the whole point of seating station by
 *     station rather than at one datum;
 *   - two builds are byte-identical;
 *   - the absent list does not shrink.
 *
 * The section lives under the top-level `eighthsiteworks` key of
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

const staged = null;
const section = photoDoc.eighthsiteworks ?? staged;

const eighth = read(join(root, "docs/data/campus-eighth.json"));
const arcgis = read(join(root, "docs/data/campus-arcgis.json"));
const campus = read(join(root, "docs/data/campus-3d.json"));
const lidar = read(join(root, "docs/data/campus-lidar.json"));

/* The two shared ladders this section stands on, imported rather than copied:
 * the overlay rungs decide the seating datum, and makeSurfaceSampler is the
 * height of the DRAWN triangle the runs are checked against. */
const { makeSurfaceSampler } = await import("../docs/js/campus-terrain.js");
const { OVERLAY, overlayLift } = await import("../docs/js/campus-overlay.js");
const drawnGround = makeSurfaceSampler(lidar.terrain);

const inRing = (x, z, r) => {
  let ins = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, zi] = r[i];
    const [xj, zj] = r[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
};

/** Every (x, z) the section stands something on the ground at. */
function groundItems() {
  const S = section.systems;
  const out = [];
  for (const sys of ["l1Pole", "l2Pole", "bollardLight", "planterA", "planterB",
    "waste", "trafficBollard", "detectableWarning", "wayfindingTotem", "blueLight"]) {
    for (const it of S[sys].items) out.push({ key: it.key, x: it.x, z: it.z, sys });
  }
  for (const r of S.bikeRack.ranks) out.push({ key: r.key, x: r.x, z: r.z, sys: "bikeRack" });
  for (const h of S.courtHardware.hoops) out.push({ key: h.key, x: h.x, z: h.z, sys: "courtHardware" });
  for (const run of [...S.guardrail.runs, ...S.handrail.runs]) {
    const n = Math.ceil(Math.hypot(run.b[0] - run.a[0], run.b[1] - run.a[1]) / 1.0);
    for (let i = 0; i <= n; i++) {
      out.push({
        key: run.key, sys: "run",
        x: run.a[0] + ((run.b[0] - run.a[0]) * i) / n,
        z: run.a[1] + ((run.b[1] - run.a[1]) * i) / n,
      });
    }
  }
  return out;
}

const inClip = (x, z, c) => x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1;

/* ------------------------------------------- the measured world it must miss
 *
 * Two shipped sets of MEASURED objects stand on the same ground this invented
 * kit is placed on. They are read out of the files that ship them, never
 * copied here — a copy goes stale the day either one gains an object.
 *   - campus-photo-detail.json `eighth.items` in area `bbq`: the grill run,
 *     the canopy, the enclosure, four picnic tables and eight cafe chairs,
 *     all measured off crop_grill.png.
 *   - campus-eighth-furniture.js PLAZA_OBJECTS: 17 blobs confirmed in BOTH
 *     Apple frames (ref3 and ref8) to 1.5 m, which is the strongest
 *     positional evidence anywhere in Eighth.
 */
const furnitureSrc = readFileSync(join(root, "docs/js/campus-eighth-furniture.js"), "utf8");
const plazaBlock = furnitureSrc.slice(furnitureSrc.indexOf("const PLAZA_OBJECTS = ["));
const PLAZA_OBJECTS = [...plazaBlock.slice(0, plazaBlock.indexOf("];"))
  .matchAll(/\[\s*(-?[\d.]+),\s*(-?[\d.]+),\s*([\d.]+),\s*([\d.]+)\s*\]/g)]
  .map((m, i) => ({ key: `plaza-object-${i}`, x: +m[1], z: +m[2], w: +m[3], d: +m[4], rotY: 0 }));
const BBQ_OBJECTS = photoDoc.eighth.items.filter((i) => i.area === "bbq" && i.w)
  .map((i) => ({ key: i.key, x: i.x, z: i.z, w: i.w, d: i.d, rotY: i.rotY || 0 }));
const MEASURED_OBSTACLES = [...PLAZA_OBJECTS, ...BBQ_OBJECTS];

/* The module with every comment stripped out. A gate that asks "is this number
   written in the code?" must ask it of the CODE — the prose above a fix quotes
   the number the fix removed, and matching that would make the gate pass or
   fail on the commentary instead of on the geometry. */
const moduleSrc = readFileSync(join(root, "docs/js/campus-photo-eighthsiteworks.js"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const obbCorners = (o) => {
  const c = Math.cos(o.rotY), s = Math.sin(o.rotY);
  return [[-o.w / 2, -o.d / 2], [o.w / 2, -o.d / 2], [o.w / 2, o.d / 2], [-o.w / 2, o.d / 2]]
    .map(([u, v]) => [o.x + u * c - v * s, o.z + u * s + v * c]);
};
/** Separating-axis overlap of two oriented plan footprints. */
function obbOverlap(a, b) {
  const A = obbCorners(a), B = obbCorners(b);
  for (const o of [a, b]) {
    const c = Math.cos(o.rotY), s = Math.sin(o.rotY);
    for (const [ax, az] of [[c, s], [-s, c]]) {
      const p = A.map(([x, z]) => x * ax + z * az), q = B.map(([x, z]) => x * ax + z * az);
      if (Math.max(...p) < Math.min(...q) || Math.max(...q) < Math.min(...p)) return false;
    }
  }
  return true;
}
const hitsMeasured = (o, pad = 0) =>
  MEASURED_OBSTACLES.filter((t) => obbOverlap({ ...o, w: o.w + pad * 2, d: o.d + pad * 2 }, t));

/** Every plan footprint this section stands on the ground, by system. */
function groundFootprints() {
  const S = section.systems;
  const out = [];
  const sq = (v) => [v, v];
  const plan = {
    l1Pole: () => sq(S.l1Pole.pedestal.diameter),
    l2Pole: () => sq(S.l2Pole.pole.square),
    bollardLight: () => sq(S.bollardLight.cap.square),
    planterA: () => sq(S.planterA.rimDiameter),
    planterB: (it) => S.planterB.plan[it.plan],
    waste: () => [S.waste.overall[0], S.waste.overall[2]],
    trafficBollard: () => sq(S.trafficBollard.diameter),
    detectableWarning: () => [S.detectableWarning.panel.width, S.detectableWarning.panel.depth],
    wayfindingTotem: () => [S.wayfindingTotem.size[0], S.wayfindingTotem.size[2]],
    blueLight: () => sq(S.blueLight.section),
  };
  for (const [key, f] of Object.entries(plan)) {
    for (const it of S[key].items) {
      const [w, d] = f(it);
      out.push({ key: it.key, x: it.x, z: it.z, w, d, rotY: it.rotY || 0 });
    }
  }
  const R = S.bikeRack;
  for (const rank of R.ranks) {
    for (let h = 0; h < rank.hoops; h++) {
      const along = (h - (rank.hoops - 1) / 2) * R.hoop.spacing;
      out.push({
        key: `${rank.key}#${h}`, x: rank.x + Math.sin(rank.rotY) * along,
        z: rank.z + Math.cos(rank.rotY) * along, w: R.hoop.tube, d: R.hoop.width, rotY: rank.rotY,
      });
    }
  }
  for (const [sys, wid, half] of [
    [S.guardrail, S.guardrail.kerb.thickness, 0],
    [S.handrail, S.handrail.post.basePlate, S.handrail.clearWidth / 2],
  ]) {
    for (const run of sys.runs) {
      const [ax, az] = run.a, [bx, bz] = run.b;
      const len = Math.hypot(bx - ax, bz - az);
      const ux = (bx - ax) / len, uz = (bz - az) / len;
      const rot = Math.atan2(uz, ux);
      for (const side of half ? [-1, 1] : [0]) {
        for (let s = 0; s <= len + 1e-9; s += 0.2) {
          out.push({
            key: run.key, x: ax + ux * s - uz * side * half, z: az + uz * s + ux * side * half,
            w: 0.2, d: wid, rotY: rot,
          });
        }
      }
    }
  }
  return out;
}

/* ----------------------------------------------------- ring helpers */
const dSeg = (px, pz, ax, az, bx, bz) => {
  const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz;
  if (L < 1e-12) return Math.hypot(px - ax, pz - az);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
};
const dRing = (x, z, r) => {
  let m = Infinity;
  for (let i = 0; i < r.length; i++) m = Math.min(m, dSeg(x, z, r[i][0], r[i][1], r[(i + 1) % r.length][0], r[(i + 1) % r.length][1]));
  return m;
};

/* ---------------------------------------------------------------- gates */

test("the section exists and is reachable", () => {
  assert.ok(section, "no eighthsiteworks key in campus-photo-detail.json and no staging file");
  /* A HALF-MERGE IS THE DANGEROUS STATE, not a missing one: the merged key
     silently wins, so a stale merge would leave this suite green while the
     screen showed an older section. If both copies exist they must be the same
     document, byte for byte. */
  if (photoDoc.eighthsiteworks && staged) {
    assert.deepEqual(photoDoc.eighthsiteworks, staged,
      "the merged eighthsiteworks section and the staging file have drifted apart — re-merge, then delete the staging fallback");
  }
});

test("it says what it is, where it came from, and what it left out", () => {
  assert.match(section.label, /Eighth/i);
  assert.match(section.label, /siteworks/i);
  assert.ok(section.epoch, "no epoch stamp");
  assert.match(section.note, /INVENTED/, "the note must declare the class");
  /* The epoch trap this college is full of has to stay written down. */
  assert.match(section.epoch, /LiDAR is BLIND/i,
    "the 2014 LiDAR's blindness over Eighth is the fact that decides this section");
  assert.match(section.positionCaveat, /\[estimated\]/,
    "every position is estimated and the section must say so up front");
  /* EVERY FLOOR IN THIS SUITE IS PINNED TO THE CURRENT COUNT, not to a round
     number below it. The floors used to sit well under the actuals — absent at
     20 against 36, sources at 12 against 16 — so sixteen absent entries, four
     sources, two colours and three supersedes lines could have been dropped
     with the suite still green, which is the exact opposite of what a
     non-shrinking gate is for. Growing the list means moving the floor with
     it in the same edit; that is the point, and it is cheap. */
  assert.ok(Array.isArray(section.sources) && section.sources.length >= 16,
    `only ${section.sources?.length} sources`);
  for (const s of section.sources) {
    assert.match(s, /(19|20)\d\d/, `source carries no date: ${s.slice(0, 70)}`);
  }
  assert.equal(typeof section.seed, "number", "the seed must be pinned");
  /* The absent list is a promise, not a draft. It may grow; it may not shrink. */
  assert.ok(Array.isArray(section.absent) && section.absent.length >= 40,
    `absent has ${section.absent?.length} entries — better absent than wrong, and this list does not shrink`);
  for (const gap of section.absent) assert.equal(typeof gap, "string");
  /* The four gaps that are load-bearing arguments, not housekeeping. */
  assert.ok(section.absent.some((a) => /PRODUCT IDENTITY/i.test(a)),
    "the unresolved luminaire brand must stay absent — it may not be invented");
  assert.ok(section.absent.some((a) => /STAIR FLIGHTS/i.test(a)),
    "the stair-flight handrails must stay absent while the flights are unbuilt");
  assert.ok(section.absent.some((a) => /FESTOON/i.test(a)),
    "the festoon/cove/canopy downlights must stay absent — no host surface to sit in");
  assert.ok(section.absent.some((a) => /LETTERFORMS/i.test(a)),
    "the repo has no text mechanism and the section must say the letters are blank");
});

test("colours are data, they are hex, and every role has provenance", () => {
  const keys = Object.keys(section.colors);
  assert.ok(keys.length >= 30, `only ${keys.length} colours`);
  for (const [k, v] of Object.entries(section.colors)) {
    assert.match(v, /^#[0-9a-f]{6}$/, `${k} is not a lowercase 6-digit hex`);
    const src = section.colorSources[k];
    assert.ok(src, `${k} has no colorSources entry`);
    assert.match(src, /\[(measured|sourced|estimated)\]/, `${k}'s provenance names no tier`);
    assert.match(src, /(19|20)\d\d/, `${k}'s provenance carries no date`);
  }
  for (const k of Object.keys(section.colorSources)) {
    assert.ok(section.colors[k], `colorSources has an orphan role ${k}`);
  }
  /* The correction that motivated this whole colour block: the L1 pole is a
     PALE grey object photographed in sun, not the near-black silhouette the
     shipped eighth section reads it as. */
  const l1 = section.colors.l1Finish;
  const luma = (hex) =>
    0.299 * parseInt(hex.slice(1, 3), 16) + 0.587 * parseInt(hex.slice(3, 5), 16) +
    0.114 * parseInt(hex.slice(5, 7), 16);
  assert.ok(luma(l1) > 140, `l1Finish ${l1} is a shadow read, not the sunlit sample`);
  assert.ok(luma(section.colors.bollardBody) < 40, "the bollard really is near-black");
  /* CONFLICT C5: the trident is GOLD, not the shipped pale sage bone. */
  const t = section.colors.courtTrident;
  assert.ok(parseInt(t.slice(1, 3), 16) > parseInt(t.slice(5, 7), 16) + 60,
    `courtTrident ${t} is not gold — the shadowed Apple read is a dead source here`);
});

test("every surveyed ring is a verbatim copy of the survey", () => {
  const anchors = section.measured.anchors;
  assert.ok(Object.keys(anchors).length >= 36, "the section leans on more rings than it copied");
  for (const [key, a] of Object.entries(anchors)) {
    const src = eighth.ground[key];
    assert.ok(src, `${key} is not a campus-eighth.json ground feature`);
    assert.equal(a.kind, src.kind, `${key} kind drifted`);
    assert.equal(a.registration, src.registration, `${key} registration drifted`);
    assert.deepEqual(a.points, src.points, `${key} ring is not verbatim`);
    /* Its registration must still resolve to a real ArcGIS ground polygon. */
    const m = /^arcgis\.ground#(\d+)$/.exec(src.registration);
    assert.ok(m, `${key} registration ${src.registration} is not an arcgis.ground reference`);
    assert.ok(arcgis.ground[Number(m[1])], `${key} registers to a missing arcgis.ground index`);
  }
  for (const [key, m] of Object.entries(section.measured.massing)) {
    const src = arcgis.massing[m.index];
    assert.ok(src, `${key} names a missing massing index ${m.index}`);
    assert.equal(m.name, src.n, `${key} massing name drifted`);
    assert.equal(m.h, src.h);
    assert.equal(m.levels, src.levels);
    assert.deepEqual(m.ring, src.r[0].map(([x, z]) => [x / 10, z / 10]),
      `${key} massing ring is not the verbatim /10 survey ring`);
  }
});

test("every anchor a system names is one the section actually copied", () => {
  const anchors = section.measured.anchors;
  const S = section.systems;
  const named = new Set();
  for (const sys of Object.values(S)) {
    for (const it of [...(sys.items || []), ...(sys.ranks || []), ...(sys.runs || [])]) {
      if (it.anchor) named.add(it.anchor);
      if (it.walk) named.add(it.walk);
      if (it.against) named.add(it.against);
    }
  }
  assert.ok(named.size > 20, "the systems name too few surveyed anchors to be survey-led");
  for (const k of named) assert.ok(anchors[k], `anchor ${k} is used but not copied verbatim`);
});

test("every signage face hangs off two vertices of the ring it names", () => {
  const faces = [
    ...section.systems.signage.wordmarks.map((w) => w.face),
    ...section.systems.signage.numerals.map((n) => n.face),
    ...section.systems.ancillaryLighting.sconce.faces.map((f) => f.face),
  ];
  for (const f of faces) {
    const ring = section.measured.massing[f.mass].ring;
    for (const p of [f.a, f.b]) {
      assert.ok(ring.some(([x, z]) => x === p[0] && z === p[1]),
        `${f.mass}: ${JSON.stringify(p)} is not a vertex of the measured ring`);
    }
    assert.notDeepEqual(f.a, f.b, "a zero-length face");
    assert.ok(Math.abs(Math.hypot(f.out[0], f.out[1]) - 1) < 1e-3, "the normal is not unit");
    const uniq = ring.slice(0, -1);
    const cx = uniq.reduce((s, p) => s + p[0], 0) / uniq.length;
    const cz = uniq.reduce((s, p) => s + p[1], 0) / uniq.length;
    const mx = (f.a[0] + f.b[0]) / 2 - cx;
    const mz = (f.a[1] + f.b[1]) / 2 - cz;
    assert.ok(mx * f.out[0] + mz * f.out[1] > 0, `${f.mass}'s face normal points into the building`);
  }
  /* THE BACK FACE TOUCHES THE WALL. Round one held every solid 0.30 m proud
     "to clear the deepest declared rain-screen in this project", and this test
     enshrined the gap. No Eighth mass ships a rain screen — the masses are
     drawn at the survey ring — so five solids floated 0.29 m off three
     buildings with air behind them. `standoff` is now the clear gap BEHIND an
     element, and the module places each solid at standoff + relief/2. */
  const S = section.systems.signage;
  assert.equal(S.standoff, 0,
    `signage standoff ${S.standoff} floats the lockup off a facade skin that has not shipped`);
  for (const e of [...S.wordmarks, ...S.numerals]) {
    assert.ok(e.relief > 0, `${e.key} has no depth to seat on the wall`);
  }
  assert.match(S.standoffNote, /rain screen/i,
    "the retired rain-screen clearance must stay on the record, so it is not re-invented");
});

test("nothing on Eighth ships a facade skin for the signage to stand off", () => {
  /* The load-bearing premise of standoff === 0, checked against the two
     modules that actually draw these buildings rather than asserted. */
  for (const f of ["docs/js/campus-eighth.js", "docs/js/campus-photo-eighth.js"]) {
    const src = readFileSync(join(root, f), "utf8");
    assert.ok(!/\b(rainScreen|rain_screen|facadeSkin|skinProud|standoff)\b/.test(src),
      `${f} now ships facade-skin geometry — the signage standoff must become that skin's depth`);
  }
});

test("nothing stands inside a measured building footprint, or outside the envelope", () => {
  const rings = campus.buildings.filter((b) => b.p && b.p.length >= 3).map((b) => [b.n, b.p]);
  const mass = Object.values(section.measured.massing).map((m) => [m.name, m.ring]);
  const b = section.bounds;
  for (const it of groundItems()) {
    for (const [name, r] of [...rings, ...mass]) {
      assert.ok(!inRing(it.x, it.z, r),
        `${it.key} (${it.x}, ${it.z}) is inside ${name || "an unnamed mass"}`);
    }
    assert.ok(it.x >= b.x0 && it.x <= b.x1 && it.z >= b.z0 && it.z <= b.z1,
      `${it.key} (${it.x}, ${it.z}) is outside the declared envelope`);
  }
});

test("the placement rules are the ones the section declares", () => {
  const S = section.systems;
  /* The L1 pitch is a real multiple of the solved mounting height, not a
     round number someone liked. */
  const mh = S.l1Pole.height;
  const ratio = S.l1Pole.placement.pitch / mh;
  assert.ok(ratio >= 3.0 && ratio <= 4.0, `L1 pitch is ${ratio.toFixed(2)}x mounting height`);
  assert.equal(S.l1Pole.height, 5.75);
  /* The head assembly must ADD UP to the solved overall. Round one's ladder
     missed by exactly the dome rise and passed only because 0.0199999... is
     less than the 0.02 the tolerance used to be; arbitration re-measured the
     head off the phf22 sky silhouette and the assembly now closes exactly, so
     the gate is exact arithmetic and no longer a tolerance to hide in. */
  const L = S.l1Pole;
  const crown = L.shaft.top + L.collar.height + L.yoke.height + L.shade.rimEdge + L.shade.domeRise;
  assert.ok(Math.abs(crown - L.height) < 1e-9,
    `the assembly reaches ${crown} m, not the solved ${L.height} m`);
  assert.match(L.assemblyNote, /0\.11/,
    "the swa-4 / phf22 head conflict is RESOLVED, not carried — but the 0.11 m it used to be must stay on the record so it is not re-averaged back in");
  /* The base ladder must close too: two concrete steps, then the base cover,
     then the shaft, then the fitter. */
  assert.ok(L.pedestalStep.diameter < L.pedestal.diameter,
    "the second concrete step must be narrower than the drum it stands on");
  assert.ok(L.baseCover.diameter < L.pedestalStep.diameter,
    "the metal base cover must be narrower than the step it stands on");
  assert.ok(L.shaft.diameter < L.baseCover.diameter, "the shaft must fit inside its base cover");
  assert.ok(Math.abs(L.shade.diameter / L.shaft.diameter - 5.46) < 0.1,
    `the measured shade/shaft ratio is 5.46, not ${(L.shade.diameter / L.shaft.diameter).toFixed(2)}`);
  /* The guard is the code height, and the picket opening passes the 4-inch
     sphere. ARBITRATED 2026-08-19: the earlier claim that this rail is
     "about half the code maximum" came from reading an 8 px blur envelope as
     a 1 1/2 in picket. The solid fraction is 0.18, i.e. an ordinary 3/4 in
     picket at 4 in centres, so the gate is the sphere rule, not a density
     claim the frame does not support. */
  assert.ok(Math.abs(S.guardrail.height - 1.067) < 1e-9, "the guard is 42 in");
  assert.ok(S.guardrail.picket.clearOpening < 0.1016,
    "the clear opening must pass the CBC §1015.4 102 mm sphere");
  assert.ok(Math.abs(S.guardrail.picket.pitch - (S.guardrail.picket.diameter + S.guardrail.picket.clearOpening)) < 1e-9,
    "pitch must be picket + clear opening");
  /* ADA on the handrail. */
  assert.ok(S.handrail.height >= 0.865 && S.handrail.height <= 0.965, "ADA §505.4");
  assert.ok(S.handrail.tube.diameter >= 0.032 && S.handrail.tube.diameter <= 0.051, "ADA §505.7.1");
  assert.ok(Math.abs(S.handrail.extension.length - 0.305) < 1e-9, "ADA §505.10.2");
  /* The bike hoop is a rack, not a sign post — the correction this section
     exists to make. */
  assert.ok(S.bikeRack.hoop.tube >= 0.05,
    `hoop tube ${S.bikeRack.hoop.tube} m is a sign post, not a staple rack`);
  /* Detectable warnings to CBC §11B-705. */
  assert.ok(Math.abs(S.detectableWarning.panel.depth - 0.61) < 1e-9, "24 in deep");
  const d = S.detectableWarning.dome;
  assert.ok(d.baseDiameter >= 0.023 && d.baseDiameter <= 0.036, "dome base 0.9-1.4 in");
  assert.ok(d.pitch >= 0.041 && d.pitch <= 0.061, "dome spacing 1.6-2.4 in");
  /* The court is regulation where regulation applies, and NOT where it does
     not: the surveyed rectangle is a shortened rec court and stays that way. */
  const K = S.courtHardware;
  assert.ok(Math.abs(K.rim.height - 3.048) < 1e-9, "rim at 10 ft");
  /* ARBITRATED 2026-08-19: a 54 x 42 in institutional board, not the 72 x 42
     regulation one. Measured against the coplanar 24 x 18 in shooter's square
     in SWA -16 and cross-checked by the calibrated ground homography; the
     far board's RAW pixel aspect of 1.297 arithmetically excludes 72:42. */
  assert.ok(Math.abs(K.backboard.width - 1.372) < 0.01 && Math.abs(K.backboard.height - 1.067) < 0.01,
    "54 x 42 in institutional board");
  const boardAspect = K.backboard.width / K.backboard.height;
  assert.ok(Math.abs(boardAspect - 54 / 42) < 0.02,
    `the board images at 1.29 in both hoops after rectification, not ${boardAspect.toFixed(2)}`);
  assert.ok(Math.abs(K.rim.diameter - 0.4572) < 1e-9, "the 18 in inside rim is fixed by rule");
  /* Both standards are symmetric: the pole stands outside the baseline and the
     arm reaches back over the court. The 0.60 m east fudge is retired. */
  assert.equal(new Set(K.hoops.map((h) => h.setBack)).size, 1, "the court is symmetric");
  assert.ok(K.hoops.every((h) => h.tier === "measured"), "both standards are measured now");
  assert.equal(K.standard.deviation, undefined,
    "the per-standard setback deviation was a collision fudge, not a measurement");
  const court = eighth.ground["basketball-court"].points;
  assert.equal(K.courtRect.x0, Math.min(...court.map((p) => p[0])));
  assert.equal(K.courtRect.x1, Math.max(...court.map((p) => p[0])));
  assert.equal(K.courtRect.z0, Math.min(...court.map((p) => p[1])));
  assert.equal(K.courtRect.z1, Math.max(...court.map((p) => p[1])));
  assert.equal(K.courtRect.registration, eighth.ground["basketball-court"].registration);
  /* ARBITRATED: the pole stands just OUTSIDE the baseline on the apron and the
     arm cantilevers the board back over the court, which is what a gooseneck
     does and what SWA -16 shows. Round one had it inverted — pole 1.2 m out,
     board face landing on the baseline. Both standards take the same 0.20 m
     pole offset and the same 1.42 m arm. */
  for (const h of K.hoops) {
    assert.ok(h.x < K.courtRect.x0 || h.x > K.courtRect.x1, `${h.key} stands on the court`);
    const baseline = h.x < K.courtRect.x0 ? K.courtRect.x0 : K.courtRect.x1;
    const outside = Math.abs(h.x - baseline);
    assert.ok(Math.abs(outside - 0.20) < 0.06,
      `${h.key} stands ${outside.toFixed(2)} m outside the baseline, not the measured 0.20 m`);
    /* 4 ft (1.219 m) is the regulation overhang, and the arm minus the pole
       offset has to land on it or the board is in the wrong place. */
    assert.ok(Math.abs((h.setBack - outside) - 1.219) < 0.06,
      `${h.key}'s board face lands ${(h.setBack - outside).toFixed(2)} m inside the baseline, not 1.22 m`);
    assert.equal(h.setBack, K.standard.setBack, `${h.key} does not take the measured arm reach`);
  }
});

test("every dimension is the arithmetic its own derivation states", () => {
  /* WHY THIS TEST EXISTS. An auditor mutated the section — a 3.5 m "bollard
     light", a 12 m round planter, a 12 m dustbin, a 6 m totem — and every gate
     still passed, because the suite checked provenance and placement and never
     a dimension. Provenance without arithmetic is a sentence, not a gate. So
     each system below is re-derived here from the figures its own derivation
     names, and the ONLY numbers written into this test are the ones those
     derivations quote: pixel reads, product steps in inches, and the ratios the
     section says it applied. Where a figure is [estimated], what is asserted is
     the relationship it declares it extends — that is exactly what the
     estimated tier promises, so it is exactly what must hold. */
  const S = section.systems;
  const IN = 0.0254;
  const near = (a, b, tol, what) =>
    assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} is not ${b} ± ${tol}`);

  /* L1 — the fitted pole. Its two independent horizons gave 5.80 and 5.70 m;
     the shipped height is their mean and the head is a set of ratios to the
     one measured absolute on the fixture, the 0.114 m shaft. */
  const L = S.l1Pole;
  near(L.height, (5.8 + 5.7) / 2, 1e-9, "L1 height is the mean of its two solved horizons");
  near(L.shade.diameter / L.shaft.diameter, 5.46, 0.05, "L1 shade/shaft (phf22 at 7x)");
  near(L.shade.diameter / (L.shade.rimEdge + L.shade.domeRise), 5.1, 0.15,
    "L1 shade diameter/depth (phf22 at 7x)");
  near(L.pedestal.diameter, 7.2 * L.shaft.diameter, L.pedestal.tolerance,
    "L1 pedestal is the swa-14 7.2x-shaft drum, inside its own declared tolerance");
  near(L.pedestalStep.diameter, 4.96 * L.shaft.diameter, 0.02, "L1 second concrete step (4.96x shaft)");
  near(L.baseCover.diameter, 2.8 * L.shaft.diameter, 0.03, "L1 base cover (2.8x shaft)");
  near(L.shaft.diameter, 4.5 * IN, 0.001, "L1 shaft is the 4 1/2 in product step");

  /* L1b is DECLARED AND NOT PLACED. The arbitration allowed the family on two
     sections' testimony and refused it a position list; nothing may quietly
     grid it onto the Ramble walks. */
  assert.equal(S.l1bPole.items.length, 0,
    "L1b has no surveyed position and no placement rule — it ships declared and unplaced");
  assert.match(S.l1bPole.withheld, /POSITIONS NOT SURVEYED/);
  assert.match(S.l1bPole.dimensionNote, /\[estimated\]/,
    "L1b's head, pole and spacing are not measurements and must say so");

  /* L2 — one measured absolute (the 0.20 m square pole) and a head length from
     a measured 2.85 ratio; every other figure declares itself a multiple of
     that pole or of that length, so each multiple is checked. */
  const L2 = S.l2Pole;
  near(L2.head.length, 2.85 * L2.pole.square, 0.05, "L2 head length (57 px / 20 px in phf19)");
  near(L2.arm.section, L2.pole.square / 2, 1e-9, "L2 arm section = half the pole square");
  near(L2.arm.projection, 1.25 * L2.pole.square, 1e-9, "L2 arm projection = 1.25 pole squares");
  near(L2.arm.drop, 0.4 * L2.pole.square, 1e-9, "L2 arm drop = 0.4 pole squares");
  near(L2.pole.stubAboveArm, 0.75 * L2.pole.square, 1e-9, "L2 stub = 0.75 pole squares");
  near(L2.head.width, L2.head.length / 2, 1e-9, "L2 head width = half its length");
  near(L2.head.thickAtArm, 0.18 * L2.head.length, 0.005, "L2 head thickness at the arm");
  near(L2.head.thickAtNose, 0.10 * L2.head.length, 0.005, "L2 head thickness at the nose");
  assert.ok(L2.height >= 6.1 && L2.height <= 7.6, "L2 is in the 20-25 ft class phf26 brackets");
  assert.ok(L2.height > L.height, "phf26 shows L2 standing ABOVE L1 — that is what refuted the 5.5 m read");

  /* Bollard light — a product step and one arithmetic statement joining the
     cap to the body, which is the contradiction round one shipped. */
  const B = S.bollardLight;
  near(B.height, 36 * IN, 0.01, "the bollard is the 36 in product step inside the 0.88-0.98 m solve");
  near(B.cap.square, B.body.square + 2 * B.cap.oversail, 1e-9,
    "cap = body + two oversails — the cap and the body are ONE statement");
  assert.ok(B.lens.width < B.body.square, "the lens is set in the face, not wider than it");
  near(B.lens.belowCap, 2 * B.cap.thickness, 1e-9, "the lens reveal extends the measured cap thickness");
  assert.ok(B.lens.belowCap + B.lens.height < B.height - B.cap.thickness,
    "the lens must fit inside the body it is glazed into");

  /* Guardrail — the solid fraction is the scale-free measurement that decided
     the picket, so it is the thing to gate, not the picket alone. */
  const G = S.guardrail;
  near(G.picket.diameter / G.picket.pitch, 0.18, 0.02, "the swa-5 solid fraction");
  near(G.picket.diameter, 0.75 * IN, 0.001, "3/4 in round tube is the product step 0.18 lands on");
  near(G.topRail.thickness, 1.9 * IN, 0.002, "top rail is 1 1/2 in Sch.40, OD 48.3 mm");
  near(G.bottomRail.thickness, 1.315 * IN, 0.002, "bottom rail is 1 in Sch.40, OD 33.4 mm");
  assert.ok(G.bottomRail.thickness < G.topRail.thickness,
    "the bottom rail reads distinctly thinner in the same frame");
  /* A ROUND TUBE SHIPPED AS A BOX IS SQUARE IN SECTION. Both rails used to be
     drawn at the top rail's box width, so the 1 in bottom tube shipped 45 %
     over-wide — and `bottomRail.depth` had been set to 0.048 to describe the
     bug rather than the product. */
  for (const r of ["topRail", "bottomRail"]) {
    assert.equal(G[r].depth, G[r].thickness,
      `${r} is a round tube shipped as a box: its depth and its thickness are one number`);
  }
  assert.equal(G.kerb.tier, "estimated",
    "the kerb is the least supported dimension in the system and may not wear the measured tier");
  assert.ok(G.kerb.height + G.bottomRail.above < G.height - G.topRail.thickness,
    "the bottom rail must sit under the top rail, not through it");

  /* Handrail — ADA bands are already gated above; these are the RATIOS the
     section says it extended, plus the arbitrated terminal post. */
  const H = S.handrail;
  near(H.intermediateRail / H.height, 0.61, 0.005, "the lower rail extends the top rail at 0.61");
  near(H.tube.diameter, 1.66 * IN, 0.001, "1 1/4 in Sch.40 gripping tube, OD 42.2 mm");
  assert.equal(H.terminalPost.diameter, H.tube.diameter,
    "phf03: the rail bends through 90 degrees and runs to the paving as the SAME tube");
  assert.ok(H.post.basePlate > H.post.diameter, "a fixing plate must exceed the post it carries");
  assert.ok(H.clearWidth >= 1.219, "CBC 11B-405.5 sets 48 in clear between ramp handrails");
  /* THE TWO NUMBERS THAT USED TO BE LITERALS IN THE MODULE. The terminal's
     bend radius (a bare geometry the module did not have at all) and the base
     flange's thickness (a bare 0.012, written twice). */
  near(H.terminalPost.bendRadius, 2 * H.tube.diameter, 1e-9,
    "2 x OD is the tightest cold centreline bend the gripping tube takes");
  near(H.post.basePlateThickness, 0.5 * IN, 1e-9, "1/2 in plate is the flange's product step");
  assert.ok(H.post.basePlateThickness < H.post.diameter,
    "a base flange is a plate, not a block");

  /* L1's crown and L2's head split — the last two bare fractions that lived in
     the module. Neither adds a dimension: the crown is the spherical cap the
     measured diameter and rise already fix, and the wedge's two-box break is
     mid-length for ANY linear taper, which is what makes 1/2 a derivation
     rather than a preference. */
  const cap = { R: L.shade.diameter / 2, h: L.shade.domeRise };
  const sphere = (cap.R * cap.R + cap.h * cap.h) / (2 * cap.h);
  near(sphere * (1 - Math.cos(Math.asin(cap.R / sphere))), cap.h, 1e-9,
    "the crown's spherical cap reproduces the measured dome rise exactly");
  near(L2.head.rootFraction * L2.head.thickAtArm + (1 - L2.head.rootFraction) * L2.head.thickAtNose,
    (L2.head.thickAtArm + L2.head.thickAtNose) / 2, 1e-9,
    "the two-box step must carry the wedge's own mean thickness");

  /* Bike hoop — the APBP product module, and the arbitrated cut of the weakest
     rank from 10 hoops to the 6 its own research states as the floor. */
  const R = S.bikeRack;
  near(R.hoop.width, 30 * IN, 1e-9, "30 in staple hoop");
  near(R.hoop.height, 33 * IN, 0.001, "33 in staple hoop, corroborated at 0.82 ± 0.06 m on swa-4");
  near(R.hoop.tube, 2.375 * IN, 0.001, "2 3/8 in Sch.40 — and emphatically not the shipped 25 mm sign post");
  assert.equal(R.hoop.spacing, R.hoop.width, "hoops at 30 in o.c., the APBP module");
  assert.ok(R.hoop.bendRadius < R.hoop.width / 2, "the quarter bends must fit inside the hoop's own width");
  /* And the bend is the same cold-bend rule as the handrail terminal, not the
     bare 0.20 the arbitration asserted without deriving. */
  near(R.hoop.bendRadius, 2 * R.hoop.tube, 1e-9,
    "2 x OD — the tightest centreline bend a 2 3/8 in Sch.40 tube takes");
  const swa12 = R.ranks.find((k) => k.key === "rack-swa12");
  assert.equal(swa12.hoops, 6,
    "swa-12 resolves a guardrail and bikes behind it, not a rack: 6 is the floor its own research states");

  /* Planter A — the whole family hangs off one solved camera height in swa-14,
     so every dimension is recomputed from that solve's own pixel numbers. */
  const PA = S.planterA;
  near(PA.height, (6.25 * 137) / 550, 0.01, "planter A height from the solved 6.25 m camera");
  near(PA.rimDiameter, 169 / 88, 0.01, "planter A rim at the resulting 88 px/m");
  near(PA.baseDiameter, 65 / 88, 0.01, "planter A foot at the resulting 88 px/m");
  near(PA.rim.thickness, PA.rimDiameter / 21, 0.005, "the rim section it declares it extends (1/21 of the diameter)");
  near(PA.rim.wall, (2 / 3) * PA.rim.thickness, 0.005, "the wall it declares it extends (2/3 of the rim)");
  assert.ok(PA.soilBelowRim > PA.rim.thickness, "the soil recess must clear the rim it is measured under");

  /* Planter B — one module, once square and once doubled. */
  const PB = S.planterB;
  assert.equal(PB.plan.small[0], PB.plan.small[1], "the small box is the 1:1 aspect swa-13 shows");
  near(PB.plan.large[0], 2 * PB.plan.large[1], 1e-9, "the large box is the 2:1 aspect the note claims");
  assert.equal(PB.plan.large[1], PB.plan.small[0], "both plans are the same module");
  near(PB.height, (2 / 3) * PA.height, 0.05, "family B extends family A at the two thirds swa-13 shows");

  /* Waste — the 36-gal square module, doubled, and the arched throat measured
     against the same 105 px overall width. */
  const W = S.waste;
  near(W.overall[0], 2 * W.bay.width, 1e-9, "the surround is two 36-gal bays wide");
  near(W.overall[2], W.bay.width, 1e-9, "and one bay deep — the module is square in plan");
  near(W.bay.width, 24 * IN, 0.005, "the 36-gallon square receptacle module is 24 in");
  near(W.throat.width, (38 * W.overall[0]) / 105, 0.005, "the throat is 38 px of the 105 px overall");
  near(W.throat.archRadius, W.throat.width / 2, 1e-9, "a semicircular head over the measured throat width");
  assert.equal(W.detailTier, "estimated", "no member under ~50 mm is resolvable at 8x on a 105 px object");

  /* Traffic bollard — declared to extend the bollard light's sourced height. */
  const T = S.trafficBollard;
  assert.equal(T.height, B.height, "the rank reads level with the bollard lights in phf19");
  near(T.diameter, 8.625 * IN, 0.005, "8 5/8 in nominal sleeve");
  /* The cap must stay a SPHERICAL CAP, which is the only profile here with no
     free parameter in it: base radius and rise fix the sphere outright. It
     shipped as a truncated cone off a bare `r * 0.86` written in the module. */
  assert.equal(T.cap.profile, "spherical-cap",
    "the bollard cap's profile must be the one whose dimensions are all already measured");
  assert.match(T.cap.profileNote, /0\.3125/, "the solved sphere radius must be recorded, not left to the code");
  near((T.diameter / 2) ** 2 + T.cap.rise ** 2, 2 * T.cap.rise * 0.3125, 1e-9,
    "R = (r^2 + rise^2) / 2 rise — the cap carries no dimension of its own");

  /* Totem — a measured proportion and an [estimated] absolute. */
  const TO = S.wayfindingTotem;
  near(TO.size[1] / TO.size[0], TO.proportion, 0.02, "the phf19 height:width proportion");
  assert.ok(TO.header.height < TO.size[1] * 0.05, "the header band is the 5 px of 122 phf19 shows");

  /* Blue light — two sourced figures and a head assembly that must fit between
     them without overlapping or leaving air. */
  const BL = S.blueLight;
  near(BL.height, 9 * 0.3048, 0.005, "the standard 9 ft emergency tower step");
  near(BL.section, 8 * IN, 0.001, "on an 8 in section");
  assert.equal(BL.callStation.width, BL.section, "the call station IS the section");
  assert.equal(BL.mast.from, BL.callStation.height, "the mast starts at the call station's head");
  near(BL.mast.square, BL.section / 2, 0.005, "the mast is half the section");
  assert.ok(BL.mast.to <= BL.shade.at, "the mast must reach the shade, not through it");
  assert.ok(BL.shade.at + BL.shade.height <= BL.height - BL.beacon.height,
    "the head assembly must fit under the sourced overall height");
  assert.ok(BL.callStation.buttonAt < BL.callStation.height, "the button is on the call station");
  assert.equal(BL.partsTier, "estimated", "everything below the overall height is a proportion, not a read");

  /* Detectable warning — the code fixes the panel, so the panel is checked
     against the code and not against a preference. */
  const D = S.detectableWarning;
  near(D.panel.width, 72 * IN, 0.005, "full ramp width, 72 in");
  /* The tile module is a dimension this section owns. It was a bare 0.61
     written into buildWarnings twice as a texture divisor, free to drift away
     from the panel it is supposed to tile. */
  near(D.panel.tileModule, 24 * IN, 0.005, "the cast tile ships as a 24 in square module");
  assert.equal(D.panel.depth, D.panel.tileModule, "the panel is one tile deep by code");
  near(D.panel.width / D.panel.tileModule, 3, 1e-9, "and exactly three tiles across");
  assert.ok(!/0\.61/.test(moduleSrc),
    "0.61 is the section's tile module — it may not be written into the module as a literal");
  const domeRatio = D.dome.topDiameter / D.dome.baseDiameter;
  assert.ok(domeRatio >= 0.5 && domeRatio <= 0.65, "CBC 11B-705: top 50-65% of base");
  assert.equal(D.rung, "carpet", "the tile is a decal ON the paving, so it takes the rung above it");
  assert.ok(OVERLAY[D.rung].lift > OVERLAY[section.groundDatum.rung].lift,
    "the warning tile must sit strictly above the rung its host walk is drawn on, or it z-fights");

  /* Sconce — the one thing swa-13 gives is a face aspect, so that is the one
     thing asserted; the rest is declared estimated and must stay unbuilt. */
  const A = S.ancillaryLighting;
  near(A.sconce.size[0] / A.sconce.size[1], 30 / 16, 0.05, "the swa-13 30 x 16 px face aspect");
  assert.ok(A.sconce.lens[0] < A.sconce.size[0] && A.sconce.lens[1] < A.sconce.size[1],
    "the lens is a band across the box's face, not larger than it");
  for (const k of ["festoon", "cove", "canopyDownlight"]) {
    assert.equal(A[k].built, false, `${k} has no host surface and may not be built`);
  }

  /* Court hardware — the rise is now DERIVED and is recomputed from its own
     four terms rather than read, which is what retired the bare 4.1. */
  const K = S.courtHardware;
  near(K.standard.rise,
    K.rim.height + K.backboard.height - K.backboard.bottomBelowRim + K.standard.armDiameter / 2,
    1e-9, "the standard's rise is its four measured terms, not a number");
  near(K.backboard.bottomBelowRim, 6 * IN, 1e-9, "the 42 in board hangs 6 in below the rim plane");
  near(K.standard.poleDiameter, 4.5 * IN, 0.001, "4 1/2 in mast (30 px at 257.7 px/m)");
  near(K.standard.armDiameter, 3.5 * 1.143 * IN, 0.001, "3 1/2 in Sch.40 arm, OD 101.6 mm");
  assert.ok(K.standard.armDiameter < K.standard.poleDiameter,
    "SWA -16 shows the arm as a visibly lighter member than the mast");
  /* THE RIM'S PROJECTION IS A RULE-BOOK INCH FIGURE, not 0.15. It shipped as a
     bare 0.15 while its own note said "6 in", and the module measured it from
     the board's CENTRE, so the rim stood 0.030 m closer to the glass than the
     rule it cites. Both halves are gated: the number here, the datum below. */
  near(K.rim.projection, 6 * IN, 1e-9, "6 in from the board face to the rim's near edge");
  /* The brace: a product step below the arm, and a tie point with no free
     parameter in it — the two bare fractions of the arm that used to live in
     buildCourt are gone. */
  near(K.standard.braceDiameter, 2.875 * IN, 1e-9, "2 1/2 in Sch.40 strut, OD 73.0 mm");
  assert.ok(K.standard.braceDiameter < K.standard.armDiameter,
    "the strut is a lighter member than the arm it braces — that is what set its size");
  near(K.standard.braceToArm,
    K.standard.setBack - K.backboard.thickness - K.backboard.frame / 2 - K.standard.braceDiameter / 2,
    1e-9, "the strut ties one brace radius short of the backboard assembly's back face");
  near(K.backboard.frameDepth, K.backboard.thickness + K.backboard.frame, 1e-9,
    "the channel is one flange width deeper than the glass it grips");
  /* THE RIG IS GONE FROM THIS SECTION. It was built here AND in
     eighthcourtyards at two sizes 4.9 m apart; campus-photo-pulsefitness.js
     owns it now, and this section may not size, place or colour it again. */
  assert.equal(K.calisthenics, undefined,
    "the calisthenics rig belongs to campus-photo-pulsefitness.js — this section declares it absent, it does not build it");
  assert.ok(section.absent.some((a) => /CALISTHENICS RIG/i.test(a) && /pulsefitness/i.test(a)),
    "the rig's new owner must be named in absent[], the way absent[14] names the tiers' owner");

  /* Signage — both lockups are recomputed from the pixel reads that scaled
     them, so the wall geometry cannot drift away from its own derivation. */
  const SG = S.signage;
  near(SG.wordmarks[0].capHeight, (22 / 6.0) * 0.0667, 0.002,
    "SANKOFA's cap is 3.67 brick courses at the assumed 66.7 mm Norman course");
  near(SG.numerals[0].height, 45 / 119, 0.005, "9185 at the phf03 wall scale of 119 px/m");
  near(SG.numerals[0].width, 95 / 119, 0.005, "9185's overall band at the same scale");
  for (const e of [...SG.wordmarks, ...SG.numerals]) {
    assert.equal(e.relief, 0.02, `${e.key}: the applied relief is one measured 0.02 m for the whole lockup`);
  }
});

test("the seating datum is the rung Eighth's own paving actually ships on", () => {
  /* Defect one of the round-one audit: every fixture was seated on the raw
     terrain while campus-eighth.js repaints all 36 anchor polygons as a decal
     one rung up, burying the kit by a median 0.090 m. The fix is only as good
     as the rung it names, so the rung is read out of the module that draws the
     paving rather than trusted. */
  const src = readFileSync(join(root, "docs/js/campus-eighth.js"), "utf8");
  const block = src.slice(src.indexOf("function surfaceMeshes("));
  const m = /const rung = "(\w+)"/.exec(block);
  assert.ok(m, "campus-eighth.js's surfaceMeshes no longer names a rung — the datum must be re-derived");
  assert.equal(section.groundDatum.rung, m[1],
    `Eighth's paving is drawn on the ${m[1]} rung; this section seats its fixtures on ${section.groundDatum.rung}`);
  assert.equal(section.groundDatum.lift, overlayLift(section.groundDatum.rung),
    "the declared lift must be the ladder's, not a number written down here");
  assert.match(section.groundDatum.exception, /detectableWarning/,
    "the one thing NOT on this datum has to be named");
});

test("every fixture obeys the placement rule its own system declares", async () => {
  /* Defect twelve: the suite checked that the placement CONSTANTS were the
     declared ones and never that a single item obeyed them, so two items sat
     outside their own rule with nothing to say so.
     THE PREDICATE IS THE RULE'S, NOT A NEARBY ONE. Each rule offsets from a
     SAMPLE POINT on a surveyed ring, so the distance it fixes is to the edge
     the point was stepped from — never to the nearest edge anywhere, which at
     a concave corner or across one of these rings' many degenerate slivers is
     a different and smaller number. What that makes testable is a CEILING: an
     item placed by a perimeter rule is inside (or outside) its polygon as the
     rule says, and no further from it than the offset the rule declares. Both
     halves bite; asserting a floor instead would fail six L1 poles, bl-1 and
     l2-4 for being at corners, which the section documents in its own
     `conformance` notes. */
  const anchors = section.measured.anchors;
  const ring = (k) => {
    assert.ok(anchors[k], `${k} is used as a placement anchor but was never copied verbatim`);
    return anchors[k].points;
  };
  const S = section.systems;

  for (const it of S.l1Pole.items) {
    const r = ring(it.anchor);
    assert.ok(inRing(it.x, it.z, r), `${it.key} is not inside the paved polygon its rule walks`);
    assert.ok(dRing(it.x, it.z, r) <= S.l1Pole.placement.inset + 0.01,
      `${it.key} is ${dRing(it.x, it.z, r).toFixed(2)} m in, past the rule's ${S.l1Pole.placement.inset} m perimeter inset`);
  }
  for (const it of S.bollardLight.items) {
    const bed = ring(it.anchor);
    const walk = ring(it.walk);
    assert.ok(!inRing(it.x, it.z, bed), `${it.key} stands INSIDE the planting bed it is supposed to step out of`);
    assert.ok(dRing(it.x, it.z, bed) <= S.bollardLight.placement.standoff + 0.01,
      `${it.key} is ${dRing(it.x, it.z, bed).toFixed(2)} m from its bed, past the ${S.bollardLight.placement.standoff} m standoff`);
    assert.ok(inRing(it.x, it.z, walk) || dRing(it.x, it.z, walk) <= S.bollardLight.placement.walkReach,
      `${it.key} is ${dRing(it.x, it.z, walk).toFixed(2)} m from the walk it lights, past walkReach`);
  }
  for (const it of S.l2Pole.items) {
    const walk = ring(it.anchor);
    assert.ok(!inRing(it.x, it.z, walk), `${it.key} stands ON the vehicular walk instead of outside it`);
    assert.ok(dRing(it.x, it.z, walk) <= S.l2Pole.placement.standoff + 0.15,
      `${it.key} is ${dRing(it.x, it.z, walk).toFixed(2)} m out, past the ${S.l2Pole.placement.standoff} m step`);
  }
  for (const it of S.trafficBollard.items) {
    const walk = ring(it.anchor);
    assert.ok(!inRing(it.x, it.z, walk), `${it.key} stands on the walk it lines`);
    assert.ok(Math.abs(dRing(it.x, it.z, walk) - 1.5) <= 0.01, `${it.key} is not the declared 1.5 m out`);
  }
  const tb = S.trafficBollard.items;
  for (let i = 1; i < tb.length; i++) {
    assert.ok(Math.abs(Math.hypot(tb[i].x - tb[i - 1].x, tb[i].z - tb[i - 1].z) - 1.5) <= 0.02,
      "the traffic rank is at the declared 1.5 m o.c.");
  }
  for (const it of S.waste.items) {
    const r = ring(it.anchor);
    /* The rule's one declared exception: swa-16's court-side pair stands north
       OF the surveyed court, not inside it. */
    if (it.anchor === "basketball-court") {
      assert.ok(!inRing(it.x, it.z, r), `${it.key} is the court-side pair and must stand off the court`);
      continue;
    }
    assert.ok(inRing(it.x, it.z, r), `${it.key} is not inside its courtyard`);
    assert.ok(dRing(it.x, it.z, r) <= 0.9 + 0.1,
      `${it.key} is ${dRing(it.x, it.z, r).toFixed(2)} m in, past the rule's 0.9 m inset`);
  }
  for (const sys of ["planterA", "planterB", "wayfindingTotem", "blueLight"]) {
    for (const it of S[sys].items) {
      assert.ok(inRing(it.x, it.z, ring(it.anchor)),
        `${it.key} is not inside the surveyed polygon its source declares it stands in`);
    }
  }
  for (const rank of S.bikeRack.ranks) {
    const r = ring(rank.anchor);
    assert.ok(inRing(rank.x, rank.z, r), `${rank.key} is not inside its polygon`);
  }
  /* Separations are rejection radii, and a rejection radius IS a floor. */
  for (const [sys, sep] of [[S.l1Pole, S.l1Pole.placement.separation],
    [S.bollardLight, S.bollardLight.placement.separation], [S.l2Pole, S.l2Pole.placement.separation]]) {
    const its = sys.items;
    for (let i = 0; i < its.length; i++) {
      for (let j = i + 1; j < its.length; j++) {
        assert.ok(Math.hypot(its[i].x - its[j].x, its[i].z - its[j].z) >= sep,
          `${its[i].key} and ${its[j].key} are closer than the rule's ${sep} m separation`);
      }
    }
  }
  /* And the two documented near-misses have to STAY documented: without their
     conformance notes the ceiling above would look like a loophole. */
  assert.match(S.bollardLight.placement.conformance, /bl-1/);
  assert.match(S.l2Pole.placement.conformance, /l2-4/);

  /* THE REJECTION RADII ARE PART OF THE RULE AND WERE NEVER CHECKED. Three
     systems declare a `massClearance` and L1 declares a `minAnchorArea`, and
     nothing in the module or this suite read any of them — the footprint gate
     above only asks whether an item is INSIDE a mass, i.e. 0 m of clearance.
     They hold today (the tightest is l1-26 at 3.40 m against a declared 3);
     that is a fact nobody was keeping true. */
  const massRings = Object.values(section.measured.massing).map((m) => [m.name, m.ring]);
  for (const key of ["l1Pole", "l2Pole", "bollardLight"]) {
    const clear = S[key].placement.massClearance;
    assert.equal(typeof clear, "number", `${key} declares no massClearance`);
    for (const it of S[key].items) {
      for (const [name, r] of massRings) {
        assert.ok(dRing(it.x, it.z, r) >= clear,
          `${it.key} is ${dRing(it.x, it.z, r).toFixed(2)} m from ${name}, inside its own rule's ${clear} m mass clearance`);
      }
    }
  }
  const polyArea = (p) => {
    let a = 0;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]);
    return Math.abs(a / 2);
  };
  for (const it of S.l1Pole.items) {
    const A = polyArea(ring(it.anchor));
    assert.ok(A >= S.l1Pole.placement.minAnchorArea,
      `${it.key} stands on ${it.anchor}, ${A.toFixed(1)} m2, under the rule's ${S.l1Pole.placement.minAnchorArea} m2 floor`);
  }

  /* THE LIGHTING SCHEDULE AND THE ARBITRATION RECORD MUST AGREE. The verdict's
     headline was "28 + 5 + 22 = 55"; bl-13 was withdrawn afterwards and the
     headline was never reconciled to it. The reconciliation carries the number
     and this recomputes it, so the note cannot go stale either. */
  const fixtures = S.l1Pole.items.length + S.l2Pole.items.length + S.bollardLight.items.length;
  assert.ok(S.bollardLight.scheduleReconciliation.includes(String(fixtures)),
    `the schedule ships ${fixtures} fixtures and the reconciliation does not say so`);
  assert.match(S.bollardLight.scheduleReconciliation, /bl-13/,
    "the one withdrawal that makes the two counts differ must be named");
});

test("the whole detectable-warning tile lies on the walk it marks", () => {
  /* A warning surface is a surface OF the walking surface. Round one placed
     both panels with their centres on the walk boundary, so two corners of
     each 1.83 x 0.61 m tile hung over ground the walk polygon does not cover —
     half a lifted paving decal one rung above nothing it is a decal of. */
  const D = section.systems.detectableWarning;
  for (const it of D.items) {
    const r = section.measured.anchors[it.anchor].points;
    const c = Math.cos(it.rotY);
    const s = Math.sin(it.rotY);
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const x = it.x + c * (a * D.panel.width / 2) + s * (b * D.panel.depth / 2);
      const z = it.z - s * (a * D.panel.width / 2) + c * (b * D.panel.depth / 2);
      assert.ok(inRing(x, z, r),
        `${it.key}'s corner (${x.toFixed(2)}, ${z.toFixed(2)}) falls outside ${it.anchor}`);
    }
  }
  assert.match(D.seatingRule, /all four/i, "the seating rule must stay on the record");
});

test("no invented fixture overlaps a measured shipped object", () => {
  /* THIS IS THE GATE THE SECTION PROMISES. `measuredObstacles.rule` says the
     test re-runs the overlap against campus-eighth-furniture.js's PLAZA_OBJECTS
     and campus-photo-detail.json's bbq items "rather than against a copy kept
     here" — the helpers above did exactly that and nothing ever called them, so
     the eight collisions round one repaired had nothing keeping them repaired.
     Every position this section stands on the ground is checked, at the 0.30 m
     margin the section itself declares. */
  assert.ok(MEASURED_OBSTACLES.length >= 30,
    `only ${MEASURED_OBSTACLES.length} measured obstacles read — the two source files did not parse`);
  assert.match(section.measuredObstacles.rule, /0\.30 m margin/);
  const pad = 0.30;
  const hits = [];
  for (const o of groundFootprints()) {
    for (const t of hitsMeasured(o, pad)) hits.push(`${o.key} overlaps measured ${t.key}`);
  }
  assert.deepEqual(hits, [],
    "invented geometry crossing measured geometry — the measured object wins and this section moves");
});

test("the drawn-ground check is recomputed from the LiDAR, not remembered", () => {
  /* The section's honesty about its own guards rests entirely on this block:
     it is what lets the CBC citation stay on the guard height without implying
     a drop the drawn ground does not have. A recorded figure nobody recomputes
     goes stale the first time a run moves, so every figure is re-derived here
     from campus-lidar.json exactly as the block describes — sampled every 0.5 m
     along the run, cross-fall between points 2 m either side. */
  const C = section.drawnGroundCheck;
  const runs = [...section.systems.guardrail.runs, ...section.systems.handrail.runs];
  assert.equal(Object.keys(C.runs).length, runs.length, "every run must be in the check");
  let worstGuardCross = 0;
  let steepestRail = 0;
  for (const run of runs) {
    const rec = C.runs[run.key];
    assert.ok(rec, `${run.key} is not in drawnGroundCheck`);
    const [ax, az] = run.a;
    const [bx, bz] = run.b;
    const len = Math.hypot(bx - ax, bz - az);
    const ux = (bx - ax) / len;
    const uz = (bz - az) / len;
    const hs = [];
    let cross = 0;
    for (let t = 0; t <= len + 1e-9; t += 0.5) {
      const x = ax + ux * t;
      const z = az + uz * t;
      hs.push(drawnGround(x, z));
      cross = Math.max(cross, Math.abs(drawnGround(x - uz * 2, z + ux * 2) - drawnGround(x + uz * 2, z - ux * 2)));
    }
    const along = Math.max(...hs) - Math.min(...hs);
    assert.ok(Math.abs(len - rec.length) <= 0.005, `${run.key} length drifted to ${len.toFixed(3)}`);
    assert.ok(Math.abs(along - rec.alongFall) <= 0.005, `${run.key} alongFall is really ${along.toFixed(3)}`);
    assert.ok(Math.abs(cross - rec.crossFall) <= 0.005, `${run.key} crossFall is really ${cross.toFixed(3)}`);
    assert.ok(Math.abs(along / len - rec.grade) <= 0.001, `${run.key} grade is really ${(along / len).toFixed(4)}`);
    if (run.key.startsWith("gr-")) worstGuardCross = Math.max(worstGuardCross, cross);
    steepestRail = Math.max(steepestRail, along / len);
  }
  /* And the VERDICT the block draws from those figures has to still be true.
     If a future terrace ever ships under these runs this assertion flips, which
     is the moment absent[] entries 21 and 22 stop being true and must be
     retired — the gate is there to catch that, not to freeze it. */
  assert.ok(worstGuardCross < C.trigger.guard,
    `a guard now stands on a real ${worstGuardCross.toFixed(3)} m drop — the drawnGroundCheck verdict and absent[] must be revisited`);
  assert.ok(steepestRail < C.trigger.ramp * 1.1, "no run reaches the 1:20 ramp grade on the drawn ground");
  assert.ok(section.absent.some((a) => /RETAINED DROP/i.test(a)),
    "the drop the guards belong to is unbuilt and must stay declared absent");
  assert.ok(section.absent.some((a) => /RAMP GRADE/i.test(a)),
    "the ramp grade under the handrails is unbuilt and must stay declared absent");
});

test("the corrections name real shipped entities", () => {
  assert.ok(Array.isArray(section.supersedes) && section.supersedes.length >= 10,
    "the supersedes list is how this section replaces shipped work without editing it");
  const shipped = photoDoc.eighth;
  const count = (t) => shipped.items.filter((i) => i.type === t).length;
  /* Each superseded type must still BE there — the moment the main session
     removes it, that line is stale and this gate says so. */
  for (const [type, n] of [["light-pole", 8], ["bollard-light", 10], ["planter-cube", 4], ["bike-rack", 2]]) {
    const line = section.supersedes.find((s) => s.includes(`type=${type}`));
    assert.ok(line, `nothing supersedes the shipped ${type} items`);
    assert.match(line, new RegExp(`\\(${count(type)} items`),
      `the ${type} line claims the wrong count (shipped: ${n})`);
  }
  assert.ok(section.supersedes.some((s) => /planterWhite/.test(s)),
    "the colour of an object that is not there must be superseded too");
  assert.ok(section.supersedes.some((s) => /courtKey/.test(s) && /courtLogo/.test(s)),
    "the two shadowed Apple court hexes must be superseded by the sunlit 2025 read");
  assert.ok(section.supersedes.some((s) => /absent\[0\]/.test(s)),
    "the falsified absent entry must be named");
});

test("the clips are declared, motivated, and they bite in the data", () => {
  assert.ok(Array.isArray(section.clips) && section.clips.length >= 5);
  for (const c of section.clips) {
    assert.ok(c.x1 > c.x0 && c.z1 > c.z0, `${c.key} is not a rectangle`);
    assert.ok(c.why && c.why.length >= 60, `${c.key} has no reason`);
  }
  /* A clip that removes nothing is decoration. At least one declared item
     must fall inside one, or the mechanism is untested. */
  const bitten = groundItems().filter((it) => section.clips.some((c) => inClip(it.x, it.z, c)));
  assert.ok(bitten.length >= 1,
    "no declared item falls inside a clip — the clip mechanism would be untested");
  /* And specifically the court: the paved-polygon rule DOES generate poles on
     the playing surface, and swa-16 shows nothing standing there. */
  const courtClip = section.clips.find((c) => c.key === "court-play");
  assert.ok(courtClip, "the court clip must stay");
  const onCourt = section.systems.l1Pole.items.filter((it) => inClip(it.x, it.z, courtClip));
  assert.ok(onCourt.length >= 1, "the court clip is not removing anything");
  /* AND EVERY CLIP SAYS WHICH KIND IT IS. Three of the five — both ramble
     bridges and the amphitheatre tiers — bite nothing at all as the runs
     stand, so their `why` reads as though they are removing duplicates when
     they are not. A clip may be a forward guard; it may not pretend to be a
     live cut. The one it must never become is a clip added after a collision
     appears, to make a screenshot look right. */
  const items = groundItems();
  for (const c of section.clips) {
    const bites = items.filter((it) => inClip(it.x, it.z, c)).length;
    if (bites === 0) {
      assert.match(c.why, /FORWARD GUARD/,
        `${c.key} removes nothing today and its reason does not say it is a forward guard`);
    } else {
      assert.ok(!/FORWARD GUARD/.test(c.why),
        `${c.key} now bites ${bites} items — it is a live cut and must stop calling itself a forward guard`);
    }
  }
});

test("the second court hoop build is named for as long as it is there", () => {
  /* THE HARD DUPLICATE. campus-eighth-court.js builds a complete Muir-spec
     hoop assembly at both ends of this same court — a 3.95 m pole on
     back(h, 1.9), a 1.5 m arm, a 1.83 x 1.07 m board, a 0.225 m ring, a net —
     under a comment saying no frame resolves a backboard, a rim or a pole.
     With BASKET_IN 1.575 that mast stands 0.325 m outside the baseline and
     this section's measured one stands 0.20 m outside: 0.125 m apart, two
     backboards and two rims over them. Removing it is the wiring session's
     edit, not this agent's, so the gate is bidirectional — the supersedes
     entry must exist while the block does, and must be retired when it goes.
     Either way the two files cannot drift apart in silence. */
  const src = readFileSync(join(root, "docs/js/campus-eighth-court.js"), "utf8");
  const buildsHoops = /for \(const h of c\.hoops\)/.test(src) && /counts\.hoops\+\+/.test(src);
  const line = section.supersedes.find((s) => /campus-eighth-court\.js/.test(s) && /HOOP BLOCK/.test(s));
  if (buildsHoops) {
    assert.ok(line,
      "campus-eighth-court.js still builds a second hoop assembly on this court and nothing in supersedes names it");
    assert.match(line, /counts\.hoops/, "the supersedes entry must name the block it retires, not the file");
    assert.match(line, /0\.125 m/, "it must carry the measured separation of the two masts");
  } else {
    assert.equal(line, undefined,
      "the duplicate hoop block is gone — retire the supersedes entry in the same edit");
  }
  /* And the section may not go on calling that module's comment an omission. */
  const F = section.systems.courtHardware.falsifies;
  assert.match(F, /BUILDS a Muir-spec/,
    "campus-eighth-court.js does not omit the hoops, it draws them — the falsification claim was wrong");
  assert.match(F, /absent\[0\]/, "the one entry that IS falsified must stay named");
});

/* ----------------------------------------------- the module, run for real */

const build = async (ground) => {
  const { createPhotoEighthSiteworks } = await import("../docs/js/campus-photo-eighthsiteworks.js");
  return createPhotoEighthSiteworks(null, {
    photo: { eighthsiteworks: section }, heightAt: ground, surfaceAt: ground,
  });
};
const matrices = (r) =>
  r.group.children.filter((c) => c.isInstancedMesh).map((c) => Array.from(c.instanceMatrix.array));

test("the module builds every system, and the counts are the declared ones", async () => {
  const THREE = await import("../docs/vendor/three/three.module.min.js");
  const r = await build(() => 12.4);
  assert.ok(r.group instanceof THREE.Group);
  const S = section.systems;
  const c = r.counts;
  /* `counts.systems` USED TO BE Object.keys(section.systems).length, checked
     against Object.keys(section.systems).length — a tautology that could not
     see a system losing its builder, and that counted l1bPole (declared and
     deliberately unplaced) as built. It is now the list of systems that
     actually put geometry in the group, asserted against an explicit roll. */
  assert.deepEqual(c.built, [
    "l1Pole", "l2Pole", "bollardLight", "guardrail", "handrail", "bikeRack",
    "planterA", "planterB", "waste", "trafficBollard", "detectableWarning",
    "wayfindingTotem", "blueLight", "signage", "ancillaryLighting", "courtHardware",
  ], "a system stopped contributing geometry, or a new one is not on the roll");
  assert.equal(c.systems, c.built.length);
  assert.equal(c.systems, Object.keys(S).length - 1,
    "l1bPole is the ONE declared-and-unplaced system; any second one needs saying out loud");
  assert.equal(c.l1Poles + c.l1PolesClipped, S.l1Pole.items.length);
  assert.equal(c.l1YokeBlades, c.l1Poles * S.l1Pole.yoke.blades);
  assert.equal(c.l2Poles, S.l2Pole.items.length);
  assert.equal(c.bollardLights, S.bollardLight.items.length);
  assert.equal(c.guardrailRuns, S.guardrail.runs.length);
  assert.equal(c.handrailRuns, S.handrail.runs.length);
  assert.equal(c.bikeRanks, S.bikeRack.ranks.length);
  assert.equal(c.bikeHoops, S.bikeRack.ranks.reduce((s, x) => s + x.hoops, 0));
  assert.equal(c.plantersRound, S.planterA.items.length);
  assert.equal(c.plantersBox, S.planterB.items.length);
  assert.equal(c.wasteUnits, S.waste.items.length);
  assert.equal(c.trafficBollards, S.trafficBollard.items.length);
  assert.equal(c.warningPanels, S.detectableWarning.items.length);
  assert.equal(c.totems, S.wayfindingTotem.items.length);
  assert.equal(c.blueLights, S.blueLight.items.length);
  assert.equal(c.wordmarks, S.signage.wordmarks.length);
  assert.equal(c.numerals, S.signage.numerals.length);
  assert.equal(c.sconces, S.ancillaryLighting.sconce.faces.reduce((s, f) => s + f.count, 0));
  assert.equal(c.courtHoops, S.courtHardware.hoops.length);
  /* Every system contributed something. */
  for (const k of ["l1Poles", "l2Poles", "bollardLights", "guardrailPickets", "handrailPosts",
    "handrailTerminals", "bikeHoops", "plantersRound", "plantersBox", "wasteUnits",
    "trafficBollards", "warningPanels", "warningDomes", "totems", "blueLights",
    "wordmarks", "numerals", "sconces", "courtHoops"]) {
    assert.ok(c[k] > 0, `${k} built nothing`);
  }
  /* THE TERMINAL IS DRAWN, NOT JUST DECLARED. Two down-turns per side of every
     run: the section's `terminalPost` and its ADA extension were asserted by
     this suite for a round while buildHandrails drew neither — the extension
     was clamped back onto the run ends and collapsed to zero-length segments,
     and the 90-degree return did not exist at all. */
  assert.equal(c.handrailTerminals, S.handrail.runs.length * 4,
    "both ends of both sides of every run turn down to the paving");
  /* The picket count is the measured pitch applied to the shipped run lengths,
     recomputed here rather than trusted. */
  const expected = S.guardrail.runs.reduce((s, run) =>
    s + Math.floor(Math.hypot(run.b[0] - run.a[0], run.b[1] - run.a[1]) / S.guardrail.picket.pitch), 0);
  assert.equal(c.guardrailPickets, expected, "a picket run does not match the measured pitch");
  /* Heavy repeats must be instanced, or this kills the frame rate. */
  assert.ok(c.draws < 100, `${c.draws} draw calls for a site kit`);
});

test("the rim is set out from the board's FACE, and the strut clears the board", async () => {
  /* `rim.projectionNote` defines its 6 in as "from the board face to the rim's
     near edge". buildCourt measured it from the board's CENTRE, so the rim sat
     0.030 m too close to the glass — and by the same half-thickness the board
     FACE landed 1.25 m inside the baseline where the arbitration measured
     1.22. A provenance sentence cannot catch that; only rebuilding the
     assembly and measuring it can, so that is what this does. */
  const g = 12.4;
  const r = await build(() => g);
  /* EVERYTHING THIS MODULE STANDS ON THE GROUND IS ON THE PAD RUNG, not on the
     terrain: the seat is surfaceAt + overlayLift("pad"). Reading the built
     matrices means reading them against that datum, which is taken from the
     build rather than written here. */
  const y0 = g + r.counts.datumLift;
  const K = section.systems.courtHardware;
  const meshes = r.group.children.filter((c) => c.isInstancedMesh);
  const originsOf = (m) => {
    const out = [];
    for (let i = 0; i < m.count; i++) {
      out.push([m.instanceMatrix.array[i * 16 + 12], m.instanceMatrix.array[i * 16 + 13],
        m.instanceMatrix.array[i * 16 + 14]]);
    }
    return out;
  };
  /* The boards and the rims are the two draws with exactly one instance per
     hoop at the rim's own height band; find them by their geometry instead. */
  /* The instance matrices are a Float32Array, so every comparison below is at
     1e-4 m — four significant figures finer than the 0.030 m slip it is here
     to catch, and coarser than the buffer's own resolution. */
  const EPS = 1e-4;
  const boardMesh = meshes.find((m) => m.geometry.type === "BoxGeometry" && m.count === K.hoops.length
    && Math.abs(m.instanceMatrix.array[13] - (y0 + K.rim.height + K.backboard.height / 2 - K.backboard.bottomBelowRim)) < EPS);
  const rimMesh = meshes.find((m) => m.geometry.type === "TorusGeometry" && m.count === K.hoops.length
    && Math.abs(m.geometry.parameters.radius - K.rim.diameter / 2) < 1e-9);
  assert.ok(boardMesh, "the backboard draw is not at the height its own derivation states");
  assert.ok(rimMesh, "no rim draw");
  const boards = originsOf(boardMesh);
  const rims = originsOf(rimMesh);
  for (let i = 0; i < K.hoops.length; i++) {
    const h = K.hoops[i];
    const s = (p) => (p[0] - h.x) * Math.sin(h.rotY) + (p[2] - h.z) * Math.cos(h.rotY);
    const face = s(boards[i]) + K.backboard.thickness / 2;
    const rimNear = s(rims[i]) - K.rim.diameter / 2;
    assert.ok(Math.abs(rimNear - face - K.rim.projection) < EPS,
      `${h.key}: the rim's near edge is ${(rimNear - face).toFixed(4)} m off the board face, not the rule's ${K.rim.projection}`);
    assert.ok(Math.abs(face - h.setBack) < EPS,
      `${h.key}: the arm's ${h.setBack} m reach must land on the board's FACE, not its centre (it lands at ${face.toFixed(4)})`);
  }
  /* And the strut, which is the one member with no photographic springing
     point at either end, must not reach the assembly it braces. */
  const braceRise = K.standard.rise - K.standard.armDiameter / 2 - K.standard.braceFrom;
  const run = K.standard.braceToArm;
  const tipReach = run + (K.standard.braceDiameter / 2) * (braceRise / Math.hypot(braceRise, run));
  const backFace = K.standard.setBack - K.backboard.thickness - K.backboard.frame / 2;
  assert.ok(tipReach < backFace,
    `the brace's end cap reaches ${tipReach.toFixed(4)} m and the backboard assembly starts at ${backFace.toFixed(4)} m`);
});

test("the handrail terminal turns down to the paving, and the picket dome is a choice", async () => {
  const g = 12.4;
  const H = section.systems.handrail;
  const r = await build(() => g);
  const y0 = g + r.counts.datumLift;
  /* The quarter bend and the vertical leg are the geometry that was missing.
     Every bend's centre must sit exactly one bend radius under the gripping
     height, which is the only position from which the arc is tangent to the
     rail at one end and to the leg at the other. */
  const torus = r.group.children.filter((c) => c.isInstancedMesh
    && c.geometry.type === "TorusGeometry"
    && Math.abs(c.geometry.parameters.radius - H.terminalPost.bendRadius) < 1e-9);
  assert.equal(torus.length, 1, "the handrail terminal's quarter bend is not built");
  assert.equal(torus[0].count, H.runs.length * 4);
  assert.ok(Math.abs(torus[0].geometry.parameters.arc - Math.PI / 2) < 1e-9, "a quarter turn, not a full ring");
  assert.ok(Math.abs(torus[0].geometry.parameters.tube - H.tube.diameter / 2) < 1e-9,
    "phf03: the return is the SAME tube as the rail, not a thinner baluster");
  for (let i = 0; i < torus[0].count; i++) {
    const y = torus[0].instanceMatrix.array[i * 16 + 13];
    assert.ok(Math.abs(y - (y0 + H.height - H.terminalPost.bendRadius)) < 1e-4,
      "a bend centre is not one radius under the gripping surface, so its arc is not tangent");
  }
  /* `picket.domedTop` is CONSULTED. It was true in the data and the domes were
     built unconditionally, so the key described nothing. Flipping it must
     change the geometry — that is the whole difference between a field and a
     comment. */
  const off = JSON.parse(JSON.stringify(section));
  off.systems.guardrail.picket.domedTop = false;
  const { createPhotoEighthSiteworks } = await import("../docs/js/campus-photo-eighthsiteworks.js");
  const r2 = createPhotoEighthSiteworks(null, {
    photo: { eighthsiteworks: off }, surfaceAt: () => g,
  });
  assert.ok(r2.counts.draws < r.counts.draws,
    "turning domedTop off changed nothing — the flag is decoration, not data");
  assert.equal(r2.counts.guardrailPickets, r.counts.guardrailPickets,
    "only the domes come off, not the pickets");
});

test("two builds are byte-identical", async () => {
  const a = await build(() => 12.4);
  const b = await build(() => 12.4);
  assert.deepEqual(a.counts, b.counts);
  assert.deepEqual(matrices(a), matrices(b), "two builds must be byte-identical");
});

test("nothing hovers and nothing sinks, on flat ground and on a slope", async () => {
  /* The real test of seating station by station: a ground that MOVES. If any
     run, picket, post or fixture were placed at one datum, a 1-in-12 slope
     across the site would leave one end of it buried and the other in the air. */
  const slope = (x, z) => 12.4 + x * 0.06 - z * 0.04;
  const r = await build(slope);
  const tallest = 7.2; /* the L2 pole, the tallest thing this module builds */
  for (const c of r.group.children.filter((x) => x.isInstancedMesh)) {
    const m = c.instanceMatrix.array;
    for (let i = 0; i < c.count; i++) {
      const x = m[i * 16 + 12];
      const y = m[i * 16 + 13];
      const z = m[i * 16 + 14];
      const g = slope(x, z);
      assert.ok(y >= g - 0.05, `an instance sits at ${(y - g).toFixed(3)} m under the drawn ground`);
      assert.ok(y <= g + tallest, `an instance floats ${(y - g).toFixed(2)} m above the ground`);
    }
  }
  /* AND THE ONE THING THAT IS NOT AN INSTANCE. The detectable-warning panel is
     a single merged mesh, so a per-instance-origin check cannot see it at all —
     which is how round one shipped one flat quad at the panel centre that cut
     0.076 m into the ground at its upslope edge. Every vertex of it is checked
     here, against its own rung's lift rather than the fixture datum. */
  const lift = overlayLift(section.systems.detectableWarning.rung);
  const merged = r.group.children.filter((c) => c.isMesh && !c.isInstancedMesh);
  assert.ok(merged.length >= 1, "the warning panel should be one merged mesh");
  let checked = 0;
  for (const c of merged) {
    const p = c.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const want = slope(p.getX(i), p.getZ(i)) + lift;
      /* 0.1 mm, which is the Float32 buffer's own resolution at these world
         heights and four hundred times finer than round one's 76 mm error. */
      assert.ok(Math.abs(y - want) < 1e-4,
        `a warning-panel vertex sits ${(y - want).toFixed(4)} m off the drawn ground — the panel is not following it`);
      checked++;
    }
  }
  assert.ok(checked >= 4 * section.systems.detectableWarning.items.length,
    "the panel must be subdivided, not one quad per item");
});

test("the clips are respected by the geometry, not just by the data", async () => {
  const g = () => 12.4;
  const r = await build(g);
  const courtClip = section.clips.find((c) => c.key === "court-play");
  const dropped = section.systems.l1Pole.items.filter((it) => inClip(it.x, it.z, courtClip));
  assert.ok(dropped.length >= 1);

  const pts = [];
  for (const c of r.group.children.filter((x) => x.isInstancedMesh)) {
    const m = c.instanceMatrix.array;
    for (let i = 0; i < c.count; i++) {
      pts.push([m[i * 16 + 12], m[i * 16 + 13], m[i * 16 + 14]]);
    }
  }
  /* The clipped poles are GONE — not moved, not shortened. Nothing at all is
     built within 0.8 m of where each one was declared. */
  for (const it of dropped) {
    const near = pts.filter(([x, , z]) => Math.hypot(x - it.x, z - it.z) < 0.8);
    assert.equal(near.length, 0, `${it.key} was clipped but ${near.length} instances remain at its position`);
  }
  /* And nothing STANDS inside any clip. The one thing allowed to reach over a
     clip is the backboard-and-rim assembly, which overhangs the court above
     head height exactly as a basketball hoop must; below 2.5 m the clips are
     absolute. */
  for (const c of section.clips) {
    const intruders = pts.filter(([x, y, z]) => y < 12.4 + 2.5 && inClip(x, z, c));
    assert.equal(intruders.length, 0,
      `${intruders.length} instances stand inside clip ${c.key}`);
  }
});

test("everything the module builds stays inside the declared envelope", async () => {
  const r = await build(() => 12.4);
  const b = section.bounds;
  for (const c of r.group.children.filter((x) => x.isInstancedMesh)) {
    const m = c.instanceMatrix.array;
    for (let i = 0; i < c.count; i++) {
      const x = m[i * 16 + 12];
      const z = m[i * 16 + 14];
      assert.ok(x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1,
        `an instance at (${x.toFixed(1)}, ${z.toFixed(1)}) escapes the envelope`);
    }
  }
});

test("the module is a one-way reader, deterministic, and on the shared ladders", () => {
  const src = readFileSync(join(root, "docs/js/campus-photo-eighthsiteworks.js"), "utf8");
  assert.match(src, /(?:shared|create)MaterialLibrary/, "surfaces come from campus-materials.js");
  assert.ok(!/Math\.random|Date\.now|new Date/.test(src), "no nondeterminism in the builder");
  assert.match(src, /overlayLift|applyOverlayDepth/, "ground decals ride the overlay ladder");
  assert.ok(!/polygonOffsetFactor\s*[:=]/.test(src),
    "no local depth constant — the ladder lives in campus-overlay.js");
  assert.ok(!/photo\.eighthsiteworks\s*=|section\.\w+\s*=\s/.test(src),
    "the module must never write back into the section");
  assert.match(src, /export function createPhotoEighthSiteworks/, "the declared entry point");
  /* Textures are code-generated; no photograph or satellite pixel anywhere. */
  assert.ok(!/\.(jpg|png|webp|jpeg)/i.test(src), "no image asset may be sampled");
});

test("the module is harmless when the section is missing", async () => {
  const { createPhotoEighthSiteworks } = await import("../docs/js/campus-photo-eighthsiteworks.js");
  const r = createPhotoEighthSiteworks(null, { photo: {}, surfaceAt: () => 12.4 });
  assert.equal(r.group.children.length, 0);
  assert.deepEqual(r.counts, {});
});
