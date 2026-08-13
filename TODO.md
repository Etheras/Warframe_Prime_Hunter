# TODO

Everything still outstanding in VorFrame. **Only unfinished work belongs here** —
when something ships, delete its entry rather than ticking it, and record *why* it
was done that way in `PROJECT.md` if the reasoning matters. Settled design
decisions are not TODOs and live in `PROJECT.md §7`.

Roughly ordered by what is worth doing first. Each entry should make sense to
someone who has never seen this project before; if it needs conversation context to
understand, it needs rewriting.

Entries marked **[settled]** are not open work. They are questions that have been
asked and answered, kept only so the answer is not lost and the question is not
raised again from scratch. Everything else is genuinely outstanding.

---

## A round is not a universal unit of effort

The planner costs every mission in "rounds" and assumes one round means the same
everywhere. It does not, and these three are the same flaw seen from different
angles — worth tackling together, because fixing the last one properly subsumes the
other two.

### 1. Nine rotation-bearing mission types are still unverified

Swept 2026-08-10. Of the 31 mission types in the data, 9 carry no rotation at all so
the cycle never applies, 11 are confirmed A→A→B→C against the wiki (Defense,
Survival, Interception, Excavation, Defection, Infested Salvage, Alchemy, Sanctuary
Onslaught, Void Cascade, Void Flood, Void Armageddon), and Disruption is modelled
explicitly. That leaves nine assumed AABC without confirmation:

`Caches`, `Key`, `Legacyte Harvest`, `Rush`, `Skirmish`, `Special`, `Spy`,
`The Circuit`, `The Perita Rebellion`.

`Bounty` was the tenth and is now settled — it is not a round-based cycle at all, see
*Bounty rotation is a wall clock* below.

The wiki also names two more exceptions we do not currently see in relic sources —
**The Index** (A-B-B, with C once after an hour) and **Arbitrations** (A-A-B-B-C-C-C-C)
— so deviation is clearly not rare.

### 2. Several of those modes are not round-based at all

`Spy`, `Caches` and `Key` carry rotations, but the rotation does not advance per
*round* — a Spy mission has three vaults, Caches counts what you found. You collect
several tiers inside a **single mission**. We cost a three-vault Spy run as three
rounds of Defense.

### 3. Mission length is not modelled, and the ranking leans on it

Four rounds of Disruption score four times a bounty that may take just as long in real
minutes, and single-reward missions sink however fast they are. This became
load-bearing when node ranking moved to whole-run totals (`PROJECT.md §7`), so it is
now the weakest assumption in the model. The honest fix is timing real missions and
scoring per minute, which needs data neither the wiki nor DE publishes. Until then the
per-round rate in each row's rotation tooltip is the workaround.

## Everything else

### Only recommend what can actually be run today

**The rule, set 2026-08-13.** A source belongs in the ranking only if it can be
run *now*:

- **Permanent content** — always shown.
- **Recurring often enough to plan around** (roughly monthly or better, e.g.
  Nightmare missions) — modelled, but **shown only while it is actually live**.
- **Anything we cannot deterministically tell is live** — omitted. Not shown
  greyed out, not shown with a caveat. Omitted.

The planner exists to answer "where do I go next". A node you cannot enter is
not a worse answer than the right one, it is not an answer.

**The case that exposed it: `Hemocyte`.** It ranked *first* in a mockup at 0.74
wanted relics per run, carrying 11 live relics. It is not a mission at all — it
is an enemy, and the wiki is explicit: *"They only appear on the Advanced and The
Steel Path variants of the Plague Star Bounty, with a total of four spawning
during the final stage."* Plague Star is a **re-run event**, last seen years ago.
So the top recommendation in the list was content nobody can reach.

The fix is already half-built: `meta.bounties.events` detects a live Plague Star
from the worldstate, and the Plague Star *bounty* is already gated on it.
`Hemocyte` must be gated on the same window.

**Everything else in the same position, needing a verdict each:**

