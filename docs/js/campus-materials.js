// Procedural PBR materials: the surface classes this campus is actually made of.
//
// Everything the walk passes is a flat MeshStandardMaterial colour today. The
// colours are SOURCED — sampled off aerial imagery, measured off photographs —
// and they stay sourced: nothing here invents or shifts a hue. What this module
// adds is the *microstructure* a flat colour cannot carry: the board grain in
// Revelle's formwork, the joint grid in a paved plaza, the aggregate in
// asphalt. A caller keeps passing its measured colour and picks the class of
// surface it is; the class supplies relief, not identity.
//
// HARD RULE, and the reason this file is safe to ship alongside the
// two-source rule in README.md: EVERY texel here is COMPUTED. There is no
// photograph, no satellite tile, no downloaded image, no sampled pixel
// anywhere in this module — only arithmetic over a seeded integer hash. The
// maps are grey-on-white VARIATION maps that MULTIPLY the caller's colour
// (the same trick campus-massing.js's facade tiles use), so a class can never
// introduce a colour the caller did not already have.
//
// No DOM, no imports. THREE is passed in, so this module loads in Node — the
// tests run the real generators headless and compare the actual buffers.

/* ------------------------------------------------------------------ random */

/** mulberry32: a small, fast, fully deterministic PRNG. Fixed seed, same
    bytes every run, on every machine. Nothing in this file is stochastic. */
export function mulberry32(a) {
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The one seed the whole library derives from. Pinned: changing it changes
    every surface in the project at once, which is a deliberate act. */
export const LIBRARY_SEED = 0x5eed1a7e;

/* A 2D integer hash, seeded, used as the noise lattice. Written as a hash
   rather than a filled table so it costs nothing to have a lattice per class
   and never runs out of period. */
function hash2(seed, ix, iy) {
  let h = (seed ^ Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iy, 0x165667b1)) | 0;
  h = Math.imul(h ^ (h >>> 15), h | 1);
  h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
  return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
}

const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** smoothstep with the edges allowed to run backwards (b < a inverts it). */
function step(a, b, x) {
  return smooth(clamp01((x - a) / (b - a)));
}

/**
 * A tileable value-noise field over the unit square.
 *
 * `px`/`py` are the lattice periods in each axis, and the lattice wraps at
 * exactly those periods — which is what makes every map here seamless under
 * RepeatWrapping. Separate periods per axis matter: board grain and brushed
 * metal are long in one direction and short in the other.
 */
function makeNoise(seed) {
  const n = (u, v, px, py) => {
    const x = u * px, y = v * py;
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = smooth(x - ix), fy = smooth(y - iy);
    const x0 = ((ix % px) + px) % px, x1 = (x0 + 1) % px;
    const y0 = ((iy % py) + py) % py, y1 = (y0 + 1) % py;
    return lerp(
      lerp(hash2(seed, x0, y0), hash2(seed, x1, y0), fx),
      lerp(hash2(seed, x0, y1), hash2(seed, x1, y1), fx),
      fy
    );
  };
  return {
    n,
    /** Octaves at doubling frequency; the periods double with them, so the
        sum stays tileable. */
    fbm(u, v, px, py, octaves) {
      let sum = 0, amp = 1, norm = 0;
      for (let o = 0; o < octaves; o++) {
        sum += amp * n(u, v, px << o, py << o);
        norm += amp;
        amp *= 0.5;
      }
      return sum / norm;
    },
    /** One value per integer cell — the per-brick, per-paver, per-board tone. */
    cell: (i, j) => hash2(seed ^ 0x9e3779b9, i, j),
  };
}

/* ----------------------------------------------------------------- classes */
/* Each class is one function over the unit tile. It writes three numbers:
     out[0] HEIGHT    0..1, the relief; the normal map is its gradient
     out[1] TINT      ~0.75..1.05, multiplied into the caller's colour
     out[2] ROUGHNESS 0..1, written straight into the roughness map
   Keeping all three in one pass means the normal and the albedo can never
   disagree about where a joint is — they come from the same expression. */

