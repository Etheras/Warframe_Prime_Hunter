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
