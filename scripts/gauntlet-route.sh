#!/bin/bash
# Gauntlet loop with model routing — screen on Grok, judge on Fable.
#
#   scripts/gauntlet-route.sh --until-clean            # the normal invocation
#   scripts/gauntlet-route.sh --shards r1c1,r1c2       # resume a partial pass
#   scripts/gauntlet-route.sh --dry-run                # print the plan, call nothing
#
# WHY THIS EXISTS
# scripts/gauntlet-cursor.sh ran one agent per shard doing everything, at ~18.3M
# tokens a shard (measured 2026-08-04: 20.2 / 16.5 / 16.3 / 20.2M for r0c0..r1c0).
# At that rate the remaining loop needs ~256M tokens against ~197M left in the
# Cursor "Other Models" pool. It does not fit.
#
# But a shard is two different jobs. SCREENING — enumerating buildings, pulling
# LiDAR returns and GIS records, running probes — is mechanical, token-heavy, and
# every claim it makes is checkable. ADJUDICATING — is this disagreement an error
# or a DATE? does this sample clear the fit gate? is this a case or a class? — is
# judgement, and it is where this project's expensive mistakes have happened.
#
# So: Grok 4.5 screens (Cursor Models pool, 1% used, effectively free) and Fable
# judges (Other Models pool, scarce). Screening is ~70% of the tokens and none of
# the risk.
#
# NEVER STOPS
# The routing degrades rather than failing. When Fable's budget runs low, only
# shards with high-severity findings get it; when it is gone, Grok judges too and
# those shards are recorded in REAUDIT.md so the loss of rigour is visible rather
# than silent. A failed agent call retries, then downgrades, then skips the shard.
# Nothing here exits non-zero in the middle of a pass.
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO" || exit 1

JUDGE_MODEL="${GAUNTLET_JUDGE:-claude-fable-5-thinking-max}"
SCREEN_MODEL="${GAUNTLET_SCREEN:-cursor-grok-4.5-high}"

# Cursor exposes no usage API, so the odometer is an estimate seeded from the
# measured per-shard cost. Drop a number (percent of Other Models consumed, read
# off the dashboard) into gauntlet-loop/.quota and it is believed over the
# estimate — a real reading always beats a projection.
POOL_M="${GAUNTLET_POOL_M:-373}"          # full Other Models pool, tokens in millions
BUDGET_M="${GAUNTLET_BUDGET_M:-190}"      # of that, what this run may spend
ADJ_EST_M="${GAUNTLET_ADJ_EST_M:-6}"      # estimated cost of one Fable adjudication

PASSES=1; MAX_PASSES=4; UNTIL_CLEAN=0; DRY_RUN=0; ONLY_SHARDS=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --shards)      ONLY_SHARDS="$2"; shift 2 ;;
    --until-clean) UNTIL_CLEAN=1; shift ;;
    --max-passes)  MAX_PASSES="$2"; shift 2 ;;
    --passes)      PASSES="$2"; shift 2 ;;
    --judge)       JUDGE_MODEL="$2"; shift 2 ;;
    --screen)      SCREEN_MODEL="$2"; shift 2 ;;
    --budget)      BUDGET_M="$2"; shift 2 ;;
    --dry-run)     DRY_RUN=1; shift ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

command -v cursor-agent >/dev/null || { echo "cursor-agent not on PATH" >&2; exit 1; }
[[ -f gauntlet-loop/PROMPT.md ]] || { echo "gauntlet-loop/PROMPT.md missing" >&2; exit 1; }

STAMP="$(date +%Y-%m-%d_%H%M%S)"
[[ $DRY_RUN -eq 1 ]] && STAMP="dryrun-$STAMP"
RUN="gauntlet-loop/runs/$STAMP"
mkdir -p "$RUN"
# A dry run must not repoint `latest` — a real run may be live, and whatever is
# tailing its STATUS.md would silently start reading the rehearsal instead.
[[ $DRY_RUN -eq 1 ]] || ln -sfn "$STAMP" gauntlet-loop/runs/latest
STATUS="$RUN/STATUS.md"
REAUDIT="$RUN/REAUDIT.md"
SENTINEL="gauntlet-loop/.no-push"
SPENT_M=0
DEGRADED_COUNT=0

