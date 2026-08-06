/* Reading a STEPPED roof: how many levels, and how tall is each.
 *
 * ⚠️ NOT WIRED INTO THE BUILDER, AND ITS PREMISE DID NOT SURVIVE MEASUREMENT.
 *
 * This module was written to retire the ~280 unnamed rings the statistical gate
 * rejects on spread, on the loop's stated understanding that those are "the
 * stepped and multi-plane roofs — a photograph resolves in seconds whether this
 * is one building with a tall parapet or two levels."
 *
 * That understanding is wrong, and the measurement is in
 * `tests/multi-plane.test.mjs`. The gate's spread criterion never fires on a
 * discrete step, at ANY split:
 *
 *     two levels 7/14 m, upper share  5% → 0.06   (canopy guard takes the body)
 *     ...                            50% → 0.11
 *     four decks at 4/6/8/10 m           → 0.22
 *     a ramp from 3 to 12 m              → 2.07   REJECTED
 *     a body with a smeared tail         → 3.07   REJECTED
 *
 * Only CONTINUOUS distributions reach 1.2. So the rings still on guesses are
 * not roofs waiting for someone to count their levels — they are rings whose
 * returns form a continuum: sloped surfaces, or roof mixed with canopy and
 * ground. Counting levels is the wrong question to ask them, and wiring this in
 * would retire a class by answering a question they are not posing.
 *
 * The module is kept because the finding is worth keeping and the rule is sound
 * for the shape it does describe. Before it is used for anything, someone has to
 * measure what the rejected rings actually look like — real point clouds, not
 * the synthetic shapes above — and that needs diagnostics in the builder.
 *
 * WHY THIS FILE EXISTS
 * `roof-measure.mjs` answers "how tall is this roof" for a building that has
 * one. It is deliberately single-valued, and its guards exist to throw away
 * things that are not the roof plane — tree crowns, mechanical plant, parapets.
 *
 * That is the wrong question for 280 of the campus's unnamed rings. They are
 * genuinely stepped: a two-storey wing joined to a four-storey block, a podium
 * under a tower, a terraced hillside estate. The statistical admission gate
 * refuses them all on one criterion — spread > 1.2 m — because it is asking
 * whether the returns describe ONE plane, and the honest answer is no.
 *
 * The numbers that forced this module (measured 2026-08-05):
 *
 *   06:05–11:39   agents retiring rings one at a time      +104 across 16 shards
 *   16:49         the single-plane gate, by rule           +331 in one commit
 *   17:22–18:01   agents on the stepped residue             +1 across 3 shards
 *
 * A rate of one ring per three shards does not finish. The first gate worked
 * because it retired a CLASS; this is the second class, and it needs its own
 * rule rather than 280 hand judgements.
 *
 * WHAT THIS IS NOT
 * It does not decide whether a stepped ring should ship. It reports the levels
 * it can defend and says how confident it is; admission stays with the builder,
 * and `OSM_WITHHELD` still outranks it — a judge who looked at imagery and said
 * no is not overruled by a histogram.
 *
 * Every threshold here is stated as what it means physically. None is tuned
 * yet: tuning needs the real point clouds and the 77 hand-withheld rings as
 * labeled negatives, exactly as the single-plane gate was tuned. Until that
 * pass runs, `confident` is deliberately conservative and the module is not
 * wired into the builder.
 */

import { explainRoof } from "./roof-measure.mjs";

/* Half a metre: finer than this and a flat roof's own noise splits into two
   bins; coarser and a real 1.5 m step between a parapet and a deck disappears. */
export const BIN_M = 0.5;
/* A level nobody could point at is not a level. Below this share of returns a
   peak is plant, a stair head, or the edge of the neighbouring building. */
export const MIN_LEVEL_SHARE = 0.2;
/* Two planes closer than this are one plane with a parapet — that case belongs
   to the thin-shelf rule in roof-measure.mjs, not here. */
export const MIN_STEP_M = 2;
/* What the named levels must account for between them before the reading is
   allowed to call itself an explanation of the roof. */
export const MIN_EXPLAINED = 0.7;
/* A level's own flatness, measured on the RAW returns: this share of the returns
   near a level must sit within TIGHT_M of it. Bin counts cannot answer this —
   a genuinely flat deck with ±0.12 m of laser noise straddles a bin boundary
   about half the time, so a bin-ratio scores it 0.50 and calls a real roof a
   slope. Measure the metres, not the buckets. */
export const MIN_PEAK_TIGHTNESS = 0.8;
export const TIGHT_M = 0.5;   // within this of the level is "on" it
export const NEAR_M = 1.5;    // the neighbourhood a level is judged against

/* Returns per BIN_M band above `base`, as a dense array from the lowest
   occupied bin upward. */
function histogram(roofs, base) {
  const bins = new Map();
  for (const z of roofs) {
    const b = Math.floor((z - base) / BIN_M);
    bins.set(b, (bins.get(b) || 0) + 1);
  }
  const keys = [...bins.keys()].sort((a, b) => a - b);
  if (!keys.length) return { lo: 0, counts: [] };
  const lo = keys[0], hi = keys[keys.length - 1];
  const counts = new Array(hi - lo + 1).fill(0);
  for (const [b, n] of bins) counts[b - lo] = n;
  return { lo, counts };
}

