/* The ONE definition of "how tall is this roof".
 *
 * WHY THIS FILE EXISTS
 * Every gauntlet agent that verified a building wrote its own probe script and
 * reimplemented this rule by hand. On 2026-08-05 an audit of `.cache/` found 37
 * such copies and **25 of them were missing a rule** — they carried the canopy
 * guard and dropped the thin-shelf branch, so they reported the top of a
 * building's mechanical plant as its roof. The error only ever runs one way:
 * probe-verified heights come out TALL.
 *
 * One probe's header comment claimed "same roofOf tree-guard as
 * build-campus-lidar.mjs". It was not, and the claim was believed — nine heights
 * were pinned as overrides on the strength of it before the divergence was
 * found. osm:453 was 3.7 m too tall in the shipped campus for a day.
 *
 * So: import from here. Do not retype it. A rule that lives in one place can be
 * fixed in one place, and `tests/roof-measure.test.mjs` pins the three-way
 * behaviour so a future edit cannot quietly drop a branch again.
 */

export function percentile(values, q) {
  if (!values.length) return null;
  const sorted = Float64Array.from(values).sort();
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
}

/* Largest share of returns falling inside any 2 m band above `base`. A real roof
   plane is dense and flat; plant, parapets and canopy are sparse and spread. */
export function denseBandFraction(roofs, base) {
  const hist = new Map();
  for (const z of roofs) {
    const bin = Math.floor(z - base);
    hist.set(bin, (hist.get(bin) || 0) + 1);
  }
  const keys = [...hist.keys()].sort((a, b) => a - b);
  let best = 0;
  for (let i = 0; i < keys.length; i++) {
    let n = 0;
    for (let j = i; j < keys.length && keys[j] - keys[i] <= 1; j++) {
      n += hist.get(keys[j]);
      if (n > best) best = n;
    }
  }
  return best / roofs.length;
}

export const CANOPY_GAP = 5;      // p98-p75 above this is tree crown, not roof
export const SHELF_GAP = 2;       // a shelf worth discounting is > half a storey
export const SHELF_BODY = 2;      // ...over a body this tight
export const SHELF_DENSITY = 0.85;

/* THREE rules, in order. Dropping any one of them changes what the campus looks
   like; the second is the one every hand-copy forgot.
 *
 *   1. canopy guard — p98 far above p75 means the laser caught tree crowns
 *      overhanging the footprint. The one-storey Student Center measured 23.5 m
 *      this way. Take the roof plane.
 *   2. thin shelf   — a tight dense body under a narrow spike whose gap is too
 *      small to trip rule 1. That spike is mechanical plant, a stair head or a
 *      parapet. Take the body.
 *   3. otherwise the 98th percentile IS the roof.
 *
 * Pass `base` (rim-median ground) whenever you have it. Without it rule 2 cannot
 * evaluate and you silently get the old two-rule behaviour — which is exactly
 * the bug this module exists to prevent, so it is worth being deliberate about.
 */
export function roofOf(roofs, base = null) {
  const p50 = percentile(roofs, 0.5);
  const p75 = percentile(roofs, 0.75);
  const p98 = percentile(roofs, 0.98);
  if (p98 - p75 > CANOPY_GAP) return p75;
  if (
    base !== null &&
    p75 - p50 <= SHELF_BODY &&
    p98 - p75 > SHELF_GAP &&
    denseBandFraction(roofs, base) >= SHELF_DENSITY
  ) {
    return p75; // thin shelf over a dense body
  }
  return p98;
}

/* Which rule fired, and why — for probes and audits that must SHOW their
   reasoning rather than emit a bare number. */
export function explainRoof(roofs, base = null) {
  const p50 = percentile(roofs, 0.5);
  const p75 = percentile(roofs, 0.75);
  const p98 = percentile(roofs, 0.98);
  const dense = base === null ? null : denseBandFraction(roofs, base);
  if (p98 - p75 > CANOPY_GAP) {
    return { height: p75, rule: "canopy-guard", p50, p75, p98, dense,
      why: `p98-p75 = ${(p98 - p75).toFixed(1)} m > ${CANOPY_GAP} — crown overhang, take the roof plane` };
  }
  if (base !== null && p75 - p50 <= SHELF_BODY && p98 - p75 > SHELF_GAP && dense >= SHELF_DENSITY) {
    return { height: p75, rule: "thin-shelf", p50, p75, p98, dense,
      why: `body tight (p75-p50 = ${(p75 - p50).toFixed(1)}), shelf ${(p98 - p75).toFixed(1)} m above it, ${(dense * 100).toFixed(1)}% in a 2 m band — plant, not building` };
  }
  return { height: p98, rule: "p98", p50, p75, p98, dense,
    why: base === null ? "p98 — NO BASE GIVEN, so the thin-shelf rule could not be evaluated" : "no guard fired; p98 is the roof" };
}
