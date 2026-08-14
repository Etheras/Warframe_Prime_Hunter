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

  window.WFPrimeShared = {
    esc, $, $$, KEYS, load, save, showTip, staleBanner, wireFileBackup, squadOdds,
  };
})();
