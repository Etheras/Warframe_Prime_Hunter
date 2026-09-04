#Requires -Version 5.1
<#
.SYNOPSIS
    Register (or remove) a Windows Scheduled Task that keeps this site's data current.

.DESCRIPTION
    The task runs  build_data.py --if-changed  every ten minutes. That call is cheap
    when nothing has moved: it fetches DE's ~500-byte export index, sends one HEAD to
    the drop table, reads the trader window and the current fissures, then rebuilds
    from the local cache. Measured end to end on a warm cache: 1.7 seconds. A full
    download only happens when an upstream actually changed, and every fetch is
    conditional, so a repeat run costs four header exchanges and almost no body.

    Ten minutes, rather than hourly, because of the one source with an hour to live.
    Void Fissures move every hour or two and the pages only ever show ones that have
    not expired, so the badges are exactly as current as this task. The rest of the
    data moves a few times a year and does not care.

    Ten minutes is also well inside what the source asks for: api.warframestat.us
    serves the fissure list behind a CDN with Cache-Control: max-age=120, so this
    polls five times slower than the API's own cache lifetime, and answers a
    conditional request with 304 and no body when nothing has changed.

    -EveryMinutes 30 or -EveryHours 1 if that is more than you want; the trade is
    only how fresh the fissures are. Five minutes is the floor, and that is manners
    rather than a technical limit.

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
    pwsh       -ExecutionPolicy Bypass -File tools\schedule.ps1 -EveryMinutes 30
    pwsh       -ExecutionPolicy Bypass -File tools\schedule.ps1 -EveryHours 8
    pwsh       -ExecutionPolicy Bypass -File tools\schedule.ps1 -Time 07:30
    pwsh       -ExecutionPolicy Bypass -File tools\schedule.ps1 -Remove
#>
[CmdletBinding()]
param(
    [string]$Time = "18:30",
    # Five is the floor on purpose. Task Scheduler will accept one minute, and
    # the endpoint would survive it, but nothing in the data changes that fast -
    # a fissure lasts an hour or two - so anything under five is cost with no
    # answer attached.
    [ValidateRange(5, 1440)]
    [int]$EveryMinutes = 10,
    # Kept for anyone who set it before, and for anyone who wants the old
    # cadence back. Zero means "not given", since PowerShell has no way to ask
    # whether an int parameter was bound without inspecting $PSBoundParameters.
    [ValidateRange(0, 24)]
    [int]$EveryHours = 0,
    [string]$TaskName = "Warframe Prime Hunter data refresh",
    [switch]$Remove,
    [switch]$RunNow,
    # Also force the *deployed* site to rebuild, on the same schedule.
    #
    # The local refresh above keeps this machine's `data/` current. It does
    # nothing for GitHub Pages, which can only ever be as fresh as its last
    # build - and GitHub's own scheduler is best effort, so the ten-minute cron
    # in `publish.yml` was measured delivering about one run every forty-four
    # minutes with a worst gap of two hundred and sixty-eight. Against a fissure
    # that lives an hour or two, that is a published list which has expired in
    # full more often than not.
    #
    # A dispatch from here is not subject to that queue, so it turns the
    # configured cadence into the delivered one. It asks for `full=false`, the
    # light build, because anything else would re-download the wiki and the drop
    # tables every ten minutes.
    #
    # Needs the GitHub CLI, authenticated (`gh auth login`) with permission to
    # run workflows on this repository. Off by default: it is somebody's build
    # minutes and somebody's Pages quota, so it is opted into rather than
    # assumed.
    [switch]$DispatchRemote
)

if ($EveryHours -gt 0) { $EveryMinutes = $EveryHours * 60 }

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

