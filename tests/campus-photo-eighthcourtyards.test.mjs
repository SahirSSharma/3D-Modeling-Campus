/* Eighth College's courtyards and hardscape — the photo-sourced INVENTED class.
 *
 * The gates here are about the three claims this section makes that campus-
 * eighth.js could not:
 *
 *   - THE PAVING IS THE SURVEY. The shipped span table is re-derived from
 *     campus-arcgis.json ground[3632] minus its 213 holes minus every massing
 *     ring, entry for entry, and the clip is checked by ASSERTING THE ABSENCE
 *     of paving inside the holes and the buildings — not by asserting a clip
 *     field exists.
 *   - LEVEL CHANGE IS RE-DECIDED ON A LIVE EPOCH. The section must say the
 *     2014 LiDAR is blind here, and everything it builds must seat on the drawn
 *     surface or on a named carrier.
 *   - AN [estimated] POSITION IS A RULE. Every scattered object must land on a
 *     measured paved span, so nothing stands in a surveyed bed, on a lawn or
 *     inside a building footprint.
 *
 * Plus the class gates every photo section carries: colours are data with
 * per-role provenance, sources are dated, the absent list does not shrink, and
 * two builds are byte-identical.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as THREE from "../docs/vendor/three/three.module.min.js";
import { createPhotoEighthCourtyards } from "../docs/js/campus-photo-eighthcourtyards.js";
import { OVERLAY } from "../docs/js/campus-overlay.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(p, "utf8"));

/* PHOTO_DETAIL lets a repair agent run this file against a candidate section
   before it lands in the shipped document. */
const shipped = read(process.env.PHOTO_DETAIL || join(root, "docs/data/campus-photo-detail.json"));

const section = shipped.eighthcourtyards;

const arcgis = read(join(root, "docs/data/campus-arcgis.json"));
const eighth = read(join(root, "docs/data/campus-eighth.json"));

const toM = (ring) => ring.map((p) => [p[0] / 10, p[1] / 10]);
const bbOf = (r) => ({
  x0: Math.min(...r.map((p) => p[0])), x1: Math.max(...r.map((p) => p[0])),
  z0: Math.min(...r.map((p) => p[1])), z1: Math.max(...r.map((p) => p[1])),
});
const inRing = (x, z, r) => {
  let ins = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, zi] = r[i];
    const [xj, zj] = r[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
};

/* ------------------------------------------------- the section, as a claim */

test("the section exists and is reachable", () => {
  assert.ok(section, "no eighthcourtyards section in the merged doc or the build-side file");
});

test("it says what it is, who built it, and which epoch decides", () => {
  assert.match(section.label, /Eighth College/);
  assert.match(section.label, /Theatre District/i);
  assert.match(section.label, /HKS/, "HKS is the design architect");
  assert.match(section.label, /SWA/, "SWA Group is the landscape architect");
  assert.match(section.label, /NOT Safdie Rabines/i,
    "Safdie Rabines + OJB designed North Torrey Pines LLN / Sixth College, not this");
  assert.match(section.note, /INVENTED/, "the note must declare the class");
  assert.match(section.epoch, /2014 LiDAR IS BLIND/i,
    "the epoch stamp must record that the 2014 LiDAR cannot see a 2023 college");
  assert.match(section.epoch, /VOID/i, "and that the smooth-LiDAR argument is void here");
  assert.match(section.epoch, /MID-CONSTRUCTION/i, "Google over Eighth is mid-construction");
  assert.ok(Number.isInteger(section.seed), "the seed must be pinned");
});

test("every source carries a date, a url and a rung", () => {
  assert.ok(Array.isArray(section.sources) && section.sources.length >= 8,
    `only ${section.sources?.length} sources`);
  for (const s of section.sources) {
    assert.match(s.url, /^(https:\/\/|repo:\/\/)/, `bad url ${s.url}`);
    assert.match(String(s.date), /\d{4}/, `source ${s.id} has no date`);
    assert.match(String(s.rung), /^[1-4] - /, `source ${s.id} has no rung`);
    assert.ok(s.what && s.what.length > 40, `source ${s.id} does not say what it is`);
  }
  assert.ok(section.sources.some((s) => /swagroup\.com/.test(s.url)), "the landscape authority must be cited");
  assert.ok(section.sources.some((s) => /eyrc\.com/.test(s.url)), "the built-photography set must be cited");
  assert.ok(section.sources.some((s) => /sdarchitecture\.org/.test(s.url)), "the 2025 built-condition plan must be cited");
});

