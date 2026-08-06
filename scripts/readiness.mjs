/* Is this campus worth an hour of a person's attention yet?
 *
 * WHY THIS EXISTS
 * `npm test` proves individual claims. `npm run check` proves the data
 * reproduces from its builders. `npm run verify:boot` proves the page loads and
 * the roof map has no holes. None of the three answers the question that
 * actually decides whether Sahir should open a browser and start walking:
 * **how much of what he will see is measured, and does any of it read as
 * physically wrong?**
 *
 * A campus can pass 512 tests and still be a field of invented boxes, because
 * every test pins a building someone already looked at. This gate counts the
 * ones nobody looked at, through the real render path, and refuses to hand over
 * a walkthrough that would waste the walk.
 *
 * It measures four things a screenshot cannot:
 *
 *   1. GUESS CENSUS — for every footprint that actually renders, is the height
 *      on screen a measurement or a number the builder invented? Sampled by
 *      probing the world, not by re-deriving the resolution rule in Node: the
 *      massing pipeline's suppression logic is subtle enough that a second copy
 *      of it would answer a different question than the screen does.
 *   2. TERRAIN INTERSECTION — a mass whose flat roof falls BELOW the ground at
 *      one of its own footprint corners is buried in its hill and visibly wrong
 *      from the path. Note what this is not: a footprint merely *spanning* a
 *      grade is normal — buildings have level foundations and campus is built on
 *      hills. The first version of this check gated on grade span and failed 472
 *      footprints, every one of them correct. The span is still printed, as
 *      information; only the intersection is a gate.
 *   3. FRAME RATE at eye level, at the places a walk actually starts. A campus
 *      that stutters cannot be evaluated for accuracy, because the reviewer is
 *      evaluating the stutter. Chromium's default headless GL is SwiftShader —
 *      a CPU rasteriser that reported 3.4 fps for a campus the M4 runs fine — so
 *      this launches with ANGLE/Metal and asserts the real GPU answered.
 *   4. THE FIRST FIVE BUILDINGS ANYONE CHECKS — Geisel, Argo, Blake, RIMAC and
 *      the Voigt hill, probed for a plausible standing height.
 *
 * Every threshold below is a number this repo measured, and the run prints the
 * observed value beside it. A gate whose margin you cannot see is a gate you
 * cannot trust.
 *
 * Run: node scripts/readiness.mjs [--headed] [--json]
 */
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DOCS = fileURLToPath(new URL("../docs/", import.meta.url));
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml" };

/* ---------------------------------------------------------------- gates ----
   Each is stated as "what a walker would notice", then as a number. Raising one
   to make a run pass is the same offence as widening a fit tolerance. */
const GATES = {
  /* A named building on an invented height is the worst thing here: it has a
     label, so a person reads its height as a claim. Declared post-2014
     estimates do not count — a stated estimate is a different object from an
     untagged fallback, and POST_2014_SITES exists precisely to declare them. */
  namedGuessesMax: 0,
  /* Unnamed rings that RENDER at a guess, INSIDE THE CAMPUS BOUNDARY.
   *
   * This gate used to count all 358 unnamed guesses and sit at 200. That number
   * was picked before anyone had measured what the backlog was made of, and
   * every part of it was wrong.
   *
   * Measured 2026-08-05 by instrumenting the builder to record each refusal,
   * classifying each ring against the campus boundary, and then — the step that
   * mattered — intersecting that with the rings that actually reach the screen.
   * Most of the backlog never renders: the university's GIS massing already
   * covers it, so the OSM ring is suppressed and nobody ever sees its guess.
   *
   *   358  unnamed rings render at a guess
   *   329  of those are outside the campus boundary — Golden Triangle and
   *        Sorrento Valley office blocks on Nobel Drive and Genesee Avenue that
   *        fall inside the survey box. The single largest ring in the whole
   *        backlog is on La Jolla Village Drive. No amount of work on them
   *        changes a campus walk.
   *    29  are inside the boundary. THIS is the number a walker meets, and it
   *        breaks down as:
   *           9  refused on spread alone → a photograph can settle these
   *           6  hand-withheld — a person looked and said no. Correct outcome.
   *           4  too few returns / past the survey edge / pre-dates the flight
   *           9  never reached the gate at all (under 25 returns, or no rim
   *              base). Unanswered rather than proven unanswerable.
   *
   * So the gate is 20: the nine a photograph can settle must be settled, and the
   * rest remain at a declared guess because no source this project trusts can
   * answer them. It may fall further once the nine unclassified rings are
   * diagnosed — it must never rise.
   *
   * It cannot be satisfied by loosening the builder's statistics. Raising the
   * spread cut to 2.0 readmits 14 of the 67 rings a human refused; at the
   * current cut of 1.2, six of them would already pass on statistics alone and
   * are held out only by the explicit OSM_WITHHELD list. */
  onCampusGuessesMax: 20,
  /* A roof that sits below the ground at one of its own corners. 0.5 m of slack
     because the roof map is rasterised and the terrain is sampled continuously;
     half a metre of that is sampling, and more than half a metre is a building
     buried in a hill. */
  /* How far the rendered height may drift from two agreeing measured tables
     before the census stops believing the screen shows the measurement. 1.5 m
     is generous against the 0.4 m of grade-sampling drift that motivated the
     branch (Hubbs Hall on a 9.5 m grade) and far tighter than the 7.5 m gap
     that a building rendering at its 4.5 m fallback would show. */
  tableAgreeDrift_m: 1.5,
  buriedSlack_m: 0.5,
  buriedMax: 0,
  /* On the real GPU (ANGLE/Metal). Still this machine and not necessarily his,
     but no longer a CPU rasteriser answering a question about a renderer. */
  fpsMin: 30,
  consoleErrorsMax: 0,
};

