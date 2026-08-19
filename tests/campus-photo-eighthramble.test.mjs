/* The Ramble's photo-sourced detail section, and the module that draws it.
 *
 * PHOTO-SOURCED INVENTED class, so the gates are about quarantine and about
 * not contradicting the measured world:
 *
 *   - it is labelled, epoch-stamped, sourced with DATES, and it says what it
 *     left out;
 *   - colours are data, they are hex, and every role carries its provenance;
 *   - every ring it anchors to is a VERBATIM copy of the ArcGIS survey, and
 *     every registration it claims is one campus-eighth.json actually makes;
 *   - the walk moduli it declares are recomputed here from the rings, not
 *     trusted;
 *   - nothing hovers: nothing sits below the surface past its own declared
 *     burial, nothing floats above the tallest declared object, and the clip
 *     rings are genuinely respected — the test proves the clipped region is
 *     EMPTY, not merely that a clip was declared;
 *   - nothing escapes the envelope, and no planting lands on paving;
 *   - two builds are byte-identical;
 *   - the absent list does not shrink.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(p, "utf8"));

const doc = read(join(root, "docs/data/campus-photo-detail.json"));

const section = doc.eighthramble;

const arcgis = read(join(root, "docs/data/campus-arcgis.json"));
const eighth = read(join(root, "docs/data/campus-eighth.json"));
const lidar = read(join(root, "docs/data/campus-lidar.json"));
const { makeSurfaceSampler } = await import(join(root, "docs/js/campus-terrain.js"));
const surfaceAt = makeSurfaceSampler(lidar.terrain);

/* ------------------------------------------------------------ geometry */

const surveyRing = (i) => arcgis.ground[i].r[0].map(([x, z]) => [Math.round(x) / 10, Math.round(z) / 10]);
const idx = (id) => Number(String(id).replace("arcgis.ground#", ""));
const shoelace = (r) => {
  let s = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += r[j][0] * r[i][1] - r[i][0] * r[j][1];
  return Math.abs(s / 2);
};
const inRing = (x, z, r) => {
  let ins = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, zi] = r[i];
    const [xj, zj] = r[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
};
const segDist = (px, pz, ax, az, bx, bz) => {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
};
const ringDist = (px, pz, r) => {
  let m = Infinity;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) m = Math.min(m, segDist(px, pz, r[j][0], r[j][1], r[i][0], r[i][1]));
  return m;
};
const polyDist = (A, B) => {
  let m = Infinity;
  for (const [x, z] of A) m = Math.min(m, ringDist(x, z, B));
  for (const [x, z] of B) m = Math.min(m, ringDist(x, z, A));
  return m;
};

/* --------------------------------------------------------------- gates */

test("the section exists and is reachable", () => {
  assert.ok(section, "no eighthramble section — neither merged nor on the build-side path");
});

