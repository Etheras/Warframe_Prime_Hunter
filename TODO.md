# TODO

Everything still outstanding in Warframe Prime Hunter. **Only unfinished work
belongs here** —
when something ships, delete its entry rather than ticking it, and record *why* it
was done that way in `PROJECT.md` if the reasoning matters. Settled design
decisions are not TODOs and live in `PROJECT.md §7`.

Roughly ordered by what is worth doing first. Each entry should make sense to
someone who has never seen this project before; if it needs conversation context to
understand, it needs rewriting.

Entries marked **[settled]** are not open work. They are questions that have been
asked and answered, kept only so the answer is not lost and the question is not
raised again from scratch. Everything else is genuinely outstanding.

**Swept 2026-08-15.** Ten entries headed *[done]* were deleted and their reasoning
moved into `PROJECT.md` — the ten decisions of 2026-08-14, the rename runbook, the
`serve.py` allowlist, the banner's owner flag, the cache penalty, pre-refined
relics, Profit-Taker, and the reachability rule. Keeping a shipped entry "for the
argument it settles" is exactly what the rule above forbids, and the argument is
worth more in the document people read to understand the code.

**Added 2026-08-24.** Fifteen entries from two outside reviews, each checked against
the code before being written down — they have their own section below, kept
together because the corrections only make sense beside the claims they correct.

**Added 2026-09-01.** Nine entries from the independent security re-review dated
2026-08-28, each re-checked against the working tree before being written down —
they have their own section, and it sits first because security does.

**Swept the same day.** Seven entries shipped and were deleted: the four akimbo
Primes whose second sub-weapon could not be recorded, the availability filter that
hid items with a second source, the drawer that threw away the focus, the
Profit-Taker phase costed at four stages, the missing fourth run mode on the
collection page, the two pages naming different nodes for one folded group, and the
clocks that stopped dead in a background tab. The reasoning moved to `PROJECT.md`,
which is what the rule at the top of this file asks for.

---

## What is open, at a glance

**Swept against the code on 2026-08-26.** Every row below was checked to still be
true; the cadence row changed shape and the Mastery Rank row shipped.
Titles are given verbatim so they can be grepped — each one is a `###` heading
further down, where the reasoning lives.

**Five rows added 2026-09-04**, under *Findings of 2026-09-04*. Three came from
the owner watching the thing run for two days, which found what no local suite
was ever going to:

| Entry | What it is | Size |
|---|---|---|
| ~~The freshness fingerprint asks DE directly~~ | **fixed 2026-09-04**, same day it was reported; reasoning in `PROJECT.md §7` | done |
| ~~The scheduled task steals focus every ten minutes~~ | **fixed 2026-09-04** with `conhost --headless`; reasoning in `PROJECT.md §6` | done |
| ~~An anchor for the ten-minute refresh, from the data rather than a grid~~ | **decided and shipped 2026-09-05**: no derived schedule, but the grid moved two minutes off the hour; reasoning in `PROJECT.md §7` | done |
| The daily FULL build's anchor is not being delivered | found while answering the above — GitHub ran that cron on none of the six days visible; the remedy spends build minutes | owner's call |
| Baro's relic should live only while he is on the relay | **decided and shipped 2026-09-04**; reasoning moved to `PROJECT.md §7` | done |
| Vendor `ItemType` paths have a general rule, and we found one case of it | reference read from two MIT repos; nothing copied, pending approval | note |

**A row was added on 2026-08-26 and deleted on 2026-08-27**, in the same two days
that produced it: *The standalone runs both pages' wiring twice, and it shows*
came from the first session that ever drove the built single file in a browser
rather than reading it as text, and it named seven defects confined to `dist/`.
All seven shipped, the reasoning is in `PROJECT.md §7`, and the page tests now
open `dist/warframe-prime-hunter.html` and press its buttons — which is the part
worth keeping, because the gap was never any one of the seven.

**A row added in its place lasted a few hours**: the two pages restored a
self-contradictory backup differently from each other, found while proving that
fix. It is settled and gone too — neither page corrects such a file now, both
report it in the same words, and `PROJECT.md §7` has why the reasoning behind the
old behaviour was wrong about its own cause.

**Neither is what those two days left behind.** That is a cadence rather than a
backlog row: a security audit and a feature-usability audit, monthly, both
baselined 2026-08-27 and both next due 2026-09-27, postponed a month whenever no
commits have landed. It lives in `PROJECT.md §2` and has no entry here, because a
recurring obligation is not outstanding work — it is due on a date, and that date
is written where the rule is.

*Size* is honest rather than optimistic: **small** is a few lines and one file,
**session** is an afternoon including the test, **large** touches the pipeline, the
payload and both pages.

**This file no longer claims that nothing is wrong on screen.** It said so on
2026-08-24 and a sweep the next day found two things that were; it said so again on
2026-08-25 and the cadence sweep of 2026-08-26 found six mission types costed at a
third to a fifth of what the wiki says they cost, two of them the largest modes in
the dataset. The claim has now been wrong twice running, which is enough. **What is
true is narrower and worth stating instead:** every defect anyone has actually
identified is either fixed or has an entry below. Whether the ranking is *right*
turns on the open question in *A round is not a universal unit of effort*, and
until that is settled nobody should write the reassuring sentence again.

Four defects shipped that day and their entries are gone, with the reasoning in
`PROJECT.md §7`: both Onslaught nodes ranked at twice their true rate; 38 live
nodes costed as endless when they are not; the *Still needed* panel counting
relics the reader's own switches had turned off; and an opt-in gate standing in
front of the only route six Primes have.

That family is closed. The last of it was not a wrong number but an unreachable
one: **Spy nodes and the eleven pre-refined nodes never appeared in the rows
either page rendered**. The planner's ranking can now be expanded in place, which
puts all 92 places on screen — Elite Sanctuary Onslaught at #38, and Pago and Bode
the first Spy nodes either page has ever shown.

**Both lists can now be seen whole** — the drawer got the same treatment the same
day, so Spy nodes and the pre-refined eleven are reachable on either page.

### Security

Nine findings from the re-review of 2026-08-28. **No Critical and no High** —
both Highs from the previous review were re-tested and are fixed. These come
first in this file because they are security work, not because any of them is on
fire.

**Two of the nine were already asked and answered**, by the owner on 2026-08-26,
and are marked below rather than re-opened — the second review re-filed them
without knowing they had been declined. **A tenth entry was here that neither
review filed**, found while checking one of those two against the code, which is
the same way four of the first review's twelve outcomes arrived.

**Seven shipped on 2026-09-01** and their entries are gone, with the reasoning
in `PROJECT.md §7`: the mutable action tags, the non-atomic feed-log write, the
privacy footer naming a host the site never contacts, the unvalidated `filters`
section of a backup, **the wiki job's repo-writing token, now held by a job that
runs no build**, **the unbounded downloads and decompression, now a ceiling per
source at twice what it measures**, and **LAN mode, which was removed rather
than documented** — the review offered "say so" or "add HTTPS" and the owner
took neither, so `serve.py` is loopback-only and refuses to bind anything else.

**An eighth shipped in half.** The freshness stampede is gone —
serve-then-refresh, one background check, the page polling until it settles —
and what the fix *guards rather than removes* keeps the entry: page serving
still writes the builder's cache. The entry was renarrowed rather than deleted,
which is the honest shape when a finding had two bullets and one of them
shipped.

Five things worth carrying forward, because none was in the findings:

- **The footer could not have been fixed by correcting the footer.** The payload
  field it read was a single string chosen by whether artwork is local, and a
  build can use both hosts. The field had to be able to say so first.
- **The `filters` gap was narrower than filed.** The collection page already
  validated every one of those keys where it read them, `sort` included. What
  shipped is consistency inside `parseBackup` and defence in depth, not a hole
  being closed — see the note in `PROJECT.md §7`, which says so rather than
  claiming the larger win.
- **Removing a feature was on the table and nobody had offered it.** Both
  reviews and this file framed LAN mode as a documentation-or-encryption choice.
  It was neither: the mode bought a convenience and cost a paragraph the reader
  had to weigh correctly at the wrong moment, so it went. Worth remembering the
  next time a finding arrives with two options in it.
- **The wiki fix was not the fix that was asked for.** Both the review and this
  file said "confine `contents: write` to the step that pushes", and GitHub has
  no per-step permissions — the scope is per job and per workflow, nothing
  finer. The available fix was a second job, which is a bigger edit than the
  wording implied and buys the same thing. A finding phrased as a small change
  is not evidence that a small change exists.
- **The ceilings are tight because refusing is cheap, not because the numbers
  are confident.** The owner chose twice each measured figure where this file
  had proposed three times. That is only safe because an oversized response
  takes the path a failed fetch already takes — next host, then the cached copy,
  then `meta.stale` — so a ceiling set too low costs a stale build and a named
  log line rather than a broken one. **Read a "source over its ceiling" line as
  "raise the number", not as an attack.** `de_worldstate` is the one most likely
  to say it, because it carries whatever events are running.

| Entry | Size |
|---|---|
| A backup import will read a file of any size **[settled — declined 2026-08-26]** | not open — re-filed unchanged by the second review; the answer is in `PROJECT.md §7` |
| `gunzip_capped` turns a refused download into a short one | small — **the one regression of 2026-09-01**; a truncated body now returns partial bytes where the stdlib raised |
| The wiki-permissions test matches spellings, not the property it names | small — the job split is real and verified; the test is not what holds it |
| The pin count in `dependabot.yml` was stale the day it was written | small — nine claimed, eleven actual, all correctly pinned |

### The worldstate is already cached, and barely read

**Mostly read now.** The sweep of 2026-08-24 took the rotation letter per tier, the
stage counts and the bounty levels; `PROJECT.md §7` records what that corrected.
What is left of the entry is two fields and a warning about one of them.

| Entry | What is left | Size |
|---|---|---|
| The worldstate publishes far more than the two fields we read | `type` (with a trap in it) and `rewardPoolDrops` as a cross-check | session |
| Baro's actual stock is published, and never read | **read 2026-09-04: 41 rows, one relic — `Axi M5`, resolved first-party.** No longer blocked on a window; what is left is whether to build it | session |

### Model and ranking

| Entry | Size |
|---|---|
| Seven rotation-bearing mission types are still unverified | **five now** — `Legacyte Harvest` verified AABC, `Skirmish` undocumented, `The Circuit` disputed; checked 2026-09-02 |
| `The Circuit` may be two different modes wearing one name | **the owner's, to settle in game** — the wiki and DE's tables describe different things |
| `The Perita Rebellion` is a time box, and the model has no clock for it | **tried and reverted** — the obvious fix halves the default case; left as it is on purpose |
| `RUN_OVERHEAD` is two *rewards* on a node where a reward is two zones | small — no effect today, left open on purpose |
| Our four invented "mission types" leak into the ranking | **checked 2026-09-02** — every consequence is already handled and now guarded by a test; what is left is the architecture, not a defect |
| Baro's item-level marker still over-claims, and now there is a number for it | the relic half shipped 2026-09-04 and the "how often" question is settled from the wiki's own per-visit history — 271 of 313 visits carry no relic at all |
| What the misses are worth, in Ducats | session |
| What the misses are worth in Platinum, from warframe.market | session — the owner's, 2026-08-27; a new source tier, and the percentile needs settling |
| A concentrated farm finishes a relic sooner than a diluted one | session — needs a size chosen by hand |

**Two of this table's rows shipped on 2026-08-27** and their reasoning is in
`PROJECT.md §7`: the unit question — *an objective is one reward draw* — and the
fixed cost of a run, which was gated by it. What is left is no longer gated by
anything.

**The one live defect in this table shipped on 2026-09-01** — *Two relics that pay
the same part are counted as two*, the double-count that put Apollo (Lua) at the
top of a farm list where one of its two relics paid nothing the other did not.
`PROJECT.md §7` has the reasoning, the two claims that entry had wrong, and why
the union fix it named first would have made the ranking worse rather than
better. **Everything left in this table adds something rather than correcting
something**, which is a different kind of choice. That is not the reassuring
sentence: this file has twice claimed nothing was wrong on screen and been wrong
both times, and the entry that just shipped was found by the owner reading the
app rather than by anything written here.

*Seven rotation-bearing mission types* is what remains of the entry that gated the
unit question — tedious rather than hard, and blocking nothing.

**One measurement in this family stopped reproducing** and was **settled
2026-09-05** — reasoning in `PROJECT.md §7`. Short version: the four-round column
has read 43/49 on every re-run since 2026-09-02, across a Resurgence rotation
flip, so the missing row was one event rather than drift. The useful finding was
elsewhere — the table's real omission was not the build stamp but the **state of
the fissure feed**, which changes every figure in it and was recorded as an
observation rather than a precondition.

### Interface

| Entry | Size |
|---|---|
| Digital Extremes 403 the GitHub runner | **watching** — the defect is fixed and verified on CI; the 403 is frequent, so the deployed site's live feeds now lean on WFCD |
| One Cambion Drift tier labels a different letter from the rest of its family | **checked 2026-09-02** — not a misfile; the letter is per tier and the family split is an approximation. Costs nothing today: that tier carries no relic |
| The page tests flake in a full run and pass on their own | watching — a third occurrence 2026-09-04 named `ERR_NO_BUFFER_SPACE`, the first evidence pointing at socket exhaustion rather than timing |
| A backend refresh finds new fissures and the ranking does not move | session — the deliberate half of this is the hard half |
| A vaulted relic on a Prime you *can* farm another way is still hidden | **half shipped 2026-09-02** — the list now says how many it is hiding; the *"I have vaulted relics"* switch is still undecided |
| The rest of the player facts the header could hold | session — the rank itself shipped 2026-08-26 |
| A priority flag on the farm list | session |
| The deployed site shows no fissures for hours at a time | session — what is left of the owner's 2026-09-02 report once the Steel Path half shipped (`PROJECT.md §7`); 31 published, all expired, 28 running. Decide *build faster* vs *the page reads a live feed* first |
| Kavasa Prime Collar's search rows stutter its name | small — the only item of 167 whose part names carry the item name |
| The server's own 404 page violates the CSP it sends | small — an inline `style` its own `style-src 'self'` blocks |

### One refactor

Done on 2026-08-24 — the three slices of state moved into `shared.js` and both
drifts it had cost went with them (`PROJECT.md §7`). One residue, deliberately
left: the planner's wishlist lists only the parts you are missing, so a completed
part's button leaves the list and the counter has nowhere to wrap. Correcting a
mis-click there still means opening the item on the collection page — a property
of a worklist, not of the click, and worth deciding on its own merits.

### Cannot be finished today — and why

| Entry | Waiting on |
|---|---|
| Plague Star and Profit-Taker are the same shape, modelled two ways | **Plague Star, and it has a date: 2026-09-09 to 2026-09-23** |
| The Ghoul and Plague Star detection has never seen a live event | **2026-09-09 to 09-23.** The `tag` half is **done, 2026-09-04** — it was coverage rather than code, and it found that DE's path form was untested and the tag branch untested. What is left needs the event |
| Expected openings for everything, not for the worst one — measured, and it costs traces | nothing — *are you trace-limited?* was answered at 500 on 2026-08-25; this is now ordinary work |

**Two of those three now have a date, given by the owner on 2026-09-02 from DE's
own announcement: Operation Plague Star runs 2026-09-09 to 2026-09-23, all
platforms.** That is the first time anything in this table has had one.

**What it is worth doing before the 9th, rather than during it.** The window is
two weeks and the observation itself is a few minutes, but it can only be made
while the event is live, and the thing being observed is *what the worldstate
looks like* — which cannot be reconstructed afterwards from a memory of having
looked. So the preparation is the part with a deadline:

