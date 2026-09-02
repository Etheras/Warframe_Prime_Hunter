#!/usr/bin/env bash
# Install (or remove) a cron job that keeps this site's data current. The macOS
# and Linux twin of tools/schedule.ps1 - same job, same interval, same reasons.
#
#     ./tools/schedule.sh                install it, every ten minutes
#     ./tools/schedule.sh --every-minutes 30    less often
#     ./tools/schedule.sh --every 8      every eight hours instead
#     ./tools/schedule.sh --at 07:30     set the minute, and the first hour
#     ./tools/schedule.sh --remove       take it out again
#     ./tools/schedule.sh --show         print the line it would install
#
# The job runs  build_data.py --if-changed,  which is cheap when nothing has
# moved: DE's ~500-byte export index, one HEAD to the drop table, the trader
# window and the current fissures, then a rebuild from the local cache. Measured
# end to end on a warm cache: 1.7 seconds. A full download only happens when an
# upstream actually changed, and every fetch is conditional, so a repeat run
# costs four header exchanges and almost no body.
#
# Every ten minutes, because of the one source with an hour to live. Void
# Fissures move every hour or two and the pages only ever show ones that have
# not expired, so the badges are exactly as current as this job. The rest of the
# data moves a few times a year and does not care. It also keeps the "this data
# is old" banner - the other thing this job exists to prevent - a long way from
# ever appearing.
#
# Ten minutes is well inside what the source asks for: api.warframestat.us
# serves the fissure list behind a CDN with Cache-Control: max-age=120, so this
# polls five times slower than the API's own cache lifetime, and takes a 304
# with no body when nothing has changed.
#
# --every-minutes must divide 60, and --every must divide 24, for the same
# reason in both cases: cron steps do not wrap, so an interval that does not
# divide its field evenly leaves the last gap of the hour (or the day) a
# different length from the rest.

set -u
cd "$(dirname "$0")/.."
ROOT=$(pwd -P)

EVERY=0            # hours; 0 means "not given", so the minute cadence stands
EVERY_MIN=10
AT="18:30"
ACTION=install
# --dispatch-remote: also force the DEPLOYED site to rebuild, on the same
# schedule. The job above keeps this machine's data/ current and does nothing
# for GitHub Pages, which is only ever as fresh as its last build -- and
# GitHub's scheduler is best effort, measured at about one run every 44 minutes
# against a configured ten, with a worst gap of 268. A dispatch from here is not
# in that queue, so it turns the configured cadence into the delivered one.
#
# It asks for full=false, the light path: restore the cache read-only and run
# build_data.py --if-changed, which fetches the export index, one HEAD to the
# drop table, the trader window and the fissures, all conditional. The wiki and
# the drop tables are NOT re-downloaded -- those stay on the daily 18:40 build.
#
# Needs the GitHub CLI, authenticated, with permission to run workflows here.
# Off by default: it spends build minutes and Pages quota.
DISPATCH=0

while [ $# -gt 0 ]; do
  case "$1" in
    --every) EVERY="${2:-}"; shift 2 ;;
    --every-minutes) EVERY_MIN="${2:-}"; shift 2 ;;
    --at)    AT="${2:-}";    shift 2 ;;
    --remove) ACTION=remove; shift ;;
    --show)   ACTION=show;   shift ;;
    --dispatch-remote) DISPATCH=1; shift ;;
    -h|--help) sed -n '2,33p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [ "$EVERY" != "0" ]; then
  case " 1 2 3 4 6 8 12 24 " in
    *" $EVERY "*) ;;
    *) echo "--every must divide 24 evenly: 1, 2, 3, 4, 6, 8, 12 or 24."; exit 1 ;;
  esac
else
  case " 5 10 12 15 20 30 60 " in
    *" $EVERY_MIN "*) ;;
    *) echo "--every-minutes must divide 60 evenly: 5, 10, 12, 15, 20, 30 or 60."; exit 1 ;;
  esac
fi

case "$AT" in
  [0-9]:[0-9][0-9]|[0-9][0-9]:[0-9][0-9]) ;;
  *) echo "--at wants a 24-hour time, such as 07:30."; exit 1 ;;
