#!/bin/bash
# Run the Campus Walk gauntlet loop on Cursor, billing Sahir's Cursor plan.
#
#   scripts/gauntlet-cursor.sh                 # one full pass over every shard
#   scripts/gauntlet-cursor.sh --shard r1c1    # one shard only
#   scripts/gauntlet-cursor.sh --passes 3      # three full passes
#   scripts/gauntlet-cursor.sh --dry-run       # print what would run, call nothing
#   scripts/gauntlet-cursor.sh --until-clean   # keep sweeping until a pass changes nothing
#
# --until-clean is the loop as PROMPT.md actually defines it: "a pass that finds
# nothing is what ends the loop, not a time or iteration budget." A pass counts as
# clean when it produced no new commits. --max-passes (default 4) is a runaway
# backstop, not the intended stopping condition.
#
# Shards run SEQUENTIALLY on purpose. They are geographically disjoint, but the
# builders rewrite whole JSON files (campus-lidar.json, campus-colors.json), so
# two agents in parallel would race on the same artifacts.
#
# WHY A DRIVER EXISTS AT ALL
# gauntlet-loop/PROMPT.md is addressed to a multi-agent runner with sub-agent
# teams. cursor-agent is ONE agent with no fan-out, so the parallelism has to
# live out here: scripts/gauntlet-shards.mjs cuts campus into geographic shards
# and this script feeds them through one at a time, each with its own log.
#
# WHAT THIS SCRIPT WILL NOT DO
# It will not push and it will not deploy. That is enforced twice — in the
# prompt, and by a pre-push hook armed for the duration of the run — because
# PROMPT.md's Definition of Done ends at "confirmed live" and a literal-minded
# agent running under -f would try to get there on its own. Shipping is Sahir's
# call, per ~/.claude/skills/sahir-rules.
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO" || exit 1

MODEL="${GAUNTLET_MODEL:-claude-fable-5-thinking-max}"   # Fable 5 1M Max Thinking
PASSES=1
ONLY_SHARD=""
DRY_RUN=0
UNTIL_CLEAN=0
MAX_PASSES=4

while [[ $# -gt 0 ]]; do
  case "$1" in
    --shard)   ONLY_SHARD="$2"; shift 2 ;;
    --passes)  PASSES="$2"; shift 2 ;;
    --model)   MODEL="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --until-clean) UNTIL_CLEAN=1; shift ;;
    --max-passes)  MAX_PASSES="$2"; shift 2 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

command -v cursor-agent >/dev/null || { echo "cursor-agent not on PATH" >&2; exit 1; }
[[ -f gauntlet-loop/PROMPT.md ]] || { echo "gauntlet-loop/PROMPT.md missing" >&2; exit 1; }

STAMP="$(date +%Y-%m-%d_%H%M%S)"
RUN="gauntlet-loop/runs/$STAMP"
mkdir -p "$RUN"
ln -sfn "$STAMP" gauntlet-loop/runs/latest

STATUS="$RUN/STATUS.md"
SENTINEL="gauntlet-loop/.no-push"

# ---------------------------------------------------------------- push guard
HOOK=".git/hooks/pre-push"
arm_guard() {
  mkdir -p .git/hooks
  if [[ -f "$HOOK" && ! -f "$HOOK.gauntlet-backup" ]]; then
    cp "$HOOK" "$HOOK.gauntlet-backup"
  fi
  cat > "$HOOK" <<'HOOKEOF'
#!/bin/bash
# Armed by scripts/gauntlet-cursor.sh for the duration of a gauntlet run.
if [ -f "gauntlet-loop/.no-push" ]; then
  echo "" >&2
  echo "BLOCKED: a gauntlet run is in progress and must not push or deploy." >&2
  echo "Shipping is Sahir's call. Remove gauntlet-loop/.no-push to push by hand." >&2
  echo "" >&2
  exit 1
fi
exit 0
HOOKEOF
  chmod +x "$HOOK"
  touch "$SENTINEL"
}
disarm_guard() {
  rm -f "$SENTINEL"
  if [[ -f "$HOOK.gauntlet-backup" ]]; then
    mv "$HOOK.gauntlet-backup" "$HOOK"
  else
    rm -f "$HOOK"
  fi
}
trap disarm_guard EXIT INT TERM

# ------------------------------------------------------------------- shards
SHARD_JSON="$RUN/shards.json"
node scripts/gauntlet-shards.mjs --json > "$SHARD_JSON" || exit 1
# macOS ships bash 3.2, which has no `mapfile` — read the ids the portable way.
SHARD_IDS=()
while IFS= read -r line; do
  [[ -n "$line" ]] && SHARD_IDS+=("$line")
done < <(node -e '
  const s=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));
  for (const x of s) console.log(x.id);' "$SHARD_JSON")

if [[ -n "$ONLY_SHARD" ]]; then
  SHARD_IDS=("$ONLY_SHARD")
