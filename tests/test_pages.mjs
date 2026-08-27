/* Prime Hunter's page tests — the ones that need a real browser.
 *
 *     node --test tests/test_pages.mjs
 *     python tests/test_build.py         # runs these too, if Playwright is here
 *
 * app.js and plan.js are DOM from top to bottom: 124 and 62 browser-API calls
 * between them, across `closest`, `innerHTML`, `dataset`, `<dialog>`,
 * FileReader, Blob and focus handling. Stubbing that is writing a browser
 * badly, so these drive a real one instead.
 *
 * **Entirely optional.** Playwright is a large download and Prime Hunter needs
 * nothing at all to run, so if it is not installed every test here skips and
 * the rest of the suite is unaffected:
 *
 *     npm install                        # from the repo root
 *     npx playwright install chromium
 *
 * The pages are served over http rather than opened from file://, because
 * localStorage is restricted on file:// in some browsers - which is the same
 * reason README tells people to use serve.cmd.
 */

import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/* Resolved at run time, not imported at the top: a missing Playwright must
   skip these tests, not fail the file on an unresolved import. */
let chromium = null;
try {
  ({ chromium } = await import("playwright"));
} catch {
  /* not installed - every test below skips */
}
const built = fs.existsSync(path.join(ROOT, "data", "prime-data.js"));
const why = !chromium ? "Playwright is not installed (npm install)"
  : !built ? "no dataset yet (run tools/build_data.py)" : null;

/* The same allowlist serve.py uses, minus everything else it does. Keeping the
   server here means these tests exercise the real pages, not a copy. */
const TYPES = { ".html": "text/html", ".js": "text/javascript",
                ".css": "text/css", ".png": "image/png" };

/* Every path this server was asked for. One test needs to count requests
   rather than inspect a page: "the fissure list is polled once" is a claim
   about the wire, and the DOM cannot answer it. */
const hits = [];

function serve() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html";
    hits.push(rel);
    const full = path.join(ROOT, rel);
    if (!full.startsWith(ROOT) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
      res.writeHead(404).end("no");
      return;
    }
    res.writeHead(200, { "content-type": TYPES[path.extname(full)] || "application/octet-stream" });
    fs.createReadStream(full).pipe(res);
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server)));
}

/* One browser and one server for the file, a fresh page per test - a page
   carries localStorage, and a test that inherited another's saved collection
   would pass or fail depending on the order they ran in. */
let server, browser, origin;

test.before(async () => {
  if (why) return;
  server = await serve();
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});

test.after(async () => {
  await browser?.close();
  server?.close();
});

/* Every page here opens exactly as it ships, on a cold profile. A context is
   its own browser as far as storage is concerned — empty localStorage, no
   cookies, nothing carried in — and one is made per test and closed the moment
   that test ends. So the app is never seen part-way through somebody else's
   session, and the only saved state anywhere is state a test wrote on purpose,
   for as long as that test is running.

   That is the whole of the arrangement, and it is why `open` takes no options:
   there is no state to opt out of. A test that needs a farm list, a rank or a
   restored backup writes one, asserts on it, and it goes when the profile does.

   Nothing is seeded ahead of load and no test inherits a state some other test
   wanted, which leaves two rules and only two:

   1. **A test that depends on a filter says so, on that filter.** `setCheck`
      reads the box and moves it only if it is not already where this test needs
      it — an intention rather than a flip, so it reads the same whether the
      default is on, off, or (like *Baro Ki'Teer*) decided by the calendar.
   2. **A test with no preference picks its subject from what is on screen**,
      on a property of the raw payload. `pickCard` does that; see its note.

   The alternative was tried first and is worth naming, because it looks tidier
   and is worse: seeding one everything-on state into `wfprimes.filters.v1`
   before the first load. It fixed the six failures of 2026-08-27 in one place —
   and it did so by making every test run against a screen no reader ever sees,
   so a test could quietly depend on *Vaulted* being on and never say which of
   the seven buckets it actually needed. The state a test needs is part of what
   it is asserting, and it belongs in the test.

   The five defaults that moved that afternoon are why this matters. *Vaulted*
   alone hides 113 of 167 Primes, *Founder* three more, and *Baro Ki'Teer* opens
   only the two days a fortnight he is on a relay — so 40 of 167 items are on
   screen as this file runs, and a test that names a Prime without saying which
   box shows it is asserting something about today's calendar. */

/* The real `<input>` sits under a styled `<span>` that swallows the pointer, so
   Playwright's own actionability check never sees it: `.check()` waits out the
   full timeout and reports a hang rather than a failure. Clicked through the
   page instead, and only when the box is not already where it is wanted. */
const setCheck = (target, selector, want) => target.evaluate(([sel, on]) => {
  const el = document.querySelector(sel);
  if (!el) throw new Error("no checkbox matches " + sel);
  if (el.checked !== on) el.click();
  return el.checked;
}, [selector, want]);

/* Several at once, in a fixed order so a re-render between two of them cannot
   change what the next one reads. */
async function setChecks(page, wanted) {
  for (const [sel, on] of Object.entries(wanted)) {
    const got = await setCheck(page, sel, on);
    assert.equal(got, on, `${sel} would not go ${on ? "on" : "off"}`);
  }
}

/* The whole catalogue, for the one test that is about the whole catalogue.
   Everything else should be asking for the single box it depends on. */
const AVAILABILITY = ["#f-farmable", "#f-railjack", "#f-resurgence", "#f-vaulted",
                      "#f-baro", "#f-special", "#f-founder"];
const showEverything = (page) => setChecks(page,
  Object.fromEntries([...AVAILABILITY, "#f-collected", "#f-missing"].map((s) => [s, true])));

/* The ids the grid is actually rendering, in the order it renders them. */
const shownIds = (page) => page.evaluate(() =>
  [...document.querySelectorAll("#grid .card[data-id]")].map((el) => el.dataset.id));

/* A subject for a test that has no preference beyond needing *a card, with
   enough parts to work with*: the first one the page is showing whose payload
   entry qualifies.

   `page.locator("[data-id]").first()` was doing this job, and it is an
   assumption about the sort order wearing a subject's clothes — it holds while
   the newest Warframe has four parts and stops holding the day a one-part item
   leads the grid. Naming a Prime outright is the other wrong answer: a name is
   a claim that this particular Prime matters, and DE vault six of them a
   quarter. Neither is picked with the code under test — `parts.length` is raw
   payload, and the candidates are read off the DOM rather than out of a
   filter reimplemented here. */
async function pickCard(page, minParts) {
  const want = minParts || 1;
  const ids = await shownIds(page);
  assert.ok(ids.length, "the grid rendered no cards at all");
  const found = await page.evaluate(([shown, n]) => {
    const by = new Map((window.WFPRIME_DATA.items || []).map((i) => [i.id, i]));
    for (const id of shown) {
      const it = by.get(id);
      if (it && (it.parts || []).length >= n) {
        return { id: it.id, name: it.name, parts: it.parts.length };
      }
    }
    return null;
  }, [ids, want]);
  assert.ok(found, `none of the ${ids.length} cards on screen has ${want} parts ` +
                   `to work with — widen the filters or pick a different property`);
  return found;
}

/* The planner's version of the same idea. A test that only needs *something to
   rank* wants Primes whose relics are still dropping, and `farmableRelics` is a
   raw payload field — so this asks the data rather than naming a Prime, because
   which ones are farmable is precisely what DE change every quarter and a named
   one is a test with an expiry date on it.

   Writes the farm list and reloads, which is how the planner picks it up. */
async function wishFarmable(page, count) {
  const want = count || 1;
  const picked = await page.evaluate((n) => {
    const items = (window.WFPRIME_DATA.items || [])
      .filter((i) => (i.farmableRelics || []).length).slice(0, n);
    localStorage.setItem("wfprimes.wishlist.v1", JSON.stringify(items.map((i) => i.id)));
    return items.map((i) => ({ id: i.id, name: i.name, parts: (i.parts || []).length }));
  }, want);
  assert.equal(picked.length, want,
               `wanted ${want} Prime(s) with relics still dropping, found ${picked.length}`);
  await page.reload({ waitUntil: "load" });
  return picked;
}

/* A ranked row that is NOT already a fissure, for the tests that open one and
   watch the badge arrive. The feed is live and currently carries dozens, so
   "the top row" is a coin toss every time it comes back up — this reads the
   shipped list instead of assuming it is empty. Returns DE's own name for the
   node, which is the key the badge is matched on. */
async function quietRow(page) {
  const key = await page.evaluate(() => {
    const live = new Set((window.WFPRIME_DATA.fissures || []).map((f) => f.node));
    for (const el of document.querySelectorAll("#planNodes .spot")) {
      const slot = el.querySelector(".fissure-slot");
      const node = slot && slot.dataset.node;
      if (node && !live.has(node)) return node;
    }
    return null;
  });
  assert.ok(key, "every ranked node already carries a fissure, so there is none " +
                 "left to watch one open on");
  return key;
}

const rowFor = (page, key) => page.locator("#planNodes .spot")
  .filter({ has: page.locator(`.fissure-slot[data-node="${key}"]`) }).first();

/* A cold profile, and a note of it so the test that asked for it can be made to
   clean it up. Every context in this file comes from here — `browser.newPage()`
   makes one implicitly and gives you no handle to close it, which is how a
   run ended holding fifty live profiles' worth of somebody's saved collection. */
const opened = [];
async function newProfile(options) {
  const context = await browser.newContext(options || {});
  opened.push(context);
  return context;
}

/* Closing the context is what clears the state, rather than reaching into
   localStorage and removing keys: it takes everything, including whatever the
   page wrote that the test never thought about. Errors are swallowed because a
   context a test has already closed itself is exactly the right outcome. */
async function closeProfiles() {
  const all = opened.splice(0, opened.length);
  await Promise.all(all.map((c) => c.close().catch(() => {})));
}

async function open(page_url) {
  const page = await (await newProfile()).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(origin + page_url, { waitUntil: "load" });
  return { page, errors };
}

/* The option is passed only when there is a reason to skip. node:test checks
   whether `skip` is *present*, not whether it is truthy, so `{ skip: null }`
   silently skips the lot - which it duly did, reporting eight passes as eight
   skips with no reason given.

   The `finally` is the other half of the cold-start rule: whatever profiles
   this test opened are gone before the next one starts, whether it passed,
   failed or threw. Doing it here rather than in each test keeps it off the
   fifty places that would each have to remember. */
const runClean = (fn) => async (t) => {
  try { await fn(t); } finally { await closeProfiles(); }
};
const page_test = (name, fn) =>
  (why ? test(name, { skip: why }, fn) : test(name, runClean(fn)));

// ── the collection view ────────────────────────────────────────────────────

page_test("the collection renders, with no errors on the console", async () => {
  /* The one test that wants every card, so it is the one test that turns every
     box on. It opens on 40 of 167 as shipped — deliberately, because the page
     opens on what is left to go and get — and this is a claim about the
     catalogue rather than about the opening view, so it asks for the lot. */
  const { page, errors } = await open("/index.html");
  await showEverything(page);
  const total = await page.evaluate(() => window.WFPRIME_DATA.items.length);
  const cards = await page.locator("#grid .card[data-id]").count();
  assert.ok(total > 100, `the payload itself is short, at ${total} items`);
  assert.equal(cards, total,
               `with every bucket ticked the grid is the catalogue: ${cards} of ${total}`);
  assert.deepEqual(errors, []);
});

page_test("ticking a part is saved, and survives a reload", async () => {
  const { page } = await open("/index.html");
  const subject = await pickCard(page);                          // any card will do
  await page.locator(`[data-id="${subject.id}"]`).click();        // open the drawer
  await page.getByRole("button", { name: /add to farm list/i }).click();

  const saved = await page.evaluate(() => localStorage.getItem("wfprimes.wishlist.v1"));
  assert.match(saved, /\[".+"\]/, "the farm list must reach localStorage");

  await page.reload({ waitUntil: "load" });
  const after = await page.evaluate(() => localStorage.getItem("wfprimes.wishlist.v1"));
  assert.equal(after, saved, "and must still be there on the way back in");
});

page_test("banking a part keeps the focus on the button that was clicked", async () => {
  /* This used to call render() and then openItem(), rewriting the whole grid
     and then the whole drawer to change one number - and innerHTML destroys the
     element that had the focus, so activeElement fell back to <body> on every
     click. The scroll position was restored by hand and the focus was not, so
     ticking three parts from the keyboard meant tabbing in from the top of the
     page three times over.

     No preference about which Prime: the subject is the first card on screen
     with two parts or more, read off the payload rather than off whichever card
     the sort happens to lead with. */
  const { page, errors } = await open("/index.html");
  const subject = await pickCard(page, 2);
  await page.locator(`[data-id="${subject.id}"]`).click();

  /* *Hide collected* is on by default since 2026-08-27, which removes a part
     from the list the moment it is banked — so the button that was pressed is
     legitimately gone and cannot hold anything. Turned off here so the original
     guarantee is tested exactly as written; the default's own behaviour is
     asserted below, because "the part vanished" must still not mean "the
     keyboard was thrown back to the top of the page".

     `#hideOwned` lives in the drawer rather than the sidebar, so it exists only
     once a card is open — which is why this is set here and not on load. */
  const setHideOwned = (on) => setCheck(page, "#hideOwned", on);
  await setHideOwned(false);

  const own = page.locator("#drawerBody .part-own");
  assert.equal(await own.count(), subject.parts,
               `${subject.name} has ${subject.parts} parts and the drawer must offer them all`);

  const btn = own.nth(1);
  const part = await btn.getAttribute("data-part");
  await btn.focus();
  await page.keyboard.press("Enter");

  const focused = await page.evaluate(() => {
    const el = document.activeElement;
    return { tag: el && el.tagName, part: el && el.dataset && el.dataset.part };
  });
  assert.equal(focused.tag, "BUTTON",
               "the focus must not fall back to the body, or the keyboard is lost");
  assert.equal(focused.part, part, "and it must still be the counter that was pressed");

  /* Now the default's path: banking a part makes it disappear, and the focus has
     to land on something in the drawer rather than on <body>. This is the same
     bug the paragraph at the top of this test describes, reachable by a new
     route, which is why it is asserted rather than assumed. */
  await setHideOwned(true);
  const still = page.locator("#drawerBody .part-own");
  if (await still.count() > 1) {
    await still.nth(0).focus();
    await page.keyboard.press("Enter");
    const after = await page.evaluate(() => {
      const el = document.activeElement;
      return { tag: el && el.tagName, inDrawer: !!(el && el.closest("#drawerBody")) };
    });
    assert.equal(after.tag, "BUTTON",
                 "hiding the banked part must not cost the keyboard its place");
    assert.ok(after.inDrawer, "and the focus must stay inside the drawer it was in");
  }

  const stored = await page.evaluate(() => localStorage.getItem("wfprimes.parts.v1"));
  assert.ok(stored && stored.includes(part), `${part} was pressed and not saved`);
  assert.deepEqual(errors, []);
});

