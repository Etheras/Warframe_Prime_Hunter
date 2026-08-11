@echo off
REM Serve VorFrame to your whole network, not just this machine.
REM
REM serve.cmd binds to localhost, so only this PC can open the site. This one
REM binds to every interface, so a phone or tablet on the same Wi-Fi can reach
REM it — handy for ticking parts off while you play.
REM
REM Read this before you use it:
REM
REM   * There is no login and no encryption. Anyone who can reach your machine
REM     on this port can see your collection and, because Backup/Import is in
REM     the page, overwrite it. Only use it on a network you trust — your home
REM     Wi-Fi, not a hotel or a cafe.
REM   * Windows Firewall will almost certainly ask for permission the first
REM     time. "Private networks" is the right answer; "Public networks" is not.
REM   * It serves the whole folder, including data/ and .cache/. Nothing there
REM     is secret — it is all public game data — but be aware it is readable.
REM
REM Close this window to stop the server.

cd /d "%~dp0"
echo.
echo   Serving VorFrame to the local network.
echo   Anyone on this network can view AND change your collection.
echo   Close this window to stop.
echo.
python tools\serve.py --host 0.0.0.0 %*
if errorlevel 1 (
  echo.
  echo Could not start. If the port is busy, close the other server first.
  pause
)