test("every colour role has its own provenance, and the falsified hexes are gone", () => {
  const roles = Object.entries(section.colors);
  /* BASELINE LOWERED 35 -> 23 IN ARBITRATION, and only because 21 objects left
     this section for siblings and their colour roles went with them. LOWERED
     AGAIN 23 -> 21 IN THE 2026-08-19 REPAIR, for exactly the same reason and no
     other: `safetyOrange` went with the calisthenics rig to
     campus-photo-pulsefitness.js and `fdcRed` went with the grill station's
     bollards to eighthgathering. Both hexes survive in the merged document —
     eighthsiteworks and eighthramble each adopted THIS section's value in the
     arbitration — so nothing is lost; they are simply no longer this section's
     to carry. A colour role for an object a section does not build is a colour
     for nothing, which the used-check below is what enforces. Two hexes for one
     surface inside one merged document is a worse defect than a short table.
     Every remaining role must still be USED by the module or be a named record
     in `supersedes` — the three court colours are the second case. */
  assert.ok(roles.length >= 21, `only ${roles.length} colours for a whole landscape`);
  const src0 = readFileSync(join(root, "docs/js/campus-photo-eighthcourtyards.js"), "utf8");
  const data0 = JSON.stringify({ ...section, colors: undefined, colorSources: undefined });
  const targets0 = section.supersedes.map((s) => `${s.target} ${s.replacement}`).join(" ");
  for (const role of Object.keys(section.colors)) {
    const used = data0.includes(`"${role}"`) || src0.includes(`C.${role}`)
      || src0.includes(`colors.${role}`) || targets0.includes(role);
    assert.ok(used, `${role} is a colour for something this section no longer builds or records`);
  }
  for (const [k, v] of roles) {
    assert.match(v, /^#[0-9a-f]{6}$/, `${k} is not a lowercase 6-digit hex`);
    const src = section.colorSources[k];
    assert.ok(src, `${k} has no colorSources entry`);
    assert.match(src, /^\[(measured|sourced|estimated)\]/, `${k}'s provenance carries no tier`);
    if (src.startsWith("[estimated]")) {
      assert.match(src, /extends|carried/i,
        `${k} is estimated but names no sourced pattern it extends`);
    }
  }
  for (const k of Object.keys(section.colorSources)) {
    assert.ok(section.colors[k], `colorSources has ${k} with no colour`);
  }
  /* The two the built photography falsifies. */
  /* ARBITRATED 2026-08-19: the lanes and the centre trident are NOT one gold.
     The first draft's #d6a826 was a sample taken inside the trident and then
     applied to both — its stated rectangle (430,800)-(470,815) is in the centre
     mark, not a key. Both are now measured by ratio to the court's own white
     linework, which cancels the illuminant. */
  assert.equal(section.colors.courtGold, "#cf9443", "the lanes are UCSD gold, measured sunlit");
  assert.equal(section.colors.courtTrident, "#e1c44b", "the centre mark is a yellower gold than the lanes");
  assert.notEqual(section.colors.courtGold, section.colors.courtTrident,
    "one hex for two surfaces is what put a trident sample on the lanes");
  for (const [k, v] of roles) {
    assert.notEqual(v, "#2f372f", `${k} is the shadowed Apple olive the sunlit frame falsifies`);
    assert.notEqual(v, "#576564", `${k} is the shadowed Apple sage the sunlit frame falsifies`);
    /* THE THIRD FALSIFIED HEX, added in the 2026-08-19 repair. The arbitration
       re-measured the shipped planterWhite #e4e2dc on its OWN cited object —
       EYRC phf22's pale precast box, sunlit face, a 5 x 5 sample grid — at
       #a49f8b, and called #e4e2dc "far too light by a long way" (in the same
       frame the buildings' white precast reads ~#d8dae0 in sun). eighthramble
       was moved; this section was not, while asserting in its own colorSources
       that its W3 raised planters are THE SAME PRECAST. That is two hexes for
       one declared-identical material inside one merged document, which is the
       exact defect this table exists to prevent. */
    assert.notEqual(v, "#e4e2dc",
      `${k} is the shipped planterWhite the arbitration re-measured at #a49f8b`);
  }
  assert.equal(section.colors.precastPale, "#a49f8b",
    "the W3 precast must be the arbitration's re-measured sunlit median, not the falsified shipped hex");
  assert.match(section.colorSources.precastPale, /a49f8b/,
    "and its provenance must be the re-measurement, not the retired carry-over");
});

test("it says what it does NOT build, and what it replaces", () => {
  /* RE-BASELINED 18 -> 37 IN THE 2026-08-19 REPAIR. The gate had been left at
     18 while the list grew to 33, which is fifteen entries of slack: half the
     declared withholdings could have been deleted in silence. A non-shrinking
     gate that trails the data by fifteen is not a non-shrinking gate. It is
     pinned to the real length here and must be re-pinned, upward, on every
     future edit — the colour gate's own baseline is the model. */
  assert.ok(Array.isArray(section.absent) && section.absent.length >= 37,
    `absent has ${section.absent?.length} entries — better absent than wrong, and this list does not shrink`);
  for (const a of section.absent) assert.ok(typeof a === "string" && a.length > 60, `thin absent entry: ${a}`);
  const joined = section.absent.join(" | ");
  for (const must of [/ramp/i, /bridge/i, /Front Porch/i, /mural artwork/i, /CEQA/i, /manufacturer/i, /species/i]) {
    assert.match(joined, must, `the absent list must still declare ${must}`);
  }
  /* THE FOUR WITHDRAWALS OF THE 2026-08-19 REPAIR. Each must name the section
     that owns the object now — "we do not build it" without "they do" is how an
     object comes to be built twice, or not at all.

     MATCHER CORRECTED: this used to `find` the FIRST entry mentioning the
     subject and demand the owner of that one. Subjects are mentioned in passing
     all over this list — absent[26] explains where the `safetyOrange` COLOUR
     ROLE went and says the word "calisthenics" while doing it — so the gate
     tested a colour-role note for a geometry owner and failed on correct data.
     A withdrawal is now identified by all three marks at once: the subject, the
     word that makes it a withdrawal, and the owner. That is strictly more than
     the old gate asked, and it cannot be satisfied by a passing mention. */
  for (const [what, owner] of [
    [/calisthenics/i, /pulsefitness|pulseFitness/],
    [/grill/i, /eighthgathering\.bbq\.grill/],
    [/carrying wall|public-art/i, /eighthgathering\.bbq\.mural|eighthgathering/],
    [/S6|Tea House plinth/i, /eighthgathering\.teaHouse\.plinth/],
  ]) {
    const mentions = section.absent.filter((a) => what.test(a));
    assert.ok(mentions.length, `the absent list must declare the withdrawal matching ${what}`);
    const entry = mentions.find((a) => /WITHDRAWN|RETIRED/.test(a) && owner.test(a));
    assert.ok(entry,
      `${what} is mentioned in ${mentions.length} absent entries but none of them both ` +
      `declares it WITHDRAWN/RETIRED and names its owner ${owner}`);
  }
  /* BASELINE LOWERED 10 -> 9 IN ARBITRATION, and only because this section
     stopped building four of the things it claimed to replace: the court
     hardware, the Tea House, the Meditation Pavilion area and the emergency
     towers all went to siblings. THAT LOWERING WAS ALSO WRONG IN A SECOND WAY:
     the array still held 10, so the gate was set one BELOW the truth instead of
     re-pinned to it, which is the same fifteen-entry slack in miniature.
     LOWERED AGAIN 10 -> 8 IN THE 2026-08-19 REPAIR, and pinned to the real
     length: the grill station and the public-art mural both went to
     eighthgathering, so this section may no longer claim to replace the shipped
     `eighth.areas.bbq` anchor or the shipped "public-art mural ... no source"
     entry. A section may not claim to replace shipped work it no longer builds.
     Both retirements are declared in `absent`, which is why that list grew by
     four in the same edit. */
  assert.ok(Array.isArray(section.supersedes) && section.supersedes.length >= 8,
    `only ${section.supersedes?.length} supersedes entries`);
  /* Pinned to the real length, not below it. Adding is always safe; retiring
     one requires re-pinning this number in the same edit and saying why. */
  for (const s of section.supersedes) {
    assert.ok(s.target && s.replacement && s.why && s.why.length > 40,
      `supersedes entry ${s.target} does not say why`);
  }
  const targets = section.supersedes.map((s) => s.target).join(" | ");
  assert.match(targets, /courtKey/, "the olive court key must be superseded");
  assert.match(targets, /courtLogo/, "the sage trident must be superseded");
  /* The Tea House left this section entirely (eighthgathering owns it and
     supersedes the shipped item), so this section no longer claims it. What it
     does still supersede is the shipped turf panel its Sun Lawn replaces. */
  assert.doesNotMatch(targets, /teaHouse/, "the Tea House is eighthgathering's and must not be claimed twice");
  assert.match(targets, /turf-2369/, "the shipped 148 m2 turf trace must be superseded by the surveyed ring");
  assert.match(targets, /bounds/, "the truncated eighth.bounds must be superseded");
  assert.match(targets, /plate mosaic/i, "the invented plate mosaic must be superseded");
});

test("the corrected bounds actually contain the southern third of the college", () => {
  const b = section.bounds;
  const plaza = bbOf(toM(arcgis.ground[3045].r[0]));
  assert.ok(b.z1 >= plaza.z1, `bounds end at z ${b.z1}, Market Hall Plaza runs to z ${plaza.z1}`);
  assert.ok(b.x1 >= plaza.x1, `bounds end at x ${b.x1}, Market Hall Plaza runs to x ${plaza.x1}`);
  const old = shipped.eighth?.bounds;
  if (old) {
    assert.ok(b.z1 > old.z1 && b.x1 > old.x1,
      "the corrected bounds must be strictly larger than the shipped eighth bounds");
  }
});

/* -------------------------------------------------- the survey, verbatim */

test("every surveyed ring is its source ring, byte for byte", () => {
  const R = section.measured.rings;
  const fromArcgis = {
    sunLawn: 2369, wellnessLawn: 1160, teaHouseIsland: 365,
    courtHedgeNorth: 1761, courtHedgeEast: 2144, pavilionSlabWest: 2374,
  };
  for (const [key, idx] of Object.entries(fromArcgis)) {
    assert.equal(R[key].registration, `arcgis.ground#${idx}`);
    assert.deepEqual(R[key].points, toM(arcgis.ground[idx].r[0]),
      `${key} drifted from arcgis.ground#${idx}`);
  }
  assert.deepEqual(R.bambooGarden.points, toM(arcgis.ground[3632].r[193]),
    "the Bamboo Garden island must be arcgis.ground[3632] hole ring 193, verbatim");
  for (const bed of R.rambleBeds) {
    const src = eighth.ground[bed.key];
    assert.ok(src, `${bed.key} is not a campus-eighth.json ground feature`);
    assert.equal(bed.registration, src.registration);
    assert.deepEqual(bed.points, src.points, `${bed.key} drifted from campus-eighth.json`);
  }
  assert.deepEqual(section.measured.court.points, eighth.ground["basketball-court"].points,
    "the court ring must be campus-eighth.json's, verbatim");
});

/* Every surveyed ring this section DRAWS ON, which must therefore be cut out of
   the paving: two decals on the same rung in the same cell fight for the pixel.
   ground[3632]'s own holes do not punch all of these out. */
function carriedRings() {
  const R = section.measured.rings;
  const out = [];
  for (const k of section.measured.paving.subtractedRings.keys) out.push(R[k].points);
  for (const b of R.rambleBeds) out.push(b.points);
  return out;
}

/* The whole scanline, re-derived. This is the gate that makes "the paving is
   the survey" a checkable statement rather than a claim.
 *
 * `clip` runs the two subtractions added 2026-08-19 — the college clip and the
 * carried rings. Called BOTH ways, so the test proves what each one removes
 * rather than only proving the end state: the unclipped run must still be the
 * 9,785 m2 the survey layer gives inside the bounds, and the difference is the
 * declared overreach. */
function derivePaving(clip = true) {
  const B = section.bounds;
  const P = section.measured.paving;
  const CL = P.collegeClip;
  const rings = arcgis.ground[3632].r.map(toM);
  const outer = rings[0];
  const holes = rings.slice(1);
  const carried = clip ? carriedRings().map((r) => ({ ring: r, bb: bbOf(r) })) : [];
  const mass = [];
  for (const i of P.subtractedMassing.rings) {
    for (const rr of arcgis.massing[i].r) {
      const ring = toM(rr);
      const bb = bbOf(ring);
      if (bb.x1 < B.x0 || bb.x0 > B.x1 || bb.z1 < B.z0 || bb.z0 > B.z1) continue;
      mass.push({ ring, bb });
    }
  }
  const cross = (ring, z) => {
    const xs = [];
    for (let i = 0; i < ring.length; i++) {
      const [ax, az] = ring[i];
      const [bx, bz] = ring[(i + 1) % ring.length];
      if ((az <= z) === (bz <= z)) continue;
      xs.push(ax + ((bx - ax) * (z - az)) / (bz - az));
    }
    xs.sort((p, q) => p - q);
    const out = [];
    for (let i = 0; i + 1 < xs.length; i += 2) out.push([xs[i], xs[i + 1]]);
    return out;
  };
  const subtract = (spans, cuts) => {
    let cur = spans;
    for (const [c0, c1] of cuts) {
      const nx = [];
      for (const [s0, s1] of cur) {
        if (c1 <= s0 || c0 >= s1) { nx.push([s0, s1]); continue; }
        if (c0 > s0) nx.push([s0, Math.min(c0, s1)]);
        if (c1 < s1) nx.push([Math.max(c1, s0), s1]);
      }
      cur = nx;
    }
    return cur;
  };
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const out = [];
  for (let z = B.z0 + P.rowPitch / 2; z < B.z1; z += P.rowPitch) {
    if (clip && z < CL.z0) continue;
    const xhi = clip ? Math.min(B.x1, CL.x1) : B.x1;
    let row = cross(outer, z)
      .map(([a, b]) => [Math.max(a, B.x0), Math.min(b, xhi)])
      .filter((s) => s[1] - s[0] > 0.05);
    if (!row.length) continue;
    /* Both row EDGES as well as the centre, unioned — the conservative
       quantisation the section declares. */
    const cuts = [];
    const probes = [z - P.rowPitch / 2 + 1e-6, z, z + P.rowPitch / 2 - 1e-6];
    for (const h of holes) for (const pz of probes) for (const c of cross(h, pz)) cuts.push(c);
    for (const m of mass) {
      if (z + P.rowPitch < m.bb.z0 || z - P.rowPitch > m.bb.z1) continue;
      for (const pz of probes) for (const c of cross(m.ring, pz)) {
        cuts.push([c[0] - P.subtractedMassing.clearance, c[1] + P.subtractedMassing.clearance]);
      }
    }
    for (const m of carried) {
      if (z + P.rowPitch < m.bb.z0 || z - P.rowPitch > m.bb.z1) continue;
      for (const pz of probes) for (const c of cross(m.ring, pz)) cuts.push(c);
    }
    row = subtract(row, cuts).filter((s) => s[1] - s[0] >= P.minSpan);
    for (const [a, b] of row) out.push([r3(z), r3(a), r3(b)]);
  }
  return out;
}

test("the paved extent IS arcgis.ground[3632], re-derived span for span", () => {
  const P = section.measured.paving;
  assert.equal(P.feature, "arcgis.ground[3632]");
  assert.equal(P.kind, arcgis.ground[3632].k, "the survey feature must be the walk layer");
  assert.equal(P.outerVertices, arcgis.ground[3632].r[0].length);
  assert.equal(P.holeRings, arcgis.ground[3632].r.length - 1);
  const derived = derivePaving();
  assert.equal(P.spans.length, derived.length, "the span count drifted from the survey");
  assert.deepEqual(P.spans, derived, "the shipped span table is not the survey's scanline");
  assert.equal(P.strips, P.spans.length);
  const areaOf = (sp) => sp.reduce((s, [, a, b]) => s + (b - a) * P.rowPitch, 0);
  const area = areaOf(P.spans);
  assert.ok(Math.abs(area - P.areaM2) < 1, `declared ${P.areaM2} m2, spans give ${area.toFixed(1)}`);

  /* BOTH SIDES OF THE 2026-08-19 CLIP, so the correction is auditable rather
     than just smaller. The bare survey layer inside the bounds must still be
     the 9,785 m2 it always was — that is the number the OLD gate ("a 10-acre
     college's paving cannot be under 9,000 m2") was really about, and it is
     kept, unweakened, on the quantity it actually describes. What Eighth
     PAINTS is the clipped figure, and the difference is the declared
     overreach: ground[3632] is the campus-wide walk layer, and 1,929 m2 of it
     inside these bounds is Keeling, Galbraith and Revelle approach. */
  const unclipped = derivePaving(false);
  const surveyArea = areaOf(unclipped);
  assert.ok(surveyArea > 9000, "a 10-acre college's walk layer cannot be under 9,000 m2");
  assert.ok(Math.abs(surveyArea - P.surveyAreaM2) < 1,
    `declared survey area ${P.surveyAreaM2}, re-derived ${surveyArea.toFixed(1)}`);
  assert.ok(Math.abs((surveyArea - area) - P.collegeClip.removedM2) < 5,
    `the clip declares ${P.collegeClip.removedM2} m2 removed, the derivation removes ${(surveyArea - area).toFixed(1)}`);
  assert.ok(area > 7500, `Eighth's own paved field fell to ${area.toFixed(0)} m2 — the clip is eating the college`);

  /* And the clip's two edges are SURVEY VERTICES, not typed numbers. */
  const zNorth = Math.min(...arcgis.massing[252].r[0].map((p) => p[1] / 10));
  const xEast = Math.max(...arcgis.massing[253].r[0].map((p) => p[0] / 10));
  assert.equal(P.collegeClip.z0, zNorth,
    "the north clip must BE the north face of massing[252], the northernmost TDLLN mass");
  assert.equal(P.collegeClip.x1, xEast,
    "the east clip must BE the east face of massing[253], the easternmost TDLLN mass");
  for (const [z, x0, x1] of P.spans) {
    assert.ok(z >= P.collegeClip.z0, `a span at z ${z} is north of the college`);
    assert.ok(x1 <= P.collegeClip.x1 + 1e-9, `a span reaching x ${x1} is east of the college`);
  }
});

test("no paving is drawn inside a surveyed ring this section itself paints", () => {
  /* Round one cut the spans by ground[3632]'s 213 holes and by the massing, but
     NOT by the ten campus-eighth.json bed rings and six named survey rings the
     section carries and draws mulch, gravel and turf on. Those decals and the
     paving share the `carpet` rung, so an overlap is two coplanar decals
     fighting for the same pixel. This asserts the absence, exactly as the hole
     gate above does — it does not check that a clip FIELD exists. */
  const P = section.measured.paving;
  const rings = carriedRings();
  assert.ok(rings.length >= 16, `only ${rings.length} carried rings subtracted`);
  let checked = 0;
  for (const ring of rings) {
    const bb = bbOf(ring);
    for (const [z, x0, x1] of P.spans) {
      if (z < bb.z0 || z > bb.z1) continue;
      for (let x = Math.max(x0, bb.x0) + 0.1; x < Math.min(x1, bb.x1); x += 0.25) {
        checked++;
        assert.ok(!inRing(x, z, ring),
          `paving is drawn inside a carried survey ring at (${x.toFixed(1)}, ${z})`);
      }
    }
  }
  assert.ok(checked > 200, `only ${checked} samples fell near a carried ring`);
  /* The one ring deliberately NOT subtracted, and the reason, must be stated. */
  assert.match(P.subtractedRings.excluded, /pavilionSlabWest/);
  assert.match(P.subtractedRings.excluded, /PAVED/);
});

test("the clip is real: no paving inside a survey hole, a lawn, the court, or a building", () => {
  const P = section.measured.paving;
  const holes = arcgis.ground[3632].r.slice(1).map(toM);
  const holeBB = holes.map(bbOf);
  const mass = [];
  for (const i of P.subtractedMassing.rings) {
    for (const rr of arcgis.massing[i].r) {
      const ring = toM(rr);
      mass.push({ i, n: arcgis.massing[i].n, ring, bb: bbOf(ring) });
    }
  }
  let checked = 0;
  for (const [z, x0, x1] of P.spans) {
    for (let x = x0 + 0.25; x < x1; x += 1.0) {
      checked++;
      for (let h = 0; h < holes.length; h++) {
        const bb = holeBB[h];
        if (x < bb.x0 || x > bb.x1 || z < bb.z0 || z > bb.z1) continue;
        assert.ok(!inRing(x, z, holes[h]),
          `paving at (${x.toFixed(1)}, ${z}) is inside survey hole ring ${h + 1} — the clip is not respected`);
      }
      for (const m of mass) {
        if (x < m.bb.x0 || x > m.bb.x1 || z < m.bb.z0 || z > m.bb.z1) continue;
        assert.ok(!inRing(x, z, m.ring),
          `paving at (${x.toFixed(1)}, ${z}) runs under ${m.n} (massing[${m.i}])`);
      }
    }
  }
  assert.ok(checked > 8000, `only ${checked} paving samples checked`);
  /* And the named surfaces specifically: the Sun Lawn and the court are HOLES,
     so not one span may fall in either. */
  for (const key of ["sunLawn", "wellnessLawn", "bambooGarden"]) {
    const ring = section.measured.rings[key].points;
    const bb = bbOf(ring);
    for (const [z, x0, x1] of P.spans) {
      if (z < bb.z0 || z > bb.z1) continue;
      for (let x = Math.max(x0, bb.x0) + 0.25; x < Math.min(x1, bb.x1); x += 1.0) {
        assert.ok(!inRing(x, z, ring), `paving runs across ${key} at (${x.toFixed(1)}, ${z})`);
      }
    }
  }
  /* The court specifically. `measured.court.rect` is a BOUNDING rectangle of
     two survey polygons, so the polygons themselves are what must be clear. */
  for (const idx of [3898, 3923]) {
    const ring = toM(arcgis.ground[idx].r[0]);
    const bb = bbOf(ring);
    for (const [z, x0, x1] of P.spans) {
      if (z < bb.z0 || z > bb.z1) continue;
      for (let x = Math.max(x0, bb.x0) + 0.2; x < Math.min(x1, bb.x1); x += 0.5) {
        assert.ok(!inRing(x, z, ring),
          `paving crosses surveyed court polygon #${idx} at (${x.toFixed(1)}, ${z})`);
      }
    }
  }
});

test("nothing in the section's own anchor block escapes the corrected bounds", () => {
  const B = section.bounds;
  const inside = (x, z, what) => {
    assert.ok(x >= B.x0 && x <= B.x1 && z >= B.z0 && z <= B.z1,
      `${what} at (${x}, ${z}) is outside the declared bounds`);
  };
  for (const [z, x0, x1] of section.measured.paving.spans) {
    inside(x0, z, "a paving span start");
    inside(x1, z, "a paving span end");
  }
  /* The two anchored boxes this used to check — the Meditation Pavilion and
     the Tea House — went to eighthgathering in arbitration. What is left with
     a declared rectangle is the Bamboo Garden's clip against the pavilion's
     bark field, which is carried here verbatim from gathering. */
  const clip = section.bambooGarden.pavilionClip.rect;
  inside(clip.x0, clip.z0, "the pavilion clip");
  inside(clip.x1, clip.z1, "the pavilion clip");
});

/* ------------------------------------------- the level-change re-decision */

test("level change is re-decided on a live epoch, and what is not anchored is absent", () => {
  const L = section.levelChange;
  assert.match(L.epochNote, /2014 LiDAR/, "the withholding it retires must be named");
  assert.match(L.epochNote, /parking lot/i, "and why that argument is void");
  assert.equal(L.retaining.runs.length, 1, "only the survey-anchored wall run is built");
  const run = L.retaining.runs[0];
  const hedge = bbOf(section.measured.rings.courtHedgeNorth.points);
  assert.ok(Math.abs(run.a[0] - hedge.x0) < 0.2 && Math.abs(run.b[0] - hedge.x1) < 0.2,
    "the court wall must run the length of surveyed hedge strip #1761");
  assert.ok(Math.abs(run.a[1] - hedge.z0) < 0.2, "and sit on its north edge");
  assert.ok(run.height >= 1.2 && run.height <= 1.5, "the wall is the measured 1.2-1.5 m");
  assert.ok(run.height >= L.retaining.guardAbove, "a 1.35 m drop takes the guard");
  /* Code is a BOUND, never a measurement. */
  const S1 = L.stairs.find((s) => s.id === "S1");
  assert.equal(S1.risers, 15, "15 risers were counted in phf03");
  assert.ok(S1.riser <= 0.178, "riser must stay inside the CBC 1011.5 bound");
  assert.ok(S1.tread >= 0.279, "tread must stay inside the CBC 1011.5 bound");
  assert.match(S1.source, /\[estimated\]/, "riser/tread are code-bounded, not measured");
  assert.match(S1.source, /CBC 1011/, "and must name the bound");
  assert.ok(L.guard.height >= 1.05 && L.guard.height <= 1.1, "guard height is the measured 1.06 m");
  assert.ok(L.guard.picketPitch - L.guard.picketDia < 0.102,
    "the clear picket opening must pass the 4 in sphere rule");
  assert.ok(L.handrail.height >= 0.864 && L.handrail.height <= 0.965,
    "handrail height must stay inside CBC 11B-505.4");
  const joined = section.absent.join(" | ");
  for (const gone of ["S2", "S3", "S4"]) {
    assert.ok(joined.includes(gone), `stair ${gone} is unanchored and must be declared absent`);
  }
});

test("the anchored garden objects are inside the surveys they claim", () => {
  const island = section.measured.rings.bambooGarden.points;
  const t = section.levelChange.seatTerraces.find((s) => s.id === "bamboo-led");
  const d = t.tread * t.tiers;
  /* Sampled on a real grid in BOTH axes. The old loop walked the run's two long
     edges and its centre line only, which is enough to catch a terrace hanging
     off the island and nothing else. */
  for (let i = 0; i <= 36; i++) {
    const x = t.centre[0] - t.length / 2 + (t.length * i) / 36;
    for (let j = 0; j <= 6; j++) {
      const z = t.centre[1] - d / 2 + (d * j) / 6;
      assert.ok(inRing(x, z, island),
        `the Bamboo Garden seat terrace runs outside the surveyed island at (${x.toFixed(1)}, ${z.toFixed(1)})`);
    }
  }
  /* AND IT IS RE-SOLVED, not read. The station is the answer to a rule the
     section states, so the rule is re-run here from the survey and the clip:
     the accepted station nearest the pavilion's north edge, on the 0.05 m grid
     the section declares. Round two's [-175.0, 585.0] optimised for the island
     alone and put 12.9 m of this run inside eighthgathering's 0.45 m pavilion
     deck; nothing caught it because no gate asked where the pavilion was. */
  const PC = section.bambooGarden.pavilionClip;
  /* The predicate is a conjunction over the 181 x 16 sample grid, so it can be
     decomposed by ROW and memoised without changing a single accept/reject: one
     row of 181 samples at a given (z, x0) has the same answer wherever it is
     reached from. Written as the naive quadruple loop this search is 385k
     stations x 2,896 point-in-polygon tests over a 52-vertex ring — 210 million
     ring traversals, 6.6 minutes, which is a gate nobody will run. Memoised on
     the row and backed by the ring's x-crossings at that z (also memoised) it is
     the same answer in under a second. Nothing is sampled more coarsely and no
     station is skipped. */
  const KZ = (z) => Math.round(z * 100);
  const spansAt = new Map();
  const crossings = (z) => {
    const k = KZ(z);
    let v = spansAt.get(k);
    if (v) return v;
    const xs = [];
    for (let i = 0; i < island.length; i++) {
      const [ax, az] = island[i];
      const [bx, bz] = island[(i + 1) % island.length];
      if ((az > z) === (bz > z)) continue;
      xs.push(ax + ((bx - ax) * (z - az)) / (bz - az));
    }
    xs.sort((p, q) => p - q);
    v = [];
    for (let i = 0; i + 1 < xs.length; i += 2) v.push([xs[i], xs[i + 1]]);
    spansAt.set(k, v);
    return v;
  };
  /* Exactly the `inRing` above, evaluated off the same crossings. `inRing`
     toggles on every edge whose intersection lies strictly RIGHT of x, so a
     point is inside iff an odd number of crossings exceed it — which, for the
     sorted list, is the half-open interval [xs[0], xs[1]) u [xs[2], xs[3]) ...
     The half-openness is carried over rather than tidied, so the two predicates
     agree on a sample that lands exactly on the boundary. */
  const inAt = (x, z) => {
    for (const [a, b] of crossings(z)) if (x >= a && x < b) return true;
    return false;
  };
  const rowMemo = new Map();
  const rowOk = (x0, z) => {
    const k = `${KZ(z)}|${Math.round(x0 * 100)}`;
    let v = rowMemo.get(k);
    if (v !== undefined) return v;
    v = true;
    for (let i = 0; i <= 180; i++) {
      if (!inAt(x0 + (t.length * i) / 180, z)) { v = false; break; }
    }
    rowMemo.set(k, v);
    return v;
  };
  const fits = (cx, cz) => {
    const x0 = cx - t.length / 2, x1 = cx + t.length / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    if (!(x1 <= PC.rect.x0 - PC.clearance || x0 >= PC.rect.x1 + PC.clearance
      || z1 <= PC.rect.z0 - PC.clearance || z0 >= PC.rect.z1 + PC.clearance)) return false;
    for (let j = 0; j <= 15; j++) {
      if (!rowOk(x0, z0 + (d * j) / 15)) return false;
    }
    return true;
  };
  /* The decomposition is not taken on trust: on the shipped station and on a
     handful of stations around it, the memoised predicate is checked against the
     naive point-by-point one it replaces. */
  const naive = (cx, cz) => {
    const x0 = cx - t.length / 2, x1 = cx + t.length / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    if (!(x1 <= PC.rect.x0 - PC.clearance || x0 >= PC.rect.x1 + PC.clearance
      || z1 <= PC.rect.z0 - PC.clearance || z0 >= PC.rect.z1 + PC.clearance)) return false;
    for (let i = 0; i <= 180; i++) {
      for (let j = 0; j <= 15; j++) {
        if (!inRing(x0 + (t.length * i) / 180, z0 + (d * j) / 15, island)) return false;
      }
    }
    return true;
  };
  for (let a = -8; a <= 8; a++) {
    for (let b = -8; b <= 8; b++) {
      const cx = Math.round((t.centre[0] + a * 0.05) * 100) / 100;
      const cz = Math.round((t.centre[1] + b * 0.05) * 100) / 100;
      assert.equal(fits(cx, cz), naive(cx, cz),
        `the memoised placement predicate disagrees with the point-by-point one at [${cx}, ${cz}]`);
    }
  }
  assert.ok(fits(t.centre[0], t.centre[1]),
    `the shipped seat-terrace station [${t.centre}] does not satisfy the rule the section states for it`);
  let best = null;
  for (let cz = 573; cz <= 603; cz += 0.05) {
    for (let cx = -190; cx <= -158; cx += 0.05) {
      const CX = Math.round(cx * 100) / 100, CZ = Math.round(cz * 100) / 100;
      if (!fits(CX, CZ)) continue;
      const dist = Math.abs(CZ + d / 2 - PC.rect.z0);
      const tie = Math.abs(CX - (PC.rect.x0 + PC.rect.x1) / 2);
      if (!best || dist < best.dist - 1e-9 || (Math.abs(dist - best.dist) < 1e-9 && tie < best.tie)) {
        best = { cx: CX, cz: CZ, dist, tie };
      }
    }
  }
  assert.ok(best, "no station in the island accepts the seat terrace at all");
  assert.deepEqual([t.centre[0], t.centre[1]], [best.cx, best.cz],
    `the section stores [${t.centre}] but its own rule solves to [${best.cx}, ${best.cz}]`);
  assert.match(t.positionNote, /pavilionClip/,
    "the position rule must name the rejection constraint that produced it");
  /* ARBITRATED 2026-08-19: the Meditation Pavilion and the Tea House are
     eighthgathering's. What is left here is the clip this section holds its
     gravel out of, which must be gathering's rect and must lie in the island
     — a clip that missed the island would leave gravel over the pavilion. */
  assert.equal(section.pavilion, undefined, "the pavilion is eighthgathering's");
  assert.equal(section.teaHouse, undefined, "the Tea House is eighthgathering's");
  const pc = section.bambooGarden.pavilionClip;
  assert.equal(pc.owner, "eighthgathering.meditation.bark",
    "a rect this section did not measure must name whose it is");
  const gbb = bbOf(island);
  assert.ok(pc.rect.x0 >= gbb.x0 && pc.rect.x1 <= gbb.x1 && pc.rect.z0 >= gbb.z0 && pc.rect.z1 <= gbb.z1,
    "the pavilion clip must lie within the surveyed Bamboo Garden island's extent");
  assert.match(pc.note, /carpet/, "the clip has to say why it exists — the rung it would paint over");
});

test("every rectangle that places something is derived, and the orphans are gone", () => {
  /* Round one carried seven typed `places` rectangles — no source, no
     derivation, no tier — and they were the sampling domain for some 250
     scattered objects. Every one of those objects went to a sibling in the
     2026-08-19 arbitration. Six rectangles are deleted; the survivor must be
     derived edge for edge from the survey, and this re-derives it. */
  assert.deepEqual(Object.keys(section.places), ["social"],
    "an unsourced rectangle that places nothing is invented geometry and must be deleted");
  const podemos = bbOf(toM(arcgis.massing[252].r[0]));
  const sankofa = bbOf(toM(arcgis.massing[461].r[0]));
  const r = section.places.social.rect;
  assert.equal(r.z0, podemos.z1, "The Social's north edge is Podemos' south face");
  assert.equal(r.z1, sankofa.z0, "its south edge is Sankofa Base's north face");
  assert.equal(r.x0, Math.max(podemos.x0, sankofa.x0), "its west edge is the overlap of the two masses");
  assert.equal(r.x1, Math.min(podemos.x1, sankofa.x1), "its east edge is the overlap of the two masses");
  /* The independent check used to be this section's own public-art wall, which
     went to eighthgathering in the 2026-08-19 repair. The object left standing
     in The Social is the stepped seat terrace, and it takes the check. */
  assert.equal(section.mural, undefined, "the public-art wall is eighthgathering's");
  const soc = section.levelChange.seatTerraces.find((s) => s.id === "social").centre;
  assert.ok(soc[0] >= r.x0 && soc[0] <= r.x1 && soc[1] >= r.z0 && soc[1] <= r.z1,
    "the independent check: this section's own seat terrace must fall inside The Social");
  assert.match(section.places.social.derivation, /^\[measured\]/);
  /* AND THE SEAT TERRACE'S OWN RULE IS RE-RUN. Its station is stated as the
     answer to a search, so the search is repeated here against the shipped span
     table. Round two's [-75.5, 563.0] did NOT satisfy its own predicate — the
     assembly it named does not fit on measured paving there — and it claimed to
     be nearest a centroid (-74, 559) that is not the derived rectangle's. A
     stated rule whose stated answer it does not produce is not a rule. */
  const P = section.measured.paving;
  const rowsS = new Map();
  for (const [z, x0, x1] of P.spans) {
    const k = Math.round(z / P.rowPitch);
    if (!rowsS.has(k)) rowsS.set(k, []);
    rowsS.get(k).push([x0, x1]);
  }
  const pavedS = (x, z) => {
    const rr = rowsS.get(Math.round((z - P.rowPitch / 2) / P.rowPitch));
    return !!rr && rr.some(([a, b]) => x >= a && x <= b);
  };
  const onPaving = (cx, cz, w, dd) => {
    const nx = Math.max(1, Math.round(w / 0.5)), nz = Math.max(1, Math.round(dd / 0.5));
    for (let i = 0; i <= nx; i++) {
      for (let j = 0; j <= nz; j++) {
        if (!pavedS(cx - w / 2 + (w * i) / nx, cz - dd / 2 + (dd * j) / nz)) return false;
      }
    }
    return true;
  };
  const st = section.levelChange.seatTerraces.find((s) => s.id === "social");
  const sw = st.length, sd = st.tiers * st.tread;
  const cen = [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2];
  let bestS = null;
  for (let cz = r.z0; cz <= r.z1; cz += 0.5) {
    for (let cx = r.x0; cx <= r.x1; cx += 0.5) {
      const CX = Math.round(cx * 10) / 10, CZ = Math.round(cz * 10) / 10;
      if (!onPaving(CX, CZ, sw, sd)) continue;
      const dd = Math.hypot(CX - cen[0], CZ - cen[1]);
      if (!bestS || dd < bestS.d) bestS = { cx: CX, cz: CZ, d: dd };
    }
  }
  assert.ok(bestS, "no station in The Social accepts the seat terrace");
  assert.deepEqual([st.centre[0], st.centre[1]], [bestS.cx, bestS.cz],
    `the social seat terrace is stored at [${st.centre}] but its own rule solves to [${bestS.cx}, ${bestS.cz}]`);
  assert.ok(onPaving(st.centre[0], st.centre[1], sw, sd),
    "and the stored station must itself land wholly on measured paving");

  /* The court apron zone is derived the same way, from the surveyed court. */
  const zone = section.paving.zones.find((z) => z.derive === "courtApron");
  assert.ok(zone, "the court apron zone must declare that it is derived, not typed");
  const c = section.measured.court.rect;
  const reach = section.court.apron.reach;
  const t3 = (v) => Math.round(v * 1000) / 1000;
  assert.deepEqual(zone.rect,
    { x0: t3(c.x0 - reach), x1: t3(c.x1 + reach), z0: t3(c.z0 - reach), z1: t3(c.z1 + reach) },
    "the stored apron rect is not the derivation the module actually uses");
  /* And `reach` is a measurement OF THE SPAN TABLE, so re-measure it: the
     widest paved run immediately adjacent to the surveyed court. */
  let widest = 0;
  for (const [z, x0, x1] of section.measured.paving.spans) {
    if (z < c.z0 || z > c.z1) continue;
    if (Math.abs(x1 - c.x0) < 0.06 || Math.abs(x0 - c.x1) < 0.06) widest = Math.max(widest, x1 - x0);
  }
  assert.ok(Math.abs(widest - reach) < 0.02,
    `court.apron.reach is ${reach}, but the widest surveyed run beside the court is ${widest.toFixed(2)}`);
  assert.ok(section.court.apron.width < reach, "the apron proper is the narrower east run");
});

test("figures that are consequences are derived, not typed alongside their cause", () => {
  /* The garden bands: the COUNT was photographed, the module spreads them
     evenly over the surveyed island, so the pitch is arithmetic. Round one
     declared 3.5 m next to the count and the module honoured only the count —
     two numbers, one of them decorative, disagreeing by 6%. */
  const B = section.edging.gardenBands;
  const zs = section.measured.rings.bambooGarden.points.map((p) => p[1]);
  const ext = Math.max(...zs) - Math.min(...zs);
  assert.ok(Math.abs(B.pitch - ext / (B.count + 1)) < 1e-3,
    `gardenBands.pitch ${B.pitch} is not the surveyed island's ${ext.toFixed(2)} m over ${B.count} + 1 bands`);
  assert.match(B.pitchNote, /DERIVED/);

  /* The Sun Lawn's declared area must be its ring's shoelace area. */
  for (const p of section.lawns.panels) {
    const ring = section.measured.rings[p.ring].points;
    let a = 0;
    for (let i = 0; i < ring.length; i++) {
      const [x1, z1] = ring[i];
      const [x2, z2] = ring[(i + 1) % ring.length];
      a += x1 * z2 - x2 * z1;
    }
    assert.ok(Math.abs(Math.abs(a / 2) - p.areaM2) < 0.1,
      `${p.id} declares ${p.areaM2} m2, its surveyed ring is ${Math.abs(a / 2).toFixed(1)}`);
  }
});

test("every recorded number either drives geometry or says why it cannot", () => {
  /* The Keeling bar's other half. A measurement sitting in the data driving
     nothing, unremarked, is the defect — round one carried 23 such keys,
     including all five `families.*.unit`, the CMU coursing and a "measured
     2.5 m apron on all four sides" that was never built. This walks every
     numeric leaf in the section and requires each key name to be read by the
     module or named in `measured.notDrawn`. */
  const src = readFileSync(join(root, "docs/js/campus-photo-eighthcourtyards.js"), "utf8");
  const declared = section.measured.notDrawn;
  assert.ok(declared && declared.keys, "the section must carry a notDrawn register");
  const excused = Object.keys(declared.keys);
  const isExcused = (path) => excused.some((pat) => {
    const re = new RegExp("^" + pat.replace(/[.]/g, "\\.").replace(/\*/g, "[^.]+") + "$");
    return re.test(path);
  });
  const dead = [];
  const skip = new Set(["measured", "colors", "colorSources", "sources", "absent", "supersedes", "species"]);
  const walk = (o, path) => {
    if (Array.isArray(o)) return o.forEach((v, i) => walk(v, `${path}.*`));
    if (!o || typeof o !== "object") return;
    for (const [k, v] of Object.entries(o)) {
      const p = `${path}.${k}`;
      if (typeof v === "number" || (Array.isArray(v) && v.length && v.every((x) => typeof x === "number"))) {
        if (!new RegExp(`\\b${k}\\b`).test(src) && !isExcused(p.slice(2))) dead.push(p);
      } else walk(v, p);
    }
  };
  for (const [k, v] of Object.entries(section)) if (!skip.has(k)) walk(v, `$.${k}`);
  walk(section.measured.rings, "$.measured.rings");
  assert.deepEqual(dead, [], `numeric keys that drive nothing and are not declared: ${dead.join(", ")}`);
  for (const [k, why] of Object.entries(declared.keys)) {
    assert.ok(why.length > 80, `notDrawn.${k} does not say why`);
  }
});

test("the court hardware left this section, and the record of the conflict stays", () => {
  /* ARBITRATED 2026-08-19: eighthsiteworks.systems.courtHardware owns the two
     gooseneck standards — it carries the brace strut and the net cone this
     section never had. This section's WIDTH class won that arbitration (a 54 x
     42 in institutional board, not the 72 x 42 regulation one siteworks
     assumed) and its height lost, so the measurement has to survive as a
     record even though the object does not. */
  assert.equal(section.court.standards, undefined,
    "two sections must not both build the same two basketball standards");
  const conflict = section.absent.find((a) => /backboard size conflict/.test(a));
  assert.ok(conflict, "the single-frame backboard measurement must stay declared");
  assert.match(conflict, /1\.372|54 x 42/, "and the entry must carry the arbitrated size");
  assert.match(conflict, /eighthsiteworks/, "and name the section that builds it");
  /* The court hedge is what this section still owns there. */
  assert.ok(section.court.hedge.rings.length > 0, "the clipped hedge row stays here");
});

/* ------------------------------------------- the module, actually running */

const flat = () => 20;
const rolling = (x, z) => 20 + 1.2 * Math.sin(x / 14) + 0.9 * Math.cos(z / 17);
const build = (g = flat) =>
  createPhotoEighthCourtyards(null, { photo: { eighthcourtyards: section }, heightAt: g, surfaceAt: g });

test("the module builds the section, and the counts are the sourced counts", () => {
  const { group, counts } = build();
  assert.equal(counts.pavingStrips, section.measured.paving.spans.length);
  assert.equal(
    counts.pavingP1 + counts.pavingP2 + counts.pavingP3 + counts.pavingP4 + counts.pavingDG,
    counts.pavingStrips, "every measured span must land in exactly one family");
  assert.equal(counts.stairS1Risers, 15);
  assert.equal(counts.planterCubes, section.bambooGarden.planterCubes.count, "twelve cubes counted in SWA -3");
  assert.equal(counts.lawnPanels, 1, "one resolved turf panel — #1160 carries two surfaces and is withheld");
  /* NOT A RESTATEMENT ANY MORE. `counts.gardenBands` used to be set to
     `B.count` unconditionally, so this line compared a number to itself and
     stayed green even when a band clipped away to nothing. The module now counts
     the bands that actually produced geometry, so this asserts that all eight
     survive the island clip AND the pavilion cut. */
  assert.equal(counts.gardenBands, section.edging.gardenBands.count);
  assert.ok(counts.gardenBandSegments > counts.gardenBands,
    `${counts.gardenBandSegments} band segments for ${counts.gardenBands} bands — the courtyard rings split most of them in two`);
  assert.equal(counts.planterWalls, section.levelChange.planterWalls.count);
  assert.equal(counts.retainingMetres, 27, "26.8 m of surveyed-anchored wall");
  /* ARBITRATED 2026-08-19: this section was stripped back to paving, edging,
     garden bands, level change, the Bamboo Garden, the Sun Lawn and the four
     anchored structures. Everything below is now a sibling's and MUST NOT be
     counted here, or the object ships twice. */
  for (const gone of ["courtStandards", "roofLights", "standingStones", "screenSegments",
    "fireFeatures", "rambleBoulders", "rambleGrasses", "bollards", "luminaireA", "luminaireB",
    "emergencyTowers", "bikeRuns", "bikeHoops", "bins", "standpipes", "cabinets",
    "calisthenicsParts", "grillBays", "muralWall"]) {
    assert.equal(counts[gone], undefined, `${gone} is a sibling's now and must not be built here`);
  }
  for (const gone of ["pavilion", "teaHouse", "lighting", "fixtures", "furniture", "ramble",
    "calisthenics", "grill", "mural"]) {
    assert.equal(section[gone], undefined, `$.${gone} went to a sibling and must not be in this section`);
  }
  /* And the colour roles go with their objects — a hex for something this
     section no longer builds is what the used-check above already forbids, but
     these two are named because they were arbitrated values and it must be
     visible that they were handed over rather than lost. */
  for (const gone of ["safetyOrange", "fdcRed"]) {
    assert.equal(section.colors[gone], undefined,
      `${gone} is the colour of an object this section withdrew and must go with it`);
  }
  assert.equal(counts.absent, section.absent.length);
  assert.ok(group.children.length >= 6, "the module must ship its named subgroups");

  /* COUNT GATES THAT ARE MEASUREMENTS, NOT RESTATEMENTS. The audit set the
     scattered counts to 3 and 5 and no count assertion fired, because most of
     them read `counts.x === section...x` — which proves the loop ran, not that
     it ran over the right geometry. Each of these is re-derived from the
     survey or from the sourced module instead. */
  const S1 = section.levelChange.stairs.find((s) => s.id === "S1");
  /* The three figures phf03 was COUNTED for, asserted absolutely — a relation
     alone is self-referential and stays green when both sides move together. */
  assert.equal(S1.risers, 15, "15 risers counted in phf03, nosing by nosing");
  assert.equal(S1.stepLight.perRiser, 2, "TWO step-lights per lit riser in phf03");
  assert.equal(S1.stepLight.everyNthRiser, 2, "on ALTERNATE risers in phf03");
  assert.equal(counts.stepLights, 16, "8 lit risers x 2 lights");
  assert.equal(counts.stepLights,
    Math.ceil(S1.risers / S1.stepLight.everyNthRiser) * S1.stepLight.perRiser,
    "and the module must reach it through perRiser — round one hard-coded the pair, so perRiser drove nothing");
  const run = section.levelChange.retaining.runs[0];
  assert.equal(counts.retainingMetres,
    Math.round(Math.hypot(run.b[0] - run.a[0], run.b[1] - run.a[1])),
    "26.8 m of surveyed-anchored wall");
  /* The edging is run along the surveyed rings themselves, so its length is a
     property of the SURVEY and can be re-measured from it. */
  let perimeter = 0;
  for (const ring of carriedRings().concat([section.measured.rings.pavilionSlabWest.points])) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      perimeter += Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
  }
  assert.ok(counts.edgingMetres > 0.4 * perimeter && counts.edgingMetres <= perimeter,
    `edging runs ${counts.edgingMetres} m against ${perimeter.toFixed(0)} m of carried ring perimeter — the rest is cut by the massing keep-out`);
  /* The hedge fills its two surveyed strips at the sourced spacing, so its
     clump count follows from their AREA, not from a declared number. */
  const hedgeArea = section.court.hedge.rings.reduce((t, k) => {
    const r = section.measured.rings[k].points;
    let a = 0;
    for (let i = 0; i < r.length; i++) {
      const [x1, z1] = r[i];
      const [x2, z2] = r[(i + 1) % r.length];
      a += x1 * z2 - x2 * z1;
    }
    return t + Math.abs(a / 2);
  }, 0);
  const sp = section.court.hedge.spacing;
  assert.ok(counts.hedgeClumps >= 0.5 * hedgeArea / (sp * sp) && counts.hedgeClumps <= 1.2 * hedgeArea / (sp * sp),
    `${counts.hedgeClumps} hedge clumps for ${hedgeArea.toFixed(0)} m2 of surveyed strip at ${sp} m spacing`);
  /* And the ground fills must actually cover their surveyed rings. */
  assert.ok(counts.lawnStrips >= 20, "the Sun Lawn's 21.5 m of z must fill at the row pitch");
  assert.ok(counts.gardenStrips >= 25, "the Bamboo Garden island's 29.8 m of z must fill");
  const missing = createPhotoEighthCourtyards(null, { photo: {}, heightAt: flat, surfaceAt: flat });
  assert.deepEqual(missing.counts, {}, "a missing section builds nothing and breaks nothing");
});