# ---------------------------------------------------------------- push guard
# Only touch the hook if nobody else armed it. Another gauntlet run may be live,
# and tearing down its guard on our exit would leave it able to push.
HOOK=".git/hooks/pre-push"; ARMED=0
arm_guard() {
  [[ -f "$SENTINEL" ]] && { echo "[route] push guard already armed by another run"; return; }
  mkdir -p .git/hooks
  [[ -f "$HOOK" && ! -f "$HOOK.gauntlet-backup" ]] && cp "$HOOK" "$HOOK.gauntlet-backup"
  cat > "$HOOK" <<'HOOKEOF'
#!/bin/bash
if [ -f "gauntlet-loop/.no-push" ]; then
  echo "BLOCKED: a gauntlet run is in progress and must not push or deploy." >&2
  echo "Shipping is Sahir's call. Remove gauntlet-loop/.no-push to push by hand." >&2
  exit 1
fi
exit 0
HOOKEOF
  chmod +x "$HOOK"; touch "$SENTINEL"; ARMED=1
}
disarm_guard() {
  [[ $ARMED -eq 1 ]] || return
  rm -f "$SENTINEL"
  if [[ -f "$HOOK.gauntlet-backup" ]]; then mv "$HOOK.gauntlet-backup" "$HOOK"; else rm -f "$HOOK"; fi
}
trap disarm_guard EXIT INT TERM

# ------------------------------------------------------------------ odometer
# Returns the percentage of this run's Fable budget still available.
budget_left_pct() {
  local spent="$SPENT_M"
  if [[ -f gauntlet-loop/.quota ]]; then
    local used_pct; used_pct="$(tr -dc '0-9.' < gauntlet-loop/.quota)"
    if [[ -n "$used_pct" ]]; then
      # process.stdout.write, not console.log — console.log sends a bare number
      # through util.inspect, which ANSI-colours it when FORCE_COLOR is set and
      # then $(( )) chokes on the escape codes.
      node -e 'const pool=+process.argv[1],used=+process.argv[2],budget=+process.argv[3];
               const left=pool*(1-used/100);
               process.stdout.write(String(Math.max(0, Math.round(left/budget*100))));' "$POOL_M" "$used_pct" "$BUDGET_M"
      return
    fi
  fi
  node -e 'const b=+process.argv[1],s=+process.argv[2];
           process.stdout.write(String(Math.max(0, Math.round((b-s)/b*100))));' "$BUDGET_M" "$spent"
}

# ---------------------------------------------------------------- agent call
# Never lets a failure end the run: retry, then let the caller downgrade.
run_agent() {
  local model="$1" prompt_file="$2" log="$3" attempt rc
  for attempt in 1 2; do
    cursor-agent -p -f --trust --output-format text --model "$model" \
      "$(cat "$prompt_file")" 2>&1 | tee -a "$log"
    rc=${PIPESTATUS[0]}
    [[ $rc -eq 0 ]] && return 0
    echo "[route] $model attempt $attempt failed (rc=$rc)" | tee -a "$log"
    sleep $(( attempt * 30 ))
  done
  return 1
}

# ------------------------------------------------------------------- shards
SHARD_JSON="$RUN/shards.json"
node scripts/gauntlet-shards.mjs --json > "$SHARD_JSON" || exit 1
SHARD_IDS=()
if [[ -n "$ONLY_SHARDS" ]]; then
  IFS=',' read -r -a SHARD_IDS <<< "$ONLY_SHARDS"
else
  while IFS= read -r line; do [[ -n "$line" ]] && SHARD_IDS+=("$line"); done < <(node -e '
    const s=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));
    for (const x of s) console.log(x.id);' "$SHARD_JSON")
fi

{
  echo "# Gauntlet routed run $STAMP"
  echo ""
  echo "- screen: \`$SCREEN_MODEL\` (Cursor Models pool)"
  echo "- judge:  \`$JUDGE_MODEL\` (Other Models pool, budget ${BUDGET_M}M)"
  echo "- shards: ${#SHARD_IDS[@]} (${SHARD_IDS[*]})"
  echo "- push/deploy: BLOCKED for the duration of this run"
  echo ""
  echo "| pass | shard | tier | screen | high/med/low | judge | commit | duration |"
  echo "|---|---|---|---|---|---|---|---|"
} > "$STATUS"

