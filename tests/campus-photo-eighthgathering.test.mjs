/* Eighth College's gathering places — the photo-sourced INVENTED class.
 *
 * The gates here are about quarantine, about not contradicting the measured
 * world, and about the two things this section exists to correct:
 *
 *   - the SURVEY decides every ground extent. The rings this section builds on
 *     are copied verbatim out of docs/data/campus-eighth.json and the test
 *     re-reads them from that file, so a drifted copy fails. The meditation
 *     spine's 14.9 x 7.9 m opening, the tea house gap and the court stair's
 *     clip are all RE-DERIVED here from those rings rather than trusted;
 *   - EPOCH decides existence, and the amphitheatre tiers this section retires
 *     must stay named in `supersedes` with a reason;
 *   - nothing hovers: every solid either meets the drawn ground or touches
 *     something that does, checked pairwise across all ~1900 instances;
 *   - NOTHING INTERSECTS, and not only the three pavilion drums. Round one
 *     shipped 26 solid-solid intersections on the BBQ terrace — a chair inside
 *     a conical planter — and passed every gate in this file, because the only
 *     intersection test covered three objects. There is now a pairwise oriented
 *     SAT gate over the whole terrace with ONE declared exemption, the chairs
 *     tucked under their cafe tables, and that exemption is itself checked in
 *     3D rather than taken on trust;
 *   - EVERY FIGURE IS TIERED AT THE FIGURE. Round one stamped 40 subsystems
 *     `tier: "measured"` while 22 of them hedged in their own prose, and
 *     flipping three more from estimated to measured passed every gate. A
 *     subsystem's tier is now DERIVED from its figures, each of which carries
 *     its own bracket and its own reason, and an [estimated] figure must name
 *     the sourced pattern it extends;
 *   - the headline figures are load-bearing: `roof.plate` carries this
 *     section's whole photogrammetric derivation and the module builds from
 *     `roof.rect`, so the gate asserts they are the same statement. Changing
 *     `plate` to [9, 5] used to pass;
 *   - nothing escapes: every solid and every decal vertex sits inside one of
 *     the declared envelopes, which are the anchor rings plus a margin;
 *   - every clip is genuinely respected — the bark decal really is absent from
 *     the two surveyed courtyard rings, the cobble decal really is inside the
 *     measured gap, and NO vertex of this section lands inside courtyard-2369,
 *     which arbitration established is the Sun Lawn;
 *   - the hand-over is real: the families this section gave to eighthsiteworks,
 *     eighthramble and eighthcourtyards are gone from the data AND from the
 *     build, and each hand-over stays declared in `absent`;
 *   - supersedes is COMPLETE, not a spot check: every shipped item in every
 *     area this section rebuilds is named, resolved by key against the shipped
 *     document. Round one stranded three, one of them a lit rail running down
 *     the middle of the new pavilion deck;
 *   - colours are data with per-role provenance that names a frame or an
 *     inheritance, sources carry dates, and the absent list does not shrink;
 *   - two builds produce identical matrices.
 *
 * WHAT THESE GATES STILL CANNOT DO, said plainly: a test cannot open a
 * photograph. Every colour could be #ff00ff and the format, provenance shape
 * and frame citation would all still pass. The colour gates refuse provenance
 * that names nothing; they cannot confirm a hex.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as THREE from "../docs/vendor/three/three.module.min.js";
import { createPhotoEighthGathering } from "../docs/js/campus-photo-eighthgathering.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(p, "utf8"));

const merged = read(process.env.PHOTO_DETAIL || join(root, "docs/data/campus-photo-detail.json"));
const section = merged.eighthgathering;

const eighth = read(join(root, "docs/data/campus-eighth.json"));
const G = eighth.ground;

/* ---------------------------------------------------------------- helpers */

/* A rolling test ground: the real terrain rolls, and a slab seated on a single
   flat datum would pass a flat-ground test and fail the campus. */
const ground = (x, z) => 100 + Math.sin(x * 0.05) * 0.4 + Math.cos(z * 0.04) * 0.3;

function inPoly(x, z, r) {
  let ins = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, zi] = r[i], [xj, zj] = r[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
}
function spanAt(pts, z) {
  const xs = [];
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if (zi > z !== zj > z) xs.push(((xj - xi) * (z - zi)) / (zj - zi) + xi);
  }
  return xs.sort((a, b) => a - b);
}

let BUILT = null;
function build() {
  if (BUILT) return BUILT;
  const r = createPhotoEighthGathering(null, {
    photo: { eighthgathering: section }, surfaceAt: ground,
  });
  const m = new THREE.Matrix4(), p = new THREE.Vector3();
  const q = new THREE.Quaternion(), s = new THREE.Vector3();
  const solids = [], verts = [], decals = [];
  r.group.traverse((o) => {
    if (o.isInstancedMesh) {
      o.geometry.computeBoundingBox();
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m);
        m.decompose(p, q, s);
        const b = new THREE.Box3().copy(o.geometry.boundingBox).applyMatrix4(m);
        solids.push({ name: o.name, x: p.x, y: p.y, z: p.z, b });
      }
    } else if (o.isMesh) {
      const pos = o.geometry.getAttribute("position");
      for (let i = 0; i < pos.count; i++) {
        verts.push({
          name: o.name,
          x: pos.getX(i) + o.position.x,
          y: pos.getY(i) + o.position.y,
          z: pos.getZ(i) + o.position.z,
        });
      }
      /* A DRAPED DECAL, recognised by campus-overlay.js's own contract rather
         than by name: it is on the decal stack (renderOrder > 0) and does not
         write depth. Its triangles ARE the visible ground where it is drawn,
         which is what a thing standing on it stands on. */
      if (o.renderOrder > 0 && o.material && o.material.depthWrite === false) {
        for (let i = 0; i + 2 < pos.count; i += 3) {
          decals.push([0, 1, 2].map((k) => [
            pos.getX(i + k) + o.position.x,
            pos.getY(i + k) + o.position.y,
            pos.getZ(i + k) + o.position.z,
          ]));
        }
      }
    }
  });
  BUILT = { ...r, solids, verts, decals };
  return BUILT;
}

/* ------------------------------------------------------------------ gates */

test("the section exists and is reachable", () => {
  assert.ok(section, "no eighthgathering section in the merged doc or the build-side file");
});

test("it says what it is: built epoch, sourced, quarantined, honest", () => {
  assert.match(section.label, /Meditation Pavilion/);
  assert.match(section.label, /Tea House/);
  assert.match(section.note, /INVENTED/, "the note must declare the class");
  assert.match(section.epoch, /BUILT/, "the epoch stamp must name the built condition");
  assert.match(section.epoch, /BLIND/i, "the epoch stamp must record that 2014 LiDAR is blind to Eighth");
  assert.ok(Number.isInteger(section.seed), "the seed must be a pinned integer");

  assert.ok(Array.isArray(section.sources) && section.sources.length >= 20,
    `only ${section.sources?.length} sources`);
  for (const s of section.sources) {
    assert.match(s.url, /^https:\/\//, `source without a url: ${JSON.stringify(s)}`);
    assert.ok(s.date && /\d{4}/.test(s.date), `source without a date: ${s.url}`);
    assert.ok(s.rung, `source without a ladder rung: ${s.url}`);
    assert.ok(s.what && s.what.length > 40, `source without a real description: ${s.url}`);
    /* Round one's source block survived being rewritten to date "1999", rung
       "1" and 41 filler characters, because the gate checked a four-digit
       number, truthiness and a length. Each of those three is now the claim it
       was standing in for.

       RUNG is the ultra standard's ladder — photos, Street View, drone/video,
       plans and drawings, archives — so it must name a step on it, not a bare
       digit. DATE has a floor this subject derives rather than assumes: the
       earliest source in this section's own ladder is the 2021-04-29 Revelle
       town-hall deck carrying the DESIGN plan, and Eighth opened in 2023, so
       nothing dated before 2021 can be describing this building or its design.
       The ceiling is today. WHAT must be a description someone could act on:
       ten distinct words is the least that can identify a frame and say what
       is legible in it. */
    assert.match(s.rung, /^[1-5] - [a-z]/i,
      `${s.url}'s rung must name a step on the ultra standard's ladder, not just a number: ${s.rung}`);
    const years = (s.date.match(/\d{4}/g) || []).map(Number);
    assert.ok(years.length && years.every((y) => y >= 2021 && y <= 2026),
      `${s.url} is dated ${s.date}; this section's earliest ladder rung is the 2021 design plan and Eighth opened in 2023`);
    const words = new Set((s.what.toLowerCase().match(/[a-z]{3,}/g) || []));
    assert.ok(words.size >= 10,
      `${s.url}'s description is filler, not a description: ${s.what.slice(0, 60)}`);
  }
});

/** Every frame this section is entitled to cite, derived from its own source urls. */
function frameVocabulary() {
  const v = new Set();
  for (const s of section.sources) {
    for (const m of (s.url.match(/phf\d+/gi) || [])) v.add(m.toLowerCase());
    for (const m of (s.url.match(/Living-Learning-(\d+)/gi) || [])) v.add(`swa-${/(\d+)/.exec(m)[1]}`);
  }
  return v;
}
/** Every frame this section actually cites, anywhere in its prose. */
function framesCited(node, into = new Map(), path = "") {
  if (typeof node === "string") {
    for (const m of (node.match(/phf\s?-?\d+/gi) || [])) {
      const k = m.toLowerCase().replace(/[\s-]/g, "");
      if (!into.has(k)) into.set(k, path);
    }
    for (const m of (node.match(/swa[ ‑-]*(?:image )?-?\s?\d+/gi) || [])) {
      const k = `swa-${/(\d+)/.exec(m)[1]}`;
      if (!into.has(k)) into.set(k, path);
    }
  } else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) framesCited(v, into, `${path}.${k}`);
  }
  return into;
}

