/* Which college is this building in?
 *
 * The project had no answer to that question and no source for one, so a
 * gauntlet pass guessed — it read an OSM neighbourhood name as an affiliation
 * and put Eighth College's label on Thurgood Marshall's halls. The fix is not a
 * better guess. It is a source.
 *
 * Sahir supplied the authoritative boundary map (2026-08-04). Seven of the eight
 * colleges exist in OSM as `place=neighbourhood` polygons whose positions match
 * that map; those are imported as-is, because a named polygon is exactly what
 * OSM is authoritative for. EIGHTH COLLEGE IS NOT IN OSM AT ALL — it is derived
 * from the five member buildings Sahir named, and is marked in the output as a
 * different kind of claim so nobody later mistakes it for surveyed boundary.
 *
 * Affiliation is then point-in-polygon and nothing else. A building outside every
 * polygon gets NO college — "unknown" is a real answer here and far better than
 * the nearest-college guess that caused the original bug.
 *
 *   node scripts/build-campus-colleges.mjs           # fetch + write
 *   node scripts/build-campus-colleges.mjs --check   # validate what shipped
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs/data/campus-colleges.json");
const CHECK = process.argv.includes("--check");

const campus = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/data/campus-3d.json"), "utf8"));
const o = campus.origin;
const toX = (lng) => (lng - o.lng) * o.mPerDegLng;
const toZ = (lat) => (o.lat - lat) * o.mPerDegLat;

/* OSM ways for the seven mapped colleges, verified 2026-08-04 against Sahir's
   boundary map: Seventh northernmost, then Roosevelt, Marshall, Sixth, Muir,
   Revelle running south, with Warren off to the east. */
const OSM_COLLEGES = {
  "Seventh College": 674120531,
  "Eleanor Roosevelt College": 911401522,
  "Thurgood Marshall College": 399594738,
  "Sixth College": 911401521,
  "John Muir College": 399594737,
  "Revelle College": 399594736,
  "Earl Warren College": 399600309,
};

/* Eighth College has no OSM polygon. Sahir named its five buildings; the
   boundary here is their convex hull, padded, and is flagged `derived`. */
const EIGHTH_MEMBERS = ["Sankofa", "Pulse", "Podemos", "Azad", "Survivance"];

/* ------------------------------------------------------------------ geometry */
function ringOf(building) {
  return building.p;
}
function centroid(ring) {
  return [ring.reduce((a, q) => a + q[0], 0) / ring.length,
          ring.reduce((a, q) => a + q[1], 0) / ring.length];
}
function pointInRing([px, pz], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > pz) !== (zj > pz) && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
/* Andrew's monotone chain. */
function hull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const build = (pts) => {
    const s = [];
    for (const q of pts) {
      while (s.length >= 2 && cross(s[s.length - 2], s[s.length - 1], q) <= 0) s.pop();
      s.push(q);
    }
    s.pop();
    return s;
  };
  return [...build(p), ...build(p.reverse())];
}
/* Push every hull vertex out from the centroid, so member buildings sit inside
   rather than exactly on the edge.
 *
 * `blocked` is the list of surveyed rings a derived boundary must never enter.
 * A surveyed polygon outranks a derived one absolutely: at the full 90 m pad,
 * Eighth's hull reached across and swallowed Keeling Apartments South Tower,
 * which is Revelle's. So each vertex gets as much pad as it can take before it
 * crosses into somebody else's college, and no more. */
function pad(ring, metres, blocked = []) {
  const [cx, cz] = centroid(ring);
  return ring.map(([x, z]) => {
    const d = Math.hypot(x - cx, z - cz) || 1;
    const at = (m) => [x + ((x - cx) / d) * m, z + ((z - cz) / d) * m];
    let m = metres;
    while (m > 0 && blocked.some((r) => pointInRing(at(m), r))) m -= 5;
    const [px, pz] = at(m);
    return [+px.toFixed(1), +pz.toFixed(1)];
  });
}

/* -------------------------------------------------------------------- build */
/* Overpass mirrors 504 under load often enough that one attempt is not a
   build. Rotate hosts and back off rather than failing the whole layer. */
const OVERPASS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.osm.jp/api/interpreter",
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CACHE = path.join(ROOT, ".cache/college-rings");

async function fetchRing(id) {
  /* Overpass is slow and rate-limited, and these boundaries change about never.
     Cache per way so a rebuild is instant and offline-safe. */
  const cached = path.join(CACHE, `${id}.json`);
  if (fs.existsSync(cached)) return JSON.parse(fs.readFileSync(cached, "utf8"));

  const q = `[out:json][timeout:120];way(${id});out geom;`;
  let last = "";
  for (let attempt = 0; attempt < 6; attempt++) {
    const host = OVERPASS[attempt % OVERPASS.length];
    try {
      const res = await fetch(host, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "3d-modeling-campus/1.0 (github.com/SahirSSharma/3D-Modeling-Campus)" },
        body: "data=" + encodeURIComponent(q),
      });
      if (!res.ok) { last = `${res.status} from ${new URL(host).host}`; await sleep(2000 * (attempt + 1)); continue; }
      const j = await res.json();
      const g = j.elements?.[0]?.geometry;
      if (!g) { last = `no geometry from ${new URL(host).host}`; await sleep(1500); continue; }
      const ring = g.map((p) => [+toX(p.lon).toFixed(1), +toZ(p.lat).toFixed(1)]);
      fs.mkdirSync(CACHE, { recursive: true });
      fs.writeFileSync(cached, JSON.stringify(ring));
      return ring;
    } catch (e) {
      last = e.message;
      await sleep(2000 * (attempt + 1));
    }
  }
  throw new Error(`way/${id} unavailable after 6 attempts — last: ${last}`);
}

