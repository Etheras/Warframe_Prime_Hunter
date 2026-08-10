# TODO

Things noticed while building VorFrame that are worth doing but haven't been done.
Newest observations go at the bottom of each section. Tick an item when it ships,
with a one-line note on what was actually done.

**Keep this file current** — along with `README.md`, `PROJECT.md` and `STYLE.md`,
in the same commit as the change. See **PROJECT.md §2** for that and the other ground rules.

---

## Open questions

- [ ] Bump the workflow actions off Node 20 (`actions/checkout`,
      `actions/setup-python`) — currently forced onto Node 24 with a deprecation
      warning. Harmless today, will break eventually.

**Decided 2026-08-08:** repo stays **private** for now, while the tool gets used
and verified. GitHub Pages is unavailable for private repos on the Free plan, so
the deploy job skips itself and CI runs stay green as build validation. Nothing
needs changing to switch later — making the repo public starts publishing on the
next run.

**Resolved:** no host blocks GitHub's runners. All five sources answer from CI —
the build now succeeds there in 6 seconds. The 302 seen on
`www.warframe.com/droptables` was an artefact of the probe using `curl` without
`-L`; `urllib` follows redirects, so the build never saw it. Probe now uses `-L`.

## Should be fixed on the wiki, not here

Everywhere the app knowingly disagrees with `wiki.warframe.com/w/Prime`. The
policy is to keep our data faithful to the source and push corrections upstream,
so each of these is a wiki edit waiting to happen rather than something to
entrench in code. Listed newest first.

- [ ] **Gotva Prime is marked `(S)` but is a Baro Ki'Teer item.** Its own wiki
      page says so outright: *"potentially sold by Baro Ki'Teer in the Concourse
      section of the Tenno Relay"*. It carries `(B)` as well, so the `(S)` is
      simply redundant. **Local override:** `statusOf()` ranks Baro above
      Special, which puts it in the right bucket. Remove that override once the
      `(S)` is dropped from the Prime page.
- [ ] **The `(R)` Prime Resurgence markers are years out of date.** The page
      still lists the December 2021 debut rotation and carries `{{UpdateMe}}`.
      **Local override:** the markers are parsed and then ignored entirely;
      Resurgence comes from the live worldstate instead. Nothing to change here
      even if the wiki is fixed — the worldstate is simply better — but the page
      is misleading anyone reading it directly.
- [ ] **`(V)` vaulted markers are trusted less than the item API.** Where the two
      disagree the API's `vaulted` field wins. Worth spot-checking which is
      actually right before deciding whether this is a wiki problem or ours.

Not wiki issues, recorded here so they are not mistaken for one:

- `normalise_part()` reconciles two APIs with each other (`Chassis` vs
  `Chassis Blueprint`), not the wiki.
- Reward rarity is derived from the unrefined drop chance because **DE's** own
  rarity words are chance-relative and shift with refinement. That is a
  Digital Extremes data quirk.
- Categories stay on the wiki deliberately — see PROJECT.md §7.

## Data accuracy

- [ ] **Prime Resurgence is the one non-first-party source.** DE's own
      `worldState.php` returns 404 on both `content.` and `origin.warframe.com`,
      so the live rotation comes via the warframestat proxy. Find a first-party
      route, or accept and document it.
- [x] ~~Part names differ between the two paths~~ — fixed by `normalise_part()`:
      the redundant trailing " Blueprint" is stripped so both sources agree, which
      is what saved part progress is keyed on.
- [ ] **Enemy levels cover 69% of live-relic nodes.** They come from DE's
      `ExportRegions_en.json` (269 nodes, `minEnemyLevel`/`maxEnemyLevel`), joined
      after stripping the `Event:` prefix. The remaining 31% are Railjack/Proxima
      nodes, which DE's export omits entirely. Unknown levels sort last rather
      than being guessed at.
- [ ] **Event nodes cannot be identified.** DE's drop table only says
      `Event: <planet>/<node>`, never which event, and the live worldstate does
      not link an event back to a drop-table node. If a mapping is ever found,
      the planner could show "only during X" instead of hiding them.
