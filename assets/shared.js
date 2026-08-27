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

  /* A count, or the fallback if it is not one.

     Counts arrive from two places that are documented as sending numbers and
     are not obliged to: the payload, built from a third-party items API, and
     `localStorage`, which a person can hand-edit and which `Import` writes
     from a file they chose. Both ends reach `innerHTML` through template
     concatenation — `${have}/${need}` — so "documented as numeric" was doing
     the work `esc()` does two lines below it in the same template.

     Numeric strings are accepted and converted, because an older backup can
     legitimately hold "2"; anything that is not a whole count is refused
     rather than rendered. Coerce here, at the accessor, rather than at each
     of the eleven places a count is interpolated: those are easy to add to
     and nobody adding the twelfth will remember.

     `Number()` alone is not enough and looks like it is: `Number([])` is 0,
     `Number(true)` is 1, and `Number({ toString: () => "9" })` is 9. So the
     type is checked before the value, and only two types are ever a count. */
  const count = (v, dflt) => {
    if (typeof v === "number") {
      return Number.isInteger(v) && v >= 0 ? v : dflt;
    }
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v);
      if (Number.isInteger(n) && n >= 0) return n;
    }
    return dflt;
  };

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  /* ── wired once per document ─────────────────────────────────────
     The single-file build in `dist/` is both pages in one document, so app.js
     and plan.js run one after the other over the same DOM and every shared
     wiring call below happens twice. Nothing about that is obvious on either
     page on its own, and the results were not obvious either: the Mastery Rank
     stepper moved two ranks a press because `#mrUp` had two listeners, one
     press of Download backup wrote the file twice, an old build drew two stale
     banners, and `data/fissures.json` was polled twice for as long as the page
     stayed open.

     So these are idempotent by this flag rather than by luck. The first call
     does the work and its return value is kept; every later call gets that
     same value back without touching the DOM again. Keyed by name rather than
     by a marker on an element, because two of them (`staleBanner`, the fissure
     poller) create what they own rather than finding it. */
  const wired = Object.create(null);
  const once = (name, fn) => {
    if (!(name in wired)) wired[name] = fn();
    return wired[name];
  };

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

    const needOf = (p) => count(p && p.itemCount, 1) || 1;

    const api = {
      /* Read-only by convention, and by shape where it is cheap: `collected` is
         a Set the pages only ever ask `.has()` of. The mutations below are the
         supported way in, and the only way that saves and notifies. */
      get collected() { return collected; },
      get parts() { return parts; },
      get wishlist() { return wishlist; },

      has: (id) => collected.has(id),
      owns: (id, part) => count((parts[id] || {})[part], 0),
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
  /* What each source key actually feeds, in the reader's words.

     The banner printed the keys themselves, so the deployed site told a stranger
     *"could not reach api_events, api_fissures, api_syndicatemissions,
     api_vaulttrader"* — four internal names for what is one thing to a reader,
     none of which they can act on, under a heading that reads as though the
     whole catalogue is behind. It was not: those four are the live worldstate,
     and the 167 items, 763 relics and every drop table beside them were built
     minutes earlier and current.

     A key absent from this map is deliberately un-named rather than guessed at,
     and its presence is what withdraws the "everything else is current" claim
     below — that sentence is only true while every reused source is one of
     these. */
  const FEEDS = {
    api_fissures: "Void Fissures",
    api_syndicatemissions: "bounty rotations",
    api_events: "bounty rotations",
    api_vaulttrader: "Prime Resurgence",
  };

  /* Listed in this order rather than in the order the keys happen to arrive.
     `meta.stale` is sorted alphabetically, which put `api_events` first and
     produced "bounty rotations, Void Fissures and Prime Resurgence" — true, and
     it reads like a machine. */
  const FEED_ORDER = ["Void Fissures", "bounty rotations", "Prime Resurgence"];

  function feedNames(keys) {
    const hit = {};
    (keys || []).forEach((k) => { if (FEEDS[k]) hit[FEEDS[k]] = true; });
    return FEED_ORDER.filter((name) => hit[name]);
  }

  const listWords = (a) => (a.length < 2 ? (a[0] || "")
    : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]);

  /* How long ago, at the coarseness that matters. Minutes while the answer is
     "ignore this", days by the time it is "do not trust the fissure list". */
  function agoWords(iso, now) {
    const t = iso ? Date.parse(iso) : NaN;
    if (!isFinite(t)) return null;
    const mins = Math.max(0, Math.round((now - t) / 60000));
    if (mins < 90) return mins + " minute" + (mins === 1 ? "" : "s") + " ago";
    const hours = Math.round(mins / 60);
    if (hours < 36) return hours + " hour" + (hours === 1 ? "" : "s") + " ago";
    const days = Math.round(hours / 24);
    return days + " day" + (days === 1 ? "" : "s") + " ago";
  }

  /* The whole banner as text, with no DOM in sight, because every bug this has
     ever had was in what it said rather than in where it was put. `yours` is
     the owner answer the server stamps; `now` is passed so a test can hold the
     clock still. Returns null when there is nothing worth saying. */
  function staleNotice(meta, up, yours, now) {
    const m = meta || {};
    const stale = (m.stale || []).length ? m.stale : null;
    const degraded = (m.degraded || []).length ? m.degraded : null;
    const built = m.generated ? new Date(m.generated) : null;
    const days = built ? Math.floor((now - built.getTime()) / 86400000) : 0;
    const moved = up && up.stale && (up.moved || []).length ? up.moved : null;
    const old = !stale && !degraded && !moved && days >= 14;
    if (!stale && !degraded && !moved && !old) return null;

    const fix = yours ? " Double-click <code>refresh-data.cmd</code> to update it." : "";

    if (moved) {
      return { level: "warn",
               html: "<b>Out of date.</b> Digital Extremes have published newer "
                     + "data than this." + fix };
    }
    if (degraded) {
      return { level: "bad",
               html: "<b>Some data is missing.</b> This copy was built without "
                     + esc(degraded.join(", "))
                     + ", so items or drop locations may be absent." + fix };
    }
    if (stale) {
      const feeds = feedNames(stale);
      const liveOnly = stale.every((k) => Object.prototype.hasOwnProperty.call(FEEDS, k));
      const when = agoWords(m.staleSince, now);
      /* Named for the owner only. They are the one party who can look at a
         source key and do something about it; to everyone else it is the same
         noise the two-audience rule below already refuses to print. */
      const which = yours ? " Reused: " + esc(stale.join(", ")) + "." : "";
      return {
        level: "warn",
        html: "<b>Live data is an older copy.</b> "
              + (feeds.length ? esc(listWords(feeds)) : "Some live data")
              + " could not be refreshed, so " + (feeds.length ? "those are" : "it is")
              + " from " + (when ? "a copy made " + esc(when) : "an earlier copy") + "."
              + (liveOnly
                 ? " The catalogue, relics and drop tables are current." : "")
              + which + fix,
      };
    }
    return { level: "warn",
             html: "<b>This data is " + days + " days old.</b> Prime Resurgence "
                   + "rotates every 28 days, and drop tables change with each "
                   + "update." + fix };
  }

  function staleBanner() { return once("staleBanner", drawStaleBanner); }

  function drawStaleBanner() {
    /* The server checks upstream before serving the data file and plants the
       answer on it. Nothing is fetched from here - the page never talks to
       Digital Extremes, and does not know the check happened. Absent on
       file:// and on GitHub Pages, where no server ran. */
    const up = window.WFPRIME_UPSTREAM;

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

    const notice = staleNotice(DATA.meta, up, yours, Date.now());
    if (!notice) return;

    const el = document.createElement("div");
    el.className = "databar " + notice.level;
    el.innerHTML = notice.html;
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

  function wireFileBackup() { return once("wireFileBackup", bindFileBackup); }

  function bindFileBackup() {
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

  /* One poller, every caller's callback. `once` on its own would be wrong here
     and quietly so: it would keep the first caller's callback and drop the
     rest, and in the single-file build the first caller is app.js, which passes
     none — so the planner would never repaint a fissure that opened while the
     page was open. Registering the callback before starting the poller is what
     makes "poll once" safe rather than merely cheap. Both callers are
     registered before the first response arrives, since the fetch is async and
     both page scripts have run by then. */
  const fissureWatchers = [];

  function watchFissures(onChange) {
    if (onChange) fissureWatchers.push(onChange);
    once("watchFissures", startFissurePoll);
  }

  function startFissurePoll() {
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
          fissureWatchers.forEach((fn) => fn());
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
    return true;
  }

  /* ── the site footer ─────────────────────────────────────────────
     Attribution, privacy and licensing, in one quiet line at the foot of both
     pages. It used to sit inside the collection sidebar's data note, which put
     it on one page of two — a licence notice the planner never carried — and
     buried it under three lines about when the data was last built.

     Written here rather than in both HTML files so there is one copy to keep
     true. Two documents drifting apart is the ordinary cost of duplication;
     for a privacy claim and a content-policy attribution it is worse than
     ordinary, because the wrong half still reads as authoritative. */
  /* Every `#siteFoot` in the document, not the first one. `getElementById`
     returns one element, and in the single-file build there were two — so both
     calls filled the collection's and the planner tab carried an empty footer,
     which is the one piece of chrome that must not go missing: it holds the
     licence and the Content Policy attribution. `bundle.py` now emits one
     footer for both views, and this fills whatever it finds, so the two
     failures would have to happen together to put a blank footer on screen
     again. Not wrapped in `once` for the same reason — running twice writes
     the same markup twice, which costs nothing and hides nothing. */
  function siteFooter() {
    const feet = $$("#siteFoot");
    if (!feet.length) return;
    /* A template literal rather than concatenation, and not for taste: the
       bundle check scans the built file for an href attribute whose value is
       neither a URL nor an interpolation, and calls it a local file reference.
       Concatenated, the literal left behind matched and failed the build;
       `${href}` is the form that check knows to skip, and it is what the rest
       of the project writes anyway. Do not spell the pattern out in a comment
       either — the bundler inlines these verbatim, and this one failed the
       build twice: once for the code, then once for the note about the code. */
    const link = (href, text) =>
      `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
    const dot = '<span class="foot-dot">·</span>';

    /* This paragraph used to assert, unconditionally, that "artwork and data are
       served from this site, so no third party sees your visit". That is true of
       a local copy built with --with-images and false of the two artefacts most
       people actually read: CI builds the published site without images, and
       bundle.py rewrites local paths back to the CDN for the standalone. So the
       claim was false on GitHub Pages and false in the download, 167 times per
       page load, in the one paragraph a reader has no way to check.

       `meta.sources.images` already says which build this is, and serve.py reads
       the same signal to decide whether its CSP may name the CDN at all — so the
       sentence is derived from the same fact as the enforcement rather than
       asserted beside it. */
    function artworkNote() {
      const src = ((DATA.meta || {}).sources || {}).images || "";
      return src.indexOf("assets/img") === 0
        ? "Artwork and data are served from this site, so no third party sees your visit. "
        : "Data is served from this site, but artwork loads from " +
          link("https://cdn.warframestat.us", "cdn.warframestat.us") +
          ", which therefore sees your address and which items you looked at. " +
          "A copy built with artwork included fetches nothing at all. ";
    }

    /* The rate limiter is a property of tools/serve.py, and saying so on a page
       served by GitHub Pages or opened from file:// describes a server that is
       not there. `WFPRIME_UPSTREAM` exists only when serve.py answered, which is
       the same signal the stale banner uses to tell an owner from a guest. */
    function rateLimitNote() {
      if (!window.WFPRIME_UPSTREAM) return "";
      return "The server counts requests per visitor briefly, in memory only, " +
        "purely to stop one client overwhelming it; addresses are keyed-hashed " +
        "with a per-session salt, never written down, and discarded when it stops.";
    }
    const html = "<p>" +
      "WARFRAME and all related data, names and artwork are the property of " +
      link("https://www.warframe.com", "Digital Extremes Ltd.") + ", used under their " +
      link("https://www.warframe.com/en/contentpolicy", "Content Policy") +
      " for non-commercial fan works. Warframe Prime Hunter is an unofficial fan " +
      "project, not affiliated with or endorsed by Digital Extremes." + dot +
      "Your collection is stored in this browser and is sent nowhere — there is no " +
      "account, no cookie and no analytics. " + artworkNote() + rateLimitNote() + dot +
      "Catalogue data from the " +
      link("https://wiki.warframe.com/w/Prime", "WARFRAME Wiki") +
      " (CC BY-SA); item and worldstate data via " +
      link("https://github.com/WFCD", "WFCD") +
      " (MIT / Apache-2.0). Warframe Prime Hunter's own code is MIT licensed." +
      "</p>";
    feet.forEach((foot) => { foot.innerHTML = html; });
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
  const MR_TOP = 30;

  /* The `typeof` is load-bearing and was not there at first: `isFinite(null)` is
     **true** in JavaScript — null coerces to 0 — so a cleared rank read back as
     `Math.floor(null)`, which is 0. Unranked and unset are different answers,
     and that turned every "I have not said" into "I am rank 0". Latent until the
     box became typeable, because nothing had ever written null before. */
  const mrClamp = (n) =>
    typeof n === "number" && isFinite(n) && n >= 0 ? Math.floor(n) : null;

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

  /* What the box shows, which above 30 is NOT what is stored. The rank keeps
     counting as one integer - 31, 32 - and the label beside the box carries the
     "LR", so the box shows `n - 30`. Splitting it this way is the whole reason
     the letters could leave the field: they were never part of the value. */
  const masteryShown = (mr) =>
    mr == null ? "" : String(mr > MR_TOP ? mr - MR_TOP : mr);

  /* And the way back, which needs to know which label the reader was looking at.
     In MR mode the typed number IS the rank, so typing 31 rolls over to LR 1 on
     its own and there is a way into Legendary from the keyboard. In LR mode the
     typed number is the Legendary one, so it is offset - and typing 0 there
     lands on MR 30, the rank below LR 1.

     `undefined` means "not a number", which is different from `null` meaning
     "cleared". The caller must not write the first and must write the second. */
  function masteryTyped(raw, legendary) {
    const t = String(raw == null ? "" : raw).trim();
    if (t === "") return null;
    if (!/^\d+$/.test(t)) return undefined;
    const n = parseInt(t, 10);
    return legendary ? MR_TOP + n : n;
  }

  /* Wires the header control on whichever page called it. Both pages carry the
     same markup, so this is one function rather than one per page, and a change
     made on either is written to the shared store and picked up by the other
     through the same `storage` event everything else uses. */
  function wireMastery() { return once("wireMastery", bindMastery); }

  function bindMastery() {
    const field = document.getElementById("mrField");
    if (!field) return null;
    const input = document.getElementById("mrInput");
    const label = document.getElementById("mrLabel");
    const down = document.getElementById("mrDown");
    const up = document.getElementById("mrUp");

    const read = () => mrClamp((load(KEYS.plan, {}) || {}).mastery);
    const write = (mr) => {
      const plan = load(KEYS.plan, {}) || {};
      plan.mastery = mr;
      save(KEYS.plan, plan);
    };
    const legendary = () => label.textContent === "LR";

    function paint() {
      const mr = read();
      input.value = masteryShown(mr);
      label.textContent = mr != null && mr > MR_TOP ? "LR" : "MR";
      /* The visible label is aria-hidden, so the field has to say which of the
         two it is or a screen reader hears a bare number. */
      input.setAttribute("aria-label",
        mr != null && mr > MR_TOP ? "Legendary Rank" : "Mastery Rank");
      field.dataset.set = mr == null ? "no" : "yes";
      down.disabled = mr == null || mr === 0;

      const cap = traceCap(mr);
      field.dataset.tip = mr == null
        ? "Mastery Rank — not set.\n\nType it in, or use the arrows. Once it is set " +
          "this says your Void Trace cap, and nodes can say what rank they ask of " +
          "you. It never hides anything: a bounty above your rank can still be " +
          "played when a squadmate starts it."
        : masteryLabel(mr) + " — " + masteryTitle(mr) + ".\n\n" +
          "Void Trace cap " + cap + " — (rank × 50) + 100.\n" +
          "A Radiant costs 100, so that is " + Math.floor(cap / 100) + " of them." +
          (traceCapped(mr)
            ? "\n\nAt this rank you cannot hold more than " + TRACE_PIVOT + ", so the " +
              "planner's “Short on Void Traces?” switch has no far side to reach."
            : "");
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

    /* Committed on blur and on Enter, never on every keystroke: a field that
       saved as you typed would store MR 1 on the way to MR 13, and each of those
       is a real rank with a real trace cap. Anything that is not a whole number
       is refused by putting back what is stored, rather than by writing a
       guess. */
    function commit() {
      const next = masteryTyped(input.value, legendary());
      if (next !== undefined) write(next);
      paint();
    }

    up.addEventListener("click", () => step(1));
    down.addEventListener("click", () => step(-1));
    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); commit(); input.blur(); }
      else if (e.key === "Escape") { paint(); input.blur(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); step(1); }
      else if (e.key === "ArrowDown") { e.preventDefault(); step(-1); }
    });

    /* The same rank, changed in the other tab. It is one shared value and the
       two headers must not drift apart while both are open - but not while this
       one is being typed into, where repainting would eat the half-typed rank. */
    window.addEventListener("storage", (e) => {
      if (e.key === KEYS.plan && document.activeElement !== input) paint();
    });

    paint();
    return { read, paint };
  }

  window.WFPrimeShared = {
    esc, count, $, $$, KEYS, load, save, showTip, staleBanner, staleNotice,
    wireFileBackup, squadOdds,
    watchFissures, FISSURE_REFRESH_MS, backupPayload,
    masteryLabel, masteryTitle, masteryShown, masteryTyped,
    traceCap, traceCapped, TRACE_PIVOT, MR_TOP, wireMastery, siteFooter,
    /* One store per page, made here so the `storage` listener is registered
       once and both pages share the rules rather than a copy of them. */
    state: makeState(),
  };
})();
