/* Campus Walk — the facade colours name buildings that exist.
 *
 * campus-facades.json is a lookup table, and a lookup table fails silently.
 * The renderer asks it for a colour by the name it gave the mass; a key that
 * matches no mass simply never answers, and the building falls back to the
 * anonymous palette looking like a plausible beige box. Nothing throws, no
 * console warns, and the file keeps claiming to have coloured it.
 *
 * That is not hypothetical. The researched file shipped forty-eight entries
 * and eleven of them were dead — "Muir Biology Building" (the data says
 * "Biology"), "Jacobs Hall (EBU1)" (the data says "Jacobs Hall"), the whole
 * Marshall, ERC and Seventh College families under collective names the
 * university's inventory has never used. A quarter of the table drew nothing
 * for weeks.
 *
 * So: every key here is resolved against the SAME name the renderer will look
 * up — assembleMasses()'s output, not the raw source files, because a mass
 * gets renamed to its OSM host on the way through. If a future entry is typed
 * from a plan rather than from the data, this is where it stops.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(path.join(ROOT, p), "utf8"));
const CAMPUS = read("docs/data/campus-3d.json");
const LIDAR = read("docs/data/campus-lidar.json");
const ARCGIS = read("docs/data/campus-arcgis.json");
const COLORS = read("docs/data/campus-colors.json");
const FACADES = read("docs/data/campus-facades.json");

const { assembleMasses } = await import(path.join(ROOT, "docs/js/campus-massing.js"));

/* The names the renderer actually asks for. Geisel is the one exception it
   makes: createBuildings skips its OSM footprint and stacks the real floors
   instead, reading the same table by literal name. */
const RENDERED = new Set(
  assembleMasses({ campus: CAMPUS, lidar: LIDAR, arcgis: ARCGIS, colors: COLORS })
    .map((m) => m.name)
    .filter(Boolean)
);
RENDERED.add("Geisel Library");

/* Per-mass hashes, for the `masses` section (facades keyed by an individual
   mass rather than a building name — Sankofa's tower vs. its base). Pinned to
   campus-massing.js's createBuildings: `${m.src === "gis" ? "m" : "b"}:` +
   the outer-ring vertex-average centroid, rounded to the metre. Same skip
   (rings with fewer than 3 vertices never reach the renderer) as that loop. */
const centroidOf = (ring) => {
  let x = 0;
  let z = 0;
  for (const p of ring) { x += p[0]; z += p[1]; }
  return [x / ring.length, z / ring.length];
};
const RENDERED_MASS_KEYS = new Set(
  assembleMasses({ campus: CAMPUS, lidar: LIDAR, arcgis: ARCGIS, colors: COLORS })
    .filter((m) => m.rings[0] && m.rings[0].length >= 3)
    .map((m) => {
      const [cx, cz] = centroidOf(m.rings[0]);
      return `${m.src === "gis" ? "m" : "b"}:${Math.round(cx)},${Math.round(cz)}`;
    })
);

/* One shared tile per family. A style outside this set names a tile the
   renderer cannot build — and createBuildings resolves it as
   `tiles[style] || tiles.band`, so it does not throw, it quietly draws the
   default band. Same silent nothing as a dead key.

   READ OUT OF THE RENDERER, not typed here. facadeTiles() cannot be called
   from node — makeTile needs `document` and a WebGL THREE.CanvasTexture — so
   this scrapes the keys off its object literal instead. A hand-kept copy of
   this list is a second source of truth that drifts: delete a tile from
   campus-massing.js and the copy still swears the style is fine, while every
   building wearing it silently falls back to band. */
