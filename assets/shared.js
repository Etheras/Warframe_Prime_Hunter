/* Warframe Prime Hunter — what both pages need that is not the rotation model.

   The collection view and the planner are two equal tools over one dataset, so
   a fair amount of them is the same code: they escape the same way, read and
   write the same six localStorage keys, show the same tooltip, warn about the
   same stale data, and save and restore the same backup file. All of it used to
   exist twice, kept in step by hand.

   The rotation model lives next door in assets/rotation.js. This is everything
   else: storage, and the bits of chrome that are the same on both pages.

   Loaded before app.js and plan.js, after data/prime-data.js.               */
(function () {
  "use strict";

  const DATA = window.WFPRIME_DATA || {};

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  /* ── the store ───────────────────────────────────────────────────
     Six keys, named once. Both pages read and write the same three of them -
     parts, materials and the farm list - so a typo in one file would silently
     read an empty store rather than fail, and you would lose progress without
     ever seeing an error. `PROJECT.md §1` says which survive a backup.

     The prefix says what the data IS, not what the app is called. That is
     deliberate and it is the lesson of the rename that produced it: these keys
     were `vorframe.*`, and the only expensive part of dropping that name was
     that a hundred and sixty-seven ticked boxes lived behind it. The game will
     still be Warframe and these will still be Primes whatever this project ends
     up being called, so the next rename costs nothing. */
  const KEYS = {
    collected: "wfprimes.collected.v1",
    parts:     "wfprimes.parts.v1",
    materials: "wfprimes.materials.v1",
    wishlist:  "wfprimes.wishlist.v1",
    plan:      "wfprimes.plan.v1",
    filters:   "wfprimes.filters.v1",
  };

  /* Anything saved under the old name, moved across once and left where it was.
     Copy rather than move: if this build turns out to be broken, the old app
     still finds its data, and a migration you cannot walk back from is a poor
     trade for tidiness. Runs before anything reads the store. */
  const LEGACY_PREFIX = "vorframe.";
  (function migrate() {
    try {
      Object.keys(KEYS).forEach((name) => {
        const now = KEYS[name];
        if (localStorage.getItem(now) != null) return;      // already here
        const then = LEGACY_PREFIX + now.slice(now.indexOf(".") + 1);
        const old = localStorage.getItem(then);
        if (old != null) localStorage.setItem(now, old);
      });
    } catch (e) { /* private mode, quota, or no storage at all */ }
  })();

  const load = (k, dflt) => {
    try {
      const v = JSON.parse(localStorage.getItem(k) || "null");
      return v == null ? dflt : v;
    } catch (e) { return dflt; }
  };
  const save = (k, v) => {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* full or blocked */ }
  };

  /* ── the collection itself ───────────────────────────────────────
     Three slices of what you own, and every page reads and writes all three.
     They lived twice, once per page, kept in step by hand — and they drifted,
     twice, in ways nobody noticed until someone went looking:

       * only the planner listened for `storage`, so ticking a part there left
         an open collection tab showing the old count until it was reloaded.
         The other direction worked. Nothing said that was deliberate.
       * the same click meant two things. A part counter on the collection page
         cycles `0 → 1 → … → need → 0`; on the planner it only ever incremented
         and clamped, so a mis-click there could not be undone.

     Both are gone because both pages now go through here. That is the point of
     this object: not tidiness, but that there is one place for a rule to live,
     so a second place cannot disagree with it.

     `subscribe` is how a page hears about a change — including one made in
     another tab, which arrives through the same path as one made in this one.
     No DOM is touched here; what a page does about a change is the page's
     business. */
  function makeState() {
    let collected = new Set(load(KEYS.collected, []));
    let parts = load(KEYS.parts, {});
    let wishlist = load(KEYS.wishlist, []);
    const listeners = [];

    /* Which slice moved, and whether it moved somewhere else.

       `external` is the distinction that matters. A page that changes something
       itself usually knows exactly what to repaint — one counter, one card —
       and rebuilding everything would throw away the focus and the scroll
       position for no reason. A change arriving from another tab has no such
       context: nothing local prompted it, so the honest response is to redraw.
       One path, with enough information to react correctly to both. */
    const emit = (what, external) =>
      listeners.forEach((fn) => fn({ slice: what, external: !!external }));

    const write = {
      collected: () => save(KEYS.collected, Array.from(collected)),
      parts: () => save(KEYS.parts, parts),
      wishlist: () => save(KEYS.wishlist, wishlist),
    };
    const commit = (what) => { write[what](); emit(what); };

    const needOf = (p) => (p && p.itemCount) || 1;

    const api = {
      /* Read-only by convention, and by shape where it is cheap: `collected` is
         a Set the pages only ever ask `.has()` of. The mutations below are the
         supported way in, and the only way that saves and notifies. */
      get collected() { return collected; },
      get parts() { return parts; },
      get wishlist() { return wishlist; },

      has: (id) => collected.has(id),
      owns: (id, part) => (parts[id] || {})[part] || 0,
      wants: (id) => wishlist.indexOf(id) >= 0,

      /* How many of a part you hold. Clamped to nothing sensible here on
         purpose — `cyclePart` owns the wrap and `setAllParts` the fill, and a
         caller that has already worked out the number should be able to set
         it. */
      setPart(id, name, n) {
        const bag = parts[id] || (parts[id] = {});
        if (n > 0) bag[name] = n; else delete bag[name];
        if (!Object.keys(bag).length) delete parts[id];
        commit("parts");
      },

      /* One click on a part counter, and the one definition of what that
         means: up by one, and round to zero past the last. It is a cycle
         rather than a clamp because the alternative is a mis-click you cannot
         take back, which is exactly what the planner used to be. */
      cyclePart(item, part) {
        const need = needOf(part);
        this.setPart(item.id, part.name, (this.owns(item.id, part.name) + 1) % (need + 1));
      },

      setAllParts(item, full) {
        if (!item.parts || !item.parts.length) return;
        item.parts.forEach((p) => {
          const bag = parts[item.id] || (parts[item.id] = {});
          if (full) bag[p.name] = needOf(p); else delete bag[p.name];
        });
        if (parts[item.id] && !Object.keys(parts[item.id]).length) delete parts[item.id];
        commit("parts");
      },

      partsDone: (item) =>
        (item.parts || []).filter((p) => api.owns(item.id, p.name) >= needOf(p)).length,
      partsComplete: (item) =>
        (item.parts || []).length > 0 &&
        item.parts.every((p) => api.owns(item.id, p.name) >= needOf(p)),

      /* Owning every part does not make an item collected — that is a claim
         you make, not one the app makes for you (`PROJECT.md §1`). This only
         ever retracts: nothing can be collected while a part is missing, so
         taking one back retracts the claim rather than leaving a card reading
         "collected, 2 of 4". */
      syncCollected(item) {
        if (!item.parts || !item.parts.length) return;
        if (!api.partsComplete(item) && collected.delete(item.id)) commit("collected");
      },

      setCollected(id, on) {
        if (on) collected.add(id); else collected.delete(id);
        commit("collected");
      },
      toggleCollected(id) { api.setCollected(id, !collected.has(id)); },

      addWish(id) {
        if (wishlist.indexOf(id) >= 0) return;
        wishlist = wishlist.concat([id]);
        commit("wishlist");
      },
      removeWish(id) {
        wishlist = wishlist.filter((x) => x !== id);
        commit("wishlist");
      },
      toggleWish(id) {
        if (wishlist.indexOf(id) >= 0) api.removeWish(id); else api.addWish(id);
      },
      clearWishlist() { wishlist = []; commit("wishlist"); },

      /* After a restore, which writes the keys behind this object's back
         because `parseBackup` validates whole slices at once. */
      reload() {
        collected = new Set(load(KEYS.collected, []));
        parts = load(KEYS.parts, {});
        wishlist = load(KEYS.wishlist, []);
      },

      /* Drop wishlist entries for items that are no longer in the catalogue.
         The planner did this on load and the collection view did not, so a
         renamed Prime left a farm-list entry only one of them ignored. */
      pruneWishlist(known) {
        const kept = wishlist.filter((id) => known(id));
        if (kept.length !== wishlist.length) { wishlist = kept; commit("wishlist"); }
      },

      subscribe(fn) { listeners.push(fn); },
    };

    /* The same change, arriving from another tab. It goes through `emit` like
       any other, so a page needs one handler rather than two — and both pages
       now get this, where before only the planner did. */
    window.addEventListener("storage", (e) => {
      const slice = Object.keys(write).find((k) => KEYS[k] === e.key);
      if (!slice) return;
      if (slice === "collected") collected = new Set(load(KEYS.collected, []));
      if (slice === "parts") parts = load(KEYS.parts, {});
      if (slice === "wishlist") wishlist = load(KEYS.wishlist, []);
      emit(slice, true);
    });

    return api;
  }

  /* ── the tooltip ─────────────────────────────────────────────────
     One element, moved around, because a native title= is proportional and
     turns the aligned columns in the rotation tooltips to mush. Installs
     itself: any element with data-tip gets it, on either page. */
  const tipEl = document.createElement("div");
  tipEl.className = "tip";
  tipEl.hidden = true;
  document.body.appendChild(tipEl);

  function showTip(el) {
    tipEl.textContent = el.dataset.tip || "";
    tipEl.hidden = false;
    const r = el.getBoundingClientRect();
    const t = tipEl.getBoundingClientRect();
    const left = Math.min(r.left, window.innerWidth - t.width - 10);
    let top = r.bottom + 7;
    if (top + t.height > window.innerHeight - 8) top = r.top - t.height - 7;
    tipEl.style.left = Math.max(8, left) + "px";
    tipEl.style.top = Math.max(8, top) + "px";
  }

  document.addEventListener("mouseover", (e) => {
    const el = e.target.closest("[data-tip]");
    if (el) showTip(el); else if (!tipEl.hidden) tipEl.hidden = true;
  });
  document.addEventListener("mouseleave", () => { tipEl.hidden = true; }, true);
  window.addEventListener("scroll", () => { tipEl.hidden = true; }, true);

  /* ── is this data still current ──────────────────────────────────
     A failed refresh used to be a line in the footer, which nobody scrolls to.
     If the data is behind, say so above the fold and say what to do about it. */
  function staleBanner() {
    const m = DATA.meta || {};
    /* The server checks upstream before serving the data file and plants the
       answer on it. Nothing is fetched from here - the page never talks to
       Digital Extremes, and does not know the check happened. Absent on
       file:// and on GitHub Pages, where no server ran. */
    const up = window.WFPRIME_UPSTREAM;
    const stale = (m.stale || []).length ? m.stale : null;
    const degraded = (m.degraded || []).length ? m.degraded : null;
    const built = m.generated ? new Date(m.generated) : null;
    const days = built ? Math.floor((Date.now() - built.getTime()) / 86400000) : 0;
    const moved = up && up.stale && (up.moved || []).length ? up.moved : null;
    const old = !stale && !degraded && !moved && days >= 14;
    if (!stale && !degraded && !moved && !old) return;

    const el = document.createElement("div");
    el.className = "databar " + (degraded ? "bad" : "warn");

    /* Two audiences. Whoever runs the server can fix this and is told how, in
       the only terms that matter to them - the file they double-click. Anyone
       else is just reading someone else's copy: telling them to run a script
       they do not have is noise, so they get the warning and nothing more.

       The server answers this, because it is the only party that can: it sees
       the peer address and stamps `owner` onto the payload it already attaches
       to the data file. The page used to guess from location.hostname and was
       wrong in both directions - browse your own server by its LAN address and
       you were treated as a guest, warned about something you could fix and not
       told how.

       With no server there is no answer and the guess is all there is, which is
       fine for the two cases it covers: a file:// copy has an empty hostname and
       you must have the folder to be reading it at all, while a published site
       has a real one and its readers cannot fix anything. */
    const yours = up && typeof up.owner === "boolean"
      ? up.owner
      : ["localhost", "127.0.0.1", "::1", ""].indexOf(location.hostname) >= 0;
    const fix = yours ? " Double-click <code>refresh-data.cmd</code> to update it." : "";

    el.innerHTML = moved
      ? "<b>Out of date.</b> Digital Extremes have published newer data than this." + fix
      : degraded
        ? "<b>Some data is missing.</b> This copy was built without " +
          esc(degraded.join(", ")) + ", so items or drop locations may be absent." + fix
        : stale
          ? "<b>Showing older data.</b> The last update could not reach " +
            esc(stale.join(", ")) + ", so an earlier copy is being shown" +
            (days ? " (from " + days + " day" + (days === 1 ? "" : "s") + " ago)" : "") +
            ". Vaulting and Resurgence may have moved on since." + fix
          : "<b>This data is " + days + " days old.</b> Prime Resurgence rotates every " +
            "28 days, and drop tables change with each update." + fix;
    const header = document.querySelector("header.topbar");
    if (header && header.parentNode) header.parentNode.insertBefore(el, header.nextSibling);
  }

  /* Everything the reader took the trouble to set. A backup that restores your
     collection but loses your farm list and options is not a backup.

     Built here because both pages offered the same dialog and assembled the
     same six keys independently — which is one place too many for a format,
     and the reason the two once accepted different halves of the same file.
     Read straight from the store rather than from either page's variables, so
     it cannot capture a stale copy of anything.

     `extra` is for what a page owns and the store does not: the materials
     checklist lives only on the collection view. */
  function backupPayload(extra) {
    return Object.assign({
      // Not the app's name: parseBackup never reads this field, and a file
      // format that carries a brand needs rewriting every time the brand does.
      format: 3,
      exported: new Date().toISOString(),
      collected: load(KEYS.collected, []),
      parts: load(KEYS.parts, {}),
      materials: load(KEYS.materials, []),
      wishlist: load(KEYS.wishlist, []),
      filters: load(KEYS.filters, null),
      plan: load(KEYS.plan, {}),
    }, extra || {});
  }

  /* ── backup to and from a file ───────────────────────────────────
     Copy-and-paste works and stays, but it assumes you know what to do with a
     wall of JSON. These two do the same job for anyone who does not: one
     downloads a dated .json, the other reads one back and clicks the page's own
     import button, so there is only ever one import path to be right. */
  function backupFilename() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `prime-hunter-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
  }

  function wireFileBackup() {
    const dl = document.getElementById("downloadBtn");
    if (dl) {
      dl.addEventListener("click", () => {
        const blob = new Blob([document.getElementById("dataArea").value],
                              { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = backupFilename();
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        const msg = document.getElementById("dlgMsg");
        msg.style.color = "";
        msg.textContent = "Saved as " + a.download + " — keep it somewhere safe.";
      });
    }
    const up = document.getElementById("uploadBtn");
    const upFile = document.getElementById("uploadFile");
    if (up && upFile) {
      up.addEventListener("click", () => upFile.click());
      upFile.addEventListener("change", () => {
        const file = upFile.files && upFile.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          document.getElementById("dataArea").value = String(reader.result || "");
          document.getElementById("importBtn").click();   // one import, not two
        };
        reader.onerror = () => {
          const msg = document.getElementById("dlgMsg");
          msg.style.color = "var(--red)";
          msg.textContent = "Could not read that file.";
        };
        reader.readAsText(file);
        upFile.value = "";                                 // same file twice works
      });
    }
  }

  /* Four players cracking the same relic at the same refinement see four
     rewards and keep the best, so a chance p becomes 1 - (1 - p)^4. Lives here
     because the two pages want it in different units - the collection view
     works in percentages, the planner in probabilities - and the formula was
     written out once in each, which is one place too many for a rule that
     decides every number on both pages. Takes a probability. */
  const squadOdds = (p) => 1 - Math.pow(1 - p, 4);

  /* ── the one part of the payload that expires ─────────────────────
     Everything else here moves a few times a year. Fissures move every hour or
     two, so a page left open all evening was built on a list that had run out -
     it could only ever lose badges, never gain the ones that opened since.

     `data/fissures.json` is the same list on its own, four kilobytes beside a
     1.9 MB payload, written by the same build. Re-reading it every ten minutes
     costs a rounding error and keeps an open tab as current as the schedule
     behind it: ten minutes on both the local task and the published site.

     **Same origin, always.** It is fetched from wherever the page was served
     and never from api.warframestat.us, so `connect-src 'self'` stands as it is
     and nobody reading this site appears in a third party's logs. Keeping the
     data current is the scheduled build's job; this is only how its answer
     reaches a page that is already open.

     Mutated in place rather than reassigned, because both pages took a
     reference to this array at load. Normalised first for the same reason: a
     build old enough to have no fissure list at all would otherwise leave each
     page holding a private empty array that this could never reach. */
  const FISSURE_REFRESH_MS = 10 * 60 * 1000;
  if (!Array.isArray(DATA.fissures)) DATA.fissures = [];

  function watchFissures(onChange) {
    const live = DATA.fissures;
    let seen = JSON.stringify(live);
    const pull = () => {
      if (typeof fetch !== "function") return;
      /* `no-cache` revalidates; `no-store` would refuse to cache at all and pay
         for the whole four kilobytes every time. The server answers a
         conditional request with 304 and no body, which is the same trade the
         build makes against api.warframestat.us - ask often, transfer rarely.
         Either way the answer is never a cached copy served without asking. */
      fetch("data/fissures.json", { cache: "no-cache" })
        .then((r) => (r.ok ? r.json() : null))
        .then((doc) => {
          if (!doc || !Array.isArray(doc.fissures)) return;
          const now = JSON.stringify(doc.fissures);
          if (now === seen) return;         // nothing moved; do not touch the page
          seen = now;
          live.splice.apply(live, [0, live.length].concat(doc.fissures));
          if (onChange) onChange();
        })
        /* file://, a bundled single file, a server that does not carry it, or
           no network. Every one of those means "keep what the payload shipped
           with", which is the same safe direction the list already fails in:
           it can go out of date, it cannot invent a fissure. */
        .catch(() => {});
    };
    /* Once on load as well, because the browser may have served the 1.9 MB
       payload out of its own cache while this four-kilobyte file is fetched
       fresh - which is exactly the case where the two disagree. */
    pull();
    setInterval(pull, FISSURE_REFRESH_MS);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) pull();
    });
  }

  /* ── Mastery Rank ────────────────────────────────────────────────
     An account fact, so it lives in the shared plan store beside `squad`
     rather than in either page's own filters - it is true on both pages and
     the two must not be able to disagree about it. Unset is `null` and stays
     that way until the player says otherwise: everything else in this project
     defaults to "not known, say nothing", and a rank guessed at would feed a
     trace cap that is simply wrong.

     It gates nothing, by the owner's decision of 2026-08-14, and the two halves
     of that go together: the field exists to say what something ASKS of you.
     The wiki is the reason - a bounty above your rank "can still be played,
     when an eligible squad member selects one" - so hiding a tier from someone
     whose friend can start it would be exactly the wrong answer. */

  /* DE's own three-rank cycle: a base title, then Silver, then Gold, ten times
     over for ranks 1-30. Taken from `wiki.warframe.com/w/Mastery_Rank`. Rank 0
     is Unranked and anything past 30 is Legendary, which the wiki writes LR1,
     LR2 ... with no published cap - so one integer is kept and rendered as
     `LR<n-30>` above 30, exactly as the spec asked. */
  const MR_BASES = ["Initiate", "Novice", "Disciple", "Seeker", "Hunter",
                    "Eagle", "Sage", "Knight", "Lord", "Architect"];
  const MR_TIERS = ["base", "silver", "gold"];
  const MR_TOP = 30;

  const mrClamp = (n) => (isFinite(n) && n >= 0 ? Math.floor(n) : null);

  /* "MR 13", "LR 2", or "—" when it has never been set. */
  function masteryLabel(mr) {
    if (mr == null) return "—";
    return mr > MR_TOP ? "LR " + (mr - MR_TOP) : "MR " + mr;
  }

  /* "Gold Seeker". Legendary ranks have their own naming beyond the table the
     wiki publishes, so they are not guessed at - they get the plain word. */
  function masteryTitle(mr) {
    if (mr == null) return null;
    if (mr === 0) return "Unranked";
    if (mr > MR_TOP) return "Legendary";
    const base = MR_BASES[Math.floor((mr - 1) / 3)];
    const tier = (mr - 1) % 3;
    return tier === 0 ? base : (tier === 1 ? "Silver " : "Gold ") + base;
  }

  /* Which of the three colours the sigil takes. Unranked and Legendary sit
     outside the cycle and get their own, so the badge never implies a tier the
     rank does not have. */
  function masteryTier(mr) {
    if (mr == null) return "none";
    if (mr === 0) return "none";
    if (mr > MR_TOP) return "legendary";
    return MR_TIERS[(mr - 1) % 3];
  }

  /* `wiki.warframe.com/w/Void_Traces`: "This cap is determined by one's Mastery
     Rank using the formula: (Mastery Rank × 50) + 100." The page's own worked
     examples are MR13 = 750 and MR30 = 1600, and both fall out of this. A
     Legendary rank keeps counting from 30, so LR1 is 31 and the same formula
     carries - that continuation is ours rather than the wiki's, which stops its
     table at 30. */
  function traceCap(mr) {
    return mr == null ? null : mr * 50 + 100;
  }

  /* A Radiant costs 100 traces, and the planner's "Short on Void Traces?"
     switch splits at 500 - five Radiants. Below MR9 the cap is at or under 500,
     so the far side of that switch is not reachable at all. Worth SAYING and
     not worth enforcing: same rule as the rest of this field. */
  const TRACE_PIVOT = 500;
  const traceCapped = (mr) => mr != null && traceCap(mr) <= TRACE_PIVOT;

  /* The sigil. DE's own rank icons are not reachable from here: the wiki 403s
     any request that is not a browser (see PROJECT.md section 8) and the item
     CDN that supplies every other image in this app has no rank art - its
     backing store 404s `IconRank1.png` while item images resolve. Both were
     checked on 2026-08-26. So this is drawn rather than fetched, which also
     keeps it working from file:// and off a USB stick with no network at all.
     It is not a copy of DE's art and does not pretend to be; what it borrows is
     the structure that IS documented - the bronze/silver/gold three-rank cycle
     the rank titles themselves follow. */
  function masterySigil(mr) {
    const tier = masteryTier(mr);
    return '<svg class="mr-sigil" data-tier="' + tier + '" viewBox="0 0 24 24" ' +
      'aria-hidden="true" focusable="false">' +
      '<path d="M12 2 L21 12 L12 22 L3 12 Z" class="mr-sigil-body" />' +
      '<path d="M12 6.5 L17.5 12 L12 17.5 L6.5 12 Z" class="mr-sigil-core" />' +
      "</svg>";
  }

  /* Wires the header control on whichever page called it. Both pages carry the
     same markup, so this is one function rather than one per page, and a change
     made on either is written to the shared store and picked up by the other
     through the same `storage` event everything else uses. */
  function wireMastery(onChange) {
    const field = document.getElementById("mrField");
    if (!field) return null;
    const valueEl = document.getElementById("mrValue");
    const sigilEl = document.getElementById("mrSigil");
    const badge = document.getElementById("mrBadge");
    const down = document.getElementById("mrDown");
    const up = document.getElementById("mrUp");

    const read = () => mrClamp((load(KEYS.plan, {}) || {}).mastery);
    const write = (mr) => {
      const plan = load(KEYS.plan, {}) || {};
      plan.mastery = mr;
      save(KEYS.plan, plan);
    };

    function paint() {
      const mr = read();
      /* Two children updated separately rather than one innerHTML over the
         badge: rewriting the badge whole would destroy `valueEl` on the first
         paint and leave every later one writing to a detached node. */
      valueEl.textContent = masteryLabel(mr);
      sigilEl.innerHTML = masterySigil(mr);
      field.dataset.set = mr == null ? "no" : "yes";
      down.disabled = mr == null || mr === 0;

      const title = masteryTitle(mr);
      const cap = traceCap(mr);
      badge.dataset.tip = mr == null
        ? "Mastery Rank — not set.\n\nSet it and this says your Void Trace cap, and " +
          "nodes can say what rank they ask of you. It never hides anything: a " +
          "bounty above your rank can still be played when a squadmate starts it."
        : masteryLabel(mr) + " — " + title + ".\n\n" +
          "Void Trace cap " + cap + " — (rank × 50) + 100.\n" +
          "A Radiant costs 100, so that is " + Math.floor(cap / 100) + " of them." +
          (traceCapped(mr)
            ? "\n\nAt this rank you cannot hold more than " + TRACE_PIVOT + ", so the " +
              "planner's “Short on Void Traces?” switch has no far side to reach."
            : "");
      if (onChange) onChange(mr);
    }

    const step = (by) => {
      const mr = read();
      /* From unset, `+` lands on 0 rather than 1: Unranked is a real rank and
         the alternative is a field that cannot express it. `−` from unset does
         nothing, there being nothing below it. */
      const next = mr == null ? (by > 0 ? 0 : null) : Math.max(0, mr + by);
      if (next === mr) return;
      write(next);
      paint();
    };

    up.addEventListener("click", () => step(1));
    down.addEventListener("click", () => step(-1));

    /* The same rank, changed in the other tab. It is one shared value and the
       two headers must not drift apart while both are open. */
    window.addEventListener("storage", (e) => {
      if (e.key === KEYS.plan) paint();
    });

    paint();
    return { read, paint };
  }

  window.WFPrimeShared = {
    esc, $, $$, KEYS, load, save, showTip, staleBanner, wireFileBackup, squadOdds,
    watchFissures, FISSURE_REFRESH_MS, backupPayload,
    masteryLabel, masteryTitle, masteryTier, traceCap, traceCapped, TRACE_PIVOT,
    MR_TOP, wireMastery,
    /* One store per page, made here so the `storage` listener is registered
       once and both pages share the rules rather than a copy of them. */
    state: makeState(),
  };
})();
