@echo off
REM Start VorFrame and open it in your browser.
REM Serving the folder (rather than opening index.html directly) is what lets the
REM browser reliably save your collection between visits.
cd /d "%~dp0"

echo.
echo   VorFrame is running at  http://localhost:8777
echo.
echo   Keep this window open while you use the site.
echo   Close it (or press Ctrl+C) to stop.
echo.

REM give the server a moment to bind, then open the browser
start "" /min cmd /c "timeout /t 2 >nul & start "" http://localhost:8777"

python -m http.server 8777 --bind 127.0.0.1
