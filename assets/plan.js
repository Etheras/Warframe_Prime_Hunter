/* VorFrame — farm planner
   Given a list of Primes you want, works out where to go next.

   The model, in one line:

     score(node, rotation) = Σ over relics r dropped there:
                               P(r drops) × Σ over wanted things w in r:
                                              P(w | r, refinement) × min(qty, still needed)

   Both sums are plain additions rather than inclusion-exclusion, because a
   mission reward roll yields exactly one item (so the relics in a node's table
   are mutually exclusive) and a relic opening yields exactly one reward (so the
   wanted slots inside a relic are too).                                        */
(function () {
  "use strict";

  const DATA = window.VORFRAME_DATA;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  if (!DATA || !DATA.items) {
    document.body.innerHTML =
      '<p style="padding:40px;font:16px system-ui;color:#e6ebf2">' +
      "Data file missing. Run <code>python tools/build_data.py</code> and reload.</p>";
    return;
  }

  const ITEMS = DATA.items;
  const RELICS = DATA.relics || {};
  const BY_ID = new Map(ITEMS.map((i) => [i.id, i]));
  const REFINEMENTS = (DATA.meta && DATA.meta.refinements) ||
    ["Intact", "Exceptional", "Flawless", "Radiant"];

  const KEY_PARTS = "vorframe.parts.v1";
  const KEY_WISH = "vorframe.wishlist.v1";
  const KEY_PLAN = "vorframe.plan.v1";

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const load = (k, dflt) => {
    try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? dflt : v; }
    catch (e) { return dflt; }
  };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  /* ── state, shared with the collection page where it makes sense ── */
  let partsOwned = load(KEY_PARTS, {});
  let wishlist = load(KEY_WISH, []).filter((id) => BY_ID.has(id));
  const opts = Object.assign(
    { squad: false, event: false, railjack: false, formaHave: 0, formaNeed: 0 },
    load(KEY_PLAN, {}));

  const needOf = (p) => p.itemCount || 1;
  const haveOf = (id, name) => (partsOwned[id] || {})[name] || 0;

  /* Railjack is a separate activity; kept out of the ranking by default but
     never hidden, since five live relics drop nowhere else. */
  const RAILJACK_NODES = new Set([
    "Bendar Cluster", "Iota Temple", "Korm's Belt", "Ogal Cluster", "Sover Strait",
    "Arva Vector", "Brom Cluster", "Enkidu Ice Drifts", "Mammon's Prospect",
    "Nu-Gua Mines", "Sovereign Grasp", "Fenton's Field", "Khufu Envoy",
    "Obol Crossing", "Peregrine Axis", "Profit Margin", "Seven Sirens",
    "Kasio's Rest", "Lupal Pass", "Mordo Cluster", "Nodo Gap", "Vand Cluster",
    "Beacon Shield Ring", "Bifrost Echo", "Falling Glory", "Luckless Expanse",
    "Orvin-Haarc", "Vesper Strait",
  ]);
  const isRailjack = (s) => RAILJACK_NODES.has(s.node) || /Proxima/i.test(s.planet || "");
  const isEvent = (s) => /^Event:/i.test(s.planet || "");

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
    const formaShort = Math.max(0, (Number(opts.formaNeed) || 0) - (Number(opts.formaHave) || 0));
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
                   short: formaShort, need: Number(opts.formaNeed) || 0, bonus: true });
    }
    return { want, needs, formaShort };
  }

  const squadify = (p) => (opts.squad ? 1 - Math.pow(1 - p, 4) : p);

  /* value of one opening of this relic, at a given refinement */
  function relicValue(entries, refinement) {
    let total = 0;
    entries.forEach((e) => {
      const pct = e.chances[refinement];
      if (pct == null) return;
      // a drop of qty is only worth what you still need of it
      total += squadify(pct / 100) * Math.min(e.qty, e.stillNeed);
    });
    return total;
  }

  function bestRefinement(entries) {
    let best = REFINEMENTS[0], bestVal = -1;
    REFINEMENTS.forEach((f) => {
      const v = relicValue(entries, f);
      if (v > bestVal) { best = f; bestVal = v; }
    });
    return { refinement: best, value: bestVal };
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
      const { refinement, value } = bestRefinement(entries);
      if (value <= 0) return;
      relicPlan.set(rname, {
        refinement, value,
        wants: Array.from(new Set(entries.map((e) => e.label))).sort(),
      });
    });

    const nodes = new Map();
    relicPlan.forEach((rp, rname) => {
      (RELICS[rname].sources || []).forEach((s) => {
        if (!opts.railjack && isRailjack(s)) return;
        const key = `${s.planet}|${s.node}|${s.mode}|${s.rotation || "-"}`;
        let n = nodes.get(key);
        if (!n) {
          n = { planet: s.planet, node: s.node, mode: s.mode, rotation: s.rotation,
                kind: s.kind, lvl: s.lvl || null, event: isEvent(s),
                railjack: isRailjack(s), score: 0, relics: new Map() };
          nodes.set(key, n);
        }
        n.score += ((s.chance || 0) / 100) * rp.value;
        const prev = n.relics.get(rname);
        if (prev == null || (s.chance || 0) > prev) n.relics.set(rname, s.chance || 0);
      });
    });

    // Tie-break, in the order agreed: score first, then a lower enemy level
    // (faster clears), then rotation A ahead of B/C (it comes round sooner).
    // Mission length is deliberately ignored as too ambiguous to model.
    const ROT_RANK = { A: 0, B: 1, C: 2 };
    const ranked = Array.from(nodes.values()).sort((a, b) => {
      if (Math.abs(b.score - a.score) > 1e-9) return b.score - a.score;
      if (opts.event && a.event !== b.event) return a.event ? -1 : 1;
      const al = a.lvl ? a.lvl[0] : Infinity, bl = b.lvl ? b.lvl[0] : Infinity;
      if (al !== bl) return al - bl;
      const ar = ROT_RANK[a.rotation] ?? 3, br = ROT_RANK[b.rotation] ?? 3;
      if (ar !== br) return ar - br;
      return (a.node || "").localeCompare(b.node || "");
    });

    return { relicPlan, ranked, needs, formaShort };
  }

  /* ── rendering ───────────────────────────────────────────────── */
  const pct = (v) => (v * 100).toFixed(2).replace(/\.?0+$/, "") + "%";

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
          <button class="wish-del" data-del="${esc(id)}" title="remove from list">✕</button>
        </div>
        <div class="wish-parts">${
          done === total
            ? `<span class="wish-all">complete</span>`
            : missing.map((p) => `<span>${esc(p.name)}${
                needOf(p) > 1 ? ` ×${needOf(p) - haveOf(id, p.name)}` : ""}</span>`).join("")
        }</div>
      </div>`;
    }).join("");
  }

  function render() {
    renderWishlist();
    const { relicPlan, ranked, needs, formaShort } = buildPlan();

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
      `The percentage is the chance that <b>one reward drop</b> at that node leads to ` +
      `something on your list${opts.squad ? ", assuming a 4-squad cracking the same relic" : ""}. ` +
      `Ties are broken by lower enemy level, then rotation A.` +
      (formaShort > 0 ? " A Forma shortfall raises the value of relics you were already " +
        "running, but never adds one." : "") +
      (openRelics === 0 ? " Nothing you want is currently dropping." : "");

    // nodes: show the best few, with the rest behind a hover
    const SHOW = 8;
    $("#planNodes").innerHTML = ranked.slice(0, SHOW).map((n) => {
      const rl = Array.from(n.relics.keys()).sort();
      const more = ranked.length > SHOW;
      return `<div class="spot">
        <div class="spot-where">${esc(n.node)}
          <span style="color:var(--txt-faint);font-weight:400">— ${esc(n.planet)}</span>
          ${n.railjack ? `<span class="tag">railjack</span>` : ""}
          ${n.event ? `<span class="tag">event</span>` : ""}</div>
        <div class="spot-meta">${esc(n.mode)}${
          n.rotation ? ` · rot ${esc(n.rotation)}` : ""}${
          n.lvl ? ` · level ${n.lvl[0]}–${n.lvl[1]}` : " · level unknown"} · ${
          rl.length} relic${rl.length === 1 ? "" : "s"}: ${esc(rl.join(", "))}</div>
        <div class="spot-score"><b>${pct(n.score)}</b>per reward</div>
      </div>`;
    }).join("") + (ranked.length > SHOW
      ? `<div class="more-nodes" title="${esc(ranked.slice(SHOW, SHOW + 20).map((n) =>
          `${n.node} (${n.planet}) ${n.mode}${n.rotation ? " rot " + n.rotation : ""} — ${pct(n.score)}`
        ).join("\n"))}">+${ranked.length - SHOW} more places</div>`
      : "");

    // per-relic refinement decision
    const rp = Array.from(relicPlan.entries()).sort((a, b) => b[1].value - a[1].value);
    $("#planRelics").innerHTML = rp.length ? rp.map(([rname, p]) => {
      const tier = rname.split(" ")[0];
      return `<div class="relic-row">
        <span class="relic-name">${esc(rname)}</span>
        <span class="advice ${p.refinement === "Intact" ? "intact" : "radiant"}"
              title="Chance of getting something you want from one opening at this refinement">
          ${esc(p.refinement)}</span>
        <span class="chances"><b>${pct(p.value)}</b></span>
        <span class="relic-wants">${esc(p.wants.join(", "))}</span>
      </div>`;
    }).join("") : `<p class="hint">None of the relics you need are currently dropping.</p>`;

    // what's left
    $("#planNeeds").innerHTML = needs.map((n) => {
      const live = n.item.id
        ? (BY_ID.get(n.item.id).parts.find((p) => p.name === n.part) || { relics: [] })
            .relics.filter((r) => RELICS[r.relic] && !RELICS[r.relic].vaulted).length
        : Array.from(relicPlan.keys()).length;
      return `<div class="need-row${live ? "" : " need-dead"}">
        <span class="need-name">${esc(n.item.name)}</span>
        <span class="need-part">${esc(n.part)}${n.short > 1 ? ` ×${n.short}` : ""}</span>
        <span class="need-src">${
          n.bonus ? "picked up along the way — never farmed for on its own"
                  : (live ? `${live} relic${live === 1 ? "" : "s"} dropping`
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
  [["p-squad", "squad"], ["p-event", "event"], ["p-railjack", "railjack"]].forEach(([id, key]) => {
    const el = $("#" + id);
    el.checked = !!opts[key];
    el.addEventListener("change", () => { opts[key] = el.checked; save(KEY_PLAN, opts); render(); });
  });
  [["formaHave", "formaHave"], ["formaNeed", "formaNeed"]].forEach(([id, key]) => {
    const el = $("#" + id);
    el.value = Number(opts[key]) || 0;
    el.addEventListener("input", () => {
      opts[key] = Math.max(0, Number(el.value) || 0); save(KEY_PLAN, opts); render();
    });
  });

  // pick up part ticks made on the collection page in another tab
  window.addEventListener("storage", (e) => {
    if (e.key === KEY_PARTS) { partsOwned = load(KEY_PARTS, {}); render(); }
    if (e.key === KEY_WISH) { wishlist = load(KEY_WISH, []).filter((id) => BY_ID.has(id)); render(); }
  });

  render();
})();
