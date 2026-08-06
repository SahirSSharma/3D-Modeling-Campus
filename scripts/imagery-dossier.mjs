/* A work-list for the rings only a PHOTOGRAPH can settle.
 *
 * WHY THIS EXISTS
 * 356 unnamed rings still render at an invented height. Measured 2026-08-05,
 * with the builder instrumented to record why each was refused:
 *
 *     238   spread only — the returns do not describe one plane
 *      93   under 400 returns
 *      20   outside the survey box (rim coverage < 0.99)
 *       6   measures under 3 m — the flight predates the building
 *
 * The last three groups are closed questions: the 2014 flight cannot answer
 * them and no amount of looking at the point cloud will change that. The 238
 * are different. Their returns are real and plentiful; they simply do not form
 * a single plane, because the roof is sloped, terraced, or mixed with canopy.
 *
 * And the loosening that would sweep them in is not available. Raising the
 * spread cut to 2.0 admits 103 of them and simultaneously admits 14 of the 67
 * rings a human looked at and refused. At the CURRENT cut of 1.2, six withheld
 * rings would already pass on statistics alone — they are held out by the
 * explicit `OSM_WITHHELD` list, not by the criteria. The statistics have been
 * taken as far as they go.
 *
 * So: photographs, which is where Sahir pointed (2026-08-05) — "google the
 * building/area and go to images, there should be plenty of shots of all
 * angles". These rings are unnamed, but they are not unidentifiable: each has a
 * centroid, a centroid reverse-geocodes to a street address, and an address
 * finds the building. One gauntlet agent already did exactly this by hand,
 * resolving osm:876 to 9760 Black Gold Road.
 *
 * THE RULE THAT DOES NOT BEND
 * A storey count read off a photograph is a DECLARED ESTIMATE, never a
 * measurement. It ships labeled as one, the way `POST_2014_SITES` entries do.
 * The two-source rule stands: OSM for identity, LiDAR for height, imagery for
 * what is there today. A photo resolving "this is a three-storey apartment
 * block with a pitched roof" is identity, and identity is what these rings
 * lack. It is not a licence to read metres off a picture.
 *
 * Run: node scripts/imagery-dossier.mjs [--out <file>] [--limit N] [--geocode]
 *
 *   Without --geocode it emits coordinates and viewer links only — no network.
 *   With it, each ring is reverse-geocoded through Nominatim at the 1 req/sec
 *   its usage policy requires, which is why a full run takes ~4 minutes.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const argv = process.argv.slice(2);
const argOf = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(argOf("--out", path.join(ROOT, "gauntlet-loop/imagery-worklist.json")));
const LIMIT = Number(argOf("--limit", Infinity));
const GEOCODE = argv.includes("--geocode");

const campus = JSON.parse(readFileSync(path.join(ROOT, "docs/data/campus-3d.json"), "utf8"));
const DIAG = path.join(ROOT, ".cache/reject-diagnosis.json");

let diag;
try {
  diag = JSON.parse(readFileSync(DIAG, "utf8"));
} catch {
  console.error(`No rejection diagnosis at ${path.relative(ROOT, DIAG)}.

It is produced by the builder with per-ring refusal reasons recorded. Without it
this script would have to guess which rings a photograph could settle, and a
work-list built on a guess sends people to look at the wrong buildings.`);
  process.exit(1);
}

const { lat: LAT0, lng: LNG0, mPerDegLat, mPerDegLng } = campus.origin;
/* z increases SOUTHWARD in this project's local frame, so it SUBTRACTS from
   latitude. This is worth stating rather than assuming: the first version of
   this file added it, which mirrors the campus about its own origin and puts
   every link 700–1700 m from the building it names — Geisel landed in Revelle.
   Verified against scripts/gauntlet-shards.mjs, which publishes both frames for
   the same boxes: r0c0's z0 = -1472.4 is its north edge at lat 32.891316, and
   32.878 - (-1472.4 / 110574) = 32.891315. */
const toLatLng = (x, z) => ({
  lat: LAT0 - z / mPerDegLat,
  lng: LNG0 + x / mPerDegLng,
});

const centroidOf = (ring) => {
  let x = 0, z = 0;
  for (const p of ring) { x += p[0]; z += p[1]; }
  return [x / ring.length, z / ring.length];
};

/* Ring area in square metres (shoelace), so the work-list can be ordered by how
   much building each row actually represents. A 900 m² apartment block is worth
   a person's minute; a 30 m² utility shed is not. */
const areaOf = (ring) => {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return Math.abs(a / 2);
};

/* ON CAMPUS OR NOT — the question that reorders this entire list.
 *
 * Reverse-geocoding the twenty largest rings returned Nobel Drive, Genesee
 * Avenue, Regents Road: Golden Triangle and Sorrento Valley office blocks that
 * fall inside the survey box but are not campus. The largest ring of all
 * (6,845 m², osm:1359) is on La Jolla Village Drive.
 *
 * Ranking by raw area therefore points the work at the city. The standing goal
 * is a walkable campus as accurate as Apple's satellite view, and the measure
 * of a fix is how much of what a person walking CAMPUS sees it corrects — so a
 * 1,072 m² building on Ridge Walk outranks a 6,845 m² one on a arterial road
 * nobody on this walk will stand next to. */
