// Which tree is that? Species, from the measurements we already have.
//
// The LiDAR gives every canopy a position, a height and a spread — but not a
// name. One green fitted nobody: the real campus is eucalyptus groves with
// pale bare trunks and small olive crowns, dark torrey-pine umbrellas along
// Ridge Walk, and yellow-olive sycamores on the lawns. Every colour here was
// median-sampled from 4K footage of the real campus (Nov 2022 drone + Nov 2023
// walk; see the README's footage section), daylight tones, so the palette is
// measured, not invented.
//
// Pure data + one pure function, no THREE: campus-world.js turns this into
// instanced meshes, and the tests run the same rules in Node.

/* Foliage/trunk in daylight; form drives the silhouette:
     tall     — bare pole, small high crown (eucalyptus: crown starts 8–15 m up)
     umbrella — short trunk, broad flattened crown (torrey/stone pine)
     round    — conventional round crown (sycamore, jacaranda, fig, magnolia) */
export const SPECIES = {
  eucalyptus: { leaf: "#68714e", trunk: "#b0a48e", form: "tall" },
  pine:       { leaf: "#4a5432", trunk: "#4f4238", form: "umbrella" },
  sycamore:   { leaf: "#9a9450", trunk: "#8f8874", form: "round" },
  jacaranda:  { leaf: "#719664", trunk: "#84887e", form: "round" },
  broadleaf:  { leaf: "#2e3a20", trunk: "#6b5f4e", form: "round" }, // fig / magnolia family
};

/* Same deterministic hash the buildings use: a tree keeps its species on
   every visit. */
const hash = (x, z) => Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;

/**
 * Species from the LiDAR's own numbers. The footage rule of thumb:
 * tall-and-narrow is eucalyptus (the groves, the Ridge Walk rows), short-and-
 * broad is a pine umbrella, and the middling round crowns split between the
 * lawn species by position hash — stable, and in roughly the proportions the
 * footage shows.
 */
export function treeSpecies(x, z, h, r) {
  if (h >= 16 && r <= h * 0.42) return "eucalyptus";
  if (h <= 13 && r >= 5) return "pine";
  const t = hash(x, z);
  if (h >= 14) return t < 0.7 ? "eucalyptus" : "pine";
  return t < 0.45 ? "sycamore" : t < 0.75 ? "jacaranda" : t < 0.9 ? "broadleaf" : "pine";
}

/**
 * Per-instance colour jitter, deterministic. Eucalyptus crowns lean toward
 * the stressed near-brown the Nov footage shows in the canyons (D:f0017);
 * everything else just avoids the plastic look of one exact green.
 * Returns { leaf, trunk } as [r,g,b] in 0..1.
 */
export function treeTint(species, x, z) {
  const s = SPECIES[species];
  const t = hash(x + 31.7, z - 17.3);
  const leaf = hexToRgb(s.leaf);
  const trunk = hexToRgb(s.trunk);
  if (species === "eucalyptus") {
    // up to 35% of the way toward stressed brown on a third of instances
    const stress = t < 0.33 ? (0.35 * (0.33 - t)) / 0.33 : 0;
    lerp3(leaf, hexToRgb("#4a4434"), stress);
  }
  const jitter = (hash(x - 3.1, z + 9.4) - 0.5) * 0.12;
  scale3(leaf, 1 + jitter);
  scale3(trunk, 1 + jitter * 0.5);
  return { leaf, trunk };
}

const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255];
};
const lerp3 = (a, b, t) => { for (let i = 0; i < 3; i++) a[i] += (b[i] - a[i]) * t; };
const scale3 = (a, k) => { for (let i = 0; i < 3; i++) a[i] = Math.max(0, Math.min(1, a[i] * k)); };
