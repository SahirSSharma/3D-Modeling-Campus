// Revelle Commons / 64 Degrees / 64 North, Revelle College — from photographs,
// the INVENTED class.
//
// ONE 1966 building by Robert Evans Alexander, re-fronted outside and rebuilt
// inside by Studio E Architects (Eric Naslund FAIA), opened September 2014.
// "64 Degrees" and "64 North" are TENANCY names inside it, not buildings, and
// nothing in this file speaks of them as three buildings. They are, however,
// three structural BLOCKS, and that is what shaped this module:
//
//   1. THREE ROOFS, ONE PRISM, AND THE STACK ONLY FITS ONE OF THEM. LiDAR 2014
//      measures the three blocks at 9.9 / 7.5 / 5.0 m; campus-massing.js
//      extrudes ONE mass and closes it at massHeights["m:-100,359"] = 11.3 m
//      over all three. The bands here hang UPWARD from each block's own drawn
//      surface to that block's own height, so every sourced dimension keeps its
//      measured value and the residue is one honest band of bare mass per block
//      (1.4 / 3.8 / 6.3 m), declared in `conflicts` and painted over by nothing.
//      The consequence the research did not anticipate: the MEASURED stack is
//      9.772 m tall, so it does not fit a 7.5 m block and it certainly does not
//      fit a 5.0 m one. The parapet, soffit and plinth are the same continuous
//      elements round both treated blocks and keep their measured values; the
//      GLAZING is the one variable element and absorbs the difference, derived
//      per block from that block's own LiDAR height. Nothing is scaled.
//
//   2. SEVEN FACES OF TEN, AND THE LINE BETWEEN THEM IS PROGRAM. The four faces
//      with a photograph carry the full glazed system. The 64 North block's
//      three faces have none, and they carry the building's NON-PROGRAM-BEARING
//      bands only — parapet, soffit, plinth and a derived blank precast panel —
//      as a labelled `[estimated]` extension. Glazing is program-bearing and
//      both Studio E plans put back-of-house behind those faces, so it is
//      withheld there and no bay, mullion or opening reaches them. The
//      remaining three runs (the Commons' west and north, and the slot) are
//      declared in `absent` with their ladders climbed and failed.
//
//   3. NO ORTHO FIGURE SHIPS, SO NO ROOF OBJECT AND NO LANDSCAPE SHIPS. The
//      local re-fit of the 2026 ortho's top displacement refutes the imported
//      rate it was asked to check: on the three usable z edges a constant beats
//      a height-proportional rate by 3.48x, and the fit-free diagnostic settles
//      it without any fitted parameter — the 5.0 m block displaces 0.881 of what
//      the 9.9 m block does where a proportional model requires 0.505. The x
//      axis has only two usable edges and CANNOT discriminate; that is recorded
//      rather than claimed as corroboration. What the refutation costs is stated
//      narrowly: both SOUTH edges are excluded for a measured reason, so the
//      fitted constant is untested exactly where the south terrace is. The
//      roofscape is unbuildable twice over regardless — a curb on the Commons
//      roof stands 3.8 m inside solid drawn mass.
//
//   4. NO DIMENSION AND NO COLOUR LIVES IN THIS FILE. Every metre comes out of
//      the section — `derivations.figures` (with the arithmetic that produces
//      it), `estimates` (banded, labelled, naming the pattern extended),
//      `reads` (a citation and a tolerance) or `draw` (render offsets, declared
//      as offsets and not as claims about the building). Every hex comes from
//      `colors` with its own sample rectangle recorded in `colorSources`. The
//      test fails on a bare number or a hex literal here.
//
//   5. THE FACES HANG OFF THE DRAWN GIS RING, NOT THE OSM OUTLINE. OSM is the
//      building — its Commons roof width is exact to 2 cm against the ortho —
//      but GIS is what renders, so a facade on the OSM line would float 2-3 m
//      inside the mass the eye sees. The sourced 1.551709 m module is therefore
//      applied by COUNT against each drawn face length, and the shipped bay is
//      length/count per face. The 2-3 m of GIS inflation lands in a 1-2 cm
//      per-bay difference that is declared per face, never in a stretched
//      module.
//
// Surfaces come from the procedural material library (campus-materials.js):
// the library supplies microstructure at true panel and board scale, the
// section supplies the colour. Deterministic throughout — the only irregularity
// source is `hash`, seeded from the section's own pinned `seed`.
import * as THREE from "../vendor/three/three.module.min.js";
import { applyOverlayDepth, overlayLift } from "./campus-overlay.js";
import { sharedMaterialLibrary } from "./campus-materials.js";

