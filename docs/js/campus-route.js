// Routing over the real UC San Diego footpath network.
//
// Campus Rush promises that the ride from your dorm to your lecture is the ride
// you actually take. That promise lives here: given two building names, this
// walks the OpenStreetMap pedestrian graph shipped in app/data/campus-3d.json
// and returns the genuine walking route between them, with its genuine length.
//
// Deliberately free of any DOM or Three.js reference, so the same code can be
// exercised from Node — a route that silently degrades to a straight line
// through Urey Hall is the single most likely way this feature breaks, and that
// is worth being able to test without a browser.

/* Two path vertices this close are the same junction. OSM ways that meet share
   a node and therefore share exact coordinates; the build script has already
   rounded everything to 0.1 m, so an exact string key would very nearly work.
   The tolerance exists for the handful of places where two ways were drawn to
   meet but land a few centimetres apart. */
const SNAP_M = 0.35;
const cellKey = (x, z) => `${Math.round(x / SNAP_M)}:${Math.round(z / SNAP_M)}`;

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/* ---- geometry, for keeping shortcuts out of buildings ---- */

const pointInRing = (x, z, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
};

const segmentsCross = (ax, az, bx, bz, cx, cz, dx, dz) => {
  const s = (px, pz, qx, qz, rx, rz) =>
    Math.sign((qx - px) * (rz - pz) - (qz - pz) * (rx - px));
  return s(ax, az, bx, bz, cx, cz) !== s(ax, az, bx, bz, dx, dz)
    && s(cx, cz, dx, dz, ax, az) !== s(cx, cz, dx, dz, bx, bz);
};

/** Does the segment a->b enter this ring at all — by crossing it or starting in it? */
const segmentHitsRing = (ax, az, bx, bz, ring) => {
  if (pointInRing(ax, az, ring) || pointInRing(bx, bz, ring)) return true;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    if (segmentsCross(ax, az, bx, bz, ring[j][0], ring[j][1], ring[i][0], ring[i][1])) return true;
  }
  return false;
};

const bboxOf = (ring) => {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, z] of ring) {
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  return { x0, x1, z0, z1 };
};

/**
 * Build the routable graph once per page load.
 * @param {{paths: {p: number[][], steps?: number}[], surfaces?: object[]}} data campus-3d.json
 */
export function buildGraph(data) {
  const nodes = [];
  const byCell = new Map();

  const nodeAt = (x, z) => {
    const k = cellKey(x, z);
    let idx = byCell.get(k);
    if (idx === undefined) {
      idx = nodes.length;
      nodes.push({ x, z, edges: [] });
      byCell.set(k, idx);
    }
    return idx;
  };

  for (const path of data.paths) {
    const pts = path.p;
    for (let i = 1; i < pts.length; i++) {
      const a = nodeAt(pts[i - 1][0], pts[i - 1][1]);
      const b = nodeAt(pts[i][0], pts[i][1]);
      if (a === b) continue;
      const len = dist(nodes[a], nodes[b]);
      /* Stairs cost more than their length. A scooter rider does not ride down
         the Revelle steps, they get off and carry it — so the router should
         prefer a longer ramped way round, exactly as a real rider would. The
         multiplier is a travel-cost weight only; reported distance below is
         always true metres. */
      const w = path.steps ? len * 3.5 : len;
      nodes[a].edges.push({ to: b, w, len });
      nodes[b].edges.push({ to: a, w, len });
    }
  }

  /* A PLAZA IS NOT AN OBSTACLE.
   *
   * Revelle Plaza is mapped as a closed area rather than a line, so the path
   * network genuinely stops at its edge — only five path vertices fall inside
   * it. Routed on lines alone, Argo Hall to the middle of the plaza came out at
   * 390 m: the router walked all the way around a square you can see across.
   * Nobody has ever done that.
   *
   * So an open surface is made crossable. Its perimeter becomes walkable, and
   * every perimeter vertex is joined to the centre, which lets a route cut
   * diagonally across in roughly the line a person takes. It is not a full
   * triangulation of the space and does not need to be.
   *
   * BUT A SHORTCUT MUST NOT GO THROUGH A BUILDING. The original version of this
   * assumed the plazas here are convex enough that a centre-crossing spoke is
   * indistinguishable from the desire line. That is false for the courtyard
   * plaza around Argo Hall, whose ring wraps the building: 4 of its 18 spokes
   * ran straight through Argo, and the shipped scooter route inherited 12 m of
   * centreline inside the walls. Nothing on screen said so — you simply drove
   * through a residence hall.
   *
   * So every link laid down here is tested against the footprints it might
   * cross, and dropped if it enters one. This is the failure this module's own
   * header warns about ("a route that silently degrades to a straight line
   * through Urey Hall"); it arrived through the shortcut rather than through a
   * fallback, which is why it went unnoticed. Real OSM paths are NOT filtered —
   * a way that genuinely runs under a building is a breezeway, and the survey is
   * right about it. Only these invented shortcuts are. */
  const footprints = (data.buildings || [])
    .filter((b) => b?.p?.length >= 3)
    .map((b) => ({ ring: b.p, box: bboxOf(b.p) }));

  /** Buildings whose bbox overlaps this one — the only ones worth testing. */
  const near = (box) => footprints.filter((f) =>
    f.box.x0 <= box.x1 && f.box.x1 >= box.x0 && f.box.z0 <= box.z1 && f.box.z1 >= box.z0);

  for (const surface of data.surfaces || []) {
    if (surface.kind !== "plaza" || !surface.p || surface.p.length < 4) continue;
    const ring = surface.p;

    const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
    const cz = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    const centre = nodeAt(cx, cz);
    const candidates = near(bboxOf(ring));

    const link = (a, b, checked) => {
      if (a === b) return;
      const len = dist(nodes[a], nodes[b]);
      if (!len) return;
      if (checked) {
        const { x: ax, z: az } = nodes[a];
        const { x: bx, z: bz } = nodes[b];
        for (const f of candidates) {
          if (segmentHitsRing(ax, az, bx, bz, f.ring)) return;
        }
      }
      nodes[a].edges.push({ to: b, w: len, len });
      nodes[b].edges.push({ to: a, w: len, len });
    };

    for (let i = 0; i < ring.length; i++) {
      const here = nodeAt(ring[i][0], ring[i][1]);
      const next = nodeAt(ring[(i + 1) % ring.length][0], ring[(i + 1) % ring.length][1]);
      /* The perimeter is the surveyed edge of the plaza and is walkable even
         where it hugs a wall — filtering it disconnects the graph outright
         (the courts lose their only link to Revelle). Only the spoke is an
         invention of this function, so only the spoke is checked. */
      link(here, next, false);
      link(here, centre, true);
    }
  }

  return { nodes };
}

