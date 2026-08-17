// The JUDGE half of the visual audit harness. scripts/visual-audit.mjs takes
// the pictures; this decides what is wrong with them.
//
// The judging itself is done by a model looking at the images, because every
// fault class below is a question about APPEARANCE and none of them is
// computable from the geometry — a wall that stops a metre short of the ground
// is valid geometry, a correct extrusion, and passes every gate in this repo.
// So this file does the two halves a script CAN do:
//
//   brief   assemble the exact prompt one critic gets for one building —
//           the rubric, the shot list, the source photographs it must judge
//           against, and the research inventory. Printed, so the fan-out is
//           reproducible rather than improvised per session.
//   report  collate the verdicts the critics wrote back into one PASS/FAIL
//           per building, naming the failing screenshot for every defect.
//
// The critic writes <building>/verdict.json. The schema is fixed here and
// checked on read: a verdict that does not parse is a FAILED audit, never a
// pass, because "the critic said nothing" and "the critic found nothing" must
// never be the same output.
//
// Run:
//   node scripts/visual-audit-critic.mjs brief  DIR --sources DIR [--inventory FILE]
//   node scripts/visual-audit-critic.mjs report DIR [DIR...]
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

/* ------------------------------------------------------------- the rubric */

/* FIVE FAULT CLASSES, and they are the whole list — a critic that invents a
   sixth ("the sky looks flat", "I would have used warmer concrete") produces
   findings nobody can act on and drowns the ones they can. Each is written as
   what you would SEE, not as what would be wrong in the code, because the
   critic has the pictures and not the source. */
const RUBRIC = [
  {
    id: "blank-face",
    title: "Blank or unfinished face",
    test: "A facade that is flat untextured colour where the source photographs show windows, balconies, grating, panel joints or any relief. Judge every one of the eight low shots separately: a building modelled from one good elevation is right on three sides and blank on the fourth, and only the shot facing the blank side can see it.",
  },
  {
    id: "floating",
    title: "Hovering or intersecting geometry",
    test: "Anything with daylight under it that should be sitting on something — a canopy, PV array, railing, stair, planter or furniture floating clear of its roof or the ground — and the mirror fault, anything buried in or passing through the surface it should rest on. Look along the roofline in the high shots and along the ground line in the low shots; a hovering element shows as a shadow separated from its object.",
  },
  {
    id: "pattern-break",
    title: "Pattern discontinuity",
    test: "A facade pattern that does not survive a corner or a change of mass: window bands at different heights either side of an edge, a storey line that steps where the building does not, a tile that restarts mid-wall, a checkerboard that turns into a regular grid. Compare the two low shots either side of each corner.",
  },
  {
    id: "datum",
    title: "Datum mismatch",
    test: "Two things that should share a level and do not: a neighbouring wing whose floor lines miss this one's, a podium or paving that meets the wall at the wrong height, a roof deck that does not line up with its parapet, a ground plane that changes height under one building. The high shots read this best against neighbours.",
  },
  {
    id: "missing-feature",
    title: "Missed or misplaced feature",
    test: "Something the source photographs clearly show and the model does not have, or has in the wrong place, at the wrong size, or on the wrong elevation. This is the only class judged against the photographs rather than against the model's own consistency, so cite the source image by filename for every finding.",
  },
];

/* --------------------------------------------------------------- the brief */

async function brief(dir, sourcesDir, inventoryFile) {
  const manifest = JSON.parse(await readFile(path.join(dir, "manifest.json"), "utf8"));
  /* An obstructed frame is EXCLUDED, not annotated and left in the list. The
     capture harness marks a shot obstructed when it could not get the camera
     out of a neighbouring building, and such a frame is a picture of somebody
     else's wall — which reads exactly like the blank-face fault the critic is
     hunting. Handing it over with a caveat invites the one false positive this
     audit cannot afford. */
  const usable = manifest.shots.filter((s) => !s.camera?.obstructed);
  const dropped = manifest.shots.length - usable.length;
  const shots = usable.map((s) => {
    const where = s.kind === "roof" ? "straight down over the roof" : `looking from ${compass(s.azimuthDeg)} (azimuth ${s.azimuthDeg}°), ${s.kind === "high" ? "35° above, whole building" : "eye level, facade"}`;
    const moved = s.camera?.backedOff ? `, camera backed off ${s.camera.backedOff} m to clear a neighbour` : "";
    return `  ${path.join(dir, s.file)}  — ${where}${moved}`;
  }).join("\n");

  const sources = sourcesDir ? (await listImages(sourcesDir)).map((f) => `  ${path.join(sourcesDir, f)}`).join("\n") : "  (none supplied)";

  return `You are auditing the 3D model of ${manifest.query} on the UCSD campus model.
It renders as ${manifest.matched.length} named mass(es): ${manifest.matched.join(", ")}.
Captured ${manifest.stamp} in mode "${manifest.mode}", ${manifest.viewport.width}x${manifest.viewport.height}, 68° vertical FOV.

Read EVERY screenshot below with the Read tool. Do not judge from a subset — the
whole point of eight azimuths is that a fault visible from one angle is invisible
from the other seven.

SCREENSHOTS (the model under audit)${dropped ? ` — ${dropped} of ${manifest.shots.length} withheld because the camera could not be got clear of a neighbouring building; that side of this building was NOT audited and you should say so in your note rather than assume it is fine` : ""}:
${shots}

SOURCE PHOTOGRAPHS (the truth the model is meant to match):
${sources}
${inventoryFile ? `\nRESEARCH INVENTORY (measured dimensions, materials, colours, and what is already known to be unresolved):\n  ${inventoryFile}\nRead it. Where it marks something [estimated] or GAP, a mismatch there is worth reporting but is not the model being wrong about a known fact.\n` : ""}
JUDGE ONLY THESE FIVE FAULT CLASSES:
${RUBRIC.map((r, i) => `${i + 1}. ${r.title} [${r.id}]\n   ${r.test}`).join("\n")}

Do not report anything else. Lighting, tone mapping, sky, colour cast and image
sharpness are OUT OF SCOPE — these frames come from a software rasteriser and
their colour is not the site's colour. Taste is out of scope too: "I would have
done it differently" is not a defect.

Every finding needs (a) the fault class id, (b) the exact screenshot path it is
visible in, (c) where in that frame, in words a person can follow without
coordinates, and (d) for missing-feature, the source photograph filename that
proves it. A finding you cannot point at in a specific image does not go in.

Write your verdict to ${path.join(dir, "verdict.json")} in exactly this shape:

{
  "building": ${JSON.stringify(manifest.query)},
  "verdict": "PASS" | "FAIL",
  "findings": [
    { "class": "blank-face", "image": "<absolute path>", "where": "...", "source": "<source photo filename or null>", "severity": "major" | "minor", "note": "..." }
  ],
  "checked": <number of screenshots you actually opened>
}

FAIL if there is one or more "major" finding. A major finding is one a person
standing in front of the real building would notice immediately. PASS with minor
findings listed is a valid and common outcome; PASS with an empty findings list
should be rare and means you genuinely could not fault it.

Do not fix anything. Do not edit any model code. Your only output is the verdict file.`;
}

