#!/usr/bin/env bash
# Start Warframe Prime Hunter and open it in your browser. The macOS and Linux twin of
# serve.cmd.
#
# Serving the folder, rather than opening index.html directly, is what lets the
# browser reliably save your collection between visits.
#
# The port is chosen automatically, starting at 8777 and walking up until one
# is free.
#
#   ./serve.sh              this machine only
#   ./serve.sh --no-browser don't open a browser window
#
# This machine only, and the server refuses to bind anything else. Serving to a
# phone on the same Wi-Fi was removed on 2026-09-01: no encryption, no login,
# and Backup/Import on the page. To host it somewhere properly, see "Hosting it
# somewhere else" in README.md.

set -u
cd "$(dirname "$0")"

if command -v python3 >/dev/null 2>&1; then
  PY=python3
elif command -v python >/dev/null 2>&1; then
  PY=python
else
  echo "Python 3.8 or newer is needed, and neither 'python3' nor 'python' is on PATH."
  exit 1
fi

exec "$PY" tools/serve.py "$@"
