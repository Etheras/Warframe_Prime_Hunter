#!/usr/bin/env bash
# Serve VorFrame to your whole network, not just this machine. The macOS and
# Linux twin of serve-lan.cmd.
#
# serve.sh binds to localhost, so only this computer can open the site. This one
# binds to every interface, so a phone or tablet on the same Wi-Fi can reach it
# - handy for ticking parts off while you play. It prints the address to type.
#
# Read this before you use it:
#
#   * There is no login and no encryption. Anyone who can reach your machine on
#     this port can see your collection and, because Backup/Restore is in the
#     page, overwrite it. Only use it on a network you trust - your home Wi-Fi,
#     not a hotel or a cafe.
#   * Your firewall may ask for permission the first time. Allow it for private
#     networks only.
#   * It serves the whole folder, including data/ and .cache/. Nothing there is
#     secret - it is all public game data - but be aware it is readable.
#
# The port stays fixed at 8777 so a bookmark on your phone keeps working.
# Press Ctrl+C to stop.

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

echo
echo "  Serving VorFrame to the local network."
echo "  Anyone on this network can view AND change your collection."
echo "  Press Ctrl+C to stop."
echo

exec "$PY" tools/serve.py --host 0.0.0.0 "$@"
