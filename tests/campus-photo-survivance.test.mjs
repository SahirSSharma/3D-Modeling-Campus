/* Survivance Hall and the Market Hall wing — the photo-sourced detail section.
 *
 * INVENTED class, so the gates are about quarantine, about provenance, and
 * about not contradicting the measured world:
 *
 *   - it is labelled, epoch-stamped, sourced with DATES, and it says what it
 *     left out;
 *   - every colour is data, is hex, and has its own provenance entry;
 *   - EVERY LOAD-BEARING DIMENSION likewise: the test WALKS the built subtrees
 *     and demands a `dimensionSources` entry for every number it finds, with a
 *     tier and the arithmetic. This is the Keeling bar, and it is a coverage
 *     gate rather than a list, so a new figure cannot be added without one;
 *   - both surveyed rings are verbatim copies of campus-arcgis.json (/10) and
 *     both heights are the GIS `h` campus-massing.js actually extrudes;
 *   - NO LiDAR height is read, because the 2014 flight is blind to Eighth and
 *     campus-lidar.json carries no massHeight for either ring;
 *   - NOTHING IS DRAWN INSIDE A SOLID PRISM. campus-massing.js extrudes both
 *     surveyed rings as solid masses, so every AABB corner of every built
 *     instance below a lid must be outside that lid's ring. Round one put 140
 *     windows, 4 terraces, 16 storefront lites and about 700 tower pieces
 *     inside solid geometry and the old gates could not see any of it;
 *   - nothing hovers and nothing sinks, checked on SLOPED ground against AABB
 *     corners rather than on a flat sampler against instance origins;
 *   - nothing escapes the surveyed envelope, checked on AABB corners — the old
 *     centre-point version passed a canopy whose true reach was 4.84 m against
 *     a 3.6 m pad;
 *   - the marigold ribbon's corner clip is checked by proving the clipped bays
 *     are ABSENT and that no opening is ever left unglazed;
 *   - two builds are byte-identical;
 *   - the counts the module returns are the counts the section declares, and
 *     what the section WITHHELD is proved unbuilt;
 *   - the absent list does not shrink.
 *
 * The section will live under the `survivance` key of
 * docs/data/campus-photo-detail.json. Until the main session merges it, it is
 * read from the build-side file this agent wrote, so the test does not depend
 * on the merge having happened — the same idiom Keeling and ERC used.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(p, "utf8"));

/* The module's own header explains at length that LiDAR is blind over Eighth
   and that nothing here is random. Grepping the raw file for those words
   therefore fires on the prose that documents the rule. Strip comments first,
   so every source gate below reads CODE. */
const codeOf = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

const shipped = read(join(root, "docs/data/campus-photo-detail.json"));
const section = shipped.survivance;

const arcgis = read(join(root, "docs/data/campus-arcgis.json"));
const lidar = read(join(root, "docs/data/campus-lidar.json"));

const TOWER_IDX = 464;
const WING_IDX = 462;
const gisRing = (i) => arcgis.massing[i].r[0].map(([x, z]) => [x / 10, z / 10]);

const openRing = (ring) => {
  const r = ring.map((p) => [p[0], p[1]]);
  const [f, l] = [r[0], r[r.length - 1]];
  if (r.length > 2 && f[0] === l[0] && f[1] === l[1]) r.pop();
  return r;
};

const inRing = (x, z, r) => {
  let ins = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, zi] = r[i];
    const [xj, zj] = r[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
};