page_test("a Prime with two sources survives unticking either of them", async () => {
  /* Lex Prime's relics still drop AND Baro sells it. Each item displays as one
     bucket, which is right for the badge and was wrong for the filter: it filed
     under Farmable, so unticking Farmable took it away from the Baro box that
     was still ticked, with nothing on screen saying where it had gone.

     Named subject, because no property of the raw data picks out "an item with
     two sources" without reimplementing the classifier (PROJECT.md section 2). */
  const { page, errors } = await open("/index.html");
  const flags = await page.evaluate(() => {
    const it = window.WFPRIME_DATA.items.find((i) => i.name === "Lex Prime");
    return it && it.flags;
  });
  assert.ok(flags && flags.farmable && flags.baro,
            "Lex Prime is the subject because it is farmable and a Baro item");

  /* Both of its boxes on before anything is measured. *Baro Ki'Teer* opens only
     while he is actually on a relay — two days a fortnight — so its default is
     a fact about the calendar rather than about this test, and asking for the
     state outright is what makes this run the same in either week. */
  await setChecks(page, { "#f-farmable": true, "#f-baro": true });

  const card = page.locator('[data-id="secondary-lex-prime"]');
  await page.locator("#search").fill("Lex Prime");
  assert.equal(await card.count(), 1, "it has to be on screen before anything is unticked");

  await setCheck(page, "#f-farmable", false);
  assert.equal(await card.count(), 1,
               "Baro is still ticked and still sells it, so it must stay");
  await setCheck(page, "#f-baro", false);
  assert.equal(await card.count(), 0,
               "with both of its sources unticked it must finally go");

  await setCheck(page, "#f-baro", true);
  assert.equal(await card.count(), 1, "and come back when either one returns");
  assert.deepEqual(errors, []);
});

page_test("an akimbo asks for two of its sub-weapon, and can be given one", async () => {
  /* DE list the sub-weapon of an akimbo twice, one each, and saved progress is
     keyed on the part name - so the two entries shared one counter and there
     was nowhere to record having one of the two. Three clicks completed a
     four-part item.

     Named subject, and one of the few that earns it: the assertion below is
     Aklex Prime's own part list, spelled out, because the point is that the
     sub-weapon is named once and asked for twice. */
  const { page, errors } = await open("/index.html");
  /* Aklex Prime is a Baro item and nothing else, so it is on screen exactly
     while he is — ask for the box rather than for the fortnight. */
  await setCheck(page, "#f-baro", true);
  await page.locator("#search").fill("Aklex Prime");
  await page.locator('[data-id="secondary-aklex-prime"]').click();

  const counters = page.locator("#drawerBody .part-own");
  const names = await counters.evaluateAll((els) => els.map((e) => e.dataset.part));
  assert.deepEqual(names, ["Blueprint", "Lex Prime", "Link"],
                   "one entry per part, and the sub-weapon named once");

  const sub = page.locator('#drawerBody .part-own[data-part="Lex Prime"]');
  assert.equal((await sub.innerText()).trim(), "0/2",
               "it needs two, so the counter has to be able to say so");
  await sub.click();
  assert.equal((await sub.innerText()).trim(), "1/2", "one banked is not two");

  const done = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("wfprimes.collected.v1") || "[]"));
  assert.ok(!done.includes("secondary-aklex-prime"),
            "holding one of the two Lex Primes it needs is not owning it");

  /* And the card says where a built weapon actually comes from. Scoped to the
     part it belongs to rather than taking the first `.relic-none` on the card:
     every relic that drops an Aklex part is vaulted, `Hide vaulted` in the
     drawer is on by default since 2026-08-27, and the Blueprint's "every relic
     is vaulted" note now sits above this one. Both are correct; only the
     selector was picking by position. */
    const note = await page.locator("#drawerBody .part")
    .filter({ has: page.locator('[data-part="Lex Prime"]') })
    .locator(".relic-none").innerText();
  assert.match(note, /Lex Prime/, "the row has to send you to the weapon itself");
  assert.deepEqual(errors, []);
});

page_test("the Baro filter says when he is next on a relay, and never moves itself", async () => {
  /* He is on a relay two days a fortnight, so *Baro Ki'Teer* is the one bucket
     whose answer has a clock on it. The label says when — the half of the Baro
     proposal that is worth having: a live fact stated where it is read, rather
     than a live fact moving nine items between buckets under a reader who has
     touched nothing.

     The window is planted rather than read, because the shipped one is a real
     date and every assertion here would otherwise expire. `traderWindow` itself
     is tested against a frozen clock in test_assets.mjs; what this pins is that
     the label is wired to it and repaints. */
  const { page, errors } = await open("/index.html");

  const shipped = await page.evaluate(() => (window.WFPRIME_DATA.meta || {}).baro);
  assert.ok(shipped && shipped.activation && shipped.expiry,
            "meta.baro ships the window, and without it there is nothing to say");

  const label = page.locator("#baroWhen");
  assert.equal(await label.count(), 1, "the label needs somewhere to put it");

  /* Repainted on the same signal the fissure badges use, so no reload: a reload
     would prove the payload, and what is in question is the open tab. */
  const plant = (from, to) => page.evaluate(([a, b]) => {
    window.WFPRIME_DATA.meta.baro = a === null ? null : { activation: a, expiry: b };
    document.dispatchEvent(new Event("visibilitychange"));
  }, [from, to]);
  const hours = (n) => new Date(Date.now() + n * 3600000).toISOString();

  await plant(hours(24 * 6), hours(24 * 8));
  assert.match(await label.innerText(), /back in 6 days/,
               "six days out reads in days — untilText would have said 144h 00m");

  await plant(hours(-4), hours(20));
  assert.match(await label.innerText(), /here .* more/,
               "while he is actually there the label says so, not a countdown to it");

  /* The checkbox is decided once, at load, and this is why: he arrives while a
     tab is open twice a fortnight, and flipping it under the reader would move
     nine items between buckets with nothing on screen saying why. */
  const wasChecked = await page.locator("#f-baro").isChecked();
  await plant(hours(24 * 3), hours(24 * 5));
  assert.equal(await page.locator("#f-baro").isChecked(), wasChecked,
               "the label may change its mind; the filter may not");

  await plant(null, null);
  assert.equal((await label.innerText()).trim(), "",
               "no window means nothing said, rather than a guess");

  assert.deepEqual(errors, []);
});

page_test("a tooltip appears on hover and says something", async () => {
  const { page } = await open("/index.html");
  await page.locator("[data-tip]").first().hover();
  const tip = page.locator(".tip");
  await tip.waitFor({ state: "visible", timeout: 2000 });
  assert.ok((await tip.textContent()).trim().length > 0, "an empty tooltip is a bug");
});

page_test("the backup dialog opens and carries the collection", async () => {
  const { page } = await open("/index.html");
  const subject = await pickCard(page);                // any card will do
  await page.locator(`[data-id="${subject.id}"]`).click();
  await page.getByRole("button", { name: /mark as collected/i }).click();
  await page.keyboard.press("Escape");
  await page.locator("#dataBtn").click();

  const text = await page.locator("#dataArea").inputValue();
  const parsed = JSON.parse(text);
  assert.ok(parsed.collected?.length >= 1 || Object.keys(parsed.parts || {}).length >= 1,
            "a backup that does not contain the collection is worse than none");
});

page_test("a backup exported from one page restores on the other", async () => {
  // the round trip both pages validate through model.js. They used to have
  // their own copies of that validation, and the planner's was weaker - so the
  // same file restored differently depending on where you pasted it.
  const { page } = await open("/index.html");
  const subject = await pickCard(page);                // any card will do
  await page.locator(`[data-id="${subject.id}"]`).click();
  await page.getByRole("button", { name: /mark as collected/i }).click();
  await page.getByRole("button", { name: /add to farm list/i }).click();
  await page.keyboard.press("Escape");
  await page.locator("#dataBtn").click();
  const backup = await page.locator("#dataArea").inputValue();
  const expected = JSON.parse(backup);
  assert.ok(expected.collected.length >= 1, "nothing was collected to export");

  // a clean slate, then restore from the planner - its own profile, so "clean"
  // is a fact about the browser rather than something this test has to arrange
  const fresh = await (await newProfile()).newPage();
  await fresh.goto(origin + "/plan.html", { waitUntil: "load" });
  await fresh.locator("#dataBtn").click();
  await fresh.locator("#dataArea").fill(backup);
  await fresh.locator("#importBtn").click();
  await fresh.waitForTimeout(1200);                 // it reloads on success

  const restored = await fresh.evaluate(() => ({
    collected: JSON.parse(localStorage.getItem("wfprimes.collected.v1") || "[]"),
    parts: JSON.parse(localStorage.getItem("wfprimes.parts.v1") || "{}"),
    wishlist: JSON.parse(localStorage.getItem("wfprimes.wishlist.v1") || "[]"),
  }));
  assert.deepEqual(restored.collected, expected.collected);
  assert.deepEqual(restored.wishlist, expected.wishlist);
  assert.deepEqual(restored.parts, expected.parts,
                   "per-part progress must survive, not just the ticks");
});

page_test("a filter setting survives a reload", async () => {
  const { page } = await open("/index.html");
  const box = page.locator("#f-vaulted");
  const before = await box.isChecked();
  // the input is styled out of sight behind its own .box span, so the label is
  // the click target - for Playwright and for anyone using the page
  await page.locator("label.check:has(#f-vaulted)").click();
  await page.reload({ waitUntil: "load" });
  assert.equal(await page.locator("#f-vaulted").isChecked(), !before,
               "filters are saved under their own key and must come back");
});

page_test("the default sort groups by category and leads with the newest", async () => {
  /* The default used to order each category by name, which answered a question
     nobody was asking - Ash Prime above Styanax Prime because A precedes S.
     Sorting on release instead puts what has come out lately at the top of each
     group, where the gaps in a collection actually are.

     The subjects are named rather than picked by anything app.js decides, and
     the raw data is asserted first so a wiki change that moved a date would say
     so rather than quietly making the test vacuous. Excalibur and Styanax are
     the discriminator on purpose: alphabetically Excalibur leads, by date it
     comes last, so the old comparator cannot pass this. */
  const { page, errors } = await open("/index.html");

  /* Both of this test's subjects are behind a box that is off by default since
     2026-08-27: Excalibur Prime is Founder-exclusive, and Kavasa Prime Collar —
     the one undated item, and the whole of the last assertion — is vaulted.
     Asked for by name here rather than swapping in whichever pair happens to be
     on screen, because "the alphabet must disagree with the dates" is a property
     of this pair and picking a visible one instead would be choosing the
     subject with the comparator under test. */
  await setChecks(page, { "#f-founder": true, "#f-vaulted": true });

  const raw = await page.evaluate(() => {
    const pick = (n) => {
      const i = window.WFPRIME_DATA.items.find((x) => x.name === n);
      return i && { id: i.id, name: i.name, cat: i.category, d: i.releaseDate };
    };
    return { cats: window.WFPRIME_DATA.categories.map((c) => c.name),
             oldest: pick("Excalibur Prime"), newest: pick("Styanax Prime"),
             undated: pick("Kavasa Prime Collar") };
  });
  assert.equal(raw.oldest.cat, raw.newest.cat, "the two must share a category to compare");
  assert.ok(raw.oldest.d < raw.newest.d, "Excalibur Prime must be the older of the pair");
  assert.ok(raw.oldest.name < raw.newest.name,
            "and the alphabet must disagree with the dates, or this proves nothing");
  assert.equal(raw.undated.d, null, "Kavasa Prime Collar is the subject because it has no date");

  assert.match(await page.locator("#sort option:checked").innerText(), /release date/i,
               "the reader is told what the order is, on the control that sets it");

  /* Walk the grid in document order: headings and cards are siblings, so the
     blocks are what the reader actually sees, not what a comparator claims. */
  const blocks = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll("#grid > *").forEach((el) => {
      if (el.classList.contains("cat-heading")) {
        out.push({ cat: el.childNodes[0].textContent.trim(), ids: [] });
      } else if (el.dataset.id && out.length) {
        out[out.length - 1].ids.push(el.dataset.id);
      }
    });
    return out;
  });
  assert.ok(blocks.length > 1, "the default sort has to render category headings");
  assert.deepEqual(blocks.map((b) => b.cat),
                   raw.cats.filter((c) => blocks.some((b) => b.cat === c)),
                   "the groups run in the payload's category order");

  const dates = await page.evaluate((ids) => {
    const byId = new Map(window.WFPRIME_DATA.items.map((i) => [i.id, i.releaseDate]));
    return ids.map((row) => row.map((id) => byId.get(id) || null));
  }, blocks.map((b) => b.ids));

  dates.forEach((row, i) => {
    const seen = row.filter((d) => d !== null);
    assert.deepEqual(row.slice(0, seen.length), seen,
                     `${blocks[i].cat}: an undated item must sort last, not first`);
    assert.deepEqual(seen, [...seen].sort().reverse(),
                     `${blocks[i].cat} is not newest-first on screen`);
  });

  const frames = blocks.find((b) => b.cat === raw.newest.cat).ids;
  assert.ok(frames.indexOf(raw.newest.id) < frames.indexOf(raw.oldest.id),
            "Styanax Prime is newer than Excalibur Prime and must lead it");

  const pets = blocks.find((b) => b.cat === raw.undated.cat).ids;
  assert.equal(pets[pets.length - 1], raw.undated.id,
               "the one item with no release date belongs at the end of its group");

  assert.deepEqual(errors, []);
});

page_test("a Mastery Rank set on one page is the same rank on the other", async () => {
  /* It is an account fact, not a view setting, so it lives in the shared plan
     store beside `squad` and the two pages cannot hold different answers. That
     is the property worth testing - a per-page copy would pass every
     single-page check and still be wrong. */
  const { page, errors } = await open("/index.html");

  const box = page.locator("#mrInput");
  const label = page.locator("#mrLabel");

  assert.equal(await box.inputValue(), "",
               "it starts unset, and shows nothing rather than claiming rank 0");
  assert.equal(await page.locator("#mrDown").isDisabled(), true,
               "there is nothing below unset to step down to");

  await page.locator("#mrUp").click();
  assert.equal(await box.inputValue(), "0",
               "the first press lands on Unranked, which is a real rank");
  assert.equal(await page.locator("#mrDown").isDisabled(), true,
               "and 0 is still the floor");

  for (let i = 0; i < 13; i++) await page.locator("#mrUp").click();
  assert.equal(await box.inputValue(), "13");
  assert.equal(await label.innerText(), "MR");

  const stored = await page.evaluate(
    () => JSON.parse(localStorage.getItem("wfprimes.plan.v1") || "{}").mastery);
  assert.equal(stored, 13, "the rank has to reach the shared plan store");

  await page.locator("#mrDown").click();
  assert.equal(await box.inputValue(), "12", "and it steps back down");

  const plan = await (await page.context().newPage());
  await plan.goto(origin + "/plan.html", { waitUntil: "load" });
  assert.equal(await plan.locator("#mrInput").inputValue(), "12",
               "the planner reads the same account fact, not its own copy");
  assert.deepEqual(errors, []);
});

page_test("a rank can be typed straight in, and typing past 30 reaches Legendary", async () => {
  /* The steps are for nudging; nobody should press + twenty-six times to say
     they are MR 26. Committed on blur and on Enter rather than per keystroke,
     because MR 1 is a real rank with a real trace cap and a field that saved as
     you typed would store it on the way to MR 13. */
  const { page, errors } = await open("/index.html");
  const box = page.locator("#mrInput");
  const label = page.locator("#mrLabel");
  const saved = () => page.evaluate(
    () => JSON.parse(localStorage.getItem("wfprimes.plan.v1") || "{}").mastery);

  await box.fill("26");
  assert.equal(await saved(), undefined, "nothing is written while it is still being typed");
  await box.press("Enter");
  assert.equal(await saved(), 26, "Enter commits it");
  assert.equal(await label.innerText(), "MR");

  /* In MR mode the typed number IS the rank, so 31 rolls over on its own —
     which is the only route into Legendary from the keyboard. */
  await box.fill("31");
  await box.press("Enter");
  assert.equal(await label.innerText(), "LR", "31 is Legendary, not MR 31");
  assert.equal(await box.inputValue(), "1", "and the box holds the Legendary number");
  assert.equal(await saved(), 31, "while the store keeps one integer");

  /* And back, because in LR mode the typed number is offset by 30. */
  await box.fill("0");
  await box.press("Enter");
  assert.equal(await label.innerText(), "MR");
  assert.equal(await box.inputValue(), "30", "LR 0 is really MR 30");

  /* Refused rather than guessed at: what was stored comes back. */
  await box.fill("nonsense");
  await box.blur();
  assert.equal(await box.inputValue(), "30", "a non-number puts back what was stored");
  assert.equal(await saved(), 30);

  /* Emptying it clears the rank, rather than meaning zero. */
  await box.fill("");
  await box.press("Enter");
  assert.equal(await saved(), null, "an emptied box is unset, not MR 0");
  assert.equal(await box.inputValue(), "");
  assert.deepEqual(errors, []);
});

