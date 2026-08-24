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
The first of them, *four Primes whose second sub-weapon cannot be recorded*, is the
most serious defect on this list; it sits where it does only so the group it arrived
with stays intact.

---

## What is open, at a glance

**Swept against the code on 2026-08-24.** Every row below was checked to still be
true; two entries had shipped and were rewritten to what is actually left of them.
Titles are given verbatim so they can be grepped — each one is a `###` heading
further down, where the reasoning lives.

*Size* is honest rather than optimistic: **small** is a few lines and one file,
**session** is an afternoon including the test, **large** touches the pipeline, the
payload and both pages.

### Wrong on screen — do these first

| Entry | Where | Size |
|---|---|---|
| Four Primes need two of a sub-weapon, and the store cannot count to two | `build_data.py`, `app.js`, `tests/` | large |
| Unticking one availability box hides items that have a second source | `app.js` | session |
| Banking a part from the drawer rebuilds the drawer and drops the focus | `app.js` | session |
| A Profit-Taker phase is costed at four bounty stages | `rotation.js` | session — do with the worldstate sweep |
| Choosing *Stay for the fissure bonus* leaves the collection page blank | `index.html` | small |
| The two pages can name different nodes for the same folded group | `app.js` — one argument | small |
| Both clocks stop dead in a background tab, and nothing catches up on return | `plan.js` | small |

### Sentences that are no longer true

| Entry | Where | Size |
|---|---|---|
| The page says it cannot see fissures, on a row showing a fissure | `plan.js`, three places | small |
| Three comments describe things that no longer exist | `schedule.ps1`, `index.html`, `build_data.py` | small |

### The worldstate is already cached, and barely read

| Entry | What it unlocks | Size |
|---|---|---|
| The worldstate publishes far more than the two fields we read | stage counts, bounty levels, `minMR`, real bounty names | large — parent of the two below |
| Read each bounty's rotation letter directly — the worldstate already says it | one node's Aya today, correctness always | session |
| Baro's actual stock is published, and never read | *back in 6 days* on the label; what he is really selling | session |

One more sits under **Settled** and should not be read as closed: *Enemy levels are
missing for 31% of live-relic nodes* is marked **[partly reopened]**, and the
reopened half is free — all 13 bounty nodes still carry `lvl: null` (verified
2026-08-24) while both the worldstate and our own node names give the numbers, so
bounties lose every level tie-break by default. Same sweep, same sitting.

### Model and ranking

| Entry | Size |
|---|---|
| Several of those modes are not round-based at all | session |
| Our four invented "mission types" leak into the ranking | session |
| What the misses are worth, in Ducats | session |
| A concentrated farm finishes a relic sooner than a diluted one | session — needs a size chosen by hand |

### Interface

| Entry | Size |
|---|---|
| The planner can only be ranked one way | session |
| A Mastery Rank field in the header | session |
| A priority flag on the farm list | session |
| A part you cannot reach still reads as one you can | session — hypothetical on today's data |
| The endless-fissure bonus is only stated on the collecting side | small |
| The Railjack opt-in gate stands in front of your only option | small |
| The node list is the top eight and a hover, not a table | small |
| The meta line is now 6.68:1, and the floor is 7:1 | small — a decision, not a fix |

### One refactor

| Entry | Size |
|---|---|
| The two pages own the same state, and have already drifted twice | large |

### Cannot be finished today — and why

| Entry | Waiting on |
|---|---|
| Plague Star and Profit-Taker are the same shape, modelled two ways | Plague Star to run |
| The Ghoul and Plague Star detection has never seen a live event | either event to run — the `tag` half can be done now |
| Void Traces: the exchange rate that would let them be scored | one answer from the player: *are you trace-limited?* |
| Expected openings for everything, not for the worst one | the line above — the same trade decides its sign |
| Radiant or Intact is all a recruiting-chat squad can agree on | a decision about a third sidebar option |
| Nine rotation-bearing mission types are still unverified | wiki checking; tedious, not blocked |

### Not work

The availability precedence asks for something that is **already true** — see its
entry. *Conditioning the fissure bonus on a live fissure* is **[settled]** against.
Six answered questions sit under **Settled**, five of them closed and the sixth
partly reopened as noted above. Four wiki edits sit under **Should be fixed on the
wiki, not here** — those are edits to `wiki.warframe.com`, not to this repository.

---

## Defects found by the documentation sweep of 2026-08-15

Four of these were introduced on 2026-08-14 by changes that were themselves right;
none was caught by the suite. They are grouped because they share one cause: a
capability landed and the sentences explaining why it was absent stayed where they
were.

### The page says it cannot see fissures, on a row showing a fissure

**The sharpest of the five, because both halves are on screen at once.** Verified
on one planner row:

| Element | Says |
|---|---|
| `.tag.fissure` badge | `Meso fissure 39m` — *"A Meso fissure is running here, closing 12:13 PM."* |
| `.est` marker, the next item along | `+relic if fissure` — *"Only if this node is a fissure — **nothing here knows that**."* |

Three places carry the old claim, all in `plan.js`:

1. the `+relic if fissure` tooltip (`"nothing here knows that"`),
2. `RUN_BLURB.bonus`, shown under *How this works* — *"Nothing here knows which
   nodes carry a fissure: they move every hour or two and **this data is refreshed
   daily**"*. The scheduler has run hourly since 2026-08-14 and the build fetches
   `/pc/fissures`,
3. the block comment above `fissureBonus` — *"because nothing here can know
   that… Fetching the live list was considered and rejected."* It was fetched, in
   the commit before.