/** Every instance in the group, as a world AABB — rotation and geometry aware. */
function placements(group) {
  group.updateMatrixWorld(true);
  const out = [];
  const m = new THREE.Matrix4();
  group.traverse((o) => {
    if (o.isInstancedMesh) {
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m);
        const bb = o.geometry.boundingBox.clone().applyMatrix4(m);
        out.push({ name: o.name, bb, x: (bb.min.x + bb.max.x) / 2, z: (bb.min.z + bb.max.z) / 2 });
      }
    } else if (o.isMesh) {
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
      out.push({ name: o.name, bb, x: (bb.min.x + bb.max.x) / 2, z: (bb.min.z + bb.max.z) / 2, merged: !!o.material.polygonOffset });
    }
  });
  return out;
}

/* Everything that deliberately stands OFF the ground, and the thing that
   carries it. Anything not named here must reach the drawn surface.
 *
 * PRUNED 2026-08-19. This map still listed nineteen families that left in the
 * arbitration — the pavilion, the Tea House, the court standards, the lamps,
 * the towers, the fire features, the furniture — and a stale carrier entry is
 * not inert: it is a standing licence for anything that ever takes that name
 * again to float. The gate below now also asserts the map has no dead keys, so
 * it cannot rot back. The six entries ADDED are families that were floating
 * legitimately and being waved through by the old 0.55 m unnamed-float
 * allowance instead of naming what holds them up. */