page_test("the rank badge states the Void Trace cap it implies", async () => {
  /* (rank x 50) + 100, from `wiki.warframe.com/w/Void_Traces`. MR13 = 750 is
     the wiki's own worked example, so the number on screen is checked against
     the source rather than against our own arithmetic.

     It is on the badge's tooltip rather than under the planner's traces switch.
     That switch names both its ends already - *under 500*, *over 500* - so a
     sentence beneath it explaining 500 restated the control it sat under. A cap
     belongs to the rank, and the badge is where a reader asks what their rank
     means.

     The second half is the boundary: MR8 caps at exactly 500, so at or below it
     the far end of that switch cannot be reached. The badge says so and the
     switch stays enabled - this field informs and never filters. */
  const { page, errors } = await open("/plan.html");
  const tip = () => page.locator("#mrField").getAttribute("data-tip");

  assert.match(await tip(), /not set/, "with no rank given there is no cap to state");
  assert.equal(await page.locator("#traceCapNote").count(), 0,
               "and nothing is printed under the switch, which explains itself");

  const setRank = async (mr) => {
    await page.evaluate((n) => {
      const plan = JSON.parse(localStorage.getItem("wfprimes.plan.v1") || "{}");
      plan.mastery = n;
      localStorage.setItem("wfprimes.plan.v1", JSON.stringify(plan));
    }, mr);
    await page.reload({ waitUntil: "load" });
  };

  await setRank(13);
  assert.equal(await page.locator("#mrInput").inputValue(), "13");
  const rich = await tip();
  assert.match(rich, /750/, "MR13 caps at 750 — the wiki's own worked example");
  assert.match(rich, /Hunter/, "and the badge names the rank DE gives it");
  assert.doesNotMatch(rich, /cannot hold more/, "750 clears the switch's 500 comfortably");

  /* Past 30 the formula is ours: the wiki states it, works MR13 and MR30, and
     stops — re-checked on `Void Traces` and `Mastery Rank` on 2026-08-27, and
     Legendary is absent from both. So the badge marks the figure as an estimate
     at those ranks rather than showing it as though it were known, and does not
     say so at ranks the wiki actually covers. */
  await setRank(31);
  const legendary = await tip();
  assert.match(legendary, /1650/, "the continuation is still shown — it is our best answer");
  assert.match(legendary, /not a figure the wiki states|estimate/i,
               "and a Legendary reader is told the number is ours, not the wiki's");

  await setRank(30);
  assert.doesNotMatch(await tip(), /estimate/i,
                      "MR30 is the wiki's own worked example, so nothing to hedge");

  await setRank(8);
  const poor = await tip();
  assert.match(poor, /500/, "MR8 caps at exactly the pivot");
  assert.match(poor, /cannot hold more/, "so the far end of the switch is unreachable");
  assert.equal(await page.locator("#p-traces").isDisabled(), false,
               "and it still must not disable the control — this informs, never filters");

  assert.deepEqual(errors, []);
});

page_test("the search sits at the centre of the bar, whatever is beside it", async () => {
  /* It used to be a flex child with `flex:1`, which centres inside the space
     the neighbours leave rather than in the bar — so it drifted whenever the
     two sides differed, and adding the Mastery Rank field pushed it visibly
     right. The top bar is a three-track grid now with `minmax(0,1fr)` sides.

     Measured against `clientWidth`, not `innerWidth`: the latter includes the
     scrollbar, which is a 7px lie at this width and would make a correctly
     centred bar look wrong. The second half is the real guard — the centre must
     not move when a side changes width, which is the bug itself rather than one
     arrangement that happens to look right. */
  for (const [url, input] of [["/index.html", "#search"], ["/plan.html", "#addSearch"]]) {
    const { page, errors } = await open(url);
    const measure = () => page.evaluate((sel) => {
      const r = document.querySelector(sel).getBoundingClientRect();
      return { centre: r.left + r.width / 2, half: document.documentElement.clientWidth / 2 };
    }, input);

    const before = await measure();
    assert.ok(Math.abs(before.centre - before.half) <= 1,
              `${url}: search centre ${before.centre} is not the bar's centre ${before.half}`);

    const grew = await page.evaluate(() => {
      const h1 = document.querySelector(".brand h1");
      const was = h1.textContent;
      h1.textContent = was + " — and a great deal more besides";
      return was;
    });
    const after = await measure();
    assert.ok(Math.abs(after.centre - before.centre) <= 1,
              `${url}: the centre moved ${after.centre - before.centre}px when the left grew`);
    await page.evaluate((t) => { document.querySelector(".brand h1").textContent = t; }, grew);

    assert.equal(await page.locator(".topbar-right .viewtabs").count(), 1,
                 `${url}: Collection/Planner belong in the right-hand group`);
    assert.equal(await page.locator(".topbar #progressChip").count(), 0,
                 `${url}: the collected count is out of the bar`);
    assert.deepEqual(errors, []);
  }
});

page_test("the licence and privacy notice is at the foot of both pages, identically", async () => {
  /* It used to be built into the collection sidebar's data note, so the planner
     carried none of it — a licence notice on one page of two. One copy now, in
     `siteFooter`, and this asserts the two pages render the same string rather
     than merely that each has something: two attributions that drift apart is
     the failure this arrangement exists to prevent. */
  const read = async (url) => {
    const { page, errors } = await open(url);
    const foot = page.locator("#siteFoot");
    assert.equal(await foot.count(), 1, `${url} has no footer`);
    assert.deepEqual(errors, []);
    return (await foot.innerText()).replace(/\s+/g, " ").trim();
  };

  const collection = await read("/index.html");
  const planner = await read("/plan.html");

  assert.equal(collection, planner, "the two pages must carry the same notice");
  for (const claim of ["Digital Extremes", "Content Policy", "unofficial fan",
                       "sent nowhere", "CC BY-SA", "MIT"]) {
    assert.ok(collection.includes(claim), `the notice dropped "${claim}"`);
  }

  /* Quiet, but not below the floor the rule it replaced was solved for:
     attribution is the one thing on the page that is not ours to make hard to
     read. Colour is asserted rather than described because "low visibility"
     is exactly the instruction that erodes into unreadable. */
  const { page } = await open("/index.html");
  const style = await page.evaluate(() => {
    const p = document.querySelector("#siteFoot p");
    const cs = getComputedStyle(p);
    return { color: cs.color, size: parseFloat(cs.fontSize) };
  });
  assert.equal(style.color, "rgb(155, 161, 170)",
               "#9ba1aa is the solved 7:1 value and must not be dimmed further");
  assert.ok(style.size <= 11 && style.size >= 10,
            `small, but still a readable size — got ${style.size}px`);
});

page_test("the materials checklist keeps what you type in it", async () => {
  const { page } = await open("/index.html");
  await page.locator(".advanced summary").click();
  const first = page.locator("#matList input").first();
  await first.waitFor({ state: "visible", timeout: 2000 });
  await first.fill("7");
  await first.dispatchEvent("change");
  await page.reload({ waitUntil: "load" });
  await page.locator(".advanced summary").click();
  assert.equal(await page.locator("#matList input").first().inputValue(), "7");
});

// ── the planner ────────────────────────────────────────────────────────────

