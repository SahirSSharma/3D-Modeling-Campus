// The imagery SOURCE layer: the arithmetic that decides where a fetched pixel
// sits on the ground, and the credential handling around it.
//
// Everything measured in this project — every polygon colour, every fitted
// painted line — is measured from imagery placed by this arithmetic. A patch
// mis-georeferenced by one pixel moves a colour sample onto its neighbour and
// nothing about the resulting file looks wrong, so these are the invariants
// worth pinning even though none of them needs the network.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  mercX, mercY, mercXToLng, mercYToLat, mPerMercPx,
  googleProvider, appleProvider, makeProvider, PROVIDERS,
  appleSnapshotQuery, signAppleSnapshot, APPLE_CONSTANTS,
} from "../scripts/lib/imagery.mjs";

const LAT = 32.878, LNG = -117.2412; // the site origin

test("Mercator round-trips at the zooms the build actually uses", () => {
  for (const zoom of [19, 20]) {
    assert.ok(Math.abs(mercXToLng(mercX(LNG, zoom), zoom) - LNG) < 1e-9);
    assert.ok(Math.abs(mercYToLat(mercY(LAT, zoom), zoom) - LAT) < 1e-9);
  }
});

test("ground scale halves with each zoom step, and matches the shipped chunks", () => {
  const z19 = mPerMercPx(19, LAT);
  const z20 = mPerMercPx(20, LAT);
  assert.ok(Math.abs(z19 / z20 - 2) < 1e-9);
  /* The README and manifest quote 0.25 / 0.125 m/px for Google at these
     zooms; if this drifts, every documented resolution is wrong. */
  assert.ok(Math.abs(z19 - 0.2508) < 0.001, `z19 was ${z19}`);
  assert.ok(Math.abs(z20 - 0.1254) < 0.001, `z20 was ${z20}`);
});

test("Google patches ARE tiles — 256 Mercator px, one image px each", () => {
  const g = googleProvider({ root: ".", cacheDir: "/tmp/none" });
  assert.equal(g.subPx, 1);
  assert.equal(g.patchSpan(), 256);
  const mx = mercX(LNG, 19), my = mercY(LAT, 19);
  for (const p of g.patchesFor(19, mx - 300, mx + 300, my - 300, my + 300)) {
    assert.equal(p.mx0 % 256, 0, "tile origin off the 256 px lattice");
    assert.equal(p.my0 % 256, 0);
    assert.equal(p.mx0, p.gx * 256);
  }
});

test("Apple patches are scale=2 — half the ground size per pixel at the same zoom", () => {
  const a = appleProvider({ root: ".", cacheDir: "/tmp/none" });
  assert.equal(a.subPx, 2, "the entire reason to prefer Apple");
  assert.equal(
    mPerMercPx(20, LAT) / a.subPx < mPerMercPx(20, LAT) / googleProvider({ root: ".", cacheDir: "/tmp/none" }).subPx,
    true,
    "Apple must deliver finer ground pixels than Google at the same zoom"
  );
});

test("Apple's crop leaves no branded pixel measurable, and still tiles the plane", () => {
  const { SNAP_PT, MARGIN_PT, APPLE_SCALE } = APPLE_CONSTANTS;
  const a = appleProvider({ root: ".", cacheDir: "/tmp/none" });
  const step = a.patchSpan();
  /* Every edge of every snapshot is discarded, so Apple's logo and legal line
     — which are burned into the returned image and must not be removed — are
     never sampled. They are covered by the clean middle of the neighbour. */
  assert.equal(step, SNAP_PT - 2 * MARGIN_PT);
  assert.ok(MARGIN_PT >= 32, "margin too thin to clear the burned-in attribution");
  assert.ok(step > 0 && step % 2 === 0);
  /* Patches must abut exactly: gaps leave unmeasured ground, overlaps in the
     LATTICE (as opposed to the discarded margins) would double-composite. */
  const mx = mercX(LNG, 20), my = mercY(LAT, 20);
  const patches = a.patchesFor(20, mx - 900, mx + 900, my - 900, my + 900);
  const xs = [...new Set(patches.map((p) => p.mx0))].sort((u, v) => u - v);
  for (let i = 1; i < xs.length; i++) assert.equal(xs[i] - xs[i - 1], step);
  for (const p of patches) {
    assert.equal(p.mx0 % step, 0, "patch off its lattice — composite offsets would be fractional");
    assert.equal(p.my0 % step, 0);
    /* The composite offset must be a whole image pixel or the mosaic shears. */
    assert.equal(((p.mx0 - xs[0]) * APPLE_SCALE) % 1, 0);
  }
});

test("a patch lattice covers every Mercator pixel a chunk can ask for", () => {
  for (const [id, span] of [["google", 256], ["apple", null]]) {
    const p = makeProvider(id, { root: ".", cacheDir: "/tmp/none" });
    const step = span ?? p.patchSpan();
    const mxA = 1000.4, mxB = 1000.4 + 3 * step + 7; // deliberately unaligned
    const got = p.patchesFor(19, mxA, mxB, 500.2, 500.2 + step + 3);
    const minX = Math.min(...got.map((q) => q.mx0));
    const maxX = Math.max(...got.map((q) => q.mx0 + q.span));
    assert.ok(minX <= mxA, `${id}: lattice starts after the window`);
    assert.ok(maxX >= mxB, `${id}: lattice ends before the window`);
  }
});

test("the Apple signature signs exactly the string that gets requested", () => {
  /* A throwaway P-256 key: this asserts the SCHEME, never a real credential. */
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" });

  const query = appleSnapshotQuery({
    lat: LAT, lng: LNG, zoom: 20, teamId: "TEAMID1234", keyId: "KEYID56789",
  });
  const { message, signature, url } = signAppleSnapshot(query, pem);

  assert.ok(message.startsWith("/api/v1/snapshot?"), message);
  assert.ok(query.includes("t=satellite"), "must ask for imagery, not the standard map");
  assert.ok(query.includes("scale=2"), "scale=2 is the resolution win");
  assert.ok(query.includes("poi=0"), "POI pins would be measured as ground colour");
  assert.ok(url.endsWith(`&signature=${signature}`));
  /* The URL requested must be the message signed plus the signature — if the
     two ever diverge Apple answers 401 and no amount of tile maths helps. */
  assert.equal(url, `${APPLE_CONSTANTS.APPLE_HOST}${message}&signature=${signature}`);

  /* base64url, unpadded, and a verifiable ES256 signature over the path. */
  assert.ok(!/[+/=]/.test(signature), `signature not base64url: ${signature}`);
  const raw = Buffer.from(signature.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  assert.equal(raw.length, 64, "ES256 must be raw r||s, not DER");
  assert.ok(
    crypto.createVerify("SHA256").update(message)
      .verify({ key: publicKey, dsaEncoding: "ieee-p1363" }, raw),
    "signature does not verify over the path+query"
  );
});

test("an unknown source is refused by name, not silently defaulted", () => {
  assert.throws(() => makeProvider("bing", { root: ".", cacheDir: "/tmp/none" }), /unknown imagery source/);
  assert.deepEqual(Object.keys(PROVIDERS).sort(), ["apple", "google"]);
});

test("every provider states its own attribution", () => {
  for (const id of Object.keys(PROVIDERS)) {
    const p = makeProvider(id, { root: ".", cacheDir: "/tmp/none" });
    assert.ok(p.attribution && /©/.test(p.attribution), `${id} has no credit line`);
    assert.equal(p.id, id);
  }
});
