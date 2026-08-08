<#
.SYNOPSIS
    Register (or remove) a Windows Scheduled Task that keeps VorFrame's data current.

.DESCRIPTION
    The task runs  build_data.py --if-changed  once a day. That call is cheap when
    nothing has moved: it fetches DE's ~500-byte export index, sends one HEAD to the
    drop table, and reads the trader window, then exits without rewriting anything.
    A full rebuild only happens when an upstream actually changed.

    No LLM is involved at any point — every source is JSON or a regularly
    structured HTML table, parsed deterministically.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File tools\schedule.ps1
    powershell -ExecutionPolicy Bypass -File tools\schedule.ps1 -Time 07:30
    powershell -ExecutionPolicy Bypass -File tools\schedule.ps1 -Remove
#>
[CmdletBinding()]
param(
    [string]$Time = "18:30",
    [string]$TaskName = "VorFrame data refresh",
    [switch]$Remove,
    [switch]$RunNow
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$script = Join-Path $root "tools\build_data.py"

if ($Remove) {
    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "Removed scheduled task '$TaskName'."
    } else {
        Write-Host "No scheduled task named '$TaskName'."
    }
    return
}

$python = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $python) { throw "python is not on PATH — cannot schedule the refresh." }
if (-not (Test-Path $script)) { throw "Cannot find $script" }

$action = New-ScheduledTaskAction -Execute $python `
    -Argument "`"$script`" --if-changed" -WorkingDirectory $root

$trigger = New-ScheduledTaskTrigger -Daily -At $Time

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -DontStopOnIdleEnd `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 30) `
    -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
    -Settings $settings -Description "Refreshes VorFrame's Prime data from Digital Extremes' drop table and public export. Rebuilds only when upstream changes." `
    -Force | Out-Null

Write-Host "Scheduled '$TaskName' daily at $Time."
Write-Host "  runs: $python `"$script`" --if-changed"
Write-Host "  from: $root"
Write-Host ""
Write-Host "Check it:    Get-ScheduledTask -TaskName '$TaskName'"
Write-Host "Run it now:  Start-ScheduledTask -TaskName '$TaskName'"
Write-Host "Remove it:   powershell -ExecutionPolicy Bypass -File tools\schedule.ps1 -Remove"

if ($RunNow) {
    Start-ScheduledTask -TaskName $TaskName
    Write-Host "`nStarted the task once now."
}