/** Nearest graph node to an arbitrary point (a building centroid, say). */
export function nearestNode(graph, x, z) {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < graph.nodes.length; i++) {
    const d = dist(graph.nodes[i], { x, z });
    if (d < bestD) { bestD = d; best = i; }
  }
  return { index: best, distance: bestD };
}

/**
 * A* from one graph node to another.
 * @returns {{points: {x:number,z:number}[], metres: number} | null}
 */
export function findRoute(graph, startIdx, goalIdx) {
  const { nodes } = graph;
  const goal = nodes[goalIdx];
  const g = new Float64Array(nodes.length).fill(Infinity);
  const f = new Float64Array(nodes.length).fill(Infinity);
  const cameFrom = new Int32Array(nodes.length).fill(-1);
  const closed = new Uint8Array(nodes.length);

  g[startIdx] = 0;
  f[startIdx] = dist(nodes[startIdx], goal);

  /* A binary heap would be tidier, but campus is ~5,000 nodes and this runs
     once per run start, not per frame. Linear scan is measurably instant and
     one less thing to get subtly wrong. */
  const open = new Set([startIdx]);

  while (open.size) {
    let cur = -1;
    let bestF = Infinity;
    for (const idx of open) {
      if (f[idx] < bestF) { bestF = f[idx]; cur = idx; }
    }
    if (cur === goalIdx) break;
    open.delete(cur);
    closed[cur] = 1;

    for (const edge of nodes[cur].edges) {
      if (closed[edge.to]) continue;
      const tentative = g[cur] + edge.w;
      if (tentative < g[edge.to]) {
        cameFrom[edge.to] = cur;
        g[edge.to] = tentative;
        f[edge.to] = tentative + dist(nodes[edge.to], goal);
        open.add(edge.to);
      }
    }
  }

  if (cameFrom[goalIdx] === -1 && startIdx !== goalIdx) return null;

  const points = [];
  let metres = 0;
  for (let at = goalIdx; at !== -1; at = cameFrom[at]) {
    const n = nodes[at];
    if (points.length) metres += dist(n, points[0]);
    points.unshift({ x: n.x, z: n.z });
    if (at === startIdx) break;
  }
  return { points, metres };
}