- [ ] **Void Storm sources are cut by the 40-source cap.** Railjack's equivalent
      of a Void Fissure does get its own table (44 rows across 6 groups, all for
      live relics) but drops at 2.5%, below the 9–15% of ordinary nodes, so it
      falls off the end. Low value and Railjack-only, hence left alone — but
      raising the cap would bring it back.
- [ ] Relic `sources` are capped at 40 per relic in the payload. Deduped and
      sorted by chance first so the useful ones survive, but the cap is arbitrary.

## Features

- [x] ~~**Stage 1 — track individual parts**~~ — done. Per-part counters with
      quantities, `2/4` on cards, auto-collect when complete, and `bestSpots`
      filtered to what is still missing. Includes the 4-squad odds toggle.
- [x] ~~**Stage 3 — materials panel**~~ — done. Manual name / have / need rows
      under Advanced options, feeding no calculation.
- [x] ~~**Stage 2 — the shopping-list planner**~~ — built as `plan.html`. Wishlist
      shared with the collection page, need-aware scoring, per-relic refinement
      decision, Forma shortfall folded in, squad/event/Railjack toggles.
- [ ] Planner follow-ups: the per-relic view estimates *openings* to finish, but
      there is still no estimate of **missions** to run (openings x how often the
      relic drops). The node list also shows 8 with the next 20 on hover rather
      than a full browsable table.
- [ ] **Relic `sources` are ordered and capped by raw chance, not by the
      rotation-weighted value the UI now ranks on.** `normalise_sources()` sorts
      by chance and `build_data.py` keeps the top 40, so a fast rot A source
      could in principle be cut in favour of a slower rot B/C one with a higher
      published number. Not observed to bite yet — the cap only binds on relics
      with many sources — but the two orderings should agree.
- [ ] **`.more-nodes` and the option labels use native `title=`**, which
      STYLE.md section 4 rules out (native tooltips are proportional and mangle
      the aligned columns). The new *How far you run* label uses `data-tip`
      correctly, so the sidebar now mixes both engines — they should all move.
- [ ] **The squad toggle is stored twice** — `vorframe.filters.v1` on the
      collection page and `vorframe.plan.v1` on the planner — so the two pages
      can disagree about it. `runMode` was deliberately given a single home to
      avoid exactly this; squad should follow.
- [ ] The planner's Forma field is separate from the collection page's materials
      list, so the same number is entered twice. They should share one store.

### Planner design decisions

Dates are on the individual entries — several were revised after first use.

- **Forma counts, but only up to what you still need.** It gets a have/need
  field like any other material; if the field shows a shortfall it joins the
  ranking, because unlike Orokin Cell it really does come from relics.
  A drop is worth `min(quantity dropped, quantity still needed)`:
  `Forma Blueprint` sits in a Common slot (25.33%) and `2X Forma Blueprint` in
  an Uncommon one (11%), so needing **1** makes the 1× relic worth 0.253 against
  the 2× relic's 0.110, while needing **2+** brings them close at 0.253 vs 0.220.
  (An earlier note here said to drop Forma from the maths entirely — that was an
  over-correction, since a near-uniform term barely reorders anything.)
- **Node tie-break**: order by score, then **lower** enemy level. Mission length
  is deliberately ignored as too ambiguous. Rotation *used* to be the third key
  here; it moved into the score itself (below), so tie-breaking on it as well
  would have counted it twice.
- **A node is valued as a whole run** (added 2026-08-09, in two steps). First
  problem: rotation was only a tie-break, so a rot C node could outrank a rot A
  one at the same published chance — DE's number is conditional on that rotation
  coming up. Second problem, spotted straight after: weighting each rotation
  separately still assumed you only collect the one you came for, when a run
  that reaches rotation C has taken the A and B rewards too. Nodes are now keyed
  by mission rather than `(mission, rotation)`, each rotation's value is banked
  separately, and the score is `Σ count[r] × v[r] / rounds` for the pattern
  being run.
- **How far you run is a setting, not an assumption.** `reset` runs to the last
  rotation holding something wanted (2, 3 or 4 rounds), `full` costs a whole
  AABC cycle, `aabcaa` costs six rounds. Stored once in `vorframe.plan.v1` and
  read by both pages, because they must not rank differently.
