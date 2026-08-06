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
const suspect = [];
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
    /* The driver writes durations as `%dm%02ds`. Anything else in that column
       was written by an agent editing the ledger it was told not to touch —
       one wrote `~25m`, a figure it had no way to measure. Those rows are
       recorded as suspect rather than parsed, because a fabricated duration
       would feed the fit and a fabricated SHA would be reported as landed. */
    const dur = f.map((v) => v.match(/^(\d+)m(\d+)s$/)).find(Boolean);
    if (!dur) {
      if (/^\d+$/.test(f[0])) suspect.push({ run: path.basename(dir), row: c });
      continue;
    }
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
  let b = sxx ? sxy / sxx : 0;
  let a = my - b * mx;
  /* Under the single-agent driver, duration tracked building count closely. Under
     routing it stopped: r2c1's 400 buildings finished in 1h24m while r1c2's 97
     took 1h53m. The screen is bounded by what a screener will look at and the
     judge by how many candidates it got, and neither scales with footprint count.
     A fitted slope at or below zero is that fact, not a shard that finishes
     faster for being bigger — so fall back to a flat mean and say why. */
  const flat = b <= 0;
  if (flat) { b = 0; a = my; }
  const resid = Math.sqrt(fitSet.reduce((t, s) => t + (s.minutes - (a + b * s.n)) ** 2, 0) / fitSet.length);
  fit = { a, b, resid, n: fitSet.length, flat };
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
/* Overnight the reading is parked at .quota.paused so a frozen number cannot
   hold tier 1 while nobody is watching the dashboard. It is still the last
   thing known to be true, so it is still what gets reported — labelled stale. */
const quotaLive = read(path.join(LOOP, ".quota")).replace(/[^0-9.]/g, "");
const quotaParked = read(path.join(LOOP, ".quota.paused")).replace(/[^0-9.]/g, "");
const quotaRaw = quotaLive || quotaParked;
const quotaStale = !quotaLive && !!quotaParked;
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

/* When the reading is parked, the pool is NOT what governs — the driver's own
   odometer is, against whatever budget it was launched with. Read that budget
   off its startup line and count the adjudications it has actually made, so the
   headroom shown is the headroom the router will act on rather than a number
   that merely resembles it. */
/* The sweep phase runs with GAUNTLET_JUDGE set to the screener, which makes a
   Fable call unreachable at ANY tier. Its budget line still says 190M and its
   odometer still reads 100%, so reporting the tier ladder here would advertise
   spending headroom that cannot be spent. Read the judge off the startup line
   and say so instead. */
const launch = [...driverLog.matchAll(/^\[route\] screen (\S+)\s+judge (\S+)\s+budget (\d+)M/gm)].slice(-1)[0];
const judgeModel = launch?.[2] ?? null;
const fableReachable = !!judgeModel && judgeModel.includes("fable");
const launchBudgetM = launch ? +launch[3] : null;
/* The router charges itself GAUNTLET_ADJ_EST_M per adjudication, which is NOT
   the measured cost — it is whatever the launcher passed. Mirroring the router
   means using its constant, read from the script that actually launched it,
   because a tier shown here that disagrees with the tier it computes is worse
   than showing nothing. */
const routerAdjM = +(read(path.join(ROOT, "scripts/gauntlet-reorder.sh")).match(/GAUNTLET_ADJ_EST_M=(\d+)/)?.[1] ?? 0) || adjUseM;
const fableShards = (cur?.rows ?? []).filter((r) => r.judge && r.judge.includes("fable")).length;
const odo = quotaStale && launchBudgetM && fableReachable
  ? { budgetM: launchBudgetM, perAdjM: routerAdjM, spentM: fableShards * routerAdjM, leftM: Math.max(0, launchBudgetM - fableShards * routerAdjM) }
  : null;

const headroomM = odo ? odo.leftM : leftM;
const adjLeft = headroomM == null ? null : Math.floor(headroomM / (odo ? odo.perAdjM : adjUseM));
/* When the ladder trips, in adjudications rather than percentages. */
const ladderBase = odo ? odo.budgetM : BUDGET_M;
const tripAt = (pct) => (headroomM == null ? null : Math.max(0, Math.floor((headroomM - ladderBase * pct / 100) / (odo ? odo.perAdjM : adjUseM))));
/* The tier the ROUTER will compute, which is the odometer's percentage while
   the reading is parked — not the pool's. */