test("every frame this section cites is a frame it declares", () => {
  /* A provenance string that names a frame is only re-checkable if the frame
     can be opened. Round one cited six frames the section never declared —
     phf03 (the handrail height both stairs extend), SWA-13 (planterCharcoal's
     own sample window and the seat-pod rejection), SWA-17 (the second fire
     feature, which is the reason an `absent` entry exists), SWA-4, SWA-7 and
     SWA-22 — so those citations named nothing a reader could reach. The gate
     is closure: the set of frames cited must be a subset of the set declared,
     and it runs over the WHOLE section, not just colorSources. */
  const vocab = frameVocabulary();
  assert.ok(vocab.size >= 18, `only ${vocab.size} openable frames declared`);
  const cited = framesCited(section);
  const undeclared = [...cited].filter(([k]) => !vocab.has(k))
    .map(([k, where]) => `${k} (cited at${where})`);
  assert.deepEqual(undeclared, [],
    `${undeclared.length} frames are cited but not declared in sources — a citation nobody can open`);
  /* And the other way, so the source list cannot be padded with frames that
     carry no claim. Every one of the 20 frames this section declares is cited
     somewhere in it today, so the gate is exact: a frame declared and never
     used is a source list dressed up, and it fails here rather than making the
     count look better. */
  const unused = [...vocab].filter((k) => !cited.has(k));
  assert.deepEqual(unused, [],
    `${unused.length} declared frames are cited nowhere — a padded source list: ${unused.join(", ")}`);
});

test("colours are data with per-role provenance, and none of them is in the module", () => {
  const roles = Object.entries(section.colors);
  assert.ok(roles.length >= 40, `only ${roles.length} colours`);
  for (const [role, hex] of roles) {
    assert.match(hex, /^#[0-9a-f]{6}$/, `${role} is not a lowercase hex`);
    const src = section.colorSources[role];
    assert.ok(src, `${role} has no colorSources entry`);
    assert.match(src, /\[(sourced|measured|estimated)\]/,
      `${role}'s provenance must be tiered: ${src}`);
    if (/\[estimated\]/.test(src)) {
      assert.ok(/extend|inventory|no source|no frame|no clean/i.test(src),
        `${role} is [estimated] and must say what it extends or why: ${src}`);
    }
  }
  for (const role of Object.keys(section.colorSources)) {
    assert.ok(section.colors[role], `orphan colorSources entry: ${role}`);
  }
  /* A test cannot look at a photograph, so it cannot know a hex is right. What
     it CAN refuse is provenance that names nothing: round one's colorSources
     survived being rewritten to "[sourced] because I say so" because the gate
     checked only the tier bracket. Every entry must now name a frame this
     section actually declares in `sources` or `frames`, or an inheritance it
     can be chased to. */
  const frameIds = new Set();
  for (const s of section.sources) {
    for (const m of (s.url.match(/phf\d+|Learning-\d+|crop_[a-z]+|z_[a-z]+/gi) || [])) {
      frameIds.add(m.toLowerCase());
    }
    for (const m of (s.what.match(/phf\d+|SWA[ -]?(?:image )?-?\d+|crop_[a-z]+|z_[a-z]+/gi) || [])) {
      frameIds.add(m.toLowerCase().replace(/\s+/g, " "));
    }
  }
  assert.ok(frameIds.size >= 8, `only ${frameIds.size} identifiable frames in sources`);
  const CITES = /phf\s?-?\d+|swa[ -]*(?:image )?-?\d+|crop_[a-z]+|z_[a-z]+|inherited|carried|shipped|arbitrat/i;
  for (const [role, src] of Object.entries(section.colorSources)) {
    assert.ok(CITES.test(src),
      `${role}'s provenance names no frame and no inheritance: ${src}`);
    assert.ok(src.length > 45, `${role}'s provenance is too thin to re-derive: ${src}`);
  }
  /* And a [measured] colour must carry a locus or a statistic — the thing that
     makes it re-checkable by someone who opens the same frame. */
  const LOCUS = /\d+\s*[x,]\s*\d+|\(\d+\s*,\s*\d+\)|percentile|median|k-means|ratio|px\b/i;
  const measured = Object.entries(section.colorSources).filter(([, s]) => /\[measured\]/.test(s));
  assert.ok(measured.length >= 3,
    `only ${measured.length} measured colours — most of this section is [sourced], which is honest, but the few that claim a measurement must be re-derivable`);
  for (const [role, src] of measured) {
    assert.ok(LOCUS.test(src),
      `${role} claims [measured] and gives no sample window or statistic: ${src}`);
  }
  /* THE ONE PART OF A HEX A TEST CAN CHECK. Rewriting every colour to #ff00ff
     passes the format, provenance and citation gates above, and always will —
     a test cannot open a photograph. But 21 of these roles do not claim a
     measurement at all: they say "Inherited unchanged" from the shipped
     `eighth` section, and that is a claim about a value in a file this test can
     read. So for those, the hex is checked, not believed. It is a fifth of the
     palette, and it is the fifth where being wrong would be a silent drift
     away from a colour the shipped world is already painted with. */
  const shipped = merged.eighth?.colors;
  assert.ok(shipped, "the shipped eighth colour table must be readable");
  const shippedValues = new Set(Object.values(shipped));
  const inherited = Object.entries(section.colorSources)
    .filter(([, s]) => /inherited unchanged/i.test(s));
  assert.ok(inherited.length >= 20,
    `only ${inherited.length} roles declare an inheritance — this section is mostly carried, not re-sampled`);
  for (const [role] of inherited) {
    assert.ok(shippedValues.has(section.colors[role]),
      `${role} says "Inherited unchanged" but ${section.colors[role]} is in no shipped eighth colour — either it drifted or the claim is false`);
  }

  /* The module must hold no colour of its own. */
  const src = readFileSync(join(root, "docs/js/campus-photo-eighthgathering.js"), "utf8");
  const literals = src.match(/#[0-9a-fA-F]{6}\b/g) || [];
  assert.deepEqual(literals, [], `hex literals in the module: ${literals.join(", ")}`);
  /* And it must not define a lift or polygon-offset constant of its own. */
  assert.ok(!/polygonOffset(Factor|Units)?\s*[:=]/.test(src),
    "the module must take its depth state from campus-overlay.js, not define it");
});

test("every ring is copied VERBATIM out of campus-eighth.json", () => {
  const pairs = [
    [section.measured.spine.ring328, "courtyard-328"],
    [section.measured.spine.ring329, "courtyard-329"],
    [section.measured.teaHouse.ring1159, "courtyard-1159"],
    [section.measured.courtStair.ringCourt, "basketball-court"],
    [section.measured.courtStair.ringBed1760, "planting-bed-1760"],
    [section.measured.bbqTerrace.ring2375, "courtyard-2375"],
    [section.measured.plaza.ring2369, "courtyard-2369"],
  ];
  for (const [copy, key] of pairs) {
    assert.ok(G[key], `campus-eighth.json has no ground['${key}']`);
    assert.deepEqual(copy, G[key].points, `${key} drifted from the survey`);
  }
});

test("the meditation spine opening is what the two surveyed rings actually leave", () => {
  const o = section.measured.spine.opening;
  let west = -Infinity, east = Infinity;
  for (let k = 0; k <= 156; k++) {
    const z = 584.05 + k * 0.05;
    const a = spanAt(G["courtyard-328"].points, z).filter((v) => v < -167);
    const b = spanAt(G["courtyard-329"].points, z);
    const e = Math.max(...a), w = Math.min(...b);
    if (w - e < 10) continue;
    west = Math.max(west, e); east = Math.min(east, w);
  }
  assert.ok(Math.abs(o.x0 - west) < 0.02, `declared west ${o.x0}, survey says ${west}`);
  assert.ok(Math.abs(o.x1 - east) < 0.02, `declared east ${o.x1}, survey says ${east}`);
  assert.ok(o.x1 - o.x0 > 14.5, "the opening is 14.9 m wide, not the '~11 m' the shipped section claims");

  /* And the pavilion has to fit in it, roof and deck alike. */
  const R = section.meditation.roof.rect, D = section.meditation.deck.rect;
  for (const [id, r] of [["roof", R], ["deck", D]]) {
    assert.ok(r.x0 >= o.x0 && r.x1 <= o.x1, `${id} overruns the opening in x`);
    assert.ok(r.z0 >= o.z0 && r.z1 <= o.z1, `${id} overruns the opening in z`);
  }
  /* The deck lives under the roof, not proud of it — the survey's decision. */
  assert.ok(D.x0 >= R.x0 && D.x1 <= R.x1 && D.z0 >= R.z0 && D.z1 <= R.z1,
    "the roof must oversail the deck on every side");
});

test("the three screen drums do not intersect each other or leave the deck", () => {
  const M = section.meditation;
  const D = M.deck.rect;
  const list = M.drums.list;
  assert.equal(list.length, 3, "three lobes: SWA-3's three oculi and the 2021 plan's three circles");
  for (const d of list) {
    assert.ok(d.cx - d.r >= D.x0 && d.cx + d.r <= D.x1, `${d.id} drum leaves the deck in x`);
    assert.ok(d.cz - d.r >= D.z0 && d.cz + d.r <= D.z1, `${d.id} drum leaves the deck in z`);
    /* The gravel margin the photographs show has to actually be there. */
    const margin = Math.min(d.cx - d.r - D.x0, D.x1 - (d.cx + d.r),
      d.cz - d.r - D.z0, D.z1 - (d.cz + d.r));
    assert.ok(margin >= 0.4, `${d.id} leaves only ${margin.toFixed(2)} m of deck margin`);
  }
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const dist = Math.hypot(a.cx - b.cx, a.cz - b.cz);
      assert.ok(dist >= a.r + b.r,
        `${a.id} and ${b.id} intersect: centres ${dist.toFixed(3)} m apart, radii sum ${(a.r + b.r).toFixed(3)}`);
    }
  }
  /* Exactly one lobe's RADIUS is estimated, and it must say what it extends.
     The lobe's tier is "mixed" — its centres are solved and its panel count
     derived — so the claim is checked at the figure, not at the subsystem. */
  const est = list.filter((d) => /^\[estimated\]/.test(d.figures?.r || ""));
  assert.equal(est.length, 1, "exactly one lobe's radius is estimated");
  assert.match(est[0].figures.r, /extend/i);
  for (const d of list) {
    if (est.includes(d)) continue;
    assert.equal(d.r * 2, M.drums.diameterMeasured,
      `${d.id} is measured-tier and must be the measured 4.3 m drum, not ${d.r * 2}`);
  }
  assert.match(M.drums.derivation, /\[estimated\]/);
  assert.match(M.drums.derivation, /extend/i);

  /* drums.list[].panels and drums.screen.panels are DECLARED figures, so they
     are re-derived here from the arcs and the screen module rather than
     believed — the failure mode is a headline number nothing reads. */
  const SC = M.drums.screen;
  let total = 0;
  for (const d of list) {
    let n = 0;
    for (const [a0, a1] of d.arcs) {
      n += Math.max(1, Math.floor(((a1 - a0) * d.r) / (SC.panelWidth + SC.slot)));
    }
    assert.equal(n, d.panels, `${d.id} declares ${d.panels} panels, its arcs give ${n}`);
    total += n;
  }
  assert.equal(total, SC.panels, `screen.panels ${SC.panels}, the three lobes give ${total}`);
  assert.equal(build().counts.pavilionPanels, SC.panels, "the module must build exactly the declared panels");
  assert.equal(SC.height, M.roof.soffitClear,
    "the screen runs deck to soffit, so its height IS the measured soffit clear");
});

