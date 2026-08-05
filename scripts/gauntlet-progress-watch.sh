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

MISSES=0
while true; do
  node scripts/gauntlet-progress.mjs || echo "[progress] generator failed; will retry next tick"

  # Liveness is checked AFTER writing, so the run's final state always lands in
  # the file before this exits. `pgrep -f` needs a pattern that actually matches
  # the real argv — a pgrep that silently never matches would look identical to
  # a finished run and stop the watcher early.
  #
  # A single miss is not death. The reorder supervisor stops one driver and
  # starts another, and a tick landing in that few-second gap would end the
  # watcher for the night. Require two misses a minute apart, and count the
  # supervisor as life since it is about to produce a driver.
  if pgrep -f "gauntlet-route.sh" > /dev/null || pgrep -f "gauntlet-reorder.sh" > /dev/null; then
    MISSES=0
  else
    MISSES=$(( MISSES + 1 ))
    if (( MISSES >= 2 )); then
      echo "[progress] driver gone for two checks — wrote the final snapshot, stopping."
      exit 0
    fi
    echo "[progress] no driver seen (miss $MISSES/2) — rechecking in 60s"
    sleep 60
    continue
  fi
  sleep "$INTERVAL"
done
