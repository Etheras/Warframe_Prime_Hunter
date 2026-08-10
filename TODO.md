# TODO

Everything still outstanding in VorFrame. **Only unfinished work belongs here** —
when something ships, delete its entry rather than ticking it, and record *why* it
was done that way in `PROJECT.md` if the reasoning matters. Settled design
decisions are not TODOs and live in `PROJECT.md §7`.

Roughly ordered by what is worth doing first. Each entry should make sense to
someone who has never seen this project before; if it needs conversation context to
understand, it needs rewriting.

---

### Ten rotation-bearing mission types are still unverified

Swept 2026-08-10. Of the 31 mission types in the data, 9 carry no rotation at all so
the cycle never applies, 11 are confirmed A→A→B→C against the wiki (Defense,
Survival, Interception, Excavation, Defection, Infested Salvage, Alchemy, Sanctuary
Onslaught, Void Cascade, Void Flood, Void Armageddon), and Disruption is modelled
explicitly. That leaves ten assumed AABC without confirmation:

`Bounty`, `Caches`, `Key`, `Legacyte Harvest`, `Rush`, `Skirmish`, `Special`, `Spy`,
`The Circuit`, `The Perita Rebellion`.

The wiki also names two more exceptions we do not currently see in relic sources —
**The Index** (A-B-B, with C once after an hour) and **Arbitrations** (A-A-B-B-C-C-C-C)
— which is evidence that deviation is not rare.

### Several rotation-bearing modes are not round-based at all

Falls out of the sweep above and is probably the more serious half. `Spy`, `Bounty`,
`Caches` and `Key` carry rotations, but their rotation does not advance per *round* —
a Spy mission has three vaults, a Bounty has five stages, Caches counts what you
found. You collect several tiers within a **single mission**, rather than one per
round.

The planner costs these in "rounds" like an endless mission, so a three-vault Spy run
is priced as three rounds of Defense. That is the mission-length assumption
(`PROJECT.md §7`) failing in a specific, fixable way rather than a vague one: for
these modes the right unit is one mission, not N rounds.

### Disruption rotation B cannot be held indefinitely by the planner

Rotation A is now modelled as a squad-gated plan (`PROJECT.md §7`), but the third
strategy is not: with a coordinated squad you can hold **rotation B every single
round** — defend 4, then 3–4, then 2–3, then 1–2 forever. The planner only knows two
Disruption plans, all-out (B, B, C, C…) and the rotation-A min-max (A, A, A, B…).
A B-forever plan would matter for a list wanting only rotation B relics.

### The rotation label sits at 3.48:1 contrast

Measured 2026-08-10 while checking the new amber. `.spot-meta` renders in
`--txt-faint`, which is below AA (4.5:1) and well below the 7:1 `STYLE.md §3`
requires. It is deliberately dimmed as secondary information, so raising it changes
the visual hierarchy on both pages — worth doing, but it is a design decision rather
than a straight fix. The amber non-standard label deliberately matches this same brightness, so it
shares the problem by design (`STYLE.md §1`).

### Mission length is not modelled at all, and the ranking now leans on it

A "round" is treated as one unit of effort regardless of mission. So four rounds of
Disruption score four times a bounty that may well take just as long in real
minutes, and single-reward missions sink to the bottom of the planner however fast
they are. This became load-bearing when node ranking moved to whole-run totals
(`PROJECT.md §7`), so it is now the weakest assumption in the whole model. The only
honest fix is timing real missions and scoring per minute. Until then the per-round
rate in each row's rotation tooltip is the workaround.

### The single-file build carries the collection only

`bundle.py` folds the collection into one `.html`, but the planner is a second page
with nowhere to live in a one-file build, so its tab is stripped rather than left
pointing at a file that will not be there. Given the two pages are meant to be equal
(`PROJECT.md §1`), that is a real gap. Both could be inlined into one file and
switched with JS instead of a link — the dataset is already shared, so it is mostly
a question of routing.

### The planner cannot say how many missions to run

**Deliberately parked.** Each relic row estimates the *openings* needed, but not the
missions — that would be openings divided by how often the relic drops at the chosen
node. It is a probability, not a plan: the number would be an expectation with a very
wide spread, and reading it as "this many runs" would mislead more than it helps. Low
value, kept only so nobody proposes it again without a better idea.

Separately and still worth doing: the node list shows the top 8 with the next 20 on
hover, rather than a full browsable table.

### Collection does not sync between devices

**Backup/Import is the answer for now**, and it is complete — it carries the
collection, per-part progress, materials, the farm list, filters and planner options.
Automatic sync would need a server and an account, which is exactly what this project
avoids. Revisit only if a serverless option appears that keeps the data local.

### Prime Resurgence is the only non-first-party source — *out of our control*

Everything else comes from Digital Extremes directly. DE's own `worldState.php`
returns 404 on both `content.` and `origin.warframe.com`, so the live Resurgence
rotation comes via the WarframeStat proxy. **There is no first-party route to find** —
nothing to do here until DE publishes one. Documented in `PROJECT.md §6` and left
open only so the search can resume if that changes.

### Enemy levels are missing for 31% of live-relic nodes — *documented, not a defect*

Levels come from DE's `ExportRegions_en.json` (269 nodes, `minEnemyLevel` /
`maxEnemyLevel`), joined after stripping the `Event:` prefix. The gap is entirely
Railjack/Proxima nodes, which DE's export omits.

**This is fine as it stands.** Unknown levels sort last rather than being guessed at,
which is the correct behaviour — a made-up level would silently distort the tie-break
that levels exist to serve. Kept as a note so the 69% figure is not mistaken for a
join bug.

### Event nodes cannot be tied to their event — *out of our control*

DE's drop table says only `Event: <planet>/<node>`, never which event, and the live
worldstate does not link an event back to a drop-table node. The node only exists on
the star chart while that event is running.

**So event nodes are excluded from the ranking entirely**, with an opt-in checkbox for
when you know one is live. Without a first-party mapping there is nothing better to
do: showing them by default sends you to missions you cannot find. Revisit only if DE
publishes the link.

### Relic inventory — deferred, do not re-propose without a better input method

This is the single biggest inaccuracy in the planner: every score is *per reward
drop*, so it ignores the stack of relics you could already be cracking. The blocker
is data entry, not value. The game offers no export, and typing in a relic
collection by hand is unreasonable when a long-standing account holds hundreds, most
of them vaulted and irrelevant.

What would unblock it: only the **currently-live relics** can affect a plan, so a
future attempt should ask about those alone — one screen of counters, re-asked when
the drop tables change. Any design that needs the vaulted ones is the wrong design.

### Ducat value per part

For prime-junk triage: knowing what a spare part is worth to Baro.

### Availability changelog

When a scheduled build changes what is farmable, write a short summary, so "Frost
Prime became farmable" is visible without diffing 1.5 MB of JSON.

### Workflow actions still run on Node 20

`actions/checkout` and `actions/setup-python` are forced onto Node 24 with a
deprecation warning. Harmless today, will break eventually.

---

## Should be fixed on the wiki, not here

These are places where VorFrame knowingly disagrees with
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

### Not wiki issues

Recorded here only so they are not mistaken for one:

- `normalise_part()` reconciles two APIs with each other (`Chassis` versus
  `Chassis Blueprint`). Nothing to do with the wiki.
- Reward rarity is derived from the unrefined drop chance because **DE's** own
  rarity words are chance-relative and shift with refinement. A Digital Extremes
  data quirk.
- Item categories are read from the wiki deliberately — see `PROJECT.md §7`.
