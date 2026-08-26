# Warframe Prime Hunter — project overview

A local, offline-capable web app presenting **two equal tools over one dataset**: a
**collection tracker** (`index.html`) for what you own, and a **farm planner**
(`plan.html`) for what to run next. Neither is subordinate — they share one build
of the data and one set of saved progress, so a part ticked in either is ticked in
both. Judge a change by whether it serves that shared dataset well.

> **This file must be kept current.** It is the one document to read to understand
> Warframe Prime Hunter, and it is only worth that if it matches the code. **Section 2 sets out
> how to work on this project — read it before changing anything.**

**Last updated:** 2026-08-15

---

## 1. What it does

**Shared**

| Requirement | Where it lives |
|---|---|
| Pull the Prime catalogue from the wiki | `tools/build_data.py` → parses `wiki.warframe.com/w/Prime` |
| Mark what you've **already collected** | Tick on each card, or the button in the detail drawer |
| Track **individual parts**, with quantities | Per-part counters in the drawer; `2/4` on the card |
| Queue something to farm | Crosshair on the card, or *Add to farm list* in the drawer |

**Collection** — `index.html`

| Requirement | Where it lives |
|---|---|
| Show / hide **vaulted** Primes | Sidebar → *Availability → Vaulted (V)* |
| Categories (Warframe, Primary, Secondary, Melee, …) | Sidebar → *Category* |
| Hide collected items | Sidebar → *Collection → Show collected* (untick to hide) |
| **Prime Resurgence (R)** filter | Sidebar → *Availability → Prime Resurgence (R)* |
| **Where to farm the relics** for a Prime | Click any card → *Best places to farm its relics* |
| See what is about to be **vaulted** | `VAULTING SOON` badge on the two oldest farmable releases |

**Planner** — `plan.html`

| Requirement | Where it lives |
|---|---|
| Plan a farm across several Primes at once | Ranked node list, scored against everything queued |
| Bank a part the moment it drops | Click it in the farm list; the plan re-ranks |
| Know **which refinement** to take a relic to | Verdict chip on every relic row, chosen by bottleneck (§7) |
| Fold **Forma** into the ranking | *Forma* have/want field in the planner sidebar, which reads and writes row one of the collection's materials list |
| Say what a run costs you in real time | *Effort — optional* in the sidebar, minutes per objective per mission type (§7) |

Everything you enter lives in the browser's `localStorage`, across six keys —
named once, in `assets/shared.js`, because both pages read and write them:

| Key | Holds | In Backup? |
|---|---|---|
| `wfprimes.collected.v1` | whole items ticked | yes |
| `wfprimes.parts.v1` | per-part counts | yes |
| `wfprimes.materials.v1` | the manual materials checklist | yes |
| `wfprimes.wishlist.v1` | the farm list, shared with the planner | no |
| `wfprimes.plan.v1` | planner options (squad, event, Railjack, run mode, effort minutes) | no |
| `wfprimes.filters.v1` | collection filters, sort and view toggles | no |

**Backup** exports the first three as one document and still accepts the old
bare-array format by expanding each ticked item into fully-owned parts. Imports
are validated against the current catalogue: unknown ids and part names are
skipped, and counts clamped to what the part needs.

**Parts are inventory; collected is a claim you make.** They were the same fact
until 2026-08-24, when owning every part marked the item collected on its own —
wrong in the one direction that matters, because a Prime is four parts *and* a
build, and the app announced the hunt was over while the blueprint was still in the
foundry. Banking the last part now finishes the list and stops there.

- **The card tick** (collection view) and **Mark as collected** (the planner, on a
  finished row) are the two ways in, and both are a sentence you type yourself. The
  tick also sets the parts to match, because claiming the whole thing implies them.
- **It still works the other way.** Taking a part back retracts the claim, so no
  card can read "collected, 2 of 4". Nothing is ever added automatically.
- Items with no parts — cosmetics, Founder gear — were always manually ticked and
  are untouched by any of this.

Progress saved before part tracking existed is migrated on load by treating a
ticked item as "all parts owned", so nothing appears to vanish.

---

## 2. How to work on this project

If you are picking this up cold — human or AI assistant — these are the standing
rules. They exist because the project owner asked for them explicitly and
repeatedly, not because they are conventional. Follow them even when a quicker
route is obvious.

### Keep the documentation current, always

The four markdown files below are part of what this project delivers, not notes
about it. **Update them in the same commit as the change they describe.** A doc that
has drifted is worse than no doc, because it will be trusted.

| File | Who reads it | Update it when |
|---|---|---|
| `README.md` | the owner, day to day | anything visible changes — a control, a label, a workflow |
| `PROJECT.md` | whoever maintains this next | architecture, data sources, the scoring model, or a hard-won gotcha |
| `TODO.md` | both | you spot something worth doing, or finish something (delete the entry — it holds **only** outstanding work) |
| `STYLE.md` | whoever adds UI | a new visual pattern is introduced, or an existing one turns out to be wrong |

If you notice a stale line while doing something else, fix it then. Do not leave
it for a tidy-up pass that will not happen.

### Never put a language model in the data pipeline

Every source is JSON or a machine-generated HTML table with a regular structure,
parsed deterministically. That is what lets a scheduled task keep this site
current for years with nobody watching. **Do not add a step that needs a model,
an API key, or a person reading prose.** Prose sources — patch notes, news posts,
dev streams — were evaluated and deliberately rejected; see §4.

### Fix the wiki, not the app

Where our data knowingly disagrees with `wiki.warframe.com`, that disagreement
belongs in `TODO.md` under *"Should be fixed on the wiki, not here"*, written up
with whatever local override currently compensates. **Do not quietly patch data
to paper over an upstream error.** The wiki is a shared resource; correcting it
helps everyone, while a hidden override here rots silently.

Categories are the deliberate exception: they stay on the wiki because the wiki's
are better than the API's (§7). Availability facts come from Digital Extremes.

### Commit freely, ask before every push

Commit as part of normal work, with a message that explains *why* rather than
what — the diff already says what. **Always ask before `git push`, every single
time.** This is not a permission granted once; a commit is local and reversible,
a push is outward-facing and is the owner's call.

### No build step, and nothing to install

The site is plain HTML, CSS and JavaScript with the data baked into a `.js` file,
so it opens straight from `file://`. **No bundler, no framework, no npm packages,
and adding one is not on the table.** Keep it that way: the thing has to survive
being copied to a USB stick.

Node was installed on this machine on 2026-08-12, and it is a **test runner and
nothing else**. `tests/test_assets.mjs` uses `node:test`, `node:assert` and
`node:vm` from the standard library — no packages at all — and skips itself
where Node is absent.

`tests/test_pages.mjs` goes one step further and drives the real pages in
Chromium through Playwright, which is the only way to cover `app.js` and
`plan.js` without stubbing a browser badly. That one **is** an npm dependency,
so it is strictly opt-in: `package.json` is tracked so anyone who wants it gets
the same version, `node_modules/` is not, and the tests skip with a reason when
it is missing. The browser layer is deliberately the smaller half, because a
test that needs a browser is a test that will eventually be skipped.

**How many tests there are is not written down anywhere, and that is a decision
rather than an omission.** Three figures used to live in this section — Python
alone, plus Node, plus Playwright — the README carried a fourth, and the runner
failed a complete run whose total disagreed with it. All of that went on
2026-08-25. A count answers no question a reader actually has: it says how finely
the suite was sliced, never what is covered. It went stale on every commit that
added a test, so a one-line test meant re-editing several documents and
re-measuring a number nobody acts on — and twice it was written down wrong in the
same commit that documented it. **Do not reintroduce one.** The run passes or it
does not; that is the signal.

**A green CI is not evidence that the whole suite passed**, and the gap is worth
knowing as a shape rather than as a number. A GitHub runner is Linux and runs the
suite *before* the build step, so four groups skip there for four different
reasons: `built payload` (`data/` does not exist yet), `task registration` (a
Windows-only feature), `page tests` (Playwright is not installed on the runner)
and `clone-and-build` (needs `--online`). The runner names every skip and its
reason in its own output, so nothing is hidden — it just has to be read rather
than inferred from an exit code. A green CI means everything reachable on a cold
Linux box passed, which is a different and still useful claim, and it is why the
complete local run stays the gate.

The GitHub CLI is a third recommendation, and answers a different question
from the tests: whether the *published* build agrees, on a clean Linux machine
with no cache and none of your local state. `gh run list` and
`gh run view --log-failed` are the two worth knowing. It earned its place -
this suite passed locally while CI was red for two commits, because a source
that is optional in spirit was fatal in code and only a cold runner hit it.
`README.md` has the install and usage.

The line that must not move: **nothing the site ships may depend on any of
this.** No bundler, no framework, no runtime package. Node, Playwright and `gh`
are all recommended, all optional, and each is skipped cleanly when absent.

### Showing a proposal before building it

`temp_mockup.html` is a scratchpad at the repo root for **showing what a change
would look like, against real data, before writing any of it.** It loads
`data/prime-data.js` and `assets/styles.css` exactly as the real pages do, so
a draft is made of live numbers in the app's own visual language rather than
invented figures in a wireframe.

Use it when a proposal is easier to react to than to read — a new column, a
different ranking, a reworked row — and when the alternative is a wall of prose
about a layout. It holds one idea at a time and no history.

#### Clear it once the proposal has been decided

**Clearing the mockup is part of finishing the work, not a tidy-up afterwards.**
The moment the idea it argues has been shipped, rejected or deferred, delete the
file or overwrite it with the next one. Do it in the same pass that updates the
documentation, for the same reason.

It rots faster than anything else here and is the only thing nothing watches. It
is gitignored, so no diff shows it; no test reads it; it is not part of the site;
and nobody opens it except the one time it is being shown. Every guard this
project has runs somewhere else.

**And it rots into the one shape that gets believed.** A stale mockup does not
throw, and it does not look broken — it shows *old numbers, in the app's own
visual language*, which is exactly the authority it was built to borrow. The
failure mode of this file is a confident screenshot of something that stopped
being true, which is worse than having no mockup at all.

That is not hypothetical. On 2026-08-24 this scratchpad was still holding the
decisions 5 and 9 draft from before the rename ten days earlier: it asked for
`data/vorframe-data.js` and three `VorFrame*` globals, none of which had existed
since 2026-08-14. It could not have rendered at all, and nothing had noticed,
because nothing looks. Both decisions had shipped by then — the draft was arguing
a case that was already closed.

So: **decided means cleared.** If you want to keep what it showed, the finding
belongs in `TODO.md` or in this file as prose, which is where things are allowed
to persist.

**If you are an AI assistant working on this project, this is the mechanism to
reach for.** Write the mockup, serve it, and show it. Do not compute example
numbers by hand in a side script and paste them into static HTML — wire the page
to the real dataset so what the owner sees is what the data actually says.

```bash
python tools/serve.py                           # then open /temp_mockup.html
```

**Use `serve.py`, and since 2026-08-25 that works.** It used not to: `serve.py`
sends the app's strict CSP to every response, a mockup is one file with an inline
`<style>` and an inline `<script>`, so both were blocked — the page sat on
*Loading…* with the reason only in the console, and the documented way to show a
proposal silently produced a blank page. The policy now carries exactly one
exception, scoped to the one file that already had a local-only carve-out. See
*One inline exception, one file wide* in §5 for what it does and does not relax.

Three rules, all enforced rather than remembered:

- **Gitignored.** It never reaches GitHub, so a half-formed idea cannot be
  published by accident.
- **Localhost only.** `serve.py` refuses it to any non-loopback peer, checked by
  address — `serve-lan` binds `0.0.0.0`, so being gitignored is not enough on its
  own. A guest on your Wi-Fi gets a `403`, and the tests assert both directions.
- **Not part of the site.** Nothing in `index.html`, `plan.html`, the bundle or
  the published build references it. It is never a place to put real features.

### Edit source files with an editor, never through a shell

**Never write `assets/*.js`, `assets/*.css`, `tools/*.py`, `tests/*` or any
`.html` file with a shell heredoc, a redirect, `sed -i`, `Set-Content` or
`python -c`.** Open the file and edit it.

This is not style. A shell parses the text on its way into the file, and it has
mangled this project three separate times:

- `\b` arrived as a literal backspace byte, so `/^Faceoff\b/i` shipped as
  `/^Faceoff\x08/i` — a regex that matches nothing, throws nothing, and simply
  never showed the badge it was written for.
- `\n` inside a JavaScript string arrived as a real newline and split the string
  across two lines.
- A stray multibyte character rode in from a paste.

Every one of those passes `node --check` and `ast.parse`, and looks correct in a
diff — the byte is invisible in an editor. The cost is not the bug, it is that
the bug presents as *behaviour that quietly does not happen*, which is the most
expensive thing to debug in a codebase with no runtime.

Three layers hold the rule, because remembering it demonstrably did not work:

- **A test that catches the damage.** `test_no_source_file_carries_a_control_byte`
  sweeps every source file for control bytes outside tab, newline and carriage
  return. It runs in the offline suite and in CI.
- **A hook that refuses the path.** `tools/guard_shell_writes.py` reads a
  PreToolUse payload and denies any shell command that would write a guarded
  file, with an explanation of what to do instead. It stays out of the way of
  reads, greps, builds and redirects to `/tmp` — `test_the_guard_refuses_shell_writes_to_source`
  asserts both directions, because a guard that over-blocks gets switched off.
  The wiring lives in `.claude/settings.local.json`, which is gitignored along
  with the rest of `.claude/`; `README.md` has it for anyone setting up a fresh
  machine.
- **This paragraph**, so the next person to hit a silently-dead regex knows the
  first thing to check.

Generated files are exempt and always were — `data/`, `.cache/` and `dist/` are
written by the build and verified by it.

### Never pick a test's subject with the code under test

A browser test usually has to find something in the live dataset to act on — an
item that can only be farmed on Railjack, a node behind the Steel Path. The
obvious way to find it is to call the classifier that decides. **Do not.**

Break that classifier and the search returns nothing, the `if (!found) return`
guard fires, and the test reports success having checked nothing at all. It is
not a hypothetical: a one-character mutation to the Steel Path regex left the
unit tests red — five of them — and the browser test green.

So select on something the code under test does not own:

- a **property of the raw data**, like a node name matching `(Steel Path` or a
  planet matching `Proxima`; or
- a **named subject**, like Nyx Prime, where no simple property picks it out
  without reimplementing the classifier.

And replace the early return with an assertion. "There is nothing here to test"
is a finding, not a pass — if it is ever genuinely true, someone should read the
message and delete the test deliberately.

Check both directions when you write one: mutate the classifier, confirm the test
goes red, revert. A test that cannot fail is worse than no test, because it is
counted.

### Renaming the project, if it happens again

Renamed to `Warframe Prime Hunter` on 2026-08-14, from `VorFrame`. The deliverable
was never the rename — the owner expects to change it again — but **making the next
one cheap**, by taking the name out of everywhere it is load-bearing:

| Was | Is now | Why |
|---|---|---|
| `vorframe.*` storage keys | `wfprimes.*` | keyed to **what the data is**, not what the app is called. The game will still be Warframe and these will still be Primes whatever we end up called |
| `window.VORFRAME_DATA` | `window.WFPRIME_DATA` | same |
| `VorFrameShared/Rotation/Model` | `WFPrimeShared/…` | same |
| `data/vorframe-data.js` | `data/prime-data.js` | same |
| `"vorframe": 3` in a backup | `"format": 3` | a file format carrying a brand needs rewriting every time the brand does |
| `dist/vorframe.html` | `dist/warframe-prime-hunter.html` | **keeps the name on purpose** — it is what people download |
| `User-Agent: VorFrame/1.0` | `WarframePrimeHunter/1.0` | ditto, out of politeness to the APIs |

**The standing rule: do not add a fifth load-bearing use.** New storage keys,
globals, filenames and URLs should not carry the product name. Prose can say it as
often as it likes — prose is free to change.

The 2026-08-14 rename took two passes because the first missed seven files. Steps 2
and 4 are what it skipped:

1. **Find every mention.** `git grep -il "warframe prime hunter\|WarframePrimeHunter\|warframe-prime-hunter"`
   — 31 files today. Almost all prose, and prose is a find-and-replace. **Files you
   never open are where a rename dies:** last time it was `tools/schedule.ps1`, whose
   task name is not prose at all.
2. **Change the six things that are not prose.** Everything else can be wrong for a
   release and nobody is harmed; these cannot.

   | Where | What | If you get it wrong |
   |---|---|---|
   | `tools/schedule.ps1` | `$TaskName`, and `$LegacyTaskName` set to the **outgoing** name | two tasks refresh the same folder, or `-Remove` stops finding the old one |
   | `tools/bundle.py` | `OUT_FILE` | this is the file people download, and the workflow copies it by name |
   | `.github/workflows/publish.yml` | that filename, and the `-A` user agent | the publish step fails, or publishes nothing under the old link |
   | `.github/workflows/publish.yml` | the **cache key prefix** — leave the old one in `restore-keys` | a stored cache keeps the key it was written with, so renaming the prefix orphans every one. **This happened on 2026-08-14**: 31 caches unreachable from one line's change, CI cold every run afterwards, and green only until an upstream refused a datacenter IP with nothing cached to fall back on |
   | `tools/sources.py` | `UA` | nothing breaks; it is a courtesy to the APIs and should stay honest |
   | `package.json` | `name` | npm refuses some names — lowercase, no spaces |
   | `LICENSE`, `NOTICE.md` | the copyright line and the disclaimer | legal text should name whatever the thing is called |

3. **Leave the load-bearing names alone** — the `wfprimes.*` keys, the `WFPRIME_*`
   globals, `data/prime-data.{js,json}`, `format: 3`, and the cron marker in
   `tools/schedule.sh`. Renaming a storage key needs a copy-not-move migration;
   `LEGACY_PREFIX` in `shared.js` is the pattern and has its own test.
4. **Re-run the search from step 1.** It should return only files you meant to leave.
5. **`python tests/test_build.py`.** The suite reads several of these by name — the
   storage keys, the bundle filename, the two page titles — so a half-done rename
   fails a test rather than surfacing months later.

**Four things keep the old spelling deliberately, and a search for the old name
finds all four looking like misses:** `LEGACY_PREFIX = "vorframe."` in `shared.js`
(reads the pre-rename store), `vorframe-sources-` in the workflow's `restore-keys`
(reaches caches saved under the old prefix), `$LegacyTaskName` in `schedule.ps1`,
and the planted `vorframe.*` keys in `test_assets.mjs` — the fixture *is* the old
world, so a migration test cannot use the new names.

#### The repository was renamed too, on 2026-08-15

`VorFrame` → **`Warframe_Prime_Hunter`**, and made public at the same time. Four
things moved, and only four: the GitHub setting, `git remote set-url origin …` in
this clone, the `git clone` and `cd` lines in `README.md`, and the note that used
to explain why the repo and the app had different names — which goes when the
mismatch does. The local folder is still called `VorFrame` and that is fine;
nothing reads it.

**Nothing in the code moved, and that is the point of the section above.** A
repository rename touches no storage key, no global, no filename and no cache
prefix, because none of them carries the product name any more.

