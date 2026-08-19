/* Pulse's OUTDOOR FITNESS ZONE — the photo-sourced INVENTED class.
 *
 * One object: the open-air calisthenics / functional-training rig on Pulse's
 * north colonnade terrace, and the two heavy bags hung off it. The gates here
 * are the same family as its siblings — quarantine, provenance, arithmetic,
 * and not contradicting the measured world:
 *
 *   - it is labelled, epoch-stamped, sourced (every source carries a date),
 *     and it says what it left out;
 *   - colours are data, they are hex, and EVERY role has its own provenance
 *     line naming a frame and a tier — including the two that ship as SHADOW
 *     reads against the project's usual rule and admit it;
 *   - every surveyed ring it leans on is a VERBATIM copy of campus-eighth.json
 *     ground / campus-arcgis.json massing — one changed number fails;
 *   - the rig stands on surveyed paving and OUTSIDE the surveyed building it
 *     leans against — the [estimated] position is loose, but not that loose;
 *   - every dimension is the arithmetic its own derivation states;
 *   - the counts are the declared ones;
 *   - nothing hovers — re-built over SLOPING ground the frame stays rigid and
 *     every footing still reaches its own local surface;
 *   - two builds are byte-identical;
 *   - the absent list does not shrink, and the bag answer stays YES.
 *
 * The section lives under the top-level `pulsefitness` key of
 * docs/data/campus-photo-detail.json.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(p, "utf8"));

const photoDoc = read(join(root, "docs/data/campus-photo-detail.json"));

const section = photoDoc.pulsefitness;

const eighth = read(join(root, "docs/data/campus-eighth.json"));
const arcgis = read(join(root, "docs/data/campus-arcgis.json"));
const lidar = read(join(root, "docs/data/campus-lidar.json"));

const { makeSurfaceSampler } = await import("../docs/js/campus-terrain.js");
const { overlayLift } = await import("../docs/js/campus-overlay.js");
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

const R = () => section.rig;
const near = (a, b, eps, what) =>
  assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b} (tolerance ${eps})`);

/** The plan corners of the rig's overall envelope, arms included. */
function envelopeCorners() {
  const r = R();
  const xs = [r.centre[0] - r.overallLength / 2, r.centre[0] + r.overallLength / 2];
  return xs.flatMap((x) => r.rowZ.map((z) => [x, z]));
}

const moduleSrc = readFileSync(join(root, "docs/js/campus-photo-pulsefitness.js"), "utf8");

/* --------------------------------------------------------------- the data */

test("the section exists and says what it is", () => {
  assert.ok(section, "no pulsefitness section — neither shipped nor staged");
  for (const k of ["label", "epoch", "note", "seed", "positionCaveat", "sources",
    "colors", "colorSources", "camera", "measured", "reads", "derivations",
    "groundDatum", "rig", "bags", "clips", "supersedes", "absent", "counts"]) {
    assert.ok(section[k] !== undefined, `section is missing ${k}`);
  }
  assert.equal(typeof section.seed, "number");
  assert.ok(section.label.length > 40, "the label must say what the object is");
  assert.match(section.epoch, /2024-25/);
  assert.match(section.epoch, /LiDAR|lidar|LIDAR/, "the epoch must state that the 2014 LiDAR is blind here");
});

test("every source carries a date and the only frame is named", () => {
  assert.ok(section.sources.length >= 4, "too few sources for the ladder to have been climbed");
  for (const s of section.sources) {
    assert.match(s, /\b(19|20)\d\d\b/, `source has no date: ${s.slice(0, 70)}`);
    assert.ok(s.length > 80, `source is not described: ${s.slice(0, 70)}`);
  }
  assert.ok(section.sources.some((s) => /Living-Learning-16/.test(s)),
    "swa-16 is the only frame that resolves this object and it must be cited");
  assert.ok(section.sources.some((s) => /addendum5|Pulse-Layouts/.test(s)),
    "the planning-document rung must be recorded as searched, even though it came up empty");
});