esac
START_H=$((10#${AT%%:*}))
MINUTE=$((10#${AT##*:}))
if [ "$START_H" -gt 23 ] || [ "$MINUTE" -gt 59 ]; then
  echo "--at wants a real time of day."; exit 1
fi

# cron gets a minimal PATH, so the interpreter is resolved now and written out
# in full rather than looked up at 02:30 in an environment nothing has set up.
if command -v python3 >/dev/null 2>&1; then
  PY=$(command -v python3)
elif command -v python >/dev/null 2>&1; then
  PY=$(command -v python)
else
  echo "Python 3.8 or newer is needed, and neither 'python3' nor 'python' is on PATH."
  exit 1
fi

# Two shapes, and which one is chosen decides both fields. Sub-hourly runs every
# hour, so the minute carries the step and --at only fixes the offset; hourly
# and slower keep the old behaviour, where --at fixes the minute and the first
# hour and the hours are written out one by one.
MINUTES="$MINUTE"
if [ "$EVERY" = "0" ]; then
  HOURS="*"
  if [ "$EVERY_MIN" -eq 60 ]; then
    MINUTES="$MINUTE"
  else
    MINUTES="$((MINUTE % EVERY_MIN))-59/$EVERY_MIN"
  fi
elif [ "$EVERY" -eq 1 ]; then
  HOURS="*"
else
  HOURS=""
  h=$START_H
  n=0
  while [ "$n" -lt $((24 / EVERY)) ]; do
    HOURS="$HOURS,$h"
    h=$(( (h + EVERY) % 24 ))
    n=$((n + 1))
  done
  # sorted so the line reads in clock order, and comma-joined without the lead
  HOURS=$(printf '%s' "${HOURS#,}" | tr ',' '\n' | sort -n | tr '\n' ',')
  HOURS="${HOURS%,}"
fi

# The marker is how --remove finds this line again, so it must survive things
# that are allowed to change. It names the script's path rather than the
# product, because the product gets renamed and tools/schedule.sh does not.
MARKER="# managed by tools/schedule.sh"

# Both of these are paths from the machine, and they go into a line that a
# shell will parse later. Wrapping them in single quotes is not enough: a single
# quote cannot be escaped inside single quotes, so a project living somewhere
# like /home/sam/Sam's stuff produced a cron line with an unterminated string,
# which crontab accepts and the shell then fails on every ten minutes. The
# .ps1 twin got this right and this half did not, which is the sort of gap that
# only shows up on somebody else's machine.
#
# POSIX quoting for that: end the quote, add an escaped quote, start a new one.
# Parameter expansion rather than sed, because the sed version needs the pattern
# to survive two levels of quoting and the first attempt at it silently emitted
# ''' instead of '\'' - which parses, right up until the path has an apostrophe.
sq() {
  _s=$1; _o=''
  while :; do
    case $_s in
      *"'"*) _o=$_o${_s%%\'*}"'\\''"; _s=${_s#*\'} ;;
      *) break ;;
    esac
  done
  printf "'%s'" "$_o$_s"
}

# `;` rather than `&&` between the two, deliberately: a local refresh that fails
# (no network on this machine, say) must not also cancel the request for the
# deployed site to refresh itself. They answer different questions and neither is
# a precondition for the other.
DISPATCH_CMD=""
if [ "$DISPATCH" = 1 ]; then
  if ! command -v gh >/dev/null 2>&1; then
    echo "--dispatch-remote needs the GitHub CLI on PATH (looked for gh)."
    echo "Install it and run 'gh auth login', or drop the flag."
    exit 1
  fi
  DISPATCH_CMD="; gh workflow run publish.yml -f full=false >/dev/null 2>&1"
fi

LINE="$MINUTES $HOURS * * * cd $(sq "$ROOT") && $(sq "$PY") tools/build_data.py --if-changed >/dev/null 2>&1$DISPATCH_CMD $MARKER"

if [ "$ACTION" = show ]; then
  printf '%s\n' "$LINE"
  exit 0
fi

if ! command -v crontab >/dev/null 2>&1; then
  echo "No crontab on this machine. The line to install by hand is:"
  printf '\n  %s\n\n' "$LINE"
  exit 1
fi

# Read, filter, write. crontab has no edit-in-place that is safe to script, and
# a missing crontab is an error rather than an empty one - hence the 2>/dev/null
# and the || true, which turn "you have no crontab yet" into "start with none".
current=$(crontab -l 2>/dev/null || true)
kept=$(printf '%s\n' "$current" | grep -vF "$MARKER" | sed '/^$/d')

if [ "$ACTION" = remove ]; then
  if ! printf '%s\n' "$current" | grep -qF "$MARKER"; then
    echo "Nothing installed by this script was found in your crontab."
    exit 0
  fi
  printf '%s\n' "$kept" | crontab -
  echo "Removed the refresh job from your crontab."
  exit 0
fi

printf '%s\n%s\n' "$kept" "$LINE" | sed '/^$/d' | crontab -

if [ "$EVERY" = "0" ]; then
  if [ "$EVERY_MIN" -eq 60 ]; then
    echo "Scheduled a data refresh every hour, at :$(printf '%02d' "$MINUTE") past."
  else
    echo "Scheduled a data refresh every $EVERY_MIN minutes."
  fi
elif [ "$EVERY" -eq 1 ]; then
  echo "Scheduled a data refresh every hour, at :$(printf '%02d' "$MINUTE") past."
else
  echo "Scheduled a data refresh every $EVERY hours, at $HOURS:$(printf '%02d' "$MINUTE")."
fi
echo "  runs: $PY tools/build_data.py --if-changed"
echo "  from: $ROOT"
echo
echo "Check it:   crontab -l"
echo "Run it now: ./refresh-data.sh --if-changed"
echo "Remove it:  ./tools/schedule.sh --remove"
