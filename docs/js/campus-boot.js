// The loading screen: two bars and nothing else.
//
// The download bar is bound DIRECTLY to bytes read off the response streams —
// no easing, no chase. It moves at exactly the pace the network delivers, and
// its numbers are the real running total against the real denominator
// (campus-walk.js revises the total upward when a gzipped body outruns its
// Content-Length, so the bar can slow but never run backwards). The build bar
// covers everything that is not the network — engine import, WebGL, terrain,
// massing — and keeps a short eased chase, because those stages are single
// synchronous blocks and a directly-bound bar would freeze and then teleport.
//
// Zero imports, deliberately. campus-world.js has a top-level await on the
// true-colour data, so anything that reaches the Three.js module graph cannot
// paint until the largest download on the page has landed — which is precisely
// the wait this screen exists to explain. index.html mounts this module first
// and pulls the engine in dynamically afterwards.

/** Ordered boot phases. The `data` phase is the download bar's territory and
    carries no weight here; the other weights are shares of the BUILD bar. */
export const BOOT_PHASES = [
  { id: "code", label: "Loading the engine", weight: 8 },
  { id: "data", label: "Downloading survey data", weight: 0 },
  { id: "gl", label: "Starting WebGL", weight: 4 },
  { id: "terrain", label: "Building the terrain", weight: 22 },
  { id: "massing", label: "Raising the buildings", weight: 22 },
  { id: "ground", label: "Laying the ground", weight: 14 },
  { id: "trees", label: "Planting the trees", weight: 12 },
  { id: "detail", label: "Fitting the details", weight: 10 },
  { id: "chrome", label: "Wiring the controls", weight: 4 },
  { id: "frame", label: "First frame", weight: 4 },
];
const BUILD_TOTAL = BOOT_PHASES.reduce((a, p) => a + p.weight, 0);

/* The class the live HUD waits on, and the one that keeps the minimap out of
   the way while the overlay is up. Both live on <body> so CSS can gate any
   piece of chrome without the modules that own it knowing this file exists. */
const LIVE_CLASS = "walk-live";
const BOOTING_CLASS = "walk-booting";

const PULL = 6.5;        // e-folds per second: the BUILD bar's chase rate
const HOLD_MS = 420;     // long enough to see both bars land on 100
const FADE_MS = 420;

const clamp01 = (n) => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Reduced motion is read once at mount rather than per frame: the query is a
   layout-adjacent call and the loop runs at display rate. */