**The decision is not in question — the reason given for it is.** Keeping fissures
out of the score is right and `PROJECT.md §7` argues it properly: a fissure lasts an
hour or two, the ranking is built from tables that move a few times a year, and a
list that reshuffles hourly on an expired fact is one you stop trusting. What the
page must say is *"we can see this and deliberately do not score it"*, not *"we
cannot see this"* — the second is false and the badge beside it proves so.

Worth noting how this survived: the commit that deleted the decisions table
identified this exact defect, rewrote the sentence in `TODO.md`, and left the
identical sentence in the product. A doc and a string can drift apart even when one
person fixes both in the same hour.

### The two pages can name different nodes for the same folded group

`pickNode(group, first)` takes the fissure test as an argument. `plan.js` passes it;
`app.js` calls `pickNode(group)` with nothing. So with a fissure live at a member
that is not the lowest-level one, the planner names that node and the collection
view names another — and since the picked node *becomes* the row, the level, planet
and demand badges differ too.

Verified against the real Gaia group with a fissure planted at Cinxia: planner
`Cinxia`, collection `Gaia`.

Both `app.js` and `PROJECT.md` claimed in as many words that the two pages **cannot**
disagree about which of a group to name. `PROJECT.md` now records the defect
instead; the comment in `app.js` still makes the claim.

Two ways out, and the first is better: pass the same predicate from `app.js`, or
drop the guarantee and say the collection view deliberately ignores the hour. The
first keeps a promise the project has made in three places.

### Choosing *Stay for the fissure bonus* leaves the collection page blank

`plan.html` offers four run modes; `index.html`'s `#f-runmode` offers three; the
setting is one shared key. Verified:

| Stored `runMode` | Collection dropdown | Ani (Survival) row |
|---|---|---|
| `reset` | "Reset as soon as it drops" | 4 rounds · 22.8% per run |
| `bonus` | **blank** — `selectedIndex: -1` | **5 rounds** · 28.9% per run |

So the collection view silently costs every endless node an extra round while its
own control shows nothing selected, and it never adds the bonus relic that fifth
round is for — that part is planner-only. Whoever touches the box next writes a
different mode back and changes the planner too.

Add the option to `index.html`. If the bonus genuinely does not belong on the
collection page, the fix is to say so on the control rather than to omit the value
it is already using.

### A Profit-Taker phase is costed at four bounty stages

`objectivesOf` returns `{count: 4, unit: "stage"}` for anything DE files under
`Bounty`, and DE files the heist there. Each phase is one activity you replay on its
own, so its rate is divided by four and it sinks accordingly. Confirmed against the
live model: `objectivesOf` → `4 stages` for `PROFIT-TAKER - PHASE 1`.

**Its own entry specified this and the entry was marked done** — *"Effort: one
objective per run"* was step 4 of four, and the other three shipped. Everything else
about the heist is right: no rotation, not on the bounty clock, `Old Mate` badge,
four independently replayable phases (`PROJECT.md §7`).

This is the same shape as the wider bug below and wants fixing with it: **`objectivesOf`
hard-codes four stages for every bounty**, while `/pc/syndicateMissions` publishes
`standingStages[]` per tier, whose length is 3, 4 or 5. Do both at once.

### Three comments describe things that no longer exist

Cheap, and each one will mislead somebody:

- `tools/schedule.ps1`, `.DESCRIPTION` — *"the fissure **strip** on the planner"*.
  The strip was replaced by per-row badges six hours before that file was last
  touched. This one is user-facing: it is what `Get-Help` prints.
- `index.html`, the materials hint — *"nothing here feeds the farm advice. Forma
  will, once the planner lands."* The planner landed, and the Forma row **is** what
  the planner reads.
- `tools/build_data.py`, above `FISSURE_TIERS` — justifies keeping `Omnia` as *"the
  most useful line of the lot"*, which was about a per-tier strip that no longer
  exists. The reason to keep Omnia now is simply that a node with an Omnia fissure
  is a node with a fissure.

---

## Brought in by two outside reviews, 2026-08-24

Two documents arrived on 2026-08-24: a **code review** of four points, and a
**logic and model roadmap** of eleven. Every claim in both was checked against the
code and the live dataset before being written down here, because several of them
were wrong about what this app currently does — and a proposal argued from a
misreading needs re-arguing, not implementing. Where that happened the correction
is kept with the entry rather than quietly dropped.

Two of the fifteen turned out to be defects with symptoms you can see on screen,
and the first of them is the worst thing in this file. Three were already covered
by entries elsewhere here. Two are settled against, one of them by measurement
taken while checking it.

| Source | Asked for | Verdict |
|---|---|---|
| roadmap 6 | compound weapons track sub-weapons as parts | **defect, worse than described** — see below |
| roadmap 4 | a filter should not hide an item with a second source | **defect**, on 3 items, and backwards from the example given |
| review 4 | catch the clocks up on `visibilitychange` | **defect**, and the interval is 60s not 30s |
| review 1 | update rows in place instead of rebuilding | **partly already done** — the drawer is the one that is not |
| roadmap 2 | a toggle between score per objective and per run | open, and `STYLE.md §5` says what it obliges |
| roadmap 5 | read Baro's live stock from `/pc/voidTrader` | open, with a trap in the "disable the box" half |
| roadmap 3 | reorder the availability precedence | **the stated goal is already true**; the order as written empties the Founder bucket |
| review 2 | one `State` controller in `shared.js` | open, and the two pages have already drifted twice |
| review 3 | a priority flag on the farm list | open, but not via `stillNeed` |
| roadmap 10 | Ducat value of the non-wanted drops | open; measured at a 1.9× spread |
| roadmap 7 | expected openings for *all* parts, not the worst one | **measured: changes 5.4% of live cases, for 4.5% fewer openings at double the trace price** |
| roadmap 8 | restrict squad refinements to Intact/Radiant | **misreads the option**; the missing case is public radshare |
| roadmap 11 | reward concentrated farms over diluted ones | open, and the only one here nothing observable can check |
| roadmap 9 | score Void Traces on ESO and Void Storms | already an entry above; one correction to it |
| roadmap 1 | condition the fissure bonus on a live fissure | **[settled] against** — the observation behind it is already an entry above |

