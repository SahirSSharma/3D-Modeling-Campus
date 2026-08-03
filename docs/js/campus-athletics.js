// The two roofs that make the Muir athletics zone recognisable from the air.
//
// From the ground, Main Gym and the Natatorium are two flat-topped boxes; from
// any overlook — and in every aerial of this campus — they are the opposite of
// flat. Main Gym is a field of eleven pale barrel vaults running east to west,
// each one separated from the next by a hard shadow line, the whole field cut
// twice by a thin transverse walkway. The Natatorium is a weathered grey-green
// deck with a white structural skylight punched through the middle, and under
// that glass the pool reads straight through: banded light and dark blue, lap
// lanes running north to south.
//
// Neither is modelled anywhere in the university's data. The facilities
// massing gives both buildings as single extrusions (and reconciles the
// Natatorium up to Main Gym's LiDAR height, since OSM draws the two as one
// footprint joined by a link corridor). So this module works the other way
// round: it SPLITS that joined footprint at its neck, then builds the two
// signature roofs onto the blocks it recovers.
//
// Every colour below is a median of a pixel rect on a Google aerial — the
// rects are named in the constant comments so the next person can re-measure.
// athleticsSpec() is pure data in, data out, so the tests run the same
// placement the renderer does; createAthletics() turns it into three merged
// draw calls.
import * as THREE from "../vendor/three/three.module.min.js";

/* Sampled from two aerials: the Main Gym roof closeup (884x846) and the
   Natatorium closeup (1166x1174). Rect given as x0,y0-x1,y1 on that image. */
export const ATHLETICS_COLORS = {
  vault: "#cfd6de",       // gym roof, vault crest      300,500-420,514
  vaultFlank: "#bbc3c8",  // gym roof, vault flank      300,448-420,466
  vaultGap: "#515b63",    // shadow between vaults      300,662-420,670
  walkway: "#b5bfca",     // transverse walkway line    200,300-212,500
  natRoof: "#7c8c88",     // weathered deck, clean N/S  420,200-800,250
  skylight: "#d6e5e5",    // white structural rib       897,400-903,700
  poolLight: "#6dabb8",   // pool through glass, light  366,380-392,470
  poolDark: "#3d7d9f",    // pool through glass, dark   498,560-520,700
  deck: "#deb499",        // terracotta pool deck       900,890-990,950
  spa: "#83ced0",         // the small aqua spa oval    788,968-828,1002
  spaSurround: "#d8bca5", // pale paving ring around it 780,930-870,950
};

/* Measured off the roof closeup: eleven shadow lines at a 65 px pitch over a
   742 px roof, which at that image's 14.2 px/m is a 4.6 m vault. The two
   walkway seams sit at 16% and 82% of the vault run. */
const VAULT_PITCH = 4.6;
const VAULT_RISE = 0.3; // of pitch — these are shallow segments, not half-pipes
const VAULT_SEG = 8;
const VAULT_INSET = 0.7; // fascia strip at the gable ends
const WALKWAY_AT = [0.16, 0.82];
const WALKWAY_W = 1.5;

/* Natatorium closeup, roof bbox 199,180-1072,894 at 21.5 px/m: the skylight's
   fourteen ribs run 359..900 px across and 300..770 px down, centred both
   ways — 0.63 of the block's width, 0.66 of its depth, thirteen bays. */
const SKY_W = 0.63;
const SKY_D = 0.66;
const SKY_BAYS = 13;
const SKY_RIB = 0.34;   // m, rib width
const SKY_RISE = 0.55;  // m, ribs stand this proud of the deck
const DECK_FROM = 0.48; // deck starts this far across the block's width
const DECK_DEPTH = 9.0; // m south of the south wall
const SPA_AT = 0.714;   // spa centre, across the block's width
const SPA_SOUTH = 4.57; // m south of the south wall
const SPA_RX = 1.85;
const SPA_RZ = 1.7;