# Every action runs behind a hidden PowerShell rather than directly, and that is
# the whole of the fix of 2026-09-04.
#
# **The problem.** A task registered with the default principal runs under an
# interactive logon, so a console application gets a real console window - which
# appeared and took focus 144 times a day. The owner's word for it was
# "disaster", and it is: it makes the machine unusable while the refresh runs.
#
# **Why not the obvious fixes.** `New-ScheduledTaskSettingsSet -Hidden` is a
# common false lead - it hides the task in the Task Scheduler UI, not the window.
# Running as SYSTEM (`-LogonType ServiceAccount`) or as the user without stored
# credentials (`-LogonType S4U`) both put the task in session 0 where no window
# can exist, and both were rejected here for two measured reasons:
#
#   1. `Register-ScheduledTask` returns **Access is denied** for either
#      principal without an elevated shell, so this script would stop working
#      for anyone running it normally - which is how README documents it.
#   2. Neither account can read the current user's DPAPI store, and `gh` keeps
#      its token in the Windows keyring. The dispatch action would have started
#      failing silently, taking the ten-minute refresh with it.
#
# **`-WindowStyle Hidden` does not work here, and that is the whole trap.** It
# was the first fix tried and it measures as fixed if you ask the wrong
# question: `IsWindowVisible(GetConsoleWindow())` reports False. What is on
# screen is not that window. Windows 11 hosts consoles in **Windows Terminal**,
# a separate process that has its own window and does not care what PowerShell's
# host was asked to do with the legacy console inside it.
#
# Measured on 2026-09-04, polling every 25 ms for any visible top-level window
# owned by a process the task started, and separately checking a marker file to
# prove the command actually ran - because "no window" is satisfied perfectly by
# "nothing happened", which is how an earlier version of that test passed:
#
#   plain action                     windows=1 (WindowsTerminal)  ran=True
#   powershell -WindowStyle Hidden   windows=1 (WindowsTerminal)  ran=True
#   conhost.exe --headless           windows=0                    ran=True
#   mshta.exe vbscript:...           windows=0                    ran=False
#
# So: **`conhost.exe --headless`**. It hosts the console without a window at all
# rather than making one and hiding it, so there is nothing to flash, and the
# child processes attach to that same headless console - which is why python and
# gh are silent too without being wrapped individually.
#
# The two rejected alternatives, both of which do work:
#   - `mshta.exe vbscript:Execute(...)` (the owner's suggestion) is genuinely
#     windowless, but it is also the textbook signature of malware persistence,
#     so antivirus may act on it, and mshta is deprecated. The `ran=False` above
#     is this script's quoting, not a fault in the technique.
#   - A `.vbs` shim run by `wscript.exe` works too and needs a tracked file plus
#     a `.gitattributes` line, for no gain over conhost.
#
# `-Command` with single-quoted paths rather than `-File`: the target is an
# arbitrary executable, not a script. Single quotes survive spaces in a path,
# and any single quote inside one is doubled the way PowerShell requires.
function New-HiddenAction {
    param([string]$Exe, [string[]]$Arguments)
    $q = { param([string]$s) "'" + ($s -replace "'", "''") + "'" }
    $parts = @((& $q $Exe))
    foreach ($a in $Arguments) { $parts += (& $q $a) }
    $inner = "& " + ($parts -join " ")
    $ps = "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command $inner"

    # conhost ships with Windows and `--headless` is what WSL uses, so it is
    # present anywhere this script can run. Checked rather than assumed: without
    # it the task still works and only the window comes back, which is a
    # cosmetic regression rather than a broken refresh.
    $conhost = Join-Path $env:SystemRoot "System32\conhost.exe"
    if (Test-Path -LiteralPath $conhost) {
        return New-ScheduledTaskAction -Execute $conhost `
            -Argument "--headless $ps" -WorkingDirectory $root
    }
    Write-Warning ("conhost.exe not found - the task will work but its window " +
                   "will be visible on every run.")
    New-ScheduledTaskAction -Execute "powershell.exe" `
        -Argument ($ps -replace "^powershell\.exe ", "") -WorkingDirectory $root
}

$action = New-HiddenAction -Exe $python -Arguments @($scriptPath, "--if-changed")

# One task, two actions, in order. Task Scheduler accepts an array and runs them
# sequentially, which is what is wanted: refresh this machine, then ask the
# deployed site to refresh itself. A second task would have been a second thing
# to remove, and a second place for the two schedules to drift apart.
$actions = @($action)
if ($DispatchRemote) {
    $gh = Get-Command "gh" -ErrorAction SilentlyContinue
    if ($null -eq $gh) {
        throw ("-DispatchRemote needs the GitHub CLI on PATH (looked for gh). " +
               "Install it and run 'gh auth login', or re-run without the switch.")
    }
    # `-f full=false` is the whole point of the switch: the light build, the same
    # path the ten-minute cron takes. Without it a dispatch rebuilds every source
    # from scratch - see the FULL expression in .github/workflows/publish.yml.
    $actions += New-HiddenAction -Exe $gh.Source `
        -Arguments @("workflow", "run", "publish.yml", "-f", "full=false")
}

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
    -RepetitionInterval (New-TimeSpan -Minutes $EveryMinutes)

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -DontStopOnIdleEnd `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 30) `
    -MultipleInstances IgnoreNew

$description = "Refreshes Warframe Prime Hunter's Prime data from Digital Extremes' " +
               "drop table and public export. Downloads only when upstream changes; " +
               "otherwise refreshes the live Void Fissure list and rebuilds from " +
               "cache. Every fetch is conditional, so a run that finds nothing new " +
               "transfers almost nothing."

# Before registering, not after: -Force replaces a task of the SAME name, and the
# old one has a different name, so it would otherwise survive alongside the new.
if ($TaskName -ne $LegacyTaskName) { Remove-TaskIfPresent -Name $LegacyTaskName | Out-Null }

Register-ScheduledTask -TaskName $TaskName -Action $actions -Trigger $trigger `
    -Settings $settings -Description $description -Force | Out-Null

if ($EveryMinutes -lt 60) {
    $every = "$EveryMinutes minutes"
} elseif ($EveryMinutes -eq 60) {
    $every = "hour"
} elseif ($EveryMinutes % 60 -eq 0) {
    $every = "$($EveryMinutes / 60) hours"
} else {
    $every = "$EveryMinutes minutes"
}
Write-Host "Scheduled '$TaskName' every $every, first run $Time."
Write-Host "  runs: $python `"$scriptPath`" --if-changed"
if ($DispatchRemote) {
    Write-Host "  then: gh workflow run publish.yml -f full=false"
    Write-Host "        (forces the deployed site to rebuild, light path)"
}
Write-Host "  both hosted by conhost --headless, so no window appears at all."
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