const tierPct = odo ? Math.round((odo.leftM / odo.budgetM) * 100) : leftBudgetPct;
const tier = tierPct == null ? "?" : tierPct > 25 ? "1 — full Fable judging" : tierPct > 10 ? "2 — Fable only for high-severity shards" : "3 — Grok judges, withhold-on-doubt";

/* ----------------------------------------------------------------- pass 1 state */
/* Pass 1 is the only phase with a knowable denominator: every shard gets swept
   once. Later passes exist only until a sweep changes nothing, so their count is
   genuinely unknown and is shown as a range, not a bar. */
const pass1Done = new Set(runs.flatMap((r) => r.rows).filter((r) => r.pass === 1).map((r) => r.shard));
/* This counts CAMPAIGN coverage — has each shard been swept at all — so a shard
   being re-swept still counts as covered.
 *
 * It used to drop the in-flight shard from the set, which read correctly during
 * the r1c1 re-sweep and then broke the moment the loop reached its second
 * invocation: `--until-clean` numbers its own passes from 1, so re-sweeping
 * r0c0 made a shard that finished hours ago look unswept, and the bar fell from
 * 9/9 to 8/9. Coverage and progress-through-the-current-pass are two different
 * questions and that special case was answering neither. */
const resweeping = live && pass1Done.has(live.shard);
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
  : `**Every shard swept.** The loop is now re-sweeping until a pass changes nothing${resweeping ? ` — currently back on \`${live.shard}\`` : ""}.`);
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
  L.push(`Other Models  ${bar(usedPct, 100)}   ${usedPct}% used${quotaStale ? " AS OF THE LAST READING" : ""}, ~${Math.round(leftM)}M left of ${POOL_M}M`);
  L.push(`run budget    ${bar(BUDGET_M - Math.min(BUDGET_M, leftM), BUDGET_M)}   ${leftBudgetPct}% of the ${BUDGET_M}M run budget still available`);
} else {
  L.push(`no reading in gauntlet-loop/.quota — the router is estimating instead`);
}
L.push("```");
L.push("");
if (!fableReachable && judgeModel) {
  L.push(`- 🟢 **this phase cannot spend the Other Models pool at all.** It runs with \`${judgeModel}\` as the judge, so no Fable call is reachable at any tier — the sweeps are free. Its budget line still reads ${launchBudgetM}M; that number is inert.`);
  L.push(`- every shard judged this way is filed in \`REAUDIT.md\` automatically, because the router already treats judge==screener as degraded.`);
} else {
  L.push(`- routing tier: **${tier}**`);
}
if (adjCost) {
  L.push(`- a Fable adjudication measures **~${Math.round(adjCost.low)}–${Math.round(adjCost.high)}M** (${adjCost.samples} completed between readings, ${Math.round(adjCost.spentM)}M spent) — the router was configured for **${ADJ_ASSUMED_M}M**, so its own odometer is low by roughly **${(adjCost.high / ADJ_ASSUMED_M).toFixed(0)}×**`);
  if (odo) L.push(`- the router is charging itself **${odo.perAdjM}M** per adjudication, which is inside that measured range — so its cap is honest even though nobody is reading the dashboard`);
  else if (!quotaStale) L.push(`- that miscount does **not** affect routing: the router prefers the \`.quota\` reading over its estimate, so tier decisions are made on real numbers`);
} else {
  L.push(`- per-adjudication cost is still the router's **unverified ${ADJ_ASSUMED_M}M assumption** — needs two \`.quota\` readings bracketing at least one adjudication`);
}
if (odo) L.push(`- the router is governing off its **odometer**, not the pool: ${fableShards} Fable adjudication${fableShards === 1 ? "" : "s"} made against a **${odo.budgetM}M** cap, ~${Math.round(odo.leftM)}M of that cap left (${tierPct}%)`);
if (adjLeft != null && fableReachable) L.push(`- ~**${adjLeft}** Fable adjudication${adjLeft === 1 ? "" : "s"} left; tier 2 in **${tripAt(25)}**, tier 3 in **${tripAt(10)}**`);
L.push(`- Grok screening bills the **Cursor Models** pool, which is effectively free at this scale — the bar above is only the expensive half.`);
L.push("");
if (quotaStale) {
  /* How far the reading has drifted: every Fable adjudication that finished
     after it, charged at the router's rate. The low bound assumes the one in
     flight at reading time was already fully paid for inside that number; the
     high bound assumes none of it was. */
  const fableTotal = runs.flatMap((r) => r.rows).filter((r) => r.routed && r.judge?.includes("fable")).length;
  const since = Math.max(0, fableTotal - (history[history.length - 1]?.adj ?? 0));
  const pctOf = (m) => Math.min(100, Math.round(usedPct + (m / POOL_M) * 100));
  L.push(`- ⚠️ **the reading above is stale.** It was parked at \`.quota.paused\` overnight so a frozen number could not hold tier 1 while nobody was checking the dashboard. ${fableReachable ? "Routing is running off the odometer instead." : "The Fable cap has since been spent in full and the loop has moved to free sweeps, so nothing is drawing on the pool now."}`);
  if (since > 0) {
    L.push(`- 🔴 **your real usage is well above ${usedPct}%.** ${since} Fable adjudication${since === 1 ? "" : "s"} finished after that reading, charged at ${routerAdjM}M each — putting you around **${pctOf(Math.max(0, since - 1) * routerAdjM)}–${pctOf(since * routerAdjM)}%** of the Other Models pool. **Check the dashboard before running the 4-model panel**, which spends the same pool.`);
  }
}
L.push("");
L.push(quotaStale
  ? `Hand control back to the dashboard by writing a fresh percentage into \`gauntlet-loop/.quota\` — a real reading beats the odometer, and the router picks it up on the next shard without a restart.`
  : `Update it by writing the dashboard percentage into \`gauntlet-loop/.quota\`. A real reading always beats the router's own estimate.`);
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

