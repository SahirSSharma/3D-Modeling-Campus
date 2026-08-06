/* Shared identity match for OSM ↔ facilities twin detection.
 *
 * Case-fold alone caught One Miramar ("building 3" vs "Building 3"). It
 * cannot see Canyonview Rec/Athletics vs Canyonview Recreation & Athletics
 * — punctuation and a facilities abbreviation of the same word. When both
 * centroids miss each other's rings (offset footprints at ~97% mutual
 * coverage), the carrier test needs this match or both sources extrude.
 *
 * Rules, deliberately narrow:
 *   1. case-insensitive exact string
 *   2. token equality after stripping non-alphanumerics to spaces and
 *      expanding a short abbreviation table (rec → recreation, …)
 *
 * Stop-words are NOT dropped: "Humanities and Social Sciences" (GIS L2
 * wing) must not equal "Humanities & Social Sciences" (OSM tower) just
 * because "&" and "and" cancel. Those already resolve via centroid
 * containment; this helper's job is the abbreviation / punctuation class.
 */

const ABBREV = {
  rec: "recreation",
  admin: "administration",
  bldg: "building",
  bld: "building",
  ctr: "center",
  apt: "apartment",
  apts: "apartments",
};

export function nameTokens(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => ABBREV[t] || t);
}

export function namesMatch(a, b) {
  if (!a || !b) return false;
  if (a.toLowerCase() === b.toLowerCase()) return true;
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  return ta.length === tb.length && ta.every((t, i) => t === tb[i]);
}
