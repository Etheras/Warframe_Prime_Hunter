/* Warframe Prime Hunter — the data model, with no DOM in it.

   What a relic opening is worth, which refinement to take it to, what state an
   item is in, and how to read a backup file. None of it touches the page, and
   all of it decides something a person acts on — which relic to crack, which
   Prime is still gettable, whether your saved progress comes back intact.

   It lives here for two reasons. Both pages had their own copy of most of it,
   worded differently enough to hide the fact; and while it sat inside click
   handlers and render functions there was no way to test any of it without
   driving a browser. Now there is.

   Loaded after shared.js, whose squad odds it uses, and before the pages.   */
(function () {
  "use strict";

  const S = window.WFPrimeShared;
  const REFINEMENTS = ["Intact", "Exceptional", "Flawless", "Radiant"];

  /* How many of a part one item needs. Ivara Prime wants two of some, and a
     backup claiming three must be clamped rather than believed — nor is the
     payload's own `itemCount` obliged to be a number, so it goes through the
     same `count` the store uses rather than a second copy of the rule. */
  const needOf = (part) => S.count(part && part.itemCount, 1) || 1;

  /* ── what a reward is, and what it is worth ──────────────────────
     Rarity comes from the unrefined chance rather than from DE's own rarity
     words, which are relative to the table they sit in and shift with
     refinement - the same rule tools/official.py applies, so the two agree. */
  function rarityOf(chances) {
    const i = chances && chances.Intact;
    if (i == null) return "";
    return i >= 20 ? "Common" : i >= 6 ? "Uncommon" : "Rare";
  }

  const TRACE_COST = { Intact: 0, Exceptional: 25, Flawless: 50, Radiant: 100 };

  /* Which end to take a relic to for ONE part. The odds move monotonically with
     refinement, so for a single target the answer is always one of the two
     ends; the middle steps are a cheaper compromise, never a better one. */
  function refineAdvice(chances) {
    if (!chances) return null;
    const intact = chances.Intact, rad = chances.Radiant;
    if (intact == null || rad == null || !intact) return null;
    return rad <= intact ? { cls: "intact", label: "Intact" }
                         : { cls: "radiant", label: "Radiant" };
  }

  const odds = (pct, squad) =>
    (squad ? S.squadOdds((pct || 0) / 100) : (pct || 0) / 100);

  /* What one opening of this relic is worth at a given refinement: the chance a
     reward yields something still wanted. A drop of qty is only worth what you
     still need of it, so a 2x Forma is not worth double when you need one. */
  function relicValue(entries, refinement, squad) {
    let total = 0;
    (entries || []).forEach((e) => {
      const pct = e.chances ? e.chances[refinement] : null;
      if (pct == null) return;
      total += odds(pct, squad) * Math.min(e.qty, e.stillNeed);
    });
    return total;
  }

  /* Which refinement to take a relic to, over EVERYTHING wanted from it.

     Chosen by bottleneck, not by hit rate. Maximising the chance of getting
     anything wanted is the wrong objective when relics are finite: a common's
     25.33% drowns out a rare you are actually blocked on, and the advice comes
     back Intact while the rare sits at 2%. What matters is how long it takes to
     get everything out of the relic, which its scarcest reward decides. So this
     minimises the expected openings for the worst-off wanted reward, and breaks
     ties on total hit rate.

     Forma never sets the bottleneck - you are not blocked on it - but it still
     counts towards the tie-break. That is what `bonus` marks. */
  function bestRefinement(entries, opts) {
    const settings = opts || {};
    const order = settings.refinements || REFINEMENTS;
    const squad = !!settings.squad;

    let best = order[0], bestCost = Infinity, bestTotal = -1, bestBlocker = null;
    order.forEach((f) => {
      let worst = 0, total = 0, blocker = null, reachable = 0;
      (entries || []).forEach((e) => {
        const pct = e.chances ? e.chances[f] : null;
        if (pct == null) return;
        const p = odds(pct, squad);
        total += p * Math.min(e.qty, e.stillNeed);
        if (e.bonus) return;
        reachable += 1;
        const openings = Math.ceil(e.stillNeed / (e.qty || 1));
        const cost = p > 0 ? openings / p : Infinity;
        if (cost > worst) { worst = cost; blocker = e; }
      });
      /* A refinement that offers none of the wanted rewards has a bottleneck of
         zero, which is the best score there is - so it would win, and the advice
         would be to take the relic somewhere that pays you nothing. Nothing
         reachable means it cannot clear the bottleneck at all.

         Latent rather than live: every gap in the current data is a wholly
         empty chance map, which contributes at no refinement and so cannot
         produce this. One partial map upstream would. */
      const cost = reachable ? worst : Infinity;
      const better = cost < bestCost - 1e-9 ||
        (Math.abs(cost - bestCost) < 1e-9 && total > bestTotal);
      if (better) { best = f; bestCost = cost; bestTotal = total; bestBlocker = blocker; }
    });
    // the node ranking means "chance a reward drop yields something wanted",
    // measured at the refinement actually chosen above
    return { refinement: best, value: relicValue(entries, best, squad),
             openings: bestCost, blocker: bestBlocker };
  }

  /* ── a relic handed over already Radiant ─────────────────────────
     Eleven nodes do it — Elite Sanctuary Onslaught, the six Void Storms and the
     four Profit-Taker phases — and DE name the refinement on those reward rows
     and on no others.

     **Worth more than the same relic off the star chart, and the model has to
     say so.** Two attempts got this wrong before this one, both by trying to
     price the traces:

       * `traces` was `cost(given) − cost(chosen)`, how far the node *overshoots*
         the refinement the plan picked. Every one of the eleven gives Radiant
         and `bestRefinement` picks Radiant for all 34 live relics, so it was
         `100 − 100 = 0` everywhere and the bonus was multiplied by zero.
       * A per-trace exchange rate derived from the plan then priced a trace at
         the uplift it could buy — near zero for the same reason, and negative
         on three relics.

     Both were answering *"what are the traces worth?"* when the planner's job is
     *"where should I go?"*. The owner's ruling, 2026-08-25: traces are almost
     always tight, the planner should not talk anyone into a lower-efficiency
     crack to save them, and a source that hands the relic over Radiant simply
     gets **a flat 25% on the relic's value**. Point the player at Radiant and
     they will find the traces.

     A judgement, not a measurement — the second one in the model, beside
     `CACHE_PENALTY`, and written as one named constant in one place so it can be
     argued with. It is deliberately blunt: no trace count, no exchange rate, no
     dependence on what else is in the plan. The two things that made the
     previous attempts collapse to zero were both *derived* quantities. */
  const RADIANT_BONUS = 0.25;

  /* What one reward drop at a given source is worth to this plan.

     Ordinarily the relic's value at the refinement the plan chose. Where DE
     hand it over already refined the honest figure is its value at the
     refinement you were actually *given*, which cuts both ways: wanted Radiant
     anyway is a straight gain, but wanted Intact and given Radiant means the
     common you were chasing has gone from 25.33% to 16.67%, and this copy is
     worth less to this plan than one off the star chart.

     `bonus` FLAGS the uplift rather than applying it, and that is deliberate.
     The obvious thing is to multiply `value` here, and it does not work: the
     ranked number is `perRun`, a count of wanted relics taken from the plain
     drop chances, and `value` never reaches it — so a bonus applied here moves
     the tooltip and leaves the order untouched. Measured at +0.0% on all eleven
     nodes before this was moved.

     So the uplift is applied where `CACHE_PENALTY` is applied, as a multiplier
     on the node's score and rate, and `plan.js` weights it by how much of the
     node's value actually arrived pre-refined. Inflating the counts instead
     would have been the other option and is worse: `cnt` feeds *"% of runs that
     drop at least one"*, which is a probability, and multiplying it by 1.25
     makes that figure wrong rather than generous.

     `traces` is what the node saves you — the part of the plan's own refinement
     bill it picks up, `min(given, chosen)`, NOT the amount it overshoots by.
     That distinction is the first bug above, and it is why the row's "saving N
     Void Traces" clause had never once printed. */
  function sourceValue(s, rp, opts) {
    const given = s && s.refinement;
    if (!given || !rp || !rp.byRefinement || rp.byRefinement[given] == null) {
      return { value: rp ? rp.value : 0, pre: false, traces: 0, bonus: false };
    }
    return {
      value: rp.byRefinement[given],
      pre: true,
      bonus: !!(opts && opts.traces) && given === "Radiant",
      traces: Math.min(TRACE_COST[given] || 0, TRACE_COST[rp.refinement] || 0),
    };
  }

  /* The multiplier a node earns for handing relics over Radiant, weighted by
     how much of what you want there actually arrives that way. All eleven live
     pre-refined nodes are wholly Radiant, so `share` is 1 and this is a flat
     1.25 — the weighting is for the day one of them is mixed, where a quarter
     bonus on the three-quarters that arrive ordinary would be a lie. */
  const radiantMultiplier = (share) => 1 + RADIANT_BONUS * Math.min(1, Math.max(0, share || 0));

  /* ── which bucket an item is in ──────────────────────────────────
     Order matters and is not alphabetical. Founder first because it can never
     come back; Resurgence next because it is the one with a deadline; Baro
     above Special because Gotva Prime is marked (S) on the wiki but is really
     a Baro item (TODO.md). */
  const BUCKET_ORDER = ["founder", "resurgence", "farmable", "baro", "special"];

  /* EVERY bucket an item belongs to, primary first. `statusOf` answers "which
     one does it display as", which is one bucket by design so the sidebar stays
     unambiguous; this answers "which toggles should keep it on screen", and the
     two are different questions for anything with more than one source.

     Two items in the current data have two: Lex Prime is farmable *and* sold by
     Baro, Gotva Prime is a Baro item the wiki also marks (S). Filtering on the
     single primary bucket made unticking *Farmable* hide a Baro item - the box
     you left ticked was covering it. Falls back to `vaulted`, which is not a
     source but the absence of one. */
  function bucketsOf(item) {
    const f = (item && item.flags) || {};
    const out = BUCKET_ORDER.filter((k) => f[k]);
    return out.length ? out : ["vaulted"];
  }

  const statusOf = (item) => bucketsOf(item)[0];

  /* ── reading a backup ────────────────────────────────────────────
     The one path here that can lose data, so it is the one most worth having
     tested. Everything is validated against the *current* catalogue rather
     than trusted: an id that no longer exists, a part renamed upstream, or a
     count larger than the part needs are all dropped or clamped, and counted
     into `skipped` so the page can say how much did not survive.

     Throws only when the document is not a backup at all. Anything else is
     salvaged as far as it goes - a backup that restores most of your progress
     beats one that refuses because a single Prime was renamed. */
  /* The union of what both pages accept. They used to keep separate lists -
     the planner took `aya` and dropped the Forma counts, the collection view
     the reverse - so which of your options survived a restore depended on
     which page you happened to restore from. */
  /* `minutes` is the only one that is not a scalar - a map of mission type to
     minutes per reward. It is passed through whole and sanitised on the way
     into the planner, which drops anything that is not a positive number, so a
     hand-edited backup cannot put a string or a negative cost into the ranking. */
  /* `runMode` was here until 2026-08-24, when *How far you run* stopped being a
     question: how far to run a node is worked out per node now, so a backup
     carrying an answer to it would be restoring a setting nothing reads. Old
     files still list it and are still valid - anything not named here is simply
     dropped, which is what this list is for. */
  const PLAN_OPTIONS = ["squad", "event", "railjack", "aya", "traces",
                        "minutes", "sort", "formaHave", "formaNeed"];

  function parseBackup(text, items) {
    const raw = typeof text === "string" ? JSON.parse(text) : text;

    // A bare array is a backup from before parts existed. It means "these items
    // are complete", so the parts are derived rather than absent.
    const legacy = Array.isArray(raw);
    const payload = legacy ? { collected: raw } : raw;
    if (!payload || typeof payload !== "object" || !Array.isArray(payload.collected)) {
      throw new Error("this doesn't look like a Prime Hunter backup");
    }

    const byId = new Map((items || []).map((i) => [i.id, i]));
    let skipped = 0;
    const known = (ids) => (ids || []).filter((id) => {
      if (byId.has(id)) return true;
      skipped++; return false;
    });

    const collected = known(payload.collected);

    const parts = {};
    const src = (!legacy && payload.parts && typeof payload.parts === "object")
      ? payload.parts : {};
    Object.keys(src).forEach((id) => {
      const item = byId.get(id);
      if (!item) { skipped++; return; }
      const bag = {};
      Object.keys(src[id] || {}).forEach((name) => {
        const part = (item.parts || []).find((x) => x.name === name);
        if (!part) { skipped++; return; }
        const n = Math.max(0, Math.min(needOf(part), Number(src[id][name]) || 0));
        if (n > 0) bag[name] = n;
      });
      if (Object.keys(bag).length) parts[id] = bag;
    });

    if (legacy) {
      collected.forEach((id) => {
        const item = byId.get(id);
        if (!(item.parts || []).length) return;
        parts[id] = {};
        item.parts.forEach((p) => { parts[id][p.name] = needOf(p); });
      });
    }

    /* Ticks the file's own parts do not account for — counted, never corrected.
       A restore reproduces the file; it is not the place to change what someone
       saved. The collection view used to drop these on import, and the planner
       kept them, so the same file restored differently depending on which page
       you were looking at — the second time these two have diverged over one
       backup, and `known()` above exists because of the first.

       Counting rather than correcting is also the honest reading of the cause.
       The obvious one — "they ticked something they had not finished" — is not
       reachable: the tick sets the parts to match, and every part click on
       either page runs `syncCollected`. What *is* reachable is a rebuild moving
       under a store that was consistent when it was written, by renaming a part
       or adding one. Nothing about that is the reader's mistake, and silently
       retracting their claim would be the app putting words in their mouth in
       the direction `syncCollected`'s own comment says it stopped doing.

       It sits below the legacy fill on purpose. An old-format file has its
       parts derived from the tick a few lines up, so it cannot contradict
       itself; counted before that ran, every legacy backup would report every
       Prime in it. */
    const unfinished = collected.filter((id) => {
      const item = byId.get(id);
      if (!item || !(item.parts || []).length) return false;
      const bag = parts[id] || {};
      return !item.parts.every((p) => (Number(bag[p.name]) || 0) >= needOf(p));
    }).length;

    const wishlist = Array.isArray(payload.wishlist) ? known(payload.wishlist) : null;

    const materials = Array.isArray(payload.materials)
      ? payload.materials
          .filter((m) => m && typeof m === "object")
          .map((m) => ({
            name: String(m.name == null ? "" : m.name).slice(0, 60),
            have: Math.max(0, Number(m.have) || 0),
            need: Math.max(0, Number(m.need) || 0),
          }))
      : null;

    // options are plain settings, so only the ones we recognise are taken -
    // an old or hand-edited backup cannot smuggle in state nothing reads
    let plan = null;
    if (payload.plan && typeof payload.plan === "object") {
      plan = {};
      PLAN_OPTIONS.forEach((k) => {
        if (payload.plan[k] !== undefined) plan[k] = payload.plan[k];
      });
    }

    const filters = (payload.filters && typeof payload.filters === "object")
      ? payload.filters : null;

    return { legacy, skipped, unfinished, collected, parts, wishlist, materials, plan, filters };
  }

  /* One sentence, named once. Both pages report `unfinished` after a restore
     and neither is entitled to word it differently — the same rule the run-cost
     wording is under, and for the same reason: two copies of a sentence are two
     sentences, and the divergence this whole count exists to end started as two
     copies of a rule. Returns "" for none, so callers concatenate it blind. */
  function unfinishedNote(n) {
    if (!n) return "";
    return n === 1
      ? " 1 Prime is ticked but its parts are incomplete — a rebuild may have"
        + " renamed or added one."
      : ` ${n} Primes are ticked but their parts are incomplete — a rebuild may`
        + " have renamed or added one.";
  }

  window.WFPrimeModel = {
    REFINEMENTS, TRACE_COST, PLAN_OPTIONS,
    needOf, rarityOf, refineAdvice, statusOf, bucketsOf,
    relicValue, bestRefinement, sourceValue, parseBackup, unfinishedNote,
    RADIANT_BONUS, radiantMultiplier,
  };
})();
