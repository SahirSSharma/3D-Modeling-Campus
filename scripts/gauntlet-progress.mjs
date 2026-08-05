/* Where is the gauntlet up to?
 *
 * The loop takes hours and its state is scattered: durations in each run's
 * STATUS.md, building counts in shards.json, phase transitions in the driver
 * log, budget in .quota. This reads all of it and writes ONE file you can open
 * to see where things stand: gauntlet-loop/PROGRESS.md.
 *
 * It reports only what it can derive. Every estimate here is fitted from shards
 * that actually finished, and the fit is printed alongside its sample count so
 * an ETA built on two data points is visibly an ETA built on two data points.
 * Where nothing supports a number, it says so rather than inventing one.
 *
 *   node scripts/gauntlet-progress.mjs              # write once
 *   node scripts/gauntlet-progress.mjs --print      # also print to stdout
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOOP = path.join(ROOT, "gauntlet-loop");
const OUT = path.join(LOOP, "PROGRESS.md");
const RUNS = path.join(LOOP, "runs");
const ALL_SHARDS = ["r0c0", "r0c1", "r0c2", "r1c0", "r1c1", "r1c2", "r2c0", "r2c1", "r2c2"];

const sh = (cmd) => { try { return execSync(cmd, { cwd: ROOT, encoding: "utf8" }).trim(); } catch { return ""; } };
const read = (p) => { try { return fs.readFileSync(p, "utf8"); } catch { return ""; } };
const mtime = (p) => { try { return fs.statSync(p).mtimeMs; } catch { return null; } };

/* ------------------------------------------------------------------- render */
function bar(done, total, width = 28) {
  if (!total) return "─".repeat(width) + "  n/a";
  const frac = Math.max(0, Math.min(1, done / total));
  const full = Math.floor(frac * width);
  /* Eighth-blocks so a bar that has barely started still shows movement — at
     28 chars a whole block is 3.6% and short shards would round to nothing. */
  const part = Math.floor((frac * width - full) * 8);
  const bars = "█".repeat(full) + (part > 0 && full < width ? "▏▎▍▌▋▊▉"[part - 1] : "") ;
  return (bars + "·".repeat(Math.max(0, width - bars.length))).slice(0, width) + `  ${Math.round(frac * 100)}%`;
}
const hm = (min) => (min == null ? "—" : min >= 60 ? `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, "0")}m` : `${Math.round(min)}m`);
const clock = (ms) => new Date(ms).toLocaleTimeString("en-US", { hour12: false });

/* --------------------------------------------------------------- run states */
/* Two STATUS.md table shapes exist: the old single-agent driver wrote
   `| pass | shard | started | exit | duration | log |` and the routed driver
   writes `| pass | shard | tier | screen | h/m/l | judge | commit | duration |`.
   Both are real history and both feed the fit, so parse by column count. */