test("it says what it is, where it came from, and what it left out", () => {
  assert.match(section.label, /Ramble/i);
  assert.match(section.label, /Eighth College|Theatre District/i);
  assert.ok(section.epoch, "no epoch stamp");
  assert.match(section.epoch, /2024|2025/, "the epoch must name the BUILT years");
  assert.match(section.note, /INVENTED/, "the note must declare the class");
  assert.match(section.note, /PARKING LOT|parking lot/,
    "the note must record that the 2014 LiDAR under this site is blind to Eighth");
  assert.ok(section.confidence && section.confidence.length > 200, "no confidence statement");
  assert.ok(Number.isInteger(section.seed), "the scatter seed must be a pinned integer");

  assert.ok(Array.isArray(section.sources) && section.sources.length >= 10,
    `only ${section.sources?.length} sources`);
  for (const s of section.sources) {
    assert.ok(s.date, `source ${s.url} carries no date`);
    assert.match(s.date, /^\d{4}(-\d{2})?(-\d{2})?$|^\d{4}-\d{4}$/, `source date "${s.date}" is not a date`);
    assert.ok(s.what && s.what.length > 20, `source ${s.url} says nothing about what it gives`);
    if (/^http/.test(s.url)) assert.match(s.url, /^https:\/\//, `${s.url} is not https`);
  }

  /* The absent list is a promise, not a draft. It may grow; it may not shrink.
     RE-BASELINED 19 -> 26, 2026-08-19. The floor was left at round one's 19
     while the list grew to 26, so the non-shrinking promise this file's header
     makes was false by seven and the gate would have tolerated silently
     dropping any of them. It is now the real length. TWO ENTRIES MOVED IN THE
     SAME EDIT and the count is unchanged by design: the stale luminaire
     SPACING entry was deleted (its 24 m / 18 m figures describe families A, B
     and C, which went to eighthsiteworks — the entry below it records the
     hand-off, so nothing is lost), and the guard's base shoes were added after
     four undeclared figures were deleted from `systems.guardrail`. */
  assert.ok(Array.isArray(section.absent) && section.absent.length >= 26,
    `absent has ${section.absent?.length} entries — better absent than wrong, and this list does not shrink`);
  for (const gap of section.absent) assert.equal(typeof gap, "string");
  /* The four entries that record real, load-bearing decisions must stay named. */
  assert.ok(section.absent.some((a) => /SWALE ITSELF/i.test(a)),
    "the unbuildable swale invert must stay in absent");
  assert.ok(section.absent.some((a) => /stairs/i.test(a)),
    "the withheld stairs must stay in absent");
  assert.ok(section.absent.some((a) => /Trees/i.test(a)),
    "trees belong to campus-trees.js and that must stay on the record");
  assert.ok(section.absent.some((a) => /golden-flowered/i.test(a)),
    "the unresolved species of a plant that IS built must stay on the record");

  /* Superseding shipped work is a claim about other people's data: it has to
     name each item and say why. */
  /* BASELINE LOWERED 30 -> 17 IN ARBITRATION, and only because this section
     stopped building the things it was claiming to replace. Lighting went to
     eighthsiteworks (pole-7, pole-8 and bollard-1..10 left with luminaire
     families A/B/C) and so did bike parking (bike-rack-b). A section may not
     claim to replace a shipped item it no longer builds — that is a false
     claim, not a stronger gate. It may not shrink again.
     THE PLANTER CUBE WAS NOT ONE OF THEM: that drop was a mistake, corrected
     below. The rule cuts both ways — a section may not claim what it does not
     build, and it MUST claim what it does. */
  /* RE-BASELINED 17 -> 18, 2026-08-19: ramble-planter-1 comes back, on
     POSITION. It was dropped with bike-rack-b on the belief that
     eighthsiteworks had taken it; eighthsiteworks' own entry is narrowed to
     the four cubes' HEIGHT and COLOUR and hands ownership back here, so
     nobody claimed the position and the shipped cube stayed at (-135.5, 602)
     inside planting bed 2703 while this section built four more — five cubes,
     one of them in a rush matrix. */
  assert.ok(Array.isArray(section.supersedes) && section.supersedes.length >= 18,
    `only ${section.supersedes?.length} supersedes entries`);
  for (const key of ["pole-7", "pole-8", "bollard-1", "bollard-10", "bike-rack-b"]) {
    assert.ok(!section.supersedes.some((s) => s.key === key),
      `${key} went to eighthsiteworks in arbitration and must not be claimed here as well`);
  }
  /* The converse, and the defect that was live: every planter cube this
     section RE-SEATS must also be claimed, or the shipped one stays where it
     is and the college ships both. */
  const cubeClaims = section.supersedes.filter((s) => s.type === "planter-cube").length;
  assert.equal(cubeClaims, section.systems.planterCubes.count,
    `${cubeClaims} shipped planter cubes are superseded but ${section.systems.planterCubes.count} are re-seated — the difference stays on screen, in the bed`);
  for (const s of section.supersedes) {
    assert.ok(s.key && s.type, "a supersedes entry with no key or type");
    assert.ok(s.why && s.why.length > 30, `${s.key} supersedes with no reason`);
  }
  assert.match(section.supersedesNote, /meditation/i,
    "the meditation-area items are another team's and that must be said");
});

test("every superseded item really exists in the shipped eighth section", () => {
  const shipped = new Map(doc.eighth.items.map((i) => [i.key, i]));
  for (const s of section.supersedes) {
    const it = shipped.get(s.key);
    assert.ok(it, `supersedes names ${s.key}, which is not in docs/data/campus-photo-detail.json eighth.items`);
    assert.equal(it.type, s.type, `${s.key} is a ${it.type}, not a ${s.type}`);
  }
  /* And it may not reach into the Meditation Pavilion, which is another
     agent's system in the same shipped list. */
  for (const s of section.supersedes) {
    assert.notEqual(shipped.get(s.key).area, "meditation",
      `${s.key} belongs to the meditation pavilion and is not this section's to remove`);
  }
});

test("colours are data, they are hex, and every role carries its provenance", () => {
  const roles = Object.keys(section.colors);
  /* RE-BASELINED 25 -> 26, 2026-08-19. The floor sat at 25 against 30 declared
     roles, so it tolerated dropping five. Four of those thirty were then found
     DEAD — lampGrey, bollardDark, bikeRackPost and bikeRackLoop, reachable
     neither as `C.<name>` in the module nor as any `color` under `systems` —
     and two of them were worse than dead: their provenance described the
     two-tone P-loop rack that this section's own `absent` records as WITHDRAWN
     as a misreading, so the file shipped measured colour for an object it
     declares does not exist. All four are deleted; 26 is the real length. */
  assert.ok(roles.length >= 26, `only ${roles.length} colours`);
  for (const [k, v] of Object.entries(section.colors)) {
    assert.match(v, /^#[0-9a-f]{6}$/, `${k} is not a lowercase 6-digit hex`);
    assert.ok(section.colorSources[k], `${k} has no colorSources entry`);
    assert.match(section.colorSources[k], /^\[(measured|sourced|estimated)\]/,
      `${k}'s provenance does not open with a tier`);
    assert.ok(section.colorSources[k].length > 40, `${k}'s provenance is a stub`);
  }
  for (const k of Object.keys(section.colorSources)) {
    assert.ok(section.colors[k], `colorSources names ${k}, which is not a colour`);
  }
  /* ADDED 2026-08-19. The bijection above is a completeness check and cannot
     see a role nothing uses — four survived the arbitration's deletions with
     full measured provenance for objects this section had stopped building.
     A colour is DATA FOR SOMETHING: every role must be reachable, either as a
     `C.<name>` reference in the module or as a colour name recorded under
     `systems` (which is how the decals, the species and the fixtures name
     theirs). An unreachable role is a claim about a thing that is not here. */
  const moduleSrc = readFileSync(join(root, "docs/js/campus-photo-eighthramble.js"), "utf8");
  const systemsJson = JSON.stringify(section.systems);
  for (const k of roles) {
    const inCode = new RegExp(`C\\.${k}\\b`).test(moduleSrc);
    const inSystems = new RegExp(`"${k}"`).test(systemsJson);
    assert.ok(inCode || inSystems,
      `colour ${k} has no consumer — it is neither C.${k} in the module nor a colour name under systems`);
  }
  /* The one colour correction this section makes against the shipped file has
     to survive: the deergrass spike measures markedly less saturated than the
     shipped generic grassStraw it replaces. */
  const sat = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return (Math.max(r, g, b) - Math.min(r, g, b)) / Math.max(1, Math.max(r, g, b));
  };
  assert.ok(sat(section.colors.muhlenbergiaSpike) < sat(doc.eighth.colors.grassStraw),
    "the measured deergrass spike must stay less saturated than the shipped grassStraw it corrects");
});

test("every ring is a VERBATIM copy of the survey, and every registration is real", () => {
  const beds = section.measured.beds;
  assert.equal(beds.length, 29, `${beds.length} beds`);
  const seen = new Set();
  for (const b of beds) {
    assert.ok(!seen.has(b.id), `${b.id} is declared twice`);
    seen.add(b.id);
    const i = idx(b.id);
    assert.ok(arcgis.ground[i], `${b.id} is not an ArcGIS ground ring`);
    assert.equal(arcgis.ground[i].k, b.kind, `${b.id} kind drifted from the survey`);
    assert.deepEqual(b.ring, surveyRing(i), `${b.id} ring is not verbatim from campus-arcgis.json`);
    assert.ok(Math.abs(shoelace(b.ring) - b.area) < 0.06, `${b.id} area ${b.area} is not its shoelace area`);
    if (b.registration) {
      const g = eighth.ground[b.registration];
      assert.ok(g, `${b.id} claims registration ${b.registration}, which campus-eighth.json does not have`);
      assert.equal(g.registration, b.id, `${b.registration} registers to ${g.registration}, not ${b.id}`);
    }
  }
  /* #1160 is the one ring campus-eighth.json does not register, and the
     section has to SAY so rather than silently inherit one. */
  const un = beds.filter((b) => !b.registration).map((b) => b.id);
  assert.deepEqual(un, ["arcgis.ground#1160"], `unregistered rings: ${un}`);
  assert.ok(section.absent.some((a) => /1160/.test(a)), "the unregistered ring must be declared");

  /* Reach membership is exactly the bed list, no more and no less. */
  const R = section.measured.reaches;
  const all = [...R.central, ...R.north, ...R.south].sort();
  assert.deepEqual(all, beds.map((b) => b.id).sort(), "the reach lists and the bed list disagree");

  for (const c of section.measured.clips) {
    assert.deepEqual(c.ring, surveyRing(idx(c.id)), `clip ${c.id} ring is not verbatim from the survey`);
    assert.ok(c.why && c.why.length > 40, `clip ${c.id} does not say why it is a clip`);
  }
  for (const br of section.measured.bridges) {
    assert.deepEqual(br.ring, surveyRing(idx(br.id)), `${br.key} ring is not verbatim from the survey`);
    assert.equal(eighth.ground[br.registration].registration, br.id);
  }
});

test("the walk moduli are recomputed, not trusted", () => {
  const bed = Object.fromEntries(section.measured.beds.map((b) => [b.id, b.ring]));
  for (const p of section.measured.walkPairs) {
    const d = polyDist(bed[p.a], bed[p.b]);
    assert.ok(Math.abs(d - p.gap) < 0.02, `${p.a} - ${p.b}: declared gap ${p.gap}, survey says ${d.toFixed(2)}`);
    const band = section.measured.walkBands.find((b) => b.band === p.band);
    assert.ok(band, `${p.a} - ${p.b} names band ${p.band}, which is not declared`);
    assert.ok(d >= band.lo && d <= band.hi, `gap ${d.toFixed(2)} is outside its own ${p.band} m band`);
    assert.equal(p.material, band.material);
  }
  /* The three narrow bands are the imperial moduli the survey actually
     clusters on — 6, 7 and 8 ft. If that stops being true the derivation
     behind every walk in this section is gone. */
  for (const [band, ft] of [[1.8, 6], [2.1, 7], [2.4, 8]]) {
    const b = section.measured.walkBands.find((x) => x.band === band);
    /* The band label is the observed CLUSTER CENTRE, so it lands a few
       centimetres under the nominal imperial width — 1.80 against 1.829 for
       6 ft. Anything further out and these are not modular walks at all. */
    assert.ok(Math.abs(band - ft * 0.3048) < 0.05, `${band} m is not ${ft} ft`);
    const n = section.measured.walkPairs.filter((p) => p.band === band).length;
    assert.ok(n >= 5, `only ${n} surveyed gaps land on the ${band} m modulus`);
  }
});

test("the two bridges are the surveyed rings, and the guard closes the code", () => {
  const [east, west] = ["ramble-bridge-east", "ramble-bridge-west"].map((k) =>
    section.measured.bridges.find((b) => b.key === k));
  assert.ok(east && west);
  /* East is a true rectangle — 98% box fill — so an 8.10 x 3.46 m OBB is a
     fair description of it. West is 59% fill and is NOT: the ring is a right
     triangle, which is the correction this section makes. */
  assert.ok(Math.abs(shoelace(east.ring) - east.obb[0] * east.obb[1]) / (east.obb[0] * east.obb[1]) < 0.05,
    "the east bridge is not the rectangle its OBB claims");
  assert.ok(shoelace(west.ring) / (west.obb[0] * west.obb[1]) < 0.7,
    "the west bridge would be a rectangle, which contradicts the section's own correction");
  assert.match(west.source, /TRIANGLE/i, "the west deck's shape correction must stay on the record");

  const G = section.systems.guardrail;
  assert.ok(Math.abs(G.height - 1.066) < 0.001, "the measured 42 in guard height drifted");
  assert.ok(G.picketPitch - G.picketDiameter <= 0.102 + 1e-9,
    `clear opening ${(G.picketPitch - G.picketDiameter).toFixed(3)} m fails the 102 mm sphere of CBC 1015.4`);
  assert.ok(Math.abs(G.clearOpening - (G.picketPitch - G.picketDiameter)) < 1e-9,
    "the declared clear opening is not pitch minus tube");
  assert.ok(G.topRailDiameter > G.picketDiameter, "the top rail must read larger than the pickets");
  assert.ok(G.bottomRailHeight > 0 && G.bottomRailHeight < 0.1, "the bottom rail sits just off the deck");
  /* The base shoes are RETIRED (2026-08-19): `shoeSpacing: 1.5` and
     `shoe: [0.11, 0.012, 0.11]` were four figures with no source, no
     derivation and no place in the canonical spec `specOwnerNote` enumerates,
     and a shoe at 1.5 m centres aligns with nothing in a guard whose only
     declared members are pickets at 0.1016 m and two rails. They must not
     creep back undeclared. */
  for (const k of ["shoe", "shoeSpacing"]) {
    assert.equal(G[k], undefined, `guardrail.${k} is back — it was retired for having no derivation`);
  }
  assert.ok(section.absent.some((a) => /BASE SHOES/i.test(a)), "the shoe retirement must stay on the record");
  /* Every opening index must be a real segment of its own ring. */
  for (const br of section.measured.bridges) {
    for (const i of br.openings) {
      assert.ok(i >= 0 && i < br.ring.length - 1, `${br.key} opening ${i} is not a ring segment`);
    }
  }
});

test("the planting is species, not cones, and every estimate names what it extends", () => {
  const P = section.systems.planting;
  const S = P.species;
  for (const key of ["juncus", "muhlenbergia", "verbena", "golden"]) {
    assert.ok(S[key].taxon, `${key} has no taxon`);
    assert.ok(S[key].diagnostic && S[key].diagnostic.length > 60,
      `${key} has no diagnostic — an unidentified cone is exactly what this section replaces`);
    assert.ok(Array.isArray(S[key].sources) && S[key].sources.length >= 1);
  }
  /* The Juncus identification rests entirely on the LATERAL inflorescence, so
     the module has to model it where the plant bears it. */
  assert.ok(S.juncus.inflorescenceAt > 0.6 && S.juncus.inflorescenceAt < 0.9,
    "the lateral inflorescence must sit about three quarters up the culm");
  assert.match(S.juncus.diagnostic, /LATERAL/i);
  /* Deergrass is only deergrass if the spikes stand well clear of the blades. */
  assert.ok(Math.abs(S.muhlenbergia.spikeHeight / S.muhlenbergia.foliageHeight - S.muhlenbergia.spikeRatio) < 0.06,
    "the measured 1.5:1 spike-to-foliage ratio does not hold");
  /* The golden subshrub ships as a FORM with an unresolved taxon, and says so. */
  assert.match(S.golden.tier, /unresolved/i);
  assert.ok(S.golden.candidates.length >= 3, "the unresolved taxon must list its candidates");
  /* Every estimated taxon names the sourced pattern it extends. */
  for (const key of ["dianella", "baccharis", "agave"]) {
    assert.equal(S[key].tier, "estimated", `${key} must ship labelled estimated`);
    assert.ok(S[key].extendsPattern && S[key].extendsPattern.length > 40,
      `${key} is estimated and does not name the pattern it extends`);
  }
  /* Agave and Baccharis are photographed only in the wash, never in mulch. */
  assert.equal(S.agave.inWashOnly, true);
  assert.equal(S.baccharis.inWashOnly, true);
  /* The mix is a partition, and it leaves bare ground — the 2024 frames all
     show mulch and rock between plants. */
  const total = P.mix.reduce((s, m) => s + m.weight, 0);
  assert.ok(Math.abs(total - 1) < 1e-9, `the planting mix sums to ${total}`);
  assert.ok(P.mix.find((m) => m.species === "bare").weight > 0.2, "the mix must leave bare ground");
  /* Estimated SYSTEMS carry the same obligation. */
  for (const [key, sys] of Object.entries(section.systems)) {
    if (sys.tier !== "estimated") continue;
    assert.ok(sys.extendsPattern && sys.extendsPattern.length > 40,
      `system ${key} is estimated and does not name the pattern it extends`);
  }
  assert.match(section.systems.arroyo.formNote, /^\[estimated\]/,
    "the derived braid centreline must be labelled estimated");
});

test("what is withheld keeps its whole schedule, so nobody re-derives it", () => {
  const W = section.withheld;
  assert.ok(W.note.length > 200, "the withheld block must say why");
  assert.match(W.note, /parking lot/i);
  assert.ok(W.stairs.riser > 0.1 && W.stairs.riser < 0.18, "the CBC riser envelope");
  assert.ok(W.stairs.tread >= 0.279, "the CBC minimum tread");
  assert.ok(W.stairs.derivation.length > 200, "the riser/tread derivation must survive");
  assert.ok(W.retainingAndSeatWalls.stuccoColourShade && W.retainingAndSeatWalls.stuccoColourSun);
  assert.ok(W.rampedWalks.slope <= 0.05, "the ADA maximum without landings");
});

/* ------------------------------------------------ the module, run for real */

const build = () =>
  import("../docs/js/campus-photo-eighthramble.js").then(({ createPhotoEighthRamble }) =>
    createPhotoEighthRamble(null, { photo: { eighthramble: section }, heightAt: (x, z) => surfaceAt(x, z) - 0.2, surfaceAt })
  );

/** Every instance transform in the group, as {name, x, y, z, sx, sy, sz}. */
function instances(r) {
  const out = [];
  for (const c of r.group.children) {
    if (!c.isInstancedMesh) continue;
    const m = c.instanceMatrix.array;
    for (let i = 0; i < c.count; i++) {
      const o = i * 16;
      out.push({
        name: c.name,
        x: m[o + 12], y: m[o + 13], z: m[o + 14],
        sx: Math.hypot(m[o], m[o + 1], m[o + 2]),
        sy: Math.hypot(m[o + 4], m[o + 5], m[o + 6]),
        sz: Math.hypot(m[o + 8], m[o + 9], m[o + 10]),
        /* WORLD vertical half-extent. Reading it off the local Y column is
           wrong the moment anything is laid on its side — a 3 m top rail
           rotated flat would read as a 3 m tall object sinking 1.5 m into the
           ground. Every primitive this module uses is bounded by the unit
           cube, so the second ROW of the 3x3 bounds the world Y reach. */
        halfY: 0.5 * (Math.abs(m[o + 1]) + Math.abs(m[o + 5]) + Math.abs(m[o + 9])),
      });
    }
  }
  return out;
}

/** Every draped vertex the module emits. */
function drapeVerts(r) {
  const out = [];
  for (const c of r.group.children) {
    if (c.isInstancedMesh || !c.geometry?.attributes?.position) continue;
    const p = c.geometry.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) out.push([p[i], p[i + 1], p[i + 2], c.name]);
  }
  return out;
}