const FIELDS = {
  /* Revelle and Muir's formwork: horizontal boards, a recessed seam at every
     joint, grain running along the board, one tone per board. */
  boardFormedConcrete(u, v, N, out) {
    const BOARDS = 8;
    const b = v * BOARDS, row = Math.floor(b), f = b - row;
    const seam = step(0, 0.05, f) * step(1, 0.95, f);
    const grain = N.fbm(u, v, 64, 8, 3);
    const tone = N.cell(0, row);
    const agg = N.fbm(u, v, 96, 96, 2);
    out[0] = seam * (0.55 + 0.3 * grain) + 0.15 * agg;
    out[1] = 0.88 + 0.1 * tone + 0.06 * grain - 0.12 * (1 - seam);
    out[2] = 0.82 + 0.12 * grain - 0.05 * (1 - seam);
  },

  /* Poured and floated: almost flat, mottled by the pour, speckled by the
     aggregate that reads through the surface. */
  smoothConcrete(u, v, N, out) {
    const mottle = N.fbm(u, v, 4, 4, 4);
    const agg = N.fbm(u, v, 128, 128, 2);
    out[0] = 0.35 * mottle + 0.25 * agg;
    out[1] = 0.9 + 0.1 * mottle + 0.04 * (agg - 0.5);
    out[2] = 0.78 + 0.14 * mottle;
  },

  /* Troweled stucco: the round-shouldered lumps of a hand-floated wall. */
  stucco(u, v, N, out) {
    const coarse = N.fbm(u, v, 24, 24, 4);
    const fine = N.n(u, v, 96, 96);
    out[0] = 0.7 * coarse + 0.3 * fine;
    out[1] = 0.9 + 0.12 * coarse;
    out[2] = 0.88 + 0.08 * fine;
  },

  /* Flat sheet metal: a faint roll direction and a little dirt, nothing else.
     The look is carried by the environment reflection, not by relief. */
  metalPanel(u, v, N, out) {
    const brush = N.fbm(u, v, 192, 6, 3);
    const dirt = N.fbm(u, v, 6, 6, 3);
    out[0] = 0.2 * brush;
    out[1] = 0.94 + 0.06 * brush - 0.06 * dirt;
    out[2] = 0.28 + 0.22 * dirt + 0.06 * brush;
  },

  /* Standing seam: the same sheet with raised ribs at a fixed pitch. */
  metalPanelSeam(u, v, N, out) {
    FIELDS.metalPanel(u, v, N, out);
    const RIBS = 8;
    const r = u * RIBS, f = r - Math.floor(r);
    const rib = step(0.0, 0.03, f) * step(0.1, 0.07, f);
    out[0] = out[0] * 0.5 + 0.5 * rib;
    out[1] -= 0.05 * rib;
    out[2] -= 0.06 * rib;
  },

  /* Slat screens and soffits: boards with a shadow gap between them. */
  woodSlat(u, v, N, out) {
    const SLATS = 10;
    const s = v * SLATS, row = Math.floor(s), f = s - row;
    const face = step(0, 0.07, f) * step(1, 0.9, f);
    const grain = N.fbm(u, v + row * 0.37, 80, 10, 3);
    const tone = N.cell(1, row);
    out[0] = face * (0.6 + 0.25 * grain);
    out[1] = (0.86 + 0.14 * tone) * (0.85 + 0.15 * grain) - 0.35 * (1 - face);
    out[2] = 0.62 + 0.2 * grain + 0.15 * (1 - face);
  },

  /* Unit pavers: a joint grid with a genuinely different tone per unit, which
     is the whole reason a paved plaza does not read as a painted slab. */
  pavingConcreteUnit(u, v, N, out) {
    const COLS = 6, ROWS = 6;
    const x = u * COLS, y = v * ROWS;
    const ci = Math.floor(x), ri = Math.floor(y);
    const fx = x - ci, fy = y - ri;
    const JOINT = 0.045;
    const face =
      step(0, JOINT, fx) * step(1, 1 - JOINT, fx) *
      step(0, JOINT, fy) * step(1, 1 - JOINT, fy);
    const tone = N.cell(ci, ri);
    const agg = N.fbm(u, v, 128, 128, 2);
    out[0] = face * (0.75 + 0.15 * agg);
    out[1] = (0.86 + 0.16 * tone) * (0.95 + 0.05 * agg) - 0.28 * (1 - face);
    out[2] = 0.8 + 0.1 * agg + 0.08 * (1 - face);
  },

  /* Weathered single-ply roof membrane: a fine expansion-joint grid, broad
     weathering blotches and fine granule speck. Greyscale like every class —
     the pink-brown patch STAINS a roof carries are separate decal quads whose
     colours are sampled data, because this map may never move a hue. */
  roofMembrane(u, v, N, out) {
    const PANELS = 4;
    const x = u * PANELS, y = v * PANELS;
    const fx = x - Math.floor(x), fy = y - Math.floor(y);
    const JOINT = 0.018;
    const face =
      step(0, JOINT, fx) * step(1, 1 - JOINT, fx) *
      step(0, JOINT, fy) * step(1, 1 - JOINT, fy);
    const blotch = N.fbm(u, v, 3, 3, 4);
    const stain = step(0.52, 0.72, N.fbm(u + 0.41, v + 0.13, 7, 7, 3));
    const speck = N.fbm(u, v, 96, 96, 2);
    out[0] = 0.2 * face + 0.06 * speck;
    out[1] = 0.9 + 0.1 * blotch - 0.16 * stain * blotch + 0.05 * (speck - 0.5) - 0.1 * (1 - face);
    out[2] = 0.84 + 0.08 * blotch + 0.08 * stain;
  },

  /* Running bond, one course offset half a brick, mortar recessed. */
  brick(u, v, N, out) {
    const COURSES = 8, PER = 4;
    const y = v * COURSES;
    const ri = Math.floor(y), fy = y - ri;
    const shift = (ri & 1) * 0.5;
    const x = (u + shift / PER) * PER;
    const ci = Math.floor(x), fx = x - ci;
    const JX = 0.035, JY = 0.09;
    const face =
      step(0, JX, fx) * step(1, 1 - JX, fx) *
      step(0, JY, fy) * step(1, 1 - JY, fy);
    const tone = N.cell(ci, ri);
    const grit = N.fbm(u, v, 96, 96, 2);
    out[0] = face * (0.8 + 0.1 * grit);
    /* Mortar reads LIGHTER than the brick. A variation map cannot go above
       the caller's colour (1.0 IS that colour), so the joint sits at the top
       of the range and the brick faces tint DOWN away from it. */
    out[1] = face * (0.66 + 0.2 * tone + 0.05 * grit) + (1 - face) * 1.0;
    out[2] = face * (0.72 + 0.12 * grit) + (1 - face) * 0.95;
  },

  /* Asphalt: aggregate at two scales, polished into the wheel tracks, and
     nothing regular anywhere.
     NOTE THE FREQUENCIES. The first pass put the stones at period 160 on a
     256 tile — near enough to Nyquist that the mip chain averaged them to
     nothing and the surface rendered as grey plastic. Aggregate has to sit
     low enough to SURVIVE minification, because a road is only ever seen
     minified. Same correction in decomposedGranite below. */
  asphalt(u, v, N, out) {
    const coarse = N.fbm(u, v, 32, 32, 4);
    const fine = N.fbm(u, v, 72, 72, 2);
    const wear = N.fbm(u, v, 3, 3, 3);
    out[0] = 0.55 * coarse + 0.45 * fine;
    out[1] = 0.78 + 0.2 * coarse + 0.1 * fine + 0.06 * wear;
    out[2] = 0.9 - 0.14 * wear + 0.08 * fine;
  },

  /* Decomposed granite paths: loose grit with the odd larger stone in it,
     walked flat along the desire line. */
  decomposedGranite(u, v, N, out) {
    const grit = N.fbm(u, v, 56, 56, 3);
    const stones = step(0.68, 0.82, N.n(u, v, 40, 40));
    const drift = N.fbm(u, v, 6, 6, 3);
    out[0] = 0.55 * grit + 0.25 * drift + 0.35 * stones;
    out[1] = 0.82 + 0.16 * grit + 0.08 * drift + 0.06 * stones;
    out[2] = 0.94 - 0.06 * drift;
  },

  /* Scoria in the planting beds: vesicular, pitted, and matte. */
  lavaRock(u, v, N, out) {
    const lump = N.fbm(u, v, 12, 12, 4);
    const pits = N.n(u, v, 64, 64);
    const hole = step(0.62, 0.78, pits);
    out[0] = lump * (1 - 0.8 * hole);
    out[1] = (0.8 + 0.2 * lump) * (1 - 0.35 * hole);
    out[2] = 0.94 - 0.06 * lump;
  },

  /* Leaf clusters for the canopy cards. This is the one class whose ALPHA
     carries the shape: the mask goes in the map's alpha channel and the
     material cuts it with alphaTest, so the foliage stays sortable and casts
     an honest shadow instead of a rectangle. */
  foliage(u, v, N, out) {
    const clump = N.fbm(u, v, 6, 6, 4);
    const edge = N.fbm(u, v, 20, 20, 3);
    const mask = clamp01(clump * 0.75 + edge * 0.45 - 0.35) * 3;
    out[0] = clamp01(mask) * (0.5 + 0.5 * edge);
    out[1] = 0.78 + 0.3 * clump + 0.1 * edge;
    out[2] = 0.6 + 0.25 * edge;
    out[3] = clamp01(mask * 1.6 - 0.15);
  },

  /* Eucalyptus: long ribbons of bark peeling off a smooth trunk, which is why
     the tone varies far more than the relief does. */
  barkEucalyptus(u, v, N, out) {
    const strip = N.fbm(u, v, 10, 3, 3);
    const peel = step(0.45, 0.6, strip);
    const fibre = N.fbm(u, v, 24, 96, 3);
    out[0] = 0.35 * fibre + 0.45 * peel;
    out[1] = 0.8 + 0.3 * strip - 0.12 * (1 - peel) * fibre;
    out[2] = 0.72 + 0.2 * fibre;
  },

  /* Torrey and Aleppo pine: deep vertical furrows between hard plates. */
  barkPine(u, v, N, out) {
    const furrow = N.fbm(u, v, 14, 5, 3);
    const plate = step(0.38, 0.62, furrow);
    const grit = N.fbm(u, v, 48, 96, 3);
    out[0] = plate * (0.7 + 0.3 * grit);
    out[1] = (0.78 + 0.22 * furrow) * (0.55 + 0.45 * plate) + 0.08 * grit;
    out[2] = 0.86 + 0.1 * grit - 0.06 * plate;
  },
};