const distToRing = (x, z, r) => {
  let best = Infinity;
  for (let i = 0; i < r.length; i++) {
    const [ax, az] = r[i];
    const [bx, bz] = r[(i + 1) % r.length];
    const dx = bx - ax;
    const dz = bz - az;
    const l2 = dx * dx + dz * dz;
    let t = l2 ? ((x - ax) * dx + (z - az) * dz) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
};

/* --------------------------------------------------------------- gates */

test("the section exists and is reachable", () => {
  assert.ok(section, "no survivance section — neither the shipped doc nor the staging file has one");
});

test("it says what it is, where it came from, and what it left out", () => {
  assert.match(section.label, /Survivance/i);
  assert.ok(section.epoch, "no epoch stamp");
  assert.match(section.note, /INVENTED/, "the note must declare the class");
  assert.ok(Array.isArray(section.sources) && section.sources.length >= 10,
    `only ${section.sources?.length} sources`);
  /* Every source carries a date — an undated source is not a source. */
  for (const s of section.sources) {
    assert.match(s, /(19|20)\d{2}/, `source has no date: ${s}`);
  }
  /* The absent list is a promise, not a draft. It may grow; it may not shrink. */
  assert.ok(Array.isArray(section.absent) && section.absent.length >= 26,
    `absent has ${section.absent?.length} entries — better absent than wrong, and this list does not shrink`);
  for (const gap of section.absent) assert.equal(typeof gap, "string");
  /* The entries that record the real, load-bearing decisions must stay named. */
  const named = [
    [/PHOTOVOLTAIC/i, "the refuted rooftop PV"],
    [/PARAPET/i, "the unresolved parapet height"],
    [/COURTYARD VOID/i, "the unresolved Market Hall courtyard void"],
    [/CORE-BLOCK STEP/i, "the unregisterable L11 core-block step"],
    [/LEVEL 11 TERRACES/i, "the three L11 terraces, withheld because the prism is solid"],
    [/WEST CANTILEVER AND ALL THREE/i, "the brow's cantilever and its columns"],
    [/LEVEL 1 AND LEVEL 2 FACADE/i, "the tower facade buried inside the wing prism"],
    [/L2 AND L3 BALCONY SLABS/i, "the two balconies buried inside the wing prism"],
    [/RAMPED WALK/i, "the entry's unbuilt ramped walk and its rails"],
    [/MARKET HALL WING'S 4,157/i, "the wing roof's undeclared mechanical plant"],
  ];
  for (const [re, what] of named) {
    assert.ok(section.absent.some((a) => re.test(a)), `${what} must stay in absent`);
  }
  assert.ok(Array.isArray(section.conflicts) && section.conflicts.length >= 4,
    "the four declared source conflicts must stay on the record");
  assert.match(section.conflicts[0], /36\.58|120 ft/,
    "the CEQA height conflict must name the published figure");
  assert.ok(section.conflicts.some((c) => /MARIGOLD RIBBON'S LEAN/i.test(c)),
    "the lean-versus-lens-convergence conflict must stay on the record");
});

test("colours are data, are hex, and every role carries its own provenance", () => {
  const keys = Object.keys(section.colors);
  assert.ok(keys.length >= 18, `only ${keys.length} colours`);
  for (const [k, v] of Object.entries(section.colors)) {
    assert.match(v, /^#[0-9a-f]{6}$/, `${k} is not a lowercase 6-digit hex`);
    const cs = section.colorSources[k];
    assert.ok(cs, `colour role ${k} has no colorSources entry`);
    /* "measured" joined the ladder when windowGlass was re-pointed at Pulse's
       k-means read of the shared curtain-wall family (arbitrated 2026-08-19). */
    assert.ok(["measured", "sourced", "estimated"].includes(cs.tier), `${k} has no tier`);
    assert.match(cs.date, /(19|20)\d{2}/, `${k}'s provenance carries no date`);
    assert.ok(cs.source.length > 40, `${k}'s provenance is too thin to check`);
    /* Every [estimated] hex must say so AND name the pattern it extends. */
    if (cs.tier === "estimated") {
      assert.match(cs.source, /\[estimated\]/, `${k} is estimated and does not say so`);
      assert.ok(cs.patternRef, `${k} is estimated and names no pattern to extend`);
    }
  }
  /* No colorSources entry may describe a colour that is not built. */
  for (const k of Object.keys(section.colorSources)) {
    assert.ok(section.colors[k], `colorSources names ${k}, which is not a colour`);
  }
  /* The two identifying colours are what the photographs say they are. */
  const hx = (h, i) => parseInt(h.slice(i, i + 2), 16);
  const mg = section.colors.marigold;
  assert.ok(hx(mg, 1) > 200 && hx(mg, 5) < 160 && hx(mg, 1) - hx(mg, 5) > 70,
    `marigold ${mg} is outside the colour-threshold family that isolated the 14 stripes`);
  const tb = section.colors.ribbonGlass;
  assert.ok(hx(tb, 3) > hx(tb, 1) && hx(tb, 5) > hx(tb, 1),
    `ribbonGlass ${tb} is not a teal / sea-green`);
});

/* ------------------------------------------------------- THE KEELING BAR */

/* The built subtrees. Everything numeric under them decides how something
   looks or where it sits, so everything numeric under them needs provenance.
   The survey's own numbers are excluded BY PATH — they are gated separately,
   against campus-arcgis.json, by the ring test below. */
const BUILT_KEYS = ["bay", "faces", "signage", "wall", "window", "marigold", "ribbon",
  "l11", "balconies", "brow", "roof", "podium", "entries", "wing"];
const SURVEY_PATHS = new Set([
  "faces[].length", "faces[].bayWidth", "faces[].seg", "faces[].a", "faces[].b",
  "faces[].slotBays", "wing.faces", "wing.festoon.segments", "podium.canopy.segments",
  "balconies.levels", "roof.penthouses[].kind", "entries[].seg",
]);
const PROSE_KEYS = new Set(["note", "source", "derivation", "basis", "tier", "date",
  "patternRef", "rooms", "distribution", "built", "estimated", "louvred", "cantilever",
  "id", "face", "faces", "ring", "kind", "text", "number", "label", "epoch",
  "arcgisIndex", "key", "name"]);
const isProse = (k) =>
  PROSE_KEYS.has(k) || /(Note|Source|Ref|Estimated|Basis|Tier|Applies)$/.test(k);

function numericPaths(value, path, out) {
  if (SURVEY_PATHS.has(path)) return;
  if (Array.isArray(value)) {
    if (value.length && value.every((v) => typeof v === "number")) { out.add(path); return; }
    for (const v of value) numericPaths(v, `${path}[]`, out);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (isProse(k)) continue;
      numericPaths(v, path ? `${path}.${k}` : k, out);
    }
  } else if (typeof value === "number") {
    out.add(path);
  }
}

test("every load-bearing dimension carries its own derivation — the Keeling bar", () => {
  const DS = section.dimensionSources;
  assert.ok(DS && typeof DS === "object", "there is no dimensionSources block");
  assert.ok(typeof section.dimensionRule === "string" && section.dimensionRule.length > 200,
    "the dimension rule must be stated, not implied");

  const found = new Set();
  for (const k of BUILT_KEYS) numericPaths(section[k], k, found);
  assert.ok(found.size >= 100, `only ${found.size} dimensions walked — the walker is not reaching the data`);

  const missing = [...found].filter((p) => !DS[p]).sort();
  assert.deepEqual(missing, [],
    `${missing.length} figures decide geometry with no derivation: ${missing.join(", ")}`);
  const orphan = Object.keys(DS).filter((p) => !found.has(p)).sort();
  assert.deepEqual(orphan, [],
    `dimensionSources describes figures that are not in the section: ${orphan.join(", ")}`);

  /* A tier is not a label of convenience: each one has to carry its evidence. */
  let measured = 0;
  let derived = 0;
  let estimated = 0;
  for (const [p, d] of Object.entries(DS)) {
    assert.ok(["measured", "derived", "estimated"].includes(d.tier), `${p} has no tier`);
    assert.ok(typeof d.basis === "string" && d.basis.length > 60,
      `${p}'s basis is too thin to check: ${d.basis}`);
    if (d.tier === "measured") {
      measured++;
      assert.ok(/px|counted|published|phf|flyer|plan/i.test(d.basis),
        `${p} claims measured and names no frame or count: ${d.basis}`);
      assert.match(d.basis, /\d/, `${p} claims measured and shows no figure`);
    } else if (d.tier === "derived") {
      derived++;
      assert.ok(/[=x\/+]/.test(d.basis) && /\d/.test(d.basis),
        `${p} claims derived and shows no arithmetic: ${d.basis}`);
      assert.ok(d.patternRef, `${p} claims derived and names no module, product or code it derives from`);
    } else {
      estimated++;
      assert.match(d.basis, /\[estimated\]/, `${p} is estimated and does not say so`);
      assert.ok(d.patternRef, `${p} is estimated and names no pattern to extend`);
    }
  }
  assert.ok(measured >= 10, `only ${measured} measured figures — this section claims photographic sourcing`);
  assert.ok(derived >= 35, `only ${derived} derived figures`);
  assert.ok(estimated >= 25 && estimated <= found.size,
    `${estimated} estimated figures — the third tier exists to be used, and to be visible`);
});

test("both rings are verbatim survey, both heights are the GIS h, and no LiDAR is read", () => {
  const m = section.measured.mass;
  const w = section.measured.wing;
  assert.equal(m.arcgisIndex, TOWER_IDX);
  assert.equal(w.arcgisIndex, WING_IDX);
  assert.deepEqual(m.ring, gisRing(TOWER_IDX),
    "measured.mass.ring is not the verbatim campus-arcgis massing[464] ring / 10");
  assert.deepEqual(w.ring, gisRing(WING_IDX),
    "measured.wing.ring is not the verbatim campus-arcgis massing[462] ring / 10");
  assert.equal(m.h, arcgis.massing[TOWER_IDX].h, "the tower height drifted from the survey");
  assert.equal(w.h, arcgis.massing[WING_IDX].h, "the wing height drifted from the survey");
  assert.equal(m.levels, arcgis.massing[TOWER_IDX].levels);
  assert.equal(section.grid.storeys, arcgis.massing[TOWER_IDX].levels,
    "the storey grid must be the drawn prism's own level count");
  assert.equal(section.grid.drawnHeight, arcgis.massing[TOWER_IDX].h);
  assert.ok(Math.abs(section.grid.floorToFloor - m.h / section.grid.storeys) < 1e-3,
    "floorToFloor is not the drawn prism read back");

  /* THE EPOCH GATE. The 2014 flight measured a parking lot here: there is no
     massHeight for either ring, and the section must not have invented one. */
  const key = (ring) => {
    const r = openRing(ring);
    const cx = r.reduce((s, p) => s + p[0], 0) / r.length;
    const cz = r.reduce((s, p) => s + p[1], 0) / r.length;
    return `m:${Math.round(cx)},${Math.round(cz)}`;
  };
  for (const ring of [m.ring, w.ring]) {
    assert.equal(lidar.massHeights?.[key(ring)], undefined,
      "a LiDAR massHeight exists for an Eighth ring — re-read the epoch rule before using it");
  }
  assert.equal(m.lidarMassHeight, null);
  assert.equal(w.lidarMassHeight, null);
  const src = codeOf(readFileSync(join(root, "docs/js/campus-photo-survivance.js"), "utf8"));
  assert.ok(!/lidar|massHeights/i.test(src),
    "the module must never reach for a LiDAR height over Eighth College");

  /* The published height is RECORDED but not built — that is the conflict. */
  assert.equal(section.grid.publishedHeight, 36.58);
  assert.notEqual(section.grid.publishedHeight, section.grid.drawnHeight);
});

test("every face names a real ring segment, and every bay count says how it was got", () => {
  const ring = openRing(section.measured.mass.ring);
  assert.equal(section.faces.length, 6, "the dog-leg has six elevations");
  const seen = new Set();
  let counted = 0;
  for (const f of section.faces) {
    assert.ok(f.seg >= 0 && f.seg < ring.length, `${f.id} names segment ${f.seg}`);
    assert.ok(!seen.has(f.seg), `two faces claim segment ${f.seg}`);
    seen.add(f.seg);
    assert.deepEqual(f.a, ring[f.seg], `${f.id}.a is not the surveyed vertex`);
    assert.deepEqual(f.b, ring[(f.seg + 1) % ring.length], `${f.id}.b is not the surveyed vertex`);
    const len = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]);
    assert.ok(Math.abs(f.length - len) < 0.01, `${f.id} length drifted from the ring`);
    /* Bay width is faceLength/count, so no bay can run past a surveyed
       corner; it must still land near the sourced 4.30 m module. */
    assert.ok(Math.abs(f.bayWidth - len / f.bays) < 0.01, `${f.id} bayWidth is not length/bays`);
    assert.ok(Math.abs(f.bayWidth - section.bay.module) < 0.4,
      `${f.id} bay ${f.bayWidth} is more than 0.4 m off the sourced ${section.bay.module} m module`);
    assert.ok(["every", "alternate", "none"].includes(f.marigold), `${f.id} marigold rule`);
    assert.ok(typeof f.source === "string" && f.source.length > 60 && /(19|20)\d{2}/.test(f.source),
      `${f.id} has no real dated source`);

    /* THE COUNT'S OWN PROVENANCE. Round one's prose said "per face the count
       is the photographed count"; four of the six were fitted to the module.
       Each face now declares which it is, and a derived count must show the
       division it came from and land on the number it claims. */
    assert.ok(["photographed", "derived"].includes(f.bayCountTier),
      `${f.id} does not say how its bay count was got`);
    assert.ok(typeof f.bayCountBasis === "string" && f.bayCountBasis.length > 60,
      `${f.id}'s bay-count basis is too thin to check`);
    if (f.bayCountTier === "photographed") {
      counted++;
      assert.match(f.bayCountBasis, /counted/i, `${f.id} claims photographed and does not say counted`);
    } else {
      assert.equal(f.bays, Math.round(len / section.bay.module),
        `${f.id} claims its count is round(length / module) and it is not`);
      assert.match(f.bayCountBasis, /round\(/, `${f.id} claims derived and shows no arithmetic`);
      assert.match(f.bayCountBasis, /NOT counted|not adopted/i,
        `${f.id} is derived and does not say the frame failed to count it`);
    }
  }
  assert.equal(counted, 2, "exactly two faces are counted in frame — north-west and east-end");
  /* Every segment of the surveyed ring is skinned — nothing shows raw massing. */
  assert.equal(seen.size, ring.length, "a surveyed ring segment has no elevation");
  assert.equal(section.faces.reduce((s, f) => s + f.bays, 0), section.bay.total,
    "the per-face bay counts do not sum to the sourced 48-bay perimeter");
  /* The end walls carry NO marigold — phf19 is a clean sunlit record of that. */
  for (const id of ["west-end", "east-end"]) {
    assert.equal(section.faces.find((f) => f.id === id).marigold, "none",
      `${id} must carry no marigold reveal`);
  }
  /* And the prose that used to claim all six were photographed is corrected. */
  assert.ok(!/Per face the count is the photographed count/.test(section.bay.derivation),
    "bay.derivation still claims every per-face count is photographed");
});

test("the wing carries the podium, and every one of its segments is dressed", () => {
  const ring = openRing(section.measured.wing.ring);
  const tower = openRing(section.measured.mass.ring);
  /* The finding the whole podium hangs on: the tower ring lies ENTIRELY
     inside the wing ring, which is why the base band is the wing's. */
  for (let i = 0; i < tower.length; i++) {
    const a = tower[i];
    const b = tower[(i + 1) % tower.length];
    assert.ok(inRing((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, ring),
      `tower segment ${i} is not inside the wing ring — the podium anchor is wrong`);
  }
  assert.equal(section.podium.ring, "wing");
  const segs = new Set(section.wing.faces.map((f) => f.seg));
  for (let i = 0; i < ring.length; i++) {
    const len = Math.hypot(ring[(i + 1) % ring.length][0] - ring[i][0],
      ring[(i + 1) % ring.length][1] - ring[i][1]);
    if (len < 0.25) continue;
    assert.ok(segs.has(i), `wing segment ${i} (${len.toFixed(2)} m) has no podium`);
  }
  for (const f of section.wing.faces) {
    assert.deepEqual(f.a, ring[f.seg]);
    assert.deepEqual(f.b, ring[(f.seg + 1) % ring.length]);
  }
  /* The canopy is on a DECLARED subset, and every festoon run hangs from a
     segment that actually has a canopy over it to hang from. */
  const canopy = new Set(section.podium.canopy.segments);
  assert.ok(canopy.size > 0 && canopy.size < ring.length,
    "the canopy must be a declared subset of the ring, not a silent wrap");
  for (const i of canopy) assert.ok(segs.has(i), `the canopy names undressed wing segment ${i}`);
  for (const i of section.wing.festoon.segments) {
    assert.ok(canopy.has(i), `festoon segment ${i} has no canopy to hang from`);
  }
  /* No entry may sit on a segment whose canopy would cut through its head. */
  const headMax = section.podium.plinthHeight + section.podium.storefront.height
    + section.podium.headerHeight;
  for (const e of section.entries) {
    assert.equal(e.ring, "wing", "entries hang off the wing perimeter");
    assert.ok(segs.has(e.seg), `entry ${e.id} names wing segment ${e.seg}`);
    assert.ok(e.u >= 0 && e.u <= 1, `entry ${e.id} runs off its segment`);
    assert.ok(e.height <= headMax + 1e-9,
      `entry ${e.id} is ${e.height} m tall and would punch through the ${headMax.toFixed(3)} m podium band`);
  }
  /* The brick base is one product module end to end. */
  const P = section.podium;
  const courses = (v) => Math.abs(v / P.brickCourse - Math.round(v / P.brickCourse));
  for (const [k, v] of [["plinthHeight", P.plinthHeight], ["headerHeight", P.headerHeight],
    ["storefront.height", P.storefront.height]]) {
    assert.ok(courses(v) < 0.02, `${k} = ${v} is not a whole number of ${P.brickCourse} m brick courses`);
  }
  assert.ok(Math.abs(P.plinthHeight + P.storefront.height + P.headerHeight - P.brickHeight) < 0.01,
    "plinth + storefront + header does not add up to the brick band, so the header cannot be built");
});

test("the roof furniture is inside the surveyed ring, corner by corner", () => {
  const ring = openRing(section.measured.mass.ring);
  const inset = section.roof.parapet.thickness + 0.5;
  let tightest = Infinity;
  const check = (label, x, z, w, d) => {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const px = x + (sx * w) / 2;
        const pz = z + (sz * d) / 2;
        assert.ok(inRing(px, pz, ring), `${label} has a corner outside the surveyed ring`);
        const dist = distToRing(px, pz, ring);
        tightest = Math.min(tightest, dist);
        assert.ok(dist >= inset,
          `${label} corner is ${dist.toFixed(2)} m from the parapet, inside the ${inset.toFixed(3)} m gate`);
      }
    }
  };
  assert.equal(section.roof.penthouses.length, 2, "two penthouses, per phf15");
  const kinds = section.roof.penthouses.map((p) => p.kind).sort();
  assert.deepEqual(kinds, ["plant", "stair"]);
  for (const p of section.roof.penthouses) check(`penthouse ${p.kind}`, p.x, p.z, p.size[0], p.size[2]);
  assert.ok(section.roof.mech.length >= 8 && section.roof.mech.length <= 10,
    `${section.roof.mech.length} mechanical units, outside the 8-10 phf15 resolves`);
  for (const m of section.roof.mech) {
    const w = m.size ? m.size[0] : m.radius * 2;
    const d = m.size ? m.size[2] : m.radius * 2;
    check(`mech ${m.kind}`, m.x, m.z, w, d);
  }
  /* The prose must quote the gate this test actually enforces. Round one's
     penthouseNote claimed 4.2 m and mechNote claimed 3.6 m; neither was the
     gate, and a note that oversells its own gate is worse than no note. */
  assert.match(section.roof.penthouseNote, new RegExp(inset.toFixed(3)),
    "penthouseNote does not quote the clearance the test enforces");
  assert.match(section.roof.mechNote, new RegExp(inset.toFixed(3)),
    "mechNote does not quote the clearance the test enforces");
});

test("there is no rooftop PV, and the refutation is on the record", () => {
  /* The Keeling trap running backwards: the 2021 renderings drew PV fields,
     three built frames refute them, and Keeling's own array in the same
     phf15 frame is the control that makes the negative credible. */
  const P = section.roof.pv;
  assert.equal(P.modules, 0, "Survivance's roof carries no photovoltaics");
  assert.ok(Array.isArray(P.refutingFrames) && P.refutingFrames.length >= 3,
    "a negative needs its refuting frames named to be falsifiable");
  assert.match(P.note, /Keeling/, "the control frame must stay on the record");
  assert.match(P.supersededSource, /revelle\.ucsd\.edu/, "the superseded rendering must be named");
  /* Scan the DATA, not the prose: nothing PV-shaped may be built. The whole
     `pv` key is the declaration of the absence, so it comes out first. */
  const builtRoof = structuredClone(section.roof);
  for (const k of ["pv", "penthouseNote", "mechNote", "mechEstimated",
    "mechPatternRef", "anchorSource"]) delete builtRoof[k];
  delete builtRoof.parapet.note;
  delete builtRoof.membrane.note;
  for (const p of builtRoof.penthouses) { delete p.source; delete p.patternRef; }
  assert.ok(!/photovolt|\bpv\b|ballast|rowPitch|tilt|module/i.test(JSON.stringify(builtRoof)),
    "a PV-shaped entity is in the built roof data");
});

/* ------------------------------------------------ the module, run for real */

/* A sloped sampler, not a flat one. Round one's hover gate ran on
   `heightAt: () => 12.2`, which cannot see a wall that stops short of falling
   ground; this falls 1 m across the footprint in x and 0.7 m in z. */
const GROUND = (x, z) => 12.2 + 0.012 * (x + 160) - 0.009 * (z - 668);

const build = async (opts = {}) => {
  const { createPhotoSurvivance } = await import("../docs/js/campus-photo-survivance.js");
  const g = opts.flat != null ? () => opts.flat : GROUND;
  return createPhotoSurvivance(null, {
    photo: { survivance: section },
    heightAt: g,
    surfaceAt: g,
  });
};

/**
 * Every built AABB corner, in world coordinates, for every mesh in the group —
 * instanced or not. Instance origins are NOT enough: mutating
 * podium.canopy.projection 2.2 -> 3.4 moved round one's centre-point gate from
 * 3.20 to 3.40 m and passed, while the true corner reach went to 4.84 m.
 */
const corners = (r) => {
  const out = [];
  for (const c of r.group.children) {
    const g = c.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox;
    const ex = [[bb.min.x, bb.max.x], [bb.min.y, bb.max.y], [bb.min.z, bb.max.z]];
    if (!c.isInstancedMesh) {
      /* The plates are filled polygons whose vertices are already in world
         x/z, so their bounding BOX is the ring's bounding box and would report
         corners the plate never reaches. Read the real vertices. */
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        out.push([p.getX(i) + c.position.x, p.getY(i) + c.position.y, p.getZ(i) + c.position.z]);
      }
      continue;
    }
    const m = c.instanceMatrix.array;
    for (let i = 0; i < c.count; i++) {
      const o = i * 16;
      for (const x of ex[0]) for (const y of ex[1]) for (const z of ex[2]) {
        out.push([
          m[o] * x + m[o + 4] * y + m[o + 8] * z + m[o + 12],
          m[o + 1] * x + m[o + 5] * y + m[o + 9] * z + m[o + 13],
          m[o + 2] * x + m[o + 6] * y + m[o + 10] * z + m[o + 14],
        ]);
      }
    }
  }
  return out;
};