test("the module builds it, and two builds are byte-identical", async () => {
  const THREE = await import("../docs/vendor/three/three.module.min.js");
  const a = await build();
  const b = await build();
  assert.ok(a.group instanceof THREE.Group);
  assert.deepEqual(a.counts, b.counts, "the counts moved between two builds");
  const mats = (r) =>
    r.group.children.filter((c) => c.isInstancedMesh).map((c) => [c.name, Array.from(c.instanceMatrix.array)]);
  assert.deepEqual(mats(a), mats(b), "two builds must be byte-identical");
  const drapes = (r) =>
    r.group.children.filter((c) => !c.isInstancedMesh).map((c) => [c.name, Array.from(c.geometry.attributes.position.array)]);
  assert.deepEqual(drapes(a), drapes(b), "the draped surfaces must be byte-identical too");

  const raw = readFileSync(join(root, "docs/js/campus-photo-eighthramble.js"), "utf8");
  /* Scan the CODE, not the prose — the header rightly names what it does not use. */
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/Math\.random|Date\.now|new Date/.test(src), "no nondeterminism in the builder");
  assert.match(src, /(?:shared|create)MaterialLibrary/, "surfaces come from campus-materials.js");
  assert.match(src, /overlayLift|applyOverlayDepth/, "ground decals ride the shared overlay ladder");
  assert.ok(!/#[0-9a-fA-F]{6}/.test(src), "colours are DATA — no hex literal may appear in the module");
  assert.ok(!/\b(lift|polygonOffset)\s*[:=]\s*0?\.\d/.test(src), "no local lift or polygon-offset constant");
});