fi

{
  echo "# Gauntlet run $STAMP"
  echo ""
  echo "- model: \`$MODEL\`"
  echo "- passes: $PASSES"
  echo "- shards: ${#SHARD_IDS[@]} (${SHARD_IDS[*]})"
  echo "- push/deploy: BLOCKED for the duration of this run"
  echo ""
  echo "| pass | shard | started | exit | duration | log |"
  echo "|---|---|---|---|---|---|"
} > "$STATUS"

echo "[gauntlet] run  $RUN"
echo "[gauntlet] model $MODEL"
echo "[gauntlet] watch: tail -f $STATUS"

[[ $DRY_RUN -eq 1 ]] || arm_guard

[[ $UNTIL_CLEAN -eq 1 ]] && PASSES=$MAX_PASSES

pass=0
while (( pass < PASSES )); do
  pass=$(( pass + 1 ))
  PASS_START_SHA="$(git rev-parse HEAD)"
  for id in "${SHARD_IDS[@]}"; do
    SCOPE="$(node -e '
      const s=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));
      const x=s.find(y=>y.id===process.argv[2]);
      if(!x){console.error("no such shard: "+process.argv[2]);process.exit(1);}
      console.log(`Shard ${x.id} — ${x.buildings} buildings (${x.namedBuildings} named).
Bounds: lat ${x.bbox.south.toFixed(6)}..${x.bbox.north.toFixed(6)}, lng ${x.bbox.west.toFixed(6)}..${x.bbox.east.toFixed(6)}
Local metre box: x ${x.localBox.x0}..${x.localBox.x1}, z ${x.localBox.z0}..${x.localBox.z1}
Landmarks inside: ${x.landmarks.join(", ")}`);
    ' "$SHARD_JSON" "$id")" || { echo "[gauntlet] skipping unknown shard $id" >&2; continue; }

    LOG="$RUN/pass${pass}-${id}.log"
    PROMPT_FILE="$RUN/pass${pass}-${id}.prompt.md"
    {
      cat gauntlet-loop/PROMPT.md
      printf '\n---\n\n'
      SCOPE="$SCOPE" PASS="$pass" STAMP="$STAMP" \
        node -e '
          const fs=require("fs");
          let t=fs.readFileSync("gauntlet-loop/CURSOR-ADDENDUM.md","utf8");
          t=t.split("@@SCOPE@@").join(process.env.SCOPE)
             .split("@@PASS@@").join(process.env.PASS)
             .split("@@STAMP@@").join(process.env.STAMP);
          process.stdout.write(t);
        '
    } > "$PROMPT_FILE"

    START="$(date +%H:%M:%S)"; T0=$SECONDS
    echo "[gauntlet] pass $pass  shard $id  -> $LOG"

    if [[ $DRY_RUN -eq 1 ]]; then
      echo "[gauntlet] dry run: prompt written to $PROMPT_FILE ($(wc -l < "$PROMPT_FILE") lines)"
      RC=0
    else
      cursor-agent -p -f --trust --output-format text --model "$MODEL" "$(cat "$PROMPT_FILE")" 2>&1 | tee "$LOG"
      RC=${PIPESTATUS[0]}
    fi

    DUR=$(( SECONDS - T0 ))
    printf '| %s | %s | %s | %s | %dm%02ds | `%s` |\n' \
      "$pass" "$id" "$START" "$RC" "$((DUR/60))" "$((DUR%60))" "$(basename "$LOG")" >> "$STATUS"
  done

  PASS_END_SHA="$(git rev-parse HEAD)"
  PASS_COMMITS="$(git rev-list --count "${PASS_START_SHA}..${PASS_END_SHA}")"
  echo "" >> "$STATUS"
  echo "**Pass $pass produced $PASS_COMMITS commit(s).**" >> "$STATUS"
  echo "" >> "$STATUS"
  echo "[gauntlet] pass $pass produced $PASS_COMMITS commit(s)"

  if [[ $UNTIL_CLEAN -eq 1 && "$PASS_COMMITS" -eq 0 ]]; then
    echo "" >> "$STATUS"
    echo "CLEAN PASS — a full sweep changed nothing. Loop complete after $pass pass(es)." >> "$STATUS"
    echo "[gauntlet] CLEAN PASS. stopping."
    break
  fi

  if [[ $UNTIL_CLEAN -eq 1 && $pass -eq $PASSES ]]; then
    echo "" >> "$STATUS"
    echo "STOPPED AT THE --max-passes BACKSTOP ($MAX_PASSES), not on a clean pass. Work remains." >> "$STATUS"
    echo "[gauntlet] hit max-passes backstop; work remains."
  fi
done

echo "" >> "$STATUS"
echo "Run finished $(date +%H:%M:%S). Findings: \`$RUN/FINDINGS.md\`" >> "$STATUS"
echo "[gauntlet] done. $STATUS"