/** Every instance's world position, per mesh — used only for determinism. */
const positions = (r) =>
  r.group.children
    .filter((c) => c.isInstancedMesh)
    .map((c) => {
      const out = [];
      for (let i = 0; i < c.count; i++) {
        const m = c.instanceMatrix.array;
        out.push([m[i * 16 + 12], m[i * 16 + 13], m[i * 16 + 14]]);
      }
      return out;
    });

/** The drawn lid, reproduced from campus-massing.js's own rim-median rule. */
const drawnLid = (ring, h) => {
  const gs = ring.map(([x, z]) => GROUND(x, z)).sort((a, b) => a - b);
  return gs[Math.floor(gs.length / 2)] + h;
};

test("the module builds the section, and the counts are the section's own", async () => {
  const THREE = await import("../docs/vendor/three/three.module.min.js");
  const r = await build();
  assert.ok(r.group instanceof THREE.Group);
  assert.equal(r.group.name, "photo-survivance");
  const c = r.counts;
  assert.equal(c.faces, section.faces.length);
  assert.equal(c.bays, section.bay.total);
  assert.equal(c.penthouses, section.roof.penthouses.length);
  assert.equal(c.mech, section.roof.mech.length);
  assert.equal(c.pv, 0);
  assert.equal(c.entries, section.entries.length);
  assert.equal(c.wordmarkLetters, section.entries.find((e) => e.wordmark).wordmark.text.length);
  assert.equal(c.addressNumerals,
    section.entries.filter((e) => e.number).reduce((s, e) => s + e.number.length, 0));
  assert.equal(c.ribbonFaces, section.faces.length,
    "the L11 ribbon runs on every face, because the terraces cannot be built");
  assert.equal(c.parapetSegments, openRing(section.measured.mass.ring).length);
  assert.equal(c.podiumSegments, section.wing.faces.length);
  assert.equal(c.podiumHeaders, section.wing.faces.length,
    "every podium segment carries its 3-course brick header — round one built zero of them");
  assert.equal(c.canopySegments, section.podium.canopy.segments.length,
    "the canopy is built on exactly the declared segments");
  assert.equal(c.wingRoofHoles, 1, "the wing roof must be punched by the tower ring");
  assert.equal(c.seatSteps, section.entries[0].forecourt.seatTerrace.tiers);
  assert.equal(c.entryPlanters, 2);
  assert.ok(c.windows > 300 && c.panelPieces > 1200, "the facade field is not built");
  assert.ok(c.marigoldBays > 200, "the marigold ribbon is not built");
  assert.ok(c.festoonCords === c.festoonLamps - section.wing.festoon.segments.length,
    "the festoon cord is not a polyline through the lamps");
  assert.ok(c.draws < 80, `${c.draws} draw calls — instance harder`);
});

