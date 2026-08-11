# VorFrame — project overview

A local, offline-capable web app presenting **two equal tools over one dataset**: a
**collection tracker** (`index.html`) for what you own, and a **farm planner**
(`plan.html`) for what to run next. Neither is subordinate — they share one build
of the data and one set of saved progress, so a part ticked in either is ticked in
both. Judge a change by whether it serves that shared dataset well.

> **This file must be kept current.** It is the one document to read to understand
> VorFrame, and it is only worth that if it matches the code. **Section 2 sets out
> how to work on this project — read it before changing anything.**

**Last updated:** 2026-08-09

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
| Fold **Forma** into the ranking | Have/need field under Advanced options |

Everything you enter lives in the browser's `localStorage`, across five keys:

| Key | Holds | In Backup? |
|---|---|---|
| `vorframe.collected.v1` | whole items ticked | yes |
| `vorframe.parts.v1` | per-part counts | yes |
| `vorframe.materials.v1` | the manual materials checklist | yes |
| `vorframe.wishlist.v1` | the farm list, shared with the planner | no |
| `vorframe.plan.v1` | planner options (squad, event, Railjack, Forma) | no |
| `vorframe.filters.v1` | collection filters, sort and view toggles | no |

**Backup** exports the first three as one document and still accepts the old
bare-array format by expanding each ticked item into fully-owned parts. Imports
are validated against the current catalogue: unknown ids and part names are
skipped, and counts clamped to what the part needs.

**Parts are the source of truth** for anything that has them: an item counts as
collected exactly when every part is owned, and ticking the card sets or clears
them all. Items with no parts — cosmetics, Founder gear — stay manually ticked.
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

### No Node, no build step

This machine has Python 3.14, git and a browser. There is no npm, no bundler, no
framework, and adding one is not on the table. The site is plain HTML, CSS and
JavaScript with the data baked into a `.js` file so it opens straight from
`file://`. Keep it that way.

### Verifying a change

Run the tests before pushing anything that touches the pipeline:

```bash
python tests/test_build.py
```

They need no network and take about a second. `--online` adds a real clone-and-build
into a temp directory, which is the only check covering the new-user path. Every test
is there because of a bug that actually happened, and says which in its docstring.

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

### Install the daily task

```powershell
powershell -ExecutionPolicy Bypass -File tools\schedule.ps1
```

Registers a Windows Scheduled Task ("VorFrame data refresh") that runs
`build_data.py --if-changed` daily at 18:30. Options: `-Time 07:30`, `-RunNow`,
`-Remove`. *(Not installed automatically — run it yourself when you want it.)*

### Why `--if-changed` is cheap

It fetches a fingerprint before doing any real work:

| Probe | Cost | Catches |
|---|---|---|
| DE Public Export index hash | ~500 bytes | New Primes, any game build |
| `HEAD` on warframe.com/droptables | headers only | Vaultings, unvaultings, drop changes |
| Varzia trader window | small JSON | Resurgence rotation flip (every 28 days) |

Fingerprints live in `.cache/state.json`. On a quiet day the task exits in about a
second having written nothing; a real change triggers the full rebuild.

### Or let GitHub run it

`.github/workflows/publish.yml` does the same job in CI on a daily cron, with no
secrets (every source is public) and no `pip install` (stdlib only). It builds,
asserts the result is sane — at least 250 items, 40 Warframes, 500 relics, and
something farmable — then publishes to GitHub Pages. This supersedes the Scheduled
Task.

**The dataset is never committed.** It is built in CI and handed to Pages as an
artifact, so the repo stays source-only (21 files, ~259 KB) and DE's data is not
redistributed — each build pulls it fresh. The workflow holds `contents: read`, so
it cannot modify the repository at all.

That is also why `data/vorframe-data.js` is gitignored: a clone has no data until
`build_data.py` runs, which the README makes the first step.

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
| One file to carry around | `tools/bundle.py` → `dist/vorframe.html` (1.6 MB, fully inlined) |
| Reach it from a phone | GitHub Pages + the refresh workflow |

### What deliberately isn't used

**Official news posts and forum update notes are prose.** Extracting "which Primes
were just unvaulted" from them reliably needs a language model, which is exactly
what you asked to avoid. Everything those posts announce shows up in the structured
feeds above at the same time or sooner, so nothing is lost by skipping them.

---

## 5. Layout

```
VorFrame/
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
│   ├── app.js              ← filtering, collection state, detail drawer
│   └── plan.js             ← wishlist, scoring model, ranked node plan
├── data/
│   ├── vorframe-data.js    ← GENERATED — window.VORFRAME_DATA = {...}
│   └── vorframe-data.json  ← GENERATED — same payload as plain JSON
├── .github/workflows/
│   └── publish.yml         ← daily rebuild in CI, runs the tests, publishes to Pages
├── tests/
│   └── test_build.py       ← the suite; --online adds clone-and-build
├── tools/
│   ├── build_data.py       ← orchestration, the item join, and emit
│   ├── sources.py          ← network, HTTP cache, warm/cold STALE/MISSING policy
│   ├── catalogue.py        ← the wiki Prime page, and the shared vocabulary
│   ├── relics.py           ← drop tables -> relic contents and relic sources
│   ├── artwork.py          ← optional local image copies (--with-images)
│   ├── official.py         ← parsers for DE's drop table + public export
│   ├── bundle.py           ← inlines everything into dist/vorframe.html
│   ├── serve.py            ← local server, picks a working port
│   └── schedule.ps1        ← installs/removes the daily Scheduled Task
├── dist/                   ← GENERATED — single-file build, gitignored
└── .cache/                 ← GENERATED — HTTP cache + state.json, safe to delete
```

