/* VorFrame's page tests — the ones that need a real browser.
 *
 *     node --test tests/test_pages.mjs
 *     python tests/test_build.py         # runs these too, if Playwright is here
 *
 * app.js and plan.js are DOM from top to bottom: 124 and 62 browser-API calls
 * between them, across `closest`, `innerHTML`, `dataset`, `<dialog>`,
 * FileReader, Blob and focus handling. Stubbing that is writing a browser
 * badly, so these drive a real one instead.
 *
 * **Entirely optional.** Playwright is a large download and VorFrame needs
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
const built = fs.existsSync(path.join(ROOT, "data", "vorframe-data.js"));
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

  const saved = await page.evaluate(() => localStorage.getItem("vorframe.wishlist.v1"));
  assert.match(saved, /\[".+"\]/, "the farm list must reach localStorage");

  await page.reload({ waitUntil: "load" });
  const after = await page.evaluate(() => localStorage.getItem("vorframe.wishlist.v1"));
  assert.equal(after, saved, "and must still be there on the way back in");
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
    collected: JSON.parse(localStorage.getItem("vorframe.collected.v1") || "[]"),
    parts: JSON.parse(localStorage.getItem("vorframe.parts.v1") || "{}"),
    wishlist: JSON.parse(localStorage.getItem("vorframe.wishlist.v1") || "[]"),
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
    localStorage.setItem("vorframe.wishlist.v1", JSON.stringify(["warframe-xaku-prime"]));
  });
  await page.reload({ waitUntil: "load" });

  const spots = page.locator(".spot");
  assert.ok(await spots.count() > 0, "a wanted Prime with live relics must rank somewhere");
  const first = await spots.first().innerText();
  assert.match(first, /%/, "every row is scored");
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
    const D = window.VORFRAME_DATA, R = window.VorFrameRotation;
    const marked = D.items.filter((i) => (i.flags || {}).permanent);
    const rj = marked.filter((i) => R.railjackOnly(i, D.relics)).map((i) => i.name);
    return { marked: marked.length, rj: rj.sort() };
  });
  assert.ok(split.marked > split.rj.length && split.rj.length > 0,
            "both halves of the marker have to exist, or there is nothing to split");
  assert.ok(split.rj.every((n) => /Prime$/.test(n)));

  const shows = async (name, badge) => {
    const it = await page.evaluate((n) =>
      (window.VORFRAME_DATA.items.find((i) => i.name === n) || {}).id, name);
    await page.locator(`[data-id="${it}"]`).click();
    const text = await page.locator(".d-badges").innerText();
    await page.locator(".drawer-close").click();
    return text.includes(badge);
  };
  assert.ok(await shows(split.rj[0], "RAILJACK ONLY"),
            `${split.rj[0]} can only be farmed with a ship and the card must say so`);

  const plain = await page.evaluate((rj) => {
    const D = window.VORFRAME_DATA;
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
    const D = window.VORFRAME_DATA;
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
    const D = window.VORFRAME_DATA;
    const named = (s) => /\(Steel Path/i.test(s.node || "");
    const it = D.items.find((i) => (i.relics || []).some((r) => {
      const rec = D.relics[r];
      return rec && !rec.vaulted && (rec.sources || []).some(named);
    }));
    if (it) localStorage.setItem("vorframe.wishlist.v1", JSON.stringify([it.id]));
    localStorage.removeItem("vorframe.plan.v1");
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

  const steel = page.locator("#planNodes .spot").filter({ hasText: "(Steel Path)" });
  assert.ok(await steel.count() > 0,
            "a Steel Path node has to be rankable - it is not filtered out");
  // innerText, not textContent: the badge is uppercased in CSS
  const labels = await steel.first().locator(".demand").allInnerTexts();
  assert.ok(labels.includes("STEEL PATH"),
            `the row must say what it needs, got ${JSON.stringify(labels)}`);
  assert.ok(labels.includes("PVPVE"),
            "and Faceoff's own demand stacks with it rather than replacing it");
  assert.match(await steel.first().locator(".demand")
                          .filter({ hasText: "STEEL PATH" }).first()
                          .evaluate((e) => e.closest("[data-tip]").dataset.tip),
               /second star chart/i, "the badge has to carry its explanation");
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
    const D = window.VORFRAME_DATA;
    const it = D.items.find((i) => i.name === "Nyx Prime");
    if (it) localStorage.setItem("vorframe.wishlist.v1", JSON.stringify([it.id]));
    localStorage.setItem("vorframe.plan.v1", JSON.stringify({ railjack: false }));
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
    localStorage.setItem("vorframe.wishlist.v1", JSON.stringify(["warframe-xaku-prime"]));
  });
  await page.reload({ waitUntil: "load" });

  const order = () => page.locator("#planNodes .spot-where").allInnerTexts();
  const before = await order();
  assert.ok(before.length > 1, "need a ranking before there is anything to re-rank");
  assert.match(await page.locator("#planNodes .spot-score").first().innerText(),
               /%\s*\nper run/, "with nothing set the rows are still ranked per run");

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
               /%\s*\nper minute/, "the rows say what they are now ranked on");
  assert.notDeepEqual(await order(), before,
                      "costing a long mission twelve minutes a round changed nothing");
  assert.ok(await page.locator("#planNodes .est").count() > 0,
            "a type with no minutes of its own is costed at the average, and says so");

  await page.reload({ waitUntil: "load" });
  assert.match(await page.locator("#planNodes .spot-score").first().innerText(),
               /per minute/, "the weights did not survive a reload");

  await page.locator("#advanced > summary").click();
  await page.locator("#effortClear").click();
  assert.deepEqual(await order(), before, "clearing puts the per-run ranking back");
  assert.deepEqual(errors, []);
});

page_test("the two pages agree about what is on the farm list", async () => {
  const { page } = await open("/index.html");
  await page.locator("[data-id]").first().click();
  await page.getByRole("button", { name: /add to farm list/i }).click();
  const id = JSON.parse(await page.evaluate(
    () => localStorage.getItem("vorframe.wishlist.v1")))[0];

  await page.goto(origin + "/plan.html", { waitUntil: "load" });
  const list = await page.locator("#wishlist").innerText();
  assert.ok(list.trim().length > 0 && !/empty/i.test(list),
            `the planner did not pick up ${id} from the shared store`);
});

page_test("a bounty row names the live rotation and how long it has left", async () => {
  const { page } = await open("/plan.html");
  const bounty = await page.evaluate(() => {
    const R = window.VorFrameRotation;
    const groups = Object.keys((window.VORFRAME_DATA.meta.bounties || {}).groups || {});
    if (!groups.length) return null;
    const live = R.liveRotation(groups[0]);
    return { letter: live.letter, endsAt: live.endsAt, text: R.untilText(live.endsAt) };
  });
  if (!bounty) return;                       // a mirror build has no bounty data
  assert.match(bounty.letter, /^[ABC]$/);
  assert.ok(bounty.endsAt > Date.now(), "the window a countdown counts to must be ahead of now");
  assert.match(bounty.text, /^\d+ min$|^\d+h \d\dm$/);
});

// ── the responsive rules, which only a real browser can answer ─────────────

page_test("the sidebar does not push the grid off screen on a phone", async () => {
  const { page } = await open("/index.html");
  await page.setViewportSize({ width: 375, height: 812 });
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `the page scrolls sideways by ${overflow}px at 375px wide`);
});
