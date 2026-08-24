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

function serve() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html";
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

async function open(page_url) {
  const page = await (await browser.newContext()).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(origin + page_url, { waitUntil: "load" });
  return { page, errors };
}

/* The option is passed only when there is a reason to skip. node:test checks
   whether `skip` is *present*, not whether it is truthy, so `{ skip: null }`
   silently skips the lot - which it duly did, reporting eight passes as eight
   skips with no reason given. */
const page_test = (name, fn) => (why ? test(name, { skip: why }, fn) : test(name, fn));

// ── the collection view ────────────────────────────────────────────────────

page_test("the collection renders, with no errors on the console", async () => {
  const { page, errors } = await open("/index.html");
  const cards = await page.locator("[data-id]").count();
  assert.ok(cards > 100, `expected a full catalogue, got ${cards} cards`);
  assert.deepEqual(errors, []);
});

page_test("ticking a part is saved, and survives a reload", async () => {
  const { page } = await open("/index.html");
  await page.locator("[data-id]").first().click();               // open the drawer
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

     The subject is picked by markup rather than by anything app.js decides: the
     first card that has more than one part counter in its drawer. */
  const { page, errors } = await open("/index.html");
  await page.locator("[data-id]").first().click();
  const own = page.locator("#drawerBody .part-own");
  assert.ok(await own.count() > 1, "the first card must have parts to bank");

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

  const card = page.locator('[data-id="secondary-lex-prime"]');
  await page.locator("#search").fill("Lex Prime");
  assert.equal(await card.count(), 1, "it has to be on screen before anything is unticked");

  /* Clicked in the page: the real checkbox sits under a styled span that
     swallows the pointer, which is how the fissure test drives one too. */
  const box = (id) => page.evaluate((s) => document.querySelector(s).click(), "#" + id);

  await box("f-farmable");
  assert.equal(await card.count(), 1,
               "Baro is still ticked and still sells it, so it must stay");
  await box("f-baro");
  assert.equal(await card.count(), 0,
               "with both of its sources unticked it must finally go");

  await box("f-baro");
  assert.equal(await card.count(), 1, "and come back when either one returns");
  assert.deepEqual(errors, []);
});

