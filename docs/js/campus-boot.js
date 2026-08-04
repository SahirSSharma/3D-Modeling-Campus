// The loading screen: the instrument checking itself before it starts.
//
// Zero imports, deliberately. campus-world.js has a top-level await on the
// true-colour data, so anything that reaches the Three.js module graph cannot
// paint until the largest download on the page has landed — which is precisely
// the wait this screen exists to explain. index.html mounts this module first
// and pulls the engine in dynamically afterwards.
//
// Every DOM write happens inside one requestAnimationFrame loop. The geometry
// stages are long synchronous blocks (1,800 building masses do not yield), and
// an earlier version that wrote straight from the reporter queued its paints
// behind them: the bar stood still and then jumped from 6% to 62% in a single
// frame, which reads as a hang followed by a glitch rather than as progress.

/** Ordered boot phases. Weights sum to 100 and are shares of the wait, not of
    the work: the survey download dominates a cold load, which is why a third
    of the bar sits in one phase that draws nothing. */
export const BOOT_PHASES = [
  { id: "code", label: "Loading the engine", weight: 6 },
  { id: "data", label: "Downloading survey data", weight: 34 },
  { id: "gl", label: "Starting WebGL", weight: 3 },
  { id: "terrain", label: "Building the terrain", weight: 15 },
  { id: "massing", label: "Raising the buildings", weight: 15 },
  { id: "ground", label: "Laying the ground", weight: 8 },
  { id: "trees", label: "Planting the trees", weight: 7 },
  { id: "detail", label: "Fitting the details", weight: 6 },
  { id: "chrome", label: "Wiring the controls", weight: 3 },
  { id: "frame", label: "First frame", weight: 3 },
];

/* The class the live HUD waits on, and the one that keeps the minimap out of
   the way while the overlay is up. Both live on <body> so CSS can gate any
   piece of chrome without the modules that own it knowing this file exists. */
const LIVE_CLASS = "walk-live";
const BOOTING_CLASS = "walk-booting";

const PULL = 6.5;        // e-folds per second: the bar's chase rate
const ODOMETER_MS = 450;
const TRACE_MS = 1500;
const LOG_LINES = 40;
const HOLD_MS = 560;     // long enough to read the finished telemetry, short enough not to annoy
const FADE_MS = 420;

const clamp01 = (n) => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const easeOut = (t) => 1 - (1 - t) * (1 - t) * (1 - t);

/* Reduced motion is read once at mount rather than per frame: the query is a
   layout-adjacent call and the loop runs at display rate. */