### Four Primes need two of a sub-weapon, and the store cannot count to two

**The worst defect currently known, and it is a data-shape problem wearing a UI
problem's clothes.** Four akimbo Primes are built from two copies of the
single-handed Prime, and DE's item database says so by listing that component
**twice**, `itemCount: 1` each — confirmed in the warm cache (`.cache/api_items.gz`):

```
Aklex Prime     Blueprint · Lex Prime · Lex Prime · Link
Akbronco Prime  Blueprint · Bronco Prime · Bronco Prime · Link
Akmagnus Prime  Blueprint · Link · Magnus Prime · Magnus Prime
Akvasto Prime   Blueprint · Link · Vasto Prime · Vasto Prime
```

`tools/build_data.py` copies that faithfully, so four items in `data/prime-data.json`
carry two parts with the same name. **Part ownership is keyed by part name** —
`{ itemId: { partName: count } }`, `assets/app.js` — so the two entries share one
slot and there is nowhere to record that you have one of the two.

Verified against the live data, simulating the collection view's own arithmetic:

| Action | Card reads | `partsComplete` |
|---|---|---|
| start | 0/4 | false |
| click either **Lex Prime** counter once | **2/4** | false |
| then Blueprint and Link | **4/4** | **true** |

So three clicks complete a four-part item, one tick moves the counter by two, and
Aklex Prime is marked collected while you hold one of the two Lex Primes it needs.
`test_build.py` already asserts part names are normalised *"since saved progress is
keyed on them"* — nothing asserts they are **unique within an item**, which is the
invariant that assumption actually rests on.

**It is worse in the farm advice, because those pseudo-parts carry no odds.** The
chance lookup at `tools/build_data.py:793` matches reward rows that start with the
item's name, so for Aklex Prime it looks for `Aklex Prime …` and the relic pays
`Lex Prime Barrel`. It never matches, and the row is written with `relic`, `rarity`
and `farmable` and **no `chances` map at all**. The model skips any entry without
one, so those relics are inert everywhere — nothing is double-counted, the
requirement is simply invisible. Consequences, all verified:

| Item | Filed as | "farmable relics" | …carrying odds |
|---|---|---|---|
| Aklex Prime | **Farmable** | 8 | **0** |
| Akbronco Prime | Farmable | 8 | 3 (its own Blueprint and Link) |
| Akmagnus Prime | Baro Ki'Teer | 0 | 0 |
| Akvasto Prime | Baro Ki'Teer | 0 | 0 |

Aklex Prime is in the **Farmable** bucket *because of* the pseudo-part:
`"farmable": bool(farmable_relics)` (`tools/build_data.py:871`) and every one of
those eight relics reached the union through `Lex Prime`. Open its card and the
*Best places to farm its relics* section is **absent entirely** — `bestSpots` drops
every relic worth zero, and all eight are — so the app files it under "you can farm
this" and then has nowhere to send you. The `rarity` left on those rows is a
leftover from the union and disagrees with the real part: the Lex Prime row for
`Lith A2` says Uncommon, where `Lex Prime Barrel` is Common.

On the planner it shows as duplication: `wantedIndex` pushes one *Still needed* row
per part, so a wishlisted Aklex Prime produces **two identical rows** reading
*Aklex Prime — Lex Prime*, two identical buttons in the farm-list panel, and
clicking either clears both.

**Three things to fix, and they are separable.** (1) Give the pipeline a rule for
a component that is itself a Prime: collapse the duplicate to one part with
`itemCount: 2`, which the store already handles — Ivara Prime needs two of some of
hers and the counter cycles correctly. (2) Decide what such a part's relics mean.
Either resolve them to the sub-weapon's own parts, which makes the requirement
farmable and rankable and is a real change to what an "item" is, or mark them
non-scoring and stop them feeding `item_relics`, `farmableRelics` and therefore the
`farmable` flag. The second is much smaller and would already stop the app claiming
Aklex Prime is farmable. (3) Add the test: **no item has two parts with the same
name.** It is one line and it would have caught this before any of the rest.

The review's own suggestion — a `dependencies` array, and marking Lex Prime as
collected credits the Aklex parent — is a third option and the largest, because it
makes one item's ownership state depend on another's. Worth noting that the
dependency is *already in the data*; it is the storage key that cannot express it.

### Unticking one availability box hides items that have a second source

`statusOf` gives each item exactly one bucket and `matches()` tests
`state.avail[it._status]`, so an item vanishes when its **primary** bucket is
unticked even if a ticked bucket also applies. Three items in the current 167 carry
more than one bucket-bearing flag:

| Item | Flags | Files under | Disappears when you untick |
|---|---|---|---|
| Aklex Prime | baro + farmable | Farmable | **Farmable** |
| Lex Prime | baro + farmable + permanent | Farmable | **Farmable** |
| Gotva Prime | baro + special | Baro | **Baro** |

