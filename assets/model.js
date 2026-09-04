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

  /* ── a relic that adds nothing the one beside it does not ────────
     Two relics at one node can pay the same wanted part, and until now each was
     counted in full. The owner found it from the ranking: with four Primes
     banked but a part each, *Where to go* put **Apollo (Lua) at 1.57 a run**
     above **Taranis (Void) at 1.23**, and Apollo's two relics cover two parts
     between them rather than three —

       Axi D6   14.29% B / 12.42% C   Cedo Prime Barrel, Dual Zoren Prime Blade
       Axi A21  14.29% B / 12.42% C   Cedo Prime Barrel

     `Axi A21` pays nothing `Axi D6` does not, at identical odds. The node was
     credited twice for one part, and the figure the ranking divides by is meant
     to stand for progress.

     **Discounted, not dropped, at the owner's direction, 2026-09-01.** A wholly
     covered relic is not worthless: one reward draw yields ONE relic, so the two
     are mutually exclusive within a run — `Axi A21` is exactly the copy you get
     on the draws where `Axi D6` does not turn up. It is redundant across a
     stack, not within a run. It also stops being redundant the moment the
     covering part is ticked off. Zeroing it would assert more than the model
     knows; a residual says "this buys you little" without claiming it buys
     nothing.

     **Wholly covered only.** A relic that overlaps in part and pays something of
     its own keeps its full count. That is the whole difference between a
     surgical fix and a re-ranking: measured over the live data, discounting
     partial overlaps too moves 139 of 234 nodes on a full farm list and takes 11
     in or out of the top 20, while this rule changes **nothing whatever** there —
     no node on a full list holds a relic that is wholly covered — and still
     moves Apollo off the top of the narrow list it was wrong about.

     The third judgement in the model, beside `CACHE_PENALTY` and
     `RADIANT_BONUS`, and written the same way: one named constant, argued with
     rather than derived. At 0.25 Apollo falls from #1 to #4 and Taranis takes
     the top; at 0.5 it lands at #2, which is not the correction the owner
     asked for; at 0 it falls to #11, which is the claim of worthlessness they
     declined. */
  const REDUNDANCY_WEIGHT = 0.25;

  /* What an Aya is worth when you are **not** chasing anything Varzia is
     currently selling, as a share of what it would be worth if you were.

     Owner's rule, 2026-09-04, given as three cases: a relic on your farm list is
     100%; Aya while targeting Resurgence is 100% too, because one Aya *is* one
     relic of your choosing; Aya with nothing in Resurgence you want but vaulted
     Primes still missing from your collection is **30%**; and Aya with neither
     is 0.

     It is a discount rather than a gate, and that distinction is the whole
     point. The decision of 2026-08-27 made Aya count for gaps in your
     *collection* rather than only your farm list — right, because Aya is banked
     rather than spent on sight, and the player who should be collecting it was
     scoring it at zero. What that overshot was the amount: a someday-Prime was
     priced the same as tonight's target, which put Aya nodes above nodes
     dropping the relic actually being farmed. Same shape as `RADIANT_BONUS` and
     `REDUNDANCY_WEIGHT` — one named constant, argued with rather than derived. */
  const AYA_BANKED_SHARE = 0.3;

  /* What the *free* relic a fissure pays is worth beyond the relic itself, when
     Void Traces are tight.

     Owner's rule, 2026-09-04: **150% — 100% for getting the relic, 50% for
     getting it Exceptional.** It arrives already refined, so it is a relic you
     did not have to open *and* 25 Void Traces you did not have to spend.

     Sits beside `RADIANT_BONUS`, which is the same idea for the eleven nodes
     that hand relics over Radiant, and the two numbers are deliberately not
     ranked by trace cost: Radiant saves 100 traces against Exceptional's 25, so
     on traces alone this would be the smaller of the two. It is the larger
     because it is doing a different job — `RADIANT_BONUS` upgrades a relic you
     were collecting anyway, while this one is an **extra** relic that also
     happens to be refined. Both are switched on by the same `traces` option,
     because both only matter to a player who is short. */
  const FISSURE_REFINED_BONUS = 0.5;

  /* One node, one rotation letter, and what its relics are really worth here.

     `rows` is `{ name, chance, value, wants }` per relic source, `chance` a
     probability rather than a percentage. Better relics are considered first —
     by value, then by chance, then by name so the answer cannot depend on the
     order the sources happened to arrive in — and each one covers the wanted
     parts it pays. A relic reached with every one of its parts already covered
     is the redundant case and keeps `weight` of its count.

     Per rotation letter rather than per node, deliberately and conservatively.
     A run that reaches C has collected A and B on the way, so a relic in A can
     in truth cover one in C; letting it would discount more, on an assumption
     about how far the reader stays. Same letter is the case that is true
     however the run goes.

     Returns the credited count and worth, and `spent` — which relics were
     discounted and what covers them — because the row has to be able to say so.
     A number that quietly halves is the shape this project keeps having to fix. */
  function creditRelics(rows, weight) {
    const w = weight == null ? REDUNDANCY_WEIGHT : weight;
    const order = (rows || []).slice().sort((a, b) =>
      (b.value - a.value) || (b.chance - a.chance) ||
      String(a.name).localeCompare(String(b.name)));
    const covered = new Map();          // part label -> the relic that covers it
    const spent = [];
    let count = 0, worth = 0;
    order.forEach((r) => {
      const wants = r.wants || [];
      const redundant = wants.length > 0 && wants.every((p) => covered.has(p));
      const k = redundant ? w : 1;
      count += (r.chance || 0) * k;
      worth += (r.chance || 0) * (r.value || 0) * k;
      if (redundant) {
        spent.push({ name: r.name,
                     coveredBy: Array.from(new Set(wants.map((p) => covered.get(p)))) });
      }
      wants.forEach((p) => { if (!covered.has(p)) covered.set(p, r.name); });
    });
    return { count, worth, spent };
  }

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
  /* `runStart` and `runEnd` joined on 2026-08-27: the minutes a mission costs
     before and after the part anyone counts — loading in, and getting out once
     the objective is done. Two fields rather than one sum because they are two
     different waits and a player timing themselves can measure them separately.
     As expensive to lose as the twenty numbers already here, so a backup carries
     them. */
  /* `sort`, and since 2026-09-01 the three *How to crack them* controls, are
     view state rather than assumptions about the player — they change what is
     on screen, not what the model concludes. They are saved and backed up all
     the same, because a control the reader sets every single visit is one the
     app is making them repeat. */
  const PLAN_OPTIONS = ["squad", "event", "railjack", "steel", "aya", "traces",
                        "minutes", "runStart", "runEnd",
                        "sort", "formaHave", "formaNeed",
                        "tier", "varzia", "trade"];

  /* What a saved filter set is allowed to be, key by key. Mirrors
     `saveFilters()` on the collection page — that is the only thing that writes
     this section, and a key here that it does not write is a key nothing will
     ever read back.

     Typed rather than merely named, unlike `PLAN_OPTIONS`, because these are
     not all plain settings: `avail` is a map of buckets to booleans and `cats`
     is a list. `PLAN_OPTIONS` can stay a bare list because a planner option
     that is the wrong type is a wrong *number*, which the page's own reads
     clamp; a filter of the wrong type used to reach a CSS selector. */
  const FILTER_SHAPE = {
    avail: "boolmap", cats: "strings", sort: "string",
    showCollected: "boolean", showMissing: "boolean",
    hideVaultedRelics: "boolean", hideOwnedParts: "boolean",
  };

  /* A key of the wrong type is dropped rather than coerced. A backup saying
     `showMissing: "yes"` is a file we do not understand, and guessing what it
     meant is how a restore quietly gives somebody a screen they did not save. */
  function takeFilters(raw) {
    if (!raw || typeof raw !== "object") return null;
    const out = {};
    Object.keys(FILTER_SHAPE).forEach((k) => {
      const v = raw[k];
      if (v === undefined) return;
      const want = FILTER_SHAPE[k];
      if (want === "boolean") {
        if (typeof v === "boolean") out[k] = v;
      } else if (want === "string") {
        if (typeof v === "string") out[k] = v;
      } else if (want === "strings") {
        if (Array.isArray(v)) out[k] = v.filter((x) => typeof x === "string");
      } else if (want === "boolmap") {
        if (v && typeof v === "object" && !Array.isArray(v)) {
          const m = {};
          Object.keys(v).forEach((b) => { if (typeof v[b] === "boolean") m[b] = v[b]; });
          out[k] = m;
        }
      }
    });
    /* An object that carried nothing we recognise is not a filter set. Returning
       `{}` would have the page save an empty one over what is already there. */
    return Object.keys(out).length ? out : null;
  }

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

    /* The same treatment `plan` gets above, and for the same reason.
       `filters` used to be taken whole on that bare `typeof` — the one field in
       this function with no shape check while the one beside it had a strict
       one, which is the kind of inconsistency that gets copied the next time
       somebody adds a section.

       **What this does not fix, because it was never broken.** The collection
       page already validates every one of these where it reads them
       (`app.js`): `avail` is intersected with the buckets that exist and
       taken as booleans only, `cats` is filtered against `CATEGORIES`, each
       flag is type-checked, and `sort` is normalised against `SORTS` the
       moment that object exists. So nothing unrecognised was ever *used* — it
       was stored, and sat in the reader's own `localStorage` until the next
       save overwrote it. This is defence in depth and one function reading
       consistently, not a hole being closed; the note in `PROJECT.md §7` says
       the same rather than claiming a fix it did not make.

       The shape lives here rather than in `app.js` because `parseBackup` is
       shared and must not learn which buckets or categories exist — that
       stays the page's business, and it is still checked there. */
    const filters = takeFilters(payload.filters);

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

  /* A part named beside its own Prime, without saying the Prime twice.
     "Kavasa Prime Collar" + "Kavasa Prime Band" reads as
     *"Kavasa Prime Collar Kavasa Prime Band"* wherever the two are concatenated,
     which is the search results and the line that says what a tick did.

     **One item of 167 needs this**, and it is the same one that is odd
     everywhere else: Kavasa Prime Collar is the only Prime whose part names
     carry the Prime's name, and the only one with no recipe in DE's export
     (`tools/sources.py`). Checked against the built payload rather than assumed.

     Whole leading words only, and compared word by word rather than by string
     prefix — the obvious rule, "drop it when the part starts with the item
     name", does not fire here: the part is `Kavasa Prime Band` and the item is
     `Kavasa Prime Collar`, so the shared part is `Kavasa Prime` and neither is
     a prefix of the other. Returns the part unchanged when nothing is shared,
     which is every other Prime, and never returns empty. */
  function partLabel(itemName, partName) {
    const item = String(itemName || "").trim().split(/\s+/);
    const part = String(partName || "").trim().split(/\s+/);
    let i = 0;
    while (i < item.length && i < part.length
           && item[i].toLowerCase() === part[i].toLowerCase()) i += 1;
    // Never eat the whole part name: "Blueprint" against a Prime called
    // "Blueprint" would leave the row with nothing to show.
    return i && i < part.length ? part.slice(i).join(" ") : String(partName || "");
  }

  window.WFPrimeModel = {
    REFINEMENTS, TRACE_COST, PLAN_OPTIONS,
    needOf, rarityOf, refineAdvice, statusOf, bucketsOf,
    relicValue, bestRefinement, sourceValue, parseBackup, unfinishedNote,
    RADIANT_BONUS, radiantMultiplier,
    REDUNDANCY_WEIGHT, creditRelics, partLabel,
    AYA_BANKED_SHARE, FISSURE_REFINED_BONUS,
    FILTER_SHAPE,
  };
})();
