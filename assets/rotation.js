/* Warframe Prime Hunter — the rotation model, shared by both pages.

   What a node is worth depends on what one run there actually hands you, and
   that is not the same question everywhere:

     * an endless mission pays one reward per round, cycling A -> A -> B -> C
     * Disruption pays by round *and* by how well you played it
     * a bounty pays one rotation, chosen by the clock rather than by you

   All three used to live twice, once in each page, kept in step by hand. They
   drifted - the collection view told you to stay for the 4th reward at a
   bounty, where there is no 4th reward - so the model now lives here and both
   pages read it. Nothing in this file touches the DOM or the store; it is
   arithmetic over `window.WFPRIME_DATA` and the clock.

   Loaded before app.js and plan.js, after data/prime-data.js.            */
(function () {
  "use strict";

  const DATA = window.WFPRIME_DATA || {};

  /* ── rounds: the ordinary mission cycle ───────────────────────────
     Rewards cycle A -> A -> B -> C, one per round: rounds 1-2 pay A, 3 pays B,
     4 pays C, 5-6 pay A again. DE's published chance is conditional on that
     rotation having come up, so it is not comparable across rotations as it
     stands - a rot C relic at 23% arrives far more slowly than a rot A one.

     A run collects every rotation it passes through, not only the one you came
     for: AABCAA hands you four A rewards *and* a B *and* a C. So a node is
     valued whole - take the rewards the pattern actually yields, and divide by
     the rounds it costs.

       reset   run to the last rotation you want something from, then restart
       full    keep going; the rate settles at one full AABC cycle
       aabcaa  six rounds, then restart

     `reset` stops at the LAST rotation holding something you want, not at
     whichever stop has the best rate: if you need a part from A and another
     from C, leaving after round 2 never gets you the C part at all, so a higher
     per-round rate there is measuring the wrong thing. Same reasoning as
     refinement following the bottleneck instead of the likeliest reward.

     A node with no rotation pays once per run and is added flat. That equates a
     round to a whole mission, which flatters long ones - deliberate, since
     mission length is not modelled anywhere. */
  /* `bonus` exists because of something the other three cannot reach. An
     endless Void Fissure hands out a free relic for staying: five rotations
     gives a random Exceptional of the fissure's tier, ten a Flawless, and every
     fifth after fifteen a Radiant (wiki: Void Fissure). The other modes stop at
     four rotations or six, so the first bonus is either unreachable or a
     coincidence - the run has to be chosen for it.

     Five rotations, then restart: the second bonus is twice as far away for a
     reward one refinement step better, which is a worse trade every time. */
  /* `fixed` is not a choice the player makes and never competes with the other
     three. It is for missions that HAVE no length to choose - three Spy vaults,
     two Railjack caches, one Faceoff match - where the run-length optimiser was
     picking a number the mission cannot have. See FIXED_LENGTH. */
  const RUN_MODES = ["reset", "full", "aabcaa", "bonus", "fixed"];
  const BONUS_ROTATIONS = 5;

  /* Rotation pattern, by mission type.

     Every endless mission advances A -> A -> B -> C and repeats, with one
     exception. Disruption does not use that cycle at all: it pays one reward
     per round, and the tier depends on the round number *and* how many of the
     four conduits you successfully defended that round.

         round   1 defended   2   3   4 defended
           1         A        A   A       B
           2         A        A   B       B
           3         A        B   B       C
           4+        B        B   C       C

     Anything not named here gets AABC, so a mission type we have never heard of
     degrades to the normal rule rather than to nothing. Bounties never reach
     this table at all - they are on the clock below. */
  /* Once the three rotation A rewards are banked, round 4 onward is a free
     choice: defend 1-2 conduits for B, or 3-4 for C. Take whichever is worth
     more here rather than assuming B, which would strand a wanted C. */
  const tailTier = (rot) => ((rot.C || 0) > (rot.B || 0) ? "C" : "B");

  const AABC = { plan: (r) => "AABC"[(r - 1) % 4], cycle: 4, squadOnly: false,
                 name: null };
  const ROT_PATTERN = {
    /* Defending all four conduits: B, B, then C for as long as you stay.
       Needs no coordination - it is simply playing the mission well. So
       rotation C is *unlocked* rather than periodic, and rotation A is
       unreachable. */
    Disruption: [
      { plan: (r) => (r <= 2 ? "B" : "C"), cycle: 3, squadOnly: false,
        name: "defending all four conduits" },
      /* Rotation A exists only if you deliberately UNDER-defend: 3 conduits in
         round 1, then 2, then 1, which is the only route to it and caps at
         three. From round 4 the floor is B. Letting conduits die on purpose,
         to a schedule, without failing the round outright, is not something a
         random public squad will do - so this plan is offered only when the
         4-squad option says you have an organised team. */
      /* Rotation A is exhaustible: three rewards at most, rounds 1-3, and
         flatly impossible from round 4. So this is not one option among
         several - if anything you want sits on A, it is the only plan that can
         ever get it, and it takes priority over any plan that banks more.
         Same reasoning as refinement following the bottleneck rather than the
         likeliest reward: you cannot optimise throughput on a resource that
         runs out. */
      { plan: (r, rot) => (r <= 3 ? "A" : tailTier(rot)), cycle: 4, squadOnly: true,
        onlyChanceAt: "A",
        name: "under-defending on purpose for rotation A (the only route to it)" },
      /* Holding rotation B from the very first round: defend 4, then 3-4, then
         2-3, then 1-2 forever. Only beats the plan above when rotation A is
         worth less than B here - otherwise A,A,A,B,B,B... dominates it, since
         both are B from round four on. Same coordination requirement. */
      { plan: () => "B", cycle: 1, squadOnly: true,
        name: "holding rotation B every round" },
    ],
  };
  const plansFor = (mission, squad) =>
    (ROT_PATTERN[mission] || [AABC]).filter((p) => !p.squadOnly || squad);

  function scorePlan(rot, runMode, p, fixed) {
    /* A fixed-length mission does not walk the cycle: it pays a stated set of
       rotations once each, and there is nothing to decide. Taken before the
       round count is worked out, because there is no round count to work out. */
    if (runMode === "fixed") {
      const counts = {};
      fixed.pays.forEach((t) => { counts[t] = (counts[t] || 0) + 1; });
      let total = 0;
      Object.keys(counts).forEach((t) => { total += counts[t] * (rot[t] || 0); });
      return { total, counts, rounds: fixed.pays.length, plan: p };
    }
    let n;
    if (runMode === "full") n = 4;
    else if (runMode === "aabcaa") n = 6;
    else if (runMode === "bonus") n = BONUS_ROTATIONS;
    else {
      n = 0;                                    // reset: last round that pays
      for (let r = 1; r <= p.cycle; r++) if ((rot[p.plan(r, rot)] || 0) > 0) n = r;
    }
    const counts = {};
    for (let r = 1; r <= n; r++) {
      const t = p.plan(r, rot);
      counts[t] = (counts[t] || 0) + 1;
    }
    let total = 0;
    Object.keys(counts).forEach((t) => { total += counts[t] * (rot[t] || 0); });
    return { total, counts, rounds: n || null, plan: p };
  }

  /* ── the same run, counted rather than valued ─────────────────────
     `rot` says what each rotation is *worth*; the optional `alt` map says the
     plain chance that one reward roll there is a relic you want. Both describe
     the same run, so the count and the probability are taken from the rounds
     the value model actually settled on - working them out separately would let
     the two disagree about how long the run is, and the row would then show a
     percentage and a count that cannot both be true.

     A reward roll yields exactly one item, so the relics in a table are
     mutually exclusive and their chances add: the expected count is a plain
     sum. The probability of coming away with something is the complement of
     missing every roll.

     `draws` is how many rolls each rotation gets over the run. */
  function tally(draws, alt) {
    if (!alt) return {};
    let count = 0, miss = 1;
    Object.keys(draws).forEach((t) => {
      const p = Math.min(1, Math.max(0, alt[t] || 0));
      count += draws[t] * p;
      miss *= Math.pow(1 - p, draws[t]);
    });
    return { count, any: 1 - miss };
  }

  /* ── the bounty clock ─────────────────────────────────────────────
     A bounty's rotation letter is the time of day, not how long you stay. One
     letter is live for everyone at once, it changes when the bounty board
     refreshes - every 150 minutes, a full day/night of the landscape - and it
     walks A -> B -> C -> A. A run therefore pays the stages of one letter, and
     the only way to reach another is to wait.

     The build names the letter that was live when it ran, by matching the
     rewards the worldstate says are on offer against what DE's table says each
     letter pays. From that one reading the rest is arithmetic, done here so it
     stays right between refreshes: count whole cycles since that window ended
     and walk the sequence forward. UTC throughout, so no timezone can move it.

     There are two clocks. The Isolation Vaults run a phase of their own - one
     step behind the standard bounties when this was written - so each family
     carries its own letter and neither is inferred from the other. */
  const BOUNTY = (DATA.meta || {}).bounties || null;
  const SEQ = (BOUNTY && BOUNTY.sequence) || "ABC";
  const CYCLE_MINUTES = (BOUNTY && BOUNTY.cycleMinutes) || 150;
  const CYCLE_MS = CYCLE_MINUTES * 60000;

  /* One letter, walked forward from the window it was read in. The board turns
     over every cycle for everybody at once, so this is arithmetic on the
     sequence rather than anything the data has to carry per step. */
  function walkFrom(letter, windowEnd) {
    const end = windowEnd ? new Date(windowEnd).getTime() : NaN;
    const at = SEQ.indexOf(letter || "");
    if (!isFinite(end) || at < 0) return { letter: null, endsAt: null };
    const now = Date.now();
    const steps = now < end ? 0 : Math.floor((now - end) / CYCLE_MS) + 1;
    return { letter: SEQ[(at + steps) % SEQ.length],
             endsAt: end + steps * CYCLE_MS };
  }

  /* Where one family's clock has got to, now. The fallback: used when DE did
     not publish a letter for a bounty, or could not be reached. */
  function familyState(name) {
    const fam = (BOUNTY && (BOUNTY.families || {})[name]) || null;
    return walkFrom(fam && fam.letter, fam && fam.windowEnd);
  }

  /* {letter, endsAt, published} for a bounty node. letter is null when it
     genuinely cannot be named - a mirror build, or a worldstate that could not
     be read - which the pages say out loud rather than papering over with a
     guess. `published` is the letters DE's table gives this bounty, which is
     not always all three. */
  /* DE publish the letter per tier, in each job's uniqueName, and that beats
     deriving it: the derived answer is one letter for a whole family, and the
     tiers genuinely disagree. Read on 2026-08-24, every Ostron and Solaris tier
     was on C while three of the six Cambion Drift tiers were on A - and one of
     those three publishes only rotations A and B, so the family answer was
     naming it a letter it does not have.

     The family clock stays as the fallback, for a bounty DE did not publish a
     letter for (the Narmer tiers carry no tier at all) and for a build that
     could not reach the worldstate. */
  function liveRotation(node) {
    const g = (BOUNTY && BOUNTY.groups && BOUNTY.groups[node]) || null;
    if (!g) return { letter: null, endsAt: null, published: "" };
    const state = g.letter
      ? walkFrom(g.letter, BOUNTY.windowEnd)
      : familyState(g.family);
    return Object.assign(state, {
      published: g.rotations || "",
      // one bounty in the game runs 3 stages, another 5 - see objectivesOf
      stages: g.stages || null,
    });
  }

  /* When a letter next comes up. The current one runs until endsAt and each one
     after it holds the board for a full cycle, so this is arithmetic on the
     sequence rather than anything the data has to carry. */
  function whenNext(from, endsAt, target) {
    const at = SEQ.indexOf(from), to = SEQ.indexOf(target);
    if (at < 0 || to < 0 || !endsAt) return null;
    return endsAt + (((to - at - 1) % SEQ.length + SEQ.length) % SEQ.length) * CYCLE_MS;
  }

  /* "42 min", "3h 12m" — how long the live letter has left. */
  function untilText(ms) {
    const mins = Math.max(0, Math.round((ms - Date.now()) / 60000));
    return mins < 60 ? mins + " min"
      : Math.floor(mins / 60) + "h " + String(mins % 60).padStart(2, "0") + "m";
  }

  /* The same question over a fortnight rather than an evening. `untilText` is
     built for a fissure and tops out in hours, so Baro's next visit reads as
     "151h 00m" - true, and not how anybody thinks about six days away. */
  function awayText(ms, now) {
    const at = now === undefined ? Date.now() : now;
    const mins = Math.max(0, Math.round((ms - at) / 60000));
    if (mins < 60) return mins + " min";
    const hours = Math.round(mins / 60);
    if (hours < 48) return hours + "h";
    return Math.round(hours / 24) + " days";
  }

  /* A travelling vendor's window, answered against the *page's* clock.
     `{activation, expiry}` ships on the payload rather than a computed yes/no
     because a build is up to ten minutes old and a tab can sit open for hours -
     so an answer frozen at build time is wrong for exactly the two changeovers
     a fortnight that matter. Same rule as the fissure list.

     Absent or unparseable window means `here: false` and nothing said. That is
     the safe direction: it hides items behind a checkbox that is right there,
     where a wrong `true` claims they are buyable today.

     `text` is the half worth having (`TODO.md`, Baro): a live fact stated where
     it is read, rather than a live fact moving items between buckets twice a
     fortnight under a reader who has touched nothing. */
  function traderWindow(w, now) {
    const at = now === undefined ? Date.now() : now;
    const from = w && Date.parse(w.activation), to = w && Date.parse(w.expiry);
    if (!w || !isFinite(from) || !isFinite(to)) return { here: false, text: null };
    if (at >= to) return { here: false, text: null };   // stale window, say nothing
    return at >= from
      ? { here: true, text: "here " + awayText(to, at) + " more" }
      : { here: false, text: "back in " + awayText(from, at) };
  }

  /* The letters of everything on the clock, for spotting a changeover while a
     page is open: same string, nothing has moved.

     Read from the groups rather than the families, because the groups are what
     the rows are scored on and a build can now name their letters without the
     families having been derived at all. Every one of them turns over at the
     same instant, so this changes exactly when the board does. */
  const stamp = () => Object.keys((BOUNTY && BOUNTY.groups) || {})
    .sort().map((g) => liveRotation(g).letter || "?").join("");

  const anyClocked = () =>
    !!(BOUNTY && Object.keys(BOUNTY.groups || {}).length);

  /* A bounty is not costed in rounds at all. One run pays the stages of
     whichever letter the clock has up, so what going now is worth is that
     letter and nothing else - the others are a wait, not a longer run.

     With no letter to name - a mirror build, a worldstate that could not be
     read, or a bounty that publishes two letters while the board is on the
     third - every letter it does publish is as likely as any other, so the run
     is valued at their mean and labelled unknown. Counting all of them, which
     is what the round model did, is the one answer that is certainly wrong. */
  function bountyRun(rot, live, alt) {
    const pays = ["A", "B", "C"].filter((t) => (rot[t] || 0) > 0);
    const flat = rot.none || 0;
    const onTable = !live.published || live.published.indexOf(live.letter) >= 0;
    const letter = live.letter && onTable ? live.letter : null;

    if (letter) {
      const v = rot[letter] || 0;
      const counts = pays.indexOf(letter) >= 0 ? { [letter]: 1 } : null;
      return Object.assign({
        total: v + flat, perRound: v + flat, rounds: null,
        counts,
        stranded: pays.filter((t) => t !== letter),
        planName: null, nonStandard: false,
        bounty: { letter, endsAt: live.endsAt, published: live.published,
                  stages: live.stages || null, offTable: false, unknown: false },
      }, tally(Object.assign({ none: 1 }, counts), alt));
    }
    const mean = pays.length ? pays.reduce((s, t) => s + rot[t], 0) / pays.length : 0;
    /* Nothing is known about which letter is up, so the count and the
       probability follow the value: one roll at the average of the letters this
       bounty does publish. */
    const altMean = alt && Object.assign({}, alt, {
      mean: pays.length
        ? pays.reduce((s, t) => s + Math.min(1, alt[t] || 0), 0) / pays.length : 0,
    });
    return Object.assign({
      total: mean + flat, perRound: mean + flat, rounds: null,
      counts: null, stranded: null, planName: null, nonStandard: false,
      bounty: { letter: null, endsAt: live.endsAt, published: live.published,
                stages: live.stages || null,
                offTable: !!live.letter, unknown: pays.length > 1,
                live: live.letter },
    }, tally({ none: 1, mean: pays.length ? 1 : 0 }, altMean));
  }

  /* ── restarting is not free, and the model used to think it was ───
     A run costs its rounds *and* the getting in and out: matchmaking, two
     loading screens, the walk to extraction. None of that was priced, so a
     plan that left after two rounds and started again looked cheaper than one
     that stayed, and *reset* won everywhere by not being charged for the
     thing it does most.

     Two rounds is the figure, and it is an approximation with a known shape:
     a mission start is a fixed couple of minutes, while a "round" is anything
     from a 45-second Defense wave to a five-minute Survival rotation. So this
     over-charges the long ones and under-charges the short ones. It is kept in
     rounds rather than minutes anyway, deliberately, because a number in
     minutes could only be applied where minutes have been given - and then the
     two pages would disagree about how long a run is the moment somebody typed
     into the effort panel. A choice about how to play a node should be a fact
     about the node.

     The tolerance is the other half of it. Where two ways of running a node
     come out within a couple of per cent, the difference is inside the error
     of this constant, and the tie goes to the one with fewer restarts. */
  const RUN_OVERHEAD = 2;
  const RUN_TIE = 0.02;

  /* ── what one run is worth ────────────────────────────────────────
     `live` is the bounty clock's answer for this node, and null for anything
     that is not a bounty. `isFissure` says whether a Void Fissure is running
     here right now.

     Two choices are made here rather than asked, which is what replaced the
     *How far you run* control:

       * **how far to run.** Every way of playing the node is scored and the
         best rate wins, where the rate is value over rounds-plus-overhead. It
         lands on AABCAA wherever rotation A is what you are there for - four A
         rewards for six rounds beats two for two once restarting costs
         something - and on reset where the value is deeper in the cycle and
         staying only buys rotations you do not want.
       * **whether to stay for the fissure bonus.** Chosen, never compared: the
         free relic for reaching five rotations is value the rate cannot see,
         so a node that is a fissure right now is run to five and that is that.

     Where a mission type offers more than one way to play it, every plan is
     crossed with every run length. Adding a plan can still only ever raise a
     node's score, so ticking the 4-squad box never makes anything look worse. */
  function runValue(rot, mission, squad, live, alt, isFissure) {
    if (live) return bountyRun(rot, live, alt);
    const hasRot = (rot.A || 0) + (rot.B || 0) + (rot.C || 0) > 0;
    let best = { total: 0, counts: null, rounds: null, plan: null, mode: "reset" };
    if (hasRot) {
      const avail = plansFor(mission, squad);
      // a plan flagged onlyChanceAt owns the sole route to that rotation, so
      // when something wanted sits there it is used outright, not compared
      const forced = avail.find((p) => p.onlyChanceAt && (rot[p.onlyChanceAt] || 0) > 0);
      /* The mission-type test that was missing. Without it every mission was
         offered "reset" and "aabcaa" - lengths a Spy or a Railjack cache run
         cannot have - and the optimiser picked whichever scored best, so 28
         Caches nodes were costed at six caches and six Spy nodes at four vaults.

         It drops `bonus` in the same expression, and that half was dormant only
         because the shipped build has no live fissures: a Spy node that is a
         fissure right now was run to FIVE vaults with a free endless-fissure
         relic attached. The free relic is for staying in an endless fissure and
         a Spy mission has nothing to stay in. */
      const fixed = FIXED_LENGTH[mission] || null;
      /* Six rounds is not a plan a random squad can run, and that is a question
         of what is AVAILABLE rather than of what is optimal. The owner's
         correction, 2026-08-27: *"with randoms nobody goes up to 6 rounds. It's
         not a matter of being optimal, it's not a valid choice for non-4man."*
         A public squad extracts; you cannot hold three strangers for a cycle and
         a half by preferring to.

         So `aabcaa` is dropped from the CHOICE before anything is scored — the
         same treatment `plansFor` already gives Disruption's under-defend
         pattern through `squadOnly`, and deliberately NOT the treatment the
         Railjack cache halving gets. That one is a thumb: it changes a number
         and says so on the row. This changes what is on offer, and a plan that
         cannot be executed should never have been on offer.

         Two conditions, both required. `squad` already means "you have an
         organised team" and this is the first time it decides a run *length*
         rather than a rotation pattern, which is a new coupling and is why it
         is spelled out here rather than folded into `squadOnly` — that flag is
         a property of a pattern, and a length is not a pattern.

         `onlyA` is strict: zero wanted value in B and C. A share-of-total
         threshold was considered and not built, because it is a second constant
         nobody has justified and strict is the case the rule was written about.

         Worth knowing what this does NOT touch. A fissure still runs to
         `BONUS_ROTATIONS` = 5 whatever the squad, because the free relic for
         reaching five rotations is value the rate cannot see and that half was
         always right. And `RUN_OVERHEAD` still earns its keep on the shorter
         answers — `reset` on a node that pays out in fewer than four rounds —
         even though it now decides this comparison far less often. */
      const onlyA = (rot.A || 0) > 0 && !(rot.B || 0) && !(rot.C || 0);
      const lengths = squad && onlyA ? ["reset", "aabcaa"] : ["reset"];
      const modes = fixed ? ["fixed"] : (isFissure ? ["bonus"] : lengths);
      const runs = [];
      (forced ? [forced] : avail).forEach((p) => {
        modes.forEach((mode) => {
          const r = scorePlan(rot, mode, p, fixed);
          const rounds = r.rounds || 1;
          runs.push({ r: Object.assign({}, r, { mode }), rounds,
                      rate: r.total / (rounds + RUN_OVERHEAD) });
        });
      });
      const top = Math.max.apply(null, runs.map((x) => x.rate));
      if (top > 0) {
        best = runs.filter((x) => x.rate >= top * (1 - RUN_TIE))
                   .sort((a, b) => b.rounds - a.rounds)[0].r;
      }
    }
    const counts = best.counts;
    const stranded = hasRot
      ? ["A", "B", "C"].filter((t) => (rot[t] || 0) > 0 && !(counts && counts[t]))
      : null;
    return Object.assign({
      total: best.total + (rot.none || 0),
      perRound: best.total / (best.rounds || 1),
      rounds: best.rounds, counts, stranded,
      mode: best.mode,
      planName: best.plan ? best.plan.name : null,
      nonStandard: !!ROT_PATTERN[mission],
    }, tally(Object.assign({ none: 1 }, counts), alt));
  }

  /* ── what a run costs, before anyone puts a number on it ──────────
     Effort is asked for per *objective*, never per run. A run is not a fixed
     size - how far you take an endless mission is your own choice, and the
     "How far you run" option above changes it - while a Defense round, a Spy
     vault and a bounty stage each stay the same thing however long you stay.
     So the unit the player is asked about is the one that holds still.

     Spy and Caches DO need a special case, and this comment asserted the
     opposite until 2026-08-25. Their rotation is indeed the count of vaults
     opened or caches found — but that count is fixed by the mission, and the
     model was choosing it with an optimiser that assumes you may stay longer.
     True of the unit, false of the number. See FIXED_LENGTH below.

     Bounties are not on the round cycle at all, so the model has no round count
     for them - every bounty in the game runs a fixed set of stages, and four is
     only the common shape. DE publish the real number per tier, one entry per
     stage in `standingStages`, and it is 3, 4 or 5: a level 5-15 bounty is
     three stages and a level 40-60 is five. The build reads it and the row
     carries it, so `BOUNTY_STAGES` is now only the fallback for a bounty DE did
     not publish - the Narmer tiers, and anything on a build that could not
     reach the worldstate.

     The heist is the exception, and it is one DE's filing hides. Each
     Profit-Taker phase is a whole activity you replay on its own - that is the
     entire point of the four rows, and the `Old Mate` tooltip says so - but DE
     publish its rewards inside the bounty table, so it arrived here as four
     stages, its rate was divided by four, and it sank accordingly. One phase is
     one run.

     `isHeist` is declared further down this file. Safe: nothing calls this
     during evaluation - the pages call it while rendering, long after. */
  const BOUNTY_STAGES = 4;

  /* ── missions that are not endless, and the letters they pay ──────
     `OBJECTIVE_UNIT` used to live here and renamed the unit while keeping the
     arithmetic: a Spy run was still handed to the endless run-length optimiser,
     which would decide to "stay" for four vaults in a mission that has three.
     This table states the length AND the rotations, because on the live data
     the two cannot be separated — see the Spy note below.

     From `wiki.warframe.com`, checked 2026-08-25:

     * **Spy** — three vaults, and *"reward rotations will be determined only by
       the number of Vaults successfully hacked"*, with vault names explicitly
       not corresponding to rotation. So 1/2/3 pays A/B/C, not the AABC cycle's
       A/A/B. The wiki also files Spy under Standard rather than Endless, which
       is the same split this table is drawing.

       That mapping is load-bearing. Six live nodes — Pago, Bode, Valac,
       Aegaeon, Amalthea and Dione — publish rotation **C only**. Capping the
       length while the letters stayed A,A,B would have deleted the only
       rotation they pay from, which is why this change waited for the wiki
       rather than shipping the cap on its own.

     * **Caches** — a Railjack mission pays *two* cache rewards, not three: the
       first for completing a Point of Interest (rotation A), the second for
       hacking an Abandoned Derelict Cache (rotation B), from separate tables
       rolled independently. Not a cycle. Our own data agrees exactly: all 38
       live Caches nodes are Proxima and the 28 rotation-bearing ones publish
       precisely A and B. The other 10 are Earth and Saturn Proxima, which carry
       no rotation at all, never reach this table, and stay at "one run".

     * **Special** — the bucket holding Void Storms and Faceoff. Faceoff pays
       *"one each of rotation A and rotation B"* at the end of a match, win or
       lose, so it is one run paying two rewards. Void Storms carry no rotation,
       so they never reach the `fixed` branch and the unit here reads correctly
       for them anyway.

     `pays` is a list rather than a set on purpose: it is the multiset of reward
     draws, so a mission paying the same rotation twice would say so. `count` is
     what the PLAYER does — vaults, caches, one match — which is not always the
     number of rewards, exactly as `PER_REWARD` handles for Onslaught. */
  const FIXED_LENGTH = {
    Spy:     { count: 3, unit: "vault", pays: ["A", "B", "C"] },
    Caches:  { count: 2, unit: "cache", pays: ["A", "B"] },
    Special: { count: 1, unit: "run",   pays: ["A", "B"] },
  };

  /* ── how many player objectives buy one reward: nothing, now ──────
     **Empty on purpose since 2026-08-27, and the emptiness is the decision.**

     It held one entry, `{"Sanctuary Onslaught": {count: 2, unit: "zone"}}`,
     because the wiki gives Onslaught a reward per two zones and a six-reward run
     is twelve zones. That was filed as a defect and fixed the day it was found —
     and the sweep that followed showed it was the only mode ever charged that
     way, while Defense pays per three waves, Survival per five minutes, Void
     Cascade per four Exolizers, Void Flood and Void Armageddon per three, and
     Defection per two. All six were charged one, and Onslaught two. The model's
     unit did not mean the same thing on any two rows.

     The owner settled it on 2026-08-27: **an objective is the thing that pays a
     reward.** That is what the effort tooltip had always said it was, it is what
     81 of the 236 live places were already costed as, and it makes the unit the
     same everywhere for the first time. So the six stay at one — they were never
     wrong — and Onslaught comes back to one with them. Its rate doubles and it
     moves up the ranking, which is the reversal being chosen rather than a
     regression: `d8b4484` corrected Onslaught's price under the other reading,
     and this is the other reading being retired.

     Kept as an empty table rather than deleted, because it is the seam where a
     genuine exception would go: a mode that pays a reward for something other
     than completing its own objective once. None exists today.

     **The rejected reading, so it is not re-proposed.** Charging the
     player-visible sub-unit — a wave, a dig, a zone — is more faithful to effort
     and was declined for two reasons. Survival has no countable atom at all: its
     criterion is five *minutes*, so it would need its own answer whatever the
     other five got. And a wave is not comparable to a dig anyway, so the cross-
     mission division that *per objective* performs would still be a guess, only
     a more elaborate one. Effort that is really comparable is measured in
     minutes, and *per minute* already does that as soon as anyone gives weights. */
  const PER_REWARD = {};

  function objectivesOf(n) {
    if (isHeist(n)) return { count: 1, unit: "run" };
    if (n.bounty) return { count: n.bounty.stages || BOUNTY_STAGES, unit: "stage" };
    /* Before the `n.rounds` test, not after it: `rounds` counts reward draws
       and these missions pay a different number of them than the player
       performs objectives — two rewards in one Faceoff match, three vaults for
       three.

       Conditioned on the node actually paying by rotation, which is what
       separates the two halves of `Caches`. The 28 Proxima nodes that publish A
       and B are two caches. The 10 Earth and Saturn Proxima nodes publish no
       rotation at all — the wiki gives those regions a single undifferentiated
       cache table — so they are not two of anything and stay at "one run".
       Costing them as two caches was this change's own first regression. */
    const fixed = FIXED_LENGTH[n.mode];
    if (fixed && n.counts && Object.keys(n.counts).length) {
      return { count: fixed.count, unit: fixed.unit };
    }
    if (n.rounds) {
      const per = PER_REWARD[n.mode];
      if (per) return { count: n.rounds * per.count, unit: per.unit };
      return { count: n.rounds, unit: "round" };
    }
    return { count: 1, unit: "run" };
  }

  /* How a run's cost READS: "4 rounds", "3 vaults", "12 zones", "one run".

     Shared because the two pages must name a cost the same way, and they stopped
     doing so the moment Faceoff became a one-run mission: the planner said "one
     run" and the collection page, building the string inline, said "1 run". The
     phrasing lives here now so there is one of it. */
  function objectivesText(n) {
    const o = objectivesOf(n);
    return o.count === 1 && o.unit === "run"
      ? "one run"
      : o.count + " " + o.unit + (o.count === 1 ? "" : "s");
  }

  /* ── nodes that are the same choice ───────────────────────────────
     Digital Extremes do not write a relic table per node. They write one per
     tier and rotation shape and hang it on every node that fits, so eight
     low-level Lith Defense nodes are one bet listed eight times - and a list
     showing the best eight places can spend all eight rows on a single choice.

     Two nodes fold together only when the relic table AND the mission type
     match. Identical tables across *different* modes happen a lot (Survival and
     Excavation share several) and those are the same reward from a different
     activity, which is a choice worth keeping rather than a duplicate worth
     hiding.

     `signature` is deliberately built from what the planner scored, not from
     the raw drop table: two nodes are the same choice when what you would get
     for going there is the same, which is a statement about this plan. */
  function signature(n) {
    return n.mode + "|" + Array.from(n.relics.entries())
      .map(([name, v]) => name + ":" + v.chance + "@" + (v.rotation || "-"))
      .sort().join(",");
  }

  /* Which of a group of identical nodes to actually name. The same tie-breaks
     the ranking already uses, in the same order, so the pick agrees with what
     the list would have done if these had stayed separate rows: Aya first,
     then the lowest enemy level, then the name so it never wobbles.

     `first` goes ahead of all of them, and the planner passes "is this one a
     fissure right now". Among nodes that are provably the same bet, one of them
     being a fissure is not a preference, it is a free relic — and it cannot
     distort anything, because the alternatives were already established to be
     worth exactly the same. Left out, the fold would name a node that is
     identical in every way except the one that matters today. */
  function pickNode(group, first) {
    const ahead = first ? (n) => (first(n) ? 0 : 1) : () => 0;
    return group.slice().sort((a, b) =>
      ahead(a) - ahead(b) ||
      (b.aya || 0) - (a.aya || 0) ||
      (a.lvl ? a.lvl[0] : Infinity) - (b.lvl ? b.lvl[0] : Infinity) ||
      (a.node || "").localeCompare(b.node || "")
    )[0];
  }

  /* ── is this node a fissure right now ─────────────────────────────
     The build ships the fissures that were running when it ran, each with the
     moment it closes. This filters that list against the clock instead of
     trusting it, so a page opened hours later reports fewer fissures than are
     really up and never one that has gone. Wrong by omission only, which is the
     safe direction: it can fail to mention a fissure, but it cannot send anyone
     to a node that stopped being one two hours ago.

     Asked per node, not per tier, because the useful question here is not "where
     can I crack a Lith" — the navigation console answers that — but "is this
     place, which I already have a reason to run, also a fissure". Longest
     remaining first, since that is the one worth naming.

     Void Storms are Railjack, so they answer to the same switch everything else
     Railjack does rather than appearing on a page that has it turned off. */
  function fissuresAt(list, node, now, allowStorm) {
    return (list || [])
      .filter((f) => f.node === node && (allowStorm || !f.storm) &&
                     Date.parse(f.ends) > now)
      .sort((a, b) => Date.parse(b.ends) - Date.parse(a.ends));
  }

  /* Whole minutes left, floored, so a chip never claims more time than there
     is. Zero is a real answer and means "closing now", not "no fissure". */
  function minutesLeft(fissure, now) {
    return Math.max(0, Math.floor((Date.parse(fissure.ends) - now) / 60000));
  }

  /* ── which sources count at all ───────────────────────────────────
     Railjack nodes need a crewed ship and a different star chart, so they are
     opt-in; they are never hidden from the collection view, since some live
     relics drop nowhere else. */
  const RAILJACK_NODES = new Set([
    "Bendar Cluster", "Iota Temple", "Korm's Belt", "Ogal Cluster", "Sover Strait",
    "Arva Vector", "Brom Cluster", "Enkidu Ice Drifts", "Mammon's Prospect",
    "Nu-Gua Mines", "Sovereign Grasp", "Fenton's Field", "Khufu Envoy",
    "Obol Crossing", "Peregrine Axis", "Profit Margin", "Seven Sirens",
    "Kasio's Rest", "Lupal Pass", "Mordo Cluster", "Nodo Gap", "Vand Cluster",
    "Beacon Shield Ring", "Bifrost Echo", "Falling Glory", "Luckless Expanse",
    "Orvin-Haarc", "Vesper Strait",
  ]);
  const isRailjack = (s) =>
    RAILJACK_NODES.has(s.node) || /Proxima/i.test(s.planet || "");

  /* ── the one deliberate thumb on the scale ────────────────────────
     A Railjack `Caches` run pays two cache rewards - one for a Point of
     Interest, one for an Abandoned Derelict Cache - and it is the worst
     relics-per-run in the whole list. Nobody runs Railjack for them: you run a
     Skirmish and open what you pass. Ranking them beside ordinary star-chart
     nodes puts them somewhere they do not belong, which the owner put more
     bluntly: "caches on a Railjack is insanely out-of-order and out-of-place".

     **Re-derived when the length was corrected, 2026-08-25, and it stays at
     0.5.** The worry was that costing a run at two caches instead of six would
     inflate these rows past what the halving could hold. Measured over the live
     build it did not: the rates move by -4% to +6% depending on how a node
     splits between rotation A and B, and because everything around them rose
     more, the best Caches node fell from #144 to **#160 of 234**. Unpenalised it
     would sit at #78, so the constant is still doing the work it was written
     for, and doing slightly less of it than before - which is what `TODO.md`
     predicted.

     So they are halved. This is a judgement, not a measurement, and it is the
     only one of its kind in the model - everything else here is arithmetic on
     DE's published numbers. It is written as one named constant in one place so
     it can be argued with, and the row says out loud that it has been applied.

     What it does NOT touch is the relic count and drop chance on the same row.
     What a run hands you is a fact; this is only what we think it is worth
     going for, and a fact that moved to suit an opinion would be a lie.

     All 38 live Caches nodes are Railjack today, so the mode alone would do -
     the Railjack test is kept anyway, because a Caches mode somewhere else
     would not have earned this. */
  const CACHE_PENALTY = 0.5;
  const isRailjackCache = (s) => s.mode === "Caches" && isRailjack(s);

  /* What a node asks of you before you can play it at all. Neither is a
     drawback in the ranking - both are perfectly good farms - but a node named
     "Arva Vector" gives no hint that it needs a ship and a crew, and one named
     "Vehrvod District" none that you will be matched against other players.
     Say so on the row rather than leaving it to be discovered in the mission. */
  const DEMANDS = {
    railjack: { label: "Railjack", tip: [
      "Needs a Railjack, and a crew or an AI crew.",
      "Its own star chart, reached from your Drydock.",
    ].join("\n") },
    pvpve: { label: "PvPvE", tip: [
      "Faceoff is player versus player versus environment: you are",
      "matched against another squad while both fight the map.",
      "",
      "Vehrvod District is squad versus squad; Lower Vehrvod is",
      "against AI-controlled Tenno.",
    ].join("\n") },
    heist: { label: "Old Mate", tip: [
      "The Profit-Taker heist, from Eudico's backroom in Fortuna -",
      "not the bounty board, and not on the bounty clock.",
      "",
      "Needs Solaris United Rank 5 (Old Mate), and the four phases",
      "run in sequence once. After that any phase can be replayed",
      "on its own, which is why they are ranked as four places.",
    ].join("\n") },
    steel: { label: "Steel Path", tip: [
      "On the Steel Path, which is a second star chart unlocked",
      "by clearing the first one. Until then the node is not on",
      "your chart at all.",
    ].join("\n") },
  };
  // DE files all four Faceoff tables under transientRewards, so the node
  // name is the only signal: "Faceoff: Single Squad", "Faceoff: Squad VS
  // Squad", each with a Steel Path variant.
  const isPvPvE = (s) => /^Faceoff\b/i.test(s.node || "");

  /* The Steel Path is a whole second star chart, unlocked once by clearing the
     first one. A node behind it is not harder-but-reachable; it does not exist
     on your chart until then, which is the same shape as an event node.

     Two ways to be behind it. DE names most of them - "(Steel Path)", and
     "(Steel Path Winner)" on one Faceoff table. The level 100-100 bounty tier
     is not named but is gated all the same: the wiki's Bounty page gives it
     "Requires Mastery Rank 10 and unlock The Steel Path". No 100-100 tier
     carries a relic today, so that half of the rule is written for the day one
     does rather than for anything currently on screen. */
  const isSteelPath = (s) =>
    /\(Steel Path\b[^)]*\)/i.test(s.node || "") ||
    /^Level\s+100\s*-\s*100\b/i.test(s.node || "");

  /* The Profit-Taker heist. Named rather than inferred: it is the only content
     in the data reached from a syndicate's back room instead of from a mission
     node or a bounty board, and DE gives it no marker of its own. A sweep of
     every bounty, key, enemy and transient source found nothing else shaped
     like it (`TODO.md`), so a list of one is honest and a general rule would be
     a rule about a single case. */
  const isHeist = (s) => /PROFIT-TAKER/i.test(s.node || "");

  /* An enemy is not a place you can go.
     DE files relic-dropping enemies in their own section, and there is exactly
     one in the whole table: the Hemocyte, which spawns four to a run in the
     final stage of the Plague Star bounty. That makes it a *second row for a
     trip already listed* - the Plague Star bounty is the other one - rather
     than somewhere else to be.

     Keyed on the kind rather than the name, so a second relic-dropping enemy
     would be caught too. The tip names the event when the build knows it, which
     is the only thing that makes such a row reachable at all. */
  function enemyDemand(s) {
    const ev = String(s.access || "").indexOf("event:") === 0
      ? String(s.access).slice(6) : null;
    return { label: "Enemy", tip: [
      "An enemy, not a destination. You do not travel here - it",
      "spawns where it spawns, and the relics come off its body.",
      ev ? "" : null,
      ev ? "That is the final stage of " + ev + ", four of them per" : null,
      ev ? "run, so this row and the " + ev + " row are one trip" : null,
      ev ? "counted from two tables DE publishes separately." : null,
    ].filter((l) => l !== null).join("\n") };
  }

  function demandsOf(s) {
    const out = [];
    if (isRailjack(s)) out.push(DEMANDS.railjack);
    if (isPvPvE(s)) out.push(DEMANDS.pvpve);
    if (isHeist(s)) out.push(DEMANDS.heist);
    if (s.kind === "enemy") out.push(enemyDemand(s));
    if (isSteelPath(s)) out.push(DEMANDS.steel);
    return out;
  }

  /* Bounties that only exist while an event is running: the two Ghoul tiers and
     Plague Star. The build records the window rather than a yes/no, so a
     week-old build still knows a purge ends tomorrow. */
  const bountyEvent = (s) =>
    (s.kind === "bounty" && BOUNTY && (BOUNTY.events || {})[s.node]) || null;

  function eventRunning(e) {
    if (!e || !e.expiry) return false;
    const now = Date.now();
    return new Date(e.expiry).getTime() > now &&
      (!e.activation || new Date(e.activation).getTime() <= now);
  }

  /* The build tags anything that is not a place you can decide to go today.
     `quest` is a one-time story mission, `unmodelled` is content whose shape the
     model cannot yet express, and `event:X` rides X's live window. */
  function eventWindow(name) {
    const evs = (BOUNTY && BOUNTY.events) || {};
    return Object.keys(evs).map((k) => evs[k]).find((e) => e.event === name) || null;
  }

  /* Never a destination, whatever the options say. A quest mission cannot be
     ground and an unmodelled one would be ranked on a guess - neither becomes
     reachable by ticking a box, so neither gets one. */
  const notADestination = (s) =>
    s.access === "quest" || s.access === "unmodelled";

  /* Can this source be reached, given the switches the reader has set?

     One predicate because there used to be two, and they disagreed. The planner's
     node loop applied all three tests while the *Still needed* panel counted on
     `!vaulted` alone — so the panel said "3 relics dropping" against a part with
     two reachable routes, and the third was behind a checkbox the reader had
     turned off. Live on three Lex Prime parts when it was found.

     `opts` is the planner's options object; a missing one means no opt-ins, which
     is what both pages default to. */
  const reachableSource = (s, opts) =>
    !notADestination(s) &&
    ((opts && opts.railjack) || !isRailjack(s)) &&
    ((opts && opts.event) || !isEventNode(s));

  /* ── the Primes you cannot get without a ship ─────────────────────
     Six items are marked "Never Vaulted" by the wiki and vaulted by Digital
     Extremes at the same time, and both are true: Cernos, Hikou, Nyx, Scindo,
     Valkyr and Venka Prime left the ordinary drop tables, and their relics went
     into Railjack rather than into the vault. So they never become
     unobtainable, which is what the wiki marker means - but telling someone
     without a Railjack that its relics "keep dropping indefinitely" is not a
     useful thing to have said.

     Read off the drop table rather than off that pair of markers, so it
     corrects itself if DE ever moves one of those relics back to the star
     chart. Same reason `flags.farmable` is computed instead of parsed.

     A relic with nowhere reachable to farm it - quest-only, or a shape the model
     cannot express - is skipped rather than counted against this. It is not an
     alternative to Railjack; it is not an alternative to anything. And an item
     with no reachable route at all is not Railjack-only, it is simply vaulted. */
  function railjackOnly(item, relics) {
    const routes = (item.relics || [])
      .filter((r) => relics[r] && !relics[r].vaulted)
      .map((r) => (relics[r].sources || []).filter((s) => !notADestination(s)))
      .filter((from) => from.length);
    return routes.length > 0 && routes.every((from) => from.every(isRailjack));
  }

  /* DE's drop table lists event nodes permanently but never says which event
     they belong to, and the node only exists in the game while that event is
     running. Recommending one you cannot reach is worse than leaving it out, so
     they are excluded by default and can be switched back on.

     The limited-time bounties are the same problem with an answer: the
     worldstate does say whether they are running, so they are excluded only
     while they are not. An event *enemy* - the Hemocyte, which spawns only in
     the final stage of Plague Star - rides exactly the same window. */
  const isEventNode = (s) => /^Event:/i.test(s.planet || "") ||
    !!(bountyEvent(s) && !eventRunning(bountyEvent(s))) ||
    !!(String(s.access || "").indexOf("event:") === 0 &&
       !eventRunning(eventWindow(String(s.access).slice(6))));

  /* Guard against the mistake that started all of this: a mission type quietly
     getting the wrong rotation. Everything not named in ROT_PATTERN is assumed
     to run A->A->B->C, and the bug was invisible precisely because nothing ever
     said what was being assumed. So say it, once per load, in the console.

     Bounties are left out: they are not on the round cycle at all, and listing
     them here as "assumed AABC" was itself an instance of the mistake. */
  function assertCoverage() {
    const seen = new Set();
    Object.values(DATA.relics || {}).forEach((r) =>
      (r.sources || []).forEach((s) => {
        if (s.mode && s.kind !== "bounty") seen.add(s.mode);
      }));
    const odd = Object.keys(ROT_PATTERN).filter((m) => seen.has(m));
    const fixed = Object.keys(FIXED_LENGTH).filter((m) => seen.has(m)).sort();
    /* Fixed-length types are no longer assumed anything: their length and their
       letters are both stated, from the wiki. Leaving them in the assumed line
       would be the very mistake this function exists to make visible. */
    const aabc = Array.from(seen)
      .filter((m) => !ROT_PATTERN[m] && !FIXED_LENGTH[m]).sort();
    console.info("[prime-hunter] rotation model: " + seen.size + " mission types in the data");
    console.info("  non-standard : " + (odd.length ? odd.join(", ") : "(none)"));
    console.info("  fixed length : " + (fixed.length
      ? fixed.map((m) => m + " (" + FIXED_LENGTH[m].count + " " +
          FIXED_LENGTH[m].unit + ", pays " + FIXED_LENGTH[m].pays.join("+") + ")").join(", ")
      : "(none)"));
    console.info("  assumed AABC : " + aabc.join(", "));
    Object.keys(ROT_PATTERN).forEach((m) => {
      if (!seen.has(m)) {
        console.warn("[prime-hunter] ROT_PATTERN names '" + m + "' but no source uses it");
      }
    });
  }
  assertCoverage();

  window.WFPrimeRotation = {
    RUN_MODES, RUN_OVERHEAD, ROT_PATTERN, runValue, objectivesOf, objectivesText,
    /* Exported so a test can assert it is EMPTY. That is the decision of
       2026-08-27 rather than an oversight, and an entry appearing here without
       one behind it is what the assertion is for. */
    perReward: PER_REWARD,
    bonusRotations: BONUS_ROTATIONS,
    liveRotation, familyState, whenNext, untilText, awayText, traderWindow,
    stamp, anyClocked,
    cycleMinutes: CYCLE_MINUTES, sequence: SEQ,
    signature, pickNode,
    fissuresAt, minutesLeft,
    isRailjack, isPvPvE, isSteelPath, isHeist, demandsOf, railjackOnly,
    isRailjackCache, cachePenalty: CACHE_PENALTY,
    isEventNode, notADestination, reachableSource,
    bountyEvent, eventRunning,
  };
})();