const CARRIED = {
  "pe-cap": "pe-body",
  "guard-rail": "guard-post", "guard-post": "retain-wall", "guard-picket": "guard-post",
  "cube-cap": "cube-planter", "cube-shrub": "cube-planter",
  "w3-shrub": "w3-planter",
  "seatwall-cap": "seatwall", "led-channel": "seat-tier",
  "stair-tread": "terrace", "stair-riser": "terrace", "stair-steplight": "stair-riser",
  "handrail": "stair-tread",
};

test("nothing hovers and nothing sinks — every family reaches the ground or a named carrier", () => {
  const { group } = build(rolling);
  const items = placements(group);
  assert.ok(items.length > 1000, `only ${items.length} placements — the loops did not run`);

  const byName = new Map();
  for (const it of items) {
    const g = rolling(it.x, it.z);
    const e = byName.get(it.name) || { bottom: Infinity, top: -Infinity, n: 0, merged: it.merged };
    e.bottom = Math.min(e.bottom, it.bb.min.y - g);
    e.top = Math.max(e.top, it.bb.max.y - g);
    e.n++;
    byName.set(it.name, e);
  }
  for (const [name, e] of byName) {
    assert.ok(name, "every mesh must be named so its seat can be checked");
    /* Merged ground fills follow the terrain across their whole extent, so a
       single bbox says nothing about their seat; every one of their VERTICES is
       checked against the drawn surface in the overlay-ladder test instead. */
    if (e.merged) continue;
    assert.ok(e.bottom >= -1.35,
      `${name} plunges ${(-e.bottom).toFixed(2)} m under the drawn surface — a runaway skirt`);
    assert.ok(e.top <= 8.0, `${name} tops out ${e.top.toFixed(2)} m over the ground`);
    const carrier = CARRIED[name];
    if (!carrier) {
      /* TIGHTENED 0.55 -> 0.05 IN THIS REPAIR. 0.55 m was half a metre of
         licence for any family that forgot to name a carrier, and six families
         were using it. Everything that genuinely reaches the drawn surface
         reaches it: the loosest is 0.00. */
      assert.ok(e.bottom <= 0.05,
        `${name} floats: its lowest instance starts ${e.bottom.toFixed(2)} m over the drawn surface and it names no carrier`);
      continue;
    }
    const c = byName.get(carrier);
    assert.ok(c, `${name} names carrier ${carrier}, which does not exist`);
    /* 0.20 m of slack: the carrier's seat is sampled at ITS centre and the
       carried piece at its own, and the test surface rolls a metre over a few
       metres of plan. The gate is "it rests within its carrier's envelope",
       not "it rests on the carrier's exact top". Was 0.45 — the widest real
       excursion here is the handrail's 0.12 m below the tread it rises from,
       which is the rail reaching past the bottom nosing. */
    assert.ok(e.bottom >= c.bottom - 0.20 && e.bottom <= c.top + 0.20,
      `${name} starts at ${e.bottom.toFixed(2)} but its carrier ${carrier} spans ${c.bottom.toFixed(2)}..${c.top.toFixed(2)}`);
  }
  /* No dead carrier entries: a stale name is a standing licence to float. */
  for (const name of Object.keys(CARRIED)) {
    assert.ok(byName.has(name), `CARRIED lists ${name}, which this module no longer builds`);
  }
});