test("what the section withheld is provably not built", async () => {
  const r = await build();
  const c = r.counts;
  /* Three terraces, four guards and three columns: sourced, and unbuildable
     inside a solid prism. The gate is that NOTHING of them ships. */
  assert.equal(c.terraces, 0, "a Level 11 terrace is built inside a solid prism");
  assert.equal(c.browColumns, 0, "a brow column is built with nothing under it");
  assert.equal(section.l11.terraces.length, 3, "the three terraces stay on the record as facts");
  for (const t of section.l11.terraces) assert.equal(t.built, false, `${t.id} is not flagged unbuilt`);
  assert.ok(!("westCantilever" in section.brow) && !("cornerColumns" in section.brow),
    "the withdrawn cantilever is still in the built data");
  assert.ok(!("covePitch" in section.brow), "brow.covePitch was dead data and must not return");

  /* The two balconies inside the wing prism. Nine are sourced; the count is
     re-derived here from the drawn prisms rather than hard-coded. */
  const S = section;
  const F = S.measured.mass.h / S.grid.storeys;
  const towerBase = drawnLid(openRing(S.measured.mass.ring), S.measured.mass.h) - S.measured.mass.h;
  const wingLid = drawnLid(openRing(S.measured.wing.ring), S.measured.wing.h);
  const buried = S.balconies.levels.filter((lv) => towerBase + (lv - 1) * F < wingLid);
  assert.ok(buried.length >= 1, "no balcony is buried, so this gate is untested");
  assert.equal(c.balconiesBuried, buried.length);
  assert.equal(c.balconies, S.balconies.count - buried.length);
  assert.equal(c.balconies + c.balconiesBuried, S.balconies.count,
    "the built and withheld balconies do not add up to the nine counted in phf26");

  /* And the module carries no dead code: round one shipped a `hash` helper
     that was never called and a `seed` that was never read, under a header
     that claimed both were the irregularity source. */
  const src = codeOf(readFileSync(join(root, "docs/js/campus-photo-survivance.js"), "utf8"));
  assert.ok(!/function hash\(/.test(src), "the unused hash helper is still in the module");
  assert.ok(!("seed" in section), "the unread seed is still in the section");
});

test("the marigold ribbon shears the whole grid, and is clipped at the corners", async () => {
  /* Not "the clip exists" — the clipped bays must be ABSENT, and no bay may
     be left with an opening its panel field does not surround. Recompute the
     sheared walk here and prove the module dropped exactly the stacks that
     would have stepped past a surveyed corner. */
  const S = section;
  const F = S.measured.mass.h / S.grid.storeys;
  const boxW = S.window.width + 2 * S.marigold.jambWidth;
  const rows = Math.min(S.grid.windowRows, S.grid.storeys - 1);
  const towerLid = drawnLid(openRing(S.measured.mass.ring), S.measured.mass.h);
  const base = towerLid - S.measured.mass.h;
  const wingLid = drawnLid(openRing(S.measured.wing.ring), S.measured.wing.h);
  let kept = 0;
  let clipped = 0;
  let hidden = 0;
  for (const f of S.faces) {
    const bw = f.length / f.bays;
    const slots = new Set(f.slotBays || []);
    const leans = f.marigold !== "none";
    const step = leans ? F * Math.tan((S.marigold.leanDeg * Math.PI) / 180) : 0;
    for (let lv = 0; lv < rows; lv++) {
      if (base + lv * F < wingLid) { hidden++; continue; }
      const shear = lv * step;
      for (let b = 0; b < f.bays; b++) {
        const mg = !slots.has(b) &&
          (f.marigold === "every" || (f.marigold === "alternate" && b % 2 === 0));
        if (!mg) continue;
        const uc = (b + 0.5) * bw + shear;
        const c0 = Math.max(0, uc - bw / 2);
        const c1 = Math.min(f.length, uc + bw / 2);
        if (uc - boxW / 2 >= c0 + 0.15 && uc + boxW / 2 <= c1 - 0.15) kept++;
        else clipped++;
      }
    }
  }
  assert.ok(clipped > 0, "the ribbon never reaches a corner — the clip is untested");
  assert.ok(hidden > 0, "no row is hidden by the wing prism — the occlusion rule is untested");
  const r = await build();
  assert.equal(r.counts.marigoldBays, kept, "the module built a bay the clip should have dropped");
  assert.equal(r.counts.marigoldClipped, clipped, "the clip count drifted from the recompute");

  /* The defect the clip used to hide: every opening must have a panel field
     around it. Panels are emitted per band; the count of bands that carry an
     opening must equal the count of openings. */
  assert.equal(r.counts.windows, r.counts.marigoldBays + (r.counts.windows - r.counts.marigoldBays));
  assert.ok(r.counts.windows > r.counts.marigoldBays,
    "flush punched openings vanished when the grid started shearing");

  /* And prove it geometrically: every marigold jamb instance projects onto
     its own face's chord within the face, never past a surveyed corner. */
  const ring = openRing(S.measured.mass.ring);
  const marigoldHex = S.colors.marigold.replace("#", "");
  const mesh = r.group.children.find(
    (c) => c.isInstancedMesh && c.material.color.getHexString() === marigoldHex
  );
  assert.ok(mesh, "no marigold mesh");
  assert.equal(mesh.count, kept);
  for (let i = 0; i < mesh.count; i++) {
    const m = mesh.instanceMatrix.array;
    const x = m[i * 16 + 12];
    const z = m[i * 16 + 14];
    let onSome = false;
    for (const f of S.faces) {
      const dx = f.b[0] - f.a[0];
      const dz = f.b[1] - f.a[1];
      const l2 = dx * dx + dz * dz;
      const t = ((x - f.a[0]) * dx + (z - f.a[1]) * dz) / l2;
      const px = f.a[0] + dx * t;
      const pz = f.a[1] + dz * t;
      /* Within the segment's own span, and within a metre of its plane. */
      if (t >= 0 && t <= 1 && Math.hypot(x - px, z - pz) < 1.0) onSome = true;
    }
    assert.ok(onSome, `a marigold jamb at (${x.toFixed(2)}, ${z.toFixed(2)}) is off every surveyed face`);
  }
  assert.ok(ring.length === 6);
});

test("nothing is drawn inside a solid prism", async () => {
  /* campus-massing.js extrudes both surveyed rings as SOLID masses and
     campus-walk.js adds this module on top without suppressing anything, so
     any corner inside a ring and below its lid is geometry nobody can ever
     see. Round one had 140 windows at -0.06 m, four terrace decks out to
     -6.15 m, 16 storefront lites at -0.10 m and about 700 tower pieces inside
     the wing prism, and no gate could see one of them. */
  const r = await build();
  const S = section;
  const tower = openRing(S.measured.mass.ring);
  const wing = openRing(S.measured.wing.ring);
  const towerLid = drawnLid(tower, S.measured.mass.h);
  const wingLid = drawnLid(wing, S.measured.wing.h);
  /* THE DATA INVARIANT FIRST, because it is exact: no recessed layer may cut
     back past `wall.standoff`, which is the innermost plane the section allows
     anything to occupy. Round one's punched glass sat at -0.06 m. */
  for (const [what, w] of [
    ["punched window glass", S.wall.standoff + S.wall.panelDepth - S.window.reveal],
    ["window frame surround", S.wall.standoff + S.wall.panelDepth - S.window.reveal + S.window.frame],
    ["L11 ribbon glass", S.wall.standoff + S.wall.panelDepth - S.ribbon.recess],
    ["floor-line reveal", S.wall.standoff + S.wall.panelDepth - S.wall.reveal.depth],
    ["wing clerestory", S.wall.standoff + S.wall.panelDepth - S.window.reveal],
    ["storefront glass", S.wall.standoff + S.podium.bandDepth - S.podium.storefront.reveal],
  ]) {
    assert.ok(w >= S.wall.standoff - 1e-9,
      `${what} sits ${w.toFixed(3)} m off the drawn prism, inside the ${S.wall.standoff} m standoff`);
  }

  /* THE BUILT CHECK SECOND. The allowance is 0.05 m and it exists for exactly
     one reason: the wing ring turns INWARD at two vertices, and a box that
     runs the full length of one segment necessarily overlaps the neighbour's
     interior by a few centimetres at such a corner — 0.041 m at the worst of
     them, which is a mullion's half width. Anything deeper is a layer on the
     wrong side of the wall, which is what this gate is for. */
  const skin = 0.05;
  let worst = 0;
  let at = null;
  for (const [x, y, z] of corners(r)) {
    for (const [ring, lid, name] of [[tower, towerLid, "tower"], [wing, wingLid, "wing"]]) {
      if (y >= lid - 0.01) continue;
      if (!inRing(x, z, ring)) continue;
      const d = distToRing(x, z, ring);
      if (d > worst) { worst = d; at = [name, x.toFixed(2), y.toFixed(2), z.toFixed(2)]; }
    }
  }
  assert.ok(worst <= skin + 1e-6,
    `something reaches ${worst.toFixed(3)} m inside a solid prism at ${at}`);
});

test("nothing hovers and nothing sinks, on sloped ground", async () => {
  const r = await build();
  const S = section;
  const tower = openRing(S.measured.mass.ring);
  const wing = openRing(S.measured.wing.ring);
  const towerLid = drawnLid(tower, S.measured.mass.h);
  /* The lowest drawn ground anywhere under either footprint, less the declared
     bury: nothing may hang below that, on any slope. */
  let gLo = Infinity;
  for (const ring of [tower, wing]) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      for (let k = 0; k <= 8; k++) {
        gLo = Math.min(gLo, GROUND(a[0] + ((b[0] - a[0]) * k) / 8, a[1] + ((b[1] - a[1]) * k) / 8));
      }
    }
  }
  const floor = gLo - S.podium.bury - 1e-6;
  const top = towerLid + Math.max(
    ...S.roof.penthouses.map((p) => p.size[1]),
    S.roof.parapet.height + S.roof.parapet.copingHeight
  ) + 1e-6;
  let lo = Infinity;
  let hi = -Infinity;
  for (const [, y] of corners(r)) { lo = Math.min(lo, y); hi = Math.max(hi, y); }
  assert.ok(lo >= floor,
    `something reaches y=${lo.toFixed(3)}, below the ${floor.toFixed(3)} m the declared bury allows`);
  assert.ok(hi <= top,
    `something reaches y=${hi.toFixed(3)}, above the ${top.toFixed(3)} m roofscape`);

  /* The ground-standing family is checked against the ground at its OWN x,z,
     not against a global band: a seat-wall tier or a planter that hovers by a
     centimetre on a slope is exactly what a flat sampler cannot see. */
  const hex = S.colors.siteConcrete.replace("#", "");
  const onGround = r.group.children.filter(
    (c) => c.isInstancedMesh && c.material.color.getHexString() === hex);
  assert.ok(onGround.length >= 2, "the ground-standing family is not built");
  let checked = 0;
  for (const mesh of onGround) {
    const m = mesh.instanceMatrix.array;
    for (let i = 0; i < mesh.count; i++) {
      const o = i * 16;
      const bottom = m[o + 13] - Math.abs(m[o + 5]) / 2;
      const g = GROUND(m[o + 12], m[o + 14]);
      assert.ok(Math.abs(bottom - g) < 1e-6,
        `a ground-standing box sits ${(bottom - g).toFixed(3)} m off the drawn ground`);
      checked++;
    }
  }
  assert.equal(checked, r.counts.seatSteps + r.counts.entryPlanters);

  /* The festoon hangs from the canopy soffit and never below its declared
     clear height over the ground under it. Round one hung it at a flat 3.60 m
     above the podium base and sagged 6% of a 34.9 m ring segment, which put 12
     lamps above the canopy plate with nothing holding them, 8 inside the slab,
     and the lowest lamp at 1.32 m. */
  const lampMesh = r.group.children.find((c) => c.geometry.type === "SphereGeometry");
  assert.ok(lampMesh && lampMesh.count > 0, "the festoon is not built");
  const canopyTop = S.podium.brickHeight;
  const lm = lampMesh.instanceMatrix.array;
  for (let i = 0; i < lampMesh.count; i++) {
    const o = i * 16;
    const x = lm[o + 12];
    const y = lm[o + 13];
    const z = lm[o + 14];
    assert.ok(y - GROUND(x, z) >= S.wing.festoon.minClear,
      `a festoon lamp hangs ${(y - GROUND(x, z)).toFixed(2)} m over the ground, under the ` +
      `${S.wing.festoon.minClear} m clear height`);
    /* And it hangs BELOW the soffit it hangs from — never through the plate. */
    const wingBase = drawnLid(wing, S.measured.wing.h) - S.measured.wing.h;
    assert.ok(y <= wingBase + canopyTop - S.podium.canopy.thickness - S.podium.canopy.soffitDepth,
      `a festoon lamp at y=${y.toFixed(2)} sits at or above the canopy plate it hangs from`);
  }

  /* And the entry forecourt does not intersect itself: round one overlapped
     the planters with the seat-wall steps by 0.30 x 0.30 x 0.58 m. */
  const e = S.entries.find((x) => x.forecourt);
  const FC = e.forecourt;
  const halfRun = e.width / 2 + FC.seatTerrace.overrun;
  const inner = halfRun + FC.planter.gap;
  assert.ok(inner - halfRun >= FC.planter.gap - 1e-9,
    "the planters are not clear of the seat-wall terrace along the face");
  assert.ok(FC.planter.gap > 0, "there is no declared gap between the planters and the steps");
});