function parseStatus(dir) {
  const txt = read(path.join(dir, "STATUS.md"));
  if (!txt) return null;
  const routed = /^- screen:/m.test(txt);
  const rows = [];
  for (const line of txt.split("\n")) {
    const c = line.trim();
    if (!c.startsWith("|") || /^\|\s*-+/.test(c) || /\|\s*pass\s*\|/.test(c)) continue;
    const f = c.split("|").slice(1, -1).map((s) => s.trim());
    /* Find the duration by shape, not by column index. The old driver put it at
       index 4 with the log filename last; the routed driver puts it last. Keying
       on position silently parsed zero rows out of the old runs. */
    const dur = f.map((v) => v.match(/^(\d+)m(\d+)s$/)).find(Boolean);
    if (!dur) continue;
    rows.push({
      pass: +f[0], shard: f[1], routed, run: path.basename(dir),
      minutes: +dur[1] + +dur[2] / 60,
      tier: routed ? f[2] : null,
      counts: routed ? f[4] : null,
      judge: routed ? f[5] : (txt.match(/^- model:\s*`([^`]+)`/m)?.[1] ?? "?"),
      commit: routed ? f[6] : null,
    });
  }
  return { dir, routed, rows, txt };
}

const runDirs = fs.existsSync(RUNS)
  ? fs.readdirSync(RUNS).filter((d) => /^\d{4}-\d{2}-\d{2}_/.test(d) && !d.startsWith("dryrun-")).sort()
  : [];
const runs = runDirs.map((d) => parseStatus(path.join(RUNS, d))).filter(Boolean);
const latestDir = fs.existsSync(path.join(RUNS, "latest")) ? fs.realpathSync(path.join(RUNS, "latest")) : null;
const cur = runs.find((r) => r.dir === latestDir) ?? runs[runs.length - 1] ?? null;

/* ------------------------------------------------------------ the cost model */
const shardsJson = cur ? read(path.join(cur.dir, "shards.json")) : "";
const SHARDS = shardsJson ? JSON.parse(shardsJson) : [];
const sizeOf = Object.fromEntries(SHARDS.map((s) => [s.id, s.buildings]));

/* Duration scales with building count, so a flat per-shard average would put
   r2c1 (400 buildings) and r0c2 (62) at the same ETA. Least-squares fit instead.
   Routed shards are a different machine from single-agent ones — two agents, one
   of them cheap — so prefer routed samples once there are enough to fit, and say
   which population the numbers came from. */
const samples = runs.flatMap((r) => r.rows).filter((s) => sizeOf[s.shard]).map((s) => ({ ...s, n: sizeOf[s.shard] }));
const routedSamples = samples.filter((s) => s.routed);
const fitSet = routedSamples.length >= 3 ? routedSamples : samples;
const fitPop = routedSamples.length >= 3 ? "routed (screen+judge) shards" : "all shards, mixed single-agent and routed";

let fit = null;
if (fitSet.length >= 2) {
  const mx = fitSet.reduce((a, s) => a + s.n, 0) / fitSet.length;
  const my = fitSet.reduce((a, s) => a + s.minutes, 0) / fitSet.length;
  const sxy = fitSet.reduce((a, s) => a + (s.n - mx) * (s.minutes - my), 0);
  const sxx = fitSet.reduce((a, s) => a + (s.n - mx) ** 2, 0);
  const b = sxx ? sxy / sxx : 0;
  const a = my - b * mx;
  const resid = Math.sqrt(fitSet.reduce((t, s) => t + (s.minutes - (a + b * s.n)) ** 2, 0) / fitSet.length);
  fit = { a, b, resid, n: fitSet.length };
} else if (fitSet.length === 1) {
  fit = { a: 0, b: fitSet[0].minutes / fitSet[0].n, resid: null, n: 1 };
}
/* Clamp: a fit on few points can go negative on small shards, which would
   claim a shard finishes before it starts. */
const predict = (id) => (fit && sizeOf[id] ? Math.max(8, fit.a + fit.b * sizeOf[id]) : null);
const sweepMinutes = fit ? ALL_SHARDS.reduce((t, id) => t + (predict(id) ?? 0), 0) : null;

/* ------------------------------------------------------------- what's in flight */
/* The driver log has no timestamps, so the prompt files are the clock: the
   driver writes the screen prompt immediately before calling the screener and
   the judge prompt immediately before calling the judge. */
const driverLog = read(path.join(LOOP, "route-driver.log"));
const driverUp = sh("pgrep -f gauntlet-route.sh").length > 0;
let live = null;
if (cur) {
  const done = new Set(cur.rows.map((r) => `${r.pass}/${r.shard}`));
  const marks = [...driverLog.matchAll(/^\[route\] pass (\d+)\s+shard (\S+)\s+(screen|judge)\b/gm)]
    .map((m) => ({ pass: +m[1], shard: m[2], phase: m[3] }))
    .filter((m) => !done.has(`${m.pass}/${m.shard}`));
  const last = marks[marks.length - 1];
  if (last && driverUp) {
    const sp = mtime(path.join(cur.dir, `pass${last.pass}-${last.shard}.screen.prompt.md`));
    const jp = mtime(path.join(cur.dir, `pass${last.pass}-${last.shard}.judge.prompt.md`));
    const screenFile = read(path.join(cur.dir, `pass${last.pass}-${last.shard}.screen.json`));
    let counts = null;
    try {
      const arr = JSON.parse(screenFile);
      if (Array.isArray(arr)) {
        const c = (s) => arr.filter((x) => x.severity === s).length;
        counts = `${c("high")} high · ${c("medium")} medium · ${c("low")} low`;
      }
    } catch { /* screen not written yet, or mid-write */ }
    live = { ...last, startedAt: sp, phaseAt: last.phase === "judge" ? jp : sp, counts, est: predict(last.shard) };
  }
}

/* ----------------------------------------------------------------- the budget */
const POOL_M = 373, BUDGET_M = 190, ADJ_ASSUMED_M = 6;
const quotaRaw = read(path.join(LOOP, ".quota")).replace(/[^0-9.]/g, "");
const usedPct = quotaRaw ? +quotaRaw : null;
const leftM = usedPct == null ? null : POOL_M * (1 - usedPct / 100);
const leftBudgetPct = leftM == null ? null : Math.max(0, Math.round((leftM / BUDGET_M) * 100));

/* What a Fable adjudication actually costs.
 *
 * The router was configured with a 6M guess and nothing ever checked it. Two
 * dashboard readings bracket real work, so derive it instead: the spend between
 * readings divided by the adjudications that ran between them. Screening is
 * excluded by construction — it bills the Cursor Models pool, which this
 * percentage does not measure.
 *
 * Reported as a range because an adjudication in flight at the second reading
 * has spent an unknown fraction of itself. The high bound charges the whole
 * delta to completed work only; the low bound credits the in-flight one as half
 * done. Budget planning uses the HIGH bound — running out early is worse than
 * finishing with headroom. */
const history = read(path.join(LOOP, ".quota-history")).trim().split("\n").filter(Boolean)
  .map((l) => l.split("\t")).filter((f) => f.length >= 3)
  .map(([t, pct, adj]) => ({ t, pct: +pct, adj: +adj }));
let adjCost = null;
if (history.length >= 2) {
  const a = history[0], b = history[history.length - 1];
  const spentM = (b.pct - a.pct) / 100 * POOL_M;
  const done = b.adj - a.adj;
  if (done >= 1 && spentM > 0) {
    adjCost = { high: spentM / done, low: spentM / (done + 0.5), samples: done, spentM };
  }
}
const adjUseM = adjCost ? adjCost.high : ADJ_ASSUMED_M;
const adjLeft = leftM == null ? null : Math.floor(leftM / adjUseM);
/* When the ladder trips, in adjudications rather than percentages. */
const tripAt = (pct) => (leftM == null ? null : Math.max(0, Math.floor((leftM - BUDGET_M * pct / 100) / adjUseM)));
const tier = leftBudgetPct == null ? "?" : leftBudgetPct > 25 ? "1 — full Fable judging" : leftBudgetPct > 10 ? "2 — Fable only for high-severity shards" : "3 — Grok judges, withhold-on-doubt";

/* ----------------------------------------------------------------- pass 1 state */
/* Pass 1 is the only phase with a knowable denominator: every shard gets swept
   once. Later passes exist only until a sweep changes nothing, so their count is
   genuinely unknown and is shown as a range, not a bar. */
const pass1Done = new Set(runs.flatMap((r) => r.rows).filter((r) => r.pass === 1).map((r) => r.shard));
/* A shard can carry a completed row from an earlier run and still be in flight
   now — r1c1 was swept whole by the 14:17 pilot and is being re-swept under the
   routed design. The driver is not going to skip it, so in-flight beats
   historical credit; counting both would overstate the sweep. */
if (live) pass1Done.delete(live.shard);
const pass1Left = ALL_SHARDS.filter((s) => !pass1Done.has(s));
const pass1LeftMin = fit ? pass1Left.reduce((t, id) => t + (predict(id) ?? 0), 0) : null;

const ahead = sh("git rev-list --count origin/main..HEAD");
const headSha = sh("git rev-parse --short HEAD");
const guardArmed = fs.existsSync(path.join(LOOP, ".no-push"));
const now = Date.now();

/* ------------------------------------------------------------------ compose */
const L = [];
L.push(`# Gauntlet progress`);
L.push("");
L.push(`_Generated ${new Date(now).toLocaleString("en-US", { hour12: false })} — refreshes every 30 min while the driver is up._`);
L.push("");
L.push(`**Driver:** ${driverUp ? "🟢 running" : "⚫️ not running"}   ·   **Run:** \`${cur ? path.basename(cur.dir) : "none"}\`   ·   **HEAD:** \`${headSha}\` (${ahead || "?"} commits ahead of \`origin/main\`, unpushed)   ·   **Push guard:** ${guardArmed ? "🔒 armed" : "🔓 OFF"}`);
L.push("");

L.push(`## Pass 1 — every shard swept once`);
L.push("");
L.push("```");
L.push(`shards  ${bar(ALL_SHARDS.length - pass1Left.length, ALL_SHARDS.length)}   ${ALL_SHARDS.length - pass1Left.length}/${ALL_SHARDS.length}`);
const b1 = SHARDS.reduce((t, s) => t + s.buildings, 0);
const bDone = SHARDS.filter((s) => pass1Done.has(s.id)).reduce((t, s) => t + s.buildings, 0);
L.push(`work    ${bar(bDone, b1)}   ${bDone}/${b1} buildings`);
L.push("```");
L.push("");
L.push(pass1Left.length
  ? `Remaining: ${pass1Left.map((s) => `\`${s}\` (${sizeOf[s] ?? "?"})`).join(", ")} — **${hm(pass1LeftMin)}** at the fitted rate.`
  : `Pass 1 complete.`);
L.push("");

L.push(`## Now`);
L.push("");
if (live) {
  const shardEl = (now - live.startedAt) / 60000;
  const phaseEl = (now - live.phaseAt) / 60000;
  L.push("```");
  L.push(`pass ${live.pass}  shard ${live.shard} (${sizeOf[live.shard] ?? "?"} buildings)`);
  /* Without an estimate there is no denominator, and bar(x, x) would draw a
     confident 100% for a shard that just started. Show the clock instead. */
  L.push(live.est
    ? `elapsed ${bar(shardEl, live.est)}   ${hm(shardEl)} of ~${hm(live.est)} est`
    : `elapsed ${hm(shardEl)}   (no fitted estimate yet)`);
  L.push("```");
  L.push("");
  L.push(`- phase: **${live.phase === "screen" ? "screening (Grok, Cursor Models pool)" : "judging (Fable, Other Models pool)"}** — ${hm(phaseEl)} in this phase`);
  if (live.counts) L.push(`- screen produced: ${live.counts}`);
  L.push(`- shard started ${clock(live.startedAt)}`);
} else if (driverUp) {
  L.push(`Driver is up but between shards — no prompt file written yet for the next one.`);
} else {
  L.push(`Nothing in flight. Last driver line:`);
  L.push("");
  L.push("```");
  L.push(driverLog.trim().split("\n").slice(-3).join("\n") || "(log empty)");
  L.push("```");
}
L.push("");

L.push(`## Budget`);
L.push("");
L.push("```");
if (usedPct != null) {
  L.push(`Other Models  ${bar(usedPct, 100)}   ${usedPct}% used, ~${Math.round(leftM)}M left of ${POOL_M}M`);
  L.push(`run budget    ${bar(BUDGET_M - Math.min(BUDGET_M, leftM), BUDGET_M)}   ${leftBudgetPct}% of the ${BUDGET_M}M run budget still available`);
} else {
  L.push(`no reading in gauntlet-loop/.quota — the router is estimating instead`);
}
L.push("```");
L.push("");
L.push(`- routing tier: **${tier}**`);
if (adjCost) {
  L.push(`- a Fable adjudication measures **~${Math.round(adjCost.low)}–${Math.round(adjCost.high)}M** (${adjCost.samples} completed between readings, ${Math.round(adjCost.spentM)}M spent) — the router was configured for **${ADJ_ASSUMED_M}M**, so its own odometer is low by roughly **${(adjCost.high / ADJ_ASSUMED_M).toFixed(0)}×**`);
  L.push(`- that miscount does **not** affect routing: the router prefers the \`.quota\` reading over its estimate, so tier decisions are made on real numbers`);
} else {
  L.push(`- per-adjudication cost is still the router's **unverified ${ADJ_ASSUMED_M}M assumption** — needs two \`.quota\` readings bracketing at least one adjudication`);
}
if (adjLeft != null) L.push(`- ~**${adjLeft}** Fable adjudications left; tier 2 in **${tripAt(25)}**, tier 3 in **${tripAt(10)}**`);
L.push(`- Grok screening bills the **Cursor Models** pool, which is effectively free at this scale — the bar above is only the expensive half.`);
L.push("");
L.push(`Update it by writing the dashboard percentage into \`gauntlet-loop/.quota\`. A real reading always beats the router's own estimate.`);
L.push("");

L.push(`## Remaining work`);
L.push("");
if (fit && sweepMinutes) {
  L.push(`The driver runs the pass-1 tail, then \`--until-clean --max-passes 3\`. A clean sweep is one that changes nothing, so the true end is not knowable in advance — only bounded:`);
  L.push("");
  L.push(`| outcome | what happens | remaining | done by |`);
  L.push(`|---|---|---|---|`);
  const rows = [
    ["best", "pass-1 tail, then one sweep changes nothing", (pass1LeftMin ?? 0) + sweepMinutes],
    ["likely", "pass-1 tail, one fixing sweep, one clean sweep", (pass1LeftMin ?? 0) + 2 * sweepMinutes],
    ["worst", "pass-1 tail, then all 3 passes, never converges", (pass1LeftMin ?? 0) + 3 * sweepMinutes],
  ];
  for (const [k, why, min] of rows) {
    L.push(`| **${k}** | ${why} | ${hm(min)} | ${new Date(now + min * 60000).toLocaleString("en-US", { hour12: false, weekday: "short", hour: "2-digit", minute: "2-digit" })} |`);
  }
  L.push("");
  L.push(`One full 9-shard sweep is **${hm(sweepMinutes)}** at the fitted rate.`);
} else {
  L.push(`Not enough finished shards to fit a rate yet.`);
}
L.push("");

L.push(`## Per-shard`);
L.push("");
L.push(`| shard | buildings | pass 1 | tier | screen h/m/l | judge | commit | actual | fitted |`);
L.push(`|---|---:|---|---|---|---|---|---:|---:|`);
for (const id of ALL_SHARDS) {
  const r = runs.flatMap((x) => x.rows).filter((x) => x.pass === 1 && x.shard === id).pop();
  /* In-flight beats a historical row, and a row from an older run says so —
     "done" without provenance would hide that it was a different design. */
  const state = live && live.shard === id ? `**${live.phase}** (re-sweep)`
    : r ? (cur && r.run === path.basename(cur.dir) ? "done" : `done · ${r.run.slice(11)} run`)
    : "queued";
  L.push(`| \`${id}\` | ${sizeOf[id] ?? "?"} | ${state} | ${r?.tier ?? "—"} | ${r?.counts ?? "—"} | ${r?.judge ? `\`${r.judge}\`` : "—"} | ${r?.commit && r.commit !== "none" ? `\`${r.commit}\`` : "—"} | ${r ? hm(r.minutes) : "—"} | ${hm(predict(id))} |`);
}
L.push("");

L.push(`## How these numbers were made`);
L.push("");
if (fit) {
  L.push(`Duration is fitted against building count, least squares over **${fit.n} finished shard${fit.n === 1 ? "" : "s"}** from ${fitPop}:`);
  L.push("");
  L.push("```");
  L.push(`minutes ≈ ${fit.a.toFixed(1)} + ${fit.b.toFixed(3)} × buildings`);
  if (fit.resid != null) L.push(`typical miss: ±${fit.resid.toFixed(0)} min`);
  L.push("```");
  L.push("");
  if (fit.n < 6) L.push(`⚠️ ${fit.n} samples is a thin fit. Treat the ETAs as an order of magnitude, not a schedule — they tighten with every shard that lands.`);
} else {
  L.push(`No fit yet.`);
}
L.push("");
L.push(`Everything above is read from files the driver already writes — \`STATUS.md\`, \`shards.json\`, \`route-driver.log\`, prompt-file mtimes, \`.quota\`, and \`git\`. Nothing here is a claim the driver did not make. Where a value could not be derived it shows \`—\` rather than a guess.`);
L.push("");

const body = L.join("\n");
fs.writeFileSync(OUT, body);
if (process.argv.includes("--print")) process.stdout.write(body + "\n");
else process.stdout.write(`wrote ${path.relative(ROOT, OUT)}\n`);
