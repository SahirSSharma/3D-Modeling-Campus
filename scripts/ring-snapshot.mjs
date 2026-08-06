/* Photograph one footprint, with the footprint drawn on it.
 *
 * WHY THIS EXISTS
 * Adjudicating a ring from imagery needs the answer to "which building is this
 * ring?", and a bare satellite snapshot does not answer it. Looking at osm:899
 * on 2026-08-05 produced a picture of a service yard with a dozen flat roofs
 * packed together and taller neighbours on both sides — and no way to tell
 * which of them the 121 m² ring described, or whether its 15 m reading was a
 * real tall structure or bleed off the building next door. That is not a
 * judgement anyone should make, and this project's rule is to withhold rather
 * than guess. But withholding for want of a line on a picture is a tooling
 * failure, not a measurement limit.
 *
 * So this draws the ring. The outline comes from campus-3d.json, projected
 * through the same Web Mercator the snapshot is rendered in, which makes the
 * overlay a geometric statement rather than an eyeballed one.
 *
 * WHAT IT CANNOT DO
 * Nadir imagery shows roofs, not eaves. It resolves WHICH building and WHAT
 * KIND of roof; it does not resolve height, and a storey count taken from it is
 * a declared estimate at best. For the Marshall cluster — one-storey apartments
 * under overhanging eucalyptus — even identity was decidable while height was
 * not, and the correct outcome was to withhold. Expect that outcome often.
 *
 *   node scripts/ring-snapshot.mjs --ring 899 [--zoom 20] [--out <file>]
 *   node scripts/ring-snapshot.mjs --ring 17,131,140 --zoom 20
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  appleCredentials, appleSnapshotQuery, signAppleSnapshot,
  mercX, mercY,
} from "./lib/imagery.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const argv = process.argv.slice(2);
const argOf = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const RINGS = String(argOf("--ring", "")).split(",").filter(Boolean).map(Number);
const ZOOM = Number(argOf("--zoom", 20));
const OUTDIR = path.resolve(argOf("--outdir", path.join(ROOT, ".cache/ring-snapshots")));

if (!RINGS.length) {
  console.error("usage: node scripts/ring-snapshot.mjs --ring <index>[,<index>...] [--zoom 20]");
  process.exit(1);
}

const campus = JSON.parse(readFileSync(path.join(ROOT, "docs/data/campus-3d.json"), "utf8"));
const { lat: LAT0, lng: LNG0, mPerDegLat, mPerDegLng } = campus.origin;
/* +z is SOUTH in this project's frame — pinned by tests/imagery-dossier.test.mjs
   against the shard generator, which publishes both frames for one boundary. */
const toLatLng = (x, z) => ({ lat: LAT0 - z / mPerDegLat, lng: LNG0 + x / mPerDegLng });

/* The snapshot is 640 pt at scale 2, so 1280 image px, rendered in Web Mercator
   at ZOOM and centred on the ring. Projecting the ring through the same
   transform is what makes the drawn outline mean something. */
const SIZE_PT = 640, SCALE = 2, IMG = SIZE_PT * SCALE;

const { teamId, keyId, pem } = appleCredentials(ROOT);
mkdirSync(OUTDIR, { recursive: true });

for (const bi of RINGS) {
  const b = campus.buildings[bi];
  if (!b?.p?.length) { console.error(`osm:${bi} has no footprint`); continue; }

  const ring = b.p;
  let sx = 0, sz = 0;
  for (const [x, z] of ring) { sx += x; sz += z; }
  const centre = toLatLng(sx / ring.length, sz / ring.length);

  const query = appleSnapshotQuery({ lat: centre.lat, lng: centre.lng, zoom: ZOOM, teamId, keyId });
  const { url } = signAppleSnapshot(query, pem);
  const res = await fetch(url);
  if (!res.ok) { console.error(`osm:${bi}: HTTP ${res.status}`); continue; }
  const png = Buffer.from(await res.arrayBuffer());

  /* Mercator pixels at this zoom, ×SCALE because the snapshot is rendered at
     scale 2 — forgetting that halves the polygon and it lands off the roof. */
  const cx = mercX(centre.lng, ZOOM) * SCALE;
  const cy = mercY(centre.lat, ZOOM) * SCALE;
  const pts = ring.map(([x, z]) => {
    const { lat, lng } = toLatLng(x, z);
    return [
      (mercX(lng, ZOOM) * SCALE - cx + IMG / 2).toFixed(1),
      (mercY(lat, ZOOM) * SCALE - cy + IMG / 2).toFixed(1),
    ].join(",");
  }).join(" ");

  /* Magenta: nothing on this campus is magenta from above, so the outline can
     never be mistaken for something in the imagery. */
  const svg = `<svg width="${IMG}" height="${IMG}" xmlns="http://www.w3.org/2000/svg">
    <polygon points="${pts}" fill="none" stroke="#ff00ff" stroke-width="4"/>
    <polygon points="${pts}" fill="#ff00ff" fill-opacity="0.12"/>
    <text x="16" y="40" font-family="monospace" font-size="28" fill="#ff00ff">osm:${bi}  ${Math.round(
      Math.abs(ring.reduce((a, _, i, r) => {
        const j = (i + r.length - 1) % r.length;
        return a + (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
      }, 0) / 2)
    )} m²  guess ${b.h ?? "?"} m  z${ZOOM}</text>
  </svg>`;

  const out = path.join(OUTDIR, `osm-${bi}-z${ZOOM}.png`);
  await sharp(png).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).toFile(out);
  console.log(`${path.relative(ROOT, out)}  — ${centre.lat.toFixed(6)},${centre.lng.toFixed(6)}`);
}
