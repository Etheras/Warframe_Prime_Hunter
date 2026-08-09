# TODO

Things noticed while building VorFrame that are worth doing but haven't been done.
Newest observations go at the bottom of each section. Delete an item when it ships.

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

## Data accuracy

- [ ] **Prime Resurgence is the one non-first-party source.** DE's own
      `worldState.php` returns 404 on both `content.` and `origin.warframe.com`,
      so the live rotation comes via the warframestat proxy. Find a first-party
      route, or accept and document it.
- [x] ~~Part names differ between the two paths~~ — fixed by `normalise_part()`:
      the redundant trailing " Blueprint" is stripped so both sources agree, which
      is what saved part progress is keyed on.
- [ ] **Enemy levels for the node tie-break** come from DE's
      `ExportRegions_en.json` (269 nodes, `minEnemyLevel`/`maxEnemyLevel`). It
      covers only **55%** of the nodes that drop live relics — Railjack/Proxima
      nodes and `Event:` variants are absent from the export entirely. Nodes with
      no known level will have to sort last rather than be guessed at.
- [ ] Relic `sources` are capped at 40 per relic in the payload. Deduped and
      sorted by chance first so the useful ones survive, but the cap is arbitrary.
- [ ] The wiki's `(R)` Resurgence markers are parsed and then ignored (they're
      stale). Either drop the parse or use it as a cross-check that warns when the
      wiki disagrees with the live worldstate.

## Features

- [x] ~~**Stage 1 — track individual parts**~~ — done. Per-part counters with
      quantities, `2/4` on cards, auto-collect when complete, and `bestSpots`
      filtered to what is still missing. Includes the 4-squad odds toggle.
- [x] ~~**Stage 3 — materials panel**~~ — done. Manual name / have / need rows
      under Advanced options, feeding no calculation.
- [x] ~~**Stage 2 — the shopping-list planner**~~ — built as `plan.html`. Wishlist
      shared with the collection page, need-aware scoring, per-relic refinement
      decision, Forma shortfall folded in, squad/event/Railjack toggles.
- [ ] Planner follow-ups: no "runs needed" estimate yet, and the node list shows
      8 with the next 20 on hover rather than a full browsable table.

### Planner design decisions (settled 2026-08-08)

- **Forma counts, but only up to what you still need.** It gets a have/need
  field like any other material; if the field shows a shortfall it joins the
  ranking, because unlike Orokin Cell it really does come from relics.
  A drop is worth `min(quantity dropped, quantity still needed)`:
  `Forma Blueprint` sits in a Common slot (25.33%) and `2X Forma Blueprint` in
  an Uncommon one (11%), so needing **1** makes the 1× relic worth 0.253 against
  the 2× relic's 0.110, while needing **2+** brings them close at 0.253 vs 0.220.
  (An earlier note here said to drop Forma from the maths entirely — that was an
  over-correction, since a near-uniform term barely reorders anything.)
- **Node tie-break**: show 2, hover for 20 (same pattern as relic sources).
  Order by score, then **lower** enemy level (high weight), then rotation A ahead
  of B/C (mid weight). `Event:` nodes get a boost, behind an advanced checkbox,
  since the event is worth running alongside the relic farm. Mission length is
  deliberately ignored as too ambiguous.
- **Railjack/Proxima**: out of scope for now — but it cannot simply be deleted.
  Five live relics (Lith C7, Meso N11, Neo V9, Axi S8, Axi V10) have **no other
  source**, and they carry Nyx, Valkyr, Cernos, Lex, Hikou and Scindo Prime
  parts. Hiding Railjack outright would make permanently-unvaulted frames look
  unfarmable. Keep the sources, just leave them out of the default ranking.
- **Squad odds**: a checkbox, "4-squad run with the same relic and refinement".
  Off means solo. With it on, a wanted reward at probability `w` becomes
  `1 - (1 - w)^4`.


- [ ] **Relic inventory** so the drawer can say "you already hold 2 of these".
- [ ] Ducat value per part, for prime-junk triage.
- [ ] Availability changelog: when a scheduled build changes what's farmable,
      write a short summary so "Frost Prime became farmable" is visible without
      diffing 1.5 MB of JSON.

## UX

- [x] ~~Backup only covered whole-item ticks~~ — it now carries parts and
      materials too, and still imports old bare-array backups by expanding them.
- [ ] **Collection doesn't sync between devices.** It lives in `localStorage`, so
      phone and desktop keep separate lists. Backup/Import covers it manually;
      a shareable URL or file export would be smoother.
- [ ] Cosmetics and Emotes have no relic data, so they fall into the "vaulted"
      bucket by default. Technically true, but misleading — they deserve their own
      "not from relics" bucket.
- [x] ~~`S · special` filtered together with Founder~~ — split. Founder is its own
      bucket, pinned last (it will never return); "Other sources" now names the
      actual route, read from each item's wiki page.
- [ ] Artwork is hotlinked from `cdn.warframestat.us`. The standalone build is
      therefore not fully offline. An optional `--with-images` that inlines the
      art as data URIs would fix it, at a large size cost.

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