test("every ground decal rides the overlay ladder, at the ladder's own lift", () => {
  const { group } = build(rolling);
  let merged = 0;
  group.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh) return;
    const pos = o.geometry.getAttribute("position");
    if (!pos || !o.material.polygonOffset) return;
    merged++;
    const rung = Object.entries(OVERLAY).find(([, v]) => v.renderOrder === o.renderOrder);
    assert.ok(rung, `${o.name} draws at renderOrder ${o.renderOrder}, which is not a ladder rung`);
    assert.equal(o.material.depthWrite, false, `${o.name} is a decal and must not write depth`);
    for (let i = 0; i < pos.count; i += 37) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      assert.ok(Math.abs(y - (rolling(x, z) + rung[1].lift)) < 1e-3,
        `${o.name} sits at ${y.toFixed(3)}, not on the drawn surface + the ${rung[0]} lift`);
    }
  });
  assert.ok(merged >= 7, `only ${merged} merged ground fills — the paving did not draw`);
  const src = readFileSync(join(root, "docs/js/campus-photo-eighthcourtyards.js"), "utf8");
  assert.ok(!/polygonOffsetFactor\s*[:=]/.test(src), "the ladder's depth state comes from campus-overlay.js");
  assert.ok(/overlayLift\(/.test(src) && /applyOverlayDepth\(/.test(src),
    "lifts and depth state must come from campus-overlay.js, never a local constant");
});

