@echo off
REM Refresh the VorFrame dataset from Digital Extremes' drop table and public
REM export, the wiki, and the live worldstate.
REM
REM   refresh-data.cmd                 full refresh
REM   refresh-data.cmd --if-changed    rebuild only if an upstream moved
REM   refresh-data.cmd --check         report staleness, write nothing
REM   refresh-data.cmd --offline       rebuild from the local cache
cd /d "%~dp0"
echo.
python tools\build_data.py %*
set RC=%ERRORLEVEL%
echo.
if "%RC%"=="0" (
  echo Done. Reload index.html in your browser.
) else if "%RC%"=="2" (
  echo Already up to date.
) else (
  echo Build failed. Try:  python tools\build_data.py --offline
)
pause
