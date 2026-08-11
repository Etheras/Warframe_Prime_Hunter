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

### The rotation model is written out twice

`assets/app.js` and `assets/plan.js` each carry their own copy of the whole
rotation model — `RESET_STOPS`, `ROT_PATTERN`, `scorePlan`, `runValue`, and now the
bounty clock as well. They are kept in step by hand, which is exactly the setup
where the two pages drift apart and rank the same node differently.

Extracting an `assets/rotation.js` that both load is the fix. It is not free:
`index.html` and `plan.html` both need the extra `<script>`, and `tools/bundle.py`
inlines the scripts by name, so it needs the third. Worth doing before the next
change to the model rather than after.

### Two bounty tiers publish only two rotations

`Level 30 - 40 Cambion Drift Bounty` publishes rotations A and B, not A/B/C, and it
is not alone. When the board is on the letter such a bounty does not publish, there
is no honest answer about what it pays: it is scored at the average of the letters
it does have, and the row says so on hover.

Only Aya is affected today, on one node. Worth revisiting if DE's table starts
disagreeing with the board more widely — the alternative reading is that those
tiers run a two-letter cycle of their own, which nothing currently confirms.

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

### Not wiki issues

Recorded here only so they are not mistaken for one:

- `normalise_part()` reconciles two APIs with each other (`Chassis` versus
  `Chassis Blueprint`). Nothing to do with the wiki.
- Reward rarity is derived from the unrefined drop chance because **DE's** own
  rarity words are chance-relative and shift with refinement. A Digital Extremes
  data quirk.
- Item categories are read from the wiki deliberately — see `PROJECT.md §7`.