test("every scattered object stands on a measured paved span — never in a bed or a building", () => {
  const { group } = build();
  const P = section.measured.paving;
  const rows = new Map();
  for (const [z, x0, x1] of P.spans) {
    const k = Math.round(z / P.rowPitch);
    if (!rows.has(k)) rows.set(k, []);
    rows.get(k).push([x0, x1]);
  }
  const paved = (x, z) => {
    const r = rows.get(Math.round((z - P.rowPitch / 2) / P.rowPitch));
    return !!r && r.some(([a, b]) => x >= a && x <= b);
  };
  /* The scatter itself left with the furniture and the fixtures (arbitrated
     2026-08-19): a scatter loses to a sibling's anchor. What is left placed by
     a rule rather than by a coordinate is the W3 planter row, and it takes the
     same gate — the whole footprint must land on a measured paved span. */
  const scattered = /^(w3-planter)/;
  let checked = 0;
  for (const it of placements(group)) {
    if (!scattered.test(it.name)) continue;
    checked++;
    assert.ok(paved(it.x, it.z),
      `${it.name} at (${it.x.toFixed(1)}, ${it.z.toFixed(1)}) does not stand on a measured paved span`);
  }
  assert.ok(checked > 0, `only ${checked} scattered objects checked`);
  assert.ok(!/function scatter\(/.test(readFileSync(join(root, "docs/js/campus-photo-eighthcourtyards.js"), "utf8")),
    "the rejection scatter is orphaned once furniture, lighting and fixtures leave");

  /* And nothing this module places — scattered or anchored — may stand inside
     a drawn building footprint. */
  const mass = [];
  for (const i of P.subtractedMassing.rings) {
    for (const rr of arcgis.massing[i].r) {
      const ring = toM(rr);
      mass.push({ n: arcgis.massing[i].n, ring, bb: bbOf(ring) });
    }
  }
  const B = section.bounds;
  for (const it of placements(group)) {
    if (it.merged) continue;
    assert.ok(it.x >= B.x0 - 1 && it.x <= B.x1 + 1 && it.z >= B.z0 - 1 && it.z <= B.z1 + 1,
      `${it.name} at (${it.x.toFixed(1)}, ${it.z.toFixed(1)}) escapes the declared bounds`);
    for (const m of mass) {
      if (it.x < m.bb.x0 || it.x > m.bb.x1 || it.z < m.bb.z0 || it.z > m.bb.z1) continue;
      assert.ok(!inRing(it.x, it.z, m.ring),
        `${it.name} at (${it.x.toFixed(1)}, ${it.z.toFixed(1)}) stands inside ${m.n}`);
    }
  }
});

test("two builds are byte-identical — no hidden randomness", () => {
  const a = build();
  const b = build();
  assert.deepEqual(a.counts, b.counts);
  const sig = (r) => {
    const out = [];
    r.group.traverse((o) => {
      if (o.isInstancedMesh) out.push(o.name, Array.from(o.instanceMatrix.array));
      else if (o.isMesh) out.push(o.name, Array.from(o.geometry.getAttribute("position").array));
    });
    return out;
  };
  assert.deepEqual(sig(a), sig(b));
  const src = readFileSync(join(root, "docs/js/campus-photo-eighthcourtyards.js"), "utf8");
  assert.ok(!/Math\.random|Date\.now|new Date/.test(src), "no nondeterminism in the builder");
});

test("colours are DATA and the surfaces are the code-generated library", () => {
  const src = readFileSync(join(root, "docs/js/campus-photo-eighthcourtyards.js"), "utf8");
  assert.match(src, /(?:shared|create)MaterialLibrary/, "surfaces come from campus-materials.js");
  /* NO WRECKAGE. Twenty-one objects left this file in the 2026-08-19
     arbitration and two helpers were left behind with nothing calling them —
     a PAINT rung constant and a decal-quad factory. Dead code in a module
     whose whole claim is "everything here is sourced" reads as something that
     was meant to be built and was not. */
  const bodies = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const m of bodies.matchAll(/^(?:function (\w+)\(|const (\w+) = )/gm)) {
    const name = m[1] || m[2];
    const uses = bodies.match(new RegExp(`\\b${name}\\b`, "g")).length;
    assert.ok(uses > 1, `${name} is declared and never used — arbitration wreckage`);
  }
  const literals = src.match(/["'`]#[0-9a-fA-F]{3,8}["'`]/g);
  assert.equal(literals, null, `hex literals in the module: ${literals} — colours are DATA`);
  const { group } = build();
  /* A HEADCOUNT REPLACED BY A ROLL CALL. This was `textured >= 30`, and a bare
     count is the wrong shape of gate twice over: it says nothing about WHICH
     mesh lost its surface, and it moves whenever a family is withdrawn for
     reasons that have nothing to do with the material library. The 2026-08-19
     repair withdrew three families to siblings (the calisthenics rig, the grill
     station and the public-art wall), which took the honest count to 29 — under
     a headcount gate that reads as "the library is not applied", which is false.
     So every mesh is named instead: all of them must carry the library's map
     AND roughnessMap, except the three plant clumps the module deliberately
     leaves plain at campus-photo-eighthcourtyards.js:149-151 (the library's
     foliage class is an alpha-cut CARD map and cutting holes in clump geometry
     shreds it). This cannot be satisfied by an untextured family hiding behind a
     margin, and it does not have to move the next time a family leaves. */
  const PLAIN = new Set(["w3-shrub", "court-hedge", "cube-shrub"]);
  let textured = 0;
  const seen = new Set();
  group.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    seen.add(o.name);
    if (PLAIN.has(o.name)) {
      assert.ok(!o.material.map,
        `${o.name} is declared a plain plant clump but carries a library map`);
      return;
    }
    assert.ok(o.material.map && o.material.roughnessMap,
      `${o.name} carries no code-generated surface — the library is not applied to it`);
    textured++;
  });
  for (const p of PLAIN) {
    assert.ok(seen.has(p), `${p} is exempted from the library but is not built — stale exemption`);
  }
  /* And the roll call must be a real one, pinned to the truth rather than to a
     margin. Non-shrinking: adding a textured family is always safe, retiring one
     means re-pinning this number in the same edit and saying why. */
  assert.equal(textured, 29,
    `${textured} textured meshes — re-pin this to the truth and say which family came or went`);
});

/* The library's own cell grid, read from campus-materials.js rather than
   restated here — if that constant ever moves, this gate moves with it instead
   of quietly certifying the wrong scale. */
const MATERIALS_SRC = readFileSync(join(root, "docs/js/campus-materials.js"), "utf8");
const CELL_GRID = (() => {
  const m = MATERIALS_SRC.match(/pavingConcreteUnit\([^)]*\)\s*\{\s*const COLS = (\d+), ROWS = (\d+)/);
  assert.ok(m, "campus-materials.js no longer declares pavingConcreteUnit's cell grid");
  assert.equal(m[1], m[2], "a non-square cell grid needs a per-axis factor here");
  return Number(m[1]);
})();

test("the paving families carry real product dimensions at true texture scale", () => {
  const F = section.paving.families;
  assert.ok(Math.abs(F.P1.unit[0] - 0.089) < 1e-9, "P1 is the measured 0.089 m narrow modular width");
  assert.deepEqual(F.P2.unit, [0.315, 0.157], "P2 is the measured 305 x 152 mm unit");
  assert.deepEqual(F.P3.unit, [0.2, 0.1], "P3 is the measured 2:1 mosaic unit");
  assert.equal(F.P4.unit[0], 1.5, "P4 is the measured 1.5 m score grid");
  for (const [k, f] of Object.entries(F)) {
    assert.ok(section.colors[f.color], `${k} names a colour that does not exist`);
    assert.ok(f.unitNote && f.unitNote.length > 80, `${k} does not say how its unit was measured`);
    assert.ok(f.source, `${k} has no source`);
    /* THE KEELING BAR. A texture tile is not a unit: the library lays CELL_GRID
       units per tile, so a family drawn on pavingConcreteUnit must carry
       tile = unit x CELL_GRID on BOTH axes. Round one set tile to the unit and
       rendered the measured 0.315 m paver at 52 mm, with the old gate
       (`f.tile > 0.05`) waving it through — that gate never related tile to
       unit at all, which is why it could not see the defect it was written for.
       Anything drawn on a class with no unit grid must SAY it is a noise scale
       and carry the estimated tier, rather than borrow the measured one. */
    assert.ok(Array.isArray(f.tile) && f.tile.length === 2,
      `${k}'s tile must be [u, v] — one scalar renders a 2:1 unit square`);
    assert.ok(f.tileTier === "measured" || f.tileTier === "estimated", `${k} has no tileTier`);
    assert.ok(f.tileNote && f.tileNote.length > 60, `${k} does not say where its tile comes from`);
    if (f.material === "pavingConcreteUnit") {
      assert.equal(f.tileTier, "measured");
      for (const a of [0, 1]) {
        assert.ok(Math.abs(f.tile[a] - f.unit[a] * CELL_GRID) < 1e-9,
          `${k}'s tile axis ${a} is ${f.tile[a]}, not the measured unit ${f.unit[a]} x ${CELL_GRID}`);
      }
    } else {
      assert.equal(f.tileTier, "estimated",
        `${k} draws on ${f.material}, which has no unit grid, so its tile is a noise scale and cannot be measured`);
      assert.match(f.tileNote, /no unit grid|NO unit grid/i);
    }
  }
  /* And the same rule for the two ground fills outside `families`. */
  for (const [what, t] of [["bambooGarden.gravel", section.bambooGarden.gravel], ["lawns", section.lawns]]) {
    assert.ok(Array.isArray(t.tile) && t.tile.length === 2, `${what}'s tile must be [u, v]`);
    assert.equal(t.tileTier, "estimated", `${what} draws on a noise class and may not claim a measured tile`);
  }
  assert.match(section.paving.tileRule, /COLS = 6/, "the section must state the library rule it derives tile from");
  assert.match(F.P3.unitNote, /THE 'MOSAIC' IS THE COLOUR BLEND/i,
    "the plate-mosaic correction must be stated where the unit is declared");
  assert.match(section.paving.zoneNote, /\[estimated\]/,
    "which blend covers which field is photo-inferred and must say so");
  assert.match(section.paving.rung, /carpet/,
    "the field paints one rung above campus-eighth.js's pad repaint");
});

test("the measured unit reaches the RENDER — the uv the strips carry is the tile", () => {
  /* The defect this exists for walked through the whole of round one's suite:
     the data was right, the gate checked the data, and the renderer divided by
     the wrong number. So read the built geometry back and recover the tile from
     it. uv = (x / tile[0], z / tile[1]) means tile[0] = dx / du over any two
     vertices of the mesh, which is a measurement of what the GPU will sample. */
  const { group } = build();
  const seen = new Set();
  group.traverse((o) => {
    const m = /^paving-(\w+)$/.exec(o.name || "");
    if (!m || !o.isMesh) return;
    const f = section.paving.families[m[1]];
    const pos = o.geometry.getAttribute("position");
    const uv = o.geometry.getAttribute("uv");
    assert.ok(pos && uv, `${o.name} has no uv`);
    let spanU = 0, spanV = 0;
    for (let i = 1; i < pos.count; i++) {
      const du = uv.getX(i) - uv.getX(0);
      const dv = uv.getY(i) - uv.getY(0);
      if (Math.abs(du) > 1e-4) spanU = Math.max(spanU, Math.abs((pos.getX(i) - pos.getX(0)) / du));
      if (Math.abs(dv) > 1e-4) spanV = Math.max(spanV, Math.abs((pos.getZ(i) - pos.getZ(0)) / dv));
    }
    assert.ok(Math.abs(spanU - f.tile[0]) < 1e-3,
      `${o.name} renders a u tile of ${spanU.toFixed(4)} m, but the family declares ${f.tile[0]}`);
    assert.ok(Math.abs(spanV - f.tile[1]) < 1e-3,
      `${o.name} renders a v tile of ${spanV.toFixed(4)} m, but the family declares ${f.tile[1]}`);
    if (f.material === "pavingConcreteUnit") {
      assert.ok(Math.abs(spanU / CELL_GRID - f.unit[0]) < 1e-3,
        `${o.name} renders its unit at ${(spanU / CELL_GRID * 1000).toFixed(0)} mm against a measured ${(f.unit[0] * 1000).toFixed(0)} mm`);
      assert.ok(Math.abs(spanV / CELL_GRID - f.unit[1]) < 1e-3,
        `${o.name} renders its unit at ${(spanV / CELL_GRID * 1000).toFixed(0)} mm against a measured ${(f.unit[1] * 1000).toFixed(0)} mm`);
    }
    seen.add(m[1]);
  });
  assert.deepEqual([...seen].sort(), Object.keys(section.paving.families).sort(),
    "every declared paving family must actually draw");
});

test("the measured CMU coursing reaches the render too", () => {
  /* campus-materials.js FIELDS.brick lays 8 courses x 4 units per tile. Handed
     no repeat it stretches those over the whole mesh — 0.6 m courses on the
     4.8 m parking-elevator box. seatWalls.courseHeight and .unitLength were
     measured off SWA -18 and round one never read either. */
  const B = MATERIALS_SRC.match(/brick\([^)]*\)\s*\{\s*const COURSES = (\d+), PER = (\d+)/);
  assert.ok(B, "campus-materials.js no longer declares brick's course grid");
  const [COURSES, PER] = [Number(B[1]), Number(B[2])];
  const M = section.levelChange.seatWalls;
  assert.equal(M.courseHeight, 0.203, "the measured 8 in nominal course");
  assert.equal(M.unitLength, 0.406, "the measured 16 in nominal unit");
  const { group } = build();
  /* RE-BASELINED THREE -> TWO IN THE 2026-08-19 REPAIR, and only because the
     grill counter went to eighthgathering with the rest of the grill station.
     Nothing about the coursing rule is relaxed: both remaining faces are still
     re-derived from the library's own grid and the measured CMU module. */
  const faces = {
    seatwall: [null, null],
    "pe-body": [section.parkingElevator.size[0], section.parkingElevator.size[1] + 0.8],
  };
  let checked = 0;
  group.traverse((o) => {
    if (!o.isInstancedMesh || !(o.name in faces)) return;
    const r = o.material.map?.repeat;
    assert.ok(r, `${o.name} draws masonry with no texture repeat — the coursing is stretched`);
    const want = faces[o.name];
    if (want[0] !== null) {
      assert.ok(Math.abs(r.x - want[0] / (PER * M.unitLength)) < 1e-6,
        `${o.name} horizontal repeat ${r.x} is not its width over ${PER} x ${M.unitLength} m`);
      assert.ok(Math.abs(r.y - want[1] / (COURSES * M.courseHeight)) < 1e-6,
        `${o.name} vertical repeat ${r.y} is not its height over ${COURSES} x ${M.courseHeight} m`);
    }
    /* Whatever the face, the rendered course must be the measured course. */
    const m4 = new THREE.Matrix4();
    o.getMatrixAt(0, m4);
    const s = new THREE.Vector3().setFromMatrixScale(m4);
    assert.ok(Math.abs(s.y / (r.y * COURSES) - M.courseHeight) < 1e-6,
      `${o.name} renders a ${(s.y / (r.y * COURSES) * 1000).toFixed(0)} mm course against the measured 203 mm`);
    checked++;
  });
  assert.equal(checked, 2, "both remaining masonry families must carry the measured coursing");
});

/* ------------------------------------- the pavilion is a HOLE, not a note */

/** Plan-view area of a merged ground fill, and of the part of it inside a rect. */
function xzArea(mesh, rect) {
  const p = mesh.geometry.getAttribute("position");
  let total = 0;
  for (let i = 0; i + 2 < p.count; i += 3) {
    const ax = p.getX(i), az = p.getZ(i);
    const bx = p.getX(i + 1), bz = p.getZ(i + 1);
    const cx = p.getX(i + 2), cz = p.getZ(i + 2);
    const a = Math.abs((bx - ax) * (cz - az) - (cx - ax) * (bz - az)) / 2;
    if (!rect) { total += a; continue; }
    /* Triangles here are always half of an axis-aligned quad, so clipping the
       quad and halving is exact for this geometry. */
    const x0 = Math.min(ax, bx, cx), x1 = Math.max(ax, bx, cx);
    const z0 = Math.min(az, bz, cz), z1 = Math.max(az, bz, cz);
    const ox = Math.max(0, Math.min(x1, rect.x1) - Math.max(x0, rect.x0));
    const oz = Math.max(0, Math.min(z1, rect.z1) - Math.max(z0, rect.z0));
    const quad = (x1 - x0) * (z1 - z0);
    total += quad > 0 ? a * ((ox * oz) / quad) : 0;
  }
  return total;
}

const gravelOf = (group) => {
  let m = null;
  group.traverse((o) => { if (o.name === "garden-gravel") m = o; });
  return m;
};

test("nothing this section builds stands inside the Meditation Pavilion", () => {
  /* THE GATE THE OLD ONE SHOULD HAVE BEEN. Until 2026-08-19 the pavilion clip
     was checked by asserting that the RECT EXISTED, lay inside the island and
     mentioned the word "carpet" — and under that gate this module built the
     18 m LED seat terrace 12.9 m inside eighthgathering's 0.45 m pavilion deck,
     and ran two of its eight garden bands straight across the deck and the bark
     field. The section's own note said verbatim that it "neither measures it nor
     draws anything inside it". This asserts the ABSENCE, which is the standard
     the paving clip has carried from the start (see this file's header). */
  const { group } = build();
  const PC = section.bambooGarden.pavilionClip;
  const R = PC.rect;
  const eps = 1e-6;
  let checked = 0;
  for (const it of placements(group)) {
    checked++;
    if (it.merged) {
      /* Merged fills are checked vertex by vertex below; a bbox spanning the
         whole college says nothing. */
      continue;
    }
    const hit = it.bb.min.x < R.x1 - eps && it.bb.max.x > R.x0 + eps
      && it.bb.min.z < R.z1 - eps && it.bb.max.z > R.z0 + eps;
    assert.ok(!hit,
      `${it.name} occupies x ${it.bb.min.x.toFixed(2)}..${it.bb.max.x.toFixed(2)}, ` +
      `z ${it.bb.min.z.toFixed(2)}..${it.bb.max.z.toFixed(2)}, which is inside eighthgathering's ` +
      `Meditation Pavilion (x ${R.x0}..${R.x1}, z ${R.z0}..${R.z1})`);
  }
  assert.ok(checked > 1000, `only ${checked} placements checked`);
  group.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || !o.material.polygonOffset) return;
    const p = o.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      assert.ok(!(x > R.x0 + eps && x < R.x1 - eps && z > R.z0 + eps && z < R.z1 - eps),
        `${o.name} has a vertex at (${x.toFixed(2)}, ${z.toFixed(2)}) inside the Meditation Pavilion`);
    }
  });
  /* And the clearance is a declared, derived figure rather than a bare touch. */
  assert.ok(PC.clearance > 0, "the clip needs a stated clearance — a shared face is not a clearance");
  assert.match(PC.clearanceNote, /^\[derived\]/, "and the clearance must say where it comes from");
  assert.match(PC.note, /carpet/, "the clip has to say why it exists — the rung it would paint over");
});

