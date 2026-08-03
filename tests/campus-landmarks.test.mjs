/* The landmarks: the sculptures people actually steer by, and the colours
 * that make them recognisable at a hundred metres.
 *
 * These exist because the landmark colours were WRITTEN, not measured, and
 * writing them went wrong in the one way nothing catches. The Sun God was
 * described as "white fiberglass covered in bright multicolored splotches"
 * and built as a red bird with a gold head on a white arch. The statue is a
 * WHITE bird with a SCARLET head under a GOLD sunburst crest, standing on an
 * arch so buried in ivy that the concrete only shows at the cap — which is
 * roughly the model inverted, and rendered perfectly happily for months.
 *
 * So:
 *   1. Every colour is a real hex, and every landmark carries the fields the
 *      renderer and the labels read.
 *   2. The Sun God correction is pinned to the words that carry it. A future
 *      edit that quietly reinstates the splotches fails here.
 *   3. Fallen Star hangs off a SOUTH-WEST corner. The file said "SW" in its
 *      data and "northeast" in its prose, and nothing reconciled them.
 *   4. THE GUARD: no landmark colour is a literal in the renderer. Hexes
 *      belong in campus-landmarks.json, where they can be checked against a
 *      frame of footage; a hex in the JS is a colour no one can audit.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LANDMARKS = JSON.parse(
  readFileSync(path.join(ROOT, "docs/data/campus-landmarks.json"), "utf8")
);
const RENDERER = readFileSync(path.join(ROOT, "docs/js/campus-landmarks.js"), "utf8");
const CAMPUS = JSON.parse(readFileSync(path.join(ROOT, "docs/data/campus-3d.json"), "utf8"));

/* The walk itself, so a structure claimed to be "on the route" can be checked
   against the route rather than against a description of it. */
const { buildGraph, routeThrough } = await import(path.join(ROOT, "docs/js/campus-route.js"));
const WALK = routeThrough(CAMPUS, buildGraph(CAMPUS), ["Argo Hall", "Revelle Plaza", "Peterson Hall"]);

const HEX = /^#[0-9a-f]{6}$/i;
const sunGod = LANDMARKS.landmarks.find((l) => l.name === "Sun God");

/** Every string in the tree that looks like it is trying to be a colour. */
function colorFields(node, trail = "") {
  const out = [];
  if (typeof node === "string") {
    if (node.startsWith("#") && trail !== "._") out.push([trail, node]);
  } else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) out.push(...colorFields(v, `${trail}.${k}`));
  }
  return out;
}

/* ------------------------------------------------ 1. the shape of the data */

describe("campus-landmarks.json is complete enough to render", () => {
  test("every landmark carries what the labels and builders read", () => {
    assert.ok(LANDMARKS.landmarks.length >= 15, "the landmark list has been gutted");
    for (const lm of LANDMARKS.landmarks) {
      for (const field of ["name", "lat", "lng", "kind", "height_m", "description", "prominence"]) {
        assert.ok(lm[field] !== undefined, `landmark ${lm.name || "(unnamed)"} has no ${field}`);
      }
      assert.ok(lm.lat > 32.86 && lm.lat < 32.9, `${lm.name} sits at lat ${lm.lat} — off campus`);
      assert.ok(lm.lng > -117.26 && lm.lng < -117.22, `${lm.name} sits at lng ${lm.lng} — off campus`);
      assert.ok(lm.height_m > 0 && lm.height_m < 70, `${lm.name} is ${lm.height_m} m tall`);
    }
  });

  test("every colour anywhere in the file is a #rrggbb", () => {
    const fields = colorFields(LANDMARKS);
    assert.ok(fields.length >= 20, `only ${fields.length} colours in the file — did a block go?`);
    for (const [where, hex] of fields) {
      assert.match(hex, HEX, `${where} is "${hex}", not a #rrggbb`);
    }
  });

  test("Fallen Star still has the full build spec", () => {
    const fs = LANDMARKS.fallenStar;
    for (const field of [
      "lat", "lng", "host", "corner", "width", "depth", "height",
      "tiltDeg", "ridgeAzimuthDeg", "overhang", "walls", "trim", "roof", "chimney",
    ]) {
      assert.ok(fs[field] !== undefined, `fallenStar has no ${field}`);
    }
    assert.ok(fs.garden.w > 0 && fs.garden.d > 0, "the rooftop garden has no extent");
    assert.match(fs.garden.color, HEX, "the rooftop garden has no colour");
  });
});

/* ----------------------------------------- 2. the Sun God, as photographed */