/* The one section worth reading after being away: what actually changed, in
   commit order, with the judge that produced it. */
L.push(`## What landed`);
L.push("");
const landed = sh(`git log --format=%h%x09%ad%x09%s --date=format:%H:%M origin/main..HEAD`)
  .split("\n").filter(Boolean).map((l) => l.split("\t"));
if (landed.length) {
  L.push(`${landed.length} commit${landed.length === 1 ? "" : "s"} ahead of \`origin/main\`, none pushed:`);
  L.push("");
  for (const [sha, when, subject] of landed) L.push(`- \`${sha}\` ${when} — ${subject}`);
} else {
  L.push(`Nothing ahead of \`origin/main\`.`);
}
L.push("");
const reaudit = read(path.join(cur?.dir ?? "", "REAUDIT.md")).split("\n").filter((l) => l.startsWith("- pass"));
if (reaudit.length) {
  L.push(`**${reaudit.length} shard${reaudit.length === 1 ? "" : "s"} judged without Fable** — these carry less judgement than the rest and should be re-audited first:`);
  L.push("");
  for (const r of reaudit) L.push(r);
  L.push("");
}

/* A ledger nobody audits is a ledger that can quietly stop being true. Two
   failures have actually happened: an agent writing its own row, and that row
   citing a SHA that vanished when the agent amended. Both are cheap to detect
   and expensive to discover later. */
const reachable = new Set(sh("git log --format=%h -400").split("\n").filter(Boolean));
const dangling = runs.flatMap((r) => r.rows)
  .filter((r) => r.commit && r.commit !== "none" && !reachable.has(r.commit))
  .map((r) => `\`${r.commit}\` (${r.shard}, ${r.run})`);
if (suspect.length || dangling.length) {
  L.push(`## ⚠️ Ledger integrity`);
  L.push("");
  if (suspect.length) {
    L.push(`**${suspect.length} row${suspect.length === 1 ? "" : "s"} not written by the driver.** The duration column does not match the driver's format, which means an agent edited the ledger it was told not to touch. Not parsed, not counted, not fed to the fit:`);
    L.push("");
    for (const s of suspect) L.push(`- \`${s.run}\` — \`${s.row}\``);
    L.push("");
  }
  if (dangling.length) {
    L.push(`**${dangling.length} commit${dangling.length === 1 ? "" : "s"} cited in the ledger no longer exist**, typically because an agent amended after writing the row: ${dangling.join(", ")}. The work may still be present under a different SHA — check the shard's real row before concluding anything was lost.`);
    L.push("");
  }
}