/**
 * Chaikin corner-cutting. The raw OSM polyline turns in hard corners, which
 * looks fine on a map and rides like hitting a wall. Two passes rounds the
 * corners enough for a camera to follow without the route drifting off the
 * actual walkway.
 */
export function smooth(points, passes = 2, avoid = null) {
  /* ROUND CORNERS, NEVER ROUND INTO A WALL. Cutting a corner moves the line off
     the surveyed path by design, and beside a building that is how a route
     which clears the wall as a polyline ends up 2 m inside it once smoothed —
     which is exactly what happened at Challenger Hall. Given `avoid` (footprint
     rings), a cut that would land inside one is not taken and that corner stays
     square. A square corner is a slightly worse ride and a far better one than
     driving through a residence hall. */
  const blocked = (x, z) => {
    if (!avoid) return false;
    for (const ring of avoid) if (pointInRing(x, z, ring)) return true;
    return false;
  };

  let pts = points;
  for (let pass = 0; pass < passes; pass++) {
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const p = { x: a.x * 0.75 + b.x * 0.25, z: a.z * 0.75 + b.z * 0.25 };
      const q = { x: a.x * 0.25 + b.x * 0.75, z: a.z * 0.25 + b.z * 0.75 };
      if (blocked(p.x, p.z) || blocked(q.x, q.z)) {
        out.push({ x: a.x, z: a.z }, { x: b.x, z: b.z });
      } else {
        out.push(p, q);
      }
    }
    out.push(pts[pts.length - 1]);
    pts = out;
  }
  return pts;
}

/** Nearest point to (x,z) on a closed ring's boundary, and how far away it is. */
function nearestOnRing(x, z, ring) {
  let best = null;
  let bestD = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[j];
    const [bx, bz] = ring[i];
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz;
    const t = len2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2)) : 0;
    const qx = ax + dx * t;
    const qz = az + dz * t;
    const d = Math.hypot(x - qx, z - qz);
    if (d < bestD) { bestD = d; best = { x: qx, z: qz }; }
  }
  return { point: best, distance: bestD };
}

/**
 * Push a centreline out of the buildings it clips, and off their walls.
 *
 * Smoothing is not the only way a route ends up inside a wall. OSM draws plazas
 * and buildings as separate polygons that overlap slightly where a plaza abuts a
 * building, so a plaza's own PERIMETER can run a metre inside the neighbouring
 * footprint — which is how the route caught the corner of Challenger Hall by
 * 1.2 m. Filtering those perimeter edges out of the graph is not an option: they
 * are the only thing connecting some of this campus, and dropping them left the
 * courts with no route to Revelle at all.
 *
 * So repair the line instead of the graph. Anything inside a footprint, or
 * closer to one than `clearance`, is moved to the nearest point on that wall
 * plus the clearance. Run this BEFORE resampling — the resample re-grids
 * afterwards, so the fixed spacing the ride indexes by survives untouched.
 *
 * A few metres of lateral correction on a route this long is not a claim about
 * where the path is. It is a statement that the rider does not pass through
 * masonry, which the survey already implies and the polyline had merely lost.
 */
export function pushOutside(points, rings, clearance = 1.2, passes = 2) {
  if (!rings?.length) return points;
  let pts = points.map((p) => ({ x: p.x, z: p.z }));

  for (let pass = 0; pass < passes; pass++) {
    let moved = 0;
    pts = pts.map((p) => {
      let { x, z } = p;
      for (const ring of rings) {
        const inside = pointInRing(x, z, ring);
        const { point: q, distance } = nearestOnRing(x, z, ring);
        if (!q) continue;
        if (!inside && distance >= clearance) continue;
        /* Outward is away from the wall we are nearest to — which is the
           direction we already lie in when outside, and its opposite when in. */
        let dx = x - q.x;
        let dz = z - q.z;
        const len = Math.hypot(dx, dz);
        if (len < 1e-6) continue; // exactly on the wall: no direction to trust
        if (inside) { dx = -dx; dz = -dz; }
        x = q.x + (dx / len) * clearance;
        z = q.z + (dz / len) * clearance;
        moved++;
      }
      return { x, z };
    });
    if (!moved) break;
  }
  return pts;
}

/**
 * Resample to a fixed spacing so the runtime can index the route by distance
 * travelled instead of hunting for the current segment every frame.
 */
export function resample(points, spacing = 2) {
  const out = [points[0]];
  let carry = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const seg = dist(a, b);
    if (seg < 1e-6) continue;
    let t = spacing - carry;
    while (t <= seg) {
      out.push({ x: a.x + ((b.x - a.x) * t) / seg, z: a.z + ((b.z - a.z) * t) / seg });
      t += spacing;
    }
    carry = (carry + seg) % spacing;
  }
  const last = points[points.length - 1];
  if (dist(out[out.length - 1], last) > spacing * 0.5) out.push(last);
  return out;
}

