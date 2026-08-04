// Where the georeferenced ground pixels come from.
//
// The satellite imagery in this project is a BUILD-TIME MEASUREMENT SOURCE and
// nothing else — it is read by build-campus-truecolor.mjs (per-polygon colour),
// build-campus-markings.mjs (the painted sports lines) and audit-accuracy.mjs,
// and no tile ever drapes the rendered world. So the source is swappable: a
// sharper source means sharper measurements and an identical renderer.
//
// A PROVIDER answers one question — "give me the pixels over this patch of
// Web Mercator" — and reports its own geometry so the build can reproject
// without knowing whose imagery it is:
//
//   id            short name, written into the manifest as provenance
//   attribution   the credit line the manifest must carry
//   subPx         IMAGE pixels per Mercator pixel. 1 for a plain 256 px tile;
//                 2 for an Apple snapshot requested at scale=2, which is the
//                 whole reason Apple is worth the trouble — twice the linear
//                 resolution at the same zoom.
//   patchSpan(z)  the patch edge, in Mercator pixels at zoom z
//   patchesFor()  which patches cover a Mercator-pixel window
//   fetchPatch()  the file for one patch, cached on disk
//
// Every patch is aligned to an integer Mercator-pixel lattice, so a mosaic of
// patches composites at integer offsets and the reprojection arithmetic stays
// exactly the arithmetic that was already proven for Google tiles.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/* --------------------------------------------------------- Mercator basics */
/* Shared with scripts/build-campus-satellite.mjs, which imports them from
   here rather than keeping a second copy that could drift. */

export const worldPx = (zoom) => 256 * 2 ** zoom;
export const mercX = (lng, zoom) => ((lng + 180) / 360) * worldPx(zoom);
export function mercY(lat, zoom) {
  const s = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * worldPx(zoom);
}
export const mercYToLat = (my, zoom) =>
  (Math.atan(Math.sinh(Math.PI * (1 - (2 * my) / worldPx(zoom)))) * 180) / Math.PI;
export const mercXToLng = (mx, zoom) => (mx / worldPx(zoom)) * 360 - 180;

/** Ground metres per Mercator pixel at this zoom and latitude. Divide by a
 *  provider's subPx for the metres per IMAGE pixel it actually delivers. */