describe("the Sun God is the statue in the footage", () => {
  test("the description carries the scarlet head and the gold crest", () => {
    const d = sunGod.description.toLowerCase();
    assert.match(d, /scarlet head/, "the head reads scarlet in D:f0101 and W:f0059");
    assert.match(d, /gold sunburst crest|gold crest/, "the crest is a fan of gold spikes");
    assert.match(d, /white body|white/, "the body is white — that is the ground the motifs sit on");
    assert.match(d, /ivy/, "the arch is blanketed in ivy, not bare concrete");
  });

  test("the splotches do not come back", () => {
    /* The exact wording of the wrong description. It survived a rewrite once
       already by being plausible; name it so it cannot survive another. */
    assert.doesNotMatch(
      sunGod.description,
      /multicolored splotches|confetti colors/i,
      "the Sun God's colour is a few large concentric discs, not splotches"
    );
  });

  test("the builder has a colour for every part it paints", () => {
    for (const part of [
      "body", "head", "beak", "crest",
      "discRed", "discBlue", "discGold", "discGreen",
      "arch", "archCap",
    ]) {
      assert.match(sunGod.colors?.[part] ?? "", HEX, `Sun God has no ${part} colour`);
    }
    assert.notEqual(
      sunGod.colors.body, sunGod.colors.head,
      "a white body and a scarlet head: if these match, the repaint was undone"
    );
  });
});

/* ------------------------------------------- 3. the measured colour record */

describe("the measured landmark colours", () => {
  const measured = [
    ["Silent Tree", "lead", "#5a5450"],
    ["Trees (Talking Tree)", "lead", "#5a5450"],
    ["Trees (Singing Tree)", "lead", "#5a5450"],
    ["Bear (Warren Bear)", "granite", "#b2ad94"],
    ["Triton Statue", "bronze", "#3d4650"],
    ["Vices and Virtues", "host", "#8b8d89"],
    ["Vices and Virtues", "frame", "#7d4a45"],
    ["Revelle Plaza Fountain", "basin", "#3a3437"],
    ["Pergola Swings (Ridge Walk at Muir Field)", "frame", "#3a3634"],
    ["Pergola Swings (Ridge Walk at Muir Field)", "roof", "#c9c2b2"],
    ["Pergola Swings (Ridge Walk at Muir Field)", "bench", "#8a8378"],
    ["Mayer/Bonner Folded-Plate Canopy", "plate", "#d8d4c6"],
  ];
  for (const [name, part, hex] of measured) {
    test(`${name}: ${part} stays at the measured ${hex}`, () => {
      const lm = LANDMARKS.landmarks.find((l) => l.name === name);
      assert.ok(lm, `${name} is no longer in the file`);
      assert.equal(lm.colors?.[part], hex);
    });
  }
});

/* -------------------------------------------- 4. Fallen Star's roof corner */