**The cost that was warned about here did not land, for a reason worth keeping.**
GitHub redirects the old *repository* URL indefinitely, so clones keep working —
but the **Pages URL is not redirected**, and for a site whose whole point is being
open on a phone next to the game, a broken bookmark is the expensive part. It cost
nothing this time only because the repo had been private, so the `deploy` job's
`github.event.repository.private == false` guard had never once let a Pages build
through. There was no published address to break. **Rename before you publish, or
not at all** — from now on `https://etheras.github.io/Warframe_Prime_Hunter/` is a
bookmark somebody has, and the next rename really does cost what this one was
supposed to.

Going public has one other consequence: that same guard now passes, so every push
to `main` and every daily cron actually publishes rather than building and stopping.

### Verifying a change

**Two different runs, for two different moments.** Decided 2026-08-25, after a
stretch of work in which the full suite was run after every small edit — a wall of
green says nothing about the four lines you just changed, and the habit trains you
to skim the one output that should never be skimmed.

**While building, run only what covers what you touched.** The Node suites are
addressed directly; there is no filter flag on `test_build.py`.

```bash
node --test tests/test_assets.mjs
```

| Touched | Run |
|---|---|
| `assets/rotation.js`, `assets/shared.js` | `node --test tests/test_assets.mjs` |
| `assets/model.js` | `node --test tests/test_model.mjs` |
| `assets/plan.js`, `assets/app.js`, either page | `node --test tests/test_pages.mjs` |
| `tools/*.py`, the data pipeline | `python tests/test_build.py` — no finer split |

**Before pushing, the full run, every time — and then check CI.**

```bash
python tests/test_build.py
```

It needs no network and takes about half a minute — the Playwright page tests are
most of it, so without them it is a second or two — and that one command covers the
JavaScript too: the `.mjs` suites run under Node's test runner and their results are
folded into the same output. `--online` adds a real clone-and-build into a temp
directory, which is the only check covering the new-user path. Every test is there
because of a bug that actually happened, and says which in its docstring.

`gh run list` afterwards answers what no local run can — whether a clean Linux
runner with no cache agrees. It has earned its place: the local suite passed while
CI was red for two commits.

**Expect CI to pass fewer checks than a local run, and do not read the gap as a
failure** — four groups skip there for four different reasons: `built payload` (the
suite runs before the build step, so `data/` does not exist yet), `task
registration` (a Windows feature), `page tests` (no Playwright on the runner) and
`clone-and-build` (needs `--online`). Each one prints its own reason. So `app.js`
and `plan.js` get `node --check` on CI and nothing else, which makes the **local**
Playwright run the only evidence those two files work.

What is left in `app.js` and `plan.js` is rendering and event wiring. The logic
worth asserting was moved out of them — `assets/model.js` and
`assets/rotation.js` — precisely so it could be tested without a browser, and
that is where the zero-dependency tests point. The pages themselves are
syntax-checked on every run, and covered properly only when Playwright is
installed.

Also verify in a browser
and **say plainly what you actually checked**, rather than asserting it works:

```bash
python tools/build_data.py --offline   # rebuild from the cache, a few seconds
python tools/serve.py                  # then look at it
```

Reset state between checks with `localStorage.clear()`, and leave it clean when
you finish — the owner's real collection lives in those keys.

---

## 3. Running it

The site is plain HTML/CSS/JS with the data baked into a `.js` file, so it needs
no server and no install. Double-click `serve.cmd`, or:

```bash
python -m http.server 8777 --bind 127.0.0.1
```

then open <http://localhost:8777>.

`start index.html` works too, but some browsers restrict `localStorage` on
`file://`, which would lose the collection between visits — so `serve.cmd` is the
path `README.md` tells the user to take.

### Refreshing the data

```bash
python tools/build_data.py
```

or double-click `refresh-data.cmd`.

| Flag | Effect |
|---|---|
| *(none)* | Full refresh from every source |
| `--if-changed` | Probe upstream; rebuild **only** if something moved. This is the one to automate |
| `--check` | Report what's stale and exit without writing. Exit `0` = stale, `2` = up to date |
| `--offline` | Rebuild from the local HTTP cache, no network |
| `--source mirror` | Skip DE's drop table and use the community mirror |
| `--verbose` | Print join diagnostics (unmatched names, etc.) |
| `--with-images` | Download artwork into `assets/img/` (~8 MB) and repoint every item at the local copy, so the app makes **no external requests at runtime**. Needed **once**: after the folder exists the build keeps using and updating it with no flag. Gitignored — DE's artwork, not ours to redistribute. `bundle.py` rewrites these paths back to the CDN, since local files cannot travel inside one `.html`. |
| `--no-images` | Ignore `assets/img/` this run and point the site at the CDN. |
| `--refresh-images` | Also re-check artwork already on disk against the CDN, by size. Adds about a minute, so it is not the default — DE almost never repaints an existing item. |

---

## 4. Keeping it current, without an LLM

Every source is either JSON or a machine-generated HTML table with a completely
regular row structure, so the whole refresh is deterministic parsing — there is no
model in the loop and no API key to hold. A scheduled task can maintain the site
indefinitely on its own.

### Install the ten-minute task

```powershell
powershell -ExecutionPolicy Bypass -File tools\schedule.ps1
```

Registers a Windows Scheduled Task ("Warframe Prime Hunter data refresh") that runs
`build_data.py --if-changed` **every ten minutes**. Options: `-EveryMinutes 30`,
`-EveryHours 8`, `-Time 07:30`, `-RunNow`, `-Remove`. `tools/schedule.sh` installs
the same job into cron on macOS and Linux, with the same defaults — a test compares
the two, because a default changed on one platform and left alone on the other is
not a visible mistake. The same test reads the interval out of the published
workflow and out of the page's own poll, so all three move together or the suite
says so.

**Why ten minutes.** One reason, and it is not "to be current for its own sake":

- The **fissure badges** on the ranked nodes only appear for fissures that have not
  expired, and a fissure runs an hour or two. They are exactly as fresh as this
  task. At ten minutes they are as good as live; hourly they were mostly right;
  daily there are never any.
- The **"this data is old" banner** the task also exists to prevent gets the same
  cover for free. It is patient for 14 days, so at 144 runs a day the margin is
  absurd — which is fine, because the margin was never the binding constraint.

**Why that is not rude.** The one source polled every run is
`api.warframestat.us/pc/fissures`, and it is 5× slower than what that endpoint asks
for: it sits behind a CDN advertising `Cache-Control: max-age=120`, so a
two-minute-old answer is one it is happy to serve to anyone. Every fetch is
conditional — measured against the live endpoint, an `If-None-Match` with the stored
validator returns **304 and zero bytes** — so a run that finds nothing new
transfers essentially nothing. Five minutes is the floor the script enforces, and
that is manners rather than a technical limit; nothing in the data changes faster
than that.

The whole run costs **1.7 seconds** on a warm cache, measured end to end.

The `.DESCRIPTION` block in `tools/schedule.ps1` still calls this the "fissure
strip", which it stopped being on 2026-08-14 — see `TODO.md`.

### Why `--if-changed` is cheap

It fetches a fingerprint before doing any real work:

| Probe | Cost | Catches |
|---|---|---|
| DE Public Export index hash | ~500 bytes | New Primes, any game build |
| `HEAD` on warframe.com/droptables | headers only | Vaultings, unvaultings, drop changes |
| Varzia trader window | small JSON | Resurgence rotation flip (every 28 days) |
| `/pc/fissures` | small JSON | where relics can be cracked in the next hour |

Fingerprints live in `.cache/state.json`. The first three decide whether anything is
downloaded. The fissure list is fetched every run regardless and never enters the
fingerprint, because it changes constantly — putting it in would mean a full download
every ten minutes to learn something a 10 KB document already said.

So a quiet run costs four small requests and a rebuild **from the cache**, which
takes 1.7 s end to end. It used to exit having written nothing at all; it now
rewrites the payload, because the fissures in it have moved even when nothing else
has.

**Every fetch is conditional.** A cached body is stored with the `ETag` that came
with it, in a `.etag` file beside it — one per key, so a bad write cannot poison
another source — and the next request sends it as `If-None-Match`. A 304 is treated
as success and answered from the cache. That is what makes a ten-minute schedule
cost about as much as an hourly one used to: the requests still happen, the bodies
mostly do not.

### Or let GitHub run it

`.github/workflows/publish.yml` does the same job in CI, with no secrets (every
source is public) and no `pip install` (stdlib only). It builds, asserts the result
is sane — at least 120 items, 40 Warframes, 500 relics, and something farmable —
then publishes to GitHub Pages. The item floor is 120 rather than something nearer
the real 167 because a wiki-less build is legitimately thinner; it is there to catch
an empty parse, not to police the catalogue.

**Two schedules, and the difference between them is the point.**

| Cron | What runs | Why |
|---|---|---|
| `40 18 * * *` | probe, full test suite, full fetch, cache **saved** | Resurgence flips at 18:00 UTC; this is the build that fills the cache |
| `*/10 * * * *` | cache **restored read-only**, `--if-changed`, no probe, no tests | the fissure list, and nothing else, at the cadence it deserves |

The short run exists because the published site had the one gap the local task did
not: rebuilt once a day, it always found the fissures expired and marked no row at
all. It takes the heavy sources from the restored cache, so it is not re-downloading
the wiki, the drop tables and DE's export 144 times a day — and it uses
`actions/cache/restore` rather than `actions/cache`, because the latter saves a new
entry whenever its key missed, and that key misses by construction. Left as it was,
the ten-minute run would have written a fresh copy of `.cache` 144 times a day and
evicted everything else the repository keeps.

**Three things to know before changing that number.** GitHub schedules are best
effort — five minutes is the documented floor, and runs are queued, delayed, and
dropped entirely under load, so ten minutes is a target rather than a guarantee.
Pages allows on the order of ten deployments an hour; six is comfortably inside
that, three-minute polling would not be.

And **a cancelled refresh is normal.** Every run shares one concurrency group,
because deployments to Pages have to serialise, and GitHub keeps only one run
pending per group — so a refresh still waiting for a runner is cancelled when a
newer run queues behind it, and a cancelled run is reported as `failure`. A red
mark against a scheduled run in the Actions tab usually means this. It is the
right outcome: the run that replaced it publishes fresher fissures than the one
that was dropped. Observed on 2026-08-24, a 13:41 refresh waited thirteen minutes
for a runner, never ran a step, and was cancelled when a 13:54 push arrived.

If that noise ever becomes a problem, the fix is not `cancel-in-progress` — it
would let a ten-minute refresh kill the daily build that fills the cache. It is to
give the refresh its own concurrency group and accept that two deploys can then
race, where the loser is simply an older set of fissures.

A cold cache falls through to a full build, which is the right failure: slower,
never thinner.

### The wiki is generated, never written

**Turned on 2026-08-24, and generated from the first page.** A GitHub wiki is a
second place a fact can live, and the failure this project keeps having is a fact
that was true in one place and stale in another — a tooltip that claimed the app
could not see fissures for ten days after it could, a comment describing a UI
element that had been replaced, and a README test count that was wrong for most of
its life. That last one was eventually answered by deleting the count rather than
by fixing it again (§*Verifying a change*). A hand-written wiki would be the worst
version of the same failure, because nothing in the suite would ever look at it.

So `tools/wiki.py` assembles every page out of **named sections of `README.md`,
`PROJECT.md` and `TODO.md`**, rewrites repo-relative links to `github.com`, shifts
headings to sit under the title GitHub renders from the filename, and emits a
`_Sidebar` and `_Footer`. Every page carries a banner saying it is generated and
that edits made on github.com are overwritten — and they are, because the publish
step replaces the page set wholesale rather than merging into it.

**A missing section is a build failure.** Headings get reworded, and the failure
mode that matters is the quiet one: a published page that loses half its content
and stays up for months. `python tools/wiki.py --check` resolves every heading in
the manifest and exits non-zero if one has moved; the suite runs it, so a rename
breaks the build in front of whoever renamed it.

`.github/workflows/wiki.yml` is separate from `publish.yml` for one reason:
pushing to `.wiki.git` needs `contents: write`, and `publish.yml` says in its own
header that it is read-only against the repository. Splitting them keeps that true
of the workflow that builds and deploys the site. The default `GITHUB_TOKEN` is
enough for a wiki in the same repository, so this still needs no secret.

It runs on documentation pushes, daily an hour after the full build so the
figures on the landing page are that build's, and by hand — **never** on the
ten-minute schedule. Nothing on these pages moves that fast, and a wiki with 144
commits a day is one nobody can read the history of. The job commits only when the
generated content actually differs.

**The dataset is never committed.** It is built in CI and handed to Pages as an
artifact, so the repo stays source-only (40 files, ~760 KB, over half of it these
four documents) and DE's data is not
redistributed — each build pulls it fresh. The workflow holds `contents: read`, so
it cannot modify the repository at all.

That is also why `data/prime-data.js` is gitignored: a clone has no data until
`build_data.py` runs, which the README makes the first step.

**It is also why the Pages source must be *GitHub Actions* and not *Deploy from a
branch*.** The two settings look interchangeable and are not: a branch build serves
the repository as committed, and the dataset is deliberately not in it, so the
published page loads and then announces *"No data yet. Double-click
refresh-data.cmd"* — advice that means nothing to a stranger on a phone. Only the
workflow has a dataset to hand over, because it is the thing that builds one.
Observed on 2026-08-16, when Pages was first enabled on the branch default and
published exactly that.

### Packaging

Considered and rejected: **Docker**. There is nothing to containerise — no
dependencies, no services, no version pinning — so an image would add a large
runtime requirement to isolate a folder of static files and one stdlib script. It
only starts to make sense on an always-on box (NAS/home server), and even there
GitHub Pages plus the CI cron covers the same ground for free.

What is provided instead:

| Want | Use |
|---|---|
| Run it locally | `serve.cmd` |
| One file to carry around | `tools/bundle.py` → `dist/warframe-prime-hunter.html` (1.6 MB, fully inlined) |
| Reach it from a phone | GitHub Pages + the refresh workflow |

### What deliberately isn't used

**Official news posts and forum update notes are prose.** Extracting "which Primes
were just unvaulted" from them reliably needs a language model, which is exactly
what you asked to avoid. Everything those posts announce shows up in the structured
feeds above at the same time or sooner, so nothing is lost by skipping them.

---

## 5. Layout

```
Warframe Prime Hunter/
├── README.md               ← plain-language guide: install, use, update
├── PROJECT.md              ← this file (how it's built)
├── TODO.md                 ← outstanding work only; decisions live here in §7
├── STYLE.md                ← the visual rules a new page has to follow
├── LICENSE                 ← MIT, scoped to our own code
├── NOTICE.md               ← upstream sources and their terms
├── index.html              ← the collection: filters, cards, detail drawer
├── plan.html               ← the farm planner (Stage 2)
├── serve.cmd / serve.sh    ← serve the site and open a browser
├── serve-lan.cmd / .sh     ← same, but reachable from your network (no login!)
├── CHANGELOG.md            ← GENERATED — what became farmable between builds
├── refresh-data.cmd / .sh  ← the one way to look after the site
├── assets/
│   ├── styles.css          ← all styling (dark Orokin theme)
│   ├── shared.js           ← the store, tooltip, staleness banner, backup file
│   ├── rotation.js         ← what one run at a node is worth
│   ├── model.js            ← relic value, refinement, item status, backups
│   ├── app.js              ← filtering, collection state, detail drawer
│   └── plan.js             ← wishlist, scoring model, ranked node plan
├── data/
│   ├── prime-data.js    ← GENERATED — window.WFPRIME_DATA = {...}
│   ├── prime-data.json  ← GENERATED — same payload as plain JSON
│   └── fissures.json    ← GENERATED — just the fissures, re-read every 10 min
├── .github/workflows/
│   ├── publish.yml         ← daily full rebuild + a ten-minute fissure refresh
│   └── wiki.yml            ← regenerates the GitHub wiki from the docs
├── tests/
│   ├── test_build.py       ← the suite, and the one command to run
│   ├── test_assets.mjs     ← rotation + store, under Node
│   ├── test_model.mjs      ← relic value, refinement, backups
│   └── test_pages.mjs      ← the real pages in Chromium; needs Playwright
├── tools/
│   ├── build_data.py       ← orchestration, the item join, and emit
│   ├── sources.py          ← network, HTTP cache, warm/cold STALE/MISSING policy
│   ├── catalogue.py        ← the wiki Prime page, and the shared vocabulary
│   ├── relics.py           ← drop tables -> relic contents and relic sources
│   ├── artwork.py          ← optional local image copies (--with-images)
│   ├── official.py         ← parsers for DE's drop table + public export
│   ├── bundle.py           ← inlines everything into dist/warframe-prime-hunter.html
│   ├── serve.py            ← local server, picks a working port
│   ├── wiki.py             ← builds the GitHub wiki out of the docs (§4)
│   ├── guard_shell_writes.py ← the PreToolUse hook that refuses shell writes (§2)
│   ├── schedule.ps1        ← installs/removes the ten-minute Scheduled Task
│   └── schedule.sh         ← the same job in cron, for macOS and Linux
├── dist/                   ← GENERATED — single-file build, gitignored
└── .cache/                 ← GENERATED — HTTP cache + state.json, safe to delete
```

Files marked GENERATED are rebuilt by `build_data.py`; don't hand-edit them.

---

### File encodings and line endings

Everything is UTF-8 with no BOM, and line endings are chosen by what each file's
interpreter actually needs — not by preference. Both are pinned in
`.gitattributes` and checked by the suite, because neither failure is visible
while editing:

| Type | Endings | Charset | Why |
|---|---|---|---|
| `.cmd` | **CRLF** | ASCII | `cmd.exe` cannot parse an LF-only batch file, and reads them in the OEM codepage rather than UTF-8 |
| `.ps1` | **CRLF** | ASCII | Windows PowerShell 5.1 reads BOM-less files as ANSI, so non-ASCII becomes mojibake |
| `.sh` | **LF** | ASCII | A CRLF shell script fails to start at all: `bad interpreter: /usr/bin/env bash^M` |
| everything else | LF | UTF-8 | Python, browsers and git all handle either; LF keeps diffs consistent |

The two launcher families break in exactly opposite ways, which is why both are
asserted rather than assumed. `.ps1` must also run under **both Windows PowerShell
5.1 and pwsh 7+** under `Set-StrictMode`, which rules out a few conveniences —
`$IsWindows` does not exist before 6.0 and *throws* under strict mode rather than
being false, the three-argument `Join-Path` is 6.0+, and `??`/`?:` are 7.0+. The
suite checks for each.

### Markup is held to XML well-formedness, but served as HTML5

The pages parse cleanly as XML and a test keeps them that way — void elements
self-closed, boolean attributes given values, named entities replaced by literals.

They are still **served as `text/html`**, deliberately. Serving as
`application/xhtml+xml` would make any well-formedness error fatal at runtime: a
blank page with an XML error rather than a page a browser quietly repaired. With
23 `innerHTML` sites building markup from data, one bad fragment would take the
whole app down in front of whoever was using it.

