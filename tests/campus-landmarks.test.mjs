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

/* ----------------------------------------------------------- 5. THE GUARD */

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