test("the counts are what the section declares", async () => {
  const r = await build();
  const c = r.counts;
  /* Two rings are in `beds` for their GEOMETRY but have their SURFACE
     withheld — #2369 is the Sun Lawn and #1160 carries two surfaces with an
     unresolved edge — so the mulch count is the beds this section may paint. */
  assert.equal(c.mulchBeds, section.measured.beds.filter((b) => !b.surfaceWithheld).length);
  assert.equal(section.measured.beds.filter((b) => b.surfaceWithheld).length, 2,
    "exactly two bed surfaces are withheld, and each must say why");
  for (const b of section.measured.beds.filter((x) => x.surfaceWithheld)) {
    assert.ok(b.withheldReason && b.withheldReason.length > 80,
      `${b.id} withholds its surface without saying why`);
  }
  assert.equal(c.bridges, section.measured.bridges.length);
  assert.equal(c.planterCubes, section.systems.planterCubes.count);
  assert.equal(c.utilityCabinets, section.systems.minorFixtures.utilityCabinet.count);
  assert.equal(c.fdcBollards, section.systems.minorFixtures.fdcBollard.count);
  assert.equal(c.wayfindingColumns, section.systems.minorFixtures.wayfindingColumn.count);
  assert.equal(c.areaDrains, section.systems.areaDrains.swaleCount + section.systems.areaDrains.paveCount);
  assert.equal(c.walks, section.measured.walkPairs.length,
    "every declared walk pair must resolve to a built strip — a pair that builds nothing is a dead claim");
  /* Every species the section declares actually grows. */
  for (const key of Object.keys(section.systems.planting.species)) {
    const n = key === "juncusElkBlue" ? c.plants.juncusElkBlue : c.plants[key];
    assert.ok(n > 0, `${key} is declared and nothing was planted`);
  }
  /* A DENSITY, not a headcount. Two bed surfaces are withheld in arbitration
     (#2369 the Sun Lawn, #1160 two surfaces with an unresolved edge), which
     takes 1,873.5 m2 out of what this section may plant. The old absolute
     floor of 4,000 plants over the full 4,964.6 m2 is 0.806 plants/m2; the
     gate is now that same density over the area that is actually plantable,
     so withholding a bed cannot buy a thinner matrix. */
  const plantable = section.measured.beds
    .filter((b) => !b.surfaceWithheld)
    .reduce((s, b) => s + b.area, 0);
  assert.ok(c.plantTotal / plantable > 0.806,
    `only ${c.plantTotal} plants over ${plantable.toFixed(1)} m2 of plantable surveyed bed`);
  assert.ok(c.pickets > 150, "the guard is built for real, picket by picket");
  /* The `guardShoes > 0` half of this gate went with the shoes themselves
     (2026-08-19 — four undeclared figures, retired to `absent`). What replaces
     it is strictly stronger and lives in its own test above: the built rail
     top, the built rail centre and the built picket top are each checked
     against the canonical spec to 1e-9. */
  assert.equal(c.guardRails, c.guardRuns * 2,
    "every guard run carries a top rail AND the bottom rail the shipped model lacks");

  /* ADDED 2026-08-19 — DECLARED SURFACES MAY NOT SHIP EMPTY. Round one proved
     by mutation that the arroyo could be deleted outright (all 249 quads) and
     the check weirs zeroed with the whole suite still green: `washQuads` and
     `checkWeirs` were never asserted, the clip and bed loops are vacuous over
     an empty vertex list, and 36k plant instances swamp the instance floor.
     The arroyo is this section's self-described signature surface. */
  assert.ok(c.washQuads > 100,
    `the arroyo braid drapes ${c.washQuads} quads — the signature surface of this section may not silently vanish`);
  assert.ok(c.walkQuads > 0, "the derived walks must actually drape paving, not just resolve");
  /* And the counts must be the GEOMETRY, not a parallel counter beside it:
     disabling the wash decal while leaving `washQuads++` in place left the
     count at 249 with nothing drawn. Every draped class this section declares
     must reach the scene with vertices in it. */
  const draped = new Map(r.group.children
    .filter((ch) => !ch.isInstancedMesh)
    .map((ch) => [ch.name, ch.geometry.attributes.position.count]));
  for (const cls of ["ramble-lavaRock", "ramble-barkEucalyptus", "ramble-decomposedGranite", "ramble-smoothConcrete"]) {
    assert.ok(draped.get(cls) > 0, `${cls} is declared and drapes no vertices`);
  }
  assert.equal(draped.get("ramble-lavaRock") / 6, c.washQuads,
    "washQuads must be read off the emitted wash geometry, not counted beside it");
  assert.ok(c.checkWeirs > 0, "the check weirs are a declared system and must build");
  /* Every declared species part, not just the clump — see the planting test. */
  /* Instancing: a landscape this size may not cost more than a few dozen draws. */
  /* BASELINE LOWERED 40,000 -> 34,000 IN ARBITRATION: 1,873.5 m2 of bed had
     its surface withheld (#2369 and #1160), which is 38% of the surveyed bed
     area, and three luminaire families and a bike-rack run left for
     eighthsiteworks. The density gate above is what protects the matrix; this
     one only protects the instancing. */
  assert.ok(c.instances > 34000, `only ${c.instances} instances`);
  assert.ok(c.draws < 60, `${c.draws} draw calls — this must stay instanced`);
});