- ~~**Land the `tag` half first.**~~ **Done 2026-09-04, five days early.** The
  matching it asked for already existed; what was missing was coverage, and
  writing it found two untested things — DE's `Desc` is an internal path where
  every test fed prose, and the tag branch had never been exercised at all
  because `EVENT_TAGS` is empty until something is seen. Both are tested now,
  and the entry below records a third finding that is **not** fixed: the
  syndicate half of the detector cannot fire when DE answer.
- **Capture the tag itself when it appears.** The build already logs
  `bounties: ! <event> is running and DE tag it '<tag>'`; put that tag into
  `EVENT_TAGS` as a fact. Nothing else in the window is cheaper or more durable.
- **Capture the whole entry, not the answer.** Save the raw `/pc/events` and
  `/pc/syndicateMissions` rows for Plague Star verbatim into `PROJECT.md` — `tag`,
  `node`, `maximumScore`, `interimSteps`, `rewards[]`, `activation`, `expiry`. A
  future question about the shape is then answerable without waiting for 2027.
- **Check the detection actually fires**, on the deployed site and locally: does
  `eventRunning` see it, does the Plague Star bounty leave the *include event
  nodes* gate, and does the Hemocyte row stop being unreachable.

**The second date on this page was Baro, 2026-09-04 to 09-06, and it has been
kept.** His manifest was read at 13:24Z on the 04th, 24 minutes into the window:
41 rows, one of them a relic, resolved first-party to `Axi M5`. Both Baro entries
carry the measurement and neither is waiting on a window any more. He empties
again at 2026-09-06T13:00Z and returns around 09-18, so **anything that wants a
live manifest as a test fixture has to be committed before the 6th** — the raw
captures are in a session scratchpad, not the repo.

*Seven rotation-bearing mission types* used to sit in this table waiting on "wiki
checking; tedious, not blocked". **The wiki checking was done on 2026-08-26** and
the entry moved up to *Model and ranking*, because what it is waiting on now is the
owner, not the wiki. Seven mission types that carry no rotation confirmation at all
are still unverified and are still tedious, but they are no longer what blocks it.

### Not work

The availability precedence asks for something that is **already true** — see its
entry. *Conditioning the fissure bonus on a live fissure* was **[settled] against**
and then done anyway on 2026-08-24, at the owner's direction — the entry is gone
and `PROJECT.md §7` records both the reversal and what it cost.
Six answered questions sit under **Settled**; the one that was partly reopened had
its open half closed on 2026-08-24, and what remains of it is a note explaining why
Railjack levels are absent on purpose. Four wiki edits sit under **Should be fixed
on the wiki, not here** — those are edits to `wiki.warframe.com`, not to this
repository.

---

## Security — the re-review of 2026-08-28

**The second independent security review of this project**, against commit
`16ee027` and compared against the commit the first one read. It found **no
Critical and no High**. Both Highs from the first review were re-tested and are
fixed: the remote artwork filename that could escape `assets/img`, and the
stored DOM XSS through numeric fields with no CSP behind it. What is left is
five Medium and four Low, and not one of them is an observed compromise — they
are the software supply chain, resource limits, LAN mode, and two sentences that
describe the app inaccurately.

**All nine were re-checked against the working tree on 2026-09-01**, after the
four commits that have landed since the reviewed one, and all nine are still
true as descriptions of the code. The line numbers below are this tree's;
several had drifted from the review's by the time they were checked, which is
the usual reason to re-derive them rather than copy them.

**Still true is not the same as still open.** Two of the nine — the unbounded
backup import, and non-atomic writes — are things the owner examined and
**declined** on 2026-08-26, after the first review filed them. The second review
had no way to know that and filed them again. They are marked below rather than
re-opened, with the answer left where it lives in `PROJECT.md §7`; the
atomic-writes one is narrowed to the single write site that genuinely postdates
the decline. **A tenth entry follows them that neither review filed**, found
while checking those two against the code.

**The review's assurance gap is already closed and has no entry here.** It
reported the release gate red — one cadence assertion and four wiki-generation
assertions — and it no longer is: `python tests/test_build.py` was run on
2026-09-01 and passed, with `clone-and-build` skipped for want of `--online`.
The cadence assertion went green when the light refresh went back to ten minutes
(`070f527`), and the four wiki assertions when the standing notices started
being found by shape rather than by position (`a67b6d5`, `4947bca`). The
*shape* of the cadence test is still wrong and keeps its own entry — *The
schedule tests assert equality where they should assert a ceiling* — but being
wrong is not the same as being red, and it is no longer red.

### A backup import will read a file of any size **[settled — declined 2026-08-26]**

**Not open. Do not re-file it.** This is `L-09` from the first review, filed
again as `L-03` by the second, and the owner examined and declined it on
2026-08-26. The reasoning is in `PROJECT.md §7` under *Two security findings
examined and declined*, and it is worth reading rather than re-deriving: there
is no adversary in it, both import handlers already wrap `parseBackup` in
`try`/`catch`, every loop in the parser is linear so a hostile file buys nothing
a merely large one does not, and **the file picker is not a distinct surface**
— the same text pastes straight into `#dataArea` with no file at all, so a cap
on the picker would not remove the behaviour described.

The second review adds nothing the decline did not already answer. It repeats
the same evidence (`assets/shared.js` around the `FileReader`, `model.js`'s
parser), reaches the same severity, and suggests the same 5 MiB ceiling.

**It is kept here, rather than deleted, precisely because it has now been filed
twice.** A third review will file it again. The entry costs a paragraph and
saves the next reader the work of re-deciding it.

The one thing that came out of looking properly the first time was a *different*
gap — `filters` and `sort` adopted from a backup without validation. **Half of
that shipped and half did not**, and the pointer to it has rotted; see the entry
below.

### A backup's `filters` are adopted whole, and the entry saying so is gone

---

## Defects found by the verification sweep of 2026-09-02

**A re-check of the 31 commits of 2026-09-01/02**, asked for by the owner after
the session that wrote them. The suite was green (`clone-and-build` the only
skip) and CI green on every commit, so nothing here was failing — which is the
point of the sweep and the reason it is worth writing down what it *did* find.

**What was confirmed working is longer than what follows and is in
`PROJECT.md §7`**, because a verification that only records defects reads as if
the session went badly. It did not: the six-round restriction, the read-only
cache, the connection cap, the loopback refusal, the vault-hidden count, the
search's span rule and the mission-type figures all reproduce exactly, several
to the digit.

**One of these is a regression the session introduced.** The rest are
pre-existing gaps the session walked past, or sentences it wrote that were
already false. They are separated below because the distinction decides urgency.

### `gunzip_capped` turns a refused download into a short one

**The one regression, and the only entry here that is new damage.**
`tools/limits.py:172` replaced `gzip.decompress` with an incremental
`zlib.decompressobj` so a bomb could be stopped mid-expansion. That part works
and is measured. What went with it is the *end-of-stream check*.

Measured on 2026-09-02, same input to both:

| input | `gzip.decompress` | `gunzip_capped` |
|---|---|---|
| truncated stream | raises `EOFError` | returns **271 of 514 bytes** |
| two concatenated members | returns both | returns **the first only** |

`dec.eof` is `False` in the truncated case, so the fact is available and simply
never consulted, and `dec.unused_data` holds the second member. A truncated
download used to be a loud failure that fell through to the cache; it is now a
short document that looks complete. Most of our sources are JSON and a truncation
would fail to parse — which is why this has not shown — but the ceiling work
exists precisely to make malformed upstream input safe, and this is the one path
where it made it quieter instead.

**Size: small.** `if not dec.eof: raise` after the loop, plus a loop over
`unused_data` for the multi-member case, and a test for each that feeds a
deliberately truncated body.

### The pin count in `dependabot.yml` was stale the day it was written

The comment says *"The nine `uses:` lines in publish.yml and wiki.yml"* and
*"five distinct actions"*. The same session's job split made it **eleven lines**,
all SHA-pinned, and seven distinct actions. Measured: `grep -c "uses:"` gives 11,
and all 11 match `@[0-9a-f]{40}`.

Nothing is broken — the pinning itself is right and the repository-level policy
is genuinely on — but a number written into a comment in the same commit that
changed it is the drift shape this project keeps finding.

**Size: small.**

### The wiki-permissions test matches spellings **[fixed 2026-09-04]**

Now an allowlist, as this asked: every executable the write-token job invokes
must be one of `{git, cp, rm, echo}`, every action it uses must be named, and
every action must be pinned to a 40-character SHA. Verified by planting exactly
the mutations the old test allowed — `curl … | sh`, `node build.js`, and an
unpinned `some-org/some-action@v3` — and watching three assertions fire that
previously would not have.