let doc;
if (CHECK) {
  doc = JSON.parse(fs.readFileSync(OUT, "utf8"));
} else {
  const colleges = {};
  for (const [name, id] of Object.entries(OSM_COLLEGES)) {
    colleges[name] = { source: `OSM way/${id}`, kind: "surveyed", ring: await fetchRing(id) };
    console.log(`  ${name.padEnd(28)} OSM way/${id}  ${colleges[name].ring.length} pts`);
  }

  const memberCentroids = EIGHTH_MEMBERS.map((n) => {
    const b = campus.buildings.find((x) => x.n === n);
    if (!b) throw new Error(`Eighth College member missing from campus-3d.json: ${n}`);
    return centroid(ringOf(b));
  });
  colleges["Eighth College"] = {
    source: "Sahir 2026-08-04 — named its five member buildings; no OSM polygon exists",
    kind: "derived",
    members: EIGHTH_MEMBERS,
    ring: pad(hull(memberCentroids), 90, Object.values(colleges).map((c) => c.ring)),
  };
  console.log(`  ${"Eighth College".padEnd(28)} derived from ${EIGHTH_MEMBERS.length} members  ${colleges["Eighth College"].ring.length} pts`);

  /* Affiliate every named building by point-in-polygon. `colleges` is built
     surveyed-first and first match wins, so an OSM boundary always outranks the
     derived one where they touch. */
  const affiliation = {};
  const tally = {};
  for (const b of campus.buildings) {
    if (!b.n) continue;
    const c = centroid(ringOf(b));
    for (const [name, col] of Object.entries(colleges)) {
      if (pointInRing(c, col.ring)) { affiliation[b.n] = name; tally[name] = (tally[name] || 0) + 1; break; }
    }
  }

  doc = {
    _: "College boundaries and per-building affiliation. Seven polygons are OSM neighbourhoods; Eighth is derived from the member buildings Sahir named. A building outside every polygon has NO affiliation — that is a real answer, not a gap to fill.",
    generated: new Date().toISOString(),
    origin: o,
    colleges,
    affiliation,
    /* A label belongs among the buildings, not at a polygon centroid — these
       rings are concave enough (Muir, Revelle) that a centroid can land in a
       canyon or outside the college entirely. Anchor on the mean of the
       college's own affiliated buildings, falling back to the ring only when a
       college has none. */
    anchors: Object.fromEntries(Object.entries(colleges).map(([n, c]) => {
      const mine = campus.buildings.filter((b) => b.n && affiliation[b.n] === n).map((b) => centroid(ringOf(b)));
      const [x, z] = mine.length ? centroid(mine) : centroid(c.ring);
      return [n, { x: +x.toFixed(1), z: +z.toFixed(1), from: mine.length ? `${mine.length} affiliated buildings` : "ring centroid" }];
    })),
  };
  fs.writeFileSync(OUT, JSON.stringify(doc, null, 1));
  console.log(`\nwrote ${OUT}`);
  for (const [n, c] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`  ${n.padEnd(28)} ${c} named buildings`);
  console.log(`  ${"(no college)".padEnd(28)} ${campus.buildings.filter((b) => b.n && !affiliation[b.n]).length} named buildings`);
}

/* -------------------------------------------------------------------- check */
const problems = [];
const EXPECT = { Sankofa: "Eighth College", Pulse: "Eighth College", Podemos: "Eighth College",
  Azad: "Eighth College", Survivance: "Eighth College",
  Alianza: "Thurgood Marshall College", Umoja: "Thurgood Marshall College",
  Coalition: "Thurgood Marshall College", "Malk Hall": "Thurgood Marshall College",
  Mosaic: "Sixth College" };
for (const [b, want] of Object.entries(EXPECT)) {
  const got = doc.affiliation[b];
  if (got !== want) problems.push(`${b}: expected ${want}, got ${got ?? "none"}`);
}
if (Object.keys(doc.colleges).length !== 8) problems.push(`${Object.keys(doc.colleges).length} colleges, expected 8`);

if (problems.length) {
  console.log("\nFAILED:");
  for (const p of problems) console.log(`  ${p}`);
  process.exit(1);
}
console.log(`\ncampus-colleges.json OK — 8 colleges, ${Object.keys(doc.affiliation).length} buildings affiliated`);
