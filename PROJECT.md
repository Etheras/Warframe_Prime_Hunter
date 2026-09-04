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
| Say what a run costs you in real time | *Effort — optional* in the sidebar, minutes per reward per mission type (§7) |

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

### Never undo work without asking — no revert, no discard, no reset

Adding to history is ordinary work. **Taking anything out of it, or out of the
working tree, is the owner's call and needs asking first, every time.** That
covers `git revert` and `git reset`, rewriting or amending a commit, deleting a
branch, and — this is the one that actually happened — **`git checkout -- <file>`
and `git restore`, which silently destroy uncommitted changes with no reflog
entry and no way back.**

The asymmetry is the whole point. A commit can be undone; an uncommitted change
that has been checked out over is simply gone. So the more casual the command
looks, the more it needs asking: `git revert` at least announces itself, while
`git checkout -- somefile` reads like tidying up.

**Written down on 2026-09-01, from a live instance.** A session ran
`git checkout -- data/feed-log.json` to keep local build churn out of a commit.
No commit was reverted and history was untouched — but four rows of a file the
owner was **using for a test** were destroyed to make a diff look tidier, and
nobody was asked. Tidiness is never a reason. The right move was to say the file
was dirty and let the owner decide, or to stage selectively and leave the file
alone.

If the tree is dirty in a way that complicates a commit: **say so and stop.**
`git add -p`, committing the file as it stands, or simply leaving it out of the
commit are all available and none of them destroys anything.

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

**An API is not a dependency; a library is.** Restated by the owner on
2026-08-27, and the distinction is the useful part. Reading somebody's HTTP
endpoint costs the project nothing at rest — the data arrives, the build parses
it deterministically, and the artefact still opens from a USB stick with no
network at all. Adding somebody's *code* is the thing that changes what this
project is, and there are exactly three of those (Node, Playwright, `gh`), all
optional, all test-time.

So a new endpoint is ordinary work. **A new library, package, vendored file or
copied implementation is not, and needs two things in this order:**

1. **The owner's approval, asked for before it is written in.** Not after, and
   not as a fait accompli in a commit that also does something else.
2. **Its licence read** — actually read, and recorded in `NOTICE.md` beside the
   others, with what it permits and what it obliges.