test("every screen arc is re-derived from the opening rule, and no arc is over-full", () => {
  /* THE FAILURE THIS EXISTS FOR. Two of the six shipped angles were written on
     the wrong branch — mid's third arc opened at -2.803 where the rule gives
     3.480, east's second closed at 4.262 where the rule gives -2.021 — so
     those two arcs spanned 7.065 and 6.669 rad, MORE THAN A FULL CIRCLE. Each
     swallowed its own siblings: 78 pairs of panels were built exactly
     coincident at the full 0.110 m screen thickness, 12 of the 46 panels then
     declared were phantoms, and the openings `arcNote` calls "both the way in
     and the light source" did not exist on either drum — two sealed cylinders
     with no way in. Every gate in this file passed, because the panel gate
     re-derived the count from the same broken arcs.
     So the arcs themselves are re-derived here, from the rule in `arcNote` and
     from the lobe geometry: the screen stops over asin(r_neighbour / centre
     distance) each side of the bearing to each chain neighbour, and over
     openingNorth / (2 r) each side of northBearing; two openings with less
     than one panel module of face between them merge. */
  const M = section.meditation, SC = M.drums.screen, list = M.drums.list;
  const TAU = Math.PI * 2;
  const norm = (a) => ((a % TAU) + TAU) % TAU;
  for (let i = 0; i < list.length; i++) {
    const d = list[i];
    const mod = (SC.panelWidth + SC.slot) / d.r;
    const openings = [];
    for (const n of [list[i - 1], list[i + 1]]) {         /* its chain neighbours */
      if (!n) continue;
      const dist = Math.hypot(n.cx - d.cx, n.cz - d.cz);
      const bear = Math.atan2(n.cz - d.cz, n.cx - d.cx);
      const half = Math.asin(n.r / dist);
      openings.push([bear - half, bear + half]);
    }
    openings.push([SC.northBearing - SC.openingNorth / (2 * d.r),
      SC.northBearing + SC.openingNorth / (2 * d.r)]);
    const merged = [];
    for (const [a, b] of openings.map(([a, b]) => [norm(a), norm(a) + (b - a)])
      .sort((p, q) => p[0] - q[0])) {
      const last = merged[merged.length - 1];
      if (last && a - last[1] < mod) last[1] = Math.max(last[1], b);
      else merged.push([a, b]);
    }
    while (merged.length > 1) {
      const first = merged[0], last = merged[merged.length - 1];
      if (first[0] + TAU - last[1] >= mod) break;
      last[1] = Math.max(last[1], first[1] + TAU);
      merged.shift();
    }
    const want = merged.map((m, k) => [m[1],
      k + 1 < merged.length ? merged[k + 1][0] : merged[0][0] + TAU])
      .filter(([a0, a1]) => a1 - a0 > 1e-9);

    assert.equal(d.arcs.length, want.length,
      `${d.id} declares ${d.arcs.length} arcs; the opening rule leaves ${want.length}`);
    /* Compared as ANGLES, not as numbers: an arc is the same arc whichever
       turn of the circle it is written on, and it is the branch — not the
       geometry — that was wrong. */
    for (const [a0, a1] of d.arcs) {
      const apart = (a) => Math.min(norm(a), TAU - norm(a));
      const hit = want.find((w) => apart(w[0] - a0) < 1e-5
        && Math.abs((w[1] - w[0]) - (a1 - a0)) < 1e-5);
      assert.ok(hit, `${d.id} ships an arc [${a0}, ${a1}] the opening rule does not give`);
    }
    /* And three things no arc may ever be, whatever the rule says. */
    for (const [a0, a1] of d.arcs) {
      assert.ok(a1 > a0, `${d.id} has an arc that does not increase from its start`);
      assert.ok(a1 - a0 < TAU, `${d.id} has an arc spanning ${(a1 - a0).toFixed(3)} rad — a full circle or more`);
      assert.ok((a1 - a0) * d.r >= SC.panelWidth,
        `${d.id} has an arc too short to hold one whole panel`);
    }
    for (let p = 0; p < d.arcs.length; p++) {
      for (let q = p + 1; q < d.arcs.length; q++) {
        const [x0, x1] = d.arcs[p], [y0, y1] = d.arcs[q];
        for (const k of [-1, 0, 1]) {
          assert.ok(x1 <= y0 + k * TAU || x0 >= y1 + k * TAU,
            `${d.id}'s arcs ${p} and ${q} overlap`);
        }
      }
    }
  }
  /* THE OPENINGS ARE REALLY THERE, in the built scene: on the northern bearing
     of every drum, at screen height, there is no panel. */
  const { solids } = build();
  for (const d of list) {
    const px = d.cx + Math.cos(SC.northBearing) * d.r;
    const pz = d.cz + Math.sin(SC.northBearing) * d.r;
    const blocking = solids.filter((s) => s.name === "box-woodScreen"
      && Math.hypot(s.x - px, s.z - pz) < SC.panelWidth / 3);
    assert.equal(blocking.length, 0,
      `${d.id}'s northern approach is sealed by ${blocking.length} screen segments`);
  }
});