test("colours are data, they are hex, and every role has provenance", () => {
  const roles = Object.keys(section.colors);
  assert.ok(roles.length >= 4);
  for (const role of roles) {
    assert.match(section.colors[role], /^#[0-9a-f]{6}$/, `${role} is not a lowercase hex`);
    const src = section.colorSources[role];
    assert.ok(src, `${role} has no colorSources line`);
    assert.match(src, /^\[(measured|estimated|sourced)/, `${role}'s provenance has no tier: ${src.slice(0, 40)}`);
  }
  /* The two shadow reads must declare themselves rather than pass as clean. */
  assert.match(section.colorSources.frameCharcoal, /SHADE|shade|shadow/,
    "the frame colour is a shadow read and must say so");
  assert.match(section.colorSources.bagBlack, /SHADE|shade|shadow/);
  /* And the module must not carry a hex of its own. */
  assert.equal(moduleSrc.match(/#[0-9a-fA-F]{6}\b/g), null,
    "the module carries a colour literal — colours are the section's");
});

test("every surveyed ring is a verbatim copy of the survey", () => {
  const A = section.measured.anchors;
  for (const key of ["basketball-court", "walkway-3238", "planting-bed-1760"]) {
    const src = eighth.ground[key];
    assert.ok(src, `campus-eighth.json has no ground.${key}`);
    assert.deepEqual(A[key].points, src.points, `${key} is not verbatim`);
    assert.equal(A[key].registration, src.registration);
  }
  /* Pulse's north face is the closing segment of the ArcGIS massing ring, /10. */
  const ring = arcgis.massing[463].r[0].map(([x, z]) => [x / 10, z / 10]);
  assert.equal(arcgis.massing[463].n, "TDLLN - Pulse Tower");
  assert.deepEqual(A["pulse-north-face"].points, [ring[ring.length - 2], ring[ring.length - 1]],
    "the north face is not the verbatim closing segment of massing[463] at /10");
});

test("the rig stands on surveyed paving and outside the surveyed building", () => {
  const walk = section.measured.anchors["walkway-3238"].points;
  const pulse = arcgis.massing[463].r[0].map(([x, z]) => [x / 10, z / 10]);
  for (const [x, z] of envelopeCorners()) {
    assert.ok(inRing(x, z, walk), `rig corner (${x}, ${z}) is off surveyed walkway-3238`);
    assert.ok(!inRing(x, z, pulse), `rig corner (${x}, ${z}) is INSIDE Pulse's massing ring`);
  }
  /* The far row's rear face is set ON the surveyed facade, which is the
     derivation the section states — so it must actually land there. */
  const [a, b] = section.measured.anchors["pulse-north-face"].points;
  const t = (R().centre[0] - a[0]) / (b[0] - a[0]);
  const zFace = a[1] + t * (b[1] - a[1]);
  /* The face splays 0.47 deg across the rig, so the binding point is the
     EASTERNMOST plate edge, not the centre — and the rearmost geometry is the
     footing plate, not the post. Both are the derivation's own argument. */
  const rearmost = Math.max(R().uprightSection, R().footingPlate[2]) / 2;
  const eastPlate = R().centre[0] + R().frameLength / 2 + R().footingPlate[2] / 2;
  const zFaceEast = a[1] + ((eastPlate - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
  near(Math.max(...R().rowZ) + rearmost, zFaceEast, 0.02,
    "the rig's rearmost geometry is not set on the surveyed north face");
  assert.ok(zFace > zFaceEast, "the face is expected to splay away toward the west");
  /* And the lead's named bed is genuinely clear, not merely unmentioned. */
  const bed = section.measured.anchors["planting-bed-1760"].points;
  for (const [x, z] of envelopeCorners()) assert.ok(!inRing(x, z, bed));
});

test("the clips are declared, motivated, and consistent with the placement", () => {
  assert.ok(section.clips.length >= 2);
  for (const c of section.clips) {
    assert.ok(c.key && c.why && c.why.length > 60, `clip ${c.key} is unmotivated`);
    for (const k of ["x0", "x1", "z0", "z1"]) assert.equal(typeof c[k], "number");
    assert.ok(c.x1 > c.x0 && c.z1 > c.z0);
  }
  const court = section.clips.find((c) => c.key === "court-play");
  const ring = eighth.ground["basketball-court"].points;
  near(court.x0, Math.min(...ring.map((p) => p[0])), 1e-9, "court clip x0");
  near(court.z1, Math.max(...ring.map((p) => p[1])), 1e-9, "court clip z1");
  /* Nothing this section places may fall in a clip. */
  for (const [x, z] of envelopeCorners()) {
    for (const c of section.clips) {
      assert.ok(!(x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1),
        `rig corner (${x}, ${z}) is inside clip ${c.key}`);
    }
  }
});

test("the seating datum is the rung Eighth's own paving actually ships on", () => {
  assert.equal(section.groundDatum.rung, "pad");
  near(section.groundDatum.lift, overlayLift(section.groundDatum.rung), 1e-9,
    "the section's recorded lift disagrees with campus-overlay.js");
  assert.match(moduleSrc, /overlayLift\(rung\)/,
    "the module must read the lift from campus-overlay.js, not from a number of its own");
});

test("every dimension is the arithmetic its own derivation states", () => {
  const r = R();
  const b = section.bags;
  near(r.frameLength, r.bays * r.bayPitch, 5e-3, "frameLength = bays x bayPitch");
  assert.equal(r.uprightsPerRow, r.bays + 1);
  near(r.overallLength, r.frameLength + 2 * r.bagArms[0].projection, 5e-3,
    "overallLength = frameLength + two cantilever arms");
  for (const arm of r.bagArms) near(arm.projection, r.bagArms[0].projection, 1e-9, "the two arms differ");
  /* Chord axes sit half a section inside the measured faces. */
  const top = r.chords.find((c) => c.key === "top");
  near(top.height + r.chordSection / 2, r.frameHeight, 1e-3,
    "the top chord's top edge is not the measured frame height");
  const second = r.chords.find((c) => c.key === "second");
  near(second.height - r.chordSection / 2, 2.52, 1e-3,
    "the second chord's underside is not the measured 2.52 m");
  /* Plan centre is the midpoint of the two rows, and the rows are one spacing apart. */
  near(r.centre[1], (r.rowZ[0] + r.rowZ[1]) / 2, 1e-6, "centre z is not the midpoint of the rows");
  near(Math.abs(r.rowZ[1] - r.rowZ[0]), r.rowSpacing, 1e-6, "rowZ does not honour rowSpacing");
  /* Bags hang where the section says they hang. */
  near(b.bottomHeight, b.topHeight - b.length, 5e-3, "bag bottom = top - length");
  near(b.hangerLength, r.bagArms[0].tipHeight - b.topHeight, 5e-3,
    "hangerLength must close the gap between the arm tip and the bag top");
  assert.equal(b.count, b.items.length);
  assert.equal(b.count, r.bagArms.length, "every arm carries exactly one bag");
  for (const it of b.items) assert.ok(r.bagArms.some((a) => a.key === it.arm), `bag ${it.key} names no arm`);
  /* The monkey bridge fits inside its own measured extent. */
  const MB = r.monkeyBridge;
  assert.ok((MB.rungCount - 1) * MB.rungPitch <= MB.bays * r.bayPitch + 1e-9,
    "the monkey rungs are wider than the bridge extent they are declared over");
  assert.ok(MB.rungPitch >= 0.3 && MB.rungPitch <= 0.38,
    "the estimated rung pitch must stay inside the band the derivation declares");
  /* Every bay a bar names must exist. */
  for (const bar of [...r.pullUpBars, ...r.lowerRails]) {
    assert.ok(bar.bay0 >= 0 && bar.bay0 + bar.bays <= r.bays, `${bar.key} runs off the frame`);
    assert.ok(bar.row >= 0 && bar.row < r.rows, `${bar.key} names row ${bar.row}`);
  }
  assert.ok(MB.bay0 + MB.bays <= r.bays);
  /* Nothing the frame carries may be above the frame. */
  for (const h of [...r.chords.map((c) => c.height), ...r.pullUpBars.map((p) => p.height),
    ...r.lowerRails.map((l) => l.height), b.topHeight]) {
    assert.ok(h <= r.frameHeight, `something sits at ${h} m on a ${r.frameHeight} m frame`);
  }
  /* The section must not carry a figure it never derived. */
  for (const k of ["overallLength", "bayPitch", "planDepth", "frameHeight", "bag", "position",
    "uprightSection", "chordSection", "gripBarSection", "monkeyBridge", "terraceRise"]) {
    assert.ok(section.derivations[k], `no derivation for ${k}`);
    assert.match(section.derivations[k], /^\[(measured|estimated|sourced|derived)/,
      `derivation ${k} carries no tier`);
  }
});

test("the camera model is recorded well enough to be re-run, and it was validated", () => {
  const c = section.camera;
  assert.equal(c.position.length, 2);
  for (const k of ["focalPx", "eyeHeight", "axisBearingDeg"]) assert.equal(typeof c[k], "number");
  assert.equal(c.principal.length, 2);
  assert.match(c.axisConvention, /atan/, "the convention must be stated as arithmetic, not prose");
  const d = c.derivation;
  assert.ok(Object.keys(d).filter((k) => k.startsWith("validation")).length >= 3,
    "a single-frame resection must be validated against something it was not fitted to");
  assert.match(JSON.stringify(d), /walkway-3238/,
    "the independent check that the resected footprint lands on surveyed paving must be recorded");
});

test("the absent list is honest, and the bag answer is recorded as YES", () => {
  assert.ok(section.absent.length >= 12, `absent shrank to ${section.absent.length}`);
  for (const a of section.absent) assert.ok(a.length > 80, `absent entry is a stub: ${a.slice(0, 50)}`);
  const joined = section.absent.join("\n");
  for (const must of [/PRODUCT IDENTITY/, /FOOTING/, /RUNG PITCH/, /WORLD-COORDINATE/, /ROOFTOP/]) {
    assert.match(joined, must, `absent no longer records ${must}`);
  }
  assert.match(joined, /IS \*NOT\* ABSENT/,
    "the outdoor bag question is settled YES and absent must keep saying so");
  assert.equal(section.bags.count, 2);
  assert.match(section.bags.note, /YES/);
});

test("the corrections name real predecessors and real evidence", () => {
  assert.ok(section.supersedes.length >= 3);
  const joined = section.supersedes.join("\n");
  assert.match(joined, /eighthcourtyards/);
  assert.match(joined, /eighthsiteworks/);
  assert.match(joined, /phf22/, "the phf22 mis-citation correction must be recorded");
  /* Neither predecessor may still be SHIPPING this object, and both must say on
     the record that they withdrew it and who owns it now — the absence of a key
     alone would pass vacuously if one of them merely renamed its own. */
  for (const name of ["eighthcourtyards", "eighthsiteworks"]) {
    const sib = photoDoc[name];
    assert.ok(sib, `${name} is missing from the shipped document`);
    const src = JSON.stringify(sib);
    const dup = /"(calisthenics|rig-1)"\s*:/.exec(src);
    assert.equal(dup, null,
      `${name} still ships ${dup && dup[1]} — this rig has one owner and it is pulsefitness`);
    assert.match(src, /campus-photo-pulsefitness\.js/,
      `${name} does not record that the rig moved to this module`);
  }
});

/* ------------------------------------------------------------- the module */

const build = async (ground) => {
  const { createPhotoPulseFitness } = await import("../docs/js/campus-photo-pulsefitness.js");
  const photo = photoDoc.pulsefitness ? photoDoc : { ...photoDoc, pulsefitness: section };
  return createPhotoPulseFitness(null, { photo, surfaceAt: ground });
};
const flat = () => 12.5;
const slope = (x, z) => 12.5 + 0.14 * (x + 154.3) + 0.09 * (z - 549.6);
const matrices = (r) =>
  r.group.children.map((m) => Array.from(m.instanceMatrix.array).map((v) => v.toFixed(6)).join(","));

test("the module builds every system, and the counts are the declared ones", async () => {
  const r = await build(flat);
  for (const [k, v] of Object.entries(section.counts)) {
    if (k === "note") continue;
    assert.equal(r.counts[k], v, `count ${k}`);
  }
  assert.equal(r.counts.uprights, R().rows * R().uprightsPerRow);
  assert.equal(r.counts.chords, R().rows * R().chords.length);
  assert.equal(r.counts.footings, r.counts.uprights);
  assert.equal(r.counts.hangers, section.bags.count * section.bags.hangerStraps);
  assert.ok(r.counts.draws >= 6 && r.counts.draws <= 12,
    `${r.counts.draws} draw calls — the kit is instanced, not one mesh per member`);
  near(r.counts.datumLift, overlayLift(section.groundDatum.rung), 1e-9, "datumLift");
});

test("a missing section is harmless, and a missing sampler is not silent", async () => {
  const { createPhotoPulseFitness } = await import("../docs/js/campus-photo-pulsefitness.js");
  const empty = createPhotoPulseFitness(null, { photo: {} });
  assert.equal(empty.group.children.length, 0);
  assert.deepEqual(empty.counts, {});
  const photo = { pulsefitness: section };
  assert.throws(() => createPhotoPulseFitness(null, { photo }), /surfaceAt/);
  assert.throws(
    () => createPhotoPulseFitness(null, {
      photo: { pulsefitness: { ...section, groundDatum: {} } }, surfaceAt: flat,
    }), /groundDatum/);
});

test("the group is added to a scene when there is one", async () => {
  const { createPhotoPulseFitness } = await import("../docs/js/campus-photo-pulsefitness.js");
  const added = [];
  const scene = { add: (g) => added.push(g) };
  const photo = { pulsefitness: section };
  const r = createPhotoPulseFitness(scene, { photo, surfaceAt: flat });
  assert.deepEqual(added, [r.group]);
});

/** Every instance's world-space vertical extent, per child mesh. */
function extents(result) {
  const out = [];
  for (const mesh of result.group.children) {
    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox;
    const a = mesh.instanceMatrix.array;
    for (let i = 0; i < mesh.count; i++) {
      const m = new (mesh.instanceMatrix.constructor === Float32Array ? Object : Object)();
      const M = a.slice(i * 16, i * 16 + 16);
      let lo = Infinity, hi = -Infinity, x = 0, z = 0;
      for (const cx of [bb.min.x, bb.max.x]) {
        for (const cy of [bb.min.y, bb.max.y]) {
          for (const cz of [bb.min.z, bb.max.z]) {
            const wy = M[1] * cx + M[5] * cy + M[9] * cz + M[13];
            lo = Math.min(lo, wy); hi = Math.max(hi, wy);
          }
        }
      }
      x = M[12]; z = M[14];
      out.push({ name: mesh.name, lo, hi, x, z, mesh });
      void m;
    }
  }
  return out;
}

test("nothing hovers and nothing sinks, on flat ground and on a slope", async () => {
  /* Flat, an exaggerated slope, and the REAL drawn LiDAR surface under the rig —
     the last one is the case that ships, and it is the height of the drawn
     triangle rather than the interpolated grid, which is the whole point. */
  for (const [label, ground] of [["flat", flat], ["slope", slope], ["drawn", drawnGround]]) {
    const r = await build(ground);
    const lift = overlayLift(section.groundDatum.rung);
    const seat = (x, z) => ground(x, z) + lift;
    const all = extents(r);
    const lowest = Math.min(...all.map((e) => e.lo));
    /* The frame is rigid: it stands on the HIGHEST post seat. */
    const posts = [];
    const frameEast = R().centre[0] + R().frameLength / 2;
    for (let row = 0; row < R().rows; row++)
      for (let k = 0; k < R().uprightsPerRow; k++)
        posts.push([frameEast - k * R().bayPitch, R().rowZ[row]]);
    const datum = Math.max(...posts.map(([x, z]) => seat(x, z)));
    near(r.counts.datum, datum, 1e-9, `${label}: datum is not the highest post seat`);
    /* The lowest geometry in the whole rig is a footing sitting on its own
       ground — not hanging over it, and not buried under it. */
    const minSeat = Math.min(...posts.map(([x, z]) => seat(x, z)));
    near(lowest, minSeat, 2e-3, `${label}: the rig's lowest point is not the lowest post's ground`);
    for (const [x, z] of posts) {
      const s = seat(x, z);
      const here = all.filter((e) => Math.abs(e.x - x) < 5e-3 && Math.abs(e.z - z) < 5e-3);
      assert.ok(here.some((e) => Math.abs(e.lo - s) < 2e-3),
        `${label}: post at (${x.toFixed(2)}, ${z.toFixed(2)}) has nothing reaching its ground`);
      assert.ok(here.every((e) => e.lo >= s - 2e-3),
        `${label}: something at (${x.toFixed(2)}, ${z.toFixed(2)}) is buried below the paving`);
    }
    /* And the frame's top is the measured height above the one datum. */
    const top = Math.max(...all.map((e) => e.hi));
    near(top, datum + R().frameHeight, 2e-3, `${label}: the frame top is not the measured height`);
  }
});

test("the bags hang free, and everything stays inside the declared envelope", async () => {
  const r = await build(flat);
  const datum = r.counts.datum;
  const b = section.bags;
  const bagMesh = r.group.children.find((m) => m.count === b.count && m.geometry.type === "CylinderGeometry"
    && m.geometry.parameters.radiusTop !== m.geometry.parameters.radiusBottom);
  assert.ok(bagMesh, "no bag mesh");
  const all = extents(r);
  const bags = all.filter((e) => e.mesh === bagMesh);
  for (const bag of bags) {
    near(bag.lo, datum + b.bottomHeight, 2e-3, "a bag's bottom is not at the measured hang height");
    assert.ok(bag.lo > datum + 0.5, "a bag reaches the ground");
  }
  /* Plan envelope: nothing outside overallLength x (rowSpacing + one post). */
  const r0 = R();
  const halfX = r0.overallLength / 2 + 1e-6;
  const zLo = Math.min(...r0.rowZ) - r0.uprightSection / 2 - 1e-6;
  const zHi = Math.max(...r0.rowZ) + r0.uprightSection / 2 + 1e-6;
  for (const e of all) {
    assert.ok(Math.abs(e.x - r0.centre[0]) <= halfX + b.diameter,
      `something sits ${(e.x - r0.centre[0]).toFixed(2)} m off centre`);
    assert.ok(e.z >= zLo - b.diameter && e.z <= zHi + b.diameter,
      `something sits at z ${e.z.toFixed(2)}, outside the two rows`);
  }
});

test("no built vertex crosses the surveyed facade the rig leans on", async () => {
  /* This is the gate the data alone cannot give: the footing plate is 0.22 m
     deep against a 0.10 m post, so setting the POST's face on the wall pushes
     0.06 m of plate through it. Checked on the geometry, per instance. */
  const r = await build(flat);
  const [a, b] = section.measured.anchors["pulse-north-face"].points;
  const zFaceAt = (x) => a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
  let worst = -Infinity;
  for (const mesh of r.group.children) {
    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox;
    const arr = mesh.instanceMatrix.array;
    for (let i = 0; i < mesh.count; i++) {
      const M = arr.slice(i * 16, i * 16 + 16);
      for (const cx of [bb.min.x, bb.max.x])
        for (const cy of [bb.min.y, bb.max.y])
          for (const cz of [bb.min.z, bb.max.z]) {
            const wx = M[0] * cx + M[4] * cy + M[8] * cz + M[12];
            const wz = M[2] * cx + M[6] * cy + M[10] * cz + M[14];
            worst = Math.max(worst, wz - zFaceAt(wx));
          }
    }
  }
  assert.ok(worst <= 1e-3, `the rig pushes ${worst.toFixed(3)} m through Pulse's north face`);
  assert.ok(worst > -0.02, `the rig stands ${(-worst).toFixed(3)} m off the face — the derivation says it touches`);
});

test("two builds are byte-identical", async () => {
  const a = await build(flat);
  const b = await build(flat);
  assert.deepEqual(matrices(a), matrices(b));
});

test("the module is a one-way reader, deterministic, and on the shared ladders", () => {
  assert.equal(moduleSrc.match(/Math\.random/), null, "the module uses Math.random");
  assert.equal(moduleSrc.match(/\bnew Date\b|Date\.now|performance\.now/), null, "the module reads a clock");
  assert.equal(moduleSrc.match(/heightAt\s*\(/), null,
    "the module calls heightAt directly — the ground here is surfaceAt plus the overlay rung");
  assert.match(moduleSrc, /from "\.\/campus-overlay\.js"/);
  assert.match(moduleSrc, /from "\.\/campus-materials\.js"/);
  assert.equal(moduleSrc.match(/section\.\w+\s*=/), null, "the module writes back into the section");
  assert.equal(moduleSrc.match(/new THREE\.TextureLoader|\.load\(/), null,
    "textures are code-generated here, never loaded from a photograph");
  /* It may read only its own key of the photo document. */
  const keys = [...moduleSrc.matchAll(/photo\?\.(\w+)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(keys)], ["pulsefitness"]);
});