const infoFor = (massInfo, name) =>
  (massInfo && (typeof massInfo.get === "function" ? massInfo.get(name) : massInfo[name])) || null;

function bboxOf(ring) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, z] of ring) {
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  return { x0, x1, z0, z1 };
}

const inRect = (x, z, r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;

/**
 * Walk the ring in 0.5 m columns and record, per column, how much of it is
 * actually inside the polygon. A building joined to another by a link
 * corridor shows that link as a deep, narrow trough in the profile — which is
 * exactly what we split on.
 */
function coverProfile(ring, step = 0.5) {
  const bb = bboxOf(ring);
  const cols = [];
  for (let x = bb.x0 + step / 2; x < bb.x1; x += step) {
    const cuts = [];
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [ax, az] = ring[j];
      const [bx, bz] = ring[i];
      if (ax > x !== bx > x) cuts.push(az + ((x - ax) / (bx - ax)) * (bz - az));
    }
    if (cuts.length < 2) continue;
    cuts.sort((a, b) => a - b);
    let cov = 0;
    for (let k = 0; k + 1 < cuts.length; k += 2) cov += cuts[k + 1] - cuts[k];
    cols.push({ x, cov, z0: cuts[0], z1: cuts[cuts.length - 1] });
  }
  return { cols, step };
}

/** The two blocks the joined footprint is really made of, east and west. */
export function splitBlocks(ring) {
  const { cols, step } = coverProfile(ring);
  if (cols.length < 8) return { blocks: [], splitX: null };
  const maxCov = Math.max(...cols.map((c) => c.cov));

  /* The neck: the longest run of thin columns that does not touch either end
     of the building (a notched corner is thin too, but it is at an end). */
  let best = null;
  let run = null;
  cols.forEach((c, i) => {
    if (c.cov < 0.35 * maxCov) {
      run = run || { from: i, to: i };
      run.to = i;
    } else if (run) {
      if (run.from > 0 && run.to < cols.length - 1 && (!best || run.to - run.from > best.to - best.from)) best = run;
      run = null;
    }
  });
  if (!best) return { blocks: [rectFrom(cols, 0, cols.length - 1, step)], splitX: null };

  const splitX = (cols[best.from].x + cols[best.to].x) / 2;
  const sides = [
    cols.slice(0, best.from),
    cols.slice(best.to + 1),
  ];
  const blocks = [];
  for (const side of sides) {
    if (!side.length) continue;
    const cap = 0.4 * Math.max(...side.map((c) => c.cov));
    const keep = side.filter((c) => c.cov >= cap);
    if (keep.length) blocks.push(rectFrom(keep, 0, keep.length - 1, step));
  }
  blocks.sort((a, b) => b.area - a.area);
  return { blocks, splitX };
}

function rectFrom(cols, from, to, step) {
  const slice = cols.slice(from, to + 1);
  let z0 = Infinity, z1 = -Infinity, area = 0;
  for (const c of slice) {
    if (c.z0 < z0) z0 = c.z0;
    if (c.z1 > z1) z1 = c.z1;
    area += c.cov * step;
  }
  const rect = { x0: slice[0].x - step / 2, x1: slice[slice.length - 1].x + step / 2, z0, z1 };
  return { rect, area, cx: (rect.x0 + rect.x1) / 2, cz: (rect.z0 + rect.z1) / 2 };
}

/**
 * Everything the renderer needs, from the shipped data alone: which rectangle
 * each roof sits on, how many vaults and how wide, where the skylight and the
 * pool deck land. No THREE — the tests run this in Node.
 */
