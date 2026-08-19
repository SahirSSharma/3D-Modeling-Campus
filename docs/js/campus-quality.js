// The adaptive quality controller: hold 60 fps by spending the frame budget
// where it shows least.
//
// The ladder's order is measured (perf-experiment, 2026-08-19, M4 at
// 1440x900): GTAO at full resolution costs ~10 ms — the entire gap between
// 40 and 60 fps — shadows ~5 ms, bloom ~0. So the controller degrades GTAO's
// INTERNAL resolution first (its blend upsamples, the look stays), shadow
// map size second, and pixel ratio + LOD radii last — pixel ratio is the
// only rung that softens the whole image, so it is the last resort, not
// because it is cheap (the composer now propagates it for real; the first
// measurement ran through a seam where it could not reach the passes).
// Levels are data; the dev panel and the URL can pin one.
//
// Look, not geometry — the same licence campus-postfx.js holds. The worst
// level still draws every measured entity the tiers allow; nothing here can
// move or recolour anything.

export const QUALITY_LEVELS = [
  /* 0 */ { gtao: 1.0,   shadow: 2048, pr: 1.5,  lod: 1 },
  /* 1 */ { gtao: 0.67,  shadow: 2048, pr: 1.5,  lod: 1 },
  /* 2 */ { gtao: 0.5,   shadow: 2048, pr: 1.5,  lod: 1 },
  /* 3 */ { gtao: 0.5,   shadow: 1024, pr: 1.5,  lod: 1 },
  /* 4 */ { gtao: 0.375, shadow: 1024, pr: 1.25, lod: 1 },
  /* 5 */ { gtao: 0,     shadow: 1024, pr: 1.25, lod: 0.8 },
  /* 6 */ { gtao: 0,     shadow: 512,  pr: 1.0,  lod: 0.6 },
  /* 7 */ { gtao: 0,     shadow: 512,  pr: 0.7,  lod: 0.5 },
];

/* Step down when a 2 s window averages under LOW — two rungs at once when
   it is more than 12 fps under, because a machine at 35 fps does not need
   three windows to prove it isn't marginal — and probe back up over HIGH.
   HIGH sits UNDER 60: a 60 Hz display vsync-caps fps at 60, so any higher
   threshold makes the controller one-way (it could step down but never
   recover). The guard against strobing is not the band alone: an up-step is
   a PROBE, and if the very next window lands back under LOW the retreat
   doubles the wait before the next probe (up to 2 min), so a machine that
   can almost hold a level settles instead of oscillating. */
const LOW = 55, HIGH = 58, WINDOW_S = 2, COOLDOWN_S = 3, BACKOFF_MAX_S = 120;

export function createQuality({ renderer, postfx, sun, chunks, resize }) {
  let level = 0, locked = false, paused = false;
  let acc = 0, frames = 0, cooldown = 0;
  /* upGate throttles only the next UP-probe; the retreat from a failed probe
     is always allowed after the ordinary cooldown — a growing backoff that
     also blocked stepping DOWN would pin a failed probe's level in place for
     the whole backoff (found by the perf gate: 45 fps held for 8 s). */
  let upProbe = false, upBackoff = COOLDOWN_S, upGate = 0;

  function apply(i) {
    level = Math.max(0, Math.min(QUALITY_LEVELS.length - 1, i));
    const q = QUALITY_LEVELS[level];
    postfx?.setGtaoScale(q.gtao); // 0 disables the pass
    if (sun && sun.shadow.mapSize.x !== q.shadow) {
      sun.shadow.mapSize.set(q.shadow, q.shadow);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
    const pr = Math.min(q.pr, globalThis.devicePixelRatio || 1);
    if (renderer.getPixelRatio() !== pr) { renderer.setPixelRatio(pr); resize?.(); }
    if (chunks) chunks.config.lodScale = q.lod;
  }

  function update(dt) {
    if (locked || paused) return;
    acc += dt; frames++;
    if (cooldown > 0) cooldown -= dt;
    if (upGate > 0) upGate -= dt;
    if (acc < WINDOW_S) return;
    const fps = frames / acc;
    acc = 0; frames = 0;
    if (cooldown > 0) return;
    if (fps < LOW && level < QUALITY_LEVELS.length - 1) {
      /* Far under target, take two rungs at once — a machine at 35 fps does
         not need three windows to prove it isn't marginal. A failed up-probe
         landing here doubles the wait before the next probe. */
      if (upProbe) { upBackoff = Math.min(upBackoff * 2, BACKOFF_MAX_S); upGate = upBackoff; }
      upProbe = false;
      apply(level + (fps < LOW - 12 ? 2 : 1));
      cooldown = COOLDOWN_S;
    } else if (fps >= HIGH && level > 0 && upGate <= 0) {
      upProbe = true;
      apply(level - 1);
      cooldown = COOLDOWN_S;
    } else if (upProbe) {
      /* The probe held — recovery is real; probing gets cheap again. */
      upProbe = false;
      upBackoff = COOLDOWN_S;
    }
  }

  return {
    update, apply,
    get level() { return level; },
    /* The streaming layer builds zones on the main thread; those stalls are
       construction, not machine weakness, and must not walk the ladder. */
    pause() { paused = true; },
    resume() { paused = false; acc = 0; frames = 0; },
    /* Pin a level and stop adapting — the screenshot audit runs under
       SwiftShader at 1–2 fps, and an adapting controller would photograph
       the campus at the floor level instead of the product. */
    lock(i) { locked = true; apply(i ?? 0); },
    unlock() { locked = false; },
    levels: QUALITY_LEVELS,
  };
}