/* Peaks that dominate their own neighbourhood, strongest first. A "peak" here
   is a bin at least as tall as both neighbours; ties resolve to the lower bin so
   a flat-topped pair does not report twice. */
function peaksOf(counts) {
  const out = [];
  for (let i = 0; i < counts.length; i++) {
    const left = i > 0 ? counts[i - 1] : -1;
    const right = i < counts.length - 1 ? counts[i + 1] : -1;
    if (counts[i] > 0 && counts[i] >= left && counts[i] > right) out.push(i);
  }
  return out.sort((a, b) => counts[b] - counts[a]);
}

/**
 * Read a roof as a stack of levels.
 *
 * `roofs` are roof-classified return elevations; `base` is the rim-median
 * ground the builder measures heights against — the same base `roofOf` wants,
 * and for the same reason: without it, height above ground is not defined and
 * every number here would be an elevation pretending to be a height.
 *
 * Returns:
 *   levels     [{ h, share, tightness }] tallest first, h in metres above base
 *   confident  true only when the reading is defensible without imagery
 *   why        the sentence an audit should read instead of the numbers
 */
export function readLevels(roofs, base) {
  if (base === null || base === undefined) {
    return { levels: [], confident: false, why: "NO BASE GIVEN — height above ground is undefined, so levels cannot be read" };
  }
  if (roofs.length < 2) {
    return { levels: [], confident: false, why: `only ${roofs.length} return(s)` };
  }

  const { lo, counts } = histogram(roofs, base);
  const total = roofs.length;
  const heightOf = (i) => (lo + i + 0.5) * BIN_M;

  /* Both figures come off the raw returns rather than the bins. `share` is how
     much of the roof this level accounts for; `tightness` is how flat it is —
     of everything standing near this level, how much sits ON it. */
  const rel = roofs.map((z) => z - base);
  const candidates = peaksOf(counts).map((i) => {
    const h = heightOf(i);
    let on = 0, near = 0;
    for (const z of rel) {
      const d = Math.abs(z - h);
      if (d <= NEAR_M) { near++; if (d <= TIGHT_M) on++; }
    }
    return { i, h, share: near / total, tightness: near ? on / near : 0 };
  });

  /* Keep the strongest peak, then any other that is far enough above or below
     everything already kept. Without the separation test a broad plane reports
     as three levels half a metre apart. */
  const kept = [];
  for (const c of candidates) {
    if (c.share < MIN_LEVEL_SHARE) continue;
    if (kept.some((k) => Math.abs(k.h - c.h) < MIN_STEP_M)) continue;
    kept.push(c);
  }
  kept.sort((a, b) => b.h - a.h);

  const explained = kept.reduce((t, k) => t + k.share, 0);
  const levels = kept.map((k) => ({
    h: Math.round(k.h * 10) / 10,
    share: Math.round(k.share * 1000) / 1000,
    tightness: Math.round(k.tightness * 1000) / 1000,
  }));

  if (kept.length < 2) {
    return { levels, confident: false,
      why: `${kept.length} level(s) found — this is not a stepped roof; roofOf is the right rule for it` };
  }
  if (explained < MIN_EXPLAINED) {
    return { levels, confident: false,
      why: `${kept.length} levels explain only ${(explained * 100).toFixed(0)}% of returns — the rest is scattered, so this is canopy or noise, not steps` };
  }
  const loose = kept.filter((k) => k.tightness < MIN_PEAK_TIGHTNESS);
  if (loose.length) {
    return { levels, confident: false,
      why: `level at ${loose[0].h.toFixed(1)} m is not flat (${(loose[0].tightness * 100).toFixed(0)}% within a bin) — a slope or a dome, not a deck` };
  }

  return { levels, confident: true,
    why: `${kept.length} flat levels at ${levels.map((l) => l.h.toFixed(1)).join(" / ")} m explain ${(explained * 100).toFixed(0)}% of returns` };
}

/**
 * The single height to extrude if this ring must be one mass.
 *
 * The TALLEST defensible level, not the most populated one: a podium usually
 * carries more returns than the tower on it, and a person walking past reads
 * the building by its tallest part. Returns null when the reading is not
 * confident — better absent than wrong, and a stepped roof this rule cannot
 * explain is exactly what a person should look at.
 */
export function dominantLevel(roofs, base) {
  const r = readLevels(roofs, base);
  if (!r.confident) return null;
  return r.levels[0].h;
}

/* The single-plane spread the admission gate rejects on, so a caller can ask
   "is this ring rejected for being stepped, or for being sparse?" without
   writing a second copy of the gate's arithmetic.
 *
 * It is NOT simply p98 − p75. The gate switches which pair it measures based on
 * which rule fired: an unguarded read is one plane when its top tail is close to
 * the body, but a guarded read has already discarded its tail, so the question
 * becomes whether what REMAINS is tight. The first version of this function
 * shipped the naive difference and reported 0.11 m for a clean two-storey step —
 * it read the spread WITHIN the upper plane, because p75 and p98 both land
 * there when the levels are evenly populated. That is a second wrong copy of a
 * rule that already exists, which is the failure `roof-measure.mjs` was created
 * to end. Derive it from `explainRoof`, or do not derive it. */
export function planeSpread(roofs, base = null) {
  const e = explainRoof(roofs, base);
  return e.rule === "p98" ? e.p98 - e.p75 : e.p75 - e.p50;
}