export function athleticsSpec(campus, massInfo) {
  const gymBuilding = (campus.buildings || []).find((b) => b.n === "Main Gym");
  if (!gymBuilding?.p || gymBuilding.p.length < 3) return null;
  const { blocks, splitX } = splitBlocks(gymBuilding.p);
  if (!blocks.length) return null;

  /* East of the neck is the gym (and the bigger of the two); west is the pool
     hall. With no neck at all we only get the gym. */
  const gym = blocks.find((b) => splitX === null || b.cx > splitX) || blocks[0];
  const nat = blocks.find((b) => b !== gym && b.cx < splitX) || null;

  /* The massing we are standing on. Both blocks render under the one name
     "Main Gym" — the university's Natatorium mass gets renamed to its OSM host
     — so the ring we are handed may belong to either block; use it only for
     the block it actually covers, and take the height for both. */
  const mass = infoFor(massInfo, "Main Gym");
  const height = mass?.h ?? gymBuilding.h ?? 16;
  if (mass?.ring) {
    const bb = bboxOf(mass.ring);
    const c = { x: (bb.x0 + bb.x1) / 2, z: (bb.z0 + bb.z1) / 2 };
    for (const block of [gym, nat]) {
      if (block && inRect(c.x, c.z, block.rect)) {
        block.rect = bb;
        block.cx = c.x;
        block.cz = c.z;
      }
    }
  }

  return {
    height,
    /* The RENDERED roof height, when the massing is present. The ground
       slopes here, and the massing takes its grade at the mass centroid —
       recomputing grade from the block centre landed the vault field up to
       1.4 m LOWER, exactly inside the lid, and the roof shipped flat. */
    topY: mass?.topY ?? null,
    gym: vaultField(gym),
    natatorium: nat ? natSpec(nat) : null,
    colors: ATHLETICS_COLORS,
  };
}

/** The vault field: axis along the block's long side, count from the pitch. */
function vaultField(block) {
  const r = block.rect;
  const w = r.x1 - r.x0;
  const d = r.z1 - r.z0;
  /* The aerial shows the vaults running EAST-WEST. The footprint is nearly
     square (the massing bbox measures 54×55 m), so a bare longest-side rule
     flips on a metre of noise; prefer east-west unless the footprint is
     decisively deeper than wide. */
  const alongX = w >= d - 3;
  const span = alongX ? d : w;      // across the vaults
  const length = alongX ? w : d;    // along one vault
  const count = Math.min(13, Math.max(9, Math.round(span / VAULT_PITCH)));
  const pitch = span / count;
  const rise = pitch * VAULT_RISE;
  const from = (alongX ? r.x0 : r.z0) + VAULT_INSET;
  const to = (alongX ? r.x1 : r.z1) - VAULT_INSET;
  const base = alongX ? r.z0 : r.x0;

  const vaults = [];
  for (let i = 0; i < count; i++) {
    vaults.push({ at: base + (i + 0.5) * pitch, halfW: pitch / 2 - 0.12, from, to });
  }
  return {
    rect: r,
    axis: alongX ? "x" : "z",
    count,
    pitch,
    rise,
    length: to - from,
    span,
    vaults,
    walkways: WALKWAY_AT.map((t) => ({ at: from + t * (to - from), width: WALKWAY_W })),
    /* How much of the real footprint the vault field lands on. Under 0.7 and
       the field has slid off the building; over 1.6 and it has run past it. */
    coverage: ((to - from) * span) / block.area,
    area: block.area,
  };
}

