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
  /* Absent on an old build, and absent is a valid answer — see paintFissures. */
  const FISSURES = DATA.fissures || [];
  const TIER_ORDER = ["Lith", "Meso", "Neo", "Axi"];
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

  /* ── state, shared with the collection page where it makes sense ── */
  let partsOwned = load(KEY_PARTS, {});
  let wishlist = load(KEY_WISH, []).filter((id) => BY_ID.has(id));
  const opts = Object.assign(
    { squad: false, event: false, railjack: false, runMode: "reset", aya: true,
      minutes: {} },
    load(KEY_PLAN, {}));

  const needOf = (p) => p.itemCount || 1;
  const haveOf = (id, name) => (partsOwned[id] || {})[name] || 0;

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

    wishlist.forEach((id) => {
      const it = BY_ID.get(id);
      if (!it) return;
      it.parts.forEach((p) => {
        const short = needOf(p) - haveOf(id, p.name);
        if (short <= 0) return;
        needs.push({ item: it, part: p.name, short, need: needOf(p) });
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

     **It is not conditioned on the node actually being a fissure, because
     nothing here can know that.** Fissures are an overlay that moves every hour
     or two; this dataset is refreshed daily. Fetching the live list was
     considered and rejected: a fissure list a few hours old is wrong more often
     than right, and a confidently wrong answer is worse than an honest
     assumption. So the mode means "when you run one of these as a fissure",
     the row says so, and the arithmetic below is deliberately node-independent -
     which is what makes that safe. See TODO.md.

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

    // Rate first, then a lower enemy level (faster clears). Rotation used to
    // be a tie-break here; it is priced into the score now, so tie-breaking on
    // it as well would count it twice. Rate is the score per run until minutes
    // are given, at which point it is the score per minute - so the list is
    // always ordered by the number the row shows largest.
    const ranked = Array.from(nodes.values()).sort((a, b) => {
      if (Math.abs(b.rate - a.rate) > 1e-12) return b.rate - a.rate;
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
    /* The picked node *becomes* the row rather than being named beside it, so
       everything else on the row - level, planet, demand badges - is that
       node's too. Naming one node and showing another's level was the obvious
       way to build this and would have been quietly wrong. */
    const folded = order.map((key) => {
      const group = groups.get(key);
      const pick = group.length > 1 ? ROT.pickNode(group) : group[0];
      pick.sameAs = group.length > 1 ? group : null;
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
    bonus: "Each run is five rotations, which is what an endless Void Fissure " +
           "pays a free Exceptional relic for reaching — <b>assuming you are " +
           "running one</b>. Nothing here knows which nodes carry a fissure: they " +
           "move every hour or two and this data is refreshed daily, so a list of " +
           "them would be wrong more often than right. The bonus is therefore " +
           "added to every endless node equally, which never reorders them against " +
           "each other — it only weighs staying against a short mission, and that " +
           "comparison holds whatever the fissure map looks like.",
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

    const lines = [
      n2(n.perRun) + " wanted relics a run, over " + cost + ".",
      pct(n.anyRun) + " of runs drop at least one.",
      "Worth " + pct(n.score) + " towards your list once opened.",
    ];
    if (n.halved) lines.push("Ranked figure halved — see the row.");
    if (perMin && n.minutesAssumed) lines.push("Minutes assumed from the ones you set.");

    return `<div class="spot-score" data-tip="${esc(lines.join("\n"))}">
      <b>${n2(n.rate)}</b>relics / ${perMin ? "min" : "objective"}
      <span class="spot-alt">${n2(n.perRun)} a run</span></div>`;
  }

  function renderWishlist() {
    const el = $("#wishlist");
    if (!wishlist.length) {
      el.innerHTML = `<p class="hint">Empty. Search above to add something.</p>`;
      return;
    }
    el.innerHTML = wishlist.map((id) => {
      const it = BY_ID.get(id);
      const total = it.parts.length;
      const done = it.parts.filter((p) => haveOf(id, p.name) >= needOf(p)).length;
      const missing = it.parts.filter((p) => haveOf(id, p.name) < needOf(p));
      return `<div class="wish${done === total ? " wish-done" : ""}">
        <div class="wish-head">
          <span class="wish-name">${esc(it.name)}</span>
          <span class="wish-prog">${done}/${total}</span>
          <button class="wish-del" data-del="${esc(id)}" data-tip="remove from list">✕</button>
        </div>
        <div class="wish-parts">${
          done === total
            ? `<div class="wish-all">all parts collected</div>`
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
    const unit = new Map();
    ranked.forEach((n) => { if (!unit.has(n.mode)) unit.set(n.mode, n.unit); });
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
            (n.aya ? ", which also drops Aya." : ", the lowest level of them.") + "\n\n" +
            n.sameAs.map((x) => "  " + x.node + " (" + x.planet + ")" +
              (x.lvl ? "  lvl " + x.lvl[0] + "–" + x.lvl[1] : "")).join("\n"))
          }">+${n.sameAs.length - 1} same</span>` : ""}
          ${demandTags(n)}
          ${n.event ? `<span class="tag">event</span>` : ""}</div>
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
            pct(n.bonus.value) + " here.\nOnly if this node is a fissure — " +
            "nothing here knows that.")
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
            pct(n.rate)}${n.minutes != null ? "/min" : "/obj"}`
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

    /* Only the tiers this plan actually wants opened, in tier order rather than
       in the ranking's — a four-line strip that reshuffles every time you tick
       a part off is harder to read than one that always says Lith first. */
    const seen = new Set(rp.map(([rname]) => String(rname).split(" ")[0]));
    fissureTiers = TIER_ORDER.filter((t) => seen.has(t))
      .concat(Array.from(seen).filter((t) => TIER_ORDER.indexOf(t) < 0).sort());
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
      return `<div class="need-row${live ? "" : " need-dead"}${rar ? " rar-row-" + rar : ""}">
        <span class="need-name">${esc(n.item.name)}</span>
        <span class="need-part">${esc(n.part)}${n.short > 1 ? ` ×${n.short}` : ""}</span>
        <span class="need-src">${
          n.bonus ? "picked up along the way — never farmed for on its own"
                  : (live
                      ? `<span class="relic-count" data-tip="${esc("Dropping from:" + "\n" +
                          liveRelics.map((r) => "  " + r).join("\n"))}">${live} relic${
                          live === 1 ? "" : "s"} dropping</span>`
                      : "vaulted — trade or wait for Resurgence")}</span>
      </div>`;
    }).join("");
  }

  /* ── where you can crack them, right now ──────────────────────────
     The only part of this page about the next hour rather than the next month.
     Everything else is built from drop tables that move a few times a year; a
     fissure moves every hour or two. So it is shown and never scored — folding
     something that short-lived into the ranking would make the ranking wrong in
     a way nobody could see.

     The list is filtered against the clock on every paint and repainted on a
     timer, so a page left open does not go on advertising a fissure that closed
     an hour ago. When the last one expires the block empties itself and says
     nothing at all: an old build understating what is running is honest, and a
     line reading "no fissures" would not be.

     One line per tier you are actually cracking. The whole live list is 25-30
     entries and most of it is about relics you do not hold. */
  let fissureTiers = [];

  function leftText(mins) {
    return mins >= 60 ? Math.floor(mins / 60) + "h " + (mins % 60) + "m" : mins + "m";
  }

  function paintFissures() {
    const host = $("#planFissures");
    if (!host) return;
    const now = Date.now();

    /* One row per tier, then folded — the same trick the node list uses. An
       Omnia fissure is the answer for every tier at once, so without this a
       page whose exact-tier fissures have all expired shows four rows naming
       one node, which reads as a fault rather than as the convenience it is. */
    const picks = [];
    fissureTiers.forEach((tier) => {
      const live = ROT.fissuresFor(FISSURES, tier, now, opts.railjack);
      if (!live.length) return;
      const already = picks.find((p) => p.f === live[0]);
      if (already) already.tiers.push(tier);
      else picks.push({ f: live[0], tiers: [tier], others: live.length - 1 });
    });

    const rows = picks.map(({ f, tiers, others }) => {
      const covers = tiers.length > 1 && tiers.length === fissureTiers.length;
      /* Two facts, and nothing else: when it shuts, and whether there is
         anywhere else to go when it does. */
      const tip = "Closes " + new Date(f.ends).toLocaleTimeString([], {
        hour: "2-digit", minute: "2-digit" }) + "." +
        (tiers.length === 1 && others
          ? " " + others + " other" + (others === 1 ? "" : "s") + " open." : "");
      const mark = (on, text) =>
        on ? ' <span class="fissure-any">' + text + "</span>" : "";
      return `<div class="fissure-row" data-tip="${esc(tip)}">
        <span class="fissure-tier">${covers ? "Any tier" : esc(tiers.join(" · "))}</span>
        <span class="fissure-where">${esc(f.node)} · ${esc(f.mode)}${
          mark(f.tier === ROT.omniaTier && !covers, "any tier")}${
          mark(f.hard, "Steel Path")}${mark(f.storm, "Void Storm")}</span>
        <span class="fissure-left">${esc(leftText(ROT.minutesLeft(f, now)))}</span>
      </div>`;
    });
    host.innerHTML = rows.length
      ? '<div class="fissure-head">Open now</div>' + rows.join("")
      : "";
  }

  /* A minute is finer than this needs to be — the numbers are in minutes — and
     coarse enough that nothing is being animated at anybody. */
  setInterval(paintFissures, 60000);

  /* ── add-to-list search ──────────────────────────────────────── */
  const searchBox = $("#addSearch"), results = $("#addResults");
  function runSearch() {
    const q = searchBox.value.trim().toLowerCase();
    if (!q) { results.hidden = true; return; }
    const hits = ITEMS.filter((i) =>
      i.parts.length && !wishlist.includes(i.id) && i.name.toLowerCase().includes(q)
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
      wishlist.push(add.dataset.add);
      save(KEY_WISH, wishlist);
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
        // bank one copy; parts needing two take two clicks
        const next = Math.min(needOf(p), (partsOwned[id] || {})[name] + 1 || 1);
        partsOwned[id] = Object.assign({}, partsOwned[id], { [name]: next });
        save(KEY_PARTS, partsOwned);
        // an item whose parts are all owned counts as collected, same as the
        // collection page — keep the two in step
        const done = it.parts.every((q) => (partsOwned[id] || {})[q.name] >= needOf(q));
        /* Through the shared constant, not a literal. This was spelled out by
           hand in two places here, which the rename found: the store moved and
           these two would have gone on reading and writing a key nothing else
           touched, losing ticks silently rather than failing. */
        const coll = new Set(load(S.KEYS.collected, []));
        if (done) coll.add(id); else coll.delete(id);
        save(S.KEYS.collected, Array.from(coll));
        render();
      }
      return;
    }

    const del = e.target.closest("[data-del]");
    if (del) {
      wishlist = wishlist.filter((id) => id !== del.dataset.del);
      save(KEY_WISH, wishlist); render();
      return;
    }
    if (!e.target.closest(".search-wrap")) results.hidden = true;
  });

  $("#clearList").addEventListener("click", () => {
    wishlist = []; save(KEY_WISH, wishlist); render();
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

  // pick up part ticks made on the collection page in another tab
  window.addEventListener("storage", (e) => {
    if (e.key === KEY_PARTS) { partsOwned = load(KEY_PARTS, {}); render(); }
    if (e.key === KEY_WISH) { wishlist = load(KEY_WISH, []).filter((id) => BY_ID.has(id)); render(); }
  });


  /* ── backup ───────────────────────────────────────────────────────────
     The same dialog the collection page carries, because a backup button that
     only exists on one of two equal views is an odd place to put it.

     Export is identical: every key the app writes. Import validates the shape
     and the item ids, writes the keys, and reloads - the reload is what makes
     the collection page pick the new state up, and it keeps the careful
     per-part merging in app.js as the single implementation rather than
     copying it here. */
  const BACKUP_KEYS = S.KEYS;      // the same six names shared.js owns
  const readKey = load;

  const dlg = $("#dataDlg");
  const dbtn = $("#dataBtn");
  if (dlg && dbtn) {
    dbtn.addEventListener("click", () => {
      $("#dataArea").value = JSON.stringify({
        format: 3,          // see app.js - deliberately not the app's name
        exported: new Date().toISOString(),
        collected: readKey(BACKUP_KEYS.collected, []),
        parts: readKey(BACKUP_KEYS.parts, {}),
        materials: readKey(BACKUP_KEYS.materials, []),
        wishlist: readKey(BACKUP_KEYS.wishlist, []),
        filters: readKey(BACKUP_KEYS.filters, null),
        plan: readKey(BACKUP_KEYS.plan, {}),
      });
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
    setInterval(() => {
      if (document.hidden) return;
      const now = ROT.stamp();
      if (now !== seen) { seen = now; render(); return; }
      $$("[data-until]").forEach((el) => {
        el.textContent = untilText(Number(el.dataset.until)) + " left";
      });
    }, 30000);
  }
})();