| Source | Relics | What it is | Verdict |
|---|---|---|---|
| `Hemocyte` (enemy) | 11 | Plague Star final stage only | **exclude** unless Plague Star is live — gate on the window we already compute |
| `Faceoff: …` ×4 | 22 each | **permanent.** Höllvania, Update 38.0 (2024-12-13). Nodes *Lower Vehrvod* (vs AI) and *Vehrvod District* (PvPvE) with Steel Path variants | **keep** — but it is PvPvE, worth flagging like Railjack |
| `Another Betrayer`, `Family Reunion`, `Hot Mess`, `Recover The Orokin Archive`, `Sunkiller`, `Table For Two`, `The Aftermath`, `Time's Up` | 22 each | **quest missions.** All eight share one identical reward table, and "Sunkiller" is a New War track rather than a node — these are quest stages, not farmable nodes | **exclude** — one-time story content, cannot be ground |
| `Void Storm (…)` ×6 | 7–8 each | Railjack Void Storms | **unverified.** Probably permanent; check before acting |

Checked against both wikis, because the two disagree in places and the older one
is not always stale. Two corrections came out of it: a search confidently
identified the eight quest missions as **Steel Path Incursions**, and the wiki
disproves it — Incursions award *"5 Steel Essence (unaffected by any boosters)"*
and no relics at all. Faceoff was assumed to be event content and is not.

Only **Void Storms** remain unidentified.

### Our four invented "mission types" leak into the ranking

`Bounty`, `Key`, `Special` and `Enemy` are ours, not DE's — one bucket per
droptable section (`official.py`). DE's own mission type is the parenthesised
word in `Planet/Node (Type)`, and the wiki lists 35 of them; ours match 24.

That matters because the planner presents all of them as places to go:

- **`Enemy`** is not a destination. It is an enemy that drops relics wherever it
  spawns — see the Hemocyte case above.
- **`Key`** is not a mission type. It is an extra key-gated objective attached to
  an existing mission, and nobody runs one exclusively for it.
- **`Special`** is a bag holding Void Storms, Faceoff and Duviri tables together.
- Three of DE's own labels are not wiki mission types either: `Caches` (a reward
  stream *inside* a Railjack mission), `The Circuit` and `The Perita Rebellion`
  (single activities whose "type" is their own name).

Useful find while checking: the wiki splits missions into **Endless** (Defense,
Survival, Interception, Excavation, Defection, Disruption, Alchemy, Infested
Salvage, Legacyte Harvest, Void Cascade/Flood/Armageddon) and **Standard**
(Assassination, Capture, Exterminate, Hijack, Mobile Defense, Rescue, Sabotage,
**Spy**). That is exactly the round-based-or-not split the model has been
reverse-engineering, from a source, and it independently confirms Spy is not
endless.

### Profit-Taker does not fit the model, so hide it for now

`Level 40 - 60 PROFIT-TAKER - PHASE 1/2/3` and `Level 50 - 60 PHASE 4` are a
multi-phase heist, not a bounty, and Phase 3 splits into a **first completion**
(a guaranteed Gravimag, once ever) and **subsequent completions** (everything
after, and the only half carrying relics). Nothing in the planner can express
"once ever", and the four phases are not four independent things you choose
between.

**Decision: exclude the Profit-Taker nodes from the ranking** until the shape is
worked out, rather than rank them wrongly. Six relic rows are affected. Revisit
with the numbers in hand.

### Rank the two loops apart, and never merge them again

**Settled 2026-08-13.** Collecting relics and cracking relics are two different
activities with two different bottlenecks, and a single score covering both
answers neither. The owner's actual pattern makes the split concrete: relics get
stacked on weekdays when there is no time, and cracked in bulk at the weekend.

- **Where to go** ranks on **relics per run** — how fast a node fills the stack.
  It knows nothing about what a relic is worth once opened.
- **What to crack** ranks on **openings needed** for the scarcest thing still
  wanted. It knows nothing about where the relic came from.

