#!/usr/bin/env bash
# Keep gauntlet-loop/PROGRESS.md fresh every 30 minutes.
#
# Deliberately NOT a cron or launchd job. Scheduled loops on this machine are
# off by standing rule, and a permanent job outliving the run it describes is
# worse than useless — it would keep rewriting a stale file forever. This one is
# tied to the driver: it writes, checks whether the driver is still up, and
# exits after the final write when it isn't.
set -uo pipefail
cd "$(dirname "$0")/.."

INTERVAL="${1:-1800}"
echo "[progress] watching, every ${INTERVAL}s — writes gauntlet-loop/PROGRESS.md"

while true; do
  node scripts/gauntlet-progress.mjs || echo "[progress] generator failed; will retry next tick"

  # Liveness is checked AFTER writing, so the run's final state always lands in
  # the file before this exits. `pgrep -f` needs a pattern that actually matches
  # the real argv — a pgrep that silently never matches would look identical to
  # a finished run and stop the watcher early.
  if ! pgrep -f "gauntlet-route.sh" > /dev/null; then
    echo "[progress] driver is gone — wrote the final snapshot, stopping."
    exit 0
  fi
  sleep "$INTERVAL"
done
