#!/usr/bin/env bash
# Refresh gauntlet-loop/PROGRESS.md on a wall-clock cadence.
#
# Sahir asked (2026-08-05) for the first write at 14:30 and every 30 minutes
# after. Deliberately NOT cron or launchd: every scheduled loop on this machine
# was switched off on 2026-07-25 by standing request, and re-enabling one needs
# asking first. This is a plain background process — it dies with a reboot, it
# leaves a log, and `pkill -f gauntlet-progress-schedule` stops it.
#
#   ./scripts/gauntlet-progress-schedule.sh            # first write at 14:30
#   FIRST_AT=09:00 ./scripts/gauntlet-progress-schedule.sh
set -uo pipefail
cd "$(dirname "$0")/.."

FIRST_AT="${FIRST_AT:-14:30}"
EVERY="${EVERY:-1800}"
LOG=gauntlet-loop/progress-schedule.log

# Seconds until the next occurrence of FIRST_AT. If it has already passed today
# the answer is 0 — start now rather than idling until tomorrow, because a
# roadmap that waits 23 hours for its first line is not a roadmap.
now=$(date +%s)
target=$(date -j -f "%Y-%m-%d %H:%M:%S" "$(date +%Y-%m-%d) $FIRST_AT:00" +%s 2>/dev/null) || target=$now
wait=$(( target - now ))
(( wait < 0 )) && wait=0

{
  echo "[progress] $(date '+%F %H:%M:%S') scheduler up — first write at $FIRST_AT (in ${wait}s), then every $((EVERY/60)) min"
} >> "$LOG"

sleep "$wait"

while true; do
  if node scripts/gauntlet-progress.mjs >> "$LOG" 2>&1; then
    echo "[progress] $(date '+%F %H:%M:%S') wrote PROGRESS.md" >> "$LOG"
  else
    echo "[progress] $(date '+%F %H:%M:%S') FAILED to write PROGRESS.md" >> "$LOG"
  fi
  sleep "$EVERY"
done
