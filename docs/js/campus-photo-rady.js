// The Rady School of Management, from photographs — the photo-sourced
// INVENTED class, same terms as Eighth and Revelle.
//
// Everything here is modelled off dated photographs of Otterson Hall (2007-)
// and Wells Fargo Hall (2012-). Photos decide WHAT EXISTS and HOW IT LOOKS;
// the measured data keeps deciding WHERE and HOW BIG. Three consequences run
// through the whole file:
//
//   1. NOTHING IS FREEHAND IN PLAN. Every architectural system hangs off a
//      FACE — the chord between two vertices of the real Otterson or Wells
//      Fargo ring in campus-3d.json, with an outward normal taken against
//      that ring's own centroid and a standoff that clears its own bulge.
//      The section stores those faces; this file only reads them. So the
//      canted prow sits on the measured west wedge, the slat wall sits on
//      the measured courtyard wall, and the wing roof sits on the measured
//      ocean elevation — and the measured massing is never moved or
//      replaced, only dressed from just outside.
//   2. NOTHING OVERTOPS THE LIDAR. The photographs read five glazed storeys
//      at Wells Fargo; the 2014 survey puts its roof at 28.4 m and
//      Otterson's at 20.1 m, and LiDAR decides height, so the whole prow
//      composition tops out at 23.1 m and the wing roof at 18.3 m. The
//      section carries both ceilings and the test re-checks them.
//   3. `heightAt` is not the surface you can see. Everything PLACED sits on
//      `surfaceAt`, which is why the caller should hand one in; `heightAt`
//      is only the fallback so an older call site still works.
//
// UNDA (Ian Hamilton Finlay, 1987, Stuart Collection) is the one piece here
// with a rule of its own: the tops of its five stones are aligned to a
// single elevation because they stand in for the ocean horizon. That is the
// sourced fact, so it is the thing the renderer enforces — the stones are
// sampled against the real terrain and drawn from their own ground up to one
// shared top, which also means none of them can end up floating on the slope.
//
// Colours are DATA. Every hex comes from the `colors` block of the photo
// document's `rady` section. Repeats are InstancedMesh; the canted and
// tapering pieces (the prow, the brise-soleil spikes, the wing roof) are
// batched into single BufferGeometries rather than drawn one quad at a time.
//
// What is deliberately NOT here is in the section's `absent` array, and the
// biggest entry is all lettering: the two building signs and UNDA's carved
// letters are the subject of their own objects, and this renderer has no
// text mechanism, so the panels are blank and the stones are uncarved.
import * as THREE from "../vendor/three/three.module.min.js";
import { applyOverlayDepth, OVERLAY, overlayLift } from "./campus-overlay.js";

/* The courtyard paving rides two rungs so the band shows around the panel,
   the same way Revelle's plaza is built; everything solid stands on the
   upper one. */
const BASE_RUNG = "pad";
const PANEL_RUNG = "carpet";

const concrete = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0.0 });
const stone = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.0 });
const painted = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.35 });
const metal = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.7 });
const glass = (color) =>
  new THREE.MeshStandardMaterial({
    color,
    roughness: 0.14,
    metalness: 0.6,
    side: THREE.DoubleSide,
  });
const timber = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.0 });
const foliage = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 1.0, metalness: 0.0 });

/** Flat decal material on a given rung of the overlay ladder. */
function decal(color, rung) {
  return applyOverlayDepth(
    new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0.0 }),
    rung
  );
}

/**
 * One InstancedMesh from a list of placements. `place` returns
 * `{ x, y, z, rot?, rotX?, rotZ?, scale? }`; `rot` is about Y.
 */
