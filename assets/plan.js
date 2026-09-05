/* Warframe Prime Hunter — farm planner
   Given a list of Primes you want, works out where to go next.

   The model, in one line:

     score(node, rotation) = rotationWeight(rotation) × Σ over relics r dropped there:
                               P(r drops) × Σ over wanted things w in r:
                                              P(w | r, refinement) × min(qty, still needed)

   The drop chance DE publishes is conditional on that rotation coming up, so
   comparing rotations by it directly overrates the late ones — see ROT_ROUNDS.

   Both sums are plain additions rather than inclusion-exclusion, because a
   mission reward roll yields exactly one item (so the relics in a node's table
   are mutually exclusive) and a relic opening yields exactly one reward (so the
   wanted slots inside a relic are too).                                        */
(function () {
  "use strict";

  /* The rotation model - what one run at a node is actually worth - lives in
     assets/rotation.js, so this page and the collection view cannot disagree
     about it. Aliased here so the call sites read the same as they always did. */
  const ROT = window.WFPrimeRotation;
  const runValue = ROT.runValue;
  const liveRotation = ROT.liveRotation;
  const untilText = ROT.untilText;
  const isRailjack = ROT.isRailjack;
  const isEvent = ROT.isEventNode;
  const bountyEvent = ROT.bountyEvent;
  const eventRunning = ROT.eventRunning;
  const notADestination = ROT.notADestination;
  const CYCLE_MINUTES = ROT.cycleMinutes;

  /* Storage, the escaper, the tooltip, the staleness banner and the backup
     file are shared with the collection view - see assets/shared.js. */
  const S = window.WFPrimeShared;
  const { esc, $, $$, load, save } = S;
  const KEY_PARTS = S.KEYS.parts;
  const KEY_WISH = S.KEYS.wishlist;
  const KEY_PLAN = S.KEYS.plan;
  const KEY_MATERIALS = S.KEYS.materials;

  /* Up here rather than beside the crack list it belongs to, because the saved
     tier is normalised against it while `opts` is being read — which happens
     long before that section of the file. A `const` used above its declaration
     is a ReferenceError, not a hoisted `undefined`. */
  const TIERS = ["Lith", "Meso", "Neo", "Axi"];

  /* What a relic opening is worth, and how to read a backup - shared with the
     collection view, and testable without a browser. See assets/model.js. */
  const M = window.WFPrimeModel;

  const DATA = window.WFPRIME_DATA;

  if (!DATA || !DATA.items) {
    document.body.innerHTML =
      '<p class="nodata">' +
      "No data yet. Double-click <code>refresh-data.cmd</code>, then reload this page.</p>";
    return;
  }


  const ITEMS = DATA.items;
  const RELICS = DATA.relics || {};
  /* Empty is a valid answer — see paintFissures. Taken by reference and never
     reassigned: `shared.js` re-reads this list every ten minutes and splices
     the new one into the same array, so a page left open keeps up without
     either of us re-binding anything. It also guarantees the array exists, so
     there is no `|| []` here to quietly detach this page from the refresh.

     `nodeKey` is how DE name a node in that list, and it is what the ranking
     has to be matched against. Declared up here because the fold reads it, and
     the fold runs before anything further down this file has been evaluated. */
  const FISSURES = DATA.fissures;
  const nodeKey = (n) => n.node + " (" + n.planet + ")";
  const BY_ID = new Map(ITEMS.map((i) => [i.id, i]));
  const REFINEMENTS = (DATA.meta && DATA.meta.refinements) ||
    ["Intact", "Exceptional", "Flawless", "Radiant"];

  /* Forma has one home: the materials list on the collection page, where it is
     row one. The planner used to keep its own copy in KEY_PLAN, so the same
     number had to be typed twice and the two could disagree. These read and
     write that shared row instead. */
  const isForma = (m) => m && String(m.name || "").trim().toLowerCase() === "forma";
  function readForma() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY_MATERIALS) || "null");
      const row = Array.isArray(raw) ? raw.find(isForma) : null;
      if (row) {
        return { have: Math.max(0, Number(row.have) || 0),
                 need: Math.max(0, Number(row.need) || 0) };
      }
    } catch (e) { /* fall through */ }
    return null;
  }
  function writeForma(have, need) {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY_MATERIALS) || "null");
      const list = Array.isArray(raw) ? raw : [];
      let row = list.find(isForma);
      if (!row) { row = { name: "Forma", have: 0, need: 0 }; list.unshift(row); }
      row.have = have; row.need = need;
      localStorage.setItem(KEY_MATERIALS, JSON.stringify(list));
    } catch (e) { /* non-fatal */ }
  }

  /* ── what you own, which is not this page's to keep ──────────────
     The collection, the parts and the farm list live in `shared.js`. They used
     to live here as well, and the two copies drifted — see the comment above
     `makeState`. Everything below reads through `ST`; nothing here writes
     localStorage for them. */
  const ST = S.state;
  // an entry for a Prime the catalogue no longer has is dropped once, here,
  // rather than filtered on every read by whichever page remembered to
  ST.pruneWishlist((id) => BY_ID.has(id));
  const opts = Object.assign(
    /* `capped` defaults OFF, and that is the same ruling as before wearing the
       other name. The owner's call of 2026-08-25 was that traces are almost
       always tight, so the app should assume a free Radiant is worth something;
       renaming the switch on 2026-09-05 to ask "are you at the cap" inverted
       the tick without changing the assumption. Off is still the common case,
       and it is still the state in which a Radiant source scores higher.
       `M.migrateCapped` below carries an old saved `traces` across. */
    /* `railjack` on by default since 2026-08-27, at the owner's direction. It
       gates whether Proxima nodes are ranked at all, and six Primes have no
       route that is not Railjack — with it off the planner silently declines to
       rank the only places those can be farmed, which is the shape of omission
       this project has had to fix before. Anyone without a ship unticks it once
       and the choice is saved. */
    { squad: false, event: false, railjack: true, aya: true, capped: false,
      minutes: {}, sort: "rate", tier: null, varzia: true, trade: true },
    M.migrateCapped(load(KEY_PLAN, {})));

  /* Whether the ranked list is showing all of itself or just the top eight.
     Deliberately NOT in `opts` and not saved: `opts` holds assumptions about the
     player — how they play, what they will run — and every one of them changes
     the answer. This changes only how much of the answer is on screen, and a
     view that silently stayed expanded from last week would make the default
     stop meaning "the top of the ranking is the answer". Resets on reload. */
  let expandNodes = false;

  /* Which relic tier *How to crack them* is showing, and whether Varzia's shelf
     and the trade-only relics are among it. `null` means every tier, which is
     the default and the honest answer — the control only narrows what is on
     screen and never re-ranks, so the best answer is still the one you get
     without touching it.

     **Saved since 2026-09-01, at the owner's direction, reversing the decision
     below.** These were deliberately not saved, on the argument that `opts`
     holds assumptions about the player while these change only how much of the
     conclusion is visible — and that a tier still selected from last week would
     make the list look short for a reason nobody could see.

     What that argument missed is the cost on the other side: a reader who wants
     Varzia's relics off has to say so on every single visit, and an app that
     makes you repeat a choice is not protecting you from it. `sort` was already
     view state living in `opts` and already saved, so the line the old reasoning
     drew was not where it claimed to be either. The "looks short for no visible
     reason" risk is real and is answered by the strip itself: the tab is drawn
     pressed and every count beside it is live, so the reason is on screen.

     `expandNodes` above stays unsaved, and that is not an inconsistency — it has
     no control showing its state once the page is drawn.

     Read back defensively: `tier` comes from a store a backup can write, so it
     is normalised against the real tier list rather than trusted. */
  let relicTier = TIERS.indexOf(opts.tier) >= 0 ? opts.tier : null;
  let showVarzia = opts.varzia !== false;
  /* Trade-only relics default **on**, which is the existing behaviour rather
     than a new opinion. They are on the list deliberately — a Prime with no way
     in at all still has a real answer to "which relics do I trade for, and at
     what refinement", and returning an empty page to that reads as a fault.
     Hiding them by default would quietly undo that decision; offering the
     control lets a reader deciding what to crack tonight put them away without
     anyone deciding on their behalf. */
  let showTrade = opts.trade !== false;
  let showBaro = opts.baro !== false;

  /* Is Baro on a relay *right now*, by this page's clock rather than the
     build's? Same helper and the same reasoning as the collection view's Baro
     filter (`app.js`): a build is up to ten minutes old and a tab can be open
     for hours, so freezing the answer at build time is wrong twice a fortnight.

     This is what makes the owner's decision of 2026-09-04 hold — *we keep the
     relic while he is here and then forget he had it*. `relics[n].baro` says
     what his manifest held when the build ran; this says whether that is still
     true. Both have to agree before a row claims he is selling anything. */
  const baroIsHere = (now) => ROT.traderWindow((DATA.meta || {}).baro, now).here;

  /* Which number puts the rows in order. Both count the same thing - wanted
     relics - and differ only in what they divide it by, which is the question
     the reader is actually asking:

       rate   per reward, or per minute once minutes are given. How fast a
              place fills the stack for the effort it costs. The default.
       run    per run, cost ignored. How much one trip hands over.

     They disagree whenever a long run is worth going on with: a four-round
     Defense pays more per run than per round, and which of those you care about
     depends on whether your evening is short of time or short of patience for
     loading screens. The page could not be asked before.

     Not offered here: ranking on what a relic is *worth* once opened. That is
     the other list's question and mixing it back in is the thing the split of
     2026-08-14 exists to prevent (`PROJECT.md §7`). It stays on the row, one
     line down, where the two can be compared. */
  /* *Reward*, not *objective*, since 2026-08-27. The word changed because the
     thing it counts was settled: an objective is whatever pays a reward, so the
     unit is one reward draw on every row — a Defense round, a Spy vault, a
     bounty stage. It was called an objective while it meant two things at once,
     which is exactly the sort of word that survives by being vague. */
  const SORTS = {
    rate: { key: "rate", unit: (perMin) => "relics / " + (perMin ? "min" : "reward"),
            heading: (perMin) => "ranked on relics per " + (perMin ? "minute" : "reward"),
            option: (perMin) => "per " + (perMin ? "minute" : "reward") },
    /* `perRunAdj`, not `perRun`: the key the list SORTS on has to be the one
       carrying the cache penalty and the Radiant lift, or ranking per run quietly
       undoes both. See `n.adj`. */
    run: { key: "perRunAdj", unit: () => "relics / run",
           heading: () => "ranked on relics per run",
           option: () => "per run" },
  };
  const sortBy = () => SORTS[opts.sort] || SORTS.rate;

  const needOf = (p) => p.itemCount || 1;
  const haveOf = (id, name) => ST.owns(id, name);

  /* ── effort, supplied by the player and empty by default ──────────
     Minutes for one *reward* of each mission type. Nothing is filled in to
     begin with, and nothing has to be: the list is costed by reward *count*
     until someone says what a reward costs them in minutes.

     It exists because ranking per run flatters anything long. Against one
     player's own timings, costing per minute moved Capture and Exterminate
     nodes up over a hundred places and dropped Spy by a factor of ten - far too
     big to ignore, and far too personal to ship a default for. A strong player
     trivialises a Capture while a Spy vault still costs its fixed hacking time,
     so even the ratios between the numbers are that player's own.

     Objective count is the compromise that needs no answer: against those same
     timings it is out by 2.4x where per-run is out by 9.6x, because a round, a
     vault and a bounty stage all take roughly 2.5 to 6 minutes. Four times
     closer to the truth for free, and nobody has to agree with a shipped number.

     A mission type left blank while others are filled in cannot be costed at
     zero, or it would sort straight to the top of a list it was never measured
     against. It is costed at the average of the ones you did fill in, and the
     row says so - a guess you can see beats a guess you cannot. */
  opts.minutes = (function (raw) {
    const clean = {};
    const src = raw && typeof raw === "object" ? raw : {};
    Object.keys(src).forEach((mode) => {
      const v = Number(src[mode]);
      if (isFinite(v) && v > 0) clean[mode] = v;
    });
    return clean;
  })(opts.minutes);

  /* What a run costs before and after the part anyone counts: loading in, and
     getting out once the objective is done. Sanitised the same way and for the
     same reason — these reach `innerHTML` and arrive from a file the app invites
     you to import. Zero is allowed here and is not allowed above: an unset
     mission type has to be costed at the average of the others, but an overhead
     of zero is a legitimate answer meaning "I do not count it". */
  const overheadMin = (raw) => {
    const v = Number(raw);
    return isFinite(v) && v >= 0 ? v : 0;
  };
  opts.runStart = overheadMin(opts.runStart);
  opts.runEnd = overheadMin(opts.runEnd);

  const minutesSet = () => Object.keys(opts.minutes);

  /* Effort is per-objective minutes plus a flat cost charged **once per run**.
     Measured by the owner from their own runs: a mission start is about 20
     seconds and an end about 15, so 35 seconds whatever the run is — and because
     it is fixed, the error it corrects lands almost entirely on the short ones.
     Capture's cost rises 38.9% and its rate falls 28%, against 1.9% for
     Survival, so part of Capture's winning margin was an accounting error.

     `overhead` is exposed separately from `per` because the two are charged
     differently: `per` multiplies by the objective count, this is added once.
     Folding it into `per` would charge it per round, which is the opposite of
     the point. */
  function effort() {
    const set = minutesSet();
    const overhead = opts.runStart + opts.runEnd;
    /* No per-mode minutes means no per-minute ranking, even with an overhead
       given. 35 seconds has no meaning in objective *count* — a round is
       anything from a 45-second Defense wave to a five-minute Survival rotation
       — so an overhead alone cannot convert the default ranking into a
       per-minute one. It waits for the numbers it can be added to. */
    if (!set.length) return null;
    const mean = set.reduce((s, m) => s + opts.minutes[m], 0) / set.length;
    return {
      per: (mode) => opts.minutes[mode] || mean,
      assumed: (mode) => !opts.minutes[mode],
      overhead,
    };
  }

  /* The Void Trace cap is derived from the Mastery Rank, and it is stated on
     the rank badge's own tooltip rather than under this switch. It had a line
     there for one revision and the line was the wrong length for the job: the
     switch already names both its ends — *under 500* and *over 500* — so a
     sentence beneath it explaining 500 was restating the control it sat under.
     A cap belongs to the rank, not to the switch, and the badge is where a
     reader goes to ask what their rank means. See `traceCap` in shared.js. */

  /* Railjack, event nodes and the bounty clock all live in
     assets/rotation.js - see the alias block at the top of this file. */

  /* ── what you still want ─────────────────────────────────────── */
  function wantedIndex() {
    const want = new Map();   // relic -> [{label, chances, qty, stillNeed}]
    const needs = [];         // for the "still needed" list
    /* Relics belonging to a Prime with no way in at all — every relic vaulted,
       and no Baro, quest or event route either. They are kept rather than
       filtered because *"which relics do I need to trade for, and at what
       refinement"* is a real question with a real answer, and returning an
       empty page to it reads as a fault. Populated below, once each wanted item
       has been walked and it is known whether anything of its is obtainable. */
    const stranded = new Set();

    ST.wishlist.forEach((id) => {
      const it = BY_ID.get(id);
      if (!it) return;
      const mine = [];
      it.parts.forEach((p) => {
        const short = needOf(p) - haveOf(id, p.name);
        if (short <= 0) return;
        /* `builtFrom` marks a part that is a whole Prime in its own right - an
           akimbo is built from two of the single-handed weapon. It has no
           relics of its own, so without this the row below would fall through
           to "vaulted", which is the one thing it is not. */
        needs.push({ item: it, part: p.name, short, need: needOf(p),
                     builtFrom: p.builtFrom || null });
        p.relics.forEach((r) => {
          mine.push(r.relic);
          if (!want.has(r.relic)) want.set(r.relic, []);
          want.get(r.relic).push({
            label: `${it.name} ${p.name}`,
            chances: r.chances || {}, qty: 1, stillNeed: short,
          });
        });
      });

      /* Is there any way in at all? A relic that still drops or that Varzia is
         selling counts; so does a route that is not a relic — Baro, a quest, an
         event, the Founder pack. If none of that is true, the only honest
         answer is the trade list, so its relics are let through the filter that
         would otherwise drop every one of them. */
      const f = it.flags || {};
      const buyable = mine.some((n) => {
        const rec = RELICS[n];
        return rec && (!rec.vaulted || rec.resurgence || isBaro(n));
      });
      if (!buyable && !f.baro && !f.special && !f.founder && !f.permanent) {
        mine.forEach((n) => stranded.add(n));
      }
    });

    /* Forma never *adds* a relic to the plan.

       Nobody runs a relic purely for Forma — you accumulate it from the rolls
       that miss what you were actually after. So it only inflates the value of
       relics already worth running for a Prime part, which also stops it
       flooding the ranking (it sits in 24 of the 34 live relics).

       A 2x drop still only counts double when two or more are wanted. */
    const forma = readForma() || { have: 0, need: 0 };
    const formaShort = Math.max(0, forma.need - forma.have);
    if (formaShort > 0) {
      want.forEach((entries, rname) => {
        (RELICS[rname] ? RELICS[rname].rewards || [] : []).forEach((rw) => {
          if (!/^Forma/.test(rw.item)) return;
          entries.push({
            label: "Forma Blueprint", chances: rw.chances || {},
            qty: rw.qty || 1, stillNeed: formaShort, bonus: true,
          });
        });
      });
      needs.push({ item: { name: "Forma", id: null }, part: "Blueprint",
                   short: formaShort, need: forma.need, bonus: true });
    }
    return { want, needs, formaShort, stranded };
  }

  const relicValue = (entries, refinement) =>
    M.relicValue(entries, refinement, opts.squad);

  /* Which refinement to take this relic to.

     Not "whichever gives the best chance of *something* wanted" — that lets a
     common's 25.33% drown out a rare you are actually blocked on, and tells you
     to run Intact while the rare stays at 2%. What matters when relics are
     finite is how long it takes to get *everything* you want out of this relic,
     and that is set by the scarcest reward. So: minimise the expected openings
     for the worst-off wanted reward, and break ties on total hit rate.

     Concretely, wanting a common and a rare from one relic flips Intact (best
     total, 27.33%) to Radiant, which cuts the rare from 50 expected openings to
     10 while the common merely slips from 3.9 to 6.

     Forma never sets the bottleneck — you are not blocked on Forma — but it
     still counts towards the tie-break and the node score. */
  const bestRefinement = (entries) =>
    M.bestRefinement(entries, { refinements: REFINEMENTS, squad: opts.squad });

  /* ── a relic handed over already refined ──────────────────────────
     Eleven nodes do it, all Radiant: Elite Sanctuary Onslaught, the six Void
     Storms, and the four Profit-Taker phases (`PROJECT.md §7`). DE names the
     refinement on those reward rows and on no others.

     It cuts both ways, which is why it cannot just be treated as a bonus.

     `bestRefinement` picks a refinement per relic on the assumption that the
     choice is yours - you spend the Void Traces and you spend them on whatever
     clears your scarcest wanted reward fastest. A node that hands the relic
     over Radiant has taken that choice away, so the only honest value is the
     value AT THE REFINEMENT YOU WERE GIVEN:

       * wanted Radiant anyway -> full value, and 100 Void Traces you keep
       * wanted Intact, given Radiant -> the common you were after has gone from
         25.33% to 16.67%, so this copy is worth less to this plan than one you
         picked up on the star chart. Not worthless, and worth more outside the
         plan - but the plan is what is being ranked.

     Traces are counted but not scored. 100 traces is real - it is the whole
     cost of a Radiant, and the owner rates it a serious bottleneck - but what
     it is worth depends on how many you have, which is a fact about the player
     that this app does not know. Same call as Mastery Rank: a player fact we
     cannot see annotates the row rather than moving it. See TODO.md for the
     exchange rate that would settle it. */
  /* Moved into `model.js` on 2026-08-25 so the Radiant bonus could be tested
     without a browser — the two attempts before it both failed silently, and
     neither had a test that could have caught it. See `M.sourceValue`. */
  const sourceValue = (s, rp) => M.sourceValue(s, rp, opts);

  /* ── the free relic for staying in a fissure ──────────────────────
     An endless Void Fissure pays a bonus relic for depth: five rotations gives
     a random *Exceptional* relic of the fissure's tier, ten a Flawless, and
     every fifth after fifteen a Radiant. Only the `bonus` run mode goes deep
     enough to collect one - see rotation.js.

     **It is not conditioned on the node actually being a fissure, and that is a
     choice rather than a limit.** It reads as one because of how this comment
     used to be worded: the live list was fetched from 2026-08-14, and re-read
     every ten minutes from 2026-08-24, so the badges on these rows have known
     for some time. What has not changed is the reason. A fissure lasts an hour
     or two while this ranking is built from tables that move a few times a
     year, so letting one into the score would reshuffle the list hourly for a
     fact that expires before anyone acts on it. The mode means "when you run
     one of these as a fissure", the row says which ones those are, and the
     arithmetic below is deliberately node-independent - which is what makes the
     flat addition safe. `PROJECT.md §7`.

     Three things make this different from every other number on a row, and all
     three are the reason it is computed here rather than per node:

       * it is *random of the tier*, so its worth is the mean over every live
         relic in that tier - including the many worth nothing to this plan
       * the tier is your choice, since you pick which fissure to run, so the
         best tier is the one to price it at
       * it does not depend on the node at all. Any endless mission run as a
         fissure pays the same bonus, so this is a flat addition, and what it
         actually changes is endless-versus-short rather than one endless node
         against another.

     Railjack is excluded: its fissures are Void Storms, which are their own
     nodes with their own tables and no rotations to stay for. */
  function fissureBonus(relicPlan) {
    const tiers = {};
    Object.keys(RELICS).forEach((name) => {
      if (RELICS[name].vaulted) return;
      const tier = String(name).split(" ")[0];
      const t = tiers[tier] || (tiers[tier] = { n: 0, value: 0, wanted: 0 });
      t.n += 1;
      const rp = relicPlan.get(name);
      if (rp) {
        t.value += (rp.byRefinement || {}).Exceptional || 0;
        t.wanted += 1;
      }
    });
    /* **Per tier, and the node picks its own — corrected 2026-09-04.**
       This returned only the best tier, on the reasoning quoted at the call
       site: the bonus was a flat addition to every endless node, so a
       node-independent constant could not reorder anything and pricing it at
       the tier you would choose was right.

       That reasoning stopped holding when the run mode started being chosen by
       the fissure actually live on the node. You do not get to pick the tier of
       a fissure that is already running: if Mithra is carrying a **Neo**
       fissure, staying five rotations there pays a free **Neo** relic, whatever
       Lith or Axi would have been worth.

       Reported by the owner on 2026-09-04 — *"the free relic is a Neo, while I
       don't need Neo relics"* — on a row that credited one anyway, because the
       run was node-specific and the price was not. */
    const byTier = {};
    let best = { tier: null, value: 0, count: 0 };
    Object.keys(tiers).forEach((tier) => {
      const t = tiers[tier];
      if (!t.n) return;
      const value = t.value / t.n;
      /* 150% when traces are tight, per the owner 2026-09-04: the relic itself,
         plus half again for arriving Exceptional rather than Intact. Off when
         the reader has not said traces are short, because then the refinement
         is a convenience rather than a saving. `M.FISSURE_REFINED_BONUS` has
         the reasoning and why it is larger than `RADIANT_BONUS`. */
      const refined = !opts.capped ? 1 + M.FISSURE_REFINED_BONUS : 1;
      byTier[tier] = { tier, value: value * refined, plain: value,
                       refined: !opts.capped,
                       count: t.wanted / t.n, pool: t.n, want: t.wanted };
      if (byTier[tier].value > best.value) best = byTier[tier];
    });
    return { byTier, best };
  }

  /* ── the plan ────────────────────────────────────────────────── */

  function buildPlan() {
    const { want, needs, formaShort, stranded } = wantedIndex();

    /* Only relics you can actually get hold of right now — which is not the
       same as "relics that drop". A Prime Resurgence relic is **vaulted by
       definition**: that is what being in Resurgence means, it is out of the
       normal rotation and Varzia sells it for Aya instead. All 88 of them carry
       `sourceCount: 0`.

       So `rec.vaulted` alone silently emptied the crack list for exactly the
       Primes the collection page was busy badging as available. Put five
       Resurgence Primes on the farm list and the planner had nothing whatever
       to say about them, which reads as a broken page rather than as a
       deliberate silence.

       *Where to go* stays right to ignore them, and needs no change to do it:
       the node loop walks each relic's `sources`, and these have none. This
       list is the other half of the split — it ranks openings to finish a relic
       and knows nothing about where the relic came from — so a relic bought
       with farmed Aya belongs in it on exactly the same terms as a dropped one. */
    const relicPlan = new Map();
    /* Relics this list declines to show, counted rather than merely dropped.
       A Prime you can get another way, some of whose relics are vaulted, keeps
       those relics out of the crack list — which is right, since there is
       somewhere to go and burying it under relics you cannot farm is what the
       filter is for. What was wrong is that it happened in **silence**: a
       reader could not tell a complete list from a filtered one.

       Saying it costs nothing and decides nothing. The other shape this could
       take — a planner switch, *"I have vaulted relics"*, that stops filtering
       — needs the reader to tell us something only they know, and the relic
       inventory that would answer it properly is declined in `TODO.md`. A count
       sidesteps that question rather than pre-empting it. */
    let vaultedOut = 0;
    want.forEach((entries, rname) => {
      const rec = RELICS[rname];
      if (!rec || (rec.vaulted && !rec.resurgence && !isBaro(rname)
                   && !stranded.has(rname))) {
        // Only ones genuinely wanted: a relic held by the Forma bonus alone is
        // not something the reader is short of, and counting it would overstate
        // what is being hidden from them.
        if (rec && entries.some((e) => !e.bonus)) vaultedOut += 1;
        return;
      }
      // a relic held only by the Forma bonus is not worth running on its own
      if (!entries.some((e) => !e.bonus)) return;
      const { refinement, value, openings, blocker } = bestRefinement(entries);
      if (value <= 0) return;
      /* What this relic is worth at every refinement, not just the chosen one.
         The choice assumes you decide - you buy the refinement with 100 Void
         Traces and you buy the one that suits your bottleneck. Eleven nodes
         take that choice away by handing the relic over already Radiant, and
         then the only honest value is the value at the refinement you were
         actually given. See `sourceValue`. */
      const byRefinement = {};
      REFINEMENTS.forEach((f) => { byRefinement[f] = relicValue(entries, f); });

      /* How many things on your list this one relic clears. `openings` is set by
         the *scarcest* of them, so a relic holding three wanted parts reports a
         bigger number than one holding a single easy part - and on its own that
         reads backwards when you are cracking a stack. Meso Y2 clears three
         parts in 10 openings; Axi P10 clears one in 5. Per part cleared that is
         3.3 against 5.0, and Meso Y2 is the better relic to spend a stack on. */
      const clears = new Set(entries.filter((e) => !e.bonus).map((e) => e.label)).size;

      relicPlan.set(rname, {
        refinement, value, openings, blocker, entries, byRefinement, clears,
        perPart: clears > 0 ? openings / clears : Infinity,
        wants: Array.from(new Set(entries.map((e) => e.label))).sort(),
      });
    });

    /* Places that hold something wanted and were left out by an option rather
       than by the data. Counted so an empty ranking can name the switch that
       emptied it - see `noNodes`. */
    /* The Steel Path is deliberately NOT a filter here. It gates entering a
       node, so by the rule in PROJECT.md 7 it ought to be one - but every Steel
       Path table carrying a relic today is a Faceoff variant identical to its
       ordinary twin, same 22 relics at the same 8.33%. An option that changes
       two duplicate rows and nothing else is a question not worth asking. The
       demand badge on the row says which nodes need it; that is the whole of
       what there is to say. */
    const nodes = new Map();
    const blocked = { railjack: new Set(), event: new Set() };
    relicPlan.forEach((rp, rname) => {
      const srcs = RELICS[rname].sources || [];
      /* ── an opt-in gate in front of your only option ─────────────────
         Railjack is left out by default because it is a different activity
         with its own setup. For six Primes it is the ONLY activity: their
         original relics are vaulted and Railjack has been the sole current
         source for years. Excluding those is not a filter, it is a dead end —
         the ranking came back empty and named a switch, which is better than
         silence but still asks the reader to opt in to the only thing there is.

         So a relic with nothing reachable under the switches as set has its
         Railjack routes let through anyway, and every row built from one is
         marked. The checkbox keeps meaning what it says for everything else:
         this fires only when the alternative is nowhere at all. Owner's
         decision, 2026-08-25 — option (ii) of three. */
      const stranded = !srcs.some((s) => ROT.reachableSource(s, opts));
      srcs.forEach((s) => {
        if (notADestination(s)) return;      // quest, or not modelled yet
        const skip = `${s.planet}|${s.node}|${s.mode}`;
        let onlyRoute = false;
        if (!ROT.reachableSource(s, opts)) {
          /* Event nodes are never forced: an event that is not running does not
             exist on the star chart, so there is nothing to send anyone to. A
             Railjack node is always there — the reader simply has to want it. */
          if (stranded && isRailjack(s) && !isEvent(s)) onlyRoute = true;
          else {
            if (isRailjack(s)) blocked.railjack.add(skip);
            else blocked.event.add(skip);
            return;
          }
        }
        const key = `${s.planet}|${s.node}|${s.mode}`;
        let n = nodes.get(key);
        if (!n) {
          n = { planet: s.planet, node: s.node, mode: s.mode,
                kind: s.kind, lvl: s.lvl || null, event: isEvent(s),
                eventBounty: bountyEvent(s),
                railjack: isRailjack(s), score: 0,
                rot: { A: 0, B: 0, C: 0, none: 0 },
                /* `rot` before Aya is folded into it. Reported by the owner
                   2026-09-04: Mithra read `rot A+B+C` for a farm list whose only
                   relic there is `Axi P10`, which Digital Extremes drop in
                   rotation C alone. Rotations A and B were non-zero purely
                   because Aya drops in them, and the row already says `aya` in
                   its own chip — so the letters were reporting two different
                   facts as one, and the reader has no way to tell which. The
                   ranking still reads `rot`; only the label reads this. */
                rotRelic: { A: 0, B: 0, C: 0, none: 0 },
                /* The same rolls counted rather than valued: the plain chance a
                   reward here is a relic on the list, before anything is said
                   about what opening it would be worth. Kept alongside rather
                   than divided back out of the score, because the score has
                   Forma and Aya folded into it and neither is a relic. */
                cnt: { A: 0, B: 0, C: 0, none: 0 },
                /* Every relic source that lands on this node, kept per rotation
                   letter until the walk is over. `rot` and `cnt` cannot be
                   accumulated as we go any more: whether one relic adds
                   anything depends on the others here, which is not known until
                   the last of them has arrived. See `M.creditRelics`. */
                rows: { A: [], B: [], C: [], none: [] },
                relics: new Map() };
          nodes.set(key, n);
        }
        const slot = { A: "A", B: "B", C: "C" }[String(s.rotation || "").toUpperCase()] || "none";
        // this row exists despite the switch, and has to say so
        if (onlyRoute) n.onlyRoute = true;
        const worth = sourceValue(s, rp);
        if (worth.pre) {
          n.preRefined = true;
          n.tracesSaved = Math.max(n.tracesSaved || 0, worth.traces);
          n.overshot = n.overshot || worth.value < rp.value - 1e-12;
        }
        /* `worth.value` already carries the Radiant bonus when the player has
           said traces are tight - see `M.sourceValue`. It is a multiplier on the
           relic's value rather than a term added beside it, which is what keeps
           it from being the zero the two previous attempts produced. */
        n.rows[slot].push({ name: rname, chance: (s.chance || 0) / 100,
                            value: worth.value, wants: rp.wants });
        /* How much of what you want here arrives already Radiant. Kept as a
           share rather than a flag so a node that is only partly pre-refined
           earns only part of the bonus - none is today, all eleven are wholly
           Radiant, so this is 1 on each of them. */
        n.wantCnt = (n.wantCnt || 0) + (s.chance || 0) / 100;
        if (worth.bonus) n.radCnt = (n.radCnt || 0) + (s.chance || 0) / 100;
        const prev = n.relics.get(rname);
        if (prev == null || (s.chance || 0) > prev.chance) {
          n.relics.set(rname, { chance: s.chance || 0, rotation: s.rotation });
        }
      });
    });

    /* ── relics that add nothing to the ones beside them ──────────────
       Done here rather than in the walk above because it is a question about
       the node as a whole: whether `Axi A21` is worth anything at Apollo
       depends on `Axi D6` also dropping there, which is not known until every
       source has been placed. `M.creditRelics` has the rule and the reasoning;
       `n.overlap` is what the row says about it. */
    nodes.forEach((n) => {
      const spent = [];
      Object.keys(n.rows).forEach((slot) => {
        const c = M.creditRelics(n.rows[slot]);
        n.rot[slot] = c.worth;
        n.cnt[slot] = c.count;      // rolls counted, never valued
        /* The same figure before Aya is added to it, and it exists only so the
           row can name the rotations that actually drop a **relic** you want.
           `n.rot` keeps the total and is what the ranking divides — nothing
           about the scoring reads this. See `runTag`. */
        n.rotRelic[slot] = c.worth;
        c.spent.forEach((s) => {
          /* One line per relic, not per rotation: a relic covered in both B and
             C is one redundancy the reader has to know about, not two. */
          if (!spent.some((x) => x.name === s.name)) spent.push(s);
        });
      });
      if (spent.length) n.overlap = spent;
    });

    /* ── Aya ──────────────────────────────────────────────────────────
       Aya is banked, not spent on sight, so it is worth something for as long
       as anything vaulted is still missing from your *collection* - not merely
       from your farm list. You pick it up because the vault holds Primes you do
       not own, whether or not you are chasing them this week. Requiring them to
       be on the farm list first was wrong: it scored zero for exactly the
       player who should be collecting Aya.

       Valued at the best relic Varzia is selling this rotation that holds
       something you are missing. With no rotation running there is nothing to
       buy, so it falls back to the best vaulted relic - though in practice Aya
       does not drop then either, so that branch is a guard rather than a path.

       Zero once every vaulted Prime is collected, which is the condition asked
       for. And it only ever inflates a node already worth running, the same
       rule Forma follows.

       Matched through each part's own relic list rather than by name: a reward
       is called "Baruuk Prime Chassis Blueprint" while the part is "Chassis",
       so string matching would quietly work for Blueprint and fail for the
       other three. */
    let ayaValue = 0, ayaRelic = null, ayaRotationLive = false, ayaMissing = 0;
    let ayaTargeting = false;
    if (opts.aya) {
      const expiry = ((DATA.meta || {}).resurgence || {}).expiry;
      const anyOnSale = Object.keys(RELICS).some((n) => RELICS[n].resurgence);
      ayaRotationLive = anyOnSale &&
        (!expiry || new Date(expiry).getTime() > Date.now());

      const vaultWanted = new Map();
      ITEMS.forEach((it) => {
        if ((it.flags || {}).farmable) return;      // farmable needs no Aya
        (it.parts || []).forEach((p) => {
          const short = needOf(p) - haveOf(it.id, p.name);
          if (short <= 0) return;
          ayaMissing += 1;
          (p.relics || []).forEach((r) => {
            if (!vaultWanted.has(r.relic)) vaultWanted.set(r.relic, []);
            vaultWanted.get(r.relic).push({
              label: `${it.name} ${p.name}`,
              chances: r.chances || {}, qty: 1, stillNeed: short,
            });
          });
        });
      });

      /* **Are you actually chasing something Varzia is selling?** Owner's rule,
         2026-09-04, and it is a discount rather than a gate:

           - a relic on your farm list is worth 100%, by definition
           - Aya, while you are targeting Resurgence, is worth 100% too — one
             Aya *is* one relic of your choosing, so it is the same thing
           - Aya, when you are not, but vaulted Primes are still missing from
             your collection, is worth 30%: real, because the vault is what you
             are banking against, but not the same as a relic you want tonight
           - Aya, with nothing vaulted missing and nothing in Resurgence you
             want, is worth 0

         The 30% keeps the decision of 2026-08-27 — Aya counts for gaps in your
         **collection**, not merely your farm list, because it is banked rather
         than spent on sight — while fixing what that decision overshot. Valuing
         a someday-Prime the same as tonight's target put Aya nodes above nodes
         that drop the relic you are actually here for. */
      const targeting = ayaRotationLive && [...want.keys()].some(
        (rname) => (RELICS[rname] || {}).resurgence);

      vaultWanted.forEach((entries, rname) => {
        const rec = RELICS[rname];
        if (!rec || !rec.vaulted) return;
        if (ayaRotationLive && !rec.resurgence) return;   // only what is on sale
        const { value } = bestRefinement(entries);
        if (value > ayaValue) { ayaValue = value; ayaRelic = rname; }
      });
      ayaTargeting = targeting;
      if (!targeting) ayaValue *= M.AYA_BANKED_SHARE;
    }

    if (ayaValue > 0) {
      const byNode = new Map();
      (DATA.aya || []).forEach((a) => {
        if (!opts.railjack && isRailjack(a)) return;
        if (!opts.event && isEvent(a)) return;
        const key = `${a.planet}|${a.node}|${a.mode}`;
        const n = nodes.get(key);
        if (!n) return;                       // never adds a node, only inflates
        const slot = { A: "A", B: "B", C: "C" }[String(a.rotation || "").toUpperCase()] || "none";
        const prev = byNode.get(key + "|" + slot);
        if (prev != null && prev >= (a.chance || 0)) return;
        byNode.set(key + "|" + slot, a.chance || 0);
        n.rot[slot] += ((a.chance || 0) / 100) * ayaValue;
        /* Aya counts in the relic count too, at one relic each. It is not a
           relic, but it is the only thing in the game that becomes exactly one
           relic of your choosing - so for "how fast does the stack fill", which
           is what the left-hand ranking now asks, it fills it. Only where it is
           worth something, which is the same condition its value uses. */
        n.cnt[slot] += (a.chance || 0) / 100;
        n.aya = Math.max(n.aya || 0, a.chance || 0);
      });
    }

    /* Which rotations are worth something here **only** because of the Aya.
       Computed after the block above rather than beside `rotRelic`, because
       until the Aya has landed the answer is always "none".

       These are named in the `aya` chip's tooltip and deliberately not in the
       `rot` letters. Splicing them into the letters was the first attempt and
       was the original defect wearing a different hat — the row already says
       `aya`, so the letters were saying it a second time. Owner's call,
       2026-09-04. */
    nodes.forEach((n) => {
      n.ayaRots = ["A", "B", "C"].filter(
        (r) => (n.rot[r] || 0) > 0 && !((n.rotRelic[r] || 0) > 0));
    });

    // value each node as a whole run, which is what you actually commit to
    const mins = effort();
    /* Worked out once for the whole plan because the *arithmetic* is the same
       everywhere — the mean worth of a random Exceptional over a tier's live
       relics does not depend on where you are standing. **Which tier does**,
       and that is the correction of 2026-09-04: the node takes the tier of the
       fissure running on it, not the best one on offer. See `fissureBonus`. */
    const bonus = fissureBonus(relicPlan);
    const now = Date.now();
    const fissureAt = (n) =>
      ROT.fissuresAt(FISSURES, nodeKey(n), now, opts.railjack, opts.steel)[0] || null;
    nodes.forEach((n) => {
      const live = n.kind === "bounty" ? liveRotation(n.node) : null;
      /* Railjack is excluded from the fissure branch for the same reason its
         bonus is: Void Storms are their own nodes with their own tables and no
         rotations to stay for, so "run it to five rotations" means nothing. */
      const fis = isRailjack(n) ? null : fissureAt(n);
      const r = runValue(n.rot, n.mode, opts.squad, live, n.cnt, !!fis);
      /* The one deliberate thumb on the scale in the whole model - see
         rotation.js. Applied to the score, never to the count below it: what a
         run hands you is a fact, this is only what we think it is worth going
         for. */
      n.halved = ROT.isRailjackCache(n);
      /* The Radiant uplift, applied the way the cache penalty is: a multiplier
         on the ranked figure, never on `perRun` or `anyRun` underneath it. Those
         two are facts about what a run hands over - one is a count and the other
         a probability - and 1.25x a probability is simply a wrong probability.
         Applying it inside the value instead left the order untouched, measured
         at +0.0% on all eleven, because the ranked number comes from the counts. */
      n.radiantShare = n.wantCnt ? (n.radCnt || 0) / n.wantCnt : 0;
      n.radiantLift = M.radiantMultiplier(n.radiantShare);
      /* Both thumbs, in one place, applied to every ranked figure rather than
         to some of them. `perRun` used to escape: the cache penalty and the
         Radiant lift went to `score` and `rate` only, so ranking per run put a
         halved Railjack cache node exactly where it would have sat unhalved.
         The rule the row promises (`STYLE.md §5`) is that the biggest number is
         the one the list is ordered by — so whichever figure that is has to
         carry the adjustment, or the order and the number disagree. */
      n.adj = (n.halved ? 1 - ROT.cachePenalty : 1) * n.radiantLift;
      /* The free relic for staying, once per run, and only where the run
         actually reaches it. `r.mode` is now the answer to "did this node
         choose to stay for it", which only a live fissure makes it do. */
      /* Priced at the tier of the fissure that is here, which is the only tier
         this run can pay. A tier with nothing wanted in it is worth 0 and is
         kept rather than dropped, so the row can say "the free relic is a Neo
         and you want no Neo" instead of quietly showing nothing. */
      n.bonus = bonus && r.mode === "bonus" && (r.rounds || 0) >= ROT.bonusRotations
        && fis ? (bonus.byTier[fis.tier] || null) : null;
      n.runMode = r.mode;         // how the model decided to run it
      // kept as the second number on the row: what a run is worth once the
      // relics are opened, which is a different question from how many arrive
      n.score = (r.total + (n.bonus ? n.bonus.value : 0)) * n.adj;
      n.perRound = r.perRound;
      n.rounds = r.rounds; n.counts = r.counts;
      n.stranded = r.stranded; n.nonStandard = r.nonStandard;
      n.planName = r.planName; n.bounty = r.bounty;
      /* What this run actually hands over: wanted relics on average, and how
         often it hands over any. Since the split this is the ranked quantity
         rather than a footnote - see the block above `render`. The fissure
         bonus is a relic like any other, so it counts here too, at the chance
         a random one of the tier is wanted. */
      n.perRun = (r.count || 0) + (n.bonus ? n.bonus.count : 0);
      n.anyRun = r.any || 0;

      const o = ROT.objectivesOf(n);
      n.objectives = o.count; n.unit = o.unit;
      /* `+ overhead`, once, not per objective: a run is entered and left exactly
         once however far you take it. This is the whole of the fixed-cost fix
         and it is deliberately the only place it is applied. */
      n.minutes = mins ? mins.per(n.mode) * o.count + mins.overhead : null;
      n.minutesAssumed = !!mins && mins.assumed(n.mode);
      /* Costed per reward by default, per minute once anyone says what a reward
         costs them in minutes.

         Per *run* was the old default and it flatters anything long: a run is
         whatever you decide to make it, so it is not a unit at all. Against one
         player's own timings, costing per run is out by up to 9.6x across
         mission types; per reward it is out by 2.4x, because a round, a vault
         and a bounty stage all take somewhere around 2.5 to 6 minutes. Four
         times closer to the truth, and it asks the player for nothing.

         **A reward is a consistent unit, not an equal amount of work**, and the
         2.4x is the size of that gap. A Defense reward is three waves and an
         Excavation reward is one dig; the wiki's cadences run from one to five.
         Charging those sub-units instead was considered and declined on
         2026-08-27 — Survival's criterion is five *minutes* and has no countable
         atom at all, and a wave is not comparable to a dig anyway, so it would
         have been a more elaborate guess rather than a better one. The unit that
         really is comparable is the minute, and that is what the effort weights
         buy. `PROJECT.md §7`. */
      n.cost = n.minutes || o.count;
      /* ── the split ──────────────────────────────────────────────────
         Where to go ranks on **relics per reward** - how fast this node
         fills the stack - and knows nothing about what a relic is worth once
         opened. That is the other list's question, and answering both with one
         number was why "runs to finish" could never be labelled honestly.

         Both thumbs on the scale live in `n.adj` and reach every ranked figure:
         `score`, `rate` and `perRunAdj`. `perRun` itself stays the raw count DE's
         numbers imply and is what the tooltip quotes, so the row's figures are
         adjusted and say so, while the fact underneath them is not. */
      n.rate = (n.perRun / n.cost) * n.adj;
      /* The per-run figure the list can be ordered by, adjusted like every other
         ranked number. `n.perRun` itself stays the raw count DE's tables imply
         and is what the tooltip quotes — the fact underneath is not adjusted. */
      n.perRunAdj = n.perRun * n.adj;
    });

    // Whichever number the reader asked for, then a lower enemy level (faster
    // clears). Rotation used to be a tie-break here; it is priced into the
    // score now, so tie-breaking on it as well would count it twice.
    //
    // The key is read from the option rather than fixed, and `scoreBlock` reads
    // the same one - so the list is always ordered by the number the row shows
    // largest, which is the rule rather than a coincidence (`STYLE.md §5`).
    const rankKey = sortBy().key;
    const ranked = Array.from(nodes.values()).sort((a, b) => {
      if (Math.abs(b[rankKey] - a[rankKey]) > 1e-12) return b[rankKey] - a[rankKey];
      const al = a.lvl ? a.lvl[0] : Infinity, bl = b.lvl ? b.lvl[0] : Infinity;
      if (al !== bl) return al - bl;
      return (a.node || "").localeCompare(b.node || "");
    });

    /* Fold nodes that are the same bet into one row. DE writes one relic table
       per tier and rotation shape, so eight low-level Lith Defense nodes are a
       single choice listed eight times - and the visible eight rows could all
       be that one choice. See `ROT.signature` for what counts as the same.

       Folded after the sort, not before, so the survivor keeps the position the
       group had already earned - every member scores identically, so the group
       has one rank and there is nothing to choose between them on. Which node
       to *name* is a separate question, and `ROT.pickNode` answers it with the
       ranking's own tie-breaks so the fine print agrees with what the list
       would have said anyway. */
    const order = [];
    const groups = new Map();
    ranked.forEach((n) => {
      const key = ROT.signature(n);
      if (groups.has(key)) { groups.get(key).push(n); return; }
      groups.set(key, [n]);
      order.push(key);
    });
    /* Ahead of every other tie-break: if one node in a group of equals happens
       to be a fissure this hour, name that one. The group members are the same
       bet by construction, so this cannot cost anything, and it turns the fold
       from something that hides options into something that picks the best one
       available today. */
    // the same test the scoring above used, so a group cannot be folded onto a
    // node that was costed as a fissure while the fold thinks it is not one.
    // `fissureAt` returns the fissure itself since 2026-09-04, because the free
    // relic is priced at its tier; this only ever wanted the yes/no.
    const isFissureNow = (n) => !!fissureAt(n);

    /* The picked node *becomes* the row rather than being named beside it, so
       everything else on the row - level, planet, demand badges - is that
       node's too. Naming one node and showing another's level was the obvious
       way to build this and would have been quietly wrong. */
    const folded = order.map((key) => {
      const group = groups.get(key);
      const pick = group.length > 1 ? ROT.pickNode(group, isFissureNow) : group[0];
      pick.sameAs = group.length > 1 ? group : null;
      pick.pickedForFissure = !!(pick.sameAs && isFissureNow(pick));
      return pick;
    });

    return { relicPlan, ranked: folded, places: ranked.length,
             needs, formaShort, ayaValue, ayaRelic, ayaTargeting, vaultedOut,
             ayaRotationLive, ayaMissing, perMinute: !!mins,
             blocked: { railjack: blocked.railjack.size, event: blocked.event.size } };
  }

  /* ── tooltip, same as the collection page ─────────────────────
     Monospaced and whitespace-preserving, because native title= is
     proportional and turns aligned columns to mush. */

  /* Rotation rewards cycle A -> A -> B -> C and repeat, so "rotation C" really
     means "stay for the 4th reward". Spelled out because the letters mean
     nothing on their own. */
  /* How far to run each node is worked out per node now, not asked. The row
     says which answer it got - see `runTag` - and this is the rule behind all
     of them, said once under *How this works* rather than on eight hovers. */
  const RUN_BLURB =
    "How far to run each one is decided per node rather than assumed: every way " +
    "of playing it is scored and the best rate wins. Restarting is charged for " +
    "— a run costs its rounds plus about two more for matchmaking, the loading " +
    "screens and the walk to extraction — which is what stops leaving after two " +
    "rounds looking free. In practice that means <b>staying six rounds wherever " +
    "rotation A is what you are there for</b>, and leaving as soon as it drops " +
    "where what you want sits deeper in the cycle. <b>A node carrying a fissure " +
    "right now is run to five rotations instead</b>, for the free Exceptional " +
    "relic that depth pays — chosen rather than compared, because a free relic " +
    "is value the rate cannot see.";
  const ROT_CYCLE = "Rewards cycle: A -> A -> B -> C -> repeat.";
  const ROT_WHEN = {
    A: "Can drop as the 1st or 2nd reward.\n1 round per shot at it.",
    B: "Can drop as the 3rd reward.\n3 rounds per shot at it.",
    C: "Can drop as the 4th reward.\n4 rounds per shot at it.",
  };
  /* What this node pays over the run being costed, and what that run is. The
     interesting part is invisible otherwise: on AABCAA you are also collecting
     the B and C rewards, which is why they count towards the node at all. */
  /* A bounty row says which letter is up and how long it has left, because
     that is the whole decision: the same bounty is worth something different
     in an hour, and no amount of staying in the mission changes it. */
  function bountyTag(n) {
    const b = n.bounty;
    const lines = ["A bounty pays one rotation - the one the board is on now."];
    lines.push("It changes every " + CYCLE_MINUTES + " minutes, A -> B -> C -> A,");
    lines.push("for everyone at once. Staying longer cannot reach another.");
    lines.push("");

    if (b.letter) {
      lines.push("Live now   rot " + b.letter + "   worth " +
        pct(n.rot[b.letter] || 0) + ", for another " + untilText(b.endsAt));
      if ((n.rot.none || 0) > 0) {
        lines.push("Plus       no rotation   worth " + pct(n.rot.none));
      }
      lines.push("Whole run  " + pct(n.score) + "   <- ranked on this");
      if ((n.stranded || []).length) {
        lines.push("");
        (n.stranded || []).forEach((t) => {
          const at = ROT.whenNext(b.letter, b.endsAt, t);
          lines.push("rot " + t + " holds " + pct(n.rot[t]) +
            " you want" + (at ? ", and is up in " + untilText(at) : ""));
        });
      }
    } else if (b.offTable) {
      lines.push("The board is on rot " + b.live + ", which this bounty does not");
      lines.push("publish - DE's table gives it rot " + (n.bounty.published || "?").split("").join(" and rot ") + " only.");
      lines.push("So it is valued at the average of the rotations it does have.");
    } else if (b.unknown) {
      lines.push("Which rotation is live could not be read, so this is the");
      lines.push("average of the ones it pays. Refresh the data to name it.");
    } else {
      lines.push("This bounty has a single reward table, so there is nothing");
      lines.push("to wait for - every run pays the same one.");
      lines.push("Whole run  " + pct(n.score));
    }

    if (n.eventBounty) {
      lines.push("");
      lines.push(eventRunning(n.eventBounty)
        ? n.eventBounty.event + " is running until " +
          String(n.eventBounty.expiry).slice(0, 10) + "."
        : n.eventBounty.event + " is not running, so this bounty is not on the board.");
    }

    const label = b.letter ? "rot " + b.letter
      : b.offTable || b.unknown ? "rot ?" : "one table";
    const tail = b.letter && b.endsAt
      ? ` · <span class="rounds" data-until="${b.endsAt}">${
          esc(untilText(b.endsAt))} left</span>` : "";
    return `<abbr class="rot" data-tip="${esc(lines.join("\n"))}">${esc(label)}</abbr>` + tail;
  }

  /* What a node demands before you can play it — a ship, or other players.
     Said on the row rather than left to be discovered in the mission. */
  function demandTags(n) {
    return ROT.demandsOf(n).map((d) =>
      '<span class="demand" data-tip="' + esc(d.tip) + '">' + esc(d.label) + "</span>"
    ).join("");
  }

  function runTag(n) {
    if (n.bounty) return bountyTag(n);
    /* **Rotations that drop a relic on your list**, not rotations worth
       something. Those differ wherever Aya drops, which is most of the Void:
       Mithra's rotations A and B hold seven Neo relics and Aya, and for a list
       wanting only `Axi P10` the Neo relics are worth nothing while the Aya is
       worth something — so `n.rot` is non-zero for all three and the row said
       `rot A+B+C` when the answer to "where is my relic" is C.

       Aya has its own chip on the same row and its own line in this tooltip, so
       folding it into the letters said it twice and made the louder of the two
       statements the wrong one. `ayaPays` below keeps it visible where a
       rotation has nothing else. */
    const pays = n.counts
      ? Object.keys(n.counts).filter((r) => (n.rotRelic[r] || 0) > 0)
      : [];
    const ayaPays = n.counts
      ? Object.keys(n.counts).filter((r) => (n.rot[r] || 0) > 0
                                            && !((n.rotRelic[r] || 0) > 0))
      : [];
    if (!pays.length && !ayaPays.length && !n.rounds
        && !(n.stranded || []).length) return "no rotation";

    /* Short on purpose. This used to carry the whole Disruption tier table and
       the rotation cycle - twenty-five lines of rules nobody reads on a hover,
       and rules are the same for every row anyway. They live under *How this
       works* at the foot of the page now (`STYLE.md §5`), and what is left here
       is only what is true of THIS node. */
    const lines = [];
    if (n.rounds) {
      /* The cost is read off `objectivesText`, never off `n.rounds`. They were
         not the same number while `PER_REWARD` had an entry in it — Onslaught
         pays one reward per two zones, so a six-reward run was charged twelve.
         `PER_REWARD` is empty since 2026-08-27 and the two now agree everywhere,
         but the indirection stays: `FIXED_LENGTH` still makes them differ for
         Spy, Caches and Faceoff, and "over 6 rounds" on a mission that has no
         rounds was the other half of that defect. */
      lines.push(Object.keys(n.counts)
        .map((r) => "rot " + r + " ×" + n.counts[r]).join(", ") +
        " over " + objectivesText(n) + ".");
    }
    /* Why this many rounds and not some other number. The choice is the
       model's now rather than the reader's, and an automatic decision that
       cannot be questioned is one you have to take on faith - so every row
       says which answer it got and, where it is not obvious, why. */
    if (n.runMode === "bonus") {
      lines.push("Run to five rotations: a fissure is up here, and depth pays " +
                 "a free relic.");
    } else if (n.runMode === "aabcaa") {
      /* Read off the counts rather than assumed. It is usually rotation A that
         staying buys more of, and on Disruption defending all four conduits it
         is rotation C — the row said "four rotation A rewards" there, on a node
         where rotation A is unreachable. */
      const most = Object.keys(n.counts || {})
        .filter((r) => (n.rot[r] || 0) > 0)
        .sort((a, b) => n.counts[b] - n.counts[a])[0];
      lines.push("Worth staying " + objectivesText(n) +
                 (most ? " for rot " + most + " ×" + n.counts[most] : "") +
                 " — one fewer trip in and out than leaving sooner.");
    } else if (n.rounds) {
      lines.push("Worth leaving as soon as it drops; staying only buys " +
                 "rotations you want nothing from.");
    }
    if (n.planName) lines.push("Playing it by " + n.planName + ".");
    (n.stranded || []).forEach((t) => {
      lines.push("rot " + t + " has " + pct(n.rot[t]) + " you want, out of reach here.");
    });
    if (n.nonStandard && (n.stranded || []).indexOf("A") >= 0 && !opts.squad) {
      lines.push("Tick 4-squad to let it try for rotation A.");
    }

    /* The letters name relic rotations and nothing else. Aya-only rotations are
       carried by the `aya` chip's tooltip at the end of the row, which is where
       the row already says the word — see the chip. */
    const label = pays.length ? "rot " + pays.join("+")
      : ayaPays.length ? "aya only"
      : (n.stranded || []).length ? "rot " + n.stranded.join("+") + " only"
      : "no rotation";
    const cls = "rot" + (n.nonStandard ? " rot-odd" : "");
    return `<abbr class="${cls}" data-tip="${esc(lines.join("\n"))}">${esc(label)}</abbr>` +
      (n.rounds ? ` · <span class="rounds">${esc(objectivesText(n))}</span>` : "");
  }

  function rotTag(rot) {
    if (!rot) return "no rotation";
    const k = String(rot).toUpperCase();
    const help = (ROT_WHEN[k] ? ROT_WHEN[k] + "\n\n" : "") + ROT_CYCLE;
    return `<abbr class="rot" data-tip="${esc(help)}">rot ${esc(rot)}</abbr>`;
  }

  const rarityOf = M.rarityOf;

  /* ── rendering ───────────────────────────────────────────────── */
  const pct = (v) => (v * 100).toFixed(2).replace(/\.?0+$/, "") + "%";
  const n2 = (v) => v.toFixed(2).replace(/\.?0+$/, "");

  /* The corner of a row carries the number the list is ranked on, largest, and
     everything derived from it underneath in the faint line - never the other
     way round. Two numbers of equal weight in one corner give the reader no
     clue which of them put the rows in this order.

     Since the two loops were split, the ranked number is the **count**: wanted
     relics per reward. This list answers "where do I go to fill the stack",
     and nothing more - what a relic turns into once opened is the other list's
     question. That is why the percentage moved down a line rather than away:
     they disagree often enough to be worth both. Mithra is worth 63.85% a run
     while dropping 0.83 wanted relics; Taranis drops 1.47 and is worth 51.25%.
     More relics, less progress, because what Taranis hands you is the easy
     part - and which of those you want depends on whether you are short of
     relics or short of the right ones. */
  /* "4 rounds", "3 vaults", "one run" - how a run's cost reads when nobody has
     put a minute figure on it. */
  const objectivesText = ROT.objectivesText;

  /* Two numbers on the row and three lines on the hover.

     It carried four stacked figures and a fifteen-line tooltip, which is more
     than anyone reads standing in front of eight of them. Everything cut from
     here is either still on the row somewhere else - the round count is on the
     meta line, the halving has its own marker - or is a rule that is the same
     for every row and belongs under *How this works*. What is left is what
     differs between one node and the next. */
  function scoreBlock(n) {
    const perMin = n.minutes != null;
    const cost = perMin ? n2(n.minutes) + " min" : objectivesText(n);
    const by = sortBy();

    const lines = [
      n2(n.perRun) + " wanted relics a run, over " + cost + ".",
      pct(n.anyRun) + " of runs drop at least one.",
      "Worth " + pct(n.score) + " towards your list once opened.",
    ];
    /* The row shows adjusted figures; this line is the unadjusted fact, so say
       which thumbs are on it rather than leaving the two to disagree silently. */
    if (n.halved) lines.push("Ranked figures halved — see the row.");
    /* The count above is already discounted, so the tooltip that quotes it has
       to say so — otherwise the row's own arithmetic looks wrong to anyone who
       counts the relics in the chip beside it. */
    if (n.overlap) {
      lines.push(n.overlap.length === 1
        ? "1 relic here pays only what another already does — see the row."
        : n.overlap.length + " relics here pay only what another already does" +
          " — see the row.");
    }
    if (n.radiantLift > 1) {
      lines.push("Ranked figures +" + Math.round((n.radiantLift - 1) * 100) +
                 "%: it hands relics over Radiant and traces are tight.");
    }
    if (perMin && n.minutesAssumed) lines.push("Minutes assumed from the ones you set.");

    /* Both numbers stay on the row and they swap places: the one the list is
       ordered by is the big one, always, and the other goes underneath it. A
       toggle that changed the order without moving them would leave the row
       claiming to be sorted by a number it is not. */
    const big = { value: n[by.key], unit: by.unit(perMin) };
    /* Both figures on the row are adjusted, so swapping the sort swaps their
       places and nothing else. Showing the raw count here while the headline was
       adjusted made the same quantity read as two different numbers depending on
       which way the list happened to be sorted. */
    const alt = by.key === "perRunAdj"
      ? n2(n.rate) + " / " + (perMin ? "min" : "reward")
      : n2(n.perRunAdj) + " a run";

    return `<div class="spot-score" data-tip="${esc(lines.join("\n"))}">
      <b>${n2(big.value)}</b>${esc(big.unit)}
      <span class="spot-alt">${esc(alt)}</span></div>`;
  }

  function renderWishlist() {
    const el = $("#wishlist");
    if (!ST.wishlist.length) {
      /* The search above marks parts collected now, so it can no longer be
         what this points at. Adding a Prime is the collection page's job — on
         every card and in every drawer — and saying which page is kinder than
         saying "add something" and leaving the reader to find out where.

         Named rather than linked, deliberately. An anchor at the collection
         page's own file is a dangling reference in the single-file build, where
         both views live in one document and that file does not exist — the
         bundle check catches it, and catches it in a *comment* too, which is
         how this sentence came to be phrased without the name in it. The tab
         marked COLLECTION is two inches above this text on either build. */
      el.innerHTML = `<p class="hint">Empty. Add Primes from the collection —
        every card has a farm-list button.</p>`;
      return;
    }
    el.innerHTML = ST.wishlist.map((id) => {
      const it = BY_ID.get(id);
      const total = it.parts.length;
      const done = it.parts.filter((p) => haveOf(id, p.name) >= needOf(p)).length;
      const missing = it.parts.filter((p) => haveOf(id, p.name) < needOf(p));
      /* Green edge for "you have it", not for "you have the parts" — that is
         the whole distinction the button below exists to draw, so the styling
         has to wait for the same answer the button does. */
      return `<div class="wish${ST.has(id) ? " wish-done" : ""}">
        <div class="wish-head">
          <span class="wish-name">${esc(it.name)}</span>
          <span class="wish-prog">${done}/${total}</span>
          <button class="wish-del" data-del="${esc(id)}" data-tip="remove from list">✕</button>
        </div>
        <div class="wish-parts">${
          done === total
            ? (ST.has(id)
                ? `<button class="wish-collect on" data-collect="${esc(id)}"
                     data-tip="${esc("Built and claimed.\nClick to take that back — " +
                       "the parts you banked stay where they are.")
                     }">✓ Collected</button>`
                : `<button class="wish-collect" data-collect="${esc(id)}"
                     data-tip="${esc("Every part is banked, which is not the same as " +
                       "owning it:\nthe blueprint still has to be built and claimed.\n\n" +
                       "Say so here and it stops being something you are hunting.")
                     }">Mark as collected</button>`)
            : missing.map((p) => {
                const left = needOf(p) - haveOf(id, p.name);
                return `<button class="wish-part" data-got="${esc(id)}"
                  data-part="${esc(p.name)}" data-tip="Got one — mark it collected">
                  <span class="wp-name">${esc(p.name)}</span>${
                  left > 1 ? `<span class="wp-left">${left} left</span>` : ""
                  }<span class="wp-tick">✓</span></button>`;
              }).join("")
        }</div>
      </div>`;
    }).join("");
  }

  /* "Where to go" with nothing under it is the one place this page can strand
     you outright. The relic list directly beneath goes on saying four relics are
     dropping and every part has "1 relic dropping" against it, so an empty
     heading reads as a fault rather than as an option you have switched off.

     Nyx Prime is the case that exposed it: all four of its parts come from
     relics that exist only on Proxima, so with Railjack off the page finds eight
     perfectly good places, discards every one of them, and says nothing. Name
     the switch and say where it is. */
  function noNodes(blocked, relicPlan) {
    /* Nothing to run because nothing *drops* — every relic still wanted is a
       Prime Resurgence one, bought from Varzia for Aya. Said first because it
       is the common case for a Resurgence Prime and because the fallback below
       would be actively wrong about it: those relics do not drop anywhere, so
       "nowhere you can reach" names a problem the reader does not have and
       hides the answer, which is sitting in the list beside it. */
    const rp = Array.from((relicPlan || new Map()).keys());
    if (rp.length && rp.every((n) => (RELICS[n] || {}).resurgence)) {
      return `<p class="nowhere">Nothing to run — every relic you still need is
        <b>Prime Resurgence</b>. Varzia sells them at Maroo's Bazaar for
        <b>Aya</b>, which is farmed, and <i>How to crack them</i> beside this
        says what to do with them once you have them.</p>`;
    }
    /* The other way to have nothing to run: everything left is vaulted and the
       Prime has no other route, so the relics are trade-only. Same shape of
       answer as above and for the same reason — the fallback below would say
       these relics drop, which is the one thing they do not do. */
    if (rp.length && rp.every((n) => (RELICS[n] || {}).vaulted)) {
      return `<p class="nowhere">Nothing to run — every relic you still need is
        <b>vaulted</b>, and this Prime has no other route. They have to be traded
        for; <i>How to crack them</i> beside this lists which ones, and what to
        refine each to once you have it.</p>`;
    }
    const off = [];
    if (blocked.railjack) {
      off.push([blocked.railjack, "a Railjack mission", "Include Railjack"]);
    }
    if (blocked.event) {
      off.push([blocked.event, "an event node", "Include event nodes"]);
    }
    if (!off.length) {
      return `<p class="nowhere">These relics drop, but nowhere you can reach —
        every source is a quest or something the model cannot rank yet.</p>`;
    }
    /* Short, and loud. It is the only thing on an otherwise empty heading, and
       it is entirely actionable: one checkbox away from a full list. Dimming it
       to match the rest of the page would hide the only thing worth reading. */
    return off.map(([n, what, box]) =>
      `<p class="nowhere"><b>${n} place${n === 1 ? "" : "s"}</b> ${
        n === 1 ? "carries" : "carry"} what you want, ${
        n === 1 ? "and it is" : "all"} ${what}.<br>` +
      `Tick <b>${esc(box)}</b> on the left to rank ${n === 1 ? "it" : "them"}.</p>`
    ).join("");
  }

  /* ── the effort boxes ─────────────────────────────────────────────
     One row per mission type the plan actually ranks, and no others - every
     type in the data would ask for numbers about places this list is not
     sending you. The rows stay in alphabetical order rather than moving to
     match the ranking: they are a form being filled in, and a form whose fields
     rearrange themselves as you type is unusable.

     The unit is named on every row, because "8" means very different things
     against a Defense round and against a whole Capture. */
  function renderEffort(ranked) {
    const box = $("#effortRows");
    if (!box) return;
    /* One mission type can carry two units, because one of our type names
       covers two things: `Bounty` holds both the bounty board, costed in
       stages, and the four Profit-Taker phases, which are one run each. The row
       takes the unit of the node with the MOST objectives, so a single-objective
       outlier cannot relabel a form that is mostly stages and quietly make the
       number typed into it wrong by a factor of four.

       That is a plaster over a wider problem: `Bounty` is our label, not DE's,
       and it is doing two jobs. See *Our four invented "mission types" leak into
       the ranking* in `TODO.md`. */
    const unit = new Map(), most = new Map();
    ranked.forEach((n) => {
      const count = n.objectives || 0;
      if (!unit.has(n.mode) || count > most.get(n.mode)) {
        unit.set(n.mode, n.unit); most.set(n.mode, count);
      }
    });
    const modes = Array.from(unit.keys()).sort();

    box.innerHTML = modes.length
      ? modes.map((m) => `<label class="effort-row${opts.minutes[m] ? " set" : ""}">
          <span class="em-name">${esc(m)}</span>
          <input type="number" min="0" step="0.5" placeholder="—" inputmode="decimal"
                 value="${opts.minutes[m] || ""}" data-mode="${esc(m)}"
                 aria-label="minutes per ${esc(unit.get(m))} of ${esc(m)}" />
          <span class="em-unit">min / ${esc(unit.get(m))}</span>
        </label>`).join("")
      : `<p class="hint">Nothing on your list yet, so there is nothing to weigh.</p>`;

    /* The fixed cost of a run, charged once however far you take it. Rendered
       below the per-type rows and separated from them, because it is a different
       question: those ask what one objective costs, these ask what the run costs
       before and after any of them.

       Two fields rather than one sum, at the owner's direction: they are two
       different waits and a player timing themselves can measure them
       separately. `data-run` rather than `data-mode` so the one change handler
       can tell them apart from a mission type — a mode called "start" would
       otherwise be indistinguishable. */
    const overheadBox = $("#effortRunRows");
    if (overheadBox) {
      overheadBox.innerHTML = !modes.length ? "" : [
        ["runStart", "Getting in", "loading and travel before the objective"],
        ["runEnd", "Getting out", "extraction and the results screen"],
      ].map(([key, label, why]) => `<label class="effort-row${opts[key] ? " set" : ""}">
          <span class="em-name" data-tip="${esc(why)}">${esc(label)}</span>
          <input type="number" min="0" step="0.25" placeholder="—" inputmode="decimal"
                 value="${opts[key] || ""}" data-run="${esc(key)}"
                 aria-label="minutes ${esc(label.toLowerCase())} of a mission" />
          <span class="em-unit">min / run</span>
        </label>`).join("");
    }

    const set = minutesSet();
    const mean = set.length
      ? set.reduce((s, m) => s + opts.minutes[m], 0) / set.length : 0;
    const note = $("#effortState");
    if (note) {
      const over = opts.runStart + opts.runEnd;
      /* The overhead is stated only where it can do something. With no per-type
         minutes the list is costed in reward count, and 35 seconds has no
         meaning in rewards — so a number typed there is being kept, not used,
         and saying so is the difference between a control that waits and one
         that is broken. */
      const overNote = over > 0
        ? ` Every run also costs <b>${n2(over)} min</b> in getting in and out, ` +
          `charged once however far you take it.`
        : "";
      note.innerHTML = !modes.length ? ""
        : set.length
          ? `<b>${set.length} set.</b> Every other type is costed at their average, ` +
            `${n2(mean)} min — shown in amber on the row, so a borrowed number is ` +
            `never mistaken for one of yours.` + overNote
          : `Nothing set, so every mission is costed by its <b>reward count</b> ` +
            `— four rounds, three vaults, one run. That is the default and it works. ` +
            `Fill in a single type and the whole list re-sorts on real minutes.` +
            (over > 0
              ? ` Getting in and out is saved and waits for them: a flat ${n2(over)} min ` +
                `cannot be charged against a reward count.`
              : "");
    }
    const clear = $("#effortClear");
    if (clear) clear.hidden = !set.length && !(opts.runStart + opts.runEnd);
  }

  /* ── How to crack them, and the two controls above it ─────────────
     The ranked pairs as `render` last computed them, before any narrowing.
     Held here so the list can be repainted without rebuilding the strip the
     reader is standing in — see `paintRelicList`. */
  let relicRows = [];
  /* How many wanted relics the vault filter kept out, so the list can say it is
     filtered rather than look complete. Held beside `relicRows` and set in the
     same place, for the same reason: `paintRelicList` runs on its own when a
     control is pressed and must not have to rebuild the plan to find out. */
  let relicsVaulted = 0;
  const tierOf = (rname) => String(rname).split(" ")[0];
  const isVarzia = (rname) => !!(RELICS[rname] || {}).resurgence;
  /* On Baro's manifest when the build ran, **and** he is still on the relay.
     Both halves, always: the first alone would keep selling his relic for the
     twelve days a fortnight he is gone. */
  const isBaro = (rname) => !!(RELICS[rname] || {}).baro && baroIsHere();
  /* Vaulted, with no errand of its own — here only because the Prime has no
     route at all, the `stranded` case. Same test the row badge uses.

     Baro is excluded for the same reason Varzia is: a relic you can go and buy
     today is not one you have to be traded. The moment he leaves it becomes a
     trade row again on its own, with no build in between, because `isBaro`
     goes false on the page's clock. */
  const isTrade = (rname) => {
    const rec = RELICS[rname] || {};
    return !!rec.vaulted && !rec.resurgence && !isBaro(rname);
  };

  /* What each control should say, with one rule: **a facet's count ignores its
     own control and obeys every other one.**

     The first version counted everything over the whole list and never moved,
     on the reasoning that a tab reading `Lith 4` must mean four Lith relics
     exist rather than four surviving the tab already pressed. That half is
     right and is why `relicTier` is excluded from the tier counts. The other
     half was wrong, and the owner caught it: Varzia and Trade are a *different*
     dimension, so unticking `Trade 717` really does leave fewer Lith relics,
     and a tab still claiming 195 of them is telling the reader something the
     list beside it plainly contradicts.

     `dataTier` is separate and does not move: it decides which tabs **exist**,
     which is a fact about the farm list rather than about the checkboxes. So an
     errand click changes the numbers on the tabs and never the tabs themselves
     — nothing appears or disappears under the reader's cursor, and a tier
     emptied by a checkbox reads `0` rather than vanishing. */
  function relicCounts() {
    const dataTier = {}, tierCount = {};
    let varziaCount = 0, tradeCount = 0, baroCount = 0, allCount = 0;
    let dataVarzia = 0, dataTrade = 0, dataBaro = 0;
    relicRows.forEach(([rname]) => {
      const t = tierOf(rname);
      dataTier[t] = (dataTier[t] || 0) + 1;
      if (isVarzia(rname)) dataVarzia += 1;
      if (isTrade(rname)) dataTrade += 1;
      if (isBaro(rname)) dataBaro += 1;
      const errandOk = (showVarzia || !isVarzia(rname)) &&
                       (showTrade || !isTrade(rname)) &&
                       (showBaro || !isBaro(rname));
      const tierOk = !relicTier || t === relicTier;
      if (errandOk) { tierCount[t] = (tierCount[t] || 0) + 1; allCount += 1; }
      /* Varzia, Baro and Trade are mutually exclusive categories, so no box
         moves another's count — but each still has to obey the tier. */
      if (tierOk && isVarzia(rname)) varziaCount += 1;
      if (tierOk && isTrade(rname)) tradeCount += 1;
      if (tierOk && isBaro(rname)) baroCount += 1;
    });
    /* `data*` decides what **exists**, the rest decide what the numbers say.
       Keeping them apart is what stops a control disappearing because of
       another control: selecting a tier with none of Varzia's relics in it
       shows `Varzia 0`, it does not take her box away. */
    return { dataTier, dataVarzia, dataTrade, dataBaro,
             tierCount, varziaCount, tradeCount, baroCount, allCount };
  }

  /* The numbers only, moved in place. Called when a control is pressed, where
     rebuilding the strip would destroy the control being pressed and drop the
     focus to `<body>` — `STYLE.md §6` again, and the same reason the strip and
     the list are painted separately. */
  function refreshRelicCounts() {
    const { tierCount, varziaCount, tradeCount, baroCount, allCount } = relicCounts();
    $$("#relicTiers .tier-tab").forEach((b) => {
      const t = b.dataset.tier;
      const n = t ? (tierCount[t] || 0) : allCount;
      const slot = b.querySelector(".n");
      if (slot) slot.textContent = String(n);
      /* A tier the checkboxes have emptied cannot be usefully pressed. Disabled
         rather than removed: it is a transient consequence of another control,
         not a fact about the data, and a tab that vanished mid-click would move
         the ones beside it.

         **Never the tab that is currently pressed**, however empty it has
         become — disabling that one would leave the reader looking at an empty
         list with the only control that explains it greyed out, and no way back
         except a tab they have to work out is the way back. */
      b.disabled = !!t && n === 0 && relicTier !== t;
    });
    const set = (id, n) => {
      const slot = $("#relicErrands #" + id);
      const lbl = slot && slot.closest(".mini-check").querySelector(".lbl .n");
      if (lbl) lbl.textContent = String(n);
    };
    set("p-varzia", varziaCount);
    set("p-trade", tradeCount);
    set("p-baro", baroCount);
  }

  /* The strip of controls on the heading's line. Rebuilt only when the plan
     itself changes, never when a tab is pressed: `innerHTML` here would destroy
     the button that was just clicked and drop the focus to `<body>`, which is
     `STYLE.md §6`'s "a control must not rebuild the container it lives in". */
  function paintRelicFilters() {
    /* Two containers since 2026-09-01, at the owner's direction: the tier tabs
       sit to the LEFT of the heading and the errand checkboxes stay at the far
       right, so the heading reads between them. One element could not do that —
       CSS can order flex children but cannot split one container's contents
       across a sibling. */
    const tierBar = $("#relicTiers");
    const errandBar = $("#relicErrands");
    if (!tierBar || !errandBar) return;
    const counts = relicCounts();
    const { dataTier } = counts;
    /* A tier that was selected and then emptied — the last Lith Prime came off
       the farm list — would leave an empty panel and no way to read why. The
       selection falls back to every tier rather than leaving the reader to
       discover that the tab they pressed is now a dead end.

       Against `dataTier`, not the filtered count: a tier emptied by the Trade
       checkbox has not gone anywhere, and silently un-selecting it would undo a
       choice the reader made with a different control. */
    if (relicTier && !dataTier[relicTier]) relicTier = null;

    /* **Only tiers with something in them get a tab**, per `STYLE.md §6` —
       "only offer a control for something in front of you", the same rule that
       keeps the effort panel to the mission types actually ranked. Fixed
       Lith→Meso→Neo→Axi order rather than sorted by count, because §6 also
       forbids a control that rearranges itself under the reader.

       One tier means no tabs at all: `All` and `Lith` side by side, both
       selecting the same rows, is a control with nothing to control. */
    const tabs = TIERS.filter((t) => dataTier[t]).map((t) =>
      `<button type="button" class="tier-tab" data-tier="${t}"` +
      ` aria-pressed="${relicTier === t ? "true" : "false"}">${t}` +
      `<span class="n">${counts.tierCount[t] || 0}</span></button>`);

    /* Varzia is a checkbox where the tiers are tabs, and that is deliberate:
       `STYLE.md §6` gives a checkbox to *include this* and another shape to
       *which of these*. Her relics are an errand you either want on the list or
       do not; a tier is a choice between four. One control shape per kind of
       question.

       Shown only when she has something here — six relics at most, and none at
       all whenever the farm list wants nothing from her rotation.

       **Baro Ki'Teer is the third one, since 2026-09-04.** He was deliberately
       absent until then, and the reason is worth keeping: `flags.baro` sits on
       nine *items* and means "he sometimes sells this Prime", so a control
       built on it would have answered a visibly different question from
       Varzia's in the same shape. What changed is that his actual shelf can now
       be read — `VoidTraders[0].Manifest` names it outright while he is on a
       relay — so `relics[n].baro` is his real stock and not a guess.

       His box differs from hers in one way, and it is the whole of the owner's
       decision: it appears only while he is here. Not disabled, not showing
       zero — absent, exactly as it was before he arrived. `dataBaro` is `0`
       twelve days in fourteen because `isBaro` consults the page's clock, so
       the strip goes back to two controls on its own with no build in
       between. */
    tierBar.innerHTML = (tabs.length > 1
      ? `<button type="button" class="tier-tab" data-tier=""` +
        ` aria-pressed="${relicTier ? "false" : "true"}">All` +
        `<span class="n">${counts.allCount}</span></button>` + tabs.join("")
      : "");

    errandBar.innerHTML =
      (counts.dataVarzia
        ? `<label class="mini-check" data-tip="${esc(
            "Varzia sells these for Aya at Maroo's Bazaar — they do not drop, so\n" +
            "they have nowhere to send you under Where to go.\n\n" +
            "Untick to see only what you can farm this evening.")}">` +
          `<input type="checkbox" id="p-varzia"${showVarzia ? ' checked="checked"' : ""} />` +
          `<span class="box"></span><span class="lbl">Varzia` +
          `<span class="n">${counts.varziaCount}</span></span></label>`
        : "") +
      /* Baro sits between Varzia and Trade because that is the order of how
         hard the errand is: her shelf is up for a month, his for two days, and
         a trade needs another player. */
      (counts.dataBaro
        ? `<label class="mini-check" data-tip="${esc(
            "Baro Ki'Teer is on a relay now and sells these for Ducats and\n" +
            "credits. They do not drop, so they have nowhere to send you\n" +
            "under Where to go.\n\n" +
            "He leaves in two days and this control goes with him.")}">` +
          `<input type="checkbox" id="p-baro"${showBaro ? ' checked="checked"' : ""} />` +
          `<span class="box"></span><span class="lbl">Baro` +
          `<span class="n">${counts.baroCount}</span></span></label>`
        : "") +
      /* The one that actually shortens the list, which was not obvious until it
         was measured: with every Prime on the farm list the crack list holds
         **34 farmable, 6 of Varzia's and 717 trade-only**. The trade rows are
         there on purpose — a Prime with no way in still has a real answer — but
         they are an answer to a different question from "what do I crack
         tonight", and burying the 34 under 717 of them serves neither. */
      (counts.dataTrade
        ? `<label class="mini-check" data-tip="${esc(
            "Relics for Primes with no way in at all — vaulted, not on Varzia's\n" +
            "shelf, no Baro or quest route. Another player has to trade you one,\n" +
            "and the refinement beside each is what to take it to.\n\n" +
            "Untick to leave only what you can go and get.")}">` +
          `<input type="checkbox" id="p-trade"${showTrade ? ' checked="checked"' : ""} />` +
          `<span class="box"></span><span class="lbl">Trade` +
          `<span class="n">${counts.tradeCount}</span></span></label>`
        : "");
  }

  /* One row of the crack list. Module level rather than inline in the map so
     the list can be repainted from the filter handlers without `render()`. */
  function relicRowHtml([rname, p]) {
    // background = the action (which refinement); chips = each part's rarity
    // Rarest first, so position carries "this is the hard one" — no marker
    // needed. A highlight had to pick a winner even when two parts were
    // equally scarce, and that choice was arbitrary.
    const RAR_ORDER = { Rare: 0, Uncommon: 1, Common: 2 };
    /* `qty` is how many of that part you STILL need, not how many the recipe
       asks for. The two differ the moment you bank one of a pair, and it is
       the still-needed figure the rest of the row is already built on — the
       openings number beside it prices exactly this many. Showing the recipe
       figure instead would put "×2" next to the cost of fetching one. The
       *Still needed* panel below uses the same rule and the same `×N`. */
    const parts = p.entries
      .filter((e) => !e.bonus)
      .map((e) => ({ label: e.label, rar: rarityOf(e.chances),
                     qty: e.stillNeed || 1 }))
      .sort((a, b) => (RAR_ORDER[a.rar] ?? 9) - (RAR_ORDER[b.rar] ?? 9) ||
                      a.label.localeCompare(b.label));
    /* Where the relic itself comes from, said only when it is not the usual
       answer. A Resurgence relic does not drop anywhere — Varzia sells it for
       Aya — so without this the row looks like every other and sends the
       reader to *Where to go*, which is correctly silent about it. Aya is
       farmed, so this is a route rather than a purchase; Regal Aya packs are
       a real-money product and are no part of this. */
    const rec = RELICS[rname] || {};
    const varzia = rec.resurgence
      /* This is her actual shelf now, not every relic that holds a part of a
         Prime she is offering. It said "from Varzia" over the second list
         until 2026-08-27 — 88 relics against the six she was really selling —
         so the badge is worth stating plainly again only because the build
         reads the shelf off DE's own relic naming. See `build_varzia_relics`
         in `tools/build_data.py`, and `PROJECT.md` for why the obvious place
         to look does not have it. */
      ? `<span class="from-varzia" data-tip="${esc(
          "Prime Resurgence. This relic does not drop — buy it from Varzia at " +
          "Maroo's Bazaar for Aya, which is farmed.\n" +
          "That is why nowhere is listed under Where to go.\n\n" +
          "This is the rotation she is selling now, so the list changes when " +
          "the rotation does.")}">from Varzia</span>`
      : isBaro(rname)
        /* Deliberately checked before `vaulted`, because his relic is vaulted
           and would otherwise read "trade for it" while he is standing on a
           relay selling it. The moment he leaves, `isBaro` goes false and this
           row becomes a trade row again with no rebuild in between — which is
           the owner's decision of 2026-09-04 expressed in one branch. */
        ? `<span class="from-baro" data-tip="${esc(
            "Baro Ki'Teer is on a relay now and sells this relic for Ducats " +
            "and credits, both farmed.\nThat is why nowhere is listed under " +
            "Where to go.\n\n" +
            "He leaves after two days and takes it with him — this badge and " +
            "the Baro control both go when he does.")}">from Baro</span>`
      : rec.vaulted
        /* Only ever reached for a Prime with no way in at all — see
           `stranded`. The refinement beside it is the point of showing the
           row: it is the one thing here you can still decide, and it is the
           same advice it would carry if the relic were dropping. */
        ? `<span class="from-trade" data-tip="${esc(
            "Vaulted, and this Prime has no other route — no drop, no Baro, " +
            "no quest.\nSo this relic has to be traded for, and the refinement " +
            "beside it is what to take it to once you have one.")}">trade for it</span>`
        : "";
    return `<div class="relic-row ref-row-${esc(p.refinement)}">
      <span class="relic-name">${esc(rname)}${varzia}</span>
      <span class="advice ${p.refinement === "Intact" ? "intact" : "radiant"}"
            data-tip="${esc(
              "Take it to " + p.refinement + ", chosen to clear the scarcest\n" +
              "thing you want fastest — not for the best hit rate.")}"
        >${esc(p.refinement)}</span>
      <span class="chances" data-tip="${esc(
        isFinite(p.openings)
          ? p.openings.toFixed(1) + " openings to clear all " + p.clears +
            " thing" + (p.clears === 1 ? "" : "s") + " you want from it.\n" +
            pct(p.value) + " of openings pay out something wanted."
          : "Nothing wanted here can drop at any refinement.\nSorted last.")
        }"><b>${
        isFinite(p.perPart) ? p.perPart.toFixed(1) : "∞"
      }</b><span class="chances-alt">${
        isFinite(p.openings) ? p.openings.toFixed(1) + " openings · " + p.clears +
          (p.clears === 1 ? " part" : " parts") : "never finishes"
      }</span></span>
    </div>
    <div class="relic-parts">${
      parts.map((x) => `<span class="part-chip ${esc(x.rar)}">${esc(x.label)}${
        x.qty > 1 ? `<span class="qty">×${x.qty}</span>` : ""
      }</span>`).join("")
    }</div>`;
  }

  function paintRelicList() {
    const rp = relicRows.filter(([rname]) =>
      (!relicTier || tierOf(rname) === relicTier) &&
      (showVarzia || !isVarzia(rname)) &&
      (showTrade || !isTrade(rname)) &&
      (showBaro || !isBaro(rname)));
    /* Appended to whatever the list says, empty or not, because the fact it
       reports is true either way: there are relics you need that this list is
       not showing. Worded as what it is rather than as an apology — the reader
       is not being told something is broken, they are being told the list is
       narrower than their collection. */
    /* Not when `relicRows` is empty: that case already prints "none of the
       relics you need can be got right now — they are vaulted", and following
       it with a count of how many are vaulted says the same thing twice in
       different words. The note is a qualifier on a list, so it needs a list. */
    const vaultNote = relicsVaulted && relicRows.length
      ? `<p class="hint">${relicsVaulted} more relic${relicsVaulted === 1 ? "" : "s"}
         ${relicsVaulted === 1 ? "is" : "are"} vaulted and not shown — if you are
         holding any, they are worth cracking too.</p>`
      : "";
    $("#planRelics").innerHTML = (rp.length ? rp.map(relicRowHtml).join("")
      /* Two different silences, and saying the wrong one is worse than saying
         nothing. "Nothing can be got right now" is a fact about the vault; an
         empty list because the reader unticked Varzia is a fact about the
         control they just pressed, and telling them the vault is empty would
         send them looking for a problem that is not there. */
      : relicRows.length
        ? `<p class="hint">Nothing here matches what you have narrowed to —
           ${relicRows.length} relic${relicRows.length === 1 ? "" : "s"} ${
           relicRows.length === 1 ? "is" : "are"} hidden by the controls
           above.</p>`
        : `<p class="hint">None of the relics you need can be got right now —
           they are vaulted, and not in this Prime Resurgence rotation either.</p>`)
      + vaultNote;
  }

  function render() {
    renderWishlist();
    const { relicPlan, ranked, needs, formaShort, ayaValue, ayaRelic, ayaTargeting, vaultedOut,
            ayaRotationLive, ayaMissing, perMinute, blocked, places } = buildPlan();
    renderEffort(ranked);

    $("#formaShort").textContent = formaShort > 0 ? `short ${formaShort}` : "";
    $("#formaShort").classList.toggle("on", formaShort > 0);

    const hasWork = needs.length > 0;
    $("#planEmpty").hidden = hasWork;
    $("#planWrap").hidden = !hasWork;
    if (!hasWork) return;

    /* `STYLE.md §5` asks that a list which ranks on something says so in its
       heading, and *Where to go* did — a `#planRankedOn` span that followed the
       sort toggle and the switch to minutes that effort weights make.

       **Removed 2026-09-01 at the owner's request, and only because the control
       beside it already says the same words.** The `<select>` sits on that
       heading line with no label of its own, and its options are rewritten
       below to read "per reward", "per minute" or "per run" — so the quantity is
       still named, by the thing that sets it. The rule is satisfied by the
       control rather than by a second copy of it. *How to crack them* keeps its
       sub-heading, shortened, because it has no such control.

       Rewritten rather than rebuilt, so the open state of a dropdown someone is
       using is not lost. */
    const sel = $("#p-sort");
    if (sel) {
      Object.keys(SORTS).forEach((k) => {
        const opt = sel.querySelector('option[value="' + k + '"]');
        if (opt) opt.textContent = SORTS[k].option(perMinute);
      });
    }

    const openRelics = relicPlan.size;
    $("#planSummary").innerHTML =
      `<b>${needs.length}</b> thing${needs.length === 1 ? "" : "s"} still needed · ` +
      `<b>${openRelics}</b> relic${openRelics === 1 ? "" : "s"} can supply them · ` +
      `<b>${places}</b> place${places === 1 ? "" : "s"} to run` +
      (places > ranked.length
        ? ` · <b>${ranked.length}</b> genuinely different`
        : "");

    $("#planScoreNote").innerHTML =
      `<b>These are two lists, not one.</b> <i>Where to go</i> ranks on how many ` +
      `relics you want a run hands over; <i>How to crack them</i> ranks on how many ` +
      `openings it takes to finish one. Collecting relics and cracking them are ` +
      `different activities with different bottlenecks, and a single score covering ` +
      `both answered neither — which is why "about N runs to finish" could never be ` +
      `given an honest label. Neither list knows anything about the other's question.` +
      `<br><br>` +
      `The percentage under each node is what <b>one whole run</b> there is worth towards your ` +
      `list${opts.squad ? ", assuming a 4-squad cracking the same relic" : ""}` +
      (perMinute
        ? `, divided by the minutes you said it costs — so the ranking is per ` +
          `minute, and a long run has to earn its length.`
        : `, divided by the <b>objectives</b> it takes — a round, a vault, a cache ` +
          `or a bounty stage. A run is whatever you decide to make it, so it is not ` +
          `a unit; an objective is, and it takes 2.5–6 minutes almost everywhere. ` +
          `Fill in <b>Effort</b> in the sidebar to rank on real minutes instead.`) +
      ` It is shown because the two disagree often: a node can hand over more relics ` +
      `and be worth less, when what it hands over is the easy part. The ranking follows ` +
      `the count; the percentage is there so you can see when it dissents. ` +
      `Hover the rotations for the per-round rate. ` +
      `Rotation is priced in: the published chance assumes that rotation has come ` +
      `up, so it is not comparable across rotations on its own. ${RUN_BLURB} ` +
      `Relics are listed best-first within each node. ` +
      `Ties are broken by lower enemy level.` +
      (formaShort > 0 ? " A Forma shortfall raises the value of relics you were already " +
        "running, but never adds one." : "") +
      (ayaValue > 0 ? " Aya counts too: you are still missing " + ayaMissing +
        " vaulted part" + (ayaMissing === 1 ? "" : "s") + ", so it is worth " +
        "banking. Valued at <b>" + esc(ayaRelic) + "</b>, " + pct(ayaValue) +
        (ayaTargeting
          ? " — in full, because a Prime on your farm list is in Prime Resurgence"
            + " right now, so an Aya is a relic you want."
          : " — at " + Math.round(M.AYA_BANKED_SHARE * 100) + "%, because nothing"
            + " on your farm list is in Resurgence. It is banked against the"
            + " vault rather than spent on tonight's target.") +
        (ayaRotationLive ? " Priced on the best relic Varzia is selling this rotation."
                         : " No rotation is running, so this is the best a future one could offer.") +
        " It only ever raises nodes already worth running." : "") +
      (ranked.some((n) => n.bounty)
        ? " Bounties are the exception to all of that: one rotation is live for " +
          "everyone at a time and it changes every " + CYCLE_MINUTES +
          " minutes, so a bounty is scored on the letter that is up <b>now</b> " +
          "and the row says how long that has left."
        : "") +
      /* The marker on the row says a short thing; the rule behind it is read
         once here, which is the arrangement every other marker follows. */
      (ranked.some((n) => n.overlap)
        ? " Two relics at one node can pay only the same parts of your list. " +
          "The weaker one is then counted at <b>" +
          Math.round(M.REDUNDANCY_WEIGHT * 100) + "%</b> rather than in full — " +
          "one draw is one relic, so it is still the copy you get when the better " +
          "one misses, but it is not more progress. Those rows say <em>overlap</em> " +
          "and name the relic."
        : "") +
      (opts.event ? " Event nodes are included — check the event is actually running." : "") +
      (openRelics === 0 ? " Nothing you want is currently dropping." : "");

    /* ── eight, and a way out of eight ────────────────────────────────
       Eight is the right default and stays: `STYLE.md §5` is emphatic that a
       long list condenses to a count, and the whole point of a ranking is that
       the top of it is the answer.

       What was missing was the way *out*. The rest lived in a tooltip — twenty
       of them, as plain text, in a control that exists to hold a sentence and
       cannot be scrolled or searched — and past twenty-eight there was no way to
       see a place at all. That is how three separate things went missing: Spy
       nodes reach no top eight on any item, and neither do the eleven that hand
       relics over Radiant, so both were correct and unobservable.

       Expanding in place keeps one list and one ranking and needs no new page.
       The count stays on the control, so the condensed default still says how
       much is behind it. */
    const SHOW = 8;
    const showingAll = expandNodes && ranked.length > SHOW;
    const visible = showingAll ? ranked : ranked.slice(0, SHOW);
    if (!ranked.length) $("#planNodes").innerHTML = noNodes(blocked, relicPlan);
    else $("#planNodes").innerHTML = visible.map((n) => {
      // most useful relic first: how much of this node's score each one accounts
      // for, i.e. the chance it drops here times what one opening is worth
      const rl = Array.from(n.relics.entries())
        .map(([name, v]) => [name, (v.chance / 100) * (relicPlan.get(name) || {}).value || 0])
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => name);
      const more = ranked.length > SHOW;
      return `<div class="spot">
        <div class="spot-where">${esc(n.node)}
          <span class="spot-mode${n.nonStandard ? " odd" : ""}">(${esc(n.mode)})</span>
          <span class="src-planet">— ${esc(n.planet)}</span>${
          n.sameAs ? `<span class="same" data-tip="${esc(
            n.sameAs.length + " nodes are this same bet — same relics, same rates.\n" +
            "Shown: " + n.node +
            (n.pickedForFissure ? ", the one that is a fissure right now."
              : n.aya ? ", which also drops Aya."
                : ", the lowest level of them.") + "\n\n" +
            n.sameAs.map((x) => "  " + x.node + " (" + x.planet + ")" +
              (x.lvl ? "  lvl " + x.lvl[0] + "–" + x.lvl[1] : "")).join("\n"))
          }">+${n.sameAs.length - 1} same</span>` : ""}
          ${demandTags(n)}
          ${n.event ? `<span class="tag">event</span>` : ""}
          <span class="fissure-slot" data-node="${esc(nodeKey(n))}"></span></div>
        <div class="spot-meta">${runTag(n)}${
          n.lvl ? ` · level ${n.lvl[0]}–${n.lvl[1]}` : " · level unknown"} · ${
          `<span class="relic-count" data-tip="${esc("Relics you want from here, best first:" + "\n" +
            rl.map((r) => "  " + r).join("\n"))}">${rl.length} relic${
            rl.length === 1 ? "" : "s"}</span>`}${
          /* One line each. These markers exist to say a short thing - the
             reasoning behind each lives under *How this works*, where it can be
             read once instead of hovered eight times. */
          /* Only on nodes that are a fissure right now, since 2026-08-24 —
             which is why it no longer says "if". It used to be added to every
             endless node flat, on the argument that a node-independent constant
             cannot reorder them; now the run itself is chosen for the fissure,
             so the relic is real and belongs to this row alone. */
          n.bonus ? ` · <span class="est" data-tip="${esc(
            "Staying five rotations in a " + n.bonus.tier + " fissure pays a free "
            + "Exceptional\n" + n.bonus.tier + " relic — worth " + pct(n.bonus.value)
            + " here, averaged over the " + n.bonus.pool + "\nlive " + n.bonus.tier
            + " relics, of which " + n.bonus.want + " are on your list."
            + (n.bonus.want
               ? (n.bonus.refined
                   ? "\n\nCounted at " + Math.round((1 + M.FISSURE_REFINED_BONUS) * 100)
                     + "%: the relic, and half again for arriving\nExceptional rather "
                     + "than Intact — 25 Void Traces you do not spend,\nwhich counts "
                     + "because you said traces are tight."
                   : "")
                 + "\n\nThis run is five rotations because of that: the free relic "
                 + "is worth\nmore than the sixth round would have been."
               : "\n\nNone of them is, so this one is worth nothing to you — the "
                 + "tier is\nthe fissure's, not yours to choose."))
          /* Always "+free <tier>", one colour, no adornment. Owner's call,
             2026-09-04, after two versions that said too much: ", unwanted" in
             the row, then a dim variant for the same thing. The tier name and
             the ranking carry it — a free relic of a tier you want nothing from
             is worth 0 and the row falls accordingly. The tooltip has the rest
             for anyone who hovers. */
          }">+free ${esc(n.bonus.tier)}</span>` : ""}${
          n.preRefined ? ` · <span class="${n.overshot ? "est" : "pre"}" data-tip="${esc(
            "Hands its relics over already Radiant" +
            (n.tracesSaved ? ", saving " + n.tracesSaved + " Void Traces a relic" : "") +
            ".\n" +
            (n.overshot
              ? "Scored lower: this plan wanted them less refined."
              : "This plan wanted Radiant anyway.") + "\n" +
            (!opts.capped
              ? "Scored " + Math.round(M.RADIANT_BONUS * 100) +
                "% higher for it — it saves you the refinement."
              : "No bonus: you said you are at the Void Trace cap."))
          }">${n.overshot ? "pre-refined" : "radiant"}</span>` : ""}${
          n.halved ? ` · <span class="est" data-tip="${esc(
            "Scored at half on purpose — nobody runs Railjack for caches.\n" +
            "The relic count is untouched.")
          }">halved</span>` : ""}${
          /* Amber, like the rest of `.est`: the app scored this node lower than
             its relic count implies, and a discount the reader cannot see is
             the shape of defect this project keeps having to fix. Names the
             relic and what covers it, because "overlaps" on its own is a
             verdict with no evidence in it. */
          n.overlap ? ` · <span class="est" data-tip="${esc(
            n.overlap.map((o) => o.name + " pays nothing " +
              o.coveredBy.join(" or ") + " does not.").join("\n") + "\n\n" +
            /* Number-neutral on purpose: the list above it runs from one relic
               to several, and "both" read as a mistake the moment it was
               three. */
            "Counted at " + Math.round(M.REDUNDANCY_WEIGHT * 100) + "% here, " +
            "not dropped.\n\n" +
            "One reward draw is one relic, so a covered relic is still\n" +
            "the copy you get on the draws the better one misses.\n" +
            "What it is not is more progress — every part it clears\n" +
            "is already covered by something else here.")
          }">${n.overlap.length} overlap${n.overlap.length === 1 ? "" : "s"}</span>` : ""}${
          /* Shown despite *Include Railjack* being off, because for this relic
             there is nowhere else. Amber for the same reason `.est` is amber:
             the app made a call the reader did not. */
          n.onlyRoute ? ` · <span class="est" data-tip="${esc(
            "Listed even though Include Railjack is off: every current source for\n" +
            "what you want here is a Railjack mission, so leaving it out would\n" +
            "leave you nowhere at all.\n\n" +
            "Tick Include Railjack on the left to see the rest of them too.")
          }">only route</span>` : ""}${
          /* A borrowed number stays visible even after the corner was cut back:
             a guess you can see beats a guess you cannot. */
          n.minutesAssumed ? ` · <span class="est" data-tip="${esc(
            "No minutes set for " + n.mode + ", so its reward is costed at the\n" +
            "average of the types you did set." +
            /* Said only when there is one. The figure on the chip is the whole
               cost of the run, and once an overhead exists that is no longer
               all of it "costed at the average" - a sentence that explains a
               number has to explain the number actually shown. */
            (opts.runStart + opts.runEnd > 0
              ? "\nGetting in and out adds " + n2(opts.runStart + opts.runEnd) +
                " min on top, once."
              : ""))
          }">est. ${n2(n.minutes)} min</span>` : ""}${
          n.aya ? ` · <span class="aya" data-tip="${esc(
            "Drops Aya at " + pct(n.aya / 100) + " a reward, counted as " +
            pct(ayaValue) + ".\nOne Aya buys any relic Varzia is selling."
            /* The rotations that pay Aya and no relic you want live here rather
               than in the `rot` letters. They were spliced into the letters when
               this was first fixed, which was the original defect wearing a
               different hat: the row already says `aya`, so the letters were
               saying it twice. Owner's call, 2026-09-04. */
            + ((n.ayaRots || []).length
                ? "\n\nAt this node rot " + n.ayaRots.join("+") + " pay"
                  + (n.ayaRots.length > 1 ? "" : "s") + " Aya and no relic on"
                  + "\nyour list — the aya is what makes "
                  + (n.ayaRots.length > 1 ? "those rotations" : "that rotation")
                  + " worth anything here."
                : ""))
          }">aya</span>` : ""}</div>
        ${scoreBlock(n)}
      </div>`;
    }).join("") + (ranked.length > SHOW
      ? `<button type="button" class="more-nodes" id="moreNodes" aria-expanded="${
          showingAll ? "true" : "false"}">${
          showingAll
            ? `Show the top ${SHOW} only`
            : `Show all ${ranked.length} places`}</button>`
      : "");

    /* ── the other half of the split ──────────────────────────────────
       This list ranks on **openings needed** - how many times you have to crack
       this relic before everything you want out of it has come - and knows
       nothing about where it drops. That is the left-hand list's question.

       It used to sort on hit rate, which answered neither: a relic you are one
       common away from finishing sat above one holding a rare you are blocked
       on, because the common is likelier. Openings put the blocked one first,
       which is what "what should I crack this weekend" actually means.

       Ranked per *part cleared*, not per relic. Cracking happens in bulk, so
       the question is which relic gets the most off your list per opening - and
       a relic holding three wanted parts is worth more than one holding a
       single easy one even though it takes longer to exhaust.

       Infinite sorts last rather than first: a relic whose wanted reward has no
       chance at any refinement is not urgent, it is impossible.

       **A relic you cannot farm sorts below every relic you can**, whatever the
       arithmetic says — owner's call, 2026-08-27. A Varzia relic costs Aya and a
       trip to Maroo's; a dropping one costs a mission you were going to run
       anyway. Ranking them together let a Resurgence relic with a good ratio sit
       above relics the reader could go and get this evening, which reads as
       advice to go shopping. The ratio still orders each group internally, so
       nothing is lost — the two are simply not the same kind of errand, and a
       single ranked list was quietly claiming they were.

       Trade-only relics — the fully-vaulted case, `stranded` — sit in the same
       bucket for the same reason and are further from farmable still: those need
       another player. */
    /* 0 farmable, 1 Varzia, 1 Baro, 2 trade-only. Keyed off the relic name,
       which is the entry's own key — the plan object does not carry it.

       Baro shares Varzia's rank rather than getting one of his own: both are
       "go and buy it with something you farmed", which is the distinction this
       ordering is drawing. Splitting them would claim a difference in kind that
       is really a difference in how long the shop is open, and the badge
       already says which shop. */
    const errand = (rname) => {
      const rec = RELICS[rname] || {};
      if (!rec.vaulted) return 0;
      return (rec.resurgence || isBaro(rname)) ? 1 : 2;
    };
    const rpAll = Array.from(relicPlan.entries()).sort((a, b) => {
      const ar = errand(a[0]), br = errand(b[0]);
      if (ar !== br) return ar - br;
      const ap = isFinite(a[1].perPart) ? a[1].perPart : Infinity;
      const bp = isFinite(b[1].perPart) ? b[1].perPart : Infinity;
      if (Math.abs(ap - bp) > 1e-9) return ap - bp;
      return b[1].value - a[1].value;
    });

    /* ── narrowing the list, without re-ranking it ────────────────────
       Asked for by the owner 2026-08-27 and built 2026-09-01. The list is
       ranked correctly and stops being *readable* somewhere past fifteen rows:
       a reader who has decided to run Lith fissures tonight should not have to
       scan every Meso, Neo and Axi row to find the four that matter.

       A filter, never a re-rank. Whatever survives keeps the order and the
       figures it already had, which is the same bargain the *Show all N places*
       expander makes — the default answer stays the best one and the control
       only narrows what is on screen.

       **Measured on the page, after a probe got it wrong.** A scratchpad
       reimplementation of the membership rule said the list was bounded at 40
       rows, because it quietly dropped the `stranded` relics this list keeps on
       purpose. The real figure, read off the rendered DOM with every Prime on
       the farm list, is **757: 34 farmable, 6 of Varzia's, 717 trade-only** —
       and the tiers split it 195/188/188/186. Worth recording as a method
       rather than a number: the app is the only authority on what the app
       shows, and a probe that re-states a filter will eventually re-state it
       differently.

       Two calls rather than one, and the split is the point: the strip is
       rebuilt only here, where the plan itself changed, while the list can be
       repainted on its own when a tab is pressed. Rebuilding the strip on a
       press would destroy the button under the reader's finger. */
    relicRows = rpAll;
    relicsVaulted = vaultedOut;
    paintRelicFilters();
    paintRelicList();

    paintFissures();

    // what's left
    $("#planNeeds").innerHTML = needs.map((n) => {
      /* ── dropping, and dropping somewhere you will actually be sent ──
         This counted `!vaulted` alone while the node loop above applied three
         tests, so the panel said "3 relics dropping" against a part with two
         reachable routes and a third behind a checkbox the reader had turned
         off. Live on all three Lex Prime parts when it was found — Neo V9,
         Meso N11 and Axi V10.

         Both sides ask `ROT.reachableSource` now, with the same `opts`, so they
         cannot answer differently. The `stranded` rule is repeated here for the
         same reason: a relic reachable ONLY on Railjack is listed by the loop
         despite the switch, so it has to be counted as reachable here too. */
      const relicReachable = (rname) => {
        const srcs = (RELICS[rname] || {}).sources || [];
        if (srcs.some((s) => ROT.reachableSource(s, opts))) return true;
        return srcs.some((s) => !notADestination(s) && isRailjack(s) && !isEvent(s));
      };
      const liveRelics = n.item.id
        ? (BY_ID.get(n.item.id).parts.find((p) => p.name === n.part) || { relics: [] })
            .relics.filter((r) => RELICS[r.relic] && !RELICS[r.relic].vaulted).map((r) => r.relic)
        : Array.from(relicPlan.keys());
      const openRelics = liveRelics.filter(relicReachable);
      const live = openRelics.length;
      const shut = liveRelics.length - live;
      const rar = n.item.id
        ? (() => { const pp = BY_ID.get(n.item.id).parts.find((x) => x.name === n.part);
                   const best = pp && pp.relics.find((r) => RELICS[r.relic] && !RELICS[r.relic].vaulted);
                   return best ? rarityOf(best.chances) : ""; })()
        : "";
      return `<div class="need-row${live || n.builtFrom ? "" : " need-dead"}${
        rar ? " rar-row-" + rar : ""}">
        <span class="need-name">${esc(n.item.name)}</span>
        <span class="need-part">${esc(n.part)}${n.short > 1 ? ` ×${n.short}` : ""}</span>
        <span class="need-src">${
          n.bonus ? "picked up along the way — never farmed for on its own"
            : n.builtFrom
              ? `<span class="relic-count" data-tip="${esc(
                  "An akimbo is built from two of the single-handed weapon.\n" +
                  "No relic drops a built one, so farm " + n.builtFrom +
                  " on its own\nand come back when you have " + n.short + ".")
                }">build ${n.short} × ${esc(n.builtFrom)}</span>`
              : (live
                  ? `<span class="relic-count" data-tip="${esc(
                      "Dropping where you can reach it:\n" +
                      openRelics.map((r) => "  " + r).join("\n") +
                      (shut ? "\n\nAnother " + shut + " drop" + (shut === 1 ? "s" : "") +
                        " only behind a switch you have off:\n" +
                        liveRelics.filter((r) => !openRelics.includes(r))
                          .map((r) => "  " + r).join("\n") : ""))
                    }">${live} relic${live === 1 ? "" : "s"} dropping</span>`
                  : liveRelics.length
                    ? `<span class="relic-count est" data-tip="${esc(
                        liveRelics.length + " relic" + (liveRelics.length === 1 ? "" : "s") +
                        " still drop" + (liveRelics.length === 1 ? "s" : "") + ", and every\n" +
                        "one is behind a switch you have turned off:\n" +
                        liveRelics.map((r) => "  " + r).join("\n"))
                      }">nowhere you have switched on</span>`
                    : "vaulted — trade or wait for Resurgence")}</span>
      </div>`;
    }).join("");
  }

  /* ── which of these places is a fissure right now ─────────────────
     The game already lists every open fissure, so listing them again would be
     the app repeating something you can read in the navigation console. What it
     cannot tell you is the *intersection*: of the places worth farming for what
     is on your list, which one is a fissure this hour. Go there and the same run
     earns the relic and cracks one.

     Shown, never scored. A fissure lasts an hour or two while the ranking is
     built from drop tables that move a few times a year, so letting it move the
     order would make the list reshuffle hourly for a reason that has expired by
     the time you read it. It is a badge on a row the ranking chose for its own
     reasons.

     Painted into slots rather than rendered with the row, and repainted on a
     timer, so a page left open stops claiming a fissure that has closed without
     re-sorting the list under the reader. */
  function leftText(mins) {
    return mins >= 60 ? Math.floor(mins / 60) + "h " + (mins % 60) + "m" : mins + "m";
  }

  function paintFissures() {
    const now = Date.now();
    $$(".fissure-slot").forEach((slot) => {
      const live = ROT.fissuresAt(FISSURES, slot.dataset.node, now,
                                  opts.railjack, opts.steel);
      if (!live.length) { slot.innerHTML = ""; return; }
      const f = live[0];
      const tip = "A " + f.tier + " fissure is running here, closing " +
        new Date(f.ends).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
        ".\nSo this run earns the relic and cracks one." +
        (f.hard ? "\nSteel Path — a different instance of this node, not the one "
                + "on your ordinary chart." : "") +
        (f.storm ? "\nVoid Storm." : "");
      /* Named in the badge, not only in the tooltip. A Steel Path fissure is
         only reachable on a chart the reader may not be standing on, so it has
         to survive being read at a glance - the tooltip is where the reason
         lives, not where the fact does. */
      slot.innerHTML = '<span class="tag fissure" data-tip="' + esc(tip) + '">' +
        esc(f.tier) + (f.hard ? " Steel Path" : "") + " fissure " +
        esc(leftText(ROT.minutesLeft(f, now))) + "</span>";
    });
  }

  /* A minute is finer than this needs to be — the numbers are in minutes — and
     coarse enough that nothing is being animated at anybody. */
  setInterval(paintFissures, 60000);

  /* That timer only ever removes: it re-reads a list that was fixed when the
     page loaded, so it can retire a fissure that has closed and never mention
     one that opened since. `watchFissures` re-reads the list itself, every ten
     minutes, from this same origin — see shared.js.

     Badges only, deliberately. The fold uses a fissure to choose which of
     several identical nodes to name, and re-running that would rename rows
     under whoever is reading them for a reason that expires within the hour.
     Same call as never letting a fissure into the score (`PROJECT.md §7`). */
  S.watchFissures(paintFissures);

  /* ── catching up after a tab switch ───────────────────────────────
     An interval is not a clock. Browsers throttle a background tab's timers to
     roughly once a minute or worse, and the bounty tick below deliberately does
     nothing at all while `document.hidden` — so a tab left open for an hour came
     back showing a countdown frozen where it was left, and, worse, a ranking
     built for a rotation letter that had turned over while nobody was looking.
     The interval alone could take another half-minute to notice.

     So the moment the tab is visible again, everything that reads the clock runs
     once. That also makes the `document.hidden` guard below correct rather than
     merely cheap: skipping hidden work is only safe when something covers the
     gap it leaves.

     One listener over a list, because the two things that need it are defined a
     page apart and neither should have to know about the other. */
  const onReturn = [paintFissures];
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) onReturn.forEach((fn) => fn());
  });

  /* ── mark-a-part-collected search ────────────────────────────────
     **This box used to add a Prime to the farm list, and stopped on
     2026-09-02 at the owner's direction.** It searches *parts* now, and ticking
     one records that you have it.

     The swap is a division of labour rather than a loss. The planner is where
     you are standing when a part actually drops — you have just run Hepit, you
     have the Neuroptics — and until now the only way to record it was to change
     page, find the Prime and open its drawer. Adding a Prime to the farm list
     is the collection page's job and it already does it, on every card and in
     the drawer, which is where you are when you are deciding what to chase.
     Nobody is stranded by the box changing hands.

     Parts only, and no Primes among the results: mixing them would put a row
     that *wishes for* something beside a row that *owns* something, and the two
     look identical at a glance. */
  const searchBox = $("#addSearch"), results = $("#addResults");
  /* What the last tick did, held here and rendered as the first row of the
     results panel. A separate floating panel was tried and landed on top of the
     first result — both were absolutely positioned at the same offset. */
  let lastSaid = "";

  /* Flattened once. 586 parts against 167 Primes, and the search runs on every
     keystroke, so the join is done here rather than three times a word. */
  const ALL_PARTS = ITEMS.flatMap((it) => (it.parts || []).map((p) => ({
    it, p,
    /* Matched on the whole "Ash Prime Neuroptics" string. Part names are
       generic — `Blueprint` is on 160 Primes, `Systems` on 57 — so matching a
       bare part name returns a wall of identical-looking rows. Typing either
       half still works, and typing both narrows properly. */
    hay: (it.name + " " + p.name).toLowerCase(),
  })));

  /* Newest first, because a part you are holding is far more likely to be from
     something recent than from a 2015 release, and alphabetical for the one
     item DE publish no release date for (Kavasa Prime Collar). */
  const releasedAt = (it) => it.releaseDate || "";

  /* How many different Primes a query may span before it is not a search.
     Ten, the same number of rows the list shows: if the answer cannot be put on
     screen, the reader has not said enough yet to be given one. */
  const SPAN_LIMIT = 10;

  function runSearch() {
    const q = searchBox.value.trim().toLowerCase();
    if (!q) { results.hidden = true; lastSaid = ""; return; }
    /* Every word must match, so "ash neuro" narrows where "ash" alone does not.
       Fuzzy in the sense that matters here — a substring per word, so "neuro"
       finds Neuroptics and "ash" finds Ash Prime — and strict about the whole
       query rather than about any one word. */
    const words = q.split(/\s+/).filter(Boolean);
    const hits = ALL_PARTS.filter((r) => words.every((w) => r.hay.includes(w)));
    hits.sort((a, b) => {
      /* Owned last. What you are looking for is almost always something you do
         not have yet, and burying it under things you have already ticked is
         the one ordering that makes the box useless. */
      const oa = haveOf(a.it.id, a.p.name) >= needOf(a.p),
            ob = haveOf(b.it.id, b.p.name) >= needOf(b.p);
      if (oa !== ob) return oa ? 1 : -1;
      const da = releasedAt(a.it), db = releasedAt(b.it);
      if (da && db && da !== db) return db < da ? -1 : 1;   // newest first
      if (da !== db) return da ? -1 : 1;                    // dated before undated
      return a.it.name < b.it.name ? -1 : a.it.name > b.it.name ? 1 : 0;
    });
    const note = lastSaid
      ? `<div class="add-said" role="status">${esc(lastSaid)}</div>` : "";

    /* **A part name on its own is not a search.** Measured on this payload:
       `Blueprint` is on 160 Primes, `Systems` 57, `Barrel` 54, `Receiver` 53,
       `Neuroptics` and `Chassis` 50 each — and `Prime` is on all of them. Typing
       one returns fifty near-identical rows differing only in a name the reader
       has not typed, which is a list to scroll rather than an answer, and the
       one shape most likely to get the wrong part ticked.

       So the rule is about the *query*, not about a list of banned words: if it
       still spans more than the list can show, say so and ask for the Prime.
       A stop-word list would have to be maintained against DE inventing part
       types — `Cerebrum` and `Carapace` are already here, on six Primes each —
       while this needs nothing and keeps working. It also refuses rather than
       silently ignoring the word, which is the difference between a reader who
       knows what to do next and one who thinks the search is broken. */
    const span = new Set(hits.map((r) => r.it.id)).size;
    if (span > SPAN_LIMIT) {
      results.innerHTML = note +
        `<div class="add-none">That is ${span} different Primes — add the
         Prime's name, like <b>ash neuro</b>.</div>`;
      results.hidden = false;
      return;
    }
    results.innerHTML = note + (hits.length
      ? hits.slice(0, 10).map((r) => {
          const need = needOf(r.p), have = haveOf(r.it.id, r.p.name);
          const done = have >= need;
          return `<button class="add-hit part-hit${done ? " has" : ""}"
            data-got="${esc(r.it.id)}" data-part="${esc(r.p.name)}">
            <span>${esc(r.it.name)} <b>${esc(M.partLabel(r.it.name, r.p.name))}</b></span>
            <span class="add-cat">${done ? "have" : (need > 1 ? have + "/" + need : "need")}</span>
          </button>`;
        }).join("")
      : `<div class="add-none">no part matching that</div>`);
    results.hidden = false;
  }

  /* What the tick did, said where the tick happened. Cleared when the box is
     emptied, so it never describes an action from a search ago. */
  function sayGot(it, p) {
    const need = needOf(p), have = haveOf(it.id, p.name);
    /* The case the owner asked to be told about: you got a drop you were not
       chasing. The part is still recorded — owning something is not the same as
       wanting it, and silently adding the Prime would reorder the whole page
       off one tick — but a tick with no visible effect reads as a tick that did
       not work, so it says which happened. */
    const where = ST.wants(it.id) ? "" : " — not on your farm list";
    lastSaid = have >= need
      ? `${it.name} ${M.partLabel(it.name, p.name)}: have it${where}`
      : `${it.name} ${M.partLabel(it.name, p.name)}: ${have} of ${need}${where}`;
  }
  searchBox.addEventListener("input", runSearch);
  searchBox.addEventListener("focus", runSearch);

  document.addEventListener("click", (e) => {
    /* `data-add` is gone with the Prime search that emitted it — adding to the
       farm list is the collection page's job now. */
    const got = e.target.closest("[data-got]");
    if (got) {
      const id = got.dataset.got, name = got.dataset.part;
      const it = BY_ID.get(id);
      const p = it && it.parts.find((x) => x.name === name);
      if (p) {
        // Only the search results say what they did; the *Still needed* rows
        // are already on screen and change under the reader's eye.
        const fromSearch = !!got.closest("#addResults");
        /* One click, and the same meaning it has on the collection page: up by
           one, round to zero past the last. This used to increment and clamp,
           so a mis-click here could not be taken back — on the one page with no
           other control over the number. Two copies of a rule are two rules. */
        ST.cyclePart(it, p);
        ST.syncCollected(it);
        render();
        if (fromSearch) { sayGot(it, p); runSearch(); }
      }
      return;
    }

    /* Saying you have built it, which nothing else here is entitled to say.

       Banking the last part used to do this on its own, and that was wrong in
       the one direction that matters: a Prime is four parts *and* a build, and
       the app would tell you the hunt was over while the blueprint was still
       sitting in your foundry. So the last part now finishes the list and stops
       there, and this is the sentence you type yourself.

       A toggle, because the alternative is a one-way action with no undo on a
       page you cannot undo it from. It touches nothing but the collected set —
       the parts you banked stay banked either way. */
    const mark = e.target.closest("[data-collect]");
    if (mark) {
      ST.toggleCollected(mark.dataset.collect);
      render();
      return;
    }

    const del = e.target.closest("[data-del]");
    if (del) {
      ST.removeWish(del.dataset.del); render();
      return;
    }
    if (!e.target.closest(".search-wrap")) results.hidden = true;
  });

  $("#clearList").addEventListener("click", () => {
    ST.clearWishlist(); render();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== searchBox) {
      e.preventDefault(); searchBox.focus();
    }
    if (e.key === "Escape") results.hidden = true;
  });

  /* ── options ─────────────────────────────────────────────────── */
  const sortSel = $("#p-sort");
  if (sortSel) {
    sortSel.value = SORTS[opts.sort] ? opts.sort : "rate";
    sortSel.addEventListener("change", () => {
      opts.sort = sortSel.value; save(KEY_PLAN, opts); render();
    });
  }
  [["p-squad", "squad"], ["p-aya", "aya"], ["p-event", "event"],
   ["p-railjack", "railjack"], ["p-steel", "steel"],
   ["p-capped", "capped"]].forEach(([id, key]) => {
    const el = $("#" + id);
    el.checked = !!opts[key];
    el.addEventListener("change", () => { opts[key] = el.checked; save(KEY_PLAN, opts); render(); });
  });
  /* Same reason as the effort rows below: the button is rewritten on every
     render, so the listener goes on the container that survives. Focus is put
     back on it afterwards — expanding a list with the keyboard and being
     returned to the top of the document is the sort of thing that makes a
     control unusable without a mouse (`STYLE.md §6`). */
  {
    const list = $("#planNodes");
    if (list) {
      list.addEventListener("click", (e) => {
        if (!e.target.closest("#moreNodes")) return;
        expandNodes = !expandNodes;
        render();
        const again = $("#moreNodes");
        if (again) again.focus();
      });
    }
  }

  /* The tier tabs and Varzia's box, on the container that survives a render.
     Same arrangement as the expander above and for the same reason.

     **`paintRelicList()` rather than `render()`**, and that is the whole of what
     makes this safe: these controls live in `#relicTiers` and `#relicErrands`,
     and a full render
     rewrites that element — destroying the button that was just pressed, which
     sends the focus to `<body>` and returns a keyboard reader to the top of the
     page (`STYLE.md §6`). Narrowing the list changes only the list, so only the
     list is rebuilt and the strip the reader is standing in is left alone.

     The pressed state is moved in place afterwards for the same reason. */
  {
    const tierBar = $("#relicTiers");
    const errandBar = $("#relicErrands");
    if (tierBar) {
      tierBar.addEventListener("click", (e) => {
        const tab = e.target.closest(".tier-tab");
        if (!tab) return;
        relicTier = tab.dataset.tier || null;
        opts.tier = relicTier;
        save(KEY_PLAN, opts);
        $$("#relicTiers .tier-tab").forEach((b) => {
          b.setAttribute("aria-pressed",
            (b.dataset.tier || null) === relicTier ? "true" : "false");
        });
        /* The errand counts obey the tier, so pressing a tab moves them too. */
        refreshRelicCounts();
        paintRelicList();
      });
    }
    if (errandBar) {
      errandBar.addEventListener("change", (e) => {
        if (e.target.id === "p-varzia") opts.varzia = showVarzia = e.target.checked;
        else if (e.target.id === "p-trade") opts.trade = showTrade = e.target.checked;
        else if (e.target.id === "p-baro") opts.baro = showBaro = e.target.checked;
        else return;
        save(KEY_PLAN, opts);
        /* The owner found this missing on 2026-09-01: the tier tabs went on
           claiming 195 Lith relics while the list beside them held ten. A count
           that does not obey the control next to it is worse than no count. */
        refreshRelicCounts();
        paintRelicList();
      });
    }
  }

  /* The rows are rewritten on every render, so the handler lives on the box
     that survives rather than on the inputs that do not. `change` rather than
     `input`: re-ranking the whole list on every keystroke would move the answer
     around underneath someone still typing the question. */
  {
    const box = $("#effortRows");
    if (box) {
      box.addEventListener("change", (e) => {
        const el = e.target.closest("input[data-mode]");
        if (!el) return;
        const mode = el.dataset.mode;
        const v = Number(el.value);
        if (isFinite(v) && v > 0) opts.minutes[mode] = v;
        else delete opts.minutes[mode];
        save(KEY_PLAN, opts);
        render();
        // the input that had focus was just replaced; put the caret back
        $$("#effortRows input").forEach((x) => {
          if (x.dataset.mode === mode) { x.focus(); x.select(); }
        });
      });
    }
    /* The run overhead, wired the same way and separately. `data-run` rather
       than `data-mode`, so a mission type could never collide with one of these
       two keys. Zero is kept rather than deleted: it is a real answer meaning "I
       do not count it", and it differs from blank only in that the row stops
       being highlighted — which is exactly what a reader who typed 0 expects. */
    const runBox = $("#effortRunRows");
    if (runBox) {
      runBox.addEventListener("change", (e) => {
        const el = e.target.closest("input[data-run]");
        if (!el) return;
        const key = el.dataset.run;
        const v = Number(el.value);
        opts[key] = el.value.trim() !== "" && isFinite(v) && v >= 0 ? v : 0;
        save(KEY_PLAN, opts);
        render();
        $$("#effortRunRows input").forEach((x) => {
          if (x.dataset.run === key) { x.focus(); x.select(); }
        });
      });
    }
    const clear = $("#effortClear");
    if (clear) {
      clear.addEventListener("click", () => {
        // everything the panel holds, including the overhead - the button says
        // "clear all" and a number it left behind would keep moving the ranking
        opts.minutes = {}; opts.runStart = 0; opts.runEnd = 0;
        save(KEY_PLAN, opts); render();
      });
    }
  }

  /* One-time migration from the planner's old private copy. */
  if (!readForma() && ((opts.formaHave || 0) || (opts.formaNeed || 0))) {
    writeForma(Math.max(0, Number(opts.formaHave) || 0),
               Math.max(0, Number(opts.formaNeed) || 0));
  }
  // `steelPath` was a checkbox for one afternoon; drop it rather than leave a
  // dead key riding along in every backup
  delete opts.formaHave; delete opts.formaNeed; delete opts.steelPath;
  delete opts.runMode;   // decided per node since 2026-08-24, never asked
  save(KEY_PLAN, opts);

  {
    const cur = readForma() || { have: 0, need: 0 };
    const have = $("#formaHave"), need = $("#formaNeed");
    have.value = cur.have; need.value = cur.need;
    const push = () => {
      writeForma(Math.max(0, Number(have.value) || 0),
                 Math.max(0, Number(need.value) || 0));
      render();
    };
    have.addEventListener("input", push);
    need.addEventListener("input", push);
  }

  /* A part ticked, a Prime claimed or a farm list changed on the collection
     page in another tab. Three `storage` cases became one subscription, and
     both pages now have it — this page always did, and the collection view did
     not, which is half a feature nobody had noticed was half. */
  ST.subscribe((change) => { if (change.external) render(); });


  /* ── backup ───────────────────────────────────────────────────────────
     The same dialog the collection page carries, because a backup button that
     only exists on one of two equal views is an odd place to put it.

     Export is identical: every key the app writes. Import validates the shape
     and the item ids, writes the keys, and reloads - the reload is what makes
     the collection page pick the new state up, and it keeps the careful
     per-part merging in app.js as the single implementation rather than
     copying it here. */
  const BACKUP_KEYS = S.KEYS;      // the same six names shared.js owns

  const dlg = $("#dataDlg");
  const dbtn = $("#dataBtn");
  /* Only if no one else has. The single-file build runs both pages' scripts
     over one document and app.js gets here first, so on `plan.html` this wires
     the dialog as it always has and in `dist/` it leaves the collection's
     handlers alone — one press, one download, one import. See the longer note
     beside the same guard in app.js. */
  if (dlg && dbtn && !dlg.dataset.wired) {
    dlg.dataset.wired = "planner";
    dbtn.addEventListener("click", () => {
      // one format, assembled in one place - see shared.js
      $("#dataArea").value = JSON.stringify(S.backupPayload());
      $("#dlgMsg").style.color = ""; $("#dlgMsg").textContent = "";
      dlg.showModal();
    });
    $("#dlgCloseBtn").addEventListener("click", () => dlg.close());
    $("#copyBtn").addEventListener("click", () => {
      $("#dataArea").select();
      try { document.execCommand("copy"); $("#dlgMsg").textContent = "Copied."; }
      catch (e) { $("#dlgMsg").textContent = "Press Ctrl+C to copy."; }
    });
    $("#importBtn").addEventListener("click", () => {
      try {
        /* Validated by the same code the collection view uses. This page used
           to check ids but not part names or counts, so the same file restored
           differently depending on which page you were looking at. */
        const backup = M.parseBackup($("#dataArea").value, ITEMS);
        const wrote = [];
        const put = (key, value) => {
          if (value == null) return;
          save(key, value); wrote.push(key);
        };
        put(BACKUP_KEYS.collected, backup.collected);
        put(BACKUP_KEYS.parts, backup.parts);
        put(BACKUP_KEYS.wishlist, backup.wishlist);
        put(BACKUP_KEYS.materials, backup.materials);
        put(BACKUP_KEYS.filters, backup.filters);
        if (backup.plan) {
          put(BACKUP_KEYS.plan, Object.assign(load(KEY_PLAN, {}), backup.plan));
        }
        const skipped = backup.skipped;
        $("#dlgMsg").style.color = "";
        $("#dlgMsg").textContent =
          `Imported ${wrote.length} section${wrote.length === 1 ? "" : "s"}` +
          (skipped ? ` — ${skipped} unrecognised entr${skipped === 1 ? "y" : "ies"} skipped` : "") +
          "." + M.unfinishedNote(backup.unfinished) + " Reloading…";
        setTimeout(() => location.reload(), 700);
      } catch (err) {
        $("#dlgMsg").style.color = "var(--red)";
        $("#dlgMsg").textContent = "Could not read that: " + err.message;
      }
    });
  }

  S.wireFileBackup();
  S.staleBanner();
  S.wireMastery();
  S.siteFooter();
  render();

  /* The bounty clock moves while the page is open: a countdown left alone goes
     stale within the minute, and once the letter turns over the ranking behind
     it is wrong, not merely old.

     Both are handled, but not the same way. The countdown is rewritten in
     place, which disturbs nothing; a full re-render is kept for the letter
     actually changing, because it replaces the list under whoever is reading
     it. */
  /* **Not gated on `anyClocked()` any more.** That asked whether any *bounty*
     was on the clock, which left a payload with no bounty groups running no tick
     at all - and fissures, event windows and the Resurgence window are on the
     clock whether or not a bounty is. `clockStamp` is the whole question now, so
     the gate would only ever have answered a part of it. */
  {
    let seen = ROT.clockStamp(FISSURES);
    const tick = () => {
      if (document.hidden) return;
      const now = ROT.clockStamp(FISSURES);
      if (now !== seen) { seen = now; render(); return; }
      $$("[data-until]").forEach((el) => {
        el.textContent = untilText(Number(el.dataset.until)) + " left";
      });
    };
    setInterval(tick, 30000);
    onReturn.push(tick);      // see visibilitychange above
    /* The poller only calls back when the file actually changed, so this is a
       re-rank on real news rather than on a timer. It goes through `tick` rather
       than straight to `render` so that `seen` is updated in the same place it
       is read - two writers and one reader is how a stamp starts lying. */
    S.watchFissures(tick);
  }
})();