The near miss that prompted this: the first-party worldstate work in `TODO.md`
names [`WFCD/warframe-drop-data`](https://github.com/WFCD/warframe-drop-data) as
a **reference to read**, because it shows how the raw worldstate is normalised.
Reading how somebody solved a mapping and writing our own is fine and is what
that entry means. Vendoring their tables, copying their parser, or adding their
package is not, and would need both steps above first — including for a mapping
table lifted verbatim, which is code wearing a data hat. `NOTICE.md` already
credits WFCD for **data** under MIT; that credit does not extend itself to code
nobody has checked.

### Real money is out of scope, always

**This tool is about what you can go and earn.** Every route it ranks, counts or
recommends must be reachable by playing the game. Anything that needs a card is
not a farm and has no place in the ranking, the collection counts, or the
planner.

| In scope — earned by playing | Out of scope — bought |
|---|---|
| Relics, and the missions that drop them | **Regal Aya** (real money only) |
| **Aya**, farmed from missions and bounties | **Platinum** bought from Digital Extremes |
| **Ducats**, from selling spare parts to Baro | Prime Access and Prime Vault packs |
| Void Traces, and everything they refine | Anything else sold for money or premium currency |

Aya and Ducats are *in* precisely because you get them by playing. The line is not
"is a currency involved" — it is **"can this be earned by playing, or must it be
purchased?"**

**One place this needs care, because it looks like a violation and is not.**
Varzia's rotating stock is read as a *signal*, not a shopping list. Her
`Manifest` is a list of Regal Aya packs, and the packs are ignored — what is
taken from them is **which Primes are unvaulted this rotation**, because those
are the Primes whose relics she then sells for farmed Aya. Reading a paid
product's name to learn which relics are farmable is the opposite of
recommending it.

Her `EvergreenManifest` is the case that made this explicit, on 2026-08-27: 82
items, permanently on sale, and **not one of them a relic** — 42 mods and skins,
27 miscellaneous store items, 8 accessory packs, 4 Prime weapons sold outright
and 1 character. All bought, none farmed. They are excluded from the Resurgence
flag for that reason and not merely because including them would make the badge
noisy, which is the weaker argument this section originally gave.

### Ask no more often than the source says to

**Every request this project makes is somebody else's bandwidth, given for
free.** Digital Extremes and WFCD both publish openly and neither charges, gates
or authenticates us. That is hospitality, and the way to keep it is to take less
of it than we are offered.

**The rule: honour each source's own `Cache-Control: max-age`.** Do not
re-request a document before the freshness window the server itself declared has
expired — serve it from our own cache instead. Not a number we invent, not a
number we tune: theirs.

Three reasons it is that rule rather than a polite constant.

It is **their** answer to the question, and they are the only party who knows it.
A 24-hour `max-age` on the drop tables is DE saying *this changes about daily*;
a 28-second one on the worldstate is DE saying *poll this, it moves*. Guessing a
single interval for both would be wrong twice.

It is **ordinary HTTP**, not a bespoke throttle. Every cache in the world already
behaves this way, and the code that implements it is a comparison against a file
mtime.

And it **keeps working when they change their minds.** A number in our source has
to be noticed and re-tuned; a number in their header updates itself.

What they publish, measured 2026-08-27 — no source sends `X-RateLimit-*`, none
sends `Retry-After`, and there is no usage policy in the WFCD READMEs or on
`docs.warframestat.us`, so these headers are the whole of the stated policy:

| Source | Says | Meaning |
|---|---|---|
| `api.warframe.com/cdn/worldState.php` | `max-age=28` | built to be polled |
| `www.warframe.com/droptables` | `max-age=86400` | about daily |
| `content.warframe.com/PublicExport/index_en.txt.lzma` | `no-cache` + `ETag` | always revalidate, and it answers 304 |
| `api.warframestat.us/items` | `max-age=120` | |
| `drops.warframestat.us/data/*` | `max-age=600` | |

`no-cache` is not `no-store` and does not mean *ask constantly*: it means
*revalidate before reusing*, which a conditional request does in a header
exchange with no body. **Always send `If-None-Match` when an ETag is held.** We
already do, and it is the cheapest possible way to be current.

**Where we stood when the rule was written.** About four requests per ten-minute
cycle — one conditional GET and one HEAD to DE, two GETs to WFCD — with the
local scheduled task and CI each running it, so roughly 1,150 a day between them.
Small in absolute terms and not the point: the drop-table HEAD fired 144 times
inside a window DE themselves declare as one day. Small and thoughtless is still
thoughtless.

**And it is enforced rather than merely stated, since 2026-08-27.** The rule sat
written down for a few hours while nothing obeyed it, which the owner noticed and
asked about — a rule in a document that no code reads is a preference, not a
rule.

`fetch` now records `max-age` beside the body, like the validator, and returns
the cached copy without a request while that window holds. `head_cached` does the
same for the one probe that was a bare HEAD. Measured on two back-to-back
freshness probes: **three requests, then one.** The remaining one is the export
index, which is `no-cache` and revalidates by ETag into a 304 with no body —
exactly what it should do.

Per ten-minute cycle in the steady state that leaves: the worldstate is asked
(its window is 28 seconds, so ten minutes is well past it), the export index is
revalidated, and **the drop table is asked once a day instead of 144 times.**

Two details are deliberate. `no-cache` and `no-store` leave **no** window behind
rather than a zero one, because they mean *revalidate* and the conditional
request already does that for free — treating them as `max-age=0` would work but
would quietly bypass the ETag path. And anything missing or unreadable — no
sidecar, a bad number, a vanished file — means **ask**: a lost sidecar costs one
request, while assuming freshness costs correctness.

**`robots.txt`, checked the same day:** `www.warframe.com` disallows only account
and admin paths, so `/droptables` is permitted; `api.warframe.com` and
`content.warframe.com` serve none. Nothing we fetch is disallowed. Re-check it if
a new path is ever added — a 404 on `robots.txt` is permission by silence, and
silence can end.

**One request that is never cheap: the artwork.** A page load fetches one image
per card, 167 of them, from somebody else's CDN. `--with-images` exists precisely
so a local copy can serve them instead, and it is the polite build for anything
long-lived.

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
- **A hook that refuses the paths it recognises.** `tools/guard_shell_writes.py`
  reads a PreToolUse payload and denies the shell commands it can identify as
  writing a guarded file, with an explanation of what to do instead. It stays out
  of the way of reads, greps, builds and redirects to `/tmp` —
  `test_the_guard_refuses_shell_writes_to_source` asserts both directions,
  because a guard that over-blocks gets switched off.
  **This said "denies any shell command that would write a guarded file" until
  2026-09-03, and that was false** — it is a blacklist of shell syntax and ten
  ways round it were found in an afternoon. The word "any" is what would have
  stopped somebody checking.
- **A pass that notices the ones it did not recognise.** The same file, run again
  as a PostToolUse hook with `--verify`, fingerprints the guarded set before and
  after every shell command and reports what moved. No enumeration, so no gap —
  and no prevention either, which is the trade. See *The guard stopped guessing
  at shell syntax and started checking what changed*.
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
| `tools/bundle.py` | `python tests/test_build.py` for the built markup, **and** `node --test tests/test_pages.mjs` — since 2026-08-27 the page tests open `dist/warframe-prime-hunter.html` itself. Build it first; they use the file on disk and skip if it is absent |
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

**Afterwards, though — not instead of finishing.** Decided 2026-09-01: **a push
ends the turn.** Do not hold a session open on `gh run watch`, a poll, or a sleep
waiting for Actions or a Pages deploy to go green. The owner is emailed when a run
fails, so a session watching the run duplicates a notification they already have
and spends their time doing it; one Pages deploy ran to 4m52s with the turn held
open for it. The result is read at the **start of the next piece of work** — a
`gh run list --limit 5` before anything else — or when the owner says something
broke.

The distinction that matters: the full local suite runs **before** the push and is
the gate, because it is the thing that can still stop a bad commit. CI runs after
and reports; nothing is waiting on the answer, so nobody should be either. A
single non-blocking `gh run list` in the same breath as the push is fine and often
catches an immediate configuration failure — it is the *waiting* that was the
mistake, not the looking.

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

**`localhost:8777` is a test origin. Cold-start it, and clear up after yourself.**

This paragraph spent two days saying the opposite of itself and then the wrong
thing outright, so both corrections are recorded rather than quietly replaced.
Until 2026-08-25 it said to call `localStorage.clear()` and *"leave it clean when
you finish"*. It was then rewritten to say that origin held **the owner's real
collection — 167 ticked boxes with no backup**, and that nothing there could be
removed. **That is also wrong**, corrected by the owner on 2026-08-27:

> the owner's collection lives on the **GitHub Pages deployment**, which is a
> different origin and out of reach from here. `localhost:8777` had not been
> opened in over a week, and the browser a session drives is not the owner's
> browser at all. Measured the same day: that origin held one key,
> `wfprimes.plan.v1`, and no collection data whatsoever.

So the rule is the ordinary one and always was: **the browser starts cold, the
data there is yours to make, and you clear it when you are done.** Seed what your
check needs, remove it afterwards, and do not leave a half-finished state behind
for the next session to puzzle over.

What survives from the frightened version is one habit worth keeping, for its own
reasons rather than out of fear: **snapshot a key before you overwrite it.** Not
because the value is precious, but because "as I found it" is not a state you can
restore if you never looked — and a session that cannot describe what it changed
cannot report honestly on what it did.

Serving the check on another port is better still, because a different origin
starts empty by construction: `test_pages.mjs` serves on port `0` for exactly this
reason, and `vorframe-plain` on 8781 is the ready-made one for a quick look.

**The deployment is the real one, and the local server is the workshop.** Worth
stating because it inverts the assumption above and nothing else here says it:
what the owner actually uses is the published site. A local check answers *does
this work*; only the deployed build answers *does this work for the person using
it*, which is why `PROJECT.md` and `CLAUDE.md` both say an audit must cover the
built file and the deployed site rather than the two pages on disk.

### Two audits, monthly, postponed rather than skipped

**A full security audit and a full feature-usability audit, once a month each.**
If **no commits** have landed in the month since the last one, that audit is
**postponed to the following month** — not skipped, and not marked done. The
condition is half the rule: auditing an unchanged tree produces a document saying
nothing changed, and a habit of producing those is how the real one stops being
read.

Postponed rather than skipped matters because the two words keep different books.
A skipped audit leaves no trace and the next reader cannot tell a quiet month
from a forgotten one; a postponed one moves its due date forward and stays
visible. So the date below always moves, whether the audit ran or was deferred,
and it always says which.

They are separate passes because they ask different questions and nothing in the
suite asks either.

| | Asks | Ends in |
|---|---|---|
| **Security** | what an attacker, a hostile file or a malicious wiki edit could do — the policy, the server, the parsers, what leaves this machine | `PROJECT.md` for what was examined and **declined**, `TODO.md` for what is outstanding |
| **Feature usability** | whether each feature can be found, understood and finished by someone who did not build it — on both pages, on a phone, and in the single file | the same two places |

**Why monthly, and why both.** The tests answer *"does it still do what it did"*
and cannot answer *"is that the right thing"* or *"can anyone find it"*. Both of
the defect families this project has actually shipped were of the second kind: a
Spy node costed at a third of its length passed every test it had, and the single
file ran both pages' wiring over one document for as long as it had existed while
every suite stayed green. Neither was found by running anything; both were found
by someone going and looking.

**Include the built file and the deployed site, not just the two pages.** That is
the lesson of 2026-08-27 and it is the cheapest part of the rule to skip: four
artefacts — the collection view, the planner, `dist/warframe-prime-hunter.html`
and the published site — and seven defects lived in the third of those for as
long as it had existed, because nothing ever opened it. **A phone-width pass
belongs in the same sweep**; one test covers the sidebar at that width and
nothing covers the rest.

**Record an audit the way the 2026-08-26 security review was recorded.** What was
examined and **declined** goes in `PROJECT.md §7`, so the question is not re-asked
from scratch by the next person who notices the same thing; what is outstanding
gets an entry in `TODO.md`. Then move the date in the table below, so the next one
knows when it is due.

**How to tell one is due.** Each audit keeps a date here. Due is that date plus a
month; whether it *runs* then is `git log --oneline --since=<that date>` being
non-empty. If it is empty, move the date on a month and write *(postponed, no
commits)* beside it.

**The clock starts 2026-08-27**, by the owner's decision, and both are baselined
there together:

| Audit | Baselined | Next due |
|---|---|---|
| Security | 2026-08-27 | **2026-09-27** |
| Feature usability | 2026-08-27 | **2026-09-27** |

Neither baseline is a claim that an audit ran that day. It is a starting line,
chosen so the two run on one cadence instead of drifting a day apart forever. The
nearest things to real data points sit just behind it — **two outside security
reviews, on 2026-08-26 and 2026-08-28**, the first filing ten findings (two
declined and recorded in §7, eight in `TODO.md`) and the second nine against
`16ee027`, all of which are in `TODO.md` under *Security* — and feature
usability has genuinely never been done, which makes 2026-09-27 its first.

**Neither review moves the date above, and that is deliberate.** They are
somebody else's pass over this code, not ours; the monthly audit asks its own
questions, covers the built file and the deployed site, and is the thing this
table tracks. An outside review arriving a month before one is due is a reason
to have less to find, not a reason to skip it.

**What the second review is worth knowing for**, beyond its findings: it
re-filed two items the owner had already examined and declined, because a
decline recorded in §7 is invisible to someone reading the repository from
outside. That is the cost of keeping declined findings out of `TODO.md`, and it
is still the right trade — but it means every review after the first will
re-file them, and the answer is to point at §7 rather than to re-decide.

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
| `5 18 * * *` | probe, full test suite, full fetch, cache **saved** | Resurgence flips at 18:00 UTC; this is the build that fills the cache. **The `FULL` expression matches this string literally — change both together** |
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

**Inside `wiki.yml` the same split runs again**, since 2026-09-01: a `generate`
job at the read-only floor does the fetching and the building, and a `publish`
job that raises `contents: write` takes the pages from an artifact and pushes
them. So the write token exists for one job, and that job runs no build — see
*The wiki's write token exists for one job, and that job runs no build* in §7.

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
| One file to carry around | `tools/bundle.py` → `dist/warframe-prime-hunter.html` (about 2.2 MB, fully inlined) |
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
│   ├── limits.py           ← what a source may cost, and the caps enforcing it
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

`serve.py` checks whether DE has moved on since the build, and appends
`window.WFPRIME_UPSTREAM = {...}` to `data/prime-data.js` as it serves it. The banner
reads that. The page never talks to Digital Extremes.

**It serves first and refreshes behind, since 2026-09-01.** It used to check
*before* handing over the dataset, blocking that request while it ran. The
argument for blocking was about one check and the code did *n* of them — every
request arriving before the first finished started its own — so `freshness()`
never blocks now. It answers with what it knows, starts a single background check
if none is running, and marks the answer `checking`. The page then polls
`upstream.json` until it settles and redraws the banner in place. §7 has the
finding and the reasoning.

It could not be done from the page in any case — measured, not assumed:
`warframe.com` and `cdn.warframestat.us` send no CORS headers, so a cross-origin fetch
fails outright and a `no-cors` one returns an **opaque** response with unreadable
headers. Having every visitor contact the CDN would also undo the point of holding
artwork locally.

Nothing is rebuilt, and it is **throttled to once an hour**, so reloading cannot
hammer DE. This paragraph said *"three HEAD requests, no downloads"* until
2026-08-26 and both halves were wrong: `upstream_signature` makes one HEAD (the
drop table) and two GETs (the export index at ~500 bytes, and the trader window),
and both GETs go through `fetch`, which writes their bodies to `.cache/*.gz` with
`.etag` sidecars. Serving a page therefore writes to the cache the build reads
from — harmless, since it is the same conditional fetch the build would make, but
a comment saying "no downloads" is how nobody notices.

No request waits for any of that any more. Upstream being unreachable is silent
rather than alarming, and on `file://` or GitHub Pages no server runs, so the flag
is simply absent and the build-age banner carries on alone.

**The hour is a ceiling on asking DE, not on being right.** The cached answer is
stamped with the write time of `.cache/state.json` — the file it compares against — and
a rebuild changes that, so the next request re-checks whatever the clock says. Without
that stamp the banner outlived the refresh that cleared it: `refresh-data` finished, the
data on disk was current, and the page went on saying it was behind for the rest of the
hour. Reloading did not help, because the server held the stale answer, not the browser.

**A `304` is a confirmation from the server, not from the world.** Fixed
2026-08-27, and it is the reason the banner had nothing to report while there was
plenty to report. `fetch` treats `304 Not Modified` as the success it is and
returns the cached bytes — **without rewriting the file**, since there is nothing
new to write. So on a feed whose origin has failed behind a CDN that keeps
answering 304, nothing anywhere gets newer: the mtime stops moving, `STALE` stays
empty, and every build says the data is current.

Measured: `.cache/api_fissures.gz` had an mtime of 2026-08-24 and no successful
`200` had arrived in the three days since, while every build in between reported
nothing stale and published an empty fissure list. `PROJECT.md` says elsewhere
that zero fissures is normal rather than a fault, which is precisely what made
three days of failure invisible.

`stale_if_older` gives a source an optional **lifetime** — how long that document
can legitimately go unchanged. The fissure list gets three hours, because a
fissure lasts an hour or two and a list that has not moved in longer is not a
quiet evening, it is a broken feed. Past that the copy is recorded as stale
whatever the server says, and the banner tells the truth without anyone reading a
CI log. Only the fissure list carries a lifetime today; the drop tables and the
catalogue can go unchanged for weeks and a 304 on those means what it says.

**The banner names what is behind in the reader's words, and says how far.**
Rewritten 2026-08-27, after the deployed site spent a morning telling strangers
*"The last update could not reach api_events, api_fissures, api_syndicatemissions,
api_vaulttrader, so an earlier copy is being shown."* Three faults in one
sentence. Those are internal source keys, and no reader outside this repository
knows what they are. They are four names for what is one thing to a reader — the
live worldstate. And the heading, *"Showing older data"*, condemned the whole
build when 167 items, 763 relics and every drop table beside them had been built
minutes earlier and were current.

It now says: **Live data is an older copy. Void Fissures, bounty rotations and
Prime Resurgence could not be refreshed, so those are from a copy made 3 days
ago. The catalogue, relics and drop tables are current.**

Three deliberate parts. The keys map to feed names a player uses, and a key with
no mapping is left un-named rather than guessed at — its presence is also what
withdraws the closing sentence, which is only true while every reused source is
one of the live four. The age comes from a new `meta.staleSince`, the mtime of
the oldest reused copy, because *"an earlier copy"* read the same at ten minutes
and at three days, and three days is the answer that matters. And the raw keys
are still printed — to the owner only, who is the one party a source key helps.

The whole message is `staleNotice` in `shared.js`, a pure function of the meta
and the owner flag, with the DOM left to its caller. Every bug this banner has
ever had was in what it said rather than where it was put, so what it says is a
string a test can hold.

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
| [api.warframestat.us/items](https://api.warframestat.us/items) | Which relics drop each component, vault state, release and vault dates, `tradable` | Convenience layer. The part list, the quantities and the Ducat values left it for DE's own manifests on 2026-08-27 |
| [`api.warframe.com/cdn/worldState.php`](https://api.warframe.com/cdn/worldState.php) | **All four live feeds**, first party, since 2026-08-27: Void Fissures, Prime Resurgence, the bounty boards and limited-time events | `max-age=28`. Raw shapes, so each has an adapter in `official.py`; §7 has what each one had to resolve |
| `/pc/vaultTrader`, `/pc/fissures`, `/pc/syndicateMissions`, `/pc/events` on `api.warframestat.us` | **Fallback only** since 2026-08-27, and unused on a healthy build | Kept rather than deleted: they normalise the same document, and they can name the Proxima nodes DE's export omits. All four were 404 from 2026-08-24 |
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
vaults, +33% per reward, Pago #124 → #83, and the C-only nodes keep their value
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
label rather than DE's. The effort panel asks for minutes per reward per mission
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
| **Where to go** | wanted relics per reward | what a relic turns into once opened |
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
count wanted relics and differ only in what they divide by — per reward (or per
minute once effort weights are given) against per run, cost ignored. They disagree
whenever a long run is worth going on with, and the reordering is not subtle: on a
four-Prime list, Stribog and Tiwaz top the per-objective list at 0.63 and leave the
top five entirely per run, while Ani goes from fourth to first at 2.25.

Three rules the toggle has to keep, all of them `STYLE.md §5`. The number it ranks
on becomes the **big** one and the other drops to the faint line beneath — a sort
that changed the order without moving the numbers would leave every row claiming an
order it is not in. The **heading follows**, which also fixed a older lapse: it read
*ranked on relics per reward* even after minutes were given and the rows had
switched to per minute. And the `+N more` tooltip follows too — it had been
rendering the ranked count through the percentage formatter since the split, so the
hidden rows showed `38%` where the visible ones showed `0.38`.

**The control sits on the heading's own line**, right-aligned, not in the sidebar
where it started. Everything in that sidebar is something the model needs to be
told — how far you run, whether you have a squad, what an objective costs you —
while this one only reorders the list in front of you, and a control belongs within
sight of what it changes. Its options carry the unit rather than a label of their
own (*per reward* becomes *per minute* with the heading), because on that line
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
group not at all. Both showed `NEVER VAULTED` (spelled `P · NEVER VAULTED` until
2026-08-27, when the letters went), tooltipped *"its relics keep
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

### The Steel Path gates a fissure but not a source; Mastery Rank gates nothing

**This was titled *"Neither the Steel Path nor Mastery Rank is an option"* until
2026-09-02**, and the retitling is the finding. Everything below about *sources*
still holds and was re-checked. What it did not cover — because nothing here had
ever separated the two — is that a Steel Path **fissure** is not a source at all,
and that half now has a control. See *A Steel Path fissure is not the ordinary
node's fissure* further down.

Both gate entering a node. Neither gets a control **for the drop tables**, and the
two reasons are not the same, which is worth writing down because the outcome
looks uniform.

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

**That clause was collected on 2026-09-02, by the other half of the question.**
Not by a drop table changing — the Faceoff twins are still identical — but by a
*fissure*, which this entry had never considered because a fissure is not in the
drop tables at all. It comes off the live worldstate as a flag on an ordinary
node, so it pays something the ordinary node does not, and it does so at nodes
that have no Steel Path table anywhere. The checkbox earned its place exactly
where the sentence said it would, in a place the sentence was not looking.

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
**9.6×** across mission types; costing per reward is out by **2.4×**, because a
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
- **The big number follows the ranking.** The headline reads *per reward* by
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

**3. WFCD (warframestat) — convenience layer.** Which relics drop each component,
artwork filenames, the `vaulted` field, and the live worldstate proxy. The part
list, the quantities and the Ducat values were here too until 2026-08-27, when
they moved to DE's own manifests.

**Who WFCD are, because it is easy to get wrong and was, on 2026-08-27.** They
are the *Warframe Community Developers* — a community organisation, not Digital
Extremes, and their own description ends *"Not affiliated with DE."* What they
publish is nonetheless **DE's data**: `warframe-drop-data`'s README says it is
parsed from DE's official drop-data site and links every dataset back to it. So
the numbers are DE's and the parsing and hosting are WFCD's, and reading this
layer as "DE, presented nicely" is right about the data and wrong about the
dependency.

The two halves fail separately, which is what makes the distinction load-bearing
rather than pedantic: the WFCD worldstate proxy went 404 on 2026-08-24 and stayed
down for days while DE's own worldstate was served, complete, throughout. That is
why the table below asks *"first party?"* about the **route** and answers
`resurgence` with *"yes, proxied"* — the fact is DE's, the delivery was not.

Its part naming
disagrees with the drop table (`Chassis` vs `Chassis Blueprint`), so
`normalise_part()` strips the redundant suffix — this matters because saved part
progress is keyed on those names and would otherwise appear to vanish when a
build falls back to the other source.

### What Digital Extremes actually publish — the sweep of 2026-08-27

Done so nobody repeats it, and so the next person looking for a first-party
route knows where the edges are.

**`api.warframe.com` exposes one thing.** `/cdn/worldState.php` answers 200; the
bare host, `/cdn/`, `/dynamic/worldState.php`, and every plausible sibling of the
working path answer 404. There is no index and no directory listing. **That is
where the guessing stopped**, deliberately: probing further paths on somebody's
server is not a sweep, it is a scan, and §2 rules it out.

The worldstate document itself embeds no API surface either — its URLs are news,
forum and social links (`forums.warframe.com`, `www-static.warframe.com`, and so
on), which is worth knowing only because it is the obvious next place to look.

**The enumerable surface is the export index, and it is bigger than we use.** DE
list **sixteen** manifests there. Reading the index is how you find them, which
makes this counting rather than guessing:

| Manifest | Status |
|---|---|
| `ExportWarframes_en.json`, `ExportWeapons_en.json`, `ExportSentinels_en.json` | read — the items themselves |
| `ExportRegions_en.json` | read — node names and enemy levels |
| `ExportManifest.json` | read since 2026-08-27 — artwork |
| `ExportRecipes_en.json` | read since 2026-08-27 — components, `ItemCount`, `primeSellingPrice` (Ducats) |
| `ExportResources_en.json` | read since 2026-08-27 — display names for component items, and materials |
| `ExportRelicArcane_en.json` | **not read** — 3,261 rows, relics with `relicRewards` |
| `ExportKeys_en.json`, `ExportUpgrades_en.json`, `ExportCustoms_en.json`, `ExportDrones_en.json`, `ExportFlavour_en.json`, `ExportFusionBundles_en.json`, `ExportGear_en.json`, `ExportSortieRewards_en.json` | not read, and nothing here needs them |

**Two of the three opportunities this sweep found are taken.** `ExportRecipes`
and `ExportResources` shipped the same day and carry the parts, the quantities
and the Ducat values that used to come from WFCD — see *What a Prime is built
from* above. Seven of the sixteen manifests are read now, against five when the
sweep ran.

`ExportRelicArcane_en.json` is the one left. It is not an obvious win: relic
**contents** already come from DE's drop tables, which is where the odds are, and
this manifest carries the reward lists without them. Worth a look for what it
says about vaulting, not as a replacement for a source that is already first
party.

**What DE do not publish at all**, which is why the other two tiers exist and are
not going away: `vaulted`, `vaultDate`, `releaseDate` and `tradable` appear in no
manifest — they are editorial or derived — and neither do the wiki's categories or
its `(V)` `(P)` `(B)` `(S)` markers. So the intended precedence is *first party for
everything DE actually publish, WFCD for the availability metadata they do not,
and the wiki for what only editors maintain* — not *first party for everything*,
which is not on offer.

### The opening view is now "what is left to go and get"

**Five defaults moved on 2026-08-27**, at the owner's direction, and they all
point the same way. None of them removes anything: every one is a control the
reader already has, and **a saved value wins over all of them**, so only somebody
opening the app for the first time sees the change.

| Control | Was | Now | Why |
|---|---|---|---|
| Planner — *Include Railjack* | off | **on** | It gates whether Proxima is ranked at all, and six Primes have no route that is not Railjack. Off, the planner silently declines to rank the only places they can be farmed |
| Collection — *Founder exclusive* | shown | **hidden** | Three items, unobtainable since 2013 |
| Collection — *Other sources* | shown | **hidden** | Four items, none of them a relic farm — a quest, an event, a vendor |
| Collection — *Show collected* | on | **off** | What you already own is the one thing you cannot make progress on |
| Drawer — *Hide collected* | off | **on** | The drawer is a worklist, and a banked part is not work |

`Show not collected` deliberately stays on, so the page is never empty by
default. The two remain independent — unticking both still shows nothing, which
is the reader's own doing and is left possible.

**Two tests moved with these, and both were the same mistake in different
clothes**: an assertion that depended on a default rather than on the thing it
was testing.

*The default sort* used **Excalibur Prime** as its discriminator — deliberately,
because alphabetically it leads Styanax and by date it comes last, so an
alphabetical comparator cannot pass. Excalibur is Founder-exclusive and is now
hidden, so the test ticks that filter rather than swapping in whichever pair
happens to be visible, which would be choosing the subject with the code under
test.

*Banking a part keeps the focus* is the more interesting one, because the new
default reintroduces the **shape** of a bug this project already fixed: with
*Hide collected* on, banking a part removes it, and the button holding the focus
goes with it. The original guarantee is tested exactly as written, with the
checkbox turned off; and the default's own path is asserted separately —
the part may vanish, but the focus must land on a button **inside the drawer**
rather than falling back to `<body>`. That second assertion is new coverage the
old default never needed.

Both tests click through `evaluate`, because the real `<input>` sits under a
styled `<span>` and Playwright's actionability check waits forever on it. Worth
knowing before writing the next one: `.check()` on these does not fail, it hangs.

#### The tests start cold, and say which box they need

The first answer to the six broken tests was to seed one everything-on state
into `wfprimes.filters.v1` before every page load. It fixed them in one place,
and it was **replaced on 2026-08-27** at the owner's direction, because of what
it fixed them *with*: every test then ran against a screen no reader ever sees,
and a test could depend on *Vaulted* being on without anywhere saying so. The
state a test needs is part of what the test is asserting. It belongs in the test.

What replaced it is two rules and no seed.

**Every page opens on a cold profile.** `open()` makes its own browser context —
empty `localStorage`, nothing carried in — and the test harness closes it the
moment that test ends, pass, fail or throw. The only saved state anywhere is
state a test wrote deliberately, for as long as that test runs. Closing the
context is what clears it, rather than removing keys by name: it takes
everything, including whatever the page wrote that nobody thought about. This
also fixed a quieter leak — contexts were being made and never closed, so a full
run finished holding fifty live profiles.

**A test that depends on a filter says so, on that filter.** `setCheck` reads the
box and moves it only if it is not already where this test needs it, which is an
intention rather than a flip — and that distinction is load-bearing for *Baro
Ki'Teer*, whose default is decided by the calendar rather than by us. A test that
blindly clicked it would pass twelve days a fortnight and fail the other two.

**A test with no preference does not name a subject.** This is the half that was
still latent after the first fix. Half the broken tests had named a Prime for no
reason beyond needing one — `warframe-xaku-prime`, `Nyx Prime`, `Caliban Prime`
— and a name is a claim the test cannot back, with an expiry date attached: DE
vault six Primes a quarter. Those now ask the payload for a Prime with the
property they need, chosen from the cards actually on screen. `pickCard` does it
for the collection, `wishFarmable` for the planner.

The latent case is worth spelling out, because it is the shape that survives a
careless fix. *A card whose relic drops only on Railjack still says where* chose
"the first item with a relic that drops only on Proxima" and asserted on the
**best** spot in its drawer. With *Railjack* on that is Nyx Prime and it holds.
Hide that bucket and the first such item is **Lex Prime**, which has a
Proxima-only relic *and* live routes on Mars and Sedna — so its best spot is an
ordinary node carrying no badge, `.demand` never renders, and `innerText` waits
out a full thirty seconds rather than failing. The subject cannot simply be
narrowed to "every route is Proxima" either: **no Prime qualifies.** Nyx, Valkyr,
Cernos and Venka reach the rest of their relics at Railjack nodes on ordinary
planets — Beacon Shield Ring is on Venus — and telling those from Lex Prime's
Mars means naming the node list `isRailjack` holds, which is picking the subject
with the code under test by the back door.

So the assertion moved to what the subject actually guarantees: the Proxima row
is **offered** somewhere in the list, and it carries the badge. That is the bug
the test was written for — filtering Railjack out left the card with no farm
section at all — and unlike the old form it does not depend on the ranking order.

**Verified by moving the defaults, not by reading the code.** With the
pre-2026-08-27 defaults restored (everything on screen) every test passes; with
*Railjack* and *Resurgence* defaulted off as well, every test passes; and with
`hideVaultedRelics` flipped, **exactly one** fails — *the drawer hides vaulted
relics by default*, whose entire subject is that default. A test about a default
is the one kind that should fail when the default moves.

### Baro's label says when, and his checkbox stays where it is

**Shipped 2026-08-27.** `meta.baro` had carried his window since earlier the same
day, and the filter opened only while he was on a relay — but the label said
nothing about *when*, so a reader who found the box unticked had no way to know
whether he was an hour away or a fortnight. It now reads *Baro Ki'Teer — back in
8 days*, and *here 2 days more* while he is actually there.

**Two decisions worth keeping.**

*The checkbox does not move.* He arrives while a tab is open twice a fortnight,
and flipping the box under a reader who has touched nothing would shift nine
items between buckets with nothing on screen saying why — the same instability
the fissure decision rejects for the ranking. The default is decided once, at
load; after that only the sentence changes. `TODO.md` had this the same way: a
live fact stated where it is read, not a live fact moving things around.

*The arithmetic left `app.js`.* `baroIsHere` did its own window maths, which put
it where no test without a browser could reach it and gave the yes/no and the
sentence two chances to disagree. Both now read `ROT.traderWindow(w, now)`, which
returns `{here, text}` — one answer read twice — and is covered against a frozen
clock in `test_assets.mjs`, boundaries included: inclusive at the start,
exclusive at the end, and a spent or unparseable window yields `{here: false,
text: null}` rather than counting down to a date that has passed.

`awayText` is a separate function rather than a flag on `untilText` because the
two answer different questions. `untilText` is built for a fissure and tops out
in hours, so six days away rendered as *144h 00m* — true, and not how anybody
thinks about next week. `awayText` stays in minutes below an hour, hours below
two days, and days above that.

The label reuses `.check .lbl em`, a rule that had been in `styles.css` with no
user at all. `--txt-faint` `#a4aab3` on the sidebar's `--bg-2` `#11151d`
measures **7.82:1**, above the 7:1 AAA floor for small text — `STYLE.md`'s table
quotes the same token at 7.00:1 against `--panel-2`, which is the worst surface
it meets and the one that governs.

### Digital Extremes, then WFCD, then our own cache — always, in that order

**Shipped 2026-08-28**, at the owner's direction, after the banner on the
deployed site was traced to a 403.

**The failure it fixes was ours, not DE's.** `fetch` answers a failed refresh by
handing back the cached bytes, so a 403 from DE produced a **usable** worldstate —
and every fallback was written as *"if the worldstate gave nothing usable, ask the
proxy"*. A reused copy is something, so the proxy was never asked. The published
site served **69-minute-old fissures** while a fresh copy of the same document sat
one request away, and the build log read *"19 fissures from Digital Extremes"* as
though it were current.

**Why DE refuse at all**, so nobody tries to fix it at the wrong end: they sit
behind **Akamai**, whose edge blocks datacentre and VPN address ranges. GitHub's
runners are Azure datacentre IPs; the same fetch succeeds from the owner's
residential connection, and a request to `forums.warframe.com` from a cloud IP was
refused the same way while this was being researched. It is intermittent because
Akamai apply rules per edge and per address, not because anything about our
request varies. **There is no retry, and no user-agent trick, that helps** — a 403
is a refusal, and `§2` is explicit that every request is somebody else's
bandwidth. `TODO.md` keeps the evidence.

**The rule is unconditional.** Not "for live feeds", not "when the cache is old
enough" — the same three steps for every feed, every build:

1. **Digital Extremes**, from a worldstate that was actually refreshed.
2. **WFCD**, if that errors or comes back empty.
3. **Our cached copy of DE's worldstate**, if the proxy errors or comes back empty.

**Four feeds go through it, and the fourth is a warning.** `vaultTrader`,
`bounties` and `fissures` have since 2026-08-28; `voidTrader` — Baro's manifest —
was added on 2026-09-04, a day after shipping without one and publishing an empty
shelf while he was on the relay. Nothing structural stops a fifth being written
the same way, which is why the rule is stated as **reaching into `worldstate`
directly is the smell**, not as "remember the fallback".

A **reused copy is deliberately not a first-party answer.** `from_chain` is given
the worldstate only when `de_worldstate` is absent from `STALE`; otherwise the
same document is offered as step 3, which is what it is — the last resort wearing
a first-party name.

**One function, not three copies**, because the guarantee is the *order*. Three
call sites can be edited apart and the disagreement would stay invisible until the
day a fallback was needed. `from_chain` returns `(value, "worldstate" | "proxy" |
"cache" | None)` so each feed can say which answered without deciding anything
itself, and a test asserts the order, that nothing further is asked once a step
answers, that an **empty list is a miss** rather than an answer, and that neither
a `SystemExit` nor an ordinary exception from the proxy can abort the build. A
fallback that can raise is not a fallback.

**The fingerprint that decides whether to refresh them had the same bug, and
kept it three days longer.** `from_chain` closed this trap for every live feed on
2026-08-28 and did not touch `upstream_signature`, which builds the `--if-changed`
fingerprint and read DE's worldstate with a bare `fetch_json` — no fallback, no
freshness judgement. Since `fetch` answers a failed refresh with cached bytes, a
403 produced a document that parsed perfectly and whose `PrimeVaultTraders`
`Expiry` **could not have moved**: it was the same file as last time. The
signature matched, `--if-changed` concluded nothing had changed, and the rebuild
that was due did not happen.

**Reported by the owner on 2026-09-04**, from watching it rather than from any
test: a Prime Resurgence rotation turned over and the deployed relic data
followed about twenty minutes later, across refreshes that had run in between.
Measured from the deployed feed log the next morning: of 53 consecutive builds
DE answered **four**, because they 403 the runner's address range — so ~92% of
ten-minute builds were fingerprinting a copy of a copy. **Fissures were
unaffected, and that is the tell**: the light path fetches them live either way,
so only the trader data lagged. A local suite could not have found this; it
needed the deployed site and somebody looking at it.

Fixed the same day. `upstream_signature` now takes the same three steps, judges
staleness on the document's own `Time` as well as on `STALE`, and says so in the
build log on the one path where it still cannot tell — DE and WFCD both refusing,
where it uses the reused copy rather than a value that changes every run, because
a fingerprint that never matches is not a fingerprint.

**One instant, one spelling.** DE publish the expiry as a millisecond
`$numberLong` and WFCD republish it as ISO-8601. The fingerprint is only ever
compared with its own previous value, so two spellings of one instant would read
as a rotation *every time the answering source flipped* — which on CI is
constantly. `_as_millis` normalises both, and a test asserts the two routes
fingerprint identically. This was caught while writing that test, not in
review: the first version of the fix traded a missed rebuild for a spurious one.

`WORLDSTATE_MAX_AGE` moved from `build_data.py` to `sources.py` in the same
change, because both now need it and two copies of a threshold that must agree
is a drift generator this project has been bitten by before.

**The banner reports what reached the payload, not what `fetch` had to try.** If
DE refused and the proxy answered, the live feeds *are* current, and `de_worldstate`
is removed from `STALE` before the payload is written. Leaving it would be a second
wrong claim in the opposite direction — telling readers to distrust data that is
fine. The reused copy is news only when something was actually built from it, which
is what `fell_back_to_cache` tracks.

**Bounties and events come from the same step.** The boards decide which source
answers and the events follow it, so a build cannot mix bounties from one hour
with events from another and present them as one board.

#### Staleness is judged on the content, not only on the transport

The owner's question, and it found the hole: *"a 60-minute stale worldstate from
DE doesn't include the current fissures, so IT IS stale."* Quite so — and the
chain above catches that only when the **request** visibly failed. `fetch` knows a
403 happened; it cannot know that an edge served a stale object behind a `200`,
and DE sit behind Akamai, so that is not a hypothetical shape.

**They stamp it, so it can simply be asked.** Every worldstate carries `Time`, a
unix timestamp of when DE generated it. `official.worldstate_age` reads it, and a
document past `WORLDSTATE_MAX_AGE` is treated as a cached copy however it arrived
— which routes it down the same chain, to the proxy first.

The owner's alternative was to **measure how often the worldstate updates** and
tune the refresh to that. Reading DE's own stamp is strictly better and is the
same principle §2 already applies to `Cache-Control`: *their number, not one we
invent*. It also answers a harder question than frequency would — not "how often
does this change" but "how old is **this** copy", which is the one that matters
when an edge is in the way.

**The threshold is 15 minutes, and it is derived rather than picked.** Measured
2026-08-28: a healthy fetch returned a document **36 seconds** old, against DE's
declared `Cache-Control: max-age=23`; the scheduled refresh runs every ten
minutes. Fifteen leaves room for a slow build, a clock a little out and a refresh
that ran late, while staying far below the hour or two a fissure lasts — which is
what this protects. It is a **detector, not a throttle**: `still_fresh` honours
DE's 23 seconds and is what stops us asking too often; this decides whether what
came back can be believed.

**One thing it corrected immediately.** With the content check in place, an
`--offline` build began reporting *"the proxy answered, the feeds are current"* —
which is false with no network, because the proxy is served from cache too. The
clearing of `de_worldstate` is guarded on `not args.offline` for that reason: the
code written to stop a wrong claim had made one of its own, in the other
direction. `staleSince` is also better for it — an offline build now dates the
copy from **DE's stamp** rather than from our file's mtime.

### A run costs something before and after the part you count

**Shipped 2026-08-27**, on the owner's measurements and their decision of
2026-08-25 about which shape to build.

Effort was collected per objective and the cost of a run was
`minutes-per-objective × objectives` and nothing else — as though walking in and
walking out were free. They are not, and the error is not spread evenly: it is a
**fixed** cost, so it lands almost entirely on the short missions.

The owner's own figures: a mission **start is about 20 seconds** and an **end
about 15**, so **35 seconds a run** whatever the run is. Reproduced by the shipped
model against their measured per-objective times:

| Mission type | min/obj | objectives | costed now | with +35s | cost rises | its rate falls |
|---|---|---|---|---|---|---|
| Capture | 1.5 | 1 run | 1.50 | 2.08 | **+38.9%** | **−28.0%** |
| Exterminate | 2.5 | 1 run | 2.50 | 3.08 | +23.3% | −18.9% |
| Sabotage | 5.5 | 1 run | 5.50 | 6.08 | +10.6% | −9.6% |
| Mobile Defense | 6 | 1 run | 6.00 | 6.58 | +9.7% | −8.9% |
| Defense | 3.5 | 6 rounds | 21.00 | 21.58 | +2.8% | −2.7% |
| Spy | 10 | 3 vaults | 30.00 | 30.58 | +1.9% | −1.9% |
| Survival · Interception · Disruption | 5 | 6 rounds | 30.00 | 30.58 | +1.9% | −1.9% |

Twenty-eight per cent on Capture against two on Survival is the whole of it:
**Capture was winning by a margin part of which was an accounting error.** Checked
end to end on the real page with those timings entered — Ukko, a Capture node,
falls 28.4%.

**Two fields, not one sum.** *Getting in* and *getting out* sit below the
per-type rows, separated by a rule because they answer a different question. They
are two different waits and a player timing themselves can measure them
separately. Both live in `PLAN_OPTIONS`, so a backup carries them; they are as
expensive to lose as the numbers beside them, and a considered **zero** survives
the round trip distinct from never having answered.

**Charged once per run, never per objective.** That is the whole arithmetic —
`per(mode) × objectives + overhead` — and it is the one thing here that could be
silently wrong, since on a single-objective row the two are identical. A test
requires a multi-objective row and asserts the two apart.

**It does nothing until per-type minutes exist, deliberately.** With the panel
empty the list is costed in reward *count*, and 35 seconds has no meaning in
rewards — a reward is anything from a 45-second Defense wave to a five-minute
Survival rotation. So an overhead on its own is stored, says so in the panel's
own note, and waits. The same bargain the rest of the effort model makes.

**`RUN_OVERHEAD` stays as it is, in rounds** — option (1) of the three the owner
was offered, and it is not a starting point. The two are not two units for one
quantity, they are two different quantities. `RUN_OVERHEAD` is **comparative**: it
exists only where each candidate way of playing a node is scored `value /
(rounds + 2)`, and it is discarded the moment a plan wins. Its absolute size
barely matters, only the ratio between two plans at the same node. The start and
end minutes are **absolute** — the real price of one run, charged once to the cost
the ranking divides by. So 35 seconds is not two rounds and was never meant to be.

**The collection view is untouched, and that is asserted.** It ranks per *run* and
has no effort panel, so a number that exists only to divide minutes by cannot
reach it. "Both pages agree" is a rule here, which is exactly why a case where
they legitimately differ is worth pinning: a test sets ten absurd minutes of
overhead and requires every figure in the drawer to be unmoved.

### An objective is the thing that pays a reward, and nothing else

**Settled by the owner 2026-08-27**, and it is the decision the cadence sweep of
2026-08-26 was waiting on rather than a measurement.

**The model's unit did not mean the same thing on any two rows.** The effort
tooltip defined an objective as *"A Defense round, a Spy vault, a bounty stage"* —
the thing that **pays a reward** — and 81 of the 236 live places were costed that
way. But `PER_REWARD` charged Sanctuary Onslaught two zones per reward, which is
the **player-visible sub-unit**, a different question. Both readings were in the
code at once, and *per objective* is a cross-mission ranking: it divides by this
unit to compare a Defense node with an Excavation one, so a unit meaning "3 waves"
on one row and "1 dig" on the next is not a unit at all.

The sweep is what made the inconsistency visible. Read off the wiki's
[`Mission Rewards`](https://wiki.warframe.com/w/Mission_Rewards), six modes pay a
reward for more than one objective — Defense per 3 waves, Survival per 5 minutes,
Void Cascade per 4 Exolizers, Void Flood and Void Armageddon per 3, Defection per
2 — and every one of them was charged 1. Onslaught was the only mode ever charged
its sub-unit. **Onslaught was the outlier, not the model.**

**The decision: one reward draw, on every row.** So the six stay at 1 — they were
never wrong — and `PER_REWARD` is emptied, which brings Onslaught back with them.
Its rate doubles and it moves up: **Elite Sanctuary Onslaught went from #38 to
#14** in a ranking of 116 places over every farmable Prime. That reverses
`d8b4484`, which corrected Onslaught's price under the other reading, and the
reversal is the point rather than a regression.

The word on screen changed with it: *per objective* is now **per reward**, in the
sort control, the heading, the row label and the effort panel. It was called an
objective while it meant two things, which is exactly how a vague word survives.

**What is deliberately not claimed.** A reward is a *consistent* unit, not an
*equal amount of work* — a Defense reward is three waves and an Excavation reward
is one dig, and the sort tooltip now says so outright. The honest measure of work
is the minute, and *per minute* already provides it the moment anyone gives effort
weights. Against one player's own timings, per run is out by up to 9.6× across
mission types and per reward by 2.4×; the 2.4× is exactly the size of this gap,
and it is four times closer than the alternative while asking the player for
nothing.

**The rejected reading, recorded so it is not re-proposed.** Charging the
player-visible sub-unit is more faithful to effort and was declined for two
reasons. Survival has no countable atom at all — its criterion is five *minutes* —
so it would have needed its own answer whatever the other five got. And a wave is
not comparable to a dig, so the cross-mission division would still have been a
guess, only a more elaborate one that looked more precise.

### A relic that pays nothing the one beside it does is counted at a quarter

**Found by the owner from the ranking on 2026-08-27, settled and shipped
2026-09-01.** With four Primes on the farm list and every part of them banked but
one each, *Where to go* put **Apollo (Lua) at 1.57 wanted relics a run** at the
top, above **Taranis (Void) at 1.23** — and Apollo's two relics cover two parts
between them rather than three:

| Relic | Chance, rot B / C | Worth | Pays |
|---|---|---|---|
| `Axi D6` | 14.29% / 12.42% | 0.300 | Cedo Prime Barrel, Dual Zoren Prime Blade |
| `Axi A21` | 14.29% / 12.42% | 0.200 | Cedo Prime Barrel |

`Axi A21`'s wanted set is a **strict subset** of `Axi D6`'s at identical odds. The
node loop accumulated `n.cnt[slot] += chance` once per relic source with nothing
asking whether two relics there paid the same wanted part, so Apollo was credited
twice for one part — and `n.perRun`, built from that sum, is what the ranking
divides by as a stand-in for **progress**.

**What was not wrong, so the fix did not overreach.** The row label says *relics /
run* and 1.57 wanted relics a run is literally true: a run handing you both `D6`
and `A21` has handed you two relics you wanted. Per *draw* the figure was already
right — one reward draw yields one relic, so the two are mutually exclusive within
a run and their chances genuinely add. The double-count is across a **stack**, and
only when the quantity is read as progress.

**Three fixes were proposed and the first two were measured.** *Value the node on
the union of parts its relics can clear* — the most faithful-sounding — **makes it
worse**: counting distinct parts credits `Axi D6` twice, where the relic count
credits it once, so Apollo rises to **2.25 and keeps #1**, and 233 of 234 nodes
move on a full farm list with 49-place swings. It is a different unit rather than
a correction. *Say it on the row and score nothing* leaves the ranking overstating.
So the fix is the second: **discount a relic by what a better relic at the same
node already covers.**

**Discounted, not dropped — the owner's call, 2026-09-01.** `REDUNDANCY_WEIGHT` is
**0.25**: a wholly covered relic keeps a quarter of its count and a quarter of its
worth. Zeroing it asserts more than the model knows. `Axi A21` is exactly the copy
you get on the draws `Axi D6` misses, and it stops being redundant the moment the
covering part is ticked off. The alternatives were measured — at 0.5 Apollo lands
at **#2**, which is not the correction that was asked for; at 0 it falls to **#11**,
which is the claim of worthlessness that was declined; at 0.25 it sits at **#4**
and Taranis takes the top, which is what the owner reported expecting.

**Wholly covered only, and that is the whole difference between a fix and a
re-ranking.** A relic that overlaps in part and pays something of its own keeps its
full count. Measured over the live data: discounting partial overlaps as well moves
**139 of 234 nodes** on a full farm list and takes 11 in or out of the top 20,
while this rule changes **nothing whatever** there — no relic on a full list is
wholly covered — and still moves Apollo off the top of the narrow list it was
wrong about. The defect is near-universal in its *condition* and rare in its
*bite*, which is why it showed on a four-part farm list and hid on a complete one.

**Per rotation letter, not per node**, and conservatively so. A run reaching C has
collected A and B on the way, so a relic in A can in truth cover one in C; letting
it would discount more on an assumption about how far the reader stays. Same
letter is true however the run goes.

**The rule lives in `model.js` as `creditRelics`**, not in the node loop, so it can
be tested without a browser — and it is the third judgement in the model beside
`CACHE_PENALTY` and `RADIANT_BONUS`, written the same way: one named constant to
be argued with rather than a derived quantity. The two previous attempts at the
Radiant bonus both collapsed because they were derived.

**It says so on the row.** `n.overlap` puts an amber `overlap` marker on the meta
line naming the relic and what covers it, the score tooltip repeats it, and *How
this works* carries the rule once. A number that quietly drops by three quarters
with no account of itself is the shape of defect this project keeps having to fix,
and a discount is worth nothing to a reader who cannot see it.

**Two things the `TODO.md` entry had wrong**, both corrected when it shipped.
It said `Axi D6` and `Axi A21` **tie** on openings-per-part-cleared: measured, A21
is **5.0** and D6 is **10.0**, a 2× gap, and that gap is precisely why A21 sorts
*above* D6 in *How to crack them* — which is the half of the owner's observation
that entry could not explain. And it framed the choice as *node ranking, crack
list, or both*: **the redundancy belongs to the node**, not to the relic. `Axi A21`
drops at 65 nodes and `Axi D6` at 64, and A21 is the **sole route of the two at two
Isolation Vault bounties**. It is redundant at Apollo and not redundant in general,
so the node ranking can discount it honestly and the crack list — which is
node-independent — must not.

`PER_REWARD` is kept as an empty table rather than deleted: it is the seam where a
genuine exception would go — a mode that pays a reward for something other than
completing its own objective once — and a test asserts it is empty, so an entry
appearing there without a decision behind it fails.

`FIXED_LENGTH` is untouched and is a different fact: how many objectives a run
*has*, not how many buy one reward. Spy is three vaults paying A, B, C — three
rewards for three objectives, cadence one. Retiring the cadence table must not
empty the length table, and a test says so.

### The test suite puts `data/` back

**Fixed 2026-08-27.** `test_offline_build` runs `python tools/build_data.py
--offline` twice, to check the build is deterministic, with `cwd=ROOT` — so every
full test run rewrote the repository's real `data/`.

Nothing is *lost* by that: `data/` is generated and gitignored. What was lost is
**the truth about freshness, silently.** An offline build reads every source from
the cache without marking anything stale — correctly, because `--offline` asks for
exactly that — so `meta.stale` comes back `[]` and `meta.staleSince` `null`
however the network is really doing. A payload that knew it was behind was
replaced by one that claimed it was fresh, and the staleness banner went quiet.

That cost two wrong readings in a single afternoon: a build stamped `stale: []`
was taken as evidence the API was healthy, and later a rebuilt payload with no
stale markers was read as an outage having ended. It had not — the suite had run
in between. Both were caught only by checking the endpoint by hand, which is the
check the banner exists to save.

It cost a third on the day it was fixed, in a different disguise. A deliberate
one-character mutation was made to `official.py` to prove a new test could fail,
the suite was run, and the mutation reverted — and the suite then failed against a
`data/` that had been rebuilt *from the mutated source* and left behind. The
failure looked exactly like the revert not having worked.

**Snapshot and restore, in a `finally`, with the restore asserted.** The test
copies `data/` and `CHANGELOG.md` aside, runs the real command the real way, and
puts them back whether it passed, failed or threw. Then it checks the tree hashes
match what it found — because a restore that quietly did nothing would leave
precisely the state this exists to prevent, and would look like a pass.

Building into a temp directory was the other option and was declined: `DATA_DIR`
is derived from the tool's own location rather than from the working directory, so
pointing it elsewhere means inventing a flag for the tests' benefit, and this
test's whole value is that it runs the real command the real way.

Same family as the rule about `localhost:8777`: **a test that quietly rewrites
the working state will mislead somebody, and this one already had, three times.**

### What a Prime is built from is Digital Extremes' own answer now

**Shipped 2026-08-27**, and it was the largest remaining WFCD dependency in the
data rather than a nicety. Every part of every Prime — the component list, how
many of each you need, and what Baro pays for a spare — came from
`api.warframestat.us/items`. DE publish all three, in two manifests we had never
read.

| Manifest | Gives |
|---|---|
| `ExportRecipes_en.json` | `ingredients[]` with `ItemType` and **`ItemCount`**, plus **`primeSellingPrice`** |
| `ExportResources_en.json` | the display name of each component, and its own `primeSellingPrice` |

**The second is what makes it tractable.** An ingredient is an internal path —
`AshPrimeHelmetComponent` — and the part a reader knows is *Neuroptics*, which is
a rename rather than a substring. DE publish the rename, so nothing is guessed
and nothing is hand-mapped. `ItemCount` is our `itemCount`, the figure behind
*"53 parts need more than one"*; `primeSellingPrice` is our `ducats`, whose old
comment already called it *"a fixed game constant… so it needs no guessing"* —
truer of DE's own number than of a copy of it.

**Measured across the whole catalogue before it was wired in, and again after.**
That caution is in the entry this came from and it was earned: the artwork change
once reported 166 of 167 on a first pass and the miss turned out to be in the
probe. **583 parts, every name, count and ducat value agreeing with what the item
API had been supplying, and no disagreements at all.** So this changed where the
numbers come from and, on today's data, nothing whatever about what they are —
which is the only way a swap like this can be shown to be safe. The payload still
carries 167 items, 586 parts, 53 needing more than one and 4 that are a whole
Prime.

**What did not move, and why.** Each component's `drops` still comes from the
item API: that is the relic link, which is a different question from what a Prime
is made of, and the loop that attaches per-refinement odds is built on it. The
DE-sourced part list borrows `drops` by name through `normalise_part`, the same
funnel that already reconciles the item API's *Chassis* with the drop table's
*Chassis Blueprint* — a third spelling has to meet the same fate rather than
route around it.

**Six Primes have no DE recipe and only one of them has parts.** Excalibur, Lato
and Skana Prime, Gotva Prime and War Prime have none at all, so nothing is lost.
Kavasa Prime Collar keeps the item API's list, because DE publish nothing about
it in any manifest. That is the documented precedence rather than an exception to
it: first party for what DE publish, WFCD for the availability metadata they do
not — `vaulted`, `vaultDate`, `releaseDate`, `tradable` are editorial or derived
and stay where they are — and the wiki for categories and its own markers.

**The fallback is silent, so a test is not optional.** If `partSpecs` ever
arrives empty — the export index unreadable, a manifest renamed — the parts fall
back to the item API, which is the right behaviour and completely invisible while
the two agree. `test_parts_are_digital_extremes_own_numbers` walks all 167 and
names any disagreement, asserts that over 500 parts came from a DE recipe, and
pins the fallback list to exactly `["Kavasa Prime Collar"]` so a second name
appearing there means the join has started missing.

### Baro's shelf is published too, and only while he is standing on it

**Read 2026-09-04, built the same day, inside the two-day window that made it
possible.** Two `TODO.md` entries had been waiting on this since 2026-08-14 and
2026-09-01, both blocked on one unknown: `VoidTraders[0].Manifest` is `[]`
between visits — measured at 0 rows on 2026-08-27 — so nobody knew whether it
named his stock, or in what shape, until he arrived.

It does. Measured 13:24Z, 24 minutes into the visit: **41 rows**, an entry being
`ItemType` plus `PrimePrice` (Ducats) and `RegularPrice` (credits), with `Limit`
optional and present on exactly one row. **Exactly one of the 41 is a relic** —
`T4VoidProjectionBaroAkmagnusPrimeBronze`, 125 Ducats — and the other forty are
mods, skins, decorations and a treasure box this catalogue does not model. So
the honest answer to *what is he really selling* is one relic on this visit,
against the nine items the wiki marker `flags.baro` puts behind "he sometimes
sells this Prime". One visit is one sample; whether one relic is his habit is
not yet known.

**The join needs no new source, which was the surprise.** The first route found
was DE's `ExportRelicArcane_en.json`, and it works — it names the row `Axi M5
Relic` with a reward table matching ours. It is also 3.2 MB to learn something
already on disk. Two facts make it unnecessary:

- **A vendor can only sell StoreItems.** Every `ItemType` is a
  `/Lotus/StoreItems/...` path and reaches the real type path by dropping that
  one segment. Found by hand here for a single row; both `browse.wf` and
  `warframe-public-export-plus` state it as the general rule, with bundles as
  the documented exception. Read as a technique — no code and no data taken.
- **The item database already names the result.** The same rows
  `build_varzia_relics` walks carry `"Axi M5 Intact"` for that path, and the
  other three refinements beside it.

So `build_baro_relics` is the cheaper sibling of `build_varzia_relics`: hers has
to be *inferred* from a naming convention because DE do not publish it; his is
published, and only needs the `/StoreItems` hop.

**"No fetch was added" was the claim here for one day, and it was the bug.** The
first version read `VoidTraders` out of the `worldstate` variable directly, so
Baro's manifest was the only live feed with no `from_chain` behind it: Digital
Extremes or nothing. DE 403 the runner's address range, so the deployed build
fell back to a **cached worldstate written before he arrived**, found
`Manifest: []`, and published no Baro errand at all while he was standing on the
relay. It worked perfectly on the owner's machine, because DE answer from there —
which is the shape that reaches production unnoticed, and did.

Reported by the owner within hours, from the deployed site: the collection view
showed its `BARO` badges (that is `flags.baro`, the wiki marker, and unrelated)
while *How to crack them* offered only `Varzia` and `Trade`. The payload
confirmed it — `relics["Axi M5"].baro` was `false` and `meta.feeds` showed all
three feeds served by the proxy, meaning DE had not answered that build.

**Fixed the same day by giving it the chain like everything else.** A fourth
entry, `voidTrader`, now sits beside `vaultTrader`, `bounties` and `fissures`;
`official.void_trader_from_proxy` reads WFCD's `/pc/voidTrader` into the shape
`void_trader_from_worldstate` already returns, and the join takes a **manifest**
rather than a worldstate so it cannot know or care which source answered.
Verified against live data on the route CI actually takes: the proxy returns the
same 41 rows and resolves to the same `Axi M5`.

Two details worth keeping. The manifest is dropped before `meta.baro` is
written — the payload has no use for forty rows of mods and ship decorations,
and DE's data is not ours to republish. And the chain sits with the other three
feeds rather than beside the relic join that consumes it, because
`fell_back_to_cache` is read a few lines below and an assignment after that
point would have been silently too late.

**The general lesson, which is the reason this is written down at length:** this
was the *third* instance of the same trap in one project, and the second found
in a single day — `from_chain` closed it for the feeds on 2026-08-28,
`upstream_signature` still had it until 2026-09-04, and this shipped with it on
the same morning that one was fixed. The rule is not "remember the fallback", it
is structural: **a feed that does not come through `from_chain` has no fallback**,
and reaching into `worldstate` directly is the smell.

**The decision that shaped it, owner's, 2026-09-04:** *we keep the relic as long
as Baro is here, and then we forget he had it — just like all the other relic.*
That makes his shelf a **live feed rather than a catalogue fact**, and it
dissolves the problem the backlog had been circling. The open question had been
what a crack-list row should say during the twelve days a fortnight he is away —
the same wrong-`true` the availability filter refuses. The answer is that there
is no row: `relics[n].baro` says what the manifest held when the build ran, and
`isBaro` in `plan.js` requires `ROT.traderWindow` to agree against the **page's**
clock. Both, always. A tab open across his departure loses the badge, the errand
control and the row on its own, with no rebuild in between — the same mechanism
the collection view's Baro filter already used, reused rather than reinvented.

**Three smaller calls.** The errand control is **absent** while he is away
rather than showing zero, because `STYLE.md §6` only offers a control for
something in front of you, and a box that is dead twelve days in fourteen is
worse than none. The badge is `--blue`, which is what `.badge.baro` already uses
on the collection view — one fact wearing one colour on both pages; teal was the
first choice and was wrong, because `STYLE.md §1` gives teal to the Exceptional
row background these badges sit on. And the sort ranks him **with** Varzia
rather than between her and trade: both are "go and buy it with something you
farmed", and the badge already says which shop.

**What the page test does not do is wait for him.** It stages both halves by
replacing `meta.baro` before load, so the assertion is about the gate and never
about the date the suite runs on — a test written against the real calendar
would have passed that week, failed on the 6th and passed again around the 18th.
It also caught a real defect during development: the errand filter was applied
to the counts and not to `paintRelicList`, so unticking his box moved the number
and left the row.

### Varzia's shelf is published, but not where anyone looks for it

**Found by the owner 2026-08-27, from the in-game store, and fixed the same
day.** Varzia's *Relics* tab during the Revenant & Baruuk rotation held **six**:
Lith T13, Lith A9, Meso R6, Neo P8, Axi C9, Axi B9. The planner offered **88**,
every one badged *from Varzia*. All six were among the 88, so it was a superset
rather than a wrong answer — but a superset presented as a shelf, which sends
the reader to Maroo's Bazaar for a relic that is not there.

**Where the 88 came from.** `build_resurgence_set` reads `vaultTrader.inventory`
to learn which *Primes* she is offering — Baruuk, Revenant, Phantasma, Afuris,
Tatsu. That half was always right, and is the documented reason we read her
inventory at all (§2, real money). The relic flag was then derived from it: a
relic counted as hers if **any** of its rewards was a part of an offered Prime,
which sweeps in every historical relic those parts ever appeared in.

**The obvious source does not have it, and that is why this took two attempts.**
Measured against the cached feeds:

| Where we looked | What is there |
|---|---|
| `vaultTrader.inventory` (WFCD's proxy) | 22 rows — packs, Primes, cosmetics. **No relic row** |
| DE `PrimeVaultTraders[0].Manifest` | the same 22, priced in Regal Aya |
| DE `EvergreenManifest` | 82 rows of Twitch cosmetics and four Primes — real money, correctly excluded already |
| `vaultTrader.schedule` | 54 past and future **pack** rotations |
| the drop tables | nothing; her shelf is a shop, not a drop |

Nor can it be inferred from the drop tables. Two heuristics were measured
against the known six and both failed: *fraction of rewards from offered Primes*
puts Meso R6 (stocked) at 2 of 6 and Lith P8 (not stocked) at 3 of 6; *only
offered Primes plus Forma* matches **zero** of the 88, the six included. `Lith
T13` and `Lith P8` are the same shape reward for reward.

**It is published in the item database, as a naming convention.** A relic minted
for a Prime Vault rotation carries the rotation in its `uniqueName`:

```
/Lotus/Types/Game/Projections/T1VoidProjectionRevenantBaruukVaultASilver
                                ^^^^^^^^^^^^^^
```

and DE build the pack names from the same word —
`MPVRevenantBaruukPrimeDualPack`. So the shelf is *the relics whose rotation tag
appears in the packs she is currently selling*. The item database knows 28 such
tags, 8 to 28 rows each across four refinements; the live one resolves to 24
rows, which is six relics.

Verified against the owner's screenshot: **six, and exactly the six.** No misses,
no extras.

Three things make this the right shape rather than a lucky string match:

- **It needs no new request.** The item database is already fetched, for names,
  images and vault state. Rule 11 is untouched.
- **It is deterministic and first party** — a DE identifier, parsed, no prose and
  no model. Rule 4 holds.
- **The longest tag wins.** `EmberRhino` is a substring of `EmberRhinos` and both
  are real rotations, so a past one could otherwise ride in on a current one's
  pack name.

**An empty shelf is said out loud, not filled in.** If no tag matches — DE rename
the convention, or the item database goes stale — the build logs that Prime
Resurgence relics will not be offered, and the planner answers those Primes as
trade-only, which is the true statement. Falling back to the per-Prime guess
would restore the 88 silently, and a silent wrong claim is the thing this fixed.

The test asserts the **size**: a rotation is a handful, so more than a dozen
relics marked means the shelf has stopped being read.

**And a relic you have to go and buy sorts below every relic you can farm.**
Owner's call the same day. *How to crack them* ranks on openings per part
cleared, which is the right question inside a group and the wrong one across
them: a Varzia relic with a good ratio sat above relics the reader could go and
get that evening — measured, one of them at the very top of the list — and that
reads as advice to go shopping.

They are not the same errand. A dropping relic costs a mission you were going to
run anyway; a Resurgence one costs Aya and a trip to Maroo's; a trade-only one
costs finding another player. So the list groups **farmable → Varzia →
trade-only**, and the ratio orders within each group exactly as before. Nothing
is lost and nothing is re-scored — the two kinds simply stop interleaving, which
a single ranked list had been quietly claiming was meaningful.

Same shape as *Two lists, two questions, never one score*, one level down.

### Obtainable is not owned, and a Prime with no way in still has an answer

**Shipped 2026-08-27**, immediately after the Resurgence fix and generalising it
at the owner's direction.

*How to crack them* filtered on whether a relic can be **obtained**, which
quietly assumed the reader holds none. Target a Prime that is fully vaulted with
no other route — Ash Prime, 21 relics, no Baro, no quest — and the planner
answered with a blank page. But *"which relics do I need to trade for, and what
do I refine them to"* is a real question with a real answer, and the refinement
is the part worth showing: it is the one thing still to decide, and it is the
same advice the row would carry if the relic were dropping.

**The rule is per Prime, not per relic**, which is what makes it safe. A relic is
let through only when the *item* wanting it has no way in at all: no relic of
its still drops, none is in Resurgence, and it carries no `baro`, `special`,
`founder` or `permanent` route either. `wantedIndex` works that out per wishlist
entry and hands `buildPlan` a set of `stranded` relic names. A vaulted relic on a
Prime you *can* farm another way stays hidden, because there the filter is right.

**No switch, deliberately.** The condition is *"this Prime has no other route"*,
which the page can determine; a checkbox would ask the reader to tell it
something it already knows. The owner made this call and it is the right one —
the collection view's *Hide vaulted* exists because there the reader is browsing
and genuinely has a preference, while here the answer follows from the data.

Rows say **trade for it** in `--txt-dim` rather than the violet **from Varzia**
wears: the two markers answer the same question and only one of them is good
news, so they must not read as equals. And the empty *Where to go* says which of
the two situations it is, instead of falling through to *"these relics drop, but
nowhere you can reach"* — which is the one thing that is never true of either.

**The collection drawer's *Hide vaulted* now defaults on**, same day and same
reasoning from the other side: the drawer's question is *where do I farm this
part*, and a vaulted relic cannot be farmed, so listing them first buries the few
you can actually go and get. It was only safe to default on because the empty
case already answered itself — *"Every relic for this part is vaulted — untick
Hide vaulted to see which ones to trade for"* — and a test now holds that,
because a silently empty part is the failure this default could have introduced.
A saved choice still wins; only the default moved.

### A Resurgence relic is vaulted, and that emptied the crack list

**Fixed 2026-08-27.** *How to crack them* filtered on `rec.vaulted`, under the
comment *"only relics that actually drop somewhere right now"*. A Prime
Resurgence relic is **vaulted by definition** — that is what being in Resurgence
means: it is out of the normal rotation and Varzia sells it for Aya instead. All
88 of them carry `sourceCount: 0`.

So putting a Resurgence Prime on the farm list produced a planner with nothing
whatever to say — no places to run, which is correct, and no relics to crack,
which is not. It was silent about exactly the five Primes the collection view was
busy badging as available.

**The two lists split on precisely this question, and the split was right all
along.** *Where to go* ranks wanted relics per reward and needs no change to
ignore these: it walks each relic's `sources`, and these have none. *How to crack
them* ranks openings to finish a relic and knows nothing about where the relic
came from — so one bought with farmed Aya belongs in it on the same terms as one
that dropped. The filter was asking the left-hand list's question in the
right-hand list.

**Two pieces of wording carry the change**, because a crack list that appears
from nowhere is its own confusion. Each row says **from Varzia** — violet, the
colour the collection badge already uses for Resurgence — with a tooltip saying
the relic does not drop and Aya is farmed. And the empty *Where to go* heading
now says why, instead of falling through to *"these relics drop, but nowhere you
can reach"*, which names a problem the reader does not have and hides the answer
sitting in the list beside it.

**Obtainable is not the same as owned**, and this fix only got away with
conflating them because Resurgence relics are both. The general case — a player
holding vaulted relics the planner refuses to rank — is open in `TODO.md`.

### Bounties and events came off the proxy too, and `meta.stale` went empty

**Shipped 2026-08-27**, finishing the move. All four live feeds — fissures,
Prime Resurgence, bounty boards and events — now come from
`api.warframe.com/cdn/worldState.php`, and `meta.stale` is `[]` for the first
time since the WFCD proxy started 404-ing on 2026-08-24.

**Two traps in these two, each of which produces a confident wrong answer.**

*DE publish two windows at once* — the one running and the one after it — as
separate rows per syndicate. Merging them averages two different rotation letters
into nonsense. They are passed through as they arrive and `_one_window` picks,
which is what that function was always for. It also gave a free validation: the
two windows predicted `standard A → B` and `vault B → C`, and when the board
turned over the build read exactly `B` and `C`.

*`Goals`, not `Events`.* DE's `Events` is the news feed — Discord invites,
patch-note links, image URLs, 34 rows of it. The in-game events this project
wants, the Ghoul Purge and Plague Star among them, are `Goals`. Reading the field
whose name matches would have returned an empty list and looked perfectly fine.

**What the cross-check became, at the owner's direction.** The vote needs
`rewardPool` — reward *names* — and DE publish a table *path* instead. Resolving
the path back into a pool would be circular: the pool would be derived from the
letter it is meant to check. So on first-party data the vote cannot run, and what
replaces it is agreement among the jobs in one window. A renamed table or a
changed sequence moves most jobs at once and fails a majority; one odd job does
not, and there is one. Majority rather than unanimity for exactly that reason.

**Also passed through untouched: `jobType`.** Isolation Vault bounties arrive
with none at all, which is DE's own signal and a cleaner one than the
level-matching that splits the vault family today. Carried in the payload, acted
on by nothing — changing how the family is decided is its own change and wants
its own evidence.

**A test broke for the right reason and was fixed the right way.** *"A fissure
changes how far the row says to run"* picked the first endless row in the ranking
and asserted it said six rounds. That silently assumed the shipped fissure list
was empty — true for the three days the feed was down, false the moment it came
back, because the top-ranked endless node then carried a fissure and correctly
said five. The model was verified unchanged first (six without, five with) and
the *subject selection* was fixed, not the assertion: the test now picks an
endless row that has no fissure on it, which is a raw-data property rather than
whatever the ranking put first. `PROJECT.md §2` has the rule it was breaking.

### The rotation letter is read, then cross-checked, and says so if the two differ

**Decided by the owner and shipped 2026-08-27.** This project had said for months
that the bounty rotation letter *"is not published anywhere"* and derived it by
matching the rewards on offer against DE's own tables, one vote per job. DE do
publish it: every bounty job carries a reward-table path, and the letter is in it.

```
/Lotus/Types/Game/MissionDecks/EidolonJobMissionRewards/TierATableCRewards
                                                            ^^^^^^
```

**`Tier` is the level bracket and `Table` is the rotation.** Reading the first is
the obvious slip and a test asserts against it.

So the label is now the primary reading and the vote is the cross-check. Two
independent methods, and they agreed on the day this landed — `standard: C` from
16 of 17 labelled jobs, with the vote also saying `C`; `vault: A`, 8 of 8, vote
`A`. Two methods agreeing is worth more than either alone.

**The gate is the part that matters, and it was nearly missed.** A tier that
publishes only table A says `TableA` every hour of every day, because that is its
only table — read as a rotation letter it is a confident answer to a question
nobody asked. *Level 100-100* and *Level 40-60 Cambion Drift* are exactly that,
and in the first working version they were **five of twenty-one jobs**: enough to
swing a family had the rest been closer. The label is therefore believed only
from a tier publishing all three letters, which is the same gate the vote had
applied all along and for the same reason. The first draft applied it to the vote
and not the label, produced a plausible answer, and was wrong.

**And the day they disagree, the page says so.** `meta.bounties.families[…]`
carries `from` and `crossCheck`, and `staleNotice` raises the existing databar —
`bad`, above staleness, because late data is a nuisance while a ranking built on
the wrong rotation is simply wrong. Averaging the two would leave a countdown
labelled with a letter nobody can vouch for. It reuses the banner rather than
inventing a second one, at the owner's direction: new text, no new machinery.

**Independent of where the feed comes from.** The letter is read off the
reward-table path, which is the same string whether DE or the WFCD proxy supplied
the document — so this works today, on the proxy, and will keep working when the
bounty adapter lands.

### Prime Resurgence comes from Digital Extremes now

**Shipped 2026-08-27**, the same day as the fissures and by the same pattern.
`PrimeVaultTraders[0].Manifest` is Varzia's rotating stock, and DE's `ItemType`
is the very path the proxy was republishing — so `build_resurgence_set`, which
matches on `uniqueName` with a substring test, needed no change at all.

**Checked by running both routes through the same function on the same day.**
The cached WFCD copy and DE's raw document produced **the same five Primes**.
That is the A/B this project had been unable to do since the proxy went down, and
the cached response turned out to be the missing reference all along.

**`Manifest` only, never `EvergreenManifest`** — and the reason is scope rather
than noise. Counted on 2026-08-27, those 82 contain **no relics whatsoever**: 42
mods and skins, 27 miscellaneous store items, 8 accessory packs, 4 Prime weapons
sold outright, 1 character. Every one is bought rather than farmed, which
*"Real money is out of scope, always"* puts outside this tool entirely. The
first version of this paragraph argued they would make the badge noisy, which was
true and beside the point.

**`character` and `location` are absent from DE's document and are not invented.**
Their `Node` is `TradeHUB1`, which the region export does not name. Nothing needs
them: the drawer writes *Varzia* itself and already defaults the place to Maroo's
Bazaar, so the adapter returns the window and the stock and stays quiet about the
rest.

**`upstream_signature` moved with it**, which matters more than it looks.
`--if-changed` runs every ten minutes and its Resurgence fingerprint asked the
WFCD proxy — so for three days every freshness check spent three attempts and two
sleeps failing against a 404, a probe costing more than the rebuild it exists to
avoid. It now reads the same first-party document the build does.

### Fissures come from Digital Extremes now

**Shipped 2026-08-27**, the day the WFCD proxy's fissure endpoint had been
404-ing for three days and the deployed planner had been showing none.

`api.warframe.com/cdn/worldState.php` is DE's own worldstate. Fissures live in it
twice over, as two different kinds of mission rather than a flag on one:
`ActiveMissions` is the star chart, `VoidStorms` is Railjack with its tier under
a different key. `official.fissures_from_worldstate` turns both into **exactly
the shape the WFCD proxy produced** — `node`, `tier`, `expiry`, `isHard`,
`isStorm` — and that is the design decision worth keeping: the two are
interchangeable, so either can be the fallback for the other, and `build_fissures`
downstream never learns which answered.

Nothing is copied from WFCD. The node mapping comes from DE's own
`ExportRegions_en.json` — `SolNode196` → `"Charybdis (Sedna)"` — and the format
is WFCD's because *matching* it is the point: the payload and both pages already
speak it, and a second spelling would be a second thing to keep in step. The tier
table is the six the game itself shows.

**Railjack storms cannot be named, and are dropped rather than guessed.** DE ship
no `CrewBattleNode*` row in the region export — 0 of 269 — which is the same gap
that leaves Railjack enemy levels unknown. Twelve of thirty-one fissures were
storms on the day this landed. They come out of the adapter with `node: None`,
the build says how many went, and they are dropped; putting `CrewBattleNode522`
on a card would be worse, and inventing a name worse still. The proxy can name
them, so this is the fallback tier earning its place rather than a defect.

**`max-age=28`.** DE built this endpoint to be polled, so a ten-minute build is
comfortably inside what they ask for — see *"Ask no more often than the source
says to"*.

One thing this cost, worth recording because it is the failure mode of writing a
parser against a live source: the first draft of the test asserted an expiry four
hours out, and the parser was right. Epoch arithmetic is not eyeballable. It was
checked three ways before the test was changed to match — which is the only safe
direction to resolve that disagreement, and the opposite of what is tempting.

### Artwork is first party, and that retired two hosts

**Shipped 2026-08-27**, and it is the first piece of the *first party first, WFCD
if it fails* rule to actually land.

Item pictures used to come from `cdn.warframestat.us/img/<imageName>`. That host
is a **redirector rather than an origin**: it answers 301 to
`raw.githubusercontent.com/wfcd/warframe-items/…`, so a reader's browser talked to
two third parties per card and the content policy had to name both, because CSP is
enforced against every hop.

Digital Extremes publish the artwork themselves, and the key was already in hand.
DE's export index lists sixteen manifests; we read four at the time, and seven
now. A fifth,
**`ExportManifest.json`**, is the texture manifest — 19,843 rows of `uniqueName`
and `textureLocation` — and the picture is `content.warframe.com/PublicExport` plus
that path:

```
/Lotus/Interface/Icons/StoreIcons/Primes/AshPrime.png!00_jy1ev7ijK8d8nQ3WuE7NYQ
```

**The `!00_…` suffix is part of the path**; strip it and the same URL is a 404. It
is a content hash, which is why these answer `max-age` of about a year — the URL
changes when the picture does, so it never needs revalidating. Under *"Ask no more
often than the source says to"* that makes artwork the politest fetch here, and it
is the fetch that happens 167 times per page load.

**Coverage was the gating question and it is total**: 167 of 167, measured with the
build's own name matching rather than a cruder one — a first pass using plain name
equality reported 166 and the miss was the probe, not the data. The join needs no
heuristics because `uniqueName` is already one of the fields `ITEMS_API` is asked
for by name.

**WFCD stays as the fallback rather than being deleted.** `image_for` prefers DE
and falls back to the CDN when the manifest has no row, which is the shape the rule
asks for and costs nothing while unused. Two consequences worth knowing:

- The **static meta CSP still names all three hosts**, because that tag cannot know
  which path a build took, and naming only DE would silently blank every image on a
  fallback build. `serve.py`'s header is content-derived and does better — it names
  only what the payload actually references. Dropping the two WFCD hosts from the
  meta is a one-line change once the first-party path has proved itself.
- `local_name` in `artwork.py` now accepts both shapes and reduces them to the same
  basename, so `--with-images` reuses an existing `assets/img/` folder instead of
  re-downloading 8.3 MB. Its three safety gates matter more than they did: a CDN URL
  ended in a bare filename, while a DE one is a path full of separators plus a hash
  suffix, and that string is used to open a file for writing.

**One latent bug fell out of this.** Adding a fifth manifest made `--offline`
fatal on the first run after the list grew, and the reason was older than the
change: the loop that reads manifests wraps each in `except Exception` and means
to degrade, but `fetch` raises `SystemExit`, which derives from `BaseException`
and sails straight through. Four warm caches had hidden it since the loop was
written. The manifests are now fetched `critical=False`, and the texture manifest
alone is `optional` — a card with no picture falls back to a glyph that already
exists, while a missing node list is wrong data rather than a missing nicety.

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
| artwork | DE's `ExportManifest.json` → `content.warframe.com`, WFCD CDN as fallback | **yes** since 2026-08-27 |

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

### A restore reproduces the file, and counts what the file disagrees with itself about

**Third divergence between the two pages over one backup, settled 2026-08-27.**
The collection view ended its import with `ITEMS.forEach((it) => ST.syncCollected(it))`,
retracting any tick the file's own parts did not account for; the planner wrote
what the file said. So the same backup restored two different collections
depending on which page you were looking at — the failure `parseBackup` was
unified to end, one level up from where it was unified.

**The reasoning behind that loop was wrong about its own cause**, which is why
this went the way it did rather than the other way. Its comment justified the
retraction as dropping *"a claim the parts in the same file contradict"*, the
implied cause being someone ticking a Prime they had not finished. That is not
reachable: the tick sets the parts to match, and every part click on either page
runs `syncCollected`. What *is* reachable was measured — tick a Prime, then let a
rebuild rename or add one of its parts, and the store that was consistent when it
was written now contradicts itself, with no import and no hand-editing anywhere
in it. The next backup written says both things.

That makes the retraction a bad trade. Nothing about a renamed part is the
reader's mistake, and silently dropping their tick for it is the app putting words
in their mouth — in the direction `syncCollected`'s own comment says it stopped
doing. **So neither page corrects it now. `parseBackup` counts it, and both pages
say so:** *"1 Prime is ticked but its parts are incomplete — a rebuild may have
renamed or added one."* The reader is told, their data is untouched, and the fix
is one click on the part in question.

The sentence is `unfinishedNote` in `model.js`, named once and used by both, under
the same rule as the run-cost wording — two copies of a sentence are two
sentences, and this whole entry is about two copies of a rule. The count is
computed *below* the legacy fill: an old bare-array backup has its parts derived
from its ticks, so it cannot contradict itself, and counted above that every
legacy file would report every Prime in it.

Reconciliation stays exactly where the reader is acting: a part click on either
page still retracts a tick it makes impossible. What changed is that a restore is
no longer treated as the reader making a claim.

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
routes were checked on 2026-08-26: `wiki.warframe.com` 403s us (§8 — the reason is
not established), and the item CDN that supplies every other image in this app has no
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

### The single file is both pages in one document, and that had a cost

**Found and fixed 2026-08-27.** `dist/warframe-prime-hunter.html` is the artefact
strangers download, and it was the only one nothing drove in a browser: the page
tests served `index.html` and `plan.html`, and `test_build.py` read the built
file as text. `bundle.py` keeps the collection's header and then concatenates
**both** page bodies, running `app.js` and `plan.js` back to back over the one
document — so every id below the header existed twice, `getElementById` handed
the collection's copy to every caller, and the five shared wiring functions each
ran twice. Seven defects were living in that gap. None was reachable on either
page alone, which is exactly why none had been seen.

Measured in Chromium, on `http://` and `file://`, with both ordinary pages as
controls:

| A person does this | Either page | The single file, before |
|---|---|---|
| Presses **+** on Mastery Rank, from 10 | 11 | **12** — and **−** went back two |
| Presses **Download backup** once | one file | **two identical files** |
| Presses **Paste & restore** once | that page's import | **both**, planner last, undoing the collection's reconciliation |
| Opens the **Planner** tab | footer with the licence | **empty footer** |
| Presses **Backup** on the Planner tab | the dialog | a modal at **0×0** — invisible, and the page inert behind it |
| Loads a build over 14 days old | one stale banner | **two** |
| Leaves it open | one `fissures.json` poll | **two**, forever |

Mastery Rank was the worst, because MR is not decoration: it derives the Void
Trace cap, so a stepper moving two ranks a press fed a wrong cap into the
planner's own numbers. The invisible modal was the most alarming — pressing a
button appeared to freeze the app.

**Two halves to the fix, and they answer different questions.**

*The markup.* `cut_shared` in `bundle.py` lifts the backup dialog and the site
footer out of both bodies and emits one of each **below** both views. That is
what makes one copy enough: a modal inside a `display:none` ancestor is promoted
to the top layer and still renders nothing. The footer is taken from the
collection because the two are identical and empty — `shared.js` writes them —
and the dialog from the planner, because only its wording is true of the merged
app: the collection's says *"Backup / restore collection"*, and the file that
button writes has always carried the farm list and the planner's options too.
The handlers on it are the collection's, since `app.js` runs first and claims
it, and that is consistent rather than a mismatch — `backupPayload` writes every
slice whichever page asks. `cut_shared` raises rather than warning if either
block is missing or doubled, for the reason the CSP rewrite beside it already
gives: leaving two copies in is not a crash and not visible on the tab you land
on.

*The wiring.* Four of the five shared functions are now idempotent through one
`once` flag in `shared.js`. The fifth, `watchFissures`, is the one that shows
why "make it run once" was not the whole answer: `app.js` calls it first and
passes **no** callback, so a blunt guard would have kept the poller and dropped
the planner's repaint, and a fissure opening while the standalone was open would
never have reached the ranked list. It keeps a subscriber list instead — one
poller, every caller's callback — and a Node test asserts exactly that, because
the failure is silent and only reachable in `dist/`. `siteFooter` is deliberately
*not* guarded: it now fills every `#siteFoot` it finds, so the bundler and the
page would both have to regress to put a blank licence on screen again.

**`#advanced` became a class.** It was the last id both pages carried, and the
only one that never showed a symptom — an id selector styles every duplicate
happily. It was still invalid markup, and leaving it would have meant a
duplicate-id test with a named exception, which is the kind of thing that rots.

**A restore now reloads on both pages.** The planner has always ended an import
with `location.reload()`; the collection re-rendered in place and told the reader
*"Filters restored — reload to see them."* — an admission that it could not
finish the job. In the merged document it could not finish a second one either:
the planner view beside it was still holding the rows and options it read at
load. A restore replaces every slice at once, so the page that reads them all is
the right thing to rebuild, and that sentence is gone.

**What the gap really was.** Not any of the seven. It was that nothing drove the
built file, so `bundle.py`'s own docstring could claim the two pages "share
exactly one element id — the tab itself" and be wrong by ten for as long as the
single file had existed. `test_pages.mjs` now opens `dist/` and presses the
buttons; `test_build.py` asserts the built markup has no duplicated id and that
both pieces of shared chrome sit outside both views. Each was confirmed by
mutation — the guards removed, the chrome put back inside a view, the id
restored — and each went red before it went green.

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
without validation.

**That pointer rotted, and was repaired on 2026-09-01.** It said "That one is in
`TODO.md`" while no such entry was in `TODO.md`, and checking the code found the
gap had been half closed: `sort` lives inside `plan` and is filtered against
`PLAN_OPTIONS`, while `filters` was still taken whole on a bare `typeof` check.
Worth noting how it nearly went missing — the half that shipped took the sentence
with it, and a pointer to a backlog entry is only as good as the next person who
follows it.

**The other half shipped the same day**, and what it is worth is narrower than
the entry implied. `parseBackup` now takes `filters` through `FILTER_SHAPE`, a
typed allowlist beside `PLAN_OPTIONS` — booleans as booleans, `cats` as strings,
`avail` as a map of booleans, and a section carrying nothing recognisable
returning `null` rather than an empty object the page would save over what is
already there. Wrong types are **dropped rather than coerced**: a restore that
quietly hands somebody a screen they did not save is harder to notice than one
that falls back to the default.

**What it did not fix, because it was never broken.** The collection page
already validated every one of these where it read them — `avail` intersected
with the buckets that exist and taken as booleans only, `cats` filtered against
`CATEGORIES`, each flag type-checked, and `sort` normalised against `SORTS` at
`app.js:351`, the first line where that object exists. So no unrecognised value
was ever *used*; it was stored, and sat in the reader's own `localStorage` until
the next save. This is defence in depth and one function reading consistently.
The argument for doing it anyway is the one the backlog entry made second and it
is the better one: `filters` was the only section of `parseBackup` with no shape
check while the section beside it had a strict one, and that is the kind of
inconsistency the next person copies.

The typed form is why `FILTER_SHAPE` is a map where `PLAN_OPTIONS` is a bare
list. A planner option of the wrong type is a wrong *number*, and the page's own
reads clamp it; a filter of the wrong type used to reach a CSS selector.

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
- **`wiki.py` carries no upstream string into the wiki today.** This said it was
  worth knowing "because that job holds `contents: write`", and **since
  2026-09-01 it does not** — `wiki.py` runs in the read-only `generate` job now
  and the token lives one job further on. The reason to care is unchanged and was
  always the better one: whatever `wiki.py` emits gets pushed to a public page,
  token or no token. It assembles from `README.md`, `PROJECT.md` and **`TODO.md`** (not
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

  **A second correction, 2026-09-01, and it lasted one day.**
  `data/feed-log.json` — generated by every build — was tracked between
  2026-08-27 and 2026-09-01 as a deliberate testing file, so for those five days
  the claim above did not hold literally. It is untracked again, and it came out
  because tracking it defeated the thing it exists for rather than because the
  testing ended: see *The feed log is untracked, because tracking it broke what
  it is for*. The repository carries no generated file once more.

### *How to crack them* narrows, and the strip says what it is hiding

**Asked for by the owner 2026-08-27, built 2026-09-01.** The list is ranked
correctly and stops being *readable* long before it stops being right. A tier
strip sits on the heading's line — `All · Lith · Meso · Neo · Axi`, each with its
count — and beside it one checkbox per **errand**, shown only when that errand is
on the list.

**A filter, never a re-rank**, and a page test asserts exactly that: whatever
survives keeps the order it had. Same bargain the *Show all N places* expander
makes — the default answer stays the best one and the control only narrows what
is on screen.

**The measurement changed the feature, and it is the reason to measure.** The
backlog entry said "a wide farm list produces dozens". A scratchpad probe agreed
and said the list was bounded at **40 rows**. Both were wrong: read off the
rendered page with every Prime on the farm list, it is **757 — 34 farmable, 6 of
Varzia's, and 717 trade-only**. The probe had quietly dropped the `stranded`
relics this list keeps on purpose, which is the whole reason those 717 exist.

So the control that matters most was not the one that was asked for. `Trade 717`
takes the list from 757 to 40 in one click; the tier tabs then take it to about
ten. Varzia's six were never the noise. **The trade rows stay on by default** —
they are there because a Prime with no way in still has a real answer to "which
relics do I trade for, and at what refinement", and hiding them by default would
quietly undo that decision rather than offer it.

Four things settled while building, three of them by `STYLE.md` rather than by
preference:

- **A tier with nothing in it gets no tab.** §6 — only offer a control for
  something in front of you, the rule that keeps the effort panel to the mission
  types actually ranked. The entry had proposed present-but-disabled; the house
  rule is older and better. Order stays Lith→Meso→Neo→Axi rather than sorting by
  count, because §6 also forbids a control that rearranges itself.
- **Tabs for the tier, a checkbox for each errand.** §6 gives a checkbox to
  *include this* and another shape to *which of these*. One control shape per
  kind of question.
- **On the heading's line.** §5 — a control and the list it changes have to be
  able to see each other, and the sidebar is where the *model's* assumptions
  live. This changes only what is displayed.
- **Not remembered**, like the eight-place fold and unlike the availability
  filters. Those answer "what am I collecting"; this answers "what am I doing
  this evening".

**The counts were wrong on the day it shipped, and the owner caught it.** They
were computed once over the whole list and never moved, so unticking `Trade 717`
left the tabs claiming 195 Lith relics above a list holding ten. The reasoning
behind that was half right and is worth keeping in its corrected form:

> **A facet's count ignores its own control and obeys every other one.**

A tab reading `Lith 10` must not mean "ten survive the tab already pressed" —
that half was right, and is why the tier counts exclude `relicTier`. But Varzia
and Trade are a *different* dimension, and a count that disagrees with the rows
beside it is worse than no count at all. So the errand counts obey the tier and
ignore themselves, `All` always equals the rows on screen, and pressing Lith now
moves `Trade 717` to `Trade 185`.

Two consequences, both deliberate:

- **What a control counts and whether it exists are separate questions.** The
  tab set and the presence of each checkbox come from the unfiltered list, so an
  errand click never makes a control appear or disappear under the reader's
  cursor — a tier emptied by a checkbox reads `0` and greys out instead.
- **The pressed tab is never disabled**, however empty it becomes. Disabling it
  would leave the reader looking at an empty list with the one control that
  explains it greyed out.

A page test asserts the counts by arithmetic against the DOM — each tab claims
exactly what pressing it shows — rather than against expected numbers, which
would need rewriting every time DE vault something.

**Baro Ki'Teer was deliberately absent from a strip he obviously belongs in, and
joined it on 2026-09-04.** The reason for the delay is worth keeping: there was
no such thing as a Baro relic in the payload — `flags.baro` sits on nine *items*
and means "he sometimes sells this Prime", so a box built on that, beside one
built on Varzia's actual shelf, would have answered a visibly different question
in an identical shape. What unblocked it was reading his manifest during a visit;
*Baro's shelf is published too, and only while he is standing on it* above has
that. His box is the third in the strip and is **absent rather than zero**
whenever he is away, which is twelve days in fourteen.

**Two defects found by building it**, both invisible at desktop width and both
now fixed with tests or notes:

- `.plan-head` could not wrap. The strip is about 500px, so in the planner's own
  column the heading was squeezed to **width 0** with its text spilling 181px
  down the page while the strip overflowed to the right.
- `.plan-head .plan-h{margin-top:6px}` existed to pull the *top* heading close to
  the summary above it, and its own comment records it once having wrongly
  matched *How to crack them*. Giving that heading the same wrapper would have
  reproduced that exact bug from the exact rule that documents it; the selector
  is now `.plan-head-top`.

And one about testing, worth more than either: **the first draft of the
empty-tier test picked a Prime whose relics never reach the list**, asserted
against an empty page, and failed. Membership is not existence — the same
mistake the probe made an hour earlier, in a different file, for the same
reason. Both are recorded because the pattern is the point: *the app is the only
authority on what the app shows*, and anything that restates one of its filters
will eventually restate it differently.

### The server is loopback only, and LAN mode is gone

**The owner's decision, 2026-09-01.** `serve.py` refuses to bind anything that is
not loopback, and `serve-lan.cmd` / `serve-lan.sh` are deleted.

**Neither option the review offered.** The security re-review of 2026-08-28 filed
this as *LAN mode is plain HTTP, and says nothing about what that costs*, and
framed it as a choice between saying so in the README and adding HTTPS via a
reverse proxy. The answer was to remove the mode. What it bought was a
convenience — ticking parts off on a phone while playing. What it cost was a
judgement the reader had to make correctly at the moment they least wanted to:
no encryption, so anyone on the path could rewrite the page, the data and the
CSP in flight, after which the collection in `localStorage` is same-origin and
readable; no login, with Backup/Import sitting on the page, so anyone who could
reach the port could read and overwrite the collection; and the whole folder
readable, `.cache` and all.

The blast radius really was one browser's tracker rather than an identity, which
is why it was Medium and not High. That is an argument for it being survivable,
not for keeping it.

**Enforced in the server rather than by deleting the launchers**, and that
distinction is the point. Deleting two files stops the documented route; a
`--host` that still bound `0.0.0.0` would leave the capability one copied
command line away, and old checkouts and shell history are full of those. The
refusal prints why and points at the README rather than failing on an
unrecognised flag.

**`is_loopback` stays and is now belt-and-braces.** Every peer is this machine,
so the `LOCAL_ONLY_FILES` rule that keeps `temp_mockup.html` off the network can
no longer fire — it is kept because it is a check on the *request* rather than
on the socket, so it is the one that still holds behind a reverse proxy or a
port forward, which is exactly what somebody hosting this will put in front of
it. Its tests fabricate peer addresses and keep passing.

**The README gained a short *Hosting it somewhere else*** instead of a warning
attached to a feature. It says `serve.py` will not do it, and that the site
itself hosts anywhere because it is static files with no server side: use HTTPS —
for integrity rather than secrecy, since a rewritten page can read the
`localStorage` the collection lives in — put access control in front of anything
internet-facing, prefer `dist/warframe-prime-hunter.html` since serving the
repository folder exposes `.cache` and `data/`, and send the security headers
yourself because they do not come with the files.

Five checks went with the two launchers — the CRLF and encoding checks are a
glob over `*.cmd` and `*.sh`, so they are per file. Two replaced them, asserting
the parser accepts loopback in each spelling and refuses everything else, which
is checked without binding a socket.

### Nine actions pinned to commit SHAs

**Shipped 2026-09-01**, the first recommendation of the security re-review of
2026-08-28 and the cheapest thing on its list. Every `uses:` line in both
workflows named a moving major-version tag, and a tag is a pointer its owner can
move. Moved to hostile code, it would run inside a job holding a token —
`pages: write` and `id-token: write` on the deploy job, `contents: write` on the
wiki job.

| Action | Pin | Version |
|---|---|---|
| `actions/checkout` | `3d3c42e5aac5ba805825da76410c181273ba90b1` | v7.0.1 |
| `actions/setup-python` | `5fda3b95a4ea91299a34e894583c3862153e4b97` | v7.0.0 |
| `actions/cache` and `actions/cache/restore` | `55cc8345863c7cc4c66a329aec7e433d2d1c52a9` | v6.1.0 |
| `actions/upload-pages-artifact` | `fc324d3547104276b827a68afc52ff2a11cc49c9` | v5.0.0 |
| `actions/deploy-pages` | `cd2ce8fcbc39b97be8ca5fce6e763baed58fa128` | v5.0.0 |

Each moving tag was checked to point at exactly the release named beside it
rather than the version being read off the tag and trusted — `v6` and `v6.1.0`
resolve to the same commit, and so on for all five. `cache/restore` is a
subdirectory of the `cache` repository, so it takes that repository's SHA.

**The comment is load-bearing and is why this is readable at all.** A bare
40-character SHA goes stale silently and cannot be reviewed; `# v7.0.1` beside it
is what makes an upgrade a diff somebody can reason about. The permissions half
of this finding was already done and was left alone.

**The policy and the bot landed the same day**, which is what makes the pins hold
rather than decay:

- **`sha_pinning_required` is on**, turned on by the owner once the nine lines
  were pinned and green. Pinning fixes nine lines; the policy is what stops the
  tenth being added as a tag. Verified through
  `gh api repos/…/actions/permissions`. Worth recording that the switch exists at
  **repository** level even here — this is a personal repository rather than an
  organisation one, and several Actions policies are organisation-only, so the
  plausible wrong answer is that it is unavailable. Asking the API takes one
  command and settles it.
- **`.github/dependabot.yml`, monthly.** A SHA cannot move, so it cannot pick up
  a security fix either, and nothing here would ever say so — pinning trades a
  supply-chain hole for silent staleness. Dependabot understands SHA-pinned
  actions and raises a pull request bumping **both the SHA and the `# v7.0.1`
  comment**, which is the whole reason that comment exists: a bare SHA is not
  reviewable. Monthly rather than the usual weekly, at the owner's direction —
  five actions, none moving fast. npm is deliberately excluded: `package.json`
  exists only to install Playwright for the page tests, nothing in it is shipped
  or served, and the site has no runtime dependency and is never getting one.

The other half of that finding — splitting the wiki job's `contents: write` down
to the moment it is used — shipped later the same day and has its own entry
below.

### The wiki's write token exists for one job, and that job runs no build

**Shipped 2026-09-01**, the last open recommendation of the security re-review of
2026-08-28 and the other half of *Nine actions pinned to commit SHAs*.

`contents: write` is what GitHub requires to push to the `.wiki.git` repository
behind the wiki tab. It cannot be scoped narrower than that — there is no
wiki-only scope — so the only two things left to control are **how long it
exists** and **what runs while it does**. Declared at workflow level, as it was,
the answers were "the whole run" and "everything".

That mattered because of what the run contains. `wiki.yml` fetches from half a
dozen third-party endpoints and builds a dataset out of what they return, purely
so the landing page can state real figures rather than saying it had no data.
For every second of that, the job held a token that could write this repository —
and it never used it. The push clones the wiki with its own credential in the
URL, which is why `persist-credentials: false` was already on the checkout. The
grant bought nothing at all and was carried straight through the one step where
somebody else's bytes are parsed.

**The fix is a job boundary, because that is the only boundary `permissions`
has.** GitHub scopes tokens per job and per workflow, never per step, so
"confine it to the step that pushes" — which is how both the review and
`TODO.md` phrased it — is not literally available. Two jobs are:

- **`generate`** holds nothing above the read-only floor. It checks the
  repository out, restores the cache, runs `build_data.py` and `wiki.py`, and
  hands `dist/wiki` on as an artifact.
- **`publish`** raises `contents: write` and does one thing with it. It never
  checks this repository out, never installs Python, and never speaks to an
  upstream — it takes the artifact and pushes it.

**The pattern was already next door**, which is the main reason this was cheap:
`publish.yml` has run a `contents: read` build job with `pages: write` and
`id-token: write` granted only to the deploy job since 2026-08-26, for the same
reason and in the same words. This applies it rather than inventing it.

Two things worth keeping:

- **`if-no-files-found: error` on the upload is doing real work.** The push
  replaces the wiki wholesale — `rm -f wiki-repo/*.md` then copy — so a `wiki.py`
  that produced nothing would previously have arrived as an empty directory and
  deleted every page. Across a job boundary that failure mode gets a second
  chance to be silent, so it is closed where the handover happens.
- **The test asserts the property, not the wording.** `test_the_wiki_token_is_
  confined_to_the_job_that_pushes` reads the floor, counts the jobs that raise
  it, and checks the raising job runs no build. It caught its own false positive
  while being written: the commit message the push writes names `tools/wiki.py`,
  and matching on the string rather than on the invocation read that as "this job
  runs the build". It matches `python tools/…` now.

The cost is one artifact round trip per run, on a workflow that runs daily and on
documentation pushes — not the ten-minute one.

### Every source has a ceiling, and going over it is an ordinary failed fetch

**Shipped 2026-09-01.** Every remote read in the pipeline took whatever the other
end sent: `resp.read()` with no maximum, `gzip.decompress` over the whole body,
and the result written straight into `.cache/`. Four sites, and the export index
was decompressed twice.

The realistic case was never a hostile CDN. It is a **broken** one — a truncated
gateway, an error page served with the wrong type, a decompression bomb from a
host that has itself been compromised — landing on an unattended scheduled build,
where the cost is memory, disk, or a run that never finishes. HTTPS and a fixed
host list make that unlikely rather than impossible, and they do not make the
bytes trustworthy; this project parses them into a payload a browser then
renders.

`tools/limits.py` owns the ceilings and the three primitives that enforce them.
Four decisions are worth keeping.

**A number per source, at twice what it measures.** The spread across the 23
sources is 21,000× — a 490-byte export index against a 10.4 MB item list — so one
limit that fits all of them fits none. Each ceiling carries the figure it was
derived from as a comment beside it, so the drift between the two is reviewable
without re-measuring. `TODO.md` proposed three times; the owner chose **two**,
which is less headroom on purpose and is paid for by the failure mode below.

**An absolute cap, never a ratio.** The worst expansion ratio measured here is
21.9× and the largest expansion is 10.4 MB. A ratio guard alone is therefore
useless: 40× is unremarkable in this data and a real bomb is 1000×. Only the
absolute number stops the case in the finding; the ratio is a cheap early signal
and nothing more.

**Refusing is a failed fetch, and that is what makes the tightness safe.**
`sources.fetch` already had a well-worn answer for one — try the next host, fall
back to the cached copy, record it in `meta.stale`. Oversize takes that path
rather than inventing a new one, so a ceiling set too tightly costs a stale build
and a loud log line instead of a broken one. A host that has already sent too
much is not asked again on later attempts: it will send the same body, and
re-requesting it three times over is exactly what *"ask no more often than the
source says to"* exists to prevent.

**Stopping early is the property, not stopping eventually.** `gzip.decompress`
and `LZMADecompressor.decompress` over a whole blob cannot stop early by
construction — the bomb has landed by the time there is a length to measure. Both
are replaced by their incremental forms with a per-call output bound
(`zlib.decompressobj`, and `LZMADecompressor` with `max_length`), checked every
64 KB. Measured: a 200 MB gzip bomb at 1029× is refused in under 0.01s. The test
asserts the wall clock for this reason — expanding it all and *then* measuring
would satisfy "is refused" while doing the exact thing the ceiling exists to
prevent.

Two details specific to where they sit:

- **Artwork takes two ceilings**, per image and per run, because 167 responses of
  2 MB each is the failure a per-image cap alone waves through. Images already on
  disk never reach the run budget, so a routine build spends almost none of it.
  A refusal there is already handled: the rewiring pass only repoints what
  actually landed, so the site keeps the remote URL rather than a broken image.
- **`decode_index` needed it most and looked like it needed it least.** It is a
  ~500-byte input, and the reason it is decoded twice is that DE's declared size
  field trips Python's strict decoder — so the code **blanks that field with
  `0xff` and trusts the end marker**. Overwriting the one header that would
  otherwise bound the output is what makes the ceiling load-bearing on the
  smallest source in the project.

**Measured after the change**, on a live build that refetched eight sources
including the 4.4 MB drop table: every cached source sits between 12% and 49% of
its own ceiling. A test asserts that nothing is above 75%, which is what tells
somebody a source has grown *before* builds start going stale over it.

**And then the canary fired on the next CI run, which is the part worth keeping.**
`api_syndicatemissions` came back at 114,415 on a clean runner against the 61,126
measured here — 87% of its ceiling, from two samples taken hours apart, because a
different set of bounties was live.

The entry above named `de_worldstate` as the one to watch and had the reasoning
right for the wrong row: **a live feed's size moves with game state, so one sample
of one is not a measurement of it.** That is a different kind of number from the
catalogue sources, where 10.4 MB of items is 10.4 MB until DE ship something. The
five live feeds are now set at twice the *largest* figure seen rather than twice
the local one, with extra room besides — most of all `api_events`, which was
sampled with no limited-time event running at all and so was measured at its
floor.

Two things this cost nothing to learn, because the failure was a red test on a
runner rather than a stale build in production: the ceiling policy needs to know
which sources vary, and the 75% canary is the assertion that made the difference
between finding out now and finding out from a build that had quietly gone stale.

### The planner's search marks parts collected, and adds no Primes at all

**Shipped 2026-09-02**, and the owner's answer was larger than the question
asked. The entry proposed *adding* parts to a search that already added Primes;
the ruling was to **remove the Prime search outright** and give the box to parts.

**It is a division of labour, not a loss.** The planner is where you are standing
when a part actually drops — you have just run Hepit, you have the Neuroptics —
and until now the only way to record it was to change page, find the Prime and
open its drawer. Deciding *what to chase* is the collection page's job, and it
already has the control on every card and in every drawer, so nothing is
stranded. Checked before building, because a search box that stops adding Primes
would be a trap if that were the only way to add one.

Four forks, each with a defensible alternative, each now pinned by a test
because picking the other would look like a bug:

- **Parts only, no Primes among the results.** Mixing them puts a row that
  *wishes for* something beside a row that *owns* something, and at a glance
  they are the same row.
- **Matched word by word on the whole `"Ash Prime Neuroptics"` string**, every
  word required, so `ash neuro` narrows where `ash` alone does not. Either half
  still works on its own.
- **A part name on its own is refused, not ignored.** The owner's follow-up the
  same day: make the reader be specific. Measured on this payload, `Blueprint`
  is on 160 Primes, `Systems` 57, `Barrel` 54, `Receiver` 53, `Neuroptics` and
  `Chassis` 50 each, and `Prime` on all 167 — a bare part name returns fifty
  near-identical rows differing only in a name the reader has not typed, which
  is the shape most likely to get the wrong part ticked.

  **The rule is about the query, not a list of banned words**: if it still spans
  more than the ten rows the list can show, it says so and asks for the Prime's
  name. A stop-word list would need maintaining against DE inventing part types
  — `Cerebrum` and `Carapace` are already here, on six Primes each — while this
  needs nothing. It also **refuses rather than silently ignoring** the word,
  which is the difference between a reader who knows what to do next and one who
  thinks the search is broken. Measured after: `prime` and `blueprint` refused
  at 160, `neuroptics` at 50, `stock` at 29; `link` (10), `carapace` (6),
  `vasto` (2) and `ash` (1) all still answer.
- **Newest first, owned last.** A part you are holding is far likelier to be
  from something recent than from a 2015 release; 166 of 167 items carry a
  `releaseDate` and the odd one out (Kavasa Prime Collar) falls back to
  alphabetical. Owned rows also *dim and take a green left edge*, because sort
  order is invisible once a list is scrolled — the row has to say it itself.
- **A tick records the part and leaves the farm list alone**, then says so. You
  can get a drop you were not chasing, and adding the Prime would reorder the
  whole page off one click; but a tick with no visible effect reads as a tick
  that failed, so the untracked case says *"— not on your farm list"*.

**One tick is one part**, reusing `cyclePart`: the 53 parts needing two or more
go `0/2 → 1/2 → have`, which is how a drop actually arrives. That behaviour
already existed on the *Still needed* rows; the search borrows it rather than
inventing a second rule.

**Two things the browser caught that no static check could.** The confirmation
began as its own absolutely-positioned panel at the same offset as the results
list, so it landed *on top of the first result* — it is the first row inside the
panel now. And the empty-list hint linked to the collection page's own file,
which is a dangling reference in the single-file build where both views share
one document; the bundle check refuses it, **including when the name appears
only in a comment**, which is why the comment explaining this does not contain
it.

### `Rush` pays once, and is no longer charged four rounds to reach it

**Shipped 2026-09-02**, the third application of the `FIXED_LENGTH` shape `Spy`
and `Caches` got in `d8b4484`, and the first defect the mission-type sweep
actually found.

Rush is an Archwing race, not an endless mission. The wiki: *"Players will get 1
Rotation reward corresponding with the number of destroyed Transports"* — one
transport pays rotation A, two pays B, three pays C. **The rotation is the
player's own performance rather than a position in a cycle**, and a run pays
exactly once.

DE's tables agree and add the part that decides the entry: **relics live only in
rotation C**. A and B carry none. So a relic run means destroying all three
transports for a single rotation C draw.

The model had it as endless AABC, so `reset` ran the cycle out to **four rounds**
to reach that one C — one draw charged four times what it costs, across
`Phobos/Kepler` and `Event: Phobos/Opik`, 37 relic sources between them. Now
`{count: 1, unit: "run", pays: ["C"]}`, measured back at 1 round and one `C`.

**`pays: ["C"]` is a claim and is worth defending rather than assuming.** The
alternative is listing all three rotations, which would be describing runs
nobody making this decision is doing: a rotation A or B result has no relic in it
to want, so nothing reaches this code path wanting one.

**What made this one safe to act on was two sources agreeing.** The same sweep
produced a wrong finding hours earlier — The Circuit reported as never paying
rotation A, on the wiki's word, when DE's table shows rotation A paying credits
and endo. The rule that came out of it: *the drop tables are what the build
parses, so the drop tables govern*, and the wiki is for the cadence the tables
structurally cannot state. Rush is the case where both said the same thing.

### The Void Trace cap holds at Mastery Rank 30, and says whose guess that is

**The owner's decision, 2026-09-01.** The wiki gives the cap as
`(Mastery Rank × 50) + 100` and works two examples, MR13 = 750 and MR30 = 1600.
Its table stops at 30. `Void Traces` and `Mastery Rank` were read on 2026-08-27
and `Void Traces` again on 2026-09-01: Legendary is unaddressed on all three
readings.

`traceCap` used to keep counting, so LR1 read 1650. **It now holds at 1600.**

**Neither number is sourced, so the question is which way to be wrong.** That is
the whole of the reasoning and it is worth stating, because "be conservative" on
its own is a slogan. The planner uses this figure for exactly one thing: whether
the reader can afford Radiants. Understating the cap advises caution that was not
needed. Overstating it advises a refinement the player **cannot actually pay
for** — a wrong answer they act on and then cannot complete. The costs are not
symmetric, so the low guess wins.

**And it is attributed.** The badge said *"our own continuation of the formula"*,
which was accurate while the number was extrapolated and would have been quietly
wrong afterwards: it is no longer a continuation of anything. It now says the
wiki is silent, that the cap is held at the MR30 figure, that this is the
owner's assumption rather than something DE publish, and — the part a Legendary
reader actually needs — that if Legendary ranks do raise it, theirs is higher
than shown. The line quoting the formula is suppressed above 30 for the same
reason: naming `(rank × 50) + 100` beside a number that no longer comes from it
is how a guess acquires a pedigree.

Pinned at three Legendary ranks rather than one, because a plateau that holds
for LR1 alone is an off-by-one wearing a plateau's clothes, plus a check that
holding never means going *backwards* at the boundary. Read off the real page at
LR5 rather than trusted from the source.

**What would still settle it is unchanged and is not a wiki page**: one Legendary
player reading their own cap in game. `TODO.md` no longer asks anyone to check
the wiki a fourth time.

### The cadence test asserts a ceiling on response time, not four equal numbers

**Shipped 2026-09-01, at the owner's request, after the test got in the way of a
change they had every right to make.** Four numbers describe the refresh cadence
and the suite required all four to be the **same integer**: the CI cron, the
Windows task, the cron script, and the page's own fissure poll. The owner set the
CI cron to 15 minutes for a few days — to measure how often DE answer without
leaning on WFCD — and the suite went red. Nothing was wrong. The numbers had
stopped matching.

**Equality is right for exactly one of those pairs**, and the rewrite is mostly
about telling them apart. `schedule.ps1` and `schedule.sh` are **one job written
twice**, because Windows has Task Scheduler and everything else has cron; a
number changed on the platform in front of you and left alone on the other is
invisible, and there is no reason they should ever differ. That stays an
equality. The CI cron, the local job and the page poll are **three independent
schedulers with different constraints** — a best-effort cron with a five-minute
floor and a deployment budget, a task on a machine that may be asleep, and a poll
that costs one request to our own origin. Requiring those to agree to the minute
guarded nothing and cost a measurement.

**What is worth guarding is response time**: how long a change at the source
takes to reach a reader's screen. That is a sum — `build interval + page poll` —
and the rule is a ceiling on it, asserted twice because there are two audiences,
the deployed site and somebody running this locally.

**The ceiling comes from evidence, or it is no better than the equality it
replaced.** A fissure's shortest observed life is 60 minutes (measured
2026-08-27, median 88), and a fissure nobody can see is the failure this cadence
exists to prevent — so the ceiling is half of it, 30 minutes. Driven over
candidate cadences rather than reasoned about: today's 10 + 10 passes at 20, the
owner's 15 + 10 passes at 25, 25 + 10 fails, and an hourly rebuild fails hard.
Confirmed against the real file by setting the cron to `*/25` and watching it go
red.

The page poll keeps its own looser rule, because it is the one scheduler here
that costs nobody anything: it reads four kilobytes from our own origin, and a
page polling faster than the site rebuilds is redundant rather than wrong. What
is asserted is only that it cannot be the reason a reader waits.

### The deployed site can be framed, and that is accepted rather than unnoticed

**Decided 2026-09-01 by the owner.** `serve.py` sends `frame-ancestors 'none'`
and `X-Frame-Options: DENY`. GitHub Pages sends neither — during the security
review it returned no CSP, no `X-Frame-Options`, no `X-Content-Type-Options` and
no `Referrer-Policy` at all. So the published site can be embedded in a frame by
anyone, and nothing in this repository can stop it.

**The obvious fix is specified not to work, and it is worth knowing why before
someone tries it.** Putting the policy in a `<meta http-equiv>` tag does not
help: the CSP specification requires browsers to **ignore `frame-ancestors` in a
meta policy**, alongside `report-uri` and `sandbox`. That is mandated rather
than a quirk, and every engine complies.

The reason is structural, and it generalises. `frame-ancestors` has to be
enforced by the *embedder*, before it renders the document — but a `<meta>` tag
is only discoverable after fetching and parsing that document. By the time a
browser could read the instruction, the framing has already happened. The check
has to arrive as a response header, and on Pages we do not control response
headers. `default-src 'none'` is not a substitute: it governs what the page
loads, not who may embed it.

**Accepted, and here is the argument rather than the assertion.** Clickjacking
works by tricking somebody into performing a privileged action they did not
intend. This site has no accounts, no sessions, no server-side state and no
state-changing controls: the worst a framed click achieves is ticking a checkbox
in the visitor's own browser, in their own `localStorage`, which they can untick.
There is no session to ride and no action worth stealing.

The alternatives were weighed and declined: fronting Pages with a service that
can add headers, or moving the deployment somewhere that supports them. Both buy
a header this threat model does not need, and both add an operator and a
dependency to a project whose whole shape is *"static files that survive being
copied to a USB stick"*.

**Recorded because the finding's own words are right** — this is a defensible
answer and *"only a bad one if nobody has said it out loud"*. It is said out
loud here. Anyone hosting these files behind something that does set headers
should set `frame-ancestors 'none'`; `README.md`'s *Hosting it somewhere else*
is where they will be looking.

### Connections are counted at accept, where the other two protections cannot

**Shipped 2026-09-01**, the last security finding with a fix in this repository.
Two protections already existed and both act too late for one particular shape:

- the **token bucket** runs inside `do_GET` — after a request line and headers
  have been parsed — so a client that opens a socket and *says nothing* is never
  counted at all;
- the **30-second handler timeout** bounds how long each thread lives, not how
  many there are.

The first review opened 80 partial requests at once and all 80 were accepted.
`SiteServer.process_request` now takes a slot from a `BoundedSemaphore` at
**accept**, before a thread exists and before a byte is read, and answers the
excess with `503` and a close rather than parking it. Both existing protections
stay: they solve different parts of this, and the file records what each was
measured to do.

**64, chosen against what the site actually does.** It speaks HTTP/1.0, so every
request is its own connection — a cold page load is nine files plus up to 167
images — but browsers cap themselves at about six concurrent per host, so even
several tabs stay far below. `request_queue_size` went to 32 in the same pass:
the listen backlog absorbs ordinary bursts, the semaphore stops floods, and
those are different jobs.

**Releasing is the part that had to be right.** The slot comes back in a
`finally` on `process_request_thread`, because a semaphore that leaks turns into
a server that accepts nothing at all — a worse outage than the one being
prevented, and arrived at by trying to fix it. The test asserts that third
property explicitly, not just the ceiling.

`SiteServer` moved to module level to make any of this testable. A connection
ceiling cannot be checked by reading a parser, so the test stands a real server
on port 0 with a ceiling of four, opens eight silent sockets, and checks the
excess is refused and that an ordinary request works once they close.

**Largely moot, and built anyway.** The server binds loopback only since
2026-09-01, so the only thing that can open 64 stalled connections is a process
already on this machine. This is a property of the code rather than a live
exposure — and it matters again the moment these files sit behind something that
does listen more widely, which `README.md` explains how to do.

### The feed log is untracked, because tracking it broke what it is for

**Shipped 2026-09-01.** `data/feed-log.json` was deliberately committed on
2026-08-27 as a temporary testing file, and it came out five days later — not
because the testing finished, but because tracking it silently defeated the
thing it exists to do.

`read_feed_log` prefers a local copy and falls back to fetching the published
one. That is right for a developer's machine and wrong for CI, where "local
copy" meant **the committed one**: a runner's checkout found three rows from
2026-08-27, `trim_feed_log` dropped them as older than a day, and the run wrote
a single row. Every build started empty. The deployed log held **one row** while
the owner was asking the question it was built to answer — *how often do Digital
Extremes answer the runner* — and that question had to be settled by reading
eighteen CI logs by hand instead.

Untracked, CI takes the path a fresh clone already takes: fetch the deployed copy
and continue it. Nothing else changes, and the local file stays on disk so a
developer's own builds keep their own history.

**The general shape is worth more than the fix.** A cache that prefers a local
copy is correct until something puts a stale local copy where there was none.
Committing a generated file did exactly that, and the failure was invisible in
the way that matters: every build succeeded, published a valid log, and reported
nothing wrong. It looked exactly like *"the feature works, DE just always
refuse"* — which is the same sentence this file records about the four days the
log 404ed.

### The CI probe asks about the source that actually refuses

**Shipped the same day, found while measuring the above.** *Probe the data
sources* exists to record which upstreams answer a datacentre IP, since that is
not the set that answers a home connection. It curled five URLs — the wiki, the
drop tables, `origin.warframe.com`'s export index, and two WFCD hosts — and not
`api.warframe.com/cdn/worldState.php`.

That is the document all four live feeds come from, and whether DE answer it is
precisely what decides first-party against the proxy. So the probe recorded
which sources answer a datacentre IP for every source **except the one the
question is always about**, and had done since it was written.

The test asserts it from `sources.py`'s own constants rather than from a copy of
the URL, so a host that moves cannot leave the probe quietly asking the old one,
and it checks the step is still a probe — a status code and no body.

### Serving a page reads upstream and keeps nothing

**Shipped 2026-09-01**, and it closes the half of the freshness finding that
serve-then-refresh only narrowed. `upstream_signature` makes one HEAD and two
GETs, and both GETs went through `fetch`, which writes the body to `.cache/*.gz`
with `.etag` and `.maxage` sidecars. So **serving a page wrote to the cache the
build reads from** — underneath a build that might have been reading it.
`serve.py`'s own comment had said so since 2026-08-26, filed under the things
nobody notices.

`fetch(..., readonly=True)` reads the cache and writes nothing: no body, no
sidecars, and no entry in `STALE` or `MISSING`. There are three places `fetch`
records something, and all three are now behind that flag — the success write,
the warm-fallback `STALE.append`, and `stale_if_older` on a 304.

What a read-only caller still does is the part worth stating: it **honours the
freshness window the source declared** and **sends the `If-None-Match` it already
holds**, so the polite conditional request is completely unchanged. It simply
does not keep the answer. The builder owns the cache; a prober does not get to
warm it, and does not get to age it either.

**Two things fell out of it.**

`readonly` is never fatal, whatever `critical` says. A prober that cannot reach a
source has learnt something about the source, not about this build. That also
takes `SystemExit` off the path `serve.py` runs on — which matters, because that
exception had already frozen the single-flight flag once (see below).

And the mode has exactly one caller, which is a thing a test has to hold: a
`readonly` that nobody passes is a `readonly` that silently stops applying. The
suite asserts `serve.py` asks for it by name.

Verified against the real server rather than the function: 47 files in `.cache/`
snapshotted, a page served, the check confirmed to have run (`ok: true`, a fresh
`checkedAt`), and **not one file changed**. Before this the same check rewrote
three bodies and their sidecars.

### A background check must publish an answer, whatever kills it

**Found and fixed 2026-09-01, hours after the code that caused it.** The
serve-then-refresh worker lowered its `running` flag in a plain block at the end
of the function, while its own docstring said `finally` lowered it "whatever
happens". There was no `finally`.

The flag is what stops the stampede, so a flag left raised stops everything:
`freshness()` starts a check only when nothing is running, the banner freezes for
the life of the process, and the page polls twelve times into a state that cannot
change.

**`SystemExit` is what got there, and it was reachable.** `sources.fetch` raises
it on a cold miss with nothing cached — a fresh clone with no `.cache`, served
while offline. `upstream_signature` catches `except Exception`, which does not
catch a `BaseException`, and neither did the worker.

Both halves were needed. `finally` guarantees the flag comes down; catching
`BaseException` guarantees an *answer* is published rather than the thread dying
quietly. `body` is bound before the `try` so the `finally` can never reach for a
name that was never assigned. The `readonly` work above then removed the
`SystemExit` path itself, so this is now defence rather than the only defence.

**Worth carrying forward: the docstring was written from the intention.** It
described `finally` because `finally` was what the author meant to write, and it
read as evidence to everyone afterwards — including the author, hours later. It
is the same shape as `bundle.py`'s docstring being wrong by ten about shared
element ids. A confident sentence in the file that does the thing is not evidence
about the thing.

### Six rounds is a premade's option, and it is availability rather than worth

**Shipped 2026-09-01**, asked for by the owner on 2026-08-27. `runValue` offered
every non-fissure endless node two lengths — `reset`, run to the last round that
pays, and `aabcaa`, six rounds, a cycle and a half whose extra two rounds are
both rotation **A**. `scorePlan` picked between them on rate, and six won
whenever two more A rotations beat the cost of restarting.

**The framing was the decision, not the number.** This was first written down as
a preference — the model says six, the owner would rather stay four — and that
was wrong. The owner's correction: *"with randoms nobody goes up to 6 rounds.
It's not a matter of being optimal, it's not a valid choice for non-4man."* A
public squad extracts; you cannot hold three strangers for a cycle and a half by
preferring to. So a six-round plan is not a *worse* plan for a random squad, it
is **not a plan** — the same category as a Railjack node without a ship, and not
the same category as the Railjack cache halving, which really is a judgement
about worth.

That decides where the code goes. A thumb is applied to the score and announced
on the row (`PROJECT.md` requires it, and the project has exactly one). An
unavailable option is **filtered out of the choice before anything is scored**,
which is what `plansFor` already does for `squadOnly` rotation patterns. So
`aabcaa` is dropped from the mode list unless `squad` **and** rotation A is the
only thing wanted at that node — strict, zero value in B and C, with no
share-of-total threshold because that is a second constant nobody has justified.

`opts.squad` already meant "you have an organised team", but this is the first
time it decides a run *length* rather than a rotation pattern. That coupling is
named in the code rather than folded into `squadOnly`, which is a property of a
pattern.

**The entry predicted the wrong outcome, and measuring it is what caught that.**
It expected a large swing on one checkbox, because 45 of 66 endless rows ran to
six before the change. Driven through the real page with every farmable Prime
wished for, 116 places ranked:

| rounds | 2 | 3 | 4 | **6** |
|---|---:|---:|---:|---:|
| randoms | 1 | 21 | 44 | **0** |
| 4-man premade | – | 15 | 50 | **1** |

So six-round plans did not move from everyone to premades. They very nearly
**stopped existing**: exactly one row of 66 qualifies even with a team, because
"wants nothing but rotation A" is rare once a real farm list is loaded. Twelve
rows change cost, thirty-nine change rank, and the top five are identical either
way — the swing is legible, which is what the entry asked to be checked.

**One test was quietly relying on the old behaviour in a way worth recording.**
The fissure run-length page test toggled `#p-squad` once as a cheap way to force
a re-render, and toggled it back at the end. That was harmless while the box only
changed Disruption's rotation pattern, and stopped being harmless the moment it
also decided length — a single click would have re-rendered *and* changed the
number under test. It clicks twice now, so it re-renders and leaves the box where
it found it. A control that gains a second effect breaks the tests that were
using it as a lever for its first one.

### The guard sees a program on stdin, and stopped guessing at write modes

**Shipped 2026-09-01.** `tools/guard_shell_writes.py` is the PreToolUse hook
behind hard rule 1, and it could not see a program supplied on **stdin**.
`echo >`, `sed -i`, `tee`, `python -c`, `node -e` and `Set-Content` were all
refused; **`python - <<'PY'` was allowed**, and so was `python < script.py`.

The cause was one `\b`. `INLINE_PROGRAM` matched `…\s+-\s*[ceEp]*\b`, which needs
a word character after the dash to close the boundary — so a *bare* `-`, the
ordinary way to say "the program arrives on stdin", never matched. That is the
form anyone reaches for the moment a script outruns one line, which made it both
the widest hole and the likeliest to be used. Three writes went through it the
day it was found; one mangled `\d` and `\/` in a regex on the way in and failed
on an assertion by luck rather than by design.

The pattern now accepts all three ways a program can arrive as text: a flag
(`-c`, `-e`), a bare `-`, or a `<` redirect.

**Widening it exposed a loose pattern in the half that gates it, which is the
part worth keeping.** The guard only refuses when `INLINE_PROGRAM` *and* `WRITES`
both match, and `WRITES` asked for `open\s*\([^)]*['"][wax]` — a quote followed
by `w`, `a` or `x` anywhere inside the call. That matches
**`open('assets/plan.js')`**, on the `'a` of `assets`. A pure read, refused.

It had never mattered, because until this change almost nothing reached that
regex; afterwards it would have prompted on the commonest probe in the project —
every `node:vm` scratchpad in `CLAUDE.md` is a read-only stdin program. `WRITES`
now requires a real mode argument: a comma, then a quoted token made only of
mode letters, one of which opens for writing. **Widening one half of a two-part
test is what exposes a loose pattern in the other half**, and the test carries
both directions because a guard that over-blocks is a guard somebody switches
off.

Verified through the live hook rather than against `blocked()`: the heredoc write
to `tests/` is denied and leaves no file, and a heredoc that only reads
`assets/plan.js` still runs.

### Both planner headings are centred on their row, not on their slack

**The owner's, 2026-09-01.** `text-align:center` on the heading was the obvious
change and it was not enough: it centres the text inside whatever space the
controls leave, which put *Where to go* **54px left** of the row's centre and
*How to crack them* **103px right** of it. The side elements are different
widths — a select on one row, a tab strip and two checkboxes on the other — so
centring in the leftovers is centring on an asymmetric gap.

Both sides share the slack equally (`flex:1 1 0`) and the heading takes only
what it needs. Each side then holds its contents against its own edge with
`justify-content`, which is what keeps the tabs hard left and the checkboxes hard
right while the heading sits in the middle. `.plan-head-top` carries an **empty
`.plan-side`** for the same reason: it has no left-hand control to balance the
select against, and a spacer is the honest way to say so. Measured at 1440px:
row centre 858, *Where to go* 858, *How to crack them* 857.

**The *Where to go* sub-heading went with it.** `STYLE.md §5` asks that a list
which ranks on something says so in its heading, and `#planRankedOn` did —
following both the sort toggle and the switch to minutes that effort weights
make. It was removed because **the control beside it already says the same
words**: the `<select>` sits on that heading line with no label of its own, and
its options are rewritten to read *per reward*, *per minute* or *per run*. The
rule is satisfied by the control rather than by a second copy of it, and the
page test that asserted the heading now reads the selected option instead.

*How to crack them* keeps its sub-heading, shortened to *— openings per part*,
precisely because it has no such control: remove it there and nothing on screen
names the quantity its rows are ordered by.

### The crack-list controls are saved, and the tabs moved left

**Both the owner's, 2026-09-01, and the first reverses a decision taken four
commits earlier.**

`relicTier`, `showVarzia` and `showTrade` were deliberately *not* saved. The
argument was that `opts` holds assumptions about the player — each of which
changes what the model concludes — while these change only how much of the
conclusion is visible, and that a tier still selected from last week would make
the list look short for a reason nobody could see.

The owner reported the symptom as a bug: Varzia's box came back ticked on every
refresh. What the original argument missed is the cost on the other side. **A
control the reader sets on every single visit is one the app is making them
repeat**, and the protection it bought was against a confusion the strip itself
already prevents — the tab is drawn pressed and every count beside it is live,
so the reason the list is short is on screen. The line the old reasoning drew
was not where it claimed to be either: `sort` was already view state living in
`opts` and already saved.

All three, not only the box that was reported. Two adjacent checkboxes of
identical shape behaving differently is worse than either behaviour on its own.
`expandNodes` stays unsaved and that is not an inconsistency — it is the one
with no control showing its state once the page is drawn.

Two things that fell out of doing it:

- **`tier` is normalised against `TIERS` when it is read back**, because
  `PLAN_OPTIONS` is a name list rather than a shape check and a backup can write
  that key. `TIERS` moved to the top of `plan.js` for it: a `const` used above
  its declaration is a ReferenceError, not a hoisted `undefined`.
- **The three keys were added to `PLAN_OPTIONS`**, or a backup would silently
  drop them — that list is the allowlist `parseBackup` filters against.

**The tabs moved left in the same pass.** The heading line now reads
`[All Lith Meso Neo Axi]` · *How to crack them* · `[Varzia | Trade]`, which needs
two containers: CSS can order flex children but cannot split one container's
contents across a sibling. Both strips had to stop growing for it to hold —
`.tier-tabs` was `flex:1 1 auto` because it was the only one on its line, and
with one either side of a greedy heading the slack got shared three ways and
nothing sat against its own edge. Measured at 1440px: tabs `312→598`, heading
`612→1310`, errands `1324→1403`. Below about 1100px the strip wraps above the
heading, which is the ordinary flex-wrap behaviour and is fine.

### The server serves first and refreshes behind, so one page load is one check

**Shipped 2026-09-01.** `freshness()` in `serve.py` took the lock, read the cached
answer, **released the lock**, and only then called `sources.upstream_signature` —
one HEAD and two GETs, each with a 120-second timeout. The lock was taken again at
the end, to publish.

So every request that arrived before the first check finished saw no cached answer
and started its own. Three tabs opened together made three sets of the same three
upstream requests, and all three wrote the same `.cache/*.gz` bodies and `.etag`
sidecars underneath a build that might be reading them. `FRESHNESS_TTL` worked
perfectly from the second check onwards and did nothing whatever about the first.

**The blocking was deliberate; the stampede was not.** The comment above the
function argued the trade honestly — a slow first load beats quietly serving data
you have no reason to trust — and that argument is about *one* check, not about
*n* of them. The sharper objection is the project's own rule: asking Digital
Extremes three times because three tabs opened at once is precisely the
hospitality *"ask no more often than the source says to"* exists to protect.

**Two fixes were on the table and the owner took the larger one.** Holding the
lock across the check is three lines and makes the other tabs wait; serving the
built data immediately and refreshing behind it is a bigger change, because the
page then has to learn the answer late. The second was chosen, so:

- `freshness()` **never blocks and never goes upstream.** It answers with what is
  known, raises a `running` flag under the lock, and starts one background thread.
  A request arriving a microsecond later finds the flag up and starts nothing —
  the stampede is gone by construction rather than by a lock held longer.
- Three answers are now distinguishable, and the page reads all three: a settled
  body; a settled body with `checking: true`, meaning a previous answer is being
  refreshed behind this response; and `{"ok": null, "checking": true}`, which is
  what a cold first load gets.
- **`upstream.json`** serves the same answer on its own, and `shared.js` polls it
  only while `checking` is true — twelve tries at 700 ms, then it gives up. A
  banner is an advisory, and a page that polls a dead server all afternoon to draw
  one has its priorities wrong.
- `renderStaleBanner` is idempotent and the bar carries `id="upstreamBar"`, so the
  late answer replaces the bar rather than stacking a second one under the header.

**What this trades.** The first load is now fast and briefly says nothing about
upstream, where before it was slow and said something. That is only defensible
because the banner corrects itself within a second or two — a page that never
asked again would be strictly worse than the blocking version, which is why the
page half is not optional.

Verified against the real server rather than reasoned about: a cold `serve.py`
answered the 1.9 MB payload in 326 ms with `checking: true` planted on it, the
page requested `upstream.json` exactly once, took the settled answer, and stopped.
The suite pins both halves — a Python test stalls the check on an event and
asserts twelve simultaneous requests cause **one** check and that none of them
waits, and two Playwright tests assert the banner appears without a reload and
that polling stops once the answer settles.

**What did not change, and is a separate question.** A *process* lock on refresh —
what would stop two local builds interleaving — is not this. Single-flight only
stops one process racing itself. Neither is the other, and only the first was a
security finding; the second is a foot-gun for whoever runs two terminals, and it
keeps its own note in `TODO.md`. The second half of the finding — whether page
serving should write the builder's cache at all — also stands, and is now the
whole of that entry.

### `data/feed-log.json` is written atomically, and it is the only one

**Shipped 2026-09-01.** Non-atomic writes across the pipeline were examined and
**declined** on 2026-08-26 — see *Two security findings examined and declined* —
and that decline rested on one property: every torn write here **fails loudly**,
and a build that stops is a build somebody fixes.

The feed log postdates the decline and breaks that property. It is read back
inside a bare `except (OSError, ValueError): pass`, so a torn one is silently
treated as **absent** and the build starts a fresh 24-hour log, discarding the
record of which source answered each live feed. That is the same end state as
the four days the log spent 404ing because the workflow never copied it, and it
is quiet wrong data rather than a stopped build — the one failure mode here
worth spending a helper on.

`write_atomic` in `build_data.py` writes to a temporary sibling, `fsync`s, and
`os.replace`s. A sibling rather than a temp directory because `os.replace` is
only atomic within a filesystem. **Deliberately used at one call site**: the rest
stay opportunistic, to be taken when that code is being touched anyway, which is
exactly what the 2026-08-26 decline concluded and this does not reopen.

### The privacy footer names the hosts the build actually uses

**Shipped 2026-09-01.** The security re-review found `artworkNote()` naming
`cdn.warframestat.us` while the deployed site loaded all 167 images from
`content.warframe.com` — a privacy sentence naming a host it never contacts and
omitting the one it does.

**The finding could not be fixed where it was found, and that is the part worth
keeping.** `artworkNote()` read `meta.sources.images`, and that field was a single
string chosen by whether artwork is local. But `image_for` picks **per item** —
DE's `content.warframe.com` wherever their texture manifest answered, WFCD's CDN
where it did not — so a build can genuinely use both, and no correction to the
sentence could have made it true. The field had to be able to express the answer
first.

So the build now records **`meta.sources.imageHosts`**, the distinct origins the
URLs on that very payload carry, computed *after* `cache_images` has repointed
whatever went local. Origin only, never paths — a path would name every file the
reader loaded. `meta.sources.images` survives as the same list joined into a
sentence, and `artworkNote()` falls back to it for a payload built before this,
because a footer that goes blank on an old dataset loses the licence and the
Content Policy attribution, which is worse than being coarse.

Measured both ways before and after: a local build reports `["assets/img"]` and
claims no third party; a build without local artwork reports
`["https://content.warframe.com"]` and names it. The mixed case has a test rather
than a measurement, since DE currently answer for all 167.

Two smaller corrections went with it. `NOTICE.md` asserted *"no third-party
requests"* flat, which is true only of a build with local artwork and false of
both artefacts most people read — it is now scoped, and says which hosts and what
they see. And the footer now mentions that `cdn.warframestat.us` answers 301 to
`raw.githubusercontent.com`, so a reader told "one third party" is not told
wrong; `serve.py`'s CSP has to allow that hop for the same reason.

**The comment claiming this was derived from the CSP was itself wrong** and is
corrected: `build_csp` scans the payload *text* for host names and never reads
this field. Two answers to one question, arrived at independently.

### The guard stopped guessing at shell syntax and started checking what changed

**Shipped 2026-09-03**, from the owner's question after the sweep: *"shouldn't it
be a whitelist instead of a blacklist that needs constant updating?"* Yes — and
the interesting part is that the obvious inversion is the wrong one.

**Why the blacklist could not be finished.** `guard_shell_writes.py` matched
shell syntax: redirects, `sed -i`, `tee`, `Set-Content`, an interpreter handed a
program. A sweep on 2026-09-02 found **ten** ways round it in an afternoon —
`cd assets && sed -i app.js`, `sed -i index.html` (the root pages are always
named bare), `cp` from the scratchpad, `1>`, `sed --in-place`,
`dist/../assets/app.js`, `python -u -c`, the full `node.exe` path this project's
own orientation file recommends, `find -exec`, and `shutil.copy`. There is no
reason to think that was the last ten: it is static analysis of an arbitrary
shell language, which does not terminate.

**Why whitelisting commands would not have fixed it.** The guard has two halves —
*is this a write* and *which paths does it name* — and a verb whitelist only
replaces the first. `PATHISH` still has to find the paths, and roughly half the
holes live there: `cd assets && sed -i app.js` names no guarded path at all, so
no list of allowed verbs would have seen it either.

**The inversion that works is to stop reading the command.** Hash the guarded
files in the PreToolUse pass, hash them again in the PostToolUse pass, report
what moved. Nothing is enumerated, so every mechanism is covered — including the
ones nobody has thought of — because none of them can change a file without
changing its hash.

**Two limits, stated rather than glossed.** It **detects rather than prevents**:
the bytes have landed by the time it speaks. That is only acceptable because the
failure this rule exists for is *silent* — `\b` arriving as a backspace byte,
surviving every syntax check — and a report one second later, while the command
is still on screen, defeats a silent failure nearly as well as a refusal does.
And it sees only what the tool it is wired to can change.

**The false-positive question answered itself.** The snapshot is taken in the
*Pre* pass, so an Edit or Write between two shell commands is already in the
baseline and is never attributed to a command. Only a change occurring between
the two passes of one invocation is reported. Verified in the suite.

**Cheap enough not to be clever.** 24 guarded files, 1.2 MB, 1.6 ms to SHA-256
the lot — so it hashes everything every time rather than tracking mtimes, which
is simpler and strictly harder to fool.

**The blacklist stays**, demoted rather than deleted: it still gives an immediate,
specific refusal for the common cases, which is a better experience than a report
after the fact. It is just no longer the thing being relied on, and both
`README.md` and `PROJECT.md` said "any shell command" until this shipped — the
word that would have stopped anyone checking.

**One older finding closed with it.** The hook crashed, and therefore failed
*open*, on a payload whose `command` was not a string. It is coerced now, and the
suite asserts a non-string payload exits cleanly.

### The ceiling tests measure memory, because the clock could not fail them

**Shipped 2026-09-03.** Two assertions in `test_a_source_cannot_send_more_than_its_ceiling`
claimed the capped decompressors stop *early* rather than expanding a bomb and
then measuring it. Both were `time.time() - started < 5.0`.

**Measured against the implementation they exist to reject:** a naive
`gzip.decompress` of the same 64 MB bomb takes **0.018s**, and `lzma.decompress`
of the 32 MB one takes **0.056s**. They passed the check by factors of 278 and
89. The comment above the first one described the defect it was guarding against
exactly right and then picked a bound that could not detect it — which is the
more interesting half, because the reasoning was sound and only the threshold was
unfalsifiable.

**Peak allocation is the honest axis.** "The bomb has already landed" is a claim
about memory, not about time, and the gap there is not close:

| | naive | capped | bound now |
|---|---:|---:|---:|
| gzip, 1 MB ceiling | 148 MB | 1.5 MB | 16 MB |
| LZMA, 4 KB ceiling | 89.5 MB | 8.6 MB | 32 MB |

LZMA's is the narrower pair because it keeps a dictionary buffer that a 4 KB
ceiling does not shrink — tenfold rather than a hundredfold, hence the looser
bound. `tracemalloc` sees all of it because every buffer involved is a Python
`bytes`; a C library holding its own arena would be invisible, which `_peak_bytes`
says out loud for whoever reuses it next.

**Proved by mutation, which is the only evidence worth having here.** Changing
`dec.decompress(pending, CHUNK)` to `dec.decompress(pending)` — dropping the
output bound, so the member expands in one call and the length check fires
afterwards — leaves *"a gzip bomb is refused"* green and turns *"stops early"*
red. That is exactly the discrimination the wall clock could not make: the naive
version does refuse, it just refuses too late, and only one of the two assertions
was ever able to notice.

**One stale number went with it.** The end-to-end half of the same test called
`api_events` *"the smallest ceiling of any live feed, 8 KB"*. It has been 32 KB
since `37a4f77`, raised in the same session that wrote the comment. The figure is
read from `cap_for` now and the comment says what it used to claim, because a
number in prose beside the code that computes it is a number that will be wrong
again.

### The refresh can be driven from this machine, because GitHub's schedule is not a schedule

**Shipped 2026-09-03.** The owner asked whether forcing the build from outside
would work for Pages. It does, and the reason it was worth asking is that the
alternative had been written off too quickly — this entry corrects that as much
as it records the change.

**What was wrong with "build more often is spent".** The 2026-09-02 entry said
that option was unavailable because the cron is already `*/10` and the floor
belongs to GitHub. The first half is true and the conclusion was not: it is
GitHub's *scheduler* that is best effort, not GitHub's *runners*. A
`workflow_dispatch` is not in that queue. Measured against the ten-minute cron:
about one delivered run every forty-four minutes, worst gap two hundred and
sixty-eight. A request sent from the owner's machine turns the configured cadence
into the delivered one, and the remaining ceiling is Pages' own ~10 deployments
an hour — ten-minute triggers sit at six, inside it.

**The trap, and it is the whole reason this needed a workflow change first.**
`FULL` was `github.event_name != 'schedule' || ...`, so **every** dispatch took
the full path: the wiki, the drop tables and DE's export, re-downloaded. Firing
that every ten minutes would have been a straight breach of hard rule 11, and it
would have been invisible — the site would have got fresher while the sources got
hammered. The owner caught the same risk independently and from the other end
(*"I don't like the idea of a full rebuild every 10 minutes"*), which is worth
recording: the fix was already in, and two people arriving at the same objection
from opposite directions is the useful kind of agreement.

So `workflow_dispatch` gained a `full` input, defaulting **true** so the button in
the Actions tab behaves as it always has. Only a caller passing `full=false` gets
the light path — restore the cache read-only, then `build_data.py --if-changed`,
which is the export index, one HEAD to the drop table, the trader window and the
fissures, every fetch conditional. The heavy sources stay on the daily 18:05
build and on pushes.

**Where it is wired.** `tools/schedule.ps1 -DispatchRemote` registers a **second
action on the same task** rather than a second task — Task Scheduler runs actions
in order, and one task is one thing to remove and one place for the cadence to
live. `tools/schedule.sh --dispatch-remote` appends to the same cron line, joined
with `;` rather than `&&` **on purpose**: a local refresh that fails, on a machine
with no network, must not also cancel the request for the deployed site to
refresh itself. They answer different questions and neither is a precondition for
the other.

**Off by default, and that is not timidity.** It spends the owner's Actions
minutes and Pages deployments, needs the GitHub CLI signed in, and only helps
while the machine is awake. It is a supplement to the cron, not a replacement —
the cron still runs, still best effort, and still covers the hours this machine
is off.

**What it does not fix.** A published file is still only as fresh as its last
build. This raises the floor from "expired more often than not" to "at most ten
minutes stale while the machine is on", which is inside a fissure's lifetime and
therefore enough — but the only version that tracks a one-hour object
independently of any build is still the page reading a live feed itself, and that
remains an open decision in `TODO.md`.

### The tick re-ranks for everything on the clock, not just for bounty letters

**Shipped 2026-09-02**, from the owner asking the right question after the
fissure work: *what else changes the ranking without a UI element being clicked?*

**There was already a correct pattern, applied to one input.** `plan.js` runs a
thirty-second tick that compares `ROT.stamp()` — the letters of every clocked
bounty — and calls a full `render()` when it moves, falling back to repainting
`[data-until]` countdowns when it has not. That is exactly the right shape: a
re-rank on real news, a cheap repaint otherwise.

**It was watching one of four things.** The audit found the ranking reads the
clock in four places and the stamp covered the first:

| input | reaches the ranking through | was it watched |
|---|---|---|
| bounty rotation letters | `liveRotation` → `runValue` | **yes** |
| fissures | `fissureHere` → `runValue` | no — badge repaint only |
| event windows | `eventRunning` → `isEventNode` → `reachableSource` | no |
| Prime Resurgence window | the Aya block's `ayaRotationLive` | no |

So a fissure opening repainted a badge beside a rate that still assumed no
fissure, and the row never moved to where it now belonged — which is the whole
point of a ranked list. Both of the others are live questions rather than
hypotheticals: `meta.resurgence.expiry` was **2026-09-03T18:00Z**, the day after
this shipped, and `meta.bounties.events` already carries Plague Star for
**2026-09-09**.

**`ROT.clockStamp(fissures)` is the whole question now**, folding all four into
one string, and the tick compares that instead. It takes the fissure list rather
than reading it, because the module never owns that list — `fissuresAt` is handed
one too, and only the page knows which is current.

**What is deliberately *not* in it:** anything that changes only what a row
*says*. Countdowns keep their cheap repaint path. The test for inclusion is
whether it moves a number the list is sorted on, and the suite pins both
directions — a fissure whose only change is time-left must **not** move the
stamp, or the tick re-renders every thirty seconds and the reader's list re-sorts
under the cursor for nothing.

**The `anyClocked()` gate is gone**, and that was a real hole rather than
tidying: it asked whether any *bounty* was clocked, so a payload with no bounty
groups ran no tick at all — while fissures, events and the Resurgence window are
on the clock regardless. The gate could only ever answer a quarter of the
question it was standing in front of.

**The poller now re-ranks as well as repainting**, by registering the tick as a
second fissure watcher. It goes through the tick rather than straight to
`render()` so that `seen` is written where it is read; two writers and one reader
is how a stamp starts lying.

**One thing the audit expected to find and did not.** `app.js` registers no
fissure callback, which looked like the same defect one page over and is not:
nothing persistent on the collection page is painted from the list. `bestSpots`
is reached only through `spotsHTML`, and that only from `openItem` — so the array
is consulted when a drawer opens and by then holds whatever the last poll left.
The comment at the call site already said so. **Checked before changing it, and
left alone** — the entry that had claimed otherwise was wrong and was deleted
rather than shipped.

### A Steel Path fissure is not the ordinary node's fissure

**Shipped 2026-09-02**, from the owner's report that the site was naming missions
that were not live, and their own guess at the shape of it, which was right.

`build_fissures` carried `hard` from the worldstate into the payload correctly.
**Exactly one line read it** — a tooltip. `ROT.fissuresAt` tested node, storm and
expiry and never tested `hard`, so both pages counted a Steel Path fissure as a
fissure on the **ordinary** node: it changed the ranking through `fissureHere`,
and the badge said only `Lith fissure 45m`.

Measured while diagnosing it, 28 fissures live: **10 Steel Path, 6 Void Storm, 12
ordinary** — and **ten nodes carried a Steel Path fissure with no ordinary one**,
Hydron, Xini, Pago and Yuvarium among them. Ten rows claiming a fissure at a place
where, on the chart the reader was looking at, there was none.

**It was wrong for everyone, not only for players without the Steel Path
unlocked**, and that decided the fix. Steel Path Hydron is a different mission
instance from Hydron; running the ordinary node cracks nothing whoever you are. So
it had to gate the row rather than merely label it — a badge alone would have been
honest and still wrong.

**The shape was already in the same function.** `allowStorm` threads through
`fissuresAt` from `opts.railjack`, so a Void Storm answers to a switch. Steel Path
answering to nothing was a one-clause asymmetry, and the fix is the symmetric
clause plus the option that feeds it: `fissuresAt(list, node, now, allowStorm,
allowHard)`, `opts.steel`, `#p-steel`, defaulting off exactly as Railjack does.

**Both opt-ins are read as "may this be counted", deliberately.** A caller passing
neither gets the plain star chart, so a call site anyone forgets hides a real
fissure rather than inventing one — the safe direction, and the reason the
parameter is `allowHard` rather than `hideHard`. The collection page passes
`false` **explicitly** rather than relying on the omitted argument, because a
default that happens to be falsy is not a decision a later reader can find.

**And the badge names it as well as gating it**, because the tooltip is where a
reason belongs and not where a fact does: `Meso Steel Path fissure 1h 29m`.

**One test had to change, and it was the right one to have to change.** *A Steel
Path node is ranked, and says so on the row* asserted `#p-steel` did not exist —
a proxy for the 2026-08-14 decision that stopped being one the moment a checkbox
arrived for a different question. It now asserts the box exists and is off by
default, and keeps the assertions it always owned, which are about **sources**:
the Faceoff twin is still folded rather than filtered, with the box off. The new
behaviour is pinned in `test_assets.mjs` instead, against `fissuresAt` itself
rather than against the checkbox — the filter is what decides and the checkbox is
one caller. Mutating the clause to `(true || !f.hard)` turns it red, checked.

### What the verification sweep of 2026-09-02 confirmed

**A re-check of the 31 commits of 2026-09-01/02**, asked for by the owner the
morning after. The defects it found are in `TODO.md` under *Defects found by the
verification sweep of 2026-09-02*. This entry is the other half, and it exists
because **a sweep that records only what it broke misrepresents what it read.**
Most of what was claimed is true, and several figures reproduce to the digit.

Measured rather than read, in a browser against the served pages and in a shell
against the real tools:

| claim | how it was checked | result |
|---|---|---|
| read-only cache, "47 files, zero changed" | hashed every `.cache` entry, served pages, ran a full upstream check, re-hashed | **47 before, 47 after, 0 changed** |
| serve-then-refresh does not block | polled `/upstream.json` through a cold start | `{"ok":null,"checking":true}` then `{"ok":true,"stale":false}` — exactly the designed shape |
| connections capped at accept | opened 72 sockets and said nothing on them | **exactly 8 immediate 503s**, and a real request still served; full recovery after release, no slot leak |
| loopback only, exits 1 | ran `--host` with a LAN IP, `::`, `0.0.0.0`, `localhost`, `127.0.0.1` | first three refused, **exit code 1**; last two bound |
| six rounds restricted to premades | every farmable Prime wished, ranked list expanded | **116 places**, **0** six-round rows for randoms, **exactly 1** for a premade |
| `Skirmish` publishes no rotation for most nodes | parsed DE's own droptables Missions section | **24 of 40**, and `Key`/`Special` **0 each** — every sharp figure exact |
| the crack list says what the vault hides | computed the union of vaulted relics independently | **19**, and the page says 19 |
| the search's span rule | drove 19 queries including `.*`, `(((`, unicode and mixed case | refusal is *dynamic* — no word list — and no unescaped `RegExp` is built |
| the panel collision is fixed | measured geometry at 1280×900 and 375×812 | `.add-said` is `position:static` inside the panel; no overlap, no overflow, no horizontal scroll |

**Three things are worth keeping past the sweep itself.**

**The guard's own two changes are correct, and everything wrong with it is
older.** Every heredoc form is refused, and the read the old `WRITES` denied on
the `'a` of `assets` is allowed again. The ten bypasses found sit in `REDIRECT`,
`OVERWRITERS`, `EXEMPT` and `PATHISH` — none of which that commit touched. It is
worth separating those, because "the guard leaks" and "the fix did not work" are
different sentences and only the first is true.

**The regression was in the half that got quieter, not the half that got
louder.** `limits.py` was written to make oversized input safe and it does —
a 200 MB bomb is refused in milliseconds, boundaries are exact, every network
read is capped. What slipped through is a *truncated* body: `gzip.decompress`
raised, `gunzip_capped` returns the partial bytes. Hardening a path against one
failure mode is where a second one hides.

**A measured figure stopped reproducing within a day.** The six-round table's
four-round column reads 43/49 today against a recorded 44/50, while every other
cell and the 116-place total match exactly. Nothing on screen is wrong and the
decision stands; one endless node moved in a daily rebuild. **A table of live
measurements needs the payload's build stamp beside it**, or its next reader
cannot tell drift from a broken model.

**And the sweep itself is evidence for the browser rule.** The static checks that
matter here — `node --check`, `ast.parse`, the XML test — pass on all of this and
say nothing about any of it. The connection cap, the read-only cache and the
panel geometry each needed the thing actually running.

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
4. **DE's `worldState.php` is 404** on both `content.` and `origin.warframe.com`
   — and **not on `api.warframe.com/cdn/`**, which serves the whole thing and was
   doing so all along. Found 2026-08-27, when the warframestat `/pc` proxy started
   answering `404 {"error":"No such worldstate field"}` on every platform and the
   live feeds had nowhere else to go. Until then this gotcha said the proxy "is the
   only working route", which is what two failed hosts had been read as proving.
   `TODO.md` has the adapters that route needs; the proxy stays as the fallback.
5. **DE's LZMA streams break Python's strict decoder.** `index_en.txt.lzma` is
   LZMA-alone with a declared size that `lzma.decompress` rejects as corrupt. Blank
   the 8-byte size field to `\xff` and trust the end marker — `official.decode_index`
   does this.
6. **Export names carry internal tags**: `"<ARCHWING> Odonata Prime"`. Strip the
   leading `<…>` or every archwing looks like a brand-new Prime.
7. **Wiki images return HTTP 403**, with or without the `?hash` query. Artwork comes
   from `cdn.warframestat.us/img/<imageName>` using the exact casing the items API
   reports (`AshPrime.png`, not `ash-prime.png`).
   This said *"to anything that isn't a real browser session"* until 2026-08-28, and
   that half was an interpretation rather than an observation. The 403 was measured;
   the cause was not. Evidence gathered while chasing the same status from
   `api.warframe.com` points at **the edge refusing an address range** — DE sit
   behind Akamai, a datacentre IP draws `403 / Server: AkamaiGHost`, and the same
   request succeeds from a residential connection. If that is the mechanism here too
   then **changing the user agent cannot help and changing the origin might**, which
   is the opposite of what the old sentence implied. See `TODO.md`, *Digital Extremes
   403 the GitHub runner*.
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