The current score multiplies the two together, which is why "≈N runs to finish"
could never be given an honest label.

### Let the player weight each mission type by effort

Ranking per *run* flatters anything long. Ranking per *minute* changes the order
completely — with one player's estimates, Capture and Exterminate nodes moved up
**over a hundred places**, and Spy fell by a factor of ten.

That is too big to ignore and too personal to ship: the numbers depend on gear
and progression, and so do the *ratios* between them. A strong player trivialises
a Capture while a Spy vault still costs its fixed hacking time.

**So the weights belong to the player.** Minutes per run, per mission type, under
Advanced options, stored locally and **empty by default** — unset, the ranking
stays per run exactly as it is now. Nothing ships a default anyone would have to
argue with.

### Railjack should say so, and its caches probably should not be ranked at all

Two things, same 38 Proxima nodes:

- `Skirmish` and `Caches` are **both Railjack** and the UI never says so. A node
  called "Arva Vector" gives no hint that it needs a ship and a crew. Label it.
- **Railjack caches are a poor recommendation on their own.** Three hidden caches
  inside a boarded base, for the worst relics-per-run in the whole list — nobody
  runs Railjack for them. Keeping them ranked at all is questionable; at minimum
  they should not appear above ordinary star-chart nodes. Left in for now,
  deliberately, until there is a rule rather than a hunch.

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

**What to do when one of them next runs:** refresh the data, check the build log
says `limited-time events running - Ghoul Purge` (or `Plague Star`), and confirm
the bounty appears in the planner without the checkbox. If it does not, capture the
raw worldstate entry — that is the fixture this cannot be written against today.
Plague Star matters most: it carries 26 relics, more than any other bounty.

### Read each bounty's rotation letter directly, instead of inheriting it

The letter is currently derived once per *family* — one for the standard bounties,
one for the Isolation Vaults — and every bounty in that family is assumed to be on
it, walking A→B→C. Most are. Three Cambion Drift tiers are not, because DE's table
does not give them three rotations at all:

| Bounty | Rotations DE publishes |
|---|---|
| `Level 30 - 40 Cambion Drift Bounty` | A, B |
| `Level 40 - 60 Cambion Drift Bounty` | A |
| `Level 100 - 100 Cambion Drift Bounty` | A |

The single-rotation ones are handled correctly — one table, nothing to wait for. The
two-rotation one is not: when the board is on C, it is scored at the average of A and
B, which is certainly wrong, because it is demonstrably offering one specific table.

Three readings of the live worldstate, against what that tier was actually offering:

| Bounty window ends | Board is on | That tier offered |
|---|---|---|
| 2026-08-11T21:55Z | C | its A table |
| 2026-08-12T07:55Z | A | its A table |
| 2026-08-12T10:25Z | B | its B table |

Two readings fit all three: the tier falls back to A whenever the board is on C, or
the tier runs its own two-letter cycle that happens to line up. They only diverge
about eight hours after the last reading above, so neither is confirmed.

**The fix does not need that question answered.** Every bounty tier appears in every
window, so its letter can be read straight from the worldstate the same way the
family's is — per group rather than per family — and the group's own published
rotations become its sequence. `derive_bounty_rotation` already does the matching;
it just aggregates the votes one level too high. Tiers whose rotations are
indistinguishable (several pay the same handful of resources in all three) keep the
family letter as a fallback.

Only Aya is affected today, on one node, which is why this is written down rather
than done.

### Serving to a network exposes the folder, read-only

Raised 2026-08-11 while planning a Raspberry Pi deployment.

**Corrected the same day** — the original version of this entry claimed a visitor
could overwrite your collection through the Backup box. That is wrong, and worth
recording so nobody reasons from it again:

- Ticks live in `localStorage`, scoped to origin *and browser profile and device*.
  A visitor gets their own empty tracker. Your collection never reaches the server,
  so there is nothing there for anyone to read or change.