test("the pavilion's headline figures are derived, not decorative", () => {
  /* `plate` carries this section's whole photogrammetric derivation and the
     module builds from `rect`. If the two may drift, the derivation is
     ornament — so they are the same statement and the gate says so. */
  const R = section.meditation.roof;
  assert.equal(R.plate[0], Number((R.rect.x1 - R.rect.x0).toFixed(6)),
    "roof.plate[0] must BE the rectangle the module builds");
  assert.equal(R.plate[1], Number((R.rect.z1 - R.rect.z0).toFixed(6)),
    "roof.plate[1] must BE the rectangle the module builds");
  /* A hipped roof of w x d has a ridge of w - d, and hipRoofGeometry builds
     exactly that; ridgeRise follows from the plate and the pitch. */
  assert.ok(Math.abs(R.ridgeLength - (R.plate[0] - R.plate[1])) < 1e-9,
    `ridgeLength ${R.ridgeLength} is not plate[0] - plate[1]`);
  assert.ok(Math.abs(R.ridgeRise - (R.plate[1] / 2) * Math.tan(R.pitch)) < 5e-4,
    `ridgeRise ${R.ridgeRise} is not (d/2) tan(pitch)`);
  /* The tea house's battened face is its plan less two corner reveals. */
  const C = section.teaHouse.cube;
  assert.ok(Math.abs(C.battenedFace - (C.size - 2 * C.cornerReveal)) < 1e-9,
    `battenedFace ${C.battenedFace} is not size - 2 x cornerReveal`);
  assert.equal(Math.round(C.battenedFace / section.teaHouse.battens.pitch),
    section.teaHouse.battens.perFace,
    "perFace must be what the battened face divided by the measured pitch gives");
  /* Every boulder must fall inside the range the setting declares. */
  const BO = section.teaHouse.setting.boulders;
  for (const [, , r] of BO.list) {
    assert.ok(r * 2 >= BO.range[0] - 1e-9 && r * 2 <= BO.range[1] + 1e-9,
      `a boulder is ${(r * 2).toFixed(2)} m across, outside the declared ${BO.range.join("-")} m`);
  }
  /* The court stair's tread and rise are derived from its own rectangle. */
  const st = section.courtStair.stair;
  assert.ok(Math.abs(st.tread - (st.rect.z1 - st.rect.z0) / st.risers) < 1e-5,
    "the court stair's tread must be run / risers");
  assert.ok(Math.abs(st.riser - st.totalRise / st.risers) < 1e-9,
    "the court stair's riser must be rise / risers");
  /* And the terrace stair's, and its bays sit on their counter. */
  const ts = section.bbq.stair;
  assert.ok(Math.abs(ts.tread - (ts.u1 - ts.u0) / ts.risers) < 1e-9,
    "the terrace stair's tread must be run / risers");
  assert.equal(ts.landing.u0, ts.u1, "the landing starts where the last nosing ends");
  assert.equal(section.bbq.grill.bays.sill, section.bbq.grill.counter.h,
    "a drop-in bay's sill IS the counter it drops into");
  /* The bench's shadow gap is one seat slab deep, and the module reads both. */
  const bench = section.meditation.bench;
  assert.equal(bench.ledGap, bench.slab, "the shadow gap is one seat slab deep");
  /* The gravel ring is twice the widest stone; the recess is half the gap. */
  const S2 = section.meditation.stones;
  assert.ok(Math.abs(S2.gravelRing - 2 * S2.plan[1]) < 1e-9,
    "the gravel ring must be twice the widest stone's plan width");
  assert.ok(Math.abs(S2.gravelRecess - bench.ledGap / 2) < 1e-9,
    "the ring's recess is half the pavilion's smallest declared reveal");
  /* The turf rug is the chair cluster plus a margin, clipped at the planters. */
  const B2 = section.bbq, AD = B2.adirondack.product, TU = B2.turf;
  const us = B2.adirondack.onTurf.map((a) => a.u), vs = B2.adirondack.onTurf.map((a) => a.v);
  const marg = 0.4;
  assert.ok(Math.abs(TU.u0 - (Math.min(...us) - AD.w / 2 - marg)) < 1e-9, "turf u0");
  assert.ok(Math.abs(TU.u1 - (Math.max(...us) + AD.w / 2 + marg)) < 1e-9, "turf u1");
  assert.ok(Math.abs(TU.v0 - (Math.min(...vs) - AD.d / 2 - marg)) < 1e-9, "turf v0");
  const clip = B2.conicalPlanters.list[0].v - B2.conicalPlanters.topDia / 2;
  assert.ok(Math.abs(TU.v1 - Math.min(Math.max(...vs) + AD.d / 2 + marg, clip)) < 1e-9,
    "turf v1 must be the margin, clipped at the conical-planter row's south tangent");
});

test("the tea house is relocated onto the measured gap, and the gap is real", () => {
  const T = section.measured.teaHouse;
  /* Re-derive the gap from the shipped ring rather than trusting the copy. */
  const R = G["courtyard-1159"].points;
  let widest = 0, atZ = 0;
  for (let k = 0; k <= 70; k++) {
    const z = Math.round((571.4 + k * 0.1) * 100) / 100;
    const xs = spanAt(R, z), spans = [];
    for (let i = 0; i + 1 < xs.length; i += 2) spans.push([xs[i], xs[i + 1]]);
    for (let i = 0; i + 1 < spans.length; i++) {
      const a = spans[i][1], b = spans[i + 1][0];
      if (b - a > 2 && a < -80 && b > -92 && b - a > widest) { widest = b - a; atZ = z; }
    }
  }
  assert.ok(widest > 5, `the surveyed gap should open past 5 m; widest ${widest.toFixed(2)} at z ${atZ}`);
  /* The plan-derived centroid and the surveyed gap agree inside the plan's own
     validation residual. That agreement IS the relocation's evidence. */
  const [px, pz] = [-85.9, 575.3];
  const d = Math.hypot(T.gapCentroid[0] - px, T.gapCentroid[1] - pz);
  assert.ok(d < 1.5, `plan centroid and surveyed gap centroid are ${d.toFixed(2)} m apart`);
  /* And the shipped position is 50 m+ from where the eighth section puts it. */
  const moved = Math.hypot(section.teaHouse.position[0] + 142.3, section.teaHouse.position[1] - 599.0);
  assert.ok(moved > 50, `the relocation must be the real one: only ${moved.toFixed(1)} m`);
  assert.match(section.teaHouse.positionNote, /2025/);
  assert.match(section.teaHouse.rotNote, /\[estimated\]/);
});

test("the court stair is clipped by the surveyed planting bed, and the tiers are retired", () => {
  const CS = section.measured.courtStair;
  const bed = G["planting-bed-1760"].points;
  const east = Math.max(...bed.map(([x]) => x));
  assert.ok(Math.abs(CS.clippedRect.x0 - east) < 0.02,
    `the clip must land on the bed's measured east edge ${east}, not ${CS.clippedRect.x0}`);
  assert.ok(CS.clippedRect.x0 > CS.planRect.x0, "the clip must actually narrow the plan rectangle");
  /* CLIP GENUINELY RESPECTED: no stair geometry stands inside the bed. */
  const { solids } = build();
  for (const s of solids) {
    if (s.z < 533 || s.z > 539.5) continue;
    assert.ok(!inPoly(s.x, s.z, bed),
      `${s.name} at (${s.x.toFixed(2)}, ${s.z.toFixed(2)}) stands inside planting-bed-1760`);
  }
  /* The retirement has to be on the record, by id, with a reason each. */
  const tiers = section.supersedes.filter((s) => /amphitheatre-tier/.test(s.id));
  assert.equal(tiers.length, 3, "all three shipped amphitheatre-tier items must be superseded");
  for (const t of tiers) assert.ok(t.why && t.why.length > 30, `no reason given for ${t.id}`);
  assert.match(section.courtStair.retires, /2021/);
  assert.match(section.courtStair.retires, /2025/);
});

