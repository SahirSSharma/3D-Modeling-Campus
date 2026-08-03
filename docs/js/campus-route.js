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
   * triangulation of the space and does not need to be — the plazas here are
   * convex enough that centre-crossing spokes are indistinguishable from the
   * desire line at walking scale. */
  for (const surface of data.surfaces || []) {
    if (surface.kind !== "plaza" || !surface.p || surface.p.length < 4) continue;
    const ring = surface.p;

    const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
    const cz = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    const centre = nodeAt(cx, cz);

    const link = (a, b) => {
      if (a === b) return;
      const len = dist(nodes[a], nodes[b]);
      if (!len) return;
      nodes[a].edges.push({ to: b, w: len, len });
      nodes[b].edges.push({ to: a, w: len, len });
    };

    for (let i = 0; i < ring.length; i++) {
      const here = nodeAt(ring[i][0], ring[i][1]);
      const next = nodeAt(ring[(i + 1) % ring.length][0], ring[(i + 1) % ring.length][1]);
      link(here, next);   // the perimeter
      link(here, centre); // and straight across it
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
export function smooth(points, passes = 2) {
  let pts = points;
  for (let pass = 0; pass < passes; pass++) {
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      out.push({ x: a.x * 0.75 + b.x * 0.25, z: a.z * 0.75 + b.z * 0.25 });
      out.push({ x: a.x * 0.25 + b.x * 0.75, z: a.z * 0.25 + b.z * 0.75 });
    }
    out.push(pts[pts.length - 1]);
    pts = out;
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