/** Skylight, pool bands, terracotta deck and the spa oval on its south side. */
function natSpec(block) {
  const r = block.rect;
  const w = r.x1 - r.x0;
  const d = r.z1 - r.z0;
  const alongX = w >= d; // bays are counted across the block's long axis
  const skyW = SKY_W * w;
  const skyD = SKY_D * d;
  const sky = {
    x0: block.cx - skyW / 2, x1: block.cx + skyW / 2,
    z0: block.cz - skyD / 2, z1: block.cz + skyD / 2,
  };
  const bayAxis = alongX ? "x" : "z";
  const bayPitch = (alongX ? skyW : skyD) / SKY_BAYS;
  const bays = [];
  for (let i = 0; i < SKY_BAYS; i++) {
    const at = (alongX ? sky.x0 : sky.z0) + (i + 0.5) * bayPitch;
    /* Lap lanes band the water light/dark; the aerial alternates every bay. */
    bays.push({ at, light: i % 2 === 0 });
  }
  return {
    rect: r,
    anchor: { x: block.cx, z: block.cz },
    skylight: sky,
    bayAxis,
    bayPitch,
    bayCount: SKY_BAYS,
    bays,
    ribWidth: SKY_RIB,
    rise: SKY_RISE,
    deck: { x0: r.x0 + DECK_FROM * w, x1: r.x1, z0: r.z1, z1: r.z1 + DECK_DEPTH },
    spa: { x: r.x0 + SPA_AT * w, z: r.z1 + SPA_SOUTH, rx: SPA_RX, rz: SPA_RZ },
    area: block.area,
  };
}

/* --------------------------------------------------------------- rendering */

/** A triangle soup with a colour per vertex — everything opaque on one roof
    merges into one of these, so a whole building is one draw call. */
class Soup {
  constructor() {
    this.pos = [];
    this.col = [];
    this.cache = new Map();
  }
  rgb(hex) {
    if (!this.cache.has(hex)) {
      const c = new THREE.Color(hex);
      this.cache.set(hex, [c.r, c.g, c.b]);
    }
    return this.cache.get(hex);
  }
  tri(a, b, c, hex) {
    const [r, g, bl] = this.rgb(hex);
    for (const p of [a, b, c]) {
      this.pos.push(p[0], p[1], p[2]);
      this.col.push(r, g, bl);
    }
  }
  quad(a, b, c, d, hex) {
    this.tri(a, b, c, hex);
    this.tri(a, c, d, hex);
  }
  /** Flat horizontal plate, optionally subdivided so it can follow grade. */
  plate(x0, z0, x1, z1, yAt, hex, n = 1) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const ax = x0 + ((x1 - x0) * i) / n;
        const bx = x0 + ((x1 - x0) * (i + 1)) / n;
        const az = z0 + ((z1 - z0) * j) / n;
        const bz = z0 + ((z1 - z0) * (j + 1)) / n;
        this.quad(
          [ax, yAt(ax, az), az], [ax, yAt(ax, bz), bz],
          [bx, yAt(bx, bz), bz], [bx, yAt(bx, az), az], hex
        );
      }
    }
  }
  box(x0, z0, x1, z1, y0, y1, hex) {
    const top = [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]];
    this.quad(...top, hex);
    const wall = (a, b) => this.quad([a[0], y0, a[2]], [b[0], y0, b[2]], [b[0], y1, b[2]], [a[0], y1, a[2]], hex);
    wall(top[1], top[0]); wall(top[2], top[1]); wall(top[3], top[2]); wall(top[0], top[3]);
  }
  ellipse(cx, cz, rx, rz, y, hex, seg = 20) {
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const b = ((i + 1) / seg) * Math.PI * 2;
      this.tri(
        [cx, y, cz],
        [cx + rx * Math.cos(a), y, cz + rz * Math.sin(a)],
        [cx + rx * Math.cos(b), y, cz + rz * Math.sin(b)], hex
      );
    }
  }
  build() {
    if (!this.pos.length) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(this.pos), 3));
    geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(this.col), 3));
    geo.computeVertexNormals();
    return geo;
  }
}

/** One barrel vault: a shallow circular segment swept along the vault axis,
    closed at both gable ends so it never reads hollow from the ground. */