test("supersedes names ids and gives a reason for every one", () => {
  assert.ok(Array.isArray(section.supersedes) && section.supersedes.length >= 40,
    `only ${section.supersedes?.length} superseded items — this list does not shrink either`);
  const wanted = ["tea-house", "fire-feature", "medit-roof", "medit-plinth",
    "medit-screen-w", "bbq-counter", "bbq-canopy", "adirondack-1"];
  for (const id of wanted) {
    assert.ok(section.supersedes.some((s) => s.id.startsWith(id)),
      `${id} is replaced by this section and must be named in supersedes`);
  }
  for (const s of section.supersedes) {
    assert.match(s.id, /\(/, `${s.id} must name the shipped item type in brackets`);
    assert.ok(s.why.length > 40, `${s.id}'s reason is too thin`);
  }

  /* COMPLETENESS, not a spot check. Round one named 27 items and left three
     standing in the four areas it takes over — including `medit-ramp`, a 7.6 m
     lit rail running straight down the middle of the new pavilion deck, and
     `tea-boulders` / `tea-gravel`, the old tea house's setting left in the
     western Ramble after the object moved 57 m east. So the gate is now every
     shipped item in every area this section owns, resolved by key against the
     shipped document, plus the six loose `furniture` items it replaces. */
  const items = merged.eighth?.items;
  assert.ok(Array.isArray(items), "the shipped eighth item list must be readable");
  const named = new Set(section.supersedes.map((s) => s.id.split(" ")[0]));
  const MINE = ["bbq", "amphitheatre", "meditation", "teaHouse"];
  const stranded = items.filter((e) => MINE.includes(e.area) && !named.has(e.key)).map((e) => e.key);
  assert.deepEqual(stranded, [],
    `${stranded.length} shipped items stand in areas this section rebuilds and are not named in supersedes`);
  for (const key of ["fire-feature", "fire-seat-wall", "adirondack-1", "adirondack-2",
    "adirondack-3", "adirondack-4"]) {
    assert.ok(named.has(key), `${key} is rebuilt on this terrace and must be named in supersedes`);
  }
  /* And no supersedes entry may name an item that does not exist. */
  for (const key of named) {
    assert.ok(items.some((e) => e.key === key), `supersedes names ${key}, which is not a shipped item`);
  }
  /* The three the audit caught, by name, with the reason each was stranded. */
  const why = (k) => section.supersedes.find((s) => s.id.startsWith(k)).why;
  assert.match(why("medit-ramp"), /deck|drum/i, "medit-ramp must say it runs through the new pavilion");
  assert.match(why("tea-boulders"), /relocat|moved|57/i, "tea-boulders must say the relocation orphaned it");
  assert.match(why("tea-gravel"), /relocat|moved|57/i, "tea-gravel must say the relocation orphaned it");
});

test("the absent list is long, specific and does not shrink", () => {
  assert.ok(Array.isArray(section.absent) && section.absent.length >= 24,
    `absent has ${section.absent?.length} entries — better absent than wrong, and this list does not shrink`);
  for (const a of section.absent) {
    assert.equal(typeof a, "string");
    assert.ok(a.length > 60, `absent entry too thin: ${a}`);
  }
  const must = [
    /stepped seat edge/i,       /* the measured steps that do not fit */
    /pitch/i,                   /* the unsourced roof angle */
    /soffit/i,                  /* the single-frame 2.08 m */
    /third grill bay/i,         /* still exactly two */
    /tree/i,                    /* the planters ship empty */
    /courtKey|gold/i,           /* the court corrections, recorded not built */
    /species/i,
    /mid-construction/i,        /* the Google epoch negative */
    /MEANS OF ACCESS/i,         /* the deck ships with no built step, and says so */
    /BAMBOO ITSELF/i,           /* whose remit the garden's planting is */
    /RIDGE BEARING/i,           /* the tea house roof direction, unresolved */
    /PLATE PAVING MOSAIC/i,     /* real, unregistered, on nobody's ring */
  ];
  for (const re of must) {
    assert.ok(section.absent.some((a) => re.test(a)), `absent must still declare ${re}`);
  }
});

test("the module builds, and the counts are exactly what the section declares", () => {
  const { counts } = build();
  for (const [k, v] of Object.entries(section.counts)) {
    assert.equal(counts[k], v, `${k}: built ${counts[k]}, section declares ${v}`);
  }
  assert.equal(counts.teaWallBattens, section.teaHouse.battens.perFace * 4,
    "26 battens a face on four faces — the arbitrated module, not the round-one 66, which was one scan run across BOTH visible faces of the cube and then attributed to one");
  /* SOLIDS AND DRAWS ARE PINNED IN THE SECTION, above, like every other count,
     so a change that moves geometry without moving a family count still has to
     be declared. The floor below is what remains of the old `> 1500`, and it is
     RE-BASELINED, downward, on purpose: 1500 was reachable only because two
     screen arcs spanned more than a full circle and built 132 coincident
     duplicate solids. The honest build of the same section is 1423. Reading a
     duplicate as evidence of an ultra treatment is exactly backwards, so the
     floor now sits just under the real figure and the pin above does the work. */
  assert.ok(counts.solids >= 1400, `only ${counts.solids} solids — this is not an ultra treatment`);
  assert.ok(counts.draws < 90, `${counts.draws} draw calls — instance harder`);
});

/**
 * The height of the surface a thing at (x, z) is actually drawn as standing
 * on: the terrain, unless one of this section's own draped decals covers that
 * point, in which case it is the decal — the bark field, the tea house cobble,
 * the terrace pavers, the turf rug. Read off the built triangles, not from a
 * copy of the module's lift arithmetic.
 */
function drawnSurface(x, z) {
  let y = ground(x, z);
  for (const [A, B, C] of build().decals) {
    const d = (B[2] - C[2]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[2] - C[2]);
    if (Math.abs(d) < 1e-12) continue;
    const a = ((B[2] - C[2]) * (x - C[0]) + (C[0] - B[0]) * (z - C[2])) / d;
    const b = ((C[2] - A[2]) * (x - C[0]) + (A[0] - C[0]) * (z - C[2])) / d;
    const c = 1 - a - b;
    if (a < -1e-9 || b < -1e-9 || c < -1e-9) continue;
    y = Math.max(y, a * A[1] + b * B[1] + c * C[1]);
  }
  return y;
}

test("nothing hovers: every solid meets the ground or touches its carrier", () => {
  const { solids } = build();
  const orphans = [];
  for (const it of solids) {
    /* WHAT READS AS GROUND IS THE DECAL WHERE THERE IS ONE. This section draws
       four draped surfaces and 130 of its solids stand on them — every chair,
       table, planter and counter on the BBQ terrace, the turf-rug Adirondacks,
       the tea plinth. Measured from the raw terrain those all read as floating
       by exactly their rung's lift (0.09 m on `pad`, 0.13 m on `carpet`), and
       measured from the terrain they were, until this repair, drawn 90 mm
       INSIDE the surface they stand on. So the datum here is the surface the
       module actually drew, read off its own triangles. */
    if (it.b.min.y <= drawnSurface(it.x, it.z) + 0.06) continue;
    let ok = false;
    for (const j of solids) {
      if (j === it) continue;
      if (j.b.min.y > it.b.min.y + 0.02) continue;      /* a carrier starts no higher */
      if (j.b.max.y < it.b.min.y - 0.06) continue;      /* and reaches this thing's base */
      if (it.b.max.x < j.b.min.x - 0.02 || it.b.min.x > j.b.max.x + 0.02) continue;
      if (it.b.max.z < j.b.min.z - 0.02 || it.b.min.z > j.b.max.z + 0.02) continue;
      ok = true; break;
    }
    if (!ok) orphans.push(`${it.name} at (${it.x.toFixed(2)}, ${it.z.toFixed(2)}) base +${(it.b.min.y - drawnSurface(it.x, it.z)).toFixed(2)}`);
  }
  assert.deepEqual(orphans, [], `${orphans.length} solids float free`);
});

test("nothing is buried: every solid still shows above the drawn ground", () => {
  const { solids } = build();
  for (const it of solids) {
    assert.ok(it.b.max.y > ground(it.x, it.z),
      `${it.name} at (${it.x.toFixed(2)}, ${it.z.toFixed(2)}) is entirely under the drawn ground`);
  }
});

test("the stacks are contiguous: deck -> drums -> soffit -> fascia -> roof", () => {
  const M = section.meditation;
  const { solids } = build();
  const min = (name) => Math.min(...solids.filter((s) => s.name === name).map((s) => s.b.min.y));

  /* The deck slab is the one board-formed casting that spans the whole deck
     rectangle — boardConcrete also builds the tea house plinth and the stair
     cheeks, so pick it by footprint rather than by name. */
  const deckSlabs = solids.filter((s) => s.name === "box-boardConcrete"
    && s.b.max.x - s.b.min.x > 12 && s.b.max.z - s.b.min.z > 6);
  assert.ok(deckSlabs.length >= 1, "no deck slab found");
  const deckTop = Math.max(...deckSlabs.map((s) => s.b.max.y));
  const screenBase = min("box-woodScreen");
  assert.ok(Math.abs(screenBase - deckTop) < 0.001,
    `the screen must stand ON the deck: base ${screenBase}, deck top ${deckTop}`);
  const screenTop = deckTop + M.drums.screen.height;
  const soffitBase = min("box-pavilionSoffit");
  assert.ok(Math.abs(soffitBase - screenTop) < 0.001,
    `the soffit must sit on the screen: ${soffitBase} vs ${screenTop}`);
  const fasciaBase = min("box-pavilionFascia");
  assert.ok(fasciaBase >= soffitBase - 0.001 && fasciaBase <= soffitBase + 0.07,
    `the fascia must ride the soffit: ${fasciaBase} vs ${soffitBase}`);
  const roofBase = min("box-pavilionRoof");
  assert.ok(roofBase >= fasciaBase, "the roof plate must sit above the fascia it caps");

  /* The court stair's treads are a contiguous flight, not a stack of slabs. */
  const st = section.courtStair.stair;
  assert.ok(Math.abs(st.risers * st.riser - st.totalRise) < 1e-9,
    "the declared rise must be risers x riser, with no residual");
  assert.ok(Math.abs(st.tread * st.risers - (st.rect.z1 - st.rect.z0)) < 0.01,
    "the treads must exactly fill the plan rectangle's depth");
});

test("every clip is genuinely respected — the clipped things are ABSENT, not merely declared", () => {
  const { verts, counts } = build();
  const o = section.measured.spine.opening;
  const bark = verts.filter((v) => v.name === "meditation-bark");
  assert.ok(bark.length > 0, "the bark field must exist");
  for (const v of bark) {
    assert.ok(v.x >= o.x0 - 0.01 && v.x <= o.x1 + 0.01 && v.z >= o.z0 - 0.01 && v.z <= o.z1 + 0.01,
      `bark vertex (${v.x.toFixed(2)}, ${v.z.toFixed(2)}) escapes the measured opening`);
    assert.ok(!inPoly(v.x, v.z, G["courtyard-328"].points),
      "the bark field must never paint over courtyard-328");
    assert.ok(!inPoly(v.x, v.z, G["courtyard-329"].points),
      "the bark field must never paint over courtyard-329");
  }
  /* Probe the other way: the courtyards are NOT covered anywhere. */
  for (const [px, pz] of [[-185.0, 587.9], [-165.0, 587.9], [-183.0, 580.0]]) {
    assert.ok(!(px >= o.x0 && px <= o.x1 && pz >= o.z0 && pz <= o.z1),
      `(${px}, ${pz}) is on a surveyed courtyard and must be outside the bark clip`);
  }

  const cob = verts.filter((v) => v.name === "tea-cobble");
  assert.ok(cob.length > 0, "the cobble bed must exist");
  for (const v of cob) {
    assert.ok(inPoly(v.x, v.z, section.measured.teaHouse.gap) ||
      section.measured.teaHouse.gap.some(([gx, gz]) => Math.hypot(gx - v.x, gz - v.z) < 0.02),
      `cobble vertex (${v.x.toFixed(2)}, ${v.z.toFixed(2)}) escapes the measured gap`);
  }

  /* ARBITRATED 2026-08-19: arcgis.ground#2369 is THE SUN LAWN, not paving, so
     this section may put NOTHING on it. The plate mosaic and its checker
     infill are gone from the data and from the module; the gate is now the
     absence of any vertex of this section's inside that ring. */
  const ring = G["courtyard-2369"].points;
  assert.equal(section.bbq.plateMosaic, undefined,
    "the plate mosaic has no registered extent and must not be clipped to the Sun Lawn");
  assert.ok(section.absent.some((a) => /PLATE PAVING MOSAIC/i.test(a)),
    "the mosaic is real but unregistered and must stay declared in absent");
  for (const v of verts) {
    assert.ok(!inPoly(v.x, v.z, ring),
      `${v.name} puts a vertex at (${v.x.toFixed(2)}, ${v.z.toFixed(2)}) inside courtyard-2369, which is the Sun Lawn`);
  }
});

test("nothing escapes the declared envelopes", () => {
  const { solids, verts } = build();
  const env = section.envelopes;
  assert.ok(Array.isArray(env) && env.length >= 4);
  const inside = (x, z) => env.some((e) => x >= e.x0 && x <= e.x1 && z >= e.z0 && z <= e.z1);
  for (const s of solids) {
    assert.ok(inside(s.x, s.z),
      `${s.name} at (${s.x.toFixed(2)}, ${s.z.toFixed(2)}) is outside every declared envelope`);
  }
  for (const v of verts) {
    assert.ok(inside(v.x, v.z),
      `${v.name} vertex (${v.x.toFixed(2)}, ${v.z.toFixed(2)}) is outside every declared envelope`);
  }
  /* And every envelope is anchored to a surveyed ring, not drawn by hand. */
  for (const e of env) assert.match(e.from, /arcgis\.ground#|plan/);
});

test("the loose objects stand on the surveyed rings they claim", () => {
  const M = section.meditation;
  for (const s of [...M.slabStones.list, ...M.seatPods.list]) {
    assert.ok(inPoly(s.x, s.z, G["courtyard-328"].points) || inPoly(s.x, s.z, G["courtyard-329"].points),
      `(${s.x}, ${s.z}) claims a surveyed courtyard and is on neither`);
  }
  /* THE FAMILIES THIS SECTION NO LONGER OWNS. Arbitration 2026-08-19 gave the
     charcoal planter cubes to eighthcourtyards' Bamboo Garden, and the terrace's
     site lighting, bike hoops and pale planter boxes to eighthsiteworks and
     eighthramble. A handed-over family that quietly comes back is a duplicate
     nobody sees, so the gate is that they are GONE from data and from build. */
  assert.equal(M.planterCubes, undefined, "the charcoal cubes are eighthcourtyards' Bamboo Garden family");
  for (const k of ["lighting", "bikeRacks", "planterCubes"]) {
    assert.equal(section.bbq[k], undefined, `bbq.${k} was handed over and must not return`);
  }
  const { counts: cts } = build();
  for (const k of ["meditationPlanterCubes", "whitePlanterCubes", "bikeHoops", "bollards", "poleA", "poleB"]) {
    assert.equal(cts[k], undefined, `the module still builds ${k}, which this section handed over`);
  }
  for (const a of [/SITE LIGHTING ON THE BBQ TERRACE/i, /BIKE PARKING ON THE BBQ TERRACE/i,
    /WHITE PRECAST PLANTER CUBES/i, /CHARCOAL PLANTER CUBES/i]) {
    assert.ok(section.absent.some((s) => a.test(s)), `the hand-over ${a} must stay declared in absent`);
  }
  const S = section.teaHouse.setting;
  const R = G["courtyard-1159"].points;
  for (const [x, z] of [...S.boulders.list.map((b) => [b[0], b[1]]), ...S.rushes.list,
    ...S.agaves.list, S.poleLight.at]) {
    assert.ok(inPoly(x, z, R), `tea house setting object (${x}, ${z}) is off courtyard-1159`);
  }
  /* And every BBQ item is inside the surveyed terrace ring. */
  const F = section.measured.bbqTerrace.frame;
  const c = Math.cos(F.rotY), s = Math.sin(F.rotY);
  const W = (u, v) => [F.origin[0] + u * c + v * s, F.origin[1] - u * s + v * c];
  const ring = G["courtyard-2375"].points;
  const B = section.bbq;
  const lists = [B.adirondack.aroundFire, B.adirondack.onTurf, B.drinkTables.list,
    B.wireChairs.list, B.sageChairs.list, B.cafeTables.list, B.picnicTables.list,
    B.plankBenches.list, B.conicalPlanters.list];
  for (const l of lists) {
    for (const o of l) {
      const [x, z] = W(o.u, o.v);
      assert.ok(inPoly(x, z, ring),
        `a BBQ item at local (${o.u}, ${o.v}) -> (${x.toFixed(2)}, ${z.toFixed(2)}) is off courtyard-2375`);
    }
  }
});

/* ------------------------------------------------- the BBQ terrace SAT gate */

/* An oriented footprint in the terrace's own measured (u, v) frame. */
function bbqFootprints(B) {
  const out = [];
  const rect = (id, u, v, w, d, rot = 0) => out.push({ id, u, v, w, d, rot });
  const ct = B.grill.counter;
  rect("grill-counter", ct.u, ct.v, ct.w + ct.topProud * 2, ct.d + ct.topProud * 2);
  rect("grill-splashback", ct.u, ct.v - ct.d / 2 - 0.05, ct.w, 0.1);
  const EX = B.grill.extinguisher;
  rect("extinguisher", EX.u, EX.v, EX.cabinet[0], EX.cabinet[2]);
  rect("fire-wall", B.fire.u, B.fire.v, B.fire.wall[0], B.fire.wall[2]);
  const AD = B.adirondack.product;
  B.adirondack.aroundFire.forEach((a, i) => rect(`adirondack-fire-${i}`, a.u, a.v, AD.w, AD.d, a.rot));
  B.adirondack.onTurf.forEach((a, i) => rect(`adirondack-turf-${i}`, a.u, a.v, AD.w, AD.d, a.rot));
  B.drinkTables.list.forEach((t, i) => rect(`drinkTables-${i}`, t.u, t.v, B.drinkTables.top, B.drinkTables.top));
  B.wireChairs.list.forEach((o, i) => rect(`wireChairs-${i}`, o.u, o.v, B.wireChairs.w, B.wireChairs.d, o.rot || 0));
  B.sageChairs.list.forEach((o, i) => rect(`sageChairs-${i}`, o.u, o.v, B.sageChairs.w, B.sageChairs.d, o.rot || 0));
  B.cafeTables.list.forEach((t, i) => rect(`cafeTables-${i}`, t.u, t.v, B.cafeTables.top, B.cafeTables.top));
  B.picnicTables.list.forEach((t, i) => rect(`picnicTables-${i}`, t.u, t.v, B.picnicTables.w, B.picnicTables.d));
  B.plankBenches.list.forEach((o, i) => rect(`plankBenches-${i}`, o.u, o.v, B.plankBenches.w, B.plankBenches.d, o.rot || 0));
  B.conicalPlanters.list.forEach((o, i) => rect(`conicalPlanters-${i}`, o.u, o.v, B.conicalPlanters.topDia, B.conicalPlanters.topDia));
  const CN = B.canopy;
  for (const [du, dv] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    rect(`canopy-post-${du}${dv}`, CN.u + du * (CN.w / 2 - 0.3), CN.v + dv * (CN.d / 2 - 0.3),
      CN.basePlate[0], CN.basePlate[0]);
  }
  const EN = B.enclosure;
  rect("enclosure", EN.u, EN.v, EN.w + EN.coping[1] * 0.5, EN.d + EN.coping[1] * 0.5);
  const ST = B.stair;
  rect("stair", (ST.u0 + ST.landing.u1) / 2, (ST.v0 + ST.v1) / 2,
    ST.landing.u1 - ST.u0, ST.v1 - ST.v0);
  return out;
}
/** Depth along the minimum-overlap separating axis; <= 0 means genuinely apart. */
function penetration(A, Bx) {
  const corners = (o) => {
    const c = Math.cos(o.rot), s = Math.sin(o.rot), hw = o.w / 2, hd = o.d / 2;
    return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]]
      .map(([a, b]) => [o.u + a * c - b * s, o.v + a * s + b * c]);
  };
  const pa = corners(A), pb = corners(Bx);
  let best = Infinity;
  for (const poly of [pa, pb]) {
    for (let i = 0; i < 4; i++) {
      const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % 4];
      const L = Math.hypot(x1 - x0, y1 - y0);
      if (!L) continue;
      const nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
      const pr = (p) => p.map(([x, y]) => x * nx + y * ny);
      const A1 = pr(pa), B1 = pr(pb);
      const ov = Math.min(Math.max(...A1), Math.max(...B1)) - Math.max(Math.min(...A1), Math.min(...B1));
      if (ov < best) best = ov;
      if (best <= 0) return best;
    }
  }
  return best;
}

