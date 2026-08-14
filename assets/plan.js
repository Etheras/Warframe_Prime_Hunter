/* VorFrame — farm planner
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
  const ROT = window.VorFrameRotation;
  const RUN_MODES = ROT.RUN_MODES;
  const runValue = ROT.runValue;
  const liveRotation = ROT.liveRotation;
  const untilText = ROT.untilText;
  const isRailjack = ROT.isRailjack;
  const isEvent = ROT.isEventNode;
  const isSteelPath = ROT.isSteelPath;
  const bountyEvent = ROT.bountyEvent;
  const eventRunning = ROT.eventRunning;
  const notADestination = ROT.notADestination;
  const CYCLE_MINUTES = ROT.cycleMinutes;

  /* Storage, the escaper, the tooltip, the staleness banner and the backup
     file are shared with the collection view - see assets/shared.js. */
  const S = window.VorFrameShared;
  const { esc, $, $$, load, save } = S;
  const KEY_PARTS = S.KEYS.parts;
  const KEY_WISH = S.KEYS.wishlist;
  const KEY_PLAN = S.KEYS.plan;
  const KEY_MATERIALS = S.KEYS.materials;

  /* What a relic opening is worth, and how to read a backup - shared with the
     collection view, and testable without a browser. See assets/model.js. */
  const M = window.VorFrameModel;

  const DATA = window.VORFRAME_DATA;

  if (!DATA || !DATA.items) {
    document.body.innerHTML =
      '<p class="nodata">' +
      "No data yet. Double-click <code>refresh-data.cmd</code>, then reload this page.</p>";
    return;
  }


  const ITEMS = DATA.items;
  const RELICS = DATA.relics || {};
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
    { squad: false, event: false, railjack: false, steelPath: false,
      runMode: "reset", aya: true, minutes: {} },
    load(KEY_PLAN, {}));

  const needOf = (p) => p.itemCount || 1;
  const haveOf = (id, name) => (partsOwned[id] || {})[name] || 0;

  /* ── effort, supplied by the player and empty by default ──────────
     Minutes for one *objective* of each mission type. Nothing is filled in to
     begin with, and while nothing is filled in none of this runs: the ranking
     is per run, exactly as it was before this existed.

     It exists because ranking per run flatters anything long. Against one
     player's own timings, costing per minute moved Capture and Exterminate
     nodes up over a hundred places and dropped Spy by a factor of ten - far too
     big to ignore, and far too personal to ship a default for. A strong player
     trivialises a Capture while a Spy vault still costs its fixed hacking time,
     so even the ratios between the numbers are that player's own.

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
      relicPlan.set(rname, {
        refinement, value, openings, blocker, entries,
        wants: Array.from(new Set(entries.map((e) => e.label))).sort(),
      });
    });

    /* Places that hold something wanted and were left out by an option rather
       than by the data. Counted so an empty ranking can name the switch that
       emptied it - see `noNodes`. */
    const nodes = new Map();
    const blocked = { railjack: new Set(), event: new Set(), steelPath: new Set() };
    relicPlan.forEach((rp, rname) => {
      (RELICS[rname].sources || []).forEach((s) => {
        if (notADestination(s)) return;      // quest, or not modelled yet
        const skip = `${s.planet}|${s.node}|${s.mode}`;
        if (!opts.railjack && isRailjack(s)) { blocked.railjack.add(skip); return; }
        if (!opts.event && isEvent(s)) { blocked.event.add(skip); return; }
        if (!opts.steelPath && isSteelPath(s)) { blocked.steelPath.add(skip); return; }
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
        n.rot[slot] += ((s.chance || 0) / 100) * rp.value;
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
        n.aya = Math.max(n.aya || 0, a.chance || 0);
      });
    }

    // value each node as a whole run, which is what you actually commit to
    const mins = effort();
    nodes.forEach((n) => {
      const live = n.kind === "bounty" ? liveRotation(n.node) : null;
      const r = runValue(n.rot, opts.runMode, n.mode, opts.squad, live, n.cnt);
      n.score = r.total; n.perRound = r.perRound;
      n.rounds = r.rounds; n.counts = r.counts;
      n.stranded = r.stranded; n.nonStandard = r.nonStandard;
      n.planName = r.planName; n.bounty = r.bounty;
      // the same run counted: how many wanted relics it drops on average, and
      // how often it drops any at all
      n.perRun = r.count || 0; n.anyRun = r.any || 0;

      const o = ROT.objectivesOf(n);
      n.objectives = o.count; n.unit = o.unit;
      n.minutes = mins ? mins.per(n.mode) * o.count : null;
      n.minutesAssumed = !!mins && mins.assumed(n.mode);
      // with no minutes anywhere, this is the score and the ranking is per run
      n.rate = n.minutes ? n.score / n.minutes : n.score;
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

    return { relicPlan, ranked, needs, formaShort, ayaValue, ayaRelic,
             ayaRotationLive, ayaMissing, perMinute: !!mins,
             blocked: { railjack: blocked.railjack.size, event: blocked.event.size,
                        steelPath: blocked.steelPath.size } };
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

    const lines = [];
    if (n.nonStandard) {
      lines.push("DISRUPTION pays one reward per round, and the tier depends on");
      lines.push("the round AND how many of the four conduits you defended.");
      lines.push("");
      lines.push("Defending all four:");
      lines.push("  round   1  2  3  4  5  6+");
      lines.push("  tier    B  B  C  C  C  C");
      lines.push("");
      lines.push("So rotation C is unlocked, not periodic - once you reach round");
      lines.push("three every further round is another C.");
      lines.push("");
      lines.push("Defending fewer is a deliberate min-max:");
      lines.push("  rotation A  only rounds 1-3, and only by defending 3/2/1");
      lines.push("  rotation B  every round, defending 4 / 3-4 / 2-3 / 1-2");
      lines.push("  rotation C  round 3 onward, defending 3-4");
      lines.push("Losing all four in a round fails the mission.");
      lines.push("");
    }
    if (n.planName) {
      lines.push("Plan: " + n.planName + ".");
      lines.push("");
    }
    if (n.rounds) {
      lines.push("Costed over " + n.rounds + " round" + (n.rounds === 1 ? "" : "s") +
        (opts.runMode === "full" ? "."
         : opts.runMode === "reset" ? ", the last one you want anything from."
         : ", then restart."));
      lines.push("");
      lines.push("You collect, and we count:");
      Object.keys(n.counts).forEach((r) => {
        const v = n.rot[r] || 0;
        lines.push("  rot " + r + " x" + n.counts[r] +
          (v > 0 ? "   worth " + pct(v) : "   nothing you want"));
      });
      if ((n.rot.none || 0) > 0) lines.push("  no rotation   worth " + pct(n.rot.none));
      lines.push("");
      lines.push("Whole run  " + pct(n.score) + "   <- ranked on this");
      lines.push("Per round  " + pct(n.perRound) + "   (" + n.rounds + " rounds)");
      lines.push("");
    }
    (n.stranded || []).forEach((t) => {
      lines.push("rot " + t + " holds something you want (" + pct(n.rot[t]) +
        ") but this run never reaches it.");
      if (n.nonStandard && t === "A" && !opts.squad) {
        lines.push("Rotation A here needs a squad under-defending to a schedule -");
        lines.push("tick '4-squad, same relic' to let the planner consider it.");
      }
    });
    if (!n.nonStandard) lines.push(ROT_CYCLE);

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

     Both belong there, because they answer different questions. The percentage
     weighs a relic by what opening it is worth, so it knows a rare you are
     blocked on is not the same prize as a common; the count does not, and says
     only how fast the stack fills. A node can hand over more relics and still
     be worth less. */
  function scoreBlock(n) {
    const perMin = n.minutes != null;
    const lines = [];

    lines.push("Ranked on what one run here is worth towards your list" +
               (perMin ? "," : "."));
    if (perMin) lines.push("per minute of it.");
    if (opts.squad) lines.push("Assumes a 4-squad cracking the same relic.");
    lines.push("");

    if (perMin) {
      lines.push("Whole run   " + pct(n.score) + "   over " + n2(n.minutes) + " min");
      if (n.objectives > 1) {
        lines.push("            " + n.objectives + " " + n.unit + "s at " +
                   n2(n.minutes / n.objectives) + " min each");
      }
      if (n.minutesAssumed) {
        lines.push("");
        lines.push("You have set no minutes for " + n.mode + ", so it is costed at");
        lines.push("the average of the types you did set. Fill it in to rank");
        lines.push("this row on its own time rather than on everyone else's.");
      }
      lines.push("");
    }

    lines.push("Relics      " + n2(n.perRun) + " you want, per run on average");
    lines.push("            " + pct(n.anyRun) + " of runs drop at least one");
    lines.push("");
    lines.push("The percentage weighs each relic by what opening it is worth,");
    lines.push("so a rare you are blocked on outweighs a common. The count");
    lines.push("does not - it says only how fast the stack fills.");

    const counted = n2(n.perRun) + " relic" + (n2(n.perRun) === "1" ? "" : "s") +
                    " · " + pct(n.anyRun) + " of runs";
    const cost = perMin
      ? `<span class="spot-alt">${pct(n.score)} per run over ` +
        (n.minutesAssumed
          ? `<span class="est">${n2(n.minutes)} min</span>`
          : `${n2(n.minutes)} min`) + "</span>"
      : "";

    return `<div class="spot-score" data-tip="${esc(lines.join("\n"))}">
      <b>${pct(n.rate)}</b>${perMin ? "per minute" : "per run"}
      ${cost}<span class="spot-alt">${counted}</span></div>`;
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
    if (blocked.steelPath) {
      off.push([blocked.steelPath, "on the Steel Path", "Steel Path unlocked"]);
    }
    if (!off.length) {
      return `<p class="hint">The relics below do drop, but nowhere you can get to
        right now — every source is a quest or something the model cannot rank yet.</p>`;
    }
    return `<p class="hint">Nowhere to send you, and not because nothing drops. ` +
      off.map(([n, what, box]) =>
        `<strong>${n}</strong> place${n === 1 ? "" : "s"} carr${n === 1 ? "ies" : "y"} ` +
        `what you want and ${n === 1 ? "it is" : "each of them is"} ${what}, left out ` +
        `by default — tick <strong>${esc(box)}</strong> on the left to rank ` +
        `${n === 1 ? "it" : "them"}.`
      ).join(" ") + `</p>`;
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
          : `Nothing set, so the list is ranked <b>per run</b>, exactly as it is ` +
            `without any of this. Fill in a single type and the whole list re-sorts ` +
            `by time.`;
    }
    const clear = $("#effortClear");
    if (clear) clear.hidden = !set.length;
  }

  function render() {
    renderWishlist();
    const { relicPlan, ranked, needs, formaShort, ayaValue, ayaRelic,
            ayaRotationLive, ayaMissing, perMinute, blocked } = buildPlan();
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
      `<b>${ranked.length}</b> place${ranked.length === 1 ? "" : "s"} to run`;

    $("#planScoreNote").innerHTML =
      `The percentage is what <b>one whole run</b> at that node is worth towards your ` +
      `list${opts.squad ? ", assuming a 4-squad cracking the same relic" : ""}` +
      (perMinute
        ? `, divided by the minutes you said it costs — so the ranking is now per ` +
          `minute, and a long run has to earn its length.`
        : ` — so a longer run can outrank a faster one on volume alone. Fill in ` +
          `<b>Effort</b> in the sidebar to rank by time instead.`) +
      ` Beneath it, the same run counted rather than valued: how many relics you want ` +
      `it hands over on average, and how often it hands over any at all. The percentage ` +
      `weighs a rare you are blocked on above a common; the count does not. ` +
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
          <span class="spot-mode">(${esc(n.mode)})</span>
          <span class="src-planet">— ${esc(n.planet)}</span>
          ${demandTags(n)}
          ${n.event ? `<span class="tag">event</span>` : ""}</div>
        <div class="spot-meta">${runTag(n)}${
          n.lvl ? ` · level ${n.lvl[0]}–${n.lvl[1]}` : " · level unknown"} · ${
          `<span class="relic-count" data-tip="${esc("Relics you want from here, best first:" + "\n" +
            rl.map((r) => "  " + r).join("\n"))}">${rl.length} relic${
            rl.length === 1 ? "" : "s"}</span>`}${
          n.aya ? ` · <span class="aya" data-tip="${esc(
            "Also drops Aya at " + pct(n.aya / 100) + " per reward." + "\n\n" +
            "One Aya buys one relic of your choosing at Varzia. Counted at " +
            pct(ayaValue) + " here, the value of the best relic it could buy you.")
          }">aya</span>` : ""}</div>
        ${scoreBlock(n)}
      </div>`;
    }).join("") + (ranked.length > SHOW
      ? `<div class="more-nodes" data-tip="${esc(ranked.slice(SHOW, SHOW + 20).map((n) =>
          `${n.node} (${n.planet}) ${n.mode}${n.rounds ? " " + n.rounds + "rd" : ""} — ${
            pct(n.rate)}${n.minutes != null ? "/min" : ""}`
        ).join("\n"))}">+${ranked.length - SHOW} more places</div>`
      : "");

    // per-relic refinement decision
    const rp = Array.from(relicPlan.entries()).sort((a, b) => b[1].value - a[1].value);
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
                "Take this relic to " + p.refinement + "." + "\n\n" +
                "Chosen to clear the scarcest thing you want here fastest," + "\n" +
                "rather than for the best overall hit rate. The parts below are" + "\n" +
                "listed rarest first." +
                (isFinite(p.openings)
                  ? "\n\nExpected openings to finish everything wanted here: "
                    + p.openings.toFixed(1) : ""))}"
          >${esc(p.refinement)}</span>
        <span class="chances" data-tip="${esc(
          "Chance one opening gives something you want: " + pct(p.value))}"><b>${pct(p.value)}</b></span>
      </div>
      <div class="relic-parts">${
        parts.map((x) => `<span class="part-chip ${esc(x.rar)}">${esc(x.label)}</span>`).join("")
      }</div>`;
    }).join("") : `<p class="hint">None of the relics you need are currently dropping.</p>`;

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
        const coll = new Set(load("vorframe.collected.v1", []));
        if (done) coll.add(id); else coll.delete(id);
        save("vorframe.collected.v1", Array.from(coll));
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
   ["p-railjack", "railjack"], ["p-steel", "steelPath"]].forEach(([id, key]) => {
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
  delete opts.formaHave; delete opts.formaNeed; save(KEY_PLAN, opts);

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
        vorframe: 3,
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
