#Requires -Version 5.1
<#
.SYNOPSIS
    Register (or remove) a Windows Scheduled Task that keeps this site's data current.

.DESCRIPTION
    The task runs  build_data.py --if-changed  once a day. That call is cheap when
    nothing has moved: it fetches DE's ~500-byte export index, sends one HEAD to the
    drop table, and reads the trader window, then exits without rewriting anything.
    A full rebuild only happens when an upstream actually changed.

    No LLM is involved at any point - every source is JSON or a regularly
    structured HTML table, parsed deterministically.

    Runs under both Windows PowerShell 5.1 and PowerShell 7+, under Set-StrictMode.
    That rules out a few conveniences: $IsWindows does not exist before 6.0, so
    testing it directly throws under strict mode on 5.1; the three-argument form of
    Join-Path is 6.0+; and ?? and ?: are 7.0+. None are used here.

    On macOS and Linux there is no Task Scheduler. Use cron instead - see README.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File tools\schedule.ps1
    pwsh       -ExecutionPolicy Bypass -File tools\schedule.ps1 -Time 07:30
    pwsh       -ExecutionPolicy Bypass -File tools\schedule.ps1 -Remove
#>
[CmdletBinding()]
param(
    [string]$Time = "18:30",
    [string]$TaskName = "Warframe Prime Hunter data refresh",
    [switch]$Remove,
    [switch]$RunNow
)

# The task this script registered before the project was renamed on 2026-08-14.
# A task already sitting in Task Scheduler keeps the name it was created with,
# so changing the default above is not enough on its own: -Remove would stop
# finding it, and re-registering would leave two tasks doing the same refresh
# twice a day. Both paths below clean it up.
$LegacyTaskName = "VorFrame data refresh"

Set-StrictMode -Version 3.0
$ErrorActionPreference = "Stop"

# 5.1 is always Desktop edition and always Windows. Only ask about $IsWindows on
# editions that define it, because under strict mode reading an undefined
# variable is an error rather than $null.
if ($PSVersionTable.PSEdition -eq "Desktop") {
    $onWindows = $true
} else {
    $var = Get-Variable -Name IsWindows -ErrorAction SilentlyContinue
    $onWindows = ($null -ne $var) -and [bool]$var.Value
}

if (-not $onWindows) {
    Write-Host "Scheduled Tasks are a Windows feature, and this is not Windows."
    Write-Host "Use cron instead. Run 'crontab -e' and add a daily line such as:"
    Write-Host ""
    Write-Host "  30 18 * * * cd /path/to/the/folder && ./refresh-data.sh --if-changed"
    Write-Host ""
    exit 1
}

if (-not (Get-Module -ListAvailable -Name ScheduledTasks)) {
    throw "The ScheduledTasks module is unavailable, so a task cannot be registered."
}

$root = Split-Path -Parent $PSScriptRoot
$scriptPath = Join-Path $root "tools\build_data.py"

# Registered under either name. Named separately from the -Remove path because
# registering has to drop the old one too, or the machine ends up refreshing
# twice a day from two tasks that both think they own the job.
function Remove-TaskIfPresent {
    param([string]$Name)
    $existing = Get-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue
    if ($null -ne $existing) {
        Unregister-ScheduledTask -TaskName $Name -Confirm:$false
        Write-Host "Removed scheduled task '$Name'."
        return $true
    }
    return $false
}

if ($Remove) {
    $gone = Remove-TaskIfPresent -Name $TaskName
    if (Remove-TaskIfPresent -Name $LegacyTaskName) { $gone = $true }
    if (-not $gone) {
        Write-Host "No scheduled task named '$TaskName' (or '$LegacyTaskName')."
    }
    return
}

# Windows installs Python under several names, and the py launcher is common.
# Take the first that exists rather than assuming; the task stores an absolute
# path, so whatever is found here is what runs at 18:30.
$python = $null
foreach ($name in @("python", "python3", "py")) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if ($null -ne $cmd) { $python = $cmd.Source; break }
}
if ([string]::IsNullOrWhiteSpace($python)) {
    throw "No Python on PATH (looked for python, python3, py) - cannot schedule the refresh."
}
if (-not (Test-Path -LiteralPath $scriptPath)) {
    throw "Cannot find $scriptPath"
}

$action = New-ScheduledTaskAction -Execute $python `
    -Argument "`"$scriptPath`" --if-changed" -WorkingDirectory $root

$trigger = New-ScheduledTaskTrigger -Daily -At $Time

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -DontStopOnIdleEnd `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 30) `
    -MultipleInstances IgnoreNew

$description = "Refreshes Warframe Prime Hunter's Prime data from Digital Extremes' " +
               "drop table and public export. Rebuilds only when upstream changes."

# Before registering, not after: -Force replaces a task of the SAME name, and the
# old one has a different name, so it would otherwise survive alongside the new.
if ($TaskName -ne $LegacyTaskName) { Remove-TaskIfPresent -Name $LegacyTaskName | Out-Null }

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
    -Settings $settings -Description $description -Force | Out-Null

Write-Host "Scheduled '$TaskName' daily at $Time."
Write-Host "  runs: $python `"$scriptPath`" --if-changed"
Write-Host "  from: $root"
Write-Host ""
Write-Host "Check it:    Get-ScheduledTask -TaskName '$TaskName'"
Write-Host "Run it now:  Start-ScheduledTask -TaskName '$TaskName'"
Write-Host "Remove it:   powershell -ExecutionPolicy Bypass -File tools\schedule.ps1 -Remove"

if ($RunNow) {
    Start-ScheduledTask -TaskName $TaskName
    Write-Host ""
    Write-Host "Started the task once now."
}