test("NOTHING INTERSECTS on the BBQ terrace: pairwise oriented footprints", () => {
  /* The round-one arrangement passed every gate in this file with 26 solid-solid
     intersections in it — a chair standing inside a conical planter — because
     the only intersection gate covered the three pavilion drums. This is that
     gate for the terrace, and it runs over the SHIPPED numbers so the
     arrangement solve declared in bbq.arrangement cannot rot. */
  const B = section.bbq;
  const A = B.arrangement;
  assert.ok(A, "the terrace must declare the arrangement that owns its positions");
  assert.equal(A.tier, "estimated", "every (u, v) on this terrace is estimated and must say so");
  assert.match(A.note, /\[estimated\]/);
  assert.match(A.solve, /26/, "the solve must record the defect it fixes");

  const fps = bbqFootprints(B);
  assert.ok(fps.length >= 55, `only ${fps.length} terrace footprints — the check must cover the terrace`);
  const exempt = new Set(A.tuckPairs.map(([a, i, b, j]) => `${a}-${i}|${b}-${j}`));
  const bad = [];
  for (let i = 0; i < fps.length; i++) {
    for (let j = i + 1; j < fps.length; j++) {
      const p = penetration(fps[i], fps[j]);
      if (p <= A.separation) continue;
      if (exempt.has(`${fps[i].id}|${fps[j].id}`) || exempt.has(`${fps[j].id}|${fps[i].id}`)) continue;
      bad.push(`${fps[i].id} x ${fps[j].id} by ${p.toFixed(3)} m`);
    }
  }
  assert.deepEqual(bad, [], `${bad.length} solid-solid intersections on the BBQ terrace`);

  /* THE EXEMPTION IS CHECKED, NOT TRUSTED. A chair tucked under a cafe table is
     only legal if nothing of the two meets in 3D and the chair's tall members
     stand on the far side from the table. Both are re-derived here. */
  const CT = B.cafeTables, WC = B.wireChairs;
  const underside = CT.height - 0.05;          /* the top disc's own underside */
  const seatTop = WC.seat + 0.03;              /* the seat slab's top face */
  assert.ok(Math.abs(A.tuckClear - (underside - seatTop)) < 1e-9,
    `tuckClear ${A.tuckClear} is not the table underside less the seat top`);
  assert.ok(A.tuckClear > 0.05, "a tucked chair must genuinely clear the table it is under");
  assert.ok(WC.h > underside, "the chair back is taller than the table — which is why the far-side check matters");
  for (const [ca, ci, ta, ti] of A.tuckPairs) {
    const ch = B[ca].list[ci], tb = B[ta].list[ti];
    assert.ok(ch && tb, `tuckPairs names ${ca}[${ci}] x ${ta}[${ti}], which does not exist`);
    /* The chair's local +v axis must point at the table: the tall back legs and
       the back slats are built on local -v. */
    const rot = ch.rot || 0;
    const dot = Math.sin(rot) * (tb.u - ch.u) + Math.cos(rot) * (tb.v - ch.v);
    assert.ok(dot > 0,
      `${ca}[${ci}] is tucked under ${ta}[${ti}] with its BACK toward the table (dot ${dot.toFixed(3)})`);
    /* And it really is tucked — an exemption for a pair that does not overlap
       would let a genuine intersection hide behind it later. */
    const f = (id) => fps.find((x) => x.id === id);
    assert.ok(penetration(f(`${ca}-${ci}`), f(`${ta}-${ti}`)) > A.separation,
      `${ca}[${ci}] x ${ta}[${ti}] is exempt but does not overlap — a dead exemption`);
  }
  assert.equal(A.tuckPairs.length, 8, "eight chairs are tucked; any more must be argued, not assumed");
});

