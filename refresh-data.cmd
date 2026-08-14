@echo off
REM Refresh everything Warframe Prime Hunter needs. This is the normal way to run it -
REM double-click and wait.
REM
REM It does the lot, first run and every run after:
REM
REM   * drop tables, item database and the live Prime Resurgence rotation,
REM     straight from Digital Extremes
REM   * item artwork into assets\img, so the site fetches nothing from the
REM     internet while you use it (about 8 MB, first run only - later runs
REM     just pick up new Primes and delete pictures no longer needed)
REM   * the single-file build in dist\, so it is never older than your data
REM
REM First run takes a couple of minutes, mostly artwork. Later runs are quick.
REM
REM Options, if you ever want them:
REM
REM   refresh-data.cmd --if-changed      rebuild only if an upstream moved
REM   refresh-data.cmd --check           report staleness, write nothing
REM   refresh-data.cmd --offline         rebuild from the local cache
REM   refresh-data.cmd --refresh-images  also re-check artwork already on disk
REM                                      (adds about a minute; only needed if
REM                                      DE repaint an existing item)
REM   refresh-data.cmd --no-images       skip artwork and use the CDN instead

cd /d "%~dp0"
echo.

python tools\build_data.py --with-images %*
set RC=%ERRORLEVEL%

REM Exit code 2 means "--if-changed found nothing to do", which is a success.
if "%RC%"=="2" goto :uptodate
if not "%RC%"=="0" goto :failed

REM Keep the copy-anywhere build in step with the data it was made from.
python tools\bundle.py >nul 2>&1
if errorlevel 1 echo   (single-file build skipped)

echo.
echo   Done. Reload the page in your browser.
echo.
goto :end

:uptodate
echo.
echo   Already up to date. Nothing needed rebuilding.
echo.
goto :end

:failed
echo.
echo   Build failed.
echo.
echo   If you are offline, or Digital Extremes are unreachable, you can rebuild
echo   from the last download with:   refresh-data.cmd --offline
echo.

:end
pause
