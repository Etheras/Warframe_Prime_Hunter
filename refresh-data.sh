#!/usr/bin/env bash
# Refresh everything Warframe Prime Hunter needs. The macOS and Linux twin of
# refresh-data.cmd - same behaviour, same options.
#
# It does the lot, first run and every run after:
#
#   * drop tables, item database and the live Prime Resurgence rotation,
#     straight from Digital Extremes
#   * item artwork into assets/img, so the site fetches nothing from the
#     internet while you use it (about 8 MB, first run only - later runs just
#     pick up new Primes and delete pictures no longer needed)
#   * the single-file build in dist/, so it is never older than your data
#
# First run takes a couple of minutes, mostly artwork. Later runs are quick.
#
#   ./refresh-data.sh --if-changed      rebuild only if an upstream moved
#   ./refresh-data.sh --check           report staleness, write nothing
#   ./refresh-data.sh --offline         rebuild from the local cache
#   ./refresh-data.sh --refresh-images  also re-check artwork already on disk
#   ./refresh-data.sh --no-images       skip artwork and use the CDN instead

set -u
cd "$(dirname "$0")"

# Distributions disagree about which name means Python 3.
if command -v python3 >/dev/null 2>&1; then
  PY=python3
elif command -v python >/dev/null 2>&1; then
  PY=python
else
  echo "Python 3.8 or newer is needed, and neither 'python3' nor 'python' is on PATH."
  exit 1
fi

echo
"$PY" tools/build_data.py --with-images "$@"
RC=$?

# Exit code 2 means "--check found nothing to do", which is a success.
if [ "$RC" -eq 2 ]; then
  echo
  echo "  Already up to date. Nothing needed rebuilding."
  echo
  exit 0
fi

if [ "$RC" -ne 0 ]; then
  echo
  echo "  Build failed."
  echo
  echo "  If you are offline, or Digital Extremes are unreachable, you can"
  echo "  rebuild from the last download with:   ./refresh-data.sh --offline"
  echo
  exit "$RC"
fi

# Keep the copy-anywhere build in step with the data it was made from.
"$PY" tools/bundle.py >/dev/null 2>&1 || echo "  (single-file build skipped)"

echo
echo "  Done. Reload the page in your browser."
echo