/* Per-class material defaults and tile size. Roughness/metalness here are the
   BASE the roughness map modulates; a caller may override either. `normal` is
   the relief depth in world terms — the difference between board formwork you
   can see the grain of and a stucco wall that just catches light. */
const CLASS_DEFAULTS = {
  boardFormedConcrete: { size: 512, roughness: 0.92, metalness: 0, normal: 0.8 },
  smoothConcrete:      { size: 256, roughness: 0.85, metalness: 0, normal: 0.25 },
  stucco:              { size: 256, roughness: 0.95, metalness: 0, normal: 0.7 },
  metalPanel:          { size: 256, roughness: 0.5,  metalness: 0.9, normal: 0.3 },
  metalPanelSeam:      { size: 256, roughness: 0.5,  metalness: 0.9, normal: 0.9 },
  woodSlat:            { size: 512, roughness: 0.7,  metalness: 0, normal: 0.9 },
  pavingConcreteUnit:  { size: 512, roughness: 0.88, metalness: 0, normal: 0.6 },
  roofMembrane:        { size: 512, roughness: 0.9,  metalness: 0, normal: 0.3 },
  brick:               { size: 512, roughness: 0.8,  metalness: 0, normal: 0.9 },
  asphalt:             { size: 256, roughness: 0.95, metalness: 0, normal: 0.8 },
  decomposedGranite:   { size: 256, roughness: 0.97, metalness: 0, normal: 0.75 },
  lavaRock:            { size: 256, roughness: 0.98, metalness: 0, normal: 1.1 },
  foliage:             { size: 256, roughness: 0.75, metalness: 0, normal: 0.6 },
  barkEucalyptus:      { size: 512, roughness: 0.85, metalness: 0, normal: 0.8 },
  barkPine:            { size: 512, roughness: 0.92, metalness: 0, normal: 1.2 },
  /* Glass generates no maps at all — see makeMaterial. */
  glass:               { size: 0,   roughness: 0.06, metalness: 0.1, normal: 0 },
};