- **Nodes are ranked on the whole run, not a per-round rate** (decided
  2026-08-10). Dividing by rounds was a dominance violation: Ur matched Kappa in
  rotations A and B and *also* had a wanted rotation C, which forced it deeper
  and dropped its rate below Kappa's — the node offering more ranked lower, when
  leaving early makes it strictly better. Known cost, accepted deliberately:
  a longer run now outranks a faster one on volume alone, and single-reward
  missions sink (the Fortuna bounty fell from 1st to below 28th). The per-round
  rate is kept in the rotation tooltip so the trade stays visible.
- [ ] **Mission length is still unmodelled, and per-run scoring leans on it
      harder.** A round is treated as one unit of effort whatever the mission,
      so 4 rounds of Disruption look like 4x a bounty that may take just as
      long. Timing real missions is the only honest fix; until then the tooltip
      rate is the workaround.
- **`reset` stops at the deepest wanted rotation, not the best rate** (corrected
  2026-08-09). It was first written as a rate optimiser, which dropped the case
  it exists for: wanting a part from A and another from C, it stopped at 2
  rounds and ignored C entirely. Per-round rate is the wrong objective when the
  goal is to cover a set rather than maximise throughput of any one item.

- [ ] **Relic `sources` are ordered and capped by raw chance, not by the
      rotation-weighted value the UI now ranks on.** `normalise_sources()` sorts
      by chance and `build_data.py` keeps the top 40, so a fast rot A source
      could in principle be cut in favour of a slower rot B/C one with a higher
      published number. Not observed to bite yet — the cap only binds on relics
      with many sources — but the two orderings should agree.
- [ ] **`.more-nodes` and the option labels use native `title=`**, which
      STYLE.md section 4 rules out (native tooltips are proportional and mangle
      the aligned columns). The new *How far you run* label uses `data-tip`
      correctly, so the sidebar now mixes both engines — they should all move.
- [ ] **The squad toggle is stored twice** — `vorframe.filters.v1` on the
      collection page and `vorframe.plan.v1` on the planner — so the two pages
      can disagree about it. `runMode` was deliberately given a single home to
      avoid exactly this; squad should follow.
- [ ] The planner's Forma field is separate from the collection page's materials
      list, so the same number is entered twice. They should share one store.

### Planner design decisions

Dates are on the individual entries — several were revised after first use.

- **Forma counts, but only up to what you still need.** It gets a have/need
  field like any other material; if the field shows a shortfall it joins the
  ranking, because unlike Orokin Cell it really does come from relics.
  A drop is worth `min(quantity dropped, quantity still needed)`:
  `Forma Blueprint` sits in a Common slot (25.33%) and `2X Forma Blueprint` in
  an Uncommon one (11%), so needing **1** makes the 1× relic worth 0.253 against
  the 2× relic's 0.110, while needing **2+** brings them close at 0.253 vs 0.220.
  (An earlier note here said to drop Forma from the maths entirely — that was an
  over-correction, since a near-uniform term barely reorders anything.)
- **Node tie-break**: order by score, then **lower** enemy level. Mission length
  is deliberately ignored as too ambiguous. Rotation *used* to be the third key
  here; it moved into the score itself (below), so tie-breaking on it as well
  would have counted it twice.
- **Rotation is weighted into the score** (added 2026-08-09, prompted by a rot C
  node outranking two rot A nodes at the same published chance). DE's chance is
  conditional on that rotation coming up, so it is not comparable across
  rotations. Weight is rounds played per wanted reward, assuming you leave once
  your rotation has paid: **A = 1** (two rounds give two A rewards), **B = 3**,
  **C = 4**, no rotation = 1. That makes rot A worth 4x a rot C listing at the
  same number.
- **How far you run is a setting, not an assumption** (added 2026-08-09). The
  weighting above only holds if you actually leave when your rotation pays, so
  the three readings are offered as a dropdown rather than one being baked in:
  `reset` (A 1, B 1/3, C 1/4), `full` (A 1/2, B 1/4, C 1/4) and `aabcaa`
  (A 2/3, B 1/6, C 1/6). `reset` is the default and the only one that ranks B
  above C. Stored once in `vorframe.plan.v1` and read by both pages, because
  they must not rank differently.
- **`Event:` nodes are excluded by default** (revised 2026-08-09 — they were
  originally *promoted*). DE's drop table lists them permanently but never names
  the event, and the node only exists on the star chart while that event runs, so
  the planner was sending you after missions you could not find. Excluding them
  drops 18% of live-relic source rows and orphans nothing. There is an *Include
  event nodes* checkbox for when you know one is live.