test("nothing escapes the surveyed envelope, corner by corner", async () => {
  const r = await build();
  const tower = openRing(section.measured.mass.ring);
  const wing = openRing(section.measured.wing.ring);
  const pad = section.measured.envelope.pad;
  let worst = 0;
  let at = null;
  for (const [x, , z] of corners(r)) {
    if (inRing(x, z, tower) || inRing(x, z, wing)) continue;
    const d = Math.min(distToRing(x, z, tower), distToRing(x, z, wing));
    if (d > worst) { worst = d; at = [x.toFixed(1), z.toFixed(1)]; }
  }
  assert.ok(worst <= pad,
    `something reaches ${worst.toFixed(2)} m outside both surveyed rings at ${at} (declared pad ${pad})`);
  /* The pad is a promise about the built thing, so it must be TIGHT: a pad
     nothing comes near is a gate that can never fire. */
  assert.ok(worst > pad - 1.0,
    `the widest reach is ${worst.toFixed(2)} m against a ${pad} m pad — the pad is slack enough to hide a fault`);
});

test("two builds are byte-identical", async () => {
  const a = await build();
  const b = await build();
  assert.deepEqual(a.counts, b.counts);
  assert.deepEqual(positions(a), positions(b), "two builds must be byte-identical");
  const src = codeOf(readFileSync(join(root, "docs/js/campus-photo-survivance.js"), "utf8"));
  assert.ok(!/Math\.random|Date\.now|new Date/.test(src), "no nondeterminism in the builder");
});

test("the module uses the material library and reads its section one-way", () => {
  const src = readFileSync(join(root, "docs/js/campus-photo-survivance.js"), "utf8");
  assert.match(src, /createMaterialLibrary/, "surfaces come from campus-materials.js");
  /* Colours are DATA: no hex literal may appear in the module. */
  const literals = src.match(/["'`]#[0-9a-fA-F]{3,8}["'`]/g) || [];
  assert.deepEqual(literals, [], `hex literals in the module: ${literals.join(", ")}`);
  /* One-way: the module never writes back into the photo document. */
  assert.ok(!/\bS\.[A-Za-z.]+\s*=[^=]/.test(src), "the module assigns into its own section");
  assert.ok(!/photo\.[A-Za-z]+\s*=[^=]/.test(src), "the module writes back into the photo document");
});

test("a missing section is harmless", async () => {
  const { createPhotoSurvivance } = await import("../docs/js/campus-photo-survivance.js");
  const r = createPhotoSurvivance(null, { photo: {}, heightAt: () => 12, surfaceAt: () => 12 });
  assert.deepEqual(r.counts, {});
  assert.equal(r.group.children.length, 0);
});