function addVault(soup, v, { axis, rise }, y, colors) {
  const pt = (t, at) => {
    const off = v.halfW * Math.cos(Math.PI * t);
    const h = y + rise * Math.sin(Math.PI * t);
    return axis === "x" ? [at, h, v.at + off] : [v.at + off, h, at];
  };
  /* Swapping the x/z components for the other axis MIRRORS every triangle,
     which silently flips its winding: the z-axis vaults shipped facing DOWN,
     were backface-culled from above, and the roof read as its dark deck.
     Emit through one orientation-aware quad so both axes face the sky. */
  const emit = (a, b, c, d, hex) =>
    axis === "x" ? soup.quad(a, b, c, d, hex) : soup.quad(d, c, b, a, hex);
  const capFlip = (flip) => (axis === "x" ? flip : !flip);
  for (let k = 0; k < VAULT_SEG; k++) {
    const t0 = k / VAULT_SEG;
    const t1 = (k + 1) / VAULT_SEG;
    /* Crest catches the light, flanks fall away — Lambert does the rest. */
    const hex = Math.abs(t0 - 0.5) < 0.26 ? colors.vault : colors.vaultFlank;
    emit(pt(t0, v.from), pt(t0, v.to), pt(t1, v.to), pt(t1, v.from), hex);
  }
  for (const [at, rawFlip] of [[v.from, false], [v.to, true]]) {
    const flip = capFlip(rawFlip);
    const c = axis === "x" ? [at, y, v.at] : [v.at, y, at];
    for (let k = 0; k < VAULT_SEG; k++) {
      const a = pt(k / VAULT_SEG, at);
      const b = pt((k + 1) / VAULT_SEG, at);
      soup.tri(c, flip ? b : a, flip ? a : b, colors.vaultFlank);
    }
  }
}

/**
 * The vault field on Main Gym and the skylight, pool and deck on the
 * Natatorium — three merged draw calls (two opaque roofs, one glass panel).
 */
