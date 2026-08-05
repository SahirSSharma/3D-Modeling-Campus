#!/usr/bin/env bash
# Put the biggest shard in front of the remaining Fable budget.
#
# A Fable adjudication measures 30-45M, not the 6M the router assumed, so only
# about two are left. The queue order lands r2c1 -- 400 buildings, more than
# double any other shard -- exactly when the budget runs out, which is the worst
# possible pairing. This moves it to the front.
#
# The cut-over has to be timed, not forced. Killing the driver mid-adjudication
# would waste a 30-45M call and could leave a half-applied edit, so this waits
# for the running shard to commit and then cuts during the NEXT shard's screen
# phase -- screening is read-only, bills the free pool, and costs nothing to
# throw away.
set -uo pipefail
cd "$(dirname "$0")/.."

WAIT_FOR="${1:-r1c2}"          # shard that must finish before we cut
NEW_ORDER="${2:-r2c1,r2c0,r2c2}"
LOG=gauntlet-loop/reorder.log
exec > >(tee -a "$LOG") 2>&1

echo "[reorder] $(date +%H:%M:%S) waiting for $WAIT_FOR to commit, then reordering to $NEW_ORDER"

status_has() { grep -qE "^\| [0-9]+ \| $1 \|" gauntlet-loop/runs/latest/STATUS.md 2>/dev/null; }
last_phase() { grep -oE '^\[route\] pass [0-9]+  shard [^ ]+  (screen|judge)' gauntlet-loop/route-driver.log | tail -1; }

# --------------------------------------------------- 1. wait for the shard
while true; do
  if ! pgrep -f "gauntlet-route.sh" > /dev/null; then
    echo "[reorder] driver exited on its own before $WAIT_FOR landed — not relaunching blindly."
    echo "[reorder] inspect gauntlet-loop/route-driver.log and start the new order by hand."
    exit 1
  fi
  status_has "$WAIT_FOR" && break
  sleep 60
done
echo "[reorder] $(date +%H:%M:%S) $WAIT_FOR committed."

# ------------------------------------------- 2. wait for a safe moment to cut
# Safe means: not inside an adjudication. Either the driver is between shards or
# it is screening. A judge line for a shard with no STATUS row means Fable is
# spending right now -- let it finish rather than burn the call.
while true; do
  PHASE="$(last_phase)"
  SHARD="$(awk '{print $5}' <<< "$PHASE")"
  KIND="$(awk '{print $6}' <<< "$PHASE")"
  if [[ -z "$PHASE" ]] || [[ "$KIND" == "screen" ]] || status_has "$SHARD"; then
    echo "[reorder] $(date +%H:%M:%S) safe to cut (last phase: ${PHASE:-none})"
    break
  fi
  echo "[reorder] $(date +%H:%M:%S) $SHARD is mid-judge — waiting rather than wasting a 30-45M call"
  sleep 120
done

# ------------------------------------------------------------ 3. stop cleanly
# SIGTERM first so the driver's EXIT trap can run. A previous driver needed
# SIGKILL and its trap never fired, which left the push guard armed -- the safe
# direction, but worth not repeating.
PIDS="$(pgrep -f 'gauntlet-route.sh' | tr '\n' ' ')"
echo "[reorder] stopping driver: $PIDS"
pkill -f "gauntlet-route.sh"
for _ in $(seq 1 15); do pgrep -f "gauntlet-route.sh" > /dev/null || break; sleep 2; done
if pgrep -f "gauntlet-route.sh" > /dev/null; then
  echo "[reorder] SIGTERM did not take — escalating"
  pkill -9 -f "gauntlet-route.sh"; sleep 3
fi
# The screener may outlive its driver. Match the REAL argv: cursor-agent runs as
# `cursor-agent --use-system-ca <path>/index.js -p -f --trust ...`, so a pattern
# anchored on "-p -f --trust" matches nothing and looks exactly like success.
pkill -f "cursor-agent" 2>/dev/null
sleep 2
echo "[reorder] agents still up: $(pgrep -f 'cursor-agent' | tr '\n' ' ' || echo none)"

# Never relaunch on top of a dirty tree — a killed screener writes only its JSON,
# but a half-applied judge edit would silently become the next shard's baseline.
DIRTY="$(git status --porcelain -- ':!gauntlet-loop' | wc -l | tr -d ' ')"
if [[ "$DIRTY" != "0" ]]; then
  echo "[reorder] WORKING TREE DIRTY outside gauntlet-loop — refusing to relaunch:"
  git status --short -- ':!gauntlet-loop'
  echo "[reorder] resolve by hand, then: ./scripts/gauntlet-route.sh --shards $NEW_ORDER --passes 1"
  exit 1
fi

# --------------------------------------------------------------- 4. relaunch
echo "[reorder] $(date +%H:%M:%S) relaunching with $NEW_ORDER"
nohup bash -c "./scripts/gauntlet-route.sh --shards $NEW_ORDER --passes 1 && ./scripts/gauntlet-route.sh --until-clean --max-passes 3" \
  >> gauntlet-loop/route-driver.log 2>&1 &
sleep 5
echo "[reorder] new driver: $(pgrep -f 'gauntlet-route.sh' | tr '\n' ' ')"
node scripts/gauntlet-progress.mjs