test("the fire feature is a wall with an opening, not a floating pane", () => {
  const F = section.bbq.fire;
  assert.ok(F.wall[0] >= 3.5, "the sourced wall is 4.0 m long");
  assert.ok(F.opening[0] < F.wall[0] - 0.5, "the firebox must sit inside its wall with piers each side");
  assert.ok(F.sill + F.opening[1] <= F.wall[1], "the opening must fit under the wall's own head");
  assert.ok(F.courses * F.courseHeight >= F.wall[1] - 0.05,
    "the declared courses must add up to the wall height");
  const { solids } = build();
  const glass = solids.filter((s) => s.name === "box-fireGlass");
  assert.equal(glass.length, 1, "one firebox pane");
  const wall = solids.filter((s) => s.name === "box-fireWall");
  assert.ok(wall.length >= 4, `the wall must be built in courses with piers: only ${wall.length} blocks`);
  /* The pane sits inside the wall's own y-range, which is what makes it a firebox. */
  const wtop = Math.max(...wall.map((w) => w.b.max.y));
  assert.ok(glass[0].b.max.y < wtop, "the pane must be set into the wall, not stand proud of it");
});

/* --------------------------------------------------- the per-figure gate */

const AREAS = ["meditation", "teaHouse", "courtStair", "bbq"];
const TIERS = ["measured", "sourced", "derived", "product", "estimated"];
/* A figure is a number, a tuple of numbers, or a LIST of tuples of numbers.
   The third case is `drums.list[].arcs`, which is the single most load-bearing
   derivation in this section — two of its six angles were on the wrong branch,
   which built 78 coincident panels and sealed two of the three chambers — and
   it was invisible to this walk while a tuple of two numbers beside it was
   not. A shape a figure can hide behind is a shape this gate has to see. */
const isNum = (v) => typeof v === "number"
  || (Array.isArray(v) && v.length > 0 && v.every((q) => typeof q === "number"))
  || (Array.isArray(v) && v.length > 0 && v.every((q) => Array.isArray(q)
    && q.length > 0 && q.every((n) => typeof n === "number")));
const LISTS = new Set(["list", "aroundFire", "onTurf"]);

/** Every numeric figure a tier-carrying node owns, as a dotted key. */
function ownedFigures(node) {
  const out = [];
  const walk = (n, prefix) => {
    for (const [k, v] of Object.entries(n)) {
      if (k === "tier" || k === "count" || k === "figures") continue;
      /* A position list is a list before it is a figure: its entries are
         covered one by one below, not collapsed into a single claim. */
      if (isNum(v) && !LISTS.has(k)) { out.push(prefix + k); continue; }
      if (LISTS.has(k) && Array.isArray(v)) {
        /* A position list is covered collectively: `list.<key>` for objects,
           `list[].<index>` for tuple entries. Entries that carry their own
           `figures` (the drums, the standing stones) answer for themselves. */
        for (const e of v) {
          if (e && typeof e === "object" && !Array.isArray(e)) {
            if (e.figures) continue;
            for (const [ek, ev] of Object.entries(e)) if (isNum(ev)) out.push(`${prefix}list.${ek}`);
          } else if (Array.isArray(e)) {
            e.forEach((ev, i) => { if (typeof ev === "number") out.push(`${prefix}list[].${i}`); });
          }
        }
        continue;
      }
      if (v && typeof v === "object" && !Array.isArray(v) && typeof v.tier !== "string") {
        walk(v, prefix + k + ".");
      }
    }
  };
  walk(node, "");
  return [...new Set(out)];
}