function instanced(geo, mat, items, place) {
  const mesh = new THREE.InstancedMesh(geo, mat, items.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const pos = new THREE.Vector3();
  items.forEach((it, i) => {
    const p = place(it, i);
    e.set(p.rotX || 0, p.rot || 0, p.rotZ || 0);
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

/** A flat XZ decal quad, lying in the ground plane. */
function quad(w, d) {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  return g;
}

/**
 * Accumulates arbitrary quads and plan polygons into ONE BufferGeometry.
 * The prow leans, the brise-soleil spikes taper in plan and the wing roof
 * comes to a point — none of them is a box, and drawing each as its own mesh
 * would cost a draw call per panel. `add` takes four world corners in order;
 * `slab` extrudes a plan polygon between two elevations.
 */
class Batch {
  constructor() {
    this.pos = [];
  }
  add(p0, p1, p2, p3) {
    this.pos.push(...p0, ...p1, ...p2, ...p0, ...p2, ...p3);
    return this;
  }
  /** Triangle fan over a plan polygon `[[x, z], ...]` at elevation y. */
  fan(poly, y, flip) {
    for (let i = 1; i < poly.length - 1; i++) {
      const a = [poly[0][0], y, poly[0][1]];
      const b = [poly[i][0], y, poly[i][1]];
      const c = [poly[i + 1][0], y, poly[i + 1][1]];
      if (flip) this.pos.push(...a, ...c, ...b);
      else this.pos.push(...a, ...b, ...c);
    }
    return this;
  }
  /** A closed slab: the plan polygon as a top face, a bottom face and sides. */
  slab(poly, y0, y1) {
    this.fan(poly, y1, false);
    this.fan(poly, y0, true);
    for (let i = 0; i < poly.length; i++) {
      const [ax, az] = poly[i];
      const [bx, bz] = poly[(i + 1) % poly.length];
      this.add([ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az]);
    }
    return this;
  }
  mesh(material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, material);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }
  get empty() {
    return this.pos.length === 0;
  }
}

/* ------------------------------------------------------------ face basis */

/**
 * Turn a stored face — `{ a, b, n, length, standoff }`, all of it derived
 * from a measured ring — into the two helpers everything else uses:
 * `at(t, out)` for a plan point and `pt(t, out, y)` for a world corner.
 * `out` is measured from the WALL, and the face's own standoff is added, so
 * no call site can accidentally put geometry inside the mass.
 */
function basis(f) {
  const [ax, az] = f.a;
  const ux = (f.b[0] - f.a[0]) / f.length;
  const uz = (f.b[1] - f.a[1]) / f.length;
  const [nx, nz] = f.n;
  const at = (t, out = 0) => {
    const d = f.standoff + out;
    return [ax + ux * f.length * t + nx * d, az + uz * f.length * t + nz * d];
  };
  return {
    length: f.length,
    ux,
    uz,
    nx,
    nz,
    /** Yaw that maps an object's local +X onto the face direction. */
    yaw: Math.atan2(-uz, ux),
    at,
    pt: (t, out, y) => {
      const [x, z] = at(t, out);
      return [x, y, z];
    },
  };
}

/* --------------------------------------------- Wells Fargo, the west prow */

function buildProw(section, group, ground) {
  const { colors } = section;
  const p = section.systems.prow;
  const bl = section.systems.blades;
  const vision = new Batch();
  const visionTop = new Batch();
  const spandrel = new Batch();
  const mull = new Batch();
  const bladeTop = new Batch();
  const bladeUnder = new Batch();
  const soffit = new Batch();

  for (const facet of p.facets) {
    const b = basis(facet);
    const base = ground(...b.at(0.5, 0));
    /* The wall leans outward with height, so the offset is a function of y,
       not a constant. The columns below stand at the wall line and the glass
       overhangs them — which is the read the north elevation gives. */
    const off = (y) => p.glassInset + p.cant * (y - p.undercroft);
    const corner = (t, y) => b.pt(t, off(y), base + y);

    for (let s = 0; s < p.storeys; s++) {
      const y0 = p.undercroft + s * p.storeyHeight;
      const y1 = y0 + p.storeyHeight;
      const yg = y0 + p.spandrel;
      spandrel.add(corner(0, y0), corner(1, y0), corner(1, yg), corner(0, yg));
      /* The vision glass reads bluer and lighter toward the top of the prow,
         which is two materials, not a gradient this renderer can draw. */
      (s >= p.storeys - 2 ? visionTop : vision)
        .add(corner(0, yg), corner(1, yg), corner(1, y1), corner(0, y1));
    }
    const top = p.undercroft + p.storeys * p.storeyHeight;
    spandrel.add(corner(0, top), corner(1, top), corner(1, top + p.parapet), corner(0, top + p.parapet));

    /* Mullion grid: one vertical blade per bay line, plus the horizontals at
       each floor. Thin quads standing just proud of the glass. */
    const bayT = 1 / facet.bays;
    for (let i = 0; i <= facet.bays; i++) {
      const t0 = Math.max(0, i * bayT - p.mullion / 2 / facet.length);
      const t1 = Math.min(1, i * bayT + p.mullion / 2 / facet.length);
      const yA = p.undercroft;
      const yB = top + p.parapet;
      const c = (t, y) => b.pt(t, off(y) + 0.03, base + y);
      mull.add(c(t0, yA), c(t1, yA), c(t1, yB), c(t0, yB));
    }

    /* The undercroft: a dark recessed ceiling under the lifted prow. */
    soffit.fan(
      [b.at(0, 0), b.at(1, 0), b.at(1, 2.2), b.at(0, 2.2)],
      base + p.undercroft - 0.05,
      true
    );

    /* The brise-soleil. One blade per upper floor, running the whole facet at
       full projection and then carrying on past the end of the building as a
       spike that tapers to a point — the single most recognisable thing on
       this elevation. */
    if (!facet.blades) continue;
    const over = facet.bladeOvershoot ? bl.overshoot / facet.length : 0;
    for (let i = 0; i < bl.count; i++) {
      const y = p.undercroft + (i + 1) * p.storeyHeight;
      const o = off(y);
      const plan = [
        b.at(0, o),
        b.at(0, o + bl.projection),
        b.at(1, o + bl.projection),
        b.at(1 + over, o + bl.tipWidth),
        b.at(1, o),
      ];
      bladeTop.fan(plan, base + y + bl.thickness, false);
      bladeUnder.fan(plan, base + y, true);
      for (let k = 0; k < plan.length; k++) {
        const [x0, z0] = plan[k];
        const [x1, z1] = plan[(k + 1) % plan.length];
        bladeUnder.add(
          [x0, base + y, z0],
          [x1, base + y, z1],
          [x1, base + y + bl.thickness, z1],
          [x0, base + y + bl.thickness, z0]
        );
      }
    }
  }

  group.add(vision.mesh(glass(colors.prowGlass)));
  group.add(visionTop.mesh(glass(colors.prowGlassTop)));
  group.add(spandrel.mesh(painted(colors.prowSpandrel)));
  group.add(mull.mesh(metal(colors.mullion)));
  group.add(bladeTop.mesh(painted(colors.bladeTop)));
  group.add(bladeUnder.mesh(painted(colors.bladeUnder)));
  group.add(soffit.mesh(concrete(colors.undercroftSoffit)));

  /* The four round columns the prow stands on. */
  const pil = section.systems.pilotis;
  group.add(instanced(
    new THREE.CylinderGeometry(pil.radius, pil.radius * 1.06, p.undercroft, 12),
    concrete(colors.piloti), pil.items,
    (it) => ({ x: it.x, y: ground(it.x, it.z) + p.undercroft / 2, z: it.z })
  ));
}

/* ------------------------------- Wells Fargo, Scholars Drive North side */

function buildNorthFace(section, group, ground) {
  const { colors } = section;
  const r = section.systems.rainscreen;
  const b = basis(r.face);
  const base = ground(...b.at(0.5, 0));

  /* A4. Horizontal panel courses over the brown volume. Two tones, alternate
     courses, so the wall reads as banded rather than flat. */
  /* The brown volume starts clear of the prow's own tip and runs east until
     the limestone takes over. */
  const brownLen = r.face.length * (r.limestoneFrom - r.from);
  const rows = [];
  for (let y = r.base; y + r.courseHeight <= r.top; y += r.courseHeight) rows.push(y);
  const mid = b.at((r.from + r.limestoneFrom) / 2, r.thickness / 2);
  [[0, colors.rainscreenDark], [1, colors.rainscreenLight]].forEach(([parity, color]) => {
    const set = rows.filter((_, i) => i % 2 === parity);
    group.add(instanced(
      new THREE.BoxGeometry(brownLen, r.courseHeight - 0.03, r.thickness),
      painted(color), set,
      (y) => ({ x: mid[0], y: base + y + r.courseHeight / 2, z: mid[1], rot: b.yaw })
    ));
  });

  /* Punched teal ribbon windows, one band per floor. */
  const p = section.systems.prow;
  const bands = [];
  for (let s = 0; s < p.storeys; s++) bands.push(r.base + s * p.storeyHeight + 1.4);
  const winMid = b.at((r.from + r.limestoneFrom) / 2, r.thickness + 0.04);
  group.add(instanced(
    new THREE.BoxGeometry(brownLen - 2 * r.window.margin, r.window.height, 0.1),
    glass(colors.ribbonGlass), bands,
    (y) => ({ x: winMid[0], y: base + y, z: winMid[1], rot: b.yaw })
  ));

  /* A5. The pale limestone panel field beside it: 1.2 x 0.9 m ashlar, three
     tones distributed off the panel index so a reload rebuilds the same wall. */
  buildAshlar(section, group, r.face, base, r.base, r.top, r.limestoneFrom, 1, r.thickness);

  /* A7. The banded stone base under the whole thing. */
  const pod = section.systems.podium;
  const pb = basis(pod.face);
  const podMid = pb.at(0.5, pod.thickness / 2);
  const courses = [];
  for (let i = 0; i < pod.courses; i++) courses.push(i);
  group.add(instanced(
    new THREE.BoxGeometry(pod.face.length, pod.height / pod.courses - 0.02, pod.thickness),
    stone(colors.podium), courses,
    (i) => ({
      x: podMid[0],
      y: base + (i + 0.5) * (pod.height / pod.courses),
      z: podMid[1],
      rot: pb.yaw,
    })
  ));

  buildStair(section, group, ground);
}

/** A field of ashlar panels on a face, three tones, deterministically mixed. */
function buildAshlar(section, group, face, base, y0, y1, t0, t1, thickness) {
  const { colors } = section;
  const b = basis(face);
  const PW = 1.2;
  const PH = 0.9;
  const span = face.length * (t1 - t0);
  const cols = Math.max(1, Math.round(span / PW));
  const rowsN = Math.max(1, Math.round((y1 - y0) / PH));
  const panels = [];
  for (let c = 0; c < cols; c++) {
    for (let rI = 0; rI < rowsN; rI++) panels.push({ c, rI, k: (c * 7 + rI * 3) % 5 });
  }
  const tones = [colors.limestone, colors.limestoneLight, colors.limestoneDark];
  tones.forEach((color, ti) => {
    const set = panels.filter((p) => p.k % 3 === ti);
    if (!set.length) return;
    group.add(instanced(
      new THREE.BoxGeometry(span / cols - 0.03, (y1 - y0) / rowsN - 0.03, thickness),
      stone(color), set,
      (p) => {
        const t = t0 + ((p.c + 0.5) / cols) * (t1 - t0);
        const [x, z] = b.at(t, thickness / 2);
        return { x, y: base + y0 + ((p.rI + 0.5) * (y1 - y0)) / rowsN, z, rot: b.yaw };
      }
    ));
  });
}

/** A6. The open-air switchback stair zigzagging up the panel wall. */
function buildStair(section, group, ground) {
  const { colors } = section;
  const s = section.systems.stair;
  const b = basis(s.face);
  const base = ground(...b.at(s.t, s.run));
  const along = s.width / s.face.length;

  /* A scissor stair: two parallel runs at different depths off the wall,
     climbing in opposite directions, with a landing where they meet. Flight
     f runs along the face for `run` metres in lane f % 2. */
  const lane = (f) => 0.6 + (f % 2) * s.width;
  const dirOf = (f) => (f % 2 === 0 ? 1 : -1);
  const tAt = (f, u) => s.t + along * (dirOf(f) > 0 ? u - 0.5 : 0.5 - u);
  const tilt = Math.atan2(s.flightRise, s.run);

  const treadsPer = 11;
  const treads = [];
  const landings = [];
  const posts = [];
  for (let f = 0; f < s.flights; f++) {
    const y0 = s.base + f * s.flightRise;
    for (let i = 0; i < treadsPer; i++) {
      const u = (i + 0.5) / treadsPer;
      treads.push({ t: tAt(f, u), out: lane(f), y: y0 + u * s.flightRise });
    }
    landings.push({ t: tAt(f, 1), out: lane(f) + (dirOf(f) > 0 ? s.width / 2 : -s.width / 2), y: y0 + s.flightRise });
    for (let i = 0; i <= treadsPer; i += 2) {
      const u = i / treadsPer;
      posts.push({ t: tAt(f, u), out: lane(f) + s.width / 2, y: y0 + u * s.flightRise });
    }
  }
  const place = (it, extra = 0) => {
    const [x, z] = b.at(it.t, it.out);
    return { x, y: base + it.y + extra, z, rot: b.yaw };
  };
  group.add(instanced(
    new THREE.BoxGeometry((s.run / treadsPer) * 1.35, 0.09, s.width),
    concrete(colors.stairTread), treads, (it) => place(it)
  ));
  group.add(instanced(
    new THREE.BoxGeometry(1.6, 0.22, s.width * 1.6),
    concrete(colors.stairTread), landings, (it) => place(it, -0.11)
  ));
  group.add(instanced(
    new THREE.BoxGeometry(0.05, s.railHeight, 0.05),
    metal(colors.rail), posts, (it) => place(it, s.railHeight / 2)
  ));
  /* The raked rods that make the zigzag read at a distance: one sloped run
     per flight, per rod, tilted in the plane of its own flight. */
  const rods = [];
  for (let f = 0; f < s.flights; f++) {
    for (let k = 1; k <= s.rods; k++) rods.push({ f, k });
  }
  group.add(instanced(
    new THREE.BoxGeometry(Math.hypot(s.run, s.flightRise), 0.03, 0.03),
    metal(colors.rail), rods,
    ({ f, k }) => {
      const [x, z] = b.at(tAt(f, 0.5), lane(f) + s.width / 2);
      return {
        x,
        y: base + s.base + f * s.flightRise + s.flightRise / 2 + (k / s.rods) * s.railHeight,
        z,
        rot: b.yaw,
        rotZ: dirOf(f) * tilt,
      };
    }
  ));
}

/* ------------------------------ Wells Fargo, the courtyard entrance */

function buildEntrance(section, group, ground) {
  const { colors } = section;
  const e = section.systems.entrance;
  const b = basis(e.face);
  const base = ground(...b.at(0.5, 0));

  buildAshlar(section, group, e.face, base, 0, e.baseHeight, 0, 1, 0.2);

  /* B5. The deep red-brown horizontal slat rainscreen — the strongest colour
     accent on this campus, and the reason the courtyard reads as an entrance
     rather than a gap between two grey buildings. */
  const w = e.wood;
  const len = e.face.length * (w.t1 - w.t0);
  const mid = b.at((w.t0 + w.t1) / 2, 0.2 + w.thickness / 2);
  const boards = [];
  for (let i = 0; i < w.boards; i++) boards.push(i);
  [[0, colors.woodSlatDark], [1, colors.woodSlatLight]].forEach(([parity, color]) => {
    const set = boards.filter((i) => i % 2 === parity);
    group.add(instanced(
      new THREE.BoxGeometry(len, w.board - 0.02, w.thickness),
      timber(color), set,
      (i) => ({ x: mid[0], y: base + 0.15 + (i + 0.5) * w.board, z: mid[1], rot: b.yaw })
    ));
  });

  const cl = e.clerestory;
  const clMid = b.at((w.t0 + w.t1) / 2, 0.26);
  const pane = new THREE.Mesh(
    new THREE.PlaneGeometry(len, cl.height), glass(colors.ribbonGlass)
  );
  pane.position.set(clMid[0], base + w.height + cl.above + cl.height / 2, clMid[1]);
  pane.rotation.y = b.yaw;
  group.add(pane);

  /* Blank sign panels. The pin-mounted lettering they carry is deliberately
     not built — see the section's `absent`. */
  for (const s of e.signPanels) {
    const [x, z] = b.at(s.t, 0.24);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(s.w, s.h, 0.05), painted(colors.signPanel));
    panel.position.set(x, base + s.y, z);
    panel.rotation.y = b.yaw;
    panel.castShadow = true;
    group.add(panel);
  }
  const [px, pz] = b.at(e.plaque.t, 0.24);
  const plaque = new THREE.Mesh(
    new THREE.CylinderGeometry(e.plaque.r, e.plaque.r, 0.04, 16), painted(colors.leedPlaque)
  );
  plaque.position.set(px, base + e.plaque.y, pz);
  plaque.rotation.set(Math.PI / 2, 0, 0);
  plaque.rotateY(-b.yaw);
  group.add(plaque);

  /* B6. The vertically striated freestanding wall, projecting out of the
     face past the end of the slat wall. */
  const py = section.systems.pylon;
  const pb = basis(py.face);
  const [ox, oz] = pb.at(py.t, py.width / 2);
  const pbase = ground(ox, oz);
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(py.thickness, py.height, py.width), stone(colors.pylon)
  );
  body.position.set(ox, pbase + py.height / 2, oz);
  body.rotation.y = pb.yaw;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  const fins = [];
  for (let i = 0; i < py.striations; i++) fins.push(i);
  /* The striations are vertical fins on both broad faces. The wall's broad
     faces look along the face direction, so the offset between them is
     `u`, not the face normal. */
  for (const side of [-1, 1]) {
    group.add(instanced(
      new THREE.BoxGeometry(0.05, py.height - 0.2, py.width / py.striations - 0.06),
      stone(colors.limestoneDark), fins,
      (i) => {
        const [x, z] = pb.at(py.t, ((i + 0.5) / py.striations) * py.width);
        const off = side * (py.thickness / 2 + 0.02);
        return {
          x: x + pb.ux * off,
          y: pbase + py.height / 2,
          z: z + pb.uz * off,
          rot: pb.yaw,
        };
      }
    ));
  }
}

/* --------------------------------------- Otterson Hall, ocean elevation */

function buildOtterson(section, group, ground) {
  const { colors } = section;
  const r = section.systems.ottersonRoof;
  const b = basis(r.face);
  const base = ground(...b.at(0.5, 0));

  /* C1. The wing: a flat slab oversailing the elevation and running out to a
     point past the courtyard corner. The point is the identifying silhouette
     of this building in every photograph of it since 2007. */
  const spike = r.point / r.face.length;
  const plan = [
    b.at(0, 0),
    b.at(1, 0),
    b.at(1, r.overhang),
    b.at(0, r.overhang),
    b.at(-spike, r.overhang * 0.12),
  ];
  group.add(new Batch().slab(plan, base + r.height, base + r.height + r.thickness)
    .mesh(concrete(colors.roofPlane)));

  /* C2. Three open terraces: a slab band per level, round steel columns, and
     a stainless cable rail that is mostly air. */
  const t = section.systems.terraces;
  const levels = [];
  for (let i = 0; i < t.levels; i++) levels.push(t.base + i * t.levelHeight);
  const bandMid = b.at(0.5, t.projection / 2);
  group.add(instanced(
    new THREE.BoxGeometry(t.face.length, t.band, t.projection),
    concrete(colors.terraceBand), levels,
    (y) => ({ x: bandMid[0], y: base + y, z: bandMid[1], rot: b.yaw })
  ));
  const cols = [];
  for (let i = 0; i < t.columns; i++) cols.push(i / (t.columns - 1));
  const colH = t.base + (t.levels - 1) * t.levelHeight + t.levelHeight;
  group.add(instanced(
    new THREE.CylinderGeometry(t.columnRadius, t.columnRadius, colH, 10),
    concrete(colors.terraceColumn), cols,
    (u) => {
      const [x, z] = b.at(u, t.projection - 0.3);
      return { x, y: base + colH / 2, z };
    }
  ));
  const posts = [];
  const n = Math.floor(t.face.length / t.postSpacing);
  for (const y of levels) {
    for (let i = 0; i <= n; i++) posts.push({ u: i / n, y });
  }
  group.add(instanced(
    new THREE.BoxGeometry(0.03, t.railHeight, 0.03), metal(colors.rail), posts,
    ({ u, y }) => {
      const [x, z] = b.at(u, t.projection - 0.1);
      return { x, y: base + y + t.band / 2 + t.railHeight / 2, z };
    }
  ));
  const cables = [];
  for (const y of levels) {
    for (let k = 1; k <= t.cables; k++) cables.push({ y, k });
  }
  const cableMid = b.at(0.5, t.projection - 0.1);
  group.add(instanced(
    new THREE.BoxGeometry(t.face.length, 0.016, 0.016), metal(colors.rail), cables,
    ({ y, k }) => ({
      x: cableMid[0],
      y: base + y + t.band / 2 + (k / t.cables) * t.railHeight,
      z: cableMid[1],
      rot: b.yaw,
    })
  ));

  /* C3. The cladding read behind the terraces: brown panel, a silver-grey
     band under it, and a teal ribbon between them. A thin layer off the
     measured wall — the massing itself is untouched. */
  const c = section.systems.cladding;
  const cb = basis(c.face);
  const clad = [];
  for (let i = 0; i < c.levels; i++) clad.push(c.base + i * c.levelHeight);
  const cMid = cb.at(0.5, c.thickness / 2);
  const layer = (h, dy, color, mat) => {
    group.add(instanced(
      new THREE.BoxGeometry(c.face.length, h, c.thickness), mat(color), clad,
      (y) => ({ x: cMid[0], y: base + y + dy, z: cMid[1], rot: cb.yaw })
    ));
  };
  layer(c.bandHeight, 0.1, colors.ottersonBand, painted);
  layer(c.glassHeight, 0.1 + c.bandHeight / 2 + c.glassHeight / 2, colors.ottersonGlass, glass);
  layer(
    c.levelHeight - c.bandHeight - c.glassHeight - 0.3,
    0.1 + c.bandHeight / 2 + c.glassHeight + (c.levelHeight - c.bandHeight - c.glassHeight - 0.3) / 2,
    colors.ottersonPanel, painted
  );

  /* B8. The loggia under Otterson's courtyard end. */
  const a = section.systems.arcade;
  const ab = basis(a.face);
  const acols = [];
  for (let i = 0; i < a.columns; i++) acols.push((i + 0.5) / a.columns);
  group.add(instanced(
    new THREE.CylinderGeometry(a.radius, a.radius, a.height, 10),
    concrete(colors.arcadeColumn), acols,
    (u) => {
      const [x, z] = ab.at(u, a.standoffExtra);
      return { x, y: ground(x, z) + a.height / 2, z };
    }
  ));
  /* The beam they carry. Without it the columns read as a row of posts in
     the middle of the courtyard rather than as the edge of a loggia. */
  const [lx, lz] = ab.at(0.5, a.standoffExtra / 2);
  const lintel = new THREE.Mesh(
    new THREE.BoxGeometry(a.face.length, 0.55, a.standoffExtra + 2 * a.radius),
    concrete(colors.terraceBand)
  );
  lintel.position.set(lx, ground(lx, lz) + a.height + 0.27, lz);
  lintel.rotation.y = ab.yaw;
  lintel.castShadow = true;
  lintel.receiveShadow = true;
  group.add(lintel);
}

/* --------------------------------------------------- the palm courtyard */

function buildCourtyard(section, group, ground) {
  const { colors } = section;
  const pv = section.paving;
  const lift = overlayLift(PANEL_RUNG);
  const on = (x, z) => ground(x, z) + lift;

  /* B3. The paver field, clipped at build time to the two MEASURED plaza
     polygons between the halls. Band first, inset panel on top, so what
     shows between panels IS the joint. */
  group.add(instanced(
    quad(pv.pitch, pv.pitch), decal(colors.paverBand, BASE_RUNG), pv.cells,
    ([x, z]) => ({ x, y: ground(x, z) + overlayLift(BASE_RUNG), z })
  ));
  group.children.at(-1).renderOrder = OVERLAY[BASE_RUNG].renderOrder;
  group.add(instanced(
    quad(pv.pitch - pv.band, pv.pitch - pv.band), decal(colors.paver, PANEL_RUNG), pv.cells,
    ([x, z]) => ({ x, y: on(x, z), z })
  ));
  group.children.at(-1).renderOrder = OVERLAY[PANEL_RUNG].renderOrder;

  /* B2. Circular brick medallions. The first one is the SURVEYED planting
     bed in campus-3d.json; the rest are the wells the 2024 photographs put
     under the other palms. */
  const wells = section.treeWells.items;
  const disc = new THREE.CircleGeometry(1, 24);
  disc.rotateX(-Math.PI / 2);
  group.add(instanced(disc, decal(colors.wellBrick, "paint"), wells,
    (w) => ({ x: w.x, y: ground(w.x, w.z) + overlayLift("paint"), z: w.z, scale: [w.r, 1, w.r] })));
  group.children.at(-1).renderOrder = OVERLAY.paint.renderOrder;

  /* B1. Palms: a ringed trunk that narrows with height, and an open arching
     crown. The fronds are one instanced blade drooping off a shared hub. */
  const pl = section.palms;
  group.add(instanced(
    new THREE.CylinderGeometry(pl.trunkRadius * 0.8, pl.trunkRadius * 1.25, 1, 9),
    concrete(colors.palmTrunk), pl.items,
    (p) => ({ x: p.x, y: on(p.x, p.z) + p.clear / 2, z: p.z, scale: [1, p.clear, 1] })
  ));
  const fronds = [];
  for (const p of pl.items) {
    for (let i = 0; i < pl.fronds; i++) fronds.push({ p, i });
  }
  const frond = new THREE.BoxGeometry(1, 0.03, 0.62);
  frond.translate(0.5, 0, 0);
  group.add(instanced(frond, foliage(colors.palmFrond), fronds,
    ({ p, i }) => {
      const a = (i / pl.fronds) * Math.PI * 2 + (i % 2) * 0.24;
      const droop = 0.42 + (i % 4) * 0.26;
      return {
        x: p.x,
        y: on(p.x, p.z) + p.clear + (p.total - p.clear) * 0.35,
        z: p.z,
        rot: a,
        rotZ: -droop,
        scale: [(p.spread / 2) * (0.8 + (i % 3) * 0.14), 1, 1],
      };
    }
  ));

  /* B4. Broad shallow flights and the short isolated pipe rails beside them. */
  const st = section.steps;
  const risers = [];
  for (const it of st.items) {
    for (let i = 0; i < it.risers; i++) risers.push({ it, i });
  }
  group.add(instanced(
    new THREE.BoxGeometry(1, st.riser, st.tread), concrete(colors.paver), risers,
    ({ it, i }) => {
      const back = (i - (it.risers - 1) / 2) * st.tread;
      return {
        x: it.x + Math.sin(it.rot) * back,
        y: on(it.x, it.z) + (i + 0.5) * st.riser,
        z: it.z + Math.cos(it.rot) * back,
        rot: it.rot,
        scale: [it.width, 1, 1],
      };
    }
  ));
  const hr = section.handrails;
  group.add(instanced(
    new THREE.BoxGeometry(0.04, hr.height, 0.04), metal(colors.rail),
    hr.items.flatMap((it) => [-1, 1].map((s) => ({ it, s }))),
    ({ it, s }) => ({
      x: it.x + Math.cos(it.rot) * ((it.length / 2) * s),
      y: on(it.x, it.z) + hr.height / 2,
      z: it.z - Math.sin(it.rot) * ((it.length / 2) * s),
    })
  ));
  group.add(instanced(
    new THREE.BoxGeometry(1, 0.04, 0.04), metal(colors.rail), hr.items,
    (it) => ({ x: it.x, y: on(it.x, it.z) + hr.height, z: it.z, rot: it.rot, scale: [it.length, 1, 1] })
  ));

  /* B7. Sling loungers and one café table. */
  const lg = section.loungers;
  group.add(instanced(
    new THREE.BoxGeometry(lg.length, 0.07, lg.width), painted(colors.lounger), lg.items,
    (it) => ({ x: it.x, y: on(it.x, it.z) + lg.seatHeight, z: it.z, rot: it.rot })
  ));
  group.add(instanced(
    new THREE.BoxGeometry(0.07, lg.backHeight, lg.width), painted(colors.lounger), lg.items,
    (it) => ({
      x: it.x + Math.cos(it.rot) * (lg.length / 2),
      y: on(it.x, it.z) + lg.seatHeight + lg.backHeight / 2,
      z: it.z - Math.sin(it.rot) * (lg.length / 2),
      rot: it.rot,
      rotZ: 0.35,
    })
  ));
  group.add(instanced(
    new THREE.BoxGeometry(0.05, lg.seatHeight, lg.width * 0.9), metal(colors.rail),
    lg.items.flatMap((it) => [-0.35, 0.35].map((s) => ({ it, s }))),
    ({ it, s }) => ({
      x: it.x + Math.cos(it.rot) * lg.length * s,
      y: on(it.x, it.z) + lg.seatHeight / 2,
      z: it.z - Math.sin(it.rot) * lg.length * s,
      rot: it.rot,
    })
  ));
  const ct = section.cafeTables;
  group.add(instanced(
    new THREE.CylinderGeometry(ct.radius, ct.radius, 0.05, 14), painted(colors.cafeTable), ct.items,
    (it) => ({ x: it.x, y: on(it.x, it.z) + ct.height, z: it.z })
  ));
  group.add(instanced(
    new THREE.CylinderGeometry(0.05, 0.14, ct.height, 10), painted(colors.cafeTable), ct.items,
    (it) => ({ x: it.x, y: on(it.x, it.z) + ct.height / 2, z: it.z })
  ));
}

/* ---------------------------------------------------- site furniture */

function buildSite(section, group, ground) {
  const { colors } = section;
  const l = section.lamps;
  group.add(instanced(
    new THREE.BoxGeometry(l.pole, l.height, l.pole), painted(colors.lampPole), l.items,
    (it) => ({ x: it.x, y: ground(it.x, it.z) + l.height / 2, z: it.z, rot: it.rot })
  ));
  group.add(instanced(
    new THREE.BoxGeometry(l.head[0], l.head[1], l.head[2]), painted(colors.luminaire), l.items,
    (it) => ({
      x: it.x + Math.cos(it.rot) * 0.3,
      y: ground(it.x, it.z) + l.height - 0.12,
      z: it.z - Math.sin(it.rot) * 0.3,
      rot: it.rot,
    })
  ));
  /* D2. Pole banners as colour blocks: navy over a lighter blue footer. The
     photograph and text on them rotate every year, so neither is claimed. */
  const bannered = l.items.filter((it) => it.banner);
  [[colors.bannerNavy, 0.68, 0], [colors.bannerBlue, 0.32, -0.5]].forEach(([color, frac, shift]) => {
    group.add(instanced(
      new THREE.BoxGeometry(l.bannerSize[0], l.bannerSize[1] * frac, 0.03),
      painted(color), bannered,
      (it) => {
        const off = l.pole / 2 + l.bannerSize[0] / 2 + 0.05;
        return {
          x: it.x + Math.cos(it.rot) * off,
          y: ground(it.x, it.z) + l.bannerY + l.bannerSize[1] * (shift ? 0.16 : 0.66),
          z: it.z - Math.sin(it.rot) * off,
          rot: it.rot,
        };
      }
    ));
  });

  const bo = section.bollards;
  group.add(instanced(
    new THREE.CylinderGeometry(bo.radius, bo.radius, bo.height, 8), painted(colors.bollard), bo.items,
    (it) => ({ x: it.x, y: ground(it.x, it.z) + bo.height / 2, z: it.z })
  ));

  /* C4. The red-flowering shrub masses. Foliage first, then a looser flower
     shell over it — the flowers are what actually reads from the walk. */
  const sh = section.shrubs;
  const blob = new THREE.IcosahedronGeometry(1, 1);
  group.add(instanced(blob, foliage(colors.shrubFoliage), sh.items,
    (it) => ({ x: it.x, y: ground(it.x, it.z) + it.r * 0.7, z: it.z, scale: [it.r, it.r * 0.8, it.r] })));
  const flowering = sh.items.filter((it) => it.flower);
  group.add(instanced(blob, foliage(colors.shrubFlower), flowering,
    (it) => ({
      x: it.x,
      y: ground(it.x, it.z) + it.r * 0.95,
      z: it.z,
      scale: [it.r * 0.82, it.r * 0.6, it.r * 0.82],
    })));
  group.add(instanced(quad(1, 1), decal(colors.mulch, BASE_RUNG), sh.items,
    (it) => ({
      x: it.x,
      y: ground(it.x, it.z) + overlayLift(BASE_RUNG),
      z: it.z,
      scale: [it.r * 2.6, 1, it.r * 2.6],
    })));
  group.children.at(-1).renderOrder = OVERLAY[BASE_RUNG].renderOrder;
}

/* ------------------------------------------------------------------ UNDA */

/**
 * UNDA, Ian Hamilton Finlay, 1987. Five stones whose TOPS ARE ONE ELEVATION,
 * standing in for the ocean horizon — that alignment is the sourced fact, so
 * the renderer derives it rather than trusting five typed-in Y values: the
 * terrain is sampled under every stone, the common top is the highest of
 * them plus one block height, and each stone is drawn from its own ground up
 * to that top. Nothing floats and nothing is buried.
 *
 * The real stones are equal blocks set to different depths; drawing the
 * difference as extra height is the compromise this renderer makes, and the
 * section says so. No letters are carved — see `absent`.
 */
function buildUnda(section, group, ground) {
  const u = section.unda;
  const grounds = u.items.map((it) => ground(it.x, it.z));
  const top = Math.max(...grounds) + u.block.h;
  const mat = stone(section.colors.undaStone);
  const box = new THREE.BoxGeometry(1, 1, 1);
  group.add(instanced(box, mat, u.items, (it, i) => {
    const h = top - grounds[i];
    return {
      x: it.x,
      y: grounds[i] + h / 2,
      z: it.z,
      rot: it.rot,
      scale: [u.block.w, h, u.block.d],
    };
  }));
  return { top, fall: Math.max(...grounds) - Math.min(...grounds) };
}

/* ------------------------------------------------------------------- api */

/**
 * Build the Rady School's photo-sourced detail.
 *
 * `photo` is the loaded photo-detail document; this reads only its `rady`
 * section and returns `{ group, counts }` (empty and harmless if the section
 * is missing, so a half-wired boot still runs). Pass `surfaceAt` — the height
 * of the DRAWN terrain triangle — for everything placed on the ground;
 * `heightAt` is only the fallback.
 */
export function createPhotoRady(scene, { photo, heightAt, surfaceAt } = {}) {
  const group = new THREE.Group();
  group.name = "photo-rady";
  const section = photo?.rady;
  if (!section) {
    scene?.add(group);
    return { group, counts: {} };
  }
  const ground = surfaceAt || heightAt;
  if (typeof ground !== "function") {
    throw new Error("campus-photo-rady: needs surfaceAt (or heightAt) to place on the ground");
  }

  buildProw(section, group, ground);
  buildNorthFace(section, group, ground);
  buildEntrance(section, group, ground);
  buildOtterson(section, group, ground);
  buildCourtyard(section, group, ground);
  buildSite(section, group, ground);
  const unda = buildUnda(section, group, ground);

  scene?.add(group);
  return {
    group,
    counts: {
      pavingCells: section.paving.cells.length,
      palms: section.palms.items.length,
      treeWells: section.treeWells.items.length,
      blades: section.systems.blades.count * section.systems.prow.facets.filter((f) => f.blades).length,
      pilotis: section.systems.pilotis.items.length,
      terraceLevels: section.systems.terraces.levels,
      arcadeColumns: section.systems.arcade.columns,
      loungers: section.loungers.items.length,
      lamps: section.lamps.items.length,
      shrubs: section.shrubs.items.length,
      undaStones: section.unda.items.length,
      undaTop: Math.round(unda.top * 100) / 100,
      undaGroundFall: Math.round(unda.fall * 100) / 100,
      draws: group.children.length,
    },
  };
}
