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

### The worldstate is already cached, and barely read

**Mostly read now.** The sweep of 2026-08-24 took the rotation letter per tier, the
stage counts and the bounty levels; `PROJECT.md §7` records what that corrected.
What is left of the entry is two fields and a warning about one of them.

| Entry | What is left | Size |
|---|---|---|
| The worldstate publishes far more than the two fields we read | `type` (with a trap in it) and `rewardPoolDrops` as a cross-check | session |
| Baro's actual stock is published, and never read | what he is really selling — **his `Manifest` is empty between visits, so check it 2026-09-04 to 09-06.** The *say when* half shipped 2026-08-27 | session |

### Model and ranking

| Entry | Size |
|---|---|
| Seven rotation-bearing mission types are still unverified | **five now** — `Legacyte Harvest` verified AABC, `Skirmish` undocumented, `The Circuit` disputed; checked 2026-09-02 |
| `The Circuit` may be two different modes wearing one name | **the owner's, to settle in game** — the wiki and DE's tables describe different things |
| `RUN_OVERHEAD` is two *rewards* on a node where a reward is two zones | small — no effect today, left open on purpose |
| Our four invented "mission types" leak into the ranking | session |
| Baro's relics should be crackable, the way Varzia's are | session — the owner's, 2026-09-01; the pattern already exists, this is applying it |
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

### Interface

| Entry | Size |
|---|---|
| The planner's search finds Primes, never parts | session — the owner's, 2026-09-01 |
| Digital Extremes 403 the GitHub runner | **watching** — the defect is fixed and verified on CI; the 403 is frequent, so the deployed site's live feeds now lean on WFCD |
| One Cambion Drift tier labels a different letter from the rest of its family | small to check, unknown to fix — 16 against 1, so margin rather than a wrong answer |
| The page tests flake in a full run and pass on their own | watching — two causes removed and the runner now names the failing assertion; six clean runs since |
| A backend refresh finds new fissures and the ranking does not move | session — the deliberate half of this is the hard half |
| A vaulted relic on a Prime you *can* farm another way is still hidden | small — the narrow half of the owned-relics question, left open on purpose |
| The rest of the player facts the header could hold | session — the rank itself shipped 2026-08-26 |
| A priority flag on the farm list | session |

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
| Plague Star and Profit-Taker are the same shape, modelled two ways | Plague Star to run |
| The Ghoul and Plague Star detection has never seen a live event | either event to run — the `tag` half can be done now |
| Expected openings for everything, not for the worst one — measured, and it costs traces | nothing — *are you trace-limited?* was answered at 500 on 2026-08-25; this is now ordinary work |

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

**What is left is the stock itself, and it cannot be checked yet.** His
`Manifest` is **empty between visits** — measured at 0 entries on 2026-08-27,
eight days before he arrives — so whether it names what he is selling, and in
what shape, is unknown. **Check it while he is present: 2026-09-04 to
2026-09-06.** Until then anything written here about his inventory would be a
guess, and this project has already been caught once reading a field whose name
matched and whose contents did not (`Events` versus `Goals`).

If the manifest does carry his stock, it answers the *"what is he really
selling"* half below with first-party data and no wiki marker involved.

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

### Baro's relics should be crackable, the way Varzia's are

**Asked for by the owner 2026-09-01.** Baro Ki'Teer should behave like Prime
Resurgence: **you buy the relic from him, and it then appears in *How to crack
them*** with a refinement and an openings figure, like any other relic you hold a
route to.

**The pattern already exists and is shipped**, which is most of why this is worth
doing. A Resurgence relic is vaulted by definition — that is what being in
Resurgence means — so `rec.vaulted` alone dropped every one of them out of the
plan, and a Resurgence Prime produced a planner with nothing to say. The fix was
to let a relic reach the crack list when it is *obtainable* rather than when it
*drops*, and to badge the row with where it comes from: `from-varzia` on the row,
no ranked node underneath, and a sentence saying why there is nowhere to run.
Baro wants exactly that shape with a different badge.

**Why it is not a one-line change.** Two things differ from Varzia:

- **Varzia's shelf is known and Baro's is not.** DE publish neither directly, but
  Varzia's rotation is recoverable from the relic naming — `...VoidProjection<Rotation>Vault...`
  against the packs she is selling — and that is how her six are found. Baro has
  no equivalent: `PrimeVaultTraders` carries her; `VoidTraders` carries him, and
  his `Manifest` was **measured empty between visits** on 2026-08-27. Whether it
  names relics while he is present is still unknown, and the window to find out
  is the two days a fortnight he is on a relay. **Check it 2026-09-04 to 09-06.**