Checking it in the suite catches the same class of mistake — the ambiguity a
lenient parser hides — at the cost of a red test instead. Same discipline, failure
moved earlier and off the user's screen. XHTML prevents no attack, so nothing
security-related is given up by this choice.

### What the server exposes, and what it refuses

`serve.py` is `SimpleHTTPRequestHandler` underneath, which the standard library
does not present as a hardened server. It gets path traversal right — `../` and
its encodings were tried and all return 404 — but by default it publishes the
whole directory it is pointed at, with browsable listings.

For this folder that meant **`.git`**, pack files included, from which a private
repository can be reconstructed; plus `.cache/`, `tools/` and `tests/`. So it
serves an **allowlist** instead: the ten files the two pages ask for — both pages,
six assets, the dataset, and `data/fissures.json` for the ten-minute re-read —
plus flat files under `assets/img/`, and nothing else. An
allowlist rather than a blocklist
deliberately — a blocklist has to predict what is worth hiding, and `.git` was
on nobody's list until someone checked.

It also sends a Content-Security-Policy with **no `unsafe-inline` and no
`unsafe-eval`**, which is only possible because the app has no inline scripts,
no inline event handlers and no `style=` attributes. Two `onerror` attributes on
artwork were the last obstacle, and became one capture-phase listener; four
`style=` attributes became utility classes. `img-src` allows `data:` for the
inline SVG favicon and the CDN for builds without local artwork.

**And the pages carry the same policy themselves, because that header reaches
only the copies this server sends.** GitHub Pages supports no custom response
headers of any kind — no `_headers` file, no configuration — so until 2026-08-26
the deployed site and the standalone download ran with **no policy at all**,
which is the artefact strangers actually read. A
`<meta http-equiv="Content-Security-Policy">` is the one mechanism Pages honours,
and both pages now carry an identical one; a test asserts they match, because two
policies worded differently are two policies to keep in step.

Measured rather than assumed, on a server sending no header — the Pages
configuration exactly: an `<img onerror>`, an injected `<script>` element and a
`javascript:` URL all failed to run, reporting `script-src-elem` and
`script-src-attr`, while the page still rendered all 167 cards. Served through
`serve.py` the meta and the header both apply and combine as the stricter of the
two; verified as changing nothing, since the local header is the narrower one.

**Three details are load-bearing and none is obvious.** `frame-ancestors` is
deliberately *absent* from the meta: delivered that way it is ignored **and**
logged as a console error, so writing it in for documentation value would fail
the page tests while protecting nothing — framing stays covered by the header
locally and is simply not fixable on Pages. The tag must sit after
`<meta charset>` and before the first thing it governs, since anything parsed
above it is outside the policy. And `raw.githubusercontent.com` has to be named
beside the CDN, for the redirect reason recorded in §7.

**The standalone gets the same policy with the two inline directives relaxed**,
produced by `tools/bundle.py` from the page's own tag — the same transform, to
the character, that `serve.py` applies to `temp_mockup.html`, and for the same
reason: every script and the stylesheet are inlined there, so `'self'` alone
would blank the document. That rewrite **fails loudly** if the tag ever moves. A
missing stylesheet is obvious on first glance; a missing CSP looks exactly like a
CSP that is working, which is the more expensive of the two failures — and the
`<link>` rewrite beside it has silently done nothing once already.

**One inline exception, one file wide.** That strict policy had a cost nobody had
priced: a mockup is deliberately *one* file with an inline `<style>` and an inline
`<script>`, so the browser blocked both, the page sat on *Loading…*, and the reason
appeared only in the console. The mechanism §2 tells every newcomer — and an AI
assistant especially — to reach for silently produced a blank page, for the reader
least likely to suspect the tooling.

Since 2026-08-25, `temp_mockup.html` alone is served a second policy that adds
`'unsafe-inline'` to `script-src` and `style-src` **and changes nothing else**:
`default-src 'none'`, `connect-src 'self'`, `frame-ancestors 'none'` and the rest
are the same string. Three things make that proportionate rather than a hole in
the wall. The file was **already** local-only by peer address, so the looser policy
cannot reach a LAN guest. It is gitignored and has never been tracked, so it cannot
be published. And the app's own responses never carry it, so *"the site has no
inline anything"* stays a claim the browser enforces rather than one we make.

Three ways out were weighed. **Hashing or a nonce** keeps one policy, at the price
of reading and hashing the file on every request and breaking the moment it is
edited without a reload — real work for a scratchpad. **Making mockups three files**
keeps `serve.py` untouched and makes the mechanism heavy exactly where it was meant
to be light, and "overwrite it with the next idea" stops being one action. The
carve-out was taken because the carve-out already existed: `LOCAL_ONLY_FILES` was
enforcing the *same* judgement about the *same* file, by peer address, and this
adds a second consequence to a decision already made rather than a new one.

The obvious failure mode is that it widens quietly — one more filename, one more
directive — and nothing on screen would show it. So the suite compares the two
policies **directive by directive** and asserts the set of exempt files by name;
relaxing `connect-src` as an experiment turned two assertions red and named it.

The server is threaded. Single-threaded, one client opening a socket and never
finishing its request blocked every other client for the full timeout — measured
before and after: 6 s versus 0.02 s.

**Rate limiting, holding nothing.** A token bucket per client: 60 requests back
to back, refilling at 10/s, then `429` with `Retry-After`. Measured at 101 req/s:
71 served, 49 refused. The address is keyed-hashed with a salt generated at
start-up and kept in memory, so buckets cannot be tied to a person, correlated
across restarts, or found on disk. The basis is legitimate interest in
availability (GDPR Art. 6(1)(f), Recital 49), and the footer says so.

**No request log**, deliberately. Shutdown prints totals — served, refused,
rate-limited — and totals identify nobody. A conventional access log would be
the one place personal data accumulated, and nothing here needs it.

**What it still is not: HTTPS.** Without it, anyone on the path can read and
*alter* the page in transit, which is the real argument rather than secrecy.
Authentication is genuinely not needed — nothing served is secret or personal —
but transport security is. For anything beyond a home network, terminate TLS in
front: a Cloudflare Tunnel needs no port forwarding and never publishes your home
address, Caddy gets a certificate automatically given a domain, and Tailscale
avoids public exposure altogether.

### Two stores, and who owns each

Warframe Prime Hunter keeps state in two places and they never mix:

| Store | Holds | Written by | Lost if deleted |
|---|---|---|---|
| **Browser storage** | your collection, per-part progress, materials, farm list, filters, planner options | the pages, as you click | your progress — this is exactly what **Backup** copies out |
| **`.cache/`** | raw responses from DE and the APIs, plus `state.json` | `tools/sources.py` | nothing — it re-downloads. It exists to keep us off DE's servers, not to hold anything of yours |

`assets/img/` is a third, subordinate one: local copies of artwork, rebuilt from
the CDN on demand and pruned automatically.

**Nothing that writes to disk is allowed to leave orphans.** Every writer either
uses a fixed filename that overwrites itself (`data/`, `dist/`, `CHANGELOG.md`,
`state.json`) or prunes what it no longer references — `assets/img/` drops files for
items that have left the catalogue, and `.cache/` drops `wiki_<Item>` entries for the
same reason. The `drops_*` mirror files are deliberately *not* pruned on a run that
used DE directly: they are the fallback that keeps a build working when
warframe.com is unreachable, so a successful run leaving them untouched is exactly
when they earn their keep.

### Staleness is checked by the server, not the page

`serve.py` verifies upstream **before handing over the dataset**. The browser asks for
`data/prime-data.js` as it always does; the server checks whether DE has moved on
since the build, appends `window.WFPRIME_UPSTREAM = {...}` to the file it returns,
and the banner reads that. The page never talks to Digital Extremes and does not know
the check happened.

It could not be done from the page in any case — measured, not assumed:
`warframe.com` and `cdn.warframestat.us` send no CORS headers, so a cross-origin fetch
fails outright and a `no-cors` one returns an **opaque** response with unreadable
headers. Having every visitor contact the CDN would also undo the point of holding
artwork locally.

Three HEAD requests, no downloads, nothing rebuilt — **throttled to once an hour**, so
reloading the page cannot hammer DE. The first request after a restart takes about two
seconds and later ones are instant; that delay is deliberate, on the grounds that a
slow first load beats quietly serving data you have no reason to trust. Upstream being
unreachable is silent rather than alarming, and on `file://` or GitHub Pages no server
runs, so the flag is simply absent and the build-age banner carries on alone.

**The hour is a ceiling on asking DE, not on being right.** The cached answer is
stamped with the write time of `.cache/state.json` — the file it compares against — and
a rebuild changes that, so the next request re-checks whatever the clock says. Without
that stamp the banner outlived the refresh that cleared it: `refresh-data` finished, the
data on disk was current, and the page went on saying it was behind for the rest of the
hour. Reloading did not help, because the server held the stale answer, not the browser.

**The banner also knows who is reading it, and does not guess.** The same warning is
seen by whoever runs the server and by anyone they gave the address to, and only the
first can act on it — so only the first is told to double-click `refresh-data.cmd`.
The server answers that question because it is the only party that can: it sees the
peer address and stamps `owner` onto the `WFPRIME_UPSTREAM` payload it is already
attaching, per request rather than in the cached freshness body, since it is the one
part that differs between peers.

It used to be inferred from `location.hostname`, which was wrong in both directions:
browse **your own** server by its LAN address and you were treated as a guest, warned
about something you could fix and not told how. That guess survives only as the
fallback for when there is no server to ask, which is exactly the two cases it was
ever right about — a `file://` copy, where you must have the folder to be reading it
at all, and a published static host, whose readers cannot fix anything.

## 6. Data sources

Ordered by authority. Where two sources overlap, the more official one wins and the
other becomes an automatic fallback.