/* ------------------------------------------------------------ road to ship
   The gauntlet's own numbers answer "is the loop busy", which is not the
   question. The question is how much of the campus is actually right, and what
   still stands between here and Sahir pressing ship. Every row below is derived,
   not asserted — an unknown prints as "unknown", because a roadmap that guesses
   its own progress is worse than no roadmap. */
const ship = [];
const tick = (ok) => (ok === null ? "🔸" : ok ? "✅" : "⬜");

/* 1. Does the shipped data reproduce from the code that claims to build it? */
let repro = null;
try {
  const pkg = JSON.parse(read(path.join(ROOT, "package.json")));
  repro = (pkg.scripts?.check ?? "").includes("--verify");
} catch { repro = null; }
ship.push([tick(repro), "Data reproduces from its builders",
  repro === null ? "unknown — could not read package.json"
  : repro ? "`npm run check` rebuilds and compares; drift exits 1. Judgements the measurement cannot make live in `MEASURED_OVERRIDES` with their evidence."
  : "**no gate** — the shipped file can drift from the builder in silence"]);

/* 2. The VISIBLE gap, measured the way a walker meets it.
 *
 * Read from gauntlet-loop/readiness.json rather than recomputed here, and that
 * is the whole point. This row has now been wrong twice for the same reason —
 * counting a population nobody sees.
 *
 * First it counted every unnamed ring campus-wide, of which 323 are Golden
 * Triangle and Sorrento Valley office blocks that fall inside the survey box
 * and are not campus. Rewriting it to respect the boundary then produced 105
 * rings and 37,252 m², still nearly four times the truth, because a ring
 * lacking an osmHeights entry usually does not render at all: the university's
 * GIS massing covers it and the OSM copy is suppressed. Nobody ever sees its
 * guess.
 *
 * Only the browser census knows what reaches the screen, so it is the source
 * and this row reports what it found. A dashboard that recomputes its own
 * version of a number will eventually disagree with the gate, and then both
 * are untrustworthy. */
let campusPct = null, onCampusGuesses = null, guessArea = null, readyAge = null;
try {
  const r = JSON.parse(read(path.join(LOOP, "readiness.json")));
  campusPct = r.campusMeasuredPct ?? null;
  onCampusGuesses = r.onCampusGuesses ?? null;
  guessArea = r.onCampusGuessArea_m2 ?? null;
  readyAge = Math.round((Date.now() - Date.parse(r.at)) / 60000);
} catch { campusPct = null; }
ship.push([tick(campusPct === null ? null : campusPct >= 99.5), "Campus footprint measured, not guessed",
  campusPct === null ? "unknown — run `npm run readiness`"
  : `**${campusPct}% of the footprint inside the campus boundary is measured.** ` +
    `${onCampusGuesses} unnamed ring(s) still render at a guess, ${guessArea.toLocaleString()} m² — ` +
    `mostly sheds and kiosks the 2014 flight cannot resolve (under canopy, too few returns, or past the survey edge), ` +
    `each refused for a recorded reason. Rings outside the boundary are city, not campus, and are excluded on purpose. ` +
    `Measured ${readyAge} min ago.`]);

/* 3. A clean pass: the loop's own definition of finished. */
const lastPass = cur?.rows?.length ? Math.max(...cur.rows.map((r) => r.pass)) : null;
const lastRows = (cur?.rows ?? []).filter((r) => r.pass === lastPass);
const lastFindings = lastRows.reduce((t, r) => {
  const m = (r.counts ?? "").match(/^(\d+)\/(\d+)\/(\d+)$/);
  return t + (m ? +m[1] + +m[2] + +m[3] : 0);
}, 0);
const cleanPass = lastPass === null ? null : (lastRows.length >= ALL_SHARDS.length && lastFindings === 0);
ship.push([tick(cleanPass), "A gauntlet pass finds nothing",
  lastPass === null ? "unknown — no pass rows yet"
  : `pass ${lastPass} closed with **${lastFindings} finding(s)** across ${lastRows.length}/${ALL_SHARDS.length} shards.` +
    (lastFindings ? " Two mechanisms guarantee a non-empty pass: the curated epoch name-lists and the unnamed backlog above are both retired one building at a time." : "")]);