/* ADDED 2026-08-19. The declaration gates above check that 1.067 m is in the
   DATA; nothing checked what the module did with it, and it did two things
   wrong. The datum is deck-to-TOP-OF-RAIL — eighthsiteworks owns this spec and
   builds the rail centre at `height - topRail.thickness / 2` with pickets
   stopping at `height - topRail.thickness` — while this section put the rail
   CENTRE at `height` (a 1.091 m guard, 24 mm proud of the canonical figure)
   and ran the pickets to `height`, 48 mm into the rail's lower half. Two
   implementations of one canonical spec may not disagree, so the gate is on
   the BUILT scene: the rail's top and the picket's top, measured off the
   ground the module actually sampled. */
test("the built guard is the canonical 1.067 m to the TOP of the rail, and no picket runs into it", async () => {
  const r = await build();
  const G = section.systems.guardrail;
  const deckT = section.systems.bridges.deckEdgeBeam;
  const byName = (n) => instances(r).filter((it) => it.name === n);

  const tops = byName("guard-rail-top");
  const bottoms = byName("guard-rail-bottom");
  const pickets = byName("guard-picket");
  assert.ok(tops.length > 0 && bottoms.length > 0 && pickets.length > 0,
    "the guard must build both rails and its pickets");
  assert.equal(tops.length, bottoms.length, "every run carries a top rail AND a bottom rail");
  assert.equal(tops.length + bottoms.length, r.counts.guardRails);

  /* Each rail is placed at its own run's midpoint, so surfaceAt at the
     instance's own x/z is exactly the height the module sampled: this is an
     EQUALITY check, and EPS is float32, not slack. InstancedMesh stores its
     matrices in a Float32Array, so a coordinate around 100 m carries about
     1e-5 m of representation error. 0.5 mm is two orders below the 24 mm and
     48 mm errors this test exists to catch, and forty times above the noise. */
  const EPS = 5e-4;
  for (const it of tops) {
    const railTop = it.y - surfaceAt(it.x, it.z) - deckT + G.topRailDiameter / 2;
    assert.ok(Math.abs(railTop - G.height) < EPS,
      `the top rail's TOP stands ${railTop.toFixed(4)} m over the deck, not the canonical ${G.height} m`);
  }
  for (const it of bottoms) {
    const centre = it.y - surfaceAt(it.x, it.z) - deckT;
    assert.ok(Math.abs(centre - G.bottomRailHeight) < EPS,
      `the bottom rail's centre stands ${centre.toFixed(4)} m over the deck, not ${G.bottomRailHeight} m`);
  }
  /* A picket ends at the rail's UNDERSIDE: flush, so it neither hovers under
     the rail nor penetrates it. */
  const railUnderside = G.height - G.topRailDiameter;
  for (const it of pickets) {
    assert.ok(Math.abs(it.sy - railUnderside) < EPS,
      `a picket is ${it.sy.toFixed(4)} m long against a ${railUnderside.toFixed(4)} m clear height under the rail`);
    const top = it.y + it.sy / 2 - surfaceAt(it.x, it.z) - deckT;
    assert.ok(Math.abs(top - railUnderside) < EPS,
      `a picket top reaches ${top.toFixed(4)} m over the deck; the rail's underside is at ${railUnderside.toFixed(4)} m`);
  }

  /* And the retired shoes are really gone from the scene, not just the data. */
  assert.equal(byName("guard-shoe").length, 0, "the retired base shoes are still being built");
  assert.equal(r.counts.guardShoes, undefined, "counts still reports a retired family");
});