/**
 * Route through a list of waypoints in order.
 *
 * A single A* from Argo Hall to Ridge Walk does NOT cross Revelle Plaza — it
 * finds whichever way is shortest, and the shortest way out of Revelle is not
 * the way through the middle of it. Naming the plaza as a waypoint is how the
 * walk becomes the walk somebody described rather than the one the solver
 * preferred.
 *
 * @param {(string|{x:number,z:number,name?:string})[]} waypoints
 */
export function routeThrough(data, graph, waypoints) {
  if (waypoints.length < 2) throw new Error("a route needs at least two waypoints");

  const resolve = (w) => {
    if (typeof w !== "string") return { name: w.name || "point", x: w.x, z: w.z };
    const place = data.places[w];
    if (!place) throw new Error(`unknown place: ${w}`);
    return { name: w, x: place.x, z: place.z };
  };

  const legs = waypoints.map(resolve);
  const points = [];
  let metres = 0;
  let approach = 0;

  for (let i = 0; i < legs.length - 1; i++) {
    const a = nearestNode(graph, legs[i].x, legs[i].z);
    const b = nearestNode(graph, legs[i + 1].x, legs[i + 1].z);
    const leg = findRoute(graph, a.index, b.index);
    if (!leg) throw new Error(`no walkable route from ${legs[i].name} to ${legs[i + 1].name}`);
    metres += leg.metres;
    // The gap from a building's centroid out to the path is real walking, but
    // only at the two ends — joins in the middle are the same node twice.
    if (i === 0) approach += a.distance;
    if (i === legs.length - 2) approach += b.distance;
    // Drop the duplicated junction where two legs meet.
    points.push(...(points.length ? leg.points.slice(1) : leg.points));
  }

  return {
    points: resample(smooth(points)),
    metres: Math.round(metres + approach),
    rawMetres: metres + approach,
    from: legs[0],
    to: legs[legs.length - 1],
    via: legs.slice(1, -1),
  };
}

/**
 * The minimap's world↔pixel transform, shared by drawing, click handling and
 * the tests so all three can never disagree. World data is already planar
 * metres with +z pointing SOUTH, so drawing z downward gives a north-up map
 * with no flip. The world box is fitted inside the pixel box preserving
 * aspect, centred on both axes.
 *
 * Kept in this file because it is pure geometry with no DOM — the same reason
 * the router lives here — so Node can round-trip it.
 *
 * @param {{minX:number,maxX:number,minZ:number,maxZ:number}} bounds
 * @param {number} mapW pixel width
 * @param {number} mapH pixel height
 */
export function makeMapTransform(bounds, mapW, mapH) {
  const worldW = Math.max(1e-9, bounds.maxX - bounds.minX);
  const worldH = Math.max(1e-9, bounds.maxZ - bounds.minZ);
  const scale = Math.min(mapW / worldW, mapH / worldH);
  const ox = (mapW - worldW * scale) / 2;
  const oy = (mapH - worldH * scale) / 2;
  return {
    scale,
    toMap: (x, z) => [ox + (x - bounds.minX) * scale, oy + (z - bounds.minZ) * scale],
    toWorld: (mx, my) => [bounds.minX + (mx - ox) / scale, bounds.minZ + (my - oy) / scale],
  };
}

/**
 * The whole job, from two names on the map to a ridable centreline.
 * @returns {{points, metres, rawMetres, from, to}}
 */
export function routeBetween(data, graph, fromName, toName) {
  const from = data.places[fromName];
  const to = data.places[toName];
  if (!from) throw new Error(`unknown start: ${fromName}`);
  if (!to) throw new Error(`unknown destination: ${toName}`);

  const a = nearestNode(graph, from.x, from.z);
  const b = nearestNode(graph, to.x, to.z);
  const route = findRoute(graph, a.index, b.index);
  if (!route) throw new Error(`no walkable route from ${fromName} to ${toName}`);

  /* The walk from a building's centroid out to the nearest path is real
     distance a student covers, so it counts toward the reported length even
     though it is not ridden. */
  const rawMetres = route.metres + a.distance + b.distance;
  return {
    points: resample(smooth(route.points)),
    metres: Math.round(rawMetres),
    rawMetres,
    from: { name: fromName, ...from },
    to: { name: toName, ...to },
  };
}
