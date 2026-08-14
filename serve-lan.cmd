@echo off
REM Serve Warframe Prime Hunter to your whole network, not just this machine.
REM
REM serve.cmd binds to localhost, so only this PC can open the site. This one
REM binds to every interface, so a phone or tablet on the same Wi-Fi can reach
REM it - handy for ticking parts off while you play.
REM
REM Read this before you use it:
REM
REM   * Your collection is NOT shared and cannot be touched. Ticks live in each
REM     browser, so anyone who opens the site gets their own empty tracker.
REM     They cannot see or change yours, and nothing about it ever reaches this
REM     server. Nothing can be written either - it answers GET only.
REM   * Windows Firewall will almost certainly ask for permission the first
REM     time. "Private networks" is the right answer; "Public networks" is not.
REM   * What IS readable is this whole folder, including .cache and its copies
REM     of DE's data, plus directory listings. All public game data - but keep
REM     private files out of the folder.
REM
REM Close this window to stop the server.

cd /d "%~dp0"
echo.
echo   Serving Warframe Prime Hunter to the local network.
echo   Anyone here can open it and gets their own tracker; yours is untouched.
echo   This folder is readable, so keep private files out of it.
echo   Close this window to stop.
echo.
python tools\serve.py --host 0.0.0.0 %*
if errorlevel 1 (
  echo.
  echo Could not start. If the port is busy, close the other server first.
  pause
)