test("EVERY figure is tiered at the figure, not at the subsystem", () => {
  /* The shipped `eighth` section tiers per figure INSIDE its source string
     ("counter run reads ~4.6 m ... Depth [estimated]"). Round one coarsened
     that to one flag per subsystem, and 22 of 40 "measured" subsystems then
     hedged in their own prose while nothing checked them — flipping three
     subsystems from estimated to measured passed every gate. This is the gate
     that makes the claim mean something: every numeric figure a tiered node
     owns must carry its own tier and its own reason, and the subsystem's tier
     is derived FROM the figures rather than asserted above them. */
  const nodes = [];
  const walk = (node, path) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach((n, i) => walk(n, `${path}[${i}]`)); return; }
    if (typeof node.tier === "string") nodes.push([path, node]);
    for (const [k, v] of Object.entries(node)) walk(v, `${path}.${k}`);
  };
  for (const key of AREAS) walk(section[key], key);
  assert.ok(nodes.length >= 40, `only ${nodes.length} tiered subsystems`);

  let figures = 0, estimated = 0;
  for (const [path, node] of nodes) {
    const owned = ownedFigures(node);
    const declared = node.figures || {};
    for (const key of owned) {
      assert.ok(declared[key], `${path}.${key} is a figure with no entry in \`figures\``);
    }
    for (const key of Object.keys(declared)) {
      assert.ok(owned.includes(key), `${path}.figures names ${key}, which is not a figure of this node`);
    }
    for (const [key, why] of Object.entries(declared)) {
      figures++;
      const m = /^\[(measured|sourced|derived|product|estimated)\]/.exec(why);
      assert.ok(m, `${path}.${key} does not open with a tier: ${why.slice(0, 60)}`);
      assert.ok(why.length > 40, `${path}.${key}'s reason is too thin: ${why}`);
      if (m[1] === "estimated") {
        estimated++;
        assert.ok(/extend|arrangement|no frame|nothing registers|no source|not resolved|carried/i.test(why),
          `${path}.${key} is [estimated] and must say what it extends or why nothing does: ${why}`);
      }
      if (m[1] === "product") {
        assert.ok(/\b(in|inch|standard|module|product)\b/i.test(why),
          `${path}.${key} claims a product step and must name it: ${why}`);
      }
    }
    /* The subsystem tier is a SUMMARY of its figures and may not overstate.
       ONE DECLARED EXCEPTION: bbq.arrangement's tier is a statement about the
       positions it owns in OTHER nodes — every (u, v) and rot on the terrace —
       and not about its own two tolerances, which are derived. Every one of
       those positions carries `[estimated] arrangement` and points back here. */
    const vals = Object.values(declared);
    if (vals.length && path !== "bbq.arrangement") {
      const anyEst = vals.some((v) => v.startsWith("[estimated]"));
      const allEst = vals.every((v) => v.startsWith("[estimated]"));
      const want = anyEst ? (allEst ? "estimated" : "mixed") : node.tier;
      assert.equal(node.tier, want,
        `${path} is tier "${node.tier}" but its figures are ${allEst ? "all" : anyEst ? "partly" : "none"} estimated`);
      /* And a subsystem with nothing estimated still may not claim a tier none
         of its figures carries. `bbq.paving` was stamped "measured" while its
         one figure is a [product] step, and `bbq.turf` was "measured" while
         every figure is [derived] arithmetic — both true statements wearing a
         stronger word than they earned, which is the same coarsening at a
         smaller scale. So the summary must be one of the tiers underneath it,
         or "mixed" when there is more than one. */
      if (!anyEst) {
        const own = new Set(vals.map((v) => /^\[(\w+)\]/.exec(v)[1]));
        assert.ok(own.has(node.tier) || (own.size > 1 && node.tier === "mixed"),
          `${path} is tier "${node.tier}" but its figures are [${[...own].join("] [")}] — a summary may not outrank what it summarises`);
        assert.ok(TIERS.includes(node.tier) && node.tier !== "estimated",
          `${path} has no estimated figure and must not be tiered estimated`);
      }
    }
  }
  assert.ok(figures >= 200, `only ${figures} tiered figures across the section`);
  assert.ok(estimated > 0 && estimated < figures,
    "a section in which nothing is estimated, or everything is, is not being honest");

  /* And nothing may be stamped `measured` while its own prose hedges the size
     of what it is measuring. The `[estimated]` marker itself is no longer part
     of this test — the figures gate above now catches that exactly, at the
     figure — but a tilde, a "roughly" or a "5-6 risers" in a measured node's
     prose is a number nobody derived wearing a measurement's stamp, which is
     the regression this whole round exists to undo. */
  const HEDGE = /~\s*\d|\broughly\b|\babout \d|\bassumed\b|\d\s*-\s*\d\s*(risers|m\b)/i;
  for (const [path, node] of nodes) {
    if (node.tier !== "measured" && node.tier !== "sourced") continue;
    const prose = Object.entries(node)
      .filter(([k, v]) => typeof v === "string" && k !== "tier" && k !== "id" && k !== "on")
      .map(([, v]) => v).join(" ");
    assert.ok(!HEDGE.test(prose),
      `${path} is tier "${node.tier}" and hedges in its own prose: ${(HEDGE.exec(prose) || [])[0]}`);
  }
});

test("no declared figure is decorative — everything is read or re-derived", () => {
  /* Round one declared nine figures the module never read, including `plate`,
     which carries the whole photogrammetric derivation of the pavilion's
     headline dimension while the module built from `rect`. Changing it to
     [9, 5] passed all 21 gates. A figure that nothing consumes is a claim
     nobody can be wrong about, so every one of them must be named either in
     the module (which builds from it) or in this file (which re-derives it). */
  const mod = readFileSync(join(root, "docs/js/campus-photo-eighthgathering.js"), "utf8");
  const tst = readFileSync(fileURLToPath(import.meta.url), "utf8");
  const unread = [];
  const walk = (node, path) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach((n, i) => walk(n, `${path}[${i}]`)); return; }
    for (const key of Object.keys(node.figures || {})) {
      const leaf = key.split(".").pop().replace("[]", "");
      if (/^\d+$/.test(leaf)) continue;          /* a tuple slot, read by index */
      const re = new RegExp(`\\b${leaf.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
      if (!re.test(mod) && !re.test(tst)) unread.push(`${path}.${key}`);
    }
    for (const [k, v] of Object.entries(node)) walk(v, `${path}.${k}`);
  };
  for (const key of AREAS) walk(section[key], key);
  assert.deepEqual(unread, [], `${unread.length} declared figures nothing reads`);
});

test("the estimated tiers all say what sourced pattern they extend", () => {
  const walk = (node, path) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach((n, i) => walk(n, `${path}[${i}]`)); return; }
    if (node.tier === "estimated" || node.tier === "mixed") {
      const text = `${node.note || ""} ${node.derivation || ""} ${Object.values(node.figures || {}).join(" ")}`;
      assert.ok((node.extendsPattern && node.extendsPattern.length > 20)
        || /extend|\[estimated\]/i.test(text),
        `${path} is [${node.tier}] and does not say what it extends`);
    }
    for (const [k, v] of Object.entries(node)) walk(v, `${path}.${k}`);
  };
  for (const key of AREAS) walk(section[key], key);
});

test("deterministic: two builds are matrix-identical", () => {
  const dump = () => {
    const out = [];
    const r = createPhotoEighthGathering(null, {
      photo: { eighthgathering: section }, surfaceAt: ground,
    });
    const m = new THREE.Matrix4();
    r.group.traverse((o) => {
      if (o.isInstancedMesh) {
        out.push(o.name, String(o.count));
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, m);
          out.push(m.elements.map((v) => v.toFixed(6)).join(","));
        }
      } else if (o.isMesh) {
        const p = o.geometry.getAttribute("position");
        out.push(o.name, String(p.count));
        for (let i = 0; i < p.count; i++) {
          out.push(`${p.getX(i).toFixed(6)},${p.getY(i).toFixed(6)},${p.getZ(i).toFixed(6)}`);
        }
      }
    });
    return out.join("|");
  };
  assert.equal(dump(), dump(), "two loads must build the same geometry");
  const src = readFileSync(join(root, "docs/js/campus-photo-eighthgathering.js"), "utf8");
  assert.ok(!/Math\.random\s*\(/.test(src), "no Math.random() call in a deterministic module");
  assert.ok(!/new Date\(|Date\.now\s*\(/.test(src), "no clock in a deterministic module");
});

test("it degrades quietly and never writes back", () => {
  const empty = createPhotoEighthGathering(null, { photo: {}, surfaceAt: ground });
  assert.equal(empty.group.children.length, 0);
  assert.deepEqual(empty.counts, {});
  const noGround = createPhotoEighthGathering(null, { photo: { eighthgathering: section } });
  assert.equal(noGround.group.children.length, 0);

  /* One-way: the section it was handed is byte-identical afterwards. */
  const before = JSON.stringify(section);
  build();
  assert.equal(JSON.stringify(section), before, "the module must not write back into the photo document");

  /* And it parents into a scene when given one. */
  const scene = new THREE.Scene();
  createPhotoEighthGathering(scene, { photo: { eighthgathering: section }, surfaceAt: ground });
  assert.equal(scene.children.length, 1);
  assert.equal(scene.children[0].name, "photo-eighth-gathering");
});