export const mPerMercPx = (zoom, lat) =>
  (156543.03392804097 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;

/* ------------------------------------------------------------------ .env */

/** Read one key out of .env. The file is never committed and no value read
 *  here is ever written into an output file. */
export function readEnv(root, name, { required = true } = {}) {
  let text = "";
  try {
    text = fs.readFileSync(path.join(root, ".env"), "utf8");
  } catch {
    if (required) throw new Error(`.env not found — ${name} is required`);
    return null;
  }
  const m = text.match(new RegExp(`^${name}=(.+)$`, "m"));
  if (!m) {
    if (required) throw new Error(`${name} missing from .env`);
    return null;
  }
  return m[1].trim();
}

/* ------------------------------------------------------- shared disk cache */

function cachedFetch({ file, cap, state, url, headers, describe }) {
  return (async () => {
    if (fs.existsSync(file)) return file;
    if (state.requests >= cap) throw new Error(`request cap of ${cap} reached`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    for (let attempt = 0; ; attempt++) {
      state.requests++;
      const res = await fetch(url, headers ? { headers } : undefined);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        /* An error page served with 200 would otherwise cache forever as a
           "tile". Every image we accept starts with a JPEG or PNG marker. */
        const jpeg = buf[0] === 0xff && buf[1] === 0xd8;
        const png = buf[0] === 0x89 && buf[1] === 0x50;
        if (!jpeg && !png) {
          throw new Error(`${describe}: not an image (${buf.length} bytes: ${buf.slice(0, 60).toString("utf8").replace(/\s+/g, " ")})`);
        }
        fs.writeFileSync(file, buf);
        return file;
      }
      const body = await res.text().catch(() => "");
      if (attempt >= 2) {
        throw new Error(`${describe}: ${res.status} ${res.statusText} ${body.slice(0, 200)}`);
      }
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  })();
}

/* ------------------------------------------------------- Google Map Tiles */

/** Google's 2D satellite session: plain 256 px Web Mercator tiles, one image
 *  pixel per Mercator pixel. This is the provider every shipped chunk before
 *  2026-08 was built from, and its arithmetic is the reference the generalised
 *  path must reproduce bit for bit. */
export function googleProvider({ root, cacheDir, cap = 3500 }) {
  const state = { requests: 0 };
  let session = null;
  let staticFallback = false;
  let key = null;

  return {
    id: "google",
    attribution: "Imagery © Google",
    subPx: 1,
    patchSpan: () => 256,
    get requests() { return state.requests; },

    async prepare() {
      key = readEnv(root, "GOOGLE_MAPS_API_KEY");
      const sessionFile = path.join(cacheDir, "session.json");
      try {
        const c = JSON.parse(fs.readFileSync(sessionFile, "utf8"));
        if (Number(c.expiry) * 1000 > Date.now() + 600000) { session = c.session; return; }
      } catch { /* no cached session */ }
      try {
        const res = await fetch(`https://tile.googleapis.com/v1/createSession?key=${key}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mapType: "satellite", language: "en-US", region: "US" }),
        });
        if (!res.ok) throw new Error(`createSession ${res.status}: ${await res.text()}`);
        const json = await res.json();
        fs.mkdirSync(cacheDir, { recursive: true });
        fs.writeFileSync(sessionFile, JSON.stringify(json));
        session = json.session;
      } catch (err) {
        console.log(`  Map Tiles session failed (${err.message}); falling back to Static Maps`);
        staticFallback = true;
      }
    },

    /** Tiles are the lattice: patch (gx, gy) is Mercator pixels [gx*256, gy*256). */
    patchesFor(zoom, mxA, mxB, myA, myB) {
      const patches = [];
      const gx0 = Math.floor(mxA / 256), gx1 = Math.floor(mxB / 256);
      const gy0 = Math.floor(myA / 256), gy1 = Math.floor(myB / 256);
      for (let gy = gy0; gy <= gy1; gy++) {
        for (let gx = gx0; gx <= gx1; gx++) {
          patches.push({ gx, gy, mx0: gx * 256, my0: gy * 256, span: 256 });
        }
      }
      return patches;
    },

    async fetchPatch(zoom, p) {
      let url;
      if (!staticFallback) {
        url = `https://tile.googleapis.com/v1/2dtiles/${zoom}/${p.gx}/${p.gy}?session=${session}&key=${key}`;
      } else {
        /* A 256 px Static Maps image centred on the tile centre at integer
           zoom is pixel-identical to the tile, minus burned-in attribution. */
        const lat = mercYToLat((p.gy + 0.5) * 256, zoom);
        const lng = mercXToLng((p.gx + 0.5) * 256, zoom);
        url =
          `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}` +
          `&zoom=${zoom}&size=256x256&maptype=satellite&key=${key}`;
      }
      return cachedFetch({
        file: path.join(cacheDir, `z${zoom}`, `${p.gx}_${p.gy}.jpg`),
        cap, state, url, describe: `google tile ${zoom}/${p.gx}/${p.gy}`,
      });
    },
  };
}

/* ------------------------------------------------- Apple Maps Web Snapshot */

/* Apple serves no tile endpoint a third party may use. The licensed way in is
   the Maps Web Snapshot service: one signed request returns one rendered image
   of a stated centre, zoom, size and scale — which is a georeferenced patch by
   another name, because a snapshot at zoom z is rendered on exactly the same
   Web Mercator grid a tile at zoom z is.

   scale=2 is the point. Same z, twice the linear resolution: 0.125 m/px where
   Google's z19 tile gives 0.25, and 0.063 where its z20 gives 0.125.

   TWO THINGS THE SNAPSHOT SERVICE FORCES ON US, both handled here:

   1. Size caps at 640x640 POINTS, so patches are far smaller than the 255 m
      chunk grid and a chunk needs several.
   2. Every returned image carries Apple's logo and legal attribution burned
      into it. We do not remove them — we OVERLAP. Each snapshot is cropped to
      its centre and the grid steps by the cropped span, so the branded margin
      of one snapshot is covered by the clean middle of its neighbour, and no
      branded pixel is ever measured. MARGIN_PT is deliberately generous. */

const APPLE_HOST = "https://snapshot.apple-mapkit.com";
const APPLE_PATH = "/api/v1/snapshot";
const SNAP_PT = 640;    // the service maximum, in points
const MARGIN_PT = 48;   // cropped off every edge: attribution, and edge safety
const APPLE_SCALE = 2;  // the service maximum; the entire resolution win

/** ES256 over the path and query, raw r||s, base64url, no padding — the scheme
 *  Apple documents for snapshot URLs. Signing the exact string we then request
 *  is what makes the signature valid, so the query is built once and reused. */
export function signAppleSnapshot(query, privateKeyPem) {
  const message = `${APPLE_PATH}?${query}`;
  const sig = crypto
    .createSign("SHA256")
    .update(message)
    .sign({ key: privateKeyPem, dsaEncoding: "ieee-p1363" });
  const signature = sig.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return { message, signature, url: `${APPLE_HOST}${message}&signature=${signature}` };
}

/** The snapshot query for one patch, in the exact order it will be signed. */
export function appleSnapshotQuery({ lat, lng, zoom, teamId, keyId, sizePt = SNAP_PT, scale = APPLE_SCALE }) {
  const params = new URLSearchParams();
  params.set("center", `${lat.toFixed(9)},${lng.toFixed(9)}`);
  params.set("z", String(zoom));
  params.set("size", `${sizePt}x${sizePt}`);
  params.set("scale", String(scale));
  params.set("t", "satellite");
  params.set("poi", "0");
  params.set("lang", "en-US");
  params.set("teamId", teamId);
  params.set("keyId", keyId);
  return params.toString();
}

/** Load the MapKit JS credential. Key material stays in memory and is written
 *  to no output; only teamId/keyId ever appear in a URL. */
export function appleCredentials(root) {
  const teamId = readEnv(root, "APPLE_MAPKIT_TEAM_ID");
  const keyId = readEnv(root, "APPLE_MAPKIT_KEY_ID");
  let pem = readEnv(root, "APPLE_MAPKIT_PRIVATE_KEY", { required: false });
  if (pem) {
    pem = pem.replace(/\\n/g, "\n");
  } else {
    const file = readEnv(root, "APPLE_MAPKIT_KEY_FILE");
    pem = fs.readFileSync(file.replace(/^~/, process.env.HOME), "utf8");
  }
  if (!/BEGIN (EC )?PRIVATE KEY/.test(pem)) {
    throw new Error("APPLE_MAPKIT private key is not a PEM private key (expected the .p8 from developer.apple.com)");
  }
  return { teamId, keyId, pem };
}

export function appleProvider({ root, cacheDir, cap = 3500, marginPt = MARGIN_PT }) {
  const state = { requests: 0 };
  const step = SNAP_PT - 2 * marginPt;      // Mercator px per patch after the crop
  const cropPx = marginPt * APPLE_SCALE;    // image px cropped off each edge
  let cred = null;
  let sharp = null;

  if (step <= 0 || step % 2 !== 0) throw new Error(`apple: bad margin ${marginPt}pt`);

  return {
    id: "apple",
    attribution: "Imagery © Apple",
    subPx: APPLE_SCALE,
    patchSpan: () => step,
    get requests() { return state.requests; },

    async prepare() {
      cred = appleCredentials(root);
      ({ default: sharp } = await import("sharp"));
    },

    /** Patch (gx, gy) owns Mercator pixels [gx*step, gy*step) — an integer
     *  lattice, so patches composite at integer offsets like tiles do. */
    patchesFor(zoom, mxA, mxB, myA, myB) {
      const patches = [];
      const gx0 = Math.floor(mxA / step), gx1 = Math.floor(mxB / step);
      const gy0 = Math.floor(myA / step), gy1 = Math.floor(myB / step);
      for (let gy = gy0; gy <= gy1; gy++) {
        for (let gx = gx0; gx <= gx1; gx++) {
          patches.push({ gx, gy, mx0: gx * step, my0: gy * step, span: step });
        }
      }
      return patches;
    },

    async fetchPatch(zoom, p) {
      const out = path.join(cacheDir, `z${zoom}`, `${p.gx}_${p.gy}.jpg`);
      if (fs.existsSync(out)) return out;

      /* The snapshot is centred on the patch centre, so the crop is symmetric
         and the kept region is exactly the patch. */
      const cx = p.mx0 + step / 2;
      const cy = p.my0 + step / 2;
      const query = appleSnapshotQuery({
        lat: mercYToLat(cy, zoom), lng: mercXToLng(cx, zoom),
        zoom, teamId: cred.teamId, keyId: cred.keyId,
      });
      const { url } = signAppleSnapshot(query, cred.pem);

      const raw = path.join(cacheDir, `z${zoom}`, `${p.gx}_${p.gy}.raw.jpg`);
      await cachedFetch({
        file: raw, cap, state, url,
        describe: `apple snapshot ${zoom}/${p.gx},${p.gy}`,
      });

      const meta = await sharp(raw).metadata();
      const want = SNAP_PT * APPLE_SCALE;
      if (meta.width !== want || meta.height !== want) {
        throw new Error(
          `apple snapshot ${zoom}/${p.gx},${p.gy}: got ${meta.width}x${meta.height}px, ` +
          `expected ${want}x${want} (size=${SNAP_PT} scale=${APPLE_SCALE}) — the service ` +
          `changed its scale semantics and every georeference here would be wrong`
        );
      }
      await sharp(raw)
        .extract({ left: cropPx, top: cropPx, width: step * APPLE_SCALE, height: step * APPLE_SCALE })
        .jpeg({ quality: 92, mozjpeg: true })
        .toFile(out);
      fs.unlinkSync(raw);
      return out;
    },
  };
}

/* --------------------------------------------------------------- registry */

export const PROVIDERS = { google: googleProvider, apple: appleProvider };

/** Where a source caches its raw imagery. One rule, used by the build and by
 *  the audit alike — two callers guessing separately is how the probe quietly
 *  refetched tiles the build already had on disk. Google keeps its historic
 *  `.cache/satellite` path so an existing cache stays valid. */
export function cacheDirFor(root, id) {
  return path.join(root, ".cache", id === "google" ? "satellite" : id);
}

export function makeProvider(id, opts) {
  const make = PROVIDERS[id];
  if (!make) throw new Error(`unknown imagery source "${id}" (have: ${Object.keys(PROVIDERS).join(", ")})`);
  return make(opts);
}

export const APPLE_CONSTANTS = { SNAP_PT, MARGIN_PT, APPLE_SCALE, APPLE_HOST, APPLE_PATH };