const COMPASS = { 0: "the north", 45: "the north-east", 90: "the east", 135: "the south-east", 180: "the south", 225: "the south-west", 270: "the west", 315: "the north-west" };
const compass = (az) => COMPASS[az] ?? `azimuth ${az}`;

async function listImages(dir) {
  const out = [];
  for (const f of (await readdir(dir)).sort()) {
    if (!/\.(png|jpe?g|webp)$/i.test(f)) continue;
    /* The .webp/.png pairs in the cached sets are the same picture twice. */
    if (/\.webp$/i.test(f) && out.includes(f.replace(/\.webp$/i, ".png"))) continue;
    out.push(f);
  }
  return out;
}

/* -------------------------------------------------------------- the report */

async function report(dirs) {
  let worst = 0;
  for (const dir of dirs) {
    const file = path.join(dir, "verdict.json");
    let v;
    try {
      v = JSON.parse(await readFile(file, "utf8"));
    } catch (e) {
      /* A missing or malformed verdict is a FAILED audit. The critic may have
         crashed, run out of context, or written prose instead of JSON; none of
         those is evidence that the building is fine. */
      console.log(`\n${path.basename(dir)}: NO VERDICT — ${e.code === "ENOENT" ? "verdict.json was never written" : `verdict.json does not parse (${e.message})`}`);
      worst = 2;
      continue;
    }
    const findings = Array.isArray(v.findings) ? v.findings : [];
    const major = findings.filter((f) => f.severity === "major");
    /* The critic's own verdict string is not trusted over its own findings: a
       critic that lists three major faults and writes PASS is reported as
       FAIL, and said to have disagreed with itself. */
    const derived = major.length ? "FAIL" : "PASS";
    const disagrees = v.verdict && v.verdict !== derived;
    console.log(`\n${v.building || path.basename(dir)}: ${derived}${disagrees ? `  (critic wrote "${v.verdict}" — overridden by its own ${major.length} major finding(s))` : ""}`);
    console.log(`  ${findings.length} finding(s), ${major.length} major, over ${v.checked ?? "?"} screenshots read`);
    for (const f of findings) {
      console.log(`  ${f.severity === "major" ? "MAJOR" : "minor"}  [${f.class}] ${f.note}`);
      console.log(`         ${f.image}${f.where ? `  — ${f.where}` : ""}${f.source ? `  (source: ${f.source})` : ""}`);
    }
    if (derived === "FAIL") worst = Math.max(worst, 1);
  }
  return worst;
}

/* ------------------------------------------------------------------ the run */

const argv = process.argv.slice(2);
const cmd = argv.shift();
const dirs = [];
let sourcesDir = null, inventoryFile = null;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--sources") sourcesDir = path.resolve(argv[++i]);
  else if (argv[i] === "--inventory") inventoryFile = path.resolve(argv[++i]);
  else dirs.push(path.resolve(argv[i]));
}
if (!dirs.length) {
  console.error("usage: node scripts/visual-audit-critic.mjs brief DIR --sources DIR [--inventory FILE]\n       node scripts/visual-audit-critic.mjs report DIR [DIR...]");
  process.exit(2);
}
for (const d of dirs) await stat(d).catch(() => { console.error(`no such capture directory: ${d}`); process.exit(2); });

if (cmd === "brief") {
  if (dirs.length !== 1) { console.error("brief takes exactly one capture directory"); process.exit(2); }
  console.log(await brief(dirs[0], sourcesDir, inventoryFile));
} else if (cmd === "report") {
  const worst = await report(dirs);
  console.log(worst === 0 ? "\nALL PASS" : worst === 1 ? "\nFAIL: at least one building has a major defect" : "\nERROR: at least one building was never judged");
  process.exit(worst);
} else {
  console.error(`unknown command "${cmd}" — expected brief or report`);
  process.exit(2);
}
