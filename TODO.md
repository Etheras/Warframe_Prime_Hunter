# TODO

Things noticed while building VorFrame that are worth doing but haven't been done.
Newest observations go at the bottom of each section. Delete an item when it ships.

---

## Open questions

- [ ] **Which host blocks GitHub's runners?** CI run #1 died in 14s on an early
      fetch. The `Probe the data sources` step now prints all five status codes —
      read them on the next run and record the answer here. Prime suspect is
      `wiki.warframe.com` (Cloudflare, already known to 403 non-browser clients).
- [ ] Decide what CI should do if the wiki really is permanently blocked from
      Azure: seed the cache once and rely on warm runs, pass `--allow-degraded`
      deliberately, or drop the wiki from the CI build and accept losing cosmetics.

## Data accuracy

- [ ] **Prime Resurgence is the one non-first-party source.** DE's own
      `worldState.php` returns 404 on both `content.` and `origin.warframe.com`,
      so the live rotation comes via the warframestat proxy. Find a first-party
      route, or accept and document it.
- [ ] **Part names differ between the two paths.** The item-API path yields
      `"Chassis"`, the drop-table fallback yields `"Chassis Blueprint"`. Cosmetic
      only, but it makes a wiki-less build look inconsistent. Normalise one way.
- [ ] Relic `sources` are capped at 40 per relic in the payload. Deduped and
      sorted by chance first so the useful ones survive, but the cap is arbitrary.
- [ ] The wiki's `(R)` Resurgence markers are parsed and then ignored (they're
      stale). Either drop the parse or use it as a cross-check that warns when the
      wiki disagrees with the live worldstate.

## Features

- [ ] **Track individual parts**, not just whole items — "I have 3 of 4 Chassis".
      Probably the single most useful addition.
- [ ] **Global farm planner**: given everything still missing, rank nodes across
      the whole collection rather than one item at a time. The per-item version
      already exists in `bestSpots`; this generalises it.
- [ ] **Relic inventory** so the drawer can say "you already hold 2 of these".
- [ ] Ducat value per part, for prime-junk triage.
- [ ] Availability changelog: when a scheduled build changes what's farmable,
      write a short summary so "Frost Prime became farmable" is visible without
      diffing 1.5 MB of JSON.

## UX

- [ ] **Collection doesn't sync between devices.** It lives in `localStorage`, so
      phone and desktop keep separate lists. Backup/Import covers it manually;
      a shareable URL or file export would be smoother.
- [ ] Cosmetics and Emotes have no relic data, so they fall into the "vaulted"
      bucket by default. Technically true, but misleading — they deserve their own
      "not from relics" bucket.
- [ ] `S · special` items are filtered together with Founder items. Fine for now
      (there are few of each) but they aren't really the same thing.
- [ ] Artwork is hotlinked from `cdn.warframestat.us`. The standalone build is
      therefore not fully offline. An optional `--with-images` that inlines the
      art as data URIs would fix it, at a large size cost.

## Engineering

- [ ] **No test suite.** Everything has been verified with throwaway scripts:
      the drop-table parser against the mirror, the new-Prime recovery path, the
      warm/cold fetch policy, the degraded-build matrix. Those checks are worth
      keeping as real tests rather than rewriting them each time.
- [ ] `serve.cmd` hardcodes port 8777 and fails if it's taken. Pick the next free
      port instead, or say so more clearly than the raw Python traceback.
- [ ] `build_data.py` is ~800 lines and doing three jobs (fetch, join, emit).
      The parsers already live in `official.py`; the join could move out too.
- [ ] The GitHub Actions `deploy` job only runs after a successful `build`, so a
      failed refresh silently leaves the old site published. That's the right
      behaviour, but nothing announces it — a failure notification would help.