let LIB = null;
const lib = () => (LIB ??= sharedMaterialLibrary(THREE));

/* Exposed-aggregate precast at true panel scale — the 1966 parapet band and
   the round columns are the same fabric and take the same class. */
const precast = (color, w, h, tile) =>
  lib().get("boardFormedConcrete", {
    color, normalScale: 0.8,
    repeat: [Math.max(1, w / tile), Math.max(1, h / tile)],
  });
const smooth = (color) => lib().get("smoothConcrete", { color });
const glassMat = (color) => lib().get("glass", { color });
const metal = (color) => lib().get("metalPanel", { color, metalness: 0.5, roughness: 0.42 });
/* The blank graphic panel and the yellow sign are UNLIT-adjacent flat fields:
   they are stand-ins for a printed image and for painted letterforms, and a
   procedural microstructure on either would invent a texture the source does
   not have. Plain standard material, the section's own tone. */
const flat = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.0 });

/** Deterministic 0..1 from any integer mix — a reload rebuilds the same wall. */
function hash(...ns) {
  let s = 0;
  for (let i = 0; i < ns.length; i++) s = s * 131.71 + ns[i] * 57.13 + 7.9;
  const v = Math.sin(s) * 43758.5453;
  return v - Math.floor(v);
}

/** One InstancedMesh from a list of placements (the keeling/york convention). */
function instanced(geo, mat, items) {
  const mesh = new THREE.InstancedMesh(geo, mat, items.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const pos = new THREE.Vector3();
  items.forEach((p, i) => {
    e.set(p.rotX || 0, p.rot || 0, p.rotZ || 0, "YXZ");
    q.setFromEuler(e);
    s.set(p.scale?.[0] ?? 1, p.scale?.[1] ?? 1, p.scale?.[2] ?? 1);
    pos.set(p.x, p.y, p.z);
    m.compose(pos, q, s);
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * A facade's own frame. The tangent is the DRAWN edge itself; `out` only
 * decides which perpendicular is outward. `at(u, w, y)`: u metres along the
 * face from `a`, w metres proud, y in world height.
 */
function frameOf(f) {
  const [sx, sz] = f.a;
  const [ex, ez] = f.b;
  const length = Math.hypot(ex - sx, ez - sz);
  const tx = (ex - sx) / length;
  const tz = (ez - sz) / length;
  let nx = tz;
  let nz = -tx;
  if (nx * f.out[0] + nz * f.out[1] < 0) { nx = -nx; nz = -nz; }
  return {
    id: f.id, length, rot: Math.atan2(nx, nz), nx, nz, tx, tz,
    at: (u, w, y) => ({ x: sx + tx * u + nx * w, y, z: sz + tz * u + nz * w }),
  };
}

/**
 * THE BLOCK DATUM. Lowest drawn surface anywhere along the faces this block
 * treats, sampled every `step` metres at the wall line. Every band on the block
 * hangs upward from this ONE height, so a corner between two of its faces
 * cannot step, and nothing on the block can hover: the plinth's foot is at or
 * below the drawn ground at every station of every face it touches.
 */
function blockDatum(section, block, ground, step) {
  let lo = Infinity;
  for (const f of section.facades) {
    if (f.block !== block) continue;
    const fr = frameOf(f);
    const n = Math.max(2, Math.ceil(fr.length / step));
    for (let i = 0; i <= n; i++) {
      const p = fr.at((i * fr.length) / n, 0, 0);
      const g = ground(p.x, p.z);
      if (Number.isFinite(g) && g < lo) lo = g;
    }
  }
  /* Same rule as the court floor: defaulting to absolute zero here would sink a
     whole block's treatment ~24 m rather than fail. */
  if (!Number.isFinite(lo)) {
    throw new Error(`campus-photo-revellecommons: surfaceAt returned nothing finite along the ${block} block's faces`);
  }
  return lo;
}

/**
 * HOW FAR THIS FACE'S DRAWN RING BULGES PROUD OF ITS DECLARED CHORD.
 *
 * A face is declared as one chord between two ring vertices, but three of the
 * seven span collinear INTERMEDIATE vertices, and "collinear" is only collinear
 * to a tolerance: `commonsSouth`'s ring stands 0.0795 m outboard of its own
 * chord at (-110.2, 396). Anything drawn at a smaller offset is INSIDE the
 * extruded mass and simply disappears — which is exactly what the visual critic
 * caught, a soffit and plinth that ran present / absent / present along the
 * terrace while the 0.10 m mullions and the 0.55 m columns survived.
 *
 * So every face's own bulge is measured off the ring here and added to the
 * declared clearance. A flush face still gets the base offset; a bulging one
 * gets exactly what it needs and not a centimetre more. The number is derived,
 * never typed, and the test asserts no element lies inside the ring.
 */
function faceBulge(section, f) {
  const ring = section.measured.ring;
  const ia = ring.findIndex(([x, z]) => x === f.a[0] && z === f.a[1]);
  let ib = -1;
  for (let i = ia + 1; i < ring.length; i++) {
    if (ring[i][0] === f.b[0] && ring[i][1] === f.b[1]) { ib = i; break; }
  }
  if (ib === -1) ib = ring.findIndex(([x, z]) => x === f.b[0] && z === f.b[1]);
  const len = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]);
  let nx = (f.b[1] - f.a[1]) / len;
  let nz = -(f.b[0] - f.a[0]) / len;
  if (nx * f.out[0] + nz * f.out[1] < 0) { nx = -nx; nz = -nz; }
  let bulge = 0;
  for (let i = Math.min(ia, ib) + 1; i < Math.max(ia, ib); i++) {
    const d = (ring[i][0] - f.a[0]) * nx + (ring[i][1] - f.a[1]) * nz;
    if (d > bulge) bulge = d;
  }
  return bulge;
}

/** Bay centres along a face at the face's own shipped bay. */
function bayCentres(length, count) {
  const out = [];
  const module = length / count;
  for (let i = 0; i < count; i++) out.push({ i, u: (i + 0.5) * module, module });
  return out;
}

/**
 * What each bay of a face carries. Only the east face of the 64 Degrees block
 * has anything but plain glazing, and each of its four kinds is placed by a
 * rule the section states rather than by a coordinate: the graphic occupies its
 * counted 11 bays from the declared first bay, the signage wall is the declared
 * number of bays immediately NORTH of it, and the entry is the one bay
 * immediately NORTH of the signage wall. `u` runs from the face's `a` vertex,
 * which on this face is its SOUTH end, so a higher bay index is further north.
 *
 * The hand shipped SOUTH and was reversed at audit. Two independent
 * photographic reads put the group north — the dusk frame turning the block's
 * south-east corner shows the graphic's left-end content there and none of the
 * sign, wall or doors — and research §5.1 said so all along.
 */
function bayKind(section, f, i) {
  const G = section.system.graphic;
  const W = section.system.signageWall;
  if (f.id !== G.face) return "glazing";
  if (i >= G.firstBay && i < G.firstBay + G.bays) return "graphic";
  /* THE COMPASS HAND. `u` runs from the face's `a` vertex, which on this face is
     its SOUTH end, so a higher bay index is further NORTH — and the group sits
     NORTH of the graphic. It shipped SOUTH on an unevidenced assumption about
     which way the elevation frame faces, and two independent photographic reads
     say otherwise: see conflicts['sign-and-doors-hand']. The station these are
     measured from is in the data, so this function states the ORDER and nothing
     else. */
  const wall0 = G.firstBay + G.bays;
  if (i >= wall0 && i < wall0 + W.bays) return "signageWall";
  if (i === wall0 + W.bays) return "entry";
  return "glazing";
}

/**
 * The court floor, DRAPED on the drawn terrain — one vertex every `seg` metres,
 * each at its own local `surfaceAt` plus the declared rung, so the floor follows
 * the surface instead of seating flat at its centre. The extruder opens this
 * void as a shaft through an 11.3 m prism with no floor at all; this is the one
 * piece of ground the section ships and the reason it exists.
 */
function courtFloor(section, ground, lift, seg) {
  const C = section.court;
  const nx = Math.max(1, Math.ceil((C.x1 - C.x0) / seg));
  const nz = Math.max(1, Math.ceil((C.z1 - C.z0) / seg));
  const pos = [];
  const uv = [];
  const idx = [];
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const x = C.x0 + ((C.x1 - C.x0) * i) / nx;
      const z = C.z0 + ((C.z1 - C.z0) * j) / nz;
      const g = ground(x, z);
      /* A non-finite sample used to fall back to ABSOLUTE ZERO, which drops one
         floor vertex ~24 m and spikes the mesh. A sampler that cannot answer
         inside the court is a broken sampler and must say so — the module's own
         posture where a MISSING sampler is a hard error. */
      if (!Number.isFinite(g)) {
        throw new Error(`campus-photo-revellecommons: surfaceAt returned ${g} inside the courtyard at (${x}, ${z})`);
      }
      pos.push(x, g + lift, z);
      uv.push(i / nx, j / nz);
    }
  }
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      idx.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/* ------------------------------------------------------------------ api */

/**
 * Build the Revelle Commons cluster's photo-sourced detail.
 *
 * `photo` is the loaded photo-detail document; this reads only its
 * `revellecommons` section and writes nothing back. `surfaceAt` — the drawn
 * terrain triangle — is what everything seats on, because anything PLACED on
 * the ground must use the height of the drawn triangle and not `heightAt`'s
 * interpolation of every LiDAR sample. LiDAR is valid on this building: it is a
 * 1966 structure whose 2014 work changed no massing, so `heights[]` describes
 * it as it stands, and `arcgis.h` is never read — it is a formula over a levels
 * field this section's own sources disprove.
 */
export function createPhotoRevellecommons(scene, { photo, heightAt, surfaceAt } = {}) {
  const group = new THREE.Group();
  group.name = "photo-revellecommons";
  const section = photo?.revellecommons;
  if (!section) {
    scene?.add(group);
    return { group, counts: {} };
  }
  const ground = surfaceAt || heightAt;
  if (typeof ground !== "function") {
    throw new Error("campus-photo-revellecommons: needs surfaceAt (or heightAt) to place on the ground");
  }
  /* A pre-R2 document describes this cluster with no band system at all.
     Half-building it would ship four bare faces with nothing on screen to say
     so, which is the failure mode blake's pre-R1 guard was written against. */
  if (!section.system?.bands || !section.court) {
    throw new Error("campus-photo-revellecommons: section predates the R2 merge — refusing to build half a cluster");
  }

  const { colors, draw: D, system: SY } = section;
  /* EVERY COLOUR GOES THROUGH HERE, and a role the section does not carry is a
     hard error rather than a default. campus-materials.js destructures
     `color = 0xffffff`, so an undefined role does not throw, does not warn and
     does not look wrong in code — it ships an OPAQUE WHITE surface. That is
     exactly how the canopy sail went out unpainted: the module referenced
     `hue("canopyFabric")`, the section never carried it, and every gate passed
     because nothing anywhere compared the two lists. */
  const hue = (role) => {
    const v = colors[role];
    if (typeof v !== "string") {
      throw new Error(`campus-photo-revellecommons: no colour declared for role "${role}" — `
        + "an unset role silently becomes white in campus-materials.js and must never reach a material");
    }
    return v;
  };
  const B = SY.bands;
  const TILE = D.tiles;

  const bins = {
    parapets: [], soffits: [], plinths: [], skirts: [], blankBands: [],
    glazing: [], graphic: [], signageWall: [], entryGlass: [],
    mullions: [], transoms: [], signPlates: [], columns: [],
    canopyFabric: [], canopyStruts: [], fasciaSigns: [],
  };

  /* One datum per block, solved from the sampler — never typed. */
  const datum = {};
  for (const f of section.facades) {
    if (datum[f.block] === undefined) {
      datum[f.block] = blockDatum(section, f.block, ground, D.tiles.concrete);
    }
  }

  for (const f of section.facades) {
    const fr = frameOf(f);
    const base = datum[f.block];
    /* Every 0.06-class element on this face clears the face's OWN ring bulge. */
    const OFF = D.wallOffset + faceBulge(section, f);
    /* The one band that varies block to block. On the two GLAZED blocks it is
       glazing, derived per block from that block's own LiDAR height; on 64
       North it is BLANK PRECAST, because glazing is program-bearing and both
       plans put back-of-house behind those faces. Same derivation, different
       material, and the section says which is which. */
    const glazing = f.glazed ? B.glazing[f.block] : B.blank[f.block];
    if (typeof glazing !== "number") {
      throw new Error(`campus-photo-revellecommons: no band declared for block ${f.block}`);
    }
    const yPlinth = base;
    const yGlazing = yPlinth + B.plinth;
    const ySoffit = yGlazing + glazing;
    const yParapet = ySoffit + B.soffit;

    /* The four continuous bands, one run each, the full face length. */
    bins.plinths.push({
      ...fr.at(fr.length / 2, OFF, yPlinth + B.plinth / 2),
      rot: fr.rot, scale: [fr.length, B.plinth, 1], w: fr.length, h: B.plinth,
    });
    bins.soffits.push({
      ...fr.at(fr.length / 2, OFF, ySoffit + B.soffit / 2),
      rot: fr.rot, scale: [fr.length, B.soffit, 1], w: fr.length, h: B.soffit,
    });
    bins.parapets.push({
      ...fr.at(fr.length / 2, OFF, yParapet + B.parapet / 2),
      rot: fr.rot, scale: [fr.length, B.parapet, 1], w: fr.length, h: B.parapet,
    });

    /* THE SKIRT. The plinth is carried down past the lowest drawn surface under
       this face so a rolling terrain cannot open a gap at its foot. The block
       datum is already the minimum along the block, so this only ever buries. */
    bins.skirts.push({
      ...fr.at(fr.length / 2, OFF, base - D.skirtDepth / 2),
      rot: fr.rot, scale: [fr.length, D.skirtDepth, 1], w: fr.length, h: D.skirtDepth,
    });

    /* A BLANK face carries the band as ONE precast run and stops: no bay, no
       mullion, no transom, no opening. Everything below this point is the
       glazed system, and nothing in it may reach a 64 North face. */
    if (!f.glazed) {
      bins.blankBands.push({
        ...fr.at(fr.length / 2, OFF, yGlazing + glazing / 2),
        rot: fr.rot, scale: [fr.length, glazing, 1], w: fr.length, h: glazing,
      });
      continue;
    }

    /* The glazing band, bay by bay. */
    const bays = bayCentres(fr.length, f.bays);
    for (const bay of bays) {
      const kind = bayKind(section, f, bay.i);
      const w = bay.module - SY.mullion.width;
      if (kind === "signageWall") {
        bins.signageWall.push({
          ...fr.at(bay.u, OFF + D.graphicProud, yGlazing + glazing / 2),
          rot: fr.rot, scale: [bay.module, glazing, 1],
        });
      } else if (kind === "entry") {
        /* One pair of leaves, cut out of the sourced storefront's own module. */
        const E = SY.entry;
        const leaf = E.leafWidthIn * section.derivations.units.inch;
        const hEntry = E.heightIn * section.derivations.units.inch;
        for (let k = 0; k < E.leaves; k++) {
          bins.entryGlass.push({
            ...fr.at(bay.u + (k - (E.leaves - 1) / 2) * leaf,
              OFF + D.graphicProud, yGlazing + hEntry / 2),
            rot: fr.rot, scale: [leaf, hEntry, 1],
          });
        }
        /* The bay above the doors stays glazed — nothing is left as a hole. */
        bins.glazing.push({
          ...fr.at(bay.u, OFF, yGlazing + hEntry + (glazing - hEntry) / 2),
          rot: fr.rot, scale: [w, glazing - hEntry, 1],
        });
      } else if (kind === "graphic") {
        bins.graphic.push({
          ...fr.at(bay.u, OFF + D.graphicProud, yGlazing + glazing / 2),
          rot: fr.rot, scale: [w, glazing, 1],
        });
      } else {
        bins.glazing.push({
          ...fr.at(bay.u, OFF, yGlazing + glazing / 2),
          rot: fr.rot, scale: [w, glazing, 1],
        });
      }
    }

    /* A mullion on every bay boundary, both ends included. */
    for (let i = 0; i <= f.bays; i++) {
      bins.mullions.push({
        ...fr.at((i * fr.length) / f.bays, OFF + D.mullionProud,
          yGlazing + glazing / 2),
        rot: fr.rot, scale: [SY.mullion.width, glazing, SY.mullion.width],
      });
    }

    /* The transom bar, on the 64 Degrees block only — the block its height was
       measured on. The Commons' glazing band is DERIVED and carries none. */
    if (SY.transom.blocks.includes(f.block)) {
      bins.transoms.push({
        ...fr.at(fr.length / 2, OFF + D.mullionProud,
          yGlazing + SY.transom.centre),
        rot: fr.rot, scale: [fr.length, SY.transom.depth, SY.transom.depth],
      });
    }

    /* The freestanding sign, on the face the section names, standing proud of
       the signage wall with its foot ON the plinth top — which is where the
       saturation mask's own foot lands, 0.029 m from the independently read
       plinth line. */
    if (f.id === SY.sign.face) {
      const G = SY.graphic;
      const wall0 = G.firstBay + G.bays;
      const uSign = ((wall0 + SY.signageWall.bays / 2) * fr.length) / f.bays;
      bins.signPlates.push({
        ...fr.at(uSign, OFF + D.signProud, yGlazing + SY.sign.height / 2),
        rot: fr.rot, scale: [SY.sign.width, SY.sign.height, D.signDepth],
      });
    }

    /* THE 2014 ENTRY CANOPY and the FASCIA SIGN, on the face the section names.
       Both were shipped `built: false` because the ENTRY's station was
       unresolved; the visual critic ruled that a building-mounted element is
       not covered by the withheld terrace landscape, and three frames agree on
       which END of the face they sit at, so they ship on a stated rule with the
       station banded rather than on a coordinate.

       The fabric is ONE tensioned panel sloping out and DOWN from just under the
       soffit, on radiating struts. It reads silver in daylight (frame 16) and
       dark at dusk (frames 18, 33) because it is translucent fabric against the
       sky — one object in one epoch, not two. */
    const CN = SY.canopy;
    if (CN.built && f.id === CN.face) {
      const bay = fr.length / f.bays;
      const u0 = (f.bays - CN.endClearBays - CN.bays) * bay;
      const u1 = (f.bays - CN.endClearBays) * bay;
      const top = base + B.plinth + glazing - CN.dropBelowSoffit;
      const outer = top - CN.fall;
      const uc = (u0 + u1) / 2;
      const wide = u1 - u0;
      /* The fabric: one quad from the wall out to the free edge, tilted by the
         angle its own fall and projection make. Nothing here is a chosen slope. */
      const pitch = Math.atan2(CN.fall, CN.projection);
      const slope = Math.hypot(CN.fall, CN.projection);
      /* A PlaneGeometry stands VERTICAL in its own frame, so the tilt that lays
         it along the slope is the slope's COMPLEMENT: at `tilt` the panel's
         vertical extent is slope * cos(tilt) = the declared fall, and its
         horizontal extent is slope * sin(tilt) = the declared projection.
         Rotating by the pitch itself puts the fabric's top 0.53 m ABOVE the
         soffit it hangs from, which is where it first went. */
      const tilt = Math.PI / 2 - pitch;
      bins.canopyFabric.push({
        ...fr.at(uc, OFF + CN.projection / 2, (top + outer) / 2),
        rot: fr.rot, rotX: -tilt, scale: [wide, slope, 1],
      });
      /* The struts: splayed from the wall to the free edge, one per declared
         interval, each a thin box lying along the slope. */
      const n = Math.max(2, Math.round(wide / (CN.strutEveryBays * bay)) + 1);
      for (let i = 0; i < n; i++) {
        const u = u0 + ((u1 - u0) * i) / (n - 1);
        bins.canopyStruts.push({
          ...fr.at(u, OFF + CN.projection / 2, (top + outer) / 2),
          rot: fr.rot, rotX: -tilt,
          scale: [CN.strutWidth, slope, CN.strutWidth],
        });
      }
      /* The fascia sign: BLANK geometry at its measured bounding size, on the
         fascia band, centred over the canopy. No letterform is drawn. */
      const FS = SY.fasciaSign;
      /* Its TOP aligns with the fascia band's top, not its centre: the wordmark
         is 2.12 m against a 1.54 m band, so it must overhang, and frames 18 and
         33 both show it hanging DOWN over the soffit with its top just inside
         the roofline. Centring it would push it above the parapet and out of
         the block's own measured stack. */
      const fasciaTop = base + B.plinth + glazing + B.soffit + B.parapet - D.seatEmbed;
      bins.fasciaSigns.push({
        ...fr.at(uc, OFF + D.signProud, fasciaTop - FS.height / 2),
        rot: fr.rot, scale: [FS.width, FS.height, D.signDepth],
      });
    }

    /* The colonnade: stout round columns standing FREE at the roof edge,
       carrying the soffit. Their top is the soffit's underside, so they are not
       full height, and they stand on the block datum like everything else. */
    /* EVERY declared run for this face is built, not the first one found. A
       `find` here silently dropped any second run, which meant the shipped
       geometry could stop following the declared table without the counts
       moving — blake's "the bay count must follow the DECLARED per-face table,
       not a re-fit at the point of use", in a different costume. */
    for (const run of SY.columns.runs.filter((r) => r.face === f.id)) {
      for (let i = 0; i < run.count; i++) {
        const u = Math.min(i * run.spacing, fr.length);
        /* A hair of deterministic lean per column, from the section seed — the
           1966 precast is hand-set and a perfectly regular colonnade reads as
           extruded. It is bounded by the section's own declared jitter. */
        const j = (hash(section.seed, f.bays, i) - 0.5) * 2 * D.columnJitter;
        bins.columns.push({
          x: fr.at(u, D.columnProud + j, 0).x,
          y: base + run.height / 2 - D.seatEmbed,
          z: fr.at(u, D.columnProud + j, 0).z,
          rot: fr.rot, scale: [1, run.height + D.seatEmbed, 1],
        });
      }
    }
  }

  /* ---------------------------------------------------------- assembly */
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const plane = new THREE.PlaneGeometry(1, 1);
  const add = (parent, geo, mat, items, name) => {
    if (!items.length) return;
    const mesh = instanced(geo, mat, items);
    mesh.name = name;
    parent.add(mesh);
  };

  const facades = new THREE.Group();
  facades.name = "revellecommons-facades";
  /* Band runs are individual meshes so each carries the precast joint at true
     panel scale — the per-surface repeat lever. */
  for (const [binName, color, meshName] of [
    ["parapets", hue("parapetBand"), "revellecommons-parapet"],
    ["soffits", hue("soffit"), "revellecommons-soffit"],
    ["plinths", hue("plinth"), "revellecommons-plinth"],
    ["skirts", hue("plinth"), "revellecommons-skirt"],
    ["blankBands", hue("parapetBand"), "revellecommons-blank-band"],
  ]) {
    for (const b of bins[binName]) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.h),
        binName === "parapets" || binName === "blankBands"
          ? precast(color, b.w, b.h, TILE.precast)
          : smooth(color));
      mesh.position.set(b.x, b.y, b.z);
      mesh.rotation.y = b.rot;
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.name = meshName;
      facades.add(mesh);
    }
  }
  add(facades, plane, glassMat(hue("storefrontGlass")), bins.glazing, "revellecommons-glazing");
  add(facades, plane, flat(hue("graphicPanel")), bins.graphic, "revellecommons-graphic-panel");
  add(facades, plane, smooth(hue("signageWall")), bins.signageWall, "revellecommons-signage-wall");
  add(facades, plane, glassMat(hue("storefrontGlass")), bins.entryGlass, "revellecommons-entry-glass");
  add(facades, unit, metal(hue("mullion")), bins.mullions, "revellecommons-mullion");
  add(facades, unit, metal(hue("mullion")), bins.transoms, "revellecommons-transom");
  add(facades, unit, flat(hue("signYellow")), bins.signPlates, "revellecommons-sign");
  add(facades, unit, flat(hue("signYellow")), bins.fasciaSigns, "revellecommons-fascia-sign");
  /* TRANSLUCENT, and that is the point of the object. It is tensioned fabric
     over a radiating strut frame: opaque, it reads as a slab and the lattice
     behind it disappears, which is what the round-2 critic saw once the sail
     stopped being white. The opacity is a declared draw parameter, not a taste
     call, and DoubleSide is required because the terrace looks UP at it. */
  add(facades, plane, lib().get("metalPanel", {
    color: hue("canopyFabric"), metalness: 0.15, roughness: 0.85,
    transparent: true, opacity: D.canopyOpacity, side: THREE.DoubleSide,
  }), bins.canopyFabric, "revellecommons-canopy");
  add(facades, unit, metal(hue("mullion")), bins.canopyStruts, "revellecommons-canopy-strut");
  add(facades, new THREE.CylinderGeometry(
    SY.columns.diameter / 2, SY.columns.diameter / 2, 1, 12),
    precast(hue("column"), Math.PI * SY.columns.diameter,
      SY.columns.runs[0].height, TILE.precast),
    bins.columns, "revellecommons-column");
  group.add(facades);

  /* ------------------------------------------------------------ ground */
  const gr = new THREE.Group();
  gr.name = "revellecommons-ground";
  const lift = overlayLift(D.courtRung);
  const floorMat = applyOverlayDepth(
    lib().get("pavingConcreteUnit", {
      color: hue("courtPaving"),
      repeat: [(section.court.x1 - section.court.x0) / TILE.concrete,
        (section.court.z1 - section.court.z0) / TILE.concrete],
    }), D.courtRung);
  const floor = new THREE.Mesh(courtFloor(section, ground, lift, TILE.concrete), floorMat);
  floor.name = "revellecommons-court-floor";
  floor.receiveShadow = true;
  gr.add(floor);
  group.add(gr);

  scene?.add(group);
  return {
    group,
    counts: {
      facades: section.facades.length,
      parapetRuns: bins.parapets.length,
      soffitRuns: bins.soffits.length,
      plinthRuns: bins.plinths.length,
      skirts: bins.skirts.length,
      blankBands: bins.blankBands.length,
      glazingPanels: bins.glazing.length,
      graphicPanels: bins.graphic.length,
      signageWallBays: bins.signageWall.length,
      entryLeaves: bins.entryGlass.length,
      signPlates: bins.signPlates.length,
      fasciaSigns: bins.fasciaSigns.length,
      canopies: bins.canopyFabric.length,
      canopyStruts: bins.canopyStruts.length,
      transomRuns: bins.transoms.length,
      mullions: bins.mullions.length,
      columns: bins.columns.length,
      courtFloors: 1,
      /* Declared ZEROES, not omissions: the Keeling control returns negative on
         this cluster, and every roof object the ortho reads would stand
         1.4-6.3 m inside solid drawn mass. */
      pv: 0,
      roofObjects: 0,
    },
  };
}
