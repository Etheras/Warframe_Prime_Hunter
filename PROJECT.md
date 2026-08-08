# VorFrame — project overview

A local, offline-capable web app for tracking your WARFRAME **Prime** collection and
working out **where to farm the relics** for anything you're still missing.

> This file is the living overview of the project. Keep it current when anything
> below changes — it is meant to be the one document you read to understand VorFrame.

**Last updated:** 2026-08-08

---

## 1. What it does

| Requirement | Where it lives |
|---|---|
| Pull the Prime catalogue from the wiki | `tools/build_data.py` → parses `wiki.warframe.com/w/Prime` |
| Show / hide **vaulted** Primes | Sidebar → *Availability → Vaulted (V)* |
| Categories (Warframe, Primary, Secondary, Melee, …) | Sidebar → *Category* |
| Mark what you've **already collected** | Tick on each card, or the button in the detail drawer |
| Hide collected items | Sidebar → *Collection → Show collected* (untick to hide) |
| **Prime Resurgence (R)** filter | Sidebar → *Availability → Prime Resurgence (R)* |
| **Where to farm the relics** for a Prime | Click any card → *Best places to farm its relics* |

Collection state is stored in the browser's `localStorage` and can be exported or
re-imported from the **Backup** button.

---

## 2. Running it

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

---

## 3. Keeping it current, without an LLM

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
artifact, so the repo stays source-only (14 files, ~120 KB) and DE's data is not
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

## 4. Layout

```
VorFrame/
├── README.md               ← plain-language guide: install, use, update
├── PROJECT.md              ← this file (how it's built)
├── TODO.md                 ← known gaps and ideas, not yet done
├── index.html              ← markup + filter controls
├── serve.cmd               ← double-click: serve the site and open a browser
├── refresh-data.cmd        ← double-click data refresh
├── assets/
│   ├── styles.css          ← all styling (dark Orokin theme)
│   └── app.js              ← filtering, collection state, detail drawer
├── data/
│   ├── vorframe-data.js    ← GENERATED — window.VORFRAME_DATA = {...}
│   └── vorframe-data.json  ← GENERATED — same payload as plain JSON
├── .github/workflows/
│   └── refresh-data.yml    ← daily rebuild in CI, commits only on a real change
├── tools/
│   ├── build_data.py       ← pipeline: fetch, join, emit
│   ├── official.py         ← parsers for DE's drop table + public export
│   ├── bundle.py           ← inlines everything into dist/vorframe.html
│   └── schedule.ps1        ← installs/removes the daily Scheduled Task
├── dist/                   ← GENERATED — single-file build, gitignored
└── .cache/                 ← GENERATED — HTTP cache + state.json, safe to delete
```

Files marked GENERATED are rebuilt by `build_data.py`; don't hand-edit them.

---

## 5. Data sources

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

## 6. Data model

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

**"Best places to farm"** (`app.js → bestSpots`) groups every source of every
still-dropping relic for an item by mission node, then ranks nodes by *how many of
that item's relics drop there*. That's why Caliban Prime surfaces Terrorem (Deimos)
first — one Survival run can yield 5 of his 7 live relics.

### Availability buckets

Each item lands in exactly one bucket so the sidebar toggles stay unambiguous;
cards can still show several badges. Precedence:

`founder → special → resurgence → farmable → baro → vaulted`

Resurgence outranks farmable because it's time-limited and worth surfacing.

---

## 7. Gotchas discovered while building

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

## 8. Current snapshot

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

## 9. Possible next steps

See **[TODO.md](TODO.md)** — open questions, known gaps, and ideas, kept as a
running list rather than duplicated here.