**Backwards from the review's example**, which assumed Baro won and Farmable was
the hidden fallback. Farmable is checked first, so unticking *Baro* hides nothing
at all today except Gotva Prime, and unticking *Farmable* takes two Baro items with
it. The shape of the bug is real; the direction in the write-up is not.

Two things the review did not know. There is a **seventh bucket**: `railjack`, taken
out of `farmable` in `assets/app.js` for the six Primes with no non-Railjack route
(`PROJECT.md §7`), so any fallback rule has to say whether Railjack-only falls back
to Farmable or stands alone. And the counts beside each box come from `updateCounts`,
which also groups on `it._status` — a fallback rule that only touches `matches()`
leaves the numbers no longer adding up to what is on screen.

The bucket itself is a deliberate design (`PROJECT.md §7`, *"exactly one bucket so
the sidebar toggles stay unambiguous"*), so this is not "make it multi-valued" —
it is "keep one bucket for display and let the *filter* read the flags". Three
items is small enough that doing nothing is defensible; it is written down because
the failure is silent, and a silently missing item in a collection tracker is the
one kind of wrong this app cannot afford.

### Both clocks stop dead in a background tab, and nothing catches up on return

Two timers keep the planner honest, and neither survives a tab switch well:

- `setInterval(paintFissures, 60000)` (`assets/plan.js:1155`) — **one minute, not
  the 30 seconds the review states**. Browsers throttle background intervals to
  roughly once a minute or worse, so the badges are stale on return.
- the bounty clock, a separate 30-second interval (`assets/plan.js:1384`), whose
  body opens `if (document.hidden) return;`. So while the tab is hidden it does
  **nothing by design** — and nothing runs on becoming visible either. Come back
  after an hour and the countdown reads what it read when you left, for up to
  thirty seconds.

The second is the one that matters, and the code says why in its own comment: once
the letter turns over *"the ranking behind it is wrong, not merely old"*. A hidden
tab can miss several changeovers, and the first thing you see on returning is a
ranking built for a letter that is no longer up.

**The fix is one listener** — `document.addEventListener("visibilitychange", …)`
calling the same two functions when `document.hidden` goes false. The `document.hidden`
guard already in the interval becomes correct rather than merely cheap, because
something else now covers the gap it leaves.

The fissure badges are the safe half either way: every entry carries its own expiry
and `ROT.fissuresAt` filters against the clock, so a stale paint can only *omit* a
fissure, never invent one (`PROJECT.md §7`).

### Banking a part from the drawer rebuilds the drawer and drops the focus

Clicking a `.part-own` counter runs `render()` — refilter, resort and rewrite the
whole of `#grid` — and then `openItem()`, which replaces `#drawerBody.innerHTML`
wholesale (`assets/app.js:942`). `drawer.scrollTop` is saved and restored by hand;
**focus is not**, so the button you just pressed is destroyed and `document.activeElement`
falls back to `<body>`. Tick three parts with the keyboard and you tab from the top
of the page three times.

**Two corrections to the review, both in the app's favour.** The card tick is
already granular: `toggle()` replaces the single `.card` via `outerHTML` and calls
`updateProgress`/`updateCounts`/`refreshHeadings`, falling back to a full `render()`
only when the item no longer passes the filter and must disappear
(`assets/app.js:965`). And `renderMaterials()` does **not** run while you type — the
`input` handler writes the model and toggles one class on the row
(`assets/app.js:1256`); it rebuilds only on the edit toggle, add and delete, where
the row's shape genuinely changes. The general claim that "every interaction
rebuilds a container" is not true of this code.

So the work is narrow and worth doing: on a part click, update the counter's own
text and class, the card's `x/y`, the progress bar and the counts, and re-rank only
the farm-spot section — leaving the element that holds focus alone. The full
`render()` on every part click is the other half: it re-filters and re-sorts 167
items and rewrites the grid to change one badge.

### The planner can only be ranked one way

`n.rate = (n.perRun / n.cost)` and the sort is on `rate` alone
(`assets/plan.js:539`). `scoreBlock` puts `rate` in `.spot-score b` and `perRun` in
`.spot-alt` beneath it, so the ordering and the largest number agree — which is the
rule, not an accident: `STYLE.md §5`, *"The biggest number in a row is the one the
row is sorted by"*. It follows that a sort toggle is not a one-line sort swap. It
has to move the two numbers, relabel the big one, and change the heading that says
what the list ranks on.

There are **three** candidate keys, not the two the review names in one breath:

| Key | Answers |
|---|---|
| `rate` | how fast this fills the relic stack, per objective or per minute — today's ranking |
| `perRun` | how many wanted relics one run hands over, ignoring what a run costs |
| `score` | what a run is worth towards your list *once the relics are opened* |

`score` is the one the review calls "score per run", and it is a different question
from `perRun` — the split of 2026-08-14 exists precisely because one number could
not answer both (`PROJECT.md §7`). Offering `rate` and `perRun` is a change of
*unit*; offering `score` is a change of *question*, and it belongs on the heading,
not just on the number.

Also follows: the `+N more places` tooltip spells the unit (`/min` or `/obj`) and
must follow; the fold is keyed on the relic table, not on the rate, so it is
unaffected.

### Baro's actual stock is published, and never read

`flags.baro` comes from a wiki marker — `[[Baro Ki'Teer|B]]`, `tools/catalogue.py:159`
— and it means *he sells this sometimes*, not *he is here now*. Eight items carry
it. `/pc/vaultTrader` is fetched for Resurgence (`tools/sources.py:46`);
`/pc/voidTrader`, which carries his arrival, departure and current inventory, is not
fetched at all.

**The proposal has two halves and only one is safe.** Disabling the checkbox while
he is away changes what the flag means, and he is present roughly two days in
fourteen: a box that is dead twelve days out of every fourteen is a filter that
mostly does nothing, and eight items would move between buckets twice a fortnight
under a reader who has not touched anything. That is the same instability the
fissure decision rejects for the ranking (`PROJECT.md §7`).

The half that is clearly worth having is the one the bounty clock already
demonstrates: **say when**. *Baro Ki'Teer (B) — back in 6 days* on the label, and
while he is actually here, mark the items he is really selling — which is the only
thing on this list that today's static flag genuinely cannot tell you. That is a
live fact stated where it is read, not a live fact moving things around.

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

### The two pages own the same state, and have already drifted twice

The maths is properly shared — `assets/model.js` and `assets/rotation.js` exist so
the two pages cannot disagree about a number — but the **state** is not. Both files
read and write the same keys directly, both mutate `wishlist` in their own way, both
wire their own backup dialog, and both redefine `needOf` and `haveOf` locally while
`M.needOf` sits exported and unused.

It has cost two real behaviours already:

- **`plan.js` listens for `storage`; `app.js` does not** (`assets/plan.js:1296`).
  Tick a part on the planner with the collection view open in another tab and the
  collection view keeps its old count until reloaded. The other direction updates
  instantly. Nothing says this is deliberate.
- **The same click means two things.** `.part-own` on the collection page cycles
  `0 → 1 → … → need → 0` (`assets/app.js:943`); `[data-got]` on the planner only
  increments and clamps at `need` (`assets/plan.js:1189`). There is no way to undo
  a mis-click on the planner.

A `State` in `shared.js` owning parts, collected, wishlist and the backup dialog,
with one change notification both pages subscribe to, is the review's suggestion and
it is right. Two things it must preserve: the import paths are **deliberately**
different — `app.js` merges in place and re-derives `collected` per part, `plan.js`
writes the keys and reloads so that the careful per-part merging stays a single
implementation (its own comment says so) — and `shared.js` currently touches the DOM
only for the tooltip and the banner, which is worth keeping true.

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

### What the misses are worth, in Ducats

The data is already here and already tested: `ducats` on **582 of 590** parts, all
in `{15, 25, 45, 65, 100}`, pinned by `test_build.py`. Nothing reads it.

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

### Radiant or Intact is all a recruiting-chat squad can agree on

**The review misreads the option.** The box is labelled **4-man premade** and its
tooltip says so; a coordinated group *can* all run Exceptional, and the option
already unlocks Disruption's rotation A, which needs the squad to under-defend
conduits on a schedule. Restricting it to Intact and Radiant would make it describe
something it does not claim to be.

The gap it is pointing at is real, and it is a **missing option, not a restriction
of this one**: a public radshare from recruiting chat, where you get four rolls but
the refinement is not yours to choose — squad odds *forced to Radiant*. That is the
common case for anyone without a premade, and the app currently has no way to say
it. Whether the sidebar has room for a third state of one question is the design
call; `PROJECT.md §7` is deliberately hostile to options that change two rows.

It also overlaps with the pre-refined nodes: a relic handed over Radiant by ESO or a
Void Storm is already at the radshare refinement, and `sourceValue` already values
those at the refinement given rather than the one chosen.

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

### Void Traces on ESO and the Void Storms — one correction to the entry above

Already covered by *Void Traces: the exchange rate that would let them be scored*.
What this review adds is **where to inject it**, and the plumbing is in place:
`sourceValue` already computes the traces a pre-refined node saves you, per node, and
deliberately leaves the figure out of the score.

One correction. The review says the calculation needs nothing from the player. It
needs exactly one binary answer — *are you trace-limited?* — because a player sitting
on 8,000 traces values the saving at zero, and that is the whole reason the number is
shown rather than scored (`PROJECT.md §7`). The formula in the entry above is the
same one the review derives.

### Conditioning the fissure bonus on a live fissure **[settled]**

**The observation is right and is already two entries in this file** — the
`+relic if fissure` tooltip and `RUN_BLURB.bonus` still say *"nothing here knows
that"* while a fissure badge sits on the same row, and `plan.js` does import
`DATA.fissures` and does call `ROT.fissuresAt`.

**The proposed fix is settled against**, in `PROJECT.md §7`. The flat bonus is safe
precisely *because* it is node-independent: it cannot reorder endless nodes against
each other, so the only comparison it moves is endless-versus-short, which holds
whatever the fissure map looks like. Feed the live list into `runValue()` and the
ranking reshuffles hourly on a fact with an hour left to live — which is the exact
outcome the fissures-are-shown-never-scored decision exists to prevent.

What is open is the **sentence**, not the score, and it is written up at the top of
this file.

---

## A round is not a universal unit of effort

The planner costs every mission in "rounds" and assumes one round means the same
everywhere. It does not. The largest part of this was answered on 2026-08-14 —
effort is collected per objective and the default costs by objective count
(`PROJECT.md §7`) — and what is left is not a modelling gap but an ordinary
unknown.

### Nine rotation-bearing mission types are still unverified

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

Their objective counts are inherited rather than checked, which is the practical
cost of the gap.

### Several of those modes are not round-based at all

`Spy`, `Caches` and `Key` carry rotations, but the rotation does not advance per
*round* — a Spy mission has three vaults, Caches counts what you found. You collect
several tiers inside a **single mission**. We cost a three-vault Spy run as three
rounds of Defense.

Useful find while checking: the wiki splits missions into **Endless** (Defense,
Survival, Interception, Excavation, Defection, Disruption, Alchemy, Infested
Salvage, Legacyte Harvest, Void Cascade/Flood/Armageddon) and **Standard**
(Assassination, Capture, Exterminate, Hijack, Mobile Defense, Rescue, Sabotage,
**Spy**). That is exactly the round-based-or-not split the model has been
reverse-engineering, from a source, and it independently confirms Spy is not
endless.

## Everything else

### Our four invented "mission types" leak into the ranking

`Bounty`, `Key`, `Special` and `Enemy` are ours, not DE's — one bucket per
droptable section (`official.py`). DE's own mission type is the parenthesised
word in `Planet/Node (Type)`, and the wiki lists 35 of them; ours match 24.

That matters because the planner presents all of them as places to go:

- **`Enemy`** is not a destination. It is an enemy that drops relics wherever it
  spawns — the Hemocyte, and it now carries a badge saying so.
- **`Key`** is not a mission type. It is an extra key-gated objective attached to
  an existing mission, and nobody runs one exclusively for it.
- **`Special`** is a bag holding Void Storms, Faceoff and Duviri tables together.
- Three of DE's own labels are not wiki mission types either: `Caches` (a reward
  stream *inside* a Railjack mission), `The Circuit` and `The Perita Rebellion`
  (single activities whose "type" is their own name).