| Source | Used for | Notes |
|---|---|---|
| **[warframe.com/droptables](https://www.warframe.com/droptables)** | Relic contents **and every relic's farm location** | First party. Every mirror is generated *from* this page, so it changes first. Parsed by `official.parse_droptables` |
| **[DE Public Export](https://origin.warframe.com/PublicExport/index_en.txt.lzma)** | Catalogue cross-check — Primes that exist in game data | First party, refreshed on every game build. Catches a new Prime **before the wiki is edited** |
| [wiki.warframe.com/w/Prime](https://wiki.warframe.com/w/Prime) | Categories and the (V)/(P)/(B)/(S)/Founder markers | The grouping you asked for; the export fills any gaps |
| [api.warframestat.us/items](https://api.warframestat.us/items) | Component names, artwork filenames, vault state | Convenience layer; the drop table can reconstruct parts without it |
| [`/pc/vaultTrader`](https://api.warframestat.us/pc/vaultTrader) | Live **Prime Resurgence** rotation | Proxies the game worldstate — DE's own `worldState.php` is 404 (see §7) |
| [`/pc/syndicateMissions`](https://api.warframestat.us/pc/syndicateMissions) + [`/pc/events`](https://api.warframestat.us/pc/events) | Which **bounty rotation** is live, and whether the Ghoul Purge or Plague Star is running | Same proxy, same reason. The rotation letter is not published anywhere — it is derived by matching the bounties on offer against DE's table (§7) |
| `drops.warframestat.us` | Fallback drop data | Only used if the official page fails or parses thin |
| `cdn.warframestat.us/img` | Item artwork | The wiki's own images are Cloudflare-protected (§7) |

`meta.dropSource` in the payload records which drop source actually served the
build, and the sidebar footer shows it.

### Fallback safety

`acquire_drops` refuses a parse that yields fewer than 200 relics or 10 farmable
relics and drops to the mirror instead. A format change upstream degrades the app to
slightly staler data rather than an empty page.

### Warm vs cold: a failed fetch means two different things

This distinction drives the whole error policy.

| | Situation | Treated as | Result |
|---|---|---|---|
| **Warm** | Refresh failed, a cached copy exists | **Alert** | Build continues on the older copy; recorded in `meta.stale` |
| **Cold** | Refresh failed, nothing cached | **Critical** | Build aborts; the previous `data/` is left untouched |

A cold miss aborts because the output would be quietly *thinner* — fewer items, or
no artwork — and publishing that over a good build is worse than not publishing.
`--allow-degraded` overrides it deliberately, recording the gap in `meta.degraded`;
the site footer then says what is missing.

Every CI run starts cold, which is why the workflow persists `.cache/` with
`actions/cache`. The first run must succeed on its own; after that, a blocked source
downgrades from critical to a stale alert, exactly as it does locally.

Verified across four states: warm-with-blocked-source (full catalogue + alert), cold
(exits 1), cold with `--allow-degraded` (a wiki-less build, a good deal thinner, plus
the degraded flag), and healthy (167 items, clean). The counts in that check were
taken before the catalogue went relic-only (§9), so re-record them next time it is
run rather than trusting the shape of the four outcomes to have kept the old numbers.

---

## 7. Data model

`window.WFPRIME_DATA` holds:

```js
{
  meta: { generated, itemCount, relicCount, farmableRelicCount, dropSource,
          newCount, resurgence: { activation, expiry, location }, sources,
          bounties: {
            cycleMinutes: 150, sequence: "ABC", checked,
            families: { standard: { letter, windowEnd, votes, of }, vault: {…} },
            groups:   { "Level 5 - 15 Cetus Bounty": { family, rotations } },
            events:   { "Level 15 - 25 Plague Star": { event, activation, expiry } },
          } },
  categories: [{ name, count }],
  items: [{
    id, name, category, type, image, wikiUrl, masteryReq, releaseDate, isNew,
    flags: { vaulted, resurgence, permanent, baro, special, founder, farmable },
    parts:  [{ name, itemCount, relics: [{ relic, rarity, chances, farmable }] }],
    relics: ["Lith V11", …],
    farmableRelics: ["Lith V11", …]
  }],
  relics: {
    "Lith V11": {
      tier, code, vaulted,
      rewards: [{ item, rarity, chances }],
      sources: [{ kind, planet, node, mode, rotation, chance, rarity }],
      sourceCount
    }
  }
}
```

`chances` is keyed by refinement: `{ Intact, Exceptional, Flawless, Radiant }`.
`kind` is one of `mission`, `bounty`, `key`, `transient`, `enemy`.

### A bounty's rotation is a wall clock, not a depth

Every other rotation-bearing mission advances A → A → B → C as you play. A bounty
does not advance at all. **One letter is live for everyone at once**, it changes when
the bounty board refreshes — every 150 minutes, a full day/night cycle of the
landscape — and it walks A → B → C → A. A run therefore pays the stages of *one*
letter, and the only way to reach another is to wait. DE's table says as much if you
read the nesting: the rotation is the outer heading and every stage sits inside it.

The planner used to cost a bounty as four rounds of Defense, which both invented
rewards you cannot collect in that run and hid the wait. What it misprices, in the
data as it stands, is Aya (the final stage of every standard Cetus, Orb Vallis and
Cambion Drift bounty, listed under all three letters) and the Isolation Vault relics
(six tiers, ten relics each, again split A/B/C). Relics otherwise barely touch
bounties — outside the vaults only the Ghoul tiers and Plague Star drop them, and all
three publish rotation A alone.

**The phase is derived, not observed.** The 150-minute period is documented; the
phase is not, and a countdown labelled with the wrong letter is worse than none — it
sends you to a bounty for loot that is not in the current pool. So the build matches
the reward pool of every bounty the worldstate says is on offer against what DE's
table says each letter pays. Exactly one rotation containing everything on offer
names the letter; anything ambiguous abstains. It re-anchors on every refresh rather
than trusting a constant to survive DE's updates, and the page walks the sequence
forward from there in UTC, so it stays right between builds and works offline.

**There are two clocks.** Read at 2026-08-11T21:00Z the standard bounties of Cetus,
Fortuna *and* the Cambion Drift were all on C while all three Isolation Vault
chambers were on B — offset by one step, same period, same changeover instant. The
wiki claims a single letter everywhere; our own reading says otherwise, so the two
families are derived separately and neither is inferred from the other.

The model was then checked across a real changeover rather than assumed. Two builds
either side of 2026-08-11T21:55:23Z:

| | before | after | window moved by |
|---|---|---|---|
| standard | C (16/16) | A (16/16) | 150 min exactly |
| vault | B (6/6) | C (6/6) | 150 min exactly |

Both families advanced exactly one step, in lockstep and unanimously, and the new
window ended 150 minutes after the old one. That is the sequence, the period and the
offset all confirmed against live data instead of the wiki — and it is precisely what
the page's own extrapolation would have predicted from the earlier anchor.

Two smaller consequences worth knowing:

- **Only a bounty publishing all three letters votes.** A couple of tiers publish
  two (Level 30–40 Cambion Drift is one), where a single match says nothing about
  which letter is up. Those are scored at the average of what they do publish.
- **The bounty window is deliberately kept out of `upstream_signature`.** It changes
  every 150 minutes, so including it would make `--if-changed` rebuild on every run.
  It does not need to: the page extrapolates the letter from the last anchor.

### DE publish the letter per tier, and the tiers disagree

**Read on 2026-08-24, and it corrected two live nodes.** The letter was derived by
matching today's reward pool against DE's static table — sound, and it produced
**one answer for a whole family**. DE publish it per tier instead, in each job's
`uniqueName`: `…TierDTableARewards`, where `Table<Y>` is the letter.

Both methods were run side by side against the same window. Twenty-two of the
twenty-four tiers agreed. The two that did not are the point:

| Tier | Derived for its family | DE published | Effect |
|---|---|---|---|
| `Level 25 - 30 Cambion Drift Bounty` | C | **A** | its Aya was scored at 5.26% and pays 4% |
| `Level 30 - 40 Cambion Drift Bounty` | C | **A** | publishes only **AB**, so C was a letter it does not have |

The second is the sharper one. A bounty scored on a letter it does not publish
takes the off-table path — the run is valued at the mean of what it *does* publish
and labelled unknown — so the page was hedging about a bounty DE had named
outright. Both carry Aya, which is what the entry in `TODO.md` predicted would be
the only thing affected today.

So the published letter wins, and the derived one stays as the fallback: for the
Narmer tiers, which carry no tier in their `uniqueName` at all, and for any build
that cannot reach the worldstate. Both are walked forward from the same window end,
which is now carried at the top of the bounty block rather than per family — a
published letter should not need the reward-matching to have also succeeded before
it can be told what time it is.

**The join needs three parts and two of them are not enough.** Section and enemy
levels are ambiguous: on the Cambion Drift, `Cleanse the Land` and `Isolation Vault
Chamber B` are both fought at 30–40 under Entrati. The vault jobs carry a
`VaultBounty` prefix in the `uniqueName`, and which family one of our groups
belongs to we already knew, so the third part of the key is free.

**Stage counts came out of the same read.** `standingStages` has one entry per
stage and its length is 3, 4 or 5 by tier — a level 5–15 bounty is three stages, a
level 40–60 is five. Every bounty was costed at four, so the short ones' rate was
divided by too much and the long ones' by too little. Four survives only as the
fallback for a tier DE did not publish.

**And the levels, which needed no worldstate at all.** All 13 bounty nodes carried
`lvl: null` and lost every level tie-break by default. The level is in the name —
`Level 40 - 60 Cetus Bounty` — so it is parsed from there, which works on a mirror
build and needs no network. `enemyLevels` says the same thing and is how the two
were checked against each other.

### Two bounties only exist sometimes

`Level 15 - 25 Plague Star` carries **26 relics** — the largest bounty source in the
data — and exists only while Operation: Plague Star runs, a few weeks a year. The two
Ghoul tiers carry one relic each plus Aya, and exist only during a Ghoul Purge, which
the wiki puts at "once every few weeks" with no published schedule. DE's drop table
lists all three permanently.

They are now gated on the worldstate: included while running, excluded otherwise, and
reachable anyway through the existing *include event nodes* checkbox — so a detection
that misses a live event is a nuisance rather than a dead end. The build records the
**window** rather than a yes/no, so a week-old build still knows when a purge ends.
The inherited limit is that "running" means running as of the last `refresh-data`;
these events last days, and the staleness banner already carries that message.

### Three derived ideas worth knowing

**`flags.farmable`** is the honest availability signal: true when at least one relic
containing one of the item's parts currently drops somewhere. Computed from the drop
table, not from a wiki marker, so it can't go stale.

**`isNew`** marks a Prime that DE's export lists but the wiki page doesn't. Those get
a gold **NEW** badge, and their parts are reconstructed straight from the drop table
by `parts_from_droptables` — reward names are always `"<Item Name> <Part>"`, so the
prefix is unambiguous. Verified end to end by removing a frame from the wiki parse
and confirming it comes back with all four parts and working farm locations.

**The planner picks refinement by bottleneck, not by hit rate.** Maximising the
chance of getting *anything* wanted is the wrong objective when relics are
finite: a common's 25.33% drowns out a rare you are actually blocked on, and the
advice comes back "Intact" while the rare sits at 2%. What matters is how long it
takes to get *everything* you want out of that relic, which is set by its
scarcest reward. So `bestRefinement` minimises the expected openings for the
worst-off wanted reward — `ceil(stillNeeded / qtyPerDrop) / p` — and breaks ties
on total hit rate.

This is not a rare correction. **All 34 live relics hold both a common and a rare
Prime part**, so any list wanting one of each hits it. Lith G14 carries Gyre's
Neuroptics (rare) and Lavos's Chassis (common): the old model said Intact at
27.33% total, leaving the rare at ~50 expected openings; it now says Radiant,
cutting the rare to ~10 while the common only slips from 3.9 to 6.

Forma never sets the bottleneck — you are not blocked on it — but still counts
towards the tie-break and the node score.

**Refinement, and when the middle steps matter.** The odds move monotonically —
common 25.33 → 16.67 (worse), uncommon 11 → 20, rare 2 → 10 — so for a *single*
target the answer is always one of the two ends, which is why the per-part advice
in the collection view only ever reads Intact or Radiant.

That stops being true the moment you want two rewards of different rarities from
the same relic. Meso V15 holds Caliban's Blueprint (uncommon) and Chassis
(common); wanting both makes **Flawless** the best choice, because the rising and
falling curves cross in the middle:

| | Intact | Exceptional | Flawless | Radiant |
|---|---|---|---|---|
| Blueprint (uncommon) | 11% | 13% | 17% | 20% |
| Chassis (common) | 25.33% | 23.33% | 20% | 16.67% |
| **both** | 36.33% | 36.33% | **37.00%** | 36.67% |

The planner optimises over the whole wanted set per relic, so it finds these; the
collection view answers the narrower per-part question and does not.

**"Best places to farm"** (`app.js → bestSpots`) groups every source of every
still-dropping relic for an item by mission node, then ranks nodes by *how many of
that item's relics drop there*. It scores each node by what one round there is worth towards a part you
still need — the same model `plan.js` uses, rotation weighting included — literally the same code,
since both read it from `assets/rotation.js`, so the two pages cannot rank things
differently. (It used to rank by how many relics happened to overlap, which made
the order disagree with the per-part odds listed underneath.) It only counts
relics holding a part you are still missing, so the advice moves as you tick
things off: Caliban Prime opens on
Terrorem (5 of 7 relics), but once his Blueprint and Chassis are ticked it re-ranks
to Zabala (2 of 2).

Railjack/Proxima nodes are excluded from the **planner**, behind an *Include
Railjack* checkbox — it answers "where should I go next", and Railjack is a
different activity with its own star chart and its own setup. The **collection
view keeps them**, because it answers a different question: "where does this
item's relic drop". Five live relics (Lith C7, Meso N11, Neo V9, Axi S8, Axi V10)
have no other source at all — see *Six Primes need a ship* below.

That distinction was written down here long before the code did it. Until
2026-08-14 `bestSpots` filtered Railjack out of the collection view as well, so
Nyx Prime's card — whose only unvaulted relic is Neo V9, on eight Proxima nodes
and nowhere else — showed **no farm section at all**. The page said nothing where
it could have said "here, and you will need a ship". It says exactly that now, on
each row, through the `Railjack` demand badge; a page test pins it by searching
the dataset for any item in that position rather than naming Nyx.

**Void Fissures need no special handling.** DE publishes no fissure reward table —
a fissure is an overlay on an ordinary node, so the mission still pays out that
node's own rotation rewards, which is the data we already use. A fissure run that
hands you a relic is therefore already priced in: the `P(relic drops here)` term
*is* that event. (Railjack's Void Storms do get their own table and are parsed,
but they drop at 2.5% and fall below the 40-source cap.)

**A node is valued as a whole run, not one rotation at a time.** DE's published
drop chance is *conditional on that rotation coming up*, so it is not comparable
across rotations as it stands. But weighting each rotation separately is not enough
either: a run collects **every rotation it passes through**. Take AABCAA — you
finish with four rotation A rewards *and* a B *and* a C, so all three count towards
that node. Nodes are therefore keyed by mission, not by `(mission, rotation)`, and
each rotation's value is banked in its own slot:

```
v[r] = Σ over relics dropping at (node, rotation r): P(relic) × relicValue
score = Σ over rotations r in the pattern: count[r] × v[r]      (a whole run)
```

Rewards cycle A → A → B → C, one per round: rounds 1–2 pay A, 3 pays B, 4 pays C,
5–6 pay A again.

| Run | Pattern | Rounds | Chosen when |
|---|---|---|---|
| `reset` | everything up to the **last wanted rotation** | 2, 3 or 4 — per node | what you want sits deep in the cycle, so staying buys rotations you want nothing from |
| `aabcaa` | A×4 + B + C | 6 | staying pays: usually rotation A, and rotation C on a Disruption held at four conduits |
| `bonus` | A×3 + B + C | 5 | a Void Fissure is running here **right now** |

**Nobody is asked which, as of 2026-08-24.** There was a *How far you run*
control with one answer for the whole list, and it was the wrong shape twice
over: it asked the reader to know something the model can work out, and it
applied one answer to nodes that want different ones. Every way of playing a
node is scored now and the best rate wins.

**What made that possible was pricing the restart.** A run costs its rounds *and*
the getting in and out — matchmaking, two loading screens, the walk to
extraction — and none of that was costed, so leaving after two rounds and
starting again looked free. `reset` therefore won everywhere by never being
charged for the thing it does most. `RUN_OVERHEAD` is **two rounds**, and it is
an approximation with a known shape: a mission start is a fixed couple of
minutes, while a "round" runs from a 45-second Defense wave to a five-minute
Survival rotation, so it over-charges the long ones and under-charges the short.
It is kept in rounds rather than minutes deliberately — a figure in minutes could
only apply where minutes have been given, and then the two pages would disagree
about how long a run is the moment somebody typed into the effort panel. How to
play a node should be a fact about the node.

Two rounds is also exactly the figure at which an A-only node comes out level:

| node | reset | AABCAA | at overhead 0 | at overhead 2 |
|---|---|---|---|---|
| rotation A only | 2 rounds, 2×A | 6 rounds, 4×A | reset, 0.300 vs 0.200 | **dead heat**, 0.150 |
| A dominant, pays B+C too | 4 rounds | 6 rounds | AABCAA already | AABCAA, 0.175 vs 0.133 |
| C dominant | 4 rounds | 6 rounds | reset | reset, 0.100 vs 0.088 |

So the tie-break carries that case, and it is a stated rule rather than an
accident: **where two ways of running a node come out within two per cent, the
difference is inside the error of the constant, and the tie goes to the one with
fewer restarts.**

**The fissure is chosen, not compared.** An endless Void Fissure hands over a free
relic for depth — five rotations gives a random *Exceptional* of the tier, ten a
Flawless, every fifth after fifteen a Radiant. That relic is not in the drop table,
so the rate cannot see it; a node carrying a fissure right now is run to five and
the arithmetic does not get a vote. It is priced as what it is — a **random** relic
of the tier — so its worth is the mean over every live relic in the best tier, most
of which the plan wants nothing from. Railjack is excluded: its fissures are Void
Storms, their own nodes with their own tables and no rotations to stay for.

**This reverses a decision, and the reversal is the owner's.** The bonus used to be
added to *every* endless node flat, and the argument for that was explicit: a
node-independent constant cannot reorder endless nodes against each other, so a
list built from drop tables that move a few times a year could not be reshuffled by
something with an hour to live. Conditioning it on a live fissure was raised by an
outside review, written up, and **settled against** on exactly that ground. It is
now conditioned on one anyway, at the owner's direction. What that buys is a row
that means what it says — *this* node pays a free relic, not *some* node might. What
it costs is the thing the original decision protected: the top of the list now
moves when the fissure map does, roughly every hour or two.

`reset` stops at the **deepest rotation holding something you want**, not at the
best-rate stopping point. Want a part from A and another from C? You run to C — 4
rounds — because leaving after round 2 never yields the C part at all, however good
the per-round rate looks.

That is a property of the `reset` pattern itself and it survives the change above:
the *choice between* patterns is a rate question, but what one pattern does once
chosen is not. It was briefly implemented as a rate optimiser inside `reset`, which
quietly dropped exactly the case it exists for — Io scored 78.01% over 2 rounds by
ignoring its rotation C value outright. A per-round rate is the wrong objective when
you need to *cover* a set rather than maximise throughput of any one item, which is
the same reasoning as refinement following the bottleneck instead of the likeliest
reward.

This is what makes the modes differ in kind rather than degree. `reset` runs only as
deep as it must and is scored over the fewest rounds; `aabcaa` always pays for six
rounds but banks four rotation A rewards, so it favours nodes whose A is strong.

A node with **no rotation** pays once per run and is added flat. That equates one
round to one whole mission, which flatters long missions — deliberate, since mission
length is not modelled anywhere (see the tie-break note above). It shows up as
bounties and enemy drops climbing under `full` and `aabcaa`.

**Disruption does not use the A → A → B → C cycle**, and is the only mission type
that does not. It pays one reward per round, but the tier depends on the round *and*
how many of the four conduits you successfully defended that round:

| Round | 1 defended | 2 | 3 | 4 defended |
|---|---|---|---|---|
| 1 | A | A | A | **B** |
| 2 | A | A | B | **B** |
| 3 | A | B | B | **C** |
| 4+ | B | B | C | **C** |

**Disruption nodes are never excluded** — rotations B and C are reachable by simply
playing well, and both count normally. What is gated is rotation A alone.

The default assumes all four conduits are defended, which pays `B B C C C C…`, so:

- **Rotation C is unlocked, not periodic.** Past round three, *every* round is another
  C. In an AABC mission C is one round in four, forever. This makes Disruption by far
  the best rotation C farm in the game, and we ranked it as mediocre until 2026-08-10.
- **Rotation A is unreachable.** Kappa's seven Meso relics are real, but a squad
  clearing every conduit never sees them. They score zero there and the tooltip says
  so explicitly rather than silently dropping them.

Defending *fewer* conduits is a deliberate min-max, and the only route to rotation A:

| Target | When it is reachable |
|---|---|
| A | rounds 1–3 only, defending 3 / 2 / 1 respectively |
| B | every round — defend 4, then 3–4, then 2–3, then 1–2 |
| C | round 3 onward, defending 3–4 |

Losing all four in one round fails the mission, so one is the floor.

**Rotation A is therefore gated behind the 4-squad option.** Letting conduits die on
purpose, to a schedule, without failing the round outright is not something a random
public squad will do, so it is not offered as a default. `ROT_PATTERN` holds a *list*
of plans per mission type, each flagged `squadOnly`, and `plansFor()` filters by the
option before `runValue()` takes whichever banks most. Because it is a maximum over
available plans, **enabling the option can only raise a node's score** — ticking the
box never makes anything look worse.

With the option off, a Disruption node whose rotation A holds something you want says
so in its tooltip and names the option, rather than silently scoring it zero.

Three plans are modelled, and **rotation A takes priority over all of them**. It is
exhaustible — three rewards at most, rounds 1–3, impossible from round 4 — so if
anything you want sits there, the under-defend plan is not one option among several,
it is the only route that exists. A plan carrying `onlyChanceAt` is selected outright
rather than compared on value, which is the same bottleneck reasoning behind the
refinement choice: you cannot optimise throughput on a resource that runs out.

| Plan | Sequence | Needs a premade |
|---|---|---|
| all-out | `B B C C C…` | no |
| rotation A | `A A A` then whichever of B/C is worth more | yes |
| hold B | `B B B B…` from round 1 | yes |

The rotation-A plan's tail is chosen per node rather than fixed: after the three A
rewards, round 4 onward is a free choice between defending 1–2 for B or 3–4 for C, so
assuming B would strand a wanted C.

Implementation: `plansFor(mission, squad)` in `assets/rotation.js` looks the
mission type up in `ROT_PATTERN` and falls back to AABC, so a mission type nobody has
thought about degrades to the normal rule rather than to nothing. `assertCoverage()`
logs, once per load, how many mission types are in the data and exactly which ones
are riding on the AABC assumption — the mistake that started this was invisible
precisely because nothing ever said what was being assumed. The run length still comes
from `runMode`, so the two concerns stay separate: **mission type decides what a
round pays, run mode decides how many rounds you stay.** Nodes on a non-standard
rotation render their label in `--odd` amber with the full explanation on hover.

**The score is a whole run, not a rate** (decided 2026-08-10). Dividing by rounds
produced a dominance violation: Kappa and Ur were identical in rotations A and B,
but Ur *also* dropped something wanted in rotation C, which forced it a round deeper
and pushed its per-round rate below Kappa's — so the node offering strictly more
ranked lower. Since you can always leave early, Ur can never actually be worse.

Ranking on the run total fixes that, at a known cost: **a longer run can outrank a
faster one on volume alone.** A 4-round endless node accumulates four rewards
against a bounty's one, so single-reward missions sink regardless of speed — the
Fortuna bounty went from 1st to below 28th on the same list. This was chosen with
that trade understood. The per-round rate is still computed and shown in the
rotation tooltip, so the pathology is visible rather than hidden; if a node with a
much better rate is sitting below a longer one, the tooltip says so.

The setting lives in `wfprimes.plan.v1` and **both pages read that one copy**, since
both rank nodes with it and this document guarantees they cannot disagree. The
collection page writes back to the planner's store rather than keeping its own. The
headline percentage is **per run**; the row names only the rotations the run
actually reaches, and the round count is what it is divided by for the rate.

**Aya is valued by what it buys, not guessed at.** Aya is a currency, not a
reward, so it never reached the site before — DE lists it in the same drop rows as
relics and the parser discarded it. It matters because Varzia sells relics for
**1 Aya each** (`vaultTrader.inventory[].credits`), and Varzia stocks the current
Prime Resurgence rotation. So one Aya is one relic *of your choosing* from that
rotation — strictly better than a random relic off a drop table, because you pick
it.

**It is valued at the best relic it could buy you right now.** Varzia stocks the
current Prime Resurgence rotation, so with a rotation running Aya is priced against
that rotation's relics only — the same `bestRefinement()` call every other relic on
the page is scored with, so the number is in the same unit and directly comparable.

**Its value comes from the collection, not the farm list.** Aya is worth banking for
as long as *anything* vaulted is still missing from what you own — you pick it up
because the vault holds Primes you do not have, whether or not you are chasing them
this week. Keying it to the farm list was wrong, and scored zero for exactly the
player who should have been collecting Aya.

It counts only for items that are **not farmable**: if you can go and farm it, Aya
buys you nothing. It reaches zero once every vaulted Prime is collected.

Parts are matched through each part's own relic list rather than by name. A reward is
called `Baruuk Prime Chassis Blueprint` while the part is `Chassis`, so a string match
quietly works for `Blueprint` and fails for the other three.

**When no rotation is running** there is nothing on sale to price against, and it
falls back to the best *vaulted* relic on your list — what a future rotation could
offer. The row tooltip and the summary both say which of the two is in play.

That branch is a **guard, not a feature**. Aya exists as Prime Resurgence's currency
and does not drop while no rotation is running, so in the game the case should not
arise: no rotation means no Aya to value in the first place. If the fallback ever does
fire, the likely cause is on our side — a build old enough that
`meta.resurgence.expiry` has passed while DE's static drop table still lists Aya rows.
Falling back to the vault-wide value is the least wrong thing to do with a dataset in
that state, and the stale-data banner should be showing by then anyway.

**A known consequence, chosen deliberately:** wanting a vaulted Prime that is *not* in
the current rotation scores Aya zero, even though you would sensibly bank Aya against
its eventual return. Pricing on the live rotation is exact about what Aya buys today;
pricing on the whole vault would be right in expectation but optimistic about which
rotation turns up. This is the first of those.

**It only ever inflates a node already worth running.** Same rule as Forma, and for
the same reason: standing on its own it would send you to a bounty that drops Aya
and nothing else, ahead of somewhere carrying a part you actually need. The code
looks the node up and returns if it is not already in the plan, so Aya can raise a
score but never create one. Default on, with a *Count Aya drops* checkbox. Nodes that drop it get an `aya`
marker at the end of the meta line, after the relic count — in the same colour as
everything else on that line, since it is one more fact about the node rather than a
state or a warning.

**Squad odds** are display-only: with the toggle on, a per-opening chance `p` is
shown as `1 - (1 - p)^4`, since four players cracking the same relic see four
rewards and keep the best.

### Some nodes hand you the relic already refined

DE's drop table names a refinement on a relic reward when the relic arrives
**pre-refined**. An ordinary row says `Lith Q3 Relic`; these say `Lith Q3 Relic
(Radiant)`. There are **80 such rows, every one of them Radiant**, across 11 nodes
and nowhere else: Elite Sanctuary Onslaught (28), the six Void Storms (44) and the
four Profit-Taker phases (8). `official.py` keeps the refinement where DE names one,
and the planner values those sources at the refinement they actually hand over.

**It cuts both ways, which is why it is not simply a bonus.** `bestRefinement`
picks one refinement per relic on the assumption that the choice is yours — you
spend the 100 Void Traces on whatever clears your scarcest wanted reward fastest.
A node that hands the relic over Radiant has taken that choice away, so the only
honest value is the value *at the refinement you were given*:

- wanted Radiant anyway → full value, and 100 traces you keep
- wanted Intact, given Radiant → the common you were after has gone from 25.33% to
  16.67%, so this copy is worth **less** to this plan than one off the star chart

Elite Sanctuary Onslaught therefore reads `pre-refined` in `--odd` amber on a list
blocked on a common, and plain `radiant` on one that wanted it. It also puts a crack
in the "one refinement per relic" rule, which holds only while you cannot hold the
same relic two ways — and you can, once one node gives you a Radiant copy and
another an Intact one.

**A relic handed over Radiant is worth 25% more, and that is the second thumb on
the scale.** Refining costs 25 / 50 / 100 traces, and a fissure run returns 6–30,
so **refining never pays for itself** — it always comes out of a pile you already
had. Eleven nodes hand the relic over already Radiant and save you the whole bill.

Two attempts to price that failed, both silently, and both are worth recording
because they failed the same way:

* `sourceValue`'s `traces` was `cost(given) − cost(chosen)` — how far the node
  *overshoots* the refinement the plan picked. All eleven give Radiant and
  `bestRefinement` picks Radiant for all 34 live relics, so it was `100 − 100 = 0`
  everywhere. The bonus was multiplied by zero. The same zero is why the row's
  *"saving N Void Traces"* clause had never once printed.
* A per-trace exchange rate derived from the plan replaced it, and collapsed for
  the same reason: it priced the uplift *above* the chosen refinement, which is
  zero when the plan already wants Radiant, and negative on three relics.

Both were answering *"what are the traces worth?"* when the planner's question is
*"where should I go?"*. The owner's ruling, 2026-08-25: traces are almost always
tight, the planner must **never** talk anyone into a lower-efficiency crack to
save them — *point them at Radiant and they will find the traces* — and a Radiant
source simply earns a flat **25%**.

**Where it is applied is the whole lesson.** The obvious place is the relic's
value, and it does nothing: the ranked figure is `perRun / cost`, and `perRun` is
a count taken from the plain drop chances, so it never sees `value`. Measured at
**+0.0% on all eleven nodes** before it was moved. It now goes exactly where
`CACHE_PENALTY` goes — a multiplier on `score` and `rate` — and `M.sourceValue`
deliberately *flags* the bonus rather than applying it, so the two cannot drift.

Inflating the counts instead was the other option and is worse: `cnt` feeds
*"% of runs that drop at least one"*, and 1.25× a probability is a wrong
probability rather than a generous one.

`M.radiantMultiplier` weights the lift by how much of a node's wanted value
actually arrives pre-refined. All eleven are wholly Radiant so the share is 1 and
it is a flat 1.25; the weighting is for the day one of them is mixed.

The toggle is **on by default**, alone among the assumptions, because the owner's
ruling is that this is the common case. Leaving it off would make the app almost
always understate a Radiant source.

All eleven gain exactly 25% and climb — ESO #41 → #33 of 86 folded rows. **They
are still not visible**: the interface exposes 28 places, eight rows and twenty in
the overflow tooltip. Surfacing ESO by thumb alone would need 2.37×, a +137%
bonus, which would stop being a nudge. Its real obstacle is cost — rotation C on
Onslaught is twelve zones — and `TODO.md` records that the fix is a browsable
ranking, not a bigger number.

### One place names a run's cost, because two of them diverged

`app.js` and `plan.js` each built the string — *"4 rounds"*, *"3 vaults"*,
*"12 zones"* — and they agreed only by coincidence. The moment Faceoff became a
one-run mission the planner said *"one run"* and the collection page said
*"1 run"*, because the planner had a `count === 1 && unit === "run"` case and the
inline version in `app.js` did not.

`ROT.objectivesText` is now the only place that phrasing exists and both pages
call it. That is the same rule the rest of this file follows and the same reason:
these two pages drifted over a bounty's fourth reward once already.

### The development server sends `no-store`

`serve.py` sent `Last-Modified` and no `Cache-Control`, so browsers applied
heuristic freshness and served a stale `styles.css` or `rotation.js` without
revalidating. `STYLE.md §8` existed almost entirely to document a cache-bust
incantation for it, and it has cost more than one session a long hunt for a
change that had already applied.

Nothing served here is worth caching — it is localhost, the files are small, and
being wrong about which build you are looking at is expensive. The published site
never sees this file; GitHub Pages sends its own headers. The dataset branch had
been sending its own `no-store` and now does not, since `end_headers` covers
every response and the browser was seeing two.

### Both thumbs reach every ranked figure, including the per-run one

There are two deliberate adjustments in the model — `CACHE_PENALTY` and the
Radiant bonus — and until 2026-08-25 both were applied to `score` and `rate` and
to nothing else. `perRun` escaped, and `perRun` is what the *per run* sort orders
on. So a halved Railjack cache node ranked per run exactly where it would have
sat unhalved, and a node handing relics over Radiant got no credit at all in that
view. The two sorts disagreed for reasons that had nothing to do with the sort.

`STYLE.md §5` is what makes that a defect rather than a quirk: the biggest number
on a row is the one the list is ordered by. If the order is adjusted and the
number is not — or the reverse — the row is claiming something untrue about
itself.

Both adjustments now compose into one multiplier, `n.adj`, applied to `score`,
`rate` and `perRunAdj`; the per-run sort orders on `perRunAdj`. **`n.perRun`
itself is untouched** and remains the raw count DE's tables imply. That is the
figure the tooltip quotes — *"N wanted relics a run"* — so the fact stays
available underneath the adjusted headline, and the tooltip names which thumbs
are on the row: *"Ranked figures halved"* and *"Ranked figures +25%"*.

Both row figures are adjusted now, rather than the headline only. Showing the raw
count as the second line while the headline was adjusted meant the same quantity
read as two different numbers depending on which way the list happened to be
sorted, which is the same defect one level down.

### One deliberate thumb on the scale, and only one

A Railjack `Caches` run is three hidden caches inside a boarded base, and it is the
worst relics-per-run in the list. Nobody runs Railjack for them — you run a Skirmish
and open what you pass. So they are **halved**: one named constant, `CACHE_PENALTY`
in `rotation.js`, applied by the planner and nowhere else.

This is a judgement, not a measurement, and it is the **only one of its kind in the
model** — everything else is arithmetic on DE's published numbers. It is one
constant in one place precisely so it can be argued with, and the row says `halved`
in amber with the reasoning on hover, because a score moved by an opinion that does
not admit to it is the thing this project keeps refusing to do.

**The relic count on the same row is untouched.** What a run hands you is a fact;
the penalty is only what we think it is worth going for, and a fact bent to suit an
opinion would be a lie. A Veil Proxima cache reads `3.65% per run` beside `0.32
relics · 28.93% of runs`, and the second pair is what DE's numbers say.

All 38 live `Caches` nodes are Railjack today, so the mode alone would identify
them; the Railjack test is kept anyway, because a `Caches` mode somewhere else
would not have earned this.

### Some missions have no length to choose, and three of them were guessing

The run-length optimiser was applied to every mission type. `rotation.js` offered
`reset` and `aabcaa` unconditionally, so a plan that assumes you *may* stay longer
picked lengths these missions cannot have: **28 Railjack `Caches` nodes costed at
six caches, six `Spy` nodes at four vaults, four Faceoff tables at six rounds** —
38 of 242 live nodes priced as endless when they are not. The row then printed
*"Worth staying six rounds"* for a run that ends after three.

`OBJECTIVE_UNIT` was the near-miss: it renamed the unit — vault, cache — and kept
the arithmetic, so the count was still whatever staying happened to score best.
A comment beside it asserted no special case was needed.

**It was held for the wiki, and correctly so.** Capping the length alone would
have made things worse: six live Spy nodes publish rotation **C only**, and the
AABC cycle's first three rounds are A, A, B. Pago would have fallen from 128th to
230th of 234 while the row explained that rot C was out of reach — in a mission
whose third vault is exactly where that reward lives. The length and the letters
turned out to be inseparable, which is why `TODO.md` carried the design for a day
rather than shipping half of it.

`FIXED_LENGTH` now states both, from `wiki.warframe.com`:

| Mission | Objectives | Pays |
|---|---|---|
| `Spy` | 3 vaults | A, B, C — *rotations are determined by the number of vaults hacked*, and vault names do not correspond to rotation |
| `Caches` | 2 caches | A, B — a Point of Interest cache and an Abandoned Derelict Cache, separate tables rolled independently |
| `Special` | 1 run | A, B — Faceoff pays one each at the end of a match, win or lose |

Read in three places: the mode list in `runValue` (which is where the missing
mission-type test goes, and it drops `bonus` in the same expression), a `fixed`
branch in `scorePlan`, and a case in `objectivesOf` before the `n.rounds` test.

Two details that are easy to get wrong. The `objectivesOf` case is conditioned on
the node **paying by rotation**: 10 of the 38 `Caches` nodes are Earth and Saturn
Proxima, which the wiki gives a single undifferentiated cache table and which
publish no rotation, so they are not two of anything and stay at *one run*.
Costing them as two caches was this change's own first regression. And `rounds`
is a count of **reward draws**, not objectives — a Faceoff match is one run paying
two — which is the same split `PER_REWARD` handles for Onslaught.

**What it moved, measured over the live build.** Spy: five reachable nodes 4 → 3
vaults, +33% per objective, Pago #124 → #83, and the C-only nodes keep their value
because the letters came with the cap. Caches: 24 of 38 rose and 14 fell, −4% to
+6% depending on how a node splits between A and B. Faceoff: 6 rounds → 1 run,
**+140%, to #1–#4**.

That last one is not a new fault but an old one made visible, and `TODO.md`
records it: *a run's fixed cost is not priced*, which is why Capture already wins
everything. Faceoff is now the loudest instance of it rather than the fourteenth.

`CACHE_PENALTY` was re-derived in the same commit, at the owner's instruction,
because it had been calibrated while these nodes were costed at six caches. It
stays at **0.5**: the best Caches node fell from #144 to #160 of 234, and would
sit at #78 unpenalised, so the constant is doing slightly less work than before
rather than more.

### Only recommend what can actually be run today

A source belongs in the ranking only if it can be run **now**. Permanent content is
always shown; content recurring often enough to plan around is modelled but shown
only while it is live; anything we cannot deterministically tell is live is
**omitted** — not greyed out, not caveated. The planner answers "where do I go
next", and a node you cannot enter is not a worse answer than the right one, it is
not an answer.

The build tags every unreachable row with `access`, and both pages filter on it:

| Tag | Means | Ever reachable? |
|---|---|---|
| `quest` | a one-time story mission — eight of them share one reward table | no, and no checkbox offers one |
| `unmodelled` | content whose shape the model cannot yet express | no, same |
| `event:X` | rides X's live window from the worldstate | yes, while X runs, or via *include event nodes* |

**The case that exposed the rule was `Hemocyte`**, which ranked *first* in a mockup
at 0.74 wanted relics a run, carrying 11 live relics. It is not a mission — it is an
enemy, and it spawns only in the final stage of the Plague Star bounty, four to a
run. So the top recommendation in the list was content nobody could reach. It is
gated on Plague Star's window now, and carries an `Enemy` badge saying it is not a
place and that it and the Plague Star row are one trip.

Two things checked and *not* excluded, because the obvious guess was wrong both
times: the four **Faceoff** tables are permanent Höllvania content, not event
content, and get a `PvPvE` badge instead; and the eight quest missions were
confidently identified as Steel Path Incursions by a search, which the wiki
disproves — Incursions award Steel Essence and no relics at all.

**Zero items are stranded by any of this.** No item's live relics are all
unreachable, so `quest` and `unmodelled` never orphan anything. That is the design
working: quest content is out of scope — this tracks farmable parts from relics, not
every way a Prime has entered the game — and excluding it costs nobody a route.

### Profit-Taker is four places, not one activity on a clock

The heist looked unmodellable and is not. The wiki: *"The Heist must initially be
accomplished in sequence for the first time before being able to freely replay each
stage"* — so after one clear you pick any phase you like, which is exactly four
things to choose between. DE's Phase 3 split costs nothing either: *First
Completion* is a Gravimag at 100% and carries no relics, so for a relic planner it
is not a source at all.

| Node | Level | Rotation | Relics |
|---|---|---|---|
| `PROFIT-TAKER - PHASE 1` | 40–60 | none | Lith Q3 15%, Lith A12 12.5% |
| `PROFIT-TAKER - PHASE 2` | 40–60 | none | Lith K12 15%, Meso Y2 12.5% |
| `PROFIT-TAKER - PHASE 3` | 40–60 | none | Meso D8 15%, Neo C7 12.5% |
| `PROFIT-TAKER - PHASE 4` | 50–60 | none | Neo A16 17.14%, Axi S20 14.29% |

**No rotation on any of them** — one fixed table each, which is the flat `rot.none`
case `runValue` already handles: one reward per run, scored like a Capture. The
reason it looked hard is that DE files it under `Bounty`, and bounties are the one
thing on a clock. It is not on the bounty board and not on the clock; it is reached
from Eudico's back room. All eight rows arrive already Radiant.

The gate is a **demand badge**, the same shape as `Railjack` and `PvPvE`: `Old
Mate`, Solaris United Rank 5 plus one sequential clear. A standing requirement is a
reason to annotate, not to hide — the same call already made for Railjack.

Being filed under `Bounty` cost it one more thing until 2026-08-24: `objectivesOf`
charges every bounty four stages, so a phase was costed at four objectives when it
is one activity you replay on its own — its rate was divided by four and it sank
accordingly. `objectivesOf` now names the heist and returns one run for it.

That leaves `Bounty` carrying two units, which is the price of it being **our**
label rather than DE's. The effort panel asks for minutes per objective per mission
type, and it takes the unit of the node with the *most* objectives, so a
single-objective heist cannot relabel a form that is mostly stages and quietly make
the number typed into it wrong by a factor of four. A plaster, and `TODO.md` keeps
the wider problem — *Our four invented "mission types" leak into the ranking*.

### Nodes that are the same bet are one row

**Digital Extremes do not write a relic table per node.** They write one per
tier and rotation shape and hang it on every node that fits — so eight low-level
Lith Defense nodes are a single choice listed eight times, and a list that shows
the best eight places could spend all eight rows on it.

Nodes fold together when **the relic table and the mission type both match**.
Both halves matter:

- The table is taken from what the planner *scored* — relic, chance and rotation
  — not from the raw drop rows. Two nodes are the same bet when what you would
  get for going there is the same, which is a statement about this plan.
- Identical tables across **different** modes are common (Survival and Excavation
  share several). Those are the same reward from a different activity, which is
  a choice worth keeping rather than a duplicate worth hiding. Thirteen of the
  thirty-six duplicate groups in the data span modes, and none of them folds.

**The surviving row is the node you would rather run**, not whichever sorted
first: `pickNode` uses the ranking's own tie-breaks in the same order — Aya, then
lowest enemy level, then name so it never wobbles. And it *becomes* the row
rather than being named beside it, so the level, planet and demand badges shown
are that node's too. Naming one node and showing another's level was the obvious
way to build this and would have been quietly wrong.

The count of what was folded is on the row (`+8 same`) with the full list on
hover, and the summary keeps both numbers: *233 places to run · 114 genuinely
different*. Nothing is hidden — a fold is not a filter.

Both pages do it, through the same two functions — `ROT.signature` and
`ROT.pickNode` — so they cannot disagree about what counts as a duplicate.

A live fissure goes ahead of every other tie-break. The members of a group are the
same bet by construction, so naming the one you can also crack a relic at cannot
cost anything — and naming any other would be recommending the identical node minus
a free relic.

**That held for the table and not for the fissure until 2026-08-24.** `pickNode`
takes the fissure test as an argument and only the planner passed it, so with a
fissure live at a member that was not the lowest-level one the planner named that
node and the collection view named another — and since the picked node *becomes*
the row, its level, planet and demand badges differed too. Both pages pass the
predicate now.

One difference between them survives and is deliberate: the collection view counts
**Void Storms** and the planner counts them only when *Include Railjack* is on.
That is not the two pages disagreeing about a group — this view never hides
Railjack, since some live relics drop nowhere else, so a Railjack node the planner
has excluded is not in its group to be named at all.

### The fissure marks the ranking; it is never a list of its own

**Built as a list on 2026-08-14, and moved the same day.** The first version was a
strip above the crack list: every open fissure for the tiers you hold, by node and
time remaining. The owner's objection killed it in one line — *the game already shows
you that*. It does, in the navigation console, more accurately and without a build
step. Reprinting it was the app being a worse copy of something the player already
has open.

What the game cannot show is the **intersection**. It knows every fissure; it knows
nothing about your farm list. The planner knows which places are worth running for
what you still need, so the useful sentence is not "here are the fissures" but
*"the place ranked third is a fissure for the next 40 minutes"* — go there and one
run earns the relic and cracks one. On a typical evening 18 of the ~25 live fissure
nodes are also relic sources, so this lands on real rows rather than being a
theoretical overlap.

**Shown, never scored.** A fissure lasts an hour or two; the ranking is built from
drop tables that move a few times a year. Letting it into the score would reshuffle
the list hourly for a reason that has already expired by the time it is read, and a
ranking that changes under you is one you stop trusting. It is a badge on a row the
ranking chose for its own reasons — with one exception, above, where the choice was
already a coin toss.

The badges are painted into slots and repainted on a one-minute timer rather than
rendered with the row, so a page left open stops claiming a closed fissure without
re-sorting the list under the reader. Every entry carries its own expiry, so the
error is only ever omission: it can fail to mark a node that is still a fissure, and
it cannot send anyone to one that closed at lunchtime.

**An interval is not a clock, though, and that gap was closed on 2026-08-24.** A
background tab has its timers throttled to about once a minute or worse, and the
bounty tick deliberately does nothing at all while `document.hidden` — so a tab left
open for an hour came back showing a countdown frozen where it was left and, worse,
a ranking built for a rotation letter that had turned over while nobody was looking.
Everything that reads the clock now runs once on `visibilitychange`, which is what
makes skipping the work while hidden safe rather than merely cheap: hidden work is
only safe to skip when something covers the gap it leaves.

**The list itself is re-read, and that was the other half.** The one-minute repaint
could only ever *lose* badges: it re-reads a list fixed at page load, so it retires
fissures as they close and never hears about one that opened since. `build_data.py`
now also writes **`data/fissures.json`** — the same list on its own, four kilobytes
beside a 1.9 MB payload — and `shared.js` re-reads it every ten minutes, on load, and
on `visibilitychange`. The array is spliced in place because both pages took a
reference to it at load; `shared.js` normalises it to an array first, so a build old
enough to have no fissure list cannot leave a page holding a private empty one.

**Same origin, and that is the whole design.** It is fetched from wherever the page
was served and never from `api.warframestat.us`, so `connect-src 'self'` stays a
true statement about this site and nobody reading it appears in a third party's
logs. Keeping the data current is the scheduled build's job — locally and in CI,
both on ten minutes — and this file is only how that answer reaches a page which is
already open. It fails silently on `file://`, in the bundled single file, and on any
server that does not carry it, which is the same safe direction the list already
fails in: it can go out of date, it cannot invent a fissure.

**Badges only, deliberately.** The fold uses a live fissure to choose which of
several identical nodes to name. Re-running that on a refresh would rename rows
under whoever is reading them, for a reason that expires within the hour — the same
call as never letting a fissure into the score.

### Two lists, two questions, never one score

**Split on 2026-08-14.** Collecting relics and cracking them are different
activities with different bottlenecks, and a single number covering both answered
neither — which is why *"about N runs to finish"* could never be given an honest
label. The owner's own pattern makes it concrete: relics get stacked on weekdays
when there is no time, and cracked in bulk at the weekend.

| | Ranks on | Knows nothing about |
|---|---|---|
| **Where to go** | wanted relics per objective | what a relic turns into once opened |
| **How to crack them** | openings to finish the relic | where the relic came from |

Each heading says which quantity it ranks on, because two lists side by side with
one unexplained big number each is the confusion the split was meant to end.

**Where to go** now leads with a **count**, not a percentage. The percentage is
still on the row, one line down, because the two disagree often enough to be
worth both: Mithra is worth 63.85% a run while dropping 0.83 wanted relics;
Taranis drops 1.47 and is worth 51.25%. More relics, less progress, because what
Taranis hands you is the easy part. Which of those you want depends on whether
you are short of relics or short of the right ones — and that is precisely the
question one score could not answer.

Two consequences worth knowing:

- **Aya counts as one relic here.** It is not a relic, but it is the only thing
  in the game that becomes exactly one relic of your choosing, so for "how fast
  does the stack fill" it fills it. Forma does not: it is a reward *inside* a
  relic, not a relic.
- **The cache penalty moved to the ranked figure**, not to the count. `perRun`
  stays the raw number DE's chances imply; the headline is adjusted and the row
  says `halved`. A judgement may move the ranking, never the fact.

**Which of the two you are ranked on is now a control**, added 2026-08-24. Both
count wanted relics and differ only in what they divide by — per objective (or per
minute once effort weights are given) against per run, cost ignored. They disagree
whenever a long run is worth going on with, and the reordering is not subtle: on a
four-Prime list, Stribog and Tiwaz top the per-objective list at 0.63 and leave the
top five entirely per run, while Ani goes from fourth to first at 2.25.

Three rules the toggle has to keep, all of them `STYLE.md §5`. The number it ranks
on becomes the **big** one and the other drops to the faint line beneath — a sort
that changed the order without moving the numbers would leave every row claiming an
order it is not in. The **heading follows**, which also fixed a older lapse: it read
*ranked on relics per objective* even after minutes were given and the rows had
switched to per minute. And the `+N more` tooltip follows too — it had been
rendering the ranked count through the percentage formatter since the split, so the
hidden rows showed `38%` where the visible ones showed `0.38`.

**The control sits on the heading's own line**, right-aligned, not in the sidebar
where it started. Everything in that sidebar is something the model needs to be
told — how far you run, whether you have a squad, what an objective costs you —
while this one only reorders the list in front of you, and a control belongs within
sight of what it changes. Its options carry the unit rather than a label of their
own (*per objective* becomes *per minute* with the heading), because on that line
there is no room for a label and no need for one.

**What is deliberately not offered is a sort on value.** `score` is on the row and
in the hover, and ranking the left list by it would answer the right list's
question — which is the thing this whole section exists to prevent. A unit is a
change of scale; value is a change of subject.

**How to crack them** used to sort on hit rate, which answered neither question:
a relic you are one common away from finishing sat above one holding a rare you
are blocked on, because the common is likelier. Openings put the blocked one
first. The live data makes the difference visible — Meso V15 pays out **37% per
opening** and still needs **5.9 openings** to finish, while three relics at 20%
per opening finish in 5.0, because what is left in V15 is scarcer than what is
left in them.

Infinite openings sort **last**, not first: a relic whose wanted reward cannot
drop at any refinement is not urgent, it is impossible.

### The same run, counted as well as valued

A node row carries two numbers about one run, and they answer different questions.
The **percentage** weighs every relic by what opening it is worth, so a rare you are
blocked on outranks a common you would pick up anyway. The **count** — how many
wanted relics the run hands over on average, and how often it hands over any at all
— knows nothing about that, and says only how fast the stack fills.

They disagree often enough to be worth both. Against a two-Prime list, Mithra
(Interception) is worth 63.85% a run while dropping 0.83 wanted relics; Taranis
(Defense) drops 1.47 and is worth 51.25%. More relics, less progress, because what
Taranis hands you is the easy part.

Both come out of `runValue`, which now takes an optional parallel map of plain drop
chances alongside the value map and returns `count` and `any` for it. **They are
deliberately not computed separately.** The value model chooses how long the run is —
`reset` stops at the last rotation holding something wanted, and Disruption picks
between three ways of playing it — so a count worked out on its own would silently
describe a different run, and the row would show a percentage and a count that cannot
both be true. Passing no map returns no count at all, rather than a zero that reads
like an answer.

Aya and Forma are in the percentage and out of the count. Neither is a relic, and the
count claims to be relics.

### Six Primes need a ship, and "never vaulted" was hiding it

The wiki marks 14 Primes **Never Vaulted (P)**. Six of them carry Digital
Extremes' `vaulted` flag at the same moment, and *both markers are correct*:

| Marker | What it means | Which |
|---|---|---|
| `P` only | never left the ordinary drop tables | Akbronco, Braton, Bronco, Burston, Fang, Lex, Orthos, Paris Prime |
| `P` **and** `V` | left the star chart, relics went to **Railjack** rather than to the vault | **Cernos, Hikou, Nyx, Scindo, Valkyr, Venka Prime** |

The second group never becomes unobtainable, which is exactly what the wiki
marker claims — and until 2026-08-14 the card told them apart from the first
group not at all. Both showed `P · NEVER VAULTED`, tooltipped *"its relics keep
dropping indefinitely"*, which is a poor thing to say to someone with no
Railjack. Nyx Prime's card compounded it by showing no farm section whatsoever,
for the separate reason recorded above.

Those six now show **`RAILJACK ONLY`** in the same blue as the node badge,
because it is the same requirement seen at a different scale.

**The badge is derived, not read off the two markers.** `ROT.railjackOnly` walks
the item's still-live relics, drops any with no reachable source at all — a
quest-only relic is not an alternative to Railjack, it is not an alternative to
anything — and asks whether every route that remains is Railjack. So it corrects
itself if DE ever moves one of those relics back to the star chart, the same
reason `flags.farmable` is computed rather than parsed. That it agrees exactly
with `permanent && vaulted` on today's data is corroboration, not the definition.

Five relics carry all six: **Lith C7, Meso N11, Neo V9, Axi S8, Axi V10**.

**Railjack is the only activity that locks anyone in**, and that was checked rather
than assumed. A sweep across every gated activity in the data — for each item, which
activities do its still-live, still-reachable relics belong to — found exactly one
with items locked to it alone:

| Activity | live relics it touches | items locked to it |
|---|---|---|
| **Railjack** (Proxima + 28 named nodes) | 34 | **6** |
| Railjack (Void Storms) | 29 | 0 |
| Sanctuary Onslaught | 29 | 0 |
| Bounties (landscape) | 26 | 0 |
| Faceoff (PvPvE) | 22 | 0 |
| Isolation Vault · Zariman · Höllvania · Ascension | 15 each | 0 |
| Enemy drops | 11 | 0 |
| The Perita Rebellion | 8 | 0 |
| Duviri | 7 | 0 |

Every other gated activity is one route among several for everything it carries, so
a badge on the node row says all there is to say. Railjack is the single case where
the gate is the whole answer, which is why it — and only it — earns an item-level
badge. If a second activity ever locks someone in, the honest move is to promote
`railjackOnly` to a general `onlyFrom(activity)` rather than add a second special
case beside it.

### Neither the Steel Path nor Mastery Rank is an option — for different reasons

Both gate entering a node. Neither gets a control, and the two reasons are not
the same, which is worth writing down because the outcome looks uniform.

**The Steel Path is a second star chart**, unlocked once by clearing the first.
Until you have, its nodes are not on your chart at all — the same shape as an
event that is not running, and by the rule below it *ought* to be excluded by
default with a checkbox, exactly like Railjack.

It had one for an afternoon on 2026-08-14, and it was removed after measuring
what it did. **The only Steel Path content carrying relics is the Faceoff pair,
and each variant is identical to its ordinary twin — the same 22 relics at the
same 8.33%.** Ticking the box moved the ranking from 152 places to 154 and
offered no reward that was not already reachable, while adding a fifth question
to a sidebar that has to earn every one. An option that changes two duplicate
rows and nothing else is a question not worth asking.

So the classifier stays and the control does not. `ROT.isSteelPath` recognises
them two ways — DE names most `(Steel Path)` and one Faceoff table `(Steel Path
Winner)`; the level `100 - 100` bounty tier is not named but is gated all the
same, on the wiki's authority (*"Requires Mastery Rank 10 and unlock The Steel
Path"*) — and feeds the **demand badge** on the row, beside `PvPvE` where both
apply. No 100–100 tier carries a relic at all, so that half of the rule is
written for the day one does.

**Revisit if that stops being true.** The moment a Steel Path table pays
something its ordinary twin does not, the badge stops being sufficient and the
checkbox earns its place.

**Mastery Rank gates nothing here either, and would not even if it mattered.**
The worldstate publishes
`minMR` per bounty tier and it matches the wiki exactly — MR1 at level 10–30
through MR10 at 100–100 — so filtering by it would be easy and would be wrong.
The wiki: *"These can still be played, when an eligible squad member selects
one."* The rank stops you **selecting** a bounty, not running one, so hiding a
tier from someone whose squadmate can start it would answer the wrong question.
It belongs with the demand badges instead, which is what `TODO.md` records
alongside the header field the owner has specified for it.

That is the general rule these two cases establish: **a gate on *reaching* a node
excludes it; a gate on *starting* it only annotates it** — and a gate that
excludes only duplicates of things you can already reach annotates too, because
an option nobody's answer changes is worse than no option.

### Railjack is forced in when it is the only route

`Include Railjack` is off by default because Railjack is a different activity
with its own setup. For **six Primes it is the only activity**: Nyx, Valkyr,
Cernos, Hikou, Scindo and Venka left the ordinary drop tables and their relics
went to Railjack rather than into the vault. Excluding those is not a filter, it
is a dead end — the planner found eight perfectly good places and discarded every
one.

That produced an empty heading, then an empty heading naming the switch (below),
which is a large improvement on silence. It is still an opt-in gate in front of
the only thing there is. **Owner's decision, 2026-08-25**, of three options on
file — leave it, force it in, or a three-state checkbox: force it in and mark it.

A relic with **nothing reachable under the switches as set** has its Railjack
routes let through anyway, and every row built from one carries an amber `only
route` chip beside the `Railjack` demand badge, explaining that it is listed
despite the setting. The checkbox keeps meaning exactly what it says for
everything else: this fires only when the alternative is nowhere at all.

**Event nodes are never forced.** An event that is not running does not exist on
the star chart, so there is nothing to send anyone to. A Railjack node is always
there; the reader simply has to want it.

Two consequences worth knowing. Measured across the catalogue with both boxes
off, exactly those six take this path and **no live relic is stranded** — so
`noNodes` can no longer fire for Railjack. It stays for event nodes and for the
day the data changes, and its test now asserts the opposite of what it used to.

And it settled the *Still needed* over-count on its own. That panel counted
`!vaulted` while the node loop applied three tests, so it claimed relics the
reader was not being sent for — live on three Lex Prime parts, whose blocked
relics turned out to be **Neo V9, Meso N11 and Axi V10, every one of them
Railjack-only**. Forcing them in makes them genuinely reachable rather than
merely counted. Both sides now ask `ROT.reachableSource` with the same options,
so they cannot drift apart again, and today **no part is mixed and none has
nothing reachable**.

### Eight is the default, and there is a way out of it

The ranked list shows its top eight, and that stays: `STYLE.md §5` is emphatic
that a long list condenses to a count, and the point of a ranking is that the top
of it is the answer.

What was missing was the way *out*. The remainder lived in the `+N more places`
tooltip — twenty rows of tabular text in a control that exists to hold a
sentence, and which cannot be scrolled, sorted or searched. Past twenty-eight
there was no route to a place at all.

**That was not cosmetic, and it took three findings to notice.** Every one of
them was measured, correct, and invisible: Spy nodes reach no top eight on any
item, because no live relic drops only at Spy; the eleven nodes that hand relics
over Radiant sit from #33 down; and three page tests were written and deleted for
having no subject on screen before the pattern was recognised. The interface was
quietly bounding what could be verified about the model.

The chip is a button now and expands the list in place: one list, one ranking, no
new page, and **the order does not change** — it reveals the ranking, it does not
re-rank it. The count stays on the control, so the condensed default still says
how much is behind it. Measured on a want-everything plan: 8 rows become 92, ESO
appears at #38, and Pago and Bode are the first Spy nodes either page has shown.

The state is deliberately **not** in `opts` and not saved. `opts` holds
assumptions about the player, and every one of them changes the answer; this
changes only how much of the answer is on screen. A view that silently stayed
expanded from last week would make the default stop meaning what it says.

The collection drawer had the same defect and got the same fix the same day: it
sliced to eight and offered nothing after it, not even a tooltip. The slice moved
out of `bestSpots` so the total could be counted — it used to be thrown away
there, which is why the drawer could not say how much it was hiding. It resets to
eight when a **different** item is opened and keeps its state when the same one
re-renders, so ticking a part does not fold the list back up.

**And the fissure bonus is now stated on the cracking side.** It is a reward for
*opening* relics and it only ever appeared as a modifier on *Where to go*, because
that is where the run modes live. A reader deciding what to crack had no reason to
stay. It is said once under *How this works* rather than on every row, which is
what `STYLE.md §5` asks for a rule that is true of all of them. The scoring is
unchanged — feeding the live fissure list into the score would reorder the ranking
hourly on a fact that expires before anyone acts on it.

### An empty ranking has to say what emptied it

Put one of those six on the farm list with *Include Railjack* off and the planner
used to print the *Where to go* heading with nothing under it — while the panel
directly beneath went on listing four relics as dropping and marked every part
"1 relic dropping". Eight perfectly good places were found and discarded, and the
page said nothing about it. An empty heading beside a full one reads as a fault,
not as a setting.

It now names the switch, counts what is behind it, and says where it is:
*"Nowhere to send you, and not because nothing drops. 38 places carry what you
want and each of them is a Railjack mission, left out by default — tick **Include
Railjack** on the left to rank them."* Same treatment for event nodes, and a
plainer sentence when the exclusions are the data's own (quest and unmodelled
sources) and no switch would help.

### Effort is the player's to give, and blank until they do

Ranking per run flatters anything long. Against one player's own timings, ranking per
minute moved Capture and Exterminate nodes up **over a hundred places** and dropped
Spy by a factor of ten — far too large to leave unmodelled, and far too personal to
ship a default for. A strong player trivialises a Capture while a Spy vault still
costs its fixed hacking time, so even the *ratios* between the numbers belong to
whoever is playing.

So the planner asks, under *Effort — optional* in the sidebar, and needs no answer:
**with no minutes set anywhere, every run is costed by its objective count.**

That default changed on 2026-08-14. It used to be per *run*, which is not a unit at
all — a run is whatever you decide to make it, and the option directly above lets you
decide differently. Against one player's own timings, costing per run is out by up to
**9.6×** across mission types; costing per objective is out by **2.4×**, because a
round, a vault and a bounty stage all take somewhere around 2.5 to 6 minutes. Four
times closer to the truth, for free, and nobody has to agree with a number we shipped
— an objective count is a fact about the mission, not an estimate of anybody's play.

The effect is large and is the whole point. On a two-Prime list the old top rows were
Mithra and Mot at 63.85% a run; the new ones are Stribog (Sabotage) and Tiwaz (Mobile
Defense) at 16.1% an objective, with Mithra third at 15.96% — because Mithra's 63.85%
took four rounds and Stribog's 16.1% took one mission. Capture and Exterminate nodes
rise for the same reason.

Three decisions inside it are worth keeping:

- **The unit is one objective, never one run.** A Defense round, a Spy vault, a
  bounty stage. How far you take an endless mission is your own choice — a question
  whose unit moves cannot be answered once. Bounties are not on the round cycle at
  all and are costed at four stages. This bullet used to add that Spy and Caches
  need no special case, "their rotation *is* the count of vaults opened or caches
  found". That is true of the unit and false of the count, measured on 2026-08-25;
  `TODO.md` carries the entry and the two wiki questions it waits on.
- **How many objectives buy one reward is a second fact, and it is not always
  one.** Added 2026-08-25, and it is the fix for the worst mis-costing found that
  day. `rounds` counts *rewards* — `scorePlan` takes exactly one per iteration — and
  for almost every mission that is also the objective count, because a Defense round
  pays a reward and a Spy vault pays a reward. Onslaught does not.
  `wiki.warframe.com/w/Sanctuary_Onslaught` states it outright: "Rewards are given
  per two successful zones in an AABC rotation in both Sanctuary Onslaught and Elite
  Sanctuary Onslaught", mapping zones 2 and 10 to rotation A, 4 and 12 to A, 6 and
  14 to B, 8 and 16 to C.

  The *letters* were already right, and that is what made this a divisor rather than
  a rewrite: rewards 1–6 come out `A,A,B,C,A,A`, which is exactly what zones 2, 4,
  6, 8, 10 and 12 pay — checked against the wiki's own mapping, not assumed. What
  was wrong was the price. That same reward count was republished by `objectivesOf`
  as the objective count, so a twelve-zone run was costed at six and **both
  Onslaught nodes ranked at exactly twice their true rate** — Elite at 0.6835 where
  it should be 0.3418, ordinary at 0.5344 where it should be 0.2672. Between them
  those two nodes carry 29 of the 34 live relics, so it was not a corner of the list.

  It lives in `PER_REWARD` in `rotation.js`, beside `OBJECTIVE_UNIT` and
  deliberately not merged into it: that table renames an objective, this one says
  how many of them you buy, and a mission can need either without the other. Keyed
  on mode, which is right rather than lucky — both Onslaught nodes share the mode
  string and the wiki gives Elite no separate cadence, so one entry serves both.

  **It has to be a hand-written constant, and that was the uncomfortable part.**
  DE's table publishes three rotation headings per node and nothing else; the word
  *zone* does not appear anywhere in the whole 4.4 MB of it, so the source the
  pipeline parses cannot express cadence at all. The per-round assumption was ours,
  inherited from the AABC fallback. Nothing machine-readable publishes the real
  figure either, so this is a declared fact in the same class as the Disruption
  conduit table — which is the precedent that made it acceptable rather than a new
  kind of exception.

  Two things followed it. Both pages had to stop printing `rounds` as the cost:
  `plan.js` and `app.js` now read the shared `objectivesOf`, so an Onslaught row
  says *12 zones* on the planner and *12 zones* on the collection page instead of
  *6 rounds* on both. And the effort panel relabels itself for free — the box now
  asks for *min / zone* rather than *min / round*, which matters because a player
  timing themselves has only one countable unit and it is the zone. Typing a zone's
  minutes into a box that meant two zones would have halved the run a second time,
  in the per-minute ranking.
- **A blank type is costed at the average of the ones you filled in**, not at zero,
  which would sort it straight to the top of a list it was never measured against.
  The borrowed number is drawn in `--odd` amber on the row so it is a guess you can
  see rather than one you cannot.
- **The big number follows the ranking.** The headline reads *per objective* by
  default and *per minute* the moment any minutes are given, because the largest
  number in a row must always be the one the list is sorted by (`STYLE.md §5`).
  The faint line beneath keeps the per-run figure and what it was divided by, so
  nothing is lost by the change of basis.

Only mission types the current plan actually ranks get a box — 27 of the 31 in the
data, for a two-Prime list — and they stay in alphabetical order rather than moving
to match the ranking they alter.

### The three sources, and what we change about them

Everything comes from one of three places, and they disagree in ways worth
knowing. The policy: keep our data faithful to its source, and push corrections
upstream rather than entrench them here. Every knowing disagreement is listed in
TODO.md under *"Should be fixed on the wiki, not here"*.

**1. Digital Extremes — first party.** The drop tables and the Public Export.
This is the only source for what actually drops where, and it is authoritative.
Two quirks we work around:

- *Rarity words are chance-relative, not structural.* The 25.33% common slot is
  written "Uncommon", and the rare slot reads "Rare" at Intact but "Uncommon"
  once Radiant lifts it to 10%. **We derive rarity from the unrefined chance
  instead** (≥20% common, ≥6% uncommon, below that rare), which reproduces the
  exact 3/2/1 structure of every relic.
- *Quantities are baked into the name.* `2X Forma Blueprint` is split into
  `item: "Forma Blueprint", qty: 2`.
- The export omits Railjack/Proxima and temporary `Event:` nodes entirely, so
  enemy levels are known for about 69% of the nodes that drop live relics. An
  unknown level sorts last rather than being guessed at.

**2. The WARFRAME Wiki — editorial.** Supplies the catalogue's categories and the
`(V)` `(P)` `(B)` `(S)` and Founder markers. **DE publishes none of those flags**,
so they exist only because wiki editors maintain them — which means they can be
stale or simply wrong, and two currently are (see TODO). Categories stay here
deliberately: the wiki agrees with the item API on 250 of 277 items and every
disagreement favours the wiki, which keeps Exalted, Extractor and Robotic Weapon
apart where the API flattens them into "Misc" and "Primary". Those three
categories no longer reach the app — they hold nothing any relic drops, so they are
cut from the catalogue (§9) — but the wiki's precision is still what makes the cut
possible: you cannot drop a category the source has already blurred into another.

Wiki quirks handled in the parser: non-breaking spaces inside `{{WF}}` output,
`== Prime Related==` carrying a leading space, and `====` sub-headers that must
not be mistaken for categories.

**3. WFCD (warframestat) — convenience layer.** Component names, artwork
filenames, the `vaulted` field, and the live worldstate proxy. Its part naming
disagrees with the drop table (`Chassis` vs `Chassis Blueprint`), so
`normalise_part()` strips the redundant suffix — this matters because saved part
progress is keyed on those names and would otherwise appear to vanish when a
build falls back to the other source.

### Which source decides what

| Fact | Decided by | First party? |
|---|---|---|
| `farmable` | DE drop tables — does a relic for it drop right now | **yes** |
| relic contents, odds, drop locations | DE drop tables | **yes** |
| enemy levels | DE Public Export | **yes** |
| existence of a brand-new Prime | DE Public Export | **yes** |
| `resurgence` | live worldstate, via the WFCD proxy | yes, proxied |
| `vaulted` | WFCD's `vaulted`, wiki `(V)` as fallback | no |
| category | wiki page sections | no |
| `permanent` `baro` `special` `founder` | wiki markers only | **no — editorial** |
| artwork | WFCD CDN (the images are DE's) | no |

`farmable` is the one availability fact derived entirely from official data,
which is why the UI leans on it and why the vault/Baro/special/Founder markers
are treated as annotation rather than truth.

### One store, because two copies drifted twice

**Moved into `shared.js` on 2026-08-24.** The maths was already shared — that is
what `model.js` and `rotation.js` are for — but the *state* was not. Both pages
kept their own `collected`, `parts` and `wishlist`, loaded them separately, wrote
them separately, and were kept in step by hand. They drifted, and neither drift
was noticed by anyone looking at one page:

- **Only the planner listened for `storage`.** Tick a part there with the
  collection view open beside it and the collection view showed the old count
  until it was reloaded. The other direction updated instantly. Nothing recorded
  that as a decision; it was the half nobody wrote.
- **The same click meant two things.** A part counter on the collection page
  cycles `0 → 1 → … → need → 0`; on the planner it incremented and clamped.

`S.state` owns the three slices and every mutation that touches them —
`cyclePart`, `setAllParts`, `setCollected`, `syncCollected`, the wishlist. Pages
read through it and never write those keys. The rules moved with the data: what a
part click means, and that owning every part is not a claim to have built the
thing, are now each defined once.

**`subscribe` reports whether a change was external, and that distinction is the
design.** A page that changed something itself already knows what to repaint — one
counter, one card — and rebuilding everything would throw away the focus and the
scroll position the drawer works hard to keep. A change arriving from another tab
has no such context, so the honest response is to redraw. One path, enough
information to react correctly to both.

**What did not move, and why.** The two import paths stay different on purpose:
`app.js` merges in place and re-derives per part, `plan.js` writes the keys and
reloads, which keeps the careful merging as a single implementation rather than
copying it. The export did move — both pages assembled the same six keys
independently, which is one place too many for a file format. And `materials`
stays with the collection view, which is the only page that has it.

**One thing this does not fix.** The planner's wishlist panel lists only the parts
you are *missing*, so a part completes and its button leaves the list — the cycle
has nowhere to wrap. Correcting a mis-click there still means opening the item on
the collection page. That is a property of a worklist rather than of the click, and
showing owned parts in a list of what is left is a change worth deciding on its own
merits rather than as a side effect of this.

### A part can be a whole Prime, and four of them are

**Fixed 2026-08-24, and it was two bugs sharing a cause.** Four akimbo Primes are
built from two copies of the single-handed weapon — Aklex from two Lex Primes,
Akbronco from two Broncos, Akmagnus, Akvasto. DE publish that as **the same
component listed twice**, `itemCount: 1` each.

**Saved progress is keyed on the part name**, so two parts of one item called
"Lex Prime" shared one counter and there was nowhere to record holding one of the
two. Three clicks completed a four-part item; one tick moved the card from 0/4 to
2/4; Aklex Prime read as collected while you held half of what it needs. The
pipeline now folds the copies into one part with `itemCount: 2`, which the store
has always handled — Ivara Prime needs two of some of hers.

**And that component's `drops` are the union of every relic dropping any Lex Prime
*part*** — 130 of them. No relic drops a built weapon, so no odds can attach to any
of them: the chance lookup searches for `Aklex Prime …` and the relic pays `Lex
Prime Barrel`, which never matches. Carried into `item_relics`, that union made
Aklex Prime the only item in the payload flagged **farmable** on eight relics its
own card could then find nowhere to farm — `bestSpots` drops every relic worth
zero, so the section was absent entirely. The fold drops the relics with the
duplicate and adds `builtFrom`, naming the Prime to go and get instead. Aklex Prime
now files under Baro, which is what it is.

Two things this deliberately does **not** do. It does not resolve the requirement
through to the sub-weapon's own parts — that would make one item's relic list
another's, and a built weapon is not a relic drop. And marking Lex Prime collected
does not credit the parent: building an akimbo consumes two built Lex Primes, so
the one you own is one of them, not a spare. The card links to the sub-weapon and
the counter is yours to set.

`tests/test_build.py` asserts part names are unique within an item, which is the
assumption the older "part names are normalised" check silently rested on.

### The collection's default order is a question, and the alphabet was not it

**Changed 2026-08-26.** The collection opened grouped by category and ordered by
**name** inside each group. Grouping is right and stays; the name was never
answering anything. Ash Prime led the Warframes over Styanax Prime because `A`
precedes `S`, and the reader arriving at the page — who owns most of what is old
and is looking for the gap — had to scroll 51 cards to reach the ones that might
be new to them. **The default now orders each group newest release first**, and
name has dropped to the tie-break where it belongs.

This **redefined the existing option rather than adding a fifth**, and the choice
matters more than it looks: a saved `sort` wins over the default (`app.js` reads
it back out of `wfprimes.filters.v1`), and anyone who has ever touched a filter
has `"cat"` written down. Adding a new option would have changed the default for
nobody who already uses the site — including the owner. Redefining `"cat"` reaches
every saved store without a migration to write, and the stored value stays valid.
The cost is real and was accepted: **category-then-name is no longer offered.**
*Name (A–Z)* still exists for looking one thing up, which is the job that ordering
actually had.

Both sorts that read a date now go through one `byRelease`, because there are two
of them and they must not drift apart on the awkward case. **`releaseDate` is
`null` for exactly one item** — Kavasa Prime Collar — and `null` coerced to `""`
leads any ascending comparison it takes part in, so the rule that an undated item
sorts *last* is written once and asserted once. The old `release` comparator got
this right by accident, through the direction it happened to be sorting; the new
one does not depend on that.

### The Mastery Rank field, and the one number it derives

**Shipped 2026-08-26**, to the shape the owner specified on 2026-08-14: a number
the player fills in, sitting with the site name rather than in either sidebar, a
step pair, and empty until they say otherwise. **Reworked the same day** on the
owner's reading of it: the icon dropped, the letters moved outside the field, the
number made editable by hand, and the steps stacked directly above and below it
rather than either side.

**It lives in the shared plan store beside `squad`, not in either page's filters.**
A rank is an account fact — true on both pages at once — so a per-page copy would
be a thing that can disagree with itself, which is the drift that cost this project
twice already (*One store, because two copies drifted twice*). One value, one
`storage` event, both headers.

**Unset is `null` and stays that way.** Everything here defaults to "not known, say
nothing", and the reason is stronger for this field than for most: a guessed rank
would feed a **wrong trace cap**, which is worse than no cap at all. From unset,
`+` lands on **0** rather than 1 — Unranked is a real rank, and a field that cannot
express it is a field that lies about the newest players. `−` from unset does
nothing, there being nothing below it.

Ranks past 30 are Legendary, which the wiki writes `LR1`, `LR2` … with no published
cap, so one integer is kept and rendered as `LR<n−30>` above 30. The rank *titles*
follow DE's own three-rank cycle — a base word, then Silver, then Gold, ten times
over — and past 30 the wiki stops naming them, so neither do we: Legendary ranks
get the plain word rather than a guess.

**The Void Trace cap is the one thing that reads it so far.**
[`Void Traces`](https://wiki.warframe.com/w/Void_Traces): *"This cap is determined
by one's Mastery Rank using the formula: (Mastery Rank × 50) + 100."* The page's
own worked examples are MR13 = 750 and MR30 = 1600, and both are asserted in
`test_assets.mjs` — an external check on the formula rather than a restatement of
it. Legendary ranks keep counting from 30, so LR1 is 31; that continuation is ours,
since the wiki's table stops at 30.

The cap earns its place because the planner already splits on traces at **500** —
five Radiants. `(rank × 50) + 100 ≤ 500` up to **MR8**, so at or below MR8 the far
end of *"Short on Void Traces?"* cannot be reached at all. **The rank field says so
and leaves the switch alone.** That is the whole rule for this field, made concrete: it
gates nothing, by the owner's decision, and the wiki is why — a bounty above your
rank *"can still be played, when an eligible squad member selects one"*, so hiding a
tier from someone whose friend can start it would be exactly the wrong answer. A
cap is what you *can* hold; the switch is about what you *do* hold. A page test
asserts the switch stays enabled at MR8, because "informs, never filters" is the
kind of rule that erodes silently.

**It says it on the rank field, and not under the switch.** For one revision the cap had
its own line beneath *"Short on Void Traces?"* — *"At MR 9 your Void Trace cap is
550 — 5 Radiants at 100 traces each."* The owner cut it on sight and the reason
generalises: **that switch already names both its ends**, so a sentence underneath
explaining what 500 means was restating the control it sat under. A cap belongs to
the rank that determines it, and that field is where a reader goes to ask what their
rank means. `STYLE.md §5` covers the same ground from the other direction — a
paragraph between a heading and its data is read once and costs a screenful
forever.

**There is no icon, and the second attempt is why.** The first build carried a
drawn sigil, because DE's own rank icons are not reachable from here and both
routes were checked on 2026-08-26: `wiki.warframe.com` 403s any request that is not
a browser (§8), and the item CDN that supplies every other image in this app has no
rank art — its backing store 404s `IconRank1.png` while item images resolve. **The
owner cut the sigil rather than accept a substitute**, and that is the more useful
precedent: where the real thing cannot be had, a lookalike is not automatically
better than nothing. It was carrying a tier the rank titles already state in words,
in a header that has no room to spare.

**The letters sit outside the box, and that is what makes the field typeable.**
`MR` is a label beside the control, not part of the value — so past rank 30 it
becomes `LR` and the box holds the Legendary number while the store keeps one
integer. Two functions carry the split, `masteryShown` and `masteryTyped`, and a
test asserts they **round-trip**: shown and typed back must land on the same rank,
or a reader editing what they can see would end up somewhere else.

Typing is read against the label currently showing, which gives a route into
Legendary from the keyboard: **in MR mode the typed number is the rank, so typing
31 rolls over to LR 1 on its own**; in LR mode it is offset by 30, and typing 0
there lands on MR 30. Committed on **blur and Enter, never per keystroke** — MR 1
is a real rank with a real trace cap, and a field saving as you type would store it
on the way to MR 13. A value that is not a whole number ≥ 0 is **refused by putting
back what is stored**, never by writing a guess; an emptied box clears the rank
rather than meaning zero. Escape reverts, and the arrow keys step.

There is **no upper stop**. The wiki publishes no Legendary cap, so the field keeps
counting and keeps rendering `LR n` rather than inventing a ceiling.

**One bug worth keeping, because it was latent for a day.** `mrClamp` read
`isFinite(n) && n >= 0`, and `isFinite(null)` is **true** in JavaScript — `null`
coerces to `0`. So a cleared rank read back as `Math.floor(null)`, which is `0`, and
every *"I have not said"* silently became *"I am rank 0"* — a real rank, with a real
trace cap of 100. Nothing had ever written `null` until the box became typeable, so
the defect shipped harmless and went off the moment the feature it was waiting for
arrived. The guard is now `typeof n === "number"`.

**Why `shared.js` and not `model.js`.** The usual rule is that testable logic goes
in `model.js` or `rotation.js` (§2). This is the exception and the reason is load
order: `shared.js` runs first, owns the store, and is where the `storage` listener
already lives, so a header widget that reads and writes the plan store belongs with
it. Nothing is lost — `test_assets.mjs` loads `shared.js` in the same `node:vm`
sandbox and covers the four pure functions without a browser.

### The top bar is three tracks, and the footer is one line

**Reworked 2026-08-26**, on the owner's reading of the bar after the Mastery Rank
field went into it.

**The search is centred on the page, not on the leftovers.** It was a flex child
with `flex:1`, which centres a thing inside whatever space its neighbours leave —
so it moved whenever the two sides differed in width, and adding the rank field
pushed it right. Measured under the old rule: **57px right of the bar's centre**.
The bar is now `grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)`; the side
tracks are equal by construction, so the middle one is genuinely centred and stays
there. A page test asserts both halves — that the centre is the centre, and that
it **does not move when a side changes width**, which is the actual defect rather
than one arrangement that happened to look right.

Two things follow from the three tracks. The **view tabs moved into the right-hand
group** with *Backup*, which is where a segmented control for "which half of the
app" reads as navigation rather than as another thing competing for the middle.
And the **overall collected count left the bar entirely**, down to the line beside
the result count, where it sits with the other number of its kind: both say how
much of the catalogue this is, one filtered and one absolute. In the header it was
a two-line box arguing with the search for the centre.

Below 1100px none of this applies — the bar wraps and the search takes a row of
its own. The centring is the point of the grid, and a cramped centre would be
worse than a wrapped one.

**The footer.** Attribution, privacy and licensing now sit in one quiet line
across the foot of **both** pages. They used to be a block appended to the
collection sidebar's data note, which meant the planner carried **none of them** —
a licence notice on one page of two is not a licence notice. They are rendered
from a single function in `shared.js` rather than written into both HTML files:
two documents drifting apart is the ordinary cost of duplication, and for a
privacy claim and a content-policy attribution it is worse than ordinary, because
the wrong half still reads as authoritative. A page test asserts the two pages
render the **same string**.

Small and quiet — 10.5px — but the colours are the ones the old rule had already
solved, `#9ba1aa` and `#99a1ad`, kept rather than re-derived. That rule carried its
own reason and it still holds: **attribution is the one thing on the page that is
not ours to make hard to read.** The surface underneath is `--bg-2`, darker than
the `--panel` they were solved against, so both measure higher here than they did
there. "Low visibility" is spent on size and weight, never on contrast, and a test
asserts the colour so that instruction cannot erode into unreadable.

### Shared UI conventions

Both pages share one visual vocabulary so a habit learned on either carries over:
row background encodes the **action** (which refinement), chips encode **rarity**,
vaulted fades to violet, long lists condense with the detail on hover, and
tooltips explain rather than repeat.

A part chip also carries **`×N` when you need more than one of it**, added
2026-08-25. 53 parts in the catalogue ask for two — the akimbo barrels and
receivers, and blades like Kestrel Prime's — and until then farming for a pair
looked exactly like farming for one. The only thing that moved was the openings
figure on the row above, which is not where anyone looks to find out *what* they
are collecting. The count is what you **still need**, not what the recipe asks
for: bank one of a pair and the chip drops the marker, because the openings figure
beside it has always been priced on the shortfall, and a chip saying `×2` next to
the cost of fetching one would be the row contradicting itself. The *Still needed*
panel had used exactly this rule and this `×N` since it was written; the crack
list simply had not.

**The rules live in [STYLE.md](STYLE.md)** — read it before adding UI. Each rule
records why it exists, so it is clear when one does not apply.

### Availability buckets

Each item **displays** as exactly one bucket so the sidebar stays unambiguous;
cards can still show several badges. Precedence:

`founder → resurgence → farmable → baro → special → vaulted`

**The filter reads every bucket an item is in, not the one it displays as** — a
distinction added 2026-08-24, because filtering on the primary alone made an item
vanish while a box that covered it was still ticked. Two items today have two
sources: Lex Prime is farmable *and* sold by Baro, Gotva Prime is a Baro item the
wiki also marks `(S)`. Unticking *Farmable* took Lex Prime away from the *Baro
Ki'Teer* box that was still ticked, with nothing on screen saying where it had gone.

So `bucketsOf` answers *which toggles keep this on screen* and `statusOf` — its
first element, so the two cannot drift — answers *which one does it show as*. The
counts beside the boxes state **coverage**: what unticking that box would stop
covering, which means an item with two sources is counted beside both and the
column can add up to more than 167. The sidebar says so in a line under it. Vaulted
is the fallback rather than a flag, because it is the absence of a source rather
than one of them.

Resurgence outranks farmable because it's time-limited. **Baro outranks special**
because Gotva Prime carries the wiki's bare `(S)` marker but is really a Void
Trader item — the more specific answer wins. Founder is first in precedence but
displayed *last* in the sidebar: it will never be available again, so it is the
least actionable thing on the list.

Items the wiki marks `(S)` get their real acquisition route read from their own
wiki page (`acquisition_summary`), so "Other sources" can say *The Perita
Rebellion, Rotation A* rather than shrugging. Only a handful of items, fetched
non-critically.

**`vaultSoon`** flags the two oldest still-farmable release batches. Vaulting runs
on a strict cadence — every Prime Access release vaults the Prime from seven
releases earlier, on the same day, which holds for all 41 vaulted Warframes in the
current data. The flag is computed from the farmable non-permanent Warframes and
then applied by release date, so the weapons that shipped alongside are caught too.

### Two security findings examined and declined

An outside review of 2026-08-26 filed ten findings; eight are in `TODO.md` in
whatever form survived being checked against the code. These two did not survive,
and are kept here so the questions are not asked again from scratch.

**An unbounded backup import is not a finding.** The claim was that reading a
user-chosen file with `FileReader` and parsing it as JSON can freeze or crash the
tab. It can — in the same sense that opening any large file can. There is no
adversary anywhere in it: the user picks the file from their own disk, both import
handlers wrap `parseBackup` in `try`/`catch` and report *"Could not read that"*, and
`reader.onerror` is handled. Every loop in `parseBackup` is linear in input size —
no recursion, no backtracking regex, no quadratic merge — so a hostile file buys
nothing that a merely large one does not, which is what makes "huge **or** malicious"
a false pairing. The file input is not even a distinct surface: the same text pastes
straight into `#dataArea` with no file at all, so a size cap on the picker would not
remove the behaviour described. It would add a limit to explain and a way to reject
a legitimate backup. Declined.

The finding did point at the right function, and looking properly turned up a real
gap that is *not* the one filed: `filters` and `sort` are adopted from a backup
without validation. That one is in `TODO.md`.

**"Cache poisoning" is the wrong name for a narrow interrupted-write window.** The
claim was that fetched bytes are written over the gzip cache before parsing
validates them, and that several outputs are written straight to their final paths.
Both are true and neither is poisoning: `.cache/` is local and written only by our
own fetch, so nobody can plant an entry. The flagship scenario has no impact either
— a bad body is cached with its ETag, so the next run gets a 304 and identical
bytes, which is exactly what a fresh fetch would return while upstream is unchanged.
Two of the cited lines contain the guard the finding says is missing
(`artwork.py:96-97` raises on an empty body *before* the write), `--refresh-images`
already detects a truncated image by size and refetches it, and `save_state()` runs
**after** the emit, so `--if-changed` cannot skip past a torn payload on the next
run. A torn emit fails loudly rather than persisting as plausible wrong data: the
built-payload group catches it and the page fails to define `window.WFPRIME_DATA`.

What survives is genuinely narrow — an interruption between opening the gzip file
and closing it, most plausibly a full disk. `os.replace` onto a temporary sibling is
the right shape and is worth doing if that code is being touched for another reason.
It is not worth a backlog entry standing on its own, which is why it is recorded
here instead of there.

**The review of 2026-08-26, and what came of it.** An outside review filed ten
findings against `46ae037`. Every one was re-derived from the source before being
written down, which is the rule the 2026-08-24 batch was held to and it earned its
keep again: **three stood as written, seven were inflated, and both worked examples
for its best finding were duds** — the artwork guard at `artwork.py:80` blocks the
two files it named, so the case that mattered was one it never wrote down. Its
citations had also drifted six commits.

Twelve entries came out of it in the end, ten of them repairs and all twelve now
shipped; two further findings were examined and declined and are recorded below.
**Four of the twelve were things the review never filed** — they surfaced only
because checking its findings meant reading the code around them.

**What else was swept — and what that sweep got wrong.** The review covered ten
things; the areas below were checked afterwards because it had not looked at them.

**The first version of this list, committed on 2026-08-26, called `serve.py`'s
allowlist clean. It was not, and the sentence that cleared it was the exact sentence
that described the bug.** It said *"`translate_path` is not overridden, so the
stdlib's own component filter is still the second gate."* Not overriding
`translate_path` was the vulnerability: the server computed the request path twice,
by two algorithms that disagree, and enforced the allowlist on the one it did not
open. The lesson is kept here rather than deleted, because *"I checked this and it
is fine"* is the most expensive sentence in this repository — it stops the next
reader looking — and this is the second time a document in it has vouched for
something that was not true.

**Both path defects were fixed the same day.** The shape of each fix is the same,
and it is the general answer to this class:

- **`serve.py` now has one path parser.** `translate_path` is overridden to build
  from the `rel` that `_relative()` produced and `allowed()` approved, so the checked
  string and the opened string are the same object by construction. The alternative —
  teaching the stdlib's parser about backslashes — leaves two parsers that have to be
  kept in step, which is the thing that failed.
- **`artwork.local_name()` is now the only place a CDN URL becomes a filename**, used
  by both the download loop and the rewire loop so they cannot drift. It is an
  allowlist (`[A-Za-z0-9._-]+`) after a `basename` check, because a blocklist does not
  work here: `os.path.join(IMG_DIR, r"C:\Windows\Temp\x")` discards `IMG_DIR` and
  contains no `..` at all. A `realpath`/`commonpath` containment check sits at the
  write as well — redundant today, deliberately, so a future loosening of the
  derivation still cannot write outside the folder.

**The three untrusted-value-into-markup defects were fixed the same day, and the
fix has two layers because they have two different sources.**

- **`build_data.as_int` is the boundary.** `masteryReq`, `ducats` and `itemCount`
  are documented as numeric and arrive as third-party JSON, which is not the same
  thing; all three were interpolated into `innerHTML` while their neighbours in the
  same template went through `esc()`. They are coerced once, on the way into the
  payload, so nothing downstream has to remember — and the payload on disk is the
  artefact other people download. It is strict on purpose: a numeric string would
  be easy to accept and would hide an upstream that had started sending them, so
  the value is dropped and the change shows on screen instead.
- **`WFPrimeShared.count` is the other end**, because the second source has no
  build boundary to coerce at: `ST.owns` reads `localStorage`, which a person can
  hand-edit and which *Import* writes from a file they chose, and it landed in the
  same `${have}/${need}` template. Coercing at the accessor rather than at each of
  the eleven interpolations is deliberate — that list is easy to add to, and nobody
  adding the twelfth would remember. `model.js` calls the same `count` rather than
  keeping a second copy of the rule, for the reason *One store* records above.
  `Number()` alone would not have done: `Number([])` is `0`, `Number(true)` is `1`,
  and `Number({toString: () => "9"})` is `9`, so the type is checked before the
  value. That last case was found by a test, not by reading.
- **`bundle.guard_text` now matches what actually ends a script block.** It was a
  literal `str.replace` of lowercase `</script>`; HTML matches the close tag
  ASCII-case-insensitively and terminates on `</script` followed by whitespace, `/`
  or `>`. Item names reach the inlined dataset from the wiki with only whitespace
  normalised, and `publish.yml` copies the standalone into `_site/` beside the
  tracker — same origin, same `localStorage` — so a public wiki edit was enough.
  It was lifted out of a closure to module level so the suite can ask it directly
  what it does to `</ScRiPt>` instead of building a bundle and grepping it.
  `<!--` is deliberately left alone: it is a real hazard in a serialiser, but
  `guard_text` runs over whole JavaScript files, where `<!--` is a legal line
  comment and an inserted backslash is a syntax error.

**The CDN is a redirector, and the CSP did not know it.** Found on 2026-08-26 while
costing the meta-CSP options, and unrelated to that decision.
`cdn.warframestat.us/img/AshPrime.png` answers **301** to
`raw.githubusercontent.com/wfcd/warframe-items/master/data/img/AshPrime.png`, and a
policy is enforced against every hop of a redirect rather than only the URL in the
markup. `build_csp()` named the CDN alone, so on any build without local artwork —
which is every CI build, and any local build run with `--no-images` — **all 167
images were blocked**. Measured in Chromium against the real page: nought loaded,
one violation each.

What made it survive is worth keeping: the violation report names the
**pre-redirect** URL, so the console accuses `cdn.warframestat.us`, which the policy
visibly allows. The error points at the one host that is not the problem. Both hosts
are named now, and the test asserts them as a pair — allowing one without the other
is the broken state, so neither can be removed on its own.

**The seven remaining entries shipped the same day.** None changed a decision; each
made something true that a document or a comment already claimed:

- **The stall timeout moved to the class that can apply it.** `SiteHandler.timeout`
  is what `StreamRequestHandler.setup` puts on the accepted socket. The same name on
  the server class is a different attribute, `serve_forever` says in its own
  docstring that it ignores it, and the comment beside it had promised the
  protection for the life of the server. `Server.timeout` stays only because
  `handle_request` reads it, and now says so.
- **`serve.py`'s freshness comment says what the check does.** It claimed "three
  HEAD requests, no downloads"; it is one HEAD and two GETs, and both GETs write
  their bodies to `.cache/*.gz` with `.etag` sidecars — so serving a page writes to
  the cache the build reads from. Harmless, and worth saying rather than denying.
- **The deploy scopes are granted per job.** `pages: write` and `id-token: write`
  were at workflow level, so the build job — the one fetching from six third-party
  endpoints — carried them and never used them. Both `checkout` steps also set
  `persist-credentials: false`; the wiki job clones with its own token in the URL,
  so nothing there wanted a credential left in `.git/config`.
- **The footer says what is true of the copy being read.** The artwork sentence is
  derived from `meta.sources.images`, the same signal `serve.py` uses to decide
  whether its CSP may name the CDN, so the claim and the enforcement come from one
  fact. The rate-limiter sentence appears only when `WFPRIME_UPSTREAM` exists —
  it describes `tools/serve.py`, and on Pages or `file://` it was describing a
  server that is not there.
- **`schedule.sh` quotes paths it cannot otherwise escape.** A single quote cannot
  be escaped inside single quotes, so a project path containing an apostrophe
  emitted a cron line with an unterminated string — accepted by `crontab`, failing
  every ten minutes thereafter. The `.ps1` twin had always been right, which is the
  kind of gap that only shows up on somebody else's machine. Parameter expansion
  rather than `sed`: the `sed` version has to survive two levels of quoting, and
  the first attempt silently produced `'''` instead of `'\''`.
- **The fissure `mode` field is gone.** It carried the worldstate's `missionType`
  as free-form upstream text and nothing had ever read it, while `tier` two lines
  above is refused unless it matches one of five literals. If a badge ever wants to
  say *a Lith Defense fissure is running here*, it comes back through the same
  allowlist rather than off the wire.
- **Restored filters are taken from the defaults, not from the file.** `avail` was
  `Object.assign`ed wholesale, and every key of it is interpolated into a CSS
  selector — `[data-count="${k}"]` — so a hand-edited backup with a quote in a key
  made the selector malformed, `querySelector` threw, and `render()` stopped. The
  existing defaults are the allowlist, so there is no second list to keep in step.
  `sort` is normalised where `SORTS` first exists, which is below the block that
  restores it.

**Both tests were written to fail first, and both replaced a test that could not
see the bug.** The server test used to ask `allowed()` about paths that were already
clean — it sent the answer, not the request — so it now drives `_relative()` and
`translate_path` through a bare handler instance and asserts the invariant that
actually matters: *the file opened is the file that was approved*. That is a property,
not a list of tricks; a blocklist of known payloads only ever knows the ones somebody
thought of. The artwork test used to call `os.path.basename` **inside** its filter, so
`../app.js` was tested as `app.js` and passed.

What survives, with the corrections the re-check forced:

- **The `temp_mockup.html` carve-out is bounded by an exact-set membership and a
  loopback peer**, and `end_headers` recomputes both rather than trusting
  `allowed()`, which matters because it also runs on error responses. `LOOPBACK`
  covers `::ffff:127.` so the v4-mapped v6 case is handled, and a test compares the
  two policies directive by directive (`tests/test_build.py:1448-1461`), asserting
  the relaxation is *exactly* `'unsafe-inline'` and that `unsafe-eval` never appears.
  **What that does not do is bind the policy to the body** — `rel` describes the
  request path, not the file that gets opened, so the same desync above can attach
  the relaxed policy to a different file. That half is part of the `TODO.md` entry.
  `temp_mockup.html` is absent from this disk, so the carve-out is currently inert.
- **`wiki.py` carries no upstream string into the wiki today**, which is worth
  knowing because that job holds `contents: write` — but not for the reason first
  recorded. It assembles from `README.md`, `PROJECT.md` and **`TODO.md`** (not
  `NOTICE.md`, which is only a link-rewrite target), and two of the six figures in
  its stats table — `meta.itemCount` and `meta.dropSource` (`wiki.py:273, :277`) —
  are raw dict reads interpolated into an f-string with no coercion and no escaping.
  They are safe because `acquire_drops()` returns one of two string literals, which
  is an invariant of `build_data.py` rather than a property of `wiki.py`.
- **Both cross-tab handlers re-read through `load()`** and neither touches
  `e.newValue` — `shared.js:218` and `shared.js:674`, the second of which the first
  sweep never opened. **That is not a sanitisation claim**, and the first version of
  this list implied it was: `load()` is `JSON.parse` in a `try`/`catch` with a
  default and validates nothing, so re-reading yields exactly what
  `JSON.parse(e.newValue)` would. The Mastery Rank listener is genuinely safe because
  `mrClamp` is a real type gate; the collection listener is not gated, and where that
  leads is in `TODO.md`.
- **The live fissure path is safe because of a build-time allowlist, not because of
  escaping.** `build_data.py:692` drops any `tier` outside five exact literals, and
  `tier` is the only fissure string rendered. `node` and `mode` reach the payload as
  free-form upstream text (`:698, :700`); nothing renders them, and `mode` has no
  consumer at all. **This is evidence for coercing at the boundary, not against it** —
  the first version of this list cited it as proof the three unescaped numbers in
  `TODO.md` were an acceptable exception, which is backwards.
- **`schedule.ps1` quotes the script path** it hands to `New-ScheduledTaskAction`,
  verified by building the action with a space-bearing path. `schedule.sh` is the
  other half of that subsystem and was not opened; it has its own `TODO.md` entry.
- **The public repository has never carried a generated file or a credential.**
  Checked against history, not only `git ls-files`: `.gitignore` has covered
  `.cache/`, `dist/`, `.claude/` and `__pycache__/` since the root commit, which is
  what actually produces the outcome. One correction to the first version, which
  enumerated `.claude` as cleared: `CLAUDE.md` itself was committed at `b169683` and
  deleted at `ae68819` about two and three-quarter hours later, so that blob is in
  public history permanently. Its content is benign — working rules, no credentials,
  no absolute paths — but "nothing local ever got out" would be false.

---

## 8. Gotchas discovered while building

These cost real debugging time — worth remembering.

1. **The wiki uses non-breaking spaces.** `{{WF|Ash Prime}}` renders `Ash\xa0Prime`.
   Every name comparison silently failed until the parser normalised `\xa0` → space.
2. **`== Prime Related==` has a leading space.** A plain `find("==Prime Related==")`
   missed it, so Mods, Fish and Corrupted items leaked into the catalogue (325
   entries instead of 189). The section boundary is a regex now.
3. **The wiki's `(R)` Resurgence markers are stale** — the Prime page still lists the
   2021 debut rotation and carries an `{{UpdateMe}}` tag. Resurgence status comes from
   the live worldstate instead, matched on `uniqueName`.
4. **DE's `worldState.php` is 404** on both `content.` and `origin.warframe.com`.
   The warframestat `/pc` proxy is the only working route to the live worldstate, so
   Resurgence is the one signal that is not first party.
5. **DE's LZMA streams break Python's strict decoder.** `index_en.txt.lzma` is
   LZMA-alone with a declared size that `lzma.decompress` rejects as corrupt. Blank
   the 8-byte size field to `\xff` and trust the end marker — `official.decode_index`
   does this.
6. **Export names carry internal tags**: `"<ARCHWING> Odonata Prime"`. Strip the
   leading `<…>` or every archwing looks like a brand-new Prime.
7. **Wiki images return HTTP 403** to anything that isn't a real browser session, with
   or without the `?hash` query. Artwork comes from `cdn.warframestat.us/img/<imageName>`
   using the exact casing the items API reports (`AshPrime.png`, not `ash-prime.png`).
8. **Only ~35 relics drop at any one time.** That looks broken but is correct — the
   rest are vaulted. It's why only 36 of 167 Primes are farmable right now.
9. **The pipeline is Python stdlib and the front end has no dependencies**, and that
   predates Node being available here. Node arrived on 2026-08-12 and changed nothing
   about either — it runs tests and only tests (§2). Written down because the original
   constraint was "this machine has no Node", and the *reason* to keep the site
   dependency-free is not that one, which has expired; it is that the thing has to
   survive being copied to a USB stick.

---

## 9. Current snapshot

As of the build of 2026-08-15:

- **167 Primes** — 51 Warframe, 41 Melee, 34 Primary, 31 Secondary, 7 Companion,
  2 Archgun, 1 Archwing
- **763 relics** tracked, **34** currently dropping
- **36 Primes farmable now**, **5** in Prime Resurgence, 135 vaulted
- **0 Primes** in DE's export missing from the wiki — the wiki page is currently complete
- Resurgence rotation runs **2026-08-06 → 2026-09-03** (Baruuk, Revenant, Phantasma,
  Afuris, Tatsu)
- 31 mission types carry a relic; a two-Prime list ranks 27 of them

**The catalogue is relic-only, and that is why it is 167 and not 315.** Five
categories hold no item any relic can ever drop — verified by exact match against
every relic reward, 0 of 148 — so `NON_RELIC_CATEGORIES` in `catalogue.py` cuts them
rather than showing them as permanently "vaulted", which was true and useless:

| Dropped | Because |
|---|---|
| Cosmetic, Extractor, Emote | Prime Access / Accessories only |
| Exalted | intrinsic to the frame that wields it |
| Robotic Weapon | comes with its Prime sentinel |

Excalibur Prime has no relic parts either and **stays**, because it is a Warframe
that is Founder-only rather than a different kind of thing, and reads as
unobtainable. That is the rule: cut a category, never an item.

Switching to the official drop table also picked up sources the mirror lacked:
enemy drops (Hemocyte, the only relic-dropping enemy in the table) and `Event:` star
chart nodes.

Known limits:

- Excalibur, Lato and Skana Prime are Founder-exclusive and have no relics by design.
- Relic *sources* are deduped and sorted by drop chance, but never capped. An
  earlier 40-row cap silently hid whole rotations — it looked like tidying and was
  losing farms — and was removed.
- Parts reconstructed from the drop table use DE's raw part names
  (`"Chassis Blueprint"` rather than the API's `"Chassis"`). Cosmetic only.

---

## 10. Possible next steps

See **[TODO.md](TODO.md)** — everything still outstanding, kept as a
running list rather than duplicated here.