describe("Fallen Star hangs off the corner the aerials show", () => {
  test("the corner tag is one the renderer knows", () => {
    const block = RENDERER.match(/CORNER_DIR = \{([\s\S]*?)\};/);
    assert.ok(block, "the renderer no longer exports a CORNER_DIR table");
    const dirs = [...block[1].matchAll(/\b([NSEW]{1,2}):\s*\[/g)].map((m) => m[1]);
    assert.ok(dirs.includes(LANDMARKS.fallenStar.corner),
      `corner "${LANDMARKS.fallenStar.corner}" is not in the renderer's CORNER_DIR`);
  });

  test("it is the south-west corner, and the prose agrees with the tag", () => {
    /* D:f0034–f0036: the cottage sits on one of the slender stair towers
       along Jacobs Hall's SOUTH face, cantilevered west, with the rooftop
       garden inboard of it. The prose used to say "northeast corner" while
       the data said SW — the same file disagreeing with itself. */
    assert.equal(LANDMARKS.fallenStar.corner, "SW");
    const prose = LANDMARKS.landmarks.find((l) => l.name === "Fallen Star").description;
    assert.doesNotMatch(prose, /northeast/i, "the prose contradicts the corner tag again");
    assert.match(prose, /south/i, "the prose should say which corner it hangs off");
  });

  test("the surveyed point sits on the south side of its host", () => {
    /* Local metres: +x east, +z south. Jacobs Hall's massing spans roughly
       x 504..605, z -458..-369, so a south-west perch means a point in the
       southern half and west of mid-span. Asserted on the coordinate rather
       than the tag, because the coordinate is the thing that was surveyed. */
    const { lat, lng } = LANDMARKS.fallenStar;
    const campus = JSON.parse(readFileSync(path.join(ROOT, "docs/data/campus-3d.json"), "utf8"));
    const o = campus.origin;
    const x = (lng - o.lng) * o.mPerDegLng;
    const z = -(lat - o.lat) * o.mPerDegLat;
    const host = campus.buildings.find((b) => b.n === "Jacobs Hall");
    assert.ok(host, "Jacobs Hall is no longer in the massing");
    const zs = host.p.map((p) => p[1]);
    const xs = host.p.map((p) => p[0]);
    const midZ = (Math.min(...zs) + Math.max(...zs)) / 2;
    const midX = (Math.min(...xs) + Math.max(...xs)) / 2;
    assert.ok(z > midZ, `Fallen Star is at z ${z.toFixed(1)}, north of the host's mid ${midZ.toFixed(1)}`);
    assert.ok(x < midX, `Fallen Star is at x ${x.toFixed(1)}, east of the host's mid ${midX.toFixed(1)}`);
  });
});

/* --------------------------------- 5. the one-off structures on the route */

describe("the structures the walk actually passes", () => {
  const o = CAMPUS.origin;
  const local = (lm) => [
    (lm.lng - o.lng) * o.mPerDegLng,
    -(lm.lat - o.lat) * o.mPerDegLat,
  ];
  const byName = (n) => LANDMARKS.landmarks.find((l) => l.name === n);
  const PERGOLAS = LANDMARKS.landmarks.filter((l) => l.pergola);
  const metresFromWalk = (x, z) =>
    Math.min(...WALK.points.map((p) => Math.hypot(p.x - x, p.z - z)));

  test("each one carries the spec block its builder dispatches on", () => {
    /* createLandmarks picks a builder by the presence of these blocks, not by
       name — so a missing block is a landmark that silently does not render,
       which is the failure this file exists to make loud. */
    for (const [name, block, fields] of [
      ["Revelle Plaza Fountain", "fountain", ["diameter_m", "rimHeight_m", "jetHeight_m"]],
      ["Mayer/Bonner Folded-Plate Canopy", "canopy",
        ["depth_m", "height_m", "pitch_m", "rise_m", "columnEvery_m", "columnRadius_m"]],
    ]) {
      const lm = byName(name);
      assert.ok(lm, `${name} is no longer in the file`);
      assert.ok(lm[block], `${name} has no ${block} block — nothing will build it`);
      for (const f of fields) {
        assert.ok(lm[block][f] > 0, `${name}.${block}.${f} is ${lm[block][f]}`);
      }
    }
    assert.equal(PERGOLAS.length, 2, "there are two pergola stations, not one");
    for (const lm of PERGOLAS) {
      for (const f of ["length_m", "depth_m", "height_m", "postEvery_m", "swings", "benches"]) {
        assert.ok(lm.pergola[f] > 0, `${lm.name}.pergola.${f} is ${lm.pergola[f]}`);
      }
      assert.ok(lm.pergola.bearingDeg >= 0 && lm.pergola.bearingDeg < 360,
        `${lm.name} has bearing ${lm.pergola.bearingDeg}`);
    }
  });

  test("every part the builders paint has a colour", () => {
    const parts = {
      "Revelle Plaza Fountain": ["basin", "water", "foam", "pole", "flagRed", "flagWhite", "flagBlue"],
      "Mayer/Bonner Folded-Plate Canopy": ["plate", "soffit", "column"],
    };
    for (const [name, keys] of Object.entries(parts)) {
      for (const k of keys) {
        assert.match(byName(name).colors?.[k] ?? "", HEX, `${name} has no ${k} colour`);
      }
    }
    for (const lm of PERGOLAS) {
      for (const k of ["frame", "roof", "bench"]) {
        assert.match(lm.colors?.[k] ?? "", HEX, `${lm.name} has no ${k} colour`);
      }
    }
  });

  test("the two pergola stations are the same furniture, twice", () => {
    /* W:f0013–f0014 and W:f0026–f0027 show one design repeated. If the two
       palettes ever drift apart they stop reading as a family, which is the
       entire reason both are worth building. */
    const [a, b] = PERGOLAS;
    assert.deepEqual(a.colors, b.colors, "the stations have been painted differently");
  });

  test("the fountain stands inside the plaza the walk crosses", () => {
    const lm = byName("Revelle Plaza Fountain");
    const [x, z] = local(lm);
    const plaza = CAMPUS.surfaces.find((s) => s.n === "Revelle Plaza");
    assert.ok(plaza, "Revelle Plaza is no longer a surface");
    let inside = false;
    const ring = plaza.p;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, zi] = ring[i];
      const [xj, zj] = ring[j];
      if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
    }
    assert.ok(inside, `the fountain is at (${x.toFixed(1)}, ${z.toFixed(1)}), outside the plaza ring`);
    /* And on the surveyed OSM point, not near it. */
    const surveyed = CAMPUS.places["Revelle Plaza Fountain"];
    assert.ok(surveyed, "campus-3d.json no longer carries the surveyed fountain point");
    assert.ok(Math.hypot(surveyed.x - x, surveyed.z - z) < 1,
      "the fountain has drifted off the surveyed point");
    /* The flagpole beside it stays beside it — and inside the plaza. */
    assert.ok(Math.abs(lm.flagpole.north_m) < 25, "the flagpole has wandered off the fountain");
    assert.ok(lm.flagpole.height_m > 8 && lm.flagpole.height_m < 25,
      `a ${lm.flagpole.height_m} m flagpole is not the one in W:f0035`);
  });

  test("both pergola stations stand beside the route, not somewhere near it", () => {
    for (const lm of PERGOLAS) {
      const [x, z] = local(lm);
      const d = metresFromWalk(x, z);
      assert.ok(d < 15, `${lm.name} is ${d.toFixed(1)} m from the walk — you would never see it`);
      assert.ok(d > 2, `${lm.name} is ${d.toFixed(1)} m from the walk — you would walk through it`);
    }
    /* The two are stations on one walk, not two views of the same bench. */
    const [a, b] = PERGOLAS.map(local);
    assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) > 100, "the stations are on top of each other");
  });

  test("the folded-plate canopy has hosts with a west face to run along", () => {
    /* The canopy is a LINE, not a point: the builder takes the west edge of
       each host's footprint at load. A renamed or vanished host renders
       nothing at all, and nothing else would say so. */
    const lm = byName("Mayer/Bonner Folded-Plate Canopy");
    assert.deepEqual(lm.hosts, ["Bonner Hall", "Mayer Hall"]);
    assert.equal(lm.facing, "W");
    const block = RENDERER.match(/CORNER_DIR = \{([\s\S]*?)\};/);
    const dirs = [...block[1].matchAll(/\b([NSEW]{1,2}):\s*\[/g)].map((m) => m[1]);
    assert.ok(dirs.includes(lm.facing), `facing "${lm.facing}" is not in the renderer's CORNER_DIR`);

    for (const name of lm.hosts) {
      const host = CAMPUS.buildings.find((b) => b.n === name);
      assert.ok(host, `${name} is no longer in the massing — the canopy would vanish`);
      const cx = host.p.reduce((s, p) => s + p[0], 0) / host.p.length;
      let best = 0;
      for (let i = 0; i < host.p.length; i++) {
        const a = host.p[i];
        const b = host.p[(i + 1) % host.p.length];
        if ((a[0] + b[0]) / 2 >= cx) continue;                  // east half: not the arcade
        if (Math.abs(b[0] - a[0]) > Math.abs(b[1] - a[1])) continue; // not a north-south face
        best = Math.max(best, Math.hypot(b[0] - a[0], b[1] - a[1]));
      }
      assert.ok(best > lm.canopy.pitch_m * 4,
        `${name}'s west face is only ${best.toFixed(1)} m — too short to carry the arcade`);
    }
    /* And that west face is the side the walk goes up. */
    const [x, z] = local(lm);
    assert.ok(metresFromWalk(x, z) < 25,
      "the canopy's mid-span is not on the stretch of walk the footage shows it from");
  });
});

/* ----------------------------------------------------------- 6. THE GUARD */

test("no landmark colour is hard-coded in the renderer", () => {
  /* Everything above the landmarks divider is label chrome — the yellow tab
     and the white text, which are UI, not campus. Below it, a hex literal is
     a colour that no frame of footage can be checked against, and that is
     exactly how the Sun God ended up inverted. */
  const marker = "--------------------------------------------------------------- landmarks";
  const cut = RENDERER.indexOf(marker);
  assert.ok(cut > 0, "the landmarks section divider moved — this guard needs its anchor");
  const hexes = [...RENDERER.slice(cut).matchAll(/#[0-9a-f]{6}\b/gi)].map((m) => m[0]);
  assert.deepEqual(hexes, [], `landmark colours belong in the JSON: ${hexes.join(", ")}`);
});