test("the pavilion clip CUTS the gravel — it does not drop whole spans", () => {
  /* The clip used to test the MIDPOINT of a span. Across the pavilion spine the
     island resolves as one continuous ~30 m span whose midpoint is inside the
     rect, so the whole row went: 215 m2 removed where only 119 m2 was ever
     inside, and 96 m2 of surveyed island fell back to campus-eighth.js's `pad`
     repaint with nothing on screen to say so. This measures the removal against
     the clip instead of trusting the predicate. */
  const PC = section.bambooGarden.pavilionClip;
  const inflated = {
    x0: PC.rect.x0 - PC.clearance, x1: PC.rect.x1 + PC.clearance,
    z0: PC.rect.z0 - PC.clearance, z1: PC.rect.z1 + PC.clearance,
  };
  const real = build();
  /* The same build with the clip collapsed to a point outside the island: the
     island's full gravel field, so the difference IS what the clip removed. */
  const open = JSON.parse(JSON.stringify(section));
  open.bambooGarden.pavilionClip.rect = { x0: 0, x1: 0, z0: 0, z1: 0 };
  const full = createPhotoEighthCourtyards(null,
    { photo: { eighthcourtyards: open }, heightAt: flat, surfaceAt: flat });

  const gReal = gravelOf(real.group);
  const gFull = gravelOf(full.group);
  assert.ok(gReal && gFull, "the Bamboo Garden gravel must draw in both builds");
  const areaReal = xzArea(gReal, null);
  const areaFull = xzArea(gFull, null);
  const removed = areaFull - areaReal;
  const inside = xzArea(gFull, inflated);
  assert.ok(inside > 50, `only ${inside.toFixed(1)} m2 of island falls inside the pavilion — the clip is not on it`);
  /* THE UPPER BOUND IS THE ROW-SNAPPED RECT, NOT THE RECT. The gravel is drawn
     as scanline strips one `rowPitch` tall, and the module cuts any strip whose
     EDGE reaches the clip, not merely those whose centre line does — the same
     conservatism `keepOut.cut` uses against a building, and the reason the
     absence gate above passes: a strip kept because its centre missed the rect
     would still put gravel inside the pavilion at its edge. So the honest
     reference is the island area inside the rect grown by half a row each way in
     z, which is exactly the set of strips the rect touches. Measuring against
     the bare rect instead charged the module 14.4 m2 of correct behaviour.
     Bounded on BOTH sides: everything strictly inside must go, and nothing
     beyond the strips the rect actually touches may. The defect this replaces —
     one 30 m span dropped whole for 215 m2 where 119 m2 was inside — fails the
     upper bound by 82 m2, so the gate still catches it with room to spare. */
  const pitch = section.measured.paving.rowPitch;
  const rowSnapped = xzArea(gFull, { ...inflated, z0: inflated.z0 - pitch / 2, z1: inflated.z1 + pitch / 2 });
  assert.ok(removed >= inside - 1.0,
    `the clip removed ${removed.toFixed(1)} m2 but ${inside.toFixed(1)} m2 of island lies inside it` +
    ` — gravel is surviving inside the Meditation Pavilion`);
  assert.ok(removed <= rowSnapped + 1.0,
    `the clip removed ${removed.toFixed(1)} m2 where the strips it touches are only ` +
    `${rowSnapped.toFixed(1)} m2 — a span that crosses the clip must be cut by it, not dropped whole`);
  assert.ok(areaReal > 550, `the Bamboo Garden ships only ${areaReal.toFixed(0)} m2 of gravel`);
});