export const MATERIAL_CLASSES = Object.keys(CLASS_DEFAULTS);

/* ---------------------------------------------------------------- textures */

/**
 * Generate the three maps for one class.
 *
 * Deliberately NOT canvas-based. A canvas 2D path would buy vector strokes we
 * do not use, and would cost a second code path that behaves differently in
 * Node than in the browser — which is exactly the kind of difference a test
 * suite cannot see. Every class here is a closed-form function of (u, v), so
 * a per-texel evaluation into a DataTexture is both shorter and byte-identical
 * everywhere it runs. That also means these tests assert the same bytes the
 * GPU will sample.
 */
export function generateTextureSet(THREE, className, { seed = LIBRARY_SEED, anisotropy = 8 } = {}) {
  const field = FIELDS[className];
  if (!field) throw new Error(`unknown material class: ${className}`);
  const S = CLASS_DEFAULTS[className].size;
  const N = makeNoise((seed + className.length * 0x9e3779b1) | 0);

  const height = new Float32Array(S * S);
  const albedo = new Uint8Array(S * S * 4);
  const rough = new Uint8Array(S * S * 4);
  const out = [0, 0, 0, 1];

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      out[3] = 1;
      field((x + 0.5) / S, (y + 0.5) / S, N, out);
      const i = y * S + x;
      height[i] = out[0];
      const t = Math.round(clamp01(out[1]) * 255);
      albedo[i * 4] = albedo[i * 4 + 1] = albedo[i * 4 + 2] = t;
      albedo[i * 4 + 3] = Math.round(clamp01(out[3]) * 255);
      const r = Math.round(clamp01(out[2]) * 255);
      rough[i * 4] = rough[i * 4 + 1] = rough[i * 4 + 2] = r;
      rough[i * 4 + 3] = 255;
    }
  }

  /* Tangent-space normal from the same height field, sampled with wraparound
     so the normal map tiles as seamlessly as the albedo it came from. */
  const normal = new Uint8Array(S * S * 4);
  const at = (x, y) => height[(((y % S) + S) % S) * S + (((x % S) + S) % S)];
  /* One MILD slope, the same for every class. Depth is art direction and it
     belongs on the material's normalScale, where a caller can tune it per
     surface; baking it in here as well double-counts, and a first pass that
     scaled the gradient by the tile size produced maps whose normals lay
     almost flat against the surface — every class rendered as sandpaper
     regardless of what it was meant to be. */
  const STRENGTH = 2.5;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * 0.5 * STRENGTH;
      const dy = (at(x, y + 1) - at(x, y - 1)) * 0.5 * STRENGTH;
      const len = Math.hypot(-dx, -dy, 1);
      const i = (y * S + x) * 4;
      normal[i] = Math.round((-dx / len * 0.5 + 0.5) * 255);
      normal[i + 1] = Math.round((-dy / len * 0.5 + 0.5) * 255);
      normal[i + 2] = Math.round((1 / len * 0.5 + 0.5) * 255);
      normal[i + 3] = 255;
    }
  }

  const tex = (data, srgb) => {
    const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = anisotropy;
    t.needsUpdate = true;
    return t;
  };

  return { map: tex(albedo, true), normalMap: tex(normal, false), roughnessMap: tex(rough, false) };
}

