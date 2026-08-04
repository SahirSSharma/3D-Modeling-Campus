#!/bin/bash
# Judge the finished campus the way it is actually experienced — from a person's
# eye and from the air — using SEVERAL DIFFERENT agents rather than one.
#
#   scripts/gauntlet-verify.sh              # inspect everything, then review
#   scripts/gauntlet-verify.sh --skip-shots # reuse the frames already captured
#
# WHY MORE THAN ONE AGENT
# The gauntlet loop's own agent decides when its work is good. Asking that same
# judgement to also certify the result is not a check, it is a rubber stamp. So
# the review runs on a panel of different models, each given the same frames and
# the same question, and disagreement between them is the signal worth reading.
#
# Panel members are deliberately from different families — a shared blind spot
# between two Claude variants is likelier than one shared across Claude, GPT and
# Codex.
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO" || exit 1

SKIP_SHOTS=0
[[ "${1:-}" == "--skip-shots" ]] && SKIP_SHOTS=1

STAMP="$(date +%Y-%m-%d_%H%M%S)"
OUT="gauntlet-loop/verify/$STAMP"
SHOTS="$OUT/shots"
mkdir -p "$SHOTS"
ln -sfn "$STAMP" gauntlet-loop/verify/latest

# The panel: id -> model. Different families on purpose.
PANEL_IDS=(fable opus sol codex)
panel_model() {
  case "$1" in
    fable) echo "claude-fable-5-thinking-max" ;;
    opus)  echo "claude-opus-5-thinking-max" ;;
    sol)   echo "gpt-5.6-sol-max" ;;
    codex) echo "gpt-5.3-codex-xhigh" ;;
  esac
}

echo "[verify] run $OUT"

# ------------------------------------------------------------------ capture
if [[ $SKIP_SHOTS -eq 0 ]]; then
  echo "[verify] photographing campus at eye level and from the air..."
  node scripts/campus-inspect.mjs --out "$SHOTS" 2>&1 | tee "$OUT/inspect.log"
  if [[ ! -f "$SHOTS/manifest.json" ]]; then
    echo "[verify] FAILED: inspection produced no manifest" >&2
    exit 1
  fi
else
  PREV="$(ls -dt gauntlet-loop/verify/*/shots 2>/dev/null | sed -n 2p)"
  [[ -n "$PREV" ]] && cp -R "$PREV/." "$SHOTS/"
fi

FRAMES="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).frames.length)' "$SHOTS/manifest.json")"
echo "[verify] $FRAMES frames captured"

# ------------------------------------------------------------------- review
for id in "${PANEL_IDS[@]}"; do
  MODEL="$(panel_model "$id")"
  VERDICT="$OUT/verdict-$id.md"
  echo "[verify] panel: $id ($MODEL)"

  PROMPT="You are ONE member of a review panel judging whether Campus Walk is finished.
Other agents on other models are answering the same question independently. Do
not try to agree with them; your value here is an independent read.

THE CLAIM UNDER TEST
Campus Walk claims to be 'built from measurements rather than impressions',
across the whole surveyed campus — elevation, scale, colour, placement. A
gauntlet loop has just swept every shard and reports itself finished. Your job
is to find where that claim is still false.

WHAT YOU HAVE
- $FRAMES rendered frames in $SHOTS — the real page in a real browser, driven
  through the same camera seam the arrow keys use. Filenames encode the station:
  <shard>-w<i><j>-y<yaw>.png are EYE LEVEL (1.7 m, a person standing there) and
  <shard>-fly.png are FLYOVER (260 m, pitched down).
- $SHOTS/manifest.json — per frame: shard, x/z in campus metres, yaw, the
  probed ground height and roof height, and an insideMass flag.
- The repo itself. Read README.md, AGENTS.md and gauntlet-loop/PROMPT.md for
  what the project promises. Read the data and the builders if you need to.
- gauntlet-loop/runs/*/FINDINGS.md — what the loop says it did.

If you can open the PNGs, look at them; that is the point of this stage. If you
cannot render images, say so plainly at the top of your verdict and fall back to
the manifest numbers and the data — an honest 'I could not see the frames' is
worth far more than a confident review of files you never opened.

WHAT TO LOOK FOR
At eye level: buildings sunk into or floating above their ground; z-fighting or
flickering coincident surfaces; trees taller than the buildings beside them or
clipped through masses; facades that read as impossible; missing ground; a slope
that reads flat. From the air: absent masses, wrong footprints, blocks that were
never built, seams between texture zones.
Cross-check the frames against the manifest: a station with a null ground, or
insideMass true where no arcade or overhang exists, is a defect even if the
frame looks plausible.

RULES
- Do not edit any file. Do not commit. Do not push. This is a read-only review.
- Cite evidence: the frame filename, the shard, the coordinates.
- 'Better absent than wrong' is the project's rule — a thing correctly left
  unbuilt is NOT a defect. A thing built on a guess IS.
- Do not pad. If the campus looks good, say it looks good and stop.

OUTPUT
Write your verdict to $VERDICT as markdown:
  1. One line: PASS, PASS WITH NOTES, or FAIL.
  2. Whether you could actually see the images.
  3. Defects found, worst first, each with frame filename + coordinates + why.
  4. What you checked that was clean.
Your final message must be the verdict line and a one-paragraph summary."

  cursor-agent -p -f --trust --output-format text --model "$MODEL" "$PROMPT" \
    > "$OUT/panel-$id.log" 2>&1
  echo "[verify]   $id exit=$? -> $VERDICT"
done

# ---------------------------------------------------------------- aggregate
{
  echo "# Verification panel — $STAMP"
  echo ""
  echo "Frames: $FRAMES  ·  Shots: \`$SHOTS\`"
  echo ""
  echo "| panel member | model | verdict file | headline |"
  echo "|---|---|---|---|"
  for id in "${PANEL_IDS[@]}"; do
    V="$OUT/verdict-$id.md"
    HEAD="$(grep -m1 -oE 'PASS WITH NOTES|PASS|FAIL' "$V" 2>/dev/null || echo 'no verdict written')"
    echo "| $id | \`$(panel_model "$id")\` | \`$(basename "$V")\` | $HEAD |"
  done
  echo ""
  echo "A single FAIL is enough to send the campus back to the loop."
  echo "Disagreement between panel members is signal — read both verdicts before deciding."
} > "$OUT/PANEL.md"

echo "[verify] done -> $OUT/PANEL.md"
cat "$OUT/PANEL.md"