echo "# Shards judged without Fable" > "$REAUDIT"
echo "" >> "$REAUDIT"
echo "These were adjudicated by \`$SCREEN_MODEL\` because the Fable budget ran out." >> "$REAUDIT"
echo "Their commits carry less judgement than the rest and should be re-audited first." >> "$REAUDIT"
echo "" >> "$REAUDIT"

echo "[route] run   $RUN"
echo "[route] screen $SCREEN_MODEL  judge $JUDGE_MODEL  budget ${BUDGET_M}M"
echo "[route] watch: tail -f $STATUS"

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
    ' "$SHARD_JSON" "$id")" || { echo "[route] skipping unknown shard $id" >&2; continue; }

    LOG="$RUN/pass${pass}-${id}.log"
    SCREENFILE="$RUN/pass${pass}-${id}.screen.json"
    T0=$SECONDS

    # -------------------------------------------------------- phase 1: screen
    SP="$RUN/pass${pass}-${id}.screen.prompt.md"
    { cat gauntlet-loop/PROMPT.md; printf '\n'
      SCOPE="$SCOPE" PASS="$pass" STAMP="$STAMP" SCREENFILE="$SCREENFILE" node -e '
        const fs=require("fs");let t=fs.readFileSync("gauntlet-loop/SCREEN-ADDENDUM.md","utf8");
        for (const k of ["SCOPE","PASS","STAMP","SCREENFILE"]) t=t.split("@@"+k+"@@").join(process.env[k]);
        process.stdout.write(t);'
    } > "$SP"

    echo "[route] pass $pass  shard $id  screen ($SCREEN_MODEL)"
    SCREEN_OK=1
    if [[ $DRY_RUN -eq 1 ]]; then SCREEN_OK=1; echo "[]" > "$SCREENFILE"
    else run_agent "$SCREEN_MODEL" "$SP" "$LOG" || SCREEN_OK=0
    fi

    # A screen that produced no readable file is a screen that did not happen.
    # Fall back to letting the judge do its own looking rather than skipping the
    # shard — degraded, but the shard still gets covered.
    COUNTS="0/0/0"; NHIGH=0; NTOTAL=0
    if [[ -s "$SCREENFILE" ]]; then
      read -r NTOTAL NHIGH COUNTS < <(node -e '
        try {
          const a=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));
          if(!Array.isArray(a)) throw 0;
          const c=(s)=>a.filter(x=>x.severity===s).length;
          console.log(`${a.length} ${c("high")} ${c("high")}/${c("medium")}/${c("low")}`);
        } catch(e) { console.log("0 0 unreadable"); }' "$SCREENFILE") || true
    else
      COUNTS="none"
    fi

    # ---------------------------------------------------------- tier decision
    LEFT="$(budget_left_pct)"
    if   (( LEFT > 25 )); then TIER=1
    elif (( LEFT > 10 )); then TIER=2
    else                       TIER=3
    fi

    JUDGE_USE="$JUDGE_MODEL"; DEGRADED_NOTE=""
    if   (( TIER == 3 )); then
      JUDGE_USE="$SCREEN_MODEL"
      DEGRADED_NOTE="NOTE: the Fable budget for this run is exhausted, so you are judging as well as screening. Hold the bar higher, not lower: when you are unsure whether a disagreement is an error or a date, WITHHOLD and record it rather than fixing it. A wrong fix costs more than a missed one."
    elif (( TIER == 2 )) && (( NHIGH == 0 )); then
      JUDGE_USE="$SCREEN_MODEL"
      DEGRADED_NOTE="NOTE: the Fable budget is nearly spent and this shard screened with no high-severity findings, so you are judging your own screen. When unsure, WITHHOLD and record rather than fix."
    fi

    if [[ "$JUDGE_USE" == "$SCREEN_MODEL" && "$NTOTAL" != "0" ]]; then
      DEGRADED_COUNT=$(( DEGRADED_COUNT + 1 ))
      echo "- pass $pass \`$id\` — judged by \`$SCREEN_MODEL\` (tier $TIER, $COUNTS)" >> "$REAUDIT"
    fi

    # ------------------------------------------------------ phase 2: adjudicate
    COMMIT="none"
    if [[ "$NTOTAL" == "0" && "$COUNTS" != "none" && "$COUNTS" != "unreadable" ]]; then
      echo "[route] pass $pass  shard $id  screen found nothing — no judge call"
    else
      AP="$RUN/pass${pass}-${id}.judge.prompt.md"
      { cat gauntlet-loop/PROMPT.md; printf '\n'
        SCOPE="$SCOPE" PASS="$pass" STAMP="$STAMP" SCREENFILE="$SCREENFILE" DEGRADED="$DEGRADED_NOTE" node -e '
          const fs=require("fs");let t=fs.readFileSync("gauntlet-loop/ADJUDICATE-ADDENDUM.md","utf8");
          for (const k of ["SCOPE","PASS","STAMP","SCREENFILE","DEGRADED"]) t=t.split("@@"+k+"@@").join(process.env[k]);
          process.stdout.write(t);'
      } > "$AP"

      SHARD_SHA="$(git rev-parse HEAD)"
      echo "[route] pass $pass  shard $id  judge ($JUDGE_USE, tier $TIER, $COUNTS)"
      if [[ $DRY_RUN -eq 0 ]]; then
        if run_agent "$JUDGE_USE" "$AP" "$LOG"; then :; else
          # Last resort: if Fable failed outright, let Grok judge rather than
          # leaving the shard uncovered.
          if [[ "$JUDGE_USE" != "$SCREEN_MODEL" ]]; then
            echo "[route] judge failed on $JUDGE_USE — downgrading to $SCREEN_MODEL"
            DEGRADED_COUNT=$(( DEGRADED_COUNT + 1 ))
            echo "- pass $pass \`$id\` — Fable call FAILED, judged by \`$SCREEN_MODEL\`" >> "$REAUDIT"
            run_agent "$SCREEN_MODEL" "$AP" "$LOG" || echo "[route] shard $id judged by nobody; continuing"
          else
            echo "[route] shard $id judged by nobody; continuing"
          fi
        fi
        [[ "$JUDGE_USE" == "$JUDGE_MODEL" ]] && SPENT_M=$(( SPENT_M + ADJ_EST_M ))
      fi
      NEW_SHA="$(git rev-parse HEAD)"
      [[ "$NEW_SHA" != "$SHARD_SHA" ]] && COMMIT="$(git rev-parse --short HEAD)"
    fi

    DUR=$(( SECONDS - T0 ))
    printf '| %s | %s | %s | %s | %s | %s | %s | %dm%02ds |\n' \
      "$pass" "$id" "$TIER" "$SCREEN_MODEL" "$COUNTS" "$JUDGE_USE" "$COMMIT" \
      "$((DUR/60))" "$((DUR%60))" >> "$STATUS"
  done

  PASS_COMMITS="$(git rev-list --count "${PASS_START_SHA}..$(git rev-parse HEAD)")"
  { echo ""; echo "**Pass $pass produced $PASS_COMMITS commit(s). Fable spent ~${SPENT_M}M, $(budget_left_pct)% of budget left.**"; echo ""; } >> "$STATUS"
  echo "[route] pass $pass: $PASS_COMMITS commit(s), ~${SPENT_M}M spent, $(budget_left_pct)% left"

  if [[ $UNTIL_CLEAN -eq 1 && "$PASS_COMMITS" -eq 0 ]]; then
    echo "CLEAN PASS — a full sweep changed nothing. Loop complete after $pass pass(es)." >> "$STATUS"
    echo "[route] CLEAN PASS. stopping."
    break
  fi
done

{
  echo ""
  echo "Run finished $(date +%H:%M:%S)."
  if (( DEGRADED_COUNT > 0 )); then
    echo ""
    echo "**$DEGRADED_COUNT shard(s) were judged without Fable — see \`REAUDIT.md\`.**"
    echo "A clean pass here is weaker evidence than a clean pass at tier 1."
  fi
} >> "$STATUS"
echo "[route] done. $STATUS"