/* ---------------------------------------------------------------- library */

/**
 * The library. One texture set per (class, seed), generated on first use and
 * shared by every material that asks for it — which is what lets a thousand
 * instanced pavers cost one upload.
 *
 *   const mats = createMaterialLibrary(THREE);
 *   mesh.material = mats.get("boardFormedConcrete", { color: 0x8a8378 });
 *   plaza.material = mats.get("pavingConcreteUnit", { color: sampled, repeat: 24 });
 *
 * `color` stays the caller's business: the maps are grey variation and
 * multiply into it, so nothing here can move a sourced colour off its hue.
 *
 * `repeat` is per SURFACE but wrapping lives on the texture, so asking for one
 * clones the sampler. In three the clone shares its `source`, so the pixels
 * are still uploaded once — a different repeat costs a sampler, not memory.
 */
/* The one library the live site should use. Every photo module used to make
   its own — ~15 identical copies of every DataTexture, generated and uploaded
   once per module. The library is seed-pinned and byte-deterministic (the test
   proves two independent copies identical), so sharing one instance changes
   nothing about what renders; it only stops the duplicate generation, and it
   makes cross-module texture identity real — which is what lets the perf
   layer's material dedupe fold the photo zone's materials together.
   `createMaterialLibrary` stays exported for the tests that compare
   independent copies. */