page_test("the planner ranks somewhere to go for a wanted Prime", async () => {
  const { page, errors } = await open("/plan.html");
  const [subject] = await wishFarmable(page);          // any farmable Prime will do

  const spots = page.locator(".spot");
  assert.ok(await spots.count() > 0,
            `${subject.name}'s relics are still dropping, so it must rank somewhere`);
  const first = await spots.first().innerText();
  assert.match(first, /[\d.]+\s*\nrelics \//, "every row carries its ranked figure");
  assert.deepEqual(errors, []);
});

page_test("a part you need two of says so on its chip in the crack list", async () => {
  /* The chip named the part and stopped, so farming for a pair looked exactly
     like farming for one — the only thing that moved was the openings figure
     above it, which is not where a reader looks to find out what they are
     collecting. 53 parts in the catalogue ask for more than one.

     The subject is chosen from the raw payload, never from the code under
     test: any part whose `itemCount` is above one and whose relic is still
     dropping. Which items qualify changes every time DE vault something, so
     picking one by name here would rot. */
  const { page, errors } = await open("/plan.html");
  const subject = await page.evaluate(() => {
    const D = window.WFPRIME_DATA;
    for (const it of D.items) {
      for (const p of it.parts || []) {
        if ((p.itemCount || 1) <= 1) continue;
        const live = (p.relics || [])
          .map((r) => r.relic)
          .filter((n) => D.relics[n] && !D.relics[n].vaulted);
        if (!live.length) continue;
        localStorage.setItem("wfprimes.wishlist.v1", JSON.stringify([it.id]));
        return { label: `${it.name} ${p.name}`, want: p.itemCount, relic: live[0] };
      }
    }
    return null;
  });
  assert.ok(subject, "no live relic drops a part that is needed more than once — " +
                     "pick a different subject rather than letting this pass vacuously");
  await page.reload({ waitUntil: "load" });

  const chip = page.locator(".part-chip").filter({ hasText: subject.label }).first();
  assert.ok(await chip.count() > 0,
            `the crack list has to carry a chip for ${subject.label}`);
  assert.equal((await chip.locator(".qty").innerText()).trim(), `×${subject.want}`,
               `${subject.label} takes ${subject.want} to build, and nothing is ` +
               `banked, so the chip has to say so`);

  /* And the count is what you still need, not what the recipe asks for: bank
     one of the pair and the chip has to come down to match the openings figure
     beside it, which has always been priced on the shortfall. */
  await page.evaluate((s) => {
    const D = window.WFPRIME_DATA;
    const it = D.items.find((i) => `${i.name} ` === s.label.slice(0, i.name.length + 1));
    const part = s.label.slice((it ? it.name.length : 0) + 1);
    localStorage.setItem("wfprimes.parts.v1", JSON.stringify({ [it.id]: { [part]: 1 } }));
  }, subject);
  await page.reload({ waitUntil: "load" });

  const after = page.locator(".part-chip").filter({ hasText: subject.label }).first();
  assert.ok(await after.count() > 0, "the part is still wanted with one of two banked");
  assert.equal(await after.locator(".qty").count(), 0,
               "one still needed is not a quantity worth printing - the chip " +
               "must not keep saying ×2 once half the pair is banked");
  assert.deepEqual(errors, []);
});

page_test("the never-vaulted badge splits, because it means two things", async () => {
  /* The wiki's "Never Vaulted" marker covers 14 Primes, and six of them carry
     Digital Extremes' vaulted flag at the same time. Both are true: those six
     left the ordinary drop tables and their relics went into Railjack rather
     than into the vault, so they never become unobtainable and you cannot touch
     them without a ship. Saying "its relics keep dropping indefinitely" to
     someone with no Railjack is the failure being pinned here. */
  const { page } = await open("/index.html");
  /* The two halves of the marker are the two buckets, so those are the two
     boxes this test asks for: a never-vaulted Prime is *Farmable* unless a ship
     is the only way to it, in which case it is *Railjack*. Which is the split
     itself, restated as a filter — so a test about the split that did not tick
     both would be one default away from having nothing to open. */
  await setChecks(page, { "#f-farmable": true, "#f-railjack": true });
  /* The split itself is a claim about the whole payload, so it is counted over
     the whole payload. Only the two cards this then opens have to be on screen,
     and those are picked from what the page is showing rather than named — the
     marker covers fourteen Primes and any of them would do. */
  const split = await page.evaluate((shown) => {
    const D = window.WFPRIME_DATA, R = window.WFPrimeRotation;
    const on = new Set(shown);
    const marked = D.items.filter((i) => (i.flags || {}).permanent);
    const isRj = (i) => R.railjackOnly(i, D.relics);
    const pick = (list) => {
      const it = list.find((i) => on.has(i.id));
      return it ? { id: it.id, name: it.name } : {};
    };
    return {
      marked: marked.length,
      rj: marked.filter(isRj).map((i) => i.name).sort(),
      needsShip: pick(marked.filter(isRj)),
      plain: pick(marked.filter((i) => !isRj(i))),
    };
  }, await shownIds(page));
  assert.ok(split.marked > split.rj.length && split.rj.length > 0,
            "both halves of the marker have to exist, or there is nothing to split");
  assert.ok(split.rj.every((n) => /Prime$/.test(n)));
  assert.ok(split.needsShip.id && split.plain.id,
            "one of each half has to be on screen to open — got " +
            JSON.stringify({ needsShip: split.needsShip, plain: split.plain }));

  const shows = async (it, badge) => {
    await page.locator(`[data-id="${it.id}"]`).click();
    const text = await page.locator(".d-badges").innerText();
    await page.locator(".drawer-close").click();
    return text.includes(badge);
  };
  assert.ok(await shows(split.needsShip, "RAILJACK ONLY"),
            `${split.needsShip.name} can only be farmed with a ship and the card must say so`);
  assert.ok(await shows(split.plain, "NEVER VAULTED"),
            `${split.plain.name} really is never vaulted, and must keep saying so`);
});

page_test("a card whose relic drops only on Railjack still says where", async () => {
  /* The collection view answers "where does this item's relic drop", not "where
     should I go next", so it must not hide a node for being awkward. Nyx Prime's
     only unvaulted relic is Neo V9, which exists on eight Proxima nodes and
     nowhere on the star chart: filtering Railjack out left that card with no farm
     section at all, saying nothing where it could say "here, bring a ship". */
  const { page, errors } = await open("/index.html");
  /* Chosen by planet name, not by isRailjack. Picking the subject with the
     function under test makes the case vacuous - break the classifier, find no
     subject, return early, go green having checked nothing.

     Chosen from the cards on screen, too, and the box that puts them there is
     ticked outright rather than assumed: these six Primes are the whole of the
     *Railjack* bucket, so that checkbox is precisely the one this test depends
     on and precisely the one it should be saying it needs. */
  await setCheck(page, "#f-railjack", true);
  const only = await page.evaluate((shown) => {
    const D = window.WFPRIME_DATA;
    const on = new Set(shown);
    const proxima = (s) => /Proxima/i.test(s.planet || "");
    for (const it of D.items) {
      if (!on.has(it.id)) continue;
      for (const p of it.parts || []) {
        for (const r of p.relics || []) {
          const rec = D.relics[r.relic];
          if (!rec || rec.vaulted || !(rec.sources || []).length) continue;
          if (rec.sources.every(proxima)) return { id: it.id, name: it.name, relic: r.relic };
        }
      }
    }
    return null;
  }, await shownIds(page));
  assert.ok(only, "no live relic on screen drops only on Proxima - if that is " +
                  "really true now, delete this test rather than letting it pass empty");

  await page.locator(`[data-id="${only.id}"]`).click();
  const spots = page.locator(".drawer .spot");
  assert.ok(await spots.count() > 0,
            `${only.name} needs Proxima for ${only.relic}, and the card offered nowhere`);

  /* The claim is that the Proxima spot is *offered*, not that it is the best
     one, and that distinction is load-bearing rather than a weakening.

     `spots.first()` was the assertion, and it held only while the subject was a
     Prime with no other route: five items have a Proxima-only relic and Lex
     Prime is one of them, with Mars and Sedna live at the same time — so its
     best spot is an ordinary node with no badge at all, `.demand` never
     appears, and `innerText` waits out its full thirty seconds rather than
     failing. Measured, by hiding the *Railjack* bucket so Lex was the first
     subject left: thirty seconds, no message worth reading.

     Nor can the subject simply be narrowed to "every route is Proxima": no
     Prime qualifies. Nyx, Valkyr, Cernos and Venka reach the rest of their
     relics at Railjack nodes on ORDINARY planets - Beacon Shield Ring is on
     Venus - and telling those from Lex Prime's Mars means naming the node
     list `isRailjack` holds, which is picking the subject with the code under
     test by the back door. */
  const more = page.locator("#moreSpots");
  if (await more.count()) await more.click();          // past the top eight
  /* A row reads "Flexa (Caches) — Veil Proxima": node, mode, then planet. The
     planet is the half that matters here and it is the last of the three, so
     this matches the word rather than a shape around it. */
  const proximaSpot = spots.filter({ hasText: /Proxima/ }).first();
  assert.ok(await proximaSpot.count() > 0,
            `${only.relic} drops nowhere but Proxima, so ${only.name}'s card has ` +
            `to offer a Proxima node somewhere in its list`);
  assert.equal(await proximaSpot.locator(".demand").count(), 1,
               "a Proxima row must carry a badge - counted rather than read, " +
               "because innerText on a locator that never appears hangs for " +
               "thirty seconds instead of failing");
  // innerText, not textContent: the badge is uppercased in CSS, and what the
  // reader sees is the thing worth pinning
  assert.match(await proximaSpot.locator(".demand").innerText(), /^RAILJACK$/,
               "a node that needs a ship has to say so, since for this relic it " +
               "is the only option");
  assert.deepEqual(errors, []);
});

page_test("the server decides who is told how to fix stale data", async () => {
  /* The exact bug: these tests run on 127.0.0.1, so the old hostname guess
     called every reader the owner. Browse your own server by its LAN address and
     it made the opposite mistake - warned you about something you could fix and
     did not say how. Only the server can see the peer, so only the server can
     answer, and it stamps the answer on the payload it already attaches.

     Injected before the page scripts run, which is where serve.py puts it. */
  const banner = async (upstream) => {
    /* A profile each, so the three readers below are three strangers rather
       than one browser being told three different things in turn. */
    const page = await (await newProfile()).newPage();
    await page.addInitScript((u) => { window.WFPRIME_UPSTREAM = u; }, upstream);
    await page.goto(origin + "/index.html", { waitUntil: "load" });
    const el = page.locator(".databar");
    const text = await el.count() ? await el.first().innerText() : "";
    return text;
  };
  const stale = { ok: true, stale: true, moved: ["droptables"] };

  const asOwner = await banner({ ...stale, owner: true });
  assert.match(asOwner, /Out of date/, "a moved upstream has to raise the banner");
  assert.match(asOwner, /refresh-data/,
               "whoever runs the server is the only one who can fix this");

  const asGuest = await banner({ ...stale, owner: false });
  assert.match(asGuest, /Out of date/, "a guest still gets the warning");
  assert.ok(!/refresh-data/.test(asGuest),
            "on 127.0.0.1 the old hostname guess called this reader the owner; " +
            "the server said otherwise and the server is right");

  /* No server at all - file:// or a static host. The one claim that needs an
     upstream answer must not be made without one; everything else the banner
     says comes from the build itself and is unaffected. On fresh data that
     means no banner, which is the correct amount to say. */
  const noServer = await banner(undefined);
  assert.ok(!/Out of date/.test(noServer),
            `nothing checked upstream, so nothing may claim it moved: ${noServer}`);
});

page_test("a Steel Path node is ranked, and says so on the row", async () => {
  /* Deliberately not filtered. It gates entering a node, which by the usual rule
     would exclude it - but every Steel Path table carrying a relic is a Faceoff
     variant identical to its ordinary twin, so an option would have changed two
     duplicate rows and nothing else. The badge carries the whole message, which
     is what this pins: the node ranks, and the row says what it needs. */
  const { page, errors } = await open("/plan.html");
  /* Pick the subject by node NAME, never by calling isSteelPath. Choosing the
     target with the function under test makes the whole case vacuous: break the
     classifier and there is no target, the early return fires, and the test goes
     green having checked nothing. That is not hypothetical - a one-character
     mutation to the regex passed this test before it was written this way. */
  const target = await page.evaluate(() => {
    const D = window.WFPRIME_DATA;
    const named = (s) => /\(Steel Path/i.test(s.node || "");
    const it = D.items.find((i) => (i.relics || []).some((r) => {
      const rec = D.relics[r];
      return rec && !rec.vaulted && (rec.sources || []).some(named);
    }));
    if (it) localStorage.setItem("wfprimes.wishlist.v1", JSON.stringify([it.id]));
    localStorage.removeItem("wfprimes.plan.v1");
    return it ? it.id : null;
  });
  assert.ok(target,
            "no live relic drops on a node named (Steel Path) - if DE really has " +
            "removed them all, delete this test rather than letting it pass empty");
  await page.reload({ waitUntil: "load" });

  assert.equal(await page.locator("#p-steel").count(), 0,
               "there is no Steel Path checkbox, and adding one back needs a reason");

  /* A Faceoff table is one reward a run against 22 relics, so it sorts well
     below anything endless and is out of sight of both the eight rows and the
     "+N more" hover. Rather than assert on something invisible, use the effort
     weights to bring it into view - which is what a player with those timings
     would see anyway. */
  await page.locator(".advanced > summary").click();
  await page.evaluate(() => {
    // re-query every time: each change re-renders the panel, so a list captured
    // up front is a list of detached nodes and setting .value on one does nothing
    const modes = Array.from(document.querySelectorAll(".effort-row input"))
      .map((el) => el.dataset.mode);
    modes.forEach((mode) => {
      const el = Array.from(document.querySelectorAll(".effort-row input"))
        .find((x) => x.dataset.mode === mode);
      if (!el) return;
      el.value = mode === "Special" ? "1" : "25";
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });

  /* Not filtered out - folded. A Steel Path Faceoff table is the same 22 relics
     at the same rates as its ordinary twin, which is exactly what makes two
     nodes one bet, so the pair collapses to a single row and the variant lives
     in that row's "+N same" list. Filtering and folding look alike from outside
     and are not: nothing was hidden, and the row that survived is the one you
     would rather run. */
  const faceoff = page.locator("#planNodes .spot").filter({ hasText: "Faceoff" });
  assert.ok(await faceoff.count() > 0, "Faceoff has to be on screen to test this");
  assert.equal(await page.locator("#planNodes .spot")
                         .filter({ hasText: "(Steel Path)" }).count(), 0,
               "a Steel Path twin should be folded into its ordinary version, " +
               "not shown as a second row for the same bet");

  const same = faceoff.first().locator(".same");
  assert.ok(await same.count() > 0, "the folded row has to say how many it stands for");
  assert.match(await same.first().evaluate((e) => e.dataset.tip), /Steel Path/,
               "and name the twin it folded, or the information is simply gone");

  // innerText, not textContent: the badge is uppercased in CSS
  const labels = await faceoff.first().locator(".demand").allInnerTexts();
  assert.ok(labels.includes("PVPVE"),
            `the surviving row keeps its own demands, got ${JSON.stringify(labels)}`);
  assert.deepEqual(errors, []);
});

page_test("a Railjack cache is scored at half, and the row says so", async () => {
  /* The only deliberate thumb on the scale in the model, so it has to be both
     applied and visible. The count on the same row must NOT move: what a run
     hands you is a fact, the penalty is only what we think it is worth going
     for, and a fact bent to suit an opinion would be a lie. */
  const { page, errors } = await open("/plan.html");
  /* Nyx Prime, whose every live route is a Railjack cache, so every ranked row
     is one and none of this depends on where a halved node happens to sort. */
  const only = await page.evaluate(() => {
    const D = window.WFPRIME_DATA;
    const it = D.items.find((i) => i.name === "Nyx Prime");
    if (!it) return null;
    localStorage.setItem("wfprimes.wishlist.v1", JSON.stringify([it.id]));
    localStorage.setItem("wfprimes.plan.v1", JSON.stringify({ railjack: true }));
    // by mode, never by calling isRailjackCache
    return (it.relics || []).every((r) => {
      const rec = D.relics[r];
      return !rec || rec.vaulted ||
        (rec.sources || []).every((s) => s.mode === "Caches");
    });
  });
  assert.ok(only, "Nyx Prime is no longer caches-only - pick another subject " +
                  "rather than letting this check drift into meaninglessness");
  await page.reload({ waitUntil: "load" });

  const row = page.locator("#planNodes .spot").filter({ hasText: "(Caches)" }).first();
  assert.ok(await row.count() > 0, "a Caches node has to be rankable with Railjack on");
  assert.match(await row.locator(".spot-meta").innerText(), /halved/,
               "a score moved by a judgement has to say so on the row");

  const halved = await page.evaluate(() => {
    const R = window.WFPrimeRotation;
    const rot = { A: 0.4, B: 0, C: 0, none: 0 };
    const cnt = { A: 0.4, B: 0, C: 0, none: 0 };
    const r = R.runValue(rot, "Caches", false, null, cnt);
    return { total: r.total, count: r.count, penalty: R.cachePenalty };
  });
  assert.equal(halved.penalty, 0.5);
  assert.ok(Math.abs(halved.count - halved.total) < 1e-12,
            "runValue itself must stay unpenalised - the planner applies it, " +
            "so the collection view and the counts are not quietly moved too");
  assert.deepEqual(errors, []);
});

page_test("Railjack is forced in when it is the only route, and says so", async () => {
  /* The one place the planner could strand you. Nyx Prime's four parts all come
     from relics that exist only on Proxima, so with Railjack off the page found
     eight good places and discarded every one. It printed an empty heading at
     first, then an empty heading that named the switch — better, but an opt-in
     gate in front of the ONLY option is still a dead end.

     Owner's decision, 2026-08-25: force them in and mark them. So this now
     asserts the opposite of what it used to. `noNodes` is still there and still
     right for event nodes and for the day the data changes; it simply cannot
     fire for Railjack any more, because nothing is left stranded — measured
     across the whole catalogue, exactly the six documented Primes take this
     path and no live relic is stranded at all. */
  const { page, errors } = await open("/plan.html");
  /* Named outright rather than found with isRailjack. Picking the subject with
     the code under test makes the case vacuous - break the classifier, find no
     subject, return early, go green having checked nothing.

     Nyx Prime is the documented example (PROJECT.md §7): its relics live on
     Proxima planets AND on Railjack nodes that sit on ordinary ones, like
     Beacon Shield Ring on Venus, so no simple property of the data picks it out
     without reimplementing the classifier. If DE ever gives it a star-chart
     route this fails, which is the right way to find that out. */
  const stranded = await page.evaluate(() => {
    const D = window.WFPRIME_DATA;
    const it = D.items.find((i) => i.name === "Nyx Prime");
    if (it) localStorage.setItem("wfprimes.wishlist.v1", JSON.stringify([it.id]));
    localStorage.setItem("wfprimes.plan.v1", JSON.stringify({ railjack: false }));
    return it ? it.name : null;
  });
  assert.ok(stranded, "Nyx Prime is not in the dataset - pick another item that " +
                      "can only be farmed on Railjack, do not delete the check");
  await page.reload({ waitUntil: "load" });

  const where = page.locator("#planNodes");
  assert.equal(await page.locator("#p-railjack").isChecked(), false,
               "Railjack must still be opt-in — this is an exception, not a default");

  const rows = await where.locator(".spot").count();
  assert.ok(rows > 0,
            `${stranded} has no route but Railjack, so its places must be ranked ` +
            `anyway rather than leaving the reader an empty list and a checkbox`);

  // every one of them says what it needs, and why it is here despite the switch
  const marks = await page.evaluate(() => [...document.querySelectorAll("#planNodes .spot")]
    .map((el) => ({
      demand: [...el.querySelectorAll(".demand")].map((d) => d.textContent.trim()),
      onlyRoute: [...el.querySelectorAll(".est")].some((e) => /only route/.test(e.textContent)),
    })));
  for (const m of marks) {
    // textContent, so this is the authored casing — the uppercase is CSS
    assert.ok(m.demand.some((d) => /railjack/i.test(d)),
              `a forced-in row must still say what it demands, got ${m.demand.join(",")}`);
    assert.ok(m.onlyRoute,
              "a row that overrode the reader's switch has to say so on the row");
  }

  /* The panel underneath must agree with the list. It counted `!vaulted` alone
     and said four relics were dropping beside an empty ranking; now that these
     rank, it has to keep counting them. */
  const needs = await page.locator("#planNeeds").innerText();
  assert.doesNotMatch(needs, /nowhere you have switched on/,
                      "nothing is switched off for this item any more");

  // the native box is hidden behind a styled span, so click the label a real
  // reader would click, not the input
  await page.locator("label:has(#p-railjack)").click();
  assert.ok(await page.locator("#p-railjack").isChecked());
  assert.ok(await where.locator(".spot").count() >= rows,
            "ticking the box cannot take places away");
  const stillMarked = await page.evaluate(() =>
    [...document.querySelectorAll("#planNodes .spot .est")]
      .some((e) => /only route/.test(e.textContent)));
  assert.equal(stillMarked, false,
               "with the switch ON nothing is being forced, so the mark must go");
  assert.equal(await where.locator(".spot").first().locator(".demand").innerText(),
               "RAILJACK", "and every one of them still says what it needs");
  assert.deepEqual(errors, []);
});

page_test("minutes per reward re-sort the list, and are remembered", async () => {
  /* The whole point of this option is that it changes the answer: ranking per
     run flatters anything long, and one player's timings moved Capture nodes up
     over a hundred places. A control that stores a number without moving a row
     would look like it worked. */
  const { page, errors } = await open("/plan.html");
  await wishFarmable(page);                            // any farmable Prime will do

  const order = () => page.locator("#planNodes .spot-where").allInnerTexts();
  const before = await order();
  assert.ok(before.length > 1, "need a ranking before there is anything to re-rank");
  assert.match(await page.locator("#planNodes .spot-score").first().innerText(),
               /[\d.]+\s*\nrelics \/ reward/,
               "with nothing set, reward count is the default cost basis");

  // an endless mission made expensive per round has to fall behind a fast one
  await page.locator(".advanced > summary").click();
  const rows = page.locator(".effort-row input");
  assert.ok(await rows.count() > 0, "every mission type in the plan gets a box");
  const set = async (mode, mins) => {
    const box = page.locator(`.effort-row input[data-mode="${mode}"]`);
    if (await box.count()) { await box.fill(String(mins)); await box.blur(); }
    return box.count();
  };
  await set("Survival", 12);
  await set("Capture", 2);

  assert.match(await page.locator("#planNodes .spot-score").first().innerText(),
               /[\d.]+\s*\nrelics \/ min/,
               "the rows say what they are now ranked on");
  assert.notDeepEqual(await order(), before,
                      "costing a long mission twelve minutes a round changed nothing");
  assert.ok(await page.locator("#planNodes .est").count() > 0,
            "a type with no minutes of its own is costed at the average, and says so");

  await page.reload({ waitUntil: "load" });
  assert.match(await page.locator("#planNodes .spot-score").first().innerText(),
               /relics \/ min/, "the weights did not survive a reload");

  await page.locator(".advanced > summary").click();
  await page.locator("#effortClear").click();
  assert.deepEqual(await order(), before,
                   "clearing puts the per-reward default back");
  assert.match(await page.locator("#planNodes .spot-score").first().innerText(),
               /relics \/ reward/, "and says so again");

  /* The default is a cost basis, not "no cost basis": a four-round Defense is
     costed four times a single-objective Capture even with every box empty.
     That is the whole of decision 3 - per run flattered anything long. */
  /* The objective count lives on the meta line - "rot A+B+C · 4 rounds · …" -
     rather than in the corner, which now carries only the ranked figure and the
     per-run count. Read it from where it actually is. */
  const basis = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("#planNodes .spot"));
    return rows.map((s) => ({
      meta: s.querySelector(".spot-meta").textContent.trim(),
      alt: s.querySelector(".spot-alt").textContent.trim(),
      head: s.querySelector(".spot-score b").textContent.trim(),
    }));
  });
  const multi = basis.find((r) => /\b(\d+) (round|vault|cache|stage)s\b/.test(r.meta));
  assert.ok(multi, `no multi-objective row on screen to check: ${JSON.stringify(basis)}`);
  const perRun = Number(multi.alt.match(/^([\d.]+) a run/)[1]);
  const objectives = Number(multi.meta.match(/\b(\d+) (?:round|vault|cache|stage)s\b/)[1]);
  const shown = Number(multi.head);
  assert.ok(Math.abs(shown - perRun / objectives) < 0.01,
            `headline ${multi.head} should be ${perRun} over ${objectives} objectives`);
  assert.deepEqual(errors, []);
});

page_test("getting in and out is charged once a run, and only where minutes are given", async () => {
  /* The largest known distortion in the per-minute ranking, measured by the
     owner from their own runs: a mission start is about 20 seconds and an end
     about 15, so 35 seconds whatever the run is. Because it is fixed it lands
     almost entirely on the short missions — Capture's cost rises 38.9% and its
     rate falls 28%, against 1.9% for Survival — so part of Capture's winning
     margin was an accounting error.

     Three things are asserted, and the second is the one that could silently be
     wrong: that it is charged ONCE per run rather than once per objective. */
  const { page, errors } = await open("/plan.html");
  await wishFarmable(page, 4);

  const setRun = (key, mins) => page.evaluate(([k, v]) => {
    const el = [...document.querySelectorAll("#effortRunRows input")]
      .find((x) => x.dataset.run === k);
    if (!el) throw new Error("no overhead field " + k);
    el.value = String(v);
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, [key, mins]);

  const headline = () => page.evaluate(() => ({
    unit: [...document.querySelector("#planNodes .spot-score").childNodes]
      .filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join("").trim(),
    top: Number(document.querySelector("#planNodes .spot-score b").textContent),
  }));

  /* An overhead on its own must not convert the default ranking. With no
     per-type minutes the list is costed in reward *count*, and 35 seconds has no
     meaning in rewards — a reward is anything from a 45-second Defense wave to a
     five-minute Survival rotation. It is stored and it waits. */
  const before = await headline();
  assert.match(before.unit, /reward/, "the default is reward count, not minutes");
  await setRun("runStart", 0.5);
  await setRun("runEnd", 0.5);
  const still = await headline();
  assert.match(still.unit, /reward/,
               "an overhead alone cannot turn a reward count into minutes");
  assert.equal(still.top, before.top, "and it must not move a single figure");
  assert.equal(await page.evaluate(() =>
    JSON.parse(localStorage.getItem("wfprimes.plan.v1")).runStart), 0.5,
    "it is kept, though — waiting is not discarding");

  /* Now give one mission type real minutes, which is what unlocks per-minute
     ranking, and read the arithmetic off a row that has several objectives. */
  await page.locator(".advanced > summary").click();
  const multi = await page.evaluate(() => {
    const el = [...document.querySelectorAll("#planNodes .spot")]
      .find((x) => /\b(\d+) (round|vault|cache|stage)s\b/.test(x.textContent));
    if (!el) return null;
    const m = el.textContent.match(/\b(\d+) (round|vault|cache|stage)s\b/);
    const mode = [...document.querySelectorAll("#effortRows input")].map((i) => i.dataset.mode);
    return { objectives: Number(m[1]),
             where: el.querySelector(".spot-where").childNodes[0].textContent.trim(),
             modes: mode };
  });
  assert.ok(multi && multi.objectives > 1, "need a multi-objective row to divide by");

  // every type the same, so the per-type figure is known whichever row wins
  const PER = 2;
  await page.evaluate((per) => {
    [...document.querySelectorAll("#effortRows input")].forEach((el) => {
      el.value = String(per);
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }, PER);

  const priced = await page.evaluate(() => {
    const el = document.querySelector("#planNodes .spot");
    const m = el.textContent.match(/\b(\d+) (?:round|vault|cache|stage)s\b/);
    return { objectives: m ? Number(m[1]) : 1,
             perRun: Number((el.querySelector(".spot-alt").textContent.match(/([\d.]+) a run/) || [])[1]),
             headline: Number(el.querySelector(".spot-score b").textContent) };
  });
  const overhead = 1;                       // 0.5 in + 0.5 out
  const expected = priced.perRun / (PER * priced.objectives + overhead);
  assert.ok(Math.abs(priced.headline - expected) < 0.02,
            `cost must be per×objectives + overhead ONCE: ${priced.perRun} over ` +
            `(${PER}×${priced.objectives} + ${overhead}) = ${expected.toFixed(3)}, ` +
            `row says ${priced.headline}`);
  /* The failure this rules out: charging it per objective instead. On a
     multi-objective row the two differ by a lot, which is why the row is
     required to have more than one above. */
  const perObjective = priced.perRun / ((PER + overhead) * priced.objectives);
  assert.ok(Math.abs(priced.headline - perObjective) > 0.01,
            "an overhead charged per objective would give the same answer here, " +
            "so this row cannot tell the two apart — pick a longer one");

  // and it survives a reload, like every other number in that panel
  await page.reload({ waitUntil: "load" });
  assert.equal(await page.evaluate(() =>
    JSON.parse(localStorage.getItem("wfprimes.plan.v1")).runEnd), 0.5);

  /* Clear all means all of it. A number left behind here would go on moving the
     ranking after the reader believed they had reset it. */
  await page.locator(".advanced > summary").click();
  await page.locator("#effortClear").click();
  const cleared = await page.evaluate(() => JSON.parse(localStorage.getItem("wfprimes.plan.v1")));
  assert.equal(cleared.runStart, 0, "clear all has to clear the overhead too");
  assert.equal(cleared.runEnd, 0);
  assert.match((await headline()).unit, /reward/, "and the default comes back");

  assert.deepEqual(errors, []);
});

page_test("the collection view is untouched by the planner's run overhead", async () => {
  /* "Both pages agree" is a rule here, and this is a case where they legitimately
     differ — worth asserting for that reason rather than despite it. The drawer
     ranks per *run* and has no effort panel at all, so a number that only exists
     to divide minutes by cannot reach it. If it ever does, the two pages have
     started disagreeing about what a run costs. */
  const { page, errors } = await open("/index.html");
  const subject = await pickCard(page);
  const read = async () => {
    await page.locator(`[data-id="${subject.id}"]`).click();
    const spots = await page.locator(".drawer .spot .spot-score b").allInnerTexts();
    await page.keyboard.press("Escape");
    return spots;
  };

  const before = await read();
  assert.ok(before.length > 0, `${subject.name} has to offer somewhere to farm`);

  await page.evaluate(() => {
    const plan = JSON.parse(localStorage.getItem("wfprimes.plan.v1") || "{}");
    plan.runStart = 5; plan.runEnd = 5;      // absurd on purpose
    plan.minutes = { Capture: 1, Defense: 1, Survival: 1 };
    localStorage.setItem("wfprimes.plan.v1", JSON.stringify(plan));
  });
  await page.reload({ waitUntil: "load" });

  assert.deepEqual(await read(), before,
                   "ten minutes of overhead moved a figure on a page that has no " +
                   "minutes in it at all");
  assert.equal(await page.locator("#effortRunRows").count(), 0,
               "and the collection view must not grow an effort panel by accident");
  assert.deepEqual(errors, []);
});

page_test("the two pages agree about what is on the farm list", async () => {
  const { page } = await open("/index.html");
  const subject = await pickCard(page);                // any card will do
  await page.locator(`[data-id="${subject.id}"]`).click();
  await page.getByRole("button", { name: /add to farm list/i }).click();
  const id = JSON.parse(await page.evaluate(
    () => localStorage.getItem("wfprimes.wishlist.v1")))[0];
  assert.equal(id, subject.id, "the card that was banked is the one that was stored");

  await page.goto(origin + "/plan.html", { waitUntil: "load" });
  const list = await page.locator("#wishlist").innerText();
  assert.ok(list.trim().length > 0 && !/empty/i.test(list),
            `the planner did not pick up ${id} from the shared store`);
});

page_test("a bounty row names the live rotation and how long it has left", async () => {
  const { page } = await open("/plan.html");
  const bounty = await page.evaluate(() => {
    const R = window.WFPrimeRotation;
    const groups = Object.keys((window.WFPRIME_DATA.meta.bounties || {}).groups || {});
    if (!groups.length) return null;
    const live = R.liveRotation(groups[0]);
    return { letter: live.letter, endsAt: live.endsAt, text: R.untilText(live.endsAt) };
  });
  if (!bounty) return;                       // a mirror build has no bounty data
  assert.match(bounty.letter, /^[ABC]$/);
  assert.ok(bounty.endsAt > Date.now(), "the window a countdown counts to must be ahead of now");
  assert.match(bounty.text, /^\d+ min$|^\d+h \d\dm$/);
});

page_test("a ranked node says when it is a fissure, and stops saying so", async () => {
  /* The badge is the only thing on this page with an expiry, and the failure
     that matters is the quiet one: a build from this morning still saying a node
     is a fissure when it shut at lunchtime. Nobody reads that as a bug — they
     fly there, find an ordinary mission, and conclude the tool is wrong about
     everything.

     The clock is the subject, so the fissures are planted rather than found: a
     real feed would have to be re-fetched to make anything expire, and the test
     would then be about the network. The node is read off the row the planner
     ranked rather than chosen here, so this cannot quietly pass by marking a
     node nobody is being sent to — and the Prime is whichever one the data
     offers, because nothing here is about any particular Prime. */
  const { page, errors } = await open("/plan.html");
  await wishFarmable(page);

  const first = page.locator("#planNodes .spot").first();
  assert.ok(await first.count() > 0, "nothing ranked, so there is no row to mark");
  const key = await first.locator(".fissure-slot").getAttribute("data-node");
  assert.ok(key && /\(.+\)/.test(key),
            `the row has to carry the name DE use for the node, got ${key}`);

  /* Mutated in place: the page took a reference to this array at load, which is
     also why a reload would undo it. Toggling an option is how a render is
     asked for from out here — clicked in the page, because the real checkbox
     sits under a styled span that swallows a pointer. */
  const rerender = () => page.evaluate(() => document.querySelector("#p-squad").click());
  const plant = (node, mins) => page.evaluate(([n, m]) => {
    const list = window.WFPRIME_DATA.fissures;
    const at = (x) => new Date(Date.now() + x * 60000).toISOString();
    list.splice(0, list.length,
      { node: n, tier: "Neo", mode: "Survival", ends: at(m), hard: false, storm: false },
      { node: n, tier: "Axi", mode: "Defense", ends: at(-90), hard: false, storm: false });
  }, [node, mins]);

  await plant(key, 90);
  await rerender();
  const badge = first.locator(".tag.fissure");
  assert.equal(await badge.count(), 1, `${key} is a fissure and the row does not say so`);
  const said = await badge.innerText();
  assert.match(said, /NEO/i, "the tier decides which relic to bring, so it is on the badge");
  assert.ok(!/AXI/i.test(said), `an expired fissure is still being named: ${said}`);
  assert.match(said, /1H 2\dM|1H 30M/i, "and how long is left, so it can be judged");

  await plant(key, -1);
  await rerender();
  assert.equal(await first.locator(".tag.fissure").count(), 0,
               "with it expired the row must stop claiming a fissure entirely");
  assert.deepEqual(errors, []);
});

page_test("the planner catches up the moment the tab comes back", async () => {
  /* An interval is not a clock. A background tab has its timers throttled to
     about once a minute, and the bounty tick deliberately does nothing at all
     while document.hidden - so a tab left open came back showing a countdown
     frozen where it was left and a ranking built for a rotation letter that had
     since turned over, and the interval could take another half-minute to
     notice.

     Only the visibilitychange handler is exercised here: the fissure is planted
     and NOTHING else is touched, so a badge appearing can only have come from
     the page catching itself up. */
  const { page, errors } = await open("/plan.html");
  await wishFarmable(page);

  assert.ok(await page.locator("#planNodes .spot").count() > 0,
            "nothing ranked, so there is no row to mark");
  /* A row with no fissure on it yet — the feed is live and carries dozens, so
     the top row is a coin toss and "nothing should claim one" would fail on
     the truth. */
  const key = await quietRow(page);
  const row = rowFor(page, key);
  assert.equal(await row.locator(".tag.fissure").count(), 0,
               "no fissure has been planted yet, so nothing should claim one");

  await page.evaluate((n) => {
    window.WFPRIME_DATA.fissures.splice(0, window.WFPRIME_DATA.fissures.length, {
      node: n, tier: "Neo", mode: "Survival",
      ends: new Date(Date.now() + 45 * 60000).toISOString(), hard: false, storm: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  }, key);

  assert.equal(await rowFor(page, key).locator(".tag.fissure").count(), 1,
               "coming back to the tab has to refresh what the clock decides");
  assert.deepEqual(errors, []);
});

page_test("the collection view names the node that is a fissure, as the planner does", async () => {
  /* `pickNode` takes the fissure test as an argument. The planner passed it and
     this page did not, so with a fissure live at a member that was not the
     lowest-level one the two named different nodes - and since the pick BECOMES
     the row, its level, planet and badges came with it.

     The group is read off the rendered tooltip rather than worked out here, so
     this cannot quietly pass by folding nothing: the member a fissure is planted
     at is one the page itself said was in the group and did not name. */
  const { page, errors } = await open("/index.html");

  /* No preference about which Prime: the subject is the first card on screen
     whose drawer folds a group with a member it did not name, which is the only
     shape the question can be asked in at all. Both the group and its members
     are read off the rendered tooltip rather than worked out here, so this
     cannot quietly pass by folding nothing. */
  // "  Cinxia (Ceres)  lvl 12–17" -> "Cinxia (Ceres)"
  const membersOf = (tip) => (tip || "").split("\n")
    .map((l) => (l.match(/^\s{2}(.+?\s\(.+?\))\s/) || [])[1])
    .filter(Boolean);

  let subject = null, group = null, other = null;
  for (const id of await shownIds(page)) {
    await page.locator(`[data-id="${id}"]`).click();
    const folded = await page.locator("#drawerBody .spot .same").first()
      .waitFor({ timeout: 3000 }).then(() => true, () => false);
    if (folded) {
      const g = await page.locator("#drawerBody .spot .same").first().evaluate((el) => ({
        tip: el.dataset.tip,
        named: el.closest(".spot").querySelector(".spot-where").childNodes[0].textContent.trim(),
      }));
      const alt = membersOf(g.tip).find((m) => !m.startsWith(g.named + " "));
      if (alt) { subject = id; group = g; other = alt; break; }
    }
    await page.keyboard.press("Escape");
  }
  assert.ok(subject, "no card on screen folds a group with a second member, so " +
                     "there is nowhere for a fissure to move the pick to");
  assert.ok(group.tip, "this test needs a folded group and the drawer showed none");
  const card = page.locator(`[data-id="${subject}"]`);

  await page.evaluate((n) => {
    window.WFPRIME_DATA.fissures.splice(0, window.WFPRIME_DATA.fissures.length, {
      node: n, tier: "Lith", mode: "Defense",
      ends: new Date(Date.now() + 40 * 60000).toISOString(), hard: false, storm: false,
    });
  }, other);
  await page.keyboard.press("Escape");
  await card.click();

  const after = await page.locator("#drawerBody .spot .same").first().evaluate((el) => ({
    tip: el.dataset.tip,
    named: el.closest(".spot").querySelector(".spot-where").childNodes[0].textContent.trim(),
  }));
  assert.equal(after.named + " ", other.slice(0, after.named.length + 1),
               `a fissure is live at ${other} and the row still names ${after.named}`);
  assert.match(after.tip, /the one that is a fissure right now/,
               "and it has to say why it named that one, in the planner's words");
  assert.deepEqual(errors, []);
});

page_test("banking the last part does not claim the Prime — a button does", async () => {
  /* It used to. Ticking off the fourth part on the planner wrote the Prime into
     the collected set on its own, and that is wrong in the direction that
     matters: a Prime is four parts *and* a build, so the app announced the hunt
     was over while the blueprint was still in the foundry.

     The parts are read off the page rather than counted here, so an item whose
     part list changes upstream cannot make this pass by finding nothing, and
     the Prime is whichever one the data offers — nothing here is about any
     particular one, only about a farm list that can be finished. */
  const { page, errors } = await open("/plan.html");
  const [subject] = await wishFarmable(page);
  const id = subject.id;
  assert.ok(subject.parts > 1, `${subject.name} has ${subject.parts} part(s) — ` +
                               `this needs one that takes several to finish`);

  const parts = page.locator("#wishlist .wish-part");
  assert.equal(await parts.count(), subject.parts,
               "the subject needs every one of its parts left to bank");

  // bank them one at a time; each click redraws the list, so re-query each time
  for (let guard = 0; guard < 20 && await parts.count() > 0; guard++) {
    await parts.first().click();
  }
  assert.equal(await parts.count(), 0, "every part should now be banked");

  const collectedAfterParts = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("wfprimes.collected.v1") || "[]"));
  assert.ok(!collectedAfterParts.includes(id),
            "banking every part must not decide you have built it");
  assert.match(await page.locator("#wishlist .wish-prog").first().innerText(), /^(\d+)\/\1$/,
               "the list is finished even though nothing has been claimed");

  const button = page.locator(`#wishlist [data-collect="${id}"]`);
  assert.equal(await button.count(), 1, "a finished list has to offer the claim");
  assert.match(await button.innerText(), /mark as collected/i);

  await button.click();
  assert.deepEqual(
    await page.evaluate(() => JSON.parse(localStorage.getItem("wfprimes.collected.v1") || "[]")),
    [id], "pressing it is what collects the Prime");
  assert.match(await button.innerText(), /collected/i);

  /* Reversible, because the alternative is a one-way action with no undo on a
     page you cannot undo it from. The parts stay banked either way. */
  await button.click();
  assert.deepEqual(
    await page.evaluate(() => JSON.parse(localStorage.getItem("wfprimes.collected.v1") || "[]")),
    [], "and pressing it again takes the claim back");
  assert.equal(await parts.count(), 0, "without disturbing a single banked part");
  assert.deepEqual(errors, []);
});

page_test("a part banked on the planner reaches an open collection tab", async () => {
  /* The two pages keep the same three slices of state, and until 2026-08-24
     they each kept their own copy of them. Only the planner listened for
     `storage`, so this direction was the broken one: tick a part there with the
     collection view open beside it and the collection view showed the old count
     until it was reloaded. The other way round worked. Nothing said that was
     deliberate — it was simply the half nobody wrote.

     Both pages now subscribe to one store in `shared.js`, and this asserts the
     direction that never worked rather than the one that always did.

     One browser context, two pages: `storage` fires between tabs of the same
     origin in the same profile, and the helper above makes a fresh context per
     page, which would put them in different profiles and fire nothing. */
  const context = await newProfile();
  const collection = await context.newPage();
  const planner = await context.newPage();
  const errors = [];
  for (const p of [collection, planner]) p.on("pageerror", (e) => errors.push(String(e)));

  await collection.goto(origin + "/index.html", { waitUntil: "load" });
  /* "The first item in the payload with two or more parts" was the subject, and
     that is a different Prime from the first one the page is SHOWING — it was
     vaulted, so the card the count is read off never rendered. Picked from the
     grid instead, which is the same helper every other card here uses. */
  const subject = await pickCard(collection, 2);
  const id = subject.id;
  await collection.evaluate((x) =>
    localStorage.setItem("wfprimes.wishlist.v1", JSON.stringify([x])), id);
  await collection.reload({ waitUntil: "load" });
  await planner.goto(origin + "/plan.html", { waitUntil: "load" });

  const card = collection.locator(`[data-id="${id}"] .card-prog`);
  assert.equal((await card.innerText()).trim(), `0/${subject.parts}`,
               "nothing is banked yet");

  await planner.locator("#wishlist .wish-part").first().click();

  /* No reload of the collection page anywhere in this test. If the count moves,
     it moved because the other tab said so. */
  await collection.locator(`[data-id="${id}"] .card-prog`).filter({ hasText: /^1\// })
    .waitFor({ timeout: 5000 });
  assert.match((await card.innerText()).trim(), /^1\//,
               "the collection view has to hear a part banked in the other tab");

  // and the other direction, which always worked, still does
  await collection.locator(`[data-id="${id}"]`).click();
  await collection.locator("#drawerBody .part-own").nth(1).click();
  await planner.locator("#wishlist .wish-prog").filter({ hasText: /^2\// })
    .waitFor({ timeout: 5000 });

  assert.deepEqual(errors, []);
  await context.close();
});

page_test("the ranked number, the order and the heading all say the same thing", async () => {
  /* The list was sorted on relics-per-objective with no way to ask for
     relics-per-run, and the two disagree whenever a long run is worth going on
     with. The rule the toggle has to keep is `STYLE.md §5`: the biggest number
     in a row is the one the row is sorted by — so flipping the sort has to move
     both numbers and relabel the heading, or the row claims an order it is not
     in.

     Everything here is read off the page. Nothing asserts a particular node,
     because which place wins is a fact about today's drop tables. */
  const { page, errors } = await open("/plan.html");
  await page.evaluate(() => {
    const ids = window.WFPRIME_DATA.items
      .filter((i) => (i.farmableRelics || []).length).slice(0, 4).map((i) => i.id);
    localStorage.setItem("wfprimes.wishlist.v1", JSON.stringify(ids));
  });
  await page.reload({ waitUntil: "load" });

  const read = () => page.evaluate(() => ({
    heading: document.querySelector("#planRankedOn").textContent.trim(),
    // the label sits between the <b> and the .spot-alt as a bare text node
    unit: [...document.querySelector("#planNodes .spot-score").childNodes]
      .filter((n) => n.nodeType === 3).map((n) => n.textContent.trim())
      .join(" ").trim(),
    big: [...document.querySelectorAll("#planNodes .spot-score b")].map((b) => Number(b.textContent)),
    nodes: [...document.querySelectorAll("#planNodes .spot-where")]
      .map((e) => e.childNodes[0].textContent.trim()),
  }));

  const byObjective = await read();
  assert.ok(byObjective.big.length > 2, "not enough rows ranked to compare an order");
  assert.match(byObjective.heading, /per reward/);
  assert.match(byObjective.unit, /reward/);
  assert.deepEqual(byObjective.big, [...byObjective.big].sort((a, b) => b - a),
                   "the big numbers must be in descending order — that IS the order");

  await page.evaluate(() => {
    document.querySelector("#p-sort").value = "run";
    document.querySelector("#p-sort").dispatchEvent(new Event("change"));
  });

  const byRun = await read();
  assert.match(byRun.heading, /per run/, "a list that ranks on something says so in its heading");
  assert.match(byRun.unit, /run/, "and the unit beside the number has to agree");
  assert.deepEqual(byRun.big, [...byRun.big].sort((a, b) => b - a),
                   "still sorted by the number now shown largest");
  assert.notDeepEqual(byRun.big, byObjective.big,
                      "per run and per reward must not be the same number, or " +
                      "this toggle is measuring one thing twice");

  // and it survives a reload, because it lives in the planner's saved options
  await page.reload({ waitUntil: "load" });
  assert.match((await read()).heading, /per run/);
  assert.equal(await page.locator("#p-sort").inputValue(), "run");
  assert.deepEqual(errors, []);
});

page_test("a fissure changes how far the row says to run, on both pages", async () => {
  /* *How far you run* was a control with one answer for the whole list. It is
     decided per node now, and a live fissure is the one input that overrides
     the arithmetic: the free relic for reaching five rotations is value the
     rate cannot see, so a node carrying one is run to five and that is that.

     Both pages have to reach the same answer — they are two views of one model,
     and a run costed at six rounds on one page and five on the other is the
     kind of disagreement this project has had before. The node is read off the
     row the planner ranked, so this cannot pass by marking somewhere nobody is
     being sent. */
  const { page, errors } = await open("/plan.html");
  await page.evaluate(() => {
    const ids = window.WFPRIME_DATA.items
      .filter((i) => (i.farmableRelics || []).length).slice(0, 4).map((i) => i.id);
    localStorage.setItem("wfprimes.wishlist.v1", JSON.stringify(ids));
  });
  await page.reload({ waitUntil: "load" });

  /* An endless row that is *not already a fissure*, because the whole test is
     what happens when one arrives. Picking the first endless row assumed the
     shipped fissure list was empty, which it was for the three days that feed
     was down — and the moment it came back the top-ranked endless node carried
     one, reported five rounds, and this failed on its own success. Select on a
     raw-data property instead of on whatever the ranking put first. */
  const key = await page.evaluate(() => {
    const live = new Set((window.WFPRIME_DATA.fissures || []).map((f) => f.node));
    for (const el of document.querySelectorAll("#planNodes .spot")) {
      if (!/\d+ rounds/.test(el.textContent)) continue;
      const node = (el.querySelector(".fissure-slot") || {}).dataset?.node;
      if (node && !live.has(node)) return node;
    }
    return null;
  });
  assert.ok(key, "no endless node ranked without a fissure already on it");
  /* Located on the node key, never on `hasText` of the node's name. `hasText`
     is a case-insensitive SUBSTRING match, so picking "Ani" also matched
     Tar-ani-s — and when the ranking changed on 2026-08-27 Taranis sorted above
     Ani, already carried a fissure, and reported the five rounds this asserts
     are six. The selection was already careful; the lookup was not, and a
     fuzzy lookup makes a careful selection worth nothing. */
  const endless = rowFor(page, key);
  assert.match(await endless.locator(".rounds").innerText(), /6 rounds/,
               "with no fissure this should be staying for rotation A");

  const rerender = () => page.evaluate(() => document.querySelector("#p-squad").click());
  await page.evaluate((n) => {
    window.WFPRIME_DATA.fissures.splice(0, window.WFPRIME_DATA.fissures.length, {
      node: n, tier: "Neo", mode: "Survival",
      ends: new Date(Date.now() + 50 * 60000).toISOString(), hard: false, storm: false,
    });
  }, key);
  await rerender();

  const row = rowFor(page, key);
  assert.match(await row.locator(".rounds").innerText(), /5 rounds/,
               "a fissure is up here, so the run goes to five rotations");
  /* Every `.est` on the row, not "the" one: a row can carry more than a single
     estimate note — a mission type costed at the average of the weights you did
     give also earns one — and `innerText` on a locator matching two throws a
     strict-mode violation rather than failing an assertion. Which row is picked
     depends on the ranking, so this must not assume a row's shape. */
  const notes = await row.locator(".est").allInnerTexts();
  assert.ok(notes.some((t) => /free relic/.test(t)),
            `the row has to say what the fifth rotation bought, got ${JSON.stringify(notes)}`);
  await rerender();          // put the squad box back where it was

  assert.deepEqual(errors, []);
});

page_test("an open page picks up a fissure that opened after it loaded", async () => {
  /* The badges used to be fixed at load: a one-minute timer re-read a list that
     could only shrink, so a tab left open all evening retired fissures as they
     closed and never heard about one that opened. `data/fissures.json` is the
     same list on its own — four kilobytes — re-read every ten minutes from this
     same origin, never from api.warframestat.us.

     The node is read off the row the planner ranked, so this cannot pass by
     marking somewhere nobody is being sent. */
  const { page, errors } = await open("/plan.html");
  await wishFarmable(page);

  assert.ok(await page.locator("#planNodes .spot").count() > 0, "no row to mark");
  const key = await quietRow(page);
  const row = rowFor(page, key);
  assert.equal(await row.locator(".tag.fissure").count(), 0,
               "nothing is running there yet, so nothing should claim one");

  await page.route("**/data/fissures.json", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      generated: new Date().toISOString(),
      fissures: [{ node: key, tier: "Neo", mode: "Survival",
                   ends: new Date(Date.now() + 55 * 60000).toISOString(),
                   hard: false, storm: false }],
    }),
  }));
  // the same thing returning to the tab does, without waiting ten minutes
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await rowFor(page, key).locator(".tag.fissure").waitFor({ timeout: 5000 });

  const said = await rowFor(page, key).locator(".tag.fissure").innerText();
  assert.match(said, /NEO/i, "the tier decides which relic to bring, so it is on the badge");
  assert.deepEqual(errors, []);
});

// ── the responsive rules, which only a real browser can answer ─────────────

page_test("the sidebar does not push the grid off screen on a phone", async () => {
  const { page } = await open("/index.html");
  await page.setViewportSize({ width: 375, height: 812 });
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `the page scrolls sideways by ${overflow}px at 375px wide`);
});

page_test("the four Faceoff tables are one bet and rank as one row", async () => {
  /* DE publish four Faceoff tables — Single Squad and Squad VS Squad, each with
     a Steel Path twin — and all four carry the SAME 22 relics at the SAME
     8.33%. `ROT.signature` folds nodes that are the same bet, so they should
     occupy one row rather than the top four.

     Worth a test of its own because the fold is the only thing standing between
     the ranking and four identical rows at the top: correcting Faceoff's length
     moved it from #14 to #1, so what used to be an invisible duplication is now
     the most visible thing on the page.

     The subject is chosen on the raw drop tables, never by asking the code under
     test what it thinks is foldable. */
  const { page, errors } = await open("/plan.html");

  const subject = await page.evaluate(() => {
    const D = window.WFPRIME_DATA, R = D.relics || {};
    const tables = new Map();
    Object.keys(R).forEach((n) => {
      if (R[n].vaulted) return;
      (R[n].sources || []).forEach((s) => {
        if (!/^Faceoff\b/.test(s.node || "")) return;
        if (!tables.has(s.node)) tables.set(s.node, []);
        tables.get(s.node).push(n + ":" + s.chance + "@" + (s.rotation || "-"));
      });
    });
    const sigs = new Set();
    tables.forEach((rows) => sigs.add(rows.sort().join(",")));
    // wishlist everything those relics can pay, so Faceoff actually ranks
    const wanted = new Set();
    tables.forEach((rows) => rows.forEach((r) => wanted.add(r.split(":")[0])));
    const ids = (D.items || []).filter((it) =>
      (it.parts || []).some((p) => (p.relics || []).some((r) => wanted.has(r.relic))))
      .map((it) => it.id);
    localStorage.setItem("wfprimes.wishlist.v1", JSON.stringify(ids));
    return { tableCount: tables.size, distinctTables: sigs.size,
             names: [...tables.keys()] };
  });

  assert.equal(subject.tableCount, 4, "DE publish four Faceoff tables");
  assert.equal(subject.distinctTables, 1,
               "all four must be the same bet, or folding them would hide a choice");

  await page.reload({ waitUntil: "load" });

  const rows = await page.evaluate(() => [...document.querySelectorAll("#planNodes .spot")]
    .map((el) => el.querySelector(".spot-where").childNodes[0].textContent.trim()));
  const faceoff = rows.filter((r) => /^Faceoff/.test(r));
  assert.equal(faceoff.length, 1,
               `four identical tables must fold to one row, got ${faceoff.length}: ` +
               rows.join(" | "));

  // and the row has to say it stands for the others, or the fold hides them
  const same = await page.evaluate(() => {
    const el = [...document.querySelectorAll("#planNodes .spot")]
      .find((x) => /^Faceoff/.test(x.querySelector(".spot-where").childNodes[0].textContent.trim()));
    const chip = el && el.querySelector(".same");
    return chip ? { text: chip.textContent.trim(), tip: chip.getAttribute("data-tip") } : null;
  });
  assert.ok(same, "a folded row must carry the +N same chip");
  assert.match(same.text, /\+3 same/, "three others folded into it");
  for (const n of subject.names.slice(1)) {
    assert.ok(same.tip.includes(n.split(" (")[0]),
              `the tooltip must name what was folded away, missing ${n}`);
  }
  assert.deepEqual(errors, []);
});

page_test("ranking per run does not undo the thumbs on the scale", async () => {
  /* The bug: the cache penalty and the Radiant lift were applied to `score` and
     `rate` and not to `perRun`, so switching the sort to *per run* ranked a node
     exactly where it would have sat with no thumb on it at all. The row promises
     (`STYLE.md §5`) that the biggest number is the one the list is ordered by —
     so whichever figure that is has to carry the adjustment.

     The subject is a node that hands relics over Radiant, picked on the raw
     `refinement` field rather than by asking the code under test. It is also the
     first end-to-end check that the 25% reaches a ranked number at all: none of
     these nodes appears in the eight rows ranked per objective, but ESO does
     appear ranked per run, which is the only view that can see it. */
  const { page, errors } = await open("/plan.html");

  const subject = await page.evaluate(() => {
    const D = window.WFPRIME_DATA, R = D.relics || {};
    const byNode = new Map();
    Object.keys(R).forEach((n) => {
      if (R[n].vaulted) return;
      (R[n].sources || []).forEach((s) => {
        if (s.refinement !== "Radiant") return;
        if (!byNode.has(s.node)) byNode.set(s.node, new Set());
        byNode.get(s.node).add(n);
      });
    });
    const best = [...byNode.entries()].sort((a, b) => b[1].size - a[1].size)[0];
    if (!best) return { node: null };
    const wanted = best[1];
    const ids = (D.items || []).filter((it) =>
      (it.parts || []).some((p) => (p.relics || []).some((r) => wanted.has(r.relic))))
      .map((it) => it.id);
    localStorage.setItem("wfprimes.wishlist.v1", JSON.stringify(ids));
    return { node: best[0], relics: wanted.size };
  });
  assert.ok(subject.node, "no live relic is handed over Radiant — subject gone");

  await page.reload({ waitUntil: "load" });
  await page.evaluate(() => {
    const s = document.querySelector("#p-sort");
    s.value = "run"; s.dispatchEvent(new Event("change"));
  });

  /* The headline figure and the raw count the tooltip quotes, off the same row.
     The tooltip is deliberately the UNADJUSTED fact, so the gap between the two
     is exactly the thumb. */
  const readRow = (node) => page.evaluate((name) => {
    const el = [...document.querySelectorAll("#planNodes .spot")]
      .find((x) => x.querySelector(".spot-where").childNodes[0].textContent.trim() === name);
    if (!el) return null;
    const tip = el.querySelector(".spot-score").getAttribute("data-tip") || "";
    const m = tip.match(/([\d.]+) wanted relics a run/);
    return { headline: Number(el.querySelector(".spot-score b").textContent),
             raw: m ? Number(m[1]) : null,
             saysLift: /Ranked figures \+(\d+)%/.test(tip),
             lift: (tip.match(/Ranked figures \+(\d+)%/) || [])[1] };
  }, node);

  const on = await readRow(subject.node);
  assert.ok(on, `${subject.node} is not among the rows ranked per run`);
  assert.ok(on.raw, "could not read the raw count out of the tooltip");
  assert.ok(on.saysLift, "a row carrying the bonus must say so");
  assert.equal(on.lift, "25");

  // the headline per-run figure IS the lifted one — this is the fix
  assert.ok(Math.abs(on.headline / on.raw - 1.25) < 0.02,
            `per-run headline ${on.headline} should be 1.25x the raw ${on.raw}; ` +
            `got ${(on.headline / on.raw).toFixed(3)}x — the thumb is not reaching ` +
            `the sort key`);

  /* Untick the assumption and the node must fall. Its POSITION is what is
     asserted rather than its number, because losing the bonus drops it out of
     the eight visible rows entirely — which is itself the proof that the thumb
     was moving the order, and not merely a label. */
  /* Expand the list rather than scraping a tooltip. It used to read the next
     twenty out of `.more-nodes`'s data-tip, which was the only way to see past
     the eighth row; the chip is a button now and the whole ranking is real DOM,
     so the position is read off the rows themselves. */
  const order = async () => {
    const more = page.locator("#moreNodes");
    if (await more.count() && (await more.getAttribute("aria-expanded")) === "false") {
      await more.click();
    }
    return page.evaluate(() => [...document.querySelectorAll("#planNodes .spot")]
      .map((el) => el.querySelector(".spot-where").childNodes[0].textContent.trim()));
  };

  const rankedWith = (await order()).indexOf(subject.node);
  await page.locator("label:has(#p-traces)").click();
  assert.equal(await page.locator("#p-traces").isChecked(), false);
  const rankedWithout = (await order()).indexOf(subject.node);

  assert.ok(rankedWith >= 0, "subject was not in the ranking to begin with");
  assert.ok(rankedWithout > rankedWith,
            `${subject.node} must fall when the bonus is taken away: ` +
            `#${rankedWith + 1} -> #${rankedWithout + 1}`);

  // if it is still on screen, its headline must be back to the raw count
  const off = await readRow(subject.node);
  if (off && off.raw) {
    assert.ok(Math.abs(off.headline - off.raw) < 0.02,
              `with no thumb the headline ${off.headline} must equal the raw ${off.raw}`);
  }

  assert.deepEqual(errors, []);
});

page_test("the ranking can be seen whole, not just its top eight", async () => {
  /* Eight is the right default and stays. What was missing was the way out of
     it: the rest lived in a tooltip, twenty of them as plain text, and past
     twenty-eight there was no way to see a place at all.

     That is not cosmetic. Three separate results this project measured were
     correct and unobservable purely because of it — Spy nodes reach no top eight
     on any item, and neither do the eleven that hand relics over Radiant. So
     this asserts the expander reaches them, not merely that a button toggles. */
  const { page, errors } = await open("/plan.html");

  const subject = await page.evaluate(() => {
    const D = window.WFPRIME_DATA, R = D.relics || {};
    // want everything live, so the ranking is long enough to need expanding
    const ids = (D.items || []).filter((it) =>
      (it.parts || []).some((p) => (p.relics || []).some((r) =>
        R[r.relic] && !R[r.relic].vaulted))).map((it) => it.id);
    localStorage.setItem("wfprimes.wishlist.v1", JSON.stringify(ids));
    // a node that hands relics over Radiant, off the raw field
    const pre = new Set();
    Object.keys(R).forEach((n) => {
      if (R[n].vaulted) return;
      (R[n].sources || []).forEach((s) => {
        if (s.refinement === "Radiant") pre.add(s.node);
      });
    });
    return { preRefined: [...pre] };
  });
  assert.ok(subject.preRefined.length, "no node hands relics over Radiant any more");

  await page.reload({ waitUntil: "load" });

  const rows = () => page.evaluate(() => [...document.querySelectorAll("#planNodes .spot")]
    .map((el) => el.querySelector(".spot-where").childNodes[0].textContent.trim()));

  const eight = await rows();
  assert.equal(eight.length, 8, "the default is still the top eight");

  const button = page.locator("#moreNodes");
  assert.equal(await button.count(), 1, "a long ranking has to offer a way out of eight");
  assert.equal(await button.getAttribute("aria-expanded"), "false");
  const label = (await button.innerText()).trim();
  assert.match(label, /^Show all \d+ places$/,
               `the control has to say how much is behind it, got "${label}"`);
  const total = Number(label.match(/\d+/)[0]);
  assert.ok(total > 28,
            `only ${total} places ranked — the old tooltip showed 28, so this ` +
            `test would not prove anything past it`);

  await button.click();
  const all = await rows();
  assert.equal(all.length, total, "expanding has to show every place it counted");
  assert.equal(await page.locator("#moreNodes").getAttribute("aria-expanded"), "true");
  assert.deepEqual(all.slice(0, 8), eight,
                   "the order must not change — this reveals the ranking, it does not re-rank it");

  /* The point of the whole thing: a node that was unreachable through the
     interface is now reachable through it. */
  const foundPre = subject.preRefined.filter((n) => all.includes(n));
  assert.ok(foundPre.length,
            `expanding still does not reach any pre-refined node. Wanted one of ` +
            `${subject.preRefined.join(", ")}`);
  assert.ok(!subject.preRefined.some((n) => eight.includes(n)),
            "premise check: none of them was in the top eight to begin with");

  // and it collapses back
  await page.locator("#moreNodes").click();
  assert.equal((await rows()).length, 8, "and folds back to the default");
  assert.match((await page.locator("#moreNodes").innerText()).trim(), /^Show all/);

  assert.deepEqual(errors, []);
});

page_test("the Void Traces switch names both its ends and puts under 500 on the left", async () => {
  /* It is a two-state question, not an include-X one, so it is a switch rather
     than a checkbox — and both ends are labelled so the answer never depends on
     reading a colour.

     Asserted on `matches(selector)` rather than on computed colour. A switch is
     mostly CSS transitions and the Browser pane does not composite a hidden tab,
     so getComputedStyle hands back a colour frozen part-way through the fade no
     matter how long you wait. matches() reads the cascade, which is what the rule
     actually says. */
  const { page, errors } = await open("/plan.html");

  const box = page.locator("#p-traces");
  assert.equal(await box.isChecked(), true, "short-on-traces is the default");

  // the two ends, in document order, with under 500 first
  const ends = await page.evaluate(() =>
    [...document.querySelectorAll(".check-switch .switch-group > *")]
      .map((el) => ({ cls: el.className, text: el.textContent.trim() })));
  assert.equal(ends.length, 3, "left label, track, right label");
  assert.match(ends[0].text, /under 500/, "under 500 is the LEFT end");
  assert.ok(/switch$/.test(ends[1].cls), "the track sits between the two words");
  assert.match(ends[2].text, /over 500/, "over 500 is the right end");

  const state = () => page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    return {
      tightLit: q(".end-tight").matches(".check input:checked ~ .switch-group .end-tight"),
      plentyLit: q(".end-plenty")
        .matches(".check input:not(:checked) ~ .switch-group .end-plenty"),
      knobRight: q(".switch-knob")
        .matches(".check input:not(:checked) ~ .switch-group .switch-knob"),
    };
  });

  const on = await state();
  assert.deepEqual(on, { tightLit: true, plentyLit: false, knobRight: false },
                   "short on traces lights the left word and rests the knob left");

  await page.locator("label:has(#p-traces)").click();
  assert.equal(await box.isChecked(), false);
  const off = await state();
  assert.deepEqual(off, { tightLit: false, plentyLit: true, knobRight: true },
                   "plenty lights the right word and sends the knob right");

  // the real input still drives it, so keyboard and assistive tech work
  assert.equal(await page.locator(".check-switch input[type=checkbox]").count(), 1,
               "the switch has to be a real checkbox underneath, not a div");

  await page.locator("label:has(#p-traces)").click();
  assert.equal(await box.isChecked(), true, "and it toggles back");
  assert.deepEqual(errors, []);
});

page_test("the collection drawer can show more than its eight best places", async () => {
  /* The planner's ranking got a way out of its top eight; this list was the same
     defect one page over and had no route to a ninth place at all -- not even the
     tooltip the planner used to have.

     Not hypothetical. No live relic drops ONLY at Spy -- the highest share is
     Meso V15 at 13 sources of 147 -- so a Spy node is outranked on every item and
     could not be seen here while its costing was being verified. The subject is
     chosen on the raw drop tables for that reason. */
  const { page, errors } = await open("/index.html");

  const subject = await page.evaluate((shown) => {
    const D = window.WFPRIME_DATA, R = D.relics || {};
    const on = new Set(shown);
    // the card on screen with the most distinct places behind it, so the fold
    // is real - and on screen, because the drawer is what is being opened
    let best = null;
    for (const it of D.items || []) {
      if (!on.has(it.id)) continue;
      const nodes = new Set();
      for (const p of it.parts || []) {
        for (const r of p.relics || []) {
          const rec = R[r.relic];
          if (!rec || rec.vaulted) continue;
          (rec.sources || []).forEach((s) => nodes.add(s.planet + "|" + s.node));
        }
      }
      if (!best || nodes.size > best.places) best = { id: it.id, name: it.name, places: nodes.size };
    }
    return best;
  }, await shownIds(page));
  assert.ok(subject && subject.places > 8,
            `no card on screen has more than eight places behind it ` +
            `(${JSON.stringify(subject)})`);

  await page.evaluate((id) => {
    document.querySelector(`[data-id="${id}"]`).click();
  }, subject.id);

  const rows = () => page.evaluate(() => [...document.querySelectorAll(".spots .spot")]
    .map((el) => el.querySelector(".spot-where").childNodes[0].textContent.trim()));

  const eight = await rows();
  assert.equal(eight.length, 8, "the drawer still opens on the top eight");

  const button = page.locator("#moreSpots");
  assert.equal(await button.count(), 1, "and offers a way past them");
  assert.equal(await button.getAttribute("aria-expanded"), "false");
  const label = (await button.innerText()).trim();
  assert.match(label, /^Show all \d+ places$/,
               `the control has to say how much is behind it, got "${label}"`);

  await button.click();
  const all = await rows();
  assert.ok(all.length > eight.length, "expanding has to show more");
  assert.equal(all.length, Number(label.match(/\d+/)[0]),
               "and exactly as many as it promised");
  assert.deepEqual(all.slice(0, 8), eight,
                   "the order must not change — this reveals the list, it does not re-rank it");
  assert.equal(await page.locator("#moreSpots").getAttribute("aria-expanded"), "true");

  // collapses again
  await page.locator("#moreSpots").click();
  assert.equal((await rows()).length, 8);

  /* Opening a DIFFERENT item starts folded again: eight is the answer to "where
     do I farm this", and carrying an expanded view across items would make the
     default stop meaning that. */
  await page.locator("#moreSpots").click();
  assert.equal((await rows()).length > 8, true, "expanded before switching item");
  const other = await page.evaluate((skip) => {
    const el = [...document.querySelectorAll("[data-id]")].find((c) => c.dataset.id !== skip);
    if (!el) return null;
    el.click();
    return el.dataset.id;
  }, subject.id);
  assert.ok(other, "no second item to open");
  const after = await page.locator(".spots .spot").count();
  assert.ok(after <= 8, `a freshly opened item must start folded, got ${after} rows`);

  assert.deepEqual(errors, []);
});

/* One file, two pages, one result. Until 2026-08-27 the collection view ended
   its import by retracting any tick the file's own parts did not account for and
   the planner kept it, so the same backup restored two different collections
   depending on which page you happened to be looking at. The file below is the
   shape that produced it, and it is reachable without hand-editing anything:
   tick a Prime, let a rebuild rename or add one of its parts, and the next
   backup written says both things. */
page_test("a self-contradictory backup restores the same way on both pages", async () => {
  const build = async (page) => page.evaluate(() => {
    const item = (window.WFPRIME_DATA.items || []).find((i) => (i.parts || []).length >= 2);
    const first = item.parts[0];
    return {
      id: item.id,
      partCount: item.parts.length,
      file: JSON.stringify({
        format: 3,
        exported: "2026-08-20T10:00:00.000Z",
        collected: [item.id],                                    // the claim
        parts: { [item.id]: { [first.name]: first.itemCount || 1 } },  // one of several
        wishlist: [], materials: [], filters: null, plan: {},
      }),
    };
  });

  const restore = async (url) => {
    const { page } = await open(url);
    const { id, file } = await build(page);
    await page.evaluate((text) => {
      document.querySelector("#dataBtn").click();
      document.querySelector("#dataArea").value = text;
      document.querySelector("#importBtn").click();
    }, file);
    await page.waitForTimeout(300);                    // before the reload at 700ms
    const message = await page.evaluate(() => document.querySelector("#dlgMsg").textContent);
    await page.waitForTimeout(1400);
    const stored = await page.evaluate(() => ({
      collected: JSON.parse(localStorage.getItem("wfprimes.collected.v1") || "[]"),
      parts: JSON.parse(localStorage.getItem("wfprimes.parts.v1") || "{}"),
    }));
    return { id, message, stored };
  };

  const collection = await restore("/index.html");
  const planner = await restore("/plan.html");

  assert.deepEqual(collection.stored.collected, [collection.id],
                   "the tick has to survive — a restore reproduces the file, it does not judge it");
  assert.deepEqual(planner.stored.collected, collection.stored.collected,
                   "and both pages have to agree about it, which is the whole point");
  assert.deepEqual(planner.stored.parts, collection.stored.parts);

  for (const [where, r] of [["collection", collection], ["planner", planner]]) {
    assert.match(r.message, /1 Prime is ticked but its parts are incomplete/,
                 `the ${where} page restored it silently, which is the other half of the bug`);
  }
  assert.equal(collection.message.includes("1 Prime is ticked but its parts are incomplete"),
               planner.message.includes("1 Prime is ticked but its parts are incomplete"),
               "and in the same words — two copies of a sentence are two sentences");
});

page_test("a Prime Resurgence Prime gets a crack list, and is told why there is nowhere to run", async () => {
  /* A Resurgence relic is **vaulted by definition** — that is what being in
     Resurgence means — so `rec.vaulted` alone dropped all of them out of the
     plan, and putting one of these Primes on the farm list produced a planner
     with nothing whatever to say. Which reads as a broken page rather than a
     deliberate silence, and it was silent about exactly the Primes the
     collection view was busy badging as available.

     Both halves are asserted, because either alone is still wrong: *Where to go*
     must stay empty (these do not drop), and it must say so in terms that are
     true — the old fallback claimed "these relics drop, but nowhere you can
     reach", which names a problem the reader does not have. */
  const { page, errors } = await open("/plan.html");
  const subject = await page.evaluate(() => {
    const it = (window.WFPRIME_DATA.items || [])
      .find((i) => (i.flags || {}).resurgence && (i.relics || []).length);
    if (!it) return null;
    localStorage.setItem("wfprimes.wishlist.v1", JSON.stringify([it.id]));
    return it.name;
  });
  assert.ok(subject, "no Prime is in Resurgence in this build, so nothing to assert");
  await page.reload({ waitUntil: "load" });

  const rows = page.locator("#planRelics .relic-row");
  assert.ok(await rows.count() > 0,
            `${subject} is in Resurgence and its relics are buyable, so they must be crackable`);
  assert.equal(await page.locator("#planRelics .from-varzia").count(), await rows.count(),
               "every row here comes from Varzia, and a row that does not say so reads as a drop");

  /* And it must be her shelf, not every relic that holds a part of a Prime she
     is offering. Those are different lists and the second was shipped as the
     first: 88 relics badged "from Varzia" against the six she was really
     selling, which sends the reader to Maroo's for a relic that is not there.

     The size is the assertion. A Prime Vault rotation is a handful of relics —
     six as this was written, and the tag carries between 8 and 28 rows across
     four refinements, so a couple of dozen is the ceiling. Anything past that
     means the shelf has stopped being read and the per-Prime guess is back. */
  const shelf = await page.evaluate(() =>
    Object.keys(window.WFPRIME_DATA.relics).filter((n) => window.WFPRIME_DATA.relics[n].resurgence));
  assert.ok(shelf.length > 0 && shelf.length <= 12,
            `Varzia stocks a rotation, not a catalogue — ${shelf.length} relics ` +
            `marked hers: ${shelf.join(", ")}`);


  assert.match(await page.locator("#planRelics .from-varzia").first().innerText(),
               /from Varzia/i, "the badge names where the relic comes from");

  assert.equal(await page.locator("#planNodes .spot").count(), 0,
               "these relics have no sources, so ranking a place to run them would be invented");
  const why = await page.locator("#planNodes .nowhere").innerText();
  assert.match(why, /Prime Resurgence/,
               `the reader has to be told why: ${why}`);
  assert.ok(!/relics drop, but nowhere you can reach/.test(why),
            "they do not drop at all — that message is true of a different situation");
  assert.deepEqual(errors, []);
});

page_test("a relic you have to go and buy sorts below every relic you can farm", async () => {
  /* Owner's call, 2026-08-27. Ranked purely on openings per part cleared, a
     Varzia relic with a good ratio sat above relics the reader could go and get
     this evening — which reads as advice to go shopping. They are not the same
     kind of errand: a dropping relic costs a mission you were going to run
     anyway, a Resurgence one costs Aya and a trip to Maroo's, and a trade-only
     one costs finding another player. The ratio still orders within each group,
     so nothing is lost; the groups simply no longer interleave.

     Both kinds have to be on screen at once or there is nothing to sort, so the
     farm list is everything with a live relic plus everything in Resurgence. */
  const { page, errors } = await open("/plan.html");
  const wanted = await page.evaluate(() => {
    const D = window.WFPRIME_DATA;
    const ids = D.items.filter((i) => (i.flags || {}).resurgence ||
                                      (i.farmableRelics || []).length).map((i) => i.id);
    localStorage.setItem("wfprimes.wishlist.v1", JSON.stringify(ids));
    return ids.length;
  });
  assert.ok(wanted > 0, "nothing to want, so nothing to rank");
  await page.reload({ waitUntil: "load" });

  /* Read off the badge each row carries rather than recomputed here — the badge
     is what tells the reader which errand this is, so it is the right thing to
     be ordering by. */
  const kinds = await page.evaluate(() => [...document.querySelectorAll("#planRelics .relic-row")]
    .map((el) => (el.querySelector(".from-varzia") ? "varzia"
                : el.querySelector(".from-trade") ? "trade" : "farm")));
  assert.ok(kinds.includes("farm"), `no farmable relic on screen: ${kinds.join(",")}`);
  assert.ok(kinds.includes("varzia"), `no Varzia relic on screen: ${kinds.join(",")}`);
  assert.ok(kinds.lastIndexOf("farm") < kinds.indexOf("varzia"),
            `every farmable relic must come before the first Varzia one — got ` +
            kinds.join(","));
  if (kinds.includes("trade")) {
    assert.ok(kinds.lastIndexOf("varzia") < kinds.indexOf("trade"),
              "and trade-only is further from farmable still, so it sorts last");
  }
  assert.deepEqual(errors, []);
});

page_test("a Prime with no way in still gets the relics to trade for, and the refinement", async () => {
  /* Named subject: Ash Prime is vaulted, has no Baro or quest route, and every
     one of its 21 relics is vaulted. Before 2026-08-27 the planner answered that
     with an empty page.

     *"Which relics do I need to trade for, and what do I refine them to"* is a
     real question with a real answer, and the refinement beside each row is the
     part that makes it worth showing — it is the one thing still to decide, and
     it is the same advice the row would carry if the relic were dropping.

     No switch turns this on, deliberately. The condition is "this Prime has no
     other route", which the page can work out; a checkbox would ask the reader
     to tell it something it already knows. */
  const { page, errors } = await open("/plan.html");
  await page.evaluate(() =>
    localStorage.setItem("wfprimes.wishlist.v1", JSON.stringify(["warframe-ash-prime"])));
  await page.reload({ waitUntil: "load" });

  const rows = page.locator("#planRelics .relic-row");
  const n = await rows.count();
  assert.ok(n > 0, "Ash Prime is trade-only, which is an answer rather than a blank");
  assert.equal(await page.locator("#planRelics .from-trade").count(), n,
               "every row is trade-only here, and one that does not say so reads as a drop");
  assert.ok(await rows.first().locator(".advice").count() > 0,
            "the refinement is the point of showing the row at all");

  assert.equal(await page.locator("#planNodes .spot").count(), 0,
               "nothing drops, so ranking somewhere to run would be invented");
  const why = await page.locator("#planNodes .nowhere").innerText();
  assert.match(why, /vaulted/, `the reader has to be told why: ${why}`);
  assert.ok(!/relics drop, but nowhere you can reach/.test(why),
            "they do not drop — that message belongs to a different situation");
  assert.deepEqual(errors, []);
});

page_test("the drawer hides vaulted relics by default, and says so rather than showing nothing", async () => {
  /* Changed 2026-08-27: the drawer's question is "where do I farm this part",
     and a vaulted relic cannot be farmed, so listing them first buries the few
     you can actually go and get. Safe to default on only because the empty case
     answers itself — which is what this asserts, because a silently empty part
     is the failure this default could otherwise introduce. */
  const { page, errors } = await open("/index.html");
  /* *Vaulted* is a sidebar default and `#hideVaulted` is a drawer default, and
     this test is about the second one. So the first is ticked on outright — the
     named subject has to be on screen before its drawer can be opened — and
     `#hideVaulted` is deliberately left exactly as it ships, because it is what
     is being asserted. A test about a default is the one kind that should fail
     when that default moves; that is its whole job. */
  await setCheck(page, "#f-vaulted", true);
  await page.locator('[data-id="warframe-ash-prime"]').click();
  assert.equal(await page.locator("#hideVaulted").isChecked(), true,
               "the default moved, and a saved choice still wins over it");
  const note = await page.locator("#drawerBody .relic-none").first().innerText();
  assert.match(note, /vaulted/i,
               "every relic here is vaulted, so the part must say so rather than look empty");
  assert.match(note, /Hide vaulted/,
               "and name the switch that would show them");
  assert.deepEqual(errors, []);
});

// ── the single-file build ──────────────────────────────────────────────────
//
// `dist/warframe-prime-hunter.html` is the artefact strangers download, and
// until 2026-08-27 nothing anywhere drove it: these tests served the two pages,
// and test_build.py read the built file as text. Six defects were living in
// that gap, none of them reachable on either page alone, because the single
// file is both pages in one document - so every shared wiring call happened
// twice and every id below the header existed twice.
//
// Each test below is one of those six. They are cheap, and any one of them
// would have caught the lot on the day it appeared.

const BUNDLE = path.join(ROOT, "dist", "warframe-prime-hunter.html");
const bundleWhy = why
  || (fs.existsSync(BUNDLE) ? null : "no single-file build yet (run tools/bundle.py)");
const bundle_test = (name, fn) =>
  (bundleWhy ? test(name, { skip: bundleWhy }, fn) : test(name, runClean(fn)));

async function openBundle(options) {
  const page = await (await newProfile(options)).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(origin + "/dist/warframe-prime-hunter.html", { waitUntil: "load" });
  return { page, errors };
}

/* The standalone is one file with no `data/` beside it, so the ten-minute
   fissure refresh has nothing to fetch and is caught and ignored - the
   documented behaviour, and the same safe direction the list already fails in.
   Served out of `dist/` that shows up as a 404 on the console, which is not an
   error these tests should fail on. */
const realErrors = (errors) =>
  errors.filter((e) => !/fissures\.json|Failed to load resource/.test(e));

const toTab = (page, view) => page.evaluate((v) => {
  const tab = [...document.querySelectorAll(".viewtab[data-view]")]
    .find((t) => t.getAttribute("data-view") === v);
  if (!tab) throw new Error("no tab for " + v);
  tab.click();
}, view);

bundle_test("the standalone's rank stepper moves one rank a press, not two", async () => {
  const { page, errors } = await openBundle();
  await page.evaluate(() => localStorage.setItem("wfprimes.plan.v1", JSON.stringify({ mastery: 10 })));
  await page.reload({ waitUntil: "load" });

  const rank = () => page.evaluate(() =>
    (JSON.parse(localStorage.getItem("wfprimes.plan.v1") || "{}") || {}).mastery);

  assert.equal(await rank(), 10, "the seeded rank has to be the one on screen");
  await page.locator("#mrUp").click();
  assert.equal(await rank(), 11,
               "two listeners on #mrUp stepped twice, and the rank derives the Void Trace cap");
  await page.locator("#mrDown").click();
  assert.equal(await rank(), 10, "and back down by one, for the same reason");
  assert.deepEqual(realErrors(errors), []);
});

bundle_test("one press of Download backup in the standalone saves one file", async () => {
  const { page, errors } = await openBundle({ acceptDownloads: true });
  const saved = [];
  page.on("download", (d) => saved.push(d.suggestedFilename()));

  await page.locator("#dataBtn").click();
  await page.locator("#downloadBtn").click();
  await page.waitForTimeout(1500);

  assert.equal(saved.length, 1,
               `one press must write one file, got ${saved.length}: ${JSON.stringify(saved)}`);
  assert.match(saved[0], /^prime-hunter-backup-\d{4}-\d{2}-\d{2}\.json$/);
  assert.deepEqual(realErrors(errors), []);
});

bundle_test("the standalone's licence footer and backup dialog reach both tabs", async () => {
  const { page, errors } = await openBundle();

  /* Both used to sit inside the collection's half of the document. The footer
     was filled twice and both times in that half, so the planner tab carried an
     empty one - and it is the footer that holds the licence and the Content
     Policy attribution. The dialog was worse: opened from the planner tab it
     was a modal inside a `display:none` ancestor, so it rendered at 0x0 while
     making the rest of the page inert. */
  for (const view of ["collection", "planner"]) {
    await toTab(page, view);
    const seen = await page.evaluate(() => {
      const foot = document.querySelector("#siteFoot");
      document.querySelector("#dataBtn").click();
      const dlg = document.querySelector("#dataDlg");
      const box = dlg.getBoundingClientRect();
      const out = {
        footChars: foot.textContent.trim().length,
        licence: /Content Policy/.test(foot.textContent),
        dlgOpen: dlg.open,
        dlgOnScreen: box.width > 0 && box.height > 0,
        payload: document.querySelector("#dataArea").value.length,
      };
      dlg.close();
      return out;
    });
    assert.ok(seen.footChars > 100, `the ${view} tab has an empty footer`);
    assert.ok(seen.licence, `the ${view} tab's footer does not carry the Content Policy notice`);
    assert.ok(seen.dlgOpen && seen.dlgOnScreen,
              `the backup dialog does not render on the ${view} tab`);
    assert.ok(seen.payload > 50, `the ${view} tab's backup box is empty`);
  }
  assert.deepEqual(realErrors(errors), []);
});

bundle_test("the standalone polls the fissure list once, not once per view", async () => {
  hits.length = 0;
  const { page, errors } = await openBundle();
  await page.waitForTimeout(600);
  const polls = hits.filter((h) => h.endsWith("fissures.json")).length;
  assert.equal(polls, 1,
               `both pages' scripts call watchFissures, so this counts pollers, not pages — got ${polls}`);
  assert.deepEqual(realErrors(errors), []);
});

bundle_test("one page owns the backup dialog, and the other leaves it alone", async () => {
  const { page } = await openBundle();
  assert.equal(await page.evaluate(() => document.querySelector("#dataDlg").dataset.wired),
               "collection",
               "app.js runs first in the bundle, so it claims the dialog");

  const { page: plan } = await open("/plan.html");
  assert.equal(await plan.evaluate(() => document.querySelector("#dataDlg").dataset.wired),
               "planner",
               "and on its own page the planner still wires its own dialog");
});