const boundary = JSON.parse(readFileSync(path.join(ROOT, "docs/data/campus-boundary.json"), "utf8"));
const CAMPUS_RING = boundary.points ?? boundary.rings?.[0] ?? null;

/* Ray casting. The boundary ring is closed (first == last) and in the same
   local frame, so no conversion is needed — which is also why this is the
   cheapest reliable membership test available here. */
const inCampus = (x, z) => {
  if (!CAMPUS_RING) return null;
  let inside = false;
  for (let i = 0, j = CAMPUS_RING.length - 1; i < CAMPUS_RING.length; j = i++) {
    const [xi, zi] = CAMPUS_RING[i], [xj, zj] = CAMPUS_RING[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
};

/* Only the rings a photograph can settle. The other refusals are closed
   questions and putting them on a work-list wastes the looking. */
const answerable = diag.filter((r) => r.why === "spread>1.2");

const rows = answerable.map((r) => {
  const b = campus.buildings[r.bi];
  const ring = b.p;
  const [cx, cz] = centroidOf(ring);
  const { lat, lng } = toLatLng(cx, cz);
  return {
    bi: r.bi,
    onCampus: inCampus(cx, cz),
    lat: +lat.toFixed(6),
    lng: +lng.toFixed(6),
    area_m2: Math.round(areaOf(ring)),
    guess_h: b.h ?? null,
    measured_would_be: r.h,
    pts: r.pts,
    spread: r.spread,
    rule: r.rule,
    planes: { p50: r.p50, p75: r.p75, p98: r.p98 },
    /* What each link is FOR, because sending someone to four tabs without
       saying which question each answers is how a survey turns into browsing:
         apple    — what is there today (this project's authority on the present)
         streets  — the facade, at eye level, where storeys are countable
         search   — everything else the web knows about the address */
    apple: `https://maps.apple.com/?ll=${lat.toFixed(6)},${lng.toFixed(6)}&t=k&z=19`,
    streets: `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat.toFixed(6)},${lng.toFixed(6)}`,
    search: `https://duckduckgo.com/?q=${encodeURIComponent(`${lat.toFixed(5)},${lng.toFixed(5)} building`)}&iax=images&ia=images`,
    address: null,
  };
});

/* On campus first, then biggest first inside each group. If this list is only
   ever half worked, the half that gets done must be the half a person on this
   walk actually stands next to. */
rows.sort((a, b) => (b.onCampus === true) - (a.onCampus === true) || b.area_m2 - a.area_m2);
const selected = rows.slice(0, LIMIT);

if (GEOCODE) {
  /* Nominatim's usage policy is one request per second and a real User-Agent.
     Breaking it gets the whole project blocked, which would cost far more than
     the four minutes this takes. */
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (const [i, row] of selected.entries()) {
    try {
      const u = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${row.lat}&lon=${row.lng}&zoom=18`;
      const res = await fetch(u, { headers: { "User-Agent": "campus-walk/1.0 (UCSD 3D survey; contact via repo)" } });
      if (res.ok) {
        const j = await res.json();
        row.address = j.display_name ?? null;
        row.osm_name = j.name || j.address?.building || null;
      }
    } catch (e) {
      row.address = null;
      row.geocode_error = String(e.message || e);
    }
    if ((i + 1) % 25 === 0) console.log(`  geocoded ${i + 1}/${selected.length}`);
    await sleep(1100);
  }
}

const payload = {
  _: "Rings a photograph can settle. Generated by scripts/imagery-dossier.mjs — do not hand-edit.",
  rule: "A storey count read from a photograph is a DECLARED ESTIMATE, never a measurement. Ship it labeled.",
  generated_from: path.relative(ROOT, DIAG),
  answerable_total: answerable.length,
  on_campus: rows.filter((r) => r.onCampus).length,
  off_campus: rows.filter((r) => !r.onCampus).length,
  listed: selected.length,
  closed_questions: {
    "under 400 returns": diag.filter((r) => r.why?.includes("pts<400")).length,
    "outside the survey box": diag.filter((r) => r.why?.includes("rim<0.99")).length,
    "measures under 3 m (epoch)": diag.filter((r) => r.why?.includes("height<3")).length,
  },
  rows: selected,
};
writeFileSync(OUT, JSON.stringify(payload, null, 1));

console.log(`\n${selected.length} ring(s) written to ${path.relative(ROOT, OUT)}`);
console.log(`  of ${answerable.length} a photograph could settle`);
console.log(`  largest: ${selected.slice(0, 5).map((r) => `osm:${r.bi} (${r.area_m2} m²)`).join(", ")}`);
const totalArea = selected.reduce((t, r) => t + r.area_m2, 0);
const onC = selected.filter((r) => r.onCampus);
const onArea = onC.reduce((t, r) => t + r.area_m2, 0);
console.log(`  ${onC.length} inside the campus boundary (${Math.round(onArea).toLocaleString()} m²), ${selected.length - onC.length} outside it (${Math.round(totalArea - onArea).toLocaleString()} m²)`);
console.log(`  the on-campus rings are the ones that change what a walker sees`);
if (!GEOCODE) console.log(`\n  (no addresses — re-run with --geocode to reverse-geocode each centroid)`);