The `Bounty` bucket is the one currently doing damage, because `objectivesOf` keys
off it — see *A Profit-Taker phase is costed at four bounty stages*.

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

### Void Traces: the exchange rate that would let them be scored

The refinement model is built and the traces are shown on the row and left out of
the score, for a reason `PROJECT.md §7` records: what 100 traces are worth depends
on how many you have, and that is a fact about the player this app cannot see.

**What would settle it, if a trace count is ever collected.** Traces buy refinement,
so their value is the refinement uplift they buy on the relic you would have spent
them on next:

```
value of 100 traces  ≈  best over relics r in the plan of
                        ( value(r, Radiant) − value(r, r.chosenRefinement) )
```

That is derived from the player's own plan rather than invented, and it goes to
zero exactly when it should — when nothing in the plan wants refining. It needs
one number from the player: **are you trace-limited?** Which is the same header
slot the Mastery Rank field wants, below.

### The endless-fissure bonus is only stated on the collecting side

The bonus itself shipped as a fourth run mode (`PROJECT.md §7`). What is still owed
is where it is *said*.

It is a reward for **cracking** relics, and it currently appears only as a modifier
on *Where to go*, because that is where the run modes live. It should also be stated
on the cracking side — *given you are opening these relics anyway, is it worth
staying to rotation 5?*