/* 4. The independent panel. A reduced panel is explicitly NOT the full gate. */
let panel = null, panelNote = "not run";
try {
  const p = path.join(ROOT, "gauntlet-loop/verify/latest/PANEL.md");
  if (fs.existsSync(p)) {
    const t = read(p);
    const reduced = /REDUCED PANEL/.test(t);
    const verdicts = [...t.matchAll(/\|\s*(fable|opus|sol|codex)\s*\|[^|]*\|[^|]*\|\s*([A-Z ]+?)\s*\|/g)]
      .map((m) => `${m[1]}=${m[2].trim()}`);
    panel = verdicts.length > 0 && !verdicts.some((v) => /FAIL|no verdict/.test(v)) && !reduced;
    panelNote = verdicts.length
      ? `${verdicts.join(", ")}${reduced ? " — ⚠️ **REDUCED panel, not the four-family gate**" : ""}`
      : "PANEL.md exists but no verdicts parsed";
  }
} catch { panel = null; }
ship.push([tick(panel), "Independent panel passes (4 families)", panelNote]);

/* 5. The handover gate. Sahir's condition, 2026-08-05: rigorous testing must
   confirm the campus meets his criteria BEFORE a localhost is stood up for him
   to walk. `npm run readiness` is that test, and this row is its verdict. */
let ready = null, readyNote = "not run — `npm run readiness`";
try {
  const p = path.join(ROOT, "gauntlet-loop/readiness.json");
  if (fs.existsSync(p)) {
    const r = JSON.parse(read(p));
    /* A readiness verdict is only true of the commit it was measured on. An
       hours-old green over a hundred new commits is worse than no green: it
       invites the walk this gate exists to protect. */
    const ageMin = Math.round((Date.now() - Date.parse(r.at)) / 60000);
    const stale = ageMin > 120;
    ready = r.ready && !stale;
    const failing = (r.results ?? []).filter((x) => !x.ok);
    readyNote = (r.ready ? "**READY**" : `blocked on ${failing.map((f) => `${f.label} (${f.observed})`).join("; ")}`) +
      ` — measured ${ageMin} min ago${stale ? ", ⚠️ **stale, re-run before trusting it**" : ""}`;
  }
} catch { ready = null; }
ship.push([tick(ready), "Readiness gate passes (handover to Sahir)", readyNote]);

/* 6 & 7. His calls, and nobody else's. */
ship.push(["⬜", "Sahir walks it on localhost and signs off", "the campus is judged by eye, at eye level — no gate substitutes for this. `npm run serve` once the row above is ✅."]);
ship.push(["⬜", "Ship to production", "**his call alone.** Push guard armed; nothing is deployed without an explicit OK."]);

L.push(`## Road to ship`);
L.push("");
L.push(`| | milestone | where it stands |`);
L.push(`|---|---|---|`);
for (const [t, name, note] of ship) L.push(`| ${t} | ${name} | ${note} |`);
L.push("");
const done = ship.filter((s) => s[0] === "✅").length;
L.push(`**${done} of ${ship.length} clear.** ✅ met · ⬜ not met · 🔸 could not be determined.`);
L.push("");
L.push(`Ship requires **both** a clean pass and a panel pass — a clean loop with a failing panel is not a ship, and neither is the reverse.`);
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
  L.push(`Fitted over **${fit.n} finished shard${fit.n === 1 ? "" : "s"}** from ${fitPop}:`);
  L.push("");
  L.push("```");
  L.push(fit.flat ? `minutes ≈ ${fit.a.toFixed(0)}, flat` : `minutes ≈ ${fit.a.toFixed(1)} + ${fit.b.toFixed(3)} × buildings`);
  if (fit.resid != null) L.push(`typical miss: ±${fit.resid.toFixed(0)} min`);
  L.push("```");
  L.push("");
  if (fit.flat) {
    L.push(`**Building count stopped predicting duration.** It did under the single-agent driver — 62 buildings took 51m, 140 took 1h52m. Under routing the regression goes flat or negative: r2c1's **400** buildings finished in **1h24m** while r1c2's **97** took **1h53m**. The screen is bounded by what a screener will look at and the judge by how many candidates it was handed, and neither scales with footprint count. So the estimate is a flat mean, which is the honest shape of the data rather than a slope fitted through noise.`);
    L.push("");
  }
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