page_test("an akimbo asks for two of its sub-weapon, and can be given one", async () => {
  /* DE list the sub-weapon of an akimbo twice, one each, and saved progress is
     keyed on the part name - so the two entries shared one counter and there
     was nowhere to record having one of the two. Three clicks completed a
     four-part item.

     Named subject: Aklex Prime is built from two Lex Primes. */
  const { page, errors } = await open("/index.html");
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

  // and the card says where a built weapon actually comes from
  const note = await page.locator("#drawerBody .relic-none").first().innerText();
  assert.match(note, /Lex Prime/, "the row has to send you to the weapon itself");
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
  await page.locator("[data-id]").first().click();
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
  await page.locator("[data-id]").first().click();
  await page.getByRole("button", { name: /mark as collected/i }).click();
  await page.getByRole("button", { name: /add to farm list/i }).click();
  await page.keyboard.press("Escape");
  await page.locator("#dataBtn").click();
  const backup = await page.locator("#dataArea").inputValue();
  const expected = JSON.parse(backup);
  assert.ok(expected.collected.length >= 1, "nothing was collected to export");

  // a clean slate, then restore from the planner
  const fresh = await (await browser.newContext()).newPage();
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

page_test("the materials checklist keeps what you type in it", async () => {
  const { page } = await open("/index.html");
  await page.locator("#advanced summary").click();
  const first = page.locator("#matList input").first();
  await first.waitFor({ state: "visible", timeout: 2000 });
  await first.fill("7");
  await first.dispatchEvent("change");
  await page.reload({ waitUntil: "load" });
  await page.locator("#advanced summary").click();
  assert.equal(await page.locator("#matList input").first().inputValue(), "7");
});

// ── the planner ────────────────────────────────────────────────────────────

page_test("the planner ranks somewhere to go for a wanted Prime", async () => {
  const { page, errors } = await open("/plan.html");
  await page.evaluate(() => {
    localStorage.setItem("wfprimes.wishlist.v1", JSON.stringify(["warframe-xaku-prime"]));
  });
  await page.reload({ waitUntil: "load" });

  const spots = page.locator(".spot");
  assert.ok(await spots.count() > 0, "a wanted Prime with live relics must rank somewhere");
  const first = await spots.first().innerText();
  assert.match(first, /[\d.]+\s*\nrelics \//, "every row carries its ranked figure");
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
  const split = await page.evaluate(() => {
    const D = window.WFPRIME_DATA, R = window.WFPrimeRotation;
    const marked = D.items.filter((i) => (i.flags || {}).permanent);
    const rj = marked.filter((i) => R.railjackOnly(i, D.relics)).map((i) => i.name);
    return { marked: marked.length, rj: rj.sort() };
  });
  assert.ok(split.marked > split.rj.length && split.rj.length > 0,
            "both halves of the marker have to exist, or there is nothing to split");
  assert.ok(split.rj.every((n) => /Prime$/.test(n)));

  const shows = async (name, badge) => {
    const it = await page.evaluate((n) =>
      (window.WFPRIME_DATA.items.find((i) => i.name === n) || {}).id, name);
    await page.locator(`[data-id="${it}"]`).click();
    const text = await page.locator(".d-badges").innerText();
    await page.locator(".drawer-close").click();
    return text.includes(badge);
  };
  assert.ok(await shows(split.rj[0], "RAILJACK ONLY"),
            `${split.rj[0]} can only be farmed with a ship and the card must say so`);

  const plain = await page.evaluate((rj) => {
    const D = window.WFPRIME_DATA;
    return (D.items.find((i) => (i.flags || {}).permanent && !rj.includes(i.name)) || {}).name;
  }, split.rj);
  assert.ok(await shows(plain, "NEVER VAULTED"),
            `${plain} really is never vaulted, and must keep saying so`);
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
     subject, return early, go green having checked nothing. */
  const only = await page.evaluate(() => {
    const D = window.WFPRIME_DATA;
    const proxima = (s) => /Proxima/i.test(s.planet || "");
    for (const it of D.items) {
      for (const p of it.parts || []) {
        for (const r of p.relics || []) {
          const rec = D.relics[r.relic];
          if (!rec || rec.vaulted || !(rec.sources || []).length) continue;
          if (rec.sources.every(proxima)) return { id: it.id, relic: r.relic };
        }
      }
    }
    return null;
  });
  assert.ok(only, "no live relic drops only on Proxima - if that is really true " +
                  "now, delete this test rather than letting it pass empty");

  await page.locator(`[data-id="${only.id}"]`).click();
  const spots = page.locator(".drawer .spot");
  assert.ok(await spots.count() > 0,
            `${only.id} can only be farmed on Railjack, and the card offered nowhere`);
  // innerText, not textContent: the badge is uppercased in CSS, and what the
  // reader sees is the thing worth pinning
  assert.match(await spots.first().locator(".demand").innerText(), /^RAILJACK$/,
               "a node that needs a ship has to say so, since it is the only option");
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
    const page = await browser.newPage();
    await page.addInitScript((u) => { window.WFPRIME_UPSTREAM = u; }, upstream);
    await page.goto(origin + "/index.html", { waitUntil: "load" });
    const el = page.locator(".databar");
    const text = await el.count() ? await el.first().innerText() : "";
    await page.close();
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
  await page.locator("#advanced > summary").click();
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
    const r = R.runValue(rot, "reset", "Caches", false, null, cnt);
    return { total: r.total, count: r.count, penalty: R.cachePenalty };
  });
  assert.equal(halved.penalty, 0.5);
  assert.ok(Math.abs(halved.count - halved.total) < 1e-12,
            "runValue itself must stay unpenalised - the planner applies it, " +
            "so the collection view and the counts are not quietly moved too");
  assert.deepEqual(errors, []);
});

page_test("an empty ranking names the switch that emptied it", async () => {
  /* The one place the planner can strand you. Nyx Prime's four parts all come
     from relics that exist only on Proxima, so with Railjack off the page finds
     eight good places, discards every one, and used to print an empty heading -
     while the list directly beneath went on saying four relics are dropping and
     every part has one dropping for it. That reads as a fault, not a setting. */
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
  assert.equal(await where.locator(".spot").count(), 0,
               `${stranded} is Railjack-only, so nothing should rank with Railjack off`);
  const said = await where.innerText();
  assert.match(said, /Include Railjack/,
               "an empty ranking has to name the switch, and it is the only clue there is");
  assert.match(said, /\d+ places/, "and say how much is behind it");

  // the native box is hidden behind a styled span, so click the label a real
  // reader would click, not the input
  await page.locator("label:has(#p-railjack)").click();
  assert.ok(await page.locator("#p-railjack").isChecked());
  assert.ok(await where.locator(".spot").count() > 0,
            "ticking the box the message names has to actually produce places");
  assert.equal(await where.locator(".spot").first().locator(".demand").innerText(),
               "RAILJACK", "and every one of them says what it needs");
  assert.deepEqual(errors, []);
});

page_test("minutes per objective re-sort the list, and are remembered", async () => {
  /* The whole point of this option is that it changes the answer: ranking per
     run flatters anything long, and one player's timings moved Capture nodes up
     over a hundred places. A control that stores a number without moving a row
     would look like it worked. */
  const { page, errors } = await open("/plan.html");
  await page.evaluate(() => {
    localStorage.setItem("wfprimes.wishlist.v1", JSON.stringify(["warframe-xaku-prime"]));
  });
  await page.reload({ waitUntil: "load" });

  const order = () => page.locator("#planNodes .spot-where").allInnerTexts();
  const before = await order();
  assert.ok(before.length > 1, "need a ranking before there is anything to re-rank");
  assert.match(await page.locator("#planNodes .spot-score").first().innerText(),
               /[\d.]+\s*\nrelics \/ objective/,
               "with nothing set, objective count is the default cost basis");

  // an endless mission made expensive per round has to fall behind a fast one
  await page.locator("#advanced > summary").click();
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

  await page.locator("#advanced > summary").click();
  await page.locator("#effortClear").click();
  assert.deepEqual(await order(), before,
                   "clearing puts the per-objective default back");
  assert.match(await page.locator("#planNodes .spot-score").first().innerText(),
               /relics \/ objective/, "and says so again");

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

page_test("the two pages agree about what is on the farm list", async () => {
  const { page } = await open("/index.html");
  await page.locator("[data-id]").first().click();
  await page.getByRole("button", { name: /add to farm list/i }).click();
  const id = JSON.parse(await page.evaluate(
    () => localStorage.getItem("wfprimes.wishlist.v1")))[0];

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
     node nobody is being sent to. */
  const { page, errors } = await open("/plan.html");
  await page.evaluate(() => {
    const it = window.WFPRIME_DATA.items.find((i) => i.name === "Nyx Prime");
    if (it) localStorage.setItem("wfprimes.wishlist.v1", JSON.stringify([it.id]));
    localStorage.setItem("wfprimes.plan.v1", JSON.stringify({ railjack: true }));
  });
  await page.reload({ waitUntil: "load" });

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
  await page.evaluate(() => {
    const it = window.WFPRIME_DATA.items.find((i) => i.name === "Nyx Prime");
    if (it) localStorage.setItem("wfprimes.wishlist.v1", JSON.stringify([it.id]));
    localStorage.setItem("wfprimes.plan.v1", JSON.stringify({ railjack: true }));
  });
  await page.reload({ waitUntil: "load" });

  const first = page.locator("#planNodes .spot").first();
  assert.ok(await first.count() > 0, "nothing ranked, so there is no row to mark");
  const key = await first.locator(".fissure-slot").getAttribute("data-node");
  assert.equal(await first.locator(".tag.fissure").count(), 0,
               "no fissure has been planted yet, so nothing should claim one");

  await page.evaluate((n) => {
    window.WFPRIME_DATA.fissures.splice(0, window.WFPRIME_DATA.fissures.length, {
      node: n, tier: "Neo", mode: "Survival",
      ends: new Date(Date.now() + 45 * 60000).toISOString(), hard: false, storm: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  }, key);

  assert.equal(await first.locator(".tag.fissure").count(), 1,
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
  const card = page.locator('[data-id="warframe-caliban-prime"]');
  assert.equal(await card.count(), 1, "the named subject has left the catalogue");
  await card.click();

  const same = page.locator("#drawerBody .spot .same").first();
  await same.waitFor({ timeout: 5000 });
  const group = await same.evaluate((el) => ({
    tip: el.dataset.tip,
    named: el.closest(".spot").querySelector(".spot-where").childNodes[0].textContent.trim(),
  }));
  assert.ok(group.tip, "this test needs a folded group and the drawer showed none");

  // "  Cinxia (Ceres)  lvl 12–17" -> "Cinxia (Ceres)", skipping the named one
  const members = group.tip.split("\n")
    .map((l) => (l.match(/^\s{2}(.+?\s\(.+?\))\s/) || [])[1])
    .filter(Boolean);
  const other = members.find((m) => !m.startsWith(group.named + " "));
  assert.ok(other, `every member of the group is the one already named: ${members}`);

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
     part list changes upstream cannot make this pass by finding nothing. */
  const { page, errors } = await open("/plan.html");
  const id = await page.evaluate(() => {
    const it = window.WFPRIME_DATA.items.find((i) => i.name === "Nyx Prime");
    localStorage.setItem("wfprimes.wishlist.v1", JSON.stringify([it.id]));
    return it.id;
  });
  await page.reload({ waitUntil: "load" });

  const parts = page.locator("#wishlist .wish-part");
  assert.ok(await parts.count() > 1, "the subject needs parts left to bank");

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

page_test("an open page picks up a fissure that opened after it loaded", async () => {
  /* The badges used to be fixed at load: a one-minute timer re-read a list that
     could only shrink, so a tab left open all evening retired fissures as they
     closed and never heard about one that opened. `data/fissures.json` is the
     same list on its own — four kilobytes — re-read every ten minutes from this
     same origin, never from api.warframestat.us.

     The node is read off the row the planner ranked, so this cannot pass by
     marking somewhere nobody is being sent. */
  const { page, errors } = await open("/plan.html");
  await page.evaluate(() => {
    const it = window.WFPRIME_DATA.items.find((i) => i.name === "Nyx Prime");
    localStorage.setItem("wfprimes.wishlist.v1", JSON.stringify([it.id]));
    localStorage.setItem("wfprimes.plan.v1", JSON.stringify({ railjack: true }));
  });
  await page.reload({ waitUntil: "load" });

  const first = page.locator("#planNodes .spot").first();
  const key = await first.locator(".fissure-slot").getAttribute("data-node");
  assert.ok(key, "no row to mark");
  assert.equal(await first.locator(".tag.fissure").count(), 0,
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
  await page.locator(".tag.fissure").first().waitFor({ timeout: 5000 });

  const said = await first.locator(".tag.fissure").innerText();
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