Related, and on the same row: the page now carries a badge saying *this is a fissure
for 40 more minutes* and a marker saying *+relic if fissure*. A reader can join those
two; the page does not. Worth doing in the same sitting as the tooltip fix at the top
of this file, since that marker is being rewritten anyway.

**The scoring stays as it is.** Feeding the live fissure list into the score is the
obvious next move and is the wrong one — it would reorder the ranking hourly on a
fact that has expired by the time anyone acts on it. The flat constant is safe
precisely because it is node-independent: it cannot reorder endless nodes against
each other, so the only comparison it moves is *endless versus short*, which holds
whatever the fissure map looks like.

### A part you cannot reach still reads as one you can

The *Still needed* panel says **"1 relic dropping"** against a part whose only
relic drops somewhere the current options exclude — a Railjack node with Railjack
off, or an event node. It is true and it is misleading in the same breath: the
relic does drop, and you are not being sent anywhere for it.

The whole-list case is handled — an empty ranking now names the switch and counts
what is behind it (`PROJECT.md §7`). The **partial** case is not: three parts
reachable and one only on Railjack still shows four identical-looking rows. The
count of blocked places is already computed per plan; making it per *part* is the
work, and the honest wording for the row is the part that needs thought — "1
relic dropping, nowhere you have switched on" is accurate and clumsy.

**A correction to how this was first written up.** It was described as "three
parts reachable and one on Railjack", as though those six Primes were a mixed
case. They are not, and the reason matters:

> Nyx and Valkyr predate Railjack. Their original relics are **vaulted** — that
> is the legacy route, and it is not a route. Railjack is not one source among
> several; it has been the **only** current source for years.

So there is no mix to display. Whichever of the six you look at, every reachable
route is Railjack, and the badge says so. The mixed case this entry describes is
real but hypothetical — nothing in today's data is in it. Written down anyway,
because the display question is the same either way and the data can change.

**And it is tolerable by design.** A handful of very legacy relics sitting vaulted
behind a current Railjack source is exactly the shape this project is happy with:
the app is about what is farmable now, and it says what "now" costs you.

### A Mastery Rank field in the header

**Specified by the owner 2026-08-14, alongside the decision *not* to gate anything
by rank.** Those two go together and the order matters: the field is for saying
what a node asks of you, never for hiding it.

The shape asked for:

- **A Mastery Rank number the player fills in**, stored locally like everything
  else, empty until they do.
- **Sitting next to the site name and logo**, in the header — not in the planner
  sidebar. It is an account fact, true on both pages, so it does not belong to
  either one's options.
- **A plain `−` / `+` pair** either side of the number. Ranks move one at a time
  and rarely; a spinner or a free text box is more machinery than the job needs.
  The materials rows in the collection view are the nearest existing pattern.

Range: 0 to 30, then **Legendary ranks** above that, which the wiki writes `LR1`,
`LR2` and so on with no published cap. Simplest honest handling is to keep one
integer and render anything over 30 as `LR<n−30>`.