- **Railjack/Proxima**: out of scope for now — but it cannot simply be deleted.
  Five live relics (Lith C7, Meso N11, Neo V9, Axi S8, Axi V10) have **no other
  source**, and they carry Nyx, Valkyr, Cernos, Lex, Hikou and Scindo Prime
  parts. Hiding Railjack outright would make permanently-unvaulted frames look
  unfarmable. Keep the sources, just leave them out of the default ranking.
- **Refinement is chosen by bottleneck** (revised 2026-08-09). Was "maximise the
  chance of anything wanted", which let a common outvote a rare you were blocked
  on. Now minimises expected openings for the scarcest wanted reward. Affects
  every list that wants a common and a rare from one relic — and all 34 live
  relics contain both.
- **Squad odds**: a checkbox, "4-squad run with the same relic and refinement".
  Off means solo. With it on, a wanted reward at probability `w` becomes
  `1 - (1 - w)^4`.


- [ ] **Relic inventory** — *deferred 2026-08-09, do not re-propose without a
      better input method.* It remains the biggest inaccuracy in the planner
      (every score is *per reward drop*, so it ignores the stack you could already
      be cracking), but the blocker is data entry, not value: the game gives no
      export, and typing in a relic collection by hand is unreasonable when a
      long-standing account holds hundreds, most of them vaulted and irrelevant.
      What would unblock it: only the **34 currently-live relics** can affect the
      plan, so a future attempt should ask about those alone — a single screen of
      counters, re-asked when the drop tables change — rather than the whole
      inventory. Anything that needs the vaulted ones is the wrong design.
- [ ] Ducat value per part, for prime-junk triage.
- [ ] Availability changelog: when a scheduled build changes what's farmable,
      write a short summary so "Frost Prime became farmable" is visible without
      diffing 1.5 MB of JSON.

## UX

- [x] ~~Backup only covered whole-item ticks~~ — it now carries parts and
      materials too, and still imports old bare-array backups by expanding them.
- [ ] **Backup skips the farm list and planner options** (`vorframe.wishlist.v1`,
      `vorframe.plan.v1`). Restoring on a new machine brings back your collection
      but leaves the planner empty.
- [ ] **Collection doesn't sync between devices.** It lives in `localStorage`, so
      phone and desktop keep separate lists. Backup/Import covers it manually;
      a shareable URL or file export would be smoother.
- [ ] Cosmetics and Emotes have no relic data, so they fall into the "vaulted"
      bucket by default. Technically true, but misleading — they deserve their own
      "not from relics" bucket.
- [x] ~~`S · special` filtered together with Founder~~ — split. Founder is its own
      bucket, pinned last (it will never return); "Other sources" now names the
      actual route, read from each item's wiki page.
- [ ] **Artwork is hotlinked from `cdn.warframestat.us`**, so the standalone
      build is not fully offline *and* the CDN sees your IP plus which item
      images you rendered. No collection data leaks, but it is the only part of
      the app that talks to anyone while you use it, and it is why Firefox logs
      "Cookie has been rejected as third-party" against `*Prime.png`. Measured
      2026-08-09: **278 items carry art, mean 63 KB, about 17 MB raw** — 22.8 MB
      if base64-inlined, which is too much for the single-file bundle. Better
      option is a `--with-images` that downloads into `assets/img/` and rewrites
      the URLs, keeping the bundle free to stay hotlinked or drop art entirely.
      README now states the exception rather than implying nothing leaves.

## Engineering

- [ ] **No test suite.** Everything has been verified with throwaway scripts:
      the drop-table parser against the mirror, the new-Prime recovery path, the
      warm/cold fetch policy, the degraded-build matrix. Those checks are worth
      keeping as real tests rather than rewriting them each time.
- [ ] `build_data.py` is ~800 lines and doing three jobs (fetch, join, emit).
      The parsers already live in `official.py`; the join could move out too.
- [ ] The GitHub Actions `deploy` job only runs after a successful `build`, so a
      failed refresh silently leaves the old site published. That's the right
      behaviour, but nothing announces it — a failure notification would help.