function prefersStill() {
  try {
    return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** Thousands separators and a sensible number of decimals for a live count. */
function format(n, dp) {
  try {
    return n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
  } catch {
    return String(dp ? n.toFixed(dp) : Math.round(n));
  }
}

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
    pct: pick("pct"),
    track: pick("track"),
    segments: pick("segments"),
    phases: pick("phases"),
    facts: pick("facts"),
    log: pick("log"),
    outline: pick("outline"),
    error: pick("error"),
  };

  const rows = buildPhaseList(nodes.phases, nodes.segments);
  document.body?.classList.add(BOOTING_CLASS);
  document.body?.classList.remove(LIVE_CLASS);

  let index = 0;                 // phase currently running
  let fraction = 0;              // sub-progress inside it
  let target = 0;                // percent, monotonic
  let shown = 0;                 // percent, eased toward target
  let painted = -1;              // last integer written, to skip redundant writes
  let written = "";              // last value handed to CSS
  let live = true;
  let last = 0;
  const facts = new Map();
  const trace = { pts: null, at: 0, drawn: -1 };

  if (nodes.now) nodes.now.textContent = BOOT_PHASES[0].label;
  markPhases(rows, 0);
  write(true);

  const step = (now) => {
    if (!live) return;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;

    /* Exponential chase rather than a width transition: a 15-point phase that
       lands in one synchronous block snaps the whole way in a single frame
       when the value is bound straight to the target, and a snapping bar looks
       broken even when the load underneath it is healthy. */
    if (still || dt === 0) shown = target;
    else {
      shown += (target - shown) * (1 - Math.exp(-dt * PULL));
      if (target - shown < 0.05) shown = target;
    }
    write(false);
    runOdometers(now);
    drawTrace(now);
    requestAnimationFrame(step);
  };
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(step);

  function stop() {
    live = false;
  }

  /** The bar's one job: never move backwards, whatever order calls arrive in. */
  function recompute() {
    let done = 0;
    for (let i = 0; i < index; i++) done += BOOT_PHASES[i].weight;
    const t = done + BOOT_PHASES[index].weight * fraction;
    if (t > target) target = t;
  }

  function write(force) {
    /* One custom property drives the fill, the leading edge and the sweep
       together, so the three cannot disagree about where the bar has got to.
       The readout is written only when its integer changes: the bar wants
       every frame, the digits do not, and rewriting text sixty times a second
       is the one thing in here expensive enough to notice. */
    const p = shown.toFixed(2);
    if (force || p !== written) {
      written = p;
      el.style.setProperty("--boot-p", p);
    }
    const whole = Math.round(shown);
    if (!force && whole === painted) return;
    painted = whole;
    if (nodes.pct) nodes.pct.textContent = String(whole);
    nodes.track?.setAttribute("aria-valuenow", String(whole));
  }

  function runOdometers(now) {
    for (const f of facts.values()) {
      if (f.at === 0) continue;
      const t = still ? 1 : clamp01((now - f.at) / ODOMETER_MS);
      const v = f.from + (f.to - f.from) * easeOut(t);
      const text = format(v, f.dp);
      if (text !== f.text) {
        f.text = text;
        f.valueEl.textContent = text;
      }
      if (t === 1) f.at = 0;
    }
  }

  function drawTrace(now) {
    const t = trace;
    if (!t.pts || t.drawn === 1) return;
    if (!t.at) t.at = now;
    const p = still ? 1 : clamp01((now - t.at) / TRACE_MS);
    if (p - t.drawn < 0.01 && p !== 1) return;
    t.drawn = p;
    strokeOutline(nodes.outline, t.pts, easeOut(p));
  }

  /* Nothing the reporter does is worth failing a boot over. A malformed fact
     or a canvas the browser refuses to hand out a context for must cost the
     screen a detail, not the campus. */
  const guard = (fn) => (...args) => {
    try {
      return fn(...args);
    } catch {
      return undefined;
    }
  };

  const reporter = {
    phase: guard((id) => {
      const i = BOOT_PHASES.findIndex((p) => p.id === id);
      if (i < 0 || i < index) return;
      index = i;
      fraction = 0;
      recompute();
      /* Every earlier phase is complete by definition — the orchestrator is
         free to skip stages, and a skipped stage that stayed pending forever
         made the list look stuck while the bar sailed past it. */
      markPhases(rows, i);
      if (nodes.now) nodes.now.textContent = BOOT_PHASES[i].label;
    }),

    tick: guard((id, f) => {
      const i = BOOT_PHASES.findIndex((p) => p.id === id);
      if (i < 0 || i < index) return;
      if (i > index) {
        index = i;
        markPhases(rows, i);
        if (nodes.now) nodes.now.textContent = BOOT_PHASES[i].label;
      }
      fraction = clamp01(f);
      recompute();
    }),

    fact: guard((f) => {
      if (!f || f.key == null || !nodes.facts) return;
      const key = String(f.key);
      const numeric = typeof f.value === "number" && Number.isFinite(f.value);
      let cell = facts.get(key);
      if (!cell) {
        cell = makeFact(nodes.facts, key);
        facts.set(key, cell);
      }
      if (f.label != null) cell.labelEl.textContent = String(f.label);
      if (f.unit != null) cell.unitEl.textContent = String(f.unit);
      cell.unitEl.hidden = !cell.unitEl.textContent;
      if (numeric) {
        cell.dp = Number.isInteger(f.value) ? 0 : Math.abs(f.value) < 10 ? 2 : 1;
        cell.from = Number.isFinite(cell.to) ? cell.to : 0;
        cell.to = f.value;
        cell.at = performance.now();
      } else if (f.value != null) {
        cell.to = NaN;
        cell.at = 0;
        cell.text = String(f.value);
        cell.valueEl.textContent = cell.text;
      }
    }),

    facts: guard((arr) => {
      if (!Array.isArray(arr)) return;
      for (const f of arr) reporter.fact(f);
    }),

    log: guard((text) => {
      if (!nodes.log || text == null) return;
      const line = document.createElement("div");
      line.textContent = String(text);
      nodes.log.appendChild(line);
      while (nodes.log.childElementCount > LOG_LINES) nodes.log.firstElementChild.remove();
      nodes.log.scrollTop = nodes.log.scrollHeight;
    }),

    outline: guard((points) => {
      if (!nodes.outline || !Array.isArray(points)) return;
      const pts = [];
      for (const p of points) {
        /* The boundary file stores [x, z] pairs and callers hand over {x, z}
           objects; both are the same 244 surveyed corners, so take either. */
        if (Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])) pts.push([p[0], p[1]]);
        else if (p && Number.isFinite(p.x) && Number.isFinite(p.z)) pts.push([p.x, p.z]);
      }
      if (pts.length < 3) return;
      trace.pts = pts;
      trace.at = 0;
      trace.drawn = -1;
      nodes.outline.closest(".boot-plan")?.classList.add("has-outline");
    }),

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
      target = 100;
      markPhases(rows, BOOT_PHASES.length);
      if (nodes.now) nodes.now.textContent = "Ready";
      if (still) {
        shown = 100;
        write(true);
      } else {
        /* Wait for the eased bar to actually arrive, capped: a true 100% is
           the point, but not at the cost of holding the campus hostage. */
        const until = performance.now() + 700;
        while (shown < 99.95 && performance.now() < until) await reporter.paint();
        shown = 100;
        write(true);
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
      write(true);
      stop();
      el.classList.add("is-failed");
      /* The HUD stays gated: revealing live chrome over a scene that never
         started is how a hard failure ends up looking like a slow load. */
      if (nodes.now) nodes.now.textContent = "Stopped";
      if (nodes.error) {
        nodes.error.textContent = String(message ?? "Something went wrong.");
        nodes.error.hidden = false;
      }
      rows[Math.min(index, rows.length - 1)]?.li.classList.add("is-failed");
    }),
  };

  return reporter;
}