**What it is for, given it gates nothing.** The worldstate publishes `minMR` per
bounty tier and it matches the wiki exactly — MR1 at level 10–30 up to MR10 at
100–100 (see *The worldstate publishes far more than the two fields we read*). So
a node can say **"asks MR5"** the same way one says **"Railjack"** or
**"PvPvE"** — a demand badge, shown when the player's rank is below it and silent
when it is not.

That restraint is deliberate and the wiki is the reason: *"These can still be
played, when an eligible squad member selects one."* The rank stops you
**selecting** a bounty, not running one. Hiding a tier from someone whose friend
can start it would be exactly the wrong answer, so the field informs and never
filters.

**Still open:** whether an unfilled field should be treated as "rank unknown, say
nothing" (safe, and the default everything else in this project takes) or should
prompt once. And whether the same header slot should hold the other things the
app would like to know about the player — Solaris United standing for the
Profit-Taker phases, the Steel Path, and the trace count the entry above wants.

The Steel Path is the interesting precedent there. It had a sidebar checkbox for
one afternoon and it was removed on measurement: every Steel Path table carrying
a relic is a Faceoff variant identical to its ordinary twin, so the option moved
the ranking by two duplicate rows and asked a question for nothing
(`PROJECT.md §7`). If a header of player facts is ever built, the Steel Path
belongs in it as a *fact* — feeding badges, not filters — rather than back in the
sidebar as an option. Same shape as this field, same reasoning.

### The Railjack opt-in gate stands in front of your only option

**What is left of *decision 9*.** That entry asked three questions and two of them
have been answered in code: the badges landed on 2026-08-14, the **seventh bucket**
shipped — `Railjack only`, six items, `assets/app.js` takes them out of `farmable`
and `index.html` gives them their own checkbox with a tooltip saying it is not the
planner's *Include Railjack* box (`PROJECT.md §7`) — and node folding shipped the
same day. Only this one is still open, so the rest has been deleted rather than
ticked.

Put one of the six on the farm list with *Include Railjack* off and the ranking is
empty. It now names the switch and counts what is behind it, which is a large
improvement on silence — but an opt-in gate in front of a thing with no alternative
is still a strange shape. Options:

- (i) leave it — the message is clear, and the checkbox means one thing
- (ii) **auto-include a Railjack node when it is the only route to something on
  your list**, badged as now, with the summary saying why it appeared despite the
  setting. Keeps the checkbox honest for everything else
- (iii) turn the checkbox into three states — off / only when it is the only
  route / always

(ii) reads best and is the smallest change: the information to do it already
exists, since `ROT.railjackOnly` answers exactly that question per item and the
collection view already calls it to build the bucket.

One caveat carried over from the cache-penalty argument, because it constrains
anything further here: **any rule that sinks caches has to leave them reachable for
people with no alternative.** Four of the six Railjack-only Primes come from
`Caches` specifically, which is the one mission type carrying a deliberate 50%
penalty (`PROJECT.md §7`). For their owners the worst rows in the list are the only
rows in the list.

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

Swept 2026-08-14, at the owner's suggestion, and it changes several entries above.
We fetch `/pc/syndicateMissions` and `/pc/events` already, use two fields, and
throw the rest away. What is in there, per bounty job:

| Field | What it is | What it would fix |
|---|---|---|
| `uniqueName` | ends `…Tier<X>Table<Y>Rewards` | **`Table<Y>` is the rotation letter, published per tier.** See the entry below — this is the whole of it |
| `standingStages[]` | its length is the **stage count**, and it varies: 3, 4 or 5 by tier | `objectivesOf` hard-codes 4 stages for every bounty. Tier A is 3, Tier D is 5 — and Profit-Taker is not a bounty at all |
| `enemyLevels[]` | e.g. `[40, 60]` | **every bounty node in our data has `lvl: null`** — 13 of them — so bounties can never win the level tie-break |
| `minMR` | **Minimum Mastery Rank**, 0 to 10 — see the caveat below | the demand badge the header field above wants |
| `type` | `"Cull the Enemy"`, `"Reclaim What's Ours"` | a real name instead of `Level 20 - 40 Cetus Bounty` |
| `rewardPoolDrops[]` | `{item, rarity, chance, count}`, **live** | a cross-check against DE's static table, which is how the letter is currently derived at all |

And on `/pc/events`, a **`tag`** field — `HeatFissure`, `WaterFight` — a stable
machine identifier instead of the keyword scan described in the entry above.

None of this needs a new request. It is in the response we already cache.

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

So this is not a candidate for the exclusion rule. It is a candidate for a **demand
badge**, and it would need the player's own rank — the first thing this project
would have to ask about itself rather than derive.

### Read each bounty's rotation letter directly — the worldstate already says it

**Answered 2026-08-14; the work is what is left.** The letter does not need deriving
per tier. DE publish it in each job's `uniqueName`, and a reading of the cached
worldstate for the window ending `2026-08-12T20:25:13.214Z` matches our own
derivation exactly:

| Job | `uniqueName` tail | Our derived letter |
|---|---|---|
| Ostrons tiers A–E, Solaris tiers A–E, Entrati tiers A/B/C/E | `Tier*Table**A**Rewards` | `standard: A` (16 of 16 votes) |
| Isolation Vault chambers A, B, C | `VaultBountyTier*Table**B**Rewards` | `vault: B` (6 of 6 votes) |

Two independent methods, 22 votes, no disagreement. That settles what `Table<Y>`
means.