- **He is only there two days a fortnight.** Varzia is continuous, so her relics
  are always buyable; Baro's are buyable now or in twelve days. A crack list that
  says "buy it from Baro" while he is away is the same wrong-`true` the
  availability filter already avoids — `meta.baro` ships his window and the page
  decides against its own clock, so the row has that fact available and should use
  it.

**So the order of work is:** read his manifest while he is here, and only then
decide whether this is "the relics he is selling today" or the weaker "the relics
he is known to sell sometimes". The first is worth building; the second may not
be, since the wiki marker `flags.baro` already covers *sometimes* and nine items
sit behind it.

**The place he goes now exists**, which takes a piece off this. *How to crack
them* gained a control strip on 2026-09-01 — tier tabs, and a checkbox per
errand shown only when that errand is on the list: `Varzia 6` and `Trade 717`.
Baro is a third errand in exactly that shape, so the interface half is a few
lines rather than a design. What is still missing is the only hard part, and it
is unchanged: **there is no such thing as a Baro relic in the payload.**
`flags.baro` sits on nine *items* and means "he sometimes sells this Prime", so
a box built on it would sit beside Varzia's answering a visibly different
question. That is why it was left out rather than approximated — see
`PROJECT.md §7`.

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

### Plague Star and Profit-Taker are the same shape, modelled two ways

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

### The planner's search finds Primes, never parts

**The owner's, 2026-09-01.** The planner's *Add a Prime to your list* box matches
whole Primes. They want it to offer **parts** as well, and selecting a part to
**mark that part collected** — the same tick the collection page's drawer gives
you, reachable from the planner without changing page.

Why it is worth doing: the planner is where you are standing when a part
actually drops. You have just run Hepit, you have the Neuroptics, and the tool
that told you to go there cannot record it — you switch to the collection page,
find the Prime, open the drawer, and tick. The two pages are meant to be equal
tools over one dataset, and this is the one errand that forces a page change.

Worth settling before it is built, because none of these is obvious:

- **One box or two.** The box currently answers "what do I want to farm"; this
  makes it answer two questions with one control, and the result list would mix
  a Prime you are about to *wish for* with a part you are about to *own*. Two
  kinds of result in one list needs a visible difference, not just an icon.
- **What selecting a part does when you do not have the Prime on your list.**
  Ticking a part of a Prime you are not tracking is legitimate — you got a drop
  you were not chasing — so it should not silently add the Prime to the farm
  list, and it should not silently do nothing either.
- **Parts outnumber Primes about four to one.** 167 items against roughly 640
  parts, so a naive merge buries the Prime results. Ranking, or a section per
  kind, has to be decided rather than fallen into.
- **`itemCount` means a part can be wanted more than once** — 53 of them need
  two or more. A single tick cannot express "I have one of the two Systems", so
  either the search offers a count or it only handles the common single case and
  says so.

The store side is already there and is the cheap half: `KEY_PARTS` is shared,
both pages read and write it, and a part ticked on either shows on the other —
that is tested. This is a search and a result list, not a new piece of state.

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

Worth checking against a live window rather than the cached one, since a single
reading cannot tell a misfiled job from a genuinely different phase on Deimos.
If Deimos really does run its own rotation phase, the family split is too coarse
and that is a larger and more interesting problem than a misfiled bounty.

### The page tests flake in a full run and pass on their own

**Observed twice on 2026-08-27, in consecutive full runs, on two different
tests**, each of which then passed standalone:

```
FAIL js: the licence and privacy notice is at the foot of both pages, identically
FAIL js: the collection drawer can show more than its eight best places
```

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

Two shapes, if it is:

- **A planner switch**, mirroring the collection view's *Hide vaulted*: *"I have
  vaulted relics"*, and the crack list stops filtering on obtainability. No data
  entry. Note this is exactly the switch the fully-vaulted case deliberately did
  **not** need — there the answer follows from the data, here it depends on
  something only the reader knows, which is the honest reason to have one.
- **Say it rather than show it**: where a wanted Prime has vaulted relics it is
  not being shown, count them — *"3 more, vaulted"* — so the reader knows the
  list is filtered rather than complete.

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