function prefersStill() {
  try {
    return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

const mb = (n) => (n / 1e6).toFixed(2);

/**
 * Mount the loading screen and return the reporter that drives it.
 * @param {HTMLElement} [root] defaults to document.getElementById("walk-loading")
 */
export function createBootScreen(root) {
  const el = root || (typeof document !== "undefined" ? document.getElementById("walk-loading") : null);
  if (!el) return nullReporter();

  const still = prefersStill();
  const pick = (name) => el.querySelector(`[data-boot="${name}"]`);
  const nodes = {
    now: pick("now"),
    dlNums: pick("dl-nums"),
    dlTrack: pick("dl-track"),
    bdPct: pick("bd-pct"),
    bdTrack: pick("bd-track"),
    error: pick("error"),
  };

  document.body?.classList.add(BOOTING_CLASS);
  document.body?.classList.remove(LIVE_CLASS);

  let index = 0;                 // build phase currently running
  let fraction = 0;              // sub-progress inside it
  let bdTarget = 0;              // build percent, monotonic
  let bdShown = 0;               // build percent, eased toward target
  let dlLoaded = 0, dlTotal = 0; // bytes, straight off the streams
  let dlDone = false;            // latched by tick("data", 1) at stream end
  let live = true;
  let last = 0;
  let dlText = "", dlWritten = "", bdWritten = "", bdPctText = "";

  if (nodes.now) nodes.now.textContent = BOOT_PHASES[0].label;
  writeDownload();
  writeBuild(true);

  const step = (now) => {
    if (!live) return;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    /* Exponential chase for the build bar only: a 22-point phase that lands in
       one synchronous block snaps the whole way in a single frame when bound
       straight to the target, and a snapping bar looks broken even when the
       load underneath it is healthy. The download bar never comes through
       here — bytes arrive chunk by chunk and ARE the pace. */
    if (still || dt === 0) bdShown = bdTarget;
    else {
      bdShown += (bdTarget - bdShown) * (1 - Math.exp(-dt * PULL));
      if (bdTarget - bdShown < 0.05) bdShown = bdTarget;
    }
    writeBuild(false);
    requestAnimationFrame(step);
  };
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(step);

  function stop() {
    live = false;
  }

  /** The build bar's one job: never move backwards, whatever order calls arrive in. */
  function recompute() {
    let done = 0;
    for (let i = 0; i < index; i++) done += BOOT_PHASES[i].weight;
    const t = ((done + BOOT_PHASES[index].weight * fraction) / BUILD_TOTAL) * 100;
    if (t > bdTarget) bdTarget = t;
  }

  function writeDownload() {
    /* Exact pace: the fill is the byte fraction, written the moment it
       changes. dlDone forces 100 — an optional file that vanished mid-read
       leaves a sliver the visitor can do nothing about. */
    const f = dlDone ? 1 : dlTotal ? clamp01(dlLoaded / dlTotal) : 0;
    const p = (f * 100).toFixed(2);
    if (p !== dlWritten) {
      dlWritten = p;
      el.style.setProperty("--dl-p", p);
      nodes.dlTrack?.setAttribute("aria-valuenow", String(Math.round(f * 100)));
    }
    const text = dlTotal
      ? `${mb(dlDone ? dlTotal : dlLoaded)} of ${mb(dlTotal)} MB · ${Math.round(f * 100)}%`
      : "waiting for the first bytes";
    if (text !== dlText && nodes.dlNums) {
      dlText = text;
      nodes.dlNums.textContent = text;
    }
  }

  function writeBuild(force) {
    const p = bdShown.toFixed(2);
    if (force || p !== bdWritten) {
      bdWritten = p;
      el.style.setProperty("--bd-p", p);
    }
    const whole = String(Math.round(bdShown));
    if (!force && whole === bdPctText) return;
    bdPctText = whole;
    if (nodes.bdPct) nodes.bdPct.textContent = whole;
    nodes.bdTrack?.setAttribute("aria-valuenow", whole);
  }

  /* Nothing the reporter does is worth failing a boot over. */
  const guard = (fn) => (...args) => {
    try {
      return fn(...args);
    } catch {
      return undefined;
    }
  };

  const noop = () => {};

  const reporter = {
    /** Live download telemetry: bytes read so far and the honest denominator. */
    bytes: guard((loaded, total) => {
      if (Number.isFinite(loaded)) dlLoaded = Math.max(dlLoaded, loaded);
      if (Number.isFinite(total)) dlTotal = Math.max(dlTotal, total);
      writeDownload();
    }),

    phase: guard((id) => {
      const i = BOOT_PHASES.findIndex((p) => p.id === id);
      if (i < 0 || i < index) return;
      index = i;
      fraction = 0;
      recompute();
      if (nodes.now) nodes.now.textContent = BOOT_PHASES[i].label;
    }),

    tick: guard((id, f) => {
      const i = BOOT_PHASES.findIndex((p) => p.id === id);
      if (i < 0 || i < index) return;
      if (i > index) {
        index = i;
        if (nodes.now) nodes.now.textContent = BOOT_PHASES[i].label;
      }
      fraction = clamp01(f);
      /* The data phase's tick is the stream orchestrator saying it is done —
         the download bar's own 100%, independent of the build bar. */
      if (id === "data" && fraction >= 1) {
        dlDone = true;
        writeDownload();
      }
      recompute();
    }),

    /* The old screen's panel is gone; these stay callable so existing call
       sites (campus-walk's manifest log, the dormant scooter boot) cost
       nothing to keep. */
    fact: noop,
    facts: noop,
    log: noop,
    outline: noop,

    /** Resolves once the browser has actually put the last write on screen. */
    paint: guard(() => {
      if (typeof requestAnimationFrame !== "function") return Promise.resolve();
      /* A backgrounded tab never fires rAF, and boot() awaits this between
         every geometry stage — without the timer, minimising the window
         during a load would stall the build for good. */
      return Promise.race([
        new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
        sleep(250),
      ]);
    }),

    finish: guard(async () => {
      index = BOOT_PHASES.length - 1;
      fraction = 1;
      bdTarget = 100;
      dlDone = true;
      writeDownload();
      if (nodes.now) nodes.now.textContent = "Ready";
      if (still) {
        bdShown = 100;
        writeBuild(true);
      } else {
        /* Wait for the eased bar to actually arrive, capped: a true 100% is
           the point, but not at the cost of holding the campus hostage. */
        const until = performance.now() + 700;
        while (bdShown < 99.95 && performance.now() < until) await reporter.paint();
        bdShown = 100;
        writeBuild(true);
      }
      await sleep(HOLD_MS);
      stop();
      document.body?.classList.add(LIVE_CLASS);
      document.body?.classList.remove(BOOTING_CLASS);
      el.classList.add("is-gone");
      await sleep(still ? 140 : FADE_MS);
      el.hidden = true;               // out of the layout and out of hit-testing
    }),

    fail: guard((message) => {
      writeBuild(true);
      stop();
      el.classList.add("is-failed");
      /* The HUD stays gated: revealing live chrome over a scene that never
         started is how a hard failure ends up looking like a slow load. */
      if (nodes.now) nodes.now.textContent = "Stopped";
      if (nodes.error) {
        nodes.error.textContent = String(message ?? "Something went wrong.");
        nodes.error.hidden = false;
      }
    }),
  };

  return reporter;
}

/** Every reporter method, all no-ops, so boot() can run headless. paint() resolves. */
export function nullReporter() {
  const noop = () => {};
  return {
    bytes: noop,
    phase: noop,
    tick: noop,
    fact: noop,
    facts: noop,
    log: noop,
    outline: noop,
    paint: () => Promise.resolve(),
    finish: () => Promise.resolve(),
    fail: noop,
  };
}