Files marked GENERATED are rebuilt by `build_data.py`; don't hand-edit them.

---

### Two stores, and who owns each

VorFrame keeps state in two places and they never mix:

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
`data/vorframe-data.js` as it always does; the server checks whether DE has moved on
since the build, appends `window.VORFRAME_UPSTREAM = {...}` to the file it returns,
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

Verified across four states: warm-with-blocked-source (315 items + alert), cold
(exits 1), cold with `--allow-degraded` (172 items + degraded flag), and healthy
(315 items, clean).

---

## 7. Data model

`window.VORFRAME_DATA` holds:

```js
{
  meta: { generated, itemCount, relicCount, farmableRelicCount, dropSource,
          newCount, resurgence: { activation, expiry, location }, sources },
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
still need — the same model `plan.js` uses, rotation weighting included, so the two pages cannot rank things
differently. (It used to rank by how many relics happened to overlap, which made
the order disagree with the per-part odds listed underneath.) It only counts
relics holding a part you are still missing, so the advice moves as you tick
things off: Caliban Prime opens on
Terrorem (5 of 7 relics), but once his Blueprint and Chassis are ticked it re-ranks
to Zabala (2 of 2).

Railjack/Proxima nodes are excluded from that ranking — a different activity — but
never hidden, because five live relics (Lith C7, Meso N11, Neo V9, Axi S8, Axi V10)
have no other source and carry never-vaulted frames like Nyx and Valkyr.

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

| `runMode` | Label in the UI | Pattern | Rounds |
|---|---|---|---|
| `reset` *(default)* | Reset as soon as it drops | everything up to the **last wanted rotation** | 2, 3 or 4 — **per node** |
| `full` | Run straight through | A×2 + B + C | 4 |
| `aabcaa` | AABCAA, then reset | A×4 + B + C | 6 |

`reset` stops at the **deepest rotation holding something you want**, not at the
best-rate stopping point. Want a part from A and another from C? You run to C — 4
rounds — because leaving after round 2 never yields the C part at all, however good
the per-round rate looks. A node you only want rotation A from is costed over 2
rounds, one whose B is the deepest over 3.

This was briefly implemented as a rate optimiser, which quietly dropped exactly the
case it exists for: Io scored 78.01% over 2 rounds by ignoring its rotation C value
outright. It is now 51.56% over 4, which is what running it actually costs. A
per-round rate is the wrong objective when you need to *cover* a set rather than
maximise throughput of any one item — the same reasoning as refinement following
the bottleneck instead of the likeliest reward.

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

Implementation: `plansFor(mission, squad)` in both `plan.js` and `app.js` looks the
mission type up in `ROT_PATTERN` and falls back to AABC, so a mission type nobody has
thought about degrades to the normal rule rather than to nothing. `assertRotationCoverage()`
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

The setting lives in `vorframe.plan.v1` and **both pages read that one copy**, since
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

It counts only for items that are **not farmable**. Almost any part turns up in some
vaulted relic somewhere, so without that test a list of purely farmable Primes would
still score Aya — and if you can go and farm it, Aya buys you nothing.

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
apart where the API flattens them into "Misc" and "Primary".

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

### Shared UI conventions

Both pages share one visual vocabulary so a habit learned on either carries over:
row background encodes the **action** (which refinement), chips encode **rarity**,
vaulted fades to violet, long lists condense with the detail on hover, and
tooltips explain rather than repeat.

**The rules live in [STYLE.md](STYLE.md)** — read it before adding UI. Each rule
records why it exists, so it is clear when one does not apply.

### Availability buckets

Each item lands in exactly one bucket so the sidebar toggles stay unambiguous;
cards can still show several badges. Precedence:

`founder → resurgence → farmable → baro → special → vaulted`

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
   rest are vaulted. It's why only ~36 of 315 Primes are farmable right now.
9. **This machine has no Node/npm.** Hence a Python-stdlib pipeline and a
   dependency-free front end. If Node ever gets installed, none of this needs to change.

---

## 9. Current snapshot

As of the last data build (official drop table, 2026-06-25 revision):

- **315 Primes** — 51 Warframes, 34 Primary, 31 Secondary, 41 Melee, 13 Exalted,
  7 Companion, 6 Robotic Weapon, 2 Archgun, 2 Extractor, 1 Archwing, 126 Cosmetic, 1 Emote
- **763 relics** tracked, **34** currently dropping
- **36 Primes farmable now**, **5** in Prime Resurgence
- **0 Primes** in DE's export missing from the wiki — the wiki page is currently complete
- Resurgence rotation runs **2026-08-06 → 2026-09-03** (Baruuk, Revenant, Phantasma,
  Afuris, Tatsu)

Switching to the official drop table also picked up sources the mirror lacked:
enemy drops (e.g. Hemocyte drops several relics) and `Event:` star chart nodes.

Known limits:

- Cosmetics and Emotes have no relic data — they come from Prime Access or accessory
  bundles, and the drawer says so rather than inventing a farm route.
- Excalibur, Lato and Skana Prime are Founder-exclusive and have no relics by design.
- Relic *sources* are capped at 40 per relic in the payload (deduped and sorted by
  drop chance first, so the useful ones survive).
- Parts reconstructed from the drop table use DE's raw part names
  (`"Chassis Blueprint"` rather than the API's `"Chassis"`). Cosmetic only.

---

## 10. Possible next steps

See **[TODO.md](TODO.md)** — everything still outstanding, kept as a
running list rather than duplicated here.