let SHARED = null;
export function sharedMaterialLibrary(THREE) {
  /* No options on purpose: a second caller's options would be silently
     ignored once the singleton exists, which is a trap, so the shared
     library is always the default library. A caller that needs different
     options wants its own createMaterialLibrary. */
  return (SHARED ??= createMaterialLibrary(THREE));
}

export function createMaterialLibrary(THREE, { anisotropy = 8, seed = LIBRARY_SEED } = {}) {
  const cache = new Map();

  function textures(className) {
    const key = `${className}|${seed}`;
    let set = cache.get(key);
    if (!set) {
      set = generateTextureSet(THREE, className, { seed, anisotropy });
      cache.set(key, set);
    }
    return set;
  }

  function get(className, opts = {}) {
    let key = className;
    if (className === "metalPanel" && opts.standingSeam) key = "metalPanelSeam";
    if (!CLASS_DEFAULTS[className]) throw new Error(`unknown material class: ${className}`);
    const defaults = CLASS_DEFAULTS[key];

    const {
      color = 0xffffff, roughness = defaults.roughness, metalness = defaults.metalness,
      normalScale = defaults.normal, repeat, standingSeam, ...rest
    } = opts;

    /* Glass is the documented exception: no maps. A pane's read comes from
       what it REFLECTS, and the scenes already hand these materials a
       PMREM-filtered environment via world.applyEnvironment — scene.environment
       reaches every standard material without anyone wiring an envMap. A
       generated smudge map would only fight that reflection, and real
       transmission is not worth its cost across a whole campus of windows. */
    if (className === "glass") {
      return new THREE.MeshStandardMaterial({
        color, roughness, metalness, transparent: true, opacity: 0.35,
        envMapIntensity: 1.6, side: THREE.DoubleSide, depthWrite: false, ...rest,
      });
    }

    const set = textures(key);
    const maps = repeat === undefined
      ? set
      : Object.fromEntries(Object.entries(set).map(([k, t]) => {
          const c = t.clone();
          const [rx, ry] = Array.isArray(repeat) ? repeat : [repeat, repeat];
          c.repeat.set(rx, ry);
          c.needsUpdate = true;
          return [k, c];
        }));

    const params = {
      color, roughness, metalness, ...maps,
      normalScale: new THREE.Vector2(normalScale, normalScale), ...rest,
    };
    /* The canopy cards cut their own silhouette out of the map's alpha. */
    if (className === "foliage") {
      Object.assign(params, { alphaTest: 0.5, side: THREE.DoubleSide }, rest);
    }
    return new THREE.MeshStandardMaterial(params);
  }

  return {
    get,
    textures,
    classes: MATERIAL_CLASSES,
    dispose() {
      for (const set of cache.values()) for (const t of Object.values(set)) t.dispose();
      cache.clear();
    },
  };
}