/* ADDED 2026-08-19. "The planting is species, not cones" asserts only DATA —
   round one proved by mutation that every diagnostic part could be zeroed
   (juncus-seed, deergrass-spike, verbena-umbel, golden-raceme, agave-spine),
   leaving bare culms and blades, with all 17 tests still green. The section's
   headline claim was ungated. This gates the BUILT parts: each diagnostic
   feature must be built once per clump per its declared multiplicity, and the
   two features that carry the two safest identifications — the Juncus's
   LATERAL inflorescence and the deergrass spike standing clear of the blade —
   must be where the plant actually bears them. */
test("every diagnostic part is built, on every clump, where the plant bears it", async () => {
  const r = await build();
  const c = r.counts;
  const S = section.systems.planting.species;
  const part = {};
  for (const it of instances(r)) part[it.name] = (part[it.name] || 0) + 1;

  /* Exact multiplicities: one part per clump per declared count. A zeroed
     feature fails here, and so does a feature quietly built on a fraction. */
  assert.equal(part["deergrass-spike"], c.plants.muhlenbergia * S.muhlenbergia.spikes,
    "the deergrass spikes are the read of this plant and every clump must carry its declared number");
  assert.equal(part["deergrass-blade"], c.plants.muhlenbergia * S.muhlenbergia.blades);
  assert.equal(part["verbena-umbel"], c.plants.verbena * S.verbena.umbels,
    "the flat-topped lilac umbel is Verbena lilacina's diagnostic");
  assert.equal(part["golden-raceme"], c.plants.golden * S.golden.branches,
    "one raceme per branch tip — the feature that makes the golden subshrub read at 40 m");
  assert.equal(part["golden-branch"], c.plants.golden * S.golden.branches);
  assert.equal(part["agave-spine"], c.plants.agave * S.agave.leaves,
    "the terminal spine is what makes the genus legible");
  assert.equal(part["agave-leaf"], c.plants.agave * S.agave.leaves);
  assert.equal(part["dianella-leaf"], c.plants.dianella * S.dianella.leaves);
  assert.equal(part["juncus-culm"] + part["juncus-culm-elkblue"],
    (c.plants.juncus + c.plants.juncusElkBlue) * S.juncus.culms);
  /* Juncus bears its inflorescence on about half the clumps in the frames, so
     the count is not one per clump — but it is always a whole number of
     clusters, and it may never be zero. */
  assert.ok(part["juncus-seed"] > 0, "the LATERAL inflorescence is the whole Juncus identification");
  assert.equal(part["juncus-seed"] % S.juncus.seedClusters, 0,
    "the seed clusters are emitted a full clump at a time");

  /* WHERE it sits, not just that it exists. `inflorescenceAt` is 0.75 of a
     0.60-0.90 m culm, so every seed cluster stands 0.45-0.675 m over the
     ground. The 0.05 m slack is terrain, not tolerance: a cluster is thrown up
     to 0.15 m off its clump's centre and `surfaceAt` is sampled here at the
     cluster, where the module sampled it at the clump. A terminal head — the
     cone this section exists to replace — lands at the culm TOP and fails. */
  const lo = S.juncus.height[0] * S.juncus.inflorescenceAt - 0.05;
  const hi = S.juncus.height[1] * S.juncus.inflorescenceAt + 0.05;
  for (const it of instances(r)) {
    if (it.name !== "juncus-seed") continue;
    const h = it.y - surfaceAt(it.x, it.z);
    assert.ok(h >= lo && h <= hi,
      `a Juncus inflorescence sits ${h.toFixed(3)} m up, outside the lateral ${lo.toFixed(2)}-${hi.toFixed(2)} m band`);
  }

  /* Deergrass is only deergrass if the spikes stand WELL CLEAR of the blades.
     The declared 1.5:1 makes that a separation, so the lowest spike tip in the
     whole matrix must still be above the highest blade tip. */
  let minSpike = Infinity, maxBlade = -Infinity;
  for (const it of instances(r)) {
    const top = it.y + it.halfY - surfaceAt(it.x, it.z);
    if (it.name === "deergrass-spike") minSpike = Math.min(minSpike, top);
    if (it.name === "deergrass-blade") maxBlade = Math.max(maxBlade, top);
  }
  assert.ok(minSpike > maxBlade,
    `the lowest deergrass spike (${minSpike.toFixed(2)} m) does not clear the tallest blade (${maxBlade.toFixed(2)} m) — that is a bunchgrass cone, not Muhlenbergia rigens`);

  /* The one sourced COUNT this section holds for a plant: `countCentral` is
     "~12 legible in the central reach" across phf44 and SWA -5/-6, and the
     section's own countCentralNote says the test checks the build against it
     rather than trusting it. It said so while nothing checked. A photographic
     count is a FLOOR — occluded rosettes are not in it — so the band is
     one-sided-generous, but it still fails a lattice that has drifted into a
     hedge or emptied out. */
  const declared = S.agave.countCentral;
  assert.ok(Math.abs(c.agaveCentral - declared) <= 3,
    `${c.agaveCentral} agaves built in the central reach against a sourced ~${declared}`);
});

