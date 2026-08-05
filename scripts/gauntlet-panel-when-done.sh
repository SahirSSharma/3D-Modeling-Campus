#!/usr/bin/env bash
# Run the verification panel the moment the loop stops, and not a minute before.
#
# A panel judges a snapshot. While the loop is still committing, the frames go
# stale between capture and review and the verdicts describe a campus that no
# longer exists -- so this waits for the driver to exit rather than racing it.
#
# The panel is REDUCED to opus,sol: every panel model bills the scarce Other
# Models pool, ~41M of it remains, and a four-model panel would run dry partway
# through. fable is excluded deliberately -- it judged four shards, so it would
# be reviewing its own work. opus and sol are two different families and neither
# touched the campus.
set -uo pipefail
cd "$(dirname "$0")/.."

PANEL="${GAUNTLET_PANEL:-opus,sol}"
LOG=gauntlet-loop/panel-runner.log
exec > >(tee -a "$LOG") 2>&1

echo "[panel] $(date +%H:%M:%S) waiting for the loop to finish, then running panel: $PANEL"

while pgrep -f "gauntlet-route.sh" > /dev/null; do sleep 60; done
echo "[panel] $(date +%H:%M:%S) loop finished."

# A panel is only worth running on a tree that passes its own gates. If the last
# shard left something broken, the panel would be reviewing a build the project
# would not ship anyway -- and the panel costs real money to discover that.
export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"
if ! npm test > /tmp/panel-pretest.log 2>&1; then
  echo "[panel] ABORT: npm test fails -- not spending the last of the pool on a broken tree."
  tail -20 /tmp/panel-pretest.log
  exit 1
fi
if ! npm run check > /tmp/panel-precheck.log 2>&1; then
  echo "[panel] ABORT: npm run check fails."
  tail -20 /tmp/panel-precheck.log
  exit 1
fi
echo "[panel] gates green: $(grep -oE 'tests [0-9]+' /tmp/panel-pretest.log | head -1)"

DIRTY="$(git status --porcelain -- ':!gauntlet-loop' | wc -l | tr -d ' ')"
if [[ "$DIRTY" != "0" ]]; then
  echo "[panel] ABORT: working tree dirty outside gauntlet-loop -- a panel must judge committed work."
  git status --short -- ':!gauntlet-loop'
  exit 1
fi

echo "[panel] $(date +%H:%M:%S) capturing frames and running the reduced panel"
GAUNTLET_PANEL="$PANEL" ./scripts/gauntlet-verify.sh
node scripts/gauntlet-progress.mjs
