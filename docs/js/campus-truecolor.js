// The measured colour of campus, fetched once.
//
// campus-truecolor.json is 146 KB of colours sampled at build time from the
// georeferenced satellite chunks (0.125–0.25 m/px — fine enough to see one
// sidewalk and not the lawn beside it): 1,298 roofs and 4,175 ground surfaces.
// Two modules want it. campus-massing.js reads `roofs` to colour building lids,
// campus-world.js reads `surfaces` to colour paths and plazas.
//
// Both used to open it themselves, in identical top-level-await blocks, so every
// visitor downloaded the same 146 KB twice. An ES module is evaluated once no
// matter how many modules import it, so moving the fetch here makes the
// duplicate structurally impossible rather than something to remember.
//
// The two consumers keep their own key rules: the keys are geometry hashes
// recomputed from the live geometry at runtime, and the rules differ by what is
// being keyed (`m:`/`b:` for masses, `g:`/`s:` for surfaces). Keep both in sync
// with scripts/build-campus-truecolor.mjs — a stale rule simply misses and falls
// back to the NAIP colour, then the palette, which is why a data rebuild that
// moves a footprint degrades quietly instead of shipping a wrong colour.
//
// May be absent, and fetch() has no file:// under Node tests. Both cases give
// null, and every consumer treats null as "no measurement, use the fallback",
// so nothing here can break a build or a test.
export const TRUECOLOR = await (async () => {
  try {
    const r = await fetch(new URL("../data/campus-truecolor.json", import.meta.url));
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
})();