test("the boulder drift matches the sourced count band in the reach it was read from", async () => {
  const r = await build();
  const beds = section.measured.beds;
  const central = new Set(section.measured.reaches.central);
  let n = 0;
  for (const it of instances(r)) {
    if (it.name !== "ramble-boulder") continue;
    const bed = beds.find((b) => inRing(it.x, it.z, b.ring));
    if (bed && central.has(bed.id)) n++;
  }
  assert.ok(n >= 60 && n <= 90,
    `${n} boulders in the central reach — SWA -2 reads 60-90 there, and the shipped model had ~20 in total`);
  /* And every one is bedded: a third of the vertical axis below grade. */
  for (const it of instances(r)) {
    if (it.name !== "ramble-boulder") continue;
    const g = surfaceAt(it.x, it.z);
    const semi = it.halfY;
    const buried = g - (it.y - semi);
    assert.ok(buried > semi * 0.5 && buried < semi * 0.85,
      `a boulder is buried ${(buried / semi).toFixed(2)} of its semi-axis, not the sourced third of the axis`);
    assert.ok(it.sx >= 0.6 - 1e-6 && it.sx <= 1.6 + 1e-6, `boulder long axis ${it.sx.toFixed(2)} m is off the sourced band`);
  }
});

test("the clip rings are EMPTY — the clip is proved, not merely declared", async () => {
  const r = await build();
  const clips = section.measured.clips;
  const bed2703 = section.measured.beds.find((b) => b.id === "arcgis.ground#2703");

  /* The clip is load-bearing, not decorative: the east bridge is a NOTCH cut
     out of bed 2703, so it lies inside that bed's bounding box while lying
     outside its ring. A bounding-box fill would stand plants on the deck. */
  const c4039 = clips.find((c) => c.id === "arcgis.ground#4039");
  const bb = bed2703.ring.reduce((a, [x, z]) => ({
    x0: Math.min(a.x0, x), x1: Math.max(a.x1, x), z0: Math.min(a.z0, z), z1: Math.max(a.z1, z),
  }), { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity });
  for (const [x, z] of c4039.ring) {
    assert.ok(x >= bb.x0 && x <= bb.x1 && z >= bb.z0 && z <= bb.z1,
      "the east bridge should lie inside bed 2703's bounding box");
    assert.ok(!inRing(x, z, bed2703.ring), "and outside its ring — that is what makes it a notch");
  }

  /* Nothing planted, no boulder and no fixture may land in any clip. */
  const planted = /juncus|deergrass|verbena|golden|dianella|baccharis|agave|boulder|planter|bollard|lampB|utility|fdc|wayfinding/;
  for (const it of instances(r)) {
    if (!planted.test(it.name)) continue;
    for (const c of clips) {
      assert.ok(!inRing(it.x, it.z, c.ring), `${it.name} at (${it.x.toFixed(1)}, ${it.z.toFixed(1)}) is inside clip ${c.id}`);
    }
  }
  /* And no bed or wash decal paints over one either. This is a TRIANGLE test,
     not a vertex test: the beds notch around the bridges and literally share
     ring vertices with them, so a vertex on the shared edge is correct. */
  for (const c of r.group.children) {
    if (c.isInstancedMesh || !/barkEucalyptus|lavaRock/.test(c.name)) continue;
    const p = c.geometry.attributes.position.array;
    for (let i = 0; i + 8 < p.length; i += 9) {
      const cx = (p[i] + p[i + 3] + p[i + 6]) / 3;
      const cz = (p[i + 2] + p[i + 5] + p[i + 8]) / 3;
      for (const cl of clips) {
        assert.ok(!inRing(cx, cz, cl.ring),
          `${c.name} paints inside clip ${cl.id} at (${cx.toFixed(1)}, ${cz.toFixed(1)})`);
      }
    }
  }
});

test("planting stays in the beds and paving stays out of them", async () => {
  const r = await build();
  const rings = section.measured.beds.map((b) => b.ring);
  const inAnyBed = (x, z) => rings.some((rg) => inRing(x, z, rg));

  /* Every plant that has a single trunk point — the mounds and the boulders —
     stands inside a surveyed bed. (Culms, blades and leaves are offset off
     their own clump centre and are checked by the envelope gate instead.) */
  for (const it of instances(r)) {
    if (!/verbena-mound|baccharis-mound|ramble-boulder/.test(it.name)) continue;
    assert.ok(inAnyBed(it.x, it.z), `${it.name} at (${it.x.toFixed(1)}, ${it.z.toFixed(1)}) is not in a surveyed bed`);
  }

  /* The derived walks are the GAPS between beds. If a walk triangle's centroid
     lands inside a bed, the derivation has crossed a third polygon and the
     paving is being painted over a planting bed. */
  for (const c of r.group.children) {
    if (c.isInstancedMesh || !/decomposedGranite|smoothConcrete/.test(c.name)) continue;
    const p = c.geometry.attributes.position.array;
    for (let i = 0; i + 8 < p.length; i += 9) {
      const cx = (p[i] + p[i + 3] + p[i + 6]) / 3;
      const cz = (p[i + 2] + p[i + 5] + p[i + 8]) / 3;
      assert.ok(!inAnyBed(cx, cz), `${c.name} paves over a bed at (${cx.toFixed(1)}, ${cz.toFixed(1)})`);
    }
  }

  /* The wash is clipped to the survey: every crushed-rock vertex is in a bed. */
  for (const [x, , z, name] of drapeVerts(r)) {
    if (!/lavaRock/.test(name)) continue;
    assert.ok(inAnyBed(x, z) || rings.some((rg) => ringDist(x, z, rg) < 0.05),
      `the arroyo escapes the survey at (${x.toFixed(1)}, ${z.toFixed(1)})`);
  }
});