export function createAthletics(scene, { campus, heightAt, massInfo }) {
  const spec = athleticsSpec(campus, massInfo);
  if (!spec) return null;
  const c = ATHLETICS_COLORS;
  const group = new THREE.Group();
  const opaque = new THREE.MeshLambertMaterial({ vertexColors: true });

  /* -------- Main Gym: eleven-ish vaults over a shadowed deck -------- */
  const gym = spec.gym;
  const gymGrade = heightAt(gym.rect.x0 + (gym.rect.x1 - gym.rect.x0) / 2,
                            gym.rect.z0 + (gym.rect.z1 - gym.rect.z0) / 2) + spec.height;
  /* Sit ON the rendered lid, never inside it: the massing's own topY wins
     when it is the taller answer, plus a hand's width so nothing z-fights. */
  const gymY = Math.max(spec.topY ?? 0, gymGrade) + 0.12;
  const gymSoup = new Soup();
  /* The gaps between vaults are what the aerial actually shows: a dark deck
     seen edge-on. Lay it first, then sit the vaults on it. */
  gymSoup.plate(gym.rect.x0, gym.rect.z0, gym.rect.x1, gym.rect.z1, () => gymY + 0.04, c.vaultGap);
  for (const v of gym.vaults) addVault(gymSoup, v, gym, gymY + 0.05, c);
  /* Two transverse walkways: flush with the crest, buried at the flanks, so
     they read as the thin seams that cross the field. */
  for (const wk of gym.walkways) {
    const half = wk.width / 2;
    if (gym.axis === "x") {
      gymSoup.plate(wk.at - half, gym.rect.z0, wk.at + half, gym.rect.z1, () => gymY + gym.rise, c.walkway);
    } else {
      gymSoup.plate(gym.rect.x0, wk.at - half, gym.rect.x1, wk.at + half, () => gymY + gym.rise, c.walkway);
    }
  }
  const gymGeo = gymSoup.build();
  if (gymGeo) group.add(new THREE.Mesh(gymGeo, opaque));

  /* -------- Natatorium: grey-green deck, white grid, blue water -------- */
  const nat = spec.natatorium;
  let poolMesh = null;
  if (nat) {
    /* Same slope hazard as the gym: the pool hall's lid takes its grade at
       its own centroid, so ride clear of it rather than recompute it. */
    const natY = Math.max(spec.topY ?? 0, heightAt(nat.anchor.x, nat.anchor.z) + spec.height) + 0.12;
    const s = new Soup();
    s.plate(nat.rect.x0, nat.rect.z0, nat.rect.x1, nat.rect.z1, () => natY + 0.04, c.natRoof);

    /* The skylight frame: a rib per bay edge running the short way, a rib at
       each end running the long way, and a chevron gable capping every bay —
       the shape that makes this roof unmistakable from above. */
    const sky = nat.skylight;
    const alongX = nat.bayAxis === "x";
    const ribTop = natY + 0.05 + nat.rise;
    const hr = nat.ribWidth / 2;
    for (let i = 0; i <= nat.bayCount; i++) {
      const at = (alongX ? sky.x0 : sky.z0) + i * nat.bayPitch;
      if (alongX) s.box(at - hr, sky.z0, at + hr, sky.z1, natY + 0.05, ribTop, c.skylight);
      else s.box(sky.x0, at - hr, sky.x1, at + hr, natY + 0.05, ribTop, c.skylight);
    }
    for (const end of alongX ? [sky.z0, sky.z1] : [sky.x0, sky.x1]) {
      if (alongX) s.box(sky.x0 - hr, end - hr, sky.x1 + hr, end + hr, natY + 0.05, ribTop, c.skylight);
      else s.box(end - hr, sky.z0 - hr, end + hr, sky.z1 + hr, natY + 0.05, ribTop, c.skylight);
    }
    /* Chevron ends: each bay closes with a little ridge that rises to a peak
       and falls again — two triangles' worth, at both ends of the bay. */
    for (const bay of nat.bays) {
      const half = nat.bayPitch / 2 - hr;
      for (const [end, dir] of alongX ? [[sky.z0, 1], [sky.z1, -1]] : [[sky.x0, 1], [sky.x1, -1]]) {
        const p = (o, back, y) => (alongX
          ? [bay.at + o, y, end + back * dir]
          : [end + back * dir, y, bay.at + o]);
        s.tri(p(-half, 0, ribTop), p(0, half, ribTop + nat.rise * 0.5), p(half, 0, ribTop), c.skylight);
        s.tri(p(-half, 0, natY + 0.05), p(0, half, ribTop), p(half, 0, natY + 0.05), c.skylight);
      }
    }

    /* South pool deck on real grade, with the spa oval in its pale ring. */
    const dk = nat.deck;
    const grade = (x, z) => heightAt(x, z) + 0.05;
    s.plate(dk.x0, dk.z0, dk.x1, dk.z1, grade, c.deck, 4);
    const spa = nat.spa;
    const spaY = heightAt(spa.x, spa.z);
    s.ellipse(spa.x, spa.z, spa.rx * 1.55, spa.rz * 1.6, spaY + 0.07, c.spaSurround);
    s.ellipse(spa.x, spa.z, spa.rx, spa.rz, spaY + 0.09, c.spa);

    const natGeo = s.build();
    if (natGeo) group.add(new THREE.Mesh(natGeo, opaque));

    /* The water, seen through the glass: banded light and dark along the lap
       lanes. Translucent so the white grid above it still reads as structure. */
    const water = new Soup();
    for (const bay of nat.bays) {
      const half = nat.bayPitch / 2;
      const hex = bay.light ? c.poolLight : c.poolDark;
      if (alongX) water.plate(bay.at - half, sky.z0, bay.at + half, sky.z1, () => natY + 0.35, hex);
      else water.plate(sky.x0, bay.at - half, sky.x1, bay.at + half, () => natY + 0.35, hex);
    }
    const waterGeo = water.build();
    if (waterGeo) {
      poolMesh = new THREE.Mesh(waterGeo, new THREE.MeshLambertMaterial({
        vertexColors: true, transparent: true, opacity: 0.88,
      }));
      group.add(poolMesh);
    }
  }

  scene.add(group);
  return { group, spec, drawCalls: group.children.length };
}
