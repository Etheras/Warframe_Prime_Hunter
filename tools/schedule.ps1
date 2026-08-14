#Requires -Version 5.1
<#
.SYNOPSIS
    Register (or remove) a Windows Scheduled Task that keeps this site's data current.

.DESCRIPTION
    The task runs  build_data.py --if-changed  every hour. That call is cheap when
    nothing has moved: it fetches DE's ~500-byte export index, sends one HEAD to the
    drop table, reads the trader window and the current fissures, then rebuilds from
    the local cache in well under a second. A full download only happens when an
    upstream actually changed - so hourly costs four small requests an hour, not
    four downloads.

    Hourly, rather than daily, for two reasons. The "this data is old" banner is the
    thing this task exists to prevent, so the refresh has to run far more often than
    the banner is patient - at twenty-four runs a day it takes a long run of
    failures before anyone sees it. And the fissure strip on the planner only shows
    fissures that have not expired yet, so it is exactly as current as this task:
    hourly it is nearly always right, daily it is always empty.

    -EveryHours 8 if that is too eager; the trade is only how fresh the fissures are.

    No LLM is involved at any point - every source is JSON or a regularly
    structured HTML table, parsed deterministically.

    Runs under both Windows PowerShell 5.1 and PowerShell 7+, under Set-StrictMode.
    That rules out a few conveniences: $IsWindows does not exist before 6.0, so
    testing it directly throws under strict mode on 5.1; the three-argument form of
    Join-Path is 6.0+; and ?? and ?: are 7.0+. None are used here.

    On macOS and Linux there is no Task Scheduler. Use tools/schedule.sh, which
    installs the same job as a cron line.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File tools\schedule.ps1
    pwsh       -ExecutionPolicy Bypass -File tools\schedule.ps1 -EveryHours 8
    pwsh       -ExecutionPolicy Bypass -File tools\schedule.ps1 -Time 07:30
    pwsh       -ExecutionPolicy Bypass -File tools\schedule.ps1 -Remove
#>
[CmdletBinding()]
param(
    [string]$Time = "18:30",
    [ValidateRange(1, 24)]
    [int]$EveryHours = 1,
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
    Write-Host "There is a twin of this script for cron. From the project folder:"
    Write-Host ""
    Write-Host "  ./tools/schedule.sh"
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
# path, so whatever is found here is what runs on every repetition.
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

# -Once with a repetition, rather than N daily triggers: it says "every hour" in
# one object, instead of registering twenty-four of them.
#
# No -RepetitionDuration, and that omission IS the setting: leaving it out emits
# a <Repetition> element with an <Interval> and no <Duration>, which is how the
# Task Scheduler spells "indefinitely". Read back after registering, it reports
# interval PT1H and an empty duration.
#
# This first shipped as -RepetitionDuration ([TimeSpan]::MaxValue), which every
# example on the internet recommends and which fails here:
#
#   Register-ScheduledTask : The task XML contains a value which is incorrectly
#   formatted or out of range. (10,42):Duration:P99999999DT23H59M59S
#
# The lesson is not about MaxValue. New-ScheduledTaskTrigger accepted it happily
# and produced a trigger object that looked right under both 5.1 and 7 - which is
# exactly what was checked, and it proved nothing, because the schema that
# rejects it is only consulted by Register-ScheduledTask. A builder that returns
# an object is not evidence that the object can be stored. Verify at the layer
# that can refuse you.
$trigger = New-ScheduledTaskTrigger -Once -At $Time `
    -RepetitionInterval (New-TimeSpan -Hours $EveryHours)

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -DontStopOnIdleEnd `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 30) `
    -MultipleInstances IgnoreNew

$description = "Refreshes Warframe Prime Hunter's Prime data from Digital Extremes' " +
               "drop table and public export. Downloads only when upstream changes; " +
               "otherwise refreshes the live fissure list and rebuilds from cache."

# Before registering, not after: -Force replaces a task of the SAME name, and the
# old one has a different name, so it would otherwise survive alongside the new.
if ($TaskName -ne $LegacyTaskName) { Remove-TaskIfPresent -Name $LegacyTaskName | Out-Null }

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
    -Settings $settings -Description $description -Force | Out-Null

$every = if ($EveryHours -eq 1) { "hour" } else { "$EveryHours hours" }
Write-Host "Scheduled '$TaskName' every $every, first run $Time."
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