- `serve.py` accepts no writes. It is `SimpleHTTPRequestHandler`, which implements
  GET and HEAD only — POST, PUT, DELETE and PATCH all return `501` — and the server
  writes nothing to disk while running.

What is genuinely exposed is **read access to the whole VorFrame folder**, including
`.cache/` with its raw copies of DE's responses, plus directory listings. All of it
is public game data, so the honest summary is "keep private files out of the folder"
rather than anything about credentials.

Worth doing anyway, cheaply:

1. **Turn off directory listing**, so the folder is not browsable even though its
   contents are harmless. A few lines in the request handler.
2. **Do not serve `.cache/`.** Nothing in the page needs it, and it is the only
   directory whose presence invites a second look.

Neither needs authentication, and both are small. Deferred rather than urgent,
because nothing served is sensitive.

### The banner guesses who is reading it from the hostname

`staleBanner()` decides whether to add "Double-click `refresh-data.cmd` to update it"
by checking whether `location.hostname` is localhost. That is a guess standing in for
identity, and it is wrong in two directions:

- Browse **your own** server by its LAN address (`http://192.168.1.169:8777`) and you
  are treated as a guest, so you get the warning without the fix.
- Open the **single-file build** or any `file://` copy and the hostname is empty, which
  currently counts as owner — reasonable, since you must have the folder to have the
  file, but it is luck rather than reasoning.

It errs toward saying less, so nobody is misled — a guest is never told to run
something they do not have. Worth fixing properly all the same.

**Suggested fix, in order of preference:**

1. **Let the server say so.** It already decorates `data/vorframe-data.js` with
   `window.VORFRAME_UPSTREAM` before serving, and it knows the peer address —
   `self.client_address[0]` in the request handler. Adding `owner: <peer is loopback>`
   to that payload replaces the guess with the actual answer, costs nothing, and needs
   no new request. The page then reads the flag instead of sniffing its own URL.
2. **Make it explicit.** A `serve.py --guest` flag for anyone deliberately serving to
   other people, which suppresses every maintenance instruction regardless of address.
   Useful alongside 1 rather than instead of it.
3. **Say nothing to anyone.** Drop the instruction entirely and let the banner state
   the problem only. Simplest, and defensible — but it loses the one prompt that
   actually gets the data refreshed.

Option 1 is the real fix; the plumbing for it is already there.

### The rotation label sits at 3.48:1 contrast

Measured 2026-08-10 while checking the new amber. `.spot-meta` renders in
`--txt-faint`, which is below AA (4.5:1) and well below the 7:1 `STYLE.md §3`
requires. It is deliberately dimmed as secondary information, so raising it changes
the visual hierarchy on both pages — worth doing, but it is a design decision rather
than a straight fix. The amber non-standard label deliberately matches this same brightness, so it
shares the problem by design (`STYLE.md §1`).

## Settled — answered, kept so the answer is not lost

### The planner cannot say how many missions to run **[settled]**

**Deliberately parked.** Each relic row estimates the *openings* needed, but not the
missions — that would be openings divided by how often the relic drops at the chosen
node. It is a probability, not a plan: the number would be an expectation with a very
wide spread, and reading it as "this many runs" would mislead more than it helps. Low
value, kept only so nobody proposes it again without a better idea.

Separately and still worth doing: the node list shows the top 8 with the next 20 on
hover, rather than a full browsable table.

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

### Enemy levels are missing for 31% of live-relic nodes **[settled]**

Levels come from DE's `ExportRegions_en.json` (269 nodes, `minEnemyLevel` /
`maxEnemyLevel`), joined after stripping the `Event:` prefix. The gap is entirely
Railjack/Proxima nodes, which DE's export omits.

**This is fine as it stands.** Unknown levels sort last rather than being guessed at,
which is the correct behaviour — a made-up level would silently distort the tie-break
that levels exist to serve. Kept as a note so the 69% figure is not mistaken for a
join bug.

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
