@echo off
REM Refresh the VorFrame dataset from Digital Extremes' drop table and public
REM export, the wiki, and the live worldstate.
REM
REM   refresh-data.cmd                 full refresh
REM   refresh-data.cmd --if-changed    rebuild only if an upstream moved
REM   refresh-data.cmd --check         report staleness, write nothing
REM   refresh-data.cmd --offline       rebuild from the local cache
REM
REM Artwork:
REM   refresh-data.cmd --with-images     pull item pictures local, once (~14 MB).
REM                                      After that they are kept up to date on
REM                                      every run with no flag needed.
REM   refresh-data.cmd --refresh-images  also re-check pictures already on disk
REM                                      (adds about a minute)
REM   refresh-data.cmd --no-images       ignore them and use the CDN this run
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