const MASSING_SRC = readFileSync(path.join(ROOT, "docs/js/campus-massing.js"), "utf8");
const TILE_BLOCK = MASSING_SRC.slice(
  MASSING_SRC.indexOf("function facadeTiles()"),
  MASSING_SRC.indexOf("export function createBuildings")
);
const STYLES = new Set([...TILE_BLOCK.matchAll(/^ {4}([a-z]+): makeTile\(/gm)].map((m) => m[1]));
const ACCENT_SLOTS = new Set(["roof", "trim", "glass", "panel"]);
const HEX = /^#[0-9a-f]{6}$/;

describe("campus-facades.json", () => {
  /* The scrape above fails SAFE — if the regex stopped matching, STYLES goes
     empty and every style in the file reads as unknown, so the suite goes red
     rather than green. This pins it anyway, because a red suite that blames
     the wrong thing costs an hour: it says "the tile list could not be read"
     instead of "all nine of your styles are invalid". */
  test("the renderer's tile list is actually readable from its source", () => {
    assert.ok(
      STYLES.size >= 8,
      `scraped only ${STYLES.size} tiles from facadeTiles() ([${[...STYLES]}]) — the ` +
      `object-literal shape it is read from has changed, so this file's style ` +
      `check is not testing what it claims`
    );
    assert.ok(STYLES.has("band"), "no `band` tile — that is the fallback every unknown style lands on");
  });

  test("parses, and carries the three sections the renderer reads", () => {
    for (const section of ["walls", "styles", "accents"]) {
      assert.ok(
        FACADES[section] && typeof FACADES[section] === "object",
        `campus-facades.json has no ${section} section`
      );
    }
    assert.ok(
      typeof FACADES._ === "string" && FACADES._.length > 20,
      "the provenance note is gone — this file's whole authority is where the colours came from"
    );
  });

  test("every wall colour is a six-digit hex", () => {
    const bad = Object.entries(FACADES.walls)
      .filter(([, hex]) => !HEX.test(hex))
      .map(([n, hex]) => `${n}: ${hex}`);
    assert.deepEqual(bad, [], `not #rrggbb: ${bad.join(", ")}`);
  });

  test("every accent colour is a six-digit hex in a slot the renderer knows", () => {
    const bad = [];
    for (const [name, slots] of Object.entries(FACADES.accents)) {
      assert.ok(slots && typeof slots === "object", `${name}'s accents are not an object`);
      for (const [slot, hex] of Object.entries(slots)) {
        if (!ACCENT_SLOTS.has(slot)) bad.push(`${name}.${slot} is not a known accent slot`);
        else if (!HEX.test(hex)) bad.push(`${name}.${slot}: ${hex}`);
      }
      assert.ok(Object.keys(slots).length > 0, `${name} has an empty accents object`);
    }
    assert.deepEqual(bad, [], bad.join("; "));
  });

  test("every style names a tile that exists", () => {
    const bad = Object.entries(FACADES.styles)
      .filter(([, s]) => !STYLES.has(s))
      .map(([n, s]) => `${n}: "${s}"`);
    assert.deepEqual(bad, [], `unknown facade style: ${bad.join(", ")} (have ${[...STYLES].join(", ")})`);
  });

  test("THE GUARD: every name in the file is a building the renderer builds", () => {
    /* The regression this whole file exists for. Compared against mass names
       rather than campus-3d/campus-arcgis keys because assembleMasses renames
       a GIS mass to the OSM building it stands in — "Seventh College West #1"
       renders as "Village West Building 1", and an entry under either spelling
       has to be checked against the one that survives. */
    const dead = [];
    for (const section of ["walls", "styles", "accents"]) {
      for (const name of Object.keys(FACADES[section])) {
        if (!RENDERED.has(name)) dead.push(`${section}: "${name}"`);
      }
    }
    assert.deepEqual(
      dead,
      [],
      `${dead.length} facade entries name nothing the renderer draws — they are silent no-ops: ` +
      dead.join(", ")
    );
  });

  test("the buildings the walk passes are all coloured from footage", () => {
    /* Argo to Peterson by way of Revelle Plaza and Ridge Walk. These are the
       facades a walker is closest to, and every one of them was measured off
       a frame — if a rebuild drops one back to the anonymous palette, the
       walk's own claim goes with it. */
    const onRoute = [
      "Argo Hall", "Blake Hall", "Urey Hall", "Galbraith Hall", "Mayer Hall", "Bonner Hall",
      "Applied Physics and Mathematics", "McGill Hall", "Mandler Hall", "Biology",
      "Tioga Hall", "Tenaya Hall", "Peterson Hall", "Geisel Library", "Mandeville Center",
    ];
    const missing = onRoute.filter((n) => !FACADES.walls[n]);
    assert.deepEqual(missing, [], `no measured facade for: ${missing.join(", ")}`);
  });

  test("the corrections that cost the most argument stayed corrected", () => {
    /* Each of these overturned the researched guess on measured evidence, and
       each is the kind of value a later "tidy the palette" pass would drift
       back. Peterson lost its yellow, Price Center its orange, Marshall its
       tan, Geisel gained the white fascia ribbon that is the single strongest
       thing about how it reads. */
    assert.equal(FACADES.walls["Peterson Hall"], "#c9c9c4", "Peterson has gone yellow again");
    assert.equal(FACADES.walls["Price Center"], "#c8bda8", "Price Center has gone orange again");
    assert.equal(FACADES.walls["Marshall Lower Apartments"], "#d6d6ce", "Marshall has gone tan again");
    assert.equal(FACADES.walls["Student Services Center"], "#d4bfa4", "SSC is a stucco box again");
    assert.equal(FACADES.accents["Geisel Library"].trim, "#e8e9e2", "Geisel lost its fascia ribbon");
    assert.equal(FACADES.accents["Biology"].panel, "#6d7440", "Muir Biology lost its avocado panels");
  });

  test("masses: every key names a mass hash the renderer actually builds", () => {
    /* Same silent-nothing failure as THE GUARD above, but for the per-mass
       section: a stale hash (footprint moved on a data rebuild) just never
       matches and the override draws nothing. Empty in this workstream —
       exists to catch the next one's entries. */
    const masses = FACADES.masses || {};
    const dead = Object.keys(masses).filter((key) => !RENDERED_MASS_KEYS.has(key));
    assert.deepEqual(
      dead,
      [],
      `${dead.length} mass-facade entries name a hash the renderer doesn't build: ${dead.join(", ")}`
    );
  });

  test("masses: every style/wall/accent value is well-formed", () => {
    const masses = FACADES.masses || {};
    const bad = [];
    for (const [key, entry] of Object.entries(masses)) {
      assert.ok(entry && typeof entry === "object", `${key}'s override is not an object`);
      if (entry.style !== undefined && !STYLES.has(entry.style)) {
        bad.push(`${key}.style: "${entry.style}"`);
      }
      if (entry.walls !== undefined && !HEX.test(entry.walls)) {
        bad.push(`${key}.walls: ${entry.walls}`);
      }
      if (entry.accents) {
        for (const [slot, hex] of Object.entries(entry.accents)) {
          if (!ACCENT_SLOTS.has(slot)) bad.push(`${key}.accents.${slot} is not a known accent slot`);
          else if (!HEX.test(hex)) bad.push(`${key}.accents.${slot}: ${hex}`);
        }
      }
    }
    assert.deepEqual(bad, [], bad.join("; "));
  });

  test("Eighth College tower cladding reads visibly darker than its base", () => {
    /* Scenario 2 wants tower cladding darker than "the white blocks". Sankofa
       Base has no measured wall colour (occluded in every frame, correctly
       left out of masses — see the file's `_` note), so the only other
       measured Sankofa mass stands in for "the base": Sankofa Mid, the
       midrise directly below the tower in the same building family. Read
       both hexes back out of the shipped JSON, not hardcoded numbers, so a
       later edit that flattens the contrast fails this gate. */
    const hexToLightness = (hex) => {
      const n = parseInt(hex.slice(1), 16);
      const r = ((n >> 16) & 0xff) / 255;
      const g = ((n >> 8) & 0xff) / 255;
      const b = (n & 0xff) / 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      return (max + min) / 2;
    };
    const masses = FACADES.masses || {};
    const tower = masses["m:-68,594"];
    const mid = masses["m:-116,613"];
    assert.ok(tower?.walls, "Sankofa Tower (m:-68,594) has no measured walls");
    assert.ok(mid?.walls, "Sankofa Mid (m:-116,613) has no measured walls");
    const towerL = hexToLightness(tower.walls);
    const midL = hexToLightness(mid.walls);
    assert.ok(
      midL - towerL >= 0.12,
      `Sankofa Tower (${tower.walls}, L=${towerL.toFixed(3)}) is not at least 0.12 darker ` +
      `than Sankofa Mid (${mid.walls}, L=${midL.toFixed(3)})`
    );
  });

  test("no building is styled without being coloured, except where only the roof was measured", () => {
    /* A style with no wall entry is legitimate only when the footage saw the
       roof and never a lit wall — the Faculty Club is the case. Anything else
       is half an entry. */
    const ROOF_ONLY = new Set(["Ida and Cecil Green Faculty Club"]);
    const orphans = Object.keys(FACADES.styles).filter((n) => !FACADES.walls[n]);
    assert.deepEqual(orphans, [], `styled but never coloured: ${orphans.join(", ")}`);
    const accentOnly = Object.keys(FACADES.accents).filter(
      (n) => !FACADES.walls[n] && !ROOF_ONLY.has(n)
    );
    assert.deepEqual(accentOnly, [], `accents but no wall colour: ${accentOnly.join(", ")}`);
  });
});