/** Every reporter method, all no-ops, so boot() can run headless. paint() resolves. */
export function nullReporter() {
  const noop = () => {};
  return {
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

/* ------------------------------------------------------------------ internals */

/** The phase checklist, and the track segments that mirror it. The segments
    carry each phase's weight as flex-grow, so the bar's own geometry says
    which stage you are in before you read a word of it. */
function buildPhaseList(listEl, segmentsEl) {
  const rows = [];
  for (const phase of BOOT_PHASES) {
    let li = null;
    if (listEl) {
      li = document.createElement("li");
      li.className = "boot-phase";
      const dot = document.createElement("i");
      dot.className = "boot-phase-dot";
      const name = document.createElement("span");
      name.className = "boot-phase-name";
      name.textContent = phase.label;
      const w = document.createElement("b");
      w.className = "boot-phase-weight";
      w.textContent = String(phase.weight).padStart(2, "0");
      li.append(dot, name, w);
      listEl.appendChild(li);
    }
    let seg = null;
    if (segmentsEl) {
      seg = document.createElement("span");
      seg.className = "boot-seg";
      seg.style.flexGrow = String(phase.weight);
      seg.title = phase.label;
      segmentsEl.appendChild(seg);
    }
    rows.push({ li, seg });
  }
  return rows;
}

function markPhases(rows, current) {
  for (let i = 0; i < rows.length; i++) {
    const done = i < current;
    const now = i === current;
    rows[i].li?.classList.toggle("is-done", done);
    rows[i].li?.classList.toggle("is-now", now);
    rows[i].seg?.classList.toggle("is-done", done);
    rows[i].seg?.classList.toggle("is-now", now);
  }
}

/** One statistic, appended. Appending to a grid never moves what is already in
    it, which is why the facts can stream in without the panel shifting. */
function makeFact(gridEl, key) {
  const wrap = document.createElement("div");
  wrap.className = "boot-fact";
  wrap.dataset.key = key;
  const labelEl = document.createElement("span");
  labelEl.className = "boot-fact-label";
  labelEl.textContent = key;
  const valueWrap = document.createElement("span");
  valueWrap.className = "boot-fact-value";
  const valueEl = document.createElement("b");
  valueEl.textContent = "—";
  const unitEl = document.createElement("i");
  unitEl.hidden = true;
  valueWrap.append(valueEl, unitEl);
  wrap.append(labelEl, valueWrap);
  gridEl.appendChild(wrap);
  return { labelEl, valueEl, unitEl, from: 0, to: NaN, at: 0, dp: 0, text: "" };
}

/** The surveyed boundary, traced to `progress`. Ghost line underneath so the
    frame is never an empty box waiting for the stroke to reach it. */
function strokeOutline(canvas, pts, progress) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = Math.min(2, devicePixelRatio || 1);
  const w = canvas.clientWidth || 220;
  const h = canvas.clientHeight || 220;
  const bw = Math.round(w * dpr);
  const bh = Math.round(h * dpr);
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, z] of pts) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (z < z0) z0 = z;
    if (z > z1) z1 = z;
  }
  const pad = 10;
  const k = Math.min((w - pad * 2) / Math.max(1, x1 - x0), (h - pad * 2) / Math.max(1, z1 - z0));
  const ox = (w - (x1 - x0) * k) / 2;
  const oz = (h - (z1 - z0) * k) / 2;
  const px = (x) => ox + (x - x0) * k;
  const pz = (z) => oz + (z - z0) * k;

  const path = (count) => {
    ctx.beginPath();
    ctx.moveTo(px(pts[0][0]), pz(pts[0][1]));
    for (let i = 1; i < count; i++) ctx.lineTo(px(pts[i][0]), pz(pts[i][1]));
  };

  ctx.lineJoin = "round";
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  path(pts.length);
  ctx.closePath();
  ctx.stroke();

  const upto = Math.max(2, Math.round(pts.length * progress));
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = "rgba(255, 198, 61, 0.9)";
  path(upto);
  if (progress >= 1) ctx.closePath();
  ctx.stroke();

  if (progress < 1) {
    ctx.fillStyle = "#ffc63d";
    ctx.beginPath();
    ctx.arc(px(pts[upto - 1][0]), pz(pts[upto - 1][1]), 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
}
