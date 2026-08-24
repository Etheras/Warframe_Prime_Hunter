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
  const RUN_MODES = ROT.RUN_MODES;
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
    { squad: false, event: false, railjack: false, runMode: "reset", aya: true,
      minutes: {}, sort: "rate" },
    load(KEY_PLAN, {}));

  /* Which number puts the rows in order. Both count the same thing - wanted
     relics - and differ only in what they divide it by, which is the question
     the reader is actually asking:

       rate   per objective, or per minute once minutes are given. How fast a
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
  const SORTS = {
    rate: { key: "rate", unit: (perMin) => "relics / " + (perMin ? "min" : "objective"),
            heading: (perMin) => "ranked on relics per " + (perMin ? "minute" : "objective"),
            option: (perMin) => "per " + (perMin ? "minute" : "objective") },
    run: { key: "perRun", unit: () => "relics / run",
           heading: () => "ranked on relics per run",
           option: () => "per run" },
  };
  const sortBy = () => SORTS[opts.sort] || SORTS.rate;

  const needOf = (p) => p.itemCount || 1;
  const haveOf = (id, name) => ST.owns(id, name);

  /* ── effort, supplied by the player and empty by default ──────────
     Minutes for one *objective* of each mission type. Nothing is filled in to
     begin with, and nothing has to be: the list is costed by objective *count*
     until someone says what an objective costs them in minutes.

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

  const minutesSet = () => Object.keys(opts.minutes);

  function effort() {
    const set = minutesSet();
    if (!set.length) return null;
    const mean = set.reduce((s, m) => s + opts.minutes[m], 0) / set.length;
    return {
      per: (mode) => opts.minutes[mode] || mean,
      assumed: (mode) => !opts.minutes[mode],
    };
  }

  /* Railjack, event nodes and the bounty clock all live in
     assets/rotation.js - see the alias block at the top of this file. */

  /* ── what you still want ─────────────────────────────────────── */
  function wantedIndex() {
    const want = new Map();   // relic -> [{label, chances, qty, stillNeed}]
    const needs = [];         // for the "still needed" list

    ST.wishlist.forEach((id) => {
      const it = BY_ID.get(id);
      if (!it) return;
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
          if (!want.has(r.relic)) want.set(r.relic, []);
          want.get(r.relic).push({
            label: `${it.name} ${p.name}`,
            chances: r.chances || {}, qty: 1, stillNeed: short,
          });
        });
      });
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
    return { want, needs, formaShort };
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
  const TRACE_COST = { Intact: 0, Exceptional: 25, Flawless: 50, Radiant: 100 };

  function sourceValue(s, rp) {
    const given = s.refinement;
    if (!given || !rp.byRefinement || rp.byRefinement[given] == null) {
      return { value: rp.value, pre: false, traces: 0 };
    }
    return {
      value: rp.byRefinement[given],
      pre: true,
      // what you would have paid to get this relic to the state it arrives in,
      // net of what the plan was going to spend on it anyway
      traces: Math.max(0, (TRACE_COST[given] || 0) - (TRACE_COST[rp.refinement] || 0)),
    };
  }

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
    let best = { tier: null, value: 0, count: 0 };
    Object.keys(tiers).forEach((tier) => {
      const t = tiers[tier];
      if (!t.n) return;
      const value = t.value / t.n;
      if (value > best.value) {
        best = { tier, value, count: t.wanted / t.n, pool: t.n, want: t.wanted };
      }
    });
    return best;
  }

  /* ── the plan ────────────────────────────────────────────────── */

  function buildPlan() {
    const { want, needs, formaShort } = wantedIndex();

    // only relics that actually drop somewhere right now
    const relicPlan = new Map();
    want.forEach((entries, rname) => {
      const rec = RELICS[rname];
      if (!rec || rec.vaulted) return;
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
      (RELICS[rname].sources || []).forEach((s) => {
        if (notADestination(s)) return;      // quest, or not modelled yet
        const skip = `${s.planet}|${s.node}|${s.mode}`;
        if (!opts.railjack && isRailjack(s)) { blocked.railjack.add(skip); return; }
        if (!opts.event && isEvent(s)) { blocked.event.add(skip); return; }
        const key = `${s.planet}|${s.node}|${s.mode}`;
        let n = nodes.get(key);
        if (!n) {
          n = { planet: s.planet, node: s.node, mode: s.mode,
                kind: s.kind, lvl: s.lvl || null, event: isEvent(s),
                eventBounty: bountyEvent(s),
                railjack: isRailjack(s), score: 0,
                rot: { A: 0, B: 0, C: 0, none: 0 },
                /* The same rolls counted rather than valued: the plain chance a
                   reward here is a relic on the list, before anything is said
                   about what opening it would be worth. Kept alongside rather
                   than divided back out of the score, because the score has
                   Forma and Aya folded into it and neither is a relic. */
                cnt: { A: 0, B: 0, C: 0, none: 0 },
                relics: new Map() };
          nodes.set(key, n);
        }
        const slot = { A: "A", B: "B", C: "C" }[String(s.rotation || "").toUpperCase()] || "none";
        const worth = sourceValue(s, rp);
        if (worth.pre) {
          n.preRefined = true;
          n.tracesSaved = Math.max(n.tracesSaved || 0, worth.traces);
          n.overshot = n.overshot || worth.value < rp.value - 1e-12;
        }
        n.rot[slot] += ((s.chance || 0) / 100) * worth.value;
        n.cnt[slot] += (s.chance || 0) / 100;
        const prev = n.relics.get(rname);
        if (prev == null || (s.chance || 0) > prev.chance) {
          n.relics.set(rname, { chance: s.chance || 0, rotation: s.rotation });
        }
      });
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

      vaultWanted.forEach((entries, rname) => {
        const rec = RELICS[rname];
        if (!rec || !rec.vaulted) return;
        if (ayaRotationLive && !rec.resurgence) return;   // only what is on sale
        const { value } = bestRefinement(entries);
        if (value > ayaValue) { ayaValue = value; ayaRelic = rname; }
      });
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

    // value each node as a whole run, which is what you actually commit to
    const mins = effort();
    const bonus = opts.runMode === "bonus" ? fissureBonus(relicPlan) : null;
    nodes.forEach((n) => {
      const live = n.kind === "bounty" ? liveRotation(n.node) : null;
      const r = runValue(n.rot, opts.runMode, n.mode, opts.squad, live, n.cnt);
      /* The one deliberate thumb on the scale in the whole model - see
         rotation.js. Applied to the score, never to the count below it: what a
         run hands you is a fact, this is only what we think it is worth going
         for. */
      n.halved = ROT.isRailjackCache(n);
      /* The free relic for staying, once per run, and only where the run
         actually reaches it: an endless mission taken to five rotations, run as
         a fissure. Railjack has Void Storms instead of fissures, so it is out. */
      n.bonus = bonus && (r.rounds || 0) >= ROT.bonusRotations && !isRailjack(n)
        ? bonus : null;
      // kept as the second number on the row: what a run is worth once the
      // relics are opened, which is a different question from how many arrive
      n.score = (r.total + (n.bonus ? n.bonus.value : 0)) *
                (n.halved ? 1 - ROT.cachePenalty : 1);
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
      n.minutes = mins ? mins.per(n.mode) * o.count : null;
      n.minutesAssumed = !!mins && mins.assumed(n.mode);
      /* Costed per objective by default, per minute once anyone says what an
         objective costs them.

         Per *run* was the old default and it flatters anything long: a run is
         whatever you decide to make it, so it is not a unit at all. Against one
         player's own timings, costing per run is out by up to 9.6x across
         mission types; per objective it is out by 2.4x, because a round, a
         vault and a bounty stage all take somewhere around 2.5 to 6 minutes.
         Four times closer to the truth, and it asks the player for nothing. */
      n.cost = n.minutes || o.count;
      /* ── the split ──────────────────────────────────────────────────
         Where to go ranks on **relics per objective** - how fast this node
         fills the stack - and knows nothing about what a relic is worth once
         opened. That is the other list's question, and answering both with one
         number was why "runs to finish" could never be labelled honestly.

         The cache penalty applies here rather than to `perRun`, which stays the
         raw count DE's numbers imply. So the headline is an adjusted figure and
         says so on the row; the fact underneath it is not adjusted. */
      n.rate = (n.perRun / n.cost) * (n.halved ? 1 - ROT.cachePenalty : 1);
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
    const now = Date.now();
    const isFissureNow = (n) =>
      ROT.fissuresAt(FISSURES, nodeKey(n), now, opts.railjack).length > 0;

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
             needs, formaShort, ayaValue, ayaRelic,
             ayaRotationLive, ayaMissing, perMinute: !!mins,
             blocked: { railjack: blocked.railjack.size, event: blocked.event.size } };
  }

  /* ── tooltip, same as the collection page ─────────────────────
     Monospaced and whitespace-preserving, because native title= is
     proportional and turns aligned columns to mush. */

  /* Rotation rewards cycle A -> A -> B -> C and repeat, so "rotation C" really
     means "stay for the 4th reward". Spelled out because the letters mean
     nothing on their own. */
  const RUN_BLURB = {
    reset: "Each run goes to the last rotation you want something from — 2, 3 or 4 " +
           "rounds — collecting every rotation on the way.",
    full: "Each run is a full A → A → B → C " +
          "cycle, all four rewards counted.",
    aabcaa: "Each run is six rounds — four rotation A rewards plus a B and a C, " +
            "all of which count.",
    /* The clause about refreshing daily was corrected on 2026-08-24, when it
       stopped being true in both directions at once: the fissure list is now
       re-read every ten minutes and the badges beside these rows come from it.
       The decision it was justifying has not changed and is not in question -
       the bonus stays flat, which is what makes it safe. See `TODO.md` for the
       rest of that sentence, which still overclaims. */
    bonus: "Each run is five rotations, which is what an endless Void Fissure " +
           "pays a free Exceptional relic for reaching — <b>assuming you are " +
           "running one</b>. The badges on the rows above say which nodes carry " +
           "a fissure right now, but the bonus is deliberately not conditioned " +
           "on them: a fissure lasts an hour or two, and letting one into the " +
           "score would reshuffle this list under you for a reason that has " +
           "already expired. It is added to every endless node equally, which " +
           "never reorders them against each other — it only weighs staying " +
           "against a short mission, and that comparison holds whatever the " +
           "fissure map looks like.",
  };
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
    const pays = n.counts
      ? Object.keys(n.counts).filter((r) => (n.rot[r] || 0) > 0)
      : [];
    if (!pays.length && !n.rounds && !(n.stranded || []).length) return "no rotation";

    /* Short on purpose. This used to carry the whole Disruption tier table and
       the rotation cycle - twenty-five lines of rules nobody reads on a hover,
       and rules are the same for every row anyway. They live under *How this
       works* at the foot of the page now (`STYLE.md §5`), and what is left here
       is only what is true of THIS node. */
    const lines = [];
    if (n.rounds) {
      lines.push(Object.keys(n.counts)
        .map((r) => "rot " + r + " ×" + n.counts[r]).join(", ") +
        " over " + n.rounds + " round" + (n.rounds === 1 ? "" : "s") + ".");
    }
    if (n.planName) lines.push("Playing it by " + n.planName + ".");
    (n.stranded || []).forEach((t) => {
      lines.push("rot " + t + " has " + pct(n.rot[t]) + " you want, out of reach here.");
    });
    if (n.nonStandard && (n.stranded || []).indexOf("A") >= 0 && !opts.squad) {
      lines.push("Tick 4-squad to let it try for rotation A.");
    }

    const label = pays.length ? "rot " + pays.join("+")
      : (n.stranded || []).length ? "rot " + n.stranded.join("+") + " only"
      : "no rotation";
    const cls = "rot" + (n.nonStandard ? " rot-odd" : "");
    return `<abbr class="${cls}" data-tip="${esc(lines.join("\n"))}">${esc(label)}</abbr>` +
      (n.rounds ? ` · <span class="rounds">${n.rounds} rounds</span>` : "");
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
     relics per objective. This list answers "where do I go to fill the stack",
     and nothing more - what a relic turns into once opened is the other list's
     question. That is why the percentage moved down a line rather than away:
     they disagree often enough to be worth both. Mithra is worth 63.85% a run
     while dropping 0.83 wanted relics; Taranis drops 1.47 and is worth 51.25%.
     More relics, less progress, because what Taranis hands you is the easy
     part - and which of those you want depends on whether you are short of
     relics or short of the right ones. */
  /* "4 rounds", "3 vaults", "one run" - how a run's cost reads when nobody has
     put a minute figure on it. */
  const objectivesText = (n) =>
    n.objectives === 1 && n.unit === "run"
      ? "one run"
      : n.objectives + " " + n.unit + (n.objectives === 1 ? "" : "s");

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
    if (n.halved) lines.push("Ranked figure halved — see the row.");
    if (perMin && n.minutesAssumed) lines.push("Minutes assumed from the ones you set.");

    /* Both numbers stay on the row and they swap places: the one the list is
       ordered by is the big one, always, and the other goes underneath it. A
       toggle that changed the order without moving them would leave the row
       claiming to be sorted by a number it is not. */
    const big = by.key === "perRun"
      ? { value: n.perRun, unit: by.unit(perMin) }
      : { value: n.rate, unit: by.unit(perMin) };
    const alt = by.key === "perRun"
      ? n2(n.rate) + " / " + (perMin ? "min" : "objective")
      : n2(n.perRun) + " a run";

    return `<div class="spot-score" data-tip="${esc(lines.join("\n"))}">
      <b>${n2(big.value)}</b>${esc(big.unit)}
      <span class="spot-alt">${esc(alt)}</span></div>`;
  }

  function renderWishlist() {
    const el = $("#wishlist");
    if (!ST.wishlist.length) {
      el.innerHTML = `<p class="hint">Empty. Search above to add something.</p>`;
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
  function noNodes(blocked) {
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

    const set = minutesSet();
    const mean = set.length
      ? set.reduce((s, m) => s + opts.minutes[m], 0) / set.length : 0;
    const note = $("#effortState");
    if (note) {
      note.innerHTML = !modes.length ? ""
        : set.length
          ? `<b>${set.length} set.</b> Every other type is costed at their average, ` +
            `${n2(mean)} min — shown in amber on the row, so a borrowed number is ` +
            `never mistaken for one of yours.`
          : `Nothing set, so every mission is costed by its <b>objective count</b> ` +
            `— four rounds, three vaults, one run. That is the default and it works. ` +
            `Fill in a single type and the whole list re-sorts on real minutes.`;
    }
    const clear = $("#effortClear");
    if (clear) clear.hidden = !set.length;
  }

  function render() {
    renderWishlist();
    const { relicPlan, ranked, needs, formaShort, ayaValue, ayaRelic,
            ayaRotationLive, ayaMissing, perMinute, blocked, places } = buildPlan();
    renderEffort(ranked);

    $("#formaShort").textContent = formaShort > 0 ? `short ${formaShort}` : "";
    $("#formaShort").classList.toggle("on", formaShort > 0);

    const hasWork = needs.length > 0;
    $("#planEmpty").hidden = hasWork;
    $("#planWrap").hidden = !hasWork;
    if (!hasWork) return;

    /* A list that ranks on something says so in its heading (`STYLE.md §5`),
       which means the heading is not static: it follows the sort toggle, and it
       follows the switch from objectives to minutes that giving effort weights
       makes. It said "per objective" through both until 2026-08-24. */
    const rankedOn = $("#planRankedOn");
    if (rankedOn) rankedOn.textContent = "— " + sortBy().heading(perMinute);

    /* The options say it too, because the control sits on the heading now and
       has no label of its own beside it: "per objective" has to become "per
       minute" the moment effort weights turn it into one. Rewritten rather than
       rebuilt, so the open state of a dropdown someone is using is not lost. */
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
      `up, so it is not comparable across rotations on its own. ${RUN_BLURB[opts.runMode] || RUN_BLURB.reset} ` +
      `Relics are listed best-first within each node. ` +
      `Ties are broken by lower enemy level.` +
      (formaShort > 0 ? " A Forma shortfall raises the value of relics you were already " +
        "running, but never adds one." : "") +
      (ayaValue > 0 ? " Aya counts too: you are still missing " + ayaMissing +
        " vaulted part" + (ayaMissing === 1 ? "" : "s") + ", so it is worth " +
        "banking. Valued at <b>" + esc(ayaRelic) + "</b>, " + pct(ayaValue) +
        (ayaRotationLive ? " — the best relic Varzia is selling this rotation."
                         : " — no rotation is running, so the best a future one could offer.") +
        " It only ever raises nodes already worth running." : "") +
      (ranked.some((n) => n.bounty)
        ? " Bounties are the exception to all of that: one rotation is live for " +
          "everyone at a time and it changes every " + CYCLE_MINUTES +
          " minutes, so a bounty is scored on the letter that is up <b>now</b> " +
          "and the row says how long that has left."
        : "") +
      (opts.event ? " Event nodes are included — check the event is actually running." : "") +
      (openRelics === 0 ? " Nothing you want is currently dropping." : "");

    // nodes: show the best few, with the rest behind a hover
    const SHOW = 8;
    if (!ranked.length) $("#planNodes").innerHTML = noNodes(blocked);
    else $("#planNodes").innerHTML = ranked.slice(0, SHOW).map((n) => {
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
          n.bonus ? ` · <span class="est" data-tip="${esc(
            "Five rotations in a fissure pays a free relic, worth " +
            pct(n.bonus.value) + " here.\nCounted on every endless node, not " +
            "only the ones that are a\nfissure right now — the badge beside " +
            "the node name says which\nthose are, and it deliberately does not " +
            "move the ranking.")
          }">+relic if fissure</span>` : ""}${
          n.preRefined ? ` · <span class="${n.overshot ? "est" : "pre"}" data-tip="${esc(
            "Hands its relics over already Radiant" +
            (n.tracesSaved ? ", saving " + n.tracesSaved + " Void Traces" : "") + ".\n" +
            (n.overshot
              ? "Scored lower: this plan wanted them less refined."
              : "This plan wanted Radiant anyway."))
          }">${n.overshot ? "pre-refined" : "radiant"}</span>` : ""}${
          n.halved ? ` · <span class="est" data-tip="${esc(
            "Scored at half on purpose — nobody runs Railjack for caches.\n" +
            "The relic count is untouched.")
          }">halved</span>` : ""}${
          /* A borrowed number stays visible even after the corner was cut back:
             a guess you can see beats a guess you cannot. */
          n.minutesAssumed ? ` · <span class="est" data-tip="${esc(
            "No minutes set for " + n.mode + ", so it is costed at the average\n" +
            "of the types you did set.")
          }">est. ${n2(n.minutes)} min</span>` : ""}${
          n.aya ? ` · <span class="aya" data-tip="${esc(
            "Drops Aya at " + pct(n.aya / 100) + " a reward, counted as " +
            pct(ayaValue) + ".\nOne Aya buys any relic Varzia is selling.")
          }">aya</span>` : ""}</div>
        ${scoreBlock(n)}
      </div>`;
    }).join("") + (ranked.length > SHOW
      ? `<div class="more-nodes" data-tip="${esc(ranked.slice(SHOW, SHOW + 20).map((n) =>
          `${n.node} (${n.planet}) ${n.mode}${n.rounds ? " " + n.rounds + "rd" : ""} — ${
            // the same number these rows are ordered by, in the same unit
            sortBy().key === "perRun"
              ? n2(n.perRun) + "/run"
              : n2(n.rate) + (n.minutes != null ? "/min" : "/obj")}`
        ).join("\n"))}">+${ranked.length - SHOW} more places</div>`
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
       chance at any refinement is not urgent, it is impossible. */
    const rp = Array.from(relicPlan.entries()).sort((a, b) => {
      const ap = isFinite(a[1].perPart) ? a[1].perPart : Infinity;
      const bp = isFinite(b[1].perPart) ? b[1].perPart : Infinity;
      if (Math.abs(ap - bp) > 1e-9) return ap - bp;
      return b[1].value - a[1].value;
    });
    $("#planRelics").innerHTML = rp.length ? rp.map(([rname, p]) => {
      // background = the action (which refinement); chips = each part's rarity
      // Rarest first, so position carries "this is the hard one" — no marker
      // needed. A highlight had to pick a winner even when two parts were
      // equally scarce, and that choice was arbitrary.
      const RAR_ORDER = { Rare: 0, Uncommon: 1, Common: 2 };
      const parts = p.entries
        .filter((e) => !e.bonus)
        .map((e) => ({ label: e.label, rar: rarityOf(e.chances) }))
        .sort((a, b) => (RAR_ORDER[a.rar] ?? 9) - (RAR_ORDER[b.rar] ?? 9) ||
                        a.label.localeCompare(b.label));
      return `<div class="relic-row ref-row-${esc(p.refinement)}">
        <span class="relic-name">${esc(rname)}</span>
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
        parts.map((x) => `<span class="part-chip ${esc(x.rar)}">${esc(x.label)}</span>`).join("")
      }</div>`;
    }).join("") : `<p class="hint">None of the relics you need are currently dropping.</p>`;

    paintFissures();

    // what's left
    $("#planNeeds").innerHTML = needs.map((n) => {
      const liveRelics = n.item.id
        ? (BY_ID.get(n.item.id).parts.find((p) => p.name === n.part) || { relics: [] })
            .relics.filter((r) => RELICS[r.relic] && !RELICS[r.relic].vaulted).map((r) => r.relic)
        : Array.from(relicPlan.keys());
      const live = liveRelics.length;
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
                  ? `<span class="relic-count" data-tip="${esc("Dropping from:" + "\n" +
                      liveRelics.map((r) => "  " + r).join("\n"))}">${live} relic${
                      live === 1 ? "" : "s"} dropping</span>`
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
      const live = ROT.fissuresAt(FISSURES, slot.dataset.node, now, opts.railjack);
      if (!live.length) { slot.innerHTML = ""; return; }
      const f = live[0];
      const tip = "A " + f.tier + " fissure is running here, closing " +
        new Date(f.ends).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
        ".\nSo this run earns the relic and cracks one." +
        (f.hard ? "\nSteel Path." : "") + (f.storm ? "\nVoid Storm." : "");
      slot.innerHTML = '<span class="tag fissure" data-tip="' + esc(tip) + '">' +
        esc(f.tier) + " fissure " + esc(leftText(ROT.minutesLeft(f, now))) + "</span>";
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

  /* ── add-to-list search ──────────────────────────────────────── */
  const searchBox = $("#addSearch"), results = $("#addResults");
  function runSearch() {
    const q = searchBox.value.trim().toLowerCase();
    if (!q) { results.hidden = true; return; }
    const hits = ITEMS.filter((i) =>
      i.parts.length && !ST.wants(i.id) && i.name.toLowerCase().includes(q)
    ).slice(0, 8);
    results.innerHTML = hits.length
      ? hits.map((i) => `<button class="add-hit" data-add="${esc(i.id)}">
          <span>${esc(i.name)}</span><span class="add-cat">${esc(i.category)}</span></button>`).join("")
      : `<div class="add-none">nothing matching, or already on the list</div>`;
    results.hidden = false;
  }
  searchBox.addEventListener("input", runSearch);
  searchBox.addEventListener("focus", runSearch);

  document.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    if (add) {
      ST.addWish(add.dataset.add);
      searchBox.value = ""; results.hidden = true;
      render();
      return;
    }
    const got = e.target.closest("[data-got]");
    if (got) {
      const id = got.dataset.got, name = got.dataset.part;
      const it = BY_ID.get(id);
      const p = it && it.parts.find((x) => x.name === name);
      if (p) {
        /* One click, and the same meaning it has on the collection page: up by
           one, round to zero past the last. This used to increment and clamp,
           so a mis-click here could not be taken back — on the one page with no
           other control over the number. Two copies of a rule are two rules. */
        ST.cyclePart(it, p);
        ST.syncCollected(it);
        render();
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
  const runSel = $("#p-runmode");
  if (runSel) {
    runSel.value = RUN_MODES.includes(opts.runMode) ? opts.runMode : "reset";
    runSel.addEventListener("change", () => {
      opts.runMode = runSel.value; save(KEY_PLAN, opts); render();
    });
  }

  const sortSel = $("#p-sort");
  if (sortSel) {
    sortSel.value = SORTS[opts.sort] ? opts.sort : "rate";
    sortSel.addEventListener("change", () => {
      opts.sort = sortSel.value; save(KEY_PLAN, opts); render();
    });
  }
  [["p-squad", "squad"], ["p-aya", "aya"], ["p-event", "event"],
   ["p-railjack", "railjack"]].forEach(([id, key]) => {
    const el = $("#" + id);
    el.checked = !!opts[key];
    el.addEventListener("change", () => { opts[key] = el.checked; save(KEY_PLAN, opts); render(); });
  });
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
    const clear = $("#effortClear");
    if (clear) {
      clear.addEventListener("click", () => {
        opts.minutes = {}; save(KEY_PLAN, opts); render();
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
  if (dlg && dbtn) {
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
          ". Reloading…";
        setTimeout(() => location.reload(), 700);
      } catch (err) {
        $("#dlgMsg").style.color = "var(--red)";
        $("#dlgMsg").textContent = "Could not read that: " + err.message;
      }
    });
  }

  S.wireFileBackup();
  S.staleBanner();
  render();

  /* The bounty clock moves while the page is open: a countdown left alone goes
     stale within the minute, and once the letter turns over the ranking behind
     it is wrong, not merely old.

     Both are handled, but not the same way. The countdown is rewritten in
     place, which disturbs nothing; a full re-render is kept for the letter
     actually changing, because it replaces the list under whoever is reading
     it. */
  if (ROT.anyClocked()) {
    let seen = ROT.stamp();
    const tick = () => {
      if (document.hidden) return;
      const now = ROT.stamp();
      if (now !== seen) { seen = now; render(); return; }
      $$("[data-until]").forEach((el) => {
        el.textContent = untilText(Number(el.dataset.until)) + " left";
      });
    };
    setInterval(tick, 30000);
    onReturn.push(tick);      // see visibilitychange above
  }
})();