/* Where a walk actually begins, and the hill that is this project's named
   regression case. Probed for a standing height and walked for frame rate. */
const LANDMARKS = ["Geisel Library", "Argo Hall", "Blake Hall", "RIMAC Arena"];

/* Declared post-2014 estimates, read from the builder rather than restated here
   so the two cannot drift. A building on this list has no 2014 LiDAR by design;
   its height is a stated estimate, and counting it as an invented guess would
   punish the epoch rule for working. */
const BUILDER = await readFile(new URL("./build-campus-lidar.mjs", import.meta.url), "utf8");
const DECLARED_ESTIMATES = new Set(
  (() => {
    const i = BUILDER.indexOf("const POST_2014_SITES =");
    if (i < 0) throw new Error("POST_2014_SITES vanished from the builder — readiness cannot tell an estimate from a guess");
    const body = BUILDER.slice(i, BUILDER.indexOf("\n};", i));
    return [...body.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  })(),
);

const server = createServer(async (req, res) => {
  const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html";
  const file = path.join(DOCS, rel);
  if (!file.startsWith(DOCS)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404).end("not found"); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/`;

/* ANGLE/Metal, not the default SwiftShader. Measured 2026-08-05: the same campus
   reports 3.4 fps on SwiftShader and runs normally on the M4. A frame-rate gate
   run against a CPU rasteriser measures the rasteriser. */
const browser = await chromium.launch({
  headless: !process.argv.includes("--headed"),
  args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

await page.goto(base, { waitUntil: "load" });
await page.waitForFunction(() => document.body.classList.contains("walk-live"), null, { timeout: 120_000 });
await page.waitForFunction(() => !!window.__campusWalk?.probe, null, { timeout: 30_000 });

/* ------------------------------------------------------------- census ----
   Classified against the SOURCE tables rather than a reimplementation of the
   resolution rule: if the world's height under a footprint matches its measured
   number, it is measured; if it matches the untagged default the builder falls
   back to, it is a guess. Anything matching neither is reported separately and
   counted as neither — an honest "unclassified" beats a flattering bucket. */
/* If the GPU flags were ignored we are back on SwiftShader and the frame-rate
   gate is meaningless. Fail loudly rather than report a number about the wrong
   renderer. */
const renderer = await page.evaluate(() => {
  const gl = document.createElement("canvas").getContext("webgl2");
  const d = gl?.getExtension("WEBGL_debug_renderer_info");
  return gl ? gl.getParameter(d ? d.UNMASKED_RENDERER_WEBGL : gl.RENDERER) : "NO WEBGL";
});

const census = await page.evaluate(async ({ declared, TABLE_AGREE_DRIFT }) => {
  const [campus, lidar, arcgis, boundary] = await Promise.all([
    fetch("data/campus-3d.json").then((r) => r.json()),
    fetch("data/campus-lidar.json").then((r) => r.json()),
    fetch("data/campus-arcgis.json").then((r) => r.json()).catch(() => null),
    fetch("data/campus-boundary.json").then((r) => r.json()).catch(() => null),
  ]);

  /* Inside the campus boundary or not. A ring on Nobel Drive renders, and its
     height may well be wrong, but it is not what "walk the campus" means and
     counting it drowns the number that matters. Ray casting against the closed
     outer ring, same local frame, no conversion. */
  const CAMPUS_RING = boundary?.points ?? boundary?.rings?.[0] ?? null;
  const inCampus = (x, z) => {
    if (!CAMPUS_RING) return true; // no boundary: count everything rather than silently pass
    let inside = false;
    for (let i = 0, j = CAMPUS_RING.length - 1; i < CAMPUS_RING.length; j = i++) {
      const [xi, zi] = CAMPUS_RING[i], [xj, zj] = CAMPUS_RING[j];
      if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
  };
  const { pointInRings } = await import("./js/campus-terrain.js");

  /* The vertex-average of an L-shaped ring lies outside it. Walk the ring for a
     point that is genuinely inside, or the probe answers about the courtyard. */
  const centroidOf = (ring) => {
    let sx = 0, sz = 0;
    for (const [x, z] of ring) { sx += x; sz += z; }
    return [sx / ring.length, sz / ring.length];
  };
  const interiorOf = (ring, c) => {
    if (pointInRings(c[0], c[1], [ring])) return c;
    for (const [vx, vz] of ring) {
      for (const t of [0.25, 0.5, 0.75]) {
        const p = [vx + (c[0] - vx) * t, vz + (c[1] - vz) * t];
        if (pointInRings(p[0], p[1], [ring])) return p;
      }
    }
    return null;
  };

  const out = {
    named: { measured: 0, guessed: 0, estimated: 0, unclassified: 0, absent: 0, examples: [] },
    unnamed: { measured: 0, guessed: 0, estimated: 0, unclassified: 0, absent: 0, examples: [],
               onCampusGuesses: 0, offCampusGuesses: 0, onCampusIds: [] },
    boundaryFound: !!CAMPUS_RING,
    buried: { checked: 0, count: 0, worst: [] },
    grade: { checked: 0, steep: 0, worst: [] },
    unprobeable: 0,
  };

  campus.buildings.forEach((b, i) => {
    const ring = b?.p;
    if (!Array.isArray(ring) || ring.length < 3) return;
    const bucket = b.n ? out.named : out.unnamed;
    const [cx, cz] = centroidOf(ring);
    const inside = interiorOf(ring, [cx, cz]);
    if (!inside) { out.unprobeable++; return; }

    /* The mass height, derived the way the renderer derived it. campus-massing
       sets `roofY = rimMedian(ring) + m.h` — the same rim median the LiDAR
       builder subtracts when it defines h. (It used to use the centroid; on a
       grade those diverge and readiness then compared a drifted roof to a
       drifted base, laundering the error. Village West Building 2's 3 m sink
       was invisible to that census.)

       The roof plane is still read at an interior point (where the sampler can
       see the mass). The ground base is the rim median — never the centroid,
       never an interior hole-fill. */
    const at = window.__campusWalk.probe(inside[0], inside[1]);
    const rimGs = ring.map(([x, z]) => window.__campusWalk.probe(x, z).ground).filter((g) => g !== null);
    if (at.roof === null || rimGs.length < 3) { bucket.absent++; return; }
    rimGs.sort((a, c) => a - c);
    const rimMed = rimGs[Math.floor(rimGs.length / 2)];
    const rendered = at.roof - rimMed;

    /* Two sources count as measured, because the renderer accepts two: the 2014
       LiDAR plane, and the university's own GIS survey height — which outranks
       LiDAR outright when the record is newer than the flight. A census that
       only recognised LiDAR would report every GIS-surveyed building as a
       guess. */
    const fac = arcgis?.buildings?.[b.n];
    const measured = fac?.newer ? fac.height
      : (lidar.osmHeights?.[i] ?? (b.n ? lidar.heights?.[b.n] : null) ?? fac?.height ?? null);

    /* THE MASS THAT ACTUALLY RENDERS may not be the OSM ring at all. Where the
       university's GIS massing covers a footprint, the OSM ring is suppressed
       and a GIS mass is extruded in its place, measured into `massHeights` and
       keyed by its own centroid — never by the OSM name or index. 62 named
       buildings render this way.
     *
     * Leaving those out is what made this census demand a data edit it had no
     * right to. International Center West renders from mass m:225,82 at a
     * measured 8.2 m; the census compared that against a stale name-level 6.7,
     * missed, then matched the 8.4 OSM tag inside the slack and reported a
     * measured building as an invented guess. A gauntlet agent duly "fixed" it
     * by hand-pinning the name — an override added to satisfy a bug in the
     * auditor. The auditor is the thing that was wrong. */
    const nearbyMass = (() => {
      let best = null, bestD = 25; // metres; a mass further than this is a neighbour
      for (const [k, v] of Object.entries(lidar.massHeights ?? {})) {
        const m = /^m:(-?\d+),(-?\d+)$/.exec(k);
        if (!m) continue;
        const d = Math.hypot(+m[1] - cx, +m[2] - cz);
        if (d < bestD) { bestD = d; best = v; }
      }
      return best;
    })();
    /* 0.35 m of slack: the world's roof is sampled off a rasterised map and the
       mass sits on its own reconciled base, so an exact float match is not the
       right test — half a step is. */
    const near = (a, c) => a !== null && c !== null && Math.abs(a - c) < 0.35;
    if (near(rendered, measured) || near(rendered, nearbyMass)) bucket.measured++;
    else if (nearbyMass != null && near(measured, nearbyMass) && Math.abs(rendered - measured) <= TABLE_AGREE_DRIFT) {
      /* Two measured tables already agree (name-level heights / osmHeights
         and the GIS mass that actually extrudes). On a steep grade the GPU
         roof map can drift past the 0.35 m slack while the extrusion is
         correct — Hubbs Hall rendered ≈11.8 against massHeights 12.3 /
         heights 12.2 on a 9.5 m grade (r2c0 2026-08-05_165434). Trusting
         the tables when they agree is the same lesson as reading
         massHeights at all: the auditor must not invent a guess for a
         building the builders already measured. This is not a widened
         slack — rendered is simply not the only evidence once two
         independent measured sources concur. */
      bucket.measured++;
    } else if (near(rendered, b.h ?? null)) {
      if (b.n && declared.includes(b.n)) bucket.estimated++;
      else {
        bucket.guessed++;
        if (!b.n) {
          if (inCampus(cx, cz)) { out.unnamed.onCampusGuesses++; out.unnamed.onCampusIds.push(i); }
          else out.unnamed.offCampusGuesses++;
        }
        if (bucket.examples.length < 12) bucket.examples.push({ i, n: b.n || null, h: +rendered.toFixed(1) });
      }
    } else bucket.unclassified++;

    /* --- is the mass buried in its own hill? ---
       The roof is one flat plane; the ground under the ring is not. Where the
       ground rises ABOVE that plane, the building is inside the hill and reads
       as wrong from the path. Spanning grade is fine and expected; being
       swallowed by it is not. */
    const grounds = ring.map(([x, z]) => window.__campusWalk.probe(x, z).ground).filter((g) => g !== null);
    if (grounds.length >= 3) {
      const hi = Math.max(...grounds), lo = Math.min(...grounds);
      out.grade.checked++;
      if (hi - lo > 1.5) { out.grade.steep++; out.grade.worst.push({ i, n: b.n || null, span: +(hi - lo).toFixed(1) }); }
      out.buried.checked++;
      const submerged = hi - at.roof;
      if (submerged > 0.5) {
        out.buried.count++;
        out.buried.worst.push({ i, n: b.n || null, under: +submerged.toFixed(1), roof: +at.roof.toFixed(1) });
      }
    }
  });
  /* Footprint area, inside the boundary, that stands at a guess — the honest
     answer to "how much of the campus is measured", since one 900 m² block
     matters more than four 60 m² sheds. */
  const areaOf = (r) => {
    let a = 0;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
    return Math.abs(a / 2);
  };
  let campusArea = 0, guessArea = 0;
  campus.buildings.forEach((b, i) => {
    if (!b?.p || b.p.length < 3) return;
    let cx = 0, cz = 0;
    for (const [x, z] of b.p) { cx += x; cz += z; }
    cx /= b.p.length; cz /= b.p.length;
    if (!inCampus(cx, cz)) return;
    const a = areaOf(b.p);
    campusArea += a;
    if (out.unnamed.onCampusIds.includes(i)) guessArea += a;
  });
  out.unnamed.onCampusArea = Math.round(guessArea);
  out.unnamed.campusMeasuredPct = campusArea ? +(100 * (campusArea - guessArea) / campusArea).toFixed(2) : null;

  out.grade.worst.sort((a, c) => c.span - a.span);
  out.grade.worst = out.grade.worst.slice(0, 8);
  out.buried.worst.sort((a, c) => c.under - a.under);
  out.buried.worst = out.buried.worst.slice(0, 12);
  return out;
}, { declared: [...DECLARED_ESTIMATES], TABLE_AGREE_DRIFT: GATES.tableAgreeDrift_m });

/* ------------------------------------------------------------ landmarks ----
   A standing height for the buildings a reviewer checks first. Absence here is
   not a rounding problem — it means the thing he came to look at is not there. */
const landmarks = await page.evaluate((names) => {
  const places = window.__campusWalk.places();
  return names.map((n) => {
    const p = places[n];
    if (!p) return { n, found: false };
    const q = window.__campusWalk.probe(p.x, p.z);
    return { n, found: true, ground: q.ground, roof: q.roof, h: q.roof === null ? null : q.roof - q.ground };
  });
}, LANDMARKS);

/* ----------------------------------------------------------- frame rate ----
   Eye height at each landmark, two seconds of real frames each. Headless, so
   this is a floor check for stutter, never a promise about his machine. */
const fps = [];
for (const l of landmarks.filter((x) => x.found)) {
  const measured = await page.evaluate(async (name) => {
    const p = window.__campusWalk.places()[name];
    window.__campusWalk.fly(p.x, p.z, 1.7, 0, -0.05);
    await new Promise((r) => setTimeout(r, 400)); // let streaming settle
    let frames = 0;
    const t0 = performance.now();
    await new Promise((done) => {
      const tick = () => {
        frames++;
        if (performance.now() - t0 >= 2000) return done();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    return frames / ((performance.now() - t0) / 1000);
  }, l.n);
  fps.push({ n: l.n, fps: +measured.toFixed(1) });
}

await browser.close();
server.close();

/* ---------------------------------------------------------------- report ---- */
const namedTotal = census.named.measured + census.named.guessed + census.named.unclassified;
const unnamedTotal = census.unnamed.measured + census.unnamed.guessed + census.unnamed.unclassified;
const slowest = fps.length ? Math.min(...fps.map((f) => f.fps)) : 0;

const line = (ok, label, observed, gate) =>
  `${ok ? "PASS" : "FAIL"}  ${label.padEnd(34)} ${String(observed).padEnd(22)} ${gate}`;

const results = [
  { ok: census.named.guessed <= GATES.namedGuessesMax, label: "named buildings on a guess", observed: `${census.named.guessed} of ${namedTotal}`, gate: `<= ${GATES.namedGuessesMax}` },
  { ok: census.unnamed.onCampusGuesses <= GATES.onCampusGuessesMax, label: "ON-CAMPUS unnamed rings on a guess", observed: `${census.unnamed.onCampusGuesses} (+${census.unnamed.offCampusGuesses} off campus)`, gate: `<= ${GATES.onCampusGuessesMax}` },
  { ok: census.buried.count <= GATES.buriedMax, label: `masses buried > ${GATES.buriedSlack_m} m in their hill`, observed: `${census.buried.count} of ${census.buried.checked}`, gate: `<= ${GATES.buriedMax}` },
  { ok: landmarks.every((l) => l.found && l.h !== null), label: "first-check landmarks standing", observed: `${landmarks.filter((l) => l.found && l.h !== null).length} of ${LANDMARKS.length}`, gate: "all" },
  { ok: !/SwiftShader|Software/i.test(renderer), label: "measured on a real GPU", observed: renderer.slice(0, 22), gate: "not SwiftShader" },
  { ok: slowest >= GATES.fpsMin, label: "slowest eye-level frame rate", observed: `${slowest} fps`, gate: `>= ${GATES.fpsMin}` },
  { ok: errors.length <= GATES.consoleErrorsMax, label: "console errors during the walk", observed: String(errors.length), gate: `<= ${GATES.consoleErrorsMax}` },
];

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ census, landmarks, fps, errors, results }, null, 2));
} else {
  console.log("\nREADINESS — is this worth an hour of walking?\n");
  console.log(`      ${"check".padEnd(34)} ${"observed".padEnd(22)} gate`);
  for (const r of results) console.log("  " + line(r.ok, r.label, r.observed, r.gate));

  console.log(`\nheights on screen`);
  console.log(`  named    ${census.named.measured} measured · ${census.named.guessed} guessed · ${census.named.estimated} declared post-2014 estimates · ${census.named.unclassified} neither · ${census.named.absent} not extruded`);
  console.log(`  unnamed  ${census.unnamed.measured} measured · ${census.unnamed.guessed} guessed · ${census.unnamed.unclassified} neither · ${census.unnamed.absent} not extruded`);
  console.log(`           of the guesses, ${census.unnamed.onCampusGuesses} are inside the campus boundary and ${census.unnamed.offCampusGuesses} are outside it${census.boundaryFound ? "" : "  (NO BOUNDARY DATA — everything counted as campus)"}`);
  if (census.unprobeable) console.log(`  ${census.unprobeable} footprints had no interior point to probe`);
  if (census.named.examples.length) {
    console.log(`  named buildings still on their tag:`);
    for (const e of census.named.examples) console.log(`    osm:${e.i}  ${e.n} — ${e.h} m`);
  }

  console.log(`\nlandmarks`);
  for (const l of landmarks) {
    console.log(`  ${l.n.padEnd(22)} ${!l.found ? "NOT IN THE WORLD" : l.h === null ? "no roof" : `${l.h.toFixed(1)} m above its ground`}`);
  }

  console.log(`\neye-level frame rate — ${renderer}`);
  for (const f of fps) console.log(`  ${f.n.padEnd(22)} ${f.fps} fps`);

  if (census.buried.worst.length) {
    console.log(`\nmasses whose ground rises above their own roof`);
    for (const g of census.buried.worst) console.log(`  osm:${String(g.i).padEnd(6)} ${(g.n || "(unnamed)").padEnd(30)} roof ${g.roof} m, ground ${g.under} m above it`);
  }
  if (census.grade.worst.length) {
    console.log(`\nsteepest footprints — information, not a defect (${census.grade.steep} of ${census.grade.checked} span > 1.5 m)`);
    for (const g of census.grade.worst) console.log(`  osm:${String(g.i).padEnd(6)} ${(g.n || "(unnamed)").padEnd(30)} ${g.span} m`);
  }
  if (errors.length) {
    console.log(`\nconsole errors`);
    for (const e of errors.slice(0, 10)) console.log(`  ${e}`);
  }
}

const failed = results.filter((r) => !r.ok);

/* The verdict, on disk, so PROGRESS.md can report it without launching a browser
   on a 30-minute tick. Stamped, because a readiness verdict is only true of the
   commit it was measured on and a stale green is worse than no green at all. */
await writeFile(new URL("../gauntlet-loop/readiness.json", import.meta.url), JSON.stringify({
  at: new Date().toISOString(),
  head: process.env.GIT_HEAD ?? null,
  ready: failed.length === 0,
  renderer,
  /* Explicit, because PROGRESS.md reports these and parsing them back out of a
     formatted `observed` string is how a dashboard starts lying. They count
     rings that actually RENDER at a guess inside the campus boundary — not
     rings merely lacking a table entry, most of which are suppressed by the
     GIS massing and never reach the screen. */
  onCampusGuesses: census.unnamed.onCampusGuesses,
  offCampusGuesses: census.unnamed.offCampusGuesses,
  onCampusGuessArea_m2: census.unnamed.onCampusArea ?? null,
  campusMeasuredPct: census.unnamed.campusMeasuredPct ?? null,
  results: results.map((r) => ({ ok: r.ok, label: r.label, observed: r.observed, gate: r.gate })),
  namedGuesses: census.named.examples,
}, null, 2));
if (failed.length) {
  console.error(`\nNOT READY — ${failed.map((f) => f.label).join("; ")}`);
  process.exit(1);
}
console.log("\nREADY — the walkthrough is a fair test of the campus.");
