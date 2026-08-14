@echo off
REM Start Warframe Prime Hunter and open it in your browser.
REM Serving the folder (rather than opening index.html directly) is what lets the
REM browser reliably save your collection between visits.
REM The port is chosen automatically - Windows reserves port ranges dynamically,
REM so a fixed one can stop working without warning.
cd /d "%~dp0"
python tools\serve.py
if errorlevel 1 pause