test("nothing hovers and nothing sinks", async () => {
  const r = await build();
  const B = section.systems.boulders;
  const deckT = section.systems.bridges.deckEdgeBeam;
  /* The tallest thing this section builds, now that the luminaires have gone
     to eighthsiteworks, is the 2.40 m wayfinding column.
     PINNED 2026-08-19. Round one proved this ceiling was self-referential: it
     is read off the very object it bounds, so setting the column's height to
     30 m in the section raised the ceiling to 30 m and every hover check went
     vacuous — with the suite still green. The section's own `sizeSource` says
     "the test pins it rather than reading it"; it said so while nothing
     pinned it. 2.40 m is the declared and derived figure, and the guardrail
     above is pinned the same way. */
  const columnHeight = section.systems.minorFixtures.wayfindingColumn.size[1];
  assert.ok(Math.abs(columnHeight - 2.4) < 0.05,
    `the wayfinding column is ${columnHeight} m — it is the hover ceiling and may not be raised by the thing it bounds`);
  const ceiling = columnHeight + 0.2;

  for (const it of instances(r)) {
    const g = surfaceAt(it.x, it.z);
    const half = it.halfY;
    const bottom = it.y - half;
    /* Burial is DECLARED, per class: boulders and mounds are bedded a third of
       their axis; everything else stands on the ground or on a deck. */
    const allow = /boulder/.test(it.name)
      ? half * B.buriedFraction * 2.6
      : /mound/.test(it.name)
        ? half * 0.65
        : /leaf|blade|culm|spike|branch|raceme|umbel|seed/.test(it.name)
          ? half * 1.05
          : 0.08;
    assert.ok(bottom >= g - allow - 1e-6,
      `${it.name} sinks to ${(g - bottom).toFixed(2)} m below the drawn ground, past its declared burial`);
    assert.ok(it.y - g <= ceiling + deckT,
      `${it.name} floats at ${(it.y - g).toFixed(2)} m above the ground, over the tallest declared object`);
  }

  /* Every draped surface sits on its rung of the shared ladder, no higher —
     except the two bridge decks, which are real slabs standing on grade. */
  const { OVERLAY } = await import("../docs/js/campus-overlay.js");
  const top = Math.max(...Object.values(OVERLAY).map((o) => o.lift));
  for (const [x, y, z, name] of drapeVerts(r)) {
    const g = surfaceAt(x, z);
    const cap = /deck/.test(name) ? deckT + 1e-6 : top + 1e-6;
    assert.ok(y - g >= -1e-6 && y - g <= cap,
      `${name} sits ${(y - g).toFixed(3)} m off the ground, off its own rung`);
  }
});

test("nothing escapes the envelope", async () => {
  const r = await build();
  const b = section.bounds;
  /* The declared bounds must actually contain the survey they claim to. */
  for (const bed of section.measured.beds) {
    for (const [x, z] of bed.ring) {
      assert.ok(x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1, `${bed.id} runs outside the declared bounds`);
    }
  }
  for (const it of instances(r)) {
    assert.ok(it.x >= b.x0 && it.x <= b.x1 && it.z >= b.z0 && it.z <= b.z1,
      `${it.name} at (${it.x.toFixed(1)}, ${it.z.toFixed(1)}) is outside ${JSON.stringify(b)}`);
  }
  for (const [x, , z, name] of drapeVerts(r)) {
    assert.ok(x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1, `${name} escapes the envelope`);
  }
});

test("nothing invented sits inside a measured building footprint", async () => {
  /* The authority for Eighth is the ARCGIS facilities survey, not OSM: the
     2014 LiDAR has no height for a single TDLLN mass, so campus-massing
     extrudes the ArcGIS ring, and campus-3d.json's 9-point simplified
     "Sankofa" blob swallows six of the surveyed planting beds this section is
     anchored to. That conflict is real and is declared in `absent`; it is
     pinned here so nobody later "fixes" this section against the wrong ring. */
  const campus = read(join(root, "docs/data/campus-3d.json"));
  const swallowed = new Set();
  for (const n of ["Sankofa", "Azad", "Pulse", "Podemos"]) {
    const osm = campus.buildings.find((x) => x.n === n);
    for (const b of section.measured.beds) {
      if (b.ring.some(([x, z]) => inRing(x, z, osm.p))) swallowed.add(b.id);
    }
  }
  assert.equal(swallowed.size, 7,
    `the OSM rings swallow ${swallowed.size} surveyed beds, not the 7 this section declares — re-check \`absent\``);
  assert.ok(section.absent.some((a) => /SWALLOW SEVEN OF THE SURVEYED BEDS/.test(a)),
    "that conflict must stay on the record");

  /* arcgis.massing[i].r is an array of RINGS, like ground[] — not a ring. The
     masses this section carries are verbatim copies, and each one records
     whether it swallows a surveyed ground feature. A ring that does is NOT a
     usable footprint gate: the ArcGIS ground and massing layers contradict
     each other over this site, and that conflict is declared, not silently
     resolved in either direction. */
  const massing = [];
  for (const m of section.measured.masses) {
    const i = Number(String(m.id).replace("arcgis.massing#", ""));
    assert.deepEqual(m.ring, arcgis.massing[i].r[0].map(([x, z]) => [Math.round(x) / 10, Math.round(z) / 10]),
      `${m.id} ring is not verbatim from campus-arcgis.json massing[]`);
    /* The GIS height is a formula, not a survey, and the section says so. */
    if (m.levels && m.name !== "TDLLN - Sankofa Base") {
      assert.ok(Math.abs(m.gisHeight / m.levels - 3.048) < 0.01,
        `${m.name} h/levels is ${(m.gisHeight / m.levels).toFixed(3)}, not the 10 ft formula the note declares`);
    }
    /* Recompute the swallow count rather than trusting it. */
    const ground = [...section.measured.beds.map((b) => b.ring), ...section.measured.clips.map((c) => c.ring)];
    const n = ground.filter((gr) => gr.some(([x, z]) => inRing(x, z, m.ring))).length;
    assert.equal(n, m.swallowsSurveyedGround, `${m.name} swallow count drifted`);
    assert.equal(m.clearance, n === 0, `${m.name} clearance flag disagrees with its own swallow count`);
    if (m.clearance) massing.push({ n: m.name, ring: m.ring });
  }
  assert.equal(massing.length, 4, `${massing.length} masses are usable footprint gates`);
  const coarse = section.measured.masses.filter((m) => !m.clearance).map((m) => m.name);
  assert.deepEqual(coarse.sort(), ["TDLLN - Sankofa Base", "TDLLN - Sankofa Mid"]);
  assert.ok(section.absent.some((a) => /SURVEY vs SURVEY/.test(a)),
    "the ground-vs-massing conflict must stay on the record");
  assert.match(section.measured.massNote, /clearance/);

  const r = await build();
  const pts = [
    ...instances(r).map((i) => [i.x, i.z, i.name]),
    ...drapeVerts(r).map((v) => [v[0], v[2], v[3]]),
  ];
  for (const [x, z, name] of pts) {
    for (const bld of massing) {
      assert.ok(!inRing(x, z, bld.ring),
        `${name} at (${x.toFixed(1)}, ${z.toFixed(1)}) is inside the surveyed mass ${bld.n || "(unnamed)"}`);
    }
  }
});
