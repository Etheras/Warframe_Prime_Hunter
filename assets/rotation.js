/* VorFrame — the rotation model, shared by both pages.

   What a node is worth depends on what one run there actually hands you, and
   that is not the same question everywhere:

     * an endless mission pays one reward per round, cycling A -> A -> B -> C
     * Disruption pays by round *and* by how well you played it
     * a bounty pays one rotation, chosen by the clock rather than by you

   All three used to live twice, once in each page, kept in step by hand. They
   drifted - the collection view told you to stay for the 4th reward at a
   bounty, where there is no 4th reward - so the model now lives here and both
   pages read it. Nothing in this file touches the DOM or the store; it is
   arithmetic over `window.VORFRAME_DATA` and the clock.

   Loaded before app.js and plan.js, after data/vorframe-data.js.            */
(function () {
  "use strict";

  const DATA = window.VORFRAME_DATA || {};

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
  const RUN_MODES = ["reset", "full", "aabcaa", "bonus"];
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

  function scorePlan(rot, runMode, p) {
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

  /* Where one family's clock has got to, now. */
  function familyState(name) {
    const fam = (BOUNTY && (BOUNTY.families || {})[name]) || null;
    const end = fam && fam.windowEnd ? new Date(fam.windowEnd).getTime() : NaN;
    const at = SEQ.indexOf(fam ? fam.letter : "");
    if (!isFinite(end) || at < 0) return { letter: null, endsAt: null };
    const now = Date.now();
    const steps = now < end ? 0 : Math.floor((now - end) / CYCLE_MS) + 1;
    return { letter: SEQ[(at + steps) % SEQ.length],
             endsAt: end + steps * CYCLE_MS };
  }

  /* {letter, endsAt, published} for a bounty node. letter is null when it
     genuinely cannot be named - a mirror build, or a worldstate that could not
     be read - which the pages say out loud rather than papering over with a
     guess. `published` is the letters DE's table gives this bounty, which is
     not always all three. */
  function liveRotation(node) {
    const g = (BOUNTY && BOUNTY.groups && BOUNTY.groups[node]) || null;
    if (!g) return { letter: null, endsAt: null, published: "" };
    return Object.assign(familyState(g.family), { published: g.rotations || "" });
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

  /* The letters of every family, for spotting a changeover while a page is
     open: same string, nothing has moved. */
  const stamp = () => Object.keys((BOUNTY && BOUNTY.families) || {})
    .sort().map((f) => familyState(f).letter || "?").join("");

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
                  offTable: false, unknown: false },
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
                offTable: !!live.letter, unknown: pays.length > 1,
                live: live.letter },
    }, tally({ none: 1, mean: pays.length ? 1 : 0 }, altMean));
  }

  /* ── what one run is worth ────────────────────────────────────────
     `live` is the bounty clock's answer for this node, and null for anything
     that is not a bounty. Where a mission type offers more than one way to play
     it, take whichever banks more: adding a plan can therefore only ever raise
     a node's score, so ticking the 4-squad box never makes anything look
     worse. */
  function runValue(rot, runMode, mission, squad, live, alt) {
    if (live) return bountyRun(rot, live, alt);
    const hasRot = (rot.A || 0) + (rot.B || 0) + (rot.C || 0) > 0;
    let best = { total: 0, counts: null, rounds: null, plan: null };
    if (hasRot) {
      const avail = plansFor(mission, squad);
      // a plan flagged onlyChanceAt owns the sole route to that rotation, so
      // when something wanted sits there it is used outright, not compared
      const forced = avail.find((p) => p.onlyChanceAt && (rot[p.onlyChanceAt] || 0) > 0);
      (forced ? [forced] : avail).forEach((p) => {
        const r = scorePlan(rot, runMode, p);
        if (!best.plan || r.total > best.total + 1e-12) best = r;
      });
    }
    const counts = best.counts;
    const stranded = hasRot
      ? ["A", "B", "C"].filter((t) => (rot[t] || 0) > 0 && !(counts && counts[t]))
      : null;
    return Object.assign({
      total: best.total + (rot.none || 0),
      perRound: best.total / (best.rounds || 1),
      rounds: best.rounds, counts, stranded,
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

     Spy and Caches need no special case: their rotation *is* the count of
     vaults opened or caches found, so the rounds the model already picked are
     the objectives. Only the word for them differs.

     Bounties are not on the round cycle at all, so the model has no round count
     for them - every bounty in the game runs a fixed set of stages, and four is
     the common shape. */
  const BOUNTY_STAGES = 4;
  const OBJECTIVE_UNIT = { Spy: "vault", Caches: "cache" };
  function objectivesOf(n) {
    if (n.bounty) return { count: BOUNTY_STAGES, unit: "stage" };
    if (n.rounds) return { count: n.rounds, unit: OBJECTIVE_UNIT[n.mode] || "round" };
    return { count: 1, unit: "run" };
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
     A Railjack `Caches` run is three hidden caches inside a boarded base, and
     it is the worst relics-per-run in the whole list. Nobody runs Railjack for
     them - you run a Skirmish and open what you pass. Ranking them beside
     ordinary star-chart nodes puts them somewhere they do not belong, which the
     owner put more bluntly: "caches on a Railjack is insanely out-of-order and
     out-of-place".

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
    const aabc = Array.from(seen).filter((m) => !ROT_PATTERN[m]).sort();
    console.info("[VorFrame] rotation model: " + seen.size + " mission types in the data");
    console.info("  non-standard : " + (odd.length ? odd.join(", ") : "(none)"));
    console.info("  assumed AABC : " + aabc.join(", "));
    Object.keys(ROT_PATTERN).forEach((m) => {
      if (!seen.has(m)) {
        console.warn("[VorFrame] ROT_PATTERN names '" + m + "' but no source uses it");
      }
    });
  }
  assertCoverage();

  window.VorFrameRotation = {
    RUN_MODES, ROT_PATTERN, runValue, objectivesOf,
    bonusRotations: BONUS_ROTATIONS,
    liveRotation, familyState, whenNext, untilText, stamp, anyClocked,
    cycleMinutes: CYCLE_MINUTES, sequence: SEQ,
    isRailjack, isPvPvE, isSteelPath, isHeist, demandsOf, railjackOnly,
    isRailjackCache, cachePenalty: CACHE_PENALTY,
    isEventNode, notADestination,
    bountyEvent, eventRunning,
  };
})();