**And it answers the tier that never fitted.** Entrati's *Reclaim What's Ours*
(level 30–40, our `Level 30 - 40 Cambion Drift Bounty`, the tier that publishes only
rotations **AB**) came back `TierDTable**B**Rewards` — on **B**, while every other
Entrati tier in the same window was on **A**. So the tier is not inheriting the
family letter and it is not falling back to A. It runs its own letter, and DE say
which, every window.

**The work:** parse `Tier<X>Table<Y>` out of `uniqueName`, key it by the tier's
`enemyLevels` to reach our node names, and keep `derive_bounty_rotation`'s
reward-matching as the fallback for a worldstate that cannot be read. Tiers whose
rotations are indistinguishable keep the family letter as a fallback. Only Aya is
affected today, on one node, which is why this is written down rather than done.

#### The observations that would check any implementation

Three readings of the live worldstate against what the two-rotation Cambion Drift
tier was actually offering. Without the `uniqueName` reading, two explanations fit
all three — the tier falls back to A whenever the board is on C, or it runs its own
two-letter cycle that happens to line up — and they only diverge about eight hours
after the last reading.

| Bounty window ends | Board is on | That tier offered |
|---|---|---|
| 2026-08-11T21:55Z | C | its A table |
| 2026-08-12T07:55Z | A | its A table |
| 2026-08-12T10:25Z | B | its B table |

DE's table gives `Level 30 - 40 Cambion Drift Bounty` rotations A and B only;
`Level 40 - 60` and `Level 100 - 100` publish A alone and are handled correctly, one
table with nothing to wait for.

### The meta line is now 6.68:1, and the floor is 7:1 — what is left of decision 5

**Option (b) shipped, and this entry is what remains of it.** `.spot-meta` was
raised from `--txt-faint` to `--txt-dim`, and `--odd` was raised with it from
`#684321` to `#d29455` so the amber keeps sitting at the same brightness as the
line it annotates rather than reading as a highlight (`STYLE.md §1`). Re-measured
2026-08-24 against `--panel`:

| | Was | Now |
|---|---|---|
| `.spot-meta` | **1.98:1** | **6.68:1** |
| `.est` amber, `--odd` | 2.00:1 | **6.73:1** |
| `.spot-score` label — *relics / min* | 1.98:1 | **1.98:1**, unchanged |

So the big correction landed and two things are left, both small.

**The line is still under the floor.** `STYLE.md §3` asks for WCAG AAA, 7:1, and
6.68 is not 7. The gap is a rounding error rather than a legibility problem, so the
honest options are to nudge the two tokens the last 5% or to write the exception
into `STYLE.md` and stop calling it a debt.

**`.spot-score`'s own text was never in scope and is now the worst thing on the
row.** The gold number reads at 8.82:1 and `.spot-alt` beneath it at 6.68:1, but
the unit label between them — *relics / min*, the words that say what the biggest
number on the row actually measures — is still `--txt-faint` at 1.98:1. That is a
stronger case than the meta line ever was, because it is the label on the ranked
quantity.

Every figure above was measured on the rendered element rather than read off the
stylesheet, which is what `STYLE.md §3` requires and the reason the original
measurement was out by half. **`temp_mockup.html` argued the decision that has now
been taken and can go.**

### The node list is the top eight and a hover, not a table

`#planNodes` renders `ranked.slice(0, 8)` and folds everything after it into a
single `+N more places` chip whose tooltip lists the next twenty as plain text —
node, planet, mode, rounds and rate, one line each (`assets/plan.js`). Beyond
twenty-eight there is no way to see a place at all.

Eight is the right default and should stay: `STYLE.md §5` is emphatic that a long
list condenses to a count with the detail on hover, and the whole point of the
ranking is that the top of it is the answer. What is missing is the way *out* of
the default — somewhere to see the ranking whole when you want to plan around a
planet you can actually reach, or to check that something you expected is in there
at all.

A tooltip is the wrong container for that: it cannot be scrolled, sorted or
searched, and it is already carrying twenty rows of tabular text through a control
that exists to hold a sentence. Expanding in place — the chip becoming *show all N*
— keeps one list and one ranking, and needs no new page.

Worth doing after the sort toggle rather than before it, since a browsable list
whose order cannot be changed is half a feature.

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

### Prime Resurgence is the only non-first-party source **[settled]**

Everything else comes from Digital Extremes directly. DE's own `worldState.php`
returns 404 on both `content.` and `origin.warframe.com`, so the live Resurgence
rotation comes via the WarframeStat proxy. **There is no first-party route to find** —
nothing to do here until DE publishes one. Documented in `PROJECT.md §6` and left
open only so the search can resume if that changes.

### Enemy levels are missing for 31% of live-relic nodes **[partly reopened]**

Levels come from DE's `ExportRegions_en.json` (269 nodes, `minEnemyLevel` /
`maxEnemyLevel`), joined after stripping the `Event:` prefix. The gap is entirely
Railjack/Proxima nodes, which DE's export omits.

**This is fine as it stands.** Unknown levels sort last rather than being guessed at,
which is the correct behaviour — a made-up level would silently distort the tie-break
that levels exist to serve. Kept as a note so the 69% figure is not mistaken for a
join bug.

**Reopened in part, 2026-08-14.** The Railjack half stands — DE's export genuinely
omits Proxima. But **all 13 bounty nodes also have `lvl: null`**, and that half is
not a gap in the data at all: `/pc/syndicateMissions` publishes `enemyLevels` for
every live bounty tier, `[5, 15]` through `[100, 100]`, and it is the same number
already sitting in our own node names (`Level 40 - 60 Cetus Bounty`). Two routes to
it, both free. Bounties currently lose every level tie-break by default.

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