Two details worth keeping. The commit message is stripped before the script is
read, because it names `tools/wiki.py` and reading that as "it runs the build" is
a false positive this test had already produced once. And `\` continuations are
skipped, or the URL on the second line of `git clone \` counts as an executable.

### Two figures the workflows reason from were wrong **[both fixed 2026-09-04]**

Kept only to record that the first one **fixed itself** and this entry was the
stale thing by the end.

- **`144 runs a day`** was called "four to six times what GitHub delivers, the
  feed log holds 23 rows". Re-measured 2026-09-04: the log holds **131 rows in
  24 hours**. The figure became roughly true when the `workflow_dispatch` from
  the owner's machine started forcing the refresh GitHub's scheduler drops — six
  an hour while that machine is awake, nought or one while it sleeps. So the
  number is right and the *reason* was wrong, which `PROJECT.md §6` now states
  with the measurement.
- **The "usually superseded" advice** is corrected, and the count was worth
  making exactly: **six red scheduled runs in the repository's history, five of
  which ran all sixteen steps and failed on `Run the tests`.** One was
  superseded. The distinguishing signal is in the comment now — a superseded run
  ran **no steps at all**, so `gh run view <id> --json jobs` settles it in one
  command.

### Smaller things, all confirmed

- **Kavasa Prime Collar's search rows stutter its name.** The planner's result
  label is item + part, and Kavasa is the **only item of 167** whose part names
  already carry the item name, so it reads *"Kavasa Prime Collar Kavasa Prime
  Band"*. It is also the one item with no DE recipe, which is why it is odd.
  `plan.js:2192`. **Size: small** — drop the item prefix when the part name
  already starts with it.
- ~~**The server's own 404 page violates the CSP it sends.**~~ **Fixed
  2026-09-04.** One correction to the report: it is an inline `<style>` *element*,
  not a `style=` attribute — Python added it to `DEFAULT_ERROR_MESSAGE` in 3.11
  to set `color-scheme`. `SiteHandler` overrides the template rather than
  widening the policy for an error page. Verified against a real 404 from a
  running server: no `<style>`, CSP header still sent. The test asserts the
  override differs from the stdlib default, because the failure mode is the
  override going away, and then the wrong answer is the *absence* of code.
- ~~**`wiki.yml` interpolates `${{ github.repository }}` into a shell command
  line.**~~ **Fixed 2026-09-04**, through `env:`. It was a shape rather than a
  hole, and the shape is the part that gets copied — the next expression pasted
  in beside it may be a branch name. A test now asserts **both** workflows have
  no expression inside any `run:` block.
- ~~**`PROJECT.md`'s *"between 12% and 49%"*.**~~ **Fixed 2026-09-04.**
  Re-measured across all 24 cached sources: **9.1% to 49.0%**, nothing above
  half. `api_events` is the 9.1% and is roomy on purpose — it was sampled with
  no limited-time event running.
- **The `limits.py` comments: one was wrong, and not the two claimed.** Both
  named locations were checked. The `Refused` docstring is accurate — both
  callers catch the base class and neither branches on a subclass. The live-feed
  note is accurate too: every row is at least twice its largest sample. What
  *was* wrong is the **table header**, which said the ceiling is the measurement
  "doubled and rounded up" while nine catalogue rows sit at 2.0–2.2x and
  `api_fissures` is 4.5x, `api_vaulttrader` 4.1x, `api_events` 10.9x and
  `export_index` 8.4x. The header and the note below it contradicted each other.
  **Fixed 2026-09-04**, with the ratios written down.

### The deployed site shows no fissures for hours at a time

**Reported by the owner on 2026-09-02** as a wrong fissure rotation on the
GitHub Pages site, and measured the same hour. It is not a wrong rotation
*letter*: it is the whole list, and the site's answer is **none**.

At 15:52Z the deployed `data/fissures.json` held **31 fissures generated at
13:47Z, every one of which had already ended** — the last at 15:19Z. Live at
that moment, read straight from the same upstream the build uses: **28**. So the
site said there was nowhere to crack a relic while twenty-eight places were
running.

**The page is not at fault and that is worth stating**, because it is the part
that looks broken. `ROT.fissuresAt` filters on `Date.parse(f.ends) > now` and
`paintFissures` repaints on a timer, so an expired fissure is dropped rather
than displayed. That is why the failure shows up as *nothing* instead of as a
list of places that closed two hours ago — the honest shape, and still a wrong
answer to the only question the feature exists to answer.

**The cause is cadence, not the 403.** The published file can never be fresher
than the last build, and `watchFissures` fetches that same static file, so a
page left open all afternoon re-reads one 13:47 snapshot. Build gaps reach
**268 minutes** against a fissure life of one to three hours, so the list is
routinely expired in full before the next run. Digital Extremes did not answer
the runner once in 17.7 hours — every build used the proxy — but that is the
known 403 and it is *not* this: the proxy's fissure data was correct when it was
fetched. It simply aged out.

This is the same root as *`144 runs a day` is four to six times the cadence
GitHub delivers*, and this is what that costs in the product rather than in a
log.

**Half of this shipped on 2026-09-03 and the entry is narrowed rather than
closed.**

- **Build more often — ~~spent~~ shipped, as an opt-in.** This entry said the
  option was unavailable because the cron is already `*/10` and the floor belongs
  to GitHub. **That was wrong and the owner caught it**: it is GitHub's
  *scheduler* that is best effort, not its runners, and a `workflow_dispatch` is
  not in that queue. `tools/schedule.{ps1,sh}` can now fire one on the same
  ten-minute tick that refreshes the local copy — `-DispatchRemote` /
  `--dispatch-remote`, off by default. `PROJECT.md §7` has the reasoning,
  including the trap that made it a workflow change rather than a one-liner: every
  dispatch used to take the *full* path, so firing one every ten minutes would
  have re-downloaded the wiki and the drop tables that often.
  **What is left of this bullet is a limit, not a task**: it only helps while the
  owner's machine is awake, so the hours it is off are still covered by the same
  best-effort cron as before. Whether that is enough is a judgement to make after
  living with it, and there is nothing to build until it is made.
- **Let the page read a live feed itself. — kept open, and expected to be
  withdrawn.** The only version that tracks a one-hour object independently of
  any build. It is also the bigger decision: `connect-src 'self'` forbids it
  today, the privacy footer names the hosts the *build* contacts and would have
  to name one the *reader* contacts, and rule 11 becomes a question about a
  browser's request rate rather than a build's.

  **This is on watch rather than on the list.** The dispatch shipped the same
  day, and the first measurement after it is not close: at 21:15Z the deployed
  file was **2.4 minutes old and carried 25 fissures, all 25 of them live** —
  against 2.1 hours old, 31 published and **none** live the previous afternoon.
  If that holds, the problem this bullet exists to solve does not, and the
  honest outcome is to delete it rather than to build it.

  **What would have to be true to withdraw it**, so the judgement is not made on
  a good afternoon: the deployed file stays inside ten minutes across a normal
  week, including the hours the owner's machine is asleep, and no reader-facing
  symptom survives. **What would keep it**: gaps that reopen whenever the machine
  is off, which is the one hole the dispatch cannot cover by construction.
  Re-read this entry once there is a week of evidence — not before, because one
  afternoon is how the ten-minute cron looked too.

**What is actually open is now one thing: the live feed, and only if the opt-in
above proves not to be enough.** Size: session, and the decision still comes
first — it is a CSP change, a privacy-footer change and a rule 11 question about
a browser's request rate rather than a build's, none of which should be started
on a hunch. Give the dispatch a few days first; *"at most ten minutes stale while
the machine is on"* may simply be the answer, in which case this entry closes
without the second half ever being built.

A third option worth naming only to reject it: publishing an emptier list is not
better, because the page already renders the empty case correctly and the reader
still learns nothing.

---

## Findings of 2026-09-04

### ~~An anchor for the ten-minute refresh, from the data rather than a grid~~

**Decided and shipped 2026-09-05**, reasoning in `PROJECT.md §7` under *The
refresh grid moves two minutes off the hour*. The answer to the question as
asked was **no** — every boundary this dataset names already falls on a UTC hour,
so the grid reaches all of them, and a derived schedule would cost DST fragility
and fourteen firings per useful one for a fortnightly trader. What was actually
wrong was the grid's **phase**: it sat on `:00` and fired 2–3 seconds after each
tick, inside the sixty-second cycle DE regenerate the worldstate on, so the one
run that read a turnover usually read a copy stamped before it. The default
moved to `:02` in both schedule scripts and is pinned by a test.

**What is left of it is a different question and is below**: *The daily FULL
build's anchor is not being delivered*. The rest of this entry is kept because
the patch-cadence measurement in it is still the reason nothing is scheduled
against DE's release times.

The boundary is **18:00 UTC exactly** and is published rather than inferred:
`PrimeVaultTraders[0]` carries `Activation 2026-09-03T18:00:00Z` and
`Expiry 2026-10-01T18:00:00Z`, so nothing has to guess when a rotation turns
over. The daily FULL build is anchored to it, and moved from `40 18 * * *` to
**`5 18 * * *`** on 2026-09-04 at the owner's direction — forty minutes was
arbitrary and left the site a rotation behind for most of an hour. It is the
ten-minute path that still flies blind.

**And DE's patch cadence is not a second anchor, because it is not anchorable.**
Measured 2026-09-04 from `Last-Modified` on the export manifests DE publish —
seven distinct publications, HEAD only, and only on manifests this project holds
no freshness window for:

| UTC | Day | US Eastern |
|---|---|---|
| 2025-03-27 14:18 | Thu | 10:18 |
| 2025-06-24 20:59 | Tue | 16:59 |
| 2026-06-18 20:51 | Thu | 16:51 |
| 2026-06-23 18:36 | Tue | 14:36 |
| 2026-06-25 20:33 | Thu | 16:33 |
| 2026-08-12 13:13 | Wed | 09:13 |
| 2026-08-19 17:12 | Wed | 13:12 |

**Tue/Wed/Thu only, never Fri to Mon, and always inside US Eastern office hours**
— which is an eight-hour spread in UTC (13:13 to 20:59) with no fixed time in
it. So there is nothing to schedule against, and nothing needs to be:
`--if-changed` fingerprints the export index and the drop table, so the
ten-minute build already detects a patch within ten minutes of whatever hour it
lands. The daily build's unique job is the **wiki**, which is not fingerprinted
and which editors update over the hours *following* a patch — a daily cadence
suits that and the hour does not change it.

Today the light build runs on `*/10`, a
blind grid with no relationship to when anything upstream actually changes. Every
feed we publish carries its own expiry: fissure `ends`, `meta.baro.expiry`,
`PrimeVaultTraders[0].Expiry`, bounty cycle ends. The earliest of those is the
only moment the page can go wrong, and it is known in advance.

**Reference, not a dependency** — technique read from `browse.wf`
(`calamity-inc`, MIT), nothing copied and no data used. It keeps a
"refresh-at" timestamp set to the earliest expiry across the feeds it shows,
re-derives it from each fresh response, and lets a cheap timer fire when that
deadline passes. Two details are worth stealing as ideas: when a refresh comes
back with an *unchanged* expiry it backs off by a fixed delay rather than
retrying hard, and countdowns between fetches are recomputed locally from an
expiry attribute instead of costing a request. Our pages already do the second
of those for Baro's label and the fissure countdowns.

**What this changed here, 2026-09-05.** Neither of the two options this entry
offered. `tools/schedule.ps1` does not fire on derived boundaries and does not
add a run after each one; the grid it already had was **moved two minutes off
the hour**, which reaches every boundary in the data for nothing, because all of
them are on a UTC hour to begin with. `PROJECT.md §7` has the full reasoning and
the measurements. The `browse.wf` refresh-at technique above stays a *reference*
and is not adopted: re-deriving a deadline is the cost this entry named, and a
static two-minute offset buys the same correctness without it.

### The daily FULL build's anchor is not being delivered

**Found 2026-09-05** while answering the entry above, and it is the more
consequential half. The daily FULL build was moved to `5 18 * * *` on 2026-09-04
so it would sit just after the Resurgence turnover. Measured on 2026-09-05:
**no scheduled run has landed in that window on any of the six days visible**
(`gh run list --workflow publish.yml --event schedule`; the same holds for the
`40 18` it replaced, on the days that one was live).

It is not a bug in the cron expression. GitHub delivers scheduled runs of this
workflow at about **one tick in fifteen** — 99 light builds over 247 hours,
median gap 84 minutes, mean 151, worst 749 — and a once-a-day tick draws from
exactly the same lottery. A daily cron delivered at that rate arrives roughly
**once every three weeks**.

**What actually keeps the wiki current is a push.** `FULL` is true for `push`,
for a dispatch with `full=true`, and for the `5 18` schedule. On a week with no
commits, the wiki, the drop tables and DE's export are not re-read at all — and
nothing says so, because the light build succeeds and publishes a fresh-looking
site the whole time.

**The obvious remedy is one line, and it spends money, so it is the owner's.**
`tools/schedule.ps1` already dispatches `publish.yml -f full=false` every ten
minutes and is not in GitHub's queue. A second trigger once a day asking for
`full=true` would deliver the anchored build the same way the light one is
delivered. The cost is one full rebuild a day of build minutes and Pages quota
that is currently only being paid when it happens to fire — so this is an
*increase*, not a substitution, and hard rule 11 wants it deliberate. **Size:
small.** Worth checking first whether pushes alone have been keeping it current
often enough to matter.

### Vendor `ItemType` paths have a general rule, and we found one case of it

**Reference, not a dependency** — read from `warframe-public-export-plus` and
`browse.wf` (`calamity-inc`, MIT). Neither their code nor their data is used.

The Baro work on 2026-09-04 discovered by hand that his manifest's
`/Lotus/StoreItems/Types/Game/Projections/T4VoidProjectionBaroAkmagnusPrimeBronze`
corresponds to `/Lotus/Types/Game/Projections/...` in `ExportRelicArcane_en.json`.
Both projects state that as the general rule: **a vendor can only sell
StoreItems, and a StoreItem path maps to the real type path by removing the
`/StoreItems` segment** — with bundles as the documented exception, which
resolve through a separate bundle export. So the join used for Baro's relic is
not a coincidence of that one row, and the same rule reads Varzia's manifest.

One thing there is worth treating as a **negative** example. `browse.wf` marks
everything in Varzia's manifest as Resurgence **without reading the trader's
activation or expiry at all** — a snapshot treated as permanent state. That is
the exact wrong-`true` this backlog already refuses for Baro, and it is
reassuring to see what it looks like when nobody gates it.

Not adopted, and worth recording as considered-and-rejected: their relic naming
builds a display name from era plus category through a localisation dictionary.
We do not need it — `ExportRelicArcane_en.json` carries `name` outright.

### Baro's relic should live only while he is on the relay

**Decided by the owner 2026-09-04**, and it settles the question the entry
*Baro's relics should be crackable, the way Varzia's are* was holding open:

> We keep the relic as long as Baro is here, and then we forget he had it. Just
> like all the other relic.

So it is a **live feed, not a catalogue fact** — the same shape as a fissure. It
is present in the payload while `meta.baro` says he is on the relay, and absent
otherwise; nothing records that he once sold it, and no build that runs during
the twelve empty days needs to say anything at all. That removes the "what does
the row say while he is away" problem rather than solving it, because there is no
row while he is away.

**Built and shipped 2026-09-04**, in the visit it was measured in. The plan in
this entry named `ExportRelicArcane_en.json` as a new fetch, and **that was
wrong and was not needed**: the item database already fetched for names, images
and vault state carries the same rows — `/Lotus/Types/Game/Projections/
T4VoidProjectionBaroAkmagnusPrimeBronze` is `"Axi M5 Intact"` in it, with the
other three refinements beside it. DE's relic manifest says the same thing and
costs 3.2 MB to learn it. So the build gained **no new source at all**:
`build_baro_relics` in `tools/build_data.py` drops the `/StoreItems` segment
from each `Manifest` row and looks the result up in rows `build_varzia_relics`
already walks.

What shipped: `relics[n].baro` on the payload; `isBaro` in `assets/plan.js`
gating on `ROT.traderWindow` against the **page's** clock so his relic leaves
with him and reverts to a trade row with no rebuild in between; a third errand
checkbox that is absent rather than zero while he is away; a `from Baro` badge
in `--blue`, the colour `.badge.baro` already uses on the collection view. The
sort ranks him with Varzia — both are "buy it with something farmed" — rather
than giving him a bucket of his own.

## Defects found by the documentation sweep of 2026-08-15

Five entries, of which **four shipped on 2026-08-24** and were deleted — the two
pages naming different nodes for one folded group, the collection page's missing
fourth run mode, the Profit-Taker phase costed at four bounty stages, and the three
strings claiming the page could not see fissures. That last one was rewritten while
the refresh interval was being changed, because the change made it wronger: the
sentence said the data was *"refreshed daily"* and it is now re-read every ten
minutes. The decision it justified is unchanged and now argued from what is
actually true — see `PROJECT.md §7`.

The one below is what is left of the group, and it is the cause the group was made
for: a capability landed and the sentences explaining why it was absent stayed where
they were.

### Baro's actual stock is published, and never read

`flags.baro` comes from a wiki marker — `[[Baro Ki'Teer|B]]`, `tools/catalogue.py:159`
— and it means *he sells this sometimes*, not *he is here now*. Eight items carry
it.

**Half of this shipped on 2026-08-27.** DE's worldstate carries `VoidTraders`,
and `meta.baro` now ships his window — `{activation, expiry, node, character}`,
currently `2026-09-04T13:00Z → 2026-09-06T13:00Z` at `EarthHUB`. The collection
view's *Baro Ki'Teer* filter opens only while he is actually on a relay, decided
against the **page's** clock rather than the build's, so a tab left open across
his arrival is right without a reload.

**The stock is published, and it was read on 2026-09-04.** Measured 13:24Z, 24
minutes into the window: `VoidTraders[0].Manifest` holds **41 entries**, against
the 0 measured on 2026-08-27. It is real stock, not a placeholder. An entry is
**three** keys — `ItemType`, `PrimePrice` (Ducats), `RegularPrice` (credits) —
and `ItemType` is a `/Lotus/StoreItems/...` path, not a display name. **`Limit`
is optional and appeared on exactly one of the 41 rows**, the `BaroTreasureBox`,
at `1`. Do not write a reader that assumes it: 40 of 41 rows do not have it.

**Exactly one of the 41 is a relic** — counted, not eyeballed — and it is the
only row this project has any use for:

```json
{"ItemType": "/Lotus/StoreItems/Types/Game/Projections/T4VoidProjectionBaroAkmagnusPrimeBronze",
 "PrimePrice": 125, "RegularPrice": 55000}
```

The other 40 are mods, skins, ship decorations, Prisma/Vandal/Wraith weapons and
a `BaroTreasureBox` — nothing the catalogue models. So *"what is he really
selling"* is answerable, and on this visit the answer is **one relic**, not a
shelf. Whether that is his habit or this fortnight's draw needs a second sample
— see the note at the end of this entry.

**That relic resolves to `Axi M5`, first-party, with no wiki marker and no WFCD.**
*Two* routes do it, and the one below is **not** the one that shipped — see the
note at the end of this entry: the item database already fetched for names and
vault state carries the same mapping, so no new source was added.
`ExportRelicArcane_en.json` — a manifest DE already list in the export index and
this build does **not** fetch — names it outright: `"name": "Axi M5 Relic"`, with
a `relicRewards` table that matches the payload's `Axi M5` reward-for-reward
(Magnus Prime Barrel `RARE`, Receiver `UNCOMMON`, Akmagnus Prime Link `UNCOMMON`,
both blueprints and Forma `COMMON`). 3261 rows, 3073 of them projections,
`max-age` ~356 days, `Last-Modified` 2026-06-23 — a static manifest, the
politest kind of fetch this project makes. **`ExportResources_en.json`, which the
build does read, cannot do this job**: it carries 32 projection rows covering
Varzia's `…Vault…` set and the bare tier names, and Baro's relic is not among
them. That is the whole reason this looked like it needed WFCD.

All four refinements exist in the manifest (`…Bronze/Silver/Gold/Platinum`, all
named `Axi M5 Relic`); **he sells only `Bronze`, which is Intact.** The `Baro`
infix in the uniqueName is what marks his, the way `Vault` marks Varzia's.

**The static flag over-claims, and now there is a number for it.** Nine items
carry `flags.baro`; the single relic he is actually selling covers **two** of
them — Akmagnus Prime (`Axi M5` is its only relic) and Magnus Prime, which shares
that relic. The other seven — Volt, Gotva, Aklex, Akvasto, Lex, Vasto and Odonata
Prime — he is not selling anything for today. So *sometimes* and *today* differ
by seven items out of nine on this visit, which is the measurement the
"today versus sometimes" choice below was waiting for.

**The raw captures were deliberately not committed, and this entry is the
record instead.** DE's worldstate, the isolated `VoidTraders` block, WFCD's
`voidTrader` and `ExportRelicArcane_en.json` were all captured verbatim during
the window and then discarded. `.gitignore` opens by saying DE's game data is
not redistributed here — it is why `data/prime-data.js` and `assets/img/` are
excluded — and `git log` confirms no DE data has ever been tracked: the only
upstream-shaped file ever committed was `data/feed-log.json`, our own record,
and that was untracked again on 2026-09-01. A 3.2 MB DE manifest checked in as a
test fixture would be the first exception to a policy the repository states in
its own first sentence, so it was not made. **What is preserved is what is
quoted above**: the counts, the entry shape, the relic row verbatim, and the
resolution path. That is enough to build against without holding DE's data.

**What was seen and not written down**: the other 40 manifest rows — mods,
skins, ship decorations, Prisma/Vandal/Wraith weapons, two 2026 TennoCon items
and the treasure box. None is a Prime part or a relic, so none joins to
anything in this catalogue. They are omitted on purpose, not lost.

`Manifest` empties again at **2026-09-06T13:00Z** and he returns around
**2026-09-18**. Anything that needs a live manifest — a fixture, a second
sample to confirm "one relic per visit" is the rule rather than this visit's
accident — has to be taken then. **One visit is one data point**: that it was a
single relic this time is measured, that it is always one is not.

**The proposal has two halves and only one is safe.** Disabling the checkbox while
he is away changes what the flag means, and he is present roughly two days in
fourteen: a box that is dead twelve days out of every fourteen is a filter that
mostly does nothing, and eight items would move between buckets twice a fortnight
under a reader who has not touched anything. That is the same instability the
fissure decision rejects for the ranking (`PROJECT.md §7`).

**The *say when* half shipped 2026-08-27** and is out of this entry: the label
reads *Baro Ki'Teer — back in 8 days*, and *here 2 days more* while he is on a
relay. The window arithmetic moved to `ROT.traderWindow`, so the checkbox's
yes/no and the sentence beside it are one answer read twice rather than two that
can drift; `awayText` is its own function because `untilText` tops out in hours
and rendered six days away as *144h 00m*. The label repaints on a slow interval
and on `visibilitychange`, and the **checkbox deliberately does not move** — he
arrives while a tab is open twice a fortnight, and flipping it under a reader who
has touched nothing would shift nine items between buckets with nothing on screen
saying why. `PROJECT.md §7` has the reasoning.

What is left of that half is the part that needs him present: **while he is
actually here, mark the items he is really selling** — the only thing on this
list that today's static flag genuinely cannot tell you, and it waits on the
manifest above.

See also the worldstate entry below: the responses already cached carry more than
is read, and this would be a third endpoint rather than a third use of one.

### The availability precedence, and what reordering it would actually cost

Today: `founder → resurgence → farmable → baro → special → vaulted`
(`assets/model.js:118`, argued in `PROJECT.md §7`, pinned by a test in
`tests/test_model.mjs`).

The roadmap asks for `farmable → resurgence → baro → vaulted → special → founder`,
to *"move Other Sources to the second-to-last position"*. **It is already there** —
`special` is fifth of six, with `vaulted` last as the fallback. The stated goal
needs no change.

The order as literally written does change something, and it is not good. `vaulted`
is not a fallback in that list, it is a **check**, placed fourth — and all three
Founder items carry `flags.vaulted`. Simulated over the current 167:

| Order | Founder bucket | Items moved |
|---|---|---|
| current | 3 | — |
| as written | **0** | Excalibur, Lato and Skana Prime → Vaulted |
| `farmable → resurgence → baro → founder → special → vaulted` | 3 | **none** |

So the intended reading is a no-op on today's data — no item is both farmable and
resurgent, or both founder and anything else — and the literal reading silently
empties a bucket whose whole point is that those three can never come back. If the
order is changed at all, change it to the third row, update `PROJECT.md §7` and the
test with it, and know that nothing on screen will move.

### A priority flag on the farm list

Nothing distinguishes a vaulted part you may never see again from a permanently
farmable one: `bestRefinement` weighs each wanted reward by `Math.min(e.qty, e.stillNeed)`
and nothing else, so the scarcest thing sets the bottleneck whether or not it is the
thing you care about.

**Not via `stillNeed`, though**, which is what the review proposes. That number
feeds two different things in `model.js` — the value of an opening, *and* the
`openings` count that the crack list ranks on ("openings per part cleared"). Inflate
it and the app starts claiming you need three of a part you need one of, and the
second list becomes a lie. A separate multiplier applied to **value only**, leaving
`openings` honest, is the shape that does not corrupt anything.

The control is the other half. The crosshair is a two-state `role="checkbox"`
(`STYLE.md §6`: green owned, teal queued), and a third state needs either a
different control or a modifier — plus a line in `STYLE.md`, since a new colour with
a new meaning is exactly what that document exists to arbitrate.

### Baro's item-level marker still over-claims, and now there is a number for it

**The relic half is done and settled** — *Baro's relics should be crackable, the
way Varzia's are* shipped 2026-09-04 and its reasoning is in `PROJECT.md §7`,
along with the answer to *"is one relic per visit his habit"*, which the owner
pointed at the wiki to settle rather than waiting for another visit. Short
version: **no relic at all is the norm** (271 of 313 visits), one is the usual
case when there is any, and three is the most he has ever carried.

**The badge half shipped 2026-09-04**, reported by the owner from the collection
view: five vaulted secondaries all wearing a blue `BARO` while he was on a relay
selling a relic for exactly one of them — *"why are there so many Baro items,
although they are not available from Baro?"* There are two badges now.
`BARO — HERE NOW` is `--blue` and is shown only when his live manifest holds a
relic for that Prime **and** the page's clock puts him on a relay; `BARO
SOMETIMES` is `--txt-dim`, the same grey as the `VAULTED` beside it, because it
says the same kind of thing. `STYLE.md` has the rule it generalises to: colour is
for what the reader can act on. Verified in the browser — of the nine, exactly
Akmagnus and Magnus Prime (both fed by `Axi M5`) read *here now*.

**What is still open is the flag itself, not how it is drawn.** `flags.baro`
comes from the wiki and means "he sometimes sells this Prime"; it sits on nine
items, and on the 2026-09-04 visit his actual stock covered two of them. That
gap is now measured rather than suspected, but nothing has been decided about
it — the relic-level shelf shipped and the item-level marker was left exactly as
it was. See *Baro's actual stock is published, and never read* above for what
that entry still holds open.

**The nine, re-read from the payload 2026-09-05** so that whoever decides this
is looking at the actual set rather than a count:

| item | relics | still dropping | on his shelf today |
|---|---:|---:|---|
| Volt Prime | 12 | 0 | |
| Gotva Prime | 0 | 0 | |
| Aklex Prime | 2 | 0 | |
| **Akmagnus Prime** | 1 | 0 | **`Axi M5`** |
| Akvasto Prime | 1 | 0 | |
| Lex Prime | 127 | 8 | |
| **Magnus Prime** | 20 | 0 | **`Axi M5`** |
| Vasto Prime | 27 | 0 | |
| Odonata Prime | 17 | 0 | |

Two things that table makes plain and the count did not. **The two he is
actually selling are fed by a single relic** — `Axi M5` carries Akmagnus
Blueprint and Link plus Magnus Barrel, Blueprint and Receiver — so "his stock
covers two of nine" is one relic, not two independent hits. And **Gotva Prime
carries the flag with no relics at all**, which is the separate wiki
disagreement already filed under *Gotva Prime is marked `(S)` but is a Baro
Ki'Teer item*; whatever is decided here has to say what a marker means on an
item no relic can produce.

The asymmetry worth naming before choosing: `flags.baro` is a **static wiki
marker** read once per build, while the shelf is a **live feed** that is empty
between visits and held 41 rows with one relic on 2026-09-04. They are not two
views of one fact, and a change that quietly replaced the first with the second
would drop seven items off the collection view entirely.

Related: *A vaulted relic on a Prime you can farm another way is still hidden*,
which is the same question one level down — when a relic you cannot farm is still
worth showing.

### What the misses are worth, in Ducats

The data is already here and already tested: `ducats` on **582 of 590** parts, all
in `{15, 25, 45, 65, 100}`, pinned by `test_build.py`. **Nothing in the ranking
reads it** — this entry said "nothing reads it" until 2026-08-25, but the
collection drawer has shown a per-part Ducat badge since 2026-08-11
(`assets/app.js:863`). It is the scoring side that is untouched.

Measured across the 34 currently-dropping relics, the expected Ducats of one Intact
opening runs **17.3 to 33.4, mean 21.4** — a 1.9× spread. Real, and small. Two notes
for whoever implements it:

- the join needs the same `normalise_part` the pipeline already applies. Reward rows
  are named `Nyx Prime Chassis Blueprint` while the part is `Chassis`; without that
  step 38 of 180 live reward rows miss and the numbers come out ~20% low.
- **the tie-break framing is the weak half of the proposal.** Nodes that are the
  same bet are already folded into one row by `ROT.signature`, so exact ties between
  *different* relic tables are not the common case. The strong half is the one the
  review states second: this is the value of the **misses**, and the misses are most
  of what a run hands you.

It is not free of the argument that keeps traces out of the score, either: Ducats
buy from Baro, and what a Ducat is worth depends on whether you want anything he is
selling.

### What the misses are worth in Platinum, from warframe.market

**Asked for by the owner 2026-08-27. Not started — recorded so it is not
re-derived.**

Fetch [warframe.market](https://warframe.market)'s API for the Platinum value of
each part, and **carry it exactly as `ducats` is carried**: per part, on the
payload, beside the Ducat figure the drawer already shows. The owner's spec for
the number is *"the 95th percentile of quantity"*.

**This is not a real-money violation, and the entry has to say so or it will be
closed as one.** `PROJECT.md §2` lists *"Platinum bought from Digital Extremes"*
as out of scope, and that is still right. The test that section actually states
is **"can this be earned by playing, or must it be purchased?"** — and Platinum
from **trading parts with other players** is earned: you farm the relic, you crack
it, you sell the part. It is the same shape as Ducats, which are in scope for
exactly that reason, and it is the other half of what a spare part is worth. What
stays out is buying Platinum from DE with a card, which this would neither
recommend nor price.

Add that distinction to §2's table when this lands, because the current row reads
as though all Platinum were out.

**Three things to settle before writing any of it.**

1. **What "95th percentile of quantity" means**, which has more than one reading
   and the readings differ by a lot. The orders endpoint gives a list of live
   sell orders, each with a price and a quantity. Candidates: take orders sorted
   by price ascending, accumulate quantity, and read the price at 95% of the
   total — which lands near the *top* of the range and is close to a robust
   maximum; or discard the top 5% of quantity as outliers and take the highest
   price that survives; or use the `/statistics` endpoint's closed-order history
   instead of live orders, which is what actually sold rather than what is being
   asked. **Ask the owner rather than picking** — the figure means different
   things to a seller and to a valuer, and this one is going on screen.
2. **Which orders count.** Live sell orders from online users is the usual answer;
   including offline sellers inflates the price with orders nobody can fill.
   Platform matters too — the API is per-platform and this project is PC.
3. **What it is for.** Ducats have the same open question in the entry above:
   the data is on the payload and *nothing in the ranking reads it*. If Platinum
   is only ever a badge beside the Ducat badge, that is a small and honest
   feature. If it is meant to reach the ranking, it inherits the whole argument
   in *What the misses are worth, in Ducats* — what a Platinum is worth depends
   on what you want to buy with it, exactly as a Ducat's does.

**A new source tier, and the first one that is neither DE nor WFCD.** So it needs
what the others got: read its `Cache-Control` before the first fetch and honour
the window (`PROJECT.md §2`, *"Ask no more often than the source says to"*); check
its terms and rate limits, since warframe.market **does** publish a rate limit
where DE and WFCD publish none; and record it in the source table with what it
supplies and what happens when it is unreachable. It is an API rather than a
library, so it is ordinary work under rule 9 — but the licence question is
sharper here than for a first-party feed, and the answer belongs in `NOTICE.md`.

The join is the same one the Ducat entry warns about: reward rows are named
`Nyx Prime Chassis Blueprint` where the part is `Chassis`, so it goes through
`normalise_part` like everything else. Their item keys are slugs
(`nyx_prime_chassis`), which is a third spelling and needs the same funnel rather
than a route around it.

### Expected openings for everything, not for the worst one — measured, and it costs traces

The review is mathematically right. `bestRefinement` minimises the **worst single**
expected-openings figure among the wanted rewards, and the expectation of getting
*all* of them is strictly greater than the largest individual expectation. The
correct quantity is the unequal-coupon-collector expectation, exactly computable by
inclusion–exclusion over the wanted rewards.

**So it was computed, and compared against what ships.** Over the 34 live relics and
1,145 (relic, wishlist) combinations:

| | |
|---|---|
| cases where the advice differs | **62 of 1,145 — 5.4%** |
| what the change always is | **Flawless → Radiant**, every single time |
| improvement where it differs | median **0.46 openings, 4.5%** (e.g. Lith C7, 10.3 → 9.8) |
| what it costs | **50 more Void Traces** per relic — Flawless is 50, Radiant is 100 |

Over all 763 relics including vaulted, the disagreement rate is the same, 4.4%, and
the direction never varies. Squad odds do not change it either, since `squadOdds` is
monotone in `p`.

**So the honest summary is: correct, and worth about half an opening at double the
trace price, on one relic in twenty.** Which makes it the same trade as the entry
above — what 100 traces are worth to this player — and it should not be implemented
before that question has an answer, because the answer decides its sign.

### A concentrated farm finishes a relic sooner than a diluted one

Measured, because the size of the effect decides whether it is worth pricing. Across
the **274** live relic-dropping nodes, the number of currently-dropping relics a node
carries runs from **1 to 28** — two nodes drop one, 58 drop seven, 54 drop fifteen,
and Elite Sanctuary Onslaught drops 28. The spread the proposal wants to reward is
real and large.

But most of it is already priced: a node is scored on the relics **you want**, so a
28-relic table gets no credit for the 24 you do not. What is left is genuinely
second-order — variance, and the option value of finishing one relic, crossing it
off and re-optimising against a shorter list.

Which makes this the **one proposal here that nothing observable can check**. It
would move the ranking by an amount chosen by hand, in a direction no measurement
confirms. If it is wanted it needs a stated size and a paragraph in `PROJECT.md §7`
beside the Railjack cache penalty — which is described there as *the one deliberate
thumb on the scale*, and that sentence would have to stop being true.

## A round is not a universal unit of effort

The planner costs every mission in "rounds" and assumes one round means the same
everywhere. It does not. The largest part of this was answered on 2026-08-14 —
effort is collected per reward and the default costs by reward count
(`PROJECT.md §7`) — and what is left is not a modelling gap but an ordinary
unknown.

### Seven rotation-bearing mission types are still unverified

Swept 2026-08-10. Of the 31 mission types in the data, 9 carry no rotation at all so
the cycle never applies, 11 are confirmed A→A→B→C against the wiki (Defense,
Survival, Interception, Excavation, Defection, Infested Salvage, Alchemy, Sanctuary
Onslaught, Void Cascade, Void Flood, Void Armageddon), and Disruption is modelled
explicitly. That leaves nine assumed AABC without confirmation:

`Caches`, `Key`, `Legacyte Harvest`, `Rush`, `Skirmish`, `Special`, `Spy`,
`The Circuit`, `The Perita Rebellion`.

`Bounty` was the tenth and is now settled — it is not a round-based cycle at all,
see *Bounty rotation is a wall clock* in `PROJECT.md §7`.

The wiki also names two more exceptions we do not currently see in relic sources —
**The Index** (A-B-B, with C once after an hour) and **Arbitrations** (A-A-B-B-C-C-C-C)
— so deviation is clearly not rare.

Their objective counts are **not** inherited rather than checked — this entry said
that until 2026-08-25, and it is too kind. They are not inherited from anywhere:
they are chosen per node by a run-length optimiser that assumes the mission is
endless, so the count is whatever staying happened to score best.

**Both blocking questions were answered from the wiki on 2026-08-25**, and a third
was added and answered with them. The seven that remain are still unverified.

- **`Spy` — vault 1/2/3 pays rotation A/B/C.** Not the AABC cycle. The wiki's
  *Mission Rewards* page is explicit that vault *names* do not correspond to
  rotation and that what counts is how many vaults you have hacked so far; the
  *Spy* page says the same, that rotations are determined only by the number of
  vaults successfully hacked. It also files Spy under **Standard**, not Endless,
  which is the round-based-or-not split the model had been reverse-engineering.
  **This is what unblocked the cap**: on a capped three-vault run the third vault
  *is* rotation C, so Pago, Bode, Valac, Aegaeon, Amalthea and Dione keep the
  rotation they hold all their value in. The fear that capping would zero them
  came from assuming A, A, B, and it was the right fear for that assumption.
- **`Caches` — a Railjack mission pays two cache rewards, not three.** The first
  is for completing a Point of Interest and pays **rotation A**; the second is for
  hacking an Abandoned Derelict Cache and pays **rotation B**. Separate tables,
  rolled independently — not a cycle at all. Our own data agrees exactly: all 38
  live `Caches` nodes are Proxima, and the 28 rotation-bearing ones publish
  precisely A and B and nothing else.

**Both of those shipped in `d8b4484`** and this entry is no longer open on them —
`FIXED_LENGTH` in `rotation.js` carries `Spy: {count: 3, pays: [A,B,C]}` and
`Caches: {count: 2, pays: [A,B]}`. The line here used to read *"the recorded
design is wrong on the count — it says `{Caches: {count: 3}}` and it should be
2"*, and stayed after the code was corrected; it is the count that was fixed, not
the sentence. What is still open in this entry is the **cadence sweep** below.
- **The 10 un-rotated `Caches` nodes are Earth and Saturn Proxima**, which the
  wiki shows with a single undifferentiated cache table and no A/B labelling.
  Their `rot -` in our data matches. Costing them *one run* is already right and
  they need no change.
- **`Special` — Faceoff pays one each of rotation A and B at the end of a match**,
  win or lose. So it is the same fixed-length, fixed-letters shape, and it is
  **not dormant**: see the correction in the entry below.

What this changes about the design: the table needs the **letters**, not just a
count, because the letters are what rescue the six Spy nodes. Three shapes, not
two: `Spy` 3 objectives paying A,B,C; `Caches` 2 objectives paying A,B; Faceoff
one match paying A+B.

**Amended 2026-08-25: the sweep above verified the wrong axis.** The eleven
"confirmed A→A→B→C against the wiki" were confirmed on the **letter sequence** and
never on the **cadence** — how many objectives buy one reward. At least two of the
eleven are not one-for-one, both checked on the wiki the same day:

- **Sanctuary Onslaught** pays one reward per **two zones**. See the entry below.
- **Void Cascade** — *"Retiring 4 purged Exolizers counts for one rotation"*, order
  AABC (`wiki.warframe.com/w/Void_Cascade`). Four objectives per reward, and we
  charge one.

So the paragraph above understates it a second time: the objective counts are
unchecked for the **confirmed eleven** as well as for the unverified nine.

**The cadence sweep is done, 2026-08-26.** All eleven were read off
[`Mission Rewards`](https://wiki.warframe.com/w/Mission_Rewards), whose table gives
the reward criteria and the indices that pay each letter, and spot-checked against
the individual mission pages. What the model charges was measured with the `node:vm`
probe against the shipped `rotation.js`, not read off the source:

| Mode | Wiki reward criteria | Per reward | We charge | Live nodes |
|---|---|---|---|---|
| Defense | waves cleared — 3, 6, 9, 12 | **3** | 1 | **38** |
| Survival | minutes — 5, 10, 15, 20 | **5 min** | 1 | **37** |
| Void Cascade | retired Exolizers — 4, 8, 12, 16 | **4** | 1 | 1 |
| Void Flood | sealed Void Ruptures — 3, 6, 9, 12 | **3** | 1 | 1 |
| Void Armageddon | waves — 3, 6, 9, 12 | **3** | 1 | 1 |
| Defection | squads saved — 2, 4, 6, 8 | **2** | 1 | 3 |
| Sanctuary Onslaught | zones cleared — 2, 4, 6, 8 | 2 | **2** ✓ | 2 |
| Interception | rounds — 1, 2, 3, 4 | 1 | 1 ✓ | 16 |
| Excavation | artifacts — 1, 2, 3, 4 | 1 | 1 ✓ | 11 |
| Infested Salvage | manifests — 1, 2, 3, 4 | 1 | 1 ✓ | 1 |
| Alchemy | crucibles — 1, 2, 3, 4 | 1 | 1 ✓ | 1 |

Four of the eleven are genuinely one-for-one. Onslaught is already correct. **Six
are not**, and two of those six are the largest modes in the dataset — Defense and
Survival are 38 and 37 live nodes, more than any other.

**The unit question this exposed was settled on 2026-08-27 and is closed.** The
model was holding two readings at once — the effort tooltip called an objective
*"A Defense round, a Spy vault, a bounty stage"*, the thing that pays a reward,
while `PER_REWARD` charged Onslaught the player-visible sub-unit. The owner chose
**one reward draw, on every row**: the six rows above are therefore right as they
stand, `PER_REWARD` is emptied, and Onslaught comes back to its reward count —
Elite Sanctuary Onslaught moved #38 → #14. The unit is called *per reward* on
screen now. `PROJECT.md §7` has the reasoning, the rejected reading and why
Survival's five minutes made it unworkable.

**Checked against Digital Extremes' own drop tables on 2026-09-02, and the list
is now five rather than seven.** Read from `.cache/official_droptables.gz` — the
document the build actually parses — rather than from the wiki.

**Use the drop tables for this question, not the wiki.** The owner's correction,
and it cost a wrong finding to learn: the wiki describes The Circuit as
tier-based with no rotation cycle, while DE's own table publishes explicit
A/B/C rotations for that node. Both are true of different things — the in-game
progression really is tier-based, and DE structure the reward *tables* by
rotation anyway. The tables are what we parse, so the tables are what govern.

| Type | In DE's `Missions:` section | What that settles |
|---|---|---|
| `Key` | **0 nodes** | not a mission type — comes from `keyRewards.json` |
| `Special` | **0 nodes** | not a mission type — comes from `transientRewards.json` |
| `Skirmish` | 40 nodes: **24 with no rotation**, 16 with A,B,C | most of it is flat, and flat is already handled |
| `Legacyte Harvest` | 1 node, A,B,C — relics in all three | AABC not contradicted |
| `Rush` | 2 nodes, A,B,C — relics **only in C** | AABC not contradicted |
| `The Circuit` | 1 node, A,B,C — A pays credits and endo, B and C hold the relics | AABC not contradicted |
| `The Perita Rebellion` | 4 nodes, A,B,C — relics **only in A** | AABC not contradicted |

**Two of the seven were never mission types**, which is the finding worth
keeping: `Key` and `Special` have no nodes in the Missions section at all,
because they are read from different files entirely. Asking what rotation cycle
they follow is a category error, and it belongs to *Our four invented "mission
types" leak into the ranking* rather than here.

**Of the five that remain, DE's tables contradict none.** Every rotation-bearing
one publishes A, B and C, so the negative check passes everywhere. **What the
tables cannot settle is the cadence** — how many rounds until B — because they
list what each rotation contains and never how often it comes round. That is
the whole of what is still assumed, and it is structural rather than a gap
somebody forgot to close.

**And 24 of 40 `Skirmish` nodes publish no rotation at all**, which this entry
never noticed while calling Skirmish an AABC assumption. Those take `runValue`'s
flat path — one reward, no cycle — and are already correct. Only the 16
rotation-bearing ones are assuming anything.

**Then the wiki was read for the cadence the tables cannot state**, 2026-09-02,
which is the half of the question drop tables are structurally unable to answer.
Five types, five different outcomes:

| Type | What the wiki says | Standing |
|---|---|---|
| `Legacyte Harvest` | *"The order of the rotations is AABC"*, rewards offered every capture, endless | **verified** — no longer an assumption |
| `Rush` | a single-completion race paying **one** reward: 1/2/3 transports destroyed gives rotation A/B/C | **defect, see below** |
| `Skirmish` | the Railjack page documents no reward rotations at all | still unverified, and not for want of looking |
| `The Circuit` | tier-based with weekly caps and no rotation cycle — while DE's table publishes A/B/C for the same node | **the two sources disagree**; see the note below |
| `The Perita Rebellion` | not endless, a 12-minute timer; rotation A every 3 Orders, B every Order, C on completion | structure differs from AABC, effect unmeasured |

**So one is verified, one is a defect, one is undocumented, and two have sources
that disagree.** Worth knowing before the next pass: reading five wiki pages
produced one confirmation and one bug, which is a better yield than this entry
had assumed when it called the work "tedious rather than hard".

### `The Perita Rebellion` is a time box, and the model has no clock for it

**Tried, measured and reverted on 2026-09-02.** Written down because the obvious
fix is wrong in a way that only shows up once it is built, and the next reader
will otherwise reach for it exactly as this session did.

**What it actually is.** A 12-minute mission, not endless and not fixed-length:
*"Players are given 12 minutes to complete as many objectives, called Orders, as
they can before facing down the boss enemy."* Every 3 Orders pays rotation A,
every Order pays rotation B, finishing pays rotation C — and DE's tables put
**relics only in rotation A**. So a run yields as many A draws as the player is
fast enough to earn, and the wiki declines to give a typical or maximum count.

**Why AABC is wrong here.** It does not merely mislabel rounds: it makes rotation
A *run out*. Rounds 1 and 2 pay A, then the cycle turns to B and C, so `reset`
stops at two draws believing no more are reachable. In the mission they keep
coming every three Orders until the clock stops.

**Why the obvious fix is worse.** A one-letter cycle —
`{ plan: () => "A", cycle: 1 }`, the shape Disruption's *holding rotation B*
plan already uses — was built and measured:

| | before | with the one-letter cycle |
|---|---|---|
| randoms (the default) | 2 rounds, **2** A draws | 1 round, **1** A draw |
| 4-man premade | 6 rounds, 4 A draws | 6 rounds, 6 A draws |

`reset` means *run to the last round that pays*, and with a cycle of 1 that is
round 1 — so the default case halves. The premade case improves and the common
case regresses, which is a bad trade and not a close one.

**What it would actually need.** A count of A draws per run, which is a function
of player speed inside a fixed clock. `FIXED_LENGTH` wants exactly that number
and nobody has it: the wiki says there is none, and inventing one is what
`PROJECT.md §2` calls picking a number the mission cannot have. The honest model
is closer to *"one run, N draws, where N is effort"* — which is the effort-weight
machinery rather than the rotation machinery, and no mission currently uses it
that way.

**So it stays as it is**, mislabelled but not visibly wrong: 4 nodes, 2 rounds,
2 A draws. The error is in what the rounds are *called*, and the count it lands
on is plausible. Left alone deliberately, not overlooked.

### `The Circuit` may be two different modes wearing one name

**The owner's, 2026-09-02, to be settled in game.** The wiki calls The Circuit
tier-based with weekly-capped rewards and no rotation cycle; DE's `Missions:`
table publishes a `Duviri/The Circuit (The Circuit)` node with explicit
rotations A, B and C, where A pays credits and endo and B and C each hold the
same seven Lith relics.

Both descriptions are sourced and they do not fit together. **The owner's
reading is that these are two different game modes sharing a name** — which
would explain it completely, and is the kind of thing only a player can confirm.
Until then nothing here should be changed on the strength of either source.

Worth recording so the next reader does not repeat it: a session read the wiki
first, concluded The Circuit "never pays rotation A", and filed a defect. It
does pay rotation A — credits and endo, no relics — and a round paying something
unwanted is ordinary rather than broken. **The drop tables are what the build
parses, so the drop tables are what govern**; the wiki describes the game, and
for this node the two are describing different things.

There is also a third table, `Duviri Circuit`, under **Dynamic Location
Rewards** rather than Missions — Yao Shrub, Dracroot, Kovnik and other Duviri
resources, and no relics whatever. It is not what the build reads and should not
be mistaken for it.

**No code change came out of the table sweep**, which was the honest result
there. The wiki sweep found one, and it is `Rush` above.

### `RUN_OVERHEAD` is two *rewards* on a node where a reward is two zones

Small, and left open deliberately when the Onslaught divisor shipped on
2026-08-25 (`PROJECT.md §7`). `ROT.RUN_OVERHEAD` is 2 and is added to the reward
count when the model chooses how far to run a node — `rate: r.total / (rounds +
RUN_OVERHEAD)`, `rotation.js:363`. It prices getting in and out of a mission.

On Onslaught a "round" in that expression is a *reward*, which is two zones, so the
restart is being charged at four zones rather than two. The constant is deliberately
unit-free (`PROJECT.md §7`), and this is the first mission type where its unit is
demonstrably not the player's unit.

It changed nothing when the divisor shipped: `aabcaa` still wins on both Onslaught
nodes, so the run-length choice is unaffected and the ranked cost is now right
either way. That is why it was not resolved in the same pass — there was no
pressure to guess. It matters the moment a second cadence lands, since a mission
paying one reward per four objectives would be charged an eight-objective restart.

### Our four invented "mission types" leak into the ranking

`Bounty`, `Key`, `Special` and `Enemy` are ours, not DE's — one bucket per
droptable section (`official.py`). DE's own mission type is the parenthesised
word in `Planet/Node (Type)`, and the wiki lists 35 of them; ours match 24.

**Confirmed from the drop tables on 2026-09-02, rather than inferred.** Parsing
DE's `Missions:` section gives 384 nodes, and **`Key` and `Special` have zero
nodes among them** — they are read from `keyRewards.json` and
`transientRewards.json`, which are separate files with no `(Type)` in them at
all. So these are not mission types DE publish under a different name; there is
no DE row behind them to disagree with. That is the strongest form this entry's
claim can take, and it also removed two names from *Seven rotation-bearing
mission types are still unverified*, where asking their rotation cycle turned
out to be a category error.

That matters because the planner presents all of them as places to go:

- **`Enemy`** is not a destination. It is an enemy that drops relics wherever it
  spawns — the Hemocyte, and it now carries a badge saying so.
- **`Key`** is not a mission type. It is an extra key-gated objective attached to
  an existing mission, and nobody runs one exclusively for it.
- **`Special`** is a bag holding Void Storms, Faceoff and Duviri tables together.
- Three of DE's own labels are not wiki mission types either: `Caches` (a reward
  stream *inside* a Railjack mission), `The Circuit` and `The Perita Rebellion`
  (single activities whose "type" is their own name).

The `Bounty` bucket is the one that has already cost something, because
`objectivesOf` keys off it: the four Profit-Taker phases were charged four bounty
stages each until 2026-08-24, when the heist was given a case of its own
(`PROJECT.md §7`). That fix names one node pattern rather than fixing the label, so
`Bounty` still carries two units — the effort row takes the unit of whichever node
has the most objectives so a one-run heist cannot relabel a form that is mostly
stages. A plaster on exactly the problem this entry describes.

**Checked through on 2026-09-02, and every consequence named above is already
handled.** The entry is an architecture complaint whose symptoms have each been
answered separately, which is worth stating plainly because it reads like a list
of live defects and is not one:

| Claim | Standing |
|---|---|
| `Enemy` is not a destination | handled — it carries a badge saying so, keyed on `kind` |
| `Key` is not a mission type, and nobody runs one for its own sake | handled — **all 240 `Key` sources carry `access: "quest"`**, so `notADestination` excludes them and they never rank |
| `Special` is a bag of Void Storms, Faceoff and Duviri | handled — Faceoff has a `FIXED_LENGTH` entry, and Void Storms publish no rotation so they never reach it |
| `Bounty` carries two units | handled by `isHeist`, and **there is no better signal to key on** |

**The `isHeist` regex is not a plaster over a missing field — the field does not
exist.** DE file the phases as ordinary bounty groups named
`Level 40 - 60 PROFIT-TAKER - PHASE 1`, checked against their tables. The name is
the only thing distinguishing a heist from a bounty in the source, so matching on
it is reading the signal DE provide rather than guessing at one. Anyone planning
to "do this properly" should know that first.

**What was actually missing was anything holding those four facts in place**, and
that shipped: `test_our_invented_buckets_each_still_behave_as_one_thing` asserts
each of them. Every one would otherwise fail *silently in the ranking* — a `Key`
row without `access` would rank as a destination carrying 22 relics, and a
renamed heist would go back to four stages a phase.

**So what is left is the architecture and nothing else**: the bucket names are
ours, `objectivesOf` keys off them, and a future member that behaves differently
would be mis-costed until somebody noticed. That is a real risk and not an urgent
one, and it is now a guarded risk rather than an unguarded one.

### Plague Star and Profit-Taker are the same shape, modelled two ways

**Unblocked with a date, 2026-09-02.** DE's announcement, brought by the owner:
Operation Plague Star runs **2026-09-09 to 2026-09-23**, all platforms. This entry
has been waiting on "Plague Star to run" since 2026-08-14 and now has a fortnight
to be answered in.

**Raised by the owner 2026-08-14, and they are right that something is off.**
Both are gated multi-stage activities that end in a boss dropping relics. Four of
the five differences are real and the models follow them correctly — Profit-Taker
is permanent so it gets a badge, Plague Star is a recurring Operation so it gets an
event gate (`PROJECT.md §7`).

**The fifth is ours.** DE file Profit-Taker's boss rewards inside the bounty table
and Plague Star's boss rewards in the enemy table — the same game structure,
published two ways. We follow the publication rather than the structure, so when
Plague Star next runs the planner will list **two rows for one trip**:
`Level 15 - 25 Plague Star` at 1.14%, and `Hemocyte` at 12.91% with eleven relics,
from `planet: "Enemy drops"`, a place that does not exist.

`Hemocyte` is the only enemy in DE's entire relic table, so this is a list of
one — but a list of one that reads as a phantom destination scoring ten times
the real node beside it.

**Half-fixed:** the row carries an `Enemy` badge saying it is not a place, that four
spawn in the Plague Star final stage, and that the two rows are one trip. That stops
it lying without pretending to be finished.

**The rest, when Plague Star next runs.** Folding the enemy rows into the bounty
they ride needs a probability structure the model does not have. DE publish
`Hemocyte Relic Drop Chance: 20.00%` and then 12.91% per relic within that, and
four spawn per run — so a run is worth `4 × 0.20 = 0.8` relic rolls, not the one
roll currently assumed. Getting that right is arithmetic; getting it *checked*
needs the event live, which is the same blocker as the detection below. Do both
in the same sitting.

### A Radiant node is worth 25% more, and still nobody can see it

**Shipped 2026-08-25.** The owner's ruling replaced two failed attempts at
pricing Void Traces: traces are almost always tight, the planner must never talk
anyone into a lower-efficiency crack to save them, and a node handing the relic
over Radiant simply gets a flat **25%** on its ranked figure.
`M.RADIANT_BONUS`, applied by `M.radiantMultiplier` exactly where `CACHE_PENALTY`
is applied — to `score` and `rate`, never to `perRun` or `anyRun`. The toggle is
now **on by default**, because that is the common case. `PROJECT.md §7` has the
reasoning and both dead ends.

Measured over the live build, all eleven pre-refined nodes gain exactly 25% and
climb: **ESO #41 → #33**, Profit-Taker Phase 4 #62 → #58, the Void Storms #69–75
→ #62–68.

**And it is still invisible, for the third time.** The planner shows eight rows
and twenty more in the overflow tooltip — **28 places**. ESO is at #33. So no
pre-refined node is reachable through the interface at all, under either sort,
for any wishlist tried. Three separate page tests have now been written for this
family of change and all three were deleted for having no subject on screen.

**25% cannot fix that, and no sane number can.** The eighth visible row rates
0.809 against ESO's 0.342, so surfacing it by thumb alone would need **2.37×, a
+137% bonus** — which would no longer be a nudge but a decision to put these
nodes first regardless of what they pay.

**The real obstacle was cost, not value, and the answer was not a bigger number.**
ESO pays rotation C only, and rotation C on Onslaught is twelve zones — correct
arithmetic, and why it ranks where it does. Making the ranking expandable put it
on screen at **#38 of 92** without touching the constant, which is what the
"nobody can see it" half of this entry needed. Raising the bonus further would
have been treating the symptom.

**The per-run sort no longer undoes the thumbs.** Fixed 2026-08-25. Neither the
Radiant lift nor `CACHE_PENALTY` reached `perRun`, so ranking per run put a
halved Railjack cache node exactly where it would have sat unhalved. Both now go
through one multiplier, `n.adj`, which reaches `score`, `rate` and a new
`perRunAdj` — and `perRunAdj` is the key the per-run sort orders on.
`PROJECT.md §7` has it. `n.perRun` itself stays the raw count DE's tables imply
and is what the tooltip quotes, so the row's figures are adjusted and say which
thumbs are on them, while the fact underneath is not.

### Digital Extremes 403 the GitHub runner, so the deployed worldstate goes stale

**Measured 2026-09-01, at the owner's question — "has DE succeeded at some point
today, and should the refresh run at a specific time?"** Eighteen builds sampled
from the CI logs, ten pushes and eight of the ten-minute scheduled runs, spread
across the whole clock. **One reached DE.**

| Time (UTC) | Feeds came from |
|---|---|
| 18:49 | **worldstate** — DE, all three feeds |
| 18:32, 18:03, 17:48, 17:32, 15:26, 15:24, 15:07, 13:53, 13:52 | proxy |
| 09:58, 09:17, 09:04, 07:38, 05:23, 01:36, 00:18, 20:56 | proxy |

**So the answer to "a specific time" is no, and the data says why.** The single
success sits *between* two failures seventeen minutes either side, and the
failures cover every part of the clock from 00:18 to 20:56. There is no window.
That fits the documented cause exactly — Akamai refuses an address *range*, so
what decides it is which runner IP the job happens to draw, not when it asks. A
cron time cannot choose an IP. **And do not reach for retries**: the entry below
already records that this is a refusal rather than a hiccup.

**Two things this exposed that are worth fixing, and neither is the 403:**

- **The record designed to answer this cannot answer it.** `data/feed-log.json`
  is meant to accumulate one row per build over 24 hours, and the deployed copy
  holds **one row**. Because the file is tracked, a CI checkout finds a local
  copy and never fetches the published one (`read_feed_log` prefers local); the
  committed copy is three rows from 2026-08-27, which `trim_feed_log` then drops
  as older than a day. So every run starts empty and writes a single row. The
  cleanup already noted under *`data/feed-log.json` is tracked on purpose* is
  what fixes it, and until then this question has to be answered by reading
  eighteen CI logs by hand, which is how the table above was built.
- **The probe step does not ask about the endpoint in question.** *Probe the data
  sources* curls five URLs — the wiki, the drop tables, `origin.warframe.com`'s
  export index, and two WFCD hosts — and **not**
  `api.warframe.com/cdn/worldState.php`, which is the one that decides whether
  the live feeds come from DE or the proxy. The probe exists to record which
  sources answer a datacentre IP, and it is silent about the only source that
  routinely does not. One line to add.

**Found 2026-08-27, from the banner on the deployed site**, which the owner asked
about:

> **Live data is an older copy.** Some live data could not be refreshed, so it is
> from a copy made 78 minutes ago.

**The banner is right, and nothing here is broken.** It is reporting a real
refresh failure and reporting it accurately, which is what it is for. From the CI
log of the successful build:

```
~ de_worldstate: refresh failed (HTTP Error 403: Forbidden) - reusing the cached copy (69 min old)
```

So the deployed site is serving a worldstate copy that was already 69 minutes old
when the build ran, and the reader saw it nine minutes after that. Everything else
refreshed: the item database, the export manifests, the drop tables and the wiki
page all came down in the same run.

**It is intermittent, not permanent**, and the evidence is in the failure itself:
the cache it fell back on was 69 minutes old, so the build 69 minutes earlier
*did* fetch successfully from the same runner. Something rejects some requests and
not others.

**Why, researched 2026-08-28 rather than guessed.** `api.warframe.com` sits
behind **Akamai**, and Akamai's edge blocks datacentre and VPN address ranges. A
[DigitalOcean community
report](https://www.digitalocean.com/community/questions/403-forbidden-access-denied-please-help-warframe-blocking-digitalocean-or-vice-versa)
of the same symptom carries the giveaway header:

```
HTTP/1.1 403 Forbidden
Server: AkamaiGHost
```

GitHub's runners are Azure datacentre IPs, which is the same category. Two more
observations fit and neither was arranged: the same request succeeds from the
owner's residential connection, and an attempt to read
`forums.warframe.com` from this session's own cloud IP was **also** 403ed while
researching this. It is the network path being refused, not the request.

**That is also why it is intermittent.** Akamai's rules are applied per edge PoP
and per address, so one runner draws an IP that passes and the next does not.
Nothing about our request changes between builds.

**Two things follow, and the first corrects a claim in our own docs.**

*`PROJECT.md §8` item 7 says wiki images "return HTTP 403 to anything that isn't a
real browser session".* The **403 was observed**; *"isn't a real browser session"*
is an interpretation laid on top of it, and today's evidence points elsewhere — at
the edge refusing an address range rather than at anything sniffing the request.
That distinction is not academic: if it were user-agent detection, a different UA
would fix it, and **it will not**. Changing the origin might. The observation
stands; the explanation attached to it should be treated as unproven.

*Probing for other endpoints is not an option, and is already settled.* `§2` and
the endpoint sweep both say so: `api.warframe.com` exposes exactly one path, ten
plausible siblings were checked and 404, and going further is brute-forcing
somebody's server. A 403 from an edge appliance is a refusal, and the answer to a
refusal is not more requests. **Do not add retries** — every request is somebody
else's bandwidth (`§2`), and retrying an Akamai block just spends it.

**The real defect is ours, and it is not the 403.** All three WFCD fallbacks —
`vault_trader`, the bounty boards, the fissures — fire only when the worldstate
yields **nothing usable**. A stale cached copy is "usable", so on this build the
403 was absorbed by the cache and **no fallback ran**: the site published
69-minute-old fissures while a fresh copy of the same document sat unused at the
proxy. The log even reads *"19 fissures from Digital Extremes"*, which was true of
the copy and not of the hour. Fissures last a couple of hours, so this is the feed
where an hour of staleness costs the most.

**Our half is fixed, 2026-08-28.** The owner's ruling: **Digital Extremes, then
WFCD, then the stale copy — always, in that order, not conditional.** A reused
copy is no longer treated as a first-party answer, so a 403 now falls through to
the proxy instead of being absorbed by the cache, and the banner reports what
reached the payload rather than what `fetch` had to try. `from_chain` in
`build_data.py` holds the order in one place and a test asserts it;
`PROJECT.md §7` has the reasoning.

**Verified on the runner, which is the only place it can be.** The owner's point,
and it was right: every earlier check was an offline build on a machine DE answer
normally, which is no evidence at all about CI. Two consecutive builds on
2026-08-27 each met a real 403 and each fell through cleanly — both detectors
firing independently, all three feeds served by WFCD — and the deployed
`prime-data.js` reports `"stale": []` with `"feeds"` naming the proxy. The
symptom the owner saw is gone from the live site.

**So the defect is closed and the condition is not.** Two things follow that were
not visible before, and they are why this entry stays open.

- **The 403 is frequent, not occasional.** Two builds out of two, ten minutes
  apart. The earlier guess of "intermittent" came from a single log line and a
  69-minute-old cache; the truth is closer to "usually". **On CI the first-party
  path is mostly aspirational and WFCD is doing the real work.**
- **Which means the deployed site's live feeds now depend on WFCD being up.**
  That is a genuine shift and it is not free: all four WFCD endpoints were 404
  for three days from 2026-08-24, which is the outage that prompted moving to DE
  in the first place. The chain would have fallen to `cache` throughout — correct
  behaviour, correctly reported, and still an hour-old fissure list. First party
  first is right; first party *unavailable* is now the normal case on CI.

**What is left, in order of what it would buy:**

- **Watch `meta.feeds` on the deployed payload.** It ships as of 2026-08-28 and
  one `curl` reads it, so the rate needs no log spelunking. What is worth knowing
  is whether `"worldstate"` ever appears there — if it never does, the first-party
  path on CI is decorative and the entry below becomes the real question.
- **Whether to ask DE.** Their forums are the documented channel, and an
  allowlisted runner is the only thing that would restore the first-party path
  from CI. This has moved up: it is no longer a nicety if DE effectively never
  answer the runner.
- **Whether the local scheduled refresh has been masking it.** `schedule.ps1`
  runs where the fetch works. Worth knowing how much of the published freshness
  has been coming from there rather than from CI.

**Do not add retries**, whatever else is decided. A 403 from an edge appliance is
a refusal rather than a hiccup, and `PROJECT.md §2` is explicit that every request
is somebody else's bandwidth. Retrying an address-range block just spends it.

### One Cambion Drift tier labels a different letter from the rest of its family

**Found 2026-08-27**, while implementing the rotation-letter cross-check, and
left alone because it does not change today's answer and the fix is not obvious.

With the three-table gate applied, the standard family reads **16 of 17** jobs as
`C`. The one dissenter is a job at levels `[25, 30]` whose reward-table path says
`TableA`, matched to *Level 25 - 30 Cambion Drift Bounty* — a group that does
publish all three tables, so the gate does not exclude it and its label is a
genuine claim.

**The suspicion is that it is filed in the wrong family.** Its rewards read as
Isolation Vault — Ayatan Amber Star, Carnis Mandible — while the family is
decided purely by matching `group_levels`, and an Isolation Vault bounty sharing
levels with a Cambion Drift tier would land in `standard` regardless of what it
actually is. If that is right, the vault family is under-counted by one and the
standard family carries a stray.

**Why it is not urgent.** Sixteen against one is not close, the cross-check
agrees on `C`, and the vote abstains on that job entirely rather than dissenting
— so nothing shipped is wrong today. What it costs is margin: a family decided
16–1 is one upstream change away from being decided 9–8.

**Checked against a live window on 2026-09-02, which is what this asked for, and
the suspicion above is wrong.** Read straight off DE's worldstate:

| Family | Letters published live | Dissenter |
|---|---|---|
| standard | A ×17, **B ×1** | `EntratiSyndicate` 30-40, `TierDTableBRewards` |
| vault | C ×3 | none |

**It is not a misfiled Isolation Vault bounty.** Every vault job carries a
`VaultBounty` prefix in its reward path — `VaultBountyTierATableCRewards` and
its two siblings — all three publish `C`, and the join in `build_data.py` already
keys on that prefix (`key = (sid, tuple(levels), "VaultBounty" in name)`). The
families are cleanly separated and the level collision at 30-40 is handled.

The dissenter is a **genuine standard Cambion Drift job** publishing `TableB`
while seventeen standard jobs across Cetus, Fortuna and Deimos publish `TableA`.
Seen in two windows a day apart, both times at 30-40 on Deimos.

**So the interesting reading is the right one: the letter is per tier, not per
family.** DE publish a letter for every tier independently, and at least one tier
disagrees with its family's majority persistently rather than by accident. The
family split is an approximation, and this is the case that shows it.

**Why it costs nothing today, concretely.** Not merely "16 against 1 is not
close" — **no Cambion Drift bounty group carries a relic at all**, measured on
the payload. The mislabelled tier never reaches a ranked number, because this
app ranks relic sources and that tier has none. If DE ever put a relic in it, the
letter would be wrong on screen the same day.

**And the fix direction is now known rather than unknown.** The per-group letter
is already captured — `live_bounty_letters` returns `out[group] = {letter,
stages, minMR}` — while `rotation.js:211` scores from
`BOUNTY.families[name]` instead. Preferring the group's own published letter,
and falling back to the family only where a group has none, would remove the
approximation without deriving anything new. What needs deciding is what the
*countdown* means once tiers can disagree, since `walkFrom` advances one letter
for a whole family.

### The page tests flake in a full run and pass on their own

**Observed twice on 2026-08-27, in consecutive full runs, on two different
tests**, each of which then passed standalone:

```
FAIL js: the licence and privacy notice is at the foot of both pages, identically
FAIL js: the collection drawer can show more than its eight best places
```

**A third on 2026-09-04, and this one named a cause the others did not:**

```
FAIL js: the search sits at the centre of the bar, whatever is beside it
  page.goto: net::ERR_NO_BUFFER_SPACE at http://127.0.0.1:55152/index.html
```

Passed on the next full run, 602 of 602. `ERR_NO_BUFFER_SPACE` is the OS refusing
a socket, not a missed wait — it is **ephemeral port or non-paged pool
exhaustion on Windows**, which is what a long session of builds, subprocesses and
short-lived servers produces. That is consistent with "the browser group runs
last, after half a minute of everything else" without being the timing guess
below, and it is the first evidence pointing at a resource rather than at
Playwright. It happened in a session that had also run the suite half a dozen
times and driven a preview server, so the machine was unusually far through its
port range.

Both pass immediately afterwards when `node --test tests/test_pages.mjs` is run
on its own — the second was confirmed at 47 of 47. So the failures are not about
what the tests assert; something about running them at the end of a full suite is
different.

**The cause is not established, and the obvious guess is wrong.** The first
thought was that `test_offline_build` rewrites `data/` while pages are reading it,
but the runner walks its groups in order and one test at a time, so those never
overlap. What is left is timing: the browser group runs last, after about half a
minute of builds and subprocesses, and Playwright work that is fine on an idle
machine can miss a wait on a busy one. That is a guess too, and it should be
treated as one until somebody measures it.

**Worth fixing rather than tolerating.** This suite is the gate before every push
— `PROJECT.md §2` says so — and a gate that fails one run in a few teaches people
to re-run rather than to read, which is exactly how a real failure gets waved
through.

**The diagnostic gap is closed, which was step one.** The runner parsed TAP's
`ok`/`not ok` lines and threw the rest away, so a failure said *which test* and
never *which claim* — and both flaking tests carry a dozen assertions each. That
is why it could be observed twice and diagnosed neither time. `_tap_failure` now
reads the `error:` block underneath and reports it:

```
js: the collection drawer can show more than its eight best places
  got 'not ok', wanted 'ok'
     the drawer still opens on the top eight 8 !== 9  [tests\test_pages.mjs:269:42]
```

One caveat worth knowing: the `location` is where `test()` was called, so every
`test_pages.mjs` entry reports the `page_test` wrapper's line and only the file
name is useful. The message is the part that matters.

**Two candidate causes were removed on 2026-08-27, and it is still not proven
which — or whether either — was it.**

- No page test closed its browser context, so a full run finished holding fifty
  live Chromium profiles, accumulating while the browser group ran last on an
  already-busy machine. Contexts are now closed as each test ends.
- `test_offline_build` rewrote `data/` on every run, which the page tests then
  read. The runner walks its groups in order so they never *overlap* — that was
  checked and is why this was dismissed once — but "does not overlap" is not
  "does not interact": the browser group was reading a payload rebuilt seconds
  earlier by another process. It is snapshotted and restored now, so the page
  tests see the same bytes every run.

**Evidence, such as it is: six consecutive clean full runs, plus a dozen
incidental ones the same day.** The flake needed two consecutive runs to appear
once, so that is meaningfully more than it took to find — and it is still absence
of evidence rather than evidence of absence, which is why this entry stays open.

**What to do if it recurs.** The output will now name the assertion, which is the
thing nobody had before. Both theories above are dead at that point, and the next
suspect is the one the original entry named and could not test: timing under
load, in a group that runs last after half a minute of subprocesses.

### A backend refresh finds new fissures and the ranking does not move

**Asked for 2026-08-27.** `watchFissures` re-reads `data/fissures.json` every ten
minutes, on load and on `visibilitychange`, and splices the new list into the
array both pages hold. The planner repaints its fissure **badges** from that.
*Where to go* does not re-rank.

**That is currently deliberate, which is what makes this more than a one-liner.**
`PROJECT.md §7` — *"Badges only, deliberately"* — the fold uses a live fissure to
choose which of several identical nodes to name, so re-running the ranking on a
refresh would rename and reorder rows under whoever is reading them, for a reason
that expires within the hour. It is the same call as never letting a fissure into
the score.

So this is a request to revisit a decision, not to fix an oversight, and it needs
an answer to the thing that decision was protecting: **what happens to the reader
mid-read?** Options worth weighing rather than one of them being assumed —
re-rank in place and accept rows moving; re-rank but hold the order until the
reader does something; or offer it, a *"3 new fissures — update the list"* affordance
that re-ranks when pressed, which is the only one that cannot move anything under
anyone. The last is more work and is probably right.

Whatever is chosen, the collection view's *Still needed* panel reads the same
list through the same `opts` and would need the same treatment, or the two go
back to disagreeing about what is reachable — which they did once already.

### A vaulted relic on a Prime you *can* farm another way is still hidden

**What is left of the owned-relics question after 2026-08-27.** A Prime with no
way in at all now shows its relics to trade for — `PROJECT.md §7` has that. The
remaining case is narrower and genuinely undecided: a Prime you *can* get another
way, some of whose relics are vaulted. Those stay hidden, and for that Prime the
filter is arguably right — there is somewhere to go, and burying it under relics
you cannot farm is what *Hide vaulted* exists to prevent.

But it is still true that a player who has been going for years holds a stack of
vaulted relics, and *"which of these do I crack"* is a fair question the page
declines to answer.

**The blocker is unchanged and is about input, not display.** The app tracks
Primes and parts, never relic inventory, and *Relic inventory* is **[settled]**
below as declined — hand-entering a stack is more work than the answer is worth.
Nothing here is worth building until that is revisited or sidestepped.

Two shapes were offered, and **the second shipped on 2026-09-02**:

- **A planner switch**, mirroring the collection view's *Hide vaulted*: *"I have
  vaulted relics"*, and the crack list stops filtering on obtainability. No data
  entry. Note this is exactly the switch the fully-vaulted case deliberately did
  **not** need — there the answer follows from the data, here it depends on
  something only the reader knows, which is the honest reason to have one.
  **Still open, and still undecided.**
- ~~**Say it rather than show it**~~ — **shipped.** The crack list now counts the
  wanted relics the vault filter kept out and says so beneath the rows: *"5 more
  relics are vaulted and not shown — if you are holding any, they are worth
  cracking too."*

**Why the smaller shape went first.** It sidesteps the blocker rather than
pre-empting it: a count needs nothing from the reader, decides nothing about
relic inventory, and does not foreclose the switch. What it fixes is narrow and
real — the filter was **silent**, so a filtered list and a complete one looked
identical, and a reader holding a stack of vaulted relics had no way to know the
page was declining to answer.

Counted only where genuinely wanted: a relic held by the Forma bonus alone is
not something the reader is short of, and counting it would overstate what is
being hidden. Suppressed when the list is empty for the fully-vaulted reason,
which already says so in its own words — two messages saying the same thing
differently is worse than one.

Verified against `Caliban Prime`, chosen off the payload for having both kinds:
12 relics, 7 live and ranked, 5 vaulted and reported. The test derives both
numbers from the payload rather than naming them.

**What is left is the switch, and the blocker under it is unchanged**: the app
tracks Primes and parts, never relic inventory, and *Relic inventory* is
**[settled]** below as declined.

### The rest of the player facts the header could hold

**The Mastery Rank field itself shipped on 2026-08-26** — the reasoning is in
`PROJECT.md §7`, including the Void Trace cap it now derives. What is left of that
entry is the question it deliberately did not answer: **what else belongs in the
same slot.**

Three candidates, all the same shape — a fact about the player that feeds badges
rather than filters:

- **Solaris United standing**, for the Profit-Taker phases.
- **The Steel Path**, which is the interesting precedent. It had a sidebar
  checkbox for one afternoon and it was removed on measurement: every Steel Path
  table carrying a relic is a Faceoff variant identical to its ordinary twin, so
  the option moved the ranking by two duplicate rows and asked a question for
  nothing (`PROJECT.md §7`). If a header of player facts is built out, the Steel
  Path belongs in it as a *fact* — feeding badges, not filters — rather than back
  in the sidebar as an option.
- **The actual Void Trace balance.** The rank gives the *cap* and the planner now
  states it, but a cap is what you can hold and not what you have. The switch
  still asks the cruder question, and *Expected openings for everything* wants a
  real number.

**Not open any more:** whether an unfilled field should prompt once. It does not —
unset stays unset and says nothing, which is the default everything else in this
project takes, and the reason is stronger here than elsewhere: a guessed rank
would feed a trace cap that is simply wrong.

**Still not built, and still the point of the field:** the demand badge. The
worldstate publishes `minMR` per bounty tier and it matches the wiki exactly — MR1
at level 10–30 up to MR10 at 100–100 (see *The worldstate publishes far more than
the two fields we read*). A node could say **"asks MR5"** the same way it says
**"Railjack"**, shown only when the player's rank is below it. The rank is now on
hand to do it; nothing reads it yet.

### The Ghoul and Plague Star detection has never seen a live event

**It gets its chance on 2026-09-09.** The owner brought DE's announcement on
2026-09-02: Operation Plague Star runs **2026-09-09 to 2026-09-23**, all
platforms. Everything below was written not knowing when, or whether, that would
happen — read it as a plan with a start date now rather than as a wait.

**The `tag` half was done on 2026-09-04, before the window.** What it turned out
to be is not what this entry expected, because the matching it asks for was
already shipped — `find_live_events` consults `EVENT_TAGS` before the scan, and
`events_from_worldstate` already extracts `Tag` from `Goals`. **A `TODO.md` entry
is not evidence**, and this one described work that existed.

What was actually missing was **coverage**, and two real gaps came out of writing
it:

- **Two shapes reach the detector and only one was ever tested.** `world_events`
  comes through `from_chain`, so DE give `Goals` — where `Desc` is an internal
  path, `/Lotus/Language/Alerts/TacAlertWaterFight`, observed live on
  2026-09-04 — while the WFCD proxy gives English prose. Every test fed it
  prose. The patterns survive the path form only because `plague\s*star` matches
  `PlagueStar` with `\s*` taking zero characters; tightening it to `\s+` goes
  blind on the source that is asked **first**, and the old prose test keeps
  passing while it does. Verified by making exactly that change and watching the
  new test go red.
- **The tag branch had no coverage at all**, because `EVENT_TAGS` is empty until
  something is seen, so nothing exercised it. It is now tested with a planted
  tag: a known tag decides alone, a tag naming another event beats a keyword that
  agrees, and an **unknown tag falls through to the scan** rather than reading as
  "not this" — which is the failure the empty map exists to avoid.

**And a finding that is not fixed, because it is a behaviour change and the
owner decides.** The syndicate half of `find_live_events` scans
`entry["syndicate"]` for the keyword. Under DE's reader that field holds the
*mapped* faction name, and the four in `SYNDICATE_TAGS` — `Ostrons`,
`Solaris United`, `Entrati`, `The Holdfasts` — are the factions that **give
out** bounties, which is why they are the ones kept. None of their names
contains "ghoul" or "plague star", so **when DE answer, that half cannot fire**.
It only works when the WFCD proxy answers and passes `GhoulEmergenceSyndicate`
through raw. The comment above it still describes WFCD's behaviour and has done
since bounties moved to DE's worldstate on 2026-08-27.

**It matters much less than it first looks, and the owner's point is why.**
Plague Star's bounty is handed out by **Ostrons**, so it arrives as an ordinary
`CetusSyndicate` job rather than as an event syndicate of its own — there is no
"Plague Star syndicate" for that scan to find, and there never was. The syndicate
path was only ever the *Ghoul Purge* path, since a purge does get its own
`GhoulEmergenceSyndicate`. For Plague Star, `Goals` is the whole detector, and
`Goals` works and carries the tag.

Measured 2026-09-04: no unmapped syndicate currently carries jobs, so nothing is
being lost today, and the bounty rows themselves are present all year — the drop
tables carry `Level 15 - 25 Plague Star` and both Ghoul tiers with no event
running, which is precisely why the gating exists.

The bounty clock and the event gating both shipped on 2026-08-12
(`PROJECT.md §7`). One part of it is unverified and cannot be verified on demand:
**neither the Ghoul Purge nor Plague Star was running when it was written**, so the
shape the worldstate gives those events was never observed.

The detection is deliberately loose because of that — a keyword scan across both
`/pc/events` and `/pc/syndicateMissions`, matching on several fields, so an
unexpected shape degrades to "not running" rather than crashing. And a missed
detection is a nuisance rather than a dead end: the *include event nodes* checkbox
still forces those bounties back into the ranking.

**There is a better key than keywords, and it was there all along.** Every event
in `/pc/events` carries a **`tag`** — the two running on 2026-08-12 were tagged
`HeatFissure` (Thermia Fractures) and `WaterFight` (Dog Days). A tag is a stable
machine identifier; a description is prose DE can reword. Match on `tag` first and
keep the keyword scan as the fallback. This still cannot be *confirmed* for Ghoul
Purge or Plague Star without one of them running — their tags are unobserved — but
it means the first sighting yields a permanent answer rather than another guess.

**Also useful when one runs:** `activation`/`expiry` are already used, but events
carry `node` (`"Orb Vallis (Venus)"`), `maximumScore`, `interimSteps` and
`rewards[]` too. Capture the whole entry, not just the window.

**What to do when one of them next runs:** refresh the data, check the build log
says `limited-time events running - Ghoul Purge` (or `Plague Star`), and confirm
the bounty appears in the planner without the checkbox. If it does not, capture the
raw worldstate entry — that is the fixture this cannot be written against today.
Plague Star matters most: it carries 26 relics, more than any other bounty.

### The worldstate publishes far more than the two fields we read

Swept 2026-08-14, at the owner's suggestion. **Most of it was read on 2026-08-24**
and the reasoning is in `PROJECT.md §7`; what is below is what is left.

| Field | What it is | State |
|---|---|---|
| `uniqueName` | ends `…Tier<X>Table<Y>Rewards` | **read.** The letter, per tier — and the tiers disagreed |
| `standingStages[]` | its length is the stage count: 3, 4 or 5 by tier | **read.** `objectivesOf` no longer assumes four |
| `enemyLevels[]` | e.g. `[40, 60]` | **filled**, from the group's own name — all 13 bounty nodes carry levels now |
| `tag` on `/pc/events` | `HeatFissure`, `WaterFight` | **recorded when seen.** Still unobserved for our two events — see below |
| `minMR` | Minimum Mastery Rank, 0 to 10 | **declined 2026-08-27 [settled].** Built as a demand badge and reverted the same day — see below |
| `type` | **not what this row said.** DE publish `jobType`, a path — `VenusHelpingJobResource` | **blocked 2026-08-27** — the readable name is WFCD's mapping table, and rule 9 gates it. Owner's call |
| `rewardPoolDrops[]` | **not published by DE at all.** `rewards` is a table *path* | **declined 2026-08-27 [settled]** — the cross-check would compare our join against WFCD's join of the same two sources |

**`type` is the one with a trap in it.** Our node names are the join key between
DE's drop table and the worldstate, and they are what `ROT.signature` folds on and
what `nodeKey` matches fissures against. Renaming them is not a display change. If
this is done at all it wants to be an annotation beside the name, not a
replacement — and it overlaps with *Our four invented "mission types" leak into the
ranking*, which is the same problem one level up.

**Both rows above were written about a feed this project no longer reads, and
checking them on 2026-08-27 changed both answers.** They describe
`api.warframestat.us/pc/syndicateMissions`; bounties moved to DE's own worldstate
earlier the same day. A whole DE job is six fields and no more:

```json
{ "jobType": "/Lotus/Types/Gameplay/Venus/Jobs/VenusHelpingJobResource",
  "rewards": "/Lotus/Types/Game/MissionDecks/VenusJobMissionRewards/VenusTierATableCRewards",
  "masteryReq": 0, "minEnemyLevel": 5, "maxEnemyLevel": 15,
  "xpAmounts": [430, 430, 430] }
```

**`rewardPoolDrops` does not exist — declined. [settled]** DE publish `rewards` as
a **table path**, not a list of drops. WFCD's `rewardPoolDrops` is WFCD joining
that path against DE's drop tables — the same two sources this project already
holds and already joins itself, which is how the rotation letter is read. So the
"cross-check against DE's static table" would be checking our join of DE against
WFCD's join of DE. It confirms nothing that a disagreement could not equally
blame on the third party. `official.py` sets `rewardPool: []` and says so.

**`type` is blocked on a rule-9 decision, not on effort.** DE publish an
identifier, not a name: `VenusHelpingJobResource`, `RescueBountyResc`,
`AssassinateBountyCap`. The readable *"Reclaim What's Ours"* this row used to
quote is **WFCD's own mapping table** on top of that identifier — and a mapping
table lifted verbatim needs the owner's approval first and its licence read
second (`PROJECT.md §2`). Three ways forward, and only the owner can pick:

1. **Leave it.** The job on the board turns over every window — all 22 jobs share
   one expiry — and the flavour name says nothing about what pays a relic. This
   is the recommendation.
2. **Derive a kind from DE's identifier ourselves**, by rule rather than by
   table: `RescueBountyResc` → *Rescue*, `VenusCullJobAssassinate` → *Assassinate*.
   Deterministic and ours, and still a fact about the current window rather than
   about the tier.
3. **Ask about WFCD's table** — approval, then licence.

**One thing in `jobType` is worth having whatever is decided about names.**
Isolation Vault bounties arrive with **no `jobType` at all**, which is DE's own
signal for the vault family and cleaner than the level-matching used today.
`official.py` notes it and deliberately does not act on it, because changing how
the family is decided is its own change with its own risk to the rotations.

**And `type` never reached the payload anyway.** It was read into the job record
and dropped one step later, where the group row copies `letter`, `stages` and
`minMR` and nothing else — so no build has ever emitted one, while
`read_bounty_jobs`' docstring said it did. Measured: 0 of 24 groups carried a
`type`, against 20 of 23 DE jobs carrying a `jobType`. The dead field and the
wrong docstring are both gone; restoring it is four lines if option 2 or 3 wins.

**`minMR` is Minimum Mastery Rank**, the account-wide progression rank — earned by
levelling frames, weapons and Intrinsics and passing a test per rank, capped at 30
before Legendary ranks. Checked against
[the wiki's Bounty page](https://wiki.warframe.com/w/Bounty), which matches the
worldstate tier for tier:

| Bounty level | Wiki | `minMR` |
|---|---|---|
| 5–15 | no mastery lock | 0 |
| 10–30 | MR 1 | 1 |
| 20–40 | MR 2 | 2 |
| 30–50 | MR 3 | 3 |
| 40–60 | MR 5 | 5 |
| 100–100 | **MR 10 and The Steel Path unlocked** | 10 |
| 50–70 Narmer | no requirement | 0 |

**Two caveats that stop this being a filter.** First, the wiki: *"These can still be
played, when an eligible squad member selects one."* The rank gates **selecting** a
bounty, not running it — so excluding a tier outright would be wrong for anyone
playing with friends. Second, the 100–100 tier carries a **second** gate the
worldstate does not publish at all: The Steel Path must be unlocked.

So this is not a candidate for the exclusion rule.

**It was built as a demand badge on 2026-08-27 and reverted the same day, at the
owner's direction. [settled] — do not re-propose.** The rank field had just
shipped, which lifted the only blocker this entry named, and that turned out to
be the wrong reason to build it. The owner's reasoning, which is better than the
entry's:

- **Nobody it would help is here.** The tool is a relic-farm planner; a player
  below MR 5 is not the reader. All six gated relic-bearing nodes are Isolation
  Vaults at MR 5, so the badge would show for a reader who almost certainly does
  not exist and never for anyone else.
- **It is the player's own job.** Whether you can enter a mission is something
  you look up in game, in the place that will tell you authoritatively. A badge
  here restates it less reliably and one step further from the truth.
- **The strip has to earn every entry.** `Railjack`, `Steel Path` and `Old Mate`
  each say something the reader cannot work out from the row. A rank gate almost
  nobody is behind does not.

What that leaves is a general rule worth keeping past this entry: *the blocker
lifting is not the same as the case being made.* This one had been waiting on the
rank field for so long that its arrival read as permission.

Two pieces of the reverted work are worth knowing about if anything ever does
read the rank, because both cost a measurement to find:

- **`minMR` sits on `meta.bounties.groups[node]`, not on the source row**, even
  though the worldstate calls it a job field. Nineteen of twenty-four groups
  carry one; none of the 96 bounty source rows does. Reading `source.minMR`
  returns nothing and fails silently.
- **`wireMastery` is `once()`-guarded**, so a single `onChange` callback is
  dropped for whichever page runs second in the single-file build. Anything that
  needs a repaint on a rank change needs a subscriber list, not a callback.

## Settled — answered, kept so the answer is not lost

### The planner cannot say how many missions to run **[settled]**

**Deliberately parked.** Each relic row estimates the *openings* needed, but not the
missions — that would be openings divided by how often the relic drops at the chosen
node. It is a probability, not a plan: the number would be an expectation with a very
wide spread, and reading it as "this many runs" would mislead more than it helps. Low
value, kept only so nobody proposes it again without a better idea.

The node list being a top eight rather than a table used to be a sentence at the
foot of this entry, which was the wrong place for it — it is open work, not a
settled answer. It has its own entry above.

### Collection does not sync between devices **[settled]**

**Backup/Import is the answer for now**, and it is complete — it carries the
collection, per-part progress, materials, the farm list, filters and planner options.
Automatic sync would need a server and an account, which is exactly what this project
avoids. Revisit only if a serverless option appears that keeps the data local.

### Prime Resurgence is the only non-first-party source **[settled — overturned 2026-08-27]**

**This answer was wrong and the work is open again**, above, under *The live
worldstate has a first-party route after all*. Kept here rather than deleted
because how it was wrong is the useful part.

It said: DE's own `worldState.php` returns 404 on both `content.` and
`origin.warframe.com`, so the live Resurgence rotation comes via the WarframeStat
proxy, and **"there is no first-party route to find"** — nothing to do until DE
publish one.

Both 404s were true and are still true. The conclusion drawn from them was not:
`https://api.warframe.com/cdn/worldState.php` serves the full worldstate, 127 KB,
and was doing so all along. **Two hosts failing was read as the question being
closed**, and it was written down as a settled answer, which is the form that
stops anyone looking again. Nobody had tried a third host until the owner did, on
the day the proxy went down and it mattered.

The shape to take from it: *"we tried and could not find one"* is a report about
the search, not about the world, and a `[settled]` tag on one of those is a claim
the evidence does not support. Two of the four entries under this heading are of
that kind.

### Enemy levels are missing for 31% of live-relic nodes **[partly reopened]**

Levels come from DE's `ExportRegions_en.json` (269 nodes, `minEnemyLevel` /
`maxEnemyLevel`), joined after stripping the `Event:` prefix. The gap is entirely
Railjack/Proxima nodes, which DE's export omits.

**This is fine as it stands.** Unknown levels sort last rather than being guessed at,
which is the correct behaviour — a made-up level would silently distort the tie-break
that levels exist to serve. Kept as a note so the 69% figure is not mistaken for a
join bug.

**Reopened in part on 2026-08-14, and that half closed on 2026-08-24.** All 13
bounty nodes had `lvl: null` and lost every level tie-break by default. They now
carry levels, read from the group's own name — `Level 40 - 60 Cetus Bounty` is a
bounty fought at 40-60, so it needs no network and works on a mirror build. The
worldstate publishes the same numbers as `enemyLevels`, which is how the two were
checked against each other.

**The Railjack half stands and is still fine.** DE's export genuinely omits
Proxima, and an unknown level sorting last is the correct behaviour — a made-up one
would silently distort the tie-break that levels exist to serve.

### Event nodes cannot be tied to their event **[settled]**

DE's drop table says only `Event: <planet>/<node>`, never which event, and the live
worldstate does not link an event back to a drop-table node. The node only exists on
the star chart while that event is running.

**So event nodes are excluded from the ranking entirely**, with an opt-in checkbox for
when you know one is live. Without a first-party mapping there is nothing better to
do: showing them by default sends you to missions you cannot find. Revisit only if DE
publishes the link.

### Relic inventory **[settled]** — do not re-propose without a better input method

This is the single biggest inaccuracy in the planner: every score is *per reward
drop*, so it ignores the stack of relics you could already be cracking. The blocker
is data entry, not value. The game offers no export, and typing in a relic
collection by hand is unreasonable when a long-standing account holds hundreds, most
of them vaulted and irrelevant.

What would unblock it: only the **currently-live relics** can affect a plan, so a
future attempt should ask about those alone — one screen of counters, re-asked when
the drop tables change. Any design that needs the vaulted ones is the wrong design.

### A third squad state for public radshares **[settled — declined]**

Raised by an outside review as *"Radiant or Intact is all a recruiting-chat squad
can agree on"*, and **declined by the owner on 2026-08-25**: the public-radshare
case is a niche this app will not model. Do not re-propose it.

The review itself misread the existing option. The box is **4-man premade** and says
so; a coordinated group can run any refinement, and it already unlocks Disruption's
rotation A, which needs the squad to under-defend conduits on a schedule.
Restricting it to Intact and Radiant would make it describe something it does not
claim to be.

What a third state *would* have modelled is narrower than it sounds — not the squad
odds, which the existing box already covers, but the loss of **refinement choice**:
a radshare gives you four rolls at a refinement that is not yours to pick. Measured
over the live set before the call was made, so the size of what is being given up
is on the record:

- Wanting **everything** from a relic: the model picks Radiant on **all 34** live
  relics, squad on or off. Forcing Radiant changes **nothing** — this is exactly
  the *"an option nobody's answer changes"* case `PROJECT.md §7` rejects.
- Wanting **one specific part**: it picks Intact on **88 of 180** combinations,
  because a common reward is likeliest Intact. There, forced Radiant costs 0.5
  openings with a premade and 2.1 without, plus 100 traces each.

So the effect is real but confined to single-part farming in public squads, and it
would add a third state to a sidebar question to say it. The trade was judged not
worth the control.

---

## Should be fixed on the wiki, not here

These are places where Warframe Prime Hunter knowingly disagrees with
[`wiki.warframe.com/w/Prime`](https://wiki.warframe.com/w/Prime), the page the Prime
catalogue is parsed from.

**The policy is to keep our data faithful to that source and push corrections
upstream**, rather than entrenching a workaround in code. So each entry below is a
wiki edit waiting to happen. Where the app cannot wait, the local workaround is
named so it can be removed once the wiki is corrected.

### Gotva Prime is marked `(S)` but is a Baro Ki'Teer item

Its own wiki page says so outright — *"potentially sold by Baro Ki'Teer in the
Concourse section of the Tenno Relay"* — and it already carries `(B)`, so the `(S)`
is simply redundant.
**Local workaround:** `statusOf()` ranks Baro above Special, which puts it in the
right bucket. Remove that ranking once the `(S)` is dropped from the Prime page.

### The `(R)` Prime Resurgence markers are years out of date

The page still lists the December 2021 debut rotation and carries an `{{UpdateMe}}`
tag.
**Local workaround:** the markers are parsed and then ignored entirely — Resurgence
status comes from the live worldstate instead. Nothing here needs changing even if
the wiki is fixed, since the worldstate is simply a better source, but the page is
misleading anyone reading it directly.

### `(V)` vaulted markers are trusted less than the item API

Where the two disagree, the API's `vaulted` field wins. Worth spot-checking which is
actually right before deciding whether this is a wiki problem or one of ours.

### The wiki contradicts itself about Isolation Vault rotations

[`Isolation Vault`](https://wiki.warframe.com/w/Isolation_Vault) says the vault drop
tables *"rotate once every Fass/Vome cycle (2.5 hours or 150 minutes) in a ABCABC…
pattern"*. [`Cambion Drift`](https://wiki.warframe.com/w/Cambion_Drift) describes the
same tables as *"AAA AAA BBB CCC, repeating"* across a run's stages — a per-stage
rule, not a clock.

Our own readings of the live worldstate back the first one: all three vault chambers
sat on the same letter at the same moment, matched DE's published pool for that
letter exactly, and advanced together at the 150-minute boundary. Two builds either
side of one changeover saw B → C across all six vault tiers.

**No local workaround** — the app follows the clock, which is what the evidence
supports. The second page is what needs correcting.

### Not wiki issues

Recorded here only so they are not mistaken for one:

- `normalise_part()` reconciles two APIs with each other (`Chassis` versus
  `Chassis Blueprint`). Nothing to do with the wiki.
- Reward rarity is derived from the unrefined drop chance because **DE's** own
  rarity words are chance-relative and shift with refinement. A Digital Extremes
  data quirk.
- Item categories are read from the wiki deliberately — see `PROJECT.md §7`.
- The five non-relic categories are dropped from the catalogue by us, not by the
  wiki, which lists them correctly — see `PROJECT.md §9`.
- **One item has no `releaseDate` and no `vaultDate`** — Kavasa Prime Collar, and
  it is the only one of the 167. Both fields come from the `warframestat.us` item
  API, which returns `null` for them, so this is an **upstream API gap and not a
  wiki one**: the wiki page has the answer and was checked on 2026-08-26.

  [`Kavasa Prime Kubrow Collar`](https://wiki.warframe.com/w/Kavasa_Prime_Kubrow_Collar)
  says it was released **alongside Trinity Prime and Dual Kamas Prime**, entered
  the vault on **29 August 2017**, and came back out between 26 May and 29
  September 2020. Both of its cohort are in our catalogue and agree exactly:
  `releaseDate` `2015-10-06` and `vaultDate` `2017-08-29` for each. So the two
  missing values are **known, and sourced** — `2015-10-06` and `2017-08-29`.

  **No local override has been added**, deliberately, because nothing today reads
  either field for this item: it is vaulted and not farmable, so `vaultSoon` —
  the only other reader — excludes it whatever the date says, and sort placement
  is handled without one (`byRelease` in `app.js` puts an undated item last, by
  rule rather than by the direction the comparison happens to run). Adding the
  override is a two-line change in `build_data.py` if the owner would rather have
  the field populated than empty; the argument against is `PROJECT.md §2`'s, that
  a hand-patched value is a thing nobody re-checks when upstream fixes it.
  **Worth revisiting if it ever becomes farmable**, because `vaultSoon` would
  then skip it silently.