/* ------------------------------------------ the Keeling bar on the rail spec */

test("every guard and handrail figure is tiered, and the derived ones are consequences", () => {
  /* ADDED 2026-08-19. `guard.post` was 0.05 m and `guard.postSpacing` was 2.4 m
     — round numbers nobody derived, driving 22 guard posts, in a block whose own
     `specOwnerNote` enumerates the canonical figures and does not contain
     either; and `handrail.postSpacing` was 1.35 m against the spec owner's
     derived 1.55 m, which the arbitration's `unresolved` had already named. The
     suite had no gate on any of it, because it only ever asked whether a number
     drove geometry — never where the number came from. This is that gate. */
  const L = section.levelChange;
  for (const [what, blk] of [["guard", L.guard], ["handrail", L.handrail]]) {
    assert.ok(blk.figures, `${what} carries no per-figure provenance`);
    for (const [k, v] of Object.entries(blk)) {
      if (typeof v !== "number") continue;
      const why = blk.figures[k];
      assert.ok(why, `${what}.${k} = ${v} drives geometry and says nothing about where it came from`);
      assert.match(why, /^\[(measured|sourced|derived|estimated)\]/,
        `${what}.${k}'s provenance carries no tier`);
      if (why.startsWith("[estimated]") || why.startsWith("[derived]")) {
        assert.match(why, /extends|EXTENDS|derived|DERIVED|carried|CARRIED/,
          `${what}.${k} is not measured and names no sourced pattern it extends`);
      }
      assert.ok(why.length > 80, `${what}.${k}'s provenance is too thin to check`);
    }
    for (const k of Object.keys(blk.figures)) {
      assert.equal(typeof blk[k], "number", `${what}.figures has ${k}, which is not a figure any more`);
    }
  }
  /* And the two derivations are re-run rather than read. */
  const G = L.guard;
  const bays = G.postSpacing / G.picketPitch;
  assert.ok(Math.abs(bays - Math.round(bays)) < 1e-9,
    `guard.postSpacing ${G.postSpacing} is ${bays.toFixed(2)} picket bays — a fabricated panel spans whole bays`);
  assert.ok(G.post >= G.topRail,
    `guard.post ${G.post} is a lighter section than the ${G.topRail} top rail it carries`);
  assert.ok(Math.abs(G.post - 2.375 * 0.0254) < 5e-4,
    "guard.post must be the 2 in Sch.40 OD its own figures note derives it as");
  assert.ok(G.lowerRailHeight - G.lowerRail / 2 < G.picketPitch,
    "the clear opening under the lower rail must pass the same 4 in sphere rule as the pickets");
  /* The handrail's post pitch is the spec owner's, and the owner's list says so. */
  assert.equal(L.handrail.postSpacing, 1.55,
    "the handrail post pitch is eighthsiteworks' 1.55 m — the only value with a derivation");
  assert.match(L.handrail.specOwnerNote, /1\.55/,
    "and the spec owner's canonical list must enumerate it, or it can drift again unremarked");
});

/* -------------------------------------- the edged rings are declared, with why */

test("every ring that takes a bed edge says why, and the withheld ones are named", () => {
  /* ADDED 2026-08-19. The list of rings the flush steel edge runs along was six
     hard-coded lookups in the module, so 226 m of the reported 1,152 m ran round
     arcgis.ground#1160 — a ring whose SURFACE this section withholds in `absent`
     — with the justification written nowhere at all. */
  const E = section.edging;
  assert.ok(Array.isArray(E.rings) && E.rings.length >= 6, "the edged rings must be declared data");
  const src = readFileSync(join(root, "docs/js/campus-photo-eighthcourtyards.js"), "utf8");
  for (const e of E.rings) {
    const name = e.key || e.set;
    assert.ok(name, "an edging entry names no ring");
    assert.ok(section.measured.rings[name], `edging names ${name}, which is not a surveyed ring`);
    assert.ok(e.why && e.why.length > 80, `${name} takes a bed edge and does not say why`);
  }
  const named = E.rings.map((e) => e.key || e.set);
  /* The two rings carried for CLIPPING only must NOT be edged: the Tea House
     island is eighthgathering's ground and the pavilion slab is paved. */
  for (const clipOnly of ["teaHouseIsland", "pavilionSlabWest"]) {
    assert.ok(!named.includes(clipOnly), `${clipOnly} is carried for clipping and must not be asserted as a bed edge`);
    assert.match(E.note, new RegExp(clipOnly), `${E.note} must say why ${clipOnly} takes no edge`);
  }
  /* The withheld ring's edge is justified in BOTH places it is claimed. */
  const wl = E.rings.find((e) => e.key === "wellnessLawn");
  assert.ok(wl, "the module still edges #1160, so the section must still declare it");
  assert.match(wl.why, /absent\[21\]|withheld|WITHHELD/i,
    "#1160's edge must point at the withholding it appears to contradict");
  const entry = section.absent.find((a) => /#1160/.test(a));
  assert.match(entry, /OUTER RING/i, "and the withholding must say that the outer boundary is a different claim");
  /* And the module must read the list rather than carry one of its own. */
  assert.match(src, /section\.edging\.rings/, "the module must take its edged rings from the section");
  assert.ok(!/measured\.rings\.wellnessLawn\.points/.test(src),
    "no ring may be edged by a lookup hard-coded in the module");
});

/* --------------------------------------- the id-dispatched arrays are consumed */

test("every stair in the section is built, or it is not a stair this section has", () => {
  /* ADDED 2026-08-19. `stairs[S6]` — the Tea House plinth steps, four figures —
     survived the "every recorded number drives geometry" gate for a year of
     edits because that gate regexes key NAMES against the module source, so
     S1's own `risers`, `riser`, `tread` and `width` excused S6's. The Tea House
     left in the arbitration and took the plinth S6 was anchored to; S6 stayed,
     unbuilt, disagreeing with eighthgathering's record of the same object.
     The stairs array is dispatched BY ID, so the ids are what must be checked. */
  const src = readFileSync(join(root, "docs/js/campus-photo-eighthcourtyards.js"), "utf8");
  for (const s of section.levelChange.stairs) {
    assert.ok(new RegExp(`"${s.id}"`).test(src),
      `stairs[${s.id}] is recorded and the module never builds it — data with no consumer`);
  }
  assert.ok(!section.levelChange.stairs.some((s) => s.id === "S6"),
    "S6 is eighthgathering.teaHouse.plinth's and must not be a second, disagreeing record here");
});

/* ------------------------------------------------- counts say what they count */

test("the reported draw count is the real one", () => {
  /* ADDED 2026-08-19. `counts.draws` summed grandchildren only, so `edge-steel`
     and `garden-band` — added straight to the top group — contributed zero and
     the reported figure was two low. */
  const { group, counts } = build();
  let meshes = 0;
  group.traverse((o) => { if (o.isMesh) meshes++; });
  assert.equal(counts.draws, meshes, "counts.draws must count every mesh, at any depth");
  assert.ok(counts.draws >= 30, `only ${counts.draws} draws`);
});
